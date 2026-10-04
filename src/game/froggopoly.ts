/**
 * ---- FROGGOPOLY.  The rules, and nothing drawn.
 *
 * A property-trading board game for two, round the pond: twenty-four spaces,
 * thirteen properties in six colour groups, two utilities, three POND RIPPLE
 * cards, two taxes and the four corners (LILY START, the SWAMP, the FREE LILY
 * PAD and GO TO THE SWAMP).  Each player starts with L$1000 -- lily dollars,
 * the board's own money, which has nothing to do with tokens or cash -- and
 * gets L$200 every time they pass LILY START.
 *
 * Land on a free property and you may buy it; land on one the other player
 * owns and you pay them rent.  Own a whole colour group and its rent doubles,
 * and you may build up to three LILY PADS on each of its properties, each one
 * raising the rent further.  A utility's rent is the dice times four (times
 * ten with both).  Short of money, you sell -- lily pads back for half what
 * they cost, then properties back to the bank for half their price -- and if
 * selling everything still does not cover it, you are bankrupt and the game
 * is over.  After thirty rounds it ends anyway, and whoever is worth more
 * (cash, plus what their land and lily pads cost) wins; the same worth is a
 * draw.
 *
 * Everything here is a pure function of a `Game` and a random source, so the
 * scene and the tests drive exactly the same rules.
 */

export type Who = 0 | 1;
export type SpaceKind = 'go' | 'prop' | 'util' | 'chance' | 'tax' | 'swamp' | 'free' | 'goswamp';

export interface Space {
  name: string;
  kind: SpaceKind;
  price?: number;
  group?: string;
  color?: number;
  tax?: number;
}

export const START_CASH = 1000;
export const PASS_GO = 200;
export const SWAMP_FINE = 50;
export const MAX_LEVEL = 3;
export const ROUNDS = 30;
/** Rent by level, as a multiple of a property's base rent (level 0 is bare). */
export const RENT_MUL = [1, 5, 13, 28];

const G = {
  brown: 0x8a5a2e,
  sky: 0x7ec8e8,
  pink: 0xff7ab0,
  orange: 0xff8a3a,
  red: 0xd8302e,
  green: 0x2e9a4a,
};

export const BOARD: Space[] = [
  { name: 'LILY START', kind: 'go' },
  { name: 'MUD FLATS', kind: 'prop', price: 60, group: 'brown', color: G.brown },
  { name: 'POND RIPPLE', kind: 'chance' },
  { name: 'REED BANK', kind: 'prop', price: 60, group: 'brown', color: G.brown },
  { name: 'FLY TAX', kind: 'tax', tax: 100 },
  { name: 'TADPOLE LANE', kind: 'prop', price: 100, group: 'sky', color: G.sky },
  { name: 'THE SWAMP', kind: 'swamp' },
  { name: 'DUCKWEED ROW', kind: 'prop', price: 100, group: 'sky', color: G.sky },
  { name: 'FIREFLY POWER', kind: 'util', price: 150 },
  { name: 'MOSSY STEPS', kind: 'prop', price: 120, group: 'sky', color: G.sky },
  { name: 'LILY PAD CAFE', kind: 'prop', price: 140, group: 'pink', color: G.pink },
  { name: 'POND RIPPLE', kind: 'chance' },
  { name: 'FREE LILY PAD', kind: 'free' },
  { name: 'CROAK & CO', kind: 'prop', price: 160, group: 'pink', color: G.pink },
  { name: 'FROGGY ARCADE', kind: 'prop', price: 180, group: 'orange', color: G.orange },
  { name: 'POND RIPPLE', kind: 'chance' },
  { name: 'PRIZE COUNTER', kind: 'prop', price: 200, group: 'orange', color: G.orange },
  { name: 'WILLOW WALK', kind: 'prop', price: 220, group: 'red', color: G.red },
  { name: 'GO TO THE SWAMP', kind: 'goswamp' },
  { name: 'DRAGONFLY DOCK', kind: 'prop', price: 240, group: 'red', color: G.red },
  { name: 'RAIN BARREL', kind: 'util', price: 150 },
  { name: 'BULLFROG BANK', kind: 'prop', price: 300, group: 'green', color: G.green },
  { name: 'HERON TAX', kind: 'tax', tax: 75 },
  { name: "KING'S POND", kind: 'prop', price: 350, group: 'green', color: G.green },
];

export const SWAMP_AT = BOARD.findIndex((s) => s.kind === 'swamp');
export const ARCADE_AT = BOARD.findIndex((s) => s.name === 'FROGGY ARCADE');

export interface Player {
  cash: number;
  pos: number;
  /** Turns of swamp still to sit out (0: free). */
  swamp: number;
  bankrupt: boolean;
}

