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
  /**
   * What the thing actually is on the floor.  Everything in this arcade is a
   * cabinet except Froggy's blackjack table, which is furniture with a dealer
   * behind it — the bet is not a fixed coin slot, so it cannot be a machine.
   */
  fixture?: 'cabinet' | 'table';
  /**
   * Which room the cabinet stands in.  The hub has a doorway on its left wall
   * into the annex, which exists so the floor can grow without the hub turning
   * into a wall of cabinets.  Defaults to the hub.
   */
  room?: 'hub' | 'annex' | 'casino';
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
/**
 * Three rooms, and the price of admission goes up as you go in.
 *
 *   hub     one to three tokens.  The games a person plays.
 *   annex   five to seven.  The ones that take your afternoon.
 *   casino  the ones that are not games at all: chamber, slots, cards.
 *
 * Sorting them this way means the room you are standing in tells you what you
 * are risking, and a player who has walked to the back room has already made a
 * decision about that.
 *
 * Positions are hand-placed, not laid out.  Anything added here has to keep
 * clear of the counter (x 112-240), the doorway on the left wall (y 118), the
 * front door (bottom centre) and — in the hub — the change machine on the back
 * wall, which the player stands at around x 272, y 62 and which must not have a
 * cabinet's click zone over it.
 */
export const CABINETS: CabinetDef[] = [
  // ---- the front room: everything that costs one to three tokens
  { id: 'tictactoe', title: 'TIC-TAC-TOE', tier: 'easy', cost: 1, reward: 3, x: 34, y: 86, color: 0xff4fa3 },
  { id: 'snakes', title: 'SNAKES+LADDERS', tier: 'easy', cost: 1, reward: 3, x: 68, y: 86, color: 0x46c4bd },
  { id: 'hoops', title: 'HOOPS', tier: 'medium', cost: 3, reward: 6, x: 34, y: 162, color: 0xff7a3d },
  { id: 'whack', title: 'WHACK-A-FROG', tier: 'medium', cost: 3, reward: 6, x: 68, y: 162, color: 0x6fbb6a },
  // Low on the right wall on purpose: the change machine is above it, and a
  // cabinet's click zone up there swallows every attempt to use the machine.
  { id: 'battleship', title: 'BATTLESHIP', tier: 'medium', cost: 3, reward: 6, x: 286, y: 152, color: 0x1d6f8f },

  // ---- the back room: three to seven a go
  { id: 'grudge', title: 'GRUDGE', tier: 'hard', cost: 5, reward: 10, x: 48, y: 96, color: 0xc31f2e, room: 'annex' },
  { id: 'donkeykong', title: 'BARREL CLIMB', tier: 'hard', cost: 3, reward: 6, x: 112, y: 96, color: 0xd9822b, room: 'annex' },
  { id: 'airhockey', title: 'AIR HOCKEY', tier: 'hard', cost: 5, reward: 10, x: 176, y: 96, color: 0xffd45e, room: 'annex' },
  { id: 'chompman', title: 'CHOMP-MAN', tier: 'hard', cost: 7, reward: 7, x: 240, y: 96, color: 0x7b4bd8, room: 'annex' },

  // ---- and the room at the back, where none of it is a game
  { id: 'slots', title: 'FROGGY SLOTS', tier: 'medium', cost: 3, reward: 6, x: 96, y: 96, color: 0xff4fa3, room: 'casino' },
  // The table takes a minimum, not a price: `cost` is the ante Froggy will not
  // deal under, and `reward` is what that ante pays back at 2x.  Anything above
  // it is raised at the table through the shell (MinigameApi.raise).
  {
    id: 'blackjack',
    title: 'BLACKJACK',
    tier: 'easy',
    cost: 1,
    reward: 2,
    x: 160,
    y: 118,
    color: 0x2f8d4f,
    room: 'casino',
    fixture: 'table',
  },
  { id: 'roulette', title: 'CHAMBER', tier: 'hard', cost: 5, reward: 10, x: 224, y: 96, color: 0x8a2b34, room: 'casino' },
];

/** Cabinets standing in a given room.  Anything unmarked lives in the hub. */
export function cabinetsIn(room: 'hub' | 'annex' | 'casino'): CabinetDef[] {
  return CABINETS.filter((c) => (c.room ?? 'hub') === room);
}

/** The doorway between the two rooms, on the hub's left wall. */
export const ANNEX_DOOR = { x: 20, y: 118, w: 14, h: 40 };
/** And on through the annex's left wall, into the machines that take money. */
export const CASINO_DOOR = { x: 20, y: 118, w: 14, h: 40 };

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

/**
 * What the man outside pays for a prize: half what the counter charged for it,
 * in cash.  He says it like it is a favour.
 *
 * Half is the point of the whole arrangement — he gets a two hundred token
 * bunny for a hundred in notes, and the player, who cannot eat tokens, takes
 * it.  PRIZES is the only place the token price lives, so this follows it.
 */
export function cashFor(prize: PrizeDef): number {
  return Math.floor(prize.cost / 2);
}

/**
 * What the change machine gives you: one token for every two in cash.
 *
 * The same rate the man pays for prizes, pointed the other way, and between
 * the two of them the arcade takes three quarters of everything that passes
 * through it.  Nobody in this building is on your side.
 */
export function tokensForCash(cash: number): number {
  return Math.max(0, Math.floor(cash / 2));
}

/** Every prize sold means the job is done. */
export function allPrizesSold(sold: readonly string[]): boolean {
  return PRIZES.every((p) => sold.includes(p.id));
}

/** PRD §7.5: the ticket counter, the prize case, and the bell nobody answers. */
export const COUNTER = { x: 112, y: 44, w: 128, h: 18 };
export const BELL = { x: 122, y: 56 };
export const PRIZE_CASE = { x: 126, y: 44, w: 100, h: 18 };
/** PRD AD-5: only reachable at night, when the arcade is closed. */
export const COUNTER_VAULT = { x: 200, y: 66 };
export const STAFF_DOOR = { x: 234, y: 40 };
