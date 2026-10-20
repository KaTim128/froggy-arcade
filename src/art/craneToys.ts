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

export type PlushKind = 'frog' | 'bear' | 'bunny' | 'duck' | 'cat' | 'owl' | 'pig' | 'fox' | 'panda' | 'penguin' | 'lion' | 'unicorn';

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
/** Drawing units drawn above the top of the 30x30 box, for ears and horns. */
const TOY_HEADROOM = 8;
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
  pig: { body: 0xf0a0b4, belly: 0xf8ccd8 },
  fox: { body: 0xe0702a, belly: 0xfff0e0 },
  panda: { body: 0xf2f2ee, belly: 0xffffff },
  penguin: { body: 0x2a3044, belly: 0xf0f0f0 },
  lion: { body: 0xe0a83a, belly: 0xf8e0a0 },
  unicorn: { body: 0xf6f0ff, belly: 0xffe4f2 },
};

/**
 * The texture key for a plush (or `capsule-N`), drawn into the scene's
 * texture manager the first time it is asked for.
 */
/**
 * Which way a toy is seen.  FRONT is through the machine's glass; SIDE is
 * from its right-hand end, where the side view looks in -- every toy in
 * there faces the glass, so seen from the end it is in PROFILE, facing left
 * (towards the front).  Each is its own drawing: the side is never the front
 * squashed, turned or mirrored.
 */
export type ToyView = 'front' | 'side';

