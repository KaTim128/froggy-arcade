/**
 * ---- CREATURE CLASH: the roster.  A hundred original creatures, each one an
 * element (what its attacks do) worn by a body (how it moves and what its
 * signature is), at a rarity (how strong, and how rarely it turns up).
 *
 * There is no type chart.  Elements are not rock-paper-scissors: each one
 * changes what a hit DOES -- Ember burns, Frost slows, Volt stuns, Tide
 * shoves, Moss mends the hitter, Stone shrugs damage off, Gale is quick,
 * Murk blinds, Glow pierces.  Nothing is caught, nothing evolves.
 *
 * Everything here is data and pure functions; the state lives in
 * creatureState, the fighting in scenes2d/CreatureArena.
 */

export type Element = 'ember' | 'tide' | 'moss' | 'frost' | 'volt' | 'stone' | 'gale' | 'murk' | 'glow';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'veryrare' | 'ultrarare' | 'mythic' | 'legendary';
export type Body = 'mole' | 'wisp' | 'crab' | 'beetle' | 'serpent' | 'golem' | 'moth' | 'toad' | 'hound' | 'owl' | 'ray';

/** What an attack does when you let it go. */
export type AttackKind =
  | 'bolt' // one fast shot
  | 'spread' // three shots in a fan
  | 'nova' // a ring around yourself
  | 'dash' // you are the projectile
  | 'beam' // a long thin line, at once
  | 'mine' // left on the ground, goes off when touched
  | 'shield' // a moment of cover
  | 'blink'; // a short jump the way you aim

export interface Attack {
  name: string;
  kind: AttackKind;
  dmg: number;
  /** Seconds before it can be used again. */
  cd: number;
  /** Projectile speed / dash speed / beam length, by kind. */
  reach: number;
}

export interface Creature {
  id: string;
  name: string;
  element: Element;
  body: Body;
  rarity: Rarity;
  hp: number;
  speed: number;
  power: number;
  attacks: [Attack, Attack, Attack];
}

export const ELEMENTS: Record<Element, { name: string; col: number; dark: number; light: number; effect: string }> = {
  ember: { name: 'EMBER', col: 0xe8642a, dark: 0x9a3418, light: 0xffb060, effect: 'BURNS FOR 3S' },
  tide: { name: 'TIDE', col: 0x3a8ad8, dark: 0x1e4e8a, light: 0x9ad0ff, effect: 'SHOVES BACK' },
  moss: { name: 'MOSS', col: 0x5aa83a, dark: 0x2e6a1e, light: 0xb0e080, effect: 'HEALS THE HITTER' },
  frost: { name: 'FROST', col: 0x8adcf0, dark: 0x3a8aa8, light: 0xe8fcff, effect: 'SLOWS FOR 2S' },
  volt: { name: 'VOLT', col: 0xf0d030, dark: 0xa08010, light: 0xfff4a0, effect: 'STUNS BRIEFLY' },
  stone: { name: 'STONE', col: 0x9a8a70, dark: 0x5a4e3e, light: 0xd0c4a8, effect: 'TAKES LESS DAMAGE' },
  gale: { name: 'GALE', col: 0xb8e8c8, dark: 0x5a9a7a, light: 0xf0fff4, effect: 'MOVES FASTER' },
  murk: { name: 'MURK', col: 0x7a4a9a, dark: 0x40245a, light: 0xc090e0, effect: 'BLINDS (SHORT SIGHT)' },
  glow: { name: 'GLOW', col: 0xf0e8c0, dark: 0xa89a60, light: 0xffffff, effect: 'SHOTS PIERCE COVER' },
};
export const ELEMENT_LIST = Object.keys(ELEMENTS) as Element[];

/** Name roots: one per element, so a name says what it is. */
const ROOT: Record<Element, string> = {
  ember: 'Cinder', tide: 'Brine', moss: 'Bramble', frost: 'Rime', volt: 'Spark', stone: 'Grit', gale: 'Zephyr', murk: 'Bog', glow: 'Lumen',
};

