/**
 * ---- CREATURE CLASH MINI GAMES (user, 4 Nov).
 *
 *   MELEE VS MELEE    pick one of three melee creatures; the other side is a
 *                     melee creature of about the same strength
 *   RANGED VS RANGED  the same, for shooters
 *   5V5 BATTLE        pick five of twelve, a mix of roles; the other side
 *                     gets five of its own in the same roles (user, 4 Nov: it
 *                     was 3v3).  One at a time: when one faints the next comes
 *                     in, and the survivor keeps the health it had.  Last
 *                     team standing wins.
 *
 * WHAT IT COSTS (user, 4 Nov): a duel is 2 tokens in and 5 for a win (3 up);
 * 5v5 is 5 in and 10 for a win.  Nothing for a loss.  The stake is taken
 * once, when the battle is confirmed; the prize is paid once, when the run is
 * won.
 * Mini games use the creatures here, not your own, and give no XP: Story Mode
 * and the Ladder are untouched.
 */

import { ledger } from '../core/ledger';
import { CREATURES, creatureById, type Creature } from './creatures';
import { traitsOf } from './creatureTraits';

export type MiniKind = 'melee' | 'ranged' | 'team';
/** Each mode's stake and prize (see the top of this file). */
export const MINI_PRICE: Record<MiniKind, { cost: number; win: number }> = {
  melee: { cost: 2, win: 5 },
  ranged: { cost: 2, win: 5 },
  team: { cost: 5, win: 10 },
};
/** The cheapest way in, for the hub's "you need" line. */
export const MINI_MIN_COST = Math.min(...Object.values(MINI_PRICE).map((p) => p.cost));
/** The team mode: how many a side, and how many to choose from. */
export const TEAM_SIZE = 5;
/** (user, 5 Nov: ten on offer, seen only once the five tokens are paid) */
export const TEAM_POOL = 10;
/** Every creature in a mini game fights at this level, so a pick is about the creature. */
export const MINI_LEVEL = 8;

export const MINI_INFO: Record<MiniKind, { title: string; rules: string[] }> = {
  melee: { title: 'MELEE VS MELEE', rules: ['PICK 1 OF 3 MELEE FIGHTERS.', 'YOUR FOE IS MELEE TOO.'] },
  ranged: { title: 'RANGED VS RANGED', rules: ['PICK 1 OF 3 SHOOTERS.', 'YOUR FOE SHOOTS TOO.'] },
  team: { title: '5V5 BATTLE', rules: ['PICK 5 OF 10. ONE AT A TIME:', 'WHEN ONE FAINTS, THE NEXT GOES IN.'] },
};

/** A creature's combat role, read off its kit. */
export type Role = 'melee' | 'ranged' | 'support';
export function roleOf(c: Creature): Role {
  const t = traitsOf(c);
  const support = c.attacks.slice(1).some((a) => a.kind === 'mend' || a.kind === 'shield' || a.kind === 'aura');
  if (t.style.startsWith('MELEE')) return support && c.hp >= 120 ? 'support' : 'melee';
  return support ? 'support' : 'ranged';
}
const isMelee = (c: Creature): boolean => traitsOf(c).style.startsWith('MELEE');

/** A rough number for how strong a creature is: health times hitting power. */
export function powerOf(c: Creature): number {
  const n = c.attacks[0];
  const dps = n.dmg / Math.max(0.2, n.cd);
  const sp = c.attacks.slice(1).reduce((a, x) => a + x.dmg / Math.max(1, x.cd), 0);
  return c.hp * (dps + sp * 0.6) * (0.8 + c.speed / 400);
}

