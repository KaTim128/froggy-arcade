/**
 * PAD BATTLES (log #98).  10 tokens in, 20 for a win, nothing for a loss --
 * the shell takes the price once and pays once.
 *
 * Four frogs on a 7 x 5 grid of lily pads floating APART on deep water
 * (user, 28 Oct: "pads spaced apart so frogs must jump"): you (MOSS) and
 * three more, each played its own way -- BRUTE goes for whoever is nearest,
 * SHELL holds the middle and hits back, SLY waits for someone to stand near
 * the edge.  You walk about on your own pad; to get to another you JUMP,
 * and where you come down is checked against the pads as they are when you
 * land -- a pad that sank under you in the air, or open water, is a miss,
 * and a miss is a splash and out.  The pads give way: a pad due to go
 * flashes, shakes and cracks for a fair while before it crumbles and sinks,
 * waves of them come faster as the match goes on, and the grid is never
 * broken into pieces you cannot jump between.  Last frog standing wins.
 *
 *   move    walk your pad            jump    to the next pad the way you face
 *   tongue  a whip in front of you: knocks back what it catches (it reaches
 *           across a gap)
 *   bump    a short charge across your pad: whoever you hit goes flying
 *
 * BODIES ARE SOLID: two frogs on one pad push each other, the one walking
 * into the other harder -- so a frog stood at the edge can be shoved off.
 *
 * IN 2D: the pond seen from above and a little in front, so the pads are
 * ellipses and a jumping frog rises off its own shadow.  The game is worked
 * out on the flat (x, z) of the pond, in pad units, and only drawn at an
 * angle.  Every texture -- the water, each pad, each frog -- is painted
 * once, procedurally, into a canvas, the way Bog Ball's are.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

// ------------------------------------------------------------------ the pond

const COLS = 7;
const ROWS = 5;
/** Pad centre to pad centre: with PAD_R, a clear 0.6 of water between neighbours. */
const GAP = 2.5;
const PAD_R = 0.95;
const padX = (c: number): number => (c - (COLS - 1) / 2) * GAP;
const padZ = (r: number): number => (r - (ROWS - 1) / 2) * GAP;

/** The view: pixels to a pad unit, and how much the far side is squashed. */
const S = 14;
const TILT = 0.8;

// ------------------------------------------------------------------ the rules

const WALK = 2.6;
const FROG_R = 0.4;
/** How far from a pad's middle a frog's middle may walk (its feet stay on the leaf). */
const WALK_R = PAD_R - FROG_R * 0.55;
/** The furthest a jump goes (a diagonal neighbour is GAP * 1.41 = 3.54). */
const JUMP_REACH = 3.8;
/** Half the angle either side of where you face that a jump will look for a pad in. */
const JUMP_CONE = 0.9;
const CD = { tongue: 1.1, bump: 1.7, jump: 0.55 };
const TONGUE_LEN = 2.3;
const TONGUE_S = 0.32;
const BUMP_S = 0.2;
const BUMP_SPEED = 7;
const KNOCK = 5.6;
const FRICTION = 5;
const FIRST_WAVE = 4;
/** A fall: over the edge and down to the water, then under. */
const DROP_S = 0.28;
const SINK_S = 1.1;

type Kind = 'player' | 'brute' | 'shell' | 'sly';
type PadState = 'ok' | 'warn' | 'sink' | 'gone';

interface Pad {
  c: number;
  r: number;
  x: number;
  z: number;
  state: PadState;
  t: number;
  warn: number;
  seed: number;
  /** A shake this frame, in px; a dip when a frog lands on it. */
  jx: number;
  jy: number;
  dip: number;
  img: Phaser.GameObjects.Image | null;
}

interface Jump {
  t: number;
  dur: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  h: number;
}

interface Fall {
  t: number;
  /** Straight into the water (a missed jump), or over the edge first. */
  wet: boolean;
  spin: number;
}

interface Frog {
  kind: Kind;
  name: string;
  col: number;
  dark: number;
  light: number;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  face: number;
  jump: Jump | null;
  /** The crouch before a jump and the squash after one (0..1). */
  squash: number;
  alive: boolean;
  fall: Fall | null;
  stun: number;
  cds: { tongue: number; bump: number; jump: number };
  tongue: number;
  tongueHit: boolean;
  bump: number;
  hop: number;
  place: number;
  outAt: number;
  hitsTaken: number;
  brain: { think: number; mx: number; mz: number; want: 'tongue' | 'bump' | 'jump' | null; aim: number | null };
  img: Phaser.GameObjects.Image | null;
  shadow: Phaser.GameObjects.Ellipse | null;
}

/** A drop of water or a spark (x, z on the pond, h above it), or a spreading ring. */
interface Bit {
  x: number;
  z: number;
  h: number;
  vx: number;
  vz: number;
  vh: number;
  t: number;
  life: number;
  col: number;
  ring?: boolean;
  big?: boolean;
}

// ------------------------------------------------------------------ module state

let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;
let gfx: Phaser.GameObjects.Graphics | null = null;
let fxG: Phaser.GameObjects.Graphics | null = null;
let CX = GAME_W / 2;
let CY = 100;
let pads: Pad[] = [];
let frogs: Frog[] = [];
let bits: Bit[] = [];
let flies: Array<{ x: number; y: number; a: number; s: number }> = [];
let clock = 0;
let waveIn = FIRST_WAVE;
let phase: 'count' | 'play' | 'over' = 'count';
let countT = 0;
let settled = false;
let keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
let hud: Phaser.GameObjects.BitmapText | null = null;
let chips: Phaser.GameObjects.GameObject[] = [];
let banner: Phaser.GameObjects.BitmapText | null = null;
let nextPlace = 4;
let objs: Phaser.GameObjects.GameObject[] = [];

const player = (): Frog => frogs[0];
/** The pond (x, z, height) on the screen. */
const sx = (x: number): number => CX + x * S;
const sy = (z: number, h = 0): number => CY + z * S * TILT - h * S;

// ------------------------------------------------------------------ the frogs

const FROGS: Array<{ kind: Kind; name: string; col: number; dark: number; light: number }> = [
  { kind: 'player', name: 'MOSS', col: 0x4ac85a, dark: 0x1e6a30, light: 0xa8f0a0 },
  { kind: 'brute', name: 'BRUTE', col: 0xd8463a, dark: 0x6a1a16, light: 0xf8a088 },
  { kind: 'shell', name: 'SHELL', col: 0x3a7ad8, dark: 0x16306a, light: 0xa0c8ff },
  { kind: 'sly', name: 'SLY', col: 0xe8c43a, dark: 0x7a5a10, light: 0xfff0a0 },
];

function makeFrog(i: number, c: number, r: number): Frog {
  const spec = FROGS[i];
  const x = padX(c);
  const z = padZ(r);
  return {
    ...spec, x, z, y: 0, vx: 0, vz: 0, face: Math.atan2(-x, -z), jump: null, squash: 0, alive: true, fall: null, stun: 0,
    cds: { tongue: 0.5, bump: 0.5, jump: 0 }, tongue: 0, tongueHit: false, bump: 0, hop: 0, place: 0, outAt: 0, hitsTaken: 0,
    brain: { think: Math.random() * 0.3, mx: 0, mz: 0, want: null, aim: null },
    img: null,
    shadow: null,
  };
}

// ------------------------------------------------------------------ the ground

/** A pad that still holds a frog up (one going under does, for its first moment). */
const live = (p: Pad): boolean => p.state !== 'gone' && !(p.state === 'sink' && p.t > 0.25);

