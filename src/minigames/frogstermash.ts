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
 * One weapon, and the behaviour that comes with it.
 *
 * Every number here is read by the simulation and nothing else, which is why
 * a weapon's "behaviour" is not a special case anywhere: an axe swings slowly
 * and hits hard because `rate` is low and `power` is high, and a staff keeps
 * its distance because `range` is thirty.  Changing a row changes how that
 * weapon fights, and changes nothing else in the game.
 *
 *   power   damage a single strike is worth
 *   rate    strikes a second before heaviness is taken off it
 *   reach   how far away a strike can still connect, in pixels
 *   range   the distance this weapon WANTS to fight at
 *   heavy   0..1, taken off movement and off the swing
 *   dur     strikes it survives before it can break
 *   hits    strikes in one swing (dual swords and nunchucks throw two)
 *   guard   damage it turns aside while simply being held (the shield)
 */
export interface WeaponDef {
  key: string;
  name: string;
  power: number;
  rate: number;
  reach: number;
  range: number;
  heavy: number;
  dur: number;
  hits: number;
  guard: number;
}

// The power column is not hand-picked.  Each weapon was run head to head
// against all twelve others over identical armour and its power nudged toward
// an even split, twelve passes, until the worst weapon in the rack sat within
// a few points of fifty percent.  That is why reach is expensive here: the
// scythe swings at twelve and the axe -- heavier still, at two thirds the
// reach -- at twenty.  Change reach or rate and the power beside it is stale -- re-run the
// sweep rather than guessing at a new one.  The two-hit weapons -- dual
// swords and nunchucks -- move about twice as far per point as the rest,
// because every point is paid out on both blows; nudge those in fractions.
export const WEAPONS: WeaponDef[] = [
  // ---- fast and close.  These win by volume and lose to anything with reach.
  { key: 'dagger', name: 'DAGGER', power: 8, rate: 2.6, reach: 12, range: 13, heavy: 0.05, dur: 26, hits: 1, guard: 0 },
  { key: 'knife', name: 'TAC KNIFE', power: 9, rate: 2.4, reach: 13, range: 14, heavy: 0.05, dur: 24, hits: 1, guard: 0 },
  { key: 'knuckles', name: 'KNUCKLES', power: 5, rate: 3.2, reach: 9, range: 10, heavy: 0.02, dur: 44, hits: 1, guard: 0 },
  // ---- the balanced middle
  { key: 'sword', name: 'SWORD', power: 9.5, rate: 1.5, reach: 20, range: 20, heavy: 0.28, dur: 34, hits: 1, guard: 0 },
  // The sword and the katana were the same weapon on paper -- same power, same
  // rate -- with the katana longer AND lighter, so there was never a reason to
  // want the sword.  The sword is the sturdier of the two now (the harder blow
  // and six more swings in it) and the katana keeps the reach and the lightness.
  { key: 'katana', name: 'KATANA', power: 9, rate: 1.5, reach: 23, range: 22, heavy: 0.24, dur: 28, hits: 1, guard: 0 },
  // ---- twice the strikes, half the weight behind each
  { key: 'dual', name: 'DUAL SWORDS', power: 4.8, rate: 2.0, reach: 19, range: 19, heavy: 0.24, dur: 26, hits: 2, guard: 0 },
  { key: 'nunchuck', name: 'NUNCHUCKS', power: 5.4, rate: 2.3, reach: 16, range: 16, heavy: 0.08, dur: 22, hits: 2, guard: 0 },
  // ---- slow and enormous
  { key: 'axe', name: 'AXE', power: 20, rate: 0.8, reach: 19, range: 18, heavy: 0.6, dur: 34, hits: 1, guard: 0 },
  { key: 'goldsword', name: 'GOLD SWORD', power: 16, rate: 1.0, reach: 20, range: 20, heavy: 0.82, dur: 36, hits: 1, guard: 0 },
  // ---- reach, which is its own kind of defence
  { key: 'staff', name: 'LONG STICK', power: 8, rate: 1.35, reach: 30, range: 30, heavy: 0.18, dur: 32, hits: 1, guard: 0 },
  { key: 'flail', name: 'BALL & CHAIN', power: 15, rate: 0.75, reach: 28, range: 26, heavy: 0.55, dur: 30, hits: 1, guard: 0 },
  { key: 'scythe', name: 'SCYTHE', power: 12, rate: 0.85, reach: 31, range: 29, heavy: 0.5, dur: 28, hits: 1, guard: 0 },
  // ---- the one that would rather not be hit at all
  { key: 'shield', name: 'SPIKED SHIELD', power: 5.4, rate: 1.2, reach: 12, range: 13, heavy: 0.45, dur: 46, hits: 1, guard: 0.3 },
];

/**
 * WHAT IS LEFT WHEN A WEAPON BREAKS.
 *
 * Deliberately worse than the worst thing in a chest: losing a weapon has to
 * be a thing that happened to you, not a tactic.  It cannot break again.
 */
