/**
 * FROGSTER MASH.  Fifteen tokens in, thirty out.
 *
 * Four chests, and then you watch.
 *
 * The player opens a weapon chest and three armour chests -- head, body,
 * legs -- and takes what is in them.  That is the whole of the input.  The
 * two fighters then walk into a colosseum and settle it themselves, in real
 * time, under rules neither of them is allowed to bend.
 *
 * THE FIGHT IS A SIMULATION, NOT A SET OF BUTTONS.  `think` is the only
 * thing that decides what a fighter does, `resolveStrike` is the only thing
 * that takes health off anybody, and BOTH FIGHTERS RUN THE SAME COPY OF
 * BOTH.  There is no difficulty knob, no hidden bonus on the lizard and no
 * hand on the scales: the result falls out of thirteen weapons, three
 * armour slots and the numbers the chests happened to contain.
 *
 * WHICH MEANS THE CHESTS ARE THE GAME.  A gold sword hits like a truck and
 * leaves you too slow to land it.  A staff wins by never letting anything
 * close.  Steel plate stops damage and costs the speed that would have
 * avoided it.  Every one of those is a decision made at a chest and paid for
 * ninety seconds later by somebody you are not allowed to help.
 *
 * NOTHING IN HERE TOUCHES THE LEDGER.  The shell charged the fifteen when the
 * player pressed PLAY on the how-to card and it pays the thirty on `api.win`,
 * once, guarded by its own latch -- this file only ever says which of the two
 * happened, and says it exactly once (`ended`).
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

// ================================================================ equipment

export type Slot = 'weapon' | 'head' | 'body' | 'legs';
const ORDER: Slot[] = ['weapon', 'head', 'body', 'legs'];
const SLOT_NAME: Record<Slot, string> = {
  weapon: 'WEAPON',
  head: 'HEAD ARMOUR',
  body: 'BODY ARMOUR',
  legs: 'LOWER BODY ARMOUR',
};

/**
 * One weapon, and the shape of the rolls it makes.
 *
 * Nothing here is the weapon's actual numbers.  Every weapon rolls four stats
 * on a one-to-ten scale the moment it comes out of a chest -- HEAVINESS,
 * POWER, RESISTANCE, REACH -- so no two daggers are the same dagger and no
 * two fights start from the same place.  What keeps a dagger a dagger is the
 * band it rolls inside: its reach is one to three whatever it rolls, and a
 * scythe's is eight to ten, so the shape of the thing survives the dice.
 *
 * `tempo` is the one number that is not rolled, because it is not a quality a
 * weapon has more or less of -- it is what the weapon IS.  Knuckles are fast
 * and an axe is slow, and no roll should ever turn one into the other.
 */
export interface WeaponDef {
  key: string;
  name: string;
  /** Inclusive [min, max] on the one-to-ten scale. */
  power: Band;
  heavy: Band;
  resist: Band;
  reach: Band;
  /** Strikes thrown inside one swing: two for dual swords and nunchucks. */
  hits: number;
  /** Damage turned aside simply by being carried.  The shield, and only it. */
  guard: number;
  /** Swings a second at full speed.  Fixed: this is the weapon's character. */
  tempo: number;
}
export type Band = readonly [number, number];

// The tempo column is not hand-picked.  Every weapon was run head to head
// against all the others over identical armour and its tempo nudged toward an
// even split, twelve passes, until the worst of them sat inside a few points
// of fifty percent.  NO WEAPON is deliberately left out of that sweep: an
// empty chest is meant to be the worst row on the table, and it wins about a
// fifth of its fights, which is the right amount of "not hopeless".
//
// Change a band, `hits`, or the reach maths and the tempo beside it is stale.
// Re-run the sweep rather than guessing at a new one.
export const WEAPONS: WeaponDef[] = [
  // ---- NOTHING AT ALL.  A real outcome, not a fallback: a chest can be
  // empty, and an empty chest is the one that makes the others worth opening.
  { key: 'none', name: 'NO WEAPON', power: [1, 2], heavy: [1, 1], resist: [10, 10], reach: [1, 2], hits: 1, guard: 0, tempo: 1.05 },
  // ---- IN CLOSE.  Nothing to speak of in the hand, and quick enough that it
  // does not matter, provided it can get there.
  { key: 'knuckles', name: 'BRASS KNUCKLES', power: [2, 4], heavy: [1, 2], resist: [7, 10], reach: [1, 2], hits: 1, guard: 0, tempo: 1.32 },
  { key: 'dagger', name: 'SHORT DAGGER', power: [2, 4], heavy: [1, 2], resist: [5, 8], reach: [2, 3], hits: 1, guard: 0, tempo: 1.34 },
  { key: 'knife', name: 'TACTICAL KNIFE', power: [3, 5], heavy: [1, 2], resist: [5, 8], reach: [2, 4], hits: 1, guard: 0, tempo: 1.06 },
  // ---- TWO AT A TIME.
  { key: 'nunchuck', name: 'NUNCHUCKS', power: [2, 4], heavy: [2, 3], resist: [3, 6], reach: [4, 6], hits: 2, guard: 0, tempo: 2.17 },
  { key: 'dual', name: 'DUAL SWORDS', power: [3, 5], heavy: [2, 4], resist: [4, 7], reach: [5, 7], hits: 2, guard: 0, tempo: 1.0 },
  // ---- THE MIDDLE OF THE RACK.
  { key: 'sword', name: 'SWORD', power: [4, 7], heavy: [3, 5], resist: [6, 9], reach: [5, 7], hits: 1, guard: 0, tempo: 0.67 },
  { key: 'katana', name: 'KATANA', power: [5, 8], heavy: [3, 5], resist: [5, 8], reach: [6, 8], hits: 1, guard: 0, tempo: 0.51 },
  { key: 'shield', name: 'SPIKED SHIELD', power: [3, 5], heavy: [5, 7], resist: [8, 10], reach: [2, 4], hits: 1, guard: 0.3, tempo: 0.63 },
  // ---- LONG.
  { key: 'staff', name: 'LONG STICK', power: [3, 6], heavy: [3, 5], resist: [5, 8], reach: [8, 10], hits: 1, guard: 0, tempo: 0.59 },
  // ---- HEAVY.  Everything they take, they take off the swing and the feet.
  { key: 'axe', name: 'AXE', power: [7, 10], heavy: [6, 8], resist: [5, 8], reach: [5, 7], hits: 1, guard: 0, tempo: 0.49 },
  { key: 'flail', name: 'BALL AND CHAIN', power: [6, 9], heavy: [6, 8], resist: [4, 7], reach: [7, 9], hits: 1, guard: 0, tempo: 0.46 },
  { key: 'scythe', name: 'SCYTHE', power: [6, 9], heavy: [5, 8], resist: [3, 6], reach: [8, 10], hits: 1, guard: 0, tempo: 0.4 },
  { key: 'goldsword', name: 'GOLD SWORD', power: [8, 10], heavy: [7, 9], resist: [6, 9], reach: [6, 8], hits: 1, guard: 0, tempo: 0.35 },
];

/** Bare hands, for a weapon that has broken.  The same row as an empty chest. */
export const UNARMED: WeaponDef = WEAPONS[0];

/**
 * A suit of armour, as a share of damage it turns aside.
 *
 * Defence is quoted for a WHOLE suit.  A single piece only covers its own
 * part of a body, so it carries its share of that and no more -- an iron helm
 * is a quarter of an iron suit, not a whole one.  See `COVER`.
 */
export interface ArmourMat {
  key: string;
  name: string;
  /** Share of damage a full suit of it turns aside, 0..1. */
  def: number;
  /** Chance a full suit of it avoids a blow outright.  Tactical, and only it. */
  evade: number;
  heavy: Band;
  resist: Band;
  colour: number;
  edge: number;
  /** The one line that says what it is for, when the numbers do not. */
  note: string;
}
export const MATERIALS: ArmourMat[] = [
  { key: 'none', name: 'NO ARMOUR', def: 0, evade: 0, heavy: [1, 1], resist: [10, 10], colour: 0x6d5a45, edge: 0x4a3c2d, note: 'NOTHING THERE, AND NOTHING TO CARRY' },
  { key: 'tuxedo', name: 'TUXEDO', def: 0.05, evade: 0, heavy: [1, 2], resist: [2, 4], colour: 0x2a2d3a, edge: 0xdfe4ee, note: 'FIVE PERCENT DEFENCE. THE REST IS FASHION' },
  { key: 'leather', name: 'LEATHER ARMOUR', def: 0.10, evade: 0, heavy: [2, 4], resist: [5, 7], colour: 0x9c7248, edge: 0x5d4028, note: 'LIGHT, AND ABOUT AS USEFUL AS THAT SOUNDS' },
  { key: 'tactical', name: 'TACTICAL ARMOUR', def: 0.10, evade: 0.25, heavy: [2, 4], resist: [6, 8], colour: 0x3f4a3a, edge: 0x22281f, note: 'STOPS LITTLE. MUCH HARDER TO HIT' },
  { key: 'tin', name: 'TIN ARMOUR', def: 0.15, evade: 0, heavy: [3, 5], resist: [3, 5], colour: 0xb9c2c8, edge: 0x6d767c, note: 'CHEAP, LOUD, AND BETTER THAN A SHIRT' },
  { key: 'chain', name: 'CHAIN ARMOUR', def: 0.20, evade: 0, heavy: [4, 6], resist: [6, 8], colour: 0x8e9cad, edge: 0x4a5665, note: 'THE HONEST MIDDLE OF THE RACK' },
  { key: 'iron', name: 'IRON ARMOUR', def: 0.25, evade: 0, heavy: [6, 8], resist: [7, 9], colour: 0x6f7682, edge: 0x3a4149, note: 'HEAVY, AND WORTH IT' },
  { key: 'gold', name: 'GOLD ARMOUR', def: 0.30, evade: 0, heavy: [7, 9], resist: [4, 6], colour: 0xffd45e, edge: 0xa8801e, note: 'THE BEST THERE IS, AND THE SLOWEST' },
];

/**
 * How much of a body each slot is, and so what share of a suit it carries.
 *
 * The body is the heaviest of the three by some way, which is what makes a
 * breastplate a decision and a helmet an easy yes.
 */
const SLOT_BULK: Record<'head' | 'body' | 'legs', number> = { head: 0.7, body: 1.25, legs: 0.85 };
const SUIT_BULK = SLOT_BULK.head + SLOT_BULK.body + SLOT_BULK.legs;
const COVER: Record<'head' | 'body' | 'legs', number> = {
  head: SLOT_BULK.head / SUIT_BULK,
  body: SLOT_BULK.body / SUIT_BULK,
  legs: SLOT_BULK.legs / SUIT_BULK,
};
const PIECE_NAME: Record<'head' | 'body' | 'legs', string> = { head: 'HELM', body: 'CUIRASS', legs: 'GREAVES' };

/** Kept so the old saves and the old tests still read: 1..5 -> a multiplier. */
export const QUALITY_MUL = [0, 0.8, 0.9, 1.0, 1.1, 1.2];

