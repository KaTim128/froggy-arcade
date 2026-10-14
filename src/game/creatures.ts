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
  | 'blink' // a short jump the way you aim
  | 'arc' // lobbed over cover, bursts where it lands
  | 'snare' // a shot that roots whatever it catches
  | 'aura' // a few seconds of being faster and hitting harder
  | 'mend' // some of your own health back
  | 'wall'; // a piece of the place itself, dropped as cover

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
  /** Only a boss has one: what it wears (see art/creatureArt `crown`). */
  crown?: BossDef['crown'];
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

/**
 * ---- WHAT A BODY IS GOOD AND BAD AT.
 *
 * `sig` is the move only that body has.  `strong` and `weak` are the two
 * lines the menu prints under it: what the shape is for, and what it will
 * always cost you.  They are not decoration -- they describe the numbers
 * above them, so a player reading them can plan a fight.
 */
export const BODIES: Record<
  Body,
  { name: string; hp: number; speed: number; power: number; strong: string; weak: string }
> = {
  mole: { name: 'mole', hp: 1.1, speed: 0.9, power: 1.0, strong: 'TOUGH, AND CLOSES IN UNDER FIRE', weak: 'SLOW ON ITS FEET IN THE OPEN' },
  wisp: { name: 'wisp', hp: 0.8, speed: 1.2, power: 1.0, strong: 'FASTEST THING ALIVE, BLINKS AWAY', weak: 'THE THINNEST HEALTH IN THE GAME' },
  crab: { name: 'crab', hp: 1.25, speed: 0.85, power: 0.95, strong: 'HEAVY SHELL, BLOCKS A BIG HIT OUTRIGHT', weak: 'SLOW, AND HITS A LITTLE SOFT' },
  beetle: { name: 'beetle', hp: 1.15, speed: 0.95, power: 1.0, strong: 'ARMOURED, AND THE HARDEST CHARGE', weak: 'NO ANSWER TO A FIGHT AT RANGE' },
  serpent: { name: 'snake', hp: 0.95, speed: 1.1, power: 1.05, strong: 'QUICK, AND STRIKES WITH NO TRAVEL TIME', weak: 'THIN: EVERY HIT LANDS FULLY' },
  golem: { name: 'golem', hp: 1.4, speed: 0.75, power: 1.1, strong: 'THE MOST HEALTH AND THE HARDEST HITS', weak: 'SLOWEST IN THE GAME - EASY TO KITE' },
  moth: { name: 'moth', hp: 0.85, speed: 1.15, power: 1.0, strong: 'FAST, AND FIGHTS THE GROUND YOU WANT', weak: 'FRAGILE, AND LOSES A STRAIGHT BRAWL' },
  toad: { name: 'toad', hp: 1.05, speed: 1.0, power: 1.0, strong: 'NO WEAK SIDE, AND A QUICK SURE STRIKE', weak: 'NO GREAT SIDE EITHER' },
  hound: { name: 'hound', hp: 1.0, speed: 1.15, power: 1.05, strong: 'RUNS DOWN ANYTHING AND POUNCES FAR', weak: 'MUST BE CLOSE TO DO ITS WORK' },
  owl: { name: 'owl', hp: 0.9, speed: 1.05, power: 1.1, strong: 'HITS HARDEST AT RANGE, HARD TO DODGE', weak: 'LIGHT BONES - CANNOT TRADE BLOWS' },
  ray: { name: 'ray', hp: 0.95, speed: 1.1, power: 1.0, strong: 'GLIDES OUT OF TROUBLE EVERY TWO SECONDS', weak: 'NOTHING TO SHOW FOR IT IN DAMAGE' },
};

export const BODY_LIST = Object.keys(BODIES) as Body[];

/**
 * ---- THE MOVE THAT IS THAT CREATURE'S ALONE.
 *
 * Ninety-nine creatures, ninety-nine signature moves: no two share one.  A
 * body gives the move its shape (a mole goes under things, an owl works from
 * above, a crab shuts) and the element decides what that shape becomes --
 * which is why the nine moles are nine different fighters and not one mole
 * in nine colours.  Within a body every element takes a DIFFERENT KIND as
 * well, so Cindermole charging and Rimemole laying a trap are not the same
 * move with another word on the button.
 *
 * (`CREATURES` checks this at load in dev: a repeated name is a bug.)
 */
