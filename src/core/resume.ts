/**
 * WHERE A RUN PICKS UP.  The one answer to "this profile wants to play: which
 * scene, with what?" -- used by START on the title screen (PRD EC-3).
 *
 * The story's own checkpoints come first: a run in the rooms, on the roofs or
 * in the hotel at 3 AM goes back to that.  Otherwise it goes back to wherever
 * the player was last standing (game/place) -- the shop, the condo, the
 * street -- and only to the arcade floor when there is nowhere better.
 */

import { store } from './state';
import { RESUMABLE } from '../game/place';

export interface ResumePoint {
  key: string;
  data?: object;
}

export function resumePoint(): ResumePoint {
  const s = store.get();
  // (an arrested profile is never resumed: the title screen says so)
  if (s.jailed) return { key: 'StartScreen' };
  if (s.route === 'ejected') return { key: 'ExteriorNight' };
  if (s.route === 'basement') return { key: 'BasementSequence' };
  // A run locked in the rooms comes back to the rooms, coming round on the
  // floor with him already staring at you -- never on the briefing.
  if (s.route === 'hide') return { key: 'HideRoom3D', data: { wake: s.hideRoom === 0 } };
  if (s.route === 'chase') return { key: 'Chase3D' };
  if (s.route === 'ended') return { key: 'EndCard' };
  // After the hotel: out on the roofs, or still in the lobby with the police
  // outside -- each picks up where it was saved.
  if (s.hotelAfter === 'escape') return { key: 'RooftopEscape', data: {} };
  if (s.hotelAfter === 'police' && s.reachedHotel) return { key: 'Hotel', data: { area: 'lobby', from: 'storage' } };
  // The hotel is a checkpoint twice over: through its doors after the road,
  // and asleep in 612 -- which comes back at 3 AM, at the knocking.
  if (s.timeOfDay === 'midnight' && s.reachedHotel && s.hotelAfter === 'none') {
    return { key: 'Hotel', data: s.hotelNight ? { area: 'room', late: true } : { area: 'lobby' } };
  }
  if (!s.seenIntro) return { key: 'IntroCutscene' };
  return lastPlace() ?? { key: 'ArcadeHub' };
}

/** Where the player was standing, if it is somewhere the run can go back to. */
function lastPlace(): ResumePoint | null {
  const s = store.get();
  const p = s.place;
  if (s.route !== 'normal' || !p || !RESUMABLE.has(p.key)) return null;
  const resume = { x: p.x, y: p.y, facing: p.facing };
  // the flat is only yours while it is rented: down in the lobby otherwise
  if (p.key === 'Condo' && !s.life.rented) return { key: 'Hotel', data: { area: 'lobby' } };
  return { key: p.key, data: { ...(p.data ?? {}), resume } };
}
