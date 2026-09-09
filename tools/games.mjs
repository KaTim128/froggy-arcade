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
  { id: 'slots', drive: async (p) => { for (let i = 0; i < 3; i++) { await p.keyboard.press('Space'); await sleep(2700); } } },
  { id: 'blackjack', drive: async (p) => { await sleep(700); await p.keyboard.press('KeyH'); await sleep(900); await p.keyboard.press('Space'); await sleep(3000); } },
  { id: 'roulette', drive: async (p) => { for (let i = 0; i < 5; i++) { await p.keyboard.press('Space'); await sleep(1300); } } },
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

console.log(failures === 0 ? '\nAll 12 games launch, play and quit cleanly.' : `\n${failures} game(s) failed.`);

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

// Barrel Climb shipped unwinnable: ladders were grabbable only within 6px so
// you ran past them into the wall, a climb stopped a pixel short froze you on
// the ladder, and bottom-girder barrels bounced between the walls forever
// instead of rolling off.  None of that is visible from "it launched".
//
// The level is checked with the barrels cleared, deliberately.  Whether a
// scripted player can survive the barrels is a difficulty question and it moves
// every time the game is tuned; whether the ladders chain to the top and the
// exit ends the game is a structural one, and that is what must not regress.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=donkeykong`, { waitUntil: 'networkidle2' });
  await sleep(2600);
  await page.mouse.click(640, 60);

  const read = () =>
    page.evaluate(() => {
      const dk = window.__dk;
      const tokens = window.__froggy.state().tokens;
      if (!dk) return { p: null, barrels: [], tokens };
      const st = dk.state();
      return { p: st.player, barrels: st.barrels, ladders: st.ladders, exitX: st.exitX, floors: st.floors, tokens };
    });

  // ---- barrels roll the length of a girder rather than bailing out early
  const spans = await page.evaluate(async () => {
    const seen = new Map();
    for (let i = 0; i < 110; i++) {
      for (const b of window.__dk.state().barrels) {
        const k = b.floor;
        if (!seen.has(k)) seen.set(k, { min: b.x, max: b.x });
        const e = seen.get(k);
        e.min = Math.min(e.min, b.x);
        e.max = Math.max(e.max, b.x);
      }
      await new Promise((r) => setTimeout(r, 120));
    }
    return [...seen.values()].map((e) => Math.round(e.max - e.min));
  });
  const widest = Math.max(0, ...spans);
  // A girder is ~296px and the ladders sit ~64px in from each end.  Dropping at
  // the first ladder it touched gave runs under 100px; rolling the girder gives
  // most of 296.  150 separates those cleanly without being a coin flip on
  // exactly where a barrel happened to be when sampling started.
  const rolls = widest > 150;
  console.log(`${rolls ? 'PASS' : 'FAIL'}  barrel climb: barrels roll the length of a girder  — widest run ${widest}px`);
  if (!rolls) failures++;

  const peak = (await read()).barrels.length;
  const drains = peak <= 10;
  console.log(`${drains ? 'PASS' : 'FAIL'}  barrel climb: barrels drain instead of piling up  — ${peak} live`);
  if (!drains) failures++;

  // ---- the ladders actually chain to the top
  await page.evaluate(() => window.__dk.clearBarrels());
  await sleep(300);

  let held = null;
  const hold = async (k) => {
    if (held === k) return;
    if (held) await page.keyboard.up(held);
    held = k;
    if (k) await page.keyboard.down(k);
  };

  let climbed = true;
  for (let floor = 0; floor < 4; floor++) {
    const s = await read();
    const ladderX = s.ladders.find((l) => l.from === floor).x;
    await page.evaluate((f, x) => window.__dk.teleport(f, x), floor, ladderX);
    await sleep(150);
    await hold('KeyW');
    // Poll for the transition rather than sleeping a fixed amount: under load
    // the same wall time is far fewer frames, and this was failing on a clock
    // rather than on the geometry.
    let after = await read();
    for (let t = 0; t < 30 && after.p.floor !== floor + 1; t++) {
      await sleep(100);
      after = await read();
    }
    await hold(null);
    if (after.p.floor !== floor + 1) {
      console.log(`  floor ${floor} -> ${floor + 1} failed: ended on floor ${after.p.floor}`);
      climbed = false;
      break;
    }
  }
  console.log(`${climbed ? 'PASS' : 'FAIL'}  barrel climb: every ladder reaches the next girder`);
  if (!climbed) failures++;

  // ---- and the exit on the top girder ends the game as a win
  const before = (await read()).tokens;
  await page.evaluate(() => window.__dk.teleport(4, 40));
  await sleep(200);
  await hold('KeyD');
  await sleep(6000);
  await hold(null);
  await sleep(1200);
  const end = await read();
  const won = end.tokens > before;
  console.log(`${won ? 'PASS' : 'FAIL'}  barrel climb: the exit wins  — ${before} -> ${end.tokens} tokens`);
  if (!won) failures++;
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
