/**
 * TEXAS POKER.  Hard — 7 tokens in, 15 out.
 *
 * Six-handed no-limit hold'em against five frogs who all want something
 * different.  One deck, shuffled properly; blinds, a flop, a turn, a river,
 * and a showdown that reads seven cards and finds the best five.
 *
 * IT IS A SIT-AND-GO, SO IT ENDS.  Everybody starts on 100 chips.  Reach 300 —
 * half the table's money — and the cabinet pays its fifteen; go broke and it
 * does not.  The blinds step up every six hands, so a player who folds every
 * hand loses to the blinds rather than sitting there forever.  That bar is
 * deliberately a third of the table rather than all of it: busting five
 * opponents is a twenty-minute session, and this is an arcade machine.
 *
 * THE FIVE OF THEM PLAY DIFFERENTLY, AND THE DIFFERENCE IS LEGIBLE.
 *   ROCK     folds almost everything and bets only the real thing.
 *   CALLER   pays to see it, every time, and almost never raises.
 *   SHARK    plays the odds, raises with the best of it, folds without.
 *   BLUFFER  represents hands he does not have, about a third of the time.
 *   WILD     is a coin flip with chips, and is the reason the table is loud.
 * Their style is on the felt under their name, because an opponent whose
 * tendencies you cannot see is just a random number with a face.
 *
 * THE AI IS NOT RANDOM.  Every decision starts from a real estimate of the
 * hand — its made strength at showdown, or its raw two-card strength before
 * the flop — and the personality bends it: a rock needs more, a caller ignores
 * the price, a bluffer sometimes acts on a number it knows is bad.  The bluff
 * is a deliberate lie about a known value, which is what makes it a bluff
 * rather than noise.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'poker' as const;

export const START_CHIPS = 100;
/** Half the table's money.  Reach it and the cabinet pays. */
export const TARGET_CHIPS = 300;
const SEATS = 6;
const BLIND_STEP = 6;

type Style = 'rock' | 'caller' | 'shark' | 'bluffer' | 'wild';

const AI: Array<{ name: string; style: Style; colour: number }> = [
  { name: 'HOPS', style: 'rock', colour: 0x5fbf5a },
  { name: 'MUD', style: 'caller', colour: 0xb9884f },
  { name: 'SLICK', style: 'shark', colour: 0x46c4bd },
  { name: 'BIG TOM', style: 'bluffer', colour: 0xd8443c },
  { name: 'PIP', style: 'wild', colour: 0xa86ad8 },
];

const STYLE_WORD: Record<Style, string> = {
  rock: 'TIGHT',
  caller: 'CALLS',
  shark: 'SHARP',
  bluffer: 'TRICKY',
  wild: 'WILD',
};

interface Seat {
  name: string;
  style: Style | null;
  colour: number;
  chips: number;
  hole: number[];
  /** Chips in front of them this betting round. */
  bet: number;
  folded: boolean;
  allIn: boolean;
  /** What they just did, shown on the felt. */
  said: string;
  art: {
    plate: Phaser.GameObjects.Rectangle;
    name: Phaser.GameObjects.BitmapText;
    info: Phaser.GameObjects.BitmapText;
    style: Phaser.GameObjects.BitmapText;
  };
}

type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'over';

let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let over = false;
let seats: Seat[] = [];
let deck: number[] = [];
let board: number[] = [];
let pot = 0;
let toCall = 0;
let lastRaise = 0;
let street: Street = 'preflop';
let dealer = 0;
let turn = 0;
let handNo = 0;
let blind = 2;
/** Whose action closes the round: the last aggressor, or the first to act. */
let closer = 0;
let waiting = false;
let boardArt: Phaser.GameObjects.Container[] = [];
let holeArt: Phaser.GameObjects.Container[] = [];
let hud: {
  pot: Phaser.GameObjects.BitmapText;
  goal: Phaser.GameObjects.BitmapText;
  msg: Phaser.GameObjects.BitmapText;
  street: Phaser.GameObjects.BitmapText;
} | null = null;
let buttons: Array<{ box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.BitmapText; act: string }> = [];

const ME = 0;

// ------------------------------------------------------------------ the cards

