/**
 * PERSONAL BESTS.
 *
 * One number per cabinet where there is a real performance to beat, measured
 * the way that cabinet is actually good or bad at -- not one generic score for
 * everything:
 *
 *   Froggy Kong     fastest time to the exit             lower is better
 *   Chubby Chomp    fastest time to fill him up          lower is better
 *   Whack-a-Frog    most frogs whacked                   higher is better
 *   Bowling         best score                           higher is better
 *   Frog Pond Hunt  fewest searches to find them all     lower is better
 *   Chamber         most pulls survived                  higher is better
 *   Frog Race       most tokens won on one race          higher is better
 *   Dance Off       best score                           higher is better
 *   Mini Duels      most wins in a row                   higher is better
 *   Grudge          fastest win (fighting time)          lower is better
 *   Air Hockey      biggest winning margin               higher is better
 *   The Flood       fastest escape through the hatch     lower is better
 *   Frog Cross      best score                           higher is better
 *   Car Chase       most cash grabbed in one chase       higher is better
 *   Fence Wars      most damage dealt in one match       higher is better
 *   Bog Ball        biggest winning margin               higher is better
 *   Froggy Slots    biggest single spin                  higher is better
 *   Frogster Mash   biggest bank on a win                higher is better
 *   Froggy 21       biggest single hand won              higher is better
 *   Wheel           biggest single prize                 higher is better
 *
 * (Frog Cross, Car Chase and Fence Wars kept their bests on the run as
 * `highScores` before these did: until a new one is set, that is the best.)
 *
 * KEPT WITH THE SETTINGS, NOT WITH THE RUN.  The run is wiped by the reset
 * after a game over; a best is the player's, and it outlives that the way
 * their volume setting does.  A worse result never replaces a better one --
 * `submit` compares in the right direction for each record, so a slower time
 * cannot overwrite a faster one.
 */

import { store, type GameId } from './state';

export interface RecordDef {
  /** Lower numbers are better (times, click counts). */
  lower: boolean;
  /** How the number is written: "42.3S", "14 CLICKS". */
  format: (n: number) => string;
  /** What the number is, short, for the header: "FASTEST 42.3S". */
  short: (n: number) => string;
  /** What the number is, as a sentence, for the card. */
  long: (n: number) => string;
  /**
   * The run's own `highScores` held this best before the records did, and
   * still keeps it: the best shown is the higher of the two.  Only for a
   * higher-is-better record.
   */
  fromRun?: boolean;
}

const secs = (n: number) => `${(Math.round(n * 10) / 10).toFixed(1)}S`;