/** The pad under (x, z), exactly: inside its leaf, or none. */
function padAt(x: number, z: number, r = PAD_R): Pad | null {
  for (const p of pads) if (live(p) && Math.hypot(p.x - x, p.z - z) <= r) return p;
  return null;
}

const safeAt = (x: number, z: number): boolean => {
  const p = padAt(x, z);
  return !!p && p.state === 'ok';
};

/** Pads a frog can jump between: the eight round it. */
const neighbours = (p: Pad, ok: Set<Pad>): Pad[] => pads.filter((q) => q !== p && ok.has(q) && Math.abs(q.c - p.c) <= 1 && Math.abs(q.r - p.r) <= 1);

/** Would the 'ok' pads still be one piece (by jumps) without these? */
function staysWhole(without: Set<Pad>): boolean {
  const ok = new Set(pads.filter((q) => q.state === 'ok' && !without.has(q)));
  if (!ok.size) return false;
  const first = ok.values().next().value as Pad;
  const seen = new Set<Pad>([first]);
  const q = [first];
  while (q.length) {
    const p = q.pop()!;
    for (const n of neighbours(p, ok)) if (!seen.has(n)) (seen.add(n), q.push(n));
  }
  return seen.size === ok.size;
}

/**
 * THE NEXT WAVE.  A few pads start to go -- from the outside in, mostly --
 * picked so the pads left are always one piece, always more than the frogs
 * still in, and every warned pad has a safe one beside it to jump to.
 */
function wave(): void {
  const alive = frogs.filter((f) => f.alive).length;
  const n = Math.min(3, 1 + Math.floor(clock / 25));
  const warn = Math.max(1.2, 2.1 - clock / 70);
  const picked = new Set<Pad>();
  for (let k = 0; k < n; k++) {
    const cand = pads.filter((p) => p.state === 'ok' && !picked.has(p));
    if (cand.length <= alive + 2) break;
    const okSet = new Set(cand);
    cand.sort((a, b) => neighbours(a, okSet).length - neighbours(b, okSet).length + (Math.random() - 0.5) * 3);
    const p = cand.find((c) => staysWhole(new Set([...picked, c])) && neighbours(c, okSet).length > 0);
    if (!p) break;
    picked.add(p);
  }
  for (const p of picked) {
    p.state = 'warn';
    p.t = 0;
    p.warn = warn;
  }
  if (picked.size) audio.sfx('glass_crack', 0.25);
}

// ------------------------------------------------------------------ effects

function splash(x: number, z: number, big: boolean): void {
  bits.push({ x, z, h: 0, vx: 0, vz: 0, vh: 0, t: 0, life: big ? 1.1 : 0.6, col: 0xd8f4ff, ring: true, big });
  if (big) bits.push({ x, z, h: 0, vx: 0, vz: 0, vh: 0, t: -0.25, life: 1.1, col: 0x9ad8f0, ring: true, big });
  for (let i = 0; i < (big ? 18 : 6); i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.6 + Math.random() * (big ? 2.4 : 1.1);
    bits.push({ x, z, h: 0.05, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vh: 2.2 + Math.random() * (big ? 3.4 : 1.4), t: 0, life: 1, col: i % 3 ? 0xbfe8ff : 0xffffff });
  }
  audio.sfx('water_plip', big ? 0.7 : 0.3);
}

/** A frog landing on a pad: a ring on the leaf and the leaf dipping under it. */
function thud(f: Frog, p: Pad): void {
  bits.push({ x: f.x, z: f.z, h: 0, vx: 0, vz: 0, vh: 0, t: 0, life: 0.4, col: 0xc8f0b0, ring: true });
  p.dip = 1;
  audio.sfx('hop_wet', 0.3);
}

function spark(x: number, z: number): void {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    bits.push({ x, z, h: 0.4, vx: Math.cos(a) * 3, vz: Math.sin(a) * 3, vh: 1 + Math.random() * 2, t: 0, life: 0.35, col: 0xfff0a0 });
  }
}

function announce(s: string, col: number = PALETTE.gold): void {
  if (!banner || !sceneRef) return;
  banner.setText(s).setTint(col).setAlpha(1).setVisible(true);
  sceneRef.tweens.killTweensOf(banner);
  sceneRef.tweens.add({ targets: banner, alpha: 0, delay: 1100, duration: 500 });
}

// ------------------------------------------------------------------ combat

function knock(f: Frog, dx: number, dz: number, power: number, by: Frog): void {
  const d = Math.hypot(dx, dz) || 1;
  f.vx = (dx / d) * power;
  f.vz = (dz / d) * power;
  f.stun = 0.35;
  f.hitsTaken += 1;
  spark(f.x, f.z);
  audio.sfx(by.bump > 0 ? 'item_thud' : 'throw_whoosh', 0.5);
}

function tongueHits(f: Frog): void {
  const len = TONGUE_LEN * Math.sin((1 - f.tongue / TONGUE_S) * Math.PI);
  const ux = Math.sin(f.face);
  const uz = Math.cos(f.face);
  for (const o of frogs) {
    if (o === f || !o.alive || o.jump) continue;
    const rx = o.x - f.x;
    const rz = o.z - f.z;
    const along = rx * ux + rz * uz;
    if (along < 0 || along > len + FROG_R) continue;
    if (Math.abs(rx * uz - rz * ux) > FROG_R + 0.08) continue;
    f.tongueHit = true;
    knock(o, ux, uz, KNOCK, f);
    return;
  }
}

/**
 * WHERE A JUMP GOES.  The pad the way you face (within a wide cone, near
 * ones first), and on it about where you would expect -- a little of where
 * you stood on your own pad carried over, so it is not a teleport to the
 * middle.  No pad that way: a jump's length out over the water, and in.
 */
function jumpTarget(f: Frog): { x: number; z: number } {
  const here = padAt(f.x, f.z);
  const ux = Math.sin(f.face);
  const uz = Math.cos(f.face);
  let best: Pad | null = null;
  let bs = Infinity;
  for (const p of pads) {
    if (p === here || !live(p) || p.state === 'sink') continue;
    const dx = p.x - f.x;
    const dz = p.z - f.z;
    const d = Math.hypot(dx, dz);
    if (d > JUMP_REACH || d < 0.5) continue;
    const ang = Math.acos(Phaser.Math.Clamp((dx * ux + dz * uz) / d, -1, 1));
    if (ang > JUMP_CONE) continue;
    const score = d + ang * 2.2 + (p.state === 'warn' ? 1.5 : 0);
    if (score < bs) {
      bs = score;
      best = p;
    }
  }
  if (best) {
    const ox = here ? (f.x - here.x) * 0.3 : 0;
    const oz = here ? (f.z - here.z) * 0.3 : 0;
    return { x: best.x + ox, z: best.z + oz };
  }
  return { x: f.x + ux * GAP, z: f.z + uz * GAP };
}

function act(f: Frog, what: 'tongue' | 'bump' | 'jump'): void {
  if (!f.alive || f.stun > 0 || f.cds[what] > 0 || f.jump || phase !== 'play') return;
  f.cds[what] = CD[what];
  if (what === 'tongue') {
    f.tongue = TONGUE_S;
    f.tongueHit = false;
    audio.sfx('throw_whoosh', 0.3);
  } else if (what === 'bump') {
    f.bump = BUMP_S;
    f.vx = Math.sin(f.face) * BUMP_SPEED;
    f.vz = Math.cos(f.face) * BUMP_SPEED;
  } else {
    const to = jumpTarget(f);
    const d = Math.hypot(to.x - f.x, to.z - f.z);
    f.jump = { t: 0, dur: 0.34 + d * 0.07, x0: f.x, z0: f.z, x1: to.x, z1: to.z, h: 0.7 + d * 0.16 };
    f.face = Math.atan2(to.x - f.x, to.z - f.z);
    f.vx = f.vz = 0;
    f.squash = 1;
    audio.sfx('hop_wet', 0.35);
  }
}