export const UNARMED: WeaponDef = {
  key: 'fists', name: 'BARE HANDS', power: 3, rate: 2.0, reach: 8, range: 9, heavy: 0, dur: Infinity, hits: 1, guard: 0,
};

/** The materials armour comes in.  Protection costs weight, every time. */
export interface ArmourMat {
  key: string;
  name: string;
  prot: number;
  heavy: number;
  colour: number;
  edge: number;
}
export const MATERIALS: ArmourMat[] = [
  { key: 'cloth', name: 'CLOTH', prot: 1, heavy: 0.03, colour: 0xc9a86a, edge: 0x8a6f3c },
  { key: 'leather', name: 'LEATHER', prot: 2, heavy: 0.07, colour: 0x9c7248, edge: 0x5d4028 },
  { key: 'hide', name: 'HIDE', prot: 3, heavy: 0.11, colour: 0x7d6a4a, edge: 0x4b3d28 },
  { key: 'chain', name: 'CHAINMAIL', prot: 4, heavy: 0.17, colour: 0x8e9cad, edge: 0x4a5665 },
  { key: 'iron', name: 'IRON', prot: 6, heavy: 0.25, colour: 0x6f7682, edge: 0x3a4149 },
  { key: 'steel', name: 'STEEL PLATE', prot: 8, heavy: 0.34, colour: 0xb8c0cb, edge: 0x5d6673 },
  { key: 'gold', name: 'GOLD PLATE', prot: 7, heavy: 0.4, colour: 0xffd45e, edge: 0xa8801e },
];

/** How much of a material's protection and weight a slot actually carries. */
const SLOT_BULK: Record<'head' | 'body' | 'legs', number> = { head: 0.7, body: 1.25, legs: 0.85 };
const PIECE_NAME: Record<'head' | 'body' | 'legs', string> = { head: 'HELM', body: 'CUIRASS', legs: 'GREAVES' };

/** 1..5, and what it multiplies.  Kept from the first build of this cabinet. */
export const QUALITY_MUL = [0, 0.8, 0.9, 1.0, 1.1, 1.2];

export interface Piece {
  slot: Slot;
  /** 1..5, shown on the chest and folded into what the piece is worth. */
  quality: number;
  name: string;
  /** Weapons only. */
  weapon?: WeaponDef;
  /** Armour only. */
  mat?: ArmourMat;
  prot: number;
  heavy: number;
}

export function makeWeapon(def: WeaponDef, quality: number): Piece {
  return { slot: 'weapon', quality, name: def.name, weapon: def, prot: 0, heavy: def.heavy };
}

export function makeArmour(slot: 'head' | 'body' | 'legs', mat: ArmourMat, quality: number): Piece {
  const bulk = SLOT_BULK[slot];
  return {
    slot,
    quality,
    name: `${mat.name} ${PIECE_NAME[slot]}`,
    mat,
    // Quality lifts what it STOPS and not what it weighs: a better helm is a
    // better helm, not a lighter one.
    prot: mat.prot * bulk * QUALITY_MUL[quality],
    heavy: mat.heavy * bulk,
  };
}

// ================================================================== fighters

/** Health before any armour is put on, and what a point of protection adds. */
const BASE_HP = 90;
// Small on purpose.  Protection already cuts damage; if it bought a big pool
// of health as well it would be paid for twice and plate would be the only
// answer to anything.
const HP_PER_PROT = 2.2;
/** Walking pace in px/s before weight comes off it. */
const BASE_WALK = 46;
/** The chance of simply not being where a strike landed, before weight. */
const BASE_AVOID = 0.3;

export interface Kit {
  weapon: Piece;
  head: Piece;
  body: Piece;
  legs: Piece;
}

export interface Stats {
  /** Damage one strike is worth, with the weapon's quality in it. */
  power: number;
  /** Strikes a second, with weight taken off. */
  rate: number;
  walk: number;
  avoid: number;
  prot: number;
  maxHp: number;
  reach: number;
  range: number;
  guard: number;
}

/**
 * What a kit is worth, and the only place equipment turns into numbers.
 *
 * Weight is the spine of it.  A heavy weapon slows the swing AND the walk; a
 * heavy suit slows the walk AND takes the edge off avoiding anything.  That
 * is why the biggest weapon in the game is not simply the best one: it buys
 * damage with the two things that get damage delivered.
 */
export function statsOf(kit: Kit, weapon: WeaponDef, wq: number): Stats {
  const suit = kit.head.heavy + kit.body.heavy + kit.legs.heavy;
  const load = suit + weapon.heavy;
  const prot = kit.head.prot + kit.body.prot + kit.legs.prot;
  return {
    power: weapon.power * QUALITY_MUL[wq],
    rate: Math.max(0.35, weapon.rate * (1 - weapon.heavy * 0.3) * (1 - suit * 0.22)),
    walk: Math.max(14, BASE_WALK * (1 - load * 0.38)),
    avoid: Math.max(0.05, BASE_AVOID - suit * 0.2),
    prot,
    maxHp: Math.round(BASE_HP + prot * HP_PER_PROT),
    reach: weapon.reach,
    range: weapon.range,
    guard: weapon.guard,
  };
}

