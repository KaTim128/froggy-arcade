/**
 * Cabinets and prizes.  PRD §7.5 layout, §7.6 prize list, §10.2 payout table.
 *
 * Every tier is a 2x on a win (PRD §10.2 / QFD §15 decision #1): the brief's
 * original "5 in / 3 out" medium tier was a guaranteed loss even when you won,
 * and the easy tier's 1-in / 3-out was the one place the arcade paid triple.
 */

import type { GameId } from '../core/state';

export type Tier = 'easy' | 'medium' | 'hard';

/** The shapes a cabinet screen can be painted with.  See `art/cabinet.ts`. */
export type Motif =
  | 'grid'
  | 'blocks'
  | 'ball'
  | 'mallet'
  | 'ladder'
  | 'fist'
  | 'car'
  | 'road'
  | 'ship'
  | 'pins'
  | 'cards'
  | 'reels'
  | 'wheel'
  | 'chamber'
  | 'steps'
  | 'throw';

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
  fixture?: 'cabinet' | 'table' | 'wheel';
  /**
   * Free to walk up to.  A cabinet takes its coin at the door — you pay, you
   * play, and the how-to-play card comes after the token is gone.  The table
   * and the wheel do not work like that: the bet IS the game, so they take
   * nothing to sit down at, the rules are readable for free, and the first
   * token only moves when the player deals or spins.  `cost` still means
   * something at these two — it is the smallest bet the fixture will take —
   * it is simply charged inside the game rather than at the door.
   */
  freeToEnter?: boolean;
  /**
   * The machine's own identity, painted on it: one or two characters on the
   * marquee, and a motif on the screen.  Every cabinet on the floor is the
   * same box, so this is what stops the room reading as a row of identical
   * furniture — you learn where a game is by the shape on its screen.
   */
  symbol?: string;
  motif?: Motif;
  /**
   * Which room the cabinet stands in.  The hub has a doorway on its left wall
   * into the annex, which exists so the floor can grow without the hub turning
   * into a wall of cabinets.  Defaults to the hub.
   */
  room?: 'hub' | 'annex' | 'casino';
}

/**
 * The standard table, and the only one a normal cabinet may use.
 *
 *   1 in -> 2 out    3 in -> 6 out    5 in -> 10 out    7 in -> 15 out
 *   10 in -> 20 out, for the longest cabinet in the building
 *
 * The reward is the TOTAL handed back on a win, not a bonus on top of the
 * stake — the stake is already gone, so 3 in and 6 out is three tokens of
 * profit.  Nothing re-deducts the entry cost when it pays.
 *
 * The exceptions are the fixtures that run their own economy and say so on the
 * machine: the slots, the wheel, the chamber, and the two cabinets that pay a
 * formula off a score (frog cross, car chase).
 */
export const TIER_ECONOMY: Record<Tier, { cost: number; reward: number }> = {
  easy: { cost: 1, reward: 2 },
  medium: { cost: 3, reward: 6 },
  hard: { cost: 5, reward: 10 },
};

/** What a normal cabinet at this price must pay on a win. */
// 10 -> 20 is the top of it: the two longest cabinets in the building were
// repriced above seven, and the rule the table encodes is "a win is worth
// about twice the stake", not "these four prices and no others".
export const STANDARD_REWARD: Record<number, number> = { 1: 2, 3: 6, 5: 10, 7: 15, 10: 20 };

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
 * clear of the counter (x 112-258), the doorway on the left wall (y 118), the
 * front door (bottom centre) and — in the hub — the change machine on the back
 * wall, which the player stands at around x 272, y 62 and which must not have a
 * cabinet's click zone over it.
 */
