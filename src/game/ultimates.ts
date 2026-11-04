/**
 * ---- ULTIMATE ABILITIES (user, 4 Nov): one for every creature and every
 * boss, each its own.
 *
 * THE RULES.  Locked for the first 30 seconds of a battle; once it is up it
 * can be fired, and after firing it cools for 30 seconds.  The opponent plays
 * by the same clock.
 *
 * HOW EACH ONE IS ITS OWN.  An ultimate is a short sequence of EFFECTS -- a
 * charge, a nova, a rain of meteors, a shield, a drain, a clone trick -- with
 * its own numbers, built from what the creature IS:
 *
 *   the lead effect   from its combat role: melee ones close in and crash
 *                     (charge, blink, nova, frenzy, pull); shooters fill the
 *                     arena (barrage, beam, meteors, fire field); support and
 *                     tanks protect and wear down (shield, mend, drain, mire,
 *                     clones, untouchable)
 *   the follow-up     from its element: ember leaves fire, frost and volt
 *                     stop you dead, murk drains or fools you, glow pierces
 *                     or heals, moss mends or pulls, tide drags and slows,
 *                     stone shields or shakes, gale hastes or throws
 *   the finisher      from its own kit: a healer heals, a blinker blinks, a
 *                     shield-maker shields...
 *
 * and its numbers scale off its own plain attack and health.  No two have the
 * same set of effects and numbers (checked when the table is built), and each
 * has its own name.  Bosses get the same treatment with a bigger lead and an
 * extra effect.
 */

import { plainWords } from './plainWords';
import { BOSSES, CREATURES, ELEMENTS, type Creature } from './creatures';
import { roleOf } from './creatureMinis';

export const ULT_UNLOCK_S = 30;
export const ULT_COOLDOWN_S = 25;

export type UltFx =
  | { k: 'charge'; dist: number; dmg: number }
  | { k: 'blink'; dmg: number }
  | { k: 'nova'; r: number; dmg: number; knock: number }
  | { k: 'rage'; t: number }
  | { k: 'pull'; r: number; dmg: number }
  | { k: 'barrage'; n: number; dmg: number; spread: number }
  | { k: 'beam'; len: number; dmg: number; w: number }
  | { k: 'meteor'; n: number; r: number; dmg: number }
  | { k: 'zone'; n: number; r: number }
  | { k: 'shield'; t: number }
  | { k: 'heal'; frac: number }
  | { k: 'drain'; t: number; dps: number }
  | { k: 'slowfield'; r: number; t: number }
  | { k: 'clones'; n: number }
  | { k: 'invuln'; t: number }
  | { k: 'stun'; r: number; t: number }
  | { k: 'haste'; t: number };

export interface Ultimate {
  name: string;
  desc: string;
  fx: UltFx[];
  /** How close the target should be for the AI to fire it (px). */
  range: number;
}

/** A stable small number from a string, so a creature always gets the same choices. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

type K = UltFx['k'];
const LEAD: Record<'melee' | 'ranged' | 'support', K[]> = {
  melee: ['charge', 'blink', 'nova', 'rage', 'pull'],
  ranged: ['barrage', 'beam', 'meteor', 'zone'],
  support: ['shield', 'heal', 'drain', 'slowfield', 'clones', 'invuln'],
};
const BY_ELEMENT: Record<string, K[]> = {
  ember: ['zone', 'rage', 'meteor'],
  tide: ['pull', 'slowfield', 'heal'],
  moss: ['heal', 'pull', 'zone'],
  frost: ['stun', 'slowfield', 'shield'],
  volt: ['stun', 'haste', 'beam'],
  stone: ['shield', 'nova', 'stun'],
  gale: ['haste', 'nova', 'barrage'],
  murk: ['drain', 'clones', 'blink'],
  glow: ['beam', 'heal', 'invuln'],
};
/** What its own specials say it is good at. */
function fromKit(c: Creature): K[] {
  const out: K[] = [];
  for (const a of c.attacks.slice(1)) {
    if (a.kind === 'mend') out.push('heal');
    if (a.kind === 'shield') out.push('shield');
    if (a.kind === 'blink') out.push('blink');
    if (a.kind === 'dash') out.push('charge');
    if (a.kind === 'nova') out.push('nova');
    if (a.kind === 'snare') out.push('stun');
    if (a.kind === 'mine') out.push('zone');
    if (a.kind === 'aura') out.push('rage');
    if (a.kind === 'spread') out.push('barrage');
  }
  return out.length ? out : ['haste'];
}