export const BODIES: Record<Body, { name: string; hp: number; speed: number; power: number; sig: Omit<Attack, 'dmg'> & { dmg: number } }> = {
  mole: { name: 'mole', hp: 1.1, speed: 0.9, power: 1.0, sig: { name: 'BURROW RUSH', kind: 'dash', dmg: 14, cd: 3.5, reach: 230 } },
  wisp: { name: 'wisp', hp: 0.8, speed: 1.2, power: 1.0, sig: { name: 'FLICKER', kind: 'blink', dmg: 0, cd: 3, reach: 60 } },
  crab: { name: 'crab', hp: 1.25, speed: 0.85, power: 0.95, sig: { name: 'SHELL UP', kind: 'shield', dmg: 0, cd: 6, reach: 1.6 } },
  beetle: { name: 'beetle', hp: 1.15, speed: 0.95, power: 1.0, sig: { name: 'HORN CHARGE', kind: 'dash', dmg: 16, cd: 4, reach: 210 } },
  serpent: { name: 'snake', hp: 0.95, speed: 1.1, power: 1.05, sig: { name: 'COIL SNAP', kind: 'beam', dmg: 13, cd: 3, reach: 46 } },
  golem: { name: 'golem', hp: 1.4, speed: 0.75, power: 1.1, sig: { name: 'QUAKE', kind: 'nova', dmg: 15, cd: 5, reach: 34 } },
  moth: { name: 'moth', hp: 0.85, speed: 1.15, power: 1.0, sig: { name: 'DUST TRAP', kind: 'mine', dmg: 18, cd: 4, reach: 0 } },
  toad: { name: 'toad', hp: 1.05, speed: 1.0, power: 1.0, sig: { name: 'TONGUE LASH', kind: 'beam', dmg: 12, cd: 2.5, reach: 54 } },
  hound: { name: 'hound', hp: 1.0, speed: 1.15, power: 1.05, sig: { name: 'POUNCE', kind: 'dash', dmg: 15, cd: 3, reach: 250 } },
  owl: { name: 'owl', hp: 0.9, speed: 1.05, power: 1.1, sig: { name: 'TALON VOLLEY', kind: 'spread', dmg: 7, cd: 3, reach: 150 } },
  ray: { name: 'ray', hp: 0.95, speed: 1.1, power: 1.0, sig: { name: 'GLIDE', kind: 'blink', dmg: 0, cd: 2.5, reach: 70 } },
};
export const BODY_LIST = Object.keys(BODIES) as Body[];

/** Each element's opening shot and its big one; the body gives the middle. */
const MOVES: Record<Element, [string, string]> = {
  ember: ['EMBER SPIT', 'FLARE RING'],
  tide: ['WATER JET', 'SURGE'],
  moss: ['SEED SHOT', 'BLOOM'],
  frost: ['ICE SHARD', 'HAILBURST'],
  volt: ['ZAP', 'THUNDERCLAP'],
  stone: ['PEBBLE SHOT', 'ROCKFALL'],
  gale: ['GUST', 'CYCLONE'],
  murk: ['MIRE GLOB', 'GLOOM'],
  glow: ['LIGHT DART', 'RADIANCE'],
};

export const RARITIES: Record<Rarity, { name: string; col: number; mult: number; weight: number }> = {
  common: { name: 'COMMON', col: 0xb0b0b0, mult: 1.0, weight: 60 },
  uncommon: { name: 'UNCOMMON', col: 0x5ac85a, mult: 1.12, weight: 20 },
  rare: { name: 'RARE', col: 0x4a9aff, mult: 1.25, weight: 10 },
  veryrare: { name: 'VERY RARE', col: 0x9a5aff, mult: 1.38, weight: 5 },
  ultrarare: { name: 'ULTRA RARE', col: 0xff5ab0, mult: 1.52, weight: 1 },
  mythic: { name: 'MYTHIC', col: 0xff9a2a, mult: 1.68, weight: 3.99 },
  legendary: { name: 'LEGENDARY', col: 0xffe040, mult: 1.9, weight: 0.01 },
};
export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'veryrare', 'ultrarare', 'mythic', 'legendary'];

/** Which rarity each body is, within every element: 4 common ... 1 mythic. */
const BODY_RARITY: Record<Body, Rarity> = {
  mole: 'common', toad: 'common', crab: 'common', moth: 'common',
  beetle: 'uncommon', hound: 'uncommon',
  serpent: 'rare', owl: 'rare',
  ray: 'veryrare',
  wisp: 'ultrarare',
  golem: 'mythic',
};

function build(id: string, name: string, element: Element, body: Body, rarity: Rarity): Creature {
  const b = BODIES[body];
  const m = RARITIES[rarity].mult;
  const [shot, big] = MOVES[element];
  const pow = b.power * m;
  return {
    id,
    name,
    element,
    body,
    rarity,
    hp: Math.round(100 * b.hp * m),
    speed: Math.round(62 * b.speed * (0.92 + m * 0.08) * (element === 'gale' ? 1.1 : 1)),
    power: Math.round(pow * 100) / 100,
    attacks: [
      { name: shot, kind: 'bolt', dmg: Math.round(8 * pow), cd: 0.55, reach: element === 'volt' || element === 'glow' ? 230 : 190 },
      { ...b.sig, dmg: Math.round(b.sig.dmg * pow) },
      { name: big, kind: element === 'frost' || element === 'gale' ? 'spread' : element === 'glow' || element === 'volt' ? 'beam' : 'nova', dmg: Math.round(20 * pow), cd: 7, reach: element === 'glow' || element === 'volt' ? 120 : element === 'frost' || element === 'gale' ? 180 : 44 },
    ],
  };
}

