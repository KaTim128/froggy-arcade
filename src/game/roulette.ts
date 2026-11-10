/**
 * ROULETTE's rules: a single-zero wheel, as in any casino.  Kept apart from
 * the table's screen so the room's furniture (art/rouletteTable) paints the
 * very same wheel and layout the game plays on.
 *
 * Thirty-seven pockets, 0 to 36.  Every bet pays as a casino pays, so the
 * zero is the whole of the house's edge: 1 in 37, about 2.7% of every bet,
 * on every bet alike.
 *
 *   a single number      35 to 1   (36 back)
 *   a dozen (1-12 ...)    2 to 1   (3 back)
 *   red / black, odd / even, 1-18 / 19-36    1 to 1   (2 back)
 *
 * The zero is none of the outside bets: on a zero they all lose.
 */

/** The pockets in the order they sit round a single-zero wheel. */
export const WHEEL_ORDER: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export const RED_NUMBERS: ReadonlySet<number> = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

/** A spot on the layout a chip can go on. */
export type BetSpot = number | 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' | 'dozen1' | 'dozen2' | 'dozen3';

export const OUTSIDE: readonly BetSpot[] = ['low', 'even', 'red', 'black', 'odd', 'high'];
export const DOZENS: readonly BetSpot[] = ['dozen1', 'dozen2', 'dozen3'];

/** What it says on the felt. */
export function spotLabel(s: BetSpot): string {
  if (typeof s === 'number') return `${s}`;
  return { red: 'RED', black: 'BLACK', odd: 'ODD', even: 'EVEN', low: '1-18', high: '19-36', dozen1: '1ST 12', dozen2: '2ND 12', dozen3: '3RD 12' }[s];
}

/** How many times the stake comes back when it wins (stake included). */
export function returns(s: BetSpot): number {
  if (typeof s === 'number') return 36;
  return s.startsWith('dozen') ? 3 : 2;
}

/** Does this spot win on this pocket? */
export function wins(s: BetSpot, n: number): boolean {
  if (typeof s === 'number') return s === n;
  if (n === 0) return false;
  switch (s) {
    case 'red':
      return RED_NUMBERS.has(n);
    case 'black':
      return !RED_NUMBERS.has(n);
    case 'odd':
      return n % 2 === 1;
    case 'even':
      return n % 2 === 0;
    case 'low':
      return n <= 18;
    case 'high':
      return n >= 19;
    case 'dozen1':
      return n <= 12;
    case 'dozen2':
      return n >= 13 && n <= 24;
    default:
      return n >= 25;
  }
}

/**
 * ---- COVERING THE WHEEL (user, 8 Nov).  Standard odds, but no blanket of
 * single numbers: at most MAX_NUMBERS different numbers a spin, and at most
 * MAX_ON_NUMBER on any one of them -- covering half the wheel at 35 to 1
 * turned the table into a money printer in play, whatever the long odds.
 */
export const MAX_NUMBERS = 5;
export const MAX_ON_NUMBER = 25;
/** The most the table takes in a spin, every bet together. */
export const TABLE_MAX = 500;

/** Why these bets cannot go down, or null when they can. */
export function betProblem(bets: ReadonlyMap<BetSpot, number>): string | null {
  let total = 0;
  let numbers = 0;
  for (const [s, amt] of bets) {
    if (!Number.isInteger(amt) || amt <= 0) return 'A BET MUST BE A WHOLE TOKEN OR MORE';
    if (typeof s === 'number') {
      if (!Number.isInteger(s) || s < 0 || s > 36) return 'NO SUCH NUMBER';
      if (amt > MAX_ON_NUMBER) return `AT MOST ${MAX_ON_NUMBER} ON ONE NUMBER`;
      numbers++;
    } else if (!['red', 'black', 'odd', 'even', 'low', 'high', 'dozen1', 'dozen2', 'dozen3'].includes(s)) return 'NO SUCH BET';
    total += amt;
  }
  if (numbers > MAX_NUMBERS) return `AT MOST ${MAX_NUMBERS} NUMBERS A SPIN`;
  if (total > TABLE_MAX) return `THE TABLE LIMIT IS ${TABLE_MAX} A SPIN`;
  return null;
}

/** The whole round on pocket `n`: what went down, what comes back (winners' stakes included), and the net. */
export function round(bets: ReadonlyMap<BetSpot, number>, n: number): { stake: number; pay: number; net: number } {
  let stake = 0;
  let pay = 0;
  for (const [s, amt] of bets) {
    stake += amt;
    if (wins(s, n)) pay += amt * returns(s);
  }
  return { stake, pay, net: pay - stake };
}

/** What a spin of these bets pays back on pocket `n` (stakes of the winners included); nothing for bets that break the table's rules. */
export function settle(bets: ReadonlyMap<BetSpot, number>, n: number): number {
  if (betProblem(bets)) return 0;
  return round(bets, n).pay;
}

/** One fair spin: every pocket 1 in 37. */
export function spinPocket(rand: () => number = Math.random): number {
  return Math.min(36, Math.floor(rand() * 37));
}

export function colourOf(n: number): 'red' | 'black' | 'green' {
  return n === 0 ? 'green' : RED_NUMBERS.has(n) ? 'red' : 'black';
}
