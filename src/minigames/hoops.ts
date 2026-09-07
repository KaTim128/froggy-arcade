/**
 * Basketball Hoops.  PRD §9.5 — Medium, 3 tokens in, 6 out.
 *
 * Hold SPACE to charge, release to shoot.  The meter bounces back down at the
 * top so there is no infinite hold.  The hoop slides, and speeds up 15% per
 * made shot.  Five makes in sixty seconds.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const CHARGE_MS = 1200;
const GRAVITY = 420;
const LAUNCH = { x: 46, y: 150 };
const LAUNCH_ANGLE = -Math.PI / 3.1; // fixed: power is the only variable
const TARGET_MAKES = 5;
const ROUND_MS = 60_000;
const HOOP_Y = 74;
const HOOP_W = 22;

let power = 0;
let charging = false;
let chargeDir = 1;
let ball: Phaser.GameObjects.Arc | null = null;
let ballVel = { x: 0, y: 0 };
let inFlight = false;
let hoopX = 220;
let hoopDir = 1;
let hoopSpeed = 60;
let makes = 0;
let timeLeft = ROUND_MS;
let over = false;

let meterFill: Phaser.GameObjects.Rectangle | null = null;
let hoopRim: Phaser.GameObjects.Rectangle | null = null;
let backboard: Phaser.GameObjects.Rectangle | null = null;
let net: Phaser.GameObjects.Rectangle | null = null;
let hud: Phaser.GameObjects.BitmapText | null = null;
let apiRef: MinigameApi | null = null;
let scoredThisFlight = false;

export const hoops: MinigameModule = {
  id: 'hoops',
  title: 'HOOPS',
  rules: '5 shots in 60 seconds',

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    power = 0;
    charging = false;
    chargeDir = 1;
    inFlight = false;
    makes = 0;
    timeLeft = ROUND_MS;
    hoopSpeed = 60;
    hoopX = 220;
    hoopDir = 1;
    over = false;

    scene.add.rectangle(0, 160, GAME_W, 20, PALETTE.brown).setOrigin(0, 0);
    scene.add.rectangle(0, 160, GAME_W, 2, PALETTE.brownLight).setOrigin(0, 0);

    backboard = scene.add.rectangle(hoopX, HOOP_Y - 18, 4, 24, PALETTE.bone).setOrigin(0.5, 0);
    hoopRim = scene.add.rectangle(hoopX, HOOP_Y, HOOP_W, 2, PALETTE.ember).setOrigin(0.5, 0);
    net = scene.add.rectangle(hoopX, HOOP_Y + 2, HOOP_W - 4, 8, PALETTE.cream).setOrigin(0.5, 0).setAlpha(0.3);

    ball = scene.add.circle(LAUNCH.x, LAUNCH.y, 4, PALETTE.ember);

    scene.add.rectangle(14, 96, 8, 54, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
    meterFill = scene.add.rectangle(15, 149, 6, 0, PALETTE.gold).setOrigin(0, 1);
    text(scene, 8, 154, 'HOLD', PALETTE.ash);
    text(scene, 8, 162, 'SPACE', PALETTE.ash);

    hud = centerText(scene, GAME_W / 2, 26, '', PALETTE.cream);
    refreshHud();

    const kb = scene.input.keyboard;
    kb?.on('keydown-SPACE', () => {
      if (inFlight || over) return;
      charging = true;
      power = 0;
      chargeDir = 1;
    });
    kb?.on('keyup-SPACE', () => {
      if (!charging || over) return;
      charging = false;
      shoot();
    });
  },

  update(_t: number, delta: number) {
    if (over || !ball || !hoopRim || !backboard || !net) return;
    const dt = delta / 1000;

    timeLeft -= delta;
    if (timeLeft <= 0) {
      finish();
      return;
    }
    refreshHud();

    // ---- hoop slides, and gets faster with every make
    hoopX += hoopDir * hoopSpeed * dt;
    if (hoopX > GAME_W - 30) {
      hoopX = GAME_W - 30;
      hoopDir = -1;
    }
    if (hoopX < 130) {
      hoopX = 130;
      hoopDir = 1;
    }
    hoopRim.x = hoopX;
    backboard.x = hoopX + HOOP_W / 2 + 2;
    net.x = hoopX;

    // ---- charge meter, bouncing at the top
    if (charging) {
      power += (chargeDir * delta) / CHARGE_MS;
      if (power >= 1) {
        power = 1;
        chargeDir = -1;
      }
      if (power <= 0) {
        power = 0;
        chargeDir = 1;
      }
      meterFill?.setSize(6, power * 52);
    } else if (!inFlight) {
      meterFill?.setSize(6, 0);
    }

    // ---- flight
    if (inFlight) {
      const prevY = ball.y;
      ballVel.y += GRAVITY * dt;
      ball.x += ballVel.x * dt;
      ball.y += ballVel.y * dt;

      // through the rim, downward, within the hoop's mouth
      if (
        !scoredThisFlight &&
        ballVel.y > 0 &&
        prevY <= HOOP_Y &&
        ball.y >= HOOP_Y &&
        Math.abs(ball.x - hoopX) < HOOP_W / 2 - 2
      ) {
        scoredThisFlight = true;
        makes++;
        hoopSpeed *= 1.15; // PRD §9.5
        audio.sfx('chime');
        if (makes >= TARGET_MAKES) {
          finish();
          return;
        }
      }

      // backboard is real, so bank shots work
      if (
        Math.abs(ball.x - (hoopX + HOOP_W / 2 + 2)) < 4 &&
        ball.y > HOOP_Y - 18 &&
        ball.y < HOOP_Y + 6 &&
        ballVel.x > 0
      ) {
        ballVel.x = -Math.abs(ballVel.x) * 0.6;
        audio.sfx('ui_hover');
      }

      if (ball.y > 158 || ball.x > GAME_W + 10) reset();
    }
  },

  destroy() {
    ball = null;
    hoopRim = null;
    apiRef = null;
  },
};

function shoot(): void {
  if (!ball) return;
  const speed = 150 + power * 300;
  ballVel = { x: Math.cos(LAUNCH_ANGLE) * speed * -1, y: Math.sin(LAUNCH_ANGLE) * speed };
  ballVel.x = Math.abs(ballVel.x);
  inFlight = true;
  scoredThisFlight = false;
  audio.sfx('whack');
}

function reset(): void {
  if (!ball) return;
  inFlight = false;
  ball.setPosition(LAUNCH.x, LAUNCH.y);
  ballVel = { x: 0, y: 0 };
  power = 0;
  meterFill?.setSize(6, 0);
}

function refreshHud(): void {
  hud?.setText(`MADE ${makes}/${TARGET_MAKES}    ${Math.ceil(timeLeft / 1000)}s`);
}

function finish(): void {
  if (over) return;
  over = true;
  const won = makes >= TARGET_MAKES;
  ball?.scene.time.delayedCall(500, () => (won ? apiRef?.win() : apiRef?.lose()));
}
