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

    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x2a1a10).setOrigin(0, 0);
    this.boardLayer = this.add.container(0, 0);
    this.diceLayer = this.add.container(0, 0).setDepth(20);
    this.panel = this.add.container(0, 0).setDepth(30);
    this.drawBoard();
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
    c.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, 250, 150, PALETTE.ink).setStrokeStyle(1, PALETTE.gold));
    c.add(centerText(this, GAME_W / 2, 26, 'FROGGOPOLY', PALETTE.gold, 16));
    const hello = this.after
      ? '"Oh. Hi. You can sit there. I have been waiting a long time."'
      : '"A game? Oh, I LOVE this game. I always win it!"';
    c.add(centerText(this, GAME_W / 2, 46, `${this.opp}:`, PALETTE.mossLight));
    c.add(centerText(this, GAME_W / 2, 56, hello, PALETTE.cream).setMaxWidth(230));
    const bal = ledger.balance();
    c.add(centerText(this, GAME_W / 2, 80, `YOU HAVE ${bal} TOKENS.  CHOOSE THE STAKE:`, PALETTE.ash));
    STAKES.forEach((st, i) => {
      const can = bal >= st;
      c.add(
        button(this, GAME_W / 2 - 70 + i * 70, 98, `${st} TOKENS`, () => (can ? this.confirmStake(st) : audio.sfx('buzzer')), {
          width: 64,
          height: 14,
          fill: can ? PALETTE.plum : PALETTE.ink,
        }),
      );
    });
    c.add(centerText(this, GAME_W / 2, 118, 'WIN: DOUBLE BACK   LOSE: IT IS GONE   DRAW: STAKE BACK', PALETTE.ash).setMaxWidth(240));
    c.add(button(this, GAME_W / 2, 142, 'LEAVE', () => this.leave(), { width: 60, height: 13 }));
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

  private drawBoard(): void {
    const L = this.boardLayer;
    L.removeAll(true);
    L.add(this.add.rectangle(BX, BY, CELL * 7, CELL * 7, 0x2a6a3a).setOrigin(0, 0).setStrokeStyle(1, 0xf2e6d8));
    L.add(centerText(this, BX + CELL * 3.5, BY + CELL * 2.2, 'FROGGOPOLY', PALETTE.gold));
    L.add(centerText(this, BX + CELL * 3.5, BY + CELL * 4.9, `ROUND ${Math.min(this.g.round, ROUNDS)}/${ROUNDS}`, PALETTE.cream));
    BOARD.forEach((s, i) => {
      const { cx, cy } = cellOf(i);
      const corner = s.kind === 'go' || s.kind === 'swamp' || s.kind === 'free' || s.kind === 'goswamp';
      const fill = corner ? 0xe8dcc0 : 0xf2ead8;
      const cell = this.add.rectangle(cx, cy, CELL - 1, CELL - 1, fill).setStrokeStyle(1, 0x3a2a1a);
      cell.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.cellClicked(i));
      L.add(cell);
      if (s.color) L.add(this.add.rectangle(cx, cy - CELL / 2 + 3.5, CELL - 3, 5, s.color));
      // a short label
      const label = s.kind === 'chance' ? '?' : s.kind === 'tax' ? 'TAX' : s.kind === 'go' ? 'GO' : s.kind === 'swamp' ? 'SWMP' : s.kind === 'free' ? 'FREE' : s.kind === 'goswamp' ? '>SWP' : s.kind === 'util' ? (s.name.startsWith('FIRE') ? 'PWR' : 'H2O') : '';
      if (label) L.add(centerText(this, cx, cy + (s.color ? 2 : 0), label, s.kind === 'chance' ? PALETTE.plum : 0x3a2a1a));
      if (s.price && s.kind === 'prop') L.add(centerText(this, cx, cy + 4, `${s.price}`, 0x3a2a1a));
      // who owns it, and its lily pads
      const o = this.g.owner[i];
      if (o !== null) {
        L.add(this.add.rectangle(cx, cy + CELL / 2 - 2.5, CELL - 3, 3, o === 0 ? 0x46c46e : 0x7b4bd8));
        for (let k = 0; k < this.g.level[i]; k++) L.add(this.add.circle(cx - 6 + k * 6, cy - 4, 2, 0x2e9a4a).setStrokeStyle(0.6, 0x123a22));
      }
      if (i === this.focus) L.add(this.add.rectangle(cx, cy, CELL - 1, CELL - 1).setStrokeStyle(1, PALETTE.gold));
      if (this.step === 'build' && canUpgrade(this.g, i, 0)) {
        const glow = this.add.rectangle(cx, cy, CELL - 1, CELL - 1, PALETTE.gold, 0.25);
        L.add(glow);
      }
    });
    // the pieces
    for (const who of [0, 1] as Who[]) {
      const p = this.g.players[who];
      const { cx, cy } = cellOf(p.pos);
      const x = cx + (who === 0 ? -5 : 5);
      const y = cy + 3;
      L.add(this.piece(x, y, who));
    }
  }

  /** Your piece is a little Froggy -- a dead one, after the night.  Theirs is a crown, or a die. */
  private piece(x: number, y: number, who: Who): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    if (who === 0) {
      const dead = this.after;
      c.add(this.add.ellipse(0, 0, 9, 7, dead ? 0x6a7a5a : 0x46c46e).setStrokeStyle(1, 0x123a22));
      if (dead) {
        for (const ex of [-2, 2]) {
          c.add(this.add.line(0, 0, ex - 1, -4, ex + 1, -2, 0x1a1410).setOrigin(0, 0));
          c.add(this.add.line(0, 0, ex + 1, -4, ex - 1, -2, 0x1a1410).setOrigin(0, 0));
        }
        c.add(this.add.rectangle(0, 1.5, 4, 0.8, 0x1a1410));
      } else {
        c.add(this.add.circle(-2, -3, 1.6, 0xf2ead8));
        c.add(this.add.circle(2, -3, 1.6, 0xf2ead8));
        c.add(this.add.circle(-2, -3, 0.7, 0x111111));
        c.add(this.add.circle(2, -3, 0.7, 0x111111));
      }
    } else if (!this.after) {
      c.add(this.add.rectangle(0, 0, 8, 4, PALETTE.gold).setStrokeStyle(0.8, PALETTE.amberDark));
      for (const k of [-3, 0, 3]) c.add(this.add.triangle(k, -3, -1.2, 1.5, 1.2, 1.5, 0, -1.5, PALETTE.gold));
    } else {
      c.add(this.add.polygon(0, 0, [0, -5, 4.5, -1.5, 3, 4, -3, 4, -4.5, -1.5], 0x3f6fd8).setStrokeStyle(0.8, 0xc9d4ff));
      c.add(centerText(this, 0, 0, '20', 0xf2ead8));
    }
    return c;
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
      die.add(this.add.rectangle(0, 0, 15, 15, 0xf8f4ea).setStrokeStyle(1, 0x3a2a1a));
      for (const [px, py] of pips[v]) die.add(this.add.circle(px, py, 1.4, 0x1a1410));
      if (spin) die.setAngle(Phaser.Math.Between(-25, 25));
      D.add(die);
    });
  }

  // ------------------------------------------------------------- the panel

  private renderPanel(): void {
    const P = this.panel;
    P.removeAll(true);
    if (this.phase === 'stake') return;
    const g = this.g;
    P.add(this.add.rectangle(PANEL_X, 4, GAME_W - PANEL_X - 4, GAME_H - 8, PALETTE.ink, 0.92).setOrigin(0, 0).setStrokeStyle(1, PALETTE.slate));
    P.add(button(this, GAME_W - 22, 12, 'QUIT', () => this.askQuit(), { width: 30, height: 10, fill: 0x5a1a22 }));
    P.add(text(this, PANEL_X + 6, 9, `STAKE ${this.stake}`, PALETTE.gold));
    const row = (y: number, who: Who, name: string) => {
      const p = g.players[who];
      P.add(this.add.rectangle(PANEL_X + 8, y + 3, 6, 6, who === 0 ? 0x46c46e : 0x7b4bd8));
      P.add(text(this, PANEL_X + 14, y, `${name} L$${p.cash}`, g.turn === who && this.phase === 'play' ? PALETTE.cream : PALETTE.ash));
      if (p.swamp > 0) P.add(text(this, GAME_W - 34, y, 'SWAMP', PALETTE.ember));
    };
    row(22, 0, 'YOU');
    row(32, 1, this.opp);
    // the space in focus
    const s = BOARD[this.focus];
    const o = g.owner[this.focus];
    P.add(this.add.rectangle(PANEL_X + 4, 44, GAME_W - PANEL_X - 12, 38, 0x14100c).setOrigin(0, 0).setStrokeStyle(1, s.color ?? PALETTE.slate));
    P.add(text(this, PANEL_X + 8, 47, s.name, s.color ?? PALETTE.cream));
    const info: string[] = [];
    if (s.price) {
      info.push(`PRICE L$${s.price}   ${o === null ? 'FOR SALE' : o === 0 ? 'YOURS' : this.opp}`);
      if (s.kind === 'prop') info.push(`RENT L$${o === null ? baseRent(this.focus) : rentOf(g, this.focus, 7)}  PADS ${g.level[this.focus]}/${MAX_LEVEL}`);
      else info.push('RENT: DICE x4 (x10 WITH BOTH)');
    } else if (s.kind === 'tax') info.push(`PAY L$${s.tax}`);
    else if (s.kind === 'chance') info.push('DRAW A POND RIPPLE');
    else if (s.kind === 'go') info.push('COLLECT L$200 PASSING');
    else if (s.kind === 'swamp') info.push(`STUCK? PAY L$${SWAMP_FINE} OR ROLL DOUBLES`);
    else if (s.kind === 'goswamp') info.push('STRAIGHT TO THE SWAMP');
    else info.push('A NICE PLACE TO SIT');
    info.forEach((l, k) => P.add(text(this, PANEL_X + 8, 57 + k * 9, l, PALETTE.ash).setMaxWidth(GAME_W - PANEL_X - 16)));
    // what just happened
    P.add(text(this, PANEL_X + 6, 86, this.status, PALETTE.cream).setMaxWidth(GAME_W - PANEL_X - 12));
    // the buttons for this moment
    const bw = GAME_W - PANEL_X - 16;
    const bx = PANEL_X + 4 + bw / 2 + 4;
    const btn = (y: number, label: string, fn: () => void, fill?: number) => P.add(button(this, bx, y, label, fn, { width: bw, height: 13, fill }));
    const half = (y: number, a: [string, () => void], b: [string, () => void]) => {
      P.add(button(this, bx - bw / 4 - 1, y, a[0], a[1], { width: bw / 2 - 2, height: 13 }));
      P.add(button(this, bx + bw / 4 + 1, y, b[0], b[1], { width: bw / 2 - 2, height: 13 }));
    };
    if (this.step === 'roll') btn(160, 'ROLL THE DICE', () => this.playerRoll(), PALETTE.moss);
    else if (this.step === 'swamp') half(160, [`PAY L$${SWAMP_FINE}`, () => this.payOut()], ['ROLL', () => this.playerRoll()]);
    else if (this.step === 'buy') half(160, [`BUY L$${BOARD[g.players[0].pos].price}`, () => this.buy()], ['PASS', () => this.declineBuy()]);
    else if (this.step === 'act') {
      const canBuild = BOARD.some((_, i) => canUpgrade(g, i, 0));
      if (canBuild) btn(144, 'BUILD LILY PADS', () => this.enterBuild());
      btn(160, g.doubles > 0 ? 'DOUBLES! ROLL AGAIN' : 'END TURN', () => this.endPlayerTurn(), PALETTE.moss);
    } else if (this.step === 'build') {
      P.add(text(this, PANEL_X + 6, 124, 'TAP A LIT SPACE TO BUILD', PALETTE.gold));
      btn(160, 'DONE BUILDING', () => {
        this.step = 'act';
        this.refresh();
      });
    } else if (this.step === 'debt' && this.owed) {
      const assets = sellable(g, 0).slice(0, 3);
      P.add(text(this, PANEL_X + 6, 104, `OWE L$${this.owed.amt}. SELL:`, PALETTE.ember));
      assets.forEach((a, k) => {
        btn(118 + k * 14, `${a.what === 'pad' ? 'PAD ON ' : ''}${BOARD[a.i].name.slice(0, 12)} +${a.value}`, () => {
          sell(g, 0, a);
          audio.sfx('coin_spin');
          this.checkDebt();
        });
      });
      if (!assets.length || g.players[0].cash + canRaise(g, 0) < this.owed.amt) btn(162, 'GO BANKRUPT', () => this.goBankrupt(0), 0x5a1a22);
    }
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
      this.refresh();
      audio.sfx('footstep_carpet', 0.3);
      await this.wait(110);
      if (!this.alive) return;
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
          } else this.status = `${s.name} - YOU CANNOT AFFORD IT.`;
          this.refresh();
          return;
        }
        if (aiWantsToBuy(g, 1, i)) {
          g.players[1].cash -= s.price ?? 0;
          g.owner[i] = 1;
          audio.sfx('cha_ching', 0.5);
          this.status = `${this.opp} BUYS ${s.name}.`;
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
  }

  private declineBuy(): void {
    if (this.step !== 'buy') return;
    this.status = `YOU LEAVE ${BOARD[this.g.players[0].pos].name} FOR NOW.`;
    this.step = 'act';
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
