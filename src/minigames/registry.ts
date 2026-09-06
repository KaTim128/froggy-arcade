/**
 * Minigame registry.  PRD §9.
 *
 * Every game behind one interface, so the hub cannot know or care what happens
 * inside a cabinet.  `makeStub` stays as the fallback: an unregistered id gets
 * a visibly-placeholder cabinet rather than a crash.
 */

import type { GameId } from '../core/state';
import type { MinigameModule } from './types';
import { makeStub } from './stub';

import { ticTacToe } from './tictactoe';
import { snakesAndLadders } from './snakes';
import { airHockey } from './airhockey';
import { hoops } from './hoops';
import { whackAFrog } from './whack';
import { chompMan } from './chompman';
import { grudge } from './grudge';

const REGISTRY: Partial<Record<GameId, MinigameModule>> = {
  tictactoe: ticTacToe,
  snakes: snakesAndLadders,
  airhockey: airHockey,
  hoops,
  whack: whackAFrog,
  chompman: chompMan,
  grudge,
};

export function getMinigame(id: GameId): MinigameModule {
  return REGISTRY[id] ?? makeStub(id);
}

export function isReal(id: GameId): boolean {
  return REGISTRY[id] !== undefined;
}
