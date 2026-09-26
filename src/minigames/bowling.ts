/**
 * BOWLING.  Medium — 3 tokens in, 6 out.
 *
 * A lane seen from above, ten pins at the far end, and Froggy on the next
 * lane over bowling against you.  Three rounds; two balls a round; every pin
 * you knock down is a point.  Beat his total and the cabinet pays.  Tie and
 * you get your tokens back; lose and you do not.
 *
 * A and D walk the ball along the foul line, the arrows swing the aim, Q and E
 * bend it, the line shows where the ball is going, SPACE holds for power and
 * lets go to throw.
 *
 * THE LANE IS OILED, AND THE OIL IS THE GAME.  Two or three patches of it are
 * laid across the boards, you can see exactly where they are, and each one
 * shoves the ball the way its chevrons point for as long as the ball is on it.
 * It is also slick: your own hook barely bites while the ball is in the oil
 * and bites properly the moment it runs out onto dry boards.  So a ball is
 * never simply pointed at the pocket — it is aimed to arrive somewhere the
 * oil will carry it FROM.
 *
 * THE CURVE IS YOURS, NOT THE LANE'S.  Q and E swing a hook dial from a hard
 * left hook through dead straight to a hard right one, it is shown on the HUD
 * and drawn into the aiming line before you throw, and the ball does what the
 * dial says.  A straight shot is the dial parked in the middle.  So there are
 * two shots to choose between on every ball — send it straight and let the oil
 * do the work, or hook it and use the oil to hold the hook off until you want
 * it — and the lane is the same lane every time, so the answer is learnable.
 *
 * THE GUTTERS ARE GUTTERS.  Touch the channel and the ball is in it: no oil,
 * no hook, no steering, no pins.  It runs the length of the lane in the
 * channel and the shot is a nought.  The pins are bodies: the ball shoves
 * them, they shove each other, and a pin that has been moved is a pin that is
 * down — but it takes a proper shove.  Froggy bowls the same oiled lane, reads
 * it about as well as an average player, and has to pick his hook too.
 *
 * Your best total is kept per profile.  Only tokens leave through the shell.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';
import { backdrop, panel } from './decor';


const ID = 'bowling' as const;
export const ROUNDS = 3;
const BALLS_PER_ROUND = 2;

const LANE_L = 118;
const LANE_W = 84;
const LANE_TOP = 30;
const FOUL_Y = 166;
const PIN_APEX_Y = 66;
const PIN_GAP = 9;
const BALL_R = 5;
const PIN_R = 3;
const BALL_MASS = 1.7;
const AIM_MAX = 0.42; // radians either side of straight up
const AIM_RATE = 1.4;
/** How fast A and D carry the ball along the line, px/s. */
const WALK = 60;
/**
 * THE HOOK DIAL.  The player's curve, and the whole of it — there is no longer
 * a coin flip anywhere in the ball's path.
 *
 * `HOOK_MAX` is the sideways pull at a full hook, in px/s^2 per px/s of speed,
 * and the dial runs from -HOOK_MAX through zero to +HOOK_MAX.  Zero is the
 * straight shot.  A full hook off dry boards is worth about a foot of the
 * lane's eighty-four — a pin and a half at full power and getting on for three
 * at a gentle one, since a slow ball is on the boards longer.  Enough to swing
 * round the head pin, or to start a ball outside the oil and bring it back,
 * and not enough to make aiming pointless.
 */
const HOOK_MAX = 0.8;
/** How fast Q and E swing the dial, pull per second of holding. */
const HOOK_RATE = 0.8;
/** Under this the dial reads STRAIGHT, so a straight shot is a real setting. */
const HOOK_DEAD = 0.05;
/**
 * THE OIL.  Sideways shove in px/s^2 while the ball is on a patch.
 *
 * It is a constant and the patches are fixed per round, which is the point:
 * the lane behaves the same way every time you see that pattern, so reading it
 * is a skill rather than a guess.  A patch is worth about a pin of drift on a
 * hard ball and two on a soft one — so it is a correction you have to make,
 * and two patches stacked the same way is a different line entirely.
 */
const OIL_PUSH = 300;
/**
 * Oil is slick, so a hook barely bites on it.  This is what makes the choice
 * between the two shots real: a hook thrown down a long patch does nothing
 * until it runs out onto the dry.
 */
const OIL_HOOK_BITE = 0.25;
/** Lane friction, and the much lower figure on oil. */
const FRICTION_DRY = 0.18;
const FRICTION_OIL = 0.05;
/**
 * THE PINS DO NOT GO OVER EASILY.
 *
 * `KNOCK` is how far a pin has to be shoved off its spot before it counts as
 * down, and `TOPPLE` is the speed that puts one over without moving it that
 * far.  A brush used to be a fall: any ball that arrived anywhere near the
 * rack took most of it, and a strike was the ordinary outcome of a decent
 * line rather than a good one.  `PIN_MASS` is the rest of it — a heavier pin
 * takes more of the ball's speed to start moving and passes less of it on, so
 * the chain across the back rows has to be set up rather than hoped for.
 */
const KNOCK = 5.5;
const TOPPLE = 112;
const PIN_MASS = 1.15;
/** How fast a shoved pin gives up, per second.  Higher is a shorter chain. */
const PIN_DRAG = 3.9;
/**
 * WHAT CLEARING THE RACK IS WORTH, on top of the ten pins themselves.
 *
 * A strike pays more than a spare because it is the harder of the two and
 * because it costs a ball: eight and two is ten, and the same ten off the
 * first ball is fifteen.  Both sides are paid it, so Froggy's total moves the
 * same way and beating him still means out-bowling him.
 */
const STRIKE_BONUS = 5;
const SPARE_BONUS = 3;
const CHARGE_MS = 1100;
const THROW_MIN = 130;
const THROW_MAX = 330;
/**
 * The channel either side of the lane, and where a ball sits once it is in
 * one.  The gutters are drawn 8px wide from `LANE_L - 8`, so this is their
 * middle: a ball in the gutter is pinned here and nothing moves it off.
 */
const GUTTER_X = [LANE_L - 4, LANE_L + LANE_W + 4];
/**
 * A ball that touches the channel before the pin deck is a gutter ball and
 * stays one.  Past the deck it is just a ball leaving the lane, which is what
 * a ball does after it has hit something.
 */
