/**
 * ---- FROGGOPOLY, AT THE TABLE IN THE FOURTH ROOM.
 *
 * Before the night it is Froggy across the table, round and green and very
 * pleased to see you, and your piece is a little Froggy.  After the night it
 * is a skinny boy in big round glasses who has been sitting there all along,
 * and your piece is a dead frog.  The rules are in `game/froggopoly.ts`; this
 * is the table: the stake, the board, the dice, the turns and the result.
 *
 *   THE STAKE.  10, 30 or 100 tokens, with your balance on screen and a
 *   confirmation before anything is taken.  The tokens are taken when the game
 *   starts and at no other time.  Win and you get the stake back twice over;
 *   lose and it is gone; a draw hands it back.  It is settled once, on the
 *   result screen.  Leaving mid-game asks first, and counts as a loss.
 *
 *   THE MONEY ON THE BOARD is lily dollars (L$), the game's own, and none of
 *   it ever leaves the table.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { ledger } from '../core/ledger';
import { store } from '../core/state';
import { button, centerText, confirmDialog, fadeIn, fadeToScene, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import {
  BOARD,
  MAX_LEVEL,
  ROUNDS,
  SWAMP_FINE,
  aiBuild,
  aiRaise,
  aiWantsToBuy,
  bankrupt,
  baseRent,
  canRaise,
  canUpgrade,
  drawRipple,
  endTurn,
  moveBy,
  newGame,
  other,
  padsOf,
  rentOf,
  rollDice,
  sell,
  sellable,
  toSwamp,
  upgrade,
  wealth,
  type Game,
  type Who,
} from '../game/froggopoly';
import { INK, drawDiorama, drawIcon, drawPiece, outlined, paintCell, shade, shadowed, type DioramaKind, type IconKind, type PieceLook } from '../art/froggopolyArt';

export const STAKES = [10, 30, 100];

const CELL = 24;
const BX = 4;
const BY = 6;
const PANEL_X = 178;

/** Where space `i` sits on the 7x7 ring: bottom row right to left, up the left, along the top, down the right. */
export function cellOf(i: number): { cx: number; cy: number } {
  let col: number;
  let row: number;
  if (i <= 6) {
    col = 6 - i;
    row = 6;
  } else if (i <= 12) {
    col = 0;
    row = 6 - (i - 6);
  } else if (i <= 18) {
    col = i - 12;
    row = 0;
  } else {
    col = 6;
    row = i - 18;
  }
  return { cx: BX + col * CELL + CELL / 2, cy: BY + row * CELL + CELL / 2 };
}

type Phase = 'stake' | 'play' | 'result';
type Step = 'idle' | 'busy' | 'roll' | 'swamp' | 'buy' | 'act' | 'build' | 'debt';

