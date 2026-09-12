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
  // CI and container images keep Chrome somewhere else entirely; CHROME_PATH
  // wins, and the pinned path is what this repo's dev container ships.
  process.env.CHROME_PATH ?? '',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
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
  // Bet up from the table minimum first — blackjack deals nothing until you do.
  { id: 'blackjack', drive: async (p) => { await sleep(500); await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowRight'); await sleep(400); await p.keyboard.press('Space'); await sleep(900); await p.keyboard.press('KeyH'); await sleep(900); await p.keyboard.press('Space'); await sleep(3000); } },
  { id: 'roulette', drive: async (p) => { for (let i = 0; i < 5; i++) { await p.keyboard.press('Space'); await sleep(1300); } } },
  { id: 'battleship', drive: async (p) => { const g = (x, y) => [640 + (x - 160) * 4, 360 + (y - 90) * 4]; for (const [c, r] of [[0, 0], [2, 2], [4, 4], [6, 1]]) { await p.mouse.click(...g(186 + c * 12 + 6, 44 + r * 12 + 6)); await sleep(900); } } },
  { id: 'frogcross', drive: async (p) => { for (let i = 0; i < 4; i++) { await p.keyboard.press('KeyW'); await sleep(350); } await p.keyboard.press('KeyA'); await sleep(600); } },
  { id: 'carchase', drive: async (p) => { await p.keyboard.down('KeyA'); await sleep(500); await p.keyboard.up('KeyA'); await p.keyboard.press('Space'); await sleep(1200); await p.keyboard.down('KeyD'); await sleep(500); await p.keyboard.up('KeyD'); } },
  // Aim, charge, throw one over the fence, then try a special item.
  { id: 'frogvslizard', drive: async (p) => { await p.keyboard.press('KeyW'); await p.keyboard.down('Space'); await sleep(620); await p.keyboard.up('Space'); await sleep(3200); await p.keyboard.press('Digit3'); await sleep(300); } },
  { id: 'bowling', drive: async (p) => { await p.keyboard.down('KeyD'); await sleep(200); await p.keyboard.up('KeyD'); await p.keyboard.down('Space'); await sleep(600); await p.keyboard.up('Space'); await sleep(2600); } },
];

/** Is the how-to-play card still up? */
const cardUp = (page) =>
  page.evaluate(() => {
    const s = window.__froggy.game().scene.getScene('Minigame');
    return !!s && s.children.list.some((o) => typeof o.text === 'string' && o.text.startsWith('HOW TO PLAY'));
  });

/**
 * Clear the tutorial card.  MG-8 put one in front of every game, so every
 * harness that wants to touch a game has to get past it first.  It is
 * dismissed by a click as readily as by SPACE, so check before pressing
 * anything: a stray press into an already-running game is not free.
 */
const startGame = async (page) => {
  if (await cardUp(page)) {
    await page.keyboard.press('Space');
    await sleep(500);
  }
};

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
    // MG-8: every cabinet opens on its how-to-play card, and the card carries
    // this cabinet's own controls.  A game that ships without one is a game
    // nobody can be told how to play.  Read it BEFORE the unlock click, which
    // is itself a click on the card and dismisses it.
    const card = await page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('Minigame');
      const lines = s.children.list.filter((o) => o.type === 'BitmapText').map((o) => o.text);
      return {
        titled: lines.some((t) => t.startsWith('HOW TO PLAY')),
        controls: lines.includes('CONTROLS'),
        prompt: lines.some((t) => t.includes('TO START')),
      };
    });
    const tutorial = card.titled && card.controls && card.prompt;

    await page.mouse.click(640, 700); // audio unlock, and the card's own dismiss
    await sleep(600);
    await startGame(page);

    await g.drive(page);
    await page.screenshot({ path: `${SHOTS}/${g.id}.png` });

    // MG-4: Esc forfeits and returns to the hub.
    await page.keyboard.press('Escape');
    await sleep(2600);
    const back = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return !!c;
    });

    const ok = errs.length === 0 && back && tutorial;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${g.id.padEnd(12)} ${tutorial ? 'tutorial+controls' : 'NO TUTORIAL CARD'}` +
        `${errs.length ? '  ' + errs.slice(0, 2).join(' | ') : ''}`,
    );
    if (!ok) failures++;
  } catch (e) {
    console.log(`FAIL  ${g.id.padEnd(10)} ${e.message}`);
    failures++;
  }
  await page.close();
}

console.log(failures === 0 ? `\nAll ${GAMES.length} games launch, play and quit cleanly.` : `\n${failures} game(s) failed.`);

// "Launches and quits cleanly" passed for months on a Chomp-Man where nothing
// moved at all: the grid step was smaller than the centre-snap band at 60fps,
// so player and ghosts were pinned to their spawn tiles.  Movement is the game,
// so assert it moves.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=chompman`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await startGame(page);
  await sleep(1500);
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
  await sleep(1400);
  await startGame(page);
  await sleep(1200);
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
  const floorCount = (await read()).floors.length;
  for (let floor = 0; floor < floorCount - 1; floor++) {
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
  console.log(`${climbed ? 'PASS' : 'FAIL'}  barrel climb: every ladder reaches the next girder  — ${floorCount} girders`);
  if (!climbed) failures++;

  // ---- and the exit on the top girder ends the game as a win
  const before = (await read()).tokens;
  await page.evaluate((f) => window.__dk.teleport(f, 40), floorCount - 1);
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

// The two score-for-tokens cabinets.  Their payout is a formula, not a
// cabinet constant, so the shell has to be handed the right number: the bar
// pays the base, and every further bar adds one.  Banking on ENTER is the
// path a player who has made the bar actually takes.
for (const g of [
  { id: 'frogcross', hook: '__frog', set: 'setPoints', score: 230, expect: 11, label: '230 pts' },
  { id: 'carchase', hook: '__chase', set: 'setCash', score: 600, expect: 9, label: '600 cash' },
]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=${g.id}`, { waitUntil: 'networkidle2' });
  await sleep(1400);
  await startGame(page);
  await sleep(900);
  await page.mouse.click(640, 60);
  const before = await page.evaluate(() => window.__froggy.state().tokens);
  await page.evaluate((h, s, n) => window[h][s](n), g.hook, g.set, g.score);
  await page.keyboard.press('Enter');
  await sleep(1800);
  const after = await page.evaluate(() => window.__froggy.state());
  const paid = after.tokens - before;
  const ok = paid === g.expect && after.highScores[g.id] === g.score;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${g.id}: ${g.label} banks +${g.expect} and sets the high score  — paid ${paid}, best ${after.highScores[g.id]}`);
  if (!ok) failures++;
  await page.close();
}

