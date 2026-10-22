/**
 * WHAT AN ATTACK DOES, SAID PLAINLY.  Every attack in Creature Clash is one
 * of thirteen kinds with one special on top (creatures `Mod`), and the arena runs each kind one way (see CreatureArena
 * `fire`); this says the same thing in words -- the kind (melee, projectile,
 * area, trap...), who it can hit (one target, several, everyone near), how
 * far it reaches in arena pixels, the damage and the cooldown -- and gives it
 * an icon and one short action word for its button.
 *
 * The numbers come from the same fields the arena uses, worked out the same
 * way, so what a card says is what the attack does.
 */

import { ELEMENTS, type Attack, type AttackKind, type Element, type Mod } from './creatures';
import { SPECIALS } from './specials';

export interface AttackInfo {
  /** One word for the button. */
  word: string;
  /** For buttons drawn outside the game's own pixel font (the phone's band). */
  emoji: string;
  /** MELEE, PROJECTILE, AREA, ... */
  type: string;
  /** SINGLE TARGET, UP TO 3 SHOTS, ALL AROUND YOU, ... */
  target: string;
  /** In plain words, with the number. */
  range: string;
  /** The effective reach in arena pixels (0: none, it is not aimed at anyone). */
  reachPx: number;
  dmg: number;
  cd: number;
  /** One line on when to use it. */
  use: string;
  /** What the element adds when it hits. */
  effect: string;
  /** What this move does that no other move does, in a line ('' for a plain one). */
  special: string;
}

/** How long a shot flies (CreatureArena: `life` on a shot). */
const SHOT_LIFE = 0.9;
/** How long a dash carries (CreatureArena: `t` on a dash). */
const DASH_T = 0.28;
/** How far a trap can be thrown (CreatureArena: mine placement). */
const MINE_THROW = 40;

const WORDS: Record<AttackKind, { word: string; emoji: string }> = {
  bolt: { word: 'SHOT', emoji: '🏹' },
  spread: { word: 'FAN', emoji: '🏹' },
  nova: { word: 'BURST', emoji: '💥' },
  dash: { word: 'CHARGE', emoji: '⚔️' },
  beam: { word: 'LINE', emoji: '🎯' },
  mine: { word: 'TRAP', emoji: '💣' },
  shield: { word: 'GUARD', emoji: '🛡️' },
  blink: { word: 'BLINK', emoji: '💨' },
  arc: { word: 'LOB', emoji: '🌋' },
  snare: { word: 'SNARE', emoji: '🕸️' },
  aura: { word: 'BOOST', emoji: '⚡' },
  mend: { word: 'MEND', emoji: '💚' },
  wall: { word: 'COVER', emoji: '🧱' },
};

/** How long a lobbed shot is in the air before it lands. */
const ARC_T = 0.75;
/** What an aura is worth, and for how long (CreatureArena: `aura`). */
export const AURA_S = 5;
export const AURA_SPEED = 1.35;
export const AURA_POWER = 1.25;
/** A snare holds you still this long (CreatureArena: `root`). */
export const ROOT_S = 1.3;
/** A mend gives back this much of a full health bar. */
export const MEND_FRAC = 0.22;
/** A dropped piece of cover stands this long. */
export const WALL_S = 7;

// ---- THE SPECIALS' NUMBERS (CreatureArena reads the same ones)
export const POISON_S = 4;
export const POISON_PER_S = 3;
export const MARK_S = 4;
export const MARK_MUL = 1.5;
export const SHRED_S = 3;
export const SHRED_MUL = 1.25;
export const EXECUTE_MUL = 1.6;
export const DRAIN_FRAC = 0.4;
export const HOLD_S = 0.8;
export const SILENCE_S = 1.2;
export const WEAK_S = 3;
export const WEAK_MUL = 0.7;
export const CHILL_S = 3;
export const CHILL_SPEED = 0.5;
export const STAGGER_S = 0.3;
export const LINGER_S = 3;
export const LINGER_DMG = 2;
export const HASTE_S = 2;
export const HASTE_SPEED = 1.4;
export const GUARD_S = 1.5;
export const REGEN_S = 4;
export const REGEN_PER_S = 3;
export const THORNS_DMG = 6;
export const STRIKE_DMG = 10;

