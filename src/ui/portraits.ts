/**
 * WHO IS TALKING.  Every person in the game who speaks gets the box Froggy
 * talks in: a solid panel, a framed portrait on the left, the words beside
 * it -- and the panel's edge in that person's own colour (the staffer's pink
 * cap, the clerk's gold badge, the barber's white tunic).
 *
 * The portrait is drawn with whatever draws them in the room, so it is the
 * same person: the staff behind counters with their own figure painters
 * (reduced to the world's pixels, as they are where they stand), everybody
 * built on the drifter's rig from their rig look, head and shoulders, three
 * times size.
 */

import Phaser from 'phaser';
import { COLS, LOOKS, type Look } from '../art/player';
import { StageFigure } from '../render/stageFigure';
import type { FroggyPainter } from '../render/froggyLayer';
import { drawStaffer } from '../froggy/staffer';
import { drawClerk } from '../froggy/clerk';
import { drawSuitedMan } from '../froggy/suit';

export interface Speaker {
  name: string;
  /** The panel's edge and the name. */
  color: number;
  /** The well behind the face. */
  well: number;
  /** Built on the drifter's rig... */
  look?: Look;
  /** ...or painted by their own figure painter, feet at (x, y), `h` tall. */
  painter?: (x: number, y: number, h: number) => FroggyPainter;
}

/**
 * The barber: white tunic, slick hair, a waxed handlebar moustache -- thick
 * under the nose, sweeping out and curling UP at both ends, past his cheeks.
 * (Waxed a warm brown, with lighter tips, so the curls read against his hair.)
 */
export const BARBER_LOOK: Look = {
  cols: {
    C: 0xf2f2ee, c: 0xffffff, D: 0xc8c8c0, w: 0xf2f2ee,
    r: 0x1e1814, S: 0xd8a880, s: 0xb88860, G: 0xd8a880, g: 0xb88860,
    M: 0x6a4026, m: 0x9a6a3a, J: 0x2a2a30, j: 0x1e1e24, K: 0x141010, W: 0x2a2020, T: 0x141010,
  },
  head: [
    '............',
    '...rrrrrr...',
    '..rrrrrrrrr.',
    'm.rSSSSSSr.m',
    '.MrSSSSSSsM.',
    '..MMMMMMMM..',
    '...SSSSSs...',
    '....SSSs....',
    '.....ss.....',
  ],
};

/** The woman who runs the furniture shop. */
export const KEEPER_LOOK: Look = {
  cols: { C: 0x8a3a5a, c: 0xa04a6a, D: 0x6a2a44, r: 0x6a4a3a, S: 0xe8c8a8, s: 0xc8a080, G: 0xe8c8a8, g: 0xc8a080, w: 0xf0e0c8, J: 0x3a3a48, j: 0x2a2a38, B: 0x6a4a3a, b: 0x6a4a3a },
  head: ['....rrrr....', '...rrrrrr...', '..rrrrrrrr..', '..rSSSSSSr..', '.rrSSSSSSsr.', '.rrSSSSSsrr.', '..rSSSSSsr..', '....SSSs....', '.....ss.....'],
};

/** The clothes shop's assistant, in black. */
export const ASSISTANT_LOOK: Look = {
  cols: { C: 0x2a2a3a, c: 0x3a3a52, D: 0x1a1a28, w: 0xf0e0e8, r: 0x1e1814, S: 0xa87a58, s: 0x86603e, G: 0xa87a58, g: 0x86603e, B: 0x1e1814, b: 0x1e1814 },
  head: ['...rrrrrr...', '..rrrrrrrr..', '.rrrrrrrrrr.', '.rrSSSSSSrr.', '.rrSSSSSSsr.', '..rSSSSSsr..', '...SSSSSs...', '....SSSs....', '.....ss.....'],
};

