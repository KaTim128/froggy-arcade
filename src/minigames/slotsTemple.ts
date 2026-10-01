/**
 * FROGGY SLOTS, IN THE TOMB.
 *
 * The machine stands in a temple of the frog: sandstone walls in torchlight,
 * papyrus columns either side, a lotus frieze under the ceiling and a band of
 * hieroglyphs along the floor -- every one of them with a frog somewhere in
 * it.  The reel window is a gold and lapis shrine with the wings of the sun
 * spread across its lintel and Froggy himself above them in the striped
 * headcloth of a pharaoh; the paytable is a lapis tablet.  Two braziers burn
 * at the foot of the columns and the light moves with them.
 *
 * All of it is scenery.  It is drawn where the old flat panels were -- the
 * reel window and the tablet keep their exact rectangles, and nothing is
 * drawn over the reels, the text or the buttons -- so nothing about the
 * machine itself moves.  `update` only flickers the fire.
 */

import Phaser from 'phaser';
import { GAME_W } from '../render/pixelScaler';

// ---- the temple's colours
export const GOLD = 0xd9a93a;
export const GOLD_LIT = 0xf2cf6a;
export const GOLD_DK = 0x8a6420;
export const LAPIS = 0x1b2f6b;
export const LAPIS_DK = 0x0f1a3e;
export const TURQUOISE = 0x2f9e94;
const SAND = 0xb88a4a;
const SAND_LIT = 0xd4a864;
const SAND_DK = 0x7a5629;
const STONE = 0x2a1c0e;
const STONE_DK = 0x170f07;
const FROG_GREEN = 0x5fae4a;
const FROG_DK = 0x2f6a2a;
const RED = 0x9a2a1a;

/** The rectangles the machine already uses, which the temple frames and never covers. */
const WINDOW = { x: 14, y: 26, w: 164, h: 108 };
const TABLET = { x: 184, y: 26, w: 128, h: 108 };
const TOP = 18;
const BOTTOM = 180;

type G = Phaser.GameObjects.Graphics;

const px = (g: G, color: number, x: number, y: number, w = 1, h = 1, a = 1): void => {
  g.fillStyle(color, a).fillRect(x, y, w, h);
};

/**
 * One hieroglyph, about five pixels by six, top-left at (x, y).  A small
 * alphabet, and the frog is in it more than once: the tadpole is the scribes'
 * sign for a hundred thousand, and in this temple it is also him.
 */
type Glyph = 'frog' | 'ankh' | 'eye' | 'reed' | 'water' | 'scarab' | 'lotus' | 'tadpole' | 'sun';
function glyph(g: G, kind: Glyph, x: number, y: number, c: number, a = 1): void {
  const p = (dx: number, dy: number, w = 1, h = 1) => px(g, c, x + dx, y + dy, w, h, a);
  switch (kind) {
    case 'frog':
      p(0, 1);
      p(4, 1);
      p(1, 2, 3);
      p(0, 3, 5);
      p(1, 4, 3);
      p(0, 5);
      p(4, 5);
      break;
    case 'ankh':
      p(1, 0, 3);
      p(1, 1);
      p(3, 1);
      p(2, 2);
      p(0, 3, 5);
      p(2, 4, 1, 2);
      break;
    case 'eye':
      p(1, 1, 3);
      p(0, 2);
      p(2, 2);
      p(4, 2);
      p(1, 3, 3);
      p(1, 4);
      p(3, 4, 1, 2);
      break;
    case 'reed':
      p(2, 0);
      p(1, 1, 2);
      p(2, 2, 1, 4);
      p(3, 1);
      break;
    case 'water':
      p(0, 2);
      p(2, 2);
      p(4, 2);
      p(1, 3);
      p(3, 3);
      p(0, 4);
      p(2, 4);
      p(4, 4);
      p(1, 5);
      p(3, 5);
      break;
    case 'scarab':
      p(2, 0);
      p(1, 1, 3);
      p(0, 2, 5);
      p(1, 3, 3);
      p(0, 4);
      p(2, 4);
      p(4, 4);
      p(1, 5, 3);
      break;
    case 'lotus':
      p(2, 0);
      p(1, 1, 3);
      p(0, 2);
      p(2, 2);
      p(4, 2);
      p(1, 3, 3);
      p(2, 4, 1, 2);
      break;
    case 'tadpole':
      p(1, 0, 2, 2);
      p(0, 1);
      p(3, 1);
      p(1, 2, 2);
      p(2, 3);
      p(1, 4);
      p(2, 5);
      break;
    case 'sun':
      p(1, 0, 3);
      p(0, 1, 5, 3);
      p(1, 4, 3);
      p(2, 5);
      break;
  }
}

