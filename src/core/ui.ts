/**
 * Shared pixel-UI helpers.  Placeholder-grade by design (PRD §11.5): flat
 * rectangles until the art pass.  The text is not placeholder — it is the
 * 1-bit font in render/pixelFont.ts, because a browser-rasterised font cannot
 * be crisp inside a 320x180 buffer.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from './audio';
import { ensurePixelFont, FONT_KEY, FONT_H, FONT_ADVANCE } from '../render/pixelFont';
import { froggyLayer } from '../render/froggyLayer';

/**
 * `size` is a target pixel height, kept for the call sites that ask for big
 * text.  It snaps to a whole multiple of the font's 8px cell: a fractional
 * scale would resample the glyphs and undo the whole point of them.
 */
export function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  color: number = PALETTE.cream,
  size = FONT_H,
): Phaser.GameObjects.BitmapText {
  ensurePixelFont(scene);
  const scale = Math.max(1, Math.round(size / FONT_H));
  // RetroFont measures itself by cell WIDTH, so the size that renders a glyph
  // 1:1 is the cell advance — passing FONT_H here silently scales it by 1.6.
  const t = scene.add.bitmapText(x, y, FONT_KEY, str, FONT_ADVANCE * scale);
  t.setTint(color);
  return t;
}

export function centerText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  color: number = PALETTE.cream,
  size = FONT_H,
): Phaser.GameObjects.BitmapText {
  return text(scene, x, y, str, color, size).setOrigin(0.5, 0.5);
}

export interface ButtonOpts {
  width?: number;
  height?: number;
  fill?: number;
  hoverFill?: number;
  textColor?: number;
  disabled?: boolean;
}

export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOpts = {},
): Phaser.GameObjects.Container {
  const w = opts.width ?? Math.max(48, label.length * 6 + 12);
  const h = opts.height ?? 15;
  const fill = opts.fill ?? PALETTE.plum;
  const hoverFill = opts.hoverFill ?? PALETTE.neonDim;

  const box = scene.add.rectangle(0, 0, w, h, fill).setStrokeStyle(1, PALETTE.neon);
  const lbl = centerText(scene, 0, 0, label, opts.textColor ?? PALETTE.cream);
  const c = scene.add.container(x, y, [box, lbl]);
  c.setSize(w, h);
  // Phaser normalises the local point by the display origin BEFORE testing it
  // (pointWithinHitArea adds displayOriginX/Y), and a sized container's origin
  // is its centre.  So the hit area is measured from the top-left corner, not
  // from the middle: the old -w/2,-h/2 rectangle put every button's hot zone up
  // and to the left of the button you can see, which is why clicking CREATE on
  // the profile screen — or the middle of any button — did nothing.
  c.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);

  if (opts.disabled) {
    box.setFillStyle(PALETTE.slate);
    box.setStrokeStyle(1, PALETTE.steel);
    lbl.setTint(PALETTE.ash);
    return c;
  }

  c.on('pointerover', () => {
    box.setFillStyle(hoverFill);
    audio.sfx('ui_hover');
    scene.tweens.add({ targets: c, y: y - 1, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  });
  c.on('pointerout', () => box.setFillStyle(fill));
  c.on('pointerdown', () => {
    audio.sfx('ui_blip');
    onClick();
  });
  return c;
}

/** PRD SM-5: fade out 300ms -> teardown -> build -> fade in 300ms. */
export const FADE_MS = 300;

export function fadeToScene(scene: Phaser.Scene, key: string, data?: object): void {
  // Froggy is composited on his own canvas above the game buffer, and the
  // camera fade does not own that canvas -- so without this he stays brightly
  // lit over a room going to black.  The same progress that darkens the room
  // darkens him, so the two are never out of step.
  scene.cameras.main.fadeOut(FADE_MS, 0, 0, 0, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
    froggyLayer.setDim(1 - progress);
  });
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    froggyLayer.setDim(0);
    scene.scene.start(key, data);
  });
}

export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(FADE_MS, 0, 0, 0, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
    froggyLayer.setDim(progress);
  });
}
