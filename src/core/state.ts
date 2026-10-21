/**
 * Game state store.  PRD §6.1 / QFD A3 (rank #2, 7.2%).
 *
 * Two localStorage namespaces so the 15-second reset can wipe the run and keep
 * the settings (PRD ST-5, QFD FMEA #11).
 */

import { defaultLife, sanitizeLife, type LifeState } from '../game/lifeState';
import { defaultCreatures, sanitizeCreatures, type CreatureState } from '../game/creatureState';
import { isTouch } from './device';

export type Route = 'normal' | 'ejected' | 'basement' | 'hide' | 'chase' | 'ended';

export type GameId =
  | 'tictactoe'
  | 'airhockey'
  | 'hoops'
  | 'whack'
  | 'grudge'
  | 'donkeykong'
  | 'battleship'
  | 'blackjack'
  | 'slots'
  | 'roulette'
  | 'frogcross'
  | 'carchase'
  | 'bowling'
  | 'frogvslizard'
  | 'wheel'
  | 'danceoff'
  | 'fallingblocks'
  | 'frograce'
  | 'frogstermash'
  | 'bogball';

/**
 * How the thumb drives Froggy on a touch screen.  A stick is quicker once you
 * have the feel of it; a pad is what a player who grew up on a phone keyboard
 * expects, and it is the only one of the two you can use without looking.  The
 * setting is device-wide because the hand holding the phone does not change
 * between profiles.  It has no effect at all on a desktop.
 */
export type MoveStyle = 'stick' | 'pad';

export interface Settings {
  master: number; // 0..100
  music: number; // 0..100
  sfx: number; // 0..100
  moveStyle: MoveStyle;
  /** How fast the camera turns in the 3D rooms, in percent: 100 is as built. */
  lookSens: number;
  /** The same for a thumb on the look pad (touch screens), in percent. */
  camSens: number;
  /** Screen brightness, in percent: 100 is as drawn. */
  brightness: number;
  /** Graphics quality: 0 LOW, 1 MEDIUM, 2 HIGH (as built), 3 ULTRA, 4 CINEMATIC. */
  quality: number;
  /** Real-time shadows from the scene's spot and directional lights. */
  shadows: boolean;
  /** Desktop: the mouse turns the head with no button held, cursor hidden. */
  mouseLook: boolean;
}

/** Brightness slider range, in percent. */
export const BRIGHT_MIN = 50;
export const BRIGHT_MAX = 150;
const clampBright = (n: number): number => (Number.isFinite(n) ? Math.round(Math.min(BRIGHT_MAX, Math.max(BRIGHT_MIN, n))) : 100);
const clampQuality = (n: number): number => (Number.isFinite(n) ? Math.round(Math.min(4, Math.max(0, n))) : defaultQuality());
/** HIGH on a desktop (the game as built), MEDIUM on a phone. */
export const defaultQuality = (): number => (isTouch() ? 1 : 2);

/** The GENERAL tab's settings as they come out of the box. */
export const generalDefaults = (): Pick<Settings, 'lookSens' | 'camSens' | 'brightness' | 'quality' | 'shadows' | 'mouseLook'> => ({
  lookSens: 100,
  camSens: 100,
  brightness: 100,
  quality: defaultQuality(),
  shadows: false,
  mouseLook: false,
});

/** The look sensitivity slider's range, in percent. */
export const LOOK_SENS_MIN = 25;
export const LOOK_SENS_MAX = 200;
const clampSens = (n: number): number =>
  Number.isFinite(n) ? Math.round(Math.min(LOOK_SENS_MAX, Math.max(LOOK_SENS_MIN, n))) : 100;

