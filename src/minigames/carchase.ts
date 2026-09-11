/**
 * FROGGY CAR CHASE.  Hard — 5 tokens in, seven and up out.
 *
 * A four-lane road seen from above, scrolling under you.  Traffic ahead is
 * slower than you and has to be threaded; the police behind are faster than
 * you and have to be shaken.  Cash sits on the road in bundles of twenty.
 *
 * NITRO is the one tool.  It is a burst — a second and a half at nearly twice
 * the speed — and it is FUEL: blue jars on the road, one burst each, up to
 * two in the tank.  You start with one.  Spend it getting out of a corner,
 * not going fast; the police close the gap again the moment it ends, and a
 * warning flashes when one is on your bumper.
 *
 * Two hundred cash is the bar: seven tokens, and one more for every further
 * two hundred.  The run ends on a crash, on being caught, or on ENTER — pull
 * over and take what you have.  It only gets harder from there.
 *
 * The cash here is a score.  It is not the cash the man outside pays, it is
 * never added to it, and the only thing that leaves this cabinet is the token
 * payout through the shell (MG-3).  Best run is kept per profile.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'carchase' as const;

export const TARGET_CASH = 200;
export const BASE_REWARD = 7;
export const CASH_PER_PICKUP = 20;

const ROAD_L = 96;
const ROAD_W = 128;
const LANE_W = ROAD_W / 4;
const LANES = [0, 1, 2, 3].map((i) => ROAD_L + LANE_W * i + LANE_W / 2);
const TOP = 18;
const BOTTOM = 180;
const CAR_W = 12;
const CAR_H = 20;

/** Road speed in px/s: where it starts, how fast it climbs, where it stops. */
const SPEED_START = 110;
const SPEED_RAMP = 1.6;
const SPEED_MAX = 250;
const STEER = 120;
const CREEP = 50;
/** Nitro: how much faster, for how long, and how long until it is back. */
const NITRO_MUL = 1.8;
const NITRO_MS = 1500;
/** Bursts the tank holds. */
const NITRO_TANK = 2;
/** A police car this close behind you is a warning. */
const WARN_DIST = 70;
/** How much faster the police are than you, and how hard they steer at you. */
const POLICE_GAIN = 26;
const POLICE_STEER = 55;

interface Mover {
  x: number;
  y: number;
  /** Ground speed of its own, px/s, along the road. */
  own: number;
  body: Phaser.GameObjects.Container;
}

let scene0: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let player: Phaser.GameObjects.Container | null = null;
let px = LANES[1];
let py = 140;
let speed = SPEED_START;
let elapsed = 0;
let traffic: Mover[] = [];
let police: Mover[] = [];
let cash: Array<{ x: number; y: number; body: Phaser.GameObjects.Rectangle }> = [];
let jars: Array<{ x: number; y: number; body: Phaser.GameObjects.Container }> = [];
let jarTimer = 0;
let warnT = 0;
let dashes: Phaser.GameObjects.Rectangle[] = [];
let trafficTimer = 0;
let policeTimer = 0;
let cashTimer = 0;
let collected = 0;
let best = 0;
let nitroMs = 0;
let nitroCharge = 1;
let over = false;
let keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
let hud: {
  cash: Phaser.GameObjects.BitmapText;
  best: Phaser.GameObjects.BitmapText;
  time: Phaser.GameObjects.BitmapText;
  bank: Phaser.GameObjects.BitmapText;
  nitro: Phaser.GameObjects.Rectangle;
  nitroLabel: Phaser.GameObjects.BitmapText;
  warn: Phaser.GameObjects.BitmapText;
} | null = null;

export function chasePayout(c: number): number {
  if (c < TARGET_CASH) return 0;
  return BASE_REWARD + Math.floor((c - TARGET_CASH) / TARGET_CASH);
}

