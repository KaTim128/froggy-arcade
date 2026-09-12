/**
 * FROG VS LIZARD.  Hard — 5 tokens in, 5 out.
 *
 * Two neighbours, one fence, and a shed's worth of things to throw over it.
 * You are the frog on the left; the lizard is on the right and he is playing
 * the same game you are.  Turn about: aim, judge the wind, hold SPACE for
 * power and let go.  Clear the fence and land it on him and it counts.  Hit
 * the fence and it does not.
 *
 * You are playing a person, not a machine: the lizard has the same four items
 * you do, the same limited stock of the special ones, and the same wind to
 * solve.  He solves it by searching his own throws — the arc he picks is the
 * arc that would land on you — and then throwing it with a slightly unsteady
 * arm, which is where his misses come from.
 *
 * THE ITEMS (both sides, identically):
 *   ROCK      the ordinary item.  Ordinary damage, and you never run out.
 *   HEAL      lands soft: a little damage to him, a lot of health back to the
 *             thrower.  Thrown AT the opponent, like everything else.
 *   DYNAMITE  double damage.
 *   POISON    a small hit, then chip damage at the top of his next three
 *             turns.  Applied once per turn, three turns, then it is gone.
 *
 * THE WIND: rolled fresh for every single turn and shown as a bar with a side
 * to it.  It pushes whatever is in the air, and it pushes harder the stronger
 * it is, so the same throw that landed last turn does not land this turn.
 *
 * TWO ROUNDS.  A round ends when somebody's health is gone.  Take both and the
 * cabinet pays; split them and it goes to whoever did the most damage over the
 * match; a dead heat pays nothing.  Health, poison and the special stock all
 * reset between rounds — what carries is the round score.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';
import { backdrop } from './decor';

const ID = 'frogvslizard' as const;
export const ROUNDS = 2;
const MAX_HP = 80;

const GROUND_Y = 146;
const FROG_X = 44;
const LIZARD_X = 276;
/** Where a thrown thing leaves the hand, relative to a thrower's feet. */
const HAND = { dx: 9, dy: -24 };
const FENCE = { x: 154, w: 12, top: 72 };

const GRAVITY = 340;
const THROW_MIN = 150;
const THROW_MAX = 340;
const CHARGE_MS = 1100;
/** Aim limits: nearly straight up, down to a flat throw. */
const AIM_MIN = -Math.PI * 0.47;
const AIM_MAX = -Math.PI * 0.06;
const AIM_RATE = 1.1;
/** Sideways acceleration at full strength, px/s^2.  A gale moves an item a
 *  good third of the yard over a long throw, which is enough to have to aim
 *  off into it rather than merely notice it. */
const WIND_MAX = 88;

type Who = 'frog' | 'lizard';
type ItemId = 'rock' | 'heal' | 'tnt' | 'poison';

interface ItemDef {
  id: ItemId;
  /** What the item bar calls it. */
  name: string;
  /** The same, short enough for a slot on a 320-pixel screen. */
  short: string;
  /** Damage on contact. */
  dmg: number;
  /** Health the THROWER gets back on contact. */
  heal: number;
  /** Turns of chip damage applied to whoever it lands on. */
  poison: number;
  color: number;
  /** How many a side gets each round.  The rock is the one you never run out of. */
  stock: number;
}

/**
 * The four, and the same four for both sides.  The rock is the baseline every
 * other number is set against: heal trades most of its damage for health,
 * dynamite is exactly double, and poison is a light hit that keeps going.
 */
const ITEMS: Record<ItemId, ItemDef> = {
  rock: { id: 'rock', name: 'ROCK', short: 'ROCK', dmg: 14, heal: 0, poison: 0, color: 0x9aa4b0, stock: Infinity },
  heal: { id: 'heal', name: 'HEAL', short: 'HEAL', dmg: 4, heal: 16, poison: 0, color: 0x6fe08a, stock: 1 },
  tnt: { id: 'tnt', name: 'DYNAMITE', short: 'TNT', dmg: 28, heal: 0, poison: 0, color: 0xd94f2e, stock: 1 },
  poison: { id: 'poison', name: 'POISON', short: 'PSN', dmg: 8, heal: 0, poison: 3, color: 0x9b6fe0, stock: 1 },
};
const ORDER: ItemId[] = ['rock', 'heal', 'tnt', 'poison'];
/** What poison takes off at the top of each of its three turns. */
const POISON_TICK = 5;

interface Side {
  hp: number;
  /** Turns of poison left to apply.  Counts down one per turn, then stops. */
  poison: number;
  stock: Record<ItemId, number>;
  /** Damage dealt over the whole match — the tiebreak on a one-all split. */
  dealt: number;
  sprite: Phaser.GameObjects.Container | null;
}

type Phase = 'aim' | 'flight' | 'settle' | 'roundEnd' | 'over';

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  item: ItemDef;
  from: Who;
  body: Phaser.GameObjects.Arc | null;
  spin: number;
}

