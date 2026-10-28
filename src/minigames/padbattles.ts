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
 * THE 3D is three.js, drawn OFF the page into the session's one renderer
 * (render/threeStage `borrowRenderer`) and copied into a Phaser texture in
 * the game's area every frame -- so the cabinet's bar, its pause and the
 * phone's buttons all sit over it as they do over every other game.  The
 * picture is drawn at the game's own pixel size, like the rest of it.
 */

import Phaser from 'phaser';
import * as THREE from 'three';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import { borrowRenderer } from '../render/threeStage';
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
/** The first wave, and how the waves quicken: warning, and the time between. */
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
  /** How long its warning lasts (it is set when the warning starts). */
  warn: number;
  mesh: THREE.Group;
  top: THREE.MeshStandardMaterial;
  seed: number;
}

interface Frog {
  kind: Kind;
  name: string;
  col: number;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  face: number;
  air: number;
  alive: boolean;
  /** Falling in: seconds into the splash (the mesh goes under). */
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
  mesh: THREE.Group;
  tongueMesh: THREE.Mesh;
}

interface Splash {
  mesh: THREE.Mesh;
  t: number;
  life: number;
  vx?: number;
  vy?: number;
  vz?: number;
  ring?: boolean;
}

// ------------------------------------------------------------------ module state

let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let world: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let tex: Phaser.Textures.CanvasTexture | null = null;
let picture: Phaser.GameObjects.Image | null = null;
let texKey = '';
let W = GAME_W;
let H = 162;
let pads: Pad[] = [];
let frogs: Frog[] = [];
let splashes: Splash[] = [];
let water: THREE.Mesh | null = null;
let waterTex: THREE.CanvasTexture | null = null;
let clock = 0;
let waveIn = FIRST_WAVE;
let phase: 'count' | 'play' | 'over' = 'count';
let countT = 0;
let settled = false;
let keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
let hud: Phaser.GameObjects.BitmapText | null = null;
let chips: Phaser.GameObjects.GameObject[] = [];
let banner: Phaser.GameObjects.BitmapText | null = null;
let disposables: Array<{ dispose(): void }> = [];
let nextPlace = 4;

const player = (): Frog => frogs[0];
const own = <T extends { dispose(): void }>(x: T): T => (disposables.push(x), x);

// ------------------------------------------------------------------ textures

function canvasTex(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return own(t);
}

/** A lily pad from above: a disc with its notch, veins from the middle, a darker rim. */
function padTexture(cracked: boolean): THREE.CanvasTexture {
  return canvasTex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grd.addColorStop(0, '#6ac85a');
    grd.addColorStop(0.75, '#3e9a3e');
    grd.addColorStop(1, '#22602a');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(190,240,150,0.55)';
    g.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.beginPath();
      g.moveTo(32, 32);
      g.quadraticCurveTo(32 + Math.cos(a + 0.25) * 16, 32 + Math.sin(a + 0.25) * 16, 32 + Math.cos(a) * 31, 32 + Math.sin(a) * 31);
      g.stroke();
    }
    for (let i = 0; i < 90; i++) {
      g.fillStyle = i % 2 ? 'rgba(30,80,30,0.35)' : 'rgba(160,220,120,0.3)';
      g.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
    }
    if (cracked) {
      g.strokeStyle = 'rgba(40,20,10,0.9)';
      g.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        let x = 32;
        let y = 32;
        g.beginPath();
        g.moveTo(x, y);
        const a = Math.random() * Math.PI * 2;
        for (let k = 0; k < 5; k++) {
          x += Math.cos(a + (Math.random() - 0.5)) * 6;
          y += Math.sin(a + (Math.random() - 0.5)) * 6;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    }
  });
}

