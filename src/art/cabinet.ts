/**
 * Arcade cabinet.  PRD §7.5: glowing marquee, floating cost badge that greys
 * out when the player can't afford it.
 */

import Phaser from 'phaser';
import { PALETTE, nightify } from '../render/palette';
import type { CabinetDef } from '../game/content';
import { centerText } from '../core/ui';

export const CAB_W = 26;
export const CAB_H = 36;

/**
 * The picture on a machine's screen.  A handful of rectangles each, drawn in
 * the cabinet's own colours — enough that a player crossing the room knows
 * which machine is which without reading a single marquee.
 */
function drawMotif(scene: Phaser.Scene, cx: number, cy: number, def: CabinetDef, depth: number): void {
  const ink: number = PALETTE.ink;
  const bright: number = PALETTE.cream;
  const put = (dx: number, dy: number, w: number, h: number, col: number = ink, alpha = 1) =>
    scene.add.rectangle(cx + dx, cy + dy, w, h, col).setOrigin(0.5, 0.5).setDepth(depth).setAlpha(alpha);
  const dot = (dx: number, dy: number, r: number, col: number = ink) =>
    scene.add.circle(cx + dx, cy + dy, r, col).setDepth(depth);

  switch (def.motif) {
    case 'grid':
      put(0, -3, 11, 1);
      put(0, 2, 11, 1);
      put(-3, 0, 1, 11);
      put(3, 0, 1, 11);
      break;
    case 'blocks':
      put(-3, 3, 5, 4, bright);
      put(3, 3, 5, 4);
      put(0, -3, 5, 4, bright);
      break;
    case 'ball':
      dot(0, 0, 4, bright);
      put(0, 0, 9, 1);
      put(0, 0, 1, 9);
      break;
    case 'mallet':
      put(2, -3, 8, 4, bright);
      put(-2, 2, 2, 8);
      break;
    case 'ladder':
      put(-2, 0, 1, 12);
      put(3, 0, 1, 12);
      for (let i = -4; i <= 4; i += 4) put(0.5, i, 6, 1);
      break;
    case 'fist':
      put(-3, 0, 5, 5, bright);
      put(3, 0, 5, 5);
      put(0, 0, 3, 1);
      break;
    case 'car':
      put(0, 1, 7, 9, bright);
      put(0, -2, 5, 3);
      break;
    case 'road':
      put(-4, 0, 1, 12);
      put(4, 0, 1, 12);
      for (let i = -4; i <= 4; i += 4) put(0, i, 1, 2, bright);
      break;
    case 'ship':
      put(0, 2, 12, 3, bright);
      put(0, -2, 1, 6);
      put(2, -3, 5, 3);
      break;
    case 'pins':
      for (const dx of [-4, 0, 4]) put(dx, -2, 2, 6, bright);
      dot(0, 4, 2);
      break;
    case 'cards':
      put(-2, 0, 7, 10, bright);
      put(3, 1, 7, 10, PALETTE.bone);
      break;
    case 'reels':
      for (const dx of [-4, 0, 4]) put(dx, 0, 3, 11, bright);
      break;
    case 'wheel':
      dot(0, 0, 6, bright);
      put(0, 0, 12, 1);
      put(0, 0, 1, 12);
      dot(0, 0, 1.5);
      break;
    case 'chamber':
      dot(0, 0, 5, bright);
      for (let i = 0; i < 6; i++) {
        dot(Math.cos((i / 6) * Math.PI * 2) * 3, Math.sin((i / 6) * Math.PI * 2) * 3, 1);
      }
      break;
    case 'steps':
      put(-4, 3, 4, 3, bright);
      put(0, 0, 4, 3, bright);
      put(4, -3, 4, 3, bright);
      break;
    case 'throw':
      dot(-4, 2, 2, bright);
      dot(0, -2, 1.5, bright);
      dot(4, 2, 2);
      put(0, 4, 12, 1);
      break;
    default:
      break;
  }
}

export class Cabinet {
  readonly def: CabinetDef;
  /** Pointer/interact hit box, so a room can treat any fixture the same way. */
  readonly bounds: Phaser.Geom.Rectangle;
  private marquee: Phaser.GameObjects.Rectangle;
  private badge: Phaser.GameObjects.Container;
  private badgeBox: Phaser.GameObjects.Rectangle;
  private badgeText: Phaser.GameObjects.BitmapText;
  private screen: Phaser.GameObjects.Rectangle;
  private affordable = true;

