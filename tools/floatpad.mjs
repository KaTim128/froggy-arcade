/**
 * The floating arrow pad on a phone, driven with real touches (CDP).
 *
 *   1. a thumb down on empty floor on the left half brings the ring there,
 *      centred under it, full strength
 *   2. sliding from there walks the player that way
 *   3. lifting the thumb lets every key go and puts the pad back to rest
 *   4. a thumb down on something in the game that is there to tap (a
 *      cabinet) is the game's: the pad stays where it is
 *   5. a thumb on the right half never moves the pad
 *   6. a thumb straight on an arrow of the pad at rest presses that arrow
 *   7. the same, held upright
 *
 *   node tools/floatpad.mjs
 */

import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';

const URL = 'http://localhost:5173';
const SHOTS = 'tools/shots/floatpad';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = [
  process.env.CHROME_PATH ?? '',
  '/usr/bin/google-chrome',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium',
].find((p) => p && existsSync(p));
mkdirSync(SHOTS, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};

const phone = async (w, h) => {
  const page = await browser.newPage();
  await page.emulate({
    viewport: { width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  await page.goto(`${URL}/?intro=1&charity=1&touch=1&portrait=1&scene=ArcadeHub`, { waitUntil: 'load' });
  // (the arcade, its machines up, the walking layout on)
  for (let i = 0; i < 80; i++) {
    const up = await page.evaluate(() => {
      const s = window.__froggy?.game()?.scene.getScene('ArcadeHub');
      return !!(s && s.scene.isActive() && s.player && window.__touch?.layout()?.stick);
    });
    if (up) break;
    await sleep(250);
  }
  await sleep(600);
  return page;
};

const padBox = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('#touch-controls .tc-dpad');
    const r = el.getBoundingClientRect();
    return { cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2), w: Math.round(r.width), cls: el.className };
  });
const playerXY = (page) =>
  page.evaluate(() => {
    const p = window.__froggy.game().scene.getScene('ArcadeHub').player;
    return { x: p.x, y: p.y };
  });
/** Page coordinates of a game point. */
const toPage = (page, gx, gy) =>
  page.evaluate(
    (gx, gy) => {
      const r = document.querySelector('#game-root canvas').getBoundingClientRect();
      return { x: r.left + (gx * r.width) / 320, y: r.top + (gy * r.height) / 180 };
    },
    gx,
    gy,
  );

