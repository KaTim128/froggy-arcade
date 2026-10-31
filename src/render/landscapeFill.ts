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
 * NEVER UPRIGHT.  The game is played sideways only.  The first tap asks for
 * the whole screen whichever way up the phone is, and locks it sideways
 * (Android: the picture turns by itself).  Where the screen cannot be locked
 * -- an iPhone in Safari, or before that first tap -- holding the phone
 * upright covers the game with a TURN YOUR PHONE card and pauses it until it
 * is turned.  (`?portrait=1` lets the harness lay out the upright build.)
 *
 * Touch devices only; desktop is untouched.
 */

import type Phaser from 'phaser';
import { isTouch } from '../core/device';

const landscape = (): boolean => window.innerWidth > window.innerHeight;

const allowUpright = (): boolean => new URLSearchParams(window.location.search).get('portrait') === '1';

/** Turn the screen sideways and keep it there, where the browser allows it. */
function lockSideways(): void {
  const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  try {
    void o?.lock?.('landscape')?.catch(() => undefined);
  } catch {
    // (no lock here: the TURN YOUR PHONE card does the job instead)
  }
}

function wantFullscreen(): void {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  if (document.fullscreenElement || doc.webkitFullscreenElement) {
    lockSideways();
    return;
  }
  if (landscape() && allowUpright()) return;
  try {
    if (el.requestFullscreen) {
      // (an orientation lock is only granted once the page has the whole screen)
      void el
        .requestFullscreen({ navigationUI: 'hide' })
        .then(lockSideways)
        .catch(() => undefined);
    } else el.webkitRequestFullscreen?.();
  } catch {
    // not allowed here: play on as it is
  }
}

// ---- the card over an upright phone

let card: HTMLDivElement | null = null;
let pausedByCard = false;

function makeCard(): HTMLDivElement {
  const el = document.createElement('div');
  el.id = 'rotate-card';
  el.innerHTML =
    '<svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#3fe39b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="animation:froggy-turn 2.4s ease-in-out infinite">' +
    '<rect x="7" y="3" width="10" height="18" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>' +
    '<div style="margin-top:22px;font-size:16px;letter-spacing:2px;color:#f4ecd8">TURN YOUR PHONE SIDEWAYS</div>' +
    '<div style="margin-top:10px;font-size:11px;letter-spacing:1px;color:#7a8b9c">FROGGY ARCADE IS PLAYED IN LANDSCAPE</div>' +
    '<div class="tap" style="margin-top:26px;padding:10px 18px;border:1px solid #3fe39b;color:#3fe39b;font-size:12px;letter-spacing:2px">TAP TO TURN IT FOR ME</div>';
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '1000',
    display: 'none',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000',
    font: '12px/1.3 ui-monospace, "Courier New", monospace',
    textAlign: 'center',
    touchAction: 'none',
  } as Partial<CSSStyleDeclaration>);
  const style = document.createElement('style');
  style.textContent = '@keyframes froggy-turn{0%,25%{transform:rotate(0)}55%,85%{transform:rotate(-90deg)}100%{transform:rotate(0)}}';
  document.head.appendChild(style);
  // (a tap on the card is the gesture the browser wants before it will turn the screen)
  el.addEventListener('pointerup', (e) => {
    e.stopPropagation();
    wantFullscreen();
  });
  el.addEventListener('touchend', (e) => e.stopPropagation(), { passive: true });
  // (where nothing can turn it -- an iPhone -- there is no button to offer)
  const el2 = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (!el2.requestFullscreen) (el.querySelector('.tap') as HTMLElement).style.display = 'none';
  document.body.appendChild(el);
  return el;
}

function updateCard(game: Phaser.Game): void {
  const upright = !landscape() && !allowUpright();
  if (upright && !card) card = makeCard();
  if (card) card.style.display = upright ? 'flex' : 'none';
  if (upright && !pausedByCard && !game.isPaused) {
    pausedByCard = true;
    game.pause();
  } else if (!upright && pausedByCard) {
    pausedByCard = false;
    game.resume();
  }
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

export function attachLandscapeFill(game: Phaser.Game): void {
  if (!isTouch()) return;
  const check = (): void => updateCard(game);
  window.addEventListener('resize', check);
  window.addEventListener('orientationchange', () => window.setTimeout(check, 250));
  check();
  window.addEventListener('resize', hintHomeScreen);
  window.setTimeout(hintHomeScreen, 1500);
  // The browser only grants full screen from a tap, so ask on the taps.
  window.addEventListener('pointerup', wantFullscreen, { passive: true });
  window.addEventListener('touchend', wantFullscreen, { passive: true });
}
