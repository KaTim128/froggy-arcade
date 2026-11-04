/**
 * ---- THE ADMIN'S GAME SETTINGS (user, 2 Nov).  the admin profile only: opened from
 * the settings' TEST tab, refused to anyone else (and core/gameConfig
 * refuses their writes as well, whatever opens it).
 *
 *   left     every game that has settings
 *   right    the game picked: each setting with - and +, its value coloured
 *            by where it comes from -- grey the default, green published,
 *            gold a test value not yet published
 *   bottom   SAVE TEST (keep these values in the test zone), RESET TEST
 *            (throw them away), PUBLISH (make them every player's) and
 *            DEFAULTS (this game back to how it shipped) -- the last three
 *            asking first
 *   top      the TEST ZONE switch: on, you play the test values; off, the
 *            live ones like everyone else
 *
 * Nothing here touches a profile's tokens, progress or badges.
 */

import Phaser from 'phaser';
import { store } from '../core/state';
import { button, centerText, confirmDialog, smallText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { adminPassword, rememberPassword } from '../core/adminAuth';
import {
  cfg,
  inTestZone,
  layersOf,
  liveVersion,
  publish,
  resetTest,
  restoreDefaults,
  saveTest,
  schemas,
  serverReachable,
  setTestZone,
  testDirty,
  validate,
  type ConfigResult,
  type ConfigValue,
  type GameSchema,
  type Param,
} from '../core/gameConfig';

const LIST_TOP = 30;
const LIST_ROWS = 10;
const ROW = 11;
const PARAM_TOP = 40;
const PARAM_ROW = 15;
const PARAM_ROWS = 6;

export class AdminConfig extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private gameIx = 0;
  private listTop = 0;
  private paramTop = 0;
  /** What the screen shows for each setting, before it is saved. */
  private draft: Record<string, ConfigValue> = {};
  private msg = '';
  private dialog: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('AdminConfig');
  }

  create(): void {
    this.scene.bringToTop();
    if (!store.isAdmin()) {
      // (a frame later: a scene stopped inside its own create() is set running again after it)
      this.time.delayedCall(0, () => this.scene.stop());
      return;
    }
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05070f, 0.96).setOrigin(0, 0).setInteractive();
    this.layer = this.add.container(0, 0);
    this.draft = {};
    this.msg = '';
    this.input.keyboard?.on('keydown-ESC', () => (this.dialog ? undefined : this.close()));
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (p.x < 112) this.scrollList(dy > 0 ? 1 : -1);
      else this.scrollParams(dy > 0 ? 1 : -1);
    });
    this.draw();
  }

  private get games(): GameSchema[] {
    return schemas();
  }

  private close(): void {
    this.scene.stop();
  }

  /** What a setting shows: the draft if it was touched, else what the test zone would play. */
  private shown(p: Param): ConfigValue {
    if (p.key in this.draft) return this.draft[p.key];
    const l = layersOf(p.key);
    return l.test ?? (p.testOnly ? p.def : l.live ?? p.def);
  }

  private draw(): void {
    this.layer.removeAll(true);
    const L = this.layer;
    // ---- the header
    L.add(this.add.rectangle(0, 0, GAME_W, 14, 0x0a0d1e).setOrigin(0, 0));
    L.add(this.add.rectangle(0, 14, GAME_W, 1, PALETTE.gold, 0.8).setOrigin(0, 0));
    L.add(text(this, 6, 3, 'GAME SETTINGS', PALETTE.gold));
    const zone = inTestZone();
    L.add(button(this, 170, 7, zone ? 'TEST ZONE: ON' : 'TEST ZONE: OFF', () => this.done(setTestZone(!zone)), { width: 92, height: 11, fill: zone ? 0x5a4a10 : 0x1c2142 }));
    L.add(button(this, GAME_W - 24, 7, 'CLOSE', () => this.close(), { width: 40, height: 11 }));
    L.add(smallText(this, 6, 18, `LIVE V${liveVersion()}  -  ${testDirty() ? 'TEST HAS UNPUBLISHED CHANGES' : 'TEST MATCHES LIVE'}`, testDirty() ? PALETTE.gold : PALETTE.ash));
    L.add(smallText(this, GAME_W - 6, 18, serverReachable() ? 'SERVER: ALL PLAYERS' : 'NO SERVER: THIS DEVICE', serverReachable() ? PALETTE.mossLight : PALETTE.ember).setOrigin(1, 0));

    // ---- the games
    const games = this.games;
    L.add(this.add.rectangle(4, LIST_TOP - 3, 104, LIST_ROWS * ROW + 4, 0x10142a).setOrigin(0, 0).setStrokeStyle(1, 0x2a3050));
    games.slice(this.listTop, this.listTop + LIST_ROWS).forEach((g, j) => {
      const i = this.listTop + j;
      const y = LIST_TOP + j * ROW;
      const on = i === this.gameIx;
      const changed = g.params.some((p) => layersOf(p.key).test !== undefined);
      const live = g.params.some((p) => layersOf(p.key).live !== undefined);
      const bg = this.add.rectangle(6, y - 1, 100, ROW - 1, on ? 0x2a3060 : 0x000000, on ? 1 : 0.001).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        this.gameIx = i;
        this.paramTop = 0;
        audio.sfx('ui_blip', 0.4);
        this.draw();
      });
      L.add(bg);
      L.add(smallText(this, 9, y + 2, g.title.slice(0, 22), on ? PALETTE.gold : PALETTE.cream));
      // a dot: gold for a test change waiting, green for published settings
      if (changed || live) L.add(this.add.circle(102, y + 4, 1.5, changed ? PALETTE.gold : PALETTE.mossLight));
    });
    if (games.length > LIST_ROWS) {
      L.add(button(this, 56, LIST_TOP + LIST_ROWS * ROW + 8, '^', () => this.scrollList(-1), { width: 20, height: 9, disabled: this.listTop === 0 }));
      L.add(button(this, 80, LIST_TOP + LIST_ROWS * ROW + 8, 'v', () => this.scrollList(1), { width: 20, height: 9, disabled: this.listTop >= games.length - LIST_ROWS }));
    }

    // ---- the settings of the game picked
    const g = games[this.gameIx];
    const px = 114;
    L.add(this.add.rectangle(px - 2, LIST_TOP - 3, GAME_W - px - 2, PARAM_ROWS * PARAM_ROW + 14, 0x10142a).setOrigin(0, 0).setStrokeStyle(1, 0x2a3050));
    L.add(text(this, px + 2, LIST_TOP, g.title, PALETTE.gold));
    g.params.slice(this.paramTop, this.paramTop + PARAM_ROWS).forEach((p, j) => {
      const y = PARAM_TOP + j * PARAM_ROW;
      const v = this.shown(p);
      const l = layersOf(p.key);
      const drafted = p.key in this.draft;
      // where the value comes from, by its colour
      const col = drafted || l.test !== undefined ? PALETTE.gold : l.live !== undefined ? PALETTE.mossLight : PALETTE.cream;
      L.add(smallText(this, px + 2, y, p.label, p.testOnly ? 0xb88aff : PALETTE.fog));
      if (p.hint) L.add(smallText(this, px + 2, y + 6, p.hint, 0x5a6080));
      const shownV = p.kind === 'choice' ? (p.choices!.find(([c]) => c === v)?.[1] ?? String(v)) : String(v);
      L.add(text(this, 268, y + 1, shownV.slice(0, 12), col).setOrigin(1, 0));
      L.add(button(this, 280, y + 4, '-', () => this.nudge(p, -1), { width: 12, height: 10 }));
      L.add(button(this, 296, y + 4, '+', () => this.nudge(p, 1), { width: 12, height: 10 }));
    });
    if (g.params.length > PARAM_ROWS) {
      const by = PARAM_TOP + PARAM_ROWS * PARAM_ROW - 3;
      L.add(button(this, 290, LIST_TOP + 3, '^', () => this.scrollParams(-1), { width: 14, height: 9, disabled: this.paramTop === 0 }));
      L.add(smallText(this, 230, by + 2, `${this.paramTop + 1}-${Math.min(g.params.length, this.paramTop + PARAM_ROWS)} OF ${g.params.length}`, PALETTE.ash));
      L.add(button(this, 290, by + 4, 'v', () => this.scrollParams(1), { width: 14, height: 9, disabled: this.paramTop >= g.params.length - PARAM_ROWS }));
    }

    // ---- what to do with them
    const by = GAME_H - 12;
    L.add(button(this, 40, by, 'SAVE TEST', () => this.save(), { width: 66, height: 12, fill: 0x1f4a5a }));
    L.add(button(this, 112, by, 'RESET TEST', () => this.ask(['RESET THE TEST ZONE?', 'UNPUBLISHED CHANGES ARE LOST.', 'LIVE SETTINGS ARE NOT TOUCHED.'], 'RESET', () => this.reset()), { width: 70, height: 12 }));
    L.add(button(this, 186, by, 'PUBLISH', () => this.askPublish(), { width: 70, height: 12, fill: 0x4a3a10 }));
    L.add(button(this, 266, by, 'DEFAULTS', () => this.ask([`RESTORE ${g.title}'S DEFAULTS?`, 'ITS LIVE SETTINGS GO BACK TO', 'HOW THE GAME SHIPPED. NO OTHER', 'GAME IS TOUCHED.'], 'RESTORE', () => this.done(restoreDefaults(g.id))), { width: 74, height: 12, fill: 0x2a1424 }));
    if (this.msg) {
      const m = centerText(this, 214, GAME_H - 26, this.msg, PALETTE.gold).setMaxWidth(200);
      L.add(m);
    } else if (Object.keys(this.draft).length) L.add(centerText(this, 214, GAME_H - 26, 'NOT SAVED: PRESS SAVE TEST', PALETTE.ember));
  }

  private scrollList(d: number): void {
    const most = Math.max(0, this.games.length - LIST_ROWS);
    this.listTop = Phaser.Math.Clamp(this.listTop + d, 0, most);
    this.draw();
  }

  private scrollParams(d: number): void {
    const most = Math.max(0, this.games[this.gameIx].params.length - PARAM_ROWS);
    this.paramTop = Phaser.Math.Clamp(this.paramTop + d, 0, most);
    this.draw();
  }

  /** One step of a setting, kept inside its range (a choice goes round its list). */
  private nudge(p: Param, dir: 1 | -1): void {
    const v = this.shown(p);
    let next: ConfigValue | null;
    if (p.kind === 'choice') {
      const cs = p.choices!;
      const i = cs.findIndex(([c]) => c === v);
      next = cs[(i + dir + cs.length) % cs.length][0];
    } else {
      const step = p.step ?? 1;
      const raw = Number(v) + dir * step;
      next = validate(p, Math.max(p.min ?? -Infinity, Math.min(p.max ?? Infinity, p.kind === 'int' ? Math.round(raw) : raw)));
    }
    if (next === null) return;
    this.draft[p.key] = next;
    this.msg = '';
    audio.sfx('ui_hover', 0.4);
    this.draw();
  }

  private save(): void {
    if (!Object.keys(this.draft).length) {
      this.msg = 'NOTHING CHANGED.';
      this.draw();
      return;
    }
    const r = saveTest(this.draft);
    if (r.ok) this.draft = {};
    this.done(r);
  }

  private reset(): void {
    this.draft = {};
    this.done(resetTest());
  }

  private askPublish(): void {
    if (Object.keys(this.draft).length) {
      this.msg = 'SAVE THE TEST FIRST, THEN PUBLISH.';
      this.draw();
      return;
    }
    this.ask(['PUBLISH THE TEST SETTINGS?', 'EVERY PLAYER WILL PLAY THEM', 'FROM THEIR NEXT GAME ON.'], 'PUBLISH', () => this.done(publish()));
  }

  private ask(lines: string[], confirm: string, fn: () => void): void {
    if (this.dialog) return;
    this.dialog = confirmDialog(this, {
      lines,
      confirm,
      onConfirm: () => {
        this.dialog = null;
        fn();
      },
      onCancel: () => {
        this.dialog?.destroy();
        this.dialog = null;
      },
    });
    this.dialog.setDepth(3000);
  }

  private done(r: ConfigResult | Promise<ConfigResult>): void {
    if (r instanceof Promise) {
      // (to the settings server and back: it asks for the password once a session)
      if (!adminPassword()) {
        const pw = typeof window !== 'undefined' ? window.prompt('ADMIN PASSWORD') : null;
        if (!pw || !rememberPassword(pw)) {
          this.done({ ok: false, msg: 'WRONG ADMIN PASSWORD.' });
          return;
        }
      }
      this.msg = 'SENDING...';
      this.draw();
      void r.then((res) => this.scene.isActive() && this.done(res));
      return;
    }
    this.msg = r.msg;
    audio.sfx(r.ok ? 'cha_ching' : 'buzzer', 0.5);
    this.draw();
  }
}

// (keep the reader honest: `cfg` is the one way values are read in play)
void cfg;