let scene0: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let sides: Record<Who, Side> = { frog: blankSide(), lizard: blankSide() };
let roundsWon: Record<Who, number> = { frog: 0, lizard: 0 };
let round = 1;
let turn: Who = 'frog';
let phase: Phase = 'aim';
let wind = 0;
let aim = -Math.PI / 4;
let power = 0;
let charging = false;
let chargeDir = 1;
let sel: ItemId = 'rock';
let proj: Projectile | null = null;
let settleMs = 0;
let best = 0;

let aimG: Phaser.GameObjects.Graphics | null = null;
let windFill: Phaser.GameObjects.Rectangle | null = null;
let powerFill: Phaser.GameObjects.Rectangle | null = null;
let hpFill: Record<Who, Phaser.GameObjects.Rectangle | null> = { frog: null, lizard: null };
let hpText: Record<Who, Phaser.GameObjects.BitmapText | null> = { frog: null, lizard: null };
let poisonText: Record<Who, Phaser.GameObjects.BitmapText | null> = { frog: null, lizard: null };
let roundText: Phaser.GameObjects.BitmapText | null = null;
let windText: Phaser.GameObjects.BitmapText | null = null;
let bannerText: Phaser.GameObjects.BitmapText | null = null;
let slots: Array<{ box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.BitmapText }> = [];
let keys: Record<'up' | 'down', Phaser.Input.Keyboard.Key[]> = { up: [], down: [] };

function blankSide(): Side {
  return { hp: MAX_HP, poison: 0, stock: { rock: Infinity, heal: 1, tnt: 1, poison: 1 }, dealt: 0, sprite: null };
}

export const frogVsLizard: MinigameModule = {
  id: ID,
  title: 'FROG VS LIZARD',
  music: 'game_frogvslizard',
  rules: 'two rounds over the fence - mind the wind',
  tutorial: {
    objective: [
      'THROW OVER THE FENCE AND HIT HIM.',
      'THE WIND BENDS EVERY THROW - AIM OFF IT.',
      'TWO ROUNDS. EMPTY HIS HEALTH BAR.',
    ],
    controls: [
      ['W / S', 'AIM HIGHER OR LOWER'],
      ['1 2 3 4', 'PICK ROCK HEAL TNT PSN'],
      ['LEFT/RIGHT', 'CYCLE ITEMS'],
      ['HOLD SPACE', 'POWER, LET GO TO THROW'],
    ],
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    scene0 = scene;
    apiRef = api;
    sides = { frog: blankSide(), lizard: blankSide() };
    roundsWon = { frog: 0, lizard: 0 };
    round = 1;
    turn = 'frog';
    phase = 'aim';
    aim = -Math.PI / 4;
    power = 0;
    charging = false;
    chargeDir = 1;
    sel = 'rock';
    proj = null;
    settleMs = 0;
    slots = [];
    best = store.highScore(ID);

    paintYard(scene);
    sides.frog.sprite = makeFrog(scene, FROG_X, GROUND_Y);
    sides.lizard.sprite = makeLizard(scene, LIZARD_X, GROUND_Y);

    buildHud(scene);
    aimG = scene.add.graphics().setDepth(30);

    const kb = scene.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    keys = { up: bind(['W']), down: bind(['S']) };
    const pick = (id: ItemId) => () => selectItem(id);
    kb?.on('keydown-ONE', pick('rock'));
    kb?.on('keydown-TWO', pick('heal'));
    kb?.on('keydown-THREE', pick('tnt'));
    kb?.on('keydown-FOUR', pick('poison'));
    kb?.on('keydown-RIGHT', () => cycle(1));
    kb?.on('keydown-LEFT', () => cycle(-1));
    kb?.on('keydown-SPACE', () => {
      if (phase !== 'aim' || turn !== 'frog' || charging) return;
      charging = true;
      power = 0;
      chargeDir = 1;
    });
    kb?.on('keyup-SPACE', () => {
      if (!charging) return;
      charging = false;
      if (phase !== 'aim' || turn !== 'frog') return;
      throwItem('frog', aim, power, sel);
    });

    rollWind();
    beginTurn('frog', true);

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__fvl = {
        state: () => ({
          round,
          turn,
          phase,
          wind,
          roundsWon: { ...roundsWon },
          frog: { hp: sides.frog.hp, poison: sides.frog.poison, stock: { ...sides.frog.stock }, dealt: sides.frog.dealt },
          lizard: { hp: sides.lizard.hp, poison: sides.lizard.poison, stock: { ...sides.lizard.stock }, dealt: sides.lizard.dealt },
        }),
        /**
         * Throw for whoever's turn it is, bypassing the meter.  `elev` is the
         * elevation above horizontal in radians; which way that points is the
         * thrower's business, not the caller's.
         */
        throw: (elev: number, pow: number, item: ItemId = 'rock') =>
          throwItem(turn, turn === 'frog' ? -elev : Math.PI + elev, pow, item),
        /** Drop a side's health, for driving a round to its end quickly. */
        setHp: (who: Who, hp: number) => {
          sides[who].hp = Math.max(0, Math.min(MAX_HP, hp));
          refreshHud();
        },
        setWind: (w: number) => {
          wind = Math.max(-1, Math.min(1, w));
          refreshHud();
        },
        /** What the side in play would throw, before any arm wobble. */
        solve: () => solveThrow(turn),
        /**
         * Throw the solved arc for whoever is up: a guaranteed hit, so the
         * harness can prove what an item DOES without also proving it can aim.
         */
        autoThrow: (item: ItemId = 'rock') => {
          const plan = solveThrow(turn);
          throwItem(turn, plan.angle, plan.power, item);
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__fvl;
      });
    }
  },

  update(_t: number, delta: number) {
    if (phase === 'over') return;
    const dt = Math.min(delta, 40) / 1000;

    if (phase === 'aim' && turn === 'frog') {
      const tilt = (keys.down.some((k) => k.isDown) ? 1 : 0) - (keys.up.some((k) => k.isDown) ? 1 : 0);
      if (tilt) aim = Phaser.Math.Clamp(aim + tilt * AIM_RATE * dt, AIM_MIN, AIM_MAX);
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
      powerFill?.setSize(6, (charging ? power : 0) * 48);
    }
    drawAim();

    if (phase === 'flight' && proj) {
      stepProjectile(dt);
      return;
    }

    if (phase === 'settle') {
      settleMs -= delta;
      if (settleMs <= 0) nextTurn();
    }
  },

  destroy() {
    proj?.body?.destroy();
    proj = null;
    aimG = null;
    windFill = null;
    powerFill = null;
    hpFill = { frog: null, lizard: null };
    hpText = { frog: null, lizard: null };
    poisonText = { frog: null, lizard: null };
    roundText = null;
    windText = null;
    bannerText = null;
    slots = [];
    sides.frog.sprite = null;
    sides.lizard.sprite = null;
    apiRef = null;
    scene0 = null;
  },
};


