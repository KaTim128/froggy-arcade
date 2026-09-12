/**
 * Selling to the man.
 *
 * One row per prize you are carrying, and every row says the same two numbers:
 * what the counter charged you in tokens, and what he will hand over in cash.
 * The second is always half the first, and the screen shows both side by side
 * so the deal is legible rather than merely accepted — the player should be
 * able to see they are being fleeced and take it anyway.
 *
 * Prizes already sold stay listed, greyed, with what they went for.  Nothing
 * here touches the token ledger: cash arrives through store.earnCash and lives
 * in its own column of the save.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { PRIZES, cashFor, type PrizeDef } from '../game/content';
import { button, centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';

export class PrizeExchange extends Phaser.Scene {
  private from = 'ExteriorDay';
  private body!: Phaser.GameObjects.Container;
  /** Which row is selected, as an index into the carried list. */
  private picked: string | null = null;

  constructor() {
    super('PrizeExchange');
  }

  init(data: { from?: string } = {}): void {
    this.from = data.from ?? 'ExteriorDay';
    this.picked = null;
  }

  create(): void {
    this.scene.bringToTop();
    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.84).setOrigin(0, 0).setInteractive();
    this.add.rectangle(GAME_W / 2, GAME_H / 2, 286, 162, PALETTE.ink).setStrokeStyle(1, PALETTE.mossLight);

    centerText(this, GAME_W / 2, 18, 'WHAT HAVE YOU GOT?', PALETTE.mossLight);
    centerText(this, GAME_W / 2, 29, 'he pays half of what the counter charges', PALETTE.ash).setAlpha(0.75);

    this.body = this.add.container(0, 0);
    this.render();

    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private render(): void {
    this.body.removeAll(true);
    const s = store.get();
    const carried = PRIZES.filter((p) => s.prizesOwned.includes(p.id));

    // Column headings, so the two numbers are never mistaken for each other.
    // They sit above the first row rather than on it: the list is seven long
    // now and it starts higher up the panel than it used to.
    this.body.add(text(this, 30, 37, 'PRIZE', PALETTE.ash));
    this.body.add(text(this, 150, 37, 'COST', PALETTE.ash));
    this.body.add(text(this, 196, 37, 'HE PAYS', PALETTE.ash));

    if (carried.length === 0) {
      this.body.add(
        centerText(this, GAME_W / 2, 92, 'you are not carrying anything', PALETTE.fog).setAlpha(0.8),
      );
    }

    // Everything you are carrying, not the first five of it: the shelf is
    // seven things long now and a truncated list hides prizes you own.
    carried.slice(0, PRIZES.length).forEach((p, i) => {
      const y = 48 + i * 13;
      const sold = s.prizesSold.includes(p.id);
      const cash = cashFor(p);

      this.body.add(this.add.rectangle(30, y, 11, 11, p.color).setOrigin(0, 0).setAlpha(sold ? 0.35 : 1));
      this.body.add(text(this, 46, y + 2, p.name, sold ? PALETTE.steel : PALETTE.cream));
      this.body.add(text(this, 150, y + 2, `${p.cost}`, sold ? PALETTE.steel : PALETTE.gold));
      this.body.add(text(this, 200, y + 2, `$${cash}`, sold ? PALETTE.steel : PALETTE.mossLight));

      if (sold) {
        this.body.add(text(this, 250, y + 2, 'SOLD', PALETTE.steel));
        return;
      }
      this.body.add(
        button(this, 266, y + 6, this.picked === p.id ? 'SURE?' : 'SELL', () => this.pick(p), {
          width: 40,
          height: 12,
          fill: this.picked === p.id ? PALETTE.moss : PALETTE.plum,
        }),
      );
    });

    // The line under the table: what the pick in front of you is worth, spelled
    // out, before it is gone.
    const pick = PRIZES.find((p) => p.id === this.picked);
    this.body.add(
      centerText(
        this,
        GAME_W / 2,
        146,
        pick
          ? `${pick.name}: ${pick.cost} TOKENS  ->  $${cashFor(pick)} CASH`
          : `you have $${s.cash}`,
        pick ? PALETTE.gold : PALETTE.fog,
      ),
    );

    this.body.add(button(this, GAME_W / 2, 160, 'DONE', () => this.close(), { width: 60, height: 13 }));
  }

  /**
   * First click names the price, second click takes it.  Selling is the only
   * one-way door in the daytime half of the game, so it asks.
   */
  private pick(p: PrizeDef): void {
    if (this.picked !== p.id) {
      this.picked = p.id;
      audio.sfx('ui_blip');
      this.render();
      return;
    }
    this.sell(p);
  }

  private sell(p: PrizeDef): void {
    const s = store.get();
    if (!s.prizesOwned.includes(p.id) || s.prizesSold.includes(p.id)) return;

    store.earnCash(cashFor(p));
    store.patch({ prizesSold: [...s.prizesSold, p.id] });
    store.flush();
    audio.sfx('coin_spin');
    this.picked = null;
    this.render();
  }

  private close(): void {
    this.scene.get(this.from)?.events.emit('exchange-closed');
    this.scene.stop();
  }
}
