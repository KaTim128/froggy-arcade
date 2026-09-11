/**
 * The street, in the middle of the day.  The other half of the job.
 *
 * The arcade is a machine for turning tokens into prizes.  This is where the
 * prizes turn into money, and it is the only place in the game where money
 * exists at all.  The man is always here; the doors are always open; you can
 * go in and come out as many times as you like.
 *
 * Nothing bad happens on this street.  That is deliberate — the whole horror
 * act is the arcade at night, and it only lands because the daytime loop was
 * safe and ordinary and you were happy to keep walking back inside.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { KEYS } from '../core/input';
import { centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { paintExterior, startSignFlicker, KERB_Y, MAN_X } from '../art/exterior';
import { MysteryMan } from '../art/mysteryMan';
import { Player } from '../art/player';
import { PRIZES, allPrizesSold } from '../game/content';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W, GAME_H } from '../render/pixelScaler';

const WALK_Y = KERB_Y;
type Spot = 'door' | 'man' | null;

export class ExteriorDay extends Phaser.Scene {
  private player!: Player;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private prompt!: Phaser.GameObjects.BitmapText;
  private promptPlate!: Phaser.GameObjects.Rectangle;
  private mutter!: Phaser.GameObjects.BitmapText;
  private purse!: Phaser.GameObjects.BitmapText;
  private spot: Spot = null;
  private locked = false;
  private doorX = GAME_W / 2;

  constructor() {
    super('ExteriorDay');
  }

  create(): void {
    froggyLayer.clear();
    this.locked = false;
    this.spot = null;

    fadeIn(this);
    audio.setScene({ music: 'theme_arcade', ambience: ['street_dusk'] });

    const refs = paintExterior(this, { night: false, day: true });
    startSignFlicker(this, refs);
    this.doorX = refs.doorX;

    // He stands where he stands.  Nothing in this scene ever moves him, so he
    // does not need keeping hold of.
    new MysteryMan(this, MAN_X, WALK_Y + 4);
    // You come out of the doors standing at them, so going back in is one key
    // press away — the loop is meant to be walked dozens of times.
    this.player = new Player(this, this.doorX + 16, WALK_Y, true);

    // What you are carrying, and what you have made.  Cash is not tokens and
    // the HUD says so by keeping them apart and only showing cash out here.
    this.add.rectangle(4, 4, 96, 14, PALETTE.black, 0.55).setOrigin(0, 0).setDepth(950);
    this.purse = text(this, 9, 8, '', PALETTE.mossLight).setDepth(951);
    this.refreshPurse();

    this.promptPlate = this.add.rectangle(0, 0, 4, 12, PALETTE.black, 0.7).setDepth(800).setVisible(false);
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setDepth(801).setOrigin(0.5, 0.5).setVisible(false);
    this.mutter = centerText(this, GAME_W / 2, GAME_H - 18, '', PALETTE.cream).setDepth(802).setVisible(false);

    this.keys = { left: this.bind(KEYS.left), right: this.bind(KEYS.right) };
    this.input.keyboard?.on('keydown-E', () => this.interact());
    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.locked) this.scene.launch('SettingsModal', { from: 'ExteriorDay' });
    });

    // The exchange hands back here; the purse and the man's line may both have
    // changed while it was open.
    this.events.on('exchange-closed', () => {
      this.refreshPurse();
      this.checkFinished();
    });

    this.checkFinished();
  }

  private bind(names: readonly string[]): Phaser.Input.Keyboard.Key[] {
    const kb = this.input.keyboard;
    return kb ? names.map((n) => kb.addKey(n)) : [];
  }

  private held(g: string): boolean {
    return this.keys[g]?.some((k) => k.isDown) ?? false;
  }

  private refreshPurse(): void {
    const s = store.get();
    this.purse.setText(`$${s.cash}   ${s.prizesSold.length}/${PRIZES.length} SOLD`);
  }

  /** Everything sold is the end of the job, and of the game. */
  private checkFinished(): void {
    if (this.locked || !allPrizesSold(store.get().prizesSold)) return;
    this.locked = true;
    this.time.delayedCall(700, () => fadeToScene(this, 'TheEnd'));
  }

  private interact(): void {
    if (this.locked || this.busy() || !this.spot) return;

    if (this.spot === 'door') {
      this.locked = true;
      audio.sfx('door_open');
      fadeToScene(this, 'ArcadeHub');
      return;
    }

    const s = store.get();
    const toSell = s.prizesOwned.filter((id) => !s.prizesSold.includes(id));
    if (toSell.length === 0) {
      this.say(s.prizesOwned.length === 0
        ? '"Nothing yet?  The counter is inside, friend."'
        : '"You have sold me everything you are carrying."');
      return;
    }
    this.scene.launch('PrizeExchange', { from: 'ExteriorDay' });
  }

  private busy(): boolean {
    return this.scene.isActive('PrizeExchange') || this.scene.isActive('SettingsModal');
  }

  private say(msg: string): void {
    this.mutter.setText(msg).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.mutter);
    this.tweens.add({ targets: this.mutter, alpha: 0, delay: 2200, duration: 600 });
  }

  update(_t: number, delta: number): void {
    if (this.locked || this.busy()) {
      this.prompt.setVisible(false);
      this.promptPlate.setVisible(false);
      return;
    }

    const dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    this.player.move(dx, 0, delta, new Phaser.Geom.Rectangle(20, WALK_Y, GAME_W - 40, 0));

    const px = this.player.x;
    this.spot =
      Math.abs(px - MAN_X) < 22 ? 'man' : Math.abs(px - this.doorX) < 24 ? 'door' : null;

    if (!this.spot) {
      this.prompt.setVisible(false);
      this.promptPlate.setVisible(false);
      return;
    }

    const label = this.spot === 'man' ? '[E] TALK' : '[E] GO IN';
    const x = Phaser.Math.Clamp(px, 40, GAME_W - 40);
    this.prompt.setText(label).setPosition(x, WALK_Y - 34).setVisible(true);
    this.promptPlate
      .setPosition(x, WALK_Y - 34)
      .setSize(this.prompt.width + 6, 11)
      .setVisible(true);
  }
}
