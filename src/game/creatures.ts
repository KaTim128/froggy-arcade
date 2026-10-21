/**
 * ---- CREATURE CLASH: the roster.  Fifty creatures, and no two alike: each
 * has a body nothing else has (its own silhouette, its own way of getting
 * about -- it burrows, hops, scuttles, slithers, hovers, rolls, crawls, flies
 * or walks on two legs, four or eight), an element (what its hits DO), a
 * combat role, and three moves: one plain attack of its own, and two of the
 * 120 specials (game/specials) -- each of which belongs to one creature or
 * boss in the whole game, and no other.
 *
 * NO TIERS.  Nothing here is common or legendary, and nothing is simply
 * better: a tough creature is slow, a fast one is fragile, a creature whose
 * shots go through cover pays for it in health.  What separates them is how
 * they fight.
 *
 * Elements are not rock-paper-scissors: each one changes what a hit DOES --
 * Ember burns, Frost slows, Volt stuns, Tide shoves, Moss mends the hitter,
 * Stone shrugs damage off, Gale speeds the hitter up, Murk blinds, Glow
 * pierces.
 *
 * Everything here is data and pure functions; the state lives in
 * creatureState, the rules in creatureClash, the fighting in
 * scenes2d/CreatureArena, the drawing in art/creatureArt.
 */

import type { SfxName } from '../core/audio';
import { SPECIALS, SPECIAL_LIST } from './specials';

export type Element = 'ember' | 'tide' | 'moss' | 'frost' | 'volt' | 'stone' | 'gale' | 'murk' | 'glow';
/** One body to one creature: no shape in the game is worn twice. */
export type Body =
  | 'mole' | 'toad' | 'crab' | 'beetle' | 'serpent' | 'golem' | 'moth' | 'hound' | 'owl' | 'ray'
  | 'wisp' | 'jelly' | 'mantis' | 'spider' | 'roller' | 'sprout' | 'bat' | 'slug' | 'ram' | 'centipede'
  | 'tortoise' | 'hare' | 'scorpion' | 'puffer' | 'penguin' | 'shroom' | 'gecko' | 'angler' | 'stag' | 'yeti'
  | 'boar' | 'heron' | 'urchin' | 'newt' | 'seahorse' | 'bear' | 'sloth' | 'bee' | 'ferret' | 'rhino'
  | 'eel' | 'obelisk' | 'hedgehog' | 'fox' | 'falcon' | 'crow' | 'lynx' | 'wraith' | 'firefly' | 'snail';
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

/**
 * ---- WHAT MAKES A MOVE ITS OWN.  Every move has one special on top of its
 * kind (see game/attackInfo `MODS` for what each one does, in words, and
 * scenes2d/CreatureArena for how):
 *
 *   on a hit     poison mark shred execute drain pull push root silence
 *                weaken chill stagger crit
 *   in flight    homing bounce wave boomerang grow drill split   (shots only)
 *   where it     linger echo vortex                              (areas, lines, charges)
 *   lands
 *   on you       haste guard regen cleanse                       (any move)
 *   guards only  reflect thorns
 *   blinks only  strike
 *   none         the plain move, as it comes
 */
export type Mod =
  | 'none'
  | 'poison' | 'mark' | 'shred' | 'execute' | 'drain' | 'pull' | 'push' | 'root' | 'silence' | 'weaken' | 'chill' | 'stagger' | 'crit'
  | 'homing' | 'bounce' | 'wave' | 'boomerang' | 'grow' | 'drill' | 'split'
  | 'linger' | 'echo' | 'vortex'
  | 'haste' | 'guard' | 'regen' | 'cleanse'
  | 'reflect' | 'thorns'
  | 'strike';

export const HIT_MODS: Mod[] = ['poison', 'mark', 'shred', 'execute', 'drain', 'pull', 'push', 'root', 'silence', 'weaken', 'chill', 'stagger', 'crit'];
export const PATH_MODS: Mod[] = ['homing', 'bounce', 'wave', 'boomerang', 'grow', 'drill', 'split'];
export const AREA_MODS: Mod[] = ['linger', 'echo', 'vortex'];
export const SELF_MODS: Mod[] = ['haste', 'guard', 'regen', 'cleanse'];
/** The kinds that fly as shots, and the ones that land somewhere as an area. */
export const SHOT_KINDS: AttackKind[] = ['bolt', 'spread', 'snare'];
export const AREA_KINDS: AttackKind[] = ['nova', 'arc', 'mine', 'beam', 'dash'];

export interface Attack {
  name: string;
  kind: AttackKind;
  dmg: number;
  /** Seconds before it can be used again. */
  cd: number;
  /** Projectile speed / dash speed / beam length, by kind. */
  reach: number;
  /** A generic special the arena runs for it (see `Mod`), or 'none'. */
  mod: Mod;
  /** The special this move IS (game/specials), or absent for a plain attack. */
  sp?: string;
}

/** What a creature is for in a fight, in a word or two (TANK, SNIPER, TRICKSTER...). */
export type Role = string;

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
  ember: { name: 'EMBER', col: 0xe8642a, dark: 0x9a3418, light: 0xffb060, effect: 'YOUR HITS SET THEM ALIGHT' },
  tide: { name: 'TIDE', col: 0x3a8ad8, dark: 0x1e4e8a, light: 0x9ad0ff, effect: 'YOUR HITS KNOCK THEM BACK' },
  moss: { name: 'MOSS', col: 0x5aa83a, dark: 0x2e6a1e, light: 0xb0e080, effect: 'YOUR HITS HEAL YOU A LITTLE' },
  frost: { name: 'FROST', col: 0x8adcf0, dark: 0x3a8aa8, light: 0xe8fcff, effect: 'YOUR HITS SLOW THEM FOR 2S' },
  volt: { name: 'VOLT', col: 0xf0d030, dark: 0xa08010, light: 0xfff4a0, effect: 'YOUR HITS STUN THEM BRIEFLY' },
  stone: { name: 'STONE', col: 0x9a8a70, dark: 0x5a4e3e, light: 0xd0c4a8, effect: 'YOU TAKE 15% LESS DAMAGE' },
  gale: { name: 'GALE', col: 0xb8e8c8, dark: 0x5a9a7a, light: 0xf0fff4, effect: 'LANDING A HIT SPEEDS YOU UP' },
  murk: { name: 'MURK', col: 0x7a4a9a, dark: 0x40245a, light: 0xc090e0, effect: 'YOUR HITS CLOUD THEIR SIGHT' },
  glow: { name: 'GLOW', col: 0xf0e8c0, dark: 0xa89a60, light: 0xffffff, effect: 'YOUR SHOTS GO THROUGH COVER' },
};
export const ELEMENT_LIST = Object.keys(ELEMENTS) as Element[];

