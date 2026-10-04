/**
 * FROGGY 21 (blackjack, at Froggy's table).  A table, not a cabinet.
 *
 * Sitting down is free.  The table charges for the HAND, not for the chair:
 * you can walk up, read what he deals and how it pays, and walk away again
 * without a token moving.  When you do want a hand you put the bet up — the
 * table minimum is one, the ceiling is your pocket — and it is debited when he
 * deals.  A win pays the whole stake back at 2x.
 *
 * It is a table, so it deals as long as you want it to: every hand settles on
 * the spot and, while you can still cover the minimum, you can push another
 * ante out and go again.  Standing up is the only thing that ends the session,
 * and the shell reports how the whole sitting went.  Every token in and out
 * still moves through the shell, so the ledger stays the only path.
 *
 * ONE DECK, ONE SHOE, FOR BOTH OF YOU.  There is a single 52-card array, it is
 * Fisher-Yates shuffled when the sitting opens, and every card either of you
 * receives is taken off the top of it — there is no second source of randomness
 * anywhere in this file, and no card can come out twice inside a shoe because
 * a dealt card is removed from the array rather than copied out of it.  He
 * reshuffles when the shoe gets thin (under 15 cards), which is the only time
 * a card can appear again.  What the hand is worth is read off the cards that
 * actually came out; nothing here decides the result first and deals to match.
 *
 * Single deck, the dealer draws to 17, and a push is a push: the same total on
 * both sides hands your stake straight back, so a tied hand costs nothing and
 * pays nothing.
 *
 * FROGGY'S OWN RULES ARE THE REST OF IT, and every one of them cuts both ways:
 *
 *   FIVE CARDS IS THE CEILING.  There is no sixth, so a soft hand cannot be
 *   ground upward one card at a time for ever.
 *
 *   AN ACE IS YOURS TO CALL, ON TWO CARDS.  One or eleven, and you may change
 *   your mind for as long as you are still on two.  From the THIRD card it is
 *   a one and it stays a one -- so taking a card takes the choice with it.
 *
 *   A NATURAL -- twenty-one on the first two cards -- is turned over and
 *   settled on the spot, whoever holds it, at twice the usual win or loss.
 *   Both of you on a natural is a push.
 *
 *   TWENTY-ONE ON EXACTLY THREE CARDS WINS, there and then.  TWENTY-ONE ON
 *   FIVE LOSES -- you went one card too far for it.  Both cut both ways: his
 *   three-card twenty-one beats you, his five-card twenty-one loses.
 *
 *   FIVE CARDS WITHOUT BUSTING (and not on 21) WINS -- the five-card charlie
 *   -- even on a total he could match.
 *
 *   Outcomes are settled in that order: natural, three-card 21, five-card
 *   21, charlie, then the ordinary comparison, then the bust.
 *
 *   FIFTEEN ON TWO CARDS IS THE ONE YOU MAY WALK AWAY FROM.  Too high to hit,
 *   too low to stand: leave it and the stake comes back untouched.
 *
 * The cards are Froggy's own (cardArt.ts): lily pads, fireflies, pond drops
 * and tadpoles for suits, and a Frog Scout, Frog Mage and Frog King where the
 * jack, queen and king were -- still worth ten each.
 *
 * Froggy deals.  He is drawn on the unfiltered overlay like everywhere else —
 * he is never a sprite (PRD FR-1).
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import { froggyLayer } from '../render/froggyLayer';
import { drawFroggy } from '../froggy/froggy';
import { drawSuitedMan } from '../froggy/suit';
import { store } from '../core/state';
import { CARD_BACK, CARD_H, CARD_W, ensureCardArt, FACE_OF, SUIT_OF } from './cardArt';
import type { MinigameApi, MinigameModule } from './types';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** Where Froggy stands, and the two rows of felt in front of him. */
const DEALER = { x: GAME_W / 2, y: 58, height: 38 };
const DEALER_ROW = 62;
/**
 * The player's row moved up four pixels to make room under it.
 *
 * Cards are thirty deep, so at 104 they ran to 134 and left twenty-three
 * pixels for a line of narration AND a row of buttons before HIT and STAND --
 * which is two pixels less than the two of them need.  The ACE button was
 * drawn straight over the line telling the player what the ace was doing.
 */
const PLAYER_ROW = 100;

interface Card {
  rank: string;
  suit: string;
}

type Phase = 'bet' | 'play' | 'over';

let deck: Card[] = [];
/** Which shoe this is, and everything that has come out of it.  DEV only. */
let shoeId = 0;
let drawn: Card[] = [];
let player: Card[] = [];
let dealer: Card[] = [];
let phase: Phase = 'bet';
let standing = false;
/**
 * The player's answer to their own ace while they are still on two cards.
 *
 * Eleven to start with, because that is the answer that makes a two card hand
 * interesting; it is theirs to change until they take a third card, at which
 * point `score` stops reading it (see the note there).
 */
