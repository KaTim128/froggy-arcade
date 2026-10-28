/**
 * A cabinet with a practice go (Grudge): its screen has PRACTICE beside
 * PLAY - 10 TOKENS; out of a practice go is back to that screen, nothing
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
  // the first go opens on HOW TO PLAY: BACK to the machine, nothing taken
  await page.mouse.click((160 - 90) * k, 163 * k);
  await sleep(800);
  let m = await M();
  const labels = await page.evaluate(() =>
    window.__froggy.game().scene.getScene('Minigame').children.list.filter((o) => o.list && o.input).map((o) => o.list[1]?.text),
  );
  check('the screen has PRACTICE beside PLAY - 10 TOKENS, nothing taken', m.card && !m.started && m.tokens === 50 && labels.includes('PRACTICE') && labels.includes('PLAY - 10 TOKENS'), labels.join('|'));
  // PRACTICE
  // (PRACTICE, wherever the machine screen has put it)
  const prac = await page.evaluate(() => {
    const c = window.__froggy.game().scene.getScene('Minigame').children.list.find((o) => o.list && o.input && o.list[1]?.text === 'PRACTICE');
    return c ? { x: c.x, y: c.y } : { x: 0, y: 0 };
  });
  await page.mouse.click(prac.x * k, prac.y * k);
  m = await until((x) => x.started);
  check('PRACTICE starts a free go', m.started && m.practicing && m.tokens === 50, JSON.stringify(m));
  // Froggy walks right past the bag to its other side, and turns to face it
  await sleep(900);
  const x0 = await page.evaluate(() => window.__grudge.state().you);
  await page.keyboard.down('d');
  await sleep(2600);
  await page.keyboard.up('d');
  await sleep(300);
  const x1 = await page.evaluate(() => window.__grudge.state().you);
  check('Froggy can walk past the bag to its other side', x0.x < 160 && x1.x > 160 + 20 && x1.facing === -1, JSON.stringify({ x0, x1 }));
  // out of it through the pause menu: a practice go says LEAVE, not QUIT GAME
  await page.keyboard.press('Escape');
  await sleep(900);
  const words = await page.evaluate(() => {
    const s = window.__froggy.game().scene.getScene('SettingsModal');
    const out = [];
    const walk = (o) => {
      if (o.text) out.push(o.text);
      (o.list ?? []).forEach(walk);
    };
    (s?.children?.list ?? []).forEach(walk);
    return out;
  });
  check('in a practice go the pause menu says LEAVE, not QUIT GAME', words.includes('LEAVE') && !words.includes('QUIT GAME'), words.filter((w) => /LEAVE|QUIT|RESUME/.test(w)).join(', '));
  await page.mouse.click(122 * k, 158 * k);
  await sleep(1500);
  m = await until((x) => x.scenes.includes('Minigame') && x.card && !x.started);
  check('leaving practice comes back to the screen, nothing taken', m.card && !m.started && m.tokens === 50 && m.scenes.includes('Minigame'), JSON.stringify(m));
  // PLAY for real
  await sleep(600);
  const playAt = await page.evaluate(() => {
    const c = window.__froggy.game().scene.getScene('Minigame').children.list.find((o) => o.list && o.input && /^PLAY - /.test(o.list[1]?.text ?? ''));
    return c ? { x: c.x, y: c.y } : { x: 0, y: 0 };
  });
  await page.mouse.click(playAt.x * k, playAt.y * k);
  m = await until((x) => x.started);
  check('PLAY - 10 TOKENS takes the tokens and starts the real fight', m.started && !m.practicing && m.tokens === 40, JSON.stringify(m));
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
