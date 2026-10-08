/**
 * Route state machine and scene guards.  PRD §6.4 / QFD A2 (rank #7).
 *
 * `canEnter` is a single pure predicate.  There is no other gate — AC-6 lives
 * or dies here.
 */

import type { GameState, Route } from './state';

export const SCENES = [
  'Boot',
  'StartScreen',
  'SettingsModal',
  'InventoryModal',
  'IntroCutscene',
  'ArcadeHub',
  'ArcadeAnnex',
  'ArcadeCasino',
  'ArcadeLounge',
  'CraneGame',
  'Froggopoly',
  'PrizeCounter',
  'PrizeExchange',
  'ChangeMachine',
  'ExteriorDay',
  'StreetWest',
  'Hotel',
  'HotelHall3D',
  'RooftopEscape',
  'ArrestEnding',
  'NightRoad3D',
  'FroggyCharity',
  'SecondBust',
  'EjectionCutscene',
  'ExteriorNight',
  'BackAlley',
  'ArcadeDark',
  'BasementSequence',
  'HideRoom3D',
  'Chase3D',
  'OutroCutscene3D',
  'TheEnd',
  'EndCard',
  'Minigame',
] as const;

export type SceneId = (typeof SCENES)[number];

export interface GuardContext {
  /** Cost of the minigame being launched, when scene === 'Minigame'. */
  cost?: number;
}

export function canEnter(scene: SceneId, s: Readonly<GameState>, ctx: GuardContext = {}): boolean {
  switch (scene) {
    case 'Boot':
    case 'StartScreen':
    case 'SettingsModal':
    case 'InventoryModal':
      return true;

    case 'IntroCutscene':
      return s.route === 'normal' && !s.seenIntro;

    // The new room is on both sides of the night: by day it is through the
    // hub's right wall, and after closing it is the way in from the alley
    // (its side door) to the dark lobby.
    case 'ArcadeLounge':
      return s.route === 'normal' || s.route === 'ejected';

    case 'CraneGame':
    case 'Froggopoly':
    case 'ArcadeHub':
    case 'ArcadeAnnex':
    case 'ArcadeCasino':
    case 'PrizeCounter':
    case 'FroggyCharity':
    case 'SecondBust':
    // The street outside and the man on it belong to the daytime half of the
    // game: once the arcade has thrown you out, there is no going back to
    // either of them.
    case 'ExteriorDay':
    case 'StreetWest':
    case 'Hotel':
    case 'HotelHall3D':
    case 'NightRoad3D':
    case 'RooftopEscape':
    case 'PrizeExchange':
    case 'ChangeMachine':
      return s.route === 'normal';

    case 'Minigame':
      return s.route === 'normal' && s.tokens >= (ctx.cost ?? 0);

    case 'EjectionCutscene':
      // The ejection commits `route = 'ejected'`, so it runs from `normal`.
      return s.route === 'normal';

    // PRD AC-6: the break-in is reachable ONLY from the ejected route.
    case 'ExteriorNight':
    case 'ArcadeDark':
      return s.route === 'ejected';
    // The alley too -- and, once the night in the arcade is behind you, by
    // day as well: its side door chained shut (see BackAlley).
    case 'BackAlley':
      return s.route === 'ejected' || (s.route === 'normal' && s.froggyGone);

    case 'BasementSequence':
      return s.route === 'basement';

    case 'HideRoom3D':
      return s.route === 'hide';

    case 'Chase3D':
      return s.route === 'chase';

    case 'OutroCutscene3D':
    case 'EndCard':
    case 'ArrestEnding':
      return s.route === 'ended';

    // The job finished.  Reachable from the ordinary route, because that is the
    // only route on which the prizes can all have been sold.
    case 'TheEnd':
      return true;
  }
}

/** Legal forward transitions of the route flag. PRD §6.4. */
const ROUTE_ORDER: Route[] = ['normal', 'ejected', 'basement', 'chase', 'ended'];

export function isForwardRoute(from: Route, to: Route): boolean {
  return ROUTE_ORDER.indexOf(to) > ROUTE_ORDER.indexOf(from);
}