export class Froggopoly extends Phaser.Scene {
  private phase: Phase = 'stake';
  private step: Step = 'idle';
  private g: Game = newGame();
  private stake = 0;
  private settled = false;
  private alive = true;
  private after = false;
  private opp = 'FROGGY';
  private dice: [number, number] = [1, 1];
  private status = '';
  private focus = 0;
  private owed: { amt: number; to: Who | null; then: () => void } | null = null;
  private boardLayer!: Phaser.GameObjects.Container;
  private panel!: Phaser.GameObjects.Container;
  private diceLayer!: Phaser.GameObjects.Container;
  private stakeLayer: Phaser.GameObjects.Container | null = null;
  /** The two pieces, each with the shadow it leaves on the board. */
  private pieces: Array<{ body: Phaser.GameObjects.Container; shadow: Phaser.GameObjects.Ellipse; at: number; hopping: boolean }> = [];
  private turnGlow!: Phaser.GameObjects.Rectangle;
  private card: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Froggopoly');
  }

  create(): void {
    fadeIn(this);
    audio.setScene({ music: 'game_froggopoly' });
    this.alive = true;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (this.alive = false));
    this.after = store.get().froggyGone;
    this.opp = this.after ? 'THE BOY' : 'FROGGY';
    this.phase = 'stake';
    this.step = 'idle';
    this.settled = false;
    this.stake = 0;
    this.g = newGame();
    this.focus = 0;
    this.status = '';
    this.owed = null;

    this.paintTable();
    this.paintBoard();
    this.boardLayer = this.add.container(0, 0).setDepth(5);
    this.diceLayer = this.add.container(0, 0).setDepth(20);
    this.panel = this.add.container(0, 0).setDepth(30);
    this.turnGlow = this.add.rectangle(0, 0, 10, 10, PALETTE.gold, 0.12).setStrokeStyle(1, PALETTE.gold).setDepth(31).setVisible(false);
    this.tweens.add({ targets: this.turnGlow, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
    this.card = null;
    this.makePieces();
    this.drawBoard();
    this.drawDice(false);
    this.showStake();

    this.input.keyboard?.on('keydown-ESC', () => this.askQuit());
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.step === 'roll' || this.step === 'swamp') this.playerRoll();
    });

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__froggopoly = {
        state: () => ({ phase: this.phase, step: this.step, stake: this.stake, settled: this.settled, g: JSON.parse(JSON.stringify(this.g)) }),
        start: (stake: number) => this.begin(stake),
        roll: () => this.playerRoll(),
        buy: () => this.step === 'buy' && this.buy(),
        pass: () => this.step === 'buy' && this.declineBuy(),
        end: () => this.step === 'act' && this.endPlayerTurn(),
        finish: () => {
          this.g.round = ROUNDS + 1;
          this.g.over = true;
          this.g.winner = wealth(this.g, 0) === wealth(this.g, 1) ? 'draw' : wealth(this.g, 0) > wealth(this.g, 1) ? 0 : 1;
          this.showResult();
        },
        quit: () => this.quitNow(),
      };
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => delete (window as unknown as Record<string, unknown>).__froggopoly);
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((res) => this.time.delayedCall(ms, () => res()));
  }

  // ------------------------------------------------------------- the stake

  private showStake(): void {
    const c = this.add.container(0, 0).setDepth(100);
    this.stakeLayer = c;
    c.add(this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.7).setOrigin(0, 0).setInteractive());
    c.add(this.add.rectangle(GAME_W / 2 + 3, GAME_H / 2 + 4, 256, 160, 0x000000, 0.5));
    c.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, 256, 160, PALETTE.ink).setStrokeStyle(1, PALETTE.gold));
    c.add(outlined(this, GAME_W / 2, 24, 'FROGGOPOLY', PALETTE.gold, { center: true, shadow: true }));
    const hello = this.after
      ? '"Oh. Hi. You can sit there. I have been waiting a long time."'
      : '"A game? Oh, I LOVE this game. I always win it!"';
    c.add(centerText(this, GAME_W / 2, 38, `${this.opp}:`, PALETTE.mossLight));
    c.add(text(this, GAME_W / 2, 45, hello, PALETTE.cream).setOrigin(0.5, 0).setMaxWidth(236).setCenterAlign());
    const bal = ledger.balance();
    c.add(centerText(this, GAME_W / 2, 74, `YOU HAVE ${bal} TOKENS`, PALETTE.ash));
    c.add(centerText(this, GAME_W / 2, 84, 'CHOOSE THE STAKE:', PALETTE.ash));
    STAKES.forEach((st, i) => {
      const can = bal >= st;
      c.add(
        this.fitButton(GAME_W / 2 - 78 + i * 78, 100, `${st} TOKENS`, () => (can ? this.confirmStake(st) : audio.sfx('buzzer')), 72, 15, can ? PALETTE.plum : PALETTE.ink),
      );
    });
    c.add(centerText(this, GAME_W / 2, 118, 'WIN: DOUBLE BACK    LOSE: IT IS GONE', PALETTE.ash));
    c.add(centerText(this, GAME_W / 2, 128, 'DRAW: YOUR STAKE BACK', PALETTE.ash));
    c.add(this.fitButton(GAME_W / 2, 150, 'LEAVE', () => this.leave(), 64, 14));
  }

  private confirmStake(st: number): void {
    confirmDialog(this, {
      lines: [`PLAY FOR ${st} TOKENS?`, `YOU HAVE ${ledger.balance()}.  WIN ${st * 2} BACK.`],
      confirm: 'PLAY',
      cancel: 'BACK',
      onConfirm: () => this.begin(st),
      onCancel: () => undefined,
      edge: PALETTE.gold,
    });
  }

  /** The tokens are taken here, and only here. */
  private begin(st: number): boolean {
    if (this.phase !== 'stake') return false;
    if (!ledger.debit(st, 'board')) {
      audio.sfx('buzzer');
      return false;
    }
    audio.sfx('coin_drop');
    this.stake = st;
    this.phase = 'play';
    this.stakeLayer?.destroy();
    this.stakeLayer = null;
    this.status = 'YOUR TURN.  ROLL THE DICE.';
    this.startTurn();
    return true;
  }

  // ------------------------------------------------------------- the board

  /** The wooden table the board lies on: planks, grain, and a soft shadow under the board. */
  private paintTable(): void {
    const g = this.add.graphics();
    g.fillStyle(0x2a1a10, 1).fillRect(0, 0, GAME_W, GAME_H);
    for (let y = 0; y < GAME_H; y += 12) {
      g.fillStyle(y % 24 ? 0x30200f : 0x281808, 1).fillRect(0, y, GAME_W, 12);
      g.fillStyle(0x1a1008, 1).fillRect(0, y, GAME_W, 1);
      for (let k = 0; k < 6; k++) g.fillStyle(0x3a2814, 1).fillRect(((y * 7 + k * 53) % GAME_W), y + 4 + (k % 3) * 2, 18, 1);
    }
    g.fillStyle(0x000000, 0.45).fillRect(BX + 3, BY + 4, CELL * 7, CELL * 7);
  }

  /**
   * The board, printed once: the felt in the middle with its logo, then each
   * space as a piece of card with its grain, bevel, colour bar, picture and
   * price.  What changes in play (owners, pads, the focus) is drawn over it by
   * `drawBoard`.
   */
  private paintBoard(): void {
    const g = this.add.graphics().setDepth(1);
    // the felt middle, with a fine diagonal weave and a gold line round it
    const mx = BX + CELL;
    const my = BY + CELL;
    const mw = CELL * 5;
    g.fillStyle(INK, 1).fillRect(BX - 1, BY - 1, CELL * 7 + 2, CELL * 7 + 2);
    g.fillStyle(0x2a6a3a, 1).fillRect(mx, my, mw, mw);
    for (let k = -mw; k < mw; k += 5) {
      g.lineStyle(1, 0x327a44, 0.6).lineBetween(Math.max(mx, mx + k), Math.max(my, my - k), Math.min(mx + mw, mx + mw + k), Math.min(my + mw, my + mw - k));
    }
    g.lineStyle(1, 0xc8a040, 1).strokeRect(mx + 3, my + 3, mw - 6, mw - 6);
    // a pond in the middle for the dice to land in
    g.fillStyle(0x1e5a7a, 0.55).fillEllipse(mx + mw / 2, my + mw / 2, 64, 34);
    g.lineStyle(1, 0x7ec8e8, 0.35).strokeEllipse(mx + mw / 2, my + mw / 2, 64, 34);
    for (const [lx, ly] of [[-26, -8], [24, 9], [-20, 11]]) {
      g.fillStyle(0x46a84e, 0.8).fillEllipse(mx + mw / 2 + lx, my + mw / 2 + ly, 9, 5);
    }
    const logo = outlined(this, mx + mw / 2, my + 15, 'FROGGOPOLY', PALETTE.gold, { center: true, shadow: true });
    logo.setDepth(2);
    BOARD.forEach((sp, i) => {
      const { cx, cy } = cellOf(i);
      const corner = sp.kind === 'go' || sp.kind === 'swamp' || sp.kind === 'free' || sp.kind === 'goswamp';
      const paper = corner ? 0xe8dcc0 : 0xf2ead8;
      paintCell(g, i, cx, cy, CELL, paper, sp.color);
      const icon: IconKind | null =
        sp.kind === 'util' ? (sp.name.startsWith('FIRE') ? 'pwr' : 'h2o')
          : sp.kind === 'tax' ? 'tax'
            : sp.kind === 'go' ? 'go'
              : sp.kind === 'swamp' ? 'swamp'
                : sp.kind === 'goswamp' ? 'goswamp'
                  : sp.kind === 'free' ? 'free'
                    : sp.kind === 'chance' ? 'chance'
                      : null;
      if (icon) drawIcon(g, icon, cx, cy + (sp.kind === 'util' || sp.kind === 'tax' ? -3 : sp.kind === 'go' ? 1 : 0), paper);
      if (sp.kind === 'chance') outlined(this, cx, cy - 1, '?', 0xa870e8, { center: true }).setDepth(2);
      if (sp.kind === 'go') outlined(this, cx, cy - 6, 'GO', PALETTE.cream, { center: true }).setDepth(2);
      // the price, outlined, along the foot of the card
      const price = sp.kind === 'prop' || sp.kind === 'util' ? sp.price : sp.kind === 'tax' ? sp.tax : undefined;
      // dark figures with a light 1px outline: crisp on the card and on a colour
      if (price !== undefined) outlined(this, cx, cy + 6, `${price}`, sp.kind === 'tax' ? 0xb82020 : INK, { center: true, outline: 0xfffaf0 }).setDepth(2);
      const hit = this.add.rectangle(cx, cy, CELL - 1, CELL - 1, 0xffffff, 0.001).setDepth(3);
      hit.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.cellClicked(i));
    });
  }

  /** What changes as you play: whose each space is, its pads, the focus and the build glow. */
  private drawBoard(): void {
    const L = this.boardLayer;
    L.removeAll(true);
    L.add(outlined(this, BX + CELL * 3.5, BY + CELL * 5.3, `ROUND ${Math.min(this.g.round, ROUNDS)}/${ROUNDS}`, PALETTE.cream, { center: true }));
    BOARD.forEach((_, i) => {
      const { cx, cy } = cellOf(i);
      const o = this.g.owner[i];
      if (o !== null) {
        const col = o === 0 ? 0x46c46e : this.oppColour();
        // an owner's ribbon along the foot of the card, and the pads in a row
        L.add(this.add.rectangle(cx, cy + CELL / 2 - 2.5, CELL - 3, 3, col).setStrokeStyle(0.5, INK));
        for (let k = 0; k < this.g.level[i]; k++) {
          L.add(this.add.circle(cx - 6 + k * 6, cy - 1, 2.2, 0x46a84e).setStrokeStyle(1, INK));
        }
      }
      if (i === this.focus) L.add(this.add.rectangle(cx, cy, CELL - 1, CELL - 1).setStrokeStyle(1.5, PALETTE.gold));
      if (this.step === 'build' && canUpgrade(this.g, i, 0)) L.add(this.add.rectangle(cx, cy, CELL - 1, CELL - 1, PALETTE.gold, 0.28));
    });
    this.placePieces();
  }

  private oppColour(): number {
    return this.after ? 0x3f6fd8 : 0x7b4bd8;
  }

  private pieceLook(who: Who): PieceLook {
    if (who === 0) return { kind: 'king', body: this.after ? 0x7a8a6a : 0x46c46e, dead: this.after };
    return this.after ? { kind: 'rook', body: 0x3f6fd8 } : { kind: 'knight', body: 0x7b4bd8 };
  }

  /** Your piece is the Frog King (a dead one, after the night); theirs is the Knight, or the boy's Rook. */
  private makePieces(): void {
    this.pieces = ([0, 1] as Who[]).map((who) => {
      const shadow = this.add.ellipse(0, 0, 11, 3.5, 0x000000, 0.4).setDepth(9);
      const body = this.add.container(0, 0).setDepth(10);
      const g = this.add.graphics();
      drawPiece(g, this.pieceLook(who));
      body.add(g);
      return { body, shadow, at: 0, hopping: false };
    });
    this.placePieces(true);
  }

  private spotFor(who: Who, i: number): { x: number; y: number } {
    const { cx, cy } = cellOf(i);
    return { x: cx + (who === 0 ? -5 : 5), y: cy + 9 };
  }

  /** Put each piece where it stands, hopping it there if it moved and nothing is animating it. */
  private placePieces(snap = false): void {
    ([0, 1] as Who[]).forEach((who) => {
      const pc = this.pieces[who];
      if (!pc || pc.hopping) return;
      const pos = this.g.players[who].pos;
      if (snap || pc.at === pos) {
        const p = this.spotFor(who, pos);
        pc.body.setPosition(p.x, p.y);
        pc.shadow.setPosition(p.x, p.y);
        pc.at = pos;
        return;
      }
      // a jump across the board (to the swamp, or a ripple's move)
      void this.hop(who, pos, 420, 16);
    });
  }

  /**
   * A parabolic hop from where the piece is to space `to`: up and over on an
   * arc, the shadow sliding along the board beneath and shrinking at the top,
   * then a little squash on landing.
   */
  private hop(who: Who, to: number, ms = 170, height = 7): Promise<void> {
    const pc = this.pieces[who];
    const from = { x: pc.body.x, y: pc.body.y };
    const end = this.spotFor(who, to);
    pc.hopping = true;
    pc.at = to;
    // a piece in flight goes over the other one
    pc.body.setDepth(12);
    return new Promise((res) => {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: ms,
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          const x = from.x + (end.x - from.x) * t;
          const y = from.y + (end.y - from.y) * t;
          const lift = 4 * height * t * (1 - t);
          pc.body.setPosition(x, y - lift);
          pc.shadow.setPosition(x, y).setScale(1 - (lift / height) * 0.35).setAlpha(0.4 - (lift / height) * 0.15);
          pc.body.setScale(1 - 0.06 * Math.sin(t * Math.PI), 1 + 0.08 * Math.sin(t * Math.PI));
        },
        onComplete: () => {
          pc.body.setPosition(end.x, end.y);
          pc.shadow.setPosition(end.x, end.y).setScale(1).setAlpha(0.4);
          pc.body.setDepth(10);
          pc.hopping = false;
          this.tweens.add({ targets: pc.body, scaleY: 0.86, scaleX: 1.08, duration: 55, yoyo: true, onComplete: () => pc.body.setScale(1) });
          res();
        },
      });
    });
  }

  private drawDice(spin = false): void {
    const D = this.diceLayer;
    D.removeAll(true);
    const pips: Record<number, Array<[number, number]>> = {
      1: [[0, 0]],
      2: [[-3, -3], [3, 3]],
      3: [[-3, -3], [0, 0], [3, 3]],
      4: [[-3, -3], [3, -3], [-3, 3], [3, 3]],
      5: [[-3, -3], [3, -3], [0, 0], [-3, 3], [3, 3]],
      6: [[-3, -3], [3, -3], [-3, 0], [3, 0], [-3, 3], [3, 3]],
    };
    this.dice.forEach((v, k) => {
      const x = BX + CELL * 3.5 + (k === 0 ? -11 : 11);
      const y = BY + CELL * 3.5;
      const die = this.add.container(x, y);
      // a shadow, the cube with a bevel, and the pips
      die.add(this.add.rectangle(2, 2, 15, 15, 0x000000, 0.4));
      die.add(this.add.rectangle(0, 0, 15, 15, 0xf8f4ea).setStrokeStyle(1, INK));
      die.add(this.add.rectangle(-0.5, -6.5, 13, 1, 0xffffff));
      die.add(this.add.rectangle(6.5, 0.5, 1, 13, 0xd8ccb4));
      die.add(this.add.rectangle(0.5, 6.5, 13, 1, 0xd8ccb4));
      for (const [px, py] of pips[v]) die.add(this.add.circle(px, py, 1.5, v === 1 ? 0xd8202a : INK));
      if (spin) die.setAngle(Phaser.Math.Between(-25, 25));
      D.add(die);
    });
  }

  // ------------------------------------------------------------- the panel

  /**
   * The side panel: the stake, both players with their piece in a little
   * frame (the one whose turn it is glows), the card for the space in focus,
   * what just happened, and the buttons for this moment.  Text has a drop
   * shadow; the numbers that matter are outlined; every button's label is cut
   * to fit inside it.
   */
  private renderPanel(): void {
    const P = this.panel;
    P.removeAll(true);
    this.turnGlow.setVisible(false);
    if (this.phase === 'stake') return;
    const g = this.g;
    const pw = GAME_W - PANEL_X - 4;
    P.add(this.add.rectangle(PANEL_X + 3, 7, pw, GAME_H - 8, 0x000000, 0.5).setOrigin(0, 0));
    P.add(this.add.rectangle(PANEL_X, 4, pw, GAME_H - 8, 0x1c1428, 0.97).setOrigin(0, 0).setStrokeStyle(1, INK));
    P.add(this.add.rectangle(PANEL_X + 1, 5, pw - 2, 1, 0x4a3a5a).setOrigin(0, 0));
    P.add(outlined(this, PANEL_X + 6, 9, `STAKE ${this.stake}`, PALETTE.gold, { shadow: true }));
    P.add(this.fitButton(GAME_W - 24, 12, 'QUIT', () => this.askQuit(), 36, 12, 0x5a1a22));
    const row = (y: number, who: Who, name: string) => {
      const p = g.players[who];
      const mine = g.turn === who && this.phase === 'play';
      if (mine) this.turnGlow.setPosition(PANEL_X + pw / 2, y + 7).setSize(pw - 6, 17).setVisible(true);
      // the piece in its frame
      P.add(this.add.rectangle(PANEL_X + 13, y + 7, 15, 15, 0x0c0814).setStrokeStyle(1, mine ? PALETTE.gold : 0x4a3a5a));
      const av = this.add.graphics();
      drawPiece(av, this.pieceLook(who));
      av.setPosition(PANEL_X + 13, y + 14.5).setScale(0.62);
      P.add(av);
      P.add(shadowed(this, PANEL_X + 24, y + 3, name, mine ? PALETTE.cream : PALETTE.ash).box);
      const cash = `L$${p.cash}`;
      P.add(outlined(this, GAME_W - 10 - cash.length * 6, y + 3, cash, mine ? PALETTE.gold : PALETTE.cream));
      if (p.swamp > 0) {
        const r = this.add.graphics();
        drawIcon(r, 'swamp', 0, 0, 0x0c0814);
        r.setPosition(PANEL_X + 19, y + 9).setScale(0.45);
        P.add(r);
      }
    };
    row(22, 0, 'YOU');
    row(40, 1, this.opp);
    // the card for the space in focus
    const s = BOARD[this.focus];
    const o = g.owner[this.focus];
    const band = s.color ?? (s.kind === 'util' ? (s.name.startsWith('FIRE') ? 0xc8a020 : 0x2a88b8) : 0x4a3a5a);
    const cy = 60;
    P.add(this.add.rectangle(PANEL_X + 6, cy + 2, pw - 8, 44, 0x000000, 0.45).setOrigin(0, 0));
    P.add(this.add.rectangle(PANEL_X + 4, cy, pw - 8, 44, 0x14100c).setOrigin(0, 0).setStrokeStyle(1, INK));
    P.add(this.add.rectangle(PANEL_X + 4, cy, pw - 8, 11, band).setOrigin(0, 0));
    P.add(this.add.rectangle(PANEL_X + 4, cy, pw - 8, 1, shade(band, 0.4)).setOrigin(0, 0));
    P.add(this.add.rectangle(PANEL_X + 4, cy + 10, pw - 8, 1, shade(band, -0.4)).setOrigin(0, 0));
    P.add(outlined(this, PANEL_X + 4 + (pw - 8) / 2, cy + 6, s.name, PALETTE.cream, { center: true }));
    const lines: Array<[string, number, string?, number?]> = [];
    if (s.price) {
      lines.push([`PRICE L$${s.price}`, PALETTE.cream, o === null ? 'FOR SALE' : o === 0 ? 'YOURS' : this.opp, o === null ? PALETTE.mossLight : o === 0 ? 0x46c46e : this.oppColour()]);
      if (s.kind === 'prop') lines.push([`RENT L$${o === null ? baseRent(this.focus) : rentOf(g, this.focus, 7)}`, PALETTE.ash, `PADS ${g.level[this.focus]}/${MAX_LEVEL}`, PALETTE.ash]);
      else lines.push(['RENT: DICE x4', PALETTE.ash], ['(x10 WITH BOTH)', PALETTE.ash]);
    } else if (s.kind === 'tax') lines.push([`PAY L$${s.tax}`, 0xff8a7a]);
    else if (s.kind === 'chance') lines.push(['DRAW A POND RIPPLE', PALETTE.ash]);
    else if (s.kind === 'go') lines.push(['COLLECT L$200', PALETTE.ash], ['EACH TIME YOU PASS', PALETTE.ash]);
    else if (s.kind === 'swamp') lines.push([`STUCK? PAY L$${SWAMP_FINE}`, PALETTE.ash], ['OR ROLL DOUBLES', PALETTE.ash]);
    else if (s.kind === 'goswamp') lines.push(['STRAIGHT TO THE SWAMP', PALETTE.ash]);
    else lines.push(['A NICE PLACE TO SIT', PALETTE.ash]);
    lines.slice(0, 3).forEach(([l, c, r, rc], k) => {
      P.add(shadowed(this, PANEL_X + 8, cy + 14 + k * 9, l, c).box);
      if (r) P.add(shadowed(this, GAME_W - 12 - r.length * 6, cy + 14 + k * 9, r, rc ?? c).box);
    });
    // what just happened
    P.add(shadowed(this, PANEL_X + 6, 110, this.status, PALETTE.cream, pw - 12).box);
    // the buttons for this moment
    const bw = pw - 12;
    const bx = PANEL_X + pw / 2;
    const btn = (y: number, label: string, fn: () => void, fill?: number) => P.add(this.fitButton(bx, y, label, fn, bw, 14, fill));
    const half = (y: number, a: [string, () => void], b: [string, () => void]) => {
      P.add(this.fitButton(bx - bw / 4 - 1, y, a[0], a[1], bw / 2 - 2, 14));
      P.add(this.fitButton(bx + bw / 4 + 1, y, b[0], b[1], bw / 2 - 2, 14));
    };
    if (this.step === 'roll') btn(162, 'ROLL THE DICE', () => this.playerRoll(), PALETTE.moss);
    else if (this.step === 'swamp') half(162, [`PAY L$${SWAMP_FINE}`, () => this.payOut()], ['ROLL', () => this.playerRoll()]);
    else if (this.step === 'buy') half(162, [`BUY L$${BOARD[g.players[0].pos].price}`, () => this.buy()], ['PASS', () => this.declineBuy()]);
    else if (this.step === 'act') {
      const canBuild = BOARD.some((_, i) => canUpgrade(g, i, 0));
      if (canBuild) btn(146, 'BUILD LILY PADS', () => this.enterBuild());
      btn(162, g.doubles > 0 ? 'DOUBLES! ROLL AGAIN' : 'END TURN', () => this.endPlayerTurn(), PALETTE.moss);
    } else if (this.step === 'build') {
      P.add(shadowed(this, PANEL_X + 6, 134, 'TAP A LIT SPACE', PALETTE.gold).box);
      btn(162, 'DONE BUILDING', () => {
        this.step = 'act';
        this.refresh();
      });
    } else if (this.step === 'debt' && this.owed) {
      const assets = sellable(g, 0).slice(0, 2);
      P.add(outlined(this, PANEL_X + 6, 120, `OWE L$${this.owed.amt}. SELL:`, PALETTE.ember));
      assets.forEach((a, k) => {
        btn(134 + k * 14, `${a.what === 'pad' ? 'PAD ' : ''}${BOARD[a.i].name} +${a.value}`, () => {
          sell(g, 0, a);
          audio.sfx('coin_spin');
          this.checkDebt();
        });
      });
      if (!assets.length || g.players[0].cash + canRaise(g, 0) < this.owed.amt) btn(164, 'GO BANKRUPT', () => this.goBankrupt(0), 0x5a1a22);
    }
  }

  /**
   * A button whose label always sits inside it, centred: a label too long
   * for the width loses letters from the middle of the name, never the price
   * at its end.
   */
  private fitButton(x: number, y: number, label: string, fn: () => void, w: number, h: number, fill?: number): Phaser.GameObjects.Container {
    const max = Math.max(2, Math.floor((w - 6) / 6));
    let l = label;
    if (l.length > max) {
      const tail = l.match(/ [+-]?(L\$)?\d+$/)?.[0] ?? '';
      l = `${l.slice(0, Math.max(1, max - tail.length - 1)).trimEnd()}.${tail}`.slice(0, max);
    }
    const b = button(this, x, y, l, fn, { width: w, height: h, fill });
    return b;
  }

  // ------------------------------------------------------------- the deed card

  /**
   * THE PURCHASE CARD: a title deed laid over the board when you land on a
   * space you can buy, with a little four-frame diorama of the place, the
   * price and the rent, and BUY / PASS.  Buying thumps a SOLD stamp on it.
   */
  private openCard(i: number): void {
    this.closeCard(true);
    const s = BOARD[i];
    const kind: DioramaKind = s.kind === 'util' ? (s.name.startsWith('FIRE') ? 'pwr' : 'h2o') : 'prop';
    const tint = s.color ?? (kind === 'pwr' ? 0xc8a020 : 0x2a88b8);
    const cx = BX + CELL * 3.5;
    const cy = BY + CELL * 3.5;
    const W = 112;
    const H = 112;
    const c = this.add.container(cx, cy).setDepth(60);
    this.card = c;
    c.add(this.add.rectangle(3, 4, W, H, 0x000000, 0.5));
    c.add(this.add.rectangle(0, 0, W, H, 0xf8f0dc).setStrokeStyle(1, INK));
    c.add(this.add.rectangle(0, -H / 2 + 1, W - 2, 1, 0xffffff));
    c.add(this.add.rectangle(0, -H / 2 + 9, W - 6, 13, tint).setStrokeStyle(1, INK));
    c.add(this.add.rectangle(0, -H / 2 + 3.5, W - 7, 1, shade(tint, 0.45)));
    c.add(outlined(this, 0, -H / 2 + 9, s.name, PALETTE.cream, { center: true }));
    // the diorama, animated
    const dg = this.add.graphics();
    c.add(dg);
    const dw = 96;
    const dh = 40;
    let f = 0;
    const paint = () => drawDiorama(dg, kind, tint, f, -dw / 2, -H / 2 + 19, dw, dh);
    paint();
    const tick = this.time.addEvent({
      delay: 260,
      loop: true,
      callback: () => {
        f = (f + 1) % 4;
        paint();
      },
    });
    c.once(Phaser.GameObjects.Events.DESTROY, () => tick.remove());
    const rent = s.kind === 'prop' ? `RENT L$${baseRent(i)}` : 'RENT DICE x4';
    c.add(outlined(this, 0, 18, `PRICE L$${s.price}`, PALETTE.gold, { center: true, shadow: true }));
    c.add(centerText(this, 0, 29, rent, 0x5a4a3a));
    c.add(this.fitButton(-26, 44, `BUY ${s.price}`, () => this.buy(), 48, 14, PALETTE.moss));
    c.add(this.fitButton(26, 44, 'PASS', () => this.declineBuy(), 48, 14));
    // it drops in
    c.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });
  }

  private closeCard(now = false): void {
    const c = this.card;
    this.card = null;
    if (!c) return;
    if (now) {
      c.destroy();
      return;
    }
    this.tweens.add({ targets: c, alpha: 0, y: c.y + 8, duration: 200, onComplete: () => c.destroy() });
  }

  /** A red rubber stamp, slammed down: on the card when you buy, small on the space when they do. */
  private stamp(x: number, y: number, scale: number, into?: Phaser.GameObjects.Container): Phaser.GameObjects.Container {
    const st = this.add.container(x, y).setDepth(70).setAngle(-14);
    st.add(this.add.rectangle(0, 0, 40, 16).setStrokeStyle(2, 0xd8202a));
    st.add(this.add.rectangle(0, 0, 34, 10).setStrokeStyle(1, 0xd8202a, 0.7));
    st.add(outlined(this, 0, 0, 'SOLD', 0xe02a20, { center: true, outline: 0xfff4e8 }));
    if (into) into.add(st);
    st.setScale(scale * 2.2).setAlpha(0);
    this.tweens.add({
      targets: st,
      scale,
      alpha: 1,
      duration: 160,
      ease: 'Quad.easeIn',
      onComplete: () => {
        audio.sfx('door_shut', 0.25);
        this.cameras.main.shake(70, 0.004);
      },
    });
    return st;
  }

  private refresh(): void {
    this.drawBoard();
    this.renderPanel();
  }

  private cellClicked(i: number): void {
    if (this.step === 'build' && canUpgrade(this.g, i, 0)) {
      upgrade(this.g, i, 0);
      audio.sfx('cha_ching');
      this.status = `A LILY PAD ON ${BOARD[i].name}.`;
    }
    this.focus = i;
    this.refresh();
  }

  // ------------------------------------------------------------- the turns

  private startTurn(): void {
    if (!this.alive || this.g.over) {
      this.showResult();
      return;
    }
    const who = this.g.turn;
    if (who === 0) {
      this.step = this.g.players[0].swamp > 0 ? 'swamp' : 'roll';
      if (this.step === 'swamp') this.status = 'YOU ARE IN THE SWAMP. PAY, OR TRY FOR DOUBLES.';
      this.focus = this.g.players[0].pos;
      this.refresh();
      return;
    }
    this.step = 'busy';
    this.refresh();
    void this.aiTurn();
  }

  private async throwDice(): Promise<[number, number]> {
    audio.sfx('ui_blip', 0.5);
    for (let k = 0; k < 7; k++) {
      this.dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
      this.drawDice(true);
      await this.wait(70);
    }
    this.dice = rollDice();
    this.drawDice(false);
    audio.sfx('coin_drop', 0.5);
    await this.wait(250);
    return this.dice;
  }

  private async playerRoll(): Promise<void> {
    if (this.step !== 'roll' && this.step !== 'swamp') return;
    const inSwamp = this.step === 'swamp';
    this.step = 'busy';
    this.renderPanel();
    const [a, b] = await this.throwDice();
    if (!this.alive) return;
    await this.resolveRoll(0, a, b, inSwamp);
  }

  private payOut(): void {
    if (this.step !== 'swamp') return;
    this.charge(0, SWAMP_FINE, null, () => {
      this.g.players[0].swamp = 0;
      this.status = 'YOU PAY YOUR WAY OUT OF THE SWAMP. ROLL.';
      this.step = 'roll';
      this.refresh();
    });
  }

  /** A throw, by either player: the swamp, doubles, the move and the landing. */
  private async resolveRoll(who: Who, a: number, b: number, inSwamp: boolean): Promise<void> {
    const g = this.g;
    const p = g.players[who];
    const name = who === 0 ? 'YOU' : this.opp;
    const dbl = a === b;
    if (inSwamp || p.swamp > 0) {
      if (dbl) {
        p.swamp = 0;
        this.status = `${name} ROLL DOUBLES AND CLIMB OUT.`;
      } else {
        p.swamp -= 1;
        if (p.swamp > 0) {
          this.status = `${name} STAY IN THE SWAMP.`;
          this.refresh();
          await this.wait(600);
          this.finishTurn(who, false);
          return;
        }
        // third failed try: pay and go
        await new Promise<void>((res) => this.charge(who, SWAMP_FINE, null, res));
        if (g.over) return this.showResult();
        this.status = `${name} PAY L$${SWAMP_FINE} AND LEAVE THE SWAMP.`;
      }
    } else if (dbl) {
      g.doubles += 1;
      if (g.doubles >= 3) {
        toSwamp(g, who);
        this.status = `THREE DOUBLES! ${name} GO TO THE SWAMP.`;
        this.refresh();
        await this.wait(700);
        this.finishTurn(who, false);
        return;
      }
    }
    await this.walk(who, a + b);
    if (!this.alive || g.over) return this.showResult();
    await this.land(who, a + b);
    if (!this.alive) return;
    if (g.over) return this.showResult();
    if (who === 0) {
      if (this.step !== 'buy' && this.step !== 'debt') {
        this.step = 'act';
        this.refresh();
      }
    }
  }

  private async walk(who: Who, steps: number): Promise<void> {
    const dir = steps > 0 ? 1 : -1;
    for (let k = 0; k < Math.abs(steps); k++) {
      const passed = moveBy(this.g, who, dir);
      if (passed) {
        audio.sfx('coin_spin', 0.6);
        this.status = `${who === 0 ? 'YOU PASS' : `${this.opp} PASSES`} LILY START: +L$200`;
      }
      this.focus = this.g.players[who].pos;
      this.renderPanel();
      audio.sfx('footstep_carpet', 0.3);
      await this.hop(who, this.g.players[who].pos);
      if (!this.alive) return;
      this.drawBoard();
    }
  }

  private async land(who: Who, total: number): Promise<void> {
    const g = this.g;
    const i = g.players[who].pos;
    const s = BOARD[i];
    const name = who === 0 ? 'YOU' : this.opp;
    this.focus = i;
    if (s.kind === 'prop' || s.kind === 'util') {
      const o = g.owner[i];
      if (o === null) {
        if (who === 0) {
          if (g.players[0].cash >= (s.price ?? 0)) {
            this.status = `${s.name} IS FOR SALE: L$${s.price}.`;
            this.step = 'buy';
            this.refresh();
            this.openCard(i);
            return;
          }
          this.status = `${s.name} - YOU CANNOT AFFORD IT.`;
          this.refresh();
          return;
        }
        if (aiWantsToBuy(g, 1, i)) {
          g.players[1].cash -= s.price ?? 0;
          g.owner[i] = 1;
          audio.sfx('cha_ching', 0.5);
          this.status = `${this.opp} BUYS ${s.name}.`;
          const at = cellOf(i);
          const st = this.stamp(at.cx, at.cy, 0.5);
          this.time.delayedCall(900, () => this.tweens.add({ targets: st, alpha: 0, duration: 250, onComplete: () => st.destroy() }));
        } else this.status = `${this.opp} PASSES ON ${s.name}.`;
        this.refresh();
        await this.wait(700);
        return;
      }
      if (o !== who) {
        const rent = rentOf(g, i, total);
        this.status = `${name} OWE${who === 0 ? '' : 'S'} L$${rent} RENT FOR ${s.name}.`;
        this.refresh();
        await this.wait(500);
        await new Promise<void>((res) => this.charge(who, rent, o, res));
        return;
      }
      this.status = `${name} REST${who === 0 ? '' : 'S'} ON ${s.name}.`;
      this.refresh();
      await this.wait(400);
      return;
    }
    if (s.kind === 'tax') {
      this.status = `${s.name}: ${name} PAY${who === 0 ? '' : 'S'} L$${s.tax}.`;
      this.refresh();
      await this.wait(500);
      await new Promise<void>((res) => this.charge(who, s.tax ?? 0, null, res));
      return;
    }
    if (s.kind === 'goswamp') {
      toSwamp(g, who);
      g.doubles = 0;
      this.status = `${name} GO${who === 0 ? '' : 'ES'} STRAIGHT TO THE SWAMP.`;
      this.refresh();
      await this.wait(600);
      return;
    }
    if (s.kind === 'chance') {
      const r = drawRipple();
      this.status = `POND RIPPLE: ${r.text}`;
      this.refresh();
      audio.sfx('chime', 0.5);
      await this.wait(1100);
      if (r.cash && r.cash > 0) g.players[who].cash += r.cash;
      else if (r.cash && r.cash < 0) await new Promise<void>((res) => this.charge(who, -r.cash!, null, res));
      else if (r.fromOther) {
        const from = other(who);
        await new Promise<void>((res) => this.charge(from, r.fromOther!, who, res));
      } else if (r.perPad) {
        const due = padsOf(g, who) * r.perPad;
        if (due > 0) await new Promise<void>((res) => this.charge(who, due, null, res));
      } else if (r.swamp) {
        toSwamp(g, who);
        g.doubles = 0;
      } else if (r.moveTo !== undefined) {
        const steps = (r.moveTo - g.players[who].pos + BOARD.length) % BOARD.length;
        await this.walk(who, steps);
        if (BOARD[g.players[who].pos].kind !== 'go') await this.land(who, total);
      } else if (r.moveBy) {
        await this.walk(who, r.moveBy);
        await this.land(who, total);
      }
      this.refresh();
      return;
    }
    this.status =
      s.kind === 'swamp' ? `${name} ${who === 0 ? 'ARE' : 'IS'} JUST VISITING THE SWAMP.`
        : s.kind === 'free' ? `${name} SUNBATHE${who === 0 ? '' : 'S'} ON THE FREE LILY PAD.`
          : `${name} LAND${who === 0 ? '' : 'S'} ON LILY START.`;
    this.refresh();
    await this.wait(400);
  }

  /**
   * Pay up.  With the money in hand it is simply paid; short, the player
   * gets the selling screen and the opponent sells by itself; and with
   * nothing left to sell, whoever owes is bankrupt.
   */
  private charge(who: Who, amt: number, to: Who | null, then: () => void): void {
    const g = this.g;
    const pay = () => {
      g.players[who].cash -= amt;
      if (to !== null) g.players[to].cash += amt;
      this.refresh();
      then();
    };
    if (g.players[who].cash >= amt) return pay();
    if (who === 1) {
      aiRaise(g, 1, amt);
      if (g.players[1].cash >= amt) {
        this.status = `${this.opp} SELLS UP TO PAY.`;
        return pay();
      }
      this.goBankrupt(1);
      return;
    }
    this.owed = {
      amt,
      to,
      then: () => {
        this.owed = null;
        pay();
      },
    };
    this.step = 'debt';
    this.status = 'NOT ENOUGH CASH. SELL SOMETHING TO PAY.';
    this.refresh();
  }

  private checkDebt(): void {
    const o = this.owed;
    if (!o) return;
    if (this.g.players[0].cash >= o.amt) {
      this.step = 'busy';
      this.status = 'PAID.';
      o.then();
      return;
    }
    this.refresh();
  }

  private goBankrupt(who: Who): void {
    bankrupt(this.g, who);
    this.status = `${who === 0 ? 'YOU ARE' : `${this.opp} IS`} BANKRUPT.`;
    this.owed = null;
    this.refresh();
    this.time.delayedCall(900, () => this.showResult());
  }

  private buy(): void {
    if (this.step !== 'buy') return;
    const g = this.g;
    const i = g.players[0].pos;
    const s = BOARD[i];
    if (g.owner[i] !== null || g.players[0].cash < (s.price ?? 0)) return;
    g.players[0].cash -= s.price ?? 0;
    g.owner[i] = 0;
    audio.sfx('cha_ching');
    this.status = `YOU BUY ${s.name}.`;
    this.step = 'act';
    this.refresh();
    const c = this.card;
    if (c) {
      // SOLD, thumped on the deed, which then goes
      this.card = null;
      this.stamp(0, -6, 1.3, c);
      this.time.delayedCall(800, () => this.tweens.add({ targets: c, alpha: 0, y: c.y + 8, duration: 220, onComplete: () => c.destroy() }));
    }
  }

  private declineBuy(): void {
    if (this.step !== 'buy') return;
    this.status = `YOU LEAVE ${BOARD[this.g.players[0].pos].name} FOR NOW.`;
    this.step = 'act';
    this.closeCard();
    this.refresh();
  }

  private enterBuild(): void {
    this.step = 'build';
    this.status = 'BUILD LILY PADS ON A FULL COLOUR SET.';
    this.refresh();
  }

  private endPlayerTurn(): void {
    if (this.step !== 'act') return;
    this.finishTurn(0, this.g.doubles > 0 && this.g.players[0].swamp === 0);
  }

  private finishTurn(who: Who, again: boolean): void {
    if (this.g.over) return this.showResult();
    if (again && this.g.players[who].swamp === 0) {
      this.status = who === 0 ? 'DOUBLES: ROLL AGAIN.' : `${this.opp} ROLLED DOUBLES.`;
      this.startTurn();
      return;
    }
    endTurn(this.g);
    if (this.g.over) return this.showResult();
    if (this.g.turn === 0) this.status = 'YOUR TURN.  ROLL THE DICE.';
    this.startTurn();
  }

  private async aiTurn(): Promise<void> {
    const g = this.g;
    await this.wait(500);
    if (!this.alive) return;
    const p = g.players[1];
    if (p.swamp > 0 && p.cash > 300) {
      p.cash -= SWAMP_FINE;
      p.swamp = 0;
      this.status = `${this.opp} PAYS OUT OF THE SWAMP.`;
      this.refresh();
      await this.wait(500);
    }
    const [a, b] = await this.throwDice();
    if (!this.alive) return;
    const wasSwamp = p.swamp > 0;
    await this.resolveRoll(1, a, b, wasSwamp);
    if (!this.alive || g.over) return;
    if (g.turn !== 1) return;
    const built = aiBuild(g, 1);
    if (built.length) {
      this.status = `${this.opp} BUILDS ${built.length} LILY PAD${built.length > 1 ? 'S' : ''}.`;
      audio.sfx('cha_ching', 0.5);
      this.refresh();
      await this.wait(700);
    }
    this.finishTurn(1, a === b && !wasSwamp && p.swamp === 0);
  }

  // ------------------------------------------------------------- the end

  /** Settled once, here: twice the stake for a win, the stake for a draw, nothing for a loss. */
  private showResult(): void {
    if (this.phase === 'result') return;
    this.phase = 'result';
    this.step = 'idle';
    const g = this.g;
    if (!g.over) {
      g.over = true;
      g.winner = wealth(g, 0) === wealth(g, 1) ? 'draw' : wealth(g, 0) > wealth(g, 1) ? 0 : 1;
    }
    if (!this.settled) {
      this.settled = true;
      if (g.winner === 0) ledger.credit(this.stake * 2, 'board');
      else if (g.winner === 'draw') ledger.credit(this.stake, 'board');
    }
    const won = g.winner === 0;
    const draw = g.winner === 'draw';
    audio.sfx(won ? 'chime' : draw ? 'ui_blip' : 'buzzer');
    const c = this.add.container(0, 0).setDepth(200);
    c.add(this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.75).setOrigin(0, 0).setInteractive());
    c.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, 240, 140, PALETTE.ink).setStrokeStyle(1, won ? PALETTE.gold : draw ? PALETTE.cream : PALETTE.ember));
    c.add(centerText(this, GAME_W / 2, 36, won ? 'YOU WIN!' : draw ? 'A DRAW' : 'YOU LOSE', won ? PALETTE.gold : draw ? PALETTE.cream : PALETTE.ember, 16));
    const why = g.players[0].bankrupt ? 'YOU WENT BANKRUPT.' : g.players[1].bankrupt ? `${this.opp} WENT BANKRUPT.` : `AFTER ${ROUNDS} ROUNDS, BY WHAT YOU OWN:`;
    c.add(centerText(this, GAME_W / 2, 58, why, PALETTE.ash));
    c.add(centerText(this, GAME_W / 2, 72, `YOU  L$${wealth(g, 0)}     ${this.opp}  L$${wealth(g, 1)}`, PALETTE.cream));
    c.add(
      centerText(
        this,
        GAME_W / 2,
        92,
        won ? `+${this.stake * 2} TOKENS (YOUR ${this.stake} BACK, AND ${this.stake} MORE)` : draw ? `YOUR ${this.stake} TOKENS BACK` : `YOUR ${this.stake} TOKENS ARE GONE`,
        won ? PALETTE.gold : draw ? PALETTE.cream : PALETTE.ember,
      ),
    );
    const line = this.after
      ? won ? '"...Okay. Good game. Will you come back?"' : '"I always win. I always, always win."'
      : won ? '"WHAT? Again! We play again!"' : '"Ribbit! I TOLD you I always win!"';
    c.add(centerText(this, GAME_W / 2, 110, line, PALETTE.mossLight).setMaxWidth(220));
    c.add(button(this, GAME_W / 2, 136, 'BACK TO THE ROOM', () => this.leave(), { width: 110, height: 13 }));
  }

  private askQuit(): void {
    if (this.phase === 'stake') return this.leave();
    if (this.phase === 'result') return this.leave();
    confirmDialog(this, {
      lines: ['QUIT THE GAME?', `IT COUNTS AS A LOSS: YOUR ${this.stake} TOKENS ARE GONE.`],
      confirm: 'QUIT',
      cancel: 'KEEP PLAYING',
      onConfirm: () => this.quitNow(),
      onCancel: () => undefined,
      edge: PALETTE.ember,
    });
  }

  /** Walking away is a loss, settled like any other. */
  private quitNow(): void {
    if (this.phase === 'play') {
      this.g.over = true;
      this.g.winner = 1;
      this.settled = true;
      this.phase = 'result';
    }
    this.leave();
  }

  private leave(): void {
    this.alive = false;
    fadeToScene(this, 'ArcadeLounge', { atProp: 'table' });
  }
}