const A = (name: string, kind: AttackKind, dmg: number, cd: number, reach: number, mod: Mod = 'none'): Attack => ({ name, kind, dmg, cd, reach, mod });
/** A plain attack: no special at all. */
const N = (name: string, kind: AttackKind, dmg: number, cd: number, reach: number): Attack => A(name, kind, dmg, cd, reach);
/** One of the 120 specials, as a move. */
const SP = (id: string): Attack => {
  const d = SPECIALS[id];
  if (!d) throw new Error(`creatures: no special "${id}"`);
  return { name: d.name, kind: d.kind, dmg: d.dmg, cd: d.cd, reach: d.reach, mod: d.mod, sp: d.id };
};

type Def = Omit<Creature, 'boss'>;

/**
 * ---- THE FIFTY.  Health runs about 74 to 140 and speed 42 to 82, traded
 * against each other and against what the moves do: the glow ones, whose
 * shots go through cover, are among the thinnest in the game; the tanks
 * crawl.  Each has one plain attack (`N`: a swipe up close, or a shot) and
 * two specials (game/specials), and no special belongs to two creatures.
 */
const C = (
  d: Omit<Def, 'attacks'> & { normal: Attack; specials: [string, string] },
): Def => {
  const { normal, specials, ...rest } = d;
  return { ...rest, attacks: [normal, SP(specials[0]), SP(specials[1])] };
};

