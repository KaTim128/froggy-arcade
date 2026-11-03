/**
 * WHEEL OF FORTUNE.  Twenty Five tokens a spin, in the corner of the casino.
 *
 * THE ODDS ARE THE TABLE, AND THE RIM IS DRAWN SO IT CAN BE READ.
 *
 * Every face used to be cut to the exact width of its chance, which made the
 * five thousand 0.036 of a degree: a face nobody could see, let alone read.
 * The prize is now drawn by the table below (`FACES`), and the wheel then
 * stops at a random point INSIDE the face that won -- so the pointer always
 * lands on what it pays, and the chances are exactly the table's.  The rim
 * is free to give every face room for its number: the rarest faces are
 * still the narrowest on the wheel (5000 narrower than 1000, narrower than
 * 500, narrower than everything else), and the board beside it prints the
 * real percentage of each.  A spin pays the one face it stopped on: there
 * is no second prize, no bonus, nothing that can stack two payouts onto one
 * go.
 *
 *   🏆 5000                  0.01%
 *   💰 1000                   0.1%
 *   💰 500                    0.5%
 *   🎁 200                      5%
 *   🎁 80 90 100               10%   (three faces)
 *   🪙 40 50 60 70             12%   (four faces)
 *   🪙 1 2 3 5 7 10 15      62.39%   (a seventh of it each)
 *   the blank                 10%   (two faces)
 *
 * EVERY FACE CARRIES ITS OWN NUMBER, written along the radius inside it.
 * The board beside the wheel names what it can pay AND the live percentage
 * for each band, read straight off the same FACES table the draw uses -- so
 * the board can never drift out of sync with the odds.
 *
 * WALKING UP TO IT IS FREE, but it will not let you stand at it broke: a spin
 * is the only thing this fixture does, so a player who cannot cover one is
 * turned away at the rope rather than sat in front of a machine they cannot
 * use.  Every spin is raised through the shell as it is taken, every prize is
 * paid the moment the wheel stops, and LEAVE settles up.  Nothing leaves
 * except through the ledger (MG-3).
 *
 * THE PRICE IS THE LEVER (user, 3 Nov: "a long term house advantage").  These
 * faces average about 33.43 tokens a spin and a spin now costs FORTY (the
 * admin's `wheel.cost`), so the house keeps about 6.6 of every paid spin --
 * about 16% -- however long anyone plays.
 *
 * ---- ONE RESPIN AND TWO BONUS SPINS A DAY, PER PROFILE.
 *
 *   RESPIN   after a paid spin, throw its result away and spin again, free.
 *            The second result stands.  One a day.
 *   BONUS    two free spins a day, once the day's first paid spin is in.
 *            Each one, on its own: 85% a prize under 25 (1-15), 15% a prize
 *            of 40-70.  Nothing else can come up on a bonus spin.
 *
 * What the day's allowance can add is fixed (about 20 for the respin, used
 * well, and 27 for the two bonus spins), so it never grows with play: paid
 * spins keep the edge above, and the more anyone spins the more the house is
 * ahead.
 *
 * ---- NOTHING TWICE, NOTHING BACK.
 *
 *   - Every result is drawn and WRITTEN DOWN before the wheel moves
 *     (`froggy.wheel.<profile>`, "pending").  A reload, a closed tab or a
 *     crash mid-spin does not hand the price back and does not re-roll: the
 *     result already drawn is paid the next time the wheel is opened.  It used
 *     to refund a cut-off spin, which let a player watch a bad result slow
 *     down and reload it away.
 *   - A result held for RESPIN is the same: a reload collects it.
 *   - The allowance is kept per profile, against the date, and it only
 *     resets when the clock has moved FORWARD past the last time it was
 *     used: winding the clock back gives nothing, and winding it forward
 *     spends those days for real.  The game already runs in one tab at a
 *     time (core/singleInstance).
 *   - A short cooldown between spins, and every spin logged (the last 30).
 *
 * WHAT THIS CANNOT DO.  The tokens live on the player's device, so a player
 * who edits their own browser storage can give themselves anything; the only
 * cure for that is an economy kept on a server, which this game does not
 * have.  Everything above is about the game itself never paying twice.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import { froggyLayer } from '../render/froggyLayer';
import { drawPixelText } from '../render/pixelFont';
import { cfgNum } from '../core/gameConfig';
import { store } from '../core/state';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'wheel' as const;
/** What a spin costs: the cabinet's own price, which the admin can move. */
export function spinCost(): number {
  const v = cfgNum('wheel.cost');
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 40;
}
export const RESPINS_A_DAY = 1;
export const BONUS_A_DAY = 2;
/** After a spin settles, before the next may start. */
const COOLDOWN_MS = 900;

// ------------------------------------------------------------ the book

type SpinKind = 'paid' | 'respin' | 'bonus';
interface Pending {
  kind: SpinKind;
  /** The face drawn, by index into FACES, and what it pays. */
  face: number;
  pays: number;
  cost: number;
  at: number;
  /** A paid result held while the player decides whether to RESPIN it. */
  held?: boolean;
}
interface WheelBook {
  day: string;
  /** The latest time the book was used: the clock must pass it to reset. */
  seen: number;
  respins: number;
  bonus: number;
  paidToday: number;
  pending: Pending | null;
  log: Array<{ at: number; kind: SpinKind; cost: number; pays: number }>;
}

