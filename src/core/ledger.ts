/**
 * Token ledger.  PRD §6.2 / QFD B1 (rank #3, 7.0%).
 *
 * The ONLY path by which `tokens` changes.  The narrative gate depends on this
 * being exact, so every mutation is named and observable.
 */

import { store, LEDGER_KEY } from './state';

export type LedgerReason =
  | 'seed' // the $10 -> 20 tokens at the intro
  | 'game.cost' // minigame launch
  | 'game.reward' // minigame win
  | 'charity' // Froggy's five
  | 'prize'; // redemption

export type LedgerListener = (next: number, prev: number, reason: LedgerReason) => void;
export type BrokeListener = (reason: LedgerReason) => void;

class TokenLedger {
  private changeListeners = new Set<LedgerListener>();
  private brokeListeners = new Set<BrokeListener>();

  balance(): number {
    return store.get().tokens;
  }

  canAfford(n: number): boolean {
    return this.balance() >= n;
  }

  /** PRD TK-1: returns false and changes nothing if unaffordable. */
  debit(n: number, reason: LedgerReason): boolean {
    const prev = this.balance();
    if (n < 0 || prev < n) return false;
    const next = prev - n;
    store.setTokens(LEDGER_KEY, next);
    this.emit(next, prev, reason);
    return true;
  }

  credit(n: number, reason: LedgerReason): void {
    if (n <= 0) return;
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
