/**
 * FROG CROSS THE ROAD.  Hard — 7 tokens in, ten and up out.
 *
 * Eight lanes of traffic between the kerb and the far bank.  Every crossing
 * is ten points and makes the road a little worse: faster cars, more of them,
 * longer ones.  Three lives.  Ten crossings — a hundred points — is the bar:
 * reach it and the run pays ten tokens, and every further ten crossings adds one.
 *
 * Nothing about it is timed.  The clock here is your patience: the road only
 * gets harder, so the question is how far past the bar you push before the
 * last life goes, or whether you take ENTER and bank what you have.
 *
 * The score is the game's own; nothing but tokens ever leaves through the
 * shell (MG-3).  The best score is kept per profile (store.highScores).
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'frogcross' as const;

/** The bar, the base payout, and what each further bar is worth. */
export const TARGET_POINTS = 100;
export const BASE_REWARD = 10;
export const POINTS_PER_CROSS = 10;

const LANES = 8;
const LANE_H = 14;
/** y of the bottom of the lowest lane; lanes stack upward from here. */
const ROAD_BOTTOM = 156;
const ROAD_TOP = ROAD_BOTTOM - LANES * LANE_H; // 44
const BANK_TOP = 32;
const COL_W = 16;
const LIVES = 3;
const HOP_MS = 90;
/** The instruction holds this long, and the frog holds with it. */
const INTRO_MS = 3000;
const CAR_H = 9;

interface Car {
  x: number;
  lane: number;
  w: number;
  dir: 1 | -1;
  speed: number;
  body: Phaser.GameObjects.Rectangle;
}

interface Lane {
  dir: 1 | -1;
  base: number;
  timer: number;
}

let cars: Car[] = [];
let lanes: Lane[] = [];
let frog = { col: 9, row: 0 };
let sprite: Phaser.GameObjects.Rectangle | null = null;
let eyes: Phaser.GameObjects.Rectangle | null = null;
let points = 0;
let best = 0;
let lives = LIVES;
let crossings = 0;
let hopping = false;
let dead = false;
let over = false;
let invulnMs = 0;
let introMs = 0;
let intro: Phaser.GameObjects.BitmapText | null = null;
let introPlate: Phaser.GameObjects.Rectangle | null = null;
let hud: { pts: Phaser.GameObjects.BitmapText; lives: Phaser.GameObjects.BitmapText; best: Phaser.GameObjects.BitmapText; bank: Phaser.GameObjects.BitmapText } | null = null;
let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;

/** Tokens a run is worth, or zero if it never reached the bar. */
export function frogPayout(pts: number): number {
  if (pts < TARGET_POINTS) return 0;
  return BASE_REWARD + Math.floor((pts - TARGET_POINTS) / TARGET_POINTS);
}

const rowY = (row: number): number => (row > LANES ? BANK_TOP + 6 : ROAD_BOTTOM + 7 - row * LANE_H);
const colX = (col: number): number => 8 + col * COL_W;
const laneY = (lane: number): number => ROAD_BOTTOM - lane * LANE_H + LANE_H / 2; // centre of lane 1..LANES

