/**
 * Shared pixel-UI helpers.  Placeholder-grade by design (PRD §11.5): flat
 * rectangles and bitmap-ish text until the Phase 7 art pass.
 */

import Phaser from 'phaser';
import { PALETTE, css } from '../render/palette';
import { audio } from './audio';

export function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  color: number = PALETTE.cream,
  size = 8,
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, str, {
    fontFamily: 'monospace',
    fontSize: `${size}px`,
    color: css(color),
  });
  t.setResolution(1);
  return t;
}

export function centerText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  color: number = PALETTE.cream,
  size = 8,
): Phaser.GameObjects.Text {
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
  c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);

  if (opts.disabled) {
    box.setFillStyle(PALETTE.slate);
    box.setStrokeStyle(1, PALETTE.steel);
    lbl.setColor(css(PALETTE.ash));
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
  scene.cameras.main.fadeOut(FADE_MS, 0, 0, 0);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(key, data);
  });
}

export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(FADE_MS, 0, 0, 0);
}