// ------------------------------------------------------------------ the AI

/**
 * Three ways to play.  BRUTE chases the nearest frog and hits it with
 * whatever is ready.  SHELL keeps to the middle of what is left and only
 * fights what comes to it.  SLY looks for a frog with water behind it and
 * goes for that one, lining up so the hit sends it in.  All of them jump
 * off a pad that is going, and get about by jumping, pad to pad, towards
 * wherever they mean to be.
 */
function think(f: Frog, dt: number): void {
  const b = f.brain;
  b.think -= dt;
  if (b.think > 0) return;
  b.think = 0.18 + Math.random() * 0.14;
  b.want = null;
  b.aim = null;
  const others = frogs.filter((o) => o !== f && o.alive);
  const ok = pads.filter((p) => p.state === 'ok');
  const here = padAt(f.x, f.z);
  const centre = ok.reduce((a, p) => ({ x: a.x + p.x / ok.length, z: a.z + p.z / ok.length }), { x: 0, z: 0 });
  let gx = f.x;
  let gz = f.z;
  let target: Frog | null = null;
  if (f.kind === 'brute') {
    target = others.sort((a, c) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(c.x - f.x, c.z - f.z))[0] ?? null;
  } else if (f.kind === 'shell') {
    gx = centre.x;
    gz = centre.z;
    target = others.find((o) => Math.hypot(o.x - f.x, o.z - f.z) < 2.6) ?? null;
  } else {
    const exposed = (o: Frog): number => {
      let w = 0;
      for (let a = 0; a < 8; a++) if (!safeAt(o.x + Math.cos(a * 0.785) * 1.2, o.z + Math.sin(a * 0.785) * 1.2)) w++;
      return w;
    };
    target = others.sort((a, c) => exposed(c) - exposed(a))[0] ?? null;
    if (target && exposed(target) < 3) {
      gx = centre.x;
      gz = centre.z;
      target = Math.hypot(target.x - f.x, target.z - f.z) < 2.4 ? target : null;
    }
  }
  if (target) {
    const dx = target.x - f.x;
    const dz = target.z - f.z;
    const d = Math.hypot(dx, dz) || 1;
    if (f.kind === 'sly') {
      // round to the inland side, so the hit sends it out
      const cx = centre.x - target.x;
      const cz = centre.z - target.z;
      const cm = Math.hypot(cx, cz) || 1;
      gx = target.x + (cx / cm) * 1.2;
      gz = target.z + (cz / cm) * 1.2;
    } else {
      gx = target.x - (dx / d) * 1.0;
      gz = target.z - (dz / d) * 1.0;
    }
    const facing = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dx, dz) - f.face)) < 0.45;
    const samePad = here && padAt(target.x, target.z) === here;
    if (facing && d < TONGUE_LEN * 0.95 && f.cds.tongue <= 0 && Math.random() < (f.kind === 'brute' ? 0.8 : 0.55)) b.want = 'tongue';
    else if (facing && samePad && d < 1.3 && f.cds.bump <= 0 && Math.random() < (f.kind === 'brute' ? 0.7 : 0.4)) b.want = 'bump';
    // close enough: turn to it rather than walk into it
    if (d < 2.4 && !b.want) {
      gx = f.x + (dx / d) * 0.3;
      gz = f.z + (dz / d) * 0.3;
    }
  }
  // ---- GETTING THERE.  The goal on this pad: walk to it.  On another:
  // jump to the neighbour that gets closest to it.  This pad going: jump
  // to the nearest safe one, now.
  const goalPad = padAt(gx, gz) ?? null;
  const danger = !here || here.state !== 'ok';
  if (here && (danger || goalPad !== here)) {
    let best: Pad | null = null;
    let bd = danger ? Infinity : Math.hypot(here.x - gx, here.z - gz) - 0.4;
    for (const p of ok) {
      if (p === here || Math.abs(p.c - here.c) > 1 || Math.abs(p.r - here.r) > 1) continue;
      // (not onto a pad a frog is already stood in the middle of)
      if (frogs.some((o) => o !== f && o.alive && Math.hypot(o.x - p.x, o.z - p.z) < 0.5)) continue;
      const d = danger ? Math.hypot(p.x - f.x, p.z - f.z) : Math.hypot(p.x - gx, p.z - gz);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (best && f.cds.jump <= 0 && b.want !== 'tongue') {
      b.want = 'jump';
      b.aim = Math.atan2(best.x - f.x, best.z - f.z);
    }
    if (goalPad !== here) {
      // (meanwhile, to the side of its pad nearest where it is going)
      const tx = best ? best.x : gx;
      const tz = best ? best.z : gz;
      const m = Math.hypot(tx - here.x, tz - here.z) || 1;
      gx = here.x + ((tx - here.x) / m) * WALK_R * 0.6;
      gz = here.z + ((tz - here.z) / m) * WALK_R * 0.6;
    }
  }
  const mx = gx - f.x;
  const mz = gz - f.z;
  const m = Math.hypot(mx, mz);
  b.mx = m > 0.12 ? mx / m : 0;
  b.mz = m > 0.12 ? mz / m : 0;
}

// ------------------------------------------------------------------ stepping

/** Into the water: over the edge (it slides on a moment) or straight in from a jump. */
function fallIn(f: Frog, wet = false): void {
  if (!f.alive) return;
  f.alive = false;
  f.fall = { t: wet ? DROP_S : 0, wet, spin: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3) };
  f.outAt = clock;
  f.jump = null;
  if (wet) splash(f.x, f.z, true);
  else audio.sfx('throw_whoosh', 0.3);
}

/** Keep a walking frog on its own leaf. */
function keepOn(f: Frog, p: Pad): void {
  const dx = f.x - p.x;
  const dz = f.z - p.z;
  const d = Math.hypot(dx, dz);
  if (d > WALK_R) {
    f.x = p.x + (dx / d) * WALK_R;
    f.z = p.z + (dz / d) * WALK_R;
    // (the part of its speed that was going off the edge is gone)
    const out = (f.vx * dx + f.vz * dz) / d;
    if (out > 0) {
      f.vx -= (dx / d) * out;
      f.vz -= (dz / d) * out;
    }
  }
}

