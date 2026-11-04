/**
 * FENCE WARS (the cabinet that was FROG VS LIZARD).  Hard — 5 tokens in, 10 out.
 *
 * Everything thrown glows, spins and leaves a trail of its own, and every
 * one of them lands with an effect that says what it did: a healing stream
 * that flows back over the fence to the thrower, a skull of purple smoke over
 * whoever was poisoned, and dynamite that goes off with a flash, a fireball,
 * flying debris and smoke.  The rules are the same rules either way.
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
 *   SLEEP     a dark blue ball: no damage, and he sleeps through his next
 *             two turns -- eyes shut, Zs drifting off him.
 *   CONFUSION a pink ball: a light hit, and on his next turn he cannot read
 *             the wind -- its bar is hidden from him, and his eyes spin.
 *
 * THE WIND: rolled fresh for every single turn and shown as a bar with a side
 * to it.  It pushes whatever is in the air, and it pushes harder the stronger
 * it is, so the same throw that landed last turn does not land this turn.
 *
 * ONE ROUND, and it ends when somebody's health is gone.  Empty his bar and
 * the cabinet pays; empty yours and it does not.  There is no second go at it
 * and no coming back from a bad first exchange, so one dynamite thrown early
 * at nothing is a real loss — which is the whole reason the specials are worth
 * holding.
 *
 * (ROUNDS drives it.  The scoring below still handles a match of several — a
 * split going to whoever did the most damage, a dead heat paying nothing —
 * because the number is a constant and not an assumption baked into the code.)
 */

import { isTouch } from '../core/device';
import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { centerText, smallText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'frogvslizard' as const;
export const ROUNDS = 1;
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
type ItemId = 'rock' | 'heal' | 'tnt' | 'poison' | 'sleep' | 'confuse';

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
  /** Turns the target sleeps through (the Sleep Ball). */
  sleep: number;
  /** Turns the target spends unable to read the wind (the Confusion Ball). */
  confuse: number;
  color: number;
  /** How many a side gets each round.  The rock is the one you never run out of. */
  stock: number;
  /** What it does, in one line under the item bar. */
  desc: string;
}

/**
 * The four, and the same four for both sides.  The rock is the baseline every
 * other number is set against: heal trades most of its damage for health,
 * dynamite is exactly double, and poison is a light hit that keeps going.
 */
const ITEMS: Record<ItemId, ItemDef> = {
  rock: { id: 'rock', name: 'ROCK', short: 'ROCK', dmg: 14, heal: 0, poison: 0, sleep: 0, confuse: 0, color: 0x9aa4b0, stock: Infinity, desc: 'ROCK - 14 DAMAGE. NEVER RUNS OUT.' },
  heal: { id: 'heal', name: 'HEAL', short: 'HEAL', dmg: 4, heal: 16, poison: 0, sleep: 0, confuse: 0, color: 0x6fe08a, stock: 1, desc: 'HEAL - 4 DAMAGE, +16 HEALTH FOR YOU.' },
  tnt: { id: 'tnt', name: 'DYNAMITE', short: 'TNT', dmg: 28, heal: 0, poison: 0, sleep: 0, confuse: 0, color: 0xd94f2e, stock: 1, desc: 'DYNAMITE - 28 DAMAGE. A BIG BANG.' },
  poison: { id: 'poison', name: 'POISON', short: 'PSN', dmg: 8, heal: 0, poison: 3, sleep: 0, confuse: 0, color: 0x9b6fe0, stock: 1, desc: 'POISON - 8, THEN 5 A TURN FOR 3 TURNS.' },
  sleep: { id: 'sleep', name: 'SLEEP BALL', short: 'SLP', dmg: 0, heal: 0, poison: 0, sleep: 2, confuse: 0, color: 0x2e4a9a, stock: 1, desc: 'SLEEP BALL - NO DAMAGE. SLEEPS 2 TURNS.' },
  confuse: { id: 'confuse', name: 'CONFUSION BALL', short: 'CNF', dmg: 4, heal: 0, poison: 0, sleep: 0, confuse: 1, color: 0xff6fb4, stock: 1, desc: 'CONFUSION - 4 DAMAGE. LOCKS THEIR NEXT WIND.' },
};
const ORDER: ItemId[] = ['rock', 'heal', 'tnt', 'poison', 'sleep', 'confuse'];
/** A round's specials: one of each. */
const fullStock = (): Record<ItemId, number> => ({ rock: Infinity, heal: 1, tnt: 1, poison: 1, sleep: 1, confuse: 1 });
/** What poison takes off at the top of each of its three turns. */
const POISON_TICK = 5;

interface Side {
  hp: number;
  /** Turns of poison left to apply.  Counts down one per turn, then stops. */
  poison: number;
  /** Turns left to sleep through. */
  sleep: number;
  /** Turns left unable to read the wind (counted off at the end of his own turn). */
  confused: number;
  stock: Record<ItemId, number>;
  /** Damage dealt over the whole match — the tiebreak on a one-all split. */
  dealt: number;
  sprite: Phaser.GameObjects.Container | null;
  /** The sleeping and confused faces, drawn over the sprite's eyes. */
  status: Phaser.GameObjects.Graphics | null;
}

type Phase = 'aim' | 'flight' | 'settle' | 'roundEnd' | 'over';

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  item: ItemDef;
  from: Who;
  body: Phaser.GameObjects.Container | null;
  /** What spins inside the body (the glow around it does not). */
  core: Phaser.GameObjects.Graphics | null;
  /** ms to the next trail mote. */
  trailT: number;
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
let bannerPlate: Phaser.GameObjects.Rectangle | null = null;
/** The item about to be thrown, drawn over the frog's hand. */
let heldIcon: Phaser.GameObjects.Graphics | null = null;
/** Where the power bar sits: over the frog's head. */
const POWER_Y = GROUND_Y - 52;
/** How long the power bar's fill is when full. */
const POWER_W = 38;

/** Not yellow: the HUD never writes in yellow (user, 3 Nov) -- a yellow item colour reads cream. */
function noYellow(c: number): number {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  return r > 190 && g > 150 && b < 140 ? PALETTE.cream : c;
}

/** A centred line in the small face. */
function centerSmallish(scene: Phaser.Scene, x: number, y: number, str: string): Phaser.GameObjects.BitmapText {
  return smallText(scene, x, y, str, PALETTE.cream).setOrigin(0.5, 0);
}
/** The confused side's turn: the wind bar is not shown. */
let windHidden = false;
let zzzT = 0;
let descText: Phaser.GameObjects.BitmapText | null = null;
let slots: Array<{ box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.BitmapText; icon: Phaser.GameObjects.Graphics }> = [];
let keys: Record<'up' | 'down', Phaser.Input.Keyboard.Key[]> = { up: [], down: [] };

function blankSide(): Side {
  return { hp: MAX_HP, poison: 0, sleep: 0, confused: 0, stock: fullStock(), dealt: 0, sprite: null, status: null };
}

