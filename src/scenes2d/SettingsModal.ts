/**
 * Settings, and the pause menu.  PRD §7.3 / AC-1.
 *
 * Three volume sliders that persist across a reload, and a CONTROLS tab.
 *
 * TWO WAYS IN.  From the title screen it is the settings panel, with BACK.
 * Anywhere you are playing it is the PAUSE menu (see core/pause.ts): the room
 * underneath is frozen, the CONTROLS tab lists what THAT place reads -- the
 * cabinet's own keys in a cabinet, the room's in a room, and the thumb
 * version of either on a phone -- and the buttons are RESUME and LEAVE.
 * LEAVE goes to the title screen; from inside a paid game it first asks, and
 * says what walking out will cost, exactly as the cabinet's own QUIT does.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { BRIGHT_MAX, BRIGHT_MIN, LOOK_SENS_MAX, LOOK_SENS_MIN, generalDefaults, store } from '../core/state';
import { QUALITY_NAMES, graphicsChanged, maxQuality, quality } from '../core/graphics';
import { FONT_ADVANCE } from '../render/pixelFont';
import { BINDINGS } from '../core/input';
import { button, centerText, confirmDialog, forfeitLines, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { isTouch } from '../core/device';
import { jumpToScene, leaveToMenu, pausedScene, resumePause } from '../core/pause';
import { ROOM_MONEY } from './PrizeExchange';
import { roomControls, type ControlRow } from '../ui/controlsList';
import type { MinigameScene } from './MinigameScene';

type Tab = 'general' | 'audio' | 'controls' | 'test';

export class SettingsModal extends Phaser.Scene {
  private tab: Tab = 'general';
  private body!: Phaser.GameObjects.Container;
  /** Opened as the pause menu, over a frozen scene. */
  private pause = false;
  private from = '';
  private asking: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('SettingsModal');
  }

  init(data: { from?: string; pause?: boolean }): void {
    this.tab = 'general';
    this.pause = data?.pause === true;
    this.from = data?.from ?? '';
    this.asking = null;
  }

  create(): void {
    // Scene draw order follows the registration list, where this modal sits
    // BEFORE the hub — so launched from there it rendered underneath, and the
    // settings looked like they simply never opened.
    this.scene.bringToTop();
    // Block clicks reaching the scene underneath.
    this.add
      .rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.82)
      .setOrigin(0, 0)
      .setInteractive();

    // 280x162 rather than 250x150: the controls list grew past what the old
    // panel could hold without running its last row under the BACK button.
    this.add.rectangle(GAME_W / 2, GAME_H / 2, 280, 162, PALETTE.ink).setStrokeStyle(1, PALETTE.neon);
    centerText(this, GAME_W / 2, 18, this.pause ? 'PAUSED' : 'SETTINGS', PALETTE.gold, 8);

    // The admin run gets a third tab: jumps to points of the story, for testing.
    const tester = store.isTester();
    button(this, tester ? 81 : 103, 34, 'GENERAL', () => this.setTab('general'), { width: 54, height: 13 });
    button(this, tester ? 135 : 157, 34, 'AUDIO', () => this.setTab('audio'), { width: 46, height: 13 });
    button(this, tester ? 192 : 214, 34, 'CONTROLS', () => this.setTab('controls'), { width: 60, height: 13 });
    if (tester) button(this, 244, 34, 'TEST', () => this.setTab('test'), { width: 40, height: 13, fill: 0x5a3a12 });

    this.body = this.add.container(0, 0);
    this.renderBody();

    if (this.pause) {
      button(this, GAME_W / 2 - 40, 158, 'RESUME', () => resumePause(), { width: 64, height: 13 });
      button(this, GAME_W / 2 + 40, 158, 'LEAVE', () => this.leave(), {
        width: 64,
        height: 13,
        fill: 0x5a1a22,
        hoverFill: 0x8a2b34,
      });
      // Esc (and the gear) are core/pause.ts's: one listener, so a press
      // cannot both close this and reopen it.
    } else {
      button(this, GAME_W / 2, 158, 'BACK', () => this.close(), { width: 60, height: 13 });
      this.input.keyboard?.on('keydown-ESC', () => this.close());
    }
  }

  /**
   * Esc while the LEAVE question is up answers it with CANCEL, rather than
   * closing the whole menu out from under it.
   */
  handleEscape(): boolean {
    if (!this.asking) return false;
    this.asking.destroy();
    this.asking = null;
    return true;
  }

  private setTab(t: Tab): void {
    this.tab = t;
    this.renderBody();
  }

  private close(): void {
    store.flush();
    this.scene.stop();
  }

  /**
   * To the title screen.  Always asked first -- it is a long way back -- and
   * from inside a game that has taken tokens, the question says how many
   * walking out forfeits, and the cabinet's own forfeit is what takes them.
   */
  private leave(): void {
    if (this.asking) return;
    const mg = this.from === 'Minigame' ? (pausedScene() as MinigameScene | null) : null;
    const risk = mg?.forfeitAmount() ?? null;
    const lines =
      risk === null
        ? ['LEAVE TO THE TITLE SCREEN?', 'YOUR PROGRESS IS SAVED.']
        : ['ARE YOU SURE YOU WANT TO QUIT?', ...forfeitLines(risk)];
    this.asking = confirmDialog(this, {
      lines,
      confirm: risk === null ? 'LEAVE' : 'CONFIRM QUIT',
      onConfirm: () => {
        this.asking = null;
        if (mg && risk !== null) {
          resumePause();
          mg.quitTo('StartScreen');
        } else {
          leaveToMenu();
        }
      },
      onCancel: () => {
        this.asking = null;
      },
      edge: risk === null ? PALETTE.neon : 0xc31f2e,
    });
  }

  private renderBody(): void {
    this.body.removeAll(true);
    if (this.tab === 'general') this.renderGeneral();
    else if (this.tab === 'audio') this.renderAudio();
    else if (this.tab === 'test') this.renderTest();
    else if (this.pause) this.renderPlaceControls();
    else this.renderControls();
  }

  /**
   * The pause menu's controls: what the place underneath reads, on this
   * device, as a two-column table.
   */
  private renderPlaceControls(): void {
    const mg = this.from === 'Minigame' ? (pausedScene() as MinigameScene | null) : null;
    const rows: ControlRow[] = mg?.controlRows() ?? roomControls(this.from);
    const max = 9;
    const shown = rows.slice(0, max);
    let y = 50;
    const keyW = Math.min(118, Math.max(...shown.map((r) => r[0].length), 4) * FONT_ADVANCE + 6);
    for (const [keys, does] of shown) {
      this.body.add(text(this, 30, y, keys, PALETTE.gold));
      const room = Math.floor((280 - 16 - keyW - 8) / FONT_ADVANCE);
      this.body.add(text(this, 30 + keyW, y, does.length > room ? does.slice(0, room - 1) + '.' : does, PALETTE.cream));
      y += 9;
    }
    if (!rows.length) this.body.add(centerText(this, GAME_W / 2, 80, isTouch() ? 'TAP WHAT YOU SEE' : 'CLICK WHAT YOU SEE', PALETTE.cream));
  }

  /**
   * ---- THE ADMIN RUN'S TEST BUTTONS.  Only for ADDMIN128 (store.isTester).
   *
   * Each sets the latches the real story would have set by then and starts
   * the real scene: no copies of anything.
   */
  private renderTest(): void {
    const rows: Array<[string, string, () => void]> = [
      [
        'H&S KEY SCENE',
        'BASEMENT: KEY, TURN ROUND',
        () => {
          store.patch({ seenIntro: true, charityUsed: true, hasKey: false, froggyGone: false, route: 'basement', hideRoom: 0, timeOfDay: 'day' });
          store.flush();
          jumpToScene('BasementSequence', { atKey: true });
        },
      ],
      [
        'H&S COMPLETED',
        'SURVIVED, OUTSIDE BY DAY',
        () => {
          store.patch({ seenIntro: true, charityUsed: true, hasKey: true, froggyGone: true, route: 'normal', hideRoom: 0, timeOfDay: 'day' });
          store.flush();
          jumpToScene('ExteriorDay', {});
        },
      ],
      [
        'MIDNIGHT HOTEL RUN',
        `$${ROOM_MONEY}, MIDNIGHT, HOTEL`,
        () => {
          const s = store.get();
          if (s.cash < ROOM_MONEY) store.earnCash(ROOM_MONEY - s.cash);
          store.patch({ seenIntro: true, charityUsed: true, hasKey: true, froggyGone: true, route: 'normal', hideRoom: 0, timeOfDay: 'midnight' });
          store.flush();
          jumpToScene('ExteriorDay', { nightfall: true });
        },
      ],
      [
        'HOTEL ARRIVAL',
        `AFTER THE ROAD: LOBBY, $${ROOM_MONEY}`,
        () => {
          // Exactly where the night road leaves you: through the hotel's doors,
          // midnight, the price of a room in your pocket, not yet checked in.
          const s = store.get();
          if (s.cash < ROOM_MONEY) store.earnCash(ROOM_MONEY - s.cash);
          store.patch({
            seenIntro: true,
            charityUsed: true,
            hasKey: true,
            froggyGone: true,
            route: 'normal',
            hideRoom: 0,
            timeOfDay: 'midnight',
            reachedHotel: true,
            checkedIn: false,
            hotelNight: false,
          });
          store.flush();
          jumpToScene('Hotel', { area: 'lobby' });
        },
      ],
      [
        'LOBBY HIDE',
        'DOWN THE STAIRS: HE FOLLOWS',
        () => {
          // the bottom of the stairwell, survived: the lobby, and him behind
          store.patch({
            seenIntro: true,
            charityUsed: true,
            hasKey: true,
            froggyGone: true,
            route: 'normal',
            hideRoom: 0,
            timeOfDay: 'midnight',
            reachedHotel: true,
            checkedIn: true,
            hotelNight: true,
          });
          store.flush();
          jumpToScene('Hotel', { area: 'lobby', from: 'stairs' });
        },
      ],
    ];
    rows.forEach(([label, what, go], i) => {
      const y = 58 + i * 18;
      this.body.add(button(this, 92, y, label, go, { width: 112, height: 14 }));
      this.body.add(text(this, 152, y - 3, what, PALETTE.ash));
    });
  }

  private renderAudio(): void {
    const rows: Array<[string, 'master' | 'music' | 'sfx']> = [
      ['MASTER', 'master'],
      ['MUSIC', 'music'],
      ['SFX', 'sfx'],
    ];
    rows.forEach(([label, key], i) => {
      const y = 62 + i * 22;
      this.body.add(text(this, 44, y - 4, label, PALETTE.cream));
      this.slider(y, key);
    });
    this.body.add(
      text(this, 44, 136, 'settings persist across a reload', PALETTE.ash, 8).setAlpha(0.7),
    );
  }

  private slider(
    y: number,
    key: 'master' | 'music' | 'sfx' | 'lookSens',
    range: { min: number; max: number; x0?: number; w?: number; suffix?: string } = { min: 0, max: 100 },
  ): void {
    const x0 = range.x0 ?? 116;
    const w = range.w ?? 100;
    const { min, max } = range;
    const k = (v: number) => (v - min) / (max - min);

    const track = this.add.rectangle(x0, y, w, 3, PALETTE.slate).setOrigin(0, 0.5);
    const fill = this.add.rectangle(x0, y, 0, 3, PALETTE.neon).setOrigin(0, 0.5);
    const knob = this.add.rectangle(x0, y, 4, 9, PALETTE.gold);
    const val = text(this, x0 + w + 8, y - 4, '0', PALETTE.cream);

    const refresh = () => {
      const v = store.get().settings[key];
      fill.width = k(v) * w;
      knob.x = x0 + k(v) * w;
      val.setText(String(v).padStart(3, ' ') + (range.suffix ?? ''));
    };

    const setFromX = (px: number) => {
      const v = Math.round(min + Math.max(0, Math.min(1, (px - x0) / w)) * (max - min));
      store.setSettings({ [key]: v });
      audio.applyVolumes(); // PRD AU-6: live
      refresh();
    };

    track.setInteractive(new Phaser.Geom.Rectangle(0, -6, w, 15), Phaser.Geom.Rectangle.Contains);
    track.on('pointerdown', (p: Phaser.Input.Pointer) => {
      setFromX(p.worldX);
      audio.sfx('ui_blip');
    });

    knob.setInteractive({ draggable: true });
    this.input.setDraggable(knob);
    knob.on('drag', (_p: Phaser.Input.Pointer, dx: number) => setFromX(dx));

    refresh();
    this.body.add([track, fill, knob, val]);
  }

  /** PRD §7.3: pixel keycap diagram, generated from BINDINGS -- or, on a
   * phone, what the thumbs do instead. */
  private renderControls(): void {
    if (isTouch()) {
      const rows: ControlRow[] = [
        ['ARROW PAD', 'MOVE / WALK'],
        ['DRAG RIGHT SIDE', 'LOOK AROUND IN 3D'],
        ['TAP', 'USE, SELECT, TALK'],
        ['BUTTONS', 'RUN / CROUCH / JUMP WHEN SHOWN'],
        ['GEAR', 'PAUSE AND SETTINGS'],
      ];
      let ty = 52;
      for (const [k, d] of rows) {
        this.body.add(text(this, 32, ty, k, PALETTE.gold));
        this.body.add(text(this, 128, ty, d, PALETTE.cream));
        ty += 14;
      }
      return;
    }
    // Eleven rows at 9px from y=46 end at 136, clearing BACK at 151.  The
    // longest action reaches x=200 in the 6px-advance font, so the keycaps start
    // at 204 and the widest row (W A S D) still ends inside the panel.
    let y = 42;
    for (const b of BINDINGS) {
      this.body.add(text(this, 32, y, b.action, PALETTE.cream, 8));
      let kx = 204;
      for (const k of b.keys) {
        const w = Math.max(9, k.length * FONT_ADVANCE + 4);
        const cap = this.add.rectangle(kx, y - 2, w, 11, PALETTE.slate).setOrigin(0, 0).setStrokeStyle(1, PALETTE.ash);
        const lbl = centerText(this, kx + w / 2, y + 3.5, k, PALETTE.gold);
        this.body.add([cap, lbl]);
        kx += w + 2;
      }
      y += 9;
    }
    // and the mouse, in the 3D rooms, by the chosen camera mode
    this.body.add(text(this, 32, y, 'Look around (3D)', PALETTE.cream, 8));
    const how = store.get().settings.mouseLook ? 'MOUSE' : 'DRAG';
    const w = how.length * FONT_ADVANCE + 4;
    this.body.add(this.add.rectangle(204, y - 2, w, 11, PALETTE.slate).setOrigin(0, 0).setStrokeStyle(1, PALETTE.ash));
    this.body.add(centerText(this, 204 + w / 2, y + 3.5, how, PALETTE.gold));
  }

  /**
   * GENERAL: what you see and how you look round.  Every change is applied
   * the moment it is made -- the picture, the cursor, the rate -- and saved
   * with the volumes, so it is there next time.
   */
  private renderGeneral(): void {
    const touch = isTouch();
    const set = this.store();
    let y = 50;
    // brightness
    this.body.add(text(this, 32, y - 4, 'BRIGHTNESS', PALETTE.cream, 8));
    this.gslider(y, () => set.get().brightness, (v) => set.put({ brightness: v }), BRIGHT_MIN, BRIGHT_MAX, (v) => `${v}%`);
    y += 15;
    // graphics quality: a stepped slider, LOW to the top level this device gets
    this.body.add(text(this, 32, y - 4, 'GRAPHICS', PALETTE.cream, 8));
    this.gslider(y, () => quality(), (v) => set.put({ quality: v }), 0, maxQuality(), (v) => QUALITY_NAMES[v]);
    y += 15;
    // shadows
    this.body.add(text(this, 32, y - 4, 'SHADOWS', PALETTE.cream, 8));
    this.body.add(this.toggle(146, y, set.get().shadows ? 'ON' : 'OFF', () => set.put({ shadows: !set.get().shadows })));
    y += 15;
    // camera mode (a mouse only)
    if (!touch) {
      this.body.add(text(this, 32, y - 4, 'CAMERA', PALETTE.cream, 8));
      this.body.add(
        this.toggle(146, y, set.get().mouseLook ? 'MOUSE-LOOK' : 'CURSOR', () => set.put({ mouseLook: !set.get().mouseLook }), 64),
      );
      y += 15;
    }
    // sensitivity: the mouse's on a desktop, the thumb's on a phone
    this.body.add(text(this, 32, y - 4, touch ? 'CAMERA SENS' : 'MOUSE SENS', PALETTE.cream, 8));
    if (touch) this.gslider(y, () => set.get().camSens, (v) => set.put({ camSens: v }), LOOK_SENS_MIN, LOOK_SENS_MAX, (v) => `${v}%`);
    else this.gslider(y, () => set.get().lookSens, (v) => set.put({ lookSens: v }), LOOK_SENS_MIN, LOOK_SENS_MAX, (v) => `${v}%`);
    y += 17;
    this.body.add(
      button(this, GAME_W / 2, y, 'RESET TO DEFAULT', () => {
        set.put(generalDefaults());
        this.renderBody();
        this.flash('DEFAULTS RESTORED');
      }, { width: 104, height: 12 }),
    );
    // what the current level means, and whether it took
    const what = ['FASTEST - LIGHT FOLIAGE, SHORT VIEW', 'BALANCED', 'AS DESIGNED', 'SHARPER, FURTHER, CRISP TEXTURES', 'MAXIMUM DETAIL + LENS VIGNETTE'][quality()];
    const note = centerText(this, GAME_W / 2, y + 12, what, PALETTE.ash);
    this.note = note;
    this.body.add(note);
  }

  private note: Phaser.GameObjects.BitmapText | null = null;

  /** Settings read and written, with the side effects applied at once. */
  private store() {
    return {
      get: () => store.get().settings,
      put: (p: Parameters<typeof store.setSettings>[0]) => {
        const was = store.get().settings;
        store.setSettings(p);
        graphicsChanged();
        // mouse-look switched off with the mouse held: let it go now
        if (p.mouseLook === false && document.pointerLockElement) document.exitPointerLock?.();
        if (p.quality !== undefined && p.quality !== was.quality) this.flash(`GRAPHICS: ${QUALITY_NAMES[quality()]}`);
      },
    };
  }

  private flash(msg: string): void {
    if (!this.note) return;
    this.note.setText(msg).setTint(PALETTE.gold);
  }

  private toggle(x: number, y: number, label: string, flip: () => void, width = 40): Phaser.GameObjects.GameObject {
    return button(this, x + width / 2, y, label, () => {
      flip();
      this.renderBody();
    }, { width, height: 11 });
  }

  /** A slider for one setting; `step` 1, values `min`..`max`, live. */
  private gslider(y: number, get: () => number, put: (v: number) => void, min: number, max: number, fmt: (v: number) => string): void {
    const x0 = 120;
    const w = 100;
    const k = (v: number) => (max === min ? 0 : (v - min) / (max - min));
    const track = this.add.rectangle(x0, y, w, 3, PALETTE.slate).setOrigin(0, 0.5);
    const fill = this.add.rectangle(x0, y, 0, 3, PALETTE.neon).setOrigin(0, 0.5);
    // on a stepped slider, a tick for each step
    if (max - min <= 6) {
      for (let v = min; v <= max; v++) this.body.add(this.add.rectangle(x0 + k(v) * w, y, 1, 5, PALETTE.ash));
    }
    const knob = this.add.rectangle(x0, y, 4, 9, PALETTE.gold);
    const val = text(this, x0 + w + 8, y - 4, '', PALETTE.cream);
    const refresh = () => {
      const v = get();
      fill.width = k(v) * w;
      knob.x = x0 + k(v) * w;
      val.setText(fmt(v));
    };
    let last = get();
    const setFromX = (px: number) => {
      const v = Math.round(min + Math.max(0, Math.min(1, (px - x0) / w)) * (max - min));
      if (v === last) return;
      last = v;
      put(v);
      refresh();
    };
    track.setInteractive(new Phaser.Geom.Rectangle(0, -6, w, 15), Phaser.Geom.Rectangle.Contains);
    track.on('pointerdown', (p: Phaser.Input.Pointer) => {
      setFromX(p.worldX);
      audio.sfx('ui_blip');
    });
    knob.setInteractive({ draggable: true });
    this.input.setDraggable(knob);
    knob.on('drag', (_p: Phaser.Input.Pointer, dx: number) => setFromX(dx));
    refresh();
    this.body.add([track, fill, knob, val]);
  }
}
