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
import { Patrol } from '../game/patrol';
import { clock } from '../game/life';
import { TokenHud } from '../ui/hud';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { KEYS } from '../core/input';
import { centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { LOOKS, Player } from '../art/player';
import { GAME_H } from '../render/pixelScaler';
import { attachPockets } from '../ui/pockets';
import { HOTEL_DOOR, HOTEL_H, HOTEL_W, paintHotel } from '../art/hotel';
import { speak } from '../ui/talkPanel';
import { resumeSpot, trackPlace } from '../game/place';
import { SUBTITLE_Y } from '../ui/plate';

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
  private patrol: Patrol | null = null;

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
    // the sky follows the clock: daylight in the morning, the sun going down
    // from 5 PM, and dark after 7:45 (the story's own evening keeps its dusk)
    const c = clock();
    const dusk = store.get().timeOfDay !== 'day' || c.phase !== 'morning';
    audio.setScene({ music: 'theme_arcade', ambience: ['street_dusk', 'wind_low'] });
    this.paint(dusk, c.dark || store.get().timeOfDay === 'midnight');

    this.player = new Player(this, this.spawn === 'hotel' ? DOOR_X + 10 : WORLD_W - 18, WALK_Y, false);
    this.player.setSurface('gravel');
    // kept with the run, and back on the spot when resumed here (game/place)
    trackPlace(this, () => this.player, {}, resumeSpot(this.sys.settings.data));
    this.cameras.main.setBounds(0, 0, WORLD_W, GAME_H);
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);

    this.patrol = new Patrol({
      scene: this,
      worldW: WORLD_W,
      y: WALK_Y,
      player: () => this.player,
      dark: () => clock().dark || store.get().timeOfDay === 'midnight',
      lock: (on) => ((this.locked = on), on && (this.errand = null)),
      // (and now and then one goes in at Lily's to look round the lobby)
      doors: [{ x: DOOR_X, place: 'lily' }],
    });
    // the purse, fixed to the screen
    // (dropped under the name band: LILY'S CONDOS runs across the top left)
    new TokenHud(this, { y: 24 });
    attachPockets(this, () => this.locked);
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setDepth(801).setOrigin(0.5, 0.5).setVisible(false);
    this.mutterPlate = this.add.rectangle(0, 0, 1, 1, PALETTE.black, 0).setOrigin(0, 0).setDepth(801).setScrollFactor(0).setVisible(false);
    this.mutter = centerText(this, 160, SUBTITLE_Y, '', PALETTE.cream).setDepth(802).setScrollFactor(0).setVisible(false).setMaxWidth(290);

    const kb = this.input.keyboard;
    const bind = (n: readonly string[]) => (kb ? n.map((k) => kb.addKey(k)) : []);
    this.keys = { left: bind(KEYS.left), right: bind(KEYS.right) };
    kb?.on('keydown-E', () => this.interact());
    // tap the doorman or the door to walk there and use it
    this.add.zone(DOOR_X - 10, WALK_Y - 40, 20, 40).setOrigin(0, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.walkTo('door'));

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
  private paint(dusk: boolean, dark = false): void {
    const sky = dark ? [0x070a1c, 0x0c1228, 0x141a36, 0x1e2242] : dusk ? [PALETTE.plum, PALETTE.violet, PALETTE.ember, PALETTE.amber] : [0x8fd0e8, 0x8fd0e8, 0x7ec0dc, 0xbfe0ee];
    for (let i = 0; i < 4; i++) this.add.rectangle(0, i * 18, WORLD_W, 18, sky[i]).setOrigin(0, 0);
    // and after dark, the stars over the forest
    if (dark) for (let k = 0; k < 90; k++) this.add.rectangle((k * 53) % WORLD_W, (k * 29) % 64, 1, 1, 0xfff4d0, 0.4 + (k % 3) * 0.2).setOrigin(0, 0);
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
    // everything from the verge forward, over the trees
    const g = this.add.graphics();
    // ROW Y's, back to front
    const RAIL = 113; // the forest's edge, where the verge meets the far pavement
    const FAR = 113; // far pavement, to its kerb
    const FAR_KERB = 127;
    const ROAD = 129;
    const NEAR_KERB = 153;
    const NEAR = 156; // the pavement you walk on, to the bottom of the picture
    const X0 = 0; // (the hotel stands over the left-hand end of all of it)
    // a strip of verge along the forest
    g.fillStyle(dusk ? 0x1c1828 : 0x3f7a4f, 1).fillRect(X0, RAIL - 4, WORLD_W - X0, 4);

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
    const key = dusk ? 'lily_condos_dusk' : 'lily_condos_day';
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
    if (store.get().hotelAfter === 'escaped' && store.get().arc === 'none') return this.paintAftermath();
    // (no doorman any more: Lily's is flats, and anyone may go in)
  }

  /**
   * ---- THE MORNING AFTER.  The Grand Lily as the night left it: 612's
   * window a black hole six floors up with its curtain hanging out of it,
   * the front doors smashed in and boarded, glass all over the steps, police
   * tape across the whole entrance, and an officer where the doorman stood.
   */
  private paintAftermath(): void {
    const g = this.add.graphics().setDepth(2);
    // 612: top floor, the right-hand window, out of its frame
    const wx = HOTEL_X + 130;
    const wy = 158 - 152 + 22;
    g.fillStyle(0x0a0a0e, 1).fillRect(wx, wy, 10, 11);
    g.fillStyle(0xdfeaf2, 0.85).fillTriangle(wx, wy, wx + 3, wy, wx, wy + 4).fillTriangle(wx + 10, wy + 11, wx + 6, wy + 11, wx + 10, wy + 6);
    g.fillStyle(0x6a1a28, 1).fillRect(wx + 7, wy + 2, 3, 9).fillRect(wx + 9, wy + 9, 2, 6);
    // soot and scrapes down the stone under it
    g.fillStyle(0x2a2420, 0.35).fillRect(wx + 1, wy + 11, 8, 10);
    // the entrance: doors gone, boarded, glass on the steps
    const dx = DOOR_X;
    g.fillStyle(0x0c0a0a, 1).fillRect(dx - 9, 128, 18, 30);
    g.fillStyle(0x8a6a44, 1).fillRect(dx - 11, 134, 22, 3).fillRect(dx - 11, 146, 22, 3);
    g.fillStyle(0xa88a5a, 1).fillRect(dx - 11, 134, 22, 1).fillRect(dx - 11, 146, 22, 1);
    g.fillStyle(0x6a5030, 1).fillRect(dx - 10, 140, 20, 2);
    for (let k = 0; k < 30; k++) {
      g.fillStyle(0xdfeaf2, 0.5 + Math.random() * 0.4).fillRect(dx - 24 + Math.random() * 48, 158 + Math.random() * 10, 1 + Math.random() * 2, 1);
    }
    // debris: a bent door frame, a chunk of the canopy
    g.fillStyle(0xc9a24a, 1).fillRect(dx + 14, 160, 12, 1).fillRect(dx + 25, 156, 1, 5);
    g.fillStyle(0x7b2a3a, 1).fillRect(dx - 30, 162, 10, 3);
    // the tape, on two posts and a cone, sagging, across the whole front
    const tape = (x0: number, x1: number, y: number, sag: number) => {
      for (let x = x0; x <= x1; x++) {
        const t = (x - x0) / (x1 - x0);
        const yy = y + Math.sin(t * Math.PI) * sag;
        g.fillStyle((Math.floor(x / 5) % 2) ? 0xf0d020 : 0x141414, 1).fillRect(x, yy, 1, 2);
      }
    };
    g.fillStyle(0x3a3a3a, 1).fillRect(dx - 40, 148, 2, 20).fillRect(dx + 40, 148, 2, 20);
    g.fillStyle(0xe86020, 1).fillTriangle(dx + 2, 168, dx + 8, 168, dx + 5, 159);
    g.fillStyle(0xf0f0f0, 1).fillRect(dx + 3, 163, 4, 1);
    tape(dx - 40, dx + 41, 150, 3);
    tape(dx - 40, dx + 41, 156, 4);
    // evidence markers on the steps
    for (const [mx, n] of [[dx - 16, 0xe8c020], [dx + 18, 0xe8c020]] as const) g.fillStyle(n, 1).fillTriangle(mx, 167, mx + 4, 167, mx + 2, 163);
    // the officer, where the doorman stood: the same rig, in uniform
    const o = DOORMAN_X;
    this.add.ellipse(o + 1, 158, 16, 3, 0x000000, 0.3).setDepth(3);
    const cop = new Player(this, o, 158, false, LOOKS.officer);
    cop.sprite.setDepth(3);
    cop.stride(-1, 0);
    cop.stand();
    // a notebook out
    cop.sprite.add(this.add.rectangle(-6, -12, 3, 3, 0xe8e4d8));
    // a patrol car at the kerb, its lightbar turning over, slow, in the daylight
    const car = this.add.graphics().setDepth(1);
    const cx = 170;
    car.fillStyle(0xe8e8ec, 1).fillRect(cx, 148, 46, 10).fillRect(cx + 10, 141, 24, 8);
    car.fillStyle(0x1e2a4a, 1).fillRect(cx, 151, 46, 3);
    car.fillStyle(0x2a3a5a, 1).fillRect(cx + 12, 142, 9, 6).fillRect(cx + 23, 142, 9, 6);
    car.fillStyle(0x141414, 1).fillCircle(cx + 9, 158, 4).fillCircle(cx + 37, 158, 4);
    const bar = this.add.rectangle(cx + 22, 139, 12, 2, 0xff2a3a).setDepth(1);
    this.time.addEvent({ delay: 260, loop: true, callback: () => bar.setFillStyle(bar.fillColor === 0xff2a3a ? 0x2a5aff : 0xff2a3a) });
  }

  private talking: Phaser.GameObjects.Container | null = null;

  /** The officer on the hotel steps, in his own box. */
  private officerSays(line: string): void {
    this.talking = speak(this, 'officer', line, () => (this.talking = null));
  }

  private interact(): void {
    if (this.locked || this.talking || !this.spot) return;
    if (store.get().hotelAfter === 'escaped' && store.get().arc === 'none' && this.spot !== 'bus') {
      if (this.spot === 'doorman') {
        this.officerSays('"Who could have done this? They completely trashed the place."');
        return;
      }
      this.officerSays('"Crime scene. Nobody goes in, I\'m afraid."');
      return;
    }
    if (this.spot === 'bus') {
      this.say('The bus stop across the road.  Nothing has stopped there in years.');
      return;
    }
    this.locked = true;
    audio.sfx('door_open');
    this.patrol?.safe();
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
    this.patrol?.update(delta);
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
      this.patrol?.leaveBy('left');
      fadeToScene(this, 'ExteriorDay', { fromWest: true });
      return;
    }
    const px = this.player.x;
    this.spot = Math.abs(px - DOOR_X) < 10 ? 'door' : Math.abs(px - BUS_X) < 22 ? 'bus' : null;
    if (!this.spot) {
      this.prompt.setVisible(false);
      return;
    }
    const label = this.spot === 'door' ? '[E] GO IN' : '[E] LOOK';
    // (not while a line is being said: the two would sit on top of each other)
    this.prompt.setText(label).setPosition(px, WALK_Y - 36).setVisible(!(this.mutter.visible && this.mutter.alpha > 0.2));
  }
}
