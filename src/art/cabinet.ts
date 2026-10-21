/**
 * Arcade cabinet.  PRD §7.5: glowing marquee, floating cost badge that greys
 * out when the player can't afford it.
 */

import Phaser from 'phaser';
import { PALETTE, nightify } from '../render/palette';
import type { CabinetDef } from '../game/content';
import { centerText } from '../core/ui';
import { depthFor } from './player';
import { grain, seeded, tone } from './surface';
import { playScreen } from './cabinetScreens';

/** 22 wide: a cabinet about 0.75 m across beside the 26-pixel drifter. */
export const CAB_W = 22;
/**
 * 30 high against a 26-pixel man: about 1.9 m to the top of the marquee, which
 * is what a stand-up cabinet measures.  It used to be 36 -- 2.4 m of machine.
 */
export const CAB_H = 30;

/**
 * ---- WHERE THE MACHINE ENDS, FOR THE FLOOR AND FOR THE EYE.
 *
 * Two different jobs, from one number, so they can never disagree:
 *
 *  - COLLISION.  `CAB_FOOT` is how many pixels of floor the cabinet stands
 *    on: the invisible solid box every room already builds with
 *    `machineSpot`.  You cannot stand in it from any side.
 *  - DEPTH.  `cabinetSortY` is the floor line the whole cabinet is sorted
 *    on, on the player's own scale (`depthFor`, which takes the avatar's
 *    FEET -- the ground position -- never its head or its middle).
 *
 * The sort line is the TOP OF THE FOOTPRINT, which is the forty per cent of
 * the cabinet's height it has always been.  That is the point: the only
 * floor above the line is floor the footprint has already taken away, so
 * there is no longer a band of carpet -- it was four pixels deep -- where
 * the player stood behind the machine and was drawn in front of it.  Walk
 * up past the line and you are behind the machine and drawn behind it; walk
 * back down and the footprint stops you before you can be in front of it on
 * screen while still being behind it on the floor.
 *
 * (The half pixel breaks the tie: a player standing on the very top edge of
 * the footprint sorts BEHIND the machine, not in a coin-flip with it.)
 */
