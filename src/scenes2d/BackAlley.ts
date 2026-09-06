/**
 * The alley.  PRD §7.12.
 *
 * A dumpster, a fire escape, and a back door standing ajar with a sliver of
 * black behind it.  BA-1: the door is a plain [E] like everything else.  No
 * prompt escalates.  Nothing flashes.  The player can walk back out at any
 * time, including from right in front of it.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { KEYS } from '../core/input';
import { fadeIn, fadeToScene, text } from '../core/ui';
import { Player } from '../art/player';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W, GAME_H } from '../render/pixelScaler';

const WALK_Y = 168;
const DOOR_X = 236;

export class BackAlley extends Phaser.Scene {
  private player!: Player;
  private keys!: Record<string, Phaser.Input.Keyboard.Key[]>;
  private prompt!: Phaser.GameObjects.Text;
  private spot: 'door' | 'out' | null = null;
  private locked = false;

  constructor() {
    super('BackAlley');
  }

  create(): void {
    froggyLayer.clear();
    // Scene instances are reused; reset everything mutable.
    this.locked = false;
    this.spot = null;

    fadeIn(this);
    audio.setScene({ ambience: ['wind_low', 'crickets'] });

    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.night).setOrigin(0, 0);
    // brick walls closing in on both sides
    this.add.rectangle(0, 0, 40, GAME_H, PALETTE.black).setOrigin(0, 0);
    this.add.rectangle(GAME_W - 26, 0, 26, GAME_H, PALETTE.black).setOrigin(0, 0);
    this.add.rectangle(40, 0, GAME_W - 66, 150, PALETTE.nightMid).setOrigin(0, 0);
    for (let i = 0; i < 9; i++) {
      this.add.rectangle(44 + i * 28, 14 + (i % 2) * 8, 24, 5, PALETTE.night).setOrigin(0, 0);
    }

    // ground
    this.add.rectangle(0, 150, GAME_W, 30, PALETTE.nightMid).setOrigin(0, 0);
    this.add.rectangle(0, 150, GAME_W, 2, PALETTE.nightLight).setOrigin(0, 0);
    // a puddle reflecting nothing useful
    this.add.ellipse(120, 172, 40, 7, PALETTE.nightLight).setAlpha(0.4);

    // dumpster
    this.add.rectangle(56, 126, 54, 26, PALETTE.moss).setOrigin(0, 0);
    this.add.rectangle(56, 122, 54, 5, PALETTE.mossLight).setOrigin(0, 0).setAlpha(0.5);

    // fire escape
    this.add.rectangle(150, 40, 3, 86, PALETTE.steel).setOrigin(0, 0);
    this.add.rectangle(196, 40, 3, 86, PALETTE.steel).setOrigin(0, 0);
    for (let i = 0; i < 7; i++) {
      this.add.rectangle(150, 44 + i * 12, 49, 2, PALETTE.steel).setOrigin(0, 0);
    }

    // the back door — ajar, and behind it nothing but black
    this.add.rectangle(DOOR_X, 100, 34, 50, PALETTE.brown).setOrigin(0, 0);
    this.add.rectangle(DOOR_X + 22, 100, 12, 50, PALETTE.black).setOrigin(0, 0);
    this.add.rectangle(DOOR_X + 21, 100, 1, 50, PALETTE.moon).setOrigin(0, 0).setAlpha(0.25);

    this.player = new Player(this, 70, WALK_Y, true);
    this.player.setSurface('concrete');

    this.prompt = text(this, 0, 0, '', PALETTE.gold).setOrigin(0.5, 0.5).setDepth(801).setVisible(false);

    this.keys = { left: this.bind(KEYS.left), right: this.bind(KEYS.right) };
    this.input.keyboard?.on('keydown-E', () => this.interact());
    this.input.on('pointerdown', () => this.interact());
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
    this.locked = true;

    if (this.spot === 'out') {
      fadeToScene(this, 'ExteriorNight');
      return;
    }

    // Inside.  This is the last ordinary thing that happens.
    audio.sfx('door_open');
    store.patch({ route: 'ejected' });
    store.flush();
    this.time.delayedCall(700, () => fadeToScene(this, 'ArcadeDark'));
  }

  update(_t: number, delta: number): void {
    if (this.locked) return;

    const dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    this.player.move(dx, 0, delta, new Phaser.Geom.Rectangle(46, WALK_Y, GAME_W - 76, 0));

    const px = this.player.x;
    this.spot = px > DOOR_X - 14 ? 'door' : px < 56 ? 'out' : null;

    if (!this.spot) {
      this.prompt.setVisible(false);
      return;
    }
    this.prompt
      .setText(this.spot === 'door' ? '[E] OPEN' : '[E] BACK')
      .setPosition(Phaser.Math.Clamp(px, 40, GAME_W - 40), WALK_Y - 34)
      .setVisible(true);
  }
}
