/**
 * ---- CREATURE CLASH: STORY MODE (log #7, #33, #45; B7).  In place of the
 * old zone battles (user, 28 Oct: "a story mode instead of zone").
 *
 * Five worlds, in order.  Each is four battles and then its boss, at the
 * levels below; beat the boss and the next world opens.  The last boss
 * opens the Ladder.
 *
 *   world                       levels   boss
 *   Mosswood Frontier           1-4      Mossback Guardian
 *   Sunken Ruins                5-8      Abyssal Dreadfin
 *   Emberfall Crater            9-12     Cindermaw
 *   Shattered Crystal Depths    13-16    Prism Warden
 *   The Void Citadel            17-20    The Hollow Sovereign
 *
 * PRICES (C2, the user's): world N's battles cost 2N and pay 4N on a win
 * until its boss is beaten; after that they are replays, costing N and
 * paying 2N.  (Read as per battle -- each of the five fights of a world.)
 *
 * THE BOSSES.  The user kept the bosses at ten for now, so each world's boss
 * is one of them under its story name and a world's colours, scaled to the
 * world's levels: the Green Maw stands guard over Mosswood as the Mossback
 * Guardian, the Salt Kraken rises in the Sunken Ruins as the Abyssal
 * Dreadfin, and so on.  Who you meet in a battle comes from the world's own
 * creatures, decided when you pay, so a reload cannot change it.
 *
 * Everything here is data and pure functions; the save changes in
 * game/creatureClash.
 */

import { BIOMES, bossById, creatureById, type Creature } from './creatures';
import { withLevel } from './creatureLevel';

export interface World {
  id: string;
  name: string;
  /** Where its fights are (an arena from BIOMES). */
  biome: string;
  /** Its battles' levels, first to fourth; the boss is at `hi`. */
  lo: number;
  hi: number;
  /** The boss it is, and the name it has here. */
  boss: string;
  bossName: string;
  /** Who you meet on the way. */
  pool: string[];
  /** One line on the map. */
  blurb: string;
}

const pool = (...biomes: string[]): string[] => [...new Set(biomes.flatMap((b) => BIOMES.find((x) => x.id === b)?.pool ?? []))];

export const WORLDS: World[] = [
  { id: 'mosswood', name: 'MOSSWOOD FRONTIER', biome: 'forests', lo: 1, hi: 4, boss: 'b_maw', bossName: 'MOSSBACK GUARDIAN', pool: pool('forests', 'fields'), blurb: 'WHERE EVERY TRAINER STARTS. MIND THE ROOTS.' },
  { id: 'sunken', name: 'SUNKEN RUINS', biome: 'ruins', lo: 5, hi: 8, boss: 'b_kraken', bossName: 'ABYSSAL DREADFIN', pool: pool('ruins', 'shore'), blurb: 'A DROWNED CITY. SOMETHING VAST MOVES UNDER IT.' },
  { id: 'emberfall', name: 'EMBERFALL CRATER', biome: 'volcano', lo: 9, hi: 12, boss: 'b_seraph', bossName: 'CINDERMAW', pool: pool('volcano', 'desert'), blurb: 'THE GROUND GLOWS. THE SKY RAINS FIRE.' },
  { id: 'crystal', name: 'SHATTERED CRYSTAL DEPTHS', biome: 'caves', lo: 13, hi: 16, boss: 'b_sphinx', bossName: 'PRISM WARDEN', pool: pool('caves', 'frozen'), blurb: 'EVERY WALL A MIRROR. TRUST NOTHING YOU SEE.' },
  { id: 'void', name: 'THE VOID CITADEL', biome: 'void', lo: 17, hi: 20, boss: 'b_lich', bossName: 'THE HOLLOW SOVEREIGN', pool: pool('void'), blurb: 'THE END OF THE MAP. ITS KING HAS NO FACE.' },
];

/** Battles in a world before its boss. */
export const STAGES = 4;

/** What a battle of world `w` (0-based) costs and pays: first time through, or as a replay. */
export function storyPrice(w: number, replay: boolean): { cost: number; win: number } {
  const n = w + 1;
  return replay ? { cost: n, win: 2 * n } : { cost: 2 * n, win: 4 * n };
}

/** The level of stage `s` (0..3 the battles, 4 the boss) of world `w`. */
export const stageLevel = (w: number, s: number): number => Math.min(WORLDS[w].hi, WORLDS[w].lo + s);

/**
 * The fight at stage `s` of world `w`: the foe (by id), its level, and how
 * sharp it plays.  A boss is the world's boss under its story name, its
 * health eased in the early worlds -- a level-4 trainer is not meant to meet
 * the full four hundred.
 */
export function storyFoe(w: number, s: number, foeId: string): { foe: Creature; level: number; boss: boolean; skill: number } | null {
  const world = WORLDS[w];
  if (!world) return null;
  const boss = s >= STAGES;
  const level = stageLevel(w, s);
  if (boss) {
    const b = bossById(world.boss);
    if (!b) return null;
    const grown = withLevel(b, level);
    const ease = 0.5 + 0.125 * w;
    return { foe: { ...grown, name: world.bossName, hp: Math.round(grown.hp * ease) }, level, boss: true, skill: 0.55 + 0.1 * w };
  }
  const c = creatureById(foeId);
  return c ? { foe: withLevel(c, level), level, boss: false, skill: 0.25 + 0.08 * w + 0.04 * s } : null;
}

/** Who the next battle of world `w` is against, drawn now (never the last one met there). */
export function drawStoryFoe(w: number, last: string | null, rng: () => number = Math.random): string {
  const p = WORLDS[w].pool.filter((id) => id !== last);
  const from = p.length ? p : WORLDS[w].pool;
  return from[Math.floor(rng() * from.length)];
}