const DECK_Y = PIN_APEX_Y + PIN_R * 2;

/**
 * A LANE PATTERN, in lane-relative terms so the numbers read as boards rather
 * than as screen pixels: `l` and `r` are fractions of the lane's width, `top`
 * and `bottom` are y on the lane, and `push` is which way the patch shoves.
 *
 * THE LANE IS RE-OILED BEFORE EVERY BALL, not once a round.  It used to be one
 * fixed pattern per round out of a table, so round three was the same lane for
 * everyone who ever reached it and a line that worked on your first ball
 * worked on your second.  Now the crew comes out between shots: the pattern
 * you spent a ball learning is gone, and the one in front of you is the only
 * one that matters.
 *
 * IT IS STILL READ, NOT GUESSED.  The patches are drawn on the boards with the
 * chevrons pointing the way they shove, and the aiming line is simulated
 * through whatever is down there now — so a fresh pattern is a fresh problem
 * you can see from the foul line, not a dice roll after the ball leaves your
 * hand.
 */
interface OilSpec {
  l: number;
  r: number;
  top: number;
  bottom: number;
  push: -1 | 1;
}

/** The band of lane the crew ever oils: short of the deck, past the approach. */
const OIL_Y = { top: 66, bottom: 148 };
/** How many patches go down, and how wide across the lane each one can be. */
const OIL_PATCHES = [2, 3];
const OIL_SPAN = { min: 0.28, max: 0.52 };
/** How deep a patch is, in lane pixels. */
const OIL_DEPTH = { min: 24, max: 40 };

/**
 * Lay a fresh pattern.
 *
 * The patches are stacked DOWN THE LANE in their own bands rather than dropped
 * anywhere, for two reasons: `oilAt` takes the first patch under a point and
 * so relies on them never overlapping, and a ball that crosses them one after
 * another is a lane you can read top to bottom instead of a smear.
 */
function rollOil(): OilSpec[] {
  const n = OIL_PATCHES[Math.floor(Math.random() * OIL_PATCHES.length)];
  const band = (OIL_Y.bottom - OIL_Y.top) / n;
  const spec: OilSpec[] = [];
  let last = 0;
  for (let i = 0; i < n; i++) {
    const depth = Math.min(band - 4, OIL_DEPTH.min + Math.random() * (OIL_DEPTH.max - OIL_DEPTH.min));
    const top = OIL_Y.top + i * band + Math.random() * (band - depth);
    const span = OIL_SPAN.min + Math.random() * (OIL_SPAN.max - OIL_SPAN.min);
    const l = Math.random() * (1 - span);
    // Never two shoves the same way in a row: a lane that pushes one way from
    // end to end is one correction, and one correction is not a pattern.
    const push: -1 | 1 = last === 0 ? (Math.random() < 0.5 ? -1 : 1) : ((-last) as -1 | 1);
    last = push;
    spec.push({ l, r: l + span, top, bottom: top + depth, push });
  }
  return spec;
}

/** A patch as it sits on the lane, in screen pixels. */
interface Oil {
  x: number;
  y: number;
  w: number;
  h: number;
  push: -1 | 1;
  parts: Phaser.GameObjects.GameObject[];
}

interface Pin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  home: { x: number; y: number };
  down: boolean;
  /** Off the deck entirely: out of play, out of every collision. */
  gone: boolean;
  body: Phaser.GameObjects.Arc;
}

type Turn = 'player' | 'cpu';

let scene0: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let pins: Pin[] = [];
let ball = { x: 0, y: 0, vx: 0, vy: 0, rolling: false };
let ballBody: Phaser.GameObjects.Arc | null = null;
let aimLine: Phaser.GameObjects.Graphics | null = null;
let aim = 0;
let power = 0;
/**
 * The curve on the ball currently rolling: signed sideways pull, 0 for a
 * throw that runs true.  Set at release, from the hook dial, and nowhere else.
 */
let curve = 0;
/**
 * The hook dial as the player has it set, -HOOK_MAX..HOOK_MAX.  It survives
 * the throw, so a line that worked can be thrown again without re-dialling it.
 */
let hook = 0;
/** The oil on the lane right now: one pattern, laid per round. */
let oil: Oil[] = [];
/**
 * Which channel the rolling ball is in: -1 left, +1 right, 0 still on the
 * lane.  Once it is not zero nothing sets it back — that is the gutter.
 */
let gutter = 0;
let charging = false;
let chargeDir = 1;
let round = 1;
let ballNo = 1;
let turn: Turn = 'player';
let scores = { player: 0, cpu: 0 };
let standingBefore = 10;
let settleMs = 0;
let over = false;
let best = 0;
let keys: Record<'left' | 'right' | 'aimL' | 'aimR' | 'hookL' | 'hookR', Phaser.Input.Keyboard.Key[]> = {
  left: [],
  right: [],
  aimL: [],
  aimR: [],
  hookL: [],
  hookR: [],
};
let hud: {
  round: Phaser.GameObjects.BitmapText;
  ball: Phaser.GameObjects.BitmapText;
  you: Phaser.GameObjects.BitmapText;
  cpu: Phaser.GameObjects.BitmapText;
  best: Phaser.GameObjects.BitmapText;
  turn: Phaser.GameObjects.BitmapText;
  meter: Phaser.GameObjects.Rectangle;
  /** Which of the two shots is dialled up, and how hard. */
  hook: Phaser.GameObjects.BitmapText;
} | null = null;

