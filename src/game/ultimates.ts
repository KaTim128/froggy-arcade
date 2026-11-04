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
import { AURA_POWER, HASTE_SPEED, LINGER_DMG, LINGER_S } from './attackInfo';

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
  /** In a line, for the STATS page. */
  desc: string;
  /** Step by step, in full, for its own card (user, 4 Nov: clearer, more detail). */
  steps: string[];
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

/**
 * THE SAME, IN FULL (user, 4 Nov: "make people understand it more, it is ok
 * to have more words but be clear"): one sentence for each step, saying who
 * it hits, how far it reaches, how much, and how long -- the arena's own
 * numbers (CreatureArena `ultFx`).
 */
const pct = (k: number): number => Math.round((k - 1) * 100);
function fullWords(f: UltFx): string {
  switch (f.k) {
    case 'charge': return `RUSHES STRAIGHT AT THE ENEMY, UP TO ${f.dist}PX, AND DEALS ${f.dmg} DAMAGE IF IT RUNS INTO THEM.`;
    case 'blink': return `VANISHES AND REAPPEARS RIGHT BEHIND THE ENEMY, WHEREVER THEY ARE, AND HITS THEM AT ONCE FOR ${f.dmg} DAMAGE.`;
    case 'nova': return `A BLAST ALL AROUND ITSELF: AN ENEMY WITHIN ${f.r}PX TAKES ${f.dmg} DAMAGE AND IS THROWN BACK.`;
    case 'rage': return `A FRENZY FOR ${f.t}S: IT GROWS A QUARTER BIGGER, MOVES MUCH FASTER, AND ITS HITS DEAL ${pct(AURA_POWER)}% MORE DAMAGE.`;
    case 'pull': return `IF THE ENEMY IS WITHIN ${f.r}PX, IT YANKS THEM RIGHT UP CLOSE, THEN SLAMS THEM FOR ${f.dmg} DAMAGE.`;
    case 'barrage': return `FIRES ${f.n} SHOTS IN A FAN AT THE ENEMY. EACH ONE THAT HITS DEALS ${f.dmg} DAMAGE (UP TO ${f.n * f.dmg} IF EVERY SHOT LANDS). THE CLOSER THEY ARE, THE MORE LAND.`;
    case 'beam': return `AN INSTANT BEAM, ${f.len}PX LONG, STRAIGHT AT THE ENEMY. IT GOES THROUGH COVER AND DEALS ${f.dmg} DAMAGE.`;
    case 'meteor': return `${f.n} STRIKES FALL ON AND AROUND THE ENEMY. A CIRCLE SHOWS WHERE EACH WILL LAND JUST BEFORE IT DOES, AND EACH ONE THAT HITS DEALS ${f.dmg} DAMAGE.`;
    case 'zone': return `LEAVES ${f.n} PATCHES OF HARMFUL GROUND AROUND THE ENEMY FOR ${LINGER_S}S. STANDING IN ONE COSTS ${LINGER_DMG * 2} HEALTH A SECOND.`;
    case 'shield': return `A SHIELD THAT BLOCKS EVERY HIT ON IT FOR ${f.t}S.`;
    case 'heal': return `HEALS ${Math.round(f.frac * 100)}% OF ITS FULL HEALTH AT ONCE.`;
    case 'drain': return `FOR ${f.t}S, DRAINS ${f.dps} HEALTH A SECOND FROM THE ENEMY AND HEALS ITSELF BY THE SAME, AS LONG AS THEY STAY WITHIN 150PX.`;
    case 'slowfield': return `IF THE ENEMY IS WITHIN ${f.r}PX, THEY MOVE ALMOST AT HALF SPEED FOR ${f.t}S.`;
    case 'clones': return `MAKES ${f.n} COPIES OF ITSELF NEARBY FOR 3S. THE ENEMY AIMS AT WHICHEVER IS NEAREST, SO THEIR SHOTS CAN HIT A COPY INSTEAD. EACH COPY BREAKS AFTER 6 DAMAGE.`;
    case 'invuln': return `FOR ${f.t}S NOTHING CAN HURT IT: EVERY HIT AND SHOT DOES NO DAMAGE.`;
    case 'stun': return `IF THE ENEMY IS WITHIN ${f.r}PX, THEY ARE STUNNED FOR ${f.t}S: THEY CANNOT MOVE OR ATTACK.`;
    case 'haste': return `MOVES ${pct(HASTE_SPEED)}% FASTER FOR ${f.t}S.`;
  }
}

/** How close the AI waits to be before firing, by the lead effect. */
const RANGE: Record<K, number> = {
  charge: 90, blink: 200, nova: 40, rage: 70, pull: 100, barrage: 160, beam: 200, meteor: 220, zone: 200,
  shield: 60, heal: 999, drain: 120, slowfield: 70, clones: 120, invuln: 50, stun: 75, haste: 150,
};

