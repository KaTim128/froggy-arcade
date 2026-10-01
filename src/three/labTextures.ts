/**
 * The laboratory's surfaces, painted once on canvases.
 *
 * Small, tiled, and dark: stained floor tile with grout and a drain, poured
 * concrete with water marks and bolt holes, grimy wall tile, yellow-and-black
 * hazard stripe, and the lettering on the signs.  Every texture is made on
 * first use and shared after that, so a second visit to the lab costs nothing.
 */

import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d') as CanvasRenderingContext2D];
}

/** A seeded random, so the stains are the same every visit. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function tex(key: string, make: () => HTMLCanvasElement, repeat?: [number, number]): THREE.Texture {
  const k = `${key}:${repeat?.join('x') ?? ''}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const t = new THREE.CanvasTexture(make());
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  cache.set(k, t);
  return t;
}

/** Stains: soft dark blotches, a few rust-coloured. */
function stains(ctx: CanvasRenderingContext2D, w: number, h: number, r: () => number, n: number, alpha: number): void {
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 8 + r() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const rust = r() < 0.25;
    g.addColorStop(0, rust ? `rgba(70,40,20,${alpha})` : `rgba(0,0,0,${alpha})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

/** 2x2 floor tiles per texture, stained, with dark grout. */
export function floorTile(repeat: [number, number]): THREE.Texture {
  return tex(
    'floor',
    () => {
      const [c, ctx] = canvas(256, 256);
      const r = rng(11);
      ctx.fillStyle = '#20282b';
      ctx.fillRect(0, 0, 256, 256);
      for (let ty = 0; ty < 2; ty++) {
        for (let tx = 0; tx < 2; tx++) {
          const v = 30 + Math.floor(r() * 10);
          ctx.fillStyle = `rgb(${v},${v + 8},${v + 10})`;
          ctx.fillRect(tx * 128 + 3, ty * 128 + 3, 122, 122);
          // a faint sheen on each tile
          const g = ctx.createLinearGradient(tx * 128, ty * 128, tx * 128 + 128, ty * 128 + 128);
          g.addColorStop(0, 'rgba(255,255,255,0.05)');
          g.addColorStop(1, 'rgba(0,0,0,0.06)');
          ctx.fillStyle = g;
          ctx.fillRect(tx * 128 + 3, ty * 128 + 3, 122, 122);
        }
      }
      stains(ctx, 256, 256, r, 14, 0.35);
      // hairline cracks
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        let x = r() * 256;
        let y = r() * 256;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += (r() - 0.5) * 30;
          y += (r() - 0.5) * 30;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      return c;
    },
    repeat,
  );
}

/** Poured concrete: mottled, water-streaked down from the top, with bolt holes. */
export function concrete(repeat: [number, number]): THREE.Texture {
  return tex(
    'concrete',
    () => {
      const [c, ctx] = canvas(256, 256);
      const r = rng(23);
      ctx.fillStyle = '#3a4043';
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2200; i++) {
        const v = 40 + Math.floor(r() * 30);
        ctx.fillStyle = `rgba(${v},${v + 4},${v + 6},0.35)`;
        ctx.fillRect(r() * 256, r() * 256, 2, 2);
      }
      // streaks down from the top
      for (let i = 0; i < 18; i++) {
        const x = r() * 256;
        const g = ctx.createLinearGradient(0, 0, 0, 120 + r() * 136);
        g.addColorStop(0, 'rgba(10,12,12,0.35)');
        g.addColorStop(1, 'rgba(10,12,12,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, 0, 2 + r() * 5, 256);
      }
      stains(ctx, 256, 256, r, 8, 0.3);
      // form-tie holes in a grid
      ctx.fillStyle = 'rgba(8,8,8,0.7)';
      for (const [x, y] of [
        [40, 60],
        [168, 60],
        [40, 188],
        [168, 188],
      ])
        ctx.beginPath(), ctx.arc(x, y, 3, 0, Math.PI * 2), ctx.fill();
      // a seam
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 127, 256, 2);
      return c;
    },
    repeat,
  );
}

/** Small square wall tile, grimy, a few cracked or missing. */
export function wallTile(repeat: [number, number]): THREE.Texture {
  return tex(
    'walltile',
    () => {
      const [c, ctx] = canvas(256, 256);
      const r = rng(37);
      ctx.fillStyle = '#1b2224';
      ctx.fillRect(0, 0, 256, 256);
      const n = 8;
      const s = 256 / n;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (r() < 0.04) continue; // a missing one
          const v = 58 + Math.floor(r() * 16);
          ctx.fillStyle = `rgb(${v - 10},${v + 6},${v + 4})`;
          ctx.fillRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3);
        }
      }
      // grime pooled at the bottom
      const g = ctx.createLinearGradient(0, 120, 0, 256);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(10,8,4,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      stains(ctx, 256, 256, r, 6, 0.3);
      return c;
    },
    repeat,
  );
}

/** Yellow and black, diagonal. */
export function hazard(repeat: [number, number]): THREE.Texture {
  return tex(
    'hazard',
    () => {
      const [c, ctx] = canvas(128, 32);
      ctx.fillStyle = '#16140f';
      ctx.fillRect(0, 0, 128, 32);
      ctx.fillStyle = '#d8a824';
      for (let x = -32; x < 160; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 32);
        ctx.lineTo(x + 16, 32);
        ctx.lineTo(x + 32, 0);
        ctx.lineTo(x + 16, 0);
        ctx.fill();
      }
      // worn: scuffs through the paint
      const r = rng(5);
      ctx.fillStyle = 'rgba(20,18,14,0.5)';
      for (let i = 0; i < 40; i++) ctx.fillRect(r() * 128, r() * 32, 2 + r() * 6, 1);
      return c;
    },
    repeat,
  );
}

/** Frost, for the inside of the glass. */
export function frost(): THREE.Texture {
  return tex(
    'frost',
    () => {
      const [c, ctx] = canvas(128, 256);
      const r = rng(71);
      ctx.fillStyle = 'rgba(230,248,255,0.25)';
      ctx.fillRect(0, 0, 128, 256);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 90; i++) {
        const x = r() * 128;
        const y = r() * 256;
        const len = 4 + r() * 16;
        for (let k = 0; k < 3; k++) {
          const a = r() * Math.PI * 2;
          ctx.lineWidth = 0.6 + r();
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
          ctx.stroke();
        }
      }
      return c;
    },
    [3, 1],
  );
}

/** A soft round puff, for steam and dust. */
export function puff(): THREE.Texture {
  return tex('puff', () => {
    const [c, ctx] = canvas(64, 64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  });
}

export interface SignOpts {
  /** Text colour and plate colour. */
  fg?: string;
  bg?: string;
  /** A hazard-stripe band along the top. */
  stripe?: boolean;
  /** A trefoil (the biohazard mark) at the left. */
  bio?: boolean;
  w?: number;
  h?: number;
}

/**
 * A sign: stencilled capitals on a painted metal plate, worn at the edges.
 * One or more lines; the first is the big one.
 */
export function signTexture(lines: string[], o: SignOpts = {}): THREE.Texture {
  const key = `sign:${lines.join('|')}:${o.fg}:${o.bg}:${o.stripe}:${o.bio}:${o.w}x${o.h}`;
  return tex(key, () => {
    const w = o.w ?? 512;
    const h = o.h ?? 160;
    const [c, ctx] = canvas(w, h);
    ctx.fillStyle = o.bg ?? '#d9d3c2';
    ctx.fillRect(0, 0, w, h);
    const r = rng(lines.join('').length * 13 + 7);
    // worn paint
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(40,30,20,${0.05 + r() * 0.12})`;
      ctx.fillRect(r() * w, r() * h, 1 + r() * 5, 1 + r() * 3);
    }
    let top = 0;
    if (o.stripe) {
      const sh = Math.round(h * 0.16);
      ctx.fillStyle = '#16140f';
      ctx.fillRect(0, 0, w, sh);
      ctx.fillStyle = '#d8a824';
      for (let x = -sh; x < w + sh; x += sh * 2) {
        ctx.beginPath();
        ctx.moveTo(x, sh);
        ctx.lineTo(x + sh, sh);
        ctx.lineTo(x + sh * 2, 0);
        ctx.lineTo(x + sh, 0);
        ctx.fill();
      }
      top = sh;
    }
    let left = 16;
    if (o.bio) {
      const cx = h * 0.42 + 8;
      const cy = top + (h - top) / 2;
      const rr = (h - top) * 0.3;
      ctx.fillStyle = o.fg ?? '#1a1a1a';
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * rr * 0.55, cy + Math.sin(a) * rr * 0.55, rr * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = o.bg ?? '#d9d3c2';
      ctx.beginPath();
      ctx.arc(cx, cy, rr * 0.28, 0, Math.PI * 2);
      ctx.fill();
      left = cx + rr + 18;
    }
    ctx.fillStyle = o.fg ?? '#1a1a1a';
    ctx.textBaseline = 'middle';
    const body = h - top;
    const big = Math.round(body * (lines.length > 1 ? 0.36 : 0.5));
    const small = Math.round(body * 0.2);
    ctx.font = `bold ${big}px "Courier New", monospace`;
    const first = lines[0];
    ctx.fillText(first, left, top + (lines.length > 1 ? body * 0.33 : body * 0.52), w - left - 12);
    ctx.font = `bold ${small}px "Courier New", monospace`;
    for (let i = 1; i < lines.length; i++) ctx.fillText(lines[i], left, top + body * (0.62 + (i - 1) * 0.24), w - left - 12);
    // a dark border, and rivets in the corners
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = 'rgba(60,60,60,0.9)';
    for (const [x, y] of [
      [12, 12],
      [w - 12, 12],
      [12, h - 12],
      [w - 12, h - 12],
    ])
      ctx.beginPath(), ctx.arc(x, y, 4, 0, Math.PI * 2), ctx.fill();
    return c;
  });
}

/**
 * A screen: a canvas that is redrawn when what it says changes.  `draw` gets
 * the context and its size; call `update` after changing what it draws from.
 */
export function screen(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const [c, ctx] = canvas(w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const update = (): void => {
    draw(ctx, w, h);
    t.needsUpdate = true;
  };
  update();
  return { texture: t, update };
}
