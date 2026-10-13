/**
 * Eyes for the people, in pixel mode (see `paintPixel` in render/froggyLayer):
 * the drifter's eyes, which are one dark pixel each, and a little bigger only
 * when the figure is drawn big enough for it (the dealer at the table, close
 * up).  Returns false outside pixel mode, so the smooth eye is drawn instead.
 */

import { stamp, worldUnit } from '../render/froggyLayer';

export function humanEye(ctx: CanvasRenderingContext2D, x: number, y: number, ink: string): boolean {
  const u = worldUnit(ctx);
  const w = Math.max(1, Math.round(3.4 * u));
  const h = Math.max(1, Math.round(4.4 * u));
  const rows = Array.from({ length: h }, () => 'k'.repeat(w));
  return stamp(ctx, x, y, rows, { k: ink.length === 7 ? ink : '#1a1410' });
}
