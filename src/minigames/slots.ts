/**
 * FROGGY SLOTS.  Three tokens a spin, and it keeps taking them.
 *
 * Five reels, six rows.  Every token on the reels pays when it lines up:
 * three, four or five of the same token side by side in a row, anywhere along
 * it, pays that token's prize for that many -- and only the best line on the
 * window is paid, once, never two of them for the same spin.
 *
 *   TOKEN                    RARITY      3     4     5
 *   bronze lily-pad coin     common      1     2     3
 *   purple royal medallion   common      2     3     5
 *   blue ruby tile           uncommon    3     5     8
 *   red firefly diamond      uncommon    3     6    10
 *   gold lily flower         rare        4     7    11
 *   rainbow crystal          rare        4     8    12
 *   FROGGY                   very rare   5    10    15
 *   golden Froggy statue     wild        stands in for any token
 *
 * The odds ARE the reels: each cell is drawn on its own, by the token's
 * weight, and the window pays exactly what is on it.  Common tokens line up
 * often and pay little; Froggy turns up far less and pays the most, and five
 * Froggys across is a jackpot measured in hundreds of thousands of spins.  Most
 * spins pay nothing at all (about six in ten), and the machine hands back
 * roughly a third of what goes in: it is a gamble, and it is meant to feel
 * like one.  The art is in slotSymbols.ts.
 *
 * It is a session, like the blackjack table: nothing is taken at the door,
 * every spin -- the first included -- is raised through the shell as it is
 * pulled, and every win is paid out on the spot through the ledger, into the
 * player's own tokens.  Sitting down and getting straight back up costs
 * nothing.  LEAVE cashes out; QUIT does the same.  Nothing here touches cash.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import { ensureSlotSymbols, textureOf, type SymbolId } from './slotSymbols';
import { buildTemple, GOLD as TEMPLE_GOLD, LAPIS, LAPIS_DK, type Temple } from './slotsTemple';
import type { MinigameApi, MinigameModule } from './types';

export const SPIN_COST = 3;

export type Tier = 'COMMON' | 'UNCOMMON' | 'RARE' | 'V.RARE' | 'WILD';

/**
 * Every token on the reels: how often a cell is that token (its WEIGHT out of
 * the total) and what three, four and five of it in a row pay.  Rarer pays
 * more; Froggy is the rarest that pays and pays the most.  The golden statue
 * pays nothing of its own: it is wild, and rarer than anything.
 */
export const SYMBOLS: Array<{ id: SymbolId; name: string; tier: Tier; weight: number; pays: [number, number, number] }> = [
  { id: 'token_1', name: 'BRONZE', tier: 'COMMON', weight: 22, pays: [1, 2, 3] },
  { id: 'token_10', name: 'PURPLE', tier: 'COMMON', weight: 20, pays: [2, 3, 5] },
  { id: 'token_5', name: 'BLUE RUBY', tier: 'UNCOMMON', weight: 16, pays: [3, 5, 8] },
  { id: 'token_20', name: 'FIREFLY', tier: 'UNCOMMON', weight: 14, pays: [3, 6, 10] },
  { id: 'token_50', name: 'GOLD LILY', tier: 'RARE', weight: 11, pays: [4, 7, 11] },
  { id: 'token_100', name: 'CRYSTAL', tier: 'RARE', weight: 8, pays: [4, 8, 12] },
  { id: 'token_3', name: 'FROGGY', tier: 'V.RARE', weight: 6, pays: [5, 10, 15] },
  { id: 'golden_froggy', name: 'WILD', tier: 'WILD', weight: 0.5, pays: [0, 0, 0] },
];
const idx = (id: SymbolId) => SYMBOLS.findIndex((s) => s.id === id);
const FROG = idx('token_3');
const WILD = idx('golden_froggy');
/** The tokens that pay: everything but the wild. */
const PAYING = SYMBOLS.length - 1;
const WEIGHT_SUM = SYMBOLS.reduce((a, s) => a + s.weight, 0);
/** What `n` in a row of symbol `sym` pays (0 under three). */
export function payFor(sym: number, n: number): number {
  if (n < 3 || sym < 0 || sym >= PAYING) return 0;
  return SYMBOLS[sym].pays[Math.min(n, 5) - 3];
}
/** The jackpot: five Froggys. */
const JACKPOT = payFor(FROG, 5);

const REELS = 5;
const ROWS = 6;
const CELL_W = 26;
const CELL_H = 14;
const GRID_X = 38;
const GRID_Y = 44;
const PITCH_X = 28;
const PITCH_Y = 16;

