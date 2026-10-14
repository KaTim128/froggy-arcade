/**
 * The life save field: its shape, its defaults, and making a saved one safe.
 * Kept apart from game/life.ts so the store can use it without importing the
 * store back (see core/state.ts).
 */

import { STARTER_COSMETICS, cosmeticById, furnitureById, type CosmeticSlot } from './catalog';

/** 2: food, water, energy, the pantry and the hob are gone. */
export const LIFE_VERSION = 2;

export interface Placement {
  uid: number;
  id: string;
  x: number;
  y: number;
  flip: boolean;
}

export interface LifeState {
  v: number;
  /** Seconds of game time since the very first morning. */
  t: number;
  rented: boolean;
  /** Game day on whose morning the next rent is due. */
  rentDue: number;
  evicted: boolean;
  /** Furniture owned, by id (count). */
  furniture: Record<string, number>;
  placed: Placement[];
  nextUid: number;
  /** Cosmetics owned, and what is on. */
  wardrobe: string[];
  outfit: Partial<Record<CosmeticSlot, string>>;
  /** Begging: since when (epoch ms), and how many payouts already made. */
  beg: { since: number; paid: number } | null;
  /** Lifetime counters, for missions and achievements. */
  stats: Record<string, number>;
  /** Daily / weekly progress: the period key and each goal's count. */
  daily: { key: string; ids: string[]; prog: Record<string, number>; claimed: string[] };
  weekly: { key: string; ids: string[]; prog: Record<string, number>; claimed: string[] };
  /** Achievements claimed, by id. */
  achieved: string[];
  /** Places seen at least once. */
  visited: string[];
  /** A warning line waiting to be shown (rent...). */
  notice: string;
}

export function defaultLife(): LifeState {
  return {
    v: LIFE_VERSION,
    t: 0,
    rented: false,
    rentDue: 0,
    evicted: false,
    furniture: {},
    placed: [],
    nextUid: 1,
    wardrobe: [...STARTER_COSMETICS],
    outfit: { top: 'cos_coat_olive', legs: 'cos_trousers_baggy', shoes: 'cos_boots_worn', scarf: 'cos_scarf_grubby', hat: 'cos_beanie' },
    beg: null,
    stats: {},
    daily: { key: '', ids: [], prog: {}, claimed: [] },
    weekly: { key: '', ids: [], prog: {}, claimed: [] },
    achieved: [],
    visited: [],
    notice: '',
  };
}

const num = (v: unknown, d: number, lo = -Infinity, hi = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
const counts = (v: unknown, valid: (id: string) => boolean): Record<string, number> => {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object') {
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      const c = Math.floor(num(n, 0, 0, 999));
      if (c > 0 && valid(k)) out[k] = c;
    }
  }
  return out;
};

/** A saved life, made safe: unknown ids dropped, numbers clamped, a missing one made fresh. */
export function sanitizeLife(raw: unknown): LifeState {
  const d = defaultLife();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<LifeState>;
  const out: LifeState = {
    v: LIFE_VERSION,
    t: num(r.t, 0, 0),
    rented: !!r.rented,
    rentDue: Math.floor(num(r.rentDue, 0, 0)),
    evicted: !!r.evicted,
    furniture: counts(r.furniture, (id) => !!furnitureById(id)),
    placed: [],
    nextUid: Math.floor(num(r.nextUid, 1, 1)),
    wardrobe: strs(r.wardrobe).filter((id) => !!cosmeticById(id)),
    outfit: {},
    beg: r.beg && Number.isFinite(r.beg.since) ? { since: r.beg.since, paid: Math.floor(num(r.beg.paid, 0, 0)) } : null,
    stats: counts(r.stats, () => true),
    daily: sanePeriod(r.daily),
    weekly: sanePeriod(r.weekly),
    achieved: strs(r.achieved),
    visited: strs(r.visited),
    notice: '',
  };
  for (const id of STARTER_COSMETICS) if (!out.wardrobe.includes(id)) out.wardrobe.push(id);
  // what is on must be owned
  const of = r.outfit && typeof r.outfit === 'object' ? (r.outfit as Record<string, string>) : {};
  for (const [slot, id] of Object.entries({ ...d.outfit, ...of })) {
    const c = cosmeticById(id as string);
    if (c && c.slot === slot && out.wardrobe.includes(c.id)) (out.outfit as Record<string, string>)[slot] = c.id;
  }
  // placements must be of owned furniture, never more than owned
  const used: Record<string, number> = {};
  for (const p of Array.isArray(r.placed) ? r.placed : []) {
    if (!p || !furnitureById(p.id)) continue;
    used[p.id] = (used[p.id] ?? 0) + 1;
    if (used[p.id] > (out.furniture[p.id] ?? 0)) continue;
    out.placed.push({ uid: Math.floor(num(p.uid, out.nextUid++)), id: p.id, x: num(p.x, 100, 0, 400), y: num(p.y, 140, 0, 200), flip: !!p.flip });
  }
  out.nextUid = Math.max(out.nextUid, ...out.placed.map((p) => p.uid + 1), 1);
  return out;
}

function sanePeriod(v: unknown): LifeState['daily'] {
  const p = (v && typeof v === 'object' ? v : {}) as Partial<LifeState['daily']>;
  return {
    key: typeof p.key === 'string' ? p.key : '',
    ids: strs(p.ids),
    prog: counts(p.prog, () => true),
    claimed: strs(p.claimed),
  };
}

