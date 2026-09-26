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
 * ONE ATTACK, OUT OF THE HANDFUL A WEAPON KNOWS.
 *
 * A weapon is not one swing with a damage number on it.  Every weapon carries
 * four to six MOVES, and which one it throws is chosen from the situation --
 * how far away the other one is, whether it has just slipped a blow, whether
 * the other one is nearly finished, whether it is buried in armour.
 *
 * None of this is decoration.  A move changes the damage, the wind-up, the
 * distance it will reach, the number of strikes, and what it does on landing,
 * so picking a thrust instead of a sweep genuinely changes the fight -- and
 * `anim` changes the arc the arm travels, so it looks like what it is.
 */
export type Anim = 'over' | 'sweep' | 'thrust' | 'spin' | 'jab' | 'bash' | 'low' | 'punch' | 'hook' | 'upper' | 'shove' | 'kick' | 'shoot' | 'hurl' | 'puff' | 'charge';
export interface Move {
  name: string;
  /** Multipliers on the swing this move is a version of. */
  dmg: number;
  wind: number;
  reach: number;
  hits?: number;
  stagger?: number;
  knock?: number;
  /** Where it wants to be used: far out, in close, or anywhere. */
  at?: 'far' | 'near';
  /** What has to be true: off a dodge, finishing, or against armour. */
  when?: 'counter' | 'finish' | 'armour';
  anim: Anim;
}

/**
 * The shared move vocabulary.  Weapons name their own versions of these, so a
 * scythe's sweep and a claymore's sweep are the same IDEA with different
 * numbers on it -- and neither is the other one's animation with a new label.
 */
const M = {
  over: (name: string, dmg = 1.25, wind = 1.3): Move => ({ name, dmg, wind, reach: 0.92, stagger: 0.12, anim: 'over' }),
  sweep: (name: string, dmg = 1.05, reach = 1.18): Move => ({ name, dmg, wind: 1.12, reach, knock: 3, anim: 'sweep' }),
  thrust: (name: string, dmg = 1.0, reach = 1.3): Move => ({ name, dmg, wind: 0.9, reach, at: 'far', anim: 'thrust' }),
  stab: (name: string, dmg = 0.82): Move => ({ name, dmg, wind: 0.6, reach: 0.9, hits: 2, at: 'near', anim: 'jab' }),
  spin: (name: string, dmg = 1.3): Move => ({ name, dmg, wind: 1.45, reach: 1.1, knock: 5, stagger: 0.18, anim: 'spin' }),
  slam: (name: string, dmg = 1.5): Move => ({ name, dmg, wind: 1.6, reach: 0.85, stagger: 0.35, knock: 8, anim: 'over' }),
  combo: (name: string, hits = 3): Move => ({ name, dmg: 0.62, wind: 0.68, reach: 0.9, hits, at: 'near', anim: 'jab' }),
  counter: (name: string, dmg = 1.45): Move => ({ name, dmg, wind: 0.45, reach: 1.0, when: 'counter', anim: 'thrust' }),
  finish: (name: string, dmg = 1.7): Move => ({ name, dmg, wind: 1.5, reach: 0.95, when: 'finish', stagger: 0.3, anim: 'over' }),
  crush: (name: string, dmg = 1.2): Move => ({ name, dmg, wind: 1.25, reach: 0.9, when: 'armour', stagger: 0.2, anim: 'over' }),
  low: (name: string, dmg = 0.95): Move => ({ name, dmg, wind: 0.95, reach: 1.05, knock: 4, stagger: 0.2, anim: 'low' }),
  bash: (name: string, dmg = 0.9): Move => ({ name, dmg, wind: 0.8, reach: 0.85, knock: 9, stagger: 0.28, at: 'near', anim: 'bash' }),
  charge: (name: string, dmg = 1.25): Move => ({ name, dmg, wind: 1.05, reach: 1.45, at: 'far', knock: 6, anim: 'thrust' }),
  // ---- A SHIELD CHARGE IS A RUN, NOT A THRUST.
  //
  // It starts from well outside the shield's own reach -- the move's reach is
  // where the run begins -- and the wind-up is the run itself: shield up in
  // front of the chest, head down behind it, feet going.  What it lands is
  // not much damage and a great deal of shove: see `CHARGE_MUL` in `tick` and
  // the push in `resolveStrike`.
  ram: (name: string, dmg = 0.9): Move => ({ name, dmg, wind: 1.15, reach: 3.0, at: 'far', knock: 12, stagger: 0.18, anim: 'charge' }),
  // ---- THE TWO RANGED SHAPES.  `shoot` draws a bow or levels a crossbow and
  // `hurl` throws overarm; both want distance, so they score badly in a
  // clinch and the weapon falls back on its close attacks there.
  shoot: (name: string, dmg = 1.0): Move => ({ name, dmg, wind: 1.0, reach: 1.5, at: 'far', anim: 'shoot' }),
  /** A pipe raised to the lips and a hard breath down it.  See `poseFighter`. */
  puff: (name: string, dmg = 1.0): Move => ({ name, dmg, wind: 0.85, reach: 1.5, at: 'far', anim: 'puff' }),
  hurl: (name: string, dmg = 1.0): Move => ({ name, dmg, wind: 1.05, reach: 1.5, at: 'far', anim: 'hurl' }),
};

/** The repertoire each weapon actually fights with. */
export const MOVES: Record<string, Move[]> = {
  // ---- UNARMED, AND IT FIGHTS LIKE IT.  Punches and kicks with their own
  // arcs, not a sword swing with the sword taken out.  Deliberately the
  // weakest row on the table: quick, close, and nothing like enough.
  none: [
    { name: 'JAB COMBO', dmg: 0.6, wind: 0.55, reach: 0.95, hits: 3, at: 'near', anim: 'punch' },
    { name: 'STRAIGHT RIGHT', dmg: 0.95, wind: 0.7, reach: 1.0, anim: 'punch' },
    { name: 'BODY HOOK', dmg: 0.85, wind: 0.62, reach: 0.9, at: 'near', stagger: 0.1, anim: 'hook' },
    { name: 'UPPERCUT', dmg: 1.15, wind: 0.85, reach: 0.85, at: 'near', stagger: 0.22, anim: 'upper' },
    // Almost no damage and a long shove: the point of it is the distance it
    // buys somebody with nothing in their hands, not the hit.
    { name: 'SHOVE', dmg: 0.35, wind: 0.5, reach: 0.95, at: 'near', knock: 9, stagger: 0.14, anim: 'shove' },
    { name: 'LOW KICK', dmg: 1.05, wind: 0.95, reach: 1.15, knock: 4, stagger: 0.18, anim: 'kick' },
    { name: 'COUNTER PUNCH', dmg: 1.3, wind: 0.45, reach: 1.0, when: 'counter', anim: 'upper' },
  ],
  knuckles: [M.combo('PUNCH COMBO', 3), M.bash('UPPERCUT', 1.1), M.stab('HOOK'), M.charge('RUSH', 1.0)],
  // ---- the ten added to the rack
  sickle: [M.stab('HOOKING SLASH'), M.low('ANKLE HOOK'), M.combo('TWO QUICK CUTS', 2), M.counter('CATCH AND PULL', 1.3)],
  warfan: [M.combo('FAN FLURRY', 3), M.sweep('SPREAD SWEEP', 0.95, 1.1), M.counter('FOLDING PARRY', 1.35), M.stab('FAN JAB')],
  scimitar: [M.sweep('CURVING SLASH', 1.1, 1.15), M.over('RISING CUT', 1.2), M.spin('TURNING SLASH', 1.1), M.counter('DRAW CUT', 1.3)],
  estoc: [M.crush('PLATE SPLITTER', 1.4), M.thrust('DRIVING THRUST', 1.05, 1.25), M.stab('SHORT POINT'), M.counter('STOP THRUST', 1.35)],
  pike: [M.thrust('SET AND BRACE', 1.05, 1.5), M.thrust('LONG REACH', 0.95, 1.6), M.low('BUTT SPIKE'), M.counter('RECEIVE THE CHARGE', 1.45)],
  glaive: [M.sweep('WIDE ARC', 1.15, 1.25), M.over('OVERHEAD CLEAVE', 1.25), M.thrust('POINT WORK', 1.0, 1.35), M.spin('TURNING CUT', 1.15)],
  maul: [M.over('OVERHEAD MAUL', 1.35, 1.45), M.slam('FLATTENING BLOW', 1.3), M.bash('HAFT SMASH'), M.finish('FINISHING SWING', 1.4)],
  bardiche: [M.sweep('HEAVY ARC', 1.2, 1.2), M.over('SPLITTING BLOW', 1.3), M.crush('ARMOUR BREAKER', 1.25), M.low('LEG CHOP')],
  harpoon: [M.hurl('HARPOON THROW', 1.2), M.thrust('BARBED THRUST', 1.05, 1.3), M.stab('CLOSE BARB'), M.counter('HOOK AND HAUL', 1.3)],
  bolas: [M.hurl('BOLAS THROW'), M.hurl('TANGLING THROW', 1.05), M.stab('CLOSE SWING'), M.counter('WHIP ROUND', 1.2)],
  dagger: [M.stab('RAPID STAB'), M.combo('DOUBLE STAB', 2), M.low('LOW SLASH'), M.counter('BACKSTEP COUNTER', 1.3)],
  twindagger: [M.combo('FOUR HIT FLURRY', 4), M.stab('ALTERNATING STABS'), M.spin('SPINNING DOUBLE', 1.0), M.counter('CROSSING SLASH', 1.25)],
  knife: [M.thrust('PRECISION THRUST', 1.1, 1.15), M.crush('ARMOUR GAP STAB', 1.35), M.stab('QUICK SLASH'), M.counter('COUNTER STRIKE')],
  rapier: [M.thrust('RAPID THRUST', 0.95, 1.25), M.stab('DOUBLE THRUST'), M.counter('CRITICAL STAB', 1.6), M.charge('PRECISION LUNGE', 1.15)],
  nunchuck: [M.combo('RAPID FLURRY', 4), M.spin('SPINNING COMBO', 1.05), M.over('OVERHEAD FLURRY', 1.1, 1.1), M.sweep('SIDE SWEEP', 0.95, 1.05)],
  dual: [M.combo('FOUR HIT COMBO', 4), M.sweep('CROSSING SLASH', 1.0, 1.05), M.spin('SPINNING DOUBLE', 1.2), M.counter('DUAL STRIKE', 1.35)],
  throwing: [M.hurl('KNIFE THROW'), M.hurl('SPINNING THROW', 1.1), M.stab('CLOSE KNIFE'), M.counter('RETREATING THROW', 1.2)],
  gladius: [M.stab('FAST SLASH'), M.thrust('SHORT THRUST', 1.05, 1.1), M.combo('CLOSE COMBINATION', 3), M.counter('FINISHING STRIKE', 1.4)],
  sword: [M.sweep('HORIZONTAL SLASH'), M.over('DIAGONAL SLASH'), M.thrust('THRUST'), M.counter('PARRY COUNTER'), M.combo('TWO HIT SLASH', 2)],
  katana: [M.sweep('IAI SLASH', 1.15, 1.1), M.counter('COUNTER SLASH', 1.7), M.thrust('PRECISION THRUST', 1.05, 1.15), M.over('DIAGONAL CUT')],
  shield: [M.bash('SHIELD BASH'), M.ram('FORWARD CHARGE'), M.counter('BLOCK COUNTER', 1.4), M.stab('STABBING BASH', 0.75)],
  spear: [M.thrust('LONG THRUST', 1.1, 1.4), M.stab('DOUBLE THRUST'), M.sweep('SHAFT STRIKE', 0.9, 1.15), M.charge('FORWARD CHARGE'), M.hurl('SPEAR THROW', 0.95)],
  staff: [M.sweep('WIDE SWEEP'), M.over('OVERHEAD STRIKE'), M.thrust('THRUST'), M.low('LEG SWEEP'), M.bash('KEEPAWAY PUSH', 0.8)],
  trident: [M.thrust('THREE POINT THRUST', 1.15, 1.35), M.sweep('HORIZONTAL SWEEP'), M.counter('COUNTER THRUST', 1.4), M.charge('CHARGING STAB'), M.hurl('TRIDENT THROW', 0.95)],
  halberd: [M.thrust('LONG THRUST', 1.1, 1.35), M.sweep('HORIZONTAL SWEEP', 1.1), M.over('OVERHEAD CHOP'), M.spin('SPINNING SWEEP'), M.low('HOOK ATTACK')],
  warscythe: [M.sweep('SWEEPING SLASH', 1.1, 1.25), M.low('LOW SWEEP'), M.spin('SPINNING SWEEP'), M.thrust('HOOKING STRIKE', 0.95, 1.2)],
  scythe: [M.sweep('HORIZONTAL SWEEP', 1.15, 1.28), M.low('LOW SWEEP'), M.over('OVERHEAD HOOK'), M.spin('SPINNING SWEEP')],
  club: [M.over('OVERHEAD SMASH', 1.2), M.sweep('HORIZONTAL SWING', 0.95), M.bash('SHOULDER STRIKE'), M.slam('KNOCKBACK STRIKE', 1.2)],
  axe: [M.over('OVERHEAD CHOP', 1.3), M.over('DIAGONAL CHOP', 1.15, 1.15), M.sweep('HORIZONTAL SWEEP'), M.finish('EXECUTION SWING'), M.slam('STAGGER STRIKE', 1.25)],
  mace: [M.over('DOWNWARD SMASH', 1.2), M.crush('ARMOUR CRUSHER', 1.45), M.sweep('HORIZONTAL SWEEP'), M.spin('SPINNING MACE'), M.slam('STAGGER BLOW', 1.15)],
  morningstar: [M.sweep('SWINGING ARC', 1.12, 1.15), M.over('OVERHEAD SWING'), M.spin('CIRCULAR SPIN'), M.low('FOLLOW THROUGH')],
  flail: [M.spin('CIRCULAR SWING', 1.2), M.over('OVERHEAD SWING'), M.sweep('SIDE SWEEP'), M.crush('SHIELD BYPASS', 1.3)],
  warhammer: [M.slam('OVERHEAD SMASH', 1.6), M.sweep('HAMMER SWING', 1.0), M.crush('CRUSHING BLOW', 1.5), M.slam('GROUND IMPACT', 1.45)],
  claymore: [M.sweep('HUGE SWEEP', 1.25, 1.25), M.over('OVERHEAD CLEAVE', 1.35), M.spin('SPINNING CLEAVE', 1.4), M.finish('CHARGED FINISH')],
  greataxe: [M.over('MASSIVE CLEAVE', 1.35), M.finish('FINISHING CHOP', 1.9), M.spin('SPINNING AXE', 1.3), M.sweep('EXECUTION SWEEP', 1.2, 1.15)],
  heavyhammer: [M.slam('MASSIVE SMASH', 1.7), M.sweep('SIDE SWING', 0.95), M.slam('GROUND IMPACT', 1.5), M.finish('DEVASTATING STRIKE', 1.8)],
  goldsword: [M.sweep('POWER SLASH', 1.2), M.over('HEAVY DIAGONAL', 1.25), M.thrust('CHARGED THRUST', 1.15, 1.2), M.slam('KNOCKBACK SWING', 1.3)],

  // ---- THE RANGED RACK.  Each one keeps a couple of close attacks, because
  // an empty bow still has to do something when somebody walks in, and what
  // it can do is deliberately poor.
  throwaxe: [M.hurl('AXE THROW', 1.05), M.hurl('TUMBLING THROW', 1.15), M.over('CLOSE CHOP', 1.05, 1.15), M.bash('HAFT STRIKE', 0.85)],
  javelin: [M.hurl('JAVELIN THROW', 1.15), M.hurl('OVERARM CAST', 1.05), M.thrust('SHORT JAB', 0.85, 1.2), M.sweep('SHAFT SWEEP', 0.8, 1.1)],
  chakram: [M.hurl('DISC THROW'), M.hurl('FLAT SPIN', 1.1), M.stab('EDGE SLASH'), M.counter('RETURN CATCH', 1.2)],
  sling: [M.shoot('STONE SHOT'), M.shoot('LOBBED STONE', 1.1), M.bash('SLING WHIP', 0.75), M.stab('DESPERATE SWIPE', 0.7)],
  blowgun: [M.puff('POISON DART'), M.puff('DART VOLLEY', 0.9), M.stab('TUBE JAB', 0.65), M.counter('POINT BLANK DART', 1.2)],
  bow: [M.shoot('ARROW SHOT'), M.shoot('SNAP SHOT', 0.9), M.shoot('AIMED SHOT', 1.2), M.bash('BOW STRIKE', 0.7)],
  longbow: [M.shoot('LONG SHOT', 1.1), M.shoot('FULL DRAW', 1.25), M.shoot('ARCING SHOT'), M.bash('STAVE STRIKE', 0.75)],
  crossbow: [M.shoot('BOLT', 1.15), M.shoot('POINT BLANK BOLT', 1.05), M.shoot('PIERCING BOLT', 1.25), M.bash('STOCK BASH', 0.8)],
  magicstaff: [M.shoot('ARCANE BOLT'), M.shoot('CHARGED BOLT', 1.2), M.sweep('STAFF SWEEP', 0.9, 1.15), M.over('STAFF STRIKE', 0.95, 1.1)],
  boomerang: [M.hurl('BOOMERANG THROW'), M.hurl('WIDE ARC', 1.1), M.bash('CLOSE CRACK', 0.8), M.counter('RETURN STRIKE', 1.25)],
};

/**
 * WHAT A WEAPON DOES THAT NO OTHER WEAPON DOES.
 *
 * Every field here is read by the simulation at a specific moment, so a
 * specialty is a behaviour and not a caption: a mace really does hit harder
 * the more armour is in front of it, a great axe really does get worse for
 * you the closer you are to dying, and throwing knives really do open the
 * fight from outside everybody else's reach and then run out.
 *
 * A weapon carries a handful of these at most.  Two weapons never carry the
 * same handful -- if they did, one of them would be the other with a
 * different name on the card.
 */
export interface Spec {
  /** The line on the card, and the thing you should be able to SEE happening. */
  note: string;
  /** Extra chance the blow takes their feet, on top of the damage test. */
  stagger?: number;
  /** Share of the target's armour simply ignored. */
  pierce?: number;
  /** Chance of a critical, which is 1.8x. */
  crit?: number;
  /** Share of the target's avoidance taken away. */
  dodgeCut?: number;
  /** Share of a raised guard ignored. */
  guardCut?: number;
  /** Extra pixels of knock-back. */
  knock?: number;
  /** Multiplier on the chance of chaining a combination. */
  combo?: number;
  /** Damage multiplier that grows with the TARGET's defence. */
  vsArmour?: number;
  /** Damage multiplier that grows as the target's health falls. */
  execute?: number;
  /** Bonus at the far end of its reach, and its opposite. */
  atRange?: number;
  atClose?: number;
  /** Damage handed back to whoever struck a raised shield. */
  riposte?: number;
  /**
   * A weapon BUILT to be hidden behind: how much more a raised guard turns
   * aside, and how much more often it goes up.  Only the shield has one.
   */
  bulwark?: number;
  /** Bonus on the strike taken immediately after a dodge. */
  counter?: number;
  /** Can catch somebody who is walking into it. */
  sweep?: number;
  /**
   * WHAT IT DOES AT A DISTANCE, or nothing if it only works up close.
   *
   * A weapon with this fights at `hold` while it has shots left and falls
   * back on its melee numbers when it runs out.  The two sides are deliberately
   * separate: a weapon's melee power band says how good it is in a clinch and
   * `ranged.dmg` says how good it is across the sand, so a dual-range weapon
   * is written as good at one and mediocre at the other rather than as good
   * at both.
   */
  ranged?: Ranged;
  /** Extra recovery, for a swing that takes a week to come back. */
  slowRecover?: number;
  /** Walking speed multiplier, for a weapon that is barely there. */
  fleet?: number;
  /**
   * IT IS TWO OBJECTS, NOT ONE.
   *
   * Dual swords and twin daggers are a blade in each hand, so losing one --
   * broken or knocked away -- leaves the other one.  A paired weapon has to
   * be taken twice before the hands are empty, and in between it fights as a
   * single blade: the same strike, half as many of them.
   */
  paired?: boolean;
}

/**
 * One weapon, and the shape of the rolls it makes.
 *
 * Nothing here is the weapon's actual numbers.  Every weapon rolls four stats
 * on a one-to-ten scale the moment it comes out of a chest -- HEAVINESS,
 * POWER, RESISTANCE, REACH -- so no two daggers are the same dagger and no
 * two fights start from the same place.  What keeps a dagger a dagger is the
 * band it rolls inside: its reach is two to three whatever it rolls, and a
 * war scythe's is eight to ten, so the shape of the thing survives the dice.
 *
 * `tempo` is the one number that is not rolled, because it is not a quality a
 * weapon has more or less of -- it is what the weapon IS.  It is set from the
 * weapon's character: heavy things swing slowly and light things do not.  It
 * is NOT fitted to make every weapon win half its fights; a great axe is
 * supposed to beat a wooden club more often than not, and the fight is
 * supposed to be decided by what came out of the chests.
 */
/**
 * A WEAPON ON THE FLOOR.
 *
 * Knocked out of somebody's hand and lying where it fell.  It keeps the
 * ROLLED piece, not just the kind, so picking a sword up gets you that
 * sword -- the one with those four numbers on it -- rather than a fresh
 * average one.  That is what makes losing your grip on a good weapon hurt
 * and makes taking somebody else's worth the walk.
 *
 * It is part of the simulation and is passed into `exchange`, so a headless
 * run drops and retrieves weapons exactly as a watched one does.
 */
export interface Dropped {
  def: WeaponDef;
  piece: Piece;
  /** It is one blade of a pair, so whoever takes it gets one blade. */
  single: boolean;
  x: number;
  /** Seconds left before the sand has it. */
  life: number;
  /** Seconds since it landed, so it is not snatched out of the air. */
  settle: number;
  /** Drawing only. */
  art: Phaser.GameObjects.Container | null;
}

/** How often a staggering blow also takes the weapon out of their hand. */
const DISARM_AT = 0.3;
/** How often poison bites, in seconds. */
const POX_TICK = 0.8;
/**
 * THE BARGAIN A THROW MAKES WITH DISTANCE.
 *
 * `STRETCH` is the extra damage carried by a throw taken at the very limit of
 * the weapon's range, and `AIM` the extra chance of finding nobody there.
 * Close up you can hardly miss and it barely hurts; from the far wall it is
 * worth two swings and half of them land in the sand.  Both are read off the
 * same `stretch`, so the two ends of the trade cannot drift apart.
 */
const THROW_STRETCH = 0.7;
const THROW_AIM = 0.16;
/** A weapon thrown at somebody already off their feet is a much easier target. */
const STAGGER_TARGET = 0.45;
/** The most discarded weapons the sand will hold at once. */
const GROUND_MAX = 10;
/** Seconds a weapon lies untouchable where it landed before anyone may lift it. */
const PICKUP_WAIT = 3;
/** Seconds after a throw before the same fighter will give up another weapon. */
const THROW_WAIT = 3;
/** How long a dropped weapon waits to be claimed, and how long to settle. */
const DROP_LIFE = 22;
const DROP_SETTLE = 0.55;
/** How long bending down to pick one up takes, before the weapon's own bulk. */
const PICKUP_S = 0.42;
/** How far a fighter will go out of its way for one. */
const PICKUP_SEEK = 120;

/**
 * AN ARM, IN TWO PIECES.
 *
 * `root` turns at the shoulder and `fore` turns at the elbow, and because the
 * hand and the weapon are both inside `fore`, bending the elbow carries them
 * with it.  `hand` is where along the forearm the fist sits, so the weapon
 * can be hung at the same place without measuring it twice.
 */
export interface Arm {
  root: Phaser.GameObjects.Container;
  fore: Phaser.GameObjects.Container;
  hand: number;
}

/** What flies, which decides how it is drawn and how it travels. */
export type Shot = 'arrow' | 'bolt' | 'knife' | 'axe' | 'spear' | 'stone' | 'spark' | 'dart' | 'disc';

export interface Ranged {
  /** How far the shot carries, in pixels of sand. */
  far: number;
  /** Multiplier on the weapon's own power when the shot lands. */
  dmg: number;
  /** Shots before it is a melee weapon.  Infinity for a bow. */
  ammo: number;
  /** Seconds of reloading on top of the ordinary beat between attacks. */
  reload: number;
  /** Wind-up weight for a shot, the same scale as a move's. */
  wind: number;
  /** What flies. */
  shot: Shot;
  /** Pixels a second.  A bolt is flat and fast, a stone is slow and lobbed. */
  speed: number;
  /** 0 flies flat, 1 is thrown right up in the air. */
  arc: number;
  /** Where the fighter wants to stand while it still has shots. */
  hold: number;
  /**
   * Share of accuracy lost across the whole flight.
   *
   * This is what stops a bow being free damage: the shot is resolved when it
   * ARRIVES, against wherever the target is by then, so a long shot gives
   * them time to be somewhere else.  It is a real cost of shooting from far
   * away rather than a number invented to hold the bow down.
   */
  drift?: number;
  /**
   * WHAT THE SHOT IS WORTH, on the same one-to-ten scale as everything else.
   *
   * A bow needs a poor MELEE band, or it is not a bow -- but then its shots
   * had nothing to scale with either, and every bow in the game hit for very
   * nearly the same amount however good the chest it came out of was.  That
   * is how the ranged rack flattened the equipment gradient from 63/73 down
   * to 53/59: twelve weapons for which better equipment barely mattered.
   *
   * The band here is rolled from the SAME roll as the melee one, mapped
   * across -- a fine bow is a fine bow at both ends of the sheet, and the
   * fighter who opened a better chest still shoots harder.
   */
  power?: Band;
  /** Share of the target's armour the shot ignores. */
  pierce?: number;
  /** Extra chance the shot takes their feet. */
  stagger?: number;
  /** Extra pixels of knock-back where the shot lands. */
  knock?: number;
  /** The shot comes back, so it never runs out but it is slow to return. */
  returns?: boolean;
  /**
   * THE THING THAT FLIES IS THE WEAPON ITSELF.
   *
   * A bow looses an arrow and a blowgun looses a dart: the weapon stays in
   * the hand and the ammunition is a supply.  A spear is different in kind --
   * throwing it means it is not in your hand any more, it is over there in
   * the sand, and that is the whole reason throwing one is a decision rather
   * than an attack.
   *
   * With this set, every throw puts a real weapon on the arena floor where it
   * lands, hit or miss, and running the count to zero leaves the fighter
   * holding nothing at all.
   */
  leaves?: boolean;
  /**
   * Turns of poison the shot leaves in them, and what each one costs.
   *
   * Applied when the dart ARRIVES and never when it is loosed -- see
   * `landShot`.  A dart that misses poisons nobody.
   */
  venom?: { turns: number; bite: number };
}

export interface WeaponDef {
  key: string;
  name: string;
  /** Inclusive [min, max] on the one-to-ten scale. */
  power: Band;
  heavy: Band;
  resist: Band;
  reach: Band;
  /** Strikes thrown inside one swing. */
  hits: number;
  /** Damage turned aside simply by being carried. */
  guard: number;
  /** Swings a second at full speed. */
  tempo: number;
  /** The one thing it does that nothing else does. */
  spec: Spec;
}
export type Band = readonly [number, number];