const bookKey = (): string => `froggy.wheel.${store.activeSlotId() ?? 'guest'}`;
const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
const int = (v: unknown, lo: number, hi: number, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d;

/** The profile's wheel book, read fresh every time (never cached across a spin). */
export function readBook(): WheelBook {
  let raw: Partial<WheelBook> = {};
  try {
    raw = JSON.parse(localStorage.getItem(bookKey()) ?? '{}') ?? {};
  } catch {
    raw = {};
  }
  const pend = raw.pending as Pending | null | undefined;
  const b: WheelBook = {
    day: typeof raw.day === 'string' ? raw.day : '',
    seen: int(raw.seen, 0, Number.MAX_SAFE_INTEGER, 0),
    respins: int(raw.respins, 0, RESPINS_A_DAY, 0),
    bonus: int(raw.bonus, 0, BONUS_A_DAY, 0),
    paidToday: int(raw.paidToday, 0, 1e6, 0),
    pending:
      pend && typeof pend === 'object' && FACES[pend.face] && (pend.kind === 'paid' || pend.kind === 'respin' || pend.kind === 'bonus')
        ? { kind: pend.kind, face: pend.face, pays: FACES[pend.face].pays, cost: int(pend.cost, 0, 1e4, 0), at: int(pend.at, 0, Number.MAX_SAFE_INTEGER, 0), held: pend.held === true }
        : null,
    log: Array.isArray(raw.log) ? raw.log.filter((e) => e && typeof e === 'object').slice(-30) : [],
  };
  // A new day only once the clock has really moved on: set back, it gives nothing.
  const now = Date.now();
  if (b.day !== today() && now >= b.seen) {
    b.day = today();
    b.respins = RESPINS_A_DAY;
    b.bonus = BONUS_A_DAY;
    b.paidToday = 0;
  }
  b.seen = Math.max(b.seen, now);
  return b;
}
function writeBook(b: WheelBook): void {
  try {
    localStorage.setItem(bookKey(), JSON.stringify({ ...b, log: b.log.slice(-30) }));
  } catch {
    /* storage full or blocked: the spin still plays, it just is not kept */
  }
}

/**
 * The faces, in the order they sit round the rim, with the share of the wheel
 * each one takes.  The shares are percentages and they add to a hundred; the
 * arc each face gets is its share of 360 degrees, which is the whole of how
 * the odds are implemented.
 *
 * They are interleaved rather than sorted, so the big money is spread around
 * the rim instead of sitting in one quarter you can aim at.
 *
 * THE BIGGER BAND IS THE NARROWER ONE.  80-100 takes ten percent of the rim
 * across three faces and 40-70 takes twelve across four, so the band that pays
 * more is the band that comes up less.  It was the other way round -- four
 * percent a face against two and a half -- which made the better prize the
 * likelier one and read as a mistake on the board beside it, because it was.
 */
export const FACES: Array<{ pays: number; share: number }> = [
  { pays: 1, share: 62.39 / 7 },
  { pays: 40, share: 3 },
  { pays: 80, share: 10 / 3 },
  { pays: 2, share: 62.39 / 7 },
  { pays: 50, share: 3 },
  { pays: 90, share: 10 / 3 },
  { pays: 3, share: 62.39 / 7 },
  { pays: 60, share: 3 },
  { pays: 100, share: 10 / 3 },
  { pays: 5000, share: 0.01 },
  { pays: 5, share: 62.39 / 7 },
  { pays: 70, share: 3 },
  { pays: 0, share: 5 },
  { pays: 7, share: 62.39 / 7 },
  { pays: 200, share: 5 },
  { pays: 1000, share: 0.10 },
  { pays: 10, share: 62.39 / 7 },
  { pays: 500, share: 0.50 },
  { pays: 0, share: 5 },
  { pays: 15, share: 62.39 / 7 },
];

const CX = 96;
const CY = 100;
/** Bigger than it was (62), so every face has room for its number. */
const R = 68;
/**
 * The narrowest a face may be drawn, in degrees, so its number fits inside it.
 * The three rarest get their own, stepped, so rarer is always thinner.
 */
const MIN_DEG = 10;
const RARE_DEG: Record<number, number> = { 5000: 7.5, 1000: 8.2, 500: 9 };
/** Where the pointer sits, in radians: straight up. */
const POINTER = -Math.PI / 2;
/** A long, slow wind-down: most of the suspense is the last crawl past the pointer. */
const SPIN_MS = 5600;
const WIND_MS = 320;
/**
 * The spin's shape: a smooth run-up over its first twelfth, then a long
 * quartic slow-down, joined so the speed never jumps.
 */
const EASE_A = 0.12;
const EASE_K = 4 / (2 * EASE_A + 2 * EASE_A * EASE_A);
export function spinEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const p1 = EASE_K * EASE_A * EASE_A;
  if (t < EASE_A) return EASE_K * t * t;
  const u = (t - EASE_A) / (1 - EASE_A);
  return p1 + (1 - p1) * (1 - Math.pow(1 - u, 4));
}