/** A card is 0..51: rank = n >> 2 (0 = deuce), suit = n & 3. */
const RANKS = '23456789TJQKA';
const SUITS = ['♣', '♦', '♥', '♠'];
const rankOf = (c: number): number => c >> 2;
const suitOf = (c: number): number => c & 3;
const cardName = (c: number): string => `${RANKS[rankOf(c)]}${SUITS[suitOf(c)]}`;

function shuffle(): void {
  deck = [...Array(52).keys()];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

/**
 * The best five-card hand out of seven, as one comparable number.
 *
 * Category in the high digits, then the ranks that break ties, so a straight
 * flush beats quads beats a boat and two hands of the same shape are settled
 * by their own cards.  Everything else in this file compares these and never
 * looks at a card again.
 */
export function evaluate(cards: number[]): number {
  const bySuit = [0, 0, 0, 0].map(() => [] as number[]);
  const count = new Array(13).fill(0);
  for (const c of cards) {
    bySuit[suitOf(c)].push(rankOf(c));
    count[rankOf(c)]++;
  }

  const flushSuit = bySuit.findIndex((s) => s.length >= 5);
  const straightHigh = (ranks: number[]): number => {
    const has = new Set(ranks);
    // The wheel: an ace plays low in A-2-3-4-5 and nowhere else.
    if (has.has(12)) has.add(-1);
    let run = 0;
    let best = -99;
    for (let r = -1; r <= 12; r++) {
      run = has.has(r) ? run + 1 : 0;
      if (run >= 5) best = r;
    }
    return best;
  };

  if (flushSuit >= 0) {
    const sf = straightHigh(bySuit[flushSuit]);
    if (sf > -99) return 8e10 + sf;
  }
  const quad = count.findIndex((n) => n === 4);
  if (quad >= 0) {
    const kick = Math.max(...cards.map(rankOf).filter((r) => r !== quad));
    return 7e10 + quad * 1e8 + kick;
  }
  const trips = count.map((n, r) => (n === 3 ? r : -1)).filter((r) => r >= 0).sort((a, b) => b - a);
  const pairs = count.map((n, r) => (n === 2 ? r : -1)).filter((r) => r >= 0).sort((a, b) => b - a);
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const second = trips.length > 1 ? Math.max(trips[1], pairs[0] ?? -1) : pairs[0];
    return 6e10 + trips[0] * 1e8 + second;
  }
  if (flushSuit >= 0) {
    const top = bySuit[flushSuit].sort((a, b) => b - a).slice(0, 5);
    return 5e10 + top.reduce((acc, r) => acc * 13 + r, 0);
  }
  const st = straightHigh(cards.map(rankOf));
  if (st > -99) return 4e10 + st;
  if (trips.length) {
    const kick = cards
      .map(rankOf)
      .filter((r) => r !== trips[0])
      .sort((a, b) => b - a)
      .slice(0, 2);
    return 3e10 + trips[0] * 1e6 + kick[0] * 1e3 + kick[1];
  }
  if (pairs.length >= 2) {
    const kick = Math.max(...cards.map(rankOf).filter((r) => r !== pairs[0] && r !== pairs[1]));
    return 2e10 + pairs[0] * 1e6 + pairs[1] * 1e3 + kick;
  }
  if (pairs.length === 1) {
    const kick = cards
      .map(rankOf)
      .filter((r) => r !== pairs[0])
      .sort((a, b) => b - a)
      .slice(0, 3);
    return 1e10 + pairs[0] * 1e6 + kick[0] * 1e4 + kick[1] * 1e2 + kick[2];
  }
  const top = cards.map(rankOf).sort((a, b) => b - a).slice(0, 5);
  return top.reduce((acc, r) => acc * 13 + r, 0);
}

/** What a hand is called, for the showdown line. */
function handName(v: number): string {
  if (v >= 8e10) return 'STRAIGHT FLUSH';
  if (v >= 7e10) return 'FOUR OF A KIND';
  if (v >= 6e10) return 'FULL HOUSE';
  if (v >= 5e10) return 'FLUSH';
  if (v >= 4e10) return 'STRAIGHT';
  if (v >= 3e10) return 'THREE OF A KIND';
  if (v >= 2e10) return 'TWO PAIR';
  if (v >= 1e10) return 'A PAIR';
  return 'HIGH CARD';
}

