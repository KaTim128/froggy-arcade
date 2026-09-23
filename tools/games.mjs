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
  { id: 'airhockey', drive: async (p) => { for (let i = 0; i < 12; i++) { await p.mouse.move(500 + i * 20, 560 + (i % 3) * 20); await sleep(120); } await sleep(1500); } },
  { id: 'fallingblocks', drive: async (p) => { for (let i = 0; i < 8; i++) { await p.keyboard.press('Space'); await sleep(180); await p.keyboard.down('KeyD'); await sleep(160); await p.keyboard.up('KeyD'); } } },
  { id: 'hoops', drive: async (p) => { for (let i = 0; i < 3; i++) { await p.keyboard.down('Space'); await sleep(500); await p.keyboard.up('Space'); await sleep(1400); } } },
  { id: 'whack', drive: async (p) => { for (let i = 0; i < 14; i++) { await p.mouse.click(400 + (i % 3) * 240, 250 + Math.floor(i / 3) * 168); await sleep(180); } await sleep(600); } },
  // Back one, buy a second ticket, and then catch the race IN it.
  //
  // This used to sit through to the result card, which worked while the race
  // was a fixed twelve seconds.  On the twenty second clock the winner is home
  // at seventeen on average rather than at the cap, so a wait long enough to
  // be sure of the card is also long enough for the card to have gone and the
  // shot came back of the arcade floor.  Twelve seconds is the middle of every
  // race there is, which is a better picture of the game anyway: the field
  // strung out down the track with whatever is going wrong today.
  { id: 'frograce', drive: async (p) => { await p.keyboard.press('Digit3'); await sleep(250); await p.keyboard.press('ArrowUp'); await sleep(250); await p.keyboard.press('Space'); await sleep(31000); } },
  { id: 'grudge', drive: async (p) => { await sleep(1600); for (let i = 0; i < 6; i++) { await p.keyboard.press('KeyD'); await p.keyboard.press('KeyJ'); await sleep(400); } } },
  { id: 'donkeykong', drive: async (p) => { await p.keyboard.down('KeyD'); await sleep(2500); await p.keyboard.up('KeyD'); await p.keyboard.press('Space'); await sleep(600); await p.keyboard.down('KeyW'); await sleep(900); await p.keyboard.up('KeyW'); } },
  { id: 'slots', drive: async (p) => { for (let i = 0; i < 3; i++) { await p.keyboard.press('Space'); await sleep(2700); } } },
  // Bet up from the table minimum first — blackjack deals nothing until you do.
  { id: 'blackjack', drive: async (p) => { await sleep(500); await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowRight'); await sleep(400); await p.keyboard.press('Space'); await sleep(900); await p.keyboard.press('KeyH'); await sleep(900); await p.keyboard.press('Space'); await sleep(3000); } },
  // SPACE stops a turning cylinder and pulls a stopped one, so a cycle is two
  // presses.  Rigged clean, or one pull in five ends the round and the
  // screenshot is of the room the player was sent back to, not of the machine.
  { id: 'roulette', drive: async (p) => { for (let i = 0; i < 3; i++) { await p.evaluate(() => window.__chamber?.rig('clean')); await p.keyboard.press('Space'); await sleep(700); await p.keyboard.press('Space'); await sleep(1400); } } },
  { id: 'battleship', drive: async (p) => { const g = (x, y) => [640 + (x - 160) * 4, 360 + (y - 90) * 4]; for (const [c, r] of [[0, 0], [2, 2], [4, 4], [6, 1]]) { await p.mouse.click(...g(186 + c * 12 + 6, 44 + r * 12 + 6)); await sleep(900); } } },
  { id: 'frogcross', drive: async (p) => { for (let i = 0; i < 4; i++) { await p.keyboard.press('KeyW'); await sleep(350); } await p.keyboard.press('KeyA'); await sleep(600); } },
  { id: 'carchase', drive: async (p) => { await p.keyboard.down('KeyA'); await sleep(500); await p.keyboard.up('KeyA'); await p.keyboard.press('Space'); await sleep(1200); await p.keyboard.down('KeyD'); await sleep(500); await p.keyboard.up('KeyD'); } },
  // Aim, charge, throw one over the fence, then try a special item.
  { id: 'frogvslizard', drive: async (p) => { await p.keyboard.press('KeyW'); await p.keyboard.down('Space'); await sleep(620); await p.keyboard.up('Space'); await sleep(3200); await p.keyboard.press('Digit3'); await sleep(300); } },
  // One spin of the wheel, and a scripted dancer who actually plays the chart.
  { id: 'wheel', drive: async (p) => { await p.keyboard.press('Space'); await sleep(4400); } },
  { id: 'danceoff', drive: async (p) => { for (let i = 0; i < 14; i++) { await p.keyboard.press(['KeyA', 'KeyS', 'KeyW', 'KeyD'][i % 4]); await sleep(190); } } },
  { id: 'bowling', drive: async (p) => { await p.keyboard.down('KeyD'); await sleep(200); await p.keyboard.up('KeyD'); await p.keyboard.down('KeyE'); await sleep(400); await p.keyboard.up('KeyE'); await p.keyboard.down('Space'); await sleep(600); await p.keyboard.up('Space'); await sleep(2600); } },
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

/**
 * Wait for a cabinet's dev bridge to appear.
 *
 * `startGame` presses PLAY; the game's `create()` runs on the next frame and
 * hangs the bridge off `window` at the end of it.  On a loaded machine that
 * can take several frames, and a fixed sleep afterwards is a race the harness
 * loses as a crash rather than as a failed check — which tells you nothing
 * about the game.  Returns false if it never turned up, so a caller can say so.
 */
const bridge = async (page, name, tries = 24) => {
  for (let i = 0; i < tries; i++) {
    if (await page.evaluate((n) => !!window[n], name)) return true;
    await sleep(250);
  }
  return false;
};

/** Wait for a scene to be running (or to have gone), rather than guessing. */
const sceneUp = async (page, key, want = true, tries = 32) => {
  for (let i = 0; i < tries; i++) {
    const on = await page.evaluate((k) => window.__froggy.activeScenes().includes(k), key);
    if (on === want) return true;
    await sleep(250);
  }
  return false;
};

/**
 * Screen coordinates of a named cabinet, ASKED OF THE ROOM rather than copied
 * out of `content.ts`.  Re-spacing the floor to get a machine out of a doorway
 * used to break two checks apiece, in tests that had nothing to do with where
 * the machines stand.
 */
const cabinetAt = async (page, sceneKey, id) =>
  page.evaluate(
    ([key, want]) => {
      const room = window.__froggy.game().scene.getScene(key);
      const cab = room?.cabinets?.find((c) => c.def.id === want);
      return cab ? [640 + (cab.def.x - 160) * 4, 360 + (cab.def.y - 90) * 4] : null;
    },
    [sceneKey, id],
  );

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
    // MG-8: every cabinet opens on its how-to-play card, the card carries this
    // cabinet's own controls, and it says what a go costs before it offers to
    // take it.  A game that ships without one is a game nobody can be told how
    // to play; a card without a price is one that charges by surprise.
    const card = await page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('Minigame');
      // The buttons are containers with their label inside, so the display
      // list has to be walked rather than filtered.
      const lines = [];
      const walk = (list) => {
        for (const o of list) {
          if (typeof o.text === 'string') lines.push(o.text);
          if (o.list) walk(o.list);
        }
      };
      walk(s.children.list);
      return {
        titled: lines.some((t) => t.startsWith('HOW TO PLAY')),
        controls: lines.includes('CONTROLS'),
        play: lines.some((t) => t === 'PLAY' || t === 'CANT PLAY'),
        leave: lines.includes('LEAVE'),
        price: lines.some((t) => t.includes('TO PLAY') || t.includes('A GO')),
      };
    });
    const tutorial = card.titled && card.controls && card.play && card.leave && card.price;

    await page.mouse.click(640, 700); // audio unlock; the card swallows the click
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
      `${ok ? 'PASS' : 'FAIL'}  ${g.id.padEnd(13)} ${tutorial ? 'card: rules, controls, price, play/leave' : `BAD CARD ${JSON.stringify(card)}`}` +
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

// HOOPS now shows the shot before it is taken, and the whole point of that is
// that the arc TELLS THE TRUTH.  Not "an arc is drawn" — that a shot the arc
// calls good actually goes in, and that the prediction leads the moving rim
// rather than aiming at where it currently is.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=hoops`, { waitUntil: 'networkidle2' });
  await sleep(1700);
  await startGame(page);
  await bridge(page, '__hoops');

  // The rim moves, so the prediction has to say where it WILL be.
  const lead = await page.evaluate(() => window.__hoops.predict(0.8));
  const leads = lead.rim !== undefined && lead.t > 0;
  console.log(
    `${leads ? 'PASS' : 'FAIL'}  hoops: the arc leads the moving rim  — ` +
      `lands x${lead.x} at ${lead.t}s, rim ${lead.hoopNow} -> ${lead.rim}`,
  );
  if (!leads) failures++;

  // And a shot it calls good is a shot that scores.  Three of them, because
  // one could be luck and the claim is that the arithmetic is right.
  let honest = 0;
  let tried = 0;
  const live = () => page.evaluate(() => window.__hoops?.state() ?? null);
  for (let i = 0; i < 3; i++) {
    // The round is sixty seconds and three of these plus the checks above can
    // run it out.  A finished round is not a failed shot: start a fresh one
    // and take the attempt there, so all three are real attempts.
    let now = await live();
    if (!now || now.over) {
      await page.goto(`${URL}/?intro=1&tokens=50&game=hoops`, { waitUntil: 'networkidle2' });
      await sleep(1600);
      await startGame(page);
      await sleep(900);
      now = await live();
      if (!now) break;
    }
    const good = await page.evaluate(() => window.__hoops?.findGood() ?? null);
    if (!good) break;
    tried += 1;
    const before = now.makes;
    await page.evaluate((g) => {
      window.__hoops.aimAt(g.aim);
      return window.__hoops.shootAt(g.power);
    }, good);
    await sleep(2400);
    const after = await live();
    if (after && after.makes > before) honest += 1;
  }
  console.log(
    `${honest >= 2 ? 'PASS' : 'FAIL'}  hoops: a shot the arc calls good goes in  — ${honest}/${tried} scored`,
  );
  if (honest < 2) failures++;
  await page.close();
}

// FROG RACE is a betting game, so the thing that matters is that the form is
// REAL: the favourite has to win far more often than a seventh of the time,
// and far less often than always.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=frograce`, { waitUntil: 'networkidle2' });
  await sleep(1700);
  await startGame(page);
  await bridge(page, '__race');

  // TWELVE HUNDRED FIELDS, AND THE BAR SET BY THE FIELD SIZE.
  //
  // The question is whether the form is real: the favourite has to beat a coin
  // toss between the runners by a long way and still lose often.  Both ends of
  // that band move with how many frogs are in the race -- the field has been
  // seven and is four -- so they are computed from the field rather than
  // typed, and the number of colours that have to win is the field itself.
  const field = await page.evaluate(() => window.__race.runners);
  const s = await page.evaluate(() => window.__race.sample(1200));
  const fav = s.favourite;
  // Every colour wins sometimes: no frog on this machine is a dud or a lock.
  const spread = s.wins.filter((n) => n > 0).length;
  // THE BAR MOVES WITH THE RACE'S OWN DESIGN.
  //
  // A race built to be close makes form worth less by construction: the frogs
  // hold a gap on each other, the leader gives up pace for being the leader,
  // and a whole card of effects lands on top.  The favourite takes about 37%
  // against the 25% a coin toss between four would give -- half again as
  // often as chance, which is a real favourite and a card worth reading --
  // where the old strung-out field paid it 48%.  A third above chance is the
  // line between a form card that means something and a decoration.
  const even = 1 / field;
  const fair = fav > even * 1.3 && fav < 0.75 && spread === field;
  console.log(
    `${fair ? 'PASS' : 'FAIL'}  frog race: the favourite wins often, not always  — ` +
      `${(fav * 100).toFixed(0)}% of 1200 against ${(even * 100).toFixed(0)}% for a coin toss, ` +
      `${spread}/${field} colours won at least one`,
  );
  if (!fair) failures++;

  // ---- THE COMEBACK.  A jetpack that fired every race would be a tax on the
  // favourite, and one sized past the clock would be a frog stranded in the
  // middle of the track when the tape goes.  Both are measured on the model
  // the race actually runs.
  const jet = await page.evaluate(() => window.__race.comeback(300));
  const sometimes = jet.lit > 0.1 && jet.lit < 0.55;
  console.log(
    `${sometimes ? 'PASS' : 'FAIL'}  frog race: the jetpack comes out sometimes, not every race  — ` +
      `${(jet.lit * 100).toFixed(0)}% of 300`,
  );
  if (!sometimes) failures++;

  const honest = jet.inTheClock > 0.999 && jet.fromLast > 0.85;
  console.log(
    `${honest ? 'PASS' : 'FAIL'}  frog race: it is lit for the last frog and lands inside the clock  — ` +
      `${(jet.fromLast * 100).toFixed(0)}% from last, ${(jet.inTheClock * 100).toFixed(0)}% inside`,
  );
  if (!honest) failures++;

  // It has to be able to win and able to lose: a comeback that always came
  // back would make the race a formality with a countdown on it.  The floor is
  // low because the field is close now -- the burn is aimed either side of a
  // leader it can genuinely predict, so landing in front is close to a coin
  // flip and a run of tails is not a broken jetpack.
  const race = jet.won > 0.18 && jet.won < 0.85;
  console.log(
    `${race ? 'PASS' : 'FAIL'}  frog race: and it is a finish rather than a formality  — ` +
      `the jetpack takes ${(jet.won * 100).toFixed(0)}% of the races it appears in`,
  );
  if (!race) failures++;

  // And the clock is where it was: thirty seconds, most races home before it.
  const t = await page.evaluate(() => window.__race.timing(200));
  const cap = await page.evaluate(() => window.__race.raceSeconds);
  const clock = t.meanSeconds < cap && t.hitTheCap < 0.25 && jet.meanFiredAt > t.meanSeconds - 4;
  console.log(
    `${clock ? 'PASS' : 'FAIL'}  frog race: the jetpack does not stretch the ${cap} seconds  — ` +
      `mean ${t.meanSeconds.toFixed(1)}s, lit at ${jet.meanFiredAt.toFixed(1)}s, ${(t.hitTheCap * 100).toFixed(0)}% run to the cap`,
  );
  if (!clock) failures++;

  // ---- THE SHAPE OF THE RACE ITSELF.
  //
  // Four promises, and none of them is visible from one race: it lasts about
  // thirty seconds, something happens to EVERY frog and the four guaranteed
  // things are different from each other, they are still together at the line,
  // and whoever leads at two thirds is not the answer.  All four are asked of
  // three hundred whole fields, run on the model the player watches.
  const shape = await page.evaluate(() => window.__race.shape(300));
  const lasts = shape.meanSeconds > 25 && shape.meanSeconds <= cap;
  console.log(
    `${lasts ? 'PASS' : 'FAIL'}  frog race: a race is about thirty seconds  — ` +
      `mean ${shape.meanSeconds.toFixed(1)}s of a ${cap}s cap, ${(shape.hitTheCap * 100).toFixed(0)}% settled on distance`,
  );
  if (!lasts) failures++;

  const fed = shape.everyFrogFed > 0.94 && shape.allDifferent > 0.94;
  console.log(
    `${fed ? 'PASS' : 'FAIL'}  frog race: something happens to every frog, and not the same thing  — ` +
      `${(shape.everyFrogFed * 100).toFixed(0)}% of races feed all four, ` +
      `${(shape.allDifferent * 100).toFixed(0)}% with four different ones, ${shape.meanEffects.toFixed(1)} effects a race`,
  );
  if (!fed) failures++;

  // A tenth of the track between first and last at the line is not a race, it
  // is a procession: the tow rope is there to stop exactly that.
  const close = shape.meanFinishGap < 0.1 * shape.dist;
  console.log(
    `${close ? 'PASS' : 'FAIL'}  frog race: and they are together at the line  — ` +
      `${shape.meanFinishGap.toFixed(0)}px between first and last on a ${shape.dist}px track ` +
      `(${shape.meanGapTwoThirds.toFixed(0)}px at two thirds)`,
  );
  if (!close) failures++;

  // WHAT "UNPREDICTABLE" IS MEASURED BY.
  //
  // Not by the frog in front at two thirds losing: the run-in is deliberately
  // a settled, readable order with daylight between the frogs, so by then the
  // leader IS a strong favourite and that is the point.  What has to be true
  // is that the lead changed hands several times getting there, and that the
  // best card on the sheet still only wins about half its races.
  const churn = shape.leadChanges > 1.5 && shape.leaderHeldOn < 0.85;
  console.log(
    `${churn ? 'PASS' : 'FAIL'}  frog race: the lead changes hands on the way  — ` +
      `${shape.leadChanges.toFixed(1)} changes a race, and the frog in front at two thirds ` +
      `wins ${(shape.leaderHeldOn * 100).toFixed(0)}% of the time`,
  );
  if (!churn) failures++;

  // ---- AND THE SPACING, WHICH IS WHAT THE PLAYER READS.
  //
  // Four frogs on one x is not a close race, it is a tie with four colours in
  // it: there has to be a first, a second, a third and a fourth, and the eye
  // has to be able to tell which is which.  Measured between NEIGHBOURS in the
  // running order, in seconds of running, because a field can be a few pixels
  // end to end with three invisible gaps in it.
  const spaced = shape.meanNeighbourGap > 0.3 && shape.meanNeighbourGap < 0.9;
  console.log(
    `${spaced ? 'PASS' : 'FAIL'}  frog race: and you can see who is second, third and fourth  — ` +
      `${shape.meanNeighbourGap.toFixed(2)}s between neighbours, ` +
      `${(shape.onTopOfEachOther * 100).toFixed(0)}% of the race with a pair inside two pixels`,
  );
  if (!spaced) failures++;

  // A dead heat is the one finish this race is not allowed to have.
  const clean = shape.tooCloseToCall < 0.05 && shape.meanWinMargin > 0.3;
  console.log(
    `${clean ? 'PASS' : 'FAIL'}  frog race: and the winner crosses clear  — ` +
      `by ${shape.meanWinMargin.toFixed(2)}s on average, ` +
      `${(shape.tooCloseToCall * 100).toFixed(1)}% of finishes too close to call`,
  );
  if (!clean) failures++;
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
  await bridge(page, '__dk');
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

