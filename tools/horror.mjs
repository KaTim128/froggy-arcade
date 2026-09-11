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
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));
if (!CHROME) {
  console.error('No Chrome/Edge found.');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let failed = 0;
const check = (name, ok, note = '') => {
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
    // Three minutes, because that is the number he says out loud at the door.
    check('he then has three minutes', s.seekSeconds === 180 && s.secondsLeft > 170,
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
    const park = () =>
      page.evaluate(() => {
        const sc = window.__froggy.game().scene.getScene('HideRoom3D');
        sc.hiding = null;
        sc.yaw = 0;
        sc.grace = 99;
        sc.pos.set(0, 11);
        sc.froggy.set(sc.def.halfW - 2, -sc.def.halfD + 2);
      });
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

    // Furniture is cover, not a wall.  He goes over it — which is what stops a
    // sofa between the two of you from being permanent safety.
    const climbed = await page.evaluate(async () => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      const sofa = sc.def.furniture.find((f) => f.low && f.w > 3);
      sc.hiding = null;
      sc.grace = 999;
      sc.pos.set(sofa.x, sofa.z + 10);
      sc.froggy.set(sofa.x, sofa.z + 2.2);
      sc.fMode = 'search';
      sc.waypoint.set(sofa.x, sofa.z - 2.2);
      let wentOver = false;
      let highest = 0;
      for (let i = 0; i < 100; i++) {
        await new Promise((r) => setTimeout(r, 50));
        if (window.__hide.climbing) wentOver = true;
        highest = Math.max(highest, sc.monster.root.position.y);
        if (sc.froggy.y < sofa.z - 0.5) break;
      }
      return { wentOver, highest, crossed: sc.froggy.y < sofa.z, top: sofa.h };
    });
    check('he climbs over the furniture rather than stopping at it',
      climbed.wentOver && climbed.crossed, `over ${climbed.top}m, crossed ${climbed.crossed}`);
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
    // check.  Then stand him right in front of the chest and stare.
    const hiddenSeen = await page.evaluate(() => {
      const sc = window.__froggy.game().scene.getScene('HideRoom3D');
      sc.fMode = 'search';
      sc.memory = 0;
      sc.froggy.set(sc.pos.x, sc.pos.y + 2);
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

    // Lasting his three minutes is the win.  The clock is the thing being
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

  const total = 42;
  console.log(`\n${total - failed}/${total} checks passed.`);
  await browser.close();
  process.exit(failed > 0 || errors.length > 0 ? 1 : 0);
} catch (e) {
  console.error('HORROR FAILED:', e.message);
  for (const err of errors) console.error('  ' + err);
  await browser.close();
  process.exit(1);
}
