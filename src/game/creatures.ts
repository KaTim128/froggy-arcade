/**
 * ---- CREATURE CLASH: the roster.  Twenty creatures, and no two alike: each
 * has a body nothing else has (its own silhouette, its own way of getting
 * about -- it burrows, hops, scuttles, slithers, hovers, rolls, crawls, flies
 * or walks on two legs, four or eight), an element (what its hits DO), a
 * combat role, and three moves that are its own.
 *
 * NO TIERS.  Nothing here is common or legendary, and nothing is simply
 * better: a tough creature is slow, a fast one is fragile, a creature whose
 * shots go through cover pays for it in health.  What separates them is how
 * they fight.
 *
 * Elements are not rock-paper-scissors: each one changes what a hit DOES --
 * Ember burns, Frost slows, Volt stuns, Tide shoves, Moss mends the hitter,
 * Stone shrugs damage off, Gale is quick, Murk blinds, Glow pierces.
 *
 * Everything here is data and pure functions; the state lives in
 * creatureState, the rules in creatureClash, the fighting in
 * scenes2d/CreatureArena, the drawing in art/creatureArt.
 */

import type { SfxName } from '../core/audio';

export type Element = 'ember' | 'tide' | 'moss' | 'frost' | 'volt' | 'stone' | 'gale' | 'murk' | 'glow';
/** One body to one creature: no shape in the game is worn twice. */
export type Body =
  | 'mole' | 'toad' | 'crab' | 'beetle' | 'serpent' | 'golem' | 'moth' | 'hound' | 'owl' | 'ray'
  | 'wisp' | 'jelly' | 'mantis' | 'spider' | 'roller' | 'sprout' | 'bat' | 'slug' | 'ram' | 'centipede';
/** The ten bosses' bodies: none of them is a normal creature's. */
export type BossBody = 'lich' | 'seraph' | 'hydra' | 'queen' | 'maw' | 'cloud' | 'wyrm' | 'sphinx' | 'kraken' | 'mammoth';

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

/** What a creature is for in a fight. */
export type Role =
  | 'BRAWLER' | 'ALL-ROUNDER' | 'DEFENDER' | 'CHARGER' | 'AMBUSHER' | 'TANK' | 'CONTROLLER' | 'HUNTER' | 'SNIPER' | 'SKIRMISHER'
  | 'GLASS CANNON' | 'SUPPORT' | 'DUELIST' | 'TRAPPER' | 'JUGGERNAUT' | 'AREA CONTROL' | 'DIVER' | 'ZONER' | 'BULLDOZER' | 'HARASSER';