// NO COMBINATION OF BARRELS ASKS FOR A JUMP AND A DUCK AT ONCE.
//
// A yellow roller has to be jumped; an orange bouncer at the top of its hop has
// to be walked under, and jumping into one is a death.  Put the two of them
// within a jump of each other and there is no input that answers both — the
// player is hit having done the right thing.  Same for two orange ones out of
// step, one overhead and one on the girder in front of you.
//
// The same pass measures the two things the barrels were reported for: that
// none of them is being slowed down by another one, and that they never pile
// into a group too wide to jump.  Both are properties of a whole run rather
// than of a frame, so they are gathered here rather than given their own
// eighteen seconds.
//
// Its own page, and sampled in chunks: the barrels are what is under test, the
// player is not driving, and a frog standing still runs out of lives in well
// under a minute.  Every frame is looked at, because a bad pair lasts a
// fraction of a second and a poll on a timer walks straight past it.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const tally = { frames: 0, samples: 0, span: 0, worst: null, closest: 1e9, up: 0, slowest: 1, pile: 0 };
  for (let run = 0; run < 3; run++) {
    await page.goto(`${URL}/?intro=1&tokens=50&game=donkeykong`, { waitUntil: 'networkidle2' });
    await sleep(1400);
    await startGame(page);
    if (!(await bridge(page, '__dk'))) break;
    const r = await page.evaluate(async () => {
      const out = {
        span: window.__dk.state().jumpSpan,
        samples: 0,
        frames: 0,
        up: 0,
        closest: 1e9,
        worst: null,
        // The slowest any one barrel ever ran over a girder crossing, as a
        // fraction of the pace it was thrown at, and the widest run of them
        // that were touching at once.
        slowest: 1,
        pile: 0,
      };
      const seen = new Map();
      let last = performance.now();
      const until = performance.now() + 18000;
      while (performance.now() < until && window.__dk) {
        const now = performance.now();
        const dt = (now - last) / 1000;
        last = now;
        const all = window.__dk.state().barrels;
        const bs = all.filter((b) => !b.falling);
        out.samples++;

        // ---- NOBODY IS BRAKING.  Distance over a whole crossing against the
        // pace the barrel was thrown at: measured frame to frame it is the
        // browser's own jitter that gets reported, not the game's.
        for (const bl of all) {
          const was = seen.get(bl.id);
          if (was && !bl.falling && !was.falling && was.floor === bl.floor) {
            was.dist += Math.abs(bl.x - was.x);
            was.time += dt;
          } else if (was && was.time > 0.8) {
            out.slowest = Math.min(out.slowest, was.dist / was.time / bl.speed);
            was.dist = 0;
            was.time = 0;
          }
          seen.set(bl.id, {
            x: bl.x,
            floor: bl.floor,
            falling: bl.falling,
            dist: was?.dist ?? 0,
            time: was?.time ?? 0,
          });
        }

        // ---- AND NOTHING IS PILING UP.  The widest run of barrels each
        // within a barrel of the next: one jump has to clear the lot.
        const byFloor = new Map();
        for (const bl of bs) {
          if (!byFloor.has(bl.floor)) byFloor.set(bl.floor, []);
          byFloor.get(bl.floor).push(bl);
        }
        for (const list of byFloor.values()) {
          list.sort((a, b) => a.x - b.x);
          let from = 0;
          for (let j = 1; j <= list.length; j++) {
            if (j === list.length || list[j].x - list[j - 1].x > 10) {
              out.pile = Math.max(out.pile, list[j - 1].x - list[from].x);
              from = j;
            }
          }
        }
        if (bs.some((b) => b.up)) out.up++;
        let badHere = false;
        for (let i = 0; i < bs.length; i++) {
          for (let j = i + 1; j < bs.length; j++) {
            const a = bs[i];
            const b = bs[j];
            if (a.floor !== b.floor || a.up === b.up) continue;
            const gap = Math.abs(a.x - b.x);
            if (gap >= out.span) continue;
            badHere = true;
            if (gap < out.closest) {
              out.closest = gap;
              out.worst =
                `floor ${a.floor}: ${a.bouncer ? 'pink' : 'orange'} at ${Math.round(a.x)} (lift ` +
                `${a.lift.toFixed(1)}) and ${b.bouncer ? 'pink' : 'orange'} at ${Math.round(b.x)} ` +
                `(lift ${b.lift.toFixed(1)}), ${Math.round(gap)}px apart`;
            }
          }
        }
        if (badHere) out.frames++;
        await new Promise((r) => requestAnimationFrame(r));
      }
      return out;
    });
    tally.samples += r.samples;
    tally.frames += r.frames;
    tally.up += r.up;
    tally.span = r.span;
    tally.slowest = Math.min(tally.slowest, r.slowest);
    tally.pile = Math.max(tally.pile, r.pile);
    if (r.closest < tally.closest) {
      tally.closest = r.closest;
      tally.worst = r.worst;
    }
  }
  const passable = tally.samples > 1000 && tally.frames === 0;
  console.log(
    `${passable ? 'PASS' : 'FAIL'}  barrel climb: no pair of barrels blocks a girder  — ` +
      (tally.frames === 0
        ? `${tally.samples} frames, nothing within ${tally.span}px asking for a jump and a duck at once`
        : `${tally.frames} frames of it; worst ${tally.worst}`),
  );
  if (!passable) failures++;

  // And the bouncer is still a bouncer: the rule that settles it near a roller
  // must not be quietly grounding it for the whole game.
  const lively = tally.up / Math.max(1, tally.samples) > 0.1;
  console.log(
    `${lively ? 'PASS' : 'FAIL'}  barrel climb: and the bouncers still bounce  — ` +
      `one was over your head on ${((tally.up / Math.max(1, tally.samples)) * 100).toFixed(0)}% of frames`,
  );
  if (!lively) failures++;

  // ---- THE PILE-UP, WHICH IS WHAT THE QUEUE USED TO MAKE.
  //
  // Barrels used to give way to the one in front, down to a fifth of their
  // pace, so three of them nose to tail crawled down a girder and sat in the
  // crossing for seconds at a time.  Nothing gives way now -- a barrel that
  // catches another knocks it off the girder -- so both halves of that are
  // testable: every barrel runs at the pace it was thrown at, and no group of
  // them is ever wider than a jump.
  const ownPace = tally.slowest > 0.97;
  console.log(
    `${ownPace ? 'PASS' : 'FAIL'}  barrel climb: no barrel is slowed down by another  — ` +
      `the slowest crossing ran at ${(tally.slowest * 100).toFixed(0)}% of its own pace`,
  );
  if (!ownPace) failures++;

  const clears = tally.pile < tally.span;
  console.log(
    `${clears ? 'PASS' : 'FAIL'}  barrel climb: and a group of them still fits inside one jump  — ` +
      `widest ${tally.pile.toFixed(0)}px against a ${tally.span}px jump`,
  );
  if (!clears) failures++;
  await page.close();
}

// THE BLACK BARREL, AND THE FIRST THROW.
//
// Two separate promises about the climb: it is under way the moment the
// cabinet comes up -- there is no three second grace any more -- and the black
// one with the skull on it does not take a life off you, it takes the run.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=donkeykong`, { waitUntil: 'networkidle2' });
  await sleep(1400);
  await startGame(page);
  if (await bridge(page, '__dk')) {
    const first = await page.evaluate(() => window.__dk.state().barrels.length);
    const thrown = first > 0;
    console.log(
      `${thrown ? 'PASS' : 'FAIL'}  barrel climb: he is already throwing when you arrive  — ` +
        `${first} on the girders at the first read`,
    );
    if (!thrown) failures++;

    // Stand the player somewhere nothing can reach.
    await page.evaluate(() => {
      window.__dk.teleport(0, 20);
      window.__dk.grace(600000);
    });

    // HOW OFTEN A BLACK ONE COMES is a property of the decision behind the
    // throw, so the decision is sampled.  Waiting for one to turn up inside a
    // test's patience is a coin toss: at these odds a thirty second watch
    // misses it about a third of the time, which is a check that reports the
    // game as broken once in every three runs.
    const kinds = await page.evaluate(() => ({
      late: window.__dk.sampleKinds(20000, true),
      early: window.__dk.sampleKinds(5000, false),
      after: window.__dk.deathAfterMs,
    }));
    const rate = kinds.late.death / 20000;
    const mix = rate > 0.09 && rate < 0.16 && kinds.early.death === 0 && kinds.late.hop > 0 && kinds.late.roll > 0;
    console.log(
      `${mix ? 'PASS' : 'FAIL'}  barrel climb: a black one in about eight, and none at the start  — ` +
        `${(rate * 100).toFixed(1)}% of 20000 past the first ${kinds.after / 1000}s, none of 5000 before it`,
    );
    if (!mix) failures++;

    // And one on the girders, thrown on demand so the next check is aimed at
    // the barrel rather than at whatever happened to be rolling.
    const deadly = await page.evaluate(async () => {
      window.__dk.throwNow('death');
      await new Promise((r) => requestAnimationFrame(r));
      return window.__dk.state().barrels.find((b) => b.deadly) ?? null;
    });
    const arrives = !!deadly;
    console.log(
      `${arrives ? 'PASS' : 'FAIL'}  barrel climb: and it is a barrel like the others  — ` +
        (deadly ? `floor ${deadly.floor} at ${deadly.x.toFixed(0)}, rolling at ${deadly.speed.toFixed(0)}` : 'none thrown'),
    );
    if (!arrives) failures++;

    // Walk into it.  Three lives or not, that is the end of the climb.
    const end = await page.evaluate(async () => {
      window.__dk.grace(0);
      const before = window.__dk.state().lives;
      window.__dk.throwNow('death');
      for (let i = 0; i < 1200; i++) {
        const st = window.__dk?.state();
        if (!st) return { before, gone: true };
        const d = st.barrels.find((b) => b.deadly && !b.falling);
        if (d) window.__dk.teleport(d.floor, d.x);
        if (st.lives <= 0) return { before, after: st.lives };
        await new Promise((r) => requestAnimationFrame(r));
      }
      return { before, after: window.__dk?.state().lives, timeout: true };
    });
    const fatal = end.after === 0 && end.before === 3;
    console.log(
      `${fatal ? 'PASS' : 'FAIL'}  barrel climb: touching it ends the run there and then  — ` +
        `${end.before} lives before it, ${end.after} after`,
    );
    if (!fatal) failures++;
  }
  await page.close();
}

// AND THE BARRELS COME FROM HIM.
//
// He stands at the top holding the next one, and when it goes his arms go with
// it -- rather than the barrel appearing beside a frog that never moved.  Read
// off the pose rather than the screen: the throw is four tenths of a second
// and a screenshot is most of that.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=donkeykong`, { waitUntil: 'networkidle2' });
  await sleep(1400);
  await startGame(page);
  if (await bridge(page, '__dk')) {
    await page.evaluate(() => {
      window.__dk.teleport(0, 20);
      window.__dk.grace(600000);
    });
    // Wait out whatever throw was already in flight when the cabinet came up.
    for (let i = 0; i < 40 && (await page.evaluate(() => window.__dk.kong().swing)) > 0.01; i++) await sleep(100);
    const rest = await page.evaluate(() => window.__dk.kong());
    // The pose is applied by the game's own update, so the throw has to be
    // read on a LATER frame than the one that started it: read on the same
    // frame it is all still zero, which is a test of the ordering of two lines
    // rather than of the animation.
    const mid = await page.evaluate(async () => {
      window.__dk.throwNow();
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
      return window.__dk.kong();
    });
    await sleep(700);
    const back = await page.evaluate(() => window.__dk.kong());

    const throws =
      rest.holding &&
      rest.armL === 0 &&
      mid.swing > 0.2 &&
      mid.armL < -0.3 &&
      mid.lean > 0.05 &&
      !mid.holding &&
      back.holding &&
      Math.abs(back.armL) < 0.02;
    console.log(
      `${throws ? 'PASS' : 'FAIL'}  barrel climb: froggy kong throws them, arms and all  — ` +
        `holding, then arms at ${mid.armL.toFixed(2)}/${mid.armR.toFixed(2)} leaning ${mid.lean.toFixed(2)}, then holding the next`,
    );
    if (!throws) failures++;
  }
  await page.close();
}

