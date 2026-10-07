/**
 * ---- THE GRAND LILY HOTEL.  The only safe place there is -- until three.
 *
 * Five places, walked side-on like the street, every one painted from the
 * hotel's own palette (art/hotelInterior.ts) so it is one building with the
 * front on the street and the corridor upstairs in 3D:
 *
 *   THE LOBBY.  Marble and walnut under two chandeliers; the glass doors you
 *   came in by, the reception desk with its clerk, its bell and its
 *   pigeonholes, and the lift.  A room is $300 -- cash, only cash -- and
 *   checking in asks before it takes it.  The lift is for guests.
 *
 *   THE LIFT.  Up to the sixth floor, the numbers counting over the door.
 *
 *   LEVEL 6.  Damask and walnut, a carpet with a gold lattice, a row of
 *   numbered doors; yours is 612, at the far end.  The stairs are beside
 *   the lift.
 *
 *   ROOM 612.  Calm: a lamp at each side of a big soft bed, quiet music, and
 *   in the middle of the wall a wide window with the whole night in it --
 *   the moon, the forest, the road you came down, the arcade's sign pink and
 *   tiny at the end of it.  Velvet curtains that open and close.
 *
 *   THE BATHROOM.  White tile, a gilt mirror.  You look awful.
 *
 * THEN, SLEEP.  The curtains drawn, the lamp off, the room going down into
 * the dark slowly, and then nothing -- until 3 AM, and something knocking on
 * the window.  Six floors up.  Open the curtains and he is on the glass, and
 * he starts to come through it: about six seconds of blows, the cracks
 * running further with every one, and then it goes.  The door is the only
 * way out.  Through it, the corridor is the 3D one (HotelHall3D); still in
 * the room when he is in, and it is the scare, and 3 AM again.
 *
 * Every line said here can be clicked or tapped through.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio, SILENCE } from '../core/audio';
import { store } from '../core/state';
import { KEYS } from '../core/input';
import { centerText, confirmDialog, fadeIn, fadeToScene, text } from '../core/ui';
import { openTalkPanel } from '../ui/talkPanel';
import { Player } from '../art/player';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { attachPockets } from '../ui/pockets';
import { isTouch } from '../core/device';
import {
  BATH_DOOR_X,
  CORRIDOR_DOORS,
  MIRROR,
  ROOM_DOOR_X,
  ROOM_WINDOW,
  paintBathroom,
  paintCorridor,
  paintCurtain,
  paintGlazing,
  paintLift,
  paintLobby,
  paintRoom,
  paintRoomLight,
  paintView,
} from '../art/hotelInterior';
import { HITS, WF, WF_H, WF_W, drawBrokenEdge, drawCracks, drawWindowFroggy } from '../art/windowFroggy';
import { runHotelScare } from '../froggy/hotelScare';
import { drawClerk } from '../froggy/clerk';
import { froggyLayer } from '../render/froggyLayer';

export const ROOM_PRICE = 300;
const WALK_Y = 160;
/**
 * The clerk: drawn like every person in the building (froggy/clerk.ts), on
 * the smooth overlay, behind the desk -- clipped at the marble top, with a
 * hole where the player stands and where the guest book lies on the desk.
 */
const CLERK = { x: 160, feet: 132, h: 46 };
const DESK_TOP = 116;
const BOOK = { x: 140, y: 112, w: 15, h: 4 };

type Area = 'lobby' | 'lift' | 'corridor' | 'room' | 'bath';
type Spot = 'out' | 'desk' | 'lift' | 'stairs' | 'door612' | 'roomdoor' | 'bathdoor' | 'bed' | 'window' | 'mirror' | null;
/** Where the night is, in room 612. */
type Night = 'calm' | 'sleeping' | 'late' | 'reveal' | 'gone';

/** The window breaking: when each blow lands, from the curtains opening. */
const FIRST_BLOW = 0.8;
const BLOWS = [0, 0.75, 1.45, 2.1, 2.75, 3.35, 3.95, 4.5].map((t) => FIRST_BLOW + t);
/** The glass goes about six seconds after he is seen, and he is in under a second after that. */
export const SHATTER_AT = 6.0;
const IN_AT = SHATTER_AT + 0.9;
/** How long a blow takes, wind-up to the glass. */
const WINDUP = 0.45;

export class Hotel extends Phaser.Scene {
  private area: Area = 'lobby';
  private player: Player | null = null;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private prompt!: Phaser.GameObjects.BitmapText;
  private mutter!: Phaser.GameObjects.BitmapText;
  private mutterPlate!: Phaser.GameObjects.Rectangle;
  private tapZone!: Phaser.GameObjects.Zone;
  private spot: Spot = null;
  private locked = false;
  private talk: Phaser.GameObjects.Container | null = null;
  private goingUp = true;
  private morning = false;
  private from: 'outside' | 'lift' | 'room' | 'corridor' | 'stairs' = 'outside';

  /** The lines being said: one at a time, each skippable. */
  private lines: Array<{ text: string; dur: number; red?: boolean }> = [];
  private lineTimer: Phaser.Time.TimerEvent | null = null;
  private lineUp = false;

