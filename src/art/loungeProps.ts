/**
 * The fourth room's furniture: the two claw machines in its top-left corner
 * and the Froggopoly table, with whoever is sitting at it.
 *
 * Everything is drawn standing on a floor line (`y` is where its feet are)
 * and y-sorted with the player through `depthFor`, so walking round behind a
 * crane puts you behind it.  After closing the same things stand in the same
 * places, switched off and dark (`night`).
 */

import Phaser from 'phaser';
import { PALETTE, nightify } from '../render/palette';
import { depthFor } from './player';
import { centerText } from '../core/ui';
import { chairAt, paintFelt } from './blackjackTable';

export type CraneKind = 'plush' | 'oddity';
export const CRANE_W = 26;
export const CRANE_H = 40;

/** One claw machine, its feet on `y`. */
export function paintCrane(scene: Phaser.Scene, x: number, y: number, kind: CraneKind, night: boolean): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(depthFor(y));
  const n = (col: number) => (night ? nightify(col, 0.75) : col);
  const W = CRANE_W;
  const H = CRANE_H;
  const eerie = kind === 'oddity';
  const frame = n(eerie ? 0x2a1a3a : PALETTE.neon);
  const trim = n(eerie ? 0x6a3a8a : PALETTE.tealLight);
  const side = n(eerie ? 0x1a1024 : 0xb0205a);
  const glassCol = n(eerie ? 0x140c1c : 0x1c2a48);
  // ---- THE BASE: the coloured body, a stripe, the prize door and the panel
  c.add(scene.add.rectangle(0, -8, W, 16, frame).setStrokeStyle(1, n(PALETTE.ink)));
  c.add(scene.add.rectangle(0, -3, W - 2, 2, trim));
  c.add(scene.add.rectangle(0, -15, W, 2, side));
  // the prize door, front left, with its flap
  c.add(scene.add.rectangle(-W / 2 + 6, -8, 8, 7, n(PALETTE.black)).setStrokeStyle(0.6, trim));
  c.add(scene.add.rectangle(-W / 2 + 6, -10.5, 8, 1.4, n(0x5a5a6a)));
  // the coin slot and the stick and button on the panel
  c.add(scene.add.rectangle(W / 2 - 5, -8, 3, 5, n(0x3a3a3a)));
  c.add(scene.add.rectangle(W / 2 - 5, -8, 1, 3, n(PALETTE.gold)));
  c.add(scene.add.rectangle(1, -14, 1, 3, n(0x2a2a2a)));
  c.add(scene.add.circle(1, -16, 1.4, n(0xd8202a)));
  c.add(scene.add.circle(5, -15, 1.2, n(0x46c46e)));
  // ---- THE GLASS BOX, heaped to halfway with prizes
  const gTop = -H + 9;
  const gH = -16 - gTop;
  c.add(scene.add.rectangle(0, gTop + gH / 2, W - 2, gH, glassCol));
  c.add(scene.add.rectangle(0, gTop + 2, W - 4, 4, 0xffffff, eerie ? 0.03 : 0.08));
  const pile = eerie ? [0x6a3a8a, 0x8a7aa0, 0x3a2a4a, 0x5a2a6a, 0x9fd4e0] : [0x46c46e, 0xa8743e, 0xf2e6d8, 0xffc830, 0x8a8f99, 0x7b4bd8, 0xff7ab0];
  let i = 0;
  // three layers, the back row first, each a bit narrower and higher
  for (const [row, y0, inset] of [[0, -20, 3], [1, -18.5, 5], [2, -23, 7], [3, -26, 9]] as const) {
    for (let px = -W / 2 + inset; px <= W / 2 - inset; px += 3.6) {
      const col = n(pile[(i++ * 5 + row * 3) % pile.length]);
      const py = y0 + ((i * 7) % 3) * 0.5;
      if (eerie) {
        c.add(scene.add.circle(px, py, 1.8, col));
        c.add(scene.add.rectangle(px, py, 3.4, 0.5, n(0xc8b0d8)));
      } else {
        c.add(scene.add.circle(px, py, 1.9, col));
        c.add(scene.add.circle(px - 1.1, py - 1.7, 0.7, col));
        c.add(scene.add.circle(px + 1.1, py - 1.7, 0.7, col));
      }
    }
  }
  // the claw on its gantry, holding nothing yet
  c.add(scene.add.rectangle(0, gTop + 1.5, W - 4, 1, n(PALETTE.steel)));
  c.add(scene.add.rectangle(3, gTop + 2, 3, 2, n(0x5a7aa8)));
  c.add(scene.add.rectangle(3, gTop + 5, 0.6, 5, n(0xb0b8c4)));
  c.add(scene.add.triangle(3, gTop + 9, -2, 0, 2, 0, 0, 3, n(PALETTE.steel)));
  // the corner posts, and a glint down the glass
  for (const sx of [-W / 2 + 0.5, W / 2 - 0.5]) c.add(scene.add.rectangle(sx, gTop + gH / 2, 1.5, gH, n(0xc8d0dc)));
  c.add(scene.add.rectangle(-W / 2 + 5, gTop + gH / 2, 1.2, gH - 2, 0xffffff, 0.12).setAngle(6));
  c.add(scene.add.rectangle(-W / 2 + 7.5, gTop + gH / 2, 0.6, gH - 4, 0xffffff, 0.1).setAngle(6));
  // ---- THE MARQUEE: a lit sign with a row of bulbs round it
  const head = scene.add.rectangle(0, -H + 3.5, W, 10, n(0x0c0814)).setStrokeStyle(1, trim);
  c.add(head);
  c.add(scene.add.rectangle(0, -H - 1.5, W + 2, 2, frame));
  c.add(centerText(scene, 0, -H + 4, eerie ? '? ? ?' : 'GRAB', n(eerie ? 0xc8a0e0 : PALETTE.gold)));
  const bulbs: Phaser.GameObjects.Arc[] = [];
  for (let b = 0; b < 7; b++) {
    const bulb = scene.add.circle(-W / 2 + 1 + b * ((W - 2) / 6), -H - 1.5, 0.8, n(eerie ? 0xc8a0e0 : 0xffe080));
    bulbs.push(bulb);
    c.add(bulb);
  }
  if (!night) {
    // The plush crane chases its lights; the other one flickers, unwell.
    const glow = scene.add.rectangle(0, -25, W + 2, 24, eerie ? 0x8a4ab8 : PALETTE.tealLight, 0.07);
    c.add(glow);
    if (eerie) {
      scene.time.addEvent({
        delay: 140,
        loop: true,
        callback: () => {
          const a = Math.random() < 0.12 ? 0.02 : 0.07 + Math.random() * 0.05;
          glow.setAlpha(a);
          bulbs.forEach((bl) => bl.setAlpha(a < 0.05 ? 0.2 : 1));
        },
      });
    } else {
      scene.tweens.add({ targets: glow, alpha: 0.03, duration: 700, yoyo: true, repeat: -1 });
      let step = 0;
      scene.time.addEvent({
        delay: 180,
        loop: true,
        callback: () => {
          step++;
          bulbs.forEach((bl, k) => bl.setAlpha((k + step) % 3 === 0 ? 0.3 : 1));
        },
      });
    }
  }
  return c;
}