// The cabinets that hand the shell a number rather than taking the cabinet's
// flat reward.  Banking on ENTER is the path a player who has made the bar
// actually takes.
for (const g of [
  // FROG CROSS IS FLAT NOW: fifty points is the bar and the bar pays twenty,
  // whether you stop there or cross another eighteen times.  230 points is
  // well past it and still pays exactly twenty -- which is the half of this
  // that would go unnoticed if the check only ever measured a run that
  // stopped on the bar itself.
  { id: 'frogcross', hook: '__frog', set: 'setPoints', score: 230, expect: 20, label: '230 pts' },
  // ...and on the bar itself, for the other end of the same rule.
  { id: 'frogcross', hook: '__frog', set: 'setPoints', score: 50, expect: 20, label: '50 pts, on the bar' },
  // 300 cash is twenty -- the cabinet takes ten, and every ten token machine
  // on this floor pays twenty for the win -- and every hundred past the bar is
  // five more: 600 is three hundreds past it, so thirty-five.
  { id: 'carchase', hook: '__chase', set: 'setCash', score: 600, expect: 35, label: '600 cash' },
]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=${g.id}`, { waitUntil: 'networkidle2' });
  await sleep(1400);
  await startGame(page);
  await bridge(page, g.hook);
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
    await sceneUp(page, room);
    await sleep(1200); // the walk-in fade, before the floor takes a click
    await page.mouse.click(...g(cx, cy));
    // Waited for rather than slept through: under load the walk over and the
    // card going up take longer than any fixed guess, and a check that fires
    // early reads the player's SPAWN and calls the room broken.
    await sceneUp(page, 'Minigame');
    await page.keyboard.press('Escape'); // forfeit
    await sceneUp(page, 'Minigame', false);
    await sleep(2500); // the fade back, and the walk to the machine

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
// itself as clickable, so clicking one has to open its card — and opening a
// card has to cost nothing at all.  PLAY is the only thing in the building
// that takes tokens, it takes them once, and a player who cannot cover the
// price is not offered it.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const tokens = () => page.evaluate(() => window.__froggy.state().tokens);
  const scenes = () => page.evaluate(() => window.__froggy.activeScenes().join(','));
  // TIC-TAC-TOE, wherever it is standing today: far from the spawn point, and
  // the card's two buttons are at y 163, either side of the middle.
  const PLAY_Y = 163;
  const PLAY = [640 + (108 - 160) * 4, 360 + (PLAY_Y - 90) * 4];
  const LEAVE = [640 + (212 - 160) * 4, 360 + (PLAY_Y - 90) * 4];

  await page.goto(`${URL}/?intro=1&tokens=20&scene=ArcadeHub`, { waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.mouse.click(640, 700);
  await sleep(600);
  const cabinet = await cabinetAt(page, 'ArcadeHub', 'tictactoe');

  const before = await tokens();
  await page.mouse.click(...cabinet);
  await sleep(1800);
  const atCard = { scenes: await scenes(), tokens: await tokens(), card: await cardUp(page) };
  const opened = atCard.scenes.includes('Minigame') && atCard.card && atCard.tokens === before;
  console.log(
    `${opened ? 'PASS' : 'FAIL'}  clicking a cabinet opens its card, free  — ` +
      `${atCard.scenes}, card ${atCard.card ? 'up' : 'missing'}, ${before} -> ${atCard.tokens} tokens`,
  );
  if (!opened) failures++;

  // LEAVE puts you back on the floor with everything you walked up with.
  await page.mouse.click(...LEAVE);
  await sleep(2600);
  const left = { scenes: await scenes(), tokens: await tokens() };
  const walkedAway = left.scenes.includes('ArcadeHub') && left.tokens === before;
  console.log(`${walkedAway ? 'PASS' : 'FAIL'}  LEAVE costs nothing  — ${left.scenes}, ${before} -> ${left.tokens} tokens`);
  if (!walkedAway) failures++;

  // PLAY charges exactly once, however many times it is hit.
  await page.mouse.click(...cabinet);
  await sleep(1800);
  for (let i = 0; i < 5; i++) {
    await page.mouse.click(...PLAY);
    await sleep(70);
  }
  await sleep(900);
  const played = { scenes: await scenes(), tokens: await tokens(), card: await cardUp(page) };
  const chargedOnce = played.scenes.includes('Minigame') && !played.card && played.tokens === before - 1;
  console.log(
    `${chargedOnce ? 'PASS' : 'FAIL'}  five clicks on PLAY pay for one play  — ${before} -> ${played.tokens} tokens`,
  );
  if (!chargedOnce) failures++;

  // And a pocket that cannot cover the price is told so, and charged nothing.
  await page.goto(`${URL}/?intro=1&tokens=2&game=frograce`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  const brokeBefore = await tokens();
  await page.mouse.click(...PLAY);
  await sleep(900);
  const broke = { tokens: await tokens(), card: await cardUp(page) };
  const refused = broke.card && broke.tokens === brokeBefore;
  console.log(
    `${refused ? 'PASS' : 'FAIL'}  a 10-token cabinet will not start on 2 tokens  — ` +
      `card ${broke.card ? 'still up' : 'gone'}, ${brokeBefore} -> ${broke.tokens} tokens`,
  );
  if (!refused) failures++;
  await page.close();
}

// The counter has a wrong side and the player belongs on the other one.  A
// player who walked straight up the middle of the hub used to end up BEHIND
// it, in the strip between the counter and the prize case.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=20&scene=ArcadeHub`, { waitUntil: 'networkidle2' });
  await sleep(2600);

  const at = () =>
    page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('ArcadeHub');
      return { x: Math.round(s.player.x), y: Math.round(s.player.y) };
    });
  const counter = await page.evaluate(async () => {
    const { COUNTER } = await import('/src/game/content.ts');
    return COUNTER;
  });

  // Straight up the middle, then in from the side along the back wall: the two
  // ways into the strip.
  await page.keyboard.down('KeyW');
  await sleep(3000);
  await page.keyboard.up('KeyW');
  const straightUp = await at();
  await page.keyboard.down('KeyA');
  await sleep(1800);
  await page.keyboard.up('KeyA');
  await page.keyboard.down('KeyW');
  await sleep(1500);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyD');
  await sleep(2500);
  await page.keyboard.up('KeyD');
  const fromTheSide = await at();

  const front = counter.y + counter.h;
  const behind = (p) => p.x > counter.x - 3 && p.x < counter.x + counter.w + 3 && p.y < front;
  const kept = !behind(straightUp) && !behind(fromTheSide);
  console.log(
    `${kept ? 'PASS' : 'FAIL'}  the player cannot get behind the counter  — ` +
      `up: ${straightUp.x},${straightUp.y}; along the wall: ${fromTheSide.x},${fromTheSide.y} (front edge ${front})`,
  );
  if (!kept) failures++;

  await page.close();
}

