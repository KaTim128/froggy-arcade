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
/** A pin has to be shoved this far off its spot to count as down. */
const KNOCK = 4.5;
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
 * There is one pattern per round and the rounds always come in this order, so
 * the third round is the same lane for everyone who ever reaches it.  That is
 * the whole design: the oil is a puzzle, and a puzzle that is re-rolled every
 * throw is not a puzzle.
 */
interface OilSpec {
  l: number;
  r: number;
  top: number;
  bottom: number;
  push: -1 | 1;
}

const OIL_PATTERNS: OilSpec[][] = [
  // Round one: one long patch down the left half pushing right, one short one
  // up on the right pushing back.  A straight ball down the left comes back to
  // the pocket; a right-hand hook thrown wide is held off and then bites.
  [
    { l: 0.0, r: 0.5, top: 98, bottom: 142, push: 1 },
    { l: 0.58, r: 1.0, top: 70, bottom: 98, push: -1 },
  ],
  // Round two: the mirror of it, so the lane you learned reads backwards.
  [
    { l: 0.5, r: 1.0, top: 98, bottom: 142, push: -1 },
    { l: 0.0, r: 0.42, top: 70, bottom: 98, push: 1 },
  ],
  // Round three: both edges pushing outward, into the channels, with dry
  // boards down the middle.  The gutters do the work here and the only safe
  // line is the one you have to thread.
  [
    { l: 0.0, r: 0.3, top: 78, bottom: 146, push: -1 },
    { l: 0.7, r: 1.0, top: 78, bottom: 146, push: 1 },
  ],
];

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
    scene.add.rectangle(LANE_L - 8, LANE_TOP, LANE_W + 16, FOUL_Y - LANE_TOP + 6, PALETTE.ink).setOrigin(0, 0);
    scene.add.rectangle(LANE_L, LANE_TOP, LANE_W, FOUL_Y - LANE_TOP + 6, 0xb9884f).setOrigin(0, 0);
    for (let x = LANE_L + 6; x < LANE_L + LANE_W; x += 12) {
      scene.add.rectangle(x, LANE_TOP, 1, FOUL_Y - LANE_TOP + 6, 0xa4773f).setOrigin(0, 0).setAlpha(0.6);
    }
    scene.add.rectangle(LANE_L, FOUL_Y, LANE_W, 1, PALETTE.blood).setOrigin(0, 0);
    // the aiming arrows a real lane has, a third of the way down
    for (let i = -3; i <= 3; i++) {
      const ax = LANE_L + LANE_W / 2 + i * 10;
      const ay = 118 + Math.abs(i) * 5;
      scene.add.triangle(ax, ay, 0, 5, 3, 0, 6, 5, 0x6b4a2a).setOrigin(0.5, 0.5);
    }
    scene.add.rectangle(LANE_L, LANE_TOP, LANE_W, 46, 0x8d6535).setOrigin(0, 0).setAlpha(0.5);

    ballBody = scene.add.circle(0, 0, BALL_R, PALETTE.plum).setStrokeStyle(1, PALETTE.violet).setDepth(20);
    aimLine = scene.add.graphics().setDepth(15);
    layOil();
    rack();
    resetBall();

    hud = {
      round: centerText(scene, GAME_W / 2, 24, '', PALETTE.cream),
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
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__bowl;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over || !ballBody) return;
    const dt = Math.min(delta, 40) / 1000;

    if (!ball.rolling && turn === 'player') {
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
      const body = scene0.add.circle(x, y, PIN_R, PALETTE.bone).setStrokeStyle(1, PALETTE.blood).setDepth(18);
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
 * Lay this round's oil, and draw it.
 *
 * The patch itself is a dark sheen over the boards — oil on wood, seen from
 * above — and the chevrons on it point the way it shoves, so the lane can be
 * read from the foul line without having thrown a ball down it first.
 */
function layOil(): void {
  if (!scene0) return;
  for (const o of oil) for (const part of o.parts) part.destroy();
  oil = [];
  const spec = OIL_PATTERNS[(round - 1) % OIL_PATTERNS.length];
  for (const s of spec) {
    const x = LANE_L + s.l * LANE_W;
    const w = (s.r - s.l) * LANE_W;
    const y = s.top;
    const h = s.bottom - s.top;
    const parts: Phaser.GameObjects.GameObject[] = [
      scene0.add.rectangle(x, y, w, h, 0x4a3a52).setOrigin(0, 0).setAlpha(0.55).setDepth(4),
      scene0.add.rectangle(x, y, w, 1, 0x8fa8c8).setOrigin(0, 0).setAlpha(0.45).setDepth(5),
      scene0.add.rectangle(x, y + h - 1, w, 1, 0x8fa8c8).setOrigin(0, 0).setAlpha(0.45).setDepth(5),
    ];
    // Chevrons down the middle of the patch, pointing the way it pushes.
    for (let cy = y + 7; cy < y + h - 4; cy += 11) {
      const cx = x + w / 2;
      parts.push(
        scene0.add
          .triangle(cx, cy, 0, 0, 0, 6, s.push * 4, 3, 0x9fb8d8)
          .setAlpha(0.7)
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
    collide(ball, BALL_MASS, BALL_R, p, 1, PIN_R);
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
    const f = Math.max(0, 1 - 3.6 * dt);
    p.vx *= f;
    p.vy *= f;
    for (const q of pins) {
      if (q === p || q.gone) continue;
      collide(p, 1, PIN_R, q, 1, PIN_R);
    }
    // A shove is a fall: moved off its spot, or moving fast, and it is down.
    if (!p.down) {
      const moved = Math.hypot(p.x - p.home.x, p.y - p.home.y) > KNOCK;
      if (moved || Math.hypot(p.vx, p.vy) > 90) {
        p.down = true;
        p.body.setFillStyle(PALETTE.ash).setScale(1.3, 0.55).setDepth(12);
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

/** The roll is over: count, then decide whose ball is next. */
function endRoll(): void {
  const standing = pins.filter((p) => !p.down).length;
  const knocked = standingBefore - standing;
  scores[turn] += knocked;
  if (knocked > 0) audio.sfx(knocked >= 5 ? 'chime' : 'ui_blip');
  refreshHud();

  const frameDone = standing === 0 || ballNo >= BALLS_PER_ROUND;
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
    resetBall();
    if (turn === 'cpu') cpuThrow();
    return;
  }

  // Frame over for this side.  Froggy follows you; a round ends after him.
  if (turn === 'player') {
    turn = 'cpu';
    ballNo = 1;
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
  // A new round is a fresh pattern: the lane you have learned is not the lane
  // you get next, which is what keeps three rounds worth playing.
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

function refreshHud(): void {
  if (!hud) return;
  hud.round.setText(`ROUND ${round}/${ROUNDS}  -  BALL ${ballNo}`);
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
