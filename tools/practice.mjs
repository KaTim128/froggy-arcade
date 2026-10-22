/**
 * A cabinet with a practice go (Grudge): PLAY on the card opens the choice
 * of PLAY or PRACTICE; out of a practice go is back to that choice, nothing
 * taken; PLAY takes the tokens, and quitting a real go forfeits them.
 *
 *   node tools/practice.mjs [--url http://localhost:5173]
 */

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const URL = arg('--url', 'http://localhost:5173');
const CHROME = [process.env.CHROME_PATH ?? '', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
if (!CHROME) {
  console.error('No Chrome found.');
  process.exit(2);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
let ran = 0;
const errors = [];
const check = (name, ok, note = '') => {
  ran++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  — ${note}` : ''}`);
  if (!ok) failed++;
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540 });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${URL}/?intro=1&charity=1&key=1&scene=ArcadeAnnex&tokens=50`, { waitUntil: 'networkidle2' });
  await sleep(3000);
  const k = 960 / 320;
  const M = () =>
    page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('Minigame');
      return { scenes: window.__froggy.activeScenes(), started: s.started, practicing: s.practicing, card: !!s.card, tokens: window.__froggy.state().tokens };
    });
  const until = async (ok, ms = 15000) => {
    const t0 = Date.now();
    let m = await M();
    while (!ok(m) && Date.now() - t0 < ms) {
      await sleep(250);
      m = await M();
    }
    return m;
  };
  await page.evaluate(() => {
    const g = window.__froggy.game();
    for (const s of g.scene.getScenes(true)) s.scene.stop();
    g.scene.start('Minigame', { id: 'grudge', from: 'ArcadeAnnex' });
  });
  await until((m) => m.scenes.includes('Minigame') && m.card);
  await sleep(800);
  // PLAY on the card: nothing taken yet, the choice is up
  await page.mouse.click(107 * k, 164 * k);
  await sleep(800);
  let m = await M();
  check('PLAY on the card takes nothing and opens the choice', m.card && !m.started && m.tokens === 50, JSON.stringify(m));
  // PRACTICE
  await page.mouse.click((160 + 56) * k, 84 * k);
  m = await until((x) => x.started);
  check('PRACTICE starts a free go', m.started && m.practicing && m.tokens === 50, JSON.stringify(m));
  // out of it, as the pause menu's QUIT GAME does
  await page.evaluate(() => window.__froggy.game().scene.getScene('Minigame').quitGame());
  await sleep(1500);
  m = await until((x) => x.scenes.includes('Minigame') && x.card && !x.started);
  check('leaving practice comes back to the choice, nothing taken', m.card && !m.started && m.tokens === 50 && m.scenes.includes('Minigame'), JSON.stringify(m));
  // PLAY for real
  await sleep(600);
  await page.mouse.click((160 - 56) * k, 84 * k);
  m = await until((x) => x.started);
  check('PLAY on the choice takes the tokens and starts the real fight', m.started && !m.practicing && m.tokens === 40, JSON.stringify(m));
  await page.evaluate(() => window.__froggy.game().scene.getScene('Minigame').quitGame());
  await sleep(800);
  const forfeit = await page.evaluate(() => {
    const s = window.__froggy.game().scene.getScene('Minigame');
    return s.children.list.map((o) => o.text ?? '').join(' | ');
  });
  check('quitting the real fight is a forfeit, the tokens kept', /FORFEIT/.test(forfeit), forfeit.slice(0, 120));
  m = await until((x) => x.scenes.includes('ArcadeAnnex'));
  check('and back out to the room, the tokens gone', m.scenes.includes('ArcadeAnnex') && m.tokens === 40, JSON.stringify(m));
} catch (e) {
  console.error(e);
  failed++;
} finally {
  await browser.close();
}
if (errors.length) console.log('page errors:', errors.slice(0, 5).join('; '));
console.log(`\n${ran - failed}/${ran} passed`);
process.exit(failed || errors.length ? 1 : 0);
