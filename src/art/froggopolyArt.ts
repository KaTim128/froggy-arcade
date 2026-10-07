/**
 * ---- FROGGOPOLY'S PIECES OF CARD AND WOOD.
 *
 * The board is printed card: every space has a fine paper grain and a bevel
 * (a light edge top-left, a shadow bottom-right), the colour bars are thick
 * and bevelled too, and the special spaces have little pixel pictures in
 * place of words -- a lightning bolt for the power, a droplet for the water,
 * a coin pouch for the taxes, an arrow for the start, reeds for the swamp and
 * a lily pad for the free space.  Numbers carry a 1px dark outline so they
 * read on any colour.
 *
 * The playing pieces are carved like chess pieces: a round foot, a waisted
 * stem, a collar, and a frog's head on top -- the King with a crown, the
 * Knight with a plumed helm, and (after the night) the Rook, a little tower
 * with eyes peering over the battlements.  Each has a 1px outline and a
 * shadow that stays on the board when the piece hops.
 *
 * And the purchase card's DIORAMAS: four frames each, one for a plot of pond
 * (tinted with its colour set), one for the firefly power works and one for
 * the rain barrel.
 */

import Phaser from 'phaser';
import { text } from '../core/ui';

export type IconKind = 'pwr' | 'h2o' | 'tax' | 'go' | 'swamp' | 'free' | 'goswamp' | 'chance';
export type PieceKind = 'king' | 'knight' | 'rook';
export type DioramaKind = 'prop' | 'pwr' | 'h2o';

export const INK = 0x1a1008;

/** Lighter or darker by k (-1..1). */
export function shade(col: number, k: number): number {
  const c = Phaser.Display.Color.IntegerToColor(col);
  const f = (v: number) => Math.round(Phaser.Math.Clamp(k >= 0 ? v + (255 - v) * k : v * (1 + k), 0, 255));
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

/**
 * A line of pixel text with a 1px outline all round it (and, with `shadow`, a
 * drop shadow under that).  Returned as one container, centred on x,y when
 * `center` is set.
 */
export function outlined(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  col: number,
  opts: { center?: boolean; outline?: number; shadow?: boolean; maxWidth?: number } = {},
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const o = opts.outline ?? INK;
  const make = (dx: number, dy: number, tint: number, alpha = 1) => {
    const t = text(scene, dx, dy, str, tint).setAlpha(alpha);
    if (opts.maxWidth) t.setMaxWidth(opts.maxWidth);
    if (opts.center) t.setOrigin(0.5, 0.5);
    c.add(t);
    return t;
  };
  if (opts.shadow) make(1, 2, 0x000000, 0.55);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) make(dx, dy, o);
  make(0, 0, col);
  return c;
}

/** A line with only a drop shadow under it, for the side panel. */
export function shadowed(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  col: number,
  maxWidth?: number,
): { box: Phaser.GameObjects.Container; height: number } {
  const c = scene.add.container(x, y);
  const sh = text(scene, 1, 1, str, 0x000000).setAlpha(0.6);
  const t = text(scene, 0, 0, str, col);
  if (maxWidth) {
    sh.setMaxWidth(maxWidth);
    t.setMaxWidth(maxWidth);
  }
  c.add([sh, t]);
  return { box: c, height: t.height };
}

// ------------------------------------------------------------------ the card

/** A deterministic little hash, so the paper grain is the same every time. */
function hash(n: number): number {
  let x = (n * 2654435761) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 1274126177) >>> 0;
  return (x >>> 0) / 4294967295;
}

/**
 * One space of card: the paper with its grain and bevel, and its colour bar
 * across the top, thick and bevelled, when it has one.
 */
