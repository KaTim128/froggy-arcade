/**
 * PAD BATTLES (log #98).  10 tokens in, 20 for a win, nothing for a loss --
 * the shell takes the price once and pays once.
 *
 * Four frogs on an 8 x 6 grid of floating lily pads, deep water all round:
 * you (MOSS) and three more, each played its own way -- BRUTE goes for
 * whoever is nearest, SHELL holds the middle and hits back, SLY waits for
 * someone to stand near the edge.  The pads give way: a pad due to go
 * flashes, shakes and cracks for a fair while before it crumbles and sinks,
 * waves of them come faster as the match goes on, and the grid is never
 * broken into pieces you cannot reach.  Off the pads is in the water and
 * out.  Last frog standing wins.
 *
 *   move    walk the pads           jump    clear a gap of one pad
 *   tongue  a whip in front of you: knocks back what it catches
 *   bump    a short charge: whoever you hit goes flying
 *
 * IN 2D (user, 28 Oct): the pond seen from above and a little in front, so
 * the pads are ellipses and a jumping frog rises off its own shadow.  The
 * game itself is worked out on the flat (x, z) of the pond, in pad units,
 * and only drawn at an angle.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

// ------------------------------------------------------------------ the pond

const COLS = 8;
const ROWS = 6;
const GAP = 1.7;
const PAD_R = 0.92;
/** How far off a pad's centre still counts as standing on it (the pads touch their neighbours). */
const STAND = 1.0;
/** The little gap where four pads meet holds you up while three of them still float. */
const CORNER = 1.45;
const padX = (c: number): number => (c - (COLS - 1) / 2) * GAP;
const padZ = (r: number): number => (r - (ROWS - 1) / 2) * GAP;

/** The view: pixels to a pad unit, and how much the far side is squashed. */
const S = 13.5;
const TILT = 0.8;

// ------------------------------------------------------------------ the rules

const WALK = 3.1;
const FROG_R = 0.42;
const JUMP_S = 0.55;
const JUMP_SPEED = 4.6;
const CD = { tongue: 1.1, bump: 1.7, jump: 0.8 };
const TONGUE_LEN = 2.1;
const TONGUE_S = 0.32;
const BUMP_S = 0.22;
const BUMP_SPEED = 8.5;
const KNOCK = 7.2;
const FRICTION = 5;
const FIRST_WAVE = 4;

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
  /** Where its notch points, its little turn, its bob. */
  notch: number;
  seed: number;
  /** A shake this frame, in px. */
  jx: number;
  jy: number;
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
  air: number;
  alive: boolean;
  sinking: number;
  stun: number;
  cds: { tongue: number; bump: number; jump: number };
  tongue: number;
  tongueHit: boolean;
  bump: number;
  hop: number;
  place: number;
  outAt: number;
  hitsTaken: number;
  brain: { think: number; mx: number; mz: number; want: 'tongue' | 'bump' | 'jump' | null };
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
let waterG: Phaser.GameObjects.Graphics | null = null;
let CX = GAME_W / 2;
let CY = 100;
let pads: Pad[] = [];
let frogs: Frog[] = [];
let bits: Bit[] = [];
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

const player = (): Frog => frogs[0];
/** The pond (x, z, height) on the screen. */
const sx = (x: number): number => CX + x * S;
const sy = (z: number, h = 0): number => CY + z * S * TILT - h * S;

// ------------------------------------------------------------------ the frogs

const FROGS: Array<{ kind: Kind; name: string; col: number; dark: number; light: number }> = [
  { kind: 'player', name: 'MOSS', col: 0x4ac85a, dark: 0x22783a, light: 0xa8f0a0 },
  { kind: 'brute', name: 'BRUTE', col: 0xd8463a, dark: 0x7a1e1a, light: 0xf8a088 },
  { kind: 'shell', name: 'SHELL', col: 0x3a7ad8, dark: 0x1a3a7a, light: 0xa0c8ff },
  { kind: 'sly', name: 'SLY', col: 0xe8c43a, dark: 0x8a6a10, light: 0xfff0a0 },
];

