/**
 * ---- ULTIMATE ABILITIES: one for every creature and every boss, each its own.
 *
 * THE RULES.  Locked for the first 30 seconds of a battle; once it is up it
 * can be fired, and after firing it cools for 25 seconds.  The opponent plays
 * by the same clock.
 *
 * ---- EVERY ONE DESIGNED, NOT DEALT (user, 4 Nov: "ensure all creatures have
 * their own unique ultimates, not just repeats ... it should not be lazy ...
 * maybe one of them could be summoning 2 minions").  They used to be dealt
 * from 17 effects by role and element, so a dozen creatures had what was, to
 * play, the same ultimate with other numbers.  Now each is written for its
 * creature, from a much bigger set of things an ultimate can do -- summon a
 * pack, a turret, a healing totem or exploding husks; orbiting blades, a
 * bouncing boulder, a black hole, a chasing tornado, a prison of walls round
 * them, a spiral, a sweeping beam, chain lightning, shockwave rings, a line of
 * eruptions; giant form, lifesteal, stealth, reflection -- two to four of them
 * in turn, the first its signature.  Checked when the table is built: no two
 * have the same make-up, and no signature is shared by more than three.
 *
 * ---- POWERFUL, AND NONE WEAKER THAN ANOTHER.  Every effect is given a worth
 * in the same coin, HEALTH -- what it takes off the enemy, gives back, stops
 * from landing, or what the enemy cannot do while it lasts -- and every
 * ultimate is scaled, effect by effect and within sane limits, to the same
 * budget (a boss's is half again).  (user, 4 Nov: "make them stronger": the
 * budget went from 40 to 56.)
 */

import { plainWords } from './plainWords';
import { BOSSES, CREATURES, ELEMENTS } from './creatures';
import { AURA_POWER, HASTE_SPEED, LINGER_DMG, LINGER_S } from './attackInfo';

export const ULT_UNLOCK_S = 30;
export const ULT_COOLDOWN_S = 25;

export type UltFx =
  // ---- hits
  | { k: 'charge'; dist: number; dmg: number }
  | { k: 'blink'; dmg: number }
  | { k: 'multiblink'; n: number; dmg: number }
  | { k: 'leap'; r: number; dmg: number }
  | { k: 'nova'; r: number; dmg: number; knock: number }
  | { k: 'shockwaves'; n: number; dmg: number }
  | { k: 'pull'; r: number; dmg: number }
  | { k: 'swap'; dmg: number }
  | { k: 'barrage'; n: number; dmg: number; spread: number }
  | { k: 'volley'; n: number; dmg: number }
  | { k: 'spiral'; n: number; dmg: number }
  | { k: 'ring'; n: number; dmg: number }
  | { k: 'homing'; n: number; dmg: number }
  | { k: 'beam'; len: number; dmg: number; w: number }
  | { k: 'sweep'; len: number; dmg: number }
  | { k: 'cross'; len: number; dmg: number }
  | { k: 'chain'; n: number; dmg: number }
  | { k: 'meteor'; n: number; r: number; dmg: number }
  | { k: 'quakeline'; n: number; dmg: number }
  | { k: 'spikes'; dmg: number; t: number }
  | { k: 'minefield'; n: number; dmg: number }
  | { k: 'zone'; n: number; r: number }
  | { k: 'trail'; t: number }
  | { k: 'drain'; t: number; dps: number }
  | { k: 'blackhole'; t: number; dps: number }
  | { k: 'tornado'; t: number; dps: number }
  | { k: 'bouncer'; t: number; dmg: number }
  | { k: 'orbit'; n: number; t: number; dmg: number }
  // ---- things it brings in
  | { k: 'pack'; n: number; dmg: number }
  | { k: 'turret'; t: number; dmg: number }
  | { k: 'totem'; t: number; hps: number }
  | { k: 'bombers'; n: number; dmg: number }
  | { k: 'crows'; n: number; dmg: number }
  | { k: 'spiders'; n: number }
  | { k: 'clones'; n: number }
  | { k: 'prison'; t: number }
  // ---- what it does to them
  | { k: 'stun'; r: number; t: number }
  | { k: 'slowfield'; r: number; t: number }
  | { k: 'rootfield'; r: number; t: number }
  | { k: 'blind'; t: number }
  | { k: 'silence'; t: number }
  | { k: 'weaken'; t: number }
  | { k: 'shred'; t: number }
  // ---- what it does for itself
  | { k: 'shield'; t: number }
  | { k: 'invuln'; t: number }
  | { k: 'reflect'; t: number }
  | { k: 'thorns'; t: number }
  | { k: 'heal'; frac: number }
  | { k: 'regen'; t: number; hps: number }
  | { k: 'rage'; t: number }
  | { k: 'haste'; t: number }
  | { k: 'lifesteal'; t: number }
  | { k: 'giant'; t: number }
  | { k: 'stealth'; t: number }
  | { k: 'reset' }
  | { k: 'cleanse' }
  // ---- each of these is one creature's signature, and appears nowhere else
  | { k: 'geyser'; n: number; dmg: number }
  | { k: 'tidalwave'; dmg: number }
  | { k: 'iceblock'; t: number }
  | { k: 'icicles'; n: number; dmg: number }
  | { k: 'avalanche'; dmg: number }
  | { k: 'blizzard'; t: number; dps: number }
  | { k: 'absorb'; t: number; dmg: number }
  | { k: 'laserfence'; t: number; dps: number }
  | { k: 'staticfield'; t: number; dps: number }
  | { k: 'railgun'; dmg: number }
  | { k: 'boomerang'; dmg: number }
  | { k: 'firebreath'; t: number; dmg: number }
  | { k: 'fireworks'; n: number; dmg: number }
  | { k: 'phoenix'; t: number; frac: number }
  | { k: 'solarflare'; t: number; dmg: number }
  | { k: 'lighthouse'; t: number; dmg: number }
  | { k: 'mirrorimage'; n: number; dmg: number }
  | { k: 'echo'; t: number }
  | { k: 'timewarp' }
  | { k: 'timestop'; t: number }
  | { k: 'doom'; dmg: number }
  | { k: 'soullink'; t: number }
  | { k: 'fear'; t: number }
  | { k: 'polymorph'; t: number }
  | { k: 'shrink'; t: number }
  | { k: 'quicksand'; t: number; dps: number }
  | { k: 'bunker'; t: number }
  | { k: 'stoneskin'; amt: number }
  | { k: 'earthquake'; t: number; dmg: number }
  | { k: 'rockthrow'; dmg: number }
  | { k: 'pylons'; n: number; t: number; dmg: number }
  | { k: 'windwall'; t: number }
  | { k: 'gale'; t: number; dmg: number }
  | { k: 'liftoff'; t: number; dmg: number }
  | { k: 'blossoms'; n: number; hps: number }
  | { k: 'bubble'; t: number; dmg: number }
  | { k: 'tentacles'; n: number; t: number; dmg: number }
  | { k: 'riptide'; t: number; dps: number }
  | { k: 'counter'; t: number; dmg: number }
  | { k: 'execute'; dmg: number }
  | { k: 'bleed'; t: number; dps: number }
  | { k: 'hunt'; t: number }
  | { k: 'overload'; dmg: number; r: number }
  | { k: 'balllightning'; t: number; dmg: number }
  | { k: 'rot'; t: number }
  | { k: 'miasma'; t: number; dps: number }
  | { k: 'carrionmark'; t: number; dmg: number }
  | { k: 'radiance'; n: number; dmg: number; hps: number }
  | { k: 'prismfan'; n: number; dmg: number }
  | { k: 'steal'; dmg: number }
  | { k: 'leash'; t: number; dmg: number }
  | { k: 'confuse'; t: number }
  | { k: 'firewall'; t: number }
  | { k: 'nightmare'; t: number; dmg: number }
  | { k: 'net'; t: number; dmg: number }
  | { k: 'trapdoll'; dmg: number }
  | { k: 'duel'; t: number }
  | { k: 'banish'; t: number }
  | { k: 'snowball'; dmg: number };

type K = UltFx['k'];

export interface Ultimate {
  name: string;
  /** In a line, for the STATS page. */
  desc: string;
  /** Step by step, in full, for its own card. */
  steps: string[];
  fx: UltFx[];
  /** How close the target should be for the AI to fire it (px). */
  range: number;
}

/** A stun, a hold, giant form, lifesteal: how they read in the arena (CreatureArena reads the same). */
export const GIANT_TAKEN = 0.7;
export const LIFESTEAL_FRAC = 0.5;
export const BLIND_R = 140;
export const PACK_LIFE = 4.5;
export const CROW_LIFE = 4;
/** The rest of the arena's numbers for them. */
export const DUEL_MUL = 1.3;
export const HUNT_MUL = 1.4;
export const ICE_SHATTER = 2;
export const BANISH_HEAL = 3;

/**
 * THE PLAIN SUPPORTS: the only effects more than one ultimate may have, and
 * never as the signature.  Everything else -- every summon, every field,
 * every beam, every trick -- belongs to one creature alone (user, 4 Nov:
 * "do not have two similar ultimates ... they should be unique in styling
 * as well").
 */
export const GENERIC: ReadonlySet<UltFx['k']> = new Set<UltFx['k']>(['haste', 'shield', 'heal', 'regen', 'invuln', 'cleanse', 'reset', 'slowfield', 'stun', 'blind', 'weaken', 'shred', 'silence', 'rootfield', 'rage']);