// ------------------------------------------------------------------ the yard

/** Two gardens, a hedge line behind them, and the fence between. */
function paintYard(scene: Phaser.Scene): void {
  backdrop(scene, 0x2e5a86, 0x1b3a5c, { band: 0.18, speckle: 40, speckleColor: 0xffffff });
  scene.add.circle(40, 46, 11, 0xffe9a0).setAlpha(0.45);
  for (const [cx, cy, r] of [
    [96, 40, 7],
    [104, 38, 9],
    [113, 41, 6],
    [216, 52, 6],
    [224, 50, 8],
    [232, 53, 5],
  ]) {
    scene.add.circle(cx, cy, r, 0xdfe9f4).setAlpha(0.5);
  }
  // a hedge along the back of both gardens
  for (let x = 0; x < GAME_W; x += 11) {
    scene.add.circle(x, GROUND_Y - 32, 8, 0x2c5c38).setAlpha(0.9);
  }
  scene.add.rectangle(0, GROUND_Y - 32, GAME_W, 32, 0x2c5c38).setOrigin(0, 0);

  // grass, and a mown line between the two halves of it
  scene.add.rectangle(0, GROUND_Y, GAME_W, GAME_H - GROUND_Y, 0x4a8a52).setOrigin(0, 0);
  scene.add.rectangle(0, GROUND_Y, GAME_W, 2, 0x6fbb6a).setOrigin(0, 0);
  for (let i = 0; i < 70; i++) {
    const gx = (i * 97 + ((i * i) % 17) * 5) % GAME_W;
    const gy = GROUND_Y + 3 + ((i * 53) % 22);
    scene.add.rectangle(gx, gy, 1, 2 + (i % 2), 0x63a86a).setOrigin(0.5, 1).setAlpha(0.7);
  }

  // the fence: planks with two rails and a pointed top, the thing in the way
  const h = GROUND_Y - FENCE.top;
  scene.add.rectangle(FENCE.x - 4, FENCE.top - 2, FENCE.w + 8, h + 2, 0x3a2716).setOrigin(0, 0).setAlpha(0.4);
  for (let i = 0; i < 3; i++) {
    const px = FENCE.x - 4 + i * 7;
    scene.add.rectangle(px, FENCE.top, 6, h, i === 1 ? 0x9c7248 : 0x8a6238).setOrigin(0, 0);
    scene.add.triangle(px + 3, FENCE.top, 0, 4, 3, 0, 6, 4, 0xb08553).setOrigin(0.5, 1);
  }
  for (const ry of [FENCE.top + 14, FENCE.top + h - 20]) {
    scene.add.rectangle(FENCE.x - 6, ry, FENCE.w + 12, 3, 0x6b4a2f).setOrigin(0, 0);
  }
}

/** The player: a round frog in a garden, facing the fence. */
function makeFrog(scene: Phaser.Scene, x: number, groundY: number): Phaser.GameObjects.Container {
  const parts = [
    scene.add.ellipse(-7, -3, 10, 5, PALETTE.moss),
    scene.add.ellipse(7, -3, 10, 5, PALETTE.moss),
    scene.add.ellipse(0, -13, 24, 20, PALETTE.mossLight),
    scene.add.ellipse(0, -9, 14, 10, 0xcfe8a0),
    scene.add.ellipse(11, -15, 9, 5, PALETTE.moss),
    scene.add.circle(-6, -23, 4, PALETTE.cream),
    scene.add.circle(6, -23, 4, PALETTE.cream),
    scene.add.circle(-5, -23, 2, PALETTE.black),
    scene.add.circle(7, -23, 2, PALETTE.black),
    scene.add.rectangle(2, -16, 9, 1, PALETTE.moss),
  ];
  return scene.add.container(x, groundY, parts).setDepth(20);
}