type Act = 'walk' | 'windup' | 'strike' | 'recover' | 'dodge' | 'guard';

export interface Fighter {
  who: 'frog' | 'lizard';
  kit: Kit;
  /** The weapon actually in hand: the kit's, until it breaks. */
  weapon: WeaponDef;
  /** The quality of the weapon in hand.  Bare hands are quality three. */
  wq: number;
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
  /** Seconds of being knocked about: it cannot act, and it shows. */
  stun: number;
  /** Walk cycle, so the legs move when it does. */
  step: number;
  art: FighterArt | null;
}

export function makeFighter(who: 'frog' | 'lizard', kit: Kit, x: number, face: 1 | -1): Fighter {
  const w = kit.weapon.weapon!;
  const st = statsOf(kit, w, kit.weapon.quality);
  return {
    who, kit, weapon: w, wq: kit.weapon.quality, broken: false, dur: w.dur, st,
    hp: st.maxHp, x, face, act: 'walk', t: 0, cool: 0.4, swing: 0, stun: 0, step: 0, art: null,
  };
}

/** A weapon gives out.  Everything it was worth goes with it; the armour stays. */
export function breakWeapon(f: Fighter): void {
  f.broken = true;
  f.weapon = UNARMED;
  f.wq = 3;
  f.dur = Infinity;
  f.st = statsOf(f.kit, UNARMED, 3);
  // Health is not re-rolled: the armour is still on, and it is the armour that
  // health comes from.  Only the cap moves, and it moves nowhere, because
  // `maxHp` is made of protection and protection did not change.
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
/** Below this share of health a fighter starts looking after itself. */
const HURT_AT = 0.35;
/**
 * How long the result stands before the machine returns to the arcade itself.
 *
 * A win gets the longer look: there is a reward counting up on it, and the
 * shell adds its own couple of seconds on top before the room fades back.
 */
const OVER_WIN_MS = 4200;
const OVER_LOSE_MS = 3200;
/** Two fighters are never drawn closer than this, whatever the rules say. */
const BODY_CLEAR = 26;
/** How long the kit sheet stays up before the walk-on starts by itself. */
const SUMMARY_MS = 4200;
/** Inside this share of its own reach, a weapon is being swung wrong, */
const INSIDE_FRAC = 0.55;
/** down to this much of its power at nose-to-nose. */
const INSIDE_MIN = 0.25;
/** How much protection it takes to halve incoming damage. */
const PROT_SOFT = 16;
/** The arena's two walls, in the fighters' own coordinates. */
export const ARENA = { left: 26, right: GAME_W - 26 };

export interface Blow {
  hit: boolean;
  dodged: boolean;
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
  // A share is the same cut whatever is swinging: `prot / (prot + PROT_SOFT)`
  // is 20% for a light suit and 45% for the heaviest in the game, and it
  // leaves a dagger a dagger.
  out.hit = true;
  const cut = 1 - def.st.prot / (def.st.prot + PROT_SOFT);
  out.dmg = Math.max(1, Math.round(raw * cut * (1 - soak)));
  def.hp = Math.max(0, def.hp - out.dmg);
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

  // ---- SWINGING.  In reach, off cooldown, go.
  if (gap <= f.st.reach && f.cool <= 0) {
    f.act = 'windup';
    f.t = WINDUP / f.st.rate;
    f.swing = 0;
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
    case 'strike':
      // A weapon that throws two puts the second one in without a fresh
      // wind-up, which is what "rapid, multiple strikes" actually feels like.
      if (f.swing < f.weapon.hits) {
        f.t = STRIKE;
        const blow = resolveStrike(f, other, Math.abs(f.x - other.x), rng);
        f.swing += 1;
        return blow;
      }
      f.act = 'recover';
      f.t = RECOVER / f.st.rate;
      return null;
    case 'recover':
      f.act = 'walk';
      f.cool = BEAT / f.st.rate;
      return null;
    default:
      f.act = 'walk';
      return null;
  }
}

/**
 * A whole fight, with nothing drawn.
 *
 * The scene runs the same two calls a frame; this runs them as fast as it can
 * with a fixed step, so a build can be checked over ten thousand fights
 * instead of watched once.  `cap` is there because two fighters in full plate
 * with bare hands can genuinely stand there all day.
 */
export function simulate(a: Kit, bKit: Kit, rng = Math.random, cap = 180): { winner: 'frog' | 'lizard' | null; seconds: number; breaks: number } {
  const f = makeFighter('frog', a, 100, 1);
  const l = makeFighter('lizard', bKit, 220, -1);
  const dt = 1 / 60;
  let t = 0;
  let breaks = 0;
  while (t < cap && f.hp > 0 && l.hp > 0) {
    for (const [x, y] of [[f, l], [l, f]] as const) {
      const blow = tick(x, y, dt, rng);
      if (blow?.broke) breaks++;
    }
    t += dt;
  }
  return { winner: f.hp <= 0 ? 'lizard' : l.hp <= 0 ? 'frog' : null, seconds: t, breaks };
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
}

const FLOOR_Y = 138;

/** The weapon itself, drawn in the hand, pointing along +x. */
function buildWeapon(scene: Phaser.Scene, key: string, tint: number): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const bar = (x: number, y: number, w: number, h: number, col: number, ang = 0): void => {
    c.add(scene.add.rectangle(x, y, w, h, col).setAngle(ang));
  };
  const steel = 0xc6ced9;
  const wood = 0x7a5a36;
  switch (key) {
    case 'dagger': bar(5, 0, 9, 2, steel); bar(0, 0, 3, 5, wood); break;
    case 'knife': bar(6, -1, 10, 2, steel); bar(0, 0, 4, 4, PALETTE.slate); break;
    case 'knuckles': bar(2, 0, 5, 5, tint); bar(4, -2, 5, 1.5, steel); break;
    case 'sword': bar(12, 0, 22, 2.5, steel); bar(1, 0, 2, 8, PALETTE.gold); bar(-2, 0, 4, 3, wood); break;
    case 'katana': bar(13, -2, 25, 2, steel, -6); bar(0, 0, 3, 7, PALETTE.ink); break;
    case 'dual':
      bar(11, -4, 19, 2, steel, -12); bar(11, 4, 19, 2, steel, 12);
      bar(0, -3, 3, 5, wood); bar(0, 3, 3, 5, wood);
      break;
    case 'nunchuck':
      bar(3, -3, 8, 3, wood, -30); bar(9, 4, 8, 3, wood, 40);
      bar(6, 0, 4, 1, steel);
      break;
    case 'axe': bar(8, 0, 16, 2.5, wood); bar(16, -1, 8, 9, steel); bar(16, -1, 8, 2, PALETTE.bone); break;
    case 'goldsword': bar(12, 0, 23, 4, PALETTE.gold); bar(12, -1, 23, 1.5, PALETTE.cream); bar(1, 0, 3, 10, PALETTE.amberDark); break;
    case 'staff': bar(10, 0, 34, 3, wood); bar(26, 0, 4, 4, PALETTE.bone); bar(-6, 0, 4, 4, PALETTE.bone); break;
    case 'flail': bar(6, 0, 12, 2, wood); bar(16, 0, 8, 1, PALETTE.fog); c.add(scene.add.circle(24, 0, 5, PALETTE.steel)); bar(24, 0, 12, 1.5, PALETTE.bone); bar(24, 0, 1.5, 12, PALETTE.bone); break;
    case 'scythe': bar(12, 0, 26, 2.5, wood); bar(26, -6, 12, 2.5, steel, -28); bar(30, -11, 8, 2, steel, -62); break;
    default: // spiked shield
      c.add(scene.add.circle(4, 0, 9, PALETTE.steel));
      c.add(scene.add.circle(4, 0, 5, PALETTE.fog));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        bar(4 + Math.cos(a) * 10, Math.sin(a) * 10, 4, 1.6, PALETTE.bone, (a * 180) / Math.PI);
      }
      break;
  }
  return c;
}

