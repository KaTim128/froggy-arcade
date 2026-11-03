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
 *   STORY MODE   five worlds in order (game/creatureStory), four battles and
 *                a boss each, at the world's levels.  World N's fights cost
 *                2N and pay 4N until its boss falls, then N and 2N as
 *                replays.  A loss FAINTS the fighter: it keeps its slot --
 *                a creature is never taken off your team for losing -- and
 *                REVIVE puts it back on its feet, free, no waiting (user,
 *                31 Oct).  A loss still earns a little experience.
 *                (It replaced the zone battles: user, 28 Oct.)
 *
 *   LADDER        Opens once the story's last boss falls.  20 tokens, once,
 *                 for a run: Level 1 to Level 5, one normal creature each,
 *                 then a boss.  Beat the boss and the run pays 100 (C3: 80
 *                 up on the entry); the levels on the way pay
 *                 nothing.  Lose a fight and the run is over: no refund, no
 *                 prize, and your creature limps home (the fee is the price).
 *                 A new run is a new 20.  The two modes share nothing but
 *                 your creatures.
 */

import { cfgNum, cfgPct, cfgStr } from '../core/gameConfig';
import { store, type GameState } from '../core/state';
import { ledger } from '../core/ledger';
import {
  BATTLE_COST, BATTLE_WIN, BIOMES, LADDER_BOSS_WIN, LADDER_COST, LADDER_LEVELS, LADDER_WIN, MAX_OWNED, STARTERS,
  BOSSES, bossById, creatureById, rollLadder, rollPack, zoneFoe, type Biome, type Creature,
} from './creatures';
import type { CreatureState, Owned } from './creatureState';
import { record } from './life';
import { badgeSet, earnBadge, setBadgeSet } from './badges';
import { MAX_LEVEL, MAX_XP, battleXp, levelOf, withLevel } from './creatureLevel';
import { STAGES, WORLDS, lineupFoe, stageLevel, storyPrice } from './creatureStory';

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

/**
 * A fainted creature stays down until it is revived: one press of REVIVE,
 * free, no timer (user, 31 Oct -- it used to rest five minutes or cost 5).
 */
export const REVIVE_COST = 0;

/** Non-zero while it is down and needs REVIVE; 0 when it is fit to fight. */
export function restLeft(o: Owned, _now = Date.now()): number {
  return o.faintedAt ? 1 : 0;
}