const SIGNATURES: Record<Body, Record<Element, [string, AttackKind]>> = {
  mole: { ember: ['MAGMA RUSH', 'dash'], tide: ['SILT SPRAY', 'arc'], moss: ['ROOT FEED', 'mend'], frost: ['FROST BURROW', 'mine'], volt: ['GROUND FAULT', 'nova'], stone: ['DIG IN', 'shield'], gale: ['SAND SKIP', 'blink'], murk: ['TAR PULL', 'snare'], glow: ['SUNSHAFT', 'beam'] },
  wisp: { ember: ['EMBER TRAIL', 'beam'], tide: ['SEA DRIFT', 'blink'], moss: ['SPORE HAZE', 'aura'], frost: ['COLD TETHER', 'snare'], volt: ['ARC FLASH', 'bolt'], stone: ['DUST SHROUD', 'shield'], gale: ['SPLIT LIGHT', 'spread'], murk: ['WILL O WISP', 'mine'], glow: ['FLARE OUT', 'nova'] },
  crab: { ember: ['BOILING SNAP', 'nova'], tide: ['SHELL UP', 'shield'], moss: ['KELP WEAVE', 'wall'], frost: ['BRINE LOCK', 'snare'], volt: ['SHOCK CLAW', 'beam'], stone: ['STONE CLAW', 'dash'], gale: ['SIDE SCUTTLE', 'blink'], murk: ['MUD POT', 'mine'], glow: ['PEARL SHOT', 'arc'] },
  beetle: { ember: ['HORN CHARGE', 'dash'], tide: ['SPRAY HORN', 'spread'], moss: ['SHELL BLOOM', 'mend'], frost: ['RIME GUARD', 'shield'], volt: ['STORM HORN', 'beam'], stone: ['BOULDER TOSS', 'arc'], gale: ['WING WHIRR', 'aura'], murk: ['PITFALL', 'mine'], glow: ['PRISM HORN', 'nova'] },
  serpent: { ember: ['COIL SNAP', 'beam'], tide: ['WHIRL COIL', 'nova'], moss: ['VINE BIND', 'snare'], frost: ['ICE FANG', 'dash'], volt: ['LIVE WIRE', 'aura'], stone: ['SCALE PLATE', 'shield'], gale: ['SIDEWIND', 'blink'], murk: ['VENOM SPIT', 'arc'], glow: ['DAZZLE SCALE', 'spread'] },
  golem: { ember: ['MAGMA QUAKE', 'nova'], tide: ['FLOOD STOMP', 'arc'], moss: ['OVERGROW', 'mend'], frost: ['GLACIER SLAB', 'wall'], volt: ['OVERLOAD', 'aura'], stone: ['QUAKE', 'dash'], gale: ['STONE SLING', 'spread'], murk: ['GRAVE GRIP', 'snare'], glow: ['LIGHT PILLAR', 'beam'] },
  moth: { ember: ['ASH DUST', 'mine'], tide: ['MIST VEIL', 'shield'], moss: ['POLLEN DRIFT', 'aura'], frost: ['FROST POWDER', 'snare'], volt: ['STATIC WINGS', 'nova'], stone: ['GRIT SCALES', 'wall'], gale: ['WING BEAT', 'spread'], murk: ['NIGHT DUST', 'blink'], glow: ['MOON SCALES', 'beam'] },
  toad: { ember: ['SCALD TONGUE', 'beam'], tide: ['WATER GULP', 'mend'], moss: ['LILY LASH', 'snare'], frost: ['FROZEN HOP', 'blink'], volt: ['TONGUE ARC', 'bolt'], stone: ['BELLY SLAM', 'nova'], gale: ['LEAP OFF', 'dash'], murk: ['SWAMP SPIT', 'arc'], glow: ['GLEAM CROAK', 'aura'] },
  hound: { ember: ['ASH POUNCE', 'dash'], tide: ['RIPTIDE RUSH', 'snare'], moss: ['PACK HOWL', 'aura'], frost: ['FROST BITE', 'beam'], volt: ['THUNDER RUN', 'blink'], stone: ['BONE GUARD', 'shield'], gale: ['SLIPSTREAM', 'spread'], murk: ['SHADOW SNAP', 'mine'], glow: ['DAWN HOWL', 'nova'] },
  owl: { ember: ['CINDER TALON', 'spread'], tide: ['DIVE BOMB', 'dash'], moss: ['NEST MEND', 'mend'], frost: ['HAIL DROP', 'arc'], volt: ['STORM EYE', 'aura'], stone: ['ROOST GUARD', 'wall'], gale: ['SILENT GLIDE', 'blink'], murk: ['NIGHT EYES', 'snare'], glow: ['PIERCE GAZE', 'beam'] },
  ray: { ember: ['HEAT GLIDE', 'blink'], tide: ['TIDE WASH', 'nova'], moss: ['REEF GUARD', 'wall'], frost: ['CHILL WAKE', 'snare'], volt: ['LIVE STING', 'beam'], stone: ['SAND BURY', 'shield'], gale: ['SKY GLIDE', 'aura'], murk: ['INK CLOUD', 'mine'], glow: ['LAMP FLASH', 'spread'] },
};

