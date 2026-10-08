/**
 * LOOKING ROUND, in the 3D rooms.
 *
 * Two ways, chosen in Settings > General:
 *
 *   CURSOR MODE (the default).  The cursor stays on screen.  Hold the left
 *   button and drag to turn; let go and the mouse is a mouse again.
 *
 *   MOUSE-LOOK MODE (desktop).  Click into the room and the cursor is hidden
 *   and held in the middle; the head follows the mouse with no button down.
 *   Esc lets it go and opens the menu; RESUME takes it back.
 *
 * The rate is the player's: MOUSE SENSITIVITY for a mouse, CAMERA
 * SENSITIVITY for a thumb on the look pad.  100% is as each room was tuned.
 */

import Phaser from 'phaser';
import { store } from './state';
import { isTouch } from './device';
import { isPaused } from './pause';

export function lookScale(): number {
  const s = store.get().settings;
  return (isTouch() ? s.camSens ?? 100 : s.lookSens ?? 100) / 100;
}

/** Mouse-look mode is on, and this is a device with a mouse. */
export function mouseLookOn(): boolean {
  return !isTouch() && store.get().settings.mouseLook === true;
}

/** Scenes that look by mouse: the only ones a resume should re-lock. */
const lookers = new Set<string>();
export function isLookScene(key: string): boolean {
  return lookers.has(key);
}

/** Hide the cursor and hold the mouse, if mouse-look is on.  Needs a click. */
export function requestMouseLook(canvas: HTMLCanvasElement): void {
  if (!mouseLookOn() || document.pointerLockElement) return;
  try {
    const p = canvas.requestPointerLock?.() as unknown;
    if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => undefined);
  } catch {
    // (a browser that refuses -- no gesture, or an iframe -- leaves cursor mode)
  }
}

/**
 * A locked mouse's movement for this event, with the browsers' occasional
 * wild jump (a whole screen's width in one event, on a tab switch or a
 * stutter) clipped off, so the view never snaps.
 */
export function lockedDelta(e: MouseEvent): { dx: number; dy: number } {
  const clip = (v: number) => Math.max(-120, Math.min(120, v || 0));
  return { dx: clip(e.movementX), dy: clip(e.movementY) };
}

/**
 * Make `scene` a mouse-look room: a click on it takes the mouse when the
 * mode is on (never while a menu is up), and it is let go when the scene ends.
 */
export function attachMouseLook(scene: Phaser.Scene): void {
  const key = scene.scene.key;
  lookers.add(key);
  const canvas = scene.game.canvas;
  const onClick = (): void => {
    if (isPaused() || scene.game.scene.isActive('SettingsModal')) return;
    requestMouseLook(canvas);
  };
  // the 3D canvas sits over the Phaser one, so listen at the window
  window.addEventListener('click', onClick);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    window.removeEventListener('click', onClick);
    if (document.pointerLockElement) document.exitPointerLock?.();
  });
}
