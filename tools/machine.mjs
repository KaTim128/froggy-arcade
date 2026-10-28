/**
 * THE MACHINE'S SCREEN BEFORE EVERY GO (log #49b, #50, #70, #79, #84).
 *
 *   1. every cabinet puts its screen up first, however the go was started --
 *      Barrel Climb included -- with PLAY - N TOKENS, TUTORIAL, CONTROLS,
 *      LEAVE, and PRACTICE where it has one
 *   2. the first go opens on HOW TO PLAY; later goes on the machine
 *   3. every cabinet keeps a best: the screen says it, or that none is set
 *   4. PLAY charges once; PRACTICE charges nothing; LEAVE charges nothing
 *   5. Esc goes back from HOW TO PLAY to the machine, and from there leaves
 *   6. CONTROLS: Grudge's own J moved to U strikes on U in Grudge only, a
 *      shared key cannot take it, and RESET KEYS puts it back
 *
 *   node tools/machine.mjs
 */

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const URL = process.env.URL ?? 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = [process.env.CHROME_PATH ?? '', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};

const GAMES = ['tictactoe', 'hoops', 'whack', 'bowling', 'battleship', 'grudge', 'donkeykong', 'airhockey', 'fallingblocks', 'danceoff', 'frogcross', 'carchase', 'frogvslizard', 'bogball', 'slots', 'roulette', 'frograce', 'frogstermash', 'blackjack', 'wheel'];

const page = await browser.newPage();
await page.setViewport({ width: 960, height: 540 });
await page.goto(`${URL}/?intro=1&charity=1&tokens=200&scene=ArcadeHub`, { waitUntil: 'load' });
await sleep(2500);

/** Open a cabinet the way E at it does (straight), with it played `played` times before. */
const open = async (id, played) => {
  await page.evaluate(
    (id, played) => {
      const f = window.__froggy;
      f.patch({ gamesPlayed: { ...f.state().gamesPlayed, [id]: played } });
      const g = f.game();
      for (const s of g.scene.getScenes(true)) s.scene.stop();
    },
    id,
    played,
  );
  // (stopped first and started a moment later: in the same breath, the
  // second start of a scene that is still stopping is lost)
  await sleep(250);
  await page.evaluate((id) => window.__froggy.game().scene.start('Minigame', { id, from: 'ArcadeHub', straight: true }), id);
  // (till the card is up: stopping one go and starting the next takes a moment)
  for (let i = 0; i < 40; i++) {
    await sleep(150);
    const up = await page.evaluate((id) => {
      const sc = window.__froggy.game().scene.getScene('Minigame');
      return sc.sys.isActive() && sc.gameId === id && !!sc.card && sc.children.list.some((o) => o.list && o.input);
    }, id);
    if (up) break;
  }
  await sleep(150);
};
/** What the Minigame scene has on screen: its button labels and its lines. */
const screen = () =>
  page.evaluate(() => {
    const sc = window.__froggy.game().scene.getScene('Minigame');
    const buttons = [];
    const lines = [];
    for (const o of sc.children.list) {
      if (o.list && o.list[1]?.type === 'BitmapText' && o.input) buttons.push(o.list[1].text);
      else if (o.type === 'BitmapText' && o.visible) lines.push(o.text);
    }
    return { buttons, lines, started: sc.started, card: !!sc.card, active: window.__froggy.activeScenes() };
  });
const press = (label) =>
  page.evaluate((label) => {
    const sc = window.__froggy.game().scene.getScene('Minigame');
    const b = sc.children.list.find((o) => o.list && o.list[1]?.type === 'BitmapText' && o.list[1].text === label && o.input);
    if (!b) return false;
    b.emit('pointerdown');
    b.emit('pointerup');
    return true;
  }, label);
const tokens = () => page.evaluate(() => window.__froggy.state().tokens);