let aceAs: AceAs = 11;
/** What the settled hand's win or loss is multiplied by: a natural, or nothing. */
let stakeMul = 1;
/** Tokens the player has asked to put up.  Staked for real when he deals. */
let bet = 1;
/** Of that, what is already debited for THIS hand and cannot come back off. */
let ante = 1;
/** Hands played this sitting, for the line under the buttons. */
let hands = 0;
/** How the last hand went, kept so his next question can sit beside it. */
let outcome = '';
let clock = 0;
/** Seconds left of the talking mouth, so he only moves when he says something. */
let talking = 0;
let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let table: Phaser.GameObjects.Container | null = null;
let betUi: Phaser.GameObjects.Container | null = null;
let status: Phaser.GameObjects.BitmapText | null = null;
/** The stake, big, between the two rows of buttons. */
let betText: Phaser.GameObjects.BitmapText | null = null;
let hitBtn: Phaser.GameObjects.Container | null = null;
let standBtn: Phaser.GameObjects.Container | null = null;
let aceBtn: Phaser.GameObjects.Container | null = null;
let quitHandBtn: Phaser.GameObjects.Container | null = null;
let againBtn: Phaser.GameObjects.Container | null = null;
let leaveBtn: Phaser.GameObjects.Container | null = null;

/**
 * WHAT AN ACE IS WORTH AT THIS TABLE.
 *
 * Not the usual "eleven until that busts".  Froggy's rule is that the ace is
 * YOURS TO PRICE, and what the table will let you price it at depends on how
 * many cards you are holding:
 *
 *   TWO CARDS   one, ten or eleven, and you can change your mind for as long
 *               as you are still on two.  That is the whole of the decision
 *               the two-card hand offers.
 *   THREE OR MORE   eleven is off the table.  The ace is one or ten, and it
 *               stays yours to choose -- taking a card narrows the choice
 *               rather than ending it.
 *
 * AND TWO ACES ARE TWENTY-ONE.  Dealt a pair of them, one is priced at ten and
 * the other at eleven and the hand is 21 on the spot: no choice to make, no
 * button, nothing to change.  It is the only hand at this table that scores
 * itself.
 *
 * `pick` is the player's current answer.  The dealer never has one -- he is
 * scored the way he always was, eleven at two cards unless it busts him and
 * one from the third, which is his own business and not the player's rule.
 */
function score(hand: Card[], pick?: AceAs): number {
  if (bothAces(hand)) return 21;
  const aces = hand.filter((c) => c.rank === 'A').length;
  let total = 0;
  for (const c of hand) {
    if (c.rank === 'A') total += 1;
    else if (['J', 'Q', 'K'].includes(c.rank)) total += 10;
    else total += Number(c.rank);
  }
  if (!aces) return total;
  // The player's own answer, applied to ONE ace -- any others stay at one,
  // which is the only reading under which a hand of aces is not a lottery.
  if (pick !== undefined && aceChoices(hand).includes(pick)) return total + (pick - 1);
  // Nobody's choice: the dealer's own reading, unchanged.
  if (hand.length >= 3) return total;
  return total + 10 <= 21 ? total + 10 : total;
}

/** What the player may price their ace at.  Empty when there is nothing to decide. */
type AceAs = 1 | 10 | 11;
const ACE_ON_TWO: AceAs[] = [1, 10, 11];
const ACE_ON_MORE: AceAs[] = [1, 10];

/** Dealt two aces: the hand is 21 and there is no choice in it. */
function bothAces(hand: Card[]): boolean {
  return hand.length === 2 && hand.every((c) => c.rank === 'A');
}

/**
 * The prices this hand may put on its ace, in the order the button offers
 * them.  One list, read by the button, by the arithmetic and by the harness,
 * so they cannot disagree about what is legal.
 */
function aceChoices(hand: Card[]): AceAs[] {
  if (bothAces(hand) || !hand.some((c) => c.rank === 'A')) return [];
  return hand.length === 2 ? ACE_ON_TWO : ACE_ON_MORE;
}

/** Does this hand still offer the choice? */
function aceIsOpen(hand: Card[]): boolean {
  return aceChoices(hand).length > 0;
}

/** The player's hand as it stands, with their ace answer applied. */
function mine(): number {
  return score(player, aceIsOpen(player) ? aceAs : undefined);
}

/** The table minimum.  Froggy will not deal under it. */
const MINIMUM = 1;

/**
 * FROGGY'S HOUSE RULES.
 *
 * MAX_CARDS: five, and there is no sixth -- for him as well as for you.
 *
 * NATURAL_MUL: twenty-one on the first two cards is a natural.  It is turned
 * over and settled the moment it is dealt, for whichever side holds it, and
 * it is worth twice the ordinary win or loss.  Both sides on one is a push.
 *
 * THREE_FOR_21: exactly twenty-one on exactly three cards wins on the spot.
 * FIVE_FOR_21: exactly twenty-one on five cards LOSES.  Both apply to him as
 * well: his three-card twenty-one beats you, his five-card one loses.
 *
 * A five-card hand that has not bust (and is not on 21) is a FIVE-CARD
 * CHARLIE and simply wins, even against a total he could have matched.
 *
 * The order they are settled in: natural, three-card 21, five-card 21,
 * charlie, the ordinary comparison, and the bust.  They never stack.
 *
 * The multiplier applies to the PROFIT or the LOSS, not to the stake: a plain
 * win hands back the stake and the same again (2x), a natural hands back the
 * stake and twice it (3x).
 *
 * SURRENDER_ON: fifteen on two cards is the worst place to be at this table,
 * so it is the one hand you are allowed to walk away from with your stake
 * intact.  Two cards only: take a third and you have chosen.
 */
const MAX_CARDS = 5;
const NATURAL_MUL = 2;
const THREE_FOR_21 = 3;
const FIVE_FOR_21 = 5;
const SURRENDER_ON = 15;

/**
 * A natural: twenty-one on two cards.  The player's ace is theirs to price, so
 * an ace and a ten-card is a natural because eleven is on offer -- nobody
 * would price it otherwise; two aces are twenty-one by the table's own rule.
 */