function stepFrog(f: Frog, dt: number, mx: number, mz: number): void {
  if (!f.alive) {
    const fl = f.fall;
    if (fl) {
      const was = fl.t;
      fl.t += dt;
      if (fl.t < DROP_S) {
        // over the edge: carried on a little, dropping
        f.x += f.vx * dt * 0.6;
        f.z += f.vz * dt * 0.6;
        f.y = -0.35 * (fl.t / DROP_S) ** 2;
      } else if (was < DROP_S) splash(f.x, f.z, true);
    }
    return;
  }
  for (const k of ['tongue', 'bump', 'jump'] as const) f.cds[k] = Math.max(0, f.cds[k] - dt);
  f.stun = Math.max(0, f.stun - dt);
  f.squash = Math.max(0, f.squash - dt * 5);
  // ---- IN THE AIR: along a straight line, up and down an arc
  if (f.jump) {
    const j = f.jump;
    j.t += dt;
    const k = Math.min(1, j.t / j.dur);
    f.x = j.x0 + (j.x1 - j.x0) * k;
    f.z = j.z0 + (j.z1 - j.z0) * k;
    f.y = 4 * j.h * k * (1 - k);
    if (k >= 1) {
      f.jump = null;
      f.y = 0;
      f.squash = 1;
      // EXACT: on a leaf that is still there as you come down, or in
      const p = padAt(f.x, f.z, PAD_R - 0.05);
      if (p) {
        thud(f, p);
        keepOn(f, p);
      } else fallIn(f, true);
    }
    return;
  }
  const here = padAt(f.x, f.z);
  const free = f.stun <= 0 && f.bump <= 0;
  if (free) {
    const k = Math.min(1, dt * 10);
    if (Math.hypot(f.vx, f.vz) > WALK + 0.5) {
      f.vx -= f.vx * Math.min(1, FRICTION * dt);
      f.vz -= f.vz * Math.min(1, FRICTION * dt);
    } else {
      f.vx += (mx * WALK - f.vx) * k;
      f.vz += (mz * WALK - f.vz) * k;
    }
    if (mx || mz) {
      f.face = Math.atan2(mx, mz);
      f.hop += dt * 11;
    }
  } else {
    f.vx -= f.vx * Math.min(1, FRICTION * 0.6 * dt);
    f.vz -= f.vz * Math.min(1, FRICTION * 0.6 * dt);
  }
  if (f.bump > 0) {
    f.bump -= dt;
    for (const o of frogs) {
      if (o === f || !o.alive || o.jump) continue;
      if (Math.hypot(o.x - f.x, o.z - f.z) < FROG_R * 2.1) {
        knock(o, o.x - f.x, o.z - f.z, KNOCK * 1.15, f);
        f.vx *= 0.15;
        f.vz *= 0.15;
        f.bump = 0;
        break;
      }
    }
  }
  if (f.tongue > 0) {
    f.tongue -= dt;
    if (!f.tongueHit && f.tongue < TONGUE_S * 0.75 && f.tongue > TONGUE_S * 0.25) tongueHits(f);
  }
  f.x += f.vx * dt;
  f.z += f.vz * dt;
  // walking and charging stay on the leaf; being knocked does not
  if (here && f.stun <= 0) keepOn(f, here);
  if (!padAt(f.x, f.z)) fallIn(f);
}

/**
 * SOLID BODIES.  Two frogs on the ground closer than their two bodies are
 * pushed apart -- the one walking into the other gives way less, and hands
 * on some of its push -- so you can block a frog off, and shove one stood
 * at the edge into the water.  (In the air, a frog sails over.)
 */
function separate(): void {
  for (let i = 0; i < frogs.length; i++) {
    for (let j = i + 1; j < frogs.length; j++) {
      const a = frogs[i];
      const b = frogs[j];
      if (!a.alive || !b.alive || a.jump || b.jump) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d <= 0 || d >= FROG_R * 2) continue;
      const ux = dx / d;
      const uz = dz / d;
      // how hard each is going at the other
      const ia = Math.max(0, a.vx * ux + a.vz * uz);
      const ib = Math.max(0, -(b.vx * ux + b.vz * uz));
      const overlap = FROG_R * 2 - d;
      const sa = (ib + 0.4) / (ia + ib + 0.8);
      const sb = 1 - sa;
      a.x -= ux * overlap * sa;
      a.z -= uz * overlap * sa;
      b.x += ux * overlap * sb;
      b.z += uz * overlap * sb;
      // the push carries: the pushed frog takes some of the pusher's way
      const give = (ia - ib) * 0.35;
      if (give > 0) {
        b.vx += ux * give;
        b.vz += uz * give;
      } else if (give < 0) {
        a.vx += ux * give;
        a.vz += uz * give;
      }
    }
  }
  for (const f of frogs) if (f.alive && !f.jump && !padAt(f.x, f.z)) fallIn(f);
}

function stepPads(dt: number): void {
  for (const p of pads) {
    p.jx = p.jy = 0;
    p.dip = Math.max(0, p.dip - dt * 4);
    if (p.state === 'warn') {
      p.t += dt;
      const j = 0.4 + (p.t / p.warn) * 1.4;
      p.jx = (Math.random() - 0.5) * j;
      p.jy = (Math.random() - 0.5) * j;
      if (p.t >= p.warn) {
        p.state = 'sink';
        p.t = 0;
        splash(p.x, p.z, true);
        audio.sfx('crumble', 0.4);
      }
    } else if (p.state === 'sink') {
      p.t += dt;
      if (p.t > 0.9) p.state = 'gone';
    }
  }
}

function stepBits(dt: number): void {
  for (const b of bits) {
    b.t += dt;
    if (!b.ring && b.t > 0) {
      b.vh -= 9 * dt;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.h += b.vh * dt;
      if (b.h < -0.05) b.t = b.life;
    }
  }
  bits = bits.filter((b) => b.t < b.life);
}

// ------------------------------------------------------------------ textures