/** A run of glyphs along a band, spaced `step` apart. */
function glyphRun(g: G, x0: number, x1: number, y: number, step: number, c: number, a: number, seed: number): void {
  const order: Glyph[] = ['frog', 'ankh', 'eye', 'reed', 'frog', 'water', 'scarab', 'lotus', 'tadpole', 'sun'];
  let i = seed;
  for (let x = x0; x + 5 <= x1; x += step) glyph(g, order[i++ % order.length], x, y, c, a);
}

// -------------------------------------------------------------- the pieces

/** Sandstone courses, dark with age, and the soot the braziers leave above them. */
function walls(g: G): void {
  px(g, STONE, 0, TOP, GAME_W, BOTTOM - TOP);
  for (let row = 0, y = TOP + 8; y < BOTTOM; row++, y += 9) {
    px(g, STONE_DK, 0, y, GAME_W, 1);
    const off = row % 2 ? 11 : 0;
    for (let x = off; x < GAME_W; x += 22) px(g, STONE_DK, x, y + 1, 1, 8);
    // a little variation in the blocks, so it is masonry and not a grid
    for (let x = off + 3; x < GAME_W; x += 22) if ((x * 7 + row * 13) % 5 === 0) px(g, 0x33230f, x, y + 2, 16, 6, 0.6);
  }
}

/** Under the ceiling: a lapis band with gold lotus buds, point down. */
function frieze(g: G): void {
  px(g, LAPIS_DK, 0, TOP, GAME_W, 8);
  px(g, GOLD, 0, TOP, GAME_W, 1);
  px(g, GOLD_DK, 0, TOP + 7, GAME_W, 1);
  for (let x = 2; x < GAME_W; x += 8) {
    px(g, GOLD, x, TOP + 2, 5, 1);
    px(g, GOLD, x + 1, TOP + 3, 3, 1);
    px(g, GOLD, x + 2, TOP + 4, 1, 1);
    px(g, TURQUOISE, x + 6, TOP + 3, 1, 2);
  }
}

/** Along the floor: the hieroglyph band, gold on lapis, between gold rules. */
function floorBand(g: G): void {
  const y = 172;
  px(g, LAPIS, 0, y, GAME_W, BOTTOM - y);
  px(g, GOLD, 0, y, GAME_W, 1);
  glyphRun(g, 3, GAME_W - 3, y + 1, 9, GOLD_LIT, 0.85, 0);
}

/** A papyrus column: shaft, bands, and an open lotus capital. */
function column(g: G, x: number, w: number): void {
  const y0 = TOP + 8;
  const y1 = 172;
  px(g, SAND, x, y0, w, y1 - y0);
  px(g, SAND_LIT, x + 1, y0, 2, y1 - y0);
  px(g, SAND_DK, x + w - 2, y0, 2, y1 - y0);
  // the reeds of the shaft
  for (let dx = 3; dx < w - 2; dx += 3) px(g, SAND_DK, x + dx, y0 + 12, 1, y1 - y0 - 24, 0.5);
  // capital and base
  px(g, GOLD, x - 1, y0, w + 2, 3);
  px(g, LAPIS, x - 1, y0 + 3, w + 2, 2);
  px(g, TURQUOISE, x, y0 + 5, w, 1);
  px(g, GOLD, x - 1, y0 + 6, w + 2, 2);
  px(g, LAPIS, x - 1, y1 - 8, w + 2, 2);
  px(g, GOLD, x - 1, y1 - 6, w + 2, 6);
  // bands down the shaft with a cartouche frog in the middle one
  for (const by of [y0 + 40, y0 + 90]) {
    px(g, RED, x, by, w, 1);
    px(g, LAPIS, x, by + 1, w, 2);
    px(g, RED, x, by + 3, w, 1);
  }
  if (w >= 8) glyph(g, 'frog', x + Math.floor((w - 5) / 2), y0 + 62, FROG_DK, 0.9);
}

