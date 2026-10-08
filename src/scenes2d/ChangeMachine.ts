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
import { button, centerText } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { froggyLayer } from '../render/froggyLayer';

export class ChangeMachine extends Phaser.Scene {
  private from = 'ArcadeHub';
  private body!: Phaser.GameObjects.Container;
  /** How much of the wallet is going in.  Never more than there is. */
  private amount = 0;
  /**
   * Whether any cash actually went in while this was open.
   *
   * It goes out with `change-closed`, because what the hub does next depends
   * on it: opening the machine, reading the rate and closing it again is
   * looking at a machine, and looking at a machine is not the thing that has
   * ever been worth anybody's attention.
   */
  private traded = false;

  constructor() {
    super('ChangeMachine');
  }

  init(data: { from?: string } = {}): void {
    this.from = data.from ?? 'ArcadeHub';
    this.amount = 0;
    this.traded = false;
  }

  create(): void {
    this.scene.bringToTop();
    // the smooth overlay (Froggy at the counter) sits above the game canvas:
    // dim him right down so he is not drawn over the panel
    froggyLayer.setVisible(false);
    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.84).setOrigin(0, 0).setInteractive();
    // A big friendly panel: nearly the whole screen, so every number and
    // button is large enough to read and hit on a phone.
    this.add.rectangle(GAME_W / 2, GAME_H / 2, 300, 168, PALETTE.ink).setStrokeStyle(2, PALETTE.gold);
    this.add.rectangle(GAME_W / 2, 18, 300, 22, 0x2a2410).setStrokeStyle(2, PALETTE.gold);
    centerText(this, GAME_W / 2, 18, 'CHANGE MACHINE', PALETTE.gold, 16);

    // Start with everything: most players are here to convert the lot, and the
    // buttons are for the ones who are not.
    this.amount = store.get().cash;
    this.body = this.add.container(0, 0);
    this.render();

    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.input.keyboard?.on('keydown-ENTER', () => this.insert());
    this.input.keyboard?.on('keydown-LEFT', () => this.bump(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.bump(1));
  }

  private render(): void {
    this.body.removeAll(true);
    const cash = store.get().cash;
    this.amount = Phaser.Math.Clamp(this.amount, 0, cash);
    const tokens = tokensForCash(this.amount);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.body.add(o);
      return o;
    };

    // what you have, both currencies, in one line
    add(centerText(this, GAME_W / 2 - 60, 38, `WALLET  $${cash}`, PALETTE.mossLight));
    add(centerText(this, GAME_W / 2 + 60, 38, `TOKENS  ${ledger.balance()}`, PALETTE.gold));
    add(centerText(this, GAME_W / 2, 49, 'EVERY $2 GIVES YOU 1 TOKEN', PALETTE.fog));

    // The trade, as two boxes: what goes in, and what comes out.
    const box = (x: number, label: string, value: string, col: number, fill: number): void => {
      add(this.add.rectangle(x, 76, 112, 38, fill).setStrokeStyle(2, col));
      add(centerText(this, x, 64, label, col));
      add(centerText(this, x, 81, value, PALETTE.cream, 16));
    };
    box(GAME_W / 2 - 72, 'YOU PUT IN', `$${this.amount}`, PALETTE.mossLight, 0x12301a);
    box(GAME_W / 2 + 72, 'YOU GET', `${tokens} TOK`, PALETTE.gold, 0x302a10);
    add(centerText(this, GAME_W / 2, 77, '>', PALETTE.cream, 16));

    // how much: big buttons, minus on the left, plus on the right
    const y = 113;
    const opts = (w: number) => ({ width: w, height: 18 });
    add(button(this, 40, y, '-10', () => this.bump(-10), opts(34)));
    add(button(this, 78, y, '-1', () => this.bump(-1), opts(30)));
    add(button(this, GAME_W / 2, y, 'ALL', () => this.bump(cash), opts(44)));
    add(button(this, GAME_W - 78, y, '+1', () => this.bump(1), opts(30)));
    add(button(this, GAME_W - 40, y, '+10', () => this.bump(10), opts(34)));

    const canFeed = this.amount >= 2 && this.amount <= cash;
    add(
      button(this, GAME_W / 2 - 52, 143, canFeed ? `CHANGE $${this.amount}` : 'CHANGE', () => this.insert(), {
        width: 96,
        height: 22,
        fill: PALETTE.tealDark,
        disabled: !canFeed,
      }),
    );
    add(button(this, GAME_W / 2 + 52, 143, 'BACK', () => this.close(), { width: 96, height: 22 }));

    if (cash < 2) {
      add(
        centerText(this, GAME_W / 2, 163, cash === 0 ? 'No cash. The man outside pays cash.' : 'You need at least $2.', PALETTE.ember),
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
    this.traded = true;
    store.flush();
    audio.sfx('ticket_machine');
    this.amount = store.get().cash;
    this.render();
    // and say so, big, so there is no doubt it worked
    const done = centerText(this, GAME_W / 2, 96, `+${tokens} TOKENS!`, PALETTE.gold, 16).setDepth(10);
    this.tweens.add({ targets: done, y: 88, alpha: 0, delay: 700, duration: 700, onComplete: () => done.destroy() });
  }

  private close(): void {
    froggyLayer.setVisible(true);
    this.scene.get(this.from)?.events.emit('change-closed', this.traded);
    this.scene.stop();
  }
}
