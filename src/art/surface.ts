/**
 * Surface finish for the 2D world: the small set of moves that make a flat
 * rectangle read as a THING with a material, at the same pixel scale and the
 * same level of detail as the player himself (art/player.ts).
 *
 *   - `tone`      lighten or darken a colour, for lit edges and shade sides
 *   - `grain`     deterministic speckle: fabric, carpet, concrete, worn paint
 *   - `bevel`     a lit top/left edge and a shaded bottom/right edge
 *   - `finishFigure` an outline and simple light/shade on a figure built out
 *                 of Rectangles, so NPCs drawn the old flat way sit beside the
 *                 outlined player without looking like cardboard
 *
 * Everything is plain Phaser Graphics/Rectangles in the existing pipeline: no
 * textures to load, no shaders, nothing that costs a mobile GPU more than the
 * rectangles it already draws.  Every random number is seeded, so a surface
 * looks the same every time it is painted, in every mood.
 */

import Phaser from 'phaser';

/** Multiplies a colour's channels by `f` (>1 lightens, <1 darkens), clamped. */
export function tone(col: number, f: number): number {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f)));
  return (ch((col >> 16) & 255) << 16) | (ch((col >> 8) & 255) << 8) | ch(col & 255);
}

/** Scales a colour's channels by `f` straight: gentle on darks, unlike `tone`. */
export function scale(col: number, f: number): number {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (ch((col >> 16) & 255) << 16) | (ch((col >> 8) & 255) << 8) | ch(col & 255);
}

/** A small seeded generator, so every surface is the same on every visit. */
export function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Speckle over a box: single pixels a shade lighter and a shade darker than
 * `base`.  `density` is the share of the box's pixels that get one.  Kept low
 * (0.04 to 0.12) it reads as weave or grit; higher reads as noise.
 */
export function grain(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  base: number,
  seed: number,
  density = 0.08,
  strength = 0.18,
): void {
  const rnd = seeded(seed);
  const n = Math.round(w * h * density);
  const lite = scale(base, 1 + strength);
  const dark = scale(base, 1 - strength);
  for (let i = 0; i < n; i++) {
    g.fillStyle(rnd() < 0.5 ? lite : dark, 1).fillRect(Math.floor(x + rnd() * w), Math.floor(y + rnd() * h), 1, 1);
  }
}

/** A lit edge along the top and left, a shaded one along the bottom and right. */
export function bevel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  base: number,
  lit = 1.25,
  shade = 0.7,
): void {
  g.fillStyle(tone(base, lit), 1).fillRect(x, y, w, 1).fillRect(x, y, 1, h);
  g.fillStyle(tone(base, shade), 1).fillRect(x, y + h - 1, w, 1).fillRect(x + w - 1, y, 1, h);
}

/**
 * Gives a figure made of axis-aligned Rectangles the player's finish: a dark
 * one-pixel outline round the whole silhouette, a lit top edge and a shaded
 * lower edge on each part, and a pixel of weave on the bigger cloth panels.
 *
 * The outline is a dark copy of every rectangle, one pixel bigger all round,
 * put at the back of the container: where parts overlap, the parts cover it,
 * so only the outside edge of the silhouette shows.  Circles, ellipses and
 * anything rotated are left alone (they are shadows, buttons and badges).
 */
export function finishFigure(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  opts: { outline?: number; seed?: number; skip?: Phaser.GameObjects.GameObject[] } = {},
): void {
  const ink = opts.outline ?? 0x14100e;
  const rnd = seeded(opts.seed ?? 7);
  const parts = root.list.filter(
    (o): o is Phaser.GameObjects.Rectangle =>
      o instanceof Phaser.GameObjects.Rectangle && o.angle === 0 && o.alpha > 0.5 && !(opts.skip ?? []).includes(o),
  );
  const behind: Phaser.GameObjects.Rectangle[] = [];
  for (const r of parts) {
    const left = r.x - r.width * r.originX;
    const top = r.y - r.height * r.originY;
    behind.push(scene.add.rectangle(left - 1, top - 1, r.width + 2, r.height + 2, ink).setOrigin(0, 0));
    if (r.width < 3 || r.height < 3) continue;
    const col = r.fillColor;
    const over: Phaser.GameObjects.Rectangle[] = [
      scene.add.rectangle(left, top, r.width, 1, tone(col, 1.28)).setOrigin(0, 0),
      scene.add.rectangle(left, top + r.height - 1, r.width, 1, tone(col, 0.68)).setOrigin(0, 0),
      scene.add.rectangle(left + r.width - 1, top + 1, 1, r.height - 2, tone(col, 0.8)).setOrigin(0, 0),
    ];
    if (r.width * r.height >= 40) {
      const n = Math.round((r.width * r.height) / 14);
      for (let i = 0; i < n; i++) {
        const px = left + 1 + Math.floor(rnd() * (r.width - 2));
        const py = top + 1 + Math.floor(rnd() * (r.height - 2));
        over.push(scene.add.rectangle(px, py, 1, 1, scale(col, rnd() < 0.5 ? 1.18 : 0.82)).setOrigin(0, 0));
      }
    }
    // straight after its own part, so a part in front still covers it
    root.addAt(over, root.getIndex(r) + 1);
  }
  // the outline under everything: where parts overlap they cover it, so only
  // the outside edge of the silhouette shows
  root.addAt(behind, 0);
}
