/**
 * Outside, at night.  PRD §7.10 / §7.11.
 *
 * The same illustration as the start screen, run through the palette transform:
 * sign dead, windows black, CLOSED in the door, rain stopped.  Crickets and the
 * occasional car.  No music.
 *
 * Two things to try, and only one of them goes anywhere: the front door, which
 * is locked and stays locked, and the alley down the side.
 *
 * There used to be a third — LEAVE, off the left of the screen, which ended the
 * run quietly — and a kid under the streetlight who would buy a prize off you.
 * Both are gone.  The man in the hat buys the prizes now, in daylight, and a
 * man who has been sleeping on this street for seven months has nowhere to
 * leave TO: no home, no car, no bus fare.  The back door is the only way this
 * night goes anywhere.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { KEYS } from '../core/input';
import { centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { paintExterior } from '../art/exterior';
import { Player } from '../art/player';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W } from '../render/pixelScaler';

const WALK_Y = 166;
type Spot = 'door' | 'alley' | null;

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
      case 'alley':
        this.locked = true;
        fadeToScene(this, 'BackAlley');
        break;
    }
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
      px > GAME_W - 26 ? 'alley' : Math.abs(px - this.doorX) < 22 ? 'door' : null;

    if (!this.spot) {
      this.prompt.setVisible(false);
      this.promptPlate.setVisible(false);
      return;
    }

    const label = this.spot === 'alley' ? '[E] ALLEY' : '[E] DOOR';
    const x = Phaser.Math.Clamp(px, 40, GAME_W - 40);
    this.prompt.setText(label).setPosition(x, WALK_Y - 34).setVisible(true);
    this.promptPlate
      .setPosition(x, WALK_Y - 34)
      .setSize(this.prompt.width + 6, 11)
      .setVisible(true);
  }
}
