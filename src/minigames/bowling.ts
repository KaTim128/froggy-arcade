/**
 * BOWLING.  Medium — 3 tokens in, 3 out.
 *
 * A lane seen from above, ten pins at the far end, and Froggy on the next
 * lane over bowling against you.  Three rounds; two balls a round; every pin
 * you knock down is a point.  Beat his total and the cabinet pays.  Tie or
 * lose and it does not.
 *
 * A and D walk the ball along the foul line, the arrows swing the aim, the
 * line shows where the ball is going, SPACE holds for power and lets go to
 * throw.  Most balls run true.  ROUGHLY THREE IN TEN CURVE, and when one does
 * the lane picks the side — left or right, near enough evenly — and how hard,
 * out of a band that bends the ball by a few boards rather than across the
 * lane.  Nothing says which kind of ball is in your hand before you let go of
 * it: the throw is honest and the roll is where you find out, which is why a
 * spare is a spare and not arithmetic.  The pins are bodies: the ball shoves
 * them, they shove each other, and a pin that has been moved is a pin that is
 * down — but it takes a proper shove.  Froggy throws the same ball on the same
 * lane, and it surprises him exactly as often.
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
 * The curve.  Three throws in ten bend; the rest go where they were aimed.
 *
 * It is rolled per throw, after the ball has left the hand, so nothing the
 * player can read before releasing tells them which one they have — and the
 * two sides are drawn evenly, so a ball that went left last frame says
 * nothing about this one.
 */
const CURVE_CHANCE = 0.3;
/**
 * How hard a curving ball bends: sideways pull, px/s^2 per px/s of speed.  The
 * band is deliberately modest — a curve should pull a pocket shot off the
 * headpin or a gutter-bound ball back onto the deck, not sweep the lane.  The
 * old ball hooked at 0.55 on EVERY throw, which is where the exaggeration was.
 */
const CURVE_MIN = 0.2;
const CURVE_MAX = 0.4;
/** A pin has to be shoved this far off its spot to count as down. */
const KNOCK = 4.5;
const CHARGE_MS = 1100;
const THROW_MIN = 130;
const THROW_MAX = 330;

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
 * throw that runs true.  Set at release and nowhere else.
 */
let curve = 0;
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
let keys: Record<'left' | 'right' | 'aimL' | 'aimR', Phaser.Input.Keyboard.Key[]> = { left: [], right: [], aimL: [], aimR: [] };
let hud: {
  round: Phaser.GameObjects.BitmapText;
  you: Phaser.GameObjects.BitmapText;
  cpu: Phaser.GameObjects.BitmapText;
  best: Phaser.GameObjects.BitmapText;
  turn: Phaser.GameObjects.BitmapText;
  meter: Phaser.GameObjects.Rectangle;
} | null = null;

