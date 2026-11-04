/**
 * The Wheel of Fortune's rules (minigames/wheel.ts): the house edge with the
 * RE and +2 faces counted in, the bonus spin odds, a respin and a bonus run
 * played out on the wheel and paid once, and a run cut off by a reload paid
 * once, as drawn, on the way back in.
 *
 *   node tools/wheel.mjs [--url http://localhost:5173]
 */

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const URL = arg('--url', 'http://localhost:5173');
const CHROME = [process.env.CHROME_PATH ?? '', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
let ran = 0;
const check = (name, ok, note = '') => {
  ran++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  — ${note}` : ''}`);
  if (!ok) failed++;
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
page.on('pageerror', (e) => errors.push(e.message));

const W = (fn, ...a) => page.evaluate((fn, a) => new Function('w', 'a', fn)(window.__wheel, a), fn, a);
const tokens = () => page.evaluate(() => window.__froggy.state().tokens);
const open = async () => {
  await page.goto(`${URL}/?intro=1&tokens=2000&game=wheel`, { waitUntil: 'load' });
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => {
      const m = window.__froggy?.game().scene.getScene('Minigame');
      return { card: !!m && !!m.card && !m.started, bridge: !!window.__wheel };
    });
    if (s.bridge && !s.card) break;
    if (s.card) await page.keyboard.press('Space');
    await sleep(400);
  }
  await sleep(300);
};
const settle = async () => {
  for (let i = 0; i < 80; i++) {
    await sleep(400);
    if (await W('const s = w.state(); return !s.spinning && !s.book.pending')) return true;
  }
  return false;
};

try {
  await open();
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('froggy.wheel.')).forEach((k) => localStorage.removeItem(k)));

  // ---- the numbers
  const N = 300000;
  const odds = await page.evaluate(async (n) => {
    const { FACES, spinCost, RESPIN, BONUS } = await import('/src/minigames/wheel.ts');
    const share = (v) => FACES.filter((f) => f.pays === v).reduce((a, f) => a + f.share, 0);
    const total = FACES.reduce((a, f) => a + f.share, 0);
    const b = window.__wheel.sampleBonus(n);
    let small = 0;
    let mid = 0;
    let other = 0;
    for (const [k, v] of Object.entries(b)) {
      const p = Number(k);
      if (p > 0 && p < 25) small += v;
      else if (p >= 40 && p <= 70) mid += v;
      else other += v;
    }
    const runs = window.__wheel.sampleRuns(n);
    const e = window.__wheel.ease;
    let smooth = true;
    let prev = 0;
    let prevV = 0;
    for (let i = 1; i <= 200; i++) {
      const v = e(i / 200) - prev;
      if (v < -1e-9 || (i > 2 && Math.abs(v - prevV) > 0.01)) smooth = false;
      prev = e(i / 200);
      prevV = v;
    }
    return { cost: spinCost(), total, re: share(RESPIN), plus: share(BONUS), small: small / n, mid: mid / n, other, ev: runs.paid / n, respins: runs.respins / n, bonus: runs.bonus / n, smooth };
  }, N);
  check('the faces make a whole wheel', Math.abs(odds.total - 100) < 1e-6, `${odds.total.toFixed(4)}%`);
  check('RE and +2 are faces on the wheel', odds.re === 4 && odds.plus === 4);
  check('a spin pays less than it costs on average, respins and bonus spins counted', odds.ev < odds.cost, `${odds.ev.toFixed(2)} back per ${odds.cost}: house keeps ${(((odds.cost - odds.ev) / odds.cost) * 100).toFixed(1)}%`);
  check('respins and bonus spins come up as the wheel says', Math.abs(odds.respins - 0.0417) < 0.003 && Math.abs(odds.bonus - 2 * 0.0417) < 0.004, `respins ${odds.respins.toFixed(4)}/spin, bonus ${odds.bonus.toFixed(4)}/spin`);
  check('bonus spins: 85% under 25', Math.abs(odds.small - 0.85) < 0.005, `${(odds.small * 100).toFixed(2)}%`);
  check('bonus spins: 15% from 40-70', Math.abs(odds.mid - 0.15) < 0.005, `${(odds.mid * 100).toFixed(2)}%`);
  check('bonus spins: nothing else ever', odds.other === 0);
  check('the spin speeds up and slows down smoothly', odds.smooth);

  const face = await page.evaluate(async () => {
    const { FACES, RESPIN, BONUS } = await import('/src/minigames/wheel.ts');
    const ix = (v) => FACES.findIndex((f) => f.pays === v);
    return { re: ix(RESPIN), plus: ix(BONUS), p10: ix(10), p50: ix(50), p3: ix(3), p0: ix(0), p7: ix(7) };
  });

  // ---- a plain paid spin
  let t0 = await tokens();
  await W('w.force(a[0])', [{ kind: 'paid', face: face.p50 }]);
  await page.keyboard.press('Space');
  await sleep(200);
  let st = await W('return w.state()');
  check('the run is written down before the wheel moves', st.spinning && st.book.pending?.steps.length === 1);
  await settle();
  st = await W('return w.state()');
  check('it stops on the face it drew and pays it once', st.at === 50 && (await tokens()) === t0 - odds.cost + 50, `${t0} -> ${await tokens()}`);

  // ---- RE: it goes round again, free, and that one stands
  await sleep(1000);
  t0 = await tokens();
  await W('w.force(a[0])', [{ kind: 'paid', face: face.re }, { kind: 'respin', face: face.p10 }]);
  await page.keyboard.press('Space');
  await settle();
  st = await W('return w.state()');
  check('landing RE spins again for free and pays the second stop', st.at === 10 && (await tokens()) === t0 - odds.cost + 10, `${t0} -> ${await tokens()}`);

  // ---- +2: two bonus spins on the wheel
  await sleep(1000);
  t0 = await tokens();
  await W('w.force(a[0])', [{ kind: 'paid', face: face.plus }, { kind: 'bonus', face: face.p3 }, { kind: 'bonus', face: face.p50 }]);
  await page.keyboard.press('Space');
  await settle();
  st = await W('return w.state()');
  const last = st.book.log.slice(-1)[0];
  check('landing +2 plays two bonus spins and pays both', (await tokens()) === t0 - odds.cost + 53 && last.steps === 3 && last.pays === 53, `${t0} -> ${await tokens()}`);

  // ---- no new spin while a run is going
  await sleep(1000);
  t0 = await tokens();
  await W('w.force(a[0])', [{ kind: 'paid', face: face.plus }, { kind: 'bonus', face: face.p7 }, { kind: 'bonus', face: face.p7 }]);
  await page.keyboard.press('Space');
  await sleep(1500);
  await page.keyboard.press('Space');
  await sleep(200);
  check('SPACE mid-run buys nothing', (await tokens()) === t0 - odds.cost);

  // ---- a reload mid-run: no refund, no re-roll, the rest paid once on the way back in
  const before = await W('return w.state().book');
  const left = before.pending.steps.length - before.pending.next;
  await open();
  await sleep(800);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((x) => x.startsWith('froggy.wheel.')))));
  check('a run cut off by a reload is paid once, as drawn', !after.pending && after.log.length === before.log.length + 1 && after.log.slice(-1)[0].pays === 14, `${left} step(s) left; logged ${after.log.slice(-1)[0]?.pays}`);
  await open();
  const again = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((x) => x.startsWith('froggy.wheel.')))).log.length);
  check('and never a second time', again === after.log.length);

  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('froggy.wheel.')).forEach((k) => localStorage.removeItem(k)));
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
console.log(`\n${ran - failed}/${ran} passed`);
process.exit(failed ? 1 : 0);
