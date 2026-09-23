/**
 * What the rooms are made of.
 *
 * Every surface used to be one flat colour, which reads as a diagram: a box
 * with boxes in it.  These are painted textures — drawn on a canvas at load,
 * from a seed, so the same room always looks the same — with the grime that
 * makes a place read as abandoned: damp climbing the walls, stains on the
 * floor, cracks, scuffs, peeling paper, tile joints gone black.
 *
 * Three themes, one per room, so the rooms are three places and not one
 * place three times.  None of it changes the geometry; the grid he walks and
 * the boxes you hide in are exactly what they were.
 */

import * as THREE from 'three';
import type { RoomDef, RoomTheme } from './hideRooms';

type Surface = 'floor' | 'wall' | 'ceiling' | 'grunge';

/** A small deterministic generator, so a room dresses the same every visit. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (c: number, mul = 1): string => {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * mul));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * mul));
  const b = Math.min(255, Math.round((c & 255) * mul));
  return `rgb(${r},${g},${b})`;
};

const SIZE = 256;

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  return [c, c.getContext('2d')!];
}

/** Fine speckle over the whole tile.  Every surface gets some. */
function speckle(ctx: CanvasRenderingContext2D, r: () => number, amount: number, strength: number): void {
  const img = ctx.getImageData(0, 0, SIZE, SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (r() > amount) continue;
    const k = 1 + (r() - 0.5) * strength;
    d[i] = Math.min(255, d[i] * k);
    d[i + 1] = Math.min(255, d[i + 1] * k);
    d[i + 2] = Math.min(255, d[i + 2] * k);
  }
  ctx.putImageData(img, 0, 0);
}