// shorthand for the table
const F = <T extends K>(k: T, o: Omit<Extract<UltFx, { k: T }>, 'k'>): UltFx => ({ k, ...o }) as UltFx;
const charge = (dmg = 20, dist = 110) => F('charge', { dist, dmg });
const blink = (dmg = 16) => F('blink', { dmg });
const multiblink = (n = 3, dmg = 9) => F('multiblink', { n, dmg });
const leap = (dmg = 18, r = 26) => F('leap', { r, dmg });
const nova = (dmg = 12, r = 40) => F('nova', { r, dmg, knock: 200 });
const shockwaves = (n = 3, dmg = 8) => F('shockwaves', { n, dmg });
const pull = (dmg = 14, r = 110) => F('pull', { r, dmg });
const swap = (dmg = 10) => F('swap', { dmg });
const barrage = (n = 7, dmg = 5) => F('barrage', { n, dmg, spread: 0.6 });
const volley = (n = 6, dmg = 5) => F('volley', { n, dmg });
const spiral = (n = 16, dmg = 4) => F('spiral', { n, dmg });
const ring = (n = 12, dmg = 6) => F('ring', { n, dmg });
const homing = (n = 5, dmg = 5) => F('homing', { n, dmg });
const beam = (dmg = 20, len = 220) => F('beam', { len, dmg, w: 6 });
const sweep = (dmg = 18, len = 190) => F('sweep', { len, dmg });
const cross = (dmg = 14, len = 80) => F('cross', { len, dmg });
const chain = (n = 4, dmg = 6) => F('chain', { n, dmg });
const meteor = (n = 5, dmg = 10, r = 20) => F('meteor', { n, r, dmg });
const quakeline = (n = 7, dmg = 9) => F('quakeline', { n, dmg });
const spikes = (dmg = 16, t = 1) => F('spikes', { dmg, t });
const minefield = (n = 5, dmg = 10) => F('minefield', { n, dmg });
const zone = (n = 4, r = 13) => F('zone', { n, r });
const trail = (t = 5) => F('trail', { t });
const drain = (t = 3, dps = 6) => F('drain', { t, dps });
const blackhole = (t = 3, dps = 5) => F('blackhole', { t, dps });
const tornado = (t = 4, dps = 5) => F('tornado', { t, dps });
const bouncer = (t = 4, dmg = 8) => F('bouncer', { t, dmg });
const orbit = (n = 3, t = 4, dmg = 4) => F('orbit', { n, t, dmg });
const pack = (n = 3, dmg = 3) => F('pack', { n, dmg });
const turret = (t = 6, dmg = 4) => F('turret', { t, dmg });
const totem = (t = 6, hps = 4) => F('totem', { t, hps });
const bombers = (n = 3, dmg = 10) => F('bombers', { n, dmg });
const crows = (n = 3, dmg = 3) => F('crows', { n, dmg });
const spiders = (n = 3) => F('spiders', { n });
const clones = (n = 2) => F('clones', { n });
const prison = (t = 3) => F('prison', { t });
const stun = (t = 1, r = 85) => F('stun', { r, t });
const slowfield = (t = 2.5, r = 80) => F('slowfield', { r, t });
const rootfield = (t = 1.2, r = 70) => F('rootfield', { r, t });
const blind = (t = 2.5) => F('blind', { t });
const silence = (t = 3) => F('silence', { t });
const weaken = (t = 3.5) => F('weaken', { t });
const shred = (t = 4) => F('shred', { t });
const shield = (t = 2) => F('shield', { t });
const invuln = (t = 1.2) => F('invuln', { t });
const reflect = (t = 2) => F('reflect', { t });
const thorns = (t = 2.5) => F('thorns', { t });
const heal = (frac = 0.15) => F('heal', { frac });
const regen = (t = 5, hps = 3) => F('regen', { t, hps });
const rage = (t = 4) => F('rage', { t });
const haste = (t = 4) => F('haste', { t });
const lifesteal = (t = 5) => F('lifesteal', { t });
const giant = (t = 5) => F('giant', { t });
const stealth = (t = 2) => F('stealth', { t });
const reset = () => F('reset', {});
const cleanse = () => F('cleanse', {});
const geyser = (n = 4, dmg = 9) => F('geyser', { n, dmg });
const tidalwave = (dmg = 20) => F('tidalwave', { dmg });
const iceblock = (t = 1.5) => F('iceblock', { t });
const icicles = (n = 9, dmg = 14) => F('icicles', { n, dmg });
const avalanche = (dmg = 18) => F('avalanche', { dmg });
const blizzard = (t = 4, dps = 6) => F('blizzard', { t, dps });
const absorb = (t = 2.5, dmg = 6) => F('absorb', { t, dmg });
const laserfence = (t = 4, dps = 10) => F('laserfence', { t, dps });
const staticfield = (t = 4, dps = 8) => F('staticfield', { t, dps });
const railgun = (dmg = 30) => F('railgun', { dmg });
const boomerang = (dmg = 16) => F('boomerang', { dmg });
const firebreath = (t = 1.5, dmg = 3) => F('firebreath', { t, dmg });
const fireworks = (n = 3, dmg = 10) => F('fireworks', { n, dmg });
const phoenix = (t = 8, frac = 0.35) => F('phoenix', { t, frac });
const solarflare = (t = 3, dmg = 12) => F('solarflare', { t, dmg });
const lighthouse = (t = 4, dmg = 7) => F('lighthouse', { t, dmg });
const mirrorimage = (n = 2, dmg = 4) => F('mirrorimage', { n, dmg });
const echo = (t = 5) => F('echo', { t });
const timewarp = () => F('timewarp', {});
const timestop = (t = 1.5) => F('timestop', { t });
const doom = (dmg = 40) => F('doom', { dmg });
const soullink = (t = 4) => F('soullink', { t });
const fear = (t = 2) => F('fear', { t });
const polymorph = (t = 2.5) => F('polymorph', { t });
const shrink = (t = 5) => F('shrink', { t });
const quicksand = (t = 4, dps = 6) => F('quicksand', { t, dps });
const bunker = (t = 4) => F('bunker', { t });
const stoneskin = (amt = 40) => F('stoneskin', { amt });
const earthquake = (t = 3, dmg = 5) => F('earthquake', { t, dmg });
const rockthrow = (dmg = 24) => F('rockthrow', { dmg });
const pylons = (n = 3, t = 5, dmg = 6) => F('pylons', { n, t, dmg });
const windwall = (t = 4) => F('windwall', { t });
const gale = (t = 3, dmg = 10) => F('gale', { t, dmg });
const liftoff = (t = 1.5, dmg = 16) => F('liftoff', { t, dmg });
const blossoms = (n = 4, hps = 10) => F('blossoms', { n, hps });
const bubble = (t = 1.8, dmg = 16) => F('bubble', { t, dmg });
const tentacles = (n = 4, t = 4, dmg = 5) => F('tentacles', { n, t, dmg });
const riptide = (t = 4, dps = 6) => F('riptide', { t, dps });
const counter = (t = 3, dmg = 30) => F('counter', { t, dmg });
const execute = (dmg = 16) => F('execute', { dmg });
const bleed = (t = 5, dps = 5) => F('bleed', { t, dps });
const hunt = (t = 6) => F('hunt', { t });
const overload = (dmg = 50, r = 50) => F('overload', { dmg, r });
const balllightning = (t = 5, dmg = 6) => F('balllightning', { t, dmg });
const rot = (t = 6) => F('rot', { t });
const miasma = (t = 5, dps = 7) => F('miasma', { t, dps });
const carrionmark = (t = 6, dmg = 22) => F('carrionmark', { t, dmg });
const radiance = (n = 3, dmg = 8, hps = 5) => F('radiance', { n, dmg, hps });
const prismfan = (n = 5, dmg = 7) => F('prismfan', { n, dmg });
const steal = (dmg = 12) => F('steal', { dmg });
const leash = (t = 4, dmg = 6) => F('leash', { t, dmg });
const confuse = (t = 2.5) => F('confuse', { t });
const firewall = (t = 5) => F('firewall', { t });
const nightmare = (t = 5, dmg = 5) => F('nightmare', { t, dmg });
const net = (t = 2, dmg = 12) => F('net', { t, dmg });
const trapdoll = (dmg = 35) => F('trapdoll', { dmg });
const duel = (t = 5) => F('duel', { t });
const banish = (t = 2.5) => F('banish', { t });
const snowball = (dmg = 22) => F('snowball', { dmg });

/**
 * THE TABLE: every creature's and boss's own ultimate, its signature first.
 * (The numbers here set each effect's shape and its share; the budget below
 * scales them all to the same strength.)
 */
