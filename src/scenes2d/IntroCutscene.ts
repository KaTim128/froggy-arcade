/**
 * Intro cutscene.  PRD §7.4.
 *
 * Establishes the fantasy and hands over the only money in the game.  The
 * `seed` credit here is the one and only time tokens appear from nowhere —
 * apart from Froggy's five, and he wants something for those.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { ledger } from '../core/ledger';
import { centerText, fadeIn, fadeToScene } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { paintExterior, startSignFlicker } from '../art/exterior';
import { Player } from '../art/player';
import { froggyLayer } from '../render/froggyLayer';

export const STARTING_TOKENS = 20; // $10 at 50c each.  PRD §10.1.

export class IntroCutscene extends Phaser.Scene {
  private player!: Player;
  private phase: 'walk' | 'enter' | 'change' | 'done' = 'walk';
  private doorX = GAME_W / 2;

  constructor() {
    super('IntroCutscene');
  }

  create(): void {
    froggyLayer.clear();
    fadeIn(this);
    audio.setScene({ music: 'theme_arcade', ambience: ['street_dusk', 'neon_buzz'] });

    const refs = paintExterior(this, { night: false });
    startSignFlicker(this, refs);
    this.doorX = refs.doorX;

    this.player = new Player(this, -10, 168);
    this.phase = 'walk';

    // Esc skips the cutscene — but the tokens are still credited (PRD §7.4).
    this.input.keyboard?.on('keydown-ESC', () => this.finish());
  }

  update(_t: number, delta: number): void {
    if (this.phase === 'walk') {
      this.player.move(1, 0, delta, new Phaser.Geom.Rectangle(-10, 168, GAME_W, 0));
      if (this.player.x >= this.doorX - 4) {
        this.phase = 'enter';
        this.onEnter();
      }
    }
  }

  private onEnter(): void {
    audio.sfx('door_open');
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.changeMachine());
  }

  /** $10 in, twenty froggy-tokens out. */
  private changeMachine(): void {
    this.phase = 'change';
    this.children.removeAll();
    this.cameras.main.fadeIn(300, 0, 0, 0);
    audio.setScene({ music: 'hub_lofi', ambience: ['cabinet_bleeps', 'crowd_hum'] });

    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.plum).setOrigin(0, 0);
    this.add.rectangle(GAME_W / 2, 116, 70, 96, PALETTE.steel).setOrigin(0.5, 1);
    this.add.rectangle(GAME_W / 2, 74, 46, 26, PALETTE.gold).setOrigin(0.5, 1);
    this.add.rectangle(GAME_W / 2, 98, 34, 5, PALETTE.ink).setOrigin(0.5, 1);
    centerText(this, GAME_W / 2, 60, 'CHANGE', PALETTE.ink);

    // the bill goes in
    const bill = this.add.rectangle(GAME_W / 2, 130, 22, 10, PALETTE.mossLight);
    centerText(this, GAME_W / 2, 148, 'your last ten dollars', PALETTE.ash);

    this.tweens.add({
      targets: bill,
      y: 96,
      duration: 900,
      ease: 'Quad.easeIn',
      onComplete: () => {
        bill.destroy();
        audio.sfx('coin_drop');
        this.spillCoins();
      },
    });
  }

  private spillCoins(): void {
    let dropped = 0;
    const timer = this.time.addEvent({
      delay: 70,
      repeat: 11,
      callback: () => {
        dropped++;
        const coin = this.add.circle(GAME_W / 2 + Phaser.Math.Between(-6, 6), 100, 3, PALETTE.gold);
        this.tweens.add({
          targets: coin,
          y: 124 + Phaser.Math.Between(-3, 3),
          x: coin.x + Phaser.Math.Between(-22, 22),
          duration: 400,
          ease: 'Bounce.easeOut',
        });
        audio.sfx('coin_spin');
        if (timer.repeatCount === 0 && dropped >= 12) {
          this.time.delayedCall(500, () => this.finish());
        }
      },
    });
  }

  private finish(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    if (ledger.balance() === 0 && !store.get().seenIntro) {
      ledger.credit(STARTING_TOKENS, 'seed');
    }
    store.flush();
    fadeToScene(this, 'ArcadeHub');
  }
}