/**
 * The reel window's shrine: a gold frame with a lapis inlay, rosettes at the
 * corners, and the winged sun spread across the lintel.
 */
function shrine(g: G): void {
  const { x, y, w, h } = WINDOW;
  px(g, GOLD_DK, x - 2, y - 2, w + 4, h + 4);
  px(g, GOLD, x - 1, y - 1, w + 2, h + 2);
  px(g, LAPIS, x + 1, y + 1, w - 2, h - 2);
  // a turquoise inlay line inside the gold
  g.lineStyle(1, TURQUOISE, 1).strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  // the recess the reels are set into
  px(g, 0x080a16, x + 6, y + 6, w - 12, h - 12);
  for (const [cx, cy] of [
    [x, y],
    [x + w - 5, y],
    [x, y + h - 5],
    [x + w - 5, y + h - 5],
  ]) {
    px(g, GOLD_LIT, cx, cy, 5, 5);
    px(g, RED, cx + 1, cy + 1, 3, 3);
    px(g, TURQUOISE, cx + 2, cy + 2, 1, 1);
  }
  // the wings, spread either side of the crest along the lintel
  const cx = x + w / 2;
  for (let i = 0; i < 9; i++) {
    const len = 26 - i * 2;
    px(g, i % 2 ? GOLD : GOLD_LIT, cx - 8 - len, y - 5 + i * 0.5, len, 1);
    px(g, i % 2 ? GOLD : GOLD_LIT, cx + 8, y - 5 + i * 0.5, len, 1);
  }
  px(g, LAPIS, cx - 34, y - 5, 26, 1, 0.5);
  px(g, LAPIS, cx + 8, y - 5, 26, 1, 0.5);
}

/**
 * Above the wings: HIM, as a pharaoh.  The striped headcloth, gold and
 * lapis, falling either side of a round green face; the two eyes up on top
 * of it the way a frog's are, lined in kohl; a cobra of gold on his brow.
 */
function pharaoh(g: G): void {
  const cx = WINDOW.x + WINDOW.w / 2;
  const top = TOP + 1;
  // the headcloth: a trapezoid of stripes, wider at the shoulders
  for (let row = 0; row < 12; row++) {
    const half = 5 + Math.floor(row * 0.75);
    px(g, row % 2 ? LAPIS : GOLD, cx - half, top + row, half * 2, 1);
  }
  // the face
  px(g, FROG_DK, cx - 5, top + 3, 10, 8);
  px(g, FROG_GREEN, cx - 4, top + 3, 8, 7);
  // the eyes, up on top, lined in kohl with the long wing of it
  for (const s of [-1, 1]) {
    const ex = cx + s * 3 - (s < 0 ? 2 : 0);
    px(g, FROG_GREEN, ex, top + 1, 3, 3);
    px(g, 0xf4f0d8, ex + 0.5, top + 1.5, 2, 2);
    px(g, 0x080808, ex + 1, top + 2, 1, 1);
    px(g, 0x080808, s < 0 ? ex - 1 : ex + 3, top + 3, 1, 1);
  }
  // the mouth: a long flat smile
  px(g, FROG_DK, cx - 3, top + 8, 6, 1);
  // the uraeus
  px(g, GOLD_LIT, cx - 0.5, top - 1, 1, 3);
  px(g, RED, cx - 0.5, top - 1, 1, 1);
  // the false beard
  px(g, GOLD, cx - 1, top + 10, 2, 3);
  px(g, LAPIS, cx - 1, top + 11, 2, 1);
}

