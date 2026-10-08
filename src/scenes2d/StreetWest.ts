/**
 * ---- DOWN THE STREET, LEFT OF THE ARCADE.
 *
 * Off the left edge of the forecourt the pavement carries on: an empty road
 * beside it, a bus stop that no bus comes to, the edge of the forest behind
 * a guardrail, and at the far end, further down than it looks, the hotel -- a
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
import { TokenHud } from '../ui/hud';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { KEYS } from '../core/input';
import { centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { Player } from '../art/player';
import { GAME_H } from '../render/pixelScaler';
import { attachPockets } from '../ui/pockets';
import { ROOM_MONEY } from './PrizeExchange';
import { HOTEL_DOOR, HOTEL_H, HOTEL_W, paintHotel } from '../art/hotel';

export const WORLD_W = 640;
const WALK_Y = 168;
/** The hotel's front, from the left, and its door: the middle of it. */
const HOTEL_X = 4;
const DOOR_X = HOTEL_X + HOTEL_DOOR;
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
    new TokenHud(this);
    attachPockets(this, () => this.locked);
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

  /**
   * The street, the bus stop, the forest and the hotel, painted once.  From
   * the back: the trees, the guardrail along them, the pavement on the far
   * side of the road with the bus shelter standing on it, the road, and the
   * pavement you walk on.
   */
  private paint(dusk: boolean): void {
    const sky = dusk ? [PALETTE.plum, PALETTE.violet, PALETTE.ember, PALETTE.amber] : [0x8fd0e8, 0x8fd0e8, 0x7ec0dc, 0xbfe0ee];
    for (let i = 0; i < 4; i++) this.add.rectangle(0, i * 18, WORLD_W, 18, sky[i]).setOrigin(0, 0);
    // the sky goes on down to the treeline, and under the trees the forest
    // floor -- nothing behind the street is ever bare black
    this.add.rectangle(0, 72, WORLD_W, 32, sky[3]).setOrigin(0, 0);
    this.add.rectangle(0, 100, WORLD_W, 18, dusk ? 0x1c1828 : 0x2e5e3c).setOrigin(0, 0);
    // the forest behind the fence: three rows of trees, darker nearer
    const rows = dusk ? [0x3a2a4a, 0x2a2238, 0x1c1828] : [0x5a9a6a, 0x3f7a4f, 0x2e5e3c];
    rows.forEach((col, r) => {
      for (let x = 150 + r * 7; x < WORLD_W + 20; x += 15 + r * 3) {
        const h = 26 + ((x * 7 + r * 13) % 18);
        const base = 110 + r * 3;
        this.add.triangle(x, base - h / 2, -9, h / 2, 9, h / 2, 0, -h / 2, col);
      }
    });
    // everything from the guardrail forward, over the trees
    const g = this.add.graphics();
    // ROW Y's, back to front
    const RAIL = 113; // where the guardrail's posts stand, at the forest's edge
    const FAR = 113; // far pavement, to its kerb
    const FAR_KERB = 127;
    const ROAD = 129;
    const NEAR_KERB = 153;
    const NEAR = 156; // the pavement you walk on, to the bottom of the picture
    const X0 = 0; // (the hotel stands over the left-hand end of all of it)
    // a strip of verge along the forest
    g.fillStyle(dusk ? 0x1c1828 : 0x3f7a4f, 1).fillRect(X0, RAIL - 4, WORLD_W - X0, 4);

    // ---- THE GUARDRAIL.  A roadside crash barrier, not a fence: one
    // continuous galvanised W-beam -- two ridges and the groove between them
    // -- bolted through a spacer block to a steel post every couple of metres.
    const beamTop = RAIL - 9;
    const rail = dusk
      ? { post: 0x3a3e46, block: 0x2e3238, face: 0x6a707a, hi: 0x8a909a, groove: 0x4a5058, lo: 0x50565e }
      : { post: 0x5a6068, block: 0x4a5058, face: 0x9aa2aa, hi: 0xd0d6dc, groove: 0x6a727a, lo: 0x7a828a };
    for (let x = X0 + 4; x < WORLD_W; x += 14) {
      g.fillStyle(rail.post, 1).fillRect(x, beamTop + 1, 2, RAIL - beamTop - 1);
      g.fillStyle(rail.block, 1).fillRect(x - 1, beamTop + 2, 4, 3);
    }
    g.fillStyle(rail.face, 1).fillRect(X0, beamTop, WORLD_W - X0, 5);
    g.fillStyle(rail.hi, 1).fillRect(X0, beamTop, WORLD_W - X0, 1);
    g.fillStyle(rail.groove, 1).fillRect(X0, beamTop + 2, WORLD_W - X0, 1);
    g.fillStyle(rail.lo, 1).fillRect(X0, beamTop + 4, WORLD_W - X0, 1);
    // the bolts at each post, and the splice where one length meets the next
    for (let x = X0 + 4; x < WORLD_W; x += 14) g.fillStyle(rail.groove, 1).fillRect(x + 1, beamTop + 1, 1, 1).fillRect(x + 1, beamTop + 3, 1, 1);
    for (let x = X0 + 60; x < WORLD_W; x += 56) g.fillStyle(rail.lo, 1).fillRect(x, beamTop, 1, 5);
    // its shadow on the verge
    g.fillStyle(0x000000, 0.18).fillRect(X0, RAIL - 1, WORLD_W - X0, 1);

    // ---- the far pavement: slabs, and its kerb onto the road
    const slab = dusk ? 0x4a4450 : 0xa8a8a0;
    const joint = dusk ? 0x3a3440 : 0x8e8e86;
    const kerb = dusk ? 0x6a6070 : 0xc8c8c0;
    g.fillStyle(slab, 1).fillRect(X0, FAR, WORLD_W - X0, FAR_KERB - FAR);
    g.fillStyle(joint, 1);
    for (let x = X0; x < WORLD_W; x += 16) g.fillRect(x, FAR, 1, FAR_KERB - FAR);
    g.fillRect(X0, FAR + 6, WORLD_W - X0, 1);
    g.fillStyle(kerb, 1).fillRect(X0, FAR_KERB, WORLD_W - X0, 2);

    // ---- the road: empty, both ways, as far as you can see
    const tar = dusk ? 0x2a2630 : 0x4a4e56;
    g.fillStyle(tar, 1).fillRect(0, ROAD, WORLD_W, NEAR_KERB - ROAD);
    // the grain of it, and the gutters darker along both kerbs
    for (let i = 0; i < 260; i++) {
      const x = (i * 97) % WORLD_W;
      const y = ROAD + 1 + ((i * 53) % (NEAR_KERB - ROAD - 2));
      g.fillStyle(i % 3 ? 0x000000 : 0xffffff, i % 3 ? 0.12 : 0.06).fillRect(x, y, 1, 1);
    }
    g.fillStyle(0x000000, 0.18).fillRect(0, ROAD, WORLD_W, 1).fillRect(0, NEAR_KERB - 1, WORLD_W, 1);
    // edge lines, and the dashes down the middle
    const paint = dusk ? 0x8a7a50 : 0xf2e6c0;
    g.fillStyle(paint, 0.55).fillRect(X0, ROAD + 2, WORLD_W - X0, 1).fillRect(0, NEAR_KERB - 3, WORLD_W, 1);
    g.fillStyle(paint, 1);
    for (let x = 6; x < WORLD_W; x += 26) g.fillRect(x, ROAD + 11, 12, 2);
    // drains in the gutter
    g.fillStyle(0x1a1c22, 1);
    for (const x of [240, 420, 560]) for (let k = 0; k < 4; k++) g.fillRect(x + k * 2, NEAR_KERB - 2, 1, 2);

    // ---- the near kerb and the pavement you walk on
    g.fillStyle(kerb, 1).fillRect(0, NEAR_KERB, WORLD_W, 3);
    g.fillStyle(joint, 1);
    for (let x = 0; x < WORLD_W; x += 12) g.fillRect(x, NEAR_KERB, 1, 3);
    g.fillStyle(dusk ? 0x4a4450 : 0x9a9a92, 1).fillRect(0, NEAR, WORLD_W, GAME_H - NEAR);
    g.fillStyle(joint, 1);
    for (const [y, off] of [
      [NEAR, 0],
      [NEAR + 8, 10],
      [NEAR + 16, 4],
    ] as const) {
      g.fillRect(0, y, WORLD_W, 1);
      for (let x = off; x < WORLD_W; x += 20) g.fillRect(x, y, 1, 8);
    }

    // street lamps, on the far pavement in front of the rail, leaning out
    // over the road
    const lampFoot = FAR + 8;
    for (const lx of [210, 330, 470, 600]) {
      g.fillStyle(0x3a3e44, 1).fillRect(lx - 1, lampFoot - 38, 2, 38);
      g.fillStyle(0x3a3e44, 1).fillRect(lx, lampFoot - 38, 9, 2);
      g.fillStyle(0x2a2e34, 1).fillRect(lx - 2, lampFoot - 2, 4, 2);
      this.add.circle(lx + 9, lampFoot - 35, 2.2, dusk ? 0xffe090 : 0xd8dce0);
      if (dusk) {
        this.add.circle(lx + 9, lampFoot - 26, 12, 0xffe090, 0.08);
        g.fillStyle(0xffe090, 0.06).fillEllipse(lx + 9, ROAD + 6, 30, 6);
      }
    }

    // ---- THE BUS STOP, across the road, on the far pavement with its back
    // to the guardrail, facing the road: a blue roof on two posts, a glass
    // back panel with an advert at one end, a bench under it, and the
    // timetable behind the glass.  No sign.  (A little smaller than it would
    // be on this side: it is the width of the road away.)
    const B = BUS_X;
    const k = 0.8;
    const foot = FAR + 9; // where its posts stand
    const top = foot - Math.round(34 * k);
    const half = Math.round(24 * k);
    const S = (n: number) => Math.round(n * k);
    // its shadow on the slabs
    g.fillStyle(0x000000, 0.14).fillRect(B - half - 2, foot - 1, half * 2 + 4, 2);
    // the back panel: glass in a frame, the advert at the right-hand end
    g.fillStyle(0x8a9aa8, 1).fillRect(B - S(22), top + S(6), S(44), foot - top - S(6) - 2);
    g.fillStyle(0xbfe0ee, dusk ? 0.25 : 0.4).fillRect(B - S(21), top + S(7), S(28), foot - top - S(8) - 2);
    g.fillStyle(dusk ? 0x7b4bd8 : 0xff4fa3, 0.8).fillRect(B + S(8), top + S(7), S(13), foot - top - S(8) - 2);
    g.fillStyle(PALETTE.mossLight, 0.9).fillEllipse(B + S(14), top + S(15), 5, 4);
    g.fillStyle(PALETTE.cream, 0.8).fillRect(B + S(10), top + S(22), S(9), 1);
    g.fillStyle(0xffffff, 0.25);
    for (let i = 0; i < 3; i++) g.fillRect(B - S(18) + i * 2, top + S(9) + i * 2, 1, 4);
    // the timetable, a small sheet behind the glass by the left-hand post
    g.fillStyle(PALETTE.bone, 0.9).fillRect(B - S(20), top + S(9), 5, 6);
    g.fillStyle(0x5a626e, 1).fillRect(B - S(20) + 1, top + S(9) + 1, 3, 1).fillRect(B - S(20) + 1, top + S(9) + 3, 3, 1);
    // the two posts
    g.fillStyle(0x5a626e, 1).fillRect(B - half, top, 2, foot - top).fillRect(B + half - 2, top, 2, foot - top);
    g.fillStyle(0x3a424e, 1).fillRect(B - half + 1, top, 1, foot - top).fillRect(B + half - 1, top, 1, foot - top);
    // the roof: blue, with an edge and its shadow on the glass
    g.fillStyle(0x3f6fd8, 1).fillRect(B - half - 3, top - 3, half * 2 + 6, 3);
    g.fillStyle(0x7fa0ec, 1).fillRect(B - half - 3, top - 3, half * 2 + 6, 1);
    g.fillStyle(0x2a4a9a, 1).fillRect(B - half - 3, top, half * 2 + 6, 1);
    g.fillStyle(0x000000, 0.12).fillRect(B - S(22), top + 1, S(44), 2);
    // the bench, in front of the glass, on its legs
    g.fillStyle(0x8a5a2e, 1).fillRect(B - S(18), foot - 7, S(26), 2);
    g.fillStyle(0x5a3a1e, 1).fillRect(B - S(16), foot - 5, 1, 5).fillRect(B + S(5), foot - 5, 1, 5);
    // ---- the hotel, at the end of the street: the same painting as the
    // front of it at the end of the night road (art/hotel.ts)
    const key = dusk ? 'grand_lily_dusk' : 'grand_lily_day';
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, HOTEL_W, HOTEL_H);
      if (tex) {
        paintHotel(tex.getContext(), { dusk, flat: true });
        tex.refresh();
      }
    }
    this.add.image(HOTEL_X, 158, key).setOrigin(0, 1);
    // the carpet out over the pavement, and at dusk the light from the door on it
    if (dusk) this.add.ellipse(DOOR_X, 161, 76, 9, 0xffc070, 0.22).setBlendMode(Phaser.BlendModes.ADD);
    this.add.rectangle(DOOR_X, 158, 26, 4, 0x7b2a3a).setOrigin(0.5, 0);
    this.add.rectangle(DOOR_X, 158, 26, 1, 0x4a1a24).setOrigin(0.5, 0);
    this.add.rectangle(DOOR_X - 13, 158, 1, 4, 0xc9a24a).setOrigin(0, 0);
    this.add.rectangle(DOOR_X + 12, 158, 1, 4, 0xc9a24a).setOrigin(0, 0);
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
      this.say('The bus stop across the road.  Nothing has stopped there in years.');
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
    this.spot = Math.abs(px - DOOR_X) < 10 ? 'door' : Math.abs(px - DOORMAN_X) < 18 ? 'doorman' : Math.abs(px - BUS_X) < 22 ? 'bus' : null;
    if (!this.spot) {
      this.prompt.setVisible(false);
      return;
    }
    const label = this.spot === 'door' ? '[E] GO IN' : this.spot === 'doorman' ? '[E] TALK' : '[E] LOOK';
    // (not while a line is being said: the two would sit on top of each other)
    this.prompt.setText(label).setPosition(px, WALK_Y - 36).setVisible(!(this.mutter.visible && this.mutter.alpha > 0.2));
  }
}
