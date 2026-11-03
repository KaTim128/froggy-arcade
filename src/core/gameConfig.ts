/**
 * ---- THE GAME SETTINGS (admin, user 2 Nov).  Every number the admin can
 * turn -- what a cabinet costs and pays, the crane's clock and grip,
 * Creature Clash's prices, experience and creature stats, the Grudge's
 * fighters -- in one place, in LAYERS:
 *
 *   defaults   the numbers the game ships with (the code's own)
 *   live       what the admin has PUBLISHED: every player plays these
 *   test       what the admin is trying out: only the admin, and only with
 *              the TEST ZONE switched on, plays these
 *
 * A value is read through `cfg(key)`: the test layer first (admin in the
 * test zone only), then live, then the default.  Test-only settings (pick
 * the opponent, the boss, the recruit) are never read from live at all.
 *
 * WRITES ARE THE ADMIN'S ALONE.  Every function that changes a layer checks
 * `store.isAdmin()` first and refuses anyone else, and every value is
 * checked against its setting's type and range before it is kept.
 * PUBLISH refuses when live has changed since the test was begun (another
 * tab or device published in between), so one admin's publish never
 * silently overwrites another's; a log keeps the last 50 changes.
 *
 * WHERE IT IS KEPT.  This game is a static site with no server, so the
 * layers live in the browser's storage, shared by every profile on that
 * browser and kept in step between its tabs (the `storage` event).  The
 * store is one small interface (`ConfigStore`): putting a real database
 * behind it -- with the admin check made on the server -- makes published
 * settings reach every device without touching anything else here.
 */

import { store } from './state';
import { CABINETS } from '../game/content';
import { BOSSES, CREATURES } from '../game/creatures';

export type ConfigValue = number | string;

export interface Param {
  /** `game.setting`, e.g. `crane.clock`. */
  key: string;
  label: string;
  kind: 'int' | 'num' | 'choice';
  def: ConfigValue;
  min?: number;
  max?: number;
  step?: number;
  /** For a choice: [value, label]. */
  choices?: Array<[string, string]>;
  /** Only ever read in the test zone (picking an opponent is a tool, not a rule). */
  testOnly?: boolean;
  /** A word on what it does, shown under it. */
  hint?: string;
}

export interface GameSchema {
  id: string;
  title: string;
  params: Param[];
}

// ------------------------------------------------------------------ schema

/** The cabinets' own prices, as the game shipped them (read before anything changes them). */
const CAB_DEFAULTS = new Map(CABINETS.map((c) => [c.id, { cost: c.cost, reward: c.reward }]));

const GRUDGE_FOES = ['lizard', 'croc', 'gecko', 'tortoise', 'snake', 'rhino', 'monkey', 'penguin', 'wolf', 'hyena', 'lion', 'gorilla', 'chameleon', 'komodo', 'gator'];

let schemaCache: GameSchema[] | null = null;