const cap = (s: string): string => s[0].toUpperCase() + s.slice(1);

/** 9 elements x 11 bodies = 99, and one more. */
export const CREATURES: Creature[] = (() => {
  const out: Creature[] = [];
  for (const e of ELEMENT_LIST) {
    for (const b of BODY_LIST) out.push(build(`${e}_${b}`, `${ROOT[e]}${BODIES[b].name}`, e, b, BODY_RARITY[b]));
  }
  // the one nobody has seen: every element at once, worn by a little frog
  const lily = build('lily_sovereign', 'Lily Sovereign', 'glow', 'toad', 'legendary');
  lily.attacks = [
    { name: 'PRISM DART', kind: 'spread', dmg: 9, cd: 0.7, reach: 220 },
    { name: 'LILY LEAP', kind: 'blink', dmg: 0, cd: 2, reach: 80 },
    { name: 'NINEFOLD', kind: 'nova', dmg: 34, cd: 6, reach: 52 },
  ];
  out.push(lily);
  // (the longest made-up name is 13 letters: Bramblebeetle)
  return out.map((c) => ({ ...c, name: cap(c.name) }));
})();

export const creatureById = (id: string): Creature | undefined => CREATURES.find((c) => c.id === id);

/** The three you can choose from for nothing, once. */
export const STARTERS = ['ember_mole', 'tide_toad', 'moss_crab'];

// ------------------------------------------------------------------- gacha

export interface Tier {
  id: 'basic' | 'premium' | 'elite';
  name: string;
  cost: number;
  rarities: Rarity[];
}

export const TIERS: Tier[] = [
  { id: 'basic', name: 'BASIC PACK', cost: 50, rarities: ['common', 'uncommon', 'rare'] },
  { id: 'premium', name: 'PREMIUM PACK', cost: 150, rarities: ['rare', 'veryrare', 'ultrarare'] },
  { id: 'elite', name: 'ELITE PACK', cost: 300, rarities: ['ultrarare', 'mythic', 'legendary'] },
];

/** The chance of each rarity on one card of a tier: the overall weights, kept to the tier's own rarities. */
export function tierOdds(tier: Tier): Array<[Rarity, number]> {
  const total = tier.rarities.reduce((s, r) => s + RARITIES[r].weight, 0);
  return tier.rarities.map((r) => [r, RARITIES[r].weight / total]);
}

/**
 * Nine different creatures for one pack.  Each card rolls its rarity on the
 * tier's odds, then a creature of that rarity not already on the table; if
 * a rarity has run out of fresh faces (only one legendary exists) it rolls
 * again without it.
 */
export function rollPack(tier: Tier, rng: () => number = Math.random): string[] {
  const picked = new Set<string>();
  const out: string[] = [];
  let guard = 0;
  while (out.length < 9 && guard++ < 500) {
    const odds = tierOdds(tier).filter(([r]) => CREATURES.some((c) => c.rarity === r && !picked.has(c.id)));
    const total = odds.reduce((s, [, p]) => s + p, 0);
    let roll = rng() * total;
    let rarity = odds[odds.length - 1][0];
    for (const [r, p] of odds) {
      if ((roll -= p) < 0) {
        rarity = r;
        break;
      }
    }
    const pool = CREATURES.filter((c) => c.rarity === rarity && !picked.has(c.id));
    const c = pool[Math.floor(rng() * pool.length)];
    picked.add(c.id);
    out.push(c.id);
  }
  return out;
}

// ------------------------------------------------------------------ biomes

export interface Biome {
  id: string;
  name: string;
  /** Wild creatures turn up from these elements. */
  elements: Element[];
  ground: number;
  groundDark: number;
  prop: 'rock' | 'tuft' | 'tree' | 'ice' | 'reed' | 'pillar' | 'shell' | 'cactus' | 'vent';
  boss: { id: string; name: string; element: Element; body: Body; hp: number; power: number; speed: number; trick: string };
}