interface Slice {
  pays: number;
  /** Start and end of the face on the rim, radians, before the wheel turns. */
  from: number;
  to: number;
  colour: number;
}

let slices: Slice[] = [];
let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;
let face: Phaser.GameObjects.Graphics | null = null;
let rotation = 0;
let spinning = false;
let over = false;
let spins = 0;
let won = 0;
let statusText: Phaser.GameObjects.BitmapText | null = null;
let balanceText: Phaser.GameObjects.BitmapText | null = null;
let spinBtn: Phaser.GameObjects.Container | null = null;
let leaveBtn: Phaser.GameObjects.Container | null = null;
let respinBtn: Phaser.GameObjects.Container | null = null;
let bonusBtn: Phaser.GameObjects.Container | null = null;
let allowText: Phaser.GameObjects.BitmapText | null = null;
let pegs: Phaser.GameObjects.Arc[] = [];
/** A paid result waiting on COLLECT or RESPIN. */
let holding: Pending | null = null;
let current: Pending | null = null;
let readyAt = 0;
let chase = 0;
/** Which face the pointer was over last frame, for the ratchet tick. */
let lastFace = -1;

/** Cut the rim into faces.  Shares are percentages; the wheel is 2π. */
function build(): void {
  slices = [];
  // ---- A POND, NOT A ROULETTE WHEEL.
  //
  // The small change alternated through teal, plum, rust and slate, which is
  // four colours that have nothing to do with each other or with this arcade.
  // These are four greens and a reed brown -- lily-pad colours -- and they
  // still alternate, so the rim reads as a wheel rather than a pie chart.
  //
  // What does NOT change is the ordering the player reads value by: nothing
  // else on the rim may be the colour of the top prizes, and the middle money
  // keeps its gold.  Theming the wheel is not allowed to cost the one job the
  // colours do.
  const palette = [0x2f6b36, 0x4a8f4e, 0x3a5c2a, 0x6b7a3a];
  // ---- HOW WIDE EACH FACE IS DRAWN.  Its chance, but never narrower than
  // it can be read at; the room that takes is given up, in proportion, by
  // the faces that have plenty.
  const want = FACES.map((f) => (f.share / 100) * 360);
  const floor = FACES.map((f) => RARE_DEG[f.pays] ?? MIN_DEG);
  const fixed = want.map((w, i) => w < floor[i]);
  const fixedDeg = floor.reduce((sum, fl, i) => sum + (fixed[i] ? fl : 0), 0);
  const freeWant = want.reduce((sum, w, i) => sum + (fixed[i] ? 0 : w), 0);
  const drawn = want.map((w, i) => (fixed[i] ? floor[i] : (w * (360 - fixedDeg)) / freeWant));
  let a = -Math.PI / 2;
  FACES.forEach((f, i) => {
    const span = (drawn[i] / 360) * Math.PI * 2;
    slices.push({
      pays: f.pays,
      from: a,
      to: a + span,
      // The money faces get their own colours; the small change alternates so
      // the rim reads as a wheel and not a pie chart.
      // The top two prizes get a colour nothing else on the rim uses, so the
      // splinter you are hoping for is findable while the wheel is turning.
      colour:
        f.pays === 0
          ? PALETTE.ink
          : f.pays >= 200
            ? PALETTE.blood
            : f.pays >= 40
              ? PALETTE.gold
              : palette[i % palette.length],
    });
    a += span;
  });
}

/** Total share of the rim across a set of payout values, formatted as a percent. */
function pctOf(pays: number[]): string {
  const total = FACES.filter((f) => pays.includes(f.pays)).reduce((sum, f) => sum + f.share, 0);
  if (total > 0 && total < 0.1) return `${total.toFixed(2)}%`;
  const rounded = Math.round(total * 10) / 10;
  return `${rounded % 1 === 0 ? rounded : rounded.toFixed(1)}%`;
}

/**
 * THE DRAW: which face wins, by the table's odds and nothing else, and where
 * inside it the wheel should stop -- kept off its edges, so there is never a
 * question which face the pointer is on.
 */
function draw1(): { face: number; angle: number } {
  let r = Math.random() * 100;
  let i = 0;
  for (; i < FACES.length - 1; i++) {
    r -= FACES[i].share;
    if (r < 0) break;
  }
  return { face: i, angle: stopIn(i) };
}

/** A point well inside face `i` for the wheel to stop on. */
function stopIn(i: number): number {
  const s = slices[i];
  return s.from + (s.to - s.from) * (0.15 + Math.random() * 0.7);
}

/** The small change (under 25) and the 40-70 band, by face. */
const SMALL = FACES.map((f, i) => (f.pays > 0 && f.pays < 25 ? i : -1)).filter((i) => i >= 0);
const MID = FACES.map((f, i) => (f.pays >= 40 && f.pays <= 70 ? i : -1)).filter((i) => i >= 0);
/** The bonus odds: 85% a prize under 25, 15% one of 40-70, each spin on its own. */
export const BONUS_BIG = 0.15;