/**
 * The opponent: long, low, tan and spiny, so that at 320 pixels wide nobody
 * mistakes him for a second frog.
 */
function makeLizard(scene: Phaser.Scene, x: number, groundY: number): Phaser.GameObjects.Container {
  const hide = 0xc39a3e;
  const dark = 0x8a6a22;
  const parts: Phaser.GameObjects.GameObject[] = [
    // tail, thinning away to the right
    scene.add.triangle(22, -8, 0, 0, 20, 4, 0, 7, dark).setOrigin(0.5, 0.5),
    scene.add.triangle(14, -8, 0, 0, 12, 3, 0, 6, hide).setOrigin(0.5, 0.5),
    // legs, splayed the way a lizard's are
    scene.add.ellipse(-6, -3, 11, 4, dark),
    scene.add.ellipse(8, -3, 11, 4, dark),
    scene.add.ellipse(-11, -2, 5, 3, dark),
    scene.add.ellipse(13, -2, 5, 3, dark),
    // body and belly
    scene.add.ellipse(0, -9, 30, 13, hide),
    scene.add.ellipse(0, -6, 22, 6, 0xe6d296),
  ];
  // a spiny ridge down the back
  for (const [sx, sh] of [[-6, 5], [0, 6], [6, 5], [11, 4]]) {
    parts.push(scene.add.triangle(sx, -15, 0, sh, 2.5, 0, 5, sh, dark).setOrigin(0.5, 1));
  }
  // spots, so he is patterned rather than painted
  for (const [px, py] of [[-4, -11], [3, -9], [9, -11]]) {
    parts.push(scene.add.circle(px, py, 1.6, dark).setAlpha(0.8));
  }
  parts.push(
    // head and snout, pointed away at the fence
    scene.add.ellipse(-13, -12, 17, 11, hide),
    scene.add.triangle(-22, -11, 0, 3, 8, 0, 8, 6, hide).setOrigin(0.5, 0.5),
    scene.add.rectangle(-20, -10, 8, 1, dark),
    // the eye: a slit, not a frog's saucer
    scene.add.circle(-15, -16, 3.2, PALETTE.gold),
    scene.add.rectangle(-15, -16, 1, 4, PALETTE.black),
    // a throat that reads as a lizard's dewlap
    scene.add.ellipse(-16, -7, 7, 4, 0xd9b45a),
  );
  return scene.add.container(x, groundY, parts).setDepth(20);
}

// --------------------------------------------------------------------- hud

