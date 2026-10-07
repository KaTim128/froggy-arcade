/**
 * After he gets you: RESPAWN or LEAVE.
 *
 * Every death in the story comes here instead of starting straight over.  The
 * scene you died in is stopped (which is what tears down a 3D stage) and named
 * in the data, with what to start it with: RESPAWN starts it again from its
 * own retry point, LEAVE goes to the title screen.  The run is saved as it
 * stands either way, and START on the title screen picks it up from the last
 * checkpoint.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio, SILENCE } from '../core/audio';
import { store } from '../core/state';
import { button, centerText } from '../core/ui';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { isTouch } from '../core/device';
import { leaveToMenu } from '../core/pause';

export interface DeathData {
  /** The scene to start again on RESPAWN. */
  key: string;
  /** What to start it with. */
  data?: object;
  /** The line under the title. */
  line?: string;
}

const LINES = ['He found you.', 'He was faster.', 'He got you.', 'Too slow.'];

export class DeathScreen extends Phaser.Scene {
  private death: DeathData = { key: 'StartScreen' };
  private chosen = false;

  constructor() {
    super('DeathScreen');
  }

  init(data: DeathData): void {
    this.death = data?.key ? data : { key: 'StartScreen' };
    this.chosen = false;
  }

  create(): void {
    store.flush();
    froggyLayer.clear();
    audio.setScene(SILENCE);
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.cameras.main.setBackgroundColor(0x000000);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 1).setOrigin(0, 0);

    const title = centerText(this, GAME_W / 2, 56, 'YOU DIED', 0xe8323c, 16).setAlpha(0);
    const line = this.death.line ?? LINES[Math.floor(Math.random() * LINES.length)];
    const sub = centerText(this, GAME_W / 2, 80, line, PALETTE.fog).setAlpha(0);
    const respawn = button(this, GAME_W / 2 - 46, 118, 'RESPAWN', () => this.choose('respawn'), {
      width: 76,
      height: 20,
      fill: 0x3a0c12,
      hoverFill: 0x6a1420,
    });
    const leave = button(this, GAME_W / 2 + 46, 118, 'LEAVE', () => this.choose('leave'), { width: 76, height: 20 });
    const hint = isTouch() ? '' : '[R] RESPAWN    [L] LEAVE';
    const keys = centerText(this, GAME_W / 2, 146, hint, PALETTE.steel).setAlpha(0);
    const saved = centerText(this, GAME_W / 2, 160, 'YOUR PROGRESS IS SAVED.', PALETTE.steel).setAlpha(0);
    for (const b of [respawn, leave]) {
      b.setAlpha(0);
      b.disableInteractive();
    }

    // Up out of the black -- and nothing to press until it is up, so the
    // taps of someone still mashing RUN do not pick for them.
    this.tweens.add({ targets: title, alpha: 1, duration: 700, ease: 'Sine.easeIn' });
    this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: 400 });
    this.tweens.add({
      targets: [respawn, leave, keys, saved],
      alpha: 1,
      duration: 500,
      delay: 800,
      onComplete: () => {
        for (const b of [respawn, leave]) b.setInteractive();
      },
    });
    this.time.delayedCall(900, () => {
      const kb = this.input.keyboard;
      if (!kb) return;
      for (const k of ['R', 'ENTER', 'SPACE']) kb.on(`keydown-${k}`, () => this.choose('respawn'));
      kb.on('keydown-L', () => this.choose('leave'));
    });
  }

  private choose(what: 'respawn' | 'leave'): void {
    if (this.chosen) return;
    this.chosen = true;
    audio.sfx('ui_blip');
    if (what === 'leave') {
      leaveToMenu();
      return;
    }
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () => this.scene.start(this.death.key, this.death.data ?? {}));
  }
}