/**
 * How good this holding looks, 0..1, to a player who can see the board.
 *
 * Before the flop it is a two-card heuristic — pair, high cards, suited,
 * connected — and after it, the made hand's own category softened toward the
 * middle, because a made pair on a wet board is not the lock its category
 * suggests.  It is not a solver.  It does not need to be: what it has to be is
 * CONSISTENT, so that a personality bending it produces a personality rather
 * than noise.
 */
function strength(hole: number[], table: number[]): number {
  if (table.length === 0) {
    const [a, b] = hole.map(rankOf);
    const suited = suitOf(hole[0]) === suitOf(hole[1]);
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    if (a === b) return 0.55 + (a / 12) * 0.45;
    let v = 0.14 + (hi / 12) * 0.34 + (lo / 12) * 0.12;
    if (suited) v += 0.07;
    if (hi - lo === 1) v += 0.05;
    else if (hi - lo === 2) v += 0.02;
    return Math.min(0.95, v);
  }
  const v = evaluate([...hole, ...table]);
  const cat = Math.floor(v / 1e10);
  // A category is worth this much; the high card inside it is worth a little
  // more, so ace-high beats seven-high to an AI as well as at a showdown.
  const byCat = [0.12, 0.42, 0.62, 0.74, 0.82, 0.86, 0.93, 0.98, 1];
  const base = byCat[Math.min(8, cat)];
  const topKicker = Math.max(...hole.map(rankOf)) / 12;
  return Math.min(1, base + topKicker * 0.05);
}

export const texasPoker: MinigameModule = {
  id: ID,
  title: 'TEXAS POKER',
  music: 'game_poker',
  rules: 'six-handed hold’em to 300',
  payoutNote: 'WIN: 15 TOKENS',
  tutorial: {
    objective: [
      'SIX-HANDED TEXAS HOLD’EM. ALL START ON 100.',
      'GET TO 300 CHIPS AND THE CABINET PAYS 15.',
      'GO BROKE AND IT DOES NOT. BLINDS GO UP.',
      'THE FIVE OF THEM PLAY DIFFERENT WAYS.',
    ],
    controls: [
      ['F', 'FOLD'],
      ['C', 'CHECK OR CALL'],
      ['R', 'RAISE'],
      ['MOUSE', 'OR CLICK THE BUTTONS'],
    ],
  },
  touch: {
    buttons: [
      { label: 'FOLD', key: 'F' },
      { label: 'CALL', key: 'C', primary: true },
      { label: 'RAISE', key: 'R' },
    ],
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    over = false;
    handNo = 0;
    blind = 2;
    dealer = Math.floor(Math.random() * SEATS);
    boardArt = [];
    holeArt = [];
    buttons = [];

    paintFelt(scene);
    seats = buildSeats(scene);

    hud = {
      pot: centerText(scene, GAME_W / 2, 72, '', PALETTE.gold).setDepth(40),
      goal: text(scene, 4, 21, '', PALETTE.tealLight).setDepth(40),
      street: text(scene, GAME_W - 4, 21, '', PALETTE.fog).setOrigin(1, 0).setDepth(40),
      msg: centerText(scene, GAME_W / 2, 118, '', PALETTE.cream).setDepth(40),
    };

    makeButtons(scene);
    const kb = scene.input.keyboard;
    kb?.on('keydown-F', () => act('fold'));
    kb?.on('keydown-C', () => act('call'));
    kb?.on('keydown-R', () => act('raise'));

    deal();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__poker = {
        state: () => ({
          street,
          pot,
          toCall,
          handNo,
          blind,
          over,
          myTurn: turn === ME && !waiting && street !== 'over',
          seats: seats.map((s) => ({
            name: s.name,
            style: s.style,
            chips: s.chips,
            bet: s.bet,
            folded: s.folded,
            said: s.said,
          })),
          board: board.map(cardName),
          hole: seats[ME]?.hole.map(cardName) ?? [],
          target: TARGET_CHIPS,
        }),
        act: (a: string) => act(a),
        setChips: (i: number, n: number) => {
          if (seats[i]) seats[i].chips = n;
        },
        /** The evaluator, exposed so its ranking can be checked exhaustively. */
        rank: (cards: string[]) => evaluate(cards.map(parseCard)),
        strength: (hole: string[], table: string[]) =>
          strength(hole.map(parseCard), table.map(parseCard)),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__poker;
      });
    }
  },

  destroy() {
    seats = [];
    deck = [];
    board = [];
    boardArt = [];
    holeArt = [];
    buttons = [];
    hud = null;
    sceneRef = null;
    apiRef = null;
  },
};