export const frogVsLizard: MinigameModule = {
  id: ID,
  title: 'FENCE WARS',
  music: 'game_frogvslizard',
  rules: 'one round over the fence - mind the wind',
  tutorial: {
    pitch: 'LOB THINGS OVER THE FENCE AT THE LIZARD.',
    steps: [
      { say: 'W / S AIMS HIGHER OR LOWER.', phone: 'THE STICK AIMS HIGHER OR LOWER.', demo: 'fence.aim' },
      { say: 'HOLD SPACE FOR POWER, LET GO TO THROW.', phone: 'HOLD THROW FOR POWER, LET GO TO THROW.', demo: 'fence.power' },
      { say: 'THE WIND BENDS EVERY THROW - AIM OFF IT. EMPTY HIS HEALTH BAR.', demo: 'fence.wind' },
      { say: '1-6 PICKS AN ITEM ON THE BAR: DYNAMITE, HEAL, POISON AND MORE.', phone: 'TAP AN ITEM ON THE BAR: DYNAMITE, HEAL, POISON AND MORE.', demo: 'fence.items' },
    ],
    objective: [
      'THROW OVER THE FENCE AND HIT HIM.',
      'THE WIND BENDS EVERY THROW - AIM OFF IT.',
      'ONE ROUND. EMPTY HIS HEALTH BAR.',
    ],
    controls: [
      ['W / S', 'AIM HIGHER OR LOWER'],
      // (one row: on a phone the items are tapped on the bar, and the
      // numbers and LEFT/RIGHT cycling stay for the keyboard)
      ['1-6 / CLICK', 'PICK AN ITEM ON THE BAR'],
      ['HOLD SPACE', 'POWER, LET GO TO THROW'],
    ],
  },
  // Up and down aim, and one button to throw.  The items are picked by
  // tapping them on the bar along the bottom of the picture -- four more
  // buttons for them only crowded the aim pad off the screen.
  touch: {
    stick: 'ud',
    buttons: [{ label: 'THROW', key: 'SPACE', primary: true }],
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
    groundShadow(scene, FROG_X, 26);
    groundShadow(scene, LIZARD_X, 40);
    sides.frog.sprite = makeFrog(scene, FROG_X, GROUND_Y);
    sides.lizard.sprite = makeLizard(scene, LIZARD_X, GROUND_Y);
    for (const who of ['frog', 'lizard'] as Who[]) sides[who].status = scene.add.graphics().setDepth(21);
    windHidden = false;
    zzzT = 0;

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
    kb?.on('keydown-FIVE', pick('sleep'));
    kb?.on('keydown-SIX', pick('confuse'));
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
          frog: { hp: sides.frog.hp, poison: sides.frog.poison, sleep: sides.frog.sleep, confused: sides.frog.confused, stock: { ...sides.frog.stock }, dealt: sides.frog.dealt },
          lizard: { hp: sides.lizard.hp, poison: sides.lizard.poison, sleep: sides.lizard.sleep, confused: sides.lizard.confused, stock: { ...sides.lizard.stock }, dealt: sides.lizard.dealt },
          windHidden,
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
      powerFill?.setSize((charging ? power : 0) * POWER_W, 3);
    }
    drawAim();
    drawStatus(delta);

    if (phase === 'flight' && proj) {
      stepProjectile(dt);
      return;
    }

    if (phase === 'settle') {
      settleMs -= delta;
      if (settleMs <= 0) nextTurn();
    }
  },

  // ---- A RELOAD (log #87): both sides -- health, poison, sleep, confusion,
  // what is left in the stock, the damage dealt -- the rounds won, whose
  // throw, the wind, and an item in the air, where it was and how fast.  A
  // round or match already decided goes on the way it was decided.
  snapshot() {
    const side = (w: Who) => {
      const x = sides[w];
      // (an endless stock is written as -1: JSON has no Infinity)
      const stock = Object.fromEntries(Object.entries(x.stock).map(([k, n]) => [k, Number.isFinite(n) ? n : -1]));
      return { hp: x.hp, poison: x.poison, sleep: x.sleep, confused: x.confused, stock, dealt: x.dealt };
    };
    return {
      frog: side('frog'), lizard: side('lizard'), roundsWon: { ...roundsWon }, round, turn, phase, wind, aim, sel, settleMs, windHidden,
      proj: proj ? { x: proj.x, y: proj.y, vx: proj.vx, vy: proj.vy, item: proj.item.id, from: proj.from, spin: proj.spin } : null,
    };
  },

  restore(snap: unknown) {
    type S = { hp: number; poison: number; sleep: number; confused: number; stock: Record<ItemId, number>; dealt: number };
    const v = snap as { frog: S; lizard: S; roundsWon: Record<Who, number>; round: number; turn: Who; phase: Phase; wind: number; aim: number; sel: ItemId; settleMs: number; windHidden: boolean; proj: { x: number; y: number; vx: number; vy: number; item: ItemId; from: Who; spin: number } | null };
    if (!scene0) return;
    for (const w of ['frog', 'lizard'] as Who[]) {
      const sv = v[w];
      Object.assign(sides[w], { hp: sv.hp, poison: sv.poison, sleep: sv.sleep, confused: sv.confused, dealt: sv.dealt });
      sides[w].stock = Object.fromEntries(Object.entries(sv.stock).map(([k, n]) => [k, n < 0 ? Infinity : n])) as Record<ItemId, number>;
    }
    roundsWon = { ...v.roundsWon };
    round = v.round;
    turn = v.turn;
    wind = v.wind;
    aim = v.aim;
    sel = v.sel;
    windHidden = v.windHidden;
    proj?.body?.destroy();
    proj = null;
    refreshHud();
    if (v.phase === 'over') {
      phase = 'aim';
      finish();
      return;
    }
    if (v.phase === 'roundEnd') {
      // (decided: it is counted again by endRound, so take it back off first)
      const winner: Who = sides.frog.hp <= 0 ? 'lizard' : 'frog';
      roundsWon[winner] = Math.max(0, roundsWon[winner] - 1);
      phase = 'aim';
      endRound();
      return;
    }
    if (v.phase === 'flight' && v.proj) {
      const item = ITEMS[v.proj.item];
      const { body, core } = makeProjectile(scene0, item, v.proj.x, v.proj.y);
      proj = { ...v.proj, item, body, core, trailT: 0 };
      flightBank = 0;
      phase = 'flight';
      refreshHud();
      return;
    }
    if (v.phase === 'settle') {
      phase = 'settle';
      settleMs = v.settleMs;
      return;
    }
    phase = 'aim';
    power = 0;
    charging = false;
    powerFill?.setSize(0, 3);
    refreshHud();
    // (no "YOUR THROW" plate: whose go it is shows on the frog, user 4 Nov)
    banner('');
    if (turn === 'lizard') lizardTurn();
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
    bannerPlate = null;
    heldIcon = null;
    slots = [];
    sides.frog.sprite = null;
    sides.lizard.sprite = null;
    sides.frog.status = null;
    sides.lizard.status = null;
    descText = null;
    apiRef = null;
    scene0 = null;
  },
};


// ------------------------------------------------------------------ the yard

/** Two gardens, a hedge line behind them, and the fence between. */
function paintYard(scene: Phaser.Scene): void {
  // A bright summer afternoon, painted once: a warm blue sky, a sun with its
  // glow, fat white clouds, soft green hills, a trimmed hedge, flower beds,
  // and textured lawn.
  const key = 'fvl_yard_sunny';
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, GAME_W, GAME_H);
    if (tex) {
      const g = tex.getContext();
      let seed = 11;
      const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const sky = g.createLinearGradient(0, 0, 0, GROUND_Y);
      sky.addColorStop(0, '#3fa8f0');
      sky.addColorStop(0.65, '#8fd4fa');
      sky.addColorStop(1, '#d8f2ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, GAME_W, GROUND_Y);
      // the sun and its warm glow
      const glow = g.createRadialGradient(46, 46, 4, 46, 46, 46);
      glow.addColorStop(0, 'rgba(255,248,200,0.95)');
      glow.addColorStop(0.3, 'rgba(255,236,150,0.45)');
      glow.addColorStop(1, 'rgba(255,236,150,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, 100, 100);
      g.fillStyle = '#fff6c8';
      g.beginPath();
      g.arc(46, 46, 11, 0, Math.PI * 2);
      g.fill();
      // clouds: puffs with a lit top and a soft blue belly
      const cloud = (cx: number, cy: number, w: number) => {
        for (const [dx, dy, r] of [[-w * 0.35, 2, w * 0.22], [0, -2, w * 0.3], [w * 0.32, 1, w * 0.24], [w * 0.12, 4, w * 0.22]]) {
          g.fillStyle = '#d6e8f6';
          g.beginPath();
          g.arc(cx + dx, cy + dy + 2, r, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#ffffff';
          g.beginPath();
          g.arc(cx + dx, cy + dy, r, 0, Math.PI * 2);
          g.fill();
        }
      };
      cloud(110, 44, 34);
      cloud(226, 56, 28);
      cloud(286, 34, 20);
      // far hills, then nearer ones
      for (const [base, colr, amp, f] of [[GROUND_Y - 34, '#8cc98a', 10, 0.02], [GROUND_Y - 24, '#5fae63', 8, 0.035]] as const) {
        g.fillStyle = colr;
        g.beginPath();
        g.moveTo(0, GROUND_Y);
        for (let x = 0; x <= GAME_W; x += 4) g.lineTo(x, base - Math.sin(x * f + base) * amp - Math.sin(x * f * 2.3) * amp * 0.4);
        g.lineTo(GAME_W, GROUND_Y);
        g.fill();
      }
      // the hedge: rounded tops, light on the sunny side
      g.fillStyle = '#2f7a3c';
      g.fillRect(0, GROUND_Y - 22, GAME_W, 22);
      for (let x = 0; x < GAME_W + 10; x += 10) {
        g.fillStyle = '#2f7a3c';
        g.beginPath();
        g.arc(x, GROUND_Y - 22, 7, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#4fa556';
        g.beginPath();
        g.arc(x - 2, GROUND_Y - 25, 3, 0, Math.PI * 2);
        g.fill();
      }
      for (let i = 0; i < 160; i++) {
        g.fillStyle = R() < 0.5 ? '#3b8c46' : '#266a32';
        g.fillRect(Math.floor(R() * GAME_W), GROUND_Y - 26 + Math.floor(R() * 24), 2, 1);
      }
      // flowers along the hedge foot
      const petals = ['#ff6b8a', '#ffd84a', '#ffffff', '#ff9a3c', '#c78bff'];
      for (let i = 0; i < 46; i++) {
        const fx = Math.floor(R() * GAME_W);
        const fy = GROUND_Y - 3 - Math.floor(R() * 5);
        g.fillStyle = '#2f7a3c';
        g.fillRect(fx, fy, 1, 3);
        g.fillStyle = petals[i % petals.length];
        g.fillRect(fx - 1, fy - 1, 3, 2);
      }
      // the lawn: stripes from the mower, tufts, a little shade under the hedge
      g.fillStyle = '#6cc35e';
      g.fillRect(0, GROUND_Y, GAME_W, GAME_H - GROUND_Y);
      for (let x = 0; x < GAME_W; x += 32) {
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(x, GROUND_Y, 16, GAME_H - GROUND_Y);
      }
      g.fillStyle = '#9ae07c';
      g.fillRect(0, GROUND_Y, GAME_W, 2);
      g.fillStyle = 'rgba(30,80,30,0.25)';
      g.fillRect(0, GROUND_Y, GAME_W, 1);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = R() < 0.5 ? '#58ad4e' : '#86d06e';
        g.fillRect(Math.floor(R() * GAME_W), GROUND_Y + 3 + Math.floor(R() * (GAME_H - GROUND_Y - 3)), 1, 2);
      }
      tex.refresh();
    }
  }
  scene.add.image(0, 0, key).setOrigin(0, 0);

  // ---- the afternoon light: warm rays down from the sun, and the shadows
  // it throws falling away to the right
  const rays = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.07);
  for (const [a, w] of [[0.55, 0.08], [0.85, 0.06], [1.15, 0.09]] as const) {
    rays.fillStyle(0xfff0b0, 1).fillTriangle(46, 46, 46 + Math.cos(a - w) * 340, 46 + Math.sin(a - w) * 340, 46 + Math.cos(a + w) * 340, 46 + Math.sin(a + w) * 340);
  }

  // the fence: weathered planks with a pointed top, two rails nailed across
  // them, lit from the left, and its shadow lying on the lawn behind it
  const h = GROUND_Y - FENCE.top;
  const f = scene.add.graphics();
  f.fillStyle(0x1a3a14, 0.22).fillPoints(
    [new Phaser.Geom.Point(FENCE.x - 4, GROUND_Y), new Phaser.Geom.Point(FENCE.x + FENCE.w + 4, GROUND_Y), new Phaser.Geom.Point(FENCE.x + FENCE.w + 22, GROUND_Y + 8), new Phaser.Geom.Point(FENCE.x + 14, GROUND_Y + 8)],
    true,
  );
  f.fillStyle(0x2a1a0c, 1).fillRect(FENCE.x - 5, FENCE.top - 1, FENCE.w + 10, h + 1);
  for (let i = 0; i < 3; i++) {
    const px = FENCE.x - 4 + i * 7;
    const base = i === 1 ? 0x9c7248 : 0x8a6238;
    f.fillStyle(0x2a1a0c, 1).fillTriangle(px - 1, FENCE.top + 1, px + 3, FENCE.top - 5, px + 7, FENCE.top + 1);
    f.fillStyle(base, 1).fillRect(px, FENCE.top, 6, h);
    f.fillStyle(0xb08553, 1).fillTriangle(px, FENCE.top + 0.5, px + 3, FENCE.top - 4, px + 6, FENCE.top + 0.5);
    // the lit edge, the shaded edge, and the grain
    f.fillStyle(0xc49a68, 1).fillRect(px, FENCE.top, 1, h);
    f.fillStyle(0x5a3e22, 1).fillRect(px + 5, FENCE.top, 1, h);
    f.fillStyle(0x6b4a2f, 0.8);
    for (let k = 0; k < 4; k++) f.fillRect(px + 2 + (k % 2), FENCE.top + 6 + k * 17 + i * 3, 1, 8);
    f.fillStyle(0x4a3018, 1).fillCircle(px + 3, FENCE.top + 40 + i * 5, 1);
    // a darker foot where the grass keeps it damp
    f.fillStyle(0x4a3a1a, 0.6).fillRect(px, GROUND_Y - 4, 6, 4);
  }
  for (const ry of [FENCE.top + 14, FENCE.top + h - 20]) {
    f.fillStyle(0x2a1a0c, 1).fillRect(FENCE.x - 7, ry - 1, FENCE.w + 14, 5);
    f.fillStyle(0x6b4a2f, 1).fillRect(FENCE.x - 6, ry, FENCE.w + 12, 3);
    f.fillStyle(0x8a6238, 1).fillRect(FENCE.x - 6, ry, FENCE.w + 12, 1);
    f.fillStyle(0xd6dce4, 1);
    for (let i = 0; i < 3; i++) f.fillRect(FENCE.x - 2 + i * 7, ry + 1, 1, 1);
  }
  // grass growing up against it
  f.fillStyle(0x4f9a44, 1);
  for (let x = FENCE.x - 6; x < FENCE.x + FENCE.w + 6; x += 2) f.fillRect(x, GROUND_Y - 2 - ((x * 7) % 3), 1, 3);
}

