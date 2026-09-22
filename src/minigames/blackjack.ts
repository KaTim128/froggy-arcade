/**
 * BLACKJACK.  Froggy's table, not a cabinet.
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
 *   FIVE CARDS DOUBLES THE STAKE, whichever way it lands: survive to five and
 *   win, and it pays double; bust on the fifth, and it costs double.  It is
 *   the only hand in the building that can cost more than what was put up.
 *
 *   SO DOES A TWENTY-ONE, and his counts too -- his twenty-one takes double
 *   off you and yours takes double off him.  The two do not stack.
 *
 *   FIFTEEN ON TWO CARDS IS THE ONE YOU MAY WALK AWAY FROM.  Too high to hit,
 *   too low to stand: leave it and the stake comes back untouched.
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
import type { MinigameApi, MinigameModule } from './types';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** Where Froggy stands, and the two rows of felt in front of him. */
const DEALER = { x: GAME_W / 2, y: 58, height: 38 };
const DEALER_ROW = 62;
const PLAYER_ROW = 104;

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
/** Set the frame a hand is settled by a five card finish or a 21, for the doubling. */
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
 * Not the usual "eleven until that busts".  Froggy's rule is about how many
 * cards you are holding:
 *
 *   TWO CARDS   it is yours to decide, one or eleven, and you can change your
 *               mind for as long as you are still on two.  That is the whole
 *               of the decision the two-card hand offers.
 *   THREE OR MORE   it hardens to ONE, immediately, whatever you had chosen.
 *               Taking a card takes the choice away with it, which is what
 *               makes hitting on a soft hand a real commitment here.
 *
 * `pick` is the player's current answer while they are still on two cards; it
 * is ignored from the third card on, and the dealer never has one -- he is
 * scored the ordinary way at two cards (eleven unless it busts him) and by
 * the same hardening rule from three.
 */
function score(hand: Card[], pick?: AceAs): number {
  const aces = hand.filter((c) => c.rank === 'A').length;
  let total = 0;
  for (const c of hand) {
    if (c.rank === 'A') total += 1;
    else if (['J', 'Q', 'K'].includes(c.rank)) total += 10;
    else total += Number(c.rank);
  }
  if (!aces) return total;
  // From the third card an ace is one and there is nothing to add.
  if (hand.length >= 3) return total;
  // On two: the player's own answer, or -- for the dealer -- the best one.
  if (pick !== undefined) return pick === 11 ? total + 10 : total;
  return total + 10 <= 21 ? total + 10 : total;
}

/** The player's answer to their own ace, while they are still on two cards. */
type AceAs = 1 | 11;

/** Does this hand still offer the choice?  Two cards, and one of them an ace. */
function aceIsOpen(hand: Card[]): boolean {
  return hand.length === 2 && hand.some((c) => c.rank === 'A');
}

/** The player's hand as it stands, with their ace answer applied. */
function mine(): number {
  return score(player, aceIsOpen(player) ? aceAs : undefined);
}

/** The table minimum.  Froggy will not deal under it. */
const MINIMUM = 1;

/**
 * FROGGY'S HOUSE RULES, all four of them, and all four cut both ways.
 *
 * MAX_CARDS: five, and there is no sixth.  A hand that reaches five is
 * settled on what it has -- you cannot grind a soft total up one card at a
 * time for ever.
 *
 * FIVE_CARD_MUL: and getting there is a wager of its own.  Bust on the fifth
 * and it costs DOUBLE the stake; survive it and win and it pays double.  That
 * is the only place in the building where a loss can cost more than what was
 * put up, and it is the only place a hand can pay four times it.
 *
 * TWENTYONE_MUL: a hand won on exactly twenty-one doubles the stake as well,
 * whoever is holding it -- his twenty-one takes double off you, yours takes
 * double off him.
 *
 * SURRENDER_ON: fifteen on two cards is the worst place to be at this table,
 * so it is the one hand you are allowed to walk away from with your stake
 * intact.  Two cards only: take a third and you have chosen.
 *
 * They do not stack.  A five card twenty-one is doubled once, not four times
 * -- the larger of the two applies, so a rule that was written to be a risk
 * cannot quietly become a quadruple.
 */
