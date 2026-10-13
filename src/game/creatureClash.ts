/**
 * ---- CREATURE CLASH: everything that changes the save.  Every token in or
 * out goes through the ledger, once, and the state is written in the same
 * breath, so no order of clicks, reloads or double-taps pays twice or loses
 * a creature twice.
 *
 *   starter      one of three, free, once
 *   packs        50 / 150 / 300 tokens, nine different cards face down, pick 1
 *   party        two at most, one fights
 *   battle       2 tokens in; a win pays 5; a loss faints the fighter (gone)
 *                and costs 1 more, never below zero
 *   recovery     nobody left: the recruitment table, same three packs
 */

import { store, type GameState } from '../core/state';
import { ledger } from '../core/ledger';
import { BATTLE_COST, BATTLE_WIN, BIOMES, BOSS_AFTER, DEFEAT_PENALTY, MAX_OWNED, STARTERS, TIERS, creatureById, rollPack, type Creature, type Tier } from './creatures';
import type { CreatureState, Owned } from './creatureState';
import { record } from './life';

export interface Result {
  ok: boolean;
  msg: string;
}
const ok = (msg: string): Result => ({ ok: true, msg });
const no = (msg: string): Result => ({ ok: false, msg });

const C = (): CreatureState => store.get().creatures;
function edit(fn: (c: CreatureState) => void): void {
  const c = structuredClone(C());
  fn(c);
  store.patch({ creatures: c } as Partial<GameState>);
}

export function activeOwned(c = C()): Owned | undefined {
  return c.owned.find((o) => o.uid === c.active);
}
export function activeCreature(c = C()): Creature | undefined {
  const o = activeOwned(c);
  return o ? creatureById(o.id) : undefined;
}

/** Nobody left, but you have played before: the recruitment table. */
export function needsRecovery(c = C()): boolean {
  return c.starterTaken && c.owned.length === 0;
}

export function claimStarter(id: string): Result {
  const c = C();
  if (c.starterTaken || c.owned.length) return no('YOU HAVE ALREADY HAD YOUR FREE ONE.');
  if (!STARTERS.includes(id)) return no('THAT ONE IS NOT ON OFFER.');
  edit((s) => {
    const uid = s.nextUid++;
    s.owned.push({ uid, id, wins: 0 });
    s.active = uid;
    s.starterTaken = true;
  });
  return ok(`${creatureById(id)!.name.toUpperCase()} IS YOURS.`);
}

/** Pay for a pack and lay its nine cards face down.  Refused before paying, never after. */
export function openPack(tierId: Tier['id'], rng: () => number = Math.random): Result {
  const tier = TIERS.find((t) => t.id === tierId);
  if (!tier) return no('NO SUCH PACK.');
  const c = C();
  if (c.battle) return no('FINISH THE BATTLE FIRST.');
  if (c.pending) return no('PICK A CARD FROM THE PACK YOU OPENED FIRST.');
  if (c.owned.length >= MAX_OWNED) return no('YOU CAN ONLY KEEP TWO. RELEASE ONE FIRST.');
  if (ledger.balance() < tier.cost) return no(`${tier.name} COSTS ${tier.cost} TOKENS.`);
  const cards = rollPack(tier, rng);
  if (!ledger.debit(tier.cost, 'creature')) return no(`${tier.name} COSTS ${tier.cost} TOKENS.`);
  edit((s) => {
    s.pending = { tier: tier.id, cards };
    s.pulls += 1;
  });
  store.flush();
  return ok('PICK ONE CARD.');
}

/** Turn over one of the nine: it is yours, and the pack is spent. */
export function pickCard(index: number): Result & { id?: string; cards?: string[] } {
  const c = C();
  const p = c.pending;
  if (!p) return no('NO PACK IS OPEN.');
  if (!Number.isInteger(index) || index < 0 || index > 8) return no('PICK ONE OF THE NINE.');
  if (c.owned.length >= MAX_OWNED) return no('YOU CAN ONLY KEEP TWO.');
  const id = p.cards[index];
  edit((s) => {
    const uid = s.nextUid++;
    s.owned.push({ uid, id, wins: 0 });
    if (!s.owned.some((o) => o.uid === s.active)) s.active = uid;
    s.pending = null;
  });
  store.flush();
  return { ok: true, msg: `${creatureById(id)!.name.toUpperCase()} JOINS YOU.`, id, cards: p.cards };
}

