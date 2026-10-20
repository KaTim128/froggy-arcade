/**
 * THE SHOPS' FITTINGS.
 *
 * The things more than one shop on the high street has on its walls, drawn
 * one way: an ink line round the outside, walnut lit on the left and top and
 * shaded on the right and foot, and brass where brass would be.  The
 * fitting-room booth at Threads set the look; the mirrors, sign plates and
 * benches here follow it so no shop has a fitting that looks borrowed from a
 * different game.
 */

import Phaser from 'phaser';

export const INK = 0x14100c;
export const WALNUT = { base: 0x4a3326, lit: 0x6a4a34, shade: 0x32221a };
export const BRASS = { base: 0xd8a838, lit: 0xf0d070, shade: 0x8a6418 };

const mix = (a: number, b: number, k: number): number => {
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.ValueToColor(a),
    Phaser.Display.Color.ValueToColor(b),
    100,
    Math.round(k * 100),
  );
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
};

/** A walnut box: ink outline, the lit top and left edge, the shaded right and foot. */
export function paintWalnut(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(INK, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(WALNUT.base, 1).fillRect(x, y, w, h);
  g.fillStyle(WALNUT.lit, 1).fillRect(x, y, 1, h).fillRect(x, y, w, 1);
  g.fillStyle(WALNUT.shade, 1).fillRect(x + w - 1, y, 1, h).fillRect(x, y + h - 1, w, 1);
}

/** Two-pixel brass studs in a box's four corners. */
export function paintStuds(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  for (const [cx, cy] of [[x, y], [x + w - 2, y], [x, y + h - 2], [x + w - 2, y + h - 2]]) {
    g.fillStyle(BRASS.base, 1).fillRect(cx, cy, 2, 2);
    g.fillStyle(BRASS.lit, 1).fillRect(cx, cy, 1, 1);
  }
}

export interface MirrorOpts {
  /** The glass at its top and at its foot: the shop's own wall colour, reflected. */
  glassTop?: number;
  glassFoot?: number;
  /** The room behind you in it: the line of the wall's panelling and the floor. */
  wallLine?: number;
  floor?: number;
}

/**
 * A wall mirror, `w` by `h` from its top-left corner: a walnut frame with
 * brass at the corners, and glass that fades from pale at the top to the
 * shop's own colour at the foot, the room behind you in it, and two streaks
 * of shine across it.
 */
export function paintMirror(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, o: MirrorOpts = {}): void {
  const top = o.glassTop ?? 0xe4eef2;
  const foot = o.glassFoot ?? 0xc8d8e0;
  g.fillStyle(0x000000, 0.12).fillRect(x + 2, y + 2, w, h);
  paintWalnut(g, x, y, w, h);
  const gx = x + 3;
  const gy = y + 3;
  const gw = w - 6;
  const gh = h - 6;
  g.fillStyle(INK, 1).fillRect(gx - 1, gy - 1, gw + 2, gh + 2);
  for (let k = 0; k < gh; k++) g.fillStyle(mix(top, foot, k / gh), 1).fillRect(gx, gy + k, gw, 1);
  if (o.wallLine !== undefined) g.fillStyle(o.wallLine, 0.6).fillRect(gx, gy + gh - 9, gw, 1);
  if (o.floor !== undefined) g.fillStyle(o.floor, 0.5).fillRect(gx, gy + gh - 4, gw, 4);
  for (let k = 0; k < 9; k++) g.fillStyle(0xffffff, 0.55).fillRect(gx + 3 + Math.floor(k / 3), gy + 3 + k, 1, 1);
  for (let k = 0; k < 6; k++) g.fillStyle(0xffffff, 0.35).fillRect(gx + 7 + Math.floor(k / 3), gy + 4 + k, 1, 1);
  paintStuds(g, x, y, w, h);
}

/**
 * A sign plate, centred on `cx`: brass rim with a lit top and a shaded foot,
 * a coloured face inside it, and a shadow under it.  The words go on top of
 * it in the game's own letters; `chains` hangs it from the wall on two.
 */
export function paintPlate(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  y: number,
  w: number,
  h: number,
  face: number,
  faceLit: number,
  chains = false,
): void {
  const x = Math.round(cx - w / 2);
  if (chains) g.fillStyle(BRASS.base, 1).fillRect(x + 8, y - 4, 1, 4).fillRect(x + w - 9, y - 4, 1, 4);
  g.fillStyle(0x000000, 0.18).fillRect(x + 1, y + h + 1, w, 1);
  g.fillStyle(INK, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(BRASS.base, 1).fillRect(x, y, w, h);
  g.fillStyle(BRASS.lit, 1).fillRect(x, y, w, 1);
  g.fillStyle(BRASS.shade, 1).fillRect(x, y + h - 1, w, 1);
  g.fillStyle(face, 1).fillRect(x + 2, y + 2, w - 4, h - 4);
  g.fillStyle(faceLit, 1).fillRect(x + 2, y + 2, w - 4, 1);
}