/** A BONUS spin's face: 85% the small change, 15% the 40-70 band, a face of it at random. */
function drawBonus(): { face: number; angle: number } {
  const band = Math.random() < BONUS_BIG ? MID : SMALL;
  const i = band[Math.floor(Math.random() * band.length)];
  return { face: i, angle: stopIn(i) };
}

/** The rotation that puts `angle` (a point on the rim, unturned) under the pointer. */
function rotationFor(angle: number): number {
  return POINTER - angle;
}

/** Which face is under the pointer at this rotation. */
export function faceAt(rot: number): Slice {
  const twoPi = Math.PI * 2;
  // The pointer is fixed and the wheel turns under it.
  let a = (POINTER - rot) % twoPi;
  while (a < -Math.PI / 2) a += twoPi;
  while (a >= -Math.PI / 2 + twoPi) a -= twoPi;
  for (const s of slices) if (a >= s.from && a < s.to) return s;
  return slices[slices.length - 1];
}

export const wheelOfFortune: MinigameModule = {
  // (in play from the first spin: walking up and away again is LEAVE)
  inPlay: () => spins > 0 || spinning || holding !== null,
  id: ID,
  title: 'WHEEL OF FORTUNE',
  music: 'game_wheel',
  get rules() {
    return `${spinCost()} a spin - 1 respin and 2 bonus spins a day`;
  },
  payoutNote: 'PAYS 0 - 5000',
  tutorial: {
    pitch: 'ONE SPIN, ONE PRIZE.',
    steps: [
      { say: 'SPACE SPINS THE WHEEL.', phone: 'SPIN SPINS THE WHEEL.', demo: 'wheel.spin' },
      { say: 'THE THINNEST FACES ARE THE RAREST. THE BOARD SHOWS THE REAL CHANCE OF EACH.', demo: 'wheel.odds' },
      { say: 'ONCE A DAY, R THROWS A RESULT AWAY AND SPINS AGAIN FREE.', phone: 'ONCE A DAY, RESPIN THROWS A RESULT AWAY AND SPINS AGAIN FREE.', demo: 'wheel.keep' },
      { say: 'TWO FREE BONUS SPINS A DAY (F), AFTER YOUR FIRST PAID SPIN.', phone: 'TWO FREE BONUS SPINS A DAY, AFTER YOUR FIRST PAID SPIN.', demo: 'wheel.spin' },
    ],
    objective: [
      'ONE SPIN, ONE PRIZE, WHATEVER IT STOPS ON.',
      'THE THINNEST FACES ARE THE RAREST.',
      'ONE FREE RESPIN A DAY: THE NEW RESULT STANDS.',
      'TWO BONUS SPINS A DAY: 85% UNDER 25, 15% 40-70.',
      'A SPIN CUT OFF BY A RELOAD IS PAID NEXT TIME.',
    ],
    controls: [
      ['SPACE', 'SPIN / COLLECT'],
      ['R', 'RESPIN'],
      ['F', 'BONUS SPIN'],
    ],
  },
  touch: {
    buttons: [
      { label: 'SPIN', key: 'SPACE', primary: true },
      { label: 'RESPIN', key: 'R' },
      { label: 'BONUS', key: 'F' },
    ],
  },

  // Nothing is ever handed back: a result is drawn and written down before
  // the wheel turns, and a spin the page cut off is paid next time instead.
  atRisk: () => 0,
  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    sceneRef = scene;
    rotation = 0;
    spinning = false;
    over = false;
    spins = 0;
    won = 0;
    lastFace = -1;
    holding = null;
    current = null;
    readyAt = 0;
    chase = 0;
    pegs = [];
    build();

    // the room: carpet, a rope, and the wheel standing in it
    scene.add.rectangle(0, 18, GAME_W, 162, 0x241436).setOrigin(0, 0);
    scene.add.rectangle(0, 150, GAME_W, 30, 0x1a0e28).setOrigin(0, 0);
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + ((i * i) % 11) * 5) % GAME_W;
      const y = 22 + ((i * 53) % 150);
      scene.add.rectangle(x, y, 1, 1, 0xffd45e).setOrigin(0, 0).setAlpha(0.06 + (i % 3) * 0.04);
    }

    // ---- THE FRAME.  A brass ring on a green board, with a lily pad behind
    // the whole thing so the wheel sits ON something.
    scene.add.ellipse(CX, CY + 4, R * 2.5, R * 2.2, 0x1b3a22).setAlpha(0.55);
    scene.add.circle(CX, CY, R + 11, 0x24492a);
    scene.add.circle(CX, CY, R + 9, 0x3d7a42);
    scene.add.circle(CX, CY, R + 7, 0xc2a15a);
    scene.add.circle(CX, CY, R + 5, 0xffd45e);
    scene.add.circle(CX, CY, R + 3, PALETTE.ink);
    // pegs round the rim, which is what the pointer would actually tick off
    for (let i = 0; i < 24; i++) {
      const pa = (i / 24) * Math.PI * 2;
      pegs.push(scene.add.circle(CX + Math.cos(pa) * (R + 6), CY + Math.sin(pa) * (R + 6), 1.3, 0x7a5a2a).setAlpha(0.85).setDepth(7));
    }
    face = scene.add.graphics().setDepth(4);
    // The labels ride the rim, so they are containers of their own that get
    // re-placed every frame rather than being baked into the graphics.
    // Every number is inside its own face, along the radius, drawn on the
    // overlay -- see `draw`.
    // ---- THE HUB IS FROGGY.
    //
    // Every wheel has a boss in the middle of it and this one is a face: the
    // whole rim turns around him and he does not move, which is also roughly
    // the house's relationship with the player.
    scene.add.circle(CX, CY, 11, 0x24492a).setDepth(7);
    scene.add.circle(CX, CY, 9.5, 0x3d7a42).setDepth(7);
    scene.add.ellipse(CX, CY + 2, 13, 9, 0x5aa85f).setDepth(7).setAlpha(0.8);
    for (const sx of [-3.6, 3.6]) {
      scene.add.circle(CX + sx, CY - 3, 3.4, PALETTE.cream).setDepth(8);
      scene.add.circle(CX + sx, CY - 3.4, 1.5, PALETTE.black).setDepth(8);
      scene.add.circle(CX + sx - 0.6, CY - 4.4, 0.6, 0xffffff).setDepth(8).setAlpha(0.9);
    }
    // No mouth.  He is a hub with eyes, and the single dark bar that used to
    // run under them read as a slot cut in the boss rather than as a face.
    // Nothing is drawn in its place: the muzzle ellipse above already gives
    // the lower half of him its shape.
    // ---- THE POINTER: a reed over the top, with a brass collar on it.
    scene.add.rectangle(CX, CY - R - 13, 3, 9, 0x6b7a3a).setOrigin(0.5, 0).setDepth(8);
    scene.add.rectangle(CX, CY - R - 8, 7, 2.5, 0xc2a15a).setOrigin(0.5, 0).setDepth(8);
    scene.add.triangle(CX, CY - R - 6, 0, 0, 8, 0, 4, 9, PALETTE.cream).setOrigin(0.5, 0).setDepth(8);

    // The board names the faces and, next to each, the live percentage read
    // straight off FACES — so it can never fall out of sync with the rim the
    // way a hand-typed table could.
    text(scene, 178, 24, 'WHAT IT PAYS', PALETTE.gold);