export const carChase: MinigameModule = {
  id: ID,
  title: 'FROGGY CAR CHASE',
  music: 'game_carchase',
  rules: 'dodge, grab cash, lose the law',
  payoutNote: 'WIN: 7+',

  create(scene: Phaser.Scene, api: MinigameApi) {
    scene0 = scene;
    apiRef = api;
    px = LANES[1];
    py = 140;
    speed = SPEED_START;
    elapsed = 0;
    traffic = [];
    police = [];
    cash = [];
    dashes = [];
    trafficTimer = 2600;
    policeTimer = 6000;
    cashTimer = 900;
    jars = [];
    jarTimer = 5000;
    warnT = 0;
    collected = 0;
    best = store.highScore(ID);
    nitroMs = 0;
    nitroCharge = 1;
    over = false;

    // verge, road, lane lines.  Things spawn above the top edge and scroll
    // in, and the shell's title bar has to stay on top of them — so nothing is
    // drawn until it is below the bar (see `onScreen`).  Negative depths were
    // tried for this and put the whole road under the shell's black backdrop.
    scene.add.rectangle(0, TOP, GAME_W, BOTTOM - TOP, 0x17301c).setOrigin(0, 0).setDepth(1);
    scene.add.rectangle(ROAD_L, TOP, ROAD_W, BOTTOM - TOP, 0x2a2d33).setOrigin(0, 0).setDepth(1);
    scene.add.rectangle(ROAD_L - 3, TOP, 3, BOTTOM - TOP, PALETTE.bone).setOrigin(0, 0).setDepth(1);
    scene.add.rectangle(ROAD_L + ROAD_W, TOP, 3, BOTTOM - TOP, PALETTE.bone).setOrigin(0, 0).setDepth(1);
    for (let i = 1; i < 4; i++) {
      for (let y = TOP; y < BOTTOM + 16; y += 16) {
        dashes.push(scene.add.rectangle(ROAD_L + LANE_W * i, y, 1, 8, 0x6a6e76).setOrigin(0.5, 0).setDepth(2));
      }
    }

    player = carSprite(scene, px, py, PALETTE.mossLight, false).setDepth(6).setVisible(true);

    hud = {
      cash: text(scene, 6, 21, '', PALETTE.cream),
      best: text(scene, GAME_W - 6, 21, '', PALETTE.gold).setOrigin(1, 0),
      time: centerText(scene, GAME_W / 2, 25, '', PALETTE.fog),
      bank: centerText(scene, GAME_W / 2, 170, '', PALETTE.gold).setVisible(false),
      nitro: scene.add.rectangle(7, 150, 6, 0, PALETTE.tealLight).setOrigin(0, 1),
      nitroLabel: text(scene, 4, 154, 'NITRO', PALETTE.ash),
      warn: centerText(scene, GAME_W / 2, 150, 'POLICE CLOSE', PALETTE.blood, 16).setVisible(false),
    };
    scene.add.rectangle(6, 96, 8, 54, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel).setDepth(8);
    hud.nitro.setDepth(9);
    hud.nitroLabel.setDepth(9);
    hud.warn.setDepth(9);
    hud.cash.setDepth(9);
    hud.best.setDepth(9);
    hud.time.setDepth(9);
    hud.bank.setDepth(9);
    text(scene, 4, 162, 'SPACE', PALETTE.ash).setDepth(9);
    refreshHud();

    const kb = scene.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    keys = {
      left: bind(['A', 'LEFT']),
      right: bind(['D', 'RIGHT']),
      up: bind(['W', 'UP']),
      down: bind(['S', 'DOWN']),
    };
    kb?.on('keydown-SPACE', () => {
      if (over || nitroMs > 0 || nitroCharge < 1) return;
      nitroMs = NITRO_MS;
      nitroCharge -= 1;
      audio.sfx('vault', 0.6);
    });
    kb?.on('keydown-ENTER', () => {
      if (!over && collected >= TARGET_CASH) finish();
    });

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__chase = {
        state: () => ({
          cash: collected,
          best,
          speed,
          nitro: nitroMs > 0,
          nitroCharge,
          jars: jars.length,
          traffic: traffic.length,
          police: police.length,
          player: { x: px, y: py },
        }),
        setCash: (n: number) => {
          collected = n;
          refreshHud();
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__chase;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over || !player || !scene0) return;
    const dt = delta / 1000;
    elapsed += delta;

    // ---- nitro.  No recharge: what is in the tank came off the road.
    if (nitroMs > 0) nitroMs -= delta;
    const boost = nitroMs > 0 ? NITRO_MUL : 1;

    // ---- the road, and you on it
    speed = Math.min(SPEED_MAX, SPEED_START + (elapsed / 1000) * SPEED_RAMP);
    const ground = speed * boost;
    const dx = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    const dy = (held('down') ? 1 : 0) - (held('up') ? 1 : 0);
    px = Phaser.Math.Clamp(px + dx * STEER * dt, ROAD_L + CAR_W / 2, ROAD_L + ROAD_W - CAR_W / 2);
    py = Phaser.Math.Clamp(py + dy * CREEP * dt, 70, 160);
    player.setPosition(px, py);
    for (const d of dashes) {
      d.y += ground * dt;
      if (d.y > BOTTOM) d.y -= BOTTOM - TOP + 16;
      d.setVisible(d.y >= TOP);
    }

    // ---- traffic: slower than you, so it comes down the screen at you
    trafficTimer -= delta;
    if (trafficTimer <= 0) {
      spawnTraffic();
      trafficTimer = Math.max(420, 1100 - elapsed / 90);
    }
    for (const c of traffic) {
      c.y += (ground - c.own) * dt;
      c.body.setPosition(c.x, c.y).setVisible(onScreen(c.y));
    }
    traffic = traffic.filter((c) => keep(c, c.y < BOTTOM + CAR_H && c.y > TOP - CAR_H * 3));

    // ---- police: faster than you, so they come UP the screen, and steer at you
    policeTimer -= delta;
    if (policeTimer <= 0 && police.length < policeCap()) {
      spawnPolice();
      policeTimer = 3000;
    }
    for (const p of police) {
      p.own = speed + POLICE_GAIN + elapsed / 2500;
      p.y += (ground - p.own) * dt;
      p.x += Phaser.Math.Clamp(px - p.x, -1, 1) * POLICE_STEER * dt;
      p.body.setPosition(p.x, p.y).setVisible(onScreen(p.y));
      // lights
      const on = Math.floor(elapsed / 120) % 2 === 0;
      (p.body.getAt(2) as Phaser.GameObjects.Rectangle).setFillStyle(on ? PALETTE.blood : PALETTE.moon);
    }
    // Under nitro they fall off the bottom; shaken, they come back later.
    police = police.filter((p) => keep(p, p.y < BOTTOM + CAR_H * 2 && p.y > TOP - CAR_H * 2));

    // ---- cash on the road
    cashTimer -= delta;
    if (cashTimer <= 0) {
      spawnCash();
      cashTimer = 900 + Math.random() * 900;
    }
    for (const c of cash) {
      c.y += ground * dt;
      c.body.setPosition(c.x, c.y).setVisible(c.y > TOP + 4);
    }
    // ---- nitro jars, rarer than the cash and worth stopping for
    jarTimer -= delta;
    if (jarTimer <= 0) {
      spawnJar();
      jarTimer = 6000 + Math.random() * 5000;
    }
    for (const j of jars) {
      j.y += ground * dt;
      j.body.setPosition(j.x, j.y).setVisible(j.y > TOP + 6);
    }
    jars = jars.filter((j) => {
      if (Math.abs(j.x - px) < CAR_W / 2 + 4 && Math.abs(j.y - py) < CAR_H / 2 + 5) {
        nitroCharge = Math.min(NITRO_TANK, nitroCharge + 1);
        audio.sfx('chime', 0.5);
        refreshHud();
        j.body.destroy();
        return false;
      }
      if (j.y > BOTTOM + 10) {
        j.body.destroy();
        return false;
      }
      return true;
    });

    cash = cash.filter((c) => {
      if (Math.abs(c.x - px) < CAR_W / 2 + 4 && Math.abs(c.y - py) < CAR_H / 2 + 4) {
        collected += CASH_PER_PICKUP;
        audio.sfx('coin_spin', 0.7);
        if (collected > best) {
          best = collected;
          store.setHighScore(ID, best);
        }
        refreshHud();
        c.body.destroy();
        return false;
      }
      if (c.y > BOTTOM + 8) {
        c.body.destroy();
        return false;
      }
      return true;
    });

    // ---- what ends it
    for (const c of traffic) {
      if (hits(c)) {
        crash('CRASHED');
        return;
      }
    }
    for (const p of police) {
      if (hits(p)) {
        crash('BUSTED');
        return;
      }
    }

    hud?.nitro.setSize(6, (nitroMs > 0 ? nitroMs / NITRO_MS : nitroCharge / NITRO_TANK) * 52);
    hud?.nitro.setFillStyle(nitroMs > 0 ? PALETTE.gold : nitroCharge >= 1 ? 0x46a0e0 : PALETTE.steel);
    hud?.time.setText(`${Math.floor(elapsed / 1000)}s`);

    // ---- the warning: a police car right behind you, flashing and beeping
    const close = police.some((p) => p.y > py && p.y - py < WARN_DIST && Math.abs(p.x - px) < LANE_W * 1.5);
    if (close) {
      warnT += delta;
      hud?.warn.setVisible(Math.floor(warnT / 160) % 2 === 0);
      if (warnT % 700 < delta) audio.sfx('buzzer', 0.25);
    } else {
      warnT = 0;
      hud?.warn.setVisible(false);
    }
  },

  destroy() {
    traffic = [];
    police = [];
    cash = [];
    jars = [];
    dashes = [];
    player = null;
    hud = null;
    apiRef = null;
    scene0 = null;
  },
};

const held = (g: string): boolean => keys[g]?.some((k) => k.isDown) ?? false;

/** Fully below the title bar.  Things above it are there, just not drawn yet. */
const onScreen = (y: number): boolean => y - CAR_H / 2 >= TOP;

/** One at first, two after half a minute, three after a minute. */
function policeCap(): number {
  return 1 + Math.min(2, Math.floor(elapsed / 30000));
}

function keep(m: Mover, ok: boolean): boolean {
  if (!ok) m.body.destroy();
  return ok;
}

function hits(m: Mover): boolean {
  return Math.abs(m.x - px) < CAR_W - 2 && Math.abs(m.y - py) < CAR_H - 3;
}

function carSprite(scene: Phaser.Scene, x: number, y: number, colour: number, cop: boolean): Phaser.GameObjects.Container {
  const body = scene.add.rectangle(0, 0, CAR_W, CAR_H, colour);
  const glass = scene.add.rectangle(0, -4, CAR_W - 4, 5, PALETTE.ink);
  const roof = scene.add.rectangle(0, 2, cop ? 6 : CAR_W - 4, cop ? 3 : 4, cop ? PALETTE.blood : PALETTE.black).setAlpha(cop ? 1 : 0.35);
  return scene.add.container(x, y, [body, glass, roof]).setDepth(4).setVisible(false);
}

function spawnTraffic(): void {
  if (!scene0) return;
  let lane = LANES[Phaser.Math.Between(0, 3)];
  // The first ten seconds never drop one straight down your lane: you get to
  // see how the road works before it is aimed at you.
  if (elapsed < 10000 && Math.abs(lane - px) < LANE_W / 2) lane = LANES[(LANES.indexOf(lane) + 1) % 4];
  // Not into the back of one already there.
  if (traffic.some((c) => Math.abs(c.x - lane) < 2 && c.y < TOP + CAR_H * 2)) return;
  const own = 35 + Math.random() * 40;
  const colours = [PALETTE.ember, PALETTE.neon, PALETTE.amber, PALETTE.violet, PALETTE.bone];
  traffic.push({ x: lane, y: TOP - CAR_H, own, body: carSprite(scene0, lane, TOP - CAR_H, colours[Phaser.Math.Between(0, colours.length - 1)], false) });
}

function spawnPolice(): void {
  if (!scene0) return;
  const lane = LANES[Phaser.Math.Between(0, 3)];
  const body = carSprite(scene0, lane, BOTTOM + CAR_H, PALETTE.moon, true);
  police.push({ x: lane, y: BOTTOM + CAR_H, own: speed + POLICE_GAIN, body });
  audio.sfx('buzzer', 0.35);
}

/** A blue jar of nitro, worth one burst. */
function spawnJar(): void {
  if (!scene0) return;
  const lane = LANES[Phaser.Math.Between(0, 3)];
  const jar = scene0.add.rectangle(0, 1, 8, 9, 0x46a0e0).setStrokeStyle(1, PALETTE.bone);
  const cap = scene0.add.rectangle(0, -4, 5, 3, PALETTE.bone);
  const shine = scene0.add.rectangle(-2, 0, 1, 5, 0xbfe6ff);
  const body = scene0.add.container(lane, TOP - 6, [jar, cap, shine]).setDepth(3).setVisible(false);
  jars.push({ x: lane, y: TOP - 6, body });
}

function spawnCash(): void {
  if (!scene0) return;
  const lane = LANES[Phaser.Math.Between(0, 3)];
  const body = scene0.add.rectangle(lane, TOP - 6, 9, 7, PALETTE.mossLight).setStrokeStyle(1, PALETTE.cream).setDepth(3).setVisible(false);
  cash.push({ x: lane, y: TOP - 6, body });
}

function crash(why: string): void {
  if (over || !scene0) return;
  audio.sfx('whack');
  scene0.cameras.main.shake(300, 0.02);
  centerText(scene0, GAME_W / 2, 80, why, PALETTE.blood, 16).setDepth(50);
  finish();
}

function refreshHud(): void {
  if (!hud) return;
  hud.cash.setText(`CASH ${collected}`);
  hud.best.setText(`BEST ${best}`);
  const banked = chasePayout(collected);
  hud.bank.setText(`[ENTER] PULL OVER FOR ${banked} TOKENS`).setVisible(banked > 0);
  hud.nitroLabel.setText(`NITRO x${Math.floor(nitroCharge)}`);
}

function finish(): void {
  if (over) return;
  over = true;
  store.setHighScore(ID, collected);
  const payout = chasePayout(collected);
  scene0?.time.delayedCall(700, () => (payout > 0 ? apiRef?.win(payout) : apiRef?.lose()));
}
