/**
 * BLACKJACK.  Medium — 3 tokens in, 6 out.
 *
 * Single deck, dealer stands on 17, blackjack pays as a win.  Aces are the only
 * fiddly part: they count eleven until that would bust you, then one, and a
 * hand can hold several of them.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

interface Card {
  rank: string;
  suit: string;
}

let deck: Card[] = [];
let player: Card[] = [];
let dealer: Card[] = [];
let over = false;
let standing = false;
let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let table: Phaser.GameObjects.Container | null = null;
let status: Phaser.GameObjects.BitmapText | null = null;
let hitBtn: Phaser.GameObjects.Container | null = null;
let standBtn: Phaser.GameObjects.Container | null = null;

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

export const blackjack: MinigameModule = {
  id: 'blackjack',
  title: 'BLACKJACK',
  rules: 'beat the dealer to 21',

  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    over = false;
    standing = false;

    deck = [];
    for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s });
    Phaser.Utils.Array.Shuffle(deck);

    player = [deck.pop()!, deck.pop()!];
    dealer = [deck.pop()!, deck.pop()!];

    scene.add.rectangle(0, 18, GAME_W, 162, 0x12401f).setOrigin(0, 0);
    scene.add.rectangle(0, 18, GAME_W, 2, 0x1d5c2d).setOrigin(0, 0);
    // felt seam, so it reads as a table rather than a green rectangle
    scene.add.ellipse(GAME_W / 2, 108, 280, 120, 0x16522a).setAlpha(0.5);

    text(scene, 12, 30, 'DEALER', PALETTE.ash);
    text(scene, 12, 92, 'YOU', PALETTE.cream);

    status = centerText(scene, GAME_W / 2, 150, '', PALETTE.cream);
    hitBtn = button(scene, GAME_W / 2 - 40, 166, 'HIT', () => hit(), { width: 56, height: 13 });
    standBtn = button(scene, GAME_W / 2 + 40, 166, 'STAND', () => stand(), { width: 56, height: 13 });

    scene.input.keyboard?.on('keydown-H', () => hit());
    scene.input.keyboard?.on('keydown-SPACE', () => stand());

    render();

    // A natural twenty-one is decided before you touch anything.
    if (score(player) === 21) scene.time.delayedCall(700, () => stand());
  },

  destroy() {
    table?.destroy();
    table = null;
    status = null;
    hitBtn = null;
    standBtn = null;
    sceneRef = null;
    apiRef = null;
  },
};

function hit(): void {
  if (over || standing || !sceneRef) return;
  player.push(deck.pop()!);
  audio.sfx('ui_blip');
  render();
  if (score(player) > 21) finish(false, 'BUST');
}

function stand(): void {
  if (over || standing || !sceneRef) return;
  standing = true;
  render();

  // Dealer draws to 17, one card at a time so you can watch it happen.
  const step = () => {
    if (over) return;
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
    else if (p === d) finish(false, `PUSH ON ${p} - HOUSE WINS`);
    else finish(false, `${d} BEATS ${p}`);
  };
  sceneRef.time.delayedCall(600, step);
}

function render(): void {
  if (!sceneRef) return;
  table?.destroy();
  const c = sceneRef.add.container(0, 0);
  table = c;

  const drawHand = (hand: Card[], y: number, hideSecond: boolean) => {
    hand.forEach((card, i) => {
      const x = 16 + i * 26;
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

  drawHand(dealer, 40, !standing && !over);
  drawHand(player, 102, false);

  c.add(text(sceneRef, 70, 30, standing || over ? `${score(dealer)}` : '?', PALETTE.ash));
  c.add(text(sceneRef, 46, 92, `${score(player)}`, PALETTE.gold));
}

function finish(won: boolean, why: string): void {
  if (over) return;
  over = true;
  status?.setText(why);
  hitBtn?.setVisible(false);
  standBtn?.setVisible(false);
  audio.sfx(won ? 'chime' : 'buzzer');
  sceneRef?.time.delayedCall(1400, () => (won ? apiRef?.win() : apiRef?.lose()));
}
