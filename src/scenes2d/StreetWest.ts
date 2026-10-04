/**
 * ---- DOWN THE STREET, LEFT OF THE ARCADE.
 *
 * Off the left edge of the forecourt the pavement carries on: an empty road
 * beside it, a bus stop that no bus comes to, the edge of the forest behind
 * a fence, and at the far end, further down than it looks, the hotel -- a
 * proper one, with a canopy and a man in a uniform at the door.
 *
 * The doorman decides who goes in.  Without the price of a room in your
 * pocket ($300) he will not have you near the entrance; with it, he holds the
 * door.  Tokens are not money to him.
 *
 * By day it is bright; after the evening turns, it is dusk.  At midnight
 * nobody walks this street -- that walk is the night road (see NightRoad3D).
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { KEYS } from '../core/input';
import { centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { Player } from '../art/player';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { attachPockets } from '../ui/pockets';
import { ROOM_MONEY } from './PrizeExchange';

export const WORLD_W = 640;
const WALK_Y = 168;
const DOOR_X = 86;
const DOORMAN_X = 116;
const BUS_X = 388;

export const DOORMAN_NO = '"We don\'t allow homeless people around here. Move along and stay away from the entrance."';

type Spot = 'door' | 'doorman' | 'bus' | null;

export class StreetWest extends Phaser.Scene {
  private player!: Player;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private prompt!: Phaser.GameObjects.BitmapText;
  private mutter!: Phaser.GameObjects.BitmapText;
  /** A dark plate behind the line, so it reads over the road and the lamps. */
  private mutterPlate!: Phaser.GameObjects.Rectangle;
  private purse!: Phaser.GameObjects.BitmapText;
  private spot: Spot = null;
  private locked = false;
  private spawn: 'east' | 'hotel' = 'east';

  constructor() {
    super('StreetWest');
  }

  init(data: { from?: 'east' | 'hotel' } = {}): void {
    this.spawn = data.from === 'hotel' ? 'hotel' : 'east';
  }

  create(): void {
    this.locked = false;
    this.spot = null;
    fadeIn(this);
    const dusk = store.get().timeOfDay !== 'day';
    audio.setScene({ music: 'theme_arcade', ambience: ['street_dusk', 'wind_low'] });
    this.paint(dusk);

    this.player = new Player(this, this.spawn === 'hotel' ? DOOR_X + 10 : WORLD_W - 18, WALK_Y, false);
    this.player.setSurface('gravel');
    this.cameras.main.setBounds(0, 0, WORLD_W, GAME_H);
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);

    // the purse, fixed to the screen
    // (top right: the hotel's name is across the top left of the street)
    this.add.rectangle(GAME_W - 164, 4, 96, 14, PALETTE.black, 0.55).setOrigin(0, 0).setDepth(950).setScrollFactor(0);
    this.purse = text(this, GAME_W - 159, 8, `$${store.get().cash}`, PALETTE.mossLight).setDepth(951).setScrollFactor(0);
    // and the pockets up in the corner, clear of you walking along the kerb
    attachPockets(this, () => this.locked, GAME_W - 32, true);
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setDepth(801).setOrigin(0.5, 0.5).setVisible(false);
    this.mutterPlate = this.add.rectangle(0, 0, 1, 1, PALETTE.black, 0.72).setOrigin(0, 0).setDepth(801).setScrollFactor(0).setVisible(false);
    this.mutter = centerText(this, 160, GAME_H - 40, '', PALETTE.cream).setDepth(802).setScrollFactor(0).setVisible(false).setMaxWidth(290);

    const kb = this.input.keyboard;
    const bind = (n: readonly string[]) => (kb ? n.map((k) => kb.addKey(k)) : []);
    this.keys = { left: bind(KEYS.left), right: bind(KEYS.right) };
    kb?.on('keydown-E', () => this.interact());
    // tap the doorman or the door to walk there and use it
    this.add.zone(DOOR_X - 10, WALK_Y - 40, 20, 40).setOrigin(0, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.walkTo('door'));
    this.add.zone(DOORMAN_X - 8, WALK_Y - 34, 16, 34).setOrigin(0, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.walkTo('doorman'));
  }

  private errand: Spot = null;
  private walkTo(s: Spot): void {
    if (this.locked) return;
    if (this.spot === s) return this.interact();
    this.errand = s;
  }

  /** The street, the bus stop, the forest and the hotel, painted once. */
  private paint(dusk: boolean): void {
    const sky = dusk ? [PALETTE.plum, PALETTE.violet, PALETTE.ember, PALETTE.amber] : [0x8fd0e8, 0x8fd0e8, 0x7ec0dc, 0xbfe0ee];
    for (let i = 0; i < 4; i++) this.add.rectangle(0, i * 18, WORLD_W, 18, sky[i]).setOrigin(0, 0);
    // the forest behind the fence: three rows of trees, darker nearer
    const rows = dusk ? [0x3a2a4a, 0x2a2238, 0x1c1828] : [0x5a9a6a, 0x3f7a4f, 0x2e5e3c];
    rows.forEach((col, r) => {
      for (let x = 150 + r * 7; x < WORLD_W + 20; x += 15 + r * 3) {
        const h = 26 + ((x * 7 + r * 13) % 18);
        const base = 116 + r * 6;
        this.add.triangle(x, base - h / 2, -9, h / 2, 9, h / 2, 0, -h / 2, col);
      }
    });
    // the fence along the forest
    for (let x = 160; x < WORLD_W; x += 8) this.add.rectangle(x, 124, 2, 12, dusk ? 0x4a3a3a : 0x8a7a5a).setOrigin(0.5, 1);
    this.add.rectangle(160, 118, WORLD_W - 160, 1, dusk ? 0x4a3a3a : 0x8a7a5a).setOrigin(0, 0.5);
    // the road: empty, both ways, as far as you can see
    this.add.rectangle(0, 126, WORLD_W, 30, dusk ? 0x2a2630 : 0x4a4e56).setOrigin(0, 0);
    for (let x = 6; x < WORLD_W; x += 26) this.add.rectangle(x, 141, 12, 2, dusk ? 0x8a7a50 : 0xf2e6c0).setOrigin(0, 0.5);
    // the kerb and the pavement
    this.add.rectangle(0, 156, WORLD_W, 3, dusk ? 0x6a6070 : 0xb8b8b0).setOrigin(0, 0);
    this.add.rectangle(0, 159, WORLD_W, 21, dusk ? 0x4a4450 : 0x9a9a92).setOrigin(0, 0);
    for (let x = 0; x < WORLD_W; x += 20) this.add.rectangle(x, 159, 1, 21, dusk ? 0x3a3440 : 0x86867e).setOrigin(0, 0);
    // street lamps
    for (const lx of [210, 330, 470, 600]) {
      this.add.rectangle(lx, 158, 2, 40, 0x3a3e44).setOrigin(0.5, 1);
      this.add.rectangle(lx + 4, 118, 10, 2, 0x3a3e44);
      this.add.circle(lx + 8, 120, 2.4, dusk ? 0xffe090 : 0xd8dce0);
      if (dusk) this.add.circle(lx + 8, 128, 12, 0xffe090, 0.08);
    }
    // ---- the bus stop: a shelter, a bench, a timetable nobody updates
    const B = BUS_X;
    this.add.rectangle(B - 22, 158, 2, 32, 0x5a626e).setOrigin(0.5, 1);
    this.add.rectangle(B + 22, 158, 2, 32, 0x5a626e).setOrigin(0.5, 1);
    this.add.rectangle(B, 126, 50, 4, 0x3f6fd8).setOrigin(0.5, 0.5);
    this.add.rectangle(B + 6, 140, 30, 18, 0xbfe0ee, 0.35).setStrokeStyle(1, 0x8a9aa8);
    this.add.rectangle(B - 4, 152, 26, 3, 0x8a5a2e);
    this.add.rectangle(B - 14, 156, 1.5, 5, 0x5a3a1e);
    this.add.rectangle(B + 6, 156, 1.5, 5, 0x5a3a1e);
    this.add.rectangle(B + 34, 158, 2, 30, 0x5a626e).setOrigin(0.5, 1);
    this.add.circle(B + 34, 126, 6, PALETTE.white).setStrokeStyle(1.5, 0xc31f2e);
    centerText(this, B + 34, 126, 'BUS', 0xc31f2e);
    // ---- the hotel, at the end of the street
    const H = dusk ? 0x5a4a5a : 0xd8c8a8;
    this.add.rectangle(4, 158, 150, 150, H).setOrigin(0, 1).setStrokeStyle(1, dusk ? 0x3a2e3a : 0x8a7a5a);
    for (let f = 0; f < 6; f++) {
      for (let w = 0; w < 6; w++) {
        const lit = dusk ? (f * 7 + w * 3) % 4 !== 0 : false;
        this.add.rectangle(16 + w * 22, 22 + f * 16, 10, 9, lit ? 0xffe090 : dusk ? 0x2a2230 : 0x8ab8d0).setStrokeStyle(1, dusk ? 0x3a2e3a : 0x8a7a5a);
      }
    }
    this.add.rectangle(4, 6, 150, 10, dusk ? 0x3a2e3a : 0x8a5a2e).setOrigin(0, 0);
    centerText(this, 79, 11, 'GRAND LILY HOTEL', dusk ? 0xffe090 : PALETTE.gold);
    // the canopy over the door, and the door
    this.add.rectangle(DOOR_X + 4, 124, 52, 5, 0x7b2a3a).setStrokeStyle(1, 0x4a1a24);
    this.add.rectangle(DOOR_X - 20, 158, 1.5, 34, 0xc9a24a).setOrigin(0.5, 1);
    this.add.rectangle(DOOR_X + 28, 158, 1.5, 34, 0xc9a24a).setOrigin(0.5, 1);
    this.add.rectangle(DOOR_X, 158, 20, 32, dusk ? 0x2a1a20 : 0x3a2a24).setOrigin(0.5, 1).setStrokeStyle(1, 0xc9a24a);
    this.add.rectangle(DOOR_X, 158, 1, 32, 0xc9a24a).setOrigin(0.5, 1);
    // the doorman: a long coat, a peaked cap, gold buttons, arms folded
    const d = DOORMAN_X;
    this.add.rectangle(d, 158, 9, 12, 0x2a2a3a).setOrigin(0.5, 1);
    this.add.rectangle(d, 146, 11, 14, 0x7b2a3a).setOrigin(0.5, 1);
    for (let k = 0; k < 3; k++) this.add.circle(d, 140 + k * 3, 0.7, PALETTE.gold);
    this.add.rectangle(d, 140, 13, 3, 0x6a2232);
    this.add.rectangle(d, 132, 7, 7, 0xe8b890).setOrigin(0.5, 1);
    this.add.rectangle(d, 126, 9, 3, 0x2a2a3a).setOrigin(0.5, 1);
    this.add.rectangle(d + 2, 125, 6, 1, 0x1a1a24).setOrigin(0.5, 1);
  }

  private interact(): void {
    if (this.locked || !this.spot) return;
    const cash = store.get().cash;
    const welcome = cash >= ROOM_MONEY || store.get().checkedIn;
    if (this.spot === 'bus') {
      this.say('BUS 12.  The timetable is from three years ago.  Nothing is coming.');
      return;
    }
    if (!welcome) {
      audio.sfx('buzzer', 0.4);
      this.say(DOORMAN_NO);
      return;
    }
    if (this.spot === 'doorman') {
      this.say('"Good evening. Reception is straight through."');
      return;
    }
    this.locked = true;
    audio.sfx('door_open');
    fadeToScene(this, 'Hotel', { area: 'lobby' });
  }

  private say(msg: string): void {
    this.mutter.setText(msg).setVisible(true).setAlpha(1);
    const b = this.mutter.getBounds();
    this.mutterPlate.setPosition(b.x - 4, b.y - 3).setDisplaySize(b.width + 8, b.height + 6).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf([this.mutter, this.mutterPlate]);
    this.tweens.add({ targets: [this.mutter, this.mutterPlate], alpha: 0, delay: 3200, duration: 600 });
  }

  update(_t: number, delta: number): void {
    this.purse.setText(`$${store.get().cash}`);
    if (this.locked) {
      this.prompt.setVisible(false);
      return;
    }
    let dx = (this.keys.right?.some((k) => k.isDown) ? 1 : 0) - (this.keys.left?.some((k) => k.isDown) ? 1 : 0);
    if (dx !== 0) this.errand = null;
    if (this.errand) {
      const tx = this.errand === 'door' ? DOOR_X : DOORMAN_X + 14;
      const gap = tx - this.player.x;
      if (Math.abs(gap) <= 2) {
        this.spot = this.errand;
        this.errand = null;
        this.interact();
        return;
      }
      dx = gap > 0 ? 1 : -1;
    }
    this.player.move(dx, 0, delta, new Phaser.Geom.Rectangle(DOOR_X - 4, WALK_Y, WORLD_W - DOOR_X + 4, 0));
    // back to the arcade off the right-hand end
    if (this.player.x >= WORLD_W - 2 && dx > 0) {
      this.locked = true;
      fadeToScene(this, 'ExteriorDay', { fromWest: true });
      return;
    }
    const px = this.player.x;
    this.spot = Math.abs(px - DOOR_X) < 10 ? 'door' : Math.abs(px - DOORMAN_X) < 18 ? 'doorman' : Math.abs(px - BUS_X - 34) < 14 ? 'bus' : null;
    if (!this.spot) {
      this.prompt.setVisible(false);
      return;
    }
    const label = this.spot === 'door' ? '[E] GO IN' : this.spot === 'doorman' ? '[E] TALK' : '[E] READ';
    // (not while a line is being said: the two would sit on top of each other)
    this.prompt.setText(label).setPosition(px, WALK_Y - 36).setVisible(!(this.mutter.visible && this.mutter.alpha > 0.2));
  }
}
