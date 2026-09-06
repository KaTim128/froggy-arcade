/**
 * Broke detector and one-shot latches.  PRD §6.3 / QFD B2 (rank #6).
 *
 *   balance === 0 AND route === 'normal'
 *     charityUsed === false -> charity, once, ever
 *     charityUsed === true  -> ejection
 *
 * BR-2: the "exactly once" guarantee lives in the latch, not in scene
 * bookkeeping.  BR-3: the check never fires mid-minigame; it is deferred until
 * the player is back in the hub, so no cutscene interrupts play.
 */

import { store } from './state';
import { ledger } from './ledger';

export type BrokeOutcome = 'charity' | 'eject' | null;

/** Pure: what should happen right now?  Does not mutate anything. */
export function evaluateBroke(): BrokeOutcome {
  const s = store.get();
  if (s.route !== 'normal') return null;
  if (ledger.balance() > 0) return null;
  return s.charityUsed ? 'eject' : 'charity';
}

/** PRD §7.7 — the five tokens.  Sets the latch first, so it cannot double-fire. */
export function grantCharity(): void {
  if (store.get().charityUsed) return;
  store.patch({ charityUsed: true });
  ledger.credit(5, 'charity');
  store.flush();
}

/** PRD §7.9 — committed at the end of the ejection cutscene, not before. */
export function commitEjection(): void {
  store.patch({ route: 'ejected' });
  store.flush();
}
