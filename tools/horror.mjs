/**
 * The horror act: the turn, the transformation, and the three hide-and-seek
 * rooms behind the door.
 *
 *   node tools/horror.mjs [--url http://localhost:5173]
 *
 * The beat only works if it is quiet and then it is not, so the things worth
 * asserting are the timings and the state transitions — a scare that fires late,
 * or a door that leads back the way you came, is the whole thing ruined.
 */

import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const URL = arg('--url', 'http://localhost:5173');
const SHOTS = 'tools/shots/horror';
mkdirSync(SHOTS, { recursive: true });

const CHROME = [
  // CI and container images keep Chrome somewhere else entirely; CHROME_PATH
  // wins, and the pinned path is what this repo's dev container ships.
  process.env.CHROME_PATH ?? '',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].find((p) => existsSync(p));
if (!CHROME) {
  console.error('No Chrome/Edge found.');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let failed = 0;
// Counted rather than written down.  The total was a literal, and it had
// already drifted four behind the checks actually being run -- a summary line
// that is maintained by hand is a summary line that quietly lies.  A run that
// dies early never reaches this: the catch at the bottom prints the throw and
// exits 1 without a summary at all.
let ran = 0;
const check = (name, ok, note = '') => {
  ran++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  — ${note}` : ''}`);
  if (!ok) failed++;
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--autoplay-policy=no-user-gesture-required'],
});

const newPage = async (qs) => {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|vite\.svg/i.test(t)) errors.push(`console.error: ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${URL}/${qs}`, { waitUntil: 'networkidle2' });
  await sleep(2500);
  await page.mouse.click(640, 60); // audio unlock + canvas focus, in the title bar
  await sleep(400);
  return page;
};

/** Every pixel of the overlay canvas, for "how much of the frame is he". */
let GAME_PIXELS = 1;

const overlayPixels = (page) =>
  page.evaluate(() => {
    const c = document.getElementById('froggy-layer');
    if (!c) return -1;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });

try {
  // ------------------------------------------------------------- the turn
  console.log('\nhorror  you turn around and he is stood across the room');
  {
    const page = await newPage('?intro=1&charity=1&key=1&route=basement&scene=BasementSequence');
    await page.evaluate(() => window.__froggy.game().scene.getScene('BasementSequence').show(8));
    await sleep(1100);

    GAME_PIXELS = await page.evaluate(() => {
      const c = document.getElementById('froggy-layer');
      return c ? c.width * c.height : 1;
    });
    const a = await overlayPixels(page);
    await page.screenshot({ path: `${SHOTS}/01-stare.png` });
    check('he is on screen for the stare', a > 2000, `${a} overlay px`);
    check('and he is small in the frame, not on top of you', a < GAME_PIXELS * 0.2,
      `${((a / GAME_PIXELS) * 100).toFixed(1)}% of the frame`);

    // Unnaturally still: the overlay must not change while he is staring.
    const b = await overlayPixels(page);
    await sleep(500);
    const c = await overlayPixels(page);
    check('he does not move a pixel while staring', b === c, `${b} vs ${c}`);

    // Three seconds of that, and then he crosses the room in one go.  The
    // rules of the game he wants to play are told on the far side of the door,
    // not here — see the briefing in HideRoom3D.
    const frame = () => page.evaluate(() => window.__froggy.game().scene.getScene('BasementSequence').index);
    let waited = 0;
    while ((await frame()) === 8 && waited < 6000) {
      await sleep(250);
      waited += 250;
    }
    check('the stare holds for about three seconds', waited >= 1500 && waited <= 4500, `${waited}ms`);
    check('and then it is its own frame', (await frame()) === 9, `frame ${await frame()}`);

    await sleep(1400);
    const during = await overlayPixels(page);
    await page.screenshot({ path: `${SHOTS}/02-transform.png` });
    check('he closes the distance and fills the frame', during > a * 3, `${a} -> ${during} px`);

    waited = 0;
    while ((await frame()) === 9 && waited < 8000) {
      await sleep(250);
      waited += 250;
    }
    check('it ends on the way out, not the way in', (await frame()) === 10, `frame ${await frame()}`);
    check('the overlay is cleared for the door', (await overlayPixels(page)) === 0);
    await page.screenshot({ path: `${SHOTS}/03-door.png` });

    // The hotspot only exists once the crossfade into the frame has finished.
    await sleep(1400);
    await page.mouse.click(640, 360 + (100 - 90) * 4);
    await sleep(3000);
    const after = await page.evaluate(() => ({
      scenes: window.__froggy.activeScenes(),
      state: window.__froggy.state(),
    }));
    check('the door leads on to the rooms', after.scenes.includes('HideRoom3D'), after.scenes.join(','));
    check('the route commits to hide', after.state.route === 'hide' && after.state.hideRoom === 0,
      `route=${after.state.route} room=${after.state.hideRoom}`);
    await page.close();
  }

  // --------------------------------------------------------------- the room
  console.log('\nhorror  the room he locks you in');
  {
    const page = await newPage('?intro=1&charity=1&key=1&route=hide&hideRoom=0&scene=HideRoom3D');
    const hide = () => page.evaluate(() => window.__hide ?? null);

    // The room reports what it made a noise doing (window.__hide.heard), which
    // is the only way to test a round the player is meant to play by ear.
    const sfx = () => page.evaluate(() => (window.__hide?.heard ?? []).map((h) => [h.name, h.gain]));

    const intro = await hide();
    check('the round opens on him telling you the rules', intro && intro.mode === 'briefing', intro?.mode);
    check('the count is ten seconds', intro.hideSeconds === 10, `${intro.hideSeconds}s`);

    // Nothing moves while he talks: the player is frozen and so is he.
    await sleep(2500);
    const mid = await hide();
    check('you cannot walk off during the briefing',
      Math.hypot(mid.px - intro.px, mid.pz - intro.pz) < 0.01,
      `moved ${Math.hypot(mid.px - intro.px, mid.pz - intro.pz).toFixed(2)}m`);

    // Sit through the whole thing rather than skipping it: the speech and then
    // ten seconds to hide, both of which the player is meant to be able to use.
    let waitedForCount = 0;
    while (waitedForCount < 24000 && (await hide()).mode === 'briefing') {
      await sleep(500);
      waitedForCount += 500;
    }
    check('the briefing hands over to the count', (await hide()).mode === 'hiding',
      `after ${(waitedForCount / 1000).toFixed(1)}s`);

    await sleep(11000);
    let s = await hide();
    check('the count hands over to the search', s.mode === 'seeking', s.mode);
    // The test player stands in the open at the door for the next while.  He
    // is faster and sharper than he was, and catching a mannequin ends the
    // scene under the rest of these checks, so he is kept blind until a check
    // wants him otherwise.
    await page.evaluate(() => {
      window.__froggy.game().scene.getScene('HideRoom3D').grace = 999;
    });
    // Two minutes in the first zone, because that is the number he says out
    // loud at its door.  Later zones are longer; this one is where you learn.
    check('he then has the zone-one clock, two minutes', s.seekSeconds === 120 && s.secondsLeft > 110,
      `${s.seekSeconds}s, ${s.secondsLeft?.toFixed(0)} left`);
    check('there is cover to hide in', s.spots.length >= 5, `${s.spots.length} spots`);
    check('the spots are not all the same thing',
      new Set(s.spots.map((x) => x.kind)).size > 1, [...new Set(s.spots.map((x) => x.kind))].join(','));
    // Being inside the footprint of a sofa is only wrong if he is stuck in it:
    // he goes OVER furniture now, and mid-climb he is legitimately on top of it.
    check('he is not wedged inside the furniture', !s.dbg.froggyBlocked || s.climbing,
      s.climbing ? 'mid-climb' : 'on open floor');
    await page.screenshot({ path: `${SHOTS}/room1.png` });

    // He has to actually patrol.  Sampled over a long window on purpose: he
    // legitimately stands still to listen for up to two and a half seconds, so
    // a short sample can catch him mid-pause and prove nothing.
    let travelled = 0;
    let prev = { x: s.fx, z: s.fz };
    for (let i = 0; i < 10; i++) {
      await sleep(800);
      s = await hide();
      travelled += Math.hypot(s.fx - prev.x, s.fz - prev.z);
      prev = { x: s.fx, z: s.fz };
    }
    check('he searches the room on his own', travelled > 3, `covered ${travelled.toFixed(1)}m in 8s`);

    // The corner behind a partition.  Room 0's first partition runs into the
    // back wall; a waypoint two metres away on the far side of it is one he
    // cannot reach, and he used to shoulder the outer wall there for the rest
    // of the round.  He has to give the trip up and go somewhere else.
    const corner = { x: -8, z: -12.8 };
    await page.evaluate((c) => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      sc.grace = 99;
      sc.climb = null;
      sc.fMode = 'search';
      sc.froggy.set(c.x, c.z);
      sc.waypoint.set(-4.5, c.z);
      sc.startTrip();
    }, corner);
    // Sampled, because once he has given up he may already be stood at the next
    // spot opening it: what matters is that he left, not where he is right now.
    let farthest = 0;
    for (let i = 0; i < 14; i++) {
      await sleep(500);
      s = await hide();
      farthest = Math.max(farthest, Math.hypot(s.fx - corner.x, s.fz - corner.z));
    }
    const gaveUp = await page.evaluate((c) => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      return Math.hypot(sc.waypoint.x + 4.5, sc.waypoint.y - c.z) > 0.01;
    }, corner);
    // Either answer is right: a route round the partition, or a different spot.
    // What is wrong is staying put.
    check('walled off from a waypoint, he routes round or goes somewhere else',
      farthest > 2.5 && !s.dbg.froggyBlocked,
      `${gaveUp ? 'new waypoint' : 'same waypoint, routed'}, got ${farthest.toFixed(1)}m from the corner`);

    // The controls, driven for real through the keyboard rather than by poking
    // the scene: getting between two boxes before he arrives is the whole game,
    // so which way each key sends you is a requirement, not a preference.
    // A patch of lounge with floor on all four sides of it.  The room gets
    // re-laid out from time to time, so the spot is asserted open rather than
    // assumed: a park that lands inside a sofa reads as "the keys do nothing".
    const PARK = { x: -2, z: 12 };
    const park = () =>
      page.evaluate((p) => {
        const sc = window.__froggy.game().scene.getScene('HideRoom3D');
        sc.hiding = null;
        sc.yaw = 0;
        sc.grace = 99;
        sc.pos.set(p.x, p.z);
        sc.froggy.set(sc.def.halfW - 2, -sc.def.halfD + 2);
        return !sc.solid(p.x, p.z);
      }, PARK);
    check('there is open floor to test the walking on', await park(), `${PARK.x},${PARK.z}`);
    const walk = async (key) => {
      await park();
      await sleep(120);
      const a = await hide();
      await page.keyboard.down(key);
      await sleep(400);
      await page.keyboard.up(key);
      await sleep(60);
      const b = await hide();
      return { dx: b.px - a.px, dz: b.pz - a.pz };
    };
    const w = await walk('KeyW');
    const sKey = await walk('KeyS');
    const aKey = await walk('KeyA');
    const d = await walk('KeyD');
    check('W and S walk you forward and back',
      w.dz < -0.3 && sKey.dz > 0.3 && Math.abs(w.dx) < 0.2 && Math.abs(sKey.dx) < 0.2,
      `W ${w.dz.toFixed(2)}, S ${sKey.dz.toFixed(2)}`);
    check('A and D step you left and right, not turn you',
      aKey.dx < -0.3 && d.dx > 0.3 && Math.abs(aKey.dz) < 0.2 && Math.abs(d.dz) < 0.2,
      `A ${aKey.dx.toFixed(2)}, D ${d.dx.toFixed(2)}`);

    const look = await page.evaluate(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      const move = (x) => window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: 300, bubbles: true }));
      sc.yaw = 0;
      move(400);
      move(520);
      const idle = sc.yaw;
      window.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 520, clientY: 300, bubbles: true }));
      move(600);
      const held = sc.yaw;
      window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
      move(900);
      return { idle, held, released: sc.yaw };
    });
    check('holding left click turns the view', Math.abs(look.held - look.idle) > 0.1,
      `${look.idle.toFixed(2)} -> ${look.held.toFixed(2)}`);
    check('the view does not follow the mouse when the button is up',
      look.idle === 0 && look.released === look.held,
      `idle ${look.idle}, after release ${look.released.toFixed(2)}`);

    // Furniture is cover, not a wall.  Two separate guarantees, and they are
    // checked separately on purpose: (1) a sofa between the two of you is not
    // permanent safety — he gets to the far side of it one way or another, and
    // (2) when he does go over one he is genuinely up on top of it.  Which of
    // the two routes his pathfinder picks on any given sofa is a property of
    // how open the room is, and rooms get re-laid out; the guarantees do not.
    const reached = await page.evaluate(async () => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      const sofa = sc.def.furniture.find((f) => f.low && f.w > 3);
      sc.hiding = null;
      sc.grace = 999;
      sc.pos.set(sofa.x, sofa.z + 10);
      sc.froggy.set(sofa.x, sofa.z + 2.2);
      sc.fMode = 'search';
      sc.waypoint.set(sofa.x, sofa.z - 2.2);
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 50));
        if (sc.froggy.y < sofa.z - 0.5) break;
      }
      return { crossed: sc.froggy.y < sofa.z, top: sofa.h };
    });
    check('a sofa between you is not permanent cover — he gets past it',
      reached.crossed, `${reached.top}m of sofa, crossed ${reached.crossed}`);

    const climbed = await page.evaluate(async () => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      const sofa = sc.def.furniture.find((f) => f.low && f.w > 3);
      sc.hiding = null;
      sc.grace = 999;
      sc.climb = null;
      sc.froggy.set(sofa.x, sofa.z + 1.0);
      // Straight over it, the way the route asks for one when there is no way
      // round: the mechanic itself, not the decision to use it.
      const started = sc.startClimb(sofa, 0, -1);
      let highest = 0;
      let wentOver = false;
      for (let i = 0; i < 80; i++) {
        await new Promise((r) => setTimeout(r, 50));
        if (window.__hide.climbing) wentOver = true;
        highest = Math.max(highest, sc.monster.root.position.y);
        if (!sc.climb && wentOver) break;
      }
      return { started, wentOver, highest, crossed: sc.froggy.y < sofa.z, top: sofa.h };
    });
    check('he climbs over the furniture rather than stopping at it',
      climbed.started && climbed.wentOver && climbed.crossed,
      `started ${climbed.started}, over ${climbed.top}m, crossed ${climbed.crossed}`);
    check('he is actually up on top of it while he does',
      climbed.highest > climbed.top * 0.8, `${climbed.highest.toFixed(2)}m up`);

    // Hiding, and what hiding costs.
    await page.evaluate(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      sc.pos.set(sc.spots[0].x, sc.spots[0].z);
      sc.froggy.set(sc.spots[0].x, sc.spots[0].z + 5);
    });
    await sleep(300);
    await page.keyboard.press('KeyE');
    await sleep(600);
    s = await hide();
    check('E puts you inside a hiding place', s.hiding === true);
    await page.screenshot({ path: `${SHOTS}/room1-peephole.png` });

    // Clear whatever he was doing first: repositioning the player above can
    // legitimately have put him in a chase, and his memory of it outlasts the
    // check.  Then stand him in front of the chest and stare.
    //
    // THREE AND A HALF METRES, NOT TWO.  At two he is inside ARRIVE_DIST of
    // the spot, so `arrive` can roll to OPEN it -- and opening the box the
    // player is inside is a legitimate catch, which restarts the scene and
    // fails the next eight checks for reasons that have nothing to do with
    // them.  That made this a coin flip on `Math.random`.  Out here he can see
    // the spot from well inside his thirteen-metre sight range and cannot
    // reach it, which is the thing this check is actually about.
    const hiddenSeen = await page.evaluate(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      sc.fMode = 'search';
      sc.memory = 0;
      sc.froggy.set(sc.pos.x, sc.pos.y + 3.5);
      sc.waypoint.set(sc.froggy.x, sc.froggy.y);
      sc.targetSpot = null;
      sc.froggyYaw = Math.atan2(sc.pos.x - sc.froggy.x, sc.pos.y - sc.froggy.y);
      return { hidden: sc.hiding !== null };
    });
    await sleep(900);
    s = await hide();
    check('hidden, he does not acquire you', hiddenSeen.hidden && s.froggyMode !== 'chase',
      `mode ${s.froggyMode}`);

    // Coming out of a box leaves you standing in its collision volume unless
    // something moves you clear of it, and a player who cannot walk for the
    // first second after unhiding is a player who gets caught.
    const out = await page.evaluate(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      sc.grace = 999;
      sc.froggy.set(sc.def.halfW - 2, -sc.def.halfD + 2);
      const bad = [];
      for (const spot of sc.spots) {
        sc.hiding = spot;
        sc.pos.set(spot.x, spot.z);
        sc.yaw = 0;
        sc.interact();
        if (sc.solid(sc.pos.x, sc.pos.y)) bad.push(spot.kind);
      }
      sc.hiding = null;
      return bad;
    });
    check('you step clear of a hiding place when you leave it', out.length === 0, out.join(','));

    await page.evaluate(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      sc.hiding = sc.spots[0];
      sc.pos.set(sc.spots[0].x, sc.spots[0].z);
    });
    await sleep(150);
    await page.keyboard.press('KeyE');
    await sleep(150);
    const before = await hide();
    await page.keyboard.down('KeyW');
    await sleep(400);
    await page.keyboard.up('KeyW');
    const after = await hide();
    check('W A S D work the moment you are out',
      Math.hypot(after.px - before.px, after.pz - before.pz) > 0.4,
      `${Math.hypot(after.px - before.px, after.pz - before.pz).toFixed(2)}m`);

    // He opens the places you can hide in.  Left alone long enough, a spot is
    // one he WILL come to — so this drives the staleness rather than the dice.
    const opened = await page.evaluate(async () => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      // Stay hidden across the room while he works: an exposed player standing
      // six metres from him gets chased, caught and restarted, which tests the
      // chase rather than the search.
      sc.hiding = sc.spots[5];
      const spot = sc.spots[1];
      spot.sinceChecked = 999;
      sc.pos.set(sc.spots[5].x, sc.spots[5].z);
      sc.froggy.set(spot.x + 2.4, spot.z);
      sc.fMode = 'search';
      sc.memory = 0;
      sc.waypoint.set(spot.x, spot.z);
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 100));
        if (spot.open > 0.05) return true;
      }
      return false;
    });
    check('he opens the hiding places to look inside', opened === true);

    // What the player actually plays by: his feet, and the lids.
    const heard = await sfx();
    const steps = heard.filter(([n]) => n === 'froggy_step');
    const opens = heard.filter(([n]) => n === 'spot_open');
    check('you can hear him moving about the room', steps.length > 0, `${steps.length} steps`);
    check('his footsteps are quieter the further away he is',
      steps.length > 1 && Math.min(...steps.map((x) => x[1])) < Math.max(...steps.map((x) => x[1])),
      steps.length > 1 ? `${Math.min(...steps.map((x) => x[1]))}..${Math.max(...steps.map((x) => x[1]))}` : 'one step');
    check('opening a spot carries across the room', opens.length > 0 && opens.every((x) => x[1] >= 0.3),
      opens.map((x) => x[1]).join(','));
    check('nothing else is making noise in there',
      heard.every(([n]) =>
        ['froggy_step', 'spot_open', 'floor_creak', 'drip', 'hop_wet', 'step_walk', 'step_run', 'zone_clear', 'eerie_swell', 'door_creak', 'ui_hover'].includes(n),
      ),
      [...new Set(heard.map(([n]) => n))].join(','));

    // Lasting his clock out is the win.  The clock is the thing being
    // tested, so it gets wound forward rather than waited out.
    await page.evaluate(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      sc.hiding = null;
      sc.clock = 0.15;
    });
    await sleep(1200);
    check('running the clock out ends the round', (await hide()).mode === 'survived',
      (await hide())?.mode);
    await sleep(3400);
    const room = await page.evaluate(() => window.__froggy.state().hideRoom);
    check('surviving moves you on to the next room', room === 1, `room ${room}`);
    await page.close();
  }

  // ------------------------------------------------- the rooms, on the page
  // Furniture is added by hand, and a prop dropped on top of a hiding place
  // is invisible from anywhere except inside the game with a torch.  The
  // layout is checked as data instead: every spot reachable, nobody spawning
  // inside a box, and the three rooms in the sizes they are meant to be.
  console.log('\nhorror  the three rooms are laid out, not just built');
  {
    const page = await newPage('?intro=1');
    await sleep(1200);
    const rooms = await page.evaluate(async () => {
      const { ROOMS } = await import('/src/three/hideRooms.ts');
      const R = 0.42;
      const inBox = (x, z, b, pad) => Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad;
      return ROOMS.map((r) => ({
        name: r.name,
        w: r.halfW * 2,
        d: r.halfD * 2,
        spots: r.spots.length,
        blocked: r.spots.filter((sp) => r.furniture.some((f) => inBox(sp.x, sp.z, f, R + 0.6))).length,
        outside: r.spots.filter((sp) => Math.abs(sp.x) > r.halfW - 0.5 || Math.abs(sp.z) > r.halfD - 0.5).length,
        spawnBlocked: r.furniture.some((f) => inBox(r.spawn.x, r.spawn.z, f, R)),
        froggyBlocked: r.furniture.some((f) => inBox(r.froggyStart.x, r.froggyStart.z, f, R * 2)),
        pillars: r.furniture.filter((f) => f.h >= r.wallH && f.w <= 2 && f.d <= 2).length,
      }));
    });
    await page.close();

    check('nothing is parked on top of a hiding place',
      rooms.every((r) => r.blocked === 0), rooms.map((r) => `${r.name}:${r.blocked}`).join(' '));
    check('no hiding place is inside a wall',
      rooms.every((r) => r.outside === 0), rooms.map((r) => `${r.name}:${r.outside}`).join(' '));
    check('neither of you starts inside the furniture',
      rooms.every((r) => !r.spawnBlocked && !r.froggyBlocked),
      rooms.map((r) => `${r.name}:${r.spawnBlocked ? 'you' : ''}${r.froggyBlocked ? 'him' : ''}`).join(' '));
    // The stores is the middle room and must not be the biggest: it is the one
    // that played like an empty car park before it was pulled in.
    const [lounge, stores, ward] = rooms;
    check('the stores is not the largest room any more',
      stores.w * stores.d < lounge.w * lounge.d && stores.w * stores.d < ward.w * ward.d,
      rooms.map((r) => `${r.name} ${r.w}x${r.d}`).join(', '));
    check('the stores has pillars to break it up', stores.pillars >= 6, `${stores.pillars} pillars`);
  }


  // -------------------------------------------- the arcade, and the way out of it
  // The last of the four is the one the player ARRIVES in rather than is let
  // into: the third room ends and the next thing is the staff corner of the
  // arcade, with the desk wrapped round them and the front doors at the far
  // end.  It has no clock, nothing to hide in, and one thing to do.
  console.log('\nhorror  the arcade: up behind the counter, out through the glass');
  {
    const page = await newPage('?intro=1&charity=1&key=1&route=hide&hideRoom=3&scene=HideRoom3D');
    await sleep(3200);
    const hide = () => page.evaluate(() => window.__hide ?? null);
    const scene = (fn, ...a) => page.evaluate(fn, ...a);
    const press = async (key, ms) => {
      await page.keyboard.down(key);
      await sleep(ms);
      await page.keyboard.up(key);
    };

    const start = await hide();
    check('the arcade hands the controls straight back', start.mode === 'seeking', start.mode);
    check('and there is nothing in it to hide in', start.spots.length === 0, `${start.spots.length} spots`);
    // The first frame of the last room should be the room.  Spawning inside
    // the reach of the desk put a CLIMB OVER over it before the player had
    // touched anything.
    check('nothing is being offered on the first frame',
      start.prompt === '' && !start.atCounter && !start.atCase && !start.atDoor,
      start.prompt || 'no prompt');
    await page.screenshot({ path: `${SHOTS}/arcade-spawn.png` });

    // ---- IT IS THE LIT ROOM'S OWN FLOOR PLAN, not an impression of it.  Every
    // x below is `game/content.ts` through one linear map, so this asserts the
    // two rooms against each other rather than against numbers typed in here:
    // retuning the hub moves the 3D arcade with it or this fails.
    const plan = await page.evaluate(async () => {
      const { ARCADE } = await import('/src/three/hideRooms.ts');
      const { COUNTER, PRIZE_CASE, STAFF_DOOR, cabinetsIn } = await import('/src/game/content.ts');
      const K = 22 / 292;
      const to3d = (x) => (x - 160) * K;
      const front = ARCADE.counter.find((r) => r.axis === 'x');
      const returns = ARCADE.counter.filter((r) => r.axis === 'z').sort((a, b) => a.at - b.at);
      const cab = ARCADE.furniture.filter((f) => f.prop === 'cabinet');
      const box = ARCADE.furniture.find((f) => f.prop === 'case');
      const hub = cabinetsIn('hub');
      // inside the wrap: behind the front run and between the two returns
      const inside = (x, z) => z < front.at && x > returns[0].at && x < returns[1].at;
      return {
        counterFrom: front.from, wantCounterFrom: to3d(COUNTER.x),
        counterTo: front.to, wantCounterTo: to3d(COUNTER.x + COUNTER.w),
        caseX: ARCADE.prizeCase.x, wantCaseX: to3d(PRIZE_CASE.x + PRIZE_CASE.w / 2),
        caseW: box.w, wantCaseW: PRIZE_CASE.w * K,
        staffX: ARCADE.staffDoor.x, wantStaffX: to3d(STAFF_DOOR.x + 11),
        staffInsideCounterSpan: ARCADE.staffDoor.x > front.from && ARCADE.staffDoor.x < front.to,
        runs: ARCADE.counter.length,
        spawnInside: inside(ARCADE.spawn.x, ARCADE.spawn.z),
        caseInside: inside(ARCADE.prizeCase.x, ARCADE.prizeCase.z),
        // how much floor there is in front of the case to stand on and press E
        caseStandingRoom: front.at - 0.6 - 0.42 - (ARCADE.prizeCase.z + 0.45 + 0.42),
        cabinets: cab.length,
        hubCabinets: hub.length,
        // the four along the front wall, against their own 2D x
        frontRow: cab.filter((f) => f.z > 0).map((f) => f.x).sort((a, b) => a - b),
        wantFrontRow: hub.filter((c) => c.y > 140).map((c) => to3d(c.x)).sort((a, b) => a - b),
        facingTheCounter: cab.filter((f) => f.z > 0 && Math.abs(Math.abs(f.face) - Math.PI) < 0.01).length,
        onTheLeftWall: cab.filter((f) => f.x < -ARCADE.halfW + 1.2).length,
        extras: ARCADE.furniture.filter((f) => !f.prop && f.h < 1.1).length,
      };
    });
    const near = (a, b, tol = 0.35) => Math.abs(a - b) <= tol;
    check('the counter sits where the lit room puts it',
      near(plan.counterFrom, plan.wantCounterFrom) && near(plan.counterTo, plan.wantCounterTo),
      `${plan.counterFrom.toFixed(2)}..${plan.counterTo.toFixed(2)} want ` +
        `${plan.wantCounterFrom.toFixed(2)}..${plan.wantCounterTo.toFixed(2)}`);
    check('the prize case is the lit room\'s case, to scale',
      near(plan.caseX, plan.wantCaseX) && near(plan.caseW, plan.wantCaseW, 0.5),
      `x ${plan.caseX.toFixed(2)} want ${plan.wantCaseX.toFixed(2)}, ` +
        `w ${plan.caseW.toFixed(2)} want ${plan.wantCaseW.toFixed(2)}`);
    check('the staff door is where the lit room puts it, inside the counter span',
      near(plan.staffX, plan.wantStaffX) && plan.staffInsideCounterSpan,
      `x ${plan.staffX.toFixed(2)} want ${plan.wantStaffX.toFixed(2)}`);
    check('the four machines along the front are the lit room\'s four',
      plan.frontRow.length === 4 &&
        plan.frontRow.every((x, i) => near(x, plan.wantFrontRow[i])),
      plan.frontRow.map((x, i) => `${x.toFixed(1)}/${plan.wantFrontRow[i]?.toFixed(1)}`).join(' '));
    check('and they face back up the room at the counter, as it draws them',
      plan.facingTheCounter === 4, `${plan.facingTheCounter} of 4`);
    check('with the fifth against the left wall', plan.onTheLeftWall === 1,
      `${plan.onTheLeftWall} on the wall, ${plan.cabinets} machines for the hub\'s ${plan.hubCabinets}`);
    check('the counter wraps the staff corner on three sides', plan.runs === 3, `${plan.runs} runs`);
    check('you and the case are both inside the wrap',
      plan.spawnInside && plan.caseInside,
      `${plan.spawnInside ? 'you' : 'NOT you'}, ${plan.caseInside ? 'case' : 'NOT case'}`);
    check('with floor to stand on in front of the case', plan.caseStandingRoom > 1.5,
      `${plan.caseStandingRoom.toFixed(1)}m`);
    check('and nothing in the room the lit one does not have',
      plan.extras === 0, `${plan.extras} props that are not in the hub`);

    // ---- the staff corner is somewhere you can be, not a slot you are wedged
    // in.  Walked, not measured off the numbers.
    const box = {};
    for (const [name, key] of [['forward', 'w'], ['back', 's'], ['left', 'a'], ['right', 'd']]) {
      await scene(() => {
        const sc = window.__froggy.game().scene.getScene('HideRoom3D');
        sc.pos.set(sc.def.spawn.x, sc.def.spawn.z);
        sc.yaw = sc.def.spawnYaw ?? 0;
      });
      await sleep(120);
      await press(key, 3000);
      box[name] = await hide();
    }
    const acrossTheCorner = Math.abs(box.left.px - box.right.px);
    const downTheCorner = Math.abs(box.forward.pz - box.back.pz);
    check('there is room to move behind the counter',
      acrossTheCorner > 4 && downTheCorner > 1.5,
      `${acrossTheCorner.toFixed(1)}m across, ${downTheCorner.toFixed(1)}m deep`);
    check('walking forward out of it stops you at the counter',
      box.forward.atCounter && box.forward.prompt === '[E] CLIMB OVER',
      `at ${box.forward.pz.toFixed(2)}, ${box.forward.prompt}`);

    // ---- the case, on foot, from inside the wrap.
    //
    // The start is measured off the COUNTER rather than off the case: the
    // staff corner is only a couple of metres deep, and a fixed distance in
    // front of the case lands inside the desk, where the walk under test
    // cannot happen because the player is already stuck.
    await scene(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      const front = sc.def.counter.find((r) => r.axis === 'x');
      sc.pos.set(sc.def.prizeCase.x, front.at - 1.5);
      sc.yaw = 0;
    });
    await sleep(120);
    const approach = await hide();
    await press('w', 2500);
    const atCase = await hide();
    check('the case says nothing until you are standing at it',
      !approach.atCase && atCase.atCase, `${approach.prompt || 'nothing'} -> ${atCase.prompt}`);
    check('and E is offered when you get there', atCase.prompt === '[E] PRIZE CASE',
      `stopped at z ${atCase.pz.toFixed(2)}`);

    // ---- over the counter and back.  It is the only way onto the floor, and
    // cover you are not allowed back behind is not cover.
    await scene(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      const front = sc.def.counter.find((r) => r.axis === 'x');
      sc.pos.set(1.2, front.at - 1.1);
      sc.yaw = Math.PI;
    });
    await sleep(150);
    const beforeVault = await hide();
    await page.keyboard.press('e');
    await sleep(1400);
    const over = await hide();
    check('E puts you over the counter and onto the floor',
      over.vaulted && over.pz > beforeVault.pz, `${beforeVault.pz.toFixed(2)} -> ${over.pz.toFixed(2)}`);
    await page.keyboard.press('e');
    await sleep(1400);
    const back = await hide();
    check('and you can get back behind it', back.pz < over.pz, `${over.pz.toFixed(2)} -> ${back.pz.toFixed(2)}`);

    // ---- the doors.  Ten seconds, the feet nailed down, and no way to look
    // at what is walking up behind.
    await scene(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      sc.pos.set(sc.def.door.x, 4);
      sc.yaw = Math.PI;
    });
    await press('w', 4200);
    const atDoor = await hide();
    check('walking down the room brings you up at the doors',
      atDoor.atDoor && atDoor.prompt === '[E] UNLOCK', `z ${atDoor.pz.toFixed(1)}, ${atDoor.prompt}`);
    await page.keyboard.press('e');
    await sleep(700);
    const going = await hide();
    check('E starts the unlocking rather than opening anything',
      going.escaping && !going.keyOnFloor, `k ${going.escapeK.toFixed(2)}`);

    // ---- THE KEY GOES ON THE FLOOR, and the ending stops dead until the
    // player picks it up.  This is the half of the sequence the game hands
    // back, so it has to be genuinely waiting rather than waiting a bit.
    let dropped = 0;
    while (dropped < 5000 && !(await hide()).keyOnFloor) {
      await sleep(200);
      dropped += 200;
    }
    const onFloor = await hide();
    check('the key slips and lands on the floor', onFloor.keyOnFloor && !onFloor.keyTaken,
      `after ${(dropped / 1000).toFixed(1)}s`);
    check('it lands at the player\'s feet, not out of reach',
      Math.hypot(onFloor.keyX - onFloor.px, onFloor.keyZ - onFloor.pz) < 1.2,
      `${Math.hypot(onFloor.keyX - onFloor.px, onFloor.keyZ - onFloor.pz).toFixed(2)}m away`);
    // Nothing advances on its own from here.
    await sleep(3000);
    const stillThere = await hide();
    check('and nothing moves on until it is picked up',
      stillThere.keyOnFloor && !stillThere.keyTaken && stillThere.mode === 'seeking' && stillThere.chaseT === 0,
      `chaseT ${stillThere.chaseT}`);
    check('it does not prompt while the player is looking at the door',
      !stillThere.atKey && stillThere.prompt === '', stillThere.prompt || 'no prompt');
    // Look down at it.
    await scene(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      sc.pitch = -0.75;
    });
    await sleep(300);
    const lookingDown = await hide();
    check('looking down at it offers the pick-up', lookingDown.atKey && lookingDown.prompt === '[E] PICK IT UP',
      lookingDown.prompt || 'no prompt');
    await page.screenshot({ path: `${SHOTS}/arcade-key-down.png` });
    await page.keyboard.press('e');
    await sleep(500);
    const taken = await hide();
    check('E picks it up and starts what comes after', taken.keyTaken && taken.chaseT > 0,
      `chaseT ${taken.chaseT.toFixed(2)}`);

    // ---- AND FROM HERE THE VIEW IS NOT THE PLAYER'S AT ALL.  Not clamped to
    // a few degrees: pinned, so there is no looking for what is coming.
    let worstYaw = 0;
    let moved = 0;
    const heldAt = { x: taken.px, z: taken.pz };
    for (let i = 0; i < 8; i++) {
      await scene(() => {
        const sc = window.__froggy.game().scene.getScene('HideRoom3D');
        sc.yaw += 2.7;
        sc.pitch -= 1.4;
      });
      await press('ArrowLeft', 240);
      await sleep(140);
      const s = await hide();
      const off = Math.abs(Math.atan2(Math.sin(s.yaw - s.doorFacing), Math.cos(s.yaw - s.doorFacing)));
      worstYaw = Math.max(worstYaw, off);
      moved = Math.max(moved, Math.hypot(s.px - heldAt.x, s.pz - heldAt.z));
      if (i === 3) await page.screenshot({ path: `${SHOTS}/arcade-unlocking.png` });
    }
    check('once the key is back in his hand the camera is dead on the doors',
      worstYaw < 0.001, `${worstYaw.toFixed(4)} rad off them`);
    check('the feet do not move for the whole of it', moved < 0.01, `${moved.toFixed(3)}m`);

    const late = await hide();
    check('the shake builds as it runs out', late.tremble > taken.tremble,
      `${taken.tremble.toFixed(2)} -> ${late.tremble.toFixed(2)}`);
    // He never appears: this room has no monster in it at all.
    check('and he is never shown', late.froggyMeshes === 0, `${late.froggyMeshes} meshes`);

    let waited = 0;
    let sawCharge = false;
    while (waited < 14000 && (await hide())?.mode === 'seeking') {
      await sleep(300);
      waited += 300;
      if ((await hide())?.charging) sawCharge = true;
    }
    const done = await hide();
    check('the walk behind you turns into a sprint', sawCharge, sawCharge ? 'it charges' : 'never charged');
    check('and then the lock turns', done.mode === 'survived', done.mode);
    await page.screenshot({ path: `${SHOTS}/arcade-out.png` });
    await page.close();
  }

  // ------------------------------------- the third room hands over to the arcade
  // The transition itself, played rather than deep-linked: the third room is
  // survived and the next thing the player sees has to be the staff corner.
  console.log('\nhorror  surviving the third room puts you behind the counter');
  {
    const page = await newPage('?intro=1&charity=1&key=1&route=hide&hideRoom=2&scene=HideRoom3D');
    const hide = () => page.evaluate(() => window.__hide ?? null);
    let waited = 0;
    while (waited < 60000 && (await hide())?.mode !== 'seeking') {
      await sleep(500);
      waited += 500;
    }
    check('the third room is the ward, not the arcade', (await hide())?.room === 2, `room ${(await hide())?.room}`);
    // Run his clock out, which is how a hide room is survived.
    await page.evaluate(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      sc.grace = 9999;
      sc.clock = 0.05;
    });
    await sleep(1400);
    check('running it out survives the round', (await hide())?.mode === 'survived', (await hide())?.mode);
    await sleep(6000);
    const now = await hide();
    const st = await page.evaluate(() => window.__froggy.state());
    const where = await page.evaluate(async () => {
      const { ARCADE } = await import('/src/three/hideRooms.ts');
      const front = ARCADE.counter.find((r) => r.axis === 'x');
      const returns = ARCADE.counter.filter((r) => r.axis === 'z').sort((a, b) => a.at - b.at);
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      return {
        behindTheCounter: sc.pos.y < front.at,
        insideTheWrap: sc.pos.x > returns[0].at && sc.pos.x < returns[1].at,
        metresFromTheDoors: ARCADE.halfD - sc.pos.y,
      };
    });
    check('it hands over to the arcade', now?.room === 3 && st.hideRoom === 3, `room ${now?.room}`);
    check('and puts you BEHIND the counter, inside the wrap',
      where.behindTheCounter && where.insideTheWrap,
      `${now.px.toFixed(2)}, ${now.pz.toFixed(2)}`);
    check('nowhere near the glass doors', where.metresFromTheDoors > 12,
      `${where.metresFromTheDoors.toFixed(1)}m from them`);
    check('with the controls already yours', now?.mode === 'seeking', now?.mode);
    await page.screenshot({ path: `${SHOTS}/arcade-handover.png` });
    await page.close();
  }

  // ------------------------------------------------- the way in, for testing it
  // Forty minutes of play stand in front of this room, so it has a password.
  console.log('\nhorror  a run named TEST128 opens in the arcade');
  {
    const page = await newPage('');
    await sleep(2500);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2800);
    const name = async (typed) => {
      await page.evaluate(() => {
        if (!window.__froggy.activeScenes().includes('ProfileModal')) {
          window.__froggy.game().scene.start('ProfileModal', { from: 'StartScreen' });
        }
      });
      await sleep(900);
      await page.evaluate(() => window.__froggy.game().scene.getScene('ProfileModal').beginNaming());
      await sleep(300);
      for (const ch of typed) {
        await page.keyboard.press(/[0-9]/.test(ch) ? `Digit${ch}` : `Key${ch.toUpperCase()}`);
        await sleep(50);
      }
      await page.keyboard.press('Enter');
      await sleep(2500);
      return {
        scenes: await page.evaluate(() => window.__froggy.activeScenes()),
        state: await page.evaluate(() => window.__froggy.state()),
        hide: await page.evaluate(() => window.__hide ?? null),
      };
    };

    const test = await name('test128');
    check('TEST128 goes straight into the arcade',
      test.scenes.includes('HideRoom3D') && test.hide?.room === 3,
      `${test.scenes.join(',')}, room ${test.hide?.room}`);
    check('with everything the room reads already set',
      test.state.route === 'hide' && test.state.hasKey && test.state.seenIntro,
      `route ${test.state.route}, key ${test.state.hasKey}, intro ${test.state.seenIntro}`);
    check('and it lands behind the counter like the handover does',
      test.hide && test.hide.pz < 0 && test.hide.prompt === '',
      test.hide ? `${test.hide.px.toFixed(2)}, ${test.hide.pz.toFixed(2)}` : 'not in the room');
    await page.screenshot({ path: `${SHOTS}/arcade-test128.png` });

    // And the name is the whole of it: an ordinary run is still an ordinary run.
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(2800);
    const normal = await name('kai');
    check('any other name still starts a normal run',
      !normal.scenes.includes('HideRoom3D') && normal.state.route === 'normal' && !normal.state.hasKey,
      `${normal.scenes.join(',')}, route ${normal.state.route}`);
    await page.close();
  }

  // ------------------------------------------- he is huge, and still gets about
  // Making him bigger is only worth anything if he can still cross the room.
  // The model grew; the circle the walls and the furniture are tested against
  // did not, on purpose — so this asserts both halves of that: he really is
  // that size, and all three rooms still let him walk, climb and arrive.
  console.log('\nhorror  he fills the room, and the room still lets him through');
  for (const room of [0, 1, 2]) {
    const page = await newPage(
      `?intro=1&charity=1&key=1&route=hide&hideRoom=${room}&scene=HideRoom3D`,
    );
    const hide = () => page.evaluate(() => window.__hide ?? null);
    await sleep(2500);

    if (room === 0) {
      // How big he actually is, built at the scale the room builds him at —
      // not a number typed into this file, which could drift from the game.
      const size = await page.evaluate(async (scale) => {
        const THREE = await import('/node_modules/three/build/three.module.js');
        const { FroggyMonster } = await import('/src/three/froggyMonster.ts');
        const { ROOMS } = await import('/src/three/hideRooms.ts');
        const m = new FroggyMonster(scale);
        m.update(1 / 60, { speed: 0, maw: 0, climb: 0 });
        const b = new THREE.Box3().setFromObject(m.root);
        return { standing: b.max.y, ceilings: ROOMS.map((r) => r.wallH) };
      }, (await hide()).froggyScale);
      // Twice a 1.55m eye height is the bar: under that he reads as a tall man.
      check('he is more than twice your height', size.standing > 3.1,
        `${size.standing.toFixed(2)}m standing`);
      check('and he still stands under every ceiling',
        size.ceilings.every((h) => h > size.standing),
        `${size.standing.toFixed(2)}m under ${size.ceilings.join('/')}`);
    }

    // Wait the briefing and the count out rather than forcing the mode: the
    // hand-over is what puts him on the floor in the first place.
    let waited = 0;
    while (waited < 45000 && (await hide())?.mode !== 'seeking') {
      await sleep(500);
      waited += 500;
    }
    // Blind, so catching the parked test player cannot cut the sample short.
    await page.evaluate(() => {
      window.__froggy.game().scene.getScene('HideRoom3D').grace = 9999;
    });

    let travelled = 0;
    let wedged = 0;
    let prev = null;
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const h = await hide();
      if (!h) continue;
      if (prev) travelled += Math.hypot(h.fx - prev.x, h.fz - prev.z);
      prev = { x: h.fx, z: h.fz };
      // Inside the furniture is only ever legitimate while he is on top of it.
      if (h.dbg.froggyBlocked && !h.climbing) wedged++;
    }
    await page.screenshot({ path: `${SHOTS}/big-room${room}.png` });
    await page.close();

    check(`room ${room}: he gets right across it at this size`, travelled > 12,
      `covered ${travelled.toFixed(1)}m in 20s`);
    check(`room ${room}: and never wedges in the furniture or the walls`, wedged === 0,
      `${wedged} of 20 samples stuck`);
  }

  // -------------------------------------------- the same creature, both scenes
  console.log('\nhorror  the thing in the alley is the thing in the basement');
  {
    const room = await newPage('?intro=1&charity=1&key=1&route=hide&hideRoom=0&scene=HideRoom3D');
    await sleep(3000);
    const inRoom = await room.evaluate(() => window.__hide?.froggyMeshes ?? 0);
    await room.close();

    const alley = await newPage('?intro=1&charity=1&key=1&route=chase&scene=Chase3D');
    await sleep(3000);
    const inAlley = await alley.evaluate(() => window.__chase?.froggyMeshes ?? 0);
    await alley.close();

    check('he is built out of something, not billboarded', inRoom > 20, `${inRoom} meshes`);
    check('the alley uses the same model as the hide rooms', inRoom === inAlley,
      `room ${inRoom}, alley ${inAlley}`);
  }

  // ---------------------------------------------------------- his three gears
  console.log('\nhorror  hunting, prowling, and coming for you');
  {
    const page = await newPage('?intro=1&charity=1&key=1&route=hide&hideRoom=0&scene=HideRoom3D');
    await sleep(26000); // the briefing he gives, and then the count

    const gears = await page.evaluate(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      const at = (unseen, mode) => {
        sc.unseenT = unseen;
        sc.fMode = mode;
        return sc.froggySpeed();
      };
      return {
        hunting: at(0, 'search'),
        stillHunting: at(4.9, 'search'),
        prowling: at(5.1, 'search'),
        chasing: at(0, 'chase'),
        search: window.__hide.froggySearch,
        playerRun: window.__hide.playerRun,
        lostAfter: window.__hide.lostYouSeconds,
      };
    });
    check('losing sight of you for five seconds slows him down',
      gears.hunting === gears.search && gears.stillHunting === gears.search && gears.prowling < gears.search,
      `${gears.hunting} -> ${gears.prowling} after ${gears.lostAfter}s`);
    check('hunting he is faster than you can run', gears.chasing > gears.playerRun,
      `${gears.chasing} vs your ${gears.playerRun}`);
    check('and even searching he is a shade faster than you',
      Math.abs(gears.search - gears.playerRun * 1.1) < 1e-6 && gears.hunting > gears.playerRun, `${gears.search} vs ${gears.playerRun}`);
    check('and hunting he is twice your speed', Math.abs(gears.chasing - gears.playerRun * 2) < 1e-6,
      `${gears.chasing} vs ${gears.playerRun}`);

    // The face goes first.  He spent a whole release walking backwards because
    // the model was handed a half turn it did not need.
    const facing = await page.evaluate(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      sc.mode = 'seeking';
      sc.grace = 999;
      sc.hiding = null;
      sc.climb = null;
      sc.pos.set(0, 8);
      sc.froggy.set(0, -2);
      sc.fMode = 'search';
      sc.waypoint.set(0, 6);
      for (let i = 0; i < 60; i++) sc.tick(1 / 60);
      return {
        modelYaw: sc.monster.root.rotation.y,
        headingYaw: sc.froggyYaw,
        walkedTowardsPlayer: sc.froggy.y > -2,
      };
    });
    check('he faces the way he is walking', Math.abs(facing.modelYaw - facing.headingYaw) < 0.01,
      `model ${facing.modelYaw.toFixed(2)} vs heading ${facing.headingYaw.toFixed(2)}`);

    // Reach is reach, whatever he happens to be doing with his hands.
    const standing = await page.evaluate(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      sc.mode = 'seeking';
      sc.grace = 999;
      sc.hiding = null;
      sc.climb = null;
      sc.fMode = 'listen';
      sc.fTimer = 5; // pointedly not walking
      sc.pos.set(0, 0);
      sc.froggy.set(0, 0.8);
      for (let i = 0; i < 10; i++) sc.tick(1 / 60);
      return sc.mode;
    });
    check('standing next to you in the open is being caught', standing === 'caught', standing);

    await page.close();
  }

  if (errors.length) {
    console.log('\nRuntime errors:');
    for (const e of errors) console.log('  ' + e);
  } else {
    console.log('\nRuntime errors: none');
  }

  console.log(`\n${ran - failed}/${ran} checks passed.`);
  await browser.close();
  process.exit(failed > 0 || errors.length > 0 ? 1 : 0);
} catch (e) {
  console.error('HORROR FAILED:', e.message);
  for (const err of errors) console.error('  ' + err);
  await browser.close();
  process.exit(1);
}
