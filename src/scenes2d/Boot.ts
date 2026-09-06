/**
 * Boot.  PRD §7.1.
 *
 * Also the audio unlock gate (EC-9): browsers will not start an AudioContext
 * until the player interacts, so we ask for one click before anything else.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { centerText, fadeToScene } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { froggyLayer } from '../render/froggyLayer';

const MIN_BOOT_MS = 800;

export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    froggyLayer.clear();
    this.cameras.main.setBackgroundColor(PALETTE.black);

    // A small frog silhouette.  Not Froggy — just a shape.
    const g = this.add.graphics();
    g.fillStyle(PALETTE.moss, 1);
    g.fillRoundedRect(GAME_W / 2 - 14, GAME_H / 2 - 26, 28, 20, 8);
    g.fillCircle(GAME_W / 2 - 8, GAME_H / 2 - 24, 5);
    g.fillCircle(GAME_W / 2 + 8, GAME_H / 2 - 24, 5);

    const barW = 96;
    const barX = GAME_W / 2 - barW / 2;
    const barY = GAME_H / 2 + 4;
    this.add.rectangle(barX, barY, barW, 3, PALETTE.slate).setOrigin(0, 0.5);
    const fill = this.add.rectangle(barX, barY, 0, 3, PALETTE.amber).setOrigin(0, 0.5);

    const started = this.time.now;
    this.tweens.add({
      targets: fill,
      width: barW,
      duration: MIN_BOOT_MS,
      ease: 'Linear',
      onComplete: () => this.showGate(started),
    });
  }

  private showGate(_started: number): void {
    if (audio.isUnlocked()) {
      fadeToScene(this, 'StartScreen');
      return;
    }

    const prompt = centerText(this, GAME_W / 2, GAME_H / 2 + 22, 'CLICK TO BEGIN', PALETTE.cream);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    this.input.once('pointerdown', () => {
      audio.unlock();
      audio.applyVolumes();
      store.flush();
      fadeToScene(this, 'StartScreen');
    });
  }
}
