/**
 * Basement acceptance test.  PRD §7.14 / AC-7.
 *
 * Walks all ten frames, screenshots each, and asserts the things that carry the
 * sequence: no forward skip under input fuzzing, the 4-second forced hold on
 * frame 9, hasKey set on frame 7, TURN AROUND readable only during flickers,
 * zero audio sources before the scare, the 3D scare, the blackout and the
 * waking in the first room.
 *
 *   node tools/basement.mjs
 */

import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync } from 'node:fs';

const URL = 'http://localhost:5173';
const SHOTS = 'tools/shots/basement';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = [
  // CI and container images keep Chrome somewhere else entirely; CHROME_PATH
  // wins, and the pinned path is what this repo's dev container ships.
  process.env.CHROME_PATH ?? '',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].find((p) => existsSync(p));

mkdirSync(SHOTS, { recursive: true });

const results = [];
const errors = [];
const check = (n, ok, d = '') => {
  results.push(ok);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`${URL}/?intro=1&charity=1&route=basement&scene=BasementSequence`, { waitUntil: 'networkidle2' });
await sleep(900);
await page.mouse.click(640, 700);
await sleep(2600);

const sources = () => page.evaluate(() => window.__froggy.audioSources());
const state = () => page.evaluate(() => window.__froggy.state());

// Hotspot screen coords (logical * 4).
// Both the stairs and the corridors are walked FORWARD now, and the arrow that
// says so sits near the vanishing point rather than out at the right edge.
const FORWARD = [640, 472];
const DOWN = FORWARD;
const RIGHT = FORWARD;
const DOOR = [640, 376];
const KEY = [640, 376];
const TURN = [640, 616];

console.log('\nAC-7  ten frames, forward-only');
await page.screenshot({ path: `${SHOTS}/f01-stairs.png` });
check('zero audio sources in the basement', (await sources()) === 0);

// --- fuzz: keyboard and off-hotspot clicks must NOT advance
await page.keyboard.press('Space');
await page.keyboard.press('Enter');
await page.keyboard.press('ArrowRight');
await page.mouse.click(200, 200);
await page.mouse.click(1100, 120);
await sleep(700);
const stillFrame1 = await page.evaluate(() => document.querySelectorAll('canvas').length > 0);
await page.screenshot({ path: `${SHOTS}/f01b-after-fuzz.png` });
check('mashing keys and empty space does not advance', stillFrame1);

const frameNow = () =>
  page.evaluate(() => window.__froggy.game().scene.getScene('BasementSequence')?.index ?? -1);

/**
 * Click a hotspot and WAIT FOR THE FRAME TO CHANGE, rather than for a number
 * of milliseconds that has to be kept in step with the walk between frames.
 *
 * The walk is sound: footsteps, then the next corridor.  It got longer, and
 * every fixed wait in here quietly became too short -- at which point the next
 * click landed inside the crossfade, was swallowed by the busy latch as it is
 * meant to be, and the sequence sat where it was while the harness reported it
 * as a broken door.  Polling tests the door; sleeping tested the stopwatch.
 */