/** A cell, drawn on its own by the tokens' weights. */
function filler(): number {
  let roll = Math.random() * WEIGHT_SUM;
  for (let i = 0; i < SYMBOLS.length; i++) {
    roll -= SYMBOLS[i].weight;
    if (roll < 0) return i;
  }
  return 0;
}
/** Behind every token, the cell: dark lapis, and gold when it made the win. */
const CELL_BG = 0x141b36;
const CELL_LIT = 0x7a5a1c;

type Grid = number[][]; // [row][reel]

interface Cell {
  face: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
}

let cells: Cell[][] = [];
let spinning: boolean[] = [];
let shown: Grid = [];
let busy = false;
let over = false;
let firstSpin = true;
let tick = 0;
let status: Phaser.GameObjects.BitmapText | null = null;
let balance: Phaser.GameObjects.BitmapText | null = null;
let spinBtn: Phaser.GameObjects.Container | null = null;
let leaveBtn: Phaser.GameObjects.Container | null = null;
let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let temple: Temple | null = null;

export const slots: MinigameModule = {
  id: 'slots',
  title: 'FROGGY SLOTS',
  music: 'game_slots',
  rules: `${SPIN_COST} tokens a spin`,
  tutorial: {
    objective: [
      `${SPIN_COST} TOKENS A SPIN. LINE UP 3, 4 OR 5 OF A TOKEN IN A ROW.`,
      'EVERY TOKEN PAYS: COMMON ONES A LITTLE, RARE ONES MORE.',
      `FROGGY IS THE RAREST: 3 PAY ${payFor(FROG, 3)}, 5 PAY ${JACKPOT}.`,
      'THE GOLDEN FROGGY IS WILD: IT COUNTS AS ANY TOKEN.',
      'THE BEST LINE ON THE SCREEN IS PAID. MOST SPINS LOSE.',
    ],
    controls: [
      ['SPACE', 'SPIN'],
      ['MOUSE', 'SPIN OR LEAVE'],
    ],
  },
  touch: { buttons: [{ label: 'SPIN', key: 'SPACE', primary: true }] },
  payoutNote: `PAYS ${payFor(0, 3)} - ${JACKPOT}`,

  // Every spin is paid the moment it stops, so only a spin still turning is at stake.
  atRisk: () => (busy ? SPIN_COST : 0),
  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    over = false;
    busy = false;
    firstSpin = true;
    tick = 0;
    cells = [];
    spinning = Array.from({ length: REELS }, () => false);
    shown = blank();
    forced = null;
    paidCount = 0;
    ensureSlotSymbols(scene);

    // The temple the machine stands in, the shrine the reels turn behind and
    // the tablet the pays are carved on.  See slotsTemple.ts.
    temple = buildTemple(scene);
    for (let c = 0; c < REELS; c++) {
      // each reel is a strip of its own, so six rows still read as five reels
      scene.add.rectangle(GRID_X + c * PITCH_X, GRID_Y + ((ROWS - 1) * PITCH_Y) / 2, CELL_W + 2, ROWS * PITCH_Y, 0x070a16);
    }
    for (let r = 0; r < ROWS; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < REELS; c++) {
        const x = GRID_X + c * PITCH_X;
        const y = GRID_Y + r * PITCH_Y;
        const face = scene.add.rectangle(x, y, CELL_W, CELL_H, CELL_BG);
        // The token, 1:1 and centred: the cell is 26x14 and every token is
        // 12x12, so each has the same padding and none is ever scaled.
        const icon = scene.add.image(x, y, textureOf(SYMBOLS[FROG].id));
        row.push({ face, icon });
      }
      cells.push(row);
    }
    paint(shown);

    // THE PAYTABLE, on the machine where a player reads it before paying --
    // carved on the temple's tablet.  Every token, its rarity, and what three,
    // four and five of it in a row pay -- read off the same table the spin
    // pays from, so the board can never say something the machine does not.
    const TIER_COL: Record<Tier, number> = {
      COMMON: PALETTE.ash,
      UNCOMMON: PALETTE.mossLight,
      RARE: 0x6aa8ff,
      'V.RARE': PALETTE.gold,
      WILD: PALETTE.gold,
    };
    const COLS = [262, 284, 306];
    text(scene, 190, 29, 'IN A ROW', PALETTE.gold);
    ['3', '4', '5'].forEach((n, i) => text(scene, COLS[i], 29, n, PALETTE.gold).setOrigin(1, 0));
    SYMBOLS.forEach((sym, i) => {
      const y = 40.5 + i * 10;
      const froggy = i === FROG;
      scene.add.image(195, y + 3, textureOf(sym.id));
      text(scene, 204, y, sym.tier, TIER_COL[sym.tier]);
      if (sym.tier === 'WILD') {
        text(scene, COLS[2], y, 'ANY', PALETTE.gold).setOrigin(1, 0);
        return;
      }
      sym.pays.forEach((p, k) => {
        // the five is the prize: brighter than the three it grows from
        const col = froggy ? PALETTE.gold : k === 2 ? PALETTE.cream : PALETTE.fog;
        text(scene, COLS[k], y, `${p}`, col).setOrigin(1, 0);
      });
    });

    // Two lines, not one: the balance on the left and the result centred
    // under the window, so a long result never prints over the balance.
    balance = text(scene, 16, 138, '', PALETTE.cream);
    status = centerText(scene, GAME_W / 2, 148, 'SPIN TO PLAY', PALETTE.cream);
    spinBtn = button(scene, GAME_W / 2 - 40, 164, `SPIN - ${SPIN_COST}`, () => spin(), { width: 70, height: 14, fill: LAPIS, hoverFill: 0x2a4a9a });
    leaveBtn = button(scene, GAME_W / 2 + 40, 164, 'LEAVE', () => leave(), { width: 56, height: 14, fill: LAPIS_DK, hoverFill: 0x2a4a9a });
    // gold-edged, like everything else in the temple
    for (const b of [spinBtn, leaveBtn]) (b.list[0] as Phaser.GameObjects.Rectangle).setStrokeStyle(1, TEMPLE_GOLD);
    scene.input.keyboard?.on('keydown-SPACE', () => spin());
    refresh();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__slots = {
        state: () => ({ busy, firstSpin, grid: shown.map((r) => r.map((s) => SYMBOLS[s].id)) }),
        /** What the reels show right now, by id, and each cell's texture. */
        textures: () => cells.map((row) => row.map((cl) => cl.icon.texture.key)),
        /** How often each token turns up on the reels. */
        fill: (n: number) => {
          const seen: Record<string, number> = {};
          for (const s of SYMBOLS) seen[s.id] = 0;
          for (let i = 0; i < n; i++) for (const row of draw()) for (const s of row) seen[SYMBOLS[s].id]++;
          return seen;
        },
        /**
         * Sample the draw itself: what each window pays, by token and length.
         * The reels take seconds to stop; what is under test is the decision.
         */
        sample: (n: number) => {
          const seen: Record<string, number> = { none: 0 };
          let paid = 0;
          for (let i = 0; i < n; i++) {
            const got = best(draw());
            if (!got.pays) seen.none++;
            else {
              const k = `${SYMBOLS[got.sym].name} x${got.n}`;
              seen[k] = (seen[k] ?? 0) + 1;
              paid += got.pays;
            }
          }
          return { seen, paid };
        },
        /** The paytable as it is painted on the board. */
        table: () => SYMBOLS.map((s) => ({ id: s.id, tier: s.tier, weight: s.weight, pays: [...s.pays] })),
        /** The next spin shows exactly this window (ids, row by row). */
        force: (rows: SymbolId[][]) => {
          forced = rows.map((r) => r.map((id) => idx(id)));
        },
        /** How many times the spin was paid, all told. */
        paidCount: () => paidCount,
        best: (rows: SymbolId[][]) => {
          const got = best(rows.map((r) => r.map((id) => idx(id))));
          return { pays: got.pays, n: got.n, sym: got.sym >= 0 ? SYMBOLS[got.sym].id : null };
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__slots;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over) return;
    tick += delta;
    temple?.update(tick);
    // Reels blur while they turn; the symbols underneath are only real on a stop.
    for (let c = 0; c < REELS; c++) {
      if (!spinning[c]) continue;
      for (let r = 0; r < ROWS; r++) {
        showCell(cells[r][c], Math.floor((tick / 55 + c * 2 + r * 3) % PAYING));
      }
    }
  },

  destroy() {
    temple = null;
    cells = [];
    status = null;
    balance = null;
    spinBtn = null;
    leaveBtn = null;
    sceneRef = null;
    apiRef = null;
  },
};

