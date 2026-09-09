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
  'IntroCutscene',
  'ArcadeHub',
  'ArcadeAnnex',
  'ArcadeCasino',
  'PrizeCounter',
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
      return true;

    case 'IntroCutscene':
      return s.route === 'normal' && !s.seenIntro;

    case 'ArcadeHub':
    case 'ArcadeAnnex':
    case 'ArcadeCasino':
    case 'PrizeCounter':
    case 'FroggyCharity':
    case 'SecondBust':
      return s.route === 'normal';

    case 'Minigame':
      return s.route === 'normal' && s.tokens >= (ctx.cost ?? 0);

    case 'EjectionCutscene':
      // The ejection commits `route = 'ejected'`, so it runs from `normal`.
      return s.route === 'normal';

    // PRD AC-6: the break-in is reachable ONLY from the ejected route.
    case 'ExteriorNight':
    case 'BackAlley':
    case 'ArcadeDark':
      return s.route === 'ejected';

    case 'BasementSequence':
      return s.route === 'basement';

    case 'HideRoom3D':
      return s.route === 'hide';

    case 'Chase3D':
      return s.route === 'chase';

    case 'OutroCutscene3D':
    case 'EndCard':
      return s.route === 'ended';
  }
}

/** Legal forward transitions of the route flag. PRD §6.4. */
const ROUTE_ORDER: Route[] = ['normal', 'ejected', 'basement', 'chase', 'ended'];

export function isForwardRoute(from: Route, to: Route): boolean {
  return ROUTE_ORDER.indexOf(to) > ROUTE_ORDER.indexOf(from);
}
