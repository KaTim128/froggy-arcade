/**
 * The Creature Clash save field: its shape, its defaults, and making a saved
 * one safe to use.  Apart from game/creatureClash so the store can import it
 * without importing the store back.
 *
 * VERSION 2: no tiers, no zone bosses.  An older save is brought across
 * (see `sanitizeCreatures`): every creature you had is still yours, as the
 * creature that now owns its body; a pack you had paid for is still on the
 * table; the old zone-win counters and bosses are dropped.
 */

import { BIOMES, BOSSES, LADDER_LEVELS, MAX_OWNED, creatureById, migrateCreatureId, rollPack, CREATURES } from './creatures';
import { XP_WIN, cleanXp } from './creatureLevel';

export const CREATURE_VERSION = 2;

export interface Owned {
  uid: number;
  id: string;
  wins: number;
  /** Experience (see creatureLevel): 0 at level 1, capped at the top level's. */
  xp: number;
  /**
   * When it fainted (epoch ms), or absent: a fainted creature keeps its slot
   * (log #3) and is down until REVIVE is pressed (game/creatureClash `revive`).
   */
  faintedAt?: number;
}

/**
 * A LADDER RUN, paid for: who you will fight at each step (drawn when you
 * paid, so a reload cannot change them), where, and how far you have got.
 * `level` is the next fight: 1..5 the normal ones, 6 the boss.
 */
export interface LadderRun {
  level: number;
  foes: string[];
  places: string[];
  boss: string;
  /** Tokens this run has paid out so far. */
  earned: number;
}

export interface CreatureState {
  v: number;
  owned: Owned[];
  /** uid of the one that fights, or -1. */
  active: number;
  nextUid: number;
  starterTaken: boolean;
  /** A paid-for pack still face down on the table: you pick from THESE nine, reload or not. */
  pending: { cards: string[] } | null;
  /**
   * A battle that has started and not finished.  `ladder` names the step of
   * the run it is (so it is settled against that step, once).
   */
  battle: { mode: 'zone' | 'ladder' | 'story'; biome: string; level?: number; world?: number; stage?: number; foe?: string } | null;
  /**
   * STORY MODE (game/creatureStory): how many worlds are beaten (they open in
   * order), and each world's next stage (0..3 its battles, 4 its boss).
   */
  story: { cleared: number; stage: number[] };
  /** The ladder run in progress, or null. */
  ladder: LadderRun | null;
  /** The last boss a finished (or lost) run had: the next one draws another. */
  lastBoss: string | null;
  /**
   * The ladder bosses beaten this time round (user, 28 Oct): none comes up
   * again until all ten have been beaten, then the round starts over.
   */
  bossesBeaten: string[];
  /** The last opponent met in each place, so the next one is someone else. */
  lastFoe: Record<string, string>;
  ladderRuns: number;
  ladderClears: number;
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
    ladder: null,
    story: { cleared: 0, stage: [0, 0, 0, 0, 0] },
    lastBoss: null,
    bossesBeaten: [],
    lastFoe: {},
    ladderRuns: 0,
    ladderClears: 0,
    handed: 'right',
    wins: 0,
    losses: 0,
    pulls: 0,
  };
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const isCreature = (id: unknown): id is string => typeof id === 'string' && CREATURES.some((c) => c.id === id);

/**
 * Whatever came off the disk, made into something the game can trust: no
 * creature that does not exist (an old one is mapped to its body's
 * creature), never more than two, an active one that is actually owned, a
 * pack that is nine real different cards, a ladder run that adds up.
 *
 * A battle still open on load means the page went away mid-fight.  It is
 * settled as a RETREAT by the hub (creatureClash `retreat`): nothing is paid
 * for it, a zone stake stays spent, and a ladder run it belonged to ends --
 * so reloading is never a way out of a fight, or into a second reward.
 */