const SPEC: Record<string, [string, UltFx[]]> = {
  // ------------------------------------------------------------------ ember
  mole: ['MAGMA ERUPTION', [spikes(16, 1), slowfield(2, 60)]],
  wisp: ['SOLAR SPIRAL', [spiral(18, 4), haste(3)]],
  slug: ['LAVA TIDE', [trail(5), regen(4, 3)]],
  scorpion: ['DEEP VENOM', [bleed(5, 5), weaken(3)]],
  boar: ['FORGE STAMPEDE', [charge(20, 120), stun(0.6, 40)]],
  heron: ['PYRE RAILGUN', [railgun(30), haste(2)]],
  salamander: ['DRAGON BREATH', [firebreath(1.5, 3), shield(1)]],
  chick: ['PHOENIX REBIRTH', [phoenix(8, 0.35), heal(0.08)]],
  camel: ['DUNE QUICKSAND', [quicksand(4, 6), regen(4, 2)]],
  flamingo: ['BLAZING DUEL', [duel(5), rage(3)]],
  // ------------------------------------------------------------------- tide
  toad: ['TONGUE GULP', [pull(16, 110), regen(3, 3)]],
  ray: ['RIPTIDE LANES', [riptide(4, 6), haste(3)]],
  puffer: ['SPONGE PUFF', [absorb(2.5, 6), shield(1)]],
  urchin: ['REEF MINEFIELD', [minefield(5, 10), rootfield(1, 60)]],
  newt: ['SPRING TOTEM', [totem(6, 4), cleanse()]],
  seahorse: ['TIDAL WAVE', [tidalwave(20), slowfield(2, 80)]],
  otter: ['GEYSER SPLASH', [geyser(4, 9), haste(2)]],
  octopus: ['KRAKEN ARMS', [tentacles(4, 4, 5), blind(2)]],
  shark: ['BLOOD FINISHER', [execute(16), haste(2)]],
  lobster: ['CLAW COUNTER', [counter(3, 30), shield(1)]],
  // ------------------------------------------------------------------- moss
  crab: ['KELP BUNKER', [bunker(4), regen(4, 3)]],
  sprout: ['VINE LEASH', [leash(4, 6), rootfield(0.8, 50)]],
  stag: ['THORN PRISON', [prison(3), shred(3)]],
  bear: ['IVY GIANT', [giant(5), heal(0.12)]],
  sloth: ['STILL TIME', [timestop(1.5), regen(4, 3)]],
  bee: ['STINGER SWARM', [homing(6, 4), haste(2)]],
  badger: ['BURROW SLAM', [shockwaves(3, 7), shield(1.5)]],
  caterpillar: ['LEAF STORM', [zone(5, 14), slowfield(2, 60)]],
  porcupine: ['QUILL BLOOM', [ring(14, 6), rootfield(0.8, 50)]],
  koala: ['GUM BLOSSOMS', [blossoms(4, 10), slowfield(2, 60)]],
  ladybug: ['DIZZY SPOTS', [confuse(2.5), shred(3)]],
  beaver: ['DAM TURRET', [turret(6, 4), shield(1.5)]],
  // ------------------------------------------------------------------ frost
  golem: ['RIME SKIN', [stoneskin(40), stun(0.6, 50)]],
  jelly: ['FLASH FREEZE', [iceblock(1.5), slowfield(2, 70)]],
  ram: ['AVALANCHE LEAP', [leap(18, 26), stun(0.6, 50)]],
  penguin: ['GIANT SNOWBALL', [snowball(22), slowfield(2, 70)]],
  yeti: ['BLIZZARD', [blizzard(4, 6), weaken(3)]],
  walrus: ['TUSK QUAKE', [quakeline(7, 9), shield(1)]],
  ermine: ['WHITEOUT', [stealth(2.5), slowfield(2, 60)]],
  moose: ['ROLLING AVALANCHE', [avalanche(18), stun(0.6, 50)]],
  narwhal: ['NARHORN LANCE', [beam(22, 240), shred(3)]],
  // ------------------------------------------------------------------- volt
  hound: ['THUNDER PACK', [pack(3, 3), haste(3)]],
  spider: ['STORM BROOD', [spiders(3), rootfield(1, 60), slowfield(2, 60)]],
  gecko: ['CHAIN STRIKE', [chain(4, 6), haste(3)]],
  ferret: ['GRAND HEIST', [steal(12), reset()]],
  rhino: ['THUNDER QUAKE', [earthquake(3, 5), rage(3)]],
  eel: ['BALL LIGHTNING', [balllightning(5, 6), slowfield(2, 60)]],
  wasp: ['STATIC FIELD', [staticfield(4, 8), haste(2)]],
  mouse: ['DOUBLE SPARK', [echo(5), haste(3)]],
  zebra: ['THUNDER LIFT', [liftoff(1.5, 16), shred(2)]],
  lemur: ['MIRROR TROOP', [mirrorimage(2, 4), blind(1.5)]],
  cricket: ['RESONANT PYLONS', [pylons(3, 5, 6), silence(2)]],
  // ------------------------------------------------------------------ stone
  beetle: ['BOULDER BARRAGE', [barrage(7, 5), shield(1.5)]],
  roller: ['ROCKSLIDE ORBIT', [orbit(4, 4, 4), haste(3)]],
  tortoise: ['MIRROR SHELL', [reflect(3), regen(4, 3)]],
  obelisk: ['GRAVITY WELL', [blackhole(3, 5), silence(2)]],
  hedgehog: ['GEODE SPINES', [thorns(3), stun(0.5, 40)]],
  armadillo: ['RUBBLE BLAST', [nova(16, 44), shield(2)]],
  crocodile: ['DEATH ROLL', [banish(2.5), shred(3)]],
  pangolin: ['SCALE BOULDER', [bouncer(4, 8), shield(1.5)]],
  goat: ['CRAG THROW', [rockthrow(24), stun(0.6, 50)]],
  // ------------------------------------------------------------------- gale
  moth: ['TEMPEST', [tornado(4, 5), blind(2)]],
  mantis: ['BLADE DANCE', [multiblink(3, 9), haste(2)]],
  hare: ['GALE FORCE', [gale(3, 10), haste(3)]],
  fox: ['KITE TRICK', [clones(2), blind(2)]],
  falcon: ['STORM DIVE', [blink(22), shred(3)]],
  dragonfly: ['SKIM STRAFE', [volley(8, 4), haste(3)]],
  parrot: ['POLLY-MORPH', [polymorph(2.5), haste(2)]],
  squirrel: ['NUT DOLL', [trapdoll(35), haste(2)]],
  swan: ['STORM WING', [sweep(18, 180), slowfield(2, 70)]],
  // ------------------------------------------------------------------- murk
  serpent: ['VIPER ROT', [rot(6), weaken(3)]],
  bat: ['DUSK FEAST', [lifesteal(5), blind(2)]],
  shroom: ['SPORE CLOUD', [miasma(5, 7), weaken(3)]],
  crow: ['MURDER STORM', [crows(4, 3), blind(2)]],
  lynx: ['NIGHT HUNT', [hunt(6), haste(3)]],
  wraith: ['HAUNTING', [bombers(3, 10), slowfield(2, 70)]],
  leech: ['BLOOD FEAST', [drain(4, 6), weaken(3)]],
  possum: ['REWIND', [timewarp(), invuln(1)]],
  raccoon: ['SHADOW SWAP', [swap(10), silence(2)]],
  vulture: ['CARRION CIRCLE', [carrionmark(6, 22), heal(0.08)]],
  skunk: ['STINK SCARE', [fear(2), weaken(3)]],
  // ------------------------------------------------------------------- glow
  owl: ['SOLAR FLARE', [solarflare(3, 12), haste(2)]],
  centipede: ['LUMEN NET', [net(2, 12), shred(3)]],
  angler: ['ABYSS BUBBLE', [bubble(1.8, 16), regen(3, 3)]],
  firefly: ['LIGHTHOUSE', [lighthouse(4, 7), shield(1)]],
  snail: ['STAR OVERLOAD', [overload(50, 50), shield(1.2)]],
  worm: ['GLIM FENCE', [laserfence(4, 10), slowfield(2, 60)]],
  starfish: ['STARCROSS', [cross(14, 80), heal(0.1)]],
  axolotl: ['RADIANCE', [radiance(3, 8, 5), cleanse()]],
  peacock: ['PRISM FAN', [prismfan(5, 7), blind(2)]],
  // ----------------------------------------------------------------- bosses
  b_lich: ['LANTERN DOOM', [doom(40), weaken(4), stun(0.8, 70)]],
  b_seraph: ['STARFALL', [meteor(7, 10, 20), invuln(1), haste(3)]],
  b_hydra: ['HYDRA FIREWALL', [firewall(5), regen(5, 4), weaken(3)]],
  b_queen: ['BRASS SHRINK', [shrink(5), rootfield(1.2, 70), shield(2)]],
  b_maw: ['SOUL MAW', [soullink(4), rage(4), rootfield(1.2, 60)]],
  b_cloud: ['STORM FIREWORKS', [fireworks(3, 10), blind(2), slowfield(2.5, 90)]],
  b_wyrm: ['WORLD NIGHTMARE', [nightmare(5, 5), blind(2.5), stun(0.8, 70)]],
  b_kraken: ['KRAKEN GLAIVE', [boomerang(16), slowfield(2.5, 90), shred(3)]],
  b_mammoth: ['MAMMOTH ICICLES', [icicles(9, 14), shield(2.5), stun(0.8, 70)]],
  b_sphinx: ['RIDDLE WALL', [windwall(4), silence(3), blind(2.5)]],
};

/** What an enemy deals in a second when it is free to (the plain attacks average 16; not every one lands). */
const ENEMY_DPS = 12;
const pct = (k: number): number => Math.round((k - 1) * 100);

