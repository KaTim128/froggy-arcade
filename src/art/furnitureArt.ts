/**
 * ---- THE FURNITURE, DRAWN AS THE HOTEL'S OWN THINGS ARE.
 *
 * Everything in the flat is painted to the standard of the room it stands
 * in (art/hotelInterior): a one-pixel dark outline, a lit top edge and a
 * shadowed bottom one, and then the MATERIAL itself -- oak with its grain
 * and the odd knot, cloth with its weave and the dent where somebody sat,
 * steel with a vertical sheen, glass with a diagonal catch of light.
 * Nothing is a flat rectangle of colour: every piece has its legs, its
 * panels, its handles and a soft contact shadow where it meets the floor.
 *
 * One function per category, all drawn standing on (`x`, `y`) = the middle
 * of the item's base -- so the shop preview and the flat use exactly the
 * same drawing.  The few pieces that deserve their own picture (the glass
 * table, the record player, the wardrobe, the bean bag) are keyed by id.
 *
 * The speckle and the grain are HASHED, never random: the same piece is the
 * same piece every time the room is painted again.
 */

import Phaser from 'phaser';
import type { FurnitureDef } from '../game/catalog';
import { MIRROR_GLASS, paintMirror, paintMirrorShine } from './shopFittings';

type G = Phaser.GameObjects.Graphics;

const OUT = 0x14100c;

const shade = (c: number, k: number): number => {
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 255) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((c >> 8) & 255) * k)));
  const b = Math.min(255, Math.max(0, Math.round((c & 255) * k)));
  return (r << 16) | (g << 8) | b;
};

/** Mix two colours, `k` of the way from `c` to `d`. */
const mix = (c: number, d: number, k: number): number => {
  const ch = (sh: number) => Math.round((((c >> sh) & 255) * (1 - k) + ((d >> sh) & 255) * k));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** The same number for the same input, every time: the grain never crawls. */
const nz = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const px = (g: G, x: number, y: number, w: number, h: number, col: number, a = 1): void => {
  if (w <= 0 || h <= 0) return;
  g.fillStyle(col, a).fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
};

/** A box with its outline, a lit top edge, a shadowed foot and a lit left side. */
function slab(g: G, x: number, y: number, w: number, h: number, col: number, line = true): void {
  if (w <= 0 || h <= 0) return;
  if (line) px(g, x - 1, y - 1, w + 2, h + 2, OUT);
  px(g, x, y, w, h, col);
  px(g, x, y, w, 1, shade(col, 1.2));
  px(g, x, y + h - 1, w, 1, shade(col, 0.72));
  px(g, x, y, 1, h, shade(col, 1.1));
  px(g, x + w - 1, y, 1, h, shade(col, 0.84));
}

/** A panel sunk into a face: the bevel lit at the top left, dark at the foot. */
function panel(g: G, x: number, y: number, w: number, h: number, col: number): void {
  if (w < 3 || h < 3) return;
  px(g, x, y, w, h, shade(col, 0.76));
  px(g, x + 1, y + 1, w - 1, h - 1, shade(col, 1.08));
  px(g, x + 1, y + 1, w - 2, h - 2, col);
}

/** Oak, walnut, pine: long vertical streaks, a few cathedral arcs, a knot. */
function wood(g: G, x: number, y: number, w: number, h: number, col: number, seed: number, along: 'v' | 'h' = 'h'): void {
  const dark = shade(col, 0.86);
  const light = shade(col, 1.1);
  if (along === 'h') {
    for (let k = 0; k < Math.max(2, h / 2); k++) {
      const yy = y + 1 + Math.floor(nz(seed + k * 3.3) * (h - 2));
      const x0 = x + Math.floor(nz(seed + k * 7.1) * (w / 2));
      const ww = Math.max(2, Math.floor(w * (0.3 + nz(seed + k * 5.7) * 0.6)));
      px(g, x0, yy, Math.min(ww, x + w - x0), 1, k % 3 ? dark : light, 0.5);
    }
  } else {
    for (let k = 0; k < Math.max(2, w / 3); k++) {
      const xx = x + 1 + Math.floor(nz(seed + k * 4.1) * (w - 2));
      const y0 = y + Math.floor(nz(seed + k * 2.9) * (h / 2));
      const hh = Math.max(2, Math.floor(h * (0.4 + nz(seed + k * 6.3) * 0.6)));
      px(g, xx, y0, 1, Math.min(hh, y + h - y0), k % 3 ? dark : light, 0.5);
    }
  }
  // a knot, where there is room for one
  if (w > 9 && h > 5) {
    const kx = x + 2 + Math.floor(nz(seed + 19) * (w - 5));
    const ky = y + 1 + Math.floor(nz(seed + 23) * (h - 3));
    px(g, kx, ky, 2, 1, shade(col, 0.7), 0.7);
    px(g, kx, ky + 1, 2, 1, shade(col, 0.8), 0.4);
  }
}

/** Cloth: a weave of lighter and darker threads, and the nap catching light. */
function cloth(g: G, x: number, y: number, w: number, h: number, col: number, seed: number): void {
  const d = shade(col, 0.88);
  const l = shade(col, 1.12);
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x + ((yy - y) % 2); xx < x + w; xx += 2) {
      const n = nz(seed + xx * 1.7 + yy * 9.1);
      if (n > 0.72) px(g, xx, yy, 1, 1, l, 0.35);
      else if (n < 0.22) px(g, xx, yy, 1, 1, d, 0.4);
    }
  }
}

/** Brushed steel or chrome: vertical sheen with a bright edge. */
function metal(g: G, x: number, y: number, w: number, h: number, col = 0xa8acb0): void {
  px(g, x, y, w, h, col);
  for (let k = 1; k < w; k += 3) px(g, x + k, y, 1, h, shade(col, 1.22), 0.5);
  px(g, x, y, w, 1, shade(col, 1.3));
  px(g, x, y + h - 1, w, 1, shade(col, 0.72));
}

/** The dark pool a thing sits in, where it meets the floor. */
function contact(g: G, x: number, y: number, w: number): void {
  g.fillStyle(0x000000, 0.18).fillEllipse(x, y + 1, w, Math.max(3, w * 0.16));
  g.fillStyle(0x000000, 0.12).fillEllipse(x, y + 1, w * 1.25, Math.max(4, w * 0.22));
}

/** A turned or tapered leg, with its own outline. */
function leg(g: G, x: number, y: number, w: number, h: number, col: number): void {
  px(g, x - 1, y, w + 2, h + 1, OUT);
  px(g, x, y, w, h, shade(col, 0.72));
  px(g, x, y, 1, h, shade(col, 0.95));
  px(g, x, y + h - 2, w, 2, shade(col, 0.55));
}

/** A little steel or brass handle. */
function handle(g: G, x: number, y: number, w: number, brass = false): void {
  const c = brass ? 0xc8a24a : 0xc4c8cc;
  px(g, x, y, w, 1, shade(c, 1.25));
  px(g, x, y + 1, w, 1, shade(c, 0.6));
}

