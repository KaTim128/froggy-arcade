/**
 * ---- THE GROUND EACH CLASH IS FOUGHT ON (log #42: themed arenas).
 *
 * Every world gets a floor of its own rather than one colour with darker
 * blobs on it: flagstones and crystal in the caves, grass and flowers in the
 * fields, leaf litter and roots in the Deepwood, drifts and ice sheets on the
 * pass, mud and pools in the mire, a tiled court round a mosaic in the ruins
 * -- with the hull of a sunken ship breaking through it -- sand and surf on
 * the shore, dunes and glass in the desert, basalt split by glowing lava on
 * the peak.
 *
 * It is decoration only.  The SET PIECES (the ship, the surf, the stalagmites)
 * keep to the edges of the floor, so nothing here changes where anyone can
 * walk or shoot: the cover is laid and collided by the arena as before.
 *
 * The same painter draws the little landscape on each zone's tile in the hub,
 * so a world looks the same on the map as it does in the ring.
 */

import Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;
type Rnd = { frac(): number; between(a: number, b: number): number };

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A colour moved toward white (k > 0) or black (k < 0). */
export function shade(c: number, k: number): number {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  const t = k > 0 ? 255 : 0;
  const a = Math.abs(k);
  return (Math.round(r + (t - r) * a) << 16) | (Math.round(g + (t - g) * a) << 8) | Math.round(b + (t - b) * a);
}

const at = (r: Rnd, b: Box, pad = 2): [number, number] => [b.x + pad + r.frac() * (b.w - pad * 2), b.y + pad + r.frac() * (b.h - pad * 2)];
const speckle = (g: G, r: Rnd, b: Box, n: number, cols: number[], a = 1, size = 1): void => {
  for (let i = 0; i < n; i++) {
    const [x, y] = at(r, b, 1);
    g.fillStyle(cols[i % cols.length], a).fillRect(Math.floor(x), Math.floor(y), size, size);
  }
};

function caves(g: G, r: Rnd, b: Box, ground: number, dark: number, s: number): void {
  // flagstones, cracked, in uneven courses
  const row = 14 * s;
  for (let y = b.y, k = 0; y < b.y + b.h; y += row, k++) {
    let x = b.x - (k % 2 ? 9 * s : 0);
    while (x < b.x + b.w) {
      const w = (14 + r.frac() * 14) * s;
      g.fillStyle(shade(ground, (r.frac() - 0.5) * 0.12), 1).fillRect(x, y, w, row);
      g.fillStyle(dark, 0.6).fillRect(x, y, w, 1).fillRect(x, y, 1, row);
      g.fillStyle(shade(ground, 0.12), 0.5).fillRect(x + 1, y + 1, w - 2, 1);
      if (r.frac() < 0.3) g.lineStyle(1, dark, 0.5).lineBetween(x + w * 0.3, y + 2, x + w * 0.5, y + row - 2);
      x += w;
    }
  }
  speckle(g, r, b, 160 * s, [dark, shade(ground, 0.15)], 0.5);
  // crystals glinting in the corners, stalagmites along the far wall
  for (let i = 0; i < 6 * s; i++) {
    const x = b.x + 6 + r.frac() * (b.w - 12);
    const y = b.y + 2 + (i % 2 ? 0 : b.h - 10 * s);
    g.fillStyle(0x2a2430, 1).fillTriangle(x - 4 * s, y + 8 * s, x + 4 * s, y + 8 * s, x, y - 2 * s);
    g.fillStyle(0x4a4450, 1).fillTriangle(x - 1 * s, y + 8 * s, x + 3 * s, y + 8 * s, x, y);
  }
  for (let i = 0; i < 5; i++) {
    const [x, y] = at(r, b, 8);
    g.fillStyle(0x8a6ae0, 0.25).fillCircle(x, y, 5 * s);
    g.fillStyle(0xb89aff, 1).fillTriangle(x - 2 * s, y + 2 * s, x + 2 * s, y + 2 * s, x, y - 4 * s);
    g.fillStyle(0xffffff, 0.8).fillRect(x, y - 2 * s, 1, 1);
  }
}

