/**
 * ---- HOW TO PLAY, SHOWN.  A little moving picture for every step of every
 * cabinet's tutorial -- each one its own (user, 28 Oct: "a unique GIF per
 * step, not the same one again like the crane"), and each one drawn the way
 * its game looks: the same lane, the same pond, the same colours, lit the
 * same way, moving the way the game moves (Dance Off's arrows RISE to the
 * line; Air Hockey's rink runs up the screen, goals top and bottom).
 *
 * Each picture is a function of time, drawn fresh every frame into a box of
 * its own (`DEMO_W` x `DEMO_H`, its top-left at 0,0) -- clipped to that box
 * by the card (ui/tutorialCard), which also lays its light and vignette over
 * it -- and, where a word helps, a label in the small font (`lbl`).
 * Nothing here touches a game: a picture is only ever a picture.
 *
 * THE LOOK.  Not flat shapes: everything has its outline, its shading and
 * its shadow -- the frogs warty-green with a lit belly and wet eyes, the
 * pads notched and veined, the water moving, the floors textured (grass in
 * blades, bricks in courses, boards in planks).  The pieces are below, and
 * the pictures are built out of them.
 */

import type Phaser from 'phaser';

export const DEMO_W = 124;
export const DEMO_H = 90;

type G = Phaser.GameObjects.Graphics;
/** A label in the small font at (x, y), centred; `col` its colour. */
export type Lbl = (x: number, y: number, s: string, col?: number) => void;
export type Demo = (g: G, t: number, lbl: Lbl) => void;

// ---------------------------------------------------------------- the ink
const INK = 0x0a0812;
const CREAM = 0xf4ecd8;
const GOLD = 0xffd45e;
const GREEN = 0x5ac85a;
const RED = 0xe05050;
const BLUE = 0x5a9ad8;
const GREY = 0x6a7080;
const TEAL = 0x5ad8c8;
const PINK = 0xff5a8a;
const ORANGE = 0xff8a3a;

