/**
 * The wheel in the corner of the casino.  Furniture, not a machine.
 *
 * Everything else in the building is a cabinet with a coin slot; this is a
 * painted wheel on a post with a pointer over the top of it, because what it
 * sells is a spin and a spin is a thing you watch rather than a screen you
 * play.  It stands in the bottom-left corner where there is floor and no door.
 *
 * The wheel's faces here are decoration — the real one, with the real odds cut
 * into its geometry, is drawn inside the game (minigames/wheel.ts).
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import type { CabinetDef } from '../game/content';
import { centerText } from '../core/ui';

/** Radius of the painted face, in world pixels.  `def.y` is the foot of it. */
export const WHEEL_R = 20;

export class PrizeWheel {
  readonly def: CabinetDef;
  readonly bounds: Phaser.Geom.Rectangle;
  private badgeBox: Phaser.GameObjects.Rectangle;
  private badgeText: Phaser.GameObjects.BitmapText;
  private affordable = true;

  constructor(scene: Phaser.Scene, def: CabinetDef) {
    this.def = def;
    const { x, y } = def;
    const d = y / 1000;
    const cy = y - WHEEL_R - 16;

    // shadow on the carpet, and the post it stands on
    scene.add.ellipse(x, y + 1, WHEEL_R * 2, 8, PALETTE.black, 0.35).setDepth(d);
    scene.add.rectangle(x, y, 8, 18, PALETTE.steel).setOrigin(0.5, 1).setDepth(d);
    scene.add.ellipse(x, y, 22, 6, PALETTE.slate).setDepth(d);

    // the face: a rim, and eight wedges of alternating colour
    scene.add.circle(x, cy, WHEEL_R + 3, PALETTE.brownLight).setDepth(d);
    scene.add.circle(x, cy, WHEEL_R + 1, PALETTE.ink).setDepth(d);
    // Drawn around its OWN origin and then placed, so the idle tween turns the
    // face instead of swinging it round the room: a Graphics drawn at world
    // coordinates and then positioned is offset by its own position.
    const wedge = scene.add.graphics().setDepth(d).setPosition(x, cy);
    const colours = [def.color, PALETTE.blood, PALETTE.tealLight, PALETTE.violet];
    for (let i = 0; i < 8; i++) {
      wedge.fillStyle(colours[i % colours.length], 1);
      wedge.slice(0, 0, WHEEL_R, Phaser.Math.DegToRad(i * 45 - 90), Phaser.Math.DegToRad((i + 1) * 45 - 90), false);
      wedge.fillPath();
    }
    scene.add.circle(x, cy, 4, PALETTE.bone).setDepth(d + 0.0001);
    scene.add.circle(x, cy, 2, PALETTE.ink).setDepth(d + 0.0001);
    // the pointer, over the top of it
    scene.add
      .triangle(x, cy - WHEEL_R - 3, 0, 0, 6, 0, 3, 7, PALETTE.cream)
      .setOrigin(0.5, 0)
      .setDepth(d + 0.0002);

    // a slow idle turn, so it reads as a thing that spins
    scene.tweens.add({ targets: wedge, rotation: Math.PI * 2, duration: 14000, repeat: -1 });

    // The sign above it, in this corner of the room: the full title is sixteen
    // characters and would run through the wall and the machine beside it.
    scene.add.rectangle(x - 6, 42, 2, 10, PALETTE.steel).setDepth(d);
    const sign = scene.add.rectangle(x - 6, 52, 62, 11, def.color).setDepth(d).setStrokeStyle(1, PALETTE.ink);
    centerText(scene, x - 6, 52, 'THE WHEEL', PALETTE.ink).setDepth(d + 0.001);
    scene.tweens.add({ targets: sign, alpha: 0.7, duration: 900, yoyo: true, repeat: -1 });

    // the price, floating like a cabinet's badge
    this.badgeBox = scene.add.rectangle(0, 0, 18, 11, PALETTE.black, 0.75).setStrokeStyle(1, PALETTE.gold);
    this.badgeText = centerText(scene, 0, 0, `${def.cost}`, PALETTE.gold);
    // On the wall side of the wheel: the machine on its right is close enough
    // that a badge over there reads as that machine's price.
    const badge = scene.add.container(x - WHEEL_R - 10, cy, [this.badgeBox, this.badgeText]).setDepth(500);
    scene.tweens.add({ targets: badge, y: cy - 2, duration: 1200, yoyo: true, repeat: -1 });

    this.bounds = new Phaser.Geom.Rectangle(x - WHEEL_R - 4, cy - WHEEL_R - 6, WHEEL_R * 2 + 8, WHEEL_R * 2 + 26);
  }

  /** PRD §6.8: greys out when a spin is out of reach. */
  setAffordable(v: boolean): void {
    if (v === this.affordable) return;
    this.affordable = v;
    this.badgeBox.setStrokeStyle(1, v ? PALETTE.gold : PALETTE.steel);
    this.badgeText.setTint(v ? PALETTE.gold : PALETTE.ash);
  }

  distanceTo(x: number, y: number): number {
    return Phaser.Math.Distance.Between(x, y, this.def.x, this.def.y - WHEEL_R);
  }
}
