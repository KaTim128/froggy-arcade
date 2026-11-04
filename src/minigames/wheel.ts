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
 *   🪙 1 2 3 5 7 10 15      54.39%   (a seventh of it each)
 *   RE respin / +2 bonus      4% each
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
 * ---- RESPIN AND BONUS ARE ON THE WHEEL (user, 4 Nov: "in the wheel, not
 * a button").  Two faces on the rim:
 *
 *   RE   RESPIN  4%   the wheel goes round again, free; that result stands
 *   +2   BONUS   4%   two free bonus spins, each on its own: 85% a prize
 *                     under 25 (1-15), 15% a prize of 40-70
 *
 * With those two faces the small change gives up eight points (62.39 ->
 * 54.39), and a forty-token spin returns about 35.4 on average, respins and
 * bonus spins included: the house keeps about 11% of every spin, forever.
 *
 * ---- NOTHING TWICE, NOTHING BACK.
 *
 *   - Every result is drawn and WRITTEN DOWN before the wheel moves
 *     (`froggy.wheel.<profile>`, "pending").  A reload, a closed tab or a
 *     crash mid-spin does not hand the price back and does not re-roll: the
 *     result already drawn is paid the next time the wheel is opened.  It used
 *     to refund a cut-off spin, which let a player watch a bad result slow
 *     down and reload it away.
 *   - A paid spin's WHOLE run is drawn at once -- the spin, any respins,
 *     any bonus spins -- and written down; the wheel only shows it.  A
 *     reload pays whatever of it had not been shown yet, once.
 *   - The game already runs in one tab at a time (core/singleInstance).
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
import { button, centerText, smallText } from '../core/ui';
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
/** The two faces that are not money: `pays` marks them. */
export const RESPIN = -1;
export const BONUS = -2;
/** How many free spins a BONUS face gives. */
export const BONUS_SPINS = 2;
/** A run of respins is cut off here (each one is still a fair draw). */
const MAX_RESPINS = 3;
/** After a run settles, before the next spin may start. */
const COOLDOWN_MS = 900;

// ------------------------------------------------------------ the book

type StepKind = 'paid' | 'respin' | 'bonus';
interface Step {
  kind: StepKind;
  /** The face it stops on, by index into FACES. */
  face: number;
}
/** One paid spin and everything it set off, drawn before the wheel moved. */
interface Pending {
  at: number;
  cost: number;
  steps: Step[];
  /** How many of the steps have been shown (and paid). */
  next: number;
}
interface WheelBook {
  pending: Pending | null;
  log: Array<{ at: number; cost: number; pays: number; steps: number }>;
}

const bookKey = (): string => `froggy.wheel.${store.activeSlotId() ?? 'guest'}`;

/** The profile's wheel book, read fresh every time (never cached across a spin). */
export function readBook(): WheelBook {
  let raw: Partial<WheelBook> = {};
  try {
    raw = JSON.parse(localStorage.getItem(bookKey()) ?? '{}') ?? {};
  } catch {
    raw = {};
  }
  const p = raw.pending as Pending | null | undefined;
  const steps = p && Array.isArray(p.steps) ? p.steps.filter((st) => st && FACES[st.face] && ['paid', 'respin', 'bonus'].includes(st.kind)) : [];
  return {
    pending: p && typeof p === 'object' && steps.length ? { at: Number(p.at) || 0, cost: Math.max(0, Math.floor(Number(p.cost) || 0)), steps, next: Math.max(0, Math.min(steps.length, Math.floor(Number(p.next) || 0))) } : null,
    log: Array.isArray(raw.log) ? raw.log.filter((e) => e && typeof e === 'object').slice(-30) : [],
  };
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
 * each one takes.  The shares are percentages and they add to a hundred.
 *
 * They are interleaved rather than sorted, so the big money is spread around
 * the rim instead of sitting in one quarter you can aim at.  80-100 takes ten
 * percent across three faces and 40-70 twelve across four, so the band that
 * pays more comes up less.
 */
export const FACES: Array<{ pays: number; share: number }> = [
  { pays: 1, share: 54.39 / 7 },
  { pays: 40, share: 3 },
  { pays: 80, share: 10 / 3 },
  { pays: RESPIN, share: 4 },
  { pays: 2, share: 54.39 / 7 },
  { pays: 50, share: 3 },
  { pays: 90, share: 10 / 3 },
  { pays: 3, share: 54.39 / 7 },
  { pays: 60, share: 3 },
  { pays: 100, share: 10 / 3 },
  { pays: 5000, share: 0.01 },
  { pays: 5, share: 54.39 / 7 },
  { pays: BONUS, share: 4 },
  { pays: 70, share: 3 },
  { pays: 0, share: 5 },
  { pays: 7, share: 54.39 / 7 },
  { pays: 200, share: 5 },
  { pays: 1000, share: 0.1 },
  { pays: 10, share: 54.39 / 7 },
  { pays: 500, share: 0.5 },
  { pays: 0, share: 5 },
  { pays: 15, share: 54.39 / 7 },
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
/** A respin or a bonus spin: the same shape, a little quicker. */
const AGAIN_MS = 4200;
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

/** The side panel: well clear of the wheel's rim (it ends at x 175). */
const PX = 192;

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
let pegs: Phaser.GameObjects.Arc[] = [];
/** The run being shown, and the step on the wheel now. */
let run: Pending | null = null;
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
        f.pays === RESPIN
          ? 0x2a8a9a
          : f.pays === BONUS
            ? 0x7a3ab8
            : f.pays === 0
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


/**
 * A paid spin's whole run: the spin, then a respin for every RESPIN it lands
 * on (to a limit), then the bonus spins if it lands on BONUS.
 */
export function drawRun(): Step[] {
  const steps: Step[] = [];
  let f = draw1().face;
  steps.push({ kind: 'paid', face: f });
  let re = 0;
  while (FACES[f].pays === RESPIN) {
    f = draw1().face;
    // (past the limit a respin lands again: draw until it is not one)
    if (re >= MAX_RESPINS) while (FACES[f].pays === RESPIN) f = draw1().face;
    steps.push({ kind: 'respin', face: f });
    re++;
  }
  if (FACES[f].pays === BONUS) for (let k = 0; k < BONUS_SPINS; k++) steps.push({ kind: 'bonus', face: drawBonus().face });
  return steps;
}

export const wheelOfFortune: MinigameModule = {
  // (in play from the first spin: walking up and away again is LEAVE)
  inPlay: () => spins > 0 || spinning,
  id: ID,
  title: 'WHEEL OF FORTUNE',
  music: 'game_wheel',
  get rules() {
    return `${spinCost()} a spin - land RE to spin again, +2 for two bonus spins`;
  },
  payoutNote: 'PAYS 0 - 5000',
  tutorial: {
    pitch: 'ONE SPIN, ONE PRIZE.',
    steps: [
      { say: 'SPACE SPINS THE WHEEL.', phone: 'SPIN SPINS THE WHEEL.', demo: 'wheel.spin' },
      { say: 'THE THINNEST FACES ARE THE RAREST. THE BOARD SHOWS THE REAL CHANCE OF EACH.', demo: 'wheel.odds' },
      { say: 'LAND ON RE AND IT SPINS AGAIN FREE. LAND ON +2 FOR TWO BONUS SPINS.', demo: 'wheel.keep' },
    ],
    objective: [
      'ONE SPIN, ONE PRIZE, WHATEVER IT STOPS ON.',
      'RE ON THE WHEEL: IT SPINS AGAIN, FREE.',
      '+2 ON THE WHEEL: TWO BONUS SPINS.',
      'BONUS SPINS: 85% UNDER 25, 15% 40-70.',
      'A SPIN CUT OFF BY A RELOAD IS PAID NEXT TIME.',
    ],
    controls: [
      ['SPACE', 'SPIN'],
      ['MOUSE', 'SPIN OR LEAVE'],
    ],
  },
  touch: { buttons: [{ label: 'SPIN', key: 'SPACE', primary: true }] },

  // Nothing is ever handed back: a run is drawn and written down before
  // the wheel turns, and what the page cut off is paid next time instead.
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
    run = null;
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
    // ---- THE HUB IS FROGGY: the whole rim turns around him and he does not
    // move, which is also roughly the house's relationship with the player.
    scene.add.circle(CX, CY, 11, 0x24492a).setDepth(7);
    scene.add.circle(CX, CY, 9.5, 0x3d7a42).setDepth(7);
    scene.add.ellipse(CX, CY + 2, 13, 9, 0x5aa85f).setDepth(7).setAlpha(0.8);
    for (const sx of [-3.6, 3.6]) {
      scene.add.circle(CX + sx, CY - 3, 3.4, PALETTE.cream).setDepth(8);
      scene.add.circle(CX + sx, CY - 3.4, 1.5, PALETTE.black).setDepth(8);
      scene.add.circle(CX + sx - 0.6, CY - 4.4, 0.6, 0xffffff).setDepth(8).setAlpha(0.9);
    }
    // ---- THE POINTER: a reed over the top, with a brass collar on it.
    scene.add.rectangle(CX, CY - R - 13, 3, 9, 0x6b7a3a).setOrigin(0.5, 0).setDepth(8);
    scene.add.rectangle(CX, CY - R - 8, 7, 2.5, 0xc2a15a).setOrigin(0.5, 0).setDepth(8);
    scene.add.triangle(CX, CY - R - 6, 0, 0, 8, 0, 4, 9, PALETTE.cream).setOrigin(0.5, 0).setDepth(8);

    // ---- THE BOARD, in the small type and well off the rim (user, 4 Nov:
    // "too big and too close to the wheel").  Every percentage is read off
    // FACES, the same table the draw uses, so it cannot drift.
    smallText(scene, PX, 26, 'WHAT IT PAYS', PALETTE.gold);
    const board: Array<[string, string, number]> = [
      ['5000', pctOf([5000]), PALETTE.gold],
      ['1000', pctOf([1000]), PALETTE.gold],
      ['500', pctOf([500]), PALETTE.gold],
      ['200', pctOf([200]), PALETTE.cream],
      ['80-100', pctOf([80, 90, 100]), PALETTE.cream],
      ['40-70', pctOf([40, 50, 60, 70]), PALETTE.cream],
      ['1-15', pctOf([1, 2, 3, 5, 7, 10, 15]), PALETTE.cream],
      ['NOTHING', pctOf([0]), PALETTE.ash],
      ['RE  SPIN AGAIN', pctOf([RESPIN]), 0x6ad8e8],
      ['+2  BONUS SPINS', pctOf([BONUS]), 0xc89aff],
    ];
    board.forEach(([what, pct, tint], i) => {
      smallText(scene, PX, 36 + i * 7, what, tint);
      smallText(scene, GAME_W - 8, 36 + i * 7, pct, tint).setOrigin(1, 0);
    });

    balanceText = smallText(scene, PX, 120, '', PALETTE.cream);
    statusText = smallText(scene, PX, 129, `SPIN IT - ${spinCost()} A GO`, PALETTE.gold);

    spinBtn = button(scene, 222, 156, `SPIN - ${spinCost()}`, () => paidSpin(), { width: 60, height: 13 });
    leaveBtn = button(scene, 286, 156, 'LEAVE', () => leave(), { width: 48, height: 13, fill: PALETTE.slate });
    scene.input.keyboard?.on('keydown-SPACE', () => paidSpin());
    // what the page cut off last time: shown, and paid, now
    scene.time.delayedCall(60, () => resume());

    draw();
    setButtons();
    refresh();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__wheel = {
        state: () => ({ spinning, spins, won, rotation, at: faceAt(rotation).pays, book: readBook() }),
        /** The bonus draw, sampled n times: what it would pay. */
        sampleBonus: (n: number) => {
          const seen: Record<string, number> = {};
          for (let i = 0; i < n; i++) {
            const p = faceAt(rotationFor(drawBonus().angle)).pays;
            seen[p] = (seen[p] ?? 0) + 1;
          }
          return seen;
        },
        /** n whole runs, drawn as a paid spin draws them: what they pay. */
        sampleRuns: (n: number) => {
          let paid = 0;
          let respins = 0;
          let bonus = 0;
          for (let i = 0; i < n; i++) {
            const st = drawRun();
            paid += st.reduce((a, x) => a + Math.max(0, FACES[x.face].pays), 0);
            respins += st.filter((x) => x.kind === 'respin').length;
            bonus += st.filter((x) => x.kind === 'bonus').length;
          }
          return { paid, respins, bonus };
        },
        ease: (t: number) => spinEase(t),
        /** The face under the pointer for a given rotation, without spinning. */
        faceAt: (rot: number) => faceAt(rot).pays,
        /** The draw and the stop, sampled: the odds and the landing together. */
        sample: (n: number) => {
          const seen: Record<string, number> = {};
          for (let i = 0; i < n; i++) {
            const p = faceAt(rotationFor(draw1().angle)).pays;
            seen[p] = (seen[p] ?? 0) + 1;
          }
          return seen;
        },
        /** Force the next paid spin's run (a test of the respin / bonus path). */
        force: (steps: Step[]) => {
          forced = steps;
        },
        spin: () => paidSpin(),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__wheel;
      });
    }
  },

  // ---- A RELOAD (log #87): the wheel where it stopped, and what it has paid.
  // Nothing comes back: the run in the air is in the book, and paid on the way in.
  snapshot() {
    return { rotation, spins, won, refund: 0 };
  },

  restore(snap: unknown) {
    const v = snap as { rotation: number; spins: number; won: number };
    rotation = v.rotation;
    spins = v.spins;
    won = v.won;
    spinning = false;
    run = null;
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
    pegs = [];
    apiRef = null;
    sceneRef = null;
  },
};