/** "AS" / "TD" -> a card number.  Dev and test only. */
function parseCard(s: string): number {
  const r = RANKS.indexOf(s[0].toUpperCase());
  const suit = 'CDHS'.indexOf(s[1].toUpperCase());
  return r * 4 + suit;
}

// ------------------------------------------------------------------ the table

function paintFelt(scene: Phaser.Scene): void {
  scene.add.rectangle(0, 18, GAME_W, 162, 0x10202c).setOrigin(0, 0);
  scene.add.ellipse(GAME_W / 2, 100, 250, 116, 0x1f6b43).setDepth(0);
  scene.add.ellipse(GAME_W / 2, 100, 234, 102, 0x2a7d4f).setDepth(1);
  scene.add.ellipse(GAME_W / 2, 100, 234, 102, 0x000000, 0).setStrokeStyle(1, 0x8a6a2a).setDepth(2);
}

function buildSeats(scene: Phaser.Scene): Seat[] {
  // The player along the bottom, the five of them around the top of the oval.
  // THREE LINES, NOT TWO.  Name, money, and how they play, each on its own
  // row: "SLICK SHARP" on one line is sixty-six pixels of text in a
  // fifty-eight pixel plate, and it came out as "SLICK SHAR".
  // THE PLAYER HAS NO PLATE.  His money is already across the top of the
  // screen and his action is on the line under the board, so a sixth plate at
  // the bottom would only be a third place for the same number — and it landed
  // under his own hole cards, which is the one place on this table that has to
  // stay readable.  His seat still exists; it is just not drawn.
  const spots: Array<[number, number]> = [
    [GAME_W / 2, 999],
    [38, 118],
    [34, 60],
    [GAME_W / 2, 42],
    [GAME_W - 34, 60],
    [GAME_W - 38, 118],
  ];
  return spots.map(([x, y], i) => {
    const def = i === ME ? { name: 'YOU', style: null, colour: PALETTE.gold } : AI[i - 1];
    // 28 tall, not 24.  Three 7-pixel rows eight apart need twenty-two of it
    // and the text is centred on its row, so a 24-pixel plate put the top of
    // the name straight through its own border and every seat read as though
    // it had been crossed out.
    const plate = scene.add
      .rectangle(x, y, 68, 28, PALETTE.ink, 0.85)
      .setDepth(20)
      .setStrokeStyle(1, def.colour);
    const name = centerText(scene, x, y - 8, def.name, def.colour).setDepth(21);
    const info = centerText(scene, x, y, '', PALETTE.cream).setDepth(21);
    const style = centerText(scene, x, y + 8, def.style ? STYLE_WORD[def.style as Style] : '', PALETTE.ash).setDepth(21);
    if (i === ME) {
      plate.setVisible(false);
      name.setVisible(false);
      info.setVisible(false);
      style.setVisible(false);
    }
    return {
      name: def.name,
      style: def.style as Style | null,
      colour: def.colour,
      chips: START_CHIPS,
      hole: [],
      bet: 0,
      folded: false,
      allIn: false,
      said: '',
      art: { plate, name, info, style },
    };
  });
}

function makeButtons(scene: Phaser.Scene): void {
  const defs: Array<[string, string, number]> = [
    ['FOLD', 'fold', PALETTE.plum],
    ['CALL', 'call', PALETTE.tealDark],
    ['RAISE', 'raise', PALETTE.rust],
  ];
  defs.forEach(([label, action, fill], i) => {
    const x = GAME_W / 2 + (i - 1) * 72;
    const box = scene.add
      .rectangle(x, 168, 66, 15, fill)
      .setDepth(40)
      .setStrokeStyle(1, PALETTE.gold)
      .setInteractive({ useHandCursor: true });
    box.on('pointerdown', () => act(action));
    // On the box's own centre line: `centerText` centres on both axes, so 164
    // against a box at 168 sat the label on the top edge of it.
    const text0 = centerText(scene, x, 168, label, PALETTE.cream).setDepth(41);
    buttons.push({ box, label: text0, act: action });
  });
}

// ------------------------------------------------------------------ the hand