const board: Array<[string, number]> = [
  [`🏆 5000 - ${pctOf([5000])}`, PALETTE.gold],
  [`💰 1000 - ${pctOf([1000])}`, PALETTE.gold],
  [`💰 500 - ${pctOf([500])}`, PALETTE.gold],
  [`🎁 200 - ${pctOf([200])}`, PALETTE.cream],
  [`🎁 80-100 - ${pctOf([80, 90, 100])}`, PALETTE.cream],
  [`🪙 40-70 - ${pctOf([40, 50, 60, 70])}`, PALETTE.cream],
  [`🪙 1-15 - ${pctOf([1, 2, 3, 5, 7, 10, 15])}`, PALETTE.cream],
  [`NOTHING - ${pctOf([0])}`, PALETTE.ash],
];
board.forEach(([what, tint], i) => {
  text(scene, 180, 34 + i * 8, what, tint);
});

    balanceText = text(scene, 180, 100, '', PALETTE.cream);
    statusText = text(scene, 180, 110, `SPIN IT - ${spinCost()} A GO`, PALETTE.gold);
    allowText = text(scene, 180, 120, '', PALETTE.fog);

    spinBtn = button(scene, 214, 141, `SPIN - ${spinCost()}`, () => primary(), { width: 66, height: 13 });
    bonusBtn = button(scene, 284, 141, 'BONUS', () => bonusSpin(), { width: 52, height: 13, fill: PALETTE.slate });
    respinBtn = button(scene, 214, 160, 'RESPIN', () => respin(), { width: 66, height: 13, fill: PALETTE.slate });
    leaveBtn = button(scene, 284, 160, 'LEAVE', () => leave(), { width: 52, height: 13, fill: PALETTE.slate });
    scene.input.keyboard?.on('keydown-SPACE', () => primary());
    scene.input.keyboard?.on('keydown-R', () => respin());
    scene.input.keyboard?.on('keydown-F', () => bonusSpin());
    // a spin the page cut off last time, or a result left held: pay it now
    scene.time.delayedCall(60, () => settleLeftover());

    draw();
    setButtons();
    refresh();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__wheel = {
        state: () => ({ spinning, spins, won, rotation, at: faceAt(rotation).pays, holding: holding?.pays ?? null, book: readBook() }),
        /** The bonus draw, sampled n times: what it would pay. */
        sampleBonus: (n: number) => {
          const seen: Record<string, number> = {};
          for (let i = 0; i < n; i++) {
            const p = faceAt(rotationFor(drawBonus().angle)).pays;
            seen[p] = (seen[p] ?? 0) + 1;
          }
          return seen;
        },
        respin: () => respin(),
        bonus: () => bonusSpin(),
        collect: () => primary(),
        ease: (t: number) => spinEase(t),
        /** The face under the pointer for a given rotation, without spinning. */
        faceAt: (rot: number) => faceAt(rot).pays,
        /**
         * Sample the wheel the way a spin does -- the draw, then the stop --
         * and read the face off where it stopped, so the check covers both
         * the odds and the landing.
         */
        sample: (n: number) => {
          const seen: Record<string, number> = {};
          for (let i = 0; i < n; i++) {
            const p = faceAt(rotationFor(draw1().angle)).pays;
            seen[p] = (seen[p] ?? 0) + 1;
          }
          return seen;
        },
        spin: () => primary(),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__wheel;
      });
    }
  },

  // ---- A RELOAD (log #87): the wheel where it stopped, and what it has paid.
  // A spin the page cut off mid-turn is not played out: its price comes back.
  snapshot() {
    // (no refund: the spin in the air, or the result held, is in the book and is paid on the way back in)
    return { rotation, spins, won, refund: 0 };
  },

  restore(snap: unknown) {
    const v = snap as { rotation: number; spins: number; won: number };
    rotation = v.rotation;
    spins = v.spins;
    won = v.won;
    spinning = false;
    holding = null;
    current = null;
    lastFace = -1;
    draw();
    setButtons();
    refresh();
  },

  destroy() {
    froggyLayer.clear();
    face = null;
    statusText = null;
    balanceText = null;
    spinBtn = null;
    leaveBtn = null;
    respinBtn = null;
    bonusBtn = null;
    allowText = null;
    pegs = [];
    apiRef = null;
    sceneRef = null;
  },
};

