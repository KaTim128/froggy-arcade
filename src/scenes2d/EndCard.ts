/**
 * End cards and the reset.  PRD §7.17 / §7.19 / AC-9.
 *
 * Every ending lands here.  After 15 seconds the run is wiped and the settings
 * are kept, and the game returns to a start screen where the arcade is warm and
 * lit and the sign is buzzing again.
 *
 * The quiet ending gets no music, no sting, no score and no commentary.  The
 * player who walked away is not the loser of this game.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio, SILENCE } from '../core/audio';
import { store } from '../core/state';
import { centerText } from '../core/ui';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W, GAME_H } from '../render/pixelScaler';

export const RESET_DELAY_MS = 15_000;

export interface EndCardData {
  title?: string;
  sub?: string;
  /** No sting, no flourish. */
  quiet?: boolean;
  /** Skip the reset (used by the death card, which resets immediately). */
  noReset?: boolean;
}

export class EndCard extends Phaser.Scene {
  private card: EndCardData = {};

  constructor() {
    super('EndCard');
  }

  init(data: EndCardData): void {
    this.card = data ?? {};
  }

  create(): void {
    froggyLayer.clear();
    audio.setScene(this.card.quiet ? SILENCE : { ambience: ['wind_low'] });

    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black).setOrigin(0, 0);
    this.cameras.main.fadeIn(900, 0, 0, 0);

    const title = this.card.title ?? 'End';
    const t = centerText(this, GAME_W / 2, GAME_H / 2 - 4, title, PALETTE.cream, title === 'End' ? 24 : 12);
    t.setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 1200, delay: 400 });

    if (this.card.sub) {
      const s = centerText(this, GAME_W / 2, GAME_H / 2 + 16, this.card.sub, PALETTE.ash, 8).setAlpha(0);
      this.tweens.add({ targets: s, alpha: 0.8, duration: 1000, delay: 1400 });
    }

    store.flush();

    if (this.card.noReset) return;

    // PRD §7.17: fifteen seconds.  A click does not skip the wait.
    this.time.delayedCall(RESET_DELAY_MS, () => {
      store.resetRun(); // wipes froggy.run, keeps froggy.prefs
      this.scene.start('Boot');
    });
  }
}