// The floor is data before it is a room: the reward table is a rule, not a
// habit, and one mistyped number in content.ts is a cabinet that quietly pays
// the wrong thing forever.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=20&scene=ArcadeHub`, { waitUntil: 'networkidle2' });
  await sleep(1800);
  const floor = await page.evaluate(async () => {
    const { CABINETS, STANDARD_REWARD } = await import('/src/game/content.ts');
    return {
      ids: CABINETS.map((c) => c.id),
      table: STANDARD_REWARD,
      rows: CABINETS.map((c) => ({ id: c.id, cost: c.cost, reward: c.reward })),
    };
  });
  // The fixtures that run their own economy and say so on the machine.
  //
  // FROG CROSS CAME OFF THIS LIST and DANCE OFF WENT ON IT.  The crossing used
  // to pay fifteen plus one for every further five crossings, which was a
  // formula; it is a flat twenty on a ten-token cabinet now, which is exactly
  // the standard table, so the table should be checking it.  The dance is the
  // other way round: it pays 20, 35 or 50 depending how far up the ladder you
  // got, and no row of the table says that.  Whack-a-frog joined it for the
  // same reason -- ten or fifteen off a three token cabinet, by score.
  const OWN_RULES = ['slots', 'wheel', 'blackjack', 'roulette', 'danceoff', 'carchase', 'whack'];
  const wrong = floor.rows.filter(
    (r) => !OWN_RULES.includes(r.id) && floor.table[r.cost] !== undefined && r.reward !== floor.table[r.cost],
  );
  console.log(
    `${wrong.length === 0 ? 'PASS' : 'FAIL'}  every normal cabinet pays the standard table  — ` +
      (wrong.length ? wrong.map((r) => `${r.id} ${r.cost}->${r.reward}`).join(', ') : '3/6, 5/10, 7/15 throughout'),
  );
  if (wrong.length) failures++;

  // Two machines have been taken off the floor for good.  A cabinet that comes
  // back by accident — a stray entry, a bad merge — is a game with no module
  // behind it, so it is asserted gone rather than assumed.
  const revived = ['snakes', 'chompman'].filter((id) => floor.ids.includes(id));
  const goneForGood = revived.length === 0;
  console.log(
    `${goneForGood ? 'PASS' : 'FAIL'}  the retired cabinets stay off the floor  — ` +
      `${floor.ids.length} cabinets${revived.length ? `, back: ${revived.join(',')}` : ''}`,
  );
  if (!goneForGood) failures++;
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
  await bridge(page, '__chase');
  // NOTHING ON THE ROAD MAY END THE RUN while the rules that are not about
  // crashing are under test.  Every check below this line — the tank, the
  // heat, the juke, the pickups, the strips being laid — parks the car and reads
  // the state some seconds later, and a traffic car that arrived in the
  // meantime took the scene down with it, deleted `window.__chase` and threw
  // the rest of the block at the wall.  The shield comes off for the one test
  // that is about crashing, at the bottom.
  await page.evaluate(() => window.__chase.shield(true));

  // A RUN THAT ENDED HAS TO READ AS A FAILED CHECK, NOT AS A CRASHED SUITE.
  // The scene deletes the bridge on its way out, so `window.__chase.state()`
  // throws the moment anything on the road gets the car -- and every check
  // below that is asserting "this does not end the run" was reading `.gone`
  // off a state object that never had one.  It has one now, and it means what
  // the block's name for it says: the game is gone.
  const st = async () => (await page.evaluate(() => window.__chase?.state() ?? null)) ?? { gone: true };

  // ---- WHAT IS LYING ON THE ROAD, AND WHAT IT COSTS.  Each is put down in
  // the player's own lane, driven over, and the one number it is supposed to
  // move is read: a pothole takes the speed for a beat, and a slick takes the
  // car itself for three seconds.  NEITHER ENDS THE RUN, which is the half of
  // this that matters -- they are things you pay for, not things you die to.
  const takePickup = async (kind) => {
    // The spawner deliberately puts one as far from the player's lane as it
    // can (see `jarLane`) and jitters it across that lane, so the car has to
    // be moved ONTO its real x -- aiming at the lane centre misses by more
    // than the car is wide, which is the whole point of the jitter.
    const before = await page.evaluate((k) => {
      if (!window.__chase) return { gone: true };
      window.__chase.clearRoad();
      window.__chase.setPlayer(window.__chase.laneX(1), 150);
      window.__chase.dropPickup(k);
      const s = window.__chase.state();
      window.__chase.setPlayer(s.pickupXs[0], 150);
      return window.__chase.state();
    }, kind);
    // And then it comes down the road onto the car on its own.
    for (let i = 0; i < 60; i++) {
      const now = await st();
      if (now.pickups === 0 || now.gone) return { before, after: now };
      await sleep(100);
    }
    return { before, after: await st() };
  };

  // THERE IS NOTHING LEFT OUT THERE WORTH HAVING.  The road used to hand out
  // bananas and Froggy banks; the banks are gone and the tool is bought now,
  // so the only kinds a spawner will produce are the two that hurt.  A pickup
  // that came back would be a reward this game is no longer supposed to have.
  const onTheRoad = await page.evaluate(() => {
    window.__chase.clearRoad();
    const kinds = new Set();
    for (let i = 0; i < 40; i++) {
      window.__chase.dropPickup('pothole');
      window.__chase.dropPickup('oil');
      window.__chase.state().pickupKinds.forEach((k) => kinds.add(k));
    }
    window.__chase.clearRoad();
    return [...kinds].sort();
  });
  const noRewards = JSON.stringify(onTheRoad) === JSON.stringify(['oil', 'pothole']);
  console.log(
    `${noRewards ? 'PASS' : 'FAIL'}  car chase: nothing on the road is worth having  — ` +
      `${onTheRoad.join(',') || 'nothing'}`,
  );
  if (!noRewards) failures++;

  const hitHole = await takePickup('pothole');
  const holeOk = hitHole.after.jolted && !hitHole.after.gone;
  console.log(
    `${holeOk ? 'PASS' : 'FAIL'}  car chase: a pothole costs you the gap, not the run  — ` +
      `${hitHole.after.jolted ? 'jolted' : 'no jolt'}, ${hitHole.after.gone ? 'RUN ENDED' : 'still driving'}`,
  );
  if (!holeOk) failures++;

  // ---- AND THE SLICK TAKES THE CAR, FOR THREE SECONDS, WITHOUT KILLING YOU.
  // Three things at once: it starts, it lasts about three seconds and not four,
  // and the run is still going at the end of it.  The last one is the fairness:
  // a hazard that removes the controls AND ends the run is not a hazard.
  const hitOil = await takePickup('oil');
  const spunUp = hitOil.after.spinning && !hitOil.after.gone;
  console.log(
    `${spunUp ? 'PASS' : 'FAIL'}  car chase: oil takes the car off you, and does not end the run  — ` +
      `${hitOil.after.spinning ? `${hitOil.after.spin}ms of spin` : 'no spin'}, ` +
      `${hitOil.after.gone ? 'RUN ENDED' : 'still driving'}`,
  );
  if (!spunUp) failures++;

  // and it hands the car back.  Watched rather than assumed: a spin that never
  // ends is the same bug as one that never starts, and worse to play.
  const backInControl = await page.evaluate(async () => {
    const t0 = Date.now();
    for (let i = 0; i < 90; i++) {
      if (!window.__chase.state().spinning) return Date.now() - t0;
      await new Promise((r) => setTimeout(r, 60));
    }
    return -1;
  });
  const handedBack = backInControl >= 0 && backInControl < 3400;
  console.log(
    `${handedBack ? 'PASS' : 'FAIL'}  car chase: and it gives the car back after three seconds  — ` +
      (backInControl < 0 ? 'still spinning after 5s' : `back in ${(backInControl / 1000).toFixed(1)}s`),
  );
  if (!handedBack) failures++;

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
    [0, 199, 200, 400, 600, 1000, 1400, 4000].map((c) => {
      window.__chase.setCash(c);
      return window.__chase.state().policeCap;
    }),
  );
  // ...and it keeps climbing to EIGHT rather than stopping at six, so the last
  // third of a long run is not the same road as the middle of it.
  const counted = JSON.stringify(caps) === JSON.stringify([1, 1, 2, 3, 4, 6, 8, 8]);
  console.log(`${counted ? 'PASS' : 'FAIL'}  car chase: two cars at 200, one more every 200, up to eight  — ${caps.join(',')}`);
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

  // ---- the pickups are spread, not clustered: never twice in the same lane.
  await page.evaluate(() => {
    window.__chase.clearRoad();
    window.__chase.setCash(0);
    window.__chase.setPlayer(window.__chase.laneX(1), 150);
  });
  const lanes = await page.evaluate(() => {
    const seen = [];
    for (let i = 0; i < 8; i++) {
      window.__chase.dropPickup('pothole');
      const all = window.__chase.state().pickupLanes;
      seen.push(all[all.length - 1]);
    }
    return seen;
  });
  const spread = lanes.every((l, i) => i === 0 || l !== lanes[i - 1]);
  console.log(`${spread ? 'PASS' : 'FAIL'}  car chase: pickups never land twice in the same lane  — ${lanes.join(',')}`);
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

  // ---- A DROPPED BOMB HAS TO TAKE A CHASER OFF THE ROAD.  It is the only
  // escape the game has left, so one put down in front of a car on the bumper
  // must spin it and buy the quiet — not merely be a noise while the two of
  // them stay exactly where they were.
  await page.evaluate(() => {
    window.__chase.clearRoad();
    // Enough in the bag to afford one, which is now part of what it takes.
    window.__chase.setCash(120);
    window.__chase.setPlayer(window.__chase.laneX(1), 120);
    window.__chase.spawnPolice(1, 150);
  });
  await sleep(700);
  const onTheBumper = await st();
  await page.keyboard.press('Space'); // buy one and put it down behind
  await sleep(1600);
  const afterDrop = await st();
  const bombWorked = onTheBumper.chasing > 0 && afterDrop.chasing === 0 && afterDrop.respite > 8000;
  console.log(
    `${bombWorked ? 'PASS' : 'FAIL'}  car chase: a dropped bomb spins the car on your bumper  — ` +
      `${onTheBumper.chasing} chasing -> ${afterDrop.chasing}, ${Math.round(afterDrop.respite / 100) / 10}s clear`,
  );
  if (!bombWorked) failures++;

  // ---- AND IT IS PAID FOR OUT OF THE SCORE, EVERY TIME.  That is the whole
  // of what makes it a decision rather than an inventory check: thirty off the
  // bag is a token and a half off the payout.  Both halves are asserted — the
  // charge when it can be met, and the refusal when it cannot, because a
  // button that quietly does nothing reads as a broken game.
  const priced = await page.evaluate(() => {
    window.__chase.clearRoad();
    const cost = window.__chase.state().bombCost;
    window.__chase.setCash(cost - 1);
    window.__chase.drop();
    const broke = window.__chase.state();
    window.__chase.setCash(100);
    window.__chase.drop();
    const paid = window.__chase.state();
    return { cost, brokeCash: broke.cash, brokeDrops: broke.drops, paidCash: paid.cash, paidDrops: paid.drops };
  });
  const charged =
    priced.cost === 30 &&
    priced.brokeDrops === 0 &&
    priced.brokeCash === priced.cost - 1 &&
    priced.paidDrops === 1 &&
    priced.paidCash === 100 - priced.cost;
  console.log(
    `${charged ? 'PASS' : 'FAIL'}  car chase: a bomb costs ${priced.cost} cash, and short of it buys nothing  — ` +
      `${priced.cost - 1} -> ${priced.brokeCash} (${priced.brokeDrops} down), 100 -> ${priced.paidCash} (${priced.paidDrops} down)`,
  );
  if (!charged) failures++;

  // ---- CONCRETE NEVER CLOSES THE ROAD.
  //
  // This is the one that can quietly ruin the game.  A barrier takes lanes
  // away, and lanes taken away is exactly how an unwinnable frame happens: the
  // player is in lane 1, the concrete lands in 0, 1 and 2, and the token is
  // gone through no fault of theirs.  So it is asked of the CHOOSER, two
  // hundred times from every lane on the road -- never the lane the player is
  // in, never more than two of the four, and always an open lane next door to
  // where they already are, because a gap three lanes away is not a gap at the
  // speed the road arrives.
  const boxedIn = await page.evaluate(async () => {
    window.__chase.setCash(400);
    let laid = 0;
    for (let i = 0; i < 200; i++) {
      const lane = i % 4;
      window.__chase.clearRoad();
      window.__chase.setPlayer(window.__chase.laneX(lane), 140);
      window.__chase.layBarrier();
      await new Promise((r) => setTimeout(r, 16));
      const blocked = window.__chase.state().barrierLanes;
      if (!blocked.length) continue;
      laid++;
      const open = [0, 1, 2, 3].filter((l) => !blocked.includes(l));
      if (blocked.includes(lane) || blocked.length > 2 || !open.some((l) => Math.abs(l - lane) <= 1)) {
        return { laid, trapped: { lane, blocked } };
      }
    }
    return { laid, trapped: null };
  });
  const roomToGo = boxedIn.laid > 50 && !boxedIn.trapped;
  console.log(
    `${roomToGo ? 'PASS' : 'FAIL'}  car chase: concrete never closes the road on you  — ` +
      (boxedIn.trapped
        ? `in lane ${boxedIn.trapped.lane}, blocked ${boxedIn.trapped.blocked.join('/')}`
        : `${boxedIn.laid} laid, a way past every one`),
  );
  if (!roomToGo) failures++;

  // ---- and it is a wall to them as well.  A chaser locked onto the lane you
  // just left drives into the concrete in it, the same way it drives into the
  // traffic in it.  That is what keeps a barrier a weapon and not just a tax.
  const intoTheWall = await page.evaluate(async () => {
    window.__chase.clearRoad();
    window.__chase.setCash(400);
    window.__chase.setPlayer(window.__chase.laneX(0), 150);
    window.__chase.spawnPolice(3, 120);
    window.__chase.spawnBarrierAt(3, 60);
    const before = window.__chase.state().chasing;
    for (let i = 0; i < 60; i++) {
      const now = window.__chase.state();
      if (now.stunned > 0) return { before, stunned: now.stunned, hit: true };
      await new Promise((r) => setTimeout(r, 80));
    }
    return { before, stunned: window.__chase.state().stunned, hit: false };
  });
  console.log(
    `${intoTheWall.hit ? 'PASS' : 'FAIL'}  car chase: and a chaser drives into it the same way you would  — ` +
      `${intoTheWall.before} chasing, ${intoTheWall.stunned} spun out`,
  );
  if (!intoTheWall.hit) failures++;

  // ---- SOMEBODY IN THE ROAD WALKS, WANDERS, AND ENDS YOU.
  //
  // Three separate things and all three matter.  They have to MOVE, or they
  // are bollards.  They have to change their mind, or they are traffic with a
  // different sprite -- the unpredictability is the entire reason they are a
  // different problem from a car.  And they have to be lethal, or there is no
  // reason to steer around one.
  const crowd = await page.evaluate(async () => {
    window.__chase.clearRoad();
    window.__chase.setCash(600);
    window.__chase.setPlayer(window.__chase.laneX(0), 165);
    // Spawned by the GAME's own spawner, not placed: what is under test is
    // what they do on their own, and a placed one carries a frozen mind.
    for (let i = 0; i < 6; i++) window.__chase.spawnPedAt(150 + i * 9, 24, i % 2 ? 22 : -22, 0);
    const track = [];
    for (let t = 0; t < 16; t++) {
      track.push(window.__chase.state().pedXs.slice());
      await new Promise((r) => setTimeout(r, 80));
    }
    const spans = track[0].map((_, i) => {
      const seen = track.map((row) => row[i]).filter((v) => v !== undefined);
      return seen.length > 1 ? Math.max(...seen) - Math.min(...seen) : 0;
    });
    return { walked: spans.filter((d) => d > 4).length, of: track[0].length };
  });
  const walking = crowd.walked === crowd.of && crowd.of > 0;
  console.log(
    `${walking ? 'PASS' : 'FAIL'}  car chase: the people in the road are walking  — ` +
      `${crowd.walked} of ${crowd.of} moved off their mark`,
  );
  if (!walking) failures++;

  // They think again on their own clock, so watch a crowd long enough for
  // several of those clocks to come round and count the ones that turned.
  const mindChanged = await page.evaluate(async () => {
    window.__chase.clearRoad();
    window.__chase.setCash(600);
    window.__chase.setPlayer(window.__chase.laneX(0), 170);
    let turns = 0;
    const last = new Map();
    for (let round = 0; round < 6; round++) {
      for (let i = 0; i < 4; i++) window.__chase.spawnPed();
      for (let t = 0; t < 22; t++) {
        window.__chase.state().pedXs.forEach((x, i) => {
          const was = last.get(i);
          if (was && was.x !== x) {
            const d = Math.sign(x - was.x);
            if (was.d !== 0 && d !== 0 && d !== was.d) turns++;
            last.set(i, { x, d });
          } else if (!was) last.set(i, { x, d: 0 });
        });
        await new Promise((r) => setTimeout(r, 70));
      }
      last.clear();
    }
    return turns;
  });
  console.log(
    `${mindChanged > 0 ? 'PASS' : 'FAIL'}  car chase: and they change their mind about where they are going  — ` +
      `${mindChanged} turns`,
  );
  if (mindChanged === 0) failures++;

  // ---- THE ROAD DOES NOT ARRIVE FINISHED.  Nothing that is meant to turn up
  // later may be out there at the start, and each one has to be out there by
  // its own number.  A player who dies in the first thirty seconds should have
  // died to traffic, because traffic is all that was on the road.
  const staged = await page.evaluate(() =>
    [0, 100, 150, 349, 350, 499, 500, 900].map((c) => {
      window.__chase.setPeak(0);
      window.__chase.setCash(c);
      return window.__chase.state().stage;
    }),
  );
  const curve = JSON.stringify(staged) === JSON.stringify([0, 0, 1, 1, 2, 2, 3, 3]);
  console.log(
    `${curve ? 'PASS' : 'FAIL'}  car chase: oil at 150, concrete at 350, people at 500  — stages ${staged.join(',')}`,
  );
  if (!curve) failures++;

  // ---- AND SPENDING CANNOT WIND THE ROAD BACK.  A bomb takes thirty out of
  // the bag; if the hazards read the bag, buying one would quietly return the
  // road to an earlier stage and the player could shop their way down to an
  // emptier one.  They read the high-water mark instead.
  const bought = await page.evaluate(() => {
    window.__chase.clearRoad();
    window.__chase.setPeak(0);
    window.__chase.setCash(360);
    const before = window.__chase.state();
    window.__chase.drop();
    window.__chase.drop();
    const after = window.__chase.state();
    return { beforeStage: before.stage, afterStage: after.stage, cash: after.cash, peak: after.peak };
  });
  const heldStage = bought.beforeStage === 2 && bought.afterStage === 2 && bought.cash === 300;
  console.log(
    `${heldStage ? 'PASS' : 'FAIL'}  car chase: and buying bombs does not make the road easier  — ` +
      `stage ${bought.beforeStage} -> ${bought.afterStage} at ${bought.cash} cash, peak ${bought.peak}`,
  );
  if (!heldStage) failures++;

  // ---- and driving into one ends the run.  Sweep the road, lay a fresh strip
  // at the top of it, then park in a lane the spikes cover and let it arrive:
  // nothing else on the road can reach the car, so the strip is what got it.
  await page.evaluate(() => {
    window.__chase.clearRoad();
    // Off it comes: this is the one check that wants the run to end.
    window.__chase.shield(false);
    // The bomb test above swept the road and left the bag where it was;
    // the strips only come out past six hundred.
    window.__chase.setCash(700);
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

// A TIE IS NOT A LOSS.  Every game that can end level hands the entry cost
// straight back, once, through the shell — so this one is measured from the
// hub, where the token is actually taken, rather than from a deep link where
// nothing was ever debited.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=20&scene=ArcadeHub`, { waitUntil: 'networkidle2' });
  await sleep(2500);

  const purse = await page.evaluate(() => window.__froggy.state().tokens);
  // The card is free; PLAY is the charge.
  await page.mouse.click(...(await cabinetAt(page, 'ArcadeHub', 'tictactoe')));
  await sleep(1800);
  await startGame(page);
  await sleep(400);
  const paid = await page.evaluate(() => window.__froggy.state().tokens);
  await bridge(page, '__ttt');
  await page.evaluate(() => window.__ttt.drawGame());
  await sleep(4200);
  const back = await page.evaluate(() => window.__froggy.state().tokens);

  const refunded = paid === purse - 1 && back === purse;
  console.log(
    `${refunded ? 'PASS' : 'FAIL'}  a drawn game hands the token back  — ` +
      `${purse} -> ${paid} on the way in -> ${back} on the way out`,
  );
  if (!refunded) failures++;
  await page.close();
}

// CHAMBER: SPIN, STOP, PULL, and the price is gone the moment you walk up.
//
// The loop is the thing here.  The trigger only works on a stopped cylinder,
// nothing fires on its own when it stops, a clean pull sets the barrel turning
// again by itself, and the pot on the machine is not the player's until they
// cash out.  Both endings are rigged, because one in five is not a thing a
// test can wait for.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // One pull, the long way round: stop the cylinder, wait for it to settle,
  // then press the trigger.  Exactly what a player does.
  const cycle = async (outcome) => {
    await page.evaluate((o) => {
      window.__chamber.rig(o);
      window.__chamber.stop();
    }, outcome);
    for (let i = 0; i < 40; i++) {
      if (await page.evaluate(() => window.__chamber.state().canPull)) break;
      await sleep(60);
    }
    await page.evaluate(() => window.__chamber.pull());
    await sleep(1000);
  };

  // ---- the machine on the way in: five chambers on the face, turning, and
  // the trigger dead until the player stops it.
  await page.goto(`${URL}/?intro=1&tokens=40&game=roulette`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  const purse = await page.evaluate(() => window.__froggy.state().tokens);
  await startGame(page);
  await bridge(page, '__chamber');
  await sleep(400);
  const opened = await page.evaluate(() => window.__chamber.state());
  const paidIn = await page.evaluate(() => window.__froggy.state().tokens);
  const price = await page.evaluate(async () => {
    const { CABINETS } = await import('/src/game/content.ts');
    return CABINETS.find((c) => c.id === 'roulette').cost;
  });
  // WHAT THE CABINET ASKS, NOT WHAT THIS FILE REMEMBERS IT ASKING.  The price
  // was written in here as a literal 20 beside the very number it was reading
  // off the cabinet, so the day the Chamber's price moved to 15 the check
  // failed on the retuning rather than on anything being wrong.  The thing
  // worth asserting is that the door takes the cabinet's own price, once.
  const charged = price > 0 && paidIn === purse - price;
  console.log(
    `${charged ? 'PASS' : 'FAIL'}  chamber: the door takes the cabinet's own price  — ` +
      `${purse} -> ${paidIn}, cabinet asks ${price}`,
  );
  if (!charged) failures++;

  const facing =
    opened.chambers === 5 && opened.dots === 5 && opened.spinning && !opened.canPull && opened.pot === 0;
  console.log(
    `${facing ? 'PASS' : 'FAIL'}  chamber: five chambers on the face, turning, trigger dead  — ` +
      `${opened.dots} of ${opened.chambers}, ${opened.phase}`,
  );
  if (!facing) failures++;

  // ---- THE TRIGGER STAYS DEAD WHILE IT TURNS: pulling a spinning cylinder
  // must do nothing at all.  There is no KEEP SPINNING button any more -- the
  // barrel turns on its own and the only thing the player can do to it is stop
  // it -- so this leans on the cylinder still being in its opening spin.
  await page.evaluate(() => {
    window.__chamber.pull();
  });
  await sleep(500);
  const stillTurning = await page.evaluate(() => window.__chamber.state());
  const refused = stillTurning.spinning && !stillTurning.canPull && stillTurning.survived === 0 && stillTurning.pot === 0;
  console.log(
    `${refused ? 'PASS' : 'FAIL'}  chamber: a spinning cylinder cannot be fired  — ` +
      `${stillTurning.phase}, ${stillTurning.survived} pulls, ${stillTurning.pot} on the machine`,
  );
  if (!refused) failures++;

  // ---- STOP SPINNING settles it onto a chamber, and THEN the trigger works.
  // It must not fire on its own when it stops: nothing is paid until a pull.
  await page.evaluate(() => window.__chamber.stop());
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => window.__chamber.state().canPull)) break;
    await sleep(60);
  }
  const halted = await page.evaluate(() => window.__chamber.state());
  await sleep(700);
  const waited = await page.evaluate(() => window.__chamber.state());
  const patient = halted.canPull && !halted.spinning && waited.survived === 0 && waited.pot === 0 && waited.canPull;
  console.log(
    `${patient ? 'PASS' : 'FAIL'}  chamber: it stops and waits - the trigger is the player's  — ` +
      `${halted.phase}, ${waited.survived} pulls after sitting on it`,
  );
  if (!patient) failures++;

  // ---- and a clean pull pays five and sets the barrel turning again.
  await page.evaluate(() => {
    window.__chamber.rig('clean');
    window.__chamber.pull();
  });
  await sleep(1100);
  const after1 = await page.evaluate(() => window.__chamber.state());
  const cycled = after1.survived === 1 && after1.pot === 5 && after1.spinning && !after1.canPull;
  console.log(
    `${cycled ? 'PASS' : 'FAIL'}  chamber: a clean pull pays five and the barrel spins again  — ` +
      `${after1.pot} on the machine, ${after1.phase}`,
  );
  if (!cycled) failures++;
  await page.close();
}