/** One roll on the one-to-ten scale, inside the band a piece allows. */
export function roll(band: Band, rng: (() => number) | Math['random'] = Math.random): number {
  const [lo, hi] = band;
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/**
 * What came out of a chest.
 *
 * The four rolled stats live here rather than on the definition, because the
 * definition is shared by every copy of that weapon and these are this one's.
 */
export interface Piece {
  slot: Slot;
  name: string;
  /** Weapons only. */
  weapon?: WeaponDef;
  /** Armour only. */
  mat?: ArmourMat;
  /** The four on the sheet, 1..10. */
  rPower: number;
  rHeavy: number;
  rResist: number;
  rReach: number;
  /** Kept for the old card layout and the dev bridge. */
  quality: number;
  prot: number;
  heavy: number;
}

export function makeWeapon(def: WeaponDef, rng: (() => number) | Math['random'] = Math.random): Piece {
  const rPower = roll(def.power, rng);
  const rHeavy = roll(def.heavy, rng);
  const rResist = roll(def.resist, rng);
  const rReach = roll(def.reach, rng);
  return {
    slot: 'weapon', name: def.name, weapon: def,
    rPower, rHeavy, rResist, rReach,
    quality: Math.max(1, Math.min(5, Math.round((rPower + rResist) / 4))),
    prot: 0, heavy: rHeavy,
  };
}

export function makeArmour(slot: 'head' | 'body' | 'legs', mat: ArmourMat, rng: (() => number) | Math['random'] = Math.random): Piece {
  const rHeavy = roll(mat.heavy, rng);
  const rResist = roll(mat.resist, rng);
  return {
    slot,
    name: mat.key === 'none' ? `NO ${PIECE_NAME[slot]}` : `${mat.name} ${PIECE_NAME[slot]}`,
    mat,
    rPower: 0, rHeavy, rResist, rReach: 0,
    quality: Math.max(1, Math.min(5, Math.round(rResist / 2))),
    // What this ONE piece turns aside: its material's suit figure, times the
    // share of a body it actually covers.
    prot: mat.def * COVER[slot] * 100,
    heavy: rHeavy * SLOT_BULK[slot],
  };
}

export interface Kit {
  weapon: Piece;
  head: Piece;
  body: Piece;
  legs: Piece;
}

/**
 * FROGGY, WITH NOTHING ON.
 *
 * Power 10, Speed 100, Avoidance 50, Distance 20.  Everything a chest gives
 * him is measured against these four and nothing else.
 */
export const BASE = { power: 10, speed: 100, avoid: 50, distance: 20 } as const;
/** Health before any armour, and what a point of suit resistance adds to it. */
const BASE_HP = 88;
const HP_PER_RESIST = 6.5;
/** A point of rolled weapon power, in damage. */
const POWER_PER_ROLL = 2.8;
/** A point of rolled reach, in pixels past the base distance. */
const PX_PER_REACH = 3.4;
/** Full load -- every piece at ten and the heaviest weapon -- for scaling. */
const LOAD_FULL = 10 * SUIT_BULK + 10;
/** What a full load costs, as a share of speed and of avoidance. */
const LOAD_ON_SPEED = 0.6;
const LOAD_ON_AVOID = 0.62;
/** Walking pace at a hundred speed. */
const PX_PER_SPEED = 0.46;
/** Swings a weapon survives: eight, and four more for every point of resist. */
const DUR_BASE = 4;
const DUR_PER_RESIST = 2.2;

export interface Stats {
  /** Damage one strike is worth. */
  power: number;
  /** Strikes a second. */
  rate: number;
  walk: number;
  /** Chance to slip a blow entirely, 0..1. */
  avoid: number;
  /** Share of damage the suit turns aside, 0..1. */
  defence: number;
  maxHp: number;
  /** How far away a strike still connects, and where it wants to stand. */
  reach: number;
  range: number;
  guard: number;
  /** The four headline numbers, on their own scales, for the sheet. */
  powerPts: number;
  speedPts: number;
  avoidPts: number;
  distPts: number;
}

/**
 * What a kit is worth, and the only place equipment turns into numbers.
 *
 * Weight is the spine of it.  A heavy weapon slows the swing AND the walk; a
 * heavy suit slows the walk AND takes the edge off avoiding anything.  That
 * is why the biggest weapon in the game is not simply the best one: it buys
 * damage with the two things that get damage delivered.
 */
export function statsOf(kit: Kit, weapon: WeaponDef, wRolls?: Piece): Stats {
  const w = wRolls ?? kit.weapon;
  const suitHeavy = kit.head.heavy + kit.body.heavy + kit.legs.heavy;
  const load = suitHeavy + w.rHeavy;
  // Defence and evasion are quoted per suit; each piece brought its own share.
  const defence = Math.min(0.75, (kit.head.prot + kit.body.prot + kit.legs.prot) / 100);
  const evade = (['head', 'body', 'legs'] as const)
    .reduce((n, sl) => n + (kit[sl].mat?.evade ?? 0) * COVER[sl], 0);
  const resist = (['head', 'body', 'legs'] as const)
    .reduce((n, sl) => n + kit[sl].rResist * COVER[sl], 0);

  const speedPts = Math.max(18, BASE.speed * (1 - (load / LOAD_FULL) * LOAD_ON_SPEED));
  const avoidPts = Math.max(4, BASE.avoid * (1 - (suitHeavy / (10 * SUIT_BULK)) * LOAD_ON_AVOID) + evade * 100);
  const distPts = BASE.distance + w.rReach * PX_PER_REACH;

  // ---- A SWING IS A SWING, HOWEVER MANY TIMES IT LANDS.
  //
  // Froggy's ten points of base power are his, not the weapon's, so a weapon
  // that throws twice was collecting them twice: nunchucks and dual swords
  // came out at forty-three damage a second against a ball and chain's
  // fifteen, and took eight duels in ten.  The swing is worth what it is
  // worth and arrives in however many pieces the weapon deals in -- which is
  // still a real difference, because two smaller blows get past a guard
  // differently from one large one.
  const perStrike = (BASE.power + w.rPower * POWER_PER_ROLL) / weapon.hits;
  return {
    power: perStrike,
    rate: Math.max(0.3, weapon.tempo * (speedPts / 100)),
    walk: Math.max(14, speedPts * PX_PER_SPEED),
    avoid: Math.min(0.75, avoidPts / 100),
    defence,
    maxHp: Math.round(BASE_HP + resist * HP_PER_RESIST),
    reach: distPts,
    // It wants to stand a shade outside what it can hit with, and closes in.
    range: distPts + 2,
    guard: weapon.guard,
    powerPts: BASE.power + w.rPower * POWER_PER_ROLL,  // the sheet shows the whole swing
    speedPts,
    avoidPts,
    distPts,
  };
}

/** How many swings this weapon has in it before it can break. */
export function durabilityOf(w: Piece): number {
  if (!w.weapon || w.weapon.key === 'none') return Infinity;
  return DUR_BASE + w.rResist * DUR_PER_RESIST;
}

type Act = 'walk' | 'windup' | 'strike' | 'recover' | 'dodge' | 'guard' | 'stagger' | 'lunge';

export interface Fighter {
  who: 'frog' | 'lizard';
  kit: Kit;
  /** The weapon actually in hand: the kit's, until it breaks. */
  weapon: WeaponDef;
  /** The rolled piece actually in hand, which is where its four stats live. */
  held: Piece;
  broken: boolean;
  dur: number;
  st: Stats;
  hp: number;
  x: number;
  face: 1 | -1;
  act: Act;
  /** Seconds left in the current act. */
  t: number;
  /** Seconds until this fighter may start another swing. */
  cool: number;
  /** Which strike of a multi-hit swing is next. */
  swing: number;
  /**
   * THE THINGS THAT MAKE A FIGHT MOVE, and every one of them symmetric.
   *
   * `riposte`  a dodge landed, so the answer to it comes back fast
   * `chain`    strikes still owed on a combination
   * `desperate` under a quarter health: nothing left to save it for
   */
  riposte: boolean;
  chain: number;
  desperate: boolean;
  /** Seconds of being knocked about: it cannot act, and it shows. */
  stun: number;
  /** Walk cycle, so the legs move when it does. */
  step: number;
  /**
   * DRAWING ONLY, ALL THREE.  The eased arm and lean angles, so a swing is a
   * movement instead of two still frames, and the knock-back shove, so a blow
   * that lands moves the body it landed on.  None of it is ever read by the
   * rules: `shove` in particular is added at draw time and never to `x`,
   * because `x` is the fighting distance the balance was measured on.
   */
  armA: number;
  leanA: number;
  shove: number;
  art: FighterArt | null;
}

export function makeFighter(who: 'frog' | 'lizard', kit: Kit, x: number, face: 1 | -1): Fighter {
  const w = kit.weapon.weapon ?? UNARMED;
  const st = statsOf(kit, w, kit.weapon);
  return {
    who, kit, weapon: w, held: kit.weapon, broken: false, dur: durabilityOf(kit.weapon), st,
    hp: st.maxHp, x, face, act: 'walk', t: 0, cool: 0.4, swing: 0, stun: 0, step: 0,
    riposte: false, chain: 0, desperate: false,
    armA: -10, leanA: 0, shove: 0, art: null,
  };
}

/** Empty hands, rolled at nothing: what a broken weapon leaves behind. */
function emptyHands(): Piece {
  return { slot: 'weapon', name: 'BARE HANDS', weapon: UNARMED, rPower: 1, rHeavy: 1, rResist: 10, rReach: 1, quality: 3, prot: 0, heavy: 1 };
}

/** A weapon gives out.  Everything it was worth goes with it; the armour stays. */
export function breakWeapon(f: Fighter): void {
  f.broken = true;
  f.weapon = UNARMED;
  f.held = emptyHands();
  f.dur = Infinity;
  f.st = statsOf(f.kit, UNARMED, f.held);
  // Health is not re-rolled: the armour is still on, and it is the armour that
  // health comes from.  Only the cap moves, and it moves nowhere, because
  // `maxHp` is made of the suit's resistance and the suit did not change.
  f.hp = Math.min(f.hp, f.st.maxHp);
}

// =============================================================== simulation

/** How long each beat of a swing lasts, as a share of one strike's time. */
const WINDUP = 0.42;
const STRIKE = 0.1;
const RECOVER = 0.3;
/** A breath between swings, so a fast weapon is fast and not a strobe. */
const BEAT = 0.22;
const DODGE_S = 0.34;
const GUARD_S = 0.5;
/** What a dodge is worth on top of avoidance, and what it costs to try. */
const DODGE_BONUS = 0.4;
const DODGE_COOL = 0.7;
/** Damage a guarding fighter turns aside on top of the weapon's own guard. */
const GUARD_CUT = 0.3;
/** Below this share of health a fighter starts looking after itself, */
const HURT_AT = 0.35;
/** and below this it stops, because there is nothing left to save it for. */
const DESPERATE_AT = 0.25;
/** A blow worth this share of somebody's health takes their feet from them. */
const STAGGER_AT = 0.16;
const STAGGER_S = 0.5;
/** And moves them this far, in the rules and not only in the drawing. */
const KNOCK_PX = 9;
/** A counter off a dodge winds up in this share of the usual time. */
const RIPOSTE_WINDUP = 0.45;
/** So does the second half of a combination. */
const COMBO_WINDUP = 0.55;
/** The best chance of chaining another swing, at a hundred speed. */
const COMBO_MAX = 0.4;
/** A lunge is this much faster than walking, for this long. */
const LUNGE_MUL = 2.3;
const LUNGE_S = 0.28;
const LUNGE_COOL = 1.5;
/**
 * How long the result stands before the machine returns to the arcade itself.
 *
 * A win gets the longer look: there is a reward counting up on it, and the
 * shell adds its own couple of seconds on top before the room fades back.
 */
const OVER_WIN_MS = 4200;
const OVER_LOSE_MS = 3200;
/** How much of the way to the target angle a limb travels each frame. */
const ARM_SNAP = 0.62;
const ARM_EASE = 0.3;
/**
 * The whole fight runs at this multiple of real time.
 *
 * Every duration in the rules is a number of seconds, so multiplying the step
 * scales wind-up, recovery, cool-down, walking and stun by exactly the same
 * amount.  Nothing changes rank against anything else and the headless
 * simulator the balance was measured with is untouched -- it keeps its own
 * fixed step.  All that moves is the clock on the wall: a median fight goes
 * from about thirty-four seconds to about twenty-two.
 */
const PACE = 1.55;
/** How fast a knock-back shove slides back to nothing, per second. */
const SHOVE_DECAY = 7;
/** Two fighters are never drawn closer than this, whatever the rules say. */
const BODY_CLEAR = 31;
/** How long the emptied chest takes to fold up before the next five fall. */
const COLLAPSE_MS = 240;
/** How long the kit sheet stays up before the walk-on starts by itself. */
const SUMMARY_MS = 4200;
/** Inside this share of its own reach, a weapon is being swung wrong, */
const INSIDE_FRAC = 0.75;
/** down to this much of its power at nose-to-nose. */
const INSIDE_MIN = 0.25;
/** The arena's two walls, in the fighters' own coordinates. */
export const ARENA = { left: 26, right: GAME_W - 26 };

export interface Blow {
  hit: boolean;
  dodged: boolean;
  /** Both of them swung and the weapons met instead of either body. */
  clashed?: boolean;
  /** It was big enough to take the legs from under them. */
  staggered?: boolean;
  guarded: boolean;
  dmg: number;
  broke: boolean;
}

/**
 * One strike, and the only thing in the game that takes health off anybody.
 *
 * Out of reach is a clean miss and costs the weapon nothing.  In reach, the
 * defender gets one roll to not be there -- their avoidance, plus a good deal
 * more if they are mid-dodge -- and then the armour takes its cut off whatever
 * is left.  A strike that gets through is never worth less than one.
 *
 * `rng` is injectable so the whole thing can be run ten thousand times with a
 * seeded roll and the answer checked, rather than watched.
 */
export function resolveStrike(att: Fighter, def: Fighter, gap: number, rng = Math.random): Blow {
  const out: Blow = { hit: false, dodged: false, guarded: false, dmg: 0, broke: false };
  if (gap > att.st.reach) return out;

  // The swing lands on something, so the weapon wears whether or not the
  // something was the lizard.
  // Wear is charged once per swing, not once per blow to land.  A weapon
  // that throws two was paying twice for the one swing, so the nunchuck's
  // twenty-two lasted eleven attacks and it spent most of every fight
  // bare-handed: seven percent of its duels, bottom of the rack.
  if (Number.isFinite(att.dur) && att.swing === 0) {
    att.dur -= 1;
    if (att.dur <= 0) {
      breakWeapon(att);
      out.broke = true;
    }
  }

  const evade = def.st.avoid + (def.act === 'dodge' ? DODGE_BONUS : 0);
  if (rng() < evade) {
    out.dodged = true;
    // ---- AND THE ANSWER TO IT.  Slipping a blow leaves the other one
    // committed and out of shape, so the dodger gets to come back off it
    // fast.  Both fighters have this; neither has anything else.
    if (def.act === 'dodge') {
      def.riposte = true;
      def.cool = 0;
    }
    return out;
  }

  const guarding = def.act === 'guard';
  out.guarded = guarding || def.st.guard > 0;
  const soak = (guarding ? GUARD_CUT : 0) + def.st.guard;
  // ---- AND A LONG WEAPON IS A BAD WEAPON UP CLOSE.
  //
  // Reach was pure profit otherwise, and it showed: the scythe took 90% of
  // its fights and the dagger 10%.  A scythe swung at arm's length is a
  // length of wood, and that is the short blade's whole win condition -- get
  // inside the arc and the reach stops counting.  It is the same rule for
  // both fighters and it is written against reach, not against who is
  // holding it: a dagger's sweet spot is so short that nothing can get
  // inside it, which is exactly the point of carrying one.
  const sweet = att.st.reach * INSIDE_FRAC;
  const close = gap < sweet ? INSIDE_MIN + (1 - INSIDE_MIN) * (gap / sweet) : 1;
  const raw = att.st.power * close * (0.85 + rng() * 0.3);
  // ---- ARMOUR TAKES A SHARE, NOT A SLICE.
  //
  // It was a flat subtraction, and a flat subtraction is the end of every
  // light weapon in the game: six points of plate turned a dagger's five into
  // the one-damage floor while doing nothing at all to an axe.  Measured over
  // twelve hundred fights, nine of the thirteen weapons won exactly none and
  // three in five fights ran to the time cap.
  //
  // A share is the same cut whatever is swinging, and it leaves a dagger a
  // dagger.  `defence` is already that share: a full gold suit is thirty
  // percent of everything, a tuxedo is five, and nothing is nothing.
  out.hit = true;
  out.dmg = Math.max(1, Math.round(raw * (1 - def.st.defence) * (1 - soak)));
  def.hp = Math.max(0, def.hp - out.dmg);

  // ---- WHAT A BIG ONE DOES BESIDES DAMAGE.
  //
  // A blow worth a good share of somebody's health puts them on the back
  // foot: they lose the next beat and they lose GROUND, which is a real
  // change to the fight and not a flinch -- a staggered fighter has just
  // given a long weapon the distance it wanted, or lost a short one the
  // distance it needs.  Both sides, same threshold.
  if (def.hp > 0 && out.dmg >= def.st.maxHp * STAGGER_AT) {
    out.staggered = true;
    def.act = 'stagger';
    def.t = STAGGER_S;
    def.chain = 0;
    def.riposte = false;
    def.x = Phaser.Math.Clamp(def.x + (def.x < att.x ? -1 : 1) * KNOCK_PX, ARENA.left, ARENA.right);
  }
  return out;
}

/**
 * WHAT A FIGHTER DOES NEXT, AND THE ONLY PLACE EITHER OF THEM DECIDES.
 *
 * Both fighters are put through this same function every tick with their own
 * numbers, and there is no `who` in it: there is nothing here that could know
 * which of the two it is looking at, which is the structural version of the
 * promise that the lizard is not cheating.
 *
 * The shape of it:
 *   - it closes to the distance its weapon wants and holds there
 *   - it swings whenever something is in reach and the beat has come round
 *   - it tries to not be there when a swing is coming, as often as its
 *     avoidance says it can
 *   - and when it is badly hurt it does more of the last thing and less of
 *     the middle one
 */
export function think(f: Fighter, other: Fighter, dt: number, rng = Math.random): void {
  const gap = Math.abs(f.x - other.x);
  f.face = other.x >= f.x ? 1 : -1;
  const hurt = f.hp / f.st.maxHp < HURT_AT;

  // ---- DODGING.  Read the other one's wind-up and try to not be there.
  //
  // It is a roll against avoidance rather than a certainty, which is what
  // makes a heavy suit cost something: the plate stops the blow it fails to
  // avoid, and it is the reason it failed to avoid it.
  if (f.cool <= 0 && (f.act === 'walk' || f.act === 'guard') && other.act === 'windup' && gap <= other.st.reach + 6) {
    const want = f.st.avoid * (hurt ? 1.5 : 1) * 2.1;
    if (rng() < want * dt * 8) {
      f.act = 'dodge';
      f.t = DODGE_S;
      f.cool = DODGE_COOL;
      return;
    }
  }

  // ---- A SHIELD, OR A BAD DAY, PUTS SOMETHING BETWEEN YOU AND IT.
  if (f.act === 'walk' && (hurt || f.st.guard > 0) && gap <= other.st.reach + 4 && rng() < (hurt ? 0.9 : 0.4) * dt) {
    f.act = 'guard';
    f.t = GUARD_S;
    return;
  }

  if (f.act !== 'walk') return;
  f.desperate = f.hp / f.st.maxHp < DESPERATE_AT;

  // ---- SWINGING.  In reach, off cooldown, go.
  //
  // Three speeds of wind-up now, and which one it is says what just happened:
  // a counter off a dodge is the fastest, the back half of a combination is
  // nearly as quick, and a swing started from nothing takes as long as it
  // always did.  A fighter with nothing left to lose skips part of it too.
  if (gap <= f.st.reach && f.cool <= 0) {
    const share = f.riposte ? RIPOSTE_WINDUP : f.chain > 0 ? COMBO_WINDUP : f.desperate ? 0.78 : 1;
    f.act = 'windup';
    f.t = (WINDUP * share) / f.st.rate;
    f.swing = 0;
    f.riposte = false;
    return;
  }

  // ---- CLOSING THE LAST OF IT IN ONE GO.
  //
  // Standing out of reach and walking in at a constant pace is what made the
  // old fight look like two people queueing.  A lunge covers the last stretch
  // in a burst, which is where the sudden changes of distance come from --
  // and being out of position afterwards is what it costs.
  if (f.cool <= 0 && gap > f.st.reach && gap < f.st.reach + 26 && rng() < (f.desperate ? 2.2 : 1.1) * dt) {
    f.act = 'lunge';
    f.t = LUNGE_S;
    f.cool = LUNGE_COOL;
    return;
  }

  // ---- AND OTHERWISE, FOOTWORK.
  //
  // Two different distances, and keeping them apart is the whole of it.
  //
  // `range` is where a fighter would RATHER stand, and for most of the rack
  // that is at or past its own reach -- a dagger's is 13 against a reach of
  // 12.  Walking to `range` and stopping therefore parked nine of the
  // thirteen weapons a step outside their own striking distance, where the
  // swing test could never pass and the footwork had nothing left to correct.
  // They stood and looked at each other until the clock ran out: three fights
  // in five, and every one of those nine weapons on nought wins.
  //
  // So closing is done to `reach` and never to `range`.  Between swings, on
  // the cool-down, a fighter drifts back out to `range`, which is where a
  // staff gets to be a staff -- it keeps its spacing while it recovers and
  // steps in to land the blow.  A hurt fighter gives up more ground.
  const keep = Math.min(f.st.range, f.st.reach - 2);
  // Already inside the arc of whatever the other one is swinging?  Then the
  // spacing is won: stand in it.  Drifting back out on the cool-down was
  // handing the long weapon its range back for free every other second, and
  // it is the reason a dagger could not stay where a dagger beats a scythe.
  const stuck = gap < other.st.reach * INSIDE_FRAC;
  const want = f.cool > 0 && !stuck ? f.st.range * (hurt ? 1.25 : 1) : keep;
  const dir = gap > want + 2 ? 1 : gap < want - 2 ? -1 : 0;
  if (dir !== 0) {
    f.x += f.face * dir * f.st.walk * dt;
    f.x = Phaser.Math.Clamp(f.x, ARENA.left, ARENA.right);
    f.step += f.st.walk * dt;
  }
}

/**
 * Move one fighter's clock on, and fire the strike when the wind-up ends.
 *
 * Returns the blow if one was thrown this tick, so the caller can draw it.
 * Split from `think` because timers must run even while a fighter is stunned
 * and has no say in anything.
 */
export function tick(f: Fighter, other: Fighter, dt: number, rng = Math.random): Blow | null {
  if (f.cool > 0) f.cool -= dt;
  if (f.stun > 0) {
    f.stun -= dt;
    return null;
  }
  if (f.act === 'walk') {
    think(f, other, dt, rng);
    return null;
  }

  // A lunge is movement, so it has to happen while its clock runs rather than
  // when it ends.  It closes ground at better than twice a walk.
  if (f.act === 'lunge') {
    f.x = Phaser.Math.Clamp(f.x + f.face * f.st.walk * LUNGE_MUL * dt, ARENA.left, ARENA.right);
    f.step += f.st.walk * LUNGE_MUL * dt;
  }

  f.t -= dt;
  if (f.t > 0) return null;

  switch (f.act) {
    case 'windup': {
      f.act = 'strike';
      f.t = STRIKE;
      const blow = resolveStrike(f, other, Math.abs(f.x - other.x), rng);
      f.swing += 1;
      return blow;
    }
    case 'strike': {
      // A weapon that throws two puts the second one in without a fresh
      // wind-up, which is what "rapid, multiple strikes" actually feels like.
      if (f.swing < f.weapon.hits) {
        f.t = STRIKE;
        const blow = resolveStrike(f, other, Math.abs(f.x - other.x), rng);
        f.swing += 1;
        return blow;
      }
      // ---- AND THE COMBINATION.  A quick fighter sometimes does not stop at
      // one: the chance comes off SPEED, so it is the same rule for both and
      // the fast kit is the one that gets to use it.
      if (f.chain > 0) f.chain -= 1;
      else if (rng() < COMBO_MAX * (f.st.speedPts / 100) * (f.desperate ? 1.4 : 1)) f.chain = 1;
      f.act = 'recover';
      f.t = (RECOVER * (f.chain > 0 ? 0.45 : 1)) / f.st.rate;
      return null;
    }
    case 'recover':
      f.act = 'walk';
      f.cool = f.chain > 0 ? 0 : BEAT / f.st.rate;
      return null;
    case 'stagger':
      // back on its feet, and out of shape for it
      f.act = 'walk';
      f.cool = Math.max(f.cool, BEAT / f.st.rate);
      return null;
    default:
      f.act = 'walk';
      return null;
  }
}

/**
 * BOTH OF THEM, ONE TICK, AND WHAT HAPPENS WHEN THEY SWING TOGETHER.
 *
 * Ticking the two fighters separately means two blows thrown in the same
 * sixtieth of a second simply both land, which is not what two people with
 * weapons do -- they meet.  A clash costs both of them the damage and both of
 * them their footing, and it can only happen when both were genuinely
 * mid-strike and in range of each other, so it is rare and never anybody's
 * tactic.  The rule reads the same from either side.
 */
export function exchange(a: Fighter, b: Fighter, dt: number, rng = Math.random): Array<{ att: Fighter; def: Fighter; blow: Blow }> {
  const hpA = a.hp;
  const hpB = b.hp;
  const blowA = tick(a, b, dt, rng);
  const blowB = tick(b, a, dt, rng);
  const out: Array<{ att: Fighter; def: Fighter; blow: Blow }> = [];

  if (blowA && blowB && blowA.hit && blowB.hit) {
    // put the damage back and push them apart instead
    a.hp = hpA;
    b.hp = hpB;
    for (const [f, o] of [[a, b], [b, a]] as const) {
      f.act = 'recover';
      f.t = RECOVER / f.st.rate;
      f.chain = 0;
      f.riposte = false;
      f.x = Phaser.Math.Clamp(f.x + (f.x < o.x ? -1 : 1) * KNOCK_PX, ARENA.left, ARENA.right);
    }
    // A break is reported against the fighter whose weapon it WAS.  Folding
    // both sides' `broke` into the single clash event and attributing it to
    // `a` meant b's weapon breaking took the sprite out of a's hand instead,
    // so the wrong gladiator stood there holding nothing.
    if (blowA.broke) out.push({ att: a, def: b, blow: { hit: false, dodged: false, guarded: false, dmg: 0, broke: true } });
    if (blowB.broke) out.push({ att: b, def: a, blow: { hit: false, dodged: false, guarded: false, dmg: 0, broke: true } });
    out.push({ att: a, def: b, blow: { hit: false, dodged: false, guarded: false, dmg: 0, broke: false, clashed: true } });
    return out;
  }
  if (blowA) out.push({ att: a, def: b, blow: blowA });
  if (blowB) out.push({ att: b, def: a, blow: blowB });
  return out;
}

/**
 * A whole fight, with nothing drawn.
 *
 * The scene runs the same two calls a frame; this runs them as fast as it can
 * with a fixed step, so a build can be checked over ten thousand fights
 * instead of watched once.  `cap` is there because two fighters in full plate
 * with bare hands can genuinely stand there all day.
 */
export function simulate(a: Kit, bKit: Kit, rng = Math.random, cap = 180): { winner: 'frog' | 'lizard' | null; seconds: number; breaks: number; clashes: number } {
  const f = makeFighter('frog', a, 100, 1);
  const l = makeFighter('lizard', bKit, 220, -1);
  const dt = 1 / 60;
  let t = 0;
  let breaks = 0;
  let clashes = 0;
  while (t < cap && f.hp > 0 && l.hp > 0) {
    // The same call the scene makes, so what is measured here is what is
    // played there -- clashes and all.
    for (const e of exchange(f, l, dt, rng)) {
      if (e.blow.broke) breaks++;
      if (e.blow.clashed) clashes++;
    }
    t += dt;
  }
  return { winner: f.hp <= 0 ? 'lizard' : l.hp <= 0 ? 'frog' : null, seconds: t, breaks, clashes };
}

// ====================================================================== art

/**
 * A fighter, built once and then posed.
 *
 * Every piece the player chose is a real object in here: the helm sits on the
 * head, the cuirass on the torso, the greaves on the shins and the weapon in
 * the hand.  Nothing is a decal and nothing floats -- the arm and the weapon
 * are one group hinged at the shoulder, so a swing moves both.
 */
export interface FighterArt {
  root: Phaser.GameObjects.Container;
  legL: Phaser.GameObjects.Rectangle;
  legR: Phaser.GameObjects.Rectangle;
  greaveL: Phaser.GameObjects.Rectangle;
  greaveR: Phaser.GameObjects.Rectangle;
  torso: Phaser.GameObjects.Ellipse;
  cuirass: Phaser.GameObjects.Rectangle;
  head: Phaser.GameObjects.Ellipse;
  helm: Phaser.GameObjects.Rectangle;
  arm: Phaser.GameObjects.Container;
  weapon: Phaser.GameObjects.Container;
  /** Stays flat on the sand while everything above it moves. */
  shadow: Phaser.GameObjects.Ellipse;
}

const FLOOR_Y = 138;

/** The weapon itself, drawn in the hand, pointing along +x. */
/**
 * THE THING IN THE HAND.
 *
 * Each one is a handful of rectangles, but never a FLAT handful: a blade gets
 * a bright edge along its spine and a dark line under it, a haft gets a grain
 * line, and anything metal gets a highlight a shade off the body colour.
 * Three tones is the difference between a sword and a grey stick, and it
 * costs two more rectangles.
 */
function buildWeapon(scene: Phaser.Scene, key: string, tint: number): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const bar = (x: number, y: number, w: number, h: number, col: number, ang = 0): Phaser.GameObjects.Rectangle => {
    const r = scene.add.rectangle(x, y, w, h, col).setAngle(ang);
    c.add(r);
    return r;
  };
  const steel = 0xc6ced9;
  const shine = 0xeef3fa;
  const shade = 0x7d8794;
  const wood = 0x7a5a36;
  const woodLit = 0x9a7648;
  const grip = 0x3b2a1a;
  /** A blade: body, lit spine, shadowed underside. */
  const blade = (x: number, y: number, w: number, h: number, ang = 0, body = steel): void => {
    bar(x, y, w, h, body, ang);
    bar(x, y - h / 2 + 0.5, w, 1, shine, ang);
    bar(x, y + h / 2 - 0.5, w, 1, shade, ang);
  };
  /** A shaft of wood with a grain line down it. */
  const haft = (x: number, y: number, w: number, h: number, ang = 0): void => {
    bar(x, y, w, h, wood, ang);
    bar(x, y - h / 4, w, 1, woodLit, ang);
  };
  switch (key) {
    case 'none':
      // nothing in the hand at all: a bound fist, and no more than that
      bar(2, 0, 4, 5, tint);
      bar(2, -1, 4, 1, 0xffffff).setAlpha(0.25);
      break;
    case 'dagger':
      blade(5, 0, 9, 2.5); bar(0, 0, 2, 6, PALETTE.gold); bar(-2, 0, 3, 3, grip);
      break;
    case 'knife':
      blade(6, -1, 10, 2.5); bar(0, 0, 4, 4, grip); bar(0, -1, 4, 1, PALETTE.slate);
      break;
    case 'knuckles':
      bar(2, 0, 5, 5, tint); bar(4, -2, 6, 2, steel); bar(4, -2.5, 6, 1, shine);
      bar(4, 1, 6, 1.5, shade);
      break;
    case 'sword':
      blade(12, 0, 22, 3); bar(1, 0, 2.5, 9, PALETTE.gold); bar(-2, 0, 4, 3, grip);
      bar(-4, 0, 2, 4, PALETTE.gold);
      break;
    case 'katana':
      blade(13, -2, 25, 2.5, -6); bar(1, 0, 2, 7, PALETTE.ink); bar(-2, 0, 4, 3, 0x6a2b2b);
      break;
    case 'dual':
      blade(11, -4, 19, 2.5, -12); blade(11, 4, 19, 2.5, 12);
      bar(0, -3, 3, 5, grip); bar(0, 3, 3, 5, grip);
      break;
    case 'nunchuck':
      haft(3, -3, 8, 3.5, -30); haft(9, 4, 8, 3.5, 40);
      bar(6, 0, 5, 1, steel); bar(6, 0, 5, 0.5, shine);
      break;
    case 'axe':
      haft(8, 0, 16, 3);
      bar(16, -1, 9, 10, steel); bar(16, -1, 9, 2, shine); bar(18, 3, 5, 2, shade);
      bar(12, -1, 3, 11, 0x5a4530);
      break;
    case 'goldsword':
      bar(12, 0, 23, 4.5, PALETTE.gold); bar(12, -1.6, 23, 1.5, PALETTE.cream);
      bar(12, 1.8, 23, 1, PALETTE.amberDark);
      bar(1, 0, 3.5, 11, PALETTE.amberDark); bar(-3, 0, 4, 4, 0x6a4a12);
      c.add(scene.add.circle(-5, 0, 2, PALETTE.blood));
      break;
    case 'staff':
      haft(10, 0, 34, 3.5);
      bar(26, 0, 4, 4.5, PALETTE.bone); bar(-6, 0, 4, 4.5, PALETTE.bone);
      bar(10, 0, 34, 1, 0x5a4530).setAlpha(0.5);
      break;
    case 'flail':
      haft(6, 0, 12, 3);
      bar(16, 0, 9, 1, PALETTE.fog);
      c.add(scene.add.circle(24, 0, 5.5, PALETTE.steel));
      c.add(scene.add.circle(23, -1, 2, shine).setAlpha(0.6));
      bar(24, 0, 13, 1.5, PALETTE.bone); bar(24, 0, 1.5, 13, PALETTE.bone);
      break;
    case 'scythe':
      haft(12, 0, 26, 3);
      blade(26, -6, 13, 2.5, -28); blade(30, -11, 8, 2, -62);
      bar(20, 0, 3, 4, PALETTE.gold);
      break;
    default: {
      // The spiked shield: a boss, a rim, and six spikes around it.
      //
      // Carried low, at about chest height.  On the arm's own line it sat
      // squarely over the other fighter's face, and the rim was drawn with
      // `circle(..., 0)` -- which is a BLACK fill, not an empty one, so a
      // solid black disc rode over the top of everything.  Alpha 0 is how you
      // ask for nothing.
      const sy = 6;
      c.add(scene.add.circle(4, sy, 9.5, PALETTE.steel));
      c.add(scene.add.circle(4, sy, 9.5, 0, 0).setStrokeStyle(1.5, shade));
      c.add(scene.add.circle(4, sy, 5, PALETTE.fog));
      c.add(scene.add.circle(2, sy - 2, 2.5, shine).setAlpha(0.5));
      for (let i = 0; i < 6; i++) {
        const a2 = (i / 6) * Math.PI * 2;
        bar(4 + Math.cos(a2) * 10, sy + Math.sin(a2) * 10, 5, 1.8, PALETTE.bone, (a2 * 180) / Math.PI);
      }
      break;
    }
  }
  return c;
}