export function paintCell(g: Phaser.GameObjects.Graphics, i: number, cx: number, cy: number, size: number, paper: number, bar?: number): void {
  const x = cx - size / 2;
  const y = cy - size / 2;
  g.fillStyle(INK, 1).fillRect(x - 0.5, y - 0.5, size, size);
  g.fillStyle(paper, 1).fillRect(x, y, size - 1, size - 1);
  // the grain: a scatter of slightly darker and lighter flecks
  for (let k = 0; k < 16; k++) {
    const fx = Math.floor(hash(i * 97 + k * 7) * (size - 3)) + 1;
    const fy = Math.floor(hash(i * 131 + k * 13) * (size - 3)) + 1;
    g.fillStyle(k % 3 === 0 ? shade(paper, 0.5) : shade(paper, -0.07), 1).fillRect(x + fx, y + fy, 1, 1);
  }
  // a faint print of fibres along the card
  g.fillStyle(shade(paper, -0.04), 1);
  for (let k = 0; k < 3; k++) g.fillRect(x + 2, y + 5 + k * 7 + Math.floor(hash(i + k) * 3), size - 5, 0.5);
  // the bevel
  g.fillStyle(shade(paper, 0.6), 1).fillRect(x, y, size - 1, 1).fillRect(x, y, 1, size - 1);
  g.fillStyle(shade(paper, -0.22), 1).fillRect(x, y + size - 2, size - 1, 1).fillRect(x + size - 2, y, 1, size - 1);
  if (bar !== undefined) {
    const bh = 7;
    g.fillStyle(bar, 1).fillRect(x + 1, y + 1, size - 3, bh);
    g.fillStyle(shade(bar, 0.45), 1).fillRect(x + 1, y + 1, size - 3, 1).fillRect(x + 1, y + 1, 1, bh);
    g.fillStyle(shade(bar, -0.35), 1).fillRect(x + 1, y + bh, size - 3, 1).fillRect(x + size - 3, y + 1, 1, bh);
    // a glint on the lacquer
    g.fillStyle(0xffffff, 0.35).fillRect(x + 3, y + 2, 4, 1);
  }
}