/** Draw `f` standing on (x, y) -- `flip` turns it round. */
export function drawFurniture(g: G, f: FurnitureDef, x: number, y: number, flip = false): void {
  const { w, h, a, b } = f;
  const L = Math.round(x - w / 2);
  const T = Math.round(y - h);
  const R = L + w;
  const seed = (f.id.length * 31 + f.w * 7 + f.h * 13) % 997;
  const fx = (dx: number, ww = 1) => (flip ? L + w - dx - ww : L + dx);
  if (!f.wall) contact(g, x, y, w);

  switch (f.cat) {
    // ------------------------------------------------------- on the wall
    case 'poster':
    case 'painting': {
      const framed = f.cat === 'painting';
      const fr = framed ? (f.id === 'fur_paint_gold' ? 0xc8a24a : 0x6a4a28) : 0xe8e0c8;
      // the frame, with its gilt or wood bevel and the wall's shadow under it
      g.fillStyle(0x000000, 0.2).fillRect(L + 2, T + h, w - 2, 2);
      px(g, L - 1, T - 1, w + 2, h + 2, OUT);
      px(g, L, T, w, h, fr);
      px(g, L, T, w, 1, shade(fr, 1.3));
      px(g, L, T, 1, h, shade(fr, 1.18));
      px(g, L + w - 1, T, 1, h, shade(fr, 0.74));
      px(g, L, T + h - 1, w, 1, shade(fr, 0.66));
      if (framed) wood(g, L, T, w, h, fr, seed);
      const m = framed ? 2 : 1;
      // the mount, then the picture itself
      px(g, L + m, T + m, w - m * 2, h - m * 2, framed ? 0xf2efe6 : fr);
      const ix = L + m + (framed ? 1 : 0);
      const iy = T + m + (framed ? 1 : 0);
      const iw = w - (m + (framed ? 1 : 0)) * 2;
      const ih = h - (m + (framed ? 1 : 0)) * 2;
      px(g, ix, iy, iw, ih, a);
      // a horizon and a shape on it: sky over land, however it is coloured
      px(g, ix, iy + Math.floor(ih * 0.55), iw, ih - Math.floor(ih * 0.55), b);
      px(g, ix, iy + Math.floor(ih * 0.55), iw, 1, shade(b, 1.2));
      g.fillStyle(shade(a, 1.35), 1).fillCircle(ix + iw * 0.3, iy + ih * 0.3, Math.max(1, Math.min(iw, ih) / 7));
      for (let k = 0; k < Math.max(1, iw / 6); k++) {
        const bx = ix + 1 + Math.floor(nz(seed + k * 3.7) * (iw - 2));
        px(g, bx, iy + Math.floor(ih * 0.55) - 1 - Math.floor(nz(seed + k) * 2), 1, 2 + Math.floor(nz(seed + k * 2) * 2), shade(b, 0.7), 0.8);
      }
      // the glass over it: one diagonal catch of light
      for (let d = 0; d < Math.min(iw, ih) / 2; d++) px(g, ix + 1 + d, iy + 1 + d, 1, 1, 0xffffff, 0.14);
      break;
    }

    // ------------------------------------------------------------ tables
    case 'table': {
      const glass = f.id === 'fur_table_glass';
      const crate = f.id === 'fur_table_crate';
      const topH = Math.max(2, Math.round(h * 0.22));
      const legW = Math.max(2, Math.round(w * 0.1));
      if (crate) {
        // a crate on its side: slats, a gap between them, stencilled letters
        slab(g, L, T, w, h, a);
        for (let k = 1; k < 4; k++) px(g, L + 1, T + Math.round((k * h) / 4), w - 2, 1, shade(a, 0.6));
        for (const sx of [L + 2, R - 3]) px(g, sx, T + 1, 1, h - 2, shade(a, 0.78));
        wood(g, L + 1, T + 1, w - 2, h - 2, a, seed);
        px(g, L + Math.round(w * 0.3), T + Math.round(h * 0.45), Math.round(w * 0.4), 2, shade(b, 1.1), 0.6);
        break;
      }
      // the legs first, so the top sits over them
      for (const lx of [L + 1, R - 1 - legW]) leg(g, lx, T + topH, legW, h - topH, glass ? 0xb0b4b8 : a);
      if (h > 8) px(g, L + 2, y - Math.max(2, Math.round(h * 0.25)), w - 4, 1, shade(glass ? 0xb0b4b8 : a, 0.6));
      // the apron
      if (!glass) {
        px(g, L + 1, T + topH, w - 2, Math.max(1, Math.round(h * 0.16)), shade(a, 0.8));
        px(g, L + 1, T + topH, w - 2, 1, shade(a, 0.62));
      }
      // the top
      if (glass) {
        px(g, L - 1, T - 1, w + 2, topH + 2, OUT);
        px(g, L, T, w, topH, mix(a, 0xffffff, 0.35), 0.75);
        px(g, L, T, w, 1, 0xffffff, 0.8);
        px(g, L, T + topH - 1, w, 1, shade(a, 0.7));
        for (let d = 0; d < w / 3; d += 2) px(g, L + 2 + d, T + 1, 1, Math.max(1, topH - 2), 0xffffff, 0.2);
      } else {
        slab(g, L, T, w, topH, a);
        wood(g, L, T, w, topH, a, seed);
        px(g, L, T, w, 1, shade(a, 1.28));
      }
      // a drawer, on the writing desk
      if (f.id === 'fur_desk') {
        const dy = T + topH + 1;
        panel(g, L + 2, dy, w - 4, Math.max(3, Math.round(h * 0.3)), a);
        handle(g, Math.round(x - 3), dy + Math.max(1, Math.round(h * 0.14)), 6, true);
      }
      break;
    }

    // ------------------------------------------------------------ chairs
    case 'chair': {
      if (f.id === 'fur_chair_bean') {
        // a slumped bag: no straight line on it, seams running over the top,
        // the dent where somebody sits and a bright crease along the crown
        g.fillStyle(OUT, 1).fillEllipse(x, y - h * 0.44, w + 2, h * 0.92 + 2);
        g.fillStyle(shade(a, 0.8), 1).fillEllipse(x, y - h * 0.44, w, h * 0.92);
        g.fillStyle(a, 1).fillEllipse(x, y - h * 0.5, w - 2, h * 0.78);
        g.fillStyle(shade(a, 1.18), 1).fillEllipse(x - w * 0.14, y - h * 0.62, w * 0.62, h * 0.42);
        g.fillStyle(shade(a, 0.86), 1).fillEllipse(x + w * 0.06, y - h * 0.72, w * 0.42, h * 0.2);
        cloth(g, L + 2, T + 2, w - 4, h - 4, a, seed);
        for (let k = 0; k < 3; k++) {
          const sx = x + (k - 1) * w * 0.26;
          for (let d = 0; d < h * 0.5; d++) px(g, sx + (k - 1) * d * 0.1, y - h * 0.85 + d, 1, 1, shade(b, 0.9), 0.35);
        }
        g.fillStyle(shade(b, 1.2), 1).fillEllipse(x, y - h * 0.9, w * 0.2, 1.5);
        break;
      }
      if (f.id === 'fur_chair_stool') {
        // a three-legged stool: a round seat, splayed legs, a stretcher ring
        const topH = 3;
        for (const [lx, lean] of [[L + 1, -1], [R - 3, 1], [Math.round(x) - 1, 0]] as Array<[number, number]>) {
          for (let d = 0; d < h - topH; d++) px(g, lx + Math.round(lean * d * 0.18), T + topH + d, 2, 1, shade(a, lean ? 0.62 : 0.5));
        }
        px(g, L + 1, y - Math.round((h - topH) * 0.45), w - 2, 1, shade(a, 0.7));
        px(g, L - 1, T - 1, w + 2, topH + 2, OUT);
        px(g, L, T, w, topH, a);
        px(g, L, T, w, 1, shade(a, 1.3));
        px(g, L, T + topH - 1, w, 1, shade(a, 0.68));
        wood(g, L, T, w, topH, a, seed);
        break;
      }
      if (f.id === 'fur_chair_office') {
        // a gas lift on a star base, a mesh back on its frame, a padded seat
        const seatH = Math.max(3, Math.round(h * 0.18));
        const seatY = y - Math.round(h * 0.42) - seatH;
        // the star base, splayed, on its castors
        for (let k = 0; k < 3; k++) {
          const bx = L + 1 + Math.round(((w - 3) * k) / 2);
          g.lineStyle(1, 0x3a3d44, 1).lineBetween(Math.round(x), y - 4, bx + 1, y - 2);
          px(g, bx, y - 2, 3, 2, 0x2a2d33);
          px(g, bx, y - 2, 3, 1, 0x6a6e74);
          px(g, bx + 1, y - 1, 1, 1, 0x14100c);
        }
        // the gas lift
        metal(g, Math.round(x) - 1, seatY + seatH, 3, y - 4 - (seatY + seatH), 0x9aa0a8);
        // the seat, padded and piped
        slab(g, L, seatY, w, seatH, a);
        cloth(g, L + 1, seatY + 1, w - 2, Math.max(1, seatH - 2), a, seed);
        px(g, L, seatY, w, 1, shade(a, 1.25));
        // the back on its stay, leaning away from the seat, mesh in a frame
        const bw = Math.max(4, Math.round(w * 0.46));
        const bh = seatY - T;
        px(g, fx(1, 2), seatY - 2, 2, 3, 0x6a6e74);
        for (let k = 0; k < bh; k++) {
          const lean = Math.round((k / bh) * 2);
          px(g, fx(lean, bw), T + k, bw, 1, k === 0 ? shade(b, 1.3) : b);
          if (k % 2 && k > 1 && k < bh - 1) px(g, fx(lean + 1, bw - 2), T + k, bw - 2, 1, shade(b, 1.2), 0.5);
        }
        px(g, fx(2, bw), T + bh - 1, bw, 1, shade(b, 0.7));
        break;
      }
      const arm = f.id === 'fur_chair_arm';
      if (arm) {
        // an armchair, side-on: a deep back, a rolled arm this side, a seat
        // cushion piped at the edge, and a valance down to the carpet
        const seatY = y - Math.max(5, Math.round(h * 0.42));
        slab(g, L + 1, T, w - 2, seatY - T + 3, shade(b, 0.92));
        cloth(g, L + 2, T + 1, w - 4, seatY - T + 1, b, seed);
        for (let k = 1; k < 3; k++) px(g, L + 1 + Math.round(((w - 2) * k) / 3), T + 2, 1, seatY - T, shade(b, 0.72));
        px(g, L + 1, T, w - 2, 1, shade(b, 1.25));
        const aw = Math.max(4, Math.round(w * 0.3));
        slab(g, fx(0, aw), seatY - 5, aw, h - (seatY - T) + 2, a);
        cloth(g, fx(1, aw - 2), seatY - 4, aw - 2, h - (seatY - T), a, seed + 3);
        px(g, fx(0, aw), seatY - 5, aw, 1, shade(a, 1.3));
        px(g, fx(1, aw - 2), seatY - 4, aw - 2, 1, shade(a, 1.15));
        slab(g, L + 2, seatY, w - 4, Math.max(3, Math.round(h * 0.22)), a);
        cloth(g, L + 3, seatY + 1, w - 6, Math.max(1, Math.round(h * 0.22) - 2), a, seed + 7);
        px(g, L + 2, seatY, w - 4, 1, shade(a, 1.3));
        px(g, L + 2, seatY + Math.max(2, Math.round(h * 0.22)) - 1, w - 4, 1, shade(a, 0.68));
        px(g, L + 1, y - 3, w - 2, 3, shade(b, 0.78));
        for (let k = 0; k < w - 4; k += 3) px(g, L + 2 + k, y - 3, 1, 3, shade(b, 0.66));
        for (const lx of [L + 1, R - 3]) px(g, lx, y - 1, 2, 1, 0x3a2a1e);
        break;
      }
      // a plain wooden chair, side-on: the back post with a shaped crest on
      // top of it, the seat, two turned legs and a stretcher between them
      const seatY = y - Math.max(5, Math.round(h * 0.4));
      const upW = Math.max(4, Math.round(w * 0.44));
      slab(g, fx(0, upW), T, upW, seatY - T + 2, shade(a, 0.9));
      wood(g, fx(0, upW), T + 1, upW, seatY - T, a, seed, 'v');
      // the crest along the top, and a rail across the middle of the back
      px(g, fx(0, upW), T, upW, 2, a);
      px(g, fx(0, upW), T, upW, 1, shade(a, 1.35));
      px(g, fx(0, upW), T + Math.round((seatY - T) * 0.5), upW, 2, shade(a, 1.06));
      px(g, fx(0, upW), T + Math.round((seatY - T) * 0.5), upW, 1, shade(a, 1.22));
      px(g, fx(1, upW - 2), T + 3, upW - 2, Math.max(1, Math.round((seatY - T) * 0.5) - 4), shade(a, 0.84));
      slab(g, L, seatY, w, Math.max(2, Math.round(h * 0.14)), a);
      wood(g, L, seatY, w, Math.max(2, Math.round(h * 0.14)), a, seed + 3);
      px(g, L, seatY, w, 1, shade(a, 1.3));
      const ly = seatY + Math.max(2, Math.round(h * 0.14));
      for (const lx of [L + 1, R - 3]) leg(g, lx, ly, 2, y - ly, a);
      px(g, L + 2, y - Math.max(2, Math.round((y - ly) * 0.45)), w - 4, 1, shade(a, 0.62));
      break;
    }

    // ------------------------------------------------------------- sofas
    case 'sofa': {
      const armW = Math.max(3, Math.round(w * 0.12));
      const backH = Math.max(4, Math.round(h * 0.58));
      // the back, with its cushions
      slab(g, L, T, w, backH + 2, b);
      cloth(g, L + 1, T + 1, w - 2, backH, b, seed);
      const cushions = Math.max(2, Math.round(w / 16));
      for (let k = 1; k < cushions; k++) px(g, L + Math.round((w * k) / cushions), T + 1, 1, backH, shade(b, 0.7));
      px(g, L + 1, T + 1, w - 2, 1, shade(b, 1.18));
      // the seat cushions
      const seatY = T + backH;
      slab(g, L + armW - 1, seatY, w - armW * 2 + 2, Math.max(3, Math.round(h * 0.26)), a);
      cloth(g, L + armW, seatY + 1, w - armW * 2, Math.max(1, Math.round(h * 0.26) - 2), a, seed + 11);
      for (let k = 1; k < cushions; k++) px(g, L + Math.round((w * k) / cushions), seatY + 1, 1, Math.max(1, Math.round(h * 0.26) - 1), shade(a, 0.72));
      // the arms, rolled, over everything
      for (const ax of [L, R - armW]) {
        slab(g, ax, T + Math.round(backH * 0.3), armW, h - Math.round(backH * 0.3) - 3, a);
        cloth(g, ax + 1, T + Math.round(backH * 0.3) + 1, armW - 2, h - Math.round(backH * 0.3) - 5, a, seed + ax);
        px(g, ax, T + Math.round(backH * 0.3), armW, 1, shade(a, 1.25));
      }
      // its feet
      for (const lx of [L + 1, R - 3]) leg(g, lx, y - 3, 2, 3, 0x6a4a2a);
      break;
    }

    // --------------------------------------------------------------- tvs
    case 'tv': {
      const flat = f.id === 'fur_tv_flat';
      const bodyH = flat ? h - 4 : h - 5;
      if (flat) {
        px(g, L - 1, T - 1, w + 2, bodyH + 2, OUT);
        px(g, L, T, w, bodyH, 0x1a1c22);
        px(g, L + 1, T + 1, w - 2, bodyH - 3, b);
        // the picture: a glow and a sweep of light across the glass
        px(g, L + 1, T + 1, w - 2, Math.max(1, Math.round(bodyH * 0.4)), shade(b, 1.2), 0.5);
        for (let d = 0; d < Math.min(w, bodyH); d++) px(g, L + 2 + d, T + 2 + Math.round(d * 0.5), 1, 1, 0xffffff, 0.12);
        px(g, L, T, w, 1, 0x5a5e66);
        // the stand
        px(g, Math.round(x) - 2, T + bodyH, 4, 3, 0x3a3d44);
        px(g, Math.round(x) - Math.round(w * 0.2), y - 2, Math.round(w * 0.4), 2, 0x2a2d33);
        break;
      }
      // a box set: the case, the tube, the dials down one side
      slab(g, L, T, w, bodyH, a);
      wood(g, L, T, w, bodyH, a, seed);
      const sw = Math.max(4, w - 7);
      panel(g, L + 2, T + 2, sw, bodyH - 4, shade(a, 0.5));
      px(g, L + 3, T + 3, sw - 2, bodyH - 6, b);
      px(g, L + 3, T + 3, sw - 2, Math.max(1, Math.round((bodyH - 6) * 0.35)), shade(b, 1.25), 0.55);
      for (let d = 0; d < Math.min(sw, bodyH); d++) px(g, L + 4 + d, T + 4 + d, 1, 1, 0xffffff, 0.1);
      for (let k = 0; k < 2; k++) px(g, R - 4, T + 3 + k * 4, 2, 2, 0xd8d4c8);
      px(g, L + 1, T + bodyH - 1, w - 2, 1, shade(a, 0.6));
      for (const lx of [L + 2, R - 4]) leg(g, lx, T + bodyH, 2, h - bodyH, a);
      break;
    }

    // ------------------------------------------------------------ radios
    case 'radio': {
      if (f.id === 'fur_record_player') {
        // a deck in a wooden plinth: the platter, the arm, the lid up behind
        // the lid, up on its hinges behind, in smoked plastic
        const lidH = Math.max(3, Math.round(h * 0.45));
        px(g, L, T, w, lidH, 0x3a3d44);
        px(g, L, T, w, 1, 0x9aa0a8);
        px(g, L + 1, T + 1, w - 2, lidH - 2, 0x4e525a, 0.8);
        for (let d = 0; d < Math.min(w, lidH); d++) px(g, L + 2 + d, T + 1 + Math.round(d * 0.4), 1, 1, 0xffffff, 0.12);
        // the plinth, the platter, the record and the arm
        const deck = T + lidH;
        slab(g, L, deck, w, y - deck, a);
        wood(g, L, deck + 1, w, y - deck - 2, a, seed);
        px(g, L, deck, w, 1, shade(a, 1.35));
        const pcx = x - w * 0.14;
        const pcy = deck + 2;
        g.fillStyle(0x14100c, 1).fillEllipse(pcx, pcy, w * 0.62, Math.max(3, (y - deck) * 0.62));
        g.fillStyle(0x2a2a2e, 1).fillEllipse(pcx, pcy, w * 0.56, Math.max(2, (y - deck) * 0.5));
        g.fillStyle(0x3a3a40, 1).fillEllipse(pcx, pcy - 0.5, w * 0.4, Math.max(1, (y - deck) * 0.3));
        g.fillStyle(0xc8a24a, 1).fillEllipse(pcx, pcy, w * 0.16, Math.max(1, (y - deck) * 0.16));
        metal(g, Math.round(x + w * 0.3), deck - 1, 2, 2, 0xc4c8cc);
        for (let d = 0; d < Math.round(w * 0.28); d++) px(g, Math.round(x + w * 0.3) - d, deck + Math.round(d * 0.35), 1, 1, 0xd8dce0);
        break;
      }
      const retro = f.id === 'fur_radio_retro';
      slab(g, L, T, w, h, a);
      if (retro) wood(g, L, T, w, h, a, seed);
      // the speaker grille: a mesh of holes
      const gw = Math.max(3, Math.round(w * 0.45));
      panel(g, fx(1, gw), T + 1, gw, h - 2, shade(a, 0.6));
      for (let yy = T + 2; yy < T + h - 2; yy += 2) {
        for (let xx = fx(2, gw - 2); xx < fx(2, gw - 2) + gw - 2; xx += 2) px(g, xx, yy, 1, 1, b, 0.8);
      }
      // the dial and its needle, and a knob under it
      const dx = fx(w - Math.max(3, Math.round(w * 0.38)) - 1, Math.max(3, Math.round(w * 0.38)));
      const dw = Math.max(3, Math.round(w * 0.38));
      px(g, dx, T + 2, dw, Math.max(2, Math.round(h * 0.35)), shade(b, 1.25));
      px(g, dx, T + 2, dw, 1, 0xffffff, 0.4);
      px(g, dx + Math.round(dw * 0.6), T + 2, 1, Math.max(2, Math.round(h * 0.35)), 0xc03a2a);
      g.fillStyle(0x3a3a3a, 1).fillCircle(dx + dw / 2, T + h - 3, Math.max(1, h / 7));
      g.fillStyle(0x8a8a8a, 1).fillCircle(dx + dw / 2 - 0.5, T + h - 3.5, Math.max(1, h / 11));
      break;
    }

    // ------------------------------------------------------------- lamps
    case 'lamp': {
      if (f.id === 'fur_lamp_neon') {
        // a neon frog: a tube bent into a shape, and the haze round it
        g.fillStyle(a, 0.1).fillCircle(x, T + h / 2, w);
        g.fillStyle(a, 0.18).fillCircle(x, T + h / 2, w * 0.6);
        g.fillStyle(OUT, 1).fillEllipse(x, T + h * 0.45, w, h * 0.7);
        g.fillStyle(a, 1).fillEllipse(x, T + h * 0.45, w - 2, h * 0.7 - 2);
        g.fillStyle(shade(a, 1.4), 1).fillEllipse(x, T + h * 0.4, w - 5, h * 0.4);
        for (const ex of [x - w * 0.22, x + w * 0.22]) {
          g.fillStyle(0xffffff, 1).fillCircle(ex, T + h * 0.3, 1.6);
          g.fillStyle(OUT, 1).fillCircle(ex, T + h * 0.3, 0.7);
        }
        px(g, Math.round(x) - 1, T + Math.round(h * 0.75), 2, Math.round(h * 0.25), 0x3a3d44);
        px(g, Math.round(x) - 3, y - 2, 6, 2, 0x2a2d33);
        px(g, Math.round(x) - 3, y - 2, 6, 1, 0x5a5e66);
        break;
      }
      const paper = f.id === 'fur_lamp_paper';
      const shadeH = Math.max(4, Math.round(h * (paper ? 0.55 : 0.38)));
      const stemH = h - shadeH - 2;
      // the light it throws
      g.fillStyle(a, 0.1).fillCircle(x, T + shadeH, w * 1.6);
      g.fillStyle(a, 0.16).fillCircle(x, T + shadeH * 0.8, w * 0.9);
      // the stem and the weighted base
      px(g, Math.round(x) - 1, T + shadeH, 2, stemH + 1, 0x6a6e74);
      px(g, Math.round(x) - 1, T + shadeH, 1, stemH + 1, 0xb0b4b8);
      px(g, Math.round(x) - Math.max(2, Math.round(w * 0.35)), y - 2, Math.max(4, Math.round(w * 0.7)), 2, b);
      px(g, Math.round(x) - Math.max(2, Math.round(w * 0.35)), y - 2, Math.max(4, Math.round(w * 0.7)), 1, shade(b, 1.3));
      // the shade: a drum or a paper globe, lit from the inside
      if (paper) {
        g.fillStyle(OUT, 1).fillCircle(x, T + shadeH / 2 + 1, shadeH / 2 + 1);
        g.fillStyle(a, 1).fillCircle(x, T + shadeH / 2 + 1, shadeH / 2);
        g.fillStyle(shade(a, 1.2), 1).fillCircle(x - 1, T + shadeH / 2, shadeH / 3);
        for (let k = 1; k < 3; k++) px(g, L + 1, T + Math.round((shadeH * k) / 3), w - 2, 1, shade(a, 0.86), 0.6);
      } else {
        // a coolie shade: narrow at the top, wide at the hem, the light
        // getting through it stronger the lower down it goes
        const taper = Math.max(1, Math.round(w * 0.3));
        for (let k = 0; k < shadeH; k++) {
          const inset = Math.round((1 - k / (shadeH - 1)) * taper);
          const row = mix(a, 0xfff2cc, 0.15 + (k / shadeH) * 0.55);
          px(g, L + inset - 1, T + k, w - inset * 2 + 2, 1, OUT);
          px(g, L + inset, T + k, w - inset * 2, 1, row);
          px(g, L + inset, T + k, 1, 1, shade(row, 1.15));
          px(g, L + w - inset - 1, T + k, 1, 1, shade(row, 0.82));
        }
        px(g, L + taper, T, w - taper * 2, 1, shade(a, 1.3));
        px(g, L, T + shadeH - 1, w, 1, mix(a, 0xfff2cc, 0.8));
        px(g, L + 1, T + shadeH, w - 2, 1, shade(a, 0.62));
      }
      break;
    }

    // -------------------------------------------------------------- rugs
    case 'rug': {
      const mat = f.id === 'fur_rug_mat';
      if (mat) {
        px(g, L - 1, T - 1, w + 2, h + 2, OUT);
        px(g, L, T, w, h, a);
        for (let yy = T; yy < T + h; yy++) for (let xx = L + ((yy - T) % 2); xx < R; xx += 2) px(g, xx, yy, 1, 1, shade(a, yy % 2 ? 1.14 : 0.86), 0.5);
        px(g, L + 1, T + 1, w - 2, h - 2, b, 0.25);
        px(g, L, T, w, 1, shade(a, 1.2));
        break;
      }
      g.fillStyle(OUT, 1).fillEllipse(x, y - h / 2, w + 2, h + 2);
      g.fillStyle(a, 1).fillEllipse(x, y - h / 2, w, h);
      // the field, the border and the medallion in the middle
      g.fillStyle(shade(a, 0.86), 1).fillEllipse(x, y - h / 2, w - 3, h - 2);
      g.fillStyle(b, 1).fillEllipse(x, y - h / 2, w * 0.68, h * 0.6);
      g.fillStyle(shade(b, 0.82), 1).fillEllipse(x, y - h / 2, w * 0.6, h * 0.5);
      g.fillStyle(a, 1).fillEllipse(x, y - h / 2, w * 0.24, h * 0.3);
      g.fillStyle(shade(b, 1.25), 1).fillEllipse(x, y - h / 2, w * 0.12, h * 0.16);
      // the pile, and a fringe at each end
      for (let k = 0; k < w; k += 2) {
        const yy = y - h + 1 + Math.floor(nz(seed + k) * (h - 2));
        px(g, L + k, yy, 1, 1, nz(seed + k * 3) > 0.5 ? shade(a, 1.15) : shade(a, 0.85), 0.4);
      }
      for (const sx of [L - 1, R]) for (let k = 2; k < h - 1; k += 2) px(g, sx, y - h + k, 1, 1, shade(a, 1.3), 0.8);
      break;
    }

    // ----------------------------------------------------------- storage
    case 'storage': {
      if (f.id === 'fur_shelf_wall') {
        // a board on two brackets: a few books leaning, and a little plant
        const bd = Math.max(2, Math.round(h * 0.4));
        g.fillStyle(0x000000, 0.18).fillRect(L + 2, T + h, w - 2, 2);
        slab(g, L, T + h - bd, w, bd, a);
        wood(g, L, T + h - bd, w, bd, a, seed);
        for (const bx of [L + 3, R - 5]) {
          px(g, bx, T + h, 2, 2, 0x6a6e74);
          px(g, bx, T + h, 1, 2, 0xa8acb0);
        }
        let bx2 = L + 2;
        let k2 = 0;
        while (bx2 < L + Math.round(w * 0.55)) {
          const bw2 = 1 + Math.floor(nz(seed + k2 * 5) * 2);
          const bh2 = Math.max(3, T + h - bd - T - Math.floor(nz(seed + k2 * 3) * 2));
          const col2 = [b, shade(b, 0.7), 0x8a3a3a, 0x3a5a7a, 0xc8a24a][Math.floor(nz(seed + k2 * 11) * 5)];
          px(g, bx2, T + h - bd - bh2, bw2, bh2, col2);
          px(g, bx2, T + h - bd - bh2, bw2, 1, shade(col2, 1.3));
          bx2 += bw2 + 1;
          k2++;
        }
        g.fillStyle(0x8a5a32, 1).fillRect(R - 7, T + h - bd - 3, 4, 3);
        g.fillStyle(0x3a8a3a, 1).fillEllipse(R - 5, T + h - bd - 4, 5, 4);
        g.fillStyle(0x5aa85f, 1).fillEllipse(R - 6, T + h - bd - 5, 3, 2);
        break;
      }
      const books = f.id === 'fur_shelf' || f.id === 'fur_bookcase_tall';
      const chest = f.id === 'fur_chest';
      slab(g, L, T, w, h, a);
      wood(g, L, T, w, h, a, seed, 'v');
      if (chest) {
        // a lid with a band of iron round it, and a lock plate
        px(g, L + 1, T + Math.round(h * 0.38), w - 2, 1, shade(a, 0.55));
        px(g, L + 1, T + 1, w - 2, Math.round(h * 0.37), shade(a, 1.06));
        wood(g, L + 1, T + 1, w - 2, Math.round(h * 0.37), a, seed + 3);
        for (const bx of [L + Math.round(w * 0.2), R - Math.round(w * 0.2) - 2]) metal(g, bx, T + 1, 2, h - 2, 0x8a8e96);
        metal(g, Math.round(x) - 2, T + Math.round(h * 0.32), 5, 5, 0xc8a24a);
        px(g, Math.round(x), T + Math.round(h * 0.34), 1, 2, 0x2a2420);
        panel(g, L + 2, T + Math.round(h * 0.45), w - 4, Math.round(h * 0.4), a);
        break;
      }
      if (books) {
        // open shelves: the carcass dark inside, books leaning on each one
        const rows = Math.max(2, Math.floor(h / (f.id === 'fur_shelf_wall' ? 7 : 10)));
        const rh = (h - 2) / rows;
        for (let i = 0; i < rows; i++) {
          const sy = T + 1 + Math.round(i * rh);
          px(g, L + 1, sy, w - 2, Math.round(rh) - 1, shade(a, 0.45));
          let bx = L + 2;
          let k = 0;
          while (bx < R - 3) {
            const bw = 1 + Math.floor(nz(seed + i * 17 + k * 5) * 2);
            const bh = Math.max(2, Math.round(rh) - 2 - Math.floor(nz(seed + i * 9 + k * 3) * 2));
            const col = [b, shade(b, 0.72), shade(b, 1.25), 0x8a3a3a, 0x3a5a7a, 0xc8a24a][Math.floor(nz(seed + i * 23 + k * 7) * 6)];
            px(g, bx, sy + Math.round(rh) - 1 - bh, bw, bh, col);
            px(g, bx, sy + Math.round(rh) - 1 - bh, bw, 1, shade(col, 1.3));
            if (bh > 4) px(g, bx, sy + Math.round(rh) - 1 - bh + 2, bw, 1, shade(col, 0.6));
            bx += bw + 1;
            k++;
          }
          px(g, L + 1, sy + Math.round(rh) - 1, w - 2, 1, shade(a, 1.12));
        }
        break;
      }
      // doors, with their panels and their handles
      const doors = w > 16 ? 2 : 1;
      const dw = Math.floor((w - 3) / doors);
      for (let d = 0; d < doors; d++) {
        const dx = L + 2 + d * (dw + 1);
        panel(g, dx, T + 2, dw - 1, h - 4, a);
        wood(g, dx + 1, T + 3, dw - 3, h - 6, a, seed + d * 13, 'v');
        if (h > 20) {
          // a tall door gets two panels of its own
          px(g, dx + 1, T + Math.round(h * 0.5), dw - 3, 1, shade(a, 0.62));
          px(g, dx + 1, T + Math.round(h * 0.5) + 1, dw - 3, 1, shade(a, 1.12));
        }
        const hx = doors === 2 ? (d === 0 ? dx + dw - 3 : dx + 1) : dx + dw - 3;
        px(g, hx, T + Math.round(h * 0.45), 1, 3, 0x8a8e96);
        px(g, hx, T + Math.round(h * 0.45), 1, 1, 0xd4d8dc);
      }
      // a plinth under it
      px(g, L, y - 2, w, 2, shade(a, 0.62));
      px(g, L, y - 2, w, 1, shade(a, 0.8));
      break;
    }

    // -------------------------------------------------------------- beds
    case 'bed': {
      if (f.id === 'fur_sleeping_bag') {
        // A QUILTED BAG ROLLED OUT ON THE BOARDS -- the same shape as ever
        // (the body, the hood at the head end, the folded pillow in it), in
        // better cloth: puffed channels between the stitch lines, a nylon
        // sheen along the top, a piped hem, the zip with its pull, the hood's
        // lining at its mouth, and a soft pillow with a crease in it.
        // (a little shadow where it lies on the floor)
        px(g, L, T + h + 1, w, 1, 0x000000, 0.18);
        slab(g, L, T, w, h, a);
        cloth(g, L + 1, T + 1, w - 2, h - 2, a, seed);
        const seg = 6;
        for (let k = 0; k < seg; k++) {
          const x0 = L + Math.round((w * k) / seg) + 1;
          const x1 = L + Math.round((w * (k + 1)) / seg);
          const cw = x1 - x0;
          if (cw < 2) continue;
          // each channel puffs: lit across its crown, falling into the stitch
          px(g, x0 + 1, T + 1, Math.max(1, cw - 2), 1, shade(a, 1.22), 0.8);
          px(g, x0, T + 2, cw, 1, shade(a, 1.08), 0.5);
          px(g, x1 - 1, T + 1, 1, h - 3, shade(a, 0.86), 0.7);
          // the stitch line itself, a row of tiny dashes
          if (k > 0) for (let yy = T + 1; yy < T + h - 2; yy += 2) px(g, x0 - 1, yy, 1, 1, shade(a, 0.62));
        }
        // the nylon sheen: one long soft streak along the top
        px(g, L + 2, T + 1, Math.round(w * 0.55), 1, 0xffffff, 0.16);
        // the piped hem, then the zip rail and its pull by the hood
        px(g, L + 1, T + h - 2, w - 2, 1, shade(b, 0.9));
        metal(g, L + 2, T + h - 2, w - 4, 1, 0xb8bcc4);
        const hood = Math.max(6, Math.round(w * 0.22));
        px(g, R - hood - 3, T + h - 3, 2, 2, 0xd8dce2);
        px(g, R - hood - 3, T + h - 1, 2, 1, shade(0xd8dce2, 0.6));
        // the hood: the same outline, quilted in its own colour, darker round
        // the back, its lining showing at the mouth
        slab(g, R - hood, T - 1, hood, h + 1, b);
        cloth(g, R - hood + 1, T, hood - 2, h - 1, b, seed + 5);
        px(g, R - hood + 1, T, hood - 2, 1, shade(b, 1.3));
        px(g, R - 2, T, 1, h - 1, shade(b, 0.7));
        px(g, R - hood, T, 1, h - 1, shade(a, 1.35));
        px(g, R - hood + 1, T + Math.round(h / 2), hood - 2, 1, shade(b, 0.8), 0.6);
        // the pillow: soft cotton, shaded underneath, a crease across it
        slab(g, R - hood + 2, T - 2, hood - 4, Math.max(2, h - 2), 0xeeeae0);
        px(g, R - hood + 3, T - 2, hood - 6, 1, 0xffffff);
        px(g, R - hood + 3, T - 3 + Math.max(2, h - 2), hood - 6, 1, 0xcfc8b8);
        px(g, R - hood + 3 + Math.floor((hood - 6) / 2), T - 1, 1, Math.max(1, h - 4), 0xd8d2c4, 0.8);
        break;
      }
      if (f.id === 'fur_mattress') {
        // a bare mattress on the boards: buttoned, piped at the edge
        slab(g, L, T, w, h, a);
        px(g, L + 1, T + 1, w - 2, h - 2, shade(a, 1.04));
        cloth(g, L + 1, T + 1, w - 2, h - 2, a, seed);
        for (let k = 1; k < 5; k++) px(g, L + Math.round((w * k) / 5), T + Math.round(h / 2), 1, 1, shade(a, 0.62));
        px(g, L, T + h - 2, w, 1, shade(a, 0.78));
        px(g, L + 2, T + Math.round(h * 0.3), w - 4, 1, shade(b, 1.1), 0.5);
        break;
      }
      const premium = f.id === 'fur_bed_premium';
      const headH = Math.max(6, Math.round(h * (premium ? 0.52 : 0.42)));
      const baseH = Math.max(3, Math.round(h * 0.2));
      const deckY = T + headH;
      // the headboard: buttoned and panelled, against the wall
      slab(g, L, T, w, headH + 2, premium ? 0x8a8e96 : b);
      cloth(g, L + 1, T + 1, w - 2, headH, premium ? 0x8a8e96 : b, seed);
      const bays = Math.max(3, Math.round(w / 12));
      for (let k = 1; k < bays; k++) px(g, L + Math.round((w * k) / bays), T + 1, 1, headH, shade(premium ? 0x8a8e96 : b, 0.76));
      for (let k = 0; k < bays; k++) px(g, L + Math.round((w * (k + 0.5)) / bays), T + Math.round(headH * 0.45), 1, 1, shade(premium ? 0x8a8e96 : b, 0.55));
      px(g, L, T, w, 1, shade(premium ? 0x8a8e96 : b, 1.22));
      // the pillows
      const pw = Math.max(5, Math.round(w / 2) - 5);
      for (let k = 0; k < (w > 24 ? 2 : 1); k++) {
        const px0 = L + 3 + k * (pw + 3);
        slab(g, px0, deckY - Math.max(3, Math.round(h * 0.2)), pw, Math.max(3, Math.round(h * 0.2)), 0xf6f4ee);
        px(g, px0 + 1, deckY - Math.max(3, Math.round(h * 0.2)) + 1, pw - 2, 1, 0xffffff);
        px(g, px0 + 1, deckY - 2, pw - 2, 1, 0xd8d4cc);
      }
      // the sheets, the throw folded over them, the wooden base
      slab(g, L, deckY, w, h - headH - baseH, 0xf6f2ea);
      px(g, L + 1, deckY + 1, w - 2, 1, 0xffffff);
      px(g, L, deckY + Math.max(2, Math.round((h - headH - baseH) * 0.45)), w, Math.max(2, Math.round(h * 0.16)), a);
      px(g, L, deckY + Math.max(2, Math.round((h - headH - baseH) * 0.45)), w, 1, shade(a, 1.3));
      cloth(g, L + 1, deckY + Math.max(2, Math.round((h - headH - baseH) * 0.45)) + 1, w - 2, Math.max(1, Math.round(h * 0.16) - 2), a, seed + 7);
      const basCol = premium ? 0x8a6640 : shade(b, 0.8);
      slab(g, L - 1, y - baseH, w + 2, baseH, basCol);
      wood(g, L, y - baseH + 1, w, baseH - 2, basCol, seed + 11);
      for (const lx of [L, R - 2]) px(g, lx, y - 2, 2, 2, shade(basCol, 0.6));
      break;
    }

    // ---------------------------------------------------------- bathroom
    case 'bath': {
      if (f.id === 'fur_toilet') {
        const cis = Math.max(5, Math.round(h * 0.42));
        // the cistern, the bowl, the seat and the lid, all in glazed white
        slab(g, fx(1, Math.round(w * 0.7)), T, Math.round(w * 0.7), cis, a);
        px(g, fx(2, Math.round(w * 0.7) - 2), T + 1, Math.round(w * 0.7) - 2, 1, 0xffffff);
        metal(g, fx(Math.round(w * 0.45), 2), T + 2, 2, 1, 0xc4c8cc);
        slab(g, L + 1, T + cis, w - 2, Math.max(3, Math.round(h * 0.3)), a);
        px(g, L + 2, T + cis, w - 4, 1, 0xffffff);
        px(g, L + 2, T + cis + 1, w - 4, Math.max(1, Math.round(h * 0.16)), shade(b, 1.05));
        px(g, L + 3, T + cis + 2, w - 6, 1, 0xffffff, 0.5);
        slab(g, L + 2, y - Math.max(3, Math.round(h * 0.26)), w - 4, Math.max(3, Math.round(h * 0.26)), shade(a, 0.94));
        break;
      }
      if (f.id === 'fur_sink') {
        // a basin on a pedestal: a rolled lip, the hollow of the bowl with
        // water in it, chrome taps standing on the back, the trap behind
        const basinY = T + Math.round(h * 0.26);
        const basinH = Math.max(4, Math.round(h * 0.32));
        const pw = Math.max(4, Math.round(w * 0.46));
        const pedY = basinY + basinH;
        slab(g, Math.round(x - pw / 2), pedY, pw, y - pedY, shade(a, 0.96));
        px(g, Math.round(x - pw / 2) + 1, pedY, 1, y - pedY, 0xffffff, 0.55);
        px(g, Math.round(x - pw / 2), y - 2, pw, 2, shade(a, 0.86));
        slab(g, L, basinY, w, basinH, a);
        px(g, L, basinY, w, 2, 0xffffff);
        px(g, L + 2, basinY + 2, w - 4, basinH - 4, shade(a, 0.9));
        px(g, L + 3, basinY + 3, w - 6, Math.max(1, basinH - 6), mix(b, 0xffffff, 0.45));
        px(g, L + 3, basinY + 3, w - 6, 1, 0xffffff, 0.6);
        px(g, L, basinY + basinH - 1, w, 1, shade(a, 0.76));
        metal(g, Math.round(x) - 1, basinY - Math.round(h * 0.2), 2, Math.round(h * 0.2), 0xc4c8cc);
        px(g, Math.round(x) - 1, basinY - Math.round(h * 0.2), 4, 1, 0xd8dce0);
        for (const hx of [L + 2, R - 4]) px(g, hx, basinY - 2, 2, 2, 0xd8dce0);
        break;
      }
      if (f.id === 'fur_shower') {
        // a glass cubicle: a tray, a frame, the head on its riser
        px(g, L - 1, T - 1, w + 2, h + 2, OUT);
        px(g, L, T, w, h, mix(b, 0xffffff, 0.5), 0.3);
        for (let d = 0; d < h; d += 2) px(g, L + 1 + ((d / 2) % Math.max(1, w - 2)), T + d, 1, 1, 0xffffff, 0.16);
        metal(g, L, T, 2, h, 0xb0b4b8);
        metal(g, R - 2, T, 2, h, 0xb0b4b8);
        metal(g, L, T, w, 2, 0xb0b4b8);
        metal(g, Math.round(x) - 1, T + 3, 2, Math.round(h * 0.3), 0xc4c8cc);
        metal(g, Math.round(x) - 3, T + 2, 6, 2, 0xc4c8cc);
        for (let k = 0; k < 4; k++) px(g, Math.round(x) - 2 + k * 1.4, T + 5, 1, Math.round(h * 0.2), 0xbfe8ff, 0.3);
        slab(g, L, y - 3, w, 3, a);
        break;
      }
      if (f.id === 'fur_bath_mirror') {
        // the mirror that used to come painted on the wall: a gold frame,
        // a steel light bar over it with its three bulbs, plain glass
        const bar = 3;
        const fT = T + bar + 2;
        const fh = h - bar - 2;
        g.fillStyle(0xfff0c0, 0.18).fillCircle(x, T + 1, w * 0.7);
        metal(g, L, T, w, bar, 0x9aa4ac);
        for (let k = 0; k < 3; k++) px(g, L + 3 + k * Math.round((w - 6) / 3), T + 1, 3, 1, 0xfff6d8);
        px(g, L, fT, w, fh, 0x8a6a28);
        px(g, L + 1, fT + 1, w - 2, fh - 2, a);
        paintMirror(g, L + 2, fT + 2, w - 4, fh - 4, MIRROR_GLASS);
        paintMirrorShine(g, L + 2, fT + 2, w - 4, fh - 4);
        g.fillStyle(0x000000, 0.2).fillRect(L + 2, y, w - 2, 2);
        break;
      }
      if (f.id === 'fur_towel_rail') {
        // a chrome rail on two brackets, a towel folded over each half
        metal(g, L, T, w, 1, 0xd8dce0);
        for (const bx of [L, R - 1]) px(g, bx, T - 1, 1, 3, 0x9aa4ac);
        const tw = Math.max(4, Math.round((w - 6) / 2));
        for (const [tx, th] of [[L + 2, h - 1], [R - 2 - tw, h - 3]] as const) {
          px(g, tx, T + 1, tw, th, 0xf8f6f0);
          px(g, tx, T + 1, tw, 1, 0xffffff);
          px(g, tx + tw - 1, T + 1, 1, th, 0xe0ddd4);
          px(g, tx, T + th - 2, tw, 1, b);
        }
        break;
      }
      if (f.id === 'fur_bath_mat') {
        px(g, L - 1, T - 1, w + 2, h + 2, OUT);
        px(g, L, T, w, h, a);
        cloth(g, L, T, w, h, a, seed);
        px(g, L + 1, T + 1, w - 2, h - 2, b, 0.3);
        for (const sx of [L, R - 1]) for (let k = 0; k < h; k++) px(g, sx, T + k, 1, 1, shade(a, 1.25), 0.7);
        break;
      }
      // the bath: a rolled rim over a panelled side, the water with the
      // light on it, a mixer at one end, and the feet showing underneath
      const rimY = T + Math.round(h * 0.18);
      const inner = Math.max(2, Math.round(h * 0.3));
      slab(g, L, rimY, w, h - Math.round(h * 0.18) - 3, a);
      px(g, L + 1, rimY + inner + 2, w - 2, y - 3 - (rimY + inner + 2), shade(a, 0.9));
      panel(g, L + 3, rimY + inner + 3, w - 6, Math.max(2, y - 6 - (rimY + inner + 2)), shade(a, 0.94));
      px(g, L, rimY, w, 2, 0xffffff);
      px(g, L + 1, rimY + 1, w - 2, 1, shade(a, 1.1));
      px(g, L + 2, rimY + 2, w - 4, inner, mix(b, 0xffffff, 0.15));
      px(g, L + 2, rimY + 2, w - 4, 1, shade(b, 1.35));
      px(g, L + 2, rimY + inner + 1, w - 4, 1, shade(b, 0.7));
      for (let k = 0; k < w / 5; k++) px(g, L + 3 + k * 5, rimY + 3 + (k % 2), 3, 1, 0xffffff, 0.35);
      metal(g, fx(w - 6, 2), rimY - Math.round(h * 0.16), 2, Math.round(h * 0.16), 0xc4c8cc);
      px(g, fx(w - 8, 4), rimY - Math.round(h * 0.16), 4, 1, 0xd8dce0);
      px(g, fx(w - 11, 2), rimY - 2, 2, 2, 0xd8dce0);
      for (const lx of [L + 2, R - 5]) {
        px(g, lx, y - 3, 3, 3, 0x8a8e96);
        px(g, lx, y - 3, 1, 3, 0xd4d8dc);
        px(g, lx, y - 1, 3, 1, 0x4a4e54);
      }
      break;
    }

    // ------------------------------------------------------------- decor
    case 'decor':
    default: {
      if (f.id === 'fur_clock') {
        // a wall clock: a case, a bezel, the face, hands and a glass catch
        g.fillStyle(0x000000, 0.18).fillCircle(x + 1, T + h / 2 + 1, w / 2);
        g.fillStyle(OUT, 1).fillCircle(x, T + h / 2, w / 2 + 1);
        g.fillStyle(shade(b, 1.1), 1).fillCircle(x, T + h / 2, w / 2);
        g.fillStyle(shade(b, 0.7), 1).fillCircle(x, T + h / 2 + 0.5, w / 2 - 0.5);
        g.fillStyle(a, 1).fillCircle(x, T + h / 2, w / 2 - 1.5);
        for (let k = 0; k < 4; k++) {
          const ang = (k * Math.PI) / 2;
          px(g, x + Math.cos(ang) * (w / 2 - 2.5) - 0.5, T + h / 2 + Math.sin(ang) * (h / 2 - 2.5) - 0.5, 1, 1, b);
        }
        px(g, Math.round(x), T + 3, 1, Math.round(h / 2) - 3, b);
        px(g, Math.round(x), T + Math.round(h / 2), Math.round(w / 3), 1, b);
        g.fillStyle(0xffffff, 0.22).fillCircle(x - w * 0.18, T + h * 0.34, w * 0.16);
        break;
      }
      if (f.id === 'fur_mirror_wall') {
        // THE MIRROR: the very mirror Threads has on its wall -- a walnut
        // frame with brass at the corners, plain glass, and the shine across
        // it.  Hung in a room (see rooms/piece), you are in it when you
        // stand at it.
        g.fillStyle(0x000000, 0.22).fillRect(L + 2, T + h, w - 2, 2);
        paintMirror(g, L, T, w, h, MIRROR_GLASS);
        paintMirrorShine(g, L, T, w, h);
        break;
      }
      if (f.id === 'fur_trophy') {
        // a cup on a plinth: brass, two handles, an engraved plate
        // a cup on a plinth: two handles, a stem, an engraved plate
        const baseH = Math.max(3, Math.round(h * 0.26));
        slab(g, L, y - baseH, w, baseH, 0x4a3422);
        wood(g, L, y - baseH, w, baseH, 0x4a3422, seed);
        px(g, L + 2, y - baseH + 2, w - 4, 2, 0xd8c88a);
        px(g, L + 2, y - baseH + 2, w - 4, 1, 0xf4ecc8);
        px(g, Math.round(x) - 1, T + Math.round(h * 0.46), 2, y - baseH - (T + Math.round(h * 0.46)), shade(a, 0.78));
        px(g, Math.round(x) - 2, T + Math.round(h * 0.54), 4, 2, a);
        const cupH = Math.max(4, Math.round(h * 0.46));
        g.fillStyle(OUT, 1).fillEllipse(x, T + cupH * 0.55, w - 2, cupH + 1);
        g.fillStyle(shade(a, 0.84), 1).fillEllipse(x, T + cupH * 0.55, w - 4, cupH - 1);
        g.fillStyle(a, 1).fillEllipse(x - 0.5, T + cupH * 0.5, w - 5, cupH - 3);
        g.fillStyle(shade(a, 1.4), 1).fillEllipse(x - w * 0.2, T + cupH * 0.35, w * 0.26, cupH * 0.3);
        for (const hx of [L, R - 2]) {
          px(g, hx, T + Math.round(cupH * 0.2), 2, 1, shade(a, 1.1));
          px(g, hx + (hx === L ? 0 : 1), T + Math.round(cupH * 0.25), 1, Math.max(2, Math.round(cupH * 0.35)), a);
          px(g, hx, T + Math.round(cupH * 0.6), 2, 1, shade(a, 0.8));
        }
        break;
      }
      if (f.id === 'fur_frog_statue') {
        // a stone frog on a base: carved, mottled, a little moss in the cuts
        px(g, Math.round(x - w / 2), y - 3, w, 3, shade(b, 0.8));
        px(g, Math.round(x - w / 2), y - 3, w, 1, shade(b, 1.1));
        g.fillStyle(OUT, 1).fillEllipse(x, y - 3 - h * 0.28, w, h * 0.56);
        g.fillStyle(a, 1).fillEllipse(x, y - 3 - h * 0.28, w - 2, h * 0.56 - 2);
        g.fillStyle(shade(a, 1.2), 1).fillEllipse(x - 1, y - 3 - h * 0.34, w * 0.5, h * 0.22);
        for (const ex of [x - w * 0.24, x + w * 0.24]) {
          g.fillStyle(a, 1).fillCircle(ex, y - 3 - h * 0.5, w * 0.16);
          g.fillStyle(shade(a, 0.5), 1).fillCircle(ex, y - 3 - h * 0.5, w * 0.07);
        }
        px(g, Math.round(x - w * 0.2), Math.round(y - 3 - h * 0.2), Math.round(w * 0.4), 1, shade(a, 0.6));
        for (let k = 0; k < 5; k++) px(g, Math.round(x - w / 2) + 1 + Math.floor(nz(seed + k) * (w - 2)), Math.round(y - 4 - nz(seed + k * 3) * h * 0.4), 1, 1, shade(b, 0.9), 0.5);
        break;
      }
      // a plant: a thrown pot with a rim, dark compost, and leaves on stems
      const potH = Math.max(5, Math.round(h * 0.34));
      const potY = y - potH;
      const potW = Math.max(5, Math.round(w * 0.86));
      px(g, Math.round(x - potW / 2) - 1, potY - 1, potW + 2, potH + 2, OUT);
      for (let k = 0; k < potH; k++) {
        const inset = Math.round((k / potH) * (potW * 0.16));
        px(g, Math.round(x - potW / 2) + inset, potY + k, potW - inset * 2, 1, mix(b, shade(b, 0.62), k / potH));
      }
      px(g, Math.round(x - potW / 2), potY, potW, 2, shade(b, 1.18));
      px(g, Math.round(x - potW / 2) + 1, potY + 1, 1, potH - 2, shade(b, 1.3), 0.6);
      px(g, Math.round(x - potW / 2) + 2, potY + 2, potW - 4, 1, 0x2a1c12);
      // the foliage: a crown of leaves, each with a stem and a lit side
      const leaves = Math.max(7, Math.round(w / 1.4));
      for (let k = 0; k < leaves; k++) {
        const t = k / (leaves - 1);
        const ang = -Math.PI / 2 + (t - 0.5) * 2.1 + (nz(seed + k) - 0.5) * 0.3;
        const len = (h - potH) * (0.55 + nz(seed + k * 3) * 0.5);
        const ex = x + Math.cos(ang) * len * 0.75;
        const ey = potY + 1 + Math.sin(ang) * len;
        g.lineStyle(1, shade(a, 0.6), 1).lineBetween(x, potY + 1, ex, ey);
        g.fillStyle(shade(a, 0.62), 1).fillEllipse(ex, ey, Math.max(3, w * 0.4), Math.max(3, (h - potH) * 0.36));
        g.fillStyle(a, 1).fillEllipse(ex, ey, Math.max(2, w * 0.33), Math.max(2, (h - potH) * 0.29));
        g.fillStyle(shade(a, 1.28), 1).fillEllipse(ex - 0.6, ey - 0.6, Math.max(1, w * 0.14), Math.max(1, (h - potH) * 0.12));
      }
    }
  }
}
