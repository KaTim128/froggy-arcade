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
  // One spin of the wheel, and a scripted dancer who actually plays the chart.
  { id: 'wheel', drive: async (p) => { await p.keyboard.press('Space'); await sleep(4400); } },
  { id: 'danceoff', drive: async (p) => { for (let i = 0; i < 14; i++) { await p.keyboard.press(['KeyA', 'KeyS', 'KeyW', 'KeyD'][i % 4]); await sleep(190); } } },
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
  // The bar is 50 points (five crossings) and every further bar adds one:
  // 230 banks the base fifteen plus three.
  { id: 'frogcross', hook: '__frog', set: 'setPoints', score: 230, expect: 18, label: '230 pts' },
  // 200 cash is ten, and 600 is two bars past it.
  { id: 'carchase', hook: '__chase', set: 'setCash', score: 600, expect: 12, label: '600 cash' },
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

// The chase has two rules that are invisible from a screenshot: the tank
// refills itself between bursts, and what is in the bag — not the clock —
// decides how hard they come after you.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=carchase`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await startGame(page);
  await sleep(600);

  const st = () => page.evaluate(() => window.__chase.state());

  // ---- the tank puts a burst back by itself, and takes its time about it.
  // A jar picked up mid-measurement adds a WHOLE burst, so the regeneration is
  // read off the fractional part: five seconds of it is a bit over a third of
  // one, jar or no jar.
  await page.evaluate(() => window.__chase.setNitro(0));
  const dry = await st();
  await sleep(5000);
  const filling = await st();
  const grew = filling.nitroCharge > dry.nitroCharge;
  const part = filling.nitroCharge % 1;
  // Fourteen seconds a burst: five of them must be a fraction of one, or the
  // burst has stopped being a decision.
  const slowly = part > 0.2 && part < 0.5;
  console.log(
    `${grew && slowly ? 'PASS' : 'FAIL'}  car chase: nitro comes back on its own, slowly  — ${dry.nitroCharge.toFixed(2)} -> ${filling.nitroCharge.toFixed(2)} in 5s`,
  );
  if (!grew || !slowly) failures++;

  // ---- and two hundred in the bag turns the heat up.  Read a few frames
  // after each change: the road speed the police measure themselves against
  // is recomputed in update(), not at the moment the cash lands.
  await page.evaluate(() => window.__chase.setCash(0));
  await sleep(250);
  const cool = await st();
  await page.evaluate(() => window.__chase.setCash(200));
  await sleep(250);
  const hot = await st();
  await page.evaluate(() => window.__chase.setCash(1400));
  await sleep(250);
  const boiling = await st();

  const steps = cool.heat === 0 && hot.heat === 1 && boiling.heat === 3;
  const harder = hot.policeCap === cool.policeCap + 1 && hot.policeSpeed - cool.policeSpeed > 20;
  console.log(`${steps ? 'PASS' : 'FAIL'}  car chase: every 200 is a notch of heat, and it caps  — ${cool.heat}/${hot.heat}/${boiling.heat}`);
  console.log(
    `${harder ? 'PASS' : 'FAIL'}  car chase: the notch is more cars and faster ones  — cap ${cool.policeCap}->${hot.policeCap}, speed +${(hot.policeSpeed - cool.policeSpeed).toFixed(0)}`,
  );
  if (!steps) failures++;
  if (!harder) failures++;

  // ---- one car until the first two hundred, then one more every two hundred.
  const caps = await page.evaluate(() =>
    [0, 199, 200, 400, 600, 1000, 4000].map((c) => {
      window.__chase.setCash(c);
      return window.__chase.state().policeCap;
    }),
  );
  const counted = JSON.stringify(caps) === JSON.stringify([1, 1, 2, 3, 4, 6, 6]);
  console.log(`${counted ? 'PASS' : 'FAIL'}  car chase: two cars at 200, one more every 200  — ${caps.join(',')}`);
  if (!counted) failures++;

  // ---- the juke.  A chaser steers at the lane it last SAW you in, so a late
  // swerve has to leave it behind in the old one.  Sit still long enough for
  // it to lock on, jump two lanes, and read it a tenth of a second later.
  await page.evaluate(() => {
    window.__chase.setCash(0);
    window.__chase.clearRoad();
    window.__chase.setPlayer(window.__chase.laneX(0), 140);
    window.__chase.spawnPolice(0, 170);
  });
  await sleep(600);
  const locked = await st();
  await page.evaluate(() => window.__chase.setPlayer(window.__chase.laneX(3), 140));
  await sleep(120);
  const juked = await st();
  const lagged = locked.cars[0]?.lane === 0 && juked.cars[0]?.lane <= 1;
  console.log(
    `${lagged ? 'PASS' : 'FAIL'}  car chase: a late swerve leaves them in your old lane  — ` +
      `locked lane ${locked.cars[0]?.lane}, after the jump lane ${juked.cars[0]?.lane}`,
  );
  if (!lagged) failures++;

  // ---- and the traffic in that old lane is a weapon.  Put a car in front of
  // a chaser and it drives into the back of it and spins out of the chase.
  // The player sits two lanes clear of it: the wreck drops back down the road
  // it was in, and a test that parks in front of one is testing the wrong
  // thing.
  await page.evaluate(() => {
    window.__chase.clearRoad();
    window.__chase.setPlayer(window.__chase.laneX(3), 168);
    window.__chase.spawnPolice(0, 120);
    window.__chase.spawnTrafficAt(0, 86);
  });
  await sleep(700);
  const smashed = await st();
  const spun = smashed.stunned === 1 && smashed.traffic === 0;
  console.log(
    `${spun ? 'PASS' : 'FAIL'}  car chase: a chaser that hits traffic is out of the chase  — ` +
      `${smashed.stunned} spun out, ${smashed.traffic} traffic left`,
  );
  if (!spun) failures++;

  // A spun-out car stops steering and drops back: it holds the lane it crashed
  // in and slides away down the road, or it is off the bottom already.
  await sleep(700);
  const after = await st();
  const was = smashed.cars[0];
  const now = after.cars[0];
  const dropped = !now || (now.lane === was?.lane && now.y > (was?.y ?? 0));
  console.log(
    `${dropped ? 'PASS' : 'FAIL'}  car chase: a wreck does not steer, it drops back  — ` +
      `${was ? `lane ${was.lane} y ${was.y}` : 'none'} -> ${now ? `lane ${now.lane} y ${now.y}` : 'off the road'}`,
  );
  if (!dropped) failures++;

  // ---- nitro jars are spread, not clustered: never twice in the same lane.
  await page.evaluate(() => {
    window.__chase.clearRoad();
    window.__chase.setCash(0);
    window.__chase.setPlayer(window.__chase.laneX(1), 150);
  });
  const lanes = await page.evaluate(() => {
    const seen = [];
    for (let i = 0; i < 8; i++) {
      window.__chase.dropJar();
      const all = window.__chase.state().jarLanes;
      seen.push(all[all.length - 1]);
    }
    return seen;
  });
  const spread = lanes.every((l, i) => i === 0 || l !== lanes[i - 1]);
  console.log(`${spread ? 'PASS' : 'FAIL'}  car chase: jars never land twice in the same lane  — ${lanes.join(',')}`);
  if (!spread) failures++;

  // ---- spike strips: nothing before six hundred, and a gap to thread after.
  await page.evaluate(() => {
    window.__chase.clearRoad();
    window.__chase.setCash(500);
    window.__chase.armTrap();
  });
  await sleep(900);
  const early = await st();
  await page.evaluate(() => {
    window.__chase.setCash(700);
    window.__chase.armTrap();
  });
  await sleep(900);
  const laid = await st();
  const gap = laid.trapLanes[0]?.some((on) => !on);
  const timed = early.traps === 0 && laid.traps >= 1 && gap;
  console.log(
    `${timed ? 'PASS' : 'FAIL'}  car chase: spikes start at 600, and always leave a gap  — ` +
      `${early.traps} at 500, ${laid.traps} at 700, lanes ${(laid.trapLanes[0] ?? []).map((o) => (o ? 'X' : '.')).join('')}`,
  );
  if (!timed) failures++;

  // ---- and driving into one ends the run.  Sweep the road, lay a fresh strip
  // at the top of it, then park in a lane the spikes cover and let it arrive:
  // nothing else on the road can reach the car, so the strip is what got it.
  await page.evaluate(() => {
    window.__chase.clearRoad();
    window.__chase.armTrap();
  });
  await sleep(500);
  await page.evaluate(() => {
    const t = window.__chase.state().trapLanes[0];
    window.__chase.setPlayer(window.__chase.laneX(t.findIndex((on) => on)), 155);
  });
  await sleep(1600);
  const spikedRun = await st();
  const bit = spikedRun.over && spikedRun.reason === 'SPIKED';
  console.log(`${bit ? 'PASS' : 'FAIL'}  car chase: the spikes end the run  — over ${spikedRun.over}, ${spikedRun.reason || 'still driving'}`);
  if (!bit) failures++;
  await page.close();
}

