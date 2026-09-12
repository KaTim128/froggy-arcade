/**
 * Prize counter.  PRD §7.6.
 *
 * The cheapest prize is 200 tokens.  The player started with 20.  The grid is
 * mostly there to be looked at, and the PS5 is there to be looked at hardest.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { ledger } from '../core/ledger';
import { PRIZES } from '../game/content';
import { button, centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';

export class PrizeCounter extends Phaser.Scene {
  private rows: Array<() => void> = [];

  constructor() {
    super('PrizeCounter');
  }

  create(): void {
    this.rows = [];
    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.85).setOrigin(0, 0).setInteractive();
    this.add.rectangle(GAME_W / 2, GAME_H / 2 - 2, 276, 164, PALETTE.ink).setStrokeStyle(1, PALETTE.gold);

    centerText(this, GAME_W / 2, 17, 'PRIZE COUNTER', PALETTE.gold);
    centerText(this, GAME_W / 2, 27, 'no attendant', PALETTE.ash).setAlpha(0.6);

    // Nine rows on a 180px screen: the pitch is what the shelf can hold, and
    // the last REDEEM has to clear the BACK button.
    PRIZES.forEach((p, i) => {
      const y = 37 + i * 13;
      this.add.rectangle(34, y, 11, 11, p.color).setOrigin(0, 0);
      const name = text(this, 52, y + 2, p.name, PALETTE.cream);
      const cost = text(this, 186, y + 2, `${p.cost}`, PALETTE.gold);

      const owned = store.get().prizesOwned.includes(p.id);
      const btn = button(
        this,
        250,
        y + 5,
        owned ? 'OWNED' : 'REDEEM',
        () => this.redeem(p.id, p.cost),
        { width: 52, height: 12, disabled: owned || !ledger.canAfford(p.cost) },
      );

      const refresh = () => {
        const isOwned = store.get().prizesOwned.includes(p.id);
        const can = ledger.canAfford(p.cost);
        name.setTint(isOwned ? PALETTE.tealLight : can ? PALETTE.cream : PALETTE.ash);
        cost.setTint(can || isOwned ? PALETTE.gold : PALETTE.steel);
        btn.setAlpha(isOwned || can ? 1 : 0.55);
      };
      refresh();
      this.rows.push(refresh);
    });

    button(this, GAME_W / 2, 166, 'BACK', () => this.close(), { width: 60, height: 12 });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  /** PRD PC-2/PC-3: redemption does not end the game.  The player keeps playing. */
  private redeem(id: string, cost: number): void {
    if (store.get().prizesOwned.includes(id)) return;
    if (!ledger.debit(cost, 'prize')) {
      audio.sfx('buzzer');
      return;
    }
    store.patch({ prizesOwned: [...store.get().prizesOwned, id] });
    store.flush();
    audio.sfx('ticket_machine');
    for (const r of this.rows) r();
    this.scene.restart();
  }

  private close(): void {
    this.scene.get('ArcadeHub')?.events.emit('prize-closed');
    this.scene.stop();
  }
}
