/**
 * ---- A PHONE HELD SIDEWAYS.
 *
 * The picture fills the screen's height at its own shape, with an ambient
 * glow in the bands either side (see pixelScaler), and the first tap with the phone sideways asks the
 * browser for the whole screen, so the address bar and the status bar give
 * their height back to the game.  Turned upright again it hands the screen
 * back.
 *
 * AN IPHONE CANNOT BE ASKED.  Safari on an iPhone has no full-screen call for
 * a page at all, so the game is a web app as well (index.html, the manifest):
 * added to the home screen it opens with no bars, either way up.  The first
 * time an iPhone in Safari is turned sideways, a line says how (log #56, #62).
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

/** Already running as the home-screen app, with no browser round it. */
function standalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: fullscreen)').matches || window.matchMedia?.('(display-mode: standalone)').matches;
}

/** A page here can never ask for the whole screen: an iPhone (or an iPad in a phone's clothes). */
function cannotAsk(): boolean {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  return !el.requestFullscreen && !el.webkitRequestFullscreen;
}

const HINT_SEEN = 'froggy.fullscreenHint';

/** Once: how to get the whole screen on a phone that will not hand it over. */
function hintHomeScreen(): void {
  if (!landscape() || standalone() || !cannotAsk()) return;
  try {
    if (sessionStorage.getItem(HINT_SEEN)) return;
    sessionStorage.setItem(HINT_SEEN, '1');
  } catch {
    // (no storage: it may show again next time, which is fine)
  }
  const el = document.createElement('div');
  el.id = 'fullscreen-hint';
  el.textContent = 'FOR FULL SCREEN: SHARE, THEN ADD TO HOME SCREEN';
  Object.assign(el.style, {
    position: 'fixed',
    left: '50%',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
    transform: 'translateX(-50%)',
    zIndex: '60',
    padding: '6px 12px',
    background: 'rgba(8, 10, 14, 0.88)',
    border: '1px solid #46c4bd',
    color: '#f4ecd8',
    font: '12px/1.2 ui-monospace, "Courier New", monospace',
    letterSpacing: '1px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    transition: 'opacity 0.6s',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  window.setTimeout(() => (el.style.opacity = '0'), 6000);
  window.setTimeout(() => el.remove(), 6800);
}

export function attachLandscapeFill(_game: Phaser.Game): void {
  if (!isTouch()) return;
  window.addEventListener('resize', hintHomeScreen);
  window.setTimeout(hintHomeScreen, 1500);
  // The browser only grants full screen from a tap, so ask on the taps.
  window.addEventListener('pointerup', wantFullscreen, { passive: true });
  window.addEventListener('touchend', wantFullscreen, { passive: true });
  window.addEventListener('resize', leaveFullscreenUpright);
}