function waterTexture(): THREE.CanvasTexture {
  const t = canvasTex(128, 128, (g) => {
    g.fillStyle = '#123848';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      g.fillStyle = i % 3 ? 'rgba(40,110,130,0.5)' : 'rgba(150,220,230,0.35)';
      g.fillRect(x, y, 2 + Math.random() * 6, 1);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  return t;
}

/** A frog's skin: its colour, lighter belly-side, and its own marking. */
function frogTexture(col: number, mark: 'spots' | 'stripes' | 'warts' | 'plain'): THREE.CanvasTexture {
  return canvasTex(32, 32, (g) => {
    const c = new THREE.Color(col);
    g.fillStyle = `#${c.getHexString()}`;
    g.fillRect(0, 0, 32, 32);
    const dark = `#${c.clone().multiplyScalar(0.55).getHexString()}`;
    const light = `#${c.clone().lerp(new THREE.Color(0xffffff), 0.35).getHexString()}`;
    g.fillStyle = light;
    g.fillRect(0, 20, 32, 12);
    g.fillStyle = dark;
    if (mark === 'spots') for (let i = 0; i < 9; i++) g.fillRect((i * 11) % 30, (i * 7) % 18, 3, 3);
    if (mark === 'stripes') for (let i = 0; i < 5; i++) g.fillRect(i * 7, 0, 2, 20);
    if (mark === 'warts') for (let i = 0; i < 16; i++) g.fillRect((i * 13) % 31, (i * 5) % 19, 2, 2);
  });
}

// ------------------------------------------------------------------ building

function buildPad(c: number, r: number, padMap: THREE.Texture): Pad {
  const group = new THREE.Group();
  // the leaf: a disc with a notch cut in, a thin rim under it
  const notch = 0.45;
  const start = Math.random() * Math.PI * 2;
  const geo = own(new THREE.CircleGeometry(PAD_R, 24, start + notch / 2, Math.PI * 2 - notch));
  geo.rotateX(-Math.PI / 2);
  const top = own(new THREE.MeshStandardMaterial({ map: padMap, roughness: 0.55, metalness: 0.02 }));
  const leaf = new THREE.Mesh(geo, top);
  leaf.position.y = 0.06;
  group.add(leaf);
  const rimGeo = own(new THREE.CylinderGeometry(PAD_R * 0.98, PAD_R * 1.02, 0.06, 24, 1, false, start + notch / 2, Math.PI * 2 - notch));
  const rim = new THREE.Mesh(rimGeo, own(new THREE.MeshStandardMaterial({ color: 0x1e4e22, roughness: 0.8 })));
  rim.position.y = 0.03;
  group.add(rim);
  group.position.set(padX(c), 0, padZ(r));
  group.rotation.y = (Math.random() - 0.5) * 0.2;
  world!.add(group);
  return { c, r, x: padX(c), z: padZ(r), state: 'ok', t: 0, warn: 1.8, mesh: group, top, seed: Math.random() * 10 };
}

const FROGS: Array<{ kind: Kind; name: string; col: number; mark: 'spots' | 'stripes' | 'warts' | 'plain' }> = [
  { kind: 'player', name: 'MOSS', col: 0x4ac85a, mark: 'spots' },
  { kind: 'brute', name: 'BRUTE', col: 0xd8463a, mark: 'warts' },
  { kind: 'shell', name: 'SHELL', col: 0x3a7ad8, mark: 'plain' },
  { kind: 'sly', name: 'SLY', col: 0xe8c43a, mark: 'stripes' },
];

function buildFrog(i: number, c: number, r: number): Frog {
  const spec = FROGS[i];
  const g = new THREE.Group();
  const skin = own(new THREE.MeshStandardMaterial({ map: frogTexture(spec.col, spec.mark), roughness: 0.5 }));
  const sphere = own(new THREE.SphereGeometry(1, 16, 12));
  const body = new THREE.Mesh(sphere, skin);
  body.scale.set(0.42, 0.3, 0.5);
  body.position.y = 0.32;
  g.add(body);
  // eyes up top at the front, white with a black pupil
  const white = own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
  const black = own(new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.2 }));
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(sphere, white);
    eye.scale.setScalar(0.13);
    eye.position.set(s * 0.18, 0.58, 0.28);
    g.add(eye);
    const pupil = new THREE.Mesh(sphere, black);
    pupil.scale.setScalar(0.065);
    pupil.position.set(s * 0.19, 0.6, 0.39);
    g.add(pupil);
    // the back legs, folded at the sides
    const leg = new THREE.Mesh(sphere, skin);
    leg.scale.set(0.14, 0.11, 0.26);
    leg.position.set(s * 0.36, 0.14, -0.12);
    g.add(leg);
    const fore = new THREE.Mesh(sphere, skin);
    fore.scale.set(0.08, 0.08, 0.12);
    fore.position.set(s * 0.24, 0.1, 0.3);
    g.add(fore);
  }
  // each one its own: a leaf cap, horns, a shell, a crest
  const extra = own(new THREE.MeshStandardMaterial({ color: spec.kind === 'player' ? 0x2a8a2a : spec.kind === 'brute' ? 0xf0e0c0 : spec.kind === 'shell' ? 0x8a6a3a : 0xff7a2a, roughness: 0.6 }));
  if (spec.kind === 'player') {
    const leaf = new THREE.Mesh(own(new THREE.ConeGeometry(0.16, 0.3, 6)), extra);
    leaf.position.set(0, 0.7, 0.05);
    leaf.rotation.z = 0.5;
    g.add(leaf);
  } else if (spec.kind === 'brute') {
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(own(new THREE.ConeGeometry(0.06, 0.24, 6)), extra);
      horn.position.set(s * 0.28, 0.66, 0.12);
      horn.rotation.z = -s * 0.5;
      g.add(horn);
    }
  } else if (spec.kind === 'shell') {
    const shell = new THREE.Mesh(sphere, extra);
    shell.scale.set(0.36, 0.2, 0.38);
    shell.position.set(0, 0.5, -0.12);
    g.add(shell);
  } else {
    const crest = new THREE.Mesh(own(new THREE.BoxGeometry(0.05, 0.16, 0.42)), extra);
    crest.position.set(0, 0.6, -0.02);
    g.add(crest);
  }
  // the tongue: hidden until it whips out
  const tongueMat = own(new THREE.MeshStandardMaterial({ color: 0xff5a8a, roughness: 0.4, emissive: 0x401020 }));
  const tongueGeo = own(new THREE.CylinderGeometry(0.05, 0.05, 1, 6));
  tongueGeo.rotateX(Math.PI / 2);
  tongueGeo.translate(0, 0, 0.5);
  const tongue = new THREE.Mesh(tongueGeo, tongueMat);
  tongue.position.set(0, 0.3, 0.4);
  tongue.visible = false;
  g.add(tongue);
  world!.add(g);
  const x = padX(c);
  const z = padZ(r);
  return {
    kind: spec.kind, name: spec.name, col: spec.col, x, z, y: 0, vx: 0, vz: 0, face: Math.atan2(-x, -z), air: 0, alive: true, sinking: 0, stun: 0,
    cds: { tongue: 0.5, bump: 0.5, jump: 0 }, tongue: 0, tongueHit: false, bump: 0, hop: 0, place: 0, outAt: 0, hitsTaken: 0,
    brain: { think: Math.random() * 0.3, mx: 0, mz: 0, want: null },
    mesh: g, tongueMesh: tongue,
  };
}