const ADJ: Record<string, string[]> = {
  ember: ['INFERNO', 'CINDER', 'MAGMA', 'BLAZE', 'ASH', 'SCORCH', 'PYRE', 'EMBER', 'SOLAR', 'HELL'],
  tide: ['TIDAL', 'RIPTIDE', 'TSUNAMI', 'BRINE', 'UNDERTOW', 'DELUGE', 'SURF', 'ABYSS', 'CORAL', 'MAELSTROM'],
  moss: ['VERDANT', 'THORN', 'BRIAR', 'GROVE', 'ROOT', 'BLOOM', 'SPORE', 'WILD', 'BRAMBLE', 'IVY'],
  frost: ['GLACIER', 'BLIZZARD', 'RIME', 'FROST', 'WINTER', 'HAIL', 'ICE', 'POLAR', 'SLEET', 'TUNDRA'],
  volt: ['THUNDER', 'STORM', 'ARC', 'VOLT', 'SPARK', 'TESLA', 'STATIC', 'SURGE', 'PLASMA', 'BOLT'],
  stone: ['BEDROCK', 'BOULDER', 'GRANITE', 'QUAKE', 'IRON', 'CRAG', 'OBSIDIAN', 'TITAN', 'GRAVEL', 'MOUNTAIN'],
  gale: ['CYCLONE', 'TEMPEST', 'ZEPHYR', 'GALE', 'SKY', 'TWISTER', 'SQUALL', 'GUST', 'SIROCCO', 'MONSOON'],
  murk: ['SHADOW', 'VOID', 'NIGHT', 'DUSK', 'GRAVE', 'PHANTOM', 'GLOOM', 'HOLLOW', 'WRAITH', 'NIGHTMARE'],
  glow: ['RADIANT', 'PRISM', 'HALO', 'LUMEN', 'DAWN', 'AURORA', 'STAR', 'BEACON', 'SUN', 'SPECTRAL'],
};
const NOUN: Record<K, string[]> = {
  charge: ['RUSH', 'STAMPEDE', 'RAM', 'ONSLAUGHT'],
  blink: ['AMBUSH', 'STRIKE', 'PHASE', 'ASSAULT'],
  nova: ['NOVA', 'QUAKE', 'BURST', 'SHOCKWAVE'],
  rage: ['FURY', 'FRENZY', 'RAMPAGE', 'BERSERK'],
  pull: ['MAW', 'VORTEX', 'GRASP', 'CRUSH'],
  barrage: ['BARRAGE', 'VOLLEY', 'TEMPEST', 'HAILSTORM'],
  beam: ['LANCE', 'RAY', 'CANNON', 'JUDGEMENT'],
  meteor: ['METEOR', 'RAIN', 'COMET', 'ARMAGEDDON'],
  zone: ['FIELD', 'PIT', 'GROUND', 'DOMAIN'],
  shield: ['BULWARK', 'AEGIS', 'FORTRESS', 'CARAPACE'],
  heal: ['RENEWAL', 'REVIVAL', 'SANCTUARY', 'REBIRTH'],
  drain: ['FEAST', 'LEECH', 'HUNGER', 'SIPHON'],
  slowfield: ['MIRE', 'STASIS', 'SNARE', 'BIND'],
  clones: ['MIRAGE', 'LEGION', 'ECHOES', 'MASQUERADE'],
  invuln: ['SANCTUM', 'APOTHEOSIS', 'ASCENSION', 'IMMORTAL'],
  stun: ['PARALYSIS', 'LOCKDOWN', 'JUDGEMENT', 'SEAL'],
  haste: ['BLITZ', 'OVERDRIVE', 'FLURRY', 'DASH'],
};