/** The rim, at the current rotation. */
function draw(): void {
  if (!face) return;
  face.clear();
  slices.forEach((s) => {
    face!.fillStyle(s.colour, 1);
    face!.slice(CX, CY, R, s.from + rotation, s.to + rotation, false);
    face!.fillPath();
    // a hairline between faces, so a sliver is still visibly its own face
    face!.lineStyle(1, PALETTE.ink, 0.9);
    face!.beginPath();
    face!.moveTo(CX, CY);
    face!.lineTo(CX + Math.cos(s.from + rotation) * R, CY + Math.sin(s.from + rotation) * R);
    face!.strokePath();
  });
  paintNumbers();
}

/**
 * THE NUMBERS, EACH INSIDE ITS OWN FACE.
 *
 * Out near the rim where the face is widest, and always the right way up --
 * they are never turned with the wheel.  They are painted on
 * the overlay canvas, at the display's own resolution: the game draws at
 * 320x180 and a pixel font rotated to an arbitrary angle at that size breaks
 * up into noise -- the rare faces, whose numbers matter most, were the worst.
 * On the overlay the same glyphs, rotated, stay crisp.
 */
function paintNumbers(): void {
  froggyLayer.paint((ctx) => {
    for (const s of slices) {
      // (the two thin splinters are written short, to fit them upright)
      const str = s.pays === 0 ? '-' : s.pays >= 1000 ? `${s.pays / 1000}K` : `${s.pays}`;
      const mid = (s.from + s.to) / 2 + rotation;
      const len = str.length * 6;
      // UPRIGHT, always: the wheel turns and the numbers ride round on it
      // the right way up.  Pulled in from the rim by however much of the
      // label's width and height points outwards at this angle, so it stays
      // on its own face.
      const lr = R - 4 - (len / 2) * Math.abs(Math.cos(mid)) - 4 * Math.abs(Math.sin(mid));
      ctx.save();
      ctx.translate(CX + Math.cos(mid) * lr, CY + Math.sin(mid) * lr);
      // dark on the gold faces, light on everything else
      const col = s.pays >= 40 && s.pays < 200 ? PALETTE.ink : PALETTE.cream;
      drawPixelText(ctx, str, 0, -3, { scale: 1, center: true, color: `#${col.toString(16).padStart(6, '0')}` });
      ctx.restore();
    }
  });
}

/** SPACE / the big button: collect a held result, or buy a spin. */
function primary(): void {
  if (holding) collect();
  else paidSpin();
}

/** Why a spin cannot start right now, or null if it can. */
function blocked(): boolean {
  if (over || spinning || !sceneRef || !apiRef) return true;
  if (performance.now() < readyAt) return true;
  // (a result from before still owed: pay it first, never alongside a new one)
  if (readBook().pending && !holding) {
    settleLeftover();
    return true;
  }
  return false;
}

function paidSpin(): void {
  if (blocked() || holding) return;
  const cost = spinCost();
  // Nothing was paid at the door, so every spin -- the first one included --
  // is raised here.  Look for free, pay to play.
  if (!apiRef!.raise(cost)) {
    audio.sfx('buzzer');
    statusText?.setText(`YOU NEED ${cost}`).setTint(PALETTE.blood);
    return;
  }
  const pick = draw1();
  const book = readBook();
  current = { kind: 'paid', face: pick.face, pays: FACES[pick.face].pays, cost, at: Date.now() };
  book.paidToday++;
  // WRITTEN DOWN BEFORE THE WHEEL MOVES: a reload from here on cannot re-roll it
  book.pending = current;
  writeBook(book);
  spins++;
  refresh();
  turnTo(pick.angle, 'SPINNING...');
}