export interface GameState {
  schemaVersion: 1;
  tokens: number;
  /**
   * Money.  A different thing entirely from tokens: tokens are the arcade's
   * scrip and buy games and prizes, cash is what the man outside pays for the
   * prizes afterwards.  Nothing converts cash back into tokens — that is the
   * whole shape of the job, and the reason the ledger does not touch this.
   */
  cash: number;
  charityUsed: boolean;
  prizesOwned: string[];
  /** Prizes already handed over to the man.  Owned and sold are different. */
  prizesSold: string[];
  /**
   * Which shelf the prize counter is showing.  0 is the opening nine; every
   * time the shelf is cleared it goes up by one and a fresh lot is generated
   * (see `prizesForWave`), so the counter never becomes a wall of OWNED.
   */
  prizeWave: number;
  gamesPlayed: Record<GameId, number>;
  /**
   * Best score per game, for the cabinets that keep one.  Part of the run, so
   * it belongs to the profile and goes with the reset.
   */
  highScores: Partial<Record<GameId, number>>;
  route: Route;
  hasKey: boolean;
  seenIntro: boolean;
  /** Which hide-and-seek room the player is in, 0-based.  Route 'hide' only. */
  hideRoom: number;
  /**
   * The night is over and it was survived.  Set once, when the player gets the
   * staff door of the dark arcade open with Froggy still in the room, and never
   * cleared except by resetting the run.
   *
   * It outlives the horror sequence on purpose: the arcade the player comes
   * back to is not the one they were thrown out of.  Froggy is not at the
   * blackjack table any more, and the man in the suit dealing in his place is
   * the only answer anyone will give about it.
   */
  froggyGone: boolean;
  /**
   * ---- THE KEY THAT WAS LOST, AND WHAT BECAME OF IT.
   *
   * `hasKey` says the player is carrying it.  These two say what happened
   * after that, and they are separate on purpose: handing it back and being
   * paid for it are two events, and a reward that can be claimed twice is a
   * reward claimed off a single flag.
   */
  keyReturned: boolean;
  keyRewardClaimed: boolean;
  /**
   * He stood outside the glass once, after the change machine, and was gone
   * when the picture came back.  Once a run: a thing that happens every time
   * you buy tokens is a mechanic, not an apparition.
   */
  sawApparition: boolean;
  /**
   * The two people who will not believe you, and whether you have asked them.
   * Each question is asked once a run: after that the counter goes straight
   * to the key, and the dealer goes back to dealing.
   */
  staffAskedFroggy: boolean;
  dealerAskedFroggy: boolean;
  /**
   * Seconds this profile has been played, with the game open and in front of
   * the player.  It belongs to the profile rather than the run: resetting the
   * run does not give anyone their afternoon back.
   */
  playSeconds: number;
  /**
   * ---- THE POCKETS.  Three slots of things carried in the hand -- crane
   * prizes, and the camera once it is bought -- as item ids (see
   * `game/inventory.ts`).  The counter's prizes go in the bag as they always
   * did (`prizesOwned`); these are what fills a hand.
   */
  items: string[];
  /**
   * ---- WHAT TIME IT IS OUTSIDE, after the night in the arcade.
   *
   * 'day' until the job is nearly done; 'evening' once the player has more
   * than six hundred tokens and steps out after surviving him; 'midnight'
   * once the man has their prizes and there is money for a room -- the
   * arcade shut, the man gone, and the road to the hotel the only way on.
   */
  timeOfDay: 'day' | 'evening' | 'midnight';
  /** Through the hotel's front doors, which is the only safe place there is. */
  reachedHotel: boolean;
  /** Paid for a room and given a key. */
  checkedIn: boolean;
  /** Gone to bed in 612: the night picks up again at 3 AM, at the knocking. */
  hotelNight: boolean;
  /**
   * ---- AFTER THE HOTEL.  'police': out of the storage room alive, and the
   * police outside -- the run comes back to the lobby with them there.
   * 'escape': out through the broken window of 612, onto the roofs -- it
   * comes back at the start of the rooftop run.  'escaped': away, and the
   * hotel left wrecked, taped off and watched.
   */
  hotelAfter: 'none' | 'police' | 'escape' | 'escaped';
  /**
   * ---- TWO WEEKS LATER.  'back': over the roofs and away, and two weeks
   * gone -- the player is outside the arcade again, their face on the wall,
   * and the man has not yet had his word.  'live': he has (the $200, room
   * 213, the police on the streets): the rest of the game is played here.
   */
  arc: 'none' | 'back' | 'live';
  /**
   * ---- THE STEALTH PHASE.  Once the man has had his word, your face is the
   * one on the poster: patrols are out on every street until you have had
   * a new cut or colour at Sharp's (`disguised`).  `wantedOutfit` is what
   * you had on when the poster went up -- the poster keeps that face.
   * `hudShown`: the full purse and clock have been brought back, outside the
   * arcade, once the look was changed.
   */
  disguised: boolean;
  wantedOutfit: Record<string, string> | null;
  hudShown: boolean;
  /**
   * ---- BADGES.  The story's milestones, by id (game/badges).  The
   * profile's, like `playSeconds`: a reset of the run keeps them, deleting
   * the profile loses them.
   */
  badges: string[];
  /**
   * ---- ARRESTED.  The run ended in a cell: the profile is locked for good
   * and can never be resumed (its badges can still be looked at).
   */
  jailed: boolean;
  /**
   * ---- THE CRANES' GLASS, as it was left.  Every toy where it lay, keyed by
   * machine, and the real day the heap was tipped in: the heap is only
   * refilled on a new day, or once the machine is empty.
   */
  cranes: Record<string, CraneSave>;
  /**
   * ---- LIVING HERE: the clock, rent, food and water, the condo, clothes,
   * goals.  Versioned on its own and only written through game/life.ts.
   */
  life: LifeState;
  /** Creature Clash (the fourth room): owned creatures, open pack, open battle.  Only written through game/creatureClash.ts. */
  creatures: CreatureState;
  /**
   * ---- WHERE THE PLAYER IS STANDING.  The walkable scene they were last in,
   * what it was entered with, and their spot and facing in it -- so a run
   * picks up in the shop, the condo or the street it was left in, not at the
   * arcade door.  Written by game/place.ts, read by core/resume.ts.
   */
  place: SavedPlace | null;
  settings: Settings;
}

