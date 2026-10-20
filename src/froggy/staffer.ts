/**
 * The kid on the prize counter, after the night: somebody else stands where
 * Froggy leaned.  A young man in the arcade's own uniform -- the wine polo
 * with its cream collar and the frog on the pocket, a cap on backwards,
 * ginger hair and freckles.
 *
 * He is built on the drifter's rig (art/staffLooks `STAFFER_LOOK`, painted by
 * art/player `paintFigure`): the same grids, outline and shading as every
 * other person in the game, so he belongs to the same world.  Only his top
 * half is ever seen over the counter.
 */

import { FIGURE_H, paintFigure } from '../art/player';
import { STAFFER_LOOK } from '../art/staffLooks';

export type StafferPose = 'idle' | 'talk';

export interface StafferDrawOpts {
  x: number;
  y: number;
  /** Height in logical pixels, sole of shoe to top of head (rounded to whole pixels a cell). */
  height: number;
  pose?: StafferPose;
  /** 0..1, his breath. */
  bounce?: number;
  alpha?: number;
  /** (kept for callers: the rig's arms hang at his sides) */
  restArm?: boolean;
}

export function drawStaffer(ctx: CanvasRenderingContext2D, o: StafferDrawOpts): void {
  paintFigure(ctx, STAFFER_LOOK, o.x, o.y, {
    scale: Math.max(1, Math.round(o.height / FIGURE_H)),
    dir: -1,
    talk: o.pose === 'talk',
    breath: o.bounce,
    alpha: o.alpha,
  });
}
