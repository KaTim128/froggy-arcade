/**
 * Integer letterbox scaler.  PRD SM-3 / AR-1 / QFD A4.
 *
 * 320x180 logical buffer, scaled by an INTEGER factor only, centred, with the
 * page's black background acting as the letterbox bars.  Never stretch, never
 * fractional — fractional scaling is what makes pixel art look like mud.
 */

import Phaser from 'phaser';
import { froggyLayer } from './froggyLayer';

export const GAME_W = 320;
export const GAME_H = 180;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

export function computeZoom(viewW: number, viewH: number): number {
  const raw = Math.min(viewW / GAME_W, viewH / GAME_H);
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(raw)));
}

let attached: Phaser.Game | null = null;

export function attachScaler(game: Phaser.Game): void {
  attached = game;
  const apply = () => {
    if (!attached) return;
    const zoom = computeZoom(window.innerWidth, window.innerHeight);
    if (attached.scale.zoom !== zoom) attached.scale.setZoom(zoom);
    attached.scale.refresh();
    // PRD SM-4: the overlay tracks the scaled canvas exactly, but renders at
    // full device resolution so Froggy stays smooth at every zoom level.
    froggyLayer.syncTo(attached.canvas, zoom);
  };

  apply();
  window.addEventListener('resize', apply);
  // Some browsers settle layout a frame late.
  window.setTimeout(apply, 50);
  window.setTimeout(apply, 250);
}

export function currentZoom(): number {
  return attached?.scale.zoom ?? 1;
}
