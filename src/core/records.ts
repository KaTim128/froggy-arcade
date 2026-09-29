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
 *
 * KEPT WITH THE SETTINGS, NOT WITH THE RUN.  The run is wiped by the reset
 * after a game over; a best is the player's, and it outlives that the way
 * their volume setting does.  A worse result never replaces a better one --
 * `submit` compares in the right direction for each record, so a slower time
 * cannot overwrite a faster one.
 */

import type { GameId } from './state';

export interface RecordDef {
  /** Lower numbers are better (times, click counts). */
  lower: boolean;
  /** How the number is written: "42.3S", "14 CLICKS". */
  format: (n: number) => string;
  /** What the number is, short, for the header: "FASTEST 42.3S". */
  short: (n: number) => string;
  /** What the number is, as a sentence, for the card. */
  long: (n: number) => string;
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
  if (!RECORDS[id]) return null;
  const v = all()[id];
  return typeof v === 'number' ? v : null;
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
  const was = best(id);
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