// And the same machine's books.  Nothing is credited pull by pull, cashing out
// pays the pot once, and the live round takes everything sitting on it.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const cycle = async (outcome) => {
    await page.evaluate((o) => {
      window.__chamber.rig(o);
      window.__chamber.stop();
    }, outcome);
    for (let i = 0; i < 40; i++) {
      if (await page.evaluate(() => window.__chamber.state().canPull)) break;
      await sleep(60);
    }
    await page.evaluate(() => window.__chamber.pull());
    await sleep(1000);
  };

  const run = async (pulls, ending) => {
    await page.goto(`${URL}/?intro=1&tokens=40&game=roulette`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    await startGame(page);
    await bridge(page, '__chamber');
    const before = await page.evaluate(() => window.__froggy.state().tokens);
    for (let i = 0; i < pulls; i++) await cycle('clean');
    if (ending === 'live') {
      await cycle('live');
      await sleep(400);
    } else if (ending === 'walk') {
      // Twice, on purpose.  `finish` latches on `over`, so a player who mashes
      // CASH OUT is paid the pot once and not once per press.
      await page.evaluate(() => {
        window.__chamber.walk();
        window.__chamber.walk();
      });
    }
    const state = await page.evaluate(() => window.__chamber.state());
    await sleep(4200);
    const after = await page.evaluate(() => window.__froggy.state().tokens);
    // And after the round has ended, cashing out again must move nothing.
    const late = await page.evaluate(() => {
      const was = window.__froggy.state().tokens;
      window.__chamber?.walk();
      return window.__froggy.state().tokens - was;
    });
    return { state, banked: after - before, late };
  };

  const one = await run(1, 'walk');
  const ok0 = one.state.survived === 1 && one.banked === 5 && one.late === 0;
  console.log(`${ok0 ? 'PASS' : 'FAIL'}  chamber: one clean pull, cash out, five tokens  — ${one.state.survived} clean, banked ${one.banked}`);
  if (!ok0) failures++;

  const walked = await run(3, 'walk');
  const ok1 = walked.state.survived === 3 && walked.banked === 15 && walked.late === 0;
  console.log(`${ok1 ? 'PASS' : 'FAIL'}  chamber: three clean pulls, cash out once, fifteen  — ${walked.state.survived} clean, banked ${walked.banked}`);
  if (!ok1) failures++;

  const shot = await run(3, 'live');
  const ok2 = shot.state.pot === 0 && shot.banked === 0 && shot.late === 0;
  console.log(`${ok2 ? 'PASS' : 'FAIL'}  chamber: the live round takes the lot  — fifteen on the machine, banked ${shot.banked}`);
  if (!ok2) failures++;

  // There is no cap: the barrel comes back after every clean pull, so a
  // seventh is a thing you can do and it is worth five like all the others.
  const long = await run(7, 'walk');
  const ok3 = long.state.survived === 7 && long.banked === 35 && long.late === 0;
  console.log(`${ok3 ? 'PASS' : 'FAIL'}  chamber: pulls keep coming, five a time  — ${long.state.survived} pulls, banked ${long.banked}`);
  if (!ok3) failures++;
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
  await bridge(page, '__blackjack');

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

// ---- FROGGY'S ACE, WHICH IS THREE RULES AND NOT ONE.
//
// On two cards it is worth one, ten or eleven and the player says which; a
// pair of them is twenty-one on the spot with nothing to decide; and from the
// third card eleven is off the table while one and ten are still a choice.
// All three are arithmetic, so they are asked of the arithmetic -- the hand is
// set directly rather than played into, because playing into a specific hand
// is a test of the shoe.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=60&game=blackjack`, { waitUntil: 'networkidle2' });
  await sleep(2400);
  await startGame(page);
  if (await bridge(page, '__blackjack')) {
    await page.evaluate(() => window.__blackjack.deal());
    await sleep(500);
    const r = await page.evaluate(() => {
      const bj = window.__blackjack;
      const at = (cards) => {
        bj.setHands(cards, ['9♣', '7♦']);
        return bj.state();
      };
      const out = {};
      let st = at(['A♠', '6♥']);
      out.twoChoices = st.aceChoices;
      out.twoTotals = [];
      for (let i = 0; i < 3; i++) {
        const now = bj.state();
        out.twoTotals.push(`${now.aceAs}=${now.player}`);
        bj.flipAce();
      }
      st = at(['A♠', 'A♥']);
      out.pair = { total: st.player, choices: st.aceChoices };
      st = at(['A♠', '6♥', '2♣']);
      out.threeChoices = st.aceChoices;
      // and the forced change when a third card lands on an eleven
      bj.setHands(['A♠', '6♥'], ['9♣', '7♦']);
      while (bj.state().aceAs !== 11) bj.flipAce();
      bj.hit();
      const after = bj.state();
      out.grown = { as: after.aceAs, total: after.player, over: after.player > 21 };
      return out;
    });

    const onTwo = r.twoChoices.join(',') === '1,10,11';
    console.log(
      `${onTwo ? 'PASS' : 'FAIL'}  blackjack: on two cards the ace is 1, 10 or 11  — ` +
        `${r.twoChoices.join('/')}, and A+6 reads ${r.twoTotals.join(' ')}`,
    );
    if (!onTwo) failures++;

    const pair = r.pair.total === 21 && r.pair.choices.length === 0;
    console.log(
      `${pair ? 'PASS' : 'FAIL'}  blackjack: two aces are 21 with nothing to decide  — ` +
        `${r.pair.total}, ${r.pair.choices.length} choices offered`,
    );
    if (!pair) failures++;

    const onThree = r.threeChoices.join(',') === '1,10';
    console.log(
      `${onThree ? 'PASS' : 'FAIL'}  blackjack: from the third card the eleven is gone  — ` +
        `${r.threeChoices.join('/')}`,
    );
    if (!onThree) failures++;

    // An eleven that is no longer on offer must come down to a price that
    // KEEPS THE HAND, not to whichever number happens to be nearest.
    const kind = r.grown.as !== 11 && !r.grown.over;
    console.log(
      `${kind ? 'PASS' : 'FAIL'}  blackjack: and hitting on an eleven does not bust you by arithmetic  — ` +
        `it came down to ${r.grown.as} for ${r.grown.total}`,
    );
    if (!kind) failures++;
  }
  await page.close();
}

// HIS CAMEO IS ONE IN TWO THOUSAND, and that number is the spawn decision
// itself rather than a curtain drawn over a frog that was always there.  The
// roll is sampled instead of the screen: a test that watched the holes could
// not tell a rare guest from a common one that is usually invisible.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=40&game=whack`, { waitUntil: 'networkidle2' });
  await sleep(1600);
  await startGame(page);
  if (await bridge(page, '__whack')) {
    const n = 400000;
    const seen = await page.evaluate((k) => window.__whack.sampleCameo(k), n);
    // Mean 200 on 400k rolls, standard deviation about 14: this band is seven
    // of those either way, so it catches a changed constant and not a run of
    // luck.
    const right = seen > 100 && seen < 320;
    console.log(
      `${right ? 'PASS' : 'FAIL'}  whack a frog: the cameo is one in two thousand  — ` +
        `${seen} in ${n} rolls, which is one in ${Math.round(n / Math.max(1, seen))}`,
    );
    if (!right) failures++;
  }
  await page.close();
}

// The table and the wheel charge for the GO, not for the door: walking up to
// either and reading the card costs nothing, and leaving costs nothing.  They
// are also the two fixtures with a bar at the door — see the broke test above —
// so this is run with enough in the pocket to be let in.
{
  const free = [
    { id: 'wheel', label: 'the wheel', x: 58, y: 140, purse: 60 },
    { id: 'blackjack', label: "froggy's table", x: 160, y: 118, purse: 6 },
  ];
  for (const f of free) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(`${URL}/?intro=1&tokens=${f.purse}&scene=ArcadeCasino`, { waitUntil: 'networkidle2' });
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
// chance and a spin picks an angle, not a prize.  The board beside it no longer
// prints the percentages — which is exactly why they are asserted here, since
// nothing on screen would show them drifting.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=400&game=wheel`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await startGame(page);
  await bridge(page, '__wheel');

  const N = 400000;
  const seen = await page.evaluate((n) => window.__wheel.sample(n), N);
  const share = (v) => (seen[v] ?? 0) / N;

  // WHAT EACH FACE SHOULD COME UP AT IS READ OFF THE WHEEL ITSELF.  The odds
  // are the geometry — every face is cut to the width of its own chance — so
  // the only honest question is whether four hundred thousand spins land in
  // the arcs the table actually cut.  Typing the percentages here instead
  // meant that retuning the wheel, which is a thing somebody is allowed to do,
  // failed as though the wheel were broken.
  const want = await page.evaluate(async () => {
    const { FACES } = await import('/src/minigames/wheel.ts');
    const by = {};
    for (const f of FACES) by[f.pays] = (by[f.pays] ?? 0) + f.share / 100;
    return by;
  });

  // Tolerance scales with the face: a 0.01% sliver cannot be measured to the
  // same absolute precision as a 62% band, and a flat one would either wave
  // the slivers through or fail the wide bands on ordinary sampling noise.
  const off = [];
  for (const [pays, p] of Object.entries(want)) {
    const got = share(Number(pays));
    const tol = Math.max(0.0008, 4 * Math.sqrt((p * (1 - p)) / N));
    if (Math.abs(got - p) > tol) off.push(`${pays} wants ${(p * 100).toFixed(2)}% got ${(got * 100).toFixed(2)}%`);
  }
  // And the table has to describe a whole wheel, not 97% of one.
  const total = Object.values(want).reduce((a, b) => a + b, 0);
  const whole = Math.abs(total - 1) < 1e-6;
  const ok = off.length === 0 && whole;
  const summary = Object.entries(want)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([v]) => `${v}:${(share(Number(v)) * 100).toFixed(2)}%`)
    .join(' ');
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  wheel: every face comes up at the width it was cut  — ` +
      (whole ? summary : `shares total ${(total * 100).toFixed(2)}%`) +
      (off.length ? `; ${off.slice(0, 3).join(', ')}` : ''),
  );
  if (!ok) failures++;

  // And a spin pays what it landed on, ONCE, through the ledger and nowhere
  // else: the net move for one spin is the face minus the price of the go.
  // Off the wheel, not typed here: the price of a go is the machine's to set.
  const SPIN = await page.evaluate(async () => {
    const { SPIN_COST } = await import('/src/minigames/wheel.ts');
    return SPIN_COST;
  });
  const before = await page.evaluate(() => window.__froggy.state().tokens);
  await page.keyboard.press('Space');
  await sleep(4600);
  const after = await page.evaluate(() => ({
    tokens: window.__froggy.state().tokens,
    at: window.__wheel.state().at,
    won: window.__wheel.state().won,
    spins: window.__wheel.state().spins,
  }));
  const net = after.tokens - before;
  const paid = net === after.at - SPIN && after.won === after.at && after.spins === 1;
  console.log(
    `${paid ? 'PASS' : 'FAIL'}  wheel: one spin, one prize  — landed ${after.at}, net ${net}, banked ${after.won}`,
  );
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
  await bridge(page, '__slots');

  const N = 200000;
  const seen = await page.evaluate((n) => window.__slots.sample(n), N);
  // Read the odds off the machine rather than restating them here: the point
  // of the test is that the DRAW matches the constants, not that two copies of
  // the same number agree.
  const want = await page.evaluate(async () => {
    const m = await import('/src/minigames/slots.ts');
    return { five: m.P_FIVE, three: m.P_THREE };
  });
  const five = seen.five / N;
  const three = seen.three / N;
  const near = (got, target) => Math.abs(got - target) < 0.008;
  const ok = near(five, want.five) && near(three, want.three);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  slots: five in a row ${(want.five * 100).toFixed(0)}% of spins, three in a row ${(want.three * 100).toFixed(0)}%  — ` +
      `five ${(five * 100).toFixed(2)}%, three ${(three * 100).toFixed(2)}%, nothing ${((seen.none / N) * 100).toFixed(2)}%`,
  );
  if (!ok) failures++;
  await page.close();
}

// THE TRAFFIC ANNOUNCES ITSELF, AND THE ANNOUNCEMENT IS COUNTED.  A car may
// not move a pixel sideways until its indicator has blinked three whole times,
// and the whole point of the rule is that it is three and not "about three" —
// so catch a car in the act, count the blinks off its own clock, and check it
// was still dead in its lane for every one of them.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=carchase`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await startGame(page);
  await bridge(page, '__chase');
  // Nothing may end the run while we watch the road, and the car must not be
  // able to drive into the one we are watching either.
  //
  // THE ROAD IS ALSO KEPT BUSY.  Traffic builds with the cash taken and this
  // car takes none, so a stock road is two or three cars and a twenty-four
  // second watch can genuinely contain no lane change at all -- at which point
  // the check reports "nobody indicated" about a road where nobody moved.  Six
  // cars, behaving exactly as they always do, is the road a player who is
  // actually earning would be watching.
  await page.evaluate(() => {
    window.__chase.shield(true);
    setInterval(() => {
      if (window.__chase.trafficState().length < 6) {
        window.__chase.spawnTrafficAt(Math.floor(Math.random() * 4), 10);
      }
    }, 1200);
  });

  // ONE PASS, BOTH FACTS.  Watch the road for twenty-four seconds and file an
  // episode per SIGNAL — not per car, because a car changes lanes several
  // times in that window and one entry per car compares its second change
  // against where its first one started.  Each episode records how many blinks
  // had been counted when it was released, whether it moved before that, and
  // how long the crossing itself took.
  const seen = await page.evaluate(async () => {
    const live = new Map();
    const done = [];
    const stop = Date.now() + 24000;
    while (Date.now() < stop) {
      const t = Date.now();
      const cars = window.__chase.trafficState();
      const here = new Set(cars.map((c) => c.id));
      for (const c of cars) {
        let e = live.get(c.id);
        if (c.signal !== 0 && !c.changing) {
          // Indicating, wheels straight.  A fresh episode, or the same one.
          if (!e || e.atBlinks >= 0) {
            e = { blinks: 0, movedEarly: false, atBlinks: -1, t0: 0, ms: 0, x0: c.x };
            live.set(c.id, e);
          }
          e.blinks = Math.max(e.blinks, c.blinks);
          if (Math.abs(c.x - e.x0) > 0.51) e.movedEarly = true;
        } else if (c.changing && e) {
          // The third blink finishing IS the release, so the first frame that
          // reports `changing` is the frame the count reaches three.
          if (e.atBlinks < 0) {
            e.atBlinks = c.blinks;
            e.t0 = t;
          }
          e.ms = t - e.t0;
        } else if (e && e.atBlinks >= 0) {
          // Back in a lane with the lamp off: that episode is finished.
          done.push(e);
          live.delete(c.id);
        }
      }
      // A car that scrolled off mid-change is dropped rather than filed.
      for (const id of [...live.keys()]) if (!here.has(id)) live.delete(id);
      await new Promise((r) => setTimeout(r, 30));
    }
    return done;
  });

  const counted = seen.length > 0 && seen.every((e) => e.atBlinks === 3 && !e.movedEarly);
  console.log(
    `${counted ? 'PASS' : 'FAIL'}  car chase: a car blinks three times before it moves, and not before  — ` +
      `${seen.length} lane changes, blinks at release ${seen.map((e) => e.atBlinks).join(',') || 'none seen'}` +
      `${seen.some((e) => e.movedEarly) ? ', SOME MOVED EARLY' : ''}`,
  );
  if (!counted) failures++;

  // And the change itself is slow enough to answer: a lane is 54px wide and
  // crossing one is supposed to take better than a second and a half.  The
  // middle of what was seen, so one clipped sample cannot decide it.
  const times = seen.map((e) => e.ms).sort((a, b) => a - b);
  const middle = times.length ? times[Math.floor(times.length / 2)] : 0;
  const unhurried = middle >= 1200;
  console.log(
    `${unhurried ? 'PASS' : 'FAIL'}  car chase: the lane change is slow enough to read  — ` +
      `${middle}ms across the middle one of ${times.length}`,
  );
  if (!unhurried) failures++;
  await page.close();
}

