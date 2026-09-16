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

const SIZE = 256;

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
 * The hide.  Blotches at three scales over a base, then pores, then damp.
 *
 * The values are dark — this is lit by a torch and nothing else, and anything
 * that reads as a colour in here reads as a cartoon.
 */
function paintSkin(ctx: CanvasRenderingContext2D, base: string, seed: number): void {
  const r = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);
  // NOTE: this canvas is a LUMINANCE map, not a colour one.  It is painted
  // around mid-grey and multiplied by the material's own colour at draw time.
  // Painted in his actual greens it came out as green times green -- a flat
  // near-black with every bit of the mottling squeezed out of it, which is
  // exactly what it looked like.

  // big soft patches: the difference between a back and a flank
  for (let i = 0; i < 26; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const rad = 24 + r() * 52;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() < 0.5;
    g.addColorStop(0, dark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // mid blotches with hard-ish edges: the mottling you actually see
  for (let i = 0; i < 150; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const rad = 3 + r() * 11;
    ctx.fillStyle = r() < 0.55 ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * (0.5 + r() * 0.7), r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // pores and warts: two pixels each, thousands of them, and they are what the
  // bump map turns into a surface
  for (let i = 0; i < 2600; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const s = 0.8 + r() * 2.2;
    ctx.fillStyle = r() < 0.6 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.42)';
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }

  // damp: a few pale streaks running one way, so he looks like he has been
  // somewhere wet rather than dusted
  for (let i = 0; i < 22; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const len = 12 + r() * 46;
    const g = ctx.createLinearGradient(x, y, x + 3, y + len);
    g.addColorStop(0, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1 + r() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (r() - 0.5) * 8, y + len * 0.5, x + (r() - 0.5) * 6, y + len);
    ctx.stroke();
  }
}

/** The same noise, pushed to black and white: relief for the bump map. */
function paintBump(ctx: CanvasRenderingContext2D, seed: number): void {
  const r = rng(seed);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 90; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const rad = 8 + r() * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const up = r() < 0.5;
    g.addColorStop(0, up ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)');
    g.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  // the warts.  A highlight on top and a shadow under, so each one has a side.
  for (let i = 0; i < 2000; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const s = 1 + r() * 2.6;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(x + 0.6, y + 0.6, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The belly: sallower, striped across rather than blotched, and drier. */
function paintBelly(ctx: CanvasRenderingContext2D, seed: number): void {
  const r = rng(seed);
  // Luminance again, for the same reason.
  ctx.fillStyle = '#a8a8a8';
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let y = 0; y < SIZE; y += 5 + Math.floor(r() * 6)) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, y, SIZE, 2 + r() * 3);
  }
  // veins under the skin, which is a belly rather than a paint job
  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = 'rgba(58,18,18,0.32)';
    ctx.lineWidth = 0.8 + r() * 1.2;
    ctx.beginPath();
    let x = r() * SIZE;
    let y = r() * SIZE;
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (r() - 0.5) * 34;
      y += (r() - 0.5) * 34;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(r() * SIZE, r() * SIZE, 0.6 + r() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface FroggySkin {
  skin: THREE.Texture;
  skinBump: THREE.Texture;
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
  paintSkin(x1, '#9e9e9e', 11);
  const [c2, x2] = canvas();
  paintBump(x2, 11);
  const [c3, x3] = canvas();
  paintBelly(x3, 29);
  const [c4, x4] = canvas();
  paintBump(x4, 29);
  cached = {
    // Tiled hard: on a limb the size of a forearm one tile of a 256px canvas
    // is the whole of it, and the mottling comes out as three big smudges.
    skin: wrap(c1, 3),
    skinBump: wrap(c2, 3),
    belly: wrap(c3, 1.5),
    bellyBump: wrap(c4, 1.5),
  };
  return cached;
}
