/**
 * ---- EXIT GAME: closing the whole thing, not going back to a menu.
 *
 * What a page is allowed to do about closing itself depends on where it is
 * running, so this tries every real way out, in order, and stops at the
 * first that works:
 *
 *   1. A NATIVE WRAPPER (Cordova / Capacitor / an Electron or TWA shell that
 *      exposes one): its own exit call closes the app outright.
 *   2. `window.close()`.  Browsers honour it for a window a script opened
 *      and for an installed web app running in its own window (desktop
 *      Chrome / Edge, many Android launchers).  A tab the player opened by
 *      hand is refused -- that is the browser's rule and no page can get
 *      round it.
 *   3. WHERE THE BROWSER SAYS NO, the game shuts itself down instead: the
 *      save is written, the sound is cut, full screen and the orientation
 *      lock are let go, the game engine is stopped and its canvas removed,
 *      and the page says the game is closed and the tab can be shut.  A
 *      PLAY AGAIN button there reloads it.  Nothing keeps running behind it.
 *
 * Either way the progress is saved first.
 */

import { capturePlace } from '../game/place';
import { captureGame } from './session';
import { store } from './state';
import { audio } from './audio';
import { getGame } from './sceneManager';

type NativeExit = {
  navigator?: { app?: { exitApp?: () => void } };
  Capacitor?: { Plugins?: { App?: { exitApp?: () => void } } };
  close?: () => void;
};

function saveEverything(): void {
  try {
    capturePlace();
    captureGame();
    store.flush();
  } catch {
    // (a save that cannot be written now was written by the last flush)
  }
}

function tryNativeExit(): boolean {
  const w = window as unknown as NativeExit & { navigator: NativeExit['navigator'] };
  try {
    const cordova = w.navigator?.app?.exitApp;
    if (cordova) {
      cordova.call(w.navigator!.app);
      return true;
    }
    const cap = w.Capacitor?.Plugins?.App?.exitApp;
    if (cap) {
      cap.call(w.Capacitor!.Plugins!.App);
      return true;
    }
  } catch {
    // fall through to the browser's own close
  }
  return false;
}

/** Let go of everything the game was holding: full screen, the screen lock, the sound, the engine. */
function shutDown(): void {
  try {
    const o = screen.orientation as ScreenOrientation & { unlock?: () => void };
    o?.unlock?.();
  } catch {
    // (nothing was locked)
  }
  try {
    const doc = document as Document & { webkitExitFullscreen?: () => void; webkitFullscreenElement?: Element | null };
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else if (doc.webkitFullscreenElement) doc.webkitExitFullscreen?.();
  } catch {
    // (not in full screen)
  }
  try {
    audio.hold('pagehide');
  } catch {
    // (no sound running)
  }
  try {
    getGame()?.destroy(true);
  } catch {
    // (already stopped)
  }
  for (const id of ['game-root', 'froggy-layer', 'rotate-card', 'fullscreen-hint']) document.getElementById(id)?.remove();
  document.querySelectorAll('canvas').forEach((c) => c.remove());
  // the on-screen controls live outside the game root
  document.querySelectorAll('body > div:not(#game-closed)').forEach((d) => d.remove());
}

/** The page left behind where the browser would not close the tab. */
function closedCard(): void {
  if (document.getElementById('game-closed')) return;
  const el = document.createElement('div');
  el.id = 'game-closed';
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    padding: '24px',
    boxSizing: 'border-box',
    background: '#000',
    color: '#f4ecd8',
    font: '14px/1.4 ui-monospace, "Courier New", monospace',
    letterSpacing: '2px',
    textAlign: 'center',
    touchAction: 'manipulation',
  } as Partial<CSSStyleDeclaration>);
  el.innerHTML =
    '<img src="icon.svg" alt="" width="72" height="72" style="image-rendering:pixelated;opacity:0.9">' +
    '<div style="font-size:18px;color:#f0c040">FROGGY ARCADE HAS CLOSED</div>' +
    '<div style="color:#9aa8b4;font-size:12px;max-width:420px">YOUR PROGRESS IS SAVED. YOU CAN NOW CLOSE THIS TAB OR WINDOW.</div>' +
    '<button type="button" style="margin-top:10px;padding:10px 20px;background:#3d2a5c;color:#f4ecd8;border:2px solid #ff4fa3;font:inherit;font-size:12px;letter-spacing:2px;cursor:pointer">PLAY AGAIN</button>';
  el.querySelector('button')!.addEventListener('click', () => window.location.reload());
  document.body.appendChild(el);
  document.title = 'Froggy Arcade (closed)';
}

let exiting = false;

/** Close the game application.  Saves first; see the notes above for what each platform allows. */
export function exitGame(): void {
  if (exiting) return;
  exiting = true;
  saveEverything();
  if (tryNativeExit()) return;
  try {
    window.close();
  } catch {
    // refused: handled below
  }
  // (a window that closed never runs this; one the browser kept open does)
  window.setTimeout(() => {
    if (window.closed) return;
    shutDown();
    closedCard();
  }, 250);
}