/** Every game the admin can tune, and what in it. */
export function schemas(): GameSchema[] {
  if (schemaCache) return schemaCache;
  const out: GameSchema[] = [];
  const pct = (key: string, label: string, hint: string, testOnly = false): Param => ({ key, label, kind: 'int', def: 100, min: 25, max: 400, step: 5, hint, testOnly });
  // the cranes first, then Creature Clash and the Grudge, then every cabinet
  out.push({
    id: 'crane',
    title: 'CRANES',
    params: [
      { key: 'crane.clock', label: 'TIME LIMIT (S)', kind: 'int', def: 14, min: 5, max: 60, step: 1 },
      { key: 'crane.plushCost', label: 'PLUSH CRANE COST', kind: 'int', def: 5, min: 0, max: 100, step: 1 },
      { key: 'crane.oddityCost', label: 'ODDITY CRANE COST', kind: 'int', def: 5, min: 0, max: 100, step: 1 },
      { key: 'crane.plushGrip', label: 'PLUSH GRIP %', kind: 'int', def: 34, min: 2, max: 95, step: 1, hint: 'HOW OFTEN THE CLAW LIFTS IT' },
      { key: 'crane.oddityGrip', label: 'ODDITY GRIP %', kind: 'int', def: 80, min: 2, max: 95, step: 1 },
      { key: 'crane.plushSlip', label: 'PLUSH SLIP %', kind: 'int', def: 20, min: 0, max: 90, step: 1, hint: 'HOW OFTEN IT DROPS ON THE WAY' },
    ],
  });
  const creatureChoices: Array<[string, string]> = [['none', 'AS NORMAL'], ...CREATURES.map((c) => [c.id, c.name.toUpperCase()] as [string, string])];
  const bossChoices: Array<[string, string]> = [['none', 'AS NORMAL'], ...BOSSES.map((b) => [b.id, b.name.toUpperCase()] as [string, string])];
  out.push({
    id: 'clash',
    title: 'CREATURE CLASH',
    params: [
      { key: 'clash.packCost', label: 'RECRUIT COST', kind: 'int', def: 50, min: 0, max: 500, step: 5 },
      { key: 'clash.firstFree', label: 'FIRST RECRUIT FREE', kind: 'choice', def: 'yes', choices: [['yes', 'YES'], ['no', 'NO']] },
      pct('clash.xp', 'XP %', 'EXPERIENCE FROM EVERY FIGHT'),
      pct('clash.storyPay', 'STORY PRICES %', 'WHAT STORY FIGHTS COST AND PAY'),
      pct('clash.myHp', 'YOUR CREATURE HP %', ''),
      pct('clash.myDmg', 'YOUR CREATURE DAMAGE %', ''),
      pct('clash.mySpeed', 'YOUR CREATURE SPEED %', ''),
      pct('clash.foeHp', 'OPPONENT HP %', ''),
      pct('clash.foeDmg', 'OPPONENT DAMAGE %', ''),
      pct('clash.foeSpeed', 'OPPONENT SPEED %', ''),
      { key: 'clash.recruit', label: 'RECRUIT THIS ONE', kind: 'choice', def: 'none', choices: creatureChoices, testOnly: true, hint: 'TEST ZONE: EVERY PACK HOLDS IT' },
      { key: 'clash.foe', label: 'FIGHT THIS ONE', kind: 'choice', def: 'none', choices: creatureChoices, testOnly: true, hint: 'TEST ZONE: STORY / TRAINING FOE' },
      { key: 'clash.boss', label: 'BOSS TO BATTLE', kind: 'choice', def: 'none', choices: bossChoices, testOnly: true, hint: 'TEST ZONE: EVERY STORY BOSS' },
    ],
  });
  out.push({
    id: 'grudge',
    title: 'GRUDGE',
    params: [
      { key: 'grudge.round', label: 'ROUND TIME (S)', kind: 'int', def: 99, min: 15, max: 300, step: 5 },
      { key: 'grudge.hp', label: 'FIGHTER HP', kind: 'int', def: 100, min: 20, max: 500, step: 10 },
      pct('grudge.myPower', 'YOUR PUNCH POWER %', ''),
      pct('grudge.foePower', 'OPPONENT POWER %', ''),
      pct('grudge.foeSpeed', 'OPPONENT SPEED %', ''),
      { key: 'grudge.foe', label: 'OPPONENT', kind: 'choice', def: 'none', choices: [['none', 'RANDOM'], ...GRUDGE_FOES.map((k) => [k, k.toUpperCase()] as [string, string])], testOnly: true, hint: 'TEST ZONE: WHO YOU FIGHT' },
    ],
  });
  for (const c of CABINETS) {
    const d = CAB_DEFAULTS.get(c.id)!;
    if (out.some((g) => g.id === c.id)) continue;
    out.push({
      id: c.id,
      title: c.title,
      params: [
        { key: `${c.id}.cost`, label: 'TOKEN COST', kind: 'int', def: d.cost, min: 0, max: 500, step: 1 },
        { key: `${c.id}.reward`, label: 'WIN PAYS', kind: 'int', def: d.reward, min: 0, max: 1000, step: 1 },
      ],
    });
  }
  schemaCache = out;
  return out;
}

const paramOf = (key: string): Param | undefined => {
  for (const g of schemas()) for (const p of g.params) if (p.key === key) return p;
  return undefined;
};

/** `v` made a legal value for `p`, or null if it cannot be. */
export function validate(p: Param, v: unknown): ConfigValue | null {
  if (p.kind === 'choice') return typeof v === 'string' && p.choices!.some(([c]) => c === v) ? v : null;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const r = p.kind === 'int' ? Math.round(n) : n;
  if (p.min !== undefined && r < p.min) return null;
  if (p.max !== undefined && r > p.max) return null;
  return r;
}

// ------------------------------------------------------------------ storage

interface Layer {
  /** Bumped by every publish or restore; a test layer remembers the one it began from. */
  version: number;
  values: Record<string, ConfigValue>;
  at: number;
}
interface LogEntry {
  at: number;
  what: string;
}

/** Where the layers are kept.  The browser's storage now; a server's database later. */
export interface ConfigStore {
  read(name: 'live' | 'test' | 'zone' | 'log'): string | null;
  write(name: 'live' | 'test' | 'zone' | 'log', value: string | null): void;
}

