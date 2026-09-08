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
    check('the door leads on to the rooms', after.scenes.includes('HideRoom3D'), after.scenes.join(','));
    check('the route commits to hide', after.state.route === 'hide' && after.state.hideRoom === 0,
      `route=${after.state.route} room=${after.state.hideRoom}`);
    await page.close();
  }

  // --------------------------------------------------------------- the room
  console.log('\nhorror  the room he locks you in');
  {
    const page = await newPage('?intro=1&charity=1&key=1&route=hide&hideRoom=0&scene=HideRoom3D');
    const hide = () => page.evaluate(() => window.__hide ?? null);

    const intro = await hide();
    check('the room runs its lock-in first', intro && intro.mode === 'intro', intro?.mode);

    // Sit through the intro rather than skipping it: it is the beat.
    await sleep(11000);
    let s = await hide();
    check('it hands over to play', s.mode === 'play', s.mode);
    check('there is cover to hide in', s.chests.length >= 5, `${s.chests.length} chests`);
    check('the key is somewhere in the room', Number.isFinite(s.keyX) && !s.hasKey);
    check('he is not standing inside the furniture', !s.dbg.froggyBlocked);
    await page.screenshot({ path: `${SHOTS}/room1.png` });

    // He has to actually patrol.  Sampled over a long window on purpose: he
    // legitimately stands still to listen for up to two and a half seconds, so
    // a short sample can catch him mid-pause and prove nothing.
    let travelled = 0;
    let prev = { x: s.fx, z: s.fz };
    for (let i = 0; i < 10; i++) {
      await sleep(800);
      s = await hide();
      travelled += Math.hypot(s.fx - prev.x, s.fz - prev.z);
      prev = { x: s.fx, z: s.fz };
    }
    check('he searches the room on his own', travelled > 3, `covered ${travelled.toFixed(1)}m in 8s`);

    // Hiding, and what hiding costs.
    await page.evaluate(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      sc.pos.set(sc.chests[0].x, sc.chests[0].z);
      sc.froggy.set(sc.chests[0].x, sc.chests[0].z + 5);
    });
    await sleep(300);
    await page.keyboard.press('KeyE');
    await sleep(600);
    s = await hide();
    check('E hides you in a chest', s.hiding === true);
    await page.screenshot({ path: `${SHOTS}/room1-peephole.png` });

    // Clear whatever he was doing first: repositioning the player above can
    // legitimately have put him in a chase, and his memory of it outlasts the
    // check.  Then stand him right in front of the chest and stare.
    const hiddenSeen = await page.evaluate(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      sc.fMode = 'search';
      sc.memory = 0;
      sc.froggy.set(sc.pos.x, sc.pos.y + 2);
      sc.froggyYaw = Math.atan2(sc.pos.x - sc.froggy.x, sc.pos.y - sc.froggy.y);
      return { hidden: sc.hiding !== null };
    });
    await sleep(900);
    s = await hide();
    check('hidden, he does not acquire you', hiddenSeen.hidden && s.froggyMode !== 'chase',
      `mode ${s.froggyMode}`);

    // The exit: key, then door.
    await page.evaluate(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      sc.hiding = null;
      sc.pos.set(sc.keyAt.x, sc.keyAt.y);
    });
    await sleep(300);
    await page.keyboard.press('KeyE');
    await sleep(500);
    check('the key can be picked up', (await hide()).hasKey === true);

    await page.evaluate(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      sc.pos.set(sc.def.door.x, sc.def.halfD - 1);
    });
    await sleep(300);
    await page.keyboard.press('KeyE');
    await sleep(2600);
    const room = await page.evaluate(() => window.__froggy.state().hideRoom);
    check('the door opens on to the next room', room === 1, `room ${room}`);
    await page.close();
  }

  // ------------------------------------------------------ he is always slower
  console.log('\nhorror  he is exactly half your running speed');
  {
    const page = await newPage('?intro=1&charity=1&key=1&route=hide&hideRoom=0&scene=HideRoom3D');
    await sleep(11000);
    const s = await page.evaluate(() => window.__hide);
    check('the chase speed is half the run, by construction',
      Math.abs(s.froggyChase - s.playerRun / 2) < 1e-6,
      `${s.froggyChase} vs ${s.playerRun}`);
    await page.close();
  }

  if (errors.length) {
    console.log('\nRuntime errors:');
    for (const e of errors) console.log('  ' + e);
  } else {
    console.log('\nRuntime errors: none');
  }

  const total = 19;
  console.log(`\n${total - failed}/${total} checks passed.`);
  await browser.close();
  process.exit(failed > 0 || errors.length > 0 ? 1 : 0);
} catch (e) {
  console.error('HORROR FAILED:', e.message);
  for (const err of errors) console.error('  ' + err);
  await browser.close();
  process.exit(1);
}
