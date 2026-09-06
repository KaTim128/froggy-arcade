/**
 * Inside, dark.  PRD §7.13.
 *
 * The exact hub layout, unlit.  The player spent eight minutes in this room
 * while it was warm and loud; now the cabinets are silhouettes and the only
 * light is the moon through the front windows.
 *
 * AD-1 / THE SILENCE CONTRACT (QFD C3, a hard constraint from the customer):
 * this scene declares NO audio.  Zero sources instantiated — not muted, not
 * faded, not created.  Footsteps are one-shots, and they are the only sound in
 * the building.  Do not add a drone.  Do not add a stinger.  The silence is the
 * design, and it is the single strongest device in the second half.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio, SILENCE } from '../core/audio';
import { store } from '../core/state';
import { KEYS } from '../core/input';
import { fadeIn, fadeToScene, text } from '../core/ui';
import { paintChangeMachine, paintHubRoom, ROOM } from '../art/hubRoom';
import { Cabinet } from '../art/cabinet';
import { Player } from '../art/player';
import { CABINETS, COUNTER, COUNTER_VAULT, PRIZE_CASE, STAFF_DOOR } from '../game/content';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W, GAME_H } from '../render/pixelScaler';

type Spot = 'door' | 'case' | 'counter' | 'staff' | null;

export class ArcadeDark extends Phaser.Scene {
  private player!: Player;
  private keys!: Record<string, Phaser.Input.Keyboard.Key[]>;
  private prompt!: Phaser.GameObjects.Text;
  private promptPlate!: Phaser.GameObjects.Rectangle;
  private mutter!: Phaser.GameObjects.Text;
  private spot: Spot = null;
  private behindCounter = false;
  private locked = false;
  private staffDoor!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('ArcadeDark');
  }

  create(): void {
    froggyLayer.clear();
    fadeIn(this);

    // No music.  No ambience.  Nothing.
    audio.setScene(SILENCE);

    paintHubRoom(this, { night: true });
    paintChangeMachine(this, true);
    for (const def of CABINETS) new Cabinet(this, def, true);

    // counter and case, dead
    this.add.rectangle(COUNTER.x, COUNTER.y, COUNTER.w, COUNTER.h, PALETTE.ink).setOrigin(0, 0);
    this.add.rectangle(COUNTER.x, COUNTER.y, COUNTER.w, 2, PALETTE.slate).setOrigin(0, 0);
    this.add
      .rectangle(PRIZE_CASE.x, PRIZE_CASE.y - 30, PRIZE_CASE.w, 30, PALETTE.black)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.slate);

    // the STAFF door, behind the counter
    this.staffDoor = this.add
      .rectangle(STAFF_DOOR.x, 14, 22, 32, PALETTE.nightMid)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.slate);
    text(this, STAFF_DOOR.x + 1, 26, 'STAFF', PALETTE.ash, 8).setAlpha(0.8);

    this.player = new Player(this, GAME_W / 2, ROOM.bottom - 14, true);
    this.player.setSurface('concrete');

    this.promptPlate = this.add.rectangle(0, 0, 4, 12, PALETTE.black, 0.8).setDepth(800).setVisible(false);
    this.prompt = text(this, 0, 0, '', PALETTE.moon).setOrigin(0.5, 0.5).setDepth(801).setVisible(false);
    this.mutter = text(this, GAME_W / 2, GAME_H - 30, '', PALETTE.fog)
      .setOrigin(0.5, 0.5)
      .setDepth(802)
      .setVisible(false);

    this.keys = {
      up: this.bind(KEYS.up),
      down: this.bind(KEYS.down),
      left: this.bind(KEYS.left),
      right: this.bind(KEYS.right),
    };
    this.input.keyboard?.on('keydown-E', () => this.interact());
    this.input.on('pointerdown', () => this.interact());

    store.flush();
  }

  private bind(names: readonly string[]): Phaser.Input.Keyboard.Key[] {
    const kb = this.input.keyboard;
    return kb ? names.map((n) => kb.addKey(n)) : [];
  }

  private held(g: string): boolean {
    return this.keys[g]?.some((k) => k.isDown) ?? false;
  }

  private interact(): void {
    if (this.locked || !this.spot) return;

    switch (this.spot) {
      case 'door':
        // AD-3: it does not open from this side either.
        audio.sfx('door_rattle');
        this.say('locked from the inside too.');
        break;

      case 'case':
        if (store.get().hasKey) {
          this.say('the case is open. the bunny is gone.');
        } else {
          this.say('IT NEEDS A KEY.');
        }
        break;

      case 'counter':
        // AD-5: the interaction the arcade never offered while it was open.
        audio.sfx('vault');
        this.behindCounter = true;
        this.player.setPosition(COUNTER.x + COUNTER.w / 2, COUNTER.y - 6);
        this.say('');
        break;

      case 'staff': {
        this.locked = true;
        audio.sfx('door_creak');
        this.staffDoor.setFillStyle(PALETTE.black);
        store.patch({ route: 'basement' });
        store.flush();
        this.time.delayedCall(1400, () => fadeToScene(this, 'BasementSequence'));
        break;
      }
    }
  }

  private say(msg: string): void {
    if (!msg) {
      this.mutter.setVisible(false);
      return;
    }
    this.mutter.setText(msg).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.mutter);
    this.tweens.add({ targets: this.mutter, alpha: 0, delay: 1800, duration: 600 });
  }

  update(_t: number, delta: number): void {
    if (this.locked) return;

    const dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const dy = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);

    const bounds = this.behindCounter
      ? new Phaser.Geom.Rectangle(COUNTER.x, 20, COUNTER.w, COUNTER.y - 24)
      : new Phaser.Geom.Rectangle(ROOM.left + 8, ROOM.top + 6, ROOM.right - ROOM.left - 16, ROOM.bottom - ROOM.top - 6);
    this.player.move(dx, dy, delta, bounds);

    const px = this.player.x;
    const py = this.player.y;

    if (this.behindCounter) {
      this.spot = Math.abs(px - (STAFF_DOOR.x + 11)) < 20 && py < 56 ? 'staff' : null;
    } else if (py > ROOM.bottom - 24 && Math.abs(px - GAME_W / 2) < 26) {
      this.spot = 'door';
    } else if (py < COUNTER.y + 30 && px > PRIZE_CASE.x && px < PRIZE_CASE.x + PRIZE_CASE.w) {
      this.spot = 'case';
    } else if (py < COUNTER.y + 32 && Math.abs(px - COUNTER_VAULT.x) < 40) {
      this.spot = 'counter';
    } else {
      this.spot = null;
    }

    if (!this.spot) {
      this.prompt.setVisible(false);
      this.promptPlate.setVisible(false);
      return;
    }

    const label =
      this.spot === 'door'
        ? '[E] FRONT DOOR'
        : this.spot === 'case'
          ? '[E] PRIZE CASE'
          : this.spot === 'counter'
            ? '[E] CLIMB OVER'
            : '[E] STAFF';
    const x = Phaser.Math.Clamp(px, 50, GAME_W - 50);
    this.prompt.setText(label).setPosition(x, py - 32).setVisible(true);
    this.promptPlate
      .setPosition(x, py - 32)
      .setSize(this.prompt.width + 6, 11)
      .setVisible(true);
  }
}