const PREFIX = 'froggy.config.';
const browserStore: ConfigStore = {
  read: (n) => {
    try {
      return localStorage.getItem(PREFIX + n);
    } catch {
      return null;
    }
  },
  write: (n, v) => {
    try {
      if (v === null) localStorage.removeItem(PREFIX + n);
      else localStorage.setItem(PREFIX + n, v);
    } catch {
      /* storage full or blocked: the change is kept for this session only */
    }
  },
};

let backend: ConfigStore = browserStore;
/** For tests, or a real database later. */
export function useConfigStore(s: ConfigStore): void {
  backend = s;
  reload();
}

const empty = (): Layer => ({ version: 0, values: {}, at: 0 });

/** A layer read back, every value in it checked again (a hand-edited store cannot slip one in). */
function readLayer(name: 'live' | 'test'): Layer {
  try {
    const raw = backend.read(name);
    if (!raw) return empty();
    const j = JSON.parse(raw) as Partial<Layer>;
    const values: Record<string, ConfigValue> = {};
    for (const [k, v] of Object.entries(j.values ?? {})) {
      const p = paramOf(k);
      const ok = p ? validate(p, v) : null;
      if (p && ok !== null) values[k] = ok;
    }
    return { version: Math.max(0, Math.floor(Number(j.version) || 0)), values, at: Number(j.at) || 0 };
  } catch {
    return empty();
  }
}

let live: Layer = empty();
let test: Layer = empty();
let zone = false;

/** Read every layer again (another tab, a test). */
export function reloadConfig(): void {
  reload();
}

function reload(): void {
  live = readLayer('live');
  test = readLayer('test');
  zone = backend.read('zone') === '1';
  apply();
}

const listeners = new Set<() => void>();
/** Called whenever the values in play change (a publish, a test edit, the zone switched, another tab). */
export function onConfigChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function apply(): void {
  // the cabinets' prices are read straight off their definitions: set them there
  for (const c of CABINETS) {
    const cost = cfgNum(`${c.id}.cost`);
    const reward = cfgNum(`${c.id}.reward`);
    if (Number.isFinite(cost)) c.cost = cost;
    if (Number.isFinite(reward)) c.reward = reward;
  }
  for (const fn of listeners) fn();
}

function log(what: string): void {
  let all: LogEntry[] = [];
  try {
    all = JSON.parse(backend.read('log') ?? '[]') as LogEntry[];
  } catch {
    all = [];
  }
  all.push({ at: Date.now(), what });
  backend.write('log', JSON.stringify(all.slice(-50)));
}

/** The last changes, newest first. */
export function configLog(): LogEntry[] {
  try {
    return (JSON.parse(backend.read('log') ?? '[]') as LogEntry[]).slice().reverse();
  } catch {
    return [];
  }
}

// ------------------------------------------------------------------ reading

/** Whether the admin is playing the TEST values right now. */
export const inTestZone = (): boolean => zone && store.isAdmin();

/** A setting's value as it is in play for whoever is playing. */
export function cfg(key: string): ConfigValue {
  const p = paramOf(key);
  if (!p) return NaN;
  if (inTestZone() && key in test.values) return test.values[key];
  if (p.testOnly) return p.def;
  return key in live.values ? live.values[key] : p.def;
}
export const cfgNum = (key: string): number => Number(cfg(key));
/** A percentage setting as a multiplier (100 -> 1). */
export const cfgPct = (key: string): number => cfgNum(key) / 100;
export const cfgStr = (key: string): string => String(cfg(key));

/** What each layer holds for `key`, for the settings screen. */
export function layersOf(key: string): { def: ConfigValue; live: ConfigValue | undefined; test: ConfigValue | undefined } {
  const p = paramOf(key);
  return { def: p?.def ?? NaN, live: live.values[key], test: test.values[key] };
}
export const liveVersion = (): number => live.version;
export const testDirty = (): boolean => Object.keys(test.values).length > 0;

// ------------------------------------------------------------------ writing (admin only)

export interface ConfigResult {
  ok: boolean;
  msg: string;
}
const refuse = (msg: string): ConfigResult => ({ ok: false, msg });
const gate = (): ConfigResult | null => (store.isAdmin() ? null : refuse('ADMIN ONLY.'));

/** Keep `values` (a draft from the settings screen) as the test layer's for those keys. */
export function saveTest(values: Record<string, ConfigValue>): ConfigResult {
  const no = gate();
  if (no) return no;
  const next = { ...test.values };
  for (const [k, v] of Object.entries(values)) {
    const p = paramOf(k);
    if (!p) return refuse(`NO SETTING ${k}.`);
    const ok = validate(p, v);
    if (ok === null) return refuse(`${p.label}: ${p.kind === 'choice' ? 'NOT ONE OF THE CHOICES' : `MUST BE ${p.min}-${p.max}`}.`);
    // the same as what is in play already is not a change
    const base = p.testOnly ? p.def : k in live.values ? live.values[k] : p.def;
    if (ok === base) delete next[k];
    else next[k] = ok;
  }
  // a fresh test layer remembers which live it was begun from
  test = { version: Object.keys(test.values).length ? test.version : live.version, values: next, at: Date.now() };
  backend.write('test', JSON.stringify(test));
  apply();
  return { ok: true, msg: 'TEST SAVED.' };
}