/** One fighter, wearing what the chests gave it. */
export function buildFighter(scene: Phaser.Scene, f: Fighter): FighterArt {
  const frog = f.who === 'frog';
  const skin = frog ? PALETTE.moss : 0x8a9a3c;
  const light = frog ? PALETTE.mossLight : PALETTE.amber;
  const H = f.kit.head.mat!;
  const B = f.kit.body.mat!;
  const L = f.kit.legs.mat!;

  const legL = scene.add.rectangle(-4, -2, 4, 11, skin).setOrigin(0.5, 1);
  const legR = scene.add.rectangle(4, -2, 4, 11, skin).setOrigin(0.5, 1);
  const greaveL = scene.add.rectangle(-4, -3, 6, 7, L.colour).setOrigin(0.5, 1).setStrokeStyle(1, L.edge);
  const greaveR = scene.add.rectangle(4, -3, 6, 7, L.colour).setOrigin(0.5, 1).setStrokeStyle(1, L.edge);
  const footL = scene.add.rectangle(-5, 0, 7, 2, light).setOrigin(0.5, 1);
  const footR = scene.add.rectangle(5, 0, 7, 2, light).setOrigin(0.5, 1);
  // A lizard has a tail and a crest; a frog has neither.  At this size that is
  // the whole of telling them apart.
  const tail = frog ? null : scene.add.triangle(-9, -15, 0, 0, 15, 4, 0, 9, skin).setOrigin(0.5, 0.5).setAngle(18);

  const torso = scene.add.ellipse(0, -19, frog ? 18 : 15, 19, skin);
  const cuirass = scene.add.rectangle(0, -19, frog ? 17 : 15, 15, B.colour).setStrokeStyle(1, B.edge);
  const strap = scene.add.rectangle(0, -23, frog ? 17 : 15, 2, B.edge);

  const head = scene.add.ellipse(2, -32, frog ? 15 : 12, 12, light);
  const snout = frog ? scene.add.ellipse(7, -30, 5, 4, light) : scene.add.ellipse(9, -31, 9, 6, light);
  const eyeL = scene.add.circle(-1, -35, 3, PALETTE.cream);
  const eyeR = scene.add.circle(5, -35, 3, PALETTE.cream);
  const pupL = scene.add.circle(0, -35, 1.4, PALETTE.black);
  const pupR = scene.add.circle(6, -35, 1.4, PALETTE.black);
  const helm = scene.add.rectangle(2, -38, frog ? 16 : 13, 7, H.colour).setStrokeStyle(1, H.edge);
  const crest = frog ? null : scene.add.triangle(0, -42, 0, 6, 4, 0, 8, 6, PALETTE.rust);

  // ---- the arm and the weapon, on one hinge at the shoulder
  const arm = scene.add.container(5, -24);
  arm.add(scene.add.rectangle(5, 0, 11, 4, skin).setOrigin(0.5, 0.5));
  arm.add(scene.add.circle(10, 0, 3, light));
  const weapon = buildWeapon(scene, f.weapon.key, light);
  weapon.setPosition(11, 0);
  arm.add(weapon);

  const parts: Phaser.GameObjects.GameObject[] = [footL, footR, legL, legR, greaveL, greaveR];
  if (tail) parts.push(tail);
  parts.push(torso, cuirass, strap, arm, head, snout, helm, eyeL, eyeR, pupL, pupR);
  if (crest) parts.push(crest);
  const root = scene.add.container(f.x, FLOOR_Y, parts).setDepth(20);
  root.setScale(f.face, 1);
  return { root, legL, legR, greaveL, greaveR, torso, cuirass, head, helm, arm, weapon };
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
  if (!other) return f.x;
  const gap = Math.abs(f.x - other.x);
  if (gap >= BODY_CLEAR) return f.x;
  const mid = (f.x + other.x) / 2;
  return mid + (f.x <= other.x ? -1 : 1) * (BODY_CLEAR / 2);
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
  if (f.stun > 0) { arm = 24; lean = 12; }
  a.arm.setAngle(arm);
  a.torso.setAngle(lean);
  a.cuirass.setAngle(lean);
  a.head.y = -32 + (f.act === 'dodge' ? 4 : 0);
  a.helm.y = -38 + (f.act === 'dodge' ? 4 : 0);
}