export const bowling: MinigameModule = {
  id: ID,
  title: 'BOWLING',
  music: 'game_bowling',
  rules: '3 rounds against froggy - beat his total',
  tutorial: {
    objective: [
      'THREE ROUNDS AGAINST FROGGY.',
      'BEAT HIS TOTAL - A TIE REFUNDS.',
      'THE DARK PATCHES ARE OIL - IT SHOVES.',
      'THE LANE IS RE-OILED BEFORE EVERY BALL.',
      'STRIKE +5 ON BALL ONE, SPARE +3 ON TWO.',
      'STRAIGHT OR HOOKED. THE LINE SHOWS BOTH.',
    ],
    controls: [
      ['A / D', 'WALK THE FOUL LINE'],
      ['LEFT/RIGHT', 'SWING THE AIM'],
      ['Q / E', 'HOOK LEFT OR RIGHT'],
      ['HOLD SPACE', 'POWER, LET GO TO THROW'],
    ],
  },
  // Three separate axes: the stick walks the foul line, one pair of buttons
  // swings the aim and the other bends the ball.  Aliasing any of them onto
  // the stick would walk and aim with one thumb.
  touch: {
    stick: 'lr',
    buttons: [
      { label: 'ROLL', key: 'SPACE', primary: true },
      { label: 'AIM\n\u25c0', key: 'LEFT' },
      { label: 'AIM\n\u25b6', key: 'RIGHT' },
      { label: 'HOOK\n\u25c0', key: 'Q' },
      { label: 'HOOK\n\u25b6', key: 'E' },
    ],
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    scene0 = scene;
    apiRef = api;
    pins = [];
    aim = 0;
    power = 0;
    curve = 0;
    hook = 0;
    oil = [];
    gutter = 0;
    charging = false;
    chargeDir = 1;
    round = 1;
    ballNo = 1;
    turn = 'player';
    scores = { player: 0, cpu: 0 };
    settleMs = 0;
    over = false;
    best = store.highScore(ID);

    backdrop(scene, 0x1c1410, 0x120c08, { speckleColor: 0xffd9a0 });
    // One line taller than it was: YOU, FROGGY, and the shot you have dialled.
    panel(scene, 6, 34, 96, 40, 0x2a1d14, 0x8a6a3a, 4);
    // gutters, lane, foul line, pin deck
    // ---- THE LANE, AS A FLOOR MADE OF WOOD.
    //
    // It was one flat tan rectangle with a seam every twelve pixels, which is
    // a brown strip rather than a bowling lane.  A real one is narrow boards
    // laid end to end and polished until the house lights sit on them, and
    // all of that can be had for a handful of rectangles.
    const laneH = FOUL_Y - LANE_TOP + 6;
    scene.add.rectangle(LANE_L - 8, LANE_TOP, LANE_W + 16, laneH, PALETTE.ink).setOrigin(0, 0);
    // ---- THE GUTTERS, as channels rather than as two black strips.
    //
    // Four bands across eight pixels -- the lip catching the house light, the
    // wall falling away, the dark at the bottom and the far wall coming back
    // up -- so the eye reads a trough the ball can drop into.
    for (const gx of [LANE_L - 8, LANE_L + LANE_W]) {
      const inward = gx < LANE_L ? 1 : -1;
      const near = inward > 0 ? gx : gx + 7;
      scene.add.rectangle(gx, LANE_TOP, 8, laneH, 0x1a1109).setOrigin(0, 0);
      scene.add.rectangle(near - inward * 0, LANE_TOP, 1, laneH, 0x3a2a18).setOrigin(0, 0);
      scene.add.rectangle(near + inward * 3, LANE_TOP, 2, laneH, 0x0d0805).setOrigin(0, 0);
      scene.add.rectangle(near + inward * 7, LANE_TOP, 1, laneH, 0x4a3520).setOrigin(0, 0).setAlpha(0.8);
    }
    // ---- THE BOARDS.
    //
    // EVERY EDGE IS ON A WHOLE PIXEL NOW, and that is the whole of why this
    // looked dirty.  The seams were 0.8px wide at x + 11.5 and the highlight
    // 0.5px at x + 0.4: on a 320x180 buffer blown up with NEAREST, a rectangle
    // narrower than a pixel does not draw a thin line, it drops a partial
    // sample into whichever pixel it lands in -- so every board edge was a
    // smear of half-tone rather than an edge, twenty-one of them down the lane.
    //
    // Twelve boards of exactly seven pixels, one pixel of seam, and the tone
    // runs as a SMOOTH ARCH across the lane -- darker at the gutters, lightest
    // down the middle where the house lights fall -- instead of seven tones
    // picked at random, which read as noise rather than as a polished floor.
    const BOARDS = 12;
    const bw = LANE_W / BOARDS;
    for (let i = 0; i < BOARDS; i++) {
      const bx = LANE_L + i * bw;
      // 0 at the gutters, 1 down the centre line
      const arch = 1 - Math.abs((i + 0.5) / BOARDS - 0.5) * 2;
      const lift = Math.round(arch * 22);
      const board = ((0xa8 + lift) << 16) | ((0x78 + Math.round(lift * 0.78)) << 8) | (0x42 + Math.round(lift * 0.5));
      scene.add.rectangle(bx, LANE_TOP, bw, laneH, board).setOrigin(0, 0);
      // one pixel of seam on the gutter side of each board
      scene.add.rectangle(bx, LANE_TOP, 1, laneH, 0x7e5730).setOrigin(0, 0).setAlpha(0.55);
      // and the grain: two long marks per board, a pixel high, well inside it
      for (let k = 0; k < 2; k++) {
        const gy = LANE_TOP + 10 + ((i * 29 + k * 61) % (laneH - 26));
        const gh = 6 + ((i + k) % 3) * 5;
        scene.add.rectangle(bx + 2, gy, bw - 4, 1, 0x8a6035).setOrigin(0, 0).setAlpha(0.22);
        scene.add.rectangle(bx + 3, gy + gh, bw - 6, 1, 0xd6a874).setOrigin(0, 0).setAlpha(0.14);
      }
    }
    // ---- THE HOUSE LIGHTS ON THE POLISH.
    //
    // Two soft bands down the lane and a pool at the foul line.  Whole pixels
    // and a shade lighter than before, because the arch in the boards is now
    // doing most of the work these used to be asked to do on their own.
    scene.add.rectangle(LANE_L + 22, LANE_TOP, 14, laneH, 0xfff0c9).setOrigin(0, 0).setAlpha(0.05);
    scene.add.rectangle(LANE_L + 48, LANE_TOP, 7, laneH, 0xfff0c9).setOrigin(0, 0).setAlpha(0.04);
    scene.add.ellipse(LANE_L + LANE_W / 2, FOUL_Y - 14, 68, 20, 0xfff0c9).setAlpha(0.05);
    scene.add.rectangle(LANE_L, FOUL_Y, LANE_W, 1, PALETTE.blood).setOrigin(0, 0);
    scene.add.rectangle(LANE_L, FOUL_Y + 1, LANE_W, 1, 0x000000).setOrigin(0, 0).setAlpha(0.35);
    // the aiming arrows a real lane has, a third of the way down
    for (let i = -3; i <= 3; i++) {
      const ax = LANE_L + LANE_W / 2 + i * 10;
      const ay = 118 + Math.abs(i) * 5;
      scene.add.triangle(ax, ay, 0, 5, 3, 0, 6, 5, 0x6b4a2a).setOrigin(0.5, 0.5);
    }
    // the pin deck, a shade darker than the approach
    scene.add.rectangle(LANE_L, LANE_TOP, LANE_W, 46, 0x8d6535).setOrigin(0, 0).setAlpha(0.45);

    // ---- THE HOUSE THIS LANE BELONGS TO.
    //
    // A lane ends in a wall and the wall is the one part of an alley that is
    // allowed to shout.  Froggy's is a green masking board with his eyes over
    // it, looking back down the lane at whoever is about to bowl, and a pair
    // of lamps washing the deck.  It is behind the pins and above the deck,
    // so it never sits under the ball or the rack.
    const wallY = LANE_TOP - 16;
    scene.add.rectangle(LANE_L - 8, wallY, LANE_W + 16, 18, 0x1b3a22).setOrigin(0, 0);
    scene.add.rectangle(LANE_L - 8, wallY, LANE_W + 16, 2, 0x3d7a42).setOrigin(0, 0);
    scene.add.rectangle(LANE_L - 8, wallY + 16, LANE_W + 16, 2, 0x0e1f12).setOrigin(0, 0);
    // ---- AND NOTHING IS WATCHING YOU BOWL.
    //
    // There were two eyes the size of dinner plates painted across the
    // masking board, staring back down the lane.  A pair of disembodied eyes
    // at the dark end of a room is not house branding, it is a horror film,
    // and it is the first thing on screen every time the game opens.  The
    // board keeps its green and its lamps; the face is gone.
    const ex = LANE_L + LANE_W / 2;
    scene.add.rectangle(ex, wallY + 9, LANE_W - 24, 5, 0x2f6b36).setAlpha(0.55);
    scene.add.rectangle(ex, wallY + 9, LANE_W - 30, 1, 0x5aa85f).setAlpha(0.5);
    // two lamps washing down onto the deck
    for (const lx of [LANE_L + 8, LANE_L + LANE_W - 8]) {
      scene.add.rectangle(lx - 3, wallY + 17, 6, 2, 0xffe9a8).setOrigin(0, 0).setAlpha(0.8);
      scene.add.triangle(lx, LANE_TOP + 14, -7, 26, 7, 26, 0, 0, 0xfff0c9).setAlpha(0.06);
    }
    // A lily pad either side of the approach used to sit here.  An eleven by
    // seven green oval with a wedge cut out of one edge, at the foul line, on
    // both sides of the lane: what that reads as at this size is a pair of
    // green hands reaching in over the gutters.  The approach is bare now --
    // it is the one part of the alley the ball actually passes through, and
    // it did not need decorating.

    ballBody = scene.add.circle(0, 0, BALL_R, PALETTE.plum).setStrokeStyle(1, PALETTE.violet).setDepth(20);
    aimLine = scene.add.graphics().setDepth(15);
    layOil();
    rack();
    resetBall();

    hud = {
      // Off the lane.  It was centred at the top of the screen, which is
      // directly over the masking board at the end of the lane -- the round
      // counter was printed across Froggy's eyes.  It lives on the left with
      // the rest of the readouts now, where nothing is drawn behind it.
      // ROUND and BALL on their own lines.  As one string this read
      // `ROUND 1/3  -  BALL 1`, about a hundred and twenty pixels of text
      // from x8, and the masking board starts at x110 -- so the last four
      // characters were printed over the back wall.
      round: text(scene, 8, 22, '', PALETTE.cream),
      // Beside it, not under it: the line below is the top edge of the score
      // panel.  `ROUND 1/3` ends at x62 and `BALL 1` runs x70..106, which
      // leaves it four pixels clear of the masking board at x110.
      ball: text(scene, 70, 22, '', PALETTE.cream),
      you: text(scene, 8, 40, '', PALETTE.tealLight),
      cpu: text(scene, 8, 50, '', PALETTE.neon),
      best: text(scene, GAME_W - 6, 21, '', PALETTE.gold).setOrigin(1, 0),
      turn: centerText(scene, 58, 100, '', PALETTE.fog),
      meter: scene.add.rectangle(GAME_W - 24, 150, 6, 0, PALETTE.gold).setOrigin(0, 1),
      // The shot you have dialled up, said in words.  Which of the two shots
      // is in your hand is a decision the player makes before every ball, so
      // it is printed rather than left to be inferred from the drawn line.
      hook: text(scene, 8, 60, '', PALETTE.gold),
    };
    scene.add.rectangle(GAME_W - 25, 96, 8, 54, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
    text(scene, GAME_W - 40, 154, 'HOLD', PALETTE.ash);
    text(scene, GAME_W - 40, 162, 'SPACE', PALETTE.ash);
    text(scene, 8, 138, 'A/D MOVE', PALETTE.ash);
    text(scene, 8, 146, '←→ AIM', PALETTE.ash);
    text(scene, 8, 154, 'Q/E HOOK', PALETTE.ash);
    refreshHud();

    const kb = scene.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    keys = {
      left: bind(['A']),
      right: bind(['D']),
      aimL: bind(['LEFT']),
      aimR: bind(['RIGHT']),
      hookL: bind(['Q']),
      hookR: bind(['E']),
    };
    kb?.on('keydown-SPACE', () => {
      if (over || turn !== 'player' || ball.rolling || settleMs > 0 || charging) return;
      charging = true;
      power = 0;
      chargeDir = 1;
    });
    kb?.on('keyup-SPACE', () => {
      if (!charging || over) return;
      charging = false;
      throwBall(aim, power);
    });

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__bowl = {
        state: () => ({
          round,
          ballNo,
          turn,
          scores: { ...scores },
          standing: pins.filter((p) => !p.down).length,
          rolling: ball.rolling,
          /**
           * The pins are still being counted.  `rolling` goes false the moment
           * the ball stops, and the score does not move until the deck has
           * settled -- so a harness that waits on `rolling` alone reads the
           * scoreboard from before the roll it just threw.
           */
          settling: settleMs > 0,
          best,
          hook,
          curve,
          gutter,
          ball: { x: ball.x, y: ball.y },
          oil: oil.map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h, push: o.push })),
        }),
        // A dead-straight full-power throw, for proving the pins fall.  The
        // hook is forced off so the pin physics is tested on its own.
        strike: () => throwBall(0, 1, 0),
        // Any throw at all, from anywhere on the line.  Pass `bend` to force
        // the curve instead of taking whatever the dial is set to.
        throw: (angle: number, pow: number, x?: number, bend?: number) => {
          if (x !== undefined) ball.x = x;
          throwBall(angle, pow, bend);
        },
        /** Set the hook dial, the way holding Q or E would. */
        setHook: (h: number) => {
          hook = Phaser.Math.Clamp(h, -HOOK_MAX, HOOK_MAX);
          refreshHud();
        },
        /**
         * Lay a KNOWN pattern, or an empty one for dry boards.
         *
         * The lane is re-oiled at random before every ball, which is the game
         * -- and which means two throws measured against each other are not
         * two throws down the same lane unless something pins the pattern.
         * That is what this is for: it is the only way to ask what the hook
         * alone does, or what one patch alone does.
         */
        setOil: (spec: OilSpec[]) => layOil(spec),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__bowl;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over || !ballBody) return;
    const dt = Math.min(delta, 40) / 1000;

    // Not while the last roll is still being counted.  The walk below clamps
    // the ball back onto the boards, and a ball that has just died in the
    // gutter is still at the gutter's x — so this branch was quietly lifting a
    // dead ball out of the channel and putting it back on the lane while the
    // pins settled.  SPACE was already refused during a settle; so is this.
    if (!ball.rolling && settleMs <= 0 && turn === 'player') {
      const swing = (keys.aimR.some((k) => k.isDown) ? 1 : 0) - (keys.aimL.some((k) => k.isDown) ? 1 : 0);
      aim = Phaser.Math.Clamp(aim + swing * AIM_RATE * dt, -AIM_MAX, AIM_MAX);
      // Q and E swing the hook dial through zero; there is no separate key for
      // "straight", because straight is what the middle of the dial IS.
      const bend = (keys.hookR.some((k) => k.isDown) ? 1 : 0) - (keys.hookL.some((k) => k.isDown) ? 1 : 0);
      if (bend !== 0) {
        hook = Phaser.Math.Clamp(hook + bend * HOOK_RATE * dt, -HOOK_MAX, HOOK_MAX);
        refreshHud();
      }
      const walk = (keys.right.some((k) => k.isDown) ? 1 : 0) - (keys.left.some((k) => k.isDown) ? 1 : 0);
      ball.x = Phaser.Math.Clamp(ball.x + walk * WALK * dt, LANE_L + BALL_R + 1, LANE_L + LANE_W - BALL_R - 1);
      ballBody.setPosition(ball.x, ball.y);
      if (charging) {
        power += (chargeDir * delta) / CHARGE_MS;
        if (power >= 1) {
          power = 1;
          chargeDir = -1;
        } else if (power <= 0) {
          power = 0;
          chargeDir = 1;
        }
      }
      hud?.meter.setSize(6, (charging ? power : 0) * 52);
    }
    drawAim();

    if (ball.rolling) {
      stepPhysics(dt);
      const past = ball.y < LANE_TOP - BALL_R * 2;
      const stopped = Math.hypot(ball.vx, ball.vy) < 6;
      if (past || stopped) {
        ball.rolling = false;
        ballBody.setVisible(false);
        settleMs = 900;
      }
    } else if (settleMs > 0) {
      stepPins(dt);
      settleMs -= delta;
      if (settleMs <= 0) endRoll();
    }
  },

  destroy() {
    pins = [];
    oil = [];
    ballBody = null;
    aimLine = null;
    hud = null;
    apiRef = null;
    scene0 = null;
  },
};

