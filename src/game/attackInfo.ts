/**
 * WHAT AN ATTACK DOES, SAID PLAINLY.  Every attack in Creature Clash is one
 * of eight kinds, and the arena runs each kind one way (see CreatureArena
 * `fire`); this says the same thing in words -- the kind (melee, projectile,
 * area, trap...), who it can hit (one target, several, everyone near), how
 * far it reaches in arena pixels, the damage and the cooldown -- and gives it
 * an icon and one short action word for its button.
 *
 * The numbers come from the same fields the arena uses, worked out the same
 * way, so what a card says is what the attack does.
 */

import { ELEMENTS, type Attack, type AttackKind, type Element } from './creatures';

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
  aura: { word: 'CHARGE', emoji: '⚡' },
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

export function attackInfo(a: Attack, el: Element, scale = 1): AttackInfo {
  const effect = a.dmg > 0 ? ELEMENTS[el].effect : '';
  const w = WORDS[a.kind];
  const base = { word: w.word, emoji: w.emoji, dmg: a.dmg, cd: a.cd, effect };
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
  out.push(`DAMAGE: ${a.dmg > 0 ? `${a.dmg}` : 'NONE'}    COOLDOWN: ${a.cd}S`);
  if (i.effect) out.push(`ON HIT: ${i.effect}`);
  out.push(`USE: ${i.use}`);
  return out;
}

/** One short line for a list: SHOT - PROJECTILE, SINGLE TARGET - 12 DMG - 0.6S */
export function attackLine(a: Attack, el: Element): string {
  const i = attackInfo(a, el);
  const dmg = a.dmg > 0 ? `${a.dmg} DMG` : 'NO DMG';
  return `${i.type} - ${dmg} - ${a.cd}S`;
}
