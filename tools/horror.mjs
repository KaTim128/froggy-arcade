/**
 * The horror act: the turn, the transformation, and the three hide-and-seek
 * rooms behind the door.
 *
 *   node tools/horror.mjs [--url http://localhost:5173]
 *
 * The beat only works if it is quiet and then it is not, so the things worth
 * asserting are the timings and the state transitions — a scare that fires late,
 * or a door that leads back the way you came, is the whole thing ruined.
 */

import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const URL = arg('--url', 'http://localhost:5173');
const SHOTS = 'tools/shots/horror';
mkdirSync(SHOTS, { recursive: true });

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));
if (!CHROME) {
  console.error('No Chrome/Edge found.');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let failed = 0;
const check = (name, ok, note = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  — ${note}` : ''}`);
  if (!ok) failed++;
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--autoplay-policy=no-user-gesture-required'],
});

const newPage = async (qs) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|vite\.svg/i.test(t)) errors.push(`console.error: ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${URL}/${qs}`, { waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.mouse.click(640, 60); // audio unlock + canvas focus, in the title bar
  await sleep(400);
  return page;
};

const overlayPixels = (page) =>
  page.evaluate(() => {
    const c = document.getElementById('froggy-layer');
    if (!c) return -1;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });

const hs = (page) =>
  page.evaluate(() => {
    const s = window.__froggy.game().scene.getScene('HideAndSeek');
    return {
      room: s.roomIndex,
      theme: s.theme.name,
      props: s.props.length,
      froggy: { x: s.froggy.x, y: s.froggy.y, dir: s.froggy.dir },
      player: { x: s.player.x, y: s.player.y },
      mode: s.mode,
      hidden: s.hidden,
      timeLeft: s.timeLeft,
      over: s.over,
    };
  });

try {
  // ------------------------------------------------------------- the turn
  console.log('\nhorror  you turn around and he is already there');
  {
    const page = await newPage('?intro=1&charity=1&key=1&route=basement&scene=BasementSequence');
    await page.evaluate(() => window.__froggy.game().scene.getScene('BasementSequence').show(8));
    await sleep(1100);

    const a = await overlayPixels(page);
    await page.screenshot({ path: `${SHOTS}/01-stare.png` });
    check('he is on screen for the stare', a > 2000, `${a} overlay px`);

    // Unnaturally still: the overlay must not change while he is staring.
    const b = await overlayPixels(page);
    await sleep(500);
    const c = await overlayPixels(page);
    check('he does not move a pixel while staring', b === c, `${b} vs ${c}`);

    // ...and then he does.
    await sleep(1600);
    const during = await overlayPixels(page);
    await page.screenshot({ path: `${SHOTS}/02-transform.png` });
    check('the transformation fills the frame', during > a * 1.5, `${a} -> ${during} px`);

    const frame = () => page.evaluate(() => window.__froggy.game().scene.getScene('BasementSequence').index);
    check('the turn is its own frame', (await frame()) === 9, `frame ${await frame()}`);

    // The whole beat lands inside about four seconds.
    let waited = 0;
    while ((await frame()) === 9 && waited < 7000) {
      await sleep(250);
      waited += 250;
    }
    check('the horror beat resolves in about four seconds', waited < 4000, `${1900 + waited}ms total`);
    check('it ends on the way out, not the way in', (await frame()) === 10, `frame ${await frame()}`);
    check('the overlay is cleared for the door', (await overlayPixels(page)) === 0);
    await page.screenshot({ path: `${SHOTS}/03-door.png` });

    // The hotspot only exists once the crossfade into the frame has finished.
    await sleep(1400);
    await page.mouse.click(640, 360 + (100 - 90) * 4);
    await sleep(3000);
    const after = await page.evaluate(() => ({
      scenes: window.__froggy.activeScenes(),
      state: window.__froggy.state(),
    }));
    check('the door leads on to the rooms', after.scenes.includes('HideAndSeek'), after.scenes.join(','));
    check('the route commits to hide', after.state.route === 'hide' && after.state.hideRoom === 0,
      `route=${after.state.route} room=${after.state.hideRoom}`);
    await page.close();
  }

  // ------------------------------------------------------- three settings
  console.log('\nhorror  three rooms, three settings');
  {
    const seen = [];
    for (const room of [0, 1, 2]) {
      const page = await newPage(`?intro=1&charity=1&key=1&route=hide&hideRoom=${room}&scene=HideAndSeek`);
      const s = await hs(page);
      seen.push(s.theme);
      await page.screenshot({ path: `${SHOTS}/room-${room}.png` });
      check(`room ${room + 1} has cover to hide behind`, s.props >= 6, `${s.theme}, ${s.props} props`);
      await page.close();
    }
    check('each room is its own setting', new Set(seen).size === 3, seen.join(' / '));
  }

  // --------------------------------------------------- searching and seeing
  console.log('\nhorror  he searches, and then he sees you');
  {
    const page = await newPage('?intro=1&charity=1&key=1&route=hide&hideRoom=0&scene=HideAndSeek');

    const a = await hs(page);
    await sleep(1500);
    const b = await hs(page);
    check('he sweeps the room unprompted',
      Math.hypot(b.froggy.x - a.froggy.x, b.froggy.y - a.froggy.y) > 4,
      `moved ${Math.hypot(b.froggy.x - a.froggy.x, b.froggy.y - a.froggy.y).toFixed(1)}px`);
    check('he starts out searching, not chasing', b.mode !== 'chase', b.mode);

    // Put the player directly in front of him and let him look.
    await page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('HideAndSeek');
      s.player.x = s.froggy.x + Math.cos(s.froggy.dir) * 26;
      s.player.y = s.froggy.y + Math.sin(s.froggy.dir) * 26;
      s.props.length = 0; // nothing between you and him
      s.hidden = false;
    });
    await sleep(700);
    const spotted = await hs(page);
    check('standing in his eyeline is seen', spotted.mode === 'chase', spotted.mode);
    await page.screenshot({ path: `${SHOTS}/04-chase.png` });

    await page.close();
  }

  // A clean page for the speed comparison: in the block above he closes on the
  // player and catches them, which ends the room and resets his position — that
  // reset is a 113px jump, and it is not a walking speed.
  {
    const page = await newPage('?intro=1&charity=1&key=1&route=hide&hideRoom=0&scene=HideAndSeek');
    const park = () =>
      page.evaluate(() => {
        const s = window.__froggy.game().scene.getScene('HideAndSeek');
        s.props.length = 0;
        s.over = false;
        s.hidden = true; // he must never actually reach them mid-sample
        s.player.x = 300;
        s.player.y = 40;
        s.froggy.x = 20;
        s.froggy.y = 165;
      });
    const measure = async (mode) => {
      await park();
      await page.evaluate((m) => {
        const s = window.__froggy.game().scene.getScene('HideAndSeek');
        s.mode = m;
        s.memory = m === 'chase' ? 60_000 : 0;
        s.lastSeen = { x: 300, y: 40 };
        s.waypoint = { x: 300, y: 40 };
      }, mode);
      const a = await hs(page);
      await sleep(700);
      const b = await hs(page);
      return Math.hypot(b.froggy.x - a.froggy.x, b.froggy.y - a.froggy.y) / 0.7;
    };
    const chaseSpeed = await measure('chase');
    const searchSpeed = await measure('search');
    check('the chase is faster than the sweep', chaseSpeed > searchSpeed * 1.4,
      `${chaseSpeed.toFixed(0)} vs ${searchSpeed.toFixed(0)} px/s`);
    await page.close();
  }

  // ------------------------------------------------------------- hiding
  console.log('\nhorror  hiding is the counterplay');
  {
    const page = await newPage('?intro=1&charity=1&key=1&route=hide&hideRoom=0&scene=HideAndSeek');
    // Stand right in his eyeline with nothing in the way, first out, then hidden.
    const seenWhileOut = await page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('HideAndSeek');
      s.props.length = 0;
      s.hidden = false;
      s.player.x = s.froggy.x + Math.cos(s.froggy.dir) * 22;
      s.player.y = s.froggy.y + Math.sin(s.froggy.dir) * 22;
      return s.sees();
    });
    await page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('HideAndSeek');
      s.mode = 'search';
      s.memory = 0;
      s.hidden = true;
      s.player.x = s.froggy.x + Math.cos(s.froggy.dir) * 22;
      s.player.y = s.froggy.y + Math.sin(s.froggy.dir) * 22;
    });
    await sleep(900);
    const modeWhileHidden = (await hs(page)).mode;
    const hiddenBlocks = { seenWhileOut, seenWhileHidden: modeWhileHidden === 'chase' };
    check('out in the open, he can see you', hiddenBlocks.seenWhileOut === true);
    check('hidden, he never acquires you', hiddenBlocks.seenWhileHidden === false, `mode ${modeWhileHidden}`);
    await page.close();
  }

  // ------------------------------------------------- surviving the minute
  console.log('\nhorror  survive the minute and the door opens');
  {
    const page = await newPage('?intro=1&charity=1&key=1&route=hide&hideRoom=2&scene=HideAndSeek');
    const start = await hs(page);
    check('the room is a full minute', start.timeLeft > 55_000, `${Math.round(start.timeLeft / 1000)}s`);

    // Run the clock down rather than waiting a real minute.
    await page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('HideAndSeek');
      s.timeLeft = 400;
      s.player.x = 30;
      s.player.y = 170;
    });
    await sleep(3200);
    const done = await page.evaluate(() => ({
      scenes: window.__froggy.activeScenes(),
      state: window.__froggy.state(),
    }));
    check('the last room hands off to the chase',
      done.state.route === 'chase' || done.scenes.includes('Chase3D'),
      `route=${done.state.route} scenes=${done.scenes.join(',')}`);
    await page.close();
  }

  if (errors.length) {
    console.log('\nRuntime errors:');
    for (const e of errors) console.log('  ' + e);
  } else {
    console.log('\nRuntime errors: none');
  }

  const total = 16;
  console.log(`\n${total - failed}/${total} checks passed.`);
  await browser.close();
  process.exit(failed > 0 || errors.length > 0 ? 1 : 0);
} catch (e) {
  console.error('HORROR FAILED:', e.message);
  for (const err of errors) console.error('  ' + err);
  await browser.close();
  process.exit(1);
}
