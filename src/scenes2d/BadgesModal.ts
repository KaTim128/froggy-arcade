/**
 * ---- BADGES, from the title screen's top-right corner.  The active
 * profile's story milestones (game/badges): earned ones in their colour
 * with what they were for, the rest locked, a hint in place of the name so
 * nothing ahead is given away.  Achievements are not here -- they are the
 * Goals card's, in play.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { button, centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { BADGES } from '../game/badges';

export class BadgesModal extends Phaser.Scene {
  private from = 'StartScreen';

  constructor() {
    super('BadgesModal');
  }

  init(data: { from?: string } = {}): void {
    this.from = data.from ?? 'StartScreen';
  }

  create(): void {
    this.scene.bringToTop();
    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.7).setOrigin(0, 0).setInteractive();
    this.add.rectangle(18, 8, GAME_W - 36, GAME_H - 16, PALETTE.ink, 0.97).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold);
    const name = store.activeSlotName();
    const got = new Set(store.get().badges);
    centerText(this, GAME_W / 2, 17, name ? `BADGES - ${name}` : 'BADGES', PALETTE.gold);
    centerText(this, GAME_W / 2, 27, `${[...got].filter((id) => BADGES.some((b) => b.id === id)).length} OF ${BADGES.length}  -  STORY MILESTONES`, PALETTE.ash);
    if (!name) centerText(this, GAME_W / 2, 90, 'CHOOSE A PROFILE TO SEE ITS BADGES.', PALETTE.cream);
    else
      BADGES.forEach((b, i) => {
        const y = 33 + i * 13.5;
        const have = got.has(b.id);
        const g = this.add.graphics();
        // the medal: a disc on a ribbon, or a grey padlock
        if (have) {
          g.fillStyle(0x14100c, 1).fillCircle(36, y + 6, 6);
          g.fillStyle(b.col, 1).fillCircle(36, y + 6, 5);
          g.fillStyle(0xffffff, 0.45).fillRect(34, y + 3, 2, 2);
          g.fillStyle(0xffffff, 0.2).fillCircle(36, y + 6, 2);
        } else {
          g.fillStyle(0x3a3f4a, 1).fillRect(32, y + 5, 9, 7);
          g.lineStyle(1, 0x3a3f4a, 1).strokeCircle(36.5, y + 5, 3);
        }
        text(this, 48, y, have ? b.name : '???', have ? PALETTE.cream : PALETTE.steel);
        text(this, 48, y + 6.5, have ? b.desc : b.hint, have ? PALETTE.ash : 0x5a6070).setScale(1);
      });
    button(this, GAME_W / 2, GAME_H - 15, 'BACK', () => this.close(), { width: 60, height: 13 });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private close(): void {
    audio.sfx('ui_blip', 0.4);
    this.scene.get(this.from)?.events.emit('badges-closed');
    this.scene.stop();
  }
}
