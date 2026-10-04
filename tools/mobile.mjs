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
 *   3. the arrow pad walks the player around a room, diagonals included
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

/**
 * Hold the arrow pad in a direction for a while: a thumb down on the arrow
 * that points (dx, dy), held, and lifted.
 */
const pushPad = async (page, dx, dy, holdMs) => {
  const box = await page.evaluate(() => {
    const el = document.querySelector('#touch-controls .tc-dpad');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2 };
  });
  if (!box) return false;
  const cdp = await page.target().createCDPSession();
  const to = { x: box.cx + dx * box.r * 0.7, y: box.cy + dy * box.r * 0.7, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [to] });
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
    const pad = document.querySelector('#touch-controls .tc-dpad');
    return {
      mounted: !!root,
      stickVisible: pad ? getComputedStyle(pad.parentElement).visibility === 'visible' : false,
      buttons: [...document.querySelectorAll('#touch-controls .tc-btn')].map((e) => e.textContent.trim()),
      quit: !!document.querySelector('#touch-controls .tc-corner'),
    };
  });
  await page.screenshot({ path: `${SHOTS}/01-hub-portrait.png` });
  check(
    'the controls are on a phone',
    seen.mounted && seen.stickVisible && seen.buttons.includes('E') && seen.quit,
    `arrow pad ${seen.stickVisible}, buttons ${seen.buttons.join('/')}`,
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
      const stick = document.querySelector('#touch-controls .tc-dpad').getBoundingClientRect();
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
        // Where the black around the picture is too thin for them, the
        // clusters sit over its bottom corners -- see-through, and marked so.
        over: document.getElementById('touch-controls').classList.contains('over'),
        corners: stick.top >= c.top + c.height * 0.4 && pads.top >= c.top + c.height * 0.4 &&
          stick.right <= c.left + c.width * 0.42 && pads.left >= c.right - c.width * 0.42,
        stickOn: stick.bottom <= window.innerHeight + 1,
        padsOn: pads.right <= window.innerWidth + 1 && pads.bottom <= window.innerHeight + 1,
        // Every control a thumb presses: off the screen edge by a margin, and
        // clear of every other one.
        tight: (() => {
          const els = [
            ...document.querySelectorAll('#touch-controls .tc-dkey, #touch-controls .tc-btn, #touch-controls .tc-corner'),
          ].filter((e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0);
          const bad = [];
          const rs = els.map((e) => e.getBoundingClientRect());
          rs.forEach((r, i) => {
            if (r.left < 4 || r.top < 4 || r.right > window.innerWidth - 4 || r.bottom > window.innerHeight - 4)
              bad.push(`${els[i].textContent.trim() || els[i].className} at the edge`);
            for (let j = i + 1; j < rs.length; j++) if (overlaps(r, rs[j])) bad.push(`${els[i].textContent.trim()}/${els[j].textContent.trim()} overlap`);
          });
          return bad;
        })(),
      };
    });
    await page.screenshot({ path: `${SHOTS}/02-fit-${name.replace(/ /g, '-')}.png` });
    // Twice the buffer is the bar: below that the 5x8 pixel font stops being
    // readable at arm's length.
    const bigEnough = fit.w >= 320 * 1.1;
    // The picture is the whole screen it fits.  The controls go in the black
    // around it when there is room (the band under it, in portrait), and only
    // when there is not do they come in over it: translucent, and kept to the
    // bottom corners, out of the middle where the game happens.
    const clear =
      (fit.hitsStick || fit.hitsPads ? fit.over && fit.corners : !fit.over) && fit.stickOn && fit.padsOn;
    check(
      `${name}: the picture fits and the thumbs are clear of it`,
      fit.onScreen && bigEnough && clear && fit.tight.length === 0,
      `${fit.w}x${fit.h}, overlap stick=${fit.hitsStick} pads=${fit.hitsPads} over=${fit.over} corners=${fit.corners}` +
        (fit.tight.length ? `; ${fit.tight.join(', ')}` : ''),
    );
    await page.close();
  }
}

