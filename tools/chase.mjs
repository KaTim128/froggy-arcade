/**
 * Chase acceptance test.  PRD §7.15 / AC-8.
 *
 * Asserts the rules the chase rests on: Froggy's speed is EXACTLY half the
 * player's and never changes, he never stops, standing still is lethal, and
 * running gains ground on him — which is what makes the level about navigation
 * rather than speed.
 *
 *   node tools/chase.mjs
 */

import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync } from 'node:fs';

const URL = 'http://localhost:5173';
const SHOTS = 'tools/shots/chase';
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

const open = async () => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon/i.test(t)) errors.push(t);
    if (t.startsWith('[chase]')) console.log('   ' + t);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${URL}/?intro=1&charity=1&key=1&route=chase&scene=Chase3D`, { waitUntil: 'networkidle2' });
  await sleep(1000);
  await page.mouse.click(640, 700);
  await sleep(900);
  return page;
};

const tele = (p) => p.evaluate(() => window.__chase ?? null);

// ------------------------------------------------------ level + speed contract
console.log('\nAC-8  the chase');
{
  const page = await open();
  await page.screenshot({ path: `${SHOTS}/01-corridor.png` });

  const t = await tele(page);
  check('chase is running', t !== null);
  check('Froggy speed is exactly half the player', t && t.froggySpeed === t.playerSpeed * 0.5,
    t ? `${t.froggySpeed} vs ${t.playerSpeed}` : '');

  const seconds = t ? t.optimalRoute / t.playerSpeed : 999;
  check('optimal route runs under 90s', seconds <= 90, `${t?.optimalRoute}m ≈ ${seconds.toFixed(0)}s`);

  // ---- he never stops, and he closes on a player who does nothing
  // He reaches a motionless player in roughly four and a half seconds, so the
  // window for watching him approach is short by design.
  const samples = [];
  for (let i = 0; i < 8; i++) {
    const t = await tele(page);
    if (t?.over) break;
    samples.push(t);
    await sleep(250);
  }
  const moved = samples.slice(1).every((s, i) => Math.hypot(s.fx - samples[i].fx, s.fz - samples[i].fz) > 0.05);
  check('he never stops moving', moved);

  const closed = samples[samples.length - 1].dist < samples[0].dist;
  check('standing still lets him close', closed,
    `${samples[0].dist.toFixed(1)}m -> ${samples[samples.length - 1].dist.toFixed(1)}m`);

  // Measure against the scene's OWN clock, not the sleep between polls.  Under
  // load the render loop advances far less than wall time — 100ms of game time
  // across a 353ms sleep — so dividing by either the nominal 250ms or the real
  // elapsed wall time makes this read wrong in opposite directions.  His speed
  // is a property of the simulation, so the simulation's clock is what measures it.
  const speeds = samples
    .slice(1)
    .map((s, i) => Math.hypot(s.fx - samples[i].fx, s.fz - samples[i].fz) / ((s.elapsed - samples[i].elapsed) / 1000));
  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  check('measured speed matches 2.0 m/s', Math.abs(avg - 2.0) < 0.35, `${avg.toFixed(2)} m/s`);

  await page.close();
}

// -------------------------------------------------------- lethal to a lost one
console.log('\n  lethality');
{
  const page = await open();
  // Do nothing at all.  He is 8m back at 2 m/s, so this takes about four seconds.
  let caught = false;
  const t0 = Date.now();
  for (let i = 0; i < 40; i++) {
    const t = await tele(page);
    if (t?.over) {
      caught = true;
      break;
    }
    await sleep(250);
  }
  await sleep(1200);
  await page.screenshot({ path: `${SHOTS}/02-death.png` });
  check('standing still is lethal', caught, `${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // Poll rather than sleep a fixed spell.  The reset lands about two seconds
  // after the scare, and four seconds after THAT the death card hands over to
  // Boot — which re-applies this page's own `?route=chase` deep link and puts
  // the route straight back.  A fixed wait that drifts past that window reads
  // the re-applied route and calls a working reset a failure.
  let st = null;
  for (let i = 0; i < 24; i++) {
    await sleep(250);
    st = await page.evaluate(() => window.__froggy.state());
    if (st.route === 'normal' && st.tokens === 0) break;
  }
  check('death resets the run', st.route === 'normal' && st.tokens === 0,
    `route=${st.route}, ${st.tokens} tokens`);
  await page.close();
}

// ----------------------------------------------------- running gains you ground
console.log('\n  escapable by a competent player');
{
  const page = await open();
  const before = await tele(page);
  await page.keyboard.down('KeyW');
  await sleep(2500);
  await page.keyboard.up('KeyW');
  const after = await tele(page);
  await page.screenshot({ path: `${SHOTS}/03-running.png` });

  const gained = after.dist > before.dist;
  check('running opens the gap', gained, `${before.dist.toFixed(1)}m -> ${after.dist.toFixed(1)}m`);
  check('he stays out of the flashlight', after.inConePct < 20, `${after.inConePct.toFixed(0)}% lit`);
  await page.close();
}

console.log('\nRuntime errors: ' + (errors.length ? errors.slice(0, 4).join(' | ') : 'none'));
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
