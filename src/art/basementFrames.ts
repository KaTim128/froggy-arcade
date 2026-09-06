/**
 * The ten basement images.  PRD §7.14.
 *
 * Static.  BS-5: no ambient animation anywhere in this sequence except the
 * frame-8 flicker.  Nothing moves, nothing breathes, nothing is alive on
 * screen.  That is what makes frame 5 work.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { GAME_W, GAME_H } from '../render/pixelScaler';

const DARK = 0x05070a;

/** A receding corridor.  `depth` stretches it without changing the tiles. */
export function paintCorridor(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  depth = 1,
  pipes = true,
): void {
  const vpX = GAME_W / 2;
  const vpY = 88;
  const g = scene.add.graphics();

  // the far end is simply dark: there is no back wall drawn, ever
  g.fillStyle(DARK, 1);
  g.fillRect(0, 0, GAME_W, GAME_H);

  const steps = 7;
  for (let i = steps; i >= 1; i--) {
    // higher depth = the rings crowd toward the vanishing point, so the same
    // corridor reads as longer without new art (frame 3 vs frame 2)
    const t = Math.pow(i / steps, 1 + 0.35 * (depth - 1));
    const w = 34 + t * (GAME_W - 34);
    const h = 30 + t * (GAME_H - 4);
    const x = vpX - w / 2;
    const y = vpY - h * 0.42;
    const shade = 0.06 + t * 0.16;

    g.fillStyle(PALETTE.slate, shade);
    g.fillRect(x, y, w, h);
    g.lineStyle(1, PALETTE.ink, 0.5 + t * 0.4);
    g.strokeRect(x, y, w, h);
  }

  if (pipes) {
    const pg = scene.add.graphics();
    pg.lineStyle(2, PALETTE.steel, 0.35);
    for (const off of [-14, -6, 4]) {
      pg.beginPath();
      pg.moveTo(0, vpY - 46 + off);
      pg.lineTo(vpX - 6, vpY - 10);
      pg.strokePath();
      pg.beginPath();
      pg.moveTo(GAME_W, vpY - 46 + off);
      pg.lineTo(vpX + 6, vpY - 10);
      pg.strokePath();
    }
    container.add(pg);
  }

  container.add(g);
}

/** Frame 1: concrete stairs down into black, the only light behind the player. */
export function paintStairs(scene: Phaser.Scene, c: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  g.fillStyle(DARK, 1);
  g.fillRect(0, 0, GAME_W, GAME_H);

  for (let i = 0; i < 9; i++) {
    const t = i / 9;
    const w = 150 - t * 96;
    const x = GAME_W / 2 - w / 2;
    const y = 62 + i * 13;
    g.fillStyle(PALETTE.slate, 0.34 - t * 0.28);
    g.fillRect(x, y, w, 9);
    g.fillStyle(PALETTE.ink, 0.5);
    g.fillRect(x, y + 9, w, 4);
  }

  // walls closing in
  g.fillStyle(PALETTE.ink, 0.75);
  g.fillTriangle(0, 0, 84, 0, 0, GAME_H);
  g.fillTriangle(GAME_W, 0, GAME_W - 84, 0, GAME_W, GAME_H);

  // the bare bulb at the top, behind you
  g.fillStyle(PALETTE.cream, 0.16);
  g.fillCircle(GAME_W / 2, 8, 26);
  g.fillStyle(PALETTE.gold, 0.8);
  g.fillCircle(GAME_W / 2, 8, 3);
  c.add(g);
}

/** Frame 4: one wooden chair, facing away.  Never explained. */
export function paintChairRoom(scene: Phaser.Scene, c: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  g.fillStyle(DARK, 1);
  g.fillRect(0, 0, GAME_W, GAME_H);
  g.fillStyle(PALETTE.slate, 0.18);
  g.fillRect(46, 44, GAME_W - 92, 108);
  g.lineStyle(1, PALETTE.ink, 0.9);
  g.strokeRect(46, 44, GAME_W - 92, 108);

  // door on the far wall
  g.fillStyle(PALETTE.brown, 0.55);
  g.fillRect(GAME_W / 2 - 14, 62, 28, 52);
  g.lineStyle(1, PALETTE.ink, 1);
  g.strokeRect(GAME_W / 2 - 14, 62, 28, 52);
  g.fillStyle(PALETTE.gold, 0.5);
  g.fillCircle(GAME_W / 2 + 8, 90, 1.5);

  // the chair, seen from behind
  g.fillStyle(PALETTE.brown, 0.9);
  g.fillRect(140, 112, 28, 4); // seat
  g.fillRect(140, 96, 28, 3); // back rail
  g.fillRect(140, 100, 3, 16);
  g.fillRect(165, 100, 3, 16);
  g.fillRect(142, 116, 3, 18); // legs
  g.fillRect(163, 116, 3, 18);
  c.add(g);
}

