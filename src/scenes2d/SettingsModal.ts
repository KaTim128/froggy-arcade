/**
 * Settings.  PRD §7.3 / AC-1.
 *
 * Three volume sliders that persist across a reload, and a CONTROLS tab that is
 * RENDERED FROM THE INPUT MAP (PRD IN-1) so the manual can never drift from the
 * actual bindings.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { FONT_ADVANCE } from '../render/pixelFont';
import { BINDINGS } from '../core/input';
import { button, centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';

type Tab = 'audio' | 'controls';

export class SettingsModal extends Phaser.Scene {
  private tab: Tab = 'audio';
  private body!: Phaser.GameObjects.Container;

  constructor() {
    super('SettingsModal');
  }

  init(data: { from?: string }): void {
    void data;
    this.tab = 'audio';
  }

  create(): void {
    // Block clicks reaching the scene underneath.
    this.add
      .rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.82)
      .setOrigin(0, 0)
      .setInteractive();

    this.add.rectangle(GAME_W / 2, GAME_H / 2, 250, 150, PALETTE.ink).setStrokeStyle(1, PALETTE.neon);
    centerText(this, GAME_W / 2, 26, 'SETTINGS', PALETTE.gold, 8);

    button(this, 108, 44, 'AUDIO', () => this.setTab('audio'), { width: 60, height: 13 });
    button(this, 176, 44, 'CONTROLS', () => this.setTab('controls'), { width: 68, height: 13 });

    this.body = this.add.container(0, 0);
    this.renderBody();

    button(this, GAME_W / 2, 152, 'BACK', () => this.close(), { width: 60, height: 13 });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private setTab(t: Tab): void {
    this.tab = t;
    this.renderBody();
  }

  private close(): void {
    store.flush();
    this.scene.stop();
  }

  private renderBody(): void {
    this.body.removeAll(true);
    if (this.tab === 'audio') this.renderAudio();
    else this.renderControls();
  }

  private renderAudio(): void {
    const rows: Array<[string, 'master' | 'music' | 'sfx']> = [
      ['MASTER', 'master'],
      ['MUSIC', 'music'],
      ['SFX', 'sfx'],
    ];
    rows.forEach(([label, key], i) => {
      const y = 68 + i * 22;
      this.body.add(text(this, 60, y - 4, label, PALETTE.cream));
      this.slider(y, key);
    });
    this.body.add(
      text(this, 60, 136, 'settings persist across a reload', PALETTE.ash, 8).setAlpha(0.7),
    );
  }

  private slider(y: number, key: 'master' | 'music' | 'sfx'): void {
    const x0 = 120;
    const w = 100;

    const track = this.add.rectangle(x0, y, w, 3, PALETTE.slate).setOrigin(0, 0.5);
    const fill = this.add.rectangle(x0, y, 0, 3, PALETTE.neon).setOrigin(0, 0.5);
    const knob = this.add.rectangle(x0, y, 4, 9, PALETTE.gold);
    const val = text(this, x0 + w + 8, y - 4, '0', PALETTE.cream);

    const refresh = () => {
      const v = store.get().settings[key];
      fill.width = (v / 100) * w;
      knob.x = x0 + (v / 100) * w;
      val.setText(String(v).padStart(3, ' '));
    };

    const setFromX = (px: number) => {
      const v = Math.round(Math.max(0, Math.min(1, (px - x0) / w)) * 100);
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

  /** PRD §7.3: pixel keycap diagram, generated from BINDINGS. */
  private renderControls(): void {
    // The longest action runs to x=212 in the 6px-advance font, and the last of
    // the ten rows has to clear the BACK button at y=145.
    let y = 54;
    for (const b of BINDINGS) {
      this.body.add(text(this, 44, y, b.action, PALETTE.cream, 8));
      let kx = 216;
      for (const k of b.keys) {
        const w = Math.max(9, k.length * FONT_ADVANCE + 4);
        const cap = this.add.rectangle(kx, y - 2, w, 11, PALETTE.slate).setOrigin(0, 0).setStrokeStyle(1, PALETTE.ash);
        const lbl = centerText(this, kx + w / 2, y + 3.5, k, PALETTE.gold);
        this.body.add([cap, lbl]);
        kx += w + 2;
      }
      y += 9;
    }
  }
}