export interface Game {
  players: [Player, Player];
  owner: Array<Who | null>;
  level: number[];
  /** 1-based; the game ends when this passes ROUNDS. */
  round: number;
  turn: Who;
  /** Doubles thrown in a row this turn. */
  doubles: number;
  over: boolean;
  winner: Who | null | 'draw';
}

export function newGame(): Game {
  const p = (): Player => ({ cash: START_CASH, pos: 0, swamp: 0, bankrupt: false });
  return {
    players: [p(), p()],
    owner: BOARD.map(() => null),
    level: BOARD.map(() => 0),
    round: 1,
    turn: 0,
    doubles: 0,
    over: false,
    winner: null,
  };
}

export const other = (w: Who): Who => (w === 0 ? 1 : 0);

export function rollDice(rng: () => number = Math.random): [number, number] {
  return [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
}

/** Every property in a colour group. */
export function groupOf(group: string): number[] {
  return BOARD.map((s, i) => (s.group === group ? i : -1)).filter((i) => i >= 0);
}

export function ownsGroup(g: Game, group: string, who: Who): boolean {
  return groupOf(group).every((i) => g.owner[i] === who);
}

export function baseRent(i: number): number {
  return Math.max(6, Math.round((BOARD[i].price ?? 0) / 8));
}

export function upgradeCost(i: number): number {
  return Math.round((BOARD[i].price ?? 0) / 2);
}

/** What landing on `i` costs whoever does not own it, this throw. */
export function rentOf(g: Game, i: number, diceTotal: number): number {
  const s = BOARD[i];
  const o = g.owner[i];
  if (o === null) return 0;
  if (s.kind === 'util') {
    const both = BOARD.every((b, j) => b.kind !== 'util' || g.owner[j] === o);
    return diceTotal * (both ? 10 : 4);
  }
  if (s.kind !== 'prop') return 0;
  const lvl = g.level[i];
  const set = ownsGroup(g, s.group!, o);
  return baseRent(i) * RENT_MUL[lvl] * (lvl === 0 && set ? 2 : 1);
}

/** May `who` build another lily pad on `i` right now? */
export function canUpgrade(g: Game, i: number, who: Who): boolean {
  const s = BOARD[i];
  if (s.kind !== 'prop' || g.owner[i] !== who || g.level[i] >= MAX_LEVEL) return false;
  if (!ownsGroup(g, s.group!, who)) return false;
  // build evenly: never more than one ahead of the rest of the group
  const lo = Math.min(...groupOf(s.group!).map((j) => g.level[j]));
  return g.level[i] === lo && g.players[who].cash >= upgradeCost(i);
}

export function upgrade(g: Game, i: number, who: Who): boolean {
  if (!canUpgrade(g, i, who)) return false;
  g.players[who].cash -= upgradeCost(i);
  g.level[i] += 1;
  return true;
}

/** Cash, plus what everything owned cost. */
export function wealth(g: Game, who: Who): number {
  let w = g.players[who].cash;
  g.owner.forEach((o, i) => {
    if (o === who) w += (BOARD[i].price ?? 0) + g.level[i] * upgradeCost(i);
  });
  return w;
}

export interface Asset {
  i: number;
  what: 'pad' | 'land';
  value: number;
}

/**
 * What `who` could sell right now, in the order it should go: lily pads
 * first (a property cannot go back to the bank with pads on it, and never
 * one pad more than the rest of its group), then bare land.
 */
export function sellable(g: Game, who: Who): Asset[] {
  const out: Asset[] = [];
  g.owner.forEach((o, i) => {
    if (o !== who) return;
    const s = BOARD[i];
    if (g.level[i] > 0) {
      const hi = Math.max(...groupOf(s.group!).map((j) => g.level[j]));
      if (g.level[i] === hi) out.push({ i, what: 'pad', value: Math.round(upgradeCost(i) / 2) });
    } else if (s.kind === 'util' || !s.group || groupOf(s.group).every((j) => g.level[j] === 0)) {
      out.push({ i, what: 'land', value: Math.round((s.price ?? 0) / 2) });
    }
  });
  return out.sort((a, b) => (a.what === b.what ? a.value - b.value : a.what === 'pad' ? -1 : 1));
}

export function sell(g: Game, who: Who, a: Asset): number {
  if (a.what === 'pad') {
    if (g.level[a.i] <= 0) return 0;
    g.level[a.i] -= 1;
  } else {
    if (g.owner[a.i] !== who || g.level[a.i] > 0) return 0;
    g.owner[a.i] = null;
  }
  g.players[who].cash += a.value;
  return a.value;
}

/** All `who` could raise by selling everything. */
export function canRaise(g: Game, who: Who): number {
  let n = 0;
  g.owner.forEach((o, i) => {
    if (o !== who) return;
    n += Math.round((BOARD[i].price ?? 0) / 2) + g.level[i] * Math.round(upgradeCost(i) / 2);
  });
  return n;
}

/** Move forward (or back) `steps`; true if LILY START was passed going forward. */
export function moveBy(g: Game, who: Who, steps: number): boolean {
  const p = g.players[who];
  const from = p.pos;
  p.pos = (((p.pos + steps) % BOARD.length) + BOARD.length) % BOARD.length;
  const passed = steps > 0 && p.pos < from;
  if (passed) p.cash += PASS_GO;
  return passed;
}

export function toSwamp(g: Game, who: Who): void {
  g.players[who].pos = SWAMP_AT;
  g.players[who].swamp = 3;
}

/** Hand the game to the other player, and count the round on the way. */
export function endTurn(g: Game): void {
  g.doubles = 0;
  if (g.turn === 1) g.round += 1;
  g.turn = other(g.turn);
  if (g.round > ROUNDS) finishOnWealth(g);
}

export function finishOnWealth(g: Game): void {
  const a = wealth(g, 0);
  const b = wealth(g, 1);
  g.over = true;
  g.winner = a === b ? 'draw' : a > b ? 0 : 1;
}

export function bankrupt(g: Game, who: Who): void {
  g.players[who].bankrupt = true;
  g.over = true;
  g.winner = other(who);
}

// ------------------------------------------------------------- POND RIPPLES

export interface Ripple {
  text: string;
  /** What it does.  Movement is resolved by the caller, which then lands. */
  cash?: number;
  fromOther?: number;
  perPad?: number;
  moveTo?: number;
  moveBy?: number;
  swamp?: boolean;
}

export const RIPPLES: Ripple[] = [
  { text: 'A HERON DROPS A COIN PURSE. COLLECT L$150', cash: 150 },
  { text: 'YOUR LILY PAD LEAKS. PAY L$50', cash: -50 },
  { text: 'A TAILWIND! HOP TO LILY START', moveTo: 0 },
  { text: 'YOU SLIP ON ALGAE. GO BACK 3', moveBy: -3 },
  { text: 'FLY SWARM FEAST! COLLECT L$100', cash: 100 },
  { text: 'POND REPAIRS: PAY L$25 PER LILY PAD', perPad: 25 },
  { text: "IT'S YOUR BIRTHDAY! THE OTHER PLAYER GIVES YOU L$50", fromOther: 50 },
  { text: 'HOP OVER TO THE FROGGY ARCADE', moveTo: ARCADE_AT },
  { text: 'CAUGHT NAPPING. GO TO THE SWAMP', swamp: true },
  { text: 'LOST YOUR LUNCH MONEY. PAY L$75', cash: -75 },
  { text: 'YOU FIND A PEARL! COLLECT L$75', cash: 75 },
];

export function drawRipple(rng: () => number = Math.random): Ripple {
  return RIPPLES[Math.floor(rng() * RIPPLES.length)];
}

export function padsOf(g: Game, who: Who): number {
  return g.owner.reduce<number>((n, o, i) => n + (o === who ? g.level[i] : 0), 0);
}

// ------------------------------------------------------------ THE OPPONENT

/** Buy what you land on, if it leaves a sensible float -- or finishes a set. */
export function aiWantsToBuy(g: Game, who: Who, i: number): boolean {
  const s = BOARD[i];
  const price = s.price ?? 0;
  const cash = g.players[who].cash;
  if (cash < price) return false;
  const completes = s.group ? groupOf(s.group).every((j) => j === i || g.owner[j] === who) : false;
  const blocks = s.group ? groupOf(s.group).some((j) => g.owner[j] === other(who)) : false;
  const float = completes ? 40 : blocks ? 120 : 180;
  return cash - price >= float;
}

/** Build where it can, cheapest first, keeping a float. */
export function aiBuild(g: Game, who: Who): number[] {
  const built: number[] = [];
  for (let pass = 0; pass < 12; pass++) {
    const options = BOARD.map((_, i) => i)
      .filter((i) => canUpgrade(g, i, who) && g.players[who].cash - upgradeCost(i) >= 200)
      .sort((a, b) => upgradeCost(a) - upgradeCost(b));
    if (!options.length) break;
    upgrade(g, options[0], who);
    built.push(options[0]);
  }
  return built;
}

/** Sell, cheapest first, until `owed` is covered or there is nothing left. */
export function aiRaise(g: Game, who: Who, owed: number): void {
  while (g.players[who].cash < owed) {
    const a = sellable(g, who);
    if (!a.length) return;
    sell(g, who, a[0]);
  }
}
