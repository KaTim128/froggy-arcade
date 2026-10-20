/**
 * Air hockey: the puck against the mallets.
 *
 *   node tools/hockey.mjs [--url http://localhost:5173]
 *
 * The puck used to clip into the mallets and go round them instead of coming
 * off them.  Every check here reads the game frame by frame (a trace hooked
 * on the minigame's own update), because a contact lasts one frame and a
 * poll from outside misses it.
 */

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const URL = arg('--url', 'http://localhost:5173');

const CHROME = [
  process.env.CHROME_PATH ?? '',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium',
].find((p) => p && existsSync(p));
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
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`${URL}/?intro=1&tokens=50&game=airhockey`, { waitUntil: 'networkidle2' });
await sleep(2500);
// game pixels -> screen pixels: zoom 4 on a 1280x720 page
const mouse = (x, y) => page.mouse.move(x * 4, y * 4);
await mouse(160, 150);
await page.keyboard.press('Space'); // PLAY
await sleep(4200); // the face-off count

// Every frame: the puck, its velocity and both mallets, after the update.
await page.evaluate(() => {
  window.__trace = [];
  const mg = window.__froggy.game().scene.getScene('Minigame');
  mg.events.on('postupdate', () => {
    const s = window.__hockey.state();
    if (s.puck) window.__trace.push({ p: s.puck, v: s.vel, pad: s.pad, ai: s.aiPad, r: s.padR });
  });
});
const trace = () => page.evaluate(() => window.__trace.splice(0));
const put = (x, y, vx, vy) => page.evaluate((a) => window.__hockey.setPuck(...a), [x, y, vx, vy]);
/** The first frame after the puck's velocity changed from what it was given. */
const firstHit = (t, vx, vy) => t.find((f) => Math.abs(f.v.x - vx) > 1 || Math.abs(f.v.y - vy) > 1);
const REACH = 9 + 4;
/** Between cases: the puck parked still, out of everyone's way, and the trace emptied. */
const park = async (mx, my) => {
  await put(100, 60, 0, 0);
  await mouse(mx, my);
  await sleep(200);
  await trace();
};

console.log('\nhockey  the puck comes off a mallet, it does not go into it');
{
  await park(160, 150);
  await put(160, 112, 0, 220);
  await sleep(400);
  const h = firstHit(await trace(), 0, 220);
  check('head-on into a still mallet: straight back, a little softer', h && h.v.y < -150 && h.v.y > -220 && Math.abs(h.v.x) < 5, h && `${h.v.x.toFixed(0)}, ${h.v.y.toFixed(0)}`);

  await park(160, 150);
  await put(168, 112, 0, 220);
  await sleep(400);
  const g = firstHit(await trace(), 0, 220);
  check('off-centre: glances off to that side', g && g.v.x > 60 && g.v.y < 0, g && `${g.v.x.toFixed(0)}, ${g.v.y.toFixed(0)}`);

  await park(160, 150);
  await put(160, 139, 0, -60);
  await sleep(120);
  const a = (await trace())[0];
  check('touching but already leaving: let go, untouched', a && Math.abs(a.v.y + 60) < 2 && Math.abs(a.v.x) < 2, a && `${a.v.x.toFixed(0)}, ${a.v.y.toFixed(0)}`);
}

console.log('\nhockey  a swing hits, however fast');
{
  await park(150, 165);
  await put(150, 130, 0, 0);
  await sleep(40);
  await mouse(150, 108); // one jump, far more than mallet and puck together
  await sleep(200);
  const h = firstHit(await trace(), 0, 0);
  check('a swing straight through a still puck sends it straight up the table', h && h.v.y < -300 && Math.abs(h.v.x) < 5, h && `${h.v.x.toFixed(0)}, ${h.v.y.toFixed(0)}`);
}

console.log('\nhockey  no orbiting, no sinking in');
{
  await park(160, 150);
  await put(172, 142, -25, 10);
  await sleep(1500);
  const t = await trace();
  let sweep = 0;
  for (let i = 1; i < t.length; i++) {
    const a0 = Math.atan2(t[i - 1].p.y - t[i - 1].pad.y, t[i - 1].p.x - t[i - 1].pad.x);
    const a1 = Math.atan2(t[i].p.y - t[i].pad.y, t[i].p.x - t[i].pad.x);
    let d = a1 - a0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.hypot(t[i].p.x - t[i].pad.x, t[i].p.y - t[i].pad.y) < REACH + 6) sweep += d;
  }
  check('a puck crawling into a still mallet does not go round it', Math.abs(sweep) < Math.PI / 2, `${Math.round((sweep * 180) / Math.PI)} degrees round it`);

  // A mallet walked slowly round in a circle through a slow puck: the puck
  // is pushed off it and left, not carried round on it.
  await park(160, 145);
  await put(172, 145, 0, 0);
  for (let i = 0; i <= 40; i++) {
    const k = (i / 40) * Math.PI * 2;
    await mouse(160 + Math.cos(k) * 10, 140 + Math.sin(k) * 10);
    await sleep(30);
  }
  const o = await trace();
  let run = 0;
  let longest = 0;
  for (const f of o) {
    run = Math.hypot(f.p.x - f.pad.x, f.p.y - f.pad.y) < REACH + 0.6 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  check('a mallet circling slowly through it does not carry it round', longest < 8, `longest contact ${longest} frames`);

  // A rally: the mouse sweeps across your half, the lizard plays his.
  await put(160, 60, 30, 120);
  for (let i = 0; i < 160; i++) {
    const k = i / 8;
    await mouse(160 + Math.sin(k) * 70, 150 + Math.cos(k * 1.3) * 15);
    await sleep(40);
  }
  const r = await trace();
  let gap = 99;
  let aiHits = 0;
  for (let i = 1; i < r.length; i++) {
    const f = r[i];
    gap = Math.min(gap, Math.hypot(f.p.x - f.pad.x, f.p.y - f.pad.y) - REACH, Math.hypot(f.p.x - f.ai.x, f.p.y - f.ai.y) - REACH);
    const near = Math.hypot(f.p.x - f.ai.x, f.p.y - f.ai.y) < REACH + 3;
    if (near && r[i - 1].v.y <= 0 && f.v.y > 0) aiHits++;
  }
  check('never inside either mallet, in play', gap > -1, `closest ${gap.toFixed(2)}px`);
  check('the lizard hits it back with his own swing', aiHits > 0, `${aiHits} hits`);
}

if (errors.length) {
  console.log('\nRuntime errors:');
  for (const e of errors) console.log('  ' + e);
} else console.log('\nRuntime errors: none');
await browser.close();
console.log(failed ? `\n${failed} check(s) failed.` : '\nAll hockey checks passed.');
process.exit(failed ? 1 : 0);
