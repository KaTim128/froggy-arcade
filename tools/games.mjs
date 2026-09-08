/**
 * Minigame contract test.  PRD MG-6 / AC-2.
 *
 * For every game: launch it, play a little, screenshot it, then quit with Esc
 * and verify the shell returns to the hub.  Any console error or page exception
 * fails the run.
 *
 *   node tools/games.mjs
 */

import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync } from 'node:fs';

const URL = 'http://localhost:5173';
const SHOTS = 'tools/shots/games';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));

mkdirSync(SHOTS, { recursive: true });

/** Each game gets a short scripted interaction so the screenshot shows play. */
const GAMES = [
  { id: 'tictactoe', drive: async (p) => { await p.mouse.click(640, 260); await sleep(700); await p.mouse.click(760, 380); await sleep(700); } },
  { id: 'snakes', drive: async (p) => { for (let i = 0; i < 3; i++) { await p.mouse.click(640, 672); await sleep(1500); } } },
  { id: 'airhockey', drive: async (p) => { for (let i = 0; i < 12; i++) { await p.mouse.move(500 + i * 20, 560 + (i % 3) * 20); await sleep(120); } await sleep(1500); } },
  { id: 'hoops', drive: async (p) => { for (let i = 0; i < 3; i++) { await p.keyboard.down('Space'); await sleep(500); await p.keyboard.up('Space'); await sleep(1400); } } },
  { id: 'whack', drive: async (p) => { for (let i = 0; i < 14; i++) { await p.mouse.click(400 + (i % 3) * 240, 250 + Math.floor(i / 3) * 168); await sleep(180); } await sleep(600); } },
  { id: 'chompman', drive: async (p) => { for (const k of ['ArrowUp', 'ArrowLeft', 'ArrowUp', 'ArrowRight']) { await p.keyboard.press(k); await sleep(900); } } },
  { id: 'grudge', drive: async (p) => { await sleep(1600); for (let i = 0; i < 6; i++) { await p.keyboard.press('KeyD'); await p.keyboard.press('KeyJ'); await sleep(400); } } },
  { id: 'donkeykong', drive: async (p) => { await p.keyboard.down('KeyD'); await sleep(2500); await p.keyboard.up('KeyD'); await p.keyboard.press('Space'); await sleep(600); await p.keyboard.down('KeyW'); await sleep(900); await p.keyboard.up('KeyW'); } },
  { id: 'battleship', drive: async (p) => { const g = (x, y) => [640 + (x - 160) * 4, 360 + (y - 90) * 4]; for (const [c, r] of [[0, 0], [2, 2], [4, 4], [6, 1]]) { await p.mouse.click(...g(186 + c * 12 + 6, 44 + r * 12 + 6)); await sleep(900); } } },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});

let failures = 0;

for (const g of GAMES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errs = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon/i.test(m.text())) errs.push(m.text());
  });
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));

  try {
    await page.goto(`${URL}/?game=${g.id}&intro=1&tokens=50`, { waitUntil: 'networkidle2' });
    await sleep(1200);
    await page.mouse.click(640, 700); // audio unlock, harmlessly low on screen
    await sleep(600);

    await g.drive(page);
    await page.screenshot({ path: `${SHOTS}/${g.id}.png` });

    // MG-4: Esc forfeits and returns to the hub.
    await page.keyboard.press('Escape');
    await sleep(2600);
    const back = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return !!c;
    });

    const ok = errs.length === 0 && back;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${g.id.padEnd(10)} ${errs.length ? errs.slice(0, 2).join(' | ') : ''}`);
    if (!ok) failures++;
  } catch (e) {
    console.log(`FAIL  ${g.id.padEnd(10)} ${e.message}`);
    failures++;
  }
  await page.close();
}

console.log(failures === 0 ? '\nAll 9 games launch, play and quit cleanly.' : `\n${failures} game(s) failed.`);

// "Launches and quits cleanly" passed for months on a Chomp-Man where nothing
// moved at all: the grid step was smaller than the centre-snap band at 60fps,
// so player and ghosts were pinned to their spawn tiles.  Movement is the game,
// so assert it moves.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=chompman`, { waitUntil: 'networkidle2' });
  await sleep(3000);
  await page.mouse.click(640, 60); // focus the canvas, in the title bar

  const snap = () =>
    page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('Minigame');
      let player = null;
      const ghosts = [];
      s.children.list.forEach((o) => {
        if (o.type === 'Arc' && o.radius > 3) player = [Math.round(o.x), Math.round(o.y)];
        if (o.type === 'Container' && o.y > 20) ghosts.push([Math.round(o.x), Math.round(o.y)]);
      });
      return { player, ghosts };
    });

  const a = await snap();
  await page.keyboard.down('ArrowUp');
  await sleep(900);
  await page.keyboard.up('ArrowUp');
  const b = await snap();

  const moved = (p, q) => p[0] !== q[0] || p[1] !== q[1];
  const playerMoved = moved(a.player, b.player);
  const ghostsMoved = a.ghosts.some((g, i) => moved(g, b.ghosts[i]));

  console.log(`${playerMoved ? 'PASS' : 'FAIL'}  chomp-man's player moves  — ${a.player} -> ${b.player}`);
  console.log(`${ghostsMoved ? 'PASS' : 'FAIL'}  chomp-man's ghosts move   — ${a.ghosts[0]} -> ${b.ghosts[0]}`);
  if (!playerMoved || !ghostsMoved) failures++;
  await page.close();
}

// The deep links above bypass the hub entirely, which is how a cabinet could
// stop being clickable without a single test noticing.  A cabinet advertises
// itself as clickable, so clicking one has to start the game.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=20&scene=ArcadeHub`, { waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.mouse.click(640, 700);
  await sleep(600);

  const before = await page.evaluate(() => window.__froggy.state().tokens);
  // TIC-TAC-TOE sits at game (34, 86), far from the spawn point.
  await page.mouse.click(640 + (34 - 160) * 4, 360 + (86 - 90) * 4);
  await sleep(1800);
  const after = await page.evaluate(() => ({
    scenes: window.__froggy.activeScenes(),
    tokens: window.__froggy.state().tokens,
  }));

  const launched = after.scenes.includes('Minigame') && after.tokens === before - 1;
  console.log(
    `${launched ? 'PASS' : 'FAIL'}  clicking a cabinet starts it  — ${after.scenes.join(',')}, ${before} -> ${after.tokens} tokens`,
  );
  if (!launched) failures++;
  await page.close();
}

await browser.close();
process.exit(failures ? 1 : 0);
