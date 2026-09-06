/**
 * Game state store.  PRD §6.1 / QFD A3 (rank #2, 7.2%).
 *
 * Two localStorage namespaces so the 15-second reset can wipe the run and keep
 * the settings (PRD ST-5, QFD FMEA #11).
 */

export type Route = 'normal' | 'ejected' | 'basement' | 'chase' | 'ended';

export type GameId =
  | 'tictactoe'
  | 'snakes'
  | 'airhockey'
  | 'hoops'
  | 'whack'
  | 'chompman'
  | 'grudge';

export interface Settings {
  master: number; // 0..100
  music: number; // 0..100
  sfx: number; // 0..100
}

export interface GameState {
  schemaVersion: 1;
  tokens: number;
  charityUsed: boolean;
  prizesOwned: string[];
  gamesPlayed: Record<GameId, number>;
  route: Route;
  hasKey: boolean;
  seenIntro: boolean;
  settings: Settings;
}

const RUN_KEY = 'froggy.run';
const PREFS_KEY = 'froggy.prefs';
const SCHEMA_VERSION = 1;
const FLUSH_DEBOUNCE_MS = 250; // PRD ST-2

/**
 * Only the token ledger may write `tokens`.  PRD TK-5 / QFD FMEA #3.
 * Handing the setter a symbol nobody else imports is a cheap runtime lint.
 */
export const LEDGER_KEY: unique symbol = Symbol('ledger');

function defaultState(): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    tokens: 0,
    charityUsed: false,
    prizesOwned: [],
    gamesPlayed: {
      tictactoe: 0,
      snakes: 0,
      airhockey: 0,
      hoops: 0,
      whack: 0,
      chompman: 0,
      grudge: 0,
    },
    route: 'normal',
    hasKey: false,
    seenIntro: false,
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

    try {
      const rawRun = localStorage.getItem(RUN_KEY);
      if (rawRun) {
        const run = JSON.parse(rawRun) as Partial<GameState>;
        if (run.schemaVersion === SCHEMA_VERSION) {
          Object.assign(fresh, run, { settings: fresh.settings });
          fresh.gamesPlayed = { ...defaultState().gamesPlayed, ...(run.gamesPlayed ?? {}) };
          fresh.tokens = Math.max(0, Math.floor(run.tokens ?? 0));
          fresh.prizesOwned = Array.isArray(run.prizesOwned) ? run.prizesOwned : [];
        } else {
          console.warn('[state] schema mismatch — discarding run, keeping prefs');
          localStorage.removeItem(RUN_KEY);
        }
      }
    } catch {
      console.warn('[state] corrupt run state — starting fresh');
      try {
        localStorage.removeItem(RUN_KEY);
      } catch {
        /* private mode, nothing to do */
      }
    }

    this.state = fresh;
  }

  get(): Readonly<GameState> {
    return this.state;
  }

  /** Any field except tokens and settings.  PRD ST-1. */
  patch(partial: Partial<Patchable>): void {
    Object.assign(this.state, partial);
    this.touch();
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

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private touch(): void {
    for (const fn of this.listeners) fn(this.state);
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
      localStorage.setItem(RUN_KEY, JSON.stringify(run));
      localStorage.setItem(PREFS_KEY, JSON.stringify(settings));
    } catch {
      // Private browsing / storage disabled.  The game still plays, it just forgets.
    }
  }

  /** PRD §7.17 / AC-9: wipe the run, keep the prefs. */
  resetRun(): void {
    const settings = { ...this.state.settings };
    this.state = defaultState();
    this.state.settings = settings;
    try {
      localStorage.removeItem(RUN_KEY);
    } catch {
      /* ignore */
    }
    this.flush();
    for (const fn of this.listeners) fn(this.state);
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

export const store = new Store();