export const SPEAKERS = {
  staffer: {
    name: 'ARCADE STAFF',
    color: 0xff4fa3,
    well: 0x3a1a30,
    painter: (x: number, y: number, h: number) => (ctx: CanvasRenderingContext2D) => drawStaffer(ctx, { x, y, height: h, pose: 'idle' }),
  },
  clerk: {
    name: 'CONCIERGE',
    color: 0xc9a24a,
    well: 0x2a2416,
    painter: (x: number, y: number, h: number) => (ctx: CanvasRenderingContext2D) => drawClerk(ctx, { x, y, height: h }),
  },
  dealer: {
    name: 'DEALER',
    color: 0xb83848,
    well: 0x281418,
    painter: (x: number, y: number, h: number) => (ctx: CanvasRenderingContext2D) => drawSuitedMan(ctx, { x, y, height: h, pose: 'idle' }),
  },
  man: { name: 'THE MAN IN BLACK', color: 0x8a8a9a, well: 0x1a1c24, look: LOOKS.stranger },
  doorman: { name: 'DOORMAN', color: 0xc04a5a, well: 0x2a1218, look: LOOKS.doorman },
  officer: { name: 'OFFICER', color: 0x6a8ad8, well: 0x141a30, look: LOOKS.officer },
  guard: { name: 'GUARD', color: 0x8a94a8, well: 0x1a1e28, look: LOOKS.guard },
  barber: { name: 'BARBER', color: 0xf2f2ee, well: 0x2a5a4a, look: BARBER_LOOK },
  keeper: { name: 'SHOPKEEPER', color: 0xd06a8a, well: 0x3a1a28, look: KEEPER_LOOK },
  assistant: { name: 'ASSISTANT', color: 0xe04a8a, well: 0x2a1a24, look: ASSISTANT_LOOK },
} satisfies Record<string, Speaker>;

export type SpeakerId = keyof typeof SPEAKERS;

/** The well: a small square beside the words, head and shoulders only. */
export const WELL_W = 34;
/** It never grows with the panel: a long line must not stretch the face. */
export const WELL_H = 36;

/**
 * Put `who`'s portrait in the well at (x, y, w, h).  What it adds goes into
 * `parts` (to live and die with the panel); a painted figure is its own
 * screen-space layer at `depth`, destroyed with `owner`.
 */
export function addPortrait(
  scene: Phaser.Scene,
  owner: Phaser.GameObjects.GameObject,
  parts: Phaser.GameObjects.GameObject[],
  who: Speaker,
  x: number,
  y: number,
  w: number,
  h: number,
  depth: number,
): void {
  const well = scene.add.rectangle(x, y, w, h, who.well).setOrigin(0, 0).setStrokeStyle(1, who.color, 0.6);
  parts.push(well);
  if (who.painter) {
    // the figure's own painter, big, feet well below the frame: head and chest
    const H = Math.round(h * 2.1);
    const paint = who.painter(x + w / 2, y + 3 + H, H);
    const fig = new StageFigure(scene, depth + 0.5);
    fig.paint((ctx) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 1, y + 1, w - 2, h - 2);
      ctx.clip();
      paint(ctx);
      ctx.restore();
    });
    owner.once(Phaser.GameObjects.Events.DESTROY, () => fig.destroy());
    return;
  }
  parts.push(headAndShoulders(scene, who.look ?? {}, x + w / 2, y, h, w));
}

/**
 * The rig's head, scaled to the well it goes in, with the coat's shoulders
 * under it.  `w` is the well's width: the head is drawn at whatever pixel
 * size keeps it inside, so the same face serves a small frame and a large.
 */