export interface Creature {
  id: string;
  name: string;
  element: Element;
  /** Its shape, and only its: see art/creatureArt. */
  body: Body | BossBody;
  role: Role;
  /** What it moves like, in a word or two: the menu says it. */
  moves: string;
  /** What it is good at, and what it will always cost you. */
  strong: string;
  weak: string;
  hp: number;
  speed: number;
  attacks: [Attack, Attack, Attack];
  /** Its own voice: what its big moves sound like. */
  cry: SfxName;
  /** A boss: its own mechanic (see BOSSES). */
  boss?: BossDef;
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

const A = (name: string, kind: AttackKind, dmg: number, cd: number, reach: number): Attack => ({ name, kind, dmg, cd, reach });

type Def = Omit<Creature, 'boss'>;

/**
 * ---- THE TWENTY.  Health runs 72 to 140 and speed 44 to 78, traded against
 * each other and against what the moves do: the two whose shots pierce cover
 * (the glow ones) are among the thinnest in the game; the tanks crawl.
 */
const ROSTER: Def[] = [
  {
    id: 'mole', name: 'Cindermole', element: 'ember', body: 'mole', role: 'BRAWLER', moves: 'BURROWS',
    strong: 'TOUGH, AND CLOSES IN UNDER FIRE', weak: 'SLOW ON ITS FEET IN THE OPEN', hp: 118, speed: 56, cry: 'crumble',
    attacks: [A('EMBER SPIT', 'bolt', 8, 0.55, 190), A('MAGMA RUSH', 'dash', 16, 3.4, 235), A('FLARE RING', 'nova', 20, 7, 44)],
  },
  {
    id: 'toad', name: 'Brinetoad', element: 'tide', body: 'toad', role: 'ALL-ROUNDER', moves: 'HOPS',
    strong: 'NO WEAK SIDE, AND A SURE QUICK STRIKE', weak: 'NO GREAT SIDE EITHER', hp: 106, speed: 62, cry: 'croak',
    attacks: [A('WATER JET', 'bolt', 8, 0.55, 200), A('TONGUE LASH', 'beam', 13, 2.9, 56), A('WATER GULP', 'mend', 0, 9, 32)],
  },
  {
    id: 'crab', name: 'Kelpcrab', element: 'moss', body: 'crab', role: 'DEFENDER', moves: 'SCUTTLES SIDEWAYS',
    strong: 'HEAVY SHELL, BLOCKS A BIG HIT OUTRIGHT', weak: 'SLOW, AND HITS A LITTLE SOFT', hp: 132, speed: 50, cry: 'item_thud',
    attacks: [A('SEED SHOT', 'bolt', 7, 0.5, 185), A('SHELL UP', 'shield', 0, 6, 1.6), A('KELP WEAVE', 'wall', 0, 7.5, 28)],
  },
  {
    id: 'beetle', name: 'Gritbeetle', element: 'stone', body: 'beetle', role: 'CHARGER', moves: 'SIX LEGS',
    strong: 'ARMOURED, AND THE HARDEST CHARGE', weak: 'NO ANSWER TO A FIGHT AT RANGE', hp: 124, speed: 58, cry: 'crumble',
    attacks: [A('PEBBLE SHOT', 'bolt', 9, 0.7, 175), A('HORN CHARGE', 'dash', 17, 3.4, 235), A('BOULDER TOSS', 'arc', 16, 4.5, 105)],
  },
  {
    id: 'serpent', name: 'Bogviper', element: 'murk', body: 'serpent', role: 'AMBUSHER', moves: 'SLITHERS',
    strong: 'QUICK, AND STRIKES WITH NO TRAVEL TIME', weak: 'THIN: EVERY HIT LANDS FULLY', hp: 94, speed: 68, cry: 'poison_hiss',
    attacks: [A('MIRE GLOB', 'bolt', 9, 0.6, 180), A('COIL SNAP', 'beam', 14, 2.9, 54), A('SHADE SNARE', 'snare', 12, 6, 175)],
  },
  {
    id: 'golem', name: 'Rimegolem', element: 'frost', body: 'golem', role: 'TANK', moves: 'STOMPS ON TWO LEGS',
    strong: 'THE MOST HEALTH AND THE HARDEST HITS', weak: 'SLOWEST IN THE GAME - EASY TO KITE', hp: 140, speed: 44, cry: 'glass_crack',
    attacks: [A('ICE SHARD', 'bolt', 9, 0.7, 195), A('GLACIER SLAB', 'wall', 0, 8, 30), A('HAILBURST', 'spread', 19, 7, 180)],
  },
  {
    id: 'moth', name: 'Zephyrmoth', element: 'gale', body: 'moth', role: 'CONTROLLER', moves: 'FLIES',
    strong: 'FAST, AND FIGHTS ON THE GROUND IT CHOOSES', weak: 'FRAGILE, AND LOSES A STRAIGHT BRAWL', hp: 84, speed: 70, cry: 'wings',
    attacks: [A('GUST', 'bolt', 7, 0.42, 205), A('WING BEAT', 'spread', 8, 3, 155), A('NIGHT DUST', 'mine', 18, 4, 0)],
  },
  {
    id: 'hound', name: 'Sparkhound', element: 'volt', body: 'hound', role: 'HUNTER', moves: 'RUNS ON FOUR LEGS',
    strong: 'RUNS DOWN ANYTHING AND POUNCES FAR', weak: 'MUST BE CLOSE TO DO ITS WORK', hp: 100, speed: 72, cry: 'crow_caw',
    attacks: [A('ZAP', 'bolt', 7, 0.45, 230), A('VOLT POUNCE', 'dash', 15, 3.2, 245), A('STORM HOWL', 'aura', 0, 8.5, 5)],
  },
  {
    id: 'owl', name: 'Lumenowl', element: 'glow', body: 'owl', role: 'SNIPER', moves: 'PERCHES AND GLIDES',
    strong: 'HITS FROM BEHIND COVER, FROM AFAR', weak: 'THE LIGHTEST BONES IN THE GAME', hp: 76, speed: 60, cry: 'wings',
    attacks: [A('LIGHT DART', 'bolt', 8, 0.5, 230), A('PIERCE GAZE', 'beam', 17, 3.2, 120), A('SILENT GLIDE', 'blink', 0, 2.6, 68)],
  },
  {
    id: 'ray', name: 'Brineray', element: 'tide', body: 'ray', role: 'SKIRMISHER', moves: 'GLIDES LOW',
    strong: 'SLIPS OUT OF TROUBLE EVERY TWO SECONDS', weak: 'LITTLE TO SHOW FOR IT IN DAMAGE', hp: 96, speed: 66, cry: 'splash',
    attacks: [A('SALT SPRAY', 'spread', 6, 1.2, 160), A('SEA GLIDE', 'blink', 0, 2.2, 72), A('TIDE WASH', 'nova', 16, 5, 40)],
  },
  {
    id: 'wisp', name: 'Cinderwisp', element: 'ember', body: 'wisp', role: 'GLASS CANNON', moves: 'HOVERS',
    strong: 'THE FASTEST THING ALIVE, AND IT BURNS', weak: 'THE THINNEST HEALTH IN THE GAME', hp: 72, speed: 78, cry: 'arcane_cast',
    attacks: [A('WISP FLAME', 'bolt', 9, 0.5, 210), A('EMBER TRAIL', 'beam', 15, 2.8, 64), A('MAGMA LOB', 'arc', 20, 6, 110)],
  },
  {
    id: 'jelly', name: 'Rimejelly', element: 'frost', body: 'jelly', role: 'SUPPORT', moves: 'DRIFTS, TENTACLES TRAILING',
    strong: 'HEALS ITSELF AND HOLDS YOU STILL', weak: 'DRIFTS SLOWLY AND HITS LIGHTLY', hp: 98, speed: 52, cry: 'water_plip',
    attacks: [A('CHILL STING', 'bolt', 7, 0.55, 190), A('COLD TETHER', 'snare', 10, 5, 170), A('PRISM BLOOM', 'mend', 0, 8, 34)],
  },
  {
    id: 'mantis', name: 'Galemantis', element: 'gale', body: 'mantis', role: 'DUELIST', moves: 'STALKS ON TWO LEGS',
    strong: 'CUTS FAST UP CLOSE, STEPS OUT OF REACH', weak: 'NO REAL SHOT AT RANGE', hp: 92, speed: 70, cry: 'wind_gust',
    attacks: [A('WIND CUTTER', 'spread', 6, 1, 150), A('SCYTHE SLASH', 'beam', 16, 2.4, 46), A('SIDESTEP', 'blink', 0, 2.4, 60)],
  },
  {
    id: 'spider', name: 'Coilspider', element: 'volt', body: 'spider', role: 'TRAPPER', moves: 'EIGHT METAL LEGS',
    strong: 'SEEDS THE FLOOR WITH TRAPS AND WIRE', weak: 'NEEDS TIME: WEAK WHEN RUSHED', hp: 98, speed: 62, cry: 'voice_robot',
    attacks: [A('WIRE BOLT', 'bolt', 7, 0.5, 220), A('WEB MINE', 'mine', 17, 3.6, 0), A('LIVE WIRE', 'snare', 12, 5.5, 180)],
  },
  {
    id: 'roller', name: 'Grittadillo', element: 'stone', body: 'roller', role: 'JUGGERNAUT', moves: 'CURLS UP AND ROLLS',
    strong: 'ROLLS THROUGH YOU, AND DIGS IN HARD', weak: 'ITS SHOT IS SHORT AND SLOW', hp: 128, speed: 60, cry: 'crumble',
    attacks: [A('GRAVEL FLICK', 'bolt', 9, 0.8, 160), A('ROLL OUT', 'dash', 18, 3.6, 255), A('DIG IN', 'shield', 0, 6.5, 1.8)],
  },
  {
    id: 'sprout', name: 'Rootwalker', element: 'moss', body: 'sprout', role: 'AREA CONTROL', moves: 'WALKS ON ITS ROOTS',
    strong: 'GRIPS YOU WITH ROOTS, HEALS AS IT HITS', weak: 'THE SLOWEST WALKER BUT ONE', hp: 116, speed: 48, cry: 'branch_creak',
    attacks: [A('THORN DART', 'bolt', 8, 0.6, 185), A('ROOT GRIP', 'snare', 11, 5, 165), A('SPORE BURST', 'nova', 19, 6.5, 46)],
  },
  {
    id: 'bat', name: 'Duskbat', element: 'murk', body: 'bat', role: 'DIVER', moves: 'FLITS ON LEATHER WINGS',
    strong: 'DIVES IN, BLINDS YOU, IS GONE', weak: 'FOLDS UP UNDER A FEW GOOD HITS', hp: 80, speed: 76, cry: 'wings',
    attacks: [A('ECHO SHRIEK', 'spread', 7, 1.1, 150), A('SHADOW DIVE', 'dash', 15, 3, 250), A('INK CLOUD', 'mine', 16, 4.5, 0)],
  },
  {
    id: 'slug', name: 'Magmaslug', element: 'ember', body: 'slug', role: 'ZONER', moves: 'CRAWLS, LEAVES A TRAIL',
    strong: 'OWNS THE FLOOR: LOBS AND LAVA TRAPS', weak: 'CRAWLS - THE EASIEST THING TO OUTRUN', hp: 120, speed: 44, cry: 'poison_hiss',
    attacks: [A('MAGMA GLOB', 'arc', 14, 2.8, 110), A('CINDER TRAIL', 'mine', 18, 3.4, 0), A('MOLTEN SKIN', 'aura', 0, 9, 5)],
  },
  {
    id: 'ram', name: 'Frostram', element: 'frost', body: 'ram', role: 'BULLDOZER', moves: 'GALLOPS, HORNS DOWN',
    strong: 'THE LONGEST CHARGE, AND A STAMP TO FOLLOW', weak: 'COMMITS HARD: MISS, AND IT IS OPEN', hp: 112, speed: 64, cry: 'bin_land',
    attacks: [A('FROST SNORT', 'bolt', 8, 0.65, 180), A('RAM CHARGE', 'dash', 18, 3.8, 270), A('HOOF STAMP', 'nova', 18, 6, 40)],
  },
  {
    id: 'centipede', name: 'Lumenpede', element: 'glow', body: 'centipede', role: 'HARASSER', moves: 'A HUNDRED LEGS',
    strong: 'SHOTS THROUGH COVER, ALL DAY LONG', weak: 'PAPER-THIN FOR WHAT IT CAN DO', hp: 80, speed: 64, cry: 'leaf_rustle',
    attacks: [A('LUMEN SPIT', 'bolt', 7, 0.45, 220), A('FORK SPIT', 'spread', 7, 2.4, 170), A('BRIGHT COIL', 'aura', 0, 8, 5)],
  },
];

/**
 * ---- THE TEN BOSSES.  Ladder only: the last fight of a run, one of these
 * at random.  None is a normal creature made bigger -- each is a body of its
 * own, with a mechanic of its own (`pattern`), and only one of them brings
 * the sky down.
 *
 *   teleport   it vanishes and comes back beside you, wherever you hide
 *   meteor     stars fall where you are and where you would run
 *   tribeam    three heads breathe three lines across the floor
 *   webs       it webs the floor round you: get caught and you are held
 *   roots      roots come up under your feet and hold you
 *   lightning  a line of strikes marches across the arena at you
 *   burrow     it goes under and comes up beside you
 *   charge     it lines you up and crosses the arena in one bound
 *   tentacles  a wall of tentacles rolls across from one side
 *   quake      it stamps, and rings of shockwave run out from it
 */
export type BossPattern = 'teleport' | 'meteor' | 'tribeam' | 'webs' | 'roots' | 'lightning' | 'burrow' | 'charge' | 'tentacles' | 'quake';

export interface BossDef {
  pattern: BossPattern;
  /** What the menu calls its mechanic. */
  trick: string;
  /** A line about it, for the final stage. */
  blurb: string;
  /** Its mechanic: how many marks, how wide, how often, and how hard. */
  every: number;
  n: number;
  r: number;
  dmg: number;
}

type BossSpec = Def & { boss: BossDef };

export const BOSSES: BossSpec[] = [
  {
    id: 'b_lich', name: 'The Lantern Lich', element: 'murk', body: 'lich', role: 'AREA CONTROL', moves: 'FLOATS, ROBES TRAILING',
    strong: 'COMES THROUGH WALLS: NOWHERE IS SAFE', weak: 'FRAIL BETWEEN ITS BLINKS', hp: 400, speed: 48, cry: 'voice_whisper',
    attacks: [A('GRAVE LIGHT', 'spread', 10, 1.1, 170), A('SOUL TETHER', 'snare', 14, 5, 180), A('DEATHKNELL', 'nova', 26, 6, 52)],
    boss: { pattern: 'teleport', trick: 'BLINKS TO YOUR SIDE', blurb: 'A NECROMANCER WITH A LANTERN OF SOULS. HIDE, AND IT FINDS YOU.', every: 4.5, n: 3, r: 14, dmg: 13 },
  },
  {
    id: 'b_seraph', name: 'Starfall Seraph', element: 'ember', body: 'seraph', role: 'ZONER', moves: 'HANGS IN THE AIR ON SIX WINGS',
    strong: 'CALLS DOWN METEORS', weak: 'SLOW TO TURN, AND ITS WINGS ARE WIDE', hp: 420, speed: 42, cry: 'arcane_blast',
    attacks: [A('SUNSPARK', 'bolt', 11, 0.8, 210), A('WING FLARE', 'spread', 12, 3, 170), A('HALO BURST', 'nova', 24, 6, 50)],
    boss: { pattern: 'meteor', trick: 'METEORS FALL', blurb: 'IT RINGS THE SKY LIKE A BELL, AND THE STARS FALL. WATCH THE SHADOWS.', every: 5.5, n: 3, r: 20, dmg: 26 },
  },
  {
    id: 'b_hydra', name: 'The Mire Hydra', element: 'murk', body: 'hydra', role: 'ZONER', moves: 'WADES ON A HEAVY BODY',
    strong: 'THREE HEADS, THREE LINES OF BREATH', weak: 'SLOW, AND THE GAPS BETWEEN THE LINES', hp: 460, speed: 38, cry: 'poison_hiss',
    attacks: [A('BILE SPIT', 'bolt', 11, 0.7, 190), A('NECK LASH', 'beam', 18, 3, 70), A('MIRE ROAR', 'nova', 24, 6.5, 48)],
    boss: { pattern: 'tribeam', trick: 'THREE HEADS BREATHE', blurb: 'THREE NECKS, ONE TEMPER. STAND BETWEEN THE BREATHS.', every: 4.2, n: 3, r: 7, dmg: 18 },
  },
  {
    id: 'b_queen', name: 'The Brass Matriarch', element: 'volt', body: 'queen', role: 'TRAPPER', moves: 'EIGHT BRASS LEGS',
    strong: 'WEBS THE FLOOR AROUND YOU', weak: 'HER BODY IS SLOW TO TURN', hp: 420, speed: 54, cry: 'voice_robot',
    attacks: [A('ARC NEEDLE', 'bolt', 10, 0.55, 230), A('COPPER WEB', 'snare', 14, 4.5, 190), A('SURGE MINE', 'mine', 22, 3.5, 0)],
    boss: { pattern: 'webs', trick: 'WEBS THE FLOOR', blurb: 'A CLOCKWORK SPIDER-QUEEN. HER WEBS HOLD WHATEVER STEPS IN THEM.', every: 4.5, n: 4, r: 13, dmg: 11 },
  },
  {
    id: 'b_maw', name: 'The Green Maw', element: 'moss', body: 'maw', role: 'DEFENDER', moves: 'DRAGS ITSELF ON ROOTS',
    strong: 'ROOTS FROM BELOW, AND IT HEALS', weak: 'BARELY MOVES', hp: 480, speed: 30, cry: 'branch_creak',
    attacks: [A('SEED VOLLEY', 'spread', 10, 1.2, 170), A('SAP MEND', 'mend', 0, 10, 34), A('MAW SNAP', 'nova', 26, 5.5, 54)],
    boss: { pattern: 'roots', trick: 'ROOTS GRAB', blurb: 'A FLYTRAP AS BIG AS A CART. ITS ROOTS ARE EVERYWHERE YOU STAND.', every: 3.8, n: 3, r: 15, dmg: 12 },
  },
  {
    id: 'b_cloud', name: 'Thunderhead', element: 'gale', body: 'cloud', role: 'HARASSER', moves: 'DRIFTS FAST, LOW AND HEAVY',
    strong: 'LIGHTNING MARCHES AT YOU', weak: 'NOTHING SOLID TO IT - LOW HEALTH', hp: 360, speed: 64, cry: 'wind_gust',
    attacks: [A('SQUALL', 'spread', 9, 0.9, 200), A('DOWNDRAFT', 'blink', 0, 3, 80), A('CYCLONE EYE', 'nova', 22, 6, 50)],
    boss: { pattern: 'lightning', trick: 'LIGHTNING WALKS', blurb: 'A STORM WITH ONE EYE IN IT. THE BOLTS WALK STRAIGHT AT YOU.', every: 4, n: 7, r: 11, dmg: 14 },
  },
  {
    id: 'b_wyrm', name: 'The Deep Wyrm', element: 'stone', body: 'wyrm', role: 'AMBUSHER', moves: 'SWIMS THROUGH THE GROUND',
    strong: 'GOES UNDER AND COMES UP BESIDE YOU', weak: 'EXPOSED EACH TIME IT SURFACES', hp: 440, speed: 52, cry: 'crumble',
    attacks: [A('GRAVEL SPRAY', 'spread', 10, 1, 180), A('TAIL CRACK', 'beam', 18, 2.8, 64), A('CAVE IN', 'arc', 24, 5.5, 120)],
    boss: { pattern: 'burrow', trick: 'SURFACES BESIDE YOU', blurb: 'A WYRM THAT SWIMS IN STONE. FEEL FOR WHERE IT WILL COME UP.', every: 4.5, n: 1, r: 18, dmg: 18 },
  },
  {
    id: 'b_sphinx', name: 'The Mirror Sphinx', element: 'glow', body: 'sphinx', role: 'CHARGER', moves: 'PROWLS ON FOUR PAWS',
    strong: 'A MIRROR GUARD, THEN A POUNCE ACROSS THE ARENA', weak: 'THE POUNCE IS TELEGRAPHED', hp: 400, speed: 58, cry: 'glass_crack',
    attacks: [A('GLINT DART', 'bolt', 10, 0.6, 230), A('MIRROR MASK', 'shield', 0, 6, 1.6), A('SUNBEAM', 'beam', 22, 5, 130)],
    boss: { pattern: 'charge', trick: 'POUNCES ACROSS', blurb: 'A WINGED LION IN A MASK OF GLASS. WATCH THE LINE IT DRAWS.', every: 4.5, n: 1, r: 9, dmg: 22 },
  },
  {
    id: 'b_kraken', name: 'The Salt Kraken', element: 'tide', body: 'kraken', role: 'AREA CONTROL', moves: 'HAULS ITSELF ON EIGHT ARMS',
    strong: 'A WALL OF TENTACLES ACROSS THE FLOOR', weak: 'ITS HEAD IS AN EASY TARGET', hp: 440, speed: 40, cry: 'splash',
    attacks: [A('INK JET', 'bolt', 11, 0.7, 200), A('UNDERTOW', 'snare', 13, 5, 180), A('WHIRLPOOL', 'nova', 24, 6, 52)],
    boss: { pattern: 'tentacles', trick: 'TENTACLES SWEEP', blurb: 'IT CAME UP OUT OF THE SALT. ITS ARMS ROLL IN LIKE WAVES.', every: 5, n: 5, r: 13, dmg: 13 },
  },
  {
    id: 'b_mammoth', name: 'The Old Mammoth', element: 'frost', body: 'mammoth', role: 'JUGGERNAUT', moves: 'TRAMPLES ON FOUR LEGS',
    strong: 'STAMPS, AND THE GROUND RINGS', weak: 'THE SLOWEST THING IN THE ARENA', hp: 480, speed: 36, cry: 'bin_land',
    attacks: [A('FROST BREATH', 'spread', 11, 1.3, 160), A('TUSK SWEEP', 'beam', 20, 3, 60), A('TRAMPLE', 'dash', 22, 5, 220)],
    boss: { pattern: 'quake', trick: 'SHOCKWAVES', blurb: 'TUSKS LIKE ICICLES. WHEN IT STAMPS, JUMP THE RINGS OR STAND FAR OFF.', every: 4.8, n: 10, r: 9, dmg: 14 },
  },
];

export const CREATURES: Creature[] = ROSTER;

/**
 * ---- WHAT MUST STAY TRUE, checked in dev where it is easiest to break: one
 * body to one creature (and none worn by a boss), every move name its own,
 * and none longer than the arena's buttons can print.
 */
export const MOVE_NAME_MAX = 12;
if (import.meta.env?.DEV) {
  const bodies = [...ROSTER, ...BOSSES].map((c) => c.body);
  const dupeBody = bodies.find((b, i) => bodies.indexOf(b) !== i);
  if (dupeBody) throw new Error(`creatures: two creatures share the body "${dupeBody}"`);
  const names = [...ROSTER, ...BOSSES].flatMap((c) => c.attacks.map((a) => a.name));
  const dupe = names.find((n, i) => names.indexOf(n) !== i);
  if (dupe) throw new Error(`creatures: two creatures share the move "${dupe}"`);
  const long = names.find((n) => n.length > MOVE_NAME_MAX);
  if (long) throw new Error(`creatures: "${long}" is too long for an attack button`);
}

export const creatureById = (id: string): Creature | undefined => CREATURES.find((c) => c.id === id) ?? BOSSES.find((b) => b.id === id);
export const bossById = (id: string): Creature | undefined => BOSSES.find((b) => b.id === id);

/** The three you can choose from for nothing, once. */
export const STARTERS = ['mole', 'toad', 'crab'];

/**
 * ---- AN OLD SAVE'S CREATURES.  The roster used to be eleven bodies in nine
 * colours each (`ember_mole`, `frost_owl`...) plus one rare toad.  Each one
 * comes across as the creature that now owns its body -- same shape, so the
 * one you had is the one you see -- and nothing is lost.
 */
export function migrateCreatureId(old: string): string | null {
  if (CREATURES.some((c) => c.id === old)) return old;
  if (old === 'lily_sovereign') return 'toad';
  const body = old.split('_')[1];
  return CREATURES.some((c) => c.id === body) ? body : null;
}

// ------------------------------------------------------------------ recruit

/** One pack, one price: nine different creatures face down, keep one. */
export const PACK_COST = 50;

/** Nine different creatures, every one as likely as any other. */
export function rollPack(rng: () => number = Math.random): string[] {
  const pool = CREATURES.map((c) => c.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 9);
}

// ------------------------------------------------------------------ biomes

/**
 * ---- WHAT STANDS IN THE WAY, AND WHAT IT IS MADE OF.
 *
 * The barrier IS the place: a stand of trees in the fields, a fallen column
 * in the ruins, a crag in the caves, a lava crust on the peak.  `cover` says
 * how they are laid out, so the arena reads as somewhere.
 *
 *  line     a run of them across the field, a wall you go round or through a gap
 *  grove    clumps, like trees grow
 *  scatter  singly, anywhere
 *  ring     round the edges, leaving the middle open
 */
export type CoverShape = 'rock' | 'tuft' | 'tree' | 'ice' | 'reed' | 'pillar' | 'shell' | 'cactus' | 'vent';
export type CoverPlan = 'line' | 'grove' | 'scatter' | 'ring';

export interface Biome {
  id: string;
  name: string;
  /**
   * WHO LIVES HERE: the creatures a zone battle in this place draws from --
   * the ones that fit it (the moles and slugs in the caves, the rays and
   * crabs on the shore).
   */
  pool: string[];
  ground: number;
  groundDark: number;
  prop: CoverShape;
  cover: CoverPlan;
  /** The light and air of the place, painted over the floor. */
  mood: { sky: number; haze: number; fleck: number };
}

export const BIOMES: Biome[] = [
  { id: 'caves', name: 'ECHO CAVES', pool: ['mole', 'bat', 'spider', 'roller', 'slug'], ground: 0x4a4440, groundDark: 0x2e2a28, prop: 'rock', cover: 'line', mood: { sky: 0x120e14, haze: 0x2a2230, fleck: 0x8a7a9a } },
  { id: 'fields', name: 'WINDY FIELDS', pool: ['moth', 'mantis', 'hound', 'owl', 'sprout'], ground: 0x8ab85a, groundDark: 0x5a8a3a, prop: 'tree', cover: 'grove', mood: { sky: 0x9ad0e8, haze: 0xc8e8a0, fleck: 0xf0e880 } },
  { id: 'forests', name: 'DEEPWOOD', pool: ['sprout', 'serpent', 'beetle', 'centipede', 'owl'], ground: 0x3a6a2e, groundDark: 0x24461c, prop: 'tree', cover: 'scatter', mood: { sky: 0x16220f, haze: 0x2a4a22, fleck: 0x8ad06a } },
  { id: 'frozen', name: 'FROZEN PASS', pool: ['golem', 'ram', 'jelly', 'hound', 'moth'], ground: 0xd8ecf4, groundDark: 0xa0c4d4, prop: 'ice', cover: 'line', mood: { sky: 0xbfd8e8, haze: 0xeaf6ff, fleck: 0xffffff } },
  { id: 'swamps', name: 'SOURMIRE', pool: ['serpent', 'toad', 'slug', 'bat', 'sprout'], ground: 0x4a5a3a, groundDark: 0x2e3a24, prop: 'reed', cover: 'scatter', mood: { sky: 0x202a1e, haze: 0x3a5a3a, fleck: 0x9ab06a } },
  { id: 'ruins', name: 'SUNKEN RUINS', pool: ['centipede', 'golem', 'spider', 'owl', 'wisp'], ground: 0x9a9070, groundDark: 0x6a6048, prop: 'pillar', cover: 'ring', mood: { sky: 0x2a3348, haze: 0xc8c0a0, fleck: 0xfff0c0 } },
  { id: 'shore', name: 'SALT SHORE', pool: ['crab', 'ray', 'toad', 'jelly', 'mantis'], ground: 0xe0d090, groundDark: 0xb8a868, prop: 'shell', cover: 'scatter', mood: { sky: 0x6ab8e0, haze: 0xf0e8c0, fleck: 0xffffff } },
  { id: 'desert', name: 'GLASS DESERT', pool: ['roller', 'beetle', 'hound', 'wisp', 'mantis'], ground: 0xe8c078, groundDark: 0xc09050, prop: 'cactus', cover: 'scatter', mood: { sky: 0xe8a060, haze: 0xffd8a0, fleck: 0xfff4c0 } },
  { id: 'volcano', name: 'ASHEN PEAK', pool: ['wisp', 'slug', 'mole', 'ram', 'roller'], ground: 0x5a3a30, groundDark: 0x3a2018, prop: 'vent', cover: 'ring', mood: { sky: 0x2a1218, haze: 0x6a2a1a, fleck: 0xff8a3a } },
];

/**
 * A zone's opponent: one of the creatures that lives there, at random --
 * never the one you met there last time, while there is another to meet.
 */
export function zoneFoe(b: Biome, last: string | null, rng: () => number = Math.random): Creature {
  const pool = b.pool.filter((id) => id !== last);
  const id = (pool.length ? pool : b.pool)[Math.floor(rng() * (pool.length || b.pool.length))];
  return creatureById(id)!;
}

// ----------------------------------------------------------------- economy

/** A zone battle: a small stake in, the win paid out. */
export const BATTLE_COST = 2;
export const BATTLE_WIN = 5;
/** The ladder: one entry fee, five normal fights, one boss. */
export const LADDER_COST = 50;
export const LADDER_LEVELS = 5;
export const LADDER_WIN = 5;
export const LADDER_BOSS_WIN = 25;
export const MAX_OWNED = 2;

/**
 * THE LADDER'S OPPONENTS, drawn at the start of a run (so reloading cannot
 * reroll them): five different normal creatures, a place for each fight,
 * and the boss -- not the same one as the last run's, where there is a
 * choice.
 */
export function rollLadder(lastBoss: string | null, rng: () => number = Math.random): { foes: string[]; places: string[]; boss: string } {
  const pool = CREATURES.map((c) => c.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const bosses = BOSSES.map((b) => b.id).filter((id) => id !== lastBoss);
  const places = Array.from({ length: LADDER_LEVELS + 1 }, () => BIOMES[Math.floor(rng() * BIOMES.length)].id);
  return { foes: pool.slice(0, LADDER_LEVELS), places, boss: bosses[Math.floor(rng() * bosses.length)] };
}
