/**
 * ---- A PHONE HELD SIDEWAYS.
 *
 * The picture is 16:9 and stays 16:9: the pixel art is not stretched and not
 * cropped.  Two things make it fill the phone instead of floating in black:
 *
 *   FULL SCREEN.  The first tap with the phone sideways asks the browser for
 *   the whole screen, so the address bar and the status bar give their height
 *   back to the game.  Turned upright again it hands the screen back.  (A
 *   browser that cannot -- Safari on an iPhone -- simply carries on as it is.)
 *
 *   THE GLOW.  What is left either side on a phone wider than 16:9 is not
 *   black: behind the picture sits a blurred, darkened copy of it, scaled to
 *   cover the whole screen and refreshed a few times a second, so the bands
 *   carry the colour of whatever room you are in.
 *
 * Touch devices only; desktop is untouched.
 */

import type Phaser from 'phaser';
import { isTouch } from '../core/device';

let glow: HTMLCanvasElement | null = null;
let glowCtx: CanvasRenderingContext2D | null = null;
let frame = 0;

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

export function attachLandscapeFill(game: Phaser.Game): void {
  if (!isTouch()) return;
  // The browser only grants full screen from a tap, so ask on the taps.
  window.addEventListener('pointerup', wantFullscreen, { passive: true });
  window.addEventListener('touchend', wantFullscreen, { passive: true });
  window.addEventListener('resize', leaveFullscreenUpright);

  glow = document.createElement('canvas');
  glow.id = 'landscape-glow';
  glow.width = 64;
  glow.height = 36;
  Object.assign(glow.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '0',
    pointerEvents: 'none',
    filter: 'blur(18px) brightness(0.45) saturate(1.2)',
    transform: 'scale(1.15)',
    display: 'none',
  });
  document.body.prepend(glow);
  glowCtx = glow.getContext('2d');
  const root = document.getElementById('game-root');
  // (#game-root is fixed over the whole screen; it only needs to sit above
  // the glow, and goes see-through where the glow is showing)
  if (root) root.style.zIndex = '1';

  // Copied straight after Phaser draws, while the frame is still in the
  // buffer; every sixth frame is plenty for a blur.
  game.events.on('postrender', () => {
    if (!glow || !glowCtx) return;
    const pic = game.canvas.getBoundingClientRect();
    const bands = window.innerWidth - pic.width > 24 && landscape();
    glow.style.display = bands ? 'block' : 'none';
    if (root) root.style.background = bands ? 'transparent' : '';
    if (!bands || frame++ % 6) return;
    try {
      glowCtx.drawImage(game.canvas, 0, 0, glow.width, glow.height);
      // a 3D room is drawn on its own canvas over Phaser's: take that too
      const three = document.getElementById('three-canvas') as HTMLCanvasElement | null;
      if (three && three.style.visibility !== 'hidden') glowCtx.drawImage(three, 0, 0, glow.width, glow.height);
    } catch {
      // a tainted or lost canvas: leave the last glow up
    }
  });
}
