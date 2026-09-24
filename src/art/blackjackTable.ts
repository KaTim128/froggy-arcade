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

    // ---- WHOSE HALF IS WHOSE, READ OFF THE FELT.
    //
    // All of it used to sit on the centre line: two cards and three stacks of
    // chips in the middle of the green, directly under the dealer's hands,
    // which made every object on the table HIS.  A blackjack table is two
    // halves and has to look like two halves -- the dealer's cards up on his
    // arc at the back, the player's cards and the player's bet down at the
    // near edge, with the width of the felt between them.  That is the shape
    // of the game, and it is legible from the doorway.
    const card = (cx: number, cy: number, ang: number): void => {
      scene.add
        .rectangle(cx, cy, 6, 8, PALETTE.cream)
        .setDepth(d)
        .setAngle(ang)
        .setStrokeStyle(1, PALETTE.ink);
    };

    // the dealer's pair, on his arc, and the shoe on his right where his hand
    // falls -- the two things on the table that are not the player's
    card(x - 5, y - 19, -10);
    card(x + 6, y - 18, 8);
    scene.add.rectangle(x + 27, y - 21, 9, 6, PALETTE.slate).setDepth(d);
    scene.add.rectangle(x + 27, y - 23, 9, 2, PALETTE.steel).setDepth(d);

    // the player's pair, at the near edge, lying the way cards lie when they
    // are held from this side
    card(x + 8, y - 10, -14);
    card(x + 18, y - 10, 12);

    // the player's bet, in the betting spot: near edge, and off to the left so
    // that a player stood at the middle of the table never covers their own
    // money.  Not all the same size -- that is the point of the stacks.
    const stacks: [number, number, number][] = [
      [x - 20, 3, PALETTE.neon],
      [x - 14, 2, PALETTE.cream],
      [x - 8, 4, PALETTE.gold],
    ];
    for (const [sx, n, col] of stacks) {
      for (let i = 0; i < n; i++) {
        scene.add.ellipse(sx, y - 9 - i * 2, 6, 3, col).setDepth(d + 0.0001 * i);
      }
    }

    // ---- THE DEALER'S CHAIR.
    //
    // It was two rectangles in rust -- a flat orange slab behind the dealer's
    // head that read as a panel hung on the wall rather than as anything
    // anybody sits in, and in a burgundy-and-gold room it was the one orange
    // thing in the picture.
    //
    // It is a house chair now, built the way the rest of the casino is: oxblood
    // leather, a buttoned back with brass studs picking up the diamonds on the
    // wallpaper, bolsters down each side that are a shade darker so the back
    // has a front and two sides rather than one flat face, a crown over the top
    // and arms coming forward to the felt.  The dealer sits BETWEEN the
    // bolsters, which is what makes him look sat in it rather than stood in
    // front of it.
    //
    // It sits three pixels further back than it did, on the same line the
    // dealer is now cut at, so that he is framed by it rather than leaning out
    // of it.
    chairAt(scene, x, y - 27, d - 0.002);

    // ---- THE PLAYER'S CHAIR, pulled up to the near edge.
    //
    // The same house chair, at the only seat that faces the dealer, which is
    // why you are looking at the back of it.  It stands IN FRONT of where the
    // player stands and BEHIND them in the sort order -- the room draws a
    // person at fifty-something and every stick of this furniture in the low
    // hundredths -- so the player's body is always the thing in front and the
    // chair is always the thing around it.  A chair that covered the player
    // would be a chair in the way.
    chairAt(scene, x, y + 26, d + 0.002, 0.72);

    // ---- stools for whoever else is playing, pushed out past the chair's
    // arms so the near edge belongs to the one seat that matters
    for (const sx of [x - 38, x + 38]) {
      scene.add.ellipse(sx, y + 14, 12, 6, PALETTE.rust).setDepth(d + 0.001);
      scene.add.rectangle(sx, y + 17, 2, 4, PALETTE.steel).setOrigin(0.5, 0).setDepth(d + 0.001);
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
   * Where the dealer sits: the BACK RAIL of the felt.
   *
   * The room clips him at this line and draws him below it, so the table cuts
   * across him the way it would across anyone sat at it.  It used to be five
   * pixels nearer, inside the green, and those five pixels were the whole
   * problem -- his chest and both hands came down ON the felt and he read as a
   * man leaning across the table rather than sitting behind one.  At the rail
   * the entire top is in front of him: the player looks at a table with a
   * dealer behind it, which is what a blackjack table is.
   */
  dealerSpot(): { x: number; y: number } {
    return { x: this.def.x, y: this.def.y - 27 };
  }

  /** PRD §6.8: greys out when the player cannot even make the minimum. */
  setAffordable(v: boolean): void {
    if (v === this.affordable) return;
    this.affordable = v;
    this.badgeBox.setStrokeStyle(1, v ? PALETTE.gold : PALETTE.steel);
    this.badgeText.setTint(v ? PALETTE.gold : PALETTE.ash);
  }

  /**
   * Measured from the NEAR EDGE, not the middle of the felt.
   *
   * You play this table from in front of it, and the front is where the table
   * now makes you stand -- so a range measured from the centre of the green
   * was measuring from somewhere nobody is allowed to be, and the prompt went
   * out exactly when the player arrived at the chair.
   */
  distanceTo(x: number, y: number): number {
    return Phaser.Math.Distance.Between(this.def.x, this.def.y + 8, x, y);
  }
}