/** The pixel pictures on the special spaces, about 12px across, centred at x,y. */
export function drawIcon(g: Phaser.GameObjects.Graphics, kind: IconKind, x: number, y: number, paper: number): void {
  const P = (pts: number[]) => {
    const v: Phaser.Math.Vector2[] = [];
    for (let k = 0; k < pts.length; k += 2) v.push(new Phaser.Math.Vector2(x + pts[k], y + pts[k + 1]));
    return v;
  };
  const outlinePoly = (pts: number[], fill: number) => {
    g.lineStyle(2, INK, 1).strokePoints(P(pts), true, true);
    g.fillStyle(fill, 1).fillPoints(P(pts), true, true);
  };
  switch (kind) {
    case 'pwr': {
      // a lightning bolt, yellow on a dark spark
      g.fillStyle(0xfff4a0, 0.35).fillCircle(x, y, 7);
      outlinePoly([1.5, -7, -4, 1, -0.5, 1, -2.5, 7, 4.5, -1.5, 1, -1.5, 3.5, -7], 0xffd84a);
      g.fillStyle(0xffffff, 0.8).fillRect(x + 0.5, y - 5.5, 1, 2);
      break;
    }
    case 'h2o': {
      // a droplet with a highlight
      g.fillStyle(INK, 1).fillCircle(x, y + 2, 4.6).fillTriangle(x - 4.4, y + 1, x + 4.4, y + 1, x, y - 6.6);
      g.fillStyle(0x3fb8e8, 1).fillCircle(x, y + 2, 3.6).fillTriangle(x - 3.4, y + 1.2, x + 3.4, y + 1.2, x, y - 5.2);
      g.fillStyle(0x9fe4ff, 1).fillRect(x - 2, y + 0.5, 1, 2).fillRect(x - 1, y - 1, 1, 1);
      g.fillStyle(0x1a6aa0, 1).fillRect(x + 1, y + 4, 2, 1);
      break;
    }
    case 'tax': {
      // a coin pouch, tied at the neck, and a coin beside it
      g.fillStyle(INK, 1).fillEllipse(x - 1, y + 2, 12, 10).fillTriangle(x - 5, y - 6, x + 3, y - 6, x - 1, y - 1);
      g.fillStyle(0xa8743e, 1).fillEllipse(x - 1, y + 2, 10, 8).fillTriangle(x - 4, y - 5, x + 2, y - 5, x - 1, y - 1);
      g.fillStyle(0xc89058, 1).fillRect(x - 4, y, 2, 2);
      g.fillStyle(0xffc830, 1).fillRect(x - 3, y - 2.5, 4, 1);
      g.fillStyle(0x6a4420, 1).fillRect(x - 2, y + 2, 1, 3).fillRect(x, y + 2, 1, 3).fillRect(x - 2, y + 3, 3, 1);
      g.fillStyle(INK, 1).fillCircle(x + 4.5, y + 4, 3);
      g.fillStyle(0xffc830, 1).fillCircle(x + 4.5, y + 4, 2.2);
      g.fillStyle(0xb88a20, 1).fillRect(x + 4, y + 3, 1, 2);
      break;
    }
    case 'go': {
      // a red arrow pointing the way round the board
      outlinePoly([-7, 3, -1, -3, -1, 0, 7, 0, 7, 6, -1, 6, -1, 9], 0xd8202a);
      g.fillStyle(0xff7a6a, 1).fillRect(x, y + 1, 6, 1);
      break;
    }
    case 'swamp':
    case 'goswamp': {
      // reeds and cattails standing in dark water
      g.fillStyle(INK, 1).fillEllipse(x, y + 6, 17, 6);
      g.fillStyle(0x2a6a5a, 1).fillEllipse(x, y + 6, 15, 4);
      g.fillStyle(0x5aa88a, 1).fillRect(x - 5, y + 5, 3, 1).fillRect(x + 2, y + 7, 3, 1);
      for (const [sx, h] of [[-4, 11], [0, 14], [4, 10]] as const) {
        g.fillStyle(INK, 1).fillRect(x + sx - 1, y + 6 - h, 3, h);
        g.fillStyle(0x4a9a3a, 1).fillRect(x + sx, y + 6 - h, 1, h);
        g.fillStyle(INK, 1).fillEllipse(x + sx + 0.5, y + 6 - h + 1, 4, 6);
        g.fillStyle(0x7a4a22, 1).fillEllipse(x + sx + 0.5, y + 6 - h + 1, 2.4, 4.6);
      }
      g.lineStyle(1, 0x5aa83a, 1).lineBetween(x - 2, y + 5, x - 7, y - 2).lineBetween(x + 2, y + 5, x + 7, y - 1);
      if (kind === 'goswamp') {
        // and a red arrow pointing into them
        g.fillStyle(INK, 1).fillRect(x + 6, y - 10, 3, 5).fillTriangle(x + 3.5, y - 6, x + 11.5, y - 6, x + 7.5, y - 1.5);
        g.fillStyle(0xd8202a, 1).fillRect(x + 7, y - 9, 1, 4).fillTriangle(x + 5, y - 5.5, x + 10, y - 5.5, x + 7.5, y - 2.6);
      }
      break;
    }
    case 'free': {
      // a lily pad with its notch and a pink flower
      g.fillStyle(INK, 1).fillEllipse(x, y + 1, 18, 13);
      g.fillStyle(0x46a84e, 1).fillEllipse(x, y + 1, 16, 11);
      g.fillStyle(0x6ac86e, 1).fillEllipse(x - 2, y, 10, 6);
      g.fillStyle(paper, 1).fillTriangle(x, y + 1, x + 9, y - 2, x + 9, y + 4);
      g.lineStyle(1, 0x2e7a3a, 1).lineBetween(x, y + 1, x - 6, y - 2).lineBetween(x, y + 1, x - 6, y + 4).lineBetween(x, y + 1, x, y + 6);
      g.fillStyle(INK, 1).fillCircle(x - 3, y - 4, 3.2);
      g.fillStyle(0xff7ab0, 1).fillCircle(x - 4.2, y - 4, 1.6).fillCircle(x - 1.8, y - 4, 1.6).fillCircle(x - 3, y - 5.4, 1.6);
      g.fillStyle(0xffe080, 1).fillRect(x - 3.5, y - 4.5, 1, 1);
      break;
    }
    case 'chance': {
      // ripples on a pond, under the question
      g.lineStyle(1, 0x7ec8e8, 1).strokeEllipse(x, y + 5, 16, 5);
      g.lineStyle(1, 0xb0e0f8, 1).strokeEllipse(x, y + 5, 9, 3);
      break;
    }
  }
}

// --------------------------------------------------------------- the pieces

export interface PieceLook {
  kind: PieceKind;
  body: number;
  dead?: boolean;
}

/**
 * A carved frog chess piece, standing with its foot at 0,0 (so it is about
 * 16px tall, going up into negative y).  The shadow is NOT part of it: the
 * caller keeps that on the board while the piece hops.
 */
