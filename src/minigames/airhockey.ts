/**
 * Air Hockey.  PRD §9.4 — Easy, 1 token in, 3 out.
 *
 * Mouse paddle in the player's half, first to 5, 180s cap, a tie refunds.
 * The AI tracks the puck's predicted intercept with a deliberate 140ms reaction
 * delay and an aim error, so it is beatable by feints (VOC-20).
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';
import { backdrop } from './decor';


const TABLE = { x: 70, y: 22, w: 180, h: 152 };
const GOAL_W = 64;
/**
 * The cooldown between rounds: three seconds with the puck sat on the spot.
 * Also used for the first face-off, so the opening of a game and the restart
 * after a goal are the same beat rather than two different ones.
 */
const ROUND_GAP_MS = 3000;
const PUCK_R = 4;
const PAD_R = 9;
/**
 * How close a mallet may get to the puck while the count is running: touching
 * it, plus a little daylight so it reads as being held off rather than as
 * being stuck to it.
 */
const KEEP_OFF = PAD_R + PUCK_R + 3;
const MAX_SPEED = 520;
// Hard tier: it reads the puck sooner and misjudges it less.  At 140ms/18px it
// was a warm-up opponent; the cabinet costs five tokens now.
const AI_REACTION_MS = 70;
const AI_AIM_ERROR = 7;
const TARGET_SCORE = 5;
const TIME_CAP_MS = 180_000;

interface Vec {
  x: number;
  y: number;
}

let puck: Phaser.GameObjects.Arc | null = null;
let pad: Phaser.GameObjects.Arc | null = null;
let aiPad: Phaser.GameObjects.Arc | null = null;
/** The faces on the two strikers, moved with them every frame. */
let padFace: Phaser.GameObjects.GameObject[] = [];
let aiFace: Phaser.GameObjects.GameObject[] = [];
let vel: Vec = { x: 0, y: 0 };
let padPrev: Vec = { x: 0, y: 0 };
/** Who conceded the last goal, which is all the AI does with the face-off. */
let openingDir = 1;
let history: Array<{ t: number; x: number; y: number }> = [];
let scoreP = 0;
let scoreA = 0;
let scoreText: Phaser.GameObjects.BitmapText | null = null;
/** The face-off count, big, on the centre spot. */
let countText: Phaser.GameObjects.BitmapText | null = null;
let elapsed = 0;
let frozen = 0;
let over = false;
let apiRef: MinigameApi | null = null;

