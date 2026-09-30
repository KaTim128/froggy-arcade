/**
 * THE SLOT TOKENS.  Eight symbols, each a small piece of pixel art with its
 * own silhouette -- not one coin in eight colours -- so a symbol reads from
 * its outline alone at twelve pixels:
 *
 *   token_1        bronze lily-pad coin     a round coin with the pad's notch
 *   token_3        green frog token         Froggy's head: two eye bumps
 *   token_5        blue pond token          a square tile, cut corners, ripples
 *   token_10       purple royal medallion   a scalloped medal with a crown
 *   token_20       red firefly token        a diamond with a glowing firefly
 *   token_50       gold lily token          a five-petal flower
 *   token_100      rainbow crystal token    a tall cut gem in bands of colour
 *   golden_froggy  golden frog statue       a whole frog sitting on a plinth
 *
 * Each is painted once into its own texture, at a fixed size, and drawn at
 * 1:1 -- centred in the reel cell, never scaled -- so nothing is stretched,
 * squashed or cropped.  The outline is worked out from the shape itself, so
 * the border always follows the silhouette.
 */

import Phaser from 'phaser';

export type SymbolId =
  | 'token_1'
  | 'token_3'
  | 'token_5'
  | 'token_10'
  | 'token_20'
  | 'token_50'
  | 'token_100'
  | 'golden_froggy';

/** Every token is painted on the same square, so they line up across the reels. */
export const ICON = 12;

type Paint = (x: number, y: number) => number | null;

interface Art {
  /** The body: a colour inside the silhouette, null outside it. */
  body: Paint;
  /** The border colour, laid on every edge pixel of the silhouette. */
  edge: number;
  /** Detail painted over the body (and over the border where it says so). */
  over?: Paint;
}

const C = (ICON - 1) / 2;
/** A body drawn by hand: one character a pixel, '.' for nothing. */
function drawn(rows: string[], pal: Record<string, number>): Paint {
  return (x, y) => {
    const ch = rows[y]?.[x];
    return ch === undefined || ch === '.' ? null : (pal[ch] ?? null);
  };
}

const dist = (x: number, y: number, cx = C, cy = C) => Math.hypot(x - cx, y - cy);