const ROSTER: Def[] = [
  // ------------------------------------------------------------------ ember
  C({ id: 'mole', name: 'Cindermole', element: 'ember', body: 'mole', role: 'BRAWLER', moves: 'BURROWS', strong: 'TOUGH, AND CLOSES IN UNDER FIRE', weak: 'SLOW ON ITS FEET IN THE OPEN', hp: 118, speed: 56, cry: 'crumble', normal: N('CLAW SWIPE', 'beam', 11, 0.65, 34), specials: ['magma_rush', 'flare_ring'] }),
  C({ id: 'wisp', name: 'Cinderwisp', element: 'ember', body: 'wisp', role: 'GLASS CANNON', moves: 'HOVERS', strong: 'THE FASTEST FLAME, AND IT HITS HARD', weak: 'ALMOST NO HEALTH', hp: 72, speed: 78, cry: 'arcane_cast', normal: N('FLICKER', 'bolt', 9, 0.5, 210), specials: ['splitflame', 'afterburn'] }),
  C({ id: 'slug', name: 'Magmaslug', element: 'ember', body: 'slug', role: 'ZONER', moves: 'CRAWLS, LEAVES A TRAIL', strong: 'OWNS THE FLOOR WITH RIVERS OF LAVA', weak: 'CRAWLS - THE EASIEST THING TO OUTRUN', hp: 120, speed: 44, cry: 'poison_hiss', normal: N('OOZE SPIT', 'bolt', 9, 0.75, 170), specials: ['lava_flow', 'molten_skin'] }),
  C({ id: 'scorpion', name: 'Ashscorpion', element: 'ember', body: 'scorpion', role: 'STALKER', moves: 'SCUTTLES, TAIL HIGH', strong: 'A POISON STING, AND IT VANISHES UNDERGROUND', weak: 'CLUMSY ONCE ITS STING IS SPENT', hp: 104, speed: 62, cry: 'poison_hiss', normal: N('PINCER NIP', 'beam', 10, 0.6, 32), specials: ['venom_sting', 'ash_burrow'] }),
  C({ id: 'boar', name: 'Forgeboar', element: 'ember', body: 'boar', role: 'CHARGER', moves: 'TROTS ON SHORT LEGS', strong: 'SLAMS YOU INTO WALLS, AND TAKES A BEATING', weak: 'ITS ARMOUR SLOWS IT RIGHT DOWN', hp: 124, speed: 56, cry: 'bin_land', normal: N('TUSK GORE', 'beam', 12, 0.7, 34), specials: ['bellows', 'slag_armour'] }),
  C({ id: 'heron', name: 'Pyreheron', element: 'ember', body: 'heron', role: 'SNIPER', moves: 'WADES ON STILT LEGS', strong: 'A LONG LANCE THAT FINISHES YOU OFF', weak: 'SLOW TO AIM, AND THIN-LEGGED', hp: 88, speed: 58, cry: 'wings', normal: N('BEAK JAB', 'beam', 10, 0.6, 38), specials: ['heat_lance', 'ember_plumes'] }),
  // ------------------------------------------------------------------- tide
  C({ id: 'toad', name: 'Brinetoad', element: 'tide', body: 'toad', role: 'ALL-ROUNDER', moves: 'HOPS', strong: 'NO WEAK SIDE: PULLS YOU IN, EATS YOUR SHOTS', weak: 'NO GREAT SIDE EITHER', hp: 106, speed: 62, cry: 'croak', normal: N('WATER JET', 'bolt', 8, 0.55, 200), specials: ['tongue_lash', 'gulp'] }),
  C({ id: 'ray', name: 'Brineray', element: 'tide', body: 'ray', role: 'SKIRMISHER', moves: 'GLIDES LOW', strong: 'SLIPS FREE OF ANYTHING EVERY FEW SECONDS', weak: 'LITTLE DAMAGE TO SHOW FOR IT', hp: 96, speed: 66, cry: 'splash', normal: N('FIN SLAP', 'beam', 9, 0.55, 34), specials: ['sea_glide', 'rolling_swell'] }),
  C({ id: 'puffer', name: 'Spinepuffer', element: 'tide', body: 'puffer', role: 'BRISTLER', moves: 'FLOATS, AND SWELLS UP', strong: 'SENDS SHOTS STRAIGHT BACK, AND CAGES YOU', weak: 'SLOW, AND ITS SPINES ARE SHORT', hp: 118, speed: 50, cry: 'water_plip', normal: N('SPINE FLICK', 'bolt', 8, 0.65, 170), specials: ['puff_up', 'bubble_cage'] }),
  C({ id: 'urchin', name: 'Reefurchin', element: 'tide', body: 'urchin', role: 'TRAPPER', moves: 'CREEPS ON TUBE FEET', strong: 'SPINES EVERYWHERE: TRAPS AND A RING', weak: 'CREEPS - IT CANNOT CHASE', hp: 112, speed: 46, cry: 'water_plip', normal: N('NEEDLE SPIT', 'bolt', 7, 0.5, 180), specials: ['urchin_field', 'spine_shed'] }),
  C({ id: 'newt', name: 'Gillnewt', element: 'tide', body: 'newt', role: 'SUPPORT', moves: 'WRIGGLES', strong: 'HEALS FASTER THAN YOU CAN HURT IT, IF YOU LET IT', weak: 'SOFT, AND MUST STAND STILL TO MEND', hp: 100, speed: 60, cry: 'croak', normal: N('BUBBLE POP', 'bolt', 7, 0.55, 190), specials: ['regrowth', 'slick_spit'] }),
  C({ id: 'seahorse', name: 'Tidesteed', element: 'tide', body: 'seahorse', role: 'DUELIST', moves: 'BOBS UPRIGHT', strong: 'DRAGS YOU ABOUT, AND BENDS YOUR SHOTS AWAY', weak: 'LIGHT HITS AT RANGE', hp: 98, speed: 64, cry: 'splash', normal: N('SNOUT SPRAY', 'bolt', 8, 0.6, 195), specials: ['riptide_dash', 'current_ward'] }),
  // ------------------------------------------------------------------- moss
  C({ id: 'crab', name: 'Kelpcrab', element: 'moss', body: 'crab', role: 'DEFENDER', moves: 'SCUTTLES SIDEWAYS', strong: 'A HEAVY SHELL AND A WALL OF KELP', weak: 'SLOW, AND HITS A LITTLE SOFT', hp: 132, speed: 50, cry: 'item_thud', normal: N('SEED SHOT', 'bolt', 7, 0.5, 185), specials: ['shell_up', 'kelp_weave'] }),
  C({ id: 'sprout', name: 'Rootwalker', element: 'moss', body: 'sprout', role: 'AREA CONTROL', moves: 'WALKS ON ITS ROOTS', strong: 'ROOTS YOU, THEN SPOILS YOUR AIM', weak: 'THE SLOWEST WALKER BUT ONE', hp: 116, speed: 48, cry: 'branch_creak', normal: N('THORN DART', 'bolt', 8, 0.6, 185), specials: ['root_grip', 'sneeze_spores'] }),
  C({ id: 'stag', name: 'Thornstag', element: 'moss', body: 'stag', role: 'WARDEN', moves: 'GALLOPS ON FOUR TALL LEGS', strong: 'ANTLERS THAT PIN YOU, AND IT CLEANS ITSELF', weak: 'ITS OWN BLOWS ARE SHORT', hp: 114, speed: 62, cry: 'branch_creak', normal: N('ANTLER BUTT', 'beam', 11, 0.65, 36), specials: ['antler_rush', 'forest_air'] }),
  C({ id: 'bear', name: 'Barkbear', element: 'moss', body: 'bear', role: 'BRUISER', moves: 'LUMBERS', strong: 'BARK SOAKS UP BLOWS; HONEY GLUES YOU DOWN', weak: 'NOTHING AT RANGE', hp: 136, speed: 50, cry: 'bin_land', normal: N('PAW MAUL', 'beam', 13, 0.75, 36), specials: ['bark_hide', 'honey_slam'] }),
  C({ id: 'sloth', name: 'Mossloth', element: 'moss', body: 'sloth', role: 'TANK', moves: 'HANGS AND CREEPS', strong: 'SLEEPS OFF ITS WOUNDS, AND KEEPS YOU CLOSE', weak: 'THE SLOWEST THING ALIVE', hp: 140, speed: 42, cry: 'leaf_rustle', normal: N('SLOW SWIPE', 'beam', 12, 0.9, 38), specials: ['hibernate', 'vine_leash'] }),
  C({ id: 'bee', name: 'Pollenbee', element: 'moss', body: 'bee', role: 'SWARMER', moves: 'BUZZES', strong: 'A SWARM OF DRONES, AND IT FEEDS ON YOU', weak: 'FRAGILE ONCE THE DRONES ARE GONE', hp: 86, speed: 72, cry: 'wings', normal: N('STING DART', 'bolt', 7, 0.45, 210), specials: ['pollinate', 'hive_call'] }),
  // ------------------------------------------------------------------ frost
  C({ id: 'golem', name: 'Rimegolem', element: 'frost', body: 'golem', role: 'TANK', moves: 'STOMPS ON TWO LEGS', strong: 'THE MOST HEALTH, AND WALLS THAT EXPLODE', weak: 'SLOW - EASY TO KITE', hp: 140, speed: 44, cry: 'glass_crack', normal: N('ICE SHARD', 'bolt', 9, 0.7, 195), specials: ['glacier_slab', 'hailburst'] }),
  C({ id: 'jelly', name: 'Rimejelly', element: 'frost', body: 'jelly', role: 'CONTROLLER', moves: 'DRIFTS, TENTACLES TRAILING', strong: 'HOLDS YOU, AND FREEZES SHOTS IN THE AIR', weak: 'DRIFTS SLOWLY AND HITS LIGHTLY', hp: 98, speed: 52, cry: 'water_plip', normal: N('CHILL STING', 'bolt', 7, 0.55, 190), specials: ['cold_tether', 'prism_stasis'] }),
  C({ id: 'ram', name: 'Frostram', element: 'frost', body: 'ram', role: 'BULLDOZER', moves: 'GALLOPS, HORNS DOWN', strong: 'THE LONGEST CHARGE, AND A STAMP TO STOP YOURS', weak: 'COMMITS HARD: MISS, AND IT IS OPEN', hp: 112, speed: 64, cry: 'bin_land', normal: N('HORN BUTT', 'beam', 11, 0.65, 34), specials: ['ram_charge', 'hoof_stamp'] }),
  C({ id: 'penguin', name: 'Floepenguin', element: 'frost', body: 'penguin', role: 'SLIDER', moves: 'WADDLES, THEN SLIDES', strong: 'FAST ON ITS OWN ICE, AND SLIDES OFF WALLS', weak: 'WADDLES SLOWLY OFF THE ICE', hp: 104, speed: 58, cry: 'splash', normal: N('WING SLAP', 'beam', 10, 0.6, 32), specials: ['belly_slide', 'ice_floe'] }),
  C({ id: 'yeti', name: 'Snowbrute', element: 'frost', body: 'yeti', role: 'BRUTE', moves: 'KNUCKLE-WALKS', strong: 'BOULDERS THAT ENCASE YOU; A ROAR THAT STRIPS YOU', weak: 'SLOW, AND A BIG TARGET', hp: 134, speed: 50, cry: 'bin_land', normal: N('FIST SLAM', 'beam', 13, 0.8, 36), specials: ['ice_boulder', 'war_roar'] }),
  // ------------------------------------------------------------------- volt
  C({ id: 'hound', name: 'Sparkhound', element: 'volt', body: 'hound', role: 'HUNTER', moves: 'RUNS ON FOUR LEGS', strong: 'RUNS ANYTHING DOWN, AND MARKS IT', weak: 'MUST BE CLOSE TO DO ITS WORK', hp: 100, speed: 72, cry: 'crow_caw', normal: N('ZAP BITE', 'beam', 10, 0.55, 34), specials: ['volt_pounce', 'storm_howl'] }),
  C({ id: 'spider', name: 'Coilspider', element: 'volt', body: 'spider', role: 'TRAPPER', moves: 'EIGHT METAL LEGS', strong: 'MINES, AND WIRE THAT GOES THROUGH WALLS', weak: 'NEEDS TIME: WEAK WHEN RUSHED', hp: 98, speed: 62, cry: 'voice_robot', normal: N('WIRE BOLT', 'bolt', 7, 0.5, 220), specials: ['web_mine', 'live_wire'] }),
  C({ id: 'gecko', name: 'Sparkgecko', element: 'volt', body: 'gecko', role: 'STRIKER', moves: 'SKITTERS FLAT TO THE GROUND', strong: 'SEEKING SPARKS, AND IT HIDES ON WALLS', weak: 'SHORT, LIGHT HITS', hp: 88, speed: 74, cry: 'arcane_cast', normal: N('TAIL FLICK', 'beam', 9, 0.5, 32), specials: ['seeker_sparks', 'wall_cling'] }),
  C({ id: 'ferret', name: 'Coilferret', element: 'volt', body: 'ferret', role: 'THIEF', moves: 'LOPES, LONG AND LOW', strong: 'STEALS YOUR TIME, AND ITS BOLTS FOLLOW YOU', weak: 'TINY: TWO BIG HITS AND IT IS DONE', hp: 84, speed: 76, cry: 'voice_robot', normal: N('QUICK NIP', 'beam', 8, 0.4, 30), specials: ['static_steal', 'spark_chain'] }),
  C({ id: 'rhino', name: 'Thunderhorn', element: 'volt', body: 'rhino', role: 'JUGGERNAUT', moves: 'THUNDERS ON FOUR LEGS', strong: 'A CHARGE NOTHING STOPS, AND IT STORES YOUR HITS', weak: 'TURNS LIKE A CART', hp: 132, speed: 52, cry: 'bin_land', normal: N('HORN JAB', 'beam', 12, 0.75, 36), specials: ['thunder_charge', 'capacitor'] }),
  C({ id: 'eel', name: 'Glimmereel', element: 'volt', body: 'eel', role: 'AMBUSHER', moves: 'SWIMS THROUGH THE AIR', strong: 'VANISHES, AND STRIKES OUT OF NOWHERE', weak: 'THIN, AND LOST IN THE OPEN', hp: 90, speed: 68, cry: 'splash', normal: N('SHOCK BITE', 'beam', 10, 0.55, 32), specials: ['eel_dive', 'live_current'] }),
  // ------------------------------------------------------------------ stone
  C({ id: 'beetle', name: 'Gritbeetle', element: 'stone', body: 'beetle', role: 'CHARGER', moves: 'SIX LEGS', strong: 'ARMOURED, AND THROWS YOU OVER ITS BACK', weak: 'NO ANSWER TO A FIGHT AT RANGE', hp: 124, speed: 58, cry: 'crumble', normal: N('MANDIBLES', 'beam', 11, 0.65, 32), specials: ['pebble_mortar', 'horn_toss'] }),
  C({ id: 'roller', name: 'Grittadillo', element: 'stone', body: 'roller', role: 'BULLDOZER', moves: 'CURLS UP AND ROLLS', strong: 'BOWLS YOU OVER, AND SPIKES HURT TO HIT', weak: 'ITS SHOT IS SHORT AND SLOW', hp: 128, speed: 60, cry: 'crumble', normal: N('GRIT FLICK', 'bolt', 9, 0.8, 160), specials: ['roll_out', 'dig_in'] }),
  C({ id: 'tortoise', name: 'Cragtortoise', element: 'stone', body: 'tortoise', role: 'FORTRESS', moves: 'PLODS UNDER A SHELL OF ROCK', strong: 'BUILDS ITS OWN COVER AND MENDS IN ITS SHELL', weak: 'NEARLY THE SLOWEST THING ALIVE', hp: 138, speed: 42, cry: 'crumble', normal: N('SHELL BUMP', 'beam', 11, 0.8, 32), specials: ['crag_lob', 'hide_away'] }),
  C({ id: 'obelisk', name: 'Obeliskwalker', element: 'stone', body: 'obelisk', role: 'CONTROLLER', moves: 'GRINDS ALONG ON ITS BASE', strong: 'DRAGS YOU IN, THEN TURNS YOU TO STONE', weak: 'A SLOW, OBVIOUS TARGET', hp: 126, speed: 46, cry: 'crumble', normal: N('RUNE FIST', 'beam', 12, 0.8, 34), specials: ['gravity_rune', 'petrify_gaze'] }),
  C({ id: 'hedgehog', name: 'Geodehog', element: 'stone', body: 'hedgehog', role: 'BRISTLER', moves: 'SNUFFLES ALONG', strong: 'QUILLS THAT KEEP HURTING, AND IT ROLLS AT YOU', weak: 'SHORT REACH ON EVERYTHING', hp: 110, speed: 56, cry: 'leaf_rustle', normal: N('QUILL TOSS', 'bolt', 8, 0.6, 175), specials: ['crystal_quills', 'geode_curl'] }),
  // ------------------------------------------------------------------- gale
  C({ id: 'moth', name: 'Zephyrmoth', element: 'gale', body: 'moth', role: 'CONTROLLER', moves: 'FLIES', strong: 'SENDS WIND AFTER YOU, AND PUTS YOU TO SLEEP', weak: 'FRAGILE, AND LOSES A STRAIGHT BRAWL', hp: 84, speed: 70, cry: 'wings', normal: N('GUST', 'bolt', 7, 0.42, 205), specials: ['dust_devil', 'sleep_dust'] }),
  C({ id: 'mantis', name: 'Galemantis', element: 'gale', body: 'mantis', role: 'DUELIST', moves: 'STALKS ON TWO LEGS', strong: 'CUTS YOU OPEN UP CLOSE, THEN IS GONE', weak: 'NO REAL SHOT AT RANGE', hp: 92, speed: 70, cry: 'wind_gust', normal: N('SCYTHE CUT', 'beam', 12, 0.6, 38), specials: ['wind_cutter', 'sidestep'] }),
  C({ id: 'hare', name: 'Galehare', element: 'gale', body: 'hare', role: 'SPRINTER', moves: 'BOUNDS ON LONG LEGS', strong: 'NEVER STILL: EVERY MOVE SPEEDS IT UP', weak: 'LIGHT HITS, AND FOLDS IF CORNERED', hp: 82, speed: 80, cry: 'wind_gust', normal: N('HIND KICK', 'beam', 9, 0.5, 32), specials: ['gust_kick', 'bounding_hops'] }),
  C({ id: 'fox', name: 'Kitefox', element: 'gale', body: 'fox', role: 'TRICKSTER', moves: 'TROTS, EARS LIKE SAILS', strong: 'DECOYS AND UPDRAFTS: NEVER WHERE YOU AIM', weak: 'LITTLE DAMAGE IF YOU CATCH IT', hp: 86, speed: 74, cry: 'wind_gust', normal: N('EAR SWIPE', 'beam', 9, 0.5, 32), specials: ['mirage_decoy', 'updraft'] }),
  C({ id: 'falcon', name: 'Stormfalcon', element: 'gale', body: 'falcon', role: 'DIVER', moves: 'HOVERS ON BEATING WINGS', strong: 'DIVES FROM THE SKY, AND ITS SHOTS FLY FAR', weak: 'HOLLOW BONES', hp: 84, speed: 72, cry: 'crow_caw', normal: N('TALON RAKE', 'bolt', 8, 0.5, 215), specials: ['dive_bomb', 'tailwind'] }),
  // ------------------------------------------------------------------- murk
  C({ id: 'serpent', name: 'Bogviper', element: 'murk', body: 'serpent', role: 'AMBUSHER', moves: 'SLITHERS', strong: 'GUMS UP YOUR ESCAPES, THEN FINISHES YOU', weak: 'THIN: EVERY HIT LANDS FULLY', hp: 94, speed: 68, cry: 'poison_hiss', normal: N('FANG BITE', 'beam', 10, 0.55, 32), specials: ['mire_glob', 'coil_snap'] }),
  C({ id: 'bat', name: 'Duskbat', element: 'murk', body: 'bat', role: 'DIVER', moves: 'FLITS ON LEATHER WINGS', strong: 'SCRAMBLES YOUR CONTROLS AND HITS AND RUNS', weak: 'FOLDS UP UNDER A FEW GOOD HITS', hp: 80, speed: 76, cry: 'wings', normal: N('SONIC BITE', 'bolt', 7, 0.45, 200), specials: ['echo_shriek', 'hit_and_run'] }),
  C({ id: 'shroom', name: 'Gloomcap', element: 'murk', body: 'shroom', role: 'SPORECASTER', moves: 'SHUFFLES ON A THICK STEM', strong: 'SAPS YOUR STRENGTH AND FEEDS ON YOU', weak: 'BARELY MOVES', hp: 110, speed: 46, cry: 'leaf_rustle', normal: N('CAP BONK', 'beam', 11, 0.7, 32), specials: ['spore_puff', 'mycelium_net'] }),
  C({ id: 'crow', name: 'Hollowcrow', element: 'murk', body: 'crow', role: 'OMEN', moves: 'HOPS AND FLAPS', strong: 'CURSES YOUR HEALING, AND SENDS ITS FLOCK', weak: 'WEAK ON ITS OWN', hp: 86, speed: 66, cry: 'crow_caw', normal: N('PECK', 'beam', 9, 0.5, 32), specials: ['ill_omen', 'murder'] }),
  C({ id: 'lynx', name: 'Nightlynx', element: 'murk', body: 'lynx', role: 'ASSASSIN', moves: 'PROWLS LOW', strong: 'APPEARS BEHIND YOU AND HITS DOUBLE', weak: 'NOTHING LEFT IF THE FIRST STRIKE FAILS', hp: 88, speed: 74, cry: 'crow_caw', normal: N('NIGHT CLAW', 'beam', 11, 0.55, 34), specials: ['shadow_step', 'pounce_pin'] }),
  C({ id: 'wraith', name: 'Bogwraith', element: 'murk', body: 'wraith', role: 'HAUNTER', moves: 'RISES OUT OF A POOL', strong: 'DRIFTS THROUGH WALLS AND DRAINS YOU DRY', weak: 'NO SHOT, AND THIN', hp: 92, speed: 60, cry: 'voice_whisper', normal: N('CHILL TOUCH', 'beam', 10, 0.6, 36), specials: ['phase', 'soul_siphon'] }),
  // ------------------------------------------------------------------- glow
  C({ id: 'owl', name: 'Lumenowl', element: 'glow', body: 'owl', role: 'SNIPER', moves: 'PERCHES AND GLIDES', strong: 'HITS FROM BEHIND COVER, FROM AFAR', weak: 'THE LIGHTEST BONES IN THE GAME', hp: 76, speed: 60, cry: 'wings', normal: N('LIGHT DART', 'bolt', 8, 0.5, 230), specials: ['pierce_gaze', 'silent_glide'] }),
  C({ id: 'centipede', name: 'Lumenpede', element: 'glow', body: 'centipede', role: 'HARASSER', moves: 'A HUNDRED LEGS', strong: 'SHOTS THROUGH COVER, ALL DAY LONG', weak: 'PAPER-THIN FOR WHAT IT CAN DO', hp: 80, speed: 64, cry: 'leaf_rustle', normal: N('LUMEN SPIT', 'bolt', 7, 0.45, 220), specials: ['boomer_spit', 'bright_coil'] }),
  C({ id: 'angler', name: 'Lureangler', element: 'glow', body: 'angler', role: 'LURER', moves: 'SWIMS THROUGH THE AIR', strong: 'REELS YOU IN AND BURNS YOU THROUGH WALLS', weak: 'SOFT-BODIED: THE LEAST HEALTH BUT ONE', hp: 74, speed: 58, cry: 'water_plip', normal: N('LURE BUMP', 'beam', 9, 0.6, 32), specials: ['dangling_lure', 'deep_beam'] }),
  C({ id: 'firefly', name: 'Lanternfly', element: 'glow', body: 'firefly', role: 'BEACON', moves: 'DRIFTS ON A GLOWING TAIL', strong: 'A LANTERN THAT LETS IT SHOOT THROUGH ANYTHING', weak: 'STRAYS FROM ITS LANTERN AND IS WEAK', hp: 78, speed: 64, cry: 'arcane_cast', normal: N('GLOW SPARK', 'bolt', 7, 0.5, 205), specials: ['beacon', 'dazzle'] }),
  C({ id: 'snail', name: 'Starsnail', element: 'glow', body: 'snail', role: 'SHELL MAGE', moves: 'GLIDES ON A TRAIL OF LIGHT', strong: 'TURNS YOUR HITS INTO A BLAST, AND RIDES ITS TRAIL', weak: 'SLOW OFF ITS OWN TRAIL', hp: 84, speed: 48, cry: 'water_plip', normal: N('SHELL SPARK', 'bolt', 8, 0.6, 190), specials: ['star_shell', 'comet_trail'] }),
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
    attacks: [N('GRAVE LIGHT', 'spread', 9, 1.1, 170), SP('phantom_blink'), SP('raise_husks')],
    boss: { pattern: 'teleport', trick: 'BLINKS TO YOUR SIDE', blurb: 'A NECROMANCER WITH A LANTERN OF SOULS. HIDE, AND IT FINDS YOU.', every: 4.5, n: 3, r: 14, dmg: 13 },
  },
  {
    id: 'b_seraph', name: 'Starfall Seraph', element: 'ember', body: 'seraph', role: 'ZONER', moves: 'HANGS IN THE AIR ON SIX WINGS',
    strong: 'CALLS DOWN METEORS', weak: 'SLOW TO TURN, AND ITS WINGS ARE WIDE', hp: 420, speed: 42, cry: 'arcane_blast',
    attacks: [N('SUNSPARK', 'bolt', 11, 0.8, 210), SP('meteor_fall'), SP('halo_prison')],
    boss: { pattern: 'meteor', trick: 'METEORS FALL', blurb: 'IT RINGS THE SKY LIKE A BELL, AND THE STARS FALL. WATCH THE SHADOWS.', every: 5.5, n: 3, r: 20, dmg: 26 },
  },
  {
    id: 'b_hydra', name: 'The Mire Hydra', element: 'murk', body: 'hydra', role: 'ZONER', moves: 'WADES ON A HEAVY BODY',
    strong: 'THREE HEADS, THREE LINES OF BREATH', weak: 'SLOW, AND THE GAPS BETWEEN THE LINES', hp: 460, speed: 38, cry: 'poison_hiss',
    attacks: [N('BILE SPIT', 'bolt', 11, 0.7, 190), SP('tri_breath'), SP('regrow_head')],
    boss: { pattern: 'tribeam', trick: 'THREE HEADS BREATHE', blurb: 'THREE NECKS, ONE TEMPER. STAND BETWEEN THE BREATHS.', every: 4.2, n: 3, r: 7, dmg: 18 },
  },
  {
    id: 'b_queen', name: 'The Brass Matriarch', element: 'volt', body: 'queen', role: 'TRAPPER', moves: 'EIGHT BRASS LEGS',
    strong: 'WEBS THE FLOOR AROUND YOU', weak: 'HER BODY IS SLOW TO TURN', hp: 420, speed: 54, cry: 'voice_robot',
    attacks: [N('ARC NEEDLE', 'bolt', 10, 0.55, 230), SP('web_field'), SP('brood_clock')],
    boss: { pattern: 'webs', trick: 'WEBS THE FLOOR', blurb: 'A CLOCKWORK SPIDER-QUEEN. HER WEBS HOLD WHATEVER STEPS IN THEM.', every: 4.5, n: 4, r: 13, dmg: 11 },
  },
  {
    id: 'b_maw', name: 'The Green Maw', element: 'moss', body: 'maw', role: 'DEFENDER', moves: 'DRAGS ITSELF ON ROOTS',
    strong: 'ROOTS FROM BELOW, AND IT HEALS', weak: 'BARELY MOVES', hp: 480, speed: 30, cry: 'branch_creak',
    attacks: [N('SEED VOLLEY', 'spread', 9, 1.2, 170), SP('root_eruption'), SP('devour')],
    boss: { pattern: 'roots', trick: 'ROOTS GRAB', blurb: 'A FLYTRAP AS BIG AS A CART. ITS ROOTS ARE EVERYWHERE YOU STAND.', every: 3.8, n: 3, r: 15, dmg: 12 },
  },
  {
    id: 'b_cloud', name: 'Thunderhead', element: 'gale', body: 'cloud', role: 'HARASSER', moves: 'DRIFTS FAST, LOW AND HEAVY',
    strong: 'LIGHTNING MARCHES AT YOU', weak: 'NOTHING SOLID TO IT - LOW HEALTH', hp: 360, speed: 64, cry: 'wind_gust',
    attacks: [N('SQUALL', 'spread', 9, 0.9, 200), SP('walk_lightning'), SP('storm_eye')],
    boss: { pattern: 'lightning', trick: 'LIGHTNING WALKS', blurb: 'A STORM WITH ONE EYE IN IT. THE BOLTS WALK STRAIGHT AT YOU.', every: 4, n: 7, r: 11, dmg: 14 },
  },
  {
    id: 'b_wyrm', name: 'The Deep Wyrm', element: 'stone', body: 'wyrm', role: 'AMBUSHER', moves: 'SWIMS THROUGH THE GROUND',
    strong: 'GOES UNDER AND COMES UP BESIDE YOU', weak: 'EXPOSED EACH TIME IT SURFACES', hp: 440, speed: 52, cry: 'crumble',
    attacks: [N('GRAVEL SPRAY', 'spread', 10, 1, 180), SP('surface_strike'), SP('cave_in')],
    boss: { pattern: 'burrow', trick: 'SURFACES BESIDE YOU', blurb: 'A WYRM THAT SWIMS IN STONE. FEEL FOR WHERE IT WILL COME UP.', every: 4.5, n: 1, r: 18, dmg: 18 },
  },
  {
    id: 'b_sphinx', name: 'The Mirror Sphinx', element: 'glow', body: 'sphinx', role: 'CHARGER', moves: 'PROWLS ON FOUR PAWS',
    strong: 'A MIRROR GUARD, THEN A POUNCE ACROSS THE ARENA', weak: 'THE POUNCE IS TELEGRAPHED', hp: 400, speed: 58, cry: 'glass_crack',
    attacks: [N('GLINT DART', 'bolt', 10, 0.6, 230), SP('pounce_line'), SP('mirror_riddle')],
    boss: { pattern: 'charge', trick: 'POUNCES ACROSS', blurb: 'A WINGED LION IN A MASK OF GLASS. WATCH THE LINE IT DRAWS.', every: 4.5, n: 1, r: 9, dmg: 22 },
  },
  {
    id: 'b_kraken', name: 'The Salt Kraken', element: 'tide', body: 'kraken', role: 'AREA CONTROL', moves: 'HAULS ITSELF ON EIGHT ARMS',
    strong: 'A WALL OF TENTACLES ACROSS THE FLOOR', weak: 'ITS HEAD IS AN EASY TARGET', hp: 440, speed: 40, cry: 'splash',
    attacks: [N('INK JET', 'bolt', 11, 0.7, 200), SP('tentacle_waves'), SP('ink_blackout')],
    boss: { pattern: 'tentacles', trick: 'TENTACLES SWEEP', blurb: 'IT CAME UP OUT OF THE SALT. ITS ARMS ROLL IN LIKE WAVES.', every: 5, n: 5, r: 13, dmg: 13 },
  },
  {
    id: 'b_mammoth', name: 'The Old Mammoth', element: 'frost', body: 'mammoth', role: 'JUGGERNAUT', moves: 'TRAMPLES ON FOUR LEGS',
    strong: 'STAMPS, AND THE GROUND RINGS', weak: 'THE SLOWEST THING IN THE ARENA', hp: 480, speed: 36, cry: 'bin_land',
    attacks: [N('FROST BREATH', 'spread', 11, 1.3, 160), SP('quake_rings'), SP('glacier_drift')],
    boss: { pattern: 'quake', trick: 'SHOCKWAVES', blurb: 'TUSKS LIKE ICICLES. WHEN IT STAMPS, JUMP THE RINGS OR STAND FAR OFF.', every: 4.8, n: 10, r: 9, dmg: 14 },
  },
];