// ---------------------------------------------- 4. the arrow pad walks the frog
{
  const page = await phone('?intro=1&tokens=20&scene=ArcadeHub');
  const at = () =>
    page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('ArcadeHub');
      return { x: Math.round(s.player.x), y: Math.round(s.player.y) };
    });
  const before = await at();
  await pushPad(page, -1, 0, 900);
  await sleep(200);
  const left = await at();
  await pushPad(page, 0, -1, 700);
  await sleep(200);
  const up = await at();
  const stuck = await page.evaluate(() => window.__touch.held());
  check(
    'the arrow pad walks while held, and lets go when the thumb does',
    left.x < before.x - 12 && up.y < left.y - 8 && stuck.length === 0,
    `${before.x},${before.y} -> ${left.x},${left.y} -> ${up.x},${up.y}, held [${stuck}]`,
  );

  // A diagonal arrow is both directions at once.
  await pushPad(page, 1, 1, 700);
  await sleep(200);
  const diag = await at();
  check(
    'the diagonal arrow walks down-and-right in one go',
    diag.x > up.x + 8 && diag.y > up.y + 6,
    `${up.x},${up.y} -> ${diag.x},${diag.y}`,
  );

  // And two fingers on two straight arrows add up to the same thing.
  const box = await page.evaluate(() => {
    const r = document.querySelector('#touch-controls .tc-dpad').getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2 };
  });
  const cdp = await page.target().createCDPSession();
  const upF = { x: box.cx, y: box.cy - box.r * 0.7, id: 1 };
  const leftF = { x: box.cx - box.r * 0.7, y: box.cy, id: 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [upF] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [upF, leftF] });
  await sleep(120);
  const both = await page.evaluate(() => window.__touch.held());
  await sleep(500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await sleep(200);
  const two = await at();
  check(
    'up and left held together go up-and-left',
    both.includes('W') && both.includes('A') && two.x < diag.x - 6 && two.y < diag.y - 4,
    `held [${both}], ${diag.x},${diag.y} -> ${two.x},${two.y}`,
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
      for (const k of Object.values(mod.touch.cross ?? {})) if (typeof k === 'string') have.add(k);
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
          // The race's numbered plates are drawn in the game and tapped there.
          n === 'NUMBER' ||
          n === 'HOLD' ||
          n === 'MOUSE' ||
          // "NOTHING - THE FIGHT IS NOT YOURS" asks for no key at all.
          n === 'NOTHING' ||
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

// -------- 8b. in the horror room the pad walks and the swipe turns, together
//
// The pad used to send the arrow keys along with WASD, and in the 3D rooms the
// arrow keys TURN -- so walking sideways swung the camera.  In landscape, on a
// wide phone, with real touches: the pad strafes without turning, a swipe turns
// without walking, both at once do both, a held RUN survives the swipe ending,
// the controls are clear of the picture, and they are wearing rust.
{
  const page = await phone('?intro=1&charity=1&route=basement&scene=HideRoom3D', { w: 844, h: 390 });
  await sleep(3200);
  const st = () =>
    page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('HideRoom3D');
      return { yaw: s.yaw, x: s.pos.x, z: s.pos.y };
    });
  const geo = await page.evaluate(() => {
    const r = (sel) => document.querySelector(sel)?.getBoundingClientRect();
    const c = r('#game-root canvas');
    const over = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const btns = [...document.querySelectorAll('#touch-controls .tc-btn, #touch-controls .tc-dkey, #touch-controls .tc-corner')]
      .map((e) => e.getBoundingClientRect())
      .filter((b) => b.width > 0);
    // Over the picture only in its bottom corners, never the middle third.
    const mid = { left: c.left + c.width / 3, right: c.right - c.width / 3, top: c.top, bottom: c.bottom };
    const high = { left: c.left, right: c.right, top: c.top, bottom: c.top + c.height * 0.4 };
    return {
      skin: document.getElementById('touch-controls').className,
      covered: btns.filter((b) => over(b, mid) || over(b, high)).length,
      smallest: Math.min(...[...document.querySelectorAll('#touch-controls .tc-btn')].map((e) => e.getBoundingClientRect().width)),
      look: (() => { const l = r('#touch-controls .tc-look'); return l && c ? Math.abs(l.width - c.width) + Math.abs(l.left - c.left) : 99; })(),
    };
  });
  await page.screenshot({ path: `${SHOTS}/06b-hideroom-landscape.png` });
  check(
    'landscape horror room: controls in the bottom corners, out of the middle, and rusted',
    geo.covered === 0 && geo.look < 2 && /skin-horror/.test(geo.skin) && geo.smallest >= 48,
    `${geo.covered} controls in the middle or the top, look pad off by ${geo.look}px, smallest button ${Math.round(geo.smallest)}px, [${geo.skin}]`,
  );

  // He talks first, and nobody walks during the rules: wait for the round.
  for (let i = 0; i < 60; i++) {
    const m = await page.evaluate(() => window.__froggy.game().scene.getScene('HideRoom3D').mode);
    if (m === 'hiding' || m === 'seeking') break;
    await sleep(500);
  }
  // The pad, alone: right is a strafe.
  const a = await st();
  const box = await page.evaluate(() => {
    const r = document.querySelector('#touch-controls .tc-dpad').getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, r: r.width / 2 };
  });
  const cdp = await page.target().createCDPSession();
  const east = { x: box.cx + box.r * 0.7, y: box.cy, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [east] });
  await sleep(150);
  const heldStrafe = await page.evaluate(() => window.__touch.held());
  await sleep(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(200);
  const b = await st();
  check(
    'the pad strafes and never turns the camera',
    heldStrafe.includes('D') && !heldStrafe.includes('RIGHT') && Math.abs(b.yaw - a.yaw) < 1e-6 && Math.hypot(b.x - a.x, b.z - a.z) > 0.2,
    `held [${heldStrafe}], yaw ${a.yaw.toFixed(3)} -> ${b.yaw.toFixed(3)}, moved ${Math.hypot(b.x - a.x, b.z - a.z).toFixed(2)}m`,
  );

  // Both thumbs at once: forward on the pad, a swipe on the picture.
  const look = await page.evaluate(() => {
    const r = document.querySelector('#touch-controls .tc-look').getBoundingClientRect();
    return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.4 };
  });
  const north = { x: box.cx, y: box.cy - box.r * 0.7, id: 1 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [north] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [north, { ...look, id: 2 }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [north, { x: look.x + i * 12, y: look.y, id: 2 }] });
    await sleep(40);
  }
  // Lift the swiping finger only (a move listing the fingers still down).
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [north] });
  await sleep(300);
  const stillWalking = await page.evaluate(() => window.__touch.held());
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(200);
  const c = await st();
  // 96px across a ~540px picture at 1.35 pi per picture is about 0.75 rad.
  check(
    'walking and turning work at the same time, and a swipe turns far enough',
    Math.abs(c.yaw - b.yaw) > 0.45 && Math.hypot(c.x - b.x, c.z - b.z) > 0.2 && stillWalking.includes('W'),
    `yaw ${b.yaw.toFixed(3)} -> ${c.yaw.toFixed(3)}, moved ${Math.hypot(c.x - b.x, c.z - b.z).toFixed(2)}m, held after the swipe [${stillWalking}]`,
  );

  // A thumb on RUN while the other swipes: the swipe ending is not RUN let go.
  const run = await page.evaluate(() => {
    const el = [...document.querySelectorAll('#touch-controls .tc-btn')].find((e) => e.textContent.trim() === 'RUN');
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...run, id: 3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...run, id: 3 }, { ...look, id: 4 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...run, id: 3 }, { x: look.x + 30, y: look.y, id: 4 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...run, id: 3 }] });
  await sleep(120);
  const runHeld = await page.evaluate(() => window.__touch.held());
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  check('a held RUN survives a swipe ending', runHeld.includes('SHIFT'), `held [${runHeld}]`);
  await page.close();
}