const ART: Record<SymbolId, Art> = {
  // A round bronze coin with a lily pad's wedge cut out of the top, and the
  // pad's veins running out from the middle.
  token_1: {
    edge: 0x3a1c0a,
    body: (x, y) => {
      if (dist(x, y) > 5.8) return null;
      if (y < C - 1 && Math.abs(x - C) < (C - y) * 0.25 + 0.1) return null;
      if (x + y < 7) return 0xe7a468;
      if (x + y > 15) return 0x9a5a28;
      return 0xc88442;
    },
    over: (x, y) => {
      if (dist(x, y) > 4.4 || y < C) return null;
      const dx = x - C;
      const dy = y - C;
      if (Math.abs(Math.abs(dx) - dy) < 0.6) return 0x8a4a1c;
      return null;
    },
  },

  // Froggy's own face: a wide head with two eye bumps on top, the white eyes
  // and pupils, and the long flat mouth.
  token_3: {
    edge: 0x0f3d24,
    body: (x, y) => {
      const head = ((x - C) / 5.9) ** 2 + ((y - 7.4) / 4.3) ** 2 <= 1;
      const eyeL = dist(x, y, 3, 3.2) <= 2.6;
      const eyeR = dist(x, y, 8, 3.2) <= 2.6;
      if (!head && !eyeL && !eyeR) return null;
      return y > 8 ? 0x2cb877 : 0x46e6a0;
    },
    over: (x, y) => {
      for (const ex of [3, 8]) {
        if (x === ex && y === 3) return 0x111111;
        if (dist(x, y, ex, 3.2) <= 1.5) return 0xffffff;
      }
      if (y === 8 && x >= 3 && x <= 8) return 0x0f3d24;
      if (y === 7 && (x === 2 || x === 9)) return 0xff9aa8;
      return null;
    },
  },

  // A square pond tile with its corners cut, deep at the bottom, and two
  // ripples of light across it.
  token_5: {
    edge: 0x0b1f4a,
    body: (x, y) => {
      const ix = Math.min(x, ICON - 1 - x);
      const iy = Math.min(y, ICON - 1 - y);
      if (y < 1 || y > ICON - 2) return null;
      if (ix + iy < 3) return null;
      return y > 7 ? 0x1d4fa0 : 0x2f7fe0;
    },
    over: (x, y) => {
      const ring = ((x - C) / 3.6) ** 2 + ((y - 6) / 2.3) ** 2;
      if (Math.abs(ring - 1) < 0.3) return 0x9fd8ff;
      if (((x - C) / 1.3) ** 2 + ((y - 6) / 0.7) ** 2 <= 1) return 0xd8f2ff;
      if (x === 3 && y === 2) return 0xffffff;
      return null;
    },
  },

  // A medal with a scalloped rim in royal purple, a darker inner disc and a
  // little gold crown in the middle.
  token_10: {
    edge: 0x2a0f50,
    body: (x, y) => {
      // two ribbon tails hanging under the disc, cut in a V
      if (y >= 8 && ((x >= 2 && x <= 4) || (x >= 7 && x <= 9))) {
        if (y === 11 && (x === 3 || x === 8)) return null;
        return 0xe0405a;
      }
      const r = dist(x, y, C, 4.6);
      if (r > 4.7) return null;
      return r < 3.2 ? 0x5a2aa8 : 0xa06af0;
    },
    over: (x, y) => {
      // a crown: three points, then the band with its jewel
      const mid = x === 5 || x === 6;
      const band = x >= 4 && x <= 7;
      if (y === 2 && mid) return 0xffd45e;
      if (y === 3 && (x === 4 || x === 7 || mid)) return 0xffd45e;
      if (y === 4 && band) return 0xffd45e;
      if (y === 5 && band) return mid ? 0xff4f6a : 0xffd45e;
      if (y === 6 && band) return 0xd9a020;
      return null;
    },
  },

  // A red diamond with a firefly on it: dark head, pale wings, and the tail
  // lit up yellow.
  token_20: {
    edge: 0x3a0610,
    body: (x, y) => {
      const d = Math.abs(x - C) + Math.abs(y - C);
      if (d > 6.2) return null;
      return d > 4 ? 0xb01830 : 0xff4a4a;
    },
    over: (x, y) => {
      if ((x === 5 || x === 6) && y === 3) return 0x2a0a10; // head
      if ((x === 4 || x === 7) && (y === 4 || y === 5)) return 0xffe0e8; // wings
      if ((x === 5 || x === 6) && (y === 4 || y === 5)) return 0x5a1020; // body
      if ((x === 5 || x === 6) && (y === 6 || y === 7)) return 0xfff27a; // the glow
      if ((x === 5 || x === 6) && y === 8) return 0xffb830;
      return null;
    },
  },

  // A gold lily: a tall middle petal between two that curl outwards, a warm
  // heart, and the flower sitting on a green pad.
  token_50: {
    edge: 0x5a3a00,
    body: drawn(
      [
        '.....kk.....',
        '....kyyk....',
        '.k..kyyk..k.',
        'kyk.kllk.kyk',
        'kyykkllkkyyk',
        '.kyykyykyyk.',
        '.kyyyooyyyk.',
        '..kyyooyyk..',
        '...kyyyyk...',
        '..kgksskgk..',
        '.kggggggggk.',
        '..kkkkkkkk..',
      ],
      { k: 0x5a3a00, y: 0xffc830, l: 0xfff0a0, o: 0xff8a20, s: 0xd08a10, g: 0x3fae5a },
    ),
  },

  // A tall cut crystal: a stretched hexagon striped through the rainbow on
  // the slant, with a white glint down one facet.
  token_100: {
    edge: 0x24123a,
    body: (x, y) => {
      const dy = Math.abs(y - C);
      const half = 3.6 - Math.max(0, dy - 2.5) * 0.9;
      if (Math.abs(x - C) > half) return null;
      const bands = [0xff4a4a, 0xff9a30, 0xffe24a, 0x4ae07a, 0x4aa8ff, 0xa06af0];
      return bands[Math.floor(((x + y) / 22) * bands.length) % bands.length];
    },
    over: (x, y) => {
      if (x === 4 && y >= 3 && y <= 7) return 0xffffff;
      if (x === 5 && y === 1) return 0xffffff;
      return null;
    },
  },

  // A whole frog sitting on a plinth, cast in gold: eye bumps, a wide mouth,
  // arms at its sides, feet, and the light catching its left side.
  golden_froggy: {
    edge: 0x5a3a00,
    body: drawn(
      [
        '..kkk..kkk..',
        '.klekkkkeyk.',
        'klyyyyyyyyyk',
        'klssssssssyk',
        '.kyyyyyyyyk.',
        '.kykyyyykyk.',
        'kyykyyyykyyk',
        'klykyyyykysk',
        'klyykkkkyysk',
        '.kkkkkkkkkk.',
        '.klsssssssk.',
        'kkkkkkkkkkkk',
      ],
      { k: 0x5a3a00, y: 0xffc830, l: 0xfff0a0, s: 0xc08010, e: 0x3a2400 },
    ),
  },
};

export const SYMBOL_IDS = Object.keys(ART) as SymbolId[];

export const textureOf = (id: SymbolId): string => `slot_${id}`;

/** Paint the eight tokens into textures, once per game. */
export function ensureSlotSymbols(scene: Phaser.Scene): void {
  for (const id of SYMBOL_IDS) {
    const key = textureOf(id);
    if (scene.textures.exists(key)) continue;
    const art = ART[id];
    const tex = scene.textures.createCanvas(key, ICON, ICON);
    if (!tex) continue;
    const ctx = tex.getContext();
    const inside = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < ICON && y < ICON && art.body(x, y) !== null;
    for (let y = 0; y < ICON; y++) {
      for (let x = 0; x < ICON; x++) {
        const base = art.body(x, y);
        if (base === null) continue;
        const rim = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        const colour = rim ? art.edge : (art.over?.(x, y) ?? base);
        ctx.fillStyle = `#${colour.toString(16).padStart(6, '0')}`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    tex.refresh();
  }
}
