/**
 * ---- A RELOAD IS NOT A LOSS (log #87).
 *
 * A page refreshed by accident, mid-game or mid-room, comes back where it
 * was: the same cabinet with its stake still on it and nothing charged
 * again, or the room the player was standing in -- paused, with the settings
 * open, and RESUME counting 3, 2, 1 before anything moves (core/pause).
 *
 * Only a RELOAD does this.  The tab remembers (sessionStorage) that a run was
 * being played in it; a fresh visit has no such memory and starts at the
 * title screen as it always has.  What is put back comes from the save:
 * `GameState.game` for a cabinet in play (MinigameScene keeps it), and
 * core/resume's checkpoints and last place for everything else.
 */

import { store } from './state';
import { resumePoint, type ResumePoint } from './resume';

const LIVE = 'froggy.live';

/** This tab is playing the active profile's run now: a reload comes straight back to it. */
export function markLive(): void {
  try {
    sessionStorage.setItem(LIVE, store.activeSlotId() ?? '');
  } catch {
    // (no storage: a reload goes by the title screen, as it used to)
  }
}

/** Where a reload of this tab should go straight back to, or null for the title screen. */
export function reloadTarget(): ResumePoint | null {
  let live: string | null = null;
  try {
    live = sessionStorage.getItem(LIVE);
  } catch {
    return null;
  }
  const id = store.activeSlotId();
  if (!live || !id || live !== id) return null;
  const s = store.get();
  if (s.jailed) return null;
  // a cabinet in play: back into it, its stake still on it
  if (s.game) return { key: 'Minigame', data: { id: s.game.id, from: s.game.from, restore: s.game } };
  const at = resumePoint();
  return at.key === 'StartScreen' ? null : at;
}

/** The cabinet in play writes itself into the save through this, on the way out of the page too. */
let capture: (() => void) | null = null;

export function trackGame(fn: (() => void) | null): void {
  capture = fn;
}

/** Write the cabinet in play (if one is) into the save now: the tab is going. */
export function captureGame(): void {
  capture?.();
}
