/**
 * Arcade hub.  PRD §7.5.
 *
 * Phase 1: the room and a player who can walk around it.
 * Phase 2 adds the cabinets, the HUD, the prize counter, the bell and Froggy.
 */

import Phaser from 'phaser';

import { audio } from '../core/audio';
import { store } from '../core/state';
import { KEYS } from '../core/input';
import { fadeIn } from '../core/ui';
import { paintChangeMachine, paintHubRoom, ROOM } from '../art/hubRoom';
import { Player } from '../art/player';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W } from '../render/pixelScaler';

export class ArcadeHub extends Phaser.Scene {
  private player!: Player;
  private bounds!: Phaser.Geom.Rectangle;
  private keys!: Record<string, Phaser.Input.Keyboard.Key[]>;

  constructor() {
    super('ArcadeHub');
  }

  create(): void {
    froggyLayer.clear();
    fadeIn(this);
    audio.setScene({ music: 'hub_lofi', ambience: ['cabinet_bleeps', 'crowd_hum'] });
    store.flush();

    paintHubRoom(this, { night: false });
    paintChangeMachine(this, false);

    this.bounds = new Phaser.Geom.Rectangle(ROOM.left + 6, ROOM.top + 4, ROOM.right - ROOM.left - 12, ROOM.bottom - ROOM.top - 4);
    this.player = new Player(this, GAME_W / 2, ROOM.bottom - 10);

    this.keys = {
      up: this.bindKeys(KEYS.up),
      down: this.bindKeys(KEYS.down),
      left: this.bindKeys(KEYS.left),
      right: this.bindKeys(KEYS.right),
    };

    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.launch('SettingsModal', { from: 'ArcadeHub' });
    });
  }

  private bindKeys(names: readonly string[]): Phaser.Input.Keyboard.Key[] {
    const kb = this.input.keyboard;
    if (!kb) return [];
    return names.map((n) => kb.addKey(n));
  }

  private held(group: string): boolean {
    return this.keys[group]?.some((k) => k.isDown) ?? false;
  }

  update(_time: number, delta: number): void {
    const dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const dy = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    this.player.move(dx, dy, delta, this.bounds);
  }
}