export function drawPiece(g: Phaser.GameObjects.Graphics, look: PieceLook): void {
  const b = look.body;
  const lit = shade(b, 0.35);
  const dark = shade(b, -0.35);
  // outline first, a pixel larger all round, then the piece over it
  const foot = (grow: number, col: number) => {
    g.fillStyle(col, 1);
    g.fillEllipse(0, -1.5, 11 + grow * 2, 4 + grow * 2);
    g.fillPoints([
      new Phaser.Math.Vector2(-4 - grow, -2),
      new Phaser.Math.Vector2(4 + grow, -2),
      new Phaser.Math.Vector2(2.2 + grow, -6.5 - grow),
      new Phaser.Math.Vector2(-2.2 - grow, -6.5 - grow),
    ], true);
    g.fillEllipse(0, -6.8, 7.5 + grow * 2, 2.6 + grow * 2);
  };
  foot(1, INK);
  foot(0, b);
  g.fillStyle(lit, 1).fillRect(-3, -3, 1, 1).fillRect(-2, -5.5, 1, 2);
  g.fillStyle(dark, 1).fillRect(2, -5, 1, 3).fillRect(-4, -1.2, 8, 1);
  // the collar's rim
  g.fillStyle(lit, 1).fillRect(-3, -7.6, 6, 1);

  if (look.kind === 'rook') {
    // a little tower, battlements on top, eyes peering over the wall
    g.fillStyle(INK, 1).fillRect(-4.5, -15.5, 9, 9);
    g.fillStyle(b, 1).fillRect(-3.5, -14.5, 7, 7);
    g.fillStyle(INK, 1).fillRect(-4.5, -18, 3, 3).fillRect(-1.5, -18, 3, 3).fillRect(1.5, -18, 3, 3);
    g.fillStyle(b, 1).fillRect(-3.5, -17, 1.5, 2).fillRect(-0.5, -17, 1.5, 2).fillRect(2.5, -17, 1.5, 2);
    g.fillStyle(dark, 1).fillRect(-1, -11, 2, 3);
    g.fillStyle(0xf2ead8, 1).fillRect(-3, -14, 2, 2).fillRect(1, -14, 2, 2);
    g.fillStyle(INK, 1).fillRect(-2.5, -13.5, 1, 1).fillRect(1.5, -13.5, 1, 1);
    return;
  }
  // the frog's head
  const head = look.dead ? shade(b, -0.1) : b;
  g.fillStyle(INK, 1).fillEllipse(0, -10.5, 10.5, 7.5).fillCircle(-2.4, -13.4, 2.6).fillCircle(2.4, -13.4, 2.6);
  g.fillStyle(head, 1).fillEllipse(0, -10.5, 8.5, 5.5).fillCircle(-2.4, -13.4, 1.8).fillCircle(2.4, -13.4, 1.8);
  g.fillStyle(shade(head, 0.3), 1).fillRect(-3, -11, 2, 1);
  if (look.dead) {
    g.fillStyle(INK, 1);
    for (const ex of [-2.4, 2.4]) {
      // crossed-out eyes
      g.fillRect(ex - 1.5, -14.8, 1, 1).fillRect(ex - 0.5, -13.8, 1, 1).fillRect(ex + 0.5, -12.8, 1, 1);
      g.fillRect(ex + 0.5, -14.8, 1, 1).fillRect(ex - 1.5, -12.8, 1, 1);
    }
    g.fillRect(-1.5, -9, 3, 0.8);
  } else {
    g.fillStyle(0xf2ead8, 1).fillCircle(-2.4, -13.6, 1.2).fillCircle(2.4, -13.6, 1.2);
    g.fillStyle(INK, 1).fillRect(-2.6, -13.8, 1, 1).fillRect(2.2, -13.8, 1, 1);
    g.fillStyle(shade(head, -0.45), 1).fillRect(-2, -9, 4, 0.8);
  }
  if (look.kind === 'king') {
    // a gold crown with three points and a red jewel
    g.fillStyle(INK, 1).fillRect(-4, -17.5, 8, 3.5);
    g.fillTriangle(-4.5, -17, -1.5, -17, -3, -21.5).fillTriangle(-1.5, -17, 1.5, -17, 0, -22.5).fillTriangle(1.5, -17, 4.5, -17, 3, -21.5);
    g.fillStyle(0xffc830, 1).fillRect(-3, -17, 6, 2);
    g.fillTriangle(-3.6, -17, -2.2, -17, -3, -20).fillTriangle(-0.8, -17, 0.8, -17, 0, -21).fillTriangle(2.2, -17, 3.6, -17, 3, -20);
    g.fillStyle(0xd8202a, 1).fillRect(-0.5, -16.6, 1, 1);
    g.fillStyle(0xfff0a0, 1).fillRect(-3, -17, 1, 1);
  } else {
    // a knight's helm over the brow, and a red plume
    g.fillStyle(INK, 1).fillEllipse(0, -15.5, 10, 6);
    g.fillStyle(0xa8b0bc, 1).fillEllipse(0, -15.5, 8, 4);
    g.fillStyle(0xe8eef4, 1).fillRect(-2.5, -17, 2, 1);
    g.fillStyle(0x4a5666, 1).fillRect(-3.5, -14, 7, 0.8);
    g.fillStyle(INK, 1).fillEllipse(3, -19.5, 6, 5);
    g.fillStyle(0xd8202a, 1).fillEllipse(3, -19.5, 4.4, 3.4);
    g.fillStyle(0xff7a6a, 1).fillRect(2, -20.5, 2, 1);
  }
}

