/**
 * WHERE A RUN PICKS UP.  The one answer to "this profile wants to play: which
 * scene, with what?" -- used by START on the title screen and by the pause
 * menu's RETURN TO GAME LOBBY, so the two can never disagree (PRD EC-3).
 */

import { store } from './state';

export interface ResumePoint {
  key: string;
  data?: object;
}

export function resumePoint(): ResumePoint {
  const s = store.get();
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
  return { key: s.seenIntro ? 'ArcadeHub' : 'IntroCutscene' };
}
