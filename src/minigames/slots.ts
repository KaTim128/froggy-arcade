/**
 * FROGGY SLOTS.  Three tokens a spin, and it keeps taking them.
 *
 * Five reels, six rows.  It was one row of five: three Froggys in a row or
 * five, and nothing else to hope for.  Five more rows under it make room for
 * the patterns a real machine sells -- a full row, a full column, a diagonal
 * five long -- and for a few special ones that are genuinely rare:
 *
 *   THREE IN A ROW   three Froggys side by side in any row          10
 *   FULL ROW         five across                                    30
 *   FULL COLUMN      six down one reel                              40
 *   FOUR CORNERS     a Froggy in every corner of the window         50
 *   DIAGONAL         five on a diagonal                             60
 *   THE CROSS        both diagonals of a five-by-five block        150
 *   GOLDEN FROGGY    the gold statue, anywhere                     300
 *
 * The patterns are made of frog tokens (token_3, Froggy's green face); every
 * other token on the reels is filler, drawn by rarity -- bronze lily pads
 * everywhere, rainbow crystals now and then -- and the golden Froggy statue
 * is the jackpot, one spin in ten thousand.  The art is in slotSymbols.ts.
 *
 * The paytable is on the machine, the odds are not.  The outcome is decided
 * when the button is pressed and the window is then dressed to show it --
 * which is exactly how a real one works.  The odds live in the DRAW, not in
 * the animation: `draw()` rolls once against the table below, fills the
 * window with symbols that make no pattern at all, stamps the one that was
 * drawn, and checks that what is on show pays exactly that and nothing
 * better.  The spin pays what `best()` reads off the window, so what you see
 * is what you are paid.
 *
 * Three tokens a spin: the specials are meant to be moments, not a drip.
 * Taken together the machine hands back about ninety of every hundred.
 *
 * It is a session, like the blackjack table: the first spin is the entry
 * cost the room took, every spin after that is raised through the shell, and
 * every win is paid out on the spot.  LEAVE cashes out; QUIT does the same.
 * Nothing here touches cash — tokens in, tokens out, through the ledger.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import { ensureSlotSymbols, textureOf, type SymbolId } from './slotSymbols';
import type { MinigameApi, MinigameModule } from './types';

export const SPIN_COST = 3;

export type Win = 'three' | 'row' | 'column' | 'corners' | 'diagonal' | 'cross' | 'gold';

/**
 * The paytable and the odds, rarest last.  On the machine the odds are a
 * secret; in the code they are a fact, and the fact the harness checks.
 * Every spin is drawn against these and nothing else -- no pity timer, no
 * streak memory, no adjusting for how the session has gone.
 */
export const PAYS: Array<{ win: Win; name: string; pays: number; p: number }> = [
  { win: 'three', name: '3 IN A ROW', pays: 10, p: 0.15 },
  { win: 'row', name: 'FULL ROW', pays: 30, p: 0.02 },
  { win: 'column', name: 'FULL COLUMN', pays: 40, p: 0.006 },
  { win: 'corners', name: 'FOUR CORNERS', pays: 50, p: 0.002 },
  { win: 'diagonal', name: 'DIAGONAL', pays: 60, p: 0.003 },
  { win: 'cross', name: 'THE CROSS', pays: 150, p: 0.0004 },
  { win: 'gold', name: 'GOLDEN FROGGY', pays: 300, p: 0.0001 },
];
/** Kept for anything that read the old two-line machine. */
export const PAY_THREE = PAYS[0].pays;
export const PAY_FIVE = PAYS[1].pays;
export const P_THREE = PAYS[0].p;
export const P_FIVE = PAYS[1].p;

const payOf = (w: Win): number => PAYS.find((x) => x.win === w)!.pays;

const REELS = 5;
const ROWS = 6;
const CELL_W = 26;
const CELL_H = 14;
const GRID_X = 38;
const GRID_Y = 44;
const PITCH_X = 28;
const PITCH_Y = 16;