function rack(): void {
  if (!scene0) return;
  for (const p of pins) p.body.destroy();
  pins = [];
  const cx = LANE_L + LANE_W / 2;
  // Four rows, apex nearest you, so the ball meets one pin first.
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i <= row; i++) {
      const x = cx + (i - row / 2) * PIN_GAP;
      const y = PIN_APEX_Y - row * PIN_GAP * 0.85;
      // ---- A PIN, WHICH IS A ROUND THING SEEN FROM ABOVE.
      //
      // This was briefly a stack of five pieces: an off-centre highlight disc
      // over a darker one with two stripes across it.  Every one of those
      // offsets pulls the silhouette off true, and at three pixels of radius
      // the result was not a pin with a neck band on it, it was an egg.
      //
      // Back to the shape it had before -- one concentric disc with a ring
      // round it, which is what a pin looks like from the ceiling -- keeping
      // the colours it has now: bone, and the house green rather than the old
      // red for the ring.
      const body = scene0.add.circle(x, y, PIN_R, PALETTE.bone).setStrokeStyle(1, 0x3d7a42).setDepth(18);
      pins.push({ x, y, vx: 0, vy: 0, home: { x, y }, down: false, gone: false, body });
    }
  }
}

function resetBall(): void {
  ball = { x: LANE_L + LANE_W / 2, y: FOUL_Y - 2, vx: 0, vy: 0, rolling: false };
  gutter = 0;
  ballBody?.setPosition(ball.x, ball.y).setVisible(true).setFillStyle(PALETTE.plum);
}

