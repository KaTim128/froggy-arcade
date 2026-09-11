/**
 * Froggy's blackjack table.  Furniture, not a machine.
 *
 * Every other game in the building is a cabinet with a coin slot and a fixed
 * price on the front.  This one is a felt oval with a dealer standing behind
 * it, because the player names the stake and a slot cannot take an amount.
 * The badge above it reads "1+": what the table will not deal under, not what
 * a play costs.
 *
 * Froggy himself is NOT drawn here.  He is never a sprite (PRD FR-1) — the
 * room paints him on the unfiltered overlay, at `dealerSpot()`.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import type { CabinetDef } from '../game/content';
import { centerText } from '../core/ui';

/** Footprint of the felt, in world pixels.  `def.y` is the front edge. */
export const TABLE_W = 82;
export const TABLE_H = 30;

const FELT = 0x1d5c2d;
const FELT_DARK = 0x123b1e;

export class BlackjackTable {
  readonly def: CabinetDef;
  /** Where the interact zone and the pointer hit box sit. */
  readonly bounds: Phaser.Geom.Rectangle;
  private badgeBox: Phaser.GameObjects.Rectangle;
  private badgeText: Phaser.GameObjects.BitmapText;
  private affordable = true;

  constructor(scene: Phaser.Scene, def: CabinetDef) {
    this.def = def;
    const { x, y } = def;
    const d = y / 1000;

    // ---- the table, seen the same low-angle way the cabinets are
    scene.add.ellipse(x, y + 2, TABLE_W + 6, 12, PALETTE.black, 0.35).setDepth(d);
    // apron
    scene.add.rectangle(x, y, TABLE_W - 6, 14, PALETTE.brown).setOrigin(0.5, 1).setDepth(d);
    scene.add.rectangle(x, y, TABLE_W - 6, 3, 0x4a3320).setOrigin(0.5, 1).setDepth(d);
    // felt top, with a padded rail around it
    scene.add.ellipse(x, y - 14, TABLE_W, TABLE_H, PALETTE.brown).setDepth(d);
    scene.add.ellipse(x, y - 15, TABLE_W - 8, TABLE_H - 7, FELT).setDepth(d);
    // the dealer's arc, painted on the felt
    scene.add.ellipse(x, y - 20, TABLE_W - 26, TABLE_H - 16, FELT_DARK).setDepth(d).setAlpha(0.7);

    // ---- two cards face up, and the shoe they came out of
    for (const [cx, ang] of [
      [x - 6, -12],
      [x + 5, 9],
    ] as const) {
      scene.add
        .rectangle(cx, y - 14, 6, 8, PALETTE.cream)
        .setDepth(d)
        .setAngle(ang)
        .setStrokeStyle(1, PALETTE.ink);
    }
    scene.add.rectangle(x + 27, y - 18, 9, 6, PALETTE.slate).setDepth(d);
    scene.add.rectangle(x + 27, y - 20, 9, 2, PALETTE.steel).setDepth(d);

    // ---- chip stacks.  The point of the table: they are not all the same size.
    const stacks: [number, number, number][] = [
      [x - 28, 3, PALETTE.neon],
      [x - 22, 2, PALETTE.cream],
      [x - 16, 4, PALETTE.gold],
    ];
    for (const [sx, n, col] of stacks) {
      for (let i = 0; i < n; i++) {
        scene.add.ellipse(sx, y - 14 - i * 2, 6, 3, col).setDepth(d + 0.0001 * i);
      }
    }

    // ---- the dealer's chair, behind the far edge.  Only its back shows over
    // the felt, which is exactly how much of a chair you see at a card table.
    scene.add.rectangle(x, y - 34, 26, 12, PALETTE.rust).setOrigin(0.5, 1).setDepth(d - 0.001);
    scene.add.rectangle(x, y - 34, 26, 2, 0x8c3a20).setOrigin(0.5, 1).setDepth(d - 0.001);

    // ---- stools on the player's side
    for (const sx of [x - 26, x + 26]) {
      scene.add.ellipse(sx, y + 10, 12, 6, PALETTE.rust).setDepth(d + 0.001);
      scene.add.rectangle(sx, y + 13, 2, 4, PALETTE.steel).setOrigin(0.5, 0).setDepth(d + 0.001);
    }

    // ---- sign on the back wall.  It hangs clear above the dealer's head:
    // Froggy is on the overlay, so anything he stands in front of is hidden.
    const signY = 40;
    scene.add.rectangle(x, signY - 10, 2, 10, PALETTE.steel).setDepth(d);
    const sign = scene.add.rectangle(x, signY, 60, 11, def.color).setDepth(d);
    sign.setStrokeStyle(1, PALETTE.ink);
    centerText(scene, x, signY, def.title, PALETTE.ink).setDepth(d + 0.001);
    scene.tweens.add({
      targets: sign,
      alpha: 0.65,
      duration: 1100 + Math.random() * 600,
      yoyo: true,
      repeat: -1,
    });

    // ---- the minimum, floating like a cabinet's price badge.  Off to the
    // side of the felt, for the same reason the sign is up on the wall.
    this.badgeBox = scene.add.rectangle(0, 0, 20, 11, PALETTE.black, 0.75).setStrokeStyle(1, PALETTE.gold);
    this.badgeText = centerText(scene, 0, 0, `${def.cost}+`, PALETTE.gold);
    const badge = scene.add.container(x - 52, y - 22, [this.badgeBox, this.badgeText]).setDepth(500);
    scene.tweens.add({ targets: badge, y: y - 24, duration: 1200, yoyo: true, repeat: -1 });

    this.bounds = new Phaser.Geom.Rectangle(x - TABLE_W / 2, y - TABLE_H - 6, TABLE_W, TABLE_H + 18);
  }

  /**
   * Where Froggy sits: the far edge of the felt.
   *
   * The room clips him at this line and draws him below it, so the table cuts
   * across him the way it would across anyone sat at it.
   */
  dealerSpot(): { x: number; y: number } {
    return { x: this.def.x, y: this.def.y - 22 };
  }

  /** PRD §6.8: greys out when the player cannot even make the minimum. */
  setAffordable(v: boolean): void {
    if (v === this.affordable) return;
    this.affordable = v;
    this.badgeBox.setStrokeStyle(1, v ? PALETTE.gold : PALETTE.steel);
    this.badgeText.setTint(v ? PALETTE.gold : PALETTE.ash);
  }

  distanceTo(x: number, y: number): number {
    return Phaser.Math.Distance.Between(this.def.x, this.def.y - 6, x, y);
  }
}
