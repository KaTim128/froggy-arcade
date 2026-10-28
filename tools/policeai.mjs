/**
 * The police chase, officer by officer: one officer after you, the other two
 * held out of the way, from every awkward place in and around the stairwell.
 * Each scenario passes when he catches you inside the time, and none of them
 * may leave him standing still.
 *
 *   node tools/policeai.mjs [--url http://localhost:5173] [--only H]
 *
 * Run at LOW quality: a software renderer at HIGH is too slow for the walk
 * to be timed fairly.
 */

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { argv } from 'node:process';

const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const URL = arg('--url', 'http://localhost:5173');
const ONLY = arg('--only', '');
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

// (h for a spot on a flight comes from the well's own shape in the scene)
const SCENARIOS = [
  { id: 'A', name: 'same corridor, floor 3, ten metres apart', cop: { f: 3, x: 0, z: 10 }, me: { f: 3, x: 0, z: 20 } },
  { id: 'B', name: 'you just inside the stair door, him in the corridor', cop: { f: 3, x: 0, z: 5 }, me: { f: 3, x: 0.9, z: 0.6, well: true, seg: 'top' } },
  { id: 'C', name: 'you out in the corridor, him on the landing', cop: { f: 2, x: 0.9, z: 0.6, well: true, seg: 'top' }, me: { f: 2, x: 0, z: 7 } },
  { id: 'D', name: 'you one landing up, him below', cop: { f: 1, x: 0.9, z: 0.6, well: true, seg: 'top' }, me: { f: 2, x: 0.9, z: 0.6, well: true, seg: 'top' } },
  { id: 'E', name: 'you one landing down, him above', cop: { f: 4, x: 0.9, z: 0.6, well: true, seg: 'top' }, me: { f: 3, x: -0.9, z: 0.6, well: true, seg: 'top' } },
  { id: 'H', name: 'you on the flight above G, him on the G landing', cop: { f: 0, x: 0.9, z: 0.56, well: true, seg: 'top' }, me: { f: 0, x: -0.9, z: -1.2, well: true, seg: 'A' } },
  { id: 'I', name: 'you on the flight below a landing, him on it', cop: { f: 4, x: -0.9, z: 0.6, well: true, seg: 'top' }, me: { f: 3, x: 0.9, z: -1.5, well: true, seg: 'B' } },
  { id: 'J', name: 'you on the flight up from floor 3, him in its corridor', cop: { f: 3, x: 0, z: 5 }, me: { f: 3, x: -0.9, z: -1.0, well: true, seg: 'A' } },
  { id: 'K', name: 'you on the half-landing, him on the landing below', cop: { f: 2, x: -0.9, z: 0.6, well: true, seg: 'top' }, me: { f: 2, x: 0, z: -3.9, well: true, seg: 'bot' } },
].filter((s) => !ONLY || ONLY.split(',').includes(s.id));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540 });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${URL}/?intro=1&charity=1&key=1&scene=PoliceEscape3D`, { waitUntil: 'load' });
  await sleep(3000);
  await page.evaluate(() => {
    const f = window.__froggy;
    f.patch({ settings: { ...f.state().settings, quality: 0 } });
  });

  for (const sc of SCENARIOS) {
    await page.evaluate(() => window.__froggy.game().scene.getScene('PoliceEscape3D').scene.restart());
    await sleep(2500);
    // wait for the scene to hand over the controls
    for (let i = 0; i < 60; i++) {
      const ph = await page.evaluate(() => window.__police?.phase);
      if (ph === 'play') break;
      await sleep(250);
    }
    const start = await page.evaluate((s) => {
      const p = window.__froggy.game().scene.getScene('PoliceEscape3D');
      const FH = 3;
      const hOf = (m) => {
        const y0 = m.f * FH;
        if (!m.well || m.seg === 'top') return y0;
        if (m.seg === 'A') return y0 + 1.5 * Math.min(1, Math.max(0, -m.z / 3));
        if (m.seg === 'bot') return y0 + 1.5;
        return y0 + 1.5 + 1.5 * Math.min(1, Math.max(0, (m.z + 3) / 3));
      };
      const mk = (m) => ({ x: m.x, z: m.z, f: m.f, well: !!m.well, seg: m.seg ?? 'top', h: hOf(m) });
      p.me = mk(s.me);
      p.segCache.clear();
      // the other two: on the top floor at the far end, looking at the wall
      p.cops.forEach((c, i) => {
        c.inLobby = false;
        c.arrived = true;
        c.acts = [];
        c.path = [];
        c.pathTo = null;
        c.stuckT = 0;
        c.detourT = 0;
        if (i === 0) {
          c.m = mk(s.cop);
          c.mode = 'chase';
          c.lkp = { x: p.me.x, z: p.me.z, f: p.me.f, well: p.me.well, h: p.me.h };
          c.lostT = 0;
        } else {
          c.m = { x: 0, z: 30 + i, f: 6, well: false, seg: 'top', h: 18 };
          c.mode = 'task';
          c.acts = [{ k: 'look', t: 999 }];
        }
      });
      return { me: p.me, cop: p.cops[0].m };
    }, sc);
    const t0 = Date.now();
    let s = null;
    let still = 0;
    let last = null;
    let maxStill = 0;
    let whyStill = '';
    while (Date.now() - t0 < 30000) {
      await sleep(250);
      s = await page.evaluate(() => {
        const p = window.__froggy.game().scene.getScene('PoliceEscape3D');
        const c = p.cops[0];
        return { clock: p.clock, phase: p.phase, x: c.m.x, z: c.m.z, h: c.m.h, f: c.m.f, well: c.m.well, seg: c.m.seg, mode: c.mode, act: c.acts[0]?.k ?? '', door: c.waitDoor ? c.waitDoor.id + ':' + c.waitDoor.k.toFixed(2) : '', stuck: +c.stuckT.toFixed(2) };
      });
      if (s.phase !== 'play') break;
      if (last && Math.hypot(s.x - last.x, s.z - last.z) + Math.abs(s.h - last.h) < 0.02) still += s.clock - last.clock;
      else still = 0;
      if (still > maxStill) whyStill = JSON.stringify(s);
      maxStill = Math.max(maxStill, still);
      last = s;
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const caught = s && s.phase !== 'play';
    check(`${sc.id}: ${sc.name}: caught`, caught, caught ? `${secs}s` : `not after ${secs}s ${JSON.stringify(s)} start ${JSON.stringify(start)}`);
    check(`${sc.id}: never stood still for 2 s of game time`, maxStill < 2, `longest still ${maxStill.toFixed(2)}s ${maxStill >= 1 ? whyStill : ''}`);
  }

  // INTO THE WC AND SHUT THE DOOR.  Every bathroom and WC in the building:
  // open its door, walk in through it, and shut it behind you from inside.
  if (!ONLY || ONLY.split(',').includes('wc')) {
    await page.evaluate(() => window.__froggy.game().scene.getScene('PoliceEscape3D').scene.restart());
    await sleep(3000);
    const res = await page.evaluate(async () => {
      const p = window.__froggy.game().scene.getScene('PoliceEscape3D');
      const P = window.__police;
      P.freeze(true);
      const out = [];
      for (const d of p.b.doors.filter((x) => x.kind === 'bath')) {
        const sx = Math.cos(d.shut);
        const sz = Math.sin(d.shut);
        const mx = d.hx + sx * d.width / 2;
        const mz = d.hz + sz * d.width / 2;
        // in is the way the leaf swings to
        const ox = Math.cos(d.open);
        const oz = Math.sin(d.open);
        const side = Math.sign((ox * -sz + oz * sx) || 1);
        const nx = -sz * side;
        const nz = sx * side;
        P.setDoor(d.id, 1);
        P.warp(mx - nx * 0.7, mz - nz * 0.7, d.floor, false);
        // through the doorway and on in, past the swing
        P.walkTo(mx + nx * 0.4, mz + nz * 0.4, 400);
        const inside = P.walkTo(mx + nx * 1.05, mz + nz * 1.05, 400);
        const inRoom = p.b.roomAt(d.floor, p.me.x, p.me.z);
        const farIn = (p.me.x - mx) * nx + (p.me.z - mz) * nz;
        // face the door and shut it
        p.yaw = Math.atan2(-(mx - p.me.x), -(mz - p.me.z));
        P.useDoor(d.id);
        P.freeze(false);
        for (let i = 0; i < 40 && d.k > 0.02; i++) await new Promise((r) => setTimeout(r, 100));
        P.freeze(true);
        out.push({ id: d.id, k: +d.k.toFixed(2), farIn: +farIn.toFixed(2), inRoom: !!inRoom, inside });
        P.setDoor(d.id, 0);
      }
      return out;
    });
    const bad = res.filter((r) => !(r.k <= 0.05 && r.farIn > 0.6));
    check(`every WC and bathroom (${res.length}): walk in and shut the door behind you`, res.length > 0 && bad.length === 0, bad.length ? JSON.stringify(bad.slice(0, 4)) : `${res.length} doors`);
  }

  // THROUGH THE DOOR YOU SHUT.  Him a few steps behind you in the corridor,
  // you into an open flat and the door shut behind you, out of sight: he
  // knows which door, opens it, and comes in after you.
  if (!ONLY || ONLY.split(',').includes('door')) {
    await page.evaluate(() => window.__froggy.game().scene.getScene('PoliceEscape3D').scene.restart());
    await sleep(2500);
    for (let i = 0; i < 60; i++) {
      if ((await page.evaluate(() => window.__police?.phase)) === 'play') break;
      await sleep(250);
    }
    const setup = await page.evaluate(() => {
      const p = window.__froggy.game().scene.getScene('PoliceEscape3D');
      const P = window.__police;
      const rm = p.b.rooms.find((r) => r.floor === 3 && r.open && r.special === 'none');
      // you just inside it, a couple of metres in, the door shut behind you
      const inX = rm.side * (1.25 + 1.6);
      p.me = { x: inX, z: rm.dz, f: 3, well: false, seg: 'top', h: 9 };
      P.setDoor(`room-${rm.id}`, 0);
      p.segCache.clear();
      p.cops.forEach((c, i) => {
        c.inLobby = false;
        c.arrived = true;
        c.path = [];
        c.pathTo = null;
        c.stuckT = 0;
        c.detourT = 0;
        if (i === 0) {
          c.m = { x: 0, z: rm.dz + 6, f: 3, well: false, seg: 'top', h: 9 };
          c.mode = 'chase';
          // the last he saw of you: at the door, going in
          c.lkp = { x: rm.side * 1.0, z: rm.dz, f: 3, well: false, h: 9 };
          c.lostT = 0;
          c.acts = [];
        } else {
          c.m = { x: 0, z: 30 + i, f: 6, well: false, seg: 'top', h: 18 };
          c.mode = 'task';
          c.acts = [{ k: 'look', t: 999 }];
        }
      });
      return { room: rm.id };
    });
    const t0 = Date.now();
    let st = null;
    while (Date.now() - t0 < 30000) {
      await sleep(250);
      st = await page.evaluate((id) => {
        const p = window.__froggy.game().scene.getScene('PoliceEscape3D');
        const c = p.cops[0];
        const d = p.b.doors.find((x) => x.id === `room-${id}`);
        return { phase: p.phase, mode: c.mode, door: +d.k.toFixed(2), x: +c.m.x.toFixed(2), z: +c.m.z.toFixed(2) };
      }, setup.room);
      if (st.phase !== 'play') break;
    }
    check('you into a flat and the door shut behind you: he opens it and has you', st && st.phase !== 'play', JSON.stringify(st));
  }

  // HIS LIGHT STOPS AT THE WALL.  An officer in the corridor with his torch
  // on a wall a metre off: the light reaches the wall and no further, so the
  // flat behind it stays dark (and aimed down the corridor it reaches on).
  if (!ONLY || ONLY.split(',').includes('torch')) {
    await page.evaluate(() => window.__froggy.game().scene.getScene('PoliceEscape3D').scene.restart());
    await sleep(3000);
    // (all three on their own rounds, you out of the way on 6's top landing)
    const t = await page.evaluate(async () => {
      const p = window.__froggy.game().scene.getScene('PoliceEscape3D');
      const out = { n: 0, bad: [], short: 0 };
      const t0 = performance.now();
      while (performance.now() - t0 < 20000) {
        await new Promise((r) => setTimeout(r, 150));
        if (p.phase !== 'play') continue;
        p.me = { x: -0.9, z: 0.6, f: 6, well: true, seg: 'top', h: 18 };
        for (const c of p.cops) {
          if (c.inLobby) continue;
          out.n++;
          const len = Math.max(0.2, Math.min(9, c.st.beamLen));
          const dist = c.model.torch.distance;
          if (dist > len + 0.5 + 1e-3) out.bad.push({ i: c.i, len: +len.toFixed(2), dist: +dist.toFixed(2) });
          if (len < 4) out.short++;
        }
      }
      return out;
    });
    check('every torch, all the time: its light ends where its beam meets something', t.n > 20 && t.bad.length === 0, t.bad.length ? JSON.stringify(t.bad.slice(0, 4)) : `${t.n} samples, ${t.short} of them on something within 4 m`);
  }

  // HEARD RUNNING.  Him on your floor with his back to you, out of sight:
  // walking he does not know you are there; running, he hears it and comes.
  if (!ONLY || ONLY.split(',').includes('noise')) {
    const setup = async () => {
      await page.evaluate(() => window.__froggy.game().scene.getScene('PoliceEscape3D').scene.restart());
      await sleep(2500);
      for (let i = 0; i < 60; i++) {
        if ((await page.evaluate(() => window.__police?.phase)) === 'play') break;
        await sleep(250);
      }
      await page.evaluate(() => {
        const p = window.__froggy.game().scene.getScene('PoliceEscape3D');
        p.me = { x: 0, z: 8, f: 3, well: false, seg: 'top', h: 9 };
        // facing down the corridor, away from him
        p.yaw = 0;
        p.segCache.clear();
        p.cops.forEach((c, i) => {
          c.inLobby = false;
          c.arrived = true;
          c.path = [];
          c.mode = 'task';
          c.sus = 0;
          if (i === 0) {
            c.m = { x: 0, z: 15, f: 3, well: false, seg: 'top', h: 9 };
            // looking the other way, at the far end
            c.yaw = 0;
            c.acts = [{ k: 'look', t: 999 }];
          } else {
            c.m = { x: 0, z: 30 + i, f: 6, well: false, seg: 'top', h: 18 };
            c.acts = [{ k: 'look', t: 999 }];
          }
        });
      });
    };
    const modeAfter = async (keys, ms) => {
      for (const k of keys) await page.keyboard.down(k);
      const t0 = Date.now();
      let m = 'task';
      while (Date.now() - t0 < ms) {
        await sleep(150);
        m = await page.evaluate(() => window.__froggy.game().scene.getScene('PoliceEscape3D').cops[0].mode);
        if (m === 'chase') break;
      }
      for (const k of keys) await page.keyboard.up(k);
      return m;
    };
    await setup();
    const walking = await modeAfter(['KeyW'], 2500);
    check('walking where he cannot see you, he does not come', walking === 'task', walking);
    await setup();
    const running = await modeAfter(['ShiftLeft', 'KeyW'], 2500);
    check('running, he hears it and is after you', running === 'chase', running);
  }

  // THE SPEEDS.  From the lobby, on the way to their floors: twice your run.
  // There, searching: 1.4 times your walk, and running after you 1.4 times
  // your run.  (Measured from how far each one actually moved, in the
  // scene's own time, while walking a route and not waiting at a door.)
  if (!ONLY || ONLY.split(',').includes('speed')) {
    await page.evaluate(() => window.__froggy.game().scene.getScene('PoliceEscape3D').scene.restart());
    await sleep(2500);
    const samples = await page.evaluate(async () => {
      const p = window.__froggy.game().scene.getScene('PoliceEscape3D');
      // you out of everybody's way, safe in 612's corridor end, unseen
      const out = [];
      const prev = p.cops.map((c) => ({ x: c.m.x, z: c.m.z, h: c.m.h, t: p.clock }));
      const t0 = performance.now();
      while (performance.now() - t0 < 40000) {
        await new Promise((r) => setTimeout(r, 200));
        if (p.phase !== 'play') {
          prev.forEach((q, i) => Object.assign(q, { x: p.cops[i].m.x, z: p.cops[i].m.z, h: p.cops[i].m.h, t: p.clock }));
          continue;
        }
        // (the player parked in the well's top landing, where nobody is sent)
        p.me = { x: -0.9, z: 0.6, f: 6, well: true, seg: 'top', h: 18 };
        p.cops.forEach((c, i) => {
          const q = prev[i];
          const dt = p.clock - q.t;
          if (dt > 0.05) {
            const d = Math.hypot(c.m.x - q.x, c.m.z - q.z, (c.m.h - q.h) * 0);
            out.push({ i, v: d / dt, arrived: c.arrived, mode: c.mode, door: !!c.waitDoor, lobby: c.inLobby, act: c.acts[0]?.k ?? '', pace: c.acts[0]?.pace ?? 0 });
          }
          Object.assign(q, { x: c.m.x, z: c.m.z, h: c.m.h, t: p.clock });
        });
      }
      return out;
    });
    const moving = samples.filter((s) => !s.door && !s.lobby && s.v > 0.5 && s.mode !== 'chase' && s.mode !== 'alert');
    const median = (a) => {
      const b = [...a].sort((x, y) => x - y);
      return b.length ? b[Math.floor(b.length / 2)] : 0;
    };
    const before = moving.filter((s) => !s.arrived).map((s) => s.v);
    const after = moving.filter((s) => s.arrived).map((s) => s.v);
    const RUN = 4.0;
    const WALK = 2.4;
    // (the median of the fastest half: corners and the turn at each landing slow everyone)
    const top = (a) => median(a.sort((x, y) => y - x).slice(0, Math.max(1, Math.ceil(a.length / 2))));
    check('on the way to their floors they move at about twice your run', before.length > 5 && Math.abs(top(before) / (RUN * 2) - 1) < 0.2, `${top(before).toFixed(2)} m/s from ${before.length} samples, twice your run is ${RUN * 2}`);
    check('once there, never faster than 1.4 times your run, and searching about 1.4 times your walk', after.length > 5 && top(after) <= RUN * 1.4 * 1.1 && top(after) >= WALK * 1.4 * 0.8, `${top(after).toFixed(2)} m/s from ${after.length} samples (1.4x walk ${(WALK * 1.4).toFixed(2)}, 1.4x run ${(RUN * 1.4).toFixed(2)})`);
  }
} catch (e) {
  console.error(e);
  failed++;
} finally {
  await browser.close();
}
if (errors.length) console.log('page errors:', errors.slice(0, 5).join('; '));
console.log(`\n${ran - failed}/${ran} passed`);
process.exit(failed || errors.length ? 1 : 0);
