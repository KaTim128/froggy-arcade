/**
 * CROAKED TUNING.  How often a stand-in player wins each way round, with the
 * game's own settings (src/minigames/croaked.ts TUNE), at three skill levels:
 * the share of turns it takes at random (0.01 sharp, 0.05 steady, 0.12 careless).
 *
 *   node tools/croaked_sim.mjs [rounds]        (a dev server on :5173)
 */
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://localhost:5173/?intro=1&scene=ArcadeHub'); await p.waitForFunction(() => window.__froggy, null, { timeout: 30000 });
const n = Number(process.argv[2] ?? 60);
const r = await p.evaluate(async (n) => {
  const m = await import('/src/minigames/croaked.ts');
  const out = {};
  for (const noise of [0.01, 0.05, 0.12]) out[noise] = { asFrog: m.simulateCroaked('frog', n, noise), asTadpole: m.simulateCroaked('survivor', n, noise, {}, 0.6) };
  return out;
}, n);
for (const [k, v] of Object.entries(r)) console.log(`random turns ${k}: wins as the frog ${(v.asFrog * 100).toFixed(0)}%, as the tadpole ${(v.asTadpole * 100).toFixed(0)}%`);
await b.close();