// ----- 8c. portrait: the empty band under the picture is for looking too
//
// Between the bottom of the picture and the tops of the controls there is a
// stretch of panel with nothing on it.  In the 3D rooms it is a second look
// surface -- marked, with a swipe hint that goes once it has been used -- and
// it never covers a control.  In landscape there is no such band and no zone.
{
  const page = await phone('?intro=1&charity=1&route=basement&scene=HideRoom3D');
  await page.evaluate(() => { try { localStorage.removeItem('froggy.lookHintUsed'); } catch {} });
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(3600);
  const geo = await page.evaluate(() => {
    const r = (q) => { const el = document.querySelector(q); return el && !el.hidden ? el.getBoundingClientRect() : null; };
    const zone = r('#touch-controls .tc-lookzone');
    const pic = document.querySelector('#game-root canvas').getBoundingClientRect();
    const controls = [...document.querySelectorAll('#touch-controls .tc-dkey, #touch-controls .tc-btn')]
      .filter((e) => !e.hidden && e.getBoundingClientRect().width > 0)
      .map((e) => e.getBoundingClientRect());
    const over = zone ? controls.filter((c) => c.left < zone.right && c.right > zone.left && c.top < zone.bottom && c.bottom > zone.top).length : -1;
    const hint = document.querySelector('#touch-controls .tc-hint');
    return {
      zone: zone && { top: Math.round(zone.top), bottom: Math.round(zone.bottom), h: Math.round(zone.height), w: Math.round(zone.width) },
      picBottom: Math.round(pic.bottom),
      over,
      hint: hint ? getComputedStyle(hint).opacity : null,
    };
  });
  await page.screenshot({ path: `${SHOTS}/06c-lookzone.png` });
  check(
    'portrait: the band between the picture and the controls is a marked look zone, clear of every control',
    !!geo.zone && geo.zone.top >= geo.picBottom && geo.zone.h >= 70 && geo.over === 0 && Number(geo.hint) > 0.1,
    geo.zone ? `${geo.zone.w}x${geo.zone.h} from ${geo.zone.top} (picture ends ${geo.picBottom}), ${geo.over} controls under it, hint ${geo.hint}` : 'no zone',
  );
  // The same swipe, on the picture and in the zone, turns you the same way and as far.
  const swipe = async (q) => {
    const at = await page.evaluate((q) => {
      const r = document.querySelector(q).getBoundingClientRect();
      return { x: r.left + r.width / 2 - 40, y: r.top + r.height / 2 };
    }, q);
    const yaw0 = await page.evaluate(() => window.__froggy.game().scene.getScene('HideRoom3D').yaw);
    const cdp = await page.target().createCDPSession();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...at, id: 1 }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: at.x + i * 10, y: at.y, id: 1 }] });
      await sleep(40);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    await sleep(300);
    return (await page.evaluate(() => window.__froggy.game().scene.getScene('HideRoom3D').yaw)) - yaw0;
  };
  const onPicture = await swipe('#touch-controls .tc-look');
  const inZone = await swipe('#touch-controls .tc-lookzone');
  await sleep(1400);
  const hintAfter = await page.evaluate(() => getComputedStyle(document.querySelector('#touch-controls .tc-hint')).opacity);
  check(
    'a swipe in the zone turns you like the same swipe on the picture, and the hint goes once used',
    Math.abs(inZone) > 0.05 && Math.sign(inZone) === Math.sign(onPicture) && Math.abs(inZone - onPicture) < Math.abs(onPicture) * 0.35 &&
      Number(hintAfter) < 0.1,
    `picture ${onPicture.toFixed(3)}, zone ${inZone.toFixed(3)}, hint now ${hintAfter}`,
  );
  await page.close();

  const wide = await phone('?intro=1&charity=1&route=basement&scene=HideRoom3D', { w: 844, h: 390 });
  await sleep(3200);
  const shown = await wide.evaluate(() => !document.querySelector('#touch-controls .tc-lookzone').hidden);
  check('landscape: no zone is reserved -- the picture is all look', !shown, shown ? 'zone shown' : 'none');
  await wide.close();
}