export const CABINETS: CabinetDef[] = [
  // ---- the front room: everything that costs one to three tokens
  // A token in, two out: you win one.  Three out was a 3x on the cheapest
  // games in the building and the only positive-EV corner of the floor.
  { id: 'tictactoe', title: 'TIC-TAC-TOE', tier: 'easy', cost: 1, reward: 2, x: 52, y: 88, color: 0xff4fa3, symbol: 'X', motif: 'grid' },
  // Seven in, fifteen out, in the slot The Flood briefly stood in and Snakes &
  // Ladders stood in before that.  A table game in a room of screens: the only
  // cabinet out here with moving parts behind the glass.
  { id: 'pinball', title: 'FROGGY PINBALL', tier: 'hard', cost: 7, reward: 15, x: 98, y: 88, color: 0xff4fa3, symbol: 'PB', motif: 'pins' },
  // The bottom row: two either side of the front door, in line with the two
  // above.  Nothing sits under the change machine on the right wall, because a
  // cabinet's click zone up there swallows every attempt to use it.
  //
  // THE LEFT COLUMN STANDS AT 52, NOT 30.  The way through to the back room is
  // an opening in the left wall between y 95 and 141, and a cabinet at 30 is
  // 26 pixels wide from 17 — it stood in the doorway, took the light coming
  // out of it, and put its own click zone over the door's.  Both rows moved
  // together so the grid stays a grid; the back room's left column has always
  // been at 48 for the same reason.
  { id: 'hoops', title: 'HOOPS', tier: 'medium', cost: 3, reward: 6, x: 52, y: 164, color: 0xff7a3d, symbol: 'H', motif: 'ball' },
  { id: 'whack', title: 'WHACK-A-FROG', tier: 'medium', cost: 3, reward: 6, x: 98, y: 164, color: 0x6fbb6a, symbol: 'W', motif: 'mallet' },
  { id: 'bowling', title: 'BOWLING', tier: 'medium', cost: 3, reward: 6, x: 244, y: 164, color: 0xb9884f, symbol: 'BW', motif: 'pins' },
  { id: 'battleship', title: 'BATTLESHIP', tier: 'medium', cost: 3, reward: 6, x: 290, y: 164, color: 0x1d6f8f, symbol: 'BS', motif: 'ship' },

  // ---- the back room: five to seven a go
  { id: 'grudge', title: 'GRUDGE', tier: 'hard', cost: 7, reward: 15, x: 48, y: 96, color: 0xc31f2e, room: 'annex', symbol: 'VS', motif: 'fist' },
  // Every seven-token cabinet pays fifteen: eight tokens of profit for the
  // longest games in the building, which is the top of the standard table.
  { id: 'donkeykong', title: 'BARREL CLIMB', tier: 'hard', cost: 7, reward: 15, x: 112, y: 96, color: 0xd9822b, room: 'annex', symbol: 'BC', motif: 'ladder' },
  { id: 'airhockey', title: 'AIR HOCKEY', tier: 'hard', cost: 5, reward: 10, x: 176, y: 96, color: 0xffd45e, room: 'annex', symbol: 'AH', motif: 'ball' },
  // THE FLOOD lives back here now, in the slot Chomp-Man stood in.  It belongs
  // with the long games rather than in the front room with the one-token
  // board: it is a minute of climbing and it takes seven to start.  The id is
  // still `fallingblocks` and that is deliberate — it is the key a saved run's
  // high score and play count are filed under, and renaming it would orphan
  // every save in existence to gain nothing but a tidier string.
  { id: 'fallingblocks', title: 'THE FLOOD', tier: 'hard', cost: 7, reward: 15, x: 240, y: 96, color: 0x2f7fb5, room: 'annex', symbol: 'FD', motif: 'blocks' },
  // Along the bottom wall, under the middle two of the row above.  Neither
  // has a fixed reward: a run is worth what it scored, and the module names
  // the payout.
  // Ten in, twenty out: the dearest cabinet in the building.  It is the one you
  // lose by being out of time rather than out of lives, and the only one played
  // to a beat.
  { id: 'danceoff', title: 'DANCE OFF', tier: 'hard', cost: 10, reward: 20, x: 48, y: 162, color: 0xff4fa3, room: 'annex', symbol: 'DO', motif: 'steps' },
  { id: 'frogcross', title: 'FROG CROSS', tier: 'hard', cost: 7, reward: 15, x: 112, y: 162, color: 0x6fbb6a, room: 'annex', symbol: 'FC', motif: 'road' },
  { id: 'carchase', title: 'CAR CHASE', tier: 'hard', cost: 5, reward: 10, x: 176, y: 162, color: 0x46a0e0, room: 'annex', symbol: 'CC', motif: 'car' },
  // Ten on a five, like every other five-token cabinet on the floor.
  { id: 'frogvslizard', title: 'FROG VS LIZARD', tier: 'hard', cost: 5, reward: 10, x: 240, y: 162, color: 0xa8c23f, room: 'annex', symbol: 'FL', motif: 'throw' },

  // ---- and the room at the back, where none of it is a game
  // Two tokens is the price of the first spin; the rest are raised through
  // the shell, and the wins are paid the same way.  See slots.ts.
  { id: 'slots', title: 'FROGGY SLOTS', tier: 'medium', cost: 2, reward: 6, x: 96, y: 96, color: 0xff4fa3, room: 'casino', symbol: '777', motif: 'reels' },
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
    freeToEnter: true,
    symbol: '21',
    motif: 'cards',
  },
  { id: 'roulette', title: 'CHAMBER', tier: 'hard', cost: 5, reward: 10, x: 224, y: 96, color: 0x8a2b34, room: 'casino', symbol: '6', motif: 'chamber' },
  // Not a machine either: a wheel on a post, in the corner of the casino.
  // Forty a spin, and what it pays is whatever the pointer is over when it
  // stops — `reward` is only what the room's badge would say, since the wheel
  // settles every spin itself through the shell (MinigameApi.payout).
  {
    id: 'wheel',
    title: 'WHEEL OF FORTUNE',
    tier: 'hard',
    cost: 40,
    reward: 40,
    x: 58,
    y: 140,
    color: 0xffd45e,
    room: 'casino',
    fixture: 'wheel',
    freeToEnter: true,
    symbol: '*',
    motif: 'wheel',
  },
  // The bottom row of the casino: one machine under the slots, with the table
  // left clear beside it.  A seven-token game that ends in a single decision
  // rather than a run, which is what the room is for.
  { id: 'frograce', title: 'FROG RACE', tier: 'hard', cost: 7, reward: 15, x: 96, y: 162, color: 0x6fbb6a, room: 'casino', symbol: 'RC', motif: 'road' },
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

