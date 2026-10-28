/**
 * ---- BADGES.  The hard ones (log #58, #59, #83).  Achievements -- the Goals
 * card, game/life -- reward ordinary play and most players will work through
 * them; a badge is mastery, a rare stroke of luck, or a secret found.
 *
 *   STORY      what happened to you on the way through (the plot's milestones)
 *   MASTERY    one per arcade machine, each a real test of that machine's own
 *              skill (Frog Cross has three: 5, 10, 15 crossings in a run),
 *              and ARCADE MASTER for all of them
 *   CLASH      Creature Clash: 3, 6 and every different ladder boss beaten
 *   SECRET     hidden until found -- their names are ??? on the badge screen
 *
 * Kept on the profile (`GameState.badges`), with any counting a badge needs
 * across sessions in `GameState.badgeProgress`.  A badge is earned once:
 * `earnBadge` says BADGE UNLOCKED (scenes2d/BadgeToast) the first time and
 * never again.  A practice go earns nothing -- the cabinets check.
 */

import type Phaser from 'phaser';
import { store } from '../core/state';

export type BadgeKind = 'story' | 'mastery' | 'clash' | 'secret';

export interface BadgeDef {
  id: string;
  name: string;
  /** What it was for, shown once it is earned (and in the drop-down). */
  desc: string;
  /** Shown while it is locked: the requirement, or for a story badge a nudge, never the plot. */
  hint: string;
  /** Its medal's colour. */
  col: number;
  kind: BadgeKind;
}

const S = (id: string, name: string, desc: string, hint: string, col: number): BadgeDef => ({ id, name, desc, hint, col, kind: 'story' });
const M = (id: string, name: string, desc: string, col: number): BadgeDef => ({ id, name, desc, hint: desc, col, kind: 'mastery' });