try {
  // ------------------------------------------------- 1, 3: every cabinet
  const bad = [];
  const noBest = [];
  for (const id of GAMES) {
    await open(id, 2);
    const s = await screen();
    const want = ['HOW TO PLAY', 'CONTROLS', 'LEAVE'];
    const hasPlay = s.buttons.some((b) => b.startsWith('PLAY'));
    if (!s.card || s.started || !hasPlay || !want.every((w) => s.buttons.includes(w))) bad.push(`${id}: ${s.buttons.join('|')}`);
    if (!s.lines.some((l) => l.startsWith('YOUR BEST') || l.startsWith('NO BEST YET'))) noBest.push(id);
  }
  check(`all ${GAMES.length} cabinets open on their screen, even from E, with PLAY / TUTORIAL / CONTROLS / LEAVE`, bad.length === 0, bad.join('; '));
  check('and every one of them keeps a best (or says none is set yet)', noBest.length === 0, noBest.join(', '));

  await open('grudge', 2);
  let s = await screen();
  check('a cabinet with practice has PRACTICE beside PLAY - N TOKENS', s.buttons.includes('PRACTICE') && s.buttons.includes('PLAY - 10 TOKENS'), s.buttons.join('|'));
  await open('donkeykong', 2);
  s = await screen();
  check('Barrel Climb has its screen and a PLAY or LEAVE choice', s.buttons.includes('PLAY - 10 TOKENS') && s.buttons.includes('LEAVE') && !s.started, s.buttons.join('|'));

  // ------------------------------------------------- 2: the first go
  await open('donkeykong', 0);
  s = await screen();
  check('the first go at a cabinet opens on HOW TO PLAY', s.lines.some((l) => l.startsWith('HOW TO PLAY')) && s.buttons.includes('BACK'), s.lines[0]);

  // ------------------------------------------------- 3: a best that is set
  await page.evaluate(() => localStorage.setItem('froggy.records', JSON.stringify({ grudge: 41.5 })));
  await page.reload({ waitUntil: 'load' });
  await sleep(2500);
  await open('grudge', 2);
  s = await screen();
  check('a best that is set is on the screen', s.lines.some((l) => l.includes('41.5S')), s.lines.find((l) => l.startsWith('YOUR BEST')) ?? '(none)');

  // ------------------------------------------------- 5: Esc
  await press('HOW TO PLAY');
  await sleep(300);
  s = await screen();
  const onHow = s.lines.some((l) => l.startsWith('HOW TO PLAY'));
  await page.keyboard.press('Escape');
  await sleep(400);
  s = await screen();
  const back = s.lines.some((l) => l === 'GRUDGE') && s.buttons.includes('HOW TO PLAY');
  check('TUTORIAL opens HOW TO PLAY, and Esc goes back to the machine', onHow && back && s.active.includes('Minigame'), `${onHow} ${back}`);
  await page.keyboard.press('Escape');
  await sleep(1200);
  s = await screen().catch(() => ({ active: [] }));
  const active = await page.evaluate(() => window.__froggy.activeScenes());
  check('and Esc at the machine is LEAVE', !active.includes('Minigame'), active.join(','));

  // ------------------------------------------------- 4: what moves the tokens
  let t0 = await tokens();
  await open('grudge', 2);
  await press('LEAVE');
  await sleep(1200);
  check('LEAVE takes nothing', (await tokens()) === t0, `${t0} -> ${await tokens()}`);
  await open('grudge', 2);
  t0 = await tokens();
  await press('PRACTICE');
  await sleep(600);
  s = await screen();
  check('PRACTICE starts a free go', s.started && (await tokens()) === t0, `started ${s.started}, ${t0} -> ${await tokens()}`);
  await open('donkeykong', 2);
  t0 = await tokens();
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await press('PLAY - 10 TOKENS');
  await sleep(700);
  s = await screen();
  check('PLAY (SPACE, again, and the button) starts it and charges once', s.started && (await tokens()) === t0 - 10, `${t0} -> ${await tokens()}`);

  // ------------------------------------------------- 6: CONTROLS
  await open('grudge', 2);
  await press('CONTROLS');
  await sleep(300);
  s = await screen();
  check('CONTROLS lists Grudge\'s own keys as keycaps too', ['J', 'K', 'L', 'I', 'A', 'D'].every((k) => s.buttons.includes(k)), s.buttons.join('|'));
  // a shared action cannot take J
  await press('A');
  await sleep(150);
  await page.keyboard.press('KeyJ');
  await sleep(300);
  s = await screen();
  check('a shared key cannot take a key the game reads itself', s.lines.some((l) => l.includes('THIS GAME READS J ITSELF')) && s.buttons.includes('A'), s.lines.find((l) => l.includes('READS')) ?? s.lines.slice(-2).join(' / '));
  // J -> U
  await press('J');
  await sleep(150);
  await page.keyboard.press('KeyU');
  await sleep(300);
  s = await screen();
  check('Grudge\'s HIGH STRIKE moves from J to U', s.buttons.includes('U') && !s.buttons.includes('J'), s.buttons.join('|'));
  // (a real press, through the browser: only trusted ones are translated)
  const realU = async () => {
    await page.evaluate(() => {
      window.__got = [];
      window.__on = (e) => window.__got.push(e.code);
      window.addEventListener('keydown', window.__on);
    });
    await page.keyboard.press('KeyU');
    await sleep(80);
    return page.evaluate(() => {
      window.removeEventListener('keydown', window.__on);
      return window.__got;
    });
  };
  const inGrudge = await realU();
  check('in Grudge, U arrives as J', inGrudge.includes('KeyJ'), inGrudge.join(','));
  await press('BACK');
  await press('LEAVE');
  await sleep(1300);
  const elsewhere = await realU();
  check('and anywhere else U is just U', !elsewhere.includes('KeyJ'), elsewhere.join(','));
  await open('grudge', 2);
  await press('CONTROLS');
  await sleep(200);
  await press('RESET KEYS');
  await sleep(200);
  s = await screen();
  check('RESET KEYS puts J back', s.buttons.includes('J') && !s.buttons.includes('U'), s.buttons.join('|'));

  // ------------------------------------------------- 7: HOW TO PLAY from the pause menu
  await press('BACK');
  await open('donkeykong', 2);
  await page.keyboard.press('Space');
  await sleep(1200);
  await page.keyboard.press('Escape');
  await sleep(800);
  const inPause = (label) =>
    page.evaluate((label) => {
      const sc = window.__froggy.game().scene.getScene('SettingsModal');
      const found = [];
      const walk = (l) =>
        l.forEach((o) => {
          if (o.list) {
            if (o.input && o.list[1]?.text === label) found.push(o);
            walk(o.list);
          }
        });
      walk(sc.children.list);
      if (!found[0]) return false;
      found[0].emit('pointerdown');
      found[0].emit('pointerup');
      return true;
    }, label);
  await inPause('CONTROLS');
  await sleep(250);
  const opened = await inPause('HOW TO PLAY');
  await sleep(250);
  const said = await page.evaluate(() => {
    const out = [];
    const walk = (l) => l.forEach((o) => (o.list ? walk(o.list) : o.text && out.push(o.text)));
    walk(window.__froggy.game().scene.getScene('SettingsModal').children.list);
    return out;
  });
  check('mid-game, the pause menu reopens HOW TO PLAY', opened && said.includes('HOW TO PLAY - BARREL CLIMB') && said.some((l) => l.startsWith('CLIMB TO THE EXIT')), said.slice(0, 6).join(' / '));
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
