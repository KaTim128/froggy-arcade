/**
 * The cabinet's frame, the same for every game: the way out (LEAVE before
 * the play, LEAVE after too, a cabinet's own where it has one), and the
 * other things every game shares (log B4).
 *
 *   node tools/frame.mjs [--url http://localhost:5173]
 */

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const URL = arg('--url', 'http://localhost:5173');
const CHROME = [process.env.CHROME_PATH ?? '', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
if (!CHROME) {
  console.error('No Chrome found.');
  process.exit(2);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
let ran = 0;
const errors = [];
const check = (name, ok, note = '') => {
  ran++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  — ${note}` : ''}`);
  if (!ok) failed++;
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

/** A fresh page with `tokens`, and the cabinet `id` started (its card up). */
const open = async (id, tokens = 100, from = 'ArcadeHub') => {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540 });
  page.on('pageerror', (e) => errors.push(`${id}: ${e.message}`));
  await page.goto(`${URL}/?intro=1&charity=1&tokens=${tokens}&scene=${from}`, { waitUntil: 'load' });
  await sleep(2500);
  await page.evaluate(
    (id, from) => {
      const f = window.__froggy;
      // (seen before: no first-go card forced on top of the choice)
      f.patch({ gamesPlayed: { ...f.state().gamesPlayed, [id]: 3 } });
      const g = f.game();
      for (const s of g.scene.getScenes(true)) s.scene.stop();
      g.scene.start('Minigame', { id, from });
    },
    id,
    from,
  );
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    if (await page.evaluate(() => !!window.__froggy.game().scene.getScene('Minigame')?.card)) break;
  }
  return page;
};
const mg = (page, fn, ...a) => page.evaluate((fn, a) => new Function('s', 'a', fn)(window.__froggy.game().scene.getScene('Minigame'), a), fn, a);
const tokens = (page) => page.evaluate(() => window.__froggy.state().tokens);
/** PLAY on the card: the real start, charged once. */
const play = async (page) => {
  await page.keyboard.press('Space');
  for (let i = 0; i < 20; i++) {
    await sleep(200);
    if (await mg(page, 'return s.started')) break;
  }
  await sleep(500);
};