// THE GUTTER IS A ONE-WAY DOOR.  The old lane clamped the ball's x and zeroed
// its sideways speed every frame, and then the curve put the speed straight
// back — so a hooking ball climbed out of the channel and back onto the boards.
// Throw one into the left gutter with a hard RIGHT hook on it, which is the
// exact shot that used to come back, and check it does not.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=bowling`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await startGame(page);
  await bridge(page, '__bowl');

  const watched = await page.evaluate(async () => {
    // Hard left off the left-hand boards, with a full right-hand hook dialled
    // in: everything about this ball wants to come back onto the lane.
    window.__bowl.throw(-0.4, 1, 130, 0.55);
    let escaped = false;
    let entered = false;
    const xs = [];
    for (let i = 0; i < 160; i++) {
      const st = window.__bowl.state();
      if (!st.rolling && entered) break;
      if (st.gutter !== 0) entered = true;
      if (entered) {
        xs.push(Math.round(st.ball.x));
        // 118 is the left edge of the boards; anything at or past it is the
        // ball back in play, which is the bug.
        if (st.ball.x > 117) escaped = true;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    return { entered, escaped, xs: [...new Set(xs)], state: window.__bowl.state() };
  });
  await sleep(1600);
  const after = await page.evaluate(() => window.__bowl.state());
  const dead = watched.entered && !watched.escaped && after.scores.player === 0 && after.standing === 10;
  console.log(
    `${dead ? 'PASS' : 'FAIL'}  bowling: a gutter ball stays in the gutter and scores nothing  — ` +
      `channel x ${watched.xs.join('/') || 'never entered'}, ${after.standing} pins standing, ${after.scores.player} scored`,
  );
  if (!dead) failures++;
  await page.close();
}

// THE TWO SHOTS HAVE TO BE DIFFERENT SHOTS.  The same line thrown straight and
// thrown hooked must arrive in different places, and the hook must go the way
// it was dialled — otherwise "straight or curved" is a label on one shot.
//
// A fresh machine per throw, because a second ball is a different frame: the
// pins have been swept, the round may have turned over to Froggy, and the lane
// under the ball is not the lane the first one rolled down.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // Where the ball is by the time it reaches the head pin.  Nothing is racked
  // below y=66, so the whole roll up to there is the ball and the lane alone.
  //
  // THE LANE IS WIPED FIRST.  The pattern is rolled fresh before every ball
  // now, so three throws off three fresh machines are three different lanes
  // and the difference between them would be the oil, not the dial.  Dry
  // boards is the only surface on which this question has an answer.
  const land = async (bend) => {
    await page.goto(`${URL}/?intro=1&tokens=50&game=bowling`, { waitUntil: 'networkidle2' });
    await sleep(1400);
    await startGame(page);
    await bridge(page, '__bowl');
    return page.evaluate(async (b) => {
      window.__bowl.setOil([]);
      window.__bowl.throw(0, 0.8, 175, b);
      let last = 175;
      for (let i = 0; i < 400; i++) {
        const st = window.__bowl.state();
        if (st.ball.y > 74) last = st.ball.x;
        if (!st.rolling) break;
        await new Promise((r) => setTimeout(r, 8));
      }
      return last;
    }, bend);
  };

  const straight = await land(0);
  const right = await land(0.8);
  const left = await land(-0.8);
  const bends = right > straight + 3 && left < straight - 3;
  console.log(
    `${bends ? 'PASS' : 'FAIL'}  bowling: the hook dial is what bends the ball  — ` +
      `left ${left.toFixed(1)}, straight ${straight.toFixed(1)}, right ${right.toFixed(1)} at the head pin`,
  );
  if (!bends) failures++;

  // And the oil is real: a ball thrown dead straight down the middle of a
  // patch does not arrive where it was pointed, and it misses to the side the
  // chevrons on that patch point.
  await page.goto(`${URL}/?intro=1&tokens=50&game=bowling`, { waitUntil: 'networkidle2' });
  await sleep(1400);
  await startGame(page);
  await bridge(page, '__bowl');
  const oiled = await page.evaluate(async () => {
    // One patch, laid where it can be rolled straight down: the random pattern
    // could put its first patch anywhere, including hard against a channel,
    // and this asks what a patch does rather than where one happened to land.
    window.__bowl.setOil([{ l: 0.3, r: 0.7, top: 100, bottom: 140, push: 1 }]);
    const patch = window.__bowl.state().oil[0];
    if (!patch) return null;
    const x0 = patch.x + patch.w / 2;
    window.__bowl.throw(0, 0.8, x0, 0);
    let last = x0;
    for (let i = 0; i < 400; i++) {
      const st = window.__bowl.state();
      if (st.ball.y > 74) last = st.ball.x;
      if (!st.rolling) break;
      await new Promise((r) => setTimeout(r, 8));
    }
    return { x0, last, push: patch.push };
  });
  const shoved = oiled && Math.abs(oiled.last - oiled.x0) > 3 && Math.sign(oiled.last - oiled.x0) === oiled.push;
  console.log(
    `${shoved ? 'PASS' : 'FAIL'}  bowling: the oil shoves a straight ball the way its chevrons point  — ` +
      (oiled
        ? `${oiled.x0.toFixed(1)} -> ${oiled.last.toFixed(1)}, patch pushes ${oiled.push > 0 ? 'right' : 'left'}`
        : 'no oil on the lane'),
  );
  if (!shoved) failures++;
  await page.close();
}

// THE CREW COMES OUT BETWEEN SHOTS.  The lane used to be oiled once a round,
// so the line that worked on your first ball worked on your second.  Take one
// ball, leave pins standing, and check the pattern under the spare attempt is
// not the pattern the first ball rolled down.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=bowling`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await startGame(page);
  await bridge(page, '__bowl');

  const relaid = await page.evaluate(async () => {
    const sig = () =>
      window.__bowl
        .state()
        .oil.map((o) => [o.x, o.y, o.w, o.h, o.push].map((n) => Math.round(n)).join(':'))
        .join('|');
    const first = sig();
    // A soft ball into the left-hand boards: it reaches the deck, so the frame
    // moves on, and it cannot take the whole rack, so there is a second ball.
    window.__bowl.throw(-0.2, 0.55, 130, 0);
    for (let i = 0; i < 400; i++) {
      const st = window.__bowl.state();
      if (!st.rolling && (st.ballNo === 2 || st.turn === 'cpu')) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    const st = window.__bowl.state();
    return { first, second: sig(), ballNo: st.ballNo, turn: st.turn };
  });
  // Only meaningful if the frame really did move to a second ball.
  const fresh = relaid.ballNo === 2 && relaid.turn === 'player' && relaid.second !== relaid.first;
  console.log(
    `${fresh ? 'PASS' : 'FAIL'}  bowling: the lane is re-oiled before the spare attempt  — ` +
      `ball ${relaid.ballNo} (${relaid.turn}), [${relaid.first}] -> [${relaid.second}]`,
  );
  if (!fresh) failures++;
  await page.close();
}

// TEN IS WORTH MORE THAN TEN.  All ten off the first ball is a strike and pays
// five on top; all ten off the second is a spare and pays three.  The score is
// what proves it: a bonus that quietly stopped being added reads as a cleared
// rack worth exactly ten.
//
// The lane is wiped for both, because the pattern is random now and a shove
// into the channel would be measuring the oil rather than the scoring.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // Everything the frame did, off a fresh machine: the balls thrown, what the
  // board said after each, and whether the rack went down.
  const frame = async (shots) => {
    await page.goto(`${URL}/?intro=1&tokens=50&game=bowling`, { waitUntil: 'networkidle2' });
    await sleep(1400);
    await startGame(page);
    await bridge(page, '__bowl');
    return page.evaluate(async (shots) => {
      // Thrown, stopped, AND counted: the score does not move until the deck
      // has settled, so `rolling` alone reads the board from before the roll.
      const settle = async () => {
        for (let i = 0; i < 20; i++) {
          if (window.__bowl.state().rolling) break;
          await new Promise((r) => setTimeout(r, 25));
        }
        for (let i = 0; i < 400; i++) {
          const st = window.__bowl.state();
          if (!st.rolling && !st.settling) return st;
          await new Promise((r) => setTimeout(r, 25));
        }
        return window.__bowl.state();
      };
      const out = [];
      for (const [x, pow] of shots) {
        // Re-wiped before every ball: the game re-oils between them.
        window.__bowl.setOil([]);
        window.__bowl.throw(0, pow, x, 0);
        const st = await settle();
        // WHETHER THE RACK WENT DOWN IS NOT `standing`.  By the time the deck
        // has settled the frame is over and the pins are already re-racked for
        // whoever is up next, so `standing` reads 10 after a strike.  What the
        // frame did is in the turn: it moves on when the rack is cleared or
        // the second ball is spent, and stays put with the ball number up when
        // there are pins left to pick up.
        out.push({ score: st.scores.player, ballNo: st.ballNo, turn: st.turn });
        if (st.turn !== 'player') break;
      }
      return out;
    }, shots);
  };

  // 159 is the pocket at full power and takes the rack off the first ball: one
  // ball, the frame over, and ten pins on the board as fifteen.
  const struck = await frame([[159, 1]]);
  const strikeOk = struck.length === 1 && struck[0].turn === 'cpu' && struck[0].score === 15;
  console.log(
    `${strikeOk ? 'PASS' : 'FAIL'}  bowling: the whole rack off the first ball pays 10 and 5  — ` +
      `${struck.map((r) => `${r.score} (ball ${r.ballNo}, ${r.turn})`).join(' then ')}`,
  );
  if (!strikeOk) failures++;

  // A soft ball wide of the pocket leaves pins -- the frame stays put and the
  // ball number goes up -- and the pocket then picks them up for thirteen.
  const spared = await frame([
    [168, 0.7],
    [162, 1],
  ]);
  const spareOk =
    spared.length === 2 &&
    spared[0].turn === 'player' &&
    spared[0].ballNo === 2 &&
    spared[1].turn === 'cpu' &&
    spared[1].score === 13;
  console.log(
    `${spareOk ? 'PASS' : 'FAIL'}  bowling: the whole rack off the second ball pays 10 and 3  — ` +
      `${spared.map((r) => `${r.score} (ball ${r.ballNo}, ${r.turn})`).join(' then ')}`,
  );
  if (!spareOk) failures++;

  // AND THE PINS ARE NOT PUSHOVERS.  A soft ball clipping the edge of the rack
  // used to take most of it; it has to leave the rack mostly standing now.
  const brushed = await frame([[143, 0.3]]);
  const glance = brushed[0].score;
  const stubborn = glance <= 5;
  console.log(
    `${stubborn ? 'PASS' : 'FAIL'}  bowling: a glancing ball does not take the rack  — ` +
      `${glance} pins off a soft edge ball`,
  );
  if (!stubborn) failures++;
  await page.close();
}

// AND DRIVING INTO SOMEBODY ENDS THE RUN.
//
// ITS OWN MACHINE, because it is a check that KILLS THE PLAYER.  The scene
// deletes `window.__chase` on its way out and `over` stays true for whatever
// is left of that scene's life, so a lethal check sitting in the middle of the
// block above takes every check after it down with it -- silently, as a crash
// rather than a failure.  The spike-strip test is at the bottom of that block
// for exactly this reason; this one gets a page instead, so neither has to be
// the last thing anybody adds.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=carchase`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await startGame(page);
  await bridge(page, '__chase');
  const ranOver = await page.evaluate(async () => {
    window.__chase.clearRoad();
    window.__chase.setCash(600);
    window.__chase.setPlayer(window.__chase.laneX(2), 120);
    const me = window.__chase.state().player;
    // Directly in front of the car and not walking anywhere: what is under
    // test is the collision, not whether one happens to wander into you.
    window.__chase.spawnPedAt(me.x, me.y - 26, 0, 0);
    for (let i = 0; i < 70; i++) {
      const s = window.__chase?.state();
      if (!s) return 'the scene went';
      if (s.over) return s.reason;
      await new Promise((r) => setTimeout(r, 60));
    }
    return '';
  });
  const lethal = ranOver === 'YOU HIT SOMEBODY';
  console.log(
    `${lethal ? 'PASS' : 'FAIL'}  car chase: driving into somebody ends the run  — ` +
      `${ranOver || 'drove straight through'}`,
  );
  if (!lethal) failures++;
  await page.close();
}

// AND CONCRETE AND SPIKES NEVER MAKE ONE WALL BETWEEN THEM.
//
// Each of them leaves a way past on its own.  Both are laid at the top of the
// road and both scroll down at the same speed, so one laid while the other is
// still coming stays the same distance behind it the whole way down — and the
// lanes the strip left open are exactly the lanes the concrete is free to
// take.  Between them that is four lanes shut and a token gone.
//
// So they have a pact: neither is laid while the other is still up the road.
// That is what is asserted, because it is the mechanism — asking instead
// whether a closed road ever appeared would pass for the wrong reason, by
// never producing the pair at all.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=carchase`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await startGame(page);
  await bridge(page, '__chase');
  const pact = await page.evaluate(async () => {
    window.__chase.shield(true);
    // ---- concrete holds off while a strip is coming down.
    window.__chase.clearRoad();
    window.__chase.setCash(800);
    window.__chase.setPlayer(window.__chase.laneX(1), 150);
    window.__chase.armTrap();
    await new Promise((r) => setTimeout(r, 500));
    const strip = window.__chase.state().traps;
    for (let i = 0; i < 20; i++) window.__chase.layBarrier();
    const heldOff = window.__chase.state().barriers;

    // ---- and on a clear road it lays one, so the guard above is a guard and
    // not simply a barrier spawner that never works.
    window.__chase.clearRoad();
    window.__chase.setCash(800);
    window.__chase.setPlayer(window.__chase.laneX(1), 150);
    window.__chase.layBarrier();
    const onAClearRoad = window.__chase.state().barriers;

    // ---- and a strip holds off while concrete is coming down.
    window.__chase.clearRoad();
    window.__chase.setCash(800);
    window.__chase.setPlayer(window.__chase.laneX(1), 150);
    window.__chase.layBarrier();
    const concrete = window.__chase.state().barriers;
    window.__chase.armTrap();
    await new Promise((r) => setTimeout(r, 500));
    const stripHeldOff = window.__chase.state().traps;
    return { strip, heldOff, onAClearRoad, concrete, stripHeldOff };
  });
  const kept =
    pact.strip >= 1 && pact.heldOff === 0 && pact.onAClearRoad >= 1 && pact.concrete >= 1 && pact.stripHeldOff === 0;
  console.log(
    `${kept ? 'PASS' : 'FAIL'}  car chase: concrete and spikes are never on the road together  — ` +
      `${pact.heldOff} concrete under ${pact.strip} strip, ${pact.stripHeldOff} strips under ${pact.concrete} concrete, ` +
      `${pact.onAClearRoad} on a clear road`,
  );
  if (!kept) failures++;
  await page.close();
}