/**
 * Is the table still on the screen?
 *
 * Every beat of a hand is a timer — the AI thinks for half a second, a street
 * holds for a beat, a pot is read out for two — and Esc can land between any
 * two of them.  `destroy()` empties the seats, so a callback that fires after
 * it walks off the end of an empty array; this is what each of them asks
 * first, rather than four different half-guards that each miss a case.
 */
function atTable(): boolean {
  return sceneRef !== null && seats.length === SEATS;
}

function deal(): void {
  if (!sceneRef || !atTable() || over) return;
  handNo += 1;
  if (handNo > 1 && (handNo - 1) % BLIND_STEP === 0) blind = Math.min(40, blind * 2);

  for (const a of boardArt) a.destroy();
  for (const a of holeArt) a.destroy();
  boardArt = [];
  holeArt = [];
  board = [];
  pot = 0;
  toCall = 0;
  lastRaise = blind;
  street = 'preflop';
  shuffle();

  const live = seats.filter((s) => s.chips > 0);
  for (const s of seats) {
    s.hole = s.chips > 0 ? [deck.pop() as number, deck.pop() as number] : [];
    s.bet = 0;
    s.folded = s.chips <= 0;
    s.allIn = false;
    s.said = '';
  }
  if (live.length < 2) {
    finish();
    return;
  }

  do {
    dealer = (dealer + 1) % SEATS;
  } while (seats[dealer].chips <= 0);

  const sb = nextLive(dealer);
  const bb = nextLive(sb);
  post(sb, Math.floor(blind / 2));
  post(bb, blind);
  toCall = blind;
  turn = nextLive(bb);
  closer = bb;

  showHole();
  say(`HAND ${handNo}   BLINDS ${Math.floor(blind / 2)}/${blind}`);
  refresh();
  step();
}

function nextLive(from: number): number {
  let i = from;
  for (let k = 0; k < SEATS; k++) {
    i = (i + 1) % SEATS;
    if (seats[i].chips > 0 && !seats[i].folded) return i;
  }
  return from;
}

function post(i: number, n: number): void {
  const s = seats[i];
  const put = Math.min(n, s.chips);
  s.chips -= put;
  s.bet += put;
  pot += put;
  if (s.chips === 0) s.allIn = true;
}

/** Whose turn it is, and whether anybody still has a decision to make. */
function step(): void {
  if (over || !sceneRef || !atTable()) return;
  const contenders = seats.filter((s) => !s.folded);
  if (contenders.length === 1) {
    award([seats.indexOf(contenders[0])], 'EVERYONE ELSE FOLDED');
    return;
  }
  // Everybody matched, or is all in: the round is done.
  const acting = seats.filter((s) => !s.folded && !s.allIn);
  const settled = acting.every((s) => s.bet === toCall);
  if (settled && (turn === closer || acting.length <= 1)) {
    nextStreet();
    return;
  }

  const s = seats[turn];
  if (s.folded || s.allIn || s.chips <= 0) {
    turn = nextLive(turn);
    step();
    return;
  }
  if (turn === ME) {
    setButtons(true);
    refresh();
    return;
  }
  setButtons(false);
  waiting = true;
  sceneRef.time.delayedCall(560 + Math.random() * 420, () => {
    waiting = false;
    if (atTable()) aiAct(turn);
  });
}

function advance(): void {
  turn = nextLive(turn);
  step();
}

function nextStreet(): void {
  for (const s of seats) {
    s.bet = 0;
    s.said = '';
  }
  toCall = 0;
  lastRaise = blind;
  if (street === 'preflop') {
    street = 'flop';
    board.push(deck.pop() as number, deck.pop() as number, deck.pop() as number);
  } else if (street === 'flop') {
    street = 'turn';
    board.push(deck.pop() as number);
  } else if (street === 'turn') {
    street = 'river';
    board.push(deck.pop() as number);
  } else {
    showdown();
    return;
  }
  showBoard();
  audio.sfx('ui_blip', 0.4);
  turn = nextLive(dealer);
  closer = turn;
  // A round with nobody left to act (everyone all in) just runs the board out.
  const acting = seats.filter((s) => !s.folded && !s.allIn);
  if (acting.length <= 1) {
    sceneRef?.time.delayedCall(700, () => {
      if (atTable()) nextStreet();
    });
    refresh();
    return;
  }
  refresh();
  step();
}

