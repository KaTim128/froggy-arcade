/**
 * The concierge behind the hotel desk: navy blazer, white shirt, a gold name
 * badge, brown hair neatly cut -- built on the drifter's rig (art/staffLooks
 * `CLERK_LOOK`, painted by art/player `paintFigure`), like everyone else.
 */

import { FIGURE_H, paintFigure } from '../art/player';
import { CLERK_LOOK } from '../art/staffLooks';

export type ClerkPose = 'idle' | 'talk';

export interface ClerkDrawOpts {
  x: number;
  y: number;
  /** Height in logical pixels, sole of shoe to top of head (rounded to whole pixels a cell). */
  height: number;
  pose?: ClerkPose;
  /** 0..1, a slow breath. */
  breath?: number;
  /** 0..1, how lit the lobby is. */
  alpha?: number;
}

export function drawClerk(ctx: CanvasRenderingContext2D, o: ClerkDrawOpts): void {
  paintFigure(ctx, CLERK_LOOK, o.x, o.y, {
    scale: Math.max(1, Math.round(o.height / FIGURE_H)),
    talk: o.pose === 'talk',
    breath: o.breath,
    alpha: o.alpha,
  });
}
