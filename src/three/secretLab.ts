/**
 * THE LABORATORY, AS IT IS NOW: somewhere things are done to him.
 *
 * The lab behind the wall was pale blue tile under even white light -- a
 * clean room, calm to the point of being empty.  This is the same room, with
 * the same things in the same places, gone dark and put to use:
 *
 *   THE ROOM.  Stained tile underfoot, poured concrete and grimy wall tile,
 *   pipes and cable trays along a ceiling you can barely see, fluorescent
 *   fixtures on chains (two of them failing), a red beacon turning over the
 *   rack, hazard stripe where you should not stand, signs, shelving and
 *   storage, drums, gas bottles, a monitoring desk, and dust in the light.
 *
 *   THE CONTAINMENT CHAMBER.  The tube stands on a raised steel deck edged in
 *   hazard stripe, inside a frame of four posts to the ceiling, fed from above
 *   by hoses and valves, gauged, labelled, and cabled to everything else.
 *
 *   THE EXPERIMENT MACHINE.  Beside the tube, piped into it: a hopper on top
 *   takes whatever is in a flask, a reservoir on the front shows it going in,
 *   and it pumps it down the feed into his water.  Each flask is a different
 *   sequence, and each is a different thing done to him -- a colour in the
 *   water, a light, a sound, a motion of the machine, and a way he suffers it.
 *   Nothing is shown being done to his body: it is all in how he moves, his
 *   face, his hands on the glass and his voice.
 *
 *   THE TUBE'S OWN CONTROLS.  A console with one big button drains the water
 *   out of the tube, and the level visibly goes down; press it again and it
 *   pours back in from the top.  With the tube empty, a lever beside it opens
 *   a small barred port in the glass.  He comes to it.  He can see you
 *   through it.  He cannot get anything through the bars.
 *
 * Coordinates are the lab's own (secretRoom's root space).
 */

import * as THREE from 'three';
import type { Box } from './hideRooms';
import type { FroggyMonster, FroggyPose, HandGoal } from './froggyMonster';
import { audio, type SfxName } from '../core/audio';
import { frost, hazard, puff, screen, signTexture } from './labTextures';

export interface LabParts {
  root: THREE.Group;
  lights: THREE.Light[];
  blockers: Box[];
  /** The shell: x from minX to maxX, z from minZ to the divider, ceiling at h. */
  shell: { minX: number; maxX: number; minZ: number; divideZ: number; h: number; stairX0: number; stairZ0: number };
  ambient: THREE.AmbientLight;
  tube: {
    x: number;
    z: number;
    r: number;
    h: number;
    /** Where the liquid column starts (the top of the plinth). */
    base: number;
    liquid: THREE.Mesh;
    liquidMat: THREE.MeshLambertMaterial;
    glass: THREE.Mesh;
    light: THREE.PointLight;
    bubbles: Array<{ m: THREE.Mesh; a: number; r: number; speed: number }>;
    specimen: FroggyMonster;
  };
}

export type WaterState = 'full' | 'draining' | 'empty' | 'filling';

export interface LabStatus {
  water: WaterState;
  /** 0..1 how full the tube is. */
  level: number;
  hatch: boolean;
  /** The sequence running, by name, if one is. */
  running: string | null;
}

export interface Lab {
  /** Where to stand for each control. */
  machine: { x: number; z: number };
  panel: { x: number; z: number };
  lever: { x: number; z: number };
  status(): LabStatus;
  /** Why the machine will not take a flask right now, or null if it will. */
  refuses(): string | null;
  /** Put a flask's contents in.  Returns the sequence's name. */
  run(flask: string): string | null;
  /** The button on the console: drain, or fill.  What it did, or why it did nothing. */
  pressWater(): 'drain' | 'fill' | 'hatch-open' | 'moving' | 'running';
  /** The lever: open or shut the port.  What it did, or why it did nothing. */
  pullLever(): 'open' | 'closed' | 'full' | 'moving';
  /** Everything that moves.  `heat` is the heater's hold on him, 0..1. */
  tick(dt: number, viewer: THREE.Vector3 | null, heat: number): void;
  /** When the flask that went in can go back on its shelf (the sequence is over). */
  finished(): boolean;
}

// -------------------------------------------------------------- the sequences

interface Sequence {
  id: string;
  /** Which flask runs it. */
  flask: string;
  name: string;
  /** Said on the machine's screen while it runs. */
  lines: string[];
  color: number;
  dur: number;
}

/** One per flask.  The two new flasks live on the shelf and on the machine's own tray. */
export const SEQUENCES: Sequence[] = [
  { id: 'acid', flask: 'flask-green', name: 'CORROSION', lines: ['AGENT: CAUSTIC', 'OBSERVE: AVOIDANCE'], color: 0x7cff3a, dur: 8.5 },
  { id: 'dream', flask: 'flask-pink', name: 'NIGHT TERROR', lines: ['AGENT: HYPNOTIC', 'OBSERVE: REM EVENTS'], color: 0xff6fc0, dur: 9.5 },
  { id: 'cryo', flask: 'flask-blue', name: 'CRYO SHOCK', lines: ['AGENT: CRYOGENIC', 'OBSERVE: THERMAL STRESS'], color: 0x9fe6ff, dur: 9.5 },
  { id: 'shock', flask: 'flask-amber', name: 'CONDUCTANCE', lines: ['AGENT: ELECTROLYTE', 'OBSERVE: MUSCLE RESPONSE'], color: 0xffb640, dur: 8.5 },
  { id: 'void', flask: 'flask-violet', name: 'SENSORY VOID', lines: ['AGENT: OPACIFIER', 'OBSERVE: ORIENTATION'], color: 0x9b5cff, dur: 10.5 },
];

const WATER = 0x74d8f2;
const WATER_OPACITY = 0.32;

const smooth = (a: number, b: number, t: number): number => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

