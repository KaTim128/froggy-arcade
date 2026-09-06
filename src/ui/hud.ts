/**
 * Token HUD.  PRD §6.8 / QFD B8.
 *
 * Coin-spin within 100ms of the ledger event; red pulse at <= 3 tokens.
 * Present in the hub and the minigames.  Absent in every Act III-VI scene —
 * once the arcade closes, there is nothing left to count.
 */

import Phaser from 'phaser';
import { PALETTE, css } from '../render/palette';
import { audio } from '../core/audio';
import { ledger } from '../core/ledger';

export const LOW_TOKEN_THRESHOLD = 3;

export class TokenHud {
  private scene: Phaser.Scene;
  private coin: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.Text;
  private container: Phaser.GameObjects.Container;
  private unsub: () => void;
  private pulse?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const plate = scene.add.rectangle(0, 0, 54, 14, PALETTE.black, 0.55).setOrigin(0, 0);
    this.coin = scene.add.circle(10, 7, 4, PALETTE.gold);
    this.label = scene.add
      .text(19, 3, '', { fontFamily: 'monospace', fontSize: '8px', color: css(PALETTE.cream) })
      .setResolution(1);

    this.container = scene.add.container(4, 4, [plate, this.coin, this.label]);
    this.container.setDepth(950).setScrollFactor(0);

    this.unsub = ledger.onChange((next, prev) => this.onChange(next, prev));
    this.refresh(ledger.balance());

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsub());
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
    this.label.setText(`${v}`.padStart(3, ' ') + ' TOK');

    const low = v <= LOW_TOKEN_THRESHOLD;
    this.label.setColor(css(low ? PALETTE.blood : PALETTE.cream));
    this.coin.setFillStyle(low ? PALETTE.ember : PALETTE.gold);

    if (low && !this.pulse) {
      this.pulse = this.scene.tweens.add({
        targets: this.container,
        alpha: 0.45,
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    } else if (!low && this.pulse) {
      this.pulse.stop();
      this.pulse = undefined;
      this.container.setAlpha(1);
    }
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v);
  }
}