export const airHockey: MinigameModule = {
  id: 'airhockey',
  title: 'AIR HOCKEY',
  music: 'game_airhockey',
  rules: 'first to 5 - 10 in, 20 out',
  tutorial: {
    objective: [
      'FIRST TO FIVE GOALS TAKES IT.',
      'TEN TOKENS IN, TWENTY BACK ON A WIN.',
      'THREE SECONDS ON THE SPOT AFTER A GOAL.',
      'USE THEM - GET BACK INTO YOUR OWN HALF.',
    ],
    controls: [
      ['MOUSE', 'MOVES YOUR MALLET'],
    ],
  },
  // The paddle follows the finger, the way it follows the mouse.
  touch: {},

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    scoreP = 0;
    scoreA = 0;
    elapsed = 0;
    over = false;
    history = [];

    backdrop(scene, 0x101a2a, 0x0a1220, { speckleColor: 0x9fd4ff });
    // the table: a wooden rail, then the playing surface with its markings
    scene.add.rectangle(TABLE.x - 6, TABLE.y - 6, TABLE.w + 12, TABLE.h + 12, 0x5c4326).setOrigin(0, 0);
    scene.add.rectangle(TABLE.x - 6, TABLE.y - 6, TABLE.w + 12, 3, 0x8a6a3a).setOrigin(0, 0);
    scene.add.rectangle(TABLE.x, TABLE.y, TABLE.w, TABLE.h, PALETTE.tealDark).setOrigin(0, 0);
    scene.add.rectangle(TABLE.x, TABLE.y, TABLE.w, TABLE.h / 2, 0x1a6a6a).setOrigin(0, 0).setAlpha(0.5);
    scene.add
      .rectangle(TABLE.x, TABLE.y, TABLE.w, TABLE.h)
      .setOrigin(0, 0)
      .setStrokeStyle(2, PALETTE.cream);
    scene.add.rectangle(TABLE.x, TABLE.y + TABLE.h / 2, TABLE.w, 1, PALETTE.cream).setOrigin(0, 0).setAlpha(0.6);
    scene.add.circle(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2, 18).setStrokeStyle(1, PALETTE.cream).setAlpha(0.6);
    scene.add.circle(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2, 2, PALETTE.cream).setAlpha(0.6);
    // the creases in front of each goal
    scene.add.arc(TABLE.x + TABLE.w / 2, TABLE.y, 22, 0, 180, false, 0x000000, 0).setStrokeStyle(1, PALETTE.neon).setAlpha(0.4);
    scene.add.arc(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h, 22, 180, 360, false, 0x000000, 0).setStrokeStyle(1, PALETTE.gold).setAlpha(0.4);

    // goals
    const gx = TABLE.x + (TABLE.w - GOAL_W) / 2;
    scene.add.rectangle(gx, TABLE.y - 1, GOAL_W, 3, PALETTE.neon).setOrigin(0, 0);
    scene.add.rectangle(gx, TABLE.y + TABLE.h - 2, GOAL_W, 3, PALETTE.gold).setOrigin(0, 0);

    // ---- TWO STRIKERS THAT ARE SOMEBODY, not two coloured discs.
    //
    // A gold circle and a cyan circle tell you which end of the table is
    // yours and nothing else.  Yours is Froggy -- green, with his eyes on
    // top of it looking down the table -- and the other one is the lizard,
    // amber with a crest.  Built from the striker outward so the face rides
    // the mallet without a container to keep in step.
    aiPad = scene.add.circle(TABLE.x + TABLE.w / 2, TABLE.y + 26, PAD_R, 0xc07a2e).setStrokeStyle(2, 0x6d4114, 0.9);
    aiFace = [
      scene.add.circle(0, 0, PAD_R * 0.62, 0xe8a94e),
      scene.add.circle(0, 0, PAD_R * 0.3, 0x6d4114),
      scene.add.triangle(0, 0, 0, 6, 3, 0, 6, 6, 0xffd45e),
    ];
    pad = scene.add.circle(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h - 26, PAD_R, 0x3d7a42).setStrokeStyle(2, 0x24492a, 0.9);
    padFace = [
      scene.add.circle(0, 0, PAD_R * 0.62, 0x5aa85f),
      scene.add.circle(0, 0, 2.6, PALETTE.cream),
      scene.add.circle(0, 0, 2.6, PALETTE.cream),
      scene.add.circle(0, 0, 1.2, PALETTE.black),
      scene.add.circle(0, 0, 1.2, PALETTE.black),
    ];
    puck = scene.add.circle(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2, PUCK_R, 0x1a1a22).setStrokeStyle(1, PALETTE.cream);
    padPrev = { x: pad.x, y: pad.y };

    scoreText = centerText(scene, GAME_W / 2, 178, '', PALETTE.cream);
    // On the centre spot, over the puck it is holding still.
    countText = centerText(scene, GAME_W / 2, TABLE.y + TABLE.h / 2 - 14, '', PALETTE.gold, 16)
      .setDepth(40)
      .setVisible(false);
    text(scene, 8, 30, 'MOUSE', PALETTE.ash);
    text(scene, 8, 40, 'TO MOVE', PALETTE.ash);
    updateScore();

    // The opening face-off is the same three seconds as every restart.
    serve(1);
  },

  update(_t: number, delta: number) {
    if (over || !puck || !pad || !aiPad) return;
    const scene = puck.scene;
    elapsed += delta;

    if (frozen > 0) {
      frozen -= delta;
      // Counted down where it can be seen: three seconds of a puck that will
      // not move is a broken game unless the game says what it is waiting for.
      countText?.setText(frozen > 0 ? `${Math.ceil(frozen / 1000)}` : '').setVisible(frozen > 0);

      // ---- THE PUCK IS STILL.  THE PADDLES ARE NOT.
      //
      // The whole update used to return here, which froze the player's mallet
      // to the felt for three seconds with the mouse moving under it.  You can
      // take your position while the count runs -- and you cannot take it ON
      // the spot: both mallets are held outside a ring round the puck, so
      // nothing can be resting against it when the count ends and nobody gets
      // a goal out of the wait.  Nothing in here touches the puck's position
      // or its velocity.
      followPointer(scene);
      keepOffPuck(pad);
      // The machine waits at its own end rather than crowding the spot.
      const back = (150 * delta) / 1000;
      aiPad.x += Phaser.Math.Clamp(TABLE.x + TABLE.w / 2 - aiPad.x, -back, back);
      aiPad.y += Phaser.Math.Clamp(TABLE.y + 26 - aiPad.y, -back, back);
      keepOffPuck(aiPad);
      // The mallet is standing still as far as the first bounce is concerned:
      // whatever the mouse did during the count is not a swing.  The machine's
      // mallet is always treated as still -- see the collide call below.
      padPrev = { x: pad.x, y: pad.y };
      return;
    }
    countText?.setVisible(false);

    // ---- player paddle follows the mouse, clamped to the lower half
    followPointer(scene);

    // ---- AI: chase a 140ms-old view of the puck
    history.push({ t: elapsed, x: puck.x, y: puck.y });
    while (history.length > 2 && elapsed - history[0].t > AI_REACTION_MS) history.shift();
    const seen = history[0];
    // ---- AND SOMEBODY HAS TO GO AND GET IT.
    //
    // A puck that waits to be hit is a puck nobody hits, if the opponent only
    // ever reacts to one already moving: the round would sit there until the
    // clock ran out.  Dead on the spot, he comes for it -- keenly if he just
    // conceded, warily if he just scored, which is the difference between
    // wanting the restart and being happy to let you take it.
    const dead = vel.x === 0 && vel.y === 0;
    const eager = openingDir > 0 ? 1 : 0.55;
    const wantX = dead
      ? puck.x + (Math.random() - 0.5) * AI_AIM_ERROR * 0.5
      : vel.y < 0
        ? seen.x + (Math.random() - 0.5) * AI_AIM_ERROR
        : TABLE.x + TABLE.w / 2 + (seen.x - (TABLE.x + TABLE.w / 2)) * 0.35;
    const wantY = dead
      ? Math.min(puck.y - PAD_R * 0.4, TABLE.y + TABLE.h / 2 - PAD_R)
      : vel.y < 0 ? Math.min(seen.y + 10, TABLE.y + TABLE.h / 2 - PAD_R) : TABLE.y + 26;
    const aiSpeed = dead ? 150 * eager : 150;
    const step = (aiSpeed * delta) / 1000;
    aiPad.x += Phaser.Math.Clamp(wantX - aiPad.x, -step, step);
    aiPad.y += Phaser.Math.Clamp(wantY - aiPad.y, -step, step);
    aiPad.x = Phaser.Math.Clamp(aiPad.x, TABLE.x + PAD_R, TABLE.x + TABLE.w - PAD_R);
    aiPad.y = Phaser.Math.Clamp(aiPad.y, TABLE.y + PAD_R, TABLE.y + TABLE.h / 2 - PAD_R);

    // the faces ride their strikers
    dressPads();

    // ---- puck
    const dt = delta / 1000;
    puck.x += vel.x * dt;
    puck.y += vel.y * dt;

    if (puck.x < TABLE.x + PUCK_R) {
      puck.x = TABLE.x + PUCK_R;
      vel.x = Math.abs(vel.x);
      audio.sfx('ui_hover');
    }
    if (puck.x > TABLE.x + TABLE.w - PUCK_R) {
      puck.x = TABLE.x + TABLE.w - PUCK_R;
      vel.x = -Math.abs(vel.x);
      audio.sfx('ui_hover');
    }

    const gx0 = TABLE.x + (TABLE.w - GOAL_W) / 2;
    const inGoalX = puck.x > gx0 && puck.x < gx0 + GOAL_W;

    if (puck.y < TABLE.y + PUCK_R) {
      if (inGoalX) return goal(true);
      puck.y = TABLE.y + PUCK_R;
      vel.y = Math.abs(vel.y);
    }
    if (puck.y > TABLE.y + TABLE.h - PUCK_R) {
      if (inGoalX) return goal(false);
      puck.y = TABLE.y + TABLE.h - PUCK_R;
      vel.y = -Math.abs(vel.y);
    }

    collide(pad, { x: pad.x - padPrev.x, y: pad.y - padPrev.y }, delta);
    collide(aiPad, { x: 0, y: 0 }, delta);

    // friction and cap
    vel.x *= 0.9995;
    vel.y *= 0.9995;
    const sp = Math.hypot(vel.x, vel.y);
    if (sp > MAX_SPEED) {
      vel.x = (vel.x / sp) * MAX_SPEED;
      vel.y = (vel.y / sp) * MAX_SPEED;
    }

    if (elapsed > TIME_CAP_MS) finish();
  },

  destroy() {
    puck = null;
    pad = null;
    aiPad = null;
    scoreText = null;
    countText = null;
    apiRef = null;
  },
};