/** The shapes a prize can be modelled with on the shelf.  See PrizeCounter. */
export type PrizeShape =
  | 'ring'
  | 'sheet'
  | 'duck'
  | 'bear'
  | 'lamp'
  | 'board'
  | 'headset'
  | 'guitar'
  | 'console'
  | 'robot'
  | 'ball'
  | 'car'
  | 'rocket'
  | 'cube';

export interface PrizeDef {
  id: string;
  name: string;
  cost: number;
  color: number;
  /** How it is drawn on the shelf.  Defaults to a plain box. */
  shape?: PrizeShape;
}

/**
 * PRD §7.6.  Nine things on the shelf, and a curve that means them.
 *
 * The cheap end stays cheap — a keyring at forty against a starting bankroll
 * of twenty, so the counter is somewhere you can actually reach — and then it
 * climbs hard.  Everything above the duck is a decision to keep playing rather
 * than a thing you happen to be able to afford, and the whole shelf is two
 * thousand nine hundred and thirty tokens, which nobody clears by accident.
 *
 * The man outside still pays half of the counter's price (`cashFor`), so the
 * sell-and-rechange loop keeps its shape at every rung.
 */
export const PRIZES: PrizeDef[] = [
  { id: 'keyring', name: 'FROG KEYRING', cost: 40, color: 0x6fbb6a, shape: 'ring' },
  { id: 'stickers', name: 'STICKER PACK', cost: 70, color: 0xffd45e, shape: 'sheet' },
  { id: 'duck', name: 'RUBBER DUCK', cost: 120, color: 0xffb038, shape: 'duck' },
  { id: 'bunny', name: 'BUNNY', cost: 180, color: 0xfff0c9, shape: 'bear' },
  { id: 'lavalamp', name: 'LAVA LAMP', cost: 260, color: 0xff7a3d, shape: 'lamp' },
  { id: 'skateboard', name: 'SKATEBOARD', cost: 360, color: 0x7b4bd8, shape: 'board' },
  { id: 'headset', name: 'HEADSET', cost: 480, color: 0x46c4bd, shape: 'headset' },
  { id: 'guitar', name: 'GUITAR', cost: 620, color: 0xc31f2e, shape: 'guitar' },
  { id: 'ps5', name: 'PS5', cost: 800, color: 0xd6dce4, shape: 'console' },
];

/**
 * THE SHELF REFILLS.  Clearing it used to be the end of the counter — nine
 * prizes, and then a wall of OWNED that the player could do nothing with while
 * the arcade carried on taking their tokens.  Every prize on the shelf being
 * redeemed now brings a new lot out of the back: different toys, different
 * colours, the same price curve, so there is always something to be playing
 * for and the loop never runs out of an end to aim at.
 *
 * A wave is generated rather than stored: the id carries the wave and the slot
 * it came from ("w3-5"), so any prize the player is carrying can be rebuilt
 * from its id alone, however long ago it came off the shelf.  Wave 0 is the
 * hand-written list above, which is the shelf the game opens on.
 */