/** Under someone on the lawn: the shadow the sun throws, a little to the right. */
function groundShadow(scene: Phaser.Scene, x: number, w: number): void {
  scene.add.ellipse(x + 3, GROUND_Y + 1, w, 5, 0x1a3a14, 0.35).setDepth(19);
}

/**
 * The player: a round frog in a garden, facing the fence.
 *
 * TEXTURED, AND NOT THE COLOUR OF THE LAWN (user, 4 Nov).  A dark outline
 * all the way round, a deeper jade skin with darker blotches and fine
 * speckle, a warm yellow belly, orange toe pads and a green eye ring -- so he
 * reads against the grass rather than melting into it.  The eyes stay where
 * they were (-6/6, -23): the status marks sit over them.
 */
function makeFrog(scene: Phaser.Scene, x: number, groundY: number): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const ink = 0x10240e;
  const skin = 0x2f8f5a;
  const skinLit = 0x5cc47e;
  const skinDark = 0x1d5e3a;
  const belly = 0xf2d36b;
  // outline first, a pixel bigger than everything that goes on it
  g.fillStyle(ink, 1);
  g.fillEllipse(-7, -3, 13, 7).fillEllipse(7, -3, 13, 7).fillEllipse(0, -13, 27, 23).fillEllipse(11, -15, 12, 8);
  g.fillCircle(-6, -23, 5.5).fillCircle(6, -23, 5.5);
  // the back legs, folded, with orange toes
  g.fillStyle(skinDark, 1).fillEllipse(-7, -3, 11, 5).fillEllipse(7, -3, 11, 5);
  g.fillStyle(0xf08a3a, 1).fillRect(-13, -2, 2, 1.5).fillRect(-10, -1, 2, 1.5).fillRect(11, -2, 2, 1.5).fillRect(8, -1, 2, 1.5);
  // body: shade, skin, the lit crown
  g.fillStyle(skinDark, 1).fillEllipse(0, -13, 25, 21);
  g.fillStyle(skin, 1).fillEllipse(-0.5, -14, 23, 18);
  g.fillStyle(skinLit, 1).fillEllipse(-3, -18, 14, 8);
  // belly, with a soft fold line
  g.fillStyle(0xd9b04a, 1).fillEllipse(0, -8.5, 16, 11);
  g.fillStyle(belly, 1).fillEllipse(-0.5, -9, 14, 9);
  g.lineStyle(1, 0xd9b04a, 0.9).lineBetween(-4, -9, 4, -9);
  // the throwing arm, out towards the fence
  g.fillStyle(skinDark, 1).fillEllipse(11, -15, 10, 6);
  g.fillStyle(skin, 1).fillEllipse(11, -15.5, 8, 4);
  g.fillStyle(0xf08a3a, 1).fillCircle(15.5, -15, 1.2);
  // blotches and speckle across the back
  g.fillStyle(skinDark, 1);
  for (const [bx, by, br] of [[-8, -14, 2.2], [-3, -21, 1.6], [6, -18, 2], [8, -11, 1.5], [-9, -8, 1.4], [2, -14, 1.1]] as const) g.fillCircle(bx, by, br);
  g.fillStyle(0x8ad8a0, 0.9);
  for (const [sx, sy] of [[-6, -17], [-1, -19], [4, -21], [-9, -12], [9, -16], [1, -12]] as const) g.fillRect(sx, sy, 1, 1);
  // the mouth line
  g.lineStyle(1, ink, 1).lineBetween(-2, -16, 7, -16);
  // a crisp lit edge on the crown
  g.lineStyle(1, 0xa8f0b8, 0.7).beginPath();
  g.arc(-1, -13, 10.5, Math.PI * 0.95, Math.PI * 1.2);
  g.strokePath();
  // the eyes LAST, each in its own dark rim: nothing on the body -- the lit
  // edge, a blotch, a speck -- is ever drawn across them (user, 4 Nov)
  g.fillStyle(0x10240e, 1).fillCircle(-6, -23, 5.2).fillCircle(6, -23, 5.2);
  // a green ring (not yellow -- user, 4 Nov), cream, black, a glint
  g.fillStyle(0x3aa860, 1).fillCircle(-6, -23, 4.4).fillCircle(6, -23, 4.4);
  g.fillStyle(0xfff4d8, 1).fillCircle(-6, -23, 3.4).fillCircle(6, -23, 3.4);
  g.fillStyle(PALETTE.black, 1).fillCircle(-5, -23, 2).fillCircle(7, -23, 2);
  g.fillStyle(0xffffff, 1).fillRect(-7, -25, 1, 1).fillRect(5, -25, 1, 1);
  return scene.add.container(x, groundY, [g]).setDepth(20);
}

/**
 * The opponent: long, low, tan and spiny, so that at 320 pixels wide nobody
 * mistakes him for a second frog.  Outlined, with rows of scales, dark bands
 * down the back and round the tail, and a pale belly.
 */
/** The lizard, side on, facing left.  Also the opponent at the air hockey table. */
export function makeLizard(scene: Phaser.Scene, x: number, groundY: number): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const ink = 0x3a2408;
  const hide = 0xc9962f;
  const lit = 0xe8c262;
  const dark = 0x7a5414;
  const belly = 0xf0deaa;
  const tri = (pts: number[], col: number): void => {
    g.fillStyle(col, 1).fillTriangle(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
  };
  // outline
  g.fillStyle(ink, 1);
  g.fillEllipse(0, -9, 33, 16).fillEllipse(-13, -12, 20, 14);
  tri([-27, -11, -18, -15, -18, -7], ink);
  tri([12, -12, 36, -7, 12, -3], ink);
  g.fillEllipse(-6, -3, 13, 6).fillEllipse(8, -3, 13, 6);
  // tail, banded, thinning away to the right
  tri([12, -11, 34, -7.5, 12, -4], hide);
  g.fillStyle(dark, 1);
  for (const tx of [16, 21, 26, 30]) g.fillRect(tx, -10 + (tx - 16) * 0.14, 2, 6 - (tx - 16) * 0.3);
  // legs, splayed, with toes
  g.fillStyle(dark, 1).fillEllipse(-6, -3, 11, 4).fillEllipse(8, -3, 11, 4);
  g.fillStyle(ink, 1);
  for (const fx of [-12, -10, 12, 14]) g.fillRect(fx, -1.5, 1, 2);
  // body: hide, a lit back, the belly
  g.fillStyle(hide, 1).fillEllipse(0, -9, 30, 13);
  g.fillStyle(lit, 1).fillEllipse(-2, -12.5, 22, 4);
  g.fillStyle(belly, 1).fillEllipse(0, -5.5, 22, 5);
  // dark bands across the back
  g.fillStyle(dark, 0.9);
  for (const bx of [-7, -1, 5, 11]) g.fillRect(bx, -15, 2.5, 6);
  // rows of scales: a pale and a dark dot, alternating
  for (let row = 0; row < 3; row++)
    for (let k = 0; k < 7; k++) {
      const sx = -11 + k * 4 + (row % 2) * 2;
      const sy = -13 + row * 2.6;
      g.fillStyle(k % 2 ? 0xf4d88a : 0x9a6a1a, 0.85).fillRect(sx, sy, 1, 1);
    }
  // a spiny ridge down the back
  for (const [sx, sh] of [[-8, 4], [-3, 5], [2, 5.5], [7, 5], [12, 3.5]] as const) {
    tri([sx - 2, -14.5, sx, -14.5 - sh, sx + 2, -14.5], ink);
    tri([sx - 1.2, -14.5, sx, -14.5 - sh + 1.3, sx + 1.2, -14.5], 0xe0a84a);
  }
  // head and snout, pointed at the fence
  g.fillStyle(hide, 1).fillEllipse(-13, -12, 17, 11);
  tri([-26, -11, -18, -14.5, -18, -7.5], hide);
  g.fillStyle(lit, 1).fillEllipse(-14, -15.5, 10, 3);
  g.fillStyle(0xe8c26a, 1).fillEllipse(-16, -7, 8, 4);
  g.lineStyle(1, ink, 1).lineBetween(-25, -10, -14, -9);
  g.fillStyle(ink, 1).fillRect(-24, -12, 1, 1);
  // scaly cheek
  g.fillStyle(dark, 0.8).fillRect(-12, -12, 1, 1).fillRect(-10, -10, 1, 1).fillRect(-9, -13, 1, 1);
  // the eye: gold, a slit, a glint
  g.fillStyle(ink, 1).fillCircle(-15, -16, 4);
  g.fillStyle(0xf0c030, 1).fillCircle(-15, -16, 3.2);
  g.fillStyle(PALETTE.black, 1).fillRect(-15.5, -18, 1, 4);
  g.fillStyle(0xffffff, 1).fillRect(-17, -18, 1, 1);
  return scene.add.container(x, groundY, [g]).setDepth(20);
}

