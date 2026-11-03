/**
 * The Wheel of Fortune's rules (minigames/wheel.ts): the house edge, the bonus
 * spin odds, the day's respin and bonus spins, a result held for respin, and a
 * spin cut off by a reload paid once, as drawn, on the way back in.
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
const spinWait = () => sleep(6600);

try {
  await open();
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('froggy.wheel.')).forEach((k) => localStorage.removeItem(k)));

  // ---- the numbers
  const N = 300000;
  const odds = await page.evaluate(async (n) => {
    const { FACES, spinCost } = await import('/src/minigames/wheel.ts');
    const ev = FACES.reduce((a, f) => a + (f.pays * f.share) / 100, 0);
    const b = window.__wheel.sampleBonus(n);
    let small = 0;
    let mid = 0;
    let other = 0;
    let sum = 0;
    for (const [k, v] of Object.entries(b)) {
      const p = Number(k);
      sum += p * v;
      if (p > 0 && p < 25) small += v;
      else if (p >= 40 && p <= 70) mid += v;
      else other += v;
    }
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
    return { cost: spinCost(), ev, small: small / n, mid: mid / n, other, bonusEv: sum / n, smooth, ends: [e(0), e(1)] };
  }, N);
  check('a spin costs more than it pays on average (house edge)', odds.ev < odds.cost, `pays ${odds.ev.toFixed(2)} a spin for ${odds.cost}: house keeps ${(((odds.cost - odds.ev) / odds.cost) * 100).toFixed(1)}%`);
  check('bonus spins: 85% under 25', Math.abs(odds.small - 0.85) < 0.005, `${(odds.small * 100).toFixed(2)}%`);
  check('bonus spins: 15% from 40-70', Math.abs(odds.mid - 0.15) < 0.005, `${(odds.mid * 100).toFixed(2)}%`);
  check('bonus spins: nothing else ever', odds.other === 0);
  check('the spin speeds up and slows down smoothly', odds.smooth && odds.ends[0] === 0 && odds.ends[1] === 1);

  // ---- the day's allowance, before a paid spin
  let st = await W('return w.state()');
  check('a new day: one respin and two bonus spins', st.book.respins === 1 && st.book.bonus === 2, JSON.stringify(st.book));
  await W('w.bonus()');
  await sleep(300);
  st = await W('return w.state()');
  check('bonus spins wait for the first paid spin of the day', !st.spinning && st.book.bonus === 2);
  await W('w.respin()');
  st = await W('return w.state()');
  check('there is nothing to respin before a paid spin', !st.spinning && st.book.respins === 1);

  // ---- a paid spin: held for collect or respin
  const t0 = await page.evaluate(() => window.__froggy.state().tokens);
  await page.keyboard.press('Space');
  await sleep(200);
  st = await W('return w.state()');
  check('the result is written down before the wheel stops', st.spinning && st.book.pending && st.book.pending.kind === 'paid');
  const drawn = st.book.pending.pays;
  await spinWait();
  st = await W('return w.state()');
  check('it stops on the result it drew', st.at === drawn, `drew ${drawn}, on ${st.at}`);
  check('a paid result is held while the respin is unused', st.holding === drawn);
  const t1 = await page.evaluate(() => window.__froggy.state().tokens);
  check('held: the price is gone, nothing paid yet', t1 === t0 - odds.cost, `${t0} -> ${t1}`);
  await page.keyboard.press('Space'); // the bonus button would be refused while holding, so try SPACE twice
  await sleep(200);
  st = await W('return w.state()');
  const t2 = await page.evaluate(() => window.__froggy.state().tokens);
  check('COLLECT pays the held result once', t2 === t1 + drawn && st.holding === null && !st.book.pending, `${t1} -> ${t2}`);

  // ---- the respin
  await sleep(1000);
  await page.keyboard.press('Space');
  await spinWait();
  const held = (await W('return w.state()')).holding;
  const t3 = await page.evaluate(() => window.__froggy.state().tokens);
  await page.keyboard.press('KeyR');
  await sleep(200);
  st = await W('return w.state()');
  check('RESPIN throws the result away and spins free', st.spinning && st.book.respins === 0 && st.book.pending?.kind === 'respin', `threw away ${held}`);
  const re = st.book.pending.pays;
  await spinWait();
  st = await W('return w.state()');
  const t4 = await page.evaluate(() => window.__froggy.state().tokens);
  check('the respin result stands and is paid at once', st.holding === null && t4 === t3 + re && !st.book.pending, `${t3} -> ${t4}, respin ${re}`);
  await sleep(1000);
  await page.keyboard.press('Space');
  await spinWait();
  st = await W('return w.state()');
  check('with the respin spent, a paid spin pays straight away', st.holding === null && !st.book.pending);

  // ---- the bonus spins
  for (let i = 0; i < 2; i++) {
    await sleep(1000);
    await page.keyboard.press('KeyF');
    await sleep(200);
    st = await W('return w.state()');
    check(`bonus spin ${i + 1} goes`, st.spinning && st.book.pending?.kind === 'bonus');
    await spinWait();
  }
  await sleep(1000);
  await page.keyboard.press('KeyF');
  await sleep(200);
  st = await W('return w.state()');
  check('no third bonus spin today', !st.spinning && st.book.bonus === 0);

  // ---- the clock wound back gives nothing back
  await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('froggy.wheel.'));
    const b = JSON.parse(localStorage.getItem(k));
    b.day = '1999-1-1'; // a "new day" ... that is before the last use
    b.seen = Date.now() + 86400e3 * 30;
    localStorage.setItem(k, JSON.stringify(b));
  });
  st = await W('return w.state()');
  check('a new date with the clock behind the last use does not reset', st.book.bonus === 0 && st.book.respins === 0);
  await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('froggy.wheel.'));
    const b = JSON.parse(localStorage.getItem(k));
    b.day = '1999-1-1';
    b.seen = Date.now() - 1000;
    localStorage.setItem(k, JSON.stringify(b));
  });
  st = await W('return w.state()');
  check('a real new day resets the allowance', st.book.bonus === 2 && st.book.respins === 1);

  // ---- a reload mid-spin: no refund, no re-roll, paid once on the way back in
  await sleep(1000);
  await page.keyboard.press('Space');
  await sleep(1500);
  st = await W('return w.state()');
  const cut = st.book.pending;
  const logLen = st.book.log.length;
  await open();
  // (a resumed go stops on the pause menu: RESUME)
  for (let i = 0; i < 6; i++) {
    const pend = await page.evaluate(() => {
      const k = Object.keys(localStorage).find((x) => x.startsWith('froggy.wheel.'));
      return JSON.parse(localStorage.getItem(k)).pending;
    });
    if (!pend) break;
    await page.keyboard.press('Escape');
    await sleep(600);
  }
  await sleep(500);
  const after = await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('froggy.wheel.'));
    return JSON.parse(localStorage.getItem(k));
  });
  const paidOnce = after.log.filter((e) => e.pays === cut.pays && e.cost === cut.cost).length >= 1 && after.log.length === logLen + 1;
  check('a spin cut off by a reload is paid once, as drawn', !after.pending && paidOnce, `drew ${cut.pays}; log ${logLen} -> ${after.log.length}`);
  await open();
  const again = await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('froggy.wheel.'));
    return JSON.parse(localStorage.getItem(k)).log.length;
  });
  check('and never a second time', again === after.log.length);

  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('froggy.wheel.')).forEach((k) => localStorage.removeItem(k)));
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}
console.log(`\n${ran - failed}/${ran} passed`);
process.exit(failed ? 1 : 0);