/** Every special, said in a line a player can act on. */
export const MODS: Record<Mod, { name: string; desc: string }> = {
  none: { name: '', desc: '' },
  poison: { name: 'POISON', desc: `POISONS: ${POISON_PER_S} DAMAGE A SECOND FOR ${POISON_S}S` },
  mark: { name: 'MARK', desc: `MARKS THEM: YOUR NEXT HIT DEALS +${Math.round((MARK_MUL - 1) * 100)}%` },
  shred: { name: 'SHRED', desc: `THEY TAKE ${Math.round((SHRED_MUL - 1) * 100)}% MORE DAMAGE FOR ${SHRED_S}S` },
  execute: { name: 'EXECUTE', desc: `+${Math.round((EXECUTE_MUL - 1) * 100)}% DAMAGE IF THEY ARE UNDER 40% HEALTH` },
  drain: { name: 'DRAIN', desc: `YOU HEAL ${Math.round(DRAIN_FRAC * 100)}% OF THE DAMAGE IT DEALS` },
  pull: { name: 'PULL', desc: 'DRAGS THEM TOWARDS YOU' },
  push: { name: 'KNOCKBACK', desc: 'KNOCKS THEM A LONG WAY BACK' },
  root: { name: 'HOLD', desc: `HOLDS THEM IN PLACE FOR ${HOLD_S}S` },
  silence: { name: 'SILENCE', desc: `ADDS ${SILENCE_S}S TO ALL THEIR COOLDOWNS` },
  weaken: { name: 'WEAKEN', desc: `THEIR HITS DEAL ${Math.round((1 - WEAK_MUL) * 100)}% LESS FOR ${WEAK_S}S` },
  chill: { name: 'CHILL', desc: `HALVES THEIR SPEED FOR ${CHILL_S}S` },
  stagger: { name: 'STAGGER', desc: 'INTERRUPTS THEM WITH A SHORT STUN' },
  crit: { name: 'CRITICAL', desc: '1 IN 4 CHANCE TO DEAL DOUBLE DAMAGE' },
  homing: { name: 'HOMING', desc: 'CURVES TOWARDS THEM IN FLIGHT' },
  bounce: { name: 'RICOCHET', desc: 'BOUNCES OFF COVER ONCE' },
  wave: { name: 'WEAVING', desc: 'WEAVES SIDE TO SIDE: HARD TO DODGE' },
  boomerang: { name: 'BOOMERANG', desc: 'FLIES OUT AND BACK: CAN HIT TWICE' },
  grow: { name: 'SWELLING', desc: 'GROWS AND HITS HARDER THE FURTHER IT FLIES' },
  drill: { name: 'PIERCING', desc: 'BORES STRAIGHT THROUGH COVER' },
  split: { name: 'SHATTER', desc: 'BREAKS INTO THREE SHARDS WHEN IT STOPS' },
  linger: { name: 'SCORCH', desc: `LEAVES A PATCH THAT HURTS FOR ${LINGER_S}S` },
  echo: { name: 'ECHO', desc: 'GOES OFF AGAIN A MOMENT LATER, HALF AS HARD' },
  vortex: { name: 'VORTEX', desc: 'SUCKS THEM IN TOWARDS THE MIDDLE' },
  haste: { name: 'HASTE', desc: `YOU MOVE ${Math.round((HASTE_SPEED - 1) * 100)}% FASTER FOR ${HASTE_S}S AFTER` },
  guard: { name: 'GUARD', desc: `BLOCKS THE NEXT HIT ON YOU WITHIN ${GUARD_S}S` },
  regen: { name: 'REGROW', desc: `YOU HEAL ${REGEN_PER_S} A SECOND FOR ${REGEN_S}S` },
  cleanse: { name: 'CLEANSE', desc: 'SHAKES OFF BURNS, POISON, SLOWS AND HOLDS' },
  reflect: { name: 'REFLECT', desc: 'SHOTS THAT HIT IT FLY BACK AT THEM' },
  thorns: { name: 'THORNS', desc: `ANYTHING THAT HITS IT TAKES ${THORNS_DMG} DAMAGE` },
  strike: { name: 'STRIKE', desc: `DEALS ${STRIKE_DMG} DAMAGE ALL ROUND WHERE YOU LAND` },
};

