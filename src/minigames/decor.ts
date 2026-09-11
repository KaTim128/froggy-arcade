/**
 * Dressing for the cabinets.  A backdrop that is not a flat rectangle, and a
 * panel with an edge, so a game reads as a screen with a picture on it rather
 * than shapes on black.  Pure decoration: nothing here is interactive and
 * nothing here moves.
 */

import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../render/pixelScaler';

/** A deterministic scatter, so a backdrop is the same every time it is built. */
function scatter(i: number, mod: number, k: number): number {
  return (i * k + ((i * i) % 13) * 7) % mod;
}

/**
 * Two-tone backdrop under the title bar with a fine speckle over it and a
 * darker band at the bottom, like a lit cabinet screen.
 */
export function backdrop(scene: Phaser.Scene, top: number, bottom: number, opts: { speckle?: number; speckleColor?: number; band?: number } = {}): void {
  const y0 = 18;
  const h = GAME_H - y0;
  scene.add.rectangle(0, y0, GAME_W, h, top).setOrigin(0, 0);
  const band = opts.band ?? 0.35;
  scene.add.rectangle(0, y0 + h * (1 - band), GAME_W, h * band, bottom).setOrigin(0, 0);
  scene.add.rectangle(0, y0 + h * (1 - band) - 6, GAME_W, 12, bottom).setOrigin(0, 0).setAlpha(0.5);
  const n = opts.speckle ?? 70;
  for (let i = 0; i < n; i++) {
    const x = scatter(i, GAME_W, 97);
    const y = y0 + scatter(i, h, 61);
    scene.add.rectangle(x, y, 1, 1, opts.speckleColor ?? 0xffffff).setOrigin(0, 0).setAlpha(0.06 + (i % 3) * 0.03);
  }
  // the corners fall off, a little
  scene.add.rectangle(0, y0, GAME_W, 10, 0x000000).setOrigin(0, 0).setAlpha(0.25);
  scene.add.rectangle(0, GAME_H - 8, GAME_W, 8, 0x000000).setOrigin(0, 0).setAlpha(0.25);
}

/** A rounded panel with a lit top edge and a shadowed bottom edge. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill: number, edge: number, radius = 4): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(x + 2, y + 3, w, h, radius);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(1, edge, 1);
  g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, radius);
  return g;
}

/** A row of silhouettes along a band: a crowd, a hedge, a skyline. */
export function silhouettes(scene: Phaser.Scene, y: number, count: number, color: number, alpha = 0.6): void {
  for (let i = 0; i < count; i++) {
    const x = 6 + (i * (GAME_W - 12)) / count + scatter(i, 9, 31) - 4;
    const r = 5 + scatter(i, 5, 17);
    scene.add.circle(x, y + (r - 5), r, color).setAlpha(alpha);
  }
}