export const frogCross: MinigameModule = {
  id: ID,
  title: 'FROG CROSS THE ROAD',
  rules: 'cross 10 times to win',
  payoutNote: 'WIN: 10+',

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    sceneRef = scene;
    cars = [];
    lanes = [];
    points = 0;
    best = store.highScore(ID);
    lives = LIVES;
    crossings = 0;
    hopping = false;
    dead = false;
    over = false;
    invulnMs = 0;
    introMs = INTRO_MS;

    // far bank, road, kerb
    scene.add.rectangle(0, 18, GAME_W, 162, 0x10141c).setOrigin(0, 0);
    scene.add.rectangle(0, BANK_TOP, GAME_W, ROAD_TOP - BANK_TOP, PALETTE.moss).setOrigin(0, 0);
    scene.add.rectangle(0, BANK_TOP, GAME_W, 2, PALETTE.mossLight).setOrigin(0, 0);
    scene.add.rectangle(0, ROAD_TOP, GAME_W, LANES * LANE_H, 0x2a2d33).setOrigin(0, 0);
    for (let k = 1; k < LANES; k++) {
      const y = ROAD_BOTTOM - k * LANE_H;
      for (let x = 4; x < GAME_W; x += 14) scene.add.rectangle(x, y, 7, 1, 0x5c5f66).setOrigin(0, 0.5);
    }
    scene.add.rectangle(0, ROAD_BOTTOM, GAME_W, 2, PALETTE.fog).setOrigin(0, 0);
    scene.add.rectangle(0, ROAD_BOTTOM + 2, GAME_W, 178 - ROAD_BOTTOM, PALETTE.slate).setOrigin(0, 0);

    for (let k = 1; k <= LANES; k++) {
      lanes.push({
        dir: k % 2 === 1 ? 1 : -1,
        base: 34 + (k % 3) * 11 + (k > 5 ? 8 : 0),
        timer: 600 + Math.random() * 1400,
      });
    }

    frog = { col: 9, row: 0 };
    sprite = scene.add.rectangle(colX(frog.col), rowY(0), 10, 9, PALETTE.mossLight).setDepth(20);
    eyes = scene.add.rectangle(colX(frog.col), rowY(0) - 4, 8, 2, PALETTE.cream).setDepth(21);

    hud = {
      pts: text(scene, 6, 21, '', PALETTE.cream),
      lives: centerText(scene, GAME_W / 2, 25, '', PALETTE.fog),
      best: text(scene, GAME_W - 6, 21, '', PALETTE.gold).setOrigin(1, 0),
      bank: centerText(scene, GAME_W / 2, 168, '', PALETTE.gold).setVisible(false),
    };
    refreshHud();

    // What to do, said once.  It fades after three seconds, and the frog
    // does not move until it has gone.
    introPlate = scene.add.rectangle(GAME_W / 2, 100, 262, 26, PALETTE.black, 0.7).setDepth(39);
    intro = centerText(scene, GAME_W / 2, 100, 'HOP ACROSS THE ROAD WITH WASD', PALETTE.gold, 16).setDepth(40);

    const kb = scene.input.keyboard;
    const on = (names: string[], fn: () => void) => names.forEach((n) => kb?.on(`keydown-${n}`, fn));
    on(['W', 'UP'], () => hop(0, 1));
    on(['S', 'DOWN'], () => hop(0, -1));
    on(['A', 'LEFT'], () => hop(-1, 0));
    on(['D', 'RIGHT'], () => hop(1, 0));
    on(['ENTER'], () => {
      if (!over && points >= TARGET_POINTS) finish();
    });

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__frog = {
        state: () => ({ points, lives, crossings, frog: { ...frog }, cars: cars.length, best }),
        // Straight to the far bank, for proving the scoring without the road.
        cross: () => {
          frog.row = LANES;
          hop(0, 1);
        },
        setPoints: (n: number) => {
          points = n;
          refreshHud();
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__frog;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over || !sprite) return;
    const dt = delta / 1000;

    if (introMs > 0) {
      introMs -= delta;
      // the last 600ms fade it out
      const a = Math.min(1, Math.max(0, introMs / 600));
      intro?.setAlpha(a);
      introPlate?.setAlpha(a * 0.7);
      if (introMs <= 0) {
        intro?.destroy();
        introPlate?.destroy();
        intro = null;
        introPlate = null;
      }
    }

    stepTraffic(dt, delta);

    if (invulnMs > 0) {
      invulnMs -= delta;
      const on = Math.floor(invulnMs / 90) % 2 === 0;
      sprite.setAlpha(on ? 0.35 : 1);
      eyes?.setAlpha(on ? 0.35 : 1);
      if (invulnMs <= 0) {
        sprite.setAlpha(1);
        eyes?.setAlpha(1);
      }
    } else if (!dead) {
      checkHit();
    }
  },

  destroy() {
    cars = [];
    sprite = null;
    eyes = null;
    intro = null;
    introPlate = null;
    hud = null;
    apiRef = null;
    sceneRef = null;
  },
};

/**
 * How much worse the road is right now.  Speed climbs steadily and the gaps
 * close, and both keep going: there is no level at which it stops getting
 * harder, which is what makes a high score mean something.
 */
function speedMul(): number {
  return 1 + crossings * 0.11;
}
function gapMul(): number {
  return Math.max(0.42, 1 - crossings * 0.055);
}
function truckChance(): number {
  return Math.min(0.5, 0.08 + crossings * 0.03);
}