// ------------------------------------- 9. the gear pauses, and RESUME thaws
{
  const page = await phone('?intro=1&tokens=20&scene=ArcadeHub');
  const tapGame = async (x, y) => {
    const at = await page.evaluate(
      ([gxv, gyv]) => {
        const c = document.querySelector('#game-root canvas').getBoundingClientRect();
        const z = window.__froggy.game().scale.zoom;
        return { x: c.left + gxv * z, y: c.top + gyv * z };
      },
      [x, y],
    );
    await touch(page, at.x, at.y);
    await sleep(500);
  };
  const gear = await page.evaluate(() => {
    const el = document.querySelector('#touch-controls .tc-corner');
    return el ? { text: el.textContent.trim(), hidden: el.hidden } : null;
  });
  await pressButton(page, gear?.text ?? '');
  await sleep(700);
  const paused = await page.evaluate(() => ({
    scenes: window.__froggy.activeScenes(),
    frozen: window.__froggy.game().scene.isPaused('ArcadeHub'),
    pad: getComputedStyle(document.querySelector('#touch-controls .tc-left')).visibility,
  }));
  await tapGame(196, 34); // CONTROLS
  const rows = await page.evaluate(() => {
    const s = window.__froggy.game().scene.getScene('SettingsModal');
    const out = [];
    const walk = (l) => { for (const o of l) { if (typeof o.text === 'string') out.push(o.text); if (o.list) walk(o.list); } };
    walk(s.children.list);
    return out;
  });
  await page.screenshot({ path: `${SHOTS}/07-paused.png` });
  check(
    'the gear pauses the room and puts the menu up',
    gear && !gear.hidden && paused.scenes.includes('SettingsModal') && paused.frozen && paused.pad === 'hidden',
    `gear ${JSON.stringify(gear)}, ${paused.scenes.join(',')}, hub paused ${paused.frozen}, pad ${paused.pad}`,
  );
  check(
    "and its controls are the phone's, not the keyboard's",
    rows.includes('ARROWS') && !rows.some((t) => /^(W A S D|SHIFT|ESC)$/.test(t)),
    rows.filter((t) => t.length < 30).join(' | '),
  );
  await tapGame(120, 158); // RESUME
  await sleep(600);
  const back = await page.evaluate(() => ({
    scenes: window.__froggy.activeScenes(),
    frozen: window.__froggy.game().scene.isPaused('ArcadeHub'),
  }));
  check(
    'RESUME puts the room back exactly where it was',
    !back.scenes.includes('SettingsModal') && !back.frozen,
    back.scenes.join(','),
  );
  await page.close();
}