const shuffle = <T>(a: T[], rng: () => number): T[] => {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** The creatures a mode draws from. */
function eligible(kind: MiniKind): Creature[] {
  if (kind === 'melee') return CREATURES.filter(isMelee);
  if (kind === 'ranged') return CREATURES.filter((c) => !isMelee(c));
  return CREATURES.slice();
}

/**
 * The choice on offer: three for a duel, ten for 3v3 -- and for 3v3 at least
 * three of each role, so a team can be built rather than taken.
 */
export function drawPool(kind: MiniKind, rng: () => number = Math.random): string[] {
  const pool = shuffle(eligible(kind), rng);
  if (kind !== 'team') return pool.slice(0, 3).map((c) => c.id);
  const by: Record<Role, Creature[]> = { melee: [], ranged: [], support: [] };
  for (const c of pool) by[roleOf(c)].push(c);
  const out = [...by.melee.slice(0, 4), ...by.ranged.slice(0, 4), ...by.support.slice(0, 2)];
  for (const c of pool) if (out.length < TEAM_POOL && !out.includes(c)) out.push(c);
  return out.slice(0, TEAM_POOL).map((c) => c.id);
}

/**
 * THE OTHER SIDE, MATCHED.  For each of yours: one of the same role (melee for
 * melee, shooter for shooter), not one of yours, and the nearest in strength
 * among a few drawn at random -- so it is a fair fight and not always the
 * same one.
 */
export function drawFoes(kind: MiniKind, mine: string[], rng: () => number = Math.random): string[] {
  const out: string[] = [];
  for (const id of mine) {
    const me = creatureById(id);
    if (!me) continue;
    const role = roleOf(me);
    const same = eligible(kind).filter((c) => !mine.includes(c.id) && !out.includes(c.id) && (kind !== 'team' || roleOf(c) === role));
    const field = same.length ? same : eligible(kind).filter((c) => !mine.includes(c.id) && !out.includes(c.id));
    const few = shuffle(field, rng).slice(0, 6);
    const p = powerOf(me);
    few.sort((a, b) => Math.abs(powerOf(a) - p) - Math.abs(powerOf(b) - p));
    if (few[0]) out.push(few[0].id);
  }
  return out;
}

/** The run in progress: paid once at the start, paid out once at the end. */
export interface MiniRun {
  kind: MiniKind;
  /** Still to fight, in order: the front of each list is in the arena. */
  me: string[];
  foe: string[];
  /** The health the one still standing walks into the next bout with. */
  myHp?: number;
  foeHp?: number;
  /**
   * (user, 5 Nov) ...and its cooldowns, exactly as they stood: three
   * abilities' seconds left and the ultimate's.  Never reset between bouts.
   */
  myCds?: [number, number, number];
  foeCds?: [number, number, number];
  myUlt?: number;
  foeUlt?: number;
  /** Bouts fought so far. */
  bout: number;
  done: boolean;
}

let run: MiniRun | null = null;
export const currentMini = (): MiniRun | null => run;

/**
 * ---- PAY, THEN SEE (user, 5 Nov: 5v5; 8 Nov: every mode).  The stake buys
 * the look at the pool, drawn at random; before paying you may walk away
 * for nothing.  Paid once: the pool stays yours, unchanged, until a fight
 * is started from it -- leaving the pick and coming back never charges again.
 */
const paidPools: Partial<Record<MiniKind, string[]>> = {};
export const paidPool = (kind: MiniKind): string[] | null => paidPools[kind] ?? null;
export function payForPool(kind: MiniKind): { ok: boolean; msg: string } {
  if (paidPools[kind]) return { ok: true, msg: '' };
  const cost = MINI_PRICE[kind].cost;
  if (!ledger.debit(cost, 'creature')) return { ok: false, msg: `${MINI_INFO[kind].title} COSTS ${cost} TOKENS.` };
  paidPools[kind] = drawPool(kind);
  return { ok: true, msg: '' };
}

/** Confirm a pick from a paid pool: the run is on (the stake went at the pool). */
export function startMini(kind: MiniKind, picks: string[]): { ok: boolean; msg: string; run?: MiniRun } {
  const want = kind === 'team' ? TEAM_SIZE : 1;
  if (picks.length !== want || picks.some((p) => !creatureById(p))) return { ok: false, msg: kind === 'team' ? `PICK ${TEAM_SIZE}.` : 'PICK ONE.' };
  const pool = paidPools[kind];
  if (!pool || picks.some((p) => !pool.includes(p))) return { ok: false, msg: 'PAY TO SEE THE POOL FIRST.' };
  delete paidPools[kind];
  run = { kind, me: picks.slice(), foe: drawFoes(kind, picks), bout: 0, done: false };
  return { ok: true, msg: 'FIGHT!', run };
}

/**
 * A bout is over.  The loser's creature leaves; the winner keeps its health
 * and its cooldowns, as they stood.
 * The run ends when one side has nobody left, and the ten is paid then, once.
 */
export function boutOver(won: boolean, survivorHp: number, cds?: [number, number, number], ult?: number): { over: boolean; won: boolean; paid: number } {
  if (!run || run.done) return { over: true, won: false, paid: 0 };
  run.bout++;
  if (won) {
    run.foe.shift();
    run.myHp = survivorHp;
    run.myCds = cds;
    run.myUlt = ult;
    run.foeHp = undefined;
    run.foeCds = undefined;
    run.foeUlt = undefined;
  } else {
    run.me.shift();
    run.foeHp = survivorHp;
    run.foeCds = cds;
    run.foeUlt = ult;
    run.myHp = undefined;
    run.myCds = undefined;
    run.myUlt = undefined;
  }
  if (run.me.length && run.foe.length) return { over: false, won, paid: 0 };
  run.done = true;
  const victory = run.foe.length === 0;
  const win = MINI_PRICE[run.kind].win;
  if (victory) ledger.credit(win, 'game.reward');
  return { over: true, won: victory, paid: victory ? win : 0 };
}

/** Walk away: the five is gone, nothing is paid. */
export function abandonMini(): void {
  if (run) run.done = true;
  run = null;
}