/** (dev only) the next run, chosen by a test. */
let forced: Step[] | null = null;

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
      const str = s.pays === RESPIN ? 'RE' : s.pays === BONUS ? '+2' : s.pays === 0 ? '-' : s.pays >= 1000 ? `${s.pays / 1000}K` : `${s.pays}`;
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

function paidSpin(): void {
  if (over || spinning || !sceneRef || !apiRef) return;
  if (performance.now() < readyAt) return;
  // (a run from before still owed: finish it first, never alongside a new one)
  if (readBook().pending) {
    resume();
    return;
  }
  const cost = spinCost();
  // Nothing was paid at the door, so every spin is raised here.
  if (!apiRef.raise(cost)) {
    audio.sfx('buzzer');
    statusText?.setText(`YOU NEED ${cost}`).setTint(PALETTE.blood);
    return;
  }
  const steps = import.meta.env?.DEV && forced ? forced : drawRun();
  forced = null;
  // THE WHOLE RUN IS WRITTEN DOWN BEFORE THE WHEEL MOVES: a reload cannot re-roll it
  const book = readBook();
  book.pending = { at: Date.now(), cost, steps, next: 0 };
  writeBook(book);
  run = book.pending;
  spins++;
  refresh();
  showStep();
}

/** Put the run's next step on the wheel. */
function showStep(): void {
  if (!run) return;
  const st = run.steps[run.next];
  if (!st) return finishRun();
  const say = st.kind === 'paid' ? 'SPINNING...' : st.kind === 'respin' ? 'RESPIN! AGAIN...' : `BONUS SPIN ${run.steps.filter((x, i) => x.kind === 'bonus' && i <= run!.next).length} OF ${BONUS_SPINS}...`;
  if (st.kind !== 'paid') audio.sfx('coin_spin', 0.7);
  turnTo(stopIn(st.face), say, st.kind === 'paid' ? SPIN_MS : AGAIN_MS);
}

