/**
 * EVERY WORD IN ITS BOX.  Opens each screen in turn and, on every one,
 * looks at every line of text:
 *
 *   - in a button (a container of a box and its label): the label's ink
 *     inside the box with at least 2 clear either side and above and below;
 *   - pinned to the screen (HUD, menus, cards): inside the picture.
 *
 * Every line that breaks a rule is printed with its screen and its words, so
 * the list is the list of things to fix (log #45, #49, #51).
 *
 *   node tools/textfit.mjs [--url http://localhost:5173] [--only Goals,Minigame:wheel]
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
const CHROME = [process.env.CHROME_PATH ?? '', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The screens: a scene key, and what to start it with.  The arcade games go
// through the cabinet shell (its card first, then the game).
const GAMES = ['tictactoe', 'hoops', 'whack', 'bowling', 'battleship', 'grudge', 'donkeykong', 'airhockey', 'fallingblocks', 'danceoff', 'frogcross', 'carchase', 'frogvslizard', 'bogball', 'slots', 'roulette', 'frograce', 'frogstermash', 'blackjack', 'wheel'];
const SCREENS = [
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
  ['Goals', { from: 'ArcadeHub' }],
  ['BadgesModal', { from: 'ArcadeHub' }],
  ['InventoryModal', { from: 'ArcadeHub' }],
  ['SettingsModal', { from: 'ArcadeHub', pause: true }],
  ['CreatureHub', {}],
  ['PrizeCounter', { from: 'ArcadeHub' }],
  ['ChangeMachine', { from: 'ArcadeHub' }],
  ['CraneGame', { kind: 'oddity' }],
  ...GAMES.map((g) => [`Minigame:${g}`, { id: g, from: 'ArcadeHub' }]),
  ...GAMES.map((g) => [`Minigame:${g}:play`, { id: g, from: 'ArcadeHub' }]),
].filter(([k]) => !ONLY || ONLY.split(',').some((o) => k === o || k.startsWith(`${o}:`)));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let bad = 0;
let looked = 0;
try {
  for (const [name, data] of SCREENS) {
    const [key, , mode] = name.split(':');
    // (a fresh page for every screen: stopping one scene and starting the
    // next in the same breath sometimes left the second one never started)
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 540 });
    await page.goto(`${URL}/?intro=1&charity=1&tokens=200&scene=${key === 'ExteriorDay' ? 'StreetWest' : 'ExteriorDay'}`, { waitUntil: 'load' });
    await sleep(2500);
    await page.evaluate(
      (key, data) => {
        const f = window.__froggy;
        if (data.id) f.patch({ gamesPlayed: { ...f.state().gamesPlayed, [data.id]: 3 } });
        const g = f.game();
        for (const s of g.scene.getScenes(true)) s.scene.stop();
        g.scene.start(key, data);
      },
      key,
      data,
    );
    await sleep(2200);
    if (mode === 'play') {
      // past the card: PLAY (and PLAY again on a PLAY/PRACTICE choice)
      await page.keyboard.press('Space');
      await sleep(900);
      await page.keyboard.press('Space');
      await sleep(1500);
    }
    const found = await page.evaluate(() => {
      const f = window.__froggy;
      const W = 320;
      const H = 180;
      const out = [];
      let n = 0;
      for (const k of f.activeScenes()) {
        const sc = f.game().scene.getScene(k);
        const cam = sc.cameras?.main;
        const walk = (list, parents) => {
          for (const o of list) {
            if (!o.visible || o.alpha === 0) continue;
            if (o.list) {
              walk(o.list, [...parents, o]);
              continue;
            }
            if (o.type !== 'BitmapText' || !o.text || !o.text.trim()) continue;
            n++;
            // where the ink is, on the screen
            const b = o.getBounds();
            let x0 = b.x;
            let y0 = b.y;
            const sf = o.scrollFactorX ?? 1;
            const pinned = sf === 0 || parents.some((p) => p.scrollFactorX === 0);
            if (!pinned && cam) {
              x0 -= cam.scrollX;
              y0 -= cam.scrollY;
            }
            // (a glyph's cell has a blank right column and the caps sit in the top six of eight rows)
            const x1 = x0 + b.width - 1;
            const y1 = y0 + b.height - (o.text.includes('\n') ? 0 : 2);
            const words = o.text.replace(/\n/g, ' / ').slice(0, 40);
            if (pinned && (x0 < -0.5 || x1 > W + 0.5 || y0 < -0.5 || y1 > H + 0.5)) out.push({ k, why: 'off the screen', words, at: [x0, y0, x1, y1].map(Math.round) });
            // in a button: its container's first child is the box
            const p = parents[parents.length - 1];
            const box = p?.list?.[0];
            if (p && box && box.type === 'Rectangle' && p.list.length <= 3 && p.input) {
              const bb = box.getBounds();
              let bx0 = bb.x;
              let by0 = bb.y;
              if (!pinned && cam) {
                bx0 -= cam.scrollX;
                by0 -= cam.scrollY;
              }
              const bx1 = bx0 + bb.width;
              const by1 = by0 + bb.height;
              if (x0 < bx0 + 2 || x1 > bx1 - 2 || y0 < by0 + 1 || y1 > by1 - 1) out.push({ k, why: 'touches or leaves its box', words, ink: [x0, y0, x1, y1].map(Math.round), box: [bx0, by0, bx1, by1].map(Math.round) });
            }
          }
        };
        walk(sc.children?.list ?? [], []);
      }
      // TEXT OVER TEXT, and TEXT OUT OF ITS PANEL: every pinned line against
      // every other (overlapping ink), and against the smallest plain panel
      // its middle is in (a menu, a card, a dialog), which it must sit inside
      const lines = [];
      const panels = [];
      for (const k of f.activeScenes()) {
        const sc = f.game().scene.getScene(k);
        const gather = (list, parents) => {
          for (const o of list) {
            if (!o.visible || o.alpha < 0.05) continue;
            if (o.list) {
              gather(o.list, [...parents, o]);
              continue;
            }
            const pinned = (o.scrollFactorX ?? 1) === 0 || parents.some((p) => p.scrollFactorX === 0);
            if (!pinned) continue;
            if (typeof o.getBounds !== "function") continue;
            const inButton = parents.length && parents[parents.length - 1].input;
            const b = o.getBounds();
            if (o.type === 'BitmapText' && o.text?.trim()) lines.push({ k, t: o.text.replace(/\n/g, ' / ').slice(0, 30), x0: b.x, y0: b.y, x1: b.x + b.width - 1, y1: b.y + b.height - (o.text.includes('\n') ? 0 : 2), depth: o.depth });
            else if (o.type === 'Rectangle' && !inButton && b.width >= 24 && b.height >= 14 && b.width < W - 2 && o.fillAlpha > 0.5) panels.push({ k, x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height, depth: o.depth });
          }
        };
        gather(sc.children?.list ?? [], []);
      }
      for (let i = 0; i < lines.length; i++)
        for (let j = i + 1; j < lines.length; j++) {
          const a = lines[i];
          const c = lines[j];
          if (a.k !== c.k) continue;
          const ox = Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0);
          const oy = Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0);
          if (ox > 1 && oy > 1) out.push({ k: a.k, why: 'over another line', words: `${a.t}" / "${c.t}`, at: [a.x0, a.y0, c.x0, c.y0].map(Math.round) });
        }
      for (const l of lines) {
        const mx = (l.x0 + l.x1) / 2;
        const my = (l.y0 + l.y1) / 2;
        const home = panels
          .filter((p) => p.k === l.k && mx > p.x0 && mx < p.x1 && my > p.y0 && my < p.y1 && p.depth <= l.depth)
          .sort((p, q) => (p.x1 - p.x0) * (p.y1 - p.y0) - (q.x1 - q.x0) * (q.y1 - q.y0))[0];
        if (home && (l.x0 < home.x0 + 1 || l.x1 > home.x1 - 1 || l.y0 < home.y0 || l.y1 > home.y1)) out.push({ k: l.k, why: 'runs out of its panel', words: l.t, ink: [l.x0, l.y0, l.x1, l.y1].map(Math.round), box: [home.x0, home.y0, home.x1, home.y1].map(Math.round) });
      }
      return { n, out };
    });
    looked += found.n;
    if (found.out.length) {
      bad += found.out.length;
      console.log(`  ${name}: ${found.out.length}`);
      for (const o of found.out.slice(0, 12)) console.log(`     - ${o.why}: "${o.words}" ${JSON.stringify(o.ink ?? o.at)}${o.box ? ` in ${JSON.stringify(o.box)}` : ''}`);
    } else console.log(`  ${name}: ${found.n ? 'ok' : 'NOTHING SHOWN'} (${found.n})`);
    if (!found.n) bad++;
    await page.close();
  }
} catch (e) {
  console.error(e);
  bad++;
} finally {
  await browser.close();
}
console.log(`\n${looked} lines of text looked at, ${bad} out of place`);
process.exit(bad ? 1 : 0);
