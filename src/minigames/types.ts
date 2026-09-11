/**
 * The shared minigame contract.  PRD §9.0 / QFD B3 (rank #8).
 *
 * The hub knows nothing about a game's internals — only this.  Cost is debited
 * by the hub BEFORE launch (MG-2); reward is credited by the shell on win
 * (MG-3); Esc forfeits with no refund path in the API at all (MG-4).
 *
 * Blackjack is the one game where the player chooses how much rides on a play,
 * so the shell — never the game — also owns raising the stake and paying a
 * variable amount out.  The ledger stays the single path either way.
 */

import type Phaser from 'phaser';
import type { GameId } from '../core/state';

export interface MinigameApi {
  /**
   * End the game as a win.  The shell credits `payout` when given, and the
   * cabinet's fixed reward otherwise — a betting game works out its own.
   */
  win(payout?: number): void;
  /** End the game as a loss.  Nothing is credited. */
  lose(): void;
  /** Tokens riding on this play: the entry cost, plus anything raised. */
  staked(): number;
  /**
   * Put more tokens on this play.  Returns false and moves nothing if the
   * player cannot cover it.  Raised tokens are gone exactly like the entry
   * cost is — there is no unbet.
   */
  raise(n: number): boolean;
  /**
   * Pay a win WITHOUT ending the game.  A table deals hand after hand, so it
   * settles each one as it happens and the player can keep playing with what
   * they just won.  Ending a session that paid this way is `cashOut`.
   */
  payout(n: number): void;
  /**
   * Leave a table.  Every hand has already been paid, so nothing more changes
   * hands — the shell just shows how the session went.
   */
  cashOut(): void;
  /** What is left in the player's pocket. */
  balance(): number;
  /** Draw area available to the game, below the title bar. */
  readonly area: { x: number; y: number; w: number; h: number };
}

export interface MinigameModule {
  id: GameId;
  title: string;
  /** One line shown under the title while the game boots. */
  rules: string;
  /** Replaces the shell's "WIN: +n" line when the payout is not fixed. */
  payoutNote?: string;
  create(scene: Phaser.Scene, api: MinigameApi): void;
  update?(time: number, delta: number): void;
  destroy?(): void;
}