export const BADGES: BadgeDef[] = [
  // ---- the story
  S('hide_seek', 'HIDE AND SEEK', 'MADE IT THROUGH THE NIGHT IN THE ARCADE.', 'STAY AFTER CLOSING.', 0x6fbb6a),
  S('not_homeless', 'NOT HOMELESS ANYMORE', 'A KEY TO A PLACE OF YOUR OWN.', 'FIND SOMEWHERE TO LIVE.', 0xd8a838),
  S('late_checkout', 'LATE CHECK-OUT', 'LEFT THE GRAND LILY BY THE ROOF.', 'NOT EVERY WAY OUT IS A DOOR.', 0x7a9ad8),
  S('most_wanted', 'MOST WANTED', 'SAW YOUR OWN FACE ON A POSTER.', 'COME BACK LATER.', 0xc83a3a),
  S('new_face', 'A NEW FACE', 'CHANGED EVERYTHING THE POSTER SHOWS.', 'HAT, COAT, SCARF, TROUSERS, SHOES, GLASSES, HAIR.', 0x7fe0d0),
  S('new_leaf', 'A FRESH START', 'MOVED INTO ROOM 213.', 'SOMEBODY OWES YOU ONE.', 0x8ac8b8),
  S('low_profile', 'LOW PROFILE', 'GOT OUT OF SIGHT WITH THE POLICE ON YOU.', 'KNOW WHEN TO DISAPPEAR.', 0x5a6a8a),
  S('good_heart', 'A CHANCE TO START OVER', 'GOT THE OLD MAN OFF THE STREET.', 'SOMEONE OUT THERE NEEDS A HAND.', 0xe8a050),
  S('justice', 'JUSTICE PREVAILS', 'ARRESTED. THE STORY ENDED IN A CELL.', 'AN ENDING.', 0x3a5aa8),
  // ---- arcade mastery: one real test per machine
  M('m_ttt', 'UNBEATABLE', 'WIN 10 MINI DUELS IN A ROW.', 0xd86a4a),
  M('m_hoops', 'FEEDING FRENZY', 'FILL CHUBBY UP IN UNDER 22 SECONDS.', 0xe8b84a),
  M('m_whack', 'WHACK MASTER', 'WHACK 90 FROGS IN ONE ROUND.', 0x8ad06a),
  M('m_bowl', 'PERFECT LANE', 'BOWL A STRIKE IN ALL THREE FRAMES.', 0x9a7ad8),
  M('m_pond', 'EAGLE EYE', 'FIND ALL SIX FROGS IN 20 SEARCHES OR FEWER.', 0x4ab8c8),
  M('m_grudge', 'GRUDGE MATCH', 'BEAT EVERY ANIMAL IN A ROW WITHOUT A LOSS.', 0xc83a3a),
  M('m_kong', 'TOP OF THE TOWER', 'CLIMB BARREL CLIMB IN UNDER 50 SECONDS.', 0xb86a2a),
  M('m_hockey', 'SHUTOUT', 'WIN AIR HOCKEY 5-0.', 0x5a9ad8),
  M('m_flood', 'HIGH AND DRY', 'ESCAPE THE FLOOD IN UNDER 55 SECONDS.', 0x3a7ab8),
  M('m_dance', 'FLAWLESS FEET', 'WIN ALL THREE DANCE OFF ROUNDS, NO MISSES.', 0xe85aa8),
  M('m_cross5', 'ROAD RUNNER', 'CROSS THE ROAD 5 TIMES IN ONE RUN.', 0x7a8a9a),
  M('m_cross10', 'ROAD WARRIOR', 'CROSS THE ROAD 10 TIMES IN ONE RUN.', 0x9aaabb),
  M('m_cross15', 'KING OF THE ROAD', 'CROSS THE ROAD 15 TIMES IN ONE RUN.', 0xc8d8e8),
  M('m_chase', 'GETAWAY DRIVER', 'GRAB $1000 IN ONE CAR CHASE.', 0x6ac86a),
  M('m_fence', 'UNTOUCHABLE', 'WIN FENCE WARS WITHOUT TAKING ANY DAMAGE.', 0x8a6a4a),
  M('m_bog', 'CLEAN SHEET', 'WIN BOG BALL BY FIVE GOALS OR MORE.', 0x5a8a3a),
  M('m_slots', 'FROGGY JACKPOT', 'LINE UP FIVE FROGGYS ON THE SLOTS.', 0xff4fa3),
  M('m_chamber', 'TEN CLEAN', 'SURVIVE TEN PULLS IN A ROW AT THE CHAMBER.', 0x5a5a6a),
  M('m_race', 'LONG SHOT', 'WIN A FROG RACE ON TEN TICKETS OR MORE.', 0xd8c84a),
  M('m_mash', 'COLOSSEUM LEGEND', 'BANK 250 IN ONE FROGSTER MASH RUN.', 0xa83a3a),
  M('m_21', 'FIVE-CARD CHARLIE', 'TWO FIVE-CARD CHARLIES IN A ROW AT FROGGY 21.', 0x2a8a5a),
  M('m_croak', 'NOWHERE TO HIDE', 'CATCH THE TADPOLE IN UNDER 15 SECONDS AT CROAKED.', 0x1f8a8a),
  M('m_wheel', 'THE BIG ONE', 'LAND 1000 OR MORE ON THE WHEEL.', 0xe8a83a),
  M('m_crane', 'CLAW OF GOLD', 'WIN A JACKPOT CAPSULE FROM A CRANE.', 0xc8a0e0),
  { id: 'm_master', name: 'ARCADE MASTER', desc: 'EARN EVERY ARCADE MASTERY BADGE.', hint: 'EARN EVERY ARCADE MASTERY BADGE.', col: 0xffd45e, kind: 'mastery' },
  // ---- creature clash
  { id: 'c_boss5', name: 'BOSS HUNTER', desc: 'BEAT 3 DIFFERENT LADDER BOSSES.', hint: 'BEAT 3 DIFFERENT LADDER BOSSES.', col: 0x8a5ad8, kind: 'clash' },
  { id: 'c_boss10', name: 'BOSS SLAYER', desc: 'BEAT 6 DIFFERENT LADDER BOSSES.', hint: 'BEAT 6 DIFFERENT LADDER BOSSES.', col: 0xa85ad8, kind: 'clash' },
  { id: 'c_story', name: 'WORLD WALKER', desc: 'BEAT ALL FIVE STORY WORLDS IN CREATURE CLASH.', hint: 'BEAT THE BOSS OF EVERY STORY WORLD.', col: 0x5ac88a, kind: 'clash' },
  { id: 'c_boss_all', name: 'BANE OF BOSSES', desc: 'BEAT EVERY LADDER BOSS THERE IS.', hint: 'BEAT EVERY LADDER BOSS THERE IS.', col: 0xd85ac8, kind: 'clash' },
  // ---- secrets: ??? until found
  { id: 's_lazy', name: 'LAZY HIDING', desc: 'HID IN ONE SPOT FOR A WHOLE ROUND OF HIDE AND SEEK.', hint: 'A SECRET.', col: 0x6a8a5a, kind: 'secret' },
  { id: 's_404', name: 'ERROR FROG-04', desc: 'SAW SOMETHING IN WHACK-A-FROG THAT WAS NOT A FROG.', hint: 'A SECRET.', col: 0x40404a, kind: 'secret' },
  { id: 's_alley', name: 'OFF THE MAP', desc: 'WALKED DOWN EVERY ONE OF THE SIDE ALLEYS.', hint: 'A SECRET.', col: 0x4a5a6a, kind: 'secret' },
  { id: 's_roof', name: 'UP ON THE ROOF', desc: 'FOUND THE WAY OUT ON TO THE ROOF FROM THE STAIRS.', hint: 'A SECRET.', col: 0x2a3a6a, kind: 'secret' },
];

