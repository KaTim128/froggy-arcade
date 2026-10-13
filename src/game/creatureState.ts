/**
 * The Creature Clash save field: its shape, its defaults, and making a saved
 * one safe to use.  Apart from game/creatureClash so the store can import it
 * without importing the store back.
 */

import { BIOMES, MAX_OWNED, TIERS, creatureById, type Tier } from './creatures';

export const CREATURE_VERSION = 1;

export interface Owned {
  uid: number;
  id: string;
  wins: number;
}

export interface CreatureState {
  v: number;
  owned: Owned[];
  /** uid of the one that fights, or -1. */
  active: number;
  nextUid: number;
  starterTaken: boolean;
  /** A paid-for pack still face down on the table: you pick from THESE nine, reload or not. */
  pending: { tier: Tier['id']; cards: string[] } | null;
  /** A battle whose stake is paid and that has not finished. */
  battle: { biome: string; boss: boolean } | null;
  biomeWins: Record<string, number>;
  bosses: string[];
  handed: 'right' | 'left';
  wins: number;
  losses: number;
  pulls: number;
}

export function defaultCreatures(): CreatureState {
  return {
    v: CREATURE_VERSION,
    owned: [],
    active: -1,
    nextUid: 1,
    starterTaken: false,
    pending: null,
    battle: null,
    biomeWins: {},
    bosses: [],
    handed: 'right',
    wins: 0,
    losses: 0,
    pulls: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/**
 * Whatever came off the disk, made into something the game can trust: no
 * creature that does not exist, never more than two, an active one that is
 * actually owned, and a pack that is really nine real cards.
 *
 * A battle still open on load means the page went away mid-fight.  It is
 * settled as a RETREAT (see creatureClash `retreat`): the stake stays spent
 * and the penalty is paid, so reloading is never cheaper than quitting.
 */
export function sanitizeCreatures(raw: unknown): CreatureState {
  const d = defaultCreatures();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<CreatureState>;
  const seen = new Set<number>();
  const owned = (Array.isArray(r.owned) ? r.owned : [])
    .filter((o): o is Owned => !!o && typeof o === 'object' && typeof o.id === 'string' && !!creatureById(o.id))
    .map((o) => ({ uid: Math.floor(num(o.uid)), id: o.id, wins: Math.max(0, Math.floor(num(o.wins))) }))
    .filter((o) => o.uid > 0 && !seen.has(o.uid) && (seen.add(o.uid), true))
    .slice(0, MAX_OWNED);
  const nextUid = Math.max(num(r.nextUid, 1), ...owned.map((o) => o.uid + 1), 1);
  const active = owned.some((o) => o.uid === r.active) ? (r.active as number) : owned[0]?.uid ?? -1;
  const pend = r.pending;
  const pending =
    pend && TIERS.some((t) => t.id === pend.tier) && Array.isArray(pend.cards) && pend.cards.length === 9 && pend.cards.every((c) => typeof c === 'string' && !!creatureById(c)) && new Set(pend.cards).size === 9
      ? { tier: pend.tier, cards: [...pend.cards] }
      : null;
  const biomeWins: Record<string, number> = {};
  for (const b of BIOMES) biomeWins[b.id] = Math.max(0, Math.floor(num((r.biomeWins ?? {})[b.id])));
  const battle = r.battle && typeof r.battle === 'object' && BIOMES.some((b) => b.id === r.battle!.biome) ? { biome: r.battle.biome, boss: !!r.battle.boss } : null;
  return {
    v: CREATURE_VERSION,
    owned,
    active,
    nextUid,
    starterTaken: !!r.starterTaken || owned.length > 0,
    pending,
    battle,
    biomeWins,
    bosses: (Array.isArray(r.bosses) ? r.bosses : []).filter((b): b is string => typeof b === 'string' && BIOMES.some((x) => x.boss.id === b)),
    handed: r.handed === 'left' ? 'left' : 'right',
    wins: Math.max(0, Math.floor(num(r.wins))),
    losses: Math.max(0, Math.floor(num(r.losses))),
    pulls: Math.max(0, Math.floor(num(r.pulls))),
  };
}