function isNatural(hand: Card[], isPlayer: boolean): boolean {
  if (hand.length !== 2) return false;
  if (!isPlayer) return score(hand) === 21;
  return bothAces(hand) || aceChoices(hand).some((v) => score(hand, v) === 21);
}

/** The most this hand could ride: what is already down, plus what is left. */
function maxBet(): number {
  const api = apiRef;
  if (!api) return 1;
  return ante + api.balance();
}

export const blackjack: MinigameModule = {
  id: 'blackjack',
  title: 'FROGGY 21',
  music: 'game_blackjack',
  rules: 'bet what you like, beat the dealer to 21',
  tutorial: {
    objective: [
      // FIVE LINES, AND FIVE IS THE CARD'S CEILING WITH FIVE CONTROLS ON IT:
      // the ace rule is two lines because it is two rules, and the fifteen has
      // to survive both of them -- a rule the card drops is a rule the player
      // finds out about by losing to it.
      'BEAT THE DEALER TO 21. J, Q AND K = 10.',
      'ACE: 1, 10 OR 11 ON TWO CARDS, THEN 1/10.',
      '21 ON TWO CARDS WINS AT ONCE, 2X - HIS TOO.',
      '21 ON 3 CARDS WINS. 21 ON 5 CARDS LOSES.',
      '5 UNBUST WIN. 15 ON 2? LEAVE IT FOR FREE.',
    ],
    controls: [
      ['LEFT/RIGHT', 'BET 1 DOWN OR UP'],
      ['UP / DOWN', 'BET 5 UP OR DOWN'],
      ['SPACE', 'DEAL, THEN STAND'],
      ['H', 'HIT'],
      ['C', 'CASH OUT'],
    ],
  },
  // The stick is the bet — left and right by one, up and down by five — and
  // SPACE is the one button that both deals the hand and stands on it.
  touch: {
    stick: 'wasd',
    arrows: true,
    buttons: [
      { label: 'DEAL\nSTAND', key: 'SPACE', primary: true },
      { label: 'HIT', key: 'H' },
      { label: 'CASH\nOUT', key: 'C' },
    ],
  },
  payoutNote: 'PAYS 2X - UP TO 3X',

  // Walking out mid-hand loses the bet on the felt (doubled, if it was);
  // between hands nothing is down but the ante, if one is.
  atRisk: () => (phase === 'play' ? bet * stakeMul : phase === 'bet' ? ante : 0),
  reportsSitting: true,
  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    phase = 'bet';
    standing = false;
    aceAs = 11;
    stakeMul = 1;
    clock = 0;
    talking = 1.2;
    hands = 0;
    outcome = '';
    player = [];
    dealer = [];
    // Nothing is on the felt yet.  Sitting down was free, so `staked` is zero
    // and the whole bet is debited when he deals; if some other room ever does
    // charge at the door, that token is already down and counts as the ante.
    ante = api.staked();
    bet = Math.max(MINIMUM, ante);

    shuffle();

    ensureCardArt(scene);
    paintFelt(scene);

    // ---- THE NARRATION SITS ABOVE THE BUTTONS AND CLEAR OF THEM.
    //
    // Cards end at 130, this line runs 133-141, the sometimes-buttons below it
    // run 144.5-155.5 and HIT and STAND run from 157.5.  Nothing on this felt
    // overlaps anything else on it.
    status = text(scene, GAME_W / 2, 133, 'PLACE YOUR BET', PALETTE.cream).setOrigin(0.5, 0).setCenterAlign();
    status.setLineSpacing(1);
    betText = centerText(scene, GAME_W / 2, 116, '', PALETTE.gold, 16);
    hitBtn = button(scene, GAME_W / 2 - 40, 164, 'HIT', () => hit(), { width: 56, height: 13 });
    standBtn = button(scene, GAME_W / 2 + 40, 164, 'STAND', () => stand(), { width: 56, height: 13 });
    // ---- the two that are only sometimes yours.  They sit on their own row
    // above HIT and STAND, and each appears only while the hand it belongs to
    // is on the felt: the ace one while there is an ace to price, the fifteen
    // one while you are on two cards worth exactly fifteen.
    aceBtn = button(scene, GAME_W / 2 - 40, 150, 'ACE 11', () => flipAce(), {
      width: 56,
      height: 11,
      fill: PALETTE.tealDark,
    });
    quitHandBtn = button(scene, GAME_W / 2 + 40, 150, 'LEAVE IT', () => surrender(), {
      width: 56,
      height: 11,
      fill: PALETTE.tealDark,
    });
    againBtn = button(scene, GAME_W / 2 - 46, 164, 'ANOTHER HAND', () => nextHand(), {
      width: 76,
      height: 13,
      fill: PALETTE.tealDark,
    });
    leaveBtn = button(scene, GAME_W / 2 + 46, 164, 'CASH OUT', () => leave(), { width: 76, height: 13 });
    for (const b of [hitBtn, standBtn, againBtn, leaveBtn, aceBtn, quitHandBtn]) b.setVisible(false);

    buildBetUi(scene);

    scene.input.keyboard?.on('keydown-H', () => hit());
    scene.input.keyboard?.on('keydown-SPACE', () => onConfirm());
    scene.input.keyboard?.on('keydown-ENTER', () => onConfirm());
    scene.input.keyboard?.on('keydown-C', () => leave());
    scene.input.keyboard?.on('keydown-RIGHT', () => raise(1));
    scene.input.keyboard?.on('keydown-UP', () => raise(5));
    scene.input.keyboard?.on('keydown-LEFT', () => lower(1));
    scene.input.keyboard?.on('keydown-DOWN', () => lower(5));

    render();

    if (import.meta.env?.DEV) {
      // What he is holding and what he just said, side by side: the status line
      // used to claim a seventeen every hand, and the only way to keep it
      // honest is to be able to read both at once.
      (window as unknown as Record<string, unknown>).__blackjack = {
        state: () => ({
          phase,
          standing,
          bet,
          ante,
          hands,
          player: mine(),
          dealer: score(dealer),
          aceAs,
          aceOpen: aceIsOpen(player),
          /** What the table will let this hand price its ace at, in button order. */
          aceChoices: aceChoices(player),
          bothAces: bothAces(player),
          canSurrender: canSurrender(),
          maxCards: MAX_CARDS,
          stakeMul,
          // What the hand would be multiplied by if it landed as it stands.
          mulNow: stakeMul,
          status: status?.text ?? '',
          // The shoe, so a test can prove both hands come out of one deck.
          shoe: shoeId,
          left: deck.length,
          drawn: drawn.map((c) => `${c.rank}${c.suit}`),
          cards: {
            player: player.map((c) => `${c.rank}${c.suit}`),
            dealer: dealer.map((c) => `${c.rank}${c.suit}`),
          },
        }),
        deal: () => deal(),
        hit: () => hit(),
        stand: () => stand(),
        flipAce: () => flipAce(),
        surrender: () => surrender(),
        /**
         * Deal a KNOWN hand.  The rules being added here are all about the
         * shape of a hand -- five cards, an ace on two, exactly fifteen -- and
         * waiting for a shuffled shoe to produce one is not a test, it is a
         * lottery.  Everything else still comes off the real deck.
         */
        setHands: (mineCards: string[], his: string[]) => {
          const parse = (t: string): Card => ({ rank: t.slice(0, -1), suit: t.slice(-1) });
          player = mineCards.map(parse);
          dealer = his.map(parse);
          // a set hand is a hand in play, whatever the deal it replaced did
          phase = 'play';
          standing = false;
          stakeMul = 1;
          render();
        },
        /** Put these cards on top of the shoe, first listed first out. */
        stackShoe: (cards: string[]) => {
          const parse = (t: string): Card => ({ rank: t.slice(0, -1), suit: t.slice(-1) });
          deck.push(...cards.map(parse).reverse());
        },
        balance: () => apiRef?.balance() ?? 0,
        again: () => nextHand(),
        leave: () => leave(),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__blackjack;
      });
    }
  },

  update(_time: number, delta: number) {
    if (!sceneRef) return;
    clock += delta / 1000;
    talking = Math.max(0, talking - delta / 1000);
    // The same swap the casino floor makes: after the night, the hand is being
    // dealt by the man in the suit.  Sitting down at this table is the longest
    // anyone looks at him, so he has to hold up close -- and hold up doing
    // nothing, which is most of what he does.
    const gone = store.get().froggyGone;
    froggyLayer.paint((ctx) => {
      if (gone) {
        drawSuitedMan(ctx, {
          x: DEALER.x,
          y: DEALER.y,
          height: DEALER.height,
          pose: talking > 0 ? 'talk' : 'idle',
          bounce: (clock * 0.28) % 1,
        });
      } else {
        drawFroggy(ctx, {
          x: DEALER.x,
          y: DEALER.y,
          height: DEALER.height,
          variant: 'cozy',
          pose: talking > 0 ? 'talk' : 'idleA',
          bounce: (clock * 0.5) % 1,
        });
      }
    });
  },

  destroy() {
    froggyLayer.clear();
    table?.destroy();
    betUi?.destroy();
    table = null;
    betUi = null;
    status = null;
    betText = null;
    hitBtn = null;
    standBtn = null;
    aceBtn = null;
    quitHandBtn = null;
    againBtn = null;
    leaveBtn = null;
    sceneRef = null;
    apiRef = null;
  },
};