function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Smooth value noise on a grid. */
function noise2(R: () => number, w: number, h: number, cell: number): (x: number, y: number) => number {
  const gw = Math.ceil(w / cell) + 2;
  const gh = Math.ceil(h / cell) + 2;
  const v = Array.from({ length: gw * gh }, () => R());
  const at = (i: number, j: number) => v[j * gw + i];
  return (x, y) => {
    const fx = x / cell;
    const fy = y / cell;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const ax = tx * tx * (3 - 2 * tx);
    const ay = ty * ty * (3 - 2 * ty);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * ax;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * ax;
    return a + (b - a) * ay;
  };
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const mix = (a: number, b: number, t: number) => {
  const ch = (s: number) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/**
 * THE POND, once: deep water darkening to the banks, moonlight on the
 * middle, weed in the depths and a scum of duckweed at the edges; the
 * muddy bank along the top with its reeds and stones.
 */
function paintPond(scene: Phaser.Scene, top: number, h: number): void {
  const key = 'pads_pond';
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const W = GAME_W;
  const tex = scene.textures.createCanvas(key, W, h);
  if (!tex) return;
  const g = tex.getContext();
  const R = rng(5151);
  const n1 = noise2(R, W, h, 22);
  const n2 = noise2(R, W, h, 6);
  const cy = CY - top;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < W; x++) {
      const ex = (x - CX) / 170;
      const ey = (y - cy) / 100;
      const edge = Math.min(1, Math.hypot(ex, ey));
      const v = n1(x, y) * 0.6 + n2(x, y) * 0.4;
      // deep teal in the middle, near black at the banks, the weed darker
      let c = mix(0x1a4a5a, 0x06141c, edge * 0.9);
      if (v < 0.32) c = mix(c, 0x0a2a22, 0.5);
      if (v > 0.72) c = mix(c, 0x2a6a7a, 0.35);
      g.fillStyle = hex(c);
      g.fillRect(x, y, 1, 1);
    }
  }
  // the moon's glitter, in streaks across the middle
  for (let i = 0; i < 120; i++) {
    const x = CX + (R() - 0.5) * 200;
    const y = cy + (R() - 0.5) * 90;
    g.fillStyle = `rgba(160,220,230,${0.08 + R() * 0.16})`;
    g.fillRect(Math.round(x), Math.round(y), 2 + Math.floor(R() * 6), 1);
  }
  // duckweed scum round the edges of the water
  for (let i = 0; i < 520; i++) {
    const a = R() * Math.PI * 2;
    const r = 0.86 + R() * 0.3;
    const x = CX + Math.cos(a) * 170 * r;
    const y = cy + Math.sin(a) * 100 * r;
    if (x < 0 || x >= W || y < 0 || y >= h) continue;
    g.fillStyle = R() < 0.5 ? '#3e6a26' : '#5a8a30';
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  // the bank along the top: mud, stones, reeds
  const bank = 12;
  const n3 = noise2(R, W, bank, 3);
  for (let y = 0; y < bank; y++)
    for (let x = 0; x < W; x++) {
      const v = n3(x, y);
      const wob = Math.sin(x * 0.11) * 2 + Math.sin(x * 0.37) * 1;
      if (y > bank - 3 + wob) continue;
      g.fillStyle = hex(mix(0x2a1e14, 0x4a3a26, v));
      g.fillRect(x, y, 1, 1);
    }
  for (let i = 0; i < 24; i++) {
    const x = R() * W;
    const y = 2 + R() * 7;
    g.fillStyle = '#5a5a56';
    g.fillRect(Math.round(x), Math.round(y), 2 + Math.floor(R() * 2), 2);
    g.fillStyle = '#8a8a80';
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  for (let i = 0; i < 70; i++) {
    const x = Math.round(R() * W);
    const hgt = 6 + Math.floor(R() * 9);
    g.fillStyle = R() < 0.5 ? '#2a4a1e' : '#3e6a2a';
    g.fillRect(x, bank - hgt + 4, 1, hgt);
    if (R() < 0.25) {
      g.fillStyle = '#6a4a24';
      g.fillRect(x, bank - hgt + 3, 2, 3);
    }
  }
  tex.refresh();
}

/**
 * A LILY PAD: a round leaf with its notch, drawn at the view's tilt --
 * waxy green, darker to the rim and the far side, lit from the moon top
 * left, veins out from the stem, a few bitten edges and blemishes.
 */
function paintPad(scene: Phaser.Scene, key: string, seed: number): void {
  if (scene.textures.exists(key)) return;
  const rx = Math.round(PAD_R * S) + 1;
  const ry = Math.round(PAD_R * S * TILT) + 1;
  const W = rx * 2 + 2;
  const H = ry * 2 + 4;
  const tex = scene.textures.createCanvas(key, W, H);
  if (!tex) return;
  const g = tex.getContext();
  const R = rng(seed);
  const n = noise2(R, W, H, 4);
  // (a finer grain of its own: sampling the coarse one at twice the size
  // ran off the end of its grid, and the bottom half of every pad went black)
  const fine = noise2(R, W, H, 2);
  const cx = W / 2;
  const cy = ry + 1;
  const notch = R() * Math.PI * 2;
  const bites = Array.from({ length: 2 }, () => ({ a: R() * Math.PI * 2, r: 0.12 + R() * 0.1 }));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      // the notch: a wedge cut in to the middle
      const da = Math.abs(Phaser.Math.Angle.Wrap(a - notch));
      if (da < 0.2 * (1 - d * 0.3) && d > 0.08) continue;
      let edge = 1 + (n(x, y) - 0.5) * 0.08;
      for (const b of bites) if (Math.abs(Phaser.Math.Angle.Wrap(a - b.a)) < 0.25) edge -= b.r * (1 - Math.abs(Phaser.Math.Angle.Wrap(a - b.a)) / 0.25);
      if (d > edge) continue;
      if (d > edge - 0.12) {
        g.fillStyle = '#123a16';
        g.fillRect(x, y, 1, 1);
        continue;
      }
      const light = Phaser.Math.Clamp(0.62 - (dx + dy) * 0.22 - d * 0.25 + (fine(x, y) - 0.5) * 0.3, 0, 1);
      let c = mix(0x1e5a22, 0x6ac85a, light);
      // the veins: thin lighter lines from the stem
      const va = (((a - notch) % 0.78) + 0.78) % 0.78;
      if (d > 0.15 && Math.abs(va - 0.39) < 0.05) c = mix(c, 0xa8e88a, 0.45);
      g.fillStyle = hex(c);
      g.fillRect(x, y, 1, 1);
    }
  // blemishes, and the shine of the wax
  for (let i = 0; i < 5; i++) {
    const a = R() * Math.PI * 2;
    const r = 0.3 + R() * 0.5;
    g.fillStyle = R() < 0.5 ? 'rgba(90,70,20,0.55)' : 'rgba(20,50,20,0.6)';
    g.fillRect(Math.round(cx + Math.cos(a) * rx * r), Math.round(cy + Math.sin(a) * ry * r), 1 + Math.floor(R() * 2), 1);
  }
  g.fillStyle = 'rgba(230,255,220,0.35)';
  g.fillRect(Math.round(cx - rx * 0.45), Math.round(cy - ry * 0.45), 4, 1);
  g.fillRect(Math.round(cx - rx * 0.55), Math.round(cy - ry * 0.3), 2, 1);
  // the stem in the middle
  g.fillStyle = '#2a6a22';
  g.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2);
  tex.refresh();
}

/**
 * A FROG, from above, facing right: legs folded at its sides, warty skin
 * in its colours, pale belly line, eyes up on top -- and its mark: a leaf
 * cap, horns, a shell, a crest.
 */
function paintFrog(scene: Phaser.Scene, key: string, spec: (typeof FROGS)[number], seed: number): void {
  if (scene.textures.exists(key)) return;
  const Z = 20;
  const tex = scene.textures.createCanvas(key, Z, Z);
  if (!tex) return;
  const g = tex.getContext();
  const R = rng(seed);
  const c = Z / 2;
  const line = '#0a120a';
  const base = hex(spec.col);
  const dark = hex(spec.dark);
  const ell = (x: number, y: number, rx: number, ry: number, col: string) => {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  };
  for (const s of [-1, 1]) {
    ell(c - 4.5, c + s * 5.4, 4, 2.3, line);
    ell(c - 4.5, c + s * 5.4, 3.2, 1.6, dark);
    ell(c + 3.5, c + s * 4.6, 2.3, 1.4, line);
    ell(c + 3.5, c + s * 4.6, 1.6, 0.9, dark);
  }
  ell(c, c, 6.6, 5.9, line);
  ell(c, c, 5.8, 5.1, base);
  ell(c + 3.4, c, 4, 4.2, line);
  ell(c + 3.4, c, 3.3, 3.5, base);
  const img = g.getImageData(0, 0, Z, Z);
  const lit = (spec.light >> 16) & 255;
  for (let y = 0; y < Z; y++)
    for (let x = 0; x < Z; x++) {
      const i = (y * Z + x) * 4;
      if (img.data[i + 3] === 0) continue;
      if (img.data[i] < 20 && img.data[i + 1] < 30) continue;
      // shaded from the top left, warts dark and light
      const sh = 1 + (c - x + (c - y)) * 0.025;
      for (let k = 0; k < 3; k++) img.data[i + k] = Math.min(255, img.data[i + k] * sh);
      const v = R();
      if (v < 0.1) for (let k = 0; k < 3; k++) img.data[i + k] *= 0.7;
      else if (v < 0.18) for (let k = 0; k < 3; k++) img.data[i + k] = Math.min(255, img.data[i + k] * 0.6 + lit * 0.4);
    }
  g.putImageData(img, 0, 0);
  g.fillStyle = 'rgba(255,255,230,0.3)';
  g.fillRect(c - 4, c - 1, 7, 1);
  // its mark
  if (spec.kind === 'player') {
    g.fillStyle = '#2a8a2a';
    g.beginPath();
    g.ellipse(c - 1, c, 2.6, 1.6, 0.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8ae07a';
    g.fillRect(c - 2, c, 3, 1);
  } else if (spec.kind === 'brute') {
    g.fillStyle = '#f0e0c0';
    g.fillRect(c + 5, c - 5, 2, 2);
    g.fillRect(c + 5, c + 3, 2, 2);
    g.fillStyle = '#a89870';
    g.fillRect(c + 6, c - 6, 1, 1);
    g.fillRect(c + 6, c + 5, 1, 1);
  } else if (spec.kind === 'shell') {
    ell(c - 2, c, 3.6, 3.4, '#4a3218');
    ell(c - 2, c, 2.8, 2.6, '#8a6a3a');
    g.fillStyle = '#5a4020';
    g.fillRect(c - 2, c - 2, 1, 5);
    g.fillRect(c - 4, c, 5, 1);
  } else {
    g.fillStyle = '#ff7a2a';
    g.fillRect(c - 5, c, 8, 1);
    g.fillStyle = '#ffb060';
    g.fillRect(c - 3, c, 2, 1);
  }
  for (const s of [-1, 1]) {
    g.fillStyle = line;
    g.fillRect(c + 3, c + s * 2.5 - 1.5, 3, 3);
    g.fillStyle = '#f4f0d0';
    g.fillRect(c + 4, c + s * 2.5 - 0.5, 2, 1);
    g.fillStyle = '#000';
    g.fillRect(c + 5, c + s * 2.5 - 0.5, 1, 1);
  }
  tex.refresh();
}

/** The moonlight: bright over the middle of the pond, the corners in the dark. */
function paintLight(scene: Phaser.Scene, top: number, h: number): void {
  const key = 'pads_light';
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, GAME_W, h);
  if (!tex) return;
  const g = tex.getContext();
  const grd = g.createRadialGradient(CX - 30, CY - top - 30, 20, CX, CY - top, 210);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.55, 'rgba(0,4,10,0.1)');
  grd.addColorStop(1, 'rgba(0,4,10,0.65)');
  g.fillStyle = grd;
  g.fillRect(0, 0, GAME_W, h);
  tex.refresh();
}