export type Opponent = 'froggy' | 'nerd' | null;

/**
 * Where whoever runs the board sits: the BACK RAIL of the felt, exactly as at
 * Froggy 21 (BlackjackTable.dealerSpot).  Froggy is painted on the overlay
 * there by the room, cut at this line, so the table crosses his chest.
 */
export function boardSeat(x: number, y: number): { x: number; y: number } {
  return { x, y: y - 27 };
}

/**
 * ---- THE FROGGOPOLY TABLE IS THE CASINO'S TABLE.
 *
 * The same felt oval on its apron with the padded rail, the same oxblood house
 * chair behind it and the player's smaller one pulled up to the near edge --
 * `paintFelt` and `chairAt` from Froggy 21, not a second drawing of them.  On
 * the felt, instead of cards and chips, the board: a ring of coloured spaces
 * round a green middle, two pieces, the dice, and each player's pile of notes.
 *
 * Froggy is not drawn here (he is the overlay's, see `boardSeat`); the boy in
 * the glasses who takes his seat after the night is, sat between the arms.
 */
export function paintBoardTable(scene: Phaser.Scene, x: number, y: number, who: Opponent, night: boolean): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(depthFor(y));
  const n = (col: number) => (night ? nightify(col, 0.75) : col);

  // the dealer's chair, back to front, and whoever sits in it
  c.add(chairAt(scene, 0, -27, 0));
  if (who === 'nerd') {
    // a skinny young man in a striped polo and big round glasses, sat back
    // in the big chair and hunched over the board like it owes him money
    const b = -27;
    c.add(scene.add.rectangle(0, b - 6, 12, 14, n(0x3f6fd8)));
    for (let i = 0; i < 4; i++) c.add(scene.add.rectangle(0, b - 11 + i * 3.4, 12, 1, n(0xf2e6d8)));
    c.add(scene.add.rectangle(0, b - 14, 4, 2, n(0xe8b890)));
    c.add(scene.add.ellipse(0, b - 19, 10, 11, n(0xe8b890)));
    c.add(scene.add.rectangle(0, b - 24, 11, 3, n(0x3a2618)));
    c.add(scene.add.circle(-2.4, b - 19, 2.1).setStrokeStyle(0.8, n(0x1a1410)));
    c.add(scene.add.circle(2.4, b - 19, 2.1).setStrokeStyle(0.8, n(0x1a1410)));
    c.add(scene.add.rectangle(0, b - 19, 1, 0.6, n(0x1a1410)));
    c.add(scene.add.rectangle(0, b - 15.5, 3, 0.8, n(0x8a4a3a)));
    // forearms on the rail
    c.add(scene.add.rectangle(-8, b + 1, 7, 2.4, n(0xe8b890)).setAngle(-14));
    c.add(scene.add.rectangle(8, b + 1, 7, 2.4, n(0xe8b890)).setAngle(14));
  }

  // the felt, rail and apron: Froggy 21's own
  c.add(paintFelt(scene, 0, 0));

  // ---- the board, lying on the felt, seen at the same low angle
  const ring = [0xc31f2e, 0xffd45e, 0x3f6fd8, 0x46c46e, 0xff7a3d, 0x7b4bd8, 0x7ec8e8, 0xff7ab8];
  c.add(scene.add.rectangle(0, -15, 34, 13, PALETTE.cream).setStrokeStyle(1, PALETTE.ink));
  c.add(scene.add.rectangle(0, -15, 24, 7, 0x2a6a3a));
  for (let i = 0; i < 8; i++) {
    c.add(scene.add.rectangle(-14 + i * 4, -20, 3, 1.4, ring[i]));
    c.add(scene.add.rectangle(14 - i * 4, -10, 3, 1.4, ring[(i + 3) % 8]));
  }
  c.add(scene.add.rectangle(-15.5, -15, 1.4, 5, ring[5]));
  c.add(scene.add.rectangle(15.5, -15, 1.4, 5, ring[2]));
  // the name across the middle, in the lettering's gold
  c.add(scene.add.rectangle(0, -15, 14, 1.4, PALETTE.gold).setAlpha(0.85));
  // the two pieces: Froggy's green and the player's gold
  c.add(scene.add.circle(-12, -19, 1.6, who === 'nerd' ? 0x6a7a5a : 0x46c46e).setStrokeStyle(0.6, PALETTE.ink));
  c.add(scene.add.circle(13, -11, 1.6, PALETTE.gold).setStrokeStyle(0.6, PALETTE.ink));
  // a pair of dice on the near side, where the last roll stopped
  for (const [dx, ang] of [
    [-24, -12],
    [-19, 10],
  ] as const) {
    c.add(scene.add.rectangle(dx, -10, 4, 4, PALETTE.cream).setAngle(ang).setStrokeStyle(0.6, PALETTE.ink));
    c.add(scene.add.rectangle(dx, -10, 1, 1, PALETTE.ink).setAngle(ang));
  }
  // and the money: his pile at the back, yours at the near edge
  const notes = (nx: number, ny: number, k: number) => {
    for (let i = 0; i < k; i++) c.add(scene.add.rectangle(nx, ny - i * 1.2, 7, 3, i % 2 ? 0x9ad7a0 : 0xe8d890).setStrokeStyle(0.5, 0x3a5a3a));
  };
  notes(26, -20, 3);
  notes(22, -8, 4);

  // ---- the player's chair, pulled up to the near edge (as at Froggy 21)
  c.add(chairAt(scene, 0, 26, 0, 0.72));

  if (night) {
    // after closing: the same furniture, switched off and dark
    c.each((o: Phaser.GameObjects.GameObject) => {
      const sh = o as Phaser.GameObjects.Shape;
      if (sh.isFilled) sh.setFillStyle(nightify(sh.fillColor, 0.75), sh.fillAlpha);
      if (sh.isStroked) sh.setStrokeStyle(sh.lineWidth, nightify(sh.strokeColor, 0.75), sh.strokeAlpha);
    });
  }
  return c;
}