  // ---- room 612
  private night: Night = 'calm';
  private curtainsOpen = true;
  private curtainL: Phaser.GameObjects.Image | null = null;
  private curtainR: Phaser.GameObjects.Image | null = null;
  private view: Phaser.GameObjects.Image | null = null;
  private roomImg: Phaser.GameObjects.Image | null = null;
  private glazing: Phaser.GameObjects.Image | null = null;
  private lampLight: Phaser.GameObjects.Image | null = null;
  private sleeper: Phaser.GameObjects.Container | null = null;
  private black: Phaser.GameObjects.Rectangle | null = null;
  private froggyTex: Phaser.Textures.CanvasTexture | null = null;
  private froggyImg: Phaser.GameObjects.Image | null = null;
  private crackTex: Phaser.Textures.CanvasTexture | null = null;
  private motes: Phaser.GameObjects.Rectangle[] = [];
  /** Seconds since the curtains opened on him. */
  private revealT = 0;
  private hitsLanded = 0;
  private knockT = 0;
  private knocks = 0;
  private runHint: Phaser.GameObjects.BitmapText | null = null;
  private playerCols: Array<{ s: Phaser.GameObjects.Rectangle; col: number }> = [];
  /** The reflection, in the bathroom mirror. */
  private reflection: Phaser.GameObjects.Container | null = null;
  private clock = 0;
  /** The check-in dialog, while it is up: the clerk dims under it. */
  private dialog: Phaser.GameObjects.Container | null = null;
  private clerkOn = false;
  private clerkDimmed = false;

  constructor() {
    super('Hotel');
  }

  init(data: { area?: Area; up?: boolean; morning?: boolean; late?: boolean; from?: Hotel['from'] } = {}): void {
    this.area = data.area ?? 'lobby';
    this.goingUp = data.up !== false;
    this.morning = data.morning === true;
    this.from = data.from ?? (this.area === 'lobby' && this.goingUp ? 'outside' : 'lift');
    this.night = data.late ? 'late' : 'calm';
  }