/** THE WORDS, in a line (for the STATS page). */
function words(f: UltFx): string {
  switch (f.k) {
    case 'charge': return `CHARGES ${f.dist}PX THROUGH THEM FOR ${f.dmg}`;
    case 'blink': return `APPEARS BEHIND THEM AND STRIKES FOR ${f.dmg}`;
    case 'multiblink': return `${f.n} BLINK STRIKES OF ${f.dmg}`;
    case 'leap': return `LEAPS ON THEM, ${f.dmg} AROUND WHERE IT LANDS`;
    case 'nova': return `BLAST ROUND ITSELF, ${f.r}PX: ${f.dmg} AND THROWS THEM`;
    case 'shockwaves': return `${f.n} SHOCKWAVE RINGS OF ${f.dmg}`;
    case 'pull': return `DRAGS THEM IN FROM ${f.r}PX AND CRUSHES FOR ${f.dmg}`;
    case 'swap': return `SWAPS PLACES WITH THEM, ${f.dmg} AND A DAZE`;
    case 'barrage': return `${f.n} SHOTS IN A FAN, ${f.dmg} EACH`;
    case 'volley': return `${f.n} RAPID AIMED SHOTS, ${f.dmg} EACH`;
    case 'spiral': return `A SPIRAL OF ${f.n} SHOTS, ${f.dmg} EACH`;
    case 'ring': return `${f.n} SHOTS IN EVERY DIRECTION, ${f.dmg} EACH`;
    case 'homing': return `${f.n} SEEKING SHOTS, ${f.dmg} EACH`;
    case 'beam': return `A ${f.len}PX BEAM THROUGH COVER FOR ${f.dmg}`;
    case 'sweep': return `A BEAM SWEPT ACROSS THEM FOR ${f.dmg}`;
    case 'cross': return `A CROSS OF 4 BEAMS, ${f.dmg} EACH`;
    case 'chain': return `LIGHTNING STRIKES THEM ${f.n} TIMES, ${f.dmg} EACH`;
    case 'meteor': return `${f.n} STRIKES RAIN ON THEM, ${f.dmg} EACH`;
    case 'quakeline': return `A LINE OF ${f.n} ERUPTIONS, ${f.dmg} EACH`;
    case 'spikes': return `SPIKES UNDER THEM: ${f.dmg} AND HELD ${f.t}S`;
    case 'minefield': return `${f.n} MINES ROUND THEM, ${f.dmg} EACH`;
    case 'zone': return `${f.n} PATCHES OF HARMFUL GROUND ROUND THEM`;
    case 'trail': return `A BURNING TRAIL AND SPEED FOR ${f.t}S`;
    case 'drain': return `DRAINS ${f.dps} A SECOND FOR ${f.t}S`;
    case 'blackhole': return `A BLACK HOLE ${f.t}S: PULLS, ${f.dps} A SECOND`;
    case 'tornado': return `A TORNADO CHASES THEM ${f.t}S, ${f.dps} A SECOND`;
    case 'bouncer': return `A BOUNCING BOULDER ${f.t}S, ${f.dmg} A HIT`;
    case 'orbit': return `${f.n} BLADES CIRCLE IT ${f.t}S, ${f.dmg} A HIT`;
    case 'pack': return `${f.n} BITERS HUNT THEM, ${f.dmg} A BITE`;
    case 'turret': return `A TURRET SHOOTS THEM ${f.t}S, ${f.dmg} A SHOT`;
    case 'totem': return `A TOTEM HEALS IT ${f.hps} A SECOND FOR ${f.t}S`;
    case 'bombers': return `${f.n} HUSKS WALK AT THEM AND BURST FOR ${f.dmg}`;
    case 'crows': return `${f.n} CROWS PECK THEM, ${f.dmg} A PECK`;
    case 'spiders': return `${f.n} SPIDERLINGS CLING ON AND SLOW THEM`;
    case 'clones': return `${f.n} DECOYS TO DRAW THEIR FIRE`;
    case 'prison': return `WALLS THEM IN FOR ${f.t}S`;
    case 'stun': return `STUNS THEM ${f.t}S WITHIN ${f.r}PX`;
    case 'slowfield': return `SLOWS THEM ${f.t}S WITHIN ${f.r}PX`;
    case 'rootfield': return `HOLDS THEM ${f.t}S WITHIN ${f.r}PX`;
    case 'blind': return `BLINDS THEM ${f.t}S`;
    case 'silence': return `ADDS ${f.t}S TO THEIR COOLDOWNS`;
    case 'weaken': return `THEIR HITS -30% FOR ${f.t}S`;
    case 'shred': return `THEY TAKE +25% FOR ${f.t}S`;
    case 'shield': return `A SHIELD FOR ${f.t}S`;
    case 'invuln': return `UNTOUCHABLE FOR ${f.t}S`;
    case 'reflect': return `REFLECTS SHOTS FOR ${f.t}S`;
    case 'thorns': return `SPIKED SHIELD FOR ${f.t}S`;
    case 'heal': return `HEALS ${Math.round(f.frac * 100)}% OF ITS HEALTH`;
    case 'regen': return `HEALS ${f.hps} A SECOND FOR ${f.t}S`;
    case 'rage': return `FRENZY ${f.t}S: BIGGER, FASTER, HARDER HITS`;
    case 'haste': return `FASTER FOR ${f.t}S`;
    case 'lifesteal': return `ITS HITS HEAL IT FOR ${f.t}S`;
    case 'giant': return `GIANT FOR ${f.t}S: TAKES 30% LESS`;
    case 'stealth': return `INVISIBLE FOR ${f.t}S`;
    case 'reset': return 'ITS MOVES READY AT ONCE';
    case 'cleanse': return 'SHAKES OFF EVERY HARMFUL EFFECT';
    case 'geyser': return `${f.n} GEYSERS UNDER THEM, ${f.dmg} EACH`;
    case 'tidalwave': return `A TIDAL WAVE ACROSS THE ARENA FOR ${f.dmg}`;
    case 'iceblock': return `FROZEN IN ICE ${f.t}S`;
    case 'icicles': return `A ROW OF ${f.n} ICICLES, ${f.dmg} EACH`;
    case 'avalanche': return `3 ROLLING BOULDERS, ${f.dmg} EACH`;
    case 'blizzard': return `A BLIZZARD ${f.t}S, ${f.dps} A SECOND`;
    case 'absorb': return `SOAKS UP SHOTS ${f.t}S, FIRES THEM BACK`;
    case 'laserfence': return `A LASER FENCE ${f.t}S, ${f.dps} A SECOND`;
    case 'staticfield': return `A STATIC FIELD ${f.t}S, ${f.dps} A SECOND`;
    case 'railgun': return `A WALL-BOUNCING RAILGUN FOR ${f.dmg}`;
    case 'boomerang': return `A GLAIVE OUT AND BACK, ${f.dmg} A PASS`;
    case 'firebreath': return `FIRE BREATH ${f.t}S`;
    case 'fireworks': return `${f.n} FIREWORKS OVER THEM, ${f.dmg} A BURST`;
    case 'phoenix': return `RISES AGAIN IF BEATEN IN ${f.t}S`;
    case 'solarflare': return `A SOLAR FLARE: BLIND ${f.t}S, ${f.dmg} AND BURNING`;
    case 'lighthouse': return `3 TURNING BEAMS ${f.t}S, ${f.dmg} A HIT`;
    case 'mirrorimage': return `${f.n} FIGHTING COPIES, ${f.dmg} A SHOT`;
    case 'echo': return `EVERY MOVE TWICE FOR ${f.t}S`;
    case 'timewarp': return 'REWINDS 3 SEC';
    case 'timestop': return `STOPS TIME FOR THEM ${f.t}S`;
    case 'doom': return `DOOM: ${f.dmg} IN 3 SEC`;
    case 'soullink': return `SHARES ITS PAIN WITH THEM ${f.t}S`;
    case 'fear': return `THEY FLEE IN FEAR ${f.t}S`;
    case 'polymorph': return `TURNS THEM INTO A SHEEP ${f.t}S`;
    case 'shrink': return `SHRINKS THEM ${f.t}S`;
    case 'quicksand': return `A QUICKSAND PIT ${f.t}S`;
    case 'bunker': return `WALLS ITSELF IN ${f.t}S`;
    case 'stoneskin': return `ARMOUR THAT SOAKS ${f.amt}`;
    case 'earthquake': return `AN EARTHQUAKE ${f.t}S`;
    case 'rockthrow': return `A BOULDER THAT BURSTS INTO ROCKS, ${f.dmg}`;
    case 'pylons': return `${f.n} PULSING PYLONS ${f.t}S`;
    case 'windwall': return `A WALL OF WIND ${f.t}S`;
    case 'gale': return `A GALE BLOWS THEM AWAY ${f.t}S`;
    case 'liftoff': return `LIFTS THEM UP ${f.t}S, DROPS FOR ${f.dmg}`;
    case 'blossoms': return `${f.n} HEALING BLOSSOMS, ${f.hps} EACH`;
    case 'bubble': return `BUBBLES THEM ${f.t}S, POPS FOR ${f.dmg}`;
    case 'tentacles': return `${f.n} TENTACLES GRAB AT THEM`;
    case 'riptide': return `3 CURRENTS DRAG THEM ${f.t}S`;
    case 'counter': return `COUNTERS THE NEXT HIT FOR ${f.dmg}`;
    case 'execute': return `A FINISHER: ${f.dmg}, TRIPLE IF THEY ARE LOW`;
    case 'bleed': return `A DEEP WOUND ${f.t}S`;
    case 'hunt': return `THE HUNT: +40% ON THEM ${f.t}S`;
    case 'overload': return `OVERLOADS: ${f.dmg} ALL AROUND`;
    case 'balllightning': return `A BALL OF LIGHTNING ${f.t}S`;
    case 'rot': return `ROTS THEIR HEALTH ${f.t}S`;
    case 'miasma': return `A SPREADING POISON CLOUD ${f.t}S`;
    case 'carrionmark': return `MARKED FOR THE KILL ${f.t}S`;
    case 'radiance': return `${f.n} PULSES: HEAL ${f.hps}, HURT ${f.dmg}`;
    case 'prismfan': return `${f.n} CONVERGING BEAMS, ${f.dmg} EACH`;
    case 'steal': return 'STEALS THEIR BOOSTS';
    case 'leash': return `LEASHES THEM ${f.t}S`;
    case 'confuse': return `SCRAMBLES THEIR CONTROLS ${f.t}S`;
    case 'firewall': return `A WALL OF FIRE ${f.t}S`;
    case 'nightmare': return `THEIR OWN SHADOW HUNTS THEM ${f.t}S`;
    case 'net': return `A NET: ${f.dmg} AND HELD ${f.t}S`;
    case 'trapdoll': return `A DOLL THAT BLOWS UP FOR ${f.dmg}`;
    case 'duel': return `A DUEL RING ${f.t}S`;
    case 'banish': return `BANISHES THEM ${f.t}S`;
    case 'snowball': return `A GROWING SNOWBALL, UP TO ${f.dmg * 2}`;
  }
}

/**
 * THE SAME, IN FULL: one sentence for each step, saying who it hits, how
 * far, how much, and how long -- the arena's own numbers (CreatureArena `ultFx`).
 */