/**
 * ONE FIGHTER, WEARING WHAT THE CHESTS GAVE IT.
 *
 * Two animals that have to be told apart instantly from across a 320-pixel
 * room, so the difference is built into the silhouette and not into the
 * colour: FROGGY is round -- domed head, eyes up on top of it, wide soft
 * body, no neck.  THE LIZARD is angular -- long jaw, spined crest, heavy
 * tail counterbalancing forward, narrow shoulders.  Turn both to black and
 * you can still say which is which, which is the only test that matters at
 * this size.
 *
 * Armour is drawn ON the body part it belongs to and shaped to it -- a helm
 * with a brow and a visor slit, a cuirass with shoulders and a belt, greaves
 * that wrap the shin -- rather than a rectangle parked in front of it.  NO
 * ARMOUR draws nothing at all, so bare is visibly bare.
 */
export function buildFighter(scene: Phaser.Scene, f: Fighter): FighterArt {
  const frog = f.who === 'frog';
  // Froggy is green.  The lizard is NOT a second green animal: it is rust and
  // sand, which is the other half of telling them apart at a glance -- shape
  // does the work up close, colour does it across the room.
  const skin = frog ? PALETTE.moss : 0x9c5a2e;
  const light = frog ? PALETTE.mossLight : 0xc98243;
  const dark = frog ? 0x2f5a2a : 0x5e3218;
  const H = f.kit.head.mat!;
  const B = f.kit.body.mat!;
  const L = f.kit.legs.mat!;
  const wears = (m: ArmourMat): boolean => m.key !== 'none';

  // ---- THE SHADOW.  One soft ellipse on the sand, and the single cheapest
  // thing that stops a sprite looking pasted onto the background.
  const shadow = scene.add.ellipse(0, 1, 26, 6, 0x6b5330).setAlpha(0.34);

  // ---- LEGS
  const legL = scene.add.rectangle(-4, -2, 4, 11, dark).setOrigin(0.5, 1);
  const legR = scene.add.rectangle(4, -2, 4, 11, skin).setOrigin(0.5, 1);
  const greaveL = scene.add.rectangle(-4, -3, 6, 8, L.colour).setOrigin(0.5, 1).setStrokeStyle(1, L.edge).setVisible(wears(L));
  const greaveR = scene.add.rectangle(4, -3, 6, 8, L.colour).setOrigin(0.5, 1).setStrokeStyle(1, L.edge).setVisible(wears(L));
  const kneeL = scene.add.rectangle(-4, -9, 7, 2, L.edge).setVisible(wears(L));
  const kneeR = scene.add.rectangle(4, -9, 7, 2, L.edge).setVisible(wears(L));
  // frogs get broad flat feet, lizards get clawed ones
  const footL = scene.add.rectangle(-5, 0, frog ? 8 : 7, 2, light).setOrigin(0.5, 1);
  const footR = scene.add.rectangle(5, 0, frog ? 8 : 7, 2, light).setOrigin(0.5, 1);
  const clawL = frog ? null : scene.add.triangle(-9, -1, 0, 2, 4, 0, 4, 3, PALETTE.bone);
  const clawR = frog ? null : scene.add.triangle(9, -1, 0, 0, 4, 2, 0, 3, PALETTE.bone);

  // ---- THE TAIL, which is half of what says LIZARD
  const tail = frog ? null : scene.add.triangle(-13, -14, 0, 0, 19, 5, 0, 11, skin).setAngle(14);
  const tailTip = frog ? null : scene.add.triangle(-21, -12, 0, 0, 9, 3, 0, 6, dark).setAngle(18);

  // ---- TORSO
  const torso = frog
    ? scene.add.ellipse(0, -19, 19, 20, skin)
    : scene.add.ellipse(-1, -19, 15, 19, skin);
  const belly = scene.add.ellipse(1, -16, frog ? 12 : 9, 11, light).setAlpha(0.55);
  const cuirass = scene.add.rectangle(0, -19, frog ? 17 : 15, 15, B.colour).setStrokeStyle(1, B.edge).setVisible(wears(B));
  // shoulders and a belt, so the breastplate is worn rather than held up
  const pauldL = scene.add.ellipse(-8, -26, 8, 6, B.colour).setStrokeStyle(1, B.edge).setVisible(wears(B));
  const pauldR = scene.add.ellipse(8, -26, 8, 6, B.colour).setStrokeStyle(1, B.edge).setVisible(wears(B));
  const belt = scene.add.rectangle(0, -12, frog ? 18 : 16, 3, B.edge).setVisible(wears(B));
  const ridge = scene.add.rectangle(0, -20, frog ? 15 : 13, 1, B.edge).setAlpha(0.7).setVisible(wears(B));

  // ---- THE CREST, the other half of LIZARD
  const spines: Phaser.GameObjects.Triangle[] = [];
  if (!frog) for (let i = 0; i < 4; i++) {
    spines.push(scene.add.triangle(-6 - i * 2, -30 + i * 5, 0, 5, 3, 0, 5, 5, PALETTE.rust));
  }

  // ---- HEAD
  const head = frog
    ? scene.add.ellipse(2, -33, 16, 13, light)
    : scene.add.ellipse(1, -32, 13, 10, light);
  const jaw = frog
    ? scene.add.ellipse(7, -30, 6, 4, light)
    : scene.add.triangle(12, -30, 0, 0, 11, 3, 0, 6, light);
  const teeth = frog ? null : scene.add.rectangle(11, -29, 7, 1, PALETTE.cream);
  const mouth = frog ? scene.add.rectangle(6, -29, 8, 1, dark) : null;
  // a frog's eyes sit on top of the dome; a lizard's are set into the side
  const eyeL = scene.add.circle(-1, frog ? -38 : -34, frog ? 3.4 : 2.6, PALETTE.cream);
  const eyeR = scene.add.circle(5, frog ? -38 : -34, frog ? 3.4 : 2.6, PALETTE.cream);
  const pupL = frog
    ? scene.add.circle(0, -38, 1.5, PALETTE.black)
    : scene.add.rectangle(0, -34, 1.2, 4, PALETTE.black);
  const pupR = frog
    ? scene.add.circle(6, -38, 1.5, PALETTE.black)
    : scene.add.rectangle(6, -34, 1.2, 4, PALETTE.black);
  const brow = frog ? null : scene.add.rectangle(2, -37, 12, 2, dark);

  // ---- HELM: a bowl, a brow band, a visor slit, and a plume for the frog
  // A helm caps the skull.  At -40 it came down over the eyes and both of
  // them fought the whole bout blindfolded in a grey box.
  const hy = frog ? -43 : -39;
  const helm = scene.add.rectangle(2, hy, frog ? 17 : 14, 6, H.colour).setStrokeStyle(1, H.edge).setVisible(wears(H));
  const helmDome = scene.add.ellipse(2, hy - 2, frog ? 17 : 14, 7, H.colour).setVisible(wears(H));
  const visor = scene.add.rectangle(4, hy + 2, frog ? 12 : 10, 1.5, H.edge).setVisible(wears(H));
  const plume = scene.add.rectangle(-4, hy - 7, 3, 8, frog ? PALETTE.blood : PALETTE.rust).setVisible(wears(H));

  // ---- the arm and the weapon, on one hinge at the shoulder
  const arm = scene.add.container(5, -24);
  arm.add(scene.add.rectangle(5, 0, 11, 4, skin));
  arm.add(scene.add.rectangle(5, -1, 11, 1, light).setAlpha(0.5));
  arm.add(scene.add.circle(10, 0, 3, light));
  const weapon = buildWeapon(scene, f.weapon.key, light);
  weapon.setPosition(11, 0);
  arm.add(weapon);

  const parts: Phaser.GameObjects.GameObject[] = [shadow];
  if (tailTip) parts.push(tailTip);
  if (tail) parts.push(tail);
  parts.push(footL, footR);
  if (clawL) parts.push(clawL, clawR!);
  parts.push(legL, legR, greaveL, greaveR, kneeL, kneeR);
  parts.push(...spines);
  parts.push(torso, belly, cuirass, ridge, belt, arm, pauldL, pauldR);
  parts.push(head, jaw);
  if (teeth) parts.push(teeth);
  if (mouth) parts.push(mouth);
  if (brow) parts.push(brow);
  parts.push(eyeL, eyeR, pupL, pupR, helmDome, helm, visor, plume);
  const root = scene.add.container(f.x, FLOOR_Y, parts).setDepth(20);
  root.setScale(f.face, 1);
  return { root, legL, legR, greaveL, greaveR, torso, cuirass, head, helm, arm, weapon, shadow };
}