function showdown(): void {
  street = 'showdown';
  const live = seats.map((s, i) => ({ i, s })).filter(({ s }) => !s.folded);
  const scored = live.map(({ i, s }) => ({ i, v: evaluate([...s.hole, ...board]) }));
  const best = Math.max(...scored.map((x) => x.v));
  const winners = scored.filter((x) => x.v === best).map((x) => x.i);
  for (const { i } of live) seats[i].said = cardName(seats[i].hole[0]) + ' ' + cardName(seats[i].hole[1]);
  award(winners, handName(best));
}

function award(winners: number[], why: string): void {
  const each = Math.floor(pot / winners.length);
  for (const i of winners) seats[i].chips += each;
  const names = winners.map((i) => seats[i].name).join(' & ');
  say(`${names} TAKES ${pot}  -  ${why}`);
  audio.sfx(winners.includes(ME) ? 'coin_spin' : 'ui_blip', 0.5);
  pot = 0;
  street = 'over';
  setButtons(false);
  refresh();

  sceneRef?.time.delayedCall(2200, () => {
    if (over || !atTable()) return;
    if (seats[ME].chips >= TARGET_CHIPS || seats[ME].chips <= 0) finish();
    else deal();
  });
}

function finish(): void {
  if (over || !sceneRef || !atTable()) return;
  over = true;
  const won = seats[ME].chips >= TARGET_CHIPS;
  store.setHighScore(ID, seats[ME].chips);
  say(won ? `${seats[ME].chips} CHIPS  -  YOU WIN` : 'BUSTED');
  hud?.msg.setTint(won ? PALETTE.gold : PALETTE.blood);
  audio.sfx(won ? 'chime' : 'buzzer');
  if (won) sceneRef.cameras.main.flash(220, 255, 240, 180);
  setButtons(false);
  // MG-3: the shell pays, once, and only after the session is decided.
  sceneRef.time.delayedCall(1600, () => (won ? apiRef?.win() : apiRef?.lose()));
  // apiRef is nulled by destroy(), so a forfeit between here and there simply
  // pays nothing — which is what a forfeit is.
}

// ------------------------------------------------------------------- acting

function act(action: string): void {
  if (over || turn !== ME || waiting || street === 'over') return;
  const me = seats[ME];
  const owed = toCall - me.bet;
  if (action === 'fold') {
    if (owed <= 0) return void act('call'); // nobody folds for free
    me.folded = true;
    me.said = 'FOLD';
  } else if (action === 'call') {
    post(ME, owed);
    me.said = owed <= 0 ? 'CHECK' : me.allIn ? 'ALL IN' : `CALL ${owed}`;
  } else {
    const raise = Math.max(lastRaise, blind);
    const put = Math.min(me.chips, owed + raise);
    post(ME, put);
    toCall = me.bet;
    lastRaise = raise;
    closer = ME;
    me.said = me.allIn ? 'ALL IN' : `RAISE ${toCall}`;
  }
  audio.sfx('ui_blip', 0.5);
  setButtons(false);
  sayMine();
  refresh();
  advance();
}

/**
 * One opponent's decision.
 *
 * The shape is the same for all five — work out what the hand is worth, work
 * out what the call costs against the pot, then let the personality move the
 * thresholds — which is what keeps them all recognisably playing poker while
 * playing it differently.
 */
function aiAct(i: number): void {
  const s = seats[i];
  if (s.folded || s.allIn) {
    advance();
    return;
  }
  const owed = toCall - s.bet;
  let v = strength(s.hole, board);
  const odds = owed > 0 ? owed / (pot + owed) : 0;

  let callAt = 0.34;
  let raiseAt = 0.72;
  let bluff = 0;
  switch (s.style) {
    case 'rock':
      callAt = 0.5;
      raiseAt = 0.82;
      break;
    case 'caller':
      // Pays to see it, and hardly ever puts it in himself.
      callAt = 0.16;
      raiseAt = 0.94;
      break;
    case 'shark':
      // Plays the price: a cheap call needs less than an expensive one.
      callAt = 0.28 + odds * 0.6;
      raiseAt = 0.7;
      break;
    case 'bluffer':
      callAt = 0.3;
      raiseAt = 0.66;
      // A third of the time he decides his hand is something it is not.  It is
      // a lie about a number he has already worked out, which is the
      // difference between a bluff and a random raise.
      bluff = Math.random() < 0.32 ? 0.45 : 0;
      break;
    case 'wild':
      callAt = 0.12;
      raiseAt = 0.45;
      bluff = Math.random() < 0.5 ? 0.3 : 0;
      break;
    default:
      break;
  }
  v = Math.min(1, v + bluff);

  if (v >= raiseAt && s.chips > owed) {
    const raise = Math.max(lastRaise, blind) * (s.style === 'wild' ? 2 : 1);
    const put = Math.min(s.chips, owed + raise);
    post(i, put);
    toCall = s.bet;
    lastRaise = raise;
    closer = i;
    s.said = s.allIn ? 'ALL IN' : `RAISE ${toCall}`;
  } else if (owed <= 0) {
    s.said = 'CHECK';
  } else if (v >= callAt) {
    post(i, owed);
    s.said = s.allIn ? 'ALL IN' : `CALL ${owed}`;
  } else {
    s.folded = true;
    s.said = 'FOLD';
  }
  refresh();
  advance();
}

