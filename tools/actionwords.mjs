/**
 * THE PHONE'S INTERACT BUTTON SAYS WHAT IT WILL DO (log #50).
 *
 *   1. every prompt the game writes gets the right word (PLAY at a machine,
 *      OPEN at a shop or arcade door, HIDE at a hiding place, TALK, GO ...)
 *   2. on a phone, walking up to things in the arcade changes the button, and
 *      walking away puts INTERACT back
 *   3. in the 3D building, beside a wardrobe the button says HIDE, and
 *      away from it, whatever is in reach there (OPEN at a door) or INTERACT
 *   4. on a desktop nothing changes: no button, no word
 *
 *   node tools/actionwords.mjs
 */

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const URL = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = [process.env.CHROME_PATH ?? '', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};

const phone = async (query) => {
  const page = await browser.newPage();
  await page.emulate({
    viewport: { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  await page.goto(`${URL}/${query}&touch=1`, { waitUntil: 'load' });
  await sleep(3000);
  return page;
};
const labels = (page) => page.evaluate(() => window.__touch.labels());
/** The word on the button sending E (the layout's INTERACT). */
const eWord = (page) =>
  page.evaluate(() => {
    const b = [...document.querySelectorAll('.tc-btn')].find((x) => x.dataset.key === 'E' && x.dataset.base === 'INTERACT');
    return b ? b.textContent : null;
  });
const waitWord = async (page, want) => {
  let w = null;
  for (let i = 0; i < 60; i++) {
    await sleep(100);
    w = await eWord(page);
    if (w === want) break;
  }
  return w;
};

try {
  // ---------------------------------------------------------------- 1 the words
  {
    const page = await phone('?intro=1&charity=1&scene=ArcadeHub');
    const table = [
      ['[E] FROG CROSS - 5 TOKENS', 'PLAY'],
      ['[E] FROGGY SLOTS - 3 A SPIN', 'PLAY'],
      ['[E] BLACKJACK - 10 MIN BET', 'PLAY'],
      ['[E] PLAY THE ARCADE CABINET', 'PLAY'],
      ['[E] CREATURE CLASH', 'PLAY'],
      ['[E] GO IN', 'OPEN'],
      ['[E] DOOR', 'OPEN'],
      ['[E] HOME AND HEARTH', 'OPEN'],
      ["[E] SHARP'S BARBER", 'OPEN'],
      ['[E] OPEN THE CURTAINS', 'OPEN'],
      ['[E] WARDROBE', 'OPEN'],
      ['INTERACT: HIDE IN THE WARDROBE', 'HIDE'],
      ['INTERACT: HIDE UNDER THE BED', 'HIDE'],
      ['[E] HIDE IN THE STORAGE ROOM', 'HIDE'],
      ['[E] GET INSIDE', 'HIDE'],
      ['[E] TALK TO THE STAFF', 'TALK'],
      ['[E] RECEPTION', 'TALK'],
      ['[E] SIT IN THE CHAIR', 'SIT'],
      ['[E] SLEEP', 'SLEEP'],
      ['[E] BEG OR SLEEP', 'BEG'],
      ['[E] LOOK IN THE MIRROR', 'LOOK'],
      ['[E] PICK UP THE KEY', 'TAKE'],
      ['[E] PUT IT DOWN', 'DROP'],
      ['[E] CLOSE THE PORT', 'CLOSE'],
      ['[E] CLIMB OUT OF THE WINDOW', 'CLIMB'],
      ['[E] COME OUT', 'OUT'],
      ['[E] LEAVE', 'LEAVE'],
      ['[E] UNLOCK', 'UNLOCK'],
      ['[E] LOCKED', 'TRY'],
      ['INTERACT: TRY THE DOOR', 'TRY'],
      ['[E] CONTINUE TO HIDE AND SEEK ROUND 2', 'GO ON'],
      ['TAP INTERACT - CALL THE LIFT', 'CALL'],
      ['[E] CHANGE - $12', 'USE'],
      ['[E] PRIZE COUNTER', 'USE'],
      ['[E] THE RAILS', 'BROWSE'],
      ['[E] RED SCARF $8', 'BUY'],
      ['[E] LAMP: OFF', 'SWITCH'],
      ['[E] OUTSIDE', 'GO'],
      ['[E] BACK ROOM', 'GO'],
      ['[E] ROOM 612', 'GO'],
      ['[E] TO LEVEL 3', 'GO'],
      ['[E] STAIRWELL', 'GO'],
      ['YOU SIT DOWN WITH THE CAN. [E] TO GET UP.', null],
      ['FROG CROSS', null],
    ];
    const got = await page.evaluate(async (table) => {
      const m = await import('/src/core/keyWords.ts');
      return table.map(([s]) => m.actionWord(s));
    }, table);
    const wrong = table.filter(([, w], i) => got[i] !== w).map(([s, w], i) => `${s} -> ${got[table.findIndex((t) => t[0] === s)]} (want ${w})`);
    check(`every prompt gets its word (${table.length} prompts)`, wrong.length === 0, wrong.join('; '));
    await page.close();
  }

  // ---------------------------------------------------------- 2 the arcade, live
  {
    const page = await phone('?intro=1&charity=1&tokens=50&scene=ArcadeHub');
    const start = await labels(page);
    check('the arcade layout has an INTERACT button', start.includes('INTERACT') || (await eWord(page)) !== null, start.join(','));
    const put = (where) =>
      page.evaluate((where) => {
        const s = window.__froggy.game().scene.getScene('ArcadeHub');
        if (where === 'cab') {
          const at = s.spots.get(s.cabinets[0]).stand;
          s.player.setPosition(at.x, at.y);
        } else if (where === 'far') s.player.setPosition(160, 150);
        return s.cabinets[0]?.def.title;
      }, where);
    // (somewhere open first: nothing in reach)
    await put('far');
    let w = await waitWord(page, 'INTERACT');
    const farWord = w;
    const title = await put('cab');
    w = await waitWord(page, 'PLAY');
    const prompt = await page.evaluate(() => window.__froggy.game().scene.getScene('ArcadeHub').prompt.text);
    check('beside a machine the button says PLAY', w === 'PLAY', `${w} — at ${title}, prompt "${prompt}"`);
    await put('far');
    w = await waitWord(page, 'INTERACT');
    check('and walking away puts INTERACT back', w === 'INTERACT', `${w} (first, away from everything: ${farWord})`);
    await page.close();
  }

  // ---------------------------------------------------------- 3 the 3D building
  {
    const page = await phone('?intro=1&charity=1&key=1&scene=PoliceEscape3D');
    await sleep(1500);
    const P = (name, ...a) => page.evaluate((name, a) => window.__police[name](...a), name, a);
    for (let i = 0; i < 60 && (await page.evaluate(() => window.__police.phase)) !== 'play'; i++) await sleep(250);
    await P('freeze', true);
    const rooms = await P('rooms');
    const rm = rooms.find((x) => x.open && x.special === 'none' && x.spots.some((s) => s.kind === 'wardrobe'));
    const sp = rm.spots.find((s) => s.kind === 'wardrobe');
    await P('useDoor', `room-${rm.id}`);
    await P('warp', sp.ax, sp.az, rm.f);
    let w = await waitWord(page, 'HIDE');
    const st = await page.evaluate(() => window.__froggy.game().scene.getScene('PoliceEscape3D').prompt);
    check('in the 3D building, beside a wardrobe the button says HIDE', w === 'HIDE', `${w} — prompt "${st}"`);
    // (moving again, so the overlay is painted from where you now are)
    await P('freeze', false);
    await P('warp', 0.9, 2.6, rm.f);
    // (till the room has been painted again from out here)
    for (let i = 0; i < 100 && (await page.evaluate(() => window.__froggy.game().scene.getScene('PoliceEscape3D').prompt)).includes('HIDE'); i++) await sleep(100);
    await sleep(700);
    const want = await page.evaluate(async () => {
      const m = await import('/src/core/keyWords.ts');
      return m.actionWord(window.__froggy.game().scene.getScene('PoliceEscape3D').prompt) ?? 'INTERACT';
    });
    w = await waitWord(page, want);
    const st2 = await page.evaluate(() => window.__froggy.game().scene.getScene('PoliceEscape3D').prompt);
    check('and away from it, the button follows what is in reach now', w === want && w !== 'HIDE', `${w} — prompt "${st2}"`);
    await page.close();
  }

  // ---------------------------------------------------------- 4 a desktop
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 540 });
    await page.goto(`${URL}/?intro=1&charity=1&scene=ArcadeHub&touch=0`, { waitUntil: 'load' });
    await sleep(2500);
    const n = await page.evaluate(() => document.querySelectorAll('.tc-btn').length);
    check('on a desktop there is no button to relabel', n === 0, `${n} buttons`);
    await page.close();
  }
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
