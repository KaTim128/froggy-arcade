/**
 * Token HUD.  PRD §6.8 / QFD B8.
 *
 * Coin-spin within 100ms of the ledger event; red pulse at <= 3 tokens.
 * Present in the hub and the minigames.  Absent in every Act III-VI scene —
 * once the arcade closes, there is nothing left to count.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { ledger } from '../core/ledger';
import { text } from '../core/ui';
import { store } from '../core/state';

export const LOW_TOKEN_THRESHOLD = 3;

/** Left edge of the label, clear of the coin (within the token plate). */
const LABEL_X = 15;

export class TokenHud {
  private scene: Phaser.Scene;
  private cashPlate: Phaser.GameObjects.Rectangle;
  private cashLabel: Phaser.GameObjects.BitmapText;
  private tokens: Phaser.GameObjects.Container;
  private plate: Phaser.GameObjects.Rectangle;
  private coin: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.BitmapText;
  private container: Phaser.GameObjects.Container;
  private unsub: () => void;
  private pulse?: Phaser.Tweens.Tween;
  private lastCash = -1;

  /**
   * Cash on the left, tokens beside it: the two currencies side by side and
   * never added together.  `x`/`y` move the pair (a street whose top left is
   * taken by a sign puts it elsewhere).
   */
  constructor(scene: Phaser.Scene, at: { x?: number; y?: number } = {}) {
    this.scene = scene;

    this.cashPlate = scene.add.rectangle(0, 0, 30, 14, PALETTE.black, 0.75).setOrigin(0, 0);
    this.cashLabel = text(scene, 5, 3, '', PALETTE.mossLight);

    this.plate = scene.add.rectangle(0, 0, 54, 14, PALETTE.black, 0.75).setOrigin(0, 0);
    this.coin = scene.add.circle(7, 7, 4, PALETTE.gold);
    this.label = text(scene, LABEL_X, 3, '', PALETTE.cream);
    this.tokens = scene.add.container(0, 0, [this.plate, this.coin, this.label]);

    this.container = scene.add.container(at.x ?? 4, at.y ?? 4, [this.cashPlate, this.cashLabel, this.tokens]);
    this.container.setDepth(950).setScrollFactor(0);

    this.unsub = ledger.onChange((next, prev) => this.onChange(next, prev));
    const unStore = store.subscribe((st) => {
      if (st.cash !== this.lastCash) this.refreshCash(st.cash);
    });
    this.refreshCash(store.get().cash);
    this.refresh(ledger.balance());

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsub();
      unStore();
    });
  }

  private refreshCash(cash: number): void {
    this.lastCash = cash;
    this.cashLabel.setText(`$${cash}`);
    this.cashPlate.setSize(this.cashLabel.width + 10, 14);
    this.tokens.x = this.cashPlate.width + 3;
  }

  private onChange(next: number, prev: number): void {
    this.refresh(next);
    // Coin-spin: squash the coin on its Y axis, which reads as a spin at 4px.
    this.scene.tweens.add({
      targets: this.coin,
      scaleX: 0.1,
      duration: 90,
      yoyo: true,
      repeat: 1,
      ease: 'Quad.easeInOut',
    });
    audio.sfx(next > prev ? 'coin_spin' : 'coin_drop');
  }

  private refresh(v: number): void {
    this.label.setText(`${v} TOK`);
    // The plate tracks the label rather than assuming a width: a four-digit
    // balance is reachable, and the old fixed 54px clipped the K off ' TOK'.
    this.plate.setSize(LABEL_X + this.label.width + 5, 14);

    const low = v <= LOW_TOKEN_THRESHOLD;
    this.label.setTint(low ? PALETTE.blood : PALETTE.cream);
    this.coin.setFillStyle(low ? PALETTE.ember : PALETTE.gold);

    if (low && !this.pulse) {
      this.pulse = this.scene.tweens.add({
        targets: this.tokens,
        alpha: 0.45,
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    } else if (!low && this.pulse) {
      this.pulse.stop();
      this.pulse = undefined;
      this.tokens.setAlpha(1);
    }
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v);
  }
}