// ------------------------------------------------------------------ the window

function blank(): Grid {
  return Array.from({ length: ROWS }, () => Array.from({ length: REELS }, () => filler()));
}

function showCell(cell: Cell, sym: number, lit = false): void {
  cell.face.setFillStyle(lit ? CELL_LIT : CELL_BG);
  cell.face.setStrokeStyle(lit ? 1 : 0, 0xffffff, lit ? 1 : 0);
  cell.icon.setTexture(textureOf(SYMBOLS[sym].id));
}

function paint(g: Grid, lit: Set<string> = new Set()): void {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < REELS; c++) showCell(cells[r][c], g[r][c], lit.has(`${r},${c}`));
}

function refresh(): void {
  balance?.setText(`TOKENS ${apiRef?.balance() ?? 0}`);
}

// ------------------------------------------------------------------ the lines

type Cells = Array<[number, number]>;

/**
 * The best line on the window: the run of three or more of the same token,
 * side by side in a row (the wild standing in for any of them), that pays the
 * most.  Only that one is paid -- never two lines, never the three inside a
 * five as well as the five.
 */
export function best(g: Grid): { pays: number; sym: number; n: number; cells: Cells } {
  let top: { pays: number; sym: number; n: number; cells: Cells } = { pays: 0, sym: -1, n: 0, cells: [] };
  for (let r = 0; r < g.length; r++) {
    const row = g[r];
    for (let s0 = 0; s0 + 2 < row.length; s0++) {
      for (let sym = 0; sym < PAYING; sym++) {
        let n = 0;
        while (s0 + n < row.length && (row[s0 + n] === sym || row[s0 + n] === WILD)) n++;
        const pays = payFor(sym, n);
        if (pays > top.pays) top = { pays, sym, n, cells: Array.from({ length: n }, (_, k) => [r, s0 + k] as [number, number]) };
      }
    }
  }
  return top;
}

