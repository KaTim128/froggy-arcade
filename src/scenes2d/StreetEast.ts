/**
 * ---- EAST OF THE ARCADE.  The shops.
 *
 * Out of the arcade's forecourt to the right, along a row of shopfronts:
 * HOME AND HEARTH (furniture), THREADS (clothes) and THE CLIP JOINT (the
 * barber).  Each door goes INTO the shop, the way the arcade's does (see
 * scenes2d/shops).  Walk up to a door and use it -- or tap it, and walk
 * there.  People go past on the pavement.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { KEYS } from '../core/input';
import { centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { GAME_H } from '../render/pixelScaler';
import { TokenHud } from '../ui/hud';
import { attachPockets } from '../ui/pockets';
import { Player } from '../art/player';
import { Pedestrians } from '../art/pedestrians';
import { froggyLayer } from '../render/froggyLayer';
import { SHOP_HOURS, clock, shopsOpen, visit } from '../game/life';
import { nightfallOnce, onPhaseTurn } from '../game/dayNight';
import { backPlate, fitPrompt, SUBTITLE_Y } from '../ui/plate';
import { FRONT_TOP, paintShopfront, paintStreet, type ShopfrontOpts } from '../art/shopfront';
import { resumeSpot, trackPlace } from '../game/place';

export type StoreKind = 'furniture' | 'clothes' | 'barber';
/** The scene each door opens into. */
export const STORE_SCENE: Record<StoreKind, string> = { furniture: 'FurnitureStore', clothes: 'ClothesStore', barber: 'BarberShop' };

const WORLD_W = 640;
const WALK_Y = 168;

interface Front {
  kind: StoreKind;
  name: string;
  x: number;
  w: number;
  /** The entrance, in the middle of the front. */
  door: number;
  look: Omit<ShopfrontOpts, 'x' | 'w' | 'doorX' | 'name' | 'day' | 'night' | 'closed'>;
}

const FRONTS: Front[] = [
  {
    kind: 'furniture',
    name: 'HOME AND HEARTH',
    x: 24,
    w: 184,
    door: 116,
    look: {
      wall: 0x8a5a48,
      signBox: 0x3a1e14,
      signInk: 0xffb060,
      inside: { back: 0x6a4a2a, floor: 0xd8a868, band: 0xffe0a0, mat: 0xa86a3a, spill: 0xffc070 },
      goods: 'furniture',
      stock: [0xc85a3a, 0x6a8a4a, 0x4a6a9a, 0xd8a838],
    },
  },
  {
    kind: 'clothes',
    name: 'THREADS',
    x: 228,
    w: 180,
    door: 318,
    look: {
      wall: 0x6a4a7a,
      signBox: 0x2a1430,
      signInk: 0xff4fa3,
      inside: { back: 0x7a3a5a, floor: 0xff8ac0, band: 0xffd0e8, mat: 0xc0306a, spill: 0xff4fa3 },
      goods: 'clothes',
      stock: [0xb03838, 0x3a5a8a, 0x8a8a90, 0x2a2a3a, 0xd8a838],
    },
  },
  {
    kind: 'barber',
    name: "SHARP'S BARBER",
    x: 428,
    w: 188,
    door: 522,
    look: {
      wall: 0x3a5a64,
      signBox: 0x10282a,
      signInk: 0x7fe0d0,
      inside: { back: 0x2a5a4a, floor: 0xbfe0d0, band: 0xf0f0ea, mat: 0x2a6a5a, spill: 0x7fe0d0 },
      goods: 'barber',
      stock: [0x3a2a1e, 0x6a4a2a, 0xd8b060, 0x1e1814],
    },
  },
];

export class StreetEast extends Phaser.Scene {
  private player!: Player;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private prompt!: Phaser.GameObjects.BitmapText;
  private promptPlate!: Phaser.GameObjects.Rectangle;
  private mutter!: Phaser.GameObjects.BitmapText;
  private spot: Front | null = null;
  private errand: Front | null = null;
  private locked = false;
  private people!: Pedestrians;

  constructor() {
    super('StreetEast');
  }

  /** Back out of a shop: stood at its door. */
  private atShop: StoreKind | null = null;

  init(data: { atShop?: StoreKind; atX?: number; say?: string } = {}): void {
    this.atShop = data.atShop ?? null;
    this.atX = data.atX ?? null;
    this.greet = data.say ?? null;
  }

  /** Where you were standing when the light turned (the street repaints round you). */
  private atX: number | null = null;
  /** Something to say on arrival (a shop that has just shut behind you). */
  private greet: string | null = null;

  create(): void {
    froggyLayer.clear();
    this.locked = false;
    this.spot = null;
    this.errand = null;
    fadeIn(this);
    audio.setScene({ music: 'theme_arcade', ambience: ['street_dusk'] });
    visit('street_east');
    const dark = clock().dark;
    this.paint(dark);

    const door = FRONTS.find((f) => f.kind === this.atShop);
    this.player = new Player(this, this.atX ?? (door ? door.door : 16), WALK_Y, dark);
    this.player.setSurface('gravel');
    // kept with the run, and back on the spot when resumed here (game/place)
    trackPlace(this, () => this.player, {}, resumeSpot(this.sys.settings.data));
    this.cameras.main.setBounds(0, 0, WORLD_W, GAME_H);
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);
    this.people = new Pedestrians(this, WORLD_W, WALK_Y + 2, dark ? 2 : 4, dark);