/**
 * Lay a fresh pattern on the lane, and draw it.
 *
 * The patch itself is a dark sheen over the boards — oil on wood, seen from
 * above — and the chevrons on it point the way it shoves, so the lane can be
 * read from the foul line without having thrown a ball down it first.
 *
 * Called before EVERY ball, the player's and Froggy's alike.  It tears down
 * the last pattern's art as it goes, so this is also the only thing that has
 * to be right about repeated calls.
 */
function layOil(spec: OilSpec[] = rollOil()): void {
  if (!scene0) return;
  for (const o of oil) for (const part of o.parts) part.destroy();
  oil = [];
  for (const s of spec) {
    // ---- ROUNDED, because a patch edge at x151.7 is not an edge.
    //
    // These come out of `rollOil` as fractions of the lane, so every patch
    // had fractional corners and every one of its four borders landed as a
    // half-lit pixel.  The physics reads `oilAt` against the same numbers, so
    // rounding here keeps the picture and the puddle the same shape.
    const x = Math.round(LANE_L + s.l * LANE_W);
    const w = Math.round((s.r - s.l) * LANE_W);
    const y = Math.round(s.top);
    const h = Math.round(s.bottom - s.top);
    // ---- AND IT IS A SHEEN, NOT A SLAB.
    //
    // It was a flat 0x4a3a52 at 0.55 -- a grey-purple sheet heavy enough to
    // kill the grain under it, with a pale blue line top and bottom.  What
    // oil on a polished lane looks like from above is the boards going
    // slightly darker and slightly colder while you can still see them, with
    // the light catching the leading edge.  Half the alpha, a colder tint,
    // and the top lip warm rather than blue.
    const parts: Phaser.GameObjects.GameObject[] = [
      scene0.add.rectangle(x, y, w, h, 0x2f3a4a).setOrigin(0, 0).setAlpha(0.26).setDepth(4),
      scene0.add.rectangle(x, y, w, 1, 0xe8dcc0).setOrigin(0, 0).setAlpha(0.3).setDepth(5),
      scene0.add.rectangle(x, y + h - 1, w, 1, 0x1a1a24).setOrigin(0, 0).setAlpha(0.3).setDepth(5),
      scene0.add.rectangle(x, y, 1, h, 0xe8dcc0).setOrigin(0, 0).setAlpha(0.12).setDepth(5),
      scene0.add.rectangle(x + w - 1, y, 1, h, 0x1a1a24).setOrigin(0, 0).setAlpha(0.2).setDepth(5),
    ];
    // Chevrons down the middle of the patch, pointing the way it pushes.
    // Cream rather than ice blue: the patch is warm wood seen through oil,
    // and the only cold thing on the lane was these.
    for (let cy = y + 7; cy < y + h - 4; cy += 11) {
      const cx = Math.round(x + w / 2);
      parts.push(
        scene0.add
          .triangle(cx, cy, 0, 0, 0, 6, s.push * 4, 3, 0xe8dcc0)
          .setAlpha(0.5)
          .setDepth(6),
      );
    }
    oil.push({ x, y, w, h, push: s.push, parts });
  }
}