// ------------------------------------------------------------------ drawing

function drawPads(t: number): void {
  for (const p of pads) {
    const im = p.img;
    if (!im) continue;
    if (p.state === 'gone') {
      im.setVisible(false);
      continue;
    }
    const sink = p.state === 'sink' ? p.t / 0.9 : 0;
    const bob = p.state === 'ok' ? Math.sin(t * 1.6 + p.seed) * 0.4 : 0;
    const k = p.state === 'warn' ? p.t / p.warn : 0;
    const flash = p.state === 'warn' && Math.sin(p.t * (10 + k * 26)) > 0;
    im.setVisible(true)
      .setPosition(sx(p.x) + p.jx, sy(p.z) + p.jy + bob + sink * 3 + p.dip * 1.2)
      .setScale(1 - sink * 0.45)
      .setAlpha(1 - sink * 0.85)
      .setDepth(3 + p.z * 0.01);
    if (p.state === 'sink') im.setTint(0x8a9a6a);
    else if (flash) im.setTint(k > 0.6 ? 0xff7a5a : 0xffc070);
    else im.clearTint();
  }
}

/** On the pads: the cracks of a pad that is going (drawn over its leaf). */
function drawCracks(g: Phaser.GameObjects.Graphics): void {
  for (const p of pads) {
    const k = p.state === 'warn' ? p.t / p.warn : p.state === 'sink' ? 1 : 0;
    if (k < 0.45 || p.state === 'gone') continue;
    const x = sx(p.x) + p.jx;
    const y = sy(p.z) + p.jy;
    const rx = PAD_R * S;
    const ry = rx * TILT;
    const a = p.state === 'sink' ? 1 - p.t / 0.9 : 1;
    g.lineStyle(1, 0x1a0c04, 0.9 * a);
    for (let i = 0; i < 3 + Math.floor(k * 2); i++) {
      const ca = p.seed * 3 + i * 1.9;
      const mx = x + Math.cos(ca) * rx * 0.5;
      const my = y + Math.sin(ca) * ry * 0.5;
      g.lineBetween(x, y, mx, my);
      g.lineBetween(mx, my, mx + Math.cos(ca + 0.6) * rx * 0.4, my + Math.sin(ca + 0.6) * ry * 0.4);
    }
  }
}

function drawFrog(f: Frog, t: number): void {
  const im = f.img;
  const sh = f.shadow;
  if (!im || !sh) return;
  const fl = f.fall;
  if (!f.alive && (!fl || fl.t > DROP_S + SINK_S)) {
    im.setVisible(false);
    sh.setVisible(false);
    return;
  }
  const x = sx(f.x);
  const ground = sy(f.z);
  const lift = f.alive && !f.jump ? Math.abs(Math.sin(f.hop)) * 0.06 : 0;
  let y = sy(f.z, f.y + lift);
  let alpha = 1;
  let scale = 1 + Math.max(0, f.y) * 0.18;
  // the screen angle of where it faces (the pond is squashed front to back)
  let rot = Math.atan2(Math.cos(f.face) * TILT, Math.sin(f.face));
  // a crouch before a jump, a squash on landing
  const squashX = 1 + f.squash * 0.18;
  const squashY = 1 - f.squash * 0.16;
  if (fl) {
    rot += fl.t * fl.spin;
    if (fl.t > DROP_S) {
      // under: down through the water, going dark
      const k = Math.min(1, (fl.t - DROP_S) / SINK_S);
      y = ground + 3 + k * 5;
      alpha = 0.75 * (1 - k);
      scale = 0.9 - k * 0.3;
    } else scale = 1 - (fl.t / DROP_S) * 0.1;
  }
  const wob = f.stun > 0 ? Math.sin(t * 40) * 1.1 : 0;
  im.setVisible(true)
    .setPosition(x + wob, y - 2)
    .setRotation(rot)
    .setScale(scale * squashX, scale * squashY)
    .setAlpha(alpha)
    .setDepth(10 + f.z * 0.05 + (f.jump ? 2 : 0));
  // the shadow stays on the pad as it jumps, smaller the higher it goes
  const onWater = !f.alive || (!!f.jump && !padAt(f.x, f.z));
  sh.setVisible(!fl || fl.t < DROP_S)
    .setPosition(x, ground + 1)
    .setSize(12 - Math.max(0, f.y) * 4, 6 - Math.max(0, f.y) * 1.8)
    .setFillStyle(0x000000, onWater ? 0.2 : 0.38)
    .setDepth(9 + f.z * 0.05);
}

function drawTongues(g: Phaser.GameObjects.Graphics): void {
  for (const f of frogs) {
    if (f.tongue <= 0 || !f.alive) continue;
    const fx = Math.sin(f.face);
    const fz = Math.cos(f.face) * TILT;
    const len = TONGUE_LEN * Math.sin((1 - f.tongue / TONGUE_S) * Math.PI) * S;
    const mx = sx(f.x) + fx * 5;
    const my = sy(f.z) - 2 + fz * 5;
    g.lineStyle(3, 0x7a1a3a, 1).lineBetween(mx, my, mx + fx * len, my + fz * len);
    g.lineStyle(1.5, 0xff6a9a, 1).lineBetween(mx, my, mx + fx * len, my + fz * len);
    g.fillStyle(0x7a1a3a, 1).fillCircle(mx + fx * len, my + fz * len, 2.4);
    g.fillStyle(0xff9ac0, 1).fillCircle(mx + fx * len, my + fz * len, 1.6);
  }
}