/** The colosseum: sand, two tiers of arches, and a crowd that never stops. */
function buildArena(scene: Phaser.Scene, c: Phaser.GameObjects.Container): Phaser.GameObjects.Rectangle[] {
  c.add(scene.add.rectangle(0, 18, GAME_W, 162, 0x2b2118).setOrigin(0, 0));
  // the far wall, in two storeys of arch
  c.add(scene.add.rectangle(0, 20, GAME_W, 68, 0x6b5b45).setOrigin(0, 0));
  c.add(scene.add.rectangle(0, 20, GAME_W, 4, 0x8a7657).setOrigin(0, 0));
  for (let tier = 0; tier < 2; tier++) {
    const y = 26 + tier * 32;
    for (let i = 0; i < 8; i++) {
      const x = 8 + i * 40;
      c.add(scene.add.rectangle(x, y, 26, 26, 0x2e2418).setOrigin(0, 0));
      c.add(scene.add.ellipse(x + 13, y, 26, 16, 0x2e2418));
      c.add(scene.add.rectangle(x + 12, y, 2, 26, 0x4a3c2a).setOrigin(0, 0));
    }
  }
  // the crowd, packed into the dark of the arches
  const crowd: Phaser.GameObjects.Rectangle[] = [];
  for (let i = 0; i < 96; i++) {
    const x = 6 + (i % 48) * 6.6;
    const y = 30 + Math.floor(i / 48) * 32 + (i % 3);
    const r = scene.add.rectangle(x, y, 3, 4, [0xb8724a, 0xd8a06a, 0x8a5a3a, 0xe0c090][i % 4]).setAlpha(0.85);
    c.add(r);
    crowd.push(r);
  }
  // the sand, and the line the fighters stand on
  c.add(scene.add.rectangle(0, 88, GAME_W, 92, 0xd9b877).setOrigin(0, 0));
  c.add(scene.add.rectangle(0, 88, GAME_W, 3, 0xb8955a).setOrigin(0, 0));
  for (let i = 0; i < 60; i++) {
    c.add(scene.add.rectangle(Math.random() * GAME_W, 94 + Math.random() * 78, 2, 1, 0xc2a066).setAlpha(0.7));
  }
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

type Phase = 'title' | 'pick' | 'summary' | 'entry' | 'fight' | 'over';

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
  buttons = [];
}

