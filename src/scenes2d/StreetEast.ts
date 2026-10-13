/**
 * ---- EAST OF THE ARCADE.  The shops.
 *
 * Out of the arcade's forecourt to the right, along a row of shopfronts: the
 * CORNER MARKET (food, water, ingredients), a drinking FOUNTAIN that is free
 * and always on, HOME AND HEARTH (furniture), THREADS (clothes) and THE CLIP
 * JOINT (the barber).  Walk up to a door and use it -- or tap it, and walk
 * there.  People go past on the pavement.
 */

import Phaser from 'phaser';
import { pullBackAtClosing } from '../game/closingPull';
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
import { clock, drinkFountain, visit } from '../game/life';
import type { ShopKind } from './Shop';

const WORLD_W = 640;
const WALK_Y = 168;

interface Front {
  kind: ShopKind | 'fountain';
  name: string;
  x: number;
  w: number;
  wall: number;
  trim: number;
  awning: number;
  door: number;
}

const FRONTS: Front[] = [
  { kind: 'market', name: 'CORNER MARKET', x: 20, w: 120, wall: 0x9a5a3a, trim: 0xe8d8b0, awning: 0x2f8d4f, door: 92 },
  { kind: 'fountain', name: 'FOUNTAIN', x: 152, w: 44, wall: 0, trim: 0, awning: 0, door: 174 },
  { kind: 'furniture', name: 'HOME AND HEARTH', x: 208, w: 150, wall: 0x6a7a8a, trim: 0xf0e8d8, awning: 0xc85a3a, door: 300 },
  { kind: 'clothes', name: 'THREADS', x: 370, w: 120, wall: 0x5a3a6a, trim: 0xf0d0e8, awning: 0xff4fa3, door: 446 },
  { kind: 'barber', name: 'THE CLIP JOINT', x: 502, w: 124, wall: 0x2a4a5a, trim: 0xe8f0f0, awning: 0x2a6ab0, door: 580 },
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

    this.player = new Player(this, 16, WALK_Y, dark);
    this.player.setSurface('gravel');
    this.cameras.main.setBounds(0, 0, WORLD_W, GAME_H);
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);
    this.people = new Pedestrians(this, WORLD_W, WALK_Y + 2, dark ? 2 : 4, dark);

    new TokenHud(this);
    attachPockets(this, () => this.locked || this.busy());
    pullBackAtClosing(this, () => !this.locked && !this.busy(), () => (this.locked = true));
    this.promptPlate = this.add.rectangle(0, 0, 4, 12, PALETTE.black, 0.7).setDepth(800).setVisible(false);
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setDepth(801).setOrigin(0.5, 0.5).setVisible(false);
    this.mutter = centerText(this, 160, GAME_H - 40, '', PALETTE.cream).setDepth(802).setScrollFactor(0).setVisible(false).setMaxWidth(290);

    const kb = this.input.keyboard;
    const bind = (n: readonly string[]) => (kb ? n.map((k) => kb.addKey(k)) : []);
    this.keys = { left: bind(KEYS.left), right: bind(KEYS.right) };
    kb?.on('keydown-E', () => this.interact());
    for (const f of FRONTS) {
      this.add
        .zone(f.door - 12, WALK_Y - 44, 24, 44)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.walkTo(f));
    }
    this.events.on('shop-closed', () => (this.locked = false));
    text(this, 4, WALK_Y + 4, '<', PALETTE.cream).setDepth(800).setAlpha(0.7);
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
    if (f.kind === 'fountain') {
      audio.sfx('water_plip', 0.7);
      this.say(drinkFountain().msg);
      return;
    }
    const c = clock();
    if (c.hour < 7 || c.hour >= 23) {
      audio.sfx('door_rattle', 0.5);
      this.say(`${f.name} IS SHUT. OPEN 07:00 - 23:00.`);
      return;
    }
    this.locked = true;
    audio.sfx('door_open', 0.5);
    visit(f.kind);
    this.scene.launch('Shop', { kind: f.kind, from: 'StreetEast' });
  }

  // ---------------------------------------------------------------- paint

  private paint(dark: boolean): void {
    const g = this.add.graphics().setDepth(0);
    const c = clock();
    const sky = dark ? [0x0c1028, 0x141c3a, 0x1c2848] : c.hour >= 18 ? [0x5a3a6a, 0xa0506a, 0xe89858] : [0x7ac0e8, 0x8fd0f0, 0xbfe0ee];
    sky.forEach((col, i) => g.fillStyle(col, 1).fillRect(0, i * 22, WORLD_W, 22));
    g.fillStyle(sky[2], 1).fillRect(0, 66, WORLD_W, 30);
    // a far row of rooftops
    for (let x = 0; x < WORLD_W; x += 26) {
      const h = 20 + ((x * 13) % 22);
      g.fillStyle(dark ? 0x10142a : 0x8aa0b4, 1).fillRect(x, 96 - h, 24, h);
    }
    // the shopfronts
    for (const f of FRONTS) {
      if (f.kind === 'fountain') {
        this.paintFountain(g, f, dark);
        continue;
      }
      const top = 44;
      const wall = dark ? Phaser.Display.Color.ValueToColor(f.wall).darken(35).color : f.wall;
      g.fillStyle(0x14100c, 1).fillRect(f.x - 1, top - 1, f.w + 2, WALK_Y - top + 1);
      g.fillStyle(wall, 1).fillRect(f.x, top, f.w, WALK_Y - top);
      // bricks
      for (let y = top + 3; y < WALK_Y; y += 5) for (let x = f.x + ((y / 5) % 2 ? 0 : 5); x < f.x + f.w; x += 10) g.fillStyle(0x000000, 0.12).fillRect(x, y, 9, 1);
      // the sign
      g.fillStyle(0x14100c, 1).fillRect(f.x + 6, top + 4, f.w - 12, 13);
      g.fillStyle(f.trim, 1).fillRect(f.x + 7, top + 5, f.w - 14, 11);
      centerText(this, f.x + f.w / 2, top + 11, f.name, 0x14100c).setDepth(2);
      // the awning, striped
      for (let k = 0; k < f.w; k += 8) g.fillStyle(k % 16 ? f.awning : 0xf0ece0, 1).fillRect(f.x + k, top + 22, 8, 7);
      g.fillStyle(0x14100c, 0.3).fillRect(f.x, top + 29, f.w, 2);
      // the window: lit from inside, with what is for sale in it
      const wx = f.x + 8;
      const ww = f.door - 14 - wx;
      g.fillStyle(0x14100c, 1).fillRect(wx - 1, top + 35, ww + 2, 54);
      g.fillStyle(dark ? 0xf0d890 : 0xd8ecf0, 1).fillRect(wx, top + 36, ww, 52);
      this.paintDisplay(g, f, wx, top + 36, ww);
      g.fillStyle(0xffffff, dark ? 0.08 : 0.25).fillRect(wx + 3, top + 38, 3, 48);
      // the door
      g.fillStyle(0x14100c, 1).fillRect(f.door - 11, WALK_Y - 42, 22, 42);
      g.fillStyle(Phaser.Display.Color.ValueToColor(f.trim).darken(30).color, 1).fillRect(f.door - 10, WALK_Y - 41, 20, 41);
      g.fillStyle(dark ? 0xf0d890 : 0xb8d8e8, 1).fillRect(f.door - 7, WALK_Y - 38, 14, 18);
      g.fillStyle(0xd8a838, 1).fillRect(f.door + 6, WALK_Y - 20, 2, 2);
      // a little window right of the door too
      const rx = f.door + 14;
      const rw = f.x + f.w - 8 - rx;
      if (rw > 10) {
        g.fillStyle(0x14100c, 1).fillRect(rx - 1, top + 35, rw + 2, 40);
        g.fillStyle(dark ? 0xf0d890 : 0xd8ecf0, 1).fillRect(rx, top + 36, rw, 38);
      }
    }
    // the pavement and the kerb
    g.fillStyle(0x8a8478, 1).fillRect(0, WALK_Y, WORLD_W, GAME_H - WALK_Y);
    for (let x = 0; x < WORLD_W; x += 16) g.fillStyle(0x6a665c, 1).fillRect(x, WALK_Y, 1, GAME_H - WALK_Y);
    g.fillStyle(0x5a564c, 1).fillRect(0, GAME_H - 3, WORLD_W, 3);
    if (dark) g.fillStyle(0x000020, 0.35).fillRect(0, 0, WORLD_W, GAME_H);
  }

  private paintDisplay(g: Phaser.GameObjects.Graphics, f: Front, x: number, y: number, w: number): void {
    // shelves, and things on them in the shop's colours
    for (let row = 0; row < 3; row++) {
      const sy = y + 14 + row * 15;
      g.fillStyle(0x6a4a2a, 1).fillRect(x + 2, sy, w - 4, 2);
      for (let k = x + 5; k < x + w - 8; k += 9) {
        const col = [f.awning, f.trim, f.wall, 0xf0d070, 0x6fb8e8][(k + row * 3) % 5];
        if (f.kind === 'clothes') g.fillStyle(col, 1).fillRect(k, sy - 10, 6, 10);
        else if (f.kind === 'furniture') g.fillStyle(col, 1).fillRect(k, sy - 6, 8, 6);
        else if (f.kind === 'barber') g.fillStyle(col, 1).fillCircle(k + 3, sy - 4, 3);
        else g.fillStyle(col, 1).fillRect(k, sy - 7, 5, 7);
      }
    }
    if (f.kind === 'barber') {
      // the pole
      for (let k = 0; k < 40; k += 6) g.fillStyle(k % 12 ? 0xc83a3a : 0xf0f0f0, 1).fillRect(f.door + 14, 90 + k, 4, 6);
    }
  }

  private paintFountain(g: Phaser.GameObjects.Graphics, f: Front, dark: boolean): void {
    const cx = f.door;
    g.fillStyle(0x14100c, 1).fillRect(cx - 9, WALK_Y - 30, 18, 30);
    g.fillStyle(dark ? 0x5a6470 : 0xa8b0b8, 1).fillRect(cx - 8, WALK_Y - 29, 16, 29);
    g.fillStyle(0x14100c, 1).fillRect(cx - 12, WALK_Y - 33, 24, 5);
    g.fillStyle(dark ? 0x6a7480 : 0xc8d0d8, 1).fillRect(cx - 11, WALK_Y - 32, 22, 3);
    g.fillStyle(0x6fb8e8, 1).fillRect(cx - 1, WALK_Y - 40, 2, 7);
    centerText(this, cx, WALK_Y - 50, 'FREE WATER', dark ? PALETTE.fog : 0x2a4a6a).setDepth(2);
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
    const label = this.spot.kind === 'fountain' ? '[E] DRINK' : `[E] ${this.spot.name}`;
    this.prompt.setText(label).setPosition(px, WALK_Y - 52).setVisible(true);
    this.promptPlate.setPosition(px, WALK_Y - 52).setSize(this.prompt.width + 6, 11).setVisible(true);
  }

  private held(g: string): boolean {
    return this.keys[g]?.some((k) => k.isDown) ?? false;
  }
}