export const WEAPONS: WeaponDef[] = [
  // ---- NOTHING AT ALL.  A real outcome, not a fallback.
  // ---- NOTHING AT ALL, and still dangerous.
  //
  // Bare hands have to stay a real outcome rather than a death sentence,
  // because half the interesting things that happen in a bout -- a break, a
  // disarm, a scramble for what is on the sand -- put somebody here.  Quick,
  // relentless, and able to string a combination together; it beats an armed
  // fighter by never letting them set, and it loses to anyone who can keep
  // it at arm's length.
  { key: 'none', name: 'NO WEAPON', power: [2, 4], heavy: [1, 1], resist: [10, 10], reach: [1, 3], hits: 1, guard: 0, tempo: 1.34,
    spec: { note: 'NOTHING TO CARRY, AND IT NEVER STOPS COMING', fleet: 1.24, combo: 1.7, atClose: 0.5 } },

  // ---- IN CLOSE
  { key: 'knuckles', name: 'BRASS KNUCKLES', power: [2, 4], heavy: [1, 2], resist: [7, 10], reach: [1, 2], hits: 1, guard: 0, tempo: 1.7,
    spec: { note: 'POINT BLANK, AND IT ROCKS THEM', atClose: 0.7, stagger: 0.3 } },
  { key: 'dagger', name: 'SHORT DAGGER', power: [2, 4], heavy: [1, 2], resist: [5, 8], reach: [2, 3], hits: 1, guard: 0, tempo: 1.55,
    spec: { note: 'FASTER THE CLOSER IT GETS', atClose: 0.45, combo: 1.3 } },
  { key: 'twindagger', name: 'TWIN DAGGERS', power: [2, 4], heavy: [1, 2], resist: [4, 7], reach: [1, 3], hits: 2, guard: 0, tempo: 1.6,
    spec: { note: 'IN AND OUT, AND IN AGAIN', combo: 2.2, fleet: 1.15, paired: true } },
  { key: 'knife', name: 'TACTICAL KNIFE', power: [3, 5], heavy: [1, 2], resist: [5, 8], reach: [2, 4], hits: 1, guard: 0, tempo: 1.35,
    spec: { note: 'FINDS THE GAP IN ANYTHING', pierce: 0.45 } },
  { key: 'rapier', name: 'RAPIER', power: [2, 5], heavy: [1, 3], resist: [4, 7], reach: [4, 6], hits: 1, guard: 0, tempo: 1.5,
    spec: { note: 'A HUNDRED THRUSTS, ONE OF THEM PERFECT', crit: 0.3 } },

  // ---- FAST AND REPEATED
  { key: 'nunchuck', name: 'NUNCHUCKS', power: [2, 4], heavy: [2, 3], resist: [3, 6], reach: [4, 6], hits: 2, guard: 0, tempo: 1.4,
    spec: { note: 'IT NEVER STOPS COMING', combo: 2.6 } },
  { key: 'dual', name: 'DUAL SWORDS', power: [3, 5], heavy: [2, 4], resist: [4, 7], reach: [5, 7], hits: 2, guard: 0, tempo: 1.1,
    spec: { note: 'TWO BLADES, TWO SMALLER WOUNDS', combo: 1.6, dodgeCut: 0.15, paired: true } },
  { key: 'throwing', name: 'THROWING KNIVES', power: [2, 4], heavy: [1, 2], resist: [2, 4], reach: [2, 4], hits: 1, guard: 0, tempo: 1.3,
    spec: { note: 'SIX OF THEM, FROM RIGHT ACROSS THE SAND',
      ranged: { far: 145, dmg: 0.75, power: [3, 7], ammo: Infinity, reload: 0.35, wind: 0.75, shot: 'knife', speed: 235, arc: 0.14, hold: 85, drift: 0.16, leaves: true } } },

  // ---- THE MIDDLE OF THE RACK
  { key: 'gladius', name: 'GLADIUS', power: [4, 6], heavy: [2, 4], resist: [6, 9], reach: [3, 5], hits: 1, guard: 0, tempo: 1.2,
    spec: { note: 'BUILT FOR THE CRUSH OF A LINE', atClose: 0.3, guardCut: 0.25 } },
  { key: 'sword', name: 'SWORD', power: [4, 7], heavy: [3, 5], resist: [6, 9], reach: [5, 7], hits: 1, guard: 0.08, tempo: 1.0,
    spec: { note: 'NO WEAKNESS, AND NO TRICKS EITHER', crit: 0.1, stagger: 0.08 } },
  { key: 'katana', name: 'KATANA', power: [5, 8], heavy: [3, 5], resist: [5, 8], reach: [6, 8], hits: 1, guard: 0, tempo: 0.95,
    spec: { note: 'ANSWERS A MISS BEFORE THEY RECOVER', counter: 1.1 } },
  // More wall and less weapon: it turns aside more, blocks more often and
  // charges people across the sand, and pays for all of it in what it hits
  // for -- the power band is the lowest of any melee weapon in the rack.
  { key: 'shield', name: 'SPIKED SHIELD', power: [2, 4], heavy: [5, 7], resist: [8, 10], reach: [2, 4], hits: 1, guard: 0.36, tempo: 0.9,
    spec: { note: 'A WALL THAT WALKS INTO YOU', riposte: 6, bulwark: 1.3 } },

  // ---- LONG
  // ---- DUAL RANGE, AND DELIBERATELY NOT BEST AT BOTH.
  //
  // The spear is a strong melee weapon that can also be thrown, so its throw
  // is a WEAK one and there is only the single spear to throw: it opens the
  // fight or finishes it, and then the spear is gone and it is a fistfight.
  // The javelin is the other way round -- a strong throw on a weapon that is
  // poor in the hand.  Neither beats the bow at range or the halberd up close.
  // Everything it has is in the distance.  The power band is low and the
  // range bonus is large, so a spear held at arm's length is the worst thing
  // in the arena and a spear in a clinch is a stick with a point on it.
  { key: 'spear', name: 'SPEAR', power: [3, 6], heavy: [3, 5], resist: [5, 8], reach: [7, 9], hits: 1, guard: 0, tempo: 1.0,
    spec: { note: 'WORST THING TO WALK TOWARDS, AND IT THROWS ONCE', atRange: 0.68, pierce: 0.2,
      ranged: { far: 124, dmg: 1.3, power: [5, 9], ammo: 1, reload: 1.1, wind: 1.25, shot: 'spear', speed: 205, arc: 0.24, hold: 69, drift: 0.2, pierce: 0.14, leaves: true } } },
  { key: 'staff', name: 'LONG STICK', power: [3, 6], heavy: [3, 5], resist: [5, 8], reach: [8, 10], hits: 1, guard: 0, tempo: 0.95,
    spec: { note: 'YOU NEVER GET TO WHERE YOU ARE GOING', sweep: 0.45 } },
  // Still the best thing in the game at keeping somebody at arm's length,
  // and now genuinely committed to every thrust: slower to bring round, a
  // long recovery if it finds nothing, and less of it to wear out.
  { key: 'trident', name: 'TRIDENT', power: [4, 7], heavy: [4, 6], resist: [5, 8], reach: [7, 9], hits: 1, guard: 0.12, tempo: 0.84,
    spec: { note: 'HOLDS THEM OFF, AND COMMITS TO IT', atRange: 0.3, knock: 5, slowRecover: 0.45,
      ranged: { far: 112, dmg: 1.45, power: [6, 10], ammo: 1, reload: 1.2, wind: 1.3, shot: 'spear', speed: 190, arc: 0.26, hold: 66, drift: 0.22, stagger: 0.2, knock: 6, leaves: true } } },
  { key: 'halberd', name: 'HALBERD', power: [5, 8], heavy: [5, 7], resist: [6, 9], reach: [7, 9], hits: 1, guard: 0, tempo: 0.8,
    spec: { note: 'A SPEAR ONE MOMENT AND AN AXE THE NEXT', atRange: 0.35, stagger: 0.2 } },
  { key: 'warscythe', name: 'WAR SCYTHE', power: [5, 8], heavy: [5, 8], resist: [4, 7], reach: [8, 10], hits: 1, guard: 0, tempo: 0.8,
    spec: { note: 'DECIDES WHERE THE FIGHT HAPPENS', sweep: 0.55, knock: 4 } },
  { key: 'scythe', name: 'SCYTHE', power: [6, 9], heavy: [5, 8], resist: [3, 6], reach: [8, 10], hits: 1, guard: 0, tempo: 0.78,
    spec: { note: 'CATCHES THEM ON THE WAY IN', sweep: 0.7 } },

  // ---- HEAVY
  { key: 'club', name: 'WOODEN CLUB', power: [3, 6], heavy: [4, 6], resist: [6, 9], reach: [3, 5], hits: 1, guard: 0, tempo: 1.0,
    spec: { note: 'MOSTLY IT JUST SENDS THEM AWAY', knock: 11, stagger: 0.32 } },
  { key: 'axe', name: 'AXE', power: [7, 10], heavy: [6, 8], resist: [5, 8], reach: [5, 7], hits: 1, guard: 0, tempo: 0.8,
    spec: { note: 'IT OPENS ARMOUR AND MOVES WHAT IT HITS', stagger: 0.35, knock: 6, vsArmour: 1.35, slowRecover: 0.28 } },
  { key: 'mace', name: 'MACE', power: [5, 8], heavy: [5, 7], resist: [7, 10], reach: [4, 6], hits: 1, guard: 0, tempo: 0.88,
    spec: { note: 'THE MORE THEY WEAR, THE WORSE IT IS', vsArmour: 1.5, pierce: 0.25 } },
  { key: 'morningstar', name: 'MORNING STAR', power: [5, 8], heavy: [5, 7], resist: [5, 8], reach: [5, 7], hits: 1, guard: 0, tempo: 0.85,
    spec: { note: 'IT COMES ROUND THE GUARD, NOT THROUGH IT', guardCut: 0.8, dodgeCut: 0.2 } },
  { key: 'flail', name: 'BALL AND CHAIN', power: [6, 9], heavy: [6, 8], resist: [4, 7], reach: [7, 9], hits: 1, guard: 0, tempo: 0.72,
    spec: { note: 'YOU CANNOT READ IT, SO YOU CANNOT SLIP IT', dodgeCut: 0.5, knock: 7 } },
  { key: 'warhammer', name: 'WAR HAMMER', power: [7, 10], heavy: [7, 9], resist: [7, 10], reach: [4, 6], hits: 1, guard: 0, tempo: 0.68,
    spec: { note: 'PLATE IS A SUGGESTION', vsArmour: 1.8, stagger: 0.4 } },
  { key: 'claymore', name: 'CLAYMORE', power: [8, 10], heavy: [7, 9], resist: [6, 9], reach: [6, 8], hits: 1, guard: 0, tempo: 0.74,
    spec: { note: 'AN ENORMOUS ARC, AND A LONG WAY BACK', sweep: 0.4, slowRecover: 0.45 } },
  { key: 'greataxe', name: 'GREAT AXE', power: [8, 10], heavy: [8, 10], resist: [5, 8], reach: [6, 8], hits: 1, guard: 0, tempo: 0.62,
    spec: { note: 'IT SMELLS BLOOD', execute: 1.3, stagger: 0.25 } },
  { key: 'heavyhammer', name: 'HEAVY HAMMER', power: [8, 10], heavy: [8, 10], resist: [8, 10], reach: [4, 6], hits: 1, guard: 0, tempo: 0.66,
    spec: { note: 'ONCE IS USUALLY ENOUGH', knock: 16, stagger: 0.6, slowRecover: 0.4 } },
  { key: 'goldsword', name: 'GOLD SWORD', power: [8, 10], heavy: [7, 9], resist: [6, 9], reach: [6, 8], hits: 1, guard: 0, tempo: 0.7,
    spec: { note: 'TOO MUCH SWORD, AND WORTH IT', knock: 6, crit: 0.15 } },

  // ---- THROWN, AND THEN YOU ARE HOLDING NOTHING MUCH
  //
  // A handful of shots and a poor weapon underneath.  These win by opening a
  // lead across the sand and surviving what comes back, which is a different
  // way to win a fight and loses badly to anyone who closes early.
  { key: 'throwaxe', name: 'THROWING AXES', power: [3, 6], heavy: [2, 4], resist: [4, 7], reach: [3, 5], hits: 1, guard: 0, tempo: 1.1,
    spec: { note: 'FOUR AXES, END OVER END', stagger: 0.18,
      ranged: { far: 128, dmg: 0.83, power: [4, 9], ammo: 4, reload: 0.72, wind: 1.05, shot: 'axe', speed: 168, arc: 0.42, hold: 76, drift: 0.26, stagger: 0.16, leaves: true } } },
  { key: 'javelin', name: 'JAVELIN', power: [3, 5], heavy: [2, 4], resist: [3, 6], reach: [6, 8], hits: 1, guard: 0, tempo: 1.05,
    spec: { note: 'THREE THROWS, AND EACH ONE MEANS IT',
      ranged: { far: 178, dmg: 0.92, power: [5, 10], ammo: 3, reload: 0.95, wind: 1.2, shot: 'spear', speed: 212, arc: 0.3, hold: 105, drift: 0.24, pierce: 0.11, leaves: true } } },
  { key: 'chakram', name: 'CHAKRAM', power: [2, 4], heavy: [1, 3], resist: [3, 6], reach: [3, 5], hits: 1, guard: 0, tempo: 1.35,
    spec: { note: 'FLAT, FAST, AND IT COMES BACK', combo: 1.4,
      ranged: { far: 138, dmg: 0.78, power: [3, 7], ammo: 5, reload: 0.44, wind: 0.7, shot: 'disc', speed: 258, arc: 0.03, hold: 81, drift: 0.12, leaves: true } } },

  // ---- SHOOTS ALL DAY, AND CANNOT FIGHT AT ALL
  //
  // Infinite shots, and melee numbers that are honestly awful: a bow in a
  // clinch is a stick.  The whole weapon is the distance, so anything that
  // gets inside it wins, and that is the trade the card should make obvious.
  { key: 'sling', name: 'SLINGSHOT', power: [1, 3], heavy: [1, 2], resist: [2, 4], reach: [1, 3], hits: 1, guard: 0, tempo: 1.45,
    spec: { note: 'A STONE EVERY SECOND, FOREVER', fleet: 1.16,
      ranged: { far: 168, dmg: 0.57, power: [2, 6], ammo: Infinity, reload: 0.46, wind: 0.68, shot: 'stone', speed: 152, arc: 0.58, hold: 99, drift: 0.3, stagger: 0.1 } } },
  { key: 'blowgun', name: 'BLOWGUN', power: [1, 2], heavy: [1, 1], resist: [1, 3], reach: [1, 3], hits: 1, guard: 0, tempo: 1.5,
    spec: { note: 'LITTLE DARTS, AND A GREAT MANY OF THEM', fleet: 1.2,
      ranged: { far: 152, dmg: 0.44, power: [1, 5], ammo: Infinity, reload: 0.28, wind: 0.5, shot: 'dart', speed: 244, arc: 0.06, hold: 91, drift: 0.2, pierce: 0.23, venom: { turns: 4, bite: 0.42 } } } },
  { key: 'bow', name: 'SHORT BOW', power: [2, 4], heavy: [1, 3], resist: [2, 5], reach: [1, 3], hits: 1, guard: 0, tempo: 1.2,
    spec: { note: 'NOTHING IN THE HAND, EVERYTHING AT RANGE',
      ranged: { far: 196, dmg: 0.68, power: [4, 8], ammo: Infinity, reload: 0.7, wind: 0.85, shot: 'arrow', speed: 218, arc: 0.22, hold: 114, drift: 0.22 } } },
  { key: 'longbow', name: 'LONG BOW', power: [2, 4], heavy: [2, 4], resist: [3, 6], reach: [2, 4], hits: 1, guard: 0, tempo: 1.0,
    spec: { note: 'IT REACHES THE FAR WALL', slowRecover: 0.2,
      ranged: { far: 238, dmg: 0.89, power: [5, 10], ammo: Infinity, reload: 1.0, wind: 1.35, shot: 'arrow', speed: 236, arc: 0.28, hold: 138, drift: 0.28, pierce: 0.07 } } },
  { key: 'crossbow', name: 'CROSSBOW', power: [3, 5], heavy: [3, 5], resist: [5, 8], reach: [2, 4], hits: 1, guard: 0.06, tempo: 0.9,
    spec: { note: 'ONE BOLT, STRAIGHT THROUGH THE PLATE', slowRecover: 0.3,
      ranged: { far: 214, dmg: 0.87, power: [6, 10], ammo: Infinity, reload: 1.78, wind: 1.15, shot: 'bolt', speed: 312, arc: 0.04, hold: 127, drift: 0.1, pierce: 0.2 } } },
  { key: 'magicstaff', name: 'MAGIC STAFF', power: [3, 5], heavy: [2, 4], resist: [4, 7], reach: [5, 7], hits: 1, guard: 0, tempo: 1.0,
    spec: { note: 'IT DOES NOT CARE WHAT YOU ARE WEARING', sweep: 0.2,
      ranged: { far: 182, dmg: 0.59, power: [3, 8], ammo: Infinity, reload: 1.22, wind: 1.0, shot: 'spark', speed: 186, arc: 0.1, hold: 109, drift: 0.18, pierce: 0.25 } } },
  // ================= TEN MORE, SPREAD ACROSS THE EXISTING TIERS =================
  //
  // Deliberately NOT at the ends of the range.  The rack is held to a gate --
  // nothing above 80% and nothing under 15% across every pairing -- and the
  // quickest way to break a balanced set is to bolt a new best weapon onto
  // it.  Every one of these earns its place with REACH, TEMPO, GUARD, HITS or
  // a specialty rather than with raw power, and each is a trade somebody
  // already in the rack does not offer.

  // ---- LIGHT
  { key: 'sickle', name: 'SICKLE', power: [2, 5], heavy: [1, 3], resist: [4, 7], reach: [2, 4], hits: 1, guard: 0, tempo: 1.45,
    spec: { note: 'HOOKS ROUND WHATEVER YOU ARE HIDING BEHIND', pierce: 0.16 } },
  { key: 'warfan', name: 'WAR FAN', power: [2, 4], heavy: [1, 2], resist: [3, 6], reach: [3, 5], hits: 2, guard: 0.16, tempo: 1.5,
    spec: { note: 'TWO OF EVERYTHING, AND SOMETHING TO HIDE BEHIND', sweep: 0.3 } },

  // ---- BLADES
  { key: 'scimitar', name: 'SCIMITAR', power: [4, 7], heavy: [3, 5], resist: [5, 8], reach: [5, 7], hits: 1, guard: 0.05, tempo: 1.08,
    spec: { note: 'THE CURVE DOES THE WORK', sweep: 0.4 } },
  { key: 'estoc', name: 'ESTOC', power: [3, 6], heavy: [2, 4], resist: [6, 9], reach: [5, 7], hits: 1, guard: 0, tempo: 1.12,
    spec: { note: 'FINDS THE GAP IN ANYTHING PLATED', pierce: 0.34 } },

  // ---- POLEARMS
  { key: 'pike', name: 'PIKE', power: [3, 6], heavy: [4, 6], resist: [5, 8], reach: [9, 10], hits: 1, guard: 0, tempo: 0.7,
    spec: { note: 'NOTHING REACHES YOU. NOTHING CLOSE GETS HIT', atRange: 0.85 } },
  { key: 'glaive', name: 'GLAIVE', power: [5, 8], heavy: [5, 7], resist: [5, 8], reach: [7, 9], hits: 1, guard: 0.06, tempo: 0.85,
    spec: { note: 'A LONG ARC WITH AN EDGE ON IT', sweep: 0.5 } },

  // ---- HEAVY
  { key: 'maul', name: 'MAUL', power: [7, 10], heavy: [7, 9], resist: [7, 10], reach: [5, 7], hits: 1, guard: 0, tempo: 0.64,
    spec: { note: 'THEY DO NOT GET TO ANSWER THE FIRST ONE', stagger: 0.35, knock: 6 } },
  { key: 'bardiche', name: 'BARDICHE', power: [6, 9], heavy: [6, 8], resist: [5, 8], reach: [6, 8], hits: 1, guard: 0, tempo: 0.76,
    spec: { note: 'AN AXE ON A POLE, AND IT SWINGS LIKE ONE', sweep: 0.35, stagger: 0.18 } },

  // ---- AND TWO MORE THAT LEAVE THE HAND
  { key: 'harpoon', name: 'HARPOON', power: [3, 6], heavy: [3, 5], resist: [4, 7], reach: [6, 8], hits: 1, guard: 0, tempo: 0.95,
    spec: { note: 'ONE THROW, AND IT DRAGS THEM BACK WITH IT', atRange: 0.5,
      ranged: { far: 118, dmg: 1.35, power: [5, 9], ammo: 1, reload: 1.15, wind: 1.25, shot: 'spear', speed: 198, arc: 0.24, hold: 67, drift: 0.2, knock: 7, leaves: true } } },
  { key: 'bolas', name: 'BOLAS', power: [2, 4], heavy: [2, 3], resist: [3, 6], reach: [2, 4], hits: 1, guard: 0, tempo: 1.2,
    spec: { note: 'BARELY HURTS. THEY WILL NOT BE GOING ANYWHERE', atRange: 0.4,
      ranged: { far: 104, dmg: 0.7, power: [2, 5], ammo: 2, reload: 1.0, wind: 0.95, shot: 'disc', speed: 172, arc: 0.3, hold: 60, drift: 0.26, stagger: 0.45, leaves: true } } },

  { key: 'boomerang', name: 'BOOMERANG', power: [2, 4], heavy: [1, 3], resist: [3, 6], reach: [2, 4], hits: 1, guard: 0, tempo: 1.3,
    spec: { note: 'IT GOES OUT AND IT COMES BACK', fleet: 1.12,
      ranged: { far: 150, dmg: 0.75, power: [3, 7], ammo: Infinity, reload: 0.66, wind: 0.8, shot: 'disc', speed: 172, arc: 0.36, hold: 89, drift: 0.26, returns: true, knock: 3 } } },
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
  /**
   * DAMAGE BACK TO A BARE HAND THAT HITS IT.
   *
   * Spiked armour's line has always read UNPLEASANT TO HIT and nothing in the
   * rules ever made that true -- it was a defence number with a story on it.
   * A fist or a boot driven into a suit of spikes hurts the person throwing
   * it; a sword does not care, so this only ever answers an UNARMED attacker.
   * Scaled by how much of the suit is actually spiked, so one spiked greave
   * is a tenth of the deterrent a full suit is.
   */
  thorns?: number;
  /**
   * EXTRA SHARE TAKEN OFF A LIGHT BLOW.
   *
   * Scale is overlapping plates that ride over each other, so it shrugs off
   * the fast repeated stuff and gives up on anything with real weight behind
   * it.  Without this it was chain with a worse defence number and a
   * different colour.
   */
  soft?: number;
  heavy: Band;
  resist: Band;
  colour: number;
  edge: number;
  /** The one line that says what it is for, when the numbers do not. */
  note: string;
  /**
   * A name short enough for the kit sheet, which lists three of them on one
   * centred line.  Trimming " ARMOUR" off the full name was not enough --
   * three REINFORCED HIDEs came to 330 pixels of a 320 pixel screen and went
   * off both ends -- and first words collide (ROMAN LEGION, ROMAN HELMET).
   */
  short: string;
}
export const MATERIALS: ArmourMat[] = [
  // ---- NOTHING, AND THE THINGS THAT BARELY COUNT
  { key: 'none', name: 'NO ARMOUR', def: 0, evade: 0, heavy: [1, 1], resist: [10, 10], colour: 0x6d5a45, edge: 0x4a3c2d, short: 'NONE', note: 'NOTHING THERE, AND NOTHING TO CARRY' },
  // ---- TEN MORE, FILLING THE LADDER RATHER THAN EXTENDING IT.
  //
  // None of these is better than HEAVY PLATE and none is lighter than cloth:
  // they go BETWEEN what was already there, so the rack has steps in it
  // instead of jumps.  Three of them break the pattern on purpose -- bone and
  // dragon scale shrug off quick hits and not heavy ones, obsidian stops a
  // great deal and shatters while it does it.
  { key: 'padded', name: 'PADDED JACK', def: 0.08, evade: 0.05, heavy: [1, 2], resist: [3, 5], colour: 0xc9b48c, edge: 0x8a7654, short: 'PADDED', note: 'CLOTH, BUT ENOUGH OF IT TO NOTICE' },
  { key: 'hide', name: 'HIDE ARMOUR', def: 0.12, evade: 0, heavy: [2, 4], resist: [4, 6], colour: 0x8a6440, edge: 0x4f3722, short: 'HIDE', note: 'SOMETHING ELSE WORE IT FIRST' },
  { key: 'studded', name: 'STUDDED LEATHER', def: 0.14, evade: 0, heavy: [3, 5], resist: [6, 8], colour: 0x7f5c3c, edge: 0x9aa2ae, short: 'STUDDED', note: 'LEATHER WITH OPINIONS HAMMERED INTO IT' },
  { key: 'bone', name: 'BONE ARMOUR', def: 0.17, evade: 0, soft: 0.38, heavy: [3, 5], resist: [4, 6], colour: 0xe4ddc6, edge: 0x9c9482, short: 'BONE', note: 'TURNS THE QUICK ONES. SPLITS ON THE REST' },
  { key: 'brigandine', name: 'BRIGANDINE', def: 0.19, evade: 0, heavy: [4, 6], resist: [7, 9], colour: 0x6b4f3a, edge: 0xb9c2c8, short: 'BRIG', note: 'PLATES ON THE INSIDE WHERE THEY CANNOT SEE THEM' },
  { key: 'lamellar', name: 'LAMELLAR ARMOUR', def: 0.22, evade: 0, heavy: [4, 6], resist: [6, 8], colour: 0x8a7f5e, edge: 0x4e4634, short: 'LAMELLAR', note: 'A THOUSAND LITTLE PLATES, ALL LACED TOGETHER' },
  { key: 'corinthian', name: 'CORINTHIAN HELM', def: 0.24, evade: 0, heavy: [4, 6], resist: [7, 9], colour: 0xb08d4a, edge: 0x6b5324, short: 'CORINTH', note: 'YOU WILL LOOK MAGNIFICENT AND HEAR NOTHING' },
  { key: 'knight', name: 'KNIGHT HELM', def: 0.27, evade: 0, heavy: [5, 7], resist: [7, 9], colour: 0xa9b2bd, edge: 0x59616b, short: 'KNIGHT', note: 'A LETTERBOX TO SEE THE WHOLE FIGHT THROUGH' },
  { key: 'obsidian', name: 'OBSIDIAN ARMOUR', def: 0.29, evade: 0, heavy: [5, 7], resist: [2, 4], colour: 0x2b2836, edge: 0x6d5fa0, short: 'OBSIDIAN', note: 'STOPS ALMOST ANYTHING, ALMOST ONCE' },
  { key: 'dragon', name: 'DRAGON SCALE', def: 0.31, evade: 0, soft: 0.34, heavy: [6, 8], resist: [7, 9], colour: 0x4f7a5a, edge: 0x24402c, short: 'DRAGON', note: 'NOBODY ASKS WHERE IT CAME FROM' },

  { key: 'cloth', name: 'LIGHT CLOTH ARMOUR', def: 0.04, evade: 0.09, heavy: [1, 1], resist: [2, 4], colour: 0xd8cbb0, edge: 0x9a8e74, short: 'CLOTH', note: 'YOU WILL BE VERY QUICK AND VERY SORRY' },
  { key: 'tuxedo', name: 'TUXEDO', def: 0.05, evade: 0, heavy: [1, 2], resist: [2, 4], colour: 0x2a2d3a, edge: 0xdfe4ee, short: 'TUXEDO', note: 'FIVE PERCENT DEFENCE. THE REST IS FASHION' },
  { key: 'crown', name: 'CROWN', def: 0.06, evade: 0, heavy: [1, 2], resist: [3, 5], colour: 0xffd45e, edge: 0xa8801e, short: 'CROWN', note: 'IT PROTECTS NOTHING AND MEANS EVERYTHING' },

  // ---- LIGHT
  { key: 'leather', name: 'LEATHER ARMOUR', def: 0.10, evade: 0, heavy: [2, 4], resist: [5, 7], colour: 0x9c7248, edge: 0x5d4028, short: 'LEATHER', note: 'LIGHT, AND ABOUT AS USEFUL AS THAT SOUNDS' },
  { key: 'tactical', name: 'TACTICAL ARMOUR', def: 0.10, evade: 0.15, heavy: [2, 4], resist: [6, 8], colour: 0x3f4a3a, edge: 0x22281f, short: 'TACTICAL', note: 'STOPS LITTLE. MUCH HARDER TO HIT' },
  { key: 'reinforced', name: 'REINFORCED LEATHER', def: 0.13, evade: 0, heavy: [3, 5], resist: [7, 9], colour: 0x7a5a3a, edge: 0x452f1c, short: 'R.LEATHER', note: 'LEATHER THAT HAS BEEN THOUGHT ABOUT' },
  { key: 'tin', name: 'TIN ARMOUR', def: 0.15, evade: 0, heavy: [3, 5], resist: [3, 5], colour: 0xb9c2c8, edge: 0x6d767c, short: 'TIN', note: 'CHEAP, LOUD, BETTER THAN A SHIRT' },
  { key: 'hood', name: 'CHAIN HOOD', def: 0.16, evade: 0, heavy: [3, 5], resist: [6, 8], colour: 0x87909c, edge: 0x464e58, short: 'HOOD', note: 'RINGS, AND NOT MANY OF THEM' },

  // ---- THE MIDDLE
  { key: 'scale', name: 'SCALE ARMOUR', def: 0.18, evade: 0, soft: 0.34, heavy: [4, 6], resist: [6, 8], colour: 0x6f8a6a, edge: 0x3a4a38, short: 'SCALE', note: 'SHRUGS OFF THE QUICK ONES. NOT THE BIG ONES' },
  { key: 'chain', name: 'CHAIN ARMOUR', def: 0.20, evade: 0, heavy: [4, 6], resist: [6, 8], colour: 0x8e9cad, edge: 0x4a5665, short: 'CHAIN', note: 'THE HONEST MIDDLE OF THE RACK' },
  { key: 'bronze', name: 'BRONZE ARMOUR', def: 0.21, evade: 0, heavy: [5, 7], resist: [5, 7], colour: 0xc08a3e, edge: 0x6f4b1c, short: 'BRONZE', note: 'OLDER THAN IRON AND NEARLY AS GOOD' },
  { key: 'viking', name: 'VIKING HELM', def: 0.22, evade: 0, heavy: [5, 7], resist: [7, 9], colour: 0x9aa3ad, edge: 0x4e555e, short: 'VIKING', note: 'HORNS, WHICH HELP WITH NOTHING' },
  { key: 'spartan', name: 'SPARTAN HELM', def: 0.23, evade: 0, heavy: [5, 7], resist: [7, 9], colour: 0xb08a3a, edge: 0x63481a, short: 'SPARTAN', note: 'YOU WILL SEE LESS AND MIND IT LESS' },
  { key: 'legion', name: 'ROMAN LEGION', def: 0.23, evade: 0, heavy: [5, 7], resist: [8, 10], colour: 0xc2a15a, edge: 0x6d5528, short: 'LEGION', note: 'ISSUED, AND IT SHOWS. IT LASTS' },
  { key: 'roman', name: 'ROMAN HELMET', def: 0.24, evade: 0, heavy: [5, 7], resist: [8, 10], colour: 0xcaa963, edge: 0x77592a, short: 'ROMAN', note: 'A CHEEK GUARD AND A VERY RED BRUSH' },

  // ---- HEAVY
  { key: 'iron', name: 'IRON ARMOUR', def: 0.25, evade: 0, heavy: [6, 8], resist: [7, 9], colour: 0x6f7682, edge: 0x3a4149, short: 'IRON', note: 'HEAVY, AND WORTH IT' },
  { key: 'shoulder', name: 'SHOULDER GUARDS', def: 0.26, evade: 0, heavy: [6, 8], resist: [7, 9], colour: 0x7e868f, edge: 0x424952, short: 'PAULDRON', note: 'ENORMOUS. YOU WILL NOT TURN QUICKLY' },
  { key: 'spiked', name: 'SPIKED ARMOUR', def: 0.26, evade: 0, thorns: 9, heavy: [6, 8], resist: [6, 8], colour: 0x5e5a63, edge: 0xbfc6cf, short: 'SPIKED', note: 'PUNCH IT AND FIND OUT. BLADES DO NOT CARE' },
  { key: 'plate', name: 'PLATE ARMOUR', def: 0.28, evade: 0, heavy: [7, 9], resist: [8, 10], colour: 0xc3cad4, edge: 0x646c78, short: 'PLATE', note: 'A WALL WITH A FROG INSIDE IT' },
  { key: 'gold', name: 'GOLD ARMOUR', def: 0.30, evade: 0, heavy: [7, 9], resist: [4, 6], colour: 0xffd45e, edge: 0xa8801e, short: 'GOLD', note: 'THE BEST THERE IS, AND THE SOFTEST' },
  { key: 'heavyplate', name: 'HEAVY PLATE', def: 0.33, evade: 0, heavy: [9, 10], resist: [9, 10], colour: 0x9aa2ae, edge: 0x4d545e, short: 'H.PLATE', note: 'NOTHING GETS IN. NOTHING GETS OUT EITHER' },
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
 * WHAT KIND OF LIZARD CAME OUT TONIGHT.
 *
 * Eight of them, and each one is a set of DECLARED trade-offs on the same
 * four base numbers Froggy has -- not a bonus.  Every multiplier above one
 * is paid for by one below it, and the products are close enough to even
 * that no archetype is simply the best one: a muscular lizard hits harder
 * and is slower, a fast one is quicker and softer, and so on down the list.
 *
 * `nerve` and `spacing` are behaviour rather than statistics, which is how
 * the trickster and the berserker are meant to be difficult without being
 * stronger: one of them will not stand still and the other stops caring
 * about its own health as it loses.
 *
 * The lizard's EQUIPMENT is rolled by exactly the same generator as Froggy's,
 * afterwards and independently, so an armoured lizard can still draw a tuxedo
 * and a fast one can still be handed a heavy hammer that ruins its whole
 * plan.  That interaction is the point.
 */
export interface LizardType {
  key: string;
  name: string;
  /** Multipliers on the shared base.  Read them as a set, not one at a time. */
  power: number;
  speed: number;
  avoid: number;
  resist: number;
  /** How readily it presses in and swings.  1 is Froggy. */
  nerve: number;
  /** How much distance it tries to keep. */
  spacing: number;
  /** Gets angrier as it loses instead of more careful. */
  berserk?: boolean;
  /** Will not be stood still: constant repositioning. */
  restless?: boolean;
  /** Hardly ever gives ground. */
  stubborn?: boolean;
  /**
   * How it is BUILT, and it has to be readable as a silhouette.
   *
   * `wide` and `tall` shape the torso and the head, `limb` is leg length, and
   * `head` sizes the skull.  The first pass at this used spreads of about ten
   * percent, which under a breastplate came to eight lizards nobody could
   * tell apart.  They are far wider now: an armoured lizard is squat and
   * enormous, a reach lizard is all legs and neck, and you should be able to
   * name the archetype from the shape before it swings at anything.
   */
  build: { scale: number; wide: number; tall: number; limb: number; head: number; skin: number; light: number; dark: number; crest: number; animal: Animal };
  blurb: string;
}

/**
 * WHAT EACH ARCHETYPE IS.  Not a lizard with a different head on: each one is
 * built from its own anatomy -- see `ANATOMY` and `dressAnimal`.
 */
export type Animal = 'gorilla' | 'cheetah' | 'rhino' | 'hyena' | 'giraffe' | 'lion' | 'lizard' | 'wolf';

export const LIZARDS: LizardType[] = [
  // ---- EIGHT ANIMALS, one per way of fighting.  The numbers that decide the
  // fight -- power, speed, avoidance, resistance, nerve, spacing and the
  // three temperaments -- are exactly what they were; what changed is the
  // animal each archetype is.  `build` is drawing only: the rules never read
  // it, so a gorilla drawn a third bigger than the rest hits no harder for it.
  //
  // THE MUSCLE is a gorilla, and the biggest thing in the arena.
  { key: 'muscle', name: 'GORILLA', power: 1.22, speed: 0.85, avoid: 0.8, resist: 1.2, nerve: 1.2, spacing: 0.9,
    build: { scale: 1.3, wide: 1.72, tall: 1.02, limb: 0.84, head: 1.0, skin: 0x3b3a40, light: 0x6b6468, dark: 0x1f1e23, crest: 0x9a98a0, animal: 'gorilla' },
    blurb: 'HITS LIKE A DOOR' },
  // THE FAST ONE is a cheetah: all leg, nothing spare.
  { key: 'fast', name: 'CHEETAH', power: 0.82, speed: 1.32, avoid: 1.2, resist: 0.8, nerve: 1.05, spacing: 1.0,
    build: { scale: 0.94, wide: 0.7, tall: 1.06, limb: 1.36, head: 0.9, skin: 0xd9a441, light: 0xf3dca0, dark: 0x8a5e22, crest: 0x2e2012, animal: 'cheetah' },
    blurb: 'YOU WILL NOT CATCH IT' },
  // THE ARMOURED ONE is a rhino, which came armoured.
  { key: 'armoured', name: 'RHINO', power: 1.0, speed: 0.82, avoid: 0.78, resist: 1.36, nerve: 1.0, spacing: 0.8, stubborn: true,
    build: { scale: 1.16, wide: 1.66, tall: 0.86, limb: 0.72, head: 1.0, skin: 0x858a92, light: 0xaeb3ba, dark: 0x4a4e56, crest: 0xe6dcc0, animal: 'rhino' },
    blurb: 'IT DOES NOT MOVE' },
  // THE ASSASSIN is a hyena: hunched, spotted and grinning.
  { key: 'assassin', name: 'HYENA', power: 1.04, speed: 1.22, avoid: 1.22, resist: 0.74, nerve: 1.15, spacing: 1.05,
    build: { scale: 0.92, wide: 0.74, tall: 1.0, limb: 1.1, head: 0.92, skin: 0xb49660, light: 0xd8c18e, dark: 0x5c4a2c, crest: 0x3a2c1a, animal: 'hyena' },
    blurb: 'QUICK AND VERY FRAGILE' },
  // THE REACH is a giraffe, and its reach is its neck and its limbs.
  { key: 'reach', name: 'GIRAFFE', power: 0.94, speed: 1.0, avoid: 1.08, resist: 0.96, nerve: 0.85, spacing: 1.45,
    build: { scale: 1.0, wide: 0.66, tall: 1.18, limb: 1.62, head: 0.9, skin: 0xe2b35c, light: 0xf6e7c2, dark: 0x8a5424, crest: 0x94542a, animal: 'giraffe' },
    blurb: 'FIGHTS FROM OVER THERE' },
  // THE BERSERKER is a lion, mane and all.
  { key: 'berserk', name: 'LION', power: 1.2, speed: 1.05, avoid: 0.86, resist: 1.14, nerve: 1.35, spacing: 0.7, berserk: true,
    build: { scale: 1.12, wide: 1.4, tall: 0.96, limb: 0.96, head: 1.12, skin: 0xcc8e3e, light: 0xecc684, dark: 0x6e4418, crest: 0x7e3c16, animal: 'lion' },
    blurb: 'WORSE AS YOU HURT IT' },
  // THE BALANCED ONE is still a lizard: the plain reptile the rest are read against.
  { key: 'balanced', name: 'LIZARD', power: 1.0, speed: 1.0, avoid: 1.0, resist: 1.0, nerve: 1.0, spacing: 1.0,
    build: { scale: 1.0, wide: 1.0, tall: 1.0, limb: 1.0, head: 1.0, skin: 0x9c5a2e, light: 0xc98243, dark: 0x5e3218, crest: 0xc2522e, animal: 'lizard' },
    blurb: 'BEST AT NOTHING' },
  // THE TRICKSTER is a wolf.
  { key: 'trickster', name: 'WOLF', power: 0.94, speed: 1.06, avoid: 1.16, resist: 0.94, nerve: 1.0, spacing: 1.1, restless: true,
    build: { scale: 0.98, wide: 0.96, tall: 1.0, limb: 1.16, head: 1.0, skin: 0x6c737e, light: 0xc9cdd3, dark: 0x363a42, crest: 0xe8c04a, animal: 'wolf' },
    blurb: 'NEVER WHERE IT WAS' },
];

/**
 * FROGGY, WITH NOTHING ON.
 *
 * Power 10, Speed 100, Avoidance 50, Distance 20.  Everything a chest gives
 * him is measured against these four and nothing else.
 */
export const BASE = { power: 10, speed: 100, avoid: 50, distance: 20 } as const;
/** Health before any armour, and what a point of suit resistance adds to it. */
const BASE_HP = 118;
const HP_PER_RESIST = 7.5;
/** A point of rolled weapon power, in damage. */
const POWER_PER_ROLL = 3.6;
/** A point of rolled reach, in pixels past the base distance. */
const PX_PER_REACH = 3.4;
/** Full load -- every piece at ten and the heaviest weapon -- for scaling. */
const LOAD_FULL = 10 * SUIT_BULK + 10;
/** What a full load costs, as a share of speed and of avoidance. */
// What a full load costs.  These were 0.6 and 0.62, which compounded into an
// absurdity at the top of the range: plate armour and a claymore came to nine
// tenths of maximum load, which took sixty percent off speed, which took the
// same sixty percent off the swing rate on top of an already slow weapon --
// about one swing every three and a half seconds.  Measured, the best kit in
// the game lost to an unarmed frog in a cloth vest almost two times in three.
// Heavy gear is supposed to be slower, not unusable.
const LOAD_ON_SPEED = 0.42;
const LOAD_ON_AVOID = 0.5;
/** And what it costs the swing, which is less than what it costs the legs. */
const LOAD_ON_RATE = 0.33;
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
export function statsOf(kit: Kit, weapon: WeaponDef, wRolls?: Piece, type?: LizardType | null): Stats {
  const w = wRolls ?? kit.weapon;
  // An archetype scales the SHARED base and nothing else.  There is no branch
  // below this line that knows whether it is looking at a frog or a lizard.
  const base = {
    power: BASE.power * (type?.power ?? 1),
    speed: BASE.speed * (type?.speed ?? 1),
    avoid: BASE.avoid * (type?.avoid ?? 1),
    distance: BASE.distance,
  };
  const suitHeavy = kit.head.heavy + kit.body.heavy + kit.legs.heavy;
  const load = suitHeavy + w.rHeavy;
  // Defence and evasion are quoted per suit; each piece brought its own share.
  const defence = Math.min(0.75, (kit.head.prot + kit.body.prot + kit.legs.prot) / 100);
  const evade = (['head', 'body', 'legs'] as const)
    .reduce((n, sl) => n + (kit[sl].mat?.evade ?? 0) * COVER[sl], 0);
  // ---- BARE SKIN IS WORTH NO HEALTH.
  //
  // NO ARMOUR rolls resistance ten, which is right for a weapon (bare hands
  // cannot break) and was quietly catastrophic for a suit: resistance feeds
  // health, so wearing NOTHING gave more of it than plate -- 179 against 171
  // -- and every balance figure taken before this was measured against a
  // game where the best armour in the rack made you easier to kill.  A piece
  // that is not there contributes nothing.
  const resist = (['head', 'body', 'legs'] as const)
    .reduce((n, sl) => n + (kit[sl].mat && kit[sl].mat!.key !== 'none' ? kit[sl].rResist : 0) * COVER[sl], 0);

  const speedPts = Math.max(18, base.speed * (1 - (load / LOAD_FULL) * LOAD_ON_SPEED));
  const avoidPts = Math.max(4, base.avoid * (1 - (suitHeavy / (10 * SUIT_BULK)) * LOAD_ON_AVOID) + evade * 100);
  const distPts = base.distance + w.rReach * PX_PER_REACH;

  // ---- A SWING IS A SWING, HOWEVER MANY TIMES IT LANDS.
  //
  // Froggy's ten points of base power are his, not the weapon's, so a weapon
  // that throws twice was collecting them twice: nunchucks and dual swords
  // came out at forty-three damage a second against a ball and chain's
  // fifteen, and took eight duels in ten.  The swing is worth what it is
  // worth and arrives in however many pieces the weapon deals in -- which is
  // still a real difference, because two smaller blows get past a guard
  // differently from one large one.
  const perStrike = (base.power + w.rPower * POWER_PER_ROLL) / weapon.hits;
  return {
    power: perStrike,
    // ---- ARMOUR SLOWS THE FEET MORE THAN THE ARMS.
    //
    // Swing rate used to come straight off `speedPts`, so a full load took
    // forty percent off the swing as well as off the walk -- and because rate
    // MULTIPLIES damage while defence and health only add to survival, that
    // one number outweighed everything the heavy kit bought.  Measured: a
    // claymore in full plate had a third more power, forty percent more
    // health and forty percent more defence, and still lost three fights in
    // five to a sword in chain, purely on swinging two thirds as often.
    // Weight still costs the swing, at about two thirds of what it costs
    // the legs.
    rate: Math.max(0.3, weapon.tempo * (1 - (load / LOAD_FULL) * LOAD_ON_RATE)),
    walk: Math.max(14, speedPts * PX_PER_SPEED),
    avoid: Math.min(0.75, avoidPts / 100),
    defence,
    maxHp: Math.round((BASE_HP + resist * HP_PER_RESIST) * (type?.resist ?? 1)),
    reach: distPts,
    // It wants to stand a shade outside what it can hit with, and closes in.
    range: distPts + 2,
    guard: weapon.guard,
    powerPts: base.power + w.rPower * POWER_PER_ROLL,  // the sheet shows the whole swing
    speedPts,
    avoidPts,
    distPts,
  };
}

/**
 * How many blows a piece of armour turns aside before it comes apart.
 *
 * Armour had no durability at all: a weapon wore out and a breastplate was
 * forever.  Resistance is the stat that ought to say how long a thing lasts,
 * and now it does for both.
 */
/**
 * HOW MUCH OF A SUIT HAS A GIVEN PROPERTY ON IT, 0..1.
 *
 * Armour is three separate pieces and they are rarely the same material, so
 * "is he wearing spikes" is not a yes or no -- a spiked helm is a quarter of
 * a spiked suit.  Weighted by COVER, the same share each piece takes of the
 * blows, so one spiked greave deters a tenth of what a full suit does.
 */
function suitShare(kit: Kit, pick: (m: ArmourMat) => number | undefined): number {
  let n = 0;
  for (const sl of ['head', 'body', 'legs'] as const) {
    const m = kit[sl].mat;
    if (m && m.key !== 'none') n += (pick(m) ?? 0) * COVER[sl];
  }
  return n;
}

export function armourLife(p: Piece): number {
  if (!p.mat || p.mat.key === 'none') return Infinity;
  return ARMOUR_BASE + p.rResist * ARMOUR_PER_RESIST;
}
// Sized against what a bout MEASURES, not what it looks like it should be.
// About five blows land on each fighter in a fifteen second fight -- not the
// thirty I assumed -- and coverage splits those across three pieces, so the
// body sees two or three of them.  At a life of eight or nine, nothing broke
// in forty bouts and the whole system was invisible.  Down here, cloth and
// tin give out under a sustained beating and plate usually holds, which is
// the difference they are supposed to make.
const ARMOUR_BASE = 1.2;
const ARMOUR_PER_RESIST = 0.5;

/** How many swings this weapon has in it before it can break. */
export function durabilityOf(w: Piece): number {
  if (!w.weapon || w.weapon.key === 'none') return Infinity;
  // ---- THE BETTER IT HITS, THE SOONER IT GOES.
  //
  // Durability was resistance and nothing else, so the top of the rack could
  // be the hardest hitting AND the longest lasting at the same time -- which
  // is the one thing a high tier weapon is not supposed to be.  Power now
  // eats into it and a light quick weapon keeps a little back, so a claymore
  // is a loan against the rest of the fight and a dagger is not.
  const power = (w.weapon.power[0] + w.weapon.power[1]) / 2;
  const heft = Math.max(0.62, 1 - (power - 4) * 0.045);
  const nimble = 1 + Math.max(0, w.weapon.tempo - 1) * 0.3;
  return Math.max(2, (DUR_BASE + w.rResist * DUR_PER_RESIST) * heft * nimble);
}

type Act = 'walk' | 'windup' | 'strike' | 'recover' | 'dodge' | 'guard' | 'stagger' | 'lunge' | 'pickup';

export interface Fighter {
  who: 'frog' | 'lizard';
  kit: Kit;
  /** The archetype, for a lizard.  Froggy has none and uses the plain base. */
  type: LizardType | null;
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
  /**
   * Seconds left on the window a dodge opens.
   *
   * This was a single boolean handed from the dodge to the very next swing,
   * and it almost never survived the trip -- three counters in sixty fights,
   * which is not a specialty anybody could see.  A window is forgiving in the
   * way the thing it represents actually is: you slipped the blow, and for a
   * moment afterwards they are open.
   */
  counterT: number;
  countering: boolean;
  /** Shots left.  Infinity for a bow, 0 once a thrower is empty. */
  ammo: number;
  /** Seconds of reloading still owed before the next shot. */
  reload: number;
  /** Shots in the air, which are resolved when they arrive and not before. */
  flight: InFlight[];
  /** What is left of each piece of armour, and which are already gone. */
  wear: Record<'head' | 'body' | 'legs', number>;
  gone: Record<'head' | 'body' | 'legs', boolean>;
  /** The attack currently being thrown, chosen when the wind-up started. */
  move: Move | null;
  /** Last tick's gap, so a sweeping weapon can tell somebody is walking in. */
  lastGap: number;
  /** Seconds this fighter has been at it, which is how a stand-off ends. */
  clock: number;
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
  /** How many more of this weapon there are to lose before the hands are empty. */
  spares: number;
  /** Down to one blade of a pair: same strike, half as many. */
  single: boolean;
  /** The weapon on the sand this fighter is currently going for, if any. */
  seeking: Dropped | null;
  /**
   * The end-of-fight pose, which the per-frame rig must not fight over.
   *
   * `celebrates` and `goesDown` drive the limbs with tweens once the fight is
   * decided.  `poseFighter` runs every frame and would put every one of those
   * limbs back where the walk cycle wants them, so it hands the rig over the
   * moment this stops being 'none'.
   */
  pose: 'none' | 'cheer' | 'down';
  /**
   * WHAT A DART LEFT IN THEM.
   *
   * `left` is seconds of it remaining, `bite` what each tick costs, and `next`
   * the countdown to the next one.  Put here by `landShot` when a dart with
   * venom ARRIVES, and by nothing else -- a dart that misses poisons nobody,
   * and a dart still in the air has not poisoned anybody yet.
   */
  pox: { left: number; bite: number; next: number };
  /**
   * Seconds before this fighter will consider giving up their weapon again.
   *
   * Throwing the thing in your hand is the one attack with a cost attached,
   * so it does not get to happen twice in a second.
   */
  throwCool: number;
  /**
   * Whether the last decision this fighter made was to throw.
   *
   * `think` decides; `resolveStrike` acts.  Without somewhere to put the
   * answer, `resolveStrike` was making it again on its own -- its ranged
   * branch fires on nothing but "out of reach and loaded" -- so the gate in
   * `think` was being read past every time and spears went across the arena
   * at a median of 1.4 seconds.  True by default so a direct call to
   * `resolveStrike`, which is how the tests reach it, still shoots.
   */
  throwPlan: boolean;
  /** The eased elbow angle.  Drawing only, like `armA`. */
  elbowA: number;
  leanA: number;
  shove: number;
  art: FighterArt | null;
}

export function makeFighter(who: 'frog' | 'lizard', kit: Kit, x: number, face: 1 | -1, type: LizardType | null = null): Fighter {
  const w = kit.weapon.weapon ?? UNARMED;
  const st = statsOf(kit, w, kit.weapon, type);
  return {
    who, kit, type, weapon: w, held: kit.weapon, broken: false, dur: durabilityOf(kit.weapon), st,
    hp: st.maxHp, x, face, act: 'walk', t: 0, cool: 0.4, swing: 0, stun: 0, step: 0,
    riposte: false, chain: 0, desperate: false, move: null, counterT: 0, countering: false,
    wear: { head: armourLife(kit.head), body: armourLife(kit.body), legs: armourLife(kit.legs) },
    gone: { head: false, body: false, legs: false },
    ammo: kit.weapon.weapon?.spec.ranged?.ammo ?? 0, reload: 0, flight: [],
    lastGap: 999, clock: 0,
    spares: kit.weapon.weapon?.spec.paired ? 1 : 0, single: false,
    seeking: null, pose: 'none', pox: { left: 0, bite: 0, next: 0 }, throwCool: 0, throwPlan: true,
    armA: -10, elbowA: -14, leanA: 0, shove: 0, art: null,
  };
}

/** Empty hands, rolled at nothing: what a broken weapon leaves behind. */
function emptyHands(): Piece {
  return { slot: 'weapon', name: 'BARE HANDS', weapon: UNARMED, rPower: 1, rHeavy: 1, rResist: 10, rReach: 1, quality: 3, prot: 0, heavy: 1 };
}

/**
 * A BLOW WEARS WHATEVER IT LANDED ON, AND EVENTUALLY THAT PIECE GIVES OUT.
 *
 * Which piece it lands on is weighted by how much of a body that piece
 * covers, so a breastplate takes most of it and a helmet takes least -- the
 * same `COVER` the defence figures are built from, so the thing that stops
 * the most damage is the thing that wears out first.
 *
 * Losing a piece is a real loss and not a costume change: the suit's defence
 * drops by that piece's share, the health it was worth goes with it, and the
 * fighter is measurably easier to kill from that moment.  Returns the slot
 * that broke so the arena can take it off and make a noise about it.
 */
export function wearArmour(f: Fighter, rng: () => number = Math.random): { slot: 'head' | 'body' | 'legs'; tint: number } | null {
  const live = (['head', 'body', 'legs'] as const).filter((sl) => !f.gone[sl] && Number.isFinite(f.wear[sl]));
  if (!live.length) return null;
  const total = live.reduce((n, sl) => n + COVER[sl], 0);
  let roll = rng() * total;
  let hit = live[0];
  for (const sl of live) { roll -= COVER[sl]; if (roll <= 0) { hit = sl; break; } }
  f.wear[hit] -= 1;
  if (f.wear[hit] > 0) return null;

  // The colour has to be read BEFORE the piece is swapped for nothing:
  // afterwards the slot's material is 'none' and every helm, cuirass and
  // greave in the game came apart in the same dull brown.
  const tint = (f.kit[hit].mat ?? MATERIALS[0]).colour;
  f.gone[hit] = true;
  f.kit = { ...f.kit, [hit]: makeArmour(hit, MATERIALS[0]) };
  const before = f.st.maxHp;
  f.st = statsOf(f.kit, f.weapon, f.held, f.type);
  // Health it was carrying goes with it, but it cannot be the thing that
  // kills them -- losing a helmet is not a death sentence, it is a worse
  // position.
  f.hp = Math.max(1, Math.min(f.hp - Math.max(0, before - f.st.maxHp), f.st.maxHp));
  return { slot: hit, tint };
}

/** A weapon gives out.  Everything it was worth goes with it; the armour stays. */
/**
 * PUT WHAT IS IN A FIGHTER'S HAND ON THE FLOOR.
 *
 * Used by a disarm, and the reason `ground` is threaded through the whole
 * simulation rather than living in the scene: what is lying on the sand
 * changes how both fighters behave, so it has to be part of the fight and
 * not part of the drawing.
 */
export function dropWeapon(f: Fighter, ground: Dropped[], rng: () => number = Math.random): Dropped | null {
  if (f.broken || f.weapon.key === 'none') return null;
  const d: Dropped = {
    def: f.weapon,
    piece: f.kit.weapon,
    single: true,
    // thrown clear, on the side the blow came from
    x: Phaser.Math.Clamp(f.x - f.face * (16 + rng() * 22), ARENA.left + 4, ARENA.right - 4),
    life: DROP_LIFE,
    settle: DROP_SETTLE,
    art: null,
  };
  ground.push(d);
  // ---- ONE OF A PAIR STILL LEAVES THE OTHER.
  //
  // Knocking a blade out of a two-handed fighter's grip should cost them a
  // blade, not the fight.  They keep the one still in the other hand and
  // fight on with it -- same strike, half as many -- and it takes a second
  // knock to leave them bare.
  if (f.spares > 0 && !f.single) {
    f.spares -= 1;
    f.single = true;
    f.st = statsOf(f.kit, f.weapon, f.held, f.type);
    f.hp = Math.min(f.hp, f.st.maxHp);
    return d;
  }
  f.broken = true;
  f.single = false;
  f.weapon = UNARMED;
  f.held = emptyHands();
  f.dur = Infinity;
  f.ammo = 0;
  f.reload = 0;
  f.st = statsOf(f.kit, UNARMED, f.held, f.type);
  f.hp = Math.min(f.hp, f.st.maxHp);
  return d;
}

/**
 * PICK ONE UP, and be holding it properly.
 *
 * The rolled piece goes back into the kit, so the weapon fights with the
 * numbers it was rolled with and its durability starts fresh in the new
 * hand -- it has been dropped, not worn out.
 */
export function takeWeapon(f: Fighter, d: Dropped, ground: Dropped[]): void {
  const i = ground.indexOf(d);
  if (i >= 0) ground.splice(i, 1);
  f.kit = { ...f.kit, weapon: d.piece };
  f.weapon = d.def;
  f.held = d.piece;
  f.broken = false;
  f.single = d.single && !!d.def.spec.paired;
  f.spares = 0;
  f.dur = durabilityOf(d.piece);
  f.ammo = d.def.spec.ranged?.ammo ?? 0;
  f.reload = 0;
  f.seeking = null;
  f.st = statsOf(f.kit, d.def, f.held, f.type);
  f.hp = Math.min(f.hp, f.st.maxHp);
}

export function breakWeapon(f: Fighter): void {
  // A snapped blade out of a pair leaves the other one, exactly as a
  // knocked-away one does, and the durability clock starts again on it.
  if (f.spares > 0 && !f.single) {
    f.spares -= 1;
    f.single = true;
    f.dur = durabilityOf(f.kit.weapon);
    f.st = statsOf(f.kit, f.weapon, f.held, f.type);
    f.hp = Math.min(f.hp, f.st.maxHp);
    return;
  }
  f.single = false;
  f.broken = true;
  f.weapon = UNARMED;
  f.held = emptyHands();
  f.dur = Infinity;
  // A broken bow shoots nothing.  Anything already in the air still arrives --
  // it left the string before the stave went, and the crowd can see it.
  f.ammo = 0;
  f.reload = 0;
  f.st = statsOf(f.kit, UNARMED, f.held, f.type);
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
/** Nothing turns aside more than this share of a blow, however good the guard. */
const SOAK_MAX = 0.82;
/** A shield charge runs at this many times a walk. */
const CHARGE_MUL = 3.2;
/**
 * WHAT CATCHING A BLOW ON YOUR WEAPON COSTS IT.
 *
 * Blocking was free, which made a raised guard strictly better than not
 * having one and meant the only question was whether the fighter happened to
 * carry a shield.  Taking a war hammer on the flat of a dagger should tell on
 * the dagger.  The wear is the damage that was turned aside, divided by how
 * much weapon there is to turn it aside with -- so a spiked shield can stand
 * there all afternoon and a bow-stave used as a bar snaps in three or four.
 */
const BLOCK_WEAR = 1.15;
/** Below this share of health a fighter starts looking after itself, */
const HURT_AT = 0.35;
/** and below this it stops, because there is nothing left to save it for. */
const DESPERATE_AT = 0.25;
/** A blow worth this share of somebody's health takes their feet from them. */
const STAGGER_AT = 0.16;
const STAGGER_S = 0.5;
/** And moves them this far, in the rules and not only in the drawing. */
const KNOCK_PX = 9;
/** Past this many seconds armour starts failing, and over this many it is gone. */
const WEARY_AT = 55;
const WEARY_OVER = 45;
/** A critical is worth this much of an ordinary blow. */
const CRIT_MUL = 1.8;
/**
 * How far a move's own multipliers are allowed to move the swing they modify.
 * At full strength they overruled the equipment; at half they colour it.
 */
const MOVE_SHARE = 0.55;
/** Share of walking pace kept while backing away.  See the footwork below. */
const RETREAT = 0.62;
const MOVE_WEIGHT = (n: number): number => 1 + (n - 1) * MOVE_SHARE;
/**
 * A move's reach counts for half too, and for the same reason.
 *
 * At face value the sword's THRUST reached thirty percent past the sword,
 * which let it stand outside a claymore's swing and hit anyway -- so the best
 * kit in the game lost two fights in three to a middling one.  Reach is the
 * weapon's, and a move only leans on it.
 */
const MOVE_REACH = (m: Move | null | undefined): number => MOVE_WEIGHT(m?.reach ?? 1);
/** How long a dodge leaves the other one open to an answer. */
const COUNTER_WINDOW = 1.1;
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
/**
 * Where the hands sit in a guard.
 *
 * Two angles, not one: at a single -76 both fists landed on top of the head
 * and the whole stance read as a green smudge over the face.  The lead hand
 * sits out in FRONT of the chin and the rear hand higher and closer, which
 * is both what a guard looks like and the only way to tell there are two of
 * them at this size.
 */
// ---- A BOXER'S UPPER ARM POINTS DOWN.
//
// These were negative, which tips the whole upper arm UPWARD from the
// shoulder -- and once the elbow folded on top of that the forearm came out
// at about -120 absolute and put the hand above and behind the skull.  The
// fighter looked like he was waving.
//
// The shape is: upper arm hanging down and slightly forward, elbow tucked
// near the ribs, forearm coming back UP to the chin.  So the shoulder angle
// is positive and the elbow does the work.
const GUARD_LEAD = 34;
const GUARD_REAR = 22;
/** How far the elbow shuts in a guard, measured from the upper arm. */
const GUARD_FOLD = -118;
const OFF_ARM_REST = 24;
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
/** Inside this share of its own reach, a weapon is being swung wrong, */
const INSIDE_FRAC = 0.88;
/** down to this much of its power at nose-to-nose. */
const INSIDE_MIN = 0.25;
/** The arena's two walls, in the fighters' own coordinates. */
export const ARENA = { left: 26, right: GAME_W - 26 };

/**
 * A SHOT THAT HAS LEFT THE HAND AND HAS NOT ARRIVED YET.
 *
 * The whole point of keeping this is that an arrow is resolved WHERE IT LANDS,
 * against wherever the target has got to by then -- not at the moment it was
 * loosed.  That is what makes shooting from the far wall a real decision
 * rather than free damage: the longer the flight, the more chance they have
 * moved, dodged, or closed the distance on you.
 *
 * It is part of the simulation, not of the drawing: `t` runs off the same dt
 * as everything else, so a headless run lands its arrows at exactly the same
 * moments as one with a screen attached.
 */
export interface InFlight {
  kind: Shot;
  /** Seconds left before it arrives. */
  t: number;
  /** Total flight, so the drawing knows how far along it is. */
  total: number;
  from: number;
  /** Where it was aimed, which is not necessarily where they are now. */
  aim: number;
  arc: number;
  /** The attacker's power at the moment of the shot, and the move's name. */
  power: number;
  move?: string;
  r: Ranged;
  /** Flags for the moment it lands. */
  crit: boolean;
  /**
   * THE WEAPON THIS SHOT IS, if it is one.
   *
   * A thrown spear is not a spear-shaped effect, it is the spear: it has to
   * be put back on the sand when it stops, whether it found anybody or not.
   * The rolled piece travels with it so whoever picks it up gets the weapon
   * that was thrown and not a fresh one off the rack.
   */
  weapon?: { def: WeaponDef; piece: Piece; single: boolean };
  /** How far it was thrown, as a share of the weapon's range.  See `landShot`. */
  stretch: number;
  /** Drawing only.  The sprite is hung off the shot so it can be destroyed. */
  art: Phaser.GameObjects.Container | null;
  /**
   * Drawing only.  Where a thrown WEAPON came to rest on the sand, so the
   * sprite that flew can be the one that lies there -- see `retireShot`.
   */
  landed?: Dropped;
}

export interface Blow {
  hit: boolean;
  dodged: boolean;
  /** Both of them swung and the weapons met instead of either body. */
  clashed?: boolean;
  /** Which attack it was, so the arena can name it. */
  move?: string;
  /** The blow knocked the weapon clean out of the defender's hand. */
  disarmed?: Dropped;
  /** The defender's weapon gave out catching this one. */
  blockBroke?: boolean;
  /** The attacker put a bare hand into a suit of spikes, and this is the bill. */
  spiked?: number;
  /** A piece of the defender's armour came off on this one, and its colour. */
  stripped?: 'head' | 'body' | 'legs';
  strippedTint?: number;
  /** It was a critical, a thrown knife, a counter, or it hurt the thrower. */
  crit?: boolean;
  thrown?: boolean;
  /** A shot has just been loosed -- no damage yet, it is still in the air. */
  loosed?: InFlight;
  /** A dart got through, and this many ticks of poison went in with it. */
  poisoned?: number;
  countered?: boolean;
  riposted?: boolean;
  /** It was big enough to take the legs from under them. */
  staggered?: boolean;
  /** A shield charge ran into them and moved them. */
  rammed?: boolean;
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
/**
 * THE HALF OF A BLOW THAT IS THE SAME WHETHER IT WAS SWUNG OR SHOT.
 *
 * Weariness, armour, a raised guard, the health, the wear on the suit and
 * being put on the floor.  Pulled out so an arrow and an axe go through the
 * identical arithmetic and a ranged weapon cannot quietly acquire a different
 * set of rules from a melee one.
 */
/**
 * HOW MUCH A RAISED WEAPON ACTUALLY TURNS ASIDE.
 *
 * A flat share for everybody meant a twig and a tower shield were the same
 * block.  It reads off the weapon's own resistance roll, so what you are
 * holding decides whether getting it in the way was worth doing -- and bare
 * arms are a real block too, just a poor one.
 */
function guardPower(def: Fighter): number {
  if (def.broken || def.weapon.key === 'none') return GUARD_CUT * 0.45;
  if (def.weapon.spec.bulwark) return GUARD_CUT * (0.25 + (def.held.rResist ?? 5) / 8) * def.weapon.spec.bulwark;
  // Deliberately a wide spread.  A block is a thing your EQUIPMENT does for
  // you, so a well-made weapon should turn aside a great deal more than a
  // cheap one -- at a narrow spread, blocking helps whoever is losing and
  // quietly flattens the gap that good gear is supposed to open.
  return GUARD_CUT * (0.25 + (def.held.rResist ?? 5) / 8);
}

/**
 * And what it cost the thing that did the turning aside.
 *
 * Charged on the damage that was ACTUALLY stopped, so a block that barely
 * helped barely wears, and catching something enormous on something flimsy
 * is how a weapon ends up in two pieces.
 */
function wearFromBlock(def: Fighter, stopped: number): boolean {
  if (def.broken || def.weapon.key === 'none' || !Number.isFinite(def.dur)) return false;
  def.dur -= (stopped * BLOCK_WEAR) / Math.max(1.5, def.held.rResist);
  if (def.dur > 0) return false;
  breakWeapon(def);
  return true;
}

function applyDamage(att: Fighter, def: Fighter, raw: number, out: Blow, rng: () => number,
  o: { pierce: number; soak: number; stagger: number; knock: number; ground?: Dropped[]; blocked?: boolean; ranged?: boolean }): void {
  const weary = Math.min(1, Math.max(0, (att.clock - WEARY_AT) / WEARY_OVER));
  raw *= 1 + weary * 0.6;
  const armour = def.st.defence * (1 - o.pierce) * (1 - weary);
  out.hit = true;
  // ---- SCALE TAKES THE EDGE OFF A LIGHT BLOW AND NOT A HEAVY ONE.
  //
  // Overlapping plates ride over each other, so the fast repeated stuff is
  // what they are for.  The share falls away as the blow gets bigger and is
  // gone entirely by the time something is landing a third of a fighter's
  // health, which is when nothing that flexes is going to help.
  const soft = suitShare(def.kit, (m) => m.soft);
  let armour2 = armour;
  if (soft > 0) {
    const weight = Math.min(1, raw / Math.max(1, def.st.maxHp * 0.3));
    armour2 = Math.min(0.92, armour + soft * (1 - weight));
  }
  const through = raw * (1 - armour2);
  out.dmg = Math.max(1, Math.round(through * (1 - o.soak)));
  // the share the guard actually stopped is what the weapon pays for
  if (o.blocked) {
    const stopped = Math.max(0, through - out.dmg);
    if (stopped > 0 && wearFromBlock(def, stopped)) out.blockBroke = true;
  }
  def.hp = Math.max(0, def.hp - out.dmg);

  // ---- AND WHAT A BARE FIST FINDS IN A SUIT OF SPIKES.
  //
  // Only an unarmed attacker: a sword, an arrow or a thrown axe meets the
  // spikes with something that is not skin and does not care.  It is the one
  // thing in the game that punishes the unarmed state, which is what makes
  // spiked armour worth carrying against somebody who has lost their weapon.
  const bareHand = !o.ranged && (att.broken || att.weapon.key === 'none');
  if (bareHand && att.hp > 0) {
    const spikes = suitShare(def.kit, (m) => m.thorns);
    if (spikes > 0) {
      out.spiked = Math.max(1, Math.round(spikes));
      att.hp = Math.max(0, att.hp - out.spiked);
    }
  }

  if (def.hp > 0) {
    const off = wearArmour(def, rng);
    if (off) { out.stripped = off.slot; out.strippedTint = off.tint; }
  }
  const floored = out.dmg >= def.st.maxHp * STAGGER_AT || rng() < o.stagger;
  // ---- AND SOMETIMES IT TAKES THE WEAPON WITH IT.
  //
  // Only off a blow that already put them on the floor, and likelier the
  // heavier that blow was and the heavier the thing they were holding --
  // a hammer swung at somebody clinging to a claymore is how a weapon ends
  // up in the sand.  It is the same roll for both fighters and reads off
  // nothing but the damage and the grip.
  if (def.hp > 0 && floored && !def.broken && def.weapon.key !== 'none' && o.ground) {
    const share = Math.min(1, out.dmg / Math.max(1, def.st.maxHp * 0.3));
    const grip = 1 / (1 + def.held.rHeavy * 0.16);
    if (rng() < DISARM_AT * share * grip) {
      const d = dropWeapon(def, o.ground, rng);
      if (d) out.disarmed = d;
    }
  }
  if (def.hp > 0 && floored) {
    out.staggered = true;
    def.act = 'stagger';
    def.t = STAGGER_S;
    def.chain = 0;
    def.riposte = false;
    def.x = Phaser.Math.Clamp(def.x + (def.x < att.x ? -1 : 1) * (KNOCK_PX + o.knock), ARENA.left, ARENA.right);
  }
}

/**
 * LOOSE A SHOT.  Nothing is decided here except that it is on its way.
 *
 * Damage, dodging and armour all wait for `landShot`, because an arrow that
 * takes half a second to cross the sand should be answered by where the
 * target IS when it gets there.  A fighter who sees it coming and closes the
 * distance has genuinely done something about it.
 */
/**
 * What this fighter's shots are worth, from the roll already on the sheet.
 *
 * The weapon was rolled once.  Where the shot has a band of its own, that one
 * roll's QUALITY -- how far up its melee band it came out -- is carried
 * across onto the ranged band, so one chest decides both and a good bow is
 * good at the thing a bow is for.
 */
function shotPower(f: Fighter): number {
  const r = f.weapon.spec.ranged;
  if (!r?.power) return f.st.power;
  const [lo, hi] = f.weapon.power;
  const qual = hi > lo ? Math.min(1, Math.max(0, (f.held.rPower - lo) / (hi - lo))) : 0.5;
  const rolled = r.power[0] + qual * (r.power[1] - r.power[0]);
  return (BASE.power + rolled * POWER_PER_ROLL) / f.weapon.hits;
}

function looseShot(att: Fighter, def: Fighter, gap: number, rng: () => number): Blow {
  const out: Blow = { hit: false, dodged: false, guarded: false, dmg: 0, broke: false };
  const r = att.weapon.spec.ranged!;
  const mv = att.move;
  out.move = mv?.name;
  out.thrown = true;
  if (Number.isFinite(att.ammo)) att.ammo -= 1;
  att.reload = r.reload;
  // ---- SHOOTING WEARS A WEAPON OUT AS SWINGING DOES.
  //
  // Durability was only ever charged on a melee swing, so a bow never wore
  // out at all: it was the one thing in the rack that stayed exactly as good
  // on the last second of a fight as on the first.  A string and a stave go
  // the same way everything else does, a shade slower than a blade taking
  // impacts.
  if (Number.isFinite(att.dur)) {
    att.dur -= 0.7;
    if (att.dur <= 0) {
      breakWeapon(att);
      out.broke = true;
      return out;
    }
  }
  const crit = !!(att.weapon.spec.crit && rng() < att.weapon.spec.crit);
  const flight = Math.max(0.08, gap / r.speed);
  // How far out this was thrown, 0 at the fighter's own toes and 1 at the
  // very limit of the weapon's range.  `landShot` reads it for both halves of
  // the bargain: a long throw hits harder and finds nobody more often.
  const stretch = Phaser.Math.Clamp((gap - att.st.reach) / Math.max(1, r.far - att.st.reach), 0, 1);
  // ---- AND IF THE THING THAT FLIES IS THE WEAPON, THE HAND IS EMPTY NOW.
  //
  // Taken BEFORE the throw is built, because the piece has to travel with the
  // shot: what lands in the sand has to be the weapon that was thrown, with
  // the numbers it was rolled with, and not a fresh one off the rack.
  const mine = r.leaves ? { def: att.weapon, piece: att.held, single: att.single } : undefined;
  out.loosed = {
    kind: r.shot, t: flight, total: flight, from: att.x, aim: def.x, arc: r.arc,
    power: shotPower(att) * r.dmg * (0.85 + rng() * 0.3) * (1 + stretch * THROW_STRETCH),
    move: mv?.name, r, crit, art: null, weapon: mine, stretch,
  };
  att.flight.push(out.loosed);
  att.throwCool = THROW_WAIT;
  // Out of things to throw, and what was being thrown WAS the weapon: there
  // is nothing in that hand now.  `emptyHand` leaves the fighter on the
  // unarmed row, which is the other combat style they always have.
  if (r.leaves && att.ammo <= 0) emptyHand(att);
  return out;
}

/**
 * The hand after the last throwable has left it.
 *
 * Deliberately not `breakWeapon`: nothing broke.  The weapon is fine, it is
 * simply somewhere else -- on the sand, where anybody may go and get it.
 */
function emptyHand(f: Fighter): void {
  f.single = false;
  f.broken = true;
  f.weapon = UNARMED;
  f.held = emptyHands();
  f.dur = Infinity;
  f.ammo = 0;
  f.reload = 0;
  f.spares = 0;
  f.st = statsOf(f.kit, UNARMED, f.held, f.type);
  f.hp = Math.min(f.hp, f.st.maxHp);
}

/**
 * AND THE SHOT ARRIVES.
 *
 * Every test is taken now, against the fighter as they are at this instant.
 * `drift` is the one thing a shot has that a swing does not: the further it
 * had to travel the likelier it is to find nobody there, which is the price
 * of fighting from the far wall.
 */
export function landShot(att: Fighter, def: Fighter, sh: InFlight, rng = Math.random, ground: Dropped[] = []): Blow {
  const out: Blow = { hit: false, dodged: false, guarded: false, dmg: 0, broke: false, thrown: true, move: sh.move, crit: sh.crit };
  const r = sh.r;
  // ---- WHETHER IT FINDS ANYBODY.
  //
  // It was aimed at where they were standing.  Moving since is the defence --
  // `slip` is how far they have gone, and a fighter who has not moved is a
  // much easier mark than one who has.  On top of that:
  //
  //   `stretch`  how far it was thrown.  A throw taken from the far wall is
  //              a throw with a lot of time in it, and time is what lets
  //              somebody be somewhere else.
  //   stagger    a target already off their feet is not going anywhere, so
  //              most of what they would have dodged with is gone.
  //
  // All three read the fighters as they are AT THIS INSTANT, which is the
  // whole point of resolving a shot when it arrives rather than when it left.
  const slip = Math.min(1, Math.abs(def.x - sh.aim) / 26);
  const floored = def.act === 'stagger' || def.stun > 0;
  let evade = def.st.avoid + (def.act === 'dodge' ? DODGE_BONUS : 0)
    + (r.drift ?? 0) * slip
    + sh.stretch * THROW_AIM;
  if (floored) evade *= 1 - STAGGER_TARGET;
  if (rng() < Math.min(0.9, evade)) {
    out.dodged = true;
    def.counterT = COUNTER_WINDOW;
    if (def.act === 'dodge') { def.riposte = true; def.cool = 0; }
    // ---- AND A WEAPON THAT MISSED IS STILL A WEAPON.  It lands past them,
    // on the sand, and stays there.
    groundShot(sh, def, ground, rng);
    return out;
  }
  const guarding = def.act === 'guard';
  out.guarded = guarding || def.st.guard > 0;
  const soak = (guarding ? guardPower(def) : 0) + def.st.guard;
  let raw = sh.power;
  if (sh.crit) raw *= CRIT_MUL;
  applyDamage(att, def, raw, out, rng,
    { pierce: r.pierce ?? 0, soak, stagger: r.stagger ?? 0, knock: r.knock ?? 0, ground, blocked: guarding, ranged: true });
  // ---- WHAT THE DART LEFT IN THEM.
  //
  // Here and nowhere else: a dart in the air has poisoned nobody, and one
  // that found the sand poisons the sand.  The bite scales with the shot that
  // carried it, so a dart out of a good blowgun is worth being hit by.
  if (r.venom && out.hit) {
    def.pox = {
      left: r.venom.turns * POX_TICK,
      bite: Math.max(1, Math.round(sh.power * r.venom.bite)),
      next: POX_TICK,
    };
    out.poisoned = r.venom.turns;
  }
  // It hit somebody, and it is still a spear.  Down it goes, at their feet.
  groundShot(sh, def, ground, rng);
  return out;
}

/**
 * A THROWN WEAPON COMING TO REST.
 *
 * Only for the shots that ARE weapons: an arrow is an arrow and the sand can
 * have it.  A spear lands where it was going -- a little past the target if it
 * missed them, at their feet if it did not -- and lies there for the rest of
 * the fight, which is what makes the arena fill up with iron as a bout goes
 * on and what makes a missed throw a thing you can see you have lost.
 */
function groundShot(sh: InFlight, def: Fighter, ground: Dropped[], rng: () => number): void {
  if (!sh.weapon) return;
  // ---- THE SAND HAS A LIMIT.
  //
  // Throwing knives never run out, so a long bout with a knife-thrower in it
  // would leave every knife ever thrown lying there -- fifty objects, each
  // with a sprite, none of them ever going away.  The arena is meant to fill
  // up as a fight gets messy, not to keep a complete record of it: past the
  // cap the oldest one nobody is walking towards sinks into the sand.
  if (ground.length >= GROUND_MAX) {
    const stale = ground.findIndex((g) => g.settle <= 0);
    if (stale >= 0) { ground[stale].art?.destroy(); ground[stale].art = null; ground.splice(stale, 1); }
  }
  const past = sh.aim > sh.from ? 1 : -1;
  const d: Dropped = {
    def: sh.weapon.def,
    piece: sh.weapon.piece,
    single: sh.weapon.single,
    x: Phaser.Math.Clamp(def.x + past * (6 + rng() * 16), ARENA.left + 4, ARENA.right - 4),
    // It stays.  Not twenty-two seconds and gone: the whole point of giving
    // up your weapon is that it is over there until somebody goes and gets it.
    life: Infinity,
    settle: PICKUP_WAIT,
    art: null,
  };
  ground.push(d);
  sh.landed = d;
}

export function resolveStrike(att: Fighter, def: Fighter, gap: number, rng = Math.random, ground: Dropped[] = []): Blow {
  const out: Blow = { hit: false, dodged: false, guarded: false, dmg: 0, broke: false };
  const sp = att.weapon.spec;
  const mv = att.move;
  // ---- A SHOT, IF THIS IS A WEAPON THAT SHOOTS AND THEY ARE OUT THERE.
  //
  // Out of melee reach and still holding ammunition means the answer is the
  // ranged one; inside reach it swings, and so does an empty bow.
  const r = sp.ranged;
  // `throwPlan` is the decision `think` already made.  Ammunition ignores it
  // -- a loaded bow at range shoots, that is the whole of a bow -- but giving
  // up the weapon in your hand is not a thing to decide twice.
  // The clock test is a HARD floor and not part of the plan: `throwPlan`
  // starts true so a direct call still shoots, and a fighter who reached
  // throwing range before `think` had ever run on them was carrying that
  // default into the first second of the bout.
  if (r && att.ammo > 0 && att.reload <= 0 && gap > att.st.reach && gap <= r.far
    && (!r.leaves || (att.throwPlan && att.clock >= OPENING_HOLD))) {
    return looseShot(att, def, gap, rng);
  }
  if (gap > att.st.reach * MOVE_REACH(mv)) return out;
  out.move = mv?.name;

  // Wear is charged once per swing, not once per blow to land: a weapon that
  // throws two was paying twice for the one swing.
  if (Number.isFinite(att.dur) && att.swing === 0) {
    // A heavy weapon swung into a suit of plate takes more out of itself
    // than the same swing into cloth does.
    const heavy = Math.max(0, att.held.rHeavy - 5) / 5;
    att.dur -= 1 + heavy * def.st.defence * 2.2;
    if (att.dur <= 0) {
      breakWeapon(att);
      out.broke = true;
    }
  }

  // ---- GETTING OUT OF THE WAY.  A flail is hard to read and a morning star
  // comes round corners, so both take a share of the dodge away.
  const evade = def.st.avoid * (1 - (sp.dodgeCut ?? 0)) + (def.act === 'dodge' ? DODGE_BONUS : 0);
  if (rng() < evade) {
    out.dodged = true;
    // ---- SLIPPING A BLOW LEAVES THE OTHER ONE COMMITTED.
    //
    // The window opens on ANY evade, not only on a deliberate dodge.  Gating
    // it on the dodge ACT looked right and was nearly dead in practice: a
    // fighter can only start a dodge while idle, off cool-down, and watching
    // a wind-up, which measured out at about one dodge per fight -- so the
    // katana landed five counters in sixty bouts and its whole specialty was
    // invisible.  Avoidance mostly does its work through this roll, so this
    // is where the opening actually happens.
    def.counterT = COUNTER_WINDOW;
    if (def.act === 'dodge') {
      // a read dodge is worth more than a lucky one: it also comes back fast
      def.riposte = true;
      def.cool = 0;
    }
    return out;
  }

  // ---- THE GUARD, AND THE THINGS THAT IGNORE IT.
  const guarding = def.act === 'guard';
  out.guarded = guarding || def.st.guard > 0;
  // Capped, because a shield's passive guard plus a raised one could
  // otherwise add up to a wall that nothing gets through at all.
  const soak = Math.min(SOAK_MAX, ((guarding ? guardPower(def) : 0) + def.st.guard) * (1 - (sp.guardCut ?? 0)));
  // A spiked shield hands some of it back to whoever hit it.
  const shield = def.weapon.spec.riposte ?? 0;
  if (shield > 0 && guarding && att.hp > 0) {
    out.riposted = true;
    att.hp = Math.max(0, att.hp - shield);
  }

  // ---- AND A LONG WEAPON IS A BAD WEAPON UP CLOSE.
  //
  // Reach was pure profit otherwise.  A scythe swung at arm's length is a
  // length of wood, and that is the short blade's whole win condition: get
  // inside the arc and the reach stops counting.  Written against reach and
  // not against who is holding it.
  const sweet = att.st.reach * INSIDE_FRAC;
  const close = gap < sweet ? INSIDE_MIN + (1 - INSIDE_MIN) * (gap / sweet) : 1;
  // The move's own weight.  A flurry hits for less each time and an overhead
  // cleave hits for a great deal more; this is where that is true.
  let raw = att.st.power * close * (0.85 + rng() * 0.3) * MOVE_WEIGHT(mv?.dmg ?? 1);
  if (mv?.hits && mv.hits > 1) raw /= Math.sqrt(mv.hits);

  // ---- AND NOW THE THING THIS PARTICULAR WEAPON IS FOR.
  //
  // MEASURED AGAINST THEIR REACH, NOT AGAINST YOUR OWN.
  //
  // These were written as `gap / att.st.reach`, and a fighter stands at its
  // own reach -- so that fraction sat at 0.94 to 0.99 at the moment a blow
  // landed, every weapon, every fight.  Which meant `atRange` was not a bonus
  // at the far end of anything, it was a permanent +47% on the spear; and
  // `atClose`, being its mirror, paid the dagger +3% and the brass knuckles
  // +1% and was for practical purposes dead code.  It is the whole reason
  // the round robin ran spear 93 / trident 86 / halberd 82 at the top and
  // knuckles 38 / dagger 17 / gladius 31 down at the bottom.
  //
  // The question worth asking is about the OTHER fighter: am I hitting them
  // from outside the arc they can answer with, or have I got inside it?  That
  // is what a spear is for and what a dagger is for, it is the same thing
  // `stuck` already means in the footwork, and it makes both bonuses
  // conditional on a thing the fighters actually contest.
  const theirs = Math.max(1, def.st.reach);
  const outside = Math.min(1, Math.max(0, (gap - theirs) / theirs));
  const inside = Math.min(1, Math.max(0, (theirs - gap) / theirs));
  if (sp.atRange) raw *= 1 + sp.atRange * outside;       // spear, trident, halberd
  if (sp.atClose) raw *= 1 + sp.atClose * inside;        // knuckles, dagger, gladius
  if (sp.crit && rng() < sp.crit) { raw *= CRIT_MUL; out.crit = true; }
  if (sp.vsArmour) raw *= 1 + (sp.vsArmour - 1) * Math.min(1, def.st.defence / 0.3);
  if (sp.execute) raw *= 1 + (sp.execute - 1) * (1 - def.hp / def.st.maxHp);
  if (sp.counter && att.countering) { raw *= 1 + sp.counter; out.countered = true; }

  // ---- ARMOUR TAKES A SHARE, NOT A SLICE, and some weapons take a share of
  // the share: a knife finds the gap, a mace does not care that there is one.
  // Weariness, the suit and being put on the floor are shared with the shot
  // path, so the two kinds of attack cannot drift apart.
  applyDamage(att, def, raw, out, rng, {
    pierce: sp.pierce ?? 0,
    soak,
    stagger: (sp.stagger ?? 0) + (mv?.stagger ?? 0),
    knock: (sp.knock ?? 0) + (mv?.knock ?? 0),
    ground,
    blocked: guarding,
  });
  // ---- A CHARGE MOVES WHAT IT HITS, whether or not it floors them.  A blow
  // that staggered them has already sent them back; one that did not still
  // shoves them off their spot -- half as far into a raised guard, which
  // plants its feet.
  if (mv?.anim === 'charge' && out.hit) {
    out.rammed = true;
    if (def.hp > 0 && !out.staggered) {
      const push = (KNOCK_PX + (mv.knock ?? 0)) * (guarding ? 0.5 : 1);
      def.x = Phaser.Math.Clamp(def.x + (def.x < att.x ? -1 : 1) * push, ARENA.left, ARENA.right);
    }
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
/**
 * WHICH ATTACK, AND WHY THAT ONE.
 *
 * Every move is scored against the situation rather than drawn from a hat: a
 * thrust wants distance, a flurry wants to be in close, a finisher wants the
 * other one nearly done, an armour-breaker wants something to break.  The
 * best-scoring move wins, with a little noise so a fight is not the same
 * fight twice -- but the noise never outvotes the situation, which is what
 * keeps a spear thrusting at range instead of picking at random.
 */
export function chooseMove(f: Fighter, other: Fighter, gap: number, rng = Math.random): Move {
  const list = MOVES[f.weapon.key] ?? MOVES.none;
  const frac = Math.min(1.4, gap / Math.max(1, f.st.reach));
  const theirHp = other.hp / other.st.maxHp;
  let best = list[0];
  let bestScore = -Infinity;
  for (const m of list) {
    // The weights are deliberately close together.  The first pass had the
    // conditional bonuses at +1.5 to +1.9 against a -3 penalty, which is not
    // a preference, it is a decision: the mace threw ARMOUR CRUSHER on a
    // hundred percent of its swings and the war hammer and the flail did the
    // same.  Situation still decides -- a thrust at range beats a flurry at
    // range every time -- but two sensible answers to the same moment should
    // trade places, so a fight is not one animation on a loop.
    let score = rng() * 1.05;
    // distance first: a move that wants range is wrong in a clinch
    if (m.at === 'far') score += frac > 0.7 ? 0.7 : -0.45;
    if (m.at === 'near') score += frac < 0.55 ? 0.7 : -0.45;
    // and the conditions that make a special move the obvious one
    if (m.when === 'counter') score += f.counterT > 0 ? 1.15 : -1.8;
    if (m.when === 'finish') score += theirHp < 0.35 ? 1.25 : -1.8;
    if (m.when === 'armour') score += other.st.defence > 0.18 ? 0.55 : -0.9;
    // ---- AND THE MOVE HAS TO FIT THE DISTANCE.
    //
    // A move's reach EXTENDS the swing test, so at the range a fighter
    // naturally stands at -- its own maximum -- the long moves were the only
    // ones that could legally be thrown, and the short ones simply never
    // happened: brass knuckles threw RUSH a hundred times out of a hundred.
    // Scoring the FIT rather than the length fixes that.  A move that cannot
    // cover the gap is out, and one that covers it with a great deal to spare
    // is a waste of a swing, so the shortest adequate attack tends to win --
    // which is what makes distance choose the attack.
    const mr = MOVE_REACH(m);
    if (mr < frac - 0.02) score -= 6;
    // A charge needs a run-up.  From inside a shield's length there is no
    // ground to cover and it would be a bash with extra steps.
    if (m.anim === 'charge' && frac < 1.3) score -= 12;
    else score -= (mr - frac) * 0.5;
    // A slow one is a bad idea against somebody much quicker who is still
    // fresh -- but only MUCH quicker.  At "any faster at all" this fired in
    // nearly every exchange and cost the heavy weapons the overhead swings
    // that are the whole reason to carry one: the club threw its horizontal
    // ninety-one times in a hundred and almost never its smash.
    if (m.wind > 1.2 && theirHp > 0.6 && other.st.speedPts > f.st.speedPts * 1.25) score -= 0.22;
    // and something that puts them on the floor is worth more when they are
    // already crowding you
    if ((m.stagger ?? 0) > 0.2 && frac < 0.7) score += 0.3;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

/** Whether this fighter still has a shot to take at all. */
function armed(f: Fighter): boolean {
  return !!f.weapon.spec.ranged && f.ammo > 0;
}

/**
 * Whether the SHOOTING is this weapon's plan, as opposed to a thing it can do.
 *
 * A spear that can be thrown once is a spear: it should fight at spear range
 * and throw when the moment comes, not back away across the arena guarding a
 * single cast.  Letting the one-shot weapons kite made them fight like bows
 * while keeping a polearm's melee -- good at both, which is the one thing a
 * dual-range weapon is not allowed to be.
 */
function holds(f: Fighter): boolean {
  const r = f.weapon.spec.ranged;
  if (!r || f.ammo <= 0 || r.ammo <= 1) return false;
  // ---- DOWN TO THE LAST ONE, IT IS A WEAPON AGAIN.
  //
  // The last throw of something that leaves the hand is kept for a moment
  // worth it (see `throwWorthIt`), so a fighter still holding ITS distance
  // for that throw was waiting at range for a shot it had decided not to
  // take.  Two of them -- bolas against a chakram -- stood sixty pixels
  // apart for the better part of a minute, neither closing nor throwing.
  // On the last one it closes and fights with it, and throws when the
  // moment comes, which is what a one-shot spear already does.
  if (r.leaves && Number.isFinite(f.ammo) && f.ammo <= 1) return false;
  return true;
}

/** Nobody gives up the thing in their hand in the first seconds of a bout. */
const OPENING_HOLD = 3.5;

/**
 * WHETHER THIS IS A MOMENT WORTH THROWING YOUR WEAPON AT.
 *
 * A bow looses an arrow and has lost an arrow; a spear thrown is a spear
 * gone.  Those are not the same decision, and the old code made them with the
 * same line -- in range, loaded, throw -- so a spearman opened every bout by
 * hurling his spear across the arena and then spent the rest of it punching.
 *
 * Ammunition still flies freely: that is what ammunition is for.  What is
 * gated is the LAST throw of something that IS the weapon, and the gate is a
 * list of moments where giving it up buys something:
 *
 *   a finish      they are nearly down and this ends it
 *   desperation   so am I, and a swing is not going to do it
 *   a charge      they are coming and this is the last chance to use the gap
 *   an opening    they are off their feet and cannot go anywhere
 *   out-reached   they can hit me and I cannot hit them; distance is no use
 *   stonewalled   they are armoured past what I can swing through
 *
 * Even then it is a roll rather than a rule, so two identical situations do
 * not always produce the same fight.
 */
function throwWorthIt(f: Fighter, other: Fighter, gap: number, rng: () => number): boolean {
  const r = f.weapon.spec.ranged!;
  if (!r.leaves) return true;
  if (f.throwCool > 0) return false;
  if (f.clock < OPENING_HOLD) return false;
  // A belt of knives, or three javelins of four: no real cost yet.
  if (!Number.isFinite(f.ammo) || f.ammo > 1) return true;

  const theirs = other.hp / other.st.maxHp;
  const mine = f.hp / f.st.maxHp;
  const finish = theirs < 0.3;
  const desperate = mine < DESPERATE_AT;
  const charging = other.act === 'lunge' || (gap < f.lastGap - 0.01 && gap < other.st.reach + 12);
  const openNow = other.act === 'stagger' || other.stun > 0;
  const outReached = other.st.reach > f.st.reach * 1.15 && gap <= other.st.reach + 4;
  // A stand-in for "swinging at this is getting me nowhere": their armour is
  // heavy enough that the throw, which pierces and hits far harder, is the
  // better of the two attacks I have.  Measured on their defence rather than
  // on my last few swings, because nothing here keeps that history.
  const stonewalled = other.st.defence > 0.42;

  if (!(finish || desperate || charging || openNow || outReached || stonewalled)) return false;
  // The better the moment, the likelier they take it.
  const keen = (finish ? 0.5 : 0) + (openNow ? 0.45 : 0) + (desperate ? 0.3 : 0)
    + (charging ? 0.25 : 0) + (outReached ? 0.3 : 0) + (stonewalled ? 0.2 : 0);
  return rng() < Math.min(0.9, keen);
}

export function think(f: Fighter, other: Fighter, dt: number, rng = Math.random, ground: Dropped[] = []): void {
  const gap = Math.abs(f.x - other.x);
  f.face = other.x >= f.x ? 1 : -1;
  // kept so a sweeping weapon can tell the difference between somebody
  // standing at a distance and somebody walking onto the blade
  const wasGap = f.lastGap;
  f.lastGap = gap;
  // The archetype, read once.  `spacing` stretches where it wants to stand,
  // `restless` will not let it settle, `stubborn` means it does not give
  // ground for being hurt, `berserk` means it gets worse as it loses.  All
  // declared trade-offs; none of it is a damage bonus.
  const ty = f.type;
  const hurt = f.hp / f.st.maxHp < HURT_AT;

  // ---- IS THERE A WEAPON ON THE FLOOR, AND SHOULD I WANT IT?
  //
  // Only if my hands are empty.  A fighter already holding something walks
  // straight past -- swapping mid-fight for a weapon you cannot see the
  // numbers of is not a decision anybody should make for you, and it would
  // turn every bout into a scramble for whatever landed last.
  //
  // If BOTH of them are empty they will both come for it, which is the whole
  // point: the race is the interesting part, and whoever is nearer and
  // quicker gets to be the one holding a sword again.
  const empty = f.broken || f.weapon.key === 'none';
  if (empty && ground.length) {
    let best: Dropped | null = null;
    let bestGap = PICKUP_SEEK;
    for (const d of ground) {
      if (d.settle > 0) continue;
      const g = Math.abs(f.x - d.x);
      if (g < bestGap) { bestGap = g; best = d; }
    }
    f.seeking = best;
    if (best) {
      // ---- AND THE RACE HAS TO BE FAIR.
      //
      // `exchange` ticks one fighter before the other, so on the frame both
      // of them were standing over the same sword the one that ticks first
      // simply took it: 249 to 151 in a race started from identical
      // distances.  Whoever is actually nearer wins it, and a dead tie is
      // settled by the roll rather than by the order of two function calls.
      const theirGap = Math.abs(other.x - best.x);
      const mine = bestGap < theirGap - 0.5 ? true
        : theirGap < bestGap - 0.5 ? false
          : rng() < 0.5;
      const contested = (other.broken || other.weapon.key === 'none') && theirGap < PICKUP_SEEK;
      // standing over it: bend down and take it
      if (bestGap < 7 && (!contested || mine)) {
        f.act = 'pickup';
        f.t = PICKUP_S + Math.min(0.5, best.piece.rHeavy * 0.05);
        f.face = best.x >= f.x ? 1 : -1;
        return;
      }
      // otherwise go and get it, unless they are about to take my head off
      const danger = gap <= other.st.reach + 4 && other.act === 'windup';
      if (!danger) {
        const dir = best.x > f.x ? 1 : -1;
        f.face = dir;
        const pace = f.st.walk * (f.weapon.spec.fleet ?? 1) * 1.12;
        f.x = Phaser.Math.Clamp(f.x + dir * pace * dt, ARENA.left, ARENA.right);
        f.step += pace * dt;
        return;
      }
    }
  } else if (f.seeking) {
    f.seeking = null;
  }

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
  // ---- ANYTHING IN YOUR HANDS WILL BLOCK, IF YOU GET IT THERE IN TIME.
  //
  // This only ever fired for a fighter who was hurt or happened to be
  // carrying a shield, so for most of the rack blocking simply did not exist.
  // Any weapon can be put between you and what is coming; whether that was a
  // good idea is a question for the weapon, which pays for it in wear, and
  // for how much it actually turns aside.  A berserker still will not.
  const armedNow = !f.broken && f.weapon.key !== 'none';
  // These were a tenth of this and blocking simply never happened -- a fifth
  // of a block a bout for most of the rack, which is not a mechanic, it is a
  // rounding error.  A guard costs the tempo you would have attacked in, so
  // it is still a decision and not a free action.
  let wantBlock = hurt ? 3.2 : f.st.guard > 0 ? 2.2 : armedNow ? 1.5 : 0.8;
  if (armedNow) wantBlock *= f.weapon.spec.bulwark ?? 1;
  // A berserker used to be barred from blocking outright.  That was a fair
  // reading of the archetype while nobody blocked much; once everybody did,
  // never spending tempo on defence became a straight advantage and the
  // berserker went to 62%.  It still hates doing it -- a fifth as often as
  // anyone else -- which is a trade-off rather than an exemption.
  if (f.type?.berserk) wantBlock *= 0.2;
  if (f.act === 'walk' && gap <= other.st.reach + 4 && rng() < wantBlock * dt) {
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
  const sp = f.weapon.spec;
  // A sweeping weapon -- scythe, war scythe, staff, claymore -- can catch
  // somebody who is walking onto it, so its effective reach grows while the
  // other one is closing.  A thrown knife opens from right across the sand.
  // Where this fighter wants to be standing, worked out before it decides
  // whether to swing -- because when it is out-reached, that decision is
  // partly "not from here".
  const theirSweet = other.st.reach * INSIDE_FRAC;
  const press = other.st.reach > f.st.reach
    ? Math.min(f.st.reach - 2, theirSweet - 2)
    : f.st.reach - 2;
  const closing = gap < wasGap - 0.01 || other.act === 'lunge';
  const swing = f.st.reach * (1 + (sp.sweep && closing ? sp.sweep : 0));
  // A loaded ranged weapon can open from anywhere inside its carry, but only
  // once it has finished reloading -- that wait is most of what a crossbow
  // costs and the whole reason a bow is not simply better than a sword.
  const inThrowRange = armed(f) && f.reload <= 0 && gap > f.st.reach && gap <= sp.ranged!.far;
  // Asked once, here, and remembered for the wind-up that follows.
  f.throwPlan = inThrowRange ? throwWorthIt(f, other, gap, rng) : f.throwPlan;
  const shooting = inThrowRange && f.throwPlan;
  const mv = chooseMove(f, other, gap, rng);
  // ---- AND SOMETIMES THE RIGHT ANSWER IS NOT TO SWING YET.
  //
  // Pressing inside only moved the mean gap by a pixel, because the swing
  // test fires the moment the target is at the OUTER edge of your own reach:
  // the fighter never walked the last few pixels, swung from there, and spent
  // the cool-down drifting back out.  So it traded every exchange at exactly
  // the distance the longer weapon was built for.
  //
  // Out-reached and still at arm's length, closing is worth more than the
  // swing.  Desperation and the back half of a combination both override it,
  // so nobody stands there declining to fight.
  // A charge is exempt: it IS the answer to being out-reached, and holding
  // it until the gap was already closed left it nothing to run across.
  const holdFire = other.st.reach > f.st.reach * 1.1 && gap > press + 3
    && !f.desperate && f.chain === 0 && !armed(f) && mv.anim !== 'charge';
  if ((gap <= swing * MOVE_REACH(mv) || shooting) && f.cool <= 0 && !holdFire) {
    const share = f.riposte ? RIPOSTE_WINDUP : f.chain > 0 ? COMBO_WINDUP : f.desperate ? 0.78 : 1;
    f.act = 'windup';
    f.move = mv;
    // A heavy overhead takes longer to bring round than a jab; the move says
    // how much, so a weapon's slow attacks really are its slow ones.
    // ---- HALF-WEIGHT, BOTH WAYS.
    //
    // Taken at face value the move modifiers compound the thing they sit on
    // top of: every claymore attack winds up slower than its base swing and
    // every sword attack winds up faster, so a claymore-and-plate build went
    // from beating sword-and-chain three times in four to losing three times
    // in five -- the moves, not the equipment, were deciding it.  Halving
    // both the wind-up and the damage sides keeps an overhead slower and
    // heavier than a thrust while leaving the gear in charge.
    f.t = (WINDUP * share * MOVE_WEIGHT(shooting ? sp.ranged!.wind : mv.wind)) / f.st.rate;
    f.swing = 0;
    f.countering = f.counterT > 0;
    f.riposte = false;
    return;
  }

  // ---- CLOSING THE LAST OF IT IN ONE GO.
  //
  // Standing out of reach and walking in at a constant pace is what made the
  // old fight look like two people queueing.  A lunge covers the last stretch
  // in a burst, which is where the sudden changes of distance come from --
  // and being out of position afterwards is what it costs.
  //
  // A fighter with shots left has no business lunging into a clinch: closing
  // the distance is the one thing that beats him, so he must not do it to
  // himself.  Once the quiver is empty he closes like anybody else.
  const nerve = (ty?.nerve ?? 1) * (ty?.berserk ? 1 + (1 - f.hp / f.st.maxHp) * 0.9 : 1);
  if (!holds(f) && f.cool <= 0 && gap > f.st.reach && gap < f.st.reach + 26 && rng() < (f.desperate ? 2.2 : 1.1) * nerve * dt) {
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
  // ---- WHEN THEY OUT-REACH YOU, YOUR OWN MAXIMUM IS THE WRONG PLACE.
  //
  // Everyone closed to their own reach and stopped, which against a longer
  // weapon means standing at the one distance where theirs is at its best and
  // yours is merely adequate.  Measured: only 8% of a spear's blows against a
  // sword landed inside the spear's sweet spot, so the "a long weapon is bad
  // up close" rule -- the short blade's entire win condition -- almost never
  // fired.  Against brass knuckles, which genuinely do get inside, it fired
  // on 80%, so the rule was sound and nobody was using it.
  //
  // A fighter who is out-reached now presses to inside the arc THEIR reach is
  // measured by, as long as it is still somewhere it can land from.  It is
  // the same rule for both of them; it simply only has anything to say to
  // whoever is holding the shorter weapon.
  const keep = Math.min(f.st.range, press);
  // Already inside the arc of whatever the other one is swinging?  Then the
  // spacing is won: stand in it.  Drifting back out on the cool-down was
  // handing the long weapon its range back for free every other second, and
  // it is the reason a dagger could not stay where a dagger beats a scythe.
  const stuck = gap < other.st.reach * INSIDE_FRAC;
  const give = ty?.stubborn ? 1 : hurt ? 1.25 : 1;
  const drift = ty?.restless ? 1 + Math.sin(f.step * 0.09) * 0.3 : 1;
  // ---- AND EVENTUALLY THEY STOP CIRCLING.
  //
  // Wearing armour out only ends a fight in which somebody is being hit.  A
  // handful ran to the cap with barely a blow thrown at all -- a long weapon
  // holding its distance against somebody with no way to close it.  Past the
  // same weary mark, both of them give up on spacing and come in.
  const weary = Math.min(1, Math.max(0, (f.clock - WEARY_AT) / WEARY_OVER));
  const spacing = 1 + ((ty?.spacing ?? 1) - 1) * (1 - weary);
  // Nobody stands on one spot.  A fighter parked at exactly its own maximum
  // reach only ever has its longest move available, which is why the club
  // threw its horizontal sweep ninety-six times in a hundred and never once
  // used its shoulder strike.  A slow drift in and out of a foot or so gives
  // the shorter attacks a distance at which they are the right answer.
  const breathe = 1 + Math.sin(f.clock * 1.9 + (f.who === 'frog' ? 0 : 2.1)) * 0.14;
  // ---- WHERE A SHOOTER WANTS TO BE, which is not where a swordsman does.
  //
  // With shots in hand the whole plan is the distance: stand at `hold`, and
  // back off rather than let anybody walk in.  Weariness still drags both of
  // them together in the end, so a bow cannot simply kite out the clock.
  let want = (f.cool > 0 && !stuck ? f.st.range * give * spacing : keep) * (1 - weary * 0.5) * drift * breathe;
  if (holds(f)) {
    const hold = sp.ranged!.hold * (ty?.spacing ?? 1) * (1 - weary * 0.45) * breathe;
    want = Math.min(hold, sp.ranged!.far - 6);
  }
  const dir = gap > want + 2 ? 1 : gap < want - 2 ? -1 : 0;
  if (dir !== 0) {
    // ---- GIVING GROUND IS SLOWER THAN TAKING IT.
    //
    // Without this an archer simply walks away for ever at exactly the pace
    // the swordsman walks in, and a bow beats most of the rack by never being
    // reached: 82% against sword and chain, which is not a weapon, it is a
    // loophole.  Backing off at under two thirds pace means a bow can hold a
    // distance it already has and cannot open a new one against somebody
    // committed to closing -- so getting inside it stays the answer to it.
    //
    // It applies to both fighters and to every weapon, so it is a rule about
    // footwork and not a tax on bows.
    const pace = f.st.walk * (f.weapon.spec.fleet ?? 1) * (dir < 0 ? RETREAT : 1);
    f.x += f.face * dir * pace * dt;
    f.x = Phaser.Math.Clamp(f.x, ARENA.left, ARENA.right);
    f.step += pace * dt;
  }
}

/**
 * Move one fighter's clock on, and fire the strike when the wind-up ends.
 *
 * Returns the blow if one was thrown this tick, so the caller can draw it.
 * Split from `think` because timers must run even while a fighter is stunned
 * and has no say in anything.
 */
export function tick(f: Fighter, other: Fighter, dt: number, rng = Math.random, ground: Dropped[] = []): Blow | null {
  f.clock += dt;
  if (f.cool > 0) f.cool -= dt;
  if (f.reload > 0) f.reload -= dt;
  if (f.counterT > 0) f.counterT -= dt;
  if (f.throwCool > 0) f.throwCool -= dt;
  // ---- POISON KEEPS WORKING WHILE EVERYTHING ELSE HAPPENS.
  //
  // Above the stun return, deliberately: being knocked down is not a rest
  // from it, and a fighter who is poisoned and staggered is in the worst
  // trouble in the game.  It cannot take the last point of health -- a dart
  // is a wearing-down weapon, and losing to a tick that landed four seconds
  // ago reads as the fight ending by itself.
  if (f.pox.left > 0) {
    f.pox.left -= dt;
    f.pox.next -= dt;
    if (f.pox.next <= 0) {
      f.pox.next += POX_TICK;
      f.hp = Math.max(1, f.hp - f.pox.bite);
    }
    if (f.pox.left <= 0) f.pox = { left: 0, bite: 0, next: 0 };
  }
  if (f.stun > 0) {
    f.stun -= dt;
    return null;
  }
  if (f.act === 'walk') {
    think(f, other, dt, rng, ground);
    return null;
  }

  // A lunge is movement, so it has to happen while its clock runs rather than
  // when it ends.  It closes ground at better than twice a walk.
  if (f.act === 'lunge') {
    f.x = Phaser.Math.Clamp(f.x + f.face * f.st.walk * LUNGE_MUL * dt, ARENA.left, ARENA.right);
    f.step += f.st.walk * LUNGE_MUL * dt;
  }

  // ---- AND A CHARGE IS MOVEMENT TOO.  The wind-up is the run: it covers
  // the ground at better than twice a walk and pulls up at shield's length,
  // so the blow lands from where a shield actually reaches.
  if (f.act === 'windup' && f.move?.anim === 'charge') {
    const gap = Math.abs(f.x - other.x);
    const stop = f.st.reach * 0.6;
    if (gap > stop) {
      const run = Math.min(gap - stop, f.st.walk * CHARGE_MUL * dt);
      f.x = Phaser.Math.Clamp(f.x + f.face * run, ARENA.left, ARENA.right);
      f.step += run;
    }
  }

  f.t -= dt;
  if (f.t > 0) return null;

  switch (f.act) {
    case 'windup': {
      f.act = 'strike';
      f.t = STRIKE;
      const blow = resolveStrike(f, other, Math.abs(f.x - other.x), rng, ground);
      f.swing += 1;
      return blow;
    }
    case 'strike': {
      // A weapon that throws two puts the second one in without a fresh
      // wind-up, which is what "rapid, multiple strikes" actually feels like.
      // One blade of a pair puts in one strike where two put in two.
      const strikes = f.single
        ? Math.max(1, Math.ceil(Math.max(f.weapon.hits, f.move?.hits ?? 1) / 2))
        : Math.max(f.weapon.hits, f.move?.hits ?? 1);
      if (f.swing < strikes) {
        f.t = STRIKE;
        const blow = resolveStrike(f, other, Math.abs(f.x - other.x), rng, ground);
        f.swing += 1;
        return blow;
      }
      // ---- AND THE COMBINATION.  A quick fighter sometimes does not stop at
      // one: the chance comes off SPEED, so it is the same rule for both and
      // the fast kit is the one that gets to use it.
      if (f.chain > 0) f.chain -= 1;
      else if (rng() < COMBO_MAX * (f.st.speedPts / 100) * (f.weapon.spec.combo ?? 1) * (f.desperate ? 1.4 : 1)) f.chain = 1;
      f.act = 'recover';
      // A claymore or a heavy hammer takes a week to come back round.
      const drag = 1 + (f.weapon.spec.slowRecover ?? 0);
      f.t = (RECOVER * drag * (f.chain > 0 ? 0.45 : 1)) / f.st.rate;
      f.countering = false;
      f.counterT = 0;
      return null;
    }
    case 'pickup': {
      // Bent down over it for as long as its bulk deserves -- a dagger comes
      // up in a moment and a claymore has to be hauled off the sand.
      const d = f.seeking;
      if (d && ground.includes(d) && Math.abs(f.x - d.x) < 14) takeWeapon(f, d, ground);
      f.seeking = null;
      f.act = 'walk';
      f.cool = BEAT / f.st.rate;
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
/**
 * ADVANCE WHATEVER IS IN THE AIR, and hand back the ones that arrived.
 *
 * Done before either fighter acts, so a shot lands against the positions the
 * tick started from rather than against wherever the footwork has just put
 * them.  A boomerang that misses comes back and is loaded again; everything
 * else is simply spent.
 */
function advanceFlight(att: Fighter, def: Fighter, dt: number, rng: () => number,
  out: Array<{ att: Fighter; def: Fighter; blow: Blow }>, ground: Dropped[] = []): void {
  if (!att.flight.length) return;
  const still: InFlight[] = [];
  for (const sh of att.flight) {
    sh.t -= dt;
    if (sh.t > 0) { still.push(sh); continue; }
    const blow = landShot(att, def, sh, rng, ground);
    blow.loosed = sh;                    // so the drawing can retire the sprite
    if (sh.r.returns && !Number.isFinite(att.ammo)) att.reload = Math.max(att.reload, sh.r.reload);
    out.push({ att, def, blow });
  }
  att.flight = still;
}

export function exchange(a: Fighter, b: Fighter, dt: number, rng = Math.random, ground: Dropped[] = []): Array<{ att: Fighter; def: Fighter; blow: Blow }> {
  const out: Array<{ att: Fighter; def: Fighter; blow: Blow }> = [];
  advanceFlight(a, b, dt, rng, out, ground);
  advanceFlight(b, a, dt, rng, out, ground);
  // what is on the sand settles, and eventually the sand has it
  for (let i = ground.length - 1; i >= 0; i--) {
    const d = ground[i];
    if (d.settle > 0) d.settle -= dt;
    d.life -= dt;
    if (d.life <= 0) {
      if (a.seeking === d) a.seeking = null;
      if (b.seeking === d) b.seeking = null;
      d.art?.destroy();
      ground.splice(i, 1);
    }
  }
  const hpA = a.hp;
  const hpB = b.hp;
  const blowA = tick(a, b, dt, rng, ground);
  const blowB = tick(b, a, dt, rng, ground);

  if (blowA && blowB && blowA.hit && blowB.hit && !blowA.thrown && !blowB.thrown) {
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
export function simulate(a: Kit, bKit: Kit, rng = Math.random, cap = 180, type: LizardType | null = null): { winner: 'frog' | 'lizard' | null; seconds: number; breaks: number; clashes: number; disarms: number } {
  const f = makeFighter('frog', a, 100, 1);
  const l = makeFighter('lizard', bKit, 220, -1, type);
  const dt = 1 / 60;
  const ground: Dropped[] = [];
  let t = 0;
  let breaks = 0;
  let clashes = 0;
  let disarms = 0;
  while (t < cap && f.hp > 0 && l.hp > 0) {
    // The same call the scene makes, so what is measured here is what is
    // played there -- clashes and all.
    for (const e of exchange(f, l, dt, rng, ground)) {
      if (e.blow.broke) breaks++;
      if (e.blow.disarmed) disarms++;
      if (e.blow.clashed) clashes++;
    }
    t += dt;
  }
  return { winner: f.hp <= 0 ? 'lizard' : l.hp <= 0 ? 'frog' : null, seconds: t, breaks, clashes, disarms };
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
  arm: Arm;
  /** The off hand.  Behind the body while a weapon is held; up in a guard
   *  the moment there is not one. */
  armOff: Arm;
  /** Whether the off hand has been brought round to the front yet. */
  guardUp: boolean;
  weapon: Phaser.GameObjects.Container;
  /** Stays flat on the sand while everything above it moves. */
  shadow: Phaser.GameObjects.Ellipse;
  /** Every piece of armour, by slot, so a broken one can be taken off. */
  kneeL: Phaser.GameObjects.Rectangle;
  kneeR: Phaser.GameObjects.Rectangle;
  footL: Phaser.GameObjects.Rectangle;
  footR: Phaser.GameObjects.Rectangle;
  belt: Phaser.GameObjects.Rectangle;
  ridge: Phaser.GameObjects.Rectangle;
  pauldL: Phaser.GameObjects.Ellipse;
  pauldR: Phaser.GameObjects.Ellipse;
  helmDome: Phaser.GameObjects.Ellipse;
  /** A crown is not a helm and is not drawn as one; see `buildFighter`. */
  crown: Phaser.GameObjects.Container;
  visor: Phaser.GameObjects.Rectangle;
  plume: Phaser.GameObjects.Rectangle;
  /** Everything above the neck, so a duck moves the face and not just the skull. */
  headGroup: Phaser.GameObjects.Container;
  /** An animal's tail, hinged at the hip, which sways and swings.  (The
   *  lizard's is part of the body and does not have one of these.) */
  tail: Phaser.GameObjects.Container | null;
  /** Damage marks already cut into the weapon in hand, so they are added
   *  once each rather than sixty times a second. */
  nicks: number;
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
function buildWeapon(scene: Phaser.Scene, key: string, tint: number, single = false): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  // What this sprite IS, so anything reconciling the art against the model can
  // ask rather than infer.  `showThrownAway` needs to know whether the hand is
  // already drawn empty before it swaps it for a fist.
  c.setData('key', key);
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
    // ---- BARE HANDS, and the fallback for anything unrecognised.
    //
    // This used to be the `none` case with the SPIKED SHIELD sitting in
    // `default`, which meant any key the switch did not know drew a shield.
    // A broken weapon asked for 'fists' -- a key that no longer exists --
    // and was handed a shield in the middle of the fight.  The unknown case
    // is a fist now: wrong, if it ever happens, in the direction of nothing
    // rather than in the direction of a free shield.
    case 'none':
    default:
      bar(3, 0, 5, 6, tint);
      bar(3, -2, 5, 1.5, 0xffffff).setAlpha(0.22);
      bar(3, 2.5, 5, 1, 0x000000).setAlpha(0.18);
      // three knuckles across the front of it
      for (let k = 0; k < 3; k++) c.add(scene.add.circle(5.5, -1.8 + k * 1.9, 0.9, tint));
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
      // down to one blade, it is drawn as one blade
      if (single) { blade(11, 0, 19, 2.8); bar(0, 0, 3, 5, grip); break; }
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
      // Forty-two long, from a cap behind the hand to one well out in front:
      // it was thirty-four and read as a walking stick next to the spears.
      haft(12, 0, 42, 3.5);
      bar(32, 0, 4, 4.5, PALETTE.bone); bar(-8, 0, 4, 4.5, PALETTE.bone);
      bar(12, 0, 42, 1, 0x5a4530).setAlpha(0.5);
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
    // ---- THE ROMAN AND THE POLEARM RACK
    case 'gladius':
      blade(9, 0, 16, 3.5); bar(0, 0, 2.5, 8, PALETTE.gold); bar(-3, 0, 4, 4, 0x6a4a2a);
      break;
    // ---- THE TEN ADDED TO THE RACK.  Each one has to be recognisable from
    // its silhouette alone at this size, which is why no two of them share a
    // head shape.
    case 'sickle':
      bar(2, 0, 7, 2.5, 0x6a4a2a);
      bar(9, -3, 8, 2, steel); bar(13, 1.5, 2, 7, steel); bar(9, -3.6, 8, 1, shine);
      break;
    case 'warfan':
      bar(1, 0, 4, 2.5, 0x3b2a1a);
      for (let k = -2; k <= 2; k++) c.add(scene.add.rectangle(8, k * 2.1, 11, 1.4, steel).setAngle(k * 9));
      bar(13, 0, 1.5, 10, shine);
      break;
    case 'scimitar':
      bar(0, 0, 4, 3, 0x6a4a2a); bar(2, 0, 2.5, 7, PALETTE.gold);
      for (let k = 0; k < 4; k++) bar(6 + k * 4, -k * 0.9, 5, 3 - k * 0.2, k % 2 ? steel : shine);
      c.add(scene.add.triangle(22, -3.4, 0, 0, 5, -1.5, 0, 3, steel));
      break;
    case 'estoc':
      bar(0, 0, 4, 2.5, 0x3b2a1a); bar(2.5, 0, 2, 8, PALETTE.gold);
      bar(14, 0, 22, 2, steel); bar(14, -0.8, 22, 0.8, shine);
      c.add(scene.add.triangle(26, 0, 0, -1.6, 5, 0, 0, 1.6, shine));
      break;
    case 'pike':
      haft(8, 0, 38, 2.5);
      c.add(scene.add.triangle(30, 0, 0, -3, 9, 0, 0, 3, steel));
      bar(30, -1, 7, 1, shine); bar(12, 0, 3, 4.5, 0x6a4a2a);
      break;
    case 'glaive':
      haft(5, 0, 28, 2.5);
      c.add(scene.add.triangle(24, -2.4, 0, 0, 10, -3, 2, 6, steel));
      bar(23, -4, 8, 1, shine); bar(17, 0, 2, 5, PALETTE.gold);
      break;
    case 'maul':
      haft(4, 0, 22, 3);
      bar(19, 0, 9, 13, 0x6f7681); bar(19, -5, 9, 2.5, 0x9aa2ae);
      bar(19, 5.5, 9, 2, 0x4c525b); bar(15, 0, 2, 13, 0x3b2a1a);
      break;
    case 'bardiche':
      haft(5, 0, 26, 2.5);
      c.add(scene.add.triangle(21, -3, 0, -7, 9, -2, 0, 7, steel));
      bar(20, -6, 8, 1, shine); bar(14, 0, 2, 4, 0x6a4a2a);
      break;
    case 'harpoon':
      haft(6, 0, 28, 2.5);
      c.add(scene.add.triangle(23, 0, 0, -3.5, 9, 0, 0, 3.5, steel));
      // the barbs, which are the whole of what makes it a harpoon
      bar(19, -3, 5, 1.6, steel, -32); bar(19, 3, 5, 1.6, steel, 32);
      bar(-6, 0, 6, 1, 0xbfae8a);
      break;
    case 'bolas':
      bar(2, 0, 9, 1, 0x7a6a4a, 18); bar(2, 0, 9, 1, 0x7a6a4a, -18);
      c.add(scene.add.circle(10, 4, 3, 0x6f7681));
      c.add(scene.add.circle(10, -4, 3, 0x6f7681));
      c.add(scene.add.circle(9, 3.2, 1.2, 0x9aa2ae));
      c.add(scene.add.circle(9, -4.8, 1.2, 0x9aa2ae));
      break;
    case 'spear':
      haft(6, 0, 30, 2.5);
      c.add(scene.add.triangle(24, 0, 0, -4, 11, 0, 0, 4, steel));
      bar(24, -1, 9, 1, shine); bar(10, 0, 3, 4, PALETTE.gold);
      break;
    case 'trident':
      haft(4, 0, 26, 2.5);
      bar(20, 0, 9, 2, steel); bar(24, -5, 8, 2, steel); bar(24, 5, 8, 2, steel);
      c.add(scene.add.triangle(29, 0, 0, -2, 6, 0, 0, 2, shine));
      break;
    case 'halberd':
      haft(6, 0, 30, 2.5);
      bar(20, -4, 9, 8, steel); bar(20, -6, 9, 2, shine);
      c.add(scene.add.triangle(26, 0, 0, -4, 9, 0, 0, 4, steel));
      bar(20, 5, 5, 3, shade);
      break;
    case 'warscythe':
      haft(10, 0, 30, 3);
      blade(26, -4, 15, 2.5, -18); blade(31, -9, 9, 2, -48);
      bar(16, 0, 3, 4, PALETTE.gold);
      break;
    // ---- THE CRUSHING RACK
    case 'mace':
      haft(5, 0, 13, 3);
      c.add(scene.add.circle(16, 0, 5, PALETTE.steel));
      for (let i = 0; i < 4; i++) bar(16, 0, 12, 2.2, PALETTE.fog, i * 45);
      c.add(scene.add.circle(15, -1, 1.8, shine).setAlpha(0.6));
      break;
    case 'morningstar':
      haft(4, 0, 11, 2.8);
      bar(12, 0, 6, 1, PALETTE.fog);
      c.add(scene.add.circle(20, 0, 5, 0x5e5a63));
      for (let i = 0; i < 6; i++) bar(20, 0, 12, 1.6, PALETTE.bone, i * 30);
      break;
    case 'warhammer':
      haft(6, 0, 15, 3.2);
      bar(17, 0, 9, 11, PALETTE.steel); bar(17, -4, 9, 2.5, shine); bar(17, 4, 9, 2, shade);
      bar(23, 0, 4, 5, PALETTE.fog);
      break;
    case 'heavyhammer':
      haft(5, 0, 14, 3.5);
      bar(18, 0, 12, 14, PALETTE.steel); bar(18, -5, 12, 3, shine); bar(18, 5, 12, 2.5, shade);
      bar(12, 0, 3, 14, 0x5a4530);
      break;
    case 'club':
      bar(9, 0, 20, 5, wood); bar(9, -1.6, 20, 1.5, woodLit);
      bar(17, 0, 8, 8, wood); bar(17, -2.5, 8, 1.5, woodLit);
      for (let i = 0; i < 3; i++) c.add(scene.add.circle(14 + i * 3, (i % 2 ? -2 : 2), 1, 0x5a4530));
      break;
    case 'claymore':
      blade(15, 0, 28, 4.5); bar(2, 0, 3, 13, PALETTE.steel); bar(-3, 0, 5, 4, grip);
      bar(2, 0, 3, 3, PALETTE.gold);
      break;
    case 'greataxe':
      haft(9, 0, 19, 3.5);
      bar(19, -2, 12, 15, PALETTE.steel); bar(19, -7, 12, 3, shine);
      c.add(scene.add.triangle(25, -2, 0, 0, 6, 7, 0, 14, shade));
      bar(13, -2, 3, 15, 0x5a4530);
      break;
    // ---- THE QUICK RACK
    case 'rapier':
      bar(13, 0, 25, 1.5, steel); bar(13, -0.8, 25, 0.8, shine);
      c.add(scene.add.circle(1, 0, 3.5, PALETTE.gold));
      c.add(scene.add.circle(1, 0, 2, 0, 0).setStrokeStyle(1, PALETTE.amberDark));
      bar(-3, 0, 4, 3, grip);
      break;
    case 'twindagger':
      if (single) { blade(5, 0, 9, 2.5); bar(0, 0, 2, 6, PALETTE.gold); bar(-2, 0, 3, 3, grip); break; }
      blade(6, -4, 10, 2, -14); blade(6, 4, 10, 2, 14);
      bar(0, -3, 3, 4, grip); bar(0, 3, 3, 4, grip);
      break;
    case 'throwing':
      // one in the hand and two more held ready between the fingers
      blade(6, 0, 9, 2);
      bar(0, 0, 3, 3, grip);
      blade(3, -5, 6, 1.5, -26); blade(3, 5, 6, 1.5, 26);
      break;
    // ---- THE RANGED RACK.  A bow reads by its limbs and its string, a
    // crossbow by the cross, a sling by the pouch on the end of a cord.
    case 'bow': case 'longbow': {
      const big = key === 'longbow';
      const h = big ? 22 : 17;
      bar(2, -h / 2 + 2, 2.5, h / 2 + 2, wood, -16);
      bar(2, h / 2 - 2, 2.5, h / 2 + 2, wood, 16);
      bar(2, -h / 2 + 2, 1, h / 2 + 2, woodLit, -16);
      bar(5, 0, 1, h - 1, 0xe6dcc4);                   // the string
      bar(0, 0, 3, 5, grip);
      if (big) { bar(2, -h / 2 - 1, 3, 2, PALETTE.gold); bar(2, h / 2 + 1, 3, 2, PALETTE.gold); }
      break;
    }
    case 'crossbow':
      haft(6, 0, 15, 3.5); bar(3, 0, 2.5, 14, wood);   // stock and the bow across it
      bar(3, -6, 3, 2, steel); bar(3, 6, 3, 2, steel);
      bar(5, 0, 1, 12, 0xe6dcc4);
      blade(12, 0, 9, 1.5); bar(-1, 1, 4, 4, grip);
      break;
    case 'sling':
      bar(1, 0, 3, 3, grip);
      bar(5, -3, 8, 1, 0x6b5436, -22); bar(5, 3, 8, 1, 0x6b5436, 22);
      bar(10, 0, 4, 4, 0x8a6a42); c.add(scene.add.circle(10, 0, 1.6, 0x9a9a9a));
      break;
    case 'blowgun':
      haft(8, 0, 18, 2.5); bar(17, 0, 2, 3.5, PALETTE.ink);
      bar(0, 0, 3, 3.5, 0x4a3a24);
      break;
    case 'magicstaff':
      haft(7, 2, 20, 3, -8);
      c.add(scene.add.circle(16, -5, 3.4, 0x6fd8e8));
      c.add(scene.add.circle(16, -5, 2, 0xdffaff));
      bar(16, -9, 1.5, 3, 0x9a6ab0); bar(13, -3, 5, 1.5, PALETTE.gold, -20);
      break;
    case 'throwaxe':
      haft(6, 0, 12, 2.5);
      bar(12, -2, 6, 7, steel); bar(12, -3.5, 6, 1.5, shine); bar(13, 1, 4, 1.5, shade);
      break;
    case 'javelin':
      haft(9, 0, 24, 2.5); blade(21, 0, 7, 2.5);
      bar(2, 0, 3, 3.5, 0x6a4a2a); bar(6, 0, 2, 4, PALETTE.gold);
      break;
    case 'chakram':
      c.add(scene.add.circle(7, 0, 6, 0x000000).setAlpha(0.18));
      bar(7, -5.5, 9, 2, steel); bar(7, 5.5, 9, 2, steel);
      bar(2.5, 0, 2, 9, steel); bar(11.5, 0, 2, 9, steel);
      bar(7, -6, 9, 1, shine);
      break;
    case 'boomerang':
      bar(5, -3, 11, 3, woodLit, -32); bar(5, 3, 11, 3, wood, 32);
      bar(5, -4, 11, 1, 0xc6a06a, -32);
      break;
    case 'shield': {
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
/**
 * THE SHAPE OF EACH ANIMAL, as the rig needs it.
 *
 * `neck` lifts the head clear of the shoulders (a giraffe's is most of it);
 * `fwd` and `drop` carry it forward of them and down -- a gorilla, a rhino
 * and a hyena all fight with the head low and out in front, where a giraffe
 * and a wolf carry it up.  `arm` is the length of the whole arm and `hand`
 * the size of what is on the end of it: a gorilla's hands are huge and its
 * arms long, a giraffe's arms are longest of all because that is its reach.
 * `feet` is what it stands on, and `claws` whether its hands have them.
 */
interface Anatomy {
  neck: number;
  fwd: number;
  drop: number;
  arm: number;
  hand: number;
  feet: 'paw' | 'hoof' | 'flat' | 'claw';
  claws: boolean;
}
const ANATOMY: Record<Animal, Anatomy> = {
  gorilla: { neck: 0, fwd: 3, drop: 3, arm: 1.2, hand: 1.4, feet: 'flat', claws: false },
  cheetah: { neck: 1, fwd: 2, drop: 0, arm: 1.06, hand: 0.9, feet: 'paw', claws: true },
  rhino: { neck: 0, fwd: 5, drop: 5, arm: 0.95, hand: 1.15, feet: 'hoof', claws: false },
  hyena: { neck: 0, fwd: 5, drop: 4, arm: 1.0, hand: 0.95, feet: 'paw', claws: true },
  giraffe: { neck: 17, fwd: 5, drop: 0, arm: 1.42, hand: 0.85, feet: 'hoof', claws: false },
  lion: { neck: 0, fwd: 2, drop: 1, arm: 1.06, hand: 1.2, feet: 'paw', claws: true },
  lizard: { neck: 0, fwd: 0, drop: 0, arm: 1.0, hand: 1.0, feet: 'claw', claws: true },
  wolf: { neck: 0, fwd: 2, drop: -1, arm: 1.05, hand: 0.95, feet: 'paw', claws: true },
};

/** What `dressAnimal` hands back: the parts, sorted by where they are drawn. */
interface AnimalParts {
  /** Behind the skull, moving with the head: a neck, a mane, the far ear. */
  headBack: Phaser.GameObjects.GameObject[];
  /** Over the skull: the face. */
  face: Phaser.GameObjects.GameObject[];
  /** Over the torso and under any armour: markings, muscle, a ruff. */
  body: Phaser.GameObjects.GameObject[];
  /** The tail, hinged at the hip so it can sway; null for a gorilla. */
  tail: Phaser.GameObjects.Container | null;
  /** The skull itself: its size and its colour. */
  skullW: number;
  skullH: number;
  skullCol: number;
}

/**
 * EACH ANIMAL'S OWN HEAD, BODY MARKINGS AND TAIL.
 *
 * Not one face with the colours changed.  Every head here is built for the
 * animal it belongs to -- a gorilla's is a broad primate face under a brow
 * ridge, a cheetah's a short feline muzzle with its tear marks, a rhino's a
 * long heavy head with the horn on the end of it, a hyena's a blunt dark
 * muzzle under two huge round ears, a giraffe's a long narrow head on top of
 * a long neck, a lion's a feline face in a mane, a wolf's a long canine
 * muzzle under tall pointed ears.  Everything is placed from the head's
 * centre (`HX`, `HY`), so the rig can carry it wherever the neck puts it,
 * and all of it rides the head group, so a duck, a dodge or a throw takes the
 * whole face along.
 *
 * Triangles are drawn with Graphics at their exact coordinates: an Arcade
 * `triangle` centres its bounding box on its position, which puts any point
 * given above or left of zero somewhere other than where it was written.
 */
function dressAnimal(scene: Phaser.Scene, animal: Animal, c: {
  HX: number; HY: number; skin: number; light: number; dark: number; crest: number; outline: number;
  torsoCY: number; torsoTop: number; torsoW: number; torsoH: number; hipX: number; hipY: number;
  up: (c: number, k?: number) => number; down: (c: number, k?: number) => number;
}): AnimalParts {
  const { HX, HY, skin, light, dark, crest, outline, torsoCY, torsoTop, torsoW, torsoH, up, down } = c;
  const E = (x: number, y: number, w: number, h: number, col: number, a = 1) => scene.add.ellipse(x, y, w, h, col).setAlpha(a);
  const R = (x: number, y: number, w: number, h: number, col: number, ang = 0, a = 1) =>
    scene.add.rectangle(x, y, w, h, col).setAngle(ang).setAlpha(a);
  const C = (x: number, y: number, r: number, col: number, a = 1) => scene.add.circle(x, y, r, col).setAlpha(a);
  const T = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, col: number) =>
    scene.add.graphics().fillStyle(col, 1).fillTriangle(ax, ay, bx, by, cx, cy);
  type Pt = [number, number];
  const bez = (a: Pt, b: Pt, q: Pt, e: Pt, n = 12): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      out.push([
        u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * q[0] + t * t * t * e[0],
        u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * q[1] + t * t * t * e[1],
      ]);
    }
    return out;
  };
  /** A smooth tapered limb along a path: a tail, a neck. */
  const tube = (pts: Pt[], w0: number, w1: number, col: number): Phaser.GameObjects.Graphics => {
    const L: Phaser.Math.Vector2[] = [];
    const Rr: Phaser.Math.Vector2[] = [];
    const last = pts.length - 1;
    for (let i = 0; i <= last; i++) {
      const [px, py] = pts[Math.max(0, i - 1)];
      const [nx, ny] = pts[Math.min(last, i + 1)];
      const len = Math.hypot(nx - px, ny - py) || 1;
      const w = (w1 + (w0 - w1) * Math.pow(1 - i / last, 0.85)) / 2;
      L.push(new Phaser.Math.Vector2(pts[i][0] - ((ny - py) / len) * w, pts[i][1] + ((nx - px) / len) * w));
      Rr.push(new Phaser.Math.Vector2(pts[i][0] + ((ny - py) / len) * w, pts[i][1] - ((nx - px) / len) * w));
    }
    const g = scene.add.graphics().fillStyle(col, 1);
    g.fillPoints([...L, ...Rr.reverse()], true, true);
    g.fillCircle(pts[0][0], pts[0][1], w0 / 2);
    g.fillCircle(pts[last][0], pts[last][1], w1 / 2);
    return g;
  };
  /** Spots or patches scattered over the torso, the same every time. */
  const spots = (n: number, col: number, r0: number, r1: number, a = 0.85): Phaser.GameObjects.GameObject[] => {
    const out: Phaser.GameObjects.GameObject[] = [];
    for (let i = 0; i < n; i++) {
      const u = ((i * 0.618) % 1) * 2 - 1;
      const v = ((i * 0.382 + 0.3) % 1) * 2 - 1;
      const r = r0 + ((i * 7) % 5) / 4 * (r1 - r0);
      out.push(E(-1 + u * torsoW * 0.36, torsoCY + v * torsoH * 0.36, r * 1.3, r, col, a));
    }
    return out;
  };
  const headBack: Phaser.GameObjects.GameObject[] = [];
  const face: Phaser.GameObjects.GameObject[] = [];
  const body: Phaser.GameObjects.GameObject[] = [];
  const tailBits: Phaser.GameObjects.GameObject[] = [];
  // A plain neck from the top of the chest to the underside of the skull,
  // sunk into both so there is no gap to open when the head moves.
  const neckTo = (w0: number, w1: number, col: number) =>
    headBack.push(tube(bez([2, torsoTop + 5], [2, torsoTop - 2], [HX - 3, HY + 6], [HX - 1, HY + 2], 10), w0, w1, col));
  let skullW = 12;
  let skullH = 10;
  let skullCol = skin;

  switch (animal) {
    case 'gorilla': {
      // ---- A BROAD PRIMATE FACE, low between huge shoulders.  A domed crown,
      // a heavy brow ridge over small deep eyes, a pale leathery face with a
      // flat broad nose, and no neck to speak of.
      skullW = 14;
      skullH = 12;
      neckTo(10, 9, skin);
      headBack.push(E(HX - 1.5, HY - 4.6, 10, 6.5, skin), E(HX - 6.2, HY + 0.8, 3, 3.8, light));
      face.push(E(HX + 2.8, HY + 1.8, 9.6, 8.6, light));
      face.push(E(HX + 2.4, HY - 2.6, 12, 3.4, skin), E(HX + 2.4, HY - 3.2, 10, 1.4, up(skin, 0.25), 0.8));
      for (const ex of [1, 4.8]) face.push(E(HX + ex, HY - 0.4, 2.8, 2.2, 0x8a6a4a), C(HX + ex + 0.2, HY - 0.4, 0.8, 0x1a0e08), C(HX + ex - 0.3, HY - 0.9, 0.4, 0xffffff, 0.8));
      face.push(E(HX + 3.3, HY + 2, 5.8, 3.2, down(light, 0.42)));
      face.push(C(HX + 2.2, HY + 2.3, 0.7, dark), C(HX + 4.4, HY + 2.3, 0.7, dark));
      face.push(R(HX + 3.2, HY + 5, 6.4, 1.1, dark), E(HX + 3.2, HY + 6, 6, 2, light, 0.6));
      // Shoulders like a yoke, a chest in two slabs, and the silver saddle
      body.push(E(-1, torsoTop + 3, torsoW * 1.02, 11, skin));
      body.push(E(-1, torsoTop + 1.5, torsoW * 0.8, 3, up(skin, 0.22), 0.7));
      body.push(E(-3.5, torsoCY - 2.5, torsoW * 0.38, 7, up(skin, 0.16)), E(3.5, torsoCY - 2.5, torsoW * 0.38, 7, up(skin, 0.16)));
      body.push(E(-6, torsoCY + 1, torsoW * 0.4, torsoH * 0.5, crest, 0.45));
      body.push(E(0, torsoCY + 4, torsoW * 0.5, 7, light, 0.35));
      return { headBack, face, body, tail: null, skullW, skullH, skullCol };
    }
    case 'cheetah': {
      // ---- A SMALL ROUND FELINE HEAD, a short pale muzzle, amber eyes and
      // the black tear line from each eye to the mouth.
      skullW = 10;
      skullH = 8.6;
      neckTo(5, 4.2, skin);
      headBack.push(E(HX - 1, HY - 4.6, 3, 3.2, dark), E(HX - 3.2, HY - 4.2, 3.2, 3.4, skin), E(HX - 3.2, HY - 4, 1.6, 1.8, dark, 0.7));
      face.push(E(HX + 1, HY + 2.1, 6, 3.6, light, 0.8), E(HX + 4.4, HY + 1.8, 5.6, 4.2, light));
      face.push(T(HX + 5.4, HY + 0.1, HX + 7.8, HY + 0.1, HX + 6.6, HY + 1.6, 0x3a2418));
      face.push(E(HX + 2.4, HY - 1.4, 3, 2.2, 0xf0b838), R(HX + 2.7, HY - 1.4, 0.8, 1.8, PALETTE.black), C(HX + 2.1, HY - 1.9, 0.45, 0xffffff));
      face.push(R(HX + 3.3, HY + 1.4, 0.9, 4.2, 0x2a1a10, -18), R(HX + 5.2, HY + 3.7, 2.8, 0.7, dark));
      for (const [x, y] of [[-2, -2.5], [0, -3.4], [-3.4, 0.2], [-1.4, 1.4]] as const) face.push(C(HX + x, HY + y, 0.6, crest, 0.9));
      body.push(...spots(14, crest, 0.9, 1.5));
      body.push(E(2.5, torsoCY + 2, torsoW * 0.42, torsoH * 0.55, light, 0.55));
      // a long thin tail with a curl at the end, ringed and black-tipped
      const path = bez([0, 0], [-6, 3], [-15, 7], [-21, 0], 14);
      tailBits.push(tube(path, 2.8, 1.8, skin));
      for (let i = 8; i < path.length; i += 2) tailBits.push(E(path[i][0], path[i][1], 1.2, 2.4, crest, 0.9));
      tailBits.push(C(path[path.length - 1][0], path[path.length - 1][1], 1.3, crest));
      break;
    }
    case 'rhino': {
      // ---- A LONG HEAVY HEAD, low and forward, with the great horn on the
      // end of the snout and a smaller one behind it; small eyes set back,
      // tubular ears on top, and folds in the hide.
      skullW = 16;
      skullH = 11;
      neckTo(10, 10, skin);
      headBack.push(E(HX - 5.6, HY - 5.4, 2.6, 5.2, down(skin, 0.1)).setAngle(-20), E(HX - 3.6, HY - 6, 2.6, 5.4, skin).setAngle(-8));
      face.push(E(HX + 7, HY + 1.6, 10, 8.4, skin).setStrokeStyle(1, outline));
      face.push(T(HX + 7.2, HY - 1.6, HX + 12.6, HY - 0.4, HX + 11.6, HY - 11.5, crest), T(HX + 9.2, HY - 1.8, HX + 11.2, HY - 1.2, HX + 11.4, HY - 9, up(crest, 0.4)));
      face.push(T(HX + 2.6, HY - 3.8, HX + 6, HY - 3.4, HX + 5, HY - 8, crest));
      face.push(C(HX + 0.6, HY - 0.4, 1.1, 0x1a1a1a), R(HX + 0.8, HY + 1.4, 3.4, 0.7, dark, 0, 0.8));
      face.push(R(HX + 8.6, HY + 4.9, 5, 0.9, dark), R(HX - 2, HY + 3, 5, 0.7, dark, 58, 0.5), R(HX + 4.4, HY + 3.6, 4, 0.7, dark, 70, 0.4));
      // the hide: plated shoulders, deep folds at the shoulder and the hip
      body.push(E(4, torsoCY - 3, torsoW * 0.46, torsoH * 0.56, up(skin, 0.1)).setStrokeStyle(1, down(skin, 0.3)));
      body.push(R(-1 - torsoW * 0.22, torsoCY + 1, 1.1, torsoH * 0.78, dark, 8, 0.5), R(-1 + torsoW * 0.3, torsoCY + 1, 1.1, torsoH * 0.7, dark, -8, 0.5));
      body.push(R(-1, torsoCY + torsoH * 0.34, torsoW * 0.6, 1, dark, 0, 0.35));
      // a short tail with a dark tuft on the end
      tailBits.push(tube(bez([0, 0], [-3, 3], [-4, 6], [-4.5, 9], 8), 2, 1.2, skin), E(-4.5, 10.2, 2, 3, dark));
      break;
    }
    case 'hyena': {
      // ---- A BLUNT DARK MUZZLE AND TWO HUGE ROUND EARS, carried low and
      // forward off a hunched back with a bristling ridge down it.
      skullW = 12;
      skullH = 9.6;
      neckTo(7, 6, skin);
      headBack.push(E(HX + 1.4, HY - 6.6, 5, 6, dark), E(HX - 2.6, HY - 6.2, 5.6, 6.6, skin), E(HX - 2.6, HY - 6, 3, 4, 0x3a2c1a, 0.85));
      for (let i = 0; i < 4; i++) headBack.push(R(HX - 4.5 - i * 2.2, HY - 2.6 + i * 2.6, 1.4, 3.6, crest, -34));
      face.push(E(HX + 7, HY + 2, 9.4, 5.6, 0x40321e), E(HX + 6, HY + 0.6, 7.6, 2.6, skin, 0.85));
      face.push(C(HX + 11.4, HY + 1, 1.5, 0x120e08));
      face.push(C(HX + 2.4, HY - 1.8, 1.6, 0xf2e6c0), C(HX + 2.8, HY - 1.8, 0.8, PALETTE.black));
      face.push(R(HX + 7.6, HY + 4, 7.4, 0.9, 0x1a120a), R(HX + 8.8, HY + 3.3, 2.4, 0.9, PALETTE.cream), R(HX + 6.2, HY + 3.3, 1.2, 0.9, PALETTE.cream));
      face.push(C(HX - 2, HY + 1, 0.8, crest, 0.8), C(HX + 0.2, HY + 2.4, 0.7, crest, 0.8));
      // the hump over the shoulders, the ridge down the back, the spots
      body.push(E(3, torsoTop + 2.5, torsoW * 0.9, 8, skin));
      for (let i = 0; i < 4; i++) body.push(R(-2 - i * 2.4, torsoTop + 0.5 + i * 1.4, 1.3, 3.6, crest, -30));
      body.push(...spots(9, 0x4a3820, 1.1, 1.9, 0.8));
      // short, bushy and dark
      tailBits.push(tube(bez([0, 0], [-3, 2], [-6, 5], [-8, 8], 8), 4.4, 3, crest), E(-8.6, 8.8, 3, 3.4, down(crest, 0.3)));
      break;
    }
    case 'giraffe': {
      // ---- A LONG NARROW HEAD ON TOP OF A LONG NECK.  The neck rises from
      // the front of the shoulders and the head sits across the top of it,
      // pointing forward -- not a face stood on a pole.  Two ossicones, ears
      // out to the side, a long pale snout, and patches all the way up.
      skullW = 9;
      skullH = 6.6;
      const neck = bez([1, torsoTop + 6], [2, torsoTop - 6], [HX - 3, HY + 10], [HX - 1.5, HY + 2.5], 16);
      headBack.push(tube(neck, 6.4, 4.4, skin));
      for (let i = 3; i < neck.length - 2; i += 3) headBack.push(E(neck[i][0] + 0.6, neck[i][1], 2.6, 2, crest, 0.9));
      for (let i = 2; i < neck.length - 1; i += 2) headBack.push(R(neck[i][0] - 2.8, neck[i][1], 1.4, 1.8, dark, -20));
      headBack.push(E(HX - 3.8, HY - 2.4, 4.4, 1.8, skin).setAngle(-22));
      headBack.push(R(HX - 1.5, HY - 5.2, 1.4, 4.4, skin), C(HX - 1.5, HY - 7.6, 1.1, dark));
      headBack.push(R(HX + 0.8, HY - 5.4, 1.4, 4.6, down(skin, 0.15)), C(HX + 0.8, HY - 7.9, 1.1, dark));
      face.push(E(HX + 6, HY + 2, 9.4, 4.6, light).setStrokeStyle(1, outline));
      face.push(C(HX + 9.6, HY + 1.2, 0.6, dark), R(HX + 8, HY + 3.6, 3.6, 0.6, dark));
      face.push(C(HX + 1.4, HY - 1, 1.3, 0x1a1208), C(HX + 1, HY - 1.4, 0.4, 0xffffff), R(HX + 1.6, HY - 2.5, 2.6, 0.6, dark, -10));
      face.push(E(HX - 1.5, HY + 1, 2.4, 1.8, crest, 0.8));
      body.push(...spots(8, crest, 1.8, 2.8, 0.9));
      tailBits.push(tube(bez([0, 0], [-2.6, 4], [-3.6, 8], [-4, 12], 8), 1.4, 1, skin), E(-4, 13.4, 2.2, 3.4, dark));
      break;
    }
    case 'lion': {
      // ---- A FELINE FACE IN A GREAT MANE.  The mane rings the head and
      // runs down onto the chest; broad whisker pads, a strong chin, a dark
      // nose, amber eyes under a hard brow, and small round ears on top.
      skullW = 11;
      skullH = 10;
      neckTo(9, 8, skin);
      headBack.push(E(HX - 1, HY + 1, 20, 19, crest));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        headBack.push(E(HX - 1 + Math.cos(a) * 9, HY + 1 + Math.sin(a) * 8.6, 7, 6.4, i % 2 ? crest : down(crest, 0.18)));
      }
      headBack.push(E(HX - 1, HY + 10, 12, 8, crest));
      headBack.push(E(HX - 2.8, HY - 6.8, 3, 3, skin), E(HX + 1.6, HY - 7.2, 3, 3, skin), C(HX - 2.8, HY - 6.8, 0.8, dark), C(HX + 1.6, HY - 7.2, 0.8, dark));
      face.push(E(HX + 2.6, HY + 2.4, 4.4, 3.2, light), E(HX + 4.8, HY + 2.2, 4.6, 3.4, light));
      face.push(E(HX + 5.2, HY + 0.2, 3.2, 2.2, 0x6a3322));
      face.push(E(HX + 3.8, HY + 4.8, 5, 2.6, light).setStrokeStyle(1, outline));
      face.push(E(HX + 2.4, HY - 2.3, 2.6, 1.8, 0xe8a630), R(HX + 2.6, HY - 2.3, 0.7, 1.6, PALETTE.black));
      face.push(R(HX + 2.4, HY - 3.6, 4, 1, dark, 15));
      for (const y of [1.6, 2.8]) face.push(C(HX + 3.4, HY + y, 0.3, dark), C(HX + 5.4, HY + y + 0.2, 0.3, dark));
      body.push(E(-1, torsoTop + 3, torsoW * 0.9, 7, up(skin, 0.12), 0.7));
      body.push(E(3, torsoCY + 1, torsoW * 0.4, torsoH * 0.55, light, 0.5));
      // long and thin, with the dark tuft on the end
      const path = bez([0, 0], [-7, 6], [-15, 5], [-18, -2], 14);
      tailBits.push(tube(path, 2.2, 1.4, skin), E(path[path.length - 1][0], path[path.length - 1][1] - 1, 3.4, 4, crest));
      break;
    }
    case 'wolf': {
      // ---- A LONG CANINE MUZZLE UNDER TALL POINTED EARS, pale cheeks, a
      // ruff at the throat, slanted yellow eyes -- and a heavy brush of a tail.
      skullW = 11;
      skullH = 9;
      neckTo(7, 6, skin);
      headBack.push(T(HX - 0.4, HY - 3, HX + 2.6, HY - 3.2, HX + 1.2, HY - 10.6, dark));
      headBack.push(T(HX - 4.2, HY - 2.6, HX - 0.8, HY - 3.2, HX - 2.8, HY - 10.4, skin), T(HX - 3.4, HY - 3.2, HX - 1.6, HY - 3.4, HX - 2.7, HY - 8.4, 0x4a3a3a));
      headBack.push(E(HX - 1.6, HY + 4, 9.4, 6.4, light));
      for (let i = 0; i < 4; i++) headBack.push(T(HX - 5 + i * 2.4, HY + 6, HX - 3.4 + i * 2.4, HY + 6, HX - 4.4 + i * 2.4, HY + 8.6, light));
      face.push(E(HX + 6.5, HY + 1.6, 10, 4.4, light), E(HX + 6, HY + 0.4, 9, 2.4, skin));
      face.push(C(HX + 11.2, HY + 0.8, 1.3, 0x14161a), R(HX + 7.4, HY + 3.4, 6, 0.7, dark));
      face.push(E(HX + 2.8, HY - 1.6, 2.8, 1.6, crest).setAngle(-14), C(HX + 3, HY - 1.6, 0.6, PALETTE.black));
      face.push(R(HX + 2.4, HY - 2.9, 3.6, 0.8, dark, -14), E(HX + 1, HY - 3.6, 3, 1.4, light, 0.6));
      body.push(E(3, torsoTop + 4, torsoW * 0.62, 8, light, 0.85));
      for (let i = 0; i < 3; i++) body.push(T(-1 + i * 3, torsoTop + 7, 1 + i * 3, torsoTop + 7, i * 3, torsoTop + 10.4, light));
      body.push(E(-4, torsoCY, torsoW * 0.36, torsoH * 0.6, dark, 0.3));
      // a heavy brush, pale-tipped, dark along the top
      const path = bez([0, 0], [-5, 4], [-11, 8], [-14, 13], 12);
      tailBits.push(tube(path, 6, 3, skin), tube(path.slice(8), 4, 2.4, light), tube(path.slice(0, 7), 2, 1, dark));
      break;
    }
    case 'lizard':
      break;
  }
  const tail = tailBits.length ? scene.add.container(c.hipX, c.hipY, tailBits) : null;
  return { headBack, face, body, tail, skullW, skullH, skullCol };
}

export function buildFighter(scene: Phaser.Scene, f: Fighter): FighterArt {
  const frog = f.who === 'frog';
  // Froggy is green.  The lizard is NOT a second green animal: it is rust and
  // sand, which is the other half of telling them apart at a glance -- shape
  // does the work up close, colour does it across the room.
  //
  // And each ARCHETYPE is built differently on top of that: a muscular one is
  // broad, a reach one is tall and narrow, an assassin is lean and purple.
  // `wide` and `tall` scale the body and the head, so the silhouette says
  // which lizard it is before it has swung at anything.
  const bld = f.type?.build;
  const wide = bld?.wide ?? 1;
  const tall = bld?.tall ?? 1;
  const limb = bld?.limb ?? 1;
  const skull = bld?.head ?? 1;
  // Which animal, and the shape of it.  Froggy is not on the table.
  const animal: Animal | null = frog ? null : bld?.animal ?? 'lizard';
  const anat = animal ? ANATOMY[animal] : null;
  // A mammal gets its whole head from `dressAnimal`; the lizard keeps the
  // reptile head this function has always built.
  const beast = animal !== null && animal !== 'lizard';
  // Longer legs raise everything above them, or a leggy lizard grows its legs
  // up through its own chest.
  const lift = 11 * (limb - 1);
  const skin = frog ? PALETTE.moss : bld?.skin ?? 0x9c5a2e;
  const light = frog ? PALETTE.mossLight : bld?.light ?? 0xc98243;
  const dark = frog ? 0x2f5a2a : bld?.dark ?? 0x5e3218;
  const H = f.kit.head.mat!;
  const B = f.kit.body.mat!;
  const L = f.kit.legs.mat!;
  const wears = (m: ArmourMat): boolean => m.key !== 'none';

  // ---- ONE LIGHT, FROM ABOVE AND IN FRONT.
  //
  // Every flat shape in here was its own colour and nothing else, which is
  // why the fighters read as cut paper: a body is only a silhouette until
  // something tells you which way is up.  There is a single light now, and
  // the rule for the whole rig is the same three bands -- lit along the top,
  // the body colour through the middle, and the shaded underside -- with the
  // metal picking up a hard specular the skin does not get.
  const mix = (a: number, b: number, k: number): number => {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k);
  };
  const LIT = 0xfff3d2;
  const SHADE = 0x1a1208;
  /** Lighter, as if the light above were catching it. */
  const up = (c: number, k = 0.3): number => mix(c, LIT, k);
  /** Darker, for an underside or a crease. */
  const down = (c: number, k = 0.3): number => mix(c, SHADE, k);
  /** How much a material shines.  Cloth does not; plate does. */
  const gloss = (m: ArmourMat): number =>
    m.key.includes('plate') || m.key === 'gold' || m.key === 'steel' ? 0.55
      : m.key === 'chain' || m.key === 'tin' || m.key === 'iron' ? 0.34 : 0.12;
  // ---- THE SHADING, IN THREE LAYERS.
  //
  // One list would have been simpler and wrong: a highlight has to sit
  // directly on the thing it lights and under whatever covers that thing.
  // Collected in one pile, the chest shading drew over the head and the
  // helm's shine drew underneath the helm.
  const legDetail: Phaser.GameObjects.GameObject[] = [];
  const bodyDetail: Phaser.GameObjects.GameObject[] = [];
  /** Shading that belongs ON the armour, so it has to be drawn after it. */
  const armourDetail: Phaser.GameObjects.GameObject[] = [];
  const headDetail: Phaser.GameObjects.GameObject[] = [];
  const helmDetail: Phaser.GameObjects.GameObject[] = [];

  // ---- THE SHADOW.  One soft ellipse on the sand, and the single cheapest
  // thing that stops a sprite looking pasted onto the background.
  const shadow = scene.add.ellipse(0, 1, 26, 6, 0x6b5330).setAlpha(0.34);

  // ---- LEGS
  const legL = scene.add.rectangle(-4 * wide, -2, 4 * wide, 11 * limb, dark).setOrigin(0.5, 1);
  const legR = scene.add.rectangle(4 * wide, -2, 4 * wide, 11 * limb, skin).setOrigin(0.5, 1);
  const greaveL = scene.add.rectangle(-4 * wide, -3, 6 * wide, 8 * limb, L.colour).setOrigin(0.5, 1).setStrokeStyle(1, L.edge).setVisible(wears(L));
  const greaveR = scene.add.rectangle(4 * wide, -3, 6 * wide, 8 * limb, L.colour).setOrigin(0.5, 1).setStrokeStyle(1, L.edge).setVisible(wears(L));
  const kneeL = scene.add.rectangle(-4 * wide, -9 * limb, 7 * wide, 2, L.edge).setVisible(wears(L));
  const kneeR = scene.add.rectangle(4 * wide, -9 * limb, 7 * wide, 2, L.edge).setVisible(wears(L));
  // frogs get broad flat feet, lizards get clawed ones
  // Feet by anatomy: a frog's broad flat ones, a lizard's clawed ones, paws,
  // hooves, or a gorilla's great flat soles.
  const feet = anat?.feet ?? 'claw';
  const footW = frog ? 8 * wide : feet === 'hoof' ? 4.6 * wide : feet === 'flat' ? 8 * wide : feet === 'paw' ? 6.4 * wide : 7 * wide;
  const footH = feet === 'hoof' || feet === 'flat' ? 2.6 : 2;
  const footCol = frog ? light : feet === 'hoof' ? 0x2c2622 : feet === 'flat' ? down(skin, 0.3) : feet === 'paw' ? mix(light, skin, 0.35) : light;
  const footL = scene.add.rectangle(-5 * wide, 0, footW, footH, footCol).setOrigin(0.5, 1);
  const footR = scene.add.rectangle(5 * wide, 0, footW, footH, footCol).setOrigin(0.5, 1);
  // a lit edge down the front of each shin, and the dark where foot meets sand
  legDetail.push(scene.add.rectangle(-2.6 * wide, -2, 1, 11 * limb, up(dark, 0.22)).setOrigin(0.5, 1));
  legDetail.push(scene.add.rectangle(5.4 * wide, -2, 1, 11 * limb, up(skin, 0.3)).setOrigin(0.5, 1));
  legDetail.push(scene.add.rectangle(-5 * wide, 0, footW, 1, down(footCol, 0.45)).setOrigin(0.5, 1).setAlpha(0.6));
  legDetail.push(scene.add.rectangle(5 * wide, 0, footW, 1, down(footCol, 0.45)).setOrigin(0.5, 1).setAlpha(0.6));
  const clawL = animal === 'lizard' ? scene.add.triangle(-9, -1, 0, 2, 4, 0, 4, 3, PALETTE.bone) : null;
  const clawR = animal === 'lizard' ? scene.add.triangle(9, -1, 0, 0, 4, 2, 0, 3, PALETTE.bone) : null;
  // claws at the toes of a paw, a split and a toenail on a hoof
  for (const sx of [-5, 5]) {
    const fx = sx * wide + footW / 2;
    if (feet === 'paw' && anat?.claws) {
      legDetail.push(scene.add.rectangle(fx + 0.4, -0.6, 1.2, 0.8, PALETTE.bone), scene.add.rectangle(fx - 1.4, -0.6, 1.2, 0.8, PALETTE.bone));
    } else if (feet === 'hoof') {
      legDetail.push(scene.add.rectangle(sx * wide, -1.2, 0.8, 2.4, 0x14100c));
    } else if (feet === 'flat') {
      for (let k = 0; k < 3; k++) legDetail.push(scene.add.rectangle(fx - 1 - k * 2.2, -0.8, 1.6, 1.2, down(skin, 0.45)));
    }
  }

  // ---- THE TAIL, which is half of what says LIZARD.
  //
  // It was one long triangle, and at this size a single triangle is a traffic
  // cone rather than a tail.  Three tapering segments with a lit top edge
  // read as something that bends and has weight, and they let the tail droop
  // the way a heavy one would.
  //
  // THREE ROTATED TRIANGLES DID NOT WORK.  Each one turns about its own
  // centre, so the tips swing apart and the tail arrives as a cone with a
  // loose shard floating behind it.  One polygon has no seams to come apart:
  // it leaves the hip at full width and curves down to a point, and a second
  // thinner one along the top edge catches the light.
  //
  // A TAIL THAT TAPERS INSTEAD OF A PLANK THAT ENDS.
  //
  // The first polygon ran nearly straight for twenty-five pixels and stopped,
  // which at this size is a plank: the eye reads the two long parallel edges
  // and calls it a cone.  A tail is thick where it leaves the hip, thins
  // FAST over the first third, and then carries a long fine whip that curls
  // -- so the width is sampled off a curve rather than stepped linearly, and
  // the centre line drops away instead of running flat.
  const tailY = -16 * tall - lift * 0.6;
  const LEN = 27;
  const curve = (w: number, t: number, thin: number): number[] => {
    const top: number[] = [];
    const bot: number[] = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      const x = -u * LEN * w;
      // the centre line: level at the hip, then falling away and curling up
      const y = (u * u * 14 - Math.sin(u * Math.PI) * 2.5) * t;
      // and the thickness, which is most of the tail's character
      const half = (1 - u) ** 1.7 * 5.4 * t * thin + 0.5;
      top.push(x, y - half);
      bot.unshift(x, y + half);
    }
    return [...top, ...bot];
  };
  const tail = beast || frog ? null : scene.add.polygon(0, tailY, curve(wide, tall, 1), skin).setOrigin(0, 0);
  // the lit top edge, and the row of plates along the underside
  const tailTip = beast || frog ? null
    : scene.add.polygon(0, tailY - 0.8, curve(wide, tall, 0.55), up(skin, 0.3)).setOrigin(0, 0).setAlpha(0.8);
  const tailEnd = beast || frog ? null
    : scene.add.polygon(0, tailY + 1.6, curve(wide * 0.98, tall, 0.34), down(skin, 0.34)).setOrigin(0, 0).setAlpha(0.6);

  // ---- TORSO
  // ---- AND AN EDGE ROUND THE BIG SHAPES.
  //
  // A pixel sprite on a sandy floor in a sandy arena is mostly the same value
  // as the thing behind it.  A dark line round the torso and the skull is the
  // single cheapest way to lift the whole animal off the background, and it
  // is why these read as drawn rather than as coloured-in.
  const OUTLINE = down(skin, 0.62);
  const torso = frog
    ? scene.add.ellipse(0, -19, 19, 20, skin).setStrokeStyle(1, OUTLINE)
    : scene.add.ellipse(-1, -19 * tall - lift, 15 * wide, 19 * tall, skin).setStrokeStyle(1, OUTLINE);
  const belly = scene.add.ellipse(1, -16 * tall - lift, (frog ? 12 : 9) * wide, 11 * tall, light).setAlpha(0.55);
  // ---- THE BODY, LIT.  A band of light across the shoulders, a shadow
  // under the gut, and the creases where the limbs and the head join it.
  const ty0 = -19 * (frog ? 1 : tall) - (frog ? 0 : lift);
  bodyDetail.push(scene.add.ellipse(0, ty0 - (frog ? 6 : 6 * tall), (frog ? 15 : 12) * wide, 5, up(skin, 0.34)).setAlpha(0.75));
  bodyDetail.push(scene.add.ellipse(0, ty0 + (frog ? 7 : 7 * tall), (frog ? 16 : 12) * wide, 4, down(skin, 0.42)).setAlpha(0.6));
  bodyDetail.push(scene.add.ellipse(0, ty0 - (frog ? 9 : 9 * tall), (frog ? 9 : 7) * wide, 2, up(skin, 0.5)).setAlpha(0.5));
  // ---- AND THE SKIN ITSELF.  Frogs are speckled, lizards are scaled: a
  // handful of marks laid out from the build's own numbers, so a muscular
  // lizard is not a standard one with a bigger box round it.
  if (frog) {
    // ---- FROGGY.  He is the one the player is, so he gets the most work.
    //
    // A pale throat and chest running up under the chin, the darker dappling
    // a frog's back actually has laid over the shoulders rather than sprayed
    // evenly over him, and a wet highlight on the crown.  The pale front is
    // the important one: it gives him a light side and a dark side, which is
    // what he was missing when he read as a green oval.
    bodyDetail.push(scene.add.ellipse(4, ty0 + 2, 11, 15, up(light, 0.34)).setAlpha(0.62));
    bodyDetail.push(scene.add.ellipse(4, ty0 + 8, 9, 4, up(light, 0.5)).setAlpha(0.4));
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (0.62 + i * 0.16);
      bodyDetail.push(scene.add.circle(Math.cos(a) * 7.4, ty0 + Math.sin(a) * 7 - 2, i % 2 ? 1.6 : 1.1, down(skin, 0.34)).setAlpha(0.5));
    }
    bodyDetail.push(scene.add.ellipse(-1, ty0 - 8, 7, 2.4, up(skin, 0.48)).setAlpha(0.55));
  } else if (!beast) {
    // ---- THE BELLY PLATES, not stripes of dirt.
    //
    // Four flat bands across the middle of the body read as mud at this size.
    // A reptile's underside is a stack of short scutes running ACROSS it,
    // lighter than the back and edged underneath, which is both what the
    // animal looks like and a shape the eye can pick out from two feet away.
    for (let i = 0; i < 5; i++) {
      const w = (8 - Math.abs(i - 2) * 1.3) * wide;
      const y = ty0 - 5 * tall + i * 3.4 * tall;
      bodyDetail.push(scene.add.rectangle(2.5 * wide, y, w, 2.2 * tall, up(light, 0.3)).setAlpha(0.5));
      bodyDetail.push(scene.add.rectangle(2.5 * wide, y + 1.4 * tall, w, 0.8, down(skin, 0.35)).setAlpha(0.45));
    }
    // and a couple of scale rows over the shoulder, where the light hits
    for (let i = 0; i < 3; i++) {
      bodyDetail.push(scene.add.rectangle(-5 * wide, ty0 - (7 - i * 2.4) * tall, (5 - i) * wide, 1, up(skin, 0.36)).setAlpha(0.5));
    }
  }
  // The armour takes the same build as the body under it.  Scaling only the
  // torso left a muscular lizard's chest sticking out past a standard-issue
  // breastplate, which reads as a bug rather than as a bigger animal.
  const cuirass = scene.add.rectangle(0, -19 * tall - lift, (frog ? 17 : 15) * wide, 15 * tall, B.colour).setStrokeStyle(1, B.edge).setVisible(wears(B));
  // ---- THE SHOULDER PLATES ARE WORN ON THE ARMS, not parked beside them.
  //
  // These used to be two ellipses pinned at a fixed spot on the torso and
  // pushed into `parts` as SIBLINGS of `arm.root`.  The arm swings -- through
  // a wind-up, a strike, a guard, a throw, every one of which turns the
  // shoulder -- and the plate that is supposed to be strapped to it stayed
  // exactly where it was, square to the camera, while the limb rotated out
  // from under it.  That is the whole of why the armour looked stuck on the
  // screen rather than worn by the animal.
  //
  // They are built here, with the rest of the body armour, so they keep the
  // material's colour and the `wears` test -- and then handed to the arms
  // below, which is where they are actually attached.  Same for Froggy and
  // for a lizard: both are built by this function.
  const pauldL = scene.add.ellipse(0.6, -2.2, 8 * wide, 6, B.colour).setStrokeStyle(1, B.edge).setVisible(wears(B));
  const pauldR = scene.add.ellipse(0.6, -2.2, 8 * wide, 6, B.colour).setStrokeStyle(1, B.edge).setVisible(wears(B));
  const belt = scene.add.rectangle(0, -12 * tall - lift, (frog ? 18 : 16) * wide, 3, B.edge).setVisible(wears(B));
  const ridge = scene.add.rectangle(0, -20 * tall - lift, (frog ? 15 : 13) * wide, 1, B.edge).setAlpha(0.7).setVisible(wears(B));
  // ---- WHAT THE ARMOUR IS MADE OF, and not only what colour it is.
  //
  // A breastplate and a tunic were the same flat rectangle in two colours.
  // Plate takes a hard highlight along the top and a dark underside, chain a
  // softer one, cloth almost none -- so the crowd can tell steel from linen
  // at a glance and a good suit LOOKS like a good suit.
  const g = gloss(B);
  const cuirassLit = scene.add.rectangle(0, -24 * tall - lift, (frog ? 14 : 12) * wide, 2, up(B.colour, 0.3 + g))
    .setAlpha(0.35 + g * 0.8).setVisible(wears(B));
  const cuirassLow = scene.add.rectangle(0, -13.5 * tall - lift, (frog ? 16 : 14) * wide, 2, down(B.colour, 0.45))
    .setAlpha(0.55).setVisible(wears(B));
  armourDetail.push(cuirassLit, cuirassLow);
  // THE BAR DOWN THE FRONT OF THE CHEST IS GONE.  It was meant to be a sheen
  // on polished plate, but a two pixel upright rectangle tilted eight degrees
  // in the middle of a breastplate does not read as light on steel -- it
  // reads as a loose piece of something floating in front of the fighter,
  // which is exactly what it was reported as.  The top and bottom banding
  // above already says hard metal without putting a shape on the chest.

  // ---- THE CREST, the other half of LIZARD
  // Six spines rather than four, biggest at the shoulders and tapering down
  // the back, each with a lit front edge.  It is the one piece of the animal
  // that is allowed to be a bright colour, so it carries the character.
  const spines: Phaser.GameObjects.Triangle[] = [];
  if (!frog && !beast) {
    const crest = bld?.crest ?? PALETTE.rust;
    // Five, biggest over the shoulder and tapering to the hip -- and they
    // STOP at the hip.  Run on down the tail they read as flames coming out
    // of the animal sideways rather than as a ridge along its back.
    for (let i = 0; i < 7; i++) {
      const k = 1 - Math.abs(i - 1.5) / 6;
      const h = (2.4 + k * 3.6) * tall;
      // Along the top of the body and only then down to the hip.  Stepping
      // down nearly three pixels a spine put the whole ridge on the tail.
      const x = -1.5 - i * 2.2 * wide;
      const y = (-29.5 + i * 1.7) * tall - lift;
      spines.push(scene.add.triangle(x, y, 0, h, 2.2 * wide + k * 1.4, 0, 4.4 * wide, h, crest).setAngle(-6 - i * 4));
      spines.push(scene.add.triangle(x + 0.7, y, 0, h, 1, 0, 1.8, h, up(crest, 0.45)).setAngle(-6 - i * 4));
    }
  }

  // ---- WHERE THE HEAD IS.  The lizard's sits where it always has; every
  // other animal's is carried out along its own neck -- forward and low for
  // the heavy ones, up at the top of a long neck for the giraffe.
  const HX = frog ? 2 : 1 + (anat?.fwd ?? 0);
  const HY = frog ? -33 : -32.6 * tall - lift - (anat?.neck ?? 0) + (anat?.drop ?? 0);
  const torsoCY = -19 * tall - lift;
  const beastParts = beast
    ? dressAnimal(scene, animal!, {
      HX, HY, skin, light, dark, crest: bld?.crest ?? dark, outline: OUTLINE,
      torsoCY, torsoTop: torsoCY - 9.5 * tall, torsoW: 15 * wide, torsoH: 19 * tall,
      hipX: -1 - 7.5 * wide + 3, hipY: torsoCY + 4 * tall, up, down,
    })
    : null;
  if (beastParts) bodyDetail.push(...beastParts.body);

  // ---- HEAD
  // ---- THE SKULL DOES NOT GROW WITH THE CHEST.
  //
  // At the full body width a muscular lizard's head came out very nearly as
  // wide as its torso, sat straight on top of it in the same value, and the
  // two read as one brown lump with eyes -- the "potato" the heavy builds
  // kept turning into.  The skull now widens at half the rate the body does,
  // rides a little higher, and is mixed up toward the light, so there is a
  // neck between the two and the head is the brighter of them.
  const skullW = 13 * (1 + (wide - 1) * 0.48) * skull;
  const headTone = frog ? light : up(light, 0.16);
  // And a neck to stand it on.  Lifted clear of the chest without one, the
  // head simply floated: a separated head is worse than a merged one.
  const neck = frog ? null
    : scene.add.ellipse(0, -28.5 * tall - lift, skullW * 0.55, 7 * tall, down(light, 0.1));
  const head = frog
    ? scene.add.ellipse(2, -33, 16, 13, light).setStrokeStyle(1, OUTLINE)
    : scene.add.ellipse(1, -32.6 * tall - lift, skullW, 10 * skull, headTone).setStrokeStyle(1, OUTLINE);
  const jaw = frog
    ? scene.add.ellipse(7, -30, 6, 4, light)
    : scene.add.triangle(skullW * 0.9, -30.4 * tall - lift, 0, 0, 11 * skull, 3, 0, 6 * skull, headTone);
  const teeth = frog ? null : scene.add.rectangle(skullW * 0.84, -29.4 * tall - lift, 7 * skull, 1, PALETTE.cream);
  // A wider mouth with a turned-up corner, and the shine on the dome above it
  const mouth = frog ? scene.add.rectangle(5, -29, 10, 1.2, down(dark, 0.2)) : null;
  const smile = frog ? scene.add.rectangle(10, -29.8, 2, 1.2, down(dark, 0.2)).setAngle(-34) : null;
  const cheek = frog ? scene.add.ellipse(9, -31, 4, 2.6, mix(light, 0xff9a8a, 0.35)).setAlpha(0.38) : null;
  // a frog's eyes sit on top of the dome; a lizard's are set into the side
  const ey = frog ? -38 : -34.6 * tall - lift;
  const eyeL = scene.add.circle(-1, ey, (frog ? 3.4 : 2.6) * skull, PALETTE.cream);
  const eyeR = scene.add.circle(5, ey, (frog ? 3.4 : 2.6) * skull, PALETTE.cream);
  const pupL = frog
    ? scene.add.circle(0, -38, 1.5, PALETTE.black)
    : scene.add.rectangle(0, ey, 1.2, 4 * skull, PALETTE.black);
  const pupR = frog
    ? scene.add.circle(6, -38, 1.5, PALETTE.black)
    : scene.add.rectangle(6, ey, 1.2, 4 * skull, PALETTE.black);
  const brow = frog ? null : scene.add.rectangle(2, ey - 3 * skull, skullW * 0.9, 2, dark);
  // ---- THE HEAD, LIT, and the small things that make a face a face.
  //
  // The dome takes the light first because it is the highest thing on the
  // animal; underneath it is the shadow it casts on its own jaw, and where
  // the skull sits down onto the shoulders.  Plus a nostril, and a catchlight
  // in each eye -- two pixels that do more for a face than anything else here.
  const hy0 = frog ? -33 : -32.6 * tall - lift;
  const hw = frog ? 16 : skullW;
  headDetail.push(scene.add.ellipse(2, hy0 - (frog ? 4 : 3 * skull), hw * 0.72, 3, up(light, 0.42)).setAlpha(0.8));
  headDetail.push(scene.add.ellipse(2, hy0 + (frog ? 5 : 4 * skull), hw * 0.8, 2.5, down(light, 0.38)).setAlpha(0.55));
  // The shadow the skull casts onto the chest.  Without it the head and the
  // body are one lump, which is most of why the heavier builds read as a
  // potato with eyes.
  bodyDetail.push(scene.add.ellipse(1, hy0 + (frog ? 8 : 6.5 * skull), hw * 0.82, 3.4, down(skin, 0.55)).setAlpha(0.5));
  headDetail.push(scene.add.ellipse(0, hy0 + (frog ? 7 : 5.4 * skull), hw * 0.62, 1.8, down(light, 0.42)).setAlpha(0.42));
  headDetail.push(scene.add.circle(frog ? 9 : skullW * 0.86, hy0 + 1, 0.8, down(skin, 0.55)).setAlpha(0.7));
  const catchL = scene.add.circle(frog ? -1.8 : -0.8, ey - 1.2, 0.8, 0xffffff).setAlpha(0.85);
  const catchR = scene.add.circle(frog ? 4.2 : 5.2, ey - 1.2, 0.8, 0xffffff).setAlpha(0.85);
  // ---- A MAMMAL'S HEAD IS ITS OWN.  The reptile face above is put away and
  // the skull is reshaped and recoloured to the animal's; the face itself
  // comes from `dressAnimal`.
  if (beastParts) {
    for (const o of [jaw, teeth, brow, eyeL, eyeR, pupL, pupR, catchL, catchR, neck, ...headDetail] as Array<Phaser.GameObjects.Components.Visible | null>) o?.setVisible(false);
    head.setSize(beastParts.skullW * skull, beastParts.skullH * skull).setPosition(HX, HY).setFillStyle(beastParts.skullCol);
  }

  // ---- HELM: a bowl, a brow band, a visor slit, and a plume for the frog
  // A helm caps the skull.  At -40 it came down over the eyes and both of
  // them fought the whole bout blindfolded in a grey box.
  const hy = frog ? -43 * tall : beastParts ? HY - (beastParts.skullH * skull) / 2 - 1.4 : -39 * tall - lift;
  const hx = frog ? 2 : HX + 1;
  const helmW = frog ? 17 : beastParts ? Math.min(14 * wide, beastParts.skullW * skull + 4) : 14 * wide;
  // ---- A CROWN IS A CROWN.  It was drawn as a gold helmet -- the same bowl,
  // visor and plume as every other helm -- which is the one thing a crown
  // must not look like.  It is a band that sits on top of the head, points
  // round the rim with a pearl on each, and stones set into the band.
  const crowned = H.key === 'crown';
  const helmOn = wears(H) && !crowned;
  const helm = scene.add.rectangle(hx, hy, helmW, 6, H.colour).setStrokeStyle(1, H.edge).setVisible(helmOn);
  const helmDome = scene.add.ellipse(hx, hy - 2, helmW, 7, H.colour).setVisible(helmOn);
  const visor = scene.add.rectangle(hx + 2, hy + 2, helmW * 0.72, 1.5, H.edge).setVisible(helmOn);
  const plume = scene.add.rectangle(hx - 6, hy - 7, 3, 8, frog ? PALETTE.blood : PALETTE.rust).setVisible(helmOn);
  // the helm shines by the same rule the breastplate does
  const hg = gloss(H);
  if (!crowned) {
    helmDetail.push(scene.add.rectangle(hx, hy - 4, helmW * 0.72, 1.5, up(H.colour, 0.3 + hg))
      .setAlpha(0.35 + hg * 0.8).setVisible(wears(H)));
    helmDetail.push(scene.add.rectangle(hx, hy + 3, helmW * 0.88, 1.5, down(H.colour, 0.4))
      .setAlpha(0.5).setVisible(wears(H)));
  }
  // Sat down onto the top of the skull, a little narrower than it.
  const crown = scene.add.container(hx, hy + (frog ? 4 : 3)).setVisible(crowned);
  if (crowned) {
    const cw = frog ? 13 * wide : Math.min(11 * wide, helmW - 3);
    const gold = H.colour;
    const rim = H.edge;
    // the points first, so the band covers their feet
    const points = 5;
    for (let i = 0; i < points; i++) {
      const px = -cw / 2 + 1 + (i * (cw - 2)) / (points - 1);
      const tall2 = i % 2 === 0 ? 5.5 : 4;
      crown.add(scene.add.triangle(px, -1.5 - tall2 / 2, 0, tall2, 1.9, 0, 3.8, tall2, gold).setStrokeStyle(0.6, rim));
      crown.add(scene.add.circle(px, -2 - tall2, 1, 0xfff4d0));
    }
    // the band, with its shading and a row of stones
    crown.add(scene.add.rectangle(0, 0, cw, 3.4, gold).setStrokeStyle(0.8, rim));
    crown.add(scene.add.rectangle(0, -1, cw - 1, 0.8, up(gold, 0.45)).setAlpha(0.8));
    crown.add(scene.add.rectangle(0, 1.3, cw - 1, 0.8, down(gold, 0.35)).setAlpha(0.8));
    crown.add(scene.add.circle(0, 0.1, 1.2, PALETTE.blood));
    crown.add(scene.add.circle(-cw / 2 + 2.2, 0.1, 0.9, 0x3f7fd6));
    crown.add(scene.add.circle(cw / 2 - 2.2, 0.1, 0.9, 0x3fb86a));
  }

  // ---- the arm and the weapon, on one hinge at the shoulder
  // ---- TWO ARMS, because one of them cannot hold a guard.
  //
  // The rig had a single arm, which is all a weapon needs and is useless the
  // moment the weapon is gone: a boxer with one arm is a man pointing.  The
  // OFF arm is built behind the torso and the weapon arm in front of it, so
  // armed they read as one arm and a body, and unarmed they come up as a
  // pair with the far one properly behind the near one.
  //
  // ---- AN ARM WITH AN ELBOW IN IT.
  //
  // It was one rectangle on one hinge: a straight tube that swung from the
  // shoulder, which is why a punch read as the whole limb pivoting and why
  // the hand looked stuck on even after it was rebuilt as a fist.  There are
  // two segments now -- upper arm from the shoulder, forearm from the elbow
  // -- so the joint can flex, and `poseFighter` drives the elbow separately
  // from the shoulder.  Everything below the elbow lives in `fore`, so
  // bending it carries the forearm, the wrist and the hand together.
  // ---- WHERE AN ARM STARTS.
  //
  // It started at +5 for the near arm and -2 for the far one, which is not a
  // pair of shoulders: it is one arm on the chest and one arm very nearly on
  // the breastbone, four pixels apart on a body nineteen wide.  And -24 sits
  // in the MIDDLE of a torso that runs from -29 to -9, so every punch left
  // from somewhere around the stomach.
  //
  // Both shoulders are the same distance out now, on opposite sides, and high
  // enough up the body to be shoulders: three pixels under the top of the
  // torso, on its upper corners, where the shoulder cap can overlap the chest
  // and the arm can look like it grew there.
  // MEASURED, not guessed.  Froggy's head runs from -26.5 to -39.5 and his
  // torso from -9 to -29, so the head hangs down over the top of the body and
  // "the upper torso" and "inside the skull" are very nearly the same place.
  // At -26 the shoulder sat level with the jaw and every raised arm ran up
  // across an eye.  -24 is the top third of the torso and two clear pixels
  // under the head, which is as high as a shoulder can go on this animal.
  const shoulderY = -24 * tall - lift;
  const shoulderX = 4.8 * wide;
  const buildArm = (behind: boolean): Arm => {
    const root = scene.add.container(behind ? -shoulderX : shoulderX, shoulderY);
    const tone = behind ? dark : skin;
    const limbTone = behind ? skin : light;
    // A giraffe's arms are longest of all, because that is its reach; a
    // gorilla's are long and end in enormous hands.
    const aL = anat?.arm ?? 1;
    const UPPER = 6 * aL;
    const FORE = 6.5 * aL;
    // the shoulder cap, which is what joins the arm to the body rather than
    // leaving it to start in mid-air beside it
    root.add(scene.add.ellipse(0.5, 0, 5.4 * wide, 5.6 * wide, tone));
    root.add(scene.add.ellipse(0.5, -1.2, 4.4 * wide, 2.4, up(tone, 0.3)).setAlpha(0.7));
    root.add(scene.add.rectangle(UPPER / 2, 0, UPPER, 4.2 * wide, tone));
    root.add(scene.add.rectangle(UPPER / 2, -1.2, UPPER, 1, limbTone).setAlpha(0.5));

    const fore = scene.add.container(UPPER, 0);
    root.add(fore);
    // the elbow itself: a joint you can see, so the bend has somewhere to be
    fore.add(scene.add.circle(0, 0, 2.5 * wide, down(tone, 0.18)));
    fore.add(scene.add.circle(-0.3, -0.7, 1.6 * wide, tone));
    fore.add(scene.add.rectangle(FORE / 2, 0, FORE, 3.8 * wide, tone));
    fore.add(scene.add.rectangle(FORE / 2, -1, FORE, 1, limbTone).setAlpha(0.5));

    const hw2 = 1 + (wide - 1) * 0.5;
    const hs = hw2 * (anat?.hand ?? 1);
    // where the wrist and the hand sit along the forearm
    const WR = FORE + 1.1;
    const HD = FORE + 3.8;
    // the hand hangs off the FOREARM now, so the elbow carries it
    const palm = (x: number, y: number, w: number, h: number, col: number, a = 1) =>
      fore.add(scene.add.rectangle(x, y * hs, w * hs, h * hs, col).setAlpha(a));
    palm(WR, 0.1, 2.2, 3.6, down(tone, 0.12));             // the wrist
    palm(HD, 0.2, 6.4, 6.4, dark);                         // the edge all round
    palm(HD, -0.1, 5.2, 5.2, limbTone);                    // the back of the hand
    palm(HD, -1.9, 5.2, 1.4, up(limbTone, 0.4), 0.85);
    for (let k = 0; k < 3; k++) palm(HD + 2.3 * hs, -1.6 + k * 1.6, 1.4, 1.3, up(limbTone, 0.22));
    palm(HD + 0.1, 2.2, 5, 1.5, down(limbTone, 0.4), 0.8);
    palm(HD + 1.3, 1.4, 1.6, 3, limbTone);                 // the thumb
    palm(HD + 1.3, 1.4, 1.6, 1, down(limbTone, 0.35), 0.7);
    // and claws on the knuckles of anything that has them
    if (anat?.claws) for (let k = 0; k < 3; k++) palm(HD + 3.5 * hs, -1.6 + k * 1.6, 1.2, 0.8, PALETTE.bone);
    return { root, fore, hand: HD };
  };
  const armOff = buildArm(true);
  const arm = buildArm(false);
  // Strapped on: inside the shoulder container, so every turn of the arm
  // carries the plate with it and the two can never come apart.  `root` is the
  // shoulder joint itself, so the plate sits just above and slightly along
  // the upper arm -- where a pauldron is buckled.
  armOff.root.add(pauldL);
  arm.root.add(pauldR);
  const weapon = buildWeapon(scene, f.weapon.key, light, f.single);
  // In the hand, which is inside the FOREARM -- so the elbow swings the
  // weapon the way a wrist and an elbow actually do, instead of the whole
  // limb pivoting rigidly from the shoulder.
  weapon.setPosition(arm.hand + 1, 0);
  arm.fore.add(weapon);

  const parts: Phaser.GameObjects.GameObject[] = [shadow];
  if (beastParts?.tail) parts.push(beastParts.tail);
  if (tailEnd) parts.push(tailEnd);
  if (tailTip) parts.push(tailTip);
  if (tail) parts.push(tail);
  parts.push(footL, footR);
  if (clawL) parts.push(clawL, clawR!);
  parts.push(legL, legR, ...legDetail, greaveL, greaveR, kneeL, kneeR);
  parts.push(...spines);
  parts.push(armOff.root);
  // The pauldrons are NOT in here: they live inside the two arm rigs now.
  parts.push(torso, belly, ...bodyDetail, cuirass, ridge, belt, ...armourDetail, arm.root);
  // ---- THE HEAD MOVES AS A HEAD.
  //
  // A duck used to be done by setting head.y and helm.y, which was already a
  // little wrong -- the eyes stayed behind -- and became plainly wrong once
  // the skull had a snout, a nostril, shading and catchlights to leave behind
  // as well.  Everything above the neck goes in one container and that is
  // what moves, so a dodge takes the whole face with it.
  const headGroup = scene.add.container(0, 0);
  const headBits: Phaser.GameObjects.GameObject[] = [...(beastParts?.headBack ?? []), head, jaw, ...headDetail, ...(beastParts?.face ?? [])];
  if (teeth) headBits.push(teeth);
  if (cheek) headBits.push(cheek);
  if (mouth) headBits.push(mouth);
  if (smile) headBits.push(smile);
  if (brow) headBits.push(brow);
  headBits.push(eyeL, eyeR, pupL, pupR, catchL, catchR);
  headBits.push(helmDome, helm, visor, ...helmDetail, plume, crown);
  headGroup.add(headBits);
  if (neck) parts.push(neck);
  parts.push(headGroup);
  const root = scene.add.container(f.x, FLOOR_Y, parts).setDepth(20);
  root.setScale(f.face * (bld?.scale ?? 1), bld?.scale ?? 1);
  return { root, legL, legR, greaveL, greaveR, kneeL, kneeR, footL, footR, torso, cuirass, belt, ridge,
    pauldL, pauldR, head, helm, helmDome, crown, visor, plume, headGroup, arm, armOff, guardUp: false, weapon, shadow,
    nicks: 0, tail: beastParts?.tail ?? null };
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
/**
 * HOW A WEAPON IS CARRIED WHEN NOBODY IS SWINGING IT.
 *
 * Every weapon idled at the same two angles, so a fighter holding a war
 * hammer and a fighter holding a blowgun stood in exactly the same way and
 * the only thing telling them apart was a sprite four pixels long.  How you
 * hold a thing is most of what says what it is.
 *
 * None of this is a new table: it is read off the numbers the weapon already
 * has, so every weapon in the rack gets a carry and any weapon added later
 * gets one too.  A polearm goes on the shoulder because it is long; a hammer
 * hangs point-down because it is heavy; a dagger comes in close because it is
 * quick; a bow drops across the body because it is drawn and not swung.
 *
 * `sway` is the breath, and it is the inverse of the heft: a knife bobs in
 * the hand, a great axe does not move.
 */
function carryOf(f: Fighter): { arm: number; elbow: number; sway: number } {
  const w = f.weapon;
  if (f.broken || w.key === 'none') return { arm: -10, elbow: -14, sway: 3.5 };
  const heft = (w.heavy[0] + w.heavy[1]) / 2;
  const span = (w.reach[0] + w.reach[1]) / 2;
  const sway = Math.max(1, 5 - heft * 0.45);
  const shot = w.spec.ranged?.shot;
  // ---- WHICH WAY THE SHAFT ENDS UP POINTING.
  //
  // The weapon hangs off the FOREARM and points along its +x, so what the
  // crowd sees is the SUM of the two angles, and the shoulder on its own
  // decides only where the hand is.  Reading the shoulder alone is how a
  // shouldered spear ended up standing straight up out of the helmet: -56 at
  // the shoulder and -36 more at the elbow is a shaft pointing at the sky.
  // So each of these is a pair - where the hand sits, and where the shaft
  // goes from there - and the sum is written next to it.
  //
  // Negative is up and back, positive is down toward the sand: a guard is
  // -96 and an overhead cleave finishes at +62.
  //
  // drawn, not swung: string hand down by the hip, stave across the body
  if (shot === 'arrow' || shot === 'bolt') return { arm: 40, elbow: -60, sway: sway * 0.6 };
  // a sling or a blowgun is barely carried at all
  if (shot === 'stone' || shot === 'dart') return { arm: 14, elbow: -44, sway };
  // something about to be thrown rides high, at the shoulder
  if (shot) return { arm: -40, elbow: -20, sway: sway * 0.8 };
  // ---- HEAVY BEFORE LONG, and that order is the whole of it: a great axe
  // is eight of reach as well as nine of heft, so asking about length first
  // shouldered it like a pike and stood it up through the top of his head.
  // Heavy enough that the head of it rests near the sand.
  if (heft >= 7) return { arm: 40, elbow: 5, sway: sway * 0.5 };
  // long, and light enough to shoulder: hand low, shaft up over the shoulder
  if (span >= 7) return { arm: 30, elbow: -65, sway: sway * 0.7 };
  // quick and short: in close, elbow shut, ready to go again
  if (w.tempo >= 1.35) return { arm: -6, elbow: -40, sway: sway * 1.2 };
  return { arm: -10, elbow: -14, sway };
}

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

/**
 * A WEAPON THAT HAS BEEN USED LOOKS USED.
 *
 * Durability was a number nobody could see: the first the crowd knew about a
 * blade being nearly gone was it snapping.  Two thirds worn puts a notch in
 * it, a third left puts three more and a rust streak along it, so a fighter
 * pressing on with something about to go is something you can watch happening
 * rather than something the log tells you afterwards.
 *
 * The marks are cut once each -- `nicks` counts what is already on the blade,
 * so this can be called every frame and only ever does work on the two frames
 * that matter.  A fresh weapon in the hand resets the count with the sprite.
 */
function wearWeapon(f: Fighter): void {
  const a = f.art;
  if (!a) return;
  if (f.broken || f.weapon.key === 'none' || !Number.isFinite(f.dur)) return;
  const full = durabilityOf(f.kit.weapon);
  if (!Number.isFinite(full) || full <= 0) return;
  const left = Math.max(0, f.dur) / full;
  const want = left <= 0.33 ? 4 : left <= 0.66 ? 1 : 0;
  if (want <= a.nicks) return;
  const sc = S();
  for (let i = a.nicks; i < want; i++) {
    const nick = sc.add.rectangle(5 + i * 4, i % 2 ? -1.5 : 1.5, 2, 1, 0x2b2419);
    a.weapon.add(nick);
  }
  if (want === 4 && a.nicks < 4) {
    // and the rust, which is the one that says it is nearly done
    a.weapon.add(sc.add.rectangle(9, 0, 12, 1, 0x7a3a1c).setAlpha(0.7));
  }
  a.nicks = want;
}

export function poseFighter(f: Fighter, other?: Fighter): void {
  const a = f.art;
  if (!a) return;
  a.root.x = drawX(f, other);
  // The archetype's build has to survive the per-frame facing flip, or a
  // muscular lizard shrinks back to standard size on the first tick.
  const bulk = f.type?.build.scale ?? 1;
  a.root.setScale(f.face * bulk, bulk);

  // ---- AND WHEN THE FIGHT IS OVER, THE RIG IS NOT THIS FUNCTION'S ANY MORE.
  //
  // The winner's arms going up and the loser folding into the sand are
  // tweens, and a tween is no match for something that reassigns the same
  // angle sixty times a second: every one of them was being overwritten on
  // the next frame.  Position still tracks, so the shove and the facing keep
  // working; every limb belongs to the tween from here.
  //
  // The shadow is the one exception, and it has to be: it lives inside the
  // root, so the loser rolling onto his back would roll his shadow up off
  // the sand with him.  It is put flat again here, exactly as it is on any
  // other frame.
  if (f.pose !== 'none') {
    const fall = FLOOR_Y - a.root.y;
    a.shadow.y = 1 + fall;
    a.shadow.setAngle(-a.root.angle);
    const kk = Phaser.Math.Clamp(1 - fall / 26, 0.45, 1.35);
    a.shadow.setScale(kk, kk).setAlpha(0.34 * kk);
    return;
  }

  // the walk: two legs out of phase, and the body riding on it
  const swingL = Math.sin(f.step / 5) * 3;
  a.legL.setAngle(swingL);
  a.legR.setAngle(-swingL);
  a.greaveL.setAngle(swingL);
  a.greaveR.setAngle(-swingL);
  a.root.y = FLOOR_Y - Math.abs(Math.sin(f.step / 5)) * 1.2;

  // the arm: back for the wind-up, through for the strike, drooping after
  // ---- THE ARC THE ARM ACTUALLY TRAVELS, WHICH IS THE MOVE.
  //
  // An overhead cleave comes from behind the head and finishes at the floor.
  // A thrust barely rotates at all and goes straight out.  A sweep travels
  // the whole width of the body.  A spin goes all the way round.  Same rig,
  // six different shapes, and they are the shapes the moves say they are --
  // so the player can watch and tell a hammer smash from a rapier lunge.
  const A: Record<Anim, { w: number; s: number; r: number; lean: number }> = {
    over:   { w: -104, s: 62, r: 34, lean: 10 },
    sweep:  { w: -58, s: 46, r: 20, lean: 6 },
    thrust: { w: -26, s: 8, r: -4, lean: 12 },
    spin:   { w: -150, s: 150, r: 40, lean: 0 },
    jab:    { w: -34, s: 20, r: 4, lean: 5 },
    bash:   { w: -46, s: 16, r: 6, lean: 16 },
    low:    { w: -70, s: 88, r: 56, lean: 14 },
    // a punch barely winds up and goes straight out from the guard
    punch:  { w: -62, s: 14, r: -40, lean: 9 },
    // ---- AND THE THREE THAT ARE NOT A STRAIGHT PUNCH.
    //
    // A hook comes round from outside the shoulder and finishes across the
    // body; an uppercut starts below the ribs and drives UP past the chin;
    // a shove barely rotates at all and pushes with the heel of both hands.
    // Three moves on the unarmed row were all drawn as the same jab, so the
    // only thing telling a body hook from a straight right was the caption.
    hook:   { w: -18, s: 52, r: -34, lean: 11 },
    upper:  { w: 44, s: -56, r: -38, lean: -9 },
    shove:  { w: -40, s: -4, r: -30, lean: 15 },
    // a kick is the legs' business; the hands stay up where they were
    kick:   { w: -58, s: -52, r: -50, lean: -8 },
    // drawing a bow pulls the hand back to the cheek and lets it go forward
    shoot:  { w: -50, s: -18, r: -34, lean: -6 },
    // ---- AND A THROW IS THE WHOLE BODY.
    //
    // It was -128 to 40 with ten of lean, which is a shoulder doing all of it.
    // The arm now goes further back and finishes further through, and the
    // lean is big enough that the torso is visibly rotating behind it -- the
    // rest of the body is handled where `hurl` is named in `poseFighter`:
    // weight shifts onto the back foot for the wind-up, drives onto the front
    // one through the strike, and the head goes with it.
    hurl:   { w: -146, s: 66, r: 6, lean: 26 },
    // ---- THE BLOWGUN, which is the one attack made with the face.
    //
    // The pipe comes UP to the mouth rather than back past the ear, so the
    // shoulder rises and the elbow shuts hard; nothing swings.  The recoil is
    // the head snapping back off the breath, which is the only part of a
    // blowgun anybody can see from across an arena.
    puff:   { w: -60, s: -66, r: -48, lean: -4 },
    // ---- THE SHIELD CHARGE.  The shield comes up across the chest for the
    // run and is driven straight out on contact; the lean is FORWARD the
    // whole way (see below), because nobody charges leaning back.
    charge: { w: 6, s: -8, r: -10, lean: 18 },
  };
  const shape = A[f.move?.anim ?? 'sweep'];
  const carry = carryOf(f);
  let arm = carry.arm;
  // ---- BENDING DOWN FOR IT.
  //
  // Reaching for something on the sand is the one pose where the arm goes
  // BELOW the shoulder and the whole animal folds over it, so it reads at a
  // glance as picking something up rather than as another swing.
  if (f.act === 'pickup') {
    const grab = Math.min(1, 1 - f.t * 2.2);
    a.arm.root.setAngle(42 + grab * 26);
    a.arm.fore.setAngle(-18 - grab * 26);
    a.armOff.root.setAngle(38);
    a.armOff.fore.setAngle(-30);
    a.torso.setAngle(f.face * 16);
    a.cuirass.setAngle(f.face * 16);
    a.headGroup.y = 5;
    a.headGroup.x = f.face * 3;
    a.legL.setAngle(-13); a.legR.setAngle(11);
    a.greaveL.setAngle(-13); a.greaveR.setAngle(11);
    a.root.y = FLOOR_Y + 2;
    a.shadow.setPosition(0, -1).setScale(1, 1).setAngle(0);
    return;
  }
  a.headGroup.x = 0;
  let lean = 0;
  if (f.act === 'windup') { arm = shape.w; lean = f.move?.anim === 'charge' ? shape.lean : -shape.lean * 0.55; }
  else if (f.act === 'strike') { arm = shape.s; lean = shape.lean; }
  else if (f.act === 'recover') { arm = shape.r; lean = shape.lean * 0.4; }
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
  a.arm.root.setAngle(f.armA);

  // ---- AND THE ELBOW, WHICH IS THE HALF THAT WAS MISSING.
  //
  // A straight tube swinging from the shoulder reads as a plank on a hinge.
  // A real arm COILS -- the elbow shuts on the wind-up, drives open through
  // the strike, and hangs slightly bent the rest of the time, because a limb
  // held perfectly straight is a limb nobody is using.
  //
  // How far it shuts depends on what is in the hand: you can fold a dagger
  // right in against your chest and you cannot do that with a claymore, so
  // the fold is scaled by the weapon's reach.  That is most of what makes a
  // heavy weapon look heavy from across the arena.
  const reachy = Math.min(1, f.st.reach / 50);
  const fold = 1 - reachy * 0.55;
  let bend = carry.elbow;
  if (f.act === 'windup') bend = -86 * fold;
  else if (f.act === 'strike') bend = -6;
  else if (f.act === 'recover') bend = -42 * fold;
  else if (f.act === 'guard') bend = -104 * fold;
  else if (f.act === 'dodge') bend = -66 * fold;
  else if (f.act === 'stagger') bend = -24;
  else if (f.act === 'lunge') bend = -30;
  // a thrust is the one attack that STRAIGHTENS rather than coils
  if (f.move?.anim === 'thrust' && (f.act === 'windup' || f.act === 'strike')) {
    bend = f.act === 'windup' ? -74 * fold : 2;
  }
  // and drawing a bow pulls the hand back past the cheek
  if (f.move?.anim === 'shoot') bend = f.act === 'strike' ? -18 : -96;
  // the shield tucked in tight for the run, then punched out on contact
  if (f.move?.anim === 'charge') {
    if (f.act === 'windup') bend = -34;
    else if (f.act === 'strike') bend = -2;
    else if (f.act === 'recover') bend = -30;
  }
  // ---- THE BLOWGUN, and the one sum that matters on it.
  //
  // What the crowd sees is shoulder PLUS elbow, because the pipe hangs off
  // the forearm (see `carryOf`).  Read as a swing -- shoulder up and back,
  // elbow folded hard -- that sum came to about -178, so the pipe lay flat
  // along his back pointing at the wall behind him while the dart came out
  // of his face and flew the other way.
  //
  // The elbow OPENS to bring the far end round in front: -60 and +40 is a
  // hand up by the chin with the pipe angled twenty degrees above the
  // horizontal, pointing at the other one.  It holds that through the whole
  // attack -- a blowgun does not swing, which is the point of it.
  if (f.move?.anim === 'puff') bend = f.act === 'strike' ? 46 : 40;
  // ---- A THROW COILS FURTHER AND OPENS FURTHER THAN A SWING.
  if (f.move?.anim === 'hurl') {
    if (f.act === 'windup') bend = -96 * fold;
    else if (f.act === 'strike') bend = 8;
    else if (f.act === 'recover') bend = -30;
  }
  // the idle breath, so nothing is ever perfectly still
  if (f.act === 'walk') bend += Math.sin(f.clock * 2.3 + (f.who === 'frog' ? 0 : 1.7)) * carry.sway;
  f.elbowA += (bend - f.elbowA) * snap;
  a.arm.fore.setAngle(f.elbowA);

  // ---- THE UNARMED STANCE.
  //
  // Hands up by the face, weight down a little, and the off hand doing its
  // half of the work: it holds the guard while the other one throws, and on
  // a combination they alternate.  Armed, it hangs at the side where it has
  // always been.
  const bare = f.broken || f.weapon.key === 'none';
  if (bare && !a.guardUp) {
    // ---- BOTH HANDS WHERE THEY CAN BE SEEN.
    //
    // The off arm is built behind the torso, which is right while it is
    // hanging at the side and useless the moment it comes up: a guard drawn
    // behind the chest is a guard nobody can see, and the fighter reads as
    // having one arm.  On going bare it comes round to the front and shifts
    // out to where a near-side hand actually sits.
    // The off arm goes in front of the HEAD, not merely in front of the
    // chest.  At this size the skull is most of the silhouette and the
    // shoulders sit inside it, so a rear hand drawn behind the head has
    // nowhere to be: it vanished, and the stance read as one arm pointing.
    // In front of the face is also where a boxer's rear hand belongs.
    a.guardUp = true;
    a.root.bringToTop(a.armOff.root);
    // Round to the front, but not all the way across -- a boxer's rear hand
    // sits inside the lead one, not on top of it.
    a.armOff.root.x = Math.abs(a.arm.root.x) * 0.45;
    a.armOff.root.y = a.arm.root.y + 1;
  }
  if (bare) {
    const throwing = f.act === 'strike' || f.act === 'recover';
    // A shove is the one unarmed move thrown with BOTH hands, so it does not
    // alternate: both arms go out together and both come back together.
    const shoving = f.move?.anim === 'shove' && (throwing || f.act === 'windup');
    const alt = f.swing % 2 === 1;
    if (shoving) {
      a.arm.root.setAngle(f.armA);
      a.armOff.root.setAngle(f.armA);
      a.armOff.root.setVisible(true);
      const open = f.act === 'strike' ? -6 : GUARD_FOLD;
      f.elbowA += (open - f.elbowA) * snap;
      a.arm.fore.setAngle(f.elbowA);
      a.armOff.fore.setAngle(f.elbowA);
    } else {
      a.armOff.root.setAngle(throwing && alt ? f.armA : GUARD_REAR);
      a.arm.root.setAngle(throwing && !alt ? f.armA : f.act === 'windup' ? f.armA : GUARD_LEAD);
      a.armOff.root.setVisible(true);
      // ---- A BOXER'S ARMS ARE BENT ARMS.
      //
      // The guard is elbows in and fists up; the punch drives the elbow open
      // and snaps it back.  Whichever hand is not throwing stays folded,
      // which is what makes the guard read as a guard and not as two arms
      // pointing.
      const drive = throwing ? -18 : GUARD_FOLD;
      f.elbowA += ((throwing && !alt ? drive : GUARD_FOLD) - f.elbowA) * snap;
      a.arm.fore.setAngle(f.elbowA);
      a.armOff.fore.setAngle(throwing && alt ? drive : GUARD_FOLD);
    }
  } else {
    a.armOff.root.setAngle(OFF_ARM_REST);
    a.armOff.fore.setAngle(-22);
  }

  // ---- THE CROUCH, spelled in the legs.
  //
  // Sinking the root drove the feet under the sand and dropping the head
  // left its eyes behind, since they are their own objects.  The legs are
  // the one part that can carry it: bent out at the knee the whole animal
  // settles, and the feet stay where they were standing.
  if (bare && f.act !== 'dodge' && f.act !== 'stagger') {
    // An OFFSET on the walk, not a replacement for it.  Set flat this froze
    // the legs mid-stride and an unarmed fighter slid round the sand without
    // moving them; added to the swing, he keeps walking, bowed.
    a.legL.setAngle(swingL - 7); a.legR.setAngle(-swingL + 7);
    a.greaveL.setAngle(swingL - 7); a.greaveR.setAngle(-swingL + 7);
  }

  // ---- THE WHOLE BODY BEHIND A THROW.
  //
  // The arm was doing all of it.  A thrown spear starts in the back foot:
  // the weight sits back and the shoulders turn away on the wind-up, then
  // everything drives forward together and the head finishes over the front
  // foot.  Without this the arm swings past a fighter standing still, which
  // reads as a flick rather than as somebody committing to a throw.
  if (f.move?.anim === 'hurl' && f.act !== 'walk') {
    const load = f.act === 'windup' ? -1 : f.act === 'strike' ? 1 : 0.45;
    // the stance: back foot loaded on the wind-up, front foot driven into on
    // the release
    a.legL.setAngle(swingL - load * 13);
    a.legR.setAngle(-swingL + load * 9);
    a.greaveL.setAngle(swingL - load * 13);
    a.greaveR.setAngle(-swingL + load * 9);
    // the shoulders turning away and then through, on top of the lean
    a.root.angle = f.face * load * 7;
    // and the head going with it
    a.headGroup.x = f.face * load * 3;
    a.headGroup.y = load > 0 ? 1 : -1;
    // the off arm counterweights, which is most of what sells a throw
    a.armOff.root.setAngle(load * 46 - 20);
    a.armOff.fore.setAngle(-26 - load * 14);
  }
  // ---- AND THE BLOWGUN, where the recoil is in the neck and not the arm.
  if (f.move?.anim === 'puff' && f.act !== 'walk') {
    const blow = f.act === 'strike' ? 1 : f.act === 'recover' ? 0.4 : 0;
    // chin down and shoulders in to take the breath, then the head snaps back
    a.headGroup.y = blow > 0 ? -2.4 * blow : 1.4;
    a.headGroup.x = -f.face * blow * 2.2;
    a.root.angle = -f.face * blow * 5;
    // the off hand comes up to steady the pipe
    a.armOff.root.setAngle(-64);
    a.armOff.fore.setAngle(-52);
    a.armOff.root.setVisible(true);
  }
  // ---- AND THE KICK, which is a leg and not an arm at all.
  if (f.move?.anim === 'kick' && (f.act === 'strike' || f.act === 'windup')) {
    const up = f.act === 'strike' ? -68 : -18;
    a.legR.setAngle(up);
    a.greaveR.setAngle(up);
  }
  // ---- AND THE CHARGE, which is legs as much as it is the shield.
  //
  // A sprinting stride twice the width of a walk, the whole body pitched
  // forward over it, and the off hand braced behind the shield; on contact
  // the front foot plants and the body drives through.
  const charging = f.move?.anim === 'charge' && (f.act === 'windup' || f.act === 'strike');
  if (charging) {
    const run = f.act === 'windup';
    const stride = run ? Math.sin(f.step / 3.2) * 17 : 0;
    const plant = run ? 0 : 1;
    a.legL.setAngle(stride - 4 - plant * 12);
    a.legR.setAngle(-stride + 4 + plant * 16);
    a.greaveL.setAngle(stride - 4 - plant * 12);
    a.greaveR.setAngle(-stride + 4 + plant * 16);
    a.root.y = FLOOR_Y - (run ? Math.abs(Math.sin(f.step / 3.2)) * 2.2 : 0);
    a.root.angle = f.face * (run ? 9 : 13);
    a.armOff.root.setAngle(-36);
    a.armOff.fore.setAngle(-64);
  }
  // and a spinning attack turns the whole animal, not only the arm
  if (f.move?.anim === 'spin' && (f.act === 'strike' || f.act === 'windup')) {
    a.root.angle = f.face * (f.act === 'strike' ? 22 : -14);
  } else if (f.act !== 'stagger' && phase !== 'over' && !charging
    && f.move?.anim !== 'hurl' && f.move?.anim !== 'puff') {
    // A throw and a blowgun both turn the whole body, above; zeroing here
    // would put it back upright on the same frame.
    a.root.angle = 0;
  }
  a.torso.setAngle(f.leanA);
  a.cuirass.setAngle(f.leanA);
  // ---- THE TAIL, on its hinge at the hip: a slow sway at rest, a swing with
  // the stride, a lash on a strike, and it goes up when the animal is hit.
  if (a.tail) {
    const lash = f.act === 'strike' ? -10 : f.act === 'windup' ? 6 : 0;
    const hurtUp = f.act === 'stagger' || f.stun > 0 ? -16 : 0;
    a.tail.setAngle(Math.sin(f.clock * 2.2 + (f.who === 'frog' ? 0 : 0.9)) * 5 + Math.sin(f.step / 5) * 4 + lash + hurtUp);
  }
  // The head, and everything on it, ducks as one -- unless the attack being
  // thrown is one the head is part of.  A throw carries it over the front
  // foot and a blowgun snaps it back off the breath, and both are set above;
  // this line ran after them and put it back on centre every frame.
  const headOwned = f.move?.anim === 'hurl' || f.move?.anim === 'puff';
  if (!headOwned || f.act === 'walk') {
    a.headGroup.x = 0;
    a.headGroup.y = f.act === 'dodge' ? 4 : f.act === 'stagger' ? -2 : 0;
  }

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

type Phase = 'title' | 'pick' | 'reveal' | 'summary' | 'entry' | 'fight' | 'over' | 'banked';

let scene0: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;

/**
 * THE LADDER, WHICH IS A FLAT RATE.
 *
 * Twenty-five tokens buys a seat, and then it is a run rather than a fight:
 * win and you may take what you have or put it all back on the next lizard.
 * Every win is worth the same fifteen, whichever rung it happens on.
 *
 * It used to open at fifty and then pay 25 + (N - 1) * 5 -- thirty, thirty
 * five, forty -- which made the FIRST fight the best-paid one in the run and
 * turned every round after it into a worse bet than the one before.  A flat
 * rate says the opposite thing, and says it without a table: the seat costs
 * twenty-five, one win does not buy it back, and the run only starts paying
 * on the second lizard.  Whether to go again is the whole game, and it is
 * the same question every time it is asked.
 *
 * `bank` is what has been won and NOT yet paid.  Nothing reaches the ledger
 * until the player stops: `win(bank)` on the way out, `lose()` if a lizard
 * gets there first, and in that case the bank and the entry both go with it.
 * Paying each round as it landed would have been simpler and would have made
 * "lose it all" impossible, because the shell has no way to take a credit
 * back once it has been made.
 */
/** DEV only: holds the fight still so a frame can be inspected. */
let frozen = false;
/** What is lying on the sand this bout.  The scene's copy of the fight's. */
let ground: Dropped[] = [];
let round = 1;
let bank = 0;

/**
 * What winning a round is worth.  The same on every rung of the ladder.
 *
 * `n` is kept in the signature: every caller has a round number to hand and
 * the cabinet card, the HUD and the banked screen all ask this rather than
 * printing a constant, so if the rate is ever made to move again there is
 * one place to do it and nothing else has to change.
 */
export function rewardFor(_n: number): number {
  return PRIZE;
}
/**
 * Fifteen a win.  The seat is twenty-five, charged by the cabinet (see
 * `cost` in content.ts), so it takes two lizards to be ahead of the house.
 */
const PRIZE = 15;
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
let defText: Record<'frog' | 'lizard', Phaser.GameObjects.BitmapText | null> = { frog: null, lizard: null };
let callOut: Phaser.GameObjects.BitmapText | null = null;
let buttons: Array<{ destroy(): void }> = [];

const S = (): Phaser.Scene => scene0!;
const rnd = (n: number): number => Math.floor(Math.random() * n);

function reset(): void {
  phase = 'title';
  ended = false;
  frozen = false;
  for (const d of ground) clearDrop(d);
  ground = [];
  round = 1;
  bank = 0;
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
  defText = { frog: null, lizard: null };
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

/**
 * TONIGHT'S OPPONENT, IN THE ORDER IT IS BUILT.
 *
 * Pick the archetype, apply its base, then roll weapon, head, body and legs
 * out of the SAME generator the chests use -- and only then work out what any
 * of it is worth.  Nothing consults Froggy's kit at any point, so there is
 * nothing here that could answer it.
 */
export function makeLizard(x: number, rng: () => number = Math.random): Fighter {
  let type = LIZARDS[Math.floor(rng() * LIZARDS.length)];
  // DEV: `?beast=lion` (or any animal, or archetype key) pins the opponent.
  if (import.meta.env?.DEV && typeof location !== 'undefined') {
    const want = new URLSearchParams(location.search).get('beast');
    const pick = want && LIZARDS.find((t) => t.build.animal === want || t.key === want);
    if (pick) type = pick;
  }
  return makeFighter('lizard', randomKit(), x, -1, type);
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
  if (!picked.head) { art.helm.setVisible(false); art.crown.setVisible(false); }
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
      ...wrapTo(w.spec.note),
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
    else showEntry();
  });
}

/** The clock ran out: open what is lit, or one at random if nothing is. */
function autoPick(): void {
  take(hi >= 0 && hi < offer.length ? hi : rnd(offer.length));
}

// ------------------------------------------------------------- final build

/**
 * STRAIGHT OUT ONTO THE SAND.
 *
 * There used to be a kit sheet in between -- FROGGY IS ARMED, a column of his
 * numbers, and a TO THE COLOSSEUM button -- and then the arena, which has a
 * walk-on of its own.  So the fourth chest was followed by two screens and
 * two presses to see one fight, and the second screen said nothing the first
 * had not.  The sheet is gone.  The last chest opens onto the colosseum, both
 * of them walk in, and the card that comes up is about the OPPONENT, which is
 * the one thing the player has not seen yet.
 */
function showEntry(): void {
  if (phase !== 'title') return;
  startRound();
}

/**
 * ONE ROUND: A NEW LIZARD, THE SAME FROG, AND THE SAND AGAIN.
 *
 * Round one comes straight off the fourth chest; every round after it comes
 * off the CONTINUE button and nothing else -- no timer starts the next fight.
 *
 * Froggy is rebuilt from the kit he opened, so he comes back whole and with
 * whatever broke in the last fight repaired.  The run is a gamble on the
 * BANK, not a war of attrition: carrying damage and a snapped weapon forward
 * would make round three unwinnable for reasons the player never chose.  The
 * lizard is rolled fresh by the existing generator, archetype and all.
 */
function startRound(): void {
  phase = 'entry';
  frog = makeFighter('frog', picked as Kit, 100, 1);
  lizard = makeLizard(220);

  const c = newLayer();
  crowd = buildArena(S(), c);

  // ---- both of them walk in from their own gate.  Nothing is pressed.
  frog.x = -20;
  lizard.x = GAME_W + 20;
  frog.hp = frog.st.maxHp;
  lizard.hp = lizard.st.maxHp;
  for (const f of [frog, lizard]) {
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
  callOut.setText(`FROGGY VS ${lizard?.type?.name ?? 'LIZARD'}`);
  S().time.delayedCall(1250, () => {
    callOut?.setText('');
    showCardOfBoth(c);
  });
}

/**
 * WHO YOU ARE ABOUT TO FIGHT, SIDE BY SIDE WITH WHO YOU BUILT.
 *
 * The opponent's archetype is the headline because it is the only thing on
 * this screen the player has not chosen: eight kinds of lizard, with their
 * own build and their own trade-offs, and the card names which one turned up
 * and what it is for.  Froggy's column is beside it so the two can be read
 * against each other, which is the whole decision the chests just made.
 */
function showCardOfBoth(c: Phaser.GameObjects.Container): void {
  const L = lizard!;
  const F = frog!;
  const ty = L.type!;
  const card: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => { c.add(o); card.push(o); return o; };
  keep(S().add.rectangle(8, 48, GAME_W - 16, 90, PALETTE.ink, 0.93).setOrigin(0, 0).setDepth(50).setStrokeStyle(1, PALETTE.gold));

  const col = (x: number, who: string, tint: number, f: Fighter, note: string) => {
    keep(text(S(), x, 53, who.slice(0, 17), tint).setDepth(52));
    keep(text(S(), x, 63, note.slice(0, 22), PALETTE.ash).setDepth(52));
    const rows: Array<[string, string]> = [
      ['WEAPON', f.kit.weapon.name.slice(0, 15)],
      ['POWER', f.st.powerPts.toFixed(0)],
      ['SPEED', f.st.speedPts.toFixed(0)],
      ['AVOID', f.st.avoidPts.toFixed(0)],
      // A ranged weapon says so here, as reach-in-hand against carry.  It
      // goes in the REACH row rather than a row of its own because the panel
      // is already the full height of its box.
      ['REACH', f.weapon.spec.ranged
        ? `${f.st.distPts.toFixed(0)} / ${f.weapon.spec.ranged.far}`
        : f.st.distPts.toFixed(0)],
      ['DEFENCE', `${Math.round(f.st.defence * 100)}%`],
      ['HEALTH', String(f.st.maxHp)],
    ];
    rows.forEach(([k, v], i) => {
      const y = 74 + i * 9;
      keep(text(S(), x, y, k, PALETTE.ash).setDepth(52));
      keep(text(S(), x + 138, y, v, i === 0 ? PALETTE.bone : tint).setDepth(52).setOrigin(1, 0));
    });
  };
  col(14, 'FROGGY', PALETTE.mossLight, F, 'OUT OF FOUR CHESTS');
  col(166, ty.name, PALETTE.amber, L, ty.blurb);
  keep(S().add.rectangle(GAME_W / 2, 50, 1, 86, PALETTE.steel).setOrigin(0.5, 0).setDepth(51));

  // ---- WHAT THIS PARTICULAR FIGHT IS WORTH.
  //
  // The round, what winning it pays, and -- from round two -- what is already
  // on the table and would go with a loss.  It sits under the two columns
  // because it is the reason to read them.
  const stake = bank > 0
    ? `ROUND ${round}   WIN +${rewardFor(round)}   BANK ${bank}`
    : `ROUND ${round}   WIN PAYS ${rewardFor(round)}`;
  // 147, not 143: centred text is centred on its y, so at 143 it straddled
  // the panel's bottom edge at 138 and read as sitting on the border.
  keep(centerText(S(), GAME_W / 2, 147, stake, bank > 0 ? PALETTE.gold : PALETTE.amber).setDepth(52));

  buttons.push(button(S(), GAME_W / 2, 161, 'FIGHT', () => {
    if (phase !== 'entry') return;
    for (const b of buttons) b.destroy();
    buttons = [];
    for (const o of card) o.destroy();
    callOut?.setText('FIGHT!').setDepth(40);
    audio.sfx('stinger', 0.6);
    S().tweens.add({ targets: callOut, scaleX: 1.4, scaleY: 1.4, alpha: 0, duration: 700 });
    fightT = 0;
    phase = 'fight';
  }, { width: 70, height: 16, fill: PALETTE.blood }));
}

/**
 * THE SCOREBOARD, KEPT TO ONE BAND AT THE TOP.
 *
 * It used to run a third of the way down the picture with the colosseum built
 * behind it, so two of the three banks of seating were under the words FROGGY
 * and LIZARD and nobody ever saw them.
 */
const HUD_BOT = 44;
function buildHud(c: Phaser.GameObjects.Container): void {
  c.add(S().add.rectangle(0, 18, GAME_W, HUD_BOT - 18, 0x0d0a07, 0.72).setOrigin(0, 0).setDepth(39));
  const bar = (x: number, who: 'frog' | 'lizard', label: string, colour: number, right: boolean): void => {
    c.add(text(S(), x, 20, label, PALETTE.cream).setDepth(41));
    hpNum[who] = text(S(), x + 130, 20, '', colour).setOrigin(1, 0).setDepth(41);
    c.add(hpNum[who]!);
    c.add(S().add.rectangle(x, 28, 130, 5, PALETTE.black, 0.8).setOrigin(0, 0).setDepth(40));
    hpBar[who] = S().add.rectangle(x + 1, 29, 128, 3, colour).setOrigin(0, 0).setDepth(41);
    c.add(hpBar[who]!);
    // what it is holding and what that is worth, on the one line
    kitLine[who] = text(S(), right ? x + 130 : x, 35, '', PALETTE.bone).setDepth(41).setOrigin(right ? 1 : 0, 0);
    c.add(kitLine[who]!);
    // Defence shares the weapon's row at the far end of it.  On the name row
    // it ran into the health numbers; in the middle of the strip the two
    // halves of the scoreboard ran into each other.  The weapon name is cut
    // to twelve characters so the two never meet.
    // Just the number.  "DEF " cost four characters of a row that also has to
    // hold THROWING KNIVES, and the weapon name was being cut to THROWING KNIV.
    // It is live now, because armour comes off mid-fight and a scoreboard
    // still quoting the suit he started in would be lying.
    defText[who] = text(S(), right ? x : x + 130, 35, '', PALETTE.ash).setDepth(41).setOrigin(right ? 0 : 1, 0);
    c.add(defText[who]!);
  };
  bar(8, 'frog', 'FROGGY', PALETTE.mossLight, false);
  bar(GAME_W - 138, 'lizard', lizard?.type?.name ?? 'LIZARD', PALETTE.amber, true);
  // The strip's middle is the only spare room on the screen, and the round
  // and its prize are the two things worth keeping in front of the player.
  c.add(centerText(S(), GAME_W / 2, 20, `R${round}`, PALETTE.gold).setDepth(41));
  c.add(centerText(S(), GAME_W / 2, 29, `+${rewardFor(round)}`, PALETTE.amber).setDepth(41));
  if (bank > 0) c.add(centerText(S(), GAME_W / 2, 38, `${bank}`, PALETTE.cream).setDepth(41));
  refreshHud();
}

function refreshHud(): void {
  for (const who of ['frog', 'lizard'] as const) {
    const f = who === 'frog' ? frog! : lizard!;
    const b = hpBar[who];
    if (b) b.width = Math.max(0, Math.round((Math.max(0, f.hp) / f.st.maxHp) * 128));
    hpNum[who]?.setText(`${Math.max(0, f.hp)} / ${f.st.maxHp}`);
    defText[who]?.setText(`${Math.round(f.st.defence * 100)}%`);
    // ---- AND HOW MANY SHOTS ARE LEFT, which is the whole story of a
    // thrower's fight: six knives is a different fighter from none, and the
    // moment the count reaches nought he has to come and fight you.
    const r = f.weapon.spec.ranged;
    const count = r && !f.broken && Number.isFinite(f.ammo) ? ` x${Math.max(0, f.ammo)}` : '';
    const name = f.broken ? 'BARE HANDS' : f.weapon.name.slice(0, 16 - count.length) + count;
    kitLine[who]?.setText(name)
      .setTint(f.broken ? PALETTE.blood : r && f.ammo <= 0 ? PALETTE.fog : PALETTE.bone);
  }
}

/** A number coming off somebody, and the burst where it landed. */
/**
 * WHAT AN ARROW LOOKS LIKE ON ITS WAY ACROSS THE SAND.
 *
 * The flight time is the SIMULATION's, not a tween duration picked to look
 * right: `sh.t` is counted down by `exchange` and the sprite is simply drawn
 * at however far along it has got.  So the thing the crowd watches land is
 * the same event the rules resolved, and a shot cannot arrive on screen at a
 * different moment from the one it arrives in the fight.
 */
function buildShot(kind: Shot, face: number): Phaser.GameObjects.Container {
  const c = S().add.container(0, 0);
  const put = (x: number, y: number, w: number, h: number, col: number, ang = 0) =>
    c.add(S().add.rectangle(x, y, w, h, col).setAngle(ang));
  switch (kind) {
    case 'arrow':
      put(0, 0, 11, 1.5, 0x8a6a42); put(5, 0, 3, 2, 0xc6ced9);
      put(-5, 0, 3, 3, 0xe8e2d0); put(-5, 0, 3, 1, 0xb03030);
      break;
    case 'bolt':
      put(0, 0, 8, 2, 0x5e4a30); put(4, 0, 3.5, 2.5, 0xdfe6f0); put(-4, 0, 2, 3, 0x9aa2ae);
      break;
    case 'knife':
      put(0, 0, 8, 2, 0xc6ced9); put(0, -1, 8, 1, 0xeef3fa); put(-4, 0, 3, 2.5, 0x3b2a1a);
      break;
    case 'axe':
      put(0, 0, 9, 2, 0x7a5a36); put(4, -1, 5, 6, 0xc6ced9); put(4, -3, 5, 1.5, 0xeef3fa);
      break;
    case 'spear':
      put(0, 0, 16, 2, 0x8a6a42); put(8, 0, 6, 2.5, 0xc6ced9); put(8, -1, 6, 1, 0xeef3fa);
      break;
    case 'stone':
      c.add(S().add.circle(0, 0, 2.2, 0x8f8a80));
      c.add(S().add.circle(-0.6, -0.6, 1.2, 0xb4afa4));
      break;
    case 'dart':
      put(0, 0, 5, 1, 0x2a2d3a); put(2, 0, 2, 1.5, 0xc6ced9); put(-2.5, 0, 2, 2, 0xe0e36a);
      break;
    case 'spark':
      c.add(S().add.circle(0, 0, 3.4, 0x6fd8e8).setAlpha(0.5));
      c.add(S().add.circle(0, 0, 2, 0xdffaff));
      break;
    case 'disc':
      c.add(S().add.circle(0, 0, 4, 0xc6ced9));
      c.add(S().add.circle(0, 0, 2.2, 0x2b2118));
      break;
  }
  c.setScale(face, 1).setDepth(26);
  layer?.add(c);
  return c;
}

/** Put every shot in the air where it has got to this frame. */
/**
 * WHAT A THROWN WEAPON LOOKS LIKE IN THE AIR.
 *
 * If the thing flying IS the weapon -- a spear, a trident, a javelin, a
 * throwing axe, a knife, a chakram -- then what flies is the weapon's own
 * sprite, built by `buildWeapon` exactly as it is built for the hand.  Same
 * geometry, same size, same proportions.
 *
 * It used to be `buildShot`, which draws a generic stand-in per projectile
 * KIND: every `shot: 'spear'` weapon flew as the same sixteen-pixel stick,
 * so a trident left the hand as a trident and crossed the arena as a twig,
 * and a javelin and a spear were indistinguishable in flight.
 *
 * `buildShot` is still right for everything a weapon SHOOTS rather than
 * becomes -- an arrow is not the bow, a dart is not the blowgun, a slung
 * stone is not the sling.
 */
function buildFlyingArt(sh: InFlight, f: Fighter): Phaser.GameObjects.Container {
  if (!sh.weapon) return buildShot(sh.kind, f.face);
  // The same tint the hand and the sand use, so one weapon does not change
  // colour between being held, being thrown and being picked up again.
  const tint = f.who === 'frog' ? PALETTE.mossLight : PALETTE.amber;
  const art = buildWeapon(S(), sh.weapon.def.key, tint, sh.weapon.single);
  // NOT rescaled.  The only thing done to it is the facing flip, which is the
  // same one the hand applies, so it is the same size in the air as it was in
  // the fist and it stays that size for the whole flight.
  art.setScale(f.face, 1).setDepth(26);
  layer?.add(art);
  return art;
}

function drawFlight(f: Fighter): void {
  for (const sh of f.flight) {
    if (!sh.art) {
      sh.art = buildFlyingArt(sh, f);
      audio.sfx('throw_whoosh', 0.35);
    }
    const k = 1 - Math.max(0, sh.t) / sh.total;          // 0 at the hand, 1 at the target
    const x = sh.from + (sh.aim - sh.from) * k;
    // A believable throw: it leaves the hand at shoulder height, rises, and
    // comes down onto the target.  `arc` is how much of that there is, so a
    // bolt is nearly flat and a slung stone is lobbed right over.
    const lift = Math.sin(k * Math.PI) * sh.arc * Math.abs(sh.aim - sh.from) * 0.42;
    // ---- WHERE IT LEAVES FROM.
    //
    // Everything else leaves the hand, at shoulder height.  A dart leaves the
    // MOUTH -- the pipe is up at the lips through the whole animation, and a
    // dart setting off from the waist with the blowgun held to the face is the
    // one thing that would give the trick away.  The head sits between 26 and
    // 39 pixels up, so the lips are about thirty-one.
    const y = FLOOR_Y - (sh.kind === 'dart' ? 31 : 24) - lift;
    sh.art.setPosition(x, y);
    // ---- AND IT POINTS WHERE IT IS GOING.
    //
    // `slope` is the tangent of the arc it is on, so a long weapon comes out
    // of the hand nose-up, levels at the top and noses down onto the target
    // rather than sliding across the arena flat.
    const slope = sh.arc * Math.cos(k * Math.PI) * 52;
    const dir = Math.sign(sh.aim - sh.from || 1);
    if (sh.kind === 'disc' || sh.kind === 'stone' || sh.kind === 'spark') {
      // A chakram is a thrown weapon AND a thing that spins: it keeps turning.
      sh.art.setAngle(sh.kind === 'disc' ? (sh.art.angle + 26) % 360 : 0);
    } else if (sh.kind === 'axe') {
      // An axe goes end over end, and a real one is heavier, so it turns
      // slower and more deliberately than the old stand-in did.
      sh.art.setAngle((sh.art.angle + (sh.weapon ? 16 : 22)) % 360);
    } else {
      // A shaft flies POINT FIRST.  The sprite is drawn lying along +x with
      // its head forward, which is already the direction of travel once the
      // facing flip is applied -- so the only turn it needs is the arc's own
      // slope.  Nothing here touches scale.
      sh.art.setAngle(-slope * dir);
    }
  }
}

/**
 * The shot arrived: take the sprite away, with a puff if it hit nothing --
 * unless it was a WEAPON, which is not used up by arriving.
 */
function retireShot(sh: InFlight, hit: boolean): void {
  const art = sh.art;
  if (!art) return;
  sh.art = null;
  // ---- A THROWN WEAPON LANDS WHERE IT LIES, AND STAYS VISIBLE THERE.
  //
  // The rules put it on the sand as a pickup, but nothing drew it: the
  // flying sprite faded out on arrival and the one on the ground was never
  // made, so a thrown spear was lying there, perfectly real and perfectly
  // invisible, until somebody walked over and picked up thin air.  The
  // sprite that flew is the one that lands -- it drops, bounces once and
  // settles flat where the rules put it, with the glint every weapon lying
  // on the sand has.
  const d = sh.landed;
  if (d && !d.art && S()) {
    d.art = art;
    settleOnSand(d, art, art.x < d.x ? 1 : -1);
    return;
  }
  if (!hit) {
    S().tweens.add({ targets: art, y: FLOOR_Y - 2, angle: art.angle + 40, alpha: 0.6,
      duration: 220, ease: 'Quad.easeIn',
      onComplete: () => { S().tweens.add({ targets: art, alpha: 0, duration: 500, onComplete: () => art.destroy() }); } });
    return;
  }
  art.destroy();
}

/**
 * THE WEAPON LEAVING THE HAND, and where it comes to rest.
 *
 * It tumbles out on the side the blow came from, bounces once off the sand
 * and slides the last of the way -- which is the bit that sells it as a
 * physical object rather than a sprite being moved to a coordinate.
 */
function showDisarm(f: Fighter, d: Dropped): void {
  audio.sfx('fence_thunk', 0.6);
  audio.sfx('item_thud', 0.45);
  floatHigh(f.x, 'DISARMED!', PALETTE.gold);
  S().cameras.main.shake(180, 0.005);
  // the hand it left: the other blade of a pair, or the bare fist
  if (f.art) {
    f.art.weapon.destroy();
    const left = f.broken || f.weapon.key === 'none'
      ? buildWeapon(S(), UNARMED.key, f.who === 'frog' ? PALETTE.mossLight : PALETTE.amber)
      : buildWeapon(S(), f.weapon.key, f.who === 'frog' ? PALETTE.mossLight : PALETTE.amber, true);
    left.setPosition(f.art.arm.hand + 1, 0);
    f.art.arm.fore.add(left);
    f.art.weapon = left;
    f.art.nicks = 0;
    if (!f.broken) floatHigh(f.x, 'ONE LEFT!', PALETTE.gold);
  }
  const art = buildWeapon(S(), d.def.key, f.who === 'frog' ? PALETTE.mossLight : PALETTE.amber, d.single && !!d.def.spec.paired);
  art.setPosition(f.x + f.face * 8, FLOOR_Y - 24).setDepth(19);
  layer?.add(art);
  d.art = art;
  const bounce = FLOOR_Y - 10;
  S().tweens.add({
    targets: art, x: d.x - (d.x - f.x) * 0.25, y: bounce,
    angle: 320 + Math.random() * 200, duration: 320, ease: 'Quad.easeOut',
    onComplete: () => {
      S().tweens.add({
        targets: art, x: d.x, y: FLOOR_Y - 3, angle: art.angle + 120,
        duration: 260, ease: 'Quad.easeIn',
        onComplete: () => {
          // laid flat where it stopped, with a glint so it reads as a pickup
          art.setAngle(f.face > 0 ? 8 : -8).setPosition(d.x, FLOOR_Y - 3);
          audio.sfx('item_thud', 0.3);
          const glint = S().add.rectangle(d.x, FLOOR_Y - 7, 9, 1, PALETTE.bone).setDepth(20).setAlpha(0);
          layer?.add(glint);
          S().tweens.add({ targets: glint, alpha: 0.75, duration: 420, yoyo: true, repeat: -1 });
          d.art = art;
          (art as unknown as { glint?: Phaser.GameObjects.Rectangle }).glint = glint;
        },
      });
    },
  });
}

/**
 * A weapon sprite coming down onto the sand at `d.x`: one bounce, then flat,
 * with a glint so it reads as something to pick up.  Shared by a weapon
 * knocked out of a hand and a weapon thrown, so the two lie there the same.
 */
function settleOnSand(d: Dropped, art: Phaser.GameObjects.Container, dir: number): void {
  art.setDepth(19);
  const midX = art.x + (d.x - art.x) * 0.6;
  S().tweens.add({
    targets: art, x: midX, y: FLOOR_Y - 9, angle: art.angle + dir * 160, duration: 220, ease: 'Quad.easeOut',
    onComplete: () => {
      S().tweens.add({
        targets: art, x: d.x, y: FLOOR_Y - 3, angle: dir > 0 ? 8 : -8, duration: 200, ease: 'Quad.easeIn',
        onComplete: () => {
          if (d.art !== art) return; // picked up on the way down
          art.setPosition(d.x, FLOOR_Y - 3);
          audio.sfx('item_thud', 0.3);
          addGlint(d, art);
        },
      });
    },
  });
}

/** The glint on something lying on the sand; it goes when the sprite goes. */
function addGlint(d: Dropped, art: Phaser.GameObjects.Container): void {
  const glint = S().add.rectangle(d.x, FLOOR_Y - 7, 9, 1, PALETTE.bone).setDepth(20).setAlpha(0);
  layer?.add(glint);
  S().tweens.add({ targets: glint, alpha: 0.75, duration: 420, yoyo: true, repeat: -1 });
  (art as unknown as { glint?: Phaser.GameObjects.Rectangle }).glint = glint;
  art.once(Phaser.GameObjects.Events.DESTROY, () => glint.destroy());
}

/**
 * NOTHING ON THE SAND IS INVISIBLE.  Anything the rules put there that has no
 * sprite yet -- however it got there -- is drawn lying flat where it is.
 */
function drawGround(): void {
  for (const d of ground) {
    if (d.art) continue;
    const art = buildWeapon(S(), d.def.key, PALETTE.bone, d.single && !!d.def.spec.paired);
    art.setPosition(d.x, FLOOR_Y - 3).setAngle(8).setDepth(19);
    layer?.add(art);
    d.art = art;
    addGlint(d, art);
  }
}

/** Take the sprite and its glint away once somebody has it, or the sand does. */
function clearDrop(d: Dropped): void {
  const art = d.art as unknown as { glint?: Phaser.GameObjects.Rectangle } | null;
  art?.glint?.destroy();
  d.art?.destroy();
  d.art = null;
}

/**
 * THE HAND AFTER THE THROW.
 *
 * Not a break and not a disarm: nothing snapped and nobody knocked it away.
 * The weapon is simply gone -- it is over there now -- so there is no shard
 * and no tumble, only the fist that is left and a line saying what it cost.
 */
function showThrownAway(f: Fighter): void {
  if (!f.art) return;
  audio.sfx('throw_whoosh', 0.5);
  floatHigh(f.x, 'THROWN!', PALETTE.amber);
  f.art.weapon.destroy();
  const fists = buildWeapon(S(), UNARMED.key, f.who === 'frog' ? PALETTE.mossLight : PALETTE.amber);
  fists.setPosition(f.art.arm.hand + 1, 0);
  f.art.arm.fore.add(fists);
  f.art.weapon = fists;
  f.art.nicks = 0;
  f.art.guardUp = false;
}

/** The weapon going back into a hand, and the hand closing round it. */
function showPickup(f: Fighter, d: Dropped): void {
  audio.sfx('item_thud', 0.5);
  floatHigh(f.x, `${d.def.name.slice(0, 14)}!`, PALETTE.mossLight);
  clearDrop(d);
  if (!f.art) return;
  f.art.weapon.destroy();
  const w = buildWeapon(S(), d.def.key, f.who === 'frog' ? PALETTE.mossLight : PALETTE.amber, f.single);
  w.setPosition(f.art.arm.hand + 1, 0);
  f.art.arm.fore.add(w);
  f.art.weapon = w;
  f.art.nicks = 0;
  f.art.guardUp = false;
  // it comes up off the sand rather than appearing in the fist
  w.setScale(0.4).setAlpha(0.6);
  S().tweens.add({ targets: w, scaleX: 1, scaleY: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
}

/**
 * A WEAPON GIVING OUT UNDER A BLOW RATHER THAN ON ONE.
 *
 * Deliberately not the same as wearing out mid-swing: this one fails while
 * being held still, so the pieces go straight down at the feet instead of
 * spinning away, and the fighter is left standing in a guard with nothing
 * in it.
 */
function showBlockBreak(f: Fighter): void {
  audio.sfx('crumble', 0.75);
  audio.sfx('fence_thunk', 0.5);
  floatHigh(f.x, 'GUARD SHATTERED!', PALETTE.blood);
  S().cameras.main.shake(220, 0.007);
  for (let i = 0; i < 5; i++) {
    const bit = S().add.rectangle(f.x + f.face * 10, FLOOR_Y - 22, 3, 2, PALETTE.steel).setDepth(31);
    layer?.add(bit);
    S().tweens.add({
      targets: bit, x: bit.x + (Math.random() - 0.5) * 22, y: FLOOR_Y - 2,
      angle: 180 + Math.random() * 360, alpha: 0, duration: 420 + Math.random() * 200,
      ease: 'Quad.easeIn', onComplete: () => bit.destroy(),
    });
  }
  if (!f.art) return;
  f.art.weapon.destroy();
  const left = f.broken || f.weapon.key === 'none'
    ? buildWeapon(S(), UNARMED.key, f.who === 'frog' ? PALETTE.mossLight : PALETTE.amber)
    : buildWeapon(S(), f.weapon.key, f.who === 'frog' ? PALETTE.mossLight : PALETTE.amber, true);
  left.setPosition(f.art.arm.hand + 1, 0);
  f.art.arm.fore.add(left);
  f.art.weapon = left;
  f.art.nicks = 0;
  if (!f.broken) floatHigh(f.x, 'ONE LEFT!', PALETTE.gold);
}

/**
 * A SHIELD CHARGE LANDING.  A thump, a jolt of the camera, and a spray of
 * sand kicked up behind the one it moved -- the shove itself is in `x`.
 */
function showRam(f: Fighter): void {
  audio.sfx('fence_thunk', 0.7);
  audio.sfx('boom', 0.3);
  S().cameras.main.shake(160, 0.006);
  for (let i = 0; i < 7; i++) {
    const puff = S().add.circle(f.x - f.face * (2 + Math.random() * 8), FLOOR_Y - 1 - Math.random() * 3, 1.5 + Math.random() * 1.8, 0xd8c08a)
      .setAlpha(0.8).setDepth(19);
    layer?.add(puff);
    S().tweens.add({
      targets: puff, x: puff.x - f.face * (8 + Math.random() * 14), y: puff.y - 3 - Math.random() * 6,
      scale: 1.8, alpha: 0, duration: 380 + Math.random() * 240, ease: 'Quad.easeOut', onComplete: () => puff.destroy(),
    });
  }
}

/** Sand kicked up behind the feet of somebody running a shield charge. */
function chargeDust(f: Fighter): void {
  const puff = S().add.circle(f.x - f.face * 6, FLOOR_Y - 1, 1.4 + Math.random(), 0xd8c08a).setAlpha(0.7).setDepth(19);
  layer?.add(puff);
  S().tweens.add({
    targets: puff, x: puff.x - f.face * (4 + Math.random() * 6), y: puff.y - 2 - Math.random() * 3,
    scale: 1.7, alpha: 0, duration: 320, onComplete: () => puff.destroy(),
  });
}

function showBlow(f: Fighter, blow: Blow): void {
  const x = f.x;
  if (blow.dodged) {
    floating(x, 'MISS', PALETTE.fog);
    audio.sfx('throw_whoosh', 0.3);
    return;
  }
  if (!blow.hit) return;
  floating(x, `-${blow.dmg}`, blow.guarded ? PALETTE.tealLight : PALETTE.cream);
  if (blow.rammed) showRam(f);
  // The move's name on the big ones, so a player watching can learn what each
  // weapon actually does rather than being told in a menu.
  if (blow.move && (blow.dmg >= f.st.maxHp * 0.1 || blow.crit || blow.countered || blow.rammed)) {
    floatHigh(x, blow.move, blow.crit ? PALETTE.gold : PALETTE.bone);
  }
  // ---- AND IF THE DART GOT THROUGH, SAY SO.
  //
  // Poison is the one thing in the fight that costs health with nothing
  // visible happening, so the moment it goes in is the moment to show it --
  // otherwise the bar ticks down for four seconds and looks like a bug.
  if (blow.poisoned) {
    floatHigh(x, 'POISONED!', 0x7fd46a);
    audio.sfx('crumble', 0.35);
    if (f.art) for (const part of [f.art.torso, f.art.head]) flashWhite(part, 0x7fd46a);
    // and a few motes coming off him, so the poison has somewhere to be
    for (let i = 0; i < 7; i++) {
      const mote = S().add.circle(x + (Math.random() - 0.5) * 14, FLOOR_Y - 14 - Math.random() * 16, 1, 0x7fd46a).setDepth(32);
      layer?.add(mote);
      S().tweens.add({
        targets: mote, y: mote.y - 10 - Math.random() * 10, alpha: 0,
        duration: 700 + Math.random() * 500, onComplete: () => mote.destroy(),
      });
    }
  }
  audio.sfx(blow.dmg >= 12 ? 'boom' : blow.guarded ? 'fence_thunk' : 'whack', blow.dmg >= 12 ? 0.5 : 0.4);
  audio.sfx('item_thud', 0.3);
  f.stun = Math.min(0.28, blow.dmg / 60);

  // ---- IT MOVES THE BODY IT LANDED ON.  A shove away from the swing, sized
  // by the damage and capped so a heavy blow cannot fling anybody across the
  // sand, and a white frame on the part that was hit.  Both are drawing only:
  // `shove` is added at draw time and `x` never hears about it.
  f.shove = -f.face * (blow.rammed ? 10 : Math.min(7, 1.5 + blow.dmg * 0.34));
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

/** A label that rises well clear of the damage numbers. */
function floatHigh(x: number, str: string, colour: number): void {
  const t = centerText(S(), Phaser.Math.Clamp(x, 40, GAME_W - 40), FLOOR_Y - 52, str, colour).setDepth(62);
  layer?.add(t);
  S().tweens.add({ targets: t, y: FLOOR_Y - 68, alpha: 0, duration: 780, onComplete: () => t.destroy() });
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
function flashWhite(part: Phaser.GameObjects.Shape, colour: number = PALETTE.cream): void {
  if (!flashFrom.has(part)) flashFrom.set(part, part.fillColor);
  part.setFillStyle(colour);
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

/**
 * A PIECE OF ARMOUR COMES OFF, AND IT IS SUPPOSED TO BE OBVIOUS.
 *
 * The pieces are hidden rather than left attached and dented, the body
 * underneath is uncovered, and a copy of what was there spins away across
 * the sand so the eye follows it off.  Different noise from a weapon
 * breaking on purpose -- metal clattering rather than wood snapping -- so a
 * spectator can tell from across the room which of the two just happened.
 */
function showStrip(f: Fighter, slot: 'head' | 'body' | 'legs', tint: number): void {
  const a = f.art;
  audio.sfx('fence_thunk', 0.65);
  audio.sfx('item_thud', 0.5);
  S().cameras.main.shake(150, 0.005);
  floatHigh(f.x, `${slot === 'head' ? 'HELM' : slot === 'body' ? 'CUIRASS' : 'GREAVES'} GONE`, PALETTE.steel);
  if (!a) return;

  const worn: Phaser.GameObjects.Components.Visible[] =
    slot === 'head' ? [a.helm, a.helmDome, a.visor, a.plume, a.crown]
      : slot === 'body' ? [a.cuirass, a.belt, a.ridge, a.pauldL, a.pauldR]
        : [a.greaveL, a.greaveR, a.kneeL, a.kneeR];
  // Taken off, not dented: nothing broken stays on the body.
  for (const w of worn) w.setVisible(false);

  // and the piece itself tumbles away
  for (let i = 0; i < 4; i++) {
    const bit = S().add.rectangle(f.x + (i - 2) * 3, FLOOR_Y - (slot === 'head' ? 40 : slot === 'body' ? 24 : 10), 5, 3, tint).setDepth(32);
    layer?.add(bit);
    S().tweens.add({
      targets: bit, x: bit.x - f.face * (14 + Math.random() * 22), y: FLOOR_Y - 2,
      angle: 200 + Math.random() * 300, alpha: 0, duration: 620 + Math.random() * 220,
      ease: 'Quad.easeIn', onComplete: () => bit.destroy(),
    });
  }
  // a flash on what is suddenly bare
  const bare = slot === 'head' ? [a.head] : slot === 'body' ? [a.torso] : [a.legL, a.legR];
  for (const part of bare) flashWhite(part);
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
  // ---- AND WHAT IS LEFT IN THE HAND.
  //
  // For a pair, that is the other blade, so the sprite is redrawn as a
  // single rather than swapped for a fist: the fighter is down to one, not
  // out.  Only an actually empty hand gets the knuckles.
  if (f.art) {
    f.art.weapon.destroy();
    if (!f.broken && f.weapon.key !== 'none') {
      const one = buildWeapon(S(), f.weapon.key, f.who === 'frog' ? PALETTE.mossLight : PALETTE.amber, true);
      one.setPosition(f.art.arm.hand + 1, 0);
      f.art.arm.fore.add(one);
      f.art.weapon = one;
      f.art.nicks = 0;
      floatHigh(f.x, 'ONE LEFT!', PALETTE.gold);
      return;
    }
    // UNARMED.key, not a literal: the literal was 'fists', which stopped
    // being a key when the rack was rebuilt and nobody noticed because the
    // switch quietly answered it with a shield.
    const fists = buildWeapon(S(), UNARMED.key, f.who === 'frog' ? PALETTE.mossLight : PALETTE.amber);
    fists.setPosition(f.art.arm.hand + 1, 0);
    f.art.arm.fore.add(fists);
    f.art.weapon = fists;
    f.art.nicks = 0;
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
  // Whoever is holding nothing keeps an eye on the floor, so the pickup has
  // to be drawn the moment the rules hand it over.
  const wasSeeking: Array<[Fighter, Dropped | null]> = [[frog!, frog!.seeking], [lizard!, lizard!.seeking]];
  const heldBefore = [frog!.weapon.key, lizard!.weapon.key] as const;
  for (const e of exchange(frog!, lizard!, dt, Math.random, ground)) {
    if (e.blow.disarmed) showDisarm(e.def, e.blow.disarmed);
    if (e.blow.broke) showBreak(e.att);
    // A weapon that gave out CATCHING something broke in the defender's
    // hands, not the attacker's -- attributing it to the swinger would take
    // the sprite out of the wrong gladiator's grip, which is the same bug
    // the clash path had.
    if (e.blow.blockBroke) showBlockBreak(e.def);
    // The spikes bill the ATTACKER, so the number floats over them.
    if (e.blow.spiked) {
      floating(e.att.x, `-${e.blow.spiked}`, PALETTE.steel);
      floatHigh(e.att.x, 'SPIKES!', PALETTE.bone);
      audio.sfx('fence_thunk', 0.5);
    }
    if (e.blow.stripped) showStrip(e.def, e.blow.stripped, e.blow.strippedTint ?? PALETTE.steel);
    // A shot that has only just been loosed has not done anything yet -- the
    // sprite goes up and the damage waits until it gets there.
    if (e.blow.loosed && !e.blow.hit && !e.blow.dodged && e.blow.dmg === 0 && e.att.flight.includes(e.blow.loosed)) continue;
    if (e.blow.loosed) retireShot(e.blow.loosed, e.blow.hit);
    if (e.blow.clashed) showClash(e.att, e.def);
    else showBlow(e.def, e.blow);
  }
  drawFlight(frog!);
  drawFlight(lizard!);
  drawGround();
  for (const f of [frog!, lizard!]) {
    if (f.act === 'windup' && f.move?.anim === 'charge' && Math.random() < real * 22) chargeDust(f);
  }
  // a hand that was empty and is not any more has just closed on something
  for (let i = 0; i < 2; i++) {
    const f = i === 0 ? frog! : lizard!;
    if (heldBefore[i] === 'none' && f.weapon.key !== 'none') {
      const was = wasSeeking[i][1];
      if (was) showPickup(f, was);
    }
    // ---- AND A HAND THAT HAS JUST THROWN WHAT WAS IN IT.
    //
    // `emptyHand` is not a break and not a disarm, so neither `showBreak` nor
    // `showDisarm` runs for it and nothing was swapping the sprite: the
    // fighter's spear went across the arena and he carried on holding a
    // spear, which is the one frame that gives the whole mechanic away.
    if (heldBefore[i] !== 'none' && f.weapon.key === 'none' && f.art
      && f.art.weapon.getData('key') !== UNARMED.key) {
      showThrownAway(f);
    }
  }
  // the knock-back easing off, which is drawing and nothing else
  for (const f of [frog!, lizard!]) {
    if (f.shove !== 0) {
      f.shove -= f.shove * Math.min(1, SHOVE_DECAY * real);
      if (Math.abs(f.shove) < 0.05) f.shove = 0;
    }
  }
  wearWeapon(frog!);
  wearWeapon(lizard!);
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

  // Declared BEFORE the sequences start, so the very first frame after the
  // last blow is already the tweens' and not the walk cycle's.
  loser.pose = 'down';
  winner.pose = 'cheer';
  goesDown(loser);
  celebrates(winner, won);

  if (!won) {
    // The bank goes down with him.  Nothing was ever credited, so there is
    // nothing to take back -- `lose` simply pays none of it.
    S().time.delayedCall(OVER_LOSE_MS, () => finish(false));
    return;
  }
  bank += rewardFor(round);
  S().time.delayedCall(OVER_WIN_MS, showBanked);
}

/**
 * THE ONLY DECISION LEFT IN THE GAME: TAKE IT, OR PUT IT BACK.
 *
 * Nothing starts the next fight by itself.  The round is over, the bank is on
 * the table, and the two buttons are the whole of it -- so the player can see
 * what they are holding and what the next lizard is worth before they decide
 * to risk one for the other.
 */
function showBanked(): void {
  if (phase !== 'over' || ended) return;
  phase = 'banked';
  for (const b of buttons) b.destroy();
  buttons = [];

  const won = rewardFor(round);
  const next = rewardFor(round + 1);
  const c = layer ?? S().add.container(0, 0);
  const card: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => { c.add(o); card.push(o); return o; };

  // ---- THE LAYOUT, WITH ROOM TO BREATHE.
  //
  // Five lines crammed into eighty-four pixels put the heading on the top
  // border and left BANKED sitting on the line above it.  Four lines inside
  // the box on a nine-pixel rhythm now -- text is centred on its y, so a
  // sixteen-high line needs eight either side of that centre before anything
  // else starts -- and the warning, which is a caption rather than a figure,
  // moved outside and underneath where it has the room.
  keep(S().add.rectangle(30, 48, GAME_W - 60, 92, PALETTE.ink, 0.94).setOrigin(0, 0).setDepth(60).setStrokeStyle(1, PALETTE.gold));
  keep(centerText(S(), GAME_W / 2, 65, `ROUND ${round} WON`, PALETTE.gold, 16).setDepth(62));
  keep(centerText(S(), GAME_W / 2, 86, `+${won} THIS ROUND`, PALETTE.mossLight).setDepth(62));
  keep(centerText(S(), GAME_W / 2, 107, `BANKED  ${bank}`, PALETTE.cream, 16).setDepth(62));
  keep(centerText(S(), GAME_W / 2, 128, `ROUND ${round + 1} PAYS ${next}`, PALETTE.amber).setDepth(62));
  // A strip behind it, because out here it is over the sand and whatever is
  // lying on it -- the warning was reading through a dead lizard.
  keep(S().add.rectangle(GAME_W / 2, 147, 196, 11, PALETTE.ink, 0.8).setDepth(61));
  keep(centerText(S(), GAME_W / 2, 147, 'LOSE AND THE BANK GOES WITH IT', PALETTE.ash).setDepth(62));

  buttons.push(button(S(), 84, 164, `TAKE ${bank}`, () => {
    if (phase !== 'banked') return;
    for (const o of card) o.destroy();
    finish(true);
  }, { width: 90, height: 16, fill: PALETTE.tealDark }));

  buttons.push(button(S(), GAME_W - 84, 164, 'CONTINUE', () => {
    if (phase !== 'banked') return;
    for (const o of card) o.destroy();
    for (const b of buttons) b.destroy();
    buttons = [];
    round += 1;
    startRound();
  }, { width: 90, height: 16, fill: PALETTE.blood }));
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
  // `a.arm` is a rig, not a display object: tweening it set a property on a
  // plain object and nothing moved.  It is the shoulder that swings.
  sc.tweens.add({ targets: a.arm.root, angle: f.face * 60, duration: 300, delay: 150 });
  sc.tweens.add({ targets: a.arm.fore, angle: -10, duration: 300, delay: 150 });
  sc.tweens.add({ targets: a.armOff.root, angle: f.face * 48, duration: 300, delay: 150 });
  sc.tweens.add({ targets: a.armOff.fore, angle: -16, duration: 300, delay: 150 });
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
  // ---- THE WINNER'S POSE.
  //
  // This raised one arm by tweening `a.arm`, which stopped being a display
  // object when the elbow went in: the tween set `angle` on a plain rig and
  // the arm never moved.  Both shoulders go up now, both elbows straighten
  // into it, the head tips back, and whatever is still in the hand is held
  // overhead - which is the difference between winning and standing there.
  // -112 and not -150: past about -130 the shoulder carries the arm over the
  // top and whatever is in the hand ends up pointing backwards, off behind
  // him and away from the body on the sand.  This is a salute, held up and
  // slightly forward, with the blade where the crowd can see it.
  sc.tweens.add({ targets: a.arm.root, angle: -112, duration: 300, delay: 420, ease: 'Back.easeOut' });
  sc.tweens.add({ targets: a.arm.fore, angle: -26, duration: 300, delay: 420, ease: 'Back.easeOut' });
  sc.tweens.add({ targets: a.armOff.root, angle: -104, duration: 300, delay: 500, ease: 'Back.easeOut' });
  sc.tweens.add({ targets: a.armOff.fore, angle: -30, duration: 300, delay: 500, ease: 'Back.easeOut' });
  a.armOff.root.setVisible(true);
  a.root.bringToTop(a.armOff.root);
  sc.tweens.add({ targets: a.torso, angle: 0, duration: 260, delay: 420 });
  sc.tweens.add({ targets: a.cuirass, angle: 0, duration: 260, delay: 420 });
  sc.tweens.add({ targets: a.headGroup, y: -2, duration: 260, delay: 420 });
  // planted, feet apart, rather than caught mid-stride
  for (const leg of [a.legL, a.greaveL]) sc.tweens.add({ targets: leg, angle: -9, duration: 220, delay: 420 });
  for (const leg of [a.legR, a.greaveR]) sc.tweens.add({ targets: leg, angle: 9, duration: 220, delay: 420 });
  sc.time.delayedCall(560, () => {
    audio.sfx('zone_clear', 0.45);
    sc.tweens.add({ targets: a.root, y: FLOOR_Y - 11, duration: 190, yoyo: true, repeat: 3, ease: 'Quad.easeOut' });
    // ---- AND THE TAUNT.  Four hops with the arms pumping on the same beat,
    // because arms held still through a jump reads as a sprite being moved
    // up and down rather than as somebody enjoying themselves.
    sc.tweens.add({ targets: [a.arm.root, a.armOff.root], angle: -134, duration: 190, yoyo: true, repeat: 3, ease: 'Quad.easeOut' });
  });
  // the crowd comes up out of its seats
  crowd.forEach((r, i) => {
    sc.tweens.add({ targets: r, y: r.y - 3 - (i % 3), duration: 150 + (i % 5) * 28, yoyo: true, repeat: 6, delay: 520 + (i % 7) * 30 });
  });

  if (!won) return;
  // ---- THE REWARD.  Text, but not a box: it rises off him and goes.
  sc.time.delayedCall(700, () => {
    audio.sfx('cha_ching', 0.6);
    const gain = centerText(sc, a.root.x, FLOOR_Y - 46, `+${rewardFor(round)} TOKENS`, PALETTE.gold, 16).setDepth(61);
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
  // `win` carries the BANK rather than the cabinet's headline figure: the
  // run may have been one round or nine, and this is the only moment any of
  // it reaches the ledger.
  if (won) apiRef!.win(bank);
  else apiRef!.lose();
}

// =================================================================== module

export const frogsterMash: MinigameModule = {
  id: ID,
  title: 'FROGSTER MASH',
  music: 'game_frogstermash',
  rules: 'open four chests, then take it or risk it',
  tutorial: {
    objective: [
      // The card is 304px wide and the glyph advance is 6, so a centred line
      // has fifty characters before it runs out over the frame.  These were
      // 63, 59 and 59.
      'FOUR CHESTS: A WEAPON, AND ARMOUR FOR EACH SLOT.',
      'WHAT IS IN THE CHEST IS YOURS. NO SWAPS.',
      'THEN FROGGY FIGHTS. WIN ROUND ONE AND TAKE 50.',
      'TAKE IT, OR RISK IT ALL FOR 30, 35, 40 MORE...',
      'LOSE A ROUND AND THE WHOLE BANK GOES WITH IT.',
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
          round,
          bank,
          prize: rewardFor(round),
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
        /**
         * Put a weapon at a given share of its life and cut the marks NOW.
         *
         * `fray` plus a running fight was a race: at one swing off breaking
         * the weapon often broke inside the window, which resets the marks
         * with the sprite, so the harness read a clean blade and called the
         * wear marks missing.  This asks for the wear directly and does the
         * pass by hand, so what is wanted is what is measured.
         */
        wearTo: (who: 'frog' | 'lizard', frac: number) => {
          const f = who === 'frog' ? frog : lizard;
          if (!f || !Number.isFinite(f.dur)) return null;
          f.dur = durabilityOf(f.kit.weapon) * frac;
          wearWeapon(f);
          return f.art ? f.art.nicks : null;
        },
        /** What is lying on the sand, and who is going for it. */
        floor: () => ground.map((d) => ({ key: d.def.key, x: Math.round(d.x),
          life: +d.life.toFixed(1), settle: +d.settle.toFixed(2), drawn: !!d.art })),
        /**
         * Make this fighter throw what is in their hand, now.
         *
         * The decision to throw is deliberately hard to provoke -- it wants a
         * finish, a stagger, desperation -- so a harness that wants to watch
         * the throw itself cannot reliably arrange one by playing the game.
         * This is the throw with the deciding taken out, and nothing else:
         * the same `resolveStrike` runs, the weapon leaves the same way and
         * lands on the sand the same way.
         */
        hurl: (who: 'frog' | 'lizard') => {
          const f = who === 'frog' ? frog : lizard;
          const o = who === 'frog' ? lizard : frog;
          if (!f || !o) return null;
          const r = f.weapon.spec.ranged;
          if (!r || f.ammo <= 0) return null;
          // stand them at a distance this weapon can actually be thrown
          const want = Math.min(r.far - 6, f.st.reach + 24);
          o.x = Phaser.Math.Clamp(f.x + f.face * want, ARENA.left, ARENA.right);
          f.reload = 0;
          f.throwCool = 0;
          f.throwPlan = true;
          f.clock = Math.max(f.clock, OPENING_HOLD + 1);
          const blow = resolveStrike(f, o, Math.abs(f.x - o.x), Math.random, ground);
          return blow.loosed ? { kind: blow.loosed.kind, weapon: f.weapon.key, broken: f.broken } : null;
        },
        /** Knock the weapon out of a fighter's hand, to test the sequence. */
        disarm: (who: 'frog' | 'lizard') => {
          const f = who === 'frog' ? frog : lizard;
          if (!f) return null;
          const d = dropWeapon(f, ground);
          if (d) showDisarm(f, d);
          return d ? d.def.key : null;
        },
        /** How tall each fighter actually stands, measured off the rig. */
        height: (who: 'frog' | 'lizard') => {
          const f = who === 'frog' ? frog : lizard;
          if (!f?.art) return null;
          const b = f.art.root.getBounds();
          return { top: +b.top.toFixed(1), h: +(FLOOR_Y - b.top).toFixed(1), w: +b.width.toFixed(1) };
        },
        /** Where the first shot in the air has got to, for a flight test. */
        shot: (who: 'frog' | 'lizard') => {
          const f = who === 'frog' ? frog : lizard;
          const sh = f?.flight[0];
          if (!sh) return null;
          return { k: 1 - Math.max(0, sh.t) / sh.total, kind: sh.kind,
            x: sh.art?.x ?? 0, y: sh.art?.y ?? 0, from: sh.from, aim: sh.aim };
        },
        /**
         * EVERY SHOT THIS FIGHTER HAS IN THE AIR, with the size it is drawn at.
         *
         * `shot` only ever reported the first one's position, so neither "one
         * throw makes one projectile" nor "the projectile is the size of the
         * weapon" could be checked from outside at all.
         */
        flight: (who: 'frog' | 'lizard') => {
          const f = who === 'frog' ? frog : lizard;
          if (!f) return [];
          return f.flight.map((sh) => {
            const bb = sh.art?.getBounds();
            return {
              kind: sh.kind,
              /** The weapon it IS, when the thing flying is the weapon. */
              weapon: sh.weapon?.def.key ?? null,
              w: bb ? Math.round(bb.width * 100) / 100 : 0,
              h: bb ? Math.round(bb.height * 100) / 100 : 0,
              sx: sh.art ? Math.round(Math.abs(sh.art.scaleX) * 100) / 100 : 0,
              k: Math.round((1 - Math.max(0, sh.t) / sh.total) * 100) / 100,
            };
          });
        },
        /** How big this weapon is drawn in the HAND, to compare a throw against. */
        heldSize: (key: string, single = false) => {
          const w = buildWeapon(S(), key, PALETTE.cream, single);
          const bb = w.getBounds();
          const out = { w: Math.round(bb.width * 100) / 100, h: Math.round(bb.height * 100) / 100 };
          w.destroy();
          return out;
        },
        /** Put a named weapon in a live fighter's hand, to test one. */
        arm: (who: 'frog' | 'lizard', key: string) => {
          const f = who === 'frog' ? frog : lizard;
          const def = WEAPONS.find((w) => w.key === key);
          if (!f || !def) return false;
          f.kit = { ...f.kit, weapon: makeWeapon(def) };
          f.weapon = def;
          f.held = f.kit.weapon;
          f.broken = false;
          f.dur = durabilityOf(f.kit.weapon);
          f.ammo = def.spec.ranged?.ammo ?? 0;
          f.reload = 0;
          f.st = statsOf(f.kit, def, f.held, f.type);
          f.hp = Math.min(f.hp, f.st.maxHp);
          if (f.art) { f.art.weapon.destroy(); const w = buildWeapon(S(), def.key, f.who === 'frog' ? PALETTE.mossLight : PALETTE.amber);
            w.setPosition(f.art.arm.hand + 1, 0); f.art.arm.fore.add(w); f.art.weapon = w; f.art.nicks = 0; }
          return true;
        },
        /** Hold the fight still, and park the two apart, to read a pose. */
        freeze: (on: boolean) => { frozen = on; },
        park: (who: 'frog' | 'lizard', x: number) => {
          const f = who === 'frog' ? frog : lizard;
          if (!f) return;
          f.x = x;
          f.act = 'walk';
          f.move = null;
          // Stun counts down in the fight tick, and a parked fight is not
          // ticking -- so a fighter who happened to be reeling when the
          // harness froze the scene would hold the stunned arm angle for
          // ever, and every carry read about thirty degrees high.  Clearing
          // it is what makes "park and read the pose" mean anything.
          f.stun = 0;
          poseFighter(f, who === 'frog' ? lizard! : frog!);
        },
        /** Both arms' angles and visibility, so a stance can be asserted. */
        art: (who: 'frog' | 'lizard') => {
          const f = who === 'frog' ? frog : lizard;
          if (!f?.art) return null;
          return { arm: Math.round(f.art.arm.root.angle), off: Math.round(f.art.armOff.root.angle),
            elbow: Math.round(f.art.arm.fore.angle), offElbow: Math.round(f.art.armOff.fore.angle),
            guardUp: f.art.guardUp, armVis: f.art.arm.root.visible, offVis: f.art.armOff.root.visible,
            nicks: f.art.nicks, bodyAngle: Math.round(f.art.root.angle), pose: f.pose,
            helm: f.art.helm.visible, cuirass: f.art.cuirass.visible, greave: f.art.greaveL.visible,
            legL: f.art.legL.angle, legR: f.art.legR.angle };
        },
        /** Take one piece of armour off, the way a blow eventually would. */
        strip: (who: 'frog' | 'lizard') => {
          const f = who === 'frog' ? frog : lizard;
          if (!f) return null;
          for (let i = 0; i < 200; i++) {
            const off = wearArmour(f);
            if (off) { showStrip(f, off.slot, off.tint); return off.slot; }
          }
          return null;
        },
        /** The rules and the headless simulator, so a build can be checked. */
        rules: { WEAPONS, MATERIALS, UNARMED, QUALITY_MUL, statsOf, makeFighter, resolveStrike, tick, think, exchange, simulate, randomKit, offerFor, makeWeapon, makeArmour, breakWeapon, durabilityOf, wrapTo, CARD_COLS, BASE, LIZARDS, makeLizard, buildFighter, buildWeapon, rewardFor, armourLife, wearArmour, MOVES, dropWeapon, takeWeapon, landShot },
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
      if (phase === 'fight' && !frozen) stepFight(dt);
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
    hp: Math.max(0, f.hp), maxHp: f.st.maxHp, x: Math.round(f.x), act: f.act, move: f.move?.name ?? null,
    weapon: f.weapon.key, broken: f.broken, gone: { ...f.gone },
    // how many blades of a pair are left, and which end-of-fight pose the rig
    // has been handed over to -- both are asserted by the games suite
    single: f.single, spares: f.spares, pose: f.pose,
    seeking: f.seeking ? f.seeking.def.key : null,
    ammo: Number.isFinite(f.ammo) ? f.ammo : -1, flight: f.flight.length, reload: +f.reload.toFixed(2),
    wear: { head: Math.max(0, Math.round(f.wear.head)), body: Math.max(0, Math.round(f.wear.body)), legs: Math.max(0, Math.round(f.wear.legs)) }, dur: Number.isFinite(f.dur) ? f.dur : -1,
    power: +f.st.power.toFixed(2), rate: +f.st.rate.toFixed(2), walk: +f.st.walk.toFixed(1),
    avoid: +f.st.avoid.toFixed(3), defence: +f.st.defence.toFixed(3), reach: f.st.reach, range: f.st.range,
    // drawing state, exposed so a test can prove it never reaches `x`
    shove: +f.shove.toFixed(2), drawX: Math.round(drawX(f, f.who === 'frog' ? lizard ?? undefined : frog ?? undefined)),
  };
}
