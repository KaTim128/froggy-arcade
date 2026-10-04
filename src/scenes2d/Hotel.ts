/**
 * ---- THE GRAND LILY HOTEL.  The only safe place there is.
 *
 * Four places, walked side-on like the street:
 *
 *   THE LOBBY.  The doors behind you, the reception desk in the middle with a
 *   clerk behind it and a bell on it, and the lift on the right.  A room is
 *   $300 -- cash, and only cash -- and checking in asks before it takes it.
 *   The lift is for guests.
 *
 *   THE LIFT.  Up to the sixth floor, the numbers counting over the door.
 *
 *   LEVEL 6.  A corridor of numbered doors; yours is 612, at the far end.
 *
 *   ROOM 612.  A bed, a lamp, a window, a lock on the door.  Sleep, and it is
 *   morning -- and the man said he would wait.
 *
 * Nothing follows you in here.  At night the front doors stay shut from this
 * side: nobody is going back out there tonight.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { KEYS } from '../core/input';
import { centerText, confirmDialog, fadeIn, fadeToScene, text } from '../core/ui';
import { openTalkPanel } from '../ui/talkPanel';
import { Player } from '../art/player';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { attachPockets } from '../ui/pockets';

export const ROOM_PRICE = 300;
const WALK_Y = 160;

type Area = 'lobby' | 'lift' | 'corridor' | 'room';
type Spot = 'out' | 'desk' | 'lift' | 'door612' | 'bed' | 'window' | null;

export class Hotel extends Phaser.Scene {
  private area: Area = 'lobby';
  private player: Player | null = null;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private prompt!: Phaser.GameObjects.BitmapText;
  private mutter!: Phaser.GameObjects.BitmapText;
  private spot: Spot = null;
  private locked = false;
  private talk: Phaser.GameObjects.Container | null = null;
  private goingUp = true;
  private morning = false;

  constructor() {
    super('Hotel');
  }

  init(data: { area?: Area; up?: boolean; morning?: boolean } = {}): void {
    this.area = data.area ?? 'lobby';
    this.goingUp = data.up !== false;
    this.morning = data.morning === true;
  }

  create(): void {
    this.locked = false;
    this.spot = null;
    this.talk = null;
    this.player = null;
    fadeIn(this);
    // Safe: the hotel is the end of the night, whatever is out there.
    store.patch({ reachedHotel: true });
    store.flush();
    audio.setScene({ music: 'lab_calm', ambience: [] });
    const kb = this.input.keyboard;
    const bind = (n: readonly string[]) => (kb ? n.map((k) => kb.addKey(k)) : []);
    this.keys = { left: bind(KEYS.left), right: bind(KEYS.right) };
    kb?.on('keydown-E', () => this.interact());
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setDepth(801).setOrigin(0.5, 0.5).setVisible(false);
    this.mutter = centerText(this, GAME_W / 2, 24, '', PALETTE.cream).setDepth(802).setVisible(false).setMaxWidth(290);

    if (this.area === 'lift') return this.rideLift();
    if (this.area === 'lobby') this.paintLobby();
    else if (this.area === 'corridor') this.paintCorridor();
    else this.paintRoom();
    const startX = this.area === 'lobby' ? (this.goingUp ? 30 : 270) : this.area === 'corridor' ? 34 : 60;
    this.player = new Player(this, startX, WALK_Y, false);
    attachPockets(this, () => this.locked || !!this.talk);
    if (this.morning && this.area === 'room') {
      this.time.delayedCall(700, () => this.say('Morning.  The light is on the bed.  The man said he would wait.'));
    }
  }

  // ------------------------------------------------------------- the places

  private floor(col: number, wall: number): void {
    this.add.rectangle(0, 0, GAME_W, GAME_H, wall).setOrigin(0, 0);
    this.add.rectangle(0, WALK_Y - 4, GAME_W, GAME_H - WALK_Y + 4, col).setOrigin(0, 0);
    this.add.rectangle(0, WALK_Y - 6, GAME_W, 2, 0x3a2418).setOrigin(0, 0);
  }

  private paintLobby(): void {
    this.floor(0x7b2a3a, 0xe8dcc0);
    // wallpaper stripes and a chandelier
    for (let x = 0; x < GAME_W; x += 12) this.add.rectangle(x, 0, 5, WALK_Y - 6, 0xd8c8a8).setOrigin(0, 0);
    this.add.rectangle(GAME_W / 2, 18, 40, 6, PALETTE.gold);
    for (let k = -2; k <= 2; k++) this.add.circle(GAME_W / 2 + k * 8, 24, 2, 0xfff4d0);
    // the doors you came in by
    this.add.rectangle(20, WALK_Y - 6, 26, 56, 0x3a2a24).setOrigin(0.5, 1).setStrokeStyle(1, PALETTE.gold);
    this.add.rectangle(20, WALK_Y - 6, 1, 56, PALETTE.gold).setOrigin(0.5, 1);
    // the desk, the clerk, the bell, the sign
    this.add.rectangle(160, 40, 90, 12, 0x3a2418).setStrokeStyle(1, PALETTE.gold);
    centerText(this, 160, 40, 'RECEPTION', PALETTE.gold);
    this.add.rectangle(160, WALK_Y - 34, 18, 22, 0x2a3a5a).setOrigin(0.5, 1);
    this.add.rectangle(160, WALK_Y - 56, 10, 10, 0xe8b890).setOrigin(0.5, 1);
    this.add.rectangle(160, WALK_Y - 64, 12, 3, 0x2a1a10).setOrigin(0.5, 1);
    this.add.rectangle(160, WALK_Y - 6, 80, 30, 0x6a4a2c).setOrigin(0.5, 1).setStrokeStyle(1, 0x3a2418);
    this.add.rectangle(160, WALK_Y - 36, 84, 3, 0x8a6a4a).setOrigin(0.5, 1);
    this.add.circle(178, WALK_Y - 39, 3, PALETTE.gold);
    // the key board behind the desk
    for (let k = 0; k < 6; k++) this.add.rectangle(128 + k * 12, 62, 6, 6, 0x5a3a20).setStrokeStyle(1, 0x3a2418);
    // the lift
    this.add.rectangle(280, WALK_Y - 6, 30, 52, 0xb8b8b0).setOrigin(0.5, 1).setStrokeStyle(1, 0x5a5a52);
    this.add.rectangle(280, WALK_Y - 6, 1, 52, 0x5a5a52).setOrigin(0.5, 1);
    this.add.rectangle(280, WALK_Y - 64, 18, 7, 0x1a1a1a);
    centerText(this, 280, WALK_Y - 64, '1', 0xff7a3d);
    this.add.circle(299, WALK_Y - 34, 2, 0xffd45e);
    // plants
    for (const px of [60, 236]) {
      this.add.rectangle(px, WALK_Y - 6, 10, 10, 0x8a5a2e).setOrigin(0.5, 1);
      this.add.circle(px, WALK_Y - 22, 9, 0x3f7a4f);
    }
  }

  private paintCorridor(): void {
    this.floor(0x4a2a5a, 0xd8d0c0);
    centerText(this, GAME_W / 2, 12, 'LEVEL 6', 0x5a3a20);
    // the lift you came out of
    this.add.rectangle(18, WALK_Y - 6, 26, 52, 0xb8b8b0).setOrigin(0.5, 1).setStrokeStyle(1, 0x5a5a52);
    centerText(this, 18, WALK_Y - 64, '6', 0xff7a3d);
    // doors 601 to 612, both sides drawn as one wall of doors
    const doors = 6;
    for (let k = 0; k < doors; k++) {
      const x = 60 + k * 44;
      const num = 607 + k;
      this.add.rectangle(x, WALK_Y - 6, 18, 40, 0x6a4a2c).setOrigin(0.5, 1).setStrokeStyle(1, 0x3a2418);
      this.add.circle(x + 6, WALK_Y - 24, 1, PALETTE.gold);
      this.add.rectangle(x, WALK_Y - 52, 16, 7, 0x3a2418);
      centerText(this, x, WALK_Y - 52, `${num}`, PALETTE.gold);
      this.add.rectangle(x + 22, 40, 6, 8, 0xfff4d0, 0.8);
    }
  }

  private paintRoom(): void {
    const day = store.get().timeOfDay === 'day' && this.morning;
    this.floor(0x6a5a4a, 0xc8b8d8);
    // the window: night, or morning
    this.add.rectangle(110, 70, 70, 50, day ? 0x8fd0e8 : 0x14182a).setStrokeStyle(2, 0xf2ead8);
    this.add.rectangle(110, 70, 2, 50, 0xf2ead8);
    if (!day) for (let k = 0; k < 6; k++) this.add.circle(84 + k * 10, 54 + (k % 3) * 9, 0.8, 0xfff4d0);
    else this.add.circle(130, 58, 6, 0xffe090);
    // the bed, the lamp, the door
    this.add.rectangle(230, WALK_Y - 6, 80, 18, 0xf2ead8).setOrigin(0.5, 1).setStrokeStyle(1, 0x8a7a6a);
    this.add.rectangle(230, WALK_Y - 18, 80, 8, 0x3f6fd8).setOrigin(0.5, 1);
    this.add.rectangle(270, WALK_Y - 6, 6, 30, 0x5a3a20).setOrigin(0.5, 1);
    this.add.rectangle(198, WALK_Y - 26, 14, 6, 0xffffff).setOrigin(0.5, 1);
    this.add.rectangle(300, WALK_Y - 30, 4, 10, 0x5a3a20).setOrigin(0.5, 1);
    this.add.triangle(300, WALK_Y - 44, -6, 6, 6, 6, 0, -4, 0xffe090);
    this.add.rectangle(24, WALK_Y - 6, 22, 52, 0x6a4a2c).setOrigin(0.5, 1).setStrokeStyle(1, 0x3a2418);
    centerText(this, 24, WALK_Y - 64, '612', PALETTE.gold);
  }

  /** Up (or down), the numbers counting over the door. */
  private rideLift(): void {
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x8a8a82).setOrigin(0, 0);
    this.add.rectangle(GAME_W / 2, 90, 120, 130, 0x6a6a62).setStrokeStyle(2, 0x3a3a32);
    this.add.rectangle(GAME_W / 2, 30, 30, 12, 0x1a1a1a);
    const num = centerText(this, GAME_W / 2, 30, this.goingUp ? '1' : '6', 0xff7a3d);
    this.add.rectangle(GAME_W / 2 + 46, 90, 8, 30, 0x4a4a42);
    for (let k = 0; k < 6; k++) this.add.circle(GAME_W / 2 + 46, 78 + k * 4.5, 1.4, 0xd8d0c0);
    audio.sfx('ticket_machine', 0.4);
    for (let k = 1; k <= 5; k++) {
      this.time.delayedCall(k * 420, () => {
        num.setText(`${this.goingUp ? 1 + k : 6 - k}`);
        audio.sfx('ui_blip', 0.3);
      });
    }
    this.time.delayedCall(6 * 420, () => {
      audio.sfx('chime', 0.5);
      fadeToScene(this, 'Hotel', { area: this.goingUp ? 'corridor' : 'lobby', up: false });
    });
  }

  // ------------------------------------------------------------- talking

  private interact(): void {
    if (this.locked || this.talk || !this.spot) return;
    const s = store.get();
    switch (this.spot) {
      case 'out':
        if (s.timeOfDay === 'midnight') {
          this.say("I'm not going back out there tonight.");
          return;
        }
        this.locked = true;
        audio.sfx('door_open');
        fadeToScene(this, 'StreetWest', { from: 'hotel' });
        return;
      case 'desk':
        return this.reception();
      case 'lift':
        if (!s.checkedIn) {
          this.say('"Guests only, I\'m afraid. Reception is right here."');
          return;
        }
        this.locked = true;
        fadeToScene(this, 'Hotel', { area: 'lift', up: this.area === 'lobby' });
        return;
      case 'door612':
        this.locked = true;
        audio.sfx('door_open');
        fadeToScene(this, 'Hotel', { area: 'room' });
        return;
      case 'bed':
        return this.sleep();
      case 'window':
        this.say(s.timeOfDay === 'midnight' ? 'The road is dark all the way back. Nothing moves on it. Nothing I can see.' : 'The street, the bus stop, and the arcade sign, small, at the end of it.');
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
        ? `"Good evening. A room for the night is $${ROOM_PRICE}. Cash only."`
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
    confirmDialog(this, {
      lines: [`CHECK IN FOR $${ROOM_PRICE}?`, `YOU HAVE $${cash}.  YOU WILL HAVE $${cash - ROOM_PRICE}.`],
      confirm: 'CHECK IN',
      cancel: 'NO',
      edge: PALETTE.gold,
      onConfirm: () => {
        this.locked = false;
        if (!store.spendCash(ROOM_PRICE)) {
          audio.sfx('buzzer');
          return;
        }
        store.patch({ checkedIn: true });
        store.flush();
        audio.sfx('cha_ching');
        this.openTalk('"Thank you. Room 612, sixth floor. The lift is on your right. Sleep well."', [{ label: 'THANK YOU', fn: () => this.closeTalk() }]);
      },
      onCancel: () => {
        this.locked = false;
      },
    });
  }

  private openTalk(line: string, options: Array<{ label: string; fn: () => void }>): void {
    this.talk = openTalkPanel(this, { who: 'RECEPTION', line, options, color: PALETTE.gold });
  }

  private closeTalk(): void {
    this.talk?.destroy();
    this.talk = null;
  }

  /** Lock the door, lie down, and it is morning. */
  private sleep(): void {
    const s = store.get();
    if (s.timeOfDay === 'day' && this.morning) {
      this.say('I slept. I actually slept.');
      return;
    }
    this.locked = true;
    this.say('I lock the door. For the first time tonight, I feel safe.');
    this.time.delayedCall(1800, () => {
      store.patch({ timeOfDay: 'day', checkedIn: false });
      store.flush();
      fadeToScene(this, 'Hotel', { area: 'room', morning: true });
    });
  }

  private say(msg: string): void {
    this.mutter.setText(msg).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.mutter);
    this.tweens.add({ targets: this.mutter, alpha: 0, delay: 2600, duration: 600 });
  }

  update(_t: number, delta: number): void {
    const p = this.player;
    if (!p) return;
    if (this.locked || this.talk) {
      this.prompt.setVisible(false);
      return;
    }
    const dx = (this.keys.right?.some((k) => k.isDown) ? 1 : 0) - (this.keys.left?.some((k) => k.isDown) ? 1 : 0);
    p.move(dx, 0, delta, new Phaser.Geom.Rectangle(14, WALK_Y, GAME_W - 28, 0));
    const x = p.x;
    if (this.area === 'lobby') this.spot = x < 34 ? 'out' : Math.abs(x - 160) < 26 ? 'desk' : x > 262 ? 'lift' : null;
    else if (this.area === 'corridor') this.spot = x < 34 ? 'lift' : x > 268 ? 'door612' : null;
    else this.spot = x > 196 && x < 264 ? 'bed' : Math.abs(x - 110) < 30 ? 'window' : null;
    if (!this.spot) {
      this.prompt.setVisible(false);
      return;
    }
    const label: Record<Exclude<Spot, null>, string> = {
      out: '[E] OUTSIDE',
      desk: '[E] RECEPTION',
      lift: '[E] LIFT',
      door612: '[E] ROOM 612',
      bed: '[E] SLEEP',
      window: '[E] LOOK OUT',
    };
    this.prompt.setText(label[this.spot]).setPosition(Phaser.Math.Clamp(x, 40, GAME_W - 40), WALK_Y - 40).setVisible(true);
  }
}
