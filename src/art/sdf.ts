/**
 * ---- ONE SKIN, NOT A PILE OF SHAPES.  A creature is described as parts --
 * circles, ellipses, tapered limbs, rounded boxes, triangles -- but it is
 * never drawn as them.  Each pixel asks how far it is from the whole body,
 * where the parts are joined by a SMOOTH union (`smin`: a fillet grows where
 * they meet, so a leg grows out of a body instead of being stuck on it),
 * and the answer is drawn as one silhouette:
 *
 *   - inside or outside, per pixel: no part pokes out on its own, nothing
 *     floats unless it was meant to (a separate `group`, like a halo)
 *   - ONE outline, round the whole silhouette (and between groups)
 *   - light from the top left, worked out from the shape of the whole body
 *     (its distance field's slope) -- so shading flows across the joins
 *   - details (eyes, stripes, spots) are DECALS: drawn only where there is
 *     body under them, so a stray one can never hang in the air
 *
 * Distances are in the creature's own units (one unit is one pixel at scale
 * 1); `raster` turns a description into rectangles of colour, cached by
 * animation frame so a screen full of creatures stays cheap.
 */

export type Tone = 'b' | 'd' | 'l' | 'w' | 'k' | number;

export type Shape =
  | { t: 'c'; x: number; y: number; r: number }
  | { t: 'e'; x: number; y: number; rx: number; ry: number; a: number }
  | { t: 'cap'; x1: number; y1: number; x2: number; y2: number; r1: number; r2: number }
  | { t: 'box'; x: number; y: number; hw: number; hh: number; rr: number; a: number }
  | { t: 'tri'; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number; rr: number }
  | { t: 'ring'; x: number; y: number; r: number; th: number };

export interface Part {
  s: Shape;
  tone: Tone;
  /** How wide the fillet is where it joins what came before it (units). */
  k: number;
  /** Carved out of the body rather than added. */
  cut?: boolean;
  /** Parts in different groups are separate silhouettes, drawn in group order. */
  g: number;
}

export interface Decal {
  s: Shape;
  col: Tone;
}

export interface BodyDesc {
  parts: Part[];
  decals: Decal[];
}

// ------------------------------------------------------------------ fields

function dist(s: Shape, x: number, y: number): number {
  switch (s.t) {
    case 'c':
      return Math.hypot(x - s.x, y - s.y) - s.r;
    case 'ring':
      return Math.abs(Math.hypot(x - s.x, y - s.y) - s.r) - s.th;
    case 'e': {
      let px = x - s.x;
      let py = y - s.y;
      if (s.a) {
        const c = Math.cos(-s.a);
        const n = Math.sin(-s.a);
        [px, py] = [px * c - py * n, px * n + py * c];
      }
      // (a good-enough ellipse distance: exact on the axes, close between)
      const k = Math.hypot(px / s.rx, py / s.ry);
      return (k - 1) * Math.min(s.rx, s.ry) * (k > 1 ? 1 : 1);
    }
    case 'cap': {
      const dx = s.x2 - s.x1;
      const dy = s.y2 - s.y1;
      const l = dx * dx + dy * dy || 1e-6;
      const h = Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / l));
      return Math.hypot(x - s.x1 - dx * h, y - s.y1 - dy * h) - (s.r1 + (s.r2 - s.r1) * h);
    }
    case 'box': {
      let px = x - s.x;
      let py = y - s.y;
      if (s.a) {
        const c = Math.cos(-s.a);
        const n = Math.sin(-s.a);
        [px, py] = [px * c - py * n, px * n + py * c];
      }
      const qx = Math.abs(px) - s.hw + s.rr;
      const qy = Math.abs(py) - s.hh + s.rr;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - s.rr;
    }
    case 'tri': {
      // exact triangle distance (Inigo Quilez), rounded by rr
      const { x1, y1, x2, y2, x3, y3 } = s;
      const e0x = x2 - x1, e0y = y2 - y1, e1x = x3 - x2, e1y = y3 - y2, e2x = x1 - x3, e2y = y1 - y3;
      const v0x = x - x1, v0y = y - y1, v1x = x - x2, v1y = y - y2, v2x = x - x3, v2y = y - y3;
      const cl = (v: number) => Math.max(0, Math.min(1, v));
      const h0 = cl((v0x * e0x + v0y * e0y) / (e0x * e0x + e0y * e0y || 1e-6));
      const h1 = cl((v1x * e1x + v1y * e1y) / (e1x * e1x + e1y * e1y || 1e-6));
      const h2 = cl((v2x * e2x + v2y * e2y) / (e2x * e2x + e2y * e2y || 1e-6));
      const p0x = v0x - e0x * h0, p0y = v0y - e0y * h0;
      const p1x = v1x - e1x * h1, p1y = v1y - e1y * h1;
      const p2x = v2x - e2x * h2, p2y = v2y - e2y * h2;
      const sg = Math.sign(e0x * e2y - e0y * e2x);
      const d0 = p0x * p0x + p0y * p0y, s0 = sg * (v0x * e0y - v0y * e0x);
      const d1 = p1x * p1x + p1y * p1y, s1 = sg * (v1x * e1y - v1y * e1x);
      const d2 = p2x * p2x + p2y * p2y, s2 = sg * (v2x * e2y - v2y * e2x);
      const d = Math.min(d0, d1, d2);
      const inside = Math.min(s0, s1, s2) > 0;
      return (inside ? -1 : 1) * Math.sqrt(d) - s.rr;
    }
  }
}