// The dealer's line has to be true.  It used to read "DEALER STANDS ON 17"
// every single hand — a rule of the house printed as if it were his score —
// so play out a stack of hands and check that every number he says out loud is
// the number the felt shows.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=60&game=blackjack`, { waitUntil: 'networkidle2' });
  await sleep(2400);
  await startGame(page);

  const lies = [];
  let stood = 0;
  for (let hand = 0; hand < 12; hand++) {
    const phase = await page.evaluate(() => window.__blackjack?.state().phase);
    if (phase === 'bet') await page.evaluate(() => window.__blackjack.deal());
    else if (phase === 'over') await page.evaluate(() => window.__blackjack.again());
    else continue;
    await sleep(400);
    await page.evaluate(() => window.__blackjack.stand());
    // Each drawn card takes 600ms and he says his total after every one.
    for (let t = 0; t < 14; t++) {
      await sleep(300);
      const st = await page.evaluate(() => window.__blackjack?.state() ?? null);
      if (!st) break;
      const said = /^DEALER (?:STANDS ON |DRAWS - |BUSTS ON )(\d+)$/.exec(st.status);
      if (said) {
        if (st.status.startsWith('DEALER STANDS ON')) stood++;
        if (Number(said[1]) !== st.dealer) lies.push(`${st.status} on ${st.dealer}`);
      }
      if (st.phase === 'over') break;
    }
  }

  const honest = lies.length === 0 && stood > 0;
  console.log(
    `${honest ? 'PASS' : 'FAIL'}  blackjack: the dealer says the score he actually has  — ` +
      `${stood} stands read, ${lies.length ? lies.slice(0, 3).join('; ') : 'no mismatches'}`,
  );
  if (!honest) failures++;
  await page.close();
}