/**
 * What a signature of each kind is worth.  The numbers belong to the KIND --
 * a trap is a trap wherever it is laid -- and the creature's power and its
 * body's quickness move them from there.
 */
const KIND_BASE: Record<AttackKind, { dmg: number; cd: number; reach: number }> = {
  bolt: { dmg: 10, cd: 0.9, reach: 215 },
  spread: { dmg: 7, cd: 3, reach: 155 },
  nova: { dmg: 15, cd: 5, reach: 36 },
  dash: { dmg: 15, cd: 3.4, reach: 235 },
  beam: { dmg: 13, cd: 2.9, reach: 52 },
  mine: { dmg: 18, cd: 4, reach: 0 },
  shield: { dmg: 0, cd: 6, reach: 1.6 },
  blink: { dmg: 0, cd: 2.6, reach: 68 },
  arc: { dmg: 16, cd: 4.5, reach: 105 },
  snare: { dmg: 10, cd: 5, reach: 175 },
  aura: { dmg: 0, cd: 8.5, reach: 5 },
  mend: { dmg: 0, cd: 9, reach: 32 },
  wall: { dmg: 0, cd: 7.5, reach: 28 },
};

/** That creature's own move, at its own power. */
export function signatureOf(element: Element, body: Body, pow: number): Attack {
  const [name, kind] = SIGNATURES[body][element];
  const k = KIND_BASE[kind];
  const b = BODIES[body];
  // a quick body gets it back sooner; a heavy one hits harder with it
  const cd = Math.round(k.cd * (b.speed > 1.08 ? 0.9 : b.speed < 0.9 ? 1.08 : 1) * 10) / 10;
  return { name, kind, dmg: Math.round(k.dmg * pow * (b.power > 1.05 ? 1.08 : 1)), cd, reach: k.reach };
}

/**
 * ---- WHAT AN ELEMENT CAN DO.
 *
 * Three moves each, not two: the opening shot everything has, the big one it
 * is known for, and a SECOND big one of a different kind entirely -- so two
 * creatures of the same element are not the same fighter with a different
 * body.  Which of the two big ones a creature gets is decided by its body
 * (see `build`), so the ninety-nine of them are ninety-nine movesets.
 *
 * The kinds are deliberately spread: a lobbed shot goes over cover, a snare
 * roots you where you stand, an aura is a few seconds of being dangerous, a
 * mend buys a fight back, a wall drops a piece of the place in your way.
 */
interface Move {
  name: string;
  kind: AttackKind;
  /** Multiplied by the creature's power for the damage. */
  dmg: number;
  cd: number;
  reach: number;
}

const OPENERS: Record<Element, Move> = {
  ember: { name: 'EMBER SPIT', kind: 'bolt', dmg: 8, cd: 0.55, reach: 190 },
  tide: { name: 'WATER JET', kind: 'bolt', dmg: 8, cd: 0.55, reach: 200 },
  moss: { name: 'SEED SHOT', kind: 'bolt', dmg: 8, cd: 0.5, reach: 185 },
  frost: { name: 'ICE SHARD', kind: 'bolt', dmg: 8, cd: 0.55, reach: 195 },
  volt: { name: 'ZAP', kind: 'bolt', dmg: 7, cd: 0.45, reach: 230 },
  stone: { name: 'PEBBLE SHOT', kind: 'bolt', dmg: 9, cd: 0.7, reach: 175 },
  gale: { name: 'GUST', kind: 'bolt', dmg: 7, cd: 0.42, reach: 205 },
  murk: { name: 'MIRE GLOB', kind: 'bolt', dmg: 9, cd: 0.6, reach: 180 },
  glow: { name: 'LIGHT DART', kind: 'bolt', dmg: 8, cd: 0.5, reach: 230 },
};