/** Soft dark blotches: damp, oil, old spills. */
function stains(ctx: CanvasRenderingContext2D, r: () => number, n: number, colour: string, maxR: number, alpha: number): void {
  for (let i = 0; i < n; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const rad = maxR * (0.4 + r() * 0.6);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, colour.replace(')', `,${alpha})`).replace('rgb', 'rgba'));
    g.addColorStop(1, colour.replace(')', ',0)').replace('rgb', 'rgba'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rad * (0.7 + r() * 0.6), rad, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * BLOOD, AND WHY IT IS NOT A RED DOT.
 *
 * The rooms used to get their blood from `stains` -- the same soft radial
 * ellipse as the damp and the oil, in a bright red.  Three round red marks on
 * a floor do not read as something that happened; they read as UI.  A player
 * looks at a small saturated red circle on the ground and checks whether it is
 * a button.
 *
 * What this draws instead is a SPILL: a body of three or four overlapping
 * lobes at different sizes, each one dragged out along a direction of travel,
 * in the browns and burgundies dried blood actually goes -- never the bright
 * red of a warning.  Round it: a few streaks pulled off the leading edge, a
 * scatter of specks at the end of them, and a darker rim where it dried
 * deepest, which is what stops a flat fill from looking painted on.
 *
 * It goes into the TEXTURE, so it lies on whatever it is drawn on -- it
 * follows the floorboards and goes round a corner with the wall -- rather than
 * floating as a decal.  Every one gets its own size, direction, opacity and
 * number of lobes from the room's seed, so no two are the same mark twice.
 */
function bloodStains(
  ctx: CanvasRenderingContext2D,
  r: () => number,
  n: number,
  maxR: number,
  alpha: number,
): void {
  for (let i = 0; i < n; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const rad = maxR * (0.45 + r() * 0.75);
    // Which way it went: the lobes stretch along it and the streaks run off it.
    const dir = r() * Math.PI * 2;
    const a = alpha * (0.55 + r() * 0.5);
    // Dried, not fresh.  Three tones, all of them dark, picked per stain so a
    // floor has older and newer marks on it.
    const tone = r();
    // Dark on the canvas, because the room is lit: a colour that looks like
    // dried blood in a picker comes back off a torch-lit floor as a bright red
    // mark, which is the thing this is here to stop being.
    const body =
      tone < 0.38 ? [30, 9, 11] : tone < 0.72 ? [41, 13, 13] : [25, 10, 13];
    const rgba = (k: number, al: number): string =>
      `rgba(${Math.round(body[0] * k)},${Math.round(body[1] * k)},${Math.round(body[2] * k)},${al})`;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(dir);

    // ---- the body of it: overlapping lobes, none of them centred on another.
    const lobes = 3 + Math.floor(r() * 3);
    for (let l = 0; l < lobes; l++) {
      const lx = (r() - 0.35) * rad * 1.3;
      const ly = (r() - 0.5) * rad * 0.8;
      const lr = rad * (0.32 + r() * 0.6);
      // The darker rim first, a shade under the lobe and a shade wider, so the
      // edge is where the colour is deepest.
      // Flattened ALONG the direction of travel rather than at a random
      // angle: a random rotation on a flattened lobe averages back out to a
      // circle, and a circle is the one shape this must not be.
      const lean = (r() - 0.5) * 0.7;
      ctx.beginPath();
      ctx.ellipse(lx, ly, lr * 1.2, lr * (0.42 + r() * 0.4), lean, 0, Math.PI * 2);
      ctx.fillStyle = rgba(0.55, a * 0.85);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(lx, ly, lr, lr * (0.34 + r() * 0.36), lean, 0, Math.PI * 2);
      ctx.fillStyle = rgba(1, a);
      ctx.fill();
    }

    // ---- streaks off the leading edge, thinning as they go.
    const streaks = 2 + Math.floor(r() * 4);
    for (let t = 0; t < streaks; t++) {
      const sy = (r() - 0.5) * rad * 1.1;
      const len = rad * (0.5 + r() * 1.6);
      const w = 0.8 + r() * 2.2;
      ctx.beginPath();
      ctx.moveTo(rad * 0.5, sy);
      ctx.quadraticCurveTo(rad * 0.5 + len * 0.6, sy + (r() - 0.5) * rad * 0.35, rad * 0.5 + len, sy + (r() - 0.5) * rad * 0.5);
      ctx.strokeStyle = rgba(0.8, a * (0.45 + r() * 0.4));
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // ---- and the specks at the end of them.
    const specks = 5 + Math.floor(r() * 10);
    for (let sp = 0; sp < specks; sp++) {
      const px = rad * (0.6 + r() * 2.2);
      const py = (r() - 0.5) * rad * 2;
      ctx.beginPath();
      ctx.ellipse(px, py, 0.5 + r() * 1.6, 0.5 + r() * 1.1, r() * Math.PI, 0, Math.PI * 2);
      ctx.fillStyle = rgba(0.7, a * (0.3 + r() * 0.5));
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Hairline cracks: a few jagged polylines. */
function cracks(ctx: CanvasRenderingContext2D, r: () => number, n: number, colour: string): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    let x = r() * SIZE;
    let y = r() * SIZE;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 6 + Math.floor(r() * 10);
    const dir = r() * Math.PI * 2;
    for (let s = 0; s < segs; s++) {
      x += Math.cos(dir + (r() - 0.5) * 1.6) * (4 + r() * 10);
      y += Math.sin(dir + (r() - 0.5) * 1.6) * (4 + r() * 10);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/** Scuffs and scratches: short straight strokes, slightly lighter. */
function scratches(ctx: CanvasRenderingContext2D, r: () => number, n: number, colour: string): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const a = r() * Math.PI;
    const len = 6 + r() * 26;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
}

function grid(ctx: CanvasRenderingContext2D, step: number, colour: string, width = 1): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  for (let x = 0; x <= SIZE; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, SIZE);
    ctx.stroke();
  }
  for (let y = 0; y <= SIZE; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(SIZE, y + 0.5);
    ctx.stroke();
  }
}

function paint(theme: RoomTheme, surface: Surface, base: number, seed: number): HTMLCanvasElement {
  const [c, ctx] = canvas();
  const r = rng(seed);
  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, SIZE, SIZE);

  if (surface === 'grunge') {
    // A neutral multiplier for furniture: mostly white, worn at the edges.
    ctx.fillStyle = '#e6e6e6';
    ctx.fillRect(0, 0, SIZE, SIZE);
    speckle(ctx, r, 0.5, 0.25);
    stains(ctx, r, 14, 'rgb(90,90,90)', 40, 0.35);
    scratches(ctx, r, 30, 'rgba(255,255,255,0.35)');
    return c;
  }

  if (theme === 'lounge') {
    if (surface === 'floor') {
      // Carpet: a fine weave, worn paths, and things spilled long ago.
      speckle(ctx, r, 0.9, 0.22);
      stains(ctx, r, 6, hex(base, 1.35), 60, 0.35); // worn lighter
      stains(ctx, r, 9, 'rgb(20,12,10)', 34, 0.6);
      bloodStains(ctx, r, 3, 22, 0.75);
    } else if (surface === 'wall') {
      // Wallpaper: faint stripes, damp rising from the skirting, paper lifting.
      ctx.fillStyle = hex(base, 1.08);
      for (let x = 0; x < SIZE; x += 24) ctx.fillRect(x, 0, 8, SIZE);
      speckle(ctx, r, 0.6, 0.16);
      const damp = ctx.createLinearGradient(0, SIZE, 0, SIZE * 0.45);
      damp.addColorStop(0, 'rgba(12,10,8,0.7)');
      damp.addColorStop(1, 'rgba(12,10,8,0)');
      ctx.fillStyle = damp;
      ctx.fillRect(0, 0, SIZE, SIZE);
      stains(ctx, r, 5, 'rgb(30,22,14)', 44, 0.5);
      cracks(ctx, r, 5, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = hex(base, 1.5);
      for (let i = 0; i < 4; i++) {
        const x = r() * SIZE;
        const y = r() * SIZE * 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 10 + r() * 20, y + 4);
        ctx.lineTo(x + 6 + r() * 12, y + 16 + r() * 20);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      speckle(ctx, r, 0.7, 0.18);
      stains(ctx, r, 6, 'rgb(60,44,24)', 60, 0.55); // water stains
      cracks(ctx, r, 4, 'rgba(0,0,0,0.45)');
    }
  } else if (theme === 'stores') {
    if (surface === 'floor') {
      // Concrete slabs: joints, oil, tyre scuffs, a crack or two.
      speckle(ctx, r, 0.95, 0.3);
      grid(ctx, 128, 'rgba(0,0,0,0.55)', 2);
      stains(ctx, r, 7, 'rgb(8,8,10)', 40, 0.7);
      stains(ctx, r, 4, 'rgb(70,50,20)', 30, 0.4); // rust
      scratches(ctx, r, 40, 'rgba(0,0,0,0.35)');
      cracks(ctx, r, 6, 'rgba(0,0,0,0.6)');
    } else if (surface === 'wall') {
      // Blockwork: courses of block, grime low down, a leak line.
      speckle(ctx, r, 0.9, 0.22);
      for (let y = 0; y < SIZE; y += 32) {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(SIZE, y + 0.5);
        ctx.stroke();
        const off = (y / 32) % 2 === 0 ? 0 : 32;
        for (let x = off; x < SIZE; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x + 0.5, y);
          ctx.lineTo(x + 0.5, y + 32);
          ctx.stroke();
        }
      }
      const damp = ctx.createLinearGradient(0, SIZE, 0, SIZE * 0.55);
      damp.addColorStop(0, 'rgba(0,0,0,0.65)');
      damp.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = damp;
      ctx.fillRect(0, 0, SIZE, SIZE);
      stains(ctx, r, 4, 'rgb(60,40,16)', 30, 0.5);
      for (let i = 0; i < 3; i++) {
        const x = r() * SIZE;
        ctx.fillStyle = 'rgba(40,30,12,0.45)';
        ctx.fillRect(x, 0, 2 + r() * 3, SIZE * (0.4 + r() * 0.6));
      }
    } else {
      speckle(ctx, r, 0.8, 0.3);
      stains(ctx, r, 5, 'rgb(0,0,0)', 70, 0.5);
    }
  } else if (theme === 'arcade') {
    if (surface === 'floor') {
      // THE CARPET.  Every arcade floor ever laid: a dark ground with a
      // confetti of little bright flecks on it, worn pale down the lanes
      // people actually walk and sticky-dark where the machines stand.  It is
      // the one surface in this building a player has already seen in two
      // dimensions, so it is the one that has to be recognisable.
      speckle(ctx, r, 0.5, 0.12);
      for (let i = 0; i < 520; i++) {
        const c = [0xff4fa3, 0x46c4bd, 0xffd45e, 0x7b4bd8, 0x6fbb6a][Math.floor(r() * 5)];
        ctx.fillStyle = hex(c, 0.5 + r() * 0.3);
        const w = 2 + r() * 4;
        ctx.fillRect(r() * SIZE, r() * SIZE, w, 2 + r() * 3);
      }
      // walked-pale lanes, then the dark under the cabinets
      for (let i = 0; i < 3; i++) {
        const x = SIZE * (0.2 + r() * 0.6);
        const g = ctx.createLinearGradient(x - 40, 0, x + 40, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.05)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, SIZE, SIZE);
      }
      stains(ctx, r, 9, 'rgb(6,8,12)', 34, 0.55);
      stains(ctx, r, 4, 'rgb(40,26,10)', 26, 0.35);
      scratches(ctx, r, 26, 'rgba(0,0,0,0.3)');
    } else if (surface === 'wall') {
      // Panelled to waist height, painted above it, and both gone shabby:
      // scuffed where shoulders and coin-cups have been, damp along the floor.
      speckle(ctx, r, 0.8, 0.18);
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(0, SIZE * 0.62, SIZE, SIZE * 0.38);
      for (let x = 0; x < SIZE; x += 40) {
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, SIZE * 0.62);
        ctx.lineTo(x + 0.5, SIZE);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(x + 2, SIZE * 0.62, 3, SIZE * 0.38);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, SIZE * 0.62);
      ctx.lineTo(SIZE, SIZE * 0.62);
      ctx.stroke();
      const damp = ctx.createLinearGradient(0, SIZE, 0, SIZE * 0.7);
      damp.addColorStop(0, 'rgba(0,0,0,0.6)');
      damp.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = damp;
      ctx.fillRect(0, 0, SIZE, SIZE);
      stains(ctx, r, 5, 'rgb(20,14,26)', 30, 0.45);
      scratches(ctx, r, 22, 'rgba(0,0,0,0.3)');
      cracks(ctx, r, 3, 'rgba(0,0,0,0.5)');
    } else {
      // Ceiling tiles with the strip lights long dead.
      speckle(ctx, r, 0.7, 0.2);
      grid(ctx, 64, 'rgba(0,0,0,0.5)', 2);
      stains(ctx, r, 6, 'rgb(0,0,0)', 60, 0.5);
    }
  } else {
    if (surface === 'floor') {
      // Lino tiles gone the colour of the years, joints black, drag marks.
      speckle(ctx, r, 0.6, 0.14);
      ctx.fillStyle = hex(base, 0.9);
      for (let y = 0; y < SIZE; y += 32) {
        for (let x = 0; x < SIZE; x += 32) if ((x / 32 + y / 32) % 2 === 0) ctx.fillRect(x, y, 32, 32);
      }
      grid(ctx, 32, 'rgba(0,0,0,0.45)');
      stains(ctx, r, 6, 'rgb(40,30,18)', 50, 0.5);
      bloodStains(ctx, r, 3, 18, 0.8);
      scratches(ctx, r, 24, 'rgba(0,0,0,0.3)');
    } else if (surface === 'wall') {
      // Half-tiled: white tiles to waist height, painted above, all of it grubby.
      ctx.fillStyle = hex(base, 1.5);
      ctx.fillRect(0, SIZE * 0.5, SIZE, SIZE * 0.5);
      for (let y = SIZE * 0.5; y < SIZE; y += 16) {
        for (let x = 0; x < SIZE; x += 32) {
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.strokeRect(x + 0.5, y + 0.5, 32, 16);
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, SIZE * 0.5 - 3, SIZE, 3);
      speckle(ctx, r, 0.7, 0.18);
      stains(ctx, r, 6, 'rgb(40,36,20)', 40, 0.5);
      bloodStains(ctx, r, 2, 26, 0.7);
      cracks(ctx, r, 6, 'rgba(0,0,0,0.5)');
      scratches(ctx, r, 18, 'rgba(0,0,0,0.3)');
    } else {
      // Suspended ceiling panels, some of them stained through.
      grid(ctx, 64, 'rgba(0,0,0,0.6)', 2);
      speckle(ctx, r, 0.5, 0.14);
      stains(ctx, r, 5, 'rgb(70,60,30)', 40, 0.6);
    }
  }
  return c;
}

const cache = new Map<string, THREE.CanvasTexture>();

/** A tiling texture for a surface, repeated so the tile is about 4m across. */
export function surfaceTexture(theme: RoomTheme, surface: Surface, base: number, seed: number, spanW: number, spanH: number): THREE.CanvasTexture {
  const key = `${theme}:${surface}:${base}:${seed}`;
  let tex = cache.get(key);
  if (!tex) {
    tex = new THREE.CanvasTexture(paint(theme, surface, base, seed));
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    cache.set(key, tex);
  }
  const t = tex.clone();
  t.needsUpdate = true;
  const tile = surface === 'wall' ? 3.2 : 4;
  t.repeat.set(Math.max(1, spanW / tile), Math.max(1, spanH / tile));
  return t;
}

/**
 * Litter and decals: things on the floor that are not furniture and do not
 * block anything.  Placed off the walkable geometry using the room's own
 * solid test, so nothing sits inside a sofa or a box.
 */
export function dressRoom(scene: THREE.Scene, def: RoomDef, seed: number, solid: (x: number, z: number) => boolean): void {
  const r = rng(seed * 7919 + 13);
  const theme = def.theme;

  // floor decals: dark patches, a few of them large
  const decalMat = (col: number, alpha: number) => {
    const [c, ctx] = canvas();
    const g = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
    g.addColorStop(0, hex(col).replace('rgb', 'rgba').replace(')', `,${alpha})`));
    g.addColorStop(1, hex(col).replace('rgb', 'rgba').replace(')', ',0)'));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  };
  const dark = decalMat(0x06050a, 0.75);
  const rust = decalMat(theme === 'lounge' ? 0x3a1410 : 0x4a2a10, 0.6);
  const count = Math.round((def.halfW * def.halfD) / 40);
  for (let i = 0; i < count; i++) {
    const x = (r() * 2 - 1) * (def.halfW - 2);
    const z = (r() * 2 - 1) * (def.halfD - 2);
    const s = 1.5 + r() * 3.5;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * (0.6 + r() * 0.8)), r() < 0.7 ? dark : rust);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = r() * Math.PI;
    m.position.set(x, 0.012, z);
    scene.add(m);
  }

  // debris: bits of board, bottles, bricks, paper — small, low, off the paths
  const debrisCols =
    theme === 'lounge'
      ? [0x3b2a1c, 0x58432b, 0x2a2420]
      : theme === 'stores'
        ? [0x3a3f46, 0x4a3a26, 0x24262a]
        : theme === 'arcade'
          ? // What is on an arcade floor at four in the morning: trodden
            // tickets, a paper cup, and the card off a machine nobody plays.
            [0xd8cdb0, 0xb9a98a, 0x2a2430]
          : [0x8a8f8a, 0x5c5a52, 0x3a3d3a];
  const bits = Math.round((def.halfW * def.halfD) / 14);
  for (let i = 0; i < bits; i++) {
    const x = (r() * 2 - 1) * (def.halfW - 1.5);
    const z = (r() * 2 - 1) * (def.halfD - 1.5);
    if (solid(x, z)) continue;
    const w = 0.15 + r() * 0.5;
    const d = 0.1 + r() * 0.4;
    const h = 0.05 + r() * 0.16;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: debrisCols[Math.floor(r() * debrisCols.length)] }));
    m.position.set(x, h / 2, z);
    m.rotation.y = r() * Math.PI;
    scene.add(m);
  }

  // wall grime: dark panels low on the walls, and a few tall streaks
  const streak = new THREE.MeshBasicMaterial({ color: 0x050406, transparent: true, opacity: 0.5, depthWrite: false });
  const walls: Array<[number, number, number, number]> = [
    [0, -def.halfD + 0.03, def.halfW * 2, 0],
    [0, def.halfD - 0.03, def.halfW * 2, Math.PI],
    [-def.halfW + 0.03, 0, def.halfD * 2, Math.PI / 2],
    [def.halfW - 0.03, 0, def.halfD * 2, -Math.PI / 2],
  ];
  // WHICH WALL HAS A HOLE IN IT, AND WHERE.  Grime is painted along each wall
  // without knowing what is in it, and the arcade's left wall has a doorway:
  // two of these landed across the opening and hung there as black slabs in
  // it, because they are unlit basic material and the recess behind them is
  // not.  The way through is the one thing on that wall the player is meant
  // to be able to read, so nothing is painted over it.
  const open = def.wallOpening;
  const openSide = open ? (open.side === 'left' ? -1 : 1) * (def.halfW - 0.03) : null;
  for (const [wx, wz, len, rot] of walls) {
    const n = Math.round(len / 6);
    const sideWall = rot === Math.PI / 2 || rot === -Math.PI / 2;
    const cutsTheDoor = open !== undefined && openSide !== null && sideWall && Math.abs(wx - openSide) < 0.1;
    for (let i = 0; i < n; i++) {
      const along = (r() - 0.5) * (len - 2);
      const w = 0.6 + r() * 2.4;
      const h = 0.6 + r() * (def.wallH - 0.8);
      // Clear of the opening by its own half-width plus this streak's, so a
      // wide one beside the door does not lap over its edge either.
      if (cutsTheDoor && open && Math.abs(along - open.z) < (open.w + w) / 2 + 0.3) continue;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), streak);
      m.position.set(wx + (rot === 0 || rot === Math.PI ? along : 0), h / 2 + 0.01, wz + (rot === 0 || rot === Math.PI ? 0 : along));
      m.rotation.y = rot;
      scene.add(m);
    }
  }

  // theme props
  if (theme === 'ward') {
    // drip stands and a wheelchair's worth of tubing: thin verticals
    for (let i = 0; i < 6; i++) {
      const x = (r() * 2 - 1) * (def.halfW - 3);
      const z = (r() * 2 - 1) * (def.halfD - 3);
      if (solid(x, z)) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), new THREE.MeshLambertMaterial({ color: 0x9aa0a0 }));
      pole.position.set(x, 0.9, z);
      scene.add(pole);
    }
  } else if (theme === 'stores') {
    // pipes along the ceiling
    for (let i = 0; i < 4; i++) {
      const z = -def.halfD + 3 + r() * (def.halfD * 2 - 6);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, def.halfW * 2, 8), new THREE.MeshLambertMaterial({ color: 0x2f3338 }));
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, def.wallH - 0.35 - r() * 0.3, z);
      scene.add(pipe);
    }
  } else if (theme === 'arcade') {
    // TICKETS.  Nothing tall and nothing against the back wall: the back wall
    // is the prize case and the staff door, and a picture frame hung on it
    // ends up inside the glass.  What the room gets instead is the litter an
    // arcade floor has on it -- run-out tickets, flat, where they fell.
    for (let i = 0; i < 14; i++) {
      const x = (r() * 2 - 1) * (def.halfW - 2);
      const z = (r() * 2 - 1) * (def.halfD - 2);
      if (solid(x, z)) continue;
      const t = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16 + r() * 0.5, 0.1 + r() * 0.12),
        new THREE.MeshLambertMaterial({ color: r() < 0.5 ? 0xd8cdb0 : 0xe0b85e }),
      );
      t.rotation.x = -Math.PI / 2;
      t.rotation.z = r() * Math.PI;
      t.position.set(x, 0.016, z);
      scene.add(t);
    }
  } else {
    // a rug, and pictures on the walls
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.2), new THREE.MeshLambertMaterial({ color: 0x4a2a2e }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.008, 2);
    scene.add(rug);
    for (let i = 0; i < 4; i++) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.05), new THREE.MeshLambertMaterial({ color: 0x1a1410 }));
      frame.position.set((r() * 2 - 1) * (def.halfW - 3), 1.7, -def.halfD + 0.3);
      frame.rotation.z = (r() - 0.5) * 0.3;
      scene.add(frame);
    }
  }
}
