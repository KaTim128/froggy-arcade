/**
 * ---- LEVELS (C1: the top is level 20).  A creature starts at level 1 and
 * grows by fighting: every battle it WINS gives it experience (more for a
 * boss).  Each level asks a little more than the one before -- 70 to reach
 * level 2, 430 for the last step to 20, about 4,750 in all -- so a creature
 * at the top has a hundred-odd wins behind it.  Past 20 the experience stops
 * counting.
 *
 * Each level is a modest step, not a new creature: about 4% more health,
 * 3.5% more bite and a touch more speed.  A level-20 creature has three
 * quarters again the health and two thirds again the damage it was caught
 * with -- worth raising, and still the same animal: the same three attacks,
 * cooldowns, reach and element; only the numbers grow.
 */

import type { Creature } from './creatures';

export const MAX_LEVEL = 20;
/** Experience needed to BE at each level (index 0 = level 1): +50 + 20 per level. */
export const LEVEL_XP: readonly number[] = (() => {
  const out = [0];
  for (let lv = 1; lv < MAX_LEVEL; lv++) out.push(out[lv - 1] + 50 + 20 * lv);
  return out;
})();
/** The most experience that counts: reaching the top level. */
export const MAX_XP = LEVEL_XP[MAX_LEVEL - 1];
/** Experience for a won battle, and for beating a place's boss. */
export const XP_WIN = 40;
export const XP_BOSS = 60;

/** What a level adds, on top of the creature as it was caught. */
function growth(level: number): { hp: number; dmg: number; speed: number } {
  const n = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level))) - 1;
  return { hp: 1 + 0.04 * n, dmg: 1 + 0.035 * n, speed: 1 + 0.006 * n };
}

/** Clamp saved experience to what counts. */
export function cleanXp(xp: unknown): number {
  return typeof xp === 'number' && Number.isFinite(xp) ? Math.max(0, Math.min(MAX_XP, Math.floor(xp))) : 0;
}

export function levelOf(xp: number): number {
  let lv = 1;
  for (let i = 1; i < MAX_LEVEL; i++) if (xp >= LEVEL_XP[i]) lv = i + 1;
  return lv;
}

/** Where a creature is in its level: how much into it, how much the level takes, or MAX. */
export function xpProgress(xp: number): { level: number; into: number; need: number; max: boolean } {
  const level = levelOf(xp);
  if (level >= MAX_LEVEL) return { level, into: 0, need: 0, max: true };
  const lo = LEVEL_XP[level - 1];
  const hi = LEVEL_XP[level];
  return { level, into: xp - lo, need: hi - lo, max: false };
}

/** The creature at `level`: its health, damage and speed grown; all else as it was. */
export function withLevel(c: Creature, level: number): Creature {
  const g = growth(level);
  if (g.hp === 1) return c;
  return {
    ...c,
    hp: Math.round(c.hp * g.hp),
    speed: Math.round(c.speed * g.speed),
    attacks: c.attacks.map((a) => ({ ...a, dmg: a.dmg > 0 ? Math.round(a.dmg * g.dmg) : 0 })) as Creature['attacks'],
  };
}