const RESTOCK_NAMES = [
  'FROG PLUSH',
  'TOY ROBOT',
  'HOPPER BALL',
  'PUZZLE CUBE',
  'SQUIRT GUN',
  'BOUNCY BALL',
  'MODEL ROCKET',
  'TOY RACER',
  'FOAM SWORD',
  'DISCO BALL',
  'TEDDY BEAR',
  'RC DRONE',
  'NEON SIGN',
  'JOYSTICK',
  'RECORDS',
  'HELMET',
  'GLOW LAMP',
  'MINI FRIDGE',
  'TOY GUITAR',
  'PARTY KITE',
];
const RESTOCK_SHAPES: PrizeShape[] = [
  'bear', // FROG PLUSH
  'robot', // TOY ROBOT
  'ball', // HOPPER BALL
  'cube', // PUZZLE CUBE
  'rocket', // SQUIRT GUN
  'ball', // BOUNCY BALL
  'rocket', // MODEL ROCKET
  'car', // TOY RACER
  'rocket', // FOAM SWORD
  'ball', // DISCO BALL
  'bear', // TEDDY BEAR
  'robot', // RC DRONE
  'sheet', // NEON SIGN
  'console', // JOYSTICK
  'sheet', // RECORDS
  'headset', // HELMET
  'lamp', // GLOW LAMP
  'cube', // MINI FRIDGE
  'guitar', // TOY GUITAR
  'sheet', // PARTY KITE
];
const RESTOCK_COLOURS = [0x6fbb6a, 0xffd45e, 0xff7a3d, 0x46c4bd, 0x7b4bd8, 0xff4fa3, 0xd6dce4, 0xc31f2e, 0xffb038, 0xa8c23f];
/** The price curve every shelf keeps, whatever is standing on it. */
const PRIZE_COSTS = [40, 70, 120, 180, 260, 360, 480, 620, 800];

/** Deterministic per (wave, slot), so a shelf is the same shelf every visit. */
function prizeRandom(wave: number, slot: number): () => number {
  let seed = (wave * 9781 + slot * 131 + 17) >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function makePrize(wave: number, slot: number): PrizeDef {
  const rand = prizeRandom(wave, slot);
  const name = RESTOCK_NAMES[Math.floor(rand() * RESTOCK_NAMES.length)];
  const shape = RESTOCK_SHAPES[RESTOCK_NAMES.indexOf(name)] ?? 'cube';
  const colour = RESTOCK_COLOURS[Math.floor(rand() * RESTOCK_COLOURS.length)];
  return { id: `w${wave}-${slot}`, name, cost: PRIZE_COSTS[slot] ?? 800, color: colour, shape };
}

/** What is on the shelf during a given wave.  Wave 0 is the opening list. */
export function prizesForWave(wave: number): PrizeDef[] {
  if (wave <= 0) return PRIZES;
  return PRIZE_COSTS.map((_, slot) => makePrize(wave, slot));
}

export function prizeById(id: string): PrizeDef | undefined {
  const known = PRIZES.find((p) => p.id === id);
  if (known) return known;
  // A generated one: the id is the recipe.
  const m = /^w(\d+)-(\d+)$/.exec(id);
  if (!m) return undefined;
  return makePrize(Number(m[1]), Number(m[2]));
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

/**
 * Every prize sold means the job is done.  Measured against the OPENING shelf
 * and nothing else: the restock keeps the counter alive for a player who wants
 * to keep going, and it must not move the finish line for one who does not.
 */
export function allPrizesSold(sold: readonly string[]): boolean {
  return PRIZES.every((p) => sold.includes(p.id));
}

/** PRD §7.5: the ticket counter, the prize case, and the bell nobody answers. */
export const COUNTER = { x: 112, y: 44, w: 146, h: 18 };
/**
 * Depth for the counter's front face, on the same y-sorted scale the player
 * runs on (`art/player.ts`: 50 + y/1000).  Anything whose feet are ABOVE the
 * counter's front edge is drawn under it and anything below is drawn over it,
 * which is the whole of how a flat room says "behind the counter" — without it
 * a player standing back there is a whole sprite hanging in the air.
 */
export const COUNTER_DEPTH = 50 + (44 + 18) / 1000;
export const BELL = { x: 122, y: 56 };
export const PRIZE_CASE = { x: 126, y: 44, w: 100, h: 18 };
/** PRD AD-5: only reachable at night, when the arcade is closed. */
export const COUNTER_VAULT = { x: 200, y: 66 };
/**
 * The way into the back of the building, at the counter's right-hand end.  It
 * is INSIDE the counter's span on purpose: the only way to reach it is over
 * the counter, so a door standing out in the open beside it was telling the
 * player they could just walk up.
 */
export const STAFF_DOOR = { x: 232, y: 40 };