/** One effect of kind `k`, sized off this creature. */
function make(k: K, c: Creature, h: number, big: number): UltFx {
  const base = Math.max(6, c.attacks[0].dmg);
  const v = (n: number): number => (h >>> n) % 5; // 0..4, a small personal variation
  switch (k) {
    case 'charge': return { k, dist: 90 + v(3) * 10, dmg: Math.round(base * (2.6 + v(5) * 0.15) * big) };
    case 'blink': return { k, dmg: Math.round(base * (2.4 + v(4) * 0.15) * big) };
    case 'nova': return { k, r: 34 + v(6) * 4, dmg: Math.round(base * (2 + v(7) * 0.15) * big), knock: 160 + v(8) * 30 };
    case 'rage': return { k, t: 4 + v(9) * 0.5 };
    case 'pull': return { k, r: 90 + v(10) * 10, dmg: Math.round(base * (1.2 + v(11) * 0.1) * big) };
    case 'barrage': return { k, n: Math.round((5 + v(12)) * big), dmg: Math.round(base * (0.8 + v(13) * 0.06)), spread: 0.5 + v(14) * 0.08 };
    case 'beam': return { k, len: 200 + v(15) * 15, dmg: Math.round(base * (2.4 + v(16) * 0.15) * big), w: 5 + v(17) };
    case 'meteor': return { k, n: Math.round((3 + (v(18) % 3)) * big), r: 18 + v(19) * 2, dmg: Math.round(base * (1.1 + v(20) * 0.08)) };
    case 'zone': return { k, n: 3 + (v(21) % 3), r: 12 + v(22) * 1.5 };
    case 'shield': return { k, t: 2 + v(23) * 0.4 };
    case 'heal': return { k, frac: Math.round((0.12 + v(24) * 0.015) * 100 * Math.min(1.2, big)) / 100 };
    case 'drain': return { k, t: 2.5 + v(25) * 0.4, dps: Math.round(base * (0.45 + v(26) * 0.05) * big) };
    case 'slowfield': return { k, r: 60 + v(27) * 8, t: 2 + v(28) * 0.4 };
    case 'clones': return { k, n: 2 + (v(29) % 2) };
    case 'invuln': return { k, t: 1 + v(30) * 0.2 };
    case 'stun': return { k, r: 70 + v(1) * 10, t: 0.8 + v(2) * 0.1 };
    case 'haste': return { k, t: 3 + v(0) * 0.5 };
  }
}

/** The words that say what an effect does, for the move card. */
function words(f: UltFx): string {
  switch (f.k) {
    case 'charge': return `CHARGES ${f.dist}PX THROUGH THEM FOR ${f.dmg}`;
    case 'blink': return `APPEARS BEHIND THEM AND STRIKES FOR ${f.dmg}`;
    case 'nova': return `BLAST ROUND ITSELF, ${f.r}PX: ${f.dmg} AND THROWS THEM`;
    case 'rage': return `FRENZY ${f.t}S: BIGGER, FASTER, HARDER HITS`;
    case 'pull': return `DRAGS THEM IN FROM ${f.r}PX AND CRUSHES FOR ${f.dmg}`;
    case 'barrage': return `${f.n} SHOTS IN A FAN, ${f.dmg} EACH`;
    case 'beam': return `A ${f.len}PX BEAM THROUGH COVER FOR ${f.dmg}`;
    case 'meteor': return `${f.n} STRIKES RAIN ON THEM, ${f.dmg} EACH`;
    case 'zone': return `${f.n} PATCHES OF HARMFUL GROUND ROUND THEM`;
    case 'shield': return `A SHIELD FOR ${f.t}S`;
    case 'heal': return `HEALS ${Math.round(f.frac * 100)}% OF ITS HEALTH`;
    case 'drain': return `DRAINS ${f.dps} A SECOND FOR ${f.t}S`;
    case 'slowfield': return `SLOWS THEM ${f.t}S WITHIN ${f.r}PX`;
    case 'clones': return `${f.n} DECOYS TO DRAW THEIR FIRE`;
    case 'invuln': return `UNTOUCHABLE FOR ${f.t}S`;
    case 'stun': return `STUNS THEM ${f.t}S WITHIN ${f.r}PX`;
    case 'haste': return `FASTER FOR ${f.t}S`;
  }
}

/** How close the AI waits to be before firing, by the lead effect. */
const RANGE: Record<K, number> = {
  charge: 90, blink: 200, nova: 40, rage: 70, pull: 100, barrage: 160, beam: 200, meteor: 220, zone: 200,
  shield: 60, heal: 999, drain: 120, slowfield: 70, clones: 120, invuln: 50, stun: 75, haste: 150,
};

/**
 * ---- POWERFUL, NOT A WIN BUTTON.  The damage an ultimate can expect to do
 * -- counting that half a barrage and most of a meteor rain land, and a drain
 * runs its course -- is brought to a budget: about a third of a typical
 * creature's health, half again for a boss.  What is left (shields, stuns,
 * speed, heals) is capped by its own numbers above.
 */