// --------------------------------------------------------------------- hud

function buildHud(scene: Phaser.Scene): void {
  // ONE THIN STRIP ACROSS THE TOP (user, 3 Nov): it used to be a dark plate
  // over half the sky.  Names and the round on one row, the health bars and
  // the wind on the next, the numbers and the keys under them -- and no
  // yellow writing anywhere (cream, teal and the lizard's pink instead).
  scene.add.rectangle(0, 16, GAME_W, 33, 0x000000, 0.5).setOrigin(0, 0);
  scene.add.rectangle(0, 148, GAME_W, GAME_H - 148, 0x000000, 0.6).setOrigin(0, 0).setDepth(49);
  roundText = centerSmallish(scene, GAME_W / 2, 19, '');

  text(scene, 8, 18, 'FROG', PALETTE.tealLight);
  text(scene, GAME_W - 8, 18, 'LIZARD', PALETTE.neon).setOrigin(1, 0);
  scene.add.rectangle(8, 27, 96, 6, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
  hpFill.frog = scene.add.rectangle(9, 28, 94, 4, PALETTE.mossLight).setOrigin(0, 0);
  scene.add.rectangle(GAME_W - 104, 27, 96, 6, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
  hpFill.lizard = scene.add.rectangle(GAME_W - 9, 28, 94, 4, 0xd98a3d).setOrigin(1, 0);
  hpText.frog = smallText(scene, 8, 35, '', PALETTE.cream);
  hpText.lizard = smallText(scene, GAME_W - 8, 35, '', PALETTE.cream).setOrigin(1, 0);
  poisonText.frog = smallText(scene, 40, 35, '', 0x9b6fe0);
  poisonText.lizard = smallText(scene, GAME_W - 40, 35, '', 0x9b6fe0).setOrigin(1, 0);

  // The wind, in the middle where both sides can see it.  The bar fills out
  // from the centre towards the side it is blowing, so which way is the shape
  // of it and how hard is the length.
  windText = centerSmallish(scene, GAME_W / 2, 35, '');
  scene.add.rectangle(GAME_W / 2 - 36, 27, 72, 6, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
  scene.add.rectangle(GAME_W / 2, 27, 1, 6, PALETTE.steel).setOrigin(0.5, 0);
  windFill = scene.add.rectangle(GAME_W / 2, 28, 0, 4, PALETTE.tealLight).setOrigin(0, 0);

  // the keys, small, along the strip's foot
  const keys = smallText(scene, GAME_W / 2, 41, isTouch() ? 'UP/DOWN AIM   HOLD THROW   TAP AN ITEM' : 'W/S AIM   HOLD SPACE THROW   1-6 ITEM', PALETTE.fog);
  keys.setOrigin(0.5, 0);

  // what is happening, under the strip, on a plate of its own that fits it
  // (small, and sat in the middle of its plate: it used to hang off the top of it)
  bannerPlate = scene.add.rectangle(GAME_W / 2, 52, 10, 9, 0x000000, 0.55).setVisible(false);
  bannerText = smallText(scene, GAME_W / 2, 54, '', PALETTE.cream).setOrigin(0.5, 0);

  // THE THROW, WHERE YOU ARE LOOKING: the power bar and the thing you are
  // about to throw, over the frog's head rather than off at the screen's edge
  scene.add.rectangle(FROG_X - 20, POWER_Y, 40, 5, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel).setDepth(48);
  powerFill = scene.add.rectangle(FROG_X - 19, POWER_Y + 1, 0, 3, PALETTE.tealLight).setOrigin(0, 0).setDepth(48);
  smallText(scene, FROG_X - 22, POWER_Y, 'PWR', PALETTE.fog).setOrigin(1, 0).setDepth(48);
  heldIcon = scene.add.graphics().setDepth(48);

  // THE ITEM BAR: a picture of each thing, and how many are left (the key
  // that picks it, on a keyboard).  On a phone the bar keeps clear of the
  // aim pad on the left and the THROW button on the right.
  const touch = isTouch();
  const x0 = touch ? 50 : 4;
  const slotW = touch ? 37 : 52;
  ORDER.forEach((id, i) => {
    const x = x0 + i * slotW;
    const box = scene.add.rectangle(x, 151, slotW - 2, 14, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel).setDepth(50);
    const keyW = touch ? 0 : 8;
    if (!touch) text(scene, x + 3, 154, `${i + 1}`, PALETTE.ash).setDepth(51);
    const icon = scene.add.graphics().setDepth(51);
    drawItemIcon(icon, id, x + 3 + keyW, 153);
    const label = text(scene, x + 16 + keyW, 154, '', PALETTE.cream).setDepth(51);
    box.setInteractive({ useHandCursor: true }).on('pointerdown', () => selectItem(id));
    slots.push({ box, label, icon });
  });
  // what the chosen item does, in a line of its own under the bar
  // (the small font: the longer item lines ran out past the bar)
  descText = smallText(scene, GAME_W / 2, 170, '', PALETTE.cream).setOrigin(0.5, 0).setDepth(51);
}

function refreshHud(): void {
  roundText?.setText(
    ROUNDS > 1 ? `ROUND ${round}/${ROUNDS}   ${roundsWon.frog}-${roundsWon.lizard}` : 'ONE ROUND - LAST ONE STANDING',
  );
  for (const who of ['frog', 'lizard'] as Who[]) {
    const s = sides[who];
    const frac = Math.max(0, s.hp) / MAX_HP;
    hpFill[who]?.setSize(Math.max(0, 94 * frac), 5);
    hpText[who]?.setText(`${Math.max(0, Math.ceil(s.hp))} HP`);
    const st = [s.poison > 0 ? `POISON ${s.poison}` : '', s.sleep > 0 ? `ASLEEP ${s.sleep}` : '', s.confused > 0 ? 'CONFUSED' : ''].filter(Boolean);
    poisonText[who]?.setText(st.join(' ')).setTint(s.sleep > 0 ? 0x8aa8ff : s.confused > 0 ? 0xff6fb4 : 0x9b6fe0);
  }

  // wind: side, and how much of the bar it fills -- unless whoever is
  // throwing is confused, and then nobody is shown it
  // (confused: the bar is locked and greyed, not just gone -- you can see
  // there is a wind, you just cannot read it)
  windFill?.setVisible(true);
  if (windHidden) windText?.setText('WIND LOCKED').setTint(PALETTE.ash);
  else windText?.setTint(PALETTE.cream);
  const mag = Math.abs(wind);
  const w = Math.round(mag * 34);
  if (windFill) {
    windFill.setSize(w, 4);
    windFill.setOrigin(wind < 0 ? 1 : 0, 0);
    windFill.x = GAME_W / 2;
    windFill.setFillStyle(mag > 0.66 ? PALETTE.ember : mag > 0.33 ? PALETTE.gold : PALETTE.tealLight);
    if (windHidden) {
      windFill.setSize(70, 4).setOrigin(0.5, 0).setFillStyle(0x55596a);
      windFill.x = GAME_W / 2;
    }
  }
  const arrows = mag < 0.08 ? '-' : (wind < 0 ? '<' : '>').repeat(Math.min(3, 1 + Math.floor(mag * 3)));
  if (!windHidden) windText?.setText(`WIND ${arrows}`);

  slots.forEach((slot, i) => {
    const item = ITEMS[ORDER[i]];
    const n = sides.frog.stock[item.id];
    // (the rock never runs out, so it has no count)
    slot.label.setText(n === Infinity ? '' : `x${n}`);
    const usable = n > 0;
    const active = ORDER[i] === sel;
    slot.box.setStrokeStyle(1, active ? PALETTE.gold : PALETTE.steel);
    slot.box.setFillStyle(active ? PALETTE.plum : PALETTE.ink);
    slot.label.setTint(usable ? (active ? PALETTE.tealLight : PALETTE.cream) : PALETTE.ash);
    // used up: the picture greys out with the count
    slot.icon.setAlpha(usable ? 1 : 0.35);
  });
  descText?.setText(ITEMS[sel].desc).setTint(noYellow(ITEMS[sel].color === 0x2e4a9a ? 0x8aa8ff : ITEMS[sel].color));

}

/**
 * Each item's picture for the bar, 10x9, drawn in pixels from its top left.
 * Read at a glance: a grey stone, a green bottle with a cross, a red stick of
 * dynamite with its fuse, a purple bottle with a skull, a blue ball with a
 * moon on it, a pink ball with a spiral.
 */
function drawItemIcon(g: Phaser.GameObjects.Graphics, id: ItemId, x: number, y: number): void {
  const px = (c: number, rows: string[]): void => {
    rows.forEach((row, ry) =>
      [...row].forEach((ch, rx) => {
        if (ch === '.') return;
        g.fillStyle(ch === 'o' ? 0x14100c : ch === 'h' ? 0xffffff : ch === 'd' ? Phaser.Display.Color.ValueToColor(c).darken(28).color : ch === 'y' ? 0xffd45e : c, 1);
        g.fillRect(x + rx, y + ry, 1, 1);
      }),
    );
  };
  if (id === 'rock') {
    px(0x9aa4b0, ['...oooo...', '..oxhxxo..', '.oxxxxxdo.', 'oxxxxxxxdo', 'oxxxxxxddo', 'oxxxxxdddo', '.oddddddo.', '..oooooo..']);
  } else if (id === 'heal') {
    px(0x6fe08a, ['...oooo...', '...oddo...', '..oxxxxo..', '.oxxhhxxo.', '.oxhhhhxo.', '.oxxhhxxo.', '.oxxxxxxo.', '..oooooo..']);
  } else if (id === 'tnt') {
    px(0xd94f2e, ['.......y..', '......yo..', '....ooo...', '.ooxxxxoo.', 'oxhxxxxxdo', 'oxxxxxxxdo', 'odddddddoo', '.oooooooo.']);
  } else if (id === 'poison') {
    px(0x9b6fe0, ['...oooo...', '...oddo...', '..oxxxxo..', '.oxhhhhxo.', '.oxhohoxo.', '.oxxhhxxo.', '.oxhxhxxo.', '..oooooo..']);
  } else if (id === 'sleep') {
    px(0x5a7ad8, ['..oooooo..', '.oxxxxxxo.', 'oxxxhhxxdo', 'oxxhxxxxdo', 'oxxhxxxxdo', 'oxxxhhxddo', '.oddddddo.', '..oooooo..']);
  } else {
    px(0xff6fb4, ['..oooooo..', '.oxxxxxxo.', 'oxhhhhhxdo', 'oxhxxxhxdo', 'oxhxhhhxdo', 'oxhxxxxddo', '.oddddddo.', '..oooooo..']);
  }
}

function banner(str: string, colour: number = PALETTE.cream): void {
  bannerText?.setText(str).setTint(noYellow(colour)).setAlpha(1);
  if (bannerPlate && bannerText) bannerPlate.setSize(Math.ceil(bannerText.width) + 8, 9).setPosition(GAME_W / 2 - (Math.ceil(bannerText.width) + 8) / 2, 52).setOrigin(0, 0).setVisible(!!str).setAlpha(1);
}

/** A number that floats off whoever it just happened to. */
function floatText(x: number, y: number, str: string, colour: number, size?: number): void {
  if (!scene0) return;
  const t = (size ? centerText(scene0, x, y, str, colour, size) : centerText(scene0, x, y, str, colour)).setDepth(60);
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
    skullSmoke(who === 'frog' ? FROG_X : LIZARD_X, 0.6);
    refreshHud();
    if (s.hp <= 0) {
      endRound();
      return;
    }
  }

  if (!first) rollWind();
  power = 0;
  charging = false;
  powerFill?.setSize(0, 3);

  // ASLEEP: the turn goes by without him.  Two of them, then he wakes.
  if (s.sleep > 0) {
    s.sleep--;
    windHidden = false;
    phase = 'settle';
    settleMs = 1300;
    refreshHud();
    banner(who === 'frog' ? 'YOU ARE ASLEEP - ZZZ' : 'THE LIZARD IS ASLEEP - ZZZ', 0x8aa8ff);
    audio.sfx('ui_blip', 0.3);
    if (s.sleep === 0) scene0?.time.delayedCall(1100, () => floatText(who === 'frog' ? FROG_X : LIZARD_X, GROUND_Y - 40, 'WAKES UP', PALETTE.cream));
    return;
  }
  // CONFUSED: this one turn, the wind bar is gone
  windHidden = s.confused > 0;
  phase = 'aim';

  // A side that has run its specials out falls back to the rock rather than
  // pointing at an empty slot.
  if (who === 'frog' && sides.frog.stock[sel] <= 0) sel = 'rock';

  refreshHud();
  banner('');
  if (who === 'lizard') lizardTurn();
}

function nextTurn(): void {
  if (phase === 'over' || phase === 'roundEnd') return;
  if (sides.frog.hp <= 0 || sides.lizard.hp <= 0) {
    endRound();
    return;
  }
  // a confused side has had its turn without the wind: it clears now
  if (windHidden && sides[turn].confused > 0) sides[turn].confused--;
  windHidden = false;
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
  const { body, core } = makeProjectile(scene0, item, x, y);
  proj = { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, item, from: who, body, core, spin: 0, trailT: 0 };
  flightBank = 0;

  phase = 'flight';
  power = 0;
  charging = false;
  powerFill?.setSize(0, 3);
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

/** The flight's step: the same as `simulate`'s, so the solved arc is the flown one. */
const FLIGHT_STEP = 1 / 120;
/** Frame time not yet flown (less than one step). */
let flightBank = 0;

function stepProjectile(dt: number): void {
  if (!proj) return;
  // IN THE SOLVER'S OWN STEPS.  The lizard's aim (and the harness's) is found
  // by `simulate`, stepping 1/120 s at a time; flown in steps of half a frame
  // instead, the arc drifted with the frame rate -- at 25 frames a second a
  // solved throw that clipped the edge of the target went past it.  So the
  // flight is the same 1/120 s steps, the frame's time banked between them:
  // what was solved is what flies, on any machine.  (Small steps also keep a
  // fast throw from tunnelling through the 12px fence.)
  flightBank += dt;
  while (flightBank >= FLIGHT_STEP) {
    flightBank -= FLIGHT_STEP;
    const h = FLIGHT_STEP;
    proj.vx += wind * WIND_MAX * h;
    proj.vy += GRAVITY * h;
    proj.x += proj.vx * h;
    proj.y += proj.vy * h;
    if (hitSomething()) return;
  }
  // it turns over in the air -- the dynamite end over end, faster than a ball
  proj.spin += dt * (proj.item.id === 'tnt' ? 14 : proj.item.id === 'rock' ? 9 : 6) * Math.sign(proj.vx || 1);
  proj.body?.setPosition(proj.x, proj.y);
  proj.core?.setRotation(proj.spin);
  const glow = proj.body?.getAt(0) as Phaser.GameObjects.Arc | undefined;
  glow?.setScale(1 + Math.sin(proj.spin * 1.7) * 0.15);
  proj.trailT -= dt * 1000;
  if (proj.trailT <= 0) {
    proj.trailT = 16;
    trailMote(proj);
  }
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
    splinters(proj.x, proj.y, proj.vx > 0 ? -1 : 1);
    if (proj.item.id === 'tnt') explode(proj.x, proj.y, 0.6);
    else burst(proj.x, proj.y, proj.item, 0.6);
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
    if (proj.item.id === 'tnt') explode(proj.x, GROUND_Y - 4, 0.6);
    else burst(proj.x, GROUND_Y - 3, proj.item, 0.5);
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
  if (item.dmg > 0) floatText(tx, GROUND_Y - 34, `-${item.dmg}`, item.id === 'tnt' ? PALETTE.ember : PALETTE.cream);

  if (item.heal > 0) {
    // It still lands on him, and it still hurts him — it just does the thrower
    // more good than it does him harm.
    const before = sides[thrower].hp;
    sides[thrower].hp = Math.min(MAX_HP, sides[thrower].hp + item.heal);
    healStream(tx, hx, Math.round(sides[thrower].hp - before), sides[thrower].sprite);
    burst(proj.x, proj.y, item, 1);
    audio.sfx('heal_up');
  } else if (item.poison > 0) {
    sides[target].poison = item.poison;
    floatText(tx, GROUND_Y - 44, 'POISONED', 0x9b6fe0);
    skullSmoke(tx, 1);
    audio.sfx('poison_hiss');
  } else if (item.sleep > 0) {
    sides[target].sleep = item.sleep;
    floatText(tx, GROUND_Y - 44, 'FAST ASLEEP', 0x8aa8ff);
    audio.sfx('heal_up', 0.4);
    impactSleep(tx);
    burst(proj.x, proj.y, item, 0.8);
  } else if (item.confuse > 0) {
    sides[target].confused = Math.max(sides[target].confused, item.confuse);
    floatText(tx, GROUND_Y - 44, 'CONFUSED', 0xff6fb4);
    audio.sfx('ui_blip');
    impactConfuse(tx);
    burst(proj.x, proj.y, item, 0.8);
  } else if (item.id === 'tnt') {
    audio.sfx('boom');
    scene0.cameras.main.shake(260, 0.011);
    explode(tx, GROUND_Y - 12, 1);
  } else {
    audio.sfx('item_thud');
    burst(proj.x, proj.y, item, 1);
  }

  const sprite = sides[target].sprite;
  if (sprite) scene0.tweens.add({ targets: sprite, x: sprite.x + (thrower === 'frog' ? 4 : -4), duration: 70, yoyo: true, repeat: 1 });

  banner(item.heal > 0 ? 'HEALING HIT' : item.poison > 0 ? 'POISON LANDS' : item.sleep > 0 ? 'SLEEP BALL LANDS' : item.confuse > 0 ? 'CONFUSION BALL LANDS' : 'DIRECT HIT', item.id === 'sleep' ? 0x8aa8ff : item.color);
  endFlight(true);
}

/** The sleep ball bursts: a dark blue cloud, and Zs drifting up out of it. */
function impactSleep(x: number): void {
  if (!scene0) return;
  for (let i = 0; i < 8; i++) {
    const c = scene0.add.circle(x + (Math.random() - 0.5) * 22, GROUND_Y - 10 - Math.random() * 18, 3 + Math.random() * 3, i % 2 ? 0x2e4a9a : 0x4a66c0).setDepth(45).setAlpha(0.75);
    scene0.tweens.add({ targets: c, alpha: 0, scale: 1.8, y: c.y - 6, duration: 520, onComplete: () => c.destroy() });
  }
  for (let i = 0; i < 3; i++) {
    const z = text(scene0, x - 4 + i * 5, GROUND_Y - 26 - i * 4, 'Z', 0x8aa8ff).setDepth(46);
    scene0.tweens.add({ targets: z, y: z.y - 18, alpha: 0, delay: i * 120, duration: 700, onComplete: () => z.destroy() });
  }
}

/** The confusion ball bursts: a pink ring of stars spinning out. */
function impactConfuse(x: number): void {
  if (!scene0) return;
  const cy = GROUND_Y - 18;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const st = scene0.add.star(x, cy, 4, 1, 3, i % 2 ? 0xff6fb4 : 0xffe0f0).setDepth(45);
    scene0.tweens.add({ targets: st, x: x + Math.cos(a) * 20, y: cy + Math.sin(a) * 12, angle: 360, alpha: 0, duration: 600, onComplete: () => st.destroy() });
  }
}

/**
 * Over each side's eyes: shut lids and Zs while asleep, spinning pink spirals
 * while confused.  Drawn every frame, so the moment either wears off the eyes
 * are the ordinary eyes again.
 */
function drawStatus(delta: number): void {
  zzzT += delta;
  for (const who of ['frog', 'lizard'] as Who[]) {
    const s = sides[who];
    const g = s.status;
    if (!g) continue;
    g.clear();
    const sp = s.sprite;
    if (!sp) continue;
    const ox = sp.x;
    const oy = sp.y;
    // where the eyes are on each sprite (see makeFrog / makeLizard)
    const eyes = who === 'frog' ? [[-6, -23, 4], [6, -23, 4]] : [[-15, -16, 3.2]];
    if (s.sleep > 0) {
      for (const [ex, ey, r] of eyes) {
        // the lid, shut: the skin colour over the eye, and the line of it
        g.fillStyle(who === 'frog' ? PALETTE.mossLight : 0xc39a3e, 1).fillCircle(ox + ex, oy + ey, r + 0.5);
        g.fillStyle(PALETTE.black, 1).fillRect(ox + ex - r + 1, oy + ey, r * 2 - 2, 1);
      }
      // and the Zs, rising and fading, one after another
      for (let k = 0; k < 3; k++) {
        const t = ((zzzT / 1400 + k / 3) % 1);
        const zx = ox + (who === 'frog' ? 6 : -16) + t * 8;
        const zy = oy - 30 - t * 16;
        const zs = 2 + k;
        g.lineStyle(1, 0xc8d8ff, 1 - t);
        g.beginPath();
        g.moveTo(zx, zy);
        g.lineTo(zx + zs, zy);
        g.lineTo(zx, zy + zs);
        g.lineTo(zx + zs, zy + zs);
        g.strokePath();
      }
    } else if (s.confused > 0) {
      // spiral eyes, turning
      const turn = zzzT / 180;
      for (const [ex, ey, r] of eyes) {
        g.fillStyle(0xffffff, 1).fillCircle(ox + ex, oy + ey, r);
        g.lineStyle(1, 0xd02f86, 1);
        g.beginPath();
        for (let a = 0; a <= Math.PI * 4; a += 0.4) {
          const rr = (a / (Math.PI * 4)) * (r - 0.5);
          const px = ox + ex + Math.cos(a + turn) * rr;
          const py = oy + ey + Math.sin(a + turn) * rr;
          if (a === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }
      // and a little ring of stars round the head
      for (let k = 0; k < 3; k++) {
        const a = turn * 0.6 + (k / 3) * Math.PI * 2;
        g.fillStyle(0xff6fb4, 1).fillCircle(ox + Math.cos(a) * 9 + (who === 'frog' ? 0 : -12), oy - 30 + Math.sin(a) * 3, 1.2);
      }
    }
  }
}

// ------------------------------------------------------------------ effects
//
// WHAT IS THROWN LOOKS LIKE WHAT IT IS, and what lands says what it did.
// None of it touches a number: damage, health and status are all settled in
// `land` before any of this is drawn, and every effect is gone well inside
// the 900ms the turn waits before passing over.

/** The thing in the air: a soft glow of its colour, and the item, turning. */
function makeProjectile(scene: Phaser.Scene, item: ItemDef, x: number, y: number): { body: Phaser.GameObjects.Container; core: Phaser.GameObjects.Graphics } {
  const glowCol = item.id === 'rock' ? 0xffffff : item.id === 'tnt' ? 0xffb038 : item.id === 'sleep' ? 0x6a88e0 : item.color;
  const glow = scene.add.circle(0, 0, item.id === 'rock' ? 5 : 8, glowCol, item.id === 'rock' ? 0.12 : 0.32).setBlendMode(Phaser.BlendModes.ADD);
  const g = scene.add.graphics();
  const ink = PALETTE.ink;
  switch (item.id) {
    case 'rock': {
      const pts = [-3, -2, -1, -3.5, 2.5, -2.5, 3.5, 0.5, 1.5, 3, -2, 3, -3.5, 0.5];
      const poly = (c: number, k: number[]) => {
        g.fillStyle(c, 1).beginPath().moveTo(k[0], k[1]);
        for (let i = 2; i < k.length; i += 2) g.lineTo(k[i], k[i + 1]);
        g.closePath().fillPath();
      };
      g.fillStyle(ink, 1).fillCircle(0, 0, 4.3);
      poly(0x9aa4b0, pts);
      poly(0x6a7480, [1.5, 3, 3.5, 0.5, 1, 0.5, -2, 3]);
      poly(0xd0d6de, [-3, -2, -1, -3.5, 1, -2, -1.5, -0.5]);
      g.fillStyle(0x5a6470, 1).fillRect(0, -1, 1, 1).fillRect(-2, 1, 1, 1);
      break;
    }
    case 'heal':
      g.fillStyle(0x1e5a2e, 1).fillCircle(0, 0, 4.5);
      g.fillStyle(0x6fe08a, 1).fillCircle(0, 0, 3.6);
      g.fillStyle(0x3fae5a, 1).fillCircle(0.8, 1, 2.6);
      g.fillStyle(0x6fe08a, 1).fillCircle(-0.3, -0.3, 2.4);
      g.fillStyle(0xffffff, 1).fillRect(-0.5, -2.5, 1.5, 5).fillRect(-2.25, -0.75, 5, 1.5);
      g.fillStyle(0xd8ffe0, 1).fillRect(-3, -3, 1, 1);
      break;
    case 'tnt':
      g.fillStyle(ink, 1).fillRect(-5, -2.5, 10, 5);
      g.fillStyle(0xd94f2e, 1).fillRect(-4, -1.5, 8, 3);
      g.fillStyle(0xff8a5a, 1).fillRect(-4, -1.5, 8, 1);
      g.fillStyle(0x8a2a18, 1).fillRect(-4, 1, 8, 0.5);
      g.fillStyle(0x3a2716, 1).fillRect(-3, -1.5, 1, 3).fillRect(2, -1.5, 1, 3);
      g.fillStyle(PALETTE.cream, 1).fillRect(-1, -0.5, 2, 1);
      g.lineStyle(1, 0x6b4a2f, 1).lineBetween(4, 0, 6, -2);
      break;
    case 'poison':
      g.fillStyle(0x2a1040, 1).fillCircle(0, 0, 4.5);
      g.fillStyle(0x9b6fe0, 1).fillCircle(0, 0, 3.6);
      g.fillStyle(0x6a3fa0, 1).fillCircle(0.8, 1, 2.6);
      g.fillStyle(0x9b6fe0, 1).fillCircle(-0.4, -0.4, 2.2);
      // the skull on the label
      g.fillStyle(0xeadcff, 1).fillCircle(0, -0.4, 1.6).fillRect(-1, 0.6, 2, 1.2);
      g.fillStyle(0x2a1040, 1).fillRect(-1, -0.8, 0.8, 0.8).fillRect(0.3, -0.8, 0.8, 0.8);
      g.fillStyle(0xd8c0ff, 1).fillRect(-3, -3, 1, 1);
      break;
    case 'sleep':
      g.fillStyle(0xffffff, 1).fillCircle(0, 0, 5);
      g.fillStyle(0x2e4a9a, 1).fillCircle(0, 0, 4);
      g.fillStyle(0x4a66c0, 1).fillCircle(-0.8, -0.8, 2.6);
      // a crescent moon on it
      g.fillStyle(PALETTE.cream, 1).fillCircle(0.4, 0.2, 1.8);
      g.fillStyle(0x4a66c0, 1).fillCircle(1.2, -0.5, 1.6);
      break;
    case 'confuse':
      g.fillStyle(0xffffff, 1).fillCircle(0, 0, 5);
      g.fillStyle(0xff6fb4, 1).fillCircle(0, 0, 4);
      g.lineStyle(1, 0xffffff, 0.95).beginPath();
      for (let a = 0; a <= Math.PI * 3.5; a += 0.5) {
        const r = (a / (Math.PI * 3.5)) * 3;
        if (a === 0) g.moveTo(0, 0);
        else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.strokePath();
      break;
  }
  const body = scene.add.container(x, y, [glow, g]).setDepth(40);
  return { body, core: g };
}

/** One frame's worth of trail behind whatever is in the air. */
function trailMote(p: Projectile): void {
  const sc = scene0;
  if (!sc) return;
  const id = p.item.id;
  // the streak: the item's own colour, left where it was and shrinking away
  const streakCol = id === 'rock' ? 0xc8ced6 : id === 'tnt' ? 0xff9a3c : id === 'sleep' ? 0x6a88e0 : p.item.color;
  const st = sc.add.circle(p.x, p.y, id === 'rock' ? 1.6 : 2.4, streakCol, id === 'rock' ? 0.45 : 0.6).setDepth(39);
  if (id !== 'rock') st.setBlendMode(Phaser.BlendModes.ADD);
  sc.tweens.add({ targets: st, alpha: 0, scale: 0.2, duration: id === 'rock' ? 160 : 260, onComplete: () => st.destroy() });
  const r = Math.random();
  if (id === 'tnt') {
    // the fuse burns at the end of the stick, wherever it has turned to
    const fx = p.x + Math.cos(p.spin) * 6 + Math.sin(p.spin) * 2;
    const fy = p.y + Math.sin(p.spin) * 6 - Math.cos(p.spin) * 2;
    for (let i = 0; i < 2; i++) fling(sc, fx, fy, (Math.random() - 0.5) * 70, -Math.random() * 60, 200, i ? 0xffd45e : 0xfff0c9, 1, 220 + Math.random() * 120);
    if (r < 0.5) smoke(sc, fx, fy, 2, 0x7a7a80, 0.5, 520, 8);
  } else if (id === 'heal' && r < 0.35) {
    plus(sc, p.x + (Math.random() - 0.5) * 6, p.y + (Math.random() - 0.5) * 6, 0xb8ffc8, 0.9, 420);
  } else if (id === 'poison' && r < 0.5) {
    // drips and bubbles of it, falling off behind
    fling(sc, p.x, p.y + 2, (Math.random() - 0.5) * 20, 10 + Math.random() * 30, 260, r < 0.25 ? 0x6a3fa0 : 0xc8a0ff, 1.5, 380);
  } else if (id === 'sleep' && r < 0.6) {
    const d = sc.add.circle(p.x, p.y, 2.4, 0x4a66c0, 0.6).setDepth(39);
    sc.tweens.add({ targets: d, alpha: 0, scale: 1.8, y: p.y - 4, duration: 420, onComplete: () => d.destroy() });
  } else if (id === 'confuse' && r < 0.5) {
    const s2 = sc.add.star(p.x + (Math.random() - 0.5) * 8, p.y + (Math.random() - 0.5) * 8, 4, 0.8, 2.2, r < 0.25 ? 0xffe0f0 : 0xff6fb4).setDepth(39);
    sc.tweens.add({ targets: s2, angle: 180, alpha: 0, scale: 0.3, duration: 380, onComplete: () => s2.destroy() });
  } else if (id === 'rock' && r < 0.25) {
    fling(sc, p.x, p.y, (Math.random() - 0.5) * 20, Math.random() * 20, 200, 0xbfa07a, 1, 260);
  }
}

/** A bit of something thrown off at (vx, vy), falling under `grav` and fading. */
function fling(sc: Phaser.Scene, x: number, y: number, vx: number, vy: number, grav: number, col: number, size: number, ms: number, spin = false): void {
  const o = sc.add.rectangle(x, y, size, size, col).setDepth(45);
  sc.tweens.addCounter({
    from: 0,
    to: ms / 1000,
    duration: ms,
    onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      o.setPosition(x + vx * t, Math.min(GROUND_Y + 2, y + vy * t + 0.5 * grav * t * t));
      o.setAlpha(1 - (t * 1000) / ms);
      if (spin) o.setRotation(t * 14);
    },
    onComplete: () => o.destroy(),
  });
}

/** A puff of smoke that rises, spreads and thins out. */
function smoke(sc: Phaser.Scene, x: number, y: number, r: number, col: number, a: number, ms: number, rise: number, delay = 0): void {
  const c = sc.add.circle(x, y, r, col, a).setDepth(44);
  sc.tweens.add({ targets: c, y: y - rise, x: x + (Math.random() - 0.5) * rise * 0.5, scale: 2.4, alpha: 0, delay, duration: ms, ease: 'Sine.easeOut', onComplete: () => c.destroy() });
}

/** A little glowing plus sign, drifting up. */
function plus(sc: Phaser.Scene, x: number, y: number, col: number, scale: number, ms: number): void {
  const g = sc.add.graphics({ x, y }).setDepth(46).setScale(scale);
  g.fillStyle(0x1e5a2e, 1).fillRect(-1.5, -3.5, 3, 7).fillRect(-3.5, -1.5, 7, 3);
  g.fillStyle(col, 1).fillRect(-0.5, -2.5, 1, 5).fillRect(-2.5, -0.5, 5, 1);
  sc.tweens.add({ targets: g, y: y - 14, alpha: 0, duration: ms, ease: 'Sine.easeOut', onComplete: () => g.destroy() });
}

/** Contact: a flash of the item's colour, a ring going out, and bits of it. */
function burst(x: number, y: number, item: ItemDef, k: number): void {
  const sc = scene0;
  if (!sc) return;
  const col = item.id === 'rock' ? 0xd0d6de : item.id === 'sleep' ? 0x6a88e0 : item.color;
  const fl = sc.add.circle(x, y, 4, 0xffffff, 0.9).setDepth(46).setBlendMode(Phaser.BlendModes.ADD);
  sc.tweens.add({ targets: fl, scale: 2.6 * k, alpha: 0, duration: 180, onComplete: () => fl.destroy() });
  const ring = sc.add.circle(x, y, 3, col, 0).setStrokeStyle(1, col).setDepth(46);
  sc.tweens.add({ targets: ring, radius: 16 * k, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
  const n = Math.round(8 * k);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const sp = 50 + Math.random() * 60;
    fling(sc, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 40, 260, i % 2 ? col : 0xffffff, item.id === 'rock' ? 2 : 1.5, 360 + Math.random() * 160, item.id === 'rock');
  }
}

/** Wood flying off the fence. */
function splinters(x: number, y: number, dir: number): void {
  const sc = scene0;
  if (!sc) return;
  for (let i = 0; i < 7; i++) fling(sc, x, y, dir * (30 + Math.random() * 70), -40 - Math.random() * 80, 380, i % 2 ? 0x9c7248 : 0xd0a070, 2, 520 + Math.random() * 200, true);
}

/**
 * DYNAMITE GOES OFF: the whole screen flashes, a fireball swells and burns
 * out, a shockwave rings out across the lawn, debris and sparks fly and fall,
 * and the smoke hangs and drifts up after it, over a scorch on the grass.
 */
function explode(x: number, y: number, k: number): void {
  const sc = scene0;
  if (!sc) return;
  const flash = sc.add.rectangle(0, 0, GAME_W, GAME_H, 0xfff6d0, 0.8 * k).setOrigin(0, 0).setDepth(55);
  sc.tweens.add({ targets: flash, alpha: 0, duration: 240, onComplete: () => flash.destroy() });
  for (const [r, col, sc2, ms] of [[13, 0xd94f2e, 2.2, 560], [10, 0xffb038, 2.4, 420], [6, 0xffffff, 3, 260]] as const) {
    const f = sc.add.circle(x, y, r * k, col, 0.95).setDepth(47).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3);
    sc.tweens.add({ targets: f, scale: sc2, alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => f.destroy() });
  }
  for (const [w, d] of [[2, 0], [1, 90]] as const) {
    const ring = sc.add.circle(x, y, 4, 0xfff0c9, 0).setStrokeStyle(w, 0xfff0c9).setDepth(47);
    sc.tweens.add({ targets: ring, radius: 52 * k, alpha: 0, delay: d, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }
  const debris = [0x3a2716, 0x6b4a2f, PALETTE.ember, 0xd94f2e, 0x4a8a3a];
  for (let i = 0; i < Math.round(18 * k); i++) {
    const a = -Math.PI * (0.1 + Math.random() * 0.8);
    const sp = 90 + Math.random() * 150;
    fling(sc, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 520, debris[i % debris.length], 2 + (i % 2), 700 + Math.random() * 400, true);
  }
  for (let i = 0; i < Math.round(14 * k); i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 120 + Math.random() * 120;
    fling(sc, x, y, Math.cos(a) * sp, Math.sin(a) * sp, 160, i % 2 ? 0xffd45e : 0xffffff, 1, 260 + Math.random() * 200);
  }
  for (let i = 0; i < Math.round(10 * k); i++) {
    const c = i % 3 === 0 ? 0x3a3a40 : i % 3 === 1 ? 0x5a5a60 : 0x7a7a80;
    smoke(sc, x + (Math.random() - 0.5) * 26 * k, y + (Math.random() - 0.5) * 12, 4 + Math.random() * 3, c, 0.75, 1300 + Math.random() * 500, 22 + Math.random() * 18, 100 + i * 30);
  }
  if (y > GROUND_Y - 24) {
    const scorch = sc.add.ellipse(x, GROUND_Y + 1, 36 * k, 5, 0x1a1208, 0.55).setDepth(19);
    sc.tweens.add({ targets: scorch, alpha: 0, delay: 900, duration: 1600, onComplete: () => scorch.destroy() });
  }
}

/**
 * THE HEAL GOES HOME.  The ball bursts green on whoever it hit, and the good
 * in it streams back over the fence to the one who threw it: a column of
 * light comes down on them, a ring opens at their feet, plus signs rise off
 * them, they swell for a beat -- and the number lands on them, not him.
 */
function healStream(fromX: number, toX: number, amount: number, sprite: Phaser.GameObjects.Container | null): void {
  const sc = scene0;
  if (!sc) return;
  const y0 = GROUND_Y - 18;
  const TRAVEL = 520;
  for (let i = 0; i < 12; i++) {
    const m = sc.add.circle(fromX, y0, i % 3 ? 2.2 : 3.2, i % 3 === 1 ? 0xd8ffe0 : 0x6fe08a, 1).setDepth(46).setStrokeStyle(1, 0x1e5a2e, 0.8);
    let last = 0;
    sc.tweens.addCounter({
      from: 0,
      to: 1,
      delay: i * 40,
      duration: TRAVEL,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        // over the top of the fence, wobbling a little
        m.setPosition(fromX + (toX - fromX) * t, y0 - Math.sin(Math.PI * t) * 66 + Math.sin(t * 12 + i) * 2);
        // and the lead mote leaves a glittering green wake the whole way
        if (i % 4 === 0 && t - last > 0.04) {
          last = t;
          const w = sc.add.circle(m.x, m.y, 2, 0x6fe08a, 0.8).setDepth(45).setBlendMode(Phaser.BlendModes.ADD);
          sc.tweens.add({ targets: w, alpha: 0, scale: 0.3, duration: 360, onComplete: () => w.destroy() });
        }
      },
      onComplete: () => m.destroy(),
    });
  }
  sc.time.delayedCall(TRAVEL + 120, () => {
    if (!scene0) return;
    const col = sc.add.rectangle(toX, GROUND_Y, 26, 70, 0x6fe08a, 0).setOrigin(0.5, 1).setDepth(44).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: col, alpha: 0.4, duration: 140, yoyo: true, hold: 260, onComplete: () => col.destroy() });
    const ring = sc.add.ellipse(toX, GROUND_Y, 10, 3, 0x6fe08a, 0).setStrokeStyle(1, 0xb8ffc8).setDepth(44);
    sc.tweens.add({ targets: ring, scaleX: 4, scaleY: 3, alpha: 0, duration: 520, onComplete: () => ring.destroy() });
    const aura = sc.add.circle(toX, GROUND_Y - 14, 15, 0x6fe08a, 0.5).setDepth(22).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: aura, alpha: 0, scale: 1.4, duration: 600, onComplete: () => aura.destroy() });
    for (let i = 0; i < 7; i++) sc.time.delayedCall(i * 60, () => scene0 && plus(sc, toX + (Math.random() - 0.5) * 22, GROUND_Y - 8 - Math.random() * 20, 0xb8ffc8, 1, 620));
    if (sprite) sc.tweens.add({ targets: sprite, scaleX: 1.12, scaleY: 1.12, duration: 110, yoyo: true });
    floatText(toX, GROUND_Y - 44, `+${amount}`, 0x6fe08a, 16);
  });
}

/**
 * POISONED: purple smoke boils up off whoever it hit and gathers into a
 * skull over their head, which leers for a moment and drifts away.  Smaller,
 * at the top of each turn the poison bites again.
 */
function skullSmoke(x: number, k: number): void {
  const sc = scene0;
  if (!sc) return;
  const cols = [0x4a2a70, 0x6a3fa0, 0x9b6fe0];
  for (let i = 0; i < Math.round(12 * k); i++) {
    smoke(sc, x + (Math.random() - 0.5) * 22, GROUND_Y - 6 - Math.random() * 16, 3 + Math.random() * 2, cols[i % 3], 0.7, 900 + Math.random() * 400, 18 + Math.random() * 14, i * 25);
  }
  const sy = GROUND_Y - 40;
  const g = sc.add.graphics({ x, y: sy }).setDepth(47).setAlpha(0).setScale(0.5 * k);
  // the smoke it is made of, round its edge
  g.fillStyle(0x6a3fa0, 0.55).fillCircle(-6, -2, 4).fillCircle(6, -2, 4).fillCircle(0, -7, 5).fillCircle(-4, 6, 3).fillCircle(4, 6, 3);
  // crossbones behind it
  g.lineStyle(2, 0xc8a0ff, 0.9).lineBetween(-9, -6, 9, 10).lineBetween(9, -6, -9, 10);
  g.fillStyle(0xc8a0ff, 0.9).fillCircle(-9, -6, 1.6).fillCircle(9, -6, 1.6).fillCircle(9, 10, 1.6).fillCircle(-9, 10, 1.6);
  // the skull
  g.fillStyle(0xeadcff, 0.95).fillCircle(0, -1, 6.5).fillRect(-4, 3, 8, 4);
  g.fillStyle(0x2a1040, 1).fillCircle(-2.6, -1, 1.9).fillCircle(2.6, -1, 1.9);
  g.fillTriangle(0, 1.5, -1, 3.2, 1, 3.2);
  g.fillRect(-3, 5, 1, 2).fillRect(-1, 5, 1, 2).fillRect(1, 5, 1, 2);
  g.fillStyle(0xb080ff, 1).fillCircle(-2.6, -1, 0.8).fillCircle(2.6, -1, 0.8);
  sc.tweens.add({
    targets: g,
    alpha: 1,
    scale: 1.3 * k,
    duration: 260,
    ease: 'Back.easeOut',
    onComplete: () => {
      sc.tweens.add({ targets: g, y: sy - 18, x: x + 3, alpha: 0, scale: k * 1.6, delay: 260, duration: 800, ease: 'Sine.easeIn', onComplete: () => g.destroy() });
    },
  });
}

/** Four pink mini balls from (x, y) back to `who`, 1 damage each as they land. */
function miniBalls(who: Who, x: number, y: number): void {
  const sc = scene0;
  if (!sc) return;
  const tx = who === 'frog' ? FROG_X : LIZARD_X;
  banner('CONFUSED - IT COMES BACK!', 0xff6fb4);
  for (let i = 0; i < 4; i++) {
    const b = sc.add.circle(x, y, 2, 0xff6fb4).setStrokeStyle(1, 0xffd0e8).setDepth(46);
    const ox = (i - 1.5) * 6;
    const peak = Math.min(y, GROUND_Y - 30) - 16 - i * 4;
    sc.tweens.addCounter({
      from: 0,
      to: 1,
      delay: i * 140,
      duration: 650,
      ease: 'Sine.easeIn',
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        b.x = x + (tx + ox - x) * k;
        b.y = (1 - k) * (1 - k) * y + 2 * (1 - k) * k * peak + k * k * (GROUND_Y - 14);
      },
      onComplete: () => {
        b.destroy();
        if (phase === 'over' || phase === 'roundEnd') return;
        const s = sides[who];
        s.hp = Math.max(0, s.hp - 1);
        floatText(tx + ox, GROUND_Y - 30, '-1', 0xff6fb4);
        audio.sfx('ui_blip', 0.4);
        refreshHud();
        if (i === 3 && (sides.frog.hp <= 0 || sides.lizard.hp <= 0)) endRound();
      },
    });
  }
}