function bounds(s: Shape): [number, number, number, number] {
  switch (s.t) {
    case 'c':
      return [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r];
    case 'ring':
      return [s.x - s.r - s.th, s.y - s.r - s.th, s.x + s.r + s.th, s.y + s.r + s.th];
    case 'e': {
      const m = Math.max(s.rx, s.ry);
      return [s.x - m, s.y - m, s.x + m, s.y + m];
    }
    case 'cap': {
      const r = Math.max(s.r1, s.r2);
      return [Math.min(s.x1, s.x2) - r, Math.min(s.y1, s.y2) - r, Math.max(s.x1, s.x2) + r, Math.max(s.y1, s.y2) + r];
    }
    case 'box': {
      const m = Math.hypot(s.hw, s.hh);
      return [s.x - m, s.y - m, s.x + m, s.y + m];
    }
    case 'tri':
      return [Math.min(s.x1, s.x2, s.x3) - s.rr, Math.min(s.y1, s.y2, s.y3) - s.rr, Math.max(s.x1, s.x2, s.x3) + s.rr, Math.max(s.y1, s.y2, s.y3) + s.rr];
  }
}

/** The smooth union: `k` is how far the fillet reaches. */
function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
}

// ------------------------------------------------------------------ colour

function mix(a: number, b: number, k: number): number {
  const r = ((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k;
  const g = ((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k;
  const bl = (a & 255) * (1 - k) + (b & 255) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

export interface Pal {
  col: number;
  dark: number;
  light: number;
}

/** A tone as its three shades: lit, base, shadowed (and its outline). */
function shades(t: Tone, p: Pal): [number, number, number, number] {
  let base: number;
  if (t === 'b') return [p.light, p.col, p.dark, mix(p.dark, 0x0a0810, 0.6)];
  if (t === 'd') base = p.dark;
  else if (t === 'l') base = p.light;
  else if (t === 'w') base = 0xf0ead8;
  else if (t === 'k') base = 0x24202c;
  else base = t;
  return [mix(base, 0xffffff, 0.32), base, mix(base, 0x000000, 0.32), mix(base, 0x0a0810, 0.68)];
}

function solid(t: Tone, p: Pal): number {
  return t === 'b' ? p.col : t === 'd' ? p.dark : t === 'l' ? p.light : t === 'w' ? 0xf0ead8 : t === 'k' ? 0x24202c : t;
}

// ------------------------------------------------------------------ raster

/** Runs of one colour: x, y (pixels from the snapped origin), width. */
export interface Raster {
  cols: number[];
  runs: number[][];
}

const LX = -0.55;
const LY = -0.83;

/**
 * Draw `d` at scale `s`, facing `f` (1 right, -1 left), into runs of pixels
 * relative to the creature's own (integer) origin.
 */
export function raster(d: BodyDesc, s: number, f: number, p: Pal): Raster {
  if (!d.parts.length) return { cols: [], runs: [] };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const pt of d.parts) {
    if (pt.cut) continue;
    const b = bounds(pt.s);
    x0 = Math.min(x0, b[0]);
    y0 = Math.min(y0, b[1]);
    x1 = Math.max(x1, b[2]);
    y1 = Math.max(y1, b[3]);
  }
  // in pixels, flipped for facing, with a pixel of room for the outline
  const px0 = Math.floor(Math.min(x0 * s * f, x1 * s * f)) - 2;
  const px1 = Math.ceil(Math.max(x0 * s * f, x1 * s * f)) + 2;
  const py0 = Math.floor(y0 * s) - 2;
  const py1 = Math.ceil(y1 * s) + 2;
  const W = px1 - px0 + 1;
  const H = py1 - py0 + 1;
  const groups = [...new Set(d.parts.map((q) => q.g))].sort((a, b) => a - b);
  const G = groups.length;
  // the field of each group, and the part that colours each pixel
  const field = new Float32Array(W * H * G);
  const tone = new Int16Array(W * H * G);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const u = (px0 + i + 0.5) / (s * f);
      const v = (py0 + j + 0.5) / s;
      for (let gi = 0; gi < G; gi++) {
        let D = Infinity;
        let best = -1;
        let bestD = Infinity;
        let last = -1;
        for (let n = 0; n < d.parts.length; n++) {
          const pt = d.parts[n];
          if (pt.g !== groups[gi]) continue;
          const dd = dist(pt.s, u, v);
          if (pt.cut) {
            D = Math.max(D, -dd);
            continue;
          }
          D = D === Infinity ? dd : smin(D, dd, pt.k);
          if (dd < bestD) {
            bestD = dd;
            best = n;
          }
          if (dd <= 0.15) last = n;
        }
        const at = (j * W + i) * G + gi;
        field[at] = D;
        tone[at] = last >= 0 ? last : best;
      }
    }
  }
  // the colour of each pixel: the top group that covers it, shaded by its slope
  const out = new Int32Array(W * H).fill(-1);
  const inG = (i: number, j: number, gi: number) => i >= 0 && j >= 0 && i < W && j < H && field[(j * W + i) * G + gi] <= 0;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      for (let gi = G - 1; gi >= 0; gi--) {
        if (!inG(i, j, gi)) continue;
        const at = (j * W + i) * G + gi;
        const pt = d.parts[tone[at]];
        const sh = shades(pt.tone, p);
        // the edge: any neighbour not in this silhouette
        if (!inG(i - 1, j, gi) || !inG(i + 1, j, gi) || !inG(i, j - 1, gi) || !inG(i, j + 1, gi)) {
          out[j * W + i] = sh[3];
          break;
        }
        const fx = (i: number, j: number) => field[(j * W + i) * G + gi];
        const gx = fx(i + 1, j) - fx(i - 1, j);
        const gy = fx(i, j + 1) - fx(i, j - 1);
        const m = Math.hypot(gx, gy) || 1;
        // lit where the surface faces the light; it fades a few units in
        const depth = Math.max(0, Math.min(1, 1 + field[at] / (2.6 / s)));
        const lit = ((gx / m) * LX + (gy / m) * LY) * depth;
        out[j * W + i] = lit > 0.32 ? sh[0] : lit < -0.3 ? sh[2] : sh[1];
        break;
      }
    }
  }
  // decals, only where there is body (and not on the outline)
  if (d.decals.length) {
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        if (out[j * W + i] < 0) continue;
        let inside = false;
        for (let gi = 0; gi < G && !inside; gi++) {
          if (inG(i, j, gi) && inG(i - 1, j, gi) && inG(i + 1, j, gi) && inG(i, j - 1, gi) && inG(i, j + 1, gi)) inside = true;
        }
        if (!inside) continue;
        const u = (px0 + i + 0.5) / (s * f);
        const v = (py0 + j + 0.5) / s;
        for (const dc of d.decals) if (dist(dc.s, u, v) <= 0) out[j * W + i] = solid(dc.col, p);
      }
    }
  }
  // as runs, grouped by colour
  const byCol = new Map<number, number[]>();
  for (let j = 0; j < H; j++) {
    let i = 0;
    while (i < W) {
      const c = out[j * W + i];
      if (c < 0) {
        i++;
        continue;
      }
      let e = i + 1;
      while (e < W && out[j * W + e] === c) e++;
      let list = byCol.get(c);
      if (!list) byCol.set(c, (list = []));
      list.push(px0 + i, py0 + j, e - i);
      i = e;
    }
  }
  return { cols: [...byCol.keys()], runs: [...byCol.values()] };
}