// (32 / 48 at first: in mirror fights the side with its ultimate ready won
// 7 of 8 -- one ultimate decided the fight.  Brought down to be an edge, not a win.)
const BUDGET = 22;
const BOSS_BUDGET = 34;
function expected(f: UltFx): number {
  switch (f.k) {
    case 'charge': case 'blink': case 'beam': return f.dmg;
    case 'nova': return f.dmg * 0.9;
    case 'pull': return f.dmg;
    case 'barrage': return f.n * f.dmg * 0.5;
    case 'meteor': return f.n * f.dmg * 0.6;
    case 'drain': return f.t * f.dps;
    case 'zone': return f.n * 4;
    default: return 0;
  }
}
function balance(fx: UltFx[], boss: boolean): UltFx[] {
  const total = fx.reduce((a, f) => a + expected(f), 0);
  const want = boss ? BOSS_BUDGET : BUDGET;
  if (total <= 0) return fx;
  const k = Math.min(1.6, want / total);
  return fx.map((f) => {
    if ('dmg' in f) return { ...f, dmg: Math.max(3, Math.round(f.dmg * k)) } as UltFx;
    if (f.k === 'drain') return { ...f, dps: Math.max(2, Math.round(f.dps * k)) };
    return f;
  });
}

let table: Map<string, Ultimate> | null = null;

/** Build every creature's and boss's ultimate, once, all different. */
function build(): Map<string, Ultimate> {
  const out = new Map<string, Ultimate>();
  const sigs = new Set<string>();
  const names = new Set<string>();
  const all: Array<{ c: Creature; boss: boolean }> = [
    ...CREATURES.map((c) => ({ c, boss: false })),
    ...BOSSES.map((b) => ({ c: b as unknown as Creature, boss: true })),
  ];
  for (const { c, boss } of all) {
    const h = hash(c.id);
    const role = boss ? (c.hp >= 380 ? 'melee' : 'ranged') : roleOf(c);
    const lead = LEAD[role];
    const el = BY_ELEMENT[c.element] ?? ['haste'];
    const kit = fromKit(c);
    const big = boss ? 1.5 : 1;
    let fx: UltFx[] = [];
    let sig = '';
    // try the creature's own combinations in turn until one nobody else has
    for (let tries = 0; tries < 60; tries++) {
      const a = lead[(h + tries) % lead.length];
      const b = el[(h >>> 3) % el.length === el.indexOf(a) ? ((h >>> 3) + 1 + tries) % el.length : ((h >>> 3) + tries) % el.length];
      const cK = kit[(h >>> 5 + tries) % kit.length];
      const kinds = [a, b, cK].filter((k, i, arr) => arr.indexOf(k) === i);
      if (boss) {
        const extra = (['meteor', 'nova', 'stun', 'zone', 'drain'] as K[]).find((k) => !kinds.includes(k));
        if (extra) kinds.push(extra);
      }
      fx = balance(kinds.map((k, i) => make(k, c, (h + tries * 7919) >>> 0, i === 0 ? big : 1)), boss);
      sig = JSON.stringify(fx);
      if (!sigs.has(sig)) break;
    }
    sigs.add(sig);
    // the name: the element's word and the lead's noun, unclaimed
    const adjs = ADJ[c.element] ?? ['GRAND'];
    const nouns = NOUN[fx[0].k];
    let name = '';
    for (let i = 0; i < adjs.length * nouns.length && (!name || names.has(name)); i++) {
      name = `${adjs[(h + i) % adjs.length]} ${nouns[((h >>> 4) + Math.floor(i / adjs.length)) % nouns.length]}`;
    }
    if (names.has(name)) name = `${c.name.toUpperCase().slice(0, 8)} ${nouns[0]}`;
    names.add(name);
    // (in TILES and SEC, as every other line of Clash text is: game/plainWords)
    const desc = plainWords(fx.map(words).join('. ') + '.');
    out.set(c.id, { name, desc, fx, range: RANGE[fx[0].k] });
  }
  return out;
}

/** This creature's (or boss's) ultimate. */
export function ultimateOf(id: string): Ultimate | null {
  if (!table) table = build();
  return table.get(id) ?? null;
}

/** Every ultimate, for checks. */
export function allUltimates(): Map<string, Ultimate> {
  if (!table) table = build();
  return table;
}

/** The element's colours, for the effects. */
export const ultColour = (element: string): { col: number; light: number } => {
  const e = ELEMENTS[element as keyof typeof ELEMENTS];
  return { col: e?.col ?? 0xffffff, light: e?.light ?? 0xffffff };
};