/**
 * ---- POWERFUL, NOT A WIN BUTTON, AND NONE WEAKER THAN ANOTHER (user, 4 Nov:
 * "all ultimates should be balanced ensuring none are weaker than the other
 * in terms of their advantages -- attack damage, defences, buffs").
 *
 * Every effect is given a worth in the same coin, HEALTH: what it takes off
 * the enemy, what it gives back, what it stops from landing, or what the
 * enemy cannot do while it lasts --
 *
 *   damage        what can be expected to land (half a barrage, most of a
 *                 meteor rain, a nova or pull when they are close)
 *   drain         the damage, and the same again healed
 *   heal          the health it gives back
 *   shield,       the hits it stops: an enemy deals about ENEMY_DPS a second
 *   untouchable
 *   stun          they neither hit you nor dodge you while it lasts
 *   slow, haste,  the hits a speed edge wins or dodges
 *   frenzy
 *   decoys        the shots they soak
 *
 * -- and every ultimate is then scaled, effect by effect, until its total is
 * the same budget as everyone else's (a boss's is half again).  Times and
 * sizes have sane limits; whatever one effect cannot take for its limit, the
 * others make up.
 */
const BUDGET = 40;
const BOSS_BUDGET = 60;
/** What an enemy deals in a second when it is free to (the plain attacks average 16; not every one lands). */
const ENEMY_DPS = 12;
function worth(f: UltFx, hp: number): number {
  switch (f.k) {
    case 'charge': case 'blink': case 'beam': return f.dmg;
    case 'nova': return f.dmg * 0.9;
    case 'pull': return f.dmg * 1.1; // and they are now beside you
    case 'barrage': return f.n * f.dmg * 0.5;
    case 'meteor': return f.n * f.dmg * 0.6;
    case 'drain': return 2 * f.t * f.dps * 0.8;
    case 'zone': return f.n * f.r * 0.2; // most step out of one quickly
    case 'heal': return f.frac * hp;
    case 'shield': return f.t * ENEMY_DPS * 0.9;
    case 'invuln': return f.t * ENEMY_DPS;
    case 'stun': return f.t * ENEMY_DPS * 1.6;
    case 'slowfield': return f.t * 4;
    case 'haste': return f.t * 3;
    case 'rage': return f.t * 4.5;
    case 'clones': return f.n * 6 * 0.7;
  }
}
const lim = (v: number, lo: number, hi: number, step: number): number => Number((Math.round(Math.min(hi, Math.max(lo, v)) / step) * step).toFixed(2));
/** The same effect, k times as strong, within its limits. */
function scaled(f: UltFx, k: number): UltFx {
  switch (f.k) {
    case 'charge': case 'blink': case 'nova': case 'pull': case 'beam': return { ...f, dmg: lim(f.dmg * k, 3, 60, 1) };
    case 'barrage': case 'meteor': return { ...f, dmg: lim(f.dmg * k, 2, 30, 1) };
    case 'drain': return { ...f, dps: lim(f.dps * k, 2, 20, 1) };
    case 'zone': return { ...f, r: lim(f.r * k, 8, 26, 0.5) };
    case 'heal': return { ...f, frac: lim(f.frac * k, 0.05, 0.4, 0.01) };
    case 'shield': return { ...f, t: lim(f.t * k, 0.8, 4, 0.1) };
    case 'invuln': return { ...f, t: lim(f.t * k, 0.5, 3, 0.1) };
    case 'stun': return { ...f, t: lim(f.t * k, 0.4, 1.6, 0.1) };
    case 'slowfield': return { ...f, t: lim(f.t * k, 1, 6, 0.1) };
    case 'haste': return { ...f, t: lim(f.t * k, 1.5, 8, 0.1) };
    case 'rage': return { ...f, t: lim(f.t * k, 2, 9, 0.1) };
    case 'clones': return f;
  }
}
/** Its total worth, in health. */
export function ultWorth(fx: UltFx[], hp: number): number {
  return fx.reduce((a, f) => a + worth(f, hp), 0);
}
function balance(fx: UltFx[], boss: boolean, hp: number): UltFx[] {
  const want = boss ? BOSS_BUDGET : BUDGET;
  // the fixed part (decoys come in whole numbers) stays; the rest is scaled,
  // a few rounds so what one effect's limit refuses, the others take
  let out = fx;
  for (let round = 0; round < 8; round++) {
    const fixed = out.filter((f) => f.k === 'clones').reduce((a, f) => a + worth(f, hp), 0);
    const free = ultWorth(out, hp) - fixed;
    if (free <= 0) break;
    const k = (want - fixed) / free;
    if (Math.abs(k - 1) < 0.01) break;
    out = out.map((f) => scaled(f, k));
  }
  return out;
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
      fx = balance(kinds.map((k, i) => make(k, c, (h + tries * 7919) >>> 0, i === 0 ? big : 1)), boss, c.hp);
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
    const steps = fx.map((f) => plainWords(fullWords(f)));
    out.set(c.id, { name, desc, steps, fx, range: RANGE[fx[0].k] });
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