/** The paytable is carved on a lapis tablet with a gold border and a glyph footer. */
function tablet(g: G): void {
  const { x, y, w, h } = TABLET;
  px(g, GOLD_DK, x - 2, y - 2, w + 4, h + 4);
  px(g, GOLD, x - 1, y - 1, w + 2, h + 2);
  px(g, LAPIS_DK, x + 1, y + 1, w - 2, h - 2);
  g.lineStyle(1, TURQUOISE, 0.8).strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
  // a cartouche rule under the header line
  px(g, GOLD_DK, x + 6, y + 13, w - 12, 1);
  // and the footer, under the last row of pays
  px(g, GOLD_DK, x + 6, y + h - 12, w - 12, 1);
  glyphRun(g, x + 8, x + w - 8, y + h - 10, 10, GOLD, 0.7, 3);
}

/** A brazier on three legs: its bowl, and its fire drawn fresh each frame. */
function brazier(g: G, x: number): void {
  const y = 150;
  px(g, GOLD_DK, x - 4, y, 9, 3);
  px(g, GOLD, x - 3, y + 1, 7, 1);
  px(g, GOLD_DK, x - 3, y + 3, 1, 19);
  px(g, GOLD_DK, x + 3, y + 3, 1, 19);
  px(g, GOLD_DK, x, y + 3, 1, 19);
  px(g, GOLD_DK, x - 4, y + 21, 9, 1);
}

// ------------------------------------------------------------ the whole room

export interface Temple {
  /** Flicker the fire.  Call from the module's own update. */
  update(ms: number): void;
}

export function buildTemple(scene: Phaser.Scene): Temple {
  const g = scene.add.graphics();
  walls(g);
  frieze(g);
  // the torchlight on the walls, warm and low, before anything stands in it
  // (a soft radial falloff, not a disc: light, not a shape)
  if (!scene.textures.exists('temple_glow')) {
    const tex = scene.textures.createCanvas('temple_glow', 64, 64);
    if (tex) {
      const ctx = tex.getContext();
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,154,58,1)');
      grad.addColorStop(0.45, 'rgba(255,120,40,0.35)');
      grad.addColorStop(1, 'rgba(255,100,30,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      tex.refresh();
    }
  }
  const glows = [7, GAME_W - 4].map((x) =>
    scene.add.image(x, 144, 'temple_glow').setDisplaySize(90, 110).setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD),
  );
  column(g, 0, 11);
  column(g, GAME_W - 7, 7);
  floorBand(g);
  shrine(g);
  tablet(g);
  pharaoh(g);
  brazier(g, 6);
  brazier(g, GAME_W - 4);

  const fire = scene.add.graphics();
  const flame = (x: number, t: number, seed: number): void => {
    const y = 150;
    const h = 7 + Math.sin(t * 0.013 + seed) * 1.5 + Math.sin(t * 0.031 + seed * 2) * 1;
    const sway = Math.sin(t * 0.009 + seed) * 1;
    fire.fillStyle(0xc2410c, 1).fillTriangle(x - 4, y, x + 4, y, x + sway, y - h);
    fire.fillStyle(0xff9a3a, 1).fillTriangle(x - 3, y, x + 3, y, x + sway * 1.2, y - h * 0.75);
    fire.fillStyle(0xffe08a, 1).fillTriangle(x - 1.5, y, x + 1.5, y, x + sway * 1.4, y - h * 0.45);
  };
  const draw = (t: number): void => {
    fire.clear();
    flame(6, t, 0);
    flame(GAME_W - 4, t, 2.1);
    const k = 0.3 + Math.sin(t * 0.017) * 0.05 + Math.sin(t * 0.047) * 0.035;
    for (const gl of glows) gl.setAlpha(k);
  };
  draw(0);
  return { update: draw };
}