function drawBits(g: Phaser.GameObjects.Graphics): void {
  for (const b of bits) {
    if (b.t < 0) continue;
    const k = b.t / b.life;
    if (b.ring) {
      const r = (b.big ? 6 : 4) + k * (b.big ? 22 : 10);
      g.lineStyle(1, b.col, 0.8 * (1 - k)).strokeEllipse(sx(b.x), sy(b.z), r * 2, r * 2 * TILT);
    } else g.fillStyle(b.col, 1 - k * 0.5).fillRect(sx(b.x) - 0.5, sy(b.z, b.h) - 0.5, 1.5, 1.5);
  }
}

/** The water moving: slow glints sliding across it, and fireflies over the pond. */
function drawWater(g: Phaser.GameObjects.Graphics, t: number, top: number): void {
  for (let i = 0; i < 26; i++) {
    const ph = t * (0.15 + (i % 5) * 0.03) + i * 1.7;
    const x = ((i * 47 + ph * 30) % (GAME_W + 40)) - 20;
    const y = top + 18 + ((i * 29) % 140) + Math.sin(ph) * 2;
    g.fillStyle(0x9ad8e8, 0.12 + 0.1 * Math.sin(ph * 2)).fillRect(x, y, 3 + (i % 4), 1);
  }
  for (const f of flies) {
    f.a += 0.02 * f.s;
    const x = f.x + Math.cos(f.a) * 8;
    const y = f.y + Math.sin(f.a * 1.3) * 5;
    const on = 0.5 + 0.5 * Math.sin(t * 3 * f.s + f.x);
    g.fillStyle(0xe8ff9a, 0.25 * on).fillCircle(x, y, 2.2);
    g.fillStyle(0xf8ffc0, 0.9 * on).fillRect(x, y, 1, 1);
  }
}

function draw(t: number): void {
  const g = gfx;
  const fx = fxG;
  if (!g || !fx) return;
  g.clear();
  fx.clear();
  drawWater(g, t, apiRef?.area.y ?? 18);
  drawPads(t);
  drawCracks(fx);
  for (const f of frogs) drawFrog(f, t);
  drawTongues(fx);
  drawBits(fx);
}

// ------------------------------------------------------------------ HUD

function drawChips(): void {
  for (const c of chips) c.destroy();
  chips = [];
  const s = sceneRef;
  const api = apiRef;
  if (!s || !api) return;
  frogs.forEach((f, i) => {
    const x = 6 + i * 40;
    const y = api.area.y + 3;
    chips.push(s.add.rectangle(x, y, 37, 10, 0x0a0c16, 0.8).setOrigin(0, 0).setStrokeStyle(1, f.alive ? f.col : 0x3a3a48).setDepth(40));
    chips.push(text(s, x + 3, y + 1, f.name, f.alive ? PALETTE.cream : 0x5a5a68).setDepth(41));
    if (!f.alive) chips.push(s.add.rectangle(x + 2, y + 5, 33, 1, 0xff5a5a).setOrigin(0, 0).setDepth(42));
  });
}

const placeName = (n: number): string => ['1ST', '2ND', '3RD', '4TH'][n - 1] ?? `${n}TH`;

function results(winner: Frog | null): void {
  const s = sceneRef;
  const api = apiRef;
  if (!s || !api) return;
  const order = [...frogs].sort((a, b) => a.place - b.place);
  chips.push(s.add.rectangle(GAME_W / 2, api.area.y + 82, 150, 70, PALETTE.ink, 0.94).setStrokeStyle(1, PALETTE.gold).setDepth(50));
  chips.push(centerText(s, GAME_W / 2, api.area.y + 54, winner ? `${winner.name} WINS!` : 'NOBODY IS LEFT!', winner === player() ? PALETTE.gold : PALETTE.cream).setDepth(51));
  order.forEach((f, i) => chips.push(text(s, GAME_W / 2 - 40, api.area.y + 66 + i * 9, `${placeName(f.place)}  ${f.name}`, f === player() ? PALETTE.gold : PALETTE.ash).setDepth(51)));
}

/**
 * Someone went in.  Places count down from fourth.  Two at once share the
 * worse place between them; if the last two go in together, nobody wins.
 */
function settle(): void {
  const out = frogs.filter((f) => !f.alive && f.place === 0);
  if (out.length) {
    for (const f of out) f.place = nextPlace - out.length + 1;
    nextPlace -= out.length;
    for (const f of out) announce(f === player() ? `YOU'RE OUT! ${placeName(f.place)}` : `${f.name} IS OUT!`, f === player() ? PALETTE.blood : PALETTE.gold);
    drawChips();
  }
  if (phase !== 'play') return;
  const left = frogs.filter((f) => f.alive);
  const me = player();
  if (left.length <= 1 || !me.alive) {
    phase = 'over';
    const winner = left.length === 1 ? left[0] : null;
    if (winner) winner.place = 1;
    const won = winner === me;
    for (const f of left) if (f !== winner && !f.place) f.place = 2;
    if (settled) return;
    settled = true;
    audio.sfx(won ? 'chime' : 'buzzer', 0.6);
    if (won) {
      announce('LAST FROG STANDING!', PALETTE.gold);
      apiRef?.record(Math.round(clock * 10) / 10);
      if (me.hitsTaken === 0) apiRef?.badge('m_pads');
    }
    sceneRef?.time.delayedCall(won ? 1600 : 1200, () => results(winner));
    sceneRef?.time.delayedCall(won ? 3600 : 3000, () => (won ? apiRef?.win() : apiRef?.lose()));
  }
}

// ------------------------------------------------------------------ the module