/** The patch under a point, if there is one.  Patches never overlap. */
function oilAt(x: number, y: number): Oil | null {
  for (const o of oil) {
    if (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return o;
  }
  return null;
}

/**
 * `bend` forces the curve (the harness and Froggy use it); otherwise the ball
 * does exactly what the player's hook dial says.  Nothing here is random any
 * more: the same dial, the same line and the same power roll the same ball.
 */
function throwBall(angle: number, pow: number, bend?: number): void {
  // Not while the last roll is still being counted: a throw then restarted
  // the roll with the ball hidden and the frame never ended.
  if (ball.rolling || settleMs > 0 || over) return;
  curve = bend ?? (Math.abs(hook) < HOOK_DEAD ? 0 : hook);
  gutter = 0;
  const speed = THROW_MIN + pow * (THROW_MAX - THROW_MIN);
  ball.vx = Math.sin(angle) * speed;
  ball.vy = -Math.cos(angle) * speed;
  ball.rolling = true;
  standingBefore = pins.filter((p) => !p.down).length;
  audio.sfx('hop_wet');
}

/** The ball and every standing pin, one step. */
function stepPhysics(dt: number): void {
  if (gutter !== 0) {
    // IN THE CHANNEL.  Nothing steers it, nothing bends it, nothing on the
    // lane can reach it, and it does not come back: it runs out the length of
    // the gutter and the shot is a nought.  The old code clamped x and zeroed
    // vx every frame, but the curve put vx straight back the frame after, so a
    // hooking ball could climb out of the gutter and back onto the boards.
    ball.vx = 0;
    ball.x = GUTTER_X[gutter < 0 ? 0 : 1];
    ball.y += ball.vy * dt;
    ball.vy *= Math.max(0, 1 - FRICTION_DRY * dt);
    ballBody?.setPosition(ball.x, ball.y);
    stepPins(dt);
    return;
  }

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // The oil: a shove while the ball is on a patch, the way the chevrons point,
  // and slick boards under it so the player's own hook barely bites there.
  const slick = oilAt(ball.x, ball.y);
  if (slick) ball.vx += slick.push * OIL_PUSH * dt;
  // the hook the player dialled up, biting on dry boards and skidding on oil
  if (curve !== 0) ball.vx += curve * (slick ? OIL_HOOK_BITE : 1) * Math.abs(ball.vy) * dt;
  // lane friction, lower on the oil
  const f = Math.max(0, 1 - (slick ? FRICTION_OIL : FRICTION_DRY) * dt);
  ball.vx *= f;
  ball.vy *= f;

  // and the channel, which is a one-way door
  if (ball.x < LANE_L + BALL_R || ball.x > LANE_L + LANE_W - BALL_R) {
    enterGutter(ball.x < LANE_L + BALL_R ? -1 : 1);
    ballBody?.setPosition(ball.x, ball.y);
    stepPins(dt);
    return;
  }
  ballBody?.setPosition(ball.x, ball.y);

  // A fallen pin is still a body: it slides, and it takes the next one with
  // it.  That is where the chain reactions come from.
  for (const p of pins) {
    if (p.gone) continue;
    collide(ball, BALL_MASS, BALL_R, p, PIN_MASS, PIN_R);
  }
  stepPins(dt);
}

/**
 * Into the channel, and that is that.  Past the pin deck it is just a ball
 * leaving the lane — it has already done whatever it was going to do — so the
 * word only goes up for a ball that missed the deck entirely.
 */
function enterGutter(side: -1 | 1): void {
  gutter = side;
  ball.vx = 0;
  ball.x = GUTTER_X[side < 0 ? 0 : 1];
  ballBody?.setFillStyle(PALETTE.slate);
  if (ball.y > DECK_Y && scene0) {
    audio.sfx('ui_hover', 0.4);
    const t = centerText(scene0, LANE_L + LANE_W / 2, 96, 'GUTTER', PALETTE.fog).setDepth(50);
    scene0.tweens.add({ targets: t, alpha: 0, duration: 1400, onComplete: () => t.destroy() });
  }
}

function stepPins(dt: number): void {
  for (const p of pins) {
    if (p.gone) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const f = Math.max(0, 1 - PIN_DRAG * dt);
    p.vx *= f;
    p.vy *= f;
    for (const q of pins) {
      if (q === p || q.gone) continue;
      collide(p, PIN_MASS, PIN_R, q, PIN_MASS, PIN_R);
    }
    // A shove is a fall: moved off its spot, or moving fast, and it is down.
    if (!p.down) {
      const moved = Math.hypot(p.x - p.home.x, p.y - p.home.y) > KNOCK;
      if (moved || Math.hypot(p.vx, p.vy) > TOPPLE) {
        p.down = true;
        // Squashed flat and drained of colour: a pin on its side, seen from
        // above, is a short pale smear rather than a crown.  The whole group
        // dims together, which is why it is a container and not a disc.
        p.body.setScale(1.35, 0.5).setAlpha(0.55).setDepth(12);
        p.body.setAngle(Phaser.Math.Between(-40, 40));
        audio.sfx('ui_hover', 0.6);
      }
    }
    // Off the deck: gone.
    if (p.x < LANE_L - 10 || p.x > LANE_L + LANE_W + 10 || p.y < LANE_TOP + PIN_R) {
      p.gone = true;
      p.down = true;
      p.vx = 0;
      p.vy = 0;
      p.body.setVisible(false);
    }
    p.body.setPosition(p.x, p.y);
  }
}

/** Two circles, elastic-ish, by mass.  Shared by ball-pin and pin-pin. */
function collide(
  a: { x: number; y: number; vx: number; vy: number },
  ma: number,
  ra: number,
  b: { x: number; y: number; vx: number; vy: number },
  mb: number,
  rb: number,
): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 0.01;
  if (d >= ra + rb) return;
  const nx = dx / d;
  const ny = dy / d;
  // push apart
  const overlap = ra + rb - d;
  const share = mb / (ma + mb);
  a.x -= nx * overlap * share;
  a.y -= ny * overlap * share;
  b.x += nx * overlap * (1 - share);
  b.y += ny * overlap * (1 - share);
  // impulse along the normal
  const rvx = a.vx - b.vx;
  const rvy = a.vy - b.vy;
  const along = rvx * nx + rvy * ny;
  if (along <= 0) return;
  const e = 0.55;
  const j = (-(1 + e) * along) / (1 / ma + 1 / mb);
  a.vx += (j / ma) * nx;
  a.vy += (j / ma) * ny;
  b.vx -= (j / mb) * nx;
  b.vy -= (j / mb) * ny;
}

