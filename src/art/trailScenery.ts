/**
 * ---- THE SCENERY ALONG EACH WORLD'S TRAIL (Creature Clash story mode).
 *
 * Every world's trail runs over its own ground with its own things beside
 * the path, so no two trails look alike: Mosswood's trees, ferns and
 * toadstools; the Sunken Ruins' broken columns, kelp and bubbles;
 * Emberfall's lava seams, black rocks and embers; the Crystal Depths' shards
 * in two colours; the Void Citadel's floating runes, spires and stars.
 * Placed from a seed (the same every time) and kept off the path and its
 * stops, so nothing sits on a node.
 */

import type Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A small seeded generator: the same scenery every time a trail is drawn. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How near (x, y) comes to the trail: its stops and the straight legs between them. */
function nearPath(x: number, y: number, pts: Array<[number, number]>): number {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    best = Math.min(best, Math.hypot(x - pts[i][0], y - pts[i][1]) - 6);
    if (i + 1 < pts.length) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t)));
    }
  }
  return best;
}

/** Spots for scenery inside `box`, at least `clear` from the trail, back to front. */
function spots(box: Box, pts: Array<[number, number]>, n: number, clear: number, r: () => number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let tries = 0; out.length < n && tries < n * 30; tries++) {
    const x = box.x + 6 + r() * (box.w - 12);
    const y = box.y + 8 + r() * (box.h - 12);
    if (nearPath(x, y, pts) < clear) continue;
    if (out.some(([ox, oy]) => Math.hypot(ox - x, oy - y) < 10)) continue;
    out.push([x, y]);
  }
  return out.sort((a, b) => a[1] - b[1]);
}

function mosswood(g: G, box: Box, pts: Array<[number, number]>, r: () => number): void {
  for (const [x, y] of spots(box, pts, 22, 15, r)) {
    const k = r();
    if (k < 0.5) {
      // a tree: trunk, three blobs of canopy, a lit top
      const s = 0.8 + r() * 0.5;
      g.fillStyle(0x000000, 0.35).fillEllipse(x, y + 1, 14 * s, 4);
      g.fillStyle(0x4a3420, 1).fillRect(x - 1.5 * s, y - 6 * s, 3 * s, 7 * s);
      g.fillStyle(0x1f4a24, 1).fillCircle(x - 4 * s, y - 9 * s, 5 * s).fillCircle(x + 4 * s, y - 9 * s, 5 * s);
      g.fillStyle(0x2c6a30, 1).fillCircle(x, y - 13 * s, 6 * s);
      g.fillStyle(0x4c9a44, 0.8).fillCircle(x - 1.5 * s, y - 15 * s, 2.5 * s);
    } else if (k < 0.8) {
      // a fern
      g.fillStyle(0x3a7a34, 1);
      for (const a of [-0.9, -0.4, 0, 0.4, 0.9]) g.fillTriangle(x, y, x + Math.sin(a) * 7, y - Math.cos(a) * 7, x + Math.sin(a) * 7 + 1.5, y - Math.cos(a) * 7 + 1);
    } else {
      // a toadstool
      g.fillStyle(0xe8dcc0, 1).fillRect(x - 1, y - 4, 2, 4);
      g.fillStyle(0xc83a2a, 1).fillEllipse(x, y - 4, 8, 4);
      g.fillStyle(0xffffff, 1).fillRect(x - 2, y - 5, 1, 1).fillRect(x + 1, y - 4.5, 1, 1);
    }
  }
}

function sunken(g: G, box: Box, pts: Array<[number, number]>, r: () => number): void {
  // light from the surface, in slanting bands
  for (let i = 0; i < 4; i++) g.fillStyle(0x9adcf0, 0.05).fillTriangle(box.x + 20 + i * 48, box.y, box.x + 44 + i * 48, box.y, box.x + 4 + i * 48, box.y + box.h);
  for (const [x, y] of spots(box, pts, 18, 15, r)) {
    const k = r();
    if (k < 0.4) {
      // a broken column, fallen or standing
      const h = 8 + r() * 10;
      g.fillStyle(0x000000, 0.35).fillEllipse(x, y + 1, 12, 3);
      g.fillStyle(0x8a9aa0, 1).fillRect(x - 3, y - h, 6, h);
      g.fillStyle(0xb0c0c4, 1).fillRect(x - 3, y - h, 2, h);
      g.fillStyle(0x6a7a80, 1).fillRect(x - 4, y - 2, 8, 2).fillTriangle(x - 3, y - h, x + 3, y - h, x + 1, y - h - 3);
    } else if (k < 0.75) {
      // kelp, swaying
      g.lineStyle(1.5, 0x2e7a5a, 1);
      for (let j = -1; j <= 1; j++) g.lineBetween(x + j * 2, y, x + j * 2 + Math.sin(j + x) * 3, y - 10 - r() * 6);
    } else {
      // bubbles rising
      g.lineStyle(1, 0xc8f0ff, 0.6);
      for (let j = 0; j < 3; j++) g.strokeCircle(x + j * 2, y - j * 5, 1 + j * 0.5);
    }
  }
}