export function buildLab(p: LabParts): Lab {
  const { root, lights, blockers, shell, tube } = p;
  const S = shell;

  const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c });
  const lit = (c: number) => new THREE.MeshBasicMaterial({ color: c });
  const steelDark = lam(0x262d33);
  const steel = lam(0x46515a);
  const steelLight = lam(0x6c7983);
  const rubber = lam(0x131517);
  const copper = lam(0x8a5a36);

  const add = <T extends THREE.Object3D>(o: T): T => {
    root.add(o);
    return o;
  };
  /** A box, footprint-centred, base on `y`. */
  const box = (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, solid = false, rotY = 0): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.rotation.y = rotY;
    add(m);
    if (solid) {
      const turned = Math.abs(Math.sin(rotY)) > 0.5;
      blockers.push({ x, z, w: turned ? d : w, d: turned ? w : d, h, color: 0x262d33 });
    }
    return m;
  };
  const cyl = (mat: THREE.Material, rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 12): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y + h / 2, z);
    add(m);
    return m;
  };
  /** A pipe or a hose along a smooth curve through the given points. */
  const pipe = (pts: Array<[number, number, number]>, r: number, mat: THREE.Material): THREE.CatmullRomCurve3 => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, pts.length * 10), r, 8, false), mat));
    return curve;
  };
  /** A sign: a plate facing `rotY` (0 faces +z). */
  const sign = (lines: string[], o: Parameters<typeof signTexture>[1], w: number, h: number, x: number, y: number, z: number, rotY: number): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(lines, o), color: 0xa8a8a8 }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    add(m);
    return m;
  };
  const valve = (x: number, y: number, z: number, rotY: number, color = 0x8a1c1c): THREE.Mesh => {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 16), lam(color));
    wheel.position.set(x, y, z);
    wheel.rotation.y = rotY;
    add(wheel);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.025, 0.025), wheel.material);
    wheel.add(spoke);
    const spoke2 = spoke.clone();
    spoke2.rotation.z = Math.PI / 2;
    wheel.add(spoke2);
    return wheel;
  };

  // =============================================================== THE ROOM
  //
  // ---- the ceiling: pipes along it, and cable trays down both sides
  for (const [z, r, mat] of [
    [-17.6, 0.16, steel],
    [-12.2, 0.12, copper],
    [-5.4, 0.18, steelDark],
  ] as const) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, S.maxX - S.minX, 10), mat);
    m.rotation.z = Math.PI / 2;
    m.position.set(0, S.h - 0.45, z);
    add(m);
    for (let x = S.minX + 1.5; x < S.maxX; x += 3) box(steelDark, 0.06, 0.4, 0.06, x, S.h - 0.4, z);
  }
  for (const x of [S.minX + 1.3, S.maxX - 1.3]) {
    box(steelDark, 0.55, 0.06, S.divideZ - S.minZ, x, S.h - 0.75, (S.minZ + S.divideZ) / 2);
    for (let i = 0; i < 3; i++) box(rubber, 0.08, 0.08, S.divideZ - S.minZ, x - 0.15 + i * 0.15, S.h - 0.69, (S.minZ + S.divideZ) / 2);
  }

  // ---- the lights: fluorescent fixtures on chains, two of them failing
  const fixtures: Array<{ light: THREE.PointLight; tube: THREE.MeshBasicMaterial; base: number; fails: boolean; seed: number }> = [];
  for (const [x, z, fails] of [
    [-4, -15, false],
    [4, -15, true],
    [-4, -6.2, false],
    [3, -8, false],
    [0, -11.5, true],
  ] as const) {
    box(steelDark, 2.4, 0.12, 0.34, x, S.h - 1.05, z);
    for (const dx of [-1, 1]) box(steelLight, 0.02, 0.95, 0.02, x + dx * 1.0, S.h - 0.95, z);
    const tm = lit(0xe6f6ff);
    const t = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.1), tm);
    t.position.set(x, S.h - 1.08, z);
    add(t);
    const l = new THREE.PointLight(0xcfe6f0, 8.5, 15, 1.35);
    l.position.set(x, S.h - 1.4, z);
    add(l);
    lights.push(l);
    fixtures.push({ light: l, tube: tm, base: 8.5, fails, seed: x * 3.1 + z });
  }
  // the red beacon over the rack, turning
  const beaconMat = lit(0xff2a20);
  cyl(steelDark, 0.14, 0.16, 0.1, -5.6, 3.9, S.minZ + 0.25);
  const beacon = cyl(beaconMat, 0.1, 0.12, 0.18, -5.6, 4.0, S.minZ + 0.25);
  const beaconLight = new THREE.PointLight(0xff2a20, 3, 9, 1.4);
  beaconLight.position.set(-5.6, 4.1, S.minZ + 0.8);
  add(beaconLight);
  lights.push(beaconLight);

  // ---- the walls: pipes up them, junction boxes, vents, and the signs
  for (const z of [-15.8, -11.2, -4.2]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, S.h, 8), steel);
    m.position.set(S.minX + 0.12, S.h / 2, z);
    add(m);
  }
  {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, S.maxX - S.minX, 8), copper);
    m.rotation.z = Math.PI / 2;
    m.position.set(0, 3.4, S.minZ + 0.14);
    add(m);
  }
  const leds: THREE.MeshBasicMaterial[] = [];
  for (const [x, y, z, rot] of [
    [S.minX + 0.12, 2.1, -12.4, Math.PI / 2],
    [2.2, 2.3, S.minZ + 0.1, 0],
    [S.maxX - 0.1, 2.0, -9.2, -Math.PI / 2],
  ] as const) {
    box(steelDark, 0.5, 0.6, 0.18, x, y, z, false, rot);
    const lm = lit(0x3fe39b);
    leds.push(lm);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), lm);
    led.position.set(x + Math.sin(rot) * 0.1, y + 0.45, z + Math.cos(rot) * 0.1);
    add(led);
  }
  for (const [x, z, rot] of [
    [-1.5, S.minZ + 0.05, 0],
    [S.maxX - 0.05, -14.2, -Math.PI / 2],
  ] as const) {
    const vent = box(steelDark, 1.1, 0.7, 0.06, x, 5.2, z, false, rot);
    for (let i = 0; i < 5; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.06), lam(0x0c0e10));
      slat.position.set(0, -0.26 + i * 0.13, 0.03);
      vent.add(slat);
    }
  }
  sign(['BIOHAZARD', 'LEVEL 4 CONTAINMENT'], { stripe: true, bio: true, bg: '#d8b43a' }, 2.4, 0.75, S.minX + 0.03, 3.3, -14.0, Math.PI / 2);
  sign(['AUTHORISED', 'PERSONNEL ONLY'], { bg: '#b83a32', fg: '#f0e8d8' }, 1.5, 0.5, -1.8, 2.6, S.minZ + 0.03, 0);
  sign(['OBSERVATION GALLERY', 'UP THE STAIRS -->'], { bg: '#2a3a44', fg: '#d8e8f0' }, 2.2, 0.62, 3.6, 2.5, S.divideZ - 0.28, Math.PI);
  sign(['NO ENTRY', 'DURING SEQUENCES'], { stripe: true, bg: '#d9d3c2' }, 1.2, 0.46, S.maxX - 0.03, 2.4, -12.2, -Math.PI / 2);

  // ---- storage: shelving against the back and right-hand walls
  const jarMat = new THREE.MeshLambertMaterial({ color: 0x9ccf88, transparent: true, opacity: 0.55 });
  const cardboard = lam(0x6a5540);
  const shelf = (x: number, z: number, rot: number, seed: number): void => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    add(g);
    const w = 1.3;
    const d = 0.55;
    for (const [dx, dz] of [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [-w / 2, d / 2],
      [w / 2, d / 2],
    ]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.5, 0.05), steel);
      post.position.set(dx, 1.25, dz);
      g.add(post);
    }
    let s = seed;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 4; i++) {
      const y = 0.25 + i * 0.62;
      const board = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.04, d), steelLight);
      board.position.set(0, y, 0);
      g.add(board);
      // what is on it: boxes, jars, bottles
      for (let x0 = -w / 2 + 0.15; x0 < w / 2 - 0.1; ) {
        const kind = r();
        if (kind < 0.4) {
          const bw = 0.25 + r() * 0.2;
          const bh = 0.2 + r() * 0.2;
          const bx = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.35), cardboard);
          bx.position.set(x0 + bw / 2, y + 0.02 + bh / 2, 0);
          g.add(bx);
          x0 += bw + 0.05;
        } else if (kind < 0.75) {
          const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.24, 10), jarMat);
          jar.position.set(x0 + 0.08, y + 0.14, (r() - 0.5) * 0.2);
          g.add(jar);
          x0 += 0.2;
        } else {
          const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.3, 8), lam(r() < 0.5 ? 0x4a2a18 : 0x2a3a4a));
          bottle.position.set(x0 + 0.06, y + 0.17, (r() - 0.5) * 0.2);
          g.add(bottle);
          x0 += 0.14;
        }
      }
    }
    const turned = Math.abs(Math.sin(rot)) > 0.5;
    blockers.push({ x, z, w: turned ? d : w, d: turned ? w : d, h: 2.5, color: 0x46515a });
  };
  shelf(-3.0, S.minZ + 0.4, 0, 3);
  shelf(-1.6, S.minZ + 0.4, 0, 8);
  shelf(S.maxX - 0.4, -15.0, -Math.PI / 2, 14);
  shelf(S.maxX - 0.4, -13.6, -Math.PI / 2, 21);

  // ---- drums and gas bottles
  const drumMat = lam(0x9a7a1a);
  for (const [x, z] of [
    [-8.2, -3.4],
    [-7.4, -3.2],
    [-8.25, -4.2],
  ] as const) {
    cyl(drumMat, 0.3, 0.3, 0.88, x, 0, z, 14);
    cyl(rubber, 0.31, 0.31, 0.04, x, 0.25, z, 14);
    cyl(rubber, 0.31, 0.31, 0.04, x, 0.62, z, 14);
    blockers.push({ x, z, w: 0.62, d: 0.62, h: 0.9, color: 0x9a7a1a });
  }
  for (const [z, c] of [
    [-10.0, 0x2f6a3a],
    [-9.65, 0x6a6f74],
    [-9.3, 0x8a2020],
  ] as const) {
    cyl(lam(c), 0.14, 0.14, 1.45, S.minX + 0.3, 0, z, 10);
    cyl(steelLight, 0.06, 0.1, 0.16, S.minX + 0.3, 1.45, z, 8);
  }
  box(steelDark, 0.06, 0.05, 1.1, S.minX + 0.46, 1.1, -9.65);
  blockers.push({ x: S.minX + 0.3, z: -9.65, w: 0.5, d: 1.1, h: 1.6, color: 0x6a6f74 });

  // ---- the monitoring desk on the right, three screens watching him
  const deskX = S.maxX - 1.35;
  const deskZ = -11.7;
  box(steelDark, 0.8, 0.8, 2.0, deskX, 0, deskZ, true);
  box(steelLight, 0.9, 0.05, 2.1, deskX, 0.8, deskZ);
  const deskScreens: Array<ReturnType<typeof screen>> = [];
  const lineAt = { t: 0 };
  for (let i = 0; i < 3; i++) {
    const z = deskZ - 0.66 + i * 0.66;
    box(lam(0x15181b), 0.1, 0.46, 0.6, deskX + 0.2, 0.85, z, false);
    const scr = screen(128, 96, (ctx, w, h) => {
      ctx.fillStyle = '#04120c';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#3fe39b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w; x += 4) {
        const y = h / 2 + Math.sin((x + lineAt.t * 60 + i * 40) * 0.12) * (10 + i * 6) * Math.sin(lineAt.t + i);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = '#3fe39b';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(['VITALS', 'EEG', 'THERMAL'][i], 6, 14);
    });
    deskScreens.push(scr);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.4), new THREE.MeshBasicMaterial({ map: scr.texture }));
    m.position.set(deskX + 0.14, 1.08, z);
    m.rotation.y = -Math.PI / 2;
    add(m);
  }
  // a chair, pushed back
  box(rubber, 0.5, 0.08, 0.5, deskX - 0.9, 0.48, deskZ + 0.3);
  box(rubber, 0.08, 0.55, 0.5, deskX - 1.12, 0.52, deskZ + 0.3);
  cyl(steel, 0.03, 0.03, 0.48, deskX - 0.9, 0, deskZ + 0.3, 6);

  // ---- the dust, turning slowly in the light
  const dustN = 240;
  const dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = S.minX + Math.random() * (S.maxX - S.minX);
    dustPos[i * 3 + 1] = 0.3 + Math.random() * (S.h - 1);
    dustPos[i * 3 + 2] = S.minZ + Math.random() * (S.divideZ - S.minZ);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ map: puff(), size: 0.07, color: 0xcfe0e6, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  add(dust);

  // hazard stripe at the foot of the stairs and along the divider
  const stripe = (w: number, d: number, x: number, z: number, rot = 0, rep = 6): void => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: hazard([rep, 1]) }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rot;
    m.position.set(x, 0.02, z);
    add(m);
  };
  stripe(S.maxX - S.stairX0, 0.35, (S.maxX + S.stairX0) / 2, S.stairZ0 - 0.3, 0, 5);
  stripe(S.stairX0 - S.minX, 0.3, (S.minX + S.stairX0) / 2, S.divideZ - 0.45, 0, 12);

  // ============================================= THE CONTAINMENT CHAMBER
  const T = tube;
  // the deck: an eight-sided steel platform the plinth stands on, edged in stripe
  const deckR = T.r + 0.62;
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(deckR, deckR + 0.05, 0.12, 8), steelDark);
  deck.position.set(T.x, 0.06, T.z);
  deck.rotation.y = Math.PI / 8;
  add(deck);
  const deckEdge = new THREE.Mesh(
    new THREE.CylinderGeometry(deckR + 0.06, deckR + 0.06, 0.12, 8, 1, true),
    new THREE.MeshLambertMaterial({ map: hazard([10, 1]) }),
  );
  deckEdge.position.set(T.x, 0.06, T.z);
  deckEdge.rotation.y = Math.PI / 8;
  add(deckEdge);
  // four posts to the ceiling, a ring beam at the top, braces
  const postR = T.r + 0.42;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const px = T.x + Math.sin(a) * postR;
    const pz = T.z + Math.cos(a) * postR;
    box(steel, 0.16, S.h, 0.16, px, 0, pz);
    // a gauge on each, at eye height
    const g = cyl(steelDark, 0.12, 0.12, 0.05, px + Math.sin(a) * 0.1, 1.6, pz + Math.cos(a) * 0.1, 14);
    g.rotation.x = Math.PI / 2;
    g.rotation.z = -a;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14), lit(0xd8d4c0));
    face.position.set(px + Math.sin(a) * 0.14, 1.625, pz + Math.cos(a) * 0.14);
    face.rotation.y = a;
    add(face);
  }
  for (let i = 0; i < 4; i++) {
    const a0 = Math.PI / 4 + (i * Math.PI) / 2;
    const a1 = a0 + Math.PI / 2;
    const x0 = T.x + Math.sin(a0) * postR;
    const z0 = T.z + Math.cos(a0) * postR;
    const x1 = T.x + Math.sin(a1) * postR;
    const z1 = T.z + Math.cos(a1) * postR;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.14), steel);
    beam.position.set((x0 + x1) / 2, S.h - 1.3, (z0 + z1) / 2);
    beam.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    add(beam);
  }
  // the machinery on the cap: a motor housing, hoses out to the posts, valves
  const capTop = T.base + T.h + 0.7;
  box(steelDark, 1.2, 0.5, 1.2, T.x, capTop, T.z);
  cyl(steel, 0.25, 0.25, S.h - capTop - 0.5, T.x, capTop + 0.5, T.z, 10);
  const hoseValves: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const ex = T.x + Math.sin(a) * (T.r + 0.1);
    const ez = T.z + Math.cos(a) * (T.r + 0.1);
    const pa = a + Math.PI / 4;
    pipe(
      [
        [T.x + Math.sin(a) * 0.5, capTop + 0.3, T.z + Math.cos(a) * 0.5],
        [ex, capTop + 0.9, ez],
        [T.x + Math.sin(pa) * postR, S.h - 1.6, T.z + Math.cos(pa) * postR],
      ],
      0.06,
      rubber,
    );
    if (i % 2 === 0) hoseValves.push(valve(ex, capTop + 0.75, ez, a, 0x8a1c1c));
  }
  // the plate on the plinth
  const facing = Math.atan2(-0.9, -3.2); // toward the console side
  sign(['SPECIMEN F-01', 'DO NOT TAP THE GLASS'], { bg: '#c9c2b0' }, 0.9, 0.3, T.x + Math.sin(facing) * (T.r + 0.52), 0.34, T.z + Math.cos(facing) * (T.r + 0.52), facing);

  // ---- THE WATER SURFACE, the jet that fills it, and the frost that can form
  const surfaceMat = new THREE.MeshBasicMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
  const surface = new THREE.Mesh(new THREE.CircleGeometry(T.r - 0.06, 28), surfaceMat);
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(T.x, T.base + T.h, T.z);
  add(surface);
  const jetMat = new THREE.MeshBasicMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.5, depthWrite: false });
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 1, 10, 1, true), jetMat);
  jet.visible = false;
  add(jet);
  const frostMat = new THREE.MeshBasicMaterial({ map: frost(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const frostBand = new THREE.Mesh(new THREE.CylinderGeometry(T.r - 0.03, T.r - 0.03, 1, 28, 1, true), frostMat);
  frostBand.visible = false;
  add(frostBand);
  // steam over the top, for when the water is made to burn
  const steamTex = puff();
  const steam: THREE.Sprite[] = [];
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, color: 0xd8ffd0, transparent: true, opacity: 0, depthWrite: false }));
    s.scale.setScalar(0.6);
    s.visible = false;
    add(s);
    steam.push(s);
  }
  // lightning, for the current
  const bolts: THREE.Line[] = [];
  const boltMat = new THREE.LineBasicMaterial({ color: 0xfff1b0 });
  for (let i = 0; i < 3; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3));
    const l = new THREE.Line(g, boltMat);
    l.visible = false;
    add(l);
    bolts.push(l);
  }
  const zap = (): void => {
    for (const l of bolts) {
      const pos = l.geometry.getAttribute('position') as THREE.BufferAttribute;
      let a = Math.random() * Math.PI * 2;
      for (let k = 0; k < 14; k++) {
        a += (Math.random() - 0.5) * 0.9;
        const rr = (T.r - 0.2) * (0.5 + Math.random() * 0.5);
        pos.setXYZ(k, T.x + Math.sin(a) * rr, T.base + 0.2 + (k / 13) * (T.h - 0.4), T.z + Math.cos(a) * rr);
      }
      pos.needsUpdate = true;
    }
  };
  // electrode rings top and bottom, which the current jumps between
  for (const y of [T.base + 0.15, T.base + T.h - 0.15]) {
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(T.r - 0.08, 0.04, 6, 32), copper);
    ringM.rotation.x = Math.PI / 2;
    ringM.position.set(T.x, y, T.z);
    add(ringM);
  }

  // ---- THE PORT.  A small barred opening in the glass on the console side,
  // behind a steel shutter.  The glass is rebuilt with that patch left out,
  // so when the shutter is up there really is nothing in the hole but bars.
  const hd = new THREE.Vector2(0.55, -3.25).normalize(); // tube -> console side
  const portA = Math.atan2(hd.x, hd.y); // three's cylinder angle: x = sin, z = cos
  // small, and at the height of his face when he stands and stoops to it
  const PORT_HALF = 0.12;
  const PORT_Y0 = 1.86;
  const PORT_Y1 = 2.12;
  /** How far the steel ring round it reaches past the hole: a ring, not a panel. */
  const RIM = 0.07;
  const RIM_Y = 0.07;
  {
    const gm = T.glass.material as THREE.Material;
    const y0 = T.base;
    const hTotal = T.h;
    root.remove(T.glass);
    const piece = (thetaStart: number, thetaLen: number, ya: number, yb: number): void => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(T.r, T.r, yb - ya, 10, 1, true, thetaStart, thetaLen), gm);
      m.position.set(T.x, (ya + yb) / 2, T.z);
      add(m);
    };
    piece(portA + PORT_HALF, Math.PI * 2 - PORT_HALF * 2, y0, y0 + hTotal);
    piece(portA - PORT_HALF, PORT_HALF * 2, y0, PORT_Y0);
    piece(portA - PORT_HALF, PORT_HALF * 2, PORT_Y1, y0 + hTotal);
  }
  // the steel band round the port, and the bars across it
  const bandMat = new THREE.MeshLambertMaterial({ color: 0x46515a, side: THREE.DoubleSide });
  const band = (a0: number, a1: number, ya: number, yb: number): void => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(T.r + 0.03, T.r + 0.03, yb - ya, 6, 1, true, a0, a1 - a0), bandMat);
    m.position.set(T.x, (ya + yb) / 2, T.z);
    add(m);
  };
  band(portA - PORT_HALF - RIM, portA - PORT_HALF, PORT_Y0 - RIM_Y, PORT_Y1 + RIM_Y);
  band(portA + PORT_HALF, portA + PORT_HALF + RIM, PORT_Y0 - RIM_Y, PORT_Y1 + RIM_Y);
  band(portA - PORT_HALF, portA + PORT_HALF, PORT_Y1, PORT_Y1 + RIM_Y);
  band(portA - PORT_HALF, portA + PORT_HALF, PORT_Y0 - RIM_Y, PORT_Y0);
  for (const f of [-0.6, 0, 0.6]) {
    const a = portA + f * PORT_HALF;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, PORT_Y1 - PORT_Y0, 6), steelLight);
    bar.position.set(T.x + Math.sin(a) * (T.r + 0.01), (PORT_Y0 + PORT_Y1) / 2, T.z + Math.cos(a) * (T.r + 0.01));
    add(bar);
  }
  // the shutter: a curved plate on the outside, slid down over the port
  const shutter = new THREE.Mesh(
    new THREE.CylinderGeometry(T.r + 0.07, T.r + 0.07, PORT_Y1 - PORT_Y0 + 0.06, 6, 1, true, portA - PORT_HALF - 0.03, (PORT_HALF + 0.03) * 2),
    new THREE.MeshLambertMaterial({ color: 0x5a6570, side: THREE.DoubleSide }),
  );
  const shutterDown = (PORT_Y0 + PORT_Y1) / 2;
  shutter.position.set(T.x, shutterDown, T.z);
  add(shutter);
  const portWorld = (inset: number, y: number, spread = 0): THREE.Vector3 =>
    root.localToWorld(new THREE.Vector3(T.x + Math.sin(portA + spread) * (T.r - inset), y, T.z + Math.cos(portA + spread) * (T.r - inset)));

  // ---- THE TUBE CONSOLE.  One big button, a level gauge, and a label.
  const consoleAt = { x: T.x - 0.3, z: T.z - 3.25 };
  box(steelDark, 1.3, 0.95, 0.55, consoleAt.x, 0, consoleAt.z, true);
  const panelTop = box(steel, 1.34, 0.08, 0.62, consoleAt.x, 0.95, consoleAt.z);
  panelTop.rotation.x = 0.35;
  const bigButtonMat = lit(0x2fbf5a);
  const bigButton = cyl(bigButtonMat, 0.13, 0.13, 0.08, consoleAt.x - 0.25, 1.02, consoleAt.z - 0.05, 16);
  bigButton.rotation.x = 0.35;
  cyl(steelLight, 0.18, 0.18, 0.03, consoleAt.x - 0.25, 0.99, consoleAt.z - 0.05, 16).rotation.x = 0.35;
  // the level gauge: a slot with the water in it
  box(lam(0x0a0d10), 0.12, 0.55, 0.04, consoleAt.x + 0.35, 1.02, consoleAt.z - 0.33);
  const gaugeMat = lit(0x5fd8ff);
  const gauge = box(gaugeMat, 0.08, 0.5, 0.03, consoleAt.x + 0.35, 1.045, consoleAt.z - 0.35);
  sign(['TUBE CONTROL', 'DRAIN  /  FILL'], { bg: '#2a3a44', fg: '#d8e8f0' }, 1.0, 0.3, consoleAt.x - 0.1, 0.62, consoleAt.z - 0.285, Math.PI);
  // a conduit from the console to the plinth
  pipe(
    [
      [consoleAt.x, 0.05, consoleAt.z + 0.3],
      [consoleAt.x + 0.2, 0.05, consoleAt.z + 1.0],
      [T.x + hd.x * (T.r + 0.5), 0.1, T.z + hd.y * (T.r + 0.5)],
    ],
    0.05,
    rubber,
  );

  // ---- THE LEVER, beside the console, and the rod that runs from it to the port.
  const leverAt = { x: T.x + 1.5, z: T.z - 3.1 };
  box(steelDark, 0.36, 0.34, 0.36, leverAt.x, 0, leverAt.z, true);
  const leverPivot = new THREE.Group();
  leverPivot.position.set(leverAt.x, 0.34, leverAt.z);
  add(leverPivot);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, 0.06), steelLight);
  arm.position.y = 0.42;
  leverPivot.add(arm);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), lam(0xb82020));
  knob.position.y = 0.86;
  leverPivot.add(knob);
  leverPivot.rotation.x = 0.55;
  sign(['PORT'], { bg: '#d8b43a', stripe: true }, 0.32, 0.16, leverAt.x, 0.2, leverAt.z - 0.185, Math.PI);
  // the rod: along the floor to the plinth, then up the outside of the glass to the shutter
  const rodFoot = new THREE.Vector3(T.x + Math.sin(portA + 0.3) * (T.r + 0.12), 0.08, T.z + Math.cos(portA + 0.3) * (T.r + 0.12));
  pipe(
    [
      [leverAt.x, 0.08, leverAt.z + 0.2],
      [(leverAt.x + rodFoot.x) / 2, 0.08, (leverAt.z + rodFoot.z) / 2],
      [rodFoot.x, 0.08, rodFoot.z],
    ],
    0.02,
    steelLight,
  );
  {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, PORT_Y1 + RIM_Y - 0.08, 6), steelLight);
    rod.position.set(rodFoot.x, (PORT_Y1 + RIM_Y + 0.08) / 2, rodFoot.z);
    add(rod);
  }

  // ============================================== THE EXPERIMENT MACHINE
  const mX = S.minX + 1.35;
  const mZ = -6.8;
  const front = mX + 0.61;
  box(steelDark, 1.2, 1.9, 2.2, mX, 0, mZ, true);
  box(steel, 0.04, 1.6, 2.0, front - 0.01, 0.15, mZ);
  // side vents
  for (let i = 0; i < 6; i++) box(lam(0x0c0e10), 0.9, 0.04, 0.02, mX, 0.4 + i * 0.12, mZ + 1.11);
  // the hopper on top, and the ring of light round its mouth
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.09, 0.4, 16, 1, true), new THREE.MeshLambertMaterial({ color: 0x6c7983, side: THREE.DoubleSide }));
  hopper.position.set(mX + 0.25, 2.1, mZ + 0.55);
  add(hopper);
  cyl(steelLight, 0.1, 0.1, 0.2, mX + 0.25, 1.9, mZ + 0.55, 10);
  const hopperRingMat = lit(0x3fe39b);
  const hopperRing = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 24), hopperRingMat);
  hopperRing.rotation.x = Math.PI / 2;
  hopperRing.position.set(mX + 0.25, 2.3, mZ + 0.55);
  add(hopperRing);
  sign(['EXPERIMENT CONTROL', 'INSERT SAMPLE ABOVE'], { stripe: true, bg: '#d9d3c2' }, 1.3, 0.4, front + 0.02, 1.95 + 0.25, mZ - 0.3, Math.PI / 2);
  // the screen
  const seqScreen = { title: 'READY', sub: ['INSERT A SAMPLE', 'IN THE HOPPER'], color: '#3fe39b', progress: 0 };
  const machineScreen = screen(256, 144, (ctx, w, h) => {
    ctx.fillStyle = '#061009';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = seqScreen.color;
    ctx.font = 'bold 26px monospace';
    ctx.fillText(seqScreen.title, 10, 34, w - 20);
    ctx.font = 'bold 16px monospace';
    seqScreen.sub.forEach((s, i) => ctx.fillText(s, 10, 64 + i * 22, w - 20));
    ctx.strokeStyle = seqScreen.color;
    ctx.strokeRect(10, h - 24, w - 20, 12);
    ctx.fillRect(10, h - 24, (w - 20) * seqScreen.progress, 12);
    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  });
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.48), new THREE.MeshBasicMaterial({ map: machineScreen.texture }));
    m.position.set(front + 0.02, 1.48, mZ - 0.45);
    m.rotation.y = Math.PI / 2;
    add(m);
  }
  // a lamp for each sequence
  const lampMats = SEQUENCES.map((s) => lit(new THREE.Color(s.color).multiplyScalar(0.25).getHex()));
  SEQUENCES.forEach((_s, i) => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), lampMats[i]);
    l.position.set(front + 0.03, 1.1, mZ - 0.8 + i * 0.18);
    add(l);
  });
  // gauges with needles
  const needles: THREE.Mesh[] = [];
  for (const dz of [0.25, 0.62]) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.13, 18), lit(0xd8d4c0));
    face.position.set(front + 0.025, 1.45, mZ + dz);
    face.rotation.y = Math.PI / 2;
    add(face);
    const n = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.11, 0.012), lit(0xb01818));
    n.geometry.translate(0, 0.05, 0);
    n.position.set(front + 0.035, 1.45, mZ + dz);
    add(n);
    needles.push(n);
  }
  // the reservoir on the front, showing what went in
  const resGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.75, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xd8f6ff, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
  );
  resGlass.position.set(front + 0.25, 0.25 + 0.375, mZ + 0.45);
  add(resGlass);
  cyl(steelLight, 0.23, 0.23, 0.06, front + 0.25, 0.19, mZ + 0.45, 16);
  cyl(steelLight, 0.23, 0.23, 0.06, front + 0.25, 1.0, mZ + 0.45, 16);
  box(steel, 0.3, 0.06, 0.06, front + 0.1, 0.6, mZ + 0.45);
  const resFillMat = new THREE.MeshLambertMaterial({ color: 0x7cff3a, transparent: true, opacity: 0.75, emissive: 0x7cff3a, emissiveIntensity: 0.4 });
  const resFill = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1, 16), resFillMat);
  resFill.visible = false;
  add(resFill);
  // pistons on top at the back, which pump while it works
  const rods: THREE.Mesh[] = [];
  for (const dz of [-0.6, -0.1]) {
    cyl(steel, 0.12, 0.12, 0.35, mX - 0.3, 1.9, mZ + dz, 12);
    const rod = cyl(steelLight, 0.05, 0.05, 0.5, mX - 0.3, 2.1, mZ + dz, 8);
    rods.push(rod);
  }
  // the feed: up from the machine, over, and down into the tube's cap, with valves on it
  pipe(
    [
      [mX - 0.1, 1.9, mZ - 0.8],
      [mX - 0.1, 3.6, mZ - 1.0],
      [mX + 1.6, 5.4, (mZ + T.z) / 2 - 0.3],
      [T.x - 0.9, capTop + 0.3, T.z + 0.2],
      [T.x - 0.45, capTop + 0.25, T.z],
    ],
    0.09,
    copper,
  );
  const feedValves = [valve(mX - 0.1, 3.0, mZ - 0.95, Math.PI / 2), valve(mX + 1.6, 5.4, (mZ + T.z) / 2 - 0.3, Math.PI / 4)];
  // and a hose along the floor into the plinth
  const hose = pipe(
    [
      [front + 0.1, 0.1, mZ - 0.7],
      [front + 1.0, 0.08, mZ - 1.4],
      [T.x - T.r - 0.5, 0.1, T.z + 0.6],
      [T.x - T.r - 0.2, 0.35, T.z + 0.4],
    ],
    0.08,
    rubber,
  );
  const slugMat = new THREE.MeshBasicMaterial({ color: 0x7cff3a });
  const slug = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), slugMat);
  slug.visible = false;
  add(slug);
  // a tray on the machine's side, where the violet flask is kept (see secretRoom)
  box(steelLight, 0.5, 0.04, 0.4, mX + 0.3, 1.0, mZ + 1.35);
  box(steel, 0.05, 1.0, 0.05, mX + 0.3, 0, mZ + 1.35);
  // the light off the machine and off whatever is in it
  const machineLight = new THREE.PointLight(0x3fe39b, 1.2, 4, 1.6);
  machineLight.position.set(front + 0.6, 1.6, mZ);
  add(machineLight);
  lights.push(machineLight);

  // ============================================================ THE STATE
  let level = 1;
  let water: WaterState = 'full';
  let hatchOpen = false;
  let shutterK = 0;
  let leverK = 0;
  let seq: Sequence | null = null;
  let seqT = 0;
  let clock = 0;
  let lastPulse = -1;
  let doneFlag = false;
  const fired = new Set<string>();
  const once = (key: string, at: number, name: SfxName, gain = 1): void => {
    if (seq && seqT >= at && !fired.has(key)) {
      fired.add(key);
      audio.sfx(name, gain);
    }
  };
  /** Where the liquid's top is. */
  const surfaceY = (): number => T.base + 0.1 + (T.h - 0.2) * level;

  const setScreen = (title: string, sub: string[], color: string, progress = 0): void => {
    seqScreen.title = title;
    seqScreen.sub = sub;
    seqScreen.color = color;
    seqScreen.progress = progress;
    machineScreen.update();
  };

  // ---------------------------------------------- the specimen, every frame
  const specimen = T.specimen;
  const tmp = new THREE.Vector3();
  const localViewer = new THREE.Vector3();
  const waterColor = new THREE.Color(WATER);
  const target = new THREE.Color();
  let floatYaw = 0;
  /**
   * How far he has been stood back from where his pose put him, so that none
   * of his head is past the inside of the glass -- or through the port.
   */
  const keepIn = new THREE.Vector2();
  /** The inside of the glass, less the bars' own thickness: his head stops here. */
  const HEAD_LIMIT = T.r - 0.045;
  const sph = new THREE.Sphere();
  const wscale = new THREE.Vector3();
  /**
   * How far the furthest part of his head (eyes, lids, jaw, teeth, all of it)
   * is past HEAD_LIMIT from the tube's axis, and which way.  Bounding spheres,
   * so it errs on the side of inside.
   */
  const headOver = (): { over: number; ux: number; uz: number } => {
    specimen.root.updateMatrixWorld(true);
    let over = -Infinity;
    let ux = 0;
    let uz = 0;
    specimen.headObject.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible) return;
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      sph.copy(m.geometry.boundingSphere!).applyMatrix4(m.matrixWorld);
      root.worldToLocal(sph.center);
      const dx = sph.center.x - T.x;
      const dz = sph.center.z - T.z;
      const d = Math.hypot(dx, dz);
      const r = d + sph.radius / Math.max(1e-6, root.getWorldScale(wscale).x) - HEAD_LIMIT;
      if (r > over && d > 1e-4) {
        over = r;
        ux = dx / d;
        uz = dz / d;
      }
    });
    return { over, ux, uz };
  };

  const corner = new THREE.Vector3();
  const rootQ = new THREE.Quaternion();
  /** How far each arm (shoulder to fingertips) is past `limit` from the tube's axis. */
  const armsOver = (limit: number): [number, number] => {
    specimen.root.updateMatrixWorld(true);
    const res: [number, number] = [-Infinity, -Infinity];
    specimen.armObjects.forEach((arm, h) =>
      arm.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.visible) return;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        const bb = m.geometry.boundingBox!;
        for (let c = 0; c < 8; c++) {
          corner.set(c & 1 ? bb.max.x : bb.min.x, c & 2 ? bb.max.y : bb.min.y, c & 4 ? bb.max.z : bb.min.z);
          root.worldToLocal(corner.applyMatrix4(m.matrixWorld));
          res[h] = Math.max(res[h], Math.hypot(corner.x - T.x, corner.z - T.z) - limit);
        }
      }),
    );
    return res;
  };
  /** The inside of the glass, for his fingertips. */
  const ARM_LIMIT = T.r - 0.035;
  /**
   * How far each hand's goal is drawn in from where the pose put it, so that
   * no part of that arm -- his long fingers above all -- is past ARM_LIMIT.
   */
  const armIn: [number, number] = [0, 0];
  const pullIn = (goal: HandGoal | null, by: number): HandGoal | null => {
    if (!goal || by <= 0) return goal;
    const p = root.worldToLocal(goal.at.clone());
    const dx = p.x - T.x;
    const dz = p.z - T.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-4) return goal;
    const k = Math.max(0, d - by) / d;
    p.set(T.x + dx * k, p.y, T.z + dz * k);
    return { ...goal, at: root.localToWorld(p) };
  };

  const tick = (dt: number, viewer: THREE.Vector3 | null, heat: number): void => {
    clock += dt;
    lineAt.t = clock;

    // ---- the room ticking over: failing tubes, the beacon, the dust, the screens
    let dim = 1;
    let flash = 0;
    if (seq?.id === 'dream') dim = 1 - 0.6 * smooth(0, 1.5, seqT) * (1 - smooth(seq.dur - 1.5, seq.dur, seqT));
    if (seq?.id === 'void') dim = seqT < 8.2 ? 1 - 0.88 * smooth(0.2, 1.6, seqT) : 1;
    for (const f of fixtures) {
      let k = dim;
      if (f.fails) {
        const n = Math.sin(clock * 13 + f.seed) + Math.sin(clock * 29.7 + f.seed * 2);
        if (n > 1.55) k *= 0.08;
        else if (Math.sin(clock * 0.7 + f.seed) > 0.93) k *= 0.35 + 0.3 * Math.sin(clock * 60);
      }
      f.light.intensity = f.base * k + flash;
      f.tube.color.setScalar(0.15 + 0.85 * Math.min(1, k));
    }
    p.ambient.intensity = 0.55 * (0.25 + 0.75 * dim);
    beacon.rotation.y += dt * 4;
    beaconLight.intensity = 1.2 + 2.2 * Math.max(0, Math.sin(clock * 4));
    for (let i = 0; i < leds.length; i++) leds[i].color.setHex(Math.sin(clock * (2 + i) + i) > 0 ? 0x3fe39b : 0x0e2a1c);
    const dp = dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < dustN; i++) {
      let y = dp.getY(i) + dt * 0.04;
      if (y > S.h - 0.8) y = 0.3;
      dp.setY(i, y);
      dp.setX(i, dp.getX(i) + Math.sin(clock * 0.3 + i) * dt * 0.03);
    }
    dp.needsUpdate = true;
    if (Math.floor(clock * 8) !== Math.floor((clock - dt) * 8)) for (const s of deskScreens) s.update();

    // ---- the water
    if (water === 'draining') {
      level = Math.max(0, level - dt / 6);
      if (level <= 0) {
        water = 'empty';
        audio.sfx('drip', 0.5);
      }
    } else if (water === 'filling') {
      level = Math.min(1, level + dt / 5);
      if (level >= 1) {
        water = 'full';
        audio.sfx('splash', 0.35);
      }
    }
    const sy = surfaceY();
    T.liquid.visible = level > 0.004;
    T.liquid.scale.y = Math.max(0.004, level);
    T.liquid.position.y = T.base + 0.1 + ((T.h - 0.2) * level) / 2;
    surface.visible = level > 0.004 && level < 0.997;
    surface.position.y = sy;
    surface.scale.setScalar(1 + Math.sin(clock * 6) * 0.01);
    jet.visible = water === 'filling';
    if (jet.visible) {
      const top = T.base + T.h;
      jet.scale.y = Math.max(0.01, top - sy);
      jet.position.set(T.x + Math.sin(clock * 9) * 0.02, (top + sy) / 2, T.z);
    }
    gauge.scale.y = Math.max(0.02, level);
    gauge.position.y = 1.045 + (0.5 * (level - 1)) / 2;
    bigButtonMat.color.setHex(water === 'full' ? 0xc03030 : water === 'empty' ? 0x2fbf5a : Math.sin(clock * 10) > 0 ? 0xd8a820 : 0x40300a);

    // ---- the port and the lever
    shutterK += ((hatchOpen ? 1 : 0) - shutterK) * Math.min(1, dt * 3);
    shutter.position.y = shutterDown + shutterK * (PORT_Y1 - PORT_Y0 + 0.12);
    leverK += ((hatchOpen ? 1 : 0) - leverK) * Math.min(1, dt * 6);
    leverPivot.rotation.x = 0.55 - leverK * 1.4;

    // ---- the sequence
    let liquid = WATER;
    let opacity = WATER_OPACITY;
    let tubeI = 12 + Math.sin(clock * 0.9) * 2 + heat * 6 * Math.abs(Math.sin(clock * 11));
    let tubeC = 0x7fe3ff;
    let bubbleSpeed = 1 + heat * 3;
    let frostK = 0;
    let steamK = 0;
    let glare = 0;
    for (const b of bolts) b.visible = false;
    if (seq) {
      seqT += dt;
      const t = seqT;
      const s = seq;
      const inK = smooth(0.2, 1.6, t);
      const outK = smooth(s.dur - 1.8, s.dur, t);
      const k = inK * (1 - outK);
      target.setHex(s.color);
      liquid = s.color;
      opacity = WATER_OPACITY + 0.2 * k;
      tubeC = s.color;
      // the machine: pumping, valves turning, the reservoir emptying into the feed
      for (let i = 0; i < rods.length; i++) rods[i].position.y = 2.1 + 0.25 + Math.sin(clock * 9 + i * Math.PI) * 0.12 * (1 - outK);
      for (const v of [...feedValves, ...hoseValves]) v.rotation.z += dt * 4 * (1 - outK);
      needles.forEach((n, i) => (n.rotation.x = -1.2 + 2.2 * k + Math.sin(clock * (7 + i * 5)) * 0.15 * k));
      const res = 1 - smooth(0.3, 2.2, t);
      resFill.visible = res > 0.01;
      resFill.scale.y = Math.max(0.01, res * 0.7);
      resFill.position.set(front + 0.25, 0.25 + (res * 0.7) / 2, mZ + 0.45);
      const travel = smooth(0.4, 2.0, t);
      slug.visible = travel > 0 && travel < 1;
      if (slug.visible) slug.position.copy(hose.getPointAt(travel));
      SEQUENCES.forEach((q, i) => lampMats[i].color.setHex(q === s ? (Math.sin(clock * 8) > 0 ? q.color : new THREE.Color(q.color).multiplyScalar(0.5).getHex()) : 0x101010));
      machineLight.color.setHex(s.color);
      machineLight.intensity = 1.2 + 2.5 * k;
      if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) setScreen(`SEQ: ${s.name}`, [...s.lines, t < 2 ? 'INJECTING...' : 'RUNNING'], '#' + target.getHexString(), Math.min(1, t / s.dur));

      if (s.id === 'acid') {
        bubbleSpeed = 1 + 5 * k;
        steamK = k;
        tubeI = 14 + 6 * k * Math.abs(Math.sin(clock * 7));
        once('a0', 0.3, 'poison_hiss', 0.7);
        once('a1', 1.5, 'froggy_screech', 0.65);
        once('a2', 3.0, 'poison_hiss', 0.55);
        once('a3', 4.6, 'distant_scream', 0.55);
        once('a4', 6.0, 'poison_hiss', 0.45);
      } else if (s.id === 'dream') {
        tubeI = 6 + 4 * (1 - k);
        once('d0', 0.2, 'eerie_swell', 0.7);
        once('d1', 3.4, 'distant_cry', 0.5);
        once('d2', 6.0, 'distant_cry', 0.45);
      } else if (s.id === 'cryo') {
        bubbleSpeed = 1 - 0.95 * smooth(0.5, 2.5, t) * (1 - outK);
        frostK = smooth(0.8, 5.5, t) * (1 - outK);
        tubeI = 12 + 4 * k;
        once('c0', 0.3, 'water_rise', 0.4);
        once('c1', 1.8, 'crumble', 0.45);
        once('c2', 4.2, 'crumble', 0.4);
        once('c3', 5.6, 'distant_cry', 0.45);
      } else if (s.id === 'shock') {
        once('s0', 0.2, 'speaker_fault', 0.5);
        const pulses = [1.5, 2.3, 3.0, 3.6, 4.5, 5.1, 5.5, 6.4];
        const idx = pulses.findIndex((q) => t >= q && t < q + 0.16);
        if (idx >= 0) {
          if (idx !== lastPulse) {
            lastPulse = idx;
            zap();
            audio.sfx('bulb_flicker', 0.8);
            audio.sfx('speaker_fault', 0.3);
            if (idx === 1 || idx === 5) audio.sfx('froggy_screech', 0.55);
          }
          for (const b of bolts) b.visible = Math.random() > 0.25;
          flash = 10;
          tubeI = 34;
          tubeC = 0xfff4d0;
        }
      } else if (s.id === 'void') {
        opacity = WATER_OPACITY + 0.6 * smooth(0.2, 1.6, t) * (t < 8.2 ? 1 : 0);
        liquid = t < 8.2 ? 0x07020d : WATER;
        tubeI = t < 8.2 ? 12 * (1 - smooth(0.2, 1.6, t)) : 12;
        glare = t > 1.5 && t < 8.2 ? 1 : 0;
        once('v0', 0.5, 'eerie_swell', 0.75);
        for (const [i, at] of [3.0, 3.5, 5.2, 5.7, 6.2].entries()) once(`vk${i}`, at + 0.12, 'spot_slam', 0.3);
        once('v9', 8.2, 'bulb_flicker', 0.9);
      }
      if (t >= s.dur) {
        seq = null;
        doneFlag = true;
        machineLight.color.setHex(0x3fe39b);
        machineLight.intensity = 1.2;
        resFill.visible = false;
        slug.visible = false;
        SEQUENCES.forEach((q, i) => lampMats[i].color.setHex(new THREE.Color(q.color).multiplyScalar(0.25).getHex()));
        setScreen('READY', ['INSERT A SAMPLE', 'IN THE HOPPER'], '#3fe39b');
      } else {
        // the colour comes in from the feed and goes out again at the end
        waterColor.setHex(WATER).lerp(target.setHex(liquid), s.id === 'void' ? (t < 8.2 ? smooth(0.2, 1.6, t) : 0) : k);
      }
    }
    if (!seq) waterColor.setHex(WATER);
    T.liquidMat.color.copy(waterColor);
    T.liquidMat.opacity = opacity;
    surfaceMat.color.copy(waterColor).lerp(new THREE.Color(0xffffff), 0.3);
    T.light.color.setHex(tubeC);
    T.light.intensity = tubeI * (level * 0.8 + 0.2);
    // the frost, climbing the inside of the glass
    frostBand.visible = frostK > 0.01;
    if (frostBand.visible) {
      const fh = 0.2 + frostK * (T.h - 0.6);
      frostBand.scale.y = fh;
      frostBand.position.set(T.x, T.base + 0.1 + fh / 2, T.z);
      frostMat.opacity = 0.35 + 0.3 * frostK;
    }
    // steam off the top
    steam.forEach((s, i) => {
      s.visible = steamK > 0.02;
      if (!s.visible) return;
      const ph = (clock * 0.4 + i / steam.length) % 1;
      s.position.set(T.x + Math.sin(i * 2.3) * (T.r - 0.4), T.base + T.h + ph * 1.2, T.z + Math.cos(i * 2.3) * (T.r - 0.4));
      s.scale.setScalar(0.4 + ph * 0.9);
      (s.material as THREE.SpriteMaterial).opacity = steamK * 0.5 * (1 - ph);
    });
    // bubbles: rising, faster or slower with what is in the water, only under
    // its surface; draining, they spiral in and down
    for (const b of T.bubbles) {
      if (water === 'draining') {
        b.m.position.y -= dt * 0.8;
        b.r = Math.max(0.05, b.r - dt * 0.1);
        b.a += dt * 2.5;
      } else {
        b.m.position.y += b.speed * bubbleSpeed * dt;
        b.a += dt * 0.3;
      }
      if (b.m.position.y > sy - 0.1) b.m.position.y = T.base + 0.15;
      if (b.m.position.y < T.base + 0.1) b.m.position.y = Math.max(T.base + 0.15, sy - 0.2);
      if (water !== 'draining' && b.r < 0.1) b.r = Math.random() * (T.r - 0.25);
      b.m.position.x = T.x + Math.cos(b.a) * b.r;
      b.m.position.z = T.z + Math.sin(b.a) * b.r;
      b.m.visible = level > 0.05;
    }
    // idle: the hopper ring breathes, the pistons rest
    if (!seq) {
      hopperRingMat.color.setHex(water === 'full' ? 0x3fe39b : 0x3a1010);
      for (const r of rods) r.position.y += (2.1 + 0.25 - r.position.y) * Math.min(1, dt * 3);
      needles.forEach((n, i) => (n.rotation.x = -1.2 + Math.sin(clock * 0.5 + i) * 0.05));
    }

    // ---- HIM
    if (viewer) root.worldToLocal(localViewer.copy(viewer));
    const toViewer = viewer ? Math.atan2(localViewer.x - T.x, localViewer.z - T.z) : 0;
    const pose: FroggyPose = { speed: 0, maw: 0.08, mawRate: 6, climb: 0, scan: 0, reachAt: null, viewer: null, peer: 1 };
    let hands: [HandGoal | null, HandGoal | null] | undefined;
    let faceTo: THREE.Vector3 | null = null;
    let faceK = 0;
    let x = T.x;
    let z = T.z;
    // floating while there is water to float in; standing on the plinth once there is not
    const bob = Math.sin(clock * 0.7) * 0.12;
    let y = Math.min(0.9 + bob, Math.max(T.base + 0.02, sy - 1.7));
    const standing = y <= T.base + 0.05;
    floatYaw = Math.sin(clock * 0.23) * 0.35;
    let yaw = floatYaw;
    let tw: [number, number, number] | null = null;
    /** A point on the inside of the glass, `da` round from the viewer's side, `hy` up. */
    const glassAt = (da: number, hy: number, inset = 0.1): THREE.Vector3 =>
      root.localToWorld(tmp.set(T.x + Math.sin(toViewer + da) * (T.r - inset), hy, T.z + Math.cos(toViewer + da) * (T.r - inset)).clone());

    if (seq && level >= 0.99) {
      const t = seqT;
      const s = seq;
      const k = smooth(1.0, 2.0, t) * (1 - smooth(s.dur - 1.8, s.dur, t));
      if (s.id === 'acid') {
        // He thrashes: away from it, round the tube, at the glass.  Clawing it,
        // one hand scraping down while the other goes back up.
        x += Math.sin(clock * 23) * 0.16 * k;
        z += Math.sin(clock * 19) * 0.16 * k;
        yaw = toViewer + Math.sin(clock * 9) * 0.9 * k;
        Object.assign(pose, { maw: 0.3 + 0.7 * k, stretch: 0.45 * k, lunge: k, grab: 0.5 + 0.5 * Math.sin(clock * 12) * k, constrict: 1 });
        const ph = (clock * 1.2) % 1;
        const ph2 = (clock * 1.2 + 0.5) % 1;
        if (k > 0.2)
          hands = [
            { at: glassAt(-0.45, y + 2.3 - ph * 1.0), weight: k, grip: 0.9 },
            { at: glassAt(0.45, y + 2.3 - ph2 * 1.0), weight: k, grip: 0.9 },
          ];
        if (Math.sin(clock * 5.3) > 0.85) tw = [(Math.random() - 0.5) * 0.4 * k, (Math.random() - 0.5) * 0.6 * k, (Math.random() - 0.5) * 0.4 * k];
      } else if (s.id === 'dream') {
        // Limp, sinking, turning slowly -- and then the jerks, each one ending
        // with his face snapped round to you.
        y -= 0.3 * k;
        yaw = floatYaw + t * 0.25;
        Object.assign(pose, { maw: 0.2, tilt: 0.45 * k, hunch: 0.3 * k, dilate: 1 });
        for (const at of [2.2, 3.4, 4.1, 5.6, 6.0, 7.3]) {
          const u = t - at;
          if (u >= 0 && u < 0.4) {
            Object.assign(pose, { grab: 1, lunge: 1, maw: 1, stretch: 0.7 });
            x += Math.sin(at * 7) * 0.2;
            tw = [(Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.8];
            if (u < dt * 1.5) audio.sfx('spot_slam', 0.18);
          }
          if (u >= 0.3 && u < 1.4) yaw = toViewer;
        }
      } else if (s.id === 'cryo') {
        // Slowing, then stopping, then shaking: arms in to himself, jaw going.
        y = 0.9 + bob * (1 - k);
        x += (Math.random() - 0.5) * 0.035 * k;
        z += (Math.random() - 0.5) * 0.035 * k;
        yaw = floatYaw * (1 - k) + toViewer * k * 0.6;
        Object.assign(pose, { maw: 0.1 + 0.12 * Math.abs(Math.sin(clock * 38)) * k, mawRate: 30, hunch: 0.8 * k, constrict: 1 });
        const fwd = yaw;
        const chest = (side: number): THREE.Vector3 =>
          root.localToWorld(
            new THREE.Vector3(x + Math.sin(fwd) * 0.18 + Math.cos(fwd) * side * 0.14, y + 1.3, z + Math.cos(fwd) * 0.18 - Math.sin(fwd) * side * 0.14),
          );
        if (k > 0.2)
          hands = [
            { at: chest(1), weight: k, grip: 1 },
            { at: chest(-1), weight: k, grip: 1 },
          ];
        tw = [(Math.random() - 0.5) * 0.06 * k, (Math.random() - 0.5) * 0.06 * k, (Math.random() - 0.5) * 0.06 * k];
      } else if (s.id === 'shock') {
        // Every pulse throws him rigid, arms out, jaw stretched; between them he trembles.
        const pulse = [1.5, 2.3, 3.0, 3.6, 4.5, 5.1, 5.5, 6.4].some((q) => t >= q && t < q + 0.22);
        Object.assign(pose, { maw: 0.4 * k, constrict: 1 });
        x += (Math.random() - 0.5) * 0.03 * k;
        if (pulse) {
          Object.assign(pose, { grab: 1, lunge: 1, maw: 1, stretch: 0.85 });
          y += 0.12;
          tw = [(Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5];
        }
        yaw = floatYaw + (pulse ? (Math.random() - 0.5) * 0.4 : 0);
      } else if (s.id === 'void') {
        // In the dark, only his eyes -- and they are coming to the glass on
        // your side.  Face and hands on it, staring.  Knocking.  Then the
        // lights come back and he is floating in the middle as if he never moved.
        if (t > 1.2 && t < 8.2) {
          const go = smooth(1.2, 3.0, t);
          x = T.x + Math.sin(toViewer) * (T.r - 0.62) * go;
          z = T.z + Math.cos(toViewer) * (T.r - 0.62) * go;
          y = 0.9 + 0.3 * go;
          yaw = toViewer;
          Object.assign(pose, { still: 0.9, constrict: 1, maw: 0.25, hunch: 0.3 });
          faceTo = glassAt(0, y + 1.85, 0.05);
          faceK = go;
          let knock = 0;
          for (const at of [3.0, 3.5, 5.2, 5.7, 6.2]) if (t >= at && t < at + 0.14) knock = Math.sin(((t - at) / 0.14) * Math.PI);
          hands = [
            { at: glassAt(-0.36, y + 1.95, 0.1 + knock * 0.25), weight: go, grip: 0.3 },
            { at: glassAt(0.36, y + 1.9), weight: go, grip: 0.3 },
          ];
        }
      }
    } else if (standing || water === 'empty') {
      // ---- OUT OF THE WATER.  He stands on the plinth and comes round to
      // you, hunched, staring.  With the port open, he goes to it.
      y = T.base + 0.02;
      if (shutterK > 0.3) {
        const go = smooth(0.3, 1, shutterK);
        x = T.x + Math.sin(portA) * (T.r - 0.5) * go;
        z = T.z + Math.cos(portA) * (T.r - 0.5) * go;
        yaw = portA;
        // the stare: lids pulled back, nothing moving but the jaw
        Object.assign(pose, { hunch: 0.3 * go, constrict: 1, maw: 0.2 + 0.15 * Math.abs(Math.sin(clock * 1.7)), still: go });
        faceTo = portWorld(0.35, (PORT_Y0 + PORT_Y1) / 2);
        faceK = go;
        // Both hands flat on the glass either side of the window, framing his
        // face in it -- all of him on the inside.  Close in and at the height
        // of the port, so each arm is bent at the elbow and the long fingers
        // lie on the glass.  (One hand was sent high and far round the tube,
        // past where an arm reaches, and that arm locked out into a straight
        // rod with the hand hanging in the air; the other was a fist jammed
        // under the bottom of the frame.)
        //
        // And the elbows DOWN, tucked in under the hands.  Left to bow out to
        // the side the way they do in the open, his arms stood straight out
        // from his shoulders like rods, and from anywhere but square on they
        // looked to be reaching out of the tube.  Each palm is beside the
        // frame, close in, the elbow under it and in toward the middle of the
        // tube -- something gripping the edge of the window to look through it.
        const beside = PORT_HALF + RIM + 0.07;
        const mid = (PORT_Y0 + PORT_Y1) / 2;
        const elbowDown = (spread: number): THREE.Vector3 => {
          const a = portA + spread;
          // down, in toward the axis, and a little out to its own side
          return tmp
            .set(-Math.sin(portA) * 0.45 + Math.sin(a) * 0.3 - Math.sin(portA) * 0.3, -1, -Math.cos(portA) * 0.45 + Math.cos(a) * 0.3 - Math.cos(portA) * 0.3)
            .applyQuaternion(root.getWorldQuaternion(rootQ))
            .normalize()
            .clone();
        };
        hands = [
          { at: portWorld(0.1, mid + 0.02, -beside), weight: go, grip: 0.55, pole: elbowDown(-1.2) },
          { at: portWorld(0.1, mid - 0.04, beside), weight: go, grip: 0.55, pole: elbowDown(1.2) },
        ];
      } else {
        yaw = toViewer;
        Object.assign(pose, { hunch: 0.55, constrict: 1, maw: 0.25, tilt: 0.12 * Math.sin(clock * 0.4) });
        const near = viewer ? Math.hypot(localViewer.x - T.x, localViewer.z - T.z) < 4.5 : false;
        if (near)
          hands = [
            { at: glassAt(-0.4, y + 2.1), weight: 1, grip: 0.25 },
            { at: glassAt(0.4, y + 2.05 + Math.max(0, Math.sin(clock * 3)) * 0.08), weight: 1, grip: 0.25 },
          ];
        if (Math.sin(clock * 0.9) > 0.97) tw = [(Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.4, 0];
      }
    } else {
      // floating, and the heater, as before
      const agony = heat;
      y += agony * Math.sin(clock * 17) * 0.08;
      x += agony * Math.sin(clock * 13) * 0.12;
      yaw = floatYaw + agony * Math.sin(clock * 9) * 0.5;
      Object.assign(pose, { maw: 0.08 + agony * 0.92, lunge: agony, grab: agony });
      // paddling as the water goes down past him
      if (water === 'draining') Object.assign(pose, { lunge: 0.4, maw: 0.5 });
    }
    specimen.setPose(x - keepIn.x, y, z - keepIn.y, yaw);
    specimen.lookAt(viewer);
    if (hands) hands = [pullIn(hands[0], armIn[0]), pullIn(hands[1], armIn[1])];
    specimen.update(dt, { ...pose, hands, faceTo, faceK });
    specimen.setGlare(glare);
    if (tw) specimen.twitchHead(tw[0], tw[1], tw[2]);
    // NOTHING OF HIS HEAD PAST THE GLASS.  Stooping to the port, or with his
    // face to the glass in the dark, the lean carried his head on through
    // it: his eyes came out past the bars, in front of them.  Posed, he is
    // measured, and if any of his head is past the inside of the glass he is
    // stood back by that much -- now, before the frame is drawn, and from
    // then on, so his hands find the bars again from where he stands.  He
    // only comes forward again when there is room, so he is never pushed
    // and pulled at the limit.
    const h = headOver();
    if (h.over > 0) {
      keepIn.x += h.ux * h.over;
      keepIn.y += h.uz * h.over;
      specimen.setPose(x - keepIn.x, y, z - keepIn.y, yaw);
      specimen.root.updateMatrixWorld(true);
    } else if (h.over < -0.03) {
      keepIn.multiplyScalar(Math.max(0, 1 - dt * 1.5));
    }
    // NOTHING OF HIS ARMS PAST THE GLASS EITHER.  A palm put on the glass
    // left his fingers -- longer than a hand has any right to be -- running on
    // in the line of the forearm, out through it and through the port's
    // frame, so a hand seemed to reach out of the tube.  Each arm is measured
    // to the fingertips; one past the glass has its hand drawn in by that much
    // from the next frame on, so the tips come to rest on the inside of it.
    // It lets go again only once there is room, so it never hunts.
    const ao = armsOver(ARM_LIMIT);
    for (let a = 0; a < 2; a++) {
      if (ao[a] > 0) armIn[a] = Math.min(0.6, armIn[a] + ao[a] + 0.01);
      else if (ao[a] < -0.04) armIn[a] = Math.max(0, armIn[a] - dt * 0.25);
    }
  };

  setScreen('READY', ['INSERT A SAMPLE', 'IN THE HOPPER'], '#3fe39b');

  return {
    machine: { x: front + 0.7, z: mZ + 0.3 },
    panel: { x: consoleAt.x, z: consoleAt.z - 0.75 },
    lever: { x: leverAt.x, z: leverAt.z - 0.6 },
    status: () => ({ water, level, hatch: hatchOpen, running: seq?.name ?? null }),
    refuses: () => {
      if (seq) return 'A SEQUENCE IS RUNNING';
      if (water !== 'full') return 'THE TUBE HAS TO BE FULL';
      return null;
    },
    run: (flask: string) => {
      const s = SEQUENCES.find((q) => q.flask === flask);
      if (!s || seq || water !== 'full') return null;
      seq = s;
      seqT = 0;
      lastPulse = -1;
      doneFlag = false;
      fired.clear();
      resFillMat.color.setHex(s.color);
      resFillMat.emissive.setHex(s.color);
      slugMat.color.setHex(s.color);
      audio.sfx('ticket_machine', 0.5);
      audio.sfx('splash', 0.25);
      setScreen(`SEQ: ${s.name}`, [...s.lines, 'INJECTING...'], '#' + new THREE.Color(s.color).getHexString(), 0);
      return s.name;
    },
    pressWater: () => {
      if (seq) return 'running';
      if (water === 'draining' || water === 'filling') return 'moving';
      if (water === 'full') {
        water = 'draining';
        audio.sfx('water_rise', 0.5);
        audio.sfx('drip', 0.4);
        return 'drain';
      }
      if (hatchOpen) return 'hatch-open';
      water = 'filling';
      audio.sfx('water_rise', 0.6);
      audio.sfx('splash', 0.3);
      return 'fill';
    },
    pullLever: () => {
      if (water !== 'empty') return water === 'full' ? 'full' : 'moving';
      hatchOpen = !hatchOpen;
      audio.sfx('fence_thunk', 0.6);
      audio.sfx(hatchOpen ? 'door_creak' : 'lock_click', 0.5);
      return hatchOpen ? 'open' : 'closed';
    },
    tick,
    finished: () => {
      if (!doneFlag) return false;
      doneFlag = false;
      return true;
    },
  };
}
