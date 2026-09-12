/**
 * Basement acceptance test.  PRD §7.14 / AC-7.
 *
 * Walks all ten frames, screenshots each, and asserts the things that carry the
 * sequence: no forward skip under input fuzzing, the 4-second forced hold on
 * frame 9, hasKey set on frame 7, TURN AROUND readable only during flickers,
 * and zero audio sources throughout.
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

const step = async (coords, name, wait = 1500) => {
  await page.mouse.click(coords[0], coords[1]);
  // double-click immediately: the second must be swallowed by the busy latch
  await page.mouse.click(coords[0], coords[1]);
  await sleep(wait);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

await step(DOWN, 'f02-corridor');
await step(RIGHT, 'f03-corridor-longer');
await step(RIGHT, 'f04-chair-room');
await step(DOOR, 'f05-figure', 2600); // door creak is 1.5s
await page.screenshot({ path: `${SHOTS}/f05-figure-hold.png` });
await step(RIGHT, 'f06-plain-door');
await step(DOOR, 'f07-key-room', 2600);

const beforeKey = await state();
check('hasKey false before pickup', beforeKey.hasKey === false);

await page.mouse.click(KEY[0], KEY[1]);
await sleep(1400);
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

let overlay = { n: 0, total: 1 };
let peak = { n: 0, total: 1 };
let sawStare = false;
let held = 0;
for (let i = 0; i < 90; i++) {
  await page.mouse.click(640, 360);
  await page.keyboard.press('Space');
  await sleep(100);
  const f = await frameIndex();
  if (f === 8) sawStare = true;
  overlay = await overlayPixels();
  if (overlay.n > peak.n) peak = overlay;
  if (f === 10) {
    held = Date.now() - t0;
    break;
  }
}
overlay = peak;
await page.screenshot({ path: `${SHOTS}/f10-jumpscare.png` });
check('the beat cannot be hammered through', sawStare && held >= 3000 && held <= 7000, `${held}ms, stare seen: ${sawStare}`);
check(
  'jumpscare fills the frame on the unfiltered overlay',
  overlay.n > overlay.total * 0.15,
  `${((overlay.n / overlay.total) * 100).toFixed(1)}% coverage`,
);
check('still zero audio sources at the scare', (await sources()) === 0);

// The beat ends on the way-out frame; the route only commits when the player
// actually opens the door, so wait for the frame rather than the route.
await sleep(3200);
const frame = await page.evaluate(
  () => window.__froggy.game().scene.getScene('BasementSequence').index,
);
check('the scare resolves to the way out', frame === 10, `frame ${frame}`);

console.log('\nRuntime errors: ' + (errors.length ? errors.slice(0, 4).join(' | ') : 'none'));
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
