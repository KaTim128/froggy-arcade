/**
 * What he is made of.
 *
 * The model was flat Lambert colours on primitives, and at torch range that is
 * exactly what it looked like: a sphere, some capsules, and a cone rank for
 * teeth.  You could count the parts.  Counting the parts is the opposite of
 * the effect — a thing you can take apart with your eyes is a toy.
 *
 * Two things fix it, and neither is a bigger polygon budget:
 *
 *   1. SURFACE.  Real skin is mottled and it is never one value.  These are
 *      procedural canvases: a base, blotches at three scales, pores, a damp
 *      sheen in the low spots and dried matter in the creases.  The bump map
 *      is the same noise pushed to contrast, so the torch finds relief rather
 *      than a gradient, and the specular highlight breaks up across it — which
 *      is the whole of why he reads as WET rather than as painted.
 *   2. SILHOUETTE.  `roughen` pushes every vertex of a primitive along its own
 *      normal by a little low-frequency noise.  A sphere stops being a sphere
 *      and the seam where two of them meet stops being a seam.
 *
 * Everything here is built once, lazily, and shared by every instance: the
 * alley and the hide rooms both make one of him and there is no reason for two
 * sets of canvases.
 */

import * as THREE from 'three';

/** A cheap deterministic hash in 0..1, so the same creature is the same twice. */
function hash(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Value noise on a lattice, smoothed.  Good enough for skin, cheap enough to run per vertex. */
function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const sx = xf * xf * (3 - 2 * xf);
  const sy = yf * yf * (3 - 2 * yf);
  const sz = zf * zf * (3 - 2 * zf);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), sx), lerp(c(0, 1, 0), c(1, 1, 0), sx), sy),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), sx), lerp(c(0, 1, 1), c(1, 1, 1), sx), sy),
    sz,
  );
}

/**
 * Push every vertex of a primitive out along its own normal by a little noise.
 *
 * This is what stops him reading as assembled: a sphere with a millimetre of
 * lump on it is a shoulder, and the join between it and the capsule under it
 * disappears because neither of them is a clean surface any more.
 *
 * The amplitudes are small on purpose — 2 to 5cm on a 2.4m creature.  Anything
 * more and the silhouette starts to wobble, which reads as a modelling fault
 * rather than as skin.
 */
export function roughen(
  geo: THREE.BufferGeometry,
  amp: number,
  freq: number,
  seed = 0,
): THREE.BufferGeometry {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nrm = geo.attributes.normal as THREE.BufferAttribute | undefined;
  if (!nrm) geo.computeVertexNormals();
  const n = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // Two octaves: lumps, and pores on the lumps.
    const a = noise3(x * freq + seed, y * freq + seed, z * freq + seed) - 0.5;
    const b = noise3(x * freq * 3.1 + seed, y * freq * 3.1 + seed, z * freq * 3.1 + seed) - 0.5;
    const d = (a + b * 0.4) * amp;
    pos.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

const SIZE = 512;

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  return [c, c.getContext('2d')!];
}

function wrap(c: HTMLCanvasElement, repeat = 2): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

/** A seeded RNG, so the skin is the same skin every time the page loads. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * A WRINKLE: a short curved crease, drawn as a dark groove with a pale lip
 * along one side of it -- which is what a fold in skin looks like under one
 * light.  Wrinkles come in little families of near-parallel lines, never
 * alone, so they are laid down in bundles.
 */
function wrinkles(ctx: CanvasRenderingContext2D, r: () => number, n: number, dark: string, lit: string, len = 30): void {
  for (let i = 0; i < n; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const a = r() * Math.PI;
    const lines = 2 + Math.floor(r() * 4);
    const L = len * (0.5 + r());
    const bow = (r() - 0.5) * L * 0.6;
    for (let k = 0; k < lines; k++) {
      const off = k * (2.2 + r() * 2);
      const ox = Math.cos(a + Math.PI / 2) * off;
      const oy = Math.sin(a + Math.PI / 2) * off;
      const x0 = x + ox - Math.cos(a) * L / 2;
      const y0 = y + oy - Math.sin(a) * L / 2;
      const x1 = x + ox + Math.cos(a) * L / 2;
      const y1 = y + oy + Math.sin(a) * L / 2;
      const cx = x + ox + Math.cos(a + Math.PI / 2) * bow;
      const cy = y + oy + Math.sin(a + Math.PI / 2) * bow;
      ctx.lineCap = 'round';
      ctx.strokeStyle = dark;
      ctx.lineWidth = 0.7 + r() * 0.9;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();
      ctx.strokeStyle = lit;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x0 + 1, y0 + 1);
      ctx.quadraticCurveTo(cx + 1, cy + 1, x1 + 1, y1 + 1);
      ctx.stroke();
    }
  }
}

/**
 * THE HIDE.  A LUMINANCE map, painted round mid-grey and multiplied by the
 * material's own colour at draw time.
 *
 * Grey, thin and old: faint blotching at two scales, thousands of pores,
 * bundles of fine wrinkles running every which way, darker patches where it
 * has discoloured, a scatter of raised warts, and the odd blemish.  Nothing
 * is one value and nothing repeats in a way the eye can pick out.
 */