function respin(): void {
  if (over || spinning || !sceneRef || !apiRef) return;
  if (!holding) {
    statusText?.setText('RESPIN AFTER A PAID SPIN').setTint(PALETTE.fog);
    return;
  }
  const book = readBook();
  if (book.respins <= 0 || !book.pending || book.pending.at !== holding.at) {
    statusText?.setText('NO RESPIN LEFT TODAY').setTint(PALETTE.fog);
    return;
  }
  book.respins--;
  book.log.push({ at: Date.now(), kind: 'paid', cost: holding.cost, pays: 0 });
  const pick = draw1();
  current = { kind: 'respin', face: pick.face, pays: FACES[pick.face].pays, cost: 0, at: Date.now() };
  book.pending = current;
  writeBook(book);
  holding = null;
  audio.sfx('coin_spin', 0.7);
  turnTo(pick.angle, 'RESPIN! THIS ONE STANDS...');
}

function bonusSpin(): void {
  if (holding) {
    statusText?.setText('COLLECT OR RESPIN FIRST').setTint(PALETTE.fog);
    return;
  }
  if (blocked()) return;
  const book = readBook();
  if (book.bonus <= 0) {
    statusText?.setText('NO BONUS SPINS LEFT TODAY').setTint(PALETTE.fog);
    return;
  }
  if (book.paidToday < 1) {
    statusText?.setText('SPIN ONCE TODAY TO UNLOCK').setTint(PALETTE.fog);
    return;
  }
  book.bonus--;
  const pick = drawBonus();
  current = { kind: 'bonus', face: pick.face, pays: FACES[pick.face].pays, cost: 0, at: Date.now() };
  book.pending = current;
  writeBook(book);
  audio.sfx('coin_spin', 0.7);
  turnTo(pick.angle, 'BONUS SPIN...');
}

/**
 * Send the wheel round to stop at `angle`: a small wind back, a smooth run-up,
 * five to eight turns, and a long crawl over the last few faces.
 */
function turnTo(angle: number, say: string): void {
  if (!sceneRef) return;
  spinning = true;
  lastFace = -1;
  statusText?.setText(say).setTint(PALETTE.fog);
  setButtons();
  audio.sfx('coin_drop', 0.6);
  const twoPi = Math.PI * 2;
  const base = rotationFor(angle);
  const start = rotation - 0.18;
  const turns = 5 + Math.floor(Math.random() * 3);
  const ahead = (((base - start) % twoPi) + twoPi) % twoPi;
  const target = start + ahead + twoPi * turns;
  const tick = (): void => {
    draw();
    const idx = slices.indexOf(faceAt(rotation));
    if (idx !== lastFace) {
      lastFace = idx;
      audio.sfx('wheel_tick', 0.5);
    }
  };
  const scene = sceneRef;
  // the wind back: the wheel is pulled against its spin before it is let go
  scene.tweens.addCounter({
    from: rotation,
    to: start,
    duration: WIND_MS,
    ease: 'Sine.easeInOut',
    onUpdate: (tw) => {
      rotation = tw.getValue() ?? rotation;
      draw();
    },
    onComplete: () => {
      scene.tweens.addCounter({
        from: start,
        to: target,
        duration: SPIN_MS,
        ease: spinEase,
        onUpdate: (tw) => {
          rotation = tw.getValue() ?? rotation;
          tick();
          // the rim lights chase round while it turns, slowing with it
          const p = tw.progress;
          chase += 0.9 * (1 - p) + 0.08;
          lightPegs(Math.floor(chase), p > 0.82);
        },
        onComplete: () => settleSpin(),
      });
    },
  });
}

/** The rim lights: one lit in three, stepping round; all of them gold near the end. */
function lightPegs(step: number, close: boolean): void {
  pegs.forEach((pg, i) => {
    const on = (i + step) % 3 === 0;
    pg.setFillStyle(on ? (close ? PALETTE.blood : 0xffd45e) : 0x7a5a2a).setAlpha(on ? 1 : 0.7).setScale(on ? 1.7 : 1);
  });
}

/**
 * The wheel has stopped.  ONE face, ONE payout, and the latch is what
 * guarantees it: a spin that somehow settled twice would pay twice, and that
 * is the one thing a wheel must not do.  A paid spin with the day's respin
 * still unused is HELD for the player to collect or respin.
 */
function settleSpin(): void {
  if (!apiRef || !sceneRef || !spinning || !current) return;
  spinning = false;
  readyAt = performance.now() + COOLDOWN_MS;
  const p = current;
  current = null;
  lightPegs(0, false);
  const book = readBook();
  if (p.kind === 'paid' && book.respins > 0 && book.pending?.at === p.at) {
    holding = p;
    book.pending = { ...p, held: true };
    writeBook(book);
    audio.sfx(p.pays >= 40 ? 'bell_ding' : 'ui_blip');
    statusText?.setText(`${p.pays || 'NOTHING'} - KEEP IT OR RESPIN?`).setTint(p.pays >= 40 ? PALETTE.gold : PALETTE.cream);
    setButtons();
    refresh();
    return;
  }
  pay(p);
}