export const CREATURES: Creature[] = ROSTER;

/**
 * ---- WHAT MUST STAY TRUE, checked in dev where it is easiest to break: one
 * body to one creature (and none worn by a boss), every move name its own,
 * and none longer than the arena's buttons can print.
 */
export const MOVE_NAME_MAX = 11;
if (import.meta.env?.DEV) {
  const bodies = [...ROSTER, ...BOSSES].map((c) => c.body);
  const dupeBody = bodies.find((b, i) => bodies.indexOf(b) !== i);
  if (dupeBody) throw new Error(`creatures: two creatures share the body "${dupeBody}"`);
  const names = [...ROSTER, ...BOSSES].flatMap((c) => c.attacks.map((a) => a.name));
  const dupe = names.find((n, i) => names.indexOf(n) !== i);
  if (dupe) throw new Error(`creatures: two creatures share the move "${dupe}"`);
  // (only the ones you can own go on the attack buttons)
  const long = ROSTER.flatMap((c) => c.attacks.map((a) => a.name)).find((n) => n.length > MOVE_NAME_MAX);
  if (long) throw new Error(`creatures: "${long}" is too long for an attack button`);
  // EVERY SPECIAL BELONGS TO EXACTLY ONE CREATURE, and the first move is always plain
  const used = new Map<string, string>();
  for (const c of [...ROSTER, ...BOSSES]) {
    if (c.attacks[0].sp || c.attacks[0].mod !== 'none') throw new Error(`creatures: ${c.id}'s first move must be a plain attack`);
    for (const a of c.attacks.slice(1)) {
      if (!a.sp) throw new Error(`creatures: ${c.id} "${a.name}" is not a special`);
      if (used.has(a.sp)) throw new Error(`creatures: "${a.sp}" belongs to both ${used.get(a.sp)} and ${c.id}`);
      used.set(a.sp, c.id);
    }
  }
  const spare = SPECIAL_LIST.filter((d) => !used.has(d.id));
  if (spare.length) throw new Error(`creatures: specials nobody has: ${spare.map((d) => d.id).join(', ')}`);
  // and a generic special has to make sense on its kind of move
  for (const a of [...ROSTER, ...BOSSES].flatMap((c) => c.attacks)) {
    const ok =
      a.mod === 'none' ||
      (HIT_MODS.includes(a.mod) && a.dmg > 0) ||
      (PATH_MODS.includes(a.mod) && SHOT_KINDS.includes(a.kind)) ||
      (AREA_MODS.includes(a.mod) && AREA_KINDS.includes(a.kind)) ||
      SELF_MODS.includes(a.mod) ||
      ((a.mod === 'reflect' || a.mod === 'thorns') && a.kind === 'shield') ||
      (a.mod === 'strike' && a.kind === 'blink');
    if (!ok) throw new Error(`creatures: "${a.name}" cannot have "${a.mod}" on a ${a.kind}`);
  }
  if (ROSTER.length !== 50) throw new Error('creatures: the roster is fifty');
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
export const PACK_COST = 25;

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
  { id: 'caves', name: 'ECHO CAVES', pool: ['mole', 'bat', 'spider', 'roller', 'slug', 'tortoise', 'yeti', 'bear', 'hedgehog'], ground: 0x4a4440, groundDark: 0x2e2a28, prop: 'rock', cover: 'line', mood: { sky: 0x120e14, haze: 0x2a2230, fleck: 0x8a7a9a } },
  { id: 'fields', name: 'WINDY FIELDS', pool: ['moth', 'mantis', 'hound', 'owl', 'sprout', 'hare', 'stag', 'bee', 'fox', 'falcon'], ground: 0x8ab85a, groundDark: 0x5a8a3a, prop: 'tree', cover: 'grove', mood: { sky: 0x9ad0e8, haze: 0xc8e8a0, fleck: 0xf0e880 } },
  { id: 'forests', name: 'DEEPWOOD', pool: ['sprout', 'serpent', 'beetle', 'centipede', 'owl', 'shroom', 'stag', 'sloth', 'lynx', 'crow', 'firefly'], ground: 0x3a6a2e, groundDark: 0x24461c, prop: 'tree', cover: 'scatter', mood: { sky: 0x16220f, haze: 0x2a4a22, fleck: 0x8ad06a } },
  { id: 'frozen', name: 'FROZEN PASS', pool: ['golem', 'ram', 'jelly', 'hound', 'moth', 'penguin', 'yeti', 'rhino'], ground: 0xd8ecf4, groundDark: 0xa0c4d4, prop: 'ice', cover: 'line', mood: { sky: 0xbfd8e8, haze: 0xeaf6ff, fleck: 0xffffff } },
  { id: 'swamps', name: 'SOURMIRE', pool: ['serpent', 'toad', 'slug', 'bat', 'sprout', 'shroom', 'gecko', 'newt', 'wraith', 'eel'], ground: 0x4a5a3a, groundDark: 0x2e3a24, prop: 'reed', cover: 'scatter', mood: { sky: 0x202a1e, haze: 0x3a5a3a, fleck: 0x9ab06a } },
  { id: 'ruins', name: 'SUNKEN RUINS', pool: ['centipede', 'golem', 'spider', 'owl', 'wisp', 'gecko', 'tortoise', 'obelisk', 'snail', 'crow'], ground: 0x9a9070, groundDark: 0x6a6048, prop: 'pillar', cover: 'ring', mood: { sky: 0x2a3348, haze: 0xc8c0a0, fleck: 0xfff0c0 } },
  { id: 'shore', name: 'SALT SHORE', pool: ['crab', 'ray', 'toad', 'jelly', 'mantis', 'puffer', 'angler', 'urchin', 'seahorse', 'heron'], ground: 0xe0d090, groundDark: 0xb8a868, prop: 'shell', cover: 'scatter', mood: { sky: 0x6ab8e0, haze: 0xf0e8c0, fleck: 0xffffff } },
  { id: 'desert', name: 'GLASS DESERT', pool: ['roller', 'beetle', 'hound', 'wisp', 'mantis', 'scorpion', 'hare', 'ferret', 'falcon', 'rhino'], ground: 0xe8c078, groundDark: 0xc09050, prop: 'cactus', cover: 'scatter', mood: { sky: 0xe8a060, haze: 0xffd8a0, fleck: 0xfff4c0 } },
  { id: 'volcano', name: 'ASHEN PEAK', pool: ['wisp', 'slug', 'mole', 'ram', 'roller', 'scorpion', 'angler', 'boar', 'heron'], ground: 0x5a3a30, groundDark: 0x3a2018, prop: 'vent', cover: 'ring', mood: { sky: 0x2a1218, haze: 0x6a2a1a, fleck: 0xff8a3a } },
];

// (every creature lives somewhere: one with no zone could only be met on the ladder)
if (import.meta.env?.DEV) {
  const homeless = ROSTER.filter((c) => !BIOMES.some((b) => b.pool.includes(c.id)));
  if (homeless.length) throw new Error(`creatures: nowhere to meet ${homeless.map((c) => c.id).join(', ')}`);
}

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

/** A zone battle: 5 in, 10 back for a win. */
export const BATTLE_COST = 5;
export const BATTLE_WIN = 10;
/**
 * The ladder: 20 to enter, five normal fights and the boss -- and 80 for
 * beating the boss (60 up on the entry).  The levels on the way pay nothing:
 * the prize is for the whole run.
 */
export const LADDER_COST = 20;
export const LADDER_LEVELS = 5;
export const LADDER_WIN = 0;
export const LADDER_BOSS_WIN = 80;
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