/** Oxblood, brass and shadow: the casino's own materials, not the arcade's. */
const CHAIR = {
  hide: 0x5e1f2a,
  hideLit: 0x76293a,
  bolster: 0x40151e,
  crown: 0x2e0f16,
  brass: 0xb08a3c,
  brassDim: 0x6d552a,
  shadow: 0x1a0a10,
};

/**
 * One house chair, drawn from the floor up with `by` as the seat line and `s`
 * as its size -- the dealer's, at full size, and the player's at two thirds,
 * which is the same chair further forward and nearer the camera than the
 * projection strictly allows.  It is drawn small on purpose: a full-size one
 * at the near edge stacked up under the dealer's into a single column of
 * oxblood running the height of the room, and stopped reading as furniture
 * at all.
 *
 * Everything here is stacked back-to-front on one depth so it reads as a solid
 * object: the shadow it throws on the wall, the two side bolsters, the padded
 * back between them, the studs, the crown, and the arms in front.  Only the
 * top of it clears the felt, which is exactly how much of a chair you see at a
 * card table -- but the part that does clear it now has a shape.
 */
function chairAt(scene: Phaser.Scene, x: number, by: number, depth: number, s = 1): void {
  const add = (
    cx: number,
    cy: number,
    w: number,
    h: number,
    colour: number,
    alpha = 1,
  ): Phaser.GameObjects.Rectangle =>
    scene.add
      .rectangle(x + (cx - x) * s, by + (cy - by) * s, w * s, h * s, colour, alpha)
      .setOrigin(0.5, 1)
      .setDepth(depth);

  // ---- what it throws on the wall behind it, so it is standing off the wall
  add(x + 3, by + 2, 40, 34, CHAIR.shadow, 0.45);

  // ---- the back: two bolsters with the padded panel between them.  The
  // bolsters are darker and a little taller, which is the whole of why this
  // reads as a curved back rather than a board.
  add(x - 15, by, 8, 33, CHAIR.bolster);
  add(x + 15, by, 8, 33, CHAIR.bolster);
  add(x, by, 24, 31, CHAIR.hide);
  // the light coming down the middle of the padding from the lamp above
  add(x, by - 2, 16, 25, CHAIR.hideLit, 0.55);

  // ---- buttoning.  Two rows of brass, on the diagonal, which is the
  // wallpaper's diamond turned into upholstery.
  for (const [sx, sy] of [
    [-6, -8],
    [6, -8],
    [0, -15],
    [-6, -22],
    [6, -22],
  ] as const) {
    add(x + sx, by + sy, 2, 2, CHAIR.brass);
    add(x + sx, by + sy + 1, 2, 1, CHAIR.brassDim);
  }

  // ---- the crown over the top, and a strip of brass along it
  add(x, by - 31, 36, 5, CHAIR.crown);
  add(x, by - 34, 30, 2, CHAIR.brassDim);

  // ---- the arms, coming forward either side to meet the felt.  They are what
  // put the dealer INSIDE the chair: he is drawn between them.
  for (const sx of [-1, 1]) {
    add(x + sx * 19, by + 6, 6, 14, CHAIR.bolster);
    add(x + sx * 19, by + 6, 6, 3, CHAIR.hide);
  }
}