/**
 * Send the wheel round to stop at `angle`: a small wind back, a smooth run-up,
 * five to eight turns, and a long crawl over the last few faces.
 */
function turnTo(angle: number, say: string, ms: number): void {
  if (!sceneRef) return;
  spinning = true;
  lastFace = -1;
  statusText?.setText(say).setTint(PALETTE.fog);
  setButtons();
  audio.sfx('coin_drop', 0.6);
  const twoPi = Math.PI * 2;
  const base = rotationFor(angle);
  const start = rotation - 0.18;
  const turns = (ms < SPIN_MS ? 4 : 5) + Math.floor(Math.random() * 3);
  const ahead = (((base - start) % twoPi) + twoPi) % twoPi;
  const target = start + ahead + twoPi * turns;
  const scene = sceneRef;
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
        duration: ms,
        ease: spinEase,
        onUpdate: (tw) => {
          rotation = tw.getValue() ?? rotation;
          draw();
          const idx = slices.indexOf(faceAt(rotation));
          if (idx !== lastFace) {
            lastFace = idx;
            audio.sfx('wheel_tick', 0.5);
          }
          // the rim lights chase round while it turns, slowing with it
          const p = tw.progress;
          chase += 0.9 * (1 - p) + 0.08;
          lightPegs(Math.floor(chase), p > 0.82);
        },
        onComplete: () => landed(),
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
 * The wheel has stopped on the run's current step.  It is paid -- ONCE: the
 * book moves on past it before a token changes hands -- and the next step,
 * if there is one, goes round after a beat.
 */
function landed(): void {
  if (!apiRef || !sceneRef || !spinning || !run) return;
  spinning = false;
  lightPegs(0, false);
  const st = run.steps[run.next];
  const book = readBook();
  if (!st || !book.pending || book.pending.at !== run.at || book.pending.next !== run.next) {
    run = null;
    setButtons();
    return;
  }
  book.pending.next++;
  run = book.pending;
  writeBook(book);
  const pays = FACES[st.face].pays;
  if (pays === RESPIN) {
    audio.sfx('bell_ding');
    statusText?.setText('RE - IT GOES ROUND AGAIN!').setTint(0x6ad8e8);
  } else if (pays === BONUS) {
    audio.sfx('chime');
    statusText?.setText(`+2 - ${BONUS_SPINS} BONUS SPINS!`).setTint(0xc89aff);
    sceneRef.cameras.main.flash(180, 200, 150, 255);
  } else payOut(pays, st.kind === 'bonus' ? 'BONUS: ' : '', true);
  refresh();
  if (run.next < run.steps.length) sceneRef.time.delayedCall(900, () => showStep());
  else finishRun();
}

/** One face's money, through the shell, with the noise that goes with it. */
function payOut(pays: number, tag: string, loud: boolean): void {
  if (!apiRef) return;
  if (pays > 0) {
    apiRef.payout(pays);
    apiRef.record(pays);
    won += pays;
    if (loud) {
      audio.sfx(pays >= 50 ? 'chime' : pays >= 20 ? 'bell_ding' : 'ui_blip');
      celebrate(pays);
    }
    statusText?.setText(`${tag}${pays} TOKEN${pays === 1 ? '' : 'S'}`).setTint(pays >= 20 ? PALETTE.gold : PALETTE.cream);
  } else if (pays === 0) {
    if (loud) audio.sfx('buzzer', 0.6);
    statusText?.setText(`${tag}NOTHING`).setTint(PALETTE.fog);
  }
}

/** The run is over: off the book, into the log. */
function finishRun(): void {
  const book = readBook();
  if (book.pending && run && book.pending.at === run.at) {
    const pays = run.steps.reduce((a, x) => a + Math.max(0, FACES[x.face].pays), 0);
    book.log.push({ at: run.at, cost: run.cost, pays, steps: run.steps.length });
    book.pending = null;
    writeBook(book);
  }
  run = null;
  readyAt = performance.now() + COOLDOWN_MS;
  setButtons();
  refresh();
}

/**
 * What the last visit left owing (cut off mid-run): every step not yet
 * shown is paid now, as drawn, in one go -- and the book is cleared FIRST,
 * so it can never be paid a second time.
 */
function resume(): void {
  if (spinning || run) return;
  const book = readBook();
  const p = book.pending;
  if (!p) return;
  const left = p.steps.slice(p.next);
  const pays = left.reduce((a, x) => a + Math.max(0, FACES[x.face].pays), 0);
  book.log.push({ at: p.at, cost: p.cost, pays: p.steps.slice(0, p.next).reduce((a, x) => a + Math.max(0, FACES[x.face].pays), 0) + pays, steps: p.steps.length });
  book.pending = null;
  writeBook(book);
  if (pays > 0) payOut(pays, 'LAST SPIN PAID: ', false);
  else statusText?.setText('LAST SPIN: NOTHING').setTint(PALETTE.fog);
  refresh();
  setButtons();
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

function setButtons(): void {
  spinBtn?.setAlpha(spinning || run ? 0.5 : 1);
  leaveBtn?.setAlpha(spinning || run ? 0.5 : 1);
}

function refresh(): void {
  balanceText?.setText(`TOKENS ${apiRef?.balance() ?? 0}`);
}

function leave(): void {
  if (over || spinning || run) return;
  over = true;
  apiRef?.cashOut();
}
