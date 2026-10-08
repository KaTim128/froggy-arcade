/**
 * PAUSE.  One key, one gear, everywhere you actually play.
 *
 * Esc on a keyboard and the gear in the corner of a phone both come here, and
 * nowhere else: there is one listener for the whole building, so no room can
 * forget to have one and no two can both answer the same press.  It freezes
 * whatever scene is on top and puts the settings panel over it in its PAUSE
 * form -- controls, volumes, RESUME and LEAVE.
 *
 * FREEZING IS THE WHOLE SCENE, NOT A FLAG.  Phaser's own pause stops the
 * scene's update, its clock, its tweens and its input; the 3D stage, which
 * runs on its own animation frame, is frozen and hidden alongside it; and
 * Froggy's overlay canvas, which sits above everything, is hidden so nothing
 * he is doing is painted over the menu.  RESUME puts all of it back exactly as
 * it was, which is why it is safe in the dark rooms and the hide-and-seek
 * rounds: nothing about their lighting or their clocks is touched, only held.
 *
 * WHAT IT WILL NOT PAUSE.  The title screen and the cards that already use Esc
 * for something (skipping the intro, closing a shop) keep it, and so does any
 * modal already open over a room -- Esc closes that first, as it always has.
 * Nor will it freeze a scene halfway through a fade: a scene paused mid-fade
 * would come back to a camera that never finishes going black.
 */

import Phaser from 'phaser';
import { froggyLayer } from '../render/froggyLayer';
import { ThreeStage } from '../render/threeStage';
import { touchControls } from '../ui/touchControls';
import { store } from './state';
import { isLookScene, mouseLookOn, requestMouseLook } from './look';
import { applyDisplay } from './graphics';

/** Scenes where Esc is not a pause: nothing is being played. */
const NEVER = new Set(['Boot', 'StartScreen', 'ProfileModal', 'IntroCutscene', 'TheEnd', 'EndCard', 'DeathScreen']);

/** Panels that close themselves on Esc; while one is up, Esc is theirs. */
const OWN_ESC = new Set(['SettingsModal', 'ChangeMachine', 'PrizeCounter', 'PrizeExchange', 'ProfileModal']);

/**
 * A scene can take Esc for itself first -- the arcade shell uses this to
 * cancel its quit confirmation -- by answering true.
 */
export interface EscapeAware {
  handleEscape?(): boolean;
}

let game: Phaser.Game | null = null;
let frozen: string | null = null;
/** Which scene holds the mouse lock, if any. */
let lockOwner: string | null = null;

export function installPause(g: Phaser.Game): void {
  if (game) return;
  game = g;
  // the player's brightness on every canvas from the first frame
  applyDisplay();
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.repeat) return;
    togglePause();
  });
  // A browser that had the mouse locked to a 3D room spends the Esc press on
  // letting it go and never delivers the key, so losing the lock mid-play IS
  // the Esc press.
  // Only for the scene that took the lock, and only while it is still the
  // one on top: a room that lets go of the mouse as it shuts down must not
  // pause whatever comes after it.
  // THE CURSOR IS THE PLAYER'S.  Only mouse-look mode (Settings > General)
  // may hide it; anything else that locks the mouse is handed straight back.
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) {
      if (!mouseLookOn() || frozen) {
        document.exitPointerLock?.();
        return;
      }
      lockOwner = topScene()?.scene.key ?? null;
      return;
    }
    const owner = lockOwner;
    lockOwner = null;
    if (!frozen && owner && topScene()?.scene.key === owner) openPause();
  });
  if (import.meta.env?.DEV) {
    (window as unknown as Record<string, unknown>).__pause = {
      open: () => openPause(),
      resume: () => resumePause(),
      paused: () => frozen,
    };
  }
}

/** Is the game frozen under the pause menu right now? */
export function isPaused(): boolean {
  return frozen !== null;
}

/** The scene that was frozen, for the panel to describe. */
export function pausedScene(): Phaser.Scene | null {
  return frozen && game ? game.scene.getScene(frozen) : null;
}

export function togglePause(): void {
  if (!game) return;
  if (frozen) {
    const menu = game.scene.getScene('SettingsModal') as unknown as EscapeAware | null;
    if (game.scene.isActive('SettingsModal') && menu?.handleEscape?.()) return;
    resumePause();
    return;
  }
  const top = topScene();
  if (!top) return;
  if ((top as unknown as EscapeAware).handleEscape?.()) return;
  openPause();
}

/** The topmost running scene, which is the one the player is looking at. */
function topScene(): Phaser.Scene | null {
  if (!game) return null;
  const running = game.scene.getScenes(true);
  return running.length ? running[running.length - 1] : null;
}

export function openPause(): void {
  if (!game || frozen) return;
  const top = topScene();
  if (!top) return;
  const key = top.scene.key;
  if (NEVER.has(key) || OWN_ESC.has(key)) return;
  if (game.scene.getScenes(true).some((s) => OWN_ESC.has(s.scene.key))) return;
  if (top.sys.isTransitioning()) return;
  const cam = top.cameras?.main;
  if (cam && (cam.fadeEffect.isRunning || cam.flashEffect.isRunning)) return;

  frozen = key;
  touchControls.releaseAll();
  top.scene.pause();
  ThreeStage.current?.setPaused(true);
  froggyLayer.setVisible(false);
  if (document.pointerLockElement) document.exitPointerLock?.();
  game.scene.run('SettingsModal', { from: key, pause: true });
}

export function resumePause(): void {
  if (!game || !frozen) return;
  const key = frozen;
  frozen = null;
  store.flush();
  if (game.scene.isActive('SettingsModal') || game.scene.isPaused('SettingsModal')) game.scene.stop('SettingsModal');
  const scene = game.scene.getScene(key);
  // Whatever was held when the menu opened was let go on the menu.
  scene?.input?.keyboard?.resetKeys();
  froggyLayer.setVisible(true);
  ThreeStage.current?.setPaused(false);
  if (scene && game.scene.isPaused(key)) scene.scene.resume();
  // back into a mouse-look room: the mouse is taken again (RESUME, or Esc, is
  // the click a browser needs to allow it)
  if (isLookScene(key)) requestMouseLook(game.canvas);
}

/**
 * LEAVE: back to the title screen, from anywhere.
 *
 * Everything running is stopped -- which is what disposes a 3D stage, since
 * each 3D scene tears its stage down on shutdown -- and the title screen is
 * started fresh.  The run itself is saved as it stands, and START on the title
 * screen picks it up from the last place it can be picked up from.
 */
export function leaveToMenu(): void {
  jumpToScene('StartScreen');
}

/**
 * Everything stopped, as for the title screen, and then `key` started with
 * `data` instead.  The admin run's test buttons use it to drop straight into
 * a point of the story (see SettingsModal).
 */
export function jumpToScene(key: string, data?: object): void {
  if (!game) return;
  frozen = null;
  store.flush();
  touchControls.releaseAll();
  ThreeStage.current?.setPaused(false);
  froggyLayer.clear();
  froggyLayer.setVisible(true);
  froggyLayer.setDim(1);
  if (document.pointerLockElement) document.exitPointerLock?.();
  for (const s of [...game.scene.getScenes(false)]) {
    const k = s.scene.key;
    if (k === key) continue;
    if (game.scene.isActive(k) || game.scene.isPaused(k) || game.scene.isSleeping(k)) game.scene.stop(k);
  }
  // and once more as the new scene comes up: the rooms being stopped can
  // still repaint the overlay on their way out, after the clear above
  game.scene.getScene(key)?.events.once('create', () => froggyLayer.clear());
  game.scene.start(key, data);
}