function fields(g: G, r: Rnd, b: Box, ground: number, dark: number, s: number): void {
  // mown stripes, a dirt path across, tufts and flowers
  for (let y = b.y; y < b.y + b.h; y += 10 * s) g.fillStyle(shade(ground, 0.06), 0.6).fillRect(b.x, y, b.w, 5 * s);
  const py = b.y + b.h * 0.62;
  g.fillStyle(0xb89a5a, 0.55).fillRect(b.x, py, b.w, 7 * s);
  g.fillStyle(0x9a7a42, 0.5).fillRect(b.x, py + 6 * s, b.w, 1);
  speckle(g, r, { x: b.x, y: py, w: b.w, h: 7 * s }, 40 * s, [0x8a6a3a, 0xd8c08a], 0.7);
  for (let i = 0; i < 120 * s; i++) {
    const [x, y] = at(r, b);
    g.fillStyle(i % 2 ? dark : shade(ground, 0.25), 1).fillRect(x, y, 1, 2).fillRect(x + 1, y - 1, 1, 2);
  }
  const petals = [0xffffff, 0xffd84a, 0xff8ab8, 0xb8a0ff];
  for (let i = 0; i < 30 * s; i++) {
    const [x, y] = at(r, b);
    g.fillStyle(petals[i % 4], 1).fillRect(x, y, 2, 1).fillRect(x + 0.5, y - 0.5, 1, 2);
  }
}

function forests(g: G, r: Rnd, b: Box, ground: number, dark: number, s: number): void {
  // leaf litter in autumn colours, roots, mushrooms, and light through the canopy
  const leaves = [0x6a4a1a, 0x8a5a1a, 0x4a5a1a, 0x2a3a14];
  for (let i = 0; i < 220 * s; i++) {
    const [x, y] = at(r, b);
    g.fillStyle(leaves[i % 4], 0.8).fillEllipse(x, y, 3 * s, 2 * s);
  }
  for (let i = 0; i < 5; i++) {
    const [x, y] = at(r, b, 6);
    let px = x;
    let py = y;
    g.lineStyle(2 * s, 0x3a2a14, 0.9);
    for (let k = 0; k < 4; k++) {
      const nx = px + (r.frac() * 16 - 4) * s;
      const ny = py + (r.frac() * 8 - 4) * s;
      g.lineBetween(px, py, nx, ny);
      px = nx;
      py = ny;
    }
  }
  for (let i = 0; i < 7; i++) {
    const [x, y] = at(r, b, 4);
    g.fillStyle(0xe8e0c8, 1).fillRect(x, y, 1, 2 * s);
    g.fillStyle(i % 2 ? 0xc83a2a : 0xd8a040, 1).fillEllipse(x + 0.5, y, 4 * s, 2 * s);
  }
  for (let i = 0; i < 8; i++) {
    const [x, y] = at(r, b, 10);
    g.fillStyle(0xd8f0a0, 0.08).fillEllipse(x, y, 30 * s, 14 * s);
  }
  speckle(g, r, b, 60 * s, [dark], 0.4);
  void ground;
}

function frozen(g: G, r: Rnd, b: Box, ground: number, dark: number, s: number): void {
  // drifts with blue shadows on their lee side, glassy ice sheets, footprints
  for (let i = 0; i < 14; i++) {
    const [x, y] = at(r, b, 10);
    const w = (20 + r.frac() * 30) * s;
    g.fillStyle(shade(dark, -0.05), 0.45).fillEllipse(x + 2, y + 3 * s, w, 7 * s);
    g.fillStyle(shade(ground, 0.5), 1).fillEllipse(x, y, w, 6 * s);
  }
  for (let i = 0; i < 5; i++) {
    const [x, y] = at(r, b, 16);
    const w = (24 + r.frac() * 24) * s;
    g.fillStyle(0x9ad0e8, 0.7).fillEllipse(x, y, w, 10 * s);
    g.fillStyle(0xc8ecff, 0.8).fillEllipse(x - 3 * s, y - 2 * s, w * 0.6, 4 * s);
    g.lineStyle(1, 0xffffff, 0.9).lineBetween(x - w * 0.3, y - 1, x - w * 0.1, y - 3 * s);
  }
  for (let i = 0; i < 10; i++) {
    const x = b.x + 20 + i * (b.w - 40) / 10;
    const y = b.y + b.h * 0.3 + Math.sin(i) * 6 * s;
    g.fillStyle(dark, 0.35).fillEllipse(x, y + (i % 2 ? 2 : -2) * s, 2 * s, 3 * s);
  }
  speckle(g, r, b, 90 * s, [0xffffff, dark], 0.6);
}