// -------------------------------------------------------------- the dioramas

/**
 * One frame (0..3) of the little scene on the purchase card, in a w x h box
 * with its top-left at ox,oy.
 */
export function drawDiorama(g: Phaser.GameObjects.Graphics, kind: DioramaKind, tint: number, f: number, ox: number, oy: number, w: number, h: number): void {
  g.clear();
  g.fillStyle(INK, 1).fillRect(ox - 1, oy - 1, w + 2, h + 2);
  if (kind === 'prop') {
    // a plot of pond under a sky the colour of its set: a cottage on a big
    // lily pad, and a frog hopping over to it from the pad beside
    g.fillStyle(shade(tint, 0.55), 1).fillRect(ox, oy, w, h * 0.45);
    g.fillStyle(shade(tint, 0.75), 1).fillCircle(ox + w - 12, oy + 7, 4);
    g.fillStyle(0x2e7aa8, 1).fillRect(ox, oy + h * 0.45, w, h * 0.55);
    for (let k = 0; k < 4; k++) {
      const rx = ox + ((k * 23 + f * 4) % w);
      g.fillStyle(0x6ab4e0, 1).fillRect(rx, oy + h * 0.55 + (k % 2) * 6, 6, 1);
    }
    // the big pad and the cottage on it
    const px = ox + w * 0.66;
    const py = oy + h * 0.72;
    g.fillStyle(0x2e7a3a, 1).fillEllipse(px, py + 1, 34, 9);
    g.fillStyle(0x46a84e, 1).fillEllipse(px, py, 32, 8);
    g.fillStyle(0xf2ead8, 1).fillRect(px - 7, py - 12, 14, 10);
    g.fillStyle(INK, 1).fillRect(px - 2, py - 7, 4, 5);
    g.fillStyle(0xffe080, f % 2 ? 1 : 0.6).fillRect(px + 3, py - 10, 3, 3);
    g.fillStyle(tint, 1).fillTriangle(px - 9, py - 11, px + 9, py - 11, px, py - 19);
    g.fillStyle(shade(tint, -0.3), 1).fillRect(px - 9, py - 11.5, 18, 1);
    // the hopping frog: on its pad, up, over, and down on the big one
    const path = [
      { x: ox + 14, y: oy + h * 0.74 },
      { x: ox + 24, y: oy + h * 0.5 },
      { x: ox + 34, y: oy + h * 0.46 },
      { x: px - 13, y: py - 1 },
    ];
    g.fillStyle(0x46a84e, 1).fillEllipse(ox + 14, oy + h * 0.78, 16, 5);
    const fr = path[f];
    g.fillStyle(INK, 1).fillEllipse(fr.x, fr.y, 9, 6);
    g.fillStyle(0x6ad46e, 1).fillEllipse(fr.x, fr.y, 7, 4.4);
    g.fillStyle(0xf2ead8, 1).fillRect(fr.x - 2, fr.y - 3, 1.6, 1.6).fillRect(fr.x + 1, fr.y - 3, 1.6, 1.6);
    if (f === 1 || f === 2) g.fillStyle(0x6ad46e, 1).fillRect(fr.x - 5, fr.y + 1, 3, 1).fillRect(fr.x + 2, fr.y + 1, 3, 1);
    // a splash ring where it took off
    if (f >= 1) g.lineStyle(1, 0x9fd4ff, 1 - f * 0.25).strokeEllipse(ox + 14, oy + h * 0.8, 6 + f * 5, 2 + f);
    return;
  }
  if (kind === 'pwr') {
    // night, a jar of fireflies wired to a lamp post, the bulb flickering
    g.fillStyle(0x141a2a, 1).fillRect(ox, oy, w, h);
    g.fillStyle(0x1c2a3a, 1).fillRect(ox, oy + h - 8, w, 8);
    const jx = ox + 26;
    const jy = oy + h - 8;
    g.fillStyle(0x9fd4e0, 0.25).fillRect(jx - 9, jy - 22, 18, 22);
    g.lineStyle(1, 0xc8e0e8, 0.9).strokeRect(jx - 9, jy - 22, 18, 22);
    g.fillStyle(0x8a5a2e, 1).fillRect(jx - 10, jy - 25, 20, 3);
    const flies: Array<[number, number]> = [[-5, -6], [2, -14], [5, -4], [-3, -17], [0, -9]];
    flies.forEach(([fx, fy], k) => {
      const on = (k + f) % 4 !== 0;
      if (on) g.fillStyle(0xfff480, 0.3).fillCircle(jx + fx, jy + fy, 3);
      g.fillStyle(on ? 0xfff480 : 0x5a5a3a, 1).fillRect(jx + fx, jy + fy, 1.5, 1.5);
    });
    // the wire to the lamp
    g.lineStyle(1, 0x5a6a7a, 1).lineBetween(jx + 10, jy - 20, ox + w - 22, oy + 8);
    g.fillStyle(0x4a5666, 1).fillRect(ox + w - 18, oy + 8, 2, h - 16);
    const lit = f !== 2;
    if (lit) g.fillStyle(0xffe080, 0.25).fillCircle(ox + w - 17, oy + 8, 9);
    g.fillStyle(lit ? 0xffe080 : 0x6a6a4a, 1).fillCircle(ox + w - 17, oy + 8, 3);
    // a spark on the wire
    const t = f / 3;
    g.fillStyle(0xffffff, 1).fillRect(jx + 10 + (ox + w - 32 - jx) * t, jy - 20 + (oy + 28 - jy) * t, 1.5, 1.5);
    return;
  }
  // h2o: rain running off a roof into a barrel, the drops falling one by one
  g.fillStyle(0x8aa0b0, 1).fillRect(ox, oy, w, h);
  g.fillStyle(0x6a7f8e, 1).fillRect(ox, oy + h - 7, w, 7);
  for (let k = 0; k < 9; k++) {
    const rx = ox + 4 + k * 11;
    const ry = oy + ((k * 9 + f * 6) % (h - 10));
    g.fillStyle(0xc8e0f0, 1).fillRect(rx, ry, 1, 3);
  }
  const bx = ox + w / 2;
  const by = oy + h - 7;
  g.fillStyle(INK, 1).fillRect(bx - 11, by - 22, 22, 22);
  g.fillStyle(0x8a5a2e, 1).fillRect(bx - 10, by - 21, 20, 21);
  g.fillStyle(0xa8743e, 1).fillRect(bx - 8, by - 21, 3, 21);
  g.fillStyle(0x4a5666, 1).fillRect(bx - 10, by - 17, 20, 2).fillRect(bx - 10, by - 6, 20, 2);
  // the water at the brim, and the drop from the spout falling in
  g.fillStyle(0x3fb8e8, 1).fillRect(bx - 9, by - 21, 18, 2);
  g.fillStyle(0x5a6a7a, 1).fillRect(bx - 2, oy, 4, 6).fillRect(bx - 2, oy + 4, 8, 3);
  const dy = [oy + 9, oy + 13, oy + 18, by - 22][f];
  g.fillStyle(0x3fb8e8, 1).fillCircle(bx + 4, dy, 1.6);
  if (f === 3) g.lineStyle(1, 0xc8f0ff, 1).strokeEllipse(bx + 4, by - 20.5, 8, 2);
}