// ONE IN FIVE, AND IT HAS TO BE THE DRAW THAT SAYS SO.  The cylinder spinning
// on screen is decoration; what decides is one `Math.random()` per pull, so
// sample the decision itself rather than sitting through ten thousand pulls.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=40&game=roulette`, { waitUntil: 'networkidle2' });
  await sleep(1500);
  await startGame(page);
  await bridge(page, '__chamber');

  const N = 200000;
  const live = await page.evaluate((n) => window.__chamber.sample(n), N);
  const rate = live / N;
  const ok = Math.abs(rate - 0.2) < 0.005;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  chamber: a pull is a flat one in five  — ${(rate * 100).toFixed(2)}% live over ${N} draws`,
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
  await bridge(page, '__dance');

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

  // ---- it is a ladder now, and every round is a new song cut fresh:
  // different tune, different tempo, different arrows.  Take the first round
  // and he has to come back harder for the second.
  const r1 = await page.evaluate(() => window.__dance.state());
  await page.evaluate(() => {
    window.__dance.ace();
    window.__dance.finish();
  });
  await sleep(300);
  const card = await page.evaluate(() => window.__dance.state());
  await page.evaluate(() => window.__dance.skipCard());
  await sleep(700);
  const r2 = await page.evaluate(() => window.__dance.state());

  const fresh = r2.chart !== r1.chart && r2.music !== r1.music && r2.bpm > r1.bpm && r2.notes > r1.notes;
  console.log(
    `${fresh ? 'PASS' : 'FAIL'}  dance off: a new song and a new chart every round  — ` +
      `${r1.music} ${r1.bpm}bpm ${r1.notes} arrows -> ${r2.music} ${r2.bpm}bpm ${r2.notes} arrows`,
  );
  if (!fresh) failures++;

  const stepped = card.wins.you === 1 && r2.rival.accuracy > r1.rival.accuracy && r2.rival.combo > r1.rival.combo;
  console.log(
    `${stepped ? 'PASS' : 'FAIL'}  dance off: beat him and he comes back better  — ` +
      `lands ${Math.round(r1.rival.accuracy * 100)}% -> ${Math.round(r2.rival.accuracy * 100)}%, combo cap ${r1.rival.combo} -> ${r2.rival.combo}`,
  );
  if (!stepped) failures++;

  // ---- AND THE LADDER PAYS AS IT CLIMBS.  Round two is banked but not paid,
  // because there is a third round above it: the whole shape of the game is
  // that you carry the money into the next round rather than collecting it.
  await page.evaluate(() => {
    window.__dance.setScores(9000, 0);
    window.__dance.finish();
    window.__dance.skipCard();
  });
  await sleep(700);
  const two = await page.evaluate(() => window.__dance.state());
  const climbing = two.wins.you === 2 && two.banked === 35 && two.round === 2 && !two.over;
  console.log(
    `${climbing ? 'PASS' : 'FAIL'}  dance off: two rounds banks 35 and dances the third  — ` +
      `${two.wins.you} rounds, ${two.banked} banked, on round ${two.round + 1}${two.over ? ', OVER' : ''}`,
  );
  if (!climbing) failures++;

  // ---- and the third one pays the lot, through the shell.
  const before = await page.evaluate(() => window.__froggy.state().tokens);
  await page.evaluate(() => {
    window.__dance.setScores(9000, 0);
    window.__dance.finish();
  });
  await sleep(4200);
  const after = await page.evaluate(() => window.__froggy.state().tokens);
  const paidAll = after - before === 50;
  console.log(
    `${paidAll ? 'PASS' : 'FAIL'}  dance off: all three rounds pays 50  — ${before} -> ${after}, wants +50`,
  );
  if (!paidAll) failures++;
  await page.close();
}

// THE LADDER'S OTHER THREE ENDINGS.
//
// Winning all three is the easy one to get right.  What the table is actually
// promising is what happens when the climb STOPS: a dropped round pays what
// was already banked and does not dance the round above it, a dropped first
// round pays nothing, and a drawn first round is a tie like every other tie in
// the building and hands the entry fee back.
//
// A PAGE EACH, because every one of these ends the run and a finished run
// takes the bridge down with it.
{
  const ladder = async (rounds) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(`${URL}/?intro=1&tokens=60&game=danceoff`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    await startGame(page);
    await bridge(page, '__dance');
    const before = await page.evaluate(() => window.__froggy.state().tokens);
    // `rounds` is the scoreline to put up for each round in turn: 'win',
    // 'lose' or 'draw'.  The run stops itself the moment one is not a win.
    for (const r of rounds) {
      const ended = await page.evaluate(async (outcome) => {
        if (!window.__dance) return true;
        const you = 9000;
        const rival = outcome === 'win' ? 0 : outcome === 'draw' ? you : you + 1000;
        window.__dance.setScores(you, rival);
        window.__dance.finish();
        await new Promise((res) => setTimeout(res, 200));
        const st = window.__dance?.state();
        if (!st || st.over) return true;
        window.__dance.skipCard();
        return false;
      }, r);
      await sleep(700);
      if (ended) break;
    }
    await sleep(4200);
    const after = await page.evaluate(() => window.__froggy.state().tokens);
    await page.close();
    return after - before;
  };

  const droppedSecond = await ladder(['win', 'lose']);
  console.log(
    `${droppedSecond === 20 ? 'PASS' : 'FAIL'}  dance off: win one, drop the second, walk with 20  — +${droppedSecond}`,
  );
  if (droppedSecond !== 20) failures++;

  const droppedThird = await ladder(['win', 'win', 'lose']);
  console.log(
    `${droppedThird === 35 ? 'PASS' : 'FAIL'}  dance off: win two, drop the third, walk with 35  — +${droppedThird}`,
  );
  if (droppedThird !== 35) failures++;

  const droppedFirst = await ladder(['lose']);
  console.log(
    `${droppedFirst === 0 ? 'PASS' : 'FAIL'}  dance off: drop the first and there is nothing to walk with  — +${droppedFirst}`,
  );
  if (droppedFirst !== 0) failures++;

  // The house rule: a tie is not a loss, and with nothing banked it is a
  // refund.  Ten out, ten back.
  const drawnFirst = await ladder(['draw']);
  console.log(
    `${drawnFirst === 10 ? 'PASS' : 'FAIL'}  dance off: a drawn first round hands the entry fee back  — +${drawnFirst}`,
  );
  if (drawnFirst !== 10) failures++;
}

// GRUDGE: the special is on a timer, and the timer is the point.  Throw it,
// and the next one has to be refused until the bar has filled back up.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=20&game=grudge`, { waitUntil: 'networkidle2' });
  await sleep(1800);
  await startGame(page);
  await bridge(page, '__grudge');
  await sleep(2400); // READY / FIGHT

  const st = () => page.evaluate(() => window.__grudge.state());
  const press = (m) => page.evaluate((move) => window.__grudge.press(move), m);

  const ready = await st();
  const first = await press('special');
  await sleep(200);
  const thrown = await st();
  const spent = ready.you.cd === 0 && first === true && thrown.you.cd > ready.cooldownMs * 0.8;
  console.log(
    `${spent ? 'PASS' : 'FAIL'}  grudge: the special spends its cooldown  — ${ready.you.cd}ms -> ${thrown.you.cd}ms of ${thrown.cooldownMs}`,
  );
  if (!spent) failures++;

  // A second one, straight away, must be refused rather than quietly ignored.
  await sleep(1200);
  const second = await press('special');
  const after = await st();
  const blocked = second === false && after.you.cd > 0;
  console.log(`${blocked ? 'PASS' : 'FAIL'}  grudge: a second special is refused while it charges  — ${after.you.cd}ms left`);
  if (!blocked) failures++;

  // The high strike and the low sweep both land, and they are different moves.
  // The lizard is held still for this: what is under test is the two attacks,
  // not whether he happens to be standing where they reach.
  await page.evaluate(() => window.__grudge.freeze(true));
  await page.evaluate(() => window.__grudge.place(150, 172));
  const beforeHigh = await st();
  await press('high');
  await sleep(700);
  const afterHigh = await st();
  await page.evaluate(() => window.__grudge.place(150, 172));
  await press('low');
  await sleep(900);
  const afterLow = await st();
  await page.evaluate(() => window.__grudge.freeze(false));
  const hits = afterHigh.him.hp < beforeHigh.him.hp && afterLow.him.hp < afterHigh.him.hp;
  console.log(
    `${hits ? 'PASS' : 'FAIL'}  grudge: high and low both land  — ${beforeHigh.him.hp} -> ${afterHigh.him.hp} -> ${afterLow.him.hp} hp`,
  );
  if (!hits) failures++;

  // THE SWEEP IS THE MOVE YOU JUMP.  Hung 14px off the floor — inside an
  // ordinary hop, which peaks at 29 — the sweep must pass underneath, while
  // the same hop is nowhere near enough to get over a high strike.  Both are
  // measured from the same height, or the test is measuring the height.
  await page.evaluate(() => window.__grudge.freeze(true));
  await page.evaluate(() => window.__grudge.place(150, 172));
  await page.evaluate(() => window.__grudge.hoist(14));
  const beforeAir = await st();
  await press('low');
  await sleep(900);
  const afterAirLow = await st();
  await press('high');
  await sleep(700);
  const afterAirHigh = await st();
  await page.evaluate(() => window.__grudge.hoist(null));
  await page.evaluate(() => window.__grudge.freeze(false));
  const dodged = afterAirLow.him.hp === beforeAir.him.hp && afterAirHigh.him.hp < afterAirLow.him.hp;
  console.log(
    `${dodged ? 'PASS' : 'FAIL'}  grudge: a jump clears the sweep, not the high strike  — 14px up: low ${beforeAir.him.hp}->${afterAirLow.him.hp}, high ${afterAirLow.him.hp}->${afterAirHigh.him.hp} hp`,
  );
  if (!dodged) failures++;
  await page.close();
}

// THE FLOOD.  Three things carry this game and all three are asserted: the
// tower is CLIMBABLE BY CONSTRUCTION, every kind of ledge shows up in a run,
// and the water is lethal on contact rather than merely present.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=40&game=fallingblocks`, { waitUntil: 'networkidle2' });
  await sleep(1800);
  await startGame(page);
  await bridge(page, '__flood');
  const st = () => page.evaluate(() => window.__flood.state());

  // Nothing in the tower may be further than a jump.  Rise is measured against
  // the apex of a standing jump and the sideways gap against how far a run
  // carries you in the air — both read out of the game's own constants, so
  // retuning the frog retunes the test with it.
  const reach = await page.evaluate(() => window.__flood.reach());
  const towers = [];
  const saidByTheGame = [];
  for (let i = 0; i < 4; i++) {
    const ladder = await page.evaluate(() => window.__flood.ladder());
    towers.push(ladder);
    // What the game's own validator makes of the tower it just built, captured
    // NOW: the page is reloaded for the next one, so asking afterwards would
    // only ever describe the last of them.
    saidByTheGame.push(await page.evaluate(() => window.__flood.state().climbable));
    if (i < 3) {
      await page.goto(`${URL}/?intro=1&tokens=40&game=fallingblocks`, { waitUntil: 'networkidle2' });
      await sleep(1500);
      await startGame(page);
      await bridge(page, '__flood');
    }
  }
  // The ledges are SCATTERED inside the jump, not threaded one under the next,
  // so "is each one reachable from the one before it in the list" is the wrong
  // question — the climb is a path through the graph.  This walks that graph
  // here, from the kerb, using the frog's own leap and span: an independent
  // reading of the same property the game's validator checks, so a generator
  // that starts building unclimbable towers is caught by something other than
  // the code that built them.
  const reachable = (ledges) => {
    const span = (l) => l.w / 2 + l.amp + (l.kind === 'orbit' ? l.radius : 0);
    const seen = ledges.map(() => false);
    const queue = [0];
    seen[0] = true;
    while (queue.length) {
      const i = queue.shift();
      if (i === ledges.length - 1) return true;
      for (let j = 0; j < ledges.length; j++) {
        if (seen[j]) continue;
        const a = ledges[i];
        const b = ledges[j];
        // Worst case both ways: take off at its lowest, land at its highest,
        // with the two ledges as far apart sideways as they ever travel.
        const rise = b.y + b.slop - (a.y - a.slop);
        if (rise > reach.leap || rise < -140) continue;
        const aR = a.x + span(a);
        const aL = a.x - span(a);
        const bR = b.x + span(b);
        const bL = b.x - span(b);
        const gap = bL > aR ? bL - aR : aL > bR ? aL - bR : 0;
        if (gap > reach.span) continue;
        seen[j] = true;
        queue.push(j);
      }
    }
    return false;
  };
  // On a failure, say whether the GAME thought the tower it built was
  // climbable too.  Agreement means the generator really did emit a bad tower;
  // a disagreement means what was validated is not what was built, which is a
  // different bug entirely and impossible to tell apart from one verdict.
  const bad = [];
  towers.forEach((t, i) => {
    if (!reachable(t)) bad.push(`tower ${i + 1} has no way up (the game said ${saidByTheGame[i]})`);
  });
  const climbable = bad.length === 0 && towers.every((t) => t.length > 18);
  console.log(
    `${climbable ? 'PASS' : 'FAIL'}  the flood: every tower has a way to the top  — ` +
      `${towers.length} towers, ${towers[0].length} ledges, ` +
      `leap ${reach.leap.toFixed(1)} span ${reach.span.toFixed(1)}` +
      (bad.length ? `; ${bad.slice(0, 3).join(', ')}` : ''),
  );
  if (!climbable) failures++;

  // AND THE STRONGER PROMISE: EVERY LEDGE IS ONE JUMP FROM THE ONE BELOW IT.
  //
  // "A way to the top exists" is not the same claim, and the difference is
  // something a player feels: a tower can have a route that goes around a
  // stranded ledge, and the player looking up at that ledge takes the obvious
  // jump and drowns for it.  Measured here off the same `ladder()` data and the
  // same constants, independently of the generator's own verdict.
  const stranded = [];
  towers.forEach((t, i) => {
    const span = (l) => l.w / 2 + l.amp + (l.kind === 'orbit' ? l.radius : 0);
    for (let k = 1; k < t.length; k++) {
      const a = t[k - 1];
      const b = t[k];
      const rise = b.y + b.slop - (a.y - a.slop);
      const gap = Math.max(0, Math.abs(b.x - a.x) - span(a) - span(b));
      if (rise > reach.leap || gap > reach.span) {
        stranded.push(
          `tower ${i + 1} ledge ${k} needs ${rise.toFixed(0)}up/${gap.toFixed(0)}across ` +
            `(the jump is ${reach.leap.toFixed(0)}/${reach.span.toFixed(0)})`,
        );
        break;
      }
    }
  });
  const chained = stranded.length === 0;
  console.log(
    `${chained ? 'PASS' : 'FAIL'}  the flood: and every ledge is reachable from the one below it  — ` +
      (chained
        ? `${towers.reduce((n, t) => n + t.length - 1, 0)} steps, none beyond the jump`
        : stranded.slice(0, 3).join('; ')),
  );
  if (!chained) failures++;

  // And all six kinds are really in the bag, across a handful of towers.
  const kinds = new Set(towers.flat().map((l) => l.kind));
  const allSix = ['static', 'slide', 'rise', 'spin', 'retract', 'crumble'].every((k) => kinds.has(k));
  console.log(`${allSix ? 'PASS' : 'FAIL'}  the flood: all six kinds of ledge get built  — ${[...kinds].join(',')}`);
  if (!allSix) failures++;

  // The water is the only way to lose, and it only has to touch him once.
  await page.evaluate(() => {
    window.__flood.setPlayer(160, 200);
    window.__flood.setWater(198);
  });
  await sleep(600);
  const drowned = await st();
  console.log(`${drowned.over ? 'PASS' : 'FAIL'}  the flood: the water touching you ends it  — over=${drowned.over}`);
  if (!drowned.over) failures++;
  await page.close();
}

// And the hatch pays.  Put the frog at the top with the water miles below and
// the round has to bank the cabinet's reward, not merely stop.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=40&game=fallingblocks`, { waitUntil: 'networkidle2' });
  await sleep(1800);
  const before = await page.evaluate(() => window.__froggy.state().tokens);
  await startGame(page);
  await bridge(page, '__flood');
  await page.evaluate(() => {
    window.__flood.setWater(-400);
    window.__flood.setPlayer(160, window.__flood.state().goal - 1);
  });
  await sleep(2600);
  const after = await page.evaluate(() => window.__froggy.state().tokens);
  // Read off the cabinet rather than typed here, so repricing the machine
  // cannot leave this check asserting last month's numbers.
  const price = await page.evaluate(async () => {
    const { CABINETS } = await import('/src/game/content.ts');
    const c = CABINETS.find((x) => x.id === 'fallingblocks');
    return { cost: c.cost, reward: c.reward };
  });
  const paid = after === before - price.cost + price.reward;
  console.log(
    `${paid ? 'PASS' : 'FAIL'}  the flood: reaching the hatch banks the reward  — ` +
      `${before} -> ${after}, ${price.cost} in for ${price.reward}`,
  );
  if (!paid) failures++;
  await page.close();
}