/** Throw away the test changes: for one game, or all of them.  Live and player data are untouched. */
export function resetTest(gameId?: string): ConfigResult {
  const no = gate();
  if (no) return no;
  const next = { ...test.values };
  for (const k of Object.keys(next)) if (!gameId || k.startsWith(`${gameId}.`)) delete next[k];
  test = { ...test, values: next, at: Date.now() };
  backend.write('test', Object.keys(next).length ? JSON.stringify(test) : null);
  log(gameId ? `RESET TEST: ${gameId}` : 'RESET TEST: ALL');
  apply();
  return { ok: true, msg: 'TEST ZONE RESET.' };
}

/**
 * PUBLISH: every saved test value checked once more and made live, for
 * every player.  Refused if live moved on since this test was begun, or if
 * there is nothing to publish.  Test-only tools are never published.
 */
export function publish(): ConfigResult {
  const no = gate();
  if (no) return no;
  // (read again: another tab may have published since)
  live = readLayer('live');
  const pending = Object.entries(test.values).filter(([k]) => !paramOf(k)?.testOnly);
  if (!pending.length) return refuse('NOTHING TO PUBLISH.');
  if (test.version !== live.version) return refuse('LIVE CHANGED SINCE THIS TEST BEGAN. RESET THE TEST AND TRY AGAIN.');
  const values = { ...live.values };
  for (const [k, v] of pending) {
    const p = paramOf(k)!;
    const ok = validate(p, v);
    if (ok === null) return refuse(`${p.label} IS OUT OF RANGE.`);
    if (ok === p.def) delete values[k];
    else values[k] = ok;
  }
  live = { version: live.version + 1, values, at: Date.now() };
  backend.write('live', JSON.stringify(live));
  // the published keys leave the test layer; the tools stay
  const kept: Record<string, ConfigValue> = {};
  for (const [k, v] of Object.entries(test.values)) if (paramOf(k)?.testOnly) kept[k] = v;
  test = { version: live.version, values: kept, at: Date.now() };
  backend.write('test', Object.keys(kept).length ? JSON.stringify(test) : null);
  log(`PUBLISHED ${pending.length} CHANGE${pending.length === 1 ? '' : 'S'}: ${pending.map(([k, v]) => `${k}=${v}`).join(', ')}`);
  apply();
  return { ok: true, msg: `PUBLISHED ${pending.length} CHANGE${pending.length === 1 ? '' : 'S'}.` };
}

/** One game's live settings back to the defaults it shipped with.  No other game is touched. */
export function restoreDefaults(gameId: string): ConfigResult {
  const no = gate();
  if (no) return no;
  live = readLayer('live');
  const values = { ...live.values };
  let n = 0;
  for (const k of Object.keys(values))
    if (k.startsWith(`${gameId}.`)) {
      delete values[k];
      n++;
    }
  if (!n) return refuse('ALREADY ON ITS DEFAULTS.');
  live = { version: live.version + 1, values, at: Date.now() };
  backend.write('live', JSON.stringify(live));
  // (and its test values go too, and the test now begins from this live)
  resetTestFor(gameId);
  log(`RESTORED DEFAULTS: ${gameId}`);
  apply();
  return { ok: true, msg: 'DEFAULTS RESTORED.' };
}

function resetTestFor(gameId: string): void {
  const next = { ...test.values };
  for (const k of Object.keys(next)) if (k.startsWith(`${gameId}.`)) delete next[k];
  test = { version: live.version, values: next, at: Date.now() };
  backend.write('test', Object.keys(next).length ? JSON.stringify(test) : null);
}

/** The TEST ZONE: on, the admin plays the test values (and only the admin). */
export function setTestZone(on: boolean): ConfigResult {
  const no = gate();
  if (no) return no;
  zone = on;
  backend.write('zone', on ? '1' : null);
  apply();
  return { ok: true, msg: on ? 'TEST ZONE ON: YOU PLAY THE TEST SETTINGS.' : 'TEST ZONE OFF: YOU PLAY THE LIVE SETTINGS.' };
}

// another tab (or window) changed something: read it all again
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith(PREFIX)) reload();
  });
}

reload();