/** Back on its feet now. */
export function revive(uid: number): Result {
  const c = C();
  const o = c.owned.find((x) => x.uid === uid);
  if (!o) return no('NOT YOURS.');
  if (!restLeft(o)) return no('IT IS READY TO FIGHT.');
  if (REVIVE_COST && !ledger.debit(REVIVE_COST, 'creature')) return no(`REVIVING COSTS ${REVIVE_COST} TOKENS.`);
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
  if (!restLeft(o)) return null;
  return `${creatureById(o.id)!.name.toUpperCase()} FAINTED. REVIVE IT, OR USE THE OTHER.`;
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
/**
 * WHAT A PACK COSTS NOW (user, 2 Nov): the first one of a run is free, every
 * one after it 50 -- both admin-set (core/gameConfig `clash.firstFree`,
 * `clash.packCost`).
 */
export function packPrice(c = C()): number {
  if (c.pulls === 0 && cfgStr('clash.firstFree') === 'yes') return 0;
  return Math.max(0, Math.round(cfgNum('clash.packCost')));
}

export function openPack(rng: () => number = Math.random): Result {
  const c = C();
  if (c.battle) return no('FINISH THE BATTLE FIRST.');
  if (c.pending) return no('PICK A CARD FROM THE PACK YOU OPENED FIRST.');
  if (c.owned.length >= MAX_OWNED) return no('YOU CAN ONLY KEEP TWO. RELEASE ONE FIRST.');
  const price = packPrice(c);
  if (ledger.balance() < price) return no(`A PACK COSTS ${price} TOKENS.`);
  const cards = rollPack(rng);
  // (the admin's test zone: the creature asked for is in every pack)
  const want = cfgStr('clash.recruit');
  if (want !== 'none' && creatureById(want) && !cards.includes(want)) cards[0] = want;
  if (price > 0 && !ledger.debit(price, 'creature')) return no(`A PACK COSTS ${price} TOKENS.`);
  edit((s) => {
    s.pending = { cards };
    s.pulls += 1;
  });
  store.flush();
  return ok(price ? 'PICK ONE CARD.' : 'YOUR FIRST ONE IS FREE. PICK ONE CARD.');
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

// ---------------------------------------------------------------- story mode

/** Whether world `w` (0-based) is open: the first always, each next once the one before is beaten. */
export const worldOpen = (w: number, c = C()): boolean => w >= 0 && w < WORLDS.length && w <= c.story.cleared;
/** Whether every fight in world `w` is beaten: the whole trail is a replay. */
export const isReplay = (w: number, c = C()): boolean => (c.story.best[w] ?? 0) >= STAGES + 1;

/** Where a world's trail is: how many of its five fights are beaten (0..5). */
export const storyBest = (w: number, c = C()): number => (worldOpen(w, c) ? c.story.best[w] ?? 0 : 0);

/**
 * A node of world `w`'s trail: `done` beaten (it can be replayed), `next`
 * the one to beat, `locked` past it -- or the whole world shut.
 */
export function nodeState(w: number, node: number, c = C()): 'done' | 'next' | 'locked' {
  if (!worldOpen(w, c)) return 'locked';
  const best = storyBest(w, c);
  return node < best ? 'done' : node === best ? 'next' : 'locked';
}

/** The node a world's trail opens on: the next to beat, or the boss once all are. */
export const trailNode = (w: number, c = C()): number => Math.min(STAGES, storyBest(w, c));

/**
 * PAY FOR A FIGHT ON WORLD `w`'s TRAIL: node 0..3 its battles, 4 its boss --
 * the next unbeaten one at the full price, or one already beaten again, as
 * a replay, at the replay price (for the experience; it moves nothing on).
 * Who you meet is fixed by the node and kept with the battle, so a reload
 * cannot change it.  Refused before paying, never after.
 */
export function startStory(w: number, node?: number): Result {
  const c = C();
  if (!worldOpen(w, c)) return no(`BEAT ${WORLDS[Math.max(0, w - 1)].bossName} TO OPEN ${WORLDS[w]?.name ?? 'THAT WORLD'}.`);
  if (c.battle) return no('A BATTLE IS ALREADY ON.');
  if (c.pending) return no('PICK A CARD FROM YOUR OPEN PACK FIRST.');
  const why = unfit(c);
  if (why) return no(why);
  const stage = typeof node === 'number' && Number.isInteger(node) ? node : trailNode(w, c);
  if (stage < 0 || stage > STAGES) return no('NO SUCH FIGHT.');
  const state = nodeState(w, stage, c);
  if (state === 'locked') return no('BEAT THE ONE BEFORE IT FIRST.');
  const replay = state === 'done';
  const { cost } = storyPrice(w, replay);
  if (ledger.balance() < cost) return no(`THIS FIGHT COSTS ${cost} TOKENS.`);
  const world = WORLDS[w];
  const foe = stage >= STAGES ? world.boss : lineupFoe(w, stage);
  if (!ledger.debit(cost, 'creature')) return no(`THIS FIGHT COSTS ${cost} TOKENS.`);
  edit((s) => {
    s.battle = { mode: 'story', biome: world.biome, world: w, stage, foe, ...(replay ? { replay: true } : {}) };
    if (stage < STAGES) s.lastFoe[world.id] = foe;
  });
  store.flush();
  const tag = replay ? 'REPLAY: ' : '';
  return ok(stage >= STAGES ? `${tag}${world.bossName}!` : `${tag}BATTLE ${stage + 1} OF ${STAGES}!`);
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
  // (B7: the ladder opens after the story's final boss)
  if (c.story.cleared < WORLDS.length) return no(`THE LADDER OPENS WHEN ${WORLDS[WORLDS.length - 1].bossName} FALLS.`);
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
  /** Story: this win beat a world's boss for the first time, and opened the next. */
  worldOpened?: boolean;
  /** The foe's level less yours (what the experience was scaled by), and whether it was a replay. */
  xpGap?: number;
  replay?: boolean;
}

/**
 * The end of a battle.  Only one call per battle does anything: the battle
 * is closed in the same write, so a second call (a double tap, a late timer,
 * a reload) finds nothing open and pays nothing.
 */
export function finishBattle(won: boolean, foeLevel?: number): BattleEnd {
  const c = C();
  const b = c.battle;
  if (!b) return { ...no('NO BATTLE IS ON.'), paid: 0 };
  const fighter = activeOwned(c);
  const name = fighter ? creatureById(fighter.id)!.name.toUpperCase() : 'YOUR CREATURE';
  // the ladder step this battle was -- and only if it still is the run's step
  const ladder = b.mode === 'ladder' && c.ladder && b.level === c.ladder.level ? c.ladder : null;
  // the story stage this battle was -- and only if it still is that world's next
  // (a replay is always settled as one -- it moves nothing on; a first go
  // only if it is still that world's next fight)
  const storyAt = b.mode === 'story' && b.world !== undefined ? { w: b.world, stage: b.stage ?? 0 } : null;
  const replayed = !!storyAt && b.replay === true;
  const story = storyAt && (replayed || (c.story.best[storyAt.w] ?? 0) === storyAt.stage) ? storyAt : null;
  const advance = !!story && !replayed;
  const storyBoss = !!story && story.stage >= STAGES;
  const boss = (!!ladder && ladder.level > LADDER_LEVELS) || storyBoss;
  // HOW MUCH IT LEARNT: by the gap between its level and the foe's (see
  // battleXp) -- the story's foes at their stage's level, a zone's matched
  // to yours (never more than one above), the ladder's as even.
  const myLv = levelOf(fighter?.xp ?? 0);
  const foeLv = storyAt ? stageLevel(storyAt.w, storyAt.stage) : b.mode === 'zone' ? Math.max(1, Math.min(myLv + 1, Math.round(foeLevel ?? myLv))) : myLv;
  if (won) {
    const before = fighter?.xp ?? 0;
    const gain = fighter && levelOf(before) < MAX_LEVEL ? Math.min(MAX_XP - before, Math.round(battleXp(myLv, foeLv, { boss, won: true }) * cfgPct('clash.xp'))) : 0;
    const lvBefore = levelOf(before);
    const lvAfter = levelOf(before + gain);
    const prize = b.mode === 'zone' ? BATTLE_WIN : ladder ? (boss ? LADDER_BOSS_WIN : LADDER_WIN) : story ? storyPrice(story.w, replayed).win : 0;
    // a world's boss beaten for the first time opens the next (and the last opens the ladder)
    const opens = advance && storyBoss && story!.w === c.story.cleared;
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
      if (advance && story) {
        s.story.best[story.w] = Math.min(STAGES + 1, story.stage + 1);
        s.story.stage[story.w] = Math.min(STAGES, story.stage + 1);
        if (opens) s.story.cleared = Math.min(WORLDS.length, s.story.cleared + 1);
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
    // THE STORY BADGE: every world's boss beaten
    if (opens && c.story.cleared + 1 >= WORLDS.length) earnBadge('c_story');
    store.flush();
    const up = lvAfter > lvBefore ? lvAfter : undefined;
    const head = prize ? `YOU WIN ${prize} TOKENS.` : 'YOU WIN.';
    const opened = opens ? (WORLDS[story!.w + 1] ? ` ${WORLDS[story!.w + 1].name} IS OPEN!` : ' THE STORY IS DONE - THE LADDER IS OPEN!') : '';
    return { ...ok(`${head}${up ? ` ${name} IS NOW LEVEL ${up}!` : ''}${opened}`), paid: prize, xp: gain, levelUp: up, cleared, runDone, worldOpened: opens, xpGap: foeLv - myLv, replay: replayed };
  }
  // A LOSS STILL TEACHES IT SOMETHING: a quarter of a win's experience
  const lostBefore = fighter?.xp ?? 0;
  const lostGain = fighter && levelOf(lostBefore) < MAX_LEVEL ? Math.min(MAX_XP - lostBefore, Math.max(1, Math.round(battleXp(myLv, foeLv, { boss, won: false }) * cfgPct('clash.xp')))) : 0;
  const lostUp = levelOf(lostBefore + lostGain) > levelOf(lostBefore) ? levelOf(lostBefore + lostGain) : undefined;
  if (lostGain) {
    edit((s) => {
      const f = s.owned.find((o) => o.uid === s.active);
      if (f) f.xp = Math.min(MAX_XP, (f.xp ?? 0) + lostGain);
    });
  }
  const lostXp = lostGain ? ` +${lostGain} XP.${lostUp ? ` ${name} IS NOW LEVEL ${lostUp}!` : ''}` : '';
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
    return { ...ok(`DEFEATED. THE LADDER RUN IS OVER. ${name} LIMPS HOME.${lostXp}`), paid: 0, runOver: true, xp: lostGain, levelUp: lostUp, xpGap: foeLv - myLv };
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
  return { ...ok(`${name} FAINTED. REVIVE IT ON THE TEAM SCREEN.${lostXp}`), paid: 0, lost: fighter?.id, xp: lostGain, levelUp: lostUp, xpGap: foeLv - myLv };
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