// THE RESPITE.  A banana and a crash both buy ten seconds with nobody on you,
// and the road may not send two cars out the moment it is over.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=40&game=carchase`, { waitUntil: 'networkidle2' });
  await sleep(1600);
  await startGame(page);
  await bridge(page, '__chase');
  // The run can end under us — this one is deliberately long — so every read
  // says so rather than throwing halfway through the check.
  const st = async () => (await page.evaluate(() => window.__chase?.state() ?? null)) ?? { gone: true };

  // Enough cash to be worth three cars but UNDER the six hundred the spikes
  // start at, because a spiked run ends and takes the rest of this with it.
  // Then WAIT for some to actually be on the road: the first is eight seconds
  // out, and a chaser that finds the traffic on its own buys a respite of its
  // own, so a fixed sleep lands on an empty road as often as not.
  await page.evaluate(() => {
    // Twenty-five seconds of unsteered driving would end in a traffic car long
    // before the respite did.  What is under test is the police, so the road
    // is made harmless for the length of the check and nothing else changes.
    window.__chase.shield(true);
    window.__chase.setCash(400);
  });
  let busy = await st();
  for (let i = 0; i < 40 && busy.chasing === 0; i++) {
    await sleep(700);
    busy = await st();
  }

  // A BOMB ONLY CLEARS THE ROAD IF SOMEBODY DRIVES OVER IT, which is the
  // whole of what replaced the nitro: the old burst emptied the road by
  // itself, this has to catch a car.  So one is put directly behind the
  // player before the drop, the way a player would use it.  The bag is
  // already at four hundred above, which is what pays for it.
  await page.evaluate(() => {
    const s = window.__chase.state();
    window.__chase.setPlayer(s.player.x, 110);
    window.__chase.spawnPolice(window.__chase.laneOf(s.player.x), 150);
  });
  await sleep(400);
  // COUNTED AFTER THE CAR IS PUT THERE, not before.
  //
  // The loop above gives the road time to bring its own police and usually it
  // does, but "usually" is not a test: on a slow arrival it read an empty road
  // and reported the bomb as broken over a car that had not turned up yet.
  // What has to be true is that somebody was chasing when the bomb went off,
  // and the car behind the player is somebody.
  busy = await st();
  await page.keyboard.press('Space');
  await sleep(1800);
  const quiet = await st();
  // ON THE ROAD, not necessarily CHASING.  `chasing` leaves out a police car
  // that is spun out, and by four hundred cash there is concrete on the road
  // for them to spin out on -- so the road could be two cars deep and read as
  // empty, which is what this check kept failing on.  What the bomb has to do
  // is clear the road; what has to be true before it is that there was a road
  // to clear.
  //
  // Ten seconds of respite, read a beat after the drop and through a browser
  // that is rendering three other pages: seven is the floor that separates a
  // respite that started from one that did not.
  const cleared = !quiet.gone && busy.police > 0 && quiet.chasing === 0 && quiet.respite > 7000;
  console.log(
      `${cleared ? 'PASS' : 'FAIL'}  car chase: a bomb clears the road for ten seconds  — ` +
        (quiet.gone
          ? 'the run ended first'
          : `${busy.police} on the road (${busy.chasing} of them chasing) -> ${quiet.chasing}, ` +
            `${Math.round(quiet.respite / 100) / 10}s left`),
  );
  if (!cleared) failures++;

  // Nothing new arrives while the quiet lasts.
  await sleep(5000);
  const during = await st();
  const held = !during.gone && during.respite > 0 && during.chasing === 0;
  console.log(
      `${held ? 'PASS' : 'FAIL'}  car chase: and nothing is sent out while it lasts  — ` +
        (during.gone
          ? 'the run ended first'
          : `${during.chasing} chasing at ${Math.round(during.respite / 100) / 10}s left`),
  );
  if (!held) failures++;

  // And when it ends they come back ONE at a time, not four at once.
  //
  // Watched for rather than timed.  A chaser that finds the back of a traffic
  // car on its own buys ANOTHER ten seconds of quiet, which is the game
  // working exactly as it is supposed to — and with the road as busy as it is
  // now, a fixed sleep lands inside a second respite often enough to fail a
  // rule that was never broken.  So wait for a moment when the quiet is
  // genuinely over and somebody is genuinely back, and count them then.
  let back = await st();
  let resumed = null;
  for (let i = 0; i < 60 && !back.gone; i++) {
    if (back.respite === 0 && back.police >= 1) {
      resumed = back;
      break;
    }
    await sleep(500);
    back = await st();
  }
  back = resumed ?? back;
  const gentle = !!resumed && resumed.police <= 2;
  console.log(
      `${gentle ? 'PASS' : 'FAIL'}  car chase: they come back one at a time  — ` +
        (back.gone ? 'the run ended first' : `${back.police} on the road, cap ${back.policeCap}`),
  );
  if (!gentle) failures++;
  await page.close();
}

// THE TRAFFIC INDICATES BEFORE IT MOVES, AND PARKING IS NOT A PLAN.
//
// Two halves of the same change.  A car is twelve wide in a lane several times
// that, so standing ON a lane line — the middle of the road most obviously —
// used to be a corridor nothing could ever drive through: no steering, no
// timing, no risk.  The cars change lanes now, which closes that; the price of
// closing it is that a car must never move sideways without having indicated
// first, or the fix is just a different unfairness.
{
  const park = async (x) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(`${URL}/?intro=1&tokens=40&game=carchase`, { waitUntil: 'networkidle2' });
    await sleep(1600);
    await startGame(page);
    await bridge(page, '__chase');
    // Nothing on the road may end the run, and the car is pinned every frame so
    // the scene's own clamp cannot walk it off the line under us.
    await page.evaluate((x) => {
      window.__chase.shield(true);
      // ---- AND THE ROAD IS KEPT BUSY, ON PURPOSE.
      //
      // Traffic builds with the cash taken, and a parked player takes none: an
      // untouched run puts two or three cars on a four lane road, and whether
      // one of them happens to cross the exact line the player is sitting on
      // is then a coin toss the check reports as a verdict on the game.  It
      // has flipped tails.  The road is topped up to six instead -- the cars'
      // own behaviour untouched, only more of them -- which is the same road a
      // player who is actually earning would be looking at.
      setInterval(() => {
        if (window.__chase.trafficState().length < 6) {
          window.__chase.spawnTrafficAt(Math.floor(Math.random() * 4), 10);
        }
      }, 1200);
      const pin = () => {
        window.__chase.setPlayer(x, 140);
        requestAnimationFrame(pin);
      };
      pin();
      // Sampled every frame: a lane change lasts under a second and a poll at
      // a fixed interval would walk straight past the take-off.
      window.__parked = { hits: 0, swept: 0, silent: 0, changes: 0, last: new Map() };
      const watch = () => {
        const w = window.__parked;
        const me = window.__chase.state().player;
        for (const c of window.__chase.trafficState()) {
          if (Math.abs(c.x - me.x) < 8 && Math.abs(c.y - me.y) < 14) w.hits++;
          // ON THE LINE AT ALL, whatever the distance up the road: a car whose
          // body is over the line has driven down the corridor, and a parked
          // car is in the way of it whether or not the two happened to be
          // level on the frame it was sampled.  This is the thing being
          // tested; the frames where they are also level are the same fact
          // with the timing added, and the timing is not what is on trial.
          if (Math.abs(c.x - me.x) < 8) w.swept++;
          const was = w.last.get(c.id);
          if (was !== undefined && Math.abs(c.x - was) > 0.05) {
            w.changes++;
            if (c.signal === 0) w.silent++;
          }
          w.last.set(c.id, c.x);
        }
        requestAnimationFrame(watch);
      };
      watch();
    }, x);
    // Long enough to be sure.  A car has to be crossing the line the player is
    // parked on AND be level with them at the same moment, and with the warning
    // and the crossing between them a lane change is now better than three
    // seconds end to end — so a window that catches a handful of changes is not
    // the same thing as a window that catches a handful of SWEEPS.
    await sleep(58000);
    const out = await page.evaluate(() => {
      const w = window.__parked;
      return { hits: w.hits, swept: w.swept, silent: w.silent, changes: w.changes };
    });
    await page.close();
    return out;
  };

  // ASKED OF THE ROAD, not typed here.  The lines are halfway between two lane
  // centres, and the road has been re-cut before — a hard-coded 128 quietly
  // stopped being a lane line and became the middle of a lane, which is a
  // check that passes for the wrong reason.
  const lines = await (async () => {
    const page = await browser.newPage();
    await page.goto(`${URL}/?intro=1&tokens=40&game=carchase`, { waitUntil: 'networkidle2' });
    await sleep(1600);
    await startGame(page);
    await bridge(page, '__chase');
    const xs = await page.evaluate(() => [0, 1, 2, 3].map((i) => window.__chase.laneX(i)));
    await page.close();
    return { middle: (xs[1] + xs[2]) / 2, line: (xs[0] + xs[1]) / 2 };
  })();

  for (const [where, x] of [['the middle of the road', lines.middle], ['a lane line', lines.line]]) {
    const r = await park(x);
    const caught = r.swept > 0;
    console.log(
      `${caught ? 'PASS' : 'FAIL'}  car chase: parking on ${where} is not a safe spot  — ` +
        `traffic drove down it for ${r.swept} frames, and was level with the car for ${r.hits} of them`,
    );
    if (!caught) failures++;

    const fair = r.changes > 0 && r.silent === 0;
    console.log(
      `${fair ? 'PASS' : 'FAIL'}  car chase: and nothing moved sideways without indicating  — ` +
        `${r.changes} frames of lane change, ${r.silent} of them unannounced`,
    );
    if (!fair) failures++;
  }
}

// SHIFT across the arcade floor is 1.4x the walk.  Measured rather than
// trusted: the multiplier lives in one constant and the walk speed in another,
// and a change to either is a change to how the whole building feels.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=20&scene=ArcadeAnnex`, { waitUntil: 'networkidle2' });
  await sleep(2600);
  const at = () =>
    page.evaluate(() => {
      const s = window.__froggy.game().scene.getScene('ArcadeAnnex');
      return { x: s.player.x, y: s.player.y };
    });

  const runFor = async (ms, shift) => {
    const from = await at();
    if (shift) await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyD');
    await sleep(ms);
    await page.keyboard.up('KeyD');
    if (shift) await page.keyboard.up('ShiftLeft');
    await sleep(120);
    const to = await at();
    return Math.abs(to.x - from.x);
  };

  // Back to the left wall first, so both runs have the same road ahead.
  await page.keyboard.down('KeyA');
  await sleep(2200);
  await page.keyboard.up('KeyA');
  await sleep(200);
  const walked = await runFor(700, false);
  await page.keyboard.down('KeyA');
  await sleep(2200);
  await page.keyboard.up('KeyA');
  await sleep(200);
  const ran = await runFor(700, true);

  const ratio = walked > 0 ? ran / walked : 0;
  const right = ratio > 1.28 && ratio < 1.52;
  console.log(
    `${right ? 'PASS' : 'FAIL'}  the arcade run is 1.4x the walk  — ${walked.toFixed(0)}px vs ${ran.toFixed(0)}px (x${ratio.toFixed(2)})`,
  );
  if (!right) failures++;
  await page.close();
}

// The prize counter is a shelf: what has been taken is gone from it, and when
// the last one goes a fresh lot comes out of the back.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=9000&scene=ArcadeHub`, { waitUntil: 'networkidle2' });
  await sleep(2600);
  await page.mouse.click(640 + (185 - 160) * 4, 360 + (30 - 90) * 4); // the prize case
  await sleep(1200);

  const state = () => page.evaluate(() => window.__froggy.state());
  const slot = (i) => [
    640 + (52 + (i % 3) * 84 + 42 - 160) * 4,
    360 + (34 + Math.floor(i / 3) * 42 + 20 - 90) * 4,
  ];

  const opening = await state();
  await page.mouse.click(...slot(0));
  await sleep(800);
  const oneGone = await state();
  const taken =
    oneGone.prizesOwned.length === opening.prizesOwned.length + 1 && oneGone.tokens === opening.tokens - 40;
  console.log(`${taken ? 'PASS' : 'FAIL'}  prize counter: redeeming takes it off the shelf  — ${oneGone.prizesOwned.join(',')}`);
  if (!taken) failures++;

  for (let i = 1; i < 9; i++) {
    await page.mouse.click(...slot(i));
    await sleep(700);
  }
  const cleared = await state();
  await sleep(2200);
  const restocked = await state();
  const refilled = cleared.prizeWave === 0 && restocked.prizeWave === 1;
  console.log(
    `${refilled ? 'PASS' : 'FAIL'}  prize counter: clearing the shelf brings out new stock  — ` +
      `wave ${cleared.prizeWave} -> ${restocked.prizeWave}, ${restocked.prizesOwned.length} owned`,
  );
  if (!refilled) failures++;

  // The new lot is nine different things at the same prices.
  const fresh = await page.evaluate(async () => {
    const { prizesForWave } = await import('/src/game/content.ts');
    const a = prizesForWave(0);
    const b = prizesForWave(1);
    return {
      count: b.length,
      costs: b.map((p) => p.cost).join(','),
      baseCosts: a.map((p) => p.cost).join(','),
      names: b.map((p) => p.name),
      sameAsBase: b.some((p, i) => p.id === a[i].id),
    };
  });
  const goodStock = fresh.count === 9 && fresh.costs === fresh.baseCosts && !fresh.sameAsBase;
  console.log(
    `${goodStock ? 'PASS' : 'FAIL'}  prize counter: new stock keeps the price curve  — ${fresh.names.slice(0, 3).join(', ')}...`,
  );
  if (!goodStock) failures++;
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
  await bridge(page, '__fvl');

  const st = () => page.evaluate(() => window.__fvl.state());
  /**
   * Throw the solved arc on the frog's turn and wait for it to RESOLVE, rather
   * than for a fixed couple of seconds.  Flight is simulated per frame, so on a
   * loaded machine the arc takes longer in wall-clock than it does on an idle
   * one, and a fixed sleep read the damage before the rock had landed — which
   * looked like "the rock does nothing" rather than like a slow test.
   */
  const hit = async (item) => {
    await page.evaluate(() => window.__fvl.setWind(0));
    await page.evaluate((i) => window.__fvl.autoThrow(i), item);
    // off the ground...
    for (let i = 0; i < 40; i++) {
      if ((await st()).phase !== 'aim') break;
      await sleep(50);
    }
    // ...and back down, whoever's turn it is now.
    for (let i = 0; i < 160; i++) {
      const s = await st();
      if (s.phase === 'aim' || s.phase === 'roundEnd' || s.phase === 'over') break;
      await sleep(50);
    }
    return st();
  };

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


  // The first throw waits for the frog's turn like every other one: the game
  // opens on a round card now, and a throw into that is a throw into nothing.
  const before = await waitForFrog();
  const afterRock = await hit('rock');
  const rockDmg = before.lizard.hp - afterRock.lizard.hp;
  const rockOk = rockDmg === 14;
  console.log(`${rockOk ? 'PASS' : 'FAIL'}  frog vs lizard: the rock lands its ordinary damage  — ${rockDmg}`);
  if (!rockOk) failures++;

  // Wait out the lizard's reply, then take the frog's turn again.  The match
  // is a single round now, so a frog that runs out of health ends the game and
  // takes the rest of these checks with it: top it back up on the way through.
  // What is under test is the items, not whether the lizard can aim.
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
