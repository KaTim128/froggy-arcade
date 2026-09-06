/**
 * The ejection.  PRD §7.9.
 *
 * The player character walks to the door without input, at a constant pace,
 * dragged by nothing visible.  The camera does not move.  `route = 'ejected'`
 * is committed here, and the front door never opens again (AC-4).
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio, SILENCE } from '../core/audio';
import { commitEjection } from '../core/broke';
import { fadeToScene } from '../core/ui';
import { paintChangeMachine, paintHubRoom, ROOM } from '../art/hubRoom';
import { Player } from '../art/player';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W, GAME_H } from '../render/pixelScaler';

const WALK_SPEED = 34; // deliberately slower than the player's own walk

export class EjectionCutscene extends Phaser.Scene {
  private player!: Player;
  private done = false;

  constructor() {
    super('EjectionCutscene');
  }

  create(): void {
    froggyLayer.clear();
    this.cameras.main.fadeIn(200, 0, 0, 0);
    audio.setScene(SILENCE);

    paintHubRoom(this, { night: false });
    paintChangeMachine(this, false);
    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.3).setOrigin(0, 0).setDepth(700);

    this.player = new Player(this, GAME_W / 2 - 40, ROOM.bottom - 40);
  }

  update(_t: number, delta: number): void {
    if (this.done) return;

    const target = { x: GAME_W / 2, y: GAME_H - 12 };
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const d = Math.hypot(dx, dy);

    if (d < 2) {
      this.done = true;
      this.onDoor();
      return;
    }

    const step = (WALK_SPEED * delta) / 1000;
    this.player.setPosition(this.player.x + (dx / d) * step, this.player.y + (dy / d) * step);
  }

  private onDoor(): void {
    audio.sfx('door_open');
    this.time.delayedCall(500, () => {
      this.player.sprite.setVisible(false);
      audio.sfx('door_shut');
      this.time.delayedCall(400, () => {
        audio.sfx('lock_click');
        commitEjection(); // route = 'ejected'
        this.time.delayedCall(1500, () => fadeToScene(this, 'ExteriorNight'));
      });
    });
  }
}