/** The table itself: wood, felt, and the arc Froggy deals across. */
function paintFelt(scene: Phaser.Scene): void {
  scene.add.rectangle(0, 18, GAME_W, 162, PALETTE.brown).setOrigin(0, 0);
  for (let x = 0; x < GAME_W; x += 18) scene.add.rectangle(x, 18, 1, 162, 0x5a3e26).setOrigin(0, 0).setAlpha(0.6);
  scene.add.ellipse(GAME_W / 2, 34, 308, 46, 0x8a6a3a);
  scene.add.ellipse(GAME_W / 2, 34, 300, 40, 0x12401f);
  scene.add.rectangle(0, 34, GAME_W, 146, 0x12401f).setOrigin(0, 0);
  // felt seam, so it reads as a table rather than a green rectangle
  scene.add.ellipse(GAME_W / 2, 112, 280, 116, 0x16522a).setAlpha(0.5);
  // the dealer's arc, and the betting spot the chips sit on
  scene.add.ellipse(GAME_W / 2, 74, 220, 46, 0x000000, 0).setStrokeStyle(1, 0x1d5c2d);
  scene.add.ellipse(46, 130, 34, 16, 0x000000, 0).setStrokeStyle(1, 0x1d5c2d);
  // Whose game this is.  It is not his any more, and the corner of the felt
  // should not still be saying it was -- but the replacement does not get a
  // name either, because nobody has given one.
  text(scene, 12, 38, store.get().froggyGone ? 'THE HOUSE DEALS' : 'FROGGY DEALS', PALETTE.ash).setAlpha(0.7);
  text(scene, 12, 92, 'YOU', PALETTE.cream);
}