export interface SavedPlace {
  key: string;
  data?: Record<string, string | number | boolean>;
  x: number;
  y: number;
  /** 1 facing right, -1 facing left. */
  facing: number;
  /** Real time it was written, for telling a newer save from an older one. */
  at: number;
}

/** One toy in a crane, as saved: what it is, where it lies, how it was drawn. */
export interface SavedToy {
  id: string;
  /** Texture kind: a plush kind ('bear') or 'capsule-N'. */
  look: string;
  x: number;
  z: number;
  lift: number;
  size: number;
  tilt: number;
  flip: boolean;
  /** Knocked over by the claw, degrees. */
  lean: number;
}
export interface CraneSave {
  day: string;
  toys: SavedToy[];
}

/**
 * Runs live one-per-profile under `froggy.run.<id>`; `froggy.run` is where the
 * single unnamed run used to live and is migrated on first load.  Settings are
 * device-wide and deliberately outside all of it.
 */
const RUN_PREFIX = 'froggy.run.';
const LEGACY_RUN_KEY = 'froggy.run';
const SLOTS_KEY = 'froggy.slots';
const PREFS_KEY = 'froggy.prefs';
const SCHEMA_VERSION = 1;
const FLUSH_DEBOUNCE_MS = 250; // PRD ST-2
/** The player's spot is written at most this often while they walk. */
const PLACE_FLUSH_MS = 2000;

export const MAX_SLOTS = 3;
// (13: room for any of the passwords below, and for the names already saved at it)
export const MAX_NAME_LEN = 13;

export interface SlotMeta {
  id: string;
  name: string;
  createdAt: number;
}

/** What the profile picker shows for a slot without making it active. */
export interface SlotSummary {
  tokens: number;
  route: Route;
  seenIntro: boolean;
  prizes: number;
  played: number;
  /** Seconds played on this profile. */
  playSeconds: number;
  /** Arrested: the profile is locked and cannot be resumed. */
  jailed: boolean;
  badges: number;
}

interface SlotIndex {
  active: string | null;
  slots: SlotMeta[];
}

/**
 * Only the token ledger may write `tokens`.  PRD TK-5 / QFD FMEA #3.
 * Handing the setter a symbol nobody else imports is a cheap runtime lint.
 */
export const LEDGER_KEY: unique symbol = Symbol('ledger');

/**
 * Name a run this and it never runs out of tokens.
 *
 * Stored as the profile name like any other and compared CASE-INSENSITIVELY,
 * so "addmin128" works as well as "ADDMIN128" — names keep their case now, and
 * a cheat that depended on the shift key would be a cheat nobody could type.
 * Spacing still matters: "ADDMIN 128" is a different name and an ordinary
 * run, which is deliberate, a cheat with fuzzy edges is one people trip over
 * by accident.  The ledger is what honours it (see TokenLedger.debit); this is
 * only the password.
 */
export const ADMIN_NAME = 'ADDMIN128';
/** What the HUD shows for such a run.  It never moves. */
export const ADMIN_TOKENS = 9999;
/**
 * Name a run this and it opens in the arcade, in three dimensions.
 *
 * The 3D arcade is the last room of the night and everything in front of it is
 * about forty minutes of play: the intro, the floor, going broke, the bust, the
 * alley, the basement and three rooms of hide and seek.  Nobody can look at a
 * counter they moved by two metres if the only way back to it is all of that
 * again, so this is the door into it.
 *
 * It is the same kind of password as ADMIN_NAME and follows the same rules:
 * stored as an ordinary profile name, compared CASE-INSENSITIVELY so "testt128"
 * and "TESTT128" both work, and matched WHOLE — "TESTT 128" and "TESTT1280" are
 * ordinary runs, because a cheat with fuzzy edges is one people trip over by
 * accident.  ProfileModal is what honours it; this is only the password.
 */
export const TEST_NAME = 'TESTT128';

