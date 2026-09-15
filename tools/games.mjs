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
  { id: 'pinball', drive: async (p) => { await p.keyboard.down('Space'); await sleep(400); await p.keyboard.up('Space'); for (let i = 0; i < 6; i++) { await p.keyboard.press('KeyA'); await sleep(200); await p.keyboard.press('KeyD'); await sleep(200); } } },
  { id: 'frograce', drive: async (p) => { await p.keyboard.press('Digit3'); await sleep(300); await p.keyboard.press('Space'); await sleep(2400); } },
  { id: 'poker', drive: async (p) => { for (let i = 0; i < 4; i++) { await p.keyboard.press('KeyC'); await sleep(900); } } },
  { id: 'findthefrog', drive: async (p) => { await p.evaluate(() => window.__find?.tapFrog()); await sleep(600); await p.evaluate(() => window.__find?.tapFrog()); await sleep(600); } },
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

// FIND THE FROG is one puzzle repeated five times, so the two things that must
// hold are that there is exactly ONE frog in the tank and that a wrong tap is
// a cost rather than a loss.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=findthefrog`, { waitUntil: 'networkidle2' });
  await sleep(1700);
  await startGame(page);
  await bridge(page, '__find');
  const st = () => page.evaluate(() => window.__find.state());

  // One frog, and a crowd of things that are not it.
  const a = await st();
  const alone = a.frogs === 1 && a.critters > 10;
  console.log(`${alone ? 'PASS' : 'FAIL'}  find the frog: one frog in a crowd  — ${a.frogs} of ${a.critters}`);
  if (!alone) failures++;

  // Tapping it counts, and restocks the tank with MORE things than before.
  await page.evaluate(() => window.__find.tapFrog());
  await sleep(500);
  const b = await st();
  const counted = b.finds === 1 && b.critters > a.critters && b.frogs === 1;
  console.log(
    `${counted ? 'PASS' : 'FAIL'}  find the frog: finding it counts and the tank fills up  — ` +
      `${a.finds}->${b.finds} finds, ${a.critters}->${b.critters} in the tank`,
  );
  if (!counted) failures++;

  // And tapping the wrong thing costs seconds, not the round.
  const before = (await st()).left;
  await page.evaluate(() => {
    const d = window.__find.state().decoy;
    if (d) window.__find.tap(d.x, d.y);
  });
  await sleep(250);
  const after = await st();
  const survived = !after.over && after.lives === 3 && after.left < before;
  console.log(
    `${survived ? 'PASS' : 'FAIL'}  find the frog: a wrong tap costs time, not the run  — ` +
      `${before}s -> ${after.left}s, ${after.lives} lives, over=${after.over}`,
  );
  if (!survived) failures++;
  await page.close();
}

