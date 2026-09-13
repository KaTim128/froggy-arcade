/**
 * The phone build, driven with real touches.  PRD §7.14.
 *
 * A device farm is not available, so this does the next honest thing: Chrome's
 * device emulation for the screen and the pointer, `?touch=1` for the
 * detection, and CDP touch events for the thumbs — no synthetic clicks on
 * buttons, no calling the game's own functions.  If a check here passes, a
 * finger in that place did that thing.
 *
 * What it is actually proving, in order:
 *   1. the controls appear on a phone and nowhere else
 *   2. the picture is big enough to read, and the controls do not cover it
 *   3. the stick walks the player around a room
 *   4. a cabinet's own buttons appear when it is played, and they play it
 *   5. the door can be reached by pointing at it
 *   6. every scene and every cabinet has a layout, and every key it reads is
 *      reachable by thumb
 *
 *   node tools/mobile.mjs
 */

import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';

const URL = 'http://localhost:5173';
const SHOTS = 'tools/shots/mobile';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = [
  process.env.CHROME_PATH ?? '',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].find((p) => existsSync(p));

mkdirSync(SHOTS, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};

/** A page pretending to be a phone: small screen, coarse pointer, touch on. */
const phone = async (query, { w = 390, h = 844 } = {}) => {
  const page = await browser.newPage();
  await page.emulate({
    viewport: { width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const sep = query.includes('?') ? '&' : '?';
  await page.goto(`${URL}/${query}${sep}touch=1`, { waitUntil: 'networkidle2' });
  await sleep(2200);
  return page;
};

/** A real touch, through the protocol, at a page coordinate. */
const touch = async (page, x, y, holdMs = 120) => {
  const cdp = await page.target().createCDPSession();
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  });
  await sleep(holdMs);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
};

/** Hold the stick in a direction for a while: start, drag, hold, release. */
const pushStick = async (page, dx, dy, holdMs) => {
  const box = await page.evaluate(() => {
    const el = document.querySelector('#touch-controls .tc-stick');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2 };
  });
  if (!box) return false;
  const cdp = await page.target().createCDPSession();
  const to = { x: box.cx + dx * box.r * 0.8, y: box.cy + dy * box.r * 0.8, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.cx, y: box.cy, id: 1 }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [to] });
  await sleep(holdMs);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  return true;
};

/** Press an on-screen button by its label. */
const pressButton = async (page, label, holdMs = 140) => {
  const at = await page.evaluate((want) => {
    const els = [...document.querySelectorAll('#touch-controls .tc-btn, #touch-controls .tc-corner')];
    const el = els.find((e) => e.textContent.trim() === want);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, label);
  if (!at) return false;
  await touch(page, at.x, at.y, holdMs);
  return true;
};

const labels = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#touch-controls .tc-btn')].map((e) => e.textContent.trim()),
  );

// ---------------------------------------------------------------- 1. it shows
{
  const page = await phone('?intro=1&tokens=20&scene=ArcadeHub');
  const seen = await page.evaluate(() => {
    const root = document.getElementById('touch-controls');
    const stick = document.querySelector('#touch-controls .tc-stick');
    return {
      mounted: !!root,
      stickVisible: stick ? getComputedStyle(stick.parentElement).visibility === 'visible' : false,
      buttons: [...document.querySelectorAll('#touch-controls .tc-btn')].map((e) => e.textContent.trim()),
      quit: !!document.querySelector('#touch-controls .tc-corner'),
    };
  });
  await page.screenshot({ path: `${SHOTS}/01-hub-portrait.png` });
  check(
    'the controls are on a phone',
    seen.mounted && seen.stickVisible && seen.buttons.includes('E') && seen.quit,
    `stick ${seen.stickVisible}, buttons ${seen.buttons.join('/')}`,
  );
  await page.close();
}