export const CAB_DEPTH_FRAC = 0.4;
export const CAB_FOOT = Math.round(CAB_H * CAB_DEPTH_FRAC);
export function cabinetSortY(base: number): number {
  return base - CAB_FOOT + 0.5;
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

    // ONE DEPTH FOR THE WHOLE CABINET, on the player's own scale (depthFor),
    // taken at FOUR TENTHS OF ITS HEIGHT -- which is also the top edge of the
    // footprint the room keeps the player out of (see `cabinetSortY`): walk up
    // past that line and it is drawn in front of you, so you are going behind
    // it; below it you are in front of it, and there is no floor in between.
    const d = depthFor(cabinetSortY(y));

    // ---- the box itself.  Drawn as one Graphics so the whole machine is a
    // single object to sort, with the same finish the player has: a dark
    // outline round the silhouette, lit top edges, shaded undersides, and a
    // pixel of wear here and there -- a physical cabinet, not a coloured box.
    const shell = c(PALETTE.slate);
    const trim = night ? nightify(def.color) : def.color;
    const seed = Math.round(x * 7 + y * 13);
    const rnd = seeded(seed);
    const L = x - CAB_W / 2;
    const T = y - CAB_H;
    const g = scene.add.graphics().setDepth(d);
    // a soft contact shadow on the carpet
    g.fillStyle(0x000000, night ? 0.4 : 0.28).fillEllipse(x + 1, y, CAB_W + 8, 5);
    // outline
    g.fillStyle(c(0x0c0a10), 1).fillRect(L - 1, T - 1, CAB_W + 2, CAB_H + 1);
    // the body, a touch of grain in the laminate
    g.fillStyle(shell, 1).fillRect(L, T, CAB_W, CAB_H);
    grain(g, L + 3, T + 6, CAB_W - 6, CAB_H - 8, shell, seed, 0.06, 0.12);
    // side art panels in the machine's colour, lit on the outer edge, a darker
    // inner edge where the panel meets the front, and a T-moulding strip
    for (const [px, outer] of [[L, true], [L + CAB_W - 3, false]] as const) {
      g.fillStyle(trim, night ? 0.35 : 1).fillRect(px, T, 3, CAB_H);
      g.fillStyle(tone(trim, 0.62), night ? 0.35 : 1).fillRect(outer ? px + 2 : px, T, 1, CAB_H);
      g.fillStyle(tone(trim, 1.45), night ? 0.3 : 0.9).fillRect(outer ? px : px + 2, T, 1, CAB_H);
      // scuffs on the panel, low down where knees and bags catch it
      for (let k = 0; k < 3; k++) {
        g.fillStyle(tone(trim, 1.6), night ? 0.15 : 0.55).fillRect(px + Math.floor(rnd() * 3), y - 6 - Math.floor(rnd() * 10), 1, 1);
      }
    }
    // the plinth and kick plate, worn pale along the front edge
    g.fillStyle(c(PALETTE.ink), 1).fillRect(L - 1, y - 4, CAB_W + 2, 4);
    g.fillStyle(c(0x2a3040), 1).fillRect(L, y - 4, CAB_W, 1);
    for (let k = 0; k < 4; k++) g.fillStyle(c(0x4a5060), 0.8).fillRect(L + 2 + Math.floor(rnd() * (CAB_W - 6)), y - 1, 2, 1);

    // ---- the marquee: a lit box with a highlight along the top and a dark
    // lip where it overhangs the bezel
    this.marquee = scene.add
      .rectangle(x, T + 6, CAB_W - 2, 6, night ? nightify(def.color) : def.color)
      .setOrigin(0.5, 1)
      .setDepth(d);
    if (night) this.marquee.setAlpha(0.25);
    const mq = scene.add.graphics().setDepth(d + 0.00005);
    mq.fillStyle(night ? 0x000000 : tone(def.color, 1.5), night ? 0 : 0.9).fillRect(L + 2, T, CAB_W - 4, 1);
    mq.fillStyle(0x000000, 0.35).fillRect(L + 1, T + 5, CAB_W - 2, 1);
    if (!night) mq.fillStyle(def.color, 0.18).fillRect(L - 2, T - 3, CAB_W + 4, 3); // the glow off its top
    if (!night && def.symbol) {
      centerText(scene, x, T + 3, def.symbol, PALETTE.ink).setDepth(d + 0.0001);
    }

    // ---- the screen, set in a black bezel with a bevelled inner edge, a
    // motif on it, scanlines over that, and the glass catching the light
    g.fillStyle(c(PALETTE.black), 1).fillRect(L + 2, T + 5, CAB_W - 4, 12);
    g.fillStyle(c(0x2a2a34), 1).fillRect(L + 2, T + 5, CAB_W - 4, 1).fillRect(L + 2, T + 5, 1, 12);
    g.fillStyle(c(0x050508), 1).fillRect(L + 3, T + 16, CAB_W - 6, 1);
    this.screen = scene.add
      .rectangle(x, T + 16, CAB_W - 8, 10, night ? PALETTE.black : c(def.color))
      .setOrigin(0.5, 1)
      .setDepth(d);
    this.screen.setAlpha(night ? 1 : 0.85);
    if (!night) {
      // the picture on it plays: each machine its own game, on a loop
      playScreen(scene, L + 4, T + 6, def.motif, d + 0.0001, seed);
      const glass = scene.add.graphics().setDepth(d + 0.0002);
      for (let i = 0; i < 5; i++) glass.fillStyle(PALETTE.black, 0.18).fillRect(L + 4, T + 6 + i * 2, CAB_W - 8, 1);
      // the curve of the tube: darker corners
      glass.fillStyle(PALETTE.black, 0.35);
      for (const [cx, cy] of [[L + 4, T + 6], [L + CAB_W - 5, T + 6], [L + 4, T + 15], [L + CAB_W - 5, T + 15]]) glass.fillRect(cx, cy, 1, 1);
      // a glare streak across the glass, and a hot spot in its top corner
      glass.fillStyle(0xffffff, 0.16).fillTriangle(L + 4, T + 6, L + 9, T + 6, L + 4, T + 11);
      glass.fillStyle(0xffffff, 0.5).fillRect(L + 5, T + 7, 2, 1);
    } else {
      // a dead tube still has a sheen on it
      const glass = scene.add.graphics().setDepth(d + 0.0002);
      glass.fillStyle(0xa0b0d0, 0.08).fillTriangle(L + 4, T + 6, L + 10, T + 6, L + 4, T + 12);
    }

    // ---- the control deck, at hand height for a 26-pixel man: a sloped
    // panel with a lit front lip, a stick and buttons that sit IN it (a dark
    // ring under each) and catch the light
    g.fillStyle(c(PALETTE.steel), 1).fillRect(L, y - 10, CAB_W, 6);
    g.fillStyle(c(tone(PALETTE.steel, 1.3)), 1).fillRect(L, y - 10, CAB_W, 1);
    g.fillStyle(c(0x2a3040), 1).fillRect(L, y - 5, CAB_W, 1);
    grain(g, L + 1, y - 9, CAB_W - 2, 3, c(PALETTE.steel), seed + 1, 0.12, 0.1);
    const parts = scene.add.graphics().setDepth(d + 0.0001);
    // the stick: a dust washer, the shaft, and a ball-top with a highlight
    parts.fillStyle(c(PALETTE.ink), 1).fillEllipse(x - 6, y - 7, 4, 2);
    parts.fillStyle(c(0x6a6e78), 1).fillRect(x - 6.5, y - 10, 1, 3);
    const ball = night ? nightify(PALETTE.blood) : PALETTE.blood;
    parts.fillStyle(tone(ball, 0.6), 1).fillCircle(x - 6, y - 10, 1.8);
    parts.fillStyle(ball, 1).fillCircle(x - 6.3, y - 10.3, 1.4);
    if (!night) parts.fillStyle(0xffffff, 0.8).fillRect(x - 7, y - 11, 1, 1);
    // the buttons, each in a dark collar with a pinprick of light on top
    for (let i = 0; i < 3; i++) {
      const bx = x - 1 + i * 3.5;
      const col = night ? nightify(trim) : [PALETTE.gold, PALETTE.cream, trim][i];
      parts.fillStyle(c(0x101218), 1).fillCircle(bx, y - 7.5, 1.9);
      parts.fillStyle(tone(col, 0.7), 1).fillCircle(bx, y - 7.5, 1.4);
      parts.fillStyle(col, 1).fillCircle(bx - 0.2, y - 7.8, 1.05);
      if (!night) parts.fillStyle(0xffffff, 0.7).fillRect(bx - 1, y - 9, 1, 1);
    }
    // ---- the coin slots, set in the kick plate: lit orange in the day
    for (const sx of [x - 3, x + 1]) {
      g.fillStyle(night ? 0x1a1010 : PALETTE.ember, 1).fillRect(sx, y - 3, 3, 2);
      g.fillStyle(PALETTE.black, 1).fillRect(sx + 1, y - 3, 1, 2);
    }
    // the speaker grille between the screen and the deck
    g.fillStyle(c(tone(PALETTE.slate, 1.25)), 1).fillRect(L + 3, T + 18, CAB_W - 6, 1);

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
    return Phaser.Math.Distance.Between(this.def.x, this.def.y - 6, x, y);
  }
}
