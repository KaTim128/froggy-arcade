/**
 * The police in the building: up the stairs to 612, with three officers
 * searching it.
 *
 *   node tools/police.mjs [--url http://localhost:5173]
 *
 * The run through it, end to end, in the order the player meets it: the
 * lobby that will not let you out the front, the stairs and every floor,
 * the flats (some open, most not) and their hiding places, the officers
 * and what they see, being found, the arrest and the retry, and 612 --
 * the window, the black, the following day.
 */

import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const URL = arg('--url', 'http://localhost:5173');
const SHOTS = 'tools/shots/police';
mkdirSync(SHOTS, { recursive: true });

const CHROME = [
  process.env.CHROME_PATH ?? '',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
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
let ran = 0;
const check = (name, ok, note = '') => {
  ran++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  — ${note}` : ''}`);
  if (!ok) failed++;
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
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
  await page.mouse.click(640, 60);
  await sleep(400);
  return page;
};

const scenes = (page) => page.evaluate(() => window.__froggy.activeScenes());
const P = (page, f, ...a) => page.evaluate((f, a) => window.__police[f](...a), f, a);
const S = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__police ?? {})));
/** Wait (frames on a software renderer are slow) until the scene's state passes `ok`. */
const until = async (page, ok, ms = 20000) => {
  const t0 = Date.now();
  let s = await S(page);
  while (!ok(s) && Date.now() - t0 < ms) {
    await sleep(200);
    s = await S(page);
  }
  return s;
};
const camOf = (page) =>
  page.evaluate(() => {
    const c = window.__froggy.game().scene.getScene('PoliceEscape3D').stage.camera;
    return { x: c.position.x, y: c.position.y, z: c.position.z, fov: c.fov };
  });