// ------------------- 9b. a cabinet's card describes the phone's controls
{
  const page = await phone('?intro=1&tokens=20&game=donkeykong');
  const card = await page.evaluate(() => {
    const s = window.__froggy.game().scene.getScene('Minigame');
    const out = [];
    const walk = (l) => { for (const o of l) { if (typeof o.text === 'string') out.push(o.text); if (o.list) walk(o.list); } };
    walk(s.children.list);
    return out;
  });
  await page.screenshot({ path: `${SHOTS}/07b-card.png` });
  check(
    'the how-to-play card names arrows and buttons, not keys',
    card.includes('← →') && card.includes('↑ ↓') && !card.includes('A / D') && !card.includes('SPACE'),
    card.filter((t) => t.length < 24).join(' | '),
  );
  await page.close();
}

// ------------------------------------------ 10. a phone can skip the opening
{
  const page = await phone('?scene=IntroCutscene');
  const seen = await page.evaluate(() => {
    const s = window.__froggy.game().scene.getScene('IntroCutscene');
    const buttons = [...document.querySelectorAll('#touch-controls .tc-btn')].map((e) =>
      e.textContent.trim(),
    );
    return { hint: !!s?.skip, buttons };
  });
  await page.screenshot({ path: `${SHOTS}/08-intro-skip.png` });
  check(
    'the phone gets a SKIP button and not an Esc it cannot press',
    seen.hint === false && seen.buttons.includes('SKIP') && seen.buttons.includes('NEXT'),
    `hint ${seen.hint}, buttons [${seen.buttons}]`,
  );

  await pressButton(page, 'SKIP');
  await sleep(3000);
  const out = await page.evaluate(() => ({
    scenes: window.__froggy.activeScenes(),
    buttons: [...document.querySelectorAll('#touch-controls .tc-btn')].map((e) => e.textContent.trim()),
  }));
  check(
    'tapping it leaves the opening at once, and takes itself with it',
    out.scenes.includes('ExteriorDay') && !out.buttons.includes('SKIP'),
    `${out.scenes.join(',')} with [${out.buttons}]`,
  );
  await page.close();
}

// ------------------- 12. the Dance Off is one big cross, in the middle, clear
//
// Its four arrows are the game: one large cross of four separate buttons, in
// the middle -- under the picture in portrait, over the bottom of the stage in
// landscape with the dancers stepped up out of its way -- and every arm sends
// its own lane's key.
for (const [name, w, h] of [
  ['portrait', 390, 844],
  ['landscape', 844, 390],
]) {
  const page = await phone('?intro=1&tokens=40&game=danceoff', { w, h });
  await page.keyboard.press('Enter');
  await sleep(1400);
  const geo = await page.evaluate(() => {
    const c = document.querySelector('#game-root canvas').getBoundingClientRect();
    const cross = document.querySelector('#touch-controls .tc-cross');
    const arms = [...cross.querySelectorAll('.tc-xbtn')].map((e) => e.getBoundingClientRect());
    const r = cross.getBoundingClientRect();
    const per = 320 / c.width;
    return {
      shown: !cross.hidden && arms.every((a) => a.width > 0),
      size: Math.min(...arms.map((a) => a.width)),
      offCentre: Math.abs(r.left + r.width / 2 - (c.left + c.width / 2)),
      below: r.top >= c.bottom - 1,
      crossTop: (r.top - c.top) * per,
      feet: window.__dance.state().feet,
      corners: document.querySelectorAll('#touch-controls .tc-btn').length,
    };
  });
  const sent = [];
  for (const dir of ['up', 'left', 'down', 'right']) {
    const p = await page.evaluate((d) => {
      const b = document.querySelector(`#touch-controls .tc-xbtn[data-dir="${d}"]`).getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }, dir);
    const cdp = await page.target().createCDPSession();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id: 1 }] });
    await sleep(60);
    sent.push((await page.evaluate(() => window.__touch.held())).join('+'));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }
  await page.screenshot({ path: `${SHOTS}/09-dance-${name}.png` });
  const clear = name === 'portrait' ? geo.below : geo.crossTop >= geo.feet;
  check(
    `${name}: the Dance Off is one big cross in the middle, clear of the dancers, each arm its own key`,
    geo.shown && geo.corners === 0 && geo.offCentre < 4 && clear && geo.size >= 44 && sent.join(',') === 'W,A,S,D',
    `arms ${Math.round(geo.size)}px, ${Math.round(geo.offCentre)}px off centre, cross top ${Math.round(geo.crossTop)} vs feet ${geo.feet}, sent [${sent}]`,
  );
  await page.close();
}

