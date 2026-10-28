/**
 * CREATURE CLASH BALANCE SIMULATOR (log #42, #54, #61; B6 tests).
 *
 * The computer plays both sides of a fight, many steps a frame, in a random
 * arena: every creature against a spread of the others, at one level and one
 * skill.  It prints each creature's win rate, the spread, and the outliers
 * (above HIGH or below LOW) to tune.  Nothing is paid or saved.
 *
 *   node tools/clash.mjs [fights-per-creature=8] [level=10]
 */

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const URL = 'http://localhost:5173';
const N = Number(process.argv[2] ?? 8);
const LEVEL = Number(process.argv[3] ?? 10);
const HIGH = 0.68;
const LOW = 0.32;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = [process.env.CHROME_PATH ?? '', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => p && existsSync(p));

const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 360 });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${URL}/?intro=1&scene=ArcadeLounge`, { waitUntil: 'load' });
await sleep(2500);

const roster = await page.evaluate(async () => (await import('/src/game/creatures.ts')).CREATURES.map((c) => c.id));
const biomes = ['caves', 'fields', 'forests', 'frozen', 'swamps', 'ruins', 'shore', 'desert', 'volcano'];
const tally = Object.fromEntries(roster.map((id) => [id, { w: 0, n: 0 }]));

/** One fight, to the end; true if `me` won (null: it never ended, or the page reloaded under it). */
async function fight(me, foe, biome) {
  try {
    return await fightOnce(me, foe, biome);
  } catch {
    // (the dev server reloaded the page: wait for it to come back, and skip this one)
    await sleep(4000);
    return null;
  }
}

async function fightOnce(me, foe, biome) {
  await page.evaluate((spec, biome) => {
    window.__clashSim = null;
    const g = window.__froggy.game();
    for (const s of g.scene.getScenes(true)) if (s.scene.key === 'CreatureArena') s.scene.stop();
    g.scene.start('CreatureArena', { biome, sim: spec });
  }, { me, foe, level: LEVEL, skill: 0.75, warp: 12 }, biome);
  for (let t = 0; t < 400; t++) {
    await sleep(100);
    const r = await page.evaluate(() => window.__clashSim?.result ?? null);
    if (r !== null) return r;
  }
  return null;
}

const t0 = Date.now();
for (const [i, me] of roster.entries()) {
  for (let k = 0; k < N; k++) {
    // a spread of opponents: every one meets as many as N different others
    const foe = roster[(i + 1 + Math.floor(((k + 0.5) * (roster.length - 1)) / N)) % roster.length];
    // each side once on the left, so neither the start nor the side decides it
    const left = k % 2 === 0;
    const won = await fight(left ? me : foe, left ? foe : me, biomes[(i + k) % biomes.length]);
    if (won === null) continue;
    const meWon = left ? won : !won;
    tally[me].w += meWon ? 1 : 0;
    tally[me].n += 1;
    tally[foe].w += meWon ? 0 : 1;
    tally[foe].n += 1;
  }
  process.stdout.write(`\r${i + 1}/${roster.length} creatures, ${Math.round((Date.now() - t0) / 1000)}s`);
}
console.log('');
const rows = roster.map((id) => ({ id, rate: tally[id].n ? tally[id].w / tally[id].n : 0, n: tally[id].n })).sort((a, b) => b.rate - a.rate);
for (const r of rows) console.log(`${r.id.padEnd(10)} ${(r.rate * 100).toFixed(0).padStart(3)}%  (${r.n})${r.rate > HIGH ? '  HIGH' : r.rate < LOW ? '  LOW' : ''}`);
const rates = rows.map((r) => r.rate);
const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
const sd = Math.sqrt(rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length);
console.log(`\nspread: sd ${(sd * 100).toFixed(1)} points; ${rows.filter((r) => r.rate > HIGH).length} high, ${rows.filter((r) => r.rate < LOW).length} low`);
if (errs.length) console.log('page errors:\n' + [...new Set(errs)].slice(0, 10).join('\n'));
await browser.close();
