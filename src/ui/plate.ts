/**
 * A solid box behind a line of text that has none -- the drifter's thoughts,
 * what just happened, the notices along the bottom of the screen -- so it
 * reads over a bright street as well as a dark room.  It follows the text
 * every frame (where it is, how big it came out, whether it is showing and
 * how faded), so whatever the scene already does with the text -- set it,
 * fade it, hide it -- the box does too.
 *
 * And it keeps the line on the screen: a long line wraps (centred) instead of
 * running off the edge, and a line near an edge is nudged back in, box and
 * all.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { GAME_H, GAME_W } from '../render/pixelScaler';

/**
 * How opaque every box of words is -- the subtitles, the talk panels,
 * Froggy's box: enough to read the words on, not so much that the room,
 * the people in it and what can be used are hidden behind it.
 */
export const DIALOGUE_ALPHA = 0.62;

/** Where a line of subtitle sits: on the bottom edge of the screen. */
export const SUBTITLE_Y = GAME_H - 12;

/** The widest a line runs before it wraps. */
const MAX_W = GAME_W - 30;
/** How close the box comes to the screen's edge. */
const EDGE = 3;

export function backPlate(scene: Phaser.Scene, t: Phaser.GameObjects.BitmapText, edge: number = PALETTE.steel): Phaser.GameObjects.Rectangle {
  if (!t.maxWidth || t.maxWidth > MAX_W) t.setMaxWidth(MAX_W);
  t.setCenterAlign();
  const r = scene.add.rectangle(0, 0, 4, 4, PALETTE.ink, 1).setOrigin(0, 0).setStrokeStyle(1, edge).setVisible(false);
  const sync = () => {
    if (!t.active) {
      r.destroy();
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync);
      return;
    }
    const on = t.visible && t.alpha > 0.01 && t.text.trim().length > 0;
    r.setVisible(on);
    if (!on) return;
    let b = t.getBounds();
    // keep it in view: the camera's view for a line in the world, the screen
    // for a line fixed to it
    const cam = scene.cameras.main;
    const vx = t.scrollFactorX === 0 ? 0 : cam.worldView.x;
    const vy = t.scrollFactorY === 0 ? 0 : cam.worldView.y;
    const vw = t.scrollFactorX === 0 ? GAME_W : cam.worldView.width || GAME_W;
    const vh = t.scrollFactorY === 0 ? GAME_H : cam.worldView.height || GAME_H;
    let dx = 0;
    let dy = 0;
    if (b.x - 5 < vx + EDGE) dx = vx + EDGE - (b.x - 5);
    else if (b.right + 5 > vx + vw - EDGE) dx = vx + vw - EDGE - (b.right + 5);
    if (b.y - 4 < vy + EDGE) dy = vy + EDGE - (b.y - 4);
    else if (b.bottom + 3 > vy + vh - EDGE) dy = vy + vh - EDGE - (b.bottom + 3);
    if (dx || dy) {
      t.setPosition(Math.round(t.x + dx), Math.round(t.y + dy));
      b = t.getBounds();
    }
    // See-through, so the room behind the words still reads, and only as
    // big as the words need (see DIALOGUE_ALPHA)
    r.setPosition(Math.floor(b.x) - 4, Math.floor(b.y) - 3)
      .setSize(Math.ceil(b.width) + 8, Math.ceil(b.height) + 5)
      .setAlpha(t.alpha * DIALOGUE_ALPHA)
      .setDepth(t.depth - 0.01)
      .setScrollFactor(t.scrollFactorX, t.scrollFactorY);
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync));
  return r;
}

/**
 * THE [E] PROMPT AND THE DARK STRIP BEHIND IT, AS ONE THING.
 *
 * The strip used to be a rectangle made 4 pixels wide with its origin in the
 * middle and then stretched with `setSize` to fit the line.  `setSize` does
 * not move a shape's display origin, so it stayed 2 pixels in from the LEFT
 * edge and the box grew off to the right of the words: the longer the line,
 * the further it slid, and it changed every time the line did as you walked
 * from one machine to the next.
 *
 * Here the strip is pinned by its top-left corner to the text's own bounds,
 * sized from the text as it actually came out, and the pair is kept on the
 * view together -- a long name near an edge moves both, never one.
 */
export function fitPrompt(plate: Phaser.GameObjects.Rectangle, t: Phaser.GameObjects.BitmapText): void {
  const PAD_X = 4;
  const PAD_Y = 2;
  t.setOrigin(0.5, 0.5);
  const w = Math.ceil(t.width) + PAD_X * 2;
  const h = Math.ceil(t.height) + PAD_Y * 2;
  // on the view the text lives in (a room that scrolls, or the screen)
  const cam = t.scene.cameras.main;
  const vx = t.scrollFactorX === 0 ? 0 : cam.scrollX;
  const vy = t.scrollFactorY === 0 ? 0 : cam.scrollY;
  const half = w / 2;
  const cx = w + 2 * EDGE >= GAME_W ? vx + GAME_W / 2 : Phaser.Math.Clamp(t.x, vx + EDGE + half, vx + GAME_W - EDGE - half);
  const cy = Phaser.Math.Clamp(t.y, vy + EDGE + h / 2, vy + GAME_H - EDGE - h / 2);
  // whole pixels, from the left edge: the words and the box line up exactly
  const left = Math.round(cx - half);
  const top = Math.round(cy - h / 2);
  t.setPosition(left + half, top + h / 2);
  plate
    .setOrigin(0, 0)
    .setPosition(left, top)
    .setSize(w, h)
    .setScrollFactor(t.scrollFactorX, t.scrollFactorY)
    .setVisible(t.visible);
  plate.setDepth(Math.min(plate.depth, t.depth - 0.01));
}