function fullWords(f: UltFx): string {
  switch (f.k) {
    case 'charge': return `RUSHES STRAIGHT AT THE ENEMY, UP TO ${f.dist}PX, AND DEALS ${f.dmg} DAMAGE IF IT RUNS INTO THEM.`;
    case 'blink': return `VANISHES AND REAPPEARS RIGHT BEHIND THE ENEMY, WHEREVER THEY ARE, AND HITS THEM AT ONCE FOR ${f.dmg} DAMAGE.`;
    case 'multiblink': return `BLINKS TO THE ENEMY ${f.n} TIMES IN A ROW, EACH TIME FROM A DIFFERENT SIDE, STRIKING FOR ${f.dmg} DAMAGE EVERY TIME.`;
    case 'leap': return `LEAPS HIGH, CANNOT BE HIT IN THE AIR, AND CRASHES DOWN WHERE THE ENEMY STANDS, DEALING ${f.dmg} DAMAGE TO ANYONE WITHIN ${f.r}PX.`;
    case 'nova': return `A BLAST ALL AROUND ITSELF: AN ENEMY WITHIN ${f.r}PX TAKES ${f.dmg} DAMAGE AND IS THROWN BACK.`;
    case 'shockwaves': return `SENDS OUT ${f.n} SHOCKWAVE RINGS, ONE AFTER ANOTHER, EACH WIDER THAN THE LAST. EVERY RING THAT CATCHES THE ENEMY DEALS ${f.dmg} DAMAGE.`;
    case 'pull': return `IF THE ENEMY IS WITHIN ${f.r}PX, IT YANKS THEM RIGHT UP CLOSE, THEN SLAMS THEM FOR ${f.dmg} DAMAGE.`;
    case 'swap': return `SWAPS PLACES WITH THE ENEMY IN A FLASH, WHEREVER THEY ARE. THEY TAKE ${f.dmg} DAMAGE AND ARE DAZED, UNABLE TO ACT, FOR 0.5S.`;
    case 'barrage': return `FIRES ${f.n} SHOTS IN A FAN AT THE ENEMY. EACH ONE THAT HITS DEALS ${f.dmg} DAMAGE (UP TO ${f.n * f.dmg} IF EVERY SHOT LANDS). THE CLOSER THEY ARE, THE MORE LAND.`;
    case 'volley': return `FIRES ${f.n} SHOTS ONE AFTER ANOTHER, EACH AIMED AT WHERE THE ENEMY IS NOW, ${f.dmg} DAMAGE EACH (UP TO ${f.n * f.dmg}).`;
    case 'spiral': return `SPINS AND SPRAYS ${f.n} SHOTS OUT IN A SPIRAL ALL AROUND IT, ${f.dmg} DAMAGE EACH. THE CLOSER THE ENEMY, THE MORE OF THEM HIT.`;
    case 'ring': return `FIRES ${f.n} SHOTS AT ONCE, ONE IN EVERY DIRECTION, ${f.dmg} DAMAGE EACH. THE ONES HEADING FOR THE ENEMY HIT WHEREVER THEY STAND.`;
    case 'homing': return `FIRES ${f.n} SEEKING SHOTS THAT CURVE AFTER THE ENEMY AS THEY FLY, ${f.dmg} DAMAGE EACH (UP TO ${f.n * f.dmg}).`;
    case 'beam': return `AN INSTANT BEAM, ${f.len}PX LONG, STRAIGHT AT THE ENEMY. IT GOES THROUGH COVER AND DEALS ${f.dmg} DAMAGE.`;
    case 'sweep': return `FIRES A BEAM ${f.len}PX LONG AND SWEEPS IT ACROSS A WIDE ARC IN FRONT OF IT. IF IT PASSES OVER THE ENEMY IT DEALS ${f.dmg} DAMAGE, EVEN THROUGH COVER.`;
    case 'cross': return `FIRES 4 BEAMS IN A CROSS FROM ITSELF, ONE AIMED AT THE ENEMY, EACH ${f.len}PX LONG. THE ENEMY TAKES ${f.dmg} DAMAGE FROM ANY BEAM THAT TOUCHES THEM.`;
    case 'chain': return `LIGHTNING STRIKES THE ENEMY FROM ABOVE ${f.n} TIMES, ONE STRIKE EVERY 0.3S WHEREVER THEY ARE, ${f.dmg} DAMAGE EACH (UP TO ${f.n * f.dmg}).`;
    case 'meteor': return `${f.n} STRIKES FALL ON AND AROUND THE ENEMY. A CIRCLE SHOWS WHERE EACH WILL LAND JUST BEFORE IT DOES, AND EACH ONE THAT HITS DEALS ${f.dmg} DAMAGE.`;
    case 'quakeline': return `A LINE OF ${f.n} ERUPTIONS RIPS ACROSS THE GROUND FROM IT TOWARD THE ENEMY, ONE AFTER ANOTHER, ${f.dmg} DAMAGE TO ANYONE CAUGHT BY ONE.`;
    case 'spikes': return `A MARK APPEARS UNDER THE ENEMY, AND A MOMENT LATER SPIKES BURST UP THERE: ${f.dmg} DAMAGE, AND THEY ARE HELD IN PLACE FOR ${f.t}S.`;
    case 'minefield': return `SCATTERS ${f.n} MINES ON THE GROUND AROUND THE ENEMY. EACH ONE THEY STEP ON BLOWS UP FOR ${f.dmg} DAMAGE.`;
    case 'zone': return `LEAVES ${f.n} PATCHES OF HARMFUL GROUND AROUND THE ENEMY FOR ${LINGER_S}S. STANDING IN ONE COSTS ${LINGER_DMG * 2} HEALTH A SECOND.`;
    case 'trail': return `FOR ${f.t}S IT MOVES ${pct(HASTE_SPEED)}% FASTER AND LEAVES A TRAIL OF HARMFUL GROUND BEHIND IT. STANDING IN THE TRAIL COSTS ${LINGER_DMG * 2} HEALTH A SECOND.`;
    case 'drain': return `FOR ${f.t}S, DRAINS ${f.dps} HEALTH A SECOND FROM THE ENEMY AND HEALS ITSELF BY THE SAME, AS LONG AS THEY STAY WITHIN 150PX.`;
    case 'blackhole': return `OPENS A BLACK HOLE WHERE THE ENEMY STANDS FOR ${f.t}S. IT KEEPS PULLING THEM INTO ITS MIDDLE, AND DEALS ${f.dps} DAMAGE A SECOND WHILE THEY ARE IN IT.`;
    case 'tornado': return `CALLS UP A TORNADO THAT CHASES THE ENEMY FOR ${f.t}S. WHILE IT IS ON THEM IT DEALS ${f.dps} DAMAGE A SECOND AND SLOWS THEM.`;
    case 'bouncer': return `SENDS A BIG BOULDER BOUNCING ROUND THE ARENA OFF THE WALLS FOR ${f.t}S. EVERY TIME IT RUNS INTO THE ENEMY IT DEALS ${f.dmg} DAMAGE AND KNOCKS THEM ASIDE.`;
    case 'orbit': return `${f.n} BLADES SPIN ROUND IT FOR ${f.t}S. AN ENEMY THAT COMES CLOSE IS CUT FOR ${f.dmg} DAMAGE EACH TIME A BLADE PASSES THROUGH THEM.`;
    case 'pack': return `SUMMONS ${f.n} FAST BITERS THAT HUNT THE ENEMY FOR ${PACK_LIFE}S, BITING FOR ${f.dmg} DAMAGE OVER AND OVER. EACH ONE CAN BE SHOT DOWN.`;
    case 'turret': return `BUILDS A TURRET BESIDE ITSELF THAT FIRES AT THE ENEMY FOR ${f.t}S, ${f.dmg} DAMAGE A SHOT, ABOUT ONE SHOT A SECOND. IT CAN BE SHOT DOWN.`;
    case 'totem': return `PLANTS A HEALING TOTEM WHERE IT STANDS FOR ${f.t}S. WHILE IT STAYS WITHIN 50PX OF THE TOTEM, IT HEALS ${f.hps} HEALTH A SECOND.`;
    case 'bombers': return `RAISES ${f.n} HUSKS THAT WALK AT THE ENEMY AND BURST FOR ${f.dmg} DAMAGE WHEN THEY REACH THEM, UNLESS THEY ARE SHOT DOWN FIRST.`;
    case 'crows': return `SENDS ${f.n} CROWS TO CIRCLE THE ENEMY FOR ${CROW_LIFE}S, EACH PECKING FOR ${f.dmg} DAMAGE EVERY TIME IT PASSES THROUGH THEM.`;
    case 'spiders': return `RELEASES ${f.n} SPIDERLINGS THAT RUN AT THE ENEMY AND CLING ON. EACH ONE CLINGING MAKES THEM 15% SLOWER.`;
    case 'clones': return `MAKES ${f.n} COPIES OF ITSELF NEARBY FOR 3S. THE ENEMY AIMS AT WHICHEVER IS NEAREST, SO THEIR SHOTS CAN HIT A COPY INSTEAD. EACH COPY BREAKS AFTER 6 DAMAGE.`;
    case 'prison': return `RAISES A RING OF WALLS AROUND THE ENEMY FOR ${f.t}S. THEY CANNOT WALK OR SHOOT OUT UNTIL THE WALLS FALL OR ARE BROKEN.`;
    case 'stun': return `IF THE ENEMY IS WITHIN ${f.r}PX, THEY ARE STUNNED FOR ${f.t}S: THEY CANNOT MOVE OR ATTACK.`;
    case 'slowfield': return `IF THE ENEMY IS WITHIN ${f.r}PX, THEY MOVE ALMOST AT HALF SPEED FOR ${f.t}S.`;
    case 'rootfield': return `ROOTS BURST UP ALL AROUND IT: AN ENEMY WITHIN ${f.r}PX IS HELD IN PLACE FOR ${f.t}S, ABLE TO ATTACK BUT NOT TO MOVE.`;
    case 'blind': return `BLINDS THE ENEMY FOR ${f.t}S, IF THEY ARE WITHIN ${BLIND_R}PX: THEY CAN BARELY SEE, AND THEIR SHOTS GO WILD.`;
    case 'silence': return `JAMS THE ENEMY: ${f.t}S IS ADDED TO EVERY ONE OF THEIR COOLDOWNS, SO THEIR MOVES TAKE THAT MUCH LONGER TO COME BACK.`;
    case 'weaken': return `WEAKENS THE ENEMY FOR ${f.t}S: EVERY HIT THEY LAND DEALS 30% LESS DAMAGE.`;
    case 'shred': return `SHREDS THE ENEMY DEFENCES FOR ${f.t}S: THEY TAKE 25% MORE DAMAGE FROM EVERYTHING.`;
    case 'shield': return `A SHIELD THAT BLOCKS EVERY HIT ON IT FOR ${f.t}S.`;
    case 'invuln': return `FOR ${f.t}S NOTHING CAN HURT IT: EVERY HIT AND SHOT DOES NO DAMAGE.`;
    case 'reflect': return `A MIRROR SHIELD FOR ${f.t}S: IT BLOCKS EVERY HIT, AND SHOTS THAT HIT IT FLY BACK AT WHOEVER FIRED THEM.`;
    case 'thorns': return `A SPIKED SHIELD FOR ${f.t}S: IT BLOCKS EVERY HIT, AND ANYTHING THAT HITS IT TAKES DAMAGE BACK.`;
    case 'heal': return `HEALS ${Math.round(f.frac * 100)}% OF ITS FULL HEALTH AT ONCE.`;
    case 'regen': return `HEALS ${f.hps} HEALTH A SECOND FOR ${f.t}S.`;
    case 'rage': return `A FRENZY FOR ${f.t}S: IT GROWS A QUARTER BIGGER, MOVES MUCH FASTER, AND ITS HITS DEAL ${pct(AURA_POWER)}% MORE DAMAGE.`;
    case 'haste': return `MOVES ${pct(HASTE_SPEED)}% FASTER FOR ${f.t}S.`;
    case 'lifesteal': return `FOR ${f.t}S, EVERY HIT IT LANDS HEALS IT BY ${Math.round(LIFESTEAL_FRAC * 100)}% OF THE DAMAGE DEALT.`;
    case 'giant': return `GROWS TO GIANT SIZE FOR ${f.t}S: IT TAKES ${Math.round((1 - GIANT_TAKEN) * 100)}% LESS DAMAGE FROM EVERY HIT AND NOTHING CAN KNOCK IT BACK.`;
    case 'stealth': return `TURNS INVISIBLE FOR ${f.t}S. THE ENEMY CANNOT AIM AT IT, AND ITS NEXT HIT COMES OUT OF NOWHERE.`;
    case 'reset': return 'ALL ITS OWN MOVES ARE READY AGAIN AT ONCE, WITH NO COOLDOWN LEFT.';
    case 'cleanse': return 'SHAKES OFF EVERY HARMFUL EFFECT ON IT: BURNS, POISON, SLOWS, HOLDS AND THE REST.';
    case 'geyser': return `${f.n} GEYSERS BURST UP ONE AFTER ANOTHER, EACH WHERE THE ENEMY IS STANDING, WITH A RIPPLE A MOMENT BEFORE. EACH ONE THAT CATCHES THEM DEALS ${f.dmg} DAMAGE AND THROWS THEM OFF BALANCE FOR 0.4S.`;
    case 'tidalwave': return `A TALL WAVE RISES BEHIND IT AND SWEEPS ACROSS THE WHOLE ARENA. IT DEALS ${f.dmg} DAMAGE TO THE ENEMY AND CARRIES THEM A LONG WAY WITH IT. ONLY A WALL STOPS IT.`;
    case 'iceblock': return `FREEZES THE ENEMY SOLID IN A BLOCK OF ICE FOR ${f.t}S: THEY CANNOT MOVE OR ATTACK. THE FIRST HIT ON THE ICE SHATTERS IT AND DEALS DOUBLE DAMAGE.`;
    case 'icicles': return `A ROW OF ${f.n} ICICLES HANGS RIGHT ACROSS THE ARENA AT THE ENEMY, MARKED ON THE FLOOR, THEN FALLS ONE AFTER ANOTHER. ONE THAT LANDS ON THEM DEALS ${f.dmg} DAMAGE.`;
    case 'avalanche': return `3 BOULDERS ROLL ACROSS THE ARENA FROM ITS SIDE, ONE IN EACH OF 3 LANES AROUND THE ENEMY. EACH ONE THAT RUNS INTO THEM DEALS ${f.dmg} DAMAGE AND KNOCKS THEM FLAT.`;
    case 'blizzard': return `A BLIZZARD FILLS THE ARENA FOR ${f.t}S. THE ENEMY IS SLOWED THE WHOLE TIME, AND HAIL STRIKES THEM FOR ${f.dps} DAMAGE A SECOND WHEREVER THEY GO.`;
    case 'absorb': return `PUFFS UP FOR ${f.t}S, SOAKING UP EVERY SHOT THAT HITS IT WITHOUT TAKING DAMAGE (SHOTS ALREADY FLYING AT IT ARE SOAKED TOO). WHEN IT ENDS, IT FIRES THEM ALL BACK AT THE ENEMY, ${f.dmg} DAMAGE EACH.`;
    case 'laserfence': return `PLANTS 2 POSTS, ONE EACH SIDE OF THE ENEMY, WITH A LASER BETWEEN THEM FOR ${f.t}S. TOUCHING THE LASER DEALS ${f.dps} DAMAGE A SECOND.`;
    case 'staticfield': return `CRACKLES WITH STATIC FOR ${f.t}S: AN ENEMY WITHIN 45PX OF IT TAKES ${f.dps} DAMAGE A SECOND. THE FIELD GOES WHERE IT GOES.`;
    case 'railgun': return `CHARGES FOR 0.7S WITH A LINE SHOWING ITS AIM, THEN FIRES A RAIL SHOT THAT GOES THROUGH COVER AND BOUNCES OFF THE ARENA WALL ONCE. IT DEALS ${f.dmg} DAMAGE.`;
    case 'boomerang': return `THROWS A GREAT GLAIVE THAT FLIES OUT PAST THE ENEMY AND CURVES BACK TO IT. IT CAN HIT ON THE WAY OUT AND AGAIN ON THE WAY BACK, ${f.dmg} DAMAGE EACH TIME.`;
    case 'firebreath': return `BREATHES A CONE OF FIRE FOR ${f.t}S, TURNING TO FOLLOW THE ENEMY. WHILE THEY ARE IN THE FLAMES (UP TO 90PX AWAY) THEY TAKE ${f.dmg} DAMAGE ABOUT 6 TIMES A SECOND.`;
    case 'fireworks': return `LAUNCHES ${f.n} ROCKETS THAT BURST HIGH OVER THE ENEMY INTO RINGS OF SPARKS, MARKED ON THE FLOOR. EACH BURST THAT CATCHES THEM DEALS ${f.dmg} DAMAGE.`;
    case 'phoenix': return `FOR ${f.t}S, IF IT WOULD BE BEATEN, IT RISES AGAIN FROM ITS ASHES WITH ${Math.round(f.frac * 100)}% OF ITS HEALTH. ONCE.`;
    case 'solarflare': return `A BLINDING SOLAR FLARE: THE ENEMY TAKES ${f.dmg} DAMAGE, IS SET ALIGHT, AND IS BLINDED FOR ${f.t}S WHEREVER THEY ARE.`;
    case 'lighthouse': return `3 BEAMS OF LIGHT TURN AROUND IT LIKE A LIGHTHOUSE FOR ${f.t}S, EACH 70PX LONG. AN ENEMY A BEAM PASSES OVER TAKES ${f.dmg} DAMAGE.`;
    case 'mirrorimage': return `SPLITS OFF ${f.n} MIRROR COPIES OF ITSELF FOR 5S. THEY STAY NEAR IT AND SHOOT AT THE ENEMY, ${f.dmg} DAMAGE A SHOT, ONE SHOT A SECOND EACH. EACH COPY CAN BE SHOT DOWN.`;
    case 'echo': return `FOR ${f.t}S, EVERY MOVE IT MAKES IS REPEATED BY ITS ECHO A MOMENT LATER, SO EACH ONE HITS TWICE.`;
    case 'timewarp': return 'REWINDS ITSELF 3 SEC: IT JUMPS BACK TO WHERE IT WAS, AND IF IT HAD MORE HEALTH THEN, IT GETS THAT HEALTH BACK.';
    case 'timestop': return `STOPS TIME FOR THE ENEMY FOR ${f.t}S: THEY ARE FROZEN IN PLACE, AND THEIR SHOTS HANG IN THE AIR UNTIL TIME STARTS AGAIN.`;
    case 'doom': return `MARKS THE ENEMY WITH DOOM. A COUNTDOWN APPEARS OVER THEM, AND IN 3S THEY TAKE ${f.dmg} DAMAGE, WHEREVER THEY ARE.`;
    case 'soullink': return `LINKS ITS SOUL TO THE ENEMY FOR ${f.t}S: IT TAKES ONLY HALF OF EVERY HIT, AND THE OTHER HALF IS DEALT TO THEM INSTEAD.`;
    case 'fear': return `TERRIFIES THE ENEMY FOR ${f.t}S: THEY RUN AWAY FROM IT AND CANNOT ATTACK.`;
    case 'polymorph': return `TURNS THE ENEMY INTO A HARMLESS SHEEP FOR ${f.t}S: THEY CANNOT ATTACK AND MOVE SLOWER.`;
    case 'shrink': return `SHRINKS THE ENEMY FOR ${f.t}S: THEY BECOME SMALL AND EVERY HIT THEY LAND DEALS 30% LESS DAMAGE.`;
    case 'quicksand': return `OPENS A PIT OF QUICKSAND UNDER THE ENEMY FOR ${f.t}S. IN IT THEY ARE SLOWED AND TAKE ${f.dps} DAMAGE A SECOND, AND IN ITS MIDDLE THEY SINK AND CANNOT MOVE.`;
    case 'bunker': return `RAISES A RING OF WALLS AROUND ITSELF FOR ${f.t}S. THEY BLOCK THE ENEMY AND THEIR SHOTS, BUT NOT ITS OWN.`;
    case 'stoneskin': return `HARDENS INTO ARMOUR THAT SOAKS UP THE NEXT ${f.amt} DAMAGE IT WOULD TAKE.`;
    case 'earthquake': return `SHAKES THE WHOLE ARENA FOR ${f.t}S. EVERY 0.6S THE GROUND HEAVES UNDER THE ENEMY: ${f.dmg} DAMAGE, AND IT STOPS WHATEVER THEY WERE DOING.`;
    case 'rockthrow': return `HURLS A GIANT BOULDER OVER COVER AT THE ENEMY, MARKED WHERE IT WILL LAND. IT DEALS ${f.dmg} DAMAGE, THEN BURSTS INTO 6 ROCKS THAT FLY OUTWARD.`;
    case 'pylons': return `RAISES ${f.n} CRYSTAL PYLONS AROUND THE ENEMY FOR ${f.t}S. EACH ONE PULSES A RING EVERY SECOND, DEALING ${f.dmg} DAMAGE TO THEM IF THEY ARE IN IT. PYLONS CAN BE SHOT DOWN.`;
    case 'windwall': return `RAISES A WALL OF WIND BETWEEN ITSELF AND THE ENEMY FOR ${f.t}S. EVERY SHOT THE ENEMY FIRES INTO IT IS BLOWN AWAY.`;
    case 'gale': return `A GALE BLOWS THE ENEMY AWAY FROM IT FOR ${f.t}S. EVERY TIME THE WIND SLAMS THEM INTO A WALL THEY TAKE ${f.dmg} DAMAGE.`;
    case 'liftoff': return `LIFTS THE ENEMY HIGH INTO THE AIR, HELPLESS, FOR ${f.t}S, THEN DROPS THEM FOR ${f.dmg} DAMAGE.`;
    case 'blossoms': return `GROWS ${f.n} BLOSSOMS AROUND ITSELF. WALKING OVER ONE HEALS IT ${f.hps} HEALTH.`;
    case 'bubble': return `TRAPS THE ENEMY IN A BUBBLE FOR ${f.t}S: THEY CANNOT MOVE OR ATTACK, AND THE BUBBLE DRIFTS TOWARD IT. THEN IT POPS FOR ${f.dmg} DAMAGE.`;
    case 'tentacles': return `${f.n} TENTACLES RISE FROM THE FLOOR AROUND THE ENEMY FOR ${f.t}S. ONE THAT REACHES THEM GRABS, HOLDING THEM IN PLACE AND SQUEEZING FOR ${f.dmg} DAMAGE.`;
    case 'riptide': return `3 STRONG CURRENTS RUN ACROSS THE ARENA FOR ${f.t}S, ONE THROUGH THE ENEMY AND ONE EACH SIDE. IN ONE, THEY ARE DRAGGED SIDEWAYS AND TAKE ${f.dps} DAMAGE A SECOND.`;
    case 'counter': return `TAKES A GUARD STANCE FOR ${f.t}S. THE NEXT HIT ON IT IS BLOCKED, AND IT INSTANTLY APPEARS BEHIND THE ATTACKER AND STRIKES BACK FOR ${f.dmg} DAMAGE.`;
    case 'execute': return `LUNGES AT THE ENEMY FOR ${f.dmg} DAMAGE. IF THEY ARE BELOW 40% HEALTH, IT DEALS TRIPLE: ${f.dmg * 3}.`;
    case 'bleed': return `OPENS A DEEP WOUND ON THE ENEMY FOR ${f.t}S: THEY LOSE ${f.dps} HEALTH A SECOND, AND TWICE AS MUCH WHILE THEY ARE MOVING.`;
    case 'hunt': return `MARKS THE ENEMY AS ITS PREY FOR ${f.t}S: EVERY HIT IT LANDS ON THEM DEALS ${pct(HUNT_MUL)}% MORE, AND THEY CANNOT HIDE FROM IT.`;
    case 'overload': return `OVERLOADS: A RING GROWS AROUND IT FOR 1.2S, THEN IT EXPLODES, DEALING ${f.dmg} DAMAGE TO AN ENEMY WITHIN ${f.r}PX. GET AWAY BEFORE IT GOES.`;
    case 'balllightning': return `RELEASES A BALL OF LIGHTNING THAT DRIFTS AFTER THE ENEMY FOR ${f.t}S, ZAPPING THEM FOR ${f.dmg} DAMAGE EVERY 0.6S WHILE THEY ARE WITHIN 70PX OF IT.`;
    case 'rot': return `ROTS THE ENEMY FROM WITHIN FOR ${f.t}S: EVERY SECOND THEY LOSE 5% OF THE HEALTH THEY HAVE LEFT, AND ALL HEALING ON THEM IS HALVED.`;
    case 'miasma': return `RELEASES A POISON CLOUD THAT SPREADS OUT FROM IT FOR ${f.t}S, GROWING UP TO 70PX WIDE. AN ENEMY INSIDE IT TAKES ${f.dps} DAMAGE A SECOND.`;
    case 'carrionmark': return `MARKS THE ENEMY FOR ${f.t}S. IF THEIR HEALTH DROPS BELOW 35% WHILE MARKED, IT SWOOPS DOWN ON THEM FOR ${f.dmg * 2} DAMAGE. IF NOT, THE MARK FADES WITH A PECK OF ${Math.round(f.dmg / 2)}.`;
    case 'radiance': return `GLOWS OUT IN ${f.n} PULSES OF LIGHT, ONE EVERY 0.6S. EACH ONE HEALS IT ${f.hps} HEALTH AND DEALS ${f.dmg} DAMAGE TO AN ENEMY WITHIN 50PX.`;
    case 'prismfan': return `FANS OUT ${f.n} PRISMS AROUND ITSELF, AND EACH FIRES A BEAM THAT CONVERGES ON THE ENEMY, ONE AFTER ANOTHER. EACH BEAM THAT HITS DEALS ${f.dmg} DAMAGE.`;
    case 'steal': return `STEALS FROM THE ENEMY: ${f.dmg} DAMAGE, AND EVERY BOOST THEY HAVE (SHIELD, GUARD, POWER-UP, SPEED) IS TAKEN OFF THEM AND GIVEN TO IT.`;
    case 'leash': return `TIES THE ENEMY TO IT WITH A LEASH FOR ${f.t}S. IF THEY GET MORE THAN 50PX AWAY, THE LEASH YANKS THEM BACK FOR ${f.dmg} DAMAGE.`;
    case 'confuse': return `SCRAMBLES THE ENEMY FOR ${f.t}S: THEIR MOVEMENT IS FLIPPED, LEFT FOR RIGHT AND UP FOR DOWN.`;
    case 'firewall': return `RAISES A WALL OF FIRE BETWEEN ITSELF AND THE ENEMY FOR ${f.t}S. IT BLOCKS THE ENEMY AND THEIR SHOTS, AND THE GROUND ALONG IT BURNS ANYONE WHO STANDS THERE.`;
    case 'nightmare': return `A SHADOW OF THE ENEMY TEARS LOOSE AND HUNTS THEM FOR ${f.t}S, CLAWING FOR ${f.dmg} DAMAGE WHENEVER IT CATCHES THEM.`;
    case 'net': return `THROWS A WIDE NET AT THE ENEMY. IF IT CATCHES THEM IT DEALS ${f.dmg} DAMAGE AND HOLDS THEM TANGLED IN PLACE FOR ${f.t}S.`;
    case 'trapdoll': return `LEAVES A DOLL OF ITSELF THAT WALKS AT THE ENEMY. WHEN IT REACHES THEM IT BLOWS UP FOR ${f.dmg} DAMAGE. IT CAN BE SHOT DOWN FIRST.`;
    case 'duel': return `CALLS A DUEL: A RING OF WALLS CLOSES AROUND THEM BOTH FOR ${f.t}S, AND WHILE IT STANDS EVERY HIT IT LANDS DEALS ${pct(DUEL_MUL)}% MORE.`;
    case 'banish': return `BANISHES THE ENEMY OUT OF THE FIGHT FOR ${f.t}S: THEY VANISH, CANNOT ACT OR BE HIT, WHILE IT HEALS ${BANISH_HEAL} HEALTH A SECOND. THEY COME BACK WHERE THEY LEFT.`;
    case 'snowball': return `ROLLS A SNOWBALL STRAIGHT AT THE ENEMY THAT GROWS AS IT GOES. IT DEALS ${f.dmg} DAMAGE, UP TO ${f.dmg * 2} IF IT HAS ROLLED A LONG WAY, AND KNOCKS THEM BACK.`;
  }
}