export function headAndShoulders(scene: Phaser.Scene, look: Look, cx: number, top: number, h: number, w = 48): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const rows = look.head ?? HEAD_DEFAULT;
  const k = Math.max(1, Math.floor((w - 8) / 12));
  const x0 = cx - 6 * k;
  const y0 = top + 4;
  const col = (ch: string) => look.cols?.[ch] ?? COLS[ch] ?? 0xff00ff;
  const INK = 0x14100c;
  // shoulders first: the coat, a collar of the scarf, out to the frame's foot
  const sy = y0 + rows.length * k - Math.round(4 * k / 3);
  const sh = top + h - 1 - sy;
  const sw = Math.round(16 * k / 3);
  if (sh > 0) {
    g.fillStyle(INK, 1).fillRect(cx - sw - 1, sy - 1, sw * 2 + 2, sh + 1);
    g.fillStyle(col('C'), 1).fillRect(cx - sw, sy, sw * 2, sh);
    g.fillStyle(col('c'), 1).fillRect(cx - sw, sy, k * 2, sh);
    g.fillStyle(col('D'), 1).fillRect(cx + sw - k * 2, sy, k * 2, sh);
    g.fillStyle(col('w'), 1).fillRect(cx - sw / 2, sy, sw, k);
  }
  // the ink outline, then the pixels over it
  for (const pass of [0, 1])
    rows.forEach((row, ry) =>
      [...row].forEach((ch, rx) => {
        if (ch === '.') return;
        if (pass === 0) g.fillStyle(INK, 1).fillRect(x0 + rx * k - 1, y0 + ry * k - 1, k + 2, k + 2);
        else g.fillStyle(col(ch), 1).fillRect(x0 + rx * k, y0 + ry * k, k, k);
      }),
    );
  // ---- THE FACE, up close.  The rig gives everyone two dots for eyes, which
  // is right at the size they are walked around at and bare in a portrait
  // three times that.  So, in the colours the look already carries: a brow
  // over each eye, a shaded nose between them, a cheek on each side, and a
  // mouth -- but only where there is face to put one on, so a beard or a
  // scarf over the chin is left alone.  Nobody's identity changes: it is the
  // same head, read at the size it is being looked at.
  const at = (rx: number, ry: number): string => rows[ry]?.[rx] ?? '.';
  const skin = (ch: string): boolean => ch === 'S' || ch === 's';
  const EYE_ROW = 4;
  const brow = look.cols?.r ?? COLS.r ?? INK;
  for (const ex of [5, 7]) {
    if (skin(at(ex, EYE_ROW - 1))) g.fillStyle(brow, 0.75).fillRect(x0 + ex * k - 1, y0 + (EYE_ROW - 1) * k + k - 1, k + 1, 1);
  }
  // the nose: a shaded pixel down the middle, a row under the eyes
  if (skin(at(6, EYE_ROW + 1))) g.fillStyle(col('s'), 0.9).fillRect(x0 + 6 * k, y0 + (EYE_ROW + 1) * k, k, k);
  // the cheeks, where the light leaves the face
  for (const cx of [4, 8]) {
    if (skin(at(cx, EYE_ROW + 1))) g.fillStyle(col('s'), 0.5).fillRect(x0 + cx * k, y0 + (EYE_ROW + 1) * k, k, k);
  }
  // the mouth, a row lower again -- only on bare face
  if (skin(at(5, EYE_ROW + 2)) && skin(at(6, EYE_ROW + 2))) {
    g.fillStyle(col('s'), 0.85).fillRect(x0 + 5 * k, y0 + (EYE_ROW + 2) * k + 1, 2 * k, Math.max(1, k - 1));
  }
  // the eyes themselves, with a catchlight: the one pixel that makes a face
  // look at you rather than past you
  for (const ex of [5, 7]) {
    g.fillStyle(col('E'), 1).fillRect(x0 + ex * k, y0 + EYE_ROW * k, k, k);
    if (k > 1) g.fillStyle(0xffffff, 0.75).fillRect(x0 + ex * k, y0 + EYE_ROW * k, 1, 1);
  }
  return g;
}

const HEAD_DEFAULT = ['............', '...rrrrrr...', '..rrrrrrrr..', '..rSSSSSSr..', '..rSSSSSSs..', '...SSSSSs...', '...GGGGGg...', '....GGGg....', '.....gg.....'];