try {
  // ---- FROG RACE: the bets are not the race
  {
    const page = await open('frograce', 100, 'ArcadeCasino');
    const before = await tokens(page);
    await play(page);
    const paid = await tokens(page);
    // the red amount by the token counter, the size of what was taken
    const floater = await page.evaluate(() => window.__froggy.game().scene.getScene('Minigame').children.list.some((o) => o.text === '-10 TOKENS'));
    check('paying for a play: a red "-10 TOKENS" under the title bar', floater, String(floater));
    const atBets = await mg(page, 'return s.exitLabel()');
    check('frog race: at the bets, the way out is LEAVE', atBets === 'LEAVE', atBets);
    // leave from the pause menu's button, as the player would
    await mg(page, 's.quitGame()');
    await sleep(2500);
    const after = await tokens(page);
    check('and leaving there gives the ticket back', paid === before - 10 && after === before, `${before} -> ${paid} -> ${after}`);
    const result = await page.evaluate(() => window.__froggy.game().scene.getScene('Minigame')?.children?.list?.some((o) => typeof o.text === 'string' && /BREAK EVEN|YOU LEAVE/.test(o.text)) ?? false);
    check('with no result after it (no "break even")', !result, String(result));
    await page.close();
  }
  {
    const page = await open('frograce', 100, 'ArcadeCasino');
    await play(page);
    // pick a frog and go
    await page.evaluate(() => {
      const r = window.__race;
      r?.choose?.(0);
      r?.start?.();
    });
    await sleep(800);
    const racing = await mg(page, 'return { label: s.exitLabel(), inPlay: s.inPlay() }');
    check('frog race: once the race is on, the pause menu still says LEAVE (user: LEAVE leaves, BACK goes back)', racing.label === 'LEAVE' && racing.inPlay, JSON.stringify(racing));
    await page.close();
  }
  // ---- CHAMBER: LEAVE before the first pull, CASH OUT with something on the machine
  {
    const page = await open('roulette', 100, 'ArcadeCasino');
    const before = await tokens(page);
    await play(page);
    const first = await mg(page, 'return s.exitLabel()');
    check('chamber: before the trigger is pulled, LEAVE', first === 'LEAVE', first);
    await mg(page, 's.quitGame()');
    await sleep(2500);
    check('and leaving then costs nothing', (await tokens(page)) === before, `${before} -> ${await tokens(page)}`);
    await page.close();
  }
  {
    const page = await open('roulette', 100, 'ArcadeCasino');
    await play(page);
    // a clean pull: stop it, and pull with the live one out of the way
    const pulled = await page.evaluate(async () => {
      const c = window.__chamber;
      if (!c) return 'no bridge';
      c.rig('clean');
      c.stop?.();
      await new Promise((r) => setTimeout(r, 2500));
      c.pull?.();
      await new Promise((r) => setTimeout(r, 2500));
      return 'ok';
    });
    const label = await mg(page, 'return s.exitLabel()');
    check('chamber: after a clean pull, with tokens on the machine, the way out is CASH OUT', label === 'CASH OUT', `${label} (${pulled})`);
    await page.close();
  }
  // ---- ANOTHER TAB AND BACK: mid-game, the settings open and the game paused;
  // outside a game, nothing
  const tabAway = (page) =>
    page.evaluate(async () => {
      const set = (v) => Object.defineProperty(document, 'hidden', { value: v, configurable: true });
      set(true);
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 400));
      set(false);
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 500));
      const f = window.__froggy;
      return { settings: f.activeScenes().includes('SettingsModal'), scenes: f.activeScenes() };
    });
  {
    const page = await open('frogcross', 100, 'ArcadeHub');
    await play(page);
    const r = await tabAway(page);
    check('a tab away mid-game, and back: the settings are open, the game paused', r.settings, r.scenes.join(','));
    await page.close();
  }
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 540 });
    await page.goto(`${URL}/?intro=1&charity=1&scene=ArcadeHub`, { waitUntil: 'load' });
    await sleep(3000);
    const r = await tabAway(page);
    check('a tab away walking round the arcade: nothing opens', !r.settings, r.scenes.join(','));
    await page.close();
  }

  // ---- INVENTORY: a key of its own in CONTROLS, G by default, and it can be moved
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 540 });
    page.on('pageerror', (e) => errors.push(`keys: ${e.message}`));
    await page.goto(`${URL}/?intro=1&charity=1&scene=ArcadeHub`, { waitUntil: 'load' });
    await sleep(3000);
    const inv = () => page.evaluate(() => window.__froggy.activeScenes().includes('InventoryModal'));
    const listed = await page.evaluate(async () => {
      const k = await import('/src/core/keymap.ts');
      return k.KEY_ACTIONS.some((a) => a.id === 'inventory' && a.code === 'KeyG');
    });
    check('controls list INVENTORY, on G', listed);
    await page.keyboard.press('KeyG');
    await sleep(600);
    const byG = await inv();
    check('G opens the inventory', byG);
    const active = () => page.evaluate(() => window.__froggy.activeScenes());
    // back to just the room, whatever Esc did on the way
    for (let i = 0; i < 4 && (await active()).some((k) => k !== 'ArcadeHub'); i++) {
      await page.keyboard.press('Escape');
      await sleep(700);
    }
    // (moved the way the player moves it: the pause menu's CONTROLS, the key
    // clicked, the new one pressed -- the game's own keymap, not a copy of it)
    await page.keyboard.press('Escape');
    await sleep(700);
    await page.evaluate(() => window.__froggy.game().scene.getScene('SettingsModal').listen('inventory'));
    await sleep(150);
    await page.keyboard.press('KeyI');
    await sleep(300);
    for (let i = 0; i < 4 && (await active()).some((k) => k !== 'ArcadeHub'); i++) {
      await page.keyboard.press('Escape');
      await sleep(700);
    }
    await page.keyboard.press('KeyG');
    await sleep(600);
    const gNow = await inv();
    if (gNow) {
      await page.keyboard.press('Escape');
      await sleep(600);
    }
    await page.keyboard.press('KeyI');
    await sleep(600);
    const byI = await inv();
    check('moved to I: I opens it, G no longer does', byI && !gNow, `I ${byI}, G ${gNow}`);
    await page.evaluate(() => localStorage.removeItem('froggy.keymap.v1'));
    await page.close();
  }

  // ---- CASH SPENT: the red amount by the cash
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 540 });
    page.on('pageerror', (e) => errors.push(`cash: ${e.message}`));
    await page.goto(`${URL}/?intro=1&charity=1&scene=ExteriorDay`, { waitUntil: 'load' });
    await sleep(3500);
    const shown = await page.evaluate(async () => {
      const f = window.__froggy;
      f.patch({ cash: 50 });
      await new Promise((r) => setTimeout(r, 300));
      f.patch({ cash: 38 });
      await new Promise((r) => setTimeout(r, 150));
      return f.activeScenes().some((k) => f.game().scene.getScene(k).children?.list?.some((o) => o.text === '-12'));
    });
    check('spending cash: a red "-12" by the cash', shown, String(shown));
    await page.close();
  }
} catch (e) {
  console.error(e);
  failed++;
} finally {
  await browser.close();
}
if (errors.length) console.log('page errors:', errors.slice(0, 5).join('; '));
console.log(`\n${ran - failed}/${ran} passed`);
process.exit(failed || errors.length ? 1 : 0);