/**
 * THE BALL'S PATH, WORKED OUT RATHER THAN GUESSED.
 *
 * The same integration `stepPhysics` runs, minus the pins: the oil shoves, the
 * hook bends, the channel swallows.  It is what the aiming line is drawn from
 * and what Froggy reads the lane with, so the line the player is shown and the
 * ball they actually throw cannot drift apart.
 */
function simulate(x0: number, angle: number, pow: number, bend: number): Array<{ x: number; y: number }> {
  const speed = THROW_MIN + pow * (THROW_MAX - THROW_MIN);
  const dt = 1 / 60;
  let x = x0;
  let y = ball.y;
  let vx = Math.sin(angle) * speed;
  let vy = -Math.cos(angle) * speed;
  let chan = 0;
  const pts = [{ x, y }];
  for (let i = 0; i < 200 && y > PIN_APEX_Y - 2; i++) {
    if (chan !== 0) {
      x = GUTTER_X[chan < 0 ? 0 : 1];
      y += vy * dt;
      vy *= Math.max(0, 1 - FRICTION_DRY * dt);
      pts.push({ x, y });
      continue;
    }
    x += vx * dt;
    y += vy * dt;
    const slick = oilAt(x, y);
    if (slick) vx += slick.push * OIL_PUSH * dt;
    if (bend !== 0) vx += bend * (slick ? OIL_HOOK_BITE : 1) * Math.abs(vy) * dt;
    const f = Math.max(0, 1 - (slick ? FRICTION_OIL : FRICTION_DRY) * dt);
    vx *= f;
    vy *= f;
    if (x < LANE_L + BALL_R || x > LANE_L + LANE_W - BALL_R) {
      chan = x < LANE_L + BALL_R ? -1 : 1;
      x = GUTTER_X[chan < 0 ? 0 : 1];
      vx = 0;
    }
    pts.push({ x, y });
  }
  return pts;
}

/**
 * The aiming line, which is now a curve: the real path of the ball you have
 * dialled up, drawn as far as the old straight line reached.
 *
 * It is deliberately NOT drawn all the way to the pins.  It shows how the
 * ball leaves your hand and what the first thing it meets does to it; reading
 * the rest of the pattern off the lane is the game.
 */
function drawAim(): void {
  if (!aimLine) return;
  aimLine.clear();
  if (over || ball.rolling || turn !== 'player') return;
  const bend = Math.abs(hook) < HOOK_DEAD ? 0 : hook;
  const path = simulate(ball.x, aim, charging ? power : 0.5, bend);
  const maxLen = 46 + (charging ? power : 0) * 70;
  aimLine.lineStyle(1, charging ? PALETTE.gold : PALETTE.cream, 0.8);
  aimLine.beginPath();
  aimLine.moveTo(path[0].x, path[0].y);
  let run = 0;
  let tip = path[0];
  for (let i = 1; i < path.length; i++) {
    run += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    if (run > maxLen) break;
    aimLine.lineTo(path[i].x, path[i].y);
    tip = path[i];
  }
  aimLine.strokePath();
  aimLine.fillStyle(charging ? PALETTE.gold : PALETTE.cream, 1);
  aimLine.fillCircle(tip.x, tip.y, 1.5);
}

/**
 * The roll is over: count, then decide whose ball is next.
 *
 * TEN IS WORTH MORE THAN TEN.  A rack cleared with the FIRST ball is a strike
 * and pays STRIKE_BONUS on top of the ten; cleared with the second, after the
 * sweep, it is a spare and pays SPARE_BONUS.  The two of them are what makes
 * the first ball of a frame worth taking a line on rather than nursing: eight
 * and two is ten, and a strike is fifteen.  Froggy is paid the same way.
 */