export function attackInfo(a: Attack, el: Element, scale = 1): AttackInfo {
  const effect = a.dmg > 0 ? ELEMENTS[el].effect : '';
  const w = WORDS[a.kind];
  // (a special says exactly what it does; a plain attack has nothing to add)
  const special = a.sp ? SPECIALS[a.sp]?.desc ?? '' : MODS[a.mod].desc;
  const base = { word: w.word, emoji: w.emoji, dmg: a.dmg, cd: a.cd, effect, special };
  switch (a.kind) {
    case 'bolt': {
      const r = Math.round(a.reach * SHOT_LIFE);
      return { ...base, type: 'PROJECTILE', target: 'SINGLE TARGET', range: `LONG RANGE ${r}PX`, reachPx: r, use: 'FAST, CHEAP POKE. AIM AND LEAD THE TARGET.' };
    }
    case 'spread': {
      const r = Math.round(a.reach * SHOT_LIFE);
      return { ...base, type: 'PROJECTILE X3', target: 'FAN, CAN MULTI-HIT', range: `MID RANGE ${r}PX`, reachPx: r, use: 'HARD TO DODGE. BEST AT MID RANGE.' };
    }
    case 'nova': {
      const r = Math.round(a.reach * scale);
      return { ...base, type: 'AREA OF EFFECT', target: 'ALL AROUND YOU', range: `CLOSE, ${r}PX RING`, reachPx: r, use: 'GET CLOSE FIRST. CANNOT MISS INSIDE THE RING.' };
    }
    case 'dash': {
      const r = Math.round(a.reach * DASH_T);
      return { ...base, type: 'MELEE CHARGE', target: 'SINGLE TARGET', range: `SHORT, DASH ${r}PX`, reachPx: r, use: 'CLOSE THE GAP AND HIT IN ONE MOVE.' };
    }
    case 'beam': {
      const r = Math.round(a.reach * scale);
      return { ...base, type: 'INSTANT LINE', target: 'SINGLE TARGET', range: `${r < 80 ? 'SHORT' : 'MID'}, ${r}PX LINE`, reachPx: r, use: 'HITS AT ONCE - NO TRAVEL TIME TO DODGE.' };
    }
    case 'mine':
      return { ...base, type: 'TRAP (AREA)', target: 'WHOEVER STEPS ON IT', range: `THROWN ${MINE_THROW}PX, LASTS 8S`, reachPx: MINE_THROW, use: 'LAY IT WHERE THEY WILL WALK.' };
    case 'shield':
      return { ...base, type: 'DEFENCE', target: 'YOU', range: `BLOCKS ALL HITS ${a.reach}S`, reachPx: 0, use: 'POP IT WHEN A BIG ATTACK IS COMING.' };
    case 'blink':
      return { ...base, type: 'MOVEMENT', target: 'YOU', range: `TELEPORT ${a.reach}PX`, reachPx: a.reach, use: 'ESCAPE, OR GET BEHIND COVER. NO DAMAGE.' };
    case 'arc': {
      const r = Math.round(a.reach * ARC_T);
      return { ...base, type: 'LOBBED (AREA)', target: 'BURSTS WHERE IT LANDS', range: `OVER COVER, UP TO ${r}PX`, reachPx: r, use: 'THE ONE SHOT THAT IGNORES COVER. LEAD THEM.' };
    }
    case 'snare': {
      const r = Math.round(a.reach * SHOT_LIFE);
      return { ...base, type: 'PROJECTILE (HOLD)', target: 'SINGLE TARGET', range: `LONG RANGE ${r}PX`, reachPx: r, use: `ROOTS THEM FOR ${ROOT_S}S. SET UP YOUR BIG ONE.` };
    }
    case 'aura':
      return { ...base, type: 'BUFF (SELF)', target: 'YOU', range: `${AURA_S}S OF IT`, reachPx: 0, use: `+${Math.round((AURA_SPEED - 1) * 100)}% SPEED, +${Math.round((AURA_POWER - 1) * 100)}% DAMAGE. OPEN WITH IT.` };
    case 'mend':
      return { ...base, type: 'HEAL (SELF)', target: 'YOU', range: `${Math.round(MEND_FRAC * 100)}% OF FULL HEALTH`, reachPx: 0, use: 'BREAK AWAY FIRST - IT TAKES A MOMENT.' };
    case 'wall':
      return { ...base, type: 'COVER (PLACED)', target: 'BLOCKS SHOTS', range: `DROPPED ${a.reach}PX AWAY, ${WALL_S}S`, reachPx: a.reach, use: 'PUT IT BETWEEN YOU AND THEIR BIG MOVE.' };
  }
}