/** The arcade mastery badges ARCADE MASTER asks for (every mastery badge but itself). */
export const MASTERY = BADGES.filter((b) => b.kind === 'mastery' && b.id !== 'm_master').map((b) => b.id);

export const badgeById = (id: string): BadgeDef | undefined => BADGES.find((b) => b.id === id);

export const hasBadge = (id: string): boolean => store.get().badges.includes(id);

/** Where the drop-down goes: set once the game exists (core/sceneManager). */
let toaster: ((b: BadgeDef) => void) | null = null;
export function setBadgeToaster(fn: (b: BadgeDef) => void): void {
  toaster = fn;
}

/**
 * Earn a badge (once).  Saved at once, and the drop-down says BADGE UNLOCKED.
 * Returns whether it was new.  (`_scene` is kept for the older callers: the
 * drop-down is a scene of its own now and needs nobody's.)
 */
export function earnBadge(id: string, _scene?: Phaser.Scene): boolean {
  const def = badgeById(id);
  if (!def || hasBadge(id)) return false;
  store.patch({ badges: [...store.get().badges, id] });
  store.flush();
  toaster?.(def);
  // every mastery badge, and the crown that goes with them
  if (def.kind === 'mastery' && id !== 'm_master' && MASTERY.every((m) => store.get().badges.includes(m))) earnBadge('m_master');
  return true;
}

/** A count a badge keeps across sessions (badgeProgress). */
export function badgeCount(key: string): number {
  const v = store.get().badgeProgress?.[key];
  return typeof v === 'number' ? v : 0;
}

export function setBadgeCount(key: string, n: number): void {
  store.patch({ badgeProgress: { ...(store.get().badgeProgress ?? {}), [key]: n } });
  store.flush();
}

/** A set a badge keeps across sessions (badgeProgress), as a list of ids. */
export function badgeSet(key: string): string[] {
  const v = store.get().badgeProgress?.[key];
  return Array.isArray(v) ? (v as string[]) : [];
}

export function setBadgeSet(key: string, ids: string[]): void {
  store.patch({ badgeProgress: { ...(store.get().badgeProgress ?? {}), [key]: [...new Set(ids)] } });
  store.flush();
}

/**
 * ---- THE RECORD-SHAPED ONES.  Most cabinets' mastery is a line on the same
 * number their best is kept in (core/records): a time under a mark, a score
 * over one.  The shell asks here with every record offered.
 */
const ON_RECORD: Partial<Record<string, { badge: string; lower: boolean; at: number }>> = {
  tictactoe: { badge: 'm_ttt', lower: false, at: 10 },
  hoops: { badge: 'm_hoops', lower: true, at: 22 },
  whack: { badge: 'm_whack', lower: false, at: 90 },
  bowling: { badge: 'm_bowl', lower: false, at: 45 },
  battleship: { badge: 'm_pond', lower: true, at: 21 },
  donkeykong: { badge: 'm_kong', lower: true, at: 50 },
  airhockey: { badge: 'm_hockey', lower: false, at: 5 },
  fallingblocks: { badge: 'm_flood', lower: true, at: 55 },
  carchase: { badge: 'm_chase', lower: false, at: 1000 },
  bogball: { badge: 'm_bog', lower: false, at: 5 },
  roulette: { badge: 'm_chamber', lower: false, at: 10 },
  frograce: { badge: 'm_race', lower: false, at: 200 },
  frogstermash: { badge: 'm_mash', lower: false, at: 250 },
  wheel: { badge: 'm_wheel', lower: false, at: 1000 },
  croaked: { badge: 'm_croak', lower: true, at: 15 },
};

export function badgeOnRecord(game: string, value: number): void {
  const r = ON_RECORD[game];
  if (!r || !Number.isFinite(value)) return;
  if (r.lower ? value > 0 && value < r.at : value >= r.at) earnBadge(r.badge);
}