/** The next window, if a test has set one. */
let forced: Grid | null = null;
/** Every payout this machine has made: one spin, one payout, at most. */
let paidCount = 0;

/** Every cell on its own, by the tokens' weights: the reels are the odds. */
function draw(): Grid {
  if (forced) {
    const g = forced;
    forced = null;
    return g.map((r) => [...r]);
  }
  return Array.from({ length: ROWS }, () => Array.from({ length: REELS }, () => filler()));
}

// -------------------------------------------------------------------- the spin

function spin(): void {
  if (over || busy || !sceneRef || !apiRef) return;
  // Every spin is SPIN_COST tokens, taken as it is pulled, or nothing.
  if (apiRef.balance() < SPIN_COST || !apiRef.raise(SPIN_COST)) {
    status?.setText(`NEED ${SPIN_COST} TOKENS`).setTint(PALETTE.blood);
    audio.sfx('buzzer');
    return;
  }
  firstSpin = false;
  busy = true;
  refresh();
  status?.setText('...').setTint(PALETTE.cream);
  audio.sfx('ticket_machine');

  const next = draw();
  for (let c = 0; c < REELS; c++) spinning[c] = true;
  // Left to right, with a beat between, so the last reel is the one that
  // matters.
  for (let c = 0; c < REELS; c++) {
    sceneRef.time.delayedCall(600 + c * 380, () => {
      spinning[c] = false;
      for (let r = 0; r < ROWS; r++) {
        shown[r][c] = next[r][c];
        showCell(cells[r][c], next[r][c]);
      }
      audio.sfx('ui_blip');
      if (c === REELS - 1) settle();
    });
  }
}

function settle(): void {
  if (!apiRef || !sceneRef || !busy) return;
  // (the spin is over the moment it is read: nothing can pay it twice)
  busy = false;
  const got = best(shown);
  if (got.pays > 0) {
    apiRef.payout(got.pays);
    paidCount++;
    const sym = SYMBOLS[got.sym];
    const big = got.sym === FROG || got.n === 5;
    // the cells that made it light up, and stay lit until the next spin
    paint(shown, new Set(got.cells.map(([r, c]) => `${r},${c}`)));
    status
      ?.setText(`${got.sym === FROG && got.n === 5 ? 'JACKPOT! ' : big ? 'BIG WIN! ' : ''}${got.n} ${sym.name}  +${got.pays} TOKENS`)
      .setTint(big ? PALETTE.gold : PALETTE.cream);
    audio.sfx('chime');
    if (big) {
      // a big one is announced, not just paid: the machine flashes, and the
      // jackpot shakes it
      sceneRef.cameras.main.flash(220, 255, 230, 140);
      if (got.pays >= JACKPOT) {
        sceneRef.cameras.main.shake(260, 0.006);
        audio.sfx('bell_ding');
      }
    }
  } else {
    status?.setText('NO REWARD').setTint(PALETTE.cream);
    audio.sfx('buzzer', 0.6);
  }
  refresh();
}

function leave(): void {
  if (over || busy) return;
  over = true;
  spinBtn?.setVisible(false);
  leaveBtn?.setVisible(false);
  apiRef?.cashOut();
}