// ------------------------------------------------------------------ the ground

/** The pad under (x, z) that still holds a frog up, if any. */
function padAt(x: number, z: number): Pad | null {
  let best: Pad | null = null;
  let bd = STAND;
  for (const p of pads) {
    if (p.state === 'gone' || (p.state === 'sink' && p.t > 0.25)) continue;
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
  for (const p of pads) {
    if (p.state === 'gone' || (p.state === 'sink' && p.t > 0.25)) continue;
    if (Math.hypot(p.x - x, p.z - z) < CORNER) n++;
  }
  return n >= 3;
}

const safeAt = (x: number, z: number): boolean => {
  const p = padAt(x, z);
  return !!p && p.state === 'ok';
};

const neighbours = (p: Pad, ok: Set<Pad>): Pad[] => pads.filter((q) => q !== p && ok.has(q) && Math.abs(q.c - p.c) <= 1 && Math.abs(q.r - p.r) <= 1);

/** Would the 'ok' pads still be one piece without `p`? */
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
  const ok = () => pads.filter((p) => p.state === 'ok' && !picked.has(p));
  for (let k = 0; k < n; k++) {
    const cand = ok();
    if (cand.length <= alive + 3) break;
    const okSet = new Set(cand);
    // edges first: the fewer safe neighbours, the likelier
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
  if (!world) return;
  const ringMat = own(new THREE.MeshBasicMaterial({ color: 0xd8f4ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  const ring = new THREE.Mesh(own(new THREE.RingGeometry(0.3, 0.38, 24)), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.02, z);
  world.add(ring);
  splashes.push({ mesh: ring, t: 0, life: big ? 1 : 0.6, ring: true });
  const dropMat = own(new THREE.MeshBasicMaterial({ color: 0xbfe8ff }));
  const dropGeo = own(new THREE.SphereGeometry(0.06, 5, 4));
  for (let i = 0; i < (big ? 14 : 6); i++) {
    const m = new THREE.Mesh(dropGeo, dropMat);
    m.position.set(x, 0.1, z);
    world.add(m);
    const a = Math.random() * Math.PI * 2;
    const sp = 0.8 + Math.random() * (big ? 2.2 : 1.2);
    splashes.push({ mesh: m, t: 0, life: 0.9, vx: Math.cos(a) * sp, vy: 2 + Math.random() * (big ? 3 : 1.5), vz: Math.sin(a) * sp });
  }
  audio.sfx('water_plip', big ? 0.7 : 0.3);
}

function spark(x: number, y: number, z: number): void {
  if (!world) return;
  const mat = own(new THREE.MeshBasicMaterial({ color: 0xfff0a0 }));
  const geo = own(new THREE.SphereGeometry(0.05, 4, 3));
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    world.add(m);
    const a = Math.random() * Math.PI * 2;
    splashes.push({ mesh: m, t: 0, life: 0.35, vx: Math.cos(a) * 3, vy: 1 + Math.random() * 2, vz: Math.sin(a) * 3 });
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
  spark(f.x, 0.4, f.z);
  audio.sfx(by.bump > 0 ? 'item_thud' : 'throw_whoosh', 0.5);
}

function tongueHits(f: Frog): void {
  // the whip at its longest is a line from the mouth: anyone it crosses
  const len = TONGUE_LEN * Math.sin((1 - f.tongue / TONGUE_S) * Math.PI);
  const ux = Math.sin(f.face);
  const uz = Math.cos(f.face);
  for (const o of frogs) {
    if (o === f || !o.alive || o.air > 0) continue;
    const rx = o.x - f.x;
    const rz = o.z - f.z;
    const along = rx * ux + rz * uz;
    if (along < 0 || along > len + FROG_R) continue;
    const off = Math.abs(rx * uz - rz * ux);
    if (off > FROG_R + 0.08) continue;
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
    // (a jump from standing still still goes the way you face)
    const sp = Math.hypot(f.vx, f.vz);
    if (sp < JUMP_SPEED) {
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
    // ---- GET OFF: the nearest safe pad
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
      // too far to walk over water: jump it
      if (bd > GAP * 1.1 && bd < GAP * 2.3) b.want = 'jump';
    }
  } else if (f.kind === 'brute') {
    target = others.sort((a, c) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(c.x - f.x, c.z - f.z))[0] ?? null;
  } else if (f.kind === 'shell') {
    gx = centre.x;
    gz = centre.z;
    const near = others.find((o) => Math.hypot(o.x - f.x, o.z - f.z) < 2.2);
    if (near) target = near;
  } else {
    // SLY: the frog standing closest to water
    const exposed = (o: Frog): number => {
      let water = 0;
      for (let a = 0; a < 8; a++) if (!safeAt(o.x + Math.cos(a * 0.785) * GAP, o.z + Math.sin(a * 0.785) * GAP)) water++;
      return water;
    };
    target = others.sort((a, c) => exposed(c) - exposed(a))[0] ?? null;
    if (target && exposed(target) < 2) {
      // nobody worth it yet: wait near the middle
      gx = centre.x;
      gz = centre.z;
      target = Math.hypot(target.x - f.x, target.z - f.z) < 1.8 ? target : null;
    }
  }
  if (target) {
    const dx = target.x - f.x;
    const dz = target.z - f.z;
    const d = Math.hypot(dx, dz) || 1;
    // stand off a little for the tongue; SLY comes round to the inland side
    if (f.kind === 'sly') {
      gx = target.x - ((centre.x - target.x) / (Math.hypot(centre.x - target.x, centre.z - target.z) || 1)) * -1.6;
      gz = target.z - ((centre.z - target.z) / (Math.hypot(centre.x - target.x, centre.z - target.z) || 1)) * -1.6;
    } else {
      gx = target.x - (dx / d) * 1.4;
      gz = target.z - (dz / d) * 1.4;
    }
    const facing = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dx, dz) - f.face)) < 0.45;
    if (facing && d < TONGUE_LEN * 0.9 && f.cds.tongue <= 0 && Math.random() < (f.kind === 'brute' ? 0.8 : 0.55)) b.want = 'tongue';
    else if (facing && d < 1.5 && f.cds.bump <= 0 && Math.random() < (f.kind === 'brute' ? 0.7 : 0.4)) b.want = 'bump';
    if (d < 2.2 && !b.want) {
      // turn to face it
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

function stepFrog(f: Frog, dt: number, mx: number, mz: number): void {
  if (!f.alive) {
    if (f.sinking >= 0) {
      f.sinking += dt;
      f.y = -f.sinking * 1.4;
    }
    return;
  }
  for (const k of ['tongue', 'bump', 'jump'] as const) f.cds[k] = Math.max(0, f.cds[k] - dt);
  f.stun = Math.max(0, f.stun - dt);
  const free = f.stun <= 0 && f.bump <= 0;
  if (f.air > 0) {
    f.air -= dt;
    const k = 1 - Math.max(0, f.air) / JUMP_S;
    f.y = Math.sin(k * Math.PI) * 0.9;
    if (f.air <= 0) {
      f.y = 0;
      f.vx *= 0.3;
      f.vz *= 0.3;
      if (supported(f.x, f.z)) splash(f.x, f.z, false);
    }
  } else if (free) {
    // walking: steer toward the stick, the knock-back fading out
    const tx = mx * WALK;
    const tz = mz * WALK;
    const k = Math.min(1, dt * 10);
    const sp = Math.hypot(f.vx, f.vz);
    if (sp > WALK + 0.5) {
      f.vx -= f.vx * Math.min(1, FRICTION * dt);
      f.vz -= f.vz * Math.min(1, FRICTION * dt);
    } else {
      f.vx += (tx - f.vx) * k;
      f.vz += (tz - f.vz) * k;
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
    // a body bump: whoever it runs into goes flying, and it stops dead
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
  // ---- IN THE WATER: off every pad and not in the air
  if (f.air <= 0 && !supported(f.x, f.z)) fallIn(f);
}

function fallIn(f: Frog): void {
  if (!f.alive) return;
  f.alive = false;
  f.sinking = 0;
  f.outAt = clock;
  splash(f.x, f.z, true);
}

/** Frogs bump apart when they walk into each other. */
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

function stepPads(dt: number, t: number): void {
  for (const p of pads) {
    if (p.state === 'warn') {
      p.t += dt;
      const k = p.t / p.warn;
      // flashing faster as it nears the end, shaking harder, cracking at half way
      const flash = Math.sin(p.t * (10 + k * 26)) > 0;
      p.top.color.setHex(flash ? (k > 0.6 ? 0xff5a3a : 0xffb040) : 0xffffff);
      if (k > 0.5 && p.top.map !== crackedMap) {
        p.top.map = crackedMap;
        p.top.needsUpdate = true;
      }
      const j = 0.02 + k * 0.06;
      p.mesh.position.set(p.x + (Math.random() - 0.5) * j, 0, p.z + (Math.random() - 0.5) * j);
      if (p.t >= p.warn) {
        p.state = 'sink';
        p.t = 0;
        splash(p.x, p.z, true);
        audio.sfx('crumble', 0.4);
      }
    } else if (p.state === 'sink') {
      p.t += dt;
      p.mesh.position.y = -p.t * 0.9;
      p.mesh.rotation.x = p.t * 0.6;
      p.mesh.rotation.z = Math.sin(p.seed) * p.t * 0.5;
      p.top.color.setHex(0x8a8a6a);
      if (p.t > 0.9) {
        p.state = 'gone';
        p.mesh.visible = false;
      }
    } else if (p.state === 'ok') {
      // a gentle bob on the water
      p.mesh.position.y = Math.sin(t * 1.6 + p.seed) * 0.015;
    }
  }
}

let crackedMap: THREE.Texture | null = null;

function stepFx(dt: number): void {
  for (const s of splashes) {
    s.t += dt;
    const k = s.t / s.life;
    if (s.ring) {
      s.mesh.scale.setScalar(1 + k * 4);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
    } else {
      s.vy! -= 9 * dt;
      s.mesh.position.x += s.vx! * dt;
      s.mesh.position.y += s.vy! * dt;
      s.mesh.position.z += s.vz! * dt;
    }
    if (s.t >= s.life || s.mesh.position.y < -0.2) {
      world?.remove(s.mesh);
      s.t = s.life;
    }
  }
  splashes = splashes.filter((s) => s.t < s.life);
}

function poseFrogs(t: number): void {
  for (const f of frogs) {
    const g = f.mesh;
    g.position.set(f.x, f.y + (f.alive && f.air <= 0 ? Math.abs(Math.sin(f.hop)) * 0.06 : 0), f.z);
    g.rotation.y = f.face;
    // squash on the ground, stretch in the air; a breath when still
    const st = f.air > 0 ? 1.15 : 1 + Math.sin(t * 3 + f.col) * 0.03;
    g.scale.set(1 / Math.sqrt(st), st, 1 / Math.sqrt(st));
    if (f.stun > 0) g.rotation.z = Math.sin(t * 40) * 0.15;
    else g.rotation.z = 0;
    const tg = f.tongueMesh;
    if (f.tongue > 0) {
      tg.visible = true;
      tg.scale.set(1, 1, Math.max(0.05, TONGUE_LEN * Math.sin((1 - f.tongue / TONGUE_S) * Math.PI)));
    } else tg.visible = false;
    g.visible = f.alive || f.sinking < 1;
  }
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

function placeName(n: number): string {
  return ['1ST', '2ND', '3RD', '4TH'][n - 1] ?? `${n}TH`;
}

function results(winner: Frog | null): void {
  const s = sceneRef;
  const api = apiRef;
  if (!s || !api) return;
  const order = [...frogs].sort((a, b) => a.place - b.place);
  const box = s.add.rectangle(GAME_W / 2, api.area.y + 82, 150, 70, PALETTE.ink, 0.94).setStrokeStyle(1, PALETTE.gold).setDepth(30);
  chips.push(box);
  chips.push(centerText(s, GAME_W / 2, api.area.y + 54, winner ? `${winner.name} WINS!` : 'NOBODY IS LEFT!', winner === player() ? PALETTE.gold : PALETTE.cream).setDepth(31));
  order.forEach((f, i) => chips.push(text(s, GAME_W / 2 - 50, api.area.y + 66 + i * 9, `${placeName(f.place)}  ${f.name}`, f === player() ? PALETTE.gold : PALETTE.ash).setDepth(31)));
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
    // (the player out, the others still going: shown as it stands)
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
    disposables = [];
    splashes = [];
    chips = [];
    clock = 0;
    waveIn = FIRST_WAVE;
    phase = 'count';
    countT = 2.6;
    settled = false;
    nextPlace = 4;
    W = api.area.w;
    H = api.area.h;
    scene.add.rectangle(0, api.area.y, W, H, 0x08141c).setOrigin(0, 0);
    renderer = borrowRenderer();
    if (!renderer) {
      centerText(scene, GAME_W / 2, api.area.y + H / 2, 'THIS MACHINE NEEDS 3D (WEBGL).', PALETTE.cream);
      scene.time.delayedCall(2500, () => api.draw());
      return;
    }
    renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = false;
    world = new THREE.Scene();
    world.background = new THREE.Color(0x0a1a24);
    world.fog = new THREE.Fog(0x0a1a24, 16, 30);
    camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 60);
    camera.position.set(0, 13.2, 9.6);
    camera.lookAt(0, 0, 0.5);
    // the light of a pond at dusk: a warm low sun and a cool sky
    world.add(new THREE.HemisphereLight(0x9ad0ff, 0x1a3020, 0.9));
    const sun = new THREE.DirectionalLight(0xffe0b0, 1.6);
    sun.position.set(-6, 10, 4);
    world.add(sun);
    // the water: a wide sheet, its ripples drifting, glossy enough to catch the sun
    waterTex = waterTexture();
    water = new THREE.Mesh(own(new THREE.PlaneGeometry(60, 60)), own(new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.18, metalness: 0.25, color: 0x8ac8d8 })));
    water.rotation.x = -Math.PI / 2;
    world.add(water);
    // reeds round the pond's edge, for depth
    const reedMat = own(new THREE.MeshStandardMaterial({ color: 0x3a6a2a, roughness: 0.8 }));
    const reedGeo = own(new THREE.ConeGeometry(0.06, 1.2, 4));
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const rx = Math.cos(a) * (9.5 + Math.random() * 2.5);
      const rz = Math.sin(a) * (7 + Math.random() * 2);
      const reed = new THREE.Mesh(reedGeo, reedMat);
      reed.position.set(rx, 0.5, rz);
      reed.rotation.z = (Math.random() - 0.5) * 0.4;
      world.add(reed);
    }
    const padMap = padTexture(false);
    crackedMap = padTexture(true);
    pads = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) pads.push(buildPad(c, r, padMap));
    // FAIR STARTS: the four corners' inner pads, the same distance from the middle
    const starts: Array<[number, number]> = [
      [1, 4],
      [6, 1],
      [6, 4],
      [1, 1],
    ];
    frogs = starts.map(([c, r], i) => buildFrog(i, c, r));
    // the picture: drawn here, copied into this texture each frame
    texKey = `padbattles_${Date.now()}`;
    tex = scene.textures.createCanvas(texKey, W, H);
    picture = scene.add.image(0, api.area.y, texKey).setOrigin(0, 0).setDepth(1);
    hud = text(scene, GAME_W - 6, api.area.y + 4, '', PALETTE.cream).setOrigin(1, 0).setDepth(21);
    banner = centerText(scene, GAME_W / 2, api.area.y + 30, '', PALETTE.gold, 16).setDepth(25).setAlpha(0);
    drawChips();
    const kb = scene.input.keyboard!;
    const k = (n: string) => kb.addKey(n);
    keys = { up: [k('W'), k('UP')], down: [k('S'), k('DOWN')], left: [k('A'), k('LEFT')], right: [k('D'), k('RIGHT')] };
    kb.on('keydown-SPACE', () => act(player(), 'jump'));
    kb.on('keydown-J', () => act(player(), 'tongue'));
    kb.on('keydown-K', () => act(player(), 'bump'));
    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__pads = {
        frogs: () => frogs.map((f) => [f.name, +f.x.toFixed(2), +f.z.toFixed(2), +f.vx.toFixed(1), +f.vz.toFixed(1), f.air > 0 ? 'AIR' : '', f.bump > 0 ? 'BUMP' : '', f.stun > 0 ? 'STUN' : '', f.alive ? '' : 'OUT'].join(' ')),
        state: () => ({ phase, clock, alive: frogs.map((f) => f.alive), places: frogs.map((f) => f.place), pads: pads.map((p) => p.state), me: { x: player().x, z: player().z } }),
        whole: () => staysWhole(new Set()),
        dunk: (i: number) => fallIn(frogs[i]),
        dunkAll: (ids: number[]) => ids.forEach((i) => fallIn(frogs[i])),
        warnAll: () => pads.forEach((p) => p.state === 'ok' && ((p.state = 'warn'), (p.t = 0), (p.warn = 1.5))),
        act: (what: 'tongue' | 'bump' | 'jump') => act(player(), what),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => delete (window as unknown as Record<string, unknown>).__pads);
    }
    announce('READY...', PALETTE.cream);
  },

  update(time: number, delta: number) {
    if (!renderer || !world || !camera || !tex) return;
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
        if (f.alive && phase === 'play') {
          think(f, dt);
          if (f.brain.want) {
            act(f, f.brain.want);
            f.brain.want = null;
          }
        }
        stepFrog(f, dt, f.alive && phase === 'play' ? f.brain.mx : 0, f.alive && phase === 'play' ? f.brain.mz : 0);
      }
      separate();
      stepPads(dt, t);
      settle();
    }
    stepFx(dt);
    poseFrogs(t);
    if (waterTex) waterTex.offset.set((t * 0.01) % 1, (t * 0.006) % 1);
    // the camera leans a little toward you, so you are never at the far edge
    const me = player();
    camera.position.set(me.x * 0.12, 13.2, 9.6 + me.z * 0.1);
    camera.lookAt(me.x * 0.12, 0, 0.5 + me.z * 0.1);
    const cd = me.cds;
    hud?.setText(phase === 'play' ? `TONGUE ${cd.tongue > 0 ? '..' : 'OK'}  BUMP ${cd.bump > 0 ? '..' : 'OK'}` : '');
    // ---- draw, and copy the picture into the game's texture
    renderer.setSize(W, H, false);
    renderer.render(world, camera);
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(renderer.domElement, 0, 0, W, H);
    tex.refresh();
  },

  destroy() {
    for (const d of disposables) d.dispose();
    disposables = [];
    // (the picture first: the shell's results are still drawn over it, and
    // an image left pointing at a removed texture fails every frame)
    picture?.destroy();
    picture = null;
    if (sceneRef && texKey && sceneRef.textures.exists(texKey)) sceneRef.textures.remove(texKey);
    world = null;
    camera = null;
    renderer = null;
    tex = null;
    water = null;
    waterTex = null;
    pads = [];
    frogs = [];
    splashes = [];
    chips = [];
    hud = banner = null;
    apiRef = null;
    sceneRef = null;
  },
};
