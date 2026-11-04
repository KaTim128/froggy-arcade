/**
 * Creature Clash arena cover, in every world (scenes2d/CreatureArena):
 * nobody is ever boxed in, both starts join up, every world has more than
 * one kind of cover, some of it breaks, and the pieces are far enough apart
 * to walk between.  Twelve layouts per world.
 *
 *   node tools/barriers.mjs [--url http://localhost:5173]
 */
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { argv } from 'node:process';
const URL = argv.includes('--url') ? argv[argv.indexOf('--url') + 1] : 'http://localhost:5173';
const CHROME = [process.env.CHROME_PATH ?? '', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
let ran = 0;
const check = (n, ok, note = '') => {
  ran++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${n}${note ? `  — ${note}` : ''}`);
  if (!ok) failed++;
};
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 960, height: 540 });
await page.goto(`${URL}/?intro=1&tokens=50&scene=ArcadeHub`, { waitUntil: 'load' });
await sleep(2500);
const seenKinds = {};
const worlds = ['caves', 'fields', 'forests', 'frozen', 'swamps', 'ruins', 'shore', 'desert', 'void', 'volcano'];
try {
  for (const w of worlds) {
    const runs = [];
    for (let i = 0; i < 12; i++) {
      await page.evaluate((biome) => {
        const g = window.__froggy.game();
        for (const s of g.scene.getScenes(true)) if (s.scene.key === 'CreatureArena') s.scene.stop();
        g.scene.start('CreatureArena', { biome, sim: { me: 'fox', foe: 'bear', level: 5, skill: 0.5, warp: 1 } });
      }, w);
      await sleep(350);
      runs.push(
        await page.evaluate(() => {
          const s = window.__froggy.game().scene.getScene('CreatureArena');
          const pc = s.pathCheck();
          const scen = s.barriers.filter((b) => b.life < 0);
          const kinds = [...new Set(scen.map((b) => b.kind))];
          const breakable = scen.some((b) => b.parts.some((q) => q.hp !== undefined));
          // the closest two pieces of DIFFERENT barriers, edge to edge
          let gap = Infinity;
          for (const a of scen) for (const b of scen) if (a !== b) for (const p of a.parts) for (const q of b.parts) gap = Math.min(gap, Math.hypot(p.x - q.x, p.y - q.y) - p.r - q.r);
          return { ok: pc.ok, pockets: pc.pockets, kinds, breakable, gap, n: scen.length };
        }),
      );
    }
    check(`${w}: every layout lets both creatures reach each other and everywhere`, runs.every((r) => r.ok), runs.filter((r) => !r.ok).map((r) => `pockets ${r.pockets}`).join(', '));
    const kinds = [...new Set(runs.flatMap((r) => r.kinds))];
    seenKinds[w] = kinds;
    check(`${w}: more than one kind of cover`, runs.every((r) => r.kinds.length >= 2), kinds.join(' '));
    check(`${w}: some cover breaks`, runs.every((r) => r.breakable));
    const minGap = Math.min(...runs.map((r) => r.gap));
    check(`${w}: barriers far enough apart to walk between`, minGap >= 14, `closest ${minGap.toFixed(1)}px`);
  }
  // ---- no world borrows another's cover
  const owner = {};
  const shared = [];
  for (const [w, ks] of Object.entries(seenKinds)) for (const k of ks) {
    if (owner[k] && owner[k] !== w) shared.push(`${k} (${owner[k]} + ${w})`);
    owner[k] = owner[k] ?? w;
  }
  check('every world has its own barriers: none shared', shared.length === 0, shared.join(', '));
  // a breakable piece, shot down: it loses its collision
  const broke = await page.evaluate(() => {
    const s = window.__froggy.game().scene.getScene('CreatureArena');
    const p = s.props.find((q) => q.hp !== undefined && !q.owner);
    if (!p) return null;
    const before = s.props.length;
    s.chip(p, 9999);
    return { gone: !s.props.includes(p), fewer: s.props.length === before - 1 };
  });
  check('a broken piece no longer blocks anything', !!broke && broke.gone && broke.fewer);
  check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
}
console.log(`\n${ran - failed}/${ran} passed`);
process.exit(failed ? 1 : 0);