export const bowling: MinigameModule = {
  id: ID,
  title: 'BOWLING',
  music: 'game_bowling',
  rules: '3 rounds against froggy - beat his total',
  tutorial: {
    objective: [
      'THREE ROUNDS AGAINST FROGGY.',
      'BEAT HIS TOTAL - A TIE PAYS NOTHING.',
      'SOME BALLS CURVE. YOU FIND OUT ROLLING.',
    ],
    controls: [
      ['A / D', 'WALK THE FOUL LINE'],
      ['LEFT/RIGHT', 'SWING THE AIM'],
      ['HOLD SPACE', 'POWER, LET GO TO THROW'],
    ],
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    scene0 = scene;
    apiRef = api;
    pins = [];
    aim = 0;
    power = 0;
    curve = 0;
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
    panel(scene, 6, 34, 96, 32, 0x2a1d14, 0x8a6a3a, 4);
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
    rack();
    resetBall();

    hud = {
      round: centerText(scene, GAME_W / 2, 24, '', PALETTE.cream),
      you: text(scene, 8, 40, '', PALETTE.tealLight),
      cpu: text(scene, 8, 50, '', PALETTE.neon),
      best: text(scene, GAME_W - 6, 21, '', PALETTE.gold).setOrigin(1, 0),
      turn: centerText(scene, 58, 100, '', PALETTE.fog),
      meter: scene.add.rectangle(GAME_W - 24, 150, 6, 0, PALETTE.gold).setOrigin(0, 1),
    };
    scene.add.rectangle(GAME_W - 25, 96, 8, 54, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
    text(scene, GAME_W - 40, 154, 'HOLD', PALETTE.ash);
    text(scene, GAME_W - 40, 162, 'SPACE', PALETTE.ash);
    text(scene, 8, 146, 'A/D MOVE', PALETTE.ash);
    text(scene, 8, 154, '←→ AIM', PALETTE.ash);
    refreshHud();

    const kb = scene.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    keys = { left: bind(['A']), right: bind(['D']), aimL: bind(['LEFT']), aimR: bind(['RIGHT']) };
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
        state: () => ({ round, ballNo, turn, scores: { ...scores }, standing: pins.filter((p) => !p.down).length, rolling: ball.rolling, best }),
        // A dead-straight full-power throw, for proving the pins fall.  The
        // curve is forced off so the pin physics is tested on its own.
        strike: () => throwBall(0, 1, 0),
        // Any throw at all, from anywhere on the line.  Pass `hook` to pin the
        // curve instead of rolling for one.
        throw: (angle: number, pow: number, x?: number, hook?: number) => {
          if (x !== undefined) ball.x = x;
          throwBall(angle, pow, hook);
        },
        // The curve draw on its own, so the odds can be sampled without
        // rolling ten thousand balls down the lane.
        rollCurve: () => rollCurve(),
        curve: () => curve,
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
  ballBody?.setPosition(ball.x, ball.y).setVisible(true);
}

/**
 * Does this ball curve, and how much?  Zero most of the time; otherwise a
 * signed pull, the side chosen by a coin and the strength drawn from the band.
 *
 * The roll happens here rather than at pick-up so that nothing the player can
 * see — the meter, the aim line, the ball itself — has had the answer in it
 * while they were still deciding.
 */
function rollCurve(): number {
  if (Math.random() >= CURVE_CHANCE) return 0;
  const side = Math.random() < 0.5 ? -1 : 1;
  return side * (CURVE_MIN + Math.random() * (CURVE_MAX - CURVE_MIN));
}

/** `hook` forces the curve (the harness uses it); otherwise the lane rolls. */
function throwBall(angle: number, pow: number, hook?: number): void {
  // Not while the last roll is still being counted: a throw then restarted
  // the roll with the ball hidden and the frame never ended.
  if (ball.rolling || settleMs > 0 || over) return;
  curve = hook ?? rollCurve();
  const speed = THROW_MIN + pow * (THROW_MAX - THROW_MIN);
  ball.vx = Math.sin(angle) * speed;
  ball.vy = -Math.cos(angle) * speed;
  ball.rolling = true;
  standingBefore = pins.filter((p) => !p.down).length;
  audio.sfx('hop_wet');
}

/** The ball and every standing pin, one step. */
function stepPhysics(dt: number): void {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  // the curve, if this ball has one: a bend that grows with speed
  if (curve !== 0) ball.vx += curve * Math.abs(ball.vy) * dt;
  // lane friction
  const f = Math.max(0, 1 - 0.18 * dt);
  ball.vx *= f;
  ball.vy *= f;
  // the gutter: past the edge the ball rides the channel straight up
  if (ball.x < LANE_L + BALL_R || ball.x > LANE_L + LANE_W - BALL_R) {
    ball.x = Phaser.Math.Clamp(ball.x, LANE_L - 4, LANE_L + LANE_W + 4);
    ball.vx = 0;
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

function drawAim(): void {
  if (!aimLine) return;
  aimLine.clear();
  if (over || ball.rolling || turn !== 'player') return;
  const len = 40 + (charging ? power : 0) * 60;
  const x1 = ball.x + Math.sin(aim) * len;
  const y1 = ball.y - Math.cos(aim) * len;
  aimLine.lineStyle(1, charging ? PALETTE.gold : PALETTE.cream, 0.8);
  aimLine.beginPath();
  aimLine.moveTo(ball.x, ball.y);
  aimLine.lineTo(x1, y1);
  aimLine.strokePath();
  aimLine.fillStyle(charging ? PALETTE.gold : PALETTE.cream, 1);
  aimLine.fillCircle(x1, y1, 1.5);
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
  rack();
  resetBall();
  refreshHud();
}

/**
 * Froggy's arm.  He plays the ball the way it is now worth playing: straight
 * at the pocket from just off centre, with a small wobble and most of his
 * power, and no allowance for a curve he cannot know he has either.  Three of
 * his throws in ten bend too, and it costs him about what it costs you.  He
 * still gets sevens and eights; beating him still takes a strike or two.
 */
function cpuThrow(): void {
  if (!scene0 || over) return;
  scene0.time.delayedCall(900, () => {
    if (over || turn !== 'cpu') return;
    const pow = 0.62 + Math.random() * 0.34;
    // Just right of the centre board, aiming a shade left into the pocket —
    // his stance drifts and his arm is not steady.
    ball.x = LANE_L + LANE_W / 2 + 4 + (Math.random() - 0.5) * 12;
    const wobble = (Math.random() - 0.5) * 0.24;
    throwBall(-0.03 + wobble, pow);
  });
}

function refreshHud(): void {
  if (!hud) return;
  hud.round.setText(`ROUND ${round}/${ROUNDS}  -  BALL ${ballNo}`);
  hud.you.setText(`YOU     ${scores.player}`);
  hud.cpu.setText(`FROGGY  ${scores.cpu}`);
  hud.best.setText(`BEST ${best}`);
  hud.turn.setText(turn === 'player' ? 'YOUR BALL' : "FROGGY'S BALL").setTint(turn === 'player' ? 0x46c4bd : 0xff4fa3);
}

function finish(): void {
  if (over || !scene0) return;
  over = true;
  aimLine?.clear();
  if (store.setHighScore(ID, scores.player)) best = scores.player;
  refreshHud();
  const won = scores.player > scores.cpu;
  const line = won ? `YOU WIN ${scores.player} - ${scores.cpu}` : scores.player === scores.cpu ? `TIED ${scores.player} - ${scores.cpu}  -  NO PRIZE` : `FROGGY WINS ${scores.cpu} - ${scores.player}`;
  centerText(scene0, GAME_W / 2, 100, line, won ? PALETTE.gold : PALETTE.fog).setDepth(50);
  scene0.time.delayedCall(1600, () => (won ? apiRef?.win() : apiRef?.lose()));
}