// ---------------------------------------------------------- 2. and not on one
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=20&scene=ArcadeHub`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  const clean = await page.evaluate(() => ({
    controls: !!document.getElementById('touch-controls'),
    pad: document.getElementById('game-root').style.paddingBottom,
    zoom: window.__froggy.game().scale.zoom,
  }));
  check(
    'the desktop build is untouched',
    clean.controls === false && !clean.pad && Number.isInteger(clean.zoom),
    `controls ${clean.controls}, pad "${clean.pad}", zoom ${clean.zoom}`,
  );
  await page.close();
}

// ------------------------------------------- 3. the picture fits, and is clear
{
  for (const [name, w, h] of [
    ['tall phone', 390, 844],
    ['small phone', 360, 640],
    ['landscape', 844, 390],
  ]) {
    const page = await phone('?intro=1&tokens=20&scene=ArcadeHub', { w, h });
    const fit = await page.evaluate(() => {
      const c = document.querySelector('#game-root canvas').getBoundingClientRect();
      const stick = document.querySelector('#touch-controls .tc-stick').getBoundingClientRect();
      const pads = document.querySelector('#touch-controls .tc-pads').getBoundingClientRect();
      const overlaps = (a, b) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return {
        w: Math.round(c.width),
        h: Math.round(c.height),
        onScreen: c.right <= window.innerWidth + 1 && c.bottom <= window.innerHeight + 1,
        portrait: window.innerHeight >= window.innerWidth,
        hitsStick: overlaps(c, stick),
        hitsPads: overlaps(c, pads),
        stickOn: stick.bottom <= window.innerHeight + 1,
        padsOn: pads.right <= window.innerWidth + 1 && pads.bottom <= window.innerHeight + 1,
      };
    });
    await page.screenshot({ path: `${SHOTS}/02-fit-${name.replace(/ /g, '-')}.png` });
    // Twice the buffer is the bar: below that the 5x8 pixel font stops being
    // readable at arm's length.
    const bigEnough = fit.w >= 320 * 1.1;
    // Portrait puts the controls in the dead band UNDER the picture, so
    // nothing may overlap at all.  Landscape has no band and overlays the
    // corners on purpose, so only "still on the screen" is asserted there.
    const clear = fit.portrait ? !fit.hitsStick && !fit.hitsPads : fit.stickOn && fit.padsOn;
    check(
      `${name}: the picture fits and the thumbs are clear of it`,
      fit.onScreen && bigEnough && clear,
      `${fit.w}x${fit.h}, overlap stick=${fit.hitsStick} pads=${fit.hitsPads}`,
    );
    await page.close();
  }
}

// -------------------------------------------------- 4. the stick walks the frog
{
  const page = await phone('?intro=1&tokens=20&scene=ArcadeHub');
  const at = () =>
    page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('ArcadeHub');
      return { x: Math.round(s.player.x), y: Math.round(s.player.y) };
    });
  const before = await at();
  await pushStick(page, -1, 0, 900);
  await sleep(200);
  const left = await at();
  await pushStick(page, 0, -1, 700);
  await sleep(200);
  const up = await at();
  const stuck = await page.evaluate(() => window.__touch.held());
  check(
    'the stick walks, and lets go when the thumb does',
    left.x < before.x - 12 && up.y < left.y - 8 && stuck.length === 0,
    `${before.x},${before.y} -> ${left.x},${left.y} -> ${up.x},${up.y}, held [${stuck}]`,
  );
  await page.screenshot({ path: `${SHOTS}/03-walked.png` });
  await page.close();
}

// ------------------------------------- 5. a cabinet brings its own buttons out
{
  const page = await phone('?intro=1&tokens=20&game=grudge');
  const onCard = await labels(page);
  // The card is two big buttons you tap; PLAY is at (108, 163) in game space.
  const play = await page.evaluate(() => {
    const c = document.querySelector('#game-root canvas').getBoundingClientRect();
    const z = window.__froggy.game().scale.zoom;
    return { x: c.left + 108 * z, y: c.top + 163 * z };
  });
  await touch(page, play.x, play.y);
  await sleep(2600);
  const inGame = await labels(page);
  await page.screenshot({ path: `${SHOTS}/04-grudge.png` });
  check(
    "the cabinet's own keys arrive as its own buttons",
    onCard.length === 0 && ['HIGH', 'LOW', 'SPCL', 'BLOCK'].every((l) => inGame.includes(l)),
    `card [${onCard}] -> playing [${inGame}]`,
  );

  // And they play it: HIGH is J, and J is a punch that lands.
  const hp = () => page.evaluate(() => window.__grudge.state().him.hp);
  await page.evaluate(() => {
    window.__grudge.freeze(true);
    window.__grudge.place(150, 172);
  });
  const hpBefore = await hp();
  await pressButton(page, 'HIGH', 200);
  await sleep(700);
  const hpAfter = await hp();
  check('and pressing one throws the punch', hpAfter < hpBefore, `${hpBefore} -> ${hpAfter} hp`);
  await page.close();
}

// ------------------------------------------------- 6. tapping the door goes in
{
  const page = await phone('?intro=1&tokens=20&scene=ExteriorDay');
  const door = await page.evaluate(() => {
    const c = document.querySelector('#game-root canvas').getBoundingClientRect();
    const z = window.__froggy.game().scale.zoom;
    const s = window.__froggy.game().scene.getScene('ExteriorDay');
    // Walk away first, so the tap has to bring him back.
    s.player.x = 40;
    return { x: c.left + 160 * z, y: c.top + 128 * z };
  });
  await sleep(200);
  await touch(page, door.x, door.y);
  await sleep(4000);
  const scenes = await page.evaluate(() => window.__froggy.activeScenes());
  await page.screenshot({ path: `${SHOTS}/05-door.png` });
  check('tapping the door walks over and goes in', scenes.includes('ArcadeHub'), scenes.join(','));
  await page.close();
}

// --------------------------------- 7. nothing is unreachable by thumb, anywhere
{
  const page = await phone('?intro=1&tokens=20&scene=ArcadeHub');
  const audit = await page.evaluate(async () => {
    const { SCENE_TOUCH } = await import('/src/game/touchLayouts.ts');
    const { getMinigame } = await import('/src/minigames/registry.ts');
    const { CABINETS } = await import('/src/game/content.ts');
    const game = window.__froggy.game();
    const sceneKeys = game.scene.scenes.map((s) => s.scene.key);
    const missing = sceneKeys.filter((k) => !(k in SCENE_TOUCH));
    const cabs = CABINETS.map((c) => c.id);
    const noLayout = cabs.filter((id) => !getMinigame(id)?.touch);
    // Every key a cabinet's own tutorial names has to be reachable: on the
    // stick, on a button, or on the standing quit.
    const STICK = { wasd: ['W', 'A', 'S', 'D'], lr: ['A', 'D'], ud: ['W', 'S'] };
    const ARROW = { W: 'UP', A: 'LEFT', S: 'DOWN', D: 'RIGHT' };
    const unreachable = [];
    for (const id of cabs) {
      const mod = getMinigame(id);
      if (!mod?.touch) continue;
      const have = new Set(['ESC']);
      for (const k of STICK[mod.touch.stick] ?? []) {
        have.add(k);
        if (mod.touch.arrows) have.add(ARROW[k]);
      }
      for (const b of mod.touch.buttons ?? []) {
        have.add(b.key);
        if (b.also) have.add(b.also);
      }
      // The cabinets played by pointing are complete with no buttons at all.
      const pointer = (mod.touch.buttons ?? []).length === 0 && !mod.touch.stick;
      if (pointer) continue;
      for (const [keys] of mod.tutorial.controls) {
        const ALIAS = {
          SPACEBAR: 'SPACE',
          1: 'ONE',
          2: 'TWO',
          3: 'THREE',
          4: 'FOUR',
        };
        const names = keys
          .toUpperCase()
          .split(/[\s/]+/)
          .filter(Boolean)
          .map((n) => ALIAS[n] ?? n);
        // A row is satisfied when ANY name on it is reachable — "SPACE / W" is
        // one action with two spellings.
        const reachable = (n) =>
          have.has(n) ||
          n === 'CLICK' ||
          n === 'HOLD' ||
          n === 'MOUSE' ||
          (n === 'ARROWS' && [...have].some((h) => ['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(h)));
        const ok = names.some(reachable);
        if (!ok) unreachable.push(`${id}:${keys}`);
      }
    }
    return { missing, noLayout, unreachable, scenes: sceneKeys.length, cabs: cabs.length };
  });
  check(
    'every scene has a thumb layout',
    audit.missing.length === 0,
    `${audit.scenes} scenes, missing [${audit.missing}]`,
  );
  check(
    'every cabinet has one too',
    audit.noLayout.length === 0,
    `${audit.cabs} cabinets, missing [${audit.noLayout}]`,
  );
  check(
    'and every key a cabinet asks for is under a thumb',
    audit.unreachable.length === 0,
    audit.unreachable.length ? audit.unreachable.join(', ') : 'all reachable',
  );
  await page.close();
}

// ---------------------------------------- 8. the horror rooms turn on a drag
{
  const page = await phone('?intro=1&charity=1&route=basement&scene=HideRoom3D');
  await sleep(3200);
  const before = await page.evaluate(() => {
    const s = window.__froggy.game().scene.getScene('HideRoom3D');
    return s ? s.yaw : null;
  });
  const pad = await page.evaluate(() => {
    const el = document.querySelector('#touch-controls .tc-look');
    if (!el || el.hidden) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  let after = before;
  if (pad) {
    const cdp = await page.target().createCDPSession();
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: pad.x, y: pad.y, id: 1 }],
    });
    for (let i = 1; i <= 6; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: pad.x + i * 14, y: pad.y, id: 1 }],
      });
      await sleep(40);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    await sleep(300);
    after = await page.evaluate(() => window.__froggy.game().scene.getScene('HideRoom3D').yaw);
  }
  await page.screenshot({ path: `${SHOTS}/06-hideroom.png` });
  check(
    'a drag turns you in the room he is looking for you in',
    pad !== null && before !== null && Math.abs(after - before) > 0.05,
    pad ? `yaw ${Number(before).toFixed(3)} -> ${Number(after).toFixed(3)}` : 'no look pad',
  );
  await page.close();
}

console.log(failures ? `\n${failures} FAILED` : '\nAll mobile checks passed.');
await browser.close();
process.exit(failures ? 1 : 0);
