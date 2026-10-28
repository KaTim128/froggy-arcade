/**
 * EVERY SCENE ON A PHONE, LOOKING FOR WHAT BREAKS (log #62).
 *
 * The errors the user saw on a phone were never attached, so this looks for
 * every kind there is, on an iPhone and an Android held sideways and upright:
 *
 *   - a page error or a console error, in any scene or 3D scene, or in any
 *     cabinet once it is being played
 *   - a request that failed or came back 4xx/5xx (an image or a sound that
 *     is not where the page asks for it -- a broken picture)
 *   - an <img> on the page that did not load (the broken-picture icon)
 *   - sideways: the picture not filling the screen's height (black gaps), or
 *     reaching past the screen (clipped)
 *
 *   node tools/mobilecrawl.mjs [--only HideRoom3D,Minigame:grudge]
 */

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const URL = arg('--url', 'http://localhost:5173');
const ONLY = arg('--only', '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = [process.env.CHROME_PATH ?? '', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

const GAMES = ['tictactoe', 'hoops', 'whack', 'bowling', 'battleship', 'grudge', 'donkeykong', 'airhockey', 'fallingblocks', 'danceoff', 'frogcross', 'carchase', 'frogvslizard', 'bogball', 'slots', 'roulette', 'frograce', 'frogstermash', 'blackjack', 'wheel'];
const SCENES = [
  ['ArcadeHub', {}],
  ['ArcadeAnnex', {}],
  ['ArcadeCasino', {}],
  ['ArcadeLounge', {}],
  ['ExteriorDay', {}],
  ['StreetEast', {}],
  ['StreetWest', {}],
  ['Condo', { area: 'room' }],
  ['FurnitureStore', {}],
  ['ClothesStore', {}],
  ['BarberShop', {}],
  ['Hotel', { area: 'lobby' }],
  ['Stairwell', {}],
  ['CreatureHub', {}],
  ['CraneGame', { kind: 'oddity' }],
  ['ExteriorNight', {}],
  ['BackAlley', {}],
  ['ArcadeDark', {}],
  ['HideRoom3D', {}],
  ['Chase3D', {}],
  ['NightRoad3D', {}],
  ['HotelHall3D', {}],
  ['HotelLobby3D', {}],
  ['PoliceEscape3D', {}],
  ...GAMES.map((g) => [`Minigame:${g}`, { id: g, from: 'ArcadeHub' }]),
].filter(([k]) => !ONLY || ONLY.split(',').some((o) => k === o || k.startsWith(`${o}:`)));

const PHONES = [
  { name: 'iphone sideways', w: 844, h: 390, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  { name: 'android sideways', w: 915, h: 412, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36' },
  { name: 'iphone upright', w: 390, h: 844, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
];

let bad = 0;
let looked = 0;
try {
  for (const phone of PHONES) {
    console.log(`\n${phone.name} (${phone.w}x${phone.h})`);
    for (const [name, data] of SCENES) {
      const [key] = name.split(':');
      const page = await browser.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(`pageerror: ${e.message.slice(0, 120)}`));
      page.on('console', (m) => {
        if (m.type() === 'error' && !/favicon|AudioContext|autoplay/i.test(m.text())) errs.push(`console: ${m.text().slice(0, 120)}`);
      });
      page.on('requestfailed', (r) => {
        if (!/favicon/.test(r.url())) errs.push(`failed: ${r.url().replace(URL, '')} ${r.failure()?.errorText ?? ''}`);
      });
      page.on('response', (r) => {
        if (r.status() >= 400 && !/favicon/.test(r.url())) errs.push(`${r.status()}: ${r.url().replace(URL, '')}`);
      });
      await page.emulate({ viewport: { width: phone.w, height: phone.h, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: phone.ua });
      await page.goto(`${URL}/?intro=1&charity=1&key=1&tokens=200&touch=1&scene=${key === 'ExteriorDay' ? 'StreetWest' : 'ExteriorDay'}`, { waitUntil: 'load' });
      await sleep(2200);
      await page.evaluate((key, data) => {
        const f = window.__froggy;
        if (data.id) f.patch({ gamesPlayed: { ...f.state().gamesPlayed, [data.id]: 3 } });
        const g = f.game();
        for (const s of g.scene.getScenes(true)) s.scene.stop();
      }, key, data);
      await sleep(250);
      await page.evaluate((key, data) => window.__froggy.game().scene.start(key, data), key, data);
      await sleep(key.endsWith('3D') ? 4500 : 2200);
      // a cabinet: past its screen, into the game itself
      if (key === 'Minigame') {
        await page.evaluate(() => window.__froggy.game().scene.getScene('Minigame').input.keyboard?.emit('keyup-SPACE'));
        await sleep(2500);
      }
      const look = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map((i) => i.getAttribute('src').slice(0, 60));
        const c = document.querySelector('#game-root canvas')?.getBoundingClientRect();
        const W = window.innerWidth;
        const H = window.innerHeight;
        return { imgs, c: c && { x: c.left, y: c.top, w: c.width, h: c.height }, W, H, scenes: window.__froggy.activeScenes() };
      });
      for (const i of look.imgs) errs.push(`broken image: ${i}`);
      if (look.c && phone.w > phone.h) {
        // sideways: the picture is as tall as the screen, and on it
        if (look.c.h < look.H - 2) errs.push(`picture ${Math.round(look.c.h)} tall on a ${look.H} screen`);
        if (look.c.x < -1 || look.c.y < -1 || look.c.x + look.c.w > look.W + 1 || look.c.y + look.c.h > look.H + 1) errs.push(`picture off the screen ${JSON.stringify(look.c)}`);
      }
      looked++;
      const uniq = [...new Set(errs)];
      if (uniq.length) {
        bad += uniq.length;
        console.log(`  ${name}: ${uniq.length}`);
        for (const e of uniq.slice(0, 6)) console.log(`     - ${e}`);
      } else console.log(`  ${name}: ok (${look.scenes.join(',')})`);
      await page.close();
    }
  }
} catch (e) {
  console.error(e);
  bad++;
} finally {
  await browser.close();
}
console.log(`\n${looked} screens looked at, ${bad} problems`);
process.exit(bad ? 1 : 0);