function makeFrog(i: number, c: number, r: number): Frog {
  const spec = FROGS[i];
  const x = padX(c);
  const z = padZ(r);
  return {
    ...spec, x, z, y: 0, vx: 0, vz: 0, face: Math.atan2(-x, -z), air: 0, alive: true, sinking: 0, stun: 0,
    cds: { tongue: 0.5, bump: 0.5, jump: 0 }, tongue: 0, tongueHit: false, bump: 0, hop: 0, place: 0, outAt: 0, hitsTaken: 0,
    brain: { think: Math.random() * 0.3, mx: 0, mz: 0, want: null },
  };
}

// ------------------------------------------------------------------ the ground

const live = (p: Pad): boolean => p.state !== 'gone' && !(p.state === 'sink' && p.t > 0.25);

function padAt(x: number, z: number): Pad | null {
  let best: Pad | null = null;
  let bd = STAND;
  for (const p of pads) {
    if (!live(p)) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

/** Is there pad under (x, z) at all -- on one, or on the seam where they meet? */
function supported(x: number, z: number): boolean {
  if (padAt(x, z)) return true;
  let n = 0;
  for (const p of pads) if (live(p) && Math.hypot(p.x - x, p.z - z) < CORNER) n++;
  return n >= 3;
}

const safeAt = (x: number, z: number): boolean => {
  const p = padAt(x, z);
  return !!p && p.state === 'ok';
};

const neighbours = (p: Pad, ok: Set<Pad>): Pad[] => pads.filter((q) => q !== p && ok.has(q) && Math.abs(q.c - p.c) <= 1 && Math.abs(q.r - p.r) <= 1);

/** Would the 'ok' pads still be one piece without these? */
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
 * still in, and every warned pad has a safe one beside it to step onto.
 */
function wave(): void {
  const alive = frogs.filter((f) => f.alive).length;
  const n = Math.min(4, 1 + Math.floor(clock / 22));
  const warn = Math.max(1.0, 1.9 - clock / 70);
  const picked = new Set<Pad>();
  for (let k = 0; k < n; k++) {
    const cand = pads.filter((p) => p.state === 'ok' && !picked.has(p));
    if (cand.length <= alive + 3) break;
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
  bits.push({ x, z, h: 0, vx: 0, vz: 0, vh: 0, t: 0, life: big ? 1 : 0.6, col: 0xd8f4ff, ring: true, big });
  for (let i = 0; i < (big ? 14 : 6); i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.8 + Math.random() * (big ? 2.2 : 1.2);
    bits.push({ x, z, h: 0.05, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vh: 2 + Math.random() * (big ? 3 : 1.5), t: 0, life: 0.9, col: 0xbfe8ff });
  }
  audio.sfx('water_plip', big ? 0.7 : 0.3);
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
    if (o === f || !o.alive || o.air > 0) continue;
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

function act(f: Frog, what: 'tongue' | 'bump' | 'jump'): void {
  if (!f.alive || f.stun > 0 || f.cds[what] > 0 || f.air > 0 || phase !== 'play') return;
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
    f.air = JUMP_S;
    if (Math.hypot(f.vx, f.vz) < JUMP_SPEED) {
      f.vx = Math.sin(f.face) * JUMP_SPEED;
      f.vz = Math.cos(f.face) * JUMP_SPEED;
    }
    audio.sfx('hop_wet', 0.35);
  }
}

// ------------------------------------------------------------------ the AI

/**
 * Three ways to play.  BRUTE chases the nearest frog and hits it with
 * whatever is ready.  SHELL keeps to the middle of what is left and only
 * fights what comes to it.  SLY looks for a frog with water behind it and
 * goes for that one, lining up so the hit sends it in.  All of them get off
 * a pad that is going, and jump a gap when walking will not do.
 */
function think(f: Frog, dt: number): void {
  const b = f.brain;
  b.think -= dt;
  if (b.think > 0) return;
  b.think = 0.18 + Math.random() * 0.14;
  b.want = null;
  const others = frogs.filter((o) => o !== f && o.alive);
  const ok = pads.filter((p) => p.state === 'ok');
  const here = padAt(f.x, f.z);
  const centre = ok.reduce((a, p) => ({ x: a.x + p.x / ok.length, z: a.z + p.z / ok.length }), { x: 0, z: 0 });
  let gx = f.x;
  let gz = f.z;
  let target: Frog | null = null;
  if (!here || here.state !== 'ok') {
    let best: Pad | null = null;
    let bd = Infinity;
    for (const p of ok) {
      const d = Math.hypot(p.x - f.x, p.z - f.z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (best) {
      gx = best.x;
      gz = best.z;
      if (bd > GAP * 1.1 && bd < GAP * 2.3) b.want = 'jump';
    }
  } else if (f.kind === 'brute') {
    target = others.sort((a, c) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(c.x - f.x, c.z - f.z))[0] ?? null;
  } else if (f.kind === 'shell') {
    gx = centre.x;
    gz = centre.z;
    target = others.find((o) => Math.hypot(o.x - f.x, o.z - f.z) < 2.2) ?? null;
  } else {
    const exposed = (o: Frog): number => {
      let w = 0;
      for (let a = 0; a < 8; a++) if (!safeAt(o.x + Math.cos(a * 0.785) * GAP, o.z + Math.sin(a * 0.785) * GAP)) w++;
      return w;
    };
    target = others.sort((a, c) => exposed(c) - exposed(a))[0] ?? null;
    if (target && exposed(target) < 2) {
      gx = centre.x;
      gz = centre.z;
      target = Math.hypot(target.x - f.x, target.z - f.z) < 1.8 ? target : null;
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
      gx = target.x + (cx / cm) * 1.6;
      gz = target.z + (cz / cm) * 1.6;
    } else {
      gx = target.x - (dx / d) * 1.4;
      gz = target.z - (dz / d) * 1.4;
    }
    const facing = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dx, dz) - f.face)) < 0.45;
    if (facing && d < TONGUE_LEN * 0.9 && f.cds.tongue <= 0 && Math.random() < (f.kind === 'brute' ? 0.8 : 0.55)) b.want = 'tongue';
    else if (facing && d < 1.5 && f.cds.bump <= 0 && Math.random() < (f.kind === 'brute' ? 0.7 : 0.4)) b.want = 'bump';
    if (d < 2.2 && !b.want) {
      gx = f.x + (dx / d) * 0.4;
      gz = f.z + (dz / d) * 0.4;
    }
  }
  const mx = gx - f.x;
  const mz = gz - f.z;
  const m = Math.hypot(mx, mz);
  b.mx = m > 0.15 ? mx / m : 0;
  b.mz = m > 0.15 ? mz / m : 0;
  // never walk off the edge on purpose
  if (b.want !== 'jump' && (b.mx || b.mz) && (!supported(f.x + b.mx * 0.4, f.z + b.mz * 0.4) || !supported(f.x + b.mx * 0.8, f.z + b.mz * 0.8))) {
    const land = padAt(f.x + b.mx * 2.4, f.z + b.mz * 2.4);
    if (land && land.state === 'ok' && f.cds.jump <= 0) b.want = 'jump';
    else b.mx = b.mz = 0;
  }
}

// ------------------------------------------------------------------ stepping

function fallIn(f: Frog): void {
  if (!f.alive) return;
  f.alive = false;
  f.sinking = 0;
  f.outAt = clock;
  splash(f.x, f.z, true);
}

function stepFrog(f: Frog, dt: number, mx: number, mz: number): void {
  if (!f.alive) {
    f.sinking += dt;
    return;
  }
  for (const k of ['tongue', 'bump', 'jump'] as const) f.cds[k] = Math.max(0, f.cds[k] - dt);
  f.stun = Math.max(0, f.stun - dt);
  const free = f.stun <= 0 && f.bump <= 0;
  if (f.air > 0) {
    f.air -= dt;
    f.y = Math.sin((1 - Math.max(0, f.air) / JUMP_S) * Math.PI) * 0.9;
    if (f.air <= 0) {
      f.y = 0;
      f.vx *= 0.3;
      f.vz *= 0.3;
      if (supported(f.x, f.z)) splash(f.x, f.z, false);
    }
  } else if (free) {
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
      if (o === f || !o.alive || o.air > 0) continue;
      if (Math.hypot(o.x - f.x, o.z - f.z) < FROG_R * 2.1) {
        knock(o, o.x - f.x, o.z - f.z, KNOCK * 1.1, f);
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
  if (f.air <= 0 && !supported(f.x, f.z)) fallIn(f);
}

function separate(): void {
  for (let i = 0; i < frogs.length; i++) {
    for (let j = i + 1; j < frogs.length; j++) {
      const a = frogs[i];
      const b = frogs[j];
      if (!a.alive || !b.alive || a.air > 0 || b.air > 0) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d > 0 && d < FROG_R * 2) {
        const push = (FROG_R * 2 - d) / 2;
        a.x -= (dx / d) * push;
        a.z -= (dz / d) * push;
        b.x += (dx / d) * push;
        b.z += (dz / d) * push;
      }
    }
  }
}

function stepPads(dt: number): void {
  for (const p of pads) {
    p.jx = p.jy = 0;
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
    if (!b.ring) {
      b.vh -= 9 * dt;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.h += b.vh * dt;
      if (b.h < -0.05) b.t = b.life;
    }
  }
  bits = bits.filter((b) => b.t < b.life);
}

// ------------------------------------------------------------------ drawing

/** The water, once: deep at the edges, lighter where the light falls, streaked. */
function paintWater(g: Phaser.GameObjects.Graphics, top: number, h: number): void {
  g.clear();
  g.fillStyle(0x0c2a36, 1).fillRect(0, top, GAME_W, h);
  g.fillStyle(0x12384a, 1).fillEllipse(CX, CY, 250, 150);
  g.fillStyle(0x174456, 1).fillEllipse(CX - 20, CY - 10, 170, 96);
  const rnd = new Phaser.Math.RandomDataGenerator(['pond']);
  for (let i = 0; i < 180; i++) {
    g.fillStyle(i % 3 ? 0x1e5468 : 0x5a9ab0, i % 3 ? 0.5 : 0.35).fillRect(rnd.between(0, GAME_W), rnd.between(top, top + h), rnd.between(2, 7), 1);
  }
  // reeds round the edge, for the pond's banks
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2;
    const x = CX + Math.cos(a) * (128 + rnd.between(0, 14));
    const y = CY + Math.sin(a) * (74 + rnd.between(0, 8));
    if (y < top + 2) continue;
    g.fillStyle(0x2a4a1e, 1).fillRect(x, y - 8, 1, 9);
    g.fillStyle(0x3e6a2a, 1).fillRect(x + 1, y - 6, 1, 7);
    if (i % 3 === 0) g.fillStyle(0x6a4a24, 1).fillRect(x, y - 10, 2, 3);
  }
}

function drawPad(g: Phaser.GameObjects.Graphics, p: Pad, t: number): void {
  if (p.state === 'gone') return;
  const sink = p.state === 'sink' ? p.t / 0.9 : 0;
  const bob = p.state === 'ok' ? Math.sin(t * 1.6 + p.seed) * 0.4 : 0;
  const x = sx(p.x) + p.jx;
  const y = sy(p.z) + p.jy + bob + sink * 3;
  const rx = PAD_R * S * (1 - sink * 0.5);
  const ry = rx * TILT;
  const k = p.state === 'warn' ? p.t / p.warn : 0;
  const flash = p.state === 'warn' && Math.sin(p.t * (10 + k * 26)) > 0;
  const base = p.state === 'sink' ? 0x5a6a3a : flash ? (k > 0.6 ? 0xff5a3a : 0xffb040) : 0x3e9a3e;
  const a = 1 - sink * 0.85;
  // a shadow on the water, the rim, the leaf with its notch, the light side
  g.fillStyle(0x061a22, 0.45 * a).fillEllipse(x + 1.5, y + 2, rx * 2, ry * 2);
  g.fillStyle(0x1e4e22, a).fillEllipse(x, y + 1, rx * 2, ry * 2);
  g.fillStyle(base, a);
  g.slice(x, y, rx, p.notch + 0.24, p.notch - 0.24 + Math.PI * 2, false);
  g.fillPath();
  g.fillStyle(0x6ac85a, 0.5 * a).fillEllipse(x - rx * 0.25, y - ry * 0.3, rx * 0.9, ry * 0.8);
  // the veins, from the middle out
  g.lineStyle(1, flash ? 0xffe0a0 : 0x8ad87a, 0.5 * a);
  for (let i = 0; i < 7; i++) {
    const va = p.notch + 0.6 + i * 0.75;
    g.lineBetween(x, y, x + Math.cos(va) * rx * 0.85, y + Math.sin(va) * ry * 0.85);
  }
  // cracks, from half way through its warning
  if (k > 0.5 || sink) {
    g.lineStyle(1, 0x2a1408, 0.9 * a);
    for (let i = 0; i < 3; i++) {
      const ca = p.seed * 3 + i * 2.1;
      const mx = x + Math.cos(ca) * rx * 0.45;
      const my = y + Math.sin(ca) * ry * 0.45;
      g.lineBetween(x, y, mx, my);
      g.lineBetween(mx, my, mx + Math.cos(ca + 0.6) * rx * 0.35, my + Math.sin(ca + 0.6) * ry * 0.35);
    }
  }
}

function drawFrog(g: Phaser.GameObjects.Graphics, f: Frog, t: number): void {
  if (!f.alive && f.sinking > 1) return;
  const under = !f.alive ? Math.min(1, f.sinking) : 0;
  const x = sx(f.x);
  const ground = sy(f.z);
  const lift = f.alive && f.air <= 0 ? Math.abs(Math.sin(f.hop)) * 0.06 : 0;
  const y = sy(f.z, f.y + lift) + under * 6;
  const a = 1 - under;
  const fx = Math.sin(f.face);
  const fz = Math.cos(f.face) * TILT;
  // the shadow stays on the pad as it jumps
  if (f.alive) g.fillStyle(0x000000, 0.35).fillEllipse(x, ground + 2, 11 - f.y * 3, 5 - f.y);
  const stretch = f.air > 0 ? 1.15 : 1 + Math.sin(t * 3 + f.col) * 0.03;
  const wob = f.stun > 0 ? Math.sin(t * 40) * 1.2 : 0;
  const bw = 11 / Math.sqrt(stretch);
  const bh = 9 * stretch;
  // back legs folded at the sides, then the body, belly-side light
  g.fillStyle(f.dark, a).fillEllipse(x - 5 + wob, y + 1, 5, 6).fillEllipse(x + 5 + wob, y + 1, 5, 6);
  g.fillStyle(f.dark, a).fillEllipse(x + wob, y - 3, bw + 1.5, bh + 1.5);
  g.fillStyle(f.col, a).fillEllipse(x + wob, y - 3, bw, bh);
  g.fillStyle(f.light, 0.55 * a).fillEllipse(x + wob + fx * 1.5, y - 2 + fz * 1.5, bw * 0.55, bh * 0.45);
  // its mark: a leaf cap, horns, a shell, a crest
  if (f.kind === 'player') g.fillStyle(0x2a8a2a, a).fillTriangle(x - 2, y - 7, x + 3, y - 7, x + 3, y - 11);
  else if (f.kind === 'brute') {
    g.fillStyle(0xf0e0c0, a).fillTriangle(x - 5, y - 6, x - 3, y - 6, x - 5, y - 10);
    g.fillTriangle(x + 5, y - 6, x + 3, y - 6, x + 5, y - 10);
  } else if (f.kind === 'shell') g.fillStyle(0x8a6a3a, a).fillEllipse(x - fx * 2, y - 5 - fz * 2, 8, 5);
  else g.fillStyle(0xff7a2a, a).fillRect(x - 0.5, y - 9, 1.5, 6);
  // eyes up on the front, white with a black pupil, turned the way it faces
  const ex = fx * 3;
  const ey = fz * 2.5 - 5;
  for (const s of [-1, 1]) {
    const px = x + wob + ex + Math.cos(f.face) * s * 2.6;
    const py = y + ey - Math.sin(f.face) * s * 0.8;
    g.fillStyle(0xffffff, a).fillCircle(px, py, 1.8);
    g.fillStyle(0x0a0a10, a).fillCircle(px + fx * 0.6, py + fz * 0.6, 0.9);
  }
  // the tongue, out the way it faces
  if (f.tongue > 0 && f.alive) {
    const len = TONGUE_LEN * Math.sin((1 - f.tongue / TONGUE_S) * Math.PI) * S;
    const mx = x + fx * 4;
    const my = y - 2 + fz * 4;
    g.lineStyle(2, 0xff5a8a, 1).lineBetween(mx, my, mx + fx * len, my + fz * len);
    g.fillStyle(0xff8ab0, 1).fillCircle(mx + fx * len, my + fz * len, 1.8);
  }
}

function drawBits(g: Phaser.GameObjects.Graphics): void {
  for (const b of bits) {
    const k = b.t / b.life;
    if (b.ring) {
      const r = (b.big ? 6 : 4) + k * (b.big ? 22 : 12);
      g.lineStyle(1, b.col, 0.8 * (1 - k)).strokeEllipse(sx(b.x), sy(b.z), r * 2, r * 2 * TILT);
    } else g.fillStyle(b.col, 1 - k * 0.5).fillRect(sx(b.x) - 0.5, sy(b.z, b.h) - 0.5, 1.5, 1.5);
  }
}

function draw(t: number): void {
  const g = gfx;
  if (!g) return;
  g.clear();
  // the far side first: pads, then everything on them by depth
  for (const p of pads) drawPad(g, p, t);
  const order = [...frogs].sort((a, b) => a.z - b.z);
  for (const f of order) drawFrog(g, f, t);
  drawBits(g);
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
    chips.push(s.add.rectangle(x, y, 37, 10, 0x0a0c16, 0.75).setOrigin(0, 0).setStrokeStyle(1, f.alive ? f.col : 0x3a3a48).setDepth(20));
    chips.push(text(s, x + 3, y + 1, f.name, f.alive ? PALETTE.cream : 0x5a5a68).setDepth(21));
    if (!f.alive) chips.push(s.add.rectangle(x + 2, y + 5, 33, 1, 0xff5a5a).setOrigin(0, 0).setDepth(22));
  });
}

