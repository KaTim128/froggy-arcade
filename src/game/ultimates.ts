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
  | { k: 'cleanse' };

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

/**
 * THE TABLE: every creature's and boss's own ultimate, its signature first.
 * (The numbers here set each effect's shape and its share; the budget below
 * scales them all to the same strength.)
 */
const SPEC: Record<string, [string, UltFx[]]> = {
  // ------------------------------------------------------------------ ember
  mole: ['MAGMA ERUPTION', [spikes(16, 1), quakeline(6, 8), zone(3, 12)]],
  wisp: ['SOLAR SPIRAL', [spiral(18, 4), haste(3)]],
  slug: ['LAVA TIDE', [trail(5), slowfield(2.5, 70), regen(4, 3)]],
  scorpion: ['VENOM AMBUSH', [stealth(2), multiblink(2, 10), weaken(3)]],
  boar: ['FORGE STAMPEDE', [charge(20, 120), shockwaves(2, 8), giant(4)]],
  heron: ['PYRE SWEEP', [sweep(20, 200), blind(2)]],
  salamander: ['CINDER WHIRL', [orbit(3, 4, 4), haste(3), zone(3, 12)]],
  chick: ['PHOENIX BURST', [ring(12, 6), heal(0.15), invuln(1)]],
  camel: ['DUNE STORM', [tornado(4, 5), regen(5, 2), cleanse()]],
  flamingo: ['BLAZE DUEL', [reflect(2), volley(5, 4), lifesteal(4)]],
  // ------------------------------------------------------------------- tide
  toad: ['TOAD GULP', [pull(14, 110), bombers(2, 10)]],
  ray: ['RIPTIDE SWAP', [swap(10), shred(4), haste(3)]],
  puffer: ['NEEDLE BLOOM', [thorns(3), ring(10, 5), slowfield(2, 60)]],
  urchin: ['REEF MINEFIELD', [minefield(5, 10), rootfield(1, 60)]],
  newt: ['SPRING TOTEM', [totem(6, 4), cleanse(), shield(1.5)]],
  seahorse: ['TIDAL VOLLEY', [volley(7, 4), nova(8, 40)]],
  otter: ['OTTER BRAWL', [lifesteal(5), rage(4), charge(14, 90)]],
  octopus: ['INK MAZE', [blind(3), clones(2), stealth(1.5)]],
  shark: ['FRENZY BITE', [leap(18, 24), lifesteal(4), shred(3)]],
  lobster: ['CLAW CRUSH', [prison(2.5), cross(12, 60)]],
  // ------------------------------------------------------------------- moss
  crab: ['KELP FORTRESS', [shield(2.5), spikes(10, 0.8), regen(4, 3)]],
  sprout: ['OVERGROWTH', [rootfield(1.2, 80), zone(4, 12), totem(4, 3)]],
  stag: ['THORN PRISON', [prison(3), beam(16, 200)]],
  bear: ['IVY GIANT', [giant(5), heal(0.15), nova(12, 40)]],
  sloth: ['AGE OF MOSS', [slowfield(3, 110), regen(6, 3), shield(1.5)]],
  bee: ['HIVE SWARM', [pack(3, 3), homing(4, 3)]],
  badger: ['BURROW SLAM', [shockwaves(3, 7), rage(4), shield(1.5)]],
  caterpillar: ['LEAF STORM', [zone(5, 14), rootfield(1, 60), regen(4, 2)]],
  porcupine: ['QUILL CROSS', [cross(12, 70), rootfield(1, 50), regen(3, 3)]],
  koala: ['GUM GROVE', [heal(0.2), regen(4, 3), slowfield(2, 70)]],
  ladybug: ['SPOT SWARM', [homing(6, 4), haste(3)]],
  beaver: ['DAM BUILDER', [turret(6, 4), shield(2)]],
  // ------------------------------------------------------------------ frost
  golem: ['GLACIER WALL', [invuln(1.5), quakeline(6, 8), stun(0.8, 70)]],
  jelly: ['STASIS BLOOM', [stun(1.2, 90), drain(3, 5)]],
  ram: ['AVALANCHE', [leap(16, 26), stun(0.8, 60)]],
  penguin: ['ICE BOWLING', [bouncer(4, 8), slowfield(2, 70)]],
  yeti: ['BLIZZARD', [meteor(5, 10, 20), weaken(3), rage(3)]],
  walrus: ['TUSK QUAKE', [quakeline(7, 9), giant(4)]],
  ermine: ['WHITEOUT', [stealth(2.5), blink(16), slowfield(2, 60)]],
  moose: ['ANTLER STORM', [charge(18, 110), stun(0.8, 60), shockwaves(2, 7)]],
  narwhal: ['NARHORN LANCE', [beam(22, 240), shred(3)]],
  // ------------------------------------------------------------------- volt
  hound: ['THUNDER PACK', [pack(3, 3), haste(4)]],
  spider: ['STORM WEB', [spiders(3), rootfield(1, 60), chain(3, 5)]],
  gecko: ['CHAIN STRIKE', [chain(4, 6), haste(3)]],
  ferret: ['GRAND HEIST', [silence(3), reset(), haste(3)]],
  rhino: ['THUNDER RAMPAGE', [rage(5), charge(16, 100), invuln(1)]],
  eel: ['DEEP CURRENT', [drain(3, 6), chain(3, 5)]],
  wasp: ['STINGER STORM', [spiral(14, 4), shred(3)]],
  mouse: ['SPARK SCAMPER', [haste(5), ring(10, 5)]],
  zebra: ['ZAP STAMPEDE', [trail(4), stun(0.8, 70)]],
  lemur: ['MIRROR TRICK', [clones(3), swap(8)]],
  cricket: ['CHIRP STORM', [ring(12, 5), silence(2)]],
  // ------------------------------------------------------------------ stone
  beetle: ['BOULDER BARRAGE', [barrage(7, 5), shield(1.5)]],
  roller: ['ROCKSLIDE ROLL', [orbit(4, 4, 4), haste(3)]],
  tortoise: ['MIRROR SHELL', [reflect(3), regen(5, 3)]],
  obelisk: ['GRAVITY WELL', [blackhole(3, 5), beam(14, 200)]],
  hedgehog: ['GEODE BURST', [thorns(3), cross(10, 60)]],
  armadillo: ['RUBBLE SHELL', [shield(2.5), shockwaves(2, 7)]],
  crocodile: ['DEATH ROLL', [pull(14, 100), rootfield(1, 50), lifesteal(4)]],
  pangolin: ['SCALE BOULDER', [bouncer(4, 8), shield(1.5)]],
  goat: ['ROCKFALL', [meteor(5, 10, 20), stun(0.8, 60)]],
  // ------------------------------------------------------------------- gale
  moth: ['TEMPEST', [tornado(4, 5), blind(2)]],
  mantis: ['BLADE DANCE', [multiblink(3, 9), lifesteal(3)]],
  hare: ['GALE SPRINT', [haste(5), leap(14, 24), nova(8, 36)]],
  fox: ['KITE TRICK', [clones(2), blink(14), blind(2)]],
  falcon: ['STORM DIVE', [blink(18), volley(4, 4)]],
  dragonfly: ['SKIM STRAFE', [volley(8, 4), haste(3)]],
  parrot: ['PARROT ENCORE', [reset(), blind(2), haste(3)]],
  squirrel: ['ACORN CACHE', [minefield(5, 9), haste(3)]],
  swan: ['STORM WING', [sweep(18, 180), slowfield(2, 70)]],
  // ------------------------------------------------------------------- murk
  serpent: ['VIPER COIL', [weaken(4), drain(3, 5), stealth(1.5)]],
  bat: ['DUSK FEAST', [lifesteal(5), blind(2), haste(3)]],
  shroom: ['SPORE WORLD', [zone(5, 14), weaken(3), slowfield(2, 70)]],
  crow: ['MURDER STORM', [crows(4, 3), blind(2)]],
  lynx: ['SHADOW EXECUTION', [shred(4), blink(16), stealth(1.5)]],
  wraith: ['HAUNTING', [bombers(3, 10), slowfield(2, 70)]],
  leech: ['BLOOD FEAST', [drain(4, 6), lifesteal(4)]],
  possum: ['PLAY DEAD', [invuln(1.5), heal(0.15), stealth(1.5)]],
  raccoon: ['SHADOW HEIST', [swap(10), blind(2), silence(2)]],
  vulture: ['CARRION CIRCLE', [crows(3, 3), heal(0.12)]],
  skunk: ['STINK STORM', [weaken(4), minefield(4, 8)]],
  // ------------------------------------------------------------------- glow
  owl: ['STAR LANCE', [beam(20, 240), blind(2)]],
  centipede: ['LUMEN CHAIN', [chain(5, 5), slowfield(2, 70)]],
  angler: ['ABYSS LURE', [blackhole(3, 5), nova(12, 40)]],
  firefly: ['LANTERN WATCH', [turret(6, 4), blind(2)]],
  snail: ['STARSHELL CROSS', [cross(12, 70), invuln(1), regen(4, 3)]],
  worm: ['GLIM SEEKERS', [homing(5, 6), slowfield(2, 70)]],
  starfish: ['DAWN RENEWAL', [heal(0.2), totem(5, 3), invuln(1)]],
  axolotl: ['REGROWTH', [regen(6, 4), cleanse(), haste(3)]],
  peacock: ['PRISM FAN', [barrage(9, 4), blind(2)]],
  // ----------------------------------------------------------------- bosses
  b_lich: ['LANTERN OF SOULS', [bombers(4, 10), blackhole(3, 5), drain(3, 5), stun(0.8, 70)]],
  b_seraph: ['STARFALL', [meteor(7, 10, 20), ring(14, 5), invuln(1)]],
  b_hydra: ['HYDRA FURY', [cross(14, 120), spiral(16, 4), regen(5, 4)]],
  b_queen: ['BRASS BROOD', [spiders(4), pack(3, 4), prison(2.5)]],
  b_maw: ['DEVOURING MAW', [pull(16, 130), rootfield(1.2, 60), lifesteal(5), nova(12, 40)]],
  b_cloud: ['STORM KING', [chain(6, 6), tornado(4, 5), blind(2)]],
  b_wyrm: ['WORLD SERPENT', [spikes(16, 1), quakeline(8, 8), stealth(1.5), shockwaves(3, 7)]],
  b_kraken: ['KRAKEN DEEP', [sweep(18, 200), slowfield(2.5, 90), turret(6, 4), blind(2)]],
  b_mammoth: ['MAMMOTH QUAKE', [charge(20, 120), shockwaves(3, 8), giant(5), stun(0.8, 70)]],
  b_sphinx: ['RIDDLE OF SANDS', [silence(3), clones(3), beam(18, 220), reset()]],
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
    case 'spiders': case 'clones': case 'reset': case 'cleanse': return f;
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
const FIXED: ReadonlySet<K> = new Set<K>(['spiders', 'clones', 'reset', 'cleanse']);
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
    leads.set(parts[0].k, (leads.get(parts[0].k) ?? 0) + 1);
    if ((leads.get(parts[0].k) ?? 0) > 3) clash.push(`too many lead with ${parts[0].k}`);
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
