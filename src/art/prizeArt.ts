/**
 * ---- THE PRIZES, AND EVERYTHING ELSE THAT GOES IN A POCKET.
 *
 * Drawn the way the creatures are (art/sdf): each thing is a few parts
 * joined into one silhouette with one outline and light from the top left,
 * the details -- a sound hole, a lens, stickers, a cube's tiles -- painted
 * onto it.  Because it is worked out per screen pixel, the same drawing is
 * crisp on the shelf, in a 15px pocket slot and big in the inventory.
 *
 * Units: one unit is a pixel at scale 1; a thing stands on y = 0 and is
 * about 16 units tall, centred on x = 0.
 */

import Phaser from 'phaser';
import { Build, raster, type Pal } from './sdf';
import type { PrizeShape } from '../game/content';

const STEEL = 0xa8b0bc;
const DARKSTEEL = 0x5a606c;
const BLACK = 0x24242c;
const CREAM = 0xf4ecd8;
const RED = 0xd8303a;
const GLASS = 0x6aa8d8;
const WOOD = 0x8a5a2a;
const ORANGE = 0xf08a20;
const PINKISH = 0xf0a0b4;

function mix(a: number, b: number, k: number): number {
  const r = ((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k;
  const g = ((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k;
  const bl = (a & 255) * (1 - k) + (b & 255) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/** A thing's own colours: its base, a lit and a shadowed shade of it. */
export function palOf(col: number): Pal {
  return { col, light: mix(col, 0xffffff, 0.35), dark: mix(col, 0x000000, 0.35) };
}

/** What every prize shape looks like (plus the plush and oddity shapes). */
export type ThingShape =
  | PrizeShape
  | 'bunny'
  | 'plush'
  | 'plushduck'
  | 'plushbunny'
  | 'plushfrog'
  | 'key'
  | 'musicbox'
  | 'glasseye'
  | 'waxhand'
  | 'dollhead'
  | 'amber';

const THINGS: Record<ThingShape, (B: Build) => void> = {
  // ------------------------------------------------------------- prizes
  ring: (B) => {
    // a frog charm on a steel ring
    B.ring(0, -13.6, 2.4, 1, STEEL);
    B.cap(0, -11, 0, -9, 0.4, 0.4, STEEL, 0.3);
    B.e(0, -4.4, 5.6, 4.2, 'b', 0, 1);
    B.c(-2.8, -8.2, 1.8, 'b', 0.8).c(2.8, -8.2, 1.8, 'b', 0.8);
    B.eye(-2.8, -8.4, 1).eye(2.8, -8.4, 1).dl(-2, -3.4, 2, -3.4, 0.35, 'd').de(0, -2.2, 3.6, 1.2, 'l');
  },
  sheet: (B) => {
    // a sticker sheet: a star, a heart, a frog face, a peeled corner
    B.box(0, -7.5, 12, 15, 1, 'b');
    B.tri(6, -15, 6, -11.6, 2.6, -15, CREAM, 0, 0);
    B.dt(-3.6, -13.6, -2.6, -11.6, -4.6, -11.6, 0xffffff).dt(-5, -12.6, -2.2, -12.6, -3.6, -10.8, 0xffffff);
    B.dc(1.4, -12.4, 1.1, RED).dc(3.2, -12.4, 1.1, RED).dt(0.3, -12.1, 4.3, -12.1, 2.3, -9.6, RED);
    B.dc(-2, -5.6, 2.4, 0x5aa83a).dc(-3, -7.2, 0.6, 0xffffff).dc(-1, -7.2, 0.6, 0xffffff);
    B.dc(3, -4, 2, GLASS).dc(2.4, -4.6, 0.6, 0xffffff);
    B.dl(-4.4, -1.6, 4.4, -1.6, 0.35, 'd');
  },
  duck: (B) => {
    B.e(-1, -4.2, 6.2, 4.2, 'b', 0, 1);
    B.tri(-6.4, -5.6, -6.4, -3, -8.8, -6.8, 'b', 0.6);
    B.c(3, -10.4, 3.4, 'b', 1);
    B.e(6.6, -9.8, 2.2, 1.1, ORANGE, 0, 0.4);
    B.de(-1.6, -4.6, 3.2, 1.8, 'd', -0.2).eye(3.8, -11, 0.85);
  },
  bear: (B) => {
    // a teddy: round head, round ears, a light muzzle and belly
    B.e(-3.4, -1.4, 1.8, 1.4, 'b').e(3.4, -1.4, 1.8, 1.4, 'b');
    B.e(0, -5, 4.8, 4.6, 'b', 0, 1);
    B.c(0, -11.4, 4.2, 'b', 1);
    B.c(-3.6, -14.6, 1.6, 'b', 0.6).c(3.6, -14.6, 1.6, 'b', 0.6);
    B.de(0, -4.6, 2.8, 3, 'l').de(0, -10, 1.9, 1.4, 'l').dc(0, -10.6, 0.6, BLACK).eye(-1.6, -12.2, 0.75).eye(1.6, -12.2, 0.75);
    B.dc(-3.6, -14.6, 0.7, 'd').dc(3.6, -14.6, 0.7, 'd');
  },
  bunny: (B) => {
    B.e(-3.2, -1.4, 1.8, 1.4, 'b').e(3.2, -1.4, 1.8, 1.4, 'b');
    B.e(0, -5, 4.6, 4.6, 'b', 0, 1);
    B.c(0, -10.8, 3.8, 'b', 1);
    B.e(-1.8, -16.6, 1.1, 3.6, 'b', -0.15, 0.6).e(1.8, -16.6, 1.1, 3.6, 'b', 0.15, 0.6);
    B.de(-1.8, -16.6, 0.45, 2.4, PINKISH, -0.15).de(1.8, -16.6, 0.45, 2.4, PINKISH, 0.15);
    B.de(0, -4.6, 2.6, 2.8, 'l').dc(0, -10, 0.5, PINKISH).eye(-1.4, -11.4, 0.7).eye(1.4, -11.4, 0.7);
  },
  lamp: (B) => {
    // a lava lamp: a steel cone base and cap, a glowing glass with blobs
    B.tri(-4.6, 0, 4.6, 0, 0, -6, DARKSTEEL, 0.4, 0.5);
    B.cutBox(0, -5.5, 12, 3);
    B.e(0, -10, 3.4, 6, 'l', 0, 0.8);
    B.tri(-2.2, -15.6, 2.2, -15.6, 0, -19, DARKSTEEL, 0.4, 0.4);
    B.dc(-0.6, -7.6, 1.5, 'b').dc(0.8, -11.4, 1.1, 'b').dc(-0.4, -13.6, 0.7, 'b').de(-1.4, -10, 0.5, 3, 0xffffff);
  },
  board: (B) => {
    // a skateboard: a deck with both tails kicked up, trucks and wheels
    B.box(0, -5.6, 16, 2.4, 1.1, 'b');
    B.cap(7.4, -5.6, 10.2, -7.6, 1.2, 1, 'b', 0.6).cap(-7.4, -5.6, -10.2, -7.6, 1.2, 1, 'b', 0.6);
    B.box(-5.2, -3.6, 3.4, 1.4, 0.4, DARKSTEEL, 0, 0.3).box(5.2, -3.6, 3.4, 1.4, 0.4, DARKSTEEL, 0, 0.3);
    B.c(-6.6, -1.6, 1.6, CREAM, 0.3).c(-3.8, -1.6, 1.6, CREAM, 0.3).c(3.8, -1.6, 1.6, CREAM, 0.3).c(6.6, -1.6, 1.6, CREAM, 0.3);
    B.dl(-7, -6.3, 7, -6.3, 0.4, BLACK).dc(0, -5.4, 0.8, 'l');
  },
  headset: (B) => {
    B.ring(0, -8, 6.2, 1.3, 'd');
    B.cutBox(0, -3, 20, 10);
    B.e(-6.4, -5, 2.6, 3.6, 'b', 0, 0.8).e(6.4, -5, 2.6, 3.6, 'b', 0, 0.8);
    B.chain([[-6.4, -3], [-4, -1.2], [-1.2, -1.4]], 0.4, 0.35, BLACK, 0.4).c(-0.8, -1.4, 0.9, BLACK, 0.3);
    B.de(-6.4, -5, 1.4, 2.4, BLACK).de(6.4, -5, 1.4, 2.4, BLACK).dc(6.4, -5, 0.6, 'l');
  },
  guitar: (B) => {
    B.c(-0.6, -4.6, 4.6, 'b', 1).c(0.6, -9.6, 3.4, 'b', 1.4);
    B.box(1.6, -16.6, 2, 10, 0.4, WOOD, 0.08, 0.4);
    B.box(2.2, -22, 3, 3.2, 0.6, 'd', 0.08, 0.3);
    B.dc(0, -7.6, 1.5, BLACK).dl(-2, -3, 2, -3, 0.5, BLACK).dl(0.2, -3, 2.4, -21, 0.18, CREAM).dl(1, -3, 2.9, -21, 0.18, CREAM);
  },
  console: (B) => {
    // a games console standing up: black core between two white fins
    B.box(0, -0.8, 8, 1.6, 0.4, BLACK, 0, 0.3);
    B.e(-3.4, -9, 2.6, 8.4, 'b', 0.08, 0.6).e(3.4, -9, 2.6, 8.4, 'b', -0.08, 0.6);
    B.box(0, -8.6, 3.2, 15, 0.6, BLACK, 0, 0.6);
    B.dl(0, -15.4, 0, -2.6, 0.35, 0x4a8aff).dc(-1, -12, 0.35, STEEL);
  },
  robot: (B) => {
    B.cap(-4.8, -7, -6.4, -3, 0.8, 0.8, DARKSTEEL, 0.4).cap(4.8, -7, 6.4, -3, 0.8, 0.8, DARKSTEEL, 0.4);
    B.box(0, -1, 7, 2, 0.4, DARKSTEEL, 0, 0.3);
    B.box(0, -5.4, 8.6, 7, 1.2, 'b', 0, 0.6);
    B.box(0, -12.4, 7.2, 5.8, 1.4, 'b', 0, 0.6);
    B.cap(0, -15.2, 0, -17.6, 0.35, 0.35, DARKSTEEL, 0.3).c(0, -18.2, 1, RED, 0.2);
    B.glow(-1.6, -12.6, 0.9, 0x6affff).glow(1.6, -12.6, 0.9, 0x6affff).dl(-1.4, -10.6, 1.4, -10.6, 0.3, 'd');
    B.de(0, -5.4, 2.6, 1.8, 'd').dc(-1, -5.4, 0.5, RED).dc(1, -5.4, 0.5, 0x5ad85a);
  },
  ball: (B) => {
    B.c(0, -6.8, 6.6, 'b', 1);
    B.dl(-6, -6.8, 6, -6.8, 0.9, 0xffffff).de(-2.6, -9.6, 1.6, 1, 0xffffff, -0.6);
  },
  car: (B) => {
    B.box(0, -4.2, 17, 5, 2, 'b', 0, 1);
    B.box(-1.4, -8, 9, 4.6, 2, 'b', 0, 1.2);
    B.c(-5, -1.6, 2.4, BLACK, 0.4).c(5, -1.6, 2.4, BLACK, 0.4);
    B.de(-3.6, -8.4, 1.8, 1.4, GLASS).de(1, -8.4, 1.8, 1.4, GLASS).dc(-5, -1.6, 1, STEEL).dc(5, -1.6, 1, STEEL).de(7.8, -4.4, 0.8, 0.7, 0xfff4a0).dl(-6, -3.4, 6, -3.4, 0.35, 'l');
  },
  rocket: (B) => {
    B.tri(-2.6, -4, -6, 0, -2.6, -1, DARKSTEEL, 0.5).tri(2.6, -4, 6, 0, 2.6, -1, DARKSTEEL, 0.5);
    B.e(0, -8, 3, 7.6, 'b', 0, 0.8);
    B.tri(-2.4, -13, 2.4, -13, 0, -19, RED, 0.8);
    B.box(0, -0.6, 3.6, 1.6, 0.4, DARKSTEEL, 0, 0.4);
    B.dc(0, -9.6, 1.4, DARKSTEEL).dc(0, -9.6, 0.9, GLASS).dl(-2.4, -4, 2.4, -4, 0.4, RED);
  },
  camera: (B) => {
    // a camcorder lying on its side: body, lens barrel, handle on top,
    // fold-out screen, eyepiece at the back, the red REC light
    B.box(-1.4, -4.8, 15, 9, 1.4, 'b', 0, 0.8);
    B.cap(6, -5, 10.6, -5, 3, 3.3, BLACK, 0.8);
    B.box(-1.4, -10.4, 11, 2.6, 1, BLACK, 0, 0.6);
    B.cutBox(-1.4, -10.2, 7, 1.2);
    B.box(-9.4, -5.6, 2.4, 3.6, 0.6, BLACK, 0, 0.6);
    B.dc(10.6, -5, 2.4, 0x2a3a5a).dc(10.6, -5, 1.6, GLASS).dc(10, -5.8, 0.6, 0xffffff);
    B.de(-2.6, -4, 3.6, 2.6, BLACK).de(-2.6, -4, 2.8, 1.9, 0x3a6a8a).dc(-6.8, -7.4, 0.7, RED).dl(-7, -1.4, 4, -1.4, 0.3, 'l');
  },
  cube: (B) => {
    // a puzzle cube: nine tiles in their colours on the face
    B.box(0, -6.8, 13, 13, 1.4, BLACK, 0, 0.6);
    const cols = [RED, 0xffd45e, 0x4a8aff, 0x5ad85a, 0xffffff, ORANGE, 0x4a8aff, RED, 0xffd45e];
    for (let i = 0; i < 9; i++) {
      const cx = -4 + (i % 3) * 4;
      const cy = -10.8 + Math.floor(i / 3) * 4;
      B.decals.push({ s: { t: 'box', x: cx, y: cy, hw: 1.6, hh: 1.6, rr: 0.4, a: 0 }, col: cols[i] });
    }
  },
  // --------------------------------------------------- crane plushies
  plush: (B) => THINGS.bear(B),
  plushduck: (B) => THINGS.duck(B),
  plushbunny: (B) => THINGS.bunny(B),
  plushfrog: (B) => {
    B.e(-3.4, -1.2, 2, 1.2, 'b').e(3.4, -1.2, 2, 1.2, 'b');
    B.e(0, -5.4, 5.6, 4.8, 'b', 0, 1.2);
    B.c(-2.8, -10.4, 2.2, 'b', 0.8).c(2.8, -10.4, 2.2, 'b', 0.8);
    B.de(0, -4, 3.4, 2.4, 'l').eye(-2.8, -10.6, 1.2).eye(2.8, -10.6, 1.2).dl(-2, -6.6, 2, -6.6, 0.35, 'd');
  },
  // -------------------------------------------------------- the oddities
  key: (B) => {
    // a brass key: a fat round bow with its hole, the shaft, two teeth
    B.c(-4.6, -6, 3.6, 'b', 1);
    B.box(2.2, -6, 10, 2.8, 0.8, 'b', 0, 0.8);
    B.box(5, -3.6, 1.8, 2.8, 0.4, 'b', 0, 0.4).box(7.2, -3.8, 1.6, 2.4, 0.4, 'b', 0, 0.4);
    B.dc(-4.6, -6, 1.4, 0x2a2018).dl(-1, -6.6, 6.6, -6.6, 0.35, 'l');
  },
  musicbox: (B) => {
    B.box(0, -4, 11, 8, 1, 'b', 0, 0.6);
    B.box(0, -9, 12, 2.6, 0.8, 'd', 0, 0.4);
    B.cap(5.8, -5, 8.4, -5, 0.4, 0.4, 0xd8b04a, 0.3).box(8.6, -5, 1, 3, 0.3, 0xd8b04a, 0, 0.2);
    B.dl(-4.6, -6.6, 4.6, -6.6, 0.3, 0xd8b04a).dc(0, -4, 1.4, 0xd8b04a).dc(0, -4, 0.6, 'd');
  },
  glasseye: (B) => {
    B.c(0, -5.6, 5.4, 0xf4f0e8, 1);
    B.dc(1.4, -5.6, 2.8, 0x3f7fd6).dc(1.6, -5.6, 1.3, BLACK).dc(0.4, -7, 0.7, 0xffffff).dl(-4, -3, -2, -4, 0.2, RED).dl(-4.2, -7.4, -2.4, -6.6, 0.2, RED);
  },
  waxhand: (B) => {
    // an open hand, palm out, fingers up
    B.box(0, -4, 9, 8, 2.2, 'b', 0, 1);
    for (let i = 0; i < 4; i++) B.cap(-3 + i * 2, -7, -3.2 + i * 2.1, -14 + Math.abs(i - 1.5) * 1.1, 0.95, 0.85, 'b', 0.6);
    B.cap(4.2, -4.6, 7, -8, 0.95, 0.85, 'b', 0.6);
    B.dl(-2.6, -2.4, 2.6, -2.4, 0.3, 'd').dl(-2, -5, 1.6, -4.4, 0.25, 'd');
  },
  dollhead: (B) => {
    B.e(0, -6, 4.8, 5.6, 'b', 0, 1);
    B.e(0, -10.6, 5, 2.6, 0x5a3a20, 0, 0.8);
    B.de(-1.8, -6, 0.9, 0.6, BLACK).de(1.8, -6, 0.9, 0.6, BLACK).dc(-2.8, -4.4, 0.8, PINKISH).dc(2.8, -4.4, 0.8, PINKISH).de(0, -2.8, 0.9, 0.45, RED);
  },
  amber: (B) => {
    B.e(0, -5.6, 4.6, 5.6, 'b', 0.2, 1);
    B.de(-0.2, -5.6, 2.2, 0.9, 0x5a3a20, 0.3).dt(-0.4, -6, -3, -8.4, -2.4, -4.8, 0x6a4a2a).dt(0, -6, 2.6, -8.6, 2.2, -4.8, 0x6a4a2a).de(-1.6, -8.4, 0.8, 1.6, 0xffffff, -0.4);
  },
};

/**
 * Draw `shape` in `col`, standing on (x, y), at `scale`, into a fresh
 * Graphics (returned, so a caller can keep or destroy it).
 */
export function drawThing(scene: Phaser.Scene, shape: ThingShape, col: number, x: number, y: number, scale = 1, fit?: { w: number; h: number }): Phaser.GameObjects.Graphics {
  const B = new Build();
  (THINGS[shape] ?? THINGS.cube)(B);
  const desc = B.done();
  let r = raster(desc, scale, 1, palOf(col));
  let bb = bounds(r.runs);
  // FIT A BOX: a slot is a slot, and nothing hangs out of it -- a long thing
  // (a camera, a guitar's neck) is drawn smaller until the whole of it is in
  for (let k = 0, s = scale; fit && k < 4 && (bb.w > fit.w || bb.h > fit.h); k++) {
    s *= Math.min(fit.w / bb.w, fit.h / bb.h) * 0.98;
    r = raster(desc, s, 1, palOf(col));
    bb = bounds(r.runs);
  }
  const g = scene.add.graphics();
  // (and in a box it is centred by what is actually drawn, standing on y)
  const ox = Math.round(x) - (fit ? Math.round(bb.x0 + bb.w / 2) : 0);
  const oy = Math.round(y) - (fit ? bb.y1 : 0);
  r.cols.forEach((c, i) => {
    g.fillStyle(c, 1);
    const runs = r.runs[i];
    for (let k = 0; k < runs.length; k += 3) g.fillRect(ox + runs[k], oy + runs[k + 1], runs[k + 2], 1);
  });
  return g;
}

/** The pixels a raster covers: left edge, width, height, and one past the bottom row. */
function bounds(runs: number[][]): { x0: number; w: number; h: number; y1: number } {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const rr of runs)
    for (let k = 0; k < rr.length; k += 3) {
      x0 = Math.min(x0, rr[k]);
      x1 = Math.max(x1, rr[k] + rr[k + 2]);
      y0 = Math.min(y0, rr[k + 1]);
      y1 = Math.max(y1, rr[k + 1] + 1);
    }
  return x0 === Infinity ? { x0: 0, w: 0, h: 0, y1: 0 } : { x0, w: x1 - x0, h: y1 - y0, y1 };
}