/**
 * Name a run this and it opens on the first round of hide and seek: the
 * briefing in the first room, with everything before it (the floor, the
 * alley, the basement and the key) already behind you.  Same rules as
 * TEST_NAME: case-insensitive, whole name only.
 */
export const HORROR_NAME = 'HNS128';

/**
 * Name a run this and it opens on the dark street at midnight, the road to the
 * hotel, with tokens AND cash that never run out.  Same rules as the others:
 * case-insensitive, whole name only.
 */
export const DARK_NAME = 'DARKSTREET128';
/** What the purse shows for the dark-street run.  It never moves. */
export const DARK_CASH = 9999;

function defaultState(): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    tokens: 0,
    cash: 0,
    charityUsed: false,
    prizesOwned: [],
    prizesSold: [],
    prizeWave: 0,
    gamesPlayed: {
      tictactoe: 0,
      airhockey: 0,
      hoops: 0,
      whack: 0,
      grudge: 0,
      donkeykong: 0,
      battleship: 0,
      blackjack: 0,
      slots: 0,
      roulette: 0,
      frogcross: 0,
      carchase: 0,
      bowling: 0,
      frogvslizard: 0,
      wheel: 0,
      danceoff: 0,
      fallingblocks: 0,
      frograce: 0,
      frogstermash: 0,
      bogball: 0,
    },
    highScores: {},
    route: 'normal',
    hasKey: false,
    seenIntro: false,
    hideRoom: 0,
    froggyGone: false,
    keyReturned: false,
    keyRewardClaimed: false,
    sawApparition: false,
    staffAskedFroggy: false,
    dealerAskedFroggy: false,
    playSeconds: 0,
    items: [],
    timeOfDay: 'day',
    reachedHotel: false,
    checkedIn: false,
    hotelNight: false,
    hotelAfter: 'none',
    arc: 'none',
    disguised: false,
    wantedOutfit: null,
    hudShown: false,
    badges: [],
    jailed: false,
    cranes: {},
    life: defaultLife(),
    creatures: defaultCreatures(),
    place: null,
    settings: { master: 80, music: 70, sfx: 85, moveStyle: 'stick', ...generalDefaults() },
  };
}

type Listener = (s: Readonly<GameState>) => void;

/** Everything except `tokens` (ledger-only) and `settings` (setSettings). */
export type Patchable = Omit<GameState, 'tokens' | 'settings' | 'schemaVersion'>;

class Store {
  private state: GameState = defaultState();
  private listeners = new Set<Listener>();
  private flushTimer: number | null = null;
  private index: SlotIndex = { active: null, slots: [] };

  constructor() {
    this.hydrate();
  }

  /** PRD ST-3 / ST-4: corrupt or stale storage yields a fresh state, never a crash. */
  private hydrate(): void {
    const fresh = defaultState();

    try {
      const rawPrefs = localStorage.getItem(PREFS_KEY);
      if (rawPrefs) {
        const prefs = JSON.parse(rawPrefs) as Partial<Settings>;
        fresh.settings = {
          master: clamp100(prefs.master ?? fresh.settings.master),
          music: clamp100(prefs.music ?? fresh.settings.music),
          sfx: clamp100(prefs.sfx ?? fresh.settings.sfx),
          moveStyle: prefs.moveStyle === 'pad' ? 'pad' : 'stick',
          lookSens: clampSens(prefs.lookSens ?? 100),
          camSens: clampSens(prefs.camSens ?? 100),
          brightness: clampBright(prefs.brightness ?? 100),
          quality: clampQuality(prefs.quality ?? defaultQuality()),
          shadows: prefs.shadows === true,
          mouseLook: prefs.mouseLook === true,
        };
      }
    } catch {
      // Keep the default settings and carry on.
    }

    this.state = fresh;
    this.index = readIndex();
    this.migrateLegacyRun();

    if (this.index.active) {
      const run = readRun(this.index.active);
      if (run) this.applyRun(run);
      else this.index.active = null; // slot listed but its data is gone
    }
  }