/** The player's mallet, under the mouse and inside its own half. */
function followPointer(scene: Phaser.Scene): void {
  if (!pad) return;
  const p = scene.input.activePointer;
  const px = Phaser.Math.Clamp(p.worldX, TABLE.x + PAD_R, TABLE.x + TABLE.w - PAD_R);
  const py = Phaser.Math.Clamp(p.worldY, TABLE.y + TABLE.h / 2 + PAD_R, TABLE.y + TABLE.h - PAD_R);
  padPrev = { x: pad.x, y: pad.y };
  pad.setPosition(px, py);
}

/**
 * Hold a mallet outside a ring round the puck, and move the MALLET to do it.
 *
 * Used only while the count is running.  A mallet that was allowed to rest
 * against a stationary puck would be touching it the instant the count ended,
 * which is a free goal for whoever got there first -- and pushing the puck out
 * of the way instead would be the puck moving during a count that exists to
 * keep it still.
 */
function keepOffPuck(p: Phaser.GameObjects.Arc): void {
  if (!puck) return;
  const dx = p.x - puck.x;
  const dy = p.y - puck.y;
  const d = Math.hypot(dx, dy);
  if (d >= KEEP_OFF) return;
  // Straight out from the puck; from exactly on top of it, downwards.
  const nx = d === 0 ? 0 : dx / d;
  const ny = d === 0 ? 1 : dy / d;
  p.setPosition(puck.x + nx * KEEP_OFF, puck.y + ny * KEEP_OFF);
}