function collect(): void {
  if (!holding || spinning) return;
  const p = holding;
  holding = null;
  pay(p);
}

/**
 * Pay `p` -- if the book still owes it.  The book is cleared FIRST, so the
 * same result can never be paid a second time, by this tab or the next load.
 */
function pay(p: Pending, late = false): void {
  if (!apiRef || !sceneRef) return;
  const book = readBook();
  if (!book.pending || book.pending.at !== p.at) {
    setButtons();
    refresh();
    return;
  }
  book.pending = null;
  book.log.push({ at: Date.now(), kind: p.kind, cost: p.cost, pays: p.pays });
  writeBook(book);
  const tag = late ? 'LAST SPIN PAID: ' : p.kind === 'bonus' ? 'BONUS: ' : '';
  if (p.pays > 0) {
    apiRef.payout(p.pays);
    apiRef.record(p.pays);
    won += p.pays;
    audio.sfx(p.pays >= 50 ? 'chime' : p.pays >= 20 ? 'bell_ding' : 'ui_blip');
    statusText?.setText(`${tag}${p.pays} TOKEN${p.pays === 1 ? '' : 'S'}`).setTint(p.pays >= 20 ? PALETTE.gold : PALETTE.cream);
    if (!late) celebrate(p.pays);
  } else {
    audio.sfx('buzzer', 0.6);
    statusText?.setText(`${tag}NOTHING`).setTint(PALETTE.fog);
  }
  setButtons();
  refresh();
}

/** A result the last visit left owing (cut off mid-spin, or held): paid now, as drawn. */
function settleLeftover(): void {
  if (spinning || holding) return;
  const b = readBook();
  if (b.pending) pay(b.pending, true);
  else {
    setButtons();
    refresh();
  }
}

/** The bigger the prize, the bigger the noise: a pop, confetti, a flash. */
function celebrate(pays: number): void {
  const scene = sceneRef;
  if (!scene || pays < 40) return;
  scene.cameras.main.shake(pays >= 200 ? 320 : 160, pays >= 200 ? 0.008 : 0.004);
  if (pays >= 200) scene.cameras.main.flash(260, 255, 212, 94);
  const pop = centerText(scene, CX, CY - R - 18, `${pays}!`, PALETTE.gold, 16).setDepth(20);
  scene.tweens.add({ targets: pop, y: CY - R - 30, alpha: 0, duration: 1200, onComplete: () => pop.destroy() });
  const n = pays >= 200 ? 48 : 24;
  const cols = [0xffd45e, PALETTE.blood, 0x5aa85f, PALETTE.cream];
  for (let i = 0; i < n; i++) {
    const bit = scene.add.rectangle(CX, CY - R, 2, 2, cols[i % cols.length]).setDepth(19);
    const a = Math.random() * Math.PI * 2;
    const d = 30 + Math.random() * 60;
    scene.tweens.add({
      targets: bit,
      x: CX + Math.cos(a) * d,
      y: CY - R + Math.sin(a) * d * 0.6 + 40,
      angle: 360,
      alpha: 0,
      duration: 900 + Math.random() * 700,
      ease: 'Quad.easeOut',
      onComplete: () => bit.destroy(),
    });
  }
  let blinks = 0;
  scene.time.addEvent({ delay: 110, repeat: 7, callback: () => lightPegs(blinks++ % 2 ? 1 : 0, true) });
}

const labelOf = (b: Phaser.GameObjects.Container | null): Phaser.GameObjects.BitmapText | null =>
  (b?.list[1] as Phaser.GameObjects.BitmapText | undefined) ?? null;

function setButtons(): void {
  const book = readBook();
  const busy = spinning;
  labelOf(spinBtn)?.setText(holding ? 'COLLECT' : `SPIN - ${spinCost()}`);
  spinBtn?.setAlpha(busy ? 0.5 : 1);
  respinBtn?.setAlpha(!busy && holding && book.respins > 0 ? 1 : 0.4);
  bonusBtn?.setAlpha(!busy && !holding && book.bonus > 0 && book.paidToday > 0 ? 1 : 0.4);
  labelOf(bonusBtn)?.setText(`BONUS ${book.bonus}`);
  labelOf(respinBtn)?.setText(`RESPIN ${book.respins}`);
  leaveBtn?.setAlpha(busy ? 0.5 : 1);
  allowText?.setText(`LEFT: RESPIN ${book.respins} BONUS ${book.bonus}`);
}

function refresh(): void {
  balanceText?.setText(`TOKENS ${apiRef?.balance() ?? 0}`);
}

function leave(): void {
  if (over || spinning) return;
  // walking away with a result held keeps it
  if (holding) collect();
  over = true;
  apiRef?.cashOut();
}
