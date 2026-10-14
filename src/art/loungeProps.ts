/**
 * The fourth room's furniture: the two claw machines in its top-left corner.
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

export type CraneKind = 'plush' | 'oddity';
export const CRANE_W = 30;
/** A little over 2 m against the 26-pixel man, marquee and all. */
export const CRANE_H = 36;

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
  c.add(scene.add.rectangle(0, -6, W, 12, frame).setStrokeStyle(1, n(PALETTE.ink)));
  c.add(scene.add.rectangle(0, -2, W - 2, 1, trim));
  c.add(scene.add.rectangle(0, -11, W, 2, side));
  // the prize door, front left, with its flap
  c.add(scene.add.rectangle(-W / 2 + 6, -5, 8, 5, n(PALETTE.black)).setStrokeStyle(0.6, trim));
  c.add(scene.add.rectangle(-W / 2 + 6, -7, 8, 1.2, n(0x5a5a6a)));
  // the coin slot and the stick and button on the panel
  c.add(scene.add.rectangle(W / 2 - 5, -5, 3, 4, n(0x3a3a3a)));
  c.add(scene.add.rectangle(W / 2 - 5, -5, 1, 2, n(PALETTE.gold)));
  c.add(scene.add.rectangle(1, -10, 1, 3, n(0x2a2a2a)));
  c.add(scene.add.circle(1, -12, 1.4, n(0xd8202a)));
  c.add(scene.add.circle(5, -11, 1.2, n(0x46c46e)));
  // ---- THE GLASS BOX, heaped to halfway with prizes
  const gTop = -H + 7;
  const gH = -12 - gTop;
  c.add(scene.add.rectangle(0, gTop + gH / 2, W - 2, gH, glassCol));
  c.add(scene.add.rectangle(0, gTop + 2, W - 4, 4, 0xffffff, eerie ? 0.03 : 0.08));
  const pile = eerie ? [0x6a3a8a, 0x8a7aa0, 0x3a2a4a, 0x5a2a6a, 0x9fd4e0] : [0x46c46e, 0xa8743e, 0xf2e6d8, 0xffc830, 0x8a8f99, 0x7b4bd8, 0xff7ab0];
  let i = 0;
  // three layers, the back row first, each a bit narrower and higher
  for (const [row, y0, inset] of [[0, -14.5, 3], [1, -13.5, 5], [2, -16.5, 7], [3, -19, 9]] as const) {
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
  c.add(scene.add.rectangle(3, gTop + 4, 0.6, 3, n(0xb0b8c4)));
  c.add(scene.add.triangle(3, gTop + 6, -2, 0, 2, 0, 0, 3, n(PALETTE.steel)));
  // the corner posts, and a glint down the glass
  for (const sx of [-W / 2 + 0.5, W / 2 - 0.5]) c.add(scene.add.rectangle(sx, gTop + gH / 2, 1.5, gH, n(0xc8d0dc)));
  c.add(scene.add.rectangle(-W / 2 + 5, gTop + gH / 2, 1.2, gH - 2, 0xffffff, 0.12).setAngle(6));
  c.add(scene.add.rectangle(-W / 2 + 7.5, gTop + gH / 2, 0.6, gH - 4, 0xffffff, 0.1).setAngle(6));
  // ---- THE MARQUEE: a lit sign with a row of bulbs round it
  const head = scene.add.rectangle(0, -H + 3, W, 8, n(0x0c0814)).setStrokeStyle(1, trim);
  c.add(head);
  c.add(scene.add.rectangle(0, -H - 1.5, W + 2, 2, frame));
  c.add(centerText(scene, 0, -H + 3, eerie ? '???' : 'GRAB', n(eerie ? 0xc8a0e0 : PALETTE.gold)));
  const bulbs: Phaser.GameObjects.Arc[] = [];
  for (let b = 0; b < 7; b++) {
    const bulb = scene.add.circle(-W / 2 + 1 + b * ((W - 2) / 6), -H - 1.5, 0.8, n(eerie ? 0xc8a0e0 : 0xffe080));
    bulbs.push(bulb);
    c.add(bulb);
  }
  if (!night) {
    // The plush crane chases its lights; the other one flickers, unwell.
    const glow = scene.add.rectangle(0, -19, W + 2, 18, eerie ? 0x8a4ab8 : PALETTE.tealLight, 0.07);
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

export const CLASH_W = 36;
export const CLASH_H = 34;

/**
 * CREATURE CLASH, the cabinet: a tall upright with a lit marquee, a screen
 * with two little creatures squaring up on it, and two sticks on the panel
 * (it is a twin-stick game).  Feet on `y`, sorted with the player like the
 * cranes.  After closing: dark glass, the marquee off.
 */
export function paintClashCabinet(scene: Phaser.Scene, x: number, y: number, night: boolean): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(depthFor(y));
  const n = (col: number) => (night ? nightify(col, 0.75) : col);
  const W = CLASH_W;
  const H = CLASH_H;
  // body and side panels
  c.add(scene.add.rectangle(0, -H / 2, W, H, n(0x1e2a5a)).setStrokeStyle(1, n(PALETTE.ink)));
  c.add(scene.add.rectangle(-W / 2 + 2, -H / 2, 3, H - 2, n(0x3a5ab8)));
  c.add(scene.add.rectangle(W / 2 - 2, -H / 2, 3, H - 2, n(0x3a5ab8)));
  // marquee
  c.add(scene.add.rectangle(0, -H + 5, W - 2, 10, n(night ? 0x1a1a2a : 0xf0a830)).setStrokeStyle(1, n(PALETTE.ink)));
  c.add(centerText(scene, 0, -H + 6, 'CLASH', night ? nightify(PALETTE.ink, 0.6) : PALETTE.ink));
  // screen: two creatures facing off on grass
  c.add(scene.add.rectangle(0, -H + 15, W - 8, 12, n(0x0c1020)).setStrokeStyle(1, n(0x5a6a98)));
  if (!night) {
    c.add(scene.add.rectangle(0, -H + 19, W - 10, 3, 0x3a7a3a));
    c.add(scene.add.circle(-5, -H + 15, 2.5, 0xe8642a));
    c.add(scene.add.circle(5, -H + 15, 2.5, 0x3a8ad8));
    c.add(scene.add.rectangle(0, -H + 14, 3, 1, 0xfff4a0));
    const glow = scene.add.rectangle(0, -H + 15, W - 8, 12, 0x8ab0ff, 0.12);
    c.add(glow);
    scene.tweens.add({ targets: glow, alpha: 0.02, duration: 700, yoyo: true, repeat: -1 });
  }
  // control panel: two sticks and three buttons
  c.add(scene.add.rectangle(0, -9, W - 2, 5, n(0x2a3a78)));
  for (const sx of [-8, 8]) {
    c.add(scene.add.rectangle(sx, -12, 1, 3, n(0x101010)));
    c.add(scene.add.circle(sx, -13, 1.5, n(0xd83a4a)));
  }
  for (const [bx, col] of [[-2, 0xf0d030], [1, 0x5ac85a], [4, 0x4a9aff]] as const) c.add(scene.add.rectangle(bx - 1, -9, 2, 2, n(col)));
  // coin door
  c.add(scene.add.rectangle(0, -3, 8, 4, n(0x141a3a)).setStrokeStyle(1, n(0x5a6a98)));
  return c;
}
