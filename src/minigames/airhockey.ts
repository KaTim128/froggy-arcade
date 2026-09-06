/**
 * Air Hockey.  PRD §9.4 — Easy, 1 token in, 3 out.
 *
 * Mouse paddle in the player's half, first to 5, 180s cap, a tie is a loss.
 * The AI tracks the puck's predicted intercept with a deliberate 140ms reaction
 * delay and an aim error, so it is beatable by feints (VOC-20).
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const TABLE = { x: 70, y: 22, w: 180, h: 152 };
const GOAL_W = 64;
const PUCK_R = 4;
const PAD_R = 9;
const MAX_SPEED = 520;
const AI_REACTION_MS = 140;
const AI_AIM_ERROR = 18;
const TARGET_SCORE = 5;
const TIME_CAP_MS = 180_000;

interface Vec {
  x: number;
  y: number;
}

let puck: Phaser.GameObjects.Arc | null = null;
let pad: Phaser.GameObjects.Arc | null = null;
let aiPad: Phaser.GameObjects.Arc | null = null;
let vel: Vec = { x: 0, y: 0 };
let padPrev: Vec = { x: 0, y: 0 };
let history: Array<{ t: number; x: number; y: number }> = [];
let scoreP = 0;
let scoreA = 0;
let scoreText: Phaser.GameObjects.Text | null = null;
let elapsed = 0;
let frozen = 0;
let over = false;
let apiRef: MinigameApi | null = null;

export const airHockey: MinigameModule = {
  id: 'airhockey',
  title: 'AIR HOCKEY',
  rules: 'first to 5',

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    scoreP = 0;
    scoreA = 0;
    elapsed = 0;
    over = false;
    history = [];

    scene.add.rectangle(TABLE.x, TABLE.y, TABLE.w, TABLE.h, PALETTE.tealDark).setOrigin(0, 0);
    scene.add
      .rectangle(TABLE.x, TABLE.y, TABLE.w, TABLE.h)
      .setOrigin(0, 0)
      .setStrokeStyle(2, PALETTE.cream);
    scene.add.rectangle(TABLE.x, TABLE.y + TABLE.h / 2, TABLE.w, 1, PALETTE.cream).setOrigin(0, 0).setAlpha(0.6);
    scene.add.circle(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2, 18).setStrokeStyle(1, PALETTE.cream).setAlpha(0.6);

    // goals
    const gx = TABLE.x + (TABLE.w - GOAL_W) / 2;
    scene.add.rectangle(gx, TABLE.y - 1, GOAL_W, 3, PALETTE.neon).setOrigin(0, 0);
    scene.add.rectangle(gx, TABLE.y + TABLE.h - 2, GOAL_W, 3, PALETTE.gold).setOrigin(0, 0);

    aiPad = scene.add.circle(TABLE.x + TABLE.w / 2, TABLE.y + 26, PAD_R, PALETTE.neon);
    pad = scene.add.circle(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h - 26, PAD_R, PALETTE.gold);
    puck = scene.add.circle(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2, PUCK_R, PALETTE.cream);
    padPrev = { x: pad.x, y: pad.y };

    scoreText = centerText(scene, GAME_W / 2, 178, '', PALETTE.cream);
    text(scene, 8, 30, 'MOUSE', PALETTE.ash);
    text(scene, 8, 40, 'TO MOVE', PALETTE.ash);
    updateScore();

    serve(1);
  },

  update(_t: number, delta: number) {
    if (over || !puck || !pad || !aiPad) return;
    const scene = puck.scene;
    elapsed += delta;

    if (frozen > 0) {
      frozen -= delta;
      return;
    }

    // ---- player paddle follows the mouse, clamped to the lower half
    const p = scene.input.activePointer;
    const px = Phaser.Math.Clamp(p.worldX, TABLE.x + PAD_R, TABLE.x + TABLE.w - PAD_R);
    const py = Phaser.Math.Clamp(p.worldY, TABLE.y + TABLE.h / 2 + PAD_R, TABLE.y + TABLE.h - PAD_R);
    padPrev = { x: pad.x, y: pad.y };
    pad.setPosition(px, py);

    // ---- AI: chase a 140ms-old view of the puck
    history.push({ t: elapsed, x: puck.x, y: puck.y });
    while (history.length > 2 && elapsed - history[0].t > AI_REACTION_MS) history.shift();
    const seen = history[0];
    const wantX =
      vel.y < 0
        ? seen.x + (Math.random() - 0.5) * AI_AIM_ERROR
        : TABLE.x + TABLE.w / 2 + (seen.x - (TABLE.x + TABLE.w / 2)) * 0.35;
    const wantY = vel.y < 0 ? Math.min(seen.y + 10, TABLE.y + TABLE.h / 2 - PAD_R) : TABLE.y + 26;
    const aiSpeed = 150;
    const step = (aiSpeed * delta) / 1000;
    aiPad.x += Phaser.Math.Clamp(wantX - aiPad.x, -step, step);
    aiPad.y += Phaser.Math.Clamp(wantY - aiPad.y, -step, step);
    aiPad.x = Phaser.Math.Clamp(aiPad.x, TABLE.x + PAD_R, TABLE.x + TABLE.w - PAD_R);
    aiPad.y = Phaser.Math.Clamp(aiPad.y, TABLE.y + PAD_R, TABLE.y + TABLE.h / 2 - PAD_R);

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
    apiRef = null;
  },
};

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

function serve(dir: number): void {
  if (!puck) return;
  puck.setPosition(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2);
  vel = { x: Phaser.Math.Between(-90, 90), y: 170 * dir };
  frozen = 500;
  history = [];
}

function updateScore(): void {
  scoreText?.setText(`FROGGY ${scoreA}   -   ${scoreP} YOU`);
}

/** PRD §9.4: on timeout the higher score wins, and a tie is a loss. */
function finish(): void {
  if (over) return;
  over = true;
  const won = scoreP > scoreA;
  puck?.scene.time.delayedCall(400, () => (won ? apiRef?.win() : apiRef?.lose()));
}

export const _debug = { TABLE, GAME_H };