/**
 * Frame 5.  PRD H2 / FMEA #7.
 *
 * A frog-like shape with a single visible eye, far down the corridor.  About 12
 * logical pixels tall, drawn a hair above the background value and never lit,
 * never animated.  Most players will not be sure they saw anything, and the
 * game never acknowledges it — not here, not in frame 6, not ever.
 *
 * Do not brighten this.  Do not add a glow.  Do not make it move.
 */
export function paintFarFigure(scene: Phaser.Scene, c: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  const x = GAME_W / 2 + 3;
  const y = 94;

  // barely above the background: a fixed, small delta in palette space
  g.fillStyle(0x121a20, 1);
  g.fillRoundedRect(x - 5, y - 7, 10, 11, 3);
  g.fillCircle(x - 3, y - 8, 2.4);
  g.fillCircle(x + 3, y - 8, 2.4);

  // one eye catches something.  Only one.
  g.fillStyle(0x1c2630, 1);
  g.fillCircle(x + 3, y - 8, 1.1);

  c.add(g);
}

/** Frames 6 / 4: a plain door at the end of a corridor. */
export function paintPlainDoor(scene: Phaser.Scene, c: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  g.fillStyle(PALETTE.brown, 0.6);
  g.fillRect(GAME_W / 2 - 20, 58, 40, 74);
  g.lineStyle(1, PALETTE.ink, 1);
  g.strokeRect(GAME_W / 2 - 20, 58, 40, 74);
  g.fillStyle(PALETTE.ink, 0.6);
  g.fillRect(GAME_W / 2 - 14, 66, 28, 26);
  g.fillRect(GAME_W / 2 - 14, 98, 28, 26);
  g.fillStyle(PALETTE.gold, 0.55);
  g.fillCircle(GAME_W / 2 + 12, 96, 2);
  c.add(g);
}

/** Frame 7: a dim bulb on a cord, and a key hanging from it. */
export function paintKeyRoom(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
): { bulb: Phaser.GameObjects.Arc; key: Phaser.GameObjects.Container; glow: Phaser.GameObjects.Arc } {
  const g = scene.add.graphics();
  g.fillStyle(DARK, 1);
  g.fillRect(0, 0, GAME_W, GAME_H);
  g.fillStyle(PALETTE.slate, 0.14);
  g.fillRect(52, 40, GAME_W - 104, 116);
  g.lineStyle(1, PALETTE.ink, 0.9);
  g.strokeRect(52, 40, GAME_W - 104, 116);
  g.lineStyle(1, PALETTE.steel, 0.7);
  g.beginPath();
  g.moveTo(GAME_W / 2, 40);
  g.lineTo(GAME_W / 2, 74);
  g.strokePath();
  c.add(g);

  const glow = scene.add.circle(GAME_W / 2, 78, 34, PALETTE.cream, 0.09);
  const bulb = scene.add.circle(GAME_W / 2, 78, 4, PALETTE.gold, 0.85);

  const ring = scene.add.circle(0, -4, 3).setStrokeStyle(1, PALETTE.bone);
  const shaft = scene.add.rectangle(0, 3, 2, 10, PALETTE.bone);
  const bit = scene.add.rectangle(2, 6, 4, 2, PALETTE.bone);
  const key = scene.add.container(GAME_W / 2, 94, [ring, shaft, bit]);

  c.add([glow, bulb, key]);
  return { bulb, key, glow };
}

/** Frame 9: the reverse angle.  There is nothing there. */
export function paintReverse(scene: Phaser.Scene, c: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  g.fillStyle(DARK, 1);
  g.fillRect(0, 0, GAME_W, GAME_H);
  g.fillStyle(PALETTE.slate, 0.10);
  g.fillRect(52, 40, GAME_W - 104, 116);
  g.lineStyle(1, PALETTE.ink, 0.9);
  g.strokeRect(52, 40, GAME_W - 104, 116);

  // just the door you came through
  g.fillStyle(PALETTE.brown, 0.4);
  g.fillRect(GAME_W / 2 - 18, 60, 36, 70);
  g.lineStyle(1, PALETTE.ink, 1);
  g.strokeRect(GAME_W / 2 - 18, 60, 36, 70);
  c.add(g);
}
