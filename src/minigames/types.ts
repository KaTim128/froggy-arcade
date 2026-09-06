/**
 * The shared minigame contract.  PRD §9.0 / QFD B3 (rank #8).
 *
 * The hub knows nothing about a game's internals — only this.  Cost is debited
 * by the hub BEFORE launch (MG-2); reward is credited by the shell on win
 * (MG-3); Esc forfeits with no refund path in the API at all (MG-4).
 */

import type Phaser from 'phaser';
import type { GameId } from '../core/state';

export interface MinigameApi {
  /** End the game as a win.  The shell credits the reward. */
  win(): void;
  /** End the game as a loss.  Nothing is credited. */
  lose(): void;
  /** Draw area available to the game, below the title bar. */
  readonly area: { x: number; y: number; w: number; h: number };
}

export interface MinigameModule {
  id: GameId;
  title: string;
  /** One line shown under the title while the game boots. */
  rules: string;
  create(scene: Phaser.Scene, api: MinigameApi): void;
  update?(time: number, delta: number): void;
  destroy?(): void;
}
