/**
 * SNOOKER.  Medium — 3 tokens in, 6 out.
 *
 * A table from above: six reds, five colours, a cue ball, six pockets.  Every
 * ball you pot is worth its value — a red one, the colours two to seven — and
 * the cabinet pays when the table is clear.  Twenty shots to do it in, which
 * is the whole of the difficulty: there is no "wrong ball" rule, no
 * alternation, only the count.  Pot the cue ball and it costs you four points
 * and a respot.
 *
 * Aim with the mouse (or A and D for fine work).  The line shows where the cue
 * ball goes, the ghost shows where it lands on the first ball it meets, and the
 * short tail off that ball is the way it will go.  Hold SPACE for power,
 * release to strike.  Balls run on friction and cushions, and into each other.
 *
 * Points are the game's own.  Best break is kept per profile.  Only tokens
 * leave through the shell.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'snooker' as const;
export const SHOTS = 20;
const FOUL = 4;

const TBL = { l: 42, t: 42, r: 278, b: 162 };
const R = 4;
const POCKET_R = 7;
const POCKETS = [
  { x: TBL.l, y: TBL.t },
  { x: TBL.r, y: TBL.t },
  { x: TBL.l, y: TBL.b },
  { x: TBL.r, y: TBL.b },
  { x: (TBL.l + TBL.r) / 2, y: TBL.t - 2 },
  { x: (TBL.l + TBL.r) / 2, y: TBL.b + 2 },
];
const CUE_SPOT = { x: 96, y: 102 };
const FRICTION = 48; // px/s^2
const STOP = 5;
const CUSHION_E = 0.72;
const BALL_E = 0.93;
const SHOT_MIN = 90;
const SHOT_MAX = 380;
const CHARGE_MS = 1100;
const AIM_NUDGE = 0.9; // radians per second on A/D

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  cue: boolean;
  body: Phaser.GameObjects.Arc;
}

let scene0: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let balls: Ball[] = [];
let cueBall: Ball | null = null;
let aim = 0;
let power = 0;
let charging = false;
let chargeDir = 1;
let shotsLeft = SHOTS;
let points = 0;
let best = 0;
let moving = false;
let over = false;
let gfx: Phaser.GameObjects.Graphics | null = null;
let keys: { left: Phaser.Input.Keyboard.Key[]; right: Phaser.Input.Keyboard.Key[] } = { left: [], right: [] };
let hud: { pts: Phaser.GameObjects.BitmapText; shots: Phaser.GameObjects.BitmapText; best: Phaser.GameObjects.BitmapText; meter: Phaser.GameObjects.Rectangle } | null = null;

const COLOURS: Array<{ value: number; colour: number; x: number; y: number }> = [
  { value: 2, colour: PALETTE.gold, x: 80, y: 72 },
  { value: 3, colour: 0x0f4d1c, x: 80, y: 132 },
  { value: 5, colour: 0x2f6fd8, x: 160, y: 102 },
  { value: 6, colour: PALETTE.neon, x: 190, y: 102 },
  { value: 7, colour: PALETTE.black, x: 262, y: 102 },
];

export const snooker: MinigameModule = {
  id: ID,
  title: 'SNOOKER',
  rules: 'clear the table in 20 shots',

  create(scene: Phaser.Scene, api: MinigameApi) {
    scene0 = scene;
    apiRef = api;
    balls = [];
    aim = 0;
    power = 0;
    charging = false;
    chargeDir = 1;
    shotsLeft = SHOTS;
    points = 0;
    best = store.highScore(ID);
    moving = false;
    over = false;

    scene.add.rectangle(0, 18, GAME_W, 162, 0x1a1410).setOrigin(0, 0);
    // frame, cushions, cloth
    scene.add.rectangle(TBL.l - 8, TBL.t - 8, TBL.r - TBL.l + 16, TBL.b - TBL.t + 16, PALETTE.brown).setOrigin(0, 0);
    scene.add.rectangle(TBL.l - 3, TBL.t - 3, TBL.r - TBL.l + 6, TBL.b - TBL.t + 6, 0x1f6b3a).setOrigin(0, 0);
    scene.add.rectangle(TBL.l, TBL.t, TBL.r - TBL.l, TBL.b - TBL.t, 0x2a8a4a).setOrigin(0, 0);
    for (const p of POCKETS) scene.add.circle(p.x, p.y, POCKET_R, PALETTE.black).setDepth(5);
    // baulk line and the D
    scene.add.rectangle(CUE_SPOT.x, TBL.t, 1, TBL.b - TBL.t, 0x3fa25e).setOrigin(0.5, 0).setAlpha(0.7);

    gfx = scene.add.graphics().setDepth(30);

    cueBall = addBall(CUE_SPOT.x, CUE_SPOT.y, 0, PALETTE.white, true);
    for (const c of COLOURS) addBall(c.x, c.y, c.value, c.colour, false);
    // six reds, racked behind the pink
    const apex = { x: 200, y: 102 };
    let n = 0;
    for (let row = 1; row <= 3 && n < 6; row++) {
      for (let i = 0; i < row && n < 6; i++) {
        const x = apex.x + row * (R * 1.75);
        const y = apex.y + (i - (row - 1) / 2) * (R * 2.1);
        addBall(x, y, 1, PALETTE.blood, false);
        n++;
      }
    }

    hud = {
      pts: text(scene, 6, 21, '', PALETTE.cream),
      shots: centerText(scene, GAME_W / 2, 25, '', PALETTE.fog),
      best: text(scene, GAME_W - 6, 21, '', PALETTE.gold).setOrigin(1, 0),
      meter: scene.add.rectangle(7, 150, 6, 0, PALETTE.gold).setOrigin(0, 1),
    };
    scene.add.rectangle(6, 96, 8, 54, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
    text(scene, 4, 154, 'HOLD', PALETTE.ash);
    text(scene, 4, 162, 'SPACE', PALETTE.ash);
    text(scene, GAME_W - 31, 154, 'MOUSE', PALETTE.ash);
    text(scene, GAME_W - 31, 162, 'AIMS', PALETTE.ash);
    refreshHud();

    const kb = scene.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    keys = { left: bind(['A', 'LEFT']), right: bind(['D', 'RIGHT']) };
    const start = () => {
      if (over || moving || charging) return;
      charging = true;
      power = 0;
      chargeDir = 1;
    };
    const release = () => {
      if (!charging || over) return;
      charging = false;
      strike();
    };
    kb?.on('keydown-SPACE', start);
    kb?.on('keyup-SPACE', release);
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!cueBall || moving || over) return;
      if (p.y < 18) return;
      aim = Math.atan2(p.y - cueBall.y, p.x - cueBall.x);
    });
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer, under: Phaser.GameObjects.GameObject[]) => {
      if (under.length > 0 || p.y < 18) return;
      start();
    });
    scene.input.on('pointerup', release);

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__snooker = {
        state: () => ({ points, shotsLeft, balls: balls.length, moving, best, aim }),
        // Line up on a ball and strike, for the harness.
        aimAt: (i: number) => {
          const b = balls.filter((x) => !x.cue)[i];
          if (b && cueBall) aim = Math.atan2(b.y - cueBall.y, b.x - cueBall.x);
        },
        strike: (pow: number) => {
          power = pow;
          strike();
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__snooker;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over || !cueBall) return;
    const dt = Math.min(delta, 40) / 1000;

    if (!moving) {
      const nudge = (keys.right.some((k) => k.isDown) ? 1 : 0) - (keys.left.some((k) => k.isDown) ? 1 : 0);
      aim += nudge * AIM_NUDGE * dt;
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
      drawAim();
      return;
    }

    // Sub-stepped so a fast ball cannot skip through another.
    const steps = 3;
    for (let s = 0; s < steps; s++) stepBalls(dt / steps);
    let any = false;
    for (const b of balls) {
      b.body.setPosition(b.x, b.y);
      if (Math.hypot(b.vx, b.vy) > 0) any = true;
    }
    if (!any) {
      moving = false;
      afterShot();
    }
  },

  destroy() {
    balls = [];
    cueBall = null;
    gfx = null;
    hud = null;
    apiRef = null;
    scene0 = null;
  },
};

function addBall(x: number, y: number, value: number, colour: number, cue: boolean): Ball {
  // Every ball gets an edge, so the green reads on the cloth and the black
  // reads against the pockets.
  const body = scene0!.add.circle(x, y, R, colour).setStrokeStyle(1, cue ? PALETTE.fog : PALETTE.cream).setDepth(20);
  const b: Ball = { x, y, vx: 0, vy: 0, value, cue, body };
  balls.push(b);
  return b;
}

function strike(): void {
  if (!cueBall || moving || over) return;
  const speed = SHOT_MIN + power * (SHOT_MAX - SHOT_MIN);
  cueBall.vx = Math.cos(aim) * speed;
  cueBall.vy = Math.sin(aim) * speed;
  moving = true;
  shotsLeft--;
  power = 0;
  gfx?.clear();
  refreshHud();
  audio.sfx('whack', 0.5);
}

function stepBalls(dt: number): void {
  for (const b of balls) {
    const sp = Math.hypot(b.vx, b.vy);
    if (sp === 0) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // rolling friction: a flat decel, then dead below a crawl
    const nsp = Math.max(0, sp - FRICTION * dt);
    if (nsp < STOP) {
      b.vx = 0;
      b.vy = 0;
    } else {
      b.vx *= nsp / sp;
      b.vy *= nsp / sp;
    }
    // cushions
    if (b.x < TBL.l + R) {
      b.x = TBL.l + R;
      b.vx = Math.abs(b.vx) * CUSHION_E;
    } else if (b.x > TBL.r - R) {
      b.x = TBL.r - R;
      b.vx = -Math.abs(b.vx) * CUSHION_E;
    }
    if (b.y < TBL.t + R) {
      b.y = TBL.t + R;
      b.vy = Math.abs(b.vy) * CUSHION_E;
    } else if (b.y > TBL.b - R) {
      b.y = TBL.b - R;
      b.vy = -Math.abs(b.vy) * CUSHION_E;
    }
  }
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) collide(balls[i], balls[j]);
  }
  // pockets
  for (const b of [...balls]) {
    const pocket = POCKETS.find((p) => Math.hypot(b.x - p.x, b.y - p.y) < POCKET_R);
    if (pocket) pot(b);
  }
}

function collide(a: Ball, b: Ball): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 0.01;
  if (d >= R * 2) return;
  const nx = dx / d;
  const ny = dy / d;
  const overlap = R * 2 - d;
  a.x -= (nx * overlap) / 2;
  a.y -= (ny * overlap) / 2;
  b.x += (nx * overlap) / 2;
  b.y += (ny * overlap) / 2;
  const along = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (along <= 0) return;
  const j = ((1 + BALL_E) * along) / 2;
  a.vx -= j * nx;
  a.vy -= j * ny;
  b.vx += j * nx;
  b.vy += j * ny;
  if (along > 30) audio.sfx('ui_hover', 0.4);
}

function pot(b: Ball): void {
  if (b.cue) {
    // Foul: four off, and back on its spot once everything stops.
    points = Math.max(0, points - FOUL);
    b.vx = 0;
    b.vy = 0;
    b.x = CUE_SPOT.x;
    b.y = CUE_SPOT.y;
    b.body.setPosition(b.x, b.y);
    audio.sfx('buzzer', 0.6);
    refreshHud();
    return;
  }
  points += b.value;
  balls = balls.filter((x) => x !== b);
  b.body.destroy();
  audio.sfx('coin_drop', 0.8);
  if (points > best) {
    best = points;
    store.setHighScore(ID, best);
  }
  refreshHud();
}

function afterShot(): void {
  const left = balls.filter((b) => !b.cue).length;
  if (left === 0) {
    finish(true);
    return;
  }
  if (shotsLeft <= 0) finish(false);
}

/** The aim: the cue behind the ball, the line to the first thing it hits. */
function drawAim(): void {
  if (!gfx || !cueBall) return;
  gfx.clear();
  const dx = Math.cos(aim);
  const dy = Math.sin(aim);

  // March until the ghost ball touches something.
  let x = cueBall.x;
  let y = cueBall.y;
  let hit: Ball | null = null;
  for (let i = 0; i < 200; i++) {
    x += dx * 2;
    y += dy * 2;
    if (x < TBL.l + R || x > TBL.r - R || y < TBL.t + R || y > TBL.b - R) break;
    hit = balls.find((b) => b !== cueBall && Math.hypot(b.x - x, b.y - y) < R * 2) ?? null;
    if (hit) break;
  }
  const c = charging ? PALETTE.gold : PALETTE.white;
  gfx.lineStyle(1, c, 0.75);
  gfx.beginPath();
  gfx.moveTo(cueBall.x, cueBall.y);
  gfx.lineTo(x, y);
  gfx.strokePath();
  gfx.lineStyle(1, c, 0.9);
  gfx.strokeCircle(x, y, R);
  if (hit) {
    // Where the object ball goes: along the line of centres at contact.
    const ox = hit.x - x;
    const oy = hit.y - y;
    const od = Math.hypot(ox, oy) || 1;
    gfx.lineStyle(1, PALETTE.gold, 0.8);
    gfx.beginPath();
    gfx.moveTo(hit.x, hit.y);
    gfx.lineTo(hit.x + (ox / od) * 18, hit.y + (oy / od) * 18);
    gfx.strokePath();
  }

  // The cue, drawn back further the harder you are going to hit it.
  const pull = 6 + (charging ? power : 0) * 14;
  gfx.lineStyle(2, PALETTE.brownLight, 1);
  gfx.beginPath();
  gfx.moveTo(cueBall.x - dx * pull, cueBall.y - dy * pull);
  gfx.lineTo(cueBall.x - dx * (pull + 40), cueBall.y - dy * (pull + 40));
  gfx.strokePath();
}

function refreshHud(): void {
  if (!hud) return;
  hud.pts.setText(`PTS ${points}`);
  hud.shots.setText(`SHOTS LEFT ${shotsLeft}  -  BALLS ${balls.filter((b) => !b.cue).length}`);
  hud.best.setText(`BEST ${best}`);
}

function finish(won: boolean): void {
  if (over || !scene0) return;
  over = true;
  gfx?.clear();
  store.setHighScore(ID, points);
  centerText(scene0, GAME_W / 2, 102, won ? `TABLE CLEARED  -  ${points} PTS` : `OUT OF SHOTS  -  ${points} PTS`, won ? PALETTE.gold : PALETTE.fog).setDepth(50);
  scene0.time.delayedCall(1400, () => (won ? apiRef?.win() : apiRef?.lose()));
}