/** How close the AI waits to be before firing, by the signature. */
const RANGE: Partial<Record<K, number>> = {
  charge: 100, blink: 200, multiblink: 200, leap: 150, nova: 40, shockwaves: 70, pull: 100, swap: 200, barrage: 150, volley: 180,
  spiral: 60, ring: 70, homing: 200, beam: 210, sweep: 170, cross: 70, chain: 220, meteor: 220, quakeline: 150, spikes: 220,
  minefield: 200, zone: 200, trail: 120, drain: 120, blackhole: 200, tornado: 220, bouncer: 220, orbit: 50, pack: 220, turret: 220,
  totem: 999, bombers: 220, crows: 220, spiders: 220, clones: 120, prison: 220, stun: 75, slowfield: 75, rootfield: 65, blind: 130,
  silence: 220, weaken: 200, shred: 200, shield: 60, invuln: 50, reflect: 140, thorns: 50, heal: 999, regen: 999, rage: 70,
  haste: 150, lifesteal: 60, giant: 60, stealth: 120, reset: 999, cleanse: 999,
  geyser: 220, tidalwave: 999, iceblock: 220, icicles: 999, avalanche: 999, blizzard: 999, absorb: 200, laserfence: 220, staticfield: 45,
  railgun: 260, boomerang: 180, firebreath: 80, fireworks: 220, phoenix: 999, solarflare: 999, lighthouse: 60, mirrorimage: 200,
  echo: 100, timewarp: 999, timestop: 220, doom: 999, soullink: 120, fear: 120, polymorph: 220, shrink: 220, quicksand: 220,
  bunker: 120, stoneskin: 120, earthquake: 999, rockthrow: 200, pylons: 220, windwall: 220, gale: 120, liftoff: 220, blossoms: 999,
  bubble: 220, tentacles: 220, riptide: 999, counter: 80, execute: 200, bleed: 200, hunt: 200, overload: 45, balllightning: 220,
  rot: 220, miasma: 50, carrionmark: 220, radiance: 50, prismfan: 220, steal: 220, leash: 120, confuse: 220, firewall: 220,
  nightmare: 220, net: 160, trapdoll: 200, duel: 80, banish: 220, snowball: 220,
};