export function setActive(uid: number): Result {
  const c = C();
  if (c.battle) return no('NOT IN THE MIDDLE OF A BATTLE.');
  if (!c.owned.some((o) => o.uid === uid)) return no('NOT YOURS.');
  edit((s) => (s.active = uid));
  return ok('READY TO FIGHT.');
}

export function release(uid: number): Result {
  const c = C();
  if (c.battle) return no('NOT IN THE MIDDLE OF A BATTLE.');
  const o = c.owned.find((x) => x.uid === uid);
  if (!o) return no('NOT YOURS.');
  edit((s) => {
    s.owned = s.owned.filter((x) => x.uid !== uid);
    if (s.active === uid) s.active = s.owned[0]?.uid ?? -1;
  });
  return ok(`${creatureById(o.id)!.name.toUpperCase()} WANDERS OFF.`);
}

export function setHanded(h: 'right' | 'left'): void {
  edit((s) => (s.handed = h));
}

export function bossOpen(biomeId: string, c = C()): boolean {
  return (c.biomeWins[biomeId] ?? 0) >= BOSS_AFTER;
}

/** Pay the stake and open the battle.  The stake is gone from here, whatever happens. */
export function startBattle(biomeId: string, boss: boolean): Result {
  const c = C();
  if (!BIOMES.some((b) => b.id === biomeId)) return no('NO SUCH PLACE.');
  if (c.battle) return no('A BATTLE IS ALREADY ON.');
  if (c.pending) return no('PICK A CARD FROM YOUR OPEN PACK FIRST.');
  if (!activeOwned(c)) return no('YOU NEED A CREATURE TO FIGHT.');
  if (boss && !bossOpen(biomeId, c)) return no(`WIN ${BOSS_AFTER} BATTLES HERE TO FACE THE BOSS.`);
  if (!ledger.debit(BATTLE_COST, 'creature')) return no(`A BATTLE COSTS ${BATTLE_COST} TOKENS.`);
  edit((s) => (s.battle = { biome: biomeId, boss }));
  store.flush();
  return ok('FIGHT!');
}

function takePenalty(): number {
  const n = Math.min(DEFEAT_PENALTY, ledger.balance());
  if (n > 0) ledger.debit(n, 'creature');
  return n;
}

/**
 * The end of a battle.  Only one call per battle does anything: the battle
 * is closed in the same write, so a second call (a double tap, a late timer)
 * finds nothing open and pays nothing.
 */
export function finishBattle(won: boolean): Result & { paid: number; lost?: string } {
  const c = C();
  const b = c.battle;
  if (!b) return { ...no('NO BATTLE IS ON.'), paid: 0 };
  const fighter = activeOwned(c);
  if (won) {
    edit((s) => {
      s.battle = null;
      s.wins += 1;
      s.biomeWins[b.biome] = (s.biomeWins[b.biome] ?? 0) + 1;
      const bossId = BIOMES.find((x) => x.id === b.biome)!.boss.id;
      if (b.boss && !s.bosses.includes(bossId)) s.bosses.push(bossId);
      const f = s.owned.find((o) => o.uid === s.active);
      if (f) f.wins += 1;
    });
    ledger.credit(BATTLE_WIN, 'creature');
    record('creature_win');
    store.flush();
    return { ...ok(`YOU WIN ${BATTLE_WIN} TOKENS.`), paid: BATTLE_WIN };
  }
  edit((s) => {
    s.battle = null;
    s.losses += 1;
    // fainted, and gone
    s.owned = s.owned.filter((o) => o.uid !== s.active);
    s.active = s.owned[0]?.uid ?? -1;
  });
  const pen = takePenalty();
  store.flush();
  const name = fighter ? creatureById(fighter.id)!.name.toUpperCase() : 'YOUR CREATURE';
  return { ...ok(`${name} FAINTED AND IS GONE.${pen ? ` -${pen} TOKEN.` : ''}`), paid: -pen, lost: fighter?.id };
}

/**
 * Walking away mid-fight (QUIT, or the page going away).  The fighter comes
 * home; the stake stays spent and the penalty is paid, so it is never
 * cheaper to leave than to lose a battle you were already losing -- only
 * kinder to the creature.
 */
export function retreat(): Result {
  if (!C().battle) return no('NO BATTLE IS ON.');
  edit((s) => {
    s.battle = null;
    s.losses += 1;
  });
  const pen = takePenalty();
  store.flush();
  return ok(`YOU RAN.${pen ? ` -${pen} TOKEN.` : ''}`);
}
