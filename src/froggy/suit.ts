/**
 * The dealer, after the night: a man in a black suit dealing where Froggy
 * dealt -- white shirt, a red square in the breast pocket, black hair slicked
 * flat.  Built on the drifter's rig (art/staffLooks `DEALER_LOOK`, painted by
 * art/player `paintFigure`), like everyone else in the game.
 */

import { FIGURE_H, paintFigure } from '../art/player';
import { DEALER_LOOK } from '../art/staffLooks';

export type SuitPose = 'idle' | 'talk';

export interface SuitDrawOpts {
  x: number;
  y: number;
  /** Height in logical pixels, sole of shoe to top of head (rounded to whole pixels a cell). */
  height: number;
  pose?: SuitPose;
  /** 0..1, his breath: he breathes and that is all. */
  bounce?: number;
  /** What `y` means: the ground line, or the point between the eyes. */
  anchor?: 'feet' | 'face';
  alpha?: number;
  /** (kept for callers: the rig carries its own shading) */
  light?: false | { warm?: number; shade?: number };
}

export function drawSuitedMan(ctx: CanvasRenderingContext2D, o: SuitDrawOpts): void {
  const k = Math.max(1, Math.round(o.height / FIGURE_H));
  // the eyes are on the rig's fifth row
  const feet = o.anchor === 'face' ? o.y + (FIGURE_H - 4.5) * k : o.y;
  paintFigure(ctx, DEALER_LOOK, o.x, feet, { scale: k, talk: o.pose === 'talk', breath: o.bounce, alpha: o.alpha });
}
