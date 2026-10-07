/**
 * ---- WHAT IS IN THE CRANE MACHINES.
 *
 * The prizes in the glass are toys you would put a coin in for: fat stuffed
 * animals sitting up with their feet out, and plastic mystery capsules.  Each
 * is drawn once, at its full size, into a texture (`toyTexture`), and the pile
 * is images of those -- so a machine can hold a hundred and fifty of them and
 * every one is the same carefully drawn toy.
 *
 * Every plush is built the same way a real one is sewn: a round body sat on
 * its bottom, a big head, stubby arms, two feet sticking out in front -- then
 * what makes it that animal.  Each has a dark 1px outline all round (drawn as
 * the shape a pixel larger, underneath), a shadow side, a lit side, a bright
 * catch on the top of the head, a seam down the tummy and a little white
 * label on its hip.  The Froggy is the one everybody wants, and he is a little
 * bigger than the rest.
 *
 * The capsules are two-tone balls: an opaque coloured bottom, a clear top you
 * can see a shadowy something through, the ring where the halves meet, and a
 * hard white shine.
 */

import Phaser from 'phaser';

export type PlushKind = 'frog' | 'bear' | 'bunny' | 'duck' | 'cat' | 'owl';

/**
 * How much finer than its 30px design a toy is drawn.  Every shape below is
 * laid out on a 30x30 grid, and the pen multiplies it up -- so a toy is a
 * true 45x45 drawing with half again the pixels in every curve and face, not
 * a 30px one stretched.
 */
export const TOY_RES = 1.5;
/** The canvas each toy is drawn on; its feet stand at the bottom middle. */
export const TOY_W = 30 * TOY_RES;
export const TOY_H = 30 * TOY_RES;
/** The 30x30 design grid the shapes are laid out on. */
const DW = 30;
const DH = 30;

/** A Graphics that takes design-grid coordinates and draws them TOY_RES larger. */
class Pen {
  constructor(readonly g: Phaser.GameObjects.Graphics, readonly k: number) {}
  fillStyle(col: number, a = 1): this { this.g.fillStyle(col, a); return this; }
  lineStyle(w: number, col: number, a = 1): this { this.g.lineStyle(w * this.k, col, a); return this; }
  fillRect(x: number, y: number, w: number, h: number): this { const k = this.k; this.g.fillRect(x * k, y * k, w * k, h * k); return this; }
  fillEllipse(x: number, y: number, w: number, h: number): this { const k = this.k; this.g.fillEllipse(x * k, y * k, w * k, h * k); return this; }
  fillCircle(x: number, y: number, r: number): this { const k = this.k; this.g.fillCircle(x * k, y * k, r * k); return this; }
  fillTriangle(a: number, b: number, c: number, d: number, e: number, f: number): this { const k = this.k; this.g.fillTriangle(a * k, b * k, c * k, d * k, e * k, f * k); return this; }
  lineBetween(a: number, b: number, c: number, d: number): this { const k = this.k; this.g.lineBetween(a * k, b * k, c * k, d * k); return this; }
  slice(x: number, y: number, r: number, a0: number, a1: number, acw = false): this { const k = this.k; this.g.slice(x * k, y * k, r * k, a0, a1, acw); return this; }
  fillPath(): this { this.g.fillPath(); return this; }
}

const INK = 0x1a1210;