  /**
   * The pre-profile save.  Adopt it as the player's first profile rather than
   * stranding a run someone was in the middle of.
   */
  private migrateLegacyRun(): void {
    if (this.index.slots.length > 0) return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(LEGACY_RUN_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    const meta: SlotMeta = { id: newSlotId(), name: 'PLAYER 1', createdAt: Date.now() };
    this.index = { active: meta.id, slots: [meta] };
    try {
      localStorage.setItem(RUN_PREFIX + meta.id, raw);
      localStorage.removeItem(LEGACY_RUN_KEY);
    } catch {
      /* ignore */
    }
    writeIndex(this.index);
  }

  private applyRun(run: Partial<GameState>): void {
    const settings = this.state.settings;
    const fresh = defaultState();
    Object.assign(fresh, run, { settings });
    fresh.gamesPlayed = { ...defaultState().gamesPlayed, ...(run.gamesPlayed ?? {}) };
    fresh.highScores = run.highScores && typeof run.highScores === 'object' ? { ...run.highScores } : {};
    fresh.tokens = Math.max(0, Math.floor(run.tokens ?? 0));
    fresh.prizesOwned = Array.isArray(run.prizesOwned) ? run.prizesOwned : [];
    fresh.prizesSold = Array.isArray(run.prizesSold) ? run.prizesSold : [];
    fresh.cash = Math.max(0, Math.floor(run.cash ?? 0));
    // A save from before the shelf restocked has no wave on it; it is on the
    // first one by definition.
    fresh.prizeWave = Math.max(0, Math.floor(run.prizeWave ?? 0));
    fresh.playSeconds = Math.max(0, Number(run.playSeconds) || 0);
    fresh.items = Array.isArray(run.items) ? run.items.filter((i) => typeof i === 'string').slice(0, 3) : [];
    fresh.hotelAfter = run.hotelAfter === 'police' || run.hotelAfter === 'escape' || run.hotelAfter === 'escaped' ? run.hotelAfter : 'none';
    fresh.arc = run.arc === 'back' || run.arc === 'live' ? run.arc : 'none';
    fresh.badges = Array.isArray(run.badges) ? [...new Set(run.badges.filter((b) => typeof b === 'string'))] : [];
    fresh.jailed = run.jailed === true;
    fresh.disguised = run.disguised === true;
    fresh.hudShown = run.hudShown === true;
    fresh.wantedOutfit = run.wantedOutfit && typeof run.wantedOutfit === 'object' ? Object.fromEntries(Object.entries(run.wantedOutfit).filter(([, v]) => typeof v === 'string')) : null;
    // (a save from before the two weeks: out over the roofs and away already
    // -- it picks up on the street outside the arcade, two weeks on)
    if (fresh.hotelAfter === 'escaped' && fresh.arc === 'none') fresh.arc = 'back';
    fresh.timeOfDay = run.timeOfDay === 'evening' || run.timeOfDay === 'midnight' ? run.timeOfDay : 'day';
    // the cranes' glass: only well-formed toys come back
    fresh.cranes = {};
    if (run.cranes && typeof run.cranes === 'object') {
      for (const [k, v] of Object.entries(run.cranes)) {
        if (!v || typeof v.day !== 'string' || !Array.isArray(v.toys)) continue;
        const toys = v.toys.filter(
          (t) => t && typeof t.id === 'string' && typeof t.look === 'string' && [t.x, t.z, t.lift, t.size, t.tilt].every((n) => Number.isFinite(n)),
        );
        fresh.cranes[k] = { day: v.day, toys: toys.map((t) => ({ ...t, flip: !!t.flip, lean: Number.isFinite(t.lean) ? t.lean : 0 })) };
      }
    }
    fresh.life = sanitizeLife((run as Partial<GameState>).life);
    fresh.creatures = sanitizeCreatures((run as Partial<GameState>).creatures);
    fresh.place = sanitizePlace((run as Partial<GameState>).place);
    // what is on disk now is this run: anything written after it is newer
    this.lastWrite = Number((run as { savedAt?: number }).savedAt) || 0;
    this.state = fresh;
    // A saved unlimited run comes back unlimited, whatever the file says.
    if (this.isAdmin()) this.state.tokens = ADMIN_TOKENS;
    if (this.isRich()) this.state.cash = DARK_CASH;
  }

  // ------------------------------------------------------------------ profiles

  listSlots(): readonly SlotMeta[] {
    return this.index.slots;
  }

  activeSlotId(): string | null {
    return this.index.active;
  }

  activeSlotName(): string | null {
    return this.index.slots.find((s) => s.id === this.index.active)?.name ?? null;
  }

  /** True when the run in play is the one that never pays for anything. */
  isAdmin(): boolean {
    const n = (this.activeSlotName() ?? '').toUpperCase();
    return n === ADMIN_NAME || n === DARK_NAME;
  }

  /** The admin run proper, which also gets the test buttons in the pause menu. */
  isTester(): boolean {
    return (this.activeSlotName() ?? '').toUpperCase() === ADMIN_NAME;
  }

  /** The dark-street run, whose cash never runs out either. */
  isRich(): boolean {
    return (this.activeSlotName() ?? '').toUpperCase() === DARK_NAME;
  }

  /** Progress for the picker, read straight from storage — never made active. */
  slotSummary(id: string): SlotSummary {
    const run = readRun(id);
    const played = run?.gamesPlayed ? Object.values(run.gamesPlayed).reduce((a, b) => a + b, 0) : 0;
    return {
      tokens: Math.max(0, Math.floor(run?.tokens ?? 0)),
      route: run?.route ?? 'normal',
      seenIntro: run?.seenIntro ?? false,
      prizes: Array.isArray(run?.prizesOwned) ? run.prizesOwned.length : 0,
      played,
      // the one in play is ahead of what is on disk by up to a flush
      playSeconds: id === this.index.active ? this.state.playSeconds : Math.max(0, Number(run?.playSeconds) || 0),
      jailed: id === this.index.active ? this.state.jailed : run?.jailed === true,
      badges: id === this.index.active ? this.state.badges.length : Array.isArray(run?.badges) ? run.badges.length : 0,
    };
  }

  /** Returns the new slot id, or null when there is no room left. */
  createSlot(name: string): string | null {
    if (this.index.slots.length >= MAX_SLOTS) return null;
    if (this.index.active) this.flush();

    const meta: SlotMeta = { id: newSlotId(), name: cleanName(name), createdAt: Date.now() };
    this.index.slots.push(meta);
    this.index.active = meta.id;
    writeIndex(this.index);

    const settings = this.state.settings;
    this.state = defaultState();
    this.state.settings = settings;
    // The unlimited run starts full rather than waiting for the first read of
    // the balance to top it up.  Written here rather than through the ledger
    // because this is the store loading its own state, not a transaction.
    if (this.isAdmin()) this.state.tokens = ADMIN_TOKENS;
    if (this.isRich()) this.state.cash = DARK_CASH;
    this.flush();
    this.emit();
    return meta.id;
  }

  selectSlot(id: string): boolean {
    if (!this.index.slots.some((s) => s.id === id)) return false;
    if (this.index.active === id) return true;

    if (this.index.active) this.flush();
    this.index.active = id;
    writeIndex(this.index);

    const run = readRun(id);
    if (run) this.applyRun(run);
    else {
      const settings = this.state.settings;
      this.state = defaultState();
      this.state.settings = settings;
      this.flush();
    }
    this.emit();
    return true;
  }

  deleteSlot(id: string): void {
    this.index.slots = this.index.slots.filter((s) => s.id !== id);
    try {
      localStorage.removeItem(RUN_PREFIX + id);
      localStorage.removeItem(`${RUN_PREFIX}${id}.backup`);
    } catch {
      /* ignore */
    }
    if (this.index.active === id) {
      this.index.active = null;
      const settings = this.state.settings;
      this.state = defaultState();
      this.state.settings = settings;
      this.emit();
    }
    writeIndex(this.index);
  }

  renameSlot(id: string, name: string): void {
    const meta = this.index.slots.find((s) => s.id === id);
    if (!meta) return;
    meta.name = cleanName(name);
    writeIndex(this.index);
  }

  get(): Readonly<GameState> {
    return this.state;
  }

  /** Any field except tokens and settings.  PRD ST-1. */
  patch(partial: Partial<Patchable>): void {
    Object.assign(this.state, partial);
    this.touch();
  }

  /**
   * Where the player is standing.  Quiet, like the play clock: it changes
   * every step, and nothing on screen draws from it, so it wakes no listener;
   * it goes out with the next write.
   */
  setPlace(p: SavedPlace | null): void {
    if (!this.index.active) return;
    this.state.place = p;
    if (this.flushTimer !== null) return;
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, PLACE_FLUSH_MS);
  }

