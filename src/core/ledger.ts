/**
 * Token ledger.  PRD §6.2 / QFD B1 (rank #3, 7.0%).
 *
 * The ONLY path by which `tokens` changes.  The narrative gate depends on this
 * being exact, so every mutation is named and observable.
 */

import { store, LEDGER_KEY, ADMIN_TOKENS } from './state';

export type LedgerReason =
  | 'seed' // the $10 -> 20 tokens at the intro
  | 'game.cost' // minigame launch
  | 'game.reward' // minigame win
  | 'game.refund' // a tie: the entry cost handed straight back
  | 'charity' // Froggy's five
  | 'change' // the machine on the back wall, at half rate
  | 'prize'; // redemption

export type LedgerListener = (next: number, prev: number, reason: LedgerReason) => void;
export type BrokeListener = (reason: LedgerReason) => void;

class TokenLedger {
  private changeListeners = new Set<LedgerListener>();
  private brokeListeners = new Set<BrokeListener>();

  balance(): number {
    // The unlimited run is pinned: reading the balance is also what keeps
    // it pinned, so a save edited by hand or loaded from an older run snaps
    // straight back to the ceiling.
    if (store.isAdmin()) {
      if (store.get().tokens !== ADMIN_TOKENS) store.setTokens(LEDGER_KEY, ADMIN_TOKENS);
      return ADMIN_TOKENS;
    }
    return store.get().tokens;
  }

  canAfford(n: number): boolean {
    return store.isAdmin() || this.balance() >= n;
  }

  /**
   * PRD TK-1: returns false and changes nothing if unaffordable.
   *
   * Everything in the building goes through here, which is why the unlimited
   * run is implemented here and nowhere else: the cabinets, the table, the
   * prize counter and the broke check all keep asking the same question and
   * all get the same answer, and no scene needs to know the cheat exists.
   */
  debit(n: number, reason: LedgerReason): boolean {
    if (store.isAdmin()) {
      // Affordable, and nothing leaves the pile.  The balance never changes,
      // so nothing listening for a change fires — including going broke, which
      // is the whole reason a normal run ends up in the basement.
      this.balance();
      return n >= 0;
    }
    const prev = this.balance();
    if (n < 0 || prev < n) return false;
    const next = prev - n;
    store.setTokens(LEDGER_KEY, next);
    this.emit(next, prev, reason);
    return true;
  }

  credit(n: number, reason: LedgerReason): void {
    if (n <= 0) return;
    if (store.isAdmin()) {
      this.balance();
      return;
    }
    const prev = this.balance();
    const next = prev + n;
    store.setTokens(LEDGER_KEY, next);
    this.emit(next, prev, reason);
  }

  onChange(cb: LedgerListener): () => void {
    this.changeListeners.add(cb);
    return () => this.changeListeners.delete(cb);
  }

  /** PRD TK-6: fires when the balance transitions to exactly zero. */
  onBroke(cb: BrokeListener): () => void {
    this.brokeListeners.add(cb);
    return () => this.brokeListeners.delete(cb);
  }

  /** Debug panel only. */
  debugSet(value: number): void {
    const prev = this.balance();
    store.setTokens(LEDGER_KEY, value);
    this.emit(this.balance(), prev, 'seed');
  }

  private emit(next: number, prev: number, reason: LedgerReason): void {
    for (const fn of this.changeListeners) fn(next, prev, reason);
    if (next === 0 && prev !== 0) {
      for (const fn of this.brokeListeners) fn(reason);
    }
  }
}

export const ledger = new TokenLedger();
