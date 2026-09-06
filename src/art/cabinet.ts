/**
 * Arcade cabinet.  PRD §7.5: glowing marquee, floating cost badge that greys
 * out when the player can't afford it.
 */

import Phaser from 'phaser';
import { PALETTE, css, nightify } from '../render/palette';
import type { CabinetDef } from '../game/content';

export const CAB_W = 26;
export const CAB_H = 36;

export class Cabinet {
  readonly def: CabinetDef;
  private marquee: Phaser.GameObjects.Rectangle;
  private badge: Phaser.GameObjects.Container;
  private badgeBox: Phaser.GameObjects.Rectangle;
  private badgeText: Phaser.GameObjects.Text;
  private screen: Phaser.GameObjects.Rectangle;
  private affordable = true;

  constructor(scene: Phaser.Scene, def: CabinetDef, night = false) {
    this.def = def;
    const c = (col: number) => (night ? nightify(col) : col);
    const { x, y } = def;

    // body
    scene.add.rectangle(x, y, CAB_W, CAB_H, c(PALETTE.slate)).setOrigin(0.5, 1).setDepth(y / 1000);
    scene.add.rectangle(x, y, CAB_W, 3, c(PALETTE.ink)).setOrigin(0.5, 1);
    // screen
    this.screen = scene.add
      .rectangle(x, y - CAB_H + 20, CAB_W - 8, 13, night ? PALETTE.black : c(def.color))
      .setOrigin(0.5, 1);
    this.screen.setAlpha(night ? 1 : 0.8);
    // marquee
    this.marquee = scene.add
      .rectangle(x, y - CAB_H + 6, CAB_W - 2, 6, night ? nightify(def.color) : def.color)
      .setOrigin(0.5, 1);
    if (night) this.marquee.setAlpha(0.25);
    // control deck
    scene.add.rectangle(x, y - 10, CAB_W, 5, c(PALETTE.steel)).setOrigin(0.5, 1);

    if (!night) {
      scene.tweens.add({
        targets: this.marquee,
        alpha: 0.6,
        duration: 900 + Math.random() * 700,
        yoyo: true,
        repeat: -1,
      });
      scene.tweens.add({
        targets: this.screen,
        alpha: 0.55,
        duration: 220 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
      });
    }

    // floating cost badge
    this.badgeBox = scene.add.rectangle(0, 0, 12, 11, PALETTE.black, 0.75).setStrokeStyle(1, PALETTE.gold);
    this.badgeText = scene.add
      .text(0, 0, String(def.cost), { fontFamily: 'monospace', fontSize: '8px', color: css(PALETTE.gold) })
      .setOrigin(0.5, 0.5)
      .setResolution(1);
    this.badge = scene.add.container(x, y - CAB_H - 8, [this.badgeBox, this.badgeText]).setDepth(500);
    this.badge.setVisible(!night);

    if (!night) {
      scene.tweens.add({ targets: this.badge, y: y - CAB_H - 10, duration: 1200, yoyo: true, repeat: -1 });
    }
  }

  /** PRD §6.8: greys out when unaffordable. */
  setAffordable(v: boolean): void {
    if (v === this.affordable) return;
    this.affordable = v;
    this.badgeBox.setStrokeStyle(1, v ? PALETTE.gold : PALETTE.steel);
    this.badgeText.setColor(css(v ? PALETTE.gold : PALETTE.ash));
  }

  distanceTo(x: number, y: number): number {
    return Phaser.Math.Distance.Between(this.def.x, this.def.y - 8, x, y);
  }
}