function newLayer(): Phaser.GameObjects.Container {
  layer?.destroy(true);
  for (const b of buttons) b.destroy();
  buttons = [];
  layer = S().add.container(0, 0);
  chests = [];
  panelText = [];
  crowd = [];
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
  if (slot === 'weapon') return shuffled(WEAPONS).slice(0, 5).map((w) => makeWeapon(w, 1 + rnd(5)));
  return shuffled(MATERIALS).slice(0, 5).map((m) => makeArmour(slot, m, 1 + rnd(5)));
}

/** A kit rolled the same way the chests are, for the lizard. */
export function randomKit(): Kit {
  return {
    weapon: makeWeapon(WEAPONS[rnd(WEAPONS.length)], 1 + rnd(5)),
    head: makeArmour('head', MATERIALS[rnd(MATERIALS.length)], 1 + rnd(5)),
    body: makeArmour('body', MATERIALS[rnd(MATERIALS.length)], 1 + rnd(5)),
    legs: makeArmour('legs', MATERIALS[rnd(MATERIALS.length)], 1 + rnd(5)),
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
  c.add(text(S(), 6, 22, `CHEST ${n + 1} OF 4`, PALETTE.ash));
  c.add(centerText(S(), GAME_W / 2, 27, SLOT_NAME[slot], PALETTE.gold, 16));
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
    const piece = offer[i];
    box.add(S().add.rectangle(0, 0, CHEST_W, CHEST_H, 0x6b4a2f).setStrokeStyle(1, PALETTE.gold));
    box.add(S().add.rectangle(0, -CHEST_H / 2 + 7, CHEST_W - 2, 12, 0x8a6138));
    box.add(S().add.rectangle(0, -CHEST_H / 2 + 13, CHEST_W, 2, 0x3f2a18));
    box.add(S().add.rectangle(0, 2, 8, 9, PALETTE.gold));
    box.add(centerText(S(), 0, CHEST_H / 2 - 6, `Q${piece.quality}`, PALETTE.cream));
    box.setSize(CHEST_W, CHEST_H).setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => {
      if (phase !== 'pick') return;
      if (hi === i) take(i);
      else highlight(i);
    });
    chests.push(box);
    c.add(box);
    S().tweens.add({
      targets: box,
      y: CHEST_Y,
      duration: 340,
      delay: i * 70,
      ease: 'Bounce.easeOut',
      onComplete: () => audio.sfx('item_thud', 0.3),
    });
  }
  c.add(centerText(S(), GAME_W / 2, 171, '[<-] [->] INSPECT   [SPACE] OPEN IT', PALETTE.ash));
  highlight(0, true);
}

function redrawPreview(): void {
  if (!previewC) return;
  previewC.removeAll(true);
  // Only ever drawn with what has actually been taken; the rest is bare frog.
  const kit: Kit = {
    weapon: picked.weapon ?? makeWeapon(UNARMED, 3),
    head: picked.head ?? makeArmour('head', MATERIALS[0], 1),
    body: picked.body ?? makeArmour('body', MATERIALS[0], 1),
    legs: picked.legs ?? makeArmour('legs', MATERIALS[0], 1),
  };
  const ghost = makeFighter('frog', kit, 0, 1);
  const art = buildFighter(S(), ghost);
  art.root.setPosition(0, 0);
  art.root.setDepth(0);
  // Anything not chosen yet is drawn faint, so the preview never claims the
  // player owns something they have not opened.
  if (!picked.head) art.helm.setAlpha(0.15);
  if (!picked.body) art.cuirass.setAlpha(0.15);
  if (!picked.legs) { art.greaveL.setAlpha(0.15); art.greaveR.setAlpha(0.15); }
  if (!picked.weapon) art.weapon.setAlpha(0.15);
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
  showCard(offer[i]);
}

/** Everything the chest is worth, spelled out before it is opened. */
function showCard(p: Piece | undefined): void {
  if (!p) return;
  const lines: string[] = [];
  if (p.weapon) {
    const w = p.weapon;
    panelChip?.setFillStyle(PALETTE.bone);
    lines.push(
      `${w.name}   QUALITY ${p.quality} (x${QUALITY_MUL[p.quality].toFixed(2)})`,
      `POWER  ${(w.power * QUALITY_MUL[p.quality]).toFixed(1)}    SPEED ${w.rate.toFixed(2)}/S`,
      `REACH  ${w.reach}px     RANGE ${w.range}px`,
      `WEIGHT ${w.heavy.toFixed(2)}   LASTS ${w.dur} SWINGS`,
      w.hits > 1 ? `${w.hits} STRIKES A SWING` : w.guard > 0 ? `GUARDS ${(w.guard * 100) | 0}% WHILE HELD` : '',
      WEAPON_NOTE[w.key] ?? '',
      '',
    );
  } else {
    const m = p.mat!;
    panelChip?.setFillStyle(m.colour);
    lines.push(
      `${p.name}`,
      `QUALITY ${p.quality}  (x${QUALITY_MUL[p.quality].toFixed(2)})`,
      `PROTECTION ${p.prot.toFixed(2)}`,
      `WEIGHT     ${p.heavy.toFixed(2)}`,
      'PROTECTION STOPS DAMAGE AND ADDS HEALTH',
      'WEIGHT COSTS SPEED AND AVOIDANCE',
      '',
    );
  }
  panelText.forEach((t, i) => t.setText(lines[i] ?? '').setTint(i === 0 ? PALETTE.gold : i >= 4 ? PALETTE.ash : PALETTE.cream));
}

