/**
 * A RELOAD IS NOT A LOSS (log #87).
 *
 *   1. a reload mid-game comes straight back into the same cabinet -- no
 *      title screen, no card -- paused with the settings open
 *   2. and it charged nothing again: the tokens are what they were
 *   3. RESUME counts 3, 2, 1 before the game moves again
 *   4. a cabinet that keeps a snapshot is put back where it stood
 *      (`--games a,b` to choose which: by default every one that keeps one)
 *   5. a reload in a room comes back to that room, paused, where you stood
 *   6. a game that ended leaves nothing to come back to: the arcade again
 *   7. a fresh visit (a new tab) still starts at the title screen
 *
 *   node tools/session.mjs [--games whack,hoops]
 */

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const URL = arg('--url', 'http://localhost:5173');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = [process.env.CHROME_PATH ?? '', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};

const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
const until = async (fn, ms = 15000, ...a) => {
  const end = Date.now() + ms;
  let v;
  while (Date.now() < end) {
    v = await page.evaluate(fn, ...a).catch(() => undefined);
    if (v) return v;
    await sleep(150);
  }
  return v;
};
const scenes = () => page.evaluate(() => window.__froggy?.activeScenes() ?? []);
const tokens = () => page.evaluate(() => window.__froggy.state().tokens);
const mg = () =>
  page.evaluate(() => {
    const s = window.__froggy.game().scene.getScene('Minigame');
    return { started: s.started, settled: s.settled, card: !!s.card, id: s.gameId, practicing: s.practicing, stake: s.stake };
  });
/** Reload the page as a player would, and click past CLICK TO BEGIN. */
const reload = async () => {
  await page.goto(`${URL}/`, { waitUntil: 'load' });
  await until(() => window.__froggy?.activeScenes().includes('Boot'));
  // the gate: CLICK TO BEGIN (the click a browser needs before it plays sound)
  for (let i = 0; i < 30; i++) {
    await sleep(250);
    await page.mouse.click(480, 300);
    const s = await scenes();
    if (!s.includes('Boot')) break;
  }
};
/** A cabinet, its card passed with SPACE: in play. */
const playCabinet = async (id) => {
  await page.evaluate((id) => {
    const f = window.__froggy;
    f.patch({ gamesPlayed: { ...f.state().gamesPlayed, [id]: 3 } });
    const g = f.game();
    for (const s of g.scene.getScenes(true)) s.scene.stop();
  }, id);
  await sleep(250);
  await page.evaluate((id) => window.__froggy.game().scene.start('Minigame', { id, from: 'ArcadeHub' }), id);
  await until(() => !!window.__froggy.game().scene.getScene('Minigame').card);
  await sleep(300);
  await page.keyboard.press('Space');
  return until(() => window.__froggy.game().scene.getScene('Minigame').started);
};