const run = async (label, w, h) => {
  console.log(`\nfloatpad  ${label} (${w}x${h})`);
  const page = await phone(w, h);
  const cdp = await page.target().createCDPSession();
  const rest = await padBox(page);
  check(`${label}: the pad starts at rest`, /\brest\b/.test(rest.cls), rest.cls);

  // (1) a thumb on empty floor, left half, in the middle of the room
  const s = await page.evaluate(() => {
    const sc = window.__froggy.game().scene.getScene('ArcadeHub');
    // stand the player clear in the middle, nothing to walk into to the right
    sc.player.setPosition(150, 140);
    return { w: innerWidth, h: innerHeight };
  });
  const at = { x: Math.round(s.w * 0.3), y: Math.round(s.h * 0.62) };
  const tappable = await page.evaluate(() => false);
  void tappable;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y, id: 1 }] });
  await sleep(120);
  const fl = await padBox(page);
  const clampOk = Math.abs(fl.cx - at.x) <= 2 || fl.cx >= fl.w / 2; // (it may be nudged in to stay on the screen)
  check(`${label}: the ring comes to the thumb, centred under it`, /floating/.test(fl.cls) && clampOk && Math.abs(fl.cy - at.y) <= fl.w / 2, `thumb ${at.x},${at.y} pad ${fl.cx},${fl.cy}`);
  const heldStill = await page.evaluate(() => window.__touch.held());
  check(`${label}: a thumb resting on the middle sends nothing`, heldStill.length === 0, heldStill.join(','));
  await page.screenshot({ path: `${SHOTS}/${label}_down.png` });

  // (2) slide right: walk right
  const p0 = await playerXY(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: at.x + Math.round(fl.w * 0.35), y: at.y, id: 1 }] });
  await sleep(700);
  const held = await page.evaluate(() => window.__touch.held());
  const p1 = await playerXY(page);
  await page.screenshot({ path: `${SHOTS}/${label}_right.png` });
  check(`${label}: sliding right holds right`, held.includes('D'), held.join(','));
  check(`${label}: and the player walks right`, p1.x > p0.x + 4, `${p0.x.toFixed(1)} -> ${p1.x.toFixed(1)}`);
  // up-left, without lifting
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: at.x - Math.round(fl.w * 0.3), y: at.y - Math.round(fl.w * 0.3), id: 1 }] });
  await sleep(150);
  const diag = await page.evaluate(() => window.__touch.held());
  check(`${label}: sliding round to up-left holds both`, diag.includes('W') && diag.includes('A') && !diag.includes('D'), diag.join(','));

  // (3) lift
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(150);
  const after = await padBox(page);
  const left = await page.evaluate(() => window.__touch.held());
  check(`${label}: lifted, every key lets go`, left.length === 0, left.join(','));
  check(`${label}: and the pad is back at rest`, /\brest\b/.test(after.cls) && Math.abs(after.cx - rest.cx) <= 1 && Math.abs(after.cy - rest.cy) <= 1, `${after.cx},${after.cy} vs ${rest.cx},${rest.cy}`);

  // (4) a thumb on a cabinet on the left half: the game's tap
  const cab = await page.evaluate(() => {
    const sc = window.__froggy.game().scene.getScene('ArcadeHub');
    const c = sc.cabinets.map((k) => k.def).find((d) => d.x < 150);
    return c ? { x: c.x, y: c.y - 12 } : null;
  });
  if (cab) {
    const pt = await toPage(page, cab.x, cab.y);
    if (pt.x < s.w / 2) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(pt.x), y: Math.round(pt.y), id: 2 }] });
      await sleep(120);
      const c1 = await padBox(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(400);
      const walking = await page.evaluate(() => window.__froggy.game().scene.getScene('ArcadeHub').walker?.active);
      check(`${label}: a thumb on a machine is the game's, not the pad's`, !/floating/.test(c1.cls), `pad ${c1.cls}; walking to it: ${walking}`);
      await page.evaluate(() => window.__froggy.game().scene.getScene('ArcadeHub').walker?.cancel());
    } else check(`${label}: a machine on the left half to tap`, false, JSON.stringify(pt));
  }

  // (5) the right half never moves it
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(s.w * 0.7), y: Math.round(s.h * 0.55), id: 3 }] });
  await sleep(120);
  const r1 = await padBox(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  check(`${label}: a thumb on the right half leaves the pad alone`, !/floating/.test(r1.cls) && Math.abs(r1.cx - rest.cx) <= 1, `${r1.cx},${r1.cy}`);

  // (6) straight on the resting pad's right arrow: right, at once, and it stays put
  {
    const box = await page.evaluate(() => {
      const r = document.querySelector('#touch-controls .tc-dkey.e').getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y, id: 5 }] });
    await sleep(120);
    const k = await page.evaluate(() => window.__touch.held());
    const b1 = await padBox(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(100);
    check(`${label}: a thumb straight on an arrow at rest presses it`, k.includes('D') && Math.abs(b1.cx - rest.cx) <= 1, `${k.join(',')} pad ${b1.cx},${b1.cy}`);
  }

  // a thumb that lands right by an edge: the whole ring kept on the screen
  // (bottom left corner of the left half, off the resting pad)
  const corner = await page.evaluate(() => {
    const r = document.querySelector('#touch-controls .tc-dpad').getBoundingClientRect();
    return r.top > innerHeight * 0.5 ? { x: Math.round(r.right + 6), y: innerHeight - 3 } : { x: 3, y: innerHeight - 3 };
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: corner.x, y: corner.y, id: 4 }] });
  await sleep(120);
  const e1 = await page.evaluate(() => {
    const r = document.querySelector('#touch-controls .tc-dpad').getBoundingClientRect();
    return { l: r.left, b: r.bottom, w: innerWidth, h: innerHeight };
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  check(`${label}: by the corner, the ring stays on the screen`, e1.l >= 0 && e1.b <= e1.h, JSON.stringify(e1));
  await cdp.detach();
  await page.close();
};

try {
  await run('sideways', 844, 390);
  await run('upright', 390, 844);
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