    new TokenHud(this);
    attachPockets(this, () => this.locked || this.busy());
    this.promptPlate = this.add.rectangle(0, 0, 4, 12, PALETTE.black, 0.7).setDepth(800).setVisible(false);
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setDepth(801).setOrigin(0.5, 0.5).setVisible(false);
    this.mutter = centerText(this, 160, SUBTITLE_Y, '', PALETTE.cream).setDepth(802).setScrollFactor(0).setVisible(false).setMaxWidth(290);
    backPlate(this, this.mutter);

    const kb = this.input.keyboard;
    const bind = (n: readonly string[]) => (kb ? n.map((k) => kb.addKey(k)) : []);
    this.keys = { left: bind(KEYS.left), right: bind(KEYS.right) };
    kb?.on('keydown-E', () => this.interact());
    for (const f of FRONTS) {
      this.add
        .zone(f.door - 17, 116, 34, 36)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.walkTo(f));
    }
    this.events.on('shop-closed', () => (this.locked = false));
    text(this, 4, WALK_Y + 4, '<', PALETTE.cream).setDepth(800).setAlpha(0.7);
    // morning, evening or night coming while you are out here: the street, its lights and its
    // shop signs repaint for the new hour, round you where you stand
    onPhaseTurn(
      this,
      () => {
        this.locked = true;
        fadeToScene(this, 'StreetEast', { atX: Math.round(this.player.x) });
      },
      () => !this.locked && !this.busy(),
    );
    const line = this.greet ?? nightfallOnce();
    if (line) this.time.delayedCall(400, () => this.say(line));
  }

  private busy(): boolean {
    return this.scene.isActive('Shop') || this.scene.isActive('SettingsModal') || this.scene.isActive('Goals') || this.scene.isActive('InventoryModal');
  }

  private walkTo(f: Front): void {
    if (this.locked || this.busy()) return;
    if (this.spot === f) return this.interact();
    this.errand = f;
  }

  private say(m: string): void {
    this.mutter.setText(m).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.mutter);
    this.tweens.add({ targets: this.mutter, alpha: 0, delay: 2200, duration: 500 });
  }

  private interact(): void {
    if (this.locked || this.busy() || !this.spot) return;
    const f = this.spot;
    if (!shopsOpen()) {
      audio.sfx('door_rattle', 0.5);
      this.say(`${f.name} IS SHUT FOR THE NIGHT. OPEN ${SHOP_HOURS}.`);
      return;
    }
    this.locked = true;
    audio.sfx('door_open', 0.5);
    visit(f.kind);
    // in through the door, as into the arcade
    fadeToScene(this, STORE_SCENE[f.kind], {});
  }

  // ---------------------------------------------------------------- paint

  /** The arcade's street, and the shops along it built the way it is. */
  private paint(dark: boolean): void {
    const c = clock();
    const mood = { day: c.phase === 'morning', night: dark };
    paintStreet(this, WORLD_W, mood);
    const shut = !shopsOpen(c);
    // the gaps between the buildings, in shadow
    const gaps = this.add.graphics();
    for (const f of FRONTS) {
      gaps.fillStyle(mood.night ? 0x080a14 : 0x1a1e2a, 1).fillRect(f.x + f.w, FRONT_TOP + 4, 20, 150 - FRONT_TOP - 4);
    }
    gaps.fillStyle(mood.night ? 0x080a14 : 0x1a1e2a, 1).fillRect(0, FRONT_TOP + 4, FRONTS[0].x, 150 - FRONT_TOP - 4);
    for (const f of FRONTS) paintShopfront(this, { ...f.look, x: f.x, w: f.w, doorX: f.door, name: f.name, ...mood, closed: shut });
  }

  update(_t: number, delta: number): void {
    this.people.update(delta);
    if (this.locked || this.busy()) {
      this.prompt.setVisible(false);
      this.promptPlate.setVisible(false);
      return;
    }
    let dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    if (dx !== 0) this.errand = null;
    if (this.errand) {
      const gap = this.errand.door - this.player.x;
      if (Math.abs(gap) <= 2) {
        this.spot = this.errand;
        this.errand = null;
        this.interact();
        return;
      }
      dx = gap > 0 ? 1 : -1;
    }
    this.player.move(dx, 0, delta, new Phaser.Geom.Rectangle(2, WALK_Y, WORLD_W - 8, 0));
    // back west, to the arcade
    if (this.player.x <= 3 && dx < 0) {
      this.locked = true;
      fadeToScene(this, 'ExteriorDay', { fromEast: true });
      return;
    }
    const px = this.player.x;
    this.spot = FRONTS.find((f) => Math.abs(px - f.door) < 12) ?? null;
    if (!this.spot) {
      this.prompt.setVisible(false);
      this.promptPlate.setVisible(false);
      return;
    }
    const label = `[E] ${this.spot.name}`;
    this.prompt.setText(label).setPosition(px, WALK_Y - 52).setVisible(true);
    fitPrompt(this.promptPlate, this.prompt);
  }

  private held(g: string): boolean {
    return this.keys[g]?.some((k) => k.isDown) ?? false;
  }
}