function paintSkin(ctx: CanvasRenderingContext2D, base: string, seed: number, creased = 1): void {
  const r = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // big soft patches: the difference between a flank and a back
  for (let i = 0; i < 40; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const rad = 40 + r() * 110;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() < 0.55;
    g.addColorStop(0, dark ? 'rgba(20,16,12,0.28)' : 'rgba(255,255,250,0.2)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  // discoloured patches: soft-edged, faintly brown, the skin of something old
  for (let i = 0; i < 70; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const rad = 6 + r() * 22;
    ctx.fillStyle = r() < 0.6 ? 'rgba(52,40,30,0.18)' : 'rgba(235,230,215,0.14)';
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * (0.4 + r() * 0.8), r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // the wrinkles, in bundles
  wrinkles(ctx, r, Math.round(220 * creased), 'rgba(18,14,10,0.22)', 'rgba(255,255,245,0.1)', 9);
  wrinkles(ctx, r, Math.round(40 * creased), 'rgba(18,14,10,0.16)', 'rgba(255,255,245,0.07)', 22);
  // grain: the skin is never one value from one pixel to the next
  for (let i = 0; i < 30000; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)';
    ctx.fillRect(r() * SIZE, r() * SIZE, 1, 1);
  }
  // pores: tiny, thousands of them, darker than the skin round them
  for (let i = 0; i < 9000; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    ctx.fillStyle = r() < 0.75 ? 'rgba(15,12,10,0.45)' : 'rgba(255,255,250,0.3)';
    ctx.fillRect(x, y, 0.8 + r() * 1.1, 0.8 + r() * 1.1);
  }
  // warts and blemishes: a few, raised, with a shadow under each
  for (let i = 0; i < 110; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const s = 1.2 + r() * 3.2;
    ctx.fillStyle = 'rgba(20,16,12,0.4)';
    ctx.beginPath();
    ctx.arc(x + 0.8, y + 0.9, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = r() < 0.3 ? 'rgba(90,60,50,0.35)' : 'rgba(240,236,225,0.35)';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The same features as relief: pores sink, wrinkles are grooves, warts rise. */
function paintBump(ctx: CanvasRenderingContext2D, seed: number, creased = 1): void {
  const r = rng(seed);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 120; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const rad = 14 + r() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, r() < 0.5 ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  wrinkles(ctx, r, Math.round(260 * creased), 'rgba(0,0,0,0.5)', 'rgba(255,255,255,0.3)', 9);
  wrinkles(ctx, r, Math.round(50 * creased), 'rgba(0,0,0,0.35)', 'rgba(255,255,255,0.2)', 22);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(r() * SIZE, r() * SIZE, 1 + r(), 1 + r());
  }
  for (let i = 0; i < 140; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const s = 1.4 + r() * 3.4;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(x + 0.7, y + 0.7, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * WHERE HE IS WET.  A specular map: black is dry and matte, white is damp.
 *
 * Mostly dry, with patches and runs of damp -- so the torch finds a wet
 * sheen that breaks up and wanders across him instead of one even plastic
 * highlight down every limb.
 */
function paintWet(ctx: CanvasRenderingContext2D, seed: number): void {
  const r = rng(seed);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 46; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const rad = 16 + r() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(255,255,255,${0.35 + r() * 0.4})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * (0.4 + r() * 0.6), r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 40; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const len = 20 + r() * 80;
    ctx.strokeStyle = `rgba(255,255,255,${0.25 + r() * 0.35})`;
    ctx.lineWidth = 1 + r() * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (r() - 0.5) * 14, y + len * 0.5, x + (r() - 0.5) * 10, y + len);
    ctx.stroke();
  }
  // and the pores stay dry: a damp skin is broken up by its own texture
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(r() * SIZE, r() * SIZE, 1.2, 1.2);
  }
}

export interface FroggySkin {
  skin: THREE.Texture;
  skinBump: THREE.Texture;
  /** The face: the same hide, more deeply creased. */
  face: THREE.Texture;
  faceBump: THREE.Texture;
  /** Where it is wet, as a specular map. */
  wet: THREE.Texture;
  /** Kept for anything still asking for the old names. */
  belly: THREE.Texture;
  bellyBump: THREE.Texture;
}

let cached: FroggySkin | null = null;

/**
 * The shared set.  Built on first use, because a canvas needs a document and
 * this module is imported by things that get type-checked in isolation.
 */
export function froggySkin(): FroggySkin {
  if (cached) return cached;
  const [c1, x1] = canvas();
  paintSkin(x1, '#a4a4a4', 11);
  const [c2, x2] = canvas();
  paintBump(x2, 11);
  const [c3, x3] = canvas();
  paintSkin(x3, '#a8a8a8', 29, 1.8);
  const [c4, x4] = canvas();
  paintBump(x4, 29, 1.8);
  const [c5, x5] = canvas();
  paintWet(x5, 47);
  cached = {
    // Tiled hard on the limbs, so a forearm gets real pores rather than three
    // smudges; the face gets its own, more deeply creased, tiled less.
    skin: wrap(c1, 3),
    skinBump: wrap(c2, 3),
    face: wrap(c3, 1.6),
    faceBump: wrap(c4, 1.6),
    wet: wrap(c5, 2),
    belly: wrap(c3, 1.6),
    bellyBump: wrap(c4, 1.6),
  };
  return cached;
}