function buildHud(scene: Phaser.Scene): void {
  roundText = centerText(scene, GAME_W / 2, 23, '', PALETTE.gold);

  text(scene, 8, 30, 'FROG', PALETTE.tealLight);
  text(scene, GAME_W - 8, 30, 'LIZARD', PALETTE.neon).setOrigin(1, 0);
  scene.add.rectangle(8, 39, 96, 7, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
  hpFill.frog = scene.add.rectangle(9, 40, 94, 5, PALETTE.mossLight).setOrigin(0, 0);
  scene.add.rectangle(GAME_W - 104, 39, 96, 7, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
  hpFill.lizard = scene.add.rectangle(GAME_W - 9, 40, 94, 5, 0xd98a3d).setOrigin(1, 0);
  hpText.frog = text(scene, 8, 48, '', PALETTE.cream);
  hpText.lizard = text(scene, GAME_W - 8, 48, '', PALETTE.cream).setOrigin(1, 0);
  poisonText.frog = text(scene, 8, 57, '', 0x9b6fe0);
  poisonText.lizard = text(scene, GAME_W - 8, 57, '', 0x9b6fe0).setOrigin(1, 0);

  // The wind, in the middle where both sides can see it.  The bar fills out
  // from the centre towards the side it is blowing, so which way is the shape
  // of it and how hard is the length.
  windText = centerText(scene, GAME_W / 2, 32, '', PALETTE.cream);
  scene.add.rectangle(GAME_W / 2 - 36, 39, 72, 6, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
  scene.add.rectangle(GAME_W / 2, 39, 1, 6, PALETTE.steel).setOrigin(0.5, 0);
  windFill = scene.add.rectangle(GAME_W / 2, 40, 0, 4, PALETTE.tealLight).setOrigin(0, 0);

  bannerText = centerText(scene, GAME_W / 2, 62, '', PALETTE.cream);

  // the power meter, at the thrower's end of the yard
  scene.add.rectangle(6, 94, 8, 50, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
  powerFill = scene.add.rectangle(7, 143, 6, 0, PALETTE.gold).setOrigin(0, 1);
  text(scene, 4, 86, 'PWR', PALETTE.ash);

  // the item bar: what you have, what it is called, and how many are left
  ORDER.forEach((id, i) => {
    const x = 6 + i * 78;
    const box = scene.add.rectangle(x, 151, 74, 13, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel).setDepth(50);
    const label = text(scene, x + 4, 154, '', PALETTE.cream).setDepth(51);
    box.setInteractive({ useHandCursor: true }).on('pointerdown', () => selectItem(id));
    slots.push({ box, label });
  });
  centerText(scene, GAME_W / 2, 172, 'W/S AIM   HOLD SPACE THROW   1-4 ITEM', PALETTE.ash).setDepth(51);
}

function refreshHud(): void {
  roundText?.setText(`ROUND ${round}/${ROUNDS}   ${roundsWon.frog}-${roundsWon.lizard}`);
  for (const who of ['frog', 'lizard'] as Who[]) {
    const s = sides[who];
    const frac = Math.max(0, s.hp) / MAX_HP;
    hpFill[who]?.setSize(Math.max(0, 94 * frac), 5);
    hpText[who]?.setText(`${Math.max(0, Math.ceil(s.hp))} HP`);
    poisonText[who]?.setText(s.poison > 0 ? `POISON ${s.poison}` : '');
  }

  // wind: side, and how much of the bar it fills
  const mag = Math.abs(wind);
  const w = Math.round(mag * 34);
  if (windFill) {
    windFill.setSize(w, 4);
    windFill.setOrigin(wind < 0 ? 1 : 0, 0);
    windFill.x = GAME_W / 2;
    windFill.setFillStyle(mag > 0.66 ? PALETTE.ember : mag > 0.33 ? PALETTE.gold : PALETTE.tealLight);
  }
  const arrows = mag < 0.08 ? '-' : (wind < 0 ? '<' : '>').repeat(Math.min(3, 1 + Math.floor(mag * 3)));
  windText?.setText(`WIND ${arrows}`);

  slots.forEach((slot, i) => {
    const item = ITEMS[ORDER[i]];
    const n = sides.frog.stock[item.id];
    const left = n === Infinity ? '-' : `x${n}`;
    slot.label.setText(`${i + 1} ${item.short} ${left}`);
    const usable = n > 0;
    const active = ORDER[i] === sel;
    slot.box.setStrokeStyle(1, active ? PALETTE.gold : PALETTE.steel);
    slot.box.setFillStyle(active ? PALETTE.plum : PALETTE.ink);
    slot.label.setTint(usable ? (active ? PALETTE.gold : PALETTE.cream) : PALETTE.ash);
  });
}

function banner(str: string, colour: number = PALETTE.cream): void {
  bannerText?.setText(str).setTint(colour).setAlpha(1);
}

/** A number that floats off whoever it just happened to. */
function floatText(x: number, y: number, str: string, colour: number): void {
  if (!scene0) return;
  const t = centerText(scene0, x, y, str, colour).setDepth(60);
  scene0.tweens.add({ targets: t, y: y - 16, alpha: 0, duration: 700, onComplete: () => t.destroy() });
}

// ------------------------------------------------------------------- items

function selectItem(id: ItemId): void {
  if (phase !== 'aim' || turn !== 'frog' || charging) return;
  if (sides.frog.stock[id] <= 0) {
    audio.sfx('buzzer', 0.5);
    return;
  }
  sel = id;
  audio.sfx('ui_blip', 0.7);
  refreshHud();
}

function cycle(dir: number): void {
  if (phase !== 'aim' || turn !== 'frog') return;
  const start = ORDER.indexOf(sel);
  for (let step = 1; step <= ORDER.length; step++) {
    const id = ORDER[(start + dir * step + ORDER.length * 4) % ORDER.length];
    if (sides.frog.stock[id] > 0) {
      selectItem(id);
      return;
    }
  }
}

// -------------------------------------------------------------------- turns

/**
 * A new wind for every turn.  Squaring the draw (and keeping its sign) makes
 * gentle days common and a gale occasional, which is more interesting to play
 * against than a flat roll — you cannot settle on one throw and repeat it, but
 * you are not fighting a hurricane every turn either.
 */
function rollWind(): void {
  const r = Math.random() * 2 - 1;
  wind = Math.sign(r) * r * r;
}

function beginTurn(who: Who, first = false): void {
  if (phase === 'over') return;
  turn = who;
  const s = sides[who];

  // Poison: once, at the top of the poisoned side's own turn, three turns and
  // then it has run its course.
  if (s.poison > 0) {
    s.poison--;
    s.hp -= POISON_TICK;
    const other: Who = who === 'frog' ? 'lizard' : 'frog';
    sides[other].dealt += POISON_TICK;
    audio.sfx('poison_hiss', 0.5);
    floatText(who === 'frog' ? FROG_X : LIZARD_X, GROUND_Y - 34, `-${POISON_TICK}`, 0x9b6fe0);
    refreshHud();
    if (s.hp <= 0) {
      endRound();
      return;
    }
  }

  if (!first) rollWind();
  power = 0;
  charging = false;
  powerFill?.setSize(6, 0);
  phase = 'aim';

  // A side that has run its specials out falls back to the rock rather than
  // pointing at an empty slot.
  if (who === 'frog' && sides.frog.stock[sel] <= 0) sel = 'rock';

  refreshHud();
  banner(who === 'frog' ? 'YOUR THROW' : 'THE LIZARD THROWS', who === 'frog' ? PALETTE.tealLight : PALETTE.neon);
  if (who === 'lizard') lizardTurn();
}

function nextTurn(): void {
  if (phase === 'over' || phase === 'roundEnd') return;
  if (sides.frog.hp <= 0 || sides.lizard.hp <= 0) {
    endRound();
    return;
  }
  beginTurn(turn === 'frog' ? 'lizard' : 'frog');
}

// ------------------------------------------------------------------ throwing

function throwItem(who: Who, angle: number, pow: number, id: ItemId): void {
  if (phase !== 'aim' || !scene0) return;
  const side = sides[who];
  const item = ITEMS[side.stock[id] > 0 ? id : 'rock'];
  if (item.stock !== Infinity) side.stock[item.id] -= 1;

  const dir = who === 'frog' ? 1 : -1;
  const x = (who === 'frog' ? FROG_X : LIZARD_X) + HAND.dx * dir;
  const y = GROUND_Y + HAND.dy;
  const speed = THROW_MIN + Phaser.Math.Clamp(pow, 0, 1) * (THROW_MAX - THROW_MIN);
  const body = scene0.add.circle(x, y, item.id === 'tnt' ? 4 : 3, item.color).setStrokeStyle(1, PALETTE.ink).setDepth(40);
  proj = { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, item, from: who, body, spin: 0 };

  phase = 'flight';
  power = 0;
  charging = false;
  powerFill?.setSize(6, 0);
  aimG?.clear();
  refreshHud();
  banner(`${item.name} AWAY`, item.color);
  audio.sfx('throw_whoosh');

  // a little lean into the throw
  const sprite = side.sprite;
  if (sprite) {
    scene0.tweens.add({ targets: sprite, x: sprite.x + 3 * dir, duration: 90, yoyo: true });
  }
}

function stepProjectile(dt: number): void {
  if (!proj) return;
  // Two half-steps: a thrown thing crosses a 12px fence in well under a frame
  // at full power, and a single step can tunnel straight through it.
  for (let i = 0; i < 2; i++) {
    const h = dt / 2;
    proj.vx += wind * WIND_MAX * h;
    proj.vy += GRAVITY * h;
    proj.x += proj.vx * h;
    proj.y += proj.vy * h;
    if (hitSomething()) return;
  }
  proj.spin += dt * 12;
  proj.body?.setPosition(proj.x, proj.y);
}

/** Returns true if this step ended the flight. */
function hitSomething(): boolean {
  if (!proj) return false;
  const target: Who = proj.from === 'frog' ? 'lizard' : 'frog';
  const tx = target === 'frog' ? FROG_X : LIZARD_X;

  // the fence, which is why this is a game and not a shooting range
  if (proj.x > FENCE.x - 6 && proj.x < FENCE.x + FENCE.w + 6 && proj.y > FENCE.top && proj.y < GROUND_Y) {
    audio.sfx('fence_thunk');
    floatText(proj.x, proj.y - 8, 'FENCE', PALETTE.fog);
    endFlight(false);
    return true;
  }
  // him
  if (Math.abs(proj.x - tx) < 14 && proj.y > GROUND_Y - 30 && proj.y <= GROUND_Y) {
    land(target);
    return true;
  }
  if (proj.y >= GROUND_Y) {
    audio.sfx('item_thud', 0.4);
    puff(proj.x, GROUND_Y - 2);
    endFlight(false);
    return true;
  }
  if (proj.x < -12 || proj.x > GAME_W + 12) {
    endFlight(false);
    return true;
  }
  return false;
}

/** It made contact.  Damage, health, poison, noise. */
function land(target: Who): void {
  if (!proj || !scene0) return;
  const item = proj.item;
  const thrower = proj.from;
  const tx = target === 'frog' ? FROG_X : LIZARD_X;
  const hx = thrower === 'frog' ? FROG_X : LIZARD_X;

  sides[target].hp -= item.dmg;
  sides[thrower].dealt += item.dmg;
  floatText(tx, GROUND_Y - 34, `-${item.dmg}`, item.id === 'tnt' ? PALETTE.ember : PALETTE.cream);

  if (item.heal > 0) {
    // It still lands on him, and it still hurts him — it just does the thrower
    // more good than it does him harm.
    const before = sides[thrower].hp;
    sides[thrower].hp = Math.min(MAX_HP, sides[thrower].hp + item.heal);
    floatText(hx, GROUND_Y - 40, `+${Math.round(sides[thrower].hp - before)}`, 0x6fe08a);
    audio.sfx('heal_up');
  } else if (item.poison > 0) {
    sides[target].poison = item.poison;
    floatText(tx, GROUND_Y - 44, 'POISONED', 0x9b6fe0);
    audio.sfx('poison_hiss');
  } else if (item.id === 'tnt') {
    audio.sfx('boom');
    scene0.cameras.main.shake(200, 0.009);
    for (let i = 0; i < 7; i++) {
      const p = scene0.add.circle(tx + (Math.random() - 0.5) * 20, GROUND_Y - 12 - Math.random() * 16, 2 + Math.random() * 2, i % 2 ? PALETTE.ember : PALETTE.gold).setDepth(45);
      scene0.tweens.add({ targets: p, alpha: 0, scale: 0.3, duration: 340, onComplete: () => p.destroy() });
    }
  } else {
    audio.sfx('item_thud');
  }

  const sprite = sides[target].sprite;
  if (sprite) scene0.tweens.add({ targets: sprite, x: sprite.x + (thrower === 'frog' ? 4 : -4), duration: 70, yoyo: true, repeat: 1 });

  banner(item.heal > 0 ? 'HEALING HIT' : item.poison > 0 ? 'POISON LANDS' : 'DIRECT HIT', item.color);
  endFlight(true);
}

function puff(x: number, y: number): void {
  if (!scene0) return;
  const p = scene0.add.circle(x, y, 3, 0xbfa07a).setAlpha(0.7).setDepth(40);
  scene0.tweens.add({ targets: p, alpha: 0, scale: 1.8, duration: 300, onComplete: () => p.destroy() });
}

function endFlight(hit: boolean): void {
  proj?.body?.destroy();
  proj = null;
  refreshHud();
  if (!hit) banner('MISS', PALETTE.fog);
  if (sides.frog.hp <= 0 || sides.lizard.hp <= 0) {
    endRound();
    return;
  }
  phase = 'settle';
  settleMs = 900;
}

// ---------------------------------------------------------------- the arrow

/**
 * The aim, drawn from the hand: an arrow in the direction the item will leave
 * at, and the arc it would follow IF THE AIR WERE STILL.  The wind is not
 * baked into it on purpose — the bar tells you what the air is doing and
 * reading the two together is the game.  A preview that already corrected for
 * the wind would leave nothing to aim.
 */
function drawAim(): void {
  if (!aimG) return;
  aimG.clear();
  if (phase !== 'aim' || turn !== 'frog') return;

  const x0 = FROG_X + HAND.dx;
  const y0 = GROUND_Y + HAND.dy;
  const len = 14 + (charging ? power : 0) * 26;
  const x1 = x0 + Math.cos(aim) * len;
  const y1 = y0 + Math.sin(aim) * len;
  const colour = charging ? PALETTE.gold : PALETTE.cream;
  aimG.lineStyle(charging ? 2 : 1, colour, charging ? 1 : 0.75);
  aimG.beginPath();
  aimG.moveTo(x0, y0);
  aimG.lineTo(x1, y1);
  aimG.strokePath();
  const head = 5;
  const a = Math.PI * 0.8;
  aimG.beginPath();
  aimG.moveTo(x1, y1);
  aimG.lineTo(x1 + Math.cos(aim + a) * head, y1 + Math.sin(aim + a) * head);
  aimG.moveTo(x1, y1);
  aimG.lineTo(x1 + Math.cos(aim - a) * head, y1 + Math.sin(aim - a) * head);
  aimG.strokePath();

  // the still-air arc, in dots
  const speed = THROW_MIN + (charging ? power : 0.5) * (THROW_MAX - THROW_MIN);
  let px = x0;
  let py = y0;
  let vx = Math.cos(aim) * speed;
  let vy = Math.sin(aim) * speed;
  aimG.fillStyle(colour, charging ? 0.85 : 0.4);
  for (let i = 0; i < 22; i++) {
    for (let k = 0; k < 4; k++) {
      const h = 0.018;
      vy += GRAVITY * h;
      px += vx * h;
      py += vy * h;
    }
    if (py > GROUND_Y || px > GAME_W) break;
    aimG.fillCircle(px, py, 1);
  }
}

// -------------------------------------------------------------- the lizard

/**
 * How his throw would go: fly it, and report how close it came.  The same
 * numbers the real projectile uses, so what he plans is what he gets.
 */
function simulate(from: Who, angle: number, pow: number, w: number): { hit: boolean; miss: number } {
  const dir = from === 'frog' ? 1 : -1;
  const target: Who = from === 'frog' ? 'lizard' : 'frog';
  const tx = target === 'frog' ? FROG_X : LIZARD_X;
  const ty = GROUND_Y - 14;
  const speed = THROW_MIN + pow * (THROW_MAX - THROW_MIN);
  let x = (from === 'frog' ? FROG_X : LIZARD_X) + HAND.dx * dir;
  let y = GROUND_Y + HAND.dy;
  let vx = Math.cos(angle) * speed;
  let vy = Math.sin(angle) * speed;
  let miss = Infinity;
  const h = 1 / 120;
  for (let i = 0; i < 600; i++) {
    vx += w * WIND_MAX * h;
    vy += GRAVITY * h;
    x += vx * h;
    y += vy * h;
    miss = Math.min(miss, Math.hypot(x - tx, y - ty));
    if (x > FENCE.x - 6 && x < FENCE.x + FENCE.w + 6 && y > FENCE.top && y < GROUND_Y) return { hit: false, miss: miss + 60 };
    if (Math.abs(x - tx) < 14 && y > GROUND_Y - 30 && y <= GROUND_Y) return { hit: true, miss: 0 };
    if (y >= GROUND_Y || x < -12 || x > GAME_W + 12) break;
  }
  return { hit: false, miss };
}

/**
 * His aim.  He searches his own throws against the wind that is actually
 * blowing and keeps the best one — that is the whole of his skill, and it is
 * the same information the player has (the bar) rather than anything hidden.
 */
function solveThrow(who: Who): { angle: number; power: number } {
  let bestAngle = who === 'frog' ? -Math.PI / 4 : Math.PI + Math.PI / 4;
  let bestPow = 0.6;
  let bestMiss = Infinity;
  for (let elev = 0.12; elev <= 1.42; elev += 0.045) {
    const angle = who === 'frog' ? -elev : Math.PI + elev;
    for (let pow = 0.1; pow <= 1.0001; pow += 0.035) {
      const r = simulate(who, angle, pow, wind);
      if (r.miss < bestMiss) {
        bestMiss = r.miss;
        bestAngle = angle;
        bestPow = pow;
        if (r.hit) break;
      }
    }
    if (bestMiss === 0) break;
  }
  return { angle: bestAngle, power: bestPow };
}

/**
 * What he reaches for.  Heal when he is hurt, dynamite to finish, poison early
 * while there is time for it to work, and the rock the rest of the time — the
 * same reasoning a player uses, off the same stock.
 */
function aiChooseItem(): ItemId {
  const me = sides.lizard;
  const you = sides.frog;
  if (me.hp <= MAX_HP * 0.45 && me.stock.heal > 0) return 'heal';
  if (you.hp <= ITEMS.tnt.dmg && me.stock.tnt > 0) return 'tnt';
  if (you.poison === 0 && you.hp > MAX_HP * 0.35 && me.stock.poison > 0) return 'poison';
  if (you.hp <= MAX_HP * 0.5 && me.stock.tnt > 0) return 'tnt';
  return 'rock';
}

/** A gentle bell curve in [-1,1]: two uniforms, so most throws are near true. */
function wobble(): number {
  return (Math.random() + Math.random() - 1);
}

function lizardTurn(): void {
  if (!scene0 || phase === 'over') return;
  scene0.time.delayedCall(850, () => {
    if (!scene0 || phase !== 'aim' || turn !== 'lizard') return;
    const item = aiChooseItem();
    banner(`LIZARD PICKS ${ITEMS[item].short}`, ITEMS[item].color);
    scene0.time.delayedCall(550, () => {
      if (phase !== 'aim' || turn !== 'lizard') return;
      const plan = solveThrow('lizard');
      // His arm is not a solver: the throw goes out near the plan, not on it.
      const angle = plan.angle + wobble() * 0.06;
      const pow = Phaser.Math.Clamp(plan.power + wobble() * 0.055, 0.05, 1);
      throwItem('lizard', angle, pow, item);
    });
  });
}

// ------------------------------------------------------------ rounds and end

function endRound(): void {
  if (phase === 'over' || phase === 'roundEnd' || !scene0) return;
  phase = 'roundEnd';
  proj?.body?.destroy();
  proj = null;
  aimG?.clear();
  refreshHud();

  const frogDown = sides.frog.hp <= 0;
  const winner: Who = frogDown ? 'lizard' : 'frog';
  roundsWon[winner]++;
  refreshHud();
  banner(winner === 'frog' ? `ROUND ${round} IS YOURS` : `ROUND ${round} TO THE LIZARD`, winner === 'frog' ? PALETTE.gold : PALETTE.neon);
  audio.sfx(winner === 'frog' ? 'chime' : 'buzzer');

  scene0.time.delayedCall(1700, () => {
    if (phase !== 'roundEnd') return;
    if (round >= ROUNDS) {
      finish();
      return;
    }
    round++;
    // Health, poison and the special stock are a round's worth of resources,
    // not a match's.  Only the round score and the damage tally carry over.
    for (const who of ['frog', 'lizard'] as Who[]) {
      sides[who].hp = MAX_HP;
      sides[who].poison = 0;
      sides[who].stock = { rock: Infinity, heal: 1, tnt: 1, poison: 1 };
    }
    sel = 'rock';
    phase = 'aim';
    // Whoever lost the last round throws first in the next one.
    beginTurn(winner === 'frog' ? 'lizard' : 'frog');
  });
}

function finish(): void {
  if (phase === 'over' || !scene0) return;
  phase = 'over';
  aimG?.clear();

  // A split match goes to whoever did the most damage across the two rounds.
  // A dead heat pays nothing — the same rule the bowling lane uses.
  const won =
    roundsWon.frog > roundsWon.lizard ||
    (roundsWon.frog === roundsWon.lizard && sides.frog.dealt > sides.lizard.dealt);
  const drawn = roundsWon.frog === roundsWon.lizard && sides.frog.dealt === sides.lizard.dealt;

  if (store.setHighScore(ID, sides.frog.dealt)) best = sides.frog.dealt;
  refreshHud();
  const line = drawn
    ? 'DEAD HEAT - NO PRIZE'
    : won
      ? `YOU WIN ${roundsWon.frog}-${roundsWon.lizard}`
      : `THE LIZARD WINS ${roundsWon.lizard}-${roundsWon.frog}`;
  centerText(scene0, GAME_W / 2, 96, line, won ? PALETTE.gold : PALETTE.fog, 16).setDepth(80);
  centerText(scene0, GAME_W / 2, 112, `DAMAGE ${sides.frog.dealt} - ${sides.lizard.dealt}   BEST ${best}`, PALETTE.ash).setDepth(80);
  scene0.time.delayedCall(1700, () => (won ? apiRef?.win() : apiRef?.lose()));
}