function stepTraffic(dt: number, delta: number): void {
  if (!sceneRef) return;

  lanes.forEach((lane, i) => {
    lane.timer -= delta;
    if (lane.timer > 0) return;
    const k = i + 1;
    const truck = Math.random() < truckChance();
    const w = truck ? 30 : 18;
    const speed = lane.base * speedMul();
    const x = lane.dir > 0 ? -w : GAME_W + w;
    // Never drop one on top of the last: the gap has to be a gap.
    const last = cars.filter((c) => c.lane === k).sort((a, b) => (lane.dir > 0 ? a.x - b.x : b.x - a.x))[0];
    if (last && Math.abs(last.x - x) < w + 22) {
      lane.timer = 200;
      return;
    }
    const body = sceneRef!.add
      .rectangle(x, laneY(k), w, CAR_H, truck ? PALETTE.steel : [PALETTE.ember, PALETTE.neon, PALETTE.tealLight, PALETTE.amber][k % 4])
      .setDepth(10);
    cars.push({ x, lane: k, w, dir: lane.dir, speed, body });
    lane.timer = (1500 + Math.random() * 1600) * gapMul();
  });

  for (const c of cars) {
    c.x += c.dir * c.speed * dt;
    c.body.x = c.x;
  }
  cars = cars.filter((c) => {
    const gone = c.dir > 0 ? c.x > GAME_W + c.w : c.x < -c.w;
    if (gone) c.body.destroy();
    return !gone;
  });
}

function hop(dc: number, dr: number): void {
  if (over || dead || hopping || introMs > 0 || !sprite || !sceneRef) return;
  const col = Phaser.Math.Clamp(frog.col + dc, 0, 18);
  const row = Phaser.Math.Clamp(frog.row + dr, 0, LANES + 1);
  if (col === frog.col && row === frog.row) return;
  frog.col = col;
  frog.row = row;
  hopping = true;
  audio.sfx('hop_wet', 0.5);
  sceneRef.tweens.add({
    targets: [sprite, eyes],
    x: colX(col),
    duration: HOP_MS,
    onUpdate: () => place(),
    onComplete: () => {
      hopping = false;
      place();
      if (frog.row > LANES) crossed();
    },
  });
}

function place(): void {
  if (!sprite || !eyes) return;
  sprite.setPosition(sprite.x, rowY(frog.row));
  eyes.setPosition(sprite.x, rowY(frog.row) - 4);
}

function crossed(): void {
  points += POINTS_PER_CROSS;
  crossings++;
  audio.sfx('chime');
  if (points > best) {
    best = points;
    store.setHighScore(ID, best);
  }
  refreshHud();
  // Back to the kerb, from the far side, with the road a notch worse.
  hopping = true;
  sceneRef?.time.delayedCall(350, () => {
    frog = { col: 9, row: 0 };
    sprite?.setX(colX(frog.col));
    eyes?.setX(colX(frog.col));
    place();
    hopping = false;
  });
}

function checkHit(): void {
  if (!sprite || frog.row < 1 || frog.row > LANES) return;
  const fx = sprite.x;
  for (const c of cars) {
    if (c.lane !== frog.row) continue;
    if (Math.abs(c.x - fx) < c.w / 2 + 4) {
      squash();
      return;
    }
  }
}

function squash(): void {
  if (dead || over) return;
  dead = true;
  lives--;
  audio.sfx('buzzer');
  sceneRef?.cameras.main.shake(180, 0.01);
  sprite?.setScale(1.4, 0.4);
  eyes?.setVisible(false);
  refreshHud();

  if (lives <= 0) {
    finish();
    return;
  }
  sceneRef?.time.delayedCall(700, () => {
    frog = { col: 9, row: 0 };
    sprite?.setScale(1, 1).setX(colX(frog.col));
    eyes?.setVisible(true).setX(colX(frog.col));
    place();
    invulnMs = 1200;
    dead = false;
  });
}

function refreshHud(): void {
  if (!hud) return;
  hud.pts.setText(`PTS ${points}`);
  hud.lives.setText(`LIVES ${lives}`);
  hud.best.setText(`BEST ${best}`);
  const banked = frogPayout(points);
  hud.bank.setText(`[ENTER] BANK ${banked} TOKENS`).setVisible(banked > 0);
}

function finish(): void {
  if (over) return;
  over = true;
  store.setHighScore(ID, points);
  const payout = frogPayout(points);
  sceneRef?.time.delayedCall(500, () => (payout > 0 ? apiRef?.win(payout) : apiRef?.lose()));
}