function endRoll(): void {
  const standing = pins.filter((p) => !p.down).length;
  const knocked = standingBefore - standing;
  scores[turn] += knocked;
  if (knocked > 0) audio.sfx(knocked >= 5 ? 'chime' : 'ui_blip');

  // The whole rack, and which ball did it.
  const cleared = standing === 0;
  const strike = cleared && ballNo === 1;
  const spare = cleared && ballNo > 1;
  if (strike || spare) {
    scores[turn] += strike ? STRIKE_BONUS : SPARE_BONUS;
    callIt(strike ? `STRIKE!  +${STRIKE_BONUS}` : `SPARE  +${SPARE_BONUS}`, strike);
  }
  refreshHud();

  const frameDone = cleared || ballNo >= BALLS_PER_ROUND;
  if (!frameDone) {
    // The sweep: fallen pins are cleared off the deck before the second ball,
    // so what is left standing is all that is in the way.
    for (const p of pins) {
      if (p.down && !p.gone) {
        p.gone = true;
        p.body.setVisible(false);
      }
    }
    ballNo++;
    // A fresh pattern before the spare attempt too: the line that left those
    // pins standing is not the line that will pick them up.
    layOil();
    resetBall();
    if (turn === 'cpu') cpuThrow();
    return;
  }

  // Frame over for this side.  Froggy follows you; a round ends after him.
  if (turn === 'player') {
    turn = 'cpu';
    ballNo = 1;
    layOil();
    rack();
    resetBall();
    refreshHud();
    cpuThrow();
    return;
  }
  if (round >= ROUNDS) {
    finish();
    return;
  }
  round++;
  turn = 'player';
  ballNo = 1;
  layOil();
  rack();
  resetBall();
  refreshHud();
}

/**
 * Froggy's arm.  He now has the same two shots and the same oiled lane, so he
 * plays it the way a decent club bowler does: try a handful of lines and hooks
 * against the pattern, keep whichever arrives nearest the pocket — and then
 * throw it with an unsteady arm, because he is a frog.
 *
 * The wobble is what leaves him beatable.  He still gets sevens and eights and
 * the odd strike, which is where he was before the lane had oil on it.
 */
const POCKET_X = LANE_L + LANE_W / 2 + 3;

function cpuThrow(): void {
  if (!scene0 || over) return;
  scene0.time.delayedCall(900, () => {
    if (over || turn !== 'cpu') return;
    const pow = 0.62 + Math.random() * 0.34;
    let bestLine = { x: LANE_L + LANE_W / 2, angle: 0, miss: Infinity, bend: 0 };
    for (const bend of [-HOOK_MAX * 0.7, 0, HOOK_MAX * 0.7]) {
      for (let i = 0; i < 9; i++) {
        const x = LANE_L + BALL_R + 3 + (i / 8) * (LANE_W - BALL_R * 2 - 6);
        for (const angle of [-0.14, -0.05, 0, 0.05, 0.14]) {
          const at = ball.y;
          ball.y = FOUL_Y - 2;
          const path = simulate(x, angle, pow, bend);
          ball.y = at;
          const end = path[path.length - 1];
          const miss = Math.abs(end.x - POCKET_X);
          if (miss < bestLine.miss) bestLine = { x, angle, miss, bend };
        }
      }
    }
    // and then his arm goes where his arm goes
    ball.x = Phaser.Math.Clamp(
      bestLine.x + (Math.random() - 0.5) * 10,
      LANE_L + BALL_R + 1,
      LANE_L + LANE_W - BALL_R - 1,
    );
    throwBall(bestLine.angle + (Math.random() - 0.5) * 0.16, pow, bestLine.bend);
  });
}

/**
 * The word for what just happened, over the deck.
 *
 * Same place and the same fade as GUTTER, because it is the same kind of
 * thing: the one line of feedback the deck gives you about the ball you have
 * just thrown.  It has to say the number too — a bonus the scoreboard absorbs
 * silently is a bonus nobody knows they are playing for.
 */
function callIt(line: string, big: boolean): void {
  if (!scene0) return;
  audio.sfx('chime', big ? 0.9 : 0.7);
  const t = centerText(scene0, LANE_L + LANE_W / 2, 84, line, big ? PALETTE.gold : PALETTE.tealLight).setDepth(50);
  scene0.tweens.add({ targets: t, y: 74, alpha: 0, duration: 1600, onComplete: () => t.destroy() });
}

function refreshHud(): void {
  if (!hud) return;
  hud.round.setText(`ROUND ${round}/${ROUNDS}`);
  hud.ball.setText(`BALL ${ballNo}`);
  hud.you.setText(`YOU     ${scores.player}`);
  hud.cpu.setText(`FROGGY  ${scores.cpu}`);
  hud.best.setText(`BEST ${best}`);
  hud.turn.setText(turn === 'player' ? 'YOUR BALL' : "FROGGY'S BALL").setTint(turn === 'player' ? 0x46c4bd : 0xff4fa3);
  // The dial in words.  Three arrows is everything the dial has.
  const bars = Math.round((Math.abs(hook) / HOOK_MAX) * 3);
  hud.hook.setText(
    Math.abs(hook) < HOOK_DEAD
      ? 'SHOT  STRAIGHT'
      : `SHOT  HOOK ${(hook < 0 ? '\u2190' : '\u2192').repeat(Math.max(1, bars))}`,
  );
  hud.hook.setTint(Math.abs(hook) < HOOK_DEAD ? PALETTE.ash : PALETTE.gold);
}

function finish(): void {
  if (over || !scene0) return;
  over = true;
  aimLine?.clear();
  if (store.setHighScore(ID, scores.player)) best = scores.player;
  refreshHud();
  const won = scores.player > scores.cpu;
  const tied = scores.player === scores.cpu;
  const line = won
    ? `YOU WIN ${scores.player} - ${scores.cpu}`
    : tied
      ? `TIED ${scores.player} - ${scores.cpu}  -  TOKENS BACK`
      : `FROGGY WINS ${scores.cpu} - ${scores.player}`;
  centerText(scene0, GAME_W / 2, 100, line, won ? PALETTE.gold : tied ? PALETTE.tealLight : PALETTE.fog).setDepth(50);
  scene0.time.delayedCall(1600, () => (won ? apiRef?.win() : tied ? apiRef?.draw() : apiRef?.lose()));
}