/** Put the fighter into the pose its current act calls for. */
/**
 * Where a fighter is DRAWN, which is not always where it is.
 *
 * The rules work in fighting distance, and fighting distance for a pair of
 * knuckles is nine pixels -- while the body swinging them is nearer thirty
 * wide.  Drawn honestly the two of them climb inside one another and read as
 * a single confused animal.  So the drawing, and only the drawing, holds them
 * a body apart: the simulation still sees the nine pixels it was balanced on,
 * and nothing here is allowed to feed back into it.
 */
export function drawX(f: Fighter, other?: Fighter): number {
  const base = (() => {
    if (!other) return f.x;
    const gap = Math.abs(f.x - other.x);
    if (gap >= BODY_CLEAR) return f.x;
    const mid = (f.x + other.x) / 2;
    return mid + (f.x <= other.x ? -1 : 1) * (BODY_CLEAR / 2);
  })();
  return base + f.shove;
}

export function poseFighter(f: Fighter, other?: Fighter): void {
  const a = f.art;
  if (!a) return;
  a.root.x = drawX(f, other);
  a.root.setScale(f.face, 1);

  // the walk: two legs out of phase, and the body riding on it
  const swingL = Math.sin(f.step / 5) * 3;
  a.legL.setAngle(swingL);
  a.legR.setAngle(-swingL);
  a.greaveL.setAngle(swingL);
  a.greaveR.setAngle(-swingL);
  a.root.y = FLOOR_Y - Math.abs(Math.sin(f.step / 5)) * 1.2;

  // the arm: back for the wind-up, through for the strike, drooping after
  let arm = -10;
  let lean = 0;
  if (f.act === 'windup') { arm = -70; lean = -6; }
  else if (f.act === 'strike') { arm = 34; lean = 8; }
  else if (f.act === 'recover') { arm = 16; lean = 4; }
  else if (f.act === 'guard') { arm = -96; lean = -4; }
  else if (f.act === 'dodge') { arm = -30; lean = -16; }
  // thrown backwards, arms going up, off balance
  else if (f.act === 'stagger') { arm = 52; lean = -22; }
  // driving forward off the back foot, weapon trailing
  else if (f.act === 'lunge') { arm = -44; lean = 18; }
  if (f.stun > 0) { arm = 24; lean = 12; }

  // These were set straight onto the arm, so every act change was a cut: the
  // arm was behind the head on one frame and through the other fighter on the
  // next, and at four acts a second that reads as a stutter rather than as a
  // swing.  Easing it fixes that, but easing it evenly makes the hit soft --
  // so the strike goes nearly all the way in one frame and everything else
  // settles.  Fast in, slow out, which is where the weight comes from.
  const snap = f.act === 'strike' || f.act === 'windup' ? ARM_SNAP : ARM_EASE;
  f.armA += (arm - f.armA) * snap;
  f.leanA += (lean - f.leanA) * snap;
  a.arm.setAngle(f.armA);
  a.torso.setAngle(f.leanA);
  a.cuirass.setAngle(f.leanA);
  const duck = f.act === 'dodge' ? 4 : f.act === 'stagger' ? -2 : 0;
  a.head.y = (f.who === 'frog' ? -33 : -32) + duck;
  a.helm.y = (f.who === 'frog' ? -43 : -39) + duck;

  // ---- THE SHADOW STAYS ON THE SAND.
  //
  // It lives inside the same container as the body, so a hop or a fall takes
  // it along unless it is put back: it is pushed down by however far the body
  // rose, un-rotated, and shrunk a little with height, which is what sells
  // the jump as a jump rather than as the whole sprite sliding upward.
  const lift = FLOOR_Y - a.root.y;
  a.shadow.y = 1 + lift;
  a.shadow.setAngle(-a.root.angle);
  const k = Math.max(0.45, 1 - lift / 26);
  a.shadow.setScale(k, k).setAlpha(0.34 * k);
}