const MAX_CARDS = 5;
const FIVE_CARD_MUL = 2;
const TWENTYONE_MUL = 2;
const SURRENDER_ON = 15;

/** The most this hand could ride: what is already down, plus what is left. */
function maxBet(): number {
  const api = apiRef;
  if (!api) return 1;
  return ante + api.balance();
}

export const blackjack: MinigameModule = {
  id: 'blackjack',
  title: 'BLACKJACK',
  music: 'game_blackjack',
  rules: 'bet what you like, beat the dealer to 21',
  tutorial: {
    objective: [
      'BEAT THE DEALER TO 21. FIVE CARDS MAX.',
      'TWO CARDS: AN ACE IS 1 OR 11, YOUR CALL.',
      'A THIRD CARD MAKES EVERY ACE A 1.',
      'FIVE CARDS OR A 21 DOUBLES THE STAKE.',
      'STUCK ON 15 FROM TWO? LEAVE IT FOR FREE.',
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
  payoutNote: 'PAYS 2X - OR 4X',

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

    paintFelt(scene);

    status = centerText(scene, GAME_W / 2, 142, 'PLACE YOUR BET', PALETTE.cream);
    betText = centerText(scene, GAME_W / 2, 116, '', PALETTE.gold, 16);
    hitBtn = button(scene, GAME_W / 2 - 40, 164, 'HIT', () => hit(), { width: 56, height: 13 });
    standBtn = button(scene, GAME_W / 2 + 40, 164, 'STAND', () => stand(), { width: 56, height: 13 });
    // ---- the two that are only sometimes yours.  They sit on their own row
    // above HIT and STAND, and each appears only while the hand it belongs to
    // is on the felt: the ace one while you are on two cards with an ace, the
    // fifteen one while you are on two cards worth exactly fifteen.
    aceBtn = button(scene, GAME_W / 2 - 40, 148, 'ACE 11', () => flipAce(), {
      width: 56,
      height: 13,
      fill: PALETTE.tealDark,
    });
    quitHandBtn = button(scene, GAME_W / 2 + 40, 148, 'LEAVE IT', () => surrender(), {
      width: 56,
      height: 13,
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
          canSurrender: canSurrender(),
          maxCards: MAX_CARDS,
          stakeMul,
          // What the hand would be multiplied by if it landed as it stands.
          mulNow: phase === 'play' ? mulFor(mine(), player.length) : 1,
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
          render();
        },
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
  c.add(centerText(scene, GAME_W / 2, 130, 'THE SEAT IS FREE - MINIMUM BET 1', PALETTE.ash));
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
  status?.setText('PLACE YOUR BET'); // clears whatever he last told you off for
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
  status?.setText('PLACE YOUR BET');
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
  hitBtn?.setVisible(true);
  standBtn?.setVisible(true);
  audio.sfx('coin_drop');

  player = [take(), take()];
  dealer = [take(), take()];
  say('HIT OR STAND');
  render();

  // A natural twenty-one is decided before you touch anything -- unless the
  // ace is what made it, in which case it is the player's call and theirs to
  // change, so the table waits.
  if (mine() === 21 && !aceIsOpen(player)) sceneRef.time.delayedCall(700, () => stand());
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
  audio.sfx('ui_blip');
  render();
  const p = mine();
  if (p > 21) {
    // On the fifth card this costs double.  See FIVE_CARD_MUL.
    if (player.length >= MAX_CARDS) {
      stakeMul = FIVE_CARD_MUL;
      finish(false, `BUST ON FIVE - DOUBLE`);
    } else {
      finish(false, 'BUST');
    }
    return;
  }
  // Survived to five: there is nothing left to decide, so he plays his hand.
  if (player.length >= MAX_CARDS) {
    say(`FIVE CARDS ON ${p} - HE HAS TO BEAT IT`);
    sceneRef.time.delayedCall(700, () => stand());
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
  if (phase !== 'play' || standing || !aceIsOpen(player)) return;
  aceAs = aceAs === 11 ? 1 : 11;
  audio.sfx('ui_hover', 0.5);
  say(`ACE PLAYS AS ${aceAs} - YOU HAVE ${mine()}`);
  render();
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
    if (score(dealer) < 17) {
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

/**
 * WHAT THE STAKE IS MULTIPLIED BY, and it is decided in exactly two places.
 *
 * A hand pays or costs double for one of two reasons -- it went to five cards,
 * or it was won on exactly twenty-one -- and `stakeMul` carries whichever
 * applies into `finish`, which is the only thing that moves tokens.  They do
 * NOT stack: a five card twenty-one is the larger of the two, once.
 */
function mulFor(total: number, cards: number): number {
  const five = cards >= MAX_CARDS ? FIVE_CARD_MUL : 1;
  const blackjack = total === 21 ? TWENTYONE_MUL : 1;
  return Math.max(five, blackjack);
}

/** The player took it.  Five cards or a twenty-one pays double. */
function settleWon(p: number, why: string): void {
  stakeMul = mulFor(p, player.length);
  finish(true, stakeMul > 1 ? `${why} - PAYS DOUBLE` : why);
}

/** He took it.  His twenty-one, or your five cards, costs you double. */
function settleLost(d: number, why: string): void {
  stakeMul = mulFor(d, player.length);
  finish(false, stakeMul > 1 ? `${why} - COSTS DOUBLE` : why);
}

/** Froggy says it, and his mouth moves while he does. */
function say(msg: string): void {
  status?.setText(msg);
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
      const face = hideSecond && i === 1;
      c.add(sceneRef!.add.rectangle(x, y, 22, 30, face ? 0x2a3550 : PALETTE.cream).setOrigin(0, 0));
      c.add(sceneRef!.add.rectangle(x, y, 22, 30, 0x000000, 0).setOrigin(0, 0).setStrokeStyle(1, 0x0d2916));
      if (face) {
        c.add(sceneRef!.add.rectangle(x + 5, y + 7, 12, 16, 0x3d4a6b).setOrigin(0, 0));
        return;
      }
      const red = card.suit === '♥' || card.suit === '♦';
      c.add(text(sceneRef!, x + 3, y + 3, card.rank, red ? PALETTE.blood : PALETTE.ink));
      c.add(text(sceneRef!, x + 3, y + 18, card.suit, red ? PALETTE.blood : PALETTE.ink));
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
      c.add(
        text(sceneRef, GAME_W - 74, 92, `${player.length}/${MAX_CARDS} CARDS`, left <= 1 ? PALETTE.blood : PALETTE.ash),
      );
      if (left === 1) c.add(text(sceneRef, GAME_W - 74, 102, 'FIFTH DOUBLES', PALETTE.blood));
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
    // What it pays if it lands as it stands: the doubling is worth knowing
    // BEFORE the decision that triggers it, not after.
    const mul = phase === 'play' ? mulFor(mine(), player.length) : 1;
    c.add(text(s, GAME_W - 74, 150, `PAYS ${bet * 2 * mul}`, mul > 1 ? PALETTE.gold : PALETTE.tealLight));
  }
  // The stake, big, only while it is still yours to change.
  betText?.setText(phase === 'bet' ? `${bet}` : '').setVisible(phase === 'bet');
}

function finish(won: boolean, why: string, push = false): void {
  if (phase === 'over') return;
  phase = 'over';
  outcome = why;
  status?.setText(why);
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
  // AND `stakeMul` IS APPLIED HERE AND NOWHERE ELSE.  A doubled WIN is simply
  // paid twice as much.  A doubled LOSS has to take a second stake off the
  // player, because only one was ever debited -- so the extra is raised now,
  // and if the pocket cannot cover it Froggy takes what is there rather than
  // pushing the balance below nothing.
  if (won) {
    apiRef?.payout(bet * 2 * stakeMul);
  } else if (push) {
    apiRef?.payout(bet);
  } else if (stakeMul > 1) {
    const owed = bet * (stakeMul - 1);
    const has = apiRef?.balance() ?? 0;
    const taken = Math.min(owed, has);
    if (taken > 0) apiRef?.raise(taken);
    if (taken < owed) status?.setText(`${why} - HE TAKES WHAT YOU HAVE`);
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
  status?.setText('PLACE YOUR BET');
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