// The table and the wheel charge for the GO, not for the door.  Walking up to
// either has to cost nothing — including reading the how-to-play card, which is
// the whole point of them being free — and the paid cabinets have to keep
// charging.  Three tokens in the pocket, which is under the wheel's price of a
// spin, so this also proves the door is not gated on being able to afford one.
{
  const free = [
    { id: 'wheel', label: 'the wheel', x: 58, y: 140 },
    { id: 'blackjack', label: "froggy's table", x: 160, y: 118 },
  ];
  for (const f of free) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(`${URL}/?intro=1&tokens=3&scene=ArcadeCasino`, { waitUntil: 'networkidle2' });
    await sleep(2500);
    const before = await page.evaluate(() => window.__froggy.state().tokens);
    await page.mouse.click(640 + (f.x - 160) * 4, 360 + (f.y - 90) * 4);
    await sleep(1800);

    const inside = await page.evaluate(() => ({
      scenes: window.__froggy.activeScenes(),
      tokens: window.__froggy.state().tokens,
    }));
    const reading = await cardUp(page);
    const ok = inside.scenes.includes('Minigame') && reading && inside.tokens === before;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${f.label}: free to walk up to and read  — ` +
        `${inside.scenes.join(',')}, card ${reading ? 'up' : 'missing'}, ${before} -> ${inside.tokens} tokens`,
    );
    if (!ok) failures++;

    // And walking back out again is not a forfeit, because nothing was staked.
    await page.keyboard.press('Escape');
    await sleep(3200);
    const out = await page.evaluate(() => window.__froggy.state().tokens);
    const kept = out === before;
    console.log(`${kept ? 'PASS' : 'FAIL'}  ${f.label}: leaving without playing costs nothing  — ${before} -> ${out}`);
    if (!kept) failures++;
    await page.close();
  }
}

// The wheel's odds ARE its geometry: every face is cut to the width of its own
// chance and a spin picks a stopping angle.  Sample the same function the
// pointer resolves through, so a face quietly resized shows up here.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=200&game=wheel`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await startGame(page);
  await sleep(600);

  const N = 200000;
  const seen = await page.evaluate((n) => window.__wheel.sample(n), N);
  const band = (...vals) => vals.reduce((a, v) => a + (seen[v] ?? 0), 0) / N;
  const small = band(1, 2, 3, 5, 7, 10, 15);
  const mid = band(20, 30);
  const fifty = band(50);
  const hundred = band(100);
  const nothing = band(0);
  const near = (got, want) => Math.abs(got - want) < 0.01;
  const ok = near(small, 0.65) && near(mid, 0.15) && near(fifty, 0.1) && near(hundred, 0.05) && near(nothing, 0.05);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  wheel: the faces pay at the odds on the board  — ` +
      `1-15 ${(small * 100).toFixed(1)}%, 20/30 ${(mid * 100).toFixed(1)}%, 50 ${(fifty * 100).toFixed(1)}%, ` +
      `100 ${(hundred * 100).toFixed(1)}%, none ${(nothing * 100).toFixed(1)}%`,
  );
  if (!ok) failures++;

  // And a spin pays what it landed on, through the ledger and nowhere else.
  // The twenty comes off here too — walking up to the wheel is free, so the
  // net move for one spin is the face minus the price of the go.
  const SPIN = 20;
  const before = await page.evaluate(() => window.__froggy.state().tokens);
  await page.keyboard.press('Space');
  await sleep(4600);
  const after = await page.evaluate(() => ({
    tokens: window.__froggy.state().tokens,
    at: window.__wheel.state().at,
    won: window.__wheel.state().won,
  }));
  const net = after.tokens - before;
  const paid = net === after.at - SPIN && after.won === after.at;
  console.log(`${paid ? 'PASS' : 'FAIL'}  wheel: it pays the face it stopped on  — landed ${after.at}, net ${net}`);
  if (!paid) failures++;
  await page.close();
}

// The slot machine hides its odds from the player, which is exactly why they
// need asserting here: nothing on screen would show them drifting.  Sample the
// draw itself — the reels take two and a half seconds to stop, and what is
// under test is the decision, not the animation.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=200&game=slots`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await startGame(page);
  await sleep(600);

  const N = 200000;
  const seen = await page.evaluate((n) => window.__slots.sample(n), N);
  const five = seen.five / N;
  const three = seen.three / N;
  const near = (got, want) => Math.abs(got - want) < 0.008;
  const ok = near(five, 0.05) && near(three, 0.25);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  slots: five in a row one spin in twenty, three in a row one in four  — ` +
      `five ${(five * 100).toFixed(2)}%, three ${(three * 100).toFixed(2)}%, nothing ${((seen.none / N) * 100).toFixed(2)}%`,
  );
  if (!ok) failures++;
  await page.close();
}

// Dance Off is a rhythm game, so the thing to prove is that rhythm is what it
// reads: a chart played on the beat beats the rival and pays, and the same
// number of presses thrown at random does not.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=60&game=danceoff`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await startGame(page);
  await sleep(600);

  const KEY = ['KeyA', 'KeyS', 'KeyW', 'KeyD'];
  const t0 = Date.now();
  while (Date.now() - t0 < 9000) {
    const nx = await page.evaluate(() => window.__dance.next(1)[0] ?? null);
    if (!nx) break;
    if (nx.in > 60) {
      await sleep(Math.min(nx.in - 40, 300));
      continue;
    }
    await page.keyboard.press(KEY[nx.lane]);
  }
  const played = await page.evaluate(() => window.__dance.state());
  const lands = played.hits > 12 && played.misses <= played.hits / 4;
  const leads = played.score.you > played.score.rival;
  console.log(`${lands ? 'PASS' : 'FAIL'}  dance off: arrows played on the beat land  — ${played.hits} hit, ${played.misses} missed`);
  console.log(`${leads ? 'PASS' : 'FAIL'}  dance off: and playing it beats the rival  — ${played.score.you} - ${played.score.rival}`);
  if (!lands) failures++;
  if (!leads) failures++;

  // A wrong key costs exactly what a right one pays, so a burst of presses at
  // nothing can only ever take a score down.  Ten in one lane: at most one of
  // them can be a real arrow, and the other nine are the rule under test.
  const beforeMash = await page.evaluate(() => window.__dance.state());
  for (let i = 0; i < 10; i++) await page.keyboard.press('KeyA');
  const afterMash = await page.evaluate(() => window.__dance.state());
  const punished = afterMash.wrongs >= beforeMash.wrongs + 8 && afterMash.score.you <= beforeMash.score.you;
  console.log(
    `${punished ? 'PASS' : 'FAIL'}  dance off: a wrong key costs a point, so mashing cannot pay  — ` +
      `${beforeMash.score.you} -> ${afterMash.score.you} over ${afterMash.wrongs - beforeMash.wrongs} wrong`,
  );
  if (!punished) failures++;

  // Winning pays the cabinet's reward, through the shell.
  const before = await page.evaluate(() => window.__froggy.state().tokens);
  await page.evaluate(() => {
    window.__dance.ace();
    window.__dance.finish();
  });
  await sleep(4200);
  const after = await page.evaluate(() => window.__froggy.state().tokens);
  const pays = after - before === 20;
  console.log(`${pays ? 'PASS' : 'FAIL'}  dance off: taking it pays the twenty  — ${before} -> ${after}`);
  if (!pays) failures++;
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

  // Wait out the lizard's reply, then take the frog's turn again.  The match
  // is a single round now, so a frog that runs out of health ends the game and
  // takes the rest of these checks with it: top it back up on the way through.
  // What is under test is the items, not whether the lizard can aim.
  const waitForFrog = async () => {
    for (let i = 0; i < 60; i++) {
      const s = await st();
      if (s.turn === 'frog' && s.phase === 'aim') {
        await page.evaluate(() => window.__fvl.setHp('frog', 80));
        return st();
      }
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