export function sanitizeCreatures(raw: unknown): CreatureState {
  const d = defaultCreatures();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<CreatureState> & { pending?: { cards?: unknown } | null };
  const seen = new Set<number>();
  const owned = (Array.isArray(r.owned) ? r.owned : [])
    .filter((o): o is Owned => !!o && typeof o === 'object' && typeof o.id === 'string')
    .map((o) => {
      const id = migrateCreatureId(o.id);
      const wins = Math.max(0, Math.floor(num(o.wins)));
      // (a creature saved before levels: its past wins count, as if it had earned them)
      const xp = cleanXp(typeof o.xp === 'number' ? o.xp : wins * XP_WIN);
      const faintedAt = typeof o.faintedAt === 'number' && Number.isFinite(o.faintedAt) ? o.faintedAt : undefined;
      return { uid: Math.floor(num(o.uid)), id: id ?? '', wins, xp, ...(faintedAt ? { faintedAt } : {}) };
    })
    .filter((o) => !!o.id && !!creatureById(o.id) && o.uid > 0 && !seen.has(o.uid) && (seen.add(o.uid), true))
    .slice(0, MAX_OWNED);
  const nextUid = Math.max(num(r.nextUid, 1), ...owned.map((o) => o.uid + 1), 1);
  const active = owned.some((o) => o.uid === r.active) ? (r.active as number) : owned[0]?.uid ?? -1;
  // a pack still face down: its cards brought across, made nine different again
  let pending: CreatureState['pending'] = null;
  if (r.pending && Array.isArray(r.pending.cards)) {
    const cards = [...new Set(r.pending.cards.map((c) => (typeof c === 'string' ? migrateCreatureId(c) : null)).filter(isCreature))];
    for (const extra of rollPack()) if (cards.length < 9 && !cards.includes(extra)) cards.push(extra);
    if (cards.length === 9) pending = { cards };
  }
  const b = r.battle as { mode?: unknown; biome?: unknown; level?: unknown } | null | undefined;
  const sb = b as { world?: unknown; stage?: unknown; foe?: unknown } | null | undefined;
  const battle: CreatureState['battle'] =
    b && typeof b === 'object' && BIOMES.some((x) => x.id === b.biome)
      ? b.mode === 'ladder'
        ? { mode: 'ladder' as const, biome: b.biome as string, level: Math.floor(num(b.level, 1)) }
        : b.mode === 'story'
          ? { mode: 'story' as const, biome: b.biome as string, world: Math.max(0, Math.min(4, Math.floor(num(sb?.world)))), stage: Math.max(0, Math.min(4, Math.floor(num(sb?.stage)))), foe: isCreature(sb?.foe) ? (sb!.foe as string) : 'mole' }
          : { mode: 'zone' as const, biome: b.biome as string }
      : null;
  const st = (r as { story?: { cleared?: unknown; stage?: unknown } }).story;
  const story = {
    cleared: Math.max(0, Math.min(5, Math.floor(num(st?.cleared)))),
    stage: [0, 1, 2, 3, 4].map((i) => Math.max(0, Math.min(4, Math.floor(num(Array.isArray(st?.stage) ? st!.stage[i] : 0))))),
  };
  const L = r.ladder;
  const ladder =
    L &&
    typeof L === 'object' &&
    Array.isArray(L.foes) &&
    L.foes.length === LADDER_LEVELS &&
    L.foes.every(isCreature) &&
    Array.isArray(L.places) &&
    L.places.length === LADDER_LEVELS + 1 &&
    L.places.every((p) => BIOMES.some((x) => x.id === p)) &&
    BOSSES.some((x) => x.id === L.boss)
      ? { level: Math.max(1, Math.min(LADDER_LEVELS + 1, Math.floor(num(L.level, 1)))), foes: [...L.foes], places: [...L.places], boss: L.boss, earned: Math.max(0, Math.floor(num(L.earned))) }
      : null;
  const lastFoe: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.lastFoe ?? {})) if (BIOMES.some((x) => x.id === k) && isCreature(v)) lastFoe[k] = v;
  return {
    v: CREATURE_VERSION,
    owned,
    active,
    nextUid,
    starterTaken: !!r.starterTaken || owned.length > 0,
    pending,
    battle,
    ladder,
    story,
    lastBoss: BOSSES.some((x) => x.id === r.lastBoss) ? (r.lastBoss as string) : null,
    bossesBeaten: Array.isArray(r.bossesBeaten) ? [...new Set(r.bossesBeaten.filter((id): id is string => typeof id === 'string' && BOSSES.some((x) => x.id === id)))] : [],
    lastFoe,
    ladderRuns: Math.max(0, Math.floor(num(r.ladderRuns))),
    ladderClears: Math.max(0, Math.floor(num(r.ladderClears))),
    handed: r.handed === 'left' ? 'left' : 'right',
    wins: Math.max(0, Math.floor(num(r.wins))),
    losses: Math.max(0, Math.floor(num(r.losses))),
    pulls: Math.max(0, Math.floor(num(r.pulls))),
  };
}