try {
  // ------------------------------------------------------------- 1. the lobby
  console.log('\npolice  the lobby: not the front, the stairs');
  {
    const page = await newPage('?intro=1&charity=1&key=1&scene=Hotel');
    await page.evaluate(() => {
      window.__froggy.patch({ timeOfDay: 'midnight', reachedHotel: true, checkedIn: true, hotelNight: true, hotelAfter: 'police' });
      const g = window.__froggy.game();
      g.scene.getScene('Hotel').scene.start('Hotel', { area: 'lobby', from: 'storage' });
    });
    await sleep(2500);
    const out = await page.evaluate(() => {
      const h = window.__froggy.game().scene.getScene('Hotel');
      h.spot = 'out';
      h.locked = false;
      h.talk = null;
      h.interact();
      return { scenes: window.__froggy.activeScenes(), locked: h.locked };
    });
    await sleep(600);
    check('the front doors do not let you out to them', out.scenes.includes('Hotel') && !out.scenes.includes('ArrestEnding'), out.scenes.join(','));
    const up = await page.evaluate(() => {
      const h = window.__froggy.game().scene.getScene('Hotel');
      h.spot = 'stairdoor';
      h.locked = false;
      h.talk = null;
      h.interact();
      return true;
    });
    let inside = false;
    for (let i = 0; i < 30 && !inside; i++) {
      await sleep(300);
      inside = (await scenes(page)).includes('PoliceEscape3D');
    }
    check('and BACK UPSTAIRS takes you into the building in 3D', up && inside);
    await page.close();
  }

  // ------------------------------------------------------------- 2..7 the building
  console.log('\npolice  the stairs, the floors, the flats');
  const page = await newPage('?intro=1&charity=1&key=1&scene=PoliceEscape3D');
  await sleep(3000);
  await P(page, 'freeze', true);
  // up the well, landing by landing, through the fire door on to every floor
  const climbed = [];
  for (let f = 0; f < 6; f++) {
    // (from the corridor: back into the well first)
    let r = await P(page, 'walkTo', 0.9, 0.85);
    r = await P(page, 'walkTo', -0.95, 0.3);
    r = await P(page, 'walkTo', -0.95, -3.3);
    r = await P(page, 'walkTo', 0, -3.85);
    r = await P(page, 'walkTo', 0.95, -3.3);
    r = await P(page, 'walkTo', 0.95, 0.3);
    r = await P(page, 'walkTo', 0.9, 0.85);
    climbed.push(`${r.level}@${r.h.toFixed(1)}`);
  }
  check('the stairs go up from G through every floor to 6', climbed.join(' ') === '1@3.0 2@6.0 3@9.0 4@12.0 5@15.0 6@18.0', climbed.join(' '));
  // through the fire door at 6: shut, it stops you; open, you go through
  let r = await P(page, 'walkTo', 0.9, 2.6);
  check('a shut fire door is solid', r.well === true, `at z ${r.z.toFixed(2)}`);
  await P(page, 'useDoor', 'stair-6');
  await sleep(1500);
  r = await P(page, 'walkTo', 0.9, 2.6);
  check('and open, it lets you out on to the floor', r.well === false && r.f === 6 && Math.abs(r.h - 18) < 0.01, JSON.stringify(r));
  // back down, all the way, and the lobby door will not open
  await P(page, 'warp', 0.9, 0.85, 1, true);
  r = await P(page, 'walkTo', 0.9, 0.3);
  r = await P(page, 'walkTo', 0.95, -3.3);
  r = await P(page, 'walkTo', 0, -3.85);
  r = await P(page, 'walkTo', -0.95, -3.3);
  r = await P(page, 'walkTo', -0.95, 0.3);
  r = await P(page, 'walkTo', 0.9, 0.85);
  check('and back down to G', r.level === 0 && r.h === 0, JSON.stringify(r));
  await P(page, 'useDoor', 'stair-0');
  await sleep(800);
  const doors = await P(page, 'doors');
  check('the lobby door stays shut to you', doors.find((d) => d.id === 'stair-0').k < 0.05);

  const rooms = await P(page, 'rooms');
  const flats = rooms.filter((x) => x.special === 'none');
  const open = flats.filter((x) => x.open);
  check('some flats are open and most are locked', open.length >= 18 && open.length <= 36 && flats.length === 71, `${open.length} of ${flats.length} open`);
  check('every floor has at least three open', [1, 2, 3, 4, 5, 6].every((f) => open.filter((x) => x.f === f).length >= 3));
  check('every open flat has somewhere to hide', open.every((x) => x.spots.length > 0));
  check('every bathroom or WC hides you behind its curtain or its door', open.every((x) => x.spots.some((s) => s.kind === 'curtain' || s.kind === 'door')));
  const kinds = new Set(open.flatMap((x) => x.spots.map((s) => s.kind)));
  check('all four kinds of hiding place are in the building', ['bed', 'wardrobe', 'curtain', 'door'].every((k) => kinds.has(k)), [...kinds].join(','));
  const seedA = (await S(page)).seed;

  // a locked door stays locked; an open one opens and shuts
  const locked = flats.find((x) => !x.open && x.f === 2);
  await P(page, 'warp', locked.side * 0.7, locked.dz, 2);
  await P(page, 'useDoor', `room-${locked.id}`);
  let line = (await until(page, (x) => /Locked/i.test(x.line), 4000)).line;
  let d = (await P(page, 'doors')).find((x) => x.id === `room-${locked.id}`);
  check('a locked flat says so and does not open', d.k < 0.02 && /Locked/i.test(line), line);
  const flat = open.find((x) => x.f === 2);
  await P(page, 'warp', flat.side * 0.7, flat.dz, 2);
  await P(page, 'useDoor', `room-${flat.id}`);
  for (let i = 0; i < 40; i++) {
    await sleep(200);
    d = (await P(page, 'doors')).find((x) => x.id === `room-${flat.id}`);
    if (d.k > 0.95) break;
  }
  check('an open flat\'s door swings open on its hinge', d.k > 0.95, `k ${d.k.toFixed(2)}`);
  r = await P(page, 'walkTo', flat.side * 2.8, flat.dz);
  check('and you can walk in', Math.abs(r.x) > 1.6, `x ${r.x.toFixed(2)}`);
  await P(page, 'warp', flat.side * 0.7, flat.dz, 2);
  await P(page, 'useDoor', `room-${flat.id}`);
  for (let i = 0; i < 40; i++) {
    await sleep(200);
    d = (await P(page, 'doors')).find((x) => x.id === `room-${flat.id}`);
    if (d.k < 0.05) break;
  }
  check('and shut it again behind you', d.k < 0.05, `k ${d.k.toFixed(2)}`);
  r = await P(page, 'walkTo', flat.side * 2.8, flat.dz);
  check('a shut door is solid', Math.abs(r.x) < 1.3, `x ${r.x.toFixed(2)}`);

  // every kind of hiding place: in, a different view peeking, out
  for (const kind of ['bed', 'wardrobe', 'curtain', 'door']) {
    const rm = open.find((x) => x.spots.some((s) => s.kind === kind));
    const sp = rm.spots.find((s) => s.kind === kind);
    await P(page, 'useDoor', `room-${rm.id}`);
    await P(page, 'hideIn', sp.id);
    let st = await until(page, (x) => x.hidden && x.hidden.k >= 1);
    await sleep(300);
    const cam0 = await camOf(page);
    await P(page, 'peek');
    // (the eye eases to the gap: give it the frames to get there)
    let cam1 = cam0;
    for (let i = 0; i < 60; i++) {
      await sleep(200);
      cam1 = await camOf(page);
      if (Math.abs(cam1.fov - (await page.evaluate((id) => window.__police_spotFov?.(id) ?? 0, sp.id))) < 0.5 && Math.abs(cam1.fov - 72) > 8) break;
      if (Math.abs(cam1.fov - 72) > 14) break;
    }
    await page.screenshot({ path: `${SHOTS}/peek-${kind}.png` });
    st = await S(page);
    const moved = Math.hypot(cam1.x - cam0.x, cam1.y - cam0.y, cam1.z - cam0.z);
    check(`${kind}: hidden, and peeking moves the eye to its own gap`, st.hidden?.kind === kind && st.hidden.peek && moved > 0.05 && Math.abs(cam1.fov - 72) > 4, `eye moved ${moved.toFixed(2)} m, fov ${cam1.fov.toFixed(0)}`);
    if (kind === 'bed') check('under the bed, the eye is down at the floor', cam1.y - Math.round(cam1.y / 3) * 3 < 0.3, `${(cam1.y % 3).toFixed(2)} m up`);
    await P(page, 'peek');
    await sleep(300);
    await P(page, 'press');
    st = await until(page, (x) => x.hidden === null);
    check(`${kind}: and you can get out again`, st.hidden === null, JSON.stringify(st.hidden));
  }

  // ---- the officers
  console.log('\npolice  the officers');
  await P(page, 'freeze', false);
  let s0 = await S(page);
  check('three officers, each on his own', s0.cops.length === 3 && new Set(s0.cops.map((c) => `${c.x.toFixed(1)},${c.z.toFixed(1)},${c.level}`)).size === 3);
  // a while of the building being searched
  const start = s0.cops.map((c) => ({ x: c.x, z: c.z, h: c.h }));
  const floors = new Set();
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const s = await S(page);
    for (const c of s.cops) floors.add(c.level);
  }
  s0 = await S(page);
  const travelled = s0.cops.map((c, i) => Math.hypot(c.x - start[i].x, c.z - start[i].z) + Math.abs(c.h - start[i].h));
  check('they move round the building', travelled.every((t) => t > 1), travelled.map((t) => t.toFixed(1)).join(', '));
  check('and between floors', floors.size >= 3, [...floors].join(','));
  const opened = (await P(page, 'doors')).filter((x) => x.by === 'officer');
  check('they open doors as they go, and leave them open', opened.length > 0 && opened.every((x) => x.want === 1), `${opened.length} opened`);

  // sight: in plain view he sees you; behind a shut door he does not
  await P(page, 'freeze', true);
  await P(page, 'putCop', 0, 0, 12, 3, 0);
  await P(page, 'copHold', 0, 60);
  await P(page, 'putCop', 1, 0, 6, 5, 0);
  await P(page, 'putCop', 2, 0, 6, 1, 0);
  await P(page, 'warp', 0, 17, 3);
  await P(page, 'freeze', false);
  let spotted = false;
  for (let i = 0; i < 40 && !spotted; i++) {
    await sleep(300);
    spotted = (await S(page)).cops[0].mode !== 'task';
  }
  check('in plain view in the corridor he sees you, and comes', spotted, (await S(page)).cops[0].mode);
  await page.screenshot({ path: `${SHOTS}/seen.png` });
  // behind a wall: same distance, through it
  await P(page, 'freeze', true);
  const wallRoom = open.find((x) => x.f === 3 && x.side > 0) ?? open.find((x) => x.f === 3);
  await P(page, 'setDoor', `room-${wallRoom.id}`, 0);
  await sleep(200);
  await P(page, 'putCop', 0, 0, wallRoom.dz + 0.2, 3, wallRoom.side > 0 ? Math.PI / 2 : -Math.PI / 2);
  await P(page, 'copHold', 0, 60);
  await P(page, 'warp', wallRoom.side * 2.8, wallRoom.dz + 1.6, 3);
  await sleep(1600);
  const doorShut = (await P(page, 'doors')).find((x) => x.id === `room-${wallRoom.id}`).k < 0.05;
  await P(page, 'freeze', false);
  let sus = 0;
  for (let i = 0; i < 12; i++) {
    await sleep(300);
    sus = Math.max(sus, (await S(page)).cops[0].sus);
  }
  check('behind a shut door and a wall he cannot see you', doorShut && sus < 0.05, `door shut ${doorShut}, suspicion ${sus.toFixed(2)}`);

  // found where you hide: an officer who searches your spot finds you
  await P(page, 'freeze', true);
  const hideRoom = open.find((x) => x.f === 4 && x.spots.length);
  const hideSpot = hideRoom.spots[0];
  await P(page, 'useDoor', `room-${hideRoom.id}`);
  await P(page, 'hideIn', hideSpot.id);
  await sleep(1500);
  await P(page, 'putCop', 0, 0, hideRoom.dz, 4, 0);
  await P(page, 'copInspect', 0, hideSpot.id);
  await P(page, 'freeze', false);
  let phase = '';
  for (let i = 0; i < 80 && phase !== 'caught'; i++) {
    await sleep(300);
    phase = (await S(page).catch(() => ({})))?.phase ?? '';
    if (!(await scenes(page)).includes('PoliceEscape3D')) break;
  }
  check(`searching your ${hideSpot.kind}, he finds you`, phase === 'caught', phase);
  await sleep(300);
  await page.screenshot({ path: `${SHOTS}/arrest.png` });
  let sc = [];
  for (let i = 0; i < 20; i++) {
    await sleep(300);
    sc = await scenes(page);
    if (sc.includes('DeathScreen')) break;
  }
  const title = await page.evaluate(() => window.__froggy.game().scene.getScene('DeathScreen')?.children?.list?.map((o) => o.text).filter(Boolean).join(' | ') ?? '');
  check('and it is ARRESTED, with RESPAWN and LEAVE', sc.includes('DeathScreen') && /ARRESTED/.test(title) && /RESPAWN/.test(title) && /LEAVE/.test(title), title);
  await sleep(1500);
  await page.keyboard.press('r');
  let back = false;
  for (let i = 0; i < 30 && !back; i++) {
    await sleep(300);
    back = (await scenes(page)).includes('PoliceEscape3D');
  }
  await sleep(2500);
  const s2 = await S(page);
  check('RESPAWN starts it over: you at the bottom of the stairs, a new building', back && s2.level === 0 && s2.well && s2.seed !== seedA, `seed ${seedA} -> ${s2.seed}`);
  check('and the police back where they began', s2.cops?.every((c) => c.mode === 'task'));
  await page.close();

  // ------------------------------------------------------------- 8 & 10. 612, and after
  console.log('\npolice  612, and the following day');
  {
    const page2 = await newPage('?intro=1&charity=1&key=1&scene=PoliceEscape3D');
    await sleep(3000);
    await P(page2, 'freeze', true);
    await P(page2, 'to612');
    let cineMax = 0;
    let sawEnd = false;
    let after = [];
    for (let i = 0; i < 300; i++) {
      await sleep(250);
      after = await scenes(page2);
      if (!after.includes('PoliceEscape3D')) break;
      const s = await S(page2);
      cineMax = Math.max(cineMax, s.cine ?? 0);
      if (s.phase === 'ending') sawEnd = true;
      if (s.phase === 'cinema' && s.cine > 3.6 && s.cine < 4.2) await page2.screenshot({ path: `${SHOTS}/612-down.png` });
      if (s.phase === 'cinema' && s.cine > 7.4 && s.cine < 8.2) await page2.screenshot({ path: `${SHOTS}/612-them.png` });
    }
    check('in 612 the cinematic plays through: the window, down, them, out', cineMax > 10, `${cineMax.toFixed(1)} s`);
    check('and then the black, and the words', sawEnd);
    const st = await page2.evaluate(() => window.__froggy.state());
    check('and it is the following day, outside the arcade', after.includes('ExteriorDay') && st.hotelAfter === 'escaped' && st.arc === 'back', `${after.join(',')} ${st.hotelAfter} ${st.arc}`);
    await sleep(2000);
    await page2.screenshot({ path: `${SHOTS}/following-day.png` });
    await page2.close();
  }
} catch (e) {
  console.error('POLICE FAILED:', e?.message ?? e);
  await browser.close();
  process.exit(1);
}

await browser.close();
const real = errors.filter((e) => !/AudioContext|autoplay/i.test(e));
check('no console errors, no page exceptions', real.length === 0, real.slice(0, 3).join(' / '));
console.log(`\n${ran - failed}/${ran} passed`);
process.exit(failed ? 1 : 0);