try {
  // a profile with tokens, being played in this tab
  await page.goto(`${URL}/?intro=1&charity=1&scene=ArcadeHub`, { waitUntil: 'load' });
  await sleep(2500);
  // (a profile of its own, as the picker makes one, with the intro seen and tokens to play with)
  await page.evaluate(() => {
    const f = window.__froggy;
    f.newProfile(`SESSION${Date.now() % 10000}`);
    f.patch({ seenIntro: true });
    f.setTokens(100);
    f.session.markLive();
  });

  // ------------------------------------------------ 1-3: a cabinet without a snapshot
  await playCabinet('donkeykong');
  await sleep(1500);
  const t0 = await tokens();
  await reload();
  const back = await until(() => window.__pause.paused() === 'Minigame' && window.__froggy.game().scene.isPaused('Minigame') && window.__froggy.activeScenes().includes('SettingsModal'), 12000);
  const m = await mg();
  check('a reload mid-game comes straight back into the same cabinet, paused, settings open', !!back && m.id === 'donkeykong' && m.started && !m.card, `${(await scenes()).join(',')} ${JSON.stringify(m)}`);
  check('and charges nothing again', (await tokens()) === t0, `${t0} -> ${await tokens()}`);
  await page.evaluate(() => window.__pause.resume());
  await sleep(200);
  const counting = await page.evaluate(() => ({ c: window.__pause.counting(), text: document.getElementById('resume-count')?.textContent ?? '' }));
  const stillFrozen = await page.evaluate(() => window.__froggy.game().scene.isPaused('Minigame'));
  await sleep(2400);
  const after = await page.evaluate(() => ({ paused: window.__froggy.game().scene.isPaused('Minigame'), count: !!document.getElementById('resume-count') }));
  check('RESUME counts 3, 2, 1 with the game still frozen, then lets it go', counting.c && counting.text === '3' && stillFrozen && !after.paused && !after.count, `${JSON.stringify(counting)} frozen ${stillFrozen} then ${JSON.stringify(after)}`);

  // ------------------------------------------------ 6: a game that ended
  await page.evaluate(() => window.__minigame.lose());
  await sleep(500);
  const cleared = await page.evaluate(() => window.__froggy.state().game);
  check('a game that ended leaves nothing in the save to come back to', cleared === null, JSON.stringify(cleared));

  // ------------------------------------------------ 4: cabinets that keep a snapshot
  const want = arg('--games', '');
  const snapGames = await page.evaluate(async () => {
    const r = await import('/src/minigames/registry.ts');
    const ids = ['tictactoe', 'hoops', 'whack', 'bowling', 'battleship', 'grudge', 'donkeykong', 'airhockey', 'fallingblocks', 'danceoff', 'frogcross', 'carchase', 'frogvslizard', 'bogball', 'slots', 'roulette', 'frograce', 'frogstermash', 'blackjack', 'wheel'];
    return ids.filter((id) => typeof r.getMinigame(id).snapshot === 'function');
  });
  const list = want === 'none' ? [] : want ? want.split(',') : snapGames;
  console.log(`  (cabinets that keep a snapshot: ${snapGames.join(', ') || 'none'})`);
  // (what to do in each before the reload, to catch it mid-play rather than at its start)
  const ACT = {
    // (an item in the air)
    frogvslizard: async () => {
      await page.evaluate(() => window.__fvl.autoThrow('rock'));
      await sleep(300);
    },
    // (into the fight, a strike thrown)
    grudge: async () => {
      await sleep(1500);
      await page.evaluate(() => window.__grudge.press('high'));
      await sleep(120);
    },
    // (a ball rolling down the lane)
    bowling: async () => {
      await page.evaluate(() => window.__bowl.throw(0, 0.8));
      await sleep(400);
    },
    // (a shot in flight)
    bogball: async () => {
      await page.evaluate(() => window.__bog.shoot(0, -0.4, 0.8));
      await sleep(250);
    },
    // (all six placed and the hunt begun, one search made)
    battleship: async () => {
      await page.evaluate(() => {
        const p = window.__pond;
        for (let n = 0; n < 6 && p.state().toPlace.length; n++) p.place(p.legal()[0]);
        p.start();
        p.search(0);
      });
      await sleep(3000);
    },
    blackjack: async () => {
      await page.keyboard.press('Space');
      await sleep(900);
    },
  };
  for (const id of list) {
    await playCabinet(id);
    await sleep(2500);
    await ACT[id]?.();
    // the snapshot the save holds now, and the cabinet's own view of itself
    // (held still first, so what is saved on the way out is this very moment)
    const before = await page.evaluate(() => {
      window.__froggy.game().scene.pause('Minigame');
      window.__froggy.game().scene.getScene('Minigame').saveGame(true);
      return JSON.stringify(window.__froggy.state().game?.snap ?? null);
    });
    const tb = await tokens();
    await reload();
    await until(() => window.__pause?.paused() === 'Minigame', 12000);
    const again = await page.evaluate(() => JSON.stringify(window.__froggy.game().scene.getScene('Minigame').mod.snapshot()));
    const same = before !== 'null' && again === before;
    check(`${id}: put back exactly where it stood, nothing charged`, same && (await tokens()) === tb, same ? before.replace(/"deck":\[[^\]]*\],?/, '').slice(0, 110) : `before ${before.slice(0, 160)} / after ${again.slice(0, 160)}`);
    await page.evaluate(() => window.__pause.resume());
    await sleep(2600);
    await page.evaluate(() => window.__minigame?.lose());
    await sleep(400);
  }

  // ------------------------------------------------ 4b: a spin cut off mid-air
  await playCabinet('slots');
  await sleep(800);
  const t1 = await tokens();
  await page.keyboard.press('Space');
  await sleep(150);
  const spun = await page.evaluate(() => ({ busy: window.__slots.state().busy, t: window.__froggy.state().tokens }));
  await reload();
  await until(() => window.__pause?.paused() === 'Minigame', 12000);
  const t2 = await tokens();
  check('a reload mid-spin hands that spin back: nothing lost, nothing won', spun.busy && spun.t === t1 - 3 && t2 === t1, `${t1} -> ${spun.t} mid-spin (busy ${spun.busy}) -> ${t2} after the reload`);
  await page.evaluate(() => window.__pause.resume());
  await sleep(2600);
  await page.evaluate(() => window.__minigame?.lose());
  await sleep(400);

  // ------------------------------------------------ 5: a room
  await page.evaluate(() => {
    const g = window.__froggy.game();
    for (const s of g.scene.getScenes(true)) s.scene.stop();
  });
  await sleep(250);
  await page.evaluate(() => window.__froggy.game().scene.start('ArcadeAnnex', {}));
  await sleep(2500);
  const stood = await page.evaluate(() => {
    const s = window.__froggy.game().scene.getScene('ArcadeAnnex');
    s.player.setPosition(s.player.x + 30, s.player.y);
    return { x: Math.round(s.player.x), y: Math.round(s.player.y) };
  });
  await sleep(1500);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await reload();
  const inRoom = await until(() => window.__pause?.paused() === 'ArcadeAnnex', 12000);
  const at = await page.evaluate(() => {
    const s = window.__froggy.game().scene.getScene('ArcadeAnnex');
    return { x: Math.round(s.player.x), y: Math.round(s.player.y) };
  });
  check('a reload in a room comes back to that room, paused, where you stood', !!inRoom && Math.abs(at.x - stood.x) <= 2 && Math.abs(at.y - stood.y) <= 2, `${JSON.stringify(stood)} -> ${JSON.stringify(at)} ${(await scenes()).join(',')}`);

  // ------------------------------------------------ 7: a new visit
  const fresh = await browser.newPage();
  await fresh.setViewport({ width: 960, height: 540 });
  await fresh.goto(`${URL}/`, { waitUntil: 'load' });
  await sleep(2500);
  for (let i = 0; i < 20; i++) {
    await fresh.mouse.click(480, 300);
    await sleep(300);
    if (!(await fresh.evaluate(() => window.__froggy.activeScenes().includes('Boot')))) break;
  }
  await sleep(1200);
  const where = await fresh.evaluate(() => window.__froggy.activeScenes());
  check('a fresh visit (a new tab) still starts at the title screen', where.includes('StartScreen'), where.join(','));
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