function shade(col: number, k: number): number {
  const c = Phaser.Display.Color.IntegerToColor(col);
  const f = (v: number) => Math.round(Phaser.Math.Clamp(k >= 0 ? v + (255 - v) * k : v * (1 + k), 0, 255));
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

interface Plush {
  body: number;
  belly: number;
  scale?: number;
}

const PLUSH: Record<PlushKind, Plush> = {
  frog: { body: 0x46c46e, belly: 0xf2e08a, scale: 1.12 },
  bear: { body: 0xa8743e, belly: 0xe8c89a },
  bunny: { body: 0xf2e6d8, belly: 0xffffff },
  duck: { body: 0xffc830, belly: 0xfff0a0 },
  cat: { body: 0x8a8f99, belly: 0xd8dce4 },
  owl: { body: 0x7b4bd8, belly: 0xc8a8f0 },
};

/**
 * The texture key for a plush (or `capsule-N`), drawn into the scene's
 * texture manager the first time it is asked for.
 */
export function toyTexture(scene: Phaser.Scene, kind: PlushKind | `capsule-${number}`): string {
  const key = `crane-toy-${kind}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const pen = new Pen(g, TOY_RES);
  if (kind.startsWith('capsule-')) drawCapsule(pen, Number(kind.slice(8)));
  else drawPlush(pen, kind as PlushKind);
  g.generateTexture(key, TOY_W, TOY_H);
  g.destroy();
  return key;
}

/** Which plush an item id is: 'plush:bear' -> 'bear'. */
export function plushKind(id: string): PlushKind {
  const k = id.split(':')[1] as PlushKind;
  return k in PLUSH ? k : 'bear';
}

export const CAPSULE_VARIANTS = 5;

// ------------------------------------------------------------------ plushies

function drawPlush(g: Pen, kind: PlushKind): void {
  const p = PLUSH[kind];
  const b = p.body;
  const dark = shade(b, -0.32);
  const lit = shade(b, 0.32);
  const cx = DW / 2;
  // a little lower and wider for the duck and the owl, which have no neck
  const headY = kind === 'duck' || kind === 'owl' ? 12 : 11;
  const headR = kind === 'frog' ? 0 : 7.5;

  // ---- 1. THE OUTLINE.  Everything, one pixel bigger, in ink.
  g.fillStyle(INK, 1);
  g.fillEllipse(cx, 21, 19, 15); // body
  g.fillEllipse(cx - 5, 27, 8, 5); // feet
  g.fillEllipse(cx + 5, 27, 8, 5);
  g.fillEllipse(cx - 9, 19, 6, 9); // arms
  g.fillEllipse(cx + 9, 19, 6, 9);
  if (kind === 'frog') {
    g.fillEllipse(cx, 12, 21, 14);
    g.fillCircle(cx - 5, 6, 4.4).fillCircle(cx + 5, 6, 4.4);
  } else g.fillCircle(cx, headY, headR + 1);
  earsOrTop(g, kind, cx, headY, INK, 1);

  // ---- 2. THE FILL, the shadow side and the lit side.
  g.fillStyle(b, 1);
  g.fillEllipse(cx, 21, 17, 13);
  g.fillEllipse(cx - 9, 19, 4, 7).fillEllipse(cx + 9, 19, 4, 7);
  g.fillEllipse(cx - 5, 27, 6, 3).fillEllipse(cx + 5, 27, 6, 3);
  if (kind === 'frog') {
    g.fillEllipse(cx, 12, 19, 12);
    g.fillCircle(cx - 5, 6, 3.4).fillCircle(cx + 5, 6, 3.4);
  } else g.fillCircle(cx, headY, headR);
  earsOrTop(g, kind, cx, headY, b, 0);
  // shadow: the right and the underside of each round part
  g.fillStyle(dark, 1);
  g.fillEllipse(cx + 4, 24, 7, 4);
  g.fillEllipse(cx + 9.5, 21, 2, 4);
  g.fillEllipse(cx + 5.5, 28, 4, 1.4);
  g.fillEllipse(cx - 4.5, 28, 4, 1.4);
  if (kind === 'frog') g.fillEllipse(cx + 5, 15, 8, 3);
  else g.fillEllipse(cx + 3.5, headY + 4, 6, 3);
  // light: the left of each, and a catch on top of the head
  g.fillStyle(lit, 1);
  g.fillEllipse(cx - 4, 18, 5, 4);
  g.fillEllipse(cx - 9.5, 17, 1.6, 3);
  if (kind === 'frog') g.fillEllipse(cx - 5, 9, 6, 3);
  else g.fillEllipse(cx - 3, headY - 3.5, 5, 2.5);
  g.fillStyle(0xffffff, 0.75).fillRect(cx - 4, kind === 'frog' ? 8 : headY - 5, 2, 1);

  // ---- 3. THE TUMMY, its seam, and the foot pads.
  g.fillStyle(p.belly, 1).fillEllipse(cx, 22, 9, 8);
  g.fillStyle(shade(p.belly, -0.15), 1).fillEllipse(cx + 1.5, 24, 5, 2.5);
  g.fillStyle(shade(b, -0.45), 1);
  for (let y = 18; y <= 26; y += 2) g.fillRect(cx, y, 1, 1);
  g.fillStyle(p.belly, 1).fillEllipse(cx - 5, 27, 3.2, 1.8).fillEllipse(cx + 5, 27, 3.2, 1.8);

  // ---- 4. THE FACE, which is the animal.
  face(g, kind, cx, headY, b);

  // ---- 5. THE LABEL, sewn into the hip seam.
  g.fillStyle(INK, 1).fillRect(cx + 6, 22, 4, 4);
  g.fillStyle(0xf8f8f0, 1).fillRect(cx + 6.5, 22.5, 3, 3);
  g.fillStyle(0xd84a4a, 1).fillRect(cx + 7, 23, 2, 1);
}

/** Ears, tufts and crests: `outline` 1 draws them a pixel bigger in ink. */
function earsOrTop(g: Pen, kind: PlushKind, cx: number, hy: number, col: number, outline: number): void {
  const o = outline;
  g.fillStyle(col, 1);
  switch (kind) {
    case 'bear':
      g.fillCircle(cx - 6, hy - 6, 3 + o).fillCircle(cx + 6, hy - 6, 3 + o);
      if (!o) g.fillStyle(0xe8c89a, 1).fillCircle(cx - 6, hy - 6, 1.6).fillCircle(cx + 6, hy - 6, 1.6);
      break;
    case 'bunny':
      g.fillEllipse(cx - 3.5, hy - 9, 4 + o * 2, 12 + o * 2).fillEllipse(cx + 3.5, hy - 9.5, 4 + o * 2, 12 + o * 2);
      if (!o) g.fillStyle(0xffa8c8, 1).fillEllipse(cx - 3.5, hy - 9, 1.8, 8).fillEllipse(cx + 3.5, hy - 9.5, 1.8, 8);
      break;
    case 'cat':
      g.fillTriangle(cx - 7 - o, hy - 3, cx - 1 + o, hy - 6, cx - 6, hy - 11 - o);
      g.fillTriangle(cx + 7 + o, hy - 3, cx + 1 - o, hy - 6, cx + 6, hy - 11 - o);
      if (!o) g.fillStyle(0xffa8c8, 1).fillTriangle(cx - 5.5, hy - 5, cx - 3, hy - 6, cx - 5.5, hy - 8.5).fillTriangle(cx + 5.5, hy - 5, cx + 3, hy - 6, cx + 5.5, hy - 8.5);
      break;
    case 'owl':
      g.fillTriangle(cx - 7 - o, hy - 3, cx - 3 + o, hy - 6, cx - 8, hy - 10 - o);
      g.fillTriangle(cx + 7 + o, hy - 3, cx + 3 - o, hy - 6, cx + 8, hy - 10 - o);
      break;
    case 'duck':
      // a little tuft of fluff on top
      g.fillEllipse(cx, hy - 8, 3 + o * 2, 4 + o * 2);
      break;
    case 'frog':
      break;
  }
}

function face(g: Pen, kind: PlushKind, cx: number, hy: number, body: number): void {
  const eye = (x: number, y: number, r = 1.4) => {
    g.fillStyle(INK, 1).fillCircle(x, y, r);
    g.fillStyle(0xffffff, 1).fillRect(x - 0.6, y - 0.9, 1, 1);
  };
  switch (kind) {
    case 'frog': {
      // eyes up on their bumps, a wide stitched smile and pink cheeks
      for (const sx of [-5, 5]) {
        g.fillStyle(0xffffff, 1).fillCircle(cx + sx, 6, 2.6);
        g.fillStyle(INK, 1).fillCircle(cx + sx + 0.4, 6.4, 1.4);
        g.fillStyle(0xffffff, 1).fillRect(cx + sx - 0.4, 5.2, 1, 1);
      }
      g.fillStyle(INK, 1);
      g.fillRect(cx - 5, 13, 1, 1).fillRect(cx - 4, 14, 8, 1).fillRect(cx + 4, 13, 1, 1);
      g.fillStyle(0xd84a5a, 1).fillRect(cx - 2, 15, 4, 1);
      g.fillStyle(0xff8aa0, 0.9).fillEllipse(cx - 7, 12, 3, 2).fillEllipse(cx + 7, 12, 3, 2);
      break;
    }
    case 'bear': {
      eye(cx - 3, hy - 1);
      eye(cx + 3, hy - 1);
      g.fillStyle(0xe8c89a, 1).fillEllipse(cx, hy + 3, 7, 5);
      g.fillStyle(INK, 1).fillEllipse(cx, hy + 2, 3, 2).fillRect(cx, hy + 3, 1, 2);
      g.fillRect(cx - 2, hy + 5, 2, 1).fillRect(cx + 1, hy + 5, 2, 1);
      break;
    }
    case 'bunny': {
      eye(cx - 3, hy);
      eye(cx + 3, hy);
      g.fillStyle(0xff8aa0, 1).fillTriangle(cx - 1.2, hy + 2, cx + 1.8, hy + 2, cx + 0.3, hy + 3.5);
      g.fillStyle(shade(body, -0.35), 1).fillRect(cx - 6, hy + 3, 3, 1).fillRect(cx + 4, hy + 3, 3, 1);
      g.fillStyle(0xffa8c8, 0.8).fillEllipse(cx - 5, hy + 2, 2.5, 1.6).fillEllipse(cx + 5, hy + 2, 2.5, 1.6);
      break;
    }
    case 'duck': {
      eye(cx - 3, hy - 1);
      eye(cx + 3, hy - 1);
      // a flat orange bill with a shine on it
      g.fillStyle(INK, 1).fillEllipse(cx, hy + 3.5, 9, 5);
      g.fillStyle(0xff8a2a, 1).fillEllipse(cx, hy + 3.5, 7.4, 3.6);
      g.fillStyle(0xffb060, 1).fillRect(cx - 2, hy + 2.5, 3, 1);
      g.fillStyle(0xc8601a, 1).fillRect(cx - 3, hy + 4, 6, 1);
      break;
    }
    case 'cat': {
      // one button eye hanging a little lower than the other, as promised
      g.fillStyle(INK, 1).fillCircle(cx - 3, hy - 1, 1.5);
      g.fillStyle(0x3a3a4a, 1).fillCircle(cx + 3, hy, 1.5);
      g.fillStyle(0xc8c8d0, 1).fillRect(cx + 2.5, hy - 0.5, 1, 1);
      g.fillStyle(0xff8aa0, 1).fillRect(cx - 1, hy + 2, 2, 1);
      g.fillStyle(INK, 1).fillRect(cx - 1, hy + 3, 1, 1).fillRect(cx + 1, hy + 3, 1, 1);
      g.lineStyle(1, shade(body, 0.5), 1).lineBetween(cx - 8, hy + 2, cx - 3, hy + 2.5).lineBetween(cx + 3, hy + 2.5, cx + 8, hy + 2);
      // stripes over the head
      g.fillStyle(shade(body, -0.3), 1).fillRect(cx - 1, hy - 7, 2, 2).fillRect(cx - 4, hy - 6, 1, 2).fillRect(cx + 3, hy - 6, 1, 2);
      break;
    }
    case 'owl': {
      // big round eyes in yellow rings, a hooked beak, scalloped feathers
      for (const sx of [-3.4, 3.4]) {
        g.fillStyle(INK, 1).fillCircle(cx + sx, hy, 3.4);
        g.fillStyle(0xffd84a, 1).fillCircle(cx + sx, hy, 2.6);
        g.fillStyle(INK, 1).fillCircle(cx + sx, hy, 1.5);
        g.fillStyle(0xffffff, 1).fillRect(cx + sx - 1, hy - 1.4, 1, 1);
      }
      g.fillStyle(0xff9a2a, 1).fillTriangle(cx - 1.5, hy + 2.5, cx + 1.5, hy + 2.5, cx, hy + 5);
      g.fillStyle(shade(body, -0.25), 1);
      for (const [x, y] of [[-2, 20], [2, 20], [0, 23], [-3, 24], [3, 24]]) g.fillRect(cx + x - 1, y, 2, 1);
      break;
    }
  }
}

// ------------------------------------------------------------------ capsules

const CAPSULE_COLS = [0x8a3ab8, 0x2a8a8a, 0xc84a7a, 0x4a5ab8, 0x6a8a3a];

/**
 * A mystery capsule, sitting on the pile: about twenty pixels across, with a
 * shadowy something in its clear top half.
 */
function drawCapsule(g: Pen, v: number): void {
  const col = CAPSULE_COLS[((v % CAPSULE_COLS.length) + CAPSULE_COLS.length) % CAPSULE_COLS.length];
  const cx = DW / 2;
  const cy = DH - 11;
  const r = 10;
  // outline
  g.fillStyle(INK, 1).fillCircle(cx, cy, r + 1);
  // the clear top: smoky plastic, with what is inside showing through
  g.fillStyle(0xc8d8e8, 1).fillCircle(cx, cy, r);
  g.fillStyle(0x9ab0c8, 1).fillEllipse(cx + 3, cy - 2, 12, 8);
  // something in there: a different shape in each colour, never quite clear
  g.fillStyle(shade(col, -0.45), 0.8);
  switch (v % 3) {
    case 0:
      g.fillCircle(cx - 1, cy - 4, 3).fillRect(cx - 3, cy - 2, 5, 3);
      break;
    case 1:
      g.fillTriangle(cx - 4, cy - 1, cx + 3, cy - 1, cx - 1, cy - 7);
      break;
    default:
      g.fillRect(cx - 4, cy - 5, 7, 4);
      g.fillStyle(0xffd84a, 0.6).fillRect(cx - 1, cy - 4, 1, 1);
  }
  // the coloured bottom half, opaque
  g.fillStyle(col, 1);
  g.slice(cx, cy, r, 0, Math.PI, false).fillPath();
  g.fillStyle(shade(col, -0.35), 1);
  g.slice(cx, cy, r, 0, Math.PI * 0.45, false).fillPath();
  g.fillStyle(shade(col, 0.35), 1).fillEllipse(cx - 5, cy + 4, 4, 2);
  // the seam where the halves click together, and the little grip notch
  g.fillStyle(INK, 1).fillRect(cx - r, cy - 0.5, r * 2 + 1, 1.5);
  g.fillStyle(0xe8e8f0, 1).fillRect(cx - r + 1, cy - 1, r * 2 - 1, 1);
  g.fillStyle(INK, 1).fillRect(cx + r - 3, cy - 2, 2, 3);
  // and the shine: a hard white streak across the top, a dot beside it
  g.fillStyle(0xffffff, 0.9).fillEllipse(cx - 4, cy - 6, 5, 2.4);
  g.fillStyle(0xffffff, 0.7).fillRect(cx - 7, cy - 3, 1, 2);
  g.fillStyle(0xffffff, 0.5).fillRect(cx + 5, cy + 5, 2, 1);
}