  /**
   * Another tab wrote this profile.  Take its run if it is newer than the one
   * in play, so the tab left behind cannot write an older run over it.
   */
  adoptIfNewer(id: string): void {
    if (id !== this.index.active) return;
    const run = readRun(id);
    if (!run) return;
    const theirs = Number((run as { savedAt?: number }).savedAt) || 0;
    if (theirs <= this.lastWrite) return;
    this.lastWrite = theirs;
    this.applyRun(run);
    this.emit();
  }
  /** When this tab last wrote the run in play, or read it in. */
  private lastWrite = 0;

  /**
   * Cash in, from selling a prize.  Its own path on purpose: the ledger is the
   * only thing allowed to move tokens (PRD TK-5), and cash must never end up
   * in that pipe — no scene should be able to spend it on a game by accident.
   */
  earnCash(n: number): void {
    if (!Number.isFinite(n) || n <= 0) return;
    this.state.cash += Math.floor(n);
    this.touch();
  }

  /**
   * Cash out, into the change machine.  Returns false and moves nothing if the
   * player cannot cover it.  What comes back the other way is tokens, and that
   * half of the trade goes through the ledger like every other token in the
   * game — the two currencies never touch each other in one place.
   */
  spendCash(n: number): boolean {
    const amount = Math.floor(n);
    if (!Number.isFinite(amount) || amount <= 0 || this.state.cash < amount) return false;
    // the dark-street run pays and the purse never moves
    if (!this.isRich()) this.state.cash -= amount;
    this.touch();
    return true;
  }