/** 0..1 through a loop `p` seconds long. */
const ph = (t: number, p: number): number => (((t % p) + p) % p) / p;
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const clamp01 = (k: number): number => Math.max(0, Math.min(1, k));
const ease = (k: number): number => {
  const c = clamp01(k);
  return c * c * (3 - 2 * c);
};
/** 0..1 for the part of a 0..1 loop between a and b. */
const seg = (k: number, a: number, b: number): number => clamp01((k - a) / (b - a));
/** The same random number for the same `i`, every frame. */
const rnd = (i: number): number => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
/** A colour `k` of the way to black (k < 0: to white). */
function shade(c: number, k: number): number {
  const to = k < 0 ? 255 : 0;
  const a = Math.abs(k);
  const ch = (s: number) => Math.round(((c >> s) & 255) + (to - ((c >> s) & 255)) * a);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// ---------------------------------------------------------------- the pieces

/** A sky or a wall: `top` to `bottom` in soft bands, across the whole box. */
function grad(g: G, top: number, bottom: number, y0 = 0, y1 = DEMO_H, bands = 10): void {
  const h = (y1 - y0) / bands;
  for (let i = 0; i < bands; i++) {
    const k = i / (bands - 1);
    const ch = (s: number) => Math.round(((top >> s) & 255) + (((bottom >> s) & 255) - ((top >> s) & 255)) * k);
    g.fillStyle((ch(16) << 16) | (ch(8) << 8) | ch(0), 1).fillRect(0, y0 + i * h, DEMO_W, h + 1);
  }
}

/** Grain: `n` specks of `col` over a rectangle, the same every frame. */
function speckle(g: G, seed: number, n: number, col: number, a: number, x0 = 0, y0 = 0, w = DEMO_W, h = DEMO_H, size = 1): void {
  g.fillStyle(col, a);
  for (let i = 0; i < n; i++) g.fillRect(Math.floor(x0 + rnd(seed + i) * w), Math.floor(y0 + rnd(seed + i + 500) * h), size, size);
}

/** A soft shadow under something, on the ground. */
function shadow(g: G, x: number, y: number, w: number, h = w * 0.35, a = 0.35): void {
  g.fillStyle(0x000000, a).fillEllipse(x, y, w, h);
  g.fillStyle(0x000000, a * 0.5).fillEllipse(x, y, w * 1.3, h * 1.3);
}

/** A glow: rings of `col` fading out from (x, y). */
function glow(g: G, x: number, y: number, r: number, col: number, a = 0.5): void {
  for (let i = 4; i >= 1; i--) g.fillStyle(col, (a * 0.25) / i + 0.02).fillCircle(x, y, (r * i) / 4 + 1);
}

/**
 * A FROG, sitting, centred on (x, y): `s` its size, `col` its skin, facing
 * the way `face` says.  Outlined, its back legs folded under, a lit belly,
 * warts, and wet eyes with a light in them.  `squash` > 0 crouches it
 * (ready to spring); < 0 stretches it (in the air).
 */
function frog(g: G, x: number, y: number, s = 1, col = GREEN, opt: { face?: number; squash?: number; mouth?: boolean; blink?: boolean } = {}): void {
  const sq = opt.squash ?? 0;
  const sw = 1 + sq * 0.25;
  const sh = 1 - sq * 0.25;
  const dark = shade(col, 0.45);
  const lite = shade(col, -0.35);
  const line = shade(col, 0.75);
  const W = 11 * s * sw;
  const H = 8 * s * sh;
  // legs, folded at the sides
  g.fillStyle(line, 1).fillEllipse(x - 5 * s * sw, y + 2.5 * s, 6 * s, 4 * s).fillEllipse(x + 5 * s * sw, y + 2.5 * s, 6 * s, 4 * s);
  g.fillStyle(dark, 1).fillEllipse(x - 5 * s * sw, y + 2.2 * s, 4.6 * s, 2.8 * s).fillEllipse(x + 5 * s * sw, y + 2.2 * s, 4.6 * s, 2.8 * s);
  // the body: outline, skin, a darker back, the lit belly
  g.fillStyle(line, 1).fillEllipse(x, y, W + 2, H + 2);
  g.fillStyle(col, 1).fillEllipse(x, y, W, H);
  g.fillStyle(dark, 0.5).fillEllipse(x, y - H * 0.18, W * 0.8, H * 0.45);
  g.fillStyle(lite, 0.8).fillEllipse(x, y + H * 0.18, W * 0.55, H * 0.42);
  // warts
  g.fillStyle(dark, 0.9).fillRect(Math.round(x - W * 0.28), Math.round(y - H * 0.2), 1, 1).fillRect(Math.round(x + W * 0.22), Math.round(y - H * 0.28), 1, 1);
  // the eyes, up on top, looking the way it faces
  const f = (opt.face ?? 0) * 0.8 * s;
  for (const sx of [-1, 1]) {
    const ex = x + sx * 3 * s * sw;
    const ey = y - 4 * s * sh;
    g.fillStyle(line, 1).fillCircle(ex, ey, 2.7 * s);
    g.fillStyle(col, 1).fillCircle(ex, ey, 2.3 * s);
    if (opt.blink) {
      g.fillStyle(line, 1).fillRect(ex - 1.5 * s, ey, 3 * s, 1);
    } else {
      g.fillStyle(0xffffff, 1).fillCircle(ex, ey, 1.6 * s);
      g.fillStyle(INK, 1).fillCircle(ex + f, ey + 0.2 * s, 0.9 * s);
      g.fillStyle(0xffffff, 0.9).fillRect(Math.round(ex - 0.8 * s), Math.round(ey - 1 * s), 1, 1);
    }
  }
  // the mouth: a line, or open (a chomp, a shout)
  if (opt.mouth) {
    g.fillStyle(0x3a0a14, 1).fillEllipse(x, y + 0.5 * s, 5 * s, 3 * s);
    g.fillStyle(0xff7a9a, 1).fillEllipse(x, y + 1.2 * s, 3 * s, 1.4 * s);
  } else g.lineStyle(1, line, 0.8).lineBetween(x - 2.5 * s, y + 0.5 * s, x + 2.5 * s, y + 0.5 * s);
}

/** FROGGY: the big yellow-bellied one who deals, spins and runs the place. */
function froggy(g: G, x: number, y: number, s = 1, opt: { mouth?: boolean } = {}): void {
  g.fillStyle(0x1e5a2a, 1).fillEllipse(x, y + 1, 22 * s, 20 * s);
  g.fillStyle(0x6ae08a, 1).fillEllipse(x, y, 20 * s, 18 * s);
  g.fillStyle(0xf8d848, 1).fillEllipse(x, y + 3 * s, 13 * s, 11 * s);
  g.fillStyle(0xfff0a0, 0.6).fillEllipse(x - 2 * s, y + 1 * s, 5 * s, 3 * s);
  for (const sx of [-1, 1]) {
    g.fillStyle(0x1e5a2a, 1).fillCircle(x + sx * 5 * s, y - 8 * s, 4 * s);
    g.fillStyle(0xffffff, 1).fillCircle(x + sx * 5 * s, y - 8 * s, 3 * s);
    g.fillStyle(INK, 1).fillCircle(x + sx * 5.4 * s, y - 7.6 * s, 1.5 * s);
  }
  if (opt.mouth) g.fillStyle(0x3a0a14, 1).fillEllipse(x, y - 2 * s, 7 * s, 3 * s);
  else g.lineStyle(1, 0x1e5a2a, 1).lineBetween(x - 4 * s, y - 2 * s, x + 4 * s, y - 2 * s);
}

/** A LIZARD, side on, facing left (`flip` faces it right). */
function lizard(g: G, x: number, y: number, s = 1, col = 0xd8a84a, flip = false): void {
  const d = flip ? -1 : 1;
  const dark = shade(col, 0.45);
  g.fillStyle(dark, 1).fillTriangle(x + d * 6 * s, y, x + d * 16 * s, y + 2 * s, x + d * 6 * s, y + 3 * s);
  g.fillStyle(dark, 1).fillEllipse(x, y + 1, 15 * s, 7 * s);
  g.fillStyle(col, 1).fillEllipse(x, y, 13 * s, 5.5 * s);
  g.fillStyle(col, 1).fillEllipse(x - d * 7 * s, y - 1 * s, 7 * s, 4.5 * s);
  g.fillStyle(dark, 1).fillRect(x - d * 3 * s, y + 2 * s, 2 * s, 2 * s).fillRect(x + d * 3 * s, y + 2 * s, 2 * s, 2 * s);
  g.fillStyle(0xfff0a0, 1).fillCircle(x - d * 8 * s, y - 2 * s, 1.2 * s);
  g.fillStyle(INK, 1).fillRect(x - d * 8 * s, y - 2 * s, 1, 1);
  for (let i = 0; i < 3; i++) g.fillStyle(dark, 0.8).fillRect(x - 3 * s + i * 3 * s, y - 2.5 * s, 1.5 * s, 1);
}

/** A LILY PAD at (x, y), `r` across, tilted to the view: notched, veined, lit. */
function lily(g: G, x: number, y: number, r: number, col = 0x3e9a3e, notch = 0.6, tilt = 0.75): void {
  const ry = r * tilt;
  g.fillStyle(0x06202a, 0.5).fillEllipse(x + 1, y + 1.5, r * 2, ry * 2);
  g.fillStyle(shade(col, 0.55), 1).fillEllipse(x, y, r * 2 + 1, ry * 2 + 1);
  g.fillStyle(col, 1).fillEllipse(x, y, r * 2, ry * 2);
  g.fillStyle(shade(col, -0.3), 0.6).fillEllipse(x - r * 0.25, y - ry * 0.3, r * 1.1, ry * 0.9);
  g.lineStyle(1, shade(col, -0.45), 0.45);
  for (let i = 0; i < 6; i++) {
    const a = notch + 0.5 + i * 0.9;
    g.lineBetween(x, y, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * ry * 0.8);
  }
  // the notch, cut in to the stem
  g.fillStyle(0x0c2a36, 1).fillTriangle(x, y, x + Math.cos(notch - 0.22) * (r + 1), y + Math.sin(notch - 0.22) * (ry + 1), x + Math.cos(notch + 0.22) * (r + 1), y + Math.sin(notch + 0.22) * (ry + 1));
}

/** Pond water over a rectangle: deep, with slow glints sliding across. */
function water(g: G, t: number, x0 = 0, y0 = 0, w = DEMO_W, h = DEMO_H, deep = 0x103848, light = 0x1e5a6a): void {
  g.fillStyle(deep, 1).fillRect(x0, y0, w, h);
  g.fillStyle(light, 0.55).fillEllipse(x0 + w * 0.45, y0 + h * 0.45, w * 0.9, h * 0.7);
  for (let i = 0; i < 14; i++) {
    const p = t * (0.2 + (i % 4) * 0.05) + i * 1.3;
    const gx = x0 + ((i * 37 + p * 12) % (w + 10)) - 5;
    const gy = y0 + ((i * 23) % h);
    g.fillStyle(0x9ad8e8, 0.15 + 0.1 * Math.sin(p * 2)).fillRect(Math.round(gx), gy, 2 + (i % 3), 1);
  }
}

/** Grass in blades over a rectangle. */
function grass(g: G, x0: number, y0: number, w: number, h: number, base = 0x3a6a2e, seed = 1): void {
  g.fillStyle(base, 1).fillRect(x0, y0, w, h);
  g.fillStyle(shade(base, 0.25), 1);
  for (let i = 0; i < (w * h) / 22; i++) g.fillRect(Math.floor(x0 + rnd(seed + i) * w), Math.floor(y0 + rnd(seed + i + 77) * h), 1, 2);
  g.fillStyle(shade(base, -0.25), 1);
  for (let i = 0; i < (w * h) / 40; i++) g.fillRect(Math.floor(x0 + rnd(seed + i + 300) * w), Math.floor(y0 + rnd(seed + i + 377) * h), 1, 1);
}

/** Bricks in courses over a rectangle. */
function bricks(g: G, x0: number, y0: number, w: number, h: number, col = 0x2a3448, mortar = 0x161c28, bw = 12, bh = 6): void {
  g.fillStyle(mortar, 1).fillRect(x0, y0, w, h);
  for (let r = 0; r * bh < h; r++) {
    const off = r % 2 ? bw / 2 : 0;
    for (let c = -1; c * bw < w; c++) {
      const bx = x0 + c * bw + off;
      const k = rnd(r * 31 + c) * 0.18;
      g.fillStyle(shade(col, k - 0.05), 1).fillRect(Math.max(x0, bx + 1), y0 + r * bh + 1, Math.min(bw - 1, x0 + w - bx - 1), bh - 1);
      g.fillStyle(shade(col, -0.15), 0.5).fillRect(Math.max(x0, bx + 1), y0 + r * bh + 1, Math.min(bw - 1, x0 + w - bx - 1), 1);
    }
  }
}

/** Boards (a floor, a lane, a fence) over a rectangle: planks running down. */
function planks(g: G, x0: number, y0: number, w: number, h: number, col = 0x9a6a3a, pw = 6, across = false): void {
  g.fillStyle(shade(col, 0.4), 1).fillRect(x0, y0, w, h);
  const n = Math.ceil((across ? h : w) / pw);
  for (let i = 0; i < n; i++) {
    const k = rnd(i * 7 + 3) * 0.16 - 0.05;
    g.fillStyle(shade(col, k), 1);
    if (across) g.fillRect(x0, y0 + i * pw, w, pw - 1);
    else g.fillRect(x0 + i * pw, y0, pw - 1, h);
  }
  speckle(g, 9, Math.round((w * h) / 30), shade(col, 0.3), 0.5, x0, y0, w, h);
}

/** A keycap at (x, y), pressed or not, its letter in the small font. */
function key(g: G, lbl: Lbl, x: number, y: number, k: string, down = false, w = 11): void {
  const dy = down ? 1 : 0;
  g.fillStyle(0x0c0a14, 1).fillRect(x - w / 2, y - 5 + 1, w, 10);
  g.fillStyle(down ? TEAL : 0x3a3450, 1).fillRect(x - w / 2, y - 5 + dy, w, 9);
  g.fillStyle(down ? 0xa8fff0 : 0x5a5478, 1).fillRect(x - w / 2 + 1, y - 5 + dy, w - 2, 1);
  g.lineStyle(1, down ? 0xffffff : 0x8a84a8, 1).strokeRect(x - w / 2 + 0.5, y - 4.5 + dy, w - 1, 8);
  lbl(x, y - 1 + dy, k, down ? INK : CREAM);
}

/** A fingertip, landing (down) or hovering, at (x, y). */
export function tip(g: G, x: number, y: number, down: boolean): void {
  g.fillStyle(0xffffff, down ? 0.9 : 0.45).fillCircle(x, y, down ? 2.5 : 3.5);
  if (down) g.lineStyle(1, 0xffffff, 0.5).strokeCircle(x, y, 5);
}

/** The pointer: an arrow cursor at (x, y), clicking or not. */
function cursor(g: G, x: number, y: number, click = false): void {
  if (click) g.lineStyle(1, GOLD, 0.9).strokeCircle(x, y, 5);
  g.fillStyle(INK, 1).fillTriangle(x - 0.5, y - 0.5, x - 0.5, y + 9, x + 6, y + 7);
  g.fillStyle(0xffffff, 1).fillTriangle(x + 0.6, y + 1.5, x + 0.6, y + 7, x + 4.2, y + 6);
}

/** A coin, spinning a little. */
function coin(g: G, x: number, y: number, t: number, r = 4): void {
  const w = r * (0.6 + Math.abs(Math.sin(t * 5)) * 0.4);
  g.fillStyle(0x7a5010, 1).fillEllipse(x, y + 1, w * 2, r * 2);
  g.fillStyle(GOLD, 1).fillEllipse(x, y, w * 2, r * 2);
  g.fillStyle(0xfff4b0, 0.8).fillEllipse(x - w * 0.3, y - r * 0.3, w * 0.7, r * 0.6);
}

/** An arrow from a to b. */
function arrow(g: G, x1: number, y1: number, x2: number, y2: number, col = GOLD): void {
  g.lineStyle(1, col, 1).lineBetween(x1, y1, x2, y2);
  const a = Math.atan2(y2 - y1, x2 - x1);
  g.fillStyle(col, 1).fillTriangle(x2, y2, x2 - Math.cos(a - 0.5) * 4, y2 - Math.sin(a - 0.5) * 4, x2 - Math.cos(a + 0.5) * 4, y2 - Math.sin(a + 0.5) * 4);
}

/** A dotted arc of a throw from (x0, y0), `vx`/`vy` px a second, under `grav`. */
function dots(g: G, x0: number, y0: number, vx: number, vy: number, grav: number, col: number, n = 10, wind = 0, a = 1): void {
  for (let i = 1; i <= n; i++) {
    const s = i * 0.09;
    g.fillStyle(col, a).fillRect(Math.round(x0 + vx * s + wind * s * s), Math.round(y0 + vy * s + grav * s * s), 1, 1);
  }
}

/** A playing card face, dealt at (x, y). */
function card(g: G, lbl: Lbl, x: number, y: number, face: string, red = false, back = false): void {
  g.fillStyle(0x000000, 0.4).fillRect(x - 6 + 1, y - 8 + 1, 13, 17);
  if (back) {
    g.fillStyle(0x7a1a3a, 1).fillRect(x - 6, y - 8, 12, 16);
    g.lineStyle(1, 0xffd0e0, 0.6).strokeRect(x - 4.5, y - 6.5, 9, 13);
    return;
  }
  g.fillStyle(CREAM, 1).fillRect(x - 6, y - 8, 12, 16);
  g.fillStyle(0xffffff, 1).fillRect(x - 6, y - 8, 12, 2);
  lbl(x, y - 1, face, red ? RED : INK);
}

/** A bar `k` full, at (x, y). */
function bar(g: G, x: number, y: number, w: number, k: number, col: number, h = 4): void {
  g.fillStyle(0x0c0a14, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(0x2a2638, 1).fillRect(x, y, w, h);
  g.fillStyle(col, 1).fillRect(x, y, Math.round(w * clamp01(k)), h);
  g.fillStyle(shade(col, -0.4), 0.7).fillRect(x, y, Math.round(w * clamp01(k)), 1);
}

/** A tick or a cross, said big. */
function verdict(g: G, x: number, y: number, ok: boolean): void {
  if (ok) {
    g.lineStyle(3, 0x0a2a10, 1).lineBetween(x - 4, y, x - 1, y + 3).lineBetween(x - 1, y + 3, x + 5, y - 4);
    g.lineStyle(2, GREEN, 1).lineBetween(x - 4, y, x - 1, y + 3).lineBetween(x - 1, y + 3, x + 5, y - 4);
  } else {
    g.lineStyle(3, 0x2a0a0a, 1).lineBetween(x - 4, y - 4, x + 4, y + 4).lineBetween(x + 4, y - 4, x - 4, y + 4);
    g.lineStyle(2, RED, 1).lineBetween(x - 4, y - 4, x + 4, y + 4).lineBetween(x + 4, y - 4, x - 4, y + 4);
  }
}

/** A burst of `n` rays round (x, y): a hit, a pop, a win. */
function burst(g: G, x: number, y: number, r: number, col: number, n = 8, a = 1): void {
  g.lineStyle(1, col, a);
  for (let i = 0; i < n; i++) {
    const an = (i / n) * Math.PI * 2;
    g.lineBetween(x + Math.cos(an) * r * 0.45, y + Math.sin(an) * r * 0.45, x + Math.cos(an) * r, y + Math.sin(an) * r);
  }
}

/** A dark panel with a light edge (a sign, a score box, a button). */
function panel(g: G, x: number, y: number, w: number, h: number, edge = 0x8a84a8, fill = 0x141024): void {
  g.fillStyle(0x000000, 0.45).fillRect(x + 1, y + 1, w, h);
  g.fillStyle(fill, 1).fillRect(x, y, w, h);
  g.lineStyle(1, edge, 1).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/** One of Dance Off's arrows (0 left, 1 down, 2 up, 3 right) as a filled glyph. */
function dirArrow(g: G, x: number, y: number, dir: number, col: number, s = 5, outline = false): void {
  const a = [Math.PI, Math.PI / 2, -Math.PI / 2, 0][dir];
  const p = (u: number, v: number) => ({ x: x + Math.cos(a) * u - Math.sin(a) * v, y: y + Math.sin(a) * u + Math.cos(a) * v });
  const pts = [p(s, 0), p(0, -s), p(0, -s * 0.45), p(-s, -s * 0.45), p(-s, s * 0.45), p(0, s * 0.45), p(0, s)];
  if (outline) {
    g.lineStyle(1, col, 0.9);
    g.strokePoints(pts as Phaser.Types.Math.Vector2Like[], true);
  } else {
    g.fillStyle(col, 1);
    g.fillPoints(pts as Phaser.Types.Math.Vector2Like[], true);
  }
}

/** A road car seen from above, nose up (`down` turns it round). */
function car(g: G, x: number, y: number, col: number, down = false, w = 8, h = 13): void {
  g.fillStyle(0x000000, 0.35).fillRect(x - w / 2 + 1, y - h / 2 + 2, w, h);
  g.fillStyle(shade(col, 0.5), 1).fillRect(x - w / 2, y - h / 2, w, h);
  g.fillStyle(col, 1).fillRect(x - w / 2 + 1, y - h / 2 + 1, w - 2, h - 2);
  const wy = down ? y + h / 2 - 5 : y - h / 2 + 2;
  g.fillStyle(0x1a2a3a, 1).fillRect(x - w / 2 + 2, wy, w - 4, 3);
  g.fillStyle(0xfff0a0, 1).fillRect(x - w / 2 + 1, down ? y + h / 2 - 1 : y - h / 2, 2, 1).fillRect(x + w / 2 - 3, down ? y + h / 2 - 1 : y - h / 2, 2, 1);
}

/** A road car seen from the side, going left or right. */
function sideCar(g: G, x: number, y: number, col: number, dir: number, w = 16): void {
  g.fillStyle(0x000000, 0.35).fillRect(x - w / 2, y + 2, w, 2);
  g.fillStyle(shade(col, 0.5), 1).fillRect(x - w / 2, y - 3, w, 5);
  g.fillStyle(col, 1).fillRect(x - w / 2 + 1, y - 3, w - 2, 4);
  g.fillStyle(0x1a2a3a, 1).fillRect(x - w / 4, y - 6, w / 2, 3);
  g.fillStyle(0xfff0a0, 1).fillRect(dir > 0 ? x + w / 2 - 1 : x - w / 2, y - 2, 1, 2);
  g.fillStyle(0x0a0a0a, 1).fillRect(x - w / 2 + 2, y + 1, 3, 2).fillRect(x + w / 2 - 5, y + 1, 3, 2);
}

// ---------------------------------------------------------------- shared scenes

/** The Chubby Chomp pond: sky, the treeline, the water, a log at the front. */
function chompPond(g: G, t: number): void {
  grad(g, 0x7ac8e8, 0xb8e0f0, 0, 26, 6);
  g.fillStyle(0xffffff, 0.7).fillEllipse(30 + Math.sin(t * 0.3) * 3, 8, 18, 5).fillEllipse(92, 12, 14, 4);
  for (let i = 0; i < 9; i++) g.fillStyle(i % 2 ? 0x3a7a3a : 0x2e6a32, 1).fillEllipse(6 + i * 15, 26, 22, 14);
  g.fillStyle(0x2a5a2a, 1).fillRect(0, 26, DEMO_W, 4);
  water(g, t, 0, 30, DEMO_W, DEMO_H - 30, 0x2a7a8a, 0x3a8a9a);
}

/** Chubby, the big frog on his pad, mouth open or shut. */
function chubby(g: G, x: number, y: number, open: boolean): void {
  lily(g, x, y + 8, 16, 0x3e9a3e, 1.2);
  g.fillStyle(0x1e5a2a, 1).fillEllipse(x, y, 26, 22);
  g.fillStyle(0x7ae07a, 1).fillEllipse(x, y - 1, 24, 20);
  g.fillStyle(0xf0f8d0, 1).fillEllipse(x, y + 3, 15, 11);
  for (const sx of [-1, 1]) {
    g.fillStyle(0x1e5a2a, 1).fillCircle(x + sx * 6, y - 10, 4.5);
    g.fillStyle(0xffffff, 1).fillCircle(x + sx * 6, y - 10, 3.4);
    g.fillStyle(INK, 1).fillCircle(x + sx * 6, y - 9.5, 1.7);
  }
  if (open) {
    g.fillStyle(0x5a0a1a, 1).fillEllipse(x, y - 3, 14, 7);
    g.fillStyle(0xff7a9a, 1).fillEllipse(x, y - 1.5, 8, 3);
  } else g.lineStyle(1, 0x1e5a2a, 1).lineBetween(x - 6, y - 4, x + 6, y - 4);
  g.fillStyle(0xff9ab0, 0.6).fillCircle(x - 9, y - 2, 2).fillCircle(x + 9, y - 2, 2);
}

/** A fly, wings beating. */
function fly(g: G, x: number, y: number, t: number, lit = false): void {
  if (lit) glow(g, x, y, 6, GOLD, 0.8);
  const w = Math.sin(t * 40) > 0 ? 2 : 1;
  g.fillStyle(0xd8f0ff, 0.8).fillEllipse(x - 2, y - 1.5, 3, w * 1.5).fillEllipse(x + 2, y - 1.5, 3, w * 1.5);
  g.fillStyle(lit ? GOLD : 0x1a1a2a, 1).fillEllipse(x, y, 4, 3);
}

/** The Whack-a-Frog green: grass, and a hole with its dirt rim. */
function whackHole(g: G, x: number, y: number): void {
  g.fillStyle(0x4a3a24, 1).fillEllipse(x, y + 1, 26, 9);
  g.fillStyle(0x1a120a, 1).fillEllipse(x, y, 22, 7);
  g.fillStyle(0x6a5232, 1).fillEllipse(x, y + 3, 24, 3);
}

/** A whack frog up out of its hole by `k` (0 down, 1 up). */
function whackFrog(g: G, x: number, y: number, k: number, hit = false): void {
  if (k <= 0) return;
  const up = ease(k) * 9;
  frog(g, x, y - up + 2, 0.95, hit ? 0xa8e0a8 : 0x6ad87a, { blink: hit });
  // the front of the hole over its feet
  g.fillStyle(0x6a5232, 1).fillEllipse(x, y + 3, 24, 3);
}

/** The bowling lane, top to bottom: boards, gutters, the pins at the far end. */
function lane(g: G, pinsDown = 0): void {
  grass(g, 0, 0, DEMO_W, DEMO_H, 0x4a8a3a, 11);
  g.fillStyle(0x3a6aa0, 1).fillRect(36, 0, 4, DEMO_H).fillRect(84, 0, 4, DEMO_H);
  planks(g, 40, 0, 44, DEMO_H, 0xc89a5a, 5);
  g.fillStyle(0xffffff, 0.08).fillRect(40, 0, 10, DEMO_H);
  g.fillStyle(0xc83a3a, 1).fillRect(40, DEMO_H - 12, 44, 1);
  // the arrows on the lane
  for (let i = 0; i < 5; i++) g.fillStyle(0x6a4a24, 1).fillTriangle(48 + i * 7, 52, 46 + i * 7, 56, 50 + i * 7, 56);
  pins(g, 62, 8, pinsDown);
}

/** Ten pins in their triangle, `down` of them knocked over. */
function pins(g: G, cx: number, y: number, down: number): void {
  let i = 0;
  for (let row = 0; row < 4; row++) {
    for (let c = 0; c <= row; c++) {
      const x = cx - row * 3 + c * 6;
      const py = y + (3 - row) * 4;
      if (i++ < down) {
        g.fillStyle(0xe8e0d0, 0.8).fillRect(x - 3, py + 1, 6, 2);
        continue;
      }
      g.fillStyle(0x000000, 0.3).fillEllipse(x, py + 3, 5, 2);
      g.fillStyle(0xf8f4ec, 1).fillEllipse(x, py, 3.5, 5);
      g.fillStyle(RED, 1).fillRect(x - 1.5, py - 1, 3, 1);
    }
  }
}

/** A bowling ball, purple and shiny. */
function ball(g: G, x: number, y: number, r = 3.5): void {
  g.fillStyle(0x000000, 0.35).fillEllipse(x + 1, y + 2, r * 2, r);
  g.fillStyle(0x2a1a5a, 1).fillCircle(x, y, r);
  g.fillStyle(0x5a3aa0, 1).fillCircle(x - 0.5, y - 0.5, r - 1);
  g.fillStyle(0xd8c8ff, 0.8).fillRect(x - 1.5, y - 2, 1, 1);
}

/** The pond hunt's water and its pads in a block of `cols` x `rows`. */
function huntPond(g: G, t: number, x0: number, y0: number, cols: number, rows: number, dx = 14, dy = 12): void {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) lily(g, x0 + c * dx + (r % 2) * (dx / 2), y0 + r * dy, 5.5, 0x3e9a3e, rnd(r * 9 + c) * 6);
  void t;
}

/** The Grudge ring: the crowd in the dark, the ropes, the boards. */
function ring(g: G, t: number): void {
  grad(g, 0x1a1030, 0x3a2a5a, 0, 64, 8);
  for (let i = 0; i < 16; i++) g.fillStyle(0x0a0614, 1).fillCircle(4 + i * 8, 40 + Math.sin(t * 3 + i) * 0.8, 5);
  for (let i = 0; i < 16; i++) g.fillStyle(0x140c24, 1).fillCircle(i * 8, 50 + Math.sin(t * 2.5 + i * 2) * 0.8, 5);
  g.lineStyle(1, 0xc83a4a, 0.8).lineBetween(0, 46, DEMO_W, 46).lineBetween(0, 52, DEMO_W, 52).lineBetween(0, 58, DEMO_W, 58);
  g.fillStyle(0xd8d8e8, 1).fillRect(6, 42, 2, 22).fillRect(DEMO_W - 8, 42, 2, 22);
  planks(g, 0, 64, DEMO_W, DEMO_H - 64, 0x9a7048, 8, true);
}

/** A boxing frog, standing (or crouching, or striking high / low). */
function fighter(g: G, x: number, y: number, pose: 'stand' | 'crouch' | 'high' | 'low' | 'block' | 'jump', face = 1): void {
  const c = pose === 'crouch' || pose === 'low';
  const top = y - (c ? 14 : 22);
  shadow(g, x, y + 1, 12);
  g.fillStyle(0x1e5a2a, 1).fillRect(x - 4, top + 7, 9, c ? 8 : 14);
  g.fillStyle(0x5ac85a, 1).fillRect(x - 3, top + 7, 7, c ? 7 : 13);
  g.fillStyle(0xa8e8a0, 1).fillRect(x - 1, top + 9, 3, c ? 4 : 9);
  g.fillStyle(0x2e7a3a, 1).fillRect(x - 4, y - 3, 3, 3).fillRect(x + 2, y - 3, 3, 3);
  g.fillStyle(0x1e5a2a, 1).fillEllipse(x + face, top + 4, 11, 9);
  g.fillStyle(0x5ac85a, 1).fillEllipse(x + face, top + 4, 9, 7);
  g.fillStyle(0xffffff, 1).fillCircle(x - 2 + face, top + 1, 1.6).fillCircle(x + 3 + face, top + 1, 1.6);
  g.fillStyle(INK, 1).fillRect(x - 2 + face * 1.5, top + 1, 1, 1).fillRect(x + 3 + face * 1.5, top + 1, 1, 1);
  // the gloves
  const gx = pose === 'high' ? x + face * 11 : pose === 'low' ? x + face * 12 : x + face * 5;
  const gy = pose === 'high' ? top + 5 : pose === 'low' ? y - 3 : pose === 'block' ? top + 4 : top + 10;
  g.fillStyle(0x7a0a1a, 1).fillCircle(gx, gy, 3);
  g.fillStyle(0xe03a4a, 1).fillCircle(gx, gy - 0.5, 2.4);
  if (pose === 'block') {
    g.fillStyle(0x7a0a1a, 1).fillCircle(x + face * 5, top + 9, 3);
    g.fillStyle(0xe03a4a, 1).fillCircle(x + face * 5, top + 8.5, 2.4);
    g.lineStyle(1, 0x8ad8ff, 0.8).strokeEllipse(x + face * 8, top + 7, 6, 14);
  }
}

/** The hyena Grudge's frog fights: tan, spotted, on its hind legs. */
function hyena(g: G, x: number, y: number, crouch = false, hit = 0): void {
  const top = y - (crouch ? 13 : 22);
  const kx = hit * 4;
  shadow(g, x + kx, y + 1, 12);
  g.fillStyle(0x6a5030, 1).fillRect(x - 4 + kx, top + 6, 9, crouch ? 9 : 16);
  g.fillStyle(0xc8a070, 1).fillRect(x - 3 + kx, top + 6, 7, crouch ? 8 : 15);
  g.fillStyle(0x6a5030, 1).fillRect(x - 2 + kx, top + 9, 2, 2).fillRect(x + 1 + kx, top + 13, 2, 2);
  g.fillStyle(0x6a5030, 1).fillEllipse(x - 3 + kx, top + 3, 12, 8);
  g.fillStyle(0xc8a070, 1).fillEllipse(x - 3 + kx, top + 3, 10, 6);
  g.fillStyle(0x3a2a1a, 1).fillRect(x - 9 + kx, top + 3, 3, 2);
  g.fillStyle(0x6a5030, 1).fillTriangle(x + kx, top - 1, x + 3 + kx, top - 5, x + 3 + kx, top);
  g.fillStyle(INK, 1).fillRect(x - 5 + kx, top + 1, 1, 1);
  if (hit > 0.5) burst(g, x - 4 + kx, top + (crouch ? 8 : 6), 7, GOLD);
}

/** A Barrel Climb girder: red steel with its rivets. */
function girder(g: G, x: number, y: number, w: number): void {
  g.fillStyle(0x6a1a2a, 1).fillRect(x, y, w, 4);
  g.fillStyle(0xd84a5a, 1).fillRect(x, y, w, 2);
  for (let i = 3; i < w; i += 8) g.fillStyle(0xf8a8b0, 1).fillRect(x + i, y + 1, 1, 1);
}

/** A ladder, from y0 up to y1. */
function ladder(g: G, x: number, y0: number, y1: number): void {
  g.fillStyle(0x2a8a9a, 1).fillRect(x - 3, y1, 1, y0 - y1).fillRect(x + 3, y1, 1, y0 - y1);
  for (let y = y1 + 2; y < y0; y += 3) g.fillStyle(0x6ae0f0, 1).fillRect(x - 3, y, 7, 1);
}

/** A rolling barrel, yellow or orange. */
function barrel(g: G, x: number, y: number, t: number, col = 0xe8c03a): void {
  g.fillStyle(shade(col, 0.5), 1).fillCircle(x, y, 4);
  g.fillStyle(col, 1).fillCircle(x, y, 3.2);
  const a = t * 8;
  g.lineStyle(1, shade(col, 0.6), 1).lineBetween(x + Math.cos(a) * 3, y + Math.sin(a) * 3, x - Math.cos(a) * 3, y - Math.sin(a) * 3);
}

/** The jungle behind Barrel Climb. */
function jungle(g: G, t: number): void {
  grad(g, 0x0a1e14, 0x14301e, 0, DEMO_H, 6);
  for (let i = 0; i < 10; i++) g.fillStyle(i % 2 ? 0x1e4a2a : 0x163a22, 1).fillEllipse(rnd(i) * DEMO_W, rnd(i + 9) * DEMO_H, 26, 12);
  g.fillStyle(0x3a2a1a, 1).fillRect(4, 0, 6, DEMO_H).fillRect(DEMO_W - 10, 0, 6, DEMO_H);
  for (let i = 0; i < 8; i++) {
    const x = 14 + i * 13;
    g.lineStyle(1, 0x2e6a32, 1).lineBetween(x, 0, x + Math.sin(t + i) * 1.5, 6 + (i % 3) * 5);
  }
}

/** The air hockey table, up the screen: lizard's goal at the top, yours at the bottom. */
function rink(g: G): void {
  g.fillStyle(0x5a3a1a, 1).fillRect(20, 0, 84, DEMO_H);
  g.fillStyle(0x1e6a6a, 1).fillRect(24, 3, 76, DEMO_H - 6);
  for (let y = 7; y < DEMO_H - 4; y += 5) for (let x = 28; x < 98; x += 5) g.fillStyle(0x2e8a8a, 1).fillRect(x, y, 1, 1);
  g.fillStyle(0xffffff, 0.06).fillTriangle(24, 3, 70, 3, 24, 60);
  g.lineStyle(1, 0xe8e0c0, 0.7).lineBetween(24, DEMO_H / 2, 100, DEMO_H / 2).strokeCircle(62, DEMO_H / 2, 9);
  g.fillStyle(PINK, 1).fillRect(46, 2, 32, 2);
  g.fillStyle(GOLD, 1).fillRect(46, DEMO_H - 4, 32, 2);
}

/** A mallet with a face: the frog's (green) or the lizard's (orange). */
function mallet(g: G, x: number, y: number, mine: boolean): void {
  const col = mine ? 0x4aa85a : 0xe0903a;
  g.fillStyle(0x000000, 0.35).fillCircle(x + 1, y + 2, 6);
  g.fillStyle(shade(col, 0.5), 1).fillCircle(x, y, 6);
  g.fillStyle(col, 1).fillCircle(x, y, 5);
  g.fillStyle(0xffffff, 1).fillCircle(x - 2, y - 1, 1.3).fillCircle(x + 2, y - 1, 1.3);
  g.fillStyle(INK, 1).fillRect(x - 2, y - 1, 1, 1).fillRect(x + 2, y - 1, 1, 1);
}

function puck(g: G, x: number, y: number): void {
  g.fillStyle(0x000000, 0.35).fillCircle(x + 1, y + 1, 3);
  g.fillStyle(0x0a0a10, 1).fillCircle(x, y, 3);
  g.fillStyle(0x4a4a5a, 1).fillCircle(x - 0.5, y - 0.5, 1.5);
}

/** The flooding shaft: blue brick, the pillars. */
function shaft(g: G): void {
  bricks(g, 0, 0, DEMO_W, DEMO_H, 0x24304a, 0x121826, 12, 6);
  g.fillStyle(0x3a4a66, 1).fillRect(0, 0, 8, DEMO_H).fillRect(DEMO_W - 8, 0, 8, DEMO_H);
  g.fillStyle(0xffffff, 0.04).fillTriangle(30, 0, 70, 0, 50, DEMO_H);
}

/** A wooden ledge with its bolts. */
function ledge(g: G, x: number, y: number, w: number, a = 1): void {
  g.fillStyle(0x3a2a1a, a).fillRect(x, y, w, 4);
  g.fillStyle(0x9a7448, a).fillRect(x, y, w, 3);
  g.fillStyle(0xc89a68, a).fillRect(x, y, w, 1);
  for (let i = 2; i < w; i += 7) g.fillStyle(0x5a5a6a, a).fillRect(x + i, y + 1, 1, 1);
}

/** Rising water with a wavy top at `y`. */
function flood(g: G, t: number, y: number): void {
  g.fillStyle(0x1e5aa0, 0.85).fillRect(0, y, DEMO_W, DEMO_H - y);
  for (let x = 0; x < DEMO_W; x += 2) g.fillStyle(0x8ac8ff, 0.8).fillRect(x, y + Math.round(Math.sin(t * 4 + x * 0.3)), 2, 1);
  g.fillStyle(0x3a7ac8, 0.5).fillRect(0, y + 3, DEMO_W, 2);
}

/** The Dance Off stage: dark purple, the lights, and the two lanes' tops. */
function stage(g: G, t: number): void {
  grad(g, 0x1a0e2e, 0x2a1a44, 0, DEMO_H, 8);
  for (let i = 0; i < 3; i++) g.fillStyle([PINK, TEAL, GOLD][i], 0.08 + 0.05 * Math.sin(t * 3 + i * 2)).fillTriangle(20 + i * 40, 0, 6 + i * 40, DEMO_H, 34 + i * 40, DEMO_H);
}
const DANCE_COLS = [PINK, 0x5ad8f0, 0x8ae86a, ORANGE];

/** The Frog Cross road: verge, asphalt with its dashes, the kerb. */
function road(g: G): void {
  g.fillStyle(0x3a7a3a, 1).fillRect(0, 0, DEMO_W, 10);
  grass(g, 0, 0, DEMO_W, 9, 0x3a7a3a, 41);
  g.fillStyle(0x34343c, 1).fillRect(0, 10, DEMO_W, 64);
  speckle(g, 61, 90, 0x44444e, 1, 0, 10, DEMO_W, 64);
  for (let l = 1; l < 4; l++) for (let x = 2; x < DEMO_W; x += 12) g.fillStyle(0xb8b8c0, 0.6).fillRect(x, 10 + l * 16, 6, 1);
  g.fillStyle(0x8a8a96, 1).fillRect(0, 74, DEMO_W, 2);
  g.fillStyle(0x2a3040, 1).fillRect(0, 76, DEMO_W, DEMO_H - 76);
}

/** The Car Chase road, top-down, its dashes running down past you. */
function chaseRoad(g: G, t: number, speed = 40): void {
  grass(g, 0, 0, DEMO_W, DEMO_H, 0x2a5a2a, 71);
  g.fillStyle(0x3a3a44, 1).fillRect(22, 0, 80, DEMO_H);
  speckle(g, 81, 80, 0x4a4a54, 1, 22, 0, 80, DEMO_H);
  g.fillStyle(0xd8d8e0, 1).fillRect(22, 0, 1, DEMO_H).fillRect(101, 0, 1, DEMO_H);
  const off = (t * speed) % 14;
  for (let l = 1; l < 4; l++) for (let y = -14; y < DEMO_H; y += 14) g.fillStyle(0xd8d8e0, 0.7).fillRect(22 + l * 20, y + off, 1, 6);
  for (let i = 0; i < 4; i++) g.fillStyle(0x1e4a1e, 1).fillCircle(10, ((i * 30 + t * speed) % 120) - 10, 6).fillCircle(114, ((i * 30 + 15 + t * speed) % 120) - 10, 6);
}

/** A police car from above, its lights going. */
function cop(g: G, x: number, y: number, t: number, spin = 0): void {
  if (spin) {
    g.fillStyle(0x2a2a3a, 1).fillCircle(x, y, 7);
  }
  car(g, x, y, 0xe8e8f0, false);
  g.fillStyle(0x1a1a2a, 1).fillRect(x - 4, y - 1, 8, 3);
  const on = Math.sin(t * 20) > 0;
  g.fillStyle(on ? RED : BLUE, 1).fillRect(x - 3, y, 3, 1);
  g.fillStyle(on ? BLUE : RED, 1).fillRect(x, y, 3, 1);
  glow(g, x, y, 5, on ? RED : BLUE, 0.4);
}

/** The Fence Wars field: sky, clouds, hills, the fence in the middle. */
function fenceField(g: G, t: number): void {
  grad(g, 0x5aa0d8, 0xb8e0f0, 0, 60, 8);
  g.fillStyle(0xffffff, 0.8).fillEllipse(24 + Math.sin(t * 0.4) * 4, 14, 22, 7).fillEllipse(96 + Math.sin(t * 0.3) * 3, 10, 18, 6);
  g.fillStyle(0x6ab84a, 1).fillEllipse(30, 64, 90, 30).fillEllipse(100, 66, 90, 28);
  grass(g, 0, 66, DEMO_W, DEMO_H - 66, 0x4a9a3a, 91);
  for (let i = 0; i < 12; i++) g.fillStyle([0xffffff, 0xff7aa0, 0xffe05a][i % 3], 1).fillRect(Math.floor(rnd(i + 40) * DEMO_W), 68 + Math.floor(rnd(i + 60) * 18), 1, 1);
  // the fence
  for (let i = 0; i < 3; i++) {
    g.fillStyle(0x5a3a1a, 1).fillRect(56 + i * 4, 30, 4, 40);
    g.fillStyle(0x9a6a3a, 1).fillRect(57 + i * 4, 30, 2, 40);
  }
  g.fillStyle(0x3a2a1a, 1).fillRect(55, 38, 14, 2).fillRect(55, 58, 14, 2);
}

/** The Bog Ball marsh: noisy moss, the cobbles, the arches at either end. */
function marsh(g: G, t: number): void {
  g.fillStyle(0x1e3420, 1).fillRect(0, 0, DEMO_W, DEMO_H);
  for (let i = 0; i < 40; i++) g.fillStyle([0x24422a, 0x2e4a26, 0x1c3420, 0x2a3a1c][i % 4], 1).fillEllipse(rnd(i + 3) * DEMO_W, rnd(i + 33) * DEMO_H, 14 + rnd(i) * 12, 6 + rnd(i + 1) * 6);
  for (let i = 0; i < 4; i++) g.fillStyle(0x081214, 0.8).fillEllipse(20 + rnd(i + 70) * 84, 10 + rnd(i + 80) * 70, 10, 4);
  speckle(g, 101, 70, 0x4f7a34, 1);
  g.fillStyle(0x4a4448, 1).fillRect(0, 0, 6, DEMO_H).fillRect(DEMO_W - 6, 0, 6, DEMO_H);
  // the arches, lit
  for (const [x, col] of [[3, 0x3a8ad8], [DEMO_W - 3, 0xe8642a]] as const) {
    g.fillStyle(0x2a2428, 1).fillRect(x - 4, 30, 8, 30);
    g.fillStyle(col, 0.5 + 0.25 * Math.sin(t * 4)).fillRect(x - 2, 33, 4, 24);
  }
}

/** A Bog Ball frog: green toad (yours) or magma (his), from above. */
function toad(g: G, x: number, y: number, magma = false, ring = false): void {
  if (ring) g.lineStyle(1, GOLD, 0.9).strokeCircle(x, y, 7);
  shadow(g, x, y + 3, 10);
  const base = magma ? 0x1c1214 : 0x4a7a3a;
  g.fillStyle(0x0a0a0a, 1).fillEllipse(x, y, 12, 11);
  g.fillStyle(base, 1).fillEllipse(x, y, 10, 9);
  g.fillStyle(magma ? 0xff6a1a : 0x78a858, 1).fillRect(x - 2, y - 1, magma ? 3 : 2, 1);
  g.fillStyle(magma ? 0xffd040 : 0xe8c840, 1).fillRect(x + 2, y - 3, 2, 1).fillRect(x + 2, y + 2, 2, 1);
}

/** The mud ball. */
function mudBall(g: G, x: number, y: number): void {
  shadow(g, x, y + 4, 12);
  g.fillStyle(0x120a04, 1).fillCircle(x, y, 6);
  g.fillStyle(0x6a4a2a, 1).fillCircle(x, y, 5);
  g.fillStyle(0x9a6c40, 1).fillCircle(x - 1.5, y - 1.5, 2.5);
  g.fillStyle(0x6a6260, 1).fillRect(x + 1, y + 1, 2, 1);
}

/** The slot machine's gold frame and its five reels' window. */
function slotFrame(g: G): void {
  grad(g, 0x2a1e10, 0x1a1208, 0, DEMO_H, 6);
  g.fillStyle(0xc89a3a, 1).fillRect(8, 10, 108, 62);
  g.fillStyle(0x7a5a1a, 1).fillRect(10, 12, 104, 58);
  g.fillStyle(0x10141e, 1).fillRect(12, 14, 100, 54);
  for (let i = 0; i < 9; i++) g.fillStyle(0x3a6ac8, 1).fillRect(12 + i * 12, 72, 6, 2);
  g.fillStyle(0xe8d070, 1).fillRect(8, 10, 108, 1);
}
/** A slot symbol, `k` of them (0 the commonest, 5 Froggy, 6 the golden wild). */
function slotSym(g: G, x: number, y: number, k: number): void {
  switch (k) {
    case 0:
      g.fillStyle(0x9a6a3a, 1).fillCircle(x, y, 3.5);
      g.fillStyle(0x6a4422, 1).fillRect(x - 1, y - 1, 2, 2);
      break;
    case 1:
      g.fillStyle(0x8a4ad8, 1).fillRect(x - 2, y - 3, 4, 6);
      g.fillStyle(GOLD, 1).fillRect(x - 1, y - 4, 2, 1);
      break;
    case 2:
      g.fillStyle(0x3a7ae8, 1).fillRoundedRect(x - 4, y - 3, 8, 6, 2);
      g.fillStyle(0xa8d0ff, 1).fillRect(x - 2, y - 1, 4, 1);
      break;
    case 3:
      g.fillStyle(0xe83a4a, 1).fillTriangle(x, y - 4, x + 4, y, x, y + 4).fillTriangle(x, y - 4, x - 4, y, x, y + 4);
      g.fillStyle(0xffc0c8, 1).fillRect(x - 1, y - 1, 2, 2);
      break;
    case 4:
      g.fillStyle(0x5ae88a, 1).fillTriangle(x - 2, y + 4, x + 2, y + 4, x + 1, y - 4);
      g.fillStyle(GOLD, 1).fillRect(x - 1, y - 2, 2, 2);
      break;
    case 5:
      g.fillStyle(0x1e5a2a, 1).fillEllipse(x, y, 9, 7);
      g.fillStyle(0x6ae08a, 1).fillEllipse(x, y, 8, 6);
      g.fillStyle(0xffffff, 1).fillRect(x - 3, y - 3, 2, 2).fillRect(x + 1, y - 3, 2, 2);
      break;
    default:
      g.fillStyle(0x7a5a10, 1).fillEllipse(x, y, 10, 8);
      g.fillStyle(GOLD, 1).fillEllipse(x, y, 9, 7);
      g.fillStyle(0x3a2a00, 1).fillRect(x - 3, y - 2, 2, 2).fillRect(x + 1, y - 2, 2, 2);
  }
}

/** The card table: green felt, its rail, the light on it. */
function felt(g: G): void {
  g.fillStyle(0x4a2a1a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
  g.fillStyle(0x1e5a3a, 1).fillEllipse(DEMO_W / 2, DEMO_H / 2 + 6, DEMO_W + 30, DEMO_H + 10);
  g.fillStyle(0x2a7a4a, 0.6).fillEllipse(DEMO_W / 2, DEMO_H / 2, DEMO_W * 0.8, DEMO_H * 0.7);
  speckle(g, 111, 80, 0x16482e, 1);
  g.lineStyle(1, 0x8ad8a8, 0.25).strokeEllipse(DEMO_W / 2, DEMO_H / 2 + 6, DEMO_W * 0.7, 30);
}

/** A betting chip. */
function chip(g: G, x: number, y: number, col = RED): void {
  g.fillStyle(shade(col, 0.5), 1).fillEllipse(x, y + 1, 10, 5);
  g.fillStyle(col, 1).fillEllipse(x, y, 10, 5);
  g.fillStyle(0xffffff, 0.8).fillRect(x - 1, y - 1, 2, 1);
}

/** The chamber's room, dim, the revolver's cylinder in the middle. */
function chamberRoom(g: G): void {
  grad(g, 0x2a1e20, 0x1a1214, 0, DEMO_H, 6);
  planks(g, 0, 70, DEMO_W, 20, 0x5a3a2a, 8, true);
  g.fillStyle(0xffe0b0, 0.06).fillTriangle(62, 0, 30, DEMO_H, 94, DEMO_H);
}

/** The cylinder at (x, y) turned `a`, `live` its loaded chamber (-1 none shown). */
function cylinder(g: G, x: number, y: number, a: number, live = -1, flash = 0): void {
  g.fillStyle(0x1a1014, 1).fillCircle(x, y, 21);
  g.fillStyle(0x5a4a4e, 1).fillCircle(x, y, 19);
  g.fillStyle(0x7a6a6e, 0.6).fillCircle(x - 4, y - 4, 12);
  for (let i = 0; i < 5; i++) {
    const an = a + (i / 5) * Math.PI * 2;
    const cx = x + Math.cos(an) * 11;
    const cy = y + Math.sin(an) * 11;
    g.fillStyle(0x0a0608, 1).fillCircle(cx, cy, 4);
    if (i === live) {
      g.fillStyle(0xc89a3a, 1).fillCircle(cx, cy, 3);
      g.fillStyle(0xe03a2a, 1).fillCircle(cx, cy, 1.5);
    }
  }
  g.fillStyle(0x2a1e22, 1).fillCircle(x, y, 3);
  if (flash > 0) {
    g.fillStyle(0xff3a1a, flash * 0.5).fillRect(0, 0, DEMO_W, DEMO_H);
    burst(g, x, y - 26, 12, GOLD, 10, flash);
  }
}

/** The prize wheel at (x, y), turned `a`, with its slices. */
function prizeWheel(g: G, x: number, y: number, r: number, a: number, hi = -1): void {
  const cols = [0x3a7a3a, 0xe8c040, 0x2a5a2a, 0xc83a3a, 0x3a7a3a, 0xe8c040, 0x1a2a1a, 0x2a5a2a];
  const widths = [0.2, 0.08, 0.17, 0.04, 0.18, 0.1, 0.13, 0.1];
  let at = a;
  g.fillStyle(0x6a4a1a, 1).fillCircle(x, y, r + 3);
  widths.forEach((w, i) => {
    const sw = w * Math.PI * 2;
    g.fillStyle(i === hi ? 0xffffff : cols[i], 1);
    g.slice(x, y, r, at, at + sw, false);
    g.fillPath();
    at += sw;
  });
  g.lineStyle(1, GOLD, 1).strokeCircle(x, y, r);
  g.fillStyle(0x1e5a2a, 1).fillCircle(x, y, 5);
  g.fillStyle(0xffffff, 1).fillRect(x - 3, y - 2, 2, 2).fillRect(x + 1, y - 2, 2, 2);
  // the pointer, at the top
  g.fillStyle(GOLD, 1).fillTriangle(x - 3, y - r - 5, x + 3, y - r - 5, x, y - r + 2);
}

/** The race track: sky, the stand, lanes of turf, the finish line. */
function track(g: G, t: number): void {
  grad(g, 0x5aa0d8, 0xa8d0f0, 0, 16, 4);
  g.fillStyle(0xfff0a0, 1).fillCircle(104, 7, 4);
  for (let i = 0; i < 30; i++) g.fillStyle([PINK, GOLD, BLUE, 0xffffff][i % 4], 1).fillRect(i * 4 + 1, 15 + Math.round(Math.sin(t * 6 + i)), 2, 2);
  for (let l = 0; l < 4; l++) {
    g.fillStyle(l % 2 ? 0x3a8a3a : 0x449a44, 1).fillRect(0, 18 + l * 17, DEMO_W, 17);
    g.fillStyle(0xffffff, 0.25).fillRect(0, 18 + l * 17, DEMO_W, 1);
  }
  for (let y = 18; y < 86; y += 4) {
    g.fillStyle(0xffffff, 1).fillRect(108, y, 2, 2).fillRect(110, y + 2, 2, 2);
    g.fillStyle(INK, 1).fillRect(110, y, 2, 2).fillRect(108, y + 2, 2, 2);
  }
  g.fillStyle(0x0a1410, 1).fillRect(0, 86, DEMO_W, 4);
}
const RACERS = [0x5ac85a, 0xff8ab0, 0x5aa0e8, 0xe8c03a];

/** A treasure chest, shut or opening by `k`. */
function chest(g: G, x: number, y: number, k = 0, sel = false): void {
  if (sel) g.lineStyle(1, GOLD, 1).strokeRect(x - 10.5, y - 9.5, 21, 19);
  if (k > 0) glow(g, x, y - 4, 10 * k, GOLD, 0.7 * k);
  g.fillStyle(0x3a2412, 1).fillRect(x - 9, y - 2, 18, 10);
  g.fillStyle(0x8a5a2a, 1).fillRect(x - 8, y - 1, 16, 8);
  g.fillStyle(0x6a6a7a, 1).fillRect(x - 9, y + 2, 18, 1).fillRect(x - 6, y - 2, 1, 10).fillRect(x + 5, y - 2, 1, 10);
  // the lid, swinging up
  const lift = k * 6;
  g.fillStyle(0x3a2412, 1).fillRect(x - 9, y - 8 - lift, 18, 6);
  g.fillStyle(0xa06a32, 1).fillRect(x - 8, y - 7 - lift, 16, 4);
  g.fillStyle(GOLD, 1).fillRect(x - 1, y - 3, 3, 4);
}

/** The Croaked maze: green brick walls on black water. */
function maze(g: G, walls: Array<[number, number, number, number]>): void {
  g.fillStyle(0x0a1a1e, 1).fillRect(0, 0, DEMO_W, DEMO_H);
  speckle(g, 131, 40, 0x14303a, 1);
  for (const [x, y, w, h] of walls) {
    g.fillStyle(0x1a3a22, 1).fillRect(x, y, w, h);
    bricks(g, x + 1, y + 1, w - 2, h - 2, 0x3a6a3a, 0x1e3a22, 6, 3);
    g.fillStyle(0x7ab86a, 0.6).fillRect(x, y, w, 1);
  }
}

/** The tadpole, swimming the way it goes. */
function tadpole(g: G, x: number, y: number, t: number, dir = 1, stuck = false): void {
  const w = Math.sin(t * 18) * 1.5;
  g.lineStyle(1, 0x3a5ad8, 1).lineBetween(x - dir * 2, y, x - dir * 6, y + w);
  g.fillStyle(0x1a2a6a, 1).fillCircle(x, y, 3);
  g.fillStyle(stuck ? 0xa8b8ff : 0x5a8af0, 1).fillCircle(x, y, 2.4);
  g.fillStyle(0xffffff, 1).fillRect(x + dir, y - 1, 1, 1);
}

/** The Big Frog, from above, mouth working. */
function bigFrog(g: G, x: number, y: number, t: number, dir = 1): void {
  const open = 0.5 + 0.5 * Math.abs(Math.sin(t * 8));
  g.fillStyle(0x000000, 0.3).fillEllipse(x, y + 5, 11, 3);
  // back legs, body with a lit shoulder and spots, head, mouth, two raised eyes
  for (const s of [-1, 1]) g.fillStyle(0x1e5a2a, 1).fillCircle(x - dir * 4, y + s * 4, 2.2).fillStyle(0x3aa048, 1).fillCircle(x - dir * 4.4, y + s * 4, 1.5);
  g.fillStyle(0x0e3a1e, 1).fillEllipse(x, y, 11, 8.4);
  g.fillStyle(0x3aa048, 1).fillEllipse(x, y, 9.8, 7.2);
  g.fillStyle(0x6ad86a, 1).fillCircle(x - dir * 0.5 - 1, y - 1.5, 2);
  g.fillStyle(0x1e6a2c, 1).fillCircle(x - dir * 2.5, y - 1.5, 0.9).fillCircle(x - dir * 3, y + 1.8, 0.8);
  g.fillStyle(0x0e3a1e, 1).fillCircle(x + dir * 3.6, y, 3.4);
  g.fillStyle(0x3aa048, 1).fillCircle(x + dir * 3.6, y, 2.9);
  if (open > 0.5) g.fillStyle(0x5a0a18, 1).fillTriangle(x + dir * 5, y - 2.2, x + dir * 5, y + 2.2, x + dir * (5.4 + open), y);
  for (const s of [-1, 1]) {
    g.fillStyle(0x1e5a2a, 1).fillCircle(x + dir * 2.8, y + s * 2.4, 1.9);
    g.fillStyle(0xe8c850, 1).fillCircle(x + dir * 2.8, y + s * 2.4, 1.4);
    g.fillStyle(INK, 1).fillCircle(x + dir * 3.1, y + s * 2.4, 0.7);
  }
}

/** The crane machine's glass box: the pile of prizes, the chute, the claw on its rail. */
function craneBox(g: G, oddity: boolean): void {
  grad(g, oddity ? 0x140c1e : 0x1e1430, oddity ? 0x0a0612 : 0x2a1a3a, 0, DEMO_H, 6);
  g.fillStyle(oddity ? 0x3a2a4a : 0x8a3a6a, 1).fillRect(6, 0, 112, 2);
  g.fillStyle(0x9a9aa8, 1).fillRect(10, 13, 104, 1);
  // the chute, bottom left
  g.fillStyle(0x0a0810, 1).fillRect(8, 60, 22, 26);
  g.lineStyle(1, 0xc8c8d8, 0.6).strokeRect(8.5, 60.5, 21, 25);
  // the pile
  for (let i = 0; i < 12; i++) {
    const x = 38 + (i % 6) * 13 + (Math.floor(i / 6) % 2) * 6;
    const y = 80 - Math.floor(i / 6) * 8;
    prize(g, x, y, oddity, i);
  }
  g.fillStyle(0xffffff, 0.06).fillRect(6, 8, 30, 80);
}

/** A prize in the crane: a plush (bear, frog, bunny) or a capsule. */
function prize(g: G, x: number, y: number, oddity: boolean, i: number): void {
  if (oddity) {
    const col = [0xc83a5a, 0x3a8ad8, 0xe8c03a, 0x8a4ad8][i % 4];
    g.fillStyle(0x0a0a10, 1).fillCircle(x, y, 5.5);
    g.fillStyle(col, 1);
    g.slice(x, y, 4.6, Math.PI, 0, false);
    g.fillPath();
    g.fillStyle(0xe8e8f0, 1);
    g.slice(x, y, 4.6, 0, Math.PI, false);
    g.fillPath();
    g.fillStyle(0xffffff, 0.8).fillRect(x - 2, y - 3, 1, 1);
    return;
  }
  const col = [0xc8905a, 0x5ac85a, 0xf0c8d8, 0x8ab0e8][i % 4];
  g.fillStyle(shade(col, 0.5), 1).fillCircle(x, y, 5.5);
  g.fillStyle(col, 1).fillCircle(x, y, 4.6);
  g.fillStyle(col, 1).fillCircle(x - 3.5, y - 4, 2).fillCircle(x + 3.5, y - 4, 2);
  g.fillStyle(INK, 1).fillRect(x - 2, y - 1, 1, 1).fillRect(x + 1, y - 1, 1, 1);
}

/** The claw on its cable, at (x, y), open by `k` (1 wide, 0 shut). */
function claw(g: G, x: number, y: number, k: number): void {
  g.lineStyle(1, 0xc8c8d8, 1).lineBetween(x, 13, x, y - 4);
  g.fillStyle(0x8a8a9a, 1).fillRect(x - 4, y - 5, 8, 3);
  const o = 2 + k * 4;
  g.lineStyle(2, 0xd8d8e8, 1).lineBetween(x - 3, y - 2, x - o, y + 4).lineBetween(x + 3, y - 2, x + o, y + 4);
  g.lineStyle(2, 0xd8d8e8, 1).lineBetween(x - o, y + 4, x - o + 2, y + 7).lineBetween(x + o, y + 4, x + o - 2, y + 7);
}

/** The Creature Clash arena: stone floor in squares, its edge, a rock or two. */
function arena(g: G, t: number, rocks = true): void {
  g.fillStyle(0x2a2620, 1).fillRect(0, 0, DEMO_W, DEMO_H);
  for (let y = 0; y < DEMO_H; y += 10)
    for (let x = (y / 10) % 2 ? -5 : 0; x < DEMO_W; x += 10) g.fillStyle(shade(0x4a443a, rnd(x * 3 + y) * 0.2), 1).fillRect(x + 1, y + 1, 9, 9);
  g.lineStyle(1, 0x1a1812, 1).strokeRect(2.5, 2.5, DEMO_W - 5, DEMO_H - 5);
  if (rocks) {
    for (const [x, y] of [[62, 24], [62, 62]] as const) {
      shadow(g, x, y + 5, 14);
      g.fillStyle(0x3a3630, 1).fillEllipse(x, y, 14, 12);
      g.fillStyle(0x7a7468, 1).fillEllipse(x - 1, y - 1, 11, 9);
      g.fillStyle(0xa8a294, 1).fillRect(x - 3, y - 4, 3, 1);
    }
  }
  void t;
}

/** A clash creature: a round body in its element's colour, eyes, a little bob. */
function critter(g: G, x: number, y: number, t: number, col: number, face = 1, hurt = false): void {
  const b = Math.sin(t * 6) * 0.8;
  shadow(g, x, y + 6, 12);
  g.fillStyle(shade(col, 0.6), 1).fillEllipse(x, y + b, 14, 12);
  g.fillStyle(hurt ? 0xffffff : col, 1).fillEllipse(x, y - 0.5 + b, 12, 10);
  g.fillStyle(shade(col, -0.35), 0.7).fillEllipse(x - 2, y - 2 + b, 5, 3);
  g.fillStyle(shade(col, 0.6), 1).fillTriangle(x - 5, y - 4 + b, x - 3, y - 9 + b, x - 1, y - 4 + b).fillTriangle(x + 5, y - 4 + b, x + 3, y - 9 + b, x + 1, y - 4 + b);
  g.fillStyle(0xffffff, 1).fillCircle(x + face * 2, y - 2 + b, 1.6).fillCircle(x + face * 5, y - 2 + b, 1.4);
  g.fillStyle(INK, 1).fillRect(x + face * 2 + face * 0.5, y - 2 + b, 1, 1).fillRect(x + face * 5, y - 2 + b, 1, 1);
}

/** A health bar over a creature. */
function hp(g: G, x: number, y: number, k: number, col = GREEN): void {
  g.fillStyle(0x0a0a10, 1).fillRect(x - 8, y, 16, 3);
  g.fillStyle(col, 1).fillRect(x - 7, y + 1, Math.round(14 * clamp01(k)), 1);
}

/** A move button with its cooldown ring, `k` recharged (1 ready). */
function moveBtn(g: G, x: number, y: number, k: number, col: number, lit = false): void {
  g.fillStyle(0x0a0a14, 1).fillCircle(x, y, 8);
  g.fillStyle(k >= 1 ? shade(col, 0.4) : 0x2a2a38, 1).fillCircle(x, y, 7);
  if (k < 1) {
    g.lineStyle(2, col, 1);
    g.beginPath();
    g.arc(x, y, 7, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2, false);
    g.strokePath();
  } else g.lineStyle(1, lit ? 0xffffff : col, 1).strokeCircle(x, y, 7);
  g.fillStyle(col, k >= 1 ? 1 : 0.4).fillCircle(x, y, 2.5);
}

// ---------------------------------------------------------------- the pictures

export const DEMOS: Record<string, Demo> = {
  // ---------- MINI DUELS (tic-tac-toe, rock paper scissors)
  'ttt.pick': (g, t, lbl) => {
    grad(g, 0x3a2a1e, 0x1e140c);
    const left = ph(t, 3.2) < 0.5;
    for (const [x, on] of [[8, left], [66, !left]] as const) {
      panel(g, x, 14, 50, 46, on ? GOLD : 0x6a5a3a, 0x2a1e14);
      if (on) g.fillStyle(GOLD, 0.08).fillRect(x, 14, 50, 46);
    }
    // the little board, and the two hands
    g.fillStyle(0xf0e4c4, 1).fillRect(19, 22, 28, 28);
    g.lineStyle(1, 0x9a7a4a, 1).lineBetween(28, 23, 28, 49).lineBetween(37, 23, 37, 49).lineBetween(20, 31, 46, 31).lineBetween(20, 40, 46, 40);
    g.lineStyle(2, 0xff6a3a, 1).lineBetween(21, 24, 26, 29).lineBetween(26, 24, 21, 29);
    g.lineStyle(2, 0x2a9a9a, 1).strokeCircle(32.5, 35.5, 2.5);
    g.fillStyle(0xe8b890, 1).fillRoundedRect(72, 30, 14, 11, 3);
    g.fillStyle(0xc89070, 1).fillRect(72, 33, 14, 1).fillRect(72, 36, 14, 1);
    g.fillStyle(0x5ac85a, 1).fillRect(94, 32, 12, 8).fillRect(100, 26, 3, 7).fillRect(104, 27, 3, 6);
    lbl(33, 68, 'TIC-TAC-TOE', left ? GOLD : CREAM);
    lbl(91, 68, 'ROCK PAPER', !left ? GOLD : CREAM);
    lbl(91, 76, 'SCISSORS', !left ? GOLD : CREAM);
    cursor(g, left ? 40 : 98, 50, ph(t, 1.6) > 0.7);
  },
  'ttt.board': (g, t, lbl) => {
    grad(g, 0x3a2a1e, 0x1e140c);
    g.fillStyle(0x000000, 0.4).fillRect(34, 10, 58, 58);
    g.fillStyle(0xf0e4c4, 1).fillRect(32, 8, 58, 58);
    speckle(g, 7, 40, 0xd8c8a0, 1, 32, 8, 58, 58);
    g.lineStyle(2, 0x9a7a4a, 1).lineBetween(51, 11, 51, 63).lineBetween(70, 11, 70, 63).lineBetween(35, 27, 87, 27).lineBetween(35, 46, 87, 46);
    // X (you, orange) and O (Froggy, teal) in turn; three Xs down the middle
    const k = ph(t, 5);
    const moves: Array<[number, number, boolean]> = [[1, 1, true], [0, 0, false], [1, 0, true], [2, 2, false], [1, 2, true]];
    const shown = Math.floor(k * 7);
    moves.slice(0, shown).forEach(([c, r, x]) => {
      const cx = 41.5 + c * 19;
      const cy = 17.5 + r * 19;
      if (x) g.lineStyle(3, 0xff6a3a, 1).lineBetween(cx - 5, cy - 5, cx + 5, cy + 5).lineBetween(cx + 5, cy - 5, cx - 5, cy + 5);
      else g.lineStyle(2, 0x2a9a9a, 1).strokeCircle(cx, cy, 5.5);
    });
    if (shown >= 5) {
      g.lineStyle(2, GOLD, 1).lineBetween(60.5, 10, 60.5, 64);
      lbl(DEMO_W / 2, 80, 'THREE IN A ROW!', GOLD);
    } else lbl(DEMO_W / 2, 80, 'CLICK A SQUARE', CREAM);
    const next = moves[Math.min(shown, 4)];
    if (shown < 5 && next[2]) cursor(g, 44 + next[0] * 19, 20 + next[1] * 19, ph(t * 7 / 5, 1) > 0.6);
  },
  'ttt.rps': (g, t, lbl) => {
    grad(g, 0x3a2a1e, 0x1e140c);
    const k = ph(t, 3);
    const round = Math.floor(t / 3) % 3;
    // [you, him, word]: each beats one other
    const pairs: Array<[number, number, string]> = [[0, 2, 'ROCK BEATS SCISSORS'], [2, 1, 'SCISSORS BEAT PAPER'], [1, 0, 'PAPER BEATS ROCK']];
    const [me, him, word] = pairs[round];
    const shake = k < 0.5 ? Math.abs(Math.sin(k * Math.PI * 6)) * 6 : 0;
    const hand = (x: number, y: number, kind: number, col: number, flip: number): void => {
      const show = k < 0.5 ? 0 : kind;
      g.fillStyle(shade(col, 0.4), 1).fillRoundedRect(x - 8, y - 6, 16, 13, 3);
      g.fillStyle(col, 1).fillRoundedRect(x - 7, y - 5, 14, 11, 3);
      if (show === 1) g.fillStyle(col, 1).fillRect(x + flip * 6, y - 6, flip * 6, 12);
      if (show === 2) g.fillStyle(col, 1).fillRect(x + flip * 6, y - 5, flip * 8, 3).fillRect(x + flip * 6, y + 1, flip * 8, 3);
    };
    hand(32, 38 - shake, me, 0xe8b890, 1);
    hand(92, 38 - shake, him, 0x5ac85a, -1);
    lbl(32, 56, 'YOU', CREAM);
    lbl(92, 56, 'FROGGY', CREAM);
    if (k >= 0.5) {
      lbl(DEMO_W / 2, 74, word, GOLD);
      verdict(g, 32, 66, true);
    } else lbl(DEMO_W / 2, 74, 'ROCK... PAPER... SCISSORS...', CREAM);
  },
  'ttt.pay': (g, t, lbl) => {
    grad(g, 0x3a2a1e, 0x1e140c);
    const win = ph(t, 5) < 0.5;
    const k = ph(t, 2.5);
    froggy(g, DEMO_W / 2, 26, 0.9, { mouth: !win });
    if (win) {
      for (let i = 0; i < 3; i++) {
        const q = seg(k, i * 0.15, 0.6 + i * 0.1);
        coin(g, lerp(DEMO_W / 2, 30 + i * 14, ease(q)), lerp(40, 66, ease(q)) - Math.sin(q * Math.PI) * 10, t + i);
      }
      lbl(DEMO_W / 2, 82, 'BEAT HIM: THE ROUND PAYS', GOLD);
    } else {
      coin(g, lerp(DEMO_W / 2, DEMO_W / 2, k), lerp(40, 66, ease(k)), t);
      lbl(DEMO_W / 2, 82, 'A DRAW: YOUR TOKEN BACK', CREAM);
    }
  },

  // ---------- CHUBBY CHOMP (hoops)
  'hoops.flick': (g, t, lbl) => {
    chompPond(g, t);
    chubby(g, 96, 46, false);
    // hold: crouch and the bar fills; let go: the fly arcs into his mouth
    const k = ph(t, 2.8);
    const hold = seg(k, 0, 0.45);
    const flight = seg(k, 0.5, 0.85);
    g.fillStyle(0x5a3a1a, 1).fillEllipse(24, 78, 40, 10);
    g.fillStyle(0x7a5a2a, 1).fillEllipse(24, 76, 36, 7);
    frog(g, 24, 70, 1, GREEN, { squash: k < 0.47 ? hold : flight > 0 && flight < 0.2 ? -0.6 : 0, face: 1 });
    panel(g, 4, 30, 8, 34, 0x8a84a8, 0x0c0a14);
    g.fillStyle(GOLD, 1).fillRect(6, 62 - Math.round(30 * (k < 0.5 ? hold : 0)), 4, Math.round(30 * (k < 0.5 ? hold : 0)));
    if (flight > 0 && flight < 1) {
      const fx = lerp(28, 94, flight);
      const fy = lerp(62, 40, flight) - Math.sin(flight * Math.PI) * 28;
      fly(g, fx, fy, t);
    }
    if (k > 0.8) chubby(g, 96, 46, true);
    lbl(DEMO_W / 2 - 4, 6, k < 0.48 ? 'HOLD: CROUCH' : 'LET GO: FLICK!', k < 0.48 ? CREAM : GOLD);
  },
  'hoops.tilt': (g, t, lbl) => {
    chompPond(g, t);
    chubby(g, 96, 46, false);
    g.fillStyle(0x5a3a1a, 1).fillEllipse(24, 78, 40, 10);
    frog(g, 24, 70, 1, GREEN, { face: 1 });
    // W / S tilts the arc; it turns green when it will land in his mouth
    const tilt = Math.sin(t * 1.2);
    const good = Math.abs(tilt - 0.25) < 0.22;
    dots(g, 28, 64, 74, -80 - tilt * 50, 120, good ? 0x7aff7a : 0xffffff, 12);
    key(g, lbl, 56, 80, 'W', tilt > 0.3);
    key(g, lbl, 70, 80, 'S', tilt < -0.3);
    lbl(DEMO_W / 2, 6, good ? 'GREEN: IT WILL LAND' : 'TILT THE SHOT', good ? 0x7aff7a : CREAM);
  },
  'hoops.lead': (g, t, lbl) => {
    chompPond(g, t);
    // Chubby drifts on his pad: aim where he will be
    const cx = 86 + Math.sin(t * 0.9) * 14;
    chubby(g, cx, 46, false);
    const ahead = 86 + Math.sin((t + 0.9) * 0.9) * 14;
    arrow(g, cx, 66, cx + Math.cos(t * 0.9) * 14, 66, GOLD);
    g.lineStyle(1, 0x7aff7a, 0.6).strokeCircle(ahead, 42, 5);
    g.fillStyle(0x5a3a1a, 1).fillEllipse(24, 78, 40, 10);
    frog(g, 24, 70, 1, GREEN, { face: 1 });
    dots(g, 28, 64, (ahead - 30) / 0.9, -95, 120, 0xffffff, 10);
    lbl(DEMO_W / 2, 6, 'HE DRIFTS: AIM AHEAD', CREAM);
    lbl(DEMO_W / 2, 84, 'FIVE FLIES IN 75 SECONDS', GOLD);
  },
  'hoops.streak': (g, t, lbl) => {
    chompPond(g, t);
    chubby(g, 96, 46, ph(t, 1.2) > 0.6);
    const n = Math.floor(ph(t, 4.8) * 4);
    for (let i = 0; i < 2; i++) {
      fly(g, 18 + i * 14, 40, t + i);
      if (i < n) verdict(g, 18 + i * 14, 52, true);
    }
    if (n >= 2) {
      fly(g, 54, 40, t, true);
      lbl(54, 54, '2!', GOLD);
    }
    lbl(DEMO_W / 2, 6, 'TWO IN A ROW...', CREAM);
    lbl(DEMO_W / 2, 84, 'LIGHTS THE FLY: IT PAYS 2', GOLD);
  },

  // ---------- WHACK-A-FROG
  'whack.hit': (g, t, lbl) => {
    grass(g, 0, 0, DEMO_W, DEMO_H, 0x3e7a3a, 3);
    const holes = [[32, 36], [62, 36], [92, 36], [32, 62], [62, 62], [92, 62]];
    for (const [x, y] of holes) whackHole(g, x, y);
    const k = ph(t, 1.6);
    const hit = k > 0.55;
    whackFrog(g, 62, 36, hit ? 1 - seg(k, 0.6, 0.9) : seg(k, 0, 0.3), hit);
    // the mallet comes down on it
    const swing = seg(k, 0.4, 0.55);
    const mx = 70;
    const my = lerp(10, 26, swing);
    g.fillStyle(0x6a4a2a, 1).fillRect(mx + 3, my - 12, 2, 12);
    g.fillStyle(0x7a1a1a, 1).fillRect(mx - 4, my - 2, 16, 8);
    g.fillStyle(0xe04a4a, 1).fillRect(mx - 3, my - 1, 14, 6);
    if (hit && k < 0.75) burst(g, 62, 26, 10, GOLD);
    lbl(DEMO_W / 2, 82, 'CLICK A FROG TO WHACK IT', CREAM);
  },
  'whack.quick': (g, t, lbl) => {
    grass(g, 0, 0, DEMO_W, DEMO_H, 0x3e7a3a, 3);
    const holes = [[20, 40], [48, 40], [76, 40], [104, 40]];
    for (const [x, y] of holes) whackHole(g, x, y);
    // they pop up and duck back -- and the gaps get shorter
    const speed = 1 + ph(t, 6) * 1.6;
    holes.forEach(([x, y], i) => {
      const k = ph(t * speed + i * 0.37, 1.4);
      whackFrog(g, x, y, k < 0.5 ? Math.sin(k * 2 * Math.PI) : 0);
    });
    bar(g, 22, 62, 80, 1 - ph(t, 6), GOLD);
    lbl(DEMO_W / 2, 8, 'THEY DUCK BACK DOWN', CREAM);
    lbl(DEMO_W / 2, 78, 'AND GET QUICKER', GOLD);
  },
  'whack.pay': (g, t, lbl) => {
    grad(g, 0x1a2a1a, 0x0e180e);
    const n = Math.floor(ph(t, 5) * 64);
    panel(g, 14, 10, 96, 24, 0x6a8a6a, 0x0c140c);
    lbl(DEMO_W / 2, 22, `${n} WHACKS`, CREAM);
    bar(g, 14, 44, 96, n / 64, n >= 55 ? GOLD : n >= 45 ? 0xb8e070 : GREY, 6);
    for (const [v, col] of [[45, 0xb8e070], [55, GOLD]] as const) {
      const x = 14 + (96 * v) / 64;
      g.fillStyle(col, 1).fillRect(x, 40, 1, 14);
    }
    lbl(14 + (96 * 45) / 64, 60, '45: 10', n >= 45 ? 0xb8e070 : GREY);
    lbl(14 + (96 * 55) / 64 + 8, 70, '55: 15', n >= 55 ? GOLD : GREY);
    lbl(DEMO_W / 2, 84, n < 45 ? 'UNDER 45: NOTHING' : n < 55 ? 'PAYS 10' : 'PAYS 15!', n < 45 ? RED : GOLD);
  },

  // ---------- BOWLING
  'bowl.aim': (g, t, lbl) => {
    lane(g);
    // A / D walks the ball along the line; LEFT / RIGHT swings the aim
    const walk = Math.sin(t * 1.4) * 12;
    const aim = Math.sin(t * 2.1) * 0.25;
    const bx = 62 + walk;
    g.lineStyle(1, 0xfff4c0, 0.8).lineBetween(bx, 74, bx + Math.sin(aim) * 60, 74 - Math.cos(aim) * 60);
    ball(g, bx, 78);
    key(g, lbl, 12, 70, 'A', walk < -6);
    key(g, lbl, 26, 70, 'D', walk > 6);
    lbl(19, 82, 'WALK', CREAM);
    key(g, lbl, 98, 70, '<', aim < -0.1);
    key(g, lbl, 112, 70, '>', aim > 0.1);
    lbl(105, 82, 'AIM', GOLD);
  },
  'bowl.hook': (g, t, lbl) => {
    lane(g);
    // Q / E bends it: the line shows the path, and the ball follows it
    const right = ph(t, 5) < 0.5;
    const k = ph(t, 2.5);
    const path = (q: number): [number, number] => [62 + (right ? 1 : -1) * (Math.sin(q * Math.PI) * 10 - q * q * 4), 78 - q * 62];
    for (let i = 0; i <= 20; i++) {
      const [x, y] = path(i / 20);
      g.fillStyle(0xfff4c0, 0.8).fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    const [bx, by] = path(seg(k, 0.1, 0.9));
    ball(g, bx, by);
    key(g, lbl, 16, 76, 'Q', !right);
    key(g, lbl, 108, 76, 'E', right);
    lbl(DEMO_W / 2, 86, right ? 'HOOK RIGHT' : 'HOOK LEFT', CREAM);
  },
  'bowl.throw': (g, t, lbl) => {
    const k = ph(t, 3.2);
    const hold = seg(k, 0, 0.35);
    const roll = seg(k, 0.4, 0.85);
    lane(g, roll >= 1 ? 7 : 0);
    // the dark oil, half way up: it shoves the ball off its line
    g.fillStyle(0x3a2a14, 0.55).fillRect(48, 30, 20, 16);
    lbl(30, 38, 'OIL', ORANGE);
    const shove = seg(roll, 0.45, 0.65) * 7;
    const bx = 62 + shove;
    const by = lerp(78, 14, roll);
    if (roll < 1) ball(g, bx, by);
    else burst(g, 66, 16, 10, CREAM);
    panel(g, 100, 24, 8, 44, 0x8a84a8, 0x0c0a14);
    g.fillStyle(GOLD, 1).fillRect(102, 66 - Math.round(40 * hold), 4, Math.round(40 * hold));
    key(g, lbl, 104, 78, 'SPC', k < 0.36, 17);
    lbl(18, 82, k < 0.38 ? 'HOLD...' : 'LET GO', k < 0.38 ? CREAM : GOLD);
  },
  'bowl.score': (g, t, lbl) => {
    grad(g, 0x1a1410, 0x0e0a08);
    panel(g, 10, 8, 104, 46, 0x9a7a4a, 0x1a1208);
    lbl(32, 18, 'YOU', CREAM);
    lbl(32, 32, 'FROGGY', PINK);
    const k = ph(t, 4);
    const strike = k < 0.5;
    g.lineStyle(2, GOLD, 1);
    if (strike) g.lineBetween(70, 14, 78, 22).lineBetween(78, 14, 70, 22);
    else g.lineBetween(70, 22, 78, 14);
    lbl(98, 18, strike ? '+5' : '+3', GOLD);
    lbl(98, 32, '...', GREY);
    pins(g, 62, 58, strike ? 10 : 7 + Math.floor(seg(k, 0.6, 0.9) * 3));
    lbl(DEMO_W / 2, 84, strike ? 'A STRIKE ADDS 5' : 'A SPARE ADDS 3', GOLD);
  },

  // ---------- FROG POND HUNT (battleship)
  'pond.hide': (g, t, lbl) => {
    water(g, t);
    huntPond(g, t, 18, 18, 6, 4, 15, 13);
    // pick a frog, then a pad: it goes there
    const k = ph(t, 3);
    const sx = 14;
    const sy = 80;
    const tx = 18 + 2 * 15 + 7.5;
    const ty = 18 + 13;
    panel(g, 4, 74, 30, 13, GOLD, 0x1a3a2a);
    lbl(19, 80, 'BULL', CREAM);
    const q = seg(k, 0.2, 0.6);
    const fx = lerp(sx + 6, tx, ease(q));
    const fy = lerp(sy, ty, ease(q));
    if (k > 0.6) frog(g, tx, ty - 2, 0.6, 0x4a9a4a);
    else if (q > 0) frog(g, fx, fy - 2, 0.6, 0x4a9a4a);
    cursor(g, k < 0.2 ? sx + 8 : fx + 2, k < 0.2 ? sy : fy, k < 0.25 || (k > 0.55 && k < 0.65));
    lbl(84, 82, 'YOUR POND', GREEN);
  },
  'pond.hunt': (g, t, lbl) => {
    water(g, t);
    huntPond(g, t, 18, 18, 6, 4, 15, 13);
    // one pad a turn on his pond: a miss splashes, a frog is found
    const k = ph(t, 4);
    const miss = k < 0.5;
    const px = miss ? 18 + 1 * 15 : 18 + 4 * 15 + 7.5;
    const py = miss ? 18 : 18 + 26 + 13;
    const q = seg(k % 0.5, 0.15, 0.4) * 2;
    cursor(g, px + 2, py, q > 0.1 && q < 0.4);
    if (q > 0.3) {
      if (miss) {
        g.lineStyle(1, 0xd8f4ff, 1 - q).strokeEllipse(px, py, 8 + q * 14, 5 + q * 9);
        lbl(DEMO_W / 2, 84, 'A MISS', CREAM);
      } else {
        frog(g, px, py - 3 - q * 2, 0.6, 0x8a5ad8);
        burst(g, px, py - 4, 9, GOLD);
        lbl(DEMO_W / 2, 84, 'FOUND ONE!', GOLD);
      }
    } else lbl(DEMO_W / 2, 84, 'PICK A PAD ON HIS POND', CREAM);
  },
  'pond.clues': (g, t, lbl) => {
    water(g, t);
    huntPond(g, t, 18, 18, 6, 4, 15, 13);
    // between turns they move: a ripple, bubbles, a croak show where
    const k = ph(t, 2);
    g.lineStyle(1, 0xd8f4ff, 1 - k).strokeEllipse(18 + 2 * 15, 31, 6 + k * 16, 4 + k * 10);
    for (let i = 0; i < 4; i++) g.fillStyle(0xd8f4ff, 0.9).fillCircle(18 + 4 * 15 + 7.5 + Math.sin(t * 3 + i) * 2, 44 - ((t * 14 + i * 5) % 16), 1);
    lbl(30, 64, 'CROAK!', ph(t, 1.3) < 0.5 ? GOLD : 0x8a7a40);
    lbl(30, 12, 'RIPPLE', CREAM);
    lbl(96, 12, 'BUBBLES', CREAM);
    lbl(DEMO_W / 2, 84, 'THEY MOVE: FOLLOW THE CLUES', GOLD);
  },

  // ---------- GRUDGE
  'grudge.move': (g, t, lbl) => {
    ring(g, t);
    // walk, jump, crouch
    const k = ph(t, 4.5);
    const x = 30 + Math.sin(k * Math.PI * 2) * 14;
    const jump = k > 0.4 && k < 0.6 ? Math.sin(seg(k, 0.4, 0.6) * Math.PI) * 14 : 0;
    const crouch = k > 0.72 && k < 0.92;
    fighter(g, x, 72 - jump, crouch ? 'crouch' : jump ? 'jump' : 'stand');
    hyena(g, 96, 72);
    key(g, lbl, 54, 8, 'A', k < 0.25 && Math.cos(k * Math.PI * 2) < 0);
    key(g, lbl, 68, 8, 'W', jump > 0);
    key(g, lbl, 82, 8, 'S', crouch);
    key(g, lbl, 96, 8, 'D', k < 0.25 && Math.cos(k * Math.PI * 2) > 0);
    lbl(DEMO_W / 2, 20, crouch ? 'CROUCH' : jump ? 'JUMP' : 'WALK', CREAM);
  },
  'grudge.high': (g, t, lbl) => {
    ring(g, t);
    const k = ph(t, 1.6);
    const strike = k > 0.3 && k < 0.6;
    fighter(g, 56, 72, strike ? 'high' : 'stand');
    hyena(g, 74, 72, false, strike ? seg(k, 0.3, 0.5) : 0);
    key(g, lbl, DEMO_W / 2, 8, 'J', strike);
    lbl(DEMO_W / 2, 20, 'HIGH: HITS ONE STANDING', CREAM);
  },
  'grudge.low': (g, t, lbl) => {
    ring(g, t);
    // K sweeps low and hits one crouching; L blocks
    const k = ph(t, 3.2);
    const blockPart = k > 0.55;
    if (!blockPart) {
      const strike = k > 0.15 && k < 0.4;
      fighter(g, 56, 72, strike ? 'low' : 'crouch');
      hyena(g, 74, 72, true, strike ? seg(k, 0.15, 0.35) : 0);
      key(g, lbl, DEMO_W / 2, 8, 'K', strike);
      lbl(DEMO_W / 2, 20, 'LOW: HITS ONE CROUCHING', CREAM);
    } else {
      fighter(g, 50, 72, 'block');
      hyena(g, 70, 72);
      key(g, lbl, DEMO_W / 2, 8, 'L', true);
      lbl(DEMO_W / 2, 20, 'L BLOCKS', 0x8ad8ff);
    }
  },
  'grudge.special': (g, t, lbl) => {
    ring(g, t);
    // the special: it hurts -- then needs time to come back
    const k = ph(t, 4);
    const fire = k > 0.2 && k < 0.4;
    const charge = k < 0.2 ? 1 : k < 0.4 ? 1 - seg(k, 0.2, 0.4) : seg(k, 0.4, 1);
    fighter(g, 44, 72, fire ? 'high' : 'stand');
    if (fire) {
      glow(g, 62, 58, 12, GOLD, 0.9);
      burst(g, 72, 56, 12, GOLD, 10);
    }
    hyena(g, 80, 72, false, fire ? 1 : 0);
    bar(g, 30, 30, 64, charge, charge >= 1 ? GOLD : 0x8a7a40);
    key(g, lbl, DEMO_W / 2, 8, 'I', fire);
    lbl(DEMO_W / 2, 40, charge >= 1 ? 'SPECIAL READY' : 'RECHARGING...', charge >= 1 ? GOLD : CREAM);
  },

  // ---------- BARREL CLIMB (donkeykong)
  'kong.climb': (g, t, lbl) => {
    jungle(g, t);
    girder(g, 8, 78, 108);
    girder(g, 8, 50, 108);
    girder(g, 8, 22, 108);
    ladder(g, 84, 78, 50);
    ladder(g, 34, 50, 22);
    // run to the ladder, climb, run on
    const k = ph(t, 5);
    let x: number;
    let y: number;
    if (k < 0.3) {
      x = lerp(20, 84, seg(k, 0, 0.3));
      y = 73;
    } else if (k < 0.55) {
      x = 84;
      y = lerp(73, 45, seg(k, 0.3, 0.55));
    } else {
      x = lerp(84, 40, seg(k, 0.55, 1));
      y = 45;
    }
    frog(g, x, y, 0.75, GREEN, { face: k < 0.3 ? 1 : -1 });
    lbl(DEMO_W / 2, 8, k > 0.3 && k < 0.55 ? 'W / S CLIMBS' : 'A / D RUNS', CREAM);
  },
  'kong.jump': (g, t, lbl) => {
    jungle(g, t);
    girder(g, 8, 70, 108);
    // a yellow barrel rolls at you: jump it
    const k = ph(t, 2.4);
    const bx = lerp(118, 6, k);
    barrel(g, bx, 66, -t);
    const d = bx - 56;
    const jump = d < 16 && d > -14 ? Math.sin(clamp01((16 - d) / 30) * Math.PI) * 14 : 0;
    frog(g, 56, 65 - jump, 0.8, GREEN, { squash: jump > 0 ? -0.5 : 0, face: 1 });
    key(g, lbl, DEMO_W / 2, 84, 'SPC', jump > 0, 17);
    lbl(DEMO_W / 2, 10, 'YELLOW ROLLS: JUMP IT', GOLD);
  },
  'kong.hop': (g, t, lbl) => {
    jungle(g, t);
    girder(g, 8, 70, 108);
    // an orange barrel hops: walk under it while it is up
    const k = ph(t, 3);
    const bx = lerp(100, 30, k);
    const hop = Math.abs(Math.sin(k * Math.PI * 3)) * 22;
    barrel(g, bx, 66 - hop, t, 0xe8742a);
    const fx = lerp(30, 96, seg(k, 0.25, 0.75));
    frog(g, fx, 65, 0.8, GREEN, { face: 1 });
    lbl(DEMO_W / 2, 10, 'ORANGE HOPS: GO UNDER', ORANGE);
  },
  'kong.lives': (g, t, lbl) => {
    jungle(g, t);
    girder(g, 8, 26, 108);
    // the exit at the top, and three lives
    g.fillStyle(0x6a4a1a, 1).fillRect(94, 8, 14, 18);
    g.fillStyle(0xe8c070, 1).fillRect(96, 10, 10, 16);
    g.fillStyle(0x8a5a2a, 1).fillRect(101, 10, 1, 16).fillRect(96, 17, 10, 1);
    lbl(101, 4, 'OUT', GOLD);
    const lost = Math.floor(ph(t, 6) * 4);
    for (let i = 0; i < 3; i++) frog(g, 32 + i * 22, 56, 0.9, i < 3 - lost ? GREEN : 0x3a3a48, { blink: i >= 3 - lost });
    lbl(DEMO_W / 2, 74, 'A BARREL TAKES A LIFE', CREAM);
    lbl(DEMO_W / 2, 84, 'REACH THE EXIT AT THE TOP', GOLD);
  },

  // ---------- AIR HOCKEY (the rink runs up the screen)
  'hockey.mallet': (g, t, lbl) => {
    rink(g);
    mallet(g, 62, 14, false);
    // your mallet, in your half, follows the mouse
    const mx = 62 + Math.sin(t * 1.6) * 22;
    const my = 70 + Math.sin(t * 2.3) * 10;
    mallet(g, mx, my, true);
    cursor(g, mx + 3, my + 3);
    puck(g, 50, 46);
    lbl(DEMO_W / 2, 52, 'IT FOLLOWS THE MOUSE', CREAM);
  },
  'hockey.goal': (g, t, lbl) => {
    rink(g);
    // strike the puck up into his goal at the top
    const k = ph(t, 2.2);
    const hit = seg(k, 0.15, 0.25);
    const fly2 = seg(k, 0.25, 0.7);
    mallet(g, 70 + Math.sin(t * 2) * 6, 14, false);
    mallet(g, 60, lerp(76, 66, hit), true);
    const px = lerp(60, 58, fly2);
    const py = lerp(60, 2, fly2);
    if (k < 0.72) puck(g, px, py);
    if (k > 0.7) {
      g.fillStyle(PINK, 0.4 + 0.4 * Math.sin(t * 30)).fillRect(46, 0, 32, 6);
      lbl(DEMO_W / 2, 30, 'GOAL!', GOLD);
    }
    lbl(DEMO_W / 2, 46, 'FIRST TO FIVE', GOLD);
  },
  'hockey.reset': (g, t, lbl) => {
    rink(g);
    // after a goal: 3 seconds to get back to your own half
    const k = ph(t, 3);
    const n = 3 - Math.floor(k * 3);
    mallet(g, 62, 14, false);
    puck(g, 62, DEMO_H / 2);
    const my = lerp(36, 72, ease(seg(k, 0, 0.6)));
    mallet(g, 44, my, true);
    if (my < DEMO_H / 2) g.fillStyle(RED, 0.2).fillRect(24, 3, 76, DEMO_H / 2 - 3);
    arrow(g, 32, 40, 32, 66, GOLD);
    lbl(DEMO_W / 2, 30, String(n), GOLD);
    lbl(DEMO_W / 2, 80, 'BACK TO YOUR HALF', CREAM);
  },

  // ---------- THE FLOOD
  'flood.jump': (g, t, lbl) => {
    shaft(g);
    ledge(g, 14, 78, 40);
    ledge(g, 60, 58, 30);
    ledge(g, 26, 36, 30);
    ledge(g, 70, 16, 34);
    // ledge to ledge, upward
    const k = ph(t, 3.6);
    const pts: Array<[number, number]> = [[30, 73], [74, 53], [40, 31], [86, 11]];
    const i = Math.min(2, Math.floor(k * 3));
    const q = (k * 3) % 1;
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const air = seg(q, 0.3, 0.8);
    const x = lerp(x0, x1, air);
    const y = lerp(y0, y1, air) - Math.sin(air * Math.PI) * 10;
    frog(g, x, y, 0.75, GREEN, { squash: air > 0 && air < 1 ? -0.5 : q < 0.3 ? q : 0, face: x1 > x0 ? 1 : -1 });
    key(g, lbl, 110, 86, 'SPC', air > 0 && air < 0.3, 17);
    lbl(40, 6, 'JUMP LEDGE TO LEDGE', GOLD);
  },
  'flood.ledges': (g, t, lbl) => {
    shaft(g);
    // four kinds: one slides, one spins, one goes into the wall, one crumbles
    ledge(g, 14 + Math.sin(t * 1.6) * 10, 18, 30);
    lbl(30, 10, 'SLIDES', CREAM);
    const spin = t * 2;
    g.fillStyle(0x9a7448, 1);
    const cx = 92;
    const cy = 22;
    g.lineStyle(3, 0x9a7448, 1).lineBetween(cx - Math.cos(spin) * 14, cy - Math.sin(spin) * 3, cx + Math.cos(spin) * 14, cy + Math.sin(spin) * 3);
    lbl(92, 10, 'SPINS', CREAM);
    const out = (Math.sin(t * 1.4) + 1) / 2;
    ledge(g, DEMO_W - 8 - 30 * out, 56, Math.max(1, 30 * out));
    lbl(92, 48, 'RETRACTS', CREAM);
    const c = ph(t, 2.5);
    if (c < 0.6) ledge(g, 14, 56, 30, 1);
    else for (let i = 0; i < 6; i++) g.fillStyle(0x9a7448, 1 - seg(c, 0.6, 1)).fillRect(16 + i * 5, 56 + seg(c, 0.6, 1) * (10 + i * 3), 4, 3);
    lbl(30, 48, 'CRUMBLES', RED);
    lbl(DEMO_W / 2, 84, 'WATCH BEFORE YOU LAND', GOLD);
  },
  'flood.water': (g, t, lbl) => {
    shaft(g);
    // the hatch at the top; the water rising under you
    g.fillStyle(0x6a6a7a, 1).fillRect(46, 2, 32, 6);
    g.fillStyle(0xa8a8b8, 1).fillRect(48, 3, 28, 3);
    lbl(62, 13, 'THE HATCH', GOLD);
    const k = ph(t, 6);
    ledge(g, 20, 64, 30);
    ledge(g, 70, 44, 30);
    ledge(g, 34, 26, 30);
    const y = lerp(92, 40, k);
    frog(g, 48, 21, 0.75, GREEN, { face: 1 });
    flood(g, t, y);
    lbl(DEMO_W / 2, Math.min(84, y + 10), y < 60 ? 'IT RISES - KEEP CLIMBING' : 'DO NOT LET IT REACH YOU', y < 60 ? RED : CREAM);
  },

  // ---------- DANCE OFF (the arrows RISE to the line at the top)
  'dance.arrows': (g, t, lbl) => {
    stage(g, t);
    const lineY = 14;
    // the line: an outline of each arrow, left down up right
    for (let i = 0; i < 4; i++) {
      const x = 32 + i * 20;
      panel(g, x - 7, lineY - 7, 14, 14, DANCE_COLS[i], 0x140c24);
      dirArrow(g, x, lineY, i, DANCE_COLS[i], 4.5, true);
    }
    // the notes come up from the bottom; each is hit as it reaches the line
    for (let n = 0; n < 6; n++) {
      const col = [0, 2, 1, 3, 2, 0][n];
      const k = ph(t + n * 0.55, 3.3);
      const y = lerp(DEMO_H + 8, lineY, k);
      const x = 32 + col * 20;
      if (k > 0.97) {
        glow(g, x, lineY, 9, DANCE_COLS[col], 0.9);
        continue;
      }
      g.fillStyle(shade(DANCE_COLS[col], 0.5), 1).fillRect(x - 6, y - 6, 12, 12);
      g.fillStyle(DANCE_COLS[col], 1).fillRect(x - 5, y - 5, 10, 10);
      dirArrow(g, x, y, col, 0x140c24, 3.5);
    }
    // (the stage's floor: they rise out of it, under the words)
    g.fillStyle(0x0c0618, 1).fillRect(0, 77, DEMO_W, DEMO_H - 77);
    g.fillStyle(PINK, 0.5).fillRect(0, 77, DEMO_W, 1);
    lbl(DEMO_W / 2, 84, 'PRESS EACH ONE ON THE LINE', CREAM);
  },
  'dance.keys': (g, t, lbl) => {
    stage(g, t);
    // A = left, S = down, W = up, D = right: the key lights its arrow
    const i = Math.floor(ph(t, 4) * 4);
    const wrong = ph(t, 8) > 0.875;
    const keys = ['A', 'S', 'W', 'D'];
    for (let j = 0; j < 4; j++) {
      const x = 22 + j * 27;
      const on = j === i && !wrong;
      if (on) glow(g, x, 22, 10, DANCE_COLS[j], 0.9);
      panel(g, x - 8, 14, 16, 16, DANCE_COLS[j], on ? shade(DANCE_COLS[j], 0.3) : 0x140c24);
      dirArrow(g, x, 22, j, on ? 0xffffff : DANCE_COLS[j], 5, !on);
      key(g, lbl, x, 46, keys[j], j === i);
    }
    lbl(DEMO_W / 2, 62, ['A IS LEFT', 'S IS DOWN', 'W IS UP', 'D IS RIGHT'][i], GOLD);
    if (wrong) {
      verdict(g, 22 + i * 27, 22, false);
      lbl(DEMO_W / 2, 78, 'A WRONG KEY COSTS 100', RED);
    } else lbl(DEMO_W / 2, 78, 'HIT THE ARROW ON THE LINE', CREAM);
  },
  'dance.rounds': (g, t, lbl) => {
    stage(g, t);
    // three rounds against him: 20, 35, 50
    const won = Math.floor(ph(t, 6) * 4);
    const pays = ['20', '35', '50'];
    for (let i = 0; i < 3; i++) {
      const on = i < won;
      if (on) glow(g, 32 + i * 30, 30, 9, GOLD, 0.8);
      g.fillStyle(on ? GOLD : 0x3a3050, 1).fillCircle(32 + i * 30, 30, 7);
      g.fillStyle(on ? 0xfff4b0 : 0x4a4060, 1).fillCircle(30 + i * 30, 28, 2);
      lbl(32 + i * 30, 44, pays[i], on ? GOLD : GREY);
    }
    // the two of them dancing under it
    const b = Math.abs(Math.sin(t * 6)) * 3;
    frog(g, 48, 66 - b, 0.9, 0x5ac85a, { face: 1 });
    g.fillStyle(0x8a5ad8, 1).fillRect(72, 54 - b, 10, 14);
    g.fillStyle(0xc8a0ff, 1).fillRect(73, 50 - b, 8, 6);
    lbl(DEMO_W / 2, 10, 'THREE ROUNDS', CREAM);
    lbl(DEMO_W / 2, 84, 'LOSE ONE: STOP AND KEEP IT', CREAM);
  },

  // ---------- FROG CROSS
  'cross.hop': (g, t, lbl) => {
    road(g);
    // one square a hop, up the road
    const k = ph(t, 3);
    const steps = Math.floor(k * 5);
    const q = (k * 5) % 1;
    const y = 82 - steps * 16 - ease(seg(q, 0, 0.4)) * 16;
    frog(g, 62, y, 0.8, GREEN, { squash: q < 0.4 ? -0.4 : 0 });
    key(g, lbl, 108, 84, 'W', q < 0.4);
    lbl(22, 84, 'HOP', GOLD);
  },
  'cross.cars': (g, t, lbl) => {
    road(g);
    // cars both ways; time each hop through a gap
    const cols = [PINK, ORANGE, TEAL, 0xe8c03a];
    for (let l = 0; l < 4; l++) {
      const dir = l % 2 ? -1 : 1;
      for (let c = 0; c < 2; c++) {
        const x = (((t * (26 + l * 6) * dir + c * 64 + l * 20) % 140) + 140) % 140 - 8;
        sideCar(g, x, 18 + l * 16, cols[(l + c) % 4], dir);
      }
    }
    const k = ph(t, 4);
    const y = k < 0.5 ? 82 : 82 - Math.floor(seg(k, 0.5, 1) * 4) * 16;
    frog(g, 62, y, 0.75, GREEN);
    lbl(DEMO_W / 2, 5, 'TIME EACH HOP THROUGH A GAP', CREAM);
  },
  'cross.bank': (g, t, lbl) => {
    road(g);
    const n = 1 + Math.floor(ph(t, 6) * 5);
    panel(g, 14, 22, 96, 36, GOLD, 0x141024);
    lbl(DEMO_W / 2, 30, `CROSSINGS ${n} / 5`, CREAM);
    for (let i = 0; i < 5; i++) g.fillStyle(i < n ? GOLD : 0x3a3450, 1).fillCircle(38 + i * 12, 42, 3);
    lbl(DEMO_W / 2, 52, n >= 5 ? 'FIVE PAY 20' : 'KEEP GOING...', n >= 5 ? GOLD : CREAM);
    lbl(30, 70, 'BANK IT', GREEN);
    lbl(94, 70, 'OR GO ON', ORANGE);
    for (let i = 0; i < 3; i++) frog(g, 50 + i * 12, 84, 0.5, GREEN);
  },

  // ---------- CAR CHASE
  'chase.drive': (g, t, lbl) => {
    chaseRoad(g, t, 50 + Math.sin(t) * 20);
    // steer left and right; faster, slower
    const x = 62 + Math.sin(t * 1.3) * 22;
    car(g, x, 66, 0x4ac85a);
    g.fillStyle(0xffffff, 0.9).fillRect(x - 3, 61, 2, 2).fillRect(x + 1, 61, 2, 2);
    cop(g, 62 + Math.sin(t * 1.3 - 0.8) * 18, 88, t);
    key(g, lbl, 10, 70, 'A', Math.cos(t * 1.3) < -0.3);
    key(g, lbl, 114, 70, 'D', Math.cos(t * 1.3) > 0.3);
    lbl(DEMO_W / 2, 8, 'STEER, SPEED UP, EASE OFF', CREAM);
  },
  'chase.cash': (g, t, lbl) => {
    chaseRoad(g, t);
    // grab the cash on the road
    const cash = Math.floor(ph(t, 6) * 8) * 50;
    for (let i = 0; i < 3; i++) {
      const y = ((t * 40 + i * 34) % 110) - 10;
      const x = 42 + i * 20;
      if (y < 62) {
        g.fillStyle(0x2a6a2a, 1).fillRect(x - 5, y - 3, 10, 6);
        g.fillStyle(0x7ae07a, 1).fillRect(x - 4, y - 2, 8, 4);
        g.fillStyle(0x2a6a2a, 1).fillRect(x - 1, y - 1, 2, 2);
      } else if (y < 72) lbl(x, 54 - (y - 62), '+$', GOLD);
    }
    car(g, 62, 70, 0x4ac85a);
    panel(g, 4, 4, 52, 12, GOLD, 0x0c0a14);
    lbl(30, 10, `CASH ${cash}`, cash >= 300 ? GOLD : CREAM);
    lbl(DEMO_W / 2, 84, '300 PAYS 20, +5 PER 100 MORE', GOLD);
  },
  'chase.bomb': (g, t, lbl) => {
    chaseRoad(g, t);
    const k = ph(t, 3);
    car(g, 62, 40, 0x4ac85a);
    // a Froggy bomb back at them: the law spins and clears
    const by = lerp(46, 74, seg(k, 0.1, 0.4));
    if (k < 0.4) {
      g.fillStyle(0x1e5a2a, 1).fillCircle(62, by, 3);
      g.fillStyle(0x6ae08a, 1).fillCircle(62, by, 2);
    } else if (k < 0.6) {
      glow(g, 62, 76, 14, GOLD, 0.9);
      burst(g, 62, 76, 16, 0xffffff, 12);
    }
    const spin = k > 0.4 ? (k - 0.4) * 30 : 0;
    const off = k > 0.4 ? seg(k, 0.4, 1) * 50 : 0;
    cop(g, 50 - off * 0.6, 80 + off * 0.3, t + spin, spin);
    cop(g, 76 + off * 0.6, 82 + off * 0.3, t + spin, spin);
    key(g, lbl, 104, 10, 'SPC', k < 0.15, 17);
    lbl(40, 10, 'BOMB: 30', GOLD);
  },
  'chase.hazards': (g, t, lbl) => {
    chaseRoad(g, t, 30);
    // oil spins you; a pothole breaks the car a bit; concrete ends it
    g.fillStyle(0x0a0a10, 0.9).fillEllipse(38, 24, 14, 8);
    g.fillStyle(0x3a2a6a, 0.5).fillEllipse(36, 23, 6, 3);
    lbl(38, 14, 'OIL', 0xb8a0ff);
    g.fillStyle(0x1a1a20, 1).fillEllipse(84, 44, 9, 6);
    g.fillStyle(0x4a4a54, 1).fillRect(80, 41, 8, 1);
    lbl(84, 34, 'POTHOLE', CREAM);
    g.fillStyle(0x6a6a72, 1).fillRect(46, 62, 32, 8);
    g.fillStyle(0xa8a8b0, 1).fillRect(46, 62, 32, 2);
    for (let i = 0; i < 4; i++) g.fillStyle(0xe8c03a, 1).fillRect(48 + i * 8, 66, 4, 2);
    lbl(62, 76, 'CONCRETE: OVER', RED);
    const k = ph(t, 2);
    const sp = k * Math.PI * 4;
    g.fillStyle(0x4ac85a, 1).fillRect(38 + Math.cos(sp) * 4 - 3, 30 + Math.sin(sp) * 2, 6, 9);
  },

  // ---------- FENCE WARS
  'fence.aim': (g, t, lbl) => {
    fenceField(g, t);
    frog(g, 22, 74, 1.1, GREEN, { face: 1 });
    lizard(g, 100, 76, 1);
    // W / S aims higher or lower
    const a = 0.5 + Math.sin(t * 1.4) * 0.35;
    arrow(g, 28, 68, 28 + Math.cos(a) * 22, 68 - Math.sin(a) * 22, GOLD);
    key(g, lbl, 54, 10, 'W', Math.cos(t * 1.4) > 0.3);
    key(g, lbl, 70, 10, 'S', Math.cos(t * 1.4) < -0.3);
    lbl(DEMO_W / 2, 22, 'AIM HIGHER OR LOWER', CREAM);
  },
  'fence.power': (g, t, lbl) => {
    fenceField(g, t);
    lizard(g, 100, 76, 1);
    const k = ph(t, 3);
    const hold = seg(k, 0, 0.4);
    const fly2 = seg(k, 0.45, 0.85);
    frog(g, 22, 74, 1.1, GREEN, { face: 1, squash: k < 0.42 ? hold * 0.8 : 0 });
    panel(g, 4, 30, 8, 36, 0x8a84a8, 0x0c0a14);
    g.fillStyle(GOLD, 1).fillRect(6, 64 - Math.round(32 * (k < 0.45 ? hold : 0)), 4, Math.round(32 * (k < 0.45 ? hold : 0)));
    if (fly2 > 0 && fly2 < 1) {
      const x = lerp(28, 98, fly2);
      const y = lerp(64, 70, fly2) - Math.sin(fly2 * Math.PI) * 46;
      g.fillStyle(0x4a4a52, 1).fillCircle(x, y, 2.5);
      g.fillStyle(0x8a8a92, 1).fillRect(x - 1, y - 1, 1, 1);
    }
    if (k > 0.85) burst(g, 100, 72, 9, GOLD);
    bar(g, 84, 54, 30, k > 0.85 ? 0.6 : 0.8, ORANGE);
    key(g, lbl, DEMO_W / 2, 10, 'SPC', k < 0.42, 17);
    lbl(DEMO_W / 2, 22, k < 0.44 ? 'HOLD FOR POWER' : 'LET GO: THROW', k < 0.44 ? CREAM : GOLD);
  },
  'fence.wind': (g, t, lbl) => {
    fenceField(g, t);
    frog(g, 22, 74, 1.1, GREEN, { face: 1 });
    lizard(g, 100, 76, 1);
    // the wind bends the throw: aim off it
    panel(g, 38, 4, 48, 12, 0x8a84a8, 0x0c0a14);
    const w = Math.sin(t * 0.5);
    g.fillStyle(GOLD, 1).fillRect(62, 7, Math.round(w * 20), 6);
    lbl(DEMO_W / 2, 10, w > 0 ? 'WIND >>' : '<< WIND', CREAM);
    dots(g, 28, 66, 60, -110, 120, 0xffffff, 14, w * 60, 0.5);
    dots(g, 28, 66, 60 - w * 22, -110, 120, GOLD, 14, w * 60);
    lbl(DEMO_W / 2, 84, 'EMPTY HIS HEALTH BAR', CREAM);
  },
  'fence.items': (g, t, lbl) => {
    fenceField(g, t);
    // 1-6 picks an item on the bar
    const i = Math.floor(ph(t, 6) * 6);
    for (let j = 0; j < 6; j++) {
      const x = 8 + j * 19;
      panel(g, x, 72, 17, 14, j === i ? GOLD : 0x4a4a6a, 0x141024);
      lbl(x + 4, 79, String(j + 1), j === i ? GOLD : GREY);
      const icx = x + 11;
      const col = [0x8a8a92, 0x5ae88a, 0xe03a2a, 0x8a5ad8, 0x3a8ae8, 0xff7ab0][j];
      g.fillStyle(col, 1).fillCircle(icx, 79, 3);
    }
    const names = ['ROCK', 'HEAL', 'DYNAMITE', 'POISON', 'FREEZE', 'CANDY'];
    lbl(DEMO_W / 2, 10, names[i], GOLD);
    frog(g, 22, 56, 1, GREEN, { face: 1 });
    if (i === 2) {
      const k = ph(t, 1);
      glow(g, 100, 54, 10 * k, ORANGE, 0.9);
      burst(g, 100, 54, 14 * k, GOLD, 10);
    }
    lizard(g, 100, 58, 1);
  },

  // ---------- BOG BALL
  'bog.pick': (g, t, lbl) => {
    marsh(g, t);
    mudBall(g, 62, 45);
    const sel = Math.floor(ph(t, 4.5) * 3);
    [[30, 26], [24, 46], [30, 66]].forEach(([x, y], i) => toad(g, x, y, false, i === sel));
    [[94, 26], [100, 46], [94, 66]].forEach(([x, y]) => toad(g, x, y, true));
    const [cx, cy] = [[30, 26], [24, 46], [30, 66]][sel];
    cursor(g, cx + 3, cy + 3, ph(t, 1.5) > 0.6);
    lbl(DEMO_W / 2, 84, 'CLICK ONE OF YOUR FROGS', CREAM);
  },
  'bog.sling': (g, t, lbl) => {
    marsh(g, t);
    mudBall(g, 76, 45);
    // drag back to aim and set the power; let go to launch
    const k = ph(t, 2.6);
    const pull = seg(k, 0.05, 0.5);
    const fly2 = seg(k, 0.55, 0.8);
    const hx = 40;
    const hy = 45;
    if (k < 0.55) {
      const px = hx - pull * 22;
      const py = hy + pull * 8;
      g.lineStyle(1, 0xd8c8a0, 1).lineBetween(hx, hy, px, py);
      for (let i = 1; i <= 6; i++) g.fillStyle(GOLD, 1).fillRect(Math.round(hx + (hx - px) * i * 0.5), Math.round(hy + (hy - py) * i * 0.5), 1, 1);
      toad(g, hx, hy, false, true);
      cursor(g, px, py, true);
      lbl(DEMO_W / 2, 84, 'DRAG BACK: AIM AND POWER', CREAM);
    } else {
      const x = lerp(hx, 70, fly2);
      toad(g, x, hy, false);
      if (fly2 >= 1) burst(g, 72, 45, 8, GOLD);
      lbl(DEMO_W / 2, 84, 'LET GO: LAUNCH!', GOLD);
    }
  },
  'bog.goal': (g, t, lbl) => {
    marsh(g, t);
    // the ball into his arch: a goal
    const k = ph(t, 2.6);
    const q = seg(k, 0.1, 0.7);
    const bx = lerp(60, DEMO_W - 6, q);
    const by = lerp(48, 45, q);
    toad(g, lerp(40, 54, seg(k, 0, 0.12)), 48, false);
    toad(g, 96, 24, true);
    toad(g, 96, 68, true);
    if (q < 1) mudBall(g, bx, by);
    else {
      g.fillStyle(0xe8642a, 0.5 + 0.4 * Math.sin(t * 30)).fillRect(DEMO_W - 8, 30, 8, 30);
      lbl(DEMO_W / 2, 20, 'GOAL!', GOLD);
    }
    lbl(DEMO_W / 2, 84, 'TEN SHOTS EACH - MOST GOALS', CREAM);
  },

  // ---------- FROGGY SLOTS (five reels)
  'slots.spin': (g, t, lbl) => {
    slotFrame(g);
    const k = ph(t, 3);
    for (let c = 0; c < 5; c++) {
      const stop = 0.3 + c * 0.12;
      const spinning = k < stop;
      for (let r = 0; r < 3; r++) {
        const x = 22 + c * 20;
        if (spinning) {
          const off = (t * 120 + c * 13) % 18;
          for (let s = -1; s < 3; s++) {
            const by = 16 + s * 18 + off;
            const top = Math.max(15, by);
            const bot = Math.min(66, by + 10);
            if (bot > top) g.fillStyle(0xffffff, 0.12).fillRect(x - 5, top, 10, bot - top);
          }
        } else slotSym(g, x, 23 + r * 18, (c * 3 + r * 2 + 1) % 5);
      }
    }
    key(g, lbl, 28, 82, 'SPC', k < 0.1, 17);
    lbl(84, 82, 'SPIN: 3 TOKENS', GOLD);
  },
  'slots.lines': (g, t, lbl) => {
    slotFrame(g);
    // 3, 4 or 5 in a line pays: across, down, diagonal
    const kind = Math.floor(ph(t, 6) * 3);
    for (let c = 0; c < 5; c++)
      for (let r = 0; r < 3; r++) {
        const inLine = kind === 0 ? r === 1 && c < 4 : kind === 1 ? c === 2 : c === r || c === r + 2 - 2;
        slotSym(g, 22 + c * 20, 23 + r * 18, inLine ? 3 : (c * 2 + r * 3) % 3);
      }
    g.lineStyle(1, GOLD, 0.9);
    if (kind === 0) g.strokeRect(12.5, 33.5, 80, 18);
    else if (kind === 1) g.strokeRect(52.5, 14.5, 20, 54);
    else g.lineBetween(16, 17, 68, 67);
    lbl(DEMO_W / 2, 82, ['ACROSS PAYS', 'DOWN PAYS', 'DIAGONAL PAYS'][kind], GOLD);
  },
  'slots.froggy': (g, t, lbl) => {
    slotFrame(g);
    // Froggy is the rarest; the golden Froggy is wild
    const k = ph(t, 4);
    for (let c = 0; c < 5; c++)
      for (let r = 0; r < 3; r++) {
        const x = 22 + c * 20;
        const y = 23 + r * 18;
        if (r === 1) {
          const wild = c === 2 && k > 0.5;
          if (wild) glow(g, x, y, 8, GOLD, 0.8);
          slotSym(g, x, y, wild ? 6 : 5);
        } else slotSym(g, x, y, (c + r) % 4);
      }
    lbl(DEMO_W / 2, 82, k > 0.5 ? 'GOLDEN FROGGY IS WILD' : 'FIVE FROGGYS: JACKPOT', GOLD);
  },

  // ---------- FROGGY 21 (blackjack)
  'bj.bet': (g, t, lbl) => {
    felt(g);
    froggy(g, DEMO_W / 2, 16, 0.7);
    // LEFT / RIGHT by 1, UP / DOWN by 5, SPACE deals
    const step = Math.floor(ph(t, 5) * 5);
    const bet = [1, 2, 7, 12, 12][step];
    for (let i = 0; i < Math.min(8, Math.ceil(bet / 2)); i++) chip(g, 62, 54 - i * 2, i % 2 ? 0x3a8ad8 : RED);
    lbl(DEMO_W / 2, 40, `BET ${bet}`, GOLD);
    key(g, lbl, 22, 70, '>', step === 1);
    key(g, lbl, 36, 70, '^', step === 2 || step === 3);
    lbl(29, 80, '+1  +5', CREAM);
    key(g, lbl, 100, 70, 'SPC', step === 4, 17);
    lbl(100, 80, 'DEAL', step === 4 ? GOLD : CREAM);
  },
  'bj.hit': (g, t, lbl) => {
    felt(g);
    froggy(g, DEMO_W / 2, 14, 0.6);
    card(g, lbl, 50, 30, '9', true, false);
    card(g, lbl, 64, 30, '', false, true);
    // H takes a card; over 21 is bust
    const k = ph(t, 6);
    const n = 2 + Math.floor(seg(k, 0.15, 0.75) * 2);
    const faces = ['7', '5', '6', 'K'];
    let total = 0;
    for (let i = 0; i < n; i++) {
      card(g, lbl, 40 + i * 14, 64, faces[i], i % 2 === 1);
      total += [7, 5, 6, 10][i];
    }
    const bust = total > 21;
    lbl(104, 64, String(total), bust ? RED : CREAM);
    key(g, lbl, 16, 84, 'H', k > 0.15 && k < 0.2);
    lbl(DEMO_W / 2, 84, n >= 4 ? 'OVER 21: BUST' : 'H: ANOTHER CARD', n >= 4 ? RED : CREAM);
  },
  'bj.cards': (g, t, lbl) => {
    felt(g);
    // J, Q and K are 10; an ace counts 1, 10 or 11 (on two cards)
    const k = ph(t, 6);
    if (k < 0.5) {
      card(g, lbl, 36, 32, 'J');
      card(g, lbl, 62, 32, 'Q', true);
      card(g, lbl, 88, 32, 'K');
      lbl(DEMO_W / 2, 56, 'ALL WORTH 10', GOLD);
    } else {
      card(g, lbl, 62, 32, 'A', true);
      const v = ['1', '10', '11'][Math.floor(seg(k, 0.5, 1) * 3) % 3];
      lbl(DEMO_W / 2, 56, `AN ACE: ${v}`, GOLD);
      lbl(DEMO_W / 2, 70, 'YOU CHOOSE THE BEST', CREAM);
    }
  },
  'bj.rules': (g, t, lbl) => {
    felt(g);
    const k = Math.floor(ph(t, 9) * 3);
    if (k === 0) {
      card(g, lbl, 52, 30, 'A', true);
      card(g, lbl, 68, 30, 'K');
      lbl(DEMO_W / 2, 52, '21 ON TWO: WINS 2X', GOLD);
    } else if (k === 1) {
      ['7', '7', '7'].forEach((f, i) => card(g, lbl, 46 + i * 14, 30, f, i === 1));
      lbl(DEMO_W / 2, 52, '21 ON THREE: WINS', GOLD);
    } else {
      ['2', '3', '4', '5', '2'].forEach((f, i) => card(g, lbl, 34 + i * 14, 30, f, i % 2 === 1));
      lbl(DEMO_W / 2, 52, 'FIVE CARDS, NOT BUST: WINS', GOLD);
      lbl(DEMO_W / 2, 66, '(21 ON FIVE LOSES)', RED);
    }
  },

  // ---------- CHAMBER (roulette)
  'chamber.spin': (g, t, lbl) => {
    chamberRoom(g);
    // SPACE stops the spin; SPACE again pulls
    const k = ph(t, 3);
    const a = k < 0.4 ? t * 14 : 1.1;
    cylinder(g, DEMO_W / 2, 38, a);
    key(g, lbl, DEMO_W / 2, 74, 'SPC', (k > 0.38 && k < 0.44) || (k > 0.7 && k < 0.76), 17);
    lbl(DEMO_W / 2, 84, k < 0.4 ? 'SPINNING: STOP IT' : k < 0.72 ? 'NOW PULL' : 'CLICK: CLEAN +5', k > 0.72 ? GOLD : CREAM);
  },
  'chamber.odds': (g, t, lbl) => {
    chamberRoom(g);
    cylinder(g, DEMO_W / 2, 38, t * 0.6, 2);
    lbl(DEMO_W / 2, 72, 'ONE LIVE ROUND IN FIVE', RED);
    lbl(DEMO_W / 2, 84, 'EVERY CLEAN PULL PAYS 5', GOLD);
  },
  'chamber.cash': (g, t, lbl) => {
    chamberRoom(g);
    const k = ph(t, 6);
    const cash = k < 0.5;
    cylinder(g, DEMO_W / 2, 34, 1.1, -1, !cash && k > 0.7 && k < 0.85 ? 1 - seg(k, 0.7, 0.85) : 0);
    if (cash) {
      panel(g, 34, 62, 56, 14, GOLD, 0x1a3a1a);
      lbl(DEMO_W / 2, 69, 'CASH OUT', GOLD);
      for (let i = 0; i < 3; i++) coin(g, 40 + i * 22, lerp(52, 84, seg(k, 0.2 + i * 0.05, 0.45)), t + i);
      lbl(DEMO_W / 2, 86, 'KEEP WHAT IS ON IT', CREAM);
    } else {
      lbl(DEMO_W / 2, 70, k > 0.7 ? 'BANG' : 'ONE MORE PULL...', k > 0.7 ? RED : CREAM);
      if (k > 0.7) lbl(DEMO_W / 2, 82, 'A LIVE ROUND TAKES IT ALL', RED);
    }
  },

  // ---------- WHEEL OF FORTUNE
  'wheel.spin': (g, t, lbl) => {
    grad(g, 0x2a1a3a, 0x140c1e);
    // spin, slow, stop
    const k = ph(t, 4);
    const a = k < 0.8 ? 18 * (1 - (1 - k / 0.8) ** 3) : 18;
    prizeWheel(g, 46, 46, 34, a);
    key(g, lbl, 104, 40, 'SPC', k < 0.08, 17);
    lbl(104, 54, 'SPIN', GOLD);
    lbl(104, 64, '25 A GO', CREAM);
  },
  'wheel.odds': (g, t, lbl) => {
    grad(g, 0x2a1a3a, 0x140c1e);
    // the thinnest faces are the rarest
    const thin = ph(t, 4) < 0.5;
    prizeWheel(g, 46, 46, 34, -Math.PI / 2 - 0.3, thin ? 3 : 0);
    lbl(104, 30, thin ? '5000' : '1-15', GOLD);
    lbl(104, 40, thin ? '0.01%' : '62.4%', thin ? RED : GREEN);
    lbl(104, 56, thin ? 'THIN:' : 'WIDE:', CREAM);
    lbl(104, 64, thin ? 'RARE' : 'OFTEN', CREAM);
  },
  'wheel.keep': (g, t, lbl) => {
    grad(g, 0x2a1a3a, 0x140c1e);
    prizeWheel(g, 46, 46, 34, -Math.PI / 2 - 0.4, 2);
    const k = ph(t, 2.5);
    for (let i = 0; i < 3; i++) coin(g, 104, lerp(30, 60, seg(k, i * 0.15, 0.5 + i * 0.15)), t + i);
    lbl(104, 72, '+15', GOLD);
    lbl(DEMO_W / 2, 86, 'WHERE IT STOPS IS YOURS', CREAM);
  },

  // ---------- FROG RACE
  'race.back': (g, t, lbl) => {
    track(g, t);
    // 1-4 backs a frog; up / down buys tickets
    const pick = Math.floor(ph(t, 6) * 4);
    RACERS.forEach((col, i) => {
      const y = 26 + i * 17;
      panel(g, 2, y - 6, 12, 12, i === pick ? GOLD : 0x4a6a8a, 0x1a2a3a);
      lbl(8, y, String(i + 1), i === pick ? GOLD : CREAM);
      frog(g, 24, y, 0.75, col, { face: 1 });
    });
    const tickets = 1 + Math.floor(ph(t, 3) * 3);
    panel(g, 48, 44, 56, 14, GOLD, 0x141024);
    lbl(76, 51, `${tickets} X 10 = ${tickets * 10}`, CREAM);
  },
  'race.run': (g, t, lbl) => {
    track(g, t);
    // they race; rocks, traps and hawks can steal it
    const k = ph(t, 5);
    g.fillStyle(0x6a6a6a, 1).fillEllipse(70, 44, 8, 5);
    g.fillStyle(0x1a120a, 1).fillEllipse(54, 78, 10, 4);
    const hawkX = lerp(130, -10, ph(t, 3));
    g.fillStyle(0x3a2a1a, 1).fillTriangle(hawkX, 8, hawkX + 10, 4, hawkX + 10, 12);
    g.fillStyle(0x000000, 0.25).fillEllipse(hawkX + 6, 60, 12, 4);
    RACERS.forEach((col, i) => {
      const speed = [0.95, 1.05, 0.85, 1][i];
      const stalled = (i === 1 && k > 0.5 && k < 0.65) || (i === 3 && k > 0.6 && k < 0.7);
      const x = 16 + Math.min(92, k * 96 * speed) - (stalled ? 4 : 0);
      const hop = Math.abs(Math.sin(t * 10 + i)) * 3;
      frog(g, x, 26 + i * 17 - hop, 0.7, col, { face: 1, blink: stalled });
    });
    lbl(DEMO_W / 2, 88 - 2, 'ROCKS, TRAPS, HAWKS: A GUESS', CREAM);
  },
  'race.pay': (g, t, lbl) => {
    track(g, t);
    // your frog first to the tape: 20 back on every ticket
    frog(g, 102, 43, 0.9, RACERS[1], { face: 1, mouth: true });
    burst(g, 102, 40, 12, GOLD);
    for (let i = 0; i < 3; i++) coin(g, 30 + i * 16, 56 + Math.sin(t * 4 + i) * 2, t + i);
    lbl(50, 30, 'YOUR FROG WINS', GOLD);
    lbl(50, 72, '20 BACK A TICKET', CREAM);
  },

  // ---------- FROGSTER MASH
  'mash.chests': (g, t, lbl) => {
    grad(g, 0x1e1a24, 0x0e0c12);
    bricks(g, 0, 0, DEMO_W, 56, 0x2a2430, 0x16121c, 14, 7);
    planks(g, 0, 56, DEMO_W, 34, 0x5a3a24, 8, true);
    // LEFT / RIGHT picks a chest, SPACE opens it
    const k = ph(t, 5);
    const sel = Math.min(4, Math.floor(k * 6));
    for (let i = 0; i < 5; i++) chest(g, 14 + i * 24, 66, i === 3 && k > 0.66 ? seg(k, 0.66, 0.8) : 0, i === sel);
    if (k > 0.75) {
      g.lineStyle(2, 0xc8c8d8, 1).lineBetween(80, 50, 92, 38);
      g.fillStyle(0x6a4a2a, 1).fillRect(78, 50, 4, 3);
      lbl(DEMO_W / 2, 26, 'A SWORD - YOURS', GOLD);
    } else lbl(DEMO_W / 2, 26, 'PICK A CHEST', CREAM);
    key(g, lbl, 20, 10, '<', k < 0.66 && Math.floor(k * 12) % 2 === 0);
    key(g, lbl, 34, 10, '>', k < 0.66 && Math.floor(k * 12) % 2 === 1);
    key(g, lbl, 100, 10, 'SPC', k > 0.62 && k < 0.7, 17);
  },
  'mash.gear': (g, t, lbl) => {
    grad(g, 0x1e1a24, 0x0e0c12);
    // four chests: a weapon and armour for each slot -- no swaps
    const n = Math.floor(ph(t, 5) * 5);
    const slots = ['WEAPON', 'HEAD', 'BODY', 'FEET'];
    slots.forEach((s, i) => {
      const y = 12 + i * 18;
      panel(g, 58, y - 6, 60, 14, i < n ? GOLD : 0x4a4a6a, 0x141024);
      lbl(88, y + 1, i < n ? s : '...', i < n ? GOLD : GREY);
    });
    // Froggy, filling up
    frog(g, 28, 54, 1.6, 0x5ac85a, { face: 1 });
    if (n > 0) g.lineStyle(2, 0xc8c8d8, 1).lineBetween(40, 54, 50, 40);
    if (n > 1) g.fillStyle(0x8a8a9a, 1).fillRect(20, 38, 16, 4);
    if (n > 2) g.fillStyle(0x6a6a7a, 0.8).fillRect(20, 52, 16, 6);
    if (n > 3) g.fillStyle(0x5a3a24, 1).fillRect(18, 62, 6, 3).fillRect(32, 62, 6, 3);
    lbl(DEMO_W / 2, 86, 'ONE FOR EACH SLOT', CREAM);
  },
  'mash.fight': (g, t, lbl) => {
    grad(g, 0x2a1418, 0x140a0c);
    planks(g, 0, 68, DEMO_W, 22, 0x5a3a24, 8, true);
    // he fights on his own: every round won pays 25
    const k = ph(t, 2);
    const lunge = Math.sin(seg(k, 0.2, 0.45) * Math.PI) * 10;
    frog(g, 38 + lunge, 62, 1.3, 0x5ac85a, { face: 1, mouth: lunge > 5 });
    g.lineStyle(2, 0xc8c8d8, 1).lineBetween(48 + lunge, 60, 58 + lunge, 48);
    const hurt = k > 0.35 && k < 0.55;
    g.fillStyle(hurt ? 0xffffff : 0x8a3a6a, 1).fillEllipse(88, 56, 22, 22);
    g.fillStyle(0xff5a3a, 1).fillCircle(84, 52, 2).fillCircle(92, 52, 2);
    if (hurt) burst(g, 80, 54, 10, GOLD);
    const rounds = Math.floor(ph(t, 8) * 4);
    lbl(DEMO_W / 2, 10, `ROUNDS WON ${rounds}`, CREAM);
    lbl(DEMO_W / 2, 22, `BANK ${rounds * 25}`, GOLD);
  },
  'mash.bank': (g, t, lbl) => {
    grad(g, 0x1e1a24, 0x0e0c12);
    const n = 1 + Math.floor(ph(t, 8) * 3);
    lbl(DEMO_W / 2, 14, `BANK ${n * 25}`, GOLD);
    const take = ph(t, 2) < 0.5;
    panel(g, 10, 30, 48, 20, take ? GREEN : 0x3a5a3a, 0x0e1e0e);
    lbl(34, 40, 'TAKE IT', GREEN);
    panel(g, 66, 30, 48, 20, !take ? RED : 0x5a3a3a, 0x1e0e0e);
    lbl(90, 37, 'RISK IT', RED);
    lbl(90, 45, '+25', ORANGE);
    lbl(DEMO_W / 2, 66, 'LOSE THE NEXT ROUND', CREAM);
    lbl(DEMO_W / 2, 76, 'AND IT ALL GOES', RED);
  },

  // ---------- PAD BATTLES (the pads float apart: you jump between them)
  'pads.grid': (g, t, lbl) => {
    water(g, t);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) lily(g, 18 + c * 22, 30 + r * 20, 7.5, 0x3e9a3e, rnd(r * 5 + c) * 6);
    const cols = [GREEN, RED, 0x3a7ad8, GOLD];
    const at = [[0, 0], [4, 0], [4, 2], [0, 2]];
    cols.forEach((col, i) => frog(g, 18 + at[i][0] * 22, 28 + at[i][1] * 20 - Math.abs(Math.sin(t * 4 + i)) * 1.5, 0.6, col, { face: at[i][0] ? -1 : 1 }));
    lbl(DEMO_W / 2, 10, 'WATER BETWEEN THE PADS', CREAM);
    lbl(DEMO_W / 2, 84, 'LAST FROG STANDING WINS', GOLD);
  },
  'pads.jump': (g, t, lbl) => {
    water(g, t);
    lily(g, 30, 50, 12, 0x3e9a3e, 0.4);
    lily(g, 94, 50, 12, 0x3e9a3e, 2.6);
    // walk your own pad; JUMP to the next one the way you face
    const k = ph(t, 3);
    const walk = seg(k, 0, 0.3);
    const air = seg(k, 0.38, 0.72);
    let x = 24 + walk * 10;
    let y = 46;
    if (air > 0) {
      x = lerp(34, 92, air);
      y = 46 - Math.sin(air * Math.PI) * 18;
      shadow(g, x, 52, 10 - Math.sin(air * Math.PI) * 4, 3, 0.3);
    }
    const squash = k > 0.3 && k < 0.38 ? 0.8 : k > 0.72 && k < 0.8 ? 0.6 : air > 0 ? -0.5 : 0;
    frog(g, k > 0.72 ? 92 : x, k > 0.72 ? 46 : y, 0.8, GREEN, { face: 1, squash });
    if (k > 0.72 && k < 0.85) g.lineStyle(1, 0xc8f0b0, 1 - seg(k, 0.72, 0.85)).strokeEllipse(92, 50, 10 + seg(k, 0.72, 0.85) * 10, 5 + seg(k, 0.72, 0.85) * 5);
    key(g, lbl, DEMO_W / 2, 80, 'SPC', k > 0.3 && k < 0.4, 17);
    lbl(DEMO_W / 2, 10, k < 0.3 ? 'WALK YOUR OWN PAD' : 'JUMP TO THE NEXT ONE', k < 0.3 ? CREAM : GOLD);
  },
  'pads.collapse': (g, t, lbl) => {
    water(g, t);
    const k = ph(t, 3);
    lily(g, 26, 48, 11, 0x3e9a3e, 0.5);
    lily(g, 98, 48, 11, 0x3e9a3e, 2.2);
    // flash, shake, crack... and sink
    if (k < 0.75) {
      const warn = k > 0.15;
      const flashOn = warn && Math.sin(t * (12 + k * 30)) > 0;
      const sh = warn ? Math.sin(t * 70) * k * 1.5 : 0;
      lily(g, 62 + sh, 48, 11, flashOn ? (k > 0.5 ? 0xff7a5a : 0xffc070) : 0x3e9a3e, 1.2);
      if (k > 0.45) {
        g.lineStyle(1, 0x1a0c04, 0.9).lineBetween(62, 48, 56, 44).lineBetween(56, 44, 52, 46).lineBetween(62, 48, 68, 52).lineBetween(62, 48, 66, 42);
      }
    } else {
      const s = seg(k, 0.75, 1);
      lily(g, 62, 48 + s * 3, 11 * (1 - s * 0.5), 0x5a6a3a, 1.2);
      g.lineStyle(1, 0xd8f4ff, 1 - s).strokeEllipse(62, 48, 16 + s * 20, 8 + s * 10);
    }
    frog(g, k < 0.55 ? 62 : 98, k < 0.55 ? 44 : 44, 0.7, GREEN, { face: 1 });
    lbl(DEMO_W / 2, 12, 'FLASH, SHAKE, CRACK...', CREAM);
    lbl(DEMO_W / 2, 78, k < 0.55 ? 'JUMP OFF IT IN TIME' : '...AND IT SINKS', k < 0.55 ? GOLD : RED);
  },
  'pads.tongue': (g, t, lbl) => {
    water(g, t);
    lily(g, 34, 50, 12, 0x3e9a3e, 0.4);
    lily(g, 90, 50, 12, 0x3e9a3e, 2.4);
    // the tongue reaches across the gap and knocks him back -- in
    const k = ph(t, 2.2);
    const len = Math.sin(seg(k, 0.1, 0.45) * Math.PI) * 44;
    frog(g, 34, 46, 0.8, GREEN, { face: 1, mouth: len > 4 });
    if (len > 0) {
      g.lineStyle(3, 0x7a1a3a, 1).lineBetween(40, 46, 40 + len, 46);
      g.lineStyle(1.5, 0xff6a9a, 1).lineBetween(40, 46, 40 + len, 46);
      g.fillStyle(0xff9ac0, 1).fillCircle(40 + len, 46, 2);
    }
    const knock = seg(k, 0.3, 0.6);
    const fall = seg(k, 0.6, 0.9);
    if (fall < 1) frog(g, 84 + knock * 18, 46 + fall * 6, 0.8 * (1 - fall * 0.4), RED, { face: -1, blink: knock > 0 });
    if (fall > 0) g.lineStyle(1, 0xd8f4ff, 1 - fall).strokeEllipse(104, 54, 8 + fall * 18, 4 + fall * 9);
    lbl(DEMO_W / 2, 12, 'TONGUE: EVEN ACROSS A GAP', CREAM);
    lbl(DEMO_W / 2, 80, 'KNOCK THEM INTO THE WATER', GOLD);
  },
  'pads.bump': (g, t, lbl) => {
    water(g, t);
    lily(g, 62, 50, 22, 0x3e9a3e, 0.6);
    // a charge across your pad: they go off the edge
    const k = ph(t, 2.4);
    const charge = seg(k, 0.1, 0.3);
    frog(g, 44 + charge * 14, 46, 0.8, GREEN, { face: 1, squash: charge > 0 && charge < 1 ? -0.3 : 0 });
    const fly2 = seg(k, 0.3, 0.6);
    const sink = seg(k, 0.6, 0.9);
    if (sink < 1) frog(g, 70 + fly2 * 30, 46 + sink * 8, 0.8 * (1 - sink * 0.4), 0x3a7ad8, { face: -1, blink: fly2 > 0 });
    if (fly2 > 0 && fly2 < 0.3) burst(g, 66, 44, 8, GOLD);
    if (sink > 0) g.lineStyle(1, 0xd8f4ff, 1 - sink).strokeEllipse(100, 56, 8 + sink * 18, 4 + sink * 9);
    key(g, lbl, DEMO_W / 2, 82, 'K', k > 0.08 && k < 0.2);
    lbl(DEMO_W / 2, 12, 'BUMP: OFF THE EDGE', CREAM);
  },

  // ---------- CROAKED (a green brick maze on black water)
  'croak.pick': (g, t, lbl) => {
    maze(g, [[2, 2, 120, 4], [2, 84, 120, 4], [2, 2, 4, 86], [118, 2, 4, 86]]);
    const left = ph(t, 3.4) < 0.5;
    panel(g, 10, 22, 50, 20, left ? GOLD : 0x3a6a3a, 0x2e6a3a);
    panel(g, 64, 22, 50, 20, !left ? GOLD : 0x3a4a8a, 0x2a4a7a);
    lbl(35, 32, 'BIG FROG', CREAM);
    lbl(89, 32, 'SURVIVOR', CREAM);
    bigFrog(g, 35, 56, t, 1);
    tadpole(g, 89, 56, t, 1);
    lbl(35, 70, 'YOU HUNT', GREEN);
    lbl(89, 70, 'YOU RUN', 0x8ab0ff);
    lbl(DEMO_W / 2, 12, 'PICK A SIDE', GOLD);
  },
  'croak.hunt': (g, t, lbl) => {
    maze(g, [[2, 20, 120, 6], [2, 64, 120, 6], [34, 42, 56, 6]]);
    // it is quicker than you: corner it
    const k = ph(t, 3.5);
    const tx = 16 + k * 92;
    tadpole(g, tx, 34, t, 1);
    bigFrog(g, Math.max(10, tx - 26 + k * 10), 34, t, 1);
    lbl(DEMO_W / 2, 10, 'CATCH THE TADPOLE', CREAM);
    lbl(DEMO_W / 2, 80, 'IT IS QUICKER: CORNER IT', GOLD);
  },
  'croak.trap': (g, t, lbl) => {
    maze(g, [[2, 26, 120, 6], [2, 58, 120, 6]]);
    const k = ph(t, 4);
    // the frog drops a snare and backs off; the tadpole swims in and is held
    const trapOn = k > 0.12;
    if (trapOn) {
      g.lineStyle(1, 0xc8a050, k < 0.8 ? 1 : 0.4).strokeCircle(70, 45, 4);
      g.lineStyle(1, 0xc8a050, 0.5).strokeCircle(70, 45, 6);
    }
    const tx = k < 0.55 ? 120 - seg(k, 0.25, 0.55) * 50 : 70;
    tadpole(g, tx, 45, t, -1, k >= 0.55);
    if (k >= 0.55) g.lineStyle(1, 0xf0d060, 1).strokeCircle(70, 45, 3 + (1 - seg(k, 0.55, 1)) * 8);
    bigFrog(g, k < 0.12 ? 70 : k < 0.55 ? 70 - seg(k, 0.12, 0.3) * 30 : 40 + seg(k, 0.6, 0.9) * 26, 45, t, k < 0.55 ? -1 : 1);
    key(g, lbl, 16, 14, 'SPC', k < 0.14, 17);
    lbl(DEMO_W / 2 + 14, 14, 'DROP A TRAP', CREAM);
    lbl(DEMO_W / 2, 78, k >= 0.55 ? 'STUCK - GRAB IT!' : 'IT SWIMS IN...', GOLD);
  },
  'croak.survive': (g, t, lbl) => {
    maze(g, [[2, 30, 120, 6], [2, 56, 120, 6]]);
    // you are quicker: eat every fly, mind the faint rings
    const k = ph(t, 3.2);
    const tx = 12 + k * 100;
    for (let i = 0; i < 10; i++) {
      const fx = 14 + i * 10;
      if (fx > tx + 2) {
        glow(g, fx, 46, 2.5, 0xd8e8ff, 0.4);
        g.fillStyle(0xd8e8ff, 1).fillRect(fx, 45, 2, 2);
      }
    }
    g.lineStyle(1, 0xc8a050, 0.35 + 0.15 * Math.sin(t * 4)).strokeCircle(96, 46, 4);
    tadpole(g, tx, 46, t, 1);
    bigFrog(g, tx - 34, 46, t, 1);
    lbl(DEMO_W / 2, 14, 'EAT EVERY FLY', CREAM);
    lbl(DEMO_W / 2, 76, 'A FAINT RING IS A TRAP', RED);
  },
  'croak.steer': (g, t, lbl) => {
    maze(g, [[2, 2, 120, 4], [10, 30, 46, 30], [70, 30, 44, 30], [2, 84, 120, 4]]);
    // press a way early and you turn at the next gap
    const k = ph(t, 3);
    const x = k < 0.5 ? 14 + k * 104 : 63;
    const y = k < 0.5 ? 18 : 18 + (k - 0.5) * 110;
    bigFrog(g, x, Math.min(y, 72), t, k < 0.5 ? 1 : 1);
    key(g, lbl, 100, 74, 'S', k > 0.2 && k < 0.55);
    if (k > 0.2 && k < 0.5) lbl(100, 64, 'EARLY', GOLD);
    lbl(40, 72, 'TURNS AT THE GAP', CREAM);
  },

  // ---------- THE CRANES (the claw machine and the Oddity Crane)
  ...craneDemos(false),
  ...craneDemos(true),

  // ---------- CREATURE CLASH (the hub's HOW TO PLAY)
  'clash.move': (g, t, lbl) => {
    arena(g, t);
    // move with W A S D; aim with the mouse; fire
    const x = 30 + Math.sin(t * 1.2) * 12;
    const y = 46 + Math.cos(t * 1.7) * 14;
    critter(g, x, y, t, 0xe8642a, 1);
    critter(g, 98, 46, t, 0x3a8ad8, -1);
    hp(g, 98, 34, 0.8);
    const k = ph(t, 1.4);
    const sx = lerp(x + 6, 92, k);
    const sy = lerp(y, 46, k);
    glow(g, sx, sy, 4, 0xffb060, 0.8);
    g.fillStyle(0xffe0a0, 1).fillCircle(sx, sy, 1.6);
    cursor(g, 96, 40, k < 0.15);
    lbl(DEMO_W / 2, 84, 'MOVE, AIM, FIRE', CREAM);
  },
  'clash.moves': (g, t, lbl) => {
    arena(g, t, false);
    // three moves: a plain attack and two specials, each on its cooldown
    const k = ph(t, 4);
    critter(g, 30, 36, t, 0xe8642a, 1);
    const used = Math.floor(k * 3);
    for (let i = 0; i < 3; i++) {
      const since = k * 3 - i;
      const cd = i <= used ? clamp01((since - 0.05) * (i === 0 ? 3 : 0.9)) : 1;
      moveBtn(g, 30 + i * 32, 66, i < used || (i === used && since > 0.05) ? cd : 1, [0xffb060, 0x8ae86a, 0x8ab0ff][i], i === used);
      lbl(30 + i * 32, 80, ['ATTACK', 'SPECIAL', 'SPECIAL'][i], i === 0 ? CREAM : GOLD);
    }
    lbl(80, 30, 'THE RING FILLS', CREAM);
    lbl(80, 40, 'BACK UP: READY', GOLD);
  },
  'clash.stats': (g, t, lbl) => {
    grad(g, 0x1a1830, 0x0e0c1e);
    panel(g, 6, 6, 112, 78, GOLD, 0x141228);
    critter(g, 26, 30, t, 0xe8642a, 1);
    const rows: Array<[string, number, number]> = [['HP', 0.7, GREEN], ['ATTACK', 0.8, ORANGE], ['DEFENCE', 0.4, BLUE], ['SPEED', 0.6, TEAL]];
    const hi = Math.floor(ph(t, 8) * 4);
    rows.forEach(([name, v, col], i) => {
      const y = 16 + i * 12;
      lbl(66, y, name, i === hi ? GOLD : CREAM);
      bar(g, 84, y - 2, 28, v, col);
    });
    const words = ['HOW MUCH IT CAN TAKE', 'HOW HARD IT HITS', 'HOW WELL IT LASTS', 'HOW FAST IT MOVES'];
    lbl(DEMO_W / 2, 66, words[hi], GOLD);
    lbl(DEMO_W / 2, 76, 'MELEE: CLOSE  RANGED: FAR', CREAM);
  },
  'clash.elements': (g, t, lbl) => {
    grad(g, 0x1a1830, 0x0e0c1e);
    const els: Array<[string, number, string]> = [
      ['EMBER', 0xe8642a, 'SETS THEM ALIGHT'],
      ['TIDE', 0x3a8ad8, 'KNOCKS THEM BACK'],
      ['MOSS', 0x5aa83a, 'HEALS YOU A LITTLE'],
      ['FROST', 0x8adcf0, 'SLOWS THEM FOR 2S'],
      ['VOLT', 0xf0d030, 'STUNS THEM BRIEFLY'],
      ['STONE', 0x9a8a70, 'TAKES 15% LESS'],
      ['GALE', 0xb8e8c8, 'A HIT SPEEDS YOU UP'],
      ['MURK', 0x7a4a9a, 'CLOUDS THEIR SIGHT'],
      ['GLOW', 0xf0e8c0, 'SHOTS GO THROUGH COVER'],
    ];
    const i = Math.floor(ph(t, 18) * 9);
    const [name, col, what] = els[i];
    critter(g, DEMO_W / 2, 36, t, col, 1);
    glow(g, DEMO_W / 2, 36, 12, col, 0.4);
    for (let j = 0; j < 9; j++) g.fillStyle(els[j][1], j === i ? 1 : 0.35).fillCircle(22 + j * 10, 10, j === i ? 3.5 : 2.5);
    lbl(DEMO_W / 2, 58, name, col);
    lbl(DEMO_W / 2, 70, what, CREAM);
    lbl(DEMO_W / 2, 82, 'EVERY ELEMENT HAS ITS EDGE', GREY);
  },
  'clash.debuffs': (g, t, lbl) => {
    arena(g, t, false);
    // what you can do to them: for a while
    const list: Array<[string, number, string]> = [
      ['POISON', 0x8ae86a, 'DAMAGE EVERY SECOND'],
      ['BURN', 0xff7a3a, 'DAMAGE EVERY SECOND'],
      ['SLOW', 0x8adcf0, 'HALF SPEED'],
      ['HOLD', 0xc8a050, 'CANNOT MOVE'],
      ['SILENCE', 0xb8a0ff, 'MOVES BACK ON COOLDOWN'],
      ['WEAKEN', 0xa8a8b8, 'ITS HITS ARE SOFTER'],
      ['SHRED', 0xff5a8a, 'IT TAKES MORE DAMAGE'],
    ];
    const i = Math.floor(ph(t, 14) * 7);
    const [name, col, what] = list[i];
    const k = ph(t, 2);
    critter(g, DEMO_W / 2, 40, t, 0x3a8ad8, -1, Math.sin(t * 12) > 0.6 && i < 2);
    for (let j = 0; j < 5; j++) g.fillStyle(col, 0.7).fillCircle(DEMO_W / 2 + Math.sin(t * 3 + j * 1.3) * 9, 40 - ((t * 10 + j * 4) % 16), 1.2);
    if (i === 3) g.lineStyle(1, col, 1).strokeCircle(DEMO_W / 2, 44, 9);
    if (i < 2) lbl(DEMO_W / 2 + 10, 26 - k * 6, '-3', RED);
    hp(g, DEMO_W / 2, 26, 0.7 - (i < 2 ? k * 0.1 : 0));
    lbl(DEMO_W / 2, 10, 'DEBUFFS: ON THEM', RED);
    lbl(DEMO_W / 2, 64, name, col);
    lbl(DEMO_W / 2, 76, what, CREAM);
  },
  'clash.buffs': (g, t, lbl) => {
    arena(g, t, false);
    // what helps you: a few seconds of an edge
    const list: Array<[string, number, string]> = [
      ['HASTE', 0x9aff9a, 'YOU MOVE FASTER'],
      ['GUARD', 0xffffff, 'BLOCKS THE NEXT HIT'],
      ['REGROW', 0x8ae86a, 'HEALS EVERY SECOND'],
      ['EVASION', 0xb8e8ff, '30% OF HITS MISS'],
      ['FOCUS', 0xffe060, '+20% CHANCE TO CRIT'],
      ['FURY', 0xff7a4a, 'HITS DEAL +25%'],
      ['QUICKEN', 0x9aff9a, 'COOLDOWNS 40% FASTER'],
    ];
    const i = Math.floor(ph(t, 14) * 7);
    const [name, col, what] = list[i];
    const k = ph(t, 2);
    const x = DEMO_W / 2 + (i === 0 ? Math.sin(t * 4) * 20 : 0);
    critter(g, x, 40, t, 0xe8642a, 1);
    g.lineStyle(1, col, 1 - k).strokeCircle(x, 40, 8 + k * 10);
    if (i === 3 && k > 0.5) lbl(x + 14, 30, 'MISS', col);
    if (i === 1) g.lineStyle(1, col, 0.8).strokeCircle(x, 40, 10);
    lbl(x, 24 - k * 4, name, col);
    lbl(DEMO_W / 2, 10, 'BUFFS: ON YOU', GREEN);
    lbl(DEMO_W / 2, 64, what, CREAM);
    lbl(DEMO_W / 2, 76, 'ITS NAME SHOWS OVER YOU', GREY);
  },
  'clash.cover': (g, t, lbl) => {
    arena(g, t, true);
    // rocks block shots; a lob flies over
    critter(g, 24, 24, t, 0xe8642a, 1);
    critter(g, 100, 24, t, 0x3a8ad8, -1);
    const k = ph(t, 2);
    const sx = lerp(30, 58, k);
    if (k < 0.95) {
      glow(g, sx, 24, 3, 0xffb060, 0.8);
      g.fillStyle(0xffe0a0, 1).fillCircle(sx, 24, 1.5);
    } else burst(g, 56, 24, 6, 0xa8a294);
    critter(g, 24, 62, t, 0x8ae86a, 1);
    critter(g, 100, 62, t, 0x3a8ad8, -1);
    const lx = lerp(30, 96, k);
    const ly = 62 - Math.sin(k * Math.PI) * 26;
    g.fillStyle(0x8ae86a, 1).fillCircle(lx, ly, 2);
    lbl(DEMO_W / 2, 6, 'COVER STOPS SHOTS', CREAM);
    lbl(DEMO_W / 2, 84, 'A LOB GOES OVER', GOLD);
  },
  'clash.story': (g, t, lbl) => {
    grad(g, 0x1a1830, 0x0e0c1e);
    // five worlds, four battles and a boss each; then the Ladder
    const cols = [0x5aa83a, 0x3a8ad8, 0xe8642a, 0x8adcf0, 0x7a4a9a];
    const at = Math.floor(ph(t, 10) * 5);
    for (let i = 0; i < 5; i++) {
      const x = 14 + i * 24;
      const y = 40 + Math.sin(i * 1.7) * 10;
      if (i < 4) g.lineStyle(1, i < at ? GOLD : 0x3a3a58, 1).lineBetween(x, y, x + 24, 40 + Math.sin((i + 1) * 1.7) * 10);
      if (i === at) glow(g, x, y, 9, cols[i], 0.8);
      g.fillStyle(shade(cols[i], 0.5), 1).fillCircle(x, y, 7);
      g.fillStyle(cols[i], i <= at ? 1 : 0.4).fillCircle(x, y, 6);
      lbl(x, y, String(i + 1), INK);
    }
    lbl(DEMO_W / 2, 10, 'STORY: FIVE WORLDS', GOLD);
    lbl(DEMO_W / 2, 64, '4 BATTLES AND A BOSS EACH', CREAM);
    lbl(DEMO_W / 2, 74, 'WINS PAY TOKENS AND XP', CREAM);
    lbl(DEMO_W / 2, 84, 'THEN THE LADDER OPENS', GREY);
  },
  'clash.keys': (g, t, lbl) => {
    arena(g, t, false);
    // J K L fire at the foe; 1 2 3 at the mouse
    const i = Math.floor(ph(t, 3) * 3);
    ['J', 'K', 'L'].forEach((k, j) => key(g, lbl, 28 + j * 16, 16, k, j === i));
    ['1', '2', '3'].forEach((k, j) => key(g, lbl, 76 + j * 16, 16, k, j === i));
    lbl(44, 28, 'AT THE FOE', CREAM);
    lbl(92, 36, 'AT THE MOUSE', CREAM);
    critter(g, 30, 60, t, 0xe8642a, 1);
    critter(g, 96, 60, t, 0x3a8ad8, -1);
    const k = ph(t, 1);
    g.fillStyle([0xffb060, 0x8ae86a, 0x8ab0ff][i], 1).fillCircle(lerp(36, 90, k), 60, 2);
    lbl(DEMO_W / 2, 84, 'W A S D MOVES', GOLD);
  },

  // ---------- anything without a picture of its own
  default: (g, t, lbl) => {
    grad(g, 0x1a1430, 0x0e0a1e);
    frog(g, DEMO_W / 2, 48 + Math.sin(t * 3) * 3, 2);
    lbl(DEMO_W / 2, 82, '', CREAM);
  },
};

/** The four steps of a crane, each its own picture: the plush one, or the Oddity's capsules. */
function craneDemos(oddity: boolean): Record<string, Demo> {
  const p = oddity ? 'oddity' : 'crane';
  const thing = oddity ? 'CAPSULE' : 'PLUSH';
  return {
    [`${p}.line`]: (g, t, lbl) => {
      craneBox(g, oddity);
      // from the front: line the claw up over one
      const k = ph(t, 3);
      const x = lerp(30, 70, ease(seg(k, 0.1, 0.7)));
      claw(g, x, 20, 1);
      g.lineStyle(1, GOLD, 0.4).lineBetween(x, 26, x, 74);
      key(g, lbl, 96, 16, 'A', false);
      key(g, lbl, 110, 16, 'D', k > 0.1 && k < 0.7);
      lbl(DEMO_W / 2, 7, 'FRONT VIEW: LINE IT UP', CREAM);
    },
    [`${p}.depth`]: (g, t, lbl) => {
      craneBox(g, oddity);
      // the side view: check how deep it is before you drop
      const k = ph(t, 3);
      const side = k > 0.3;
      if (side) {
        g.fillStyle(0x000000, 0.4).fillRect(6, 8, 112, 80);
        for (let i = 0; i < 5; i++) prize(g, 30 + i * 16, 78 - (i % 2) * 6, oddity, i);
        const z = lerp(26, 62, ease(seg(k, 0.35, 0.8)));
        claw(g, z, 20, 1);
        lbl(DEMO_W / 2, 7, 'SIDE VIEW: HOW DEEP?', GOLD);
      } else {
        claw(g, 62, 20, 1);
        lbl(DEMO_W / 2, 7, 'SPACE: SIDE VIEW', CREAM);
      }
      key(g, lbl, 104, 16, 'SPC', k > 0.26 && k < 0.34, 17);
    },
    [`${p}.drop`]: (g, t, lbl) => {
      craneBox(g, oddity);
      // drop; grab on the way down or once it settles -- the middle grips best
      const k = ph(t, 3.6);
      const down = ease(seg(k, 0.05, 0.45));
      const up = ease(seg(k, 0.6, 0.95));
      const y = 20 + down * 52 - up * 52;
      const shut = k > 0.48;
      claw(g, 64, y, shut ? 0.1 : 1);
      if (shut) prize(g, 64, y + 9, oddity, 1);
      if (k > 0.45 && k < 0.6) lbl(DEMO_W / 2, 46, 'GRAB!', GOLD);
      key(g, lbl, 104, 16, 'SPC', (k > 0.04 && k < 0.1) || (k > 0.45 && k < 0.5), 17);
      lbl(DEMO_W / 2, 7, oddity ? 'GRAB IT: 4 IN 5 HOLD' : 'THE MIDDLE GRIPS BEST', CREAM);
    },
    [`${p}.win`]: (g, t, lbl) => {
      craneBox(g, oddity);
      // over to the chute, let go: it is yours
      const k = ph(t, 3);
      const x = lerp(64, 19, ease(seg(k, 0, 0.45)));
      const drop = seg(k, 0.5, 0.75);
      claw(g, x, 20, k > 0.5 ? 1 : 0.1);
      if (k < 0.5) prize(g, x, 29, oddity, 1);
      else if (drop < 1) prize(g, 19, lerp(29, 76, drop), oddity, 1);
      if (k > 0.75) {
        glow(g, 19, 74, 10, GOLD, 0.7);
        lbl(70, 46, oddity ? 'TOKENS INSIDE!' : 'A NEW TOY!', GOLD);
        lbl(70, 56, 'INTO YOUR POCKETS', CREAM);
      }
      lbl(DEMO_W / 2, 7, `DROP THE ${thing} DOWN THE CHUTE`, CREAM);
    },
  };
}

/** The picture for `id`, or the default one. */
export const demoFor = (id: string): Demo => DEMOS[id] ?? DEMOS.default;
