/**
 * ---- DUSK AND DAWN, as they happen.  A scene paints itself for the hour it
 * was opened at; this tells it when the light turns while you are standing
 * in it -- the street repaints for the night, a shop shows you out, the
 * condo's window goes dark -- so the lighting, the shops and the clock never
 * disagree.
 */

import type Phaser from 'phaser';
import { clock, DUSK_HOUR, SHOP_HOURS, sleepPlace, type Clock } from './life';
import { store } from '../core/state';

/**
 * Call `turned` (once per turn) when it goes dark or light while `scene` is
 * up.  `ready` says whether the scene can act on it now; if not, it is asked
 * again a moment later.
 */
export function onLightTurn(scene: Phaser.Scene, turned: (dark: boolean, c: Clock) => void, ready: () => boolean = () => true): void {
  let was = clock().dark;
  scene.time.addEvent({
    delay: 500,
    loop: true,
    callback: () => {
      const s = store.get();
      if (s.timeOfDay === 'midnight' || s.route !== 'normal') return;
      const c = clock();
      if (c.dark === was || !ready()) return;
      was = c.dark;
      turned(c.dark, c);
    },
  });
}

/** What to tell the player when night falls: the shops, and where to sleep. */
export function nightfallLine(): string {
  const where = sleepPlace();
  const bed = where === 'home' ? 'GO HOME TO UNIT 612 TO SLEEP.' : where === 'street' ? 'SLEEP ON THE MAT BY THE ARCADE DOORS.' : '';
  return `NIGHT. THE SHOPS ARE SHUT (OPEN ${SHOP_HOURS}). ${bed}`.trim();
}

let toldNight = -1;
/** The nightfall line, once per night (whichever scene you are in when it falls). */
export function nightfallOnce(): string | null {
  const c = clock();
  if (!c.dark) return null;
  // the night belongs to the day it began on
  const night = c.hour >= DUSK_HOUR ? c.day : c.day - 1;
  if (toldNight === night) return null;
  toldNight = night;
  return nightfallLine();
}