/**
 * WHAT EACH EFFECT IS WORTH, in health: damage that can be expected to
 * land, health it gives back, hits it stops, or time the enemy cannot hit.
 */
function worth(f: UltFx, hp: number): number {
  switch (f.k) {
    case 'charge': case 'blink': case 'beam': return f.dmg;
    case 'multiblink': return f.n * f.dmg * 0.9;
    case 'leap': return f.dmg * 0.85;
    case 'nova': return f.dmg * 0.9;
    case 'shockwaves': return f.n * f.dmg * 0.5;
    case 'pull': return f.dmg * 1.1;
    case 'swap': return f.dmg + 6;
    case 'barrage': return f.n * f.dmg * 0.5;
    case 'volley': return f.n * f.dmg * 0.55;
    case 'spiral': return f.n * f.dmg * 0.15; // flung all round: few find them
    case 'ring': return f.dmg * 1.6;
    case 'homing': return f.n * f.dmg * 0.65;
    case 'sweep': return f.dmg * 0.85;
    case 'cross': return f.dmg * 0.9;
    case 'chain': return f.n * f.dmg * 0.9;
    case 'meteor': return f.n * f.dmg * 0.6;
    case 'quakeline': return f.dmg * 1.6;
    case 'spikes': return f.dmg * 0.8 + f.t * ENEMY_DPS * 0.4;
    case 'minefield': return f.n * f.dmg * 0.3;
    case 'zone': return f.n * f.r * 0.2;
    case 'trail': return f.t * 5;
    case 'drain': return 2 * f.t * f.dps * 0.8;
    case 'blackhole': return f.t * f.dps * 0.7 + f.t * 3;
    case 'tornado': return f.t * f.dps * 0.6 + f.t * 1.5;
    case 'bouncer': return f.t * f.dmg * 0.6;
    case 'orbit': return f.t * f.dmg * 0.5 * Math.min(2, f.n / 2);
    case 'pack': return f.n * f.dmg * 3.2;
    case 'turret': return f.t * f.dmg * 0.7;
    case 'totem': return f.t * f.hps * 0.7;
    case 'bombers': return f.n * f.dmg * 0.6;
    case 'crows': return f.n * f.dmg * 3;
    case 'spiders': return f.n * 4;
    case 'clones': return f.n * 6 * 0.7;
    case 'prison': return f.t * 8;
    case 'stun': return f.t * ENEMY_DPS * 1.6;
    case 'slowfield': return f.t * 4;
    case 'rootfield': return f.t * ENEMY_DPS * 0.6;
    case 'blind': return f.t * 6;
    case 'silence': return f.t * ENEMY_DPS * 0.5;
    case 'weaken': return f.t * ENEMY_DPS * 0.3;
    case 'shred': return f.t * 3.5;
    case 'shield': return f.t * ENEMY_DPS * 0.9;
    case 'invuln': return f.t * ENEMY_DPS;
    case 'reflect': return f.t * ENEMY_DPS * 1.1;
    case 'thorns': return f.t * ENEMY_DPS * 0.9 + f.t * 3;
    case 'heal': return f.frac * hp;
    case 'regen': return f.t * f.hps;
    case 'rage': return f.t * 4.5;
    case 'haste': return f.t * 3;
    case 'lifesteal': return f.t * ENEMY_DPS * 0.5;
    case 'giant': return f.t * ENEMY_DPS * 0.3 + f.t * 2;
    case 'stealth': return f.t * ENEMY_DPS * 0.6;
    case 'reset': return 15;
    case 'cleanse': return 5;
    case 'geyser': return f.n * f.dmg * 0.55 + f.n * 2;
    case 'tidalwave': return f.dmg * 0.9 + 4;
    case 'iceblock': return f.t * ENEMY_DPS * 1.6 + 6;
    case 'icicles': return f.dmg * 1.3;
    case 'avalanche': return f.dmg * 1.2;
    case 'blizzard': return f.t * f.dps * 0.9 + f.t * 2;
    case 'absorb': return f.t * ENEMY_DPS * 0.6 + f.dmg * 1.5;
    case 'laserfence': return f.t * f.dps * 0.5;
    case 'staticfield': return f.t * f.dps * 0.6;
    case 'railgun': return f.dmg * 0.8;
    case 'boomerang': return f.dmg * 1.3;
    case 'firebreath': return (f.t / 0.15) * f.dmg * 0.4;
    case 'fireworks': return f.n * f.dmg * 0.7;
    case 'phoenix': return f.frac * hp * 0.5;
    case 'solarflare': return f.t * 6 + f.dmg + f.t * 2;
    case 'lighthouse': return f.t * f.dmg * 0.8;
    case 'mirrorimage': return f.n * f.dmg * 2.5;
    case 'echo': return f.t * ENEMY_DPS * 0.6;
    case 'timewarp': return 18;
    case 'timestop': return f.t * ENEMY_DPS * 1.8;
    case 'doom': return f.dmg * 0.9;
    case 'soullink': return f.t * ENEMY_DPS * 0.6;
    case 'fear': return f.t * ENEMY_DPS * 1.1;
    case 'polymorph': return f.t * ENEMY_DPS * 1.2;
    case 'shrink': return f.t * ENEMY_DPS * 0.45;
    case 'quicksand': return f.t * f.dps * 0.5 + f.t * 3;
    case 'bunker': return f.t * ENEMY_DPS * 0.6;
    case 'stoneskin': return f.amt * 0.9;
    case 'earthquake': return (f.t / 0.6) * (f.dmg + 0.15 * ENEMY_DPS);
    case 'rockthrow': return f.dmg * 1.2;
    case 'pylons': return f.n * f.t * f.dmg * 0.3;
    case 'windwall': return f.t * ENEMY_DPS * 0.6;
    case 'gale': return f.t * f.dmg * 0.4 + f.t * 3;
    case 'liftoff': return f.t * ENEMY_DPS * 1.5 + f.dmg;
    case 'blossoms': return f.n * f.hps * 0.7;
    case 'bubble': return f.t * ENEMY_DPS * 1.4 + f.dmg;
    case 'tentacles': return f.n * f.t * f.dmg * 0.25;
    case 'riptide': return f.t * f.dps * 0.6 + f.t * 2;
    case 'counter': return f.dmg * 0.8 + 8;
    case 'execute': return f.dmg * 1.6;
    case 'bleed': return f.t * f.dps * 1.2;
    case 'hunt': return f.t * ENEMY_DPS * 0.4 + f.t * 2;
    case 'overload': return f.dmg * 0.75;
    case 'balllightning': return (f.t / 0.6) * f.dmg * 0.6;
    case 'rot': return f.t * 6;
    case 'miasma': return f.t * f.dps * 0.5;
    case 'carrionmark': return f.dmg * 1.4;
    case 'radiance': return f.n * (f.dmg * 0.7 + f.hps);
    case 'prismfan': return f.n * f.dmg * 0.8;
    case 'steal': return f.dmg + 12;
    case 'leash': return f.t * ENEMY_DPS * 0.5 + f.dmg * 2;
    case 'confuse': return f.t * ENEMY_DPS * 0.9;
    case 'firewall': return f.t * 5;
    case 'nightmare': return (f.t / 0.6) * f.dmg * 0.5;
    case 'net': return f.dmg + f.t * ENEMY_DPS * 0.8;
    case 'trapdoll': return f.dmg * 0.8;
    case 'duel': return f.t * ENEMY_DPS * 0.6;
    case 'banish': return f.t * ENEMY_DPS * 0.9 + f.t * BANISH_HEAL;
    case 'snowball': return f.dmg * 1.1;
  }
}
const lim = (v: number, lo: number, hi: number, step: number): number => Number((Math.round(Math.min(hi, Math.max(lo, v)) / step) * step).toFixed(2));
/** The same effect, k times as strong, within its limits (counts stay as designed). */
function scaled(f: UltFx, k: number): UltFx {
  switch (f.k) {
    case 'charge': case 'blink': case 'nova': case 'pull': case 'beam': case 'leap': case 'sweep': case 'cross': case 'swap':
      return { ...f, dmg: lim(f.dmg * k, 3, 70, 1) };
    case 'multiblink': case 'barrage': case 'volley': case 'spiral': case 'ring': case 'homing': case 'chain': case 'meteor':
    case 'quakeline': case 'minefield': case 'shockwaves': case 'bombers': case 'bouncer': case 'orbit': case 'turret':
      return { ...f, dmg: lim(f.dmg * k, 2, 40, 1) };
    case 'pack': case 'crows': return { ...f, dmg: lim(f.dmg * k, 1, 12, 1) };
    case 'spikes': return { ...f, dmg: lim(f.dmg * k, 3, 60, 1) };
    case 'drain': case 'blackhole': case 'tornado': return { ...f, dps: lim(f.dps * k, 2, 24, 1) };
    case 'totem': case 'regen': return { ...f, hps: lim(f.hps * k, 1, 14, 1) };
    case 'zone': return { ...f, r: lim(f.r * k, 8, 26, 0.5) };
    case 'heal': return { ...f, frac: lim(f.frac * k, 0.05, 0.45, 0.01) };
    case 'shield': return { ...f, t: lim(f.t * k, 0.8, 4.5, 0.1) };
    case 'invuln': return { ...f, t: lim(f.t * k, 0.5, 3, 0.1) };
    case 'reflect': case 'thorns': return { ...f, t: lim(f.t * k, 0.8, 4.5, 0.1) };
    case 'stun': return { ...f, t: lim(f.t * k, 0.4, 1.8, 0.1) };
    case 'rootfield': return { ...f, t: lim(f.t * k, 0.5, 2.5, 0.1) };
    case 'prison': return { ...f, t: lim(f.t * k, 1.5, 5, 0.1) };
    case 'slowfield': case 'blind': case 'weaken': case 'shred': case 'silence': return { ...f, t: lim(f.t * k, 1, 7, 0.1) };
    case 'haste': case 'rage': case 'trail': case 'lifesteal': case 'giant': return { ...f, t: lim(f.t * k, 1.5, 10, 0.1) };
    case 'stealth': return { ...f, t: lim(f.t * k, 1, 4, 0.1) };
    case 'spiders': case 'clones': return { ...f, n: lim(f.n * k, 2, 8, 1) };
    case 'reset': case 'cleanse': case 'timewarp': return f;
    case 'tidalwave': case 'avalanche': case 'railgun': case 'boomerang': case 'doom': case 'rockthrow': case 'execute':
    case 'carrionmark': case 'steal': case 'trapdoll': case 'snowball': case 'overload':
      return { ...f, dmg: lim(f.dmg * k, 3, 90, 1) };
    case 'geyser': case 'icicles': case 'fireworks': case 'solarflare': case 'lighthouse': case 'mirrorimage': case 'earthquake':
    case 'pylons': case 'gale': case 'liftoff': case 'bubble': case 'tentacles': case 'counter': case 'balllightning': case 'prismfan':
    case 'leash': case 'nightmare': case 'net': case 'firebreath':
      return { ...f, dmg: lim(f.dmg * k, 1, 60, 1) };
    case 'blizzard': case 'laserfence': case 'staticfield': case 'quicksand': case 'riptide': case 'bleed': case 'miasma':
      return { ...f, dps: lim(f.dps * k, 2, 30, 1) };
    case 'absorb': return { ...f, dmg: lim(f.dmg * k, 2, 20, 1) };
    case 'radiance': return { ...f, dmg: lim(f.dmg * k, 2, 30, 1), hps: lim(f.hps * k, 1, 20, 1) };
    case 'blossoms': return { ...f, hps: lim(f.hps * k, 2, 30, 1) };
    case 'stoneskin': return { ...f, amt: lim(f.amt * k, 10, 120, 1) };
    case 'phoenix': return { ...f, frac: lim(f.frac * k, 0.1, 0.7, 0.01) };
    case 'iceblock': case 'timestop': case 'polymorph': case 'fear': case 'banish': return { ...f, t: lim(f.t * k, 0.6, 3.5, 0.1) };
    case 'echo': case 'soullink': case 'shrink': case 'bunker': case 'windwall': case 'hunt': case 'confuse': case 'firewall':
    case 'duel': case 'rot':
      return { ...f, t: lim(f.t * k, 1.5, 9, 0.1) };
  }
}
/** Its total worth, in health. */
export function ultWorth(fx: UltFx[], hp: number): number {
  return fx.reduce((a, f) => a + worth(f, hp), 0);
}
// (40 to 56, user 4 Nov: "make them stronger ... to feel like it's actually
// doing some impact as an ultimate compared to other abilities")
const BUDGET = 56;
const BOSS_BUDGET = 84;
const FIXED: ReadonlySet<K> = new Set<K>(['reset', 'cleanse', 'timewarp']);
function balance(fx: UltFx[], boss: boolean, hp: number): UltFx[] {
  const want = boss ? BOSS_BUDGET : BUDGET;
  // the fixed parts stay as designed; the rest is scaled, a few rounds so
  // what one effect's limit refuses, the others take
  let out = fx;
  for (let round = 0; round < 10; round++) {
    const fixed = out.filter((f) => FIXED.has(f.k)).reduce((a, f) => a + worth(f, hp), 0);
    const free = ultWorth(out, hp) - fixed;
    if (free <= 0) break;
    const k = (want - fixed) / free;
    if (Math.abs(k - 1) < 0.01) break;
    out = out.map((f) => scaled(f, k));
  }
  return out;
}

