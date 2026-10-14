/**
 * The attack icons, in the game's own pixels: an arrow for a shot, three for
 * a fan, a burst for an area, a sword for a charge, a crosshair for a line
 * that hits one target at once, a mine for a trap, a shield for a guard, a
 * swoosh for a blink.  About nine pixels square, centred on (x, y).
 */

import Phaser from 'phaser';
import type { AttackKind } from '../game/creatures';

export function drawAttackIcon(g: Phaser.GameObjects.Graphics, kind: AttackKind, x: number, y: number, col: number): void {
  const px = (dx: number, dy: number, w = 1, h = 1, c = col) => g.fillStyle(c, 1).fillRect(Math.round(x + dx), Math.round(y + dy), w, h);
  switch (kind) {
    case 'bolt':
      // an arrow, flying right
      px(-4, 0, 7, 1);
      px(1, -2, 1, 1);
      px(2, -1, 1, 1);
      px(2, 1, 1, 1);
      px(1, 2, 1, 1);
      px(-4, -1, 1, 1);
      px(-4, 1, 1, 1);
      break;
    case 'spread':
      // three arrows fanning out
      px(-4, 0, 6, 1);
      px(2, -1, 1, 3);
      px(-4, -3, 1, 1);
      px(-3, -3, 4, 1);
      px(1, -4, 1, 1);
      px(-4, 3, 1, 1);
      px(-3, 3, 4, 1);
      px(1, 4, 1, 1);
      break;
    case 'nova':
      // a burst: a ring with rays
      px(-1, -1, 3, 3);
      for (const [dx, dy] of [
        [0, -4], [0, 3], [-4, 0], [3, 0], [-3, -3], [2, -3], [-3, 2], [2, 2],
      ] as const) px(dx, dy, 2, 2);
      break;
    case 'dash':
      // a sword, point up and right
      for (let i = 0; i < 6; i++) px(-2 + i, 2 - i, 1, 1);
      px(-3, 1, 3, 1);
      px(-2, 0, 1, 3);
      px(-4, 3, 1, 1);
      break;
    case 'beam':
      // a crosshair
      g.lineStyle(1, col, 1).strokeCircle(x + 0.5, y + 0.5, 3.5);
      px(0, -5, 1, 3);
      px(0, 3, 1, 3);
      px(-5, 0, 3, 1);
      px(3, 0, 3, 1);
      px(0, 0, 1, 1);
      break;
    case 'mine':
      // a mine with a fuse spark
      g.fillStyle(col, 1).fillCircle(x, y + 1, 3);
      px(1, -4, 1, 2);
      px(2, -5, 1, 1, 0xffe060);
      break;
    case 'shield':
      // a heater shield
      px(-3, -4, 7, 4);
      px(-2, 0, 5, 2);
      px(-1, 2, 3, 1);
      px(0, 3, 1, 1);
      px(0, -3, 1, 5, 0x000000);
      break;
    case 'blink':
      // a swoosh with speed lines
      px(-4, -2, 4, 1);
      px(-3, 0, 5, 1);
      px(-4, 2, 4, 1);
      px(2, -1, 2, 3);
      break;
  }
}
