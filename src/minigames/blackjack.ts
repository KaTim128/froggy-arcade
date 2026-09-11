/**
 * BLACKJACK.  Froggy's table, not a cabinet.
 *
 * You sit down for one token — the table minimum, which the room already took
 * on the way in — and then bet as much of your pocket on the hand as you like
 * before he deals.  A win pays the whole stake back at 2x.
 *
 * It is a table, so it deals as long as you want it to: every hand settles on
 * the spot and, while you can still cover the minimum, you can push another
 * ante out and go again.  Standing up is the only thing that ends the session,
 * and the shell reports how the whole sitting went.  Every token in and out
 * still moves through the shell, so the ledger stays the only path.
 *
 * Single deck, dealer stands on 17, blackjack pays as a win, and a push is a
 * push: the same total on both sides hands your stake straight back, so a
 * tied hand costs nothing and pays nothing.  Aces are the only fiddly part:
 * they count eleven until that would bust you, then one, and a hand can hold
 * several of them.
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
let player: Card[] = [];
let dealer: Card[] = [];
let phase: Phase = 'bet';
let standing = false;
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
let againBtn: Phaser.GameObjects.Container | null = null;
let leaveBtn: Phaser.GameObjects.Container | null = null;

/** Aces are eleven until that busts, then one.  Works for any number of them. */
function score(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.rank === 'A') {
      aces++;
      total += 11;
    } else if (['J', 'Q', 'K'].includes(c.rank)) {
      total += 10;
    } else {
      total += Number(c.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

/** The table minimum.  Froggy will not deal under it. */
const MINIMUM = 1;

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
  payoutNote: 'PAYS 2X BET',

  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    phase = 'bet';
    standing = false;
    clock = 0;
    talking = 1.2;
    hands = 0;
    outcome = '';
    player = [];
    dealer = [];
    // The minimum is already on the felt — the room debited it to let you sit
    // down — so the first hand's ante is paid and the bet starts there.
    ante = Math.max(MINIMUM, api.staked());
    bet = ante;

    shuffle();

    paintFelt(scene);

    status = centerText(scene, GAME_W / 2, 142, 'PLACE YOUR BET', PALETTE.cream);
    betText = centerText(scene, GAME_W / 2, 116, '', PALETTE.gold, 16);
    hitBtn = button(scene, GAME_W / 2 - 40, 164, 'HIT', () => hit(), { width: 56, height: 13 });
    standBtn = button(scene, GAME_W / 2 + 40, 164, 'STAND', () => stand(), { width: 56, height: 13 });
    againBtn = button(scene, GAME_W / 2 - 46, 164, 'ANOTHER HAND', () => nextHand(), {
      width: 76,
      height: 13,
      fill: PALETTE.tealDark,
    });
    leaveBtn = button(scene, GAME_W / 2 + 46, 164, 'CASH OUT', () => leave(), { width: 76, height: 13 });
    for (const b of [hitBtn, standBtn, againBtn, leaveBtn]) b.setVisible(false);

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
  },

  update(_time: number, delta: number) {
    if (!sceneRef) return;
    clock += delta / 1000;
    talking = Math.max(0, talking - delta / 1000);
    froggyLayer.paint((ctx) => {
      drawFroggy(ctx, {
        x: DEALER.x,
        y: DEALER.y,
        height: DEALER.height,
        variant: 'cozy',
        pose: talking > 0 ? 'talk' : 'idleA',
        bounce: (clock * 0.5) % 1,
      });
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
    againBtn = null;
    leaveBtn = null;
    sceneRef = null;
    apiRef = null;
  },
};

/** The table itself: wood, felt, and the arc Froggy deals across. */
function paintFelt(scene: Phaser.Scene): void {
  scene.add.rectangle(0, 18, GAME_W, 162, PALETTE.brown).setOrigin(0, 0);
  scene.add.ellipse(GAME_W / 2, 34, 300, 40, 0x12401f);
  scene.add.rectangle(0, 34, GAME_W, 146, 0x12401f).setOrigin(0, 0);
  // felt seam, so it reads as a table rather than a green rectangle
  scene.add.ellipse(GAME_W / 2, 112, 280, 116, 0x16522a).setAlpha(0.5);
  // the dealer's arc, and the betting spot the chips sit on
  scene.add.ellipse(GAME_W / 2, 74, 220, 46, 0x000000, 0).setStrokeStyle(1, 0x1d5c2d);
  scene.add.ellipse(46, 130, 34, 16, 0x000000, 0).setStrokeStyle(1, 0x1d5c2d);
  text(scene, 12, 38, 'FROGGY DEALS', PALETTE.ash).setAlpha(0.7);
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
  c.add(centerText(scene, GAME_W / 2, 130, 'MINIMUM 1 - THE REST IS UP TO YOU', PALETTE.ash));
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
  // This hand's ante is already staked; nothing below it can come back off.
  const next = Math.max(ante, bet - n);
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

  // Everything above the ante goes down now, through the shell.
  const extra = bet - ante;
  if (extra > 0 && !apiRef.raise(extra)) {
    audio.sfx('buzzer');
    bet = ante;
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

  player = [deck.pop()!, deck.pop()!];
  dealer = [deck.pop()!, deck.pop()!];
  say('HIT OR STAND');
  render();

  // A natural twenty-one is decided before you touch anything.
  if (score(player) === 21) sceneRef.time.delayedCall(700, () => stand());
}

// ---------------------------------------------------------------------- play

function hit(): void {
  if (phase !== 'play' || standing || !sceneRef) return;
  player.push(deck.pop()!);
  audio.sfx('ui_blip');
  render();
  if (score(player) > 21) finish(false, 'BUST');
}

function stand(): void {
  if (phase !== 'play' || standing || !sceneRef) return;
  standing = true;
  say('DEALER STANDS ON 17');
  render();

  // Dealer draws to 17, one card at a time so you can watch it happen.
  const step = () => {
    if (phase === 'over') return;
    if (score(dealer) < 17) {
      dealer.push(deck.pop()!);
      audio.sfx('ui_hover');
      render();
      sceneRef?.time.delayedCall(600, step);
      return;
    }
    const p = score(player);
    const d = score(dealer);
    if (d > 21) finish(true, 'DEALER BUSTS');
    else if (p > d) finish(true, `${p} BEATS ${d}`);
    else if (p === d) finish(false, `PUSH ON ${p} - BET RETURNED`, true);
    else finish(false, `${d} BEATS ${p}`);
  };
  sceneRef.time.delayedCall(600, step);
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
    c.add(text(sceneRef, 34, 92, `${score(player)}`, PALETTE.gold));
  }

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
  else c.add(text(s, GAME_W - 74, 150, `PAYS ${bet * 2}`, PALETTE.tealLight));
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
  audio.sfx(won ? 'chime' : push ? 'ui_blip' : 'buzzer');

  // The hand settles here and now, so the winnings are in your pocket before
  // you decide whether to put them back on the felt.  A push gives the stake
  // back at 1x — the bet was debited on the deal, so this is what "nothing
  // changes hands" costs to say through the ledger.
  if (won) apiRef?.payout(bet * 2);
  else if (push) apiRef?.payout(bet);
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

/** Ante up and deal again.  The ante is a fresh debit, like sitting down was. */
function nextHand(): void {
  if (phase !== 'over' || !apiRef || !sceneRef) return;
  if (!apiRef.raise(MINIMUM)) {
    audio.sfx('buzzer');
    say(`${outcome} - THAT WAS THE LAST OF IT`);
    againBtn?.setVisible(false);
    return;
  }

  ante = MINIMUM;
  bet = MINIMUM;
  outcome = '';
  standing = false;
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

function shuffle(): void {
  deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
  Phaser.Utils.Array.Shuffle(deck);
}
