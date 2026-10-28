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

import { isOverlay } from './overlays';
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
const OWN_ESC = new Set(['SettingsModal', 'ChangeMachine', 'PrizeCounter', 'PrizeExchange', 'ProfileModal', 'Shop']);

/**
 * A scene can take Esc for itself first -- the arcade shell uses this to
 * cancel its quit confirmation -- by answering true.
 */
export interface EscapeAware {
  handleEscape?(): boolean;
}

let game: Phaser.Game | null = null;
let frozen: string | null = null;
/**
 * RESUME counts 3, 2, 1 first: the player is coming back to something that
 * was under way -- after a reload (core/session) or back from another tab --
 * and gets a moment to find the keys before it moves (log #87).
 */
let countNext = false;
/** The count is on screen: the scene is still frozen, and Esc waits for it. */
let counting = false;
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
      counting: () => counting,
    };
  }
}

/**
 * A room shutting down lets go of the mouse: that is not an Esc press, so the
 * pause must not open over whatever comes next (the arrest screen, mostly).
 */
export function releaseMouseQuietly(): void {
  lockOwner = null;
  if (document.pointerLockElement) document.exitPointerLock?.();
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
  if (!game || counting) return;
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
  const running = game.scene.getScenes(true).filter((x) => !isOverlay(x.scene.key));
  return running.length ? running[running.length - 1] : null;
}

/** The scenes that are an arcade game being played (log #50: a tab away pauses them). */
const IN_GAME = new Set(['Minigame', 'CraneGame', 'CreatureArena']);

/**
 * BACK FROM ANOTHER TAB, MID-GAME: the pause menu, open over the game where
 * it stood (the loop already slept while the tab was away, so nothing moved).
 * Not outside a game -- a room, a street, a cabinet's card -- and not when
 * the menu is already up.
 */
export function pauseIfInGame(): void {
  if (!game || frozen) return;
  const top = topScene();
  if (!top || !IN_GAME.has(top.scene.key)) return;
  // (at the card a cabinet is not yet being played)
  const started = (top as unknown as { started?: boolean }).started;
  if (top.scene.key === 'Minigame' && !started) return;
  openPause();
  if (frozen) countNext = true;
}

/**
 * ---- BACK AFTER A RELOAD.  `key` is about to start with the run's saved
 * state; once it is up (and has finished fading in) it is paused with the
 * settings open, and RESUME counts it back in.
 */
export function pauseOnArrival(key: string): void {
  if (!game) return;
  const sc = game.scene.getScene(key);
  if (!sc) return;
  sc.events.once('create', () => {
    let tries = 0;
    const tryOpen = (): void => {
      if (!game || frozen) return;
      const top = topScene();
      if (top?.scene.key === key) {
        openPause();
        if (frozen) {
          countNext = true;
          return;
        }
      }
      // (still fading in, or something else came first: try again shortly)
      if (++tries < 60) window.setTimeout(tryOpen, 100);
    };
    window.setTimeout(tryOpen, 250);
  });
}

/** 3, 2, 1 over the frozen picture, then `done`. */
function countIn(done: () => void): void {
  const root = document.getElementById('game-root');
  const canvas = root?.querySelector('canvas');
  const r = canvas?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  const el = document.createElement('div');
  el.id = 'resume-count';
  Object.assign(el.style, {
    position: 'fixed',
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '50',
    pointerEvents: 'none',
    background: 'rgba(0, 0, 0, 0.35)',
    color: '#ffd45e',
    font: `bold ${Math.round(r.height * 0.32)}px ui-monospace, "Courier New", monospace`,
    textShadow: '0 0 12px #000, 4px 4px 0 #000',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  let n = 3;
  const tick = (): void => {
    if (n === 0) {
      el.remove();
      done();
      return;
    }
    el.textContent = String(n);
    n--;
    window.setTimeout(tick, 700);
  };
  tick();
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
  if (!game || !frozen || counting) return;
  if (countNext) {
    // the menu goes, the scene stays frozen while it counts
    countNext = false;
    counting = true;
    if (game.scene.isActive('SettingsModal') || game.scene.isPaused('SettingsModal')) game.scene.stop('SettingsModal');
    countIn(() => {
      counting = false;
      resumePause();
    });
    return;
  }
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
  countNext = false;
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
