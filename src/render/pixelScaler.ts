/**
 * Integer letterbox scaler.  PRD SM-3 / AR-1 / QFD A4.
 *
 * 320x180 logical buffer, scaled by an INTEGER factor only, centred, with the
 * page's black background acting as the letterbox bars.  Never stretch, never
 * fractional — fractional scaling is what makes pixel art look like mud.
 *
 * ON A PHONE THE INTEGER RULE IS THE WRONG RULE, and it is the one place it is
 * broken on purpose.  A portrait screen is around 390 CSS pixels across, so
 * the largest integer that fits a 320-wide buffer is ONE: the game would play
 * at postage-stamp size with two thirds of the glass unused.  Touch devices
 * therefore get a continuous fit of the space actually left over after the
 * on-screen controls have taken theirs, and `image-rendering: pixelated` keeps
 * the blocks square.  At the two-and-three-times device pixel ratios phones
 * ship with, the unevenness a fractional factor introduces lands inside a
 * single physical pixel and cannot be seen.  Desktop is untouched.
 */

import Phaser from 'phaser';
import { froggyLayer } from './froggyLayer';
import { isTouch } from '../core/device';
import { touchControls } from '../ui/touchControls';

export const GAME_W = 320;
export const GAME_H = 180;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

export function computeZoom(viewW: number, viewH: number): number {
  const raw = Math.min(viewW / GAME_W, viewH / GAME_H);
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(raw)));
}

/** A hand's breadth of black over the picture, so it is not against the notch. */
export const TOUCH_TOP_PAD = 12;

/**
 * The touch fit: fill what is left, to two decimal places so the canvas is not
 * re-sized on every pixel of a scroll bounce.  Never smaller than 1, because
 * below that the pixel font stops being readable at all.
 */
export function computeTouchZoom(viewW: number, viewH: number, reserve: number): number {
  const usable = Math.max(120, viewH - reserve - (reserve > 0 ? TOUCH_TOP_PAD : 0));
  const raw = Math.min(viewW / GAME_W, usable / GAME_H);
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(raw * 100) / 100));
}

let attached: Phaser.Game | null = null;

export function attachScaler(game: Phaser.Game): void {
  attached = game;
  const root = document.getElementById('game-root');
  const apply = () => {
    if (!attached) return;
    const touch = isTouch();
    // The least the controls will accept comes first, because it is what the
    // picture has to fit above.
    const reserve = touch ? touchControls.reserveHeight() : 0;
    // In portrait the controls own a band along the bottom and the picture is
    // centred in everything above it, so a thumb is never over the game and
    // the two halves of the screen are each centred in their own space.
    if (root) {
      root.style.paddingBottom = reserve > 0 ? `${reserve}px` : '';
      root.style.paddingTop = reserve > 0 ? `${TOUCH_TOP_PAD}px` : '';
    }

    const zoom = touch
      ? computeTouchZoom(window.innerWidth, window.innerHeight, reserve)
      : computeZoom(window.innerWidth, window.innerHeight);
    if (attached.scale.zoom !== zoom) attached.scale.setZoom(zoom);
    attached.scale.refresh();
    // PRD SM-4: the overlay tracks the scaled canvas exactly, but renders at
    // full device resolution so Froggy stays smooth at every zoom level.
    froggyLayer.syncTo(attached.canvas, zoom);
    // Whatever the picture did not use is the controls': they grow into it,
    // and the look pad is re-hung over the canvas where it now sits.
    if (touch) {
      touchControls.setBand(reserve);
      touchControls.relayout();
    }
  };

  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => window.setTimeout(apply, 120));
  // Some browsers settle layout a frame late.
  window.setTimeout(apply, 50);
  window.setTimeout(apply, 250);
}

export function currentZoom(): number {
  return attached?.scale.zoom ?? 1;
}
