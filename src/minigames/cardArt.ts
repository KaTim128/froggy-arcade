/**
 * FROGGY'S CARDS.  The deck is still fifty-two cards with the values
 * blackjack gives them; only the faces are his.
 *
 *   SUITS    lily pad (was clubs), firefly (hearts), pond drop (diamonds)
 *            and tadpole (spades) -- each its own colour and shape, so a suit
 *            reads without the rank beside it.
 *   FACES    the Jack is the FROG SCOUT (leaf cap and feather, a scarf), the
 *            Queen the FROG MAGE (pointed hat with a star, a robe) and the
 *            King the FROG KING (gold crown, red robe with ermine).  All three
 *            are still worth ten.
 *   BACK     the arcade's own: the pink cabinet trim, a purple field with
 *            lily pads, and Froggy's face in the middle.
 *
 * Painted once into textures and drawn 1:1, so they stay crisp.
 */

import Phaser from 'phaser';

export const CARD_W = 22;
export const CARD_H = 30;
export const SUIT_PX = 7;
export const FACE_W = 14;
export const FACE_H = 16;

/** The deck's own suit characters, and what each one is at this table. */
export const SUIT_OF: Record<string, { key: string; name: string; ink: number }> = {
  '♣': { key: 'card_suit_lily', name: 'LILY', ink: 0x2a7a3a },
  '♥': { key: 'card_suit_firefly', name: 'FIREFLY', ink: 0xc0302a },
  '♦': { key: 'card_suit_pond', name: 'POND', ink: 0x1d5fb0 },
  '♠': { key: 'card_suit_tadpole', name: 'TADPOLE', ink: 0x3a2a5a },
};

/** What the face cards are called, and the letter in their corner. */
export const FACE_OF: Record<string, { key: string; name: string; corner: string }> = {
  J: { key: 'card_face_scout', name: 'FROG SCOUT', corner: 'S' },
  Q: { key: 'card_face_mage', name: 'FROG MAGE', corner: 'M' },
  K: { key: 'card_face_king', name: 'FROG KING', corner: 'K' },
};

export const CARD_BACK = 'card_back';

type Pal = Record<string, number>;

const SUITS: Record<string, { rows: string[]; pal: Pal }> = {
  card_suit_lily: {
    rows: ['.gg.gg.', 'ggg.ggg', 'gggdggg', 'ggdgdgg', 'ggggggg', '.ggggg.', '..ggg..'],
    pal: { g: 0x3fae5a, d: 0x1f6a32 },
  },
  card_suit_firefly: {
    rows: ['..kkk..', 'ww.k.ww', 'wwkkkww', '.wkrkw.', '..yyy..', '..yyy..', '...y...'],
    pal: { k: 0x5a1020, w: 0xf2c8d0, r: 0xc0302a, y: 0xffc830 },
  },
  card_suit_pond: {
    rows: ['...b...', '..bbb..', '.bbbbb.', '.blbbb.', 'bblbbbb', 'bbbbbbd', '.bbbdd.'],
    pal: { b: 0x2f7fe0, l: 0xbfe6ff, d: 0x1d4fa0 },
  },
  card_suit_tadpole: {
    rows: ['.ppp...', 'ppppp..', 'pwppp..', 'ppppp..', '.ppp.p.', '...pp.p', '....pp.'],
    pal: { p: 0x3a2a5a, w: 0xd8d0f0 },
  },
};

/** A frog's face, shared by the three court cards; the hats and collars differ. */
const HEAD = [
  '..kkk....kkk..',
  '.kwwek..kewwk.',
  '.kgggkkkkgggk.',
  'kggggggggggggk',
  'kgpggggggggpgk',
  'kgkkkkkkkkkkgk',
  '.kggggggggggk.',
  '..kkkkkkkkkk..',
];
const FACE_PAL: Pal = { k: 0x123a22, w: 0xffffff, e: 0x111111, g: 0x46c46e, p: 0xff9aa8 };

const FACES: Record<string, { hat: string[]; collar: string[]; pal: Pal }> = {
  card_face_scout: {
    hat: [
      '..........f...',
      '.........ff...',
      '.....llllf....',
      '....llllll....',
      '...llLllLll...',
      '..LLLLLLLLLL..',
    ],
    collar: ['...oooooooo...', '..oooo..oooo..'],
    pal: { f: 0xff4f6a, l: 0x8a6a2a, L: 0x5a4418, o: 0xff8a20 },
  },
  card_face_mage: {
    hat: [
      '......mm......',
      '.....mmmm.....',
      '.....mymm.....',
      '....mmmmmm....',
      '...mmmmymmm...',
      '.mmmmmmmmmmmm.',
    ],
    collar: ['..bbbbbbbbbb..', '.bbbbbybbbbbb.'],
    pal: { m: 0x7a3ad0, y: 0xffe24a, b: 0x2f5fc0 },
  },
  card_face_king: {
    hat: [
      '..............',
      '...y..yy..y...',
      '...yy.yy.yy...',
      '...yyyyyyyy...',
      '...yyryyryy...',
      '...yyyyyyyy...',
    ],
    collar: ['.rrrrwwwwrrrr.', 'rrrrrwwwwrrrrr'],
    pal: { y: 0xffc830, r: 0xc0302a, w: 0xf4ecd8 },
  },
};

function paintRows(scene: Phaser.Scene, key: string, rows: string[], pal: Pal): void {
  if (scene.textures.exists(key)) return;
  const w = Math.max(...rows.map((r) => r.length));
  const tex = scene.textures.createCanvas(key, w, rows.length);
  if (!tex) return;
  const ctx = tex.getContext();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]];
      if (c === undefined) continue;
      ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  tex.refresh();
}

/** The back: pink trim, a purple field of lily pads, Froggy in the middle. */
function paintBack(scene: Phaser.Scene): void {
  if (scene.textures.exists(CARD_BACK)) return;
  const rows: string[] = [];
  for (let y = 0; y < CARD_H; y++) {
    let row = '';
    for (let x = 0; x < CARD_W; x++) {
      const edge = Math.min(x, y, CARD_W - 1 - x, CARD_H - 1 - y);
      if (edge === 0) row += 'k';
      else if (edge === 1) row += 'P';
      else if (edge === 2) row += (x + y) % 2 ? 'd' : 'y';
      // a lattice of small pads over the field
      else if ((x + 2 * y) % 8 === 0 && (x - 2 * y + 64) % 8 === 0) row += 'g';
      else row += 'd';
    }
    rows.push(row);
  }
  // Froggy's face in the middle of it
  const ox = Math.floor((CARD_W - HEAD[0].length) / 2);
  const oy = Math.floor((CARD_H - HEAD.length) / 2);
  HEAD.forEach((line, y) => {
    const chars = rows[oy + y].split('');
    for (let x = 0; x < line.length; x++) if (line[x] !== '.') chars[ox + x] = line[x];
    rows[oy + y] = chars.join('');
  });
  paintRows(scene, CARD_BACK, rows, {
    ...FACE_PAL,
    P: 0xff4fa3,
    d: 0x3a1742,
    y: 0xffc830,
    g: 0x2c7a44,
  });
}

/** Everything the table draws a card with.  Once per game. */
export function ensureCardArt(scene: Phaser.Scene): void {
  for (const [key, s] of Object.entries(SUITS)) paintRows(scene, key, s.rows, s.pal);
  for (const [key, f] of Object.entries(FACES)) paintRows(scene, key, [...f.hat, ...HEAD, ...f.collar], { ...FACE_PAL, ...f.pal });
  paintBack(scene);
}