// ------------------------------------------------------------------- betting

function buildBetUi(scene: Phaser.Scene): void {
  betUi?.destroy();
  const c = scene.add.container(0, 0);
  betUi = c;

  c.add(centerText(scene, GAME_W / 2, 96, 'HOW MUCH?', PALETTE.cream));
  c.add(button(scene, 92, 116, '-5', () => lower(5), { width: 26, height: 13 }));
  c.add(button(scene, 120, 116, '-1', () => lower(1), { width: 26, height: 13 }));
  c.add(button(scene, 200, 116, '+1', () => raise(1), { width: 26, height: 13 }));
  c.add(button(scene, 228, 116, '+5', () => raise(5), { width: 26, height: 13 }));
  c.add(button(scene, 268, 116, 'ALL IN', () => raise(maxBet()), { width: 44, height: 13 }));
  // (above the buttons, not under them: under them it sat on the status line)
  c.add(centerText(scene, GAME_W / 2, 84, 'THE SEAT IS FREE - MINIMUM BET 1', PALETTE.ash));
  c.add(
    button(scene, GAME_W / 2, 164, 'DEAL', () => deal(), {
      width: 64,
      height: 15,
      fill: PALETTE.tealDark,
    }),
  );
}

function raise(n: number): void {
  if (phase !== 'bet' || !apiRef) return;
  const next = Math.min(maxBet(), bet + n);
  if (next === bet) {
    audio.sfx('buzzer');
    if (bet >= maxBet()) say('THAT IS EVERY TOKEN YOU HAVE');
    return;
  }
  bet = next;
  setStatus('PLACE YOUR BET'); // clears whatever he last told you off for
  audio.sfx('ui_blip');
  render();
}

function lower(n: number): void {
  if (phase !== 'bet' || !apiRef) return;
  // The table minimum is the floor, and anything already staked on this hand
  // (a door charge, if a room ever takes one) cannot come back off under it.
  const next = Math.max(Math.max(ante, MINIMUM), bet - n);
  if (next === bet) {
    audio.sfx('buzzer');
    return;
  }
  bet = next;
  setStatus('PLACE YOUR BET');
  audio.sfx('ui_hover');
  render();
}

function deal(): void {
  if (phase !== 'bet' || !sceneRef || !apiRef) return;

  // The bet goes down now, through the shell — all of it, since sitting down
  // took nothing.  This is the first and only moment a hand costs anything.
  const extra = bet - ante;
  if (extra > 0 && !apiRef.raise(extra)) {
    audio.sfx('buzzer');
    // Back to the smallest bet he will take, never to zero: a zero bet cannot
    // be raised, so the DEAL button would stop meaning anything.
    bet = Math.max(MINIMUM, ante);
    say('YOU CANNOT COVER THAT');
    render();
    return;
  }
  ante = bet;

  phase = 'play';
  hands++;
  betUi?.destroy();
  betUi = null;
  audio.sfx('coin_drop');

  player = [take(), take()];
  dealer = [take(), take()];
  say('HIT OR STAND');

  // A NATURAL IS SETTLED BEFORE ANYONE TOUCHES ANYTHING.  His hole card turns
  // over, no more cards come out, and it pays (or costs) double.
  const mineN = isNatural(player, true);
  const hisN = isNatural(dealer, false);
  if (mineN || hisN) {
    if (mineN && aceIsOpen(player)) aceAs = 11;
    standing = true;
    if (mineN && hisN) {
      finish(false, 'TWO NATURALS - PUSH', true);
    } else {
      stakeMul = NATURAL_MUL;
      if (mineN) finish(true, 'NATURAL 21 - PAYS 2X');
      else finish(false, 'HIS NATURAL 21 - COSTS 2X');
      sceneRef.cameras.main.flash(200, mineN ? 255 : 200, mineN ? 220 : 40, mineN ? 120 : 40);
    }
    return;
  }
  hitBtn?.setVisible(true);
  standBtn?.setVisible(true);
  render();
}

// ---------------------------------------------------------------------- play

function hit(): void {
  if (phase !== 'play' || standing || !sceneRef) return;
  // FIVE IS THE CEILING.  The button is hidden at five, but the key is not,
  // so the rule lives here rather than in whether a thing is on screen.
  if (player.length >= MAX_CARDS) {
    audio.sfx('buzzer', 0.4);
    say(`FIVE IS ALL YOU GET - STAND ON ${mine()}`);
    return;
  }
  player.push(take());
  settleAce();
  audio.sfx('ui_blip');
  render();
  // The ace's price is picked for the player where it matters, and picked
  // kindly: on the THIRD card, whichever price lands on twenty-one (that hand
  // wins outright); on the FIFTH, anything but twenty-one if there is a price
  // that does not bust (twenty-one on five loses, a charlie wins).
  const choices = aceChoices(player);
  if (choices.length && player.length === THREE_FOR_21) {
    const exact = choices.find((v) => score(player, v) === 21);
    if (exact !== undefined) aceAs = exact;
  } else if (choices.length && player.length >= FIVE_FOR_21) {
    const safe = choices.filter((v) => score(player, v) < 21);
    if (score(player, aceAs) === 21 && safe.length) aceAs = safe[safe.length - 1];
  }
  const p = mine();
  if (p > 21) {
    finish(false, player.length >= MAX_CARDS ? 'BUST ON THE FIFTH' : 'BUST');
    return;
  }
  // Three cards on exactly twenty-one: won, there and then.
  if (player.length === THREE_FOR_21 && p === 21) {
    standing = true;
    finish(true, 'THREE-CARD 21 - YOU WIN');
    sceneRef.cameras.main.flash(220, 255, 230, 140);
    return;
  }
  // Five cards and still standing: he does not get to play.  On twenty-one
  // it is lost -- one card too many for it; on anything under, a charlie.
  if (player.length >= MAX_CARDS) {
    standing = true;
    if (p === 21 && player.length === FIVE_FOR_21) {
      finish(false, 'FIVE-CARD 21 - YOU LOSE');
      sceneRef.cameras.main.shake(200, 0.004);
    } else {
      finish(true, `FIVE-CARD CHARLIE ON ${p}`);
    }
  }
}

