/**
 * THE BEGGING SPOT: a flattened cardboard box with a folded blanket on it, a
 * cardboard sign propped by it, and a paper cup.  The forecourt has it by the
 * arcade's wall (ExteriorDay), and the opening scene has the same one under
 * the player, sat there before the man comes along (IntroCutscene).
 *
 * `at` is the middle of the box, `y0` the line a seated figure sits on.
 */

import type Phaser from 'phaser';
import { grain } from './surface';

/**
 * THE PITCH, up against the arcade's wall: a flattened box laid on the
 * pavement, an old blanket folded on one end, a sign propped on the stone.
 *
 * Drawn the way the building behind it is drawn -- a one-pixel ink line
 * round everything, courses and seams in it rather than flat fill, the same
 * speckled grain over the top, and a contact shadow where it meets the
 * ground -- so the cardboard belongs to the same street as the brick, the
 * plinth and the pavement slabs instead of sitting on them as two tan
 * rectangles.
 */
export function paintBegSpot(scene: Phaser.Scene, at: number, y0: number, depth = 49): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  const x = at - 16;
  const y = y0 - 2;
  const W = 32;
  const H = 7;
  // the shadow it casts on the slabs, softest at the far edge
  for (let i = 0; i < 3; i++) g.fillStyle(0x000000, 0.1 - i * 0.03).fillRect(x - i, y + H - 1 + i, W + i * 2, 1);
  // the box, opened out flat: ink line, card, a lit top edge
  g.fillStyle(0x14100c, 1).fillRect(x - 1, y - 1, W + 2, H + 2);
  g.fillStyle(0xa8835a, 1).fillRect(x, y, W, H);
  g.fillStyle(0xc49c6c, 1).fillRect(x, y, W, 1);
  g.fillStyle(0x8a6a44, 1).fillRect(x, y + H - 1, W, 1);
  // the flutes of the corrugation, running the length of it
  for (let k = 1; k < W; k += 3) {
    g.fillStyle(0x97744e, 0.5).fillRect(x + k, y + 1, 1, H - 2);
    g.fillStyle(0xbb9264, 0.35).fillRect(x + k + 1, y + 1, 1, H - 2);
  }
  // the folds where the flaps came over, creased pale along the crest
  for (const fx of [10, 21]) {
    g.fillStyle(0x6e5230, 1).fillRect(x + fx, y, 1, H);
    g.fillStyle(0xd0ab7c, 0.8).fillRect(x + fx + 1, y, 1, H);
  }
  // a torn corner, and a strip of parcel tape with a shine on it
  g.fillStyle(0x9a948a, 1).fillRect(x + W - 3, y, 3, 2);
  g.fillStyle(0xd8d0b8, 0.55).fillRect(x + 3, y + 2, 7, 2);
  g.fillStyle(0xf0ead8, 0.35).fillRect(x + 3, y + 2, 7, 1);
  grain(g, x, y, W, H, 0xa8835a, 73, 0.16, 0.14);
  // the blanket, folded at the wall end: wool, with a worn stripe
  const bx = x + 2;
  const by = y - 4;
  g.fillStyle(0x14100c, 1).fillRect(bx - 1, by - 1, 13, 6);
  g.fillStyle(0x55626f, 1).fillRect(bx, by, 11, 4);
  g.fillStyle(0x76838f, 1).fillRect(bx, by, 11, 1);
  g.fillStyle(0x3e4954, 1).fillRect(bx, by + 3, 11, 1);
  g.fillStyle(0x9a3a3a, 1).fillRect(bx + 3, by, 1, 4).fillRect(bx + 7, by, 1, 4);
  grain(g, bx, by, 11, 4, 0x55626f, 29, 0.14, 0.18);
  // ---- the sign, propped against the arcade's plinth
  const sx = at + 14;
  const sy = y0 - 15;
  const sw = 13;
  const sh = 12;
  g.fillStyle(0x000000, 0.18).fillRect(sx - 2, sy + sh - 1, sw + 4, 2);
  g.fillStyle(0x14100c, 1).fillRect(sx - 1, sy - 1, sw + 2, sh + 2);
  g.fillStyle(0xb08c60, 1).fillRect(sx, sy, sw, sh);
  g.fillStyle(0xc9a470, 1).fillRect(sx, sy, sw, 1);
  // the cut top edge, where the corrugation shows through
  for (let k = 0; k < sw; k += 2) g.fillStyle(0x8a6a44, 0.7).fillRect(sx + k, sy + 1, 1, 1);
  // it leans, so one side catches the light and the other is in shadow
  g.fillStyle(0xd0ab7c, 0.5).fillRect(sx, sy, 1, sh);
  g.fillStyle(0x7a5c3a, 0.6).fillRect(sx + sw - 1, sy, 1, sh);
  // marker, in a hand that has written it many times: uneven lines
  g.fillStyle(0x241a12, 1)
    .fillRect(sx + 2, sy + 3, 9, 1)
    .fillRect(sx + 2, sy + 5, 6, 1)
    .fillRect(sx + 2, sy + 7, 8, 1)
    .fillRect(sx + 2, sy + 9, 4, 1);
  grain(g, sx, sy, sw, sh, 0xb08c60, 41, 0.14, 0.12);
  // a damp, dirty foot where it stands in the pavement grit
  g.fillStyle(0x6a5438, 0.8).fillRect(sx, sy + sh - 1, sw, 1);
  return g;
}

/** The cup, on the cardboard until somebody sits down with it (then it is in their hand). */
export function paintBegCup(scene: Phaser.Scene, at: number, y0: number, depth = 49): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(0x14100c, 1).fillRect(at + 6, y0 - 7, 6, 6);
  g.fillStyle(0x9aa0a8, 1).fillRect(at + 7, y0 - 6, 4, 5);
  g.fillStyle(0x3a3e44, 1).fillRect(at + 7, y0 - 6, 4, 1);
  return g;
}