  /**
   * Time played, a second or so at a time.  Quiet: nothing on screen shows it
   * live, so it does not wake every listener once a second; it is written out
   * every so often, and with everything else on the next flush.
   */
  addPlayTime(seconds: number): void {
    if (!this.index.active || !Number.isFinite(seconds) || seconds <= 0) return;
    this.state.playSeconds += seconds;
    this.sincePlayFlush += seconds;
    if (this.sincePlayFlush >= 15) {
      this.sincePlayFlush = 0;
      this.flush();
    }
  }
  private sincePlayFlush = 0;

  /** Ledger-only.  PRD TK-5. */
  setTokens(key: typeof LEDGER_KEY, value: number): void {
    if (key !== LEDGER_KEY) {
      throw new Error('tokens may only be written by the TokenLedger (PRD TK-5)');
    }
    this.state.tokens = Math.max(0, Math.floor(value));
    this.touch();
  }

  setSettings(partial: Partial<Settings>): void {
    this.state.settings = {
      master: clamp100(partial.master ?? this.state.settings.master),
      music: clamp100(partial.music ?? this.state.settings.music),
      sfx: clamp100(partial.sfx ?? this.state.settings.sfx),
      moveStyle: partial.moveStyle ?? this.state.settings.moveStyle,
      lookSens: clampSens(partial.lookSens ?? this.state.settings.lookSens),
      camSens: clampSens(partial.camSens ?? this.state.settings.camSens),
      brightness: clampBright(partial.brightness ?? this.state.settings.brightness),
      quality: clampQuality(partial.quality ?? this.state.settings.quality),
      shadows: partial.shadows ?? this.state.settings.shadows,
      mouseLook: partial.mouseLook ?? this.state.settings.mouseLook,
    };
    this.touch();
  }

  bumpGamePlayed(id: GameId): void {
    this.state.gamesPlayed[id] = (this.state.gamesPlayed[id] ?? 0) + 1;
    this.touch();
  }

  highScore(id: GameId): number {
    return this.state.highScores[id] ?? 0;
  }

  /** Record a score if it beats the best.  Returns true when it did. */
  setHighScore(id: GameId, score: number): boolean {
    const n = Math.max(0, Math.floor(score));
    if (n <= this.highScore(id)) return false;
    this.state.highScores[id] = n;
    this.touch();
    return true;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.state);
  }

  private touch(): void {
    this.emit();
    if (this.flushTimer !== null) return;
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, FLUSH_DEBOUNCE_MS);
  }

  /** PRD ST-2: scene transitions force an immediate write. */
  flush(): void {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    try {
      const { settings, ...run } = this.state;
      // Settings are device-wide, so they are written even with no profile
      // selected; the run has nowhere to go until one is.
      localStorage.setItem(PREFS_KEY, JSON.stringify(settings));
      // Only into a profile that is still on the list: storage cleared under
      // a running game (site data wiped) must not get the run written back
      // into it as an orphan.
      if (this.index.active && (localStorage.getItem(SLOTS_KEY) ?? '').includes(`"${this.index.active}"`)) {
        // Never write an older run over a newer one another tab has saved
        // since: take theirs instead (what this tab did in between is the
        // older of the two).
        const disk = readRun(this.index.active);
        const theirs = Number((disk as { savedAt?: number } | null)?.savedAt) || 0;
        if (theirs > this.lastWrite) {
          this.lastWrite = theirs;
          if (disk) {
            this.applyRun(disk);
            this.emit();
            return;
          }
        }
        this.lastWrite = Math.max(Date.now(), this.lastWrite + 1);
        localStorage.setItem(RUN_PREFIX + this.index.active, JSON.stringify({ ...run, savedAt: this.lastWrite }));
      }
    } catch {
      // Private browsing / storage disabled.  The game still plays, it just forgets.
    }
  }

  /** PRD §7.17 / AC-9: wipe the run, keep the prefs — and keep the profile. */
  resetRun(): void {
    const settings = { ...this.state.settings };
    const playSeconds = this.state.playSeconds;
    // (the profile's own: its badges, and a lock that no reset lifts)
    const badges = [...this.state.badges];
    const jailed = this.state.jailed;
    this.state = defaultState();
    this.state.settings = settings;
    this.state.playSeconds = playSeconds;
    this.state.badges = badges;
    this.state.jailed = jailed;
    this.flush();
    this.emit();
  }

  /** Debug panel only (PRD §6.9). */
  debugReplace(next: Partial<GameState>): void {
    Object.assign(this.state, next);
    this.touch();
  }
}