/**
 * Flip the ace, while it is still yours to flip.
 *
 * Only ever legal on two cards: `aceIsOpen` is the same test `score` uses to
 * decide whether to read `aceAs` at all, so the button and the arithmetic can
 * never disagree about whether the choice is still open.
 */
function flipAce(): void {
  if (phase !== 'play' || standing) return;
  const choices = aceChoices(player);
  if (!choices.length) return;
  aceAs = choices[(choices.indexOf(aceAs) + 1) % choices.length];
  audio.sfx('ui_hover', 0.5);
  say(`ACE PLAYS AS ${aceAs} - YOU HAVE ${mine()}`);
  render();
}

/**
 * KEEP THE ANSWER LEGAL, AND KEEP IT KIND.
 *
 * Eleven is only on offer at two cards, so a player who priced their ace at
 * eleven and then hit is holding an answer the table no longer sells.  The
 * table picks for them, and it picks THE BEST PRICE THAT DOES NOT BUST THEM:
 * A+6 priced at eleven, hit for a 9, is a 26 if the ace comes down to ten and
 * a 16 if it comes down to one, and the bust is checked on the same frame --
 * so choosing the nearest number instead of the best one would take the hand
 * off a player who still had a legal way to keep it.  Only if every price
 * busts does it take the lowest.  Called from the one place a hand grows.
 */
function settleAce(): void {
  const choices = aceChoices(player);
  if (!choices.length || choices.includes(aceAs)) return;
  const alive = choices.filter((v) => score(player, v) <= 21);
  aceAs = alive.length ? alive[alive.length - 1] : choices[0];
}

/**
 * WALK AWAY FROM A TWO CARD FIFTEEN.
 *
 * Fifteen on two is the worst hand at the table -- too high to hit without
 * expecting to bust, too low to stand on -- so it is the one hand Froggy lets
 * you out of, and it costs nothing.  The stake comes back exactly the way a
 * push returns it, which is also why this is a `push` finish rather than a
 * loss with a refund bolted on: the ledger has one path for "nothing changed
 * hands" and this takes it.
 */
function surrender(): void {
  if (phase !== 'play' || standing || !canSurrender()) return;
  audio.sfx('ui_blip', 0.6);
  finish(false, `YOU LEAVE IT ON ${SURRENDER_ON} - STAKE BACK`, true);
}

/** Two cards, and exactly the number he lets you off. */
function canSurrender(): boolean {
  return phase === 'play' && !standing && player.length === 2 && mine() === SURRENDER_ON;
}

function stand(): void {
  if (phase !== 'play' || standing || !sceneRef) return;
  standing = true;
  // The hole card turns over here, so the first thing he can honestly say is
  // what he is actually holding.  "DEALER STANDS ON 17" is a RULE, not a
  // score, and saying it every hand told the player his total was 17 when it
  // was very often nothing of the kind — so nothing below states a number the
  // cards on the felt do not show.
  say(`YOU STAND ON ${mine()} - DEALER SHOWS ${score(dealer)}`);
  render();

  // Dealer draws to 17, one card at a time so you can watch it happen, and
  // says his real total after each one.
  const step = () => {
    if (phase === 'over') return;
    if (score(dealer) < 17 && dealer.length < MAX_CARDS) {
      dealer.push(take());
      audio.sfx('ui_hover');
      render();
      const d = score(dealer);
      // Whatever he drew to, including past 21 — the line must never be left
      // showing the total he had one card ago.
      say(d > 21 ? `DEALER BUSTS ON ${d}` : `DEALER DRAWS - ${d}`);
      sceneRef?.time.delayedCall(600, step);
      return;
    }
    const p = mine();
    const d = score(dealer);
    if (d > 21) {
      settleWon(p, `DEALER BUSTS`);
      return;
    }
    // His three-card twenty-one beats you, whatever you are on; his
    // five-card twenty-one loses, the same as yours would.
    if (dealer.length === THREE_FOR_21 && d === 21) {
      settleLost(d, 'HIS THREE-CARD 21 WINS');
      sceneRef?.cameras.main.shake(200, 0.004);
      return;
    }
    if (dealer.length === FIVE_FOR_21 && d === 21) {
      settleWon(p, 'HIS FIVE-CARD 21 - HE LOSES');
      return;
    }
    // He stopped, and this is the total he stopped on — 17 through 21, and
    // the line says which.
    say(`DEALER STANDS ON ${d}`);
    sceneRef?.time.delayedCall(700, () => {
      if (phase === 'over') return;
      if (p > d) settleWon(p, `${p} BEATS ${d}`);
      else if (p === d) finish(false, `PUSH ON ${p} - BET RETURNED`, true);
      else settleLost(d, `${d} BEATS ${p}`);
    });
  };
  sceneRef.time.delayedCall(600, step);
}