  create(): void {
    this.locked = false;
    this.spot = null;
    this.talk = null;
    this.player = null;
    this.lines = [];
    this.lineTimer = null;
    this.lineUp = false;
    this.curtainL = this.curtainR = this.view = this.roomImg = this.glazing = this.lampLight = null;
    this.sleeper = this.black = null;
    this.froggyTex = this.crackTex = null;
    this.froggyImg = null;
    this.motes = [];
    this.revealT = 0;
    this.hitsLanded = 0;
    this.knockT = 0;
    this.knocks = 0;
    this.runHint = null;
    this.playerCols = [];
    this.reflection = null;
    this.clock = 0;
    this.dialog = null;
    this.clerkOn = false;
    this.clerkDimmed = false;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.clerkOn) froggyLayer.clear();
    });
    this.curtainsOpen = this.registry.get('hotelCurtains') !== false;
    fadeIn(this);
    // Safe: the hotel is the end of the night, whatever is out there.
    store.patch({ reachedHotel: true });
    store.flush();
    const calm = this.area === 'room' || this.area === 'bath';
    const dark = this.from === 'stairs';
    audio.setScene(this.night === 'late' || dark ? SILENCE : { music: calm ? 'hotel_room' : 'hotel_lobby', ambience: [] });
    const kb = this.input.keyboard;
    const bind = (n: readonly string[]) => (kb ? n.map((k) => kb.addKey(k)) : []);
    this.keys = { left: bind(KEYS.left), right: bind(KEYS.right) };
    kb?.on('keydown-E', () => this.interact());
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setDepth(801).setOrigin(0.5, 0.5).setVisible(false);
    this.mutterPlate = this.add.rectangle(0, 0, 1, 1, PALETTE.black, 0.72).setOrigin(0, 0).setDepth(820).setVisible(false);
    this.mutter = centerText(this, GAME_W / 2, GAME_H - 34, '', PALETTE.cream).setDepth(821).setVisible(false).setMaxWidth(290);
    // the words are the button: a click or a tap on them moves on
    this.tapZone = this.add.zone(0, GAME_H - 76, GAME_W, 76).setOrigin(0, 0).setDepth(850);
    this.tapZone.on('pointerdown', () => this.nextLine());

    if (this.area === 'lift') return this.rideLift();
    if (this.area === 'lobby') this.buildLobby(dark);
    else if (this.area === 'corridor') this.buildCorridor();
    else if (this.area === 'bath') this.buildBath();
    else this.buildRoom();

    const startX =
      this.area === 'lobby'
        ? this.from === 'stairs'
          ? 300
          : this.goingUp
            ? 30
            : 270
        : this.area === 'corridor'
          ? this.from === 'room'
            ? 290
            : 40
          : this.area === 'bath'
            ? 34
            : this.from === 'corridor' || this.from === 'lift'
              ? 34
              : 76;
    this.player = new Player(this, startX, WALK_Y, false);
    this.player.setSurface('carpet');
    this.playerCols = this.player.sprite.list.map((s) => ({ s: s as Phaser.GameObjects.Rectangle, col: (s as Phaser.GameObjects.Rectangle).fillColor }));
    attachPockets(this, () => this.locked || !!this.talk || this.night === 'reveal');

    if (this.area === 'lobby') {
      if (dark) {
        this.say('The ground floor...', 2.6);
        this.say('I made it down.', 2.4);
        this.say('Where is everyone?', 3);
      } else if (this.from === 'outside') this.time.delayedCall(500, () => this.say('A safe place to stay the night.', 3));
    }
    if (this.area === 'room') {
      if (this.night === 'late') this.beginLate(true);
      else if (this.morning) this.time.delayedCall(700, () => this.say('Morning.  The light is on the bed.', 3));
      else if (this.from !== 'room' && !this.registry.get('hotelRoomSeen')) {
        this.registry.set('hotelRoomSeen', true);
        this.time.delayedCall(600, () => {
          this.say('Finally. Somewhere safe.', 2.8);
          this.say('Nothing can get to me up here.', 3);
        });
      }
    }
  }

  // ------------------------------------------------------------- painting

  /** A canvas texture painted once and kept, keyed by what it shows. */
  private painted(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): string {
    if (!this.textures.exists(key)) {
      const t = this.textures.createCanvas(key, w, h);
      if (t) {
        paint(t.getContext());
        t.refresh();
      }
    }
    return key;
  }

  private buildLobby(dark: boolean): void {
    const night = store.get().timeOfDay !== 'day';
    // (the desk is painted empty: the clerk behind it is on the overlay)
    const key = `hotel_lobby_${dark ? 'dark' : night ? 'night' : 'day'}`;
    const img = this.add.image(0, 0, this.painted(key, GAME_W, GAME_H, (g) => paintLobby(g, night || dark, true))).setOrigin(0, 0);
    this.clerkOn = !dark;
    // the lights are out and the desk is empty
    if (dark) img.setTint(0x3a4058);
    centerText(this, 280, 82, dark ? '-' : '1', 0xff7a3d);
  }

  private buildCorridor(): void {
    this.add.image(0, 0, this.painted('hotel_corridor', GAME_W, GAME_H, paintCorridor)).setOrigin(0, 0);
    centerText(this, 22, 87, '6', 0xff7a3d);
  }

  private buildBath(): void {
    this.add.image(0, 0, this.painted('hotel_bath', GAME_W, GAME_H, paintBathroom)).setOrigin(0, 0);
    // the mirror: the room behind you in it, and then you
    const m = MIRROR;
    const back = this.add.graphics().setDepth(1);
    back.fillStyle(0xd8e0e4, 1).fillRect(m.x, m.y, m.w, m.h);
    for (let y = m.y; y < m.y + m.h; y += 5) back.fillStyle(0xb8c0c4, 1).fillRect(m.x, y, m.w, 1);
    back.fillStyle(0x7b2a3a, 1).fillRect(m.x, m.y + 30, m.w, 3);
    back.fillStyle(0x9aa6ae, 1).fillRect(m.x + 26, m.y + 4, 14, 26);
    this.reflection = this.add.container(0, 0).setDepth(2);
    const shape = this.make.graphics({}, false).fillRect(m.x, m.y, m.w, m.h);
    this.reflection.setMask(shape.createGeometryMask());
    const body = [
      this.add.rectangle(0, 0, 10, 8, PALETTE.rust).setOrigin(0.5, 1),
      this.add.rectangle(0, -8, 12, 12, PALETTE.brownLight).setOrigin(0.5, 1),
      this.add.rectangle(0, -20, 8, 8, PALETTE.cream).setOrigin(0.5, 1),
      this.add.rectangle(0, -22, 10, 5, PALETTE.brown).setOrigin(0.5, 1),
      // a face, in the mirror: tired eyes, a flat mouth
      this.add.rectangle(-2, -24, 1, 1, 0x2a1a10).setOrigin(0, 0),
      this.add.rectangle(1, -24, 1, 1, 0x2a1a10).setOrigin(0, 0),
      this.add.rectangle(-2, -23, 1, 1, 0x9a7a6a).setOrigin(0, 0),
      this.add.rectangle(1, -23, 1, 1, 0x9a7a6a).setOrigin(0, 0),
      this.add.rectangle(-1, -21, 3, 1, 0x8a5a4a).setOrigin(0, 0),
    ];
    this.reflection.add(body);
    // the glass over it: a sheen
    const sheen = this.add.graphics().setDepth(3);
    for (let d = 0; d < 12; d++) sheen.fillStyle(0xffffff, 0.08).fillRect(m.x + 4 + d, m.y + 4 + d * 2, 1, 2);
    sheen.fillStyle(0xffffff, 0.06).fillRect(m.x, m.y, m.w, 2);
  }

  private buildRoom(): void {
    const { x, y, w, h } = ROOM_WINDOW;
    const when = this.night === 'late' ? 'late' : this.morning && store.get().timeOfDay === 'day' ? 'day' : 'night';
    this.view = this.add.image(x, y, this.painted(`hotel_view_${when}`, w, h, (g) => paintView(g, w, h, when))).setOrigin(0, 0).setDepth(1);
    // him: a canvas the size of the window and its margins, drawn every frame once he is there
    this.froggyTex = this.textures.exists('hotel_wfroggy') ? (this.textures.get('hotel_wfroggy') as Phaser.Textures.CanvasTexture) : this.textures.createCanvas('hotel_wfroggy', WF_W, WF_H);
    // (centred on the window, so it can grow from the middle as he comes through)
    this.froggyImg = this.add.image(x + w / 2, y + h / 2, 'hotel_wfroggy').setOrigin(0.5, 0.5).setDepth(2).setVisible(false);
    this.glazing = this.add.image(x, y, this.painted('hotel_glazing', w, h, (g) => paintGlazing(g, w, h))).setOrigin(0, 0).setDepth(3);
    this.crackTex = this.textures.exists('hotel_cracks') ? (this.textures.get('hotel_cracks') as Phaser.Textures.CanvasTexture) : this.textures.createCanvas('hotel_cracks', WF.winW, WF.winH);
    this.crackTex?.getContext().clearRect(0, 0, WF.winW, WF.winH);
    this.crackTex?.refresh();
    this.add.image(x, y, 'hotel_cracks').setOrigin(0, 0).setDepth(4);
    this.roomImg = this.add.image(0, 0, this.painted('hotel_room', GAME_W, GAME_H, paintRoom)).setOrigin(0, 0).setDepth(5);
    // the curtains: full width when drawn, squeezed to the sides when open
    const cw = w / 2 + 6;
    const ch = h + 10;
    this.curtainL = this.add.image(x - 8, y - 11, this.painted('hotel_curtain_l', cw, ch, (g) => paintCurtain(g, cw, ch, -1))).setOrigin(0, 0).setDepth(6);
    this.curtainR = this.add.image(x + w + 8, y - 11, this.painted('hotel_curtain_r', cw, ch, (g) => paintCurtain(g, cw, ch, 1))).setOrigin(1, 0).setDepth(6);
    this.setCurtains(this.night === 'late' ? false : this.curtainsOpen, true);
    this.lampLight = this.add.image(0, 0, this.painted('hotel_room_light', GAME_W, GAME_H, paintRoomLight)).setOrigin(0, 0).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
    // dust turning slowly in the lamplight
    for (let k = 0; k < 10; k++) {
      const m = this.add.rectangle(200 + Math.random() * 120, 90 + Math.random() * 50, 1, 1, 0xfff0c8, 0.5).setDepth(8);
      this.motes.push(m);
    }
    this.black = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0).setOrigin(0, 0).setDepth(900);
  }

  /** Draw the curtains (closed) or tie them back (open). */
  private setCurtains(open: boolean, instant = false, ms = 900): void {
    this.curtainsOpen = open;
    if (this.night === 'calm') this.registry.set('hotelCurtains', open);
    const k = open ? 0.24 : 1;
    for (const c of [this.curtainL, this.curtainR]) {
      if (!c) continue;
      this.tweens.killTweensOf(c);
      if (instant) c.setScale(k, 1);
      else this.tweens.add({ targets: c, scaleX: k, duration: ms, ease: 'Sine.easeInOut' });
    }
  }

  /** Darken (or restore) every surface in the room: `k` 1 is lit, lower is darker. */
  private roomTint(k: number, blue = 0): void {
    const col = (v: number, b: number) => Math.max(0, Math.min(255, Math.round(v * k + b)));
    const tint = (col(255, 0) << 16) | (col(255, 0) << 8) | col(255, blue * 60);
    for (const o of [this.view, this.roomImg, this.glazing, this.curtainL, this.curtainR]) o?.setTint(tint);
    for (const { s, col: c } of this.playerCols) {
      const r = (c >> 16) & 255;
      const g = (c >> 8) & 255;
      const b = c & 255;
      s.setFillStyle((col(r, 0) << 16) | (col(g, 0) << 8) | col(b, blue * 30));
    }
    for (const { s } of this.sleeper ? this.sleeper.list.map((o) => ({ s: o as Phaser.GameObjects.Rectangle })) : []) s.setAlpha(Math.max(0.35, k));
  }

  // ------------------------------------------------------------- the lift

  /** Up (or down), the numbers counting over the door. */
  private rideLift(): void {
    this.add.image(0, 0, this.painted('hotel_lift', GAME_W, GAME_H, paintLift)).setOrigin(0, 0);
    const num = centerText(this, GAME_W / 2, 31, this.goingUp ? '1' : '6', 0xff7a3d);
    audio.sfx('ticket_machine', 0.4);
    for (let k = 1; k <= 5; k++) {
      this.time.delayedCall(k * 420, () => {
        num.setText(`${this.goingUp ? 1 + k : 6 - k}`);
        audio.sfx('ui_blip', 0.3);
      });
    }
    this.time.delayedCall(6 * 420, () => {
      audio.sfx('chime', 0.5);
      fadeToScene(this, 'Hotel', { area: this.goingUp ? 'corridor' : 'lobby', up: false, from: 'lift' });
    });
  }

  // ------------------------------------------------------------- talking

  /** Say a line.  Lines queue; a click or a tap on them moves on at once. */
  private say(msg: string, dur = 3, red = false): void {
    this.lines.push({ text: msg, dur, red });
    if (!this.lineUp) this.nextLine();
  }

  /** Say this, now, over whatever was being said. */
  private sayNow(msg: string, dur = 3, red = false): void {
    this.lines = [];
    this.lineUp = false;
    this.say(msg, dur, red);
  }

  private nextLine(): void {
    this.lineTimer?.remove(false);
    this.lineTimer = null;
    const l = this.lines.shift();
    this.tweens.killTweensOf([this.mutter, this.mutterPlate]);
    if (!l) {
      this.lineUp = false;
      this.tapZone.disableInteractive();
      this.tweens.add({ targets: [this.mutter, this.mutterPlate], alpha: 0, duration: 300 });
      return;
    }
    this.lineUp = true;
    this.mutter.setText(l.text).setTint(l.red ? 0xff4a4a : PALETTE.cream).setVisible(true).setAlpha(1);
    const b = this.mutter.getBounds();
    this.mutterPlate.setPosition(b.x - 4, b.y - 3).setDisplaySize(b.width + 8, b.height + 6).setVisible(true).setAlpha(1);
    this.tapZone.setInteractive({ useHandCursor: true });
    this.lineTimer = this.time.delayedCall(l.dur * 1000, () => this.nextLine());
  }

  private interact(): void {
    if (this.locked || this.talk || !this.spot) return;
    const s = store.get();
    switch (this.spot) {
      case 'out':
        if (this.from === 'stairs') {
          this.say("Locked. They're locked from the outside.");
          return;
        }
        if (s.timeOfDay === 'midnight') {
          this.say("I'm not going back out there tonight.");
          return;
        }
        this.locked = true;
        audio.sfx('door_open');
        fadeToScene(this, 'StreetWest', { from: 'hotel' });
        return;
      case 'desk':
        if (this.from === 'stairs') {
          this.say('Nobody. The bell, the book, the keys -- and nobody.');
          return;
        }
        return this.reception();
      case 'lift':
        if (this.from === 'stairs') {
          this.say('Dead. Nothing lights up.');
          return;
        }
        if (!s.checkedIn) {
          this.say('"Guests only, I\'m afraid. Reception is right here."');
          return;
        }
        this.locked = true;
        fadeToScene(this, 'Hotel', { area: 'lift', up: this.area === 'lobby' });
        return;
      case 'stairs':
        this.say("The stairs. Six floors. I'll take the lift.");
        return;
      case 'door612':
        this.locked = true;
        audio.sfx('door_open');
        fadeToScene(this, 'Hotel', { area: 'room', from: 'corridor' });
        return;
      case 'roomdoor':
        if (this.night === 'late') {
          this.say("Whatever it is, it's out there. At the window.");
          return;
        }
        this.locked = true;
        audio.sfx('door_open');
        fadeToScene(this, 'Hotel', { area: 'corridor', from: 'room' });
        return;
      case 'bathdoor':
        if (this.night === 'late') {
          this.say('Not now.');
          return;
        }
        this.locked = true;
        audio.sfx('door_open', 0.6);
        fadeToScene(this, 'Hotel', { area: this.area === 'bath' ? 'room' : 'bath', from: 'room' });
        return;
      case 'mirror':
        return this.lookInMirror();
      case 'bed':
        return this.askSleep();
      case 'window':
        if (this.night === 'late') return this.reveal();
        audio.sfx('door_creak', 0.25);
        this.setCurtains(!this.curtainsOpen);
        if (!this.curtainsOpen) return;
        this.time.delayedCall(700, () => this.say(this.morning ? 'The street, the bus stop, and the arcade sign, small, at the end of it.' : 'The moon over the trees. The road I came down, all the way back to the arcade.', 3.4));
        return;
    }
  }

  private reception(): void {
    const s = store.get();
    if (s.checkedIn) {
      this.openTalk('"Room 612, sixth floor. The lift is on your right."', [{ label: 'THANKS', fn: () => this.closeTalk() }]);
      return;
    }
    const can = s.cash >= ROOM_PRICE;
    this.openTalk(
      can
        ? `"Good evening, welcome to the Grand Lily. A room for the night is $${ROOM_PRICE}. Cash only."`
        : `"A room is $${ROOM_PRICE}, cash. You have $${s.cash}. I'm sorry."`,
      can
        ? [
          { label: `CHECK IN - $${ROOM_PRICE}`, fn: () => this.confirmCheckIn() },
          { label: 'NOT NOW', fn: () => this.closeTalk() },
        ]
        : [{ label: 'OKAY', fn: () => this.closeTalk() }],
    );
  }

  private confirmCheckIn(): void {
    this.closeTalk();
    const cash = store.get().cash;
    this.locked = true;
    this.dialog = confirmDialog(this, {
      lines: [`CHECK IN FOR $${ROOM_PRICE}?`, `YOU HAVE $${cash}.  YOU WILL HAVE $${cash - ROOM_PRICE}.`],
      confirm: 'CHECK IN',
      cancel: 'NO',
      edge: PALETTE.gold,
      onConfirm: () => {
        this.locked = false;
        this.dialog = null;
        if (!store.spendCash(ROOM_PRICE)) {
          audio.sfx('buzzer');
          return;
        }
        store.patch({ checkedIn: true });
        store.flush();
        audio.sfx('cha_ching');
        audio.sfx('bell_ding', 0.5);
        this.openTalk('"Thank you. Room 612, sixth floor. The lift is on your right. Sleep well."', [{ label: 'THANK YOU', fn: () => this.closeTalk() }]);
      },
      onCancel: () => {
        this.locked = false;
        this.dialog = null;
      },
    });
  }

  private openTalk(line: string, options: Array<{ label: string; fn: () => void }>, who = 'RECEPTION'): void {
    this.talk = openTalkPanel(this, { who, line, options, color: PALETTE.gold });
  }

  private closeTalk(): void {
    this.talk?.destroy();
    this.talk = null;
  }

  /** The mirror: close in on it, and on the face in it. */
  private lookInMirror(): void {
    this.locked = true;
    const cam = this.cameras.main;
    const m = MIRROR;
    // The words stay on the screen while the picture closes in: they go on a
    // camera of their own for as long as the close-up lasts.
    const words = [this.mutter, this.mutterPlate, this.tapZone];
    const ui = this.cameras.add(0, 0, GAME_W, GAME_H);
    ui.ignore(this.children.list.filter((o) => !words.includes(o as never)));
    cam.ignore(words);
    cam.pan(m.x + m.w / 2, m.y + m.h / 2 + 4, 700, 'Sine.easeInOut');
    cam.zoomTo(2.6, 700, 'Sine.easeInOut');
    this.time.delayedCall(800, () => {
      this.say('What a day...', 3);
      const back = (): void => {
        cam.pan(GAME_W / 2, GAME_H / 2, 600, 'Sine.easeInOut');
        cam.zoomTo(1, 600, 'Sine.easeInOut');
        this.time.delayedCall(620, () => {
          this.cameras.remove(ui);
          for (const o of words) (o as Phaser.GameObjects.GameObject & { cameraFilter: number }).cameraFilter = 0;
          this.locked = false;
        });
      };
      // back out when the line goes, however it goes
      const wait = this.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          if (this.lineUp) return;
          wait.remove(false);
          back();
        },
      });
    });
  }

  // ------------------------------------------------------------- the night

  private askSleep(): void {
    if (this.night !== 'calm') {
      if (this.night === 'late') this.say("I can't sleep with that noise.");
      return;
    }
    if (this.morning) {
      this.say('I slept. I actually slept.');
      return;
    }
    this.openTalk('The bed is soft, the sheets are cool, and the door is locked.', [
      { label: 'SLEEP', fn: () => { this.closeTalk(); this.sleep(); } },
      { label: 'NOT YET', fn: () => this.closeTalk() },
    ], 'GO TO SLEEP?');
  }

  /**
   * Into bed, the curtains drawn and the lamp off, and the room goes down
   * into the dark slowly -- not a cut.  Then, out of the black, 3 AM.
   */
  private sleep(): void {
    this.locked = true;
    this.night = 'sleeping';
    this.lines = [];
    this.nextLine();
    if (this.curtainsOpen) this.setCurtains(false, false, 1400);
    this.say('I lock the door. For the first time tonight, I feel safe.', 3.2);
    // you, in bed, under the covers
    this.time.delayedCall(900, () => {
      this.player?.sprite.setVisible(false);
      this.sleeper = this.add.container(0, 0, [
        this.add.rectangle(254, 121, 8, 6, PALETTE.cream).setOrigin(0, 0),
        this.add.rectangle(253, 119, 10, 3, PALETTE.brown).setOrigin(0, 0),
        this.add.rectangle(262, 126, 40, 4, 0xe4ded0).setOrigin(0, 0),
      ]).setDepth(9);
      audio.sfx('footstep_carpet', 0.3);
    });
    this.time.delayedCall(2600, () => {
      audio.sfx('lamp_click', 0.6);
      if (this.lampLight) this.tweens.add({ targets: this.lampLight, alpha: 0, duration: 900 });
      for (const m of this.motes) this.tweens.add({ targets: m, alpha: 0, duration: 900 });
    });
    // the long slow fade: the room dims, the music goes, then black
    const fade = { k: 1 };
    this.tweens.add({ targets: fade, k: 0.28, duration: 7000, delay: 2600, ease: 'Sine.easeIn', onUpdate: () => this.roomTint(fade.k, 1 - fade.k) });
    this.time.delayedCall(4200, () => audio.setScene(SILENCE));
    if (this.black) this.tweens.add({ targets: this.black, fillAlpha: 1, duration: 8000, delay: 3200, ease: 'Sine.easeIn' });
    this.time.delayedCall(12500, () => this.threeAM());
  }

  /** Out of the black, slowly: 3 AM.  A click or a tap moves it on. */
  private threeAM(): void {
    const t = centerText(this, GAME_W / 2, GAME_H / 2 - 4, '3 AM', PALETTE.cream, 16).setDepth(910).setAlpha(0);
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      this.tweens.killTweensOf(t);
      this.tweens.add({ targets: t, alpha: 0, duration: 500, onComplete: () => t.destroy() });
      this.input.off('pointerdown', finish);
      this.time.delayedCall(400, () => this.beginLate(false));
    };
    this.tweens.add({ targets: t, alpha: 1, duration: 2600, ease: 'Sine.easeIn' });
    this.time.delayedCall(6200, finish);
    this.time.delayedCall(700, () => this.input.on('pointerdown', finish));
  }

  /**
   * Three in the morning.  Dark and quiet -- and something knocking on the
   * window, outside, six floors up.  The curtains are drawn over it.
   */
  private beginLate(retry: boolean): void {
    this.night = 'late';
    this.locked = true;
    this.lampLight?.setAlpha(0);
    for (const m of this.motes) m.setAlpha(0);
    this.setCurtains(false, true);
    this.roomTint(0.28, 0.75);
    if (!this.sleeper) {
      this.player?.sprite.setVisible(false);
      this.sleeper = this.add.container(0, 0, [
        this.add.rectangle(254, 121, 8, 6, PALETTE.cream).setOrigin(0, 0),
        this.add.rectangle(253, 119, 10, 3, PALETTE.brown).setOrigin(0, 0),
        this.add.rectangle(262, 126, 40, 4, 0xe4ded0).setOrigin(0, 0),
      ]).setDepth(9);
      this.roomTint(0.28, 0.75);
    }
    if (this.black) {
      this.black.setFillStyle(0x000000, 1);
      this.tweens.add({ targets: this.black, fillAlpha: 0, duration: retry ? 1200 : 3200, ease: 'Sine.easeOut' });
    }
    if (retry) {
      const t = centerText(this, GAME_W / 2, GAME_H / 2 - 4, '3 AM', PALETTE.cream, 16).setDepth(910);
      this.tweens.add({ targets: t, alpha: 0, duration: 900, delay: 900, onComplete: () => t.destroy() });
    }
    // the knocking starts in the quiet; you get up to it
    this.knockT = retry ? 1.6 : 3.4;
    this.knocks = 0;
    this.time.delayedCall(retry ? 2400 : 5600, () => {
      this.say('Something is knocking on the window outside...', 3.6);
      this.sleeper?.destroy();
      this.sleeper = null;
      if (this.player) {
        this.player.setPosition(222, WALK_Y);
        this.player.sprite.setVisible(true);
      }
      this.roomTint(0.28, 0.75);
      this.locked = false;
    });
  }

  /** The curtains open on him.  DUN.  Then he starts on the glass. */
  private reveal(): void {
    this.night = 'reveal';
    this.revealT = 0;
    this.hitsLanded = 0;
    this.lines = [];
    this.nextLine();
    this.setCurtains(true, false, 260);
    audio.sfx('door_creak', 0.5);
    this.froggyImg?.setVisible(true).setTint(0xa8b0c8);
    this.drawHim();
    this.time.delayedCall(200, () => {
      audio.sfx('dun', 1);
      audio.sfx('stinger', 0.5);
      this.cameras.main.shake(260, 0.012);
      this.cameras.main.flash(120, 200, 210, 230);
    });
    this.time.delayedCall(900, () => {
      this.sayNow('RUN!', 1.6, true);
      this.say('Get to the door!', 4, true);
      audio.sfx('froggy_screech', 0.7);
    });
    // the way out, pointed at
    this.runHint = text(this, 4, 36, isTouch() ? '<< RUN\nTO THE\nDOOR!' : '<< RUN\nTO THE\nDOOR!\n\nSHIFT\nRUNS', 0xff6a5a).setDepth(830).setAlpha(0);
    this.time.delayedCall(1100, () => this.runHint?.setAlpha(1));
  }

  /** His picture, this frame. */
  private drawHim(): void {
    if (!this.froggyTex) return;
    const g = this.froggyTex.getContext();
    const t = this.revealT;
    // which blow is coming, and where in it he is
    let strike: { side: -1 | 1; k: number; at: { x: number; y: number } } | null = null;
    for (let i = 0; i < BLOWS.length; i++) {
      const start = BLOWS[i] - WINDUP;
      const k = (t - start) / 0.625;
      if (k >= 0 && k <= 1) {
        strike = { side: HITS[i].side, k, at: { x: HITS[i].x, y: HITS[i].y } };
        break;
      }
    }
    const since = BLOWS.reduce((best, b) => (t >= b ? t - b : best), 9);
    const lean = since < 0.25 ? 1 - since / 0.25 : 0;
    const enter = t > SHATTER_AT ? Math.min(1, (t - SHATTER_AT) / (IN_AT - SHATTER_AT)) : 0;
    g.save();
    if (enter === 0) {
      // behind the glass he is only what the window shows
      g.clearRect(0, 0, WF_W, WF_H);
      g.beginPath();
      g.rect(WF.pad, WF.pad, WF.winW, WF.winH);
      g.clip();
    }
    drawWindowFroggy(g, { t: this.clock, maw: 0.55 + Math.min(0.45, t * 0.06), strike, enter, lean });
    g.restore();
    this.froggyTex.refresh();
    // through the frame and down into the room, growing as he comes at you
    const e = enter * enter;
    this.froggyImg?.setScale(1 + e * 0.55).setPosition(ROOM_WINDOW.x + ROOM_WINDOW.w / 2 - e * 18, ROOM_WINDOW.y + ROOM_WINDOW.h / 2 + e * 22);
  }

  /** A blow lands: the crack runs, the room jumps. */
  private blow(i: number): void {
    this.hitsLanded = i + 1;
    audio.sfx('glass_crack', 0.75 + i * 0.04);
    if (i % 3 === 2) audio.sfx('boom', 0.35);
    this.cameras.main.shake(140, 0.006 + i * 0.0012);
    this.froggyImg?.setTint(0xe0e6f4);
    this.time.delayedCall(70, () => this.froggyImg?.setTint(0xa8b0c8));
    const grow = { k: 0 };
    this.tweens.add({
      targets: grow,
      k: 1,
      duration: 160,
      onUpdate: () => {
        if (!this.crackTex) return;
        drawCracks(this.crackTex.getContext(), this.hitsLanded, grow.k);
        this.crackTex.refresh();
      },
    });
    this.glazing?.setX(ROOM_WINDOW.x + (i % 2 ? 1 : -1));
    this.time.delayedCall(60, () => this.glazing?.setX(ROOM_WINDOW.x));
  }

  /** The glass goes. */
  private shatter(): void {
    audio.sfx('glass_shatter', 1);
    audio.sfx('froggy_screech', 1);
    this.cameras.main.shake(380, 0.02);
    this.glazing?.setVisible(false);
    if (this.crackTex) {
      drawBrokenEdge(this.crackTex.getContext());
      this.crackTex.refresh();
    }
    // the pieces, into the room
    const { x, y, w, h } = ROOM_WINDOW;
    for (let k = 0; k < 46; k++) {
      const sx = x + Math.random() * w;
      const sy = y + Math.random() * h;
      const shard = this.add.rectangle(sx, sy, 1 + Math.random() * 3, 1 + Math.random() * 4, 0xdfeaf2, 0.85).setDepth(72).setAngle(Math.random() * 90);
      this.tweens.add({
        targets: shard,
        x: sx + (sx - (x + w / 2)) * (0.6 + Math.random()) + (Math.random() - 0.5) * 40,
        y: WALK_Y - 2 + Math.random() * 16,
        angle: Math.random() * 720,
        duration: 500 + Math.random() * 500,
        ease: 'Quad.easeIn',
        onComplete: () => this.tweens.add({ targets: shard, alpha: 0, duration: 1600, delay: 600, onComplete: () => shard.destroy() }),
      });
    }
    // he comes through: in front of the frame, then in front of everything
    this.froggyImg?.setDepth(70);
    this.froggyImg?.setTint(0xb8c0d4);
  }

  /** Out of the door with him still in the window: into the corridor. */
  private escape(): void {
    this.night = 'gone';
    this.locked = true;
    this.runHint?.destroy();
    audio.sfx('door_open', 1);
    this.time.delayedCall(180, () => audio.sfx('door_shut', 1));
    this.player?.sprite.setVisible(false);
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.time.delayedCall(450, () => this.scene.start('HotelHall3D', {}));
  }

  /** In, and you are still here. */
  private caught(): void {
    this.night = 'gone';
    this.locked = true;
    this.runHint?.destroy();
    runHotelScare(this, () => {
      this.time.delayedCall(900, () => this.scene.restart({ area: 'room', late: true }));
    });
  }

  /** The clerk, each frame: behind the desk, talking while you talk to him. */
  private paintClerk(): void {
    if (!this.clerkOn) return;
    const p = this.player;
    // under the reception panel, he stops at its top edge
    const panelTop = this.talk ? (this.talk.getBounds().top || DESK_TOP) : DESK_TOP;
    const cut = Math.min(DESK_TOP, panelTop);
    const talking = !!this.talk && Math.floor(this.clock / 0.14) % 2 === 0;
    // (only when the dialog comes or goes: the scene fades drive it otherwise)
    const dimmed = !!this.dialog;
    if (dimmed !== this.clerkDimmed) {
      this.clerkDimmed = dimmed;
      froggyLayer.setDim(dimmed ? 0.4 : 1);
    }
    froggyLayer.paint((ctx) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, GAME_W, cut);
      ctx.clip();
      // everything but the player and the guest book on the desk
      ctx.beginPath();
      ctx.rect(0, 0, GAME_W, GAME_H);
      if (p && p.sprite.visible) ctx.rect(p.x - 6, p.y - 30, 12, 30);
      // (holes must not overlap one another: even-odd would cancel them)
      const panel = this.dialog?.list[1] as Phaser.GameObjects.Rectangle | undefined;
      if (panel) {
        // the check-in dialog, in front of everybody
        const b = panel.getBounds();
        ctx.rect(b.x - 1, b.y - 1, b.width + 2, b.height + 2);
      } else {
        ctx.rect(BOOK.x, BOOK.y, BOOK.w, BOOK.h);
        // and the [E] prompt over the desk, which is the player's, not his
        if (this.prompt.visible) {
          const b = this.prompt.getBounds();
          ctx.rect(b.x - 1, b.y - 1, b.width + 2, Math.min(b.height + 2, DESK_TOP - (b.y - 1)));
        }
      }
      ctx.clip('evenodd');
      // his shadow on the pigeonholes behind him
      const sh = ctx.createRadialGradient(CLERK.x + 3, 104, 1, CLERK.x + 3, 104, 18);
      sh.addColorStop(0, 'rgba(8, 4, 16, 0.4)');
      sh.addColorStop(1, 'rgba(8, 4, 16, 0)');
      ctx.fillStyle = sh;
      ctx.fillRect(CLERK.x - 16, 84, 38, 34);
      drawClerk(ctx, { x: CLERK.x, y: CLERK.feet, height: CLERK.h, pose: talking ? 'talk' : 'idle', breath: (this.clock / 4) % 1 });
      ctx.restore();
    });
  }

  update(_t: number, delta: number): void {
    const dt = delta / 1000;
    this.clock += dt;
    this.paintClerk();
    // dust in the lamplight
    for (const [k, m] of this.motes.entries()) {
      m.y -= dt * (1.5 + (k % 3));
      m.x += Math.sin(this.clock * 0.6 + k) * dt * 2;
      if (m.y < 70) m.y = 150;
    }
    if (this.area === 'room') this.tickNight(dt);
    const p = this.player;
    if (!p) return;
    if (this.area === 'bath' && this.reflection) {
      // you, in the mirror, when you are in front of it
      const near = Math.abs(p.x - (MIRROR.x + MIRROR.w / 2)) < 40;
      this.reflection.setVisible(near).setPosition(p.x, MIRROR.y + MIRROR.h + 2);
    }
    if (this.locked || this.talk) {
      this.prompt.setVisible(false);
      return;
    }
    const dx = (this.keys.right?.some((k) => k.isDown) ? 1 : 0) - (this.keys.left?.some((k) => k.isDown) ? 1 : 0);
    p.move(dx, 0, delta, new Phaser.Geom.Rectangle(14, WALK_Y, GAME_W - 28, 0));
    const x = p.x;
    if (this.night === 'reveal') {
      this.prompt.setVisible(false);
      if (x < ROOM_DOOR_X + 10) this.escape();
      return;
    }
    if (this.area === 'lobby') this.spot = x < 44 ? 'out' : Math.abs(x - 160) < 30 ? 'desk' : x > 262 ? 'lift' : null;
    else if (this.area === 'corridor') this.spot = x < 38 ? 'lift' : Math.abs(x - 56) < 10 ? 'stairs' : x > CORRIDOR_DOORS[5] - 16 ? 'door612' : null;
    else if (this.area === 'bath') this.spot = x < 34 ? 'bathdoor' : Math.abs(x - (MIRROR.x + MIRROR.w / 2)) < 16 ? 'mirror' : null;
    else
      this.spot =
        x < ROOM_DOOR_X + 12
          ? 'roomdoor'
          : Math.abs(x - BATH_DOOR_X) < 10
            ? 'bathdoor'
            : Math.abs(x - (ROOM_WINDOW.x + ROOM_WINDOW.w / 2)) < 44
              ? 'window'
              : x > 232 && x < 300
                ? 'bed'
                : null;
    if (!this.spot) {
      this.prompt.setVisible(false);
      return;
    }
    const label: Record<Exclude<Spot, null>, string> = {
      out: '[E] OUTSIDE',
      desk: '[E] RECEPTION',
      lift: '[E] LIFT',
      stairs: '[E] STAIRS',
      door612: '[E] ROOM 612',
      roomdoor: '[E] CORRIDOR',
      bathdoor: this.area === 'bath' ? '[E] BACK TO THE ROOM' : '[E] BATHROOM',
      bed: '[E] SLEEP',
      window: this.night === 'late' ? '[E] OPEN THE CURTAINS' : this.curtainsOpen ? '[E] CLOSE THE CURTAINS' : '[E] OPEN THE CURTAINS',
      mirror: '[E] LOOK IN THE MIRROR',
    };
    this.prompt
      .setText(label[this.spot])
      .setTint(this.night === 'late' && this.spot === 'window' ? 0xffb0a0 : PALETTE.gold)
      // (at the desk, on its front: the clerk is where the prompt would go)
      .setPosition(Phaser.Math.Clamp(x, 60, GAME_W - 60), this.spot === 'desk' ? DESK_TOP + 13 : WALK_Y - 44)
      .setVisible(true);
  }

  /** The knocking, and once the curtains are open, the window going. */
  private tickNight(dt: number): void {
    if (this.night === 'late') {
      this.knockT -= dt;
      if (this.knockT <= 0) {
        // three on the glass, harder as it goes on
        this.knocks++;
        const hard = Math.min(1, 0.45 + this.knocks * 0.12);
        for (let k = 0; k < 3; k++) {
          this.time.delayedCall(k * 230, () => {
            if (this.night !== 'late') return;
            audio.sfx('knock_glass', hard);
            for (const c of [this.curtainL, this.curtainR]) {
              if (!c) continue;
              this.tweens.add({ targets: c, y: c.y + 1, duration: 40, yoyo: true });
            }
          });
        }
        this.knockT = Math.max(2.2, 4 - this.knocks * 0.3);
      }
      return;
    }
    if (this.night !== 'reveal') return;
    const was = this.revealT;
    this.revealT += dt;
    const t = this.revealT;
    BLOWS.forEach((b, i) => {
      if (was < b && t >= b) this.blow(i);
    });
    if (was < SHATTER_AT && t >= SHATTER_AT) this.shatter();
    if (this.runHint) this.runHint.setAlpha(0.55 + Math.sin(this.clock * 9) * 0.45);
    this.drawHim();
    if (t >= IN_AT) this.caught();
  }
}
