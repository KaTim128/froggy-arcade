/**
 * The fourth room's furniture: the two claw machines in its top-right corner
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
  // the cabinet: a base with the prize chute, a glass box, a lit header
  c.add(scene.add.rectangle(0, -7, W, 14, frame).setStrokeStyle(1, n(PALETTE.ink)));
  c.add(scene.add.rectangle(W / 2 - 6, -8, 7, 6, n(PALETTE.black)));
  c.add(scene.add.rectangle(-W / 2 + 6, -9, 6, 3, n(PALETTE.gold)));
  const glass = scene.add.rectangle(0, -14 - 11, W - 2, 22, n(eerie ? 0x140c1c : 0x1c2a3a)).setStrokeStyle(1, trim);
  c.add(glass);
  // what is in it, heaped on the floor of the box
  const pile = eerie ? [0x6a3a8a, 0x9fd4e0, 0xe8dcc0, 0x3a2a4a, 0xe8a030] : [0x46c46e, 0xa8743e, 0xf2e6d8, 0xffc830, 0x8a8f99, 0x7b4bd8];
  for (let i = 0; i < 7; i++) {
    const px = -W / 2 + 4 + ((i * 17) % (W - 8));
    const py = -16 - (i % 2) * 3;
    if (eerie) c.add(scene.add.circle(px, py, 2.4, n(pile[i % pile.length])).setStrokeStyle(0.5, n(0x8a7aa0)));
    else {
      c.add(scene.add.circle(px, py, 2.6, n(pile[i % pile.length])));
      c.add(scene.add.circle(px - 1.6, py - 2.4, 1, n(pile[i % pile.length])));
      c.add(scene.add.circle(px + 1.6, py - 2.4, 1, n(pile[i % pile.length])));
    }
  }
  // the claw on its gantry
  c.add(scene.add.rectangle(0, -34, W - 4, 1, n(PALETTE.steel)));
  c.add(scene.add.rectangle(2, -31, 1, 6, n(PALETTE.steel)));
  c.add(scene.add.triangle(2, -27, -2, 0, 2, 0, 0, 3, n(PALETTE.steel)));
  // the header, lit
  const head = scene.add.rectangle(0, -H + 1, W, 8, frame).setStrokeStyle(1, trim);
  c.add(head);
  c.add(centerText(scene, 0, -H + 1, eerie ? '? ? ?' : 'GRAB', n(eerie ? 0xc8a0e0 : PALETTE.gold)));
  if (!night) {
    // The plush crane chases its lights; the other one flickers, unwell.
    const glow = scene.add.rectangle(0, -25, W + 2, 24, eerie ? 0x8a4ab8 : PALETTE.tealLight, 0.07);
    c.add(glow);
    if (eerie) {
      scene.time.addEvent({
        delay: 140,
        loop: true,
        callback: () => glow.setAlpha(Math.random() < 0.12 ? 0.02 : 0.07 + Math.random() * 0.05),
      });
    } else {
      scene.tweens.add({ targets: glow, alpha: 0.03, duration: 700, yoyo: true, repeat: -1 });
    }
  }
  return c;
}

export type Opponent = 'froggy' | 'nerd' | null;

/** The table with the board on it, two stools, and the one waiting to play. */
export function paintBoardTable(scene: Phaser.Scene, x: number, y: number, who: Opponent, night: boolean): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(depthFor(y));
  const n = (col: number) => (night ? nightify(col, 0.75) : col);
  // the far stool, and whoever sits on it, BEHIND the table top
  c.add(scene.add.rectangle(0, -20, 10, 3, n(0x5a3e26)));
  if (who === 'froggy') {
    // Froggy as the arcade knew him: round, green, pleased to see you
    c.add(scene.add.ellipse(0, -27, 16, 12, n(0x46c46e)).setStrokeStyle(1, n(0x123a22)));
    c.add(scene.add.ellipse(0, -25, 10, 6, n(0xffd45e)));
    c.add(scene.add.circle(-4, -35, 3.2, n(PALETTE.cream)).setStrokeStyle(1, n(0x123a22)));
    c.add(scene.add.circle(4, -35, 3.2, n(PALETTE.cream)).setStrokeStyle(1, n(0x123a22)));
    c.add(scene.add.circle(-3.6, -35, 1.4, n(PALETTE.black)));
    c.add(scene.add.circle(4.4, -35, 1.4, n(PALETTE.black)));
    c.add(scene.add.rectangle(0, -29.5, 6, 1, n(0x123a22)));
  } else if (who === 'nerd') {
    // a skinny young man in a striped polo and big round glasses, hunched
    // over the board like it owes him money
    c.add(scene.add.rectangle(0, -27, 9, 11, n(0x3f6fd8)));
    for (let i = 0; i < 3; i++) c.add(scene.add.rectangle(0, -30 + i * 3.4, 9, 1, n(0xf2e6d8)));
    c.add(scene.add.rectangle(0, -34.5, 3, 2, n(0xe8b890)));
    c.add(scene.add.ellipse(0, -39, 8, 9, n(0xe8b890)));
    c.add(scene.add.rectangle(0, -43, 9, 3, n(0x3a2618)));
    c.add(scene.add.circle(-2, -39, 1.8).setStrokeStyle(0.8, n(0x1a1410)));
    c.add(scene.add.circle(2, -39, 1.8).setStrokeStyle(0.8, n(0x1a1410)));
    c.add(scene.add.rectangle(0, -39, 1, 0.6, n(0x1a1410)));
    c.add(scene.add.rectangle(-5.5, -25, 2, 7, n(0xe8b890)).setAngle(-20));
    c.add(scene.add.rectangle(5.5, -25, 2, 7, n(0xe8b890)).setAngle(20));
  }
  // the table: a top, its edge and two legs
  c.add(scene.add.rectangle(-14, -6, 2, 12, n(0x4a3020)));
  c.add(scene.add.rectangle(14, -6, 2, 12, n(0x4a3020)));
  c.add(scene.add.rectangle(0, -14, 38, 6, n(0x6a4a2c)).setStrokeStyle(1, n(0x3a2618)));
  // the board on it: a green square with a ring of coloured spaces
  c.add(scene.add.rectangle(0, -17.5, 24, 5, n(0x2a6a3a)).setStrokeStyle(0.6, n(0xf2e6d8)));
  const cols = [0xc31f2e, 0xffd45e, 0x3f6fd8, 0x46c46e, 0xff7a3d, 0x7b4bd8];
  for (let i = 0; i < 6; i++) c.add(scene.add.rectangle(-10 + i * 4, -19.5, 3, 1, n(cols[i])));
  // the two pieces: Froggy's before the night, a dead frog's after it
  c.add(scene.add.circle(-4, -21, 1.3, n(who === 'nerd' ? 0x6a7a5a : 0x46c46e)));
  c.add(scene.add.circle(5, -21, 1.3, n(PALETTE.gold)));
  // and the near stool, the player's
  c.add(scene.add.rectangle(0, 4, 10, 3, n(0x5a3e26)));
  return c;
}