export const RECORDS: Partial<Record<GameId, RecordDef>> = {
  donkeykong: {
    lower: true,
    format: secs,
    short: (n) => `FASTEST ${secs(n)}`,
    long: (n) => `YOUR BEST: EXIT IN ${secs(n)}`,
  },
  hoops: {
    lower: true,
    format: secs,
    short: (n) => `FASTEST ${secs(n)}`,
    long: (n) => `YOUR BEST: FED HIM IN ${secs(n)}`,
  },
  whack: {
    lower: false,
    format: (n) => `${n} HITS`,
    short: (n) => `MOST ${n} HITS`,
    long: (n) => `YOUR BEST: ${n} FROGS WHACKED`,
  },
  bowling: {
    lower: false,
    format: (n) => `${n}`,
    short: (n) => `BEST SCORE ${n}`,
    long: (n) => `YOUR BEST SCORE: ${n}`,
  },
  battleship: {
    lower: true,
    format: (n) => `${n} CLICKS`,
    short: (n) => `FEWEST ${n} CLICKS`,
    long: (n) => `YOUR BEST: ALL FOUND IN ${n} SEARCHES`,
  },
  roulette: {
    lower: false,
    format: (n) => `${n} PULLS`,
    short: (n) => `MOST ${n} PULLS`,
    long: (n) => `YOUR BEST: ${n} PULLS SURVIVED`,
  },
  frograce: {
    lower: false,
    format: (n) => `${n} TOKENS`,
    short: (n) => `BEST WIN ${n}`,
    long: (n) => `YOUR BIGGEST WIN: ${n} TOKENS`,
  },
  danceoff: {
    lower: false,
    format: (n) => `${n}`,
    short: (n) => `BEST SCORE ${n}`,
    long: (n) => `YOUR BEST SCORE: ${n}`,
  },
  tictactoe: {
    lower: false,
    format: (n) => `${n} IN A ROW`,
    short: (n) => `BEST RUN ${n}`,
    long: (n) => `YOUR BEST: ${n} WIN${n === 1 ? '' : 'S'} IN A ROW`,
  },
  grudge: {
    lower: true,
    format: secs,
    short: (n) => `FASTEST WIN ${secs(n)}`,
    long: (n) => `YOUR BEST: WON IN ${secs(n)} OF FIGHTING`,
  },
  airhockey: {
    lower: false,
    format: (n) => `+${n}`,
    short: (n) => `BEST WIN BY ${n}`,
    long: (n) => `YOUR BEST: WON BY ${n} GOAL${n === 1 ? '' : 'S'}`,
  },
  fallingblocks: {
    lower: true,
    format: secs,
    short: (n) => `FASTEST ${secs(n)}`,
    long: (n) => `YOUR BEST: OUT OF THE HATCH IN ${secs(n)}`,
  },
  frogcross: {
    lower: false,
    format: (n) => `${n}`,
    short: (n) => `BEST SCORE ${n}`,
    long: (n) => `YOUR BEST SCORE: ${n}`,
    fromRun: true,
  },
  carchase: {
    lower: false,
    format: (n) => `$${n}`,
    short: (n) => `MOST $${n}`,
    long: (n) => `YOUR BEST: $${n} GRABBED IN ONE CHASE`,
    fromRun: true,
  },
  frogvslizard: {
    lower: false,
    format: (n) => `${n}`,
    short: (n) => `MOST DAMAGE ${n}`,
    long: (n) => `YOUR BEST: ${n} DAMAGE IN ONE MATCH`,
    fromRun: true,
  },
  bogball: {
    lower: false,
    format: (n) => `+${n}`,
    short: (n) => `BEST WIN BY ${n}`,
    long: (n) => `YOUR BEST: WON BY ${n} GOAL${n === 1 ? '' : 'S'}`,
  },
  slots: {
    lower: false,
    format: (n) => `${n} TOKENS`,
    short: (n) => `BEST SPIN ${n}`,
    long: (n) => `YOUR BEST SPIN: ${n} TOKENS`,
  },
  padbattles: {
    lower: true,
    format: secs,
    short: (n) => `FASTEST WIN ${secs(n)}`,
    long: (n) => `YOUR BEST: A WIN IN ${secs(n)}`,
  },
  croaked: {
    lower: true,
    format: secs,
    short: (n) => `FASTEST WIN ${secs(n)}`,
    long: (n) => `YOUR BEST: A WIN IN ${secs(n)}`,
  },
  frogstermash: {
    lower: false,
    format: (n) => `${n} TOKENS`,
    short: (n) => `BEST BANK ${n}`,
    long: (n) => `YOUR BEST: BANKED ${n} TOKENS`,
  },
  blackjack: {
    lower: false,
    format: (n) => `${n} TOKENS`,
    short: (n) => `BEST HAND ${n}`,
    long: (n) => `YOUR BEST HAND: WON ${n} TOKENS`,
  },
  wheel: {
    lower: false,
    format: (n) => `${n} TOKENS`,
    short: (n) => `BEST PRIZE ${n}`,
    long: (n) => `YOUR BEST PRIZE: ${n} TOKENS`,
  },
};

const KEY = 'froggy.records';

function load(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY);
    const got = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(got)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

let cache: Record<string, number> | null = null;

function all(): Record<string, number> {
  cache ??= load();
  return cache;
}

/** The best so far, or null if this cabinet keeps no record or none is set. */
export function best(id: GameId): number | null {
  const def = RECORDS[id];
  if (!def) return null;
  const v = all()[id];
  // (the run's old high score counts too: these three are all higher-is-better)
  const old = def.fromRun ? store.highScore(id) : 0;
  if (typeof v === 'number') return old > v ? old : v;
  return old > 0 ? old : null;
}

/**
 * Offer a result.  Kept only if it is better than the best, in this record's
 * direction; returns whether it was.  A cabinet with no record ignores it.
 */
export function submit(id: GameId, value: number): boolean {
  const def = RECORDS[id];
  if (!def || !Number.isFinite(value)) return false;
  const v = def.lower ? Math.round(value * 10) / 10 : Math.floor(value);
  if (!def.lower && v <= 0) return false;
  // (against the records' own best: the run's copy is the cabinet's to keep)
  const kept = all()[id];
  const was = typeof kept === 'number' ? kept : null;
  const better = was === null || (def.lower ? v < was : v > was);
  if (!better) return false;
  all()[id] = v;
  try {
    localStorage.setItem(KEY, JSON.stringify(all()));
  } catch {
    /* private mode: the best lasts the session, which is all it can do */
  }
  return true;
}

/** For the harness: forget every best. */
export function clearRecords(): void {
  cache = {};
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
