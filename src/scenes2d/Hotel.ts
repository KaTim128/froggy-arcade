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
import { TokenHud } from '../ui/hud';
import { PALETTE } from '../render/palette';
import { audio, SILENCE } from '../core/audio';
import { store } from '../core/state';
import { ledger } from '../core/ledger';
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
  LOBBY_W,
  STAIR_DOOR_X,
  STORAGE_X,
  paintRoom,
  paintRoomLight,
  paintView,
  BED,
  DESK,
  WIN_SCALE,
  CEIL_Y,
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
// (to the drifter's scale: a man of 28 behind a 17-pixel desk, head and chest over it)
const CLERK = { x: 160, feet: 150, h: 28 };
const DESK_TOP = DESK.top;
const BOOK = { x: 140, y: DESK.top - 2, w: 11, h: 2 };

type Area = 'lobby' | 'lift' | 'corridor' | 'room' | 'bath';
type Spot = 'out' | 'desk' | 'lift' | 'stairs' | 'stairdoor' | 'storage' | 'door612' | 'roomdoor' | 'bathdoor' | 'bed' | 'window' | 'mirror' | null;
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
  private from: 'outside' | 'lift' | 'room' | 'corridor' | 'stairs' | 'storage' = 'outside';
  /**
   * Down the stairs alive, and him on the stairs behind: seconds since the
   * lobby, and the next blow on the stairwell door.  Hide before he is
   * through it.
   */
  private hideT = 0;
  private bangT = 0;
  private bangs = 0;
  private hunted = false;

  /** The lines being said: one at a time, each skippable. */
  private lines: Array<{ text: string; dur: number; red?: boolean }> = [];
  private lineTimer: Phaser.Time.TimerEvent | null = null;
  private lineUp = false;
  /** Run once, when the lines queued now have all been said. */
  private afterLines: (() => void) | null = null;

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
  // ---- the police, outside, after the night (see startPolice)
  private policeOn = false;
  private policeGlows: Phaser.GameObjects.Image[] = [];
  private policeBeam: Phaser.GameObjects.Image | null = null;
  private policeTint: Phaser.GameObjects.Rectangle | null = null;
  private sirenT = 0;
  private shoutT = 0;
  private shouts = 0;

  constructor() {
    super('Hotel');
  }

  init(data: { area?: Area; up?: boolean; morning?: boolean; late?: boolean; from?: Hotel['from'] } = {}): void {
    this.area = data.area ?? 'lobby';
    this.goingUp = data.up !== false;
    this.morning = data.morning === true;
    this.from = data.from ?? (this.area === 'lobby' && this.goingUp ? 'outside' : 'lift');
    // (no 3 AM, ever, until the hide-and-seek night is survived)
    this.night = data.late && store.get().froggyGone ? 'late' : 'calm';
  }

  create(): void {
    this.locked = false;
    audio.preloadScream();
    this.spot = null;
    this.talk = null;
    this.player = null;
    this.lines = [];
    this.lineTimer = null;
    this.lineUp = false;
    this.afterLines = null;
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
    this.policeOn = false;
    this.policeGlows = [];
    this.policeBeam = null;
    this.policeTint = null;
    this.sirenT = 0;
    this.shoutT = 0;
    this.shouts = 0;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.clerkOn) froggyLayer.clear();
    });
    this.curtainsOpen = this.registry.get('hotelCurtains') !== false;
    fadeIn(this);
    // Safe: the hotel is the end of the night, whatever is out there.
    store.patch({ reachedHotel: true });
    store.flush();
    const calm = this.area === 'room' || this.area === 'bath';
    const dark = this.from === 'stairs' || this.from === 'storage';
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
    // (the lobby is wider than the screen: the words stay put while it scrolls)
    for (const o of [this.mutterPlate, this.mutter, this.tapZone]) o.setScrollFactor(0);
    this.hideT = 0;
    this.bangT = 0;
    this.bangs = 0;
    this.hunted = false;
    this.tapZone.on('pointerdown', () => this.nextLine());

    if (this.area === 'lift') return this.rideLift();
    if (this.area === 'lobby') this.buildLobby(dark);
    else if (this.area === 'corridor') this.buildCorridor();
    else if (this.area === 'bath') this.buildBath();
    else this.buildRoom();

    const startX =
      this.area === 'lobby'
        ? this.from === 'stairs'
          ? STAIR_DOOR_X
          : this.from === 'storage'
            ? STORAGE_X - 20
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
    // cash and tokens, top left, as everywhere else
    new TokenHud(this);

    if (this.area === 'lobby') {
      this.cameras.main.setBounds(0, 0, LOBBY_W, GAME_H);
      if (this.from === 'storage' && store.get().hotelAfter === 'police') {
        // (back to it: the police are still out there)
        this.time.delayedCall(400, () => this.startPolice(false));
      } else if (this.from === 'storage') {
        this.say('Gone...', 2.4);
        this.say('He went straight through the front doors.', 3.2);
        this.say("I'm still here. I'm still alive.", 3);
        // ...and the moment the words are done, the sirens
        this.afterLines = () => this.startPolice(true);
      } else if (dark) {
        // and he is on the stairs behind you
        this.hunted = true;
        this.say('The ground floor...', 2.6);
        this.say('I made it down.', 2.4);
        this.say('Where is everyone?', 3);
      } else if (this.from === 'outside') this.time.delayedCall(500, () => this.say('A safe place to stay the night.', 3));
    }
    if ((this.area === 'corridor' || this.area === 'room' || this.area === 'bath') && store.get().hotelAfter === 'police') {
      this.time.delayedCall(300, () => this.startPolice(false));
    }
    if (this.area === 'room') {
      if (this.night === 'late') this.beginLate(true);
      else if (this.morning) this.time.delayedCall(700, () => this.say('Morning.  The light is on the bed.', 3));
      else if (store.get().hotelAfter !== 'none') {
        if (store.get().hotelAfter === 'police') this.time.delayedCall(700, () => this.say('The window. He left it wide open for me.', 3));
      } else if (this.from !== 'room' && !this.registry.get('hotelRoomSeen')) {
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
    const key = `hotel_lobby_${dark ? 'dark' : night ? 'night' : 'day'}_w${LOBBY_W}`;
    const img = this.add.image(0, 0, this.painted(key, LOBBY_W, GAME_H, (g) => paintLobby(g, night || dark, true))).setOrigin(0, 0);
    this.clerkOn = !dark;
    // the lights are out and the desk is empty
    if (dark) img.setTint(0x3a4058);
    centerText(this, 280, 109, dark ? '-' : '1', 0xff7a3d);
    if (this.from === 'storage') {
      // what he left: the stairwell door hanging open on the dark, and the
      // front doors gone, glass across the marble
      const g = this.add.graphics().setDepth(1);
      g.fillStyle(0x05060a, 1).fillRect(STAIR_DOOR_X - 9, 118, 18, 34);
      g.fillStyle(0x4a3422, 1).fillRect(STAIR_DOOR_X + 6, 118, 4, 34);
      g.fillStyle(0x07101e, 1).fillRect(9, 120, 28, 30);
      g.fillStyle(0x3a4a68, 0.6);
      for (const [x, y, w, h] of [[9, 120, 3, 6], [20, 120, 4, 3], [32, 121, 4, 8], [9, 142, 4, 6], [29, 141, 6, 7]]) g.fillRect(x, y, w, h);
      g.fillStyle(0x9ab8d8, 0.7);
      for (let k = 0; k < 22; k++) g.fillRect(10 + ((k * 37) % 70), 152 + ((k * 13) % 7), 1 + (k % 3), 1);
      g.fillStyle(0x6a4a2e, 1).fillRect(52, 153, 14, 2).fillRect(70, 156, 9, 2);
    }
  }

  private buildCorridor(): void {
    this.add.image(0, 0, this.painted('hotel_corridor_v2', GAME_W, GAME_H, paintCorridor)).setOrigin(0, 0);
    centerText(this, 22, 110, '6', 0xff7a3d);
  }

  private buildBath(): void {
    this.add.image(0, 0, this.painted('hotel_bath_v2', GAME_W, GAME_H, paintBathroom)).setOrigin(0, 0);
    // the mirror: the room behind you in it, and then you
    const m = MIRROR;
    const back = this.add.graphics().setDepth(1);
    back.fillStyle(0xd8e0e4, 1).fillRect(m.x, m.y, m.w, m.h);
    for (let y = m.y; y < m.y + m.h; y += 4) back.fillStyle(0xb8c0c4, 1).fillRect(m.x, y, m.w, 1);
    back.fillStyle(0x7b2a3a, 1).fillRect(m.x, m.y + 15, m.w, 2);
    back.fillStyle(0x9aa6ae, 1).fillRect(m.x + 13, m.y + 2, 6, 13);
    // you, in it: the same drifter, from the coat up.  Stood with his feet
    // eight pixels under the frame, everything below the coat -- the legs --
    // would be under the glass, so it is simply not drawn.
    const twin = new Player(this, 0, 0, false);
    for (const o of twin.sprite.list) {
      const r = o as Phaser.GameObjects.Rectangle;
      if (r.y > -8.6) r.setVisible(false);
    }
    this.reflection = twin.sprite.setDepth(2);
    // the glass over it: a sheen
    const sheen = this.add.graphics().setDepth(3);
    for (let d = 0; d < 6; d++) sheen.fillStyle(0xffffff, 0.08).fillRect(m.x + 2 + d, m.y + 2 + d * 2, 1, 2);
    sheen.fillStyle(0xffffff, 0.06).fillRect(m.x, m.y, m.w, 1);
  }

  private buildRoom(): void {
    const { x, y, w, h } = ROOM_WINDOW;
    const when = this.night === 'late' ? 'late' : this.morning && store.get().timeOfDay === 'day' ? 'day' : 'night';
    this.view = this.add.image(x, y, this.painted(`hotel_view_${when}_${w}`, w, h, (g) => paintView(g, w, h, when))).setOrigin(0, 0).setDepth(1);
    // him: a canvas the size of the window and its margins, drawn every frame once he is there
    this.froggyTex = this.textures.exists('hotel_wfroggy') ? (this.textures.get('hotel_wfroggy') as Phaser.Textures.CanvasTexture) : this.textures.createCanvas('hotel_wfroggy', WF_W, WF_H);
    // (centred on the window, so it can grow from the middle as he comes through)
    this.froggyImg = this.add.image(x + w / 2, y + h / 2, 'hotel_wfroggy').setOrigin(0.5, 0.5).setDepth(2).setScale(WIN_SCALE).setVisible(false);
    // (drawn at his own detail and shown at the window's scale: smooth it down)
    this.textures.get('hotel_wfroggy').setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.glazing = this.add.image(x, y, this.painted(`hotel_glazing_${w}`, w, h, (g) => paintGlazing(g, w, h))).setOrigin(0, 0).setDepth(3);
    this.crackTex = this.textures.exists('hotel_cracks') ? (this.textures.get('hotel_cracks') as Phaser.Textures.CanvasTexture) : this.textures.createCanvas('hotel_cracks', WF.winW, WF.winH);
    this.crackTex?.getContext().clearRect(0, 0, WF.winW, WF.winH);
    // after that night the window stays as he left it: out of its frame
    const broken = store.get().hotelAfter !== 'none';
    if (broken && this.crackTex) drawBrokenEdge(this.crackTex.getContext());
    this.crackTex?.refresh();
    if (broken) this.glazing.setVisible(false);
    this.add.image(x, y, 'hotel_cracks').setOrigin(0, 0).setDepth(4).setScale(WIN_SCALE);
    this.textures.get('hotel_cracks').setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.roomImg = this.add.image(0, 0, this.painted('hotel_room_v2', GAME_W, GAME_H, paintRoom)).setOrigin(0, 0).setDepth(5);
    // the curtains: full width when drawn, squeezed to the sides when open
    const cw = w / 2 + 4;
    const ch = h + 7;
    this.curtainL = this.add.image(x - 6, y - 4, this.painted(`hotel_curtain_l_${cw}`, cw, ch, (g) => paintCurtain(g, cw, ch, -1))).setOrigin(0, 0).setDepth(6);
    this.curtainR = this.add.image(x + w + 6, y - 4, this.painted(`hotel_curtain_r_${cw}`, cw, ch, (g) => paintCurtain(g, cw, ch, 1))).setOrigin(1, 0).setDepth(6);
    this.setCurtains(this.night === 'late' ? false : this.curtainsOpen, true);
    this.lampLight = this.add.image(0, 0, this.painted('hotel_room_light_v2', GAME_W, GAME_H, paintRoomLight)).setOrigin(0, 0).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
    // dust turning slowly in the lamplight
    for (let k = 0; k < 10; k++) {
      const m = this.add.rectangle(230 + Math.random() * 80, CEIL_Y + 8 + Math.random() * 40, 1, 1, 0xfff0c8, 0.5).setDepth(8);
      this.motes.push(m);
    }
    if (broken) {
      // the glass, still all over the floor under it, and the night coming in
      for (let k = 0; k < 60; k++) {
        const sx = x - 30 + Math.random() * (w + 60);
        this.add.rectangle(sx, WALK_Y + 2 + Math.random() * 14, 1 + Math.random() * 3, 1 + Math.random() * 2, 0xdfeaf2, 0.55 + Math.random() * 0.35).setDepth(9).setAngle(Math.random() * 90);
      }
      this.setCurtains(true, true);
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

  // ------------------------------------------------------------- the police

  /**
   * THE POLICE.  The night is over and somebody called it in: sirens in the
   * street, red and blue through every pane of glass, and a megaphone.
   * Outside is the end of it.  Upstairs is the window he left open.
   * The run is saved here: come back to it and they are still out there.
   */
  private startPolice(first: boolean): void {
    if (this.policeOn) return;
    this.policeOn = true;
    if (store.get().hotelAfter !== 'police') {
      store.patch({ hotelAfter: 'police' });
      store.flush();
    }
    const glowKey = this.painted('police_glow', 128, 128, (g) => {
      const r = g.createRadialGradient(64, 64, 2, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 128, 128);
    });
    const beamKey = this.painted('police_beam', 48, 128, (g) => {
      const r = g.createLinearGradient(0, 0, 48, 0);
      r.addColorStop(0, 'rgba(255,255,255,0)');
      r.addColorStop(0.5, 'rgba(255,255,255,0.8)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 48, 128);
    });
    const glow = (x: number, y: number, sx: number, sy: number) =>
      this.add.image(x, y, glowKey).setScale(sx, sy).setBlendMode(Phaser.BlendModes.ADD).setDepth(60).setAlpha(0);
    if (this.area === 'lobby') {
      // through the smashed front doors, onto the floor in front of them,
      // and swept along the walls by the light bars
      this.policeGlows.push(glow(24, 134, 0.8, 0.8), glow(40, 158, 1.8, 0.35), glow(24, 118, 0.5, 0.35));
      // ...and thrown the length of the lobby: up the walls and across the
      // marble, all the way to the far end, so wherever you stand it is on you
      for (const lx of [110, 200, 290, 380]) this.policeGlows.push(glow(lx, 150, 1.4, 0.3), glow(lx + 40, 118, 0.7, 0.4));
      this.policeBeam = this.add.image(0, 128, beamKey).setOrigin(0.5, 0.5).setScale(1.2, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(59).setAlpha(0);
    } else if (this.area === 'room') {
      const { x, y, w, h } = ROOM_WINDOW;
      this.policeGlows.push(glow(x + w / 2, y + h / 2, 1.6, 1.2), glow(x + w / 2, WALK_Y + 6, 2.2, 0.35));
    }
    // and the whole picture breathing red and blue with it
    this.policeTint = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xff0000, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(790).setBlendMode(Phaser.BlendModes.ADD);
    this.sirenT = 0;
    this.shoutT = first ? 1.4 : 6;
    audio.setScene(SILENCE);
    if (first) {
      audio.sfx('siren', 0.7);
      this.time.delayedCall(2600, () => {
        this.say('Sirens...?', 2.2);
        this.say('The police. Right outside.', 2.6);
      });
    } else if (this.area === 'lobby') {
      this.say('They are still out there.', 2.6);
      this.say('Outside to them -- or back up to my room?', 3.4);
    }
  }

  private tickPolice(dt: number): void {
    if (!this.policeOn) return;
    const far = this.area === 'lobby' ? 1 : 0.45;
    this.sirenT -= dt;
    if (this.sirenT <= 0) {
      this.sirenT = 2.05;
      audio.sfx('siren', 0.55 * far);
    }
    // the light bars: red, red, blue, blue, fast
    const ph = Math.floor(this.clock * 6) % 4;
    const red = ph < 2;
    const on = ph % 2 === 0 ? 1 : 0.55;
    const col = red ? 0xff2a3a : 0x2a5aff;
    // (the far glows a beat behind the near ones: the bars turning over)
    this.policeGlows.forEach((g, i) => {
      const c2 = i > 2 && i % 2 ? (red ? 0x2a5aff : 0xff2a3a) : col;
      g.setTint(c2).setAlpha((i > 2 ? 0.32 : 0.55) * on * (0.85 + Math.random() * 0.15));
    });
    if (this.policeBeam) {
      const sweep = (this.clock * 0.55) % 1;
      this.policeBeam.setTint(col).setAlpha(0.22 * on).setPosition(10 + sweep * 300, 128);
    }
    this.policeTint?.setFillStyle(col, 0.08 * on * far);
    // the megaphone, over and over
    if (this.area !== 'lobby') return;
    this.shoutT -= dt;
    if (this.shoutT <= 0) {
      this.shoutT = 13;
      this.shouts++;
      audio.sfx('megaphone', 0.8);
      if (this.shouts === 1) {
        this.say('POLICE: "Put your hands up!"', 2.4, true);
        this.say('POLICE: "You are under arrest! Come outside now!"', 3.4, true);
        this.say("They think I did all this.", 2.6);
        this.say('Outside to them -- or back up to my room?', 3.6);
      } else {
        const lines = ['POLICE: "Come out with your hands up!"', 'POLICE: "This is your last warning! Come outside now!"', 'POLICE: "We know you are in there!"'];
        this.say(lines[(this.shouts - 2) % lines.length], 3, true);
      }
    }
  }

  /** Out of the front doors to them: the end of it. */
  private surrender(): void {
    const c = confirmDialog(this, {
      lines: ['GO OUTSIDE TO THE POLICE?', 'THERE IS NO COMING BACK FROM THIS.'],
      confirm: 'GO OUTSIDE',
      cancel: 'STAY',
      edge: 0xff3a4a,
      onConfirm: () => {
        this.locked = true;
        this.lines = [];
        this.nextLine();
        audio.sfx('door_open', 0.8);
        this.player?.move(-1, 0, 400, new Phaser.Geom.Rectangle(0, WALK_Y, LOBBY_W, 0));
        this.time.delayedCall(500, () => audio.sfx('megaphone', 1));
        this.say('POLICE: "Hands where we can see them! Down on the ground!"', 3, true);
        // slowly, all the way to black
        this.cameras.main.fadeOut(3200, 0, 0, 0);
        this.time.delayedCall(3500, () => this.scene.start('ArrestEnding'));
      },
      onCancel: () => undefined,
    });
    c.setScrollFactor(0);
  }

  /** Out through the hole he left in the glass, onto the roofs. */
  private climbOut(): void {
    this.locked = true;
    this.lines = [];
    this.nextLine();
    // the checkpoint: from here the run comes back on the roofs
    store.patch({ hotelAfter: 'escape' });
    store.flush();
    audio.sfx('glass_crack', 0.6);
    this.say('Up onto the sill... and out.', 2.2);
    this.cameras.main.fadeOut(1100, 0, 0, 0);
    this.time.delayedCall(1300, () => this.scene.start('RooftopEscape', {}));
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
      const then = this.afterLines;
      this.afterLines = null;
      then?.();
      this.tweens.add({ targets: [this.mutter, this.mutterPlate], alpha: 0, duration: 300 });
      return;
    }
    this.lineUp = true;
    this.mutter.setText(l.text).setTint(l.red ? 0xff4a4a : PALETTE.cream).setVisible(true).setAlpha(1);
    const b = this.mutter.getBounds();
    this.mutterPlate.setPosition(b.x - 4, b.y - 3).setDisplaySize(b.width + 8, b.height + 6).setVisible(true).setAlpha(1);
    if (!this.talk) this.tapZone.setInteractive({ useHandCursor: true });
    this.lineTimer = this.time.delayedCall(l.dur * 1000, () => this.nextLine());
  }

  private interact(): void {
    if (this.locked || this.talk || !this.spot) return;
    const s = store.get();
    switch (this.spot) {
      case 'out':
        if (this.policeOn) return this.surrender();
        if (this.from === 'stairs') {
          this.say("Locked. They're locked from the outside.");
          return;
        }
        if (this.from === 'storage') {
          this.say("Smashed wide open. And he's out there, somewhere. Not tonight.");
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
        if (this.from === 'stairs' || this.from === 'storage') {
          this.say('Nobody. The bell, the book, the keys -- and nobody.');
          return;
        }
        return this.reception();
      case 'lift':
        if (this.from === 'stairs' || this.from === 'storage') {
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
        if (this.policeOn) {
          this.locked = true;
          fadeToScene(this, 'Hotel', { area: 'lobby', from: 'storage' });
          return;
        }
        this.say("The stairs. Six floors. I'll take the lift.");
        return;
      case 'stairdoor':
        if (this.from === 'stairs') {
          this.say(this.bangs ? "He's right behind it!" : "I'm not going back in there.");
          return;
        }
        if (this.policeOn) {
          // back up, six floors, to the room and its broken window
          this.locked = true;
          audio.sfx('door_creak', 0.6);
          fadeToScene(this, 'Hotel', { area: 'corridor', from: 'stairs' });
          return;
        }
        if (this.from === 'storage') {
          this.say('Hanging off its hinges. He came through it like it was paper.');
          return;
        }
        this.say("The stairs. I'll take the lift.");
        return;
      case 'storage':
        if (this.from === 'stairs') return this.hide();
        if (this.from === 'storage') {
          this.say("Mops and buckets. I'm not going back in there.");
          return;
        }
        this.say('STAFF ONLY. Locked.');
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
        if (this.policeOn) {
          this.say('Not now. Not with them out there.');
          return;
        }
        return this.askSleep();
      case 'window':
        if (this.night === 'late') return this.reveal();
        if (this.policeOn) return this.climbOut();
        audio.sfx('door_creak', 0.25);
        this.setCurtains(!this.curtainsOpen);
        if (!this.curtainsOpen) return;
        this.time.delayedCall(700, () => this.say(this.morning ? 'The street, the bus stop, and the arcade sign, small, at the end of it.' : 'The moon over the trees. The road I came down, all the way back to the arcade.', 3.4));
        return;
    }
  }

  /**
   * Down the stairs alive -- and he is on the stairs behind you.  A while of
   * quiet, then the stairwell door starts to take it, harder each time, and
   * there is about as long as that lasts to get out of sight.
   */
  private tickHunted(dt: number): void {
    this.hideT += dt;
    if (this.hideT < 8.5) return;
    this.bangT -= dt;
    if (this.bangT > 0) return;
    this.bangs++;
    const hard = Math.min(1, 0.45 + this.bangs * 0.08);
    this.bangT = Math.max(0.9, 1.9 - this.bangs * 0.1);
    audio.sfx('item_thud', hard);
    audio.sfx('door_rattle', hard);
    this.cameras.main.shake(140, 0.0025 + hard * 0.003);
    if (this.bangs === 1) {
      this.lines = [];
      this.nextLine();
      this.say("He's coming down the stairs!", 2.6, true);
      this.say('I need to hide. The storage room, past the lift!', 4, true);
    }
    if (this.bangs === 7) this.say('The door is giving!', 2.4, true);
    // too late: he is through it, and you are standing in the lobby
    if (this.bangs >= 11) this.exposed();
  }

  /** Into the storage room and the door pulled to: from here it is all his. */
  private hide(): void {
    if (this.locked) return;
    this.locked = true;
    this.hunted = false;
    audio.sfx('door_open', 0.7);
    this.player?.sprite.setVisible(false);
    this.time.delayedCall(260, () => audio.sfx('door_shut', 0.5));
    this.cameras.main.fadeOut(420, 0, 0, 0);
    this.time.delayedCall(520, () => this.scene.start('HotelLobby3D', { mode: 'hide' }));
  }

  /** Still out in the open when the stairwell door goes. */
  private exposed(): void {
    if (this.locked) return;
    this.locked = true;
    this.hunted = false;
    audio.sfx('door_smash', 1);
    this.cameras.main.shake(300, 0.012);
    const x = this.player?.x ?? STAIR_DOOR_X;
    this.cameras.main.fadeOut(260, 0, 0, 0);
    this.time.delayedCall(320, () => this.scene.start('HotelLobby3D', { mode: 'exposed', x }));
  }

  private reception(): void {
    const s = store.get();
    if (s.checkedIn) {
      this.openTalk('"Room 612, sixth floor. The lift is on your right."', [{ label: 'THANKS', fn: () => this.closeTalk() }]);
      return;
    }
    // (300 in tokens will do as well as $300: the desk takes either)
    const can = s.cash >= ROOM_PRICE || s.tokens >= ROOM_PRICE;
    this.openTalk(
      can
        ? `"Good evening, welcome to the Grand Lily. A room for the night is $${ROOM_PRICE}, or ${ROOM_PRICE} tokens."`
        : `"A room is $${ROOM_PRICE}, or ${ROOM_PRICE} tokens. You have $${s.cash} and ${s.tokens}. I'm sorry."`,
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
    const { cash, tokens } = store.get();
    const byTokens = cash < ROOM_PRICE;
    this.locked = true;
    this.dialog = confirmDialog(this, {
      lines: byTokens
        ? [`CHECK IN FOR ${ROOM_PRICE} TOKENS?`, `YOU HAVE ${tokens}.  YOU WILL HAVE ${tokens - ROOM_PRICE}.`]
        : [`CHECK IN FOR $${ROOM_PRICE}?`, `YOU HAVE $${cash}.  YOU WILL HAVE $${cash - ROOM_PRICE}.`],
      confirm: 'CHECK IN',
      cancel: 'NO',
      edge: PALETTE.gold,
      onConfirm: () => {
        this.locked = false;
        this.dialog = null;
        if (!(byTokens ? ledger.debit(ROOM_PRICE, 'hotel') : store.spendCash(ROOM_PRICE))) {
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

  /**
   * A panel, and only ever one: whatever was up goes first.
   */
  private openTalk(line: string, options: Array<{ label: string; fn: () => void }>, who = 'RECEPTION'): void {
    this.closeTalk();
    // the words under it are not a button while the panel is up
    this.tapZone.disableInteractive();
    // (each answer takes its own panel down: see ui/talkPanel)
    this.talk = openTalkPanel(this, { who, line, options, color: PALETTE.gold });
  }

  private closeTalk(): void {
    if (this.talk?.active) this.talk.destroy();
    this.talk = null;
    if (this.lineUp) this.tapZone.setInteractive({ useHandCursor: true });
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
    cam.pan(m.x + m.w / 2, m.y + m.h / 2 + 2, 700, 'Sine.easeInOut');
    cam.zoomTo(4, 700, 'Sine.easeInOut');
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
    // Before the hide-and-seek night is behind you, the room is a room: you can
    // be in it, sit in it, but not sleep -- and so nothing comes at 3 AM.
    if (!store.get().froggyGone) {
      this.say("I'm wide awake. Something about tonight isn't finished yet.");
      return;
    }
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
    // a checkpoint: come back to this run and it is 3 AM, and the knocking
    store.patch({ hotelNight: true });
    store.flush();
    this.lines = [];
    this.nextLine();
    if (this.curtainsOpen) this.setCurtains(false, false, 1400);
    this.say('I lock the door. For the first time tonight, I feel safe.', 3.2);
    // you, in bed, under the covers
    this.time.delayedCall(900, () => {
      this.player?.sprite.setVisible(false);
      this.sleeper = this.add.container(0, 0, [
        // his head on the pillow and the duvet over him, at the bed's scale
        this.add.rectangle(BED.x - 2, BED.top - 4, 5, 4, 0xd8b088).setOrigin(0, 0),
        this.add.rectangle(BED.x - 3, BED.top - 5, 7, 2, 0x5a3a3a).setOrigin(0, 0),
        this.add.rectangle(BED.x - 9, BED.top - 1, 18, 2, 0xe4ded0).setOrigin(0, 0),
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
    const t = centerText(this, GAME_W / 2, GAME_H / 2 - 4, '3:00 AM', PALETTE.cream, 16).setDepth(910).setAlpha(0);
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
        // his head on the pillow and the duvet over him, at the bed's scale
        this.add.rectangle(BED.x - 2, BED.top - 4, 5, 4, 0xd8b088).setOrigin(0, 0),
        this.add.rectangle(BED.x - 3, BED.top - 5, 7, 2, 0x5a3a3a).setOrigin(0, 0),
        this.add.rectangle(BED.x - 9, BED.top - 1, 18, 2, 0xe4ded0).setOrigin(0, 0),
      ]).setDepth(9);
      this.roomTint(0.28, 0.75);
    }
    if (this.black) {
      this.black.setFillStyle(0x000000, 1);
      this.tweens.add({ targets: this.black, fillAlpha: 0, duration: retry ? 1200 : 3200, ease: 'Sine.easeOut' });
    }
    if (retry) {
      const t = centerText(this, GAME_W / 2, GAME_H / 2 - 4, '3:00 AM', PALETTE.cream, 16).setDepth(910);
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
    this.froggyImg?.setVisible(true).setTint(0xc4cce2);
    this.drawHim();
    // the camera goes to the glass with you -- he fills it -- then lets go
    const cam = this.cameras.main;
    const { x: wx, y: wy, w: ww, h: wh } = ROOM_WINDOW;
    cam.pan(wx + ww / 2, wy + wh / 2, 220, 'Sine.easeOut');
    cam.zoomTo(2.6, 220, 'Sine.easeOut');
    this.time.delayedCall(820, () => {
      cam.pan(GAME_W / 2, GAME_H / 2, 420, 'Sine.easeInOut');
      cam.zoomTo(1, 420, 'Sine.easeInOut');
    });
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
    // through the frame and down into the room, coming at you
    const e = enter * enter;
    // (off the ledge and down onto the floor of the room, a step toward you)
    this.froggyImg?.setScale(WIN_SCALE * (1 + e * 1.4)).setPosition(ROOM_WINDOW.x + ROOM_WINDOW.w / 2 - e * 18, ROOM_WINDOW.y + ROOM_WINDOW.h / 2 + e * 14);
  }

  /** A blow lands: the crack runs, the room jumps. */
  private blow(i: number): void {
    this.hitsLanded = i + 1;
    audio.sfx('glass_crack', 0.75 + i * 0.04);
    if (i % 3 === 2) audio.sfx('boom', 0.35);
    this.cameras.main.shake(140, 0.006 + i * 0.0012);
    this.froggyImg?.setTint(0xe0e6f4);
    this.time.delayedCall(70, () => this.froggyImg?.setTint(0xc4cce2));
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
      this.time.delayedCall(600, () => this.scene.start('DeathScreen', { key: 'Hotel', data: { area: 'room', late: true }, line: 'He came in through the window.' }));
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
      // (the lobby scrolls past the lift: he stays where his desk is)
      ctx.translate(-this.cameras.main.scrollX, 0);
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
      const sh = ctx.createRadialGradient(CLERK.x + 2, 128, 1, CLERK.x + 2, 128, 11);
      sh.addColorStop(0, 'rgba(8, 4, 16, 0.4)');
      sh.addColorStop(1, 'rgba(8, 4, 16, 0)');
      ctx.fillStyle = sh;
      ctx.fillRect(CLERK.x - 10, 116, 24, 20);
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
      if (m.y < CEIL_Y + 6) m.y = 148;
    }
    if (this.area === 'room') this.tickNight(dt);
    this.tickPolice(dt);
    const p = this.player;
    if (!p) return;
    if (this.area === 'bath' && this.reflection) {
      // you, in the mirror, when you are in front of it
      const near = Math.abs(p.x - (MIRROR.x + MIRROR.w / 2)) < 18;
      this.reflection.setVisible(near).setPosition(Phaser.Math.Clamp(p.x, MIRROR.x + 7, MIRROR.x + MIRROR.w - 7), MIRROR.y + MIRROR.h + 8);
    }
    if (this.locked || this.talk) {
      this.prompt.setVisible(false);
      return;
    }
    const dx = (this.keys.right?.some((k) => k.isDown) ? 1 : 0) - (this.keys.left?.some((k) => k.isDown) ? 1 : 0);
    const worldW = this.area === 'lobby' ? LOBBY_W : GAME_W;
    p.move(dx, 0, delta, new Phaser.Geom.Rectangle(14, WALK_Y, worldW - 28, 0));
    const x = p.x;
    // the lobby runs on past the lift: it scrolls once you are past the desk
    if (this.area === 'lobby') this.cameras.main.scrollX = Phaser.Math.Clamp(x - 250, 0, LOBBY_W - GAME_W);
    if (this.hunted) this.tickHunted(delta / 1000);
    if (this.night === 'reveal') {
      this.prompt.setVisible(false);
      if (x < ROOM_DOOR_X + 10) this.escape();
      return;
    }
    if (this.area === 'lobby')
      this.spot =
        x < 44
          ? 'out'
          : Math.abs(x - 160) < 30
            ? 'desk'
            : Math.abs(x - STAIR_DOOR_X) < 10
              ? 'stairdoor'
              : x > 266 && x < 294
                ? 'lift'
                : Math.abs(x - STORAGE_X) < 10
                  ? 'storage'
                  : null;
    else if (this.area === 'corridor') this.spot = x < 34 ? 'lift' : Math.abs(x - 56) < 10 ? 'stairs' : x > CORRIDOR_DOORS[5] - 16 ? 'door612' : null;
    else if (this.area === 'bath') this.spot = x < 34 ? 'bathdoor' : Math.abs(x - (MIRROR.x + MIRROR.w / 2)) < 16 ? 'mirror' : null;
    else
      this.spot =
        x < ROOM_DOOR_X + 12
          ? 'roomdoor'
          : Math.abs(x - BATH_DOOR_X) < 10
            ? 'bathdoor'
            : Math.abs(x - (ROOM_WINDOW.x + ROOM_WINDOW.w / 2)) < 24
              ? 'window'
              : Math.abs(x - BED.x) < 24
                ? 'bed'
                : null;
    if (!this.spot) {
      this.prompt.setVisible(false);
      return;
    }
    const label: Record<Exclude<Spot, null>, string> = {
      out: this.policeOn ? '[E] GO OUTSIDE TO THE POLICE' : '[E] OUTSIDE',
      desk: '[E] RECEPTION',
      lift: '[E] LIFT',
      stairs: this.policeOn ? '[E] STAIRS DOWN' : '[E] STAIRS',
      stairdoor: this.policeOn ? '[E] BACK UPSTAIRS' : '[E] STAIRS',
      storage: this.from === 'stairs' ? '[E] HIDE IN THE STORAGE ROOM' : '[E] STORAGE ROOM',
      door612: '[E] ROOM 612',
      roomdoor: '[E] CORRIDOR',
      bathdoor: this.area === 'bath' ? '[E] BACK TO THE ROOM' : '[E] BATHROOM',
      bed: '[E] SLEEP',
      window: this.policeOn ? '[E] CLIMB OUT OF THE WINDOW' : this.night === 'late' ? '[E] OPEN THE CURTAINS' : this.curtainsOpen ? '[E] CLOSE THE CURTAINS' : '[E] OPEN THE CURTAINS',
      mirror: '[E] LOOK IN THE MIRROR',
    };
    this.prompt
      .setText(label[this.spot])
      .setTint(this.night === 'late' && this.spot === 'window' ? 0xffb0a0 : PALETTE.gold)
      // (at the desk, on its front: the clerk is where the prompt would go)
      .setPosition(Phaser.Math.Clamp(x, 60, worldW - 90), this.spot === 'desk' ? DESK_TOP + 13 : WALK_Y - 44)
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
