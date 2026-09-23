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
 *
 * YOU CAN JUST CLICK THE DOOR.  Both things worth touching out here — the
 * doorway and the man — are hit areas as well as walk-up spots: point at one
 * and the player walks there and does the thing, which is how a phone plays
 * this scene and how anybody who would rather not hold a key plays it too.
 * The door lights up under a cursor so it reads as a door you can press, and
 * the `[E]` prompt still appears when you arrive on foot, because neither way
 * of getting there replaces the other.
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
  /** Where a click told the player to go, and what to do on arrival. */
  private errand: Spot = null;
  private doorGlow!: Phaser.GameObjects.Rectangle;

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
    this.errand = null;
    this.makeSpotsClickable(refs.doorRect);

    // He stands where he stands.  Nothing in this scene ever moves him, so he
    // does not need keeping hold of.
    new MysteryMan(this, MAN_X, WALK_Y + 4);
    // You come out of the doors standing at them, so going back in is one key
    // press away — the loop is meant to be walked dozens of times.
    // DAY COLOURS, on the one scene in the game that is painted in daylight.
    // It was building him with the NIGHT flag on, which runs every colour he
    // has through `nightify`: cap, hood, coat and trousers all came out the
    // same desaturated blue-grey, stood on a sunlit forecourt.  The night
    // scenes -- the alley, the dark arcade, the street after hours -- keep it.
    this.player = new Player(this, this.doorX + 16, WALK_Y, false);
    // The forecourt is loose ground, not the arcade's carpet.  This scene
    // never said so, which left the walk outside sounding like the walk in.
    this.player.setSurface('gravel');

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

  /**
   * The door and the man, as things you can point at.
   *
   * A click is an ERRAND, not a teleport: the player walks over on their own
   * legs and the interaction fires when they get there, so clicking and
   * walking end in exactly the same place and the scene never has two ways of
   * being somewhere.  Clicking what you are already standing at just does it.
   *
   * Only the door lights up.  It is the way out of the scene and the thing a
   * new player is looking for; the man is a person standing in the open, and a
   * glowing rectangle around him would read as something being wrong with him.
   */
  private makeSpotsClickable(door: { x: number; y: number; w: number; h: number }): void {
    this.doorGlow = this.add
      .rectangle(door.x - 2, door.y - 2, door.w + 4, door.h + 4)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.gold)
      .setDepth(60)
      .setAlpha(0)
      .setFillStyle(PALETTE.gold, 0.12);

    const zone = this.add
      .zone(door.x, door.y, door.w, door.h)
      .setOrigin(0, 0)
      .setDepth(61)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      if (!this.locked && !this.busy()) this.tweens.add({ targets: this.doorGlow, alpha: 1, duration: 110 });
    });
    zone.on('pointerout', () => this.tweens.add({ targets: this.doorGlow, alpha: 0, duration: 160 }));
    zone.on('pointerdown', () => this.send('door'));

    // The man gets the same reach, sized to him rather than to the doorway.
    this.add
      .zone(MAN_X - 14, WALK_Y - 34, 28, 40)
      .setOrigin(0, 0)
      .setDepth(61)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.send('man'));
  }

  /** Go and do that.  Arriving is `update`'s job; this only sets the errand. */
  private send(where: Spot): void {
    if (this.locked || this.busy()) return;
    audio.sfx('ui_blip', 0.4);
    if (this.spot === where) {
      this.errand = null;
      this.interact();
      return;
    }
    this.errand = where;
  }

  private targetX(where: Spot): number {
    return where === 'man' ? MAN_X + 16 : this.doorX;
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

    let dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    // A hand on the keys always wins: touching a movement key drops whatever
    // the last click asked for, so the two never fight over the same legs.
    if (dx !== 0) this.errand = null;
    if (this.errand) {
      const gap = this.targetX(this.errand) - this.player.x;
      if (Math.abs(gap) <= 2) {
        const done = this.errand;
        this.errand = null;
        this.spot = done;
        this.interact();
        return;
      }
      dx = gap > 0 ? 1 : -1;
    }
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
