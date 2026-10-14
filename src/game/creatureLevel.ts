/**
 * ---- LEVELS.  A creature starts at level 1 and grows by fighting: every
 * battle it WINS gives it experience (more for a boss), and at 100 and 250
 * experience it reaches levels 2 and 3.  Three is the top: past it the
 * experience stops counting.
 *
 * Each level is a modest step, not a new creature: a little more health, a
 * little more bite, a touch more speed -- enough that a level 3 common is
 * worth keeping, not enough that it walks over a fresh rare.  Everything it
 * does stays the same: the same three attacks, the same cooldowns, reach and
 * element; only the numbers grow.
 */

import type { Creature } from './creatures';

export const MAX_LEVEL = 3;
/** Experience needed to BE at each level (index 0 = level 1). */
export const LEVEL_XP = [0, 100, 250] as const;
/** The most experience that counts: reaching level 3. */
export const MAX_XP = LEVEL_XP[MAX_LEVEL - 1];
/** Experience for a won battle, and for beating a place's boss. */
export const XP_WIN = 40;
export const XP_BOSS = 60;

/** What each level adds, on top of the creature as it was caught. */
const GROWTH: Record<number, { hp: number; dmg: number; speed: number }> = {
  1: { hp: 1, dmg: 1, speed: 1 },
  2: { hp: 1.12, dmg: 1.1, speed: 1.04 },
  3: { hp: 1.25, dmg: 1.2, speed: 1.08 },
};

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
  const g = GROWTH[Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)))];
  if (g.hp === 1) return c;
  return {
    ...c,
    hp: Math.round(c.hp * g.hp),
    speed: Math.round(c.speed * g.speed),
    power: Math.round(c.power * g.dmg * 100) / 100,
    attacks: c.attacks.map((a) => ({ ...a, dmg: a.dmg > 0 ? Math.round(a.dmg * g.dmg) : 0 })) as Creature['attacks'],
  };
}