/** The player took it on the ordinary comparison: the stake and the same again. */
function settleWon(_p: number, why: string): void {
  stakeMul = 1;
  finish(true, why);
}

/** He took it on the ordinary comparison: the stake. */
function settleLost(_d: number, why: string): void {
  stakeMul = 1;
  finish(false, why);
}

/**
 * THE TABLE'S ONE LINE, WHICH MAY BE TWO.  It sits between the cards and the
 * buttons and is 34 letters wide -- clear of the chips on the left and of the
 * felt's edge on the right.  Anything longer is broken, at the dash where
 * there is one, onto a second line; a second line only ever happens once the
 * hand is over, when the row it uses has no buttons on it.
 */
const STATUS_CHARS = 34;
function wrapStatus(msg: string): string {
  if (msg.length <= STATUS_CHARS) return msg;
  const dash = msg.lastIndexOf(' - ', STATUS_CHARS);
  if (dash > 0 && msg.length - dash - 3 <= STATUS_CHARS) return `${msg.slice(0, dash)}\n${msg.slice(dash + 3)}`;
  const lines: string[] = [];
  let line = '';
  for (const word of msg.split(' ')) {
    if (line && line.length + 1 + word.length > STATUS_CHARS) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  lines.push(line);
  return lines.slice(0, 2).join('\n');
}
function setStatus(msg: string): void {
  status?.setText(wrapStatus(msg));
}

/** Froggy says it, and his mouth moves while he does. */
function say(msg: string): void {
  setStatus(msg);
  talking = 1;
}

function render(): void {
  if (!sceneRef) return;
  table?.destroy();
  const c = sceneRef.add.container(0, 0);
  table = c;

  const drawHand = (hand: Card[], y: number, hideSecond: boolean) => {
    // Centred under the dealer, so the table stays symmetrical as it fills.
    const left = Math.round(GAME_W / 2 - (hand.length * 26 - 4) / 2);
    hand.forEach((card, i) => {
      const x = left + i * 26;
      const s = sceneRef!;
      if (hideSecond && i === 1) {
        c.add(s.add.image(x, y, CARD_BACK).setOrigin(0, 0));
        return;
      }
      // The face: the rank in the suit's ink top left, the suit top right,
      // and in the middle either the suit large or the court frog.
      const suit = SUIT_OF[card.suit];
      const court = FACE_OF[card.rank];
      c.add(s.add.rectangle(x, y, CARD_W, CARD_H, 0xf4ecd8).setOrigin(0, 0).setStrokeStyle(1, 0x0d2916));
      c.add(text(s, x + 2, y + 2, court ? court.corner : card.rank, suit.ink));
      c.add(s.add.image(x + CARD_W - 9, y + 2, suit.key).setOrigin(0, 0));
      if (court) c.add(s.add.image(x + CARD_W / 2, y + 12, court.key).setOrigin(0.5, 0));
      else c.add(s.add.image(x + CARD_W / 2, y + 20, suit.key).setScale(2));
    });
  };

  if (phase !== 'bet') {
    drawHand(dealer, DEALER_ROW, !standing && phase !== 'over');
    drawHand(player, PLAYER_ROW, false);
    c.add(text(sceneRef, 12, 48, standing || phase === 'over' ? `${score(dealer)}` : '?', PALETTE.ash));
    c.add(text(sceneRef, 34, 92, `${mine()}`, PALETTE.gold));
    // How many of the five are spent.  The cap only matters if you can see it
    // coming, and a player on four cards is making a different decision from
    // one on two.
    if (phase === 'play' && !standing) {
      const left = MAX_CARDS - player.length;
      // Right-aligned to the table's edge: "FIFTH CARD WINS" is fifteen
      // letters, and started where "4/5 CARDS" does it ran off the frame.
      c.add(
        text(sceneRef, GAME_W - 8, 92, `${player.length}/${MAX_CARDS} CARDS`, left <= 1 ? PALETTE.blood : PALETTE.ash)
          .setOrigin(1, 0),
      );
      if (left === 1) c.add(text(sceneRef, GAME_W - 8, 102, 'FIFTH WINS - NOT ON 21', PALETTE.gold).setOrigin(1, 0));
    }
  }

  // ---- the two conditional buttons, decided from the hand and nothing else.
  const open = phase === 'play' && !standing;
  aceBtn?.setVisible(open && aceIsOpen(player));
  const aceLabel = aceBtn?.getAt(1) as Phaser.GameObjects.BitmapText | undefined;
  aceLabel?.setText(`ACE ${aceAs}`);
  quitHandBtn?.setVisible(open && canSurrender());

  drawStake(c);
}

/** The chips on the betting spot, and what is left in your pocket. */
function drawStake(c: Phaser.GameObjects.Container): void {
  if (!sceneRef || !apiRef) return;
  const s = sceneRef;
  const pocket = phase === 'bet' ? maxBet() - bet : apiRef.balance();

  // One disc per token up to eight, then it is just a number — a hundred-token
  // stack would be a green wall.
  const discs = Math.min(8, bet);
  for (let i = 0; i < discs; i++) {
    const col = i % 3 === 0 ? PALETTE.neon : i % 3 === 1 ? PALETTE.cream : PALETTE.gold;
    c.add(s.add.ellipse(46, 132 - i * 3, 14, 6, col));
    c.add(s.add.ellipse(46, 132 - i * 3, 14, 6, 0x000000, 0).setStrokeStyle(1, PALETTE.ink));
  }

  c.add(text(s, 12, 150, `BET ${bet}`, PALETTE.gold));
  c.add(text(s, 12, 160, `POCKET ${pocket}`, pocket > 0 ? PALETTE.fog : PALETTE.ash));
  if (phase === 'over') c.add(text(s, GAME_W - 74, 150, `HAND ${hands}`, PALETTE.ash));
  else {
    // What an ordinary win hands back; the premium hands say theirs when they land.
    c.add(text(s, GAME_W - 74, 150, `PAYS ${bet * 2}`, PALETTE.tealLight));
  }
  // The stake, big, only while it is still yours to change.
  betText?.setText(phase === 'bet' ? `${bet}` : '').setVisible(phase === 'bet');
}

function finish(won: boolean, why: string, push = false): void {
  if (phase === 'over') return;
  phase = 'over';
  outcome = why;
  setStatus(why);
  hitBtn?.setVisible(false);
  standBtn?.setVisible(false);
  aceBtn?.setVisible(false);
  quitHandBtn?.setVisible(false);
  audio.sfx(won ? 'chime' : push ? 'ui_blip' : 'buzzer');

  // The hand settles here and now, so the winnings are in your pocket before
  // you decide whether to put them back on the felt.  A push gives the stake
  // back at 1x — the bet was debited on the deal, so this is what "nothing
  // changes hands" costs to say through the ledger.
  //
  // AND `stakeMul` IS APPLIED HERE AND NOWHERE ELSE, to the profit or the
  // loss.  A win hands back the stake plus stakeMul times it.  A multiplied
  // LOSS has to take more stakes off the player, because only one was ever
  // debited -- so the extra is raised now, and if the pocket cannot cover it
  // Froggy takes what is there rather than pushing the balance below nothing.
  if (won) {
    apiRef?.payout(bet + bet * stakeMul);
  } else if (push) {
    apiRef?.payout(bet);
  } else if (stakeMul > 1) {
    const owed = bet * (stakeMul - 1);
    const has = apiRef?.balance() ?? 0;
    const taken = Math.min(owed, has);
    if (taken > 0) apiRef?.raise(taken);
    if (taken < owed) setStatus(`${why} - HE TAKES WHAT YOU HAVE`);
  }
  render();

  sceneRef?.time.delayedCall(1100, () => offerAnother());
}

/**
 * The table's whole point: he will deal again.  Only the minimum stands in the
 * way, and when even that is gone the sitting is over whatever you want.
 */
function offerAnother(): void {
  if (phase !== 'over' || !apiRef || !sceneRef) return;
  const canPlay = apiRef.balance() >= MINIMUM;
  againBtn?.setVisible(canPlay);
  leaveBtn?.setVisible(true);
  leaveBtn?.setPosition(canPlay ? GAME_W / 2 + 46 : GAME_W / 2, 164);
  // Beside the result, not under it — the felt between the cards and the
  // buttons is the only clear line on the table, and the cards own the rest.
  say(`${outcome} - ${canPlay ? 'ANOTHER HAND?' : 'THAT WAS THE LAST OF IT'}`);
  render();
}

/**
 * Another hand.  Nothing is debited here — the bet is taken on the deal, the
 * same as the first hand was — so all this has to do is check the player can
 * still cover the minimum and hand him the betting controls back.
 */
function nextHand(): void {
  if (phase !== 'over' || !apiRef || !sceneRef) return;
  if (apiRef.balance() < MINIMUM) {
    audio.sfx('buzzer');
    say(`${outcome} - THAT WAS THE LAST OF IT`);
    againBtn?.setVisible(false);
    return;
  }

  ante = 0;
  bet = MINIMUM;
  outcome = '';
  standing = false;
  // A fresh hand is a fresh ace and a fresh stake: nothing about the last one
  // may follow the player into this one.
  aceAs = 11;
  stakeMul = 1;
  phase = 'bet';
  player = [];
  dealer = [];
  // A single deck runs out inside a long sitting; he shuffles when it gets thin.
  if (deck.length < 15) shuffle();

  againBtn?.setVisible(false);
  leaveBtn?.setVisible(false);
  setStatus('PLACE YOUR BET');
  buildBetUi(sceneRef);
  audio.sfx('ui_blip');
  render();
}

/** Stand up.  Everything was paid hand by hand; the shell reports the sitting. */
function leave(): void {
  if (!apiRef || phase === 'play') return;
  apiRef.cashOut();
}

/** Space and Enter mean the obvious thing for whatever is in front of you. */
function onConfirm(): void {
  if (phase === 'bet') deal();
  else if (phase === 'play') stand();
  else if (apiRef && apiRef.balance() >= MINIMUM) nextHand();
  else leave();
}

/**
 * The top card of the shoe, removed from it.  Both hands draw through here and
 * nowhere else, which is what makes "the same deck" a fact about the code
 * rather than a claim in a comment.
 */
function take(): Card {
  if (deck.length === 0) shuffle();
  const card = deck.pop()!;
  drawn.push(card);
  return card;
}

/** A fresh 52, genuinely shuffled (Fisher-Yates), in a random order. */
function shuffle(): void {
  deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
  Phaser.Utils.Array.Shuffle(deck);
  shoeId++;
  drawn = [];
}
