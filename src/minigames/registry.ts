/**
 * Minigame registry.  PRD §9.
 *
 * Phase 2 registers a placeholder that exercises the full contract (cost on
 * launch, reward on win, Esc forfeits) so the economy is testable end to end
 * before a single game exists.  Phase 3 swaps them out one at a time.
 */

import type { GameId } from '../core/state';
import type { MinigameModule } from './types';
import { makeStub } from './stub';

const REGISTRY: Partial<Record<GameId, MinigameModule>> = {
  // Phase 3 fills this in.
};

export function getMinigame(id: GameId): MinigameModule {
  return REGISTRY[id] ?? makeStub(id);
}

export function isReal(id: GameId): boolean {
  return REGISTRY[id] !== undefined;
}