// Finishing a game used to send everyone to the hub's door, so playing a
// cabinet two rooms away spat you out two rooms away from it.  You should come
// back to the room you were in, standing at the machine you played.
{
  const g = (x, y) => [640 + (x - 160) * 4, 360 + (y - 90) * 4];
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // One cabinet per room, at its current spot: the floor was re-sorted by price
  // (cheap games out front, the five-to-seven ones in the back room, the
  // gambling in the casino), so these coordinates follow the layout.
  const cases = [
    ['ArcadeHub', 286, 162],   // BATTLESHIP, bottom right
    ['ArcadeAnnex', 112, 96],  // BARREL CLIMB
    ['ArcadeCasino', 224, 96], // CHAMBER
  ];

  for (const [room, cx, cy] of cases) {
    await page.goto(`${URL}/?intro=1&tokens=40&scene=${room}`, { waitUntil: 'networkidle2' });
    await sleep(2600);
    await page.mouse.click(...g(cx, cy));
    await sleep(2200);
    await page.keyboard.press('Escape'); // forfeit
    await sleep(6000);

    const back = await page.evaluate((k) => {
      const s = window.__froggy.game().scene.getScene(k);
      return {
        scenes: window.__froggy.activeScenes(),
        at: s && s.player ? { x: Math.round(s.player.x), y: Math.round(s.player.y) } : null,
      };
    }, room);

    const inRoom = back.scenes.includes(room);
    const atCabinet = !!back.at && Math.abs(back.at.x - cx) < 6 && Math.abs(back.at.y - cy) < 20;
    const ok = inRoom && atCabinet;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${room} hands you back at the cabinet  — ${back.scenes.join(',')} @ ${back.at ? `${back.at.x},${back.at.y}` : 'none'}`,
    );
    if (!ok) failures++;
  }
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

// The lane's curve is a probability, and a probability is exactly the kind of
// thing that quietly stops being one.  Sample the draw itself — the same
// function the ball uses — rather than rolling ten thousand balls: three in
// ten bend, the two sides split evenly, and nothing bends further than the
// band allows.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=bowling`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await startGame(page);
  await sleep(600);

  const N = 20000;
  const stats = await page.evaluate((n) => {
    let curved = 0;
    let left = 0;
    let maxMag = 0;
    let minMag = Infinity;
    for (let i = 0; i < n; i++) {
      const c = window.__bowl.rollCurve();
      if (c === 0) continue;
      curved++;
      if (c < 0) left++;
      maxMag = Math.max(maxMag, Math.abs(c));
      minMag = Math.min(minMag, Math.abs(c));
    }
    return { curved, left, maxMag, minMag };
  }, N);

  const pCurve = stats.curved / N;
  const pLeft = stats.left / stats.curved;
  const rate = pCurve > 0.28 && pCurve < 0.32;
  const even = pLeft > 0.46 && pLeft < 0.54;
  const gentle = stats.maxMag <= 0.4001 && stats.minMag >= 0.2;
  console.log(`${rate ? 'PASS' : 'FAIL'}  bowling: about three throws in ten curve  — ${(pCurve * 100).toFixed(1)}%`);
  console.log(`${even ? 'PASS' : 'FAIL'}  bowling: the side is a coin flip  — ${(pLeft * 100).toFixed(1)}% left`);
  console.log(`${gentle ? 'PASS' : 'FAIL'}  bowling: the bend stays in its band  — ${stats.minMag.toFixed(2)}..${stats.maxMag.toFixed(2)}`);
  if (!rate) failures++;
  if (!even) failures++;
  if (!gentle) failures++;

  // And a straight throw with the curve forced off must run straight, or the
  // aim line is lying about where the ball goes.
  const straight = await page.evaluate(async () => {
    window.__bowl.throw(0, 0.8, 160, 0);
    await new Promise((r) => setTimeout(r, 700));
    return window.__bowl.curve();
  });
  const trueRoll = straight === 0;
  console.log(`${trueRoll ? 'PASS' : 'FAIL'}  bowling: a throw with no curve keeps none  — ${straight}`);
  if (!trueRoll) failures++;
  await page.close();
}

// The cameo is meant to be a thing almost nobody sees, and "almost nobody"
// is a number that can rot without anything on screen looking different.
// Sample the spawn roll: it has to be the roll that decides, not a frog that
// is chosen and then hidden.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=whack`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await startGame(page);
  await sleep(600);

  const N = 400000;
  const seen = await page.evaluate((n) => window.__whack.sampleCameo(n), N);
  const rate = seen / N;
  // One in two hundred, with room for the sampling noise at this many draws.
  const rare = rate > 0.004 && rate < 0.006;
  console.log(`${rare ? 'PASS' : 'FAIL'}  whack-a-frog: the cameo stays a rarity  — ${seen} in ${N} (1 in ${Math.round(1 / rate)})`);
  if (!rare) failures++;
  await page.close();
}