/**
 * The symbols by id.  The frog token is the one the patterns are made of
 * (index 0); the golden Froggy is the jackpot (last).  In between are the
 * filler tokens, each with its WEIGHT: how often a filler cell is that token.
 * Low-value tokens are common, the high ones rare -- a rainbow crystal is ten
 * times scarcer than a bronze lily pad.  They are only ever filler: what a
 * spin pays is the pattern table above, drawn once per spin, so the weights
 * change what the window looks like and never what it pays.
 */
const SYMBOLS: Array<{ id: SymbolId; weight: number }> = [
  { id: 'token_3', weight: 0 },
  { id: 'token_1', weight: 40 },
  { id: 'token_5', weight: 24 },
  { id: 'token_10', weight: 16 },
  { id: 'token_20', weight: 10 },
  { id: 'token_50', weight: 6 },
  { id: 'token_100', weight: 4 },
  { id: 'golden_froggy', weight: 0 },
];
const idx = (id: SymbolId) => SYMBOLS.findIndex((s) => s.id === id);
const FROG = idx('token_3');
const GOLD = idx('golden_froggy');
/** The plain symbols a filler cell may be (never gold, never Froggy). */
const PLAIN = SYMBOLS.length - 2;
const WEIGHT_SUM = SYMBOLS.reduce((a, s) => a + s.weight, 0);
/** A filler token, by rarity. */
function filler(): number {
  let roll = Math.random() * WEIGHT_SUM;
  for (let i = 0; i < SYMBOLS.length; i++) {
    roll -= SYMBOLS[i].weight;
    if (roll < 0) return i;
  }
  return 1;
}
/** Behind every token, the cell: dark, and lit up when it made the win. */
const CELL_BG = 0x2a1233;
const CELL_LIT = 0x6a2f78;

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