/** The colosseum: sand, two tiers of arches, and a crowd that never stops. */
/**
 * THE COLOSSEUM.
 *
 * Built back to front, because that is the only way depth happens on a flat
 * canvas: the dark behind the arches, then the arches, then the columns in
 * front of them, then the parapet, then the sand, then what is standing on
 * it.  Every layer is a shade warmer and lighter than the one behind, so the
 * eye reads twenty metres out of fifty pixels of wall.
 *
 * The lighting is all cheated and all cheap: torch pools on the stone, a warm
 * wash down the sand, a cold vignette at the edges, and one soft shadow under
 * each fighter.  None of it is a light source -- it is four alpha gradients
 * that happen to agree with each other about where the sun is.
 */
const TIER_Y = [45, 62];
function buildArena(scene: Phaser.Scene, c: Phaser.GameObjects.Container): Phaser.GameObjects.Rectangle[] {
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { c.add(o); return o; };
  // ---- the dark the whole thing sits in
  add(scene.add.rectangle(0, 18, GAME_W, 162, 0x1d150f).setOrigin(0, 0));

  // ---- THE CAVEA: three banks of seating, each set back and darker.
  const crowd: Phaser.GameObjects.Rectangle[] = [];
  for (let tier = 0; tier < 2; tier++) {
    const y = TIER_Y[tier];
    const shade = [0x5c4c38, 0x6f5e47][tier];
    add(scene.add.rectangle(0, y, GAME_W, 17, shade).setOrigin(0, 0));
    // the lip of each row, catching the light from above
    add(scene.add.rectangle(0, y, GAME_W, 2, [0x7a6650, 0x8f7b5e][tier]).setOrigin(0, 0));
    // the vomitoria -- the dark mouths the crowd came in through
    for (let i = 0; i < 9; i++) {
      const x = 4 + i * 36;
      add(scene.add.rectangle(x, y + 3, 22, 14, 0x241a12).setOrigin(0, 0));
      add(scene.add.ellipse(x + 11, y + 3, 22, 10, 0x241a12));
      // a column between each pair, lit down one side
      add(scene.add.rectangle(x + 24, y + 1, 5, 17, 0x8d7a5e).setOrigin(0, 0));
      add(scene.add.rectangle(x + 24, y + 1, 2, 17, 0xa89272).setOrigin(0, 0));
      add(scene.add.rectangle(x + 23, y, 7, 2, 0x9b8764).setOrigin(0, 0));
    }
    // ---- and the people in it
    for (let i = 0; i < 44; i++) {
      const x = 5 + i * 7.2 + (tier % 2) * 3;
      const r = scene.add.rectangle(x, y + 8 + (i % 2) * 2, 3, 4,
        [0xb8724a, 0xd8a06a, 0x8a5a3a, 0xe0c090, 0x9a6a8a][(i + tier) % 5]).setAlpha(0.9);
      add(r);
      crowd.push(r);
    }
  }

  // ---- THE PODIUM.  The wall that keeps them out of the sand.
  add(scene.add.rectangle(0, 80, GAME_W, 10, 0x4a3b2b).setOrigin(0, 0));
  add(scene.add.rectangle(0, 80, GAME_W, 2, 0x7d6a50).setOrigin(0, 0));
  for (let i = 0; i < 27; i++) add(scene.add.rectangle(2 + i * 12, 83, 9, 4, 0x584734).setOrigin(0, 0));

  // ---- TORCHES, and the only thing in here that moves on its own.
  for (let i = 0; i < 5; i++) {
    const x = 32 + i * 64;
    add(scene.add.rectangle(x, 72, 2, 8, 0x4a3524).setOrigin(0.5, 0));
    const pool = add(scene.add.ellipse(x, 86, 44, 18, 0xffb347).setAlpha(0.07));
    const glow = add(scene.add.ellipse(x, 70, 10, 10, 0xffa62b).setAlpha(0.22));
    const fire = add(scene.add.ellipse(x, 70, 3, 6, 0xffd98a));
    scene.tweens.add({ targets: fire, scaleY: 1.32, scaleX: 0.84, duration: 190 + i * 37, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: [glow, pool], alpha: '-=0.07', duration: 230 + i * 29, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ---- THE SAND, warm at the front and in shadow at the back.
  add(scene.add.rectangle(0, 90, GAME_W, 90, 0xcaa96c).setOrigin(0, 0));
  add(scene.add.rectangle(0, 90, GAME_W, 14, 0xa98c56).setOrigin(0, 0).setAlpha(0.75));
  add(scene.add.rectangle(0, 104, GAME_W, 20, 0xbb9a60).setOrigin(0, 0).setAlpha(0.45));
  add(scene.add.rectangle(0, 150, GAME_W, 30, 0xdcbd80).setOrigin(0, 0).setAlpha(0.4));
  // raked lines and grain
  for (let i = 0; i < 7; i++) add(scene.add.rectangle(0, 112 + i * 9, GAME_W, 1, 0xb59468).setOrigin(0, 0).setAlpha(0.3));
  for (let i = 0; i < 90; i++) {
    add(scene.add.rectangle(Math.random() * GAME_W, 94 + Math.random() * 84, 2, 1, Math.random() < 0.5 ? 0xb8955a : 0xe2c68c).setAlpha(0.55));
  }
  // a few dark patches, so the floor is not one flat colour
  for (let i = 0; i < 9; i++) {
    add(scene.add.ellipse(20 + Math.random() * (GAME_W - 40), 110 + Math.random() * 60, 12 + Math.random() * 20, 4 + Math.random() * 4, 0xa98c56).setAlpha(0.22));
  }

  // ---- THE VIGNETTE.  Cold at the edges so the middle looks lit.
  // Three narrowing steps a side rather than one slab: a hard-edged bar down
  // each side read as a pair of curtains hung over the arena.
  for (let i = 0; i < 3; i++) {
    const w = 16 - i * 5;
    add(scene.add.rectangle(0, 34, w, 146, 0x120c08).setOrigin(0, 0).setAlpha(0.13));
    add(scene.add.rectangle(GAME_W - w, 34, w, 146, 0x120c08).setOrigin(0, 0).setAlpha(0.13));
  }
  add(scene.add.rectangle(0, 172, GAME_W, 8, 0x120c08).setOrigin(0, 0).setAlpha(0.22));
  return crowd;
}

// ================================================================== the loop

const ID = 'frogstermash' as const;
/** Seconds on the clock for one chest.  Long enough to read three cards. */
const PICK_MS = 10_000;
const CHEST_W = 52;
const CHEST_H = 34;
const CHEST_Y = 144;
const CHEST_X = [32, 96, 160, 224, 288];

type Phase = 'title' | 'pick' | 'reveal' | 'summary' | 'entry' | 'fight' | 'over';

let scene0: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let phase: Phase = 'title';
/** The one latch that stops a result being reported twice.  See `finish`. */
let ended = false;

let layer: Phaser.GameObjects.Container | null = null;

// ---- selection
let stage = 0;
let offer: Piece[] = [];
let picked: Partial<Kit> = {};
let hi = 0;
let revealHint: Phaser.GameObjects.BitmapText | null = null;
let pickT = 0;
let chests: Phaser.GameObjects.Container[] = [];
let timerBar: Phaser.GameObjects.Rectangle | null = null;
let panelText: Phaser.GameObjects.BitmapText[] = [];
let panelChip: Phaser.GameObjects.Rectangle | null = null;
let previewC: Phaser.GameObjects.Container | null = null;

// ---- the fight
let frog: Fighter | null = null;
let lizard: Fighter | null = null;
let fightT = 0;
let crowd: Phaser.GameObjects.Rectangle[] = [];
let hpBar: Record<'frog' | 'lizard', Phaser.GameObjects.Rectangle | null> = { frog: null, lizard: null };
let hpNum: Record<'frog' | 'lizard', Phaser.GameObjects.BitmapText | null> = { frog: null, lizard: null };
let kitLine: Record<'frog' | 'lizard', Phaser.GameObjects.BitmapText | null> = { frog: null, lizard: null };
let callOut: Phaser.GameObjects.BitmapText | null = null;
let buttons: Array<{ destroy(): void }> = [];

const S = (): Phaser.Scene => scene0!;
const rnd = (n: number): number => Math.floor(Math.random() * n);

function reset(): void {
  phase = 'title';
  ended = false;
  stage = 0;
  offer = [];
  picked = {};
  hi = 0;
  pickT = 0;
  chests = [];
  timerBar = null;
  panelText = [];
  panelChip = null;
  previewC = null;
  frog = null;
  lizard = null;
  fightT = 0;
  crowd = [];
  hpBar = { frog: null, lizard: null };
  hpNum = { frog: null, lizard: null };
  kitLine = { frog: null, lizard: null };
  callOut = null;
  revealHint = null;
  buttons = [];
  // it holds shapes, and those shapes belong to a torn-down scene
  flashFrom.clear();
}

function newLayer(): Phaser.GameObjects.Container {
  layer?.destroy(true);
  for (const b of buttons) b.destroy();
  buttons = [];
  layer = S().add.container(0, 0);
  chests = [];
  panelText = [];
  crowd = [];
  flashFrom.clear();
  return layer;
}

/**
 * Five chests for one slot, and no two of them the same thing.
 *
 * Five different weapons out of thirteen, or five different materials out of
 * seven, every time -- so there is always something to compare, and the
 * quality roll on top of it means two chests of iron are still two different
 * offers.
 */
export function offerFor(slot: Slot): Piece[] {
  const shuffled = <T,>(a: T[]): T[] => {
    const out = [...a];
    for (let i = out.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  if (slot === 'weapon') return shuffled(WEAPONS).slice(0, 5).map((w) => makeWeapon(w));
  return shuffled(MATERIALS).slice(0, 5).map((m) => makeArmour(slot, m));
}

/** A kit rolled the same way the chests are, for the lizard. */
export function randomKit(): Kit {
  // The lizard is dressed out of exactly the same barrel the chests come from
  // -- same list, same bands, same dice.  It has no table of its own, which is
  // the only way to be sure it is not being helped.
  return {
    weapon: makeWeapon(WEAPONS[rnd(WEAPONS.length)]),
    head: makeArmour('head', MATERIALS[rnd(MATERIALS.length)]),
    body: makeArmour('body', MATERIALS[rnd(MATERIALS.length)]),
    legs: makeArmour('legs', MATERIALS[rnd(MATERIALS.length)]),
  };
}

// ------------------------------------------------------------ title card

function showTitle(): void {
  phase = 'title';
  const c = newLayer();
  c.add(S().add.rectangle(0, 18, GAME_W, 162, 0x2b2118).setOrigin(0, 0));
  const t1 = centerText(S(), GAME_W / 2, 50, 'FROGSTER', PALETTE.gold, 24);
  const t2 = centerText(S(), GAME_W / 2, 76, 'MASH', PALETTE.blood, 24);
  c.add(t1);
  c.add(t2);
  S().tweens.add({ targets: [t1, t2], scaleX: 1.06, scaleY: 1.06, duration: 420, yoyo: true, repeat: -1 });
  c.add(centerText(S(), GAME_W / 2, 102, 'OPEN FOUR CHESTS. THEN WATCH.', PALETTE.cream));
  c.add(centerText(S(), GAME_W / 2, 114, 'THE FIGHT IS NOT YOURS TO HELP WITH.', PALETTE.ash));

  // A fighter in whatever four chests would have given it, pacing.
  const demo = makeFighter('frog', randomKit(), GAME_W / 2, 1);
  const art = buildFighter(S(), demo);
  art.root.setPosition(GAME_W / 2, 176);
  c.add(art.root);
  S().tweens.add({ targets: art.root, y: 170, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  audio.sfx('stinger', 0.5);
  S().time.delayedCall(1700, () => {
    if (phase === 'title') startStage(0);
  });
}

// -------------------------------------------------------- the four chests

function startStage(n: number): void {
  phase = 'pick';
  stage = n;
  const slot = ORDER[n];
  offer = offerFor(slot);
  hi = 0;
  pickT = PICK_MS;
  const c = newLayer();

  c.add(S().add.rectangle(0, 18, GAME_W, 162, 0x241b13).setOrigin(0, 0));
  const counter = text(S(), 6, 22, `CHEST ${n + 1} OF 4`, PALETTE.ash);
  c.add(counter);
  // ---- THE STAGE TITLE, SHRUNK UNTIL IT CLEARS THE COUNTER.
  //
  // It is centred on the screen while the counter is pinned to the left, so a
  // long enough name grows out over the top of it: LOWER BODY ARMOUR at size
  // sixteen is seventeen characters and ran straight through CHEST 4 OF 4.
  // Measuring beats counting characters -- the title is laid out, measured,
  // and stepped down a size at a time until its left edge is past the
  // counter's right edge, so any name added later fits by construction.
  const title = centerText(S(), GAME_W / 2, 28, SLOT_NAME[slot], PALETTE.gold, 16);
  const clear = counter.x + counter.width + 6;
  for (let size = 16; size > 8 && GAME_W / 2 - title.width / 2 < clear; size -= 2) {
    title.setFontSize(size - 2);
  }
  c.add(title);
  c.add(S().add.rectangle(GAME_W / 2, 38, 240, 3, PALETTE.slate));
  timerBar = S().add.rectangle(GAME_W / 2 - 120, 38, 240, 3, PALETTE.ember).setOrigin(0, 0.5);
  c.add(timerBar);

  // ---- what has been strapped on so far, in its own column
  c.add(centerText(S(), 34, 46, 'FROGGY', PALETTE.ash));
  previewC = S().add.container(34, 122);
  previewC.setScale(0.78);
  c.add(previewC);
  redrawPreview();

  // ---- and the card for whichever chest is lit
  const px = 70;
  c.add(S().add.rectangle(px, 42, GAME_W - px - 5, 84, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel));
  panelChip = S().add.rectangle(px + 5, 47, 9, 9, PALETTE.slate).setOrigin(0, 0);
  c.add(panelChip);
  for (let i = 0; i < 7; i++) {
    const t = text(S(), px + (i === 0 ? 18 : 5), 47 + i * 11, '', PALETTE.cream);
    panelText.push(t);
    c.add(t);
  }

  // ---- FIVE CHESTS, DROPPING IN.  They fall from above the frame and land
  // in a row, which is the one moment in this game that says "loot".
  for (let i = 0; i < 5; i++) {
    const box = S().add.container(CHEST_X[i], -40);
    box.add(S().add.rectangle(0, 0, CHEST_W, CHEST_H, 0x6b4a2f).setStrokeStyle(1, PALETTE.gold));
    box.add(S().add.rectangle(0, -CHEST_H / 2 + 7, CHEST_W - 2, 12, 0x8a6138));
    box.add(S().add.rectangle(0, -CHEST_H / 2 + 13, CHEST_W, 2, 0x3f2a18));
    box.add(S().add.rectangle(0, 2, 8, 9, PALETTE.gold));
    // No quality tag.  Five identical boxes is the point: a chest that
    // advertises what grade it is has already been opened.
    box.add(centerText(S(), 0, CHEST_H / 2 - 6, '?', PALETTE.gold));
    box.setSize(CHEST_W, CHEST_H).setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => {
      if (phase !== 'pick') return;
      if (hi === i) take(i);
      else highlight(i);
    });
    chests.push(box);
    c.add(box);
    // ---- THE DROP.  It falls, it lands hard, it throws sand, and the
    // whole frame twitches -- five boxes arriving should be an event.
    S().tweens.add({
      targets: box,
      y: CHEST_Y,
      duration: 340,
      delay: i * 70,
      ease: 'Bounce.easeOut',
      onStart: () => box.setScale(0.92, 1.1),
      onComplete: () => {
        audio.sfx('item_thud', 0.42);
        S().cameras.main.shake(90, 0.0035);
        // it squashes on the landing and springs back
        S().tweens.add({ targets: box, scaleX: 1.14, scaleY: 0.84, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
        for (let d = 0; d < 5; d++) {
          const dust = S().add.rectangle(CHEST_X[i] + (d - 2) * 5, CHEST_Y + CHEST_H / 2 - 2, 3, 2, 0xc2a173).setDepth(12);
          layer?.add(dust);
          S().tweens.add({
            targets: dust, x: dust.x + (d - 2) * 7, y: dust.y - 5 - Math.random() * 4, alpha: 0,
            duration: 300 + Math.random() * 160, onComplete: () => dust.destroy(),
          });
        }
      },
    });
  }
  const hint = centerText(S(), GAME_W / 2, 171, '[<-] [->] CHOOSE   [SPACE] OPEN IT', PALETTE.ash);
  revealHint = hint;
  c.add(hint);
  highlight(0, true);
}

/**
 * FROGGY, WEARING ONLY WHAT HE HAS ACTUALLY OPENED.
 *
 * Everything not yet taken is drawn as bare frog and NOT as a faint ghost of
 * what might be coming.  The faint version was still a preview: it put a
 * weapon in his hand at fifteen percent alpha before a single chest had been
 * touched, which is both a lie about what he is holding and a hint about what
 * the stage is for.  He stands there empty handed instead, and the hand fills
 * when a chest fills it.
 */
function redrawPreview(): void {
  if (!previewC) return;
  previewC.removeAll(true);
  const kit: Kit = {
    weapon: picked.weapon ?? emptyHands(),
    head: picked.head ?? makeArmour('head', MATERIALS[0]),
    body: picked.body ?? makeArmour('body', MATERIALS[0]),
    legs: picked.legs ?? makeArmour('legs', MATERIALS[0]),
  };
  const ghost = makeFighter('frog', kit, 0, 1);
  const art = buildFighter(S(), ghost);
  art.root.setPosition(0, 0);
  art.root.setDepth(0);
  // Not taken means not drawn.  Not "drawn faintly".
  if (!picked.head) art.helm.setVisible(false);
  if (!picked.body) art.cuirass.setVisible(false);
  if (!picked.legs) { art.greaveL.setVisible(false); art.greaveR.setVisible(false); }
  if (!picked.weapon) art.weapon.setVisible(false);
  previewC.add(art.root);
}

function highlight(i: number, quiet = false): void {
  hi = i;
  chests.forEach((b, k) => {
    const frame = b.list[0] as Phaser.GameObjects.Rectangle;
    frame.setStrokeStyle(k === i ? 2 : 1, k === i ? PALETTE.gold : PALETTE.steel);
    b.setScale(k === i ? 1.08 : 1);
  });
  if (!quiet) audio.sfx('ui_hover', 0.4);
  showSealed();
}

/**
 * What a chest tells you before it is opened, which is nothing.
 *
 * It used to print the whole card on the way past -- name, power, reach, the
 * lot -- so the five boxes were really a menu with a lid drawn on it, and
 * opening one only confirmed something already read.  A reveal has to happen
 * at the moment of commitment or it is not a reveal.
 */
function showSealed(): void {
  panelChip?.setFillStyle(PALETTE.slate);
  // Short lines on purpose: the card is 235px of glass and the font walks six
  // to the character, so anything past about thirty-four runs into the border.
  const lines = [
    'SEALED',
    '',
    `SOMETHING FOR THE ${SLOT_NAME[ORDER[stage]]}.`,
    'WHAT IS IN IT IS NOT KNOWN',
    'UNTIL IT IS OPEN, AND THEN',
    'IT IS YOURS.',
    '',
  ];
  panelText.forEach((t, i) => t.setText(lines[i] ?? '').setTint(i === 0 ? PALETTE.gold : PALETTE.ash));
}

/**
 * THE CARD, AND THE EDGE OF IT.
 *
 * The panel starts at x=70 and runs to x=315; the text inside it starts at 75.
 * That is 240 pixels of glass, and the font walks a shade under six to the
 * character, so a line has about forty in it before it is through the border
 * and out of the machine.  The tuxedo's note was forty-eight characters and
 * left the screen entirely.
 *
 * Rather than counting every string by hand and hoping nobody adds a longer
 * one, anything free-form goes through `wrapTo`, and a DEV check shouts if a
 * finished line is still too wide.
 */
const CARD_COLS = 38;

/** Break a sentence on its spaces to fit `cols`, in at most `rows` lines. */
export function wrapTo(str: string, cols = CARD_COLS, rows = 2): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of str.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= cols) { line = next; continue; }
    if (line) out.push(line);
    line = word;
    if (out.length >= rows) break;
  }
  if (line && out.length < rows) out.push(line);
  return out.slice(0, rows);
}

function showCard(p: Piece | undefined): void {
  if (!p) return;
  const bar = (n: number): string => '#'.repeat(n) + '.'.repeat(10 - n);
  const lines: string[] = [];
  if (p.weapon) {
    const w = p.weapon;
    panelChip?.setFillStyle(w.key === 'none' ? PALETTE.slate : PALETTE.bone);
    lines.push(
      p.name,
      `POWER     ${bar(p.rPower)} ${p.rPower}`,
      `REACH     ${bar(p.rReach)} ${p.rReach}`,
      `HEAVINESS ${bar(p.rHeavy)} ${p.rHeavy}`,
      `RESIST    ${bar(p.rResist)} ${p.rResist}`,
      ...wrapTo(WEAPON_NOTE[w.key] ?? ''),
    );
  } else {
    const m = p.mat!;
    panelChip?.setFillStyle(m.colour);
    lines.push(
      p.name,
      `DEFENCE   ${(m.def * 100) | 0}% OF A SUIT` + (m.evade > 0 ? `, ${(m.evade * 100) | 0}% AVOID` : ''),
      `HEAVINESS ${bar(p.rHeavy)} ${p.rHeavy}`,
      `RESIST    ${bar(p.rResist)} ${p.rResist}`,
      '',
      ...wrapTo(m.note),
    );
  }
  if (import.meta.env?.DEV) {
    lines.forEach((l, i) => {
      if (l.length > CARD_COLS) console.warn(`[mash] card line ${i} is ${l.length} characters and the card holds ${CARD_COLS}: "${l}"`);
    });
  }
  panelText.forEach((t, i) => t.setText(lines[i] ?? '').setTint(i === 0 ? PALETTE.gold : i >= 5 ? PALETTE.ash : PALETTE.cream));
}

const WEAPON_NOTE: Record<string, string> = {
  none: 'AN EMPTY BOX. HE FIGHTS WITH HIS HANDS',
  knuckles: 'NO REACH AT ALL, AND IT NEVER STOPS',
  dagger: 'FAST, AND ONLY WORKS UP CLOSE',
  knife: 'FAST, AND ONLY WORKS UP CLOSE',
  nunchuck: 'A BLUR. TWO STRIKES A SWING',
  dual: 'TWO STRIKES A SWING, LIGHTER EACH',
  sword: 'GOOD AT NOTHING, BAD AT NOTHING',
  katana: 'BALANCED, WITH MORE REACH',
  shield: 'TURNS BLOWS ASIDE WHILE IT IS HELD',
  staff: 'KEEPS ITS DISTANCE AND KEEPS YOU OUT',
  axe: 'SLOW AND ENORMOUS',
  flail: 'LONG, HEAVY, SLOW TO COME ROUND',
  scythe: 'LONG REACH AND A BIG HIT, BUT SLOW',
  goldsword: 'THE HARDEST HIT HERE, AND THE SLOWEST',
};

function take(i: number): void {
  if (phase !== 'pick') return;
  const piece = offer[i];
  if (!piece) return;
  // ---- OPENED, AND THAT IS THAT.  There is no putting it back.
  picked[piece.slot] = piece;
  // 'reveal' stops the clock and takes the chests out of the player's hands
  // while the lid is up.  It is its own phase rather than the old borrowed
  // 'title' because something now actually happens during it.
  phase = 'reveal';
  audio.sfx('ui_blip', 0.6);
  audio.sfx('vault', 0.45);

  // the four not chosen drop away; the chosen one stays and opens
  chests.forEach((b, k) => {
    if (k === i) { return; }
    S().tweens.add({ targets: b, alpha: 0, y: CHEST_Y + 8, duration: 200, ease: 'Quad.easeIn' });
  });
  const box = chests[i];
  if (box) {
    // It stays on the floor and barely grows.  Lifting it and scaling it up
    // put the open lid across the bottom of the card, over the one line that
    // says what the weapon actually does -- so the reveal covered the reveal.
    S().tweens.add({ targets: box, scaleX: 1.06, scaleY: 1.06, duration: 220, ease: 'Back.easeOut' });
    const lid = box.list[1] as Phaser.GameObjects.Rectangle | undefined;
    if (lid) S().tweens.add({ targets: lid, y: lid.y - 7, angle: -16, duration: 280, ease: 'Quad.easeOut' });
    const tag = box.list[4] as Phaser.GameObjects.BitmapText | undefined;
    tag?.setText('');
  }

  // ---- AND ONLY NOW DOES IT SAY WHAT IT WAS.
  showCard(piece);
  redrawPreview();

  // The NEXT button exists only from this moment.  It is the player's signal
  // that they have read the card, so it cannot be there while the card is
  // still a row of shut boxes -- and there is no timer racing them for it.
  S().time.delayedCall(320, () => {
    if (phase !== 'reveal') return;
    revealHint?.setText('');
    // 168, not 171.  At 171 a fourteen-high button ran to 178 of 180 and sat
    // on the bezel; at 168 it clears the opened chest above it and still has
    // room below.
    buttons.push(button(S(), GAME_W / 2, 168, stage + 1 < ORDER.length ? 'NEXT' : 'TO THE COLOSSEUM', nextStage, {
      width: stage + 1 < ORDER.length ? 62 : 128, height: 13, fill: PALETTE.tealDark,
    }));
  });
}

/**
 * Past the reveal: the next five boxes, or the kit sheet if that was four.
 *
 * The opened chest collapses on its way out rather than being thrown away
 * with the layer, so the row is visibly cleared before the next one falls
 * into it -- five boxes should never simply blink into five other boxes.
 */
function nextStage(): void {
  if (phase !== 'reveal') return;
  phase = 'title'; // a holding state: nothing reads the chests while they swap
  for (const b of buttons) b.destroy();
  buttons = [];
  const survivor = chests[hi];
  if (survivor) {
    audio.sfx('crumble', 0.35);
    S().tweens.add({ targets: survivor, scaleX: 1.25, scaleY: 0.1, alpha: 0, y: CHEST_Y + 12, duration: COLLAPSE_MS, ease: 'Quad.easeIn' });
  }
  S().time.delayedCall(COLLAPSE_MS + 60, () => {
    if (stage + 1 < ORDER.length) startStage(stage + 1);
    else showSummary();
  });
}

/** The clock ran out: open what is lit, or one at random if nothing is. */
function autoPick(): void {
  take(hi >= 0 && hi < offer.length ? hi : rnd(offer.length));
}

// ------------------------------------------------------------- final build

function showSummary(): void {
  phase = 'summary';
  const kit = picked as Kit;
  frog = makeFighter('frog', kit, 100, 1);
  lizard = makeFighter('lizard', randomKit(), 220, -1);

  const c = newLayer();
  c.add(S().add.rectangle(0, 18, GAME_W, 162, 0x241b13).setOrigin(0, 0));
  c.add(centerText(S(), GAME_W / 2, 27, 'FROGGY IS ARMED', PALETTE.gold, 16));

  const art = buildFighter(S(), frog);
  art.root.setPosition(52, 128);
  c.add(art.root);

  const px = 108;
  c.add(S().add.rectangle(px, 40, GAME_W - px - 6, 98, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel));
  // The four the spec names, on the scales it names them on, so the sheet and
  // the brief read the same: ten power, a hundred speed, fifty avoidance and
  // twenty distance is Froggy with nothing on.
  const rows: Array<[string, string, number]> = [
    ['WEAPON', kit.weapon.name, PALETTE.bone],
    ['POWER', frog.st.powerPts.toFixed(0), PALETTE.ember],
    ['SPEED', frog.st.speedPts.toFixed(0), PALETTE.gold],
    ['AVOIDANCE', frog.st.avoidPts.toFixed(0), PALETTE.tealLight],
    ['DISTANCE', frog.st.distPts.toFixed(0), PALETTE.fog],
    ['DEFENCE', `${Math.round(frog.st.defence * 100)}%`, PALETTE.steel],
    ['HEALTH', String(frog.st.maxHp), PALETTE.mossLight],
  ];
  rows.forEach(([k, v, col], i) => {
    c.add(text(S(), px + 7, 45 + i * 13, k, PALETTE.ash));
    c.add(text(S(), GAME_W - 13, 45 + i * 13, v, col).setOrigin(1, 0));
  });
  // The three pieces by MATERIAL only.  Spelling each one out in full came to
  // "TUXEDO HELM - LEATHER ARMOUR CUIRASS - NO GREAVES", which is forty-nine
  // characters on a line that holds about fifty-three and was centred, so it
  // ran off both edges at once.  The slot is obvious from the order.
  const worn = (['head', 'body', 'legs'] as const)
    .map((sl) => (kit[sl].mat!.key === 'none' ? 'NONE' : kit[sl].mat!.name.replace(' ARMOUR', '')))
    .join('  /  ');
  c.add(centerText(S(), GAME_W / 2, 143, worn, PALETTE.ash));
  // The last decision the player made was the fourth chest.  This is a sheet
  // to read, not a thing to answer, so it goes on its own -- the button only
  // skips the wait for anyone who has finished reading.  `showEntry` guards on
  // the phase, so the click and the timer cannot both fire it.
  buttons.push(button(S(), GAME_W / 2, 161, 'TO THE COLOSSEUM', showEntry, { width: 140, height: 14, fill: PALETTE.blood }));
  S().time.delayedCall(SUMMARY_MS, showEntry);
}

// ------------------------------------------------------------- the arena

function showEntry(): void {
  if (phase !== 'summary') return;
  phase = 'entry';
  const c = newLayer();
  crowd = buildArena(S(), c);

  // ---- both of them walk in from their own gate.  Nothing is pressed.
  frog!.x = -20;
  lizard!.x = GAME_W + 20;
  frog!.hp = frog!.st.maxHp;
  lizard!.hp = lizard!.st.maxHp;
  for (const f of [frog!, lizard!]) {
    f.art = buildFighter(S(), f);
    c.add(f.art.root);
  }
  buildHud(c);

  callOut = centerText(S(), GAME_W / 2, 58, '', PALETTE.gold, 16).setDepth(40);
  c.add(callOut);
  audio.sfx('bell_ding', 0.7);

  S().tweens.add({ targets: { v: 0 }, v: 1, duration: 1100, onUpdate: (tw) => {
    const k = tw.getValue() as number;
    frog!.x = -20 + k * 120;
    lizard!.x = GAME_W + 20 - k * 120;
    frog!.step += 4;
    lizard!.step += 4;
    poseFighter(frog!, lizard!);
    poseFighter(lizard!, frog!);
  } });
  callOut.setText('FROGGY VS LIZARD');
  S().time.delayedCall(1250, () => {
    callOut?.setText('FIGHT!');
    audio.sfx('stinger', 0.6);
    S().tweens.add({ targets: callOut, scaleX: 1.4, scaleY: 1.4, alpha: 0, duration: 700 });
    fightT = 0;
    phase = 'fight';
  });
}

/**
 * THE SCOREBOARD, KEPT TO ONE BAND AT THE TOP.
 *
 * It used to run from 22 down to 56 -- a third of the whole picture -- and
 * the arena was built behind it, so two of the three banks of seating were
 * under the words FROGGY and LIZARD and nobody ever saw them.  Everything is
 * on two lines now inside a single dark strip, and the colosseum starts
 * underneath it.
 */
const HUD_BOT = 44;
function buildHud(c: Phaser.GameObjects.Container): void {
  c.add(S().add.rectangle(0, 18, GAME_W, HUD_BOT - 18, 0x0d0a07, 0.72).setOrigin(0, 0).setDepth(39));
  const bar = (x: number, who: 'frog' | 'lizard', label: string, colour: number, kit: Kit, right: boolean): void => {
    c.add(text(S(), x, 20, label, PALETTE.cream).setDepth(41));
    hpNum[who] = text(S(), x + 130, 20, '', colour).setOrigin(1, 0).setDepth(41);
    c.add(hpNum[who]!);
    c.add(S().add.rectangle(x, 28, 130, 5, PALETTE.black, 0.8).setOrigin(0, 0).setDepth(40));
    hpBar[who] = S().add.rectangle(x + 1, 29, 128, 3, colour).setOrigin(0, 0).setDepth(41);
    c.add(hpBar[who]!);
    // what it is holding and what that is worth, on the one line
    const def = Math.round(Math.min(75, kit.head.prot + kit.body.prot + kit.legs.prot));
    kitLine[who] = text(S(), right ? x + 130 : x, 35, '', PALETTE.bone).setDepth(41).setOrigin(right ? 1 : 0, 0);
    c.add(kitLine[who]!);
    // Defence shares the weapon's row at the far end of it.  On the name row
    // it ran into the health numbers; in the middle of the strip the two
    // halves of the scoreboard ran into each other.  The weapon name is cut
    // to twelve characters so the two never meet.
    c.add(text(S(), right ? x : x + 130, 35, `DEF ${def}%`, PALETTE.ash).setDepth(41).setOrigin(right ? 0 : 1, 0));
  };
  bar(8, 'frog', 'FROGGY', PALETTE.mossLight, frog!.kit, false);
  bar(GAME_W - 138, 'lizard', 'LIZARD', PALETTE.amber, lizard!.kit, true);
  refreshHud();
}

function refreshHud(): void {
  for (const who of ['frog', 'lizard'] as const) {
    const f = who === 'frog' ? frog! : lizard!;
    const b = hpBar[who];
    if (b) b.width = Math.max(0, Math.round((Math.max(0, f.hp) / f.st.maxHp) * 128));
    hpNum[who]?.setText(`${Math.max(0, f.hp)} / ${f.st.maxHp}`);
    kitLine[who]?.setText(f.broken ? 'BARE HANDS' : f.weapon.name.slice(0, 14)).setTint(f.broken ? PALETTE.blood : PALETTE.bone);
  }
}

/** A number coming off somebody, and the burst where it landed. */
function showBlow(f: Fighter, blow: Blow): void {
  const x = f.x;
  if (blow.dodged) {
    floating(x, 'MISS', PALETTE.fog);
    audio.sfx('throw_whoosh', 0.3);
    return;
  }
  if (!blow.hit) return;
  floating(x, `-${blow.dmg}`, blow.guarded ? PALETTE.tealLight : PALETTE.cream);
  audio.sfx(blow.dmg >= 12 ? 'boom' : blow.guarded ? 'fence_thunk' : 'whack', blow.dmg >= 12 ? 0.5 : 0.4);
  audio.sfx('item_thud', 0.3);
  f.stun = Math.min(0.28, blow.dmg / 60);

  // ---- IT MOVES THE BODY IT LANDED ON.  A shove away from the swing, sized
  // by the damage and capped so a heavy blow cannot fling anybody across the
  // sand, and a white frame on the part that was hit.  Both are drawing only:
  // `shove` is added at draw time and `x` never hears about it.
  f.shove = -f.face * Math.min(7, 1.5 + blow.dmg * 0.34);
  if (f.art) for (const part of [f.art.torso, f.art.head, f.art.cuirass, f.art.helm]) flashWhite(part);
  for (let i = 0; i < (blow.dmg >= 12 ? 6 : 3); i++) {
    const a = (i / 5) * Math.PI * 2 + Math.random();
    const bit = S().add.rectangle(x, FLOOR_Y - 22, 3, 3, blow.guarded ? PALETTE.steel : PALETTE.blood).setDepth(30);
    layer?.add(bit);
    S().tweens.add({
      targets: bit, x: x + Math.cos(a) * 16, y: FLOOR_Y - 22 + Math.sin(a) * 12,
      alpha: 0, duration: 300, onComplete: () => bit.destroy(),
    });
  }
  if (blow.dmg >= 12) S().cameras.main.shake(140, 0.005);
}

function floating(x: number, str: string, colour: number): void {
  const t = centerText(S(), x, FLOOR_Y - 46, str, colour).setDepth(42);
  layer?.add(t);
  S().tweens.add({ targets: t, y: FLOOR_Y - 66, alpha: 0, duration: 700, onComplete: () => t.destroy() });
}

/** A weapon gives out, in front of everybody. */
/**
 * One white frame on a piece of a fighter, and then its own colour back.
 *
 * The colour is read off the shape the first time it is asked to flash and
 * kept until it is given back, because a second blow landing mid-flash would
 * otherwise "restore" it to white for the rest of the fight.
 */
const flashFrom = new Map<Phaser.GameObjects.Shape, number>();
function flashWhite(part: Phaser.GameObjects.Shape): void {
  if (!flashFrom.has(part)) flashFrom.set(part, part.fillColor);
  part.setFillStyle(PALETTE.cream);
  S().time.delayedCall(70, () => {
    const was = flashFrom.get(part);
    if (was === undefined) return;
    flashFrom.delete(part);
    if (part.active) part.setFillStyle(was);
  });
}

/**
 * TWO WEAPONS MEETING, WHICH IS THE ONE THING IN HERE NOBODY IS HIT BY.
 *
 * Sparks at the midpoint, a ring, both of them thrown back, and the frame
 * kicks.  It reads as the loudest thing in the fight because it is the
 * rarest, and it costs both of them the swing they had just paid for.
 */
function showClash(a: Fighter, b: Fighter): void {
  const mid = (a.x + b.x) / 2;
  audio.sfx('fence_thunk', 0.6);
  audio.sfx('whack', 0.35);
  floating(mid, 'CLASH!', PALETTE.gold);
  S().cameras.main.shake(180, 0.007);
  for (const f of [a, b]) f.shove = (f.x < mid ? -1 : 1) * 6;
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const spark = S().add.rectangle(mid, FLOOR_Y - 26, 2, 2, i % 2 ? PALETTE.gold : PALETTE.cream).setDepth(33);
    layer?.add(spark);
    S().tweens.add({
      targets: spark, x: mid + Math.cos(ang) * 22, y: FLOOR_Y - 26 + Math.sin(ang) * 16, alpha: 0,
      duration: 260 + Math.random() * 140, onComplete: () => spark.destroy(),
    });
  }
}

function showBreak(f: Fighter): void {
  audio.sfx('crumble', 0.7);
  audio.sfx('buzzer', 0.3);
  floating(f.x, 'WEAPON BROKEN!', PALETTE.blood);
  // the thing itself, spinning off into the sand
  const shard = buildWeapon(S(), f.kit.weapon.weapon!.key, PALETTE.bone);
  shard.setPosition(f.x + f.face * 10, FLOOR_Y - 24).setDepth(31);
  layer?.add(shard);
  S().tweens.add({
    targets: shard, x: f.x + f.face * 46, y: FLOOR_Y - 2, angle: 540, alpha: 0,
    duration: 700, onComplete: () => shard.destroy(),
  });
  // and the hand it left is empty from here on
  if (f.art) {
    f.art.weapon.destroy();
    const fists = buildWeapon(S(), 'fists', f.who === 'frog' ? PALETTE.mossLight : PALETTE.amber);
    fists.setPosition(11, 0);
    f.art.arm.add(fists);
    f.art.weapon = fists;
  }
  S().cameras.main.shake(200, 0.006);
}

/**
 * The fight, a frame at a time, and the player has nothing to do with it.
 *
 * Both fighters get the identical pair of calls in the identical order, and
 * the only thing that differs between them is the equipment they walked in
 * with.  There is no branch in here on who anybody is.
 */
function stepFight(real: number): void {
  // ONE KNOB FOR THE WHOLE FIGHT.  See PACE: scaling the step scales every
  // duration in the rules together, so the fight is quicker without any two
  // things changing position relative to each other.
  const dt = real * PACE;
  fightT += dt;
  for (const e of exchange(frog!, lizard!, dt)) {
    if (e.blow.broke) showBreak(e.att);
    if (e.blow.clashed) showClash(e.att, e.def);
    else showBlow(e.def, e.blow);
  }
  // the knock-back easing off, which is drawing and nothing else
  for (const f of [frog!, lizard!]) {
    if (f.shove !== 0) {
      f.shove -= f.shove * Math.min(1, SHOVE_DECAY * real);
      if (Math.abs(f.shove) < 0.05) f.shove = 0;
    }
  }
  poseFighter(frog!, lizard!);
  poseFighter(lizard!, frog!);
  refreshHud();
  // the crowd, which is only ever doing one thing
  for (let i = 0; i < crowd.length; i++) {
    crowd[i].y = 30 + Math.floor(i / 48) * 32 + (i % 3) + Math.sin(fightT * 6 + i) * 1.2;
  }
  if (frog!.hp <= 0 || lizard!.hp <= 0) finishFight(lizard!.hp <= 0);
}

// --------------------------------------------------------------- the result

/**
 * HOW IT ENDED, TOLD BY THE TWO OF THEM AND NOT BY A BOX.
 *
 * There used to be a slab across the middle of the arena reading FROGSTER
 * DEFEATED, which covered the one thing worth looking at -- the fighters --
 * with an announcement of something the empty health bar had already said.
 * It is gone, and nothing large has taken its place: the loser goes down in
 * four beats and the winner celebrates, and the only text is the reward,
 * which rises off Froggy and is worth knowing.
 */
function finishFight(won: boolean): void {
  phase = 'over';
  for (const b of buttons) b.destroy();
  buttons = [];

  const winner = won ? frog! : lizard!;
  const loser = won ? lizard! : frog!;
  audio.sfx(won ? 'zone_clear' : 'death_stinger', 0.7);
  S().cameras.main.shake(260, 0.006);

  goesDown(loser);
  celebrates(winner, won);

  S().time.delayedCall(won ? OVER_WIN_MS : OVER_LOSE_MS, () => finish(won));
}

/**
 * THE DEFEAT, IN FOUR BEATS.
 *
 * Knocked back, on the knees, face down, still.  Doing it in beats rather
 * than one tween is the whole difference between a body falling over and a
 * sprite being rotated eighty degrees.
 */
function goesDown(f: Fighter): void {
  const a = f.art;
  if (!a) return;
  const sc = S();

  // 1. thrown back off the blow that did it
  sc.tweens.add({ targets: a.root, x: a.root.x - f.face * 9, duration: 140, ease: 'Quad.easeOut' });
  // the weapon leaves the hand
  if (!f.broken && f.kit.weapon.weapon && f.kit.weapon.weapon.key !== 'none') {
    const drop = buildWeapon(sc, f.kit.weapon.weapon.key, PALETTE.bone);
    drop.setPosition(a.root.x + f.face * 10, FLOOR_Y - 22).setDepth(31);
    layer?.add(drop);
    sc.tweens.add({ targets: drop, x: drop.x + f.face * 26, y: FLOOR_Y - 3, angle: 300, duration: 620, ease: 'Quad.easeIn' });
    a.weapon.setVisible(false);
  }
  // 2. the legs go: down onto the knees, head forward
  sc.tweens.add({ targets: a.torso, angle: f.face * 26, duration: 300, delay: 150, ease: 'Quad.easeIn' });
  sc.tweens.add({ targets: a.cuirass, angle: f.face * 26, duration: 300, delay: 150, ease: 'Quad.easeIn' });
  sc.tweens.add({ targets: [a.head, a.helm], y: '+=7', duration: 300, delay: 150, ease: 'Quad.easeIn' });
  sc.tweens.add({ targets: a.root, y: FLOOR_Y + 5, duration: 300, delay: 150, ease: 'Quad.easeIn' });
  sc.tweens.add({ targets: a.arm, angle: f.face * 60, duration: 300, delay: 150 });
  sc.time.delayedCall(430, () => audio.sfx('item_thud', 0.4));
  // 3. and over, flat, into the sand
  sc.tweens.add({
    targets: a.root, angle: f.face * -84, y: FLOOR_Y + 9, duration: 340, delay: 520, ease: 'Quad.easeIn',
    onComplete: () => {
      audio.sfx('crumble', 0.5);
      S().cameras.main.shake(140, 0.004);
      for (let i = 0; i < 9; i++) {
        const d = S().add.rectangle(a.root.x + (i - 4) * 4, FLOOR_Y - 1, 3, 2, 0xc2a173).setDepth(12);
        layer?.add(d);
        S().tweens.add({ targets: d, x: d.x + (i - 4) * 6, y: d.y - 4 - Math.random() * 6, alpha: 0, duration: 420, onComplete: () => d.destroy() });
      }
    },
  });
  // 4. and stays there
  sc.tweens.add({ targets: a.root, alpha: 0.6, duration: 500, delay: 900 });
}

/** The winner: arm up, three hops, and the crowd. */
function celebrates(f: Fighter, won: boolean): void {
  const a = f.art;
  if (!a) return;
  const sc = S();
  sc.tweens.add({ targets: a.arm, angle: -104, duration: 260, delay: 420, ease: 'Back.easeOut' });
  sc.tweens.add({ targets: a.torso, angle: 0, duration: 260, delay: 420 });
  sc.time.delayedCall(560, () => {
    audio.sfx('zone_clear', 0.45);
    sc.tweens.add({ targets: a.root, y: FLOOR_Y - 11, duration: 190, yoyo: true, repeat: 3, ease: 'Quad.easeOut' });
  });
  // the crowd comes up out of its seats
  crowd.forEach((r, i) => {
    sc.tweens.add({ targets: r, y: r.y - 3 - (i % 3), duration: 150 + (i % 5) * 28, yoyo: true, repeat: 6, delay: 520 + (i % 7) * 30 });
  });

  if (!won) return;
  // ---- THE REWARD.  Text, but not a box: it rises off him and goes.
  sc.time.delayedCall(700, () => {
    audio.sfx('cha_ching', 0.6);
    const gain = centerText(sc, a.root.x, FLOOR_Y - 46, '+30 TOKENS', PALETTE.gold, 16).setDepth(61);
    layer?.add(gain);
    sc.tweens.add({ targets: gain, y: FLOOR_Y - 66, duration: 1500, ease: 'Quad.easeOut' });
    sc.tweens.add({ targets: gain, alpha: 0, duration: 520, delay: 1600 });
  });
}

/**
 * Say which way it went, once and once only.
 *
 * `ended` latches before anything else happens, so a double-tapped button, a
 * tween that fires twice and a player who finds a second route all end up
 * reporting the same single result -- and the shell's own latch is behind
 * this one, which is two locks on the only door the thirty tokens come out of.
 */
function finish(won: boolean): void {
  if (ended) return;
  ended = true;
  for (const b of buttons) b.destroy();
  buttons = [];
  if (won) apiRef!.win();
  else apiRef!.lose();
}

// =================================================================== module

export const frogsterMash: MinigameModule = {
  id: ID,
  title: 'FROGSTER MASH',
  music: 'game_frogstermash',
  rules: 'open four chests, then watch them settle it',
  tutorial: {
    objective: [
      'OPEN FOUR CHESTS: A WEAPON, AND ARMOUR FOR HEAD, BODY AND LEGS.',
      'WHAT IS IN THE CHEST IS YOURS. THERE IS NO PUTTING IT BACK.',
      'THEN FROGGY FIGHTS THE LIZARD BY HIMSELF. WIN AND TAKE 30.',
    ],
    controls: [
      ['LEFT/RIGHT', 'INSPECT THE CHESTS'],
      ['SPACE', 'OPEN THE LIT CHEST'],
      ['CLICK', 'INSPECT, THEN CLICK AGAIN TO OPEN'],
      ['NOTHING', 'THE FIGHT ITSELF IS NOT YOURS'],
    ],
  },
  // Nothing to steer and nothing to press once the chests are done, so the
  // phone gets the two buttons the chests need and no more.
  touch: {
    stick: 'lr',
    arrows: true,
    buttons: [{ label: 'OPEN', key: 'SPACE', primary: true }],
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    scene0 = scene;
    apiRef = api;
    layer = null;
    reset();

    const kb = scene.input.keyboard;
    const left = (): void => {
      if (phase === 'pick') highlight((hi + offer.length - 1) % offer.length);
    };
    const right = (): void => {
      if (phase === 'pick') highlight((hi + 1) % offer.length);
    };
    const open = (): void => {
      if (phase === 'pick') take(hi);
      else if (phase === 'reveal' && buttons.length) nextStage();
    };
    kb?.on('keydown-LEFT', left);
    kb?.on('keydown-A', left);
    kb?.on('keydown-RIGHT', right);
    kb?.on('keydown-D', right);
    kb?.on('keydown-SPACE', open);
    kb?.on('keydown-ENTER', open);

    showTitle();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__mash = {
        state: () => ({
          phase,
          stage,
          slot: ORDER[stage],
          hi,
          pickT: Math.round(pickT),
          ended,
          fightT: +fightT.toFixed(2),
          offer: offer.map((p) => ({ name: p.name, quality: p.quality, prot: +p.prot.toFixed(2), heavy: +p.heavy.toFixed(2), weapon: p.weapon?.key })),
          picked: ORDER.filter((s) => picked[s]).map((s) => ({ slot: s, name: picked[s]!.name, quality: picked[s]!.quality })),
          frog: frog && snap(frog),
          lizard: lizard && snap(lizard),
        }),
        highlight: (i: number) => highlight(i),
        take: (i: number) => take(i),
        /** Open a chest holding a named weapon at this stage, if one is on offer. */
        takeWeapon: (key: string) => {
          const i = offer.findIndex((p) => p.weapon?.key === key);
          if (i >= 0) take(i);
          return i >= 0;
        },
        setHp: (who: 'frog' | 'lizard', n: number) => {
          const f = who === 'frog' ? frog : lizard;
          if (f) f.hp = n;
          refreshHud();
        },
        /** Snap a weapon to one swing off breaking, to watch it go. */
        fray: (who: 'frog' | 'lizard') => {
          const f = who === 'frog' ? frog : lizard;
          if (f && Number.isFinite(f.dur)) f.dur = 1;
        },
        /** The rules and the headless simulator, so a build can be checked. */
        rules: { WEAPONS, MATERIALS, UNARMED, QUALITY_MUL, statsOf, makeFighter, resolveStrike, tick, think, exchange, simulate, randomKit, offerFor, makeWeapon, makeArmour, breakWeapon, durabilityOf, wrapTo, WEAPON_NOTE, CARD_COLS, BASE },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__mash;
      });
    }
  },

  update(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    if (phase === 'pick') {
      const before = pickT;
      pickT -= delta;
      if (timerBar) timerBar.width = Math.max(0, (pickT / PICK_MS) * 240);
      if (before > 2000 && pickT <= 2000) audio.sfx('buzzer', 0.25);
      if (pickT <= 0) autoPick();
      return;
    }
    if (phase === 'fight') stepFight(dt);
  },

  destroy() {
    const kb = scene0?.input.keyboard;
    for (const k of ['LEFT', 'RIGHT', 'A', 'D', 'SPACE', 'ENTER']) kb?.off(`keydown-${k}`);
    for (const b of buttons) b.destroy();
    buttons = [];
    layer?.destroy(true);
    layer = null;
    previewC = null;
    scene0 = null;
    apiRef = null;
    reset();
  },
};

/** One fighter, as numbers, for the harness. */
function snap(f: Fighter): Record<string, unknown> {
  return {
    hp: Math.max(0, f.hp), maxHp: f.st.maxHp, x: Math.round(f.x), act: f.act,
    weapon: f.weapon.key, broken: f.broken, dur: Number.isFinite(f.dur) ? f.dur : -1,
    power: +f.st.power.toFixed(2), rate: +f.st.rate.toFixed(2), walk: +f.st.walk.toFixed(1),
    avoid: +f.st.avoid.toFixed(3), defence: +f.st.defence.toFixed(3), reach: f.st.reach, range: f.st.range,
    // drawing state, exposed so a test can prove it never reaches `x`
    shove: +f.shove.toFixed(2), drawX: Math.round(drawX(f, f.who === 'frog' ? lizard ?? undefined : frog ?? undefined)),
  };
}