/** The one it is known for. */
const FINISHERS: Record<Element, Move> = {
  ember: { name: 'FLARE RING', kind: 'nova', dmg: 20, cd: 7, reach: 44 },
  tide: { name: 'SURGE', kind: 'nova', dmg: 19, cd: 6.5, reach: 48 },
  moss: { name: 'BLOOM', kind: 'nova', dmg: 19, cd: 7, reach: 46 },
  frost: { name: 'HAILBURST', kind: 'spread', dmg: 20, cd: 7, reach: 180 },
  volt: { name: 'THUNDERCLAP', kind: 'beam', dmg: 20, cd: 7, reach: 120 },
  stone: { name: 'ROCKFALL', kind: 'arc', dmg: 22, cd: 7, reach: 120 },
  gale: { name: 'CYCLONE', kind: 'spread', dmg: 19, cd: 6.5, reach: 190 },
  murk: { name: 'GLOOM', kind: 'nova', dmg: 20, cd: 7, reach: 50 },
  glow: { name: 'RADIANCE', kind: 'beam', dmg: 21, cd: 7, reach: 130 },
};

/** And the other one: a different kind of answer to the same problem. */
const SPECIALS: Record<Element, Move> = {
  ember: { name: 'MAGMA LOB', kind: 'arc', dmg: 21, cd: 6.5, reach: 110 },
  tide: { name: 'UNDERTOW', kind: 'snare', dmg: 12, cd: 6, reach: 190 },
  moss: { name: 'REGROWTH', kind: 'mend', dmg: 0, cd: 9, reach: 34 },
  frost: { name: 'FROST WALL', kind: 'wall', dmg: 0, cd: 8, reach: 30 },
  volt: { name: 'STATIC FIELD', kind: 'aura', dmg: 0, cd: 9, reach: 5 },
  stone: { name: 'BULWARK', kind: 'wall', dmg: 0, cd: 8, reach: 30 },
  gale: { name: 'TAILWIND', kind: 'aura', dmg: 0, cd: 8, reach: 5 },
  murk: { name: 'SHADE SNARE', kind: 'snare', dmg: 13, cd: 6, reach: 175 },
  glow: { name: 'MENDLIGHT', kind: 'mend', dmg: 0, cd: 9, reach: 30 },
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

/** A move table entry at a creature's own power. */
const at = (m: Move, pow: number): Attack => ({ name: m.name, kind: m.kind, dmg: Math.round(m.dmg * pow), cd: m.cd, reach: m.reach });

/**
 * THE THIRD SLOT IS THE ONE THAT VARIES.  Half the bodies take their
 * element's famous move, half take its other one -- so Cindermole and
 * Cinderowl do not fight the same way, and neither does Cindermole fight
 * like Rimemole.
 */
const TAKES_SPECIAL: Body[] = ['wisp', 'crab', 'golem', 'toad', 'owl'];

function build(id: string, name: string, element: Element, body: Body, rarity: Rarity): Creature {
  const b = BODIES[body];
  const m = RARITIES[rarity].mult;
  const pow = b.power * m;
  const third = TAKES_SPECIAL.includes(body) ? SPECIALS[element] : FINISHERS[element];
  return {
    id,
    name,
    element,
    body,
    rarity,
    hp: Math.round(100 * b.hp * m),
    speed: Math.round(62 * b.speed * (0.92 + m * 0.08) * (element === 'gale' ? 1.1 : 1)),
    power: Math.round(pow * 100) / 100,
    attacks: [at(OPENERS[element], pow), signatureOf(element, body, pow), at(third, pow)],
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

/**
 * ---- TWO THINGS THAT MUST STAY TRUE, checked where they are easiest to
 * break: every creature's signature move is its own (the whole point of
 * SIGNATURES), and no move's name is longer than the arena's buttons can
 * print -- twelve characters, measured against the attack strip.
 */
export const MOVE_NAME_MAX = 12;
if (import.meta.env?.DEV) {
  const sigs = CREATURES.map((c) => c.attacks[1].name);
  const dupe = sigs.find((n, i) => sigs.indexOf(n) !== i);
  if (dupe) throw new Error(`creatures: two creatures share the signature "${dupe}"`);
  const long = CREATURES.flatMap((c) => c.attacks).find((a) => a.name.length > MOVE_NAME_MAX);
  if (long) throw new Error(`creatures: "${long.name}" is too long for an attack button`);
}

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

/**
 * ---- WHAT STANDS IN THE WAY, AND WHAT IT IS MADE OF.
 *
 * Cover used to be a circle with a picture on it, the same circle in every
 * world.  Now the barrier IS the place: a stand of trees in the fields, a
 * fallen column in the ruins, a crag in the caves, a lava crust on the peak.
 * `cover` says what shape they are and how they are laid out, so the arena
 * reads as somewhere rather than as a floor with obstacles on it.
 *
 *  line     a run of them across the field, a wall you go round or through a gap
 *  grove    clumps, like trees grow
 *  scatter  singly, anywhere
 *  ring     round the edges, leaving the middle open
 */
export type CoverShape = 'rock' | 'tuft' | 'tree' | 'ice' | 'reed' | 'pillar' | 'shell' | 'cactus' | 'vent';
export type CoverPlan = 'line' | 'grove' | 'scatter' | 'ring';

export interface BossDef {
  id: string;
  name: string;
  element: Element;
  body: Body;
  hp: number;
  power: number;
  speed: number;
  /** The name of what it does to the floor, for the menu. */
  trick: string;
  /**
   * How it fights, which is not how anything else fights:
   *  rain    marks fall from above, on and around you
   *  sweep   a line crosses the whole arena
   *  grasp   marks under your feet, where you ARE, and they hold you
   *  tide    a wall of them rolls in from one side
   *  burrow  it goes under and comes up next to you
   */
  pattern: 'rain' | 'sweep' | 'grasp' | 'tide' | 'burrow';
  /** Drawn on top of the body: what makes it the thing in this world. */
  crown: 'geode' | 'straw' | 'thorns' | 'frost' | 'fungus' | 'halo' | 'fins' | 'storm' | 'magma';
}

export interface Biome {
  id: string;
  name: string;
  /** Wild creatures turn up from these elements. */
  elements: Element[];
  ground: number;
  groundDark: number;
  prop: CoverShape;
  /** How that cover is laid out, and how much of it there is. */
  cover: CoverPlan;
  /** The light and air of the place, painted over the floor. */
  mood: { sky: number; haze: number; fleck: number };
  boss: BossDef;
}

export const BIOMES: Biome[] = [
  { id: 'caves', name: 'ECHO CAVES', elements: ['stone', 'murk'], ground: 0x4a4440, groundDark: 0x2e2a28, prop: 'rock', cover: 'line', mood: { sky: 0x120e14, haze: 0x2a2230, fleck: 0x8a7a9a }, boss: { id: 'boss_caves', name: 'THE GEODE KING', element: 'stone', body: 'golem', hp: 420, power: 1.5, speed: 44, trick: 'STALACTITES FALL', pattern: 'rain', crown: 'geode' } },
  { id: 'fields', name: 'WINDY FIELDS', elements: ['gale', 'moss'], ground: 0x8ab85a, groundDark: 0x5a8a3a, prop: 'tree', cover: 'grove', mood: { sky: 0x9ad0e8, haze: 0xc8e8a0, fleck: 0xf0e880 }, boss: { id: 'boss_fields', name: 'OLD SCARECROW', element: 'gale', body: 'owl', hp: 360, power: 1.45, speed: 70, trick: 'DUST DEVILS', pattern: 'sweep', crown: 'straw' } },
  { id: 'forests', name: 'DEEPWOOD', elements: ['moss', 'murk'], ground: 0x3a6a2e, groundDark: 0x24461c, prop: 'tree', cover: 'scatter', mood: { sky: 0x16220f, haze: 0x2a4a22, fleck: 0x8ad06a }, boss: { id: 'boss_forests', name: 'MOTHER BRAMBLE', element: 'moss', body: 'serpent', hp: 400, power: 1.45, speed: 56, trick: 'ROOTS GRAB', pattern: 'grasp', crown: 'thorns' } },
  { id: 'frozen', name: 'FROZEN PASS', elements: ['frost', 'gale'], ground: 0xd8ecf4, groundDark: 0xa0c4d4, prop: 'ice', cover: 'line', mood: { sky: 0xbfd8e8, haze: 0xeaf6ff, fleck: 0xffffff }, boss: { id: 'boss_frozen', name: 'GLACIER HOUND', element: 'frost', body: 'hound', hp: 380, power: 1.5, speed: 74, trick: 'ICE FLOOR', pattern: 'burrow', crown: 'frost' } },
  { id: 'swamps', name: 'SOURMIRE', elements: ['murk', 'tide'], ground: 0x4a5a3a, groundDark: 0x2e3a24, prop: 'reed', cover: 'scatter', mood: { sky: 0x202a1e, haze: 0x3a5a3a, fleck: 0x9ab06a }, boss: { id: 'boss_swamps', name: 'BOG MATRIARCH', element: 'murk', body: 'toad', hp: 440, power: 1.4, speed: 48, trick: 'SINKING POOLS', pattern: 'grasp', crown: 'fungus' } },
  { id: 'ruins', name: 'SUNKEN RUINS', elements: ['glow', 'stone'], ground: 0x9a9070, groundDark: 0x6a6048, prop: 'pillar', cover: 'ring', mood: { sky: 0x2a3348, haze: 0xc8c0a0, fleck: 0xfff0c0 }, boss: { id: 'boss_ruins', name: 'THE WARDEN', element: 'glow', body: 'golem', hp: 460, power: 1.5, speed: 42, trick: 'SWEEPING LIGHT', pattern: 'sweep', crown: 'halo' } },
  { id: 'shore', name: 'SALT SHORE', elements: ['tide', 'gale'], ground: 0xe0d090, groundDark: 0xb8a868, prop: 'shell', cover: 'scatter', mood: { sky: 0x6ab8e0, haze: 0xf0e8c0, fleck: 0xffffff }, boss: { id: 'boss_shore', name: 'TIDECALLER RAY', element: 'tide', body: 'ray', hp: 380, power: 1.5, speed: 72, trick: 'WAVES ROLL IN', pattern: 'tide', crown: 'fins' } },
  { id: 'desert', name: 'GLASS DESERT', elements: ['volt', 'ember'], ground: 0xe8c078, groundDark: 0xc09050, prop: 'cactus', cover: 'scatter', mood: { sky: 0xe8a060, haze: 0xffd8a0, fleck: 0xfff4c0 }, boss: { id: 'boss_desert', name: 'STORM BEETLE', element: 'volt', body: 'beetle', hp: 400, power: 1.55, speed: 60, trick: 'LIGHTNING STRIKES', pattern: 'rain', crown: 'storm' } },
  { id: 'volcano', name: 'ASHEN PEAK', elements: ['ember', 'stone'], ground: 0x5a3a30, groundDark: 0x3a2018, prop: 'vent', cover: 'ring', mood: { sky: 0x2a1218, haze: 0x6a2a1a, fleck: 0xff8a3a }, boss: { id: 'boss_volcano', name: 'MAGMA WYRM', element: 'ember', body: 'serpent', hp: 480, power: 1.6, speed: 58, trick: 'LAVA VENTS', pattern: 'tide', crown: 'magma' } },
];

/** A boss as something that can fight: its own three attacks. */
export function bossCreature(b: Biome): Creature {
  const base = build(b.boss.id, b.boss.name, b.boss.element, b.boss.body, 'mythic');
  const stock = base.attacks[2].name;
  const boss3 = FINISHERS[b.boss.element].name === stock ? SPECIALS[b.boss.element] : FINISHERS[b.boss.element];
  return {
    ...base,
    name: b.boss.name,
    crown: b.boss.crown,
    hp: b.boss.hp,
    speed: b.boss.speed,
    power: b.boss.power,
    // A boss does not fight with its element's stock three.  The opener is a
    // fan, the middle is its body's own move hitting harder, and the last is
    // the element's OTHER big move -- the one the wild ones of this world do
    // not have -- so every boss opens with something you have not seen.
    attacks: [
      { ...base.attacks[0], kind: 'spread', dmg: Math.round(8 * b.boss.power), cd: 1.1 },
      { ...base.attacks[1], dmg: Math.round(Math.max(12, base.attacks[1].dmg) * 1.1) },
      { ...boss3, dmg: Math.round(Math.max(18, boss3.dmg) * b.boss.power), cd: 6 },
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
