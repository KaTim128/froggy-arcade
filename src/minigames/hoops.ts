/**
 * Basketball Hoops.  PRD §9.5 — Medium, 3 tokens in, 6 out.
 *
 * Hold SPACE to charge, release to shoot; W and S tilt the shot while you do.
 * The meter bounces back down at the top so there is no infinite hold.  The
 * hoop slides, and speeds up 15% per made shot.  Five makes in sixty seconds.
 *
 * An arrow at the ball shows where it is going: its direction is the aim and
 * its length is the charge, so what leaves your hand is what you were looking
 * at, not a guess from a meter on the other side of the screen.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';
import { backdrop, silhouettes } from './decor';


const CHARGE_MS = 1200;
const GRAVITY = 420;
const LAUNCH = { x: 46, y: 150 };
/** Where the shot starts out, and how far W/S can tilt it either way. */
const LAUNCH_ANGLE = -Math.PI / 3.1;
const AIM_MIN = -Math.PI * 0.46; // nearly straight up
const AIM_MAX = -Math.PI * 0.14; // a flat line drive
const AIM_RATE = 1.3; // radians per second held
/** The arrow: this long at zero charge, and this much longer at full. */
const ARROW_MIN = 12;
const ARROW_GROW = 30;
const TARGET_MAKES = 5;
const ROUND_MS = 60_000;
const HOOP_Y = 74;
const HOOP_W = 22;

let power = 0;
let aim = LAUNCH_ANGLE;
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
let arrow: Phaser.GameObjects.Graphics | null = null;
let aimKeys: { up: Phaser.Input.Keyboard.Key[]; down: Phaser.Input.Keyboard.Key[] } = { up: [], down: [] };
let hoopRim: Phaser.GameObjects.Rectangle | null = null;
let backboard: Phaser.GameObjects.Rectangle | null = null;
let net: Phaser.GameObjects.Rectangle | null = null;
let hud: Phaser.GameObjects.BitmapText | null = null;
let apiRef: MinigameApi | null = null;
let scoredThisFlight = false;

export const hoops: MinigameModule = {
  id: 'hoops',
  title: 'HOOPS',
  music: 'game_hoops',
  rules: '5 shots in 60 seconds',

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    power = 0;
    aim = LAUNCH_ANGLE;
    charging = false;
    chargeDir = 1;
    inFlight = false;
    makes = 0;
    timeLeft = ROUND_MS;
    hoopSpeed = 60;
    hoopX = 220;
    hoopDir = 1;
    over = false;

    // A gym: a dark wall, a crowd along the back, a boarded court floor.
    backdrop(scene, 0x232a36, 0x1a1f28, { band: 0.2, speckleColor: 0xffd9a0 });
    scene.add.rectangle(0, 34, GAME_W, 20, 0x2e3644).setOrigin(0, 0);
    silhouettes(scene, 48, 26, 0x141a24, 0.9);
    scene.add.rectangle(0, 54, GAME_W, 2, 0x3a4456).setOrigin(0, 0);
    scene.add.rectangle(0, 160, GAME_W, 20, PALETTE.brown).setOrigin(0, 0);
    scene.add.rectangle(0, 160, GAME_W, 2, PALETTE.brownLight).setOrigin(0, 0);
    for (let x = 0; x < GAME_W; x += 24) scene.add.rectangle(x, 162, 1, 18, 0x5a3e26).setOrigin(0, 0);
    scene.add.rectangle(GAME_W / 2, 161, 1, 19, PALETTE.cream).setOrigin(0.5, 0).setAlpha(0.5);

    backboard = scene.add.rectangle(hoopX, HOOP_Y - 18, 4, 24, PALETTE.bone).setOrigin(0.5, 0);
    hoopRim = scene.add.rectangle(hoopX, HOOP_Y, HOOP_W, 2, PALETTE.ember).setOrigin(0.5, 0);
    net = scene.add.rectangle(hoopX, HOOP_Y + 2, HOOP_W - 4, 8, PALETTE.cream).setOrigin(0.5, 0).setAlpha(0.3);

    ball = scene.add.circle(LAUNCH.x, LAUNCH.y, 4, PALETTE.ember).setStrokeStyle(1, 0x8a3a10);

    scene.add.rectangle(14, 96, 8, 54, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
    meterFill = scene.add.rectangle(15, 149, 6, 0, PALETTE.gold).setOrigin(0, 1);
    text(scene, 8, 154, 'HOLD', PALETTE.ash);
    text(scene, 8, 162, 'SPACE', PALETTE.ash);
    text(scene, 44, 162, 'W/S AIM', PALETTE.ash);

    arrow = scene.add.graphics().setDepth(30);

    hud = centerText(scene, GAME_W / 2, 26, '', PALETTE.cream);
    refreshHud();

    const kb = scene.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    aimKeys = { up: bind(['W', 'UP']), down: bind(['S', 'DOWN']) };
    kb?.on('keydown-SPACE', () => {
      // A held key auto-repeats keydown.  Without the `charging` guard every
      // repeat reset power to zero, so holding SPACE pinned the meter at empty
      // and the shot always went out at minimum power.
      if (inFlight || over || charging) return;
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

    // ---- aim.  W tilts the shot up, S flattens it.  Works at any time you
    // are not mid-flight, so you can line up before you start charging.
    if (!inFlight) {
      const tilt = (aimKeys.up.some((k) => k.isDown) ? -1 : 0) + (aimKeys.down.some((k) => k.isDown) ? 1 : 0);
      aim = Phaser.Math.Clamp(aim + tilt * AIM_RATE * dt, AIM_MIN, AIM_MAX);
    }
    drawArrow();

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
    arrow = null;
    apiRef = null;
  },
};

/**
 * The launch arrow.  Dim while idle, so you can see where you are pointing;
 * bright and growing while SPACE is held, so the length you release at is the
 * shot you get.  Gone while the ball is in the air.
 */
function drawArrow(): void {
  if (!arrow) return;
  arrow.clear();
  if (inFlight || over) return;
  const len = ARROW_MIN + (charging ? power : 0) * ARROW_GROW;
  const dx = Math.cos(aim);
  const dy = Math.sin(aim);
  const x0 = LAUNCH.x + dx * 6;
  const y0 = LAUNCH.y + dy * 6;
  const x1 = x0 + dx * len;
  const y1 = y0 + dy * len;
  const colour = charging ? PALETTE.gold : PALETTE.ash;
  arrow.lineStyle(charging ? 2 : 1, colour, charging ? 1 : 0.7);
  arrow.beginPath();
  arrow.moveTo(x0, y0);
  arrow.lineTo(x1, y1);
  arrow.strokePath();
  // the head: two short strokes back from the tip
  const h = 5;
  const a = Math.PI * 0.8;
  arrow.beginPath();
  arrow.moveTo(x1, y1);
  arrow.lineTo(x1 + Math.cos(aim + a) * h, y1 + Math.sin(aim + a) * h);
  arrow.moveTo(x1, y1);
  arrow.lineTo(x1 + Math.cos(aim - a) * h, y1 + Math.sin(aim - a) * h);
  arrow.strokePath();
}

function shoot(): void {
  if (!ball) return;
  const speed = 150 + power * 300;
  // Exactly the direction the arrow was drawn in.
  ballVel = { x: Math.cos(aim) * speed, y: Math.sin(aim) * speed };
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
  arrow?.clear();
  const won = makes >= TARGET_MAKES;
  ball?.scene.time.delayedCall(500, () => (won ? apiRef?.win() : apiRef?.lose()));
}