// ------------------------------------------------------------------ builder

/** A body, written as a list of parts: `B.e(...)`, `B.cap(...)`, ... */
export class Build {
  parts: Part[] = [];
  decals: Decal[] = [];
  /** Which silhouette the next parts belong to. */
  group = 0;

  private add(s: Shape, tone: Tone, k: number, cut = false): this {
    this.parts.push({ s, tone, k, cut, g: this.group });
    return this;
  }

  c(x: number, y: number, r: number, tone: Tone = 'b', k = 1): this {
    return this.add({ t: 'c', x, y, r }, tone, k);
  }
  e(x: number, y: number, rx: number, ry: number, tone: Tone = 'b', a = 0, k = 1): this {
    return this.add({ t: 'e', x, y, rx, ry, a }, tone, k);
  }
  cap(x1: number, y1: number, x2: number, y2: number, r1: number, r2 = r1, tone: Tone = 'b', k = 0.8): this {
    return this.add({ t: 'cap', x1, y1, x2, y2, r1, r2 }, tone, k);
  }
  box(x: number, y: number, w: number, h: number, rr: number, tone: Tone = 'b', a = 0, k = 1): this {
    return this.add({ t: 'box', x, y, hw: w / 2, hh: h / 2, rr, a }, tone, k);
  }
  tri(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, tone: Tone = 'b', k = 0.6, rr = 0.2): this {
    return this.add({ t: 'tri', x1, y1, x2, y2, x3, y3, rr }, tone, k);
  }
  ring(x: number, y: number, r: number, th: number, tone: Tone = 'b'): this {
    return this.add({ t: 'ring', x, y, r, th }, tone, 0);
  }
  /** Carve a shape out of everything before it in this group. */
  cutC(x: number, y: number, r: number): this {
    return this.add({ t: 'c', x, y, r }, 'b', 0, true);
  }
  cutBox(x: number, y: number, w: number, h: number): this {
    return this.add({ t: 'box', x, y, hw: w / 2, hh: h / 2, rr: 0, a: 0 }, 'b', 0, true);
  }
  cutTri(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
    return this.add({ t: 'tri', x1, y1, x2, y2, x3, y3, rr: 0 }, 'b', 0, true);
  }
  /** A chain of joints along points: a neck, a tail, a tentacle. */
  chain(pts: [number, number][], r0: number, r1: number, tone: Tone = 'b', k = 0.6): this {
    for (let n = 0; n < pts.length - 1; n++) {
      const a = r0 + ((r1 - r0) * n) / (pts.length - 1);
      const b = r0 + ((r1 - r0) * (n + 1)) / (pts.length - 1);
      this.cap(pts[n][0], pts[n][1], pts[n + 1][0], pts[n + 1][1], a, b, tone, n === 0 ? k : 0.3);
    }
    return this;
  }
  // ---- decals (on the body only)
  dc(x: number, y: number, r: number, col: Tone): this {
    this.decals.push({ s: { t: 'c', x, y, r }, col });
    return this;
  }
  de(x: number, y: number, rx: number, ry: number, col: Tone, a = 0): this {
    this.decals.push({ s: { t: 'e', x, y, rx, ry, a }, col });
    return this;
  }
  dl(x1: number, y1: number, x2: number, y2: number, w: number, col: Tone): this {
    this.decals.push({ s: { t: 'cap', x1, y1, x2, y2, r1: w, r2: w }, col });
    return this;
  }
  dt(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, col: Tone): this {
    this.decals.push({ s: { t: 'tri', x1, y1, x2, y2, x3, y3, rr: 0 }, col });
    return this;
  }
  /** An eye: white, a pupil towards the front, a glint. */
  eye(x: number, y: number, r = 1.1, iris: Tone = 0x1a1020): this {
    this.dc(x, y, r, 0xffffff);
    this.dc(x + r * 0.3, y, r * 0.6, iris);
    if (r >= 1) this.dc(x + r * 0.05, y - r * 0.35, r * 0.22, 0xffffff);
    return this;
  }
  /** A glowing eye: no white, just the light. */
  glow(x: number, y: number, r: number, col: Tone): this {
    return this.dc(x, y, r, col);
  }

  done(): BodyDesc {
    return { parts: this.parts, decals: this.decals };
  }
}