const placeName = (n: number): string => ['1ST', '2ND', '3RD', '4TH'][n - 1] ?? `${n}TH`;

function results(winner: Frog | null): void {
  const s = sceneRef;
  const api = apiRef;
  if (!s || !api) return;
  const order = [...frogs].sort((a, b) => a.place - b.place);
  chips.push(s.add.rectangle(GAME_W / 2, api.area.y + 82, 150, 70, PALETTE.ink, 0.94).setStrokeStyle(1, PALETTE.gold).setDepth(30));
  chips.push(centerText(s, GAME_W / 2, api.area.y + 54, winner ? `${winner.name} WINS!` : 'NOBODY IS LEFT!', winner === player() ? PALETTE.gold : PALETTE.cream).setDepth(31));
  order.forEach((f, i) => chips.push(text(s, GAME_W / 2 - 40, api.area.y + 66 + i * 9, `${placeName(f.place)}  ${f.name}`, f === player() ? PALETTE.gold : PALETTE.ash).setDepth(31)));
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
    pitch: 'FOUR FROGS, 48 LILY PADS, DEEP WATER. BE THE LAST ONE DRY.',
    steps: [
      { say: 'FOUR FROGS ON THE PADS. OFF A PAD IS IN THE WATER - AND OUT. LAST FROG STANDING WINS.', demo: 'pads.grid' },
      { say: 'A PAD ABOUT TO GO FLASHES, SHAKES AND CRACKS - THEN SINKS. GET OFF IT. THEY GO FASTER AS IT GOES ON.', demo: 'pads.collapse' },
      { say: 'J WHIPS YOUR TONGUE OUT IN FRONT: WHOEVER IT CATCHES IS KNOCKED BACK.', phone: 'TONGUE WHIPS IT OUT IN FRONT: WHOEVER IT CATCHES IS KNOCKED BACK.', demo: 'pads.tongue' },
      { say: 'K IS A BODY BUMP: A SHORT CHARGE THAT SENDS THEM FLYING. AIM IT AT THE WATER.', phone: 'BUMP IS A SHORT CHARGE THAT SENDS THEM FLYING. AIM IT AT THE WATER.', demo: 'pads.bump' },
      { say: 'SPACE JUMPS A GAP OF ONE PAD. W A S D OR THE ARROWS WALK.', phone: 'JUMP CLEARS A GAP OF ONE PAD. THE STICK WALKS.', demo: 'pads.jump' },
    ],
    objective: ['KNOCK THE OTHER THREE FROGS INTO THE WATER.', 'PADS CRUMBLE AND SINK: KEEP ON THE SAFE ONES.', 'LAST FROG STANDING WINS.'],
    controls: [
      ['W A S D', 'WALK'],
      ['ARROWS', 'WALK'],
      ['SPACE', 'JUMP'],
      ['J', 'TONGUE WHIP'],
      ['K', 'BODY BUMP'],
    ],
  },
  touch: {
    stick: 'wasd',
    arrows: true,
    buttons: [
      { label: 'TONGUE', key: 'J', primary: true },
      { label: 'BUMP', key: 'K' },
      { label: 'JUMP', key: 'SPACE' },
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
    clock = 0;
    waveIn = FIRST_WAVE;
    phase = 'count';
    countT = 2.6;
    settled = false;
    nextPlace = 4;
    CX = GAME_W / 2;
    CY = api.area.y + 88;
    waterG = scene.add.graphics().setDepth(0);
    paintWater(waterG, api.area.y, api.area.h);
    gfx = scene.add.graphics().setDepth(2);
    pads = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) pads.push({ c, r, x: padX(c), z: padZ(r), state: 'ok', t: 0, warn: 1.8, notch: Math.random() * Math.PI * 2, seed: Math.random() * 10, jx: 0, jy: 0 });
    // FAIR STARTS: the four corners' inner pads, the same distance from the middle
    const starts: Array<[number, number]> = [
      [1, 4],
      [6, 1],
      [6, 4],
      [1, 1],
    ];
    frogs = starts.map(([c, r], i) => makeFrog(i, c, r));
    hud = text(scene, GAME_W - 6, api.area.y + 4, '', PALETTE.cream).setOrigin(1, 0).setDepth(21);
    banner = centerText(scene, GAME_W / 2, api.area.y + 26, '', PALETTE.gold, 16).setDepth(25).setAlpha(0);
    drawChips();
    const kb = scene.input.keyboard!;
    const k = (n: string) => kb.addKey(n);
    keys = { up: [k('W'), k('UP')], down: [k('S'), k('DOWN')], left: [k('A'), k('LEFT')], right: [k('D'), k('RIGHT')] };
    kb.on('keydown-SPACE', () => act(player(), 'jump'));
    kb.on('keydown-J', () => act(player(), 'tongue'));
    kb.on('keydown-K', () => act(player(), 'bump'));
    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__pads = {
        frogs: () => frogs.map((f) => [f.name, +f.x.toFixed(2), +f.z.toFixed(2), f.air > 0 ? 'AIR' : '', f.stun > 0 ? 'STUN' : '', f.alive ? '' : 'OUT'].join(' ')),
        state: () => ({ phase, clock, alive: frogs.map((f) => f.alive), places: frogs.map((f) => f.place), pads: pads.map((p) => p.state) }),
        whole: () => staysWhole(new Set()),
        dunk: (i: number) => fallIn(frogs[i]),
        dunkAll: (ids: number[]) => ids.forEach((i) => fallIn(frogs[i])),
        act: (what: 'tongue' | 'bump' | 'jump') => act(player(), what),
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
          waveIn = Math.max(1.1, 3.4 - clock / 30);
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
        if (on) {
          think(f, dt);
          if (f.brain.want) {
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
    gfx = waterG = null;
    pads = [];
    frogs = [];
    bits = [];
    chips = [];
    hud = banner = null;
    apiRef = null;
    sceneRef = null;
  },
};
