/**
 * ---- THE POLICE GO INDOORS.  While the patrols are out (game/patrol) an
 * officer now and then turns off the pavement into one of the places along
 * it -- a shop, the arcade, Lily's lobby -- has a look round, and comes out
 * again.  This is the bookkeeping for that, kept apart from any one scene:
 *
 *   - an officer seen walking in off the street (`copWentIn`) is in there
 *     for a while, so walking in after them finds them already inside;
 *   - arriving somewhere with nobody inside, one may follow you in a few
 *     seconds later (`planVisit`), and another now and then after that;
 *   - the arcade is one place over all its rooms, so an officer inside it
 *     is what interrupts a cabinet (scenes2d/MinigameScene).
 *
 * Not saved: a reload is a quiet street.
 */

import { stealthPhase, patrolsOut } from './patrol';

export type Place = 'arcade' | 'barber' | 'clothes' | 'furniture' | 'lily';

/** Until when (performance.now) an officer is in each place. */
const inside: Partial<Record<Place, number>> = {};
/** When each place last had a visit planned, so they do not come every time. */
const lastPlanned: Partial<Record<Place, number>> = {};

/** Dev deep link ?police=1: an officer in every place, soon. */
const forced = (): boolean => {
  try {
    return new URLSearchParams(location.search).get('police') === '1';
  } catch {
    return false;
  }
};

/** An officer went in (seen from the street, or arrived in the room), for `ms`. */
export function copWentIn(place: Place, ms: number): void {
  inside[place] = Math.max(inside[place] ?? 0, performance.now() + ms);
}

/** Gone again (left the room, or lost interest). */
export function copCameOut(place: Place): void {
  delete inside[place];
}

/** Is an officer in there right now? */
export function copInside(place: Place): boolean {
  return patrolsOut() && performance.now() < (inside[place] ?? 0);
}

/**
 * Arriving at `place`: is an officer already inside (`already`), or will one
 * come in after you (`arriveIn`, seconds), or neither.  In the hunt they come
 * often; with a new look, now and then.
 */
export function planVisit(place: Place): { already: boolean; arriveIn: number | null } {
  if (!patrolsOut()) return { already: false, arriveIn: null };
  if (copInside(place)) return { already: true, arriveIn: null };
  const now = performance.now();
  const recent = now - (lastPlanned[place] ?? -Infinity) < 20000;
  const chance = forced() ? 1 : recent ? 0.15 : stealthPhase() ? 0.55 : 0.25;
  if (Math.random() >= chance) return { already: false, arriveIn: null };
  lastPlanned[place] = now;
  return { already: false, arriveIn: forced() ? 2 : 6 + Math.random() * 8 };
}

/** While you stay in a place: seconds until the next officer looks in, or null for none. */
export function nextVisitIn(): number | null {
  if (!patrolsOut()) return null;
  if (forced()) return 12;
  const chance = stealthPhase() ? 0.6 : 0.3;
  return Math.random() < chance ? 25 + Math.random() * 25 : null;
}

/** For the harness: put an officer in somewhere (or take them out). */
export const visitsDev = {
  put: (place: Place, ms = 60000) => copWentIn(place, ms),
  clear: (place: Place) => copCameOut(place),
  inside: (place: Place) => copInside(place),
};