  constructor(scene: Phaser.Scene, def: CabinetDef, night = false) {
    this.def = def;
    const c = (col: number) => (night ? nightify(col) : col);
    const { x, y } = def;

    this.bounds = new Phaser.Geom.Rectangle(x - (CAB_W + 4) / 2, y - CAB_H - 1, CAB_W + 4, CAB_H + 2);

    const d = y / 1000; // one depth for the whole cabinet; order decides the rest

    // ---- the box itself: side panels, a bezel, a deck and a plinth
    const shell = c(PALETTE.slate);
    const trim = night ? nightify(def.color) : def.color;
    // side art panels, so the machine has a colour of its own from any angle
    scene.add.rectangle(x, y, CAB_W, CAB_H, shell).setOrigin(0.5, 1).setDepth(d);
    scene.add.rectangle(x - CAB_W / 2, y - CAB_H, 3, CAB_H, trim).setOrigin(0, 0).setDepth(d).setAlpha(night ? 0.3 : 0.85);
    scene.add.rectangle(x + CAB_W / 2 - 3, y - CAB_H, 3, CAB_H, trim).setOrigin(0, 0).setDepth(d).setAlpha(night ? 0.3 : 0.85);
    // a plinth, so it stands on the carpet instead of floating on it
    scene.add.rectangle(x, y, CAB_W + 2, 4, c(PALETTE.ink)).setOrigin(0.5, 1).setDepth(d);
    scene.add.rectangle(x, y - 3, CAB_W, 1, c(0x2a3040)).setOrigin(0.5, 1).setDepth(d);

    // ---- the screen, in a black bezel, with a motif on it and scanlines over
    scene.add.rectangle(x, y - CAB_H + 23, CAB_W - 4, 18, c(PALETTE.black)).setOrigin(0.5, 1).setDepth(d);
    this.screen = scene.add
      .rectangle(x, y - CAB_H + 21, CAB_W - 8, 14, night ? PALETTE.black : c(def.color))
      .setOrigin(0.5, 1)
      .setDepth(d);
    this.screen.setAlpha(night ? 1 : 0.85);
    if (!night) {
      drawMotif(scene, x, y - CAB_H + 14, def, d + 0.0001);
      for (let i = 0; i < 6; i++) {
        scene.add
          .rectangle(x, y - CAB_H + 9 + i * 2, CAB_W - 8, 1, PALETTE.black)
          .setOrigin(0.5, 0)
          .setDepth(d + 0.0002)
          .setAlpha(0.18);
      }
    }

    // ---- the marquee, with the machine's own letters on it
    this.marquee = scene.add
      .rectangle(x, y - CAB_H + 6, CAB_W - 2, 6, night ? nightify(def.color) : def.color)
      .setOrigin(0.5, 1)
      .setDepth(d);
    if (night) this.marquee.setAlpha(0.25);
    if (!night && def.symbol) {
      centerText(scene, x, y - CAB_H + 3, def.symbol, PALETTE.ink).setDepth(d + 0.0001);
    }

    // ---- the control deck: a stick and buttons, in the machine's colour
    scene.add.rectangle(x, y - 9, CAB_W, 7, c(PALETTE.steel)).setOrigin(0.5, 1).setDepth(d);
    scene.add.rectangle(x, y - 15, CAB_W, 2, c(0x2a3040)).setOrigin(0.5, 1).setDepth(d);
    // the stick
    scene.add.rectangle(x - 7, y - 13, 1, 3, c(PALETTE.ink)).setOrigin(0.5, 1).setDepth(d + 0.0001);
    scene.add.circle(x - 7, y - 14, 1.6, night ? nightify(PALETTE.blood) : PALETTE.blood).setDepth(d + 0.0001);
    // the buttons
    for (let i = 0; i < 3; i++) {
      scene.add
        .circle(x - 1 + i * 4, y - 12, 1.3, night ? nightify(trim) : [PALETTE.gold, PALETTE.cream, trim][i])
        .setDepth(d + 0.0001);
    }
    // a coin slot and a speaker grille, because every machine has both
    scene.add.rectangle(x + 8, y - 12, 4, 1, c(PALETTE.ink)).setOrigin(0.5, 0.5).setDepth(d + 0.0001);
    for (let i = 0; i < 3; i++) {
      scene.add.rectangle(x - 6 + i * 6, y - CAB_H + 25, 4, 1, c(PALETTE.ink)).setOrigin(0.5, 0).setDepth(d + 0.0001);
    }

    // floating cost badge
    this.badgeBox = scene.add.rectangle(0, 0, 12, 11, PALETTE.black, 0.75).setStrokeStyle(1, PALETTE.gold);
    this.badgeText = centerText(scene, 0, 0, String(def.cost), PALETTE.gold);
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
    this.badgeText.setTint(v ? PALETTE.gold : PALETTE.ash);
  }

  distanceTo(x: number, y: number): number {
    return Phaser.Math.Distance.Between(this.def.x, this.def.y - 8, x, y);
  }
}