/** What each weapon does, in one line, because the numbers do not say it. */
const WEAPON_NOTE: Record<string, string> = {
  dagger: 'FAST, AND ONLY WORKS UP CLOSE',
  knife: 'FAST, AND ONLY WORKS UP CLOSE',
  knuckles: 'THE FASTEST THING HERE. NO REACH AT ALL',
  sword: 'BALANCED. GOOD AT NOTHING, BAD AT NOTHING',
  katana: 'BALANCED, WITH A LITTLE MORE REACH',
  dual: 'TWO STRIKES A SWING, LIGHTER EACH',
  nunchuck: 'TWO FAST STRIKES, NEITHER OF THEM HEAVY',
  axe: 'SLOW AND ENORMOUS',
  goldsword: 'THE HARDEST HIT IN THE GAME, AND THE SLOWEST',
  staff: 'KEEPS ITS DISTANCE AND NEVER LETS YOU IN',
  flail: 'LONG, HEAVY, AND SLOW TO COME ROUND',
  scythe: 'LONG REACH AND A BIG HIT, BUT SLOW',
  shield: 'TURNS BLOWS ASIDE WHILE IT IS HELD',
};

function take(i: number): void {
  if (phase !== 'pick') return;
  const piece = offer[i];
  if (!piece) return;
  // ---- OPENED, AND THAT IS THAT.  There is no putting it back.
  picked[piece.slot] = piece;
  audio.sfx('ui_blip', 0.6);
  audio.sfx('vault', 0.45);
  const box = chests[i];
  if (box) S().tweens.add({ targets: box, scaleX: 1.3, scaleY: 1.3, alpha: 0, duration: 260 });
  redrawPreview();
  phase = 'title'; // a holding state: nothing reads the chests while they swap
  S().time.delayedCall(320, () => {
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
  c.add(S().add.rectangle(px, 40, GAME_W - px - 6, 92, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel));
  const rows: Array<[string, string, number]> = [
    ['WEAPON', kit.weapon.name, PALETTE.bone],
    ['POWER', frog.st.power.toFixed(1), PALETTE.ember],
    ['SPEED', `${frog.st.rate.toFixed(2)}/S`, PALETTE.gold],
    ['AVOIDANCE', `${Math.round(frog.st.avoid * 100)}%`, PALETTE.tealLight],
    ['PROTECTION', frog.st.prot.toFixed(1), PALETTE.fog],
    ['HEALTH', String(frog.st.maxHp), PALETTE.mossLight],
  ];
  rows.forEach(([k, v, col], i) => {
    c.add(text(S(), px + 7, 46 + i * 13, k, PALETTE.ash));
    c.add(text(S(), GAME_W - 13, 46 + i * 13, v, col).setOrigin(1, 0));
  });
  c.add(centerText(S(), GAME_W / 2, 140, `${kit.head.name}  -  ${kit.body.name}  -  ${kit.legs.name}`, PALETTE.ash));
  // The last decision the player made was the fourth chest.  This is a sheet
  // to read, not a thing to answer, so it goes on its own -- the button only
  // skips the wait for anyone who has finished reading.  `showEntry` guards on
  // the phase, so the click and the timer cannot both fire it.
  buttons.push(button(S(), GAME_W / 2, 160, 'TO THE COLOSSEUM', showEntry, { width: 140, height: 15, fill: PALETTE.blood }));
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

function buildHud(c: Phaser.GameObjects.Container): void {
  const bar = (x: number, who: 'frog' | 'lizard', label: string, colour: number, kit: Kit): void => {
    c.add(text(S(), x, 22, label, PALETTE.cream).setDepth(41));
    c.add(S().add.rectangle(x, 32, 130, 7, PALETTE.black, 0.75).setOrigin(0, 0).setDepth(40));
    hpBar[who] = S().add.rectangle(x + 1, 33, 128, 5, colour).setOrigin(0, 0).setDepth(41);
    c.add(hpBar[who]!);
    hpNum[who] = text(S(), x + 130, 22, '', colour).setOrigin(1, 0).setDepth(41);
    c.add(hpNum[who]!);
    // the little status panel: what it is holding and what it is wearing
    kitLine[who] = text(S(), x, 41, '', PALETTE.bone).setDepth(41);
    c.add(kitLine[who]!);
    c.add(text(S(), x, 50, `${kit.head.mat!.name[0]}${kit.body.mat!.name[0]}${kit.legs.mat!.name[0]} PROT ${(kit.head.prot + kit.body.prot + kit.legs.prot).toFixed(1)}`, PALETTE.ash).setDepth(41));
  };
  bar(8, 'frog', 'FROGGY', PALETTE.mossLight, frog!.kit);
  bar(GAME_W - 138, 'lizard', 'LIZARD', PALETTE.amber, lizard!.kit);
  refreshHud();
}

function refreshHud(): void {
  for (const who of ['frog', 'lizard'] as const) {
    const f = who === 'frog' ? frog! : lizard!;
    const b = hpBar[who];
    if (b) b.width = Math.max(0, Math.round((Math.max(0, f.hp) / f.st.maxHp) * 128));
    hpNum[who]?.setText(`${Math.max(0, f.hp)} / ${f.st.maxHp}`);
    kitLine[who]?.setText(f.broken ? 'BARE HANDS (BROKEN)' : f.weapon.name).setTint(f.broken ? PALETTE.blood : PALETTE.bone);
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
function stepFight(dt: number): void {
  fightT += dt;
  for (const [a, b] of [[frog!, lizard!], [lizard!, frog!]] as const) {
    const blow = tick(a, b, dt);
    if (blow) {
      if (blow.broke) showBreak(a);
      showBlow(b, blow);
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

function finishFight(won: boolean): void {
  phase = 'over';
  for (const b of buttons) b.destroy();
  buttons = [];

  const winner = won ? frog! : lizard!;
  const loser = won ? lizard! : frog!;
  // the loser goes over; the winner steps back and does not stop moving
  if (loser.art) S().tweens.add({ targets: loser.art.root, angle: loser.face * -82, y: FLOOR_Y + 4, alpha: 0.45, duration: 520 });
  if (winner.art) {
    S().tweens.add({ targets: winner.art.root, x: won ? 40 : GAME_W - 40, duration: 420 });
    S().tweens.add({ targets: winner.art.root, y: FLOOR_Y - 9, duration: 250, yoyo: true, repeat: 5 });
  }
  audio.sfx(won ? 'zone_clear' : 'death_stinger', 0.7);

  S().time.delayedCall(800, () => {
    // 240, not 214: "FROGSTER CHAMPION!" is eighteen characters at size 16,
    // which came to the old width exactly and sat on both borders -- and the
    // headline then tweens up to 1.08, which put it through them.
    const panel = S().add.rectangle(GAME_W / 2, 92, 240, 76, PALETTE.ink).setDepth(60).setStrokeStyle(1, won ? PALETTE.gold : PALETTE.steel);
    layer?.add(panel);
    const head = centerText(S(), GAME_W / 2, 72, won ? 'FROGSTER CHAMPION!' : 'FROGSTER DEFEATED!', won ? PALETTE.gold : PALETTE.fog, 16).setDepth(61);
    layer?.add(head);
    S().tweens.add({ targets: head, scaleX: 1.08, scaleY: 1.08, duration: 300, yoyo: true, repeat: won ? 3 : 0 });

    if (won) {
      // The reward ANIMATION.  The tokens themselves are the shell's business
      // and arrive when `finish` calls `api.win`, once.
      const gain = centerText(S(), GAME_W / 2, 96, '+30 TOKENS', PALETTE.gold, 16).setDepth(61);
      layer?.add(gain);
      S().tweens.add({ targets: gain, y: 90, duration: 420, yoyo: true, repeat: -1 });
      audio.sfx('cha_ching', 0.6);
      layer?.add(centerText(S(), GAME_W / 2, 114, `BALANCE AFTER: ${apiRef!.balance() + 30}`, PALETTE.ash).setDepth(61));
    } else {
      layer?.add(centerText(S(), GAME_W / 2, 96, 'NO REWARD. NO REFUND.', PALETTE.ash).setDepth(61));
      layer?.add(centerText(S(), GAME_W / 2, 114, `BALANCE: ${apiRef!.balance()}`, PALETTE.ash).setDepth(61));
    }
    // No button here on purpose.  The player's last decision was the fourth
    // chest; asking them to acknowledge a result they had no hand in is a
    // press for the sake of a press.  The scoreboard is read, the tokens are
    // paid, and the machine puts them back in the arcade on its own.
    S().time.delayedCall(won ? OVER_WIN_MS : OVER_LOSE_MS, () => finish(won));
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
        rules: { WEAPONS, MATERIALS, UNARMED, QUALITY_MUL, statsOf, makeFighter, resolveStrike, tick, think, simulate, randomKit, offerFor, makeWeapon, makeArmour, breakWeapon },
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
    avoid: +f.st.avoid.toFixed(3), prot: +f.st.prot.toFixed(2), reach: f.st.reach, range: f.st.range,
  };
}