let table: Map<string, Ultimate> | null = null;

/** Build every creature's and boss's ultimate, once; and check they are all their own. */
function build(): Map<string, Ultimate> {
  const out = new Map<string, Ultimate>();
  const makeups = new Map<string, string>();
  const leads = new Map<K, number>();
  const owner = new Map<K, string>();
  const clash: string[] = [];
  const all = [...CREATURES.map((c) => ({ id: c.id, hp: c.hp, boss: false })), ...BOSSES.map((b) => ({ id: b.id, hp: b.hp, boss: true }))];
  for (const { id, hp, boss } of all) {
    const spec = SPEC[id];
    if (!spec) throw new Error(`ultimates: no ultimate written for ${id}`);
    const [name, parts] = spec;
    // ---- EACH ITS OWN: no two with the same make-up, no signature on more than three
    const makeup = parts.map((p) => p.k).sort().join('+');
    if (makeups.has(makeup)) clash.push(`${id} is made like ${makeups.get(makeup)} (${makeup})`);
    makeups.set(makeup, id);
    // ---- AND NOTHING DISTINCTIVE TWICE: its signature is its own, and none
    // of its effects but the plain supports turns up in anyone else's
    if (GENERIC.has(parts[0].k)) clash.push(`${id} leads with a plain support (${parts[0].k})`);
    for (const k of new Set(parts.map((q) => q.k))) {
      if (GENERIC.has(k)) continue;
      if (leads.has(k)) clash.push(`${id} and ${owner.get(k)} both use ${k}`);
      leads.set(k, 1);
      owner.set(k, id);
    }
    const fx = balance(parts, boss, hp);
    const desc = plainWords(fx.map(words).join('. ') + '.');
    const steps = fx.map((f) => plainWords(fullWords(f)));
    out.set(id, { name, desc, steps, fx, range: RANGE[fx[0].k] ?? 150 });
  }
  if (clash.length) throw new Error(`ultimates: ${clash.join('; ')}`);
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
