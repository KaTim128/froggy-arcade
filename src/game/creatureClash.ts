/**
 * ---- CREATURE CLASH: everything that changes the save.  Every token in or
 * out goes through the ledger, once, and the state is written in the same
 * breath, so no order of clicks, reloads or double-taps pays twice or loses
 * a creature twice.
 *
 *   recruit      one pack, 25 tokens: nine different cards face down, keep one.
 *                There is no free starter (log #3): the first creature is a
 *                recruit like any other.
 *   party        two at most, one fights
 *
 *   ZONE BATTLES  one fight, in that place, against one of the creatures
 *                 that live there, at your creature's level.  5 tokens in; a
 *                 win pays 10 and the fight is done.  A loss FAINTS the
 *                 fighter: it keeps its slot -- a creature is never taken off
 *                 your team for losing -- and rests five minutes before it
 *                 can fight again, or is revived at once for 5 tokens.
 *
 *   LADDER        20 tokens, once, for a run: Level 1 to Level 5, one normal
 *                 creature each, then a boss.  Beat the boss and the run
 *                 pays 80 (60 up on the entry); the levels on the way pay
 *                 nothing.  Lose a fight and the run is over: no refund, no
 *                 prize, and your creature limps home (the fee is the price).
 *                 A new run is a new 20.  The two modes share nothing but
 *                 your creatures.
 */

import { store, type GameState } from '../core/state';
import { ledger } from '../core/ledger';
import {
  BATTLE_COST, BATTLE_WIN, BIOMES, LADDER_BOSS_WIN, LADDER_COST, LADDER_LEVELS, LADDER_WIN, MAX_OWNED, PACK_COST, STARTERS,
  BOSSES, bossById, creatureById, rollLadder, rollPack, zoneFoe, type Biome, type Creature,
} from './creatures';
import type { CreatureState, Owned } from './creatureState';
import { record } from './life';
import { badgeSet, earnBadge, setBadgeSet } from './badges';
import { MAX_LEVEL, MAX_XP, XP_BOSS, XP_WIN, levelOf, withLevel } from './creatureLevel';

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

/** An owned creature as it fights now: grown to its level. */
export function ownedCreature(o: Owned): Creature | undefined {
  const base = creatureById(o.id);
  return base ? withLevel(base, levelOf(o.xp ?? 0)) : undefined;
}

export function activeCreature(c = C()): Creature | undefined {
  const o = activeOwned(c);
  return o ? ownedCreature(o) : undefined;
}

/** Nobody on the team: the recruitment table (the first recruit, or after releasing them all). */
export function needsRecovery(c = C()): boolean {
  return c.owned.length === 0;
}

/** How long a fainted creature rests before it can fight again, and what reviving it now costs. */
export const REST_MS = 5 * 60_000;
export const REVIVE_COST = 5;

/** Milliseconds of rest it still needs; 0 when it is fit to fight. */
export function restLeft(o: Owned, now = Date.now()): number {
  return o.faintedAt ? Math.max(0, o.faintedAt + REST_MS - now) : 0;
}

/** Back on its feet now, for REVIVE_COST.  Refused before paying, never after. */
export function revive(uid: number): Result {
  const c = C();
  const o = c.owned.find((x) => x.uid === uid);
  if (!o) return no('NOT YOURS.');
  if (!restLeft(o)) return no('IT IS READY TO FIGHT.');
  if (!ledger.debit(REVIVE_COST, 'creature')) return no(`REVIVING COSTS ${REVIVE_COST} TOKENS.`);
  edit((s) => {
    const x = s.owned.find((y) => y.uid === uid);
    if (x) delete x.faintedAt;
  });
  store.flush();
  return ok(`${creatureById(o.id)!.name.toUpperCase()} IS BACK ON ITS FEET.`);
}

