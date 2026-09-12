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

/**
 * PRD §7.7 — the handout.  Sets the latch first, so it cannot double-fire.
 *
 * Ten, not five.  Five bought one go on a medium cabinet and one loss put the
 * player straight back on zero and out of the building, which made the whole
 * beat a formality rather than a second chance.  Ten is a few goes: enough
 * that what happens next is something the player did.
 */
export const CHARITY_TOKENS = 10;

export function grantCharity(): void {
  if (store.get().charityUsed) return;
  store.patch({ charityUsed: true });
  ledger.credit(CHARITY_TOKENS, 'charity');
  store.flush();
}

/** PRD §7.9 — committed at the end of the ejection cutscene, not before. */
export function commitEjection(): void {
  store.patch({ route: 'ejected' });
  store.flush();
}