export const padBattles: MinigameModule = {
  id: 'padbattles',
  title: 'PAD BATTLES',
  rules: 'last frog standing on the lily pads',
  tutorial: {
    pitch: 'FOUR FROGS, 35 LILY PADS, DEEP WATER BETWEEN THEM. BE THE LAST ONE DRY.',
    steps: [
      { say: 'FOUR FROGS, EACH ON A LILY PAD, WITH WATER BETWEEN THE PADS. FALL IN AND YOU ARE OUT. LAST FROG STANDING WINS.', demo: 'pads.grid' },
      { say: 'YOU CAN WALK ABOUT ON YOUR OWN PAD. TO GET TO ANOTHER ONE, JUMP: SPACE JUMPS TO THE NEXT PAD THE WAY YOU FACE.', phone: 'YOU CAN WALK ABOUT ON YOUR OWN PAD. TO GET TO ANOTHER ONE, PRESS JUMP: IT JUMPS TO THE NEXT PAD THE WAY YOU FACE.', demo: 'pads.jump' },
      { say: 'A PAD ABOUT TO GO FLASHES, SHAKES AND CRACKS - THEN SINKS. JUMP OFF IT IN TIME. THEY GO FASTER AS IT GOES ON.', demo: 'pads.collapse' },
      { say: 'J WHIPS YOUR TONGUE OUT IN FRONT - EVEN ACROSS A GAP. WHOEVER IT CATCHES IS KNOCKED BACK, MAYBE INTO THE WATER.', phone: 'TONGUE WHIPS IT OUT IN FRONT - EVEN ACROSS A GAP. WHOEVER IT CATCHES IS KNOCKED BACK, MAYBE INTO THE WATER.', demo: 'pads.tongue' },
      { say: 'K IS A BODY BUMP: A SHORT CHARGE ACROSS YOUR PAD. AIM IT SO THEY GO OFF THE EDGE. FROGS ARE SOLID: YOU CAN SHOVE ONE OFF, TOO.', phone: 'BUMP IS A SHORT CHARGE ACROSS YOUR PAD. AIM IT SO THEY GO OFF THE EDGE. FROGS ARE SOLID: YOU CAN SHOVE ONE OFF, TOO.', demo: 'pads.bump' },
    ],
    objective: ['KNOCK THE OTHER THREE FROGS INTO THE WATER.', 'JUMP PAD TO PAD - A MISSED JUMP IS A SPLASH.', 'PADS CRUMBLE AND SINK: GET OFF THEM IN TIME.', 'LAST FROG STANDING WINS.'],
    controls: [
      ['W A S D', 'WALK / TURN'],
      ['ARROWS', 'WALK / TURN'],
      ['SPACE', 'JUMP TO THE NEXT PAD'],
      ['J', 'TONGUE WHIP'],
      ['K', 'BODY BUMP'],
    ],
  },
  touch: {
    stick: 'wasd',
    arrows: true,
    buttons: [
      { label: 'JUMP', key: 'SPACE', primary: true },
      { label: 'TONGUE', key: 'J' },
      { label: 'BUMP', key: 'K' },
    ],
  },

  inPlay() {
    return phase !== 'over';
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    sceneRef = scene;
    bits = [];
    chips = [];
    objs = [];
    clock = 0;
    waveIn = FIRST_WAVE;
    phase = 'count';
    countT = 2.6;
    settled = false;
    nextPlace = 4;
    CX = GAME_W / 2;
    CY = api.area.y + 14 + (api.area.h - 14) / 2 + 2;
    paintPond(scene, api.area.y, api.area.h);
    paintLight(scene, api.area.y, api.area.h);
    objs.push(scene.add.image(0, api.area.y, 'pads_pond').setOrigin(0, 0).setDepth(0));
    gfx = scene.add.graphics().setDepth(1);
    fxG = scene.add.graphics().setDepth(20);
    objs.push(scene.add.image(0, api.area.y, 'pads_light').setOrigin(0, 0).setDepth(30));
    for (let v = 0; v < 6; v++) paintPad(scene, `pads_leaf${v}`, 101 + v * 37);
    FROGS.forEach((spec, i) => paintFrog(scene, `pads_frog_${spec.kind}`, spec, 31 + i * 17));
    pads = [];
    let v = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const img = scene.add.image(0, 0, `pads_leaf${v++ % 6}`).setDepth(3);
        objs.push(img);
        pads.push({ c, r, x: padX(c), z: padZ(r), state: 'ok', t: 0, warn: 1.8, seed: Math.random() * 10, jx: 0, jy: 0, dip: 0, img });
      }
    // FAIR STARTS: the four corners' inner pads, the same distance from the middle
    const starts: Array<[number, number]> = [
      [1, 3],
      [5, 1],
      [5, 3],
      [1, 1],
    ];
    frogs = starts.map(([c, r], i) => makeFrog(i, c, r));
    for (const f of frogs) {
      f.shadow = scene.add.ellipse(0, 0, 12, 6, 0x000000, 0.38).setDepth(9);
      f.img = scene.add.image(0, 0, `pads_frog_${f.kind}`).setDepth(10);
      objs.push(f.shadow, f.img);
    }
    flies = Array.from({ length: 7 }, () => ({ x: 20 + Math.random() * (GAME_W - 40), y: api.area.y + 20 + Math.random() * (api.area.h - 30), a: Math.random() * 6, s: 0.6 + Math.random() }));
    hud = text(scene, GAME_W - 6, api.area.y + 4, '', PALETTE.cream).setOrigin(1, 0).setDepth(41);
    banner = centerText(scene, GAME_W / 2, api.area.y + 26, '', PALETTE.gold, 16).setDepth(45).setAlpha(0);
    drawChips();
    const kb = scene.input.keyboard!;
    const k = (n: string) => kb.addKey(n);
    keys = { up: [k('W'), k('UP')], down: [k('S'), k('DOWN')], left: [k('A'), k('LEFT')], right: [k('D'), k('RIGHT')] };
    kb.on('keydown-SPACE', () => act(player(), 'jump'));
    kb.on('keydown-J', () => act(player(), 'tongue'));
    kb.on('keydown-K', () => act(player(), 'bump'));
    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__pads = {
        frogs: () => frogs.map((f) => [f.name, +f.x.toFixed(2), +f.z.toFixed(2), f.jump ? 'AIR' : '', f.stun > 0 ? 'STUN' : '', f.alive ? '' : 'OUT'].join(' ')),
        state: () => ({ phase, clock, alive: frogs.map((f) => f.alive), places: frogs.map((f) => f.place), pads: pads.map((p) => p.state) }),
        whole: () => staysWhole(new Set()),
        dunk: (i: number) => fallIn(frogs[i], true),
        dunkAll: (ids: number[]) => ids.forEach((i) => fallIn(frogs[i], true)),
        act: (what: 'tongue' | 'bump' | 'jump') => act(player(), what),
        face: (a: number) => (player().face = a),
        put: (i: number, x: number, z: number) => Object.assign(frogs[i], { x, z, vx: 0, vz: 0 }),
        pad: (c: number, r: number) => ({ x: padX(c), z: padZ(r) }),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => delete (window as unknown as Record<string, unknown>).__pads);
    }
    announce('READY...', PALETTE.cream);
  },

  update(time: number, delta: number) {
    if (!gfx) return;
    const dt = Math.min(delta, 50) / 1000;
    const t = time / 1000;
    if (phase === 'count') {
      countT -= dt;
      if (countT <= 0) {
        phase = 'play';
        announce('GO!', PALETTE.gold);
        audio.sfx('bell_ding', 0.5);
      }
    } else {
      if (phase === 'play') {
        clock += dt;
        waveIn -= dt;
        if (waveIn <= 0) {
          wave();
          waveIn = Math.max(1.4, 3.8 - clock / 30);
        }
      }
      const me = player();
      let mx = 0;
      let mz = 0;
      if (keys.left.some((k) => k.isDown)) mx -= 1;
      if (keys.right.some((k) => k.isDown)) mx += 1;
      if (keys.up.some((k) => k.isDown)) mz -= 1;
      if (keys.down.some((k) => k.isDown)) mz += 1;
      const m = Math.hypot(mx, mz) || 1;
      if (phase !== 'play') mx = mz = 0;
      stepFrog(me, dt, mx / m, mz / m);
      for (const f of frogs.slice(1)) {
        const on = f.alive && phase === 'play';
        if (on && !f.jump) {
          think(f, dt);
          if (f.brain.want) {
            if (f.brain.want === 'jump' && f.brain.aim !== null) f.face = f.brain.aim;
            act(f, f.brain.want);
            f.brain.want = null;
          }
        }
        stepFrog(f, dt, on ? f.brain.mx : 0, on ? f.brain.mz : 0);
      }
      separate();
      stepPads(dt);
      settle();
    }
    stepBits(dt);
    draw(t);
    const cd = player().cds;
    hud?.setText(phase === 'play' ? `TONGUE ${cd.tongue > 0 ? '..' : 'OK'}  BUMP ${cd.bump > 0 ? '..' : 'OK'}` : '');
  },

  destroy() {
    for (const o of objs) o.destroy();
    objs = [];
    gfx = fxG = null;
    pads = [];
    frogs = [];
    bits = [];
    chips = [];
    flies = [];
    hud = banner = null;
    apiRef = null;
    sceneRef = null;
  },
};
