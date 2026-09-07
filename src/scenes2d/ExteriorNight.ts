/**
 * Outside, at night.  PRD §7.10 / §7.11.
 *
 * The same illustration as the start screen, run through the palette transform:
 * sign dead, windows black, CLOSED in the door, rain stopped.  Crickets and the
 * occasional car.  No music.
 *
 * Four things to try.  One of them is LEAVE, and taking it is not punished,
 * mocked, or scored (T6).  Nothing on this screen pushes the player toward the
 * alley — they go because they are broke and they want the prize.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { prizeById } from '../game/content';
import { KEYS } from '../core/input';
import { centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { paintExterior } from '../art/exterior';
import { Player } from '../art/player';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W } from '../render/pixelScaler';

const WALK_Y = 166;
type Spot = 'door' | 'kid' | 'leave' | 'alley' | null;

export class ExteriorNight extends Phaser.Scene {
  private player!: Player;
  private keys!: Record<string, Phaser.Input.Keyboard.Key[]>;
  private prompt!: Phaser.GameObjects.BitmapText;
  private promptPlate!: Phaser.GameObjects.Rectangle;
  private mutter!: Phaser.GameObjects.BitmapText;
  private spot: Spot = null;
  private doorX = GAME_W / 2;
  private locked = false;
  private rattles = 0;

  constructor() {
    super('ExteriorNight');
  }

  create(): void {
    froggyLayer.clear();
    // Scene instances are reused; reset everything mutable.
    this.locked = false;
    this.spot = null;
    this.rattles = 0;

    fadeIn(this);
    // No music.  Crickets, wind, and a car every twenty seconds or so.
    audio.setScene({ ambience: ['crickets', 'wind_low', 'car_passby'] });

    const refs = paintExterior(this, { night: true });
    this.doorX = refs.doorX;

    // CLOSED, hanging in the door
    this.add.rectangle(this.doorX, 118, 26, 10, PALETTE.bone).setOrigin(0.5, 0);
    centerText(this, this.doorX, 120, 'CLOSED', PALETTE.blood).setOrigin(0.5, 0);

    // the alley, right edge, barely lit
    this.add.rectangle(GAME_W - 14, 96, 14, 84, PALETTE.black).setOrigin(0, 0);
    text(this, GAME_W - 13, 150, '>', PALETTE.ash, 8);

    // the LEAVE arrow, left edge.  Plain.  No emphasis, no warning.
    text(this, 4, 150, '<', PALETTE.ash, 8);
    text(this, 3, 160, 'LEAVE', PALETTE.ash, 8);

    this.paintKid();

    this.player = new Player(this, this.doorX - 50, WALK_Y, true);
    this.player.setSurface('concrete');

    this.promptPlate = this.add.rectangle(0, 0, 4, 12, PALETTE.black, 0.75).setDepth(800).setVisible(false);
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setOrigin(0.5, 0.5).setDepth(801).setVisible(false);
    this.mutter = text(this, GAME_W / 2, 140, '', PALETTE.fog).setOrigin(0.5, 0.5).setDepth(802).setVisible(false);

    this.keys = {
      left: this.bind(KEYS.left),
      right: this.bind(KEYS.right),
    };
    this.input.keyboard?.on('keydown-E', () => this.interact());
    this.input.on('pointerdown', () => this.interact());
    this.input.keyboard?.on('keydown-ESC', () => this.scene.launch('SettingsModal', {}));

    store.flush();
  }

  private paintKid(): void {
    const kx = 292;
    // under the streetlight, holding a fistful of crumpled bills
    this.add.rectangle(kx, 158, 8, 14, PALETTE.nightLight).setOrigin(0.5, 1);
    this.add.rectangle(kx, 144, 7, 7, PALETTE.moon).setOrigin(0.5, 1);
    this.add.rectangle(kx + 5, 150, 4, 3, PALETTE.mossLight).setOrigin(0.5, 1);
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
      case 'door': {
        // Permanently locked.  No state anywhere can change this. (AC-4)
        audio.sfx('door_rattle');
        this.rattles++;
        if (this.rattles >= 3) this.say('...it was never going to open.');
        else this.say('locked.');
        break;
      }
      case 'kid':
        this.sellToKid();
        break;
      case 'leave':
        this.locked = true;
        fadeToScene(this, 'EndCard', { title: 'You went home.', quiet: true });
        break;
      case 'alley':
        this.locked = true;
        fadeToScene(this, 'BackAlley');
        break;
    }
  }

  /** PRD §7.11 — the good ending, if there is anything to sell. */
  private sellToKid(): void {
    const owned = store.get().prizesOwned;
    if (owned.length === 0) {
      this.say('"You didn\'t win anything?  ...I\'ll wait."');
      return;
    }
    const prize = prizeById(owned[owned.length - 1]);
    this.locked = true;
    this.say(`"...is that a real one?  ...Okay.  Okay, yeah."`);
    audio.sfx('coin_drop');
    this.time.delayedCall(2200, () =>
      fadeToScene(this, 'EndCard', {
        title: 'You ate that night.',
        sub: prize ? `you sold the ${prize.name.toLowerCase()}` : undefined,
        quiet: true,
      }),
    );
  }

  private say(msg: string): void {
    this.mutter.setText(msg).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.mutter);
    this.tweens.add({ targets: this.mutter, alpha: 0, delay: 1800, duration: 600 });
  }

  update(_t: number, delta: number): void {
    if (this.locked) return;

    const dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    this.player.move(dx, 0, delta, new Phaser.Geom.Rectangle(6, WALK_Y, GAME_W - 12, 0));

    const px = this.player.x;
    this.spot =
      px > GAME_W - 26
        ? 'alley'
        : px < 16
          ? 'leave'
          : Math.abs(px - 292) < 18
            ? 'kid'
            : Math.abs(px - this.doorX) < 22
              ? 'door'
              : null;

    if (!this.spot) {
      this.prompt.setVisible(false);
      this.promptPlate.setVisible(false);
      return;
    }

    const label =
      this.spot === 'alley'
        ? '[E] ALLEY'
        : this.spot === 'leave'
          ? '[E] LEAVE'
          : this.spot === 'kid'
            ? '[E] TALK'
            : '[E] DOOR';
    const x = Phaser.Math.Clamp(px, 40, GAME_W - 40);
    this.prompt.setText(label).setPosition(x, WALK_Y - 34).setVisible(true);
    this.promptPlate
      .setPosition(x, WALK_Y - 34)
      .setSize(this.prompt.width + 6, 11)
      .setVisible(true);
  }
}