function emberfall(g: G, box: Box, pts: Array<[number, number]>, r: () => number): void {
  // seams of lava across the ground
  for (let i = 0; i < 5; i++) {
    let x = box.x + r() * box.w;
    let y = box.y + r() * box.h;
    g.lineStyle(1.5, 0xff6a1a, 0.7);
    g.beginPath();
    g.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x = Math.max(box.x + 2, Math.min(box.x + box.w - 2, x + (r() - 0.5) * 24));
      y = Math.max(box.y + 2, Math.min(box.y + box.h - 2, y + (r() - 0.3) * 14));
      g.lineTo(x, y);
    }
    g.strokePath();
  }
  for (const [x, y] of spots(box, pts, 18, 14, r)) {
    const k = r();
    if (k < 0.55) {
      // a black rock with a hot edge
      const s = 0.7 + r() * 0.6;
      g.fillStyle(0x000000, 0.35).fillEllipse(x, y + 1, 12 * s, 3);
      g.fillStyle(0x2a1e1c, 1).fillTriangle(x - 6 * s, y, x + 6 * s, y, x + 1 * s, y - 9 * s);
      g.fillStyle(0xff8a2a, 0.8).fillTriangle(x + 1 * s, y - 9 * s, x + 6 * s, y, x + 3 * s, y);
    } else {
      // embers in the air
      g.fillStyle(0xffc04a, 0.9).fillRect(x, y - 4, 1, 1).fillRect(x + 3, y - 8, 1, 1);
      g.fillStyle(0xff6a1a, 0.8).fillRect(x - 2, y - 11, 1, 1);
    }
  }
}

function crystal(g: G, box: Box, pts: Array<[number, number]>, r: () => number): void {
  for (const [x, y] of spots(box, pts, 20, 14, r)) {
    // a cluster of shards, cyan or violet, each lit on one face
    const violet = r() < 0.45;
    const base = violet ? 0x8a5ad8 : 0x4ad0e8;
    const lit = violet ? 0xd8b8ff : 0xc8f8ff;
    g.fillStyle(0x000000, 0.35).fillEllipse(x, y + 1, 12, 3);
    for (const [dx, h, lean] of [[-3, 7, -2], [0, 12, 0], [3, 8, 2]] as const) {
      const hh = h * (0.7 + r() * 0.5);
      g.fillStyle(base, 0.95).fillTriangle(x + dx - 2, y, x + dx + 2, y, x + dx + lean, y - hh);
      g.fillStyle(lit, 0.7).fillTriangle(x + dx - 2, y, x + dx, y, x + dx + lean, y - hh);
    }
    g.fillStyle(lit, 0.9).fillRect(x, y - 13, 1, 1);
  }
}

function voidCitadel(g: G, box: Box, pts: Array<[number, number]>, r: () => number): void {
  // stars in the dark
  for (let i = 0; i < 40; i++) g.fillStyle(0xd8c8ff, 0.3 + r() * 0.5).fillRect(box.x + r() * box.w, box.y + r() * box.h, 1, 1);
  for (const [x, y] of spots(box, pts, 14, 15, r)) {
    const k = r();
    if (k < 0.45) {
      // a dark spire
      const h = 10 + r() * 12;
      g.fillStyle(0x000000, 0.4).fillEllipse(x, y + 1, 10, 3);
      g.fillStyle(0x1a1030, 1).fillTriangle(x - 4, y, x + 4, y, x, y - h);
      g.fillStyle(0x5a3a9a, 0.8).fillTriangle(x, y - h, x + 4, y, x + 1, y);
      g.fillStyle(0xb88aff, 1).fillRect(x - 0.5, y - h * 0.6, 1, 2);
    } else {
      // a floating rune: a ring and a cross-stroke, glowing
      g.lineStyle(1, 0xb88aff, 0.8).strokeCircle(x, y - 6, 3.5);
      g.lineBetween(x - 2, y - 8, x + 2, y - 4).lineBetween(x, y - 10, x, y - 2);
      g.fillStyle(0xb88aff, 0.15).fillCircle(x, y - 6, 6);
    }
  }
}

const PAINT = [mosswood, sunken, emberfall, crystal, voidCitadel];

/** World `w`'s scenery, inside `box`, kept off the trail `pts`. */
export function paintTrailScenery(g: G, w: number, box: Box, pts: Array<[number, number]>): void {
  (PAINT[w] ?? mosswood)(g, box, pts, rng(9173 + w * 7919));
}