// TEXAS POKER lives or dies on its hand evaluator, so it is checked against
// hands whose order is not a matter of opinion.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${URL}/?intro=1&tokens=50&game=poker`, { waitUntil: 'networkidle2' });
  await sleep(1700);
  await startGame(page);
  await bridge(page, '__poker');

  const ranked = await page.evaluate(() => {
    const r = (cards) => window.__poker.rank(cards);
    return {
      // Strictly increasing, or the evaluator has its categories out of order.
      ladder: [
        r(['2C', '7D', '9H', 'JS', 'KC']), // high card
        r(['2C', '2D', '9H', 'JS', 'KC']), // a pair
        r(['2C', '2D', '9H', '9S', 'KC']), // two pair
        r(['2C', '2D', '2H', '9S', 'KC']), // trips
        r(['3C', '4D', '5H', '6S', '7C']), // straight
        r(['2C', '5C', '9C', 'JC', 'KC']), // flush
        r(['2C', '2D', '2H', '9S', '9C']), // full house
        r(['2C', '2D', '2H', '2S', '9C']), // quads
        r(['3C', '4C', '5C', '6C', '7C']), // straight flush
      ],
      // The wheel is a straight and the ace plays low in it.
      wheel: r(['AC', '2D', '3H', '4S', '5C']) > r(['AC', 'KD', 'QH', 'JS', '9C']),
      // Seven cards: the best five are found, not the first five.
      seven: r(['AC', 'AD', 'KH', 'KS', '2C', '2D', '2H']) > r(['AC', 'AD', 'KH', 'KS', 'QC', '9D', '3H']),
      // And a better kicker wins with the same pair.
      kicker: r(['AC', 'AD', 'KH', '9S', '3C']) > r(['AC', 'AD', 'QH', '9S', '3C']),
    };
  });
  const ordered = ranked.ladder.every((v, i) => i === 0 || v > ranked.ladder[i - 1]);
  const ok = ordered && ranked.wheel && ranked.seven && ranked.kicker;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  poker: the evaluator ranks hands correctly  — ` +
      `ladder ${ordered ? 'ordered' : 'OUT OF ORDER'}, wheel ${ranked.wheel}, 7-card ${ranked.seven}, kicker ${ranked.kicker}`,
  );
  if (!ok) failures++;

  // Five opponents, five different styles, and the table actually deals.
  const table = await page.evaluate(() => window.__poker.state());
  const dealt = table.hole.length === 2 && table.seats.length === 6;
  const styles = new Set(table.seats.map((x) => x.style).filter(Boolean));
  console.log(
    `${dealt && styles.size === 5 ? 'PASS' : 'FAIL'}  poker: six seats, two cards, five styles  — ` +
      `${table.seats.length} seats, hole ${table.hole.join(' ')}, styles ${[...styles].join('/')}`,
  );
  if (!dealt || styles.size !== 5) failures++;
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

  const s = await page.evaluate(() => window.__race.sample(600));
  const fav = s.favourite;
  // Every colour wins sometimes: no frog on this machine is a dud or a lock.
  const spread = s.wins.filter((n) => n > 0).length;
  const fair = fav > 0.28 && fav < 0.62 && spread === 7;
  console.log(
    `${fair ? 'PASS' : 'FAIL'}  frog race: the favourite wins often, not always  — ` +
      `${(fav * 100).toFixed(0)}% of 600, ${spread}/7 colours won at least one`,
  );
  if (!fair) failures++;
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

// The two score-for-tokens cabinets.  Their payout is a formula, not a
// cabinet constant, so the shell has to be handed the right number: the bar
// pays the base, and every further bar adds one.  Banking on ENTER is the
// path a player who has made the bar actually takes.
for (const g of [
  // The bar is 50 points (five crossings) and every further bar adds one:
  // 230 banks the base fifteen plus three.
  { id: 'frogcross', hook: '__frog', set: 'setPoints', score: 230, expect: 18, label: '230 pts' },
  // 300 cash is fifteen, and every hundred past it is five more: 600 is three
  // hundreds past the bar, so thirty.
  { id: 'carchase', hook: '__chase', set: 'setCash', score: 600, expect: 30, label: '600 cash' },
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
  await page.goto(`${URL}/?intro=1&tokens=2&game=poker`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  const brokeBefore = await tokens();
  await page.mouse.click(...PLAY);
  await sleep(900);
  const broke = { tokens: await tokens(), card: await cardUp(page) };
  const refused = broke.card && broke.tokens === brokeBefore;
  console.log(
    `${refused ? 'PASS' : 'FAIL'}  a 7-token cabinet will not start on 2 tokens  — ` +
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
  const OWN_RULES = ['slots', 'wheel', 'blackjack', 'roulette', 'frogcross', 'carchase'];
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

  // ---- nitro has to buy room.  With a chaser on the bumper, a burst must
  // put real distance between the two cars rather than being a noise the game
  // makes while they stay exactly where they were.
  await page.evaluate(() => {
    window.__chase.clearRoad();
    window.__chase.setCash(0);
    window.__chase.setPlayer(window.__chase.laneX(1), 120);
    window.__chase.spawnPolice(1, 150);
    window.__chase.setNitro(2);
  });
  await sleep(700);
  const onTheBumper = await st();
  await page.keyboard.press('Space'); // nitro
  await sleep(1400);
  const midBurst = await st();
  const gapBefore = (onTheBumper.cars[0]?.y ?? 0) - onTheBumper.player.y;
  const gapAfter = (midBurst.cars[0]?.y ?? 0) - midBurst.player.y;
  const roomToBreathe = !midBurst.cars.length || gapAfter > gapBefore + 20;
  console.log(
    `${roomToBreathe ? 'PASS' : 'FAIL'}  car chase: a nitro burst opens a real gap  — ` +
      `${Math.round(gapBefore)}px -> ${midBurst.cars.length ? `${Math.round(gapAfter)}px` : 'off the road'}`,
  );
  if (!roomToBreathe) failures++;

  // ---- and driving into one ends the run.  Sweep the road, lay a fresh strip
  // at the top of it, then park in a lane the spikes cover and let it arrive:
  // nothing else on the road can reach the car, so the strip is what got it.
  await page.evaluate(() => {
    window.__chase.clearRoad();
    // The nitro test above swept the road and put the bag back to nothing;
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

// CHAMBER pays by the pull and holds the pot on the machine: five tokens in,
// three a clean pull, five pulls at most, and the live round takes whatever is
// sitting there.  Both endings are rigged here because one in six is not a
// thing a test can wait for.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const run = async (pulls, ending) => {
    await page.goto(`${URL}/?intro=1&tokens=40&game=roulette`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    await startGame(page);
    await bridge(page, '__chamber');
    const before = await page.evaluate(() => window.__froggy.state().tokens);
    for (let i = 0; i < pulls; i++) {
      await page.evaluate(() => {
        window.__chamber.rig('clean');
        window.__chamber.pull();
      });
      await sleep(1100);
    }
    if (ending === 'live') {
      await page.evaluate(() => {
        window.__chamber.rig('live');
        window.__chamber.pull();
      });
      await sleep(1200);
    } else if (ending === 'walk') {
      await page.evaluate(() => window.__chamber.walk());
    }
    const state = await page.evaluate(() => window.__chamber.state());
    await sleep(4200);
    const after = await page.evaluate(() => window.__froggy.state().tokens);
    return { state, banked: after - before };
  };

  const walked = await run(2, 'walk');
  const ok1 = walked.state.survived === 2 && walked.banked === 6;
  console.log(`${ok1 ? 'PASS' : 'FAIL'}  chamber: two clean pulls and you walk with six  — ${walked.state.survived} clean, banked ${walked.banked}`);
  if (!ok1) failures++;

  const shot = await run(3, 'live');
  const ok2 = shot.state.pot === 0 && shot.banked === 0;
  console.log(`${ok2 ? 'PASS' : 'FAIL'}  chamber: the live round takes the lot  — nine on the machine, banked ${shot.banked}`);
  if (!ok2) failures++;

  const full = await run(5, 'none');
  const ok3 = full.state.survived === 5 && full.banked === 15;
  console.log(`${ok3 ? 'PASS' : 'FAIL'}  chamber: five clean is the most it pays  — ${full.state.survived} pulls, banked ${full.banked}`);
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
  const band = (want, got, tol = 0.006) => Math.abs(got - want) <= tol;

  const five = share(500);
  const twoHundred = share(200);
  const seventy = share(70);
  const sixty = share(60);
  const fifty = share(50);
  const forty = share(40);
  const small = [1, 2, 3, 5, 7, 10, 15].reduce((a, v) => a + share(v), 0);
  const nothing = share(0);

  const ok =
    band(0.01, five, 0.003) &&
    band(0.05, twoHundred) &&
    band(0.1, seventy) &&
    band(0.1, sixty) &&
    band(0.1, fifty) &&
    band(0.15, forty) &&
    band(0.39, small, 0.01) &&
    band(0.1, nothing);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  wheel: the faces pay at the odds asked for  — ` +
      `500 ${(five * 100).toFixed(2)}%, 200 ${(twoHundred * 100).toFixed(1)}%, 70 ${(seventy * 100).toFixed(1)}%, ` +
      `60 ${(sixty * 100).toFixed(1)}%, 50 ${(fifty * 100).toFixed(1)}%, 40 ${(forty * 100).toFixed(1)}%, ` +
      `1-15 ${(small * 100).toFixed(1)}%, none ${(nothing * 100).toFixed(1)}%`,
  );
  if (!ok) failures++;

  // And a spin pays what it landed on, ONCE, through the ledger and nowhere
  // else: the net move for one spin is the face minus the price of the go.
  const SPIN = 30;
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

  // ---- it is a match now, best of three, and every round is a new song cut
  // fresh: different tune, different tempo, different arrows.  Take the first
  // round and he has to come back harder for the second.
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

  // Two rounds takes the match, and the match pays the cabinet's reward
  // through the shell.
  const before = await page.evaluate(() => window.__froggy.state().tokens);
  await page.evaluate(() => {
    window.__dance.ace();
    window.__dance.finish();
  });
  await sleep(4200);
  const after = await page.evaluate(() => window.__froggy.state().tokens);
  const pays = after - before === 15;
  console.log(`${pays ? 'PASS' : 'FAIL'}  dance off: taking the match pays the fifteen  — ${before} -> ${after}`);
  if (!pays) failures++;
  await page.close();
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
  for (let i = 0; i < 4; i++) {
    const ladder = await page.evaluate(() => window.__flood.ladder());
    towers.push(ladder);
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
  const bad = [];
  towers.forEach((t, i) => {
    if (!reachable(t)) bad.push(`tower ${i + 1} has no way up`);
  });
  const climbable = bad.length === 0 && towers.every((t) => t.length > 18);
  console.log(
    `${climbable ? 'PASS' : 'FAIL'}  the flood: every tower has a way to the top  — ` +
      `${towers.length} towers, ${towers[0].length} ledges, leap ${reach.leap} span ${reach.span}` +
      (bad.length ? `; ${bad.slice(0, 3).join(', ')}` : ''),
  );
  if (!climbable) failures++;

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

// THE RESPITE.  Nitro and a crash both buy ten seconds with nobody on you,
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

  await page.evaluate(() => window.__chase.setNitro(2));
  await page.keyboard.press('Space');
  await sleep(600);
  const quiet = await st();
  const cleared = !quiet.gone && busy.chasing > 0 && quiet.chasing === 0 && quiet.respite > 8000;
  console.log(
      `${cleared ? 'PASS' : 'FAIL'}  car chase: nitro clears the road for ten seconds  — ` +
        (quiet.gone
          ? 'the run ended first'
          : `${busy.chasing} chasing -> ${quiet.chasing}, ${Math.round(quiet.respite / 100) / 10}s left`),
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
  await sleep(7000);
  const back = await st();
  const gentle = !back.gone && back.respite === 0 && back.police <= 2;
  console.log(
      `${gentle ? 'PASS' : 'FAIL'}  car chase: they come back one at a time  — ` +
        (back.gone ? 'the run ended first' : `${back.police} on the road, cap ${back.policeCap}`),
  );
  if (!gentle) failures++;
  await page.close();
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
