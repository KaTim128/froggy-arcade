/**
 * The change machine on the back wall.
 *
 * It takes the money the man outside pays you and gives you back half of it in
 * tokens.  That is not a bug in the economy, it is the economy: he buys a two
 * hundred token prize off you for a hundred in notes, and this machine turns
 * that hundred into fifty tokens.  A prize that cost you two hundred to win is
 * worth fifty by the time it is tokens again, and the only way to come out
 * ahead is to stop feeding it and walk out with the cash.
 *
 * Cash leaves through store.spendCash and tokens arrive through the ledger, so
 * neither currency is ever written by the same hand.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { ledger } from '../core/ledger';
import { tokensForCash } from '../game/content';
import { button, centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';

export class ChangeMachine extends Phaser.Scene {
  private from = 'ArcadeHub';
  private body!: Phaser.GameObjects.Container;
  /** How much of the wallet is going in.  Never more than there is. */
  private amount = 0;

  constructor() {
    super('ChangeMachine');
  }

  init(data: { from?: string } = {}): void {
    this.from = data.from ?? 'ArcadeHub';
    this.amount = 0;
  }

  create(): void {
    this.scene.bringToTop();
    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.84).setOrigin(0, 0).setInteractive();
    this.add.rectangle(GAME_W / 2, GAME_H / 2, 250, 140, PALETTE.ink).setStrokeStyle(1, PALETTE.gold);

    centerText(this, GAME_W / 2, 30, 'CHANGE MACHINE', PALETTE.gold);
    centerText(this, GAME_W / 2, 41, 'TOKENS ARE HALF WHAT YOU PUT IN', PALETTE.ash).setAlpha(0.8);

    // Start with everything: most players are here to convert the lot, and the
    // buttons are for the ones who are not.
    this.amount = store.get().cash;
    this.body = this.add.container(0, 0);
    this.render();

    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private render(): void {
    this.body.removeAll(true);
    const cash = store.get().cash;
    this.amount = Phaser.Math.Clamp(this.amount, 0, cash);
    const tokens = tokensForCash(this.amount);

    this.body.add(text(this, 46, 58, `YOU HAVE $${cash}`, PALETTE.mossLight));
    this.body.add(text(this, 46, 70, `TOKENS NOW ${ledger.balance()}`, PALETTE.gold));

    // The trade, spelled out, in the machine's own words — and inside its own
    // panel.  "$260   ->   130 TOKENS" at sixteen pixels a character is 264px
    // wide against a 250px box, so it ran off both ends of the machine: the
    // numbers keep the big font and the words that label them go underneath in
    // the small one, which fits at any amount the wallet can hold.
    this.body.add(centerText(this, GAME_W / 2, 88, `$${this.amount}  ->  ${tokens}`, PALETTE.cream, 16));
    this.body.add(centerText(this, GAME_W / 2, 102, 'CASH IN    ->    TOKENS OUT', PALETTE.ash).setAlpha(0.85));

    this.body.add(button(this, 60, 116, '-10', () => this.bump(-10), { width: 30, height: 13 }));
    this.body.add(button(this, 94, 116, '-1', () => this.bump(-1), { width: 26, height: 13 }));
    this.body.add(button(this, 226, 116, '+1', () => this.bump(1), { width: 26, height: 13 }));
    this.body.add(button(this, 260, 116, '+10', () => this.bump(10), { width: 30, height: 13 }));
    this.body.add(
      button(this, GAME_W / 2, 116, 'ALL', () => this.bump(cash), { width: 36, height: 13 }),
    );

    const canFeed = this.amount >= 2 && this.amount <= cash;
    this.body.add(
      button(this, GAME_W / 2 - 40, 142, 'INSERT', () => this.insert(), {
        width: 64,
        height: 14,
        fill: PALETTE.tealDark,
        disabled: !canFeed,
      }),
    );
    this.body.add(button(this, GAME_W / 2 + 40, 142, 'BACK', () => this.close(), { width: 64, height: 14 }));

    if (cash === 0) {
      this.body.add(
        centerText(this, GAME_W / 2, 130, 'no cash. the man outside pays cash.', PALETTE.ash).setAlpha(0.8),
      );
    }
  }

  private bump(by: number): void {
    const next = Phaser.Math.Clamp(this.amount + by, 0, store.get().cash);
    if (next === this.amount) {
      audio.sfx('buzzer');
      return;
    }
    this.amount = next;
    audio.sfx('ui_blip');
    this.render();
  }

  /** Money in, tokens out, at half.  Both sides go through their own door. */
  private insert(): void {
    const tokens = tokensForCash(this.amount);
    if (tokens <= 0) {
      audio.sfx('buzzer');
      return;
    }
    if (!store.spendCash(this.amount)) {
      audio.sfx('buzzer');
      return;
    }
    ledger.credit(tokens, 'change');
    store.flush();
    audio.sfx('ticket_machine');
    this.amount = store.get().cash;
    this.render();
  }

  private close(): void {
    this.scene.get(this.from)?.events.emit('change-closed');
    this.scene.stop();
  }
}
