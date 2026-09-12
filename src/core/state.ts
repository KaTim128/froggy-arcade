/**
 * Game state store.  PRD §6.1 / QFD A3 (rank #2, 7.2%).
 *
 * Two localStorage namespaces so the 15-second reset can wipe the run and keep
 * the settings (PRD ST-5, QFD FMEA #11).
 */

export type Route = 'normal' | 'ejected' | 'basement' | 'hide' | 'chase' | 'ended';

export type GameId =
  | 'tictactoe'
  | 'snakes'
  | 'airhockey'
  | 'hoops'
  | 'whack'
  | 'chompman'
  | 'grudge'
  | 'donkeykong'
  | 'battleship'
  | 'blackjack'
  | 'slots'
  | 'roulette'
  | 'frogcross'
  | 'carchase'
  | 'bowling'
  | 'frogvslizard';

export interface Settings {
  master: number; // 0..100
  music: number; // 0..100
  sfx: number; // 0..100
}

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
  settings: Settings;
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

export const MAX_SLOTS = 3;
export const MAX_NAME_LEN = 12;

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
 * Stored as the profile name like any other and compared after cleanName, so
 * capitalisation does not matter — every name in this game is uppercased on
 * the way in.  Spacing does: "ADMIN 128" is a different name and an ordinary
 * run, which is deliberate, a cheat with fuzzy edges is one people trip over
 * by accident.  The ledger is what honours it (see TokenLedger.debit); this is
 * only the password.
 */
export const ADMIN_NAME = 'ADMIN128';
/** What the HUD shows for such a run.  It never moves. */
export const ADMIN_TOKENS = 9999;

function defaultState(): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    tokens: 0,
    cash: 0,
    charityUsed: false,
    prizesOwned: [],
    prizesSold: [],
    gamesPlayed: {
      tictactoe: 0,
      snakes: 0,
      airhockey: 0,
      hoops: 0,
      whack: 0,
      chompman: 0,
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
    },
    highScores: {},
    route: 'normal',
    hasKey: false,
    seenIntro: false,
    hideRoom: 0,
    settings: { master: 80, music: 70, sfx: 85 },
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
    this.state = fresh;
    // A saved unlimited run comes back unlimited, whatever the file says.
    if (this.isAdmin()) this.state.tokens = ADMIN_TOKENS;
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
    return this.activeSlotName() === ADMIN_NAME;
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
    this.state.cash -= amount;
    this.touch();
    return true;
  }

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
      if (this.index.active) {
        localStorage.setItem(RUN_PREFIX + this.index.active, JSON.stringify(run));
      }
    } catch {
      // Private browsing / storage disabled.  The game still plays, it just forgets.
    }
  }

  /** PRD §7.17 / AC-9: wipe the run, keep the prefs — and keep the profile. */
  resetRun(): void {
    const settings = { ...this.state.settings };
    this.state = defaultState();
    this.state.settings = settings;
    this.flush();
    this.emit();
  }

  /** Debug panel only (PRD §6.9). */
  debugReplace(next: Partial<GameState>): void {
    Object.assign(this.state, next);
    this.touch();
  }
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** The font is uppercase-friendly and the plate is narrow, so both are enforced. */
export function cleanName(raw: string): string {
  const s = raw
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
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
    return { active: null, slots: [] };
  }
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
    if (run.schemaVersion !== SCHEMA_VERSION) {
      console.warn('[state] schema mismatch — discarding run, keeping prefs');
      localStorage.removeItem(RUN_PREFIX + id);
      return null;
    }
    return run;
  } catch {
    console.warn('[state] corrupt run state — starting fresh');
    try {
      localStorage.removeItem(RUN_PREFIX + id);
    } catch {
      /* private mode, nothing to do */
    }
    return null;
  }
}

export const store = new Store();