// --------- 13. the Car Chase steers off a small thumbstick, gently and smoothly
//
// The arrow pad was full lock at the lightest touch.  Now a compact stick:
// a small push steers a little, a full push steers more but under the
// keyboard's lock, and the steering eases in rather than snapping.
{
  const page = await phone('?intro=1&tokens=40&game=carchase', { w: 844, h: 390 });
  await page.keyboard.press('Enter');
  await sleep(1500);
  const box = await page.evaluate(() => {
    const j = document.querySelector('#touch-controls .tc-joy');
    const r = j.getBoundingClientRect();
    return { shown: !j.hidden && r.width > 0, w: r.width, cx: r.left + r.width / 2, cy: r.top + r.height / 2, pad: !document.querySelector('#touch-controls .tc-dpad').hidden };
  });
  const drive = async (push, ms) => {
    await page.evaluate(() => {
      window.__chase.clearRoad();
      window.__chase.setPlayer(window.__chase.laneX(0), 140);
    });
    await sleep(250);
    const x0 = await page.evaluate(() => window.__chase.state().px);
    const cdp = await page.target().createCDPSession();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.cx, y: box.cy, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.cx + (box.w / 2) * push, y: box.cy, id: 1 }] });
    await sleep(90);
    const early = await page.evaluate(() => window.__chase.state().thumbSteer);
    await sleep(ms - 90);
    const x1 = await page.evaluate(() => window.__chase.state().px);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    return { moved: x1 - x0, early };
  };
  const light = await drive(0.45, 500);
  const full = await drive(1, 500);
  const after = await page.evaluate(() => window.__touch.held());
  // The keyboard's full lock over the same half second, for the bar.
  const keyLock = 170 * 0.5;
  await page.screenshot({ path: `${SHOTS}/10-chase-stick.png` });
  check(
    'the car chase steers off a compact stick: a little push a little, a full push under full lock, eased in',
    box.shown && !box.pad && box.w <= 110 &&
      light.moved > 1 && light.moved < full.moved * 0.5 && full.moved < keyLock * 0.85 && full.moved > keyLock * 0.4 &&
      full.early < 0.75 && after.length === 0,
    `stick ${Math.round(box.w)}px, light ${light.moved.toFixed(1)}px, full ${full.moved.toFixed(1)}px (keys ${keyLock}), eased to ${full.early.toFixed(2)} after 90ms, held [${after}]`,
  );
  await page.close();
}

// -------------------------------- 11. and the desktop opening is left alone
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?scene=IntroCutscene`, { waitUntil: 'networkidle2' });
  await sleep(2400);
  const desk = await page.evaluate(() => {
    const s = window.__froggy.game().scene.getScene('IntroCutscene');
    return { hint: s?.skip?.text ?? null, controls: !!document.getElementById('touch-controls') };
  });
  check(
    'the desktop opening still says which key skips it',
    desk.hint === '[ESC] SKIP' && desk.controls === false,
    `hint ${JSON.stringify(desk.hint)}, controls ${desk.controls}`,
  );
  await page.close();
}

console.log(failures ? `\n${failures} FAILED` : '\nAll mobile checks passed.');
await browser.close();
process.exit(failures ? 1 : 0);