export function toyTexture(scene: Phaser.Scene, kind: PlushKind | `capsule-${number}`, size = 1, tilt = 0, view: ToyView = 'front'): string {
  // DRAWN AT THE SIZE IT IS SHOWN.  A 45px toy shrunk to 34 on screen with
  // nearest sampling loses whole rows and columns -- eyes, seams and shines
  // went missing at random and the heap read as mush.  So each size (and
  // tilt) is its own drawing, laid out at that size and shown 1:1.
  const s = Math.round(size * 25) / 25;
  const a = Math.round(tilt);
  const key = `crane-toy-${kind}@${s}r${a}${view === 'side' ? '-side' : ''}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const w = Math.ceil(TOY_W * s);
  // Room above the toy for what sticks up past its head: the bunny's ears
  // (and the fox's, the cat's, the unicorn's horn) reach above the top of
  // the 30-unit drawing and were cut off flat.  Every toy stands on its
  // feet (origin at the bottom), so the extra is all sky.
  const head = Math.ceil(TOY_HEADROOM * TOY_RES * s);
  const h = Math.ceil(TOY_H * s) + head;
  if (a) {
    // tipped over about its feet
    g.translateCanvas(w / 2, h);
    g.rotateCanvas((a * Math.PI) / 180);
    g.translateCanvas(-w / 2, -h);
  }
  g.translateCanvas(0, head);
  const pen = new Pen(g, TOY_RES * s);
  if (kind.startsWith('capsule-')) drawCapsule(pen, Number(kind.slice(8)), view);
  else if (view === 'side') drawPlushSide(pen, kind as PlushKind);
  else drawPlush(pen, kind as PlushKind);
  g.generateTexture(key, w, h);
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
  } else {
    // the lion's mane: a ring round the head, under it
    if (kind === 'lion') {
      g.fillCircle(cx, headY, headR + 4.5);
      g.fillStyle(0x8a4a1a, 1).fillCircle(cx, headY, headR + 3.5);
      g.fillStyle(0xa85a22, 1).fillCircle(cx - 1, headY - 1, headR + 2.5);
      g.fillStyle(INK, 1);
    }
    g.fillCircle(cx, headY, headR + 1);
  }
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
    case 'pig':
      g.fillTriangle(cx - 7 - o, hy - 3, cx - 2 + o, hy - 6, cx - 7, hy - 9 - o);
      g.fillTriangle(cx + 7 + o, hy - 3, cx + 2 - o, hy - 6, cx + 7, hy - 9 - o);
      break;
    case 'fox':
      g.fillTriangle(cx - 7 - o, hy - 2, cx - 1 + o, hy - 6, cx - 6, hy - 12 - o);
      g.fillTriangle(cx + 7 + o, hy - 2, cx + 1 - o, hy - 6, cx + 6, hy - 12 - o);
      if (!o) g.fillStyle(0x3a2014, 1).fillTriangle(cx - 6.8, hy - 9, cx - 5, hy - 9, cx - 6, hy - 11.5).fillTriangle(cx + 6.8, hy - 9, cx + 5, hy - 9, cx + 6, hy - 11.5);
      break;
    case 'panda':
      g.fillStyle(o ? col : 0x1e1e22, 1).fillCircle(cx - 6, hy - 6, 2.8 + o).fillCircle(cx + 6, hy - 6, 2.8 + o);
      break;
    case 'unicorn':
      g.fillTriangle(cx - 6 - o, hy - 3, cx - 2 + o, hy - 6, cx - 5, hy - 9 - o);
      g.fillTriangle(cx + 6 + o, hy - 3, cx + 2 - o, hy - 6, cx + 5, hy - 9 - o);
      // the horn, gold, spiralled
      g.fillStyle(o ? col : 0xf0c040, 1).fillTriangle(cx - 1.6 - o, hy - 6, cx + 1.6 + o, hy - 6, cx, hy - 14 - o);
      if (!o) g.fillStyle(0xc8901a, 1).fillRect(cx - 1, hy - 8, 2, 1).fillRect(cx - 0.5, hy - 11, 1, 1);
      break;
    case 'frog':
    case 'penguin':
    case 'lion':
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
    case 'pig': {
      eye(cx - 3, hy - 1.5);
      eye(cx + 3, hy - 1.5);
      g.fillStyle(INK, 1).fillEllipse(cx, hy + 2.5, 7, 5);
      g.fillStyle(0xf8b8c8, 1).fillEllipse(cx, hy + 2.5, 5.6, 3.8);
      g.fillStyle(0xa04a60, 1).fillRect(cx - 1.6, hy + 2, 1, 1.4).fillRect(cx + 0.8, hy + 2, 1, 1.4);
      g.fillStyle(0xff8aa0, 0.7).fillEllipse(cx - 6, hy + 2, 2.4, 1.4).fillEllipse(cx + 6, hy + 2, 2.4, 1.4);
      break;
    }
    case 'fox': {
      // a white muzzle coming to a point, a black nose
      g.fillStyle(0xfff0e0, 1).fillTriangle(cx - 5, hy + 1, cx + 5, hy + 1, cx, hy + 6);
      g.fillEllipse(cx - 3, hy + 2, 4, 3).fillEllipse(cx + 3, hy + 2, 4, 3);
      eye(cx - 3, hy - 1.5, 1.2);
      eye(cx + 3, hy - 1.5, 1.2);
      g.fillStyle(INK, 1).fillEllipse(cx, hy + 4.5, 2.4, 1.6);
      break;
    }
    case 'panda': {
      // the black patches the eyes sit in
      g.fillStyle(0x1e1e22, 1).fillEllipse(cx - 3.2, hy, 3.6, 4.4).fillEllipse(cx + 3.2, hy, 3.6, 4.4);
      g.fillStyle(0xffffff, 1).fillCircle(cx - 3, hy - 0.4, 1).fillCircle(cx + 3.4, hy - 0.4, 1);
      g.fillStyle(INK, 1).fillEllipse(cx, hy + 3, 2.6, 1.6).fillRect(cx - 1, hy + 4.5, 2, 1);
      break;
    }
    case 'penguin': {
      // a white face like a heart, an orange beak
      g.fillStyle(0xf0f0f0, 1).fillEllipse(cx - 2.2, hy + 1, 5, 7).fillEllipse(cx + 2.2, hy + 1, 5, 7);
      eye(cx - 2.4, hy - 0.5, 1.2);
      eye(cx + 2.4, hy - 0.5, 1.2);
      g.fillStyle(0xff9a2a, 1).fillTriangle(cx - 1.6, hy + 2, cx + 1.6, hy + 2, cx, hy + 4.4);
      g.fillStyle(0xff8aa0, 0.7).fillEllipse(cx - 4, hy + 2.5, 1.8, 1.2).fillEllipse(cx + 4, hy + 2.5, 1.8, 1.2);
      break;
    }
    case 'lion': {
      eye(cx - 3, hy - 1);
      eye(cx + 3, hy - 1);
      g.fillStyle(0xf8e0a0, 1).fillEllipse(cx, hy + 3, 7, 4.6);
      g.fillStyle(0x5a2a14, 1).fillTriangle(cx - 1.6, hy + 1.5, cx + 1.6, hy + 1.5, cx, hy + 3);
      g.fillStyle(INK, 1).fillRect(cx, hy + 3, 1, 1.4).fillRect(cx - 2, hy + 4.4, 2, 1).fillRect(cx + 1, hy + 4.4, 2, 1);
      break;
    }
    case 'unicorn': {
      // closed, happy eyes; a pink mane falling over one side
      g.fillStyle(INK, 1).fillRect(cx - 4, hy, 2, 1).fillRect(cx + 2, hy, 2, 1);
      g.fillStyle(0xff8ab8, 1).fillEllipse(cx - 6, hy - 3, 4, 7).fillEllipse(cx - 4, hy - 6, 4, 3);
      g.fillStyle(0xb88aff, 1).fillEllipse(cx - 7, hy + 1, 3, 4);
      g.fillStyle(0xffd0e0, 1).fillEllipse(cx, hy + 3.5, 6, 3.6);
      g.fillStyle(0xd88aa8, 1).fillRect(cx - 1.4, hy + 3, 1, 1).fillRect(cx + 0.6, hy + 3, 1, 1);
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

// ------------------------------------------------------- plushies, in profile

/**
 * ---- THE SAME PLUSH, SEEN FROM THE SIDE.
 *
 * Sat on its bottom facing left (the front of the machine): the body is an
 * oval seen side-on, the head sits over the front of it, ONE eye shows, the
 * snout, bill, beak or muzzle sticks out in front, the near arm lies along
 * the side, both feet poke forward (the far one a shade darker, behind), the
 * ears are seen edge-on, and the tail -- which the front never shows -- is
 * there at the back.  The sewn label is on the right hip, so from this end
 * it faces you.  Same palette, outline, light and shadow as the front.
 */
function drawPlushSide(g: Pen, kind: PlushKind): void {
  const p = PLUSH[kind];
  const b = p.body;
  const dark = shade(b, -0.32);
  const lit = shade(b, 0.32);
  const cx = DW / 2 + 1;
  const headY = kind === 'duck' || kind === 'owl' ? 12 : 11;
  const hx = cx - 2;
  const headR = 7.5;
  const frog = kind === 'frog';

  // every silhouette part, drawn once a pixel bigger in ink and once in fill
  const parts = (o: number, col: number): void => {
    g.fillStyle(col, 1);
    // the tail, behind everything
    tailSide(g, kind, cx, o, col);
    // (each part sets its own accents: back to this pass's colour after it)
    g.fillStyle(col, 1);
    // the far foot, then the body, then the near foot
    g.fillEllipse(cx - 4, 27.4, 8 + o * 2, 4 + o * 2);
    g.fillEllipse(cx + 1, 21, 15 + o * 2, 13 + o * 2);
    g.fillEllipse(cx - 7, 27, 9 + o * 2, 4.4 + o * 2);
    // the head (the frog's is a wide flat one, with its eye bump on top)
    if (frog) {
      g.fillEllipse(hx, 12, 18 + o * 2, 13 + o * 2);
      g.fillCircle(hx - 3, 6, 4 + o);
    } else {
      if (kind === 'lion') g.fillCircle(hx + 1.5, headY, headR + 3.5 + o);
      g.fillCircle(hx, headY, headR + o);
    }
    snoutSide(g, kind, hx, headY, o, col);
    g.fillStyle(col, 1);
    earsSide(g, kind, hx, headY, o, col);
    g.fillStyle(col, 1);
  };
  parts(1, INK);
  parts(0, b);
  // the lion's mane, in its own browns, round the back of the head
  if (kind === 'lion') {
    g.fillStyle(0x8a4a1a, 1).fillCircle(hx + 1.5, headY, headR + 3.5);
    g.fillStyle(0xa85a22, 1).fillCircle(hx + 2.5, headY - 0.5, headR + 2);
    g.fillStyle(b, 1).fillCircle(hx - 0.5, headY + 0.5, headR - 0.5);
    snoutSide(g, kind, hx, headY, 0, b);
  }
  // the far foot is in the shade of the body
  g.fillStyle(dark, 1).fillEllipse(cx - 4, 27.6, 7, 3);
  g.fillStyle(b, 1).fillEllipse(cx - 7, 27, 8, 3.4);

  // ---- light and shadow: lit from the front (the left), dark behind and under
  g.fillStyle(dark, 1);
  g.fillEllipse(cx + 5, 23, 6, 8);
  g.fillEllipse(cx + 1, 26.4, 12, 2.4);
  if (frog) g.fillEllipse(hx + 5, 15, 7, 3);
  else g.fillEllipse(hx + 3.5, headY + 4, 6, 3);
  g.fillStyle(lit, 1);
  g.fillEllipse(cx - 3, 18, 4, 4);
  if (frog) g.fillEllipse(hx - 4, 9, 6, 2.6);
  else g.fillEllipse(hx - 2.5, headY - 4, 5, 2.4);
  g.fillStyle(0xffffff, 0.75).fillRect(hx - 3, frog ? 8 : headY - 5.5, 2, 1);

  // ---- the tummy, seen side-on: a sliver of it at the front of the body
  g.fillStyle(p.belly, 1).fillEllipse(cx - 5, 22, 3, 8);
  g.fillStyle(p.belly, 1).fillEllipse(cx - 9.5, 27, 2, 3);

  // ---- the near arm, lying along the side, with a stitched seam
  // (its edge a seam in the body's own darker shade, not an ink ring)
  g.fillStyle(shade(b, -0.42), 1).fillEllipse(cx - 0.6, 20.4, 4.6, 8.6);
  g.fillStyle(b, 1).fillEllipse(cx - 1, 20, 3.8, 7.6);
  g.fillStyle(lit, 1).fillEllipse(cx - 1.8, 18, 1.4, 3);
  g.fillStyle(shade(b, -0.2), 1).fillEllipse(cx - 0.4, 23, 2.6, 2);

  // ---- the face, in profile: one eye, and the animal's own front
  faceSide(g, kind, hx, headY, b);

  // ---- the label, on the right hip, facing you from this end
  g.fillStyle(INK, 1).fillRect(cx + 3, 21, 4, 4);
  g.fillStyle(0xf8f8f0, 1).fillRect(cx + 3.5, 21.5, 3, 3);
  g.fillStyle(0xd84a4a, 1).fillRect(cx + 4, 22, 2, 1);
}

/** The tail, at the back of the body: the one part the front never shows. */
function tailSide(g: Pen, kind: PlushKind, cx: number, o: number, col: number): void {
  const t = col === INK;
  switch (kind) {
    case 'fox':
      g.fillEllipse(cx + 9, 22, 9 + o * 2, 6 + o * 2);
      g.fillEllipse(cx + 12, 19, 5 + o * 2, 5 + o * 2);
      if (!t) g.fillStyle(0xfff0e0, 1).fillEllipse(cx + 13.5, 18, 3, 3);
      break;
    case 'cat':
      g.fillEllipse(cx + 9, 24, 6 + o * 2, 3 + o * 2);
      g.fillEllipse(cx + 11.5, 20, 2.6 + o * 2, 7 + o * 2);
      break;
    case 'lion':
      g.fillEllipse(cx + 9.5, 25, 6 + o * 2, 2.4 + o * 2);
      g.fillCircle(cx + 12.5, 24, 2 + o);
      if (!t) g.fillStyle(0x8a4a1a, 1).fillCircle(cx + 12.5, 24, 2);
      break;
    case 'bunny':
      g.fillCircle(cx + 8.5, 24, 3 + o);
      if (!t) g.fillStyle(0xffffff, 1).fillCircle(cx + 8.2, 23.6, 2.4);
      break;
    case 'pig':
      g.fillCircle(cx + 8.5, 22, 1.6 + o);
      g.fillCircle(cx + 10, 20.6, 1.4 + o);
      break;
    case 'duck':
      g.fillTriangle(cx + 6, 18 - o, cx + 12 + o, 15 - o, cx + 7, 24 + o);
      break;
    case 'penguin':
      g.fillTriangle(cx + 6, 24 - o, cx + 10 + o, 27 + o, cx + 5, 27 + o);
      break;
    case 'owl':
      g.fillTriangle(cx + 5, 22 - o, cx + 10 + o, 27 + o, cx + 4, 27 + o);
      break;
    case 'unicorn':
      g.fillEllipse(cx + 9, 23, 5 + o * 2, 8 + o * 2);
      if (!t) g.fillStyle(0xff8ab8, 1).fillEllipse(cx + 9, 23, 3.6, 6.6).fillStyle(0xb88aff, 1).fillEllipse(cx + 9.6, 25.5, 2.4, 2.6);
      break;
    case 'bear':
    case 'panda':
      g.fillCircle(cx + 8, 24, 1.8 + o);
      break;
    case 'frog':
      break;
  }
}

/** What sticks out in front of the face, as a silhouette part. */
function snoutSide(g: Pen, kind: PlushKind, hx: number, hy: number, o: number, col: number): void {
  const t = col === INK;
  switch (kind) {
    case 'bear':
    case 'lion':
      g.fillEllipse(hx - 7, hy + 2.6, 5 + o * 2, 4 + o * 2);
      if (!t) g.fillStyle(kind === 'bear' ? 0xe8c89a : 0xf8e0a0, 1).fillEllipse(hx - 7, hy + 2.6, 5, 4);
      break;
    case 'fox':
      g.fillTriangle(hx - 4, hy - 1 - o, hx - 12 - o, hy + 3, hx - 3, hy + 5 + o);
      if (!t) g.fillStyle(0xfff0e0, 1).fillTriangle(hx - 5, hy + 3, hx - 11, hy + 3.4, hx - 4, hy + 5);
      break;
    case 'duck':
      g.fillEllipse(hx - 8.5, hy + 3, 8 + o * 2, 3.6 + o * 2);
      if (!t) g.fillStyle(0xff8a2a, 1).fillEllipse(hx - 8.5, hy + 3, 8, 3.6);
      break;
    case 'pig':
      g.fillEllipse(hx - 8, hy + 2.4, 3.4 + o * 2, 4.6 + o * 2);
      if (!t) g.fillStyle(0xf8b8c8, 1).fillEllipse(hx - 8, hy + 2.4, 3.4, 4.6);
      break;
    case 'owl':
    case 'penguin':
      g.fillTriangle(hx - 6, hy + 1 - o, hx - 10.5 - o, hy + 3, hx - 6, hy + 5 + o);
      if (!t) g.fillStyle(0xff9a2a, 1).fillTriangle(hx - 6, hy + 1, hx - 10, hy + 3, hx - 6, hy + 5);
      break;
    case 'cat':
    case 'bunny':
    case 'panda':
    case 'unicorn':
      g.fillEllipse(hx - 6.5, hy + 2.4, 4 + o * 2, 3.6 + o * 2);
      if (!t) g.fillStyle(kind === 'unicorn' ? 0xffd0e0 : col, 1).fillEllipse(hx - 6.5, hy + 2.4, 4, 3.6);
      break;
    case 'frog':
      break;
  }
}

/** Ears, horns and tufts, seen edge-on from the side. */
function earsSide(g: Pen, kind: PlushKind, hx: number, hy: number, o: number, col: number): void {
  const t = col === INK;
  switch (kind) {
    case 'bear':
      g.fillCircle(hx + 2, hy - 6.5, 2.8 + o);
      if (!t) g.fillStyle(0xe8c89a, 1).fillEllipse(hx + 1.6, hy - 6.5, 1.2, 2.4);
      break;
    case 'panda':
      g.fillStyle(t ? INK : 0x1e1e22, 1).fillCircle(hx + 2, hy - 6.5, 2.8 + o);
      break;
    case 'bunny':
      // the far ear, then the near one, both upright and leaning back a little
      g.fillEllipse(hx + 3.4, hy - 9.5, 4 + o * 2, 12 + o * 2);
      if (!t) g.fillStyle(shade(col, -0.2), 1).fillEllipse(hx + 3.4, hy - 9.5, 4, 12).fillStyle(col, 1);
      g.fillEllipse(hx + 1.2, hy - 9, 4 + o * 2, 12 + o * 2);
      if (!t) g.fillStyle(0xffa8c8, 1).fillEllipse(hx + 0.8, hy - 9, 1.4, 8);
      break;
    case 'cat':
    case 'fox':
    case 'pig':
    case 'owl':
      g.fillTriangle(hx - 1 - o, hy - 5, hx + 4 + o, hy - 4, hx + 1, hy - (kind === 'fox' ? 12 : kind === 'owl' ? 10 : 11) - o);
      if (!t && (kind === 'cat' || kind === 'fox')) g.fillStyle(kind === 'cat' ? 0xffa8c8 : 0x3a2014, 1).fillTriangle(hx, hy - 5.5, hx + 2.6, hy - 5, hx + 1, hy - 8.5);
      break;
    case 'duck':
      g.fillEllipse(hx + 1, hy - 8, 3 + o * 2, 4 + o * 2);
      break;
    case 'unicorn':
      g.fillTriangle(hx - 0.5 - o, hy - 5, hx + 4 + o, hy - 4, hx + 1.5, hy - 9.5 - o);
      // the horn, raked forward
      g.fillStyle(t ? INK : 0xf0c040, 1).fillTriangle(hx - 4 - o, hy - 5, hx - 1 + o, hy - 6.5, hx - 6, hy - 13 - o);
      if (!t) g.fillStyle(0xc8901a, 1).fillRect(hx - 4, hy - 8, 1.6, 1).fillRect(hx - 5, hy - 10.5, 1, 1);
      // the mane, down the back of the head
      if (!t) g.fillStyle(0xff8ab8, 1).fillEllipse(hx + 5, hy - 2, 4, 9).fillStyle(0xb88aff, 1).fillEllipse(hx + 6, hy + 2, 3, 4);
      break;
    case 'frog':
    case 'penguin':
    case 'lion':
      break;
  }
}

/** One eye, and what the animal has on the near side of its face. */
function faceSide(g: Pen, kind: PlushKind, hx: number, hy: number, body: number): void {
  const eye = (x: number, y: number, r = 1.3) => {
    g.fillStyle(INK, 1).fillCircle(x, y, r);
    g.fillStyle(0xffffff, 1).fillRect(x - 0.7, y - 0.9, 1, 1);
  };
  switch (kind) {
    case 'frog':
      // the eye up on its bump, the long stitched smile, a pink cheek
      g.fillStyle(0xffffff, 1).fillCircle(hx - 3, 6, 2.6);
      g.fillStyle(INK, 1).fillCircle(hx - 3.8, 6.4, 1.4);
      g.fillStyle(0xffffff, 1).fillRect(hx - 4.4, 5.2, 1, 1);
      g.fillStyle(INK, 1).fillRect(hx - 9, 13, 1, 1).fillRect(hx - 8, 14, 7, 1);
      g.fillStyle(0xff8aa0, 0.9).fillEllipse(hx - 2, 12, 3, 2);
      break;
    case 'bear':
    case 'lion':
      eye(hx - 3, hy - 1);
      g.fillStyle(kind === 'lion' ? 0x5a2a14 : INK, 1).fillEllipse(hx - 9.4, hy + 1.8, 2, 1.8);
      g.fillStyle(INK, 1).fillRect(hx - 8.5, hy + 4, 2.5, 1);
      break;
    case 'bunny':
      eye(hx - 3, hy);
      g.fillStyle(0xff8aa0, 1).fillEllipse(hx - 8.4, hy + 1.6, 1.4, 1.4);
      g.fillStyle(shade(body, -0.35), 1).fillRect(hx - 6, hy + 3.5, 3, 1);
      g.fillStyle(0xffa8c8, 0.8).fillEllipse(hx - 2, hy + 2.5, 2.5, 1.6);
      break;
    case 'cat':
      g.fillStyle(INK, 1).fillCircle(hx - 3, hy - 1, 1.5);
      g.fillStyle(0xff8aa0, 1).fillRect(hx - 9, hy + 1.5, 1, 1);
      g.lineStyle(1, shade(body, 0.5), 1).lineBetween(hx - 8, hy + 2.5, hx - 4, hy + 3);
      g.fillStyle(shade(body, -0.3), 1).fillRect(hx, hy - 6, 1, 2).fillRect(hx + 3, hy - 4, 1, 2);
      break;
    case 'duck':
      eye(hx - 3, hy - 1);
      g.fillStyle(0xffb060, 1).fillRect(hx - 11, hy + 2, 4, 1);
      g.fillStyle(0xc8601a, 1).fillRect(hx - 12, hy + 3.5, 6, 1);
      break;
    case 'pig':
      eye(hx - 3, hy - 1.5);
      g.fillStyle(0xa04a60, 1).fillRect(hx - 9, hy + 1.6, 1, 1.6);
      g.fillStyle(0xff8aa0, 0.7).fillEllipse(hx - 2, hy + 2.5, 2.4, 1.4);
      break;
    case 'fox':
      eye(hx - 3.5, hy - 1.5, 1.2);
      g.fillStyle(INK, 1).fillEllipse(hx - 11.5, hy + 3, 1.8, 1.6);
      break;
    case 'panda':
      g.fillStyle(0x1e1e22, 1).fillEllipse(hx - 3, hy, 3.6, 4.4);
      g.fillStyle(0xffffff, 1).fillCircle(hx - 3.2, hy - 0.4, 1);
      g.fillStyle(INK, 1).fillEllipse(hx - 8.4, hy + 1.8, 1.6, 1.4);
      break;
    case 'penguin':
      g.fillStyle(0xf0f0f0, 1).fillEllipse(hx - 3.5, hy + 1, 5, 7);
      eye(hx - 3.6, hy - 0.5, 1.2);
      g.fillStyle(0xff8aa0, 0.7).fillEllipse(hx - 2, hy + 3, 1.8, 1.2);
      break;
    case 'owl':
      g.fillStyle(INK, 1).fillCircle(hx - 3.6, hy, 3.2);
      g.fillStyle(0xffd84a, 1).fillCircle(hx - 3.6, hy, 2.4);
      g.fillStyle(INK, 1).fillCircle(hx - 4.2, hy, 1.4);
      g.fillStyle(0xffffff, 1).fillRect(hx - 5, hy - 1.4, 1, 1);
      break;
    case 'unicorn':
      g.fillStyle(INK, 1).fillRect(hx - 4, hy, 2, 1);
      g.fillStyle(0xd88aa8, 1).fillRect(hx - 8, hy + 2, 1, 1);
      break;
  }
}

// ------------------------------------------------------------------ capsules

const CAPSULE_COLS = [0x8a3ab8, 0x2a8a8a, 0xc84a7a, 0x4a5ab8, 0x6a8a3a];

/**
 * A mystery capsule, sitting on the pile: about twenty pixels across, with a
 * shadowy something in its clear top half.
 */
function drawCapsule(g: Pen, v: number, view: ToyView = 'front'): void {
  const side = view === 'side';
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
  // (end on, the same something is seen edge-on: narrower, and further
  // back in the plastic)
  switch (v % 3) {
    case 0:
      if (side) g.fillEllipse(cx + 1, cy - 4, 4, 6).fillRect(cx, cy - 2, 3, 3);
      else g.fillCircle(cx - 1, cy - 4, 3).fillRect(cx - 3, cy - 2, 5, 3);
      break;
    case 1:
      if (side) g.fillTriangle(cx - 1, cy - 1, cx + 3, cy - 1, cx + 1, cy - 7);
      else g.fillTriangle(cx - 4, cy - 1, cx + 3, cy - 1, cx - 1, cy - 7);
      break;
    default:
      g.fillRect(side ? cx - 1 : cx - 4, cy - 5, side ? 3 : 7, 4);
      g.fillStyle(0xffd84a, 0.6).fillRect(side ? cx : cx - 1, cy - 4, 1, 1);
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
  // the grip notch: on the capsule's right from the glass, so from the
  // right-hand end it faces you, in the middle of the seam
  if (side) {
    g.fillStyle(INK, 1).fillRect(cx - 1, cy - 2, 3, 3);
    g.fillStyle(0x6a6a78, 1).fillRect(cx, cy - 1, 1, 1);
  } else g.fillStyle(INK, 1).fillRect(cx + r - 3, cy - 2, 2, 3);
  // and the shine: a hard white streak across the top, a dot beside it
  g.fillStyle(0xffffff, 0.9).fillEllipse(cx - 4, cy - 6, 5, 2.4);
  g.fillStyle(0xffffff, 0.7).fillRect(cx - 7, cy - 3, 1, 2);
  g.fillStyle(0xffffff, 0.5).fillRect(cx + 5, cy + 5, 2, 1);
}