export const BIOMES: Biome[] = [
  { id: 'caves', name: 'ECHO CAVES', elements: ['stone', 'murk'], ground: 0x4a4440, groundDark: 0x2e2a28, prop: 'rock', boss: { id: 'boss_caves', name: 'THE GEODE KING', element: 'stone', body: 'golem', hp: 420, power: 1.5, speed: 44, trick: 'STALACTITES FALL' } },
  { id: 'fields', name: 'WINDY FIELDS', elements: ['gale', 'moss'], ground: 0x8ab85a, groundDark: 0x5a8a3a, prop: 'tuft', boss: { id: 'boss_fields', name: 'OLD SCARECROW', element: 'gale', body: 'owl', hp: 360, power: 1.45, speed: 70, trick: 'DUST DEVILS' } },
  { id: 'forests', name: 'DEEPWOOD', elements: ['moss', 'murk'], ground: 0x3a6a2e, groundDark: 0x24461c, prop: 'tree', boss: { id: 'boss_forests', name: 'MOTHER BRAMBLE', element: 'moss', body: 'serpent', hp: 400, power: 1.45, speed: 56, trick: 'ROOTS GRAB' } },
  { id: 'frozen', name: 'FROZEN PASS', elements: ['frost', 'gale'], ground: 0xd8ecf4, groundDark: 0xa0c4d4, prop: 'ice', boss: { id: 'boss_frozen', name: 'GLACIER HOUND', element: 'frost', body: 'hound', hp: 380, power: 1.5, speed: 74, trick: 'ICE FLOOR' } },
  { id: 'swamps', name: 'SOURMIRE', elements: ['murk', 'tide'], ground: 0x4a5a3a, groundDark: 0x2e3a24, prop: 'reed', boss: { id: 'boss_swamps', name: 'BOG MATRIARCH', element: 'murk', body: 'toad', hp: 440, power: 1.4, speed: 48, trick: 'SINKING POOLS' } },
  { id: 'ruins', name: 'SUNKEN RUINS', elements: ['glow', 'stone'], ground: 0x9a9070, groundDark: 0x6a6048, prop: 'pillar', boss: { id: 'boss_ruins', name: 'THE WARDEN', element: 'glow', body: 'golem', hp: 460, power: 1.5, speed: 42, trick: 'SWEEPING LIGHT' } },
  { id: 'shore', name: 'SALT SHORE', elements: ['tide', 'gale'], ground: 0xe0d090, groundDark: 0xb8a868, prop: 'shell', boss: { id: 'boss_shore', name: 'TIDECALLER RAY', element: 'tide', body: 'ray', hp: 380, power: 1.5, speed: 72, trick: 'WAVES ROLL IN' } },
  { id: 'desert', name: 'GLASS DESERT', elements: ['volt', 'ember'], ground: 0xe8c078, groundDark: 0xc09050, prop: 'cactus', boss: { id: 'boss_desert', name: 'STORM BEETLE', element: 'volt', body: 'beetle', hp: 400, power: 1.55, speed: 60, trick: 'LIGHTNING STRIKES' } },
  { id: 'volcano', name: 'ASHEN PEAK', elements: ['ember', 'stone'], ground: 0x5a3a30, groundDark: 0x3a2018, prop: 'vent', boss: { id: 'boss_volcano', name: 'MAGMA WYRM', element: 'ember', body: 'serpent', hp: 480, power: 1.6, speed: 58, trick: 'LAVA VENTS' } },
];

/** A boss as something that can fight: its own three attacks. */
export function bossCreature(b: Biome): Creature {
  const base = build(b.boss.id, b.boss.name, b.boss.element, b.boss.body, 'mythic');
  return {
    ...base,
    name: b.boss.name,
    hp: b.boss.hp,
    speed: b.boss.speed,
    power: b.boss.power,
    attacks: [
      { ...base.attacks[0], kind: 'spread', dmg: Math.round(8 * b.boss.power), cd: 1.1 },
      { ...base.attacks[1], dmg: Math.round(Math.max(12, base.attacks[1].dmg) * 1.1) },
      { ...base.attacks[2], dmg: Math.round(22 * b.boss.power), cd: 6 },
    ],
  };
}

/** Wins in a biome before its boss will come out. */
export const BOSS_AFTER = 3;

/** A wild opponent for a biome: from its elements, never above the tier you have earned. */
export function wildFor(b: Biome, wins: number, rng: () => number = Math.random): Creature {
  const top = wins >= 6 ? 3 : wins >= 3 ? 2 : 1; // common.. rare
  const pool = CREATURES.filter((c) => b.elements.includes(c.element) && RARITY_ORDER.indexOf(c.rarity) <= top && c.rarity !== 'legendary');
  return pool[Math.floor(rng() * pool.length)];
}

// ----------------------------------------------------------------- economy

export const BATTLE_COST = 2;
export const BATTLE_WIN = 5;
/** Lost on a defeat on top of the stake -- never below zero. */
export const DEFEAT_PENALTY = 1;
export const MAX_OWNED = 2;
