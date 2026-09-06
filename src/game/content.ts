/**
 * Cabinets and prizes.  PRD §7.5 layout, §7.6 prize list, §10.2 payout table.
 *
 * Every tier is a 2x on a win (PRD §10.2 / QFD §15 decision #1): the brief's
 * original "5 in / 3 out" medium tier was a guaranteed loss even when you won.
 */

import type { GameId } from '../core/state';

export type Tier = 'easy' | 'medium' | 'hard';

export interface CabinetDef {
  id: GameId;
  title: string;
  tier: Tier;
  cost: number;
  reward: number;
  x: number;
  y: number;
  /** Marquee tint. */
  color: number;
}

export const TIER_ECONOMY: Record<Tier, { cost: number; reward: number }> = {
  easy: { cost: 1, reward: 3 },
  medium: { cost: 3, reward: 6 },
  hard: { cost: 5, reward: 10 },
};

/**
 * NOTE on the count: the brief says "six minigames" but enumerates seven
 * (3 easy, 2 medium, 2 hard).  All seven are built — dropping one would be
 * narrowing the scope the customer actually described.
 */
export const CABINETS: CabinetDef[] = [
  { id: 'tictactoe', title: 'TIC-TAC-TOE', tier: 'easy', cost: 1, reward: 3, x: 38, y: 78, color: 0xff4fa3 },
  { id: 'snakes', title: 'SNAKES+LADDERS', tier: 'easy', cost: 1, reward: 3, x: 38, y: 116, color: 0x46c4bd },
  { id: 'airhockey', title: 'AIR HOCKEY', tier: 'easy', cost: 1, reward: 3, x: 38, y: 154, color: 0xffd45e },
  { id: 'hoops', title: 'HOOPS', tier: 'medium', cost: 3, reward: 6, x: 282, y: 78, color: 0xff7a3d },
  { id: 'whack', title: 'WHACK-A-FROG', tier: 'medium', cost: 3, reward: 6, x: 282, y: 116, color: 0x6fbb6a },
  { id: 'chompman', title: 'CHOMP-MAN', tier: 'hard', cost: 5, reward: 10, x: 282, y: 154, color: 0x7b4bd8 },
  { id: 'grudge', title: 'GRUDGE', tier: 'hard', cost: 5, reward: 10, x: 130, y: 66, color: 0xc31f2e },
];

export function cabinetById(id: GameId): CabinetDef {
  const c = CABINETS.find((x) => x.id === id);
  if (!c) throw new Error(`unknown cabinet ${id}`);
  return c;
}

export interface PrizeDef {
  id: string;
  name: string;
  cost: number;
  color: number;
}

/**
 * PRD §7.6.  The cheapest thing in the room is 200 tokens against a starting
 * bankroll of 20.  That gap is the point — most players never redeem, and the
 * PS5 exists to be looked at.  (QFD §15 decision #2.)
 */
export const PRIZES: PrizeDef[] = [
  { id: 'bunny', name: 'STUFFED BUNNY', cost: 200, color: 0xfff0c9 },
  { id: 'lavalamp', name: 'LAVA LAMP', cost: 250, color: 0xff7a3d },
  { id: 'skateboard', name: 'SKATEBOARD', cost: 350, color: 0x7b4bd8 },
  { id: 'headset', name: 'GAMING HEADSET', cost: 500, color: 0x46c4bd },
  { id: 'ps5', name: 'PS5', cost: 750, color: 0xd6dce4 },
];

export function prizeById(id: string): PrizeDef | undefined {
  return PRIZES.find((p) => p.id === id);
}

/** PRD §7.5: the ticket counter, the prize case, and the bell nobody answers. */
export const COUNTER = { x: 176, y: 46, w: 126, h: 20 };
export const BELL = { x: 188, y: 58 };
export const PRIZE_CASE = { x: 206, y: 46, w: 96, h: 18 };
/** PRD AD-5: only reachable at night, when the arcade is closed. */
export const COUNTER_VAULT = { x: 239, y: 68 };
export const STAFF_DOOR = { x: 288, y: 52 };