/** The fighter cannot go in: none, or still resting.  The refusal says which. */
function unfit(c: CreatureState): string | null {
  const o = activeOwned(c);
  if (!o) return 'YOU NEED A CREATURE TO FIGHT.';
  const left = restLeft(o);
  if (!left) return null;
  const m = Math.floor(left / 60_000);
  const sec = Math.ceil((left % 60_000) / 1000);
  return `${creatureById(o.id)!.name.toUpperCase()} IS RESTING (${m}:${String(sec).padStart(2, '0')}). REVIVE IT FOR ${REVIVE_COST}, OR USE THE OTHER.`;
}

export function claimStarter(id: string): Result {
  const c = C();
  if (c.starterTaken || c.owned.length) return no('YOU HAVE ALREADY HAD YOUR FREE ONE.');
  if (!STARTERS.includes(id)) return no('THAT ONE IS NOT ON OFFER.');
  edit((s) => {
    const uid = s.nextUid++;
    s.owned.push({ uid, id, wins: 0, xp: 0 });
    s.active = uid;
    s.starterTaken = true;
  });
  return ok(`${creatureById(id)!.name.toUpperCase()} IS YOURS.`);
}

/** Pay for the pack and lay its nine cards face down.  Refused before paying, never after. */
export function openPack(rng: () => number = Math.random): Result {
  const c = C();
  if (c.battle) return no('FINISH THE BATTLE FIRST.');
  if (c.pending) return no('PICK A CARD FROM THE PACK YOU OPENED FIRST.');
  if (c.owned.length >= MAX_OWNED) return no('YOU CAN ONLY KEEP TWO. RELEASE ONE FIRST.');
  if (ledger.balance() < PACK_COST) return no(`A PACK COSTS ${PACK_COST} TOKENS.`);
  const cards = rollPack(rng);
  if (!ledger.debit(PACK_COST, 'creature')) return no(`A PACK COSTS ${PACK_COST} TOKENS.`);
  edit((s) => {
    s.pending = { cards };
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
    s.owned.push({ uid, id, wins: 0, xp: 0 });
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


// --------------------------------------------------------------- zone battle

/**
 * Who you will meet in a place this time: decided once, when you go in, and
 * remembered so the next time is somebody else.
 */
export function nextZoneFoe(biome: Biome): Creature {
  return zoneFoe(biome, C().lastFoe[biome.id] ?? null);
}

/** Pay the stake and open a zone battle.  The stake is gone from here, whatever happens. */
export function startBattle(biomeId: string, foeId?: string): Result {
  const c = C();
  if (!BIOMES.some((b) => b.id === biomeId)) return no('NO SUCH PLACE.');
  if (c.battle) return no('A BATTLE IS ALREADY ON.');
  if (c.pending) return no('PICK A CARD FROM YOUR OPEN PACK FIRST.');
  const why = unfit(c);
  if (why) return no(why);
  if (!ledger.debit(BATTLE_COST, 'creature')) return no(`A BATTLE COSTS ${BATTLE_COST} TOKENS.`);
  edit((s) => {
    s.battle = { mode: 'zone', biome: biomeId };
    if (foeId) s.lastFoe[biomeId] = foeId;
  });
  store.flush();
  return ok('FIGHT!');
}

// -------------------------------------------------------------------- ladder

/** What the ladder's next step is, if a run is on: its opponent, place and whether it is the boss. */
export function ladderStep(c = C()): { level: number; foe: Creature; biome: string; boss: boolean } | null {
  const L = c.ladder;
  if (!L) return null;
  const boss = L.level > LADDER_LEVELS;
  const foe = boss ? bossById(L.boss) : creatureById(L.foes[L.level - 1]);
  if (!foe) return null;
  return { level: L.level, foe, biome: L.places[Math.min(L.level, LADDER_LEVELS + 1) - 1], boss };
}

/**
 * PAY FOR A RUN: the entry fee, taken here and only here, once.  Refused before
 * taking anything if you cannot pay, have no creature, or a run is on.
 */
export function startLadder(rng: () => number = Math.random): Result {
  const c = C();
  if (c.ladder) return no('A LADDER RUN IS ALREADY ON. CONTINUE IT.');
  if (c.battle) return no('FINISH THE BATTLE FIRST.');
  if (c.pending) return no('PICK A CARD FROM YOUR OPEN PACK FIRST.');
  const why = unfit(c);
  if (why) return no(why);
  if (ledger.balance() < LADDER_COST) return no(`THE LADDER COSTS ${LADDER_COST} TOKENS. YOU HAVE ${ledger.balance()}.`);
  const draw = rollLadder(c.lastBoss, rng, c.bossesBeaten);
  if (!ledger.debit(LADDER_COST, 'creature')) return no(`THE LADDER COSTS ${LADDER_COST} TOKENS.`);
  edit((s) => {
    s.ladder = { level: 1, foes: draw.foes, places: draw.places, boss: draw.boss, earned: 0 };
    s.ladderRuns += 1;
  });
  store.flush();
  return ok(`PAID ${LADDER_COST} TOKENS. LEVEL 1 OF ${LADDER_LEVELS}.`);
}

/** The bell for the run's next fight.  No stake: the run is paid for. */
export function startLadderBattle(): Result {
  const c = C();
  const step = ladderStep(c);
  if (!step) return no('NO LADDER RUN IS ON.');
  if (c.battle) return no('A BATTLE IS ALREADY ON.');
  const why = unfit(c);
  if (why) return no(why);
  edit((s) => (s.battle = { mode: 'ladder', biome: step.biome, level: step.level }));
  store.flush();
  return ok(step.boss ? 'THE FINAL BOSS!' : `LEVEL ${step.level} OF ${LADDER_LEVELS}!`);
}

/** Walk away from a run: it is over, nothing is refunded, nothing is paid twice. */
export function abandonLadder(): Result {
  const c = C();
  if (!c.ladder) return no('NO LADDER RUN IS ON.');
  if (c.battle) return no('NOT IN THE MIDDLE OF A BATTLE.');
  edit((s) => {
    s.lastBoss = s.ladder?.boss ?? s.lastBoss;
    s.ladder = null;
  });
  store.flush();
  return ok('THE RUN IS OVER. THE ENTRY FEE IS NOT REFUNDED.');
}

// ---------------------------------------------------------------- settling

export interface BattleEnd extends Result {
  paid: number;
  lost?: string;
  xp?: number;
  levelUp?: number;
  /** Ladder: the level just cleared, and whether the run is now done (or over). */
  cleared?: number;
  runDone?: boolean;
  runOver?: boolean;
}

/**
 * The end of a battle.  Only one call per battle does anything: the battle
 * is closed in the same write, so a second call (a double tap, a late timer,
 * a reload) finds nothing open and pays nothing.
 */
export function finishBattle(won: boolean): BattleEnd {
  const c = C();
  const b = c.battle;
  if (!b) return { ...no('NO BATTLE IS ON.'), paid: 0 };
  const fighter = activeOwned(c);
  const name = fighter ? creatureById(fighter.id)!.name.toUpperCase() : 'YOUR CREATURE';
  // the ladder step this battle was -- and only if it still is the run's step
  const ladder = b.mode === 'ladder' && c.ladder && b.level === c.ladder.level ? c.ladder : null;
  const boss = !!ladder && ladder.level > LADDER_LEVELS;
  if (won) {
    // experience for the one that fought (none past level 3)
    const before = fighter?.xp ?? 0;
    const gain = fighter && levelOf(before) < MAX_LEVEL ? Math.min(MAX_XP - before, boss ? XP_BOSS : XP_WIN) : 0;
    const lvBefore = levelOf(before);
    const lvAfter = levelOf(before + gain);
    const prize = b.mode === 'zone' ? BATTLE_WIN : ladder ? (boss ? LADDER_BOSS_WIN : LADDER_WIN) : 0;
    const cleared = ladder?.level;
    const runDone = !!ladder && boss;
    const bossId = runDone ? ladder.boss : null;
    edit((s) => {
      s.battle = null;
      s.wins += 1;
      const f = s.owned.find((o) => o.uid === s.active);
      if (f) {
        f.wins += 1;
        f.xp = Math.min(MAX_XP, (f.xp ?? 0) + gain);
      }
      if (ladder && s.ladder) {
        s.ladder.earned += prize;
        if (runDone) {
          s.lastBoss = s.ladder.boss;
          // this boss is done with until every one of them has been beaten
          const done = [...new Set([...s.bossesBeaten, s.ladder.boss])];
          s.bossesBeaten = BOSSES.every((x) => done.includes(x.id)) ? [] : done;
          s.ladder = null;
          s.ladderClears += 1;
        } else s.ladder.level += 1;
      }
    });
    if (prize) ledger.credit(prize, 'creature');
    record('creature_win');
    // THE BOSS BADGES (log #42): 3, 6 and every different ladder boss beaten
    // (ten bosses for now, the user's call: so not 5, 10 and 15).
    // A set, so beating the same one again adds nothing.
    if (bossId) {
      const beaten = [...new Set([...badgeSet('clash_bosses'), bossId])];
      setBadgeSet('clash_bosses', beaten);
      if (beaten.length >= 3) earnBadge('c_boss5');
      if (beaten.length >= 6) earnBadge('c_boss10');
      if (BOSSES.every((x) => beaten.includes(x.id))) earnBadge('c_boss_all');
    }
    store.flush();
    const up = lvAfter > lvBefore ? lvAfter : undefined;
    const head = prize ? `YOU WIN ${prize} TOKENS.` : 'YOU WIN.';
    return { ...ok(`${head}${up ? ` ${name} IS NOW LEVEL ${up}!` : ''}`), paid: prize, xp: gain, levelUp: up, cleared, runDone };
  }
  if (b.mode === 'ladder') {
    // THE RUN IS OVER: no refund, what it paid stays paid, and the creature
    // that fought comes home
    edit((s) => {
      s.battle = null;
      s.losses += 1;
      if (s.ladder) s.lastBoss = s.ladder.boss;
      s.ladder = null;
    });
    store.flush();
    return { ...ok(`DEFEATED. THE LADDER RUN IS OVER. ${name} LIMPS HOME.`), paid: 0, runOver: true };
  }
  edit((s) => {
    s.battle = null;
    s.losses += 1;
    // FAINTED, AND STILL YOURS (log #3): it keeps its slot and rests; the
    // other one, if it is fit, steps into the ring
    const f = s.owned.find((o) => o.uid === s.active);
    if (f) f.faintedAt = Date.now();
    const fit = s.owned.find((o) => o.uid !== s.active && !restLeft(o));
    if (fit) s.active = fit.uid;
  });
  store.flush();
  return { ...ok(`${name} FAINTED. IT RESTS FOR ${REST_MS / 60_000} MINUTES, OR REVIVE IT FOR ${REVIVE_COST}.`), paid: 0, lost: fighter?.id };
}

/**
 * The battle closed without a result -- the page going away mid-fight, or
 * QUIT before the count reaches one.  The fighter comes home and nothing is
 * paid; a zone stake stays spent, and a ladder run ends (reloading must
 * never be a way out of a fight you were losing).
 */
export function retreat(): Result {
  const c = C();
  if (!c.battle) return no('NO BATTLE IS ON.');
  const wasLadder = c.battle.mode === 'ladder';
  edit((s) => {
    s.battle = null;
    s.losses += 1;
    if (wasLadder) {
      if (s.ladder) s.lastBoss = s.ladder.boss;
      s.ladder = null;
    }
  });
  store.flush();
  return ok(wasLadder ? 'THE BATTLE WAS LEFT. THE LADDER RUN IS OVER.' : 'THE BATTLE IS OVER.');
}
