/**
 * ---- A PHONE HELD SIDEWAYS.
 *
 * The picture fills the whole screen (the scaler stretches it edge to edge:
 * see pixelScaler), and the first tap with the phone sideways asks the
 * browser for the whole screen, so the address bar and the status bar give
 * their height back to the game.  Turned upright again it hands the screen
 * back.  (A browser that cannot -- Safari on an iPhone -- simply carries on
 * as it is.)
 *
 * Touch devices only; desktop is untouched.
 */

import type Phaser from 'phaser';
import { isTouch } from '../core/device';

const landscape = (): boolean => window.innerWidth > window.innerHeight;

function wantFullscreen(): void {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  if (!landscape() || document.fullscreenElement || doc.webkitFullscreenElement) return;
  try {
    if (el.requestFullscreen) {
      void el.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
    } else el.webkitRequestFullscreen?.();
  } catch {
    // not allowed here: play on as it is
  }
}

function leaveFullscreenUpright(): void {
  if (!landscape() && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
}

export function attachLandscapeFill(_game: Phaser.Game): void {
  if (!isTouch()) return;
  // The browser only grants full screen from a tap, so ask on the taps.
  window.addEventListener('pointerup', wantFullscreen, { passive: true });
  window.addEventListener('touchend', wantFullscreen, { passive: true });
  window.addEventListener('resize', leaveFullscreenUpright);
}