function puff(x: number, y: number): void {
  if (!scene0) return;
  const p = scene0.add.circle(x, y, 3, 0xbfa07a).setAlpha(0.7).setDepth(40);
  scene0.tweens.add({ targets: p, alpha: 0, scale: 1.8, duration: 300, onComplete: () => p.destroy() });
}

function endFlight(hit: boolean): void {
  const from = proj?.from ?? null;
  const at = proj ? { x: proj.x, y: Math.min(proj.y, GROUND_Y - 4) } : null;
  proj?.body?.destroy();
  proj = null;
  refreshHud();
  if (!hit) banner('MISS', PALETTE.fog);
  // ---- A CONFUSED MISS COMES BACK.  The throw breaks into four little pink
  // balls that fly home to whoever threw it, one damage each.
  if (!hit && from && at && windHidden && sides[from].confused > 0) {
    miniBalls(from, at.x, at.y);
    phase = 'settle';
    settleMs = 1500;
    return;
  }
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
  heldIcon?.clear();
  if (phase !== 'aim' || turn !== 'frog') return;
  // the thing about to be thrown, held up in the frog's hand
  if (heldIcon) drawItemIcon(heldIcon, sel, FROG_X + HAND.dx - 4, GROUND_Y + HAND.dy - 12);

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
function solveThrow(who: Who, w: number = wind): { angle: number; power: number } {
  let bestAngle = who === 'frog' ? -Math.PI / 4 : Math.PI + Math.PI / 4;
  let bestPow = 0.6;
  let bestMiss = Infinity;
  for (let elev = 0.12; elev <= 1.42; elev += 0.045) {
    const angle = who === 'frog' ? -elev : Math.PI + elev;
    for (let pow = 0.1; pow <= 1.0001; pow += 0.035) {
      const r = simulate(who, angle, pow, w);
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
  // put you to sleep while there is a fight left to win off it
  if (you.sleep === 0 && me.stock.sleep > 0 && me.hp < MAX_HP * 0.8) return 'sleep';
  // and take the wind away from you on a day it matters
  if (you.confused === 0 && me.stock.confuse > 0 && Math.abs(wind) > 0.3) return 'confuse';
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
      // (confused, he cannot read the wind: he throws as if the air were still)
      const plan = solveThrow('lizard', windHidden ? 0 : wind);
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
  banner(
    ROUNDS > 1
      ? winner === 'frog'
        ? `ROUND ${round} IS YOURS`
        : `ROUND ${round} TO THE LIZARD`
      : winner === 'frog'
        ? 'HE IS DOWN'
        : 'YOU ARE DOWN',
    winner === 'frog' ? PALETTE.gold : PALETTE.neon,
  );
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
      sides[who].sleep = 0;
      sides[who].confused = 0;
      sides[who].stock = fullStock();
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
  // A dead heat is a tie: the tokens come back, the same as the bowling lane.
  const won =
    roundsWon.frog > roundsWon.lizard ||
    (roundsWon.frog === roundsWon.lizard && sides.frog.dealt > sides.lizard.dealt);
  const drawn = roundsWon.frog === roundsWon.lizard && sides.frog.dealt === sides.lizard.dealt;

  if (store.setHighScore(ID, sides.frog.dealt)) best = sides.frog.dealt;
  apiRef?.record(sides.frog.dealt);
  // UNTOUCHABLE: the match won without the lizard landing a thing on you --
  // no hit, no splash, no poison tick, across every round (log #58)
  if (won && sides.lizard.dealt === 0) apiRef?.badge('m_fence');
  refreshHud();
  const score = ROUNDS > 1 ? ` ${roundsWon.frog}-${roundsWon.lizard}` : '';
  const line = drawn
    ? 'DEAD HEAT - TOKENS BACK'
    : won
      ? `YOU WIN${score}`
      : `THE LIZARD WINS${ROUNDS > 1 ? ` ${roundsWon.lizard}-${roundsWon.frog}` : ''}`;
  centerText(scene0, GAME_W / 2, 96, line, won ? PALETTE.gold : PALETTE.fog, 16).setDepth(80);
  centerText(scene0, GAME_W / 2, 112, `DAMAGE ${sides.frog.dealt} - ${sides.lizard.dealt}   BEST ${best}`, PALETTE.ash).setDepth(80);
  scene0.time.delayedCall(1700, () => (won ? apiRef?.win() : drawn ? apiRef?.draw() : apiRef?.lose()));
}
