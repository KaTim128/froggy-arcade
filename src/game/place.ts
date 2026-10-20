/**
 * WHERE THE PLAYER IS STANDING, kept with the run.
 *
 * Every walkable scene -- the arcade rooms, the streets, the alley, the shops,
 * the condo, the hotel -- calls `trackPlace` once its player exists.  From
 * then on the scene, what it was entered with, and the player's spot and
 * facing are written into the save as they change, and once more on the way
 * out (the tab hidden or closed: see `capturePlace`).  core/resume.ts reads it
 * back, so START and RESUME put the player where they were, not at the arcade
 * door.
 *
 * Coming back, the scene is started with `{ ...data, resume: {x, y, facing} }`,
 * and the same `trackPlace` call is what puts the player back on the spot --
 * after the scene has done its usual entry, so nothing about the room is set
 * up differently.
 */

import type Phaser from 'phaser';
import { store, type SavedPlace } from '../core/state';

/** The scenes a run can be picked up in, and only these. */
export const RESUMABLE = new Set([
  'ArcadeHub',
  'ArcadeAnnex',
  'ArcadeLounge',
  'ArcadeCasino',
  'ExteriorDay',
  'StreetEast',
  'StreetWest',
  'BackAlley',
  'Condo',
  'FurnitureStore',
  'ClothesStore',
  'BarberShop',
  'Hotel',
  'Stairwell',
]);

/** What a resumed scene is started with, beside its own entry data. */
export interface ResumeSpot {
  x: number;
  y: number;
  facing: number;
}

interface Walker {
  x: number;
  y: number;
  readonly facing: number;
  setPosition(x: number, y: number): void;
  face(dir: number): void;
}

/** The one being tracked now: written out once more on the way out. */
let live: (() => void) | null = null;

/**
 * Keep `scene`'s player in the save.  `data` is what the scene was entered
 * with that it needs to be entered the same way again (the hotel's floor, the
 * condo's which-room); anything else is left out.  `player` is read each time,
 * so a scene that builds its player late, or rebuilds it, still works.
 */
export function trackPlace(
  scene: Phaser.Scene,
  player: () => Walker | null,
  data: Record<string, string | number | boolean> = {},
  resume?: ResumeSpot,
): void {
  const key = scene.scene.key;
  if (!RESUMABLE.has(key)) return;

  // Back where it was left.
  const p = player();
  if (resume && p && Number.isFinite(resume.x) && Number.isFinite(resume.y)) {
    p.setPosition(resume.x, resume.y);
    p.face(resume.facing);
  }

  let last = '';
  const write = (leaving = false): void => {
    const me = player();
    if (!me || (!leaving && !scene.sys.isActive())) return;
    const x = Math.round(me.x);
    const y = Math.round(me.y);
    const sig = `${x},${y},${me.facing}`;
    if (sig === last) return;
    last = sig;
    const place: SavedPlace = { key, data, x, y, facing: me.facing >= 0 ? 1 : -1, at: Date.now() };
    store.setPlace(place);
  };
  write();
  const timer = scene.time.addEvent({ delay: 500, loop: true, callback: () => write() });
  const mine = (): void => write(true);
  live = mine;
  scene.events.once('shutdown', () => {
    // the last step taken in here is the one kept, until the next room's
    if (live === mine) write(true);
    timer.remove();
    if (live === mine) live = null;
  });
}

/** Write the player's spot now: the tab is going, or the game is being left. */
export function capturePlace(): void {
  live?.();
}

/** The resume spot a scene's init data carries, if it was resumed. */
export function resumeSpot(data: unknown): ResumeSpot | undefined {
  const r = (data as { resume?: ResumeSpot } | null)?.resume;
  return r && Number.isFinite(r.x) && Number.isFinite(r.y) ? r : undefined;
}
