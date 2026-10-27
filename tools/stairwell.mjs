/**
 * The 2D stairwell at Lily's: the walls hold, the climb never sticks, and
 * every floor's door can be walked up to.  The scene's own walk() is driven
 * directly, a frame's step at a time, so this tests the movement and not the
 * frame rate.
 *
 *   node tools/stairwell.mjs [--url http://localhost:5173]
 */

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const URL = arg('--url', 'http://localhost:5173');
const CHROME = [process.env.CHROME_PATH ?? '', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
if (!CHROME) {
  console.error('No Chrome found.');
  process.exit(2);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
let ran = 0;
const errors = [];
const check = (name, ok, note = '') => {
  ran++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${note ? `  — ${note}` : ''}`);
  if (!ok) failed++;
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540 });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${URL}/?intro=1&charity=1&scene=Stairwell`, { waitUntil: 'load' });
  await sleep(3500);

  const r = await page.evaluate(() => {
    const sc = window.__froggy.game().scene.getScene('Stairwell');
    // (the test drives the feet; the scene's own update stays out of it)
    sc.locked = true;
    const STEP = 1.2;
    let minX = Infinity;
    let maxX = -Infinity;
    /** Start on floor `f`'s landing (0 is G), at its door. */
    const atDoor = (f) => {
      sc.spur = f * 2;
      sc.sx = 82;
      sc.s = sc.spur * 112;
      sc.going = 1;
    };
    const hold = (dx, dy, frames) => {
      for (let i = 0; i < frames; i++) {
        sc.walk(dx, dy, STEP);
        const p = sc.feet();
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
      }
      return { ...sc.feet(), spur: sc.spur, floor: sc.landingFloor() };
    };
    const out = {};
    atDoor(0);
    out.up = hold(0, -1, 7000);
    out.down = hold(0, 1, 7000);
    atDoor(3);
    out.downOne = hold(0, 1, 60);
    // up and left together, out on a landing: the door, not a ping-pong
    atDoor(2);
    hold(0, -1, 40);
    out.backToDoor = hold(-1, -1, 400);
    // climbing with the stick on the diagonal (up and right) past a floor
    atDoor(0);
    out.diag = hold(1, -1, 7000);
    // each floor's door can be walked to from the stairs: climb to its join, then left
    out.doors = [];
    for (let f = 0; f <= 6; f++) {
      atDoor(0);
      sc.spur = null;
      sc.s = f * 2 * 112 + 30; // a little way up the flight above it
      hold(0, 1, 40); // down to its landing's join
      hold(-1, 0, 120); // and along to the door
      out.doors.push({ f, x: Math.round(sc.feet().x), floor: sc.landingFloor() });
    }
    out.minX = minX;
    out.maxX = maxX;
    return out;
  });

  // (the top of the last flight: the roof door's landing is off to the left of it)
  check('holding UP from G, the lobby door, climbs all the way to the roof door', r.up.y === 44 && r.up.x === 104, JSON.stringify(r.up));
  check('holding DOWN from there comes all the way back to G', r.down.y > r.up.y && (r.down.floor === 0 || r.down.spur === null) && r.down.y >= 680, JSON.stringify(r.down));
  check('DOWN on a landing walks to the stairs and goes down them', r.downOne.spur === null && r.downOne.y > 0, JSON.stringify(r.downOne));
  // (up a flight from level 2, UP and LEFT climb on to level 3's landing and walk along it)
  check('UP and LEFT on the stairs climbs to the next landing and walks to its door, no ping-pong', r.backToDoor.floor === 3 && r.backToDoor.x <= 82, JSON.stringify(r.backToDoor));
  check('UP held with RIGHT still climbs, never stuck on a half-landing wall', r.diag.y === 44, JSON.stringify(r.diag));
  check('every floor\'s door, G and 1 to 6, can be walked up to from the stairs', r.doors.length === 7 && r.doors.every((d) => d.floor === d.f && d.x <= 82), JSON.stringify(r.doors));
  check('the feet never go into the walls (44..258)', r.minX >= 44 && r.maxX <= 258, `${r.minX.toFixed(1)} .. ${r.maxX.toFixed(1)}`);

  // the door prompts, in the real update, on the landings
  const promptAt = (spur, x = 82) =>
    page.evaluate(
      async (spur, x) => {
        const sc = window.__froggy.game().scene.getScene('Stairwell');
        sc.locked = false;
        sc.spur = spur;
        sc.sx = x;
        sc.place();
        await new Promise((r) => setTimeout(r, 400));
        return sc.prompt.visible ? sc.prompt.text : '';
      },
      spur,
      x,
    );
  const p3 = await promptAt(6);
  check('at level 3\'s door, the prompt is for level 3', /LEVEL 3/.test(p3), p3 || 'no prompt');
  const pg = await promptAt(0);
  check('at G\'s door, the prompt is for the lobby', /LOBBY/.test(pg), pg || 'no prompt');
  // nothing at the foot of the well any more: no cage, no basement
  const foot = await promptAt(0, 48);
  check('at the foot of the well, no basement and no cage', !/BASEMENT/.test(foot), foot || 'no prompt');
  // level 1: somebody else's floor, locked
  const l1 = await page.evaluate(async () => {
    const sc = window.__froggy.game().scene.getScene('Stairwell');
    sc.spur = 2;
    sc.sx = 82;
    sc.place();
    await new Promise((r) => setTimeout(r, 300));
    sc.interact();
    await new Promise((r) => setTimeout(r, 200));
    return { text: sc.mutter.text, still: window.__froggy.activeScenes().includes('Stairwell') };
  });
  check('level 1 is somebody else\'s floor: locked from the stairs', l1.still && /LOCKED/.test(l1.text), JSON.stringify(l1));
  // THE ROOF: the door at the top goes out on to it, you walk along it, and come back in
  const pr = await promptAt(14, 52);
  check('at the top, the roof door goes out on to the roof', /ROOF/.test(pr), pr || 'no prompt');
  const roof = await page.evaluate(async () => {
    const sc = window.__froggy.game().scene.getScene('Stairwell');
    sc.interact();
    await new Promise((r) => setTimeout(r, 1200));
    const out = { onRoof: sc.onRoof, x0: sc.player.x };
    sc.roofFrame(1, 1000);
    out.x1 = sc.player.x;
    sc.sx = 40;
    sc.roofFrame(0, 16);
    out.back = sc.prompt.visible ? sc.prompt.text : '';
    sc.interact();
    await new Promise((r) => setTimeout(r, 1200));
    out.inAgain = !sc.onRoof && sc.landingFloor() === 7;
    return out;
  });
  check('out on the roof, and you walk along it', roof.onRoof && roof.x1 > roof.x0, JSON.stringify(roof));
  check('and back in by the roof door, to the top landing', /BACK IN/.test(roof.back) && roof.inAgain, JSON.stringify(roof));
} catch (e) {
  console.error(e);
  failed++;
} finally {
  await browser.close();
}
if (errors.length) console.log('page errors:', errors.slice(0, 5).join('; '));
console.log(`\n${ran - failed}/${ran} passed`);
process.exit(failed || errors.length ? 1 : 0);