function swamps(g: G, r: Rnd, b: Box, ground: number, dark: number, s: number): void {
  // wet mud, black pools with lily pads and the odd bubble, reeds round the edge
  speckle(g, r, b, 200 * s, [dark, shade(ground, 0.12)], 0.5, 2);
  for (let i = 0; i < 7; i++) {
    const [x, y] = at(r, b, 14);
    const w = (18 + r.frac() * 26) * s;
    g.fillStyle(0x1a2418, 1).fillEllipse(x, y, w, w * 0.45);
    g.fillStyle(0x2a3a2a, 1).fillEllipse(x - w * 0.1, y - 1, w * 0.7, w * 0.25);
    g.lineStyle(1, 0x5a7a4a, 0.7).strokeEllipse(x, y, w, w * 0.45);
    if (r.frac() < 0.8) {
      g.fillStyle(0x4a8a3a, 1).fillEllipse(x + w * 0.2, y, 6 * s, 3 * s);
      g.fillStyle(0x1a2418, 1).fillRect(x + w * 0.2, y - 1, 1, 1);
    }
    g.lineStyle(1, 0x8aa07a, 0.6).strokeCircle(x - w * 0.2, y, 1.5 * s);
  }
  for (let i = 0; i < 26 * s; i++) {
    const x = b.x + r.frac() * b.w;
    const y = i % 2 ? b.y + 1 + r.frac() * 5 : b.y + b.h - 6 - r.frac() * 5;
    g.lineStyle(1, 0x6a8a4a, 1).lineBetween(x, y + 5 * s, x + (r.frac() - 0.5) * 3, y);
    if (r.frac() < 0.3) g.fillStyle(0x6a4a2a, 1).fillRect(x - 0.5, y - 1, 2, 3);
  }
}

function ruins(g: G, r: Rnd, b: Box, ground: number, dark: number, s: number): void {
  // a court of worn slabs round a mosaic, broken tiles, and the buried ship
  const t = 12 * s;
  for (let y = b.y; y < b.y + b.h; y += t) {
    for (let x = b.x; x < b.x + b.w; x += t) {
      const k = (r.frac() - 0.5) * 0.14;
      g.fillStyle(shade(ground, k), 1).fillRect(x, y, t, t);
      g.fillStyle(dark, 0.55).fillRect(x, y, t, 1).fillRect(x, y, 1, t);
      if (r.frac() < 0.12) g.fillStyle(dark, 0.6).fillTriangle(x + 2, y + 2, x + t - 2, y + 3, x + 4, y + t - 2);
    }
  }
  // the mosaic: a sun in rings, faded
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  g.lineStyle(2 * s, 0x6a8ab0, 0.35).strokeCircle(cx, cy, 26 * s);
  g.lineStyle(1, 0xc8a050, 0.45).strokeCircle(cx, cy, 20 * s).strokeCircle(cx, cy, 10 * s);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.lineStyle(1, 0xc8a050, 0.4).lineBetween(cx + Math.cos(a) * 11 * s, cy + Math.sin(a) * 11 * s, cx + Math.cos(a) * 19 * s, cy + Math.sin(a) * 19 * s);
  }
  // THE SUNKEN SHIP: its hull and ribs breaking up through the floor in the far corner
  const sx = b.x + b.w - 58 * s;
  const sy = b.y + 2 * s;
  g.fillStyle(0x000000, 0.25).fillEllipse(sx + 26 * s, sy + 16 * s, 56 * s, 12 * s);
  g.fillStyle(0x4a3220, 1).fillEllipse(sx + 26 * s, sy + 12 * s, 52 * s, 14 * s);
  g.fillStyle(0x6a4a2a, 1).fillEllipse(sx + 26 * s, sy + 10 * s, 46 * s, 8 * s);
  for (let i = 0; i < 6; i++) {
    const x = sx + (6 + i * 8) * s;
    g.lineStyle(2 * s, 0x3a2414, 1).lineBetween(x, sy + 14 * s, x + 2 * s, sy);
    g.lineStyle(1, 0x8a6a3a, 1).lineBetween(x - 1, sy + 12 * s, x + 1 * s, sy + 1);
  }
  g.lineStyle(2 * s, 0x3a2414, 1).lineBetween(sx + 26 * s, sy + 8 * s, sx + 30 * s, sy - 6 * s);
  g.fillStyle(0x5a8a6a, 0.6).fillRect(sx + 8 * s, sy + 12 * s, 6 * s, 2).fillRect(sx + 34 * s, sy + 13 * s, 8 * s, 2);
  speckle(g, r, b, 60 * s, [0x4a6a4a], 0.6, 2);
}

