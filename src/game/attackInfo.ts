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
};

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
  }
}

/** One short line for a list: SHOT - PROJECTILE, SINGLE TARGET - 12 DMG - 0.6S */
export function attackLine(a: Attack, el: Element): string {
  const i = attackInfo(a, el);
  const dmg = a.dmg > 0 ? `${a.dmg} DMG` : 'NO DMG';
  return `${i.type} - ${dmg} - ${a.cd}S`;
}