function collide(p: Phaser.GameObjects.Arc, padVel: Vec, delta: number): void {
  if (!puck) return;
  const dx = puck.x - p.x;
  const dy = puck.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d > PAD_R + PUCK_R || d === 0) return;

  const nx = dx / d;
  const ny = dy / d;
  puck.x = p.x + nx * (PAD_R + PUCK_R + 0.5);
  puck.y = p.y + ny * (PAD_R + PUCK_R + 0.5);

  const dot = vel.x * nx + vel.y * ny;
  vel.x = (vel.x - 2 * dot * nx) * 0.98;
  vel.y = (vel.y - 2 * dot * ny) * 0.98;

  // the puck inherits some of the paddle's motion
  const inherit = 1000 / Math.max(1, delta);
  vel.x += padVel.x * inherit * 0.28;
  vel.y += padVel.y * inherit * 0.28;

  const sp = Math.hypot(vel.x, vel.y);
  if (sp < 120) {
    vel.x = nx * 150;
    vel.y = ny * 150;
  }
  audio.sfx('whack');
}

function goal(playerScored: boolean): void {
  if (playerScored) scoreP++;
  else scoreA++;
  audio.sfx(playerScored ? 'chime' : 'buzzer');
  updateScore();
  if (scoreP >= TARGET_SCORE || scoreA >= TARGET_SCORE) {
    finish();
    return;
  }
  serve(playerScored ? -1 : 1);
}

/**
 * Centre the puck and hold it there for the cooldown.
 *
 * THREE SECONDS BETWEEN ROUNDS, not half of one.  The old half second put the
 * puck back in play before either mallet had been moved off wherever the last
 * goal left it, so the restart was a scramble rather than a fresh face-off.
 * Three is long enough to get back to your own half and watch the count, and
 * the count is on screen because three silent seconds reads as a hang.
 */
function serve(dir: number): void {
  if (!puck) return;
  // ---- IT IS A FACE-OFF, NOT A SERVE.
  //
  // The puck used to launch itself down the table at one of them the instant
  // the count ran out, which means the first thing that happens in every
  // round is decided by a random number rather than by either player.  It
  // sits dead on the centre spot now and waits to be hit, the way a puck on
  // a real table does -- whoever gets there first gets the first say.
  //
  // `dir` is kept because the caller knows who conceded and the AI reads it
  // to decide how hard to commit to the opening; nothing moves on its own.
  puck.setPosition(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2);
  vel = { x: 0, y: 0 };
  openingDir = dir;
  frozen = ROUND_GAP_MS;
  history = [];
}

/** Put each striker's face back on it, wherever the mallet has got to. */
function dressPads(): void {
  if (pad && padFace.length === 5) {
    const [belly, eyeL, eyeR, pupL, pupR] = padFace as Phaser.GameObjects.Arc[];
    belly.setPosition(pad.x, pad.y + 1);
    eyeL.setPosition(pad.x - 3.2, pad.y - 3);
    eyeR.setPosition(pad.x + 3.2, pad.y - 3);
    pupL.setPosition(pad.x - 3.2, pad.y - 3.6);
    pupR.setPosition(pad.x + 3.2, pad.y - 3.6);
  }
  if (aiPad && aiFace.length === 3) {
    const [belly, snout, crest] = aiFace as Array<Phaser.GameObjects.Arc & { setPosition(x: number, y: number): unknown }>;
    belly.setPosition(aiPad.x, aiPad.y - 1);
    snout.setPosition(aiPad.x, aiPad.y + 2);
    crest.setPosition(aiPad.x - 3, aiPad.y - PAD_R - 1);
  }
}

function updateScore(): void {
  scoreText?.setText(`FROGGY ${scoreA}   -   ${scoreP} YOU`);
}

/** PRD §9.4: on timeout the higher score wins.  Level on the clock is a tie. */
function finish(): void {
  if (over) return;
  over = true;
  const won = scoreP > scoreA;
  const tied = scoreP === scoreA;
  puck?.scene.time.delayedCall(400, () => (won ? apiRef?.win() : tied ? apiRef?.draw() : apiRef?.lose()));
}

export const _debug = { TABLE, GAME_H };