function sanitizePlace(p: unknown): SavedPlace | null {
  if (!p || typeof p !== 'object') return null;
  const v = p as Partial<SavedPlace>;
  if (typeof v.key !== 'string' || !Number.isFinite(v.x) || !Number.isFinite(v.y)) return null;
  const data: Record<string, string | number | boolean> = {};
  if (v.data && typeof v.data === 'object') {
    for (const [k, d] of Object.entries(v.data)) {
      if (typeof d === 'string' || typeof d === 'boolean' || (typeof d === 'number' && Number.isFinite(d))) data[k] = d;
    }
  }
  return {
    key: v.key,
    data,
    x: v.x as number,
    y: v.y as number,
    facing: v.facing === -1 ? -1 : 1,
    at: Number.isFinite(v.at) ? (v.at as number) : 0,
  };
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Letters, digits and single spaces, up to the plate's width.
 *
 * CASE IS KEPT.  It used to be forced to capitals because the rest of the
 * building shouts, but the pixel font has a full lowercase set and a player
 * who types their own name in their own case should get it back — the plate is
 * narrow, not shouty.  Everything else is still enforced: no punctuation, no
 * runs of spaces, nothing longer than the plate, and never an empty name.
 */
export function cleanName(raw: string): string {
  const s = raw
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LEN);
  return s || 'PLAYER';
}

function newSlotId(): string {
  return `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

function readIndex(): SlotIndex {
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    if (!raw) return { active: null, slots: [] };
    const parsed = JSON.parse(raw) as Partial<SlotIndex>;
    const slots = Array.isArray(parsed.slots)
      ? parsed.slots
          .filter((s): s is SlotMeta => !!s && typeof s.id === 'string' && typeof s.name === 'string')
          .slice(0, MAX_SLOTS)
      : [];
    const active = slots.some((s) => s.id === parsed.active) ? (parsed.active as string) : null;
    return { active, slots };
  } catch {
    return rebuildIndex();
  }
}

/**
 * The list of profiles is unreadable, but the runs it listed may not be: find
 * them, so they are not orphaned and then written over.  Their names went
 * with the list.
 */
function rebuildIndex(): SlotIndex {
  const slots: SlotMeta[] = [];
  try {
    for (let i = 0; i < localStorage.length && slots.length < MAX_SLOTS; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(RUN_PREFIX) || k.endsWith('.backup')) continue;
      const id = k.slice(RUN_PREFIX.length);
      if (!id) continue;
      slots.push({ id, name: `PLAYER ${slots.length + 1}`, createdAt: Date.now() });
    }
  } catch {
    /* no storage at all */
  }
  const index = { active: slots[0]?.id ?? null, slots };
  if (slots.length) writeIndex(index);
  return index;
}

function writeIndex(index: SlotIndex): void {
  try {
    localStorage.setItem(SLOTS_KEY, JSON.stringify(index));
  } catch {
    /* ignore */
  }
}

function readRun(id: string): Partial<GameState> | null {
  try {
    const raw = localStorage.getItem(RUN_PREFIX + id);
    if (!raw) return null;
    const run = JSON.parse(raw) as Partial<GameState>;
    if (!run || typeof run !== 'object' || Array.isArray(run)) throw new Error('not a run');
    // A run from another version is still the player's progress: every field
    // is checked on the way in (applyRun), so it is loaded rather than thrown
    // away, and a copy of it as it was is kept beside it.
    if (run.schemaVersion !== SCHEMA_VERSION) {
      console.warn('[state] schema mismatch — loading what can be read, keeping a copy');
      backUp(id, raw);
      run.schemaVersion = SCHEMA_VERSION;
    }
    return run;
  } catch {
    // Unreadable.  Kept to one side rather than deleted, and the profile
    // starts from nothing -- a fresh run is written over the slot only when
    // the player goes on to play it.
    console.warn('[state] corrupt run state — kept a copy, starting fresh');
    try {
      const raw = localStorage.getItem(RUN_PREFIX + id);
      if (raw) backUp(id, raw);
    } catch {
      /* private mode, nothing to do */
    }
    return null;
  }
}

/** A copy of a run that could not be loaded as it was, beside the slot. */
function backUp(id: string, raw: string): void {
  try {
    localStorage.setItem(`${RUN_PREFIX}${id}.backup`, raw);
  } catch {
    /* full or private: nothing more to be done */
  }
}

export const store = new Store();