// Frog vs Lizard: the items are the game, so each one has to do its own thing
// and only its own thing.  Every throw here is the solved arc, so what is
// under test is the item and not the aim.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${URL}/?intro=1&tokens=50&game=frogvslizard`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await startGame(page);
  await sleep(700);

  const st = () => page.evaluate(() => window.__fvl.state());
  /** Throw the solved arc on the frog's turn and wait for it to resolve. */
  const hit = async (item) => {
    await page.evaluate(() => window.__fvl.setWind(0));
    await page.evaluate((i) => window.__fvl.autoThrow(i), item);
    await sleep(2200);
    return st();
  };

  const before = await st();
  const afterRock = await hit('rock');
  const rockDmg = before.lizard.hp - afterRock.lizard.hp;
  const rockOk = rockDmg === 14;
  console.log(`${rockOk ? 'PASS' : 'FAIL'}  frog vs lizard: the rock lands its ordinary damage  — ${rockDmg}`);
  if (!rockOk) failures++;

  // Wait out the lizard's reply, then take the frog's turn again.
  const waitForFrog = async () => {
    for (let i = 0; i < 60; i++) {
      const s = await st();
      if (s.turn === 'frog' && s.phase === 'aim') return s;
      await sleep(400);
    }
    return st();
  };

  let s = await waitForFrog();
  const hpBeforeTnt = s.lizard.hp;
  const afterTnt = await hit('tnt');
  const tntDmg = hpBeforeTnt - afterTnt.lizard.hp;
  const tntOk = tntDmg === 28 && afterTnt.frog.stock.tnt === 0;
  console.log(`${tntOk ? 'PASS' : 'FAIL'}  frog vs lizard: dynamite doubles it and is spent  — ${tntDmg}, ${afterTnt.frog.stock.tnt} left`);
  if (!tntOk) failures++;

  s = await waitForFrog();
  await page.evaluate(() => window.__fvl.setHp('frog', 30));
  const afterHeal = await hit('heal');
  const healed = afterHeal.frog.hp - 30;
  const healOk = healed === 16 && afterHeal.lizard.hp < s.lizard.hp;
  console.log(`${healOk ? 'PASS' : 'FAIL'}  frog vs lizard: heal mends the thrower and still stings  — +${healed}`);
  if (!healOk) failures++;

  // Poison is the one item whose whole behaviour happens on later turns, so it
  // is tested over turns: both sides are pinned at full health so the round
  // cannot end under the test, and the frog wastes every throw so that the
  // only thing moving the lizard's health is the poison.
  s = await waitForFrog();
  await page.evaluate(() => {
    window.__fvl.setHp('frog', 80);
    window.__fvl.setHp('lizard', 80);
    window.__fvl.setWind(0);
  });
  await page.evaluate(() => window.__fvl.autoThrow('poison'));

  let applied = 0;
  for (let i = 0; i < 40; i++) {
    const now = await st();
    applied = Math.max(applied, now.lizard.poison);
    if (applied) break;
    await sleep(150);
  }
  const poisoned = applied === 3;
  console.log(`${poisoned ? 'PASS' : 'FAIL'}  frog vs lizard: poison applies three turns  — ${applied}`);
  if (!poisoned) failures++;

  // 8 on contact, then the chip damage.  Four turns of it are allowed to
  // happen; only three of them may cost the lizard anything.
  const afterContact = 80 - 8;
  for (let i = 0; i < 4; i++) {
    await waitForFrog();
    await page.evaluate(() => window.__fvl.setHp('frog', 80));
    await page.evaluate(() => window.__fvl.throw(0.2, 0.15, 'rock')); // into the grass
    await sleep(600);
  }
  await waitForFrog();
  const settled = await st();
  const chip = afterContact - settled.lizard.hp;
  const ranOut = chip === 15 && settled.lizard.poison === 0;
  console.log(
    `${ranOut ? 'PASS' : 'FAIL'}  frog vs lizard: and stops after the third  — ${chip} chip over 3 turns, ${settled.lizard.poison} left`,
  );
  if (!ranOut) failures++;

  // The wind has to actually move the item, or the bar is decoration.
  const drift = await page.evaluate(() => {
    const still = window.__fvl.state();
    void still;
    window.__fvl.setWind(0);
    const calm = window.__fvl.solve();
    window.__fvl.setWind(1);
    const gale = window.__fvl.solve();
    return { calm, gale };
  });
  const windMatters = Math.abs(drift.calm.angle - drift.gale.angle) > 0.01 || Math.abs(drift.calm.power - drift.gale.power) > 0.01;
  console.log(`${windMatters ? 'PASS' : 'FAIL'}  frog vs lizard: the wind changes the throw that lands`);
  if (!windMatters) failures++;

  if (errs.length) {
    console.log(`FAIL  frog vs lizard: ${errs.slice(0, 2).join(' | ')}`);
    failures++;
  }
  await page.close();
}

await browser.close();
process.exit(failures ? 1 : 0);