function shore(g: G, r: Rnd, b: Box, ground: number, dark: number, s: number): void {
  // the surf along the top, wet sand under it, ripples, shells and weed
  const wy = b.y + 10 * s;
  g.fillStyle(0x3a8ac0, 1).fillRect(b.x, b.y, b.w, 8 * s);
  g.fillStyle(0x6ab8e0, 1).fillRect(b.x, b.y + 5 * s, b.w, 3 * s);
  for (let x = b.x; x < b.x + b.w; x += 6 * s) g.fillStyle(0xffffff, 0.9).fillEllipse(x + 3 * s, b.y + 8 * s, 7 * s, 3 * s);
  g.fillStyle(shade(ground, -0.12), 1).fillRect(b.x, wy - 1, b.w, 5 * s);
  for (let y = wy + 10 * s; y < b.y + b.h; y += 8 * s) {
    for (let x = b.x; x < b.x + b.w; x += 10 * s) g.lineStyle(1, dark, 0.35).lineBetween(x, y + Math.sin(x * 0.3) * 1.5, x + 6 * s, y + Math.sin(x * 0.3 + 1) * 1.5);
  }
  const shells = [0xffe8f0, 0xf0b8a0, 0xffffff];
  for (let i = 0; i < 14; i++) {
    const [x, y] = at(r, { ...b, y: wy, h: b.h - (wy - b.y) }, 4);
    g.fillStyle(shells[i % 3], 1).fillTriangle(x - 2 * s, y + 1, x + 2 * s, y + 1, x, y - 2 * s);
  }
  for (let i = 0; i < 6; i++) {
    const [x, y] = at(r, b, 6);
    g.lineStyle(1, 0x4a7a3a, 1).lineBetween(x, y, x + 4 * s, y - 2).lineBetween(x + 4 * s, y - 2, x + 7 * s, y + 1);
  }
  speckle(g, r, b, 120 * s, [dark, 0xfff4d0], 0.5);
}

function desert(g: G, r: Rnd, b: Box, ground: number, dark: number, s: number): void {
  // wind-laid dunes, a cracked pan, and glass that catches the light
  for (let i = 0; i < 9; i++) {
    const y = b.y + (i + 0.5) * (b.h / 9);
    g.lineStyle(2 * s, shade(ground, 0.15), 0.7);
    g.beginPath();
    for (let x = b.x; x <= b.x + b.w; x += 4) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 3 * s);
    g.strokePath();
    g.lineStyle(1, dark, 0.35);
    g.beginPath();
    for (let x = b.x; x <= b.x + b.w; x += 4) g.lineTo(x, y + 2 * s + Math.sin(x * 0.05 + i) * 3 * s);
    g.strokePath();
  }
  const px = b.x + b.w * 0.22;
  const py = b.y + b.h * 0.7;
  g.fillStyle(shade(ground, 0.2), 1).fillEllipse(px, py, 50 * s, 18 * s);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.lineStyle(1, dark, 0.6).lineBetween(px, py, px + Math.cos(a) * 22 * s, py + Math.sin(a) * 8 * s);
  }
  for (let i = 0; i < 18; i++) {
    const [x, y] = at(r, b, 4);
    g.fillStyle(0xbfe8ff, 0.9).fillTriangle(x, y, x + 3 * s, y + 1, x + 1, y + 3 * s);
    g.fillStyle(0xffffff, 1).fillRect(x + 1, y + 1, 1, 1);
  }
  speckle(g, r, b, 100 * s, [dark, 0xfff0c0], 0.45);
}

function volcano(g: G, r: Rnd, b: Box, ground: number, dark: number, s: number): void {
  // basalt plates split by lava that glows, ash drifts, and cinders
  speckle(g, r, b, 160 * s, [dark, shade(ground, 0.1)], 0.6, 2);
  for (let i = 0; i < 9; i++) {
    let [x, y] = at(r, b, 6);
    for (let k = 0; k < 5; k++) {
      const nx = x + (r.frac() * 22 - 8) * s;
      const ny = y + (r.frac() * 14 - 7) * s;
      g.lineStyle(4 * s, 0xff5a1a, 0.18).lineBetween(x, y, nx, ny);
      g.lineStyle(2 * s, 0xff7a2a, 0.9).lineBetween(x, y, nx, ny);
      g.lineStyle(1, 0xffd060, 1).lineBetween(x, y, nx, ny);
      x = nx;
      y = ny;
    }
  }
  for (let i = 0; i < 8; i++) {
    const [x, y] = at(r, b, 10);
    g.fillStyle(0x8a8080, 0.18).fillEllipse(x, y, 26 * s, 8 * s);
  }
  speckle(g, r, b, 30 * s, [0xffa040], 0.9);
}

const PAINT: Record<string, (g: G, r: Rnd, b: Box, ground: number, dark: number, s: number) => void> = {
  caves, fields, forests, frozen, swamps, ruins, shore, desert, volcano,
};

/**
 * Paint world `id`'s floor into the box.  `s` scales the detail down for a
 * thumbnail (1 = the arena).  An unknown world just gets its plain ground.
 */
export function paintFloor(g: G, id: string, box: Box, ground: number, dark: number, seed: string, s = 1): void {
  const r = new Phaser.Math.RandomDataGenerator([seed]);
  g.fillStyle(ground, 1).fillRect(box.x, box.y, box.w, box.h);
  PAINT[id]?.(g, r, box, ground, dark, s);
}