// ------------------------------------------------------------------ drawing

function cardArt(scene: Phaser.Scene, x: number, y: number, c: number | null): Phaser.GameObjects.Container {
  const w = 15;
  const h = 21;
  const face = c === null;
  const red = c !== null && (suitOf(c) === 1 || suitOf(c) === 2);
  const parts: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(0, 0, w, h, face ? 0x2a2f52 : PALETTE.bone).setStrokeStyle(1, face ? 0x4a5490 : PALETTE.ash),
  ];
  if (face) {
    parts.push(scene.add.rectangle(0, 0, w - 6, h - 6, 0x3a447a));
  } else {
    parts.push(centerText(scene, 0, -8, RANKS[rankOf(c)], red ? PALETTE.blood : PALETTE.ink));
    parts.push(centerText(scene, 0, 1, SUITS[suitOf(c)], red ? PALETTE.blood : PALETTE.ink));
  }
  return scene.add.container(x, y, parts).setDepth(25);
}

function showBoard(): void {
  if (!sceneRef) return;
  for (const a of boardArt) a.destroy();
  boardArt = board.map((c, i) => cardArt(sceneRef as Phaser.Scene, GAME_W / 2 - 34 + i * 17, 96, c));
}

function showHole(): void {
  if (!sceneRef) return;
  for (const a of holeArt) a.destroy();
  holeArt = seats[ME].hole.map((c, i) => cardArt(sceneRef as Phaser.Scene, GAME_W / 2 - 10 + i * 20, 142, c));
}

let standing = '';

function say(msg: string): void {
  standing = msg;
  hud?.msg.setText(msg).setTint(PALETTE.cream);
}

/** What the player just did, under the board, since he has no plate. */
function sayMine(): void {
  const me = seats[ME];
  if (!me) return;
  hud?.msg.setText(me.said ? `YOU: ${me.said}` : standing);
}

function setButtons(on: boolean): void {
  const owed = toCall - (seats[ME]?.bet ?? 0);
  for (const b of buttons) {
    b.box.setVisible(on);
    b.label.setVisible(on);
    if (!on) continue;
    if (b.act === 'call') b.label.setText(owed <= 0 ? 'CHECK' : `CALL ${owed}`);
    if (b.act === 'fold') b.label.setTint(owed <= 0 ? PALETTE.ash : PALETTE.cream);
  }
}

function refresh(): void {
  if (!hud) return;
  hud.pot.setText(pot > 0 ? `POT ${pot}` : '');
  hud.goal.setText(`YOU ${seats[ME]?.chips ?? 0} / ${TARGET_CHIPS}`);
  hud.goal.setTint((seats[ME]?.chips ?? 0) >= TARGET_CHIPS ? PALETTE.mossLight : PALETTE.tealLight);
  hud.street.setText(street.toUpperCase());
  for (const s of seats) {
    const dead = s.chips <= 0 && s.folded;
    const line = dead ? 'OUT' : s.said ? s.said : `${s.chips}${s.bet ? ` (${s.bet})` : ''}`;
    s.art.info.setText(line);
    s.art.info.setTint(s.folded && !dead ? PALETTE.ash : PALETTE.cream);
    s.art.plate.setAlpha(s.folded ? 0.4 : 0.85);
    // The style stays on its own row, dimmer than the money, so a player can
    // read who is doing what to them without a manual and without squinting.
    s.art.style.setTint(s.folded ? PALETTE.steel : PALETTE.ash);
  }
}