/**
 * The whole card, for the menu: every line a player could want before
 * choosing a move -- what kind it is, what it hits, how far, how hard, how
 * often, what the element adds, and when to reach for it.
 */
export function attackCard(a: Attack, el: Element, scale = 1): string[] {
  const i = attackInfo(a, el, scale);
  const out = [`TYPE: ${i.type}`, `HITS: ${i.target}`, `RANGE: ${i.range}`];
  out.push(`DAMAGE: ${a.dmg > 0 ? `${a.dmg}` : 'NONE'} - COOLDOWN: ${a.cd}S`);
  out.push(a.sp ? `SPECIAL: ${i.special}` : 'PLAIN ATTACK - NO SPECIAL');
  if (i.effect) out.push(`ELEMENT: ${i.effect}`);
  // (a special's line already says what it is for; a plain attack gets the kind's advice)
  if (!a.sp) out.push(`USE: ${i.use}`);
  return out.map(plainWords);
}

/** One STEP, the length players read distances in: about a creature's width. */
const STEP_PX = 14;

/**
 * PLAIN WORDS.  The numbers underneath are in pixels and seconds, which is
 * how the arena counts them, not how anyone playing does: "A 68PX BLINK"
 * says nothing.  On the card, a distance is in STEPS (a creature's width,
 * so 5 STEPS is five of them side by side) and a time in SEC.
 */
export function plainWords(line: string): string {
  const steps = (px: string): number => Math.max(1, Math.round(Number(px) / STEP_PX));
  return (
    line
      // "A 44PX RING", "AN 80PX DASH": a 3-STEP RING, a 6-STEP DASH
      .replace(/\bAN? (\d+)PX (?=[A-Z])/g, (_m, px: string) => `A ${steps(px)}-STEP `)
      // "UP TO 64PX AWAY": UP TO 5 STEPS AWAY
      .replace(/(\d+)PX\b/g, (_m, px: string) => {
        const n = steps(px);
        return `${n} STEP${n === 1 ? '' : 'S'}`;
      })
      // "FOR 3S", "0.5S": FOR 3 SEC, 0.5 SEC
      .replace(/(\d+(?:\.\d+)?)S\b/g, '$1 SEC')
  );
}

/** One short line for a list: SHOT - PROJECTILE, SINGLE TARGET - 12 DMG - 0.6S */
export function attackLine(a: Attack, el: Element): string {
  const i = attackInfo(a, el);
  const dmg = a.dmg > 0 ? `${a.dmg} DMG` : 'NO DMG';
  return `${i.type} - ${dmg} - ${a.cd}S`;
}

/**
 * The words on a creature's three move buttons (the phone's band): from each
 * move's own name, never the same twice.  The kind's word ("SHOT", "LINE")
 * was the same for every move of a kind, so a creature with two lines showed
 * two LINE buttons that did different things.  The name's last word first
 * (VENOM STING: STING), then its first, then the whole name.
 */
export function buttonWords(attacks: readonly Attack[]): string[] {
  const out: string[] = [];
  for (const a of attacks) {
    const words = a.name.toUpperCase().split(/\s+/).filter(Boolean);
    const tries = [words[words.length - 1], words[0], words.join(' '), WORDS[a.kind].word];
    out.push(tries.find((w) => w && !out.includes(w)) ?? a.name.toUpperCase());
  }
  return out;
}