const stepTimes = [];
let stepSlips = 0;
let patientMs = 0;
const step = async (coords, name, double = true) => {
  const was = await frameNow();
  const t = Date.now();
  await page.mouse.click(coords[0], coords[1]);
  // double-click immediately: the second must not skip a frame, though it is
  // allowed to cut the walk short -- see BasementSequence.skipWalk
  if (double) await page.mouse.click(coords[0], coords[1]);
  for (let i = 0; i < 60 && (await frameNow()) === was; i++) await sleep(100);
  const now = await frameNow();
  if (double) stepTimes.push(Date.now() - t);
  else patientMs = Date.now() - t;
  if (now !== was + 1) {
    stepSlips++;
    console.log(`  ${name}: frame ${was} -> ${now}`);
  }
  // let the crossfade finish, so the next click is not eaten by the latch
  await sleep(700);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

await step(DOWN, 'f02-corridor');
// One of them clicked ONCE and left alone, so the walk itself is timed as well
// as the way out of it.
await step(RIGHT, 'f03-corridor-longer', false);
await step(RIGHT, 'f04-chair-room');
await step(DOOR, 'f05-figure');
await page.screenshot({ path: `${SHOTS}/f05-figure-hold.png` });
await step(RIGHT, 'f06-plain-door');
await step(DOOR, 'f07-key-room');

// ---- THE DOOR ANSWERS THE CLICK.
//
// Every frame between the stairs and the key room is reached by clicking a
// hotspot and walking, and the walk must never become the only way through:
// each of those clicks has to land on the next frame, and it has to do it
// while the player is still looking at the hand they clicked with.
check('every hotspot lands on the next frame', stepSlips === 0, `${stepTimes.length} frames, ${stepSlips} that did not`);
const slowest = Math.max(...stepTimes);
check('and a second click gets there at once', slowest < 400, `slowest ${slowest}ms of ${stepTimes.join('/')}`);
// Left alone it walks, and the walk is a walk rather than a wait: long enough
// for the footsteps to land and finish, short enough not to be sat through.
check('one click walks it, and not for long', patientMs > 350 && patientMs < 2000, `${patientMs}ms`);

const beforeKey = await state();
check('hasKey false before pickup', beforeKey.hasKey === false);

await page.mouse.click(KEY[0], KEY[1]);
for (let i = 0; i < 40 && !(await state()).hasKey; i++) await sleep(100);
const afterKey = await state();
check('hasKey set on pickup', afterKey.hasKey === true);

// --- frame 8: TURN AROUND only inside the flicker
await sleep(300);
await page.screenshot({ path: `${SHOTS}/f08a-flicker-dark.png` });
await sleep(200);
await page.screenshot({ path: `${SHOTS}/f08b-flicker-lit.png` });
await sleep(1600);
await page.screenshot({ path: `${SHOTS}/f08c-after-flicker.png` });

// --- frame 9: the forced hold
const t0 = Date.now();
await page.mouse.click(TURN[0], TURN[1]);
await sleep(900);
await page.screenshot({ path: `${SHOTS}/f09-reverse-nothing.png` });

// From the turn onward the sequence runs itself.  Hammer input the whole way
// and time it: he stands there, he opens, and it lands on the way-out frame.
// Timing this from the click avoids racing the crossfades either side of it.
const overlayPixels = () =>
  page.evaluate(() => {
    const c = document.getElementById('froggy-layer');
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return { n, total: c.width * c.height };
  });
const frameIndex = () =>
  page.evaluate(() => window.__froggy.game().scene.getScene('BasementSequence').index);

let sawStare = false;
let saw3D = false;
let held = 0;
for (let i = 0; i < 400; i++) {
  await page.mouse.click(640, 360);
  await page.keyboard.press('Space');
  await sleep(100);
  const f = await frameIndex();
  if (f === 8) sawStare = true;
  if (f === 9 && !saw3D && (await page.evaluate(() => !!document.getElementById('three-canvas')))) {
    saw3D = true;
    await page.screenshot({ path: `${SHOTS}/f09-jumpscare-3d.png` });
  }
  if (f === 10) {
    held = Date.now() - t0;
    break;
  }
}
check('the beat cannot be hammered through', sawStare && held >= 3000, `${held}ms, stare seen: ${sawStare}`);
check('the scare is the 3D creature, on a stage of its own', saw3D);

// And then black: nothing drawn, nothing on the 3D stage, for four seconds,
// before you come round in the first room.
await sleep(600);
await page.screenshot({ path: `${SHOTS}/f10-black.png` });
check('the blackout is black', (await overlayPixels()).n === 0 &&
  !(await page.evaluate(() => !!document.getElementById('three-canvas'))));
let woke = 0;
const tb = Date.now();
while (Date.now() - tb < 15000) {
  await sleep(200);
  const on = await page.evaluate(() => window.__froggy.activeScenes().includes('HideRoom3D'));
  if (on) {
    woke = Date.now() - tb + 600;
    break;
  }
}
check('about four seconds of it', woke >= 3000 && woke <= 9000, `${woke}ms`);
const wake = await page.evaluate(() => {
  const h = window.__froggy.game().scene.getScene('HideRoom3D');
  return { waking: h.waking, sub: window.__hide?.subtitle ?? '', state: window.__froggy.state() };
});
check('you come round in the first room, and he is there', wake.waking && wake.state.route === 'hide' && wake.state.hideRoom === 0,
  `waking=${wake.waking} route=${wake.state.route} room=${wake.state.hideRoom}`);
check('he says nothing until you can see', wake.sub === '', `"${wake.sub}"`);

console.log('\nRuntime errors: ' + (errors.length ? errors.slice(0, 4).join(' | ') : 'none'));
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