export const slots: MinigameModule = {
  id: 'slots',
  title: 'FROGGY SLOTS',
  music: 'game_slots',
  rules: `${SPIN_COST} tokens a spin`,
  tutorial: {
    objective: [
      `${SPIN_COST} TOKENS A SPIN. LINE UP GREEN FROG TOKENS.`,
      `3 IN A ROW PAYS ${PAY_THREE}, A FULL ROW ${PAY_FIVE}.`,
      'COLUMNS, CORNERS AND DIAGONALS PAY MORE.',
      'THE CROSS AND THE GOLDEN FROGGY ARE VERY RARE.',
      'THE BEST PATTERN ON THE SCREEN IS PAID.',
    ],
    controls: [
      ['SPACE', 'SPIN'],
      ['MOUSE', 'SPIN OR LEAVE'],
    ],
  },
  touch: { buttons: [{ label: 'SPIN', key: 'SPACE', primary: true }] },
  payoutNote: `PAYS ${PAY_THREE} - ${payOf('gold')}`,

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
    ensureSlotSymbols(scene);

    scene.add.rectangle(0, 18, GAME_W, 162, 0x2b1430).setOrigin(0, 0);
    // the cabinet, and the window the reels turn behind
    scene.add.rectangle(14, 26, 164, 108, 0x53215c).setOrigin(0, 0).setStrokeStyle(1, 0xff4fa3);
    scene.add.rectangle(20, 32, 152, 96, 0x1a0a1e).setOrigin(0, 0);
    for (let c = 0; c < REELS; c++) {
      // each reel is a strip of its own, so six rows still read as five reels
      scene.add.rectangle(GRID_X + c * PITCH_X, GRID_Y + ((ROWS - 1) * PITCH_Y) / 2, CELL_W + 2, ROWS * PITCH_Y, 0x08040a);
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

    // THE PAYTABLE, on the machine where a player reads it before paying.
    scene.add.rectangle(184, 26, 128, 108, 0x3a1742).setOrigin(0, 0).setStrokeStyle(1, 0xff4fa3);
    // It says which token to line up, with the token itself beside the words.
    text(scene, 190, 30, 'LINE UP', PALETTE.gold);
    scene.add.image(240, 33, textureOf('token_3'));
    text(scene, 250, 30, 'TO WIN', PALETTE.gold);
    PAYS.forEach((p, i) => {
      const special = i >= 2;
      const y = 42 + i * 12;
      if (p.win === 'gold') {
        // the jackpot row shows the statue: it pays wherever it lands
        scene.add.image(196, y + 3, textureOf('golden_froggy'));
        text(scene, 206, y, 'ANYWHERE', PALETTE.gold);
      } else {
        text(scene, 190, y, p.name, special ? PALETTE.gold : PALETTE.cream);
      }
      text(scene, 306, y, `${p.pays}`, special ? PALETTE.gold : PALETTE.cream).setOrigin(1, 0);
    });

    // Two lines, not one: the balance on the left and the result centred
    // under the window, so a long result never prints over the balance.
    balance = text(scene, 16, 138, '', PALETTE.cream);
    status = centerText(scene, GAME_W / 2, 148, 'SPIN TO PLAY', PALETTE.cream);
    spinBtn = button(scene, GAME_W / 2 - 40, 164, `SPIN - ${SPIN_COST}`, () => spin(), { width: 70, height: 14 });
    leaveBtn = button(scene, GAME_W / 2 + 40, 164, 'LEAVE', () => leave(), { width: 56, height: 14, fill: PALETTE.slate });
    scene.input.keyboard?.on('keydown-SPACE', () => spin());
    refresh();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__slots = {
        state: () => ({ busy, firstSpin, grid: shown.map((r) => r.map((s) => SYMBOLS[s].id)) }),
        /** What the reels show right now, by id, and each cell's texture. */
        textures: () => cells.map((row) => row.map((cl) => cl.icon.texture.key)),
        /** How often each filler token turns up in a dressed window. */
        fill: (n: number) => {
          const seen: Record<string, number> = {};
          for (const s of SYMBOLS) seen[s.id] = 0;
          for (let i = 0; i < n; i++) for (const row of draw()) for (const s of row) seen[SYMBOLS[s].id]++;
          return seen;
        },
        /**
         * Sample the draw itself, reading each result off the window it
         * dressed -- the reels take a few seconds to stop, and what is under
         * test is the decision and that the window shows it.
         */
        sample: (n: number) => {
          const seen: Record<string, number> = { none: 0 };
          for (const p of PAYS) seen[p.win] = 0;
          for (let i = 0; i < n; i++) {
            const got = best(draw()).win;
            seen[got ?? 'none']++;
          }
          return seen;
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
    // Reels blur while they turn; the symbols underneath are only real on a stop.
    for (let c = 0; c < REELS; c++) {
      if (!spinning[c]) continue;
      for (let r = 0; r < ROWS; r++) {
        showCell(cells[r][c], Math.floor((tick / 55 + c * 2 + r * 3) % PLAIN) + (r % 2));
      }
    }
  },

  destroy() {
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

// ------------------------------------------------------------------ patterns

type Cells = Array<[number, number]>;

/** Every way each pattern can be made on a six-by-five window. */
function shapes(): Record<Win, Cells[]> {
  const rows: Cells[] = [];
  const threes: Cells[] = [];
  const cols: Cells[] = [];
  const diags: Cells[] = [];
  const crosses: Cells[] = [];
  for (let r = 0; r < ROWS; r++) {
    rows.push(Array.from({ length: REELS }, (_, c) => [r, c] as [number, number]));
    for (let c = 0; c + 2 < REELS; c++) threes.push([[r, c], [r, c + 1], [r, c + 2]]);
  }
  for (let c = 0; c < REELS; c++) cols.push(Array.from({ length: ROWS }, (_, r) => [r, c] as [number, number]));
  for (let r0 = 0; r0 + REELS <= ROWS; r0++) {
    const down = Array.from({ length: REELS }, (_, k) => [r0 + k, k] as [number, number]);
    const up = Array.from({ length: REELS }, (_, k) => [r0 + REELS - 1 - k, k] as [number, number]);
    diags.push(down, up);
    const x = new Map<string, [number, number]>();
    for (const p of [...down, ...up]) x.set(`${p[0]},${p[1]}`, p);
    crosses.push([...x.values()]);
  }
  const corners: Cells[] = [[[0, 0], [0, REELS - 1], [ROWS - 1, 0], [ROWS - 1, REELS - 1]]];
  return { three: threes, row: rows, column: cols, corners, diagonal: diags, cross: crosses, gold: [] };
}
const SHAPES = shapes();

/**
 * The best thing on the window: what it pays and which cells made it.  Only
 * the one pattern is paid, the highest-paying one on show -- never two.
 */
export function best(g: Grid): { win: Win | null; pays: number; cells: Cells } {
  let top: { win: Win | null; pays: number; cells: Cells } = { win: null, pays: 0, cells: [] };
  const frog = (r: number, c: number) => g[r][c] === FROG || g[r][c] === GOLD;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < REELS; c++) {
      if (g[r][c] === GOLD && payOf('gold') > top.pays) top = { win: 'gold', pays: payOf('gold'), cells: [[r, c]] };
    }
  }
  for (const w of ['three', 'row', 'column', 'corners', 'diagonal', 'cross'] as Win[]) {
    const pays = payOf(w);
    if (pays <= top.pays) continue;
    const hit = SHAPES[w].find((cs) => cs.every(([r, c]) => frog(r, c)));
    if (hit) top = { win: w, pays, cells: hit };
  }
  return top;
}

/**
 * Decide the spin, then dress the window to show it.  The filler is drawn
 * with Froggys scattered about -- so there is always something nearly there
 * -- and rerolled until it makes no pattern at all; the drawn pattern is then
 * stamped on, and the window is kept only if the best thing on it is exactly
 * what was drawn.
 */
function draw(): Grid {
  let roll = Math.random();
  let want: Win | null = null;
  for (const p of PAYS) {
    if (roll < p.p) {
      want = p.win;
      break;
    }
    roll -= p.p;
  }
  for (;;) {
    const g: Grid = Array.from({ length: ROWS }, () =>
      Array.from({ length: REELS }, () => (Math.random() < 0.22 ? FROG : filler())),
    );
    if (best(g).win !== null) continue;
    if (want === 'gold') {
      g[Math.floor(Math.random() * ROWS)][Math.floor(Math.random() * REELS)] = GOLD;
    } else if (want) {
      const options = SHAPES[want];
      for (const [r, c] of options[Math.floor(Math.random() * options.length)]) g[r][c] = FROG;
    }
    if (best(g).win === want) return g;
  }
}

// -------------------------------------------------------------------- the spin

function spin(): void {
  if (over || busy || !sceneRef || !apiRef) return;
  // The first spin is the entry cost PLAY took on the way in (api.staked());
  // every one after it is another SPIN_COST tokens, or nothing.
  if (!firstSpin) {
    if (apiRef.balance() < SPIN_COST || !apiRef.raise(SPIN_COST)) {
      status?.setText(`NEED ${SPIN_COST} TOKENS`).setTint(PALETTE.blood);
      audio.sfx('buzzer');
      return;
    }
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
  if (!apiRef || !sceneRef) return;
  const got = best(shown);
  if (got.win) {
    apiRef.payout(got.pays);
    const name = PAYS.find((p) => p.win === got.win)!.name;
    const special = got.win !== 'three' && got.win !== 'row';
    // the cells that made it light up, and stay lit until the next spin
    paint(shown, new Set(got.cells.map(([r, c]) => `${r},${c}`)));
    status?.setText(`${special ? 'BONUS! ' : ''}${name}  -  ${got.pays} TOKENS`).setTint(special ? PALETTE.gold : PALETTE.cream);
    audio.sfx('chime');
    if (special) {
      // A bonus is announced, not just paid: the machine flashes, and the big
      // two shake it.
      sceneRef.cameras.main.flash(220, 255, 230, 140);
      if (got.pays >= 150) {
        sceneRef.cameras.main.shake(260, 0.006);
        audio.sfx('bell_ding');
      }
    }
  } else {
    status?.setText('NO REWARD').setTint(PALETTE.cream);
    audio.sfx('buzzer', 0.6);
  }
  refresh();
  busy = false;
}

function leave(): void {
  if (over || busy) return;
  over = true;
  spinBtn?.setVisible(false);
  leaveBtn?.setVisible(false);
  apiRef?.cashOut();
}
