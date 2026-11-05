/**
 * ---- CREATURE CLASH, the fight.  Real time, top down, one on one.
 *
 *   move      WASD / arrows, or the move stick
 *   attack    desktop: KEYBOARD ONLY (user, 3 Nov) -- 1 2 3 or J K L fire
 *             that ability at once, SPACE fires the chosen one; every one
 *             aims itself at the opponent (a blink goes the way you walk).
 *             The mouse does nothing in a fight.
 *   phone     the move pad and the three attack buttons, auto-aimed too
 *
 * Two kinds of fight, and the training ground:
 *
 *   zone      one creature from the place's own pool; the stake is taken at
 *             the bell (creatureClash `startBattle`)
 *   ladder    the run's next step -- one of five creatures, then its boss --
 *             already paid for (`startLadderBattle`), and harder the higher
 *             up it is: not more health, a better fighter (see `skill`)
 *   training  a dummy, nothing at stake
 *
 * Every fight is settled exactly once (`finishBattle` / `retreat`), whatever
 * order the timers, taps and tab switches arrive in.
 */

import { cfgPct, cfgStr } from '../core/gameConfig';
import { countBack } from '../core/pause';
import { STAGES, WORLDS, lineupFoe, storyFoe, storyPrice } from '../game/creatureStory';
import { paintFloor } from '../art/arenaFloors';
import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { button, centerText, confirmDialog, forfeitLines, smallText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { drawCreature } from '../art/creatureArt';
import { plainWords, TILE_PX } from '../game/plainWords';
import { drawMelee, drawShot, meleeStyle, shotStyle, type MeleeStyle } from '../art/clashFx';
import { SPECIALS } from '../game/specials';
import { BATTLE_COST, BIOMES, ELEMENTS, LADDER_BOSS_WIN, LADDER_COST, bossById, creatureById, LADDER_LEVELS, type Attack, type Biome, type BossDef, type CoverShape, type Creature } from '../game/creatures';
import { activeOwned, finishBattle, ladderStep, nextZoneFoe, ownedCreature, startBattle, startLadderBattle, startStory } from '../game/creatureClash';
import { MAX_LEVEL, levelOf, withLevel, xpProgress } from '../game/creatureLevel';
import { BANISH_HEAL, BLIND_R, CROW_LIFE, DUEL_MUL, GIANT_TAKEN, HUNT_MUL, ICE_SHATTER, LIFESTEAL_FRAC, PACK_LIFE, ULT_COOLDOWN_S, ULT_UNLOCK_S, ultColour, ultimateOf, type Ultimate, type UltFx } from '../game/ultimates';
import { MINI_INFO, MINI_LEVEL, MINI_PRICE, abandonMini, boutOver, currentMini } from '../game/creatureMinis';
import {
  AURA_POWER, AURA_S, AURA_SPEED, CHILL_S, EVADE_CHANCE, EVADE_S, FOCUS_CRIT, FOCUS_S, FURY_MUL, FURY_S, QUICK_RATE, QUICK_S, CHILL_SPEED, DRAIN_FRAC, EXECUTE_MUL, GUARD_S, HASTE_S, HASTE_SPEED, HOLD_S, LINGER_DMG, LINGER_S, MARK_MUL, MARK_S, MEND_FRAC,
  POISON_PER_S, POISON_S, WALL_DEFAULT, WALL_SPECS, REGEN_PER_S, REGEN_S, ROOT_S, SHRED_MUL, SHRED_S, SILENCE_S, STAGGER_S, STRIKE_DMG, THORNS_DMG, WEAK_MUL, WEAK_S, attackInfo, buttonWords,
} from '../game/attackInfo';
import { abilityIconURL, drawAbilityIcon } from '../art/abilityIcons';
import { setCabinetTouch } from '../game/touchLayouts';
import { backPlate } from '../ui/plate';
import { touchControls, type KeyName } from '../ui/touchControls';
import { capLabel, codeFor, gameKeys, relabelKeys, setKeyScope } from '../core/keymap';

/** The Clash's own keys: J K L fire abilities 1 2 3 (log B6), movable in CONTROLS. */
const CLASH_KEYS = ['KeyJ', 'KeyK', 'KeyL', 'KeyI'];
// (named once, up front: the keycaps on the strip are drawn before the bell)
gameKeys('creatureclash', CLASH_KEYS);
import { isTouch } from '../core/device';

// (from 28: the line under the health bars has the band above it to itself)
const ARENA = { x: 6, y: 28, w: GAME_W - 12, h: GAME_H - 56 };
const TIME_LIMIT = 120;
/**
 * How far the scenery's cover keeps in from the fence: a lane wide enough for
 * the biggest creature to walk round the end of a ridge in plain sight.
 */
const COVER_LANE = 24;

/**
 * ---- EVERY WORLD HAS MORE THAN ONE KIND OF COVER (user, 3 Nov), and each
 * world's are its own: a picnic table and a fence in the fields, stumps and
 * toadstools in the deep wood, drifts in the pass, driftwood on the shore.
 * Each entry is a kind and how many pieces long it lies.
 */
const WORLD_EXTRAS: Record<string, Array<[CoverShape, number]>> = {
  // (no world shares a piece with another -- user, 4 Nov: "each arena should
  // have their own unique walls and barriers")
  caves: [['crystal', 1], ['stalagmite', 1], ['crystal', 2]],
  fields: [['bush', 1], ['table', 2], ['fence', 3], ['haybale', 1]],
  forests: [['stump', 1], ['log', 2], ['mushroom', 1]],
  frozen: [['snowdrift', 2], ['snowman', 1], ['snowdrift', 1]],
  swamps: [['mossylog', 2], ['bogroot', 1], ['mossylog', 1]],
  ruins: [['rubble', 1], ['urn', 1], ['rubble', 2]],
  shore: [['driftwood', 2], ['sandcastle', 1], ['coral', 1]],
  desert: [['bones', 1], ['sandstone', 1], ['bones', 2]],
  void: [['altar', 2], ['voidorb', 1], ['altar', 1]],
  volcano: [['lavarock', 1], ['charred', 1], ['lavarock', 2]],
};

/**
 * What a piece of the place takes to knock down, by what it is; missing
 * means it does not break (stone, a column, a lava crust).  A wooden fence
 * goes in a few shots, a tree takes a while.
 */
const COVER_HP: Partial<Record<CoverShape, number>> = {
  tree: 60, tuft: 12, ice: 45, reed: 18, shell: 40, cactus: 30,
  log: 40, bush: 18, table: 30, fence: 24, stump: 45, mushroom: 16, crystal: 35, snowdrift: 22, driftwood: 30, rubble: 30, urn: 14, bones: 20,
  stalagmite: 50, haybale: 22, pine: 60, snowman: 20, mossylog: 38, bogroot: 34, sandcastle: 16, coral: 28, sandstone: 55, altar: 40, voidorb: 24, charred: 26,
};
/** The bits that fly off it when it goes. */
const DEBRIS: Partial<Record<CoverShape, number[]>> = {
  tree: [0x2a5a1c, 0x4a3018], tuft: [0x6aa83a], ice: [0xbfe8f6, 0x6ab4d6], reed: [0x5a7a32, 0x8a6a2a], shell: [0xf0dcc4, 0xb08a70], cactus: [0x2f7a3a, 0xe8f0b0],
  log: [0x6a4424, 0xa07040], bush: [0x3a7a2a, 0x6aa83a], table: [0xa07040, 0x6a4424], fence: [0xc8a070, 0x6a4a2a], stump: [0x6a4424, 0xc89a60], mushroom: [0xd04040, 0xf0e8d8],
  crystal: [0x8ac8f0, 0xe8f4ff], snowdrift: [0xffffff, 0xd8ecf4], driftwood: [0xc8b090, 0x8a7458], rubble: [0xb8ae90, 0x6a6048], urn: [0xc07040, 0x7a4020], bones: [0xf0e8d0, 0xc8bca0],
  stalagmite: [0x6a625a, 0x9a9183], haybale: [0xe8c860, 0xb8902a], pine: [0x1e4a2a, 0x4a3018], snowman: [0xffffff, 0xf08a3a], mossylog: [0x5a7a2a, 0x4a3018], bogroot: [0x3a2a18, 0x5a7a32],
  sandcastle: [0xe8d090, 0xc8a860], coral: [0xff7a8a, 0xffb0a0], sandstone: [0xd8a060, 0xa87040], obelisk: [0x2a1a48, 0xb88aff], altar: [0x3a2a5a, 0xb88aff], voidorb: [0xb88aff, 0xffffff], lavarock: [0x2a1a14, 0xff6a20], charred: [0x1a1210, 0xff8a3a],
};
/** The strip a move's line runs along: under the health bars, over the arena. */
const INFO_X = 8;
const INFO_R = GAME_W - 8;
const INFO_Y = 20;
/** Seconds it holds still at each end, and how fast it scrolls between, px/s. */
const INFO_HOLD = 1.2;
const INFO_SPEED = 40;
/** How long an attack's lunge takes, wind-up to settle. */
const ATK_T = 0.28;

/** A fighter's footprint against walls and cover, before its size scales it. */
const BODY_R = 7;

interface Fighter {
  /** ULTIMATE (game/ultimates): its move, and seconds until it can be fired (locked 30, then 30 after each use). */
  ult: Ultimate | null;
  ultT: number;
  /** Where it was and how it was, a few times a second, for a rewind (ultimate). */
  hist?: Array<[number, number, number]>;
  histT?: number;
  /** Fired at least once (until then the badge reads LOCKED). */
  ultUsed?: boolean;
  c: Creature;
  x: number;
  y: number;
  hp: number;
  max: number;
  cds: [number, number, number];
  face: number;
  scale: number;
  burn: number;
  slow: number;
  stun: number;
  stunImmune: number;
  blind: number;
  shield: number;
  invuln: number;
  /** A few seconds of being faster and hitting harder. */
  aura: number;
  /** Held where you stand, by a snare or by roots. */
  root: number;
  dash: { vx: number; vy: number; t: number; dmg: number; hit: boolean; a: Attack; bounced?: boolean; back?: boolean; flee?: boolean } | null;
  /** The specials' own effects on it (see creatures `Mod`): seconds left of each. */
  poison: number;
  marked: number;
  shred: number;
  weak: number;
  chill: number;
  haste: number;
  regen: number;
  /** The next hit within this long is blocked outright. */
  guard: number;
  /** What its shield does while it is up (reflect, thorns, or nothing more). */
  shieldMod: 'reflect' | 'thorns' | null;
  /**
   * EVERYTHING ELSE THE SPECIALS DO TO IT, by name: seconds left of each
   * (counted down every frame), or, for a key starting `n_`, a count (left
   * alone).  See `cast` and `onHitSp` for what each one means.
   */
  st: Record<string, number>;
  /** Who it is tied to (a leash, a carrier), and the odd remembered place. */
  ref: { leash?: Fighter; carrier?: Fighter; retX?: number; retY?: number; chAng?: number; seenX?: number; seenY?: number; hopSlot?: number; vx?: number; vy?: number };
  kx: number;
  ky: number;
  flash: number;
  moving: boolean;
  /**
   * The body's own motion, on top of the drawing's: `atk` counts down an
   * attack's lunge (wind-up, strike, back) toward `atkX`/`atkY`; `stride`
   * is how far into the step it is, and `hurt` a flinch when it is hit.
   */
  atk: number;
  atkX: number;
  atkY: number;
  stride: number;
}

interface Shot {
  owner: Fighter;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  a: Attack;
  pierce: boolean;
  /** A snare holds whatever it catches. */
  snare?: boolean;
  /** Its age, and its flight special's own bookkeeping. */
  t: number;
  /** The heading it set out on (a weaving shot weaves about it). */
  ang: number;
  bounced?: boolean;
  back?: boolean;
  /** A shard just broken off: it cannot hit anything for this long. */
  grace?: number;
  /** Already bent once by a current ward. */
  bent?: boolean;
  /** A lobbed shot: it goes OVER the cover and bursts where it lands. */
  arc?: { sx: number; sy: number; tx: number; ty: number; t: number; dur: number; r: number };
}

interface Fx {
  kind: 'ring' | 'beam' | 'spark' | 'warn' | 'boom' | 'melee';
  /** A close-up strike: who throws it, which way, and how (see art/clashFx). */
  owner?: Fighter;
  ang?: number;
  style?: MeleeStyle;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r: number;
  t: number;
  life: number;
  col: number;
}

/**
 * A PATCH OF FLOOR somebody's move has changed, for a while: `burn` (it
 * hurts), `flow` (a river from x,y to x2,y2 that carries you), `honey`,
 * `floe` (ice: slow for them, fast for its owner), `mycel` (feeds its owner
 * while you stand on it), `rune` (drags you in), `beacon` (its owner's shots
 * pierce near it), `trail` (its owner's speed lane), `drift` (frozen
 * ground that bursts at the end), `halo` (a ring that hurts to cross).
 */
interface Pool {
  owner: Fighter;
  kind?: 'burn' | 'flow' | 'honey' | 'floe' | 'mycel' | 'rune' | 'beacon' | 'trail' | 'drift' | 'halo' | 'stink' | 'hole' | 'static' | 'fence' | 'sand' | 'miasma' | 'lane' | 'wind';
  /** A spreading cloud's full size; a current's way (+1 / -1). */
  grow?: number;
  dir?: number;
  /** A black hole's damage a second. */
  dps?: number;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r: number;
  t: number;
  tick: number;
  /** Halo: whether you were inside it last frame. */
  inside?: boolean;
}

/**
 * Something a move brought into the arena that moves on its own: drones
 * round their owner, a dust devil, crows round their target, a decoy, the
 * lich's husks, the queen's spiderlings, the sphinx's mirror copies, a lure.
 */
interface Minion {
  owner: Fighter;
  kind: 'drone' | 'devil' | 'crow' | 'decoy' | 'husk' | 'spiderling' | 'copy' | 'lure' | 'biter' | 'turret' | 'totem' | 'blade' | 'twister' | 'ball' | 'flower' | 'pylon' | 'mirror' | 'orb' | 'tentacle' | 'doll' | 'shade' | 'snowball' | 'rock' | 'glaive';
  x: number;
  y: number;
  ang: number;
  life: number;
  /** Health, for the ones you can shoot down (0: not a target). */
  hp: number;
  cd: number;
  /** A spiderling holding on to someone. */
  latched?: boolean;
  /** An ultimate's own: what each hit deals, a heal a second, and a velocity (the bouncing boulder). */
  dmg?: number;
  hps?: number;
  vx?: number;
  vy?: number;
  /** Its own clock (a glaive turning back, a snowball growing). */
  t?: number;
  size?: number;
}

/** A wave rolling outward from where it started. */
interface Wave {
  owner: Fighter;
  x: number;
  y: number;
  r: number;
  max: number;
  speed: number;
  dmg: number;
  done: boolean;
  a: Attack;
}

interface Mine {
  owner: Fighter;
  x: number;
  y: number;
  arm: number;
  life: number;
  dmg: number;
  a: Attack;
}

/**
 * A boss's mark on the floor: it is drawn from the moment it is put down,
 * and goes off when `t` runs out.  A `line` is a strip from (x, y) to
 * (x2, y2); a `ring` is a band at radius `r` (a shockwave); a `meteor` falls
 * from the sky onto a growing shadow.  `go` runs when it goes off.
 */
interface Hazard {
  kind: 'mark' | 'meteor' | 'line' | 'ring';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r: number;
  t: number;
  /** How long it was down for in all (for the telegraph's fill). */
  t0: number;
  dmg: number;
  /** A grasp holds you where it catches you. */
  holds?: boolean;
  go?: () => void;
  /** Whose it is (a boss's, unless a move of a creature's put it down). */
  owner?: Fighter;
  /** It drifts after its target at this speed (px/s) until it goes off. */
  seek?: number;
  /** The sphinx's riddle: the one true answer (an eye), or a false one (a mirror). */
  riddle?: 'true' | 'false';
}

/**
 * ---- WHAT YOU GET BEHIND.
 *
 * A barrier is a piece of the place -- a stand of trees, a ridge of rock, a
 * fallen column, a crust of cooled lava -- and it is drawn as one thing.
 * Underneath it is a few overlapping circles (`parts`), which is what the
 * walking, the shots and the line of sight actually test against, so a long
 * hedge stops you along its whole length instead of being one fat disc with
 * a tree painted on it.
 */
interface Prop {
  x: number;
  y: number;
  r: number;
  /** A piece somebody put up that shots can break: what it has left, and had. */
  hp?: number;
  maxHp?: number;
  /**
   * Whose wall this piece is.  It stops the OTHER one's body and shots;
   * its owner walks and fires straight through it (user, 3 Nov: "abilities
   * must never harm or obstruct the player's own creature").
   */
  owner?: Fighter;
}

/**
 * ---- EVERY WALL GOES AGAIN, AND EACH ONE PAYS FOR WHAT IT IS.
 *
 * Nobody gets a fortress.  A dropped wall always has a clock on it, shown
 * as a bar over it running down, and the walls trade against each other:
 * the ones that shots can tear down stand longer and come back sooner; the
 * one nothing breaks stands only a few seconds.  And they are not all the
 * same shape -- a curved screen round you, a long straight line, a post.
 */
// (the specs themselves live in game/attackInfo, so a move's card can say how long it stands)
/** A crag lob's pillar: breakable, seven seconds. */
const PILLAR = { life: 7, hp: 16 };

interface Barrier {
  kind: CoverShape;
  parts: Prop[];
  seed: number;
  /** Seconds left, for one somebody dropped mid-fight; -1 for the scenery. */
  life: number;
  /** What it started with, for the bar over it. */
  max?: number;
  /** Who put it there (their colour tints it), or null for the place itself. */
  owner: Fighter | null;
  /** It bursts as it goes (a glacier slab). */
  shatter?: boolean;
}

/**
 * ---- EACH BOSS FIGHTS THE FLOOR AS WELL AS YOU, and each one its own way
 * (`BossDef.pattern`; `n`, `r`, `every` and `dmg` are how many, how wide,
 * how often and how hard).  Every one is telegraphed -- you can always see
 * what is coming and where to be:
 *
 *   teleport   the lich: marks round you, and it blinks to wherever it can see you
 *   meteor     the seraph, and only the seraph: shadows grow, then stars land on them
 *   tribeam    the hydra: three lines of breath from its three heads
 *   webs       the queen: webs thrown round your feet -- they hold
 *   roots      the maw: roots under you and where you were going -- they hold
 *   lightning  the cloud: bolts walk across the floor straight at you
 *   burrow     the wyrm: it goes under, and comes up beside you
 *   charge     the sphinx: a line drawn at you, then a pounce down it
 *   tentacles  the kraken: arms roll across the floor in waves
 *   quake      the mammoth: it stamps, and rings run out from it
 *
 * And NONE OF THEM can be waited out behind a wall: a boss that has not
 * been able to see you for a couple of seconds comes for you (`HIDE_S`).
 */
const HIDE_S = 2.2;
/** How far a blinded fighter can still see, in px (you, on the screen; the computer, in its head). */
const BLIND_SEE = 38;

/**
 * WHAT A CAST WALL IS MADE OF (log #44): its maker's own stuff, not the
 * arena's -- an ice slab is ice wherever it is raised, a kelp weave is
 * weed, an ember wall is a smoking vent, a stone one rock.
 */
const WALL_LOOK: Record<string, CoverShape> = { kelp_weave: 'reed', glacier_slab: 'ice' };
const ELEMENT_WALL: Record<string, CoverShape> = {
  frost: 'ice', stone: 'rock', tide: 'shell', moss: 'tuft', ember: 'vent', gale: 'tuft', volt: 'pillar', murk: 'reed', glow: 'pillar',
};
export const wallLook = (sp: string | undefined, element: string): CoverShape => WALL_LOOK[sp ?? ''] ?? ELEMENT_WALL[element] ?? 'rock';

/** A simulated fight (dev only): who against whom, at what level, how sharp, how fast. */
export interface SimSpec {
  me: string;
  foe: string;
  level: number;
  skill: number;
  warp: number;
}

/** What one computer-played fighter remembers between frames. */
interface Brain {
  ai: { think: number; mx: number; my: number; strafe: number };
  dodge: { vx: number; vy: number; t: number };
  seen: WeakSet<Shot>;
  last: { x: number; y: number; stuck: number };
  /** The other fighter's smoothed velocity, to lead shots with. */
  vel: { x: number; y: number };
  prev?: { x: number; y: number };
}

export class CreatureArena extends Phaser.Scene {
  private biome!: Biome;
  private mode: 'zone' | 'ladder' | 'training' | 'story' | 'mini' = 'zone';
  private ultText: Phaser.GameObjects.BitmapText | null = null;
  /** The admin's test switch: no cooldowns on your side (read once, at the start). */
  private noCooldown = false;
  private foeUltText: Phaser.GameObjects.BitmapText | null = null;
  /** Story: which world, which of its stages, and who (drawn when the fight opens, paid at the bell). */
  private storyWorld = 0;
  private storyStage = 0;
  /** The trail node asked for, and whether this fight is a replay of one already beaten. */
  private storyNode: number | undefined;
  private storyReplay = false;
  private vsShown = false;
  /** The ladder step this is (6 = the boss). */
  private level = 0;
  private boss = false;
  /**
   * How good a fighter the opponent is, 0..1: how well it aims, leads and
   * dodges, how often it shoots, and whether it works its way round cover
   * to get a line on you.  A zone creature is middling; the ladder climbs
   * from clumsy to sharp; a boss is as good as it gets.
   */
  private skill = 0.35;
  /** How long the opponent has had no line of sight on you. */
  private hidden = 0;
  /** Your velocity, for an opponent that leads its shots. */
  private meV = { x: 0, y: 0 };
  private dodge = { vx: 0, vy: 0, t: 0 };
  private seenShots = new WeakSet<Shot>();
  private lastFoePos = { x: 0, y: 0, stuck: 0 };
  /**
   * THE BALANCE SIMULATOR (dev only, tools/clash.mjs): both sides played by
   * the computer, many steps a frame, and the result kept rather than paid.
   */
  private sim: { warp: number; result: boolean | null } | null = null;
  private simSpec: SimSpec | null = null;
  private meBrain: Brain = { ai: { think: 0, mx: 0, my: 0, strafe: 1 }, dodge: { vx: 0, vy: 0, t: 0 }, seen: new WeakSet<Shot>(), last: { x: 0, y: 0, stuck: 0 }, vel: { x: 0, y: 0 } };
  /** The opponent's brain: the same fields the AI always used. */
  private get foeBrain(): Brain {
    return { ai: this.ai, dodge: this.dodge, seen: this.seenShots, last: this.lastFoePos, vel: this.meV };
  }
  /**
   * ---- THE TRAINING GROUND.
   *
   * Nothing is staked, nothing is won, and nothing can faint: a straw dummy
   * that takes every hit, says what it took, and stands back up.  It is
   * where you find out what a move actually does before it costs you a
   * battle -- the clock is off, and QUIT never goes away.
   */
  private training = false;
  private from = 'ArcadeLounge';
  private me!: Fighter;
  private foe!: Fighter;
  private shots: Shot[] = [];
  private fx: Fx[] = [];
  private mines: Mine[] = [];
  private pools: Pool[] = [];
  private minions: Minion[] = [];
  private waves: Wave[] = [];
  /** Every shot in the air held still, for this long (prism stasis). */
  private stasis = 0;
  /** The walls closing in (cave-in), and whose they are. */
  private caveIn: { owner: Fighter; t: number; tick: number } | null = null;
  /** A boss whose head grew back breathes twice as often. */
  private patternMul = 1;
  /** The boss's second phase (under half health): faster, harder, angrier. */
  private bossRage = false;
  private hazards: Hazard[] = [];
  private props: Prop[] = [];
  private barriers: Barrier[] = [];
  private terrain!: Phaser.GameObjects.Graphics;
  private g!: Phaser.GameObjects.Graphics;
  private ui!: Phaser.GameObjects.Graphics;
  private dark!: Phaser.GameObjects.Graphics;
  /** Blindness: one dark sheet with the circle you can see cut out of it (no rings, no seams). */
  private darkRT: Phaser.GameObjects.RenderTexture | null = null;
  private holeG: Phaser.GameObjects.Graphics | null = null;
  private labels: Phaser.GameObjects.BitmapText[] = [];
  private timerText!: Phaser.GameObjects.BitmapText;
  private sel = 0;
  private over = false;
  private settled = false;
  private elapsed = 0;
  private hazardT = 3;
  private ai = { think: 0, mx: 0, my: 0, strafe: 1 };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private touch = false;
  /** h = where the stick rests; b = where this touch put it down. */
  private moveStick = { id: -1, hx: 0, hy: 0, bx: 0, by: 0, dx: 0, dy: 0 };
  private atkBtns: Array<{ x: number; y: number }> = [];
  private dialog: Phaser.GameObjects.Container | null = null;
  private paused = false;
  /**
   * A phone held upright: the controls are in the band under the picture (a
   * move pad and three labelled attack buttons that fire at the foe), and a
   * tap on the battlefield aims the chosen attack there -- nothing is drawn
   * over the fight.  Held sideways, the two sticks in the corners as before.
   */
  private band = false;
  /** The bell has gone: the stake is taken and the fight is on. */
  private started = false;
  private info!: Phaser.GameObjects.BitmapText;
  private info2!: Phaser.GameObjects.BitmapText;
  private infoPlate!: Phaser.GameObjects.Rectangle;
  private infoT = 0;
  /** How far the strip's line has to scroll to show its end, and how long it has been up. */
  private infoRun = 0;
  /** The element line, which steps aside while a move's line is in the strip. */
  private effLabel: Phaser.GameObjects.BitmapText | null = null;
  /**
   * RELOADING, AT A GLANCE.  The name on each desktop button (to grey it),
   * the seconds-left readout on each button, whether it was ready last
   * frame, and a flash when it comes back.
   */
  private nameLabels: Phaser.GameObjects.BitmapText[] = [];
  private cdTexts: Phaser.GameObjects.BitmapText[] = [];
  private wasReady = [true, true, true];
  private readyFlash = [0, 0, 0];
  /** The ladder step, on the same strip's right: it steps aside too. */
  private stepLabel: Phaser.GameObjects.BitmapText | null = null;
  /** When the strip's line went up (scene clock, ms). */
  private infoAt = 0;
  private infoMask: Phaser.Display.Masks.GeometryMask | null = null;
  /** Your creature's level, for the name over its bar. */
  private myLevel = 1;
  /** A zone foe's level (matched to yours); 0 when it has none to show. */
  private foeLevel = 0;

  constructor() {
    super('CreatureArena');
  }

  /** Back after a reload with the battle already open and paid for (core/session). */
  private resumed = false;

  init(data: { biome?: string; mode?: 'zone' | 'ladder' | 'training' | 'story' | 'mini'; from?: string; training?: boolean; resumed?: boolean; sim?: SimSpec; world?: number; node?: number }): void {
    this.storyWorld = data.world ?? 0;
    this.storyNode = typeof data.node === 'number' ? data.node : undefined;
    this.vsShown = false;
    this.resumed = data.resumed === true;
    // (dev only: tools/clash.mjs)
    this.simSpec = import.meta.env?.DEV ? data.sim ?? null : null;
    this.sim = this.simSpec ? { warp: this.simSpec.warp, result: null } : null;
    this.meBrain = { ai: { think: 0, mx: 0, my: 0, strafe: 1 }, dodge: { vx: 0, vy: 0, t: 0 }, seen: new WeakSet<Shot>(), last: { x: 0, y: 0, stuck: 0 }, vel: { x: 0, y: 0 } };
    this.biome = BIOMES.find((b) => b.id === data.biome) ?? BIOMES[0];
    this.mode = data.training ? 'training' : data.mode ?? 'zone';
    this.training = this.mode === 'training';
    this.boss = false;
    this.level = 0;
    this.skill = 0.35;
    this.hidden = 0;
    this.meV = { x: 0, y: 0 };
    this.dodge = { vx: 0, vy: 0, t: 0 };
    this.seenShots = new WeakSet<Shot>();
    this.from = data.from ?? 'ArcadeLounge';
    this.shots = [];
    this.fx = [];
    this.mines = [];
    this.pools = [];
    this.minions = [];
    this.waves = [];
    this.stasis = 0;
    this.caveIn = null;
    this.patternMul = 1;
    this.bossRage = false;
    this.hazards = [];
    this.props = [];
    this.barriers = [];
    this.labels = [];
    this.sel = 0;
    this.over = false;
    this.settled = false;
    this.elapsed = 0;
    this.hazardT = 3;
    this.dialog = null;
    this.paused = false;
    this.started = false;
    this.infoT = 0;
    this.moveStick = { id: -1, hx: 0, hy: 0, bx: 0, by: 0, dx: 0, dy: 0 };
  }

  create(): void {
    this.noCooldown = cfgStr('clash.noCooldown') === 'yes';
    // its own music (user, 1 Nov: every arcade game has its own)
    audio.setScene({ music: 'game_clash_battle', ambience: ['cabinet_bleeps'] });
    // (a fresh fight: the last one's strip mask and labels went with it)
    this.infoMask = null;
    this.effLabel = null;
    this.stepLabel = null;
    this.infoT = 0;
    this.foeLevel = 0;
    const own = activeOwned();
    const sim = this.simSpec;
    // ---- A MINI GAME: the run's own creatures, both at the mini level
    const mini = this.mode === 'mini' ? currentMini() : null;
    if (this.mode === 'mini' && (!mini || mini.done || !mini.me.length || !mini.foe.length)) {
      this.scene.start('CreatureHub', { from: this.from, screen: 'minis', msg: 'NO MINI GAME IS ON.' });
      return;
    }
    // (yours fights at its level: see creatureLevel)
    const mine = sim ? withLevel(creatureById(sim.me)!, sim.level) : mini ? withLevel(creatureById(mini.me[0])!, MINI_LEVEL) : own ? ownedCreature(own) : undefined;
    this.myLevel = sim ? sim.level : mini ? MINI_LEVEL : own ? levelOf(own.xp ?? 0) : 1;
    if (!mine) {
      this.scene.start('CreatureHub', { from: this.from, msg: 'YOU NEED A CREATURE TO FIGHT.' });
      return;
    }
    // WHO YOU ARE UP AGAINST.  A ladder fight is the run's own next step,
    // drawn when the run was paid for: the place and the opponent come from
    // it, never from here, so nothing about it can be re-rolled.
    let wild: Creature;
    if (mini) {
      wild = withLevel(creatureById(mini.foe[0])!, MINI_LEVEL);
      this.foeLevel = MINI_LEVEL;
      this.skill = 0.6;
    } else if (sim) {
      wild = withLevel(creatureById(sim.foe)!, sim.level);
      this.foeLevel = sim.level;
      this.skill = sim.skill;
    } else if (this.mode === 'story') {
      // STORY: the world's next fight.  Back from a reload, the one already
      // paid for (its foe kept with it); otherwise drawn now, paid at the bell
      const cs = store.get().creatures;
      const ob = cs.battle;
      const open = this.resumed && ob?.mode === 'story';
      const w = open ? ob!.world ?? 0 : this.storyWorld;
      // (the node picked on the world's trail; by default its next unbeaten one)
      const stage = open ? ob!.stage ?? 0 : this.storyNode ?? Math.min(STAGES, cs.story.best[w] ?? 0);
      this.storyReplay = open ? ob!.replay === true : stage < (cs.story.best[w] ?? 0);
      const foeId = open ? ob!.foe ?? '' : stage >= STAGES ? WORLDS[w].boss : lineupFoe(w, stage);
      const sf = storyFoe(w, stage, foeId);
      if (!sf) {
        this.scene.start('CreatureHub', { from: this.from, screen: 'story', msg: 'NO SUCH FIGHT.' });
        return;
      }
      this.storyWorld = w;
      this.storyStage = stage;
      this.biome = BIOMES.find((b) => b.id === WORLDS[w].biome) ?? this.biome;
      wild = sf.foe;
      this.boss = sf.boss;
      this.skill = sf.skill;
      this.foeLevel = sf.level;
    } else if (this.mode === 'ladder') {
      const step = ladderStep();
      if (!step) {
        this.scene.start('CreatureHub', { from: this.from, screen: 'ladder', msg: 'NO LADDER RUN IS ON.' });
        return;
      }
      this.biome = BIOMES.find((b) => b.id === step.biome) ?? this.biome;
      this.level = step.level;
      this.boss = step.boss;
      wild = step.foe;
      this.skill = step.boss ? 1 : 0.3 + ((step.level - 1) / (LADDER_LEVELS - 1)) * 0.6;
    } else {
      // a zone's wild one is matched to yours: your level, give or take one
      // (log B6: zone opponents matched to the player's level)
      const lv = Phaser.Math.Clamp(this.myLevel + Phaser.Math.Between(-1, 1), 1, MAX_LEVEL);
      wild = withLevel(nextZoneFoe(this.biome), lv);
      this.foeLevel = lv;
    }
    // THE ADMIN'S TEST ZONE (core/gameConfig): the opponent or boss asked
    // for, at the level the fight would have had (never in a ladder run,
    // whose steps were drawn and paid for)
    if (!sim && this.mode !== 'ladder' && this.mode !== 'mini') {
      const lv = this.foeLevel || this.myLevel;
      const wantBoss = cfgStr('clash.boss');
      const wantFoe = cfgStr('clash.foe');
      if (this.boss && wantBoss !== 'none' && bossById(wantBoss)) wild = { ...withLevel(bossById(wantBoss)!, lv), name: wild.name };
      else if (!this.boss && wantFoe !== 'none' && creatureById(wantFoe)) wild = withLevel(creatureById(wantFoe)!, lv);
    }
    // the admin's stat settings: yours and theirs, as percentages (100 = as designed)
    const scaled = (c: Creature, side: 'my' | 'foe'): Creature => {
      const hp = cfgPct(`clash.${side}Hp`);
      const dmg = cfgPct(`clash.${side}Dmg`);
      const spd = cfgPct(`clash.${side}Speed`);
      if (hp === 1 && dmg === 1 && spd === 1) return c;
      return {
        ...c,
        hp: Math.max(1, Math.round(c.hp * hp)),
        speed: Math.max(1, Math.round(c.speed * spd)),
        attacks: c.attacks.map((a) => ({ ...a, dmg: a.dmg > 0 ? Math.max(1, Math.round(a.dmg * dmg)) : 0 })) as Creature['attacks'],
      };
    };
    // (a copy: the roster's own entry is never renamed)
    const foeC = scaled(this.training ? { ...wild, name: 'TRAINING DUMMY' } : wild, 'foe');
    this.me = this.fighter(scaled(mine, 'my'), ARENA.x + 40, ARENA.y + ARENA.h / 2, 1, 1);
    // (a boss is bigger, not huge: it has to fit the arena and be fair to hit)
    this.foe = this.fighter(foeC, ARENA.x + ARENA.w - 40, ARENA.y + ARENA.h / 2, -1, this.boss ? 1.35 : 1);
    this.lastFoePos = { x: this.foe.x, y: this.foe.y, stuck: 0 };
    // (3v3: whoever won the last bout walks in with the health it had)
    if (mini?.myHp !== undefined) this.me.hp = Math.max(1, Math.min(this.me.max, mini.myHp));
    if (mini?.foeHp !== undefined) this.foe.hp = Math.max(1, Math.min(this.foe.max, mini.foeHp));
    // (user, 5 Nov) ...and its cooldowns and ultimate exactly where they were
    if (mini?.myCds) this.me.cds = [...mini.myCds];
    if (mini?.foeCds) this.foe.cds = [...mini.foeCds];
    if (mini?.myUlt !== undefined) this.me.ultT = mini.myUlt;
    if (mini?.foeUlt !== undefined) this.foe.ultT = mini.foeUlt;

    this.paintGround();
    this.g = this.add.graphics().setDepth(10);
    this.dark = this.add.graphics().setDepth(40);
    this.darkRT = this.add.renderTexture(0, 0, GAME_W, GAME_H).setOrigin(0, 0).setDepth(40).setVisible(false);
    this.holeG = this.make.graphics({}, false);
    this.ui = this.add.graphics().setDepth(50);
    // (before the hud: it lays the buttons out for whichever this is)
    // (the game's own answer -- a coarse pointer and no fine one -- not
    // Phaser's "has a touch screen", which a touchscreen laptop also has:
    // on a desktop the sticks never appear)
    const touchDevice = isTouch();
    // ON A PHONE, ALWAYS THE SHARED CONTROLS, NEVER STICKS DRAWN ON THE
    // ARENA (user, 28 Oct: "buttons not in the arena view"): under the
    // picture upright, in the black columns either side of it sideways
    this.band = touchDevice;
    this.touch = false;
    this.paintHud();
    this.applyBand();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setCabinetTouch(null));
    // TURN THE PHONE AND THE CONTROLS GO WITH IT.  Upright, they are in the
    // black band under the picture; sideways, the two sticks in its corners.
    // It used to be decided once, at the bell, so a fight started sideways
    // and then turned upright kept its sticks over the picture with a band
    // of empty black underneath.
    if (touchDevice) {
      const onResize = (): void => {
        const band = true;
        if (band === this.band) return;
        this.band = band;
        this.touch = !band;
        Object.assign(this.moveStick, { id: -1, dx: 0, dy: 0 });
        this.layAtkBtns();
        this.applyBand();
      };
      window.addEventListener('resize', onResize);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('resize', onResize));
    }
    // the band's attack buttons: pick that attack and let it go at the foe
    this.input.keyboard!.on('keydown-FOUR', () => this.quickFire(0));
    this.input.keyboard!.on('keydown-FIVE', () => this.quickFire(1));
    this.input.keyboard!.on('keydown-SIX', () => this.quickFire(2));
    // what the chosen attack does, along the bottom of the arena for a moment
    this.infoPlate = this.add.rectangle(GAME_W / 2, ARENA.y + ARENA.h - 10, GAME_W - 24, 19, PALETTE.ink, 0.92).setStrokeStyle(1, PALETTE.steel).setDepth(55).setVisible(false);
    this.info = centerText(this, GAME_W / 2, ARENA.y + ARENA.h - 15, '', PALETTE.gold).setDepth(56).setVisible(false);
    this.info2 = centerText(this, GAME_W / 2, ARENA.y + ARENA.h - 6, '', PALETTE.cream).setCenterAlign().setLineSpacing(1).setDepth(56).setVisible(false);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE') as Record<string, Phaser.Input.Keyboard.Key>;
    // J K L (B6): each ability, at once, at the other one -- the Clash's own
    // keys, moved in CONTROLS like any other game's (core/keymap)
    setKeyScope('creatureclash');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setKeyScope(null));
    this.input.keyboard!.on('keydown-J', () => this.quickFire(0));
    this.input.keyboard!.on('keydown-K', () => this.quickFire(1));
    this.input.keyboard!.on('keydown-L', () => this.quickFire(2));
    // 1 2 3: that ability, now, at the mouse (on a phone, just the choice)
    this.input.keyboard!.on('keydown-ONE', () => this.keyFire(0));
    this.input.keyboard!.on('keydown-TWO', () => this.keyFire(1));
    this.input.keyboard!.on('keydown-THREE', () => this.keyFire(2));
    // SPACE: the chosen ability, auto-aimed
    this.input.keyboard!.on('keydown-SPACE', () => this.quickFire(this.sel));
    // I: the ULTIMATE, once it is up (user, 5 Nov: I, not Q -- over J K L)
    this.input.keyboard!.on('keydown-I', () => this.useUlt(this.me));
    this.input.addPointer(2);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.down(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.moveP(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.up(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.up(p));
    (window as unknown as { __clash?: unknown }).__clash = this;
    this.cameras.main.fadeIn(250, 0, 0, 0);
    // nothing moves until the count is done; the stake goes at the bell
    this.paused = true;
    if (this.sim) {
      // the simulator: no count, no bell, no stake -- straight in
      this.paused = false;
      this.started = true;
      (window as unknown as { __clashSim?: unknown }).__clashSim = this.sim;
      return;
    }
    this.countdown();
  }

  /**
   * 3, 2, 1 -- big, in the middle of the arena, each one popping in and
   * fading -- and then the bell.  Nothing is said about what you are up
   * against: you find out by fighting it.  (QUIT during the count goes back
   * to the menu, and nothing has been spent.)
   */
  private countdown(): void {
    // a story fight opens on its VS card first
    if (this.mode === 'story' && !this.vsShown) {
      this.vsShown = true;
      this.vsCard(() => this.countdown());
      return;
    }
    const cx = ARENA.x + ARENA.w / 2;
    const cy = ARENA.y + ARENA.h / 2;
    const ready = centerText(this, cx, cy - 26, 'GET READY', PALETTE.cream).setDepth(2400);
    backPlate(this, ready);
    const step = (n: number): void => {
      if (this.over || !this.scene.isActive()) return;
      if (n === 0) {
        ready.destroy();
        this.begin();
        return;
      }
      audio.sfx('ui_blip', 0.7);
      const t = centerText(this, cx, cy, String(n), n === 1 ? PALETTE.gold : PALETTE.cream, 32).setDepth(2401);
      const ring = this.add.circle(cx, cy, 14).setStrokeStyle(2, n === 1 ? PALETTE.gold : PALETTE.neon).setDepth(2400);
      t.setScale(1.6).setAlpha(0);
      this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 180, ease: 'Back.Out' });
      this.tweens.add({ targets: t, alpha: 0, delay: 560, duration: 200, onComplete: () => t.destroy() });
      this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 760, ease: 'Quad.Out', onComplete: () => ring.destroy() });
      this.time.delayedCall(800, () => step(n - 1));
    };
    this.time.delayedCall(350, () => step(3));
  }

  /**
   * THE VS CARD (B7: before each story battle).  The world's name, then the
   * two of them sliding in from either side with their names and levels,
   * VS between them, held a moment and swept away.
   */
  private vsCard(then: () => void): void {
    const box = this.add.container(0, 0).setDepth(2450);
    const Y = ARENA.y + ARENA.h / 2;
    box.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05040a, 0.82).setOrigin(0, 0));
    box.add(this.add.rectangle(0, Y - 30, GAME_W, 60, 0x1a1430, 1).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold));
    const world = WORLDS[this.storyWorld];
    box.add(centerText(this, GAME_W / 2, Y - 42, world.name, PALETTE.gold));
    const side = (f: Fighter, lv: number, left: boolean): void => {
      const x = left ? 70 : GAME_W - 70;
      // (the picture slides in; the name fades in where it stays -- text
      // started off the screen would be pulled back onto it, off its place)
      const g = this.add.graphics();
      drawCreature(g, f.c, x, Y - 4, 2.2 * (f === this.foe && this.boss ? 1.2 : 1), left ? 1 : -1, 0);
      g.x = left ? -120 : 120;
      box.add(g);
      this.tweens.add({ targets: g, x: 0, duration: 380, ease: 'Back.Out' });
      const nm = centerText(this, x, Y + 18, f.c.name.toUpperCase(), left ? PALETTE.cream : this.boss ? PALETTE.gold : PALETTE.cream).setAlpha(0);
      const lvT = centerText(this, x, Y + 27, `LV ${lv}`, PALETTE.ash).setAlpha(0);
      box.add([nm, lvT]);
      this.tweens.add({ targets: [nm, lvT], alpha: 1, delay: 250, duration: 250 });
    };
    side(this.me, this.myLevel, true);
    side(this.foe, this.foeLevel, false);
    const vs = centerText(this, GAME_W / 2, Y - 2, 'VS', 0xff5a6a, 24).setScale(0.2).setAlpha(0);
    box.add(vs);
    this.tweens.add({ targets: vs, scale: 1, alpha: 1, delay: 300, duration: 260, ease: 'Back.Out' });
    audio.sfx('throw_whoosh', 0.5);
    this.time.delayedCall(620, () => audio.sfx(this.boss ? 'bell_ding' : 'ui_blip', 0.6));
    this.time.delayedCall(1900, () => {
      this.tweens.add({ targets: box, alpha: 0, duration: 260, onComplete: () => (box.destroy(true), then()) });
    });
  }

  /** The count is done: the stake, the bell, and go. */
  private begin(): void {
    // (a reload into a battle already paid for: the bell, and no second stake)
    const open = this.resumed && !!store.get().creatures.battle;
    this.resumed = false;
    // (a mini game was paid for when it was picked: nothing more at the bell)
    if (!this.training && !open && this.mode !== 'mini') {
      const r = this.mode === 'ladder' ? startLadderBattle() : this.mode === 'story' ? startStory(this.storyWorld, this.storyStage) : startBattle(this.biome.id, this.foe.c.id);
      if (!r.ok) {
        this.scene.start('CreatureHub', { from: this.from, screen: this.mode === 'ladder' ? 'ladder' : this.mode === 'story' ? 'trail' : 'map', msg: r.msg });
        return;
      }
      // its own cry, at the bell
      audio.sfx(this.foe.c.cry, 0.5);
    }
    this.dialog?.destroy();
    this.dialog = null;
    this.started = true;
    this.paused = false;
    // a boss announces itself at the bell
    if (this.boss) this.time.delayedCall(150, () => this.bossRoar(false));
    audio.sfx('bell_ding', 0.6);
    const go = centerText(this, ARENA.x + ARENA.w / 2, ARENA.y + ARENA.h / 2, 'FIGHT!', PALETTE.gold, 24).setDepth(2401);
    this.tweens.add({ targets: go, scale: 1.4, alpha: 0, delay: 250, duration: 450, onComplete: () => go.destroy() });
    this.showInfo(this.sel);
    if (this.training) {
      // (under the move's description when that is up at the top, on a phone held sideways)
      const t = centerText(this, ARENA.x + ARENA.w / 2, this.touch ? ARENA.y + 50 : ARENA.y + 24, 'TRAINING MODE DOES NOT AWARD TOKENS.', PALETTE.fog).setDepth(2401);
      backPlate(this, t);
      this.time.delayedCall(3500, () => this.tweens.add({ targets: t, alpha: 0, duration: 500, onComplete: () => t.destroy() }));
    }
  }

  /**
   * A number key on a desktop: choose that ability and let it go where the
   * mouse is pointing.  Before the bell (or on a phone) it only chooses.
   */
  private keyFire(i: number): void {
    this.choose(i);
    if (this.touch || this.band || this.over || this.paused || !this.started || this.dialog) return;
    // auto-aimed, never the mouse: the fight is played on the keyboard
    this.quickFire(i);
  }

  /** A band button: that attack, now, at the foe (a blink goes the way you are walking). */
  private quickFire(i: number): void {
    if (this.over || this.paused || !this.started || this.dialog) return;
    this.choose(i);
    const a = this.me.c.attacks[i];
    const k = this.keys;
    const mx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const my = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (a.kind === 'blink' && (mx || my)) this.fire(this.me, i, mx, my);
    else {
      const at = this.aimAt();
      this.fire(this.me, i, at.x - this.me.x, at.y - this.me.y);
    }
  }

  /** What the chosen attack does, in one place, for a few seconds. */
  private showInfo(i: number): void {
    const a = this.me.c.attacks[i];
    if (!a || !this.info) return;
    const inf = attackInfo(a, this.me.c.element);
    // ---- IT NEVER COVERS THE FIGHT.  What the move does goes in the strip
    // between the health bars and the arena -- where the element line is,
    // which steps aside for it -- as one line: the name and numbers, then
    // the description.  Too long for the strip, it holds a moment and then
    // scrolls along it, so all of it is read and none of it is over the
    // arena, the fighters or the thumbs.
    const line = plainWords(`${a.name}: ${inf.type}${a.dmg > 0 ? ` - ${a.dmg} DMG` : ''} - RELOAD ${a.cd}S.  ${inf.special || inf.use}`);
    this.info.setText(line).setOrigin(0, 0).setPosition(INFO_X, INFO_Y);
    this.infoRun = Math.max(0, Math.ceil(this.info.width) - (INFO_R - INFO_X));
    this.infoAt = this.time.now;
    // (kept to its strip as it scrolls: never over the bars or the arena)
    if (!this.infoMask) {
      const shape = this.make.graphics({}, false).fillStyle(0xffffff).fillRect(INFO_X, INFO_Y - 1, INFO_R - INFO_X, 9);
      this.infoMask = shape.createGeometryMask();
    }
    this.info.setMask(this.infoMask);
    // a hold, the scroll at a reading pace, a hold at the end
    this.infoT = INFO_HOLD * 2 + this.infoRun / INFO_SPEED;
  }

  private fighter(c: Creature, x: number, y: number, face: number, scale: number): Fighter {
    return {
      c, x, y, hp: c.hp, max: c.hp, cds: [0, 0.8, 2], face, scale, burn: 0, slow: 0, stun: 0, stunImmune: 0, blind: 0, shield: 0, invuln: 0, aura: 0, root: 0, dash: null,
      poison: 0, marked: 0, shred: 0, weak: 0, chill: 0, haste: 0, regen: 0, guard: 0, shieldMod: null, st: {}, ref: {},
      kx: 0, ky: 0, flash: 0, moving: false, atk: 0, atkX: 0, atkY: 0, stride: 0,
      ult: ultimateOf(c.id), ultT: ULT_UNLOCK_S,
    };
  }

  // ------------------------------------------------------------------ setup

  private paintGround(): void {
    const b = this.biome;
    const g = this.add.graphics().setDepth(0);
    const rnd = new Phaser.Math.RandomDataGenerator([b.id]);
    // ---- the world outside the fence: the sky and light of the place, so
    // the arena is somewhere rather than a coloured box on black
    g.fillStyle(b.mood.sky, 1).fillRect(0, 0, GAME_W, GAME_H);
    for (let i = 0; i < 40; i++) {
      g.fillStyle(b.mood.fleck, 0.1 + rnd.frac() * 0.12);
      g.fillCircle(rnd.between(0, GAME_W), rnd.between(0, GAME_H), rnd.frac() * 1.6);
    }
    // ---- the ground
    // the cover goes down first, so the floor's pools, crystals and sheets
    // are laid round it and round the two starts, never under or on them
    this.layOutCover(rnd);
    const avoid = [
      ...this.props.map((q) => ({ x: q.x, y: q.y, r: q.r * 1.5 })),
      { x: ARENA.x + 40, y: ARENA.y + ARENA.h / 2, r: 12 },
      { x: ARENA.x + ARENA.w - 40, y: ARENA.y + ARENA.h / 2, r: 12 },
    ];
    // (each world's own floor and set pieces: art/arenaFloors)
    paintFloor(g, b.id, ARENA, b.ground, b.groundDark, b.id, 1, avoid);
    // ---- THE TILES (user, 4 Nov): every distance on the cards is in TILES
    // (game/plainWords TILE_PX), so the floor shows them -- a faded box
    // outline for each, laid in from the middle so the part tiles at the top
    // and bottom edges are the same, a dark line with a faint lit edge
    // inside it, the way tiles are set in a floor
    {
      const T = TILE_PX;
      const cols = Math.floor(ARENA.w / T);
      const rows = Math.floor(ARENA.h / T);
      const ox = ARENA.x + (ARENA.w - cols * T) / 2;
      const oy = ARENA.y + (ARENA.h - rows * T) / 2;
      // (a dark line on a light floor, a pale one on a dark floor: faded on both)
      const lum = (((b.ground >> 16) & 255) * 0.3 + ((b.ground >> 8) & 255) * 0.59 + (b.ground & 255) * 0.11) / 255;
      const [edge, edgeA] = lum < 0.38 ? [0xffffff, 0.07] : [0x000000, 0.13];
      for (let cx = -1; cx <= cols; cx++)
        for (let cy = -1; cy <= rows; cy++) {
          const x0 = Math.max(ARENA.x, ox + cx * T);
          const y0 = Math.max(ARENA.y, oy + cy * T);
          const x1 = Math.min(ARENA.x + ARENA.w, ox + (cx + 1) * T);
          const y1 = Math.min(ARENA.y + ARENA.h, oy + (cy + 1) * T);
          if (x1 - x0 < 2 || y1 - y0 < 2) continue;
          g.lineStyle(1, edge, edgeA).strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
          g.fillStyle(0xffffff, 0.035).fillRect(x0 + 1, y0 + 1, x1 - x0 - 2, 1);
        }
    }
    // a worn track round the middle, where fights happen
    g.lineStyle(3, b.groundDark, 0.25).strokeEllipse(ARENA.x + ARENA.w / 2, ARENA.y + ARENA.h / 2, ARENA.w * 0.72, ARENA.h * 0.78);
    // the haze of the place, heaviest at the edges: light coming in over it
    for (let i = 0; i < 5; i++) {
      g.fillStyle(b.mood.haze, 0.05);
      g.fillRect(ARENA.x, ARENA.y + i * 2, ARENA.w, 2);
      g.fillRect(ARENA.x, ARENA.y + ARENA.h - 2 - i * 2, ARENA.w, 2);
      g.fillRect(ARENA.x + i * 2, ARENA.y, 2, ARENA.h);
      g.fillRect(ARENA.x + ARENA.w - 2 - i * 2, ARENA.y, 2, ARENA.h);
    }
    g.lineStyle(2, b.groundDark, 1).strokeRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    // ---- THE HUD BANDS, above and below the ring: dark, so the names, the
    // bars and the move lines read on the brightest worlds (snow, sand)
    g.fillStyle(0x0a0c16, 0.82).fillRect(0, 0, GAME_W, ARENA.y - 1);
    g.fillStyle(0x0a0c16, 0.82).fillRect(0, ARENA.y + ARENA.h + 1, GAME_W, GAME_H - ARENA.y - ARENA.h - 1);

    this.terrain = this.add.graphics().setDepth(1);
    this.repaintCover();
  }

  /**
   * ---- WHERE THE COVER GOES, AND WHY IT IS WHERE IT IS.
   *
   * Not six discs at random.  Each world lays its own out: the fields grow
   * trees in clumps you can duck into, the caves and the pass run ridges
   * across the floor with gaps to break through, the ruins stand their
   * columns round the edge and leave the middle to the fight, the shore and
   * the mire scatter.  Nothing is placed over either fighter's start, and
   * the middle of the arena is always crossable.
   */
  private layOutCover(rnd: Phaser.Math.RandomDataGenerator): void {
    const b = this.biome;
    const midY = ARENA.y + ARENA.h / 2;
    // somewhere a piece can go: off both starts, inside the fence, and -- for
    // a barrier being built OUT OF several pieces -- clear of the OTHER
    // barriers only, since a ridge or a stand is meant to touch itself
    const clear = (x: number, y: number, r: number, apart = true): boolean =>
      Math.hypot(x - this.me.x, y - this.me.y) > r + 26 &&
      Math.hypot(x - this.foe.x, y - this.foe.y) > r + 26 * this.foe.scale &&
      x > ARENA.x + COVER_LANE && x < ARENA.x + ARENA.w - COVER_LANE && y > ARENA.y + COVER_LANE - 4 && y < ARENA.y + ARENA.h - COVER_LANE + 4 &&
      // (wide apart: a creature always fits between two barriers, so melee
      // can be walked round and not funnelled -- user, 3 Nov)
      (!apart || !this.props.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + r + 19));
    const add = (parts: Prop[], kind: CoverShape = b.prop): void => {
      if (!parts.length) return;
      // the place's own pieces break when they are the breaking kind
      const hp = COVER_HP[kind];
      if (hp) for (const q of parts) Object.assign(q, { hp, maxHp: hp });
      this.barriers.push({ kind, parts, seed: rnd.between(1, 9999), life: -1, owner: null });
      this.props.push(...parts);
    };
    // ---- the world's other cover first, so the long pieces (a table, a
    // fence, a log) always find room; the main cover fills in round them
    const extras = WORLD_EXTRAS[b.id] ?? [];
    // (more of it than there was -- user, 4 Nov: "place more barriers")
    const want = this.boss ? 3 : 4;
    let placed = 0;
    // ---- THE LANE BETWEEN THE TWO STARTS IS NEVER BARE: a piece or two
    // across the middle of it first, so a straight run at each other always
    // has something to go round or duck behind
    for (const k of [-1, 1]) {
      for (let tries = 0; tries < 30; tries++) {
        const x = ARENA.x + ARENA.w / 2 + k * rnd.between(12, 44);
        const y = midY + rnd.between(-14, 14);
        const [kind] = extras.length ? extras[rnd.between(0, extras.length - 1)] : [b.prop];
        const r = kind === 'mushroom' || kind === 'urn' ? 5 : 6;
        if (!clear(x, y, r + 4)) continue;
        add([{ x, y, r }], kind);
        break;
      }
    }
    // (each kind gets its tries before the next: the long ones -- a table,
    // a fence -- would otherwise always lose out to the small ones)
    const start = rnd.between(0, Math.max(0, extras.length - 1));
    let slot = 0;
    for (let guard = 0; placed < want && slot < extras.length * 2 && guard < 240; guard++) {
      if (guard > 0 && guard % 20 === 0) slot++;
      const [kind, len] = extras[(start + slot) % extras.length] ?? ['rock', 1];
      const x = ARENA.x + rnd.between(44, ARENA.w - 44);
      const y = ARENA.y + rnd.between(COVER_LANE + 2, ARENA.h - COVER_LANE - 2);
      const r = kind === 'mushroom' || kind === 'urn' ? 5 : 6;
      // lying along the floor, a piece every 10px
      const horiz = rnd.frac() < 0.6;
      const parts: Prop[] = [];
      for (let k = 0; k < len; k++) {
        const off = (k - (len - 1) / 2) * 10;
        parts.push({ x: x + (horiz ? off : 0), y: y + (horiz ? 0 : off * 0.8), r });
      }
      if (!parts.every((q) => clear(q.x, q.y, q.r + 4))) continue;
      add(parts, kind);
      placed++;
      slot++;
      guard = Math.ceil(guard / 20) * 20;
    }
    const n = this.boss ? 4 : 6;
    // (the main cover counts on its own: the extras above are not its share)
    const base0 = this.barriers.length;
    const mine = (): number => this.barriers.length - base0;
    switch (b.cover) {
      case 'line': {
        // two ridges across the middle of the floor, each with a gap you can
        // run through -- and stopping well short of the fence at both ends,
        // so the way round them is a lane you can see, not a crack along the
        // wall that a creature seemed to walk straight through
        for (const k of [-1, 1]) {
          const cx = ARENA.x + ARENA.w / 2 + k * 40;
          const gap = rnd.between(-10, 10);
          const parts: Prop[] = [];
          for (let y = ARENA.y + COVER_LANE; y < ARENA.y + ARENA.h - COVER_LANE; y += 7) {
            if (Math.abs(y - (midY + gap)) < 20) continue;
            const x = cx + rnd.between(-2, 2);
            // (the ridge's own pieces touch; anything else keeps its distance)
            if (!clear(x, y, 5, true)) continue;
            parts.push({ x, y, r: 5 });
          }
          add(parts);
        }
        break;
      }
      case 'grove': {
        // clumps, the way trees grow -- packed tight, so a clump is one solid
        // stand to hide behind and never a ring of trunks to get stuck in
        let guard = 0;
        while (mine() < n && guard++ < 300) {
          const cx = ARENA.x + rnd.between(46, ARENA.w - 46);
          const cy = ARENA.y + rnd.between(COVER_LANE + 4, ARENA.h - COVER_LANE - 4);
          if (!clear(cx, cy, 16)) continue;
          const parts: Prop[] = [];
          for (let i = 0; i < rnd.between(4, 6); i++) {
            const a = rnd.rotation();
            const d = rnd.between(0, 6);
            const p = { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.7, r: rnd.between(5, 7) };
            if (clear(p.x, p.y, p.r, false)) parts.push(p);
          }
          add(parts);
        }
        break;
      }
      case 'ring': {
        // round the outside, leaving the floor in the middle open
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.3;
          const x = ARENA.x + ARENA.w / 2 + Math.cos(a) * ARENA.w * 0.3;
          const y = midY + Math.sin(a) * ARENA.h * 0.3;
          if (!clear(x, y, 8)) continue;
          add([{ x, y, r: rnd.between(7, 9) }]);
        }
        break;
      }
      default: {
        let guard = 0;
        while (mine() < n + 2 && guard++ < 300) {
          const x = ARENA.x + rnd.between(50, ARENA.w - 50);
          const y = ARENA.y + rnd.between(COVER_LANE, ARENA.h - COVER_LANE);
          if (!clear(x, y, 9)) continue;
          add([{ x, y, r: rnd.between(6, 9) }]);
        }
        break;
      }
    }
    // ---- NOBODY IS EVER BOXED IN: every open patch of floor joins up with
    // both starts.  A barrier that closes a pocket off is taken out again.
    for (let tries = 0; tries < 12; tries++) {
      const r = this.pathCheck();
      if (r.ok) break;
      const near = this.barriers
        .filter((bar) => bar.life < 0)
        .map((bar) => ({ bar, d: Math.min(...bar.parts.map((q) => Math.hypot(q.x - r.at!.x, q.y - r.at!.y))) }))
        .sort((p1, p2) => p1.d - p2.d)[0];
      if (!near) break;
      this.barriers = this.barriers.filter((bar) => bar !== near.bar);
      this.props = this.props.filter((q) => !near.bar.parts.includes(q));
    }
  }

  /**
   * Can a creature get everywhere?  The floor on a 4px grid, each cell open
   * if the biggest body in the fight fits there; flooded from your start.
   * ok when the other start is reached and no open cell is left cut off;
   * otherwise `at` is one of the cut-off cells.
   */
  pathCheck(): { ok: boolean; reached: boolean; pockets: number; at: { x: number; y: number } | null } {
    const C = 4;
    const cols = Math.floor(ARENA.w / C);
    const rows = Math.floor(ARENA.h / C);
    const body = BODY_R * Math.max(this.me.scale, this.foe.scale) * 0.85;
    const open = new Uint8Array(cols * rows);
    const cx = (i: number): number => ARENA.x + (i + 0.5) * C;
    const cy = (j: number): number => ARENA.y + (j + 0.5) * C;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = cx(i);
        const y = cy(j);
        if (x < ARENA.x + body || x > ARENA.x + ARENA.w - body || y < ARENA.y + body || y > ARENA.y + ARENA.h - body) continue;
        if (this.props.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + body)) continue;
        open[j * cols + i] = 1;
      }
    const cellOf = (x: number, y: number): number => Phaser.Math.Clamp(Math.floor((y - ARENA.y) / C), 0, rows - 1) * cols + Phaser.Math.Clamp(Math.floor((x - ARENA.x) / C), 0, cols - 1);
    const seen = new Uint8Array(cols * rows);
    const start = cellOf(this.me.x, this.me.y);
    const q: number[] = [start];
    seen[start] = 1;
    while (q.length) {
      const c = q.pop()!;
      const i = c % cols;
      const j = (c - i) / cols;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const n = nj * cols + ni;
        if (seen[n] || !open[n]) continue;
        seen[n] = 1;
        q.push(n);
      }
    }
    const reached = seen[cellOf(this.foe.x, this.foe.y)] === 1;
    let pockets = 0;
    let at: { x: number; y: number } | null = null;
    for (let c = 0; c < open.length; c++)
      if (open[c] && !seen[c]) {
        pockets++;
        if (!at) at = { x: cx(c % cols), y: cy(Math.floor(c / cols)) };
      }
    if (!reached && !at) at = { x: this.foe.x, y: this.foe.y };
    return { ok: reached && pockets === 0, reached, pockets, at };
  }

  /** A shot into a breakable piece of wall: it cracks, and at nothing it falls. */
  private chip(p: Prop, dmg: number): void {
    if (p.hp === undefined) return;
    p.hp -= dmg;
    if (p.hp > 0) {
      this.repaintCover();
      return;
    }
    const bar = this.barriers.find((b) => b.parts.includes(p));
    this.props = this.props.filter((q) => q !== p);
    for (const b of this.barriers) b.parts = b.parts.filter((q) => q !== p);
    this.barriers = this.barriers.filter((b) => b.parts.length || b.max === undefined);
    this.fx.push({ kind: 'boom', x: p.x, y: p.y, r: 10, t: 0, life: 0.3, col: 0xd8d0c0 });
    // it comes apart in its own colours
    const cols = (bar && DEBRIS[bar.kind]) || [0xd8d0c0];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
      const d = p.r + 4 + Math.random() * 8;
      const bit = this.add.rectangle(p.x, p.y, 2, 2, cols[i % cols.length]).setDepth(30);
      this.tweens.add({ targets: bit, x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.7, alpha: 0, angle: 180, duration: 420 + Math.random() * 260, ease: 'Quad.easeOut', onComplete: () => bit.destroy() });
    }
    audio.sfx('item_thud', 0.55);
    this.repaintCover();
  }

  /**
   * The clock on every dropped wall, and the cracks in the breakable ones:
   * a bar over the wall running down to nothing, so nobody has to guess
   * how long it has left.
   */
  private drawWallClocks(u: Phaser.GameObjects.Graphics): void {
    for (const bar of this.barriers) {
      if (bar.life < 0 || !bar.max || !bar.parts.length) continue;
      const top = bar.parts.reduce((a, q) => (q.y - q.r < a.y - a.r ? q : a));
      const cx = bar.parts.reduce((a, q) => a + q.x, 0) / bar.parts.length;
      const w = 14;
      const k = Phaser.Math.Clamp(bar.life / bar.max, 0, 1);
      const col = bar.owner ? ELEMENTS[bar.owner.c.element].light : 0xffffff;
      u.fillStyle(0x000000, 0.6).fillRect(cx - w / 2 - 1, top.y - top.r - 6, w + 2, 3);
      u.fillStyle(col, 0.9).fillRect(cx - w / 2, top.y - top.r - 5, Math.max(1, w * k), 1);
      // a piece nothing breaks wears a little lock: no point shooting it
      if (!bar.parts.some((q) => q.hp !== undefined)) u.fillStyle(0xffffff, 0.8).fillRect(cx + w / 2 + 2, top.y - top.r - 6, 2, 3);
    }
  }

  /** Every barrier, drawn again: the scenery, and anything dropped since. */
  private repaintCover(): void {
    const g = this.terrain;
    g.clear();
    for (const bar of this.barriers) {
      const fade = bar.max !== undefined ? Math.max(0, Math.min(1, bar.life / 1.2)) : 1;
      g.setAlpha(fade);
      for (const p of bar.parts) {
        // worn down: drawn a size smaller at each stage (it still blocks at
        // its full size until it goes)
        const k = p.hp !== undefined && p.maxHp ? p.hp / p.maxHp : 1;
        const stage = k > 0.66 ? 1 : k > 0.33 ? 0.88 : 0.76;
        this.paintProp(g, stage < 1 ? { ...p, r: p.r * stage } : p, bar);
        // cracks across a piece that has been shot, more the worse it is
        if (p.hp !== undefined && p.maxHp && p.hp < p.maxHp) {
          const dmg = 1 - p.hp / p.maxHp;
          g.lineStyle(1, 0x000000, 0.7);
          g.lineBetween(p.x - p.r * 0.6, p.y - p.r * 0.2, p.x + p.r * 0.1, p.y + p.r * 0.3);
          if (dmg > 0.4) g.lineBetween(p.x + p.r * 0.1, p.y + p.r * 0.3, p.x + p.r * 0.5, p.y - p.r * 0.4);
          if (dmg > 0.7) g.lineBetween(p.x - p.r * 0.2, p.y - p.r * 0.6, p.x, p.y + p.r * 0.6);
        }
      }
    }
    g.setAlpha(1);
  }

  /**
   * ---- NOTHING HERE IS A CIRCLE.
   *
   * A barrier is painted as the thing it is: `blob` makes a lumpy outline
   * from a seed (so the same rock is the same rock every time it is drawn),
   * and each kind puts its own silhouette, shading and detail on top -- a
   * crag with faces and a lit edge, a tree with a trunk and a notched crown,
   * a shard of ice with light through it, a stand of reeds, a cactus, a
   * crust of cooled lava.  The round outline underneath is only what the
   * walking and the shots test against; it is never what you see.
   */
  private blob(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, seed: number, squash = 1, n = 9): Phaser.Types.Math.Vector2Like[] {
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    let h = seed * 2654435761;
    const rnd = (): number => {
      h = (h ^ (h << 13)) >>> 0;
      h = (h ^ (h >>> 17)) >>> 0;
      h = (h ^ (h << 5)) >>> 0;
      return (h % 1000) / 1000;
    };
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (0.82 + rnd() * 0.36);
      pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * squash });
    }
    g.fillPoints(pts, true);
    return pts;
  }

  /** One piece of a barrier, in whatever the place is made of. */
  private paintProp(g: Phaser.GameObjects.Graphics, p: Prop, bar: Barrier): void {
    const kind = bar.kind;
    const tint = bar.owner ? ELEMENTS[bar.owner.c.element] : null;
    const seed = bar.seed + Math.round(p.x * 7 + p.y * 13);
    g.fillStyle(0x000000, 0.28);
    this.blob(g, p.x + 1.5, p.y + p.r * 0.75, p.r * 1.15, seed + 91, 0.42);
    switch (kind) {
      case 'rock':
      case 'pillar': {
        const pillar = kind === 'pillar';
        if (pillar) {
          // a fallen column: a drum with fluting and a broken end
          g.fillStyle(0x6a6048, 1).fillRect(p.x - p.r, p.y - p.r * 0.9, p.r * 2, p.r * 1.8);
          g.fillStyle(0xb8ae90, 1).fillRect(p.x - p.r + 1, p.y - p.r * 0.9, p.r * 2 - 2, p.r * 1.5);
          g.fillStyle(0xe0d8b8, 1).fillRect(p.x - p.r + 1, p.y - p.r * 0.9, p.r * 2 - 2, 1);
          for (let i = 0; i < 4; i++) g.fillStyle(0x8a8068, 0.8).fillRect(p.x - p.r + 2 + i * (p.r / 2.4), p.y - p.r * 0.7, 1, p.r * 1.2);
          g.fillStyle(0x4a4436, 1).fillRect(p.x - p.r, p.y + p.r * 0.6, p.r * 2, 2);
          // the broken top edge, chipped
          g.fillStyle(0x6a6048, 1);
          for (let i = 0; i < 3; i++) g.fillRect(p.x - p.r + 1 + i * (p.r * 0.7), p.y - p.r * 0.9, 2, 1 + (i % 2));
        } else {
          // a crag: a dark mass, two lit faces and a shadowed one
          g.fillStyle(0x332e2a, 1);
          this.blob(g, p.x, p.y, p.r * 1.08, seed, 0.95, 8);
          g.fillStyle(0x5a534a, 1);
          this.blob(g, p.x, p.y, p.r * 0.95, seed + 3, 0.95, 8);
          g.fillStyle(0x7d7468, 1).fillTriangle(p.x - p.r * 0.8, p.y + p.r * 0.5, p.x - p.r * 0.1, p.y - p.r, p.x + p.r * 0.4, p.y + p.r * 0.3);
          g.fillStyle(0x9a9183, 1).fillTriangle(p.x - p.r * 0.2, p.y - p.r * 0.9, p.x + p.r * 0.5, p.y - p.r * 0.2, p.x - p.r * 0.1, p.y - p.r * 0.1);
          g.fillStyle(0x241f1c, 0.7).fillTriangle(p.x + p.r * 0.3, p.y + p.r * 0.8, p.x + p.r, p.y - p.r * 0.1, p.x + p.r * 0.9, p.y + p.r * 0.8);
        }
        break;
      }
      case 'tree': {
        // a trunk with a root flare, and a crown of layered leaf masses
        g.fillStyle(0x2a1a0e, 1).fillRect(p.x - 2.5, p.y - 2, 5, p.r * 1.1);
        g.fillStyle(0x4a3018, 1).fillRect(p.x - 1.5, p.y - 2, 3, p.r * 1.1);
        g.fillStyle(0x2a1a0e, 1).fillRect(p.x - 4, p.y + p.r * 0.9, 8, 1.5);
        g.fillStyle(0x16300f, 1);
        this.blob(g, p.x, p.y - p.r * 0.5, p.r * 1.25, seed + 7, 0.85, 11);
        g.fillStyle(0x2a5a1c, 1);
        this.blob(g, p.x - 0.5, p.y - p.r * 0.7, p.r * 1.05, seed + 11, 0.85, 11);
        g.fillStyle(0x47892c, 1);
        this.blob(g, p.x - p.r * 0.3, p.y - p.r * 0.95, p.r * 0.62, seed + 19, 0.8, 9);
        g.fillStyle(0x76bb49, 0.9);
        this.blob(g, p.x - p.r * 0.45, p.y - p.r * 1.15, p.r * 0.3, seed + 23, 0.8, 7);
        break;
      }
      case 'tuft':
        // a clump of grass: a shaded base and blades of two lengths
        g.fillStyle(0x2e5416, 1);
        this.blob(g, p.x, p.y + 1, p.r * 1.1, seed, 0.5, 8);
        for (let i = -4; i <= 4; i++) {
          const h = p.r * (0.8 + ((i + 4) % 3) * 0.35);
          g.fillStyle(i % 2 ? 0x6aa83a : 0x4a8a2a, 1);
          g.fillTriangle(p.x + i * 1.7 - 0.6, p.y + 1, p.x + i * 1.7 + 0.6, p.y + 1, p.x + i * 1.7 + (i < 0 ? -1.4 : 1.4), p.y + 1 - h);
        }
        g.fillStyle(0xe8d870, 1).fillCircle(p.x + 2, p.y - p.r * 0.9, 1.2);
        break;
      case 'ice':
        // a shard: three faces, one of them nearly white
        g.fillStyle(0x3a7a9a, 1).fillTriangle(p.x - p.r * 1.1, p.y + p.r * 0.8, p.x + p.r * 1.1, p.y + p.r * 0.8, p.x - p.r * 0.1, p.y - p.r * 1.8);
        g.fillStyle(0x6ab4d6, 1).fillTriangle(p.x - p.r * 0.9, p.y + p.r * 0.7, p.x + p.r * 0.5, p.y + p.r * 0.7, p.x - p.r * 0.1, p.y - p.r * 1.6);
        g.fillStyle(0xbfe8f6, 1).fillTriangle(p.x - p.r * 0.5, p.y + p.r * 0.6, p.x + p.r * 0.1, p.y + p.r * 0.6, p.x - p.r * 0.15, p.y - p.r * 1.45);
        g.fillStyle(0xffffff, 0.9).fillTriangle(p.x - p.r * 0.2, p.y + p.r * 0.2, p.x + p.r * 0.05, p.y + p.r * 0.2, p.x - p.r * 0.12, p.y - p.r * 1.2);
        // a smaller shard leaning off it
        g.fillStyle(0x6ab4d6, 1).fillTriangle(p.x + p.r * 0.3, p.y + p.r * 0.8, p.x + p.r * 1.2, p.y + p.r * 0.8, p.x + p.r * 1.1, p.y - p.r * 0.5);
        break;
      case 'reed':
        // standing water, and reeds out of it with seed heads
        g.fillStyle(0x1e3024, 1);
        this.blob(g, p.x, p.y + 1, p.r * 1.25, seed, 0.45, 9);
        g.fillStyle(0x33503a, 0.8);
        this.blob(g, p.x, p.y + 1, p.r * 0.9, seed + 5, 0.45, 9);
        for (let i = -3; i <= 3; i++) {
          const h = p.r * (1.3 + ((i + 3) % 3) * 0.45);
          const lean = i * 0.5;
          g.fillStyle(0x5a7a32, 1).fillTriangle(p.x + i * 2.1 - 0.5, p.y + 1, p.x + i * 2.1 + 0.5, p.y + 1, p.x + i * 2.1 + lean, p.y + 1 - h);
          g.fillStyle(0x8a6a2a, 1).fillRect(p.x + i * 2.1 + lean - 0.5, p.y + 1 - h, 1.5, 2.5);
        }
        break;
      case 'shell':
        // a big conch lying on the sand, with its ribs and its lip
        g.fillStyle(0xb08a70, 1);
        this.blob(g, p.x, p.y + 1, p.r * 1.1, seed, 0.78, 10);
        g.fillStyle(0xf0dcc4, 1);
        this.blob(g, p.x - 0.5, p.y, p.r, seed + 2, 0.78, 10);
        g.lineStyle(1, 0xc8a890, 1);
        for (let i = -2; i <= 2; i++) g.lineBetween(p.x - p.r * 0.1, p.y + p.r * 0.7, p.x + i * p.r * 0.45, p.y - p.r * 0.8);
        g.fillStyle(0xfff4e8, 1).fillEllipse(p.x - p.r * 0.35, p.y - p.r * 0.3, p.r * 0.5, p.r * 0.35);
        g.fillStyle(0xd8b8a0, 1).fillEllipse(p.x + p.r * 0.6, p.y + p.r * 0.5, p.r * 0.7, p.r * 0.4);
        break;
      case 'cactus': {
        // a column with two arms, ribbed, with spines down it
        const h = p.r * 2.2;
        g.fillStyle(0x1c4a24, 1).fillRoundedRect(p.x - 4, p.y - h * 0.62, 8, h, 3.5);
        g.fillStyle(0x2f7a3a, 1).fillRoundedRect(p.x - 3, p.y - h * 0.6, 6, h - 1, 3);
        g.fillStyle(0x4aa84e, 1).fillRoundedRect(p.x - 3, p.y - h * 0.6, 2, h - 2, 1);
        g.fillStyle(0x1c4a24, 1).fillRoundedRect(p.x - p.r - 1, p.y - p.r * 0.5, 5.5, 4.5, 2);
        g.fillStyle(0x2f7a3a, 1).fillRoundedRect(p.x - p.r - 0.5, p.y - p.r * 0.45, 4.5, 3.5, 2);
        g.fillStyle(0x1c4a24, 1).fillRoundedRect(p.x + p.r - 4, p.y - p.r * 0.95, 5.5, 4.5, 2);
        g.fillStyle(0x2f7a3a, 1).fillRoundedRect(p.x + p.r - 3.5, p.y - p.r * 0.9, 4.5, 3.5, 2);
        for (let i = 0; i < 5; i++) g.fillStyle(0xe8f0b0, 1).fillRect(p.x - 1 + (i % 2) * 2, p.y - h * 0.5 + i * (h / 6), 1, 1);
        break;
      }
      case 'vent':
        // a crust of cooled lava, cracked, with the fire still under it
        g.fillStyle(0xff8a30, 0.5);
        this.blob(g, p.x, p.y, p.r * 1.2, seed + 13, 0.75, 9);
        g.fillStyle(0x1a0e08, 1);
        this.blob(g, p.x, p.y, p.r * 1.05, seed, 0.78, 10);
        g.fillStyle(0x3a2016, 1);
        this.blob(g, p.x - 0.5, p.y - 0.5, p.r * 0.85, seed + 4, 0.78, 10);
        // the cracks, glowing
        g.lineStyle(1, 0xff6a20, 0.95);
        g.lineBetween(p.x - p.r * 0.7, p.y + p.r * 0.3, p.x, p.y - p.r * 0.2);
        g.lineBetween(p.x, p.y - p.r * 0.2, p.x + p.r * 0.6, p.y + p.r * 0.4);
        g.lineBetween(p.x, p.y - p.r * 0.2, p.x + p.r * 0.2, p.y - p.r * 0.8);
        g.fillStyle(0xffd060, 0.9).fillCircle(p.x, p.y - p.r * 0.2, 1.2);
        break;
      case 'log':
      case 'driftwood': {
        // a length of trunk on its side, bark and a cut end
        const drift = kind === 'driftwood';
        g.fillStyle(drift ? 0x8a7458 : 0x4a2e16, 1).fillRoundedRect(p.x - p.r - 1, p.y - p.r * 0.6, p.r * 2 + 2, p.r * 1.2, 2);
        g.fillStyle(drift ? 0xc8b090 : 0x6a4424, 1).fillRoundedRect(p.x - p.r, p.y - p.r * 0.55, p.r * 2, p.r * 0.8, 2);
        g.lineStyle(1, drift ? 0x9a8468 : 0x3a2412, 0.8);
        for (let i = -1; i <= 1; i++) g.lineBetween(p.x - p.r * 0.8, p.y + i * 1.6, p.x + p.r * 0.8, p.y + i * 1.6 + 0.5);
        g.fillStyle(drift ? 0xe0d0b0 : 0xc89a60, 1).fillEllipse(p.x + p.r, p.y, 3, p.r * 1.1);
        break;
      }
      case 'stump':
        g.fillStyle(0x4a2e16, 1).fillRect(p.x - p.r * 0.8, p.y - p.r * 0.4, p.r * 1.6, p.r * 1.1);
        g.fillStyle(0x6a4424, 1).fillRect(p.x - p.r * 0.8 + 1, p.y - p.r * 0.4, p.r * 0.6, p.r * 1.1);
        g.fillStyle(0xc89a60, 1).fillEllipse(p.x, p.y - p.r * 0.4, p.r * 1.6, p.r * 0.8);
        g.lineStyle(1, 0x8a6030, 0.9).strokeEllipse(p.x, p.y - p.r * 0.4, p.r * 0.9, p.r * 0.45);
        g.fillStyle(0x4a2e16, 1).fillRect(p.x - p.r, p.y + p.r * 0.6, 3, 1.5).fillRect(p.x + p.r - 3, p.y + p.r * 0.6, 3, 1.5);
        break;
      case 'bush':
        g.fillStyle(0x1e4a16, 1);
        this.blob(g, p.x, p.y, p.r * 1.15, seed, 0.75, 10);
        g.fillStyle(0x3a7a2a, 1);
        this.blob(g, p.x - 0.5, p.y - 1, p.r * 0.95, seed + 3, 0.75, 10);
        g.fillStyle(0x6aa83a, 0.9);
        this.blob(g, p.x - p.r * 0.35, p.y - p.r * 0.45, p.r * 0.45, seed + 6, 0.8, 7);
        g.fillStyle(0xd84a4a, 1).fillCircle(p.x + p.r * 0.4, p.y - 1, 0.9).fillCircle(p.x - p.r * 0.1, p.y + 1.5, 0.9);
        break;
      case 'table':
        // a picnic table: the top, its planks and the bench in front
        g.fillStyle(0x6a4424, 1).fillRect(p.x - p.r - 1, p.y - p.r * 0.7, p.r * 2 + 2, p.r * 0.9);
        g.fillStyle(0xa07040, 1).fillRect(p.x - p.r, p.y - p.r * 0.7, p.r * 2, p.r * 0.7);
        g.lineStyle(1, 0x6a4424, 1).lineBetween(p.x - p.r, p.y - p.r * 0.35, p.x + p.r, p.y - p.r * 0.35);
        g.fillStyle(0x6a4424, 1).fillRect(p.x - p.r + 1, p.y + p.r * 0.2, 2, p.r * 0.6).fillRect(p.x + p.r - 3, p.y + p.r * 0.2, 2, p.r * 0.6);
        g.fillStyle(0x8a5a30, 1).fillRect(p.x - p.r, p.y + p.r * 0.45, p.r * 2, 2);
        break;
      case 'fence':
        g.fillStyle(0x6a4a2a, 1).fillRect(p.x - p.r - 1, p.y - p.r * 0.5, p.r * 2 + 2, 2).fillRect(p.x - p.r - 1, p.y + p.r * 0.2, p.r * 2 + 2, 2);
        for (const dx of [-p.r * 0.6, p.r * 0.6]) {
          g.fillStyle(0xc8a070, 1).fillRect(p.x + dx - 1.5, p.y - p.r * 1.1, 3, p.r * 1.9);
          g.fillStyle(0xe0c090, 1).fillTriangle(p.x + dx - 1.5, p.y - p.r * 1.1, p.x + dx + 1.5, p.y - p.r * 1.1, p.x + dx, p.y - p.r * 1.4);
        }
        break;
      case 'mushroom':
        g.fillStyle(0xf0e8d8, 1).fillRect(p.x - 1.5, p.y - p.r * 0.3, 3, p.r * 1.1);
        g.fillStyle(0xa02828, 1).fillEllipse(p.x, p.y - p.r * 0.4, p.r * 2.2, p.r * 1.3);
        g.fillStyle(0xd04040, 1).fillEllipse(p.x - 0.5, p.y - p.r * 0.55, p.r * 1.9, p.r * 1);
        g.fillStyle(0xffffff, 1).fillCircle(p.x - p.r * 0.4, p.y - p.r * 0.7, 1).fillCircle(p.x + p.r * 0.35, p.y - p.r * 0.5, 0.9).fillCircle(p.x, p.y - p.r * 0.85, 0.8);
        break;
      case 'crystal': {
        const c1 = this.biome.id === 'void' ? 0x6a3ab8 : 0x3a6a9a;
        const c2 = this.biome.id === 'void' ? 0xb88aff : 0x8ac8f0;
        g.fillStyle(c1, 1).fillTriangle(p.x - p.r, p.y + p.r * 0.7, p.x - p.r * 0.2, p.y + p.r * 0.7, p.x - p.r * 0.7, p.y - p.r * 1.2);
        g.fillStyle(c2, 1).fillTriangle(p.x - p.r * 0.5, p.y + p.r * 0.8, p.x + p.r * 0.5, p.y + p.r * 0.8, p.x, p.y - p.r * 1.7);
        g.fillStyle(c1, 1).fillTriangle(p.x + p.r * 0.2, p.y + p.r * 0.7, p.x + p.r, p.y + p.r * 0.7, p.x + p.r * 0.7, p.y - p.r * 0.8);
        g.fillStyle(0xffffff, 0.8).fillTriangle(p.x - p.r * 0.1, p.y + p.r * 0.3, p.x + p.r * 0.1, p.y + p.r * 0.3, p.x, p.y - p.r * 1.3);
        break;
      }
      case 'snowdrift':
        g.fillStyle(0xa0c4d4, 1);
        this.blob(g, p.x, p.y + 1, p.r * 1.2, seed, 0.6, 9);
        g.fillStyle(0xf4fbff, 1);
        this.blob(g, p.x - 0.5, p.y - 0.5, p.r * 1.05, seed + 2, 0.55, 9);
        g.fillStyle(0xffffff, 1).fillEllipse(p.x - p.r * 0.3, p.y - p.r * 0.35, p.r * 0.9, p.r * 0.3);
        break;
      case 'rubble':
        for (let i = 0; i < 4; i++) {
          const ox = [-0.5, 0.45, -0.1, 0.3][i] * p.r;
          const oy = [0.25, 0.3, -0.35, -0.1][i] * p.r;
          g.fillStyle(0x6a6048, 1).fillRect(p.x + ox - p.r * 0.42, p.y + oy - p.r * 0.3, p.r * 0.84, p.r * 0.6);
          g.fillStyle(0xb8ae90, 1).fillRect(p.x + ox - p.r * 0.42, p.y + oy - p.r * 0.3, p.r * 0.84, p.r * 0.35);
        }
        break;
      case 'urn':
        g.fillStyle(0x7a4020, 1).fillEllipse(p.x, p.y, p.r * 1.7, p.r * 1.9);
        g.fillStyle(0xc07040, 1).fillEllipse(p.x - 0.5, p.y - 0.5, p.r * 1.4, p.r * 1.6);
        g.fillStyle(0x7a4020, 1).fillRect(p.x - p.r * 0.45, p.y - p.r * 1.1, p.r * 0.9, 2);
        g.lineStyle(1, 0xf0c060, 0.9).lineBetween(p.x - p.r * 0.7, p.y, p.x + p.r * 0.7, p.y);
        break;
      case 'bones':
        // a big old skull and a rib or two, half in the sand
        g.fillStyle(0xc8bca0, 1).fillEllipse(p.x, p.y, p.r * 1.8, p.r * 1.3);
        g.fillStyle(0xf0e8d0, 1).fillEllipse(p.x - 0.5, p.y - 0.5, p.r * 1.5, p.r * 1.05);
        g.fillStyle(0x3a2a1a, 1).fillCircle(p.x - p.r * 0.35, p.y - p.r * 0.1, 1.3).fillCircle(p.x + p.r * 0.3, p.y - p.r * 0.1, 1.3);
        g.lineStyle(1, 0xf0e8d0, 1);
        for (const dx of [-p.r * 0.9, p.r * 0.9]) g.lineBetween(p.x + dx, p.y + p.r * 0.6, p.x + dx * 1.2, p.y - p.r * 0.4);
        break;
      case 'stalagmite':
        // a cone of wet stone up from the cave floor, ringed
        g.fillStyle(0x3a342e, 1).fillTriangle(p.x - p.r, p.y + p.r * 0.7, p.x + p.r, p.y + p.r * 0.7, p.x, p.y - p.r * 1.9);
        g.fillStyle(0x6a625a, 1).fillTriangle(p.x - p.r * 0.75, p.y + p.r * 0.6, p.x + p.r * 0.5, p.y + p.r * 0.6, p.x - p.r * 0.05, p.y - p.r * 1.7);
        g.fillStyle(0x9a9183, 1).fillTriangle(p.x - p.r * 0.45, p.y + p.r * 0.4, p.x - p.r * 0.1, p.y + p.r * 0.4, p.x - p.r * 0.1, p.y - p.r * 1.4);
        g.lineStyle(1, 0x2a241e, 0.8).lineBetween(p.x - p.r * 0.6, p.y, p.x + p.r * 0.55, p.y).lineBetween(p.x - p.r * 0.35, p.y - p.r * 0.8, p.x + p.r * 0.3, p.y - p.r * 0.8);
        g.fillStyle(0xbfe0ff, 0.9).fillRect(p.x - 0.5, p.y - p.r * 1.85, 1, 1);
        break;
      case 'haybale':
        g.fillStyle(0x8a6a1a, 1).fillRoundedRect(p.x - p.r - 1, p.y - p.r * 0.8, p.r * 2 + 2, p.r * 1.6, 2);
        g.fillStyle(0xe0b848, 1).fillRoundedRect(p.x - p.r, p.y - p.r * 0.8, p.r * 2, p.r * 1.4, 2);
        g.fillStyle(0xf4d878, 1).fillRect(p.x - p.r + 1, p.y - p.r * 0.8, p.r * 2 - 2, 2);
        g.lineStyle(1, 0x9a3a2a, 1).lineBetween(p.x - p.r * 0.4, p.y - p.r * 0.8, p.x - p.r * 0.4, p.y + p.r * 0.6).lineBetween(p.x + p.r * 0.4, p.y - p.r * 0.8, p.x + p.r * 0.4, p.y + p.r * 0.6);
        g.fillStyle(0xb8902a, 1);
        for (let i = 0; i < 5; i++) g.fillRect(p.x - p.r + 1 + i * (p.r * 0.45), p.y - p.r * 0.3 + (i % 2) * 2, 2, 1);
        break;
      case 'pine':
        // a conifer: three tiers of needles over a short trunk
        g.fillStyle(0x3a2410, 1).fillRect(p.x - 1.5, p.y, 3, p.r * 0.9);
        for (let k = 0; k < 3; k++) {
          const w = p.r * (1.35 - k * 0.32);
          const y0 = p.y + p.r * 0.2 - k * p.r * 0.65;
          g.fillStyle(0x10301a, 1).fillTriangle(p.x - w - 1, y0 + 1, p.x + w + 1, y0 + 1, p.x, y0 - p.r * 1.05);
          g.fillStyle(0x1e5a32, 1).fillTriangle(p.x - w, y0, p.x + w * 0.6, y0, p.x - w * 0.1, y0 - p.r * 0.95);
          g.fillStyle(0x3a8a4a, 1).fillTriangle(p.x - w * 0.7, y0 - 1, p.x - w * 0.15, y0 - 1, p.x - w * 0.25, y0 - p.r * 0.7);
        }
        break;
      case 'snowman':
        g.fillStyle(0xa0c4d4, 1).fillCircle(p.x, p.y + p.r * 0.3, p.r * 0.95).fillCircle(p.x, p.y - p.r * 0.85, p.r * 0.65);
        g.fillStyle(0xffffff, 1).fillCircle(p.x - 0.5, p.y + p.r * 0.2, p.r * 0.85).fillCircle(p.x - 0.5, p.y - p.r * 0.9, p.r * 0.56);
        g.fillStyle(0x1a1a24, 1).fillRect(p.x - 2, p.y - p.r * 1.05, 1, 1).fillRect(p.x + 1, p.y - p.r * 1.05, 1, 1).fillRect(p.x - 0.5, p.y + p.r * 0.05, 1, 1).fillRect(p.x - 0.5, p.y + p.r * 0.45, 1, 1);
        g.fillStyle(0xf08a3a, 1).fillTriangle(p.x, p.y - p.r * 0.85, p.x, p.y - p.r * 0.65, p.x + 3, p.y - p.r * 0.75);
        g.fillStyle(0xc83a3a, 1).fillRect(p.x - p.r * 0.6, p.y - p.r * 0.42, p.r * 1.2, 1.5);
        break;
      case 'mossylog': {
        // a rotting log half in the water, furred with moss
        g.fillStyle(0x1e3024, 0.8).fillEllipse(p.x, p.y + p.r * 0.5, p.r * 2.6, p.r * 0.8);
        g.fillStyle(0x3a2412, 1).fillRoundedRect(p.x - p.r - 1, p.y - p.r * 0.55, p.r * 2 + 2, p.r * 1.1, 2);
        g.fillStyle(0x5a3a1e, 1).fillRoundedRect(p.x - p.r, p.y - p.r * 0.5, p.r * 2, p.r * 0.7, 2);
        g.fillStyle(0x5a8a2a, 1);
        this.blob(g, p.x - p.r * 0.2, p.y - p.r * 0.55, p.r * 0.8, seed, 0.35, 8);
        g.fillStyle(0x8ab04a, 1).fillRect(p.x - p.r * 0.6, p.y - p.r * 0.7, 2, 1).fillRect(p.x + p.r * 0.2, p.y - p.r * 0.6, 2, 1);
        g.fillStyle(0x8a6a3a, 1).fillEllipse(p.x + p.r, p.y - p.r * 0.1, 3, p.r);
        break;
      }
      case 'bogroot':
        // a knot of black roots arching out of the mire
        g.fillStyle(0x1e3024, 0.8).fillEllipse(p.x, p.y + p.r * 0.6, p.r * 2.4, p.r * 0.7);
        g.lineStyle(2, 0x2a1c10, 1);
        g.beginPath().arc(p.x - p.r * 0.3, p.y + p.r * 0.5, p.r * 0.7, Math.PI, 0).strokePath();
        g.beginPath().arc(p.x + p.r * 0.4, p.y + p.r * 0.5, p.r * 0.6, Math.PI, 0).strokePath();
        g.lineStyle(1, 0x5a4024, 1);
        g.beginPath().arc(p.x - p.r * 0.3, p.y + p.r * 0.5, p.r * 0.7, Math.PI * 1.1, Math.PI * 1.5).strokePath();
        g.fillStyle(0x3a2a18, 1).fillRect(p.x - 1, p.y - p.r * 1.1, 2, p.r * 1.1);
        g.fillStyle(0x5a7a32, 1).fillRect(p.x - 2, p.y - p.r * 1.2, 4, 1.5);
        break;
      case 'sandcastle':
        g.fillStyle(0xb89a60, 1).fillRect(p.x - p.r, p.y - p.r * 0.4, p.r * 2, p.r * 1.1);
        g.fillStyle(0xe8d090, 1).fillRect(p.x - p.r + 1, p.y - p.r * 0.4, p.r * 2 - 2, p.r * 0.9);
        g.fillStyle(0xd8b878, 1).fillRect(p.x - p.r * 0.45, p.y - p.r * 1.2, p.r * 0.9, p.r * 0.9);
        for (const dx of [-p.r, -p.r * 0.35, p.r * 0.3]) g.fillStyle(0xe8d090, 1).fillRect(p.x + dx, p.y - p.r * 0.6, 2, 2);
        g.fillStyle(0x6a4a2a, 1).fillRect(p.x - 0.5, p.y + p.r * 0.1, 1.5, p.r * 0.6);
        g.fillStyle(0xd83a3a, 1).fillTriangle(p.x, p.y - p.r * 1.8, p.x + 3, p.y - p.r * 1.6, p.x, p.y - p.r * 1.4);
        g.fillStyle(0x6a4a2a, 1).fillRect(p.x - 0.5, p.y - p.r * 1.8, 1, p.r * 0.6);
        break;
      case 'coral':
        // a branching pink coral on a stone
        g.fillStyle(0x8a7a68, 1);
        this.blob(g, p.x, p.y + p.r * 0.5, p.r * 0.9, seed, 0.5, 8);
        g.lineStyle(2, 0xe85a6a, 1);
        for (const [dx, h] of [[-p.r * 0.6, 1.2], [0, 1.6], [p.r * 0.55, 1.1]] as const) {
          g.lineBetween(p.x + dx, p.y + p.r * 0.4, p.x + dx, p.y - p.r * h + p.r * 0.4);
          g.lineBetween(p.x + dx, p.y - p.r * 0.2, p.x + dx + (dx >= 0 ? 2 : -2), p.y - p.r * 0.6);
        }
        g.fillStyle(0xffb0a0, 1).fillCircle(p.x, p.y - p.r * 1.2, 1).fillCircle(p.x - p.r * 0.6, p.y - p.r * 0.8, 1).fillCircle(p.x + p.r * 0.55, p.y - p.r * 0.7, 1);
        break;
      case 'sandstone':
        // a wind-cut boulder in layered bands
        g.fillStyle(0x8a5a30, 1);
        this.blob(g, p.x, p.y, p.r * 1.1, seed, 0.8, 9);
        g.fillStyle(0xd8a060, 1);
        this.blob(g, p.x - 0.5, p.y - 0.5, p.r * 0.95, seed + 2, 0.8, 9);
        g.lineStyle(1, 0xa87040, 0.9);
        for (let k = -1; k <= 1; k++) g.lineBetween(p.x - p.r * 0.8, p.y + k * p.r * 0.35, p.x + p.r * 0.8, p.y + k * p.r * 0.35 + 0.5);
        g.fillStyle(0xf0c888, 1).fillEllipse(p.x - p.r * 0.3, p.y - p.r * 0.55, p.r * 0.8, p.r * 0.3);
        break;
      case 'obelisk':
        // a black needle of stone, runes lit along it
        g.fillStyle(0x0e0a1a, 1).fillRect(p.x - p.r * 0.65, p.y - p.r * 1.5, p.r * 1.3, p.r * 2.2);
        g.fillStyle(0x2a1a48, 1).fillRect(p.x - p.r * 0.55, p.y - p.r * 1.4, p.r * 1.1, p.r * 2.05);
        g.fillStyle(0x0e0a1a, 1).fillTriangle(p.x - p.r * 0.65, p.y - p.r * 1.5, p.x + p.r * 0.65, p.y - p.r * 1.5, p.x, p.y - p.r * 2.1);
        g.fillStyle(0x3a2a68, 1).fillRect(p.x - p.r * 0.55, p.y - p.r * 1.4, 1.5, p.r * 2.05);
        g.fillStyle(0xb88aff, 1);
        for (let k = 0; k < 3; k++) g.fillRect(p.x - 1, p.y - p.r * 1.1 + k * p.r * 0.55, 2, 1).fillRect(p.x, p.y - p.r * 1.0 + k * p.r * 0.55, 1, 1);
        break;
      case 'altar':
        g.fillStyle(0x140f22, 1).fillRect(p.x - p.r - 1, p.y - p.r * 0.6, p.r * 2 + 2, p.r * 1.4);
        g.fillStyle(0x3a2a5a, 1).fillRect(p.x - p.r, p.y - p.r * 0.6, p.r * 2, p.r * 1.1);
        g.fillStyle(0x5a4a8a, 1).fillRect(p.x - p.r, p.y - p.r * 0.6, p.r * 2, 1.5);
        g.lineStyle(1, 0xb88aff, 0.9).strokeCircle(p.x, p.y, p.r * 0.35);
        g.fillStyle(0xe8d8ff, 1).fillRect(p.x - 0.5, p.y - 0.5, 1, 1);
        break;
      case 'voidorb':
        // a sphere of nothing in a cradle, a ring of light round it
        g.fillStyle(0x3a2a5a, 1).fillRect(p.x - p.r * 0.7, p.y + p.r * 0.3, p.r * 1.4, p.r * 0.5);
        g.fillStyle(0x07050e, 1).fillCircle(p.x, p.y - p.r * 0.3, p.r * 0.85);
        g.lineStyle(1, 0xb88aff, 1).strokeCircle(p.x, p.y - p.r * 0.3, p.r * 0.85);
        g.lineStyle(1, 0xe8d8ff, 0.7).strokeEllipse(p.x, p.y - p.r * 0.3, p.r * 2.1, p.r * 0.6);
        g.fillStyle(0xffffff, 0.9).fillRect(p.x - p.r * 0.35, p.y - p.r * 0.7, 1, 1);
        break;
      case 'lavarock':
        // a black boulder with molten seams
        g.fillStyle(0x0e0806, 1);
        this.blob(g, p.x, p.y, p.r * 1.1, seed, 0.85, 8);
        g.fillStyle(0x2a1a14, 1);
        this.blob(g, p.x - 0.5, p.y - 0.5, p.r * 0.9, seed + 4, 0.85, 8);
        g.lineStyle(1, 0xff6a20, 1).lineBetween(p.x - p.r * 0.6, p.y - p.r * 0.2, p.x + p.r * 0.1, p.y + p.r * 0.3).lineBetween(p.x + p.r * 0.1, p.y + p.r * 0.3, p.x + p.r * 0.5, p.y - p.r * 0.3);
        g.fillStyle(0x4a3028, 1).fillEllipse(p.x - p.r * 0.3, p.y - p.r * 0.5, p.r * 0.6, p.r * 0.25);
        break;
      case 'charred':
        // a burnt tree: a black trunk and two dead limbs, embers in the bark
        g.fillStyle(0x0e0806, 1).fillRect(p.x - 2.5, p.y - p.r * 1.6, 5, p.r * 2.2);
        g.fillStyle(0x2a1c16, 1).fillRect(p.x - 1.5, p.y - p.r * 1.6, 2, p.r * 2.2);
        g.lineStyle(2, 0x0e0806, 1).lineBetween(p.x, p.y - p.r * 0.9, p.x - p.r, p.y - p.r * 1.5).lineBetween(p.x, p.y - p.r * 0.5, p.x + p.r * 0.9, p.y - p.r * 1.1);
        g.fillStyle(0xff8a3a, 1).fillRect(p.x - 0.5, p.y - p.r * 0.2, 1, 1).fillRect(p.x + 1, p.y - p.r, 1, 1);
        g.fillStyle(0x3a2a24, 0.8).fillEllipse(p.x, p.y + p.r * 0.6, p.r * 1.8, p.r * 0.5);
        break;
    }
    if (tint) {
      // somebody's own cover: it carries their colour so you know whose it is
      g.lineStyle(1, tint.light, 0.8).strokeCircle(p.x, p.y, p.r + 1);
    }
  }

  private paintHud(): void {
    const name = (f: Fighter): string => (f === this.foe && this.boss ? f.c.name : f.c.name.toUpperCase());
    this.labels.push(text(this, 8, 3, `${name(this.me)} LV${this.myLevel}`, PALETTE.cream).setDepth(51));
    this.labels.push(text(this, GAME_W - 8, 3, this.foeLevel && !this.training ? `${name(this.foe)} LV${this.foeLevel}` : name(this.foe), this.boss ? PALETTE.gold : PALETTE.cream).setOrigin(1, 0).setDepth(51));
    // which step of the run this is, under the opponent's bar
    if (this.mode === 'ladder') {
      this.stepLabel = text(this, GAME_W - 8, 20, this.boss ? 'FINAL BOSS' : `LEVEL ${this.level} OF ${LADDER_LEVELS}`, PALETTE.gold).setOrigin(1, 0).setDepth(51);
      this.labels.push(this.stepLabel);
    } else if (this.mode === 'story') {
      this.stepLabel = text(this, GAME_W - 8, 20, this.boss ? 'WORLD BOSS' : `BATTLE ${this.storyStage + 1} OF ${STAGES}`, PALETTE.gold).setOrigin(1, 0).setDepth(51);
      this.labels.push(this.stepLabel);
    }
    this.timerText = centerText(this, GAME_W / 2, 7, '', PALETTE.fog).setDepth(51);
    // ---- LEAVING A BATTLE is LEAVE in the pause menu (pauseExit), asked
    // first with what it forfeits (user, 28 Oct) -- never a button over the
    // fight.  (And nobody is ever stuck: TIME_LIMIT settles every battle.)
    //
    // TRAINING is not a battle, so it has a way out -- and it goes in the
    // HUD, not over the arena: the middle of the top bar, in the slot the
    // clock would use, which training does not need (the bars either side of
    // it are untouched, and the line under it still says what your element
    // does).  Nothing it covers is part of the game being played.
    // ...and that way out is LEAVE in the pause menu (see pauseExit); on a
    // desktop the slot holds the gear that opens it
    // (Esc on a keyboard, the gear on a phone)
    if (this.training) this.paintTrainButtons();
    this.layAtkBtns();
    // the seconds left on each move while it reloads (placed every frame:
    // the buttons move when the phone is turned)
    this.nameLabels = [];
    this.cdTexts = [0, 1, 2].map(() => text(this, 0, 0, '', PALETTE.cream).setDepth(53).setVisible(false));
    this.labels.push(...this.cdTexts);
    this.wasReady = [true, true, true];
    this.readyFlash = [0, 0, 0];
    // the strip: the key, the icon (drawn each frame), the name
    if (this.touch) {
      // a phone held sideways (C7): each tap button has its move's name beside it
      this.me.c.attacks.forEach((a, i) => {
        const b = this.atkBtns[i];
        const nm = text(this, b.x - 16, b.y - 3, a.name, PALETTE.cream).setOrigin(1, 0).setDepth(52);
        this.nameLabels[i] = nm;
        this.labels.push(nm);
      });
    }
    if (!this.touch && !this.band) {
      this.me.c.attacks.forEach((a, i) => {
        const b = this.atkBtns[i];
        // the key that fires it, always in view, on a keycap: [J] [K] [L]
        this.labels.push(centerText(this, b.x - 42.5, b.y - 0.5, capLabel(codeFor(`creatureclash:${CLASH_KEYS[i]}`)), PALETTE.gold).setDepth(52));
        const nm = text(this, b.x - 21, b.y - 4, a.name, PALETTE.cream).setDepth(52).setMaxWidth(68);
        this.nameLabels[i] = nm;
        this.labels.push(nm);
      });
    }
    // WHAT YOUR ELEMENT DOES, as a sentence, in its own row: under your own
    // health bar, between the bars and the arena -- clear of the bars, the
    // clock and the opponent's side (which has the ladder step under ITS
    // bar).  In the middle of the bar row it was printed over both bars.
    const eff = ELEMENTS[this.me.c.element];
    this.effLabel = text(this, 8, 20, `${eff.name}: ${eff.effect}`, eff.light).setDepth(51);
    this.labels.push(this.effLabel);
    // the ultimate's badge text (drawn in drawUlt), and the opponent's countdown
    this.ultText = smallText(this, ARENA.x + ARENA.w - 54, ARENA.y + ARENA.h - 12, '', PALETTE.cream).setDepth(53);
    this.foeUltText = smallText(this, ARENA.x + ARENA.w - 5, ARENA.y + 3, '', PALETTE.fog).setOrigin(1, 0).setDepth(53);
    this.labels.push(this.ultText!, this.foeUltText!);
  }

  // ------------------------------------------------------------------ input

  private choose(i: number): void {
    if (this.over) return;
    if (this.sel !== i) this.showInfo(i);
    this.sel = i;
    audio.sfx('ui_blip', 0.4);
  }

  private hitBtn(p: Phaser.Input.Pointer): number {
    const r = this.touch ? 13 : 0;
    for (let i = 0; i < 3; i++) {
      const b = this.atkBtns[i];
      if (!b) continue;
      if (this.touch ? Math.hypot(p.x - b.x, p.y - b.y) < r : Math.abs(p.x - b.x) < 49 && Math.abs(p.y - b.y) < 7) return i;
    }
    return -1;
  }

  private down(p: Phaser.Input.Pointer): void {
    if (this.over || this.dialog) return;
    // (a tap on a training button is the button's, not the arena's)
    if (this.trainBtnZone?.contains(p.x, p.y)) return;
    const b = this.hitBtn(p);
    if (b >= 0) {
      // C7: on a phone a tap on an ability uses it, at the other one
      if (this.touch) this.quickFire(b);
      else this.choose(b);
      return;
    }
    if (p.y < 24) return; // the hud
    if (this.touch) {
      // one stick, on the left: no aim stick, no handedness (C7)
      if (p.x < GAME_W / 2 && this.moveStick.id < 0) Object.assign(this.moveStick, { id: p.id, bx: p.x, by: p.y, dx: 0, dy: 0 });
      return;
    }
    // (a desktop click on the arena fires nothing: the keys do all of it)
  }

  private moveP(p: Phaser.Input.Pointer): void {
    for (const s of [this.moveStick]) {
      if (s.id !== p.id) continue;
      let dx = p.x - s.bx;
      let dy = p.y - s.by;
      const m = Math.hypot(dx, dy);
      if (m > 20) {
        dx = (dx / m) * 20;
        dy = (dy / m) * 20;
      }
      s.dx = dx;
      s.dy = dy;
    }
  }

  private up(p: Phaser.Input.Pointer): void {
    if (this.moveStick.id === p.id) Object.assign(this.moveStick, { id: -1, dx: 0, dy: 0 });
  }

  /**
   * The way out of the training ground, and only of the training ground: a
   * battle has no button to reach this, and if something else does, it does
   * nothing.
   */
  /** Where the attack buttons are, for whichever way the controls are laid out. */
  private layAtkBtns(): void {
    if (this.touch) {
      // C7: the move stick on the left; the three abilities on the right, a
      // tap button each, stacked up the edge with their names beside them
      Object.assign(this.moveStick, { hx: 34, hy: GAME_H - 28 });
      this.atkBtns = [0, 1, 2].map((i) => ({ x: GAME_W - 18, y: GAME_H - 16 - (2 - i) * 28 }));
    } else if (this.band) {
      // (on the band under the picture)
      this.atkBtns = [];
    } else {
      // three buttons 98 wide with 8 between them: an eleven-letter move name
      // (the longest there is -- see creatures MOVE_NAME_MAX) fits inside one
      // with its number and its icon, and still clears the border.
      this.atkBtns = [0, 1, 2].map((i) => ({ x: 54 + i * 106, y: GAME_H - 13 }));
    }
  }

  /** Upright on a phone: the move pad and the three attacks in the band under the picture. */
  private applyBand(): void {
    if (!this.band) {
      setCabinetTouch(null);
      return;
    }
    const keys: KeyName[] = ['FOUR', 'FIVE', 'SIX'];
    setCabinetTouch(
      {
        stick: 'wasd',
        buttons: this.me.c.attacks.map((a, i) => {
          const inf = attackInfo(a, this.me.c.element);
          // (the move's own word, so no two buttons read the same)
          const word = buttonWords(this.me.c.attacks)[i];
          // the ability's own pixel icon, as the arena draws it -- not an emoji
          const icon = abilityIconURL(a, ELEMENTS[this.me.c.element].light);
          return { label: `${inf.emoji}\n${word}`, icon, key: keys[i], primary: i === 0 };
        }).concat(this.me.ult ? [{ label: '★\nULT', icon: undefined as unknown as string, key: 'I' as KeyName, primary: false }] : []),
      },
      'CreatureArena',
    );
  }

  /**
   * LEAVE, in the pause menu between RESUME and EXIT TO START MENU, like
   * every cabinet's (user, 28 Oct).  Training goes straight out; a real
   * battle asks first and says what walking out costs.
   */
  pauseExit(): { label: string; run: () => void } | null {
    if (this.over || this.sim) return null;
    return { label: 'LEAVE', run: () => (this.training ? this.askQuit() : this.confirmLeave()) };
  }

  /**
   * WALKING OUT OF A BATTLE, asked first.  Before the bell nothing has been
   * paid, so nothing is lost.  After it, leaving is a loss: the fight's price
   * stays spent and the fighter faints -- or, on the ladder, the run ends and
   * its entry and its prize go with it.
   */
  private confirmLeave(): void {
    if (this.dialog || this.over) return;
    if (this.mode === 'mini') {
      const was = this.paused;
      this.paused = true;
      this.dialog = confirmDialog(this, {
        lines: ['LEAVE THIS MINI GAME?', 'THE ENTRY IS GONE AND NOTHING IS PAID.'],
        confirm: 'CONFIRM LEAVE',
        edge: 0xc31f2e,
        onConfirm: () => {
          this.dialog = null;
          this.over = true;
          this.settled = true;
          abandonMini();
          this.scene.start('CreatureHub', { from: this.from, screen: 'minis', msg: 'YOU LEFT THE MINI GAME.' });
        },
        onCancel: () => {
          this.dialog?.destroy();
          this.dialog = null;
          if (this.started && !was) countBack(() => (this.paused = was));
          else this.paused = was;
        },
      });
      this.dialog.setDepth(3000);
      return;
    }
    const paid = this.started;
    const risk = !paid ? 0 : this.mode === 'ladder' ? LADDER_COST : this.mode === 'story' ? storyPrice(this.storyWorld, this.storyReplay).cost : BATTLE_COST;
    const name = this.me.c.name.toUpperCase();
    const lines = !paid
      ? ['LEAVE BEFORE THE BELL?', 'NOTHING HAS BEEN PAID YET.']
      : this.mode === 'ladder'
        ? ['LEAVE THIS BATTLE?', ...forfeitLines(risk), `THE LADDER RUN ENDS, AND ITS ${LADDER_BOSS_WIN} PRIZE.`]
        : ['LEAVE THIS BATTLE?', ...forfeitLines(risk), `IT COUNTS AS A LOSS: ${name} FAINTS.`];
    const was = this.paused;
    this.paused = true;
    this.dialog = confirmDialog(this, {
      lines,
      confirm: paid ? 'CONFIRM LEAVE' : 'LEAVE',
      edge: paid ? 0xc31f2e : PALETTE.neon,
      onConfirm: () => {
        this.dialog = null;
        this.over = true;
        this.settled = true;
        const screen = this.mode === 'ladder' ? 'ladder' : this.mode === 'story' ? 'trail' : 'map';
        const r = paid ? finishBattle(false, this.foeLevel) : null;
        const fainted = r && !r.runOver ? `YOU LEFT. ${name} FAINTED.` : 'YOU LEFT. THE RUN IS OVER.';
        this.scene.start('CreatureHub', { from: this.from, screen, world: this.storyWorld, msg: r ? fainted : 'YOU LEFT BEFORE THE BELL.' });
      },
      onCancel: () => {
        this.dialog?.destroy();
        this.dialog = null;
        // back into a fight under way counts 3, 2, 1 first (LEAVE itself
        // did not count: it was on the way out)
        if (this.started && !was) countBack(() => (this.paused = was));
        else this.paused = was;
      },
    });
    this.dialog.setDepth(3000);
  }

  /** Training: does the dummy fight back? (ALLOW ATTACK) */
  private trainAttack = false;
  /** Where the training buttons are, so a tap on one is not also a tap on the arena. */
  private trainBtnZone: Phaser.Geom.Rectangle | null = null;

  /**
   * ---- THE TRAINING BUTTONS (user, 5 Nov).  ALLOW ATTACK turns the dummy's
   * fighting back on and off -- on, it fights as a real opponent does, so
   * healing, shields and damage taken can be tried -- and FULL HEAL puts your
   * creature straight back to full.  They sit on the arena's top edge, in the
   * middle, small enough to leave the fight in view.
   */
  private paintTrainButtons(): void {
    const y = ARENA.y + 7;
    const w = 66;
    const atk = button(this, GAME_W / 2 - 35, y, 'ATTACK: OFF', () => {
      this.trainAttack = !this.trainAttack;
      lbl.setText(this.trainAttack ? 'ATTACK: ON' : 'ATTACK: OFF');
      box.setFillStyle(this.trainAttack ? 0x5a1a22 : PALETTE.plum);
      this.ai.think = 0;
      audio.sfx('ui_blip', 0.5);
    }, { width: w, height: 11 }).setDepth(70);
    const box = atk.list[0] as Phaser.GameObjects.Rectangle;
    const lbl = atk.list[1] as Phaser.GameObjects.BitmapText;
    button(this, GAME_W / 2 + 35, y, 'FULL HEAL', () => {
      this.fullHeal(this.me);
      this.fx.push({ kind: 'ring', x: this.me.x, y: this.me.y, r: 14, t: 0, life: 0.4, col: 0x8ae88a });
      audio.sfx('chime', 0.5);
    }, { width: w, height: 11, fill: 0x1f4a2a }).setDepth(70);
    this.trainBtnZone = new Phaser.Geom.Rectangle(GAME_W / 2 - 35 - w / 2 - 2, y - 8, w * 2 + 12, 16);
  }

  /** Back to full health, with nothing left on it that hurts or holds it. */
  private fullHeal(f: Fighter): void {
    f.hp = f.max;
    f.burn = 0;
    f.slow = 0;
    f.stun = 0;
    f.blind = 0;
    f.root = 0;
    for (const k of ['poison', 'bleed', 'weak', 'shred', 'silence', 'chill', 'mired', 'u_fear', 'u_poly'] as const) if (f.st[k]) f.st[k] = 0;
  }

  private askQuit(): void {
    if (!this.training) return;
    this.scene.start('CreatureHub', { from: this.from });
  }

  // ----------------------------------------------------------------- combat

  private fire(f: Fighter, i: number, ax: number, ay: number): boolean {
    // (afraid, or a sheep: no attacking)
    if (f.st.u_fear || f.st.u_poly) return false;
    const ok = this.fireOnce(f, i, ax, ay);
    // an ECHO (ultimate): the same move again, a moment later
    if (ok && (f.st.u_echo ?? 0) > 0) {
      this.time.delayedCall(260, () => {
        if (this.over || f.hp <= 0) return;
        const cd = f.cds[i];
        f.cds[i] = 0;
        const o = this.other(f);
        if (this.fireOnce(f, i, o.x - f.x, o.y - f.y)) this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 10 * f.scale, t: 0, life: 0.25, col: 0xc0c8ff });
        f.cds[i] = Math.max(f.cds[i], cd);
      });
    }
    return ok;
  }

  private fireOnce(f: Fighter, i: number, ax: number, ay: number): boolean {
    if (f.cds[i] > 0 || !this.canAct(f) || f.dash || f.hp <= 0) return false;
    const a = f.c.attacks[i];
    // a boss's floor mechanic runs on its own clock, not as a button -- but a
    // boss on your own team (the admin's recruit) fires it at them, on its timer
    if (a.sp && SPECIALS[a.sp]?.ai === 'never') {
      const def = f.c.boss;
      if (f !== this.me || !def) return false;
      const o = this.other(f);
      this.bossPattern(def, { x: o.x, y: o.y }, f);
      f.cds[i] = def.every;
      f.atk = 0.25;
      return true;
    }
    let m = Math.hypot(ax, ay) || 1;
    let ux = ax / m;
    let uy = ay / m;
    // spores up the nose: this one goes anywhere; dazzled: it goes wide
    if ((f.st.n_sneeze ?? 0) > 0) {
      f.st.n_sneeze = 0;
      const r = Math.random() * Math.PI * 2;
      ux = Math.cos(r);
      uy = Math.sin(r);
    } else if ((f.st.n_dazzle ?? 0) > 0) {
      f.st.n_dazzle -= 1;
      const r = Math.atan2(uy, ux) + (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 6);
      ux = Math.cos(r);
      uy = Math.sin(r);
    }
    // (a sticky glob on you: every dash and blink goes half as far)
    const mired = (f.st.mired ?? 0) > 0 ? 0.5 : 1;
    if (a.kind === 'blink' || a.kind === 'dash') m *= mired;
    f.cds[i] = a.cd;
    f.face = ux >= 0 ? 1 : -1;
    // the lunge that throws it
    f.atk = ATK_T;
    f.atkX = ux;
    f.atkY = uy;
    // out of hiding the moment it attacks (and an ambush remembers it was)
    if (f.st.invis > 0) f.st.n_hidden = 1;
    f.st.invis = 0;
    const col = ELEMENTS[f.c.element].col;
    // glow pierces; so does anything fired from beside its own beacon
    const pierce = f.c.element === 'glow' || this.pools.some((pl) => pl.kind === 'beacon' && pl.owner === f && Math.hypot(pl.x - f.x, pl.y - f.y) < 40);
    // an aura is live: everything this creature throws hits harder
    const dmg = Math.round(a.dmg * (f.aura > 0 ? AURA_POWER : 1));
    // a tailwind behind it: shots fly faster and further
    const tw = (f.st.tailwind ?? 0) > 0;
    const shot = (ang: number, over?: Partial<Shot>): void => {
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const vx = ux * c - uy * s;
      const vy = ux * s + uy * c;
      const sp = a.reach * (tw ? 1.5 : 1);
      this.shots.push({ owner: f, x: f.x + vx * 8 * f.scale, y: f.y + vy * 8 * f.scale, vx: vx * sp, vy: vy * sp, life: 0.9 * (tw ? 1.3 / 1.5 : 1), dmg, a, pierce: pierce || a.mod === 'drill', t: 0, ang: Math.atan2(vy, vx), ...over });
    };
    // ---- A SPECIAL WITH A WAY OF ITS OWN: its handler does the whole job
    if (a.sp && this.cast(f, i, a, ux, uy, m, dmg, shot)) {
      this.selfMod(f, a);
      return true;
    }
    switch (a.kind) {
      case 'bolt':
        shot(0);
        audio.sfx('throw_whoosh', 0.25);
        break;
      case 'spread':
        for (const k of [-0.26, 0, 0.26]) shot(k);
        audio.sfx('throw_whoosh', 0.3);
        break;
      case 'nova': {
        this.burst(f, f.x, f.y, a.reach * f.scale, dmg, a, 'ring');
        audio.sfx('arcane_blast', 0.4);
        break;
      }
      case 'dash': {
        // ---- TOWARD THEM IS A CHARGE, AWAY IS A GETAWAY (user, 3 Nov).
        // No aiming: the way it is already moving decides.  Walking away
        // from the other one, the dash carries it off that way and hurts
        // nobody; anything else is a charge straight at them.  The AI's
        // dashes follow the same rule off its own movement.
        const o = this.other(f);
        const tx = o.x - f.x;
        const ty = o.y - f.y;
        const tl = Math.hypot(tx, ty) || 1;
        const mvx = f.ref.vx ?? 0;
        const mvy = f.ref.vy ?? 0;
        const mv = Math.hypot(mvx, mvy);
        const flee = mv > 4 && (mvx * tx + mvy * ty) / (mv * tl) < -0.25;
        const dx = flee ? mvx / mv : tx / tl;
        const dy = flee ? mvy / mv : ty / tl;
        f.face = dx >= 0 ? 1 : -1;
        f.dash = { vx: dx * a.reach * mired, vy: dy * a.reach * mired, t: 0.28, dmg: flee ? 0 : dmg, hit: flee, a, flee };
        if (flee) {
          this.floatNum(f, 0, 0xcfe8ff, 'DODGE ');
        } else {
          if (a.sp === 'thunder_charge') f.st.unstop = 0.3;
          if (a.sp === 'hit_and_run' || a.sp === 'sucker_punch') {
            f.ref.retX = f.x;
            f.ref.retY = f.y;
          }
        }
        audio.sfx('throw_whoosh', 0.4);
        break;
      }
      case 'beam': {
        const len = a.reach * f.scale;
        const x2 = f.x + ux * len;
        const y2 = f.y + uy * len;
        // up close it is a bite, a punch, a slash -- whatever this body does;
        // a long beam is still a beam
        if (a.reach < 50) this.fx.push({ kind: 'melee', x: f.x, y: f.y, r: len, t: 0, life: 0.3, col, owner: f, ang: Math.atan2(uy, ux), style: meleeStyle(f.c) });
        else this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2, y2, r: 3, t: 0, life: 0.18, col });
        const o = this.other(f);
        const lineHit = (k: number) => {
          if (this.segDist(o.x, o.y, f.x, f.y, x2, y2) < 6 * o.scale + 2 && (pierce || !this.blocked(f.x, f.y, o.x, o.y, f))) this.hit(f, o, Math.round(dmg * k), a);
        };
        lineHit(1);
        if (a.mod === 'linger') for (const k of [0.35, 0.7, 1]) this.pool(f, f.x + (x2 - f.x) * k, f.y + (y2 - f.y) * k, 9);
        if (a.mod === 'echo') {
          this.time.delayedCall(600, () => {
            if (this.over) return;
            if (a.reach < 50) this.fx.push({ kind: 'melee', x: f.x, y: f.y, r: len, t: 0, life: 0.3, col, owner: f, ang: Math.atan2(uy, ux), style: meleeStyle(f.c) });
            else this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2, y2, r: 2, t: 0, life: 0.18, col });
            lineHit(0.5);
          });
        }
        audio.sfx('arcane_cast', 0.35);
        break;
      }
      case 'mine': {
        const d = Math.min(40, m);
        const mx = Phaser.Math.Clamp(f.x + ux * d, ARENA.x + 4, ARENA.x + ARENA.w - 4);
        const my = Phaser.Math.Clamp(f.y + uy * d, ARENA.y + 4, ARENA.y + ARENA.h - 4);
        // three down at most: the oldest goes
        const own = this.mines.filter((x) => x.owner === f);
        if (own.length >= 3) this.mines.splice(this.mines.indexOf(own[0]), 1);
        this.mines.push({ owner: f, x: mx, y: my, arm: 0.5, life: 8, dmg, a });
        audio.sfx('item_thud', 0.3);
        break;
      }
      case 'shield':
        f.shield = a.reach;
        f.shieldMod = a.mod === 'reflect' || a.mod === 'thorns' ? a.mod : null;
        audio.sfx('heal_up', 0.3);
        break;
      case 'blink': {
        let tx = f.x + ux * a.reach * mired;
        let ty = f.y + uy * a.reach * mired;
        tx = Phaser.Math.Clamp(tx, ARENA.x + 8, ARENA.x + ARENA.w - 8);
        ty = Phaser.Math.Clamp(ty, ARENA.y + 8, ARENA.y + ARENA.h - 8);
        if (!this.props.some((p) => Math.hypot(p.x - tx, p.y - ty) < p.r + 6)) {
          this.fx.push({ kind: 'spark', x: f.x, y: f.y, r: 8, t: 0, life: 0.3, col });
          f.x = tx;
          f.y = ty;
          f.invuln = 0.25;
          this.fx.push({ kind: 'spark', x: f.x, y: f.y, r: 8, t: 0, life: 0.3, col });
          // (a strike: it lands ON you)
          if (a.mod === 'strike') this.burst(f, f.x, f.y, 22, STRIKE_DMG, a, 'boom');
          // (and a glide: nothing touches it for a moment after)
          if (a.sp === 'silent_glide') f.invuln = 0.5;
        }
        audio.sfx('arcane_cast', 0.3);
        break;
      }
      // ---- A LOB.  The only shot in the game that goes OVER cover: it
      // leaves the ground, flies to where you aimed (or as far as it
      // reaches) and bursts there, whether or not anything was in the way.
      case 'arc': {
        const d = Math.min(a.reach * 0.75, m);
        const tx = Phaser.Math.Clamp(f.x + ux * d, ARENA.x + 6, ARENA.x + ARENA.w - 6);
        const ty = Phaser.Math.Clamp(f.y + uy * d, ARENA.y + 6, ARENA.y + ARENA.h - 6);
        this.shots.push({
          owner: f, x: f.x, y: f.y, vx: 0, vy: 0, life: 9, dmg, a, pierce: true, t: 0, ang: 0,
          arc: { sx: f.x, sy: f.y, tx, ty, t: 0, dur: 0.75, r: 16 },
        });
        audio.sfx('throw_whoosh', 0.35);
        break;
      }
      // ---- A SNARE.  It travels like a shot; what it catches cannot move
      // at all for a moment, which is how a slow creature catches a fast one.
      case 'snare': {
        const sp = a.reach;
        this.shots.push({ owner: f, x: f.x + ux * 8 * f.scale, y: f.y + uy * 8 * f.scale, vx: ux * sp, vy: uy * sp, life: 0.9, dmg, a, pierce: a.mod === 'drill', snare: true, t: 0, ang: Math.atan2(uy, ux) });
        audio.sfx('throw_whoosh', 0.3);
        break;
      }
      // ---- AN AURA.  A few seconds of being faster and hitting harder.
      case 'aura':
        f.aura = AURA_S;
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 20 * f.scale, t: 0, life: 0.5, col });
        audio.sfx('heal_up', 0.45);
        break;
      // ---- A MEND.  Health back, and nothing else: you have to make room.
      case 'mend': {
        const back = Math.round(f.max * MEND_FRAC);
        this.heal(f, back);
        const n = text(this, f.x, f.y - 16 * f.scale, `+${back}`, 0x8ae88a).setOrigin(0.5, 1).setDepth(58);
        this.tweens.add({ targets: n, y: n.y - 10, alpha: 0, duration: 700, onComplete: () => n.destroy() });
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 14 * f.scale, t: 0, life: 0.45, col: 0x8ae88a });
        audio.sfx('heal_up', 0.5);
        break;
      }
      // ---- A WALL.  A piece of this place, dropped where you aimed: it
      // stops shots and bodies exactly as the scenery does, and it goes
      // again after a few seconds.
      case 'wall': {
        const spec = WALL_SPECS[a.sp ?? ''] ?? WALL_DEFAULT;
        const d = Math.max(16, Math.min(a.reach, m));
        const wx = Phaser.Math.Clamp(f.x + ux * d, ARENA.x + 12, ARENA.x + ARENA.w - 12);
        const wy = Phaser.Math.Clamp(f.y + uy * d, ARENA.y + 10, ARENA.y + ARENA.h - 10);
        // across the way you are facing, so it is cover and not a post: a
        // short line, a long one, or a screen curved round its maker
        const px = -uy;
        const py = ux;
        const spots: Array<[number, number]> =
          spec.shape === 'curve'
            ? [-2, -1, 0, 1, 2].map((k) => {
                const ang = Math.atan2(uy, ux) + k * 0.42;
                return [f.x + Math.cos(ang) * d, f.y + Math.sin(ang) * d];
              })
            : (spec.shape === 'long' ? [-2, -1, 0, 1, 2] : [-1, 0, 1]).map((k) => [wx + px * k * 9, wy + py * k * 9]);
        const parts: Prop[] = spots
          .map(([x, y]) => ({
            x: Phaser.Math.Clamp(x, ARENA.x + 6, ARENA.x + ARENA.w - 6),
            y: Phaser.Math.Clamp(y, ARENA.y + 6, ARENA.y + ARENA.h - 6),
            r: 6,
            ...(spec.hp ? { hp: spec.hp, maxHp: spec.hp } : {}),
          }))
          .filter((q) => Math.hypot(q.x - this.other(f).x, q.y - this.other(f).y) > 10 * this.other(f).scale)
          // never on its own maker either
          .filter((q) => Math.hypot(q.x - f.x, q.y - f.y) > q.r + BODY_R * f.scale + 2)
          .map((q) => ({ ...q, owner: f }));
        if (parts.length) {
          this.barriers.push({ kind: wallLook(a.sp, f.c.element), parts, seed: 1, life: spec.life, max: spec.life, owner: f, shatter: a.sp === 'glacier_slab' });
          this.props.push(...parts);
          this.repaintCover();
        }
        audio.sfx('item_thud', 0.4);
        break;
      }
    }
    this.selfMod(f, a);
    return true;
  }

  /** What a move's special does for whoever used it. */
  private selfMod(f: Fighter, a: Attack): void {
    switch (a.mod) {
      case 'haste':
        f.haste = HASTE_S;
        break;
      case 'guard':
        f.guard = GUARD_S;
        break;
      case 'regen':
        f.regen = a.kind === 'shield' ? a.reach : REGEN_S;
        break;
      // ---- THE BUFFS: seconds of an edge, said over its head as it starts
      case 'evade':
      case 'focus':
      case 'fury':
      case 'quicken': {
        const BUFF = { evade: [EVADE_S, 'EVASION', 0xb8e8ff], focus: [FOCUS_S, 'FOCUS', 0xffe060], fury: [FURY_S, 'FURY', 0xff7a4a], quicken: [QUICK_S, 'QUICKEN', 0x9aff9a] } as const;
        const [secs, word, col] = BUFF[a.mod];
        f.st[`b_${a.mod}`] = secs;
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 16 * f.scale, t: 0, life: 0.45, col });
        this.floatNum(f, 0, col, `${word} `);
        break;
      }
      case 'cleanse':
        f.burn = f.slow = f.chill = f.root = f.blind = f.poison = f.weak = f.shred = f.stun = 0;
        for (const k of ['sleep', 'cage', 'knock', 'stone', 'slick', 'mired', 'confused', 'omen', 'pollen', 'leash', 'rain', 'n_stacks', 'n_quills']) delete f.st[k];
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 14 * f.scale, t: 0, life: 0.4, col: 0xffffff });
        break;
      default:
        break;
    }
  }

  // ============================================================ THE SPECIALS
  //
  // Every special in game/specials that is more than its kind plus a generic
  // mod has its own case here (its cast) and/or in `onHitSp` (what it does
  // to whoever it hits) and `onLand` (where a lob lands).  `cast` returns
  // false to let the generic kind run (it may still have set something up).

  private cast(f: Fighter, i: number, a: Attack, ux: number, uy: number, m: number, dmg: number, shot: (ang: number, over?: Partial<Shot>) => void): boolean {
    const o = this.other(f);
    const col = ELEMENTS[f.c.element].col;
    const cx = (x: number, pad = 8) => Phaser.Math.Clamp(x, ARENA.x + pad, ARENA.x + ARENA.w - pad);
    const cy = (y: number, pad = 8) => Phaser.Math.Clamp(y, ARENA.y + pad, ARENA.y + ARENA.h - pad);
    /** Where the aim lands, `lo`..`hi` px out. */
    const aimAt = (lo: number, hi: number) => {
      const d = Phaser.Math.Clamp(m, lo, hi);
      return { x: cx(f.x + ux * d), y: cy(f.y + uy * d) };
    };
    const ring = (r: number, c = col) => this.fx.push({ kind: 'ring', x: f.x, y: f.y, r, t: 0, life: 0.4, col: c });
    switch (a.sp) {
      // -------------------------------------------------------------- ember
      case 'lava_flow': {
        // a river poured out ahead: it carries you downstream and burns
        const x2 = cx(f.x + ux * a.reach);
        const y2 = cy(f.y + uy * a.reach);
        this.pools.push({ owner: f, kind: 'flow', x: f.x + ux * 8, y: f.y + uy * 8, x2, y2, r: 9, t: 4, tick: 0 });
        audio.sfx('poison_hiss', 0.4);
        return true;
      }
      case 'molten_skin':
        f.st.molten = 5;
        ring(16, 0xff8a3a);
        audio.sfx('heal_up', 0.4);
        return true;
      case 'ash_burrow': {
        // under, for a second; up again away from trouble, guarded
        f.st.under = 1;
        f.invuln = 1;
        const to = aimAt(30, a.reach);
        this.fx.push({ kind: 'spark', x: f.x, y: f.y, r: 10, t: 0, life: 0.4, col });
        this.time.delayedCall(1000, () => {
          if (this.over || f.hp <= 0) return;
          f.x = to.x;
          f.y = to.y;
          this.step(f, 0, 0, 0.016);
          f.guard = GUARD_S;
          this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 14, t: 0, life: 0.4, col });
          audio.sfx('item_thud', 0.4);
        });
        return true;
      }
      case 'slag_armour':
        f.st.armour = 4;
        ring(14, 0x8a6a5a);
        audio.sfx('item_thud', 0.4);
        return true;
      case 'heat_lance': {
        // the aim is drawn first; it fires down it half a second later
        const len = a.reach;
        this.hazards.push({ kind: 'line', owner: f, x: f.x, y: f.y, x2: f.x + ux * len, y2: f.y + uy * len, r: 4, t: 0.5, t0: 0.5, dmg: 0, go: () => {
          if (this.over || f.hp <= 0) return;
          const x2 = f.x + ux * len;
          const y2 = f.y + uy * len;
          this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2, y2, r: 3, t: 0, life: 0.25, col });
          if (this.segDist(o.x, o.y, f.x, f.y, x2, y2) < 6 * o.scale + 3 && (f.c.element === 'glow' || !this.blocked(f.x, f.y, o.x, o.y, f))) this.hit(f, o, dmg, a);
          audio.sfx('arcane_blast', 0.45);
        } });
        f.root = Math.max(f.root, 0.5);
        return true;
      }
      case 'ember_plumes':
        for (const k of [-0.4, -0.2, 0, 0.2, 0.4]) shot(k);
        audio.sfx('throw_whoosh', 0.3);
        return true;
      // --------------------------------------------------------------- tide
      case 'gulp':
        f.st.gulp = a.reach;
        ring(12, 0x9ad0ff);
        return true;
      case 'rolling_swell':
        this.waves.push({ owner: f, x: f.x, y: f.y, r: 6, max: a.reach, speed: a.reach / 0.6, dmg, done: false, a });
        audio.sfx('splash', 0.5);
        return true;
      case 'urchin_field': {
        const c0 = aimAt(20, 40);
        for (let k = 0; k < 3; k++) {
          const ang = (k / 3) * Math.PI * 2 + Math.random();
          this.mines.push({ owner: f, x: cx(c0.x + Math.cos(ang) * 16), y: cy(c0.y + Math.sin(ang) * 14), arm: 0.5, life: 8, dmg, a });
        }
        const own = this.mines.filter((x) => x.owner === f);
        while (own.length > 6) this.mines.splice(this.mines.indexOf(own.shift()!), 1);
        audio.sfx('item_thud', 0.3);
        return true;
      }
      case 'spine_shed':
      case 'crystal_quills':
        for (let k = 0; k < 8; k++) shot((k / 8) * Math.PI * 2, { life: a.sp === 'crystal_quills' ? 0.45 : 0.6 });
        audio.sfx('throw_whoosh', 0.4);
        return true;
      case 'regrowth':
        f.st.regrow = 5;
        ring(14, 0x8ae88a);
        audio.sfx('heal_up', 0.4);
        return true;
      case 'current_ward':
        f.st.ward = 4;
        ring(18, 0x9ad0ff);
        return true;
      // --------------------------------------------------------------- moss
      case 'bark_hide':
        f.st.n_bark = 3;
        ring(13, 0x8a6a3a);
        audio.sfx('item_thud', 0.3);
        return true;
      case 'honey_slam':
        this.burst(f, f.x, f.y, a.reach * f.scale, dmg, a, 'boom');
        this.pools.push({ owner: f, kind: 'honey', x: f.x, y: f.y, r: 15, t: 4, tick: 0 });
        audio.sfx('item_thud', 0.5);
        return true;
      case 'hibernate':
        f.st.hibernate = 2;
        audio.sfx('heal_up', 0.3);
        return true;
      case 'hive_call':
        for (let k = 0; k < 3; k++) this.minions.push({ owner: f, kind: 'drone', x: f.x, y: f.y, ang: (k / 3) * Math.PI * 2, life: 5, hp: 0, cd: 0 });
        audio.sfx('wings', 0.4);
        return true;
      // -------------------------------------------------------------- frost
      case 'prism_stasis':
        this.stasis = 1;
        ring(40, 0xe8fcff);
        audio.sfx('glass_crack', 0.5);
        return true;
      case 'ice_floe':
        this.pools.push({ owner: f, kind: 'floe', x: f.x, y: f.y, r: 20, t: 5, tick: 0 });
        audio.sfx('glass_crack', 0.4);
        return true;
      case 'war_roar': {
        ring(a.reach, 0xffffff);
        audio.sfx('death_stinger', 0.3);
        if (Math.hypot(o.x - f.x, o.y - f.y) < a.reach + 6 * o.scale) {
          o.aura = o.shield = o.guard = o.haste = o.regen = 0;
          for (const k of ['armour', 'n_bark', 'coil', 'ward', 'curl', 'tailwind', 'molten', 'regrow', 'comet', 'starShell', 'capacitor', 'phase']) delete o.st[k];
          this.floatNum(o, 0, 0xffffff, 'STRIPPED ');
        }
        return true;
      }
      // --------------------------------------------------------------- volt
      case 'wall_cling': {
        // onto the nearest cover, and hang there mending
        let best: Prop | null = null;
        let bd = a.reach;
        for (const p of this.props) {
          const d = Math.hypot(p.x - f.x, p.y - f.y) - p.r;
          if (d < bd) {
            bd = d;
            best = p;
          }
        }
        if (best) {
          const ang = Math.atan2(f.y - best.y, f.x - best.x);
          f.x = cx(best.x + Math.cos(ang) * (best.r + 7 * f.scale));
          f.y = cy(best.y + Math.sin(ang) * (best.r + 7 * f.scale));
        }
        f.st.cling = 3;
        this.fx.push({ kind: 'spark', x: f.x, y: f.y, r: 8, t: 0, life: 0.3, col });
        return true;
      }
      case 'capacitor':
        f.st.capacitor = 4;
        f.st.n_cap = 0;
        ring(14, 0xfff4a0);
        return true;
      // ---------------------------------------------- the audit's new moves (3 Nov)
      case 'smoke_bomb': {
        // a puff of smoke: whoever is near is blinded, and it slips away unseen
        for (let k = 0; k < 6; k++) this.fx.push({ kind: 'ring', x: f.x + Phaser.Math.Between(-8, 8), y: f.y + Phaser.Math.Between(-6, 6), r: 12 + k * 3, t: 0, life: 0.6, col: 0x6a6a78 });
        if (Math.hypot(o.x - f.x, o.y - f.y) < 40 + 6 * o.scale) o.blind = Math.max(o.blind, 2);
        f.st.invis = 1.5;
        const d = Math.hypot(f.x - o.x, f.y - o.y) || 1;
        const to = { x: cx(f.x + ((f.x - o.x) / d) * a.reach), y: cy(f.y + ((f.y - o.y) / d) * a.reach) };
        if (!this.props.some((p) => Math.hypot(p.x - to.x, p.y - to.y) < p.r + 6)) {
          f.x = to.x;
          f.y = to.y;
        }
        audio.sfx('poison_hiss', 0.5);
        return true;
      }
      case 'play_dead': {
        // flops over: untouchable, lost to them, mending -- and the next hit is a mean one
        const back = Math.round(f.max * 0.15);
        this.heal(f, back);
        f.invuln = Math.max(f.invuln, 1.2);
        f.st.invis = 1.2;
        f.root = Math.max(f.root, 1.2);
        f.st.ambush = 2;
        this.floatNum(f, 0, 0x8ae88a, `+${back} `);
        ring(12, 0x8ae88a);
        audio.sfx('item_thud', 0.4);
        return true;
      }
      case 'musk_cloud':
        this.pools.push({ owner: f, kind: 'stink', x: f.x, y: f.y, r: a.reach, t: 4, tick: 0 });
        ring(a.reach, 0x9ab84a);
        audio.sfx('poison_hiss', 0.6);
        return true;
      case 'heat_haze':
        // the shimmer: hits slide off (EVASION, from its mod) and their aim bends
        o.st.n_dazzle = 2;
        ring(18, 0xffc880);
        audio.sfx('wind_gust', 0.3);
        return true;
      case 'blubber':
        f.st.armour = 5;
        f.st.anchor = 5;
        ring(16, 0xc8d8e8);
        audio.sfx('item_thud', 0.4);
        return true;
      case 'submerge':
        f.st.invis = 2.5;
        f.st.sunk = 2.5;
        f.st.n_lurk = 1;
        this.fx.push({ kind: 'ring', x: f.x, y: f.y + 4, r: 14, t: 0, life: 0.5, col: 0x7a8a6a });
        audio.sfx('splash', 0.4);
        return true;
      case 'eel_dive':
        f.st.invis = 2;
        f.st.n_eel = 1;
        this.fx.push({ kind: 'spark', x: f.x, y: f.y, r: 10, t: 0, life: 0.4, col });
        audio.sfx('splash', 0.4);
        return true;
      // -------------------------------------------------------------- stone
      case 'pebble_mortar': {
        // three, landing one after another in a line along the aim
        const d0 = Math.min(a.reach * 0.75, Math.max(40, m));
        [0.45, 0.72, 1].forEach((k, n) => {
          const tx = cx(f.x + ux * d0 * k);
          const ty = cy(f.y + uy * d0 * k);
          this.shots.push({ owner: f, x: f.x, y: f.y, vx: 0, vy: 0, life: 9, dmg, a, pierce: true, t: 0, ang: 0, arc: { sx: f.x, sy: f.y, tx, ty, t: -n * 0.15, dur: 0.6, r: 12 } });
        });
        audio.sfx('throw_whoosh', 0.35);
        return true;
      }
      case 'gravity_rune': {
        const at = aimAt(40, 120);
        this.pools.push({ owner: f, kind: 'rune', x: at.x, y: at.y, r: 10, t: 4, tick: 0 });
        audio.sfx('arcane_cast', 0.4);
        return true;
      }
      case 'geode_curl':
        f.st.curl = 2;
        f.kx = f.ky = 0;
        audio.sfx('crumble', 0.4);
        return true;
      // --------------------------------------------------------------- gale
      case 'dust_devil':
        this.minions.push({ owner: f, kind: 'devil', x: f.x + ux * 12, y: f.y + uy * 12, ang: 0, life: 4, hp: 0, cd: 0 });
        audio.sfx('wind_gust', 0.4);
        return true;
      case 'sleep_dust': {
        const at = aimAt(16, 40);
        const own = this.mines.filter((x) => x.owner === f);
        if (own.length >= 3) this.mines.splice(this.mines.indexOf(own[0]), 1);
        this.mines.push({ owner: f, x: at.x, y: at.y, arm: 0.5, life: 8, dmg: 0, a });
        return true;
      }
      case 'bounding_hops': {
        // a hop now; up to two more inside two seconds, then the cooldown
        if ((f.st.hopT ?? 0) <= 0) {
          f.st.hopT = 2;
          f.st.n_hops = 2;
          f.ref.hopSlot = i;
        } else f.st.n_hops = Math.max(0, (f.st.n_hops ?? 0) - 1);
        const to = { x: cx(f.x + ux * Math.min(a.reach, Math.max(20, m))), y: cy(f.y + uy * Math.min(a.reach, Math.max(20, m))) };
        if (!this.props.some((p) => Math.hypot(p.x - to.x, p.y - to.y) < p.r + 6)) {
          this.fx.push({ kind: 'spark', x: f.x, y: f.y, r: 6, t: 0, life: 0.25, col });
          f.x = to.x;
          f.y = to.y;
        }
        f.cds[i] = (f.st.n_hops ?? 0) > 0 ? 0.2 : a.cd;
        if ((f.st.n_hops ?? 0) <= 0) f.st.hopT = 0;
        audio.sfx('throw_whoosh', 0.25);
        return true;
      }
      case 'mirage_decoy': {
        this.decoy(f);
        const to = { x: cx(f.x + ux * a.reach), y: cy(f.y + uy * a.reach) };
        if (!this.props.some((p) => Math.hypot(p.x - to.x, p.y - to.y) < p.r + 6)) {
          f.x = to.x;
          f.y = to.y;
        }
        return true;
      }
      case 'updraft':
        f.st.air = 1;
        ring(10, 0xf0fff4);
        audio.sfx('wind_gust', 0.5);
        return true;
      case 'dive_bomb': {
        const at = aimAt(30, a.reach * 0.75);
        this.hazards.push({ kind: 'mark', owner: f, x: at.x, y: at.y, r: 20, t: 0.8, t0: 0.8, dmg, go: () => {
          if (this.over || f.hp <= 0) return;
          f.x = at.x;
          f.y = at.y;
          audio.sfx('item_thud', 0.6);
        } });
        f.invuln = 0.8;
        f.st.aloft = 0.8;
        return true;
      }
      case 'tailwind':
        f.st.tailwind = 4;
        ring(12, 0xf0fff4);
        return true;
      // --------------------------------------------------------------- murk
      case 'mycelium_net':
        this.pools.push({ owner: f, kind: 'mycel', x: f.x, y: f.y, r: 30, t: 6, tick: 0 });
        audio.sfx('leaf_rustle', 0.4);
        return true;
      case 'murder':
        for (let k = 0; k < 4; k++) this.minions.push({ owner: f, kind: 'crow', x: o.x, y: o.y, ang: (k / 4) * Math.PI * 2, life: 3, hp: 0, cd: 0.2 + k * 0.09 });
        audio.sfx('crow_caw', 0.5);
        return true;
      case 'shadow_step': {
        // to the far side of them
        const d = Math.hypot(o.x - f.x, o.y - f.y) || 1;
        const tx = cx(o.x + ((o.x - f.x) / d) * 20);
        const ty = cy(o.y + ((o.y - f.y) / d) * 20);
        if (d < a.reach * 1.2 && !this.props.some((p) => Math.hypot(p.x - tx, p.y - ty) < p.r + 6)) {
          this.fx.push({ kind: 'spark', x: f.x, y: f.y, r: 8, t: 0, life: 0.3, col });
          f.x = tx;
          f.y = ty;
          this.fx.push({ kind: 'spark', x: f.x, y: f.y, r: 8, t: 0, life: 0.3, col });
        }
        f.st.crit2 = 2;
        audio.sfx('arcane_cast', 0.4);
        return true;
      }
      case 'phase':
        // the Haunter's trick: it slips into the walls, and a double of it
        // drifts on at them in its place
        f.st.phase = 1.5;
        this.decoy(f);
        return true;
      case 'soul_siphon':
        f.st.siphon = 3;
        audio.sfx('voice_whisper', 0.5);
        return true;
      // --------------------------------------------------------------- glow
      case 'bright_coil':
        f.st.coil = 3;
        ring(12, 0xffffff);
        return true;
      case 'dangling_lure': {
        const at = { x: cx(f.x + ux * 50), y: cy(f.y + uy * 50) };
        this.minions.push({ owner: f, kind: 'lure', x: at.x, y: at.y, ang: 0, life: 4, hp: 0, cd: 0 });
        return true;
      }
      case 'deep_beam':
        f.st.channel = 1.5;
        f.st.n_chAcc = 0;
        f.ref.chAng = Math.atan2(uy, ux);
        f.root = Math.max(f.root, 1.5);
        audio.sfx('arcane_cast', 0.5);
        return true;
      case 'beacon':
        this.pools.push({ owner: f, kind: 'beacon', x: f.x, y: f.y, r: 40, t: 6, tick: 0 });
        return true;
      case 'star_shell':
        f.st.starShell = a.reach;
        f.st.n_stored = 0;
        ring(12, 0xfff0c0);
        return true;
      case 'comet_trail':
        f.st.comet = 5;
        return true;
      // ------------------------------------------------------------- bosses
      case 'raise_husks':
        for (const k of [-1, 1]) this.minions.push({ owner: f, kind: 'husk', x: cx(f.x + k * 20), y: cy(f.y + 14), ang: 0, life: 9, hp: 10, cd: 0 });
        audio.sfx('voice_whisper', 0.6);
        return true;
      case 'halo_prison':
        this.pools.push({ owner: f, kind: 'halo', x: o.x, y: o.y, r: a.reach, t: 4, tick: 0, inside: true });
        audio.sfx('arcane_cast', 0.5);
        return true;
      case 'regrow_head':
        this.heal(f, Math.round(f.max * 0.15));
        this.patternMul = 0.5;
        ring(26, 0x8ae86a);
        audio.sfx('heal_up', 0.6);
        return true;
      case 'brood_clock':
        for (let k = 0; k < 3; k++) this.minions.push({ owner: f, kind: 'spiderling', x: f.x + (k - 1) * 10, y: f.y + 8, ang: 0, life: 6, hp: 0, cd: 0 });
        audio.sfx('voice_robot', 0.5);
        return true;
      case 'devour':
        // the jaws open for a second -- get out of reach -- then shut
        this.hazards.push({ kind: 'mark', owner: f, x: f.x, y: f.y, r: a.reach, t: 1, t0: 1, dmg: 0, go: () => {
          if (this.over || f.hp <= 0) return;
          this.fx.push({ kind: 'boom', x: f.x, y: f.y, r: a.reach, t: 0, life: 0.3, col: 0xc84a5a });
          if (Math.hypot(o.x - f.x, o.y - f.y) < a.reach + 6 * o.scale) {
            const before = o.hp;
            this.hit(f, o, dmg, a);
            this.heal(f, before - o.hp);
          }
          audio.sfx('whack', 0.6);
        } });
        f.root = Math.max(f.root, 1);
        return true;
      // ---- (5 Nov) the five new bosses' own moves
      case 'skyfall': {
        // up out of reach; the shadow follows them; down on the shadow
        f.invuln = Math.max(f.invuln, 1.25);
        f.st.invis = Math.max(f.st.invis ?? 0, 1.2);
        const mark: Hazard = { kind: 'mark', x: o.x, y: o.y, r: 18, t: 1.2, t0: 1.2, dmg: a.dmg, owner: f, seek: 46, go: () => {
          if (this.over || f.hp <= 0) return;
          f.x = cx(mark.x);
          f.y = cy(mark.y);
          f.st.invis = 0;
          this.cameras.main.shake(140, 0.006);
        } };
        this.hazards.push(mark);
        audio.sfx('wind_gust', 0.6);
        return true;
      }
      case 'piston_punch': {
        // a line out at them, then the fist down it
        const len = a.reach;
        this.hazards.push({ kind: 'line', x: f.x, y: f.y, x2: cx(f.x + ux * len), y2: cy(f.y + uy * len), r: 7, t: 0.5, t0: 0.5, dmg: a.dmg, owner: f, go: () => {
          if (this.segDist(o.x, o.y, f.x, f.y, f.x + ux * len, f.y + uy * len) < 11) {
            o.kx += ux * 340;
            o.ky += uy * 340;
          }
          audio.sfx('item_thud', 0.6);
        } });
        return true;
      }
      case 'foresight': {
        // where they will be in a second
        const v = o === this.me ? this.meV : { x: 0, y: 0 };
        this.hazards.push({ kind: 'mark', x: cx(o.x + v.x), y: cy(o.y + v.y), r: 16, t: 1.0, t0: 1.0, dmg: a.dmg, owner: f });
        audio.sfx('chime', 0.5);
        return true;
      }
      case 'hail_ring':
        f.st.hail = a.reach;
        f.st.n_hail = 6;
        audio.sfx('glass_crack', 0.4);
        return true;
      case 'tail_sweep': {
        // a half circle in front of it, thrown back
        const fa = Math.atan2(o.y - f.y, o.x - f.x);
        for (let k = 0; k <= 6; k++) {
          const sa = fa - Math.PI / 2 + (k / 6) * Math.PI;
          this.fx.push({ kind: 'spark', x: f.x + Math.cos(sa) * a.reach * 0.8, y: f.y + Math.sin(sa) * a.reach * 0.8, r: 4, t: 0, life: 0.3, col });
        }
        if (Math.hypot(o.x - f.x, o.y - f.y) < a.reach + 6 * o.scale) {
          this.hit(f, o, dmg, a);
          o.kx += ux * 300;
          o.ky += uy * 300;
        }
        audio.sfx('throw_whoosh', 0.6);
        return true;
      }
      case 'storm_eye':
        f.st.eye = 4;
        audio.sfx('wind_gust', 0.6);
        return true;
      case 'cave_in':
        this.caveIn = { owner: f, t: 6, tick: 0 };
        audio.sfx('crumble', 0.7);
        return true;
      case 'mirror_riddle': {
        // ---- THE RIDDLE (user, 5 Nov: in place of the mirror copies).  Three
        // glyphs ring the other one; only one is the truth -- the eye.  Be
        // standing in it when the riddle closes, or answer for it: the hit,
        // every move set back, and a moment frozen.  It moves them where the
        // sphinx wants them -- usually straight down its pounce line.
        const base = Math.random() * Math.PI * 2;
        const truth = Math.floor(Math.random() * 3);
        const T = 2.2;
        const R = 11;
        for (let k = 0; k < 3; k++) {
          const px = cx(o.x + Math.cos(base + (k * Math.PI * 2) / 3) * 28);
          const py = cy(o.y + Math.sin(base + (k * Math.PI * 2) / 3) * 22);
          const right = k === truth;
          this.hazards.push({ kind: 'mark', x: px, y: py, r: R, t: T, t0: T, dmg: 0, owner: f, riddle: right ? 'true' : 'false', go: right ? () => {
            if (this.over || f.hp <= 0 || o.hp <= 0) return;
            if (Math.hypot(o.x - px, o.y - py) <= R + 3) {
              const n = centerText(this, o.x, o.y - 18, 'SOLVED', 0xfff4a0).setDepth(60);
              this.tweens.add({ targets: n, y: n.y - 8, alpha: 0, duration: 700, onComplete: () => n.destroy() });
              return;
            }
            this.hit(f, o, dmg, a);
            for (let i = 0; i < 3; i++) o.cds[i] += SILENCE_S;
            o.stun = Math.max(o.stun, 0.6);
            this.fx.push({ kind: 'ring', x: o.x, y: o.y, r: 14, t: 0, life: 0.4, col: 0xfff4a0 });
            audio.sfx('glass_crack', 0.6);
          } : undefined });
        }
        audio.sfx('chime', 0.6);
        return true;
      }
      case 'ink_blackout':
        o.blind = Math.max(o.blind, 3);
        o.st.ink = 3;
        audio.sfx('splash', 0.6);
        return true;
      case 'glacier_drift':
        this.pools.push({ owner: f, kind: 'drift', x: f.x, y: f.y, r: a.reach, t: 4, tick: 0 });
        audio.sfx('glass_crack', 0.6);
        return true;
      default:
        return false;
    }
  }

  /** What a special does to whoever it hits, after the damage. */
  private onHitSp(from: Fighter, to: Fighter, a: Attack): void {
    const away = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const ux = (to.x - from.x) / away;
    const uy = (to.y - from.y) / away;
    const dash = from.dash;
    switch (a.sp) {
      case 'bellows':
        to.kx += (dash ? dash.vx / (Math.hypot(dash.vx, dash.vy) || 1) : ux) * 260;
        to.ky += (dash ? dash.vy / (Math.hypot(dash.vx, dash.vy) || 1) : uy) * 260;
        to.st.slam = 0.6;
        break;
      case 'ember_plumes':
        to.st.n_stacks = Math.min(5, (to.st.n_stacks ?? 0) + 1);
        to.st.stackT = 4;
        break;
      case 'tongue_lash': {
        // yanked forty pixels closer, now
        const k = Math.min(40, away - 10 * (to.scale + from.scale));
        if (k > 0) {
          to.x -= ux * k;
          to.y -= uy * k;
          this.step(to, 0, 0, 0.016);
        }
        break;
      }
      case 'bubble_cage':
        to.st.cage = 1;
        break;
      case 'urchin_field':
        to.root = Math.max(to.root, HOLD_S);
        break;
      case 'slick_spit':
        to.st.slick = 3;
        break;
      case 'riptide_dash':
        if (dash) {
          to.st.carried = dash.t;
          to.ref.carrier = from;
        }
        break;
      case 'sneeze_spores':
        to.st.n_sneeze = 1;
        break;
      case 'antler_rush':
        to.root = Math.max(to.root, 1);
        break;
      case 'vine_leash':
        to.st.leash = 3;
        to.ref.leash = from;
        break;
      case 'pollinate':
        to.st.pollen = 4;
        break;
      case 'cold_tether':
        to.chill = ROOT_S + CHILL_S;
        break;
      case 'ram_charge':
        to.stun = Math.max(to.stun, 0.6);
        break;
      case 'hoof_stamp':
        // whatever they were winding up or charging into, it stops
        to.dash = null;
        to.st.channel = 0;
        break;
      case 'web_mine':
        to.root = Math.max(to.root, ROOT_S);
        break;
      case 'static_steal': {
        let k = 0;
        for (let n = 1; n < 3; n++) if (from.cds[n] > from.cds[k]) k = n;
        from.cds[k] = 0;
        for (let n = 0; n < 3; n++) to.cds[n] += 2;
        break;
      }
      case 'spark_chain':
        this.time.delayedCall(400, () => {
          if (this.over || to.hp <= 0) return;
          this.fx.push({ kind: 'beam', x: to.x, y: ARENA.y, x2: to.x, y2: to.y, r: 2, t: 0, life: 0.2, col: 0xfff4a0 });
          this.hit(from, to, Math.round(a.dmg * 0.7), null);
          audio.sfx('arcane_blast', 0.3);
        });
        break;
      case 'thunder_charge':
        if (!to.st.unstop) to.stun = Math.max(to.stun, 0.5);
        break;
      case 'horn_toss': {
        // over its back: they land behind it
        const dx = dash ? dash.vx : ux;
        const dy = dash ? dash.vy : uy;
        const m = Math.hypot(dx, dy) || 1;
        to.x = Phaser.Math.Clamp(from.x - (dx / m) * 40, ARENA.x + 8, ARENA.x + ARENA.w - 8);
        to.y = Phaser.Math.Clamp(from.y - (dy / m) * 40, ARENA.y + 8, ARENA.y + ARENA.h - 8);
        this.step(to, 0, 0, 0.016);
        to.stun = Math.max(to.stun, 0.3);
        break;
      }
      case 'roll_out':
        to.st.knock = 0.6;
        break;
      case 'petrify_gaze':
        to.st.stone = 1;
        break;
      case 'crystal_quills':
        to.st.n_quills = (to.st.n_quills ?? 0) + 1;
        to.st.quillT = 4;
        break;
      case 'sleep_dust':
        to.st.sleep = 1.2;
        break;
      case 'mire_glob':
        to.st.mired = 4;
        break;
      case 'echo_shriek':
        to.st.confused = 1.5;
        break;
      case 'hit_and_run':
      case 'sucker_punch':
        if (dash) dash.back = true;
        break;
      case 'ill_omen':
        to.st.omen = 5;
        break;
      case 'pounce_pin':
        to.root = Math.max(to.root, 1);
        for (const k of [1, 2, 3]) this.time.delayedCall(k * 300, () => !this.over && to.hp > 0 && this.hit(from, to, a.dmg, null));
        break;
      case 'dazzle':
        to.st.n_dazzle = 2;
        break;
      case 'ink_cloud':
        to.blind = Math.max(to.blind, 2);
        to.slow = Math.max(to.slow, 3);
        break;
      case 'rut_bellow':
        if (!to.st.unstop) to.stun = Math.max(to.stun, 0.4);
        to.weak = Math.max(to.weak, 1.5);
        break;
      default:
        break;
    }
  }

  /** A lob coming down: what some of them leave behind. */
  private onLand(f: Fighter, x: number, y: number, a: Attack): void {
    const o = this.other(f);
    if (a.sp === 'crag_lob' && !this.props.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + 8) && Math.hypot(o.x - x, o.y - y) > 12 && Math.hypot(f.x - x, f.y - y) > 12) {
      const part = { x, y, r: 7, hp: PILLAR.hp, maxHp: PILLAR.hp };
      this.barriers.push({ kind: 'rock', parts: [part], seed: 3, life: PILLAR.life, max: PILLAR.life, owner: f });
      this.props.push(part);
      this.repaintCover();
    }
    // a direct hit with the boulder: encased
    if (a.sp === 'ice_boulder' && Math.hypot(o.x - x, o.y - y) < 10 * o.scale) o.stun = Math.max(o.stun, 0.8);
  }

  /** Where the body is drawn, off its true spot, for its step and its lunge. */
  private bodyMotion(f: Fighter): { ox: number; oy: number; k: number } {
    let ox = 0;
    let oy = 0;
    let k = 1;
    if (f.moving && !f.atk) {
      const ph = f.stride;
      // up on each step (two a stride), leaning into the way it is going
      oy -= Math.abs(Math.sin(ph * Math.PI)) * 1.4 * f.scale;
      ox += f.face * 0.6 * f.scale;
    }
    if (f.atk > 0) {
      const p = 1 - f.atk / ATK_T; // 0 -> 1 over the lunge
      // back for the first fifth, out hard to the peak, then home again
      const d = p < 0.2 ? -(p / 0.2) * 1.5 : p < 0.45 ? -1.5 + ((p - 0.2) / 0.25) * 5.5 : 4 * (1 - (p - 0.45) / 0.55);
      ox += f.atkX * d * f.scale;
      oy += f.atkY * d * f.scale * 0.7;
      k = 1 + (p > 0.25 && p < 0.6 ? 0.08 : 0);
    }
    return { ox: Math.round(ox), oy: Math.round(oy), k };
  }

  /** The step and lunge clocks, and the dust each footfall kicks up. */
  private tickMotion(f: Fighter, dt: number): void {
    if (f.atk > 0) f.atk = Math.max(0, f.atk - dt);
    if (!f.moving) {
      f.stride = 0;
      return;
    }
    const before = Math.floor(f.stride * 2);
    f.stride += dt * (f.c.speed / 28);
    if (Math.floor(f.stride * 2) !== before && !f.st.air && !f.st.aloft && !f.st.under) {
      this.fx.push({ kind: 'boom', x: f.x - f.face * 3 * f.scale, y: f.y + 6 * f.scale, r: 3, t: 0, life: 0.3, col: this.biome.groundDark });
    }
  }

  /** Can it act at all (attack, or walk)? */
  private canAct(f: Fighter): boolean {
    return f.stun <= 0 && !f.st.sleep && !f.st.cage && !f.st.knock && !f.st.hibernate && !f.st.stone && !f.st.under && !f.st.channel && !f.st.u_banish;
  }

  /** Health back -- halved on someone cursed with an ill omen. */
  private heal(f: Fighter, n: number): void {
    if (n <= 0 || f.hp <= 0) return;
    f.hp = Math.min(f.max, f.hp + n * (f.st.omen ? 0.5 : 1));
  }

  /**
   * Everything the specials keep doing while they last: the timers, the
   * ticking damage and healing, the zones, the minions, the waves, the
   * channelled beam, the tether, the storm's pull and the falling rocks.
   */
  private tickSpecials(f: Fighter, dt: number): void {
    const o = this.other(f);
    const prevHop = f.st.hopT ?? 0;
    const prevCap = f.st.capacitor ?? 0;
    const prevStar = f.st.starShell ?? 0;
    const prevAir = f.st.air ?? 0;
    for (const k of Object.keys(f.st)) if (!k.startsWith('n_')) f.st[k] = Math.max(0, f.st[k] - dt);
    // (a hop chain left unfinished still owes its cooldown)
    if (prevHop > 0 && !f.st.hopT && (f.st.n_hops ?? 0) > 0 && f.ref.hopSlot !== undefined) {
      f.cds[f.ref.hopSlot] = f.c.attacks[f.ref.hopSlot].cd;
      f.st.n_hops = 0;
    }
    if (prevCap > 0 && !f.st.capacitor && (f.st.n_cap ?? 0) > 0) {
      const a = f.c.attacks.find((x) => x.sp === 'capacitor')!;
      this.burst(f, f.x, f.y, 50, 3 * f.st.n_cap, { ...a, mod: 'none' }, 'ring');
      f.st.n_cap = 0;
      audio.sfx('arcane_blast', 0.5);
    }
    if (prevStar > 0 && !f.st.starShell && (f.st.n_stored ?? 0) > 0) {
      const a = f.c.attacks.find((x) => x.sp === 'star_shell')!;
      this.burst(f, f.x, f.y, 40, Math.min(40, Math.round(f.st.n_stored)), { ...a, mod: 'none' }, 'ring');
      f.st.n_stored = 0;
      audio.sfx('arcane_blast', 0.5);
    }
    if (prevAir > 0 && !f.st.air) {
      const a = f.c.attacks.find((x) => x.sp === 'updraft')!;
      this.burst(f, f.x, f.y, 30, a.dmg, { ...a, mod: 'push' }, 'ring');
    }
    if (f.st.hibernate) this.heal(f, f.max * 0.175 * dt);
    if (f.st.regrow) this.heal(f, 4 * (f.moving ? 1 : 2) * dt);
    if (f.st.cling) {
      if (f.moving) f.st.cling = 0;
      else this.heal(f, 3 * dt);
    }
    // burn stacks and quills: a point a second for each
    if (!f.st.stackT) f.st.n_stacks = 0;
    if (!f.st.quillT) f.st.n_quills = 0;
    const dot = (f.st.n_stacks ?? 0) + (f.st.n_quills ?? 0);
    if (dot > 0 && f.hp > 0) {
      f.st.n_dotAcc = (f.st.n_dotAcc ?? 0) + dot * dt;
      if (f.st.n_dotAcc >= 1) {
        const n = Math.floor(f.st.n_dotAcc);
        f.st.n_dotAcc -= n;
        f.hp = Math.max(0, f.hp - n);
      }
    }
    // molten skin: touching it burns
    if (f.st.molten && Math.hypot(o.x - f.x, o.y - f.y) < 8 * (o.scale + f.scale) && !f.st.moltenCd) {
      this.hit(f, o, 4, null);
      o.burn = Math.max(o.burn, 3);
      f.st.moltenCd = 0.5;
    }
    // a curled geode rolls at them, and hurts on contact
    if (f.st.curl) {
      f.kx = f.ky = 0;
      if (Math.hypot(o.x - f.x, o.y - f.y) < 8 * (o.scale + f.scale) && !f.st.curlCd) {
        this.hit(f, o, 6, null);
        f.st.curlCd = 0.5;
      }
    }
    // carried along behind a riptide
    if (f.st.carried && f.ref.carrier) {
      const c = f.ref.carrier;
      const v = c.dash ? Math.hypot(c.dash.vx, c.dash.vy) || 1 : 1;
      f.x = c.x + (c.dash ? (c.dash.vx / v) * 10 : 0);
      f.y = c.y + (c.dash ? (c.dash.vy / v) * 10 : 0);
    }
    // a leash: never further than 60px from whoever tied it
    if (f.st.leash && f.ref.leash) {
      const l = f.ref.leash;
      const d = Math.hypot(f.x - l.x, f.y - l.y);
      if (d > 60) {
        f.x = l.x + ((f.x - l.x) / d) * 60;
        f.y = l.y + ((f.y - l.y) / d) * 60;
      }
    }
    // the soul tether: four a second, theirs to yours, while near
    if (f.st.siphon && Math.hypot(o.x - f.x, o.y - f.y) < 100 && o.hp > 0) {
      f.st.n_sip = (f.st.n_sip ?? 0) + 4 * dt;
      if (f.st.n_sip >= 1) {
        const n = Math.floor(f.st.n_sip);
        f.st.n_sip -= n;
        if (!o.st.cage) {
          o.hp = Math.max(0, o.hp - n);
          this.heal(f, n);
        }
      }
    }
    // the held beam: it turns slowly after them, harder the longer it holds
    if (f.st.channel && f.ref.chAng !== undefined) {
      const want = Math.atan2(o.y - f.y, o.x - f.x);
      let d = Math.atan2(Math.sin(want - f.ref.chAng), Math.cos(want - f.ref.chAng));
      d = Phaser.Math.Clamp(d, -1.4 * dt, 1.4 * dt);
      f.ref.chAng += d;
      const a = f.c.attacks.find((x) => x.sp === 'deep_beam')!;
      const len = a.reach;
      const x2 = f.x + Math.cos(f.ref.chAng) * len;
      const y2 = f.y + Math.sin(f.ref.chAng) * len;
      this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2, y2, r: 2, t: 0, life: dt * 1.5, col: ELEMENTS[f.c.element].col });
      if (this.segDist(o.x, o.y, f.x, f.y, x2, y2) < 6 * o.scale + 2) {
        const ramp = 1 + 2 * (1 - f.st.channel / 1.5);
        f.st.n_chAcc = (f.st.n_chAcc ?? 0) + a.dmg * ramp * dt;
        if (f.st.n_chAcc >= 2) {
          const n = Math.floor(f.st.n_chAcc);
          f.st.n_chAcc -= n;
          this.hit(f, o, n, null);
        }
      }
    }
    // the storm's eye: in towards it, through the rain
    if (f.st.eye && o.hp > 0) {
      const d = Math.hypot(f.x - o.x, f.y - o.y) || 1;
      o.kx += ((f.x - o.x) / d) * 90 * dt;
      o.ky += ((f.y - o.y) / d) * 90 * dt;
      o.st.rain = 0.2;
    }
    // a comet: it drops its trail as it goes
    if (f.st.comet) {
      f.st.n_trailT = (f.st.n_trailT ?? 0) - dt;
      if (f.st.n_trailT <= 0) {
        f.st.n_trailT = 0.1;
        this.pools.push({ owner: f, kind: 'trail', x: f.x, y: f.y + 5, r: 6, t: 5, tick: 0 });
      }
    }
  }

  /**
   * A DECOY THAT FOOLS EVERYONE (user, 28 Oct).  It is drawn exactly as its
   * maker is -- the same body, the same facing, the same health bar over it,
   * no glow -- and one puff of smoke covers the swap, so neither the
   * computer nor the player watching can tell which is which.  It walks on
   * at them as its maker would, while the real one goes its own way; it
   * pops in a puff when its time is up or it is hit.
   */
  private decoy(f: Fighter): void {
    this.minions.push({ owner: f, kind: 'decoy', x: f.x, y: f.y, ang: f.face, life: 3, hp: 6, cd: 0 });
    this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 12 * f.scale, t: 0, life: 0.35, col: 0xd8d8e0 });
    audio.sfx('throw_whoosh', 0.3);
  }

  /** Where your auto-aim goes: a live decoy nearer you than the real one takes the shot. */
  private aimAt(): Fighter | { x: number; y: number } {
    const fake = this.minions.find((mi) => mi.kind === 'decoy' && mi.owner === this.foe && mi.life > 0);
    if (!fake) return this.foe;
    const dReal = Math.hypot(this.foe.x - this.me.x, this.foe.y - this.me.y);
    const dFake = Math.hypot(fake.x - this.me.x, fake.y - this.me.y);
    return dFake < dReal ? fake : this.foe;
  }

  /** The things moves brought into the arena, doing what they do. */
  private tickMinions(dt: number): void {
    for (const mi of this.minions) {
      mi.life -= dt;
      mi.cd = Math.max(0, mi.cd - dt);
      const o = this.other(mi.owner);
      const toO = Math.hypot(o.x - mi.x, o.y - mi.y) || 1;
      const touching = toO < 6 + 6 * o.scale;
      const chase = (sp: number) => {
        mi.x += ((o.x - mi.x) / toO) * sp * dt;
        mi.y += ((o.y - mi.y) / toO) * sp * dt;
      };
      switch (mi.kind) {
        case 'decoy':
          // on at them, at a walk, facing them, the way its maker would
          if (toO > 30) chase(this.speedOf(mi.owner) * 0.6);
          mi.ang = o.x >= mi.x ? 1 : -1;
          if (mi.life <= 0 || mi.hp <= 0) this.fx.push({ kind: 'ring', x: mi.x, y: mi.y, r: 10, t: 0, life: 0.3, col: 0xd8d8e0 });
          break;
        case 'drone':
          // round and round its owner, stinging what it brushes
          mi.ang += 3.2 * dt;
          mi.x = mi.owner.x + Math.cos(mi.ang) * 18;
          mi.y = mi.owner.y + Math.sin(mi.ang) * 14;
          if (Math.hypot(o.x - mi.x, o.y - mi.y) < 8 * o.scale && !mi.cd) {
            mi.cd = 0.5;
            this.hit(mi.owner, o, 3, null);
          }
          break;
        case 'devil':
          chase(42);
          mi.ang += 12 * dt;
          if (touching && !mi.cd) {
            mi.cd = 0.6;
            this.hit(mi.owner, o, 3, null);
          }
          break;
        case 'crow':
          // round them, pecking each time it passes through
          mi.ang += 5 * dt;
          mi.x = o.x + Math.cos(mi.ang) * 12;
          mi.y = o.y + Math.sin(mi.ang) * 9;
          if (!mi.cd) {
            mi.cd = (Math.PI * 2) / 5;
            this.hit(mi.owner, o, mi.dmg ?? 2, null);
          }
          break;
        case 'husk':
          chase(28);
          if (touching) {
            mi.life = 0;
            this.fx.push({ kind: 'boom', x: mi.x, y: mi.y, r: 14, t: 0, life: 0.35, col: 0x8affc0 });
            this.hit(mi.owner, o, mi.dmg ?? 12, null);
            audio.sfx('arcane_blast', 0.4);
          }
          break;
        case 'spiderling':
          if (mi.latched) {
            mi.x = o.x + Math.cos(mi.ang) * 5;
            mi.y = o.y + Math.sin(mi.ang) * 4;
          } else {
            chase(70);
            if (touching) {
              mi.latched = true;
              mi.ang = Math.random() * Math.PI * 2;
            }
          }
          break;
        // ---- AN ULTIMATE'S OWN
        case 'biter':
          // a fast hunter: on at them, and biting while it touches
          if (!touching) chase(78);
          mi.ang = o.x >= mi.x ? 1 : -1;
          if (touching && !mi.cd) {
            mi.cd = 0.6;
            this.hit(mi.owner, o, mi.dmg ?? 3, null);
          }
          break;
        case 'turret':
          // stands where it was built, and shoots at them
          if (!mi.cd) {
            mi.cd = 0.9;
            const ang = Math.atan2(o.y - mi.y, o.x - mi.x);
            const a = { ...mi.owner.c.attacks[0], kind: 'bolt' as const, sp: undefined, mod: 'none' as const };
            this.shots.push({ owner: mi.owner, x: mi.x + Math.cos(ang) * 5, y: mi.y + Math.sin(ang) * 5, vx: Math.cos(ang) * 190, vy: Math.sin(ang) * 190, life: 1.2, dmg: mi.dmg ?? 4, a, pierce: false, t: 0, ang });
          }
          break;
        case 'totem':
          // heals its maker while it stays near
          if (!mi.cd) {
            mi.cd = 0.5;
            if (Math.hypot(mi.owner.x - mi.x, mi.owner.y - mi.y) < 50) {
              this.heal(mi.owner, (mi.hps ?? 3) / 2);
              this.fx.push({ kind: 'ring', x: mi.owner.x, y: mi.owner.y, r: 8 * mi.owner.scale, t: 0, life: 0.3, col: 0x8ae88a });
            }
          }
          break;
        case 'blade':
          // round its maker, close, cutting what it passes through
          mi.ang += 5.5 * dt;
          mi.x = mi.owner.x + Math.cos(mi.ang) * 20 * mi.owner.scale;
          mi.y = mi.owner.y + Math.sin(mi.ang) * 15 * mi.owner.scale;
          if (Math.hypot(o.x - mi.x, o.y - mi.y) < 8 * o.scale && !mi.cd) {
            mi.cd = 0.4;
            this.hit(mi.owner, o, mi.dmg ?? 4, null);
          }
          break;
        case 'twister':
          // drifts after them; on them, it hurts and holds them back
          chase(52);
          mi.ang += 14 * dt;
          if (toO < 12 + 5 * o.scale) {
            o.slow = Math.max(o.slow, 0.3);
            if (!mi.cd) {
              mi.cd = 0.5;
              this.hit(mi.owner, o, mi.dmg ?? 3, null);
            }
          }
          break;
        case 'ball': {
          // round the arena off the walls; running into them knocks them aside
          mi.x += (mi.vx ?? 0) * dt;
          mi.y += (mi.vy ?? 0) * dt;
          if (mi.x < ARENA.x + 7 || mi.x > ARENA.x + ARENA.w - 7) mi.vx = -(mi.vx ?? 0);
          if (mi.y < ARENA.y + 7 || mi.y > ARENA.y + ARENA.h - 7) mi.vy = -(mi.vy ?? 0);
          mi.x = Phaser.Math.Clamp(mi.x, ARENA.x + 7, ARENA.x + ARENA.w - 7);
          mi.y = Phaser.Math.Clamp(mi.y, ARENA.y + 7, ARENA.y + ARENA.h - 7);
          mi.ang += 10 * dt;
          if (toO < 9 + 6 * o.scale && !mi.cd) {
            mi.cd = 0.5;
            this.hit(mi.owner, o, mi.dmg ?? 8, null);
            const sp = Math.hypot(mi.vx ?? 0, mi.vy ?? 0) || 1;
            o.kx += ((mi.vx ?? 0) / sp) * 220;
            o.ky += ((mi.vy ?? 0) / sp) * 220;
            this.fx.push({ kind: 'boom', x: o.x, y: o.y, r: 9, t: 0, life: 0.25, col: ELEMENTS[mi.owner.c.element].light });
          }
          break;
        }
        case 'flower':
          // walk over it, its maker, and it heals you
          if (Math.hypot(mi.owner.x - mi.x, mi.owner.y - mi.y) < 9 * mi.owner.scale) {
            mi.life = 0;
            this.heal(mi.owner, mi.hps ?? 8);
            this.floatNum(mi.owner, mi.hps ?? 8, 0x8ae88a, '+');
            this.fx.push({ kind: 'ring', x: mi.x, y: mi.y, r: 8, t: 0, life: 0.3, col: 0xffa0d0 });
          }
          break;
        case 'pylon':
          // every second, a pulse of its ring
          if (!mi.cd) {
            mi.cd = 1;
            this.fx.push({ kind: 'ring', x: mi.x, y: mi.y, r: 26, t: 0, life: 0.35, col: ELEMENTS[mi.owner.c.element].light });
            if (Math.hypot(o.x - mi.x, o.y - mi.y) < 26 + 5 * o.scale) this.hit(mi.owner, o, mi.dmg ?? 5, null);
          }
          break;
        case 'mirror': {
          // keeps near its maker, off to one side, and shoots at them
          const tx = mi.owner.x + Math.cos(mi.ang) * 24;
          const ty = mi.owner.y + Math.sin(mi.ang) * 18;
          mi.x += (tx - mi.x) * Math.min(1, dt * 4);
          mi.y += (ty - mi.y) * Math.min(1, dt * 4);
          if (!mi.cd) {
            mi.cd = 1;
            const ang = Math.atan2(o.y - mi.y, o.x - mi.x);
            const a = { ...mi.owner.c.attacks[0], kind: 'bolt' as const, sp: undefined, mod: 'none' as const };
            this.shots.push({ owner: mi.owner, x: mi.x, y: mi.y, vx: Math.cos(ang) * 200, vy: Math.sin(ang) * 200, life: 1.1, dmg: mi.dmg ?? 4, a, pierce: false, t: 0, ang });
          }
          break;
        }
        case 'orb':
          // drifts after them, zapping at range
          chase(30);
          mi.ang += 8 * dt;
          if (!mi.cd && toO < 70) {
            mi.cd = 0.6;
            this.fx.push({ kind: 'beam', x: mi.x, y: mi.y, x2: o.x, y2: o.y, r: 1.5, t: 0, life: 0.15, col: 0xfff4a0 });
            this.hit(mi.owner, o, mi.dmg ?? 5, null);
          }
          break;
        case 'tentacle':
          // rooted where it rose; reach it and it grabs
          mi.ang += 4 * dt;
          if (!mi.cd && toO < 14 + 5 * o.scale) {
            mi.cd = 0.5;
            if (!o.st.unstop) o.root = Math.max(o.root, 0.35);
            this.hit(mi.owner, o, mi.dmg ?? 4, null);
          }
          break;
        case 'doll':
          // walks at them, and blows up when it gets there
          if (toO > 12) chase(this.speedOf(mi.owner) * 0.7 + 10);
          mi.ang = o.x >= mi.x ? 1 : -1;
          if (toO < 13 + 4 * o.scale) {
            mi.life = 0;
            this.fx.push({ kind: 'boom', x: mi.x, y: mi.y, r: 20, t: 0, life: 0.4, col: 0xffb040 });
            this.cameras.main.shake(120, 0.005);
            this.hit(mi.owner, o, mi.dmg ?? 30, null);
            audio.sfx('boom', 0.6);
          }
          break;
        case 'shade':
          // their own shadow, hunting them -- (user, 5 Nov: the Deep Wyrm's
          // was unescapable) it rises for a second first, then follows
          // slower than they can run, so running away works
          mi.t = (mi.t ?? 0) + dt;
          if (mi.t < 1) break;
          chase(this.speedOf(o) * 0.7);
          mi.ang = o.x >= mi.x ? 1 : -1;
          if (touching && !mi.cd) {
            mi.cd = 0.6;
            this.hit(mi.owner, o, mi.dmg ?? 5, null);
          }
          break;
        case 'snowball':
        case 'rock': {
          // rolls straight on; a snowball grows as it goes
          mi.x += (mi.vx ?? 0) * dt;
          mi.y += (mi.vy ?? 0) * dt;
          mi.ang += 9 * dt;
          if (mi.kind === 'snowball') mi.size = Math.min(2, (mi.size ?? 1) + dt * 0.8);
          const r = (mi.kind === 'snowball' ? 5 * (mi.size ?? 1) : 6) + 5 * o.scale;
          if (Math.hypot(o.x - mi.x, o.y - mi.y) < r) {
            mi.life = 0;
            const sp = Math.hypot(mi.vx ?? 0, mi.vy ?? 0) || 1;
            this.hit(mi.owner, o, Math.round((mi.dmg ?? 12) * (mi.kind === 'snowball' ? mi.size ?? 1 : 1)), null);
            o.kx += ((mi.vx ?? 0) / sp) * 260;
            o.ky += ((mi.vy ?? 0) / sp) * 260;
            if (mi.kind === 'rock') o.stun = Math.max(o.stun, 0.3);
            this.fx.push({ kind: 'boom', x: mi.x, y: mi.y, r: 10, t: 0, life: 0.3, col: mi.kind === 'snowball' ? 0xffffff : 0xd0c4a8 });
          }
          if (mi.x < ARENA.x - 10 || mi.x > ARENA.x + ARENA.w + 10 || mi.y < ARENA.y - 10 || mi.y > ARENA.y + ARENA.h + 10) mi.life = 0;
          break;
        }
        case 'glaive': {
          // out past them, then back to its maker
          mi.t = (mi.t ?? 0) + dt;
          if (mi.t > 0.6) {
            const dx = mi.owner.x - mi.x;
            const dy = mi.owner.y - mi.y;
            const dd = Math.hypot(dx, dy) || 1;
            mi.vx = (dx / dd) * 230;
            mi.vy = (dy / dd) * 230;
            if (dd < 10) mi.life = 0;
          }
          mi.x += (mi.vx ?? 0) * dt;
          mi.y += (mi.vy ?? 0) * dt;
          mi.ang += 16 * dt;
          if (!mi.cd && toO < 10 + 5 * o.scale) {
            mi.cd = 0.35;
            this.hit(mi.owner, o, mi.dmg ?? 12, null);
          }
          break;
        }
        case 'lure':
          // close enough to it, and you are reeled in
          if (Math.hypot(o.x - mi.x, o.y - mi.y) < 15 + 4 * o.scale) {
            const d = Math.hypot(mi.owner.x - o.x, mi.owner.y - o.y) || 1;
            o.kx += ((mi.owner.x - o.x) / d) * 320;
            o.ky += ((mi.owner.y - o.y) / d) * 320;
            mi.life = 0;
            audio.sfx('throw_whoosh', 0.5);
          }
          break;
        default:
          break;
      }
    }
    this.minions = this.minions.filter((mi) => mi.life > 0 && mi.owner.hp > 0);
  }

  /** Waves rolling outward: each catches you once, as its front passes. */
  private tickWaves(dt: number): void {
    for (const w of this.waves) {
      w.r += w.speed * dt;
      const o = this.other(w.owner);
      const d = Math.hypot(o.x - w.x, o.y - w.y);
      if (!w.done && Math.abs(d - w.r) < 6 + 4 * o.scale) {
        w.done = true;
        this.hit(w.owner, o, w.dmg, w.a);
        const m = d || 1;
        o.kx += ((o.x - w.x) / m) * 200;
        o.ky += ((o.y - w.y) / m) * 200;
      }
    }
    this.waves = this.waves.filter((w) => w.r < w.max);
  }

  /**
   * An area going off at (x, y): the hit, and the area specials -- a
   * patch left burning, a second go a moment later, a pull to the middle.
   */
  // ------------------------------------------------------------- ultimates

  /**
   * FIRE THE ULTIMATE (game/ultimates).  Only once it is up -- 30 seconds into
   * the fight, and 30 after the last one -- and only when the creature could
   * act anyway.  Its name goes up over it, the screen shakes and flashes its
   * element's colour, and its effects go off one after another.
   */
  private useUlt(f: Fighter): boolean {
    if (!this.started || this.over || this.paused || this.dialog) return false;
    if (!f.ult || f.ultT > 0 || f.hp <= 0 || !this.canAct(f) || f.dash) return false;
    f.ultT = ULT_COOLDOWN_S;
    f.ultUsed = true;
    const { col, light } = ultColour(f.c.element);
    const t = centerText(this, f.x, f.y - 20 * f.scale, f.ult.name, light).setDepth(60);
    backPlate(this, t, col);
    this.tweens.add({ targets: t, y: t.y - 10, alpha: 0, delay: 700, duration: 500, onComplete: () => t.destroy() });
    this.cameras.main.shake(220, 0.006);
    this.cameras.main.flash(110, (col >> 16) & 255, (col >> 8) & 255, col & 255, false);
    this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 22 * f.scale, t: 0, life: 0.5, col: light });
    audio.sfx('arcane_blast', 0.7);
    f.ult.fx.forEach((e, i) => this.time.delayedCall(i * 380, () => !this.over && f.hp > 0 && this.ultFx(f, e)));
    return true;
  }

  /** One effect of an ultimate, with its own look and sound. */
  private ultFx(f: Fighter, e: UltFx): void {
    const o = this.other(f);
    const { col, light } = ultColour(f.c.element);
    const dx = o.x - f.x;
    const dy = o.y - f.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const inArena = (x: number, y: number): [number, number] => [Phaser.Math.Clamp(x, ARENA.x + 10, ARENA.x + ARENA.w - 10), Phaser.Math.Clamp(y, ARENA.y + 10, ARENA.y + ARENA.h - 10)];
    switch (e.k) {
      case 'charge':
        // a long, hard rush straight through them
        f.dash = { vx: (ux * e.dist) / 0.3, vy: (uy * e.dist) / 0.3, t: 0.3, dmg: e.dmg, hit: false, a: f.c.attacks[0] };
        for (let k = 0; k < 4; k++) this.time.delayedCall(k * 60, () => this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 8 * f.scale, t: 0, life: 0.3, col: light }));
        audio.sfx('throw_whoosh', 0.6);
        break;
      case 'blink': {
        // gone, and behind them
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 12 * f.scale, t: 0, life: 0.35, col: 0x101018 });
        const [bx, by] = inArena(o.x + ux * 18, o.y + uy * 18);
        f.x = bx;
        f.y = by;
        f.face = o.x >= f.x ? 1 : -1;
        this.fx.push({ kind: 'boom', x: o.x, y: o.y, r: 14, t: 0, life: 0.3, col: light });
        this.hit(f, o, e.dmg, null);
        audio.sfx('whack', 0.7);
        break;
      }
      case 'nova':
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: e.r, t: 0, life: 0.45, col }, { kind: 'boom', x: f.x, y: f.y, r: e.r * 0.7, t: 0, life: 0.35, col: light });
        if (d < e.r + 7 * o.scale) {
          this.hit(f, o, e.dmg, null);
          o.kx += ux * e.knock;
          o.ky += uy * e.knock;
        }
        audio.sfx('boom', 0.6);
        break;
      case 'rage': {
        // bigger, faster, harder, for a while
        const s0 = f.scale;
        f.scale = s0 * 1.25;
        f.aura = Math.max(f.aura, e.t);
        f.haste = Math.max(f.haste, e.t * 0.6);
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 18 * s0, t: 0, life: 0.6, col: 0xff4a3a });
        this.time.delayedCall(e.t * 1000, () => (f.scale = s0));
        audio.sfx('stinger', 0.5);
        break;
      }
      case 'pull':
        if (d < e.r) {
          o.kx -= ux * 320;
          o.ky -= uy * 320;
          this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2: o.x, y2: o.y, r: 2, t: 0, life: 0.3, col: light });
          this.time.delayedCall(260, () => {
            if (this.over) return;
            this.fx.push({ kind: 'boom', x: f.x + f.face * 8, y: f.y, r: 14, t: 0, life: 0.3, col });
            if (Math.hypot(o.x - f.x, o.y - f.y) < 40 * f.scale) this.hit(f, o, e.dmg, null);
          });
        }
        audio.sfx('throw_whoosh', 0.5);
        break;
      case 'barrage': {
        const a = { ...f.c.attacks[0], kind: 'bolt' as const, sp: undefined };
        const base = Math.atan2(uy, ux);
        for (let k = 0; k < e.n; k++) {
          const ang = base + (e.n > 1 ? (k / (e.n - 1) - 0.5) * e.spread : 0);
          this.time.delayedCall(k * 40, () => {
            if (this.over) return;
            this.shots.push({ owner: f, x: f.x + Math.cos(ang) * 8, y: f.y + Math.sin(ang) * 8, vx: Math.cos(ang) * 210, vy: Math.sin(ang) * 210, life: 1.1, dmg: e.dmg, a, pierce: false, t: 0, ang });
          });
        }
        audio.sfx('throw_whoosh', 0.6);
        break;
      }
      case 'beam': {
        const x2 = f.x + ux * e.len;
        const y2 = f.y + uy * e.len;
        this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2, y2, r: e.w, t: 0, life: 0.4, col: light }, { kind: 'beam', x: f.x, y: f.y, x2, y2, r: e.w * 0.4, t: 0, life: 0.4, col: 0xffffff });
        if (this.segDist(o.x, o.y, f.x, f.y, x2, y2) < e.w + 6 * o.scale) this.hit(f, o, e.dmg, null);
        audio.sfx('arcane_blast', 0.6);
        break;
      }
      case 'meteor':
        for (let k = 0; k < e.n; k++) {
          const [mx, my] = inArena(o.x + (Math.random() - 0.5) * 34, o.y + (Math.random() - 0.5) * 26);
          this.fx.push({ kind: 'warn', x: mx, y: my, r: e.r, t: 0, life: 0.6 + k * 0.18, col });
          this.time.delayedCall(600 + k * 180, () => {
            if (this.over) return;
            this.fx.push({ kind: 'boom', x: mx, y: my, r: e.r, t: 0, life: 0.45, col: 0xffb040 });
            audio.sfx('arcane_blast', 0.45);
            if (Math.hypot(o.x - mx, o.y - my) < e.r + 7 * o.scale) this.hit(f, o, e.dmg, null);
          });
        }
        break;
      case 'zone':
        for (let k = 0; k < e.n; k++) {
          const a = (k / e.n) * Math.PI * 2;
          const [zx, zy] = inArena(o.x + Math.cos(a) * 14, o.y + Math.sin(a) * 10);
          this.pool(f, zx, zy, e.r);
          this.fx.push({ kind: 'ring', x: zx, y: zy, r: e.r, t: 0, life: 0.4, col });
        }
        break;
      case 'shield':
        f.shield = Math.max(f.shield, e.t);
        f.shieldMod = null;
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 14 * f.scale, t: 0, life: 0.6, col: 0xdcefff });
        audio.sfx('heal_up', 0.4);
        break;
      case 'heal':
        this.heal(f, Math.round(f.max * e.frac));
        this.floatNum(f, Math.round(f.max * e.frac), 0x8ae88a, '+');
        for (let k = 0; k < 3; k++) this.time.delayedCall(k * 120, () => this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: (8 + k * 6) * f.scale, t: 0, life: 0.4, col: 0x8ae88a }));
        audio.sfx('heal_up', 0.6);
        break;
      case 'drain': {
        let n = Math.round(e.t * 4);
        const per = Math.max(1, Math.round(e.dps / 4));
        this.time.addEvent({
          delay: 250,
          repeat: n - 1,
          callback: () => {
            if (this.over || f.hp <= 0 || o.hp <= 0 || --n < 0) return;
            if (Math.hypot(o.x - f.x, o.y - f.y) > 150) return;
            this.fx.push({ kind: 'beam', x: o.x, y: o.y, x2: f.x, y2: f.y, r: 1.5, t: 0, life: 0.22, col: light });
            this.hit(f, o, per, null);
            this.heal(f, per);
          },
        });
        break;
      }
      case 'slowfield':
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: e.r, t: 0, life: 0.7, col: light });
        if (d < e.r) o.slow = Math.max(o.slow, e.t);
        audio.sfx('item_thud', 0.5);
        break;
      case 'clones':
        for (let k = 0; k < e.n; k++) {
          this.decoy(f);
          const mi = this.minions[this.minions.length - 1];
          if (mi) {
            const [cx, cy] = inArena(f.x + Math.cos(k * 2.1) * 26, f.y + Math.sin(k * 2.1) * 18);
            mi.x = cx;
            mi.y = cy;
          }
        }
        break;
      case 'invuln':
        f.invuln = Math.max(f.invuln, e.t);
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 16 * f.scale, t: 0, life: 0.8, col: 0xffffff });
        audio.sfx('chime', 0.5);
        break;
      case 'stun':
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: e.r, t: 0, life: 0.4, col: 0xfff080 });
        if (d < e.r) {
          o.stun = Math.max(o.stun, e.t);
          this.fx.push({ kind: 'spark', x: o.x, y: o.y - 8, r: 6, t: 0, life: 0.5, col: 0xfff080 });
        }
        audio.sfx('spot_slam', 0.5);
        break;
      case 'haste':
        f.haste = Math.max(f.haste, e.t);
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 10 * f.scale, t: 0, life: 0.4, col: 0xf0fff4 });
        break;
      // ================================ THE REST OF THE ULTIMATES' OWN EFFECTS
      // (user, 4 Nov: every ultimate its own -- game/ultimates SPEC)
      case 'multiblink':
        // in at them from one side, then another, then another
        for (let k = 0; k < e.n; k++) {
          this.time.delayedCall(k * 260, () => {
            if (this.over || f.hp <= 0 || o.hp <= 0) return;
            const ang = Math.random() * Math.PI * 2;
            this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 10 * f.scale, t: 0, life: 0.3, col: 0x101018 });
            const [bx, by] = inArena(o.x + Math.cos(ang) * 18, o.y + Math.sin(ang) * 14);
            f.x = bx;
            f.y = by;
            f.face = o.x >= f.x ? 1 : -1;
            this.fx.push({ kind: 'boom', x: o.x, y: o.y, r: 11, t: 0, life: 0.25, col: light });
            this.hit(f, o, e.dmg, null);
            audio.sfx('whack', 0.6);
          });
        }
        break;
      case 'leap': {
        // up and out of reach, then down on where they stood
        const [tx, ty] = inArena(o.x, o.y);
        // (untouchable in the air -- not the updraft's own flag, which lands with its gust)
        f.invuln = Math.max(f.invuln, 0.5);
        this.fx.push({ kind: 'warn', x: tx, y: ty, r: e.r, t: 0, life: 0.45, col });
        this.time.delayedCall(450, () => {
          if (this.over || f.hp <= 0) return;
          f.x = tx;
          f.y = ty;
          this.fx.push({ kind: 'boom', x: tx, y: ty, r: e.r, t: 0, life: 0.4, col: light }, { kind: 'ring', x: tx, y: ty, r: e.r * 1.3, t: 0, life: 0.4, col });
          this.cameras.main.shake(140, 0.005);
          const dd = Math.hypot(o.x - tx, o.y - ty);
          if (dd < e.r + 7 * o.scale) {
            this.hit(f, o, e.dmg, null);
            o.kx += ((o.x - tx) / (dd || 1)) * 200;
            o.ky += ((o.y - ty) / (dd || 1)) * 200;
          }
          audio.sfx('boom', 0.6);
        });
        break;
      }
      case 'shockwaves':
        // rings, one after another, each wider: be between them
        for (let k = 0; k < e.n; k++) {
          this.time.delayedCall(k * 320, () => {
            if (this.over || f.hp <= 0) return;
            const r = 26 + k * 24;
            this.fx.push({ kind: 'ring', x: f.x, y: f.y, r, t: 0, life: 0.35, col: light });
            const dd = Math.hypot(o.x - f.x, o.y - f.y);
            if (dd > r - 14 && dd < r + 8 * o.scale) this.hit(f, o, e.dmg, null);
            audio.sfx('item_thud', 0.4);
          });
        }
        break;
      case 'swap': {
        // in a flash, each where the other was
        const [ax, ay] = [f.x, f.y];
        this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2: o.x, y2: o.y, r: 1.5, t: 0, life: 0.3, col: light });
        f.x = o.x;
        f.y = o.y;
        o.x = ax;
        o.y = ay;
        f.face = o.x >= f.x ? 1 : -1;
        o.stun = Math.max(o.stun, 0.5);
        this.hit(f, o, e.dmg, null);
        audio.sfx('chime', 0.5);
        break;
      }
      case 'volley': {
        // one after another, each aimed again
        const a = { ...f.c.attacks[0], kind: 'bolt' as const, sp: undefined };
        for (let k = 0; k < e.n; k++) {
          this.time.delayedCall(k * 110, () => {
            if (this.over || f.hp <= 0) return;
            const ang = Math.atan2(o.y - f.y, o.x - f.x);
            this.shots.push({ owner: f, x: f.x + Math.cos(ang) * 8, y: f.y + Math.sin(ang) * 8, vx: Math.cos(ang) * 230, vy: Math.sin(ang) * 230, life: 1.1, dmg: e.dmg, a, pierce: false, t: 0, ang });
            audio.sfx('throw_whoosh', 0.25);
          });
        }
        break;
      }
      case 'spiral': {
        const a = { ...f.c.attacks[0], kind: 'bolt' as const, sp: undefined };
        const base = Math.atan2(uy, ux);
        for (let k = 0; k < e.n; k++) {
          this.time.delayedCall(k * 45, () => {
            if (this.over || f.hp <= 0) return;
            const ang = base + k * 0.55;
            this.shots.push({ owner: f, x: f.x + Math.cos(ang) * 8, y: f.y + Math.sin(ang) * 8, vx: Math.cos(ang) * 170, vy: Math.sin(ang) * 170, life: 1.0, dmg: e.dmg, a, pierce: false, t: 0, ang });
          });
        }
        audio.sfx('throw_whoosh', 0.6);
        break;
      }
      case 'ring': {
        const a = { ...f.c.attacks[0], kind: 'bolt' as const, sp: undefined };
        const base = Math.atan2(uy, ux);
        for (let k = 0; k < e.n; k++) {
          const ang = base + (k / e.n) * Math.PI * 2;
          this.shots.push({ owner: f, x: f.x + Math.cos(ang) * 8, y: f.y + Math.sin(ang) * 8, vx: Math.cos(ang) * 190, vy: Math.sin(ang) * 190, life: 1.1, dmg: e.dmg, a, pierce: false, t: 0, ang });
        }
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 16 * f.scale, t: 0, life: 0.35, col: light });
        audio.sfx('arcane_blast', 0.5);
        break;
      }
      case 'homing': {
        const a = { ...f.c.attacks[0], kind: 'bolt' as const, sp: undefined, mod: 'homing' as const };
        const base = Math.atan2(uy, ux);
        for (let k = 0; k < e.n; k++) {
          this.time.delayedCall(k * 90, () => {
            if (this.over || f.hp <= 0) return;
            const ang = base + (e.n > 1 ? (k / (e.n - 1) - 0.5) * 2.2 : 0);
            this.shots.push({ owner: f, x: f.x + Math.cos(ang) * 8, y: f.y + Math.sin(ang) * 8, vx: Math.cos(ang) * 150, vy: Math.sin(ang) * 150, life: 1.8, dmg: e.dmg, a, pierce: false, t: 0, ang });
          });
        }
        audio.sfx('throw_whoosh', 0.5);
        break;
      }
      case 'sweep': {
        // a beam swung across a wide arc in front of it
        const base = Math.atan2(uy, ux);
        let done = false;
        for (let k = 0; k <= 6; k++) {
          this.time.delayedCall(k * 80, () => {
            if (this.over || f.hp <= 0) return;
            const ang = base - 0.8 + (k / 6) * 1.6;
            const x2 = f.x + Math.cos(ang) * e.len;
            const y2 = f.y + Math.sin(ang) * e.len;
            this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2, y2, r: 4, t: 0, life: 0.16, col: light });
            if (!done && this.segDist(o.x, o.y, f.x, f.y, x2, y2) < 8 + 6 * o.scale) {
              done = true;
              this.hit(f, o, e.dmg, null);
            }
          });
        }
        audio.sfx('arcane_blast', 0.6);
        break;
      }
      case 'cross': {
        const base = Math.atan2(uy, ux);
        let done = false;
        for (let k = 0; k < 4; k++) {
          const ang = base + (k * Math.PI) / 2;
          const x2 = f.x + Math.cos(ang) * e.len;
          const y2 = f.y + Math.sin(ang) * e.len;
          this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2, y2, r: 5, t: 0, life: 0.4, col: light }, { kind: 'beam', x: f.x, y: f.y, x2, y2, r: 2, t: 0, life: 0.4, col: 0xffffff });
          if (!done && this.segDist(o.x, o.y, f.x, f.y, x2, y2) < 7 + 6 * o.scale) {
            done = true;
            this.hit(f, o, e.dmg, null);
          }
        }
        audio.sfx('arcane_blast', 0.6);
        break;
      }
      case 'chain':
        // bolt after bolt from above, wherever they have got to
        for (let k = 0; k < e.n; k++) {
          this.time.delayedCall(k * 300, () => {
            if (this.over || f.hp <= 0 || o.hp <= 0) return;
            this.fx.push({ kind: 'beam', x: o.x + 3, y: ARENA.y, x2: o.x, y2: o.y, r: 2, t: 0, life: 0.2, col: 0xfff4a0 }, { kind: 'boom', x: o.x, y: o.y, r: 9, t: 0, life: 0.25, col: light });
            this.hit(f, o, e.dmg, null);
            audio.sfx('spot_slam', 0.35);
          });
        }
        break;
      case 'quakeline': {
        // eruptions racing across the ground towards where they stood
        const [lx, ly] = [ux, uy];
        for (let k = 0; k < e.n; k++) {
          this.time.delayedCall(k * 110, () => {
            if (this.over || f.hp <= 0) return;
            const [px, py] = inArena(f.x + lx * (22 + k * 18), f.y + ly * (22 + k * 18));
            this.fx.push({ kind: 'boom', x: px, y: py, r: 12, t: 0, life: 0.35, col: light });
            if (Math.hypot(o.x - px, o.y - py) < 12 + 6 * o.scale) this.hit(f, o, e.dmg, null);
            audio.sfx('item_thud', 0.3);
          });
        }
        break;
      }
      case 'spikes': {
        // a mark under them, then spikes up through it
        const [sx, sy] = inArena(o.x, o.y);
        this.fx.push({ kind: 'warn', x: sx, y: sy, r: 14, t: 0, life: 0.55, col });
        this.time.delayedCall(550, () => {
          if (this.over || f.hp <= 0) return;
          this.fx.push({ kind: 'boom', x: sx, y: sy, r: 14, t: 0, life: 0.4, col: light });
          if (Math.hypot(o.x - sx, o.y - sy) < 14 + 6 * o.scale) {
            this.hit(f, o, e.dmg, null);
            if (!o.st.unstop) o.root = Math.max(o.root, e.t);
          }
          audio.sfx('boom', 0.5);
        });
        break;
      }
      case 'minefield': {
        const a = { ...f.c.attacks[0], kind: 'mine' as const, sp: undefined, mod: 'none' as const };
        for (let k = 0; k < e.n; k++) {
          const ang = (k / e.n) * Math.PI * 2 + 0.4;
          const [mx, my] = inArena(o.x + Math.cos(ang) * 24, o.y + Math.sin(ang) * 18);
          this.mines.push({ owner: f, x: mx, y: my, arm: 0.35, life: 8, dmg: e.dmg, a });
        }
        audio.sfx('item_thud', 0.5);
        break;
      }
      case 'trail': {
        // fast, and burning ground behind it the whole way
        f.haste = Math.max(f.haste, e.t);
        const n = Math.round(e.t * 5);
        this.time.addEvent({ delay: 200, repeat: n - 1, callback: () => !this.over && f.hp > 0 && this.pool(f, f.x, f.y, 7) });
        break;
      }
      case 'blackhole': {
        const [hx, hy] = inArena(o.x, o.y);
        this.pools.push({ owner: f, kind: 'hole', x: hx, y: hy, r: 26, t: e.t, tick: 0, dps: e.dps });
        audio.sfx('arcane_blast', 0.6);
        break;
      }
      case 'tornado':
        this.minions.push({ owner: f, kind: 'twister', x: f.x + ux * 12, y: f.y + uy * 12, ang: 0, life: e.t, hp: 0, cd: 0, dmg: Math.max(1, Math.round(e.dps / 2)) });
        audio.sfx('throw_whoosh', 0.6);
        break;
      case 'bouncer':
        this.minions.push({ owner: f, kind: 'ball', x: f.x + ux * 12, y: f.y + uy * 12, ang: 0, life: e.t, hp: 0, cd: 0, dmg: e.dmg, vx: ux * 150, vy: uy * 150 });
        audio.sfx('item_thud', 0.6);
        break;
      case 'orbit':
        for (let k = 0; k < e.n; k++) this.minions.push({ owner: f, kind: 'blade', x: f.x, y: f.y, ang: (k / e.n) * Math.PI * 2, life: e.t, hp: 0, cd: 0, dmg: e.dmg });
        audio.sfx('throw_whoosh', 0.5);
        break;
      case 'pack':
        for (let k = 0; k < e.n; k++) {
          const [px, py] = inArena(f.x + Math.cos(k * 2.1) * 14, f.y + Math.sin(k * 2.1) * 10);
          this.minions.push({ owner: f, kind: 'biter', x: px, y: py, ang: 1, life: PACK_LIFE, hp: 8, cd: 0.3 + k * 0.1, dmg: e.dmg });
        }
        audio.sfx('stinger', 0.5);
        break;
      case 'turret': {
        const [px, py] = inArena(f.x - uy * 16, f.y + ux * 16);
        this.minions.push({ owner: f, kind: 'turret', x: px, y: py, ang: 0, life: e.t, hp: 14, cd: 0.4, dmg: e.dmg });
        audio.sfx('item_thud', 0.5);
        break;
      }
      case 'totem':
        this.minions.push({ owner: f, kind: 'totem', x: f.x, y: f.y + 4, ang: 0, life: e.t, hp: 0, cd: 0, hps: e.hps });
        audio.sfx('heal_up', 0.5);
        break;
      case 'bombers':
        for (let k = 0; k < e.n; k++) {
          const [px, py] = inArena(f.x + (k - (e.n - 1) / 2) * 18, f.y + 14);
          this.minions.push({ owner: f, kind: 'husk', x: px, y: py, ang: 0, life: 9, hp: 10, cd: 0, dmg: e.dmg });
        }
        break;
      case 'crows':
        for (let k = 0; k < e.n; k++) this.minions.push({ owner: f, kind: 'crow', x: o.x, y: o.y, ang: (k / e.n) * Math.PI * 2, life: CROW_LIFE, hp: 0, cd: 0.2 + k * 0.09, dmg: e.dmg });
        break;
      case 'spiders':
        for (let k = 0; k < e.n; k++) this.minions.push({ owner: f, kind: 'spiderling', x: f.x + (k - 1) * 10, y: f.y + 8, ang: 0, life: 6, hp: 0, cd: 0 });
        break;
      case 'prison': {
        // a ring of walls round them: they stop the enemy, not their maker
        const parts: Prop[] = [];
        for (let k = 0; k < 9; k++) {
          const ang = (k / 9) * Math.PI * 2;
          const q = { x: Phaser.Math.Clamp(o.x + Math.cos(ang) * 22, ARENA.x + 6, ARENA.x + ARENA.w - 6), y: Phaser.Math.Clamp(o.y + Math.sin(ang) * 20, ARENA.y + 6, ARENA.y + ARENA.h - 6), r: 6, hp: 14, maxHp: 14, owner: f };
          if (Math.hypot(q.x - f.x, q.y - f.y) > q.r + BODY_R * f.scale + 2) parts.push(q);
        }
        if (parts.length) {
          this.barriers.push({ kind: wallLook(undefined, f.c.element), parts, seed: 1, life: e.t, max: e.t, owner: f });
          this.props.push(...parts);
          this.repaintCover();
        }
        audio.sfx('item_thud', 0.6);
        break;
      }
      case 'rootfield':
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: e.r, t: 0, life: 0.5, col: 0xb0e080 });
        if (d < e.r && !o.st.unstop) {
          o.root = Math.max(o.root, e.t);
          this.fx.push({ kind: 'spark', x: o.x, y: o.y + 4, r: 7, t: 0, life: 0.5, col: 0xb0e080 });
        }
        audio.sfx('item_thud', 0.4);
        break;
      case 'blind':
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 24, t: 0, life: 0.4, col: 0x101018 });
        if (d < BLIND_R) o.blind = Math.max(o.blind, e.t);
        break;
      case 'silence':
        for (let k = 0; k < 3; k++) o.cds[k] += e.t;
        this.fx.push({ kind: 'spark', x: o.x, y: o.y - 8, r: 8, t: 0, life: 0.5, col: light });
        this.floatNum(o, 0, light, 'JAMMED ');
        break;
      case 'weaken':
        o.weak = Math.max(o.weak, e.t);
        this.floatNum(o, 0, light, 'WEAKENED ');
        break;
      case 'shred':
        o.shred = Math.max(o.shred, e.t);
        this.floatNum(o, 0, light, 'SHREDDED ');
        break;
      case 'reflect':
      case 'thorns':
        f.shield = Math.max(f.shield, e.t);
        f.shieldMod = e.k;
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 14 * f.scale, t: 0, life: 0.6, col: e.k === 'reflect' ? 0x9ad0ff : 0xffa040 });
        audio.sfx('heal_up', 0.4);
        break;
      case 'regen': {
        let n = Math.round(e.t);
        this.time.addEvent({ delay: 1000, repeat: n - 1, callback: () => !this.over && --n >= 0 && (this.heal(f, e.hps), this.floatNum(f, e.hps, 0x8ae88a, '+')) });
        break;
      }
      case 'lifesteal':
        f.st.u_steal = e.t;
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 14 * f.scale, t: 0, life: 0.5, col: 0xc03050 });
        break;
      case 'giant': {
        // bigger, and harder to hurt or move, for a while
        const s0 = f.scale;
        f.scale = s0 * 1.3;
        f.st.u_giant = e.t;
        f.st.anchor = Math.max(f.st.anchor ?? 0, e.t);
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 20 * s0, t: 0, life: 0.6, col: light });
        this.time.delayedCall(e.t * 1000, () => (f.scale = s0));
        audio.sfx('stinger', 0.5);
        break;
      }
      case 'stealth':
        f.st.invis = Math.max(f.st.invis ?? 0, e.t);
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 12 * f.scale, t: 0, life: 0.35, col: 0x101018 });
        break;
      case 'reset':
        f.cds[0] = f.cds[1] = f.cds[2] = 0;
        this.floatNum(f, 0, light, 'READY ');
        break;
      case 'cleanse':
        f.burn = f.slow = f.chill = f.root = f.blind = f.poison = f.weak = f.shred = f.stun = 0;
        for (const k of ['sleep', 'cage', 'knock', 'stone', 'slick', 'mired', 'confused', 'omen', 'pollen', 'leash', 'rain', 'n_stacks', 'n_quills']) delete f.st[k];
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 14 * f.scale, t: 0, life: 0.4, col: 0xffffff });
        break;
      default:
        this.ultSignature(f, e);
    }
  }

  /**
   * ---- EACH CREATURE'S OWN SIGNATURE (game/ultimates SPEC): every one of
   * these belongs to one ultimate only, and looks and plays its own way.
   */
  private ultSignature(f: Fighter, e: UltFx): void {
    const o = this.other(f);
    const { col, light } = ultColour(f.c.element);
    const dx = o.x - f.x;
    const dy = o.y - f.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const inArena = (x: number, y: number): [number, number] => [Phaser.Math.Clamp(x, ARENA.x + 10, ARENA.x + ARENA.w - 10), Phaser.Math.Clamp(y, ARENA.y + 10, ARENA.y + ARENA.h - 10)];
    const later = (ms: number, fn: () => void): void => {
      this.time.delayedCall(ms, () => !this.over && f.hp > 0 && fn());
    };
    const every = (ms: number, n: number, fn: (k: number) => void): void => {
      let k = 0;
      this.time.addEvent({ delay: ms, repeat: Math.max(0, n - 1), callback: () => !this.over && f.hp > 0 && fn(k++) });
    };
    const bolt = { ...f.c.attacks[0], kind: 'bolt' as const, sp: undefined, mod: 'none' as const };
    switch (e.k) {
      case 'geyser':
        // a ripple under them, then a column of water up through it
        every(320, e.n, (k) => {
          const [gx, gy] = inArena(o.x + (k ? (Math.random() - 0.5) * 10 : 0), o.y + (k ? (Math.random() - 0.5) * 8 : 0));
          this.fx.push({ kind: 'warn', x: gx, y: gy, r: 11, t: 0, life: 0.3, col: 0x9ad0ff });
          later(300, () => {
            this.fx.push({ kind: 'beam', x: gx, y: gy, x2: gx, y2: gy - 34, r: 6, t: 0, life: 0.35, col: 0x9ad0ff }, { kind: 'ring', x: gx, y: gy, r: 12, t: 0, life: 0.3, col: 0xffffff });
            if (Math.hypot(o.x - gx, o.y - gy) < 11 + 5 * o.scale) {
              this.hit(f, o, e.dmg, null);
              o.stun = Math.max(o.stun, 0.4);
            }
            audio.sfx('throw_whoosh', 0.35);
          });
        });
        break;
      case 'tidalwave': {
        // a wall of water across the whole arena, from its side to theirs
        const dir = o.x >= f.x ? 1 : -1;
        let wx = dir > 0 ? ARENA.x + 4 : ARENA.x + ARENA.w - 4;
        let done = false;
        every(40, Math.ceil(ARENA.w / 9) + 2, () => {
          wx += dir * 9;
          this.fx.push({ kind: 'beam', x: wx, y: ARENA.y + 2, x2: wx, y2: ARENA.y + ARENA.h - 2, r: 5, t: 0, life: 0.1, col: 0x3a8ad8 }, { kind: 'beam', x: wx + dir * 3, y: ARENA.y + 2, x2: wx + dir * 3, y2: ARENA.y + ARENA.h - 2, r: 1.5, t: 0, life: 0.1, col: 0xffffff });
          if (!done && Math.abs(o.x - wx) < 9) {
            done = true;
            this.hit(f, o, e.dmg, null);
            o.kx += dir * 380;
          }
        });
        audio.sfx('throw_whoosh', 0.7);
        break;
      }
      case 'iceblock':
        o.stun = Math.max(o.stun, e.t);
        o.st.u_ice = e.t;
        this.fx.push({ kind: 'ring', x: o.x, y: o.y, r: 14, t: 0, life: 0.5, col: 0xe8fcff });
        audio.sfx('chime', 0.5);
        break;
      case 'icicles': {
        // a row of them right across the arena, at their height
        const y = Phaser.Math.Clamp(o.y, ARENA.y + 10, ARENA.y + ARENA.h - 10);
        for (let k = 0; k < e.n; k++) {
          const x = ARENA.x + ((k + 0.5) / e.n) * ARENA.w;
          this.fx.push({ kind: 'warn', x, y, r: 10, t: 0, life: 0.7 + k * 0.07, col: 0xbfe8ff });
          later(700 + k * 70, () => {
            this.fx.push({ kind: 'beam', x, y: y - 24, x2: x, y2: y, r: 2, t: 0, life: 0.15, col: 0xe8fcff }, { kind: 'boom', x, y, r: 9, t: 0, life: 0.3, col: 0xffffff });
            if (Math.hypot(o.x - x, o.y - y) < 10 + 5 * o.scale) this.hit(f, o, e.dmg, null);
          });
        }
        break;
      }
      case 'avalanche': {
        // three boulders rolling across, one in each lane round them
        const dir = o.x >= f.x ? 1 : -1;
        for (const off of [-28, 0, 28]) {
          const y = Phaser.Math.Clamp(o.y + off, ARENA.y + 8, ARENA.y + ARENA.h - 8);
          this.minions.push({ owner: f, kind: 'rock', x: dir > 0 ? ARENA.x + 4 : ARENA.x + ARENA.w - 4, y, ang: 0, life: 4, hp: 0, cd: 0, dmg: e.dmg, vx: dir * 170, vy: 0 });
        }
        this.cameras.main.shake(200, 0.004);
        audio.sfx('item_thud', 0.6);
        break;
      }
      case 'blizzard':
        every(500, Math.round(e.t * 2), () => {
          o.slow = Math.max(o.slow, 0.6);
          for (let k = 0; k < 6; k++) this.fx.push({ kind: 'spark', x: ARENA.x + Math.random() * ARENA.w, y: ARENA.y + Math.random() * ARENA.h, r: 2, t: 0, life: 0.5, col: 0xffffff });
          this.fx.push({ kind: 'boom', x: o.x, y: o.y, r: 6, t: 0, life: 0.2, col: 0xe8fcff });
          this.hit(f, o, Math.max(1, Math.round(e.dps / 2)), null);
        });
        audio.sfx('throw_whoosh', 0.5);
        break;
      case 'absorb': {
        // every shot flying at it now, soaked; and what comes for a while
        let n = 0;
        for (const sh of this.shots) if (sh.owner === o && sh.life > 0) {
          sh.life = 0;
          n++;
        }
        f.st.u_absorb = e.t;
        f.st.n_abs = n;
        const s0 = f.scale;
        f.scale = s0 * 1.25;
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 16 * s0, t: 0, life: 0.5, col: 0x9ad0ff });
        later(e.t * 1000, () => {
          f.scale = s0;
          const m = Math.min(12, (f.st.n_abs ?? 0) + 2);
          f.st.n_abs = 0;
          for (let k = 0; k < m; k++) later(k * 70, () => {
            const ang = Math.atan2(o.y - f.y, o.x - f.x) + (Math.random() - 0.5) * 0.4;
            this.shots.push({ owner: f, x: f.x, y: f.y, vx: Math.cos(ang) * 220, vy: Math.sin(ang) * 220, life: 1.1, dmg: e.dmg, a: bolt, pierce: false, t: 0, ang });
          });
        });
        break;
      }
      case 'laserfence': {
        const px = -uy;
        const py = ux;
        const [ax, ay] = inArena(o.x + px * 32, o.y + py * 32);
        const [bx, by] = inArena(o.x - px * 32, o.y - py * 32);
        this.pools.push({ owner: f, kind: 'fence', x: ax, y: ay, x2: bx, y2: by, r: 0, t: e.t, tick: 0, dps: e.dps });
        audio.sfx('spot_slam', 0.4);
        break;
      }
      case 'staticfield':
        this.pools.push({ owner: f, kind: 'static', x: f.x, y: f.y, r: 45, t: e.t, tick: 0, dps: e.dps });
        audio.sfx('spot_slam', 0.4);
        break;
      case 'railgun': {
        // aim shown, then the rail: through cover, off the wall once
        const ang = Math.atan2(uy, ux);
        this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2: f.x + ux * 400, y2: f.y + uy * 400, r: 0.6, t: 0, life: 0.7, col: 0xff8a8a });
        later(700, () => {
          // to the wall, then reflected
          const ex = ux > 0 ? (ARENA.x + ARENA.w - f.x) / ux : ux < 0 ? (ARENA.x - f.x) / ux : 1e9;
          const ey = uy > 0 ? (ARENA.y + ARENA.h - f.y) / uy : uy < 0 ? (ARENA.y - f.y) / uy : 1e9;
          const tw = Math.min(ex, ey);
          const x1 = f.x + Math.cos(ang) * tw;
          const y1 = f.y + Math.sin(ang) * tw;
          const rx = ex < ey ? -ux : ux;
          const ry = ex < ey ? uy : -uy;
          const x2 = x1 + rx * 160;
          const y2 = y1 + ry * 160;
          this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2: x1, y2: y1, r: 4, t: 0, life: 0.35, col: light }, { kind: 'beam', x: x1, y: y1, x2, y2, r: 4, t: 0, life: 0.35, col: light }, { kind: 'beam', x: f.x, y: f.y, x2: x1, y2: y1, r: 1.5, t: 0, life: 0.35, col: 0xffffff });
          if (this.segDist(o.x, o.y, f.x, f.y, x1, y1) < 6 + 6 * o.scale || this.segDist(o.x, o.y, x1, y1, x2, y2) < 6 + 6 * o.scale) this.hit(f, o, e.dmg, null);
          this.cameras.main.shake(120, 0.006);
          audio.sfx('arcane_blast', 0.7);
        });
        break;
      }
      case 'boomerang':
        this.minions.push({ owner: f, kind: 'glaive', x: f.x + ux * 8, y: f.y + uy * 8, ang: 0, life: 3, hp: 0, cd: 0, dmg: e.dmg, vx: ux * 300, vy: uy * 300, t: 0 });
        audio.sfx('throw_whoosh', 0.6);
        break;
      case 'firebreath': {
        // a cone of flame, turning after them
        let aim = Math.atan2(uy, ux);
        every(150, Math.round(e.t / 0.15), () => {
          const want = Math.atan2(o.y - f.y, o.x - f.x);
          let da = want - aim;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          aim += Phaser.Math.Clamp(da, -0.35, 0.35);
          for (let k = 0; k < 3; k++) {
            const a = aim + (Math.random() - 0.5) * 0.7;
            const r = 20 + Math.random() * 70;
            this.fx.push({ kind: 'spark', x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r, r: 4, t: 0, life: 0.25, col: k ? 0xffb040 : 0xff5020 });
          }
          const od = Math.hypot(o.x - f.x, o.y - f.y);
          let off = Math.atan2(o.y - f.y, o.x - f.x) - aim;
          off = Math.atan2(Math.sin(off), Math.cos(off));
          if (od < 90 && Math.abs(off) < 0.4) this.hit(f, o, e.dmg, null);
        });
        audio.sfx('arcane_blast', 0.5);
        break;
      }
      case 'fireworks':
        for (let k = 0; k < e.n; k++) {
          const [cx, cy] = inArena(o.x + (k - (e.n - 1) / 2) * 16, o.y + (Math.random() - 0.5) * 10);
          this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2: cx, y2: cy - 40, r: 1, t: 0, life: 0.5, col: 0xffe060 });
          this.fx.push({ kind: 'warn', x: cx, y: cy, r: 16, t: 0, life: 0.6 + k * 0.15, col });
          later(600 + k * 150, () => {
            for (let q = 0; q < 8; q++) {
              const a = (q / 8) * Math.PI * 2;
              this.fx.push({ kind: 'spark', x: cx + Math.cos(a) * 14, y: cy + Math.sin(a) * 11, r: 3, t: 0, life: 0.4, col: q % 2 ? 0xff60c0 : 0x60e0ff });
            }
            this.fx.push({ kind: 'boom', x: cx, y: cy - 30, r: 8, t: 0, life: 0.3, col: 0xffffff });
            if (Math.hypot(o.x - cx, o.y - cy) < 16 + 5 * o.scale) this.hit(f, o, e.dmg, null);
            audio.sfx('arcane_blast', 0.4);
          });
        }
        break;
      case 'phoenix':
        f.st.u_phoenix = e.t;
        f.st.n_phoenix = e.frac;
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 16 * f.scale, t: 0, life: 0.6, col: 0xffb040 });
        audio.sfx('chime', 0.5);
        break;
      case 'solarflare':
        this.cameras.main.flash(260, 255, 250, 210, false);
        o.blind = Math.max(o.blind, e.t);
        o.burn = Math.max(o.burn, e.t);
        this.hit(f, o, e.dmg, null);
        audio.sfx('arcane_blast', 0.7);
        break;
      case 'lighthouse': {
        // three beams turning round it
        let ang = Math.atan2(uy, ux);
        let cd = 0;
        every(50, Math.round(e.t / 0.05), () => {
          ang += 0.12;
          cd -= 0.05;
          for (let k = 0; k < 3; k++) {
            const a = ang + (k * Math.PI * 2) / 3;
            const x2 = f.x + Math.cos(a) * 70;
            const y2 = f.y + Math.sin(a) * 70;
            this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2, y2, r: 2.5, t: 0, life: 0.06, col: 0xfff4c0 });
            if (cd <= 0 && this.segDist(o.x, o.y, f.x, f.y, x2, y2) < 5 + 5 * o.scale) {
              cd = 0.4;
              this.hit(f, o, e.dmg, null);
            }
          }
        });
        break;
      }
      case 'mirrorimage':
        for (let k = 0; k < e.n; k++) this.minions.push({ owner: f, kind: 'mirror', x: f.x, y: f.y, ang: (k / e.n) * Math.PI * 2 + 1, life: 5, hp: 8, cd: 0.4 + k * 0.3, dmg: e.dmg });
        audio.sfx('chime', 0.5);
        break;
      case 'echo':
        f.st.u_echo = e.t;
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 14 * f.scale, t: 0, life: 0.5, col: 0xc0c8ff });
        break;
      case 'timewarp': {
        // back to where it was 3 s ago, and the health it had then if more
        const h = f.hist?.[0];
        if (h) {
          this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2: h[0], y2: h[1], r: 1.5, t: 0, life: 0.4, col: 0xc0c8ff });
          f.x = h[0];
          f.y = h[1];
          f.hp = Math.min(f.max, Math.max(f.hp, h[2]));
        }
        f.burn = f.poison = 0;
        for (let k = 0; k < 3; k++) this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: (8 + k * 6) * f.scale, t: 0, life: 0.5, col: 0xc0c8ff });
        audio.sfx('chime', 0.6);
        break;
      }
      case 'timestop': {
        o.stun = Math.max(o.stun, e.t);
        const frozen = this.shots.filter((sh) => sh.owner === o);
        const vel = frozen.map((sh) => [sh.vx, sh.vy] as const);
        for (const sh of frozen) {
          sh.vx = sh.vy = 0;
          sh.life += e.t;
        }
        this.cameras.main.flash(120, 200, 210, 255, false);
        this.time.delayedCall(e.t * 1000, () => frozen.forEach((sh, k) => ([sh.vx, sh.vy] = vel[k])));
        audio.sfx('chime', 0.6);
        break;
      }
      case 'doom':
        o.st.u_doom = 3;
        later(3000, () => {
          this.fx.push({ kind: 'boom', x: o.x, y: o.y, r: 16, t: 0, life: 0.5, col: 0x7a2a9a });
          this.cameras.main.shake(160, 0.006);
          this.hit(f, o, e.dmg, null);
          audio.sfx('boom', 0.7);
        });
        break;
      case 'soullink':
        f.st.u_link = e.t;
        this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2: o.x, y2: o.y, r: 1.5, t: 0, life: 0.5, col: 0xc090e0 });
        break;
      case 'fear':
        o.st.u_fear = e.t;
        this.floatNum(o, 0, 0xffe060, 'FEAR ');
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 40, t: 0, life: 0.4, col: 0x9ab84a });
        break;
      case 'polymorph':
        o.st.u_poly = e.t;
        this.fx.push({ kind: 'boom', x: o.x, y: o.y, r: 12, t: 0, life: 0.4, col: 0xffffff });
        this.floatNum(o, 0, 0xffffff, 'BAA ');
        audio.sfx('chime', 0.5);
        break;
      case 'shrink': {
        const s0 = o.scale;
        o.scale = s0 * 0.65;
        o.weak = Math.max(o.weak, e.t);
        this.fx.push({ kind: 'ring', x: o.x, y: o.y, r: 14 * s0, t: 0, life: 0.5, col: light });
        this.time.delayedCall(e.t * 1000, () => (o.scale = s0));
        break;
      }
      case 'quicksand': {
        const [qx, qy] = inArena(o.x, o.y);
        this.pools.push({ owner: f, kind: 'sand', x: qx, y: qy, r: 24, t: e.t, tick: 0, dps: e.dps });
        break;
      }
      case 'bunker':
      case 'duel':
      case 'firewall': {
        // walls: round itself, round them both, or a line between
        const parts: Prop[] = [];
        const add = (x: number, y: number): void => {
          const q = { x: Phaser.Math.Clamp(x, ARENA.x + 6, ARENA.x + ARENA.w - 6), y: Phaser.Math.Clamp(y, ARENA.y + 6, ARENA.y + ARENA.h - 6), r: 6, hp: 16, maxHp: 16, owner: f };
          if (Math.hypot(q.x - f.x, q.y - f.y) > q.r + BODY_R * f.scale + 2 && Math.hypot(q.x - o.x, q.y - o.y) > q.r + BODY_R * o.scale + 2) parts.push(q);
        };
        if (e.k === 'bunker') for (let k = 0; k < 9; k++) add(f.x + Math.cos((k / 9) * Math.PI * 2) * 22, f.y + Math.sin((k / 9) * Math.PI * 2) * 19);
        if (e.k === 'duel') {
          const mx = (f.x + o.x) / 2;
          const my = (f.y + o.y) / 2;
          const R = Math.max(40, d / 2 + 18);
          for (let k = 0; k < 16; k++) add(mx + Math.cos((k / 16) * Math.PI * 2) * R, my + Math.sin((k / 16) * Math.PI * 2) * R * 0.8);
          f.st.u_duel = e.t;
          this.floatNum(f, 0, PALETTE.gold, 'DUEL ');
        }
        if (e.k === 'firewall') {
          const mx = f.x + ux * d * 0.5;
          const my = f.y + uy * d * 0.5;
          for (let k = -2; k <= 2; k++) {
            add(mx - uy * k * 11, my + ux * k * 11);
            this.pools.push({ owner: f, x: mx - uy * k * 11 + ux * 8, y: my + ux * k * 11 + uy * 8, r: 8, t: e.t, tick: 0 });
          }
        }
        if (parts.length) {
          this.barriers.push({ kind: wallLook(undefined, f.c.element), parts, seed: 1, life: e.t, max: e.t, owner: f });
          this.props.push(...parts);
          this.repaintCover();
        }
        audio.sfx('item_thud', 0.6);
        break;
      }
      case 'stoneskin':
        f.st.n_skin = (f.st.n_skin ?? 0) + e.amt;
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 14 * f.scale, t: 0, life: 0.6, col: 0xd0c4a8 });
        audio.sfx('item_thud', 0.5);
        break;
      case 'earthquake':
        every(600, Math.round(e.t / 0.6), () => {
          this.cameras.main.shake(200, 0.007);
          this.fx.push({ kind: 'beam', x: o.x - 14, y: o.y + 4, x2: o.x + 14, y2: o.y - 2, r: 1, t: 0, life: 0.4, col: 0x3a2e1e });
          o.stun = Math.max(o.stun, 0.15);
          this.hit(f, o, e.dmg, null);
          audio.sfx('item_thud', 0.5);
        });
        break;
      case 'rockthrow': {
        const [tx, ty] = inArena(o.x, o.y);
        this.fx.push({ kind: 'warn', x: tx, y: ty, r: 20, t: 0, life: 0.65, col });
        later(650, () => {
          this.fx.push({ kind: 'boom', x: tx, y: ty, r: 20, t: 0, life: 0.4, col: 0xd0c4a8 });
          this.cameras.main.shake(140, 0.006);
          if (Math.hypot(o.x - tx, o.y - ty) < 20 + 5 * o.scale) this.hit(f, o, e.dmg, null);
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            this.shots.push({ owner: f, x: tx + Math.cos(a) * 10, y: ty + Math.sin(a) * 10, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, life: 0.6, dmg: Math.max(2, Math.round(e.dmg / 4)), a: bolt, pierce: false, t: 0, ang: a });
          }
          audio.sfx('boom', 0.6);
        });
        break;
      }
      case 'pylons':
        for (let k = 0; k < e.n; k++) {
          const a = (k / e.n) * Math.PI * 2 + 0.5;
          const [px, py] = inArena(o.x + Math.cos(a) * 30, o.y + Math.sin(a) * 24);
          this.minions.push({ owner: f, kind: 'pylon', x: px, y: py, ang: 0, life: e.t, hp: 10, cd: 0.6 + k * 0.2, dmg: e.dmg });
        }
        audio.sfx('chime', 0.5);
        break;
      case 'windwall': {
        const mx = f.x + ux * 22;
        const my = f.y + uy * 22;
        this.pools.push({ owner: f, kind: 'wind', x: mx - uy * 30, y: my + ux * 30, x2: mx + uy * 30, y2: my - ux * 30, r: 0, t: e.t, tick: 0 });
        audio.sfx('throw_whoosh', 0.5);
        break;
      }
      case 'gale': {
        let cd = 0;
        every(50, Math.round(e.t / 0.05), () => {
          const dd = Math.hypot(o.x - f.x, o.y - f.y) || 1;
          if (!o.st.anchor) {
            o.kx += ((o.x - f.x) / dd) * 60;
            o.ky += ((o.y - f.y) / dd) * 60;
          }
          cd -= 0.05;
          if (Math.random() < 0.4) this.fx.push({ kind: 'beam', x: f.x + (Math.random() - 0.5) * 20, y: f.y + (Math.random() - 0.5) * 20, x2: o.x, y2: o.y, r: 0.6, t: 0, life: 0.12, col: 0xf0fff4 });
          const atWall = o.x < ARENA.x + 12 || o.x > ARENA.x + ARENA.w - 12 || o.y < ARENA.y + 12 || o.y > ARENA.y + ARENA.h - 12;
          if (atWall && cd <= 0) {
            cd = 0.5;
            this.hit(f, o, e.dmg, null);
            this.fx.push({ kind: 'boom', x: o.x, y: o.y, r: 9, t: 0, life: 0.25, col: 0xf0fff4 });
          }
        });
        audio.sfx('throw_whoosh', 0.7);
        break;
      }
      case 'liftoff':
        o.stun = Math.max(o.stun, e.t);
        o.st.u_lift = e.t;
        later(e.t * 1000, () => {
          this.fx.push({ kind: 'boom', x: o.x, y: o.y, r: 12, t: 0, life: 0.35, col: light });
          this.cameras.main.shake(120, 0.005);
          this.hit(f, o, e.dmg, null);
        });
        audio.sfx('throw_whoosh', 0.6);
        break;
      case 'blossoms':
        for (let k = 0; k < e.n; k++) {
          const a = (k / e.n) * Math.PI * 2;
          const [bx, by] = inArena(f.x + Math.cos(a) * 30, f.y + Math.sin(a) * 24);
          this.minions.push({ owner: f, kind: 'flower', x: bx, y: by, ang: 0, life: 10, hp: 0, cd: 0, hps: e.hps });
        }
        audio.sfx('heal_up', 0.5);
        break;
      case 'bubble':
        o.stun = Math.max(o.stun, e.t);
        o.st.u_bubble = e.t;
        every(50, Math.round(e.t / 0.05), () => {
          const dd = Math.hypot(f.x - o.x, f.y - o.y) || 1;
          if (dd > 24) {
            o.x += ((f.x - o.x) / dd) * 1.6;
            o.y += ((f.y - o.y) / dd) * 1.6;
          }
        });
        later(e.t * 1000, () => {
          this.fx.push({ kind: 'ring', x: o.x, y: o.y, r: 14, t: 0, life: 0.3, col: 0xffffff });
          this.hit(f, o, e.dmg, null);
          audio.sfx('item_thud', 0.4);
        });
        break;
      case 'tentacles':
        for (let k = 0; k < e.n; k++) {
          const a = (k / e.n) * Math.PI * 2 + 0.3;
          const [tx, ty] = inArena(o.x + Math.cos(a) * 18, o.y + Math.sin(a) * 14);
          this.minions.push({ owner: f, kind: 'tentacle', x: tx, y: ty, ang: k, life: e.t, hp: 0, cd: 0.3, dmg: e.dmg });
        }
        audio.sfx('poison_hiss', 0.5);
        break;
      case 'riptide': {
        const dir = Math.random() < 0.5 ? 1 : -1;
        for (const off of [-26, 0, 26]) {
          const y = Phaser.Math.Clamp(o.y + off, ARENA.y + 10, ARENA.y + ARENA.h - 10);
          this.pools.push({ owner: f, kind: 'lane', x: ARENA.x + ARENA.w / 2, y, r: 0, t: e.t, tick: 0, dps: e.dps, dir: off === 0 ? dir : -dir });
        }
        audio.sfx('throw_whoosh', 0.5);
        break;
      }
      case 'counter':
        f.st.u_counter = e.t;
        f.st.n_counter = e.dmg;
        this.floatNum(f, 0, 0xffffff, 'GUARD ');
        break;
      case 'execute': {
        const low = o.hp < o.max * 0.4;
        const [bx, by] = inArena(o.x - ux * 12, o.y - uy * 10);
        this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2: bx, y2: by, r: 1.5, t: 0, life: 0.2, col: 0xff3a3a });
        f.x = bx;
        f.y = by;
        f.face = o.x >= f.x ? 1 : -1;
        this.fx.push({ kind: 'boom', x: o.x, y: o.y, r: low ? 16 : 10, t: 0, life: 0.35, col: low ? 0xff3a3a : light });
        if (low) this.floatNum(o, 0, 0xff3a3a, 'FINISH ');
        this.hit(f, o, e.dmg * (low ? 3 : 1), null);
        audio.sfx('whack', 0.8);
        break;
      }
      case 'bleed':
        every(500, Math.round(e.t * 2), () => {
          const n = Math.max(1, Math.round((e.dps / 2) * (o.moving ? 2 : 1)));
          this.fx.push({ kind: 'spark', x: o.x, y: o.y + 2, r: 3, t: 0, life: 0.3, col: 0xc01020 });
          this.hit(f, o, n, null);
        });
        break;
      case 'hunt':
        f.st.u_hunt = e.t;
        o.st.u_hunted = e.t;
        o.st.invis = 0;
        this.floatNum(o, 0, 0xff3a3a, 'HUNTED ');
        break;
      case 'overload':
        for (let k = 0; k < 4; k++) this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: e.r * (0.3 + k * 0.22), t: 0, life: 1.2 - k * 0.15, col: light });
        this.fx.push({ kind: 'warn', x: f.x, y: f.y, r: e.r, t: 0, life: 1.2, col });
        later(1200, () => {
          this.fx.push({ kind: 'boom', x: f.x, y: f.y, r: e.r, t: 0, life: 0.5, col: 0xffffff });
          this.cameras.main.shake(220, 0.008);
          if (Math.hypot(o.x - f.x, o.y - f.y) < e.r + 5 * o.scale) this.hit(f, o, e.dmg, null);
          audio.sfx('boom', 0.8);
        });
        break;
      case 'balllightning':
        this.minions.push({ owner: f, kind: 'orb', x: f.x + ux * 10, y: f.y + uy * 10, ang: 0, life: e.t, hp: 0, cd: 0.3, dmg: e.dmg });
        audio.sfx('spot_slam', 0.4);
        break;
      case 'rot':
        o.st.omen = Math.max(o.st.omen ?? 0, e.t);
        every(1000, Math.round(e.t), () => {
          this.fx.push({ kind: 'spark', x: o.x, y: o.y - 4, r: 5, t: 0, life: 0.4, col: 0x6a8a3a });
          this.hit(f, o, Math.max(1, Math.round(o.hp * 0.05)), null);
        });
        break;
      case 'miasma':
        this.pools.push({ owner: f, kind: 'miasma', x: f.x, y: f.y, r: 10, t: e.t, tick: 0, dps: e.dps, grow: 35 });
        audio.sfx('poison_hiss', 0.5);
        break;
      case 'carrionmark': {
        o.st.u_carrion = e.t;
        let done = false;
        every(200, Math.round(e.t * 5), (k) => {
          if (done) return;
          if (o.hp < o.max * 0.35 || k === Math.round(e.t * 5) - 1) {
            done = true;
            const big = o.hp < o.max * 0.35;
            o.st.u_carrion = 0;
            this.fx.push({ kind: 'beam', x: o.x, y: ARENA.y, x2: o.x, y2: o.y, r: big ? 3 : 1.5, t: 0, life: 0.25, col: 0x1a1024 }, { kind: 'boom', x: o.x, y: o.y, r: big ? 14 : 8, t: 0, life: 0.3, col: 0xc090e0 });
            this.hit(f, o, big ? e.dmg * 2 : Math.round(e.dmg / 2), null);
          }
        });
        break;
      }
      case 'radiance':
        every(600, e.n, () => {
          this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 50, t: 0, life: 0.4, col: 0xfff4c0 });
          this.heal(f, e.hps);
          this.floatNum(f, e.hps, 0x8ae88a, '+');
          if (Math.hypot(o.x - f.x, o.y - f.y) < 50 + 5 * o.scale) this.hit(f, o, e.dmg, null);
        });
        audio.sfx('heal_up', 0.5);
        break;
      case 'prismfan': {
        const base = Math.atan2(uy, ux) + Math.PI;
        for (let k = 0; k < e.n; k++) {
          const a = base + (k / (e.n - 1) - 0.5) * 2.2;
          const px = f.x + Math.cos(a) * 16;
          const py = f.y + Math.sin(a) * 12;
          this.fx.push({ kind: 'spark', x: px, y: py, r: 4, t: 0, life: 0.3 + k * 0.12, col: [0xff6060, 0xffd060, 0x60ff90, 0x60c0ff, 0xc080ff][k % 5] });
          later(300 + k * 120, () => {
            this.fx.push({ kind: 'beam', x: px, y: py, x2: o.x, y2: o.y, r: 2, t: 0, life: 0.2, col: [0xff6060, 0xffd060, 0x60ff90, 0x60c0ff, 0xc080ff][k % 5] });
            this.hit(f, o, e.dmg, null);
          });
        }
        audio.sfx('arcane_blast', 0.5);
        break;
      }
      case 'steal': {
        // their boosts, off them and on to it
        f.shield = Math.max(f.shield, o.shield);
        f.guard = Math.max(f.guard, o.guard);
        f.aura = Math.max(f.aura, o.aura);
        f.haste = Math.max(f.haste, o.haste, 2);
        o.shield = o.guard = o.aura = o.haste = o.invuln = 0;
        for (const k of ['b_fury', 'b_focus', 'b_evade', 'b_quicken', 'armour', 'u_giant', 'u_steal', 'u_echo']) {
          if (o.st[k]) f.st[k] = Math.max(f.st[k] ?? 0, o.st[k]);
          delete o.st[k];
        }
        this.fx.push({ kind: 'beam', x: o.x, y: o.y, x2: f.x, y2: f.y, r: 1.5, t: 0, life: 0.35, col: PALETTE.gold });
        this.floatNum(o, 0, PALETTE.gold, 'STOLEN ');
        this.hit(f, o, e.dmg, null);
        break;
      }
      case 'leash': {
        o.st.u_leash = e.t;
        let cd = 0;
        every(60, Math.round(e.t / 0.06), () => {
          cd -= 0.06;
          const dd = Math.hypot(o.x - f.x, o.y - f.y) || 1;
          if (dd > 50) {
            o.kx += ((f.x - o.x) / dd) * 140;
            o.ky += ((f.y - o.y) / dd) * 140;
            if (cd <= 0) {
              cd = 0.6;
              this.hit(f, o, e.dmg, null);
            }
          }
        });
        break;
      }
      case 'confuse':
        o.st.confused = Math.max(o.st.confused ?? 0, e.t);
        this.floatNum(o, 0, 0xffe060, 'DIZZY ');
        break;
      case 'nightmare': {
        // (it tears loose a fair way behind them, not on their heels)
        const [sx, sy] = inArena(o.x - ux * 56, o.y - uy * 56);
        this.minions.push({ owner: f, kind: 'shade', x: sx, y: sy, ang: 1, life: e.t + 1, hp: 0, cd: 0.4, dmg: e.dmg, t: 0 });
        this.cameras.main.flash(150, 40, 10, 60, false);
        audio.sfx('stinger', 0.6);
        break;
      }
      case 'net': {
        // a wide net, slower than a shot: dodge it
        const [tx, ty] = inArena(o.x, o.y);
        this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2: tx, y2: ty, r: 0.8, t: 0, life: 0.35, col: 0xfff4c0 });
        later(350, () => {
          for (let k = 0; k < 4; k++) this.fx.push({ kind: 'ring', x: tx, y: ty, r: 6 + k * 4, t: 0, life: 0.5, col: 0xfff4c0 });
          if (Math.hypot(o.x - tx, o.y - ty) < 16 + 5 * o.scale) {
            this.hit(f, o, e.dmg, null);
            if (!o.st.unstop) o.root = Math.max(o.root, e.t);
          }
        });
        break;
      }
      case 'trapdoll': {
        const [px, py] = inArena(f.x + ux * 14, f.y + uy * 14);
        this.minions.push({ owner: f, kind: 'doll', x: px, y: py, ang: 1, life: 6, hp: 8, cd: 0, dmg: e.dmg });
        break;
      }
      case 'banish':
        o.st.u_banish = e.t;
        this.fx.push({ kind: 'ring', x: o.x, y: o.y, r: 14, t: 0, life: 0.5, col: 0xc090e0 });
        every(1000, Math.round(e.t), () => (this.heal(f, BANISH_HEAL), this.floatNum(f, BANISH_HEAL, 0x8ae88a, '+')));
        audio.sfx('chime', 0.5);
        break;
      // ---- (5 Nov) the five new bosses' ultimates
      case 'hurricane': {
        // the whole arena whirls: round and round, and the debris hits
        const mx = ARENA.x + ARENA.w / 2;
        const my = ARENA.y + ARENA.h / 2;
        let cd = 0;
        every(50, Math.round(e.t / 0.05), () => {
          const dx2 = o.x - mx;
          const dy2 = o.y - my;
          const dd = Math.hypot(dx2, dy2) || 1;
          if (!o.st.anchor) {
            o.kx += (-dy2 / dd) * 70;
            o.ky += (dx2 / dd) * 70;
          }
          for (let k = 0; k < 2; k++) {
            const a = Math.random() * Math.PI * 2;
            const r = 20 + Math.random() * 70;
            this.fx.push({ kind: 'spark', x: mx + Math.cos(a) * r * 1.4, y: my + Math.sin(a) * r * 0.7, r: 2, t: 0, life: 0.25, col: 0xf0fff4 });
          }
          cd -= 0.05;
          if (cd <= 0) {
            cd = 0.5;
            this.hit(f, o, Math.max(1, Math.round(e.dps / 2)), null);
          }
        });
        this.cameras.main.shake(300, 0.004);
        audio.sfx('wind_gust', 0.8);
        break;
      }
      case 'pendulum': {
        // a blade hung from the top wall, swinging the width of the arena
        const px = ARENA.x + ARENA.w / 2;
        const py = ARENA.y + 2;
        const len = ARENA.h * 0.92;
        let time = 0;
        let cd = 0;
        every(40, Math.round(e.t / 0.04), () => {
          time += 0.04;
          cd -= 0.04;
          const a = Math.PI / 2 + Math.sin(time * 2.2) * 1.15;
          const x2 = px + Math.cos(a) * len;
          const y2 = py + Math.sin(a) * len;
          this.fx.push({ kind: 'beam', x: px, y: py, x2, y2, r: 1, t: 0, life: 0.05, col: 0x8a8a9a }, { kind: 'boom', x: x2, y: y2, r: 7, t: 0, life: 0.05, col: light });
          if (cd <= 0 && Math.hypot(o.x - x2, o.y - y2) < 9 + 5 * o.scale) {
            cd = 0.6;
            this.hit(f, o, e.dmg, null);
          }
        });
        audio.sfx('throw_whoosh', 0.6);
        break;
      }
      case 'judgement': {
        // a cross of light through them, the width and height of the arena
        const [jx, jy] = [o.x, o.y];
        this.fx.push({ kind: 'beam', x: ARENA.x, y: jy, x2: ARENA.x + ARENA.w, y2: jy, r: 0.8, t: 0, life: 1, col: 0xfff4c0 }, { kind: 'beam', x: jx, y: ARENA.y, x2: jx, y2: ARENA.y + ARENA.h, r: 0.8, t: 0, life: 1, col: 0xfff4c0 });
        later(1000, () => {
          this.fx.push({ kind: 'beam', x: ARENA.x, y: jy, x2: ARENA.x + ARENA.w, y2: jy, r: 6, t: 0, life: 0.4, col: 0xffffff }, { kind: 'beam', x: jx, y: ARENA.y, x2: jx, y2: ARENA.y + ARENA.h, r: 6, t: 0, life: 0.4, col: 0xffffff });
          this.cameras.main.flash(150, 255, 250, 210, false);
          if (Math.abs(o.y - jy) < 8 + 5 * o.scale || Math.abs(o.x - jx) < 8 + 5 * o.scale) this.hit(f, o, e.dmg, null);
          audio.sfx('arcane_blast', 0.8);
        });
        break;
      }
      case 'iceberg': {
        const [ix, iy] = inArena(o.x, o.y);
        this.fx.push({ kind: 'warn', x: ix, y: iy, r: 22, t: 0, life: 0.7, col: 0xbfe8ff });
        later(700, () => {
          this.fx.push({ kind: 'boom', x: ix, y: iy, r: 22, t: 0, life: 0.45, col: 0xe8fcff });
          this.cameras.main.shake(200, 0.008);
          const dd = Math.hypot(o.x - ix, o.y - iy);
          if (dd < 22 + 5 * o.scale) {
            this.hit(f, o, e.dmg, null);
            o.kx += ((o.x - ix) / (dd || 1)) * 320;
            o.ky += ((o.y - iy) / (dd || 1)) * 320;
          }
          // and it stays, as cover
          const parts: Prop[] = [[-7, 0], [7, 0], [0, -6]].map(([u, v]) => ({ x: Phaser.Math.Clamp(ix + u, ARENA.x + 6, ARENA.x + ARENA.w - 6), y: Phaser.Math.Clamp(iy + v, ARENA.y + 6, ARENA.y + ARENA.h - 6), r: 7, hp: 30, maxHp: 30 }));
          const clear = parts.filter((q) => Math.hypot(q.x - o.x, q.y - o.y) > q.r + BODY_R * o.scale + 2 && Math.hypot(q.x - f.x, q.y - f.y) > q.r + BODY_R * f.scale + 2);
          if (clear.length) {
            this.barriers.push({ kind: wallLook('glacier_slab', 'frost'), parts: clear, seed: 1, life: 6, max: 6, owner: null });
            this.props.push(...clear);
            this.repaintCover();
          }
          audio.sfx('glass_crack', 0.7);
        });
        break;
      }
      case 'constrict': {
        // a ring of fire round where they stand, tightening
        const [ccx, ccy] = [o.x, o.y];
        const n = Math.round(e.t / 0.1);
        let cd = 0;
        every(100, n, (k) => {
          const r = 42 - (30 * k) / n;
          for (let q = 0; q < 10; q++) {
            const a = (q / 10) * Math.PI * 2 + k * 0.25;
            this.fx.push({ kind: 'spark', x: ccx + Math.cos(a) * r, y: ccy + Math.sin(a) * r * 0.8, r: 3, t: 0, life: 0.12, col: q % 2 ? 0xff6a20 : 0xffb040 });
          }
          cd -= 0.1;
          const dd = Math.hypot((o.x - ccx), (o.y - ccy) / 0.8);
          if (cd <= 0 && Math.abs(dd - r) < 7 + 4 * o.scale) {
            cd = 0.5;
            this.hit(f, o, Math.max(1, Math.round(e.dps / 2)), null);
          }
        });
        audio.sfx('poison_hiss', 0.6);
        break;
      }
      case 'snowball':
        this.minions.push({ owner: f, kind: 'snowball', x: f.x + ux * 10, y: f.y + uy * 10, ang: 0, life: 3, hp: 0, cd: 0, dmg: e.dmg, vx: ux * 130, vy: uy * 130, size: 1 });
        audio.sfx('throw_whoosh', 0.5);
        break;
      default:
        break;
    }
  }

  /**
   * THE ULTIMATE ON THE HUD: your badge in the arena's bottom-right corner --
   * LOCKED with the seconds to go, READY and pulsing with its key, or
   * cooling with its seconds -- and the opponent's, small, top right.
   */
  private drawUlt(u: Phaser.GameObjects.Graphics): void {
    if (!this.ultText || !this.foeUltText) return;
    const show = !!this.me.ult && !this.over && !this.band && !this.touch;
    const w = 66;
    const x = ARENA.x + ARENA.w - w - 3;
    const y = ARENA.y + ARENA.h - 15;
    const f = this.me;
    const ready = f.ultT <= 0 && this.started;
    const locked = !f.ultUsed;
    if (show) {
      const pulse = 0.6 + Math.sin(this.time.now / 140) * 0.4;
      u.fillStyle(ready ? 0x3a1a58 : 0x10101c, 0.9).fillRect(x, y, w, 12);
      u.lineStyle(1, ready ? 0xffd45e : locked ? 0x4a4a68 : 0x9a6aff, ready ? pulse : 1).strokeRect(x, y, w, 12);
      if (!ready) u.fillStyle(locked ? 0x4a4a68 : 0x9a6aff, 0.8).fillRect(x + 1, y + 10, Math.round((w - 2) * (1 - f.ultT / (locked ? ULT_UNLOCK_S : ULT_COOLDOWN_S))), 1);
      // a star
      const sc = ready ? 0xffd45e : 0x8a8ab0;
      const pts: Phaser.Math.Vector2[] = [];
      for (let k = 0; k < 10; k++) {
        const ang = -Math.PI / 2 + (k * Math.PI) / 5;
        const r = k % 2 ? 2 : 4.6;
        pts.push(new Phaser.Math.Vector2(x + 7 + Math.cos(ang) * r, y + 6 + Math.sin(ang) * r));
      }
      u.fillStyle(sc, 1).fillPoints(pts, true);
    }
    // the opponent's chip: a dark plate so it reads over any floor
    const fo2 = this.foe;
    if (fo2.ult && !this.over && !this.training && this.foeUltText) {
      const tw = this.foeUltText.width + 6;
      const rdy = fo2.ultT <= 0 && this.started;
      u.fillStyle(0x10101c, 0.85).fillRect(ARENA.x + ARENA.w - 2 - tw, ARENA.y + 1, tw, 9);
      u.lineStyle(1, rdy ? 0xff6a6a : 0x4a4a68, 1).strokeRect(ARENA.x + ARENA.w - 2 - tw, ARENA.y + 1, tw, 9);
    }
    this.ultText.setVisible(show).setText(ready ? `ULT  [${relabelKeys('I')}]` : locked ? `LOCKED ${Math.ceil(f.ultT)}` : `ULT ${Math.ceil(f.ultT)}S`).setTint(ready ? 0xffd45e : locked ? 0x8a8ab0 : 0xc8a8ff);
    const fo = this.foe;
    const foeShow = !!fo.ult && !this.over && !this.training;
    this.foeUltText.setVisible(foeShow).setText(fo.ultT <= 0 && this.started ? 'FOE ULT READY' : `FOE ULT ${Math.ceil(fo.ultT)}S`).setTint(fo.ultT <= 0 && this.started ? 0xff8a8a : 0xb0b0d0);
  }

  private burst(f: Fighter, x: number, y: number, r: number, dmg: number, a: Attack, look: 'ring' | 'boom', again = true): void {
    const col = ELEMENTS[f.c.element].col;
    this.fx.push(look === 'ring' ? { kind: 'ring', x, y, r, t: 0, life: 0.35, col } : { kind: 'boom', x, y, r, t: 0, life: 0.35, col });
    const o = this.other(f);
    const d = Math.hypot(o.x - x, o.y - y);
    if (a.mod === 'vortex' && d < r * 2.2 && o.hp > 0) {
      // in towards the middle, from twice as far as it hits
      const m = d || 1;
      o.kx += ((x - o.x) / m) * 200;
      o.ky += ((y - o.y) / m) * 200;
      this.fx.push({ kind: 'ring', x, y, r: r * 2.2, t: 0, life: 0.5, col: ELEMENTS[f.c.element].light });
    }
    if (d < r + 7 * o.scale) this.hit(f, o, dmg, a);
    if (a.mod === 'linger') this.pool(f, x, y, Math.max(12, r * 0.7));
    if (a.mod === 'echo' && again) this.time.delayedCall(600, () => !this.over && this.burst(f, x, y, r, Math.round(dmg * 0.5), a, look, false));
  }

  /** A shot's special, steering it while it flies. */
  private flight(s: Shot, dt: number): void {
    const sp = Math.hypot(s.vx, s.vy);
    switch (s.a.mod) {
      case 'homing': {
        // turns towards them, but only so fast: a sidestep still beats it
        const o = this.other(s.owner);
        const want = Math.atan2(o.y - s.y, o.x - s.x);
        let d = want - s.ang;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.ang += Phaser.Math.Clamp(d, -3.2 * dt, 3.2 * dt);
        s.vx = Math.cos(s.ang) * sp;
        s.vy = Math.sin(s.ang) * sp;
        break;
      }
      case 'wave': {
        const a = s.ang + Math.sin(s.t * 13) * 0.75;
        s.vx = Math.cos(a) * sp;
        s.vy = Math.sin(a) * sp;
        break;
      }
      case 'boomerang':
        if (!s.back && s.life < 0.5) {
          s.back = true;
          s.vx = -s.vx;
          s.vy = -s.vy;
          s.ang += Math.PI;
          s.life = 0.5;
        }
        break;
      default:
        break;
    }
  }

  /** A splitting shot, done: three shards on from where it stopped. */
  private shatter(s: Shot): void {
    const sp = Math.hypot(s.vx, s.vy) * 0.8 || 150;
    for (const k of [-0.6, 0, 0.6]) {
      const a = s.ang + k;
      this.shots.push({
        owner: s.owner, x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35, dmg: Math.max(1, Math.round(s.dmg * 0.4)),
        a: { ...s.a, mod: 'none' }, pierce: s.pierce, t: 0, ang: a, grace: 0.12,
      });
    }
  }

  /** A burning patch on the floor: it hurts the other one while they stand in it. */
  private pool(f: Fighter, x: number, y: number, r: number): void {
    this.pools.push({ owner: f, x, y, r, t: LINGER_S, tick: 0 });
  }

  private other(f: Fighter): Fighter {
    return f === this.me ? this.foe : this.me;
  }

  /** Damage, its element's effect, and the numbers. */
  private hit(from: Fighter, to: Fighter, dmg: number, a: Attack | null): void {
    if (this.over || to.hp <= 0 || to.invuln > 0 || to.st.cage || to.st.under || to.st.u_banish) return;
    // (an enraged boss hits harder)
    if (this.boss && from === this.foe && this.bossRage) dmg = Math.round(dmg * 1.15);
    // up in an updraft: nothing on the floor or charging along it reaches
    if (to.st.air && (!a || a.kind === 'dash' || a.kind === 'mine')) return;
    const shotLike = !!a && (a.kind === 'bolt' || a.kind === 'spread' || a.kind === 'snare' || a.kind === 'arc');
    // a gulp: the shot is swallowed, and it does them good
    if (to.st.gulp && shotLike) {
      to.st.gulp = 0;
      this.heal(to, Math.round(to.max * 0.22));
      this.floatNum(to, 0, 0x8ae88a, 'GULP ');
      return;
    }
    // a ring of hail: each stone takes one shot
    if ((to.st.hail ?? 0) > 0 && (to.st.n_hail ?? 0) > 0 && shotLike) {
      to.st.n_hail -= 1;
      this.fx.push({ kind: 'spark', x: to.x, y: to.y - 4, r: 6, t: 0, life: 0.2, col: 0xe8fcff });
      return;
    }
    // a sponge puff (ultimate) soaks it up, to fire back when it ends
    if ((to.st.u_absorb ?? 0) > 0 && shotLike) {
      to.st.n_abs = (to.st.n_abs ?? 0) + 1;
      this.fx.push({ kind: 'spark', x: to.x, y: to.y, r: 8, t: 0, life: 0.2, col: 0x9ad0ff });
      return;
    }
    // a counter stance (ultimate): blocked, and it is behind them, striking
    if ((to.st.u_counter ?? 0) > 0 && from !== to && dmg > 0) {
      to.st.u_counter = 0;
      const ang = Math.atan2(to.y - from.y, to.x - from.x);
      to.x = Phaser.Math.Clamp(from.x - Math.cos(ang) * 16, ARENA.x + 8, ARENA.x + ARENA.w - 8);
      to.y = Phaser.Math.Clamp(from.y - Math.sin(ang) * 12, ARENA.y + 8, ARENA.y + ARENA.h - 8);
      to.face = from.x >= to.x ? 1 : -1;
      this.fx.push({ kind: 'boom', x: from.x, y: from.y, r: 12, t: 0, life: 0.3, col: 0xffffff });
      this.floatNum(to, 0, 0xffffff, 'COUNTER ');
      this.hit(to, from, to.st.n_counter ?? 20, null);
      return;
    }
    // a bright coil soaks it up, and stores it for the next shot out
    if (to.st.coil && shotLike) {
      to.st.n_charge = (to.st.n_charge ?? 0) + 2;
      this.fx.push({ kind: 'spark', x: to.x, y: to.y, r: 8, t: 0, life: 0.2, col: 0xffffff });
      return;
    }
    // inside a star shell: nothing lands, but it is all remembered
    if (to.st.starShell) {
      to.st.n_stored = (to.st.n_stored ?? 0) + dmg;
      this.fx.push({ kind: 'spark', x: to.x, y: to.y, r: 9, t: 0, life: 0.2, col: 0xfff0c0 });
      return;
    }
    // EVASION: some of what comes at it simply misses
    if ((to.st.b_evade ?? 0) > 0 && dmg > 0 && Math.random() < EVADE_CHANCE) {
      this.floatNum(to, 0, 0xb8e8ff, 'MISS ');
      return;
    }
    if (to.shield > 0 || to.guard > 0) {
      this.fx.push({ kind: 'spark', x: to.x, y: to.y, r: 10, t: 0, life: 0.2, col: 0xffffff });
      to.guard = 0;
      // spikes on the shield: hitting it hurts
      if (to.shield > 0 && to.shieldMod === 'thorns' && a && from.hp > 0) {
        from.hp = Math.max(0, from.hp - THORNS_DMG);
        from.flash = 0.12;
        this.floatNum(from, THORNS_DMG, 0xffe060);
      }
      return;
    }
    let d = dmg;
    if (to.c.element === 'stone') d *= 0.85;
    // what the specials already on them, and on you, add
    if (to.shred > 0) d *= SHRED_MUL;
    if (from.weak > 0) d *= WEAK_MUL;
    if (to.marked > 0 && a) {
      d *= MARK_MUL;
      to.marked = 0;
    }
    const m = a?.mod ?? 'none';
    if ((m === 'execute' || a?.sp === 'heat_lance') && to.hp < to.max * 0.4) d *= EXECUTE_MUL;
    if (to.st.armour) d *= 0.6;
    if (to.st.stone) d *= 0.5;
    // a giant shrugs off part of every hit
    if ((to.st.u_giant ?? 0) > 0) d *= GIANT_TAKEN;
    // frozen in ice: the first hit shatters it, hard
    if ((to.st.u_ice ?? 0) > 0) {
      d *= ICE_SHATTER;
      to.st.u_ice = 0;
      to.stun = 0;
      this.fx.push({ kind: 'boom', x: to.x, y: to.y, r: 12, t: 0, life: 0.3, col: 0xe8fcff });
    }
    // a duel, or the hunt: its hits land harder on them
    if ((from.st.u_duel ?? 0) > 0) d *= DUEL_MUL;
    if ((from.st.u_hunt ?? 0) > 0 && from !== to) d *= HUNT_MUL;
    // a shadow step's next hit, and a coil's stored shots
    if (from.st.crit2 && a) {
      d *= 2;
      from.st.crit2 = 0;
    }
    if ((from.st.n_charge ?? 0) > 0 && a && shotLike) {
      d += from.st.n_charge;
      from.st.n_charge = 0;
    }
    if ((to.st.n_bark ?? 0) > 0) {
      d -= 10;
      to.st.n_bark -= 1;
    }
    // A SUCKER PUNCH is only fair if the fight is: out of hiding, or on
    // someone stunned, held or blind, it lands double and takes their buffs
    if (a?.sp === 'sucker_punch' && ((from.st.n_hidden ?? 0) > 0 || to.stun > 0 || to.root > 0 || to.blind > 0)) {
      d *= 2;
      to.aura = to.shield = to.guard = 0;
      for (const k of ['b_fury', 'b_focus', 'b_evade', 'b_quicken', 'armour']) delete to.st[k];
      this.floatNum(to, 0, 0xc090e0, 'STOLEN ');
    }
    // up from playing dead: the next hit is a mean one
    if (from.st.ambush && a) {
      from.st.ambush = 0;
      d *= 1.5;
    }
    // out of the water: the lurker's first bite
    if ((from.st.n_lurk ?? 0) > 0 && a) {
      from.st.n_lurk = 0;
      d *= 1.8;
      to.root = Math.max(to.root, 0.8);
    }
    if (a) from.st.n_hidden = 0;
    // FURY: its hits land harder while it lasts
    if ((from.st.b_fury ?? 0) > 0 && a) d *= FURY_MUL;
    let crit = false;
    // (FOCUS adds its chance to a move's own, or gives a plain one a chance)
    const critChance = (m === 'crit' ? 0.25 : 0) + ((from.st.b_focus ?? 0) > 0 && a ? FOCUS_CRIT : 0);
    if (critChance > 0 && Math.random() < critChance) {
      d *= 2;
      crit = true;
    }
    // (a move that does no damage still does its special)
    d = dmg > 0 ? Math.max(1, Math.round(d)) : 0;
    // stone skin (ultimate): it soaks what it can
    if ((to.st.n_skin ?? 0) > 0 && d > 0) {
      const soak = Math.min(d, to.st.n_skin);
      to.st.n_skin -= soak;
      d -= soak;
      this.fx.push({ kind: 'spark', x: to.x, y: to.y, r: 9, t: 0, life: 0.2, col: 0xd0c4a8 });
      if (d <= 0) return;
    }
    // a soul link (ultimate): half of it goes to the one it is linked to
    if ((to.st.u_link ?? 0) > 0 && from !== to && d > 1) {
      const half = Math.floor(d / 2);
      d -= half;
      from.hp = Math.max(0, from.hp - half);
      from.flash = 0.12;
      this.floatNum(from, half, 0xc090e0);
      this.fx.push({ kind: 'beam', x: to.x, y: to.y, x2: from.x, y2: from.y, r: 1.2, t: 0, life: 0.2, col: 0xc090e0 });
    }
    to.hp = Math.max(0, to.hp - d);
    // a phoenix (ultimate): beaten, and up again from the ashes
    if (to.hp <= 0 && (to.st.u_phoenix ?? 0) > 0) {
      to.st.u_phoenix = 0;
      to.hp = Math.max(1, Math.round(to.max * (to.st.n_phoenix ?? 0.3)));
      to.invuln = Math.max(to.invuln, 1);
      this.cameras.main.flash(200, 255, 160, 60, false);
      for (let k = 0; k < 3; k++) this.fx.push({ kind: 'ring', x: to.x, y: to.y, r: (10 + k * 8) * to.scale, t: 0, life: 0.6, col: 0xffb040 });
      this.floatNum(to, 0, 0xffb040, 'REBORN ');
    }
    to.flash = 0.12;
    // an ultimate's lifesteal: its hits feed it
    if ((from.st.u_steal ?? 0) > 0 && d > 0) this.heal(from, Math.round(d * LIFESTEAL_FRAC));
    if (d > 0) {
      // any hit wakes a sleeper; a capacitor counts it
      to.st.sleep = 0;
      if (to.st.capacitor) to.st.n_cap = (to.st.n_cap ?? 0) + 1;
      // dusted with pollen: the bee feeds on every hit
      if (to.st.pollen) this.heal(from, 3);
      // out of an eel's dive: the first hit stuns
      if ((from.st.n_eel ?? 0) > 0) {
        from.st.n_eel = 0;
        to.stun = Math.max(to.stun, 0.6);
      }
    }
    // the number, rising off whoever took it
    this.floatNum(to, d, to === this.me ? 0xff8a8a : 0xffe060, crit ? 'CRIT ' : '');
    this.fx.push({ kind: 'spark', x: to.x, y: to.y - 4, r: 6, t: 0, life: 0.25, col: ELEMENTS[from.c.element].light });
    audio.sfx('whack', 0.3);
    if (a) {
      if (a.sp) this.onHitSp(from, to, a);
      // ---- THE MOVE'S OWN SPECIAL
      const away = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      const ux = (to.x - from.x) / away;
      const uy = (to.y - from.y) / away;
      switch (m) {
        case 'poison':
          to.poison = POISON_S;
          break;
        case 'mark':
          to.marked = MARK_S;
          break;
        case 'shred':
          to.shred = SHRED_S;
          break;
        case 'drain':
          this.heal(from, Math.round(d * DRAIN_FRAC));
          break;
        case 'pull':
          to.kx -= ux * 170;
          to.ky -= uy * 170;
          break;
        case 'push':
          to.kx += ux * 230;
          to.ky += uy * 230;
          break;
        case 'root':
          if (!to.st.unstop) to.root = Math.max(to.root, HOLD_S);
          break;
        case 'silence':
          for (let i = 0; i < 3; i++) to.cds[i] += SILENCE_S;
          break;
        case 'weaken':
          to.weak = WEAK_S;
          break;
        case 'chill':
          to.chill = CHILL_S;
          break;
        case 'stagger':
          to.stun = Math.max(to.stun, STAGGER_S);
          break;
        default:
          break;
      }
      switch (from.c.element) {
        case 'ember':
          to.burn = 3;
          break;
        case 'tide': {
          const m = Math.hypot(to.x - from.x, to.y - from.y) || 1;
          to.kx += ((to.x - from.x) / m) * 140;
          to.ky += ((to.y - from.y) / m) * 140;
          break;
        }
        case 'moss':
          this.heal(from, Math.round(d * 0.25));
          break;
        case 'frost':
          to.slow = 2;
          break;
        case 'volt':
          if (to.stunImmune <= 0) {
            to.stun = 0.35;
            to.stunImmune = 1.5;
          }
          break;
        case 'murk':
          to.blind = 2.5;
          break;
        case 'gale':
          // landing a hit puts wind under you
          from.haste = Math.max(from.haste, 1);
          break;
        default:
          break;
      }
    }
  }

  /** A number rising off whoever took it. */
  private floatNum(to: Fighter, d: number, col: number, pre = ''): void {
    // (a word with nothing to count -- MISS, GULP, EVASION -- is the word alone)
    const n = text(this, to.x, to.y - 14 * to.scale, d === 0 && pre ? pre.trim() : `${pre}${d}`, col).setOrigin(0.5, 1).setDepth(58);
    this.tweens.add({ targets: n, y: n.y - 10, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => n.destroy() });
  }

  private blocked(x1: number, y1: number, x2: number, y2: number, by?: Fighter): boolean {
    // (a wall never blocks the one who put it up)
    return this.props.some((p) => (!by || p.owner !== by) && this.segDist(p.x, p.y, x1, y1, x2, y2) < p.r);
  }

  private segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l = dx * dx + dy * dy || 1;
    const t = Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / l, 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  /** Move with walls, cover and knockback; true if it got anywhere. */
  private step(f: Fighter, vx: number, vy: number, dt: number): void {
    // (the size it is drawn at: a big boss stops at the cover with its body,
    // not with a point in its middle)
    const r = BODY_R * f.scale;
    // (blubber: nothing knocks it back while it lasts)
    if (f.st.anchor) f.kx = f.ky = 0;
    // afraid: it runs from them, whatever it meant to do
    if (f.st.u_fear) {
      const o = this.other(f);
      const d = Math.hypot(f.x - o.x, f.y - o.y) || 1;
      const sp = Math.max(Math.hypot(vx, vy), f.c.speed * 0.8);
      vx = ((f.x - o.x) / d) * sp;
      vy = ((f.y - o.y) / d) * sp;
    }
    // banished: nowhere
    if (f.st.u_banish) vx = vy = 0;
    let nx = f.x + (vx + f.kx) * dt;
    let ny = f.y + (vy + f.ky) * dt;
    f.kx *= Math.pow(0.02, dt);
    f.ky *= Math.pow(0.02, dt);
    nx = Phaser.Math.Clamp(nx, ARENA.x + r, ARENA.x + ARENA.w - r);
    ny = Phaser.Math.Clamp(ny, ARENA.y + r, ARENA.y + ARENA.h - r);
    // (phasing: cover is not there for it)
    if (!f.st.phase) {
      for (const p of this.props) {
        if (p.owner === f) continue; // its own wall lets it through
        const d = Math.hypot(nx - p.x, ny - p.y);
        if (d < p.r + r) {
          const k = (p.r + r - d) / (d || 1);
          nx += (nx - p.x) * k;
          ny += (ny - p.y) * k;
          // driven into cover by a bellows ram: it hurts
          if (f.st.slam) {
            f.st.slam = 0;
            const o = this.other(f);
            this.hit(o, f, 8, null);
            f.stun = Math.max(f.stun, 0.4);
            this.fx.push({ kind: 'spark', x: nx, y: ny, r: 10, t: 0, life: 0.3, col: 0xffffff });
          }
        }
      }
    }
    f.moving = Math.hypot(nx - f.x, ny - f.y) > 0.2;
    f.x = nx;
    f.y = ny;
  }

  private speedOf(f: Fighter): number {
    if (f.root > 0 || !this.canAct(f)) return 0;
    let k = (f.slow > 0 ? 0.55 : 1) * (f.chill > 0 ? CHILL_SPEED : 1) * (f.aura > 0 ? AURA_SPEED : 1) * (f.haste > 0 ? HASTE_SPEED : 1);
    if (f.st.armour) k *= 0.7;
    if (f.st.rain) k *= 0.8;
    // a sheep is not quick
    if (f.st.u_poly) k *= 0.7;
    if (f.st.curl) k *= 1.3;
    // spiderlings hanging off it
    k *= Math.pow(0.85, this.minions.filter((mi) => mi.kind === 'spiderling' && mi.latched && mi.owner !== f).length);
    // the floor under it
    for (const pl of this.pools) {
      if (Math.hypot(pl.x - f.x, pl.y - f.y) > pl.r) continue;
      if (pl.kind === 'honey' && pl.owner !== f) k *= 0.4;
      if (pl.kind === 'stink' && pl.owner !== f) k *= 0.85;
      if (pl.kind === 'floe') k *= pl.owner === f ? 1.4 : 0.6;
      if (pl.kind === 'drift' && pl.owner !== f) k *= 0.5;
    }
    // submerged: creeping along under the surface
    if (f.st.sunk) k *= 0.7;
    if (f.st.comet && this.pools.some((pl) => pl.kind === 'trail' && pl.owner === f && Math.hypot(pl.x - f.x, pl.y - f.y + 5) < 8)) k *= 1.5;
    // (an enraged boss comes at you faster)
    if (this.boss && f === this.foe && this.bossRage) k *= 1.15;
    return f.c.speed * k;
  }

  /**
   * ---- A BOSS IS A PRESENCE.  Every mechanic it casts goes out with a roar:
   * its cry, a shockwave off its body and the ground shaking.  The roar that
   * starts its second phase is the big one -- ENRAGED over its head, a red
   * burst, the arena rocking -- and from then on it is red-rimmed and quick.
   */
  private bossRoar(rage: boolean): void {
    const foe = this.foe;
    if (!this.boss || this.over || foe.hp <= 0) return;
    const col = ELEMENTS[foe.c.element];
    this.fx.push({ kind: 'ring', x: foe.x, y: foe.y, r: rage ? 56 : 30, t: 0, life: rage ? 0.8 : 0.5, col: rage ? 0xff4a3a : col.light });
    this.fx.push({ kind: 'spark', x: foe.x, y: foe.y, r: rage ? 22 : 14, t: 0, life: 0.5, col: rage ? 0xffb060 : col.col });
    this.cameras.main.shake(rage ? 380 : 160, rage ? 0.01 : 0.004);
    audio.sfx(foe.c.cry, rage ? 0.8 : 0.5);
    if (!rage) return;
    audio.sfx('arcane_blast', 0.6);
    foe.flash = 0.3;
    const t = centerText(this, foe.x, foe.y - 24 * foe.scale, 'ENRAGED!', 0xff6a4a).setDepth(60);
    backPlate(this, t, 0xff6a4a);
    this.tweens.add({ targets: t, y: t.y - 10, scale: { from: 1.6, to: 1 }, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 1300, duration: 400, onComplete: () => t.destroy() });
  }

  private tickFighter(f: Fighter, dt: number): void {
    // (QUICKEN: the cooldowns run faster while it lasts)
    const cdRate = (f.st.b_quicken ?? 0) > 0 ? QUICK_RATE : 1;
    for (let i = 0; i < 3; i++) f.cds[i] = Math.max(0, f.cds[i] - dt * cdRate);
    // (the ultimate's clock runs only while the fight is on)
    if (this.started && !this.over) f.ultT = Math.max(0, f.ultT - dt);
    // (a rewind needs to know where it was: four times a second, the last 3 s)
    f.histT = (f.histT ?? 0) - dt;
    if (f.histT <= 0) {
      f.histT = 0.25;
      (f.hist ??= []).push([f.x, f.y, f.hp]);
      if (f.hist.length > 13) f.hist.shift();
    }
    // THE ADMIN'S NO-COOLDOWN TEST (core/gameConfig clash.noCooldown, test
    // zone only): your moves and your ultimate are always ready
    if (f === this.me && this.noCooldown) {
      for (let i = 0; i < 3; i++) f.cds[i] = 0;
      f.ultT = 0;
    }
    for (const k of ['slow', 'stun', 'stunImmune', 'blind', 'shield', 'invuln', 'aura', 'root', 'flash'] as const) f[k] = Math.max(0, f[k] - dt);
    if (f.burn > 0) {
      const before = Math.floor(f.burn);
      f.burn = Math.max(0, f.burn - dt);
      if (Math.floor(f.burn) !== before) {
        f.hp = Math.max(0, f.hp - 2);
        this.fx.push({ kind: 'spark', x: f.x, y: f.y - 6, r: 4, t: 0, life: 0.2, col: 0xff8a3a });
      }
    }
    // the specials that wear off, and the ones that tick
    for (const k of ['poison', 'marked', 'shred', 'weak', 'chill', 'haste', 'regen', 'guard'] as const) f[k] = Math.max(0, f[k] - dt);
    if (f.shield <= 0) f.shieldMod = null;
    if (f.regen > 0) this.heal(f, REGEN_PER_S * dt);
    this.tickSpecials(f, dt);
    if (f.poison > 0) {
      const before = Math.ceil(f.poison + dt);
      if (Math.ceil(f.poison) !== before && f.hp > 0) {
        f.hp = Math.max(0, f.hp - POISON_PER_S);
        this.fx.push({ kind: 'spark', x: f.x, y: f.y - 6, r: 4, t: 0, life: 0.2, col: 0x8ae86a });
      }
    }
    if (f.dash) {
      f.dash.t -= dt;
      // a belly slide off a wall: it bounces once and carries on
      if (f.dash.a.sp === 'belly_slide' && !f.dash.bounced) {
        const nx0 = f.x + f.dash.vx * dt;
        const ny0 = f.y + f.dash.vy * dt;
        const p = this.props.find((q) => Math.hypot(q.x - nx0, q.y - ny0) < q.r + 6 * f.scale);
        if (p) {
          const d = Math.hypot(nx0 - p.x, ny0 - p.y) || 1;
          const nx = (nx0 - p.x) / d;
          const ny = (ny0 - p.y) / d;
          const dot = f.dash.vx * nx + f.dash.vy * ny;
          f.dash.vx -= 2 * dot * nx;
          f.dash.vy -= 2 * dot * ny;
          f.dash.bounced = true;
          f.dash.t = Math.max(f.dash.t, 0.14);
        }
      }
      this.step(f, f.dash.vx, f.dash.vy, dt);
      // a burning trail behind a lingering charge
      if (f.dash.a.mod === 'linger' && !f.dash.flee && Math.random() < dt * 14) this.pool(f, f.x, f.y, 9);
      const o = this.other(f);
      if (!f.dash.hit && Math.hypot(o.x - f.x, o.y - f.y) < 7 * (o.scale + f.scale)) {
        f.dash.hit = true;
        this.hit(f, o, f.dash.dmg, f.dash.a);
      }
      if (f.dash && f.dash.t <= 0) {
        // an echoing charge: a shockwave where it stopped
        if (f.dash.a.mod === 'echo' && !f.dash.flee) this.burst(f, f.x, f.y, 24, Math.round(f.dash.dmg * 0.5), f.dash.a, 'ring', false);
        // hit and run: back where it came from
        const back = f.dash.back && f.ref.retX !== undefined;
        const a = f.dash.a;
        f.dash = null;
        if (back) {
          const dx = f.ref.retX! - f.x;
          const dy = f.ref.retY! - f.y;
          f.dash = { vx: dx / 0.25, vy: dy / 0.25, t: 0.25, dmg: 0, hit: true, a: { ...a, sp: undefined, mod: 'none' } };
          f.ref.retX = undefined;
        }
      }
    }
  }

  // ---------------------------------------------------------------------- AI

  private think(dt: number, f: Fighter = this.foe, me: Fighter = this.me, B: Brain = this.foeBrain): void {
    // ---- ITS ULTIMATE, by the same clock as yours: once it is up, fired
    // when it would do some good (a heal when hurt, the rest in range)
    if (f.ult && f.ultT <= 0 && this.started && this.canAct(f) && !f.dash) {
      const d = Math.hypot(me.x - f.x, me.y - f.y);
      const lead = f.ult.fx[0].k;
      const want = lead === 'heal' ? f.hp < f.max * 0.6 : lead === 'shield' || lead === 'invuln' ? d < f.ult.range || f.hp < f.max * 0.4 : d < f.ult.range;
      if (want && Math.random() < dt * (0.8 + this.skill * 2)) this.useUlt(f);
    }
    // WHAT IT THINKS IS YOU: a decoy draws it while it lasts, and a you it
    // cannot see is wherever it last saw you
    const decoy = this.minions.find((mi) => mi.kind === 'decoy' && mi.owner === me);
    // blinded, it sees only what is close; past that, you are where it last saw you
    const lost = me.st.invis || (f.blind > 0 && Math.hypot(me.x - f.x, me.y - f.y) > BLIND_SEE);
    if (!lost) {
      me.ref.seenX = me.x;
      me.ref.seenY = me.y;
    }
    const p: Fighter = decoy
      ? { ...me, x: decoy.x, y: decoy.y }
      : lost
        ? { ...me, x: me.ref.seenX ?? me.x, y: me.ref.seenY ?? me.y }
        : me;
    if (!this.canAct(f) || f.dash || f.hp <= 0 || f.st.carried) return;
    const sk = this.skill;
    const dx = p.x - f.x;
    const dy = p.y - f.y;
    const dist = Math.hypot(dx, dy) || 1;
    const clear = !this.blocked(f.x, f.y, p.x, p.y, f) || f.c.element === 'glow';
    // aim: worse when blinded, better the sharper it is -- and a sharp one
    // shoots where you are GOING, not where you were
    const lead = sk > 0.5 ? (sk - 0.5) * 2 * Math.min(0.5, dist / 200) : 0;
    const tx = p.x + B.vel.x * lead;
    const ty = p.y + B.vel.y * lead;
    const err = (f.blind > 0 ? 0.6 : 0.3 - 0.24 * sk) * (Math.random() - 0.5) * 2;
    const ang = Math.atan2(ty - f.y, tx - f.x) + err;
    const ax = Math.cos(ang);
    const ay = Math.sin(ang);
    if (f.root > 0) {
      // held: it can still shoot, it just cannot go anywhere
      if (f.cds[0] <= 0 && clear) this.fire(f, 0, ax, ay);
      return;
    }
    B.ai.think -= dt;
    if (B.ai.think <= 0) {
      B.ai.think = 0.9 - 0.45 * sk + Math.random() * 0.5;
      if (Math.random() < 0.3) B.ai.strafe *= -1;
    }
    const ux = dx / dist;
    const uy = dy / dist;
    const spd = this.speedOf(f);
    let vx: number;
    let vy: number;
    // ---- A SHOT COMING: a good fighter sees it and steps out of its way
    if (B.dodge.t <= 0) {
      for (const s of this.shots) {
        if (s.owner === f || s.arc || B.seen.has(s)) continue;
        const rx = f.x - s.x;
        const ry = f.y - s.y;
        const sp = Math.hypot(s.vx, s.vy) || 1;
        const ahead = (rx * s.vx + ry * s.vy) / sp;
        if (ahead <= 0 || ahead > 60) continue;
        B.seen.add(s);
        // where it passes, how close
        const miss = Math.abs(rx * s.vy - ry * s.vx) / sp;
        if (miss > 10 * f.scale || Math.random() > sk * 0.85) continue;
        const side = rx * s.vy - ry * s.vx >= 0 ? 1 : -1;
        Object.assign(B.dodge, { vx: (s.vy / sp) * side, vy: (-s.vx / sp) * side, t: 0.28 });
        break;
      }
    }
    if (B.dodge.t > 0) {
      B.dodge.t -= dt;
      vx = B.dodge.vx * spd * 1.3;
      vy = B.dodge.vy * spd * 1.3;
    } else if (!clear && (sk >= 0.4 || this.boss)) {
      // ---- NO LINE ON YOU: work round the cover to somewhere that has one
      const spot = this.sightSpot(f, false, me);
      const mx = (spot?.x ?? p.x) - f.x;
      const my = (spot?.y ?? p.y) - f.y;
      const m = Math.hypot(mx, my) || 1;
      vx = (mx / m) * spd;
      vy = (my / m) * spd;
    } else {
      // close in to fight up close (a swipe, a burst, a charge), hang back for the shots
      const melee = f.c.attacks[0].kind === 'beam' && f.c.attacks[0].reach < 50;
      const want = melee || (f.cds[2] <= 0 && f.c.attacks[2].kind === 'nova') ? 26 : 85;
      const toward = dist > want + 10 ? 1 : dist < want - 10 ? -1 : 0;
      vx = (ux * toward + -uy * B.ai.strafe * 0.7) * spd;
      vy = (uy * toward + ux * B.ai.strafe * 0.7) * spd;
    }
    if (f.st.confused) {
      vx = -vx;
      vy = -vy;
    }
    if (f.st.curl) {
      vx = ux * spd;
      vy = uy * spd;
    }
    if (f.st.slick) {
      vx = (f.ref.vx ?? 0) + (vx - (f.ref.vx ?? 0)) * Math.min(1, dt * 2.5);
      vy = (f.ref.vy ?? 0) + (vy - (f.ref.vy ?? 0)) * Math.min(1, dt * 2.5);
    }
    f.ref.vx = vx;
    f.ref.vy = vy;
    this.step(f, vx, vy, dt);
    // stuck on something: go round it the other way
    const moved = Math.hypot(f.x - B.last.x, f.y - B.last.y);
    B.last.stuck = moved < spd * dt * 0.25 && spd > 0 ? B.last.stuck + dt : 0;
    if (B.last.stuck > 0.35) {
      B.ai.strafe *= -1;
      B.last.stuck = 0;
      Object.assign(B.dodge, { vx: -uy * B.ai.strafe, vy: ux * B.ai.strafe, t: 0.4 });
    }
    B.last.x = f.x;
    B.last.y = f.y;
    f.face = dx >= 0 ? 1 : -1;
    // ---- WHICH MOVE.  Each special says when it is for (specials `ai`);
    // the plain attack goes whenever it can reach.
    for (const i of [2, 1]) {
      const a = f.c.attacks[i];
      if (f.cds[i] > 0 || !this.wants(f, a, dist, clear)) continue;
      // a getaway goes away from you, sideways; everything else at you
      const away = SPECIALS[a.sp ?? '']?.ai === 'escape';
      const bx = away ? -ux * 0.6 - uy * B.ai.strafe : ax;
      const by = away ? -uy * 0.6 + ux * B.ai.strafe : ay;
      if (this.fire(f, i, bx * Math.max(dist, 40), by * Math.max(dist, 40))) return;
    }
    const n = f.c.attacks[0];
    const inReach = n.kind === 'beam' ? dist < n.reach * f.scale + 6 * p.scale : dist < 170;
    if (f.cds[0] <= 0 && (clear || n.kind === 'arc') && inReach && Math.random() < dt * (1.2 + 2.4 * sk) * (n.kind === 'beam' ? 3 : 1)) this.fire(f, 0, ax, ay);
  }

  /** Is now the moment for this special? */
  private wants(f: Fighter, a: Attack, dist: number, clear: boolean): boolean {
    const use = SPECIALS[a.sp ?? '']?.ai ?? 'poke';
    const range =
      a.kind === 'dash' ? a.reach * 0.28 + 12
      : a.kind === 'nova' ? a.reach * f.scale + 8
      : a.kind === 'beam' ? a.reach * f.scale + 4
      : a.kind === 'arc' ? a.reach * 0.75
      : a.kind === 'mine' ? 90
      : a.reach * 0.9;
    // a dash on the way out: hurt, crowded, and already backing off -- the
    // same getaway the player gets by dashing while walking away
    if (a.kind === 'dash' && f.hp < f.max * 0.35 && dist < 55) {
      const o = this.other(f);
      const away = (f.ref.vx ?? 0) * (o.x - f.x) + (f.ref.vy ?? 0) * (o.y - f.y) < 0;
      if (away) return true;
    }
    switch (use) {
      case 'poke':
        return clear && dist < range;
      case 'close':
        return dist < range && (clear || a.kind === 'nova');
      case 'mid':
        return dist < 170;
      case 'self':
        return true;
      case 'defend':
        return dist < 34 || this.shots.some((s) => s.owner !== f && Math.hypot(s.x - f.x, s.y - f.y) < 45);
      case 'escape':
        return dist < 40 || (f.hp < f.max * 0.35 && dist < 90);
      case 'heal':
        return f.hp < f.max * 0.55;
      case 'hidden':
        return dist < range && (!clear || dist > 60);
      case 'never':
        return false;
    }
  }

  /**
   * A place near you that has a clear line to you, for `f` to get to: the
   * nearest such spot to it (walking), or any good one (blinking in).
   */
  private sightSpot(f: Fighter, anywhere: boolean, p: Fighter = this.me): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const rad of [70, 50, 95]) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const x = p.x + Math.cos(a) * rad;
        const y = p.y + Math.sin(a) * rad * 0.8;
        if (x < ARENA.x + 10 || x > ARENA.x + ARENA.w - 10 || y < ARENA.y + 10 || y > ARENA.y + ARENA.h - 10) continue;
        if (this.props.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + 7 * f.scale)) continue;
        if (this.blocked(x, y, p.x, p.y)) continue;
        const d = anywhere ? Math.random() : Math.hypot(x - f.x, y - f.y);
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
      if (best) return best;
    }
    return best;
  }

  /**
   * The dummy: it wanders a little so moving targets are worth practising
   * on, it never attacks, and when it is knocked down it stands straight
   * back up.  Your own health comes back too -- a burn or a snare from a
   * trap of your own still has to wear off, so you can see what it does.
   */
  private trainDummy(dt: number): void {
    const f = this.foe;
    this.ai.think -= dt;
    if (this.ai.think <= 0) {
      this.ai.think = 1.2 + Math.random();
      this.ai.mx = (Math.random() - 0.5) * 2;
      this.ai.my = (Math.random() - 0.5) * 2;
    }
    if (f.stun <= 0 && f.root <= 0) this.step(f, this.ai.mx * 26, this.ai.my * 20, dt);
    f.face = this.me.x >= f.x ? -1 : 1;
    this.trainRespawns();
  }

  /**
   * ---- TRAINING: NOBODY STAYS DOWN (user, 5 Nov).  The dummy gets back up,
   * and so does your creature -- full health, back on its spot, nothing on
   * it -- so testing goes on without starting over.  (Health no longer
   * creeps back on its own: FULL HEAL does that, so a heal can be watched.)
   */
  private trainRespawns(): void {
    const f = this.foe;
    const me = this.me;
    if (me.hp <= 0) {
      this.fullHeal(me);
      me.x = ARENA.x + 40;
      me.y = ARENA.y + ARENA.h / 2;
      this.fx.push({ kind: 'ring', x: me.x, y: me.y, r: 16, t: 0, life: 0.4, col: 0x8ae88a });
      const n = centerText(this, GAME_W / 2, ARENA.y + 24, `${me.c.name.toUpperCase()} IS BACK UP`, 0x8ae88a).setDepth(60);
      this.tweens.add({ targets: n, alpha: 0, delay: 700, duration: 500, onComplete: () => n.destroy() });
    }
    if (f.hp <= 0) {
      f.hp = f.max;
      f.x = ARENA.x + ARENA.w - 50;
      f.y = ARENA.y + ARENA.h / 2;
      this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 16, t: 0, life: 0.4, col: 0xffe060 });
      const n = centerText(this, GAME_W / 2, ARENA.y + 14, 'IT GETS BACK UP', PALETTE.gold).setDepth(60);
      this.tweens.add({ targets: n, alpha: 0, delay: 600, duration: 500, onComplete: () => n.destroy() });
    }
  }

  // ------------------------------------------------------------------ frame

  update(time: number, delta: number): void {
    if (!this.me || !this.foe) return;
    const running = this.scene.isActive('SettingsModal');
    const dt = this.paused || running || this.over ? 0 : Math.min(delta, 50) / 1000;
    if (dt > 0) for (let i = 0; i < (this.sim?.warp ?? 1) && !this.over; i++) this.simulate(dt);
    this.infoT = Math.max(0, this.infoT - Math.min(delta, 50) / 1000);
    this.render(time / 1000);
  }

  private simulate(dt: number): void {
    this.elapsed += dt;
    for (const f of [this.me, this.foe]) this.tickMotion(f, dt);
    const me = this.me;
    // ---- you
    let mx = 0;
    let my = 0;
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) mx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) mx += 1;
    if (k.W.isDown || k.UP.isDown) my -= 1;
    if (k.S.isDown || k.DOWN.isDown) my += 1;
    if (this.moveStick.id >= 0) {
      mx = this.moveStick.dx / 20;
      my = this.moveStick.dy / 20;
    }
    const m = Math.hypot(mx, my);
    if (m > 1) {
      mx /= m;
      my /= m;
    }
    // an echo shriek in your ears: left is right and up is down
    if (me.st.confused) {
      mx = -mx;
      my = -my;
    }
    // curled up: it rolls at them whatever you press
    if (me.st.curl) {
      const d = Math.hypot(this.foe.x - me.x, this.foe.y - me.y) || 1;
      mx = (this.foe.x - me.x) / d;
      my = (this.foe.y - me.y) / d;
    }
    this.tickFighter(me, dt);
    this.tickFighter(this.foe, dt);
    const px0 = me.x;
    const py0 = me.y;
    if (me.stun <= 0 && me.root <= 0 && !me.dash && !me.st.carried) {
      let vx = mx * this.speedOf(me);
      let vy = my * this.speedOf(me);
      // slippery: you keep sliding the way you were going
      if (me.st.slick) {
        const pv = me.ref.vx ?? 0;
        const pw = me.ref.vy ?? 0;
        vx = pv + (vx - pv) * Math.min(1, dt * 2.5);
        vy = pw + (vy - pw) * Math.min(1, dt * 2.5);
      }
      me.ref.vx = vx;
      me.ref.vy = vy;
      this.step(me, vx, vy, dt);
      if (!this.touch) me.face = this.input.activePointer.x >= me.x ? 1 : -1;
      else if (Math.abs(mx) > 0.2) me.face = mx > 0 ? 1 : -1;
    }
    // (smoothed, for an opponent that leads its shots)
    this.meV.x += ((me.x - px0) / dt - this.meV.x) * Math.min(1, dt * 6);
    this.meV.y += ((me.y - py0) / dt - this.meV.y) * Math.min(1, dt * 6);
    // (training: the dummy only fights back while ALLOW ATTACK is on)
    if (this.training && !this.trainAttack) this.trainDummy(dt);
    else {
      this.think(dt);
      if (this.training) this.trainRespawns();
    }
    if (this.sim) {
      // (the other side's velocity, for this brain to lead its shots with)
      const fb = this.meBrain;
      const pv = fb.prev ?? { x: this.foe.x, y: this.foe.y };
      fb.vel.x += ((this.foe.x - pv.x) / dt - fb.vel.x) * Math.min(1, dt * 6);
      fb.vel.y += ((this.foe.y - pv.y) / dt - fb.vel.y) * Math.min(1, dt * 6);
      fb.prev = { x: this.foe.x, y: this.foe.y };
      this.think(dt, me, this.foe, fb);
    }

    // ---- shots
    for (const s of this.shots) {
      // a lob is in the air: it follows its own path and nothing stops it
      if (s.arc) {
        if (this.stasis > 0) continue;
        s.arc.t += dt;
        const k = Phaser.Math.Clamp(s.arc.t / s.arc.dur, 0, 1);
        s.x = s.arc.sx + (s.arc.tx - s.arc.sx) * k;
        s.y = s.arc.sy + (s.arc.ty - s.arc.sy) * k;
        if (k >= 1) {
          s.life = 0;
          this.burst(s.owner, s.x, s.y, s.arc.r, s.dmg, s.a, 'boom');
          this.onLand(s.owner, s.x, s.y, s.a);
          audio.sfx('arcane_blast', 0.35);
        }
        continue;
      }
      // held in the air by a prism's flash
      if (this.stasis > 0) continue;
      this.flight(s, dt);
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      s.t += dt;
      if (s.grace) s.grace = Math.max(0, s.grace - dt);
      const o = this.other(s.owner);
      // a current ward bends a passing shot away, once
      if (o.st.ward && !s.bent && Math.hypot(o.x - s.x, o.y - s.y) < 18 + 6 * o.scale) {
        s.bent = true;
        const side = (s.vx * (o.y - s.y) - s.vy * (o.x - s.x)) >= 0 ? -1 : 1;
        s.ang += side * 1.2;
        const sp = Math.hypot(s.vx, s.vy);
        s.vx = Math.cos(s.ang) * sp;
        s.vy = Math.sin(s.ang) * sp;
        this.fx.push({ kind: 'spark', x: s.x, y: s.y, r: 4, t: 0, life: 0.2, col: 0x9ad0ff });
      }
      // a husk, a copy or a decoy in the way takes the shot
      const mi = this.minions.find((q) => q.hp > 0 && q.owner !== s.owner && Math.hypot(q.x - s.x, q.y - s.y) < 7);
      if (mi && !s.grace) {
        s.life = 0;
        mi.hp -= s.dmg;
        this.fx.push({ kind: 'spark', x: s.x, y: s.y, r: 5, t: 0, life: 0.2, col: 0xffffff });
        if (mi.hp <= 0) {
          mi.life = 0;
          // a sphinx's copy, broken: it flashes back at whoever broke it
          if (mi.kind === 'copy') {
            this.fx.push({ kind: 'beam', x: mi.x, y: mi.y, x2: s.owner.x, y2: s.owner.y, r: 2, t: 0, life: 0.25, col: 0xffffff });
            this.hit(mi.owner, s.owner, 15, null);
          }
        }
        continue;
      }
      // a wall of wind (ultimate) blows away what the other side fires into it
      if (this.pools.some((pl) => pl.kind === 'wind' && pl.owner !== s.owner && this.segDist(s.x, s.y, pl.x, pl.y, pl.x2!, pl.y2!) < 6)) {
        s.life = 0;
        this.fx.push({ kind: 'spark', x: s.x, y: s.y, r: 5, t: 0, life: 0.2, col: 0xf0fff4 });
        continue;
      }
      const size = s.a.mod === 'grow' ? 1 + s.t * 2.2 : 1;
      if (!s.grace && Math.hypot(o.x - s.x, o.y - s.y) < 6 * o.scale + 2 * size) {
        // a shield that sends it back: the shot is theirs now, going the other way
        if (o.shield > 0 && o.shieldMod === 'reflect') {
          s.owner = o;
          s.vx = -s.vx;
          s.vy = -s.vy;
          s.ang += Math.PI;
          s.life = 0.9;
          s.grace = 0.1;
          this.fx.push({ kind: 'spark', x: s.x, y: s.y, r: 8, t: 0, life: 0.25, col: 0xffffff });
          continue;
        }
        this.hit(s.owner, o, Math.round(s.dmg * (s.a.mod === 'grow' ? 1 + s.t : 1)), s.a);
        if (s.snare && o.hp > 0) {
          o.root = ROOT_S;
          this.fx.push({ kind: 'ring', x: o.x, y: o.y, r: 12 * o.scale, t: 0, life: 0.4, col: ELEMENTS[s.owner.c.element].light });
        }
        // a boomerang on its way out keeps going, and can catch them again coming back
        if (s.a.mod === 'boomerang' && !s.back) s.grace = 0.35;
        else s.life = 0;
        if (s.a.mod === 'split') this.shatter(s);
      } else if (!s.pierce && this.props.some((p) => p.owner !== s.owner && Math.hypot(p.x - s.x, p.y - s.y) < p.r)) {
        const p = this.props.find((q) => q.owner !== s.owner && Math.hypot(q.x - s.x, q.y - s.y) < q.r)!;
        if (s.a.mod === 'bounce' && !s.bounced) {
          // off the cover like a ball off a wall
          const nx = (s.x - p.x) / (Math.hypot(s.x - p.x, s.y - p.y) || 1);
          const ny = (s.y - p.y) / (Math.hypot(s.x - p.x, s.y - p.y) || 1);
          const dot = s.vx * nx + s.vy * ny;
          s.vx -= 2 * dot * nx;
          s.vy -= 2 * dot * ny;
          s.x = p.x + nx * (p.r + 1);
          s.y = p.y + ny * (p.r + 1);
          s.ang = Math.atan2(s.vy, s.vx);
          s.bounced = true;
          s.life = Math.max(s.life, 0.5);
          this.fx.push({ kind: 'spark', x: s.x, y: s.y, r: 4, t: 0, life: 0.2, col: 0xffffff });
          continue;
        }
        s.life = 0;
        if (s.a.mod === 'split') this.shatter(s);
        this.fx.push({ kind: 'spark', x: s.x, y: s.y, r: 3, t: 0, life: 0.15, col: 0xffffff });
        // a wall that can be broken takes the hit
        if (p.hp !== undefined) this.chip(p, Math.max(1, s.dmg));
      } else if (s.x < ARENA.x || s.x > ARENA.x + ARENA.w || s.y < ARENA.y || s.y > ARENA.y + ARENA.h) s.life = 0;
      else if (s.life <= 0 && s.a.mod === 'split') this.shatter(s);
    }
    this.shots = this.shots.filter((s) => s.life > 0);

    // ---- the floor that moves have changed
    for (const pl of this.pools) {
      pl.t -= dt;
      pl.tick -= dt;
      const o = this.other(pl.owner);
      if (o.st.air) continue;
      const near = Math.hypot(o.x - pl.x, o.y - pl.y) < pl.r + 4 * o.scale;
      switch (pl.kind ?? 'burn') {
        case 'burn':
          if (pl.tick <= 0 && near) {
            pl.tick = 0.5;
            this.hit(pl.owner, o, LINGER_DMG, null);
          }
          break;
        case 'flow': {
          // in the river: carried downstream, and burnt
          if (this.segDist(o.x, o.y, pl.x, pl.y, pl.x2!, pl.y2!) < pl.r + 4 * o.scale) {
            const L = Math.hypot(pl.x2! - pl.x, pl.y2! - pl.y) || 1;
            o.kx += ((pl.x2! - pl.x) / L) * 220 * dt;
            o.ky += ((pl.y2! - pl.y) / L) * 220 * dt;
            if (pl.tick <= 0) {
              pl.tick = 0.5;
              this.hit(pl.owner, o, 1, null);
            }
          }
          break;
        }
        case 'mycel':
          if (near) this.heal(pl.owner, 2 * dt);
          break;
        case 'stink':
          // the musk: it stings, and nobody hits properly with their eyes watering
          if (near) {
            o.weak = Math.max(o.weak, 0.4);
            if (pl.tick <= 0) {
              pl.tick = 0.5;
              this.hit(pl.owner, o, 1, null);
            }
          }
          break;
        case 'rune': {
          const d = Math.hypot(pl.x - o.x, pl.y - o.y) || 1;
          if (d < 110 && d > 4) {
            o.kx += ((pl.x - o.x) / d) * 150 * dt;
            o.ky += ((pl.y - o.y) / d) * 150 * dt;
          }
          break;
        }
        case 'static': {
          // goes with its maker, crackling at what comes close
          pl.x = pl.owner.x;
          pl.y = pl.owner.y;
          if (Math.hypot(o.x - pl.x, o.y - pl.y) < pl.r + 4 * o.scale && pl.tick <= 0) {
            pl.tick = 0.5;
            this.fx.push({ kind: 'beam', x: pl.x, y: pl.y, x2: o.x, y2: o.y, r: 1, t: 0, life: 0.12, col: 0xfff4a0 });
            this.hit(pl.owner, o, Math.max(1, Math.round((pl.dps ?? 6) / 2)), null);
          }
          break;
        }
        case 'fence':
          if (pl.tick <= 0 && this.segDist(o.x, o.y, pl.x, pl.y, pl.x2!, pl.y2!) < 5 + 5 * o.scale) {
            pl.tick = 0.5;
            this.hit(pl.owner, o, Math.max(1, Math.round((pl.dps ?? 8) / 2)), null);
          }
          break;
        case 'sand': {
          // slows them; its middle swallows them
          const dd = Math.hypot(o.x - pl.x, o.y - pl.y);
          if (dd < pl.r) {
            o.slow = Math.max(o.slow, 0.3);
            if (dd < pl.r * 0.45 && !o.st.unstop) o.root = Math.max(o.root, 0.25);
            if (pl.tick <= 0) {
              pl.tick = 0.5;
              this.hit(pl.owner, o, Math.max(1, Math.round((pl.dps ?? 5) / 2)), null);
            }
          }
          break;
        }
        case 'miasma':
          pl.r = Math.min(pl.grow ?? 35, pl.r + dt * 20);
          if (pl.tick <= 0 && Math.hypot(o.x - pl.x, o.y - pl.y) < pl.r) {
            pl.tick = 0.5;
            this.hit(pl.owner, o, Math.max(1, Math.round((pl.dps ?? 6) / 2)), null);
          }
          break;
        case 'lane':
          if (Math.abs(o.y - pl.y) < 10) {
            o.kx += (pl.dir ?? 1) * 260 * dt;
            if (pl.tick <= 0) {
              pl.tick = 0.5;
              this.hit(pl.owner, o, Math.max(1, Math.round((pl.dps ?? 5) / 2)), null);
            }
          }
          break;
        case 'wind':
          break;
        case 'hole': {
          // a black hole: it drags them to its middle, and hurts while they are in it
          const d = Math.hypot(pl.x - o.x, pl.y - o.y) || 1;
          if (d < pl.r * 2.2 && !o.st.anchor) {
            o.kx += ((pl.x - o.x) / d) * 260 * dt;
            o.ky += ((pl.y - o.y) / d) * 260 * dt;
          }
          if (d < pl.r && pl.tick <= 0) {
            pl.tick = 0.5;
            this.hit(pl.owner, o, Math.max(1, Math.round((pl.dps ?? 4) / 2)), null);
          }
          break;
        }
        case 'halo': {
          // the ring hurts to cross, either way
          const inside = Math.hypot(o.x - pl.x, o.y - pl.y) < pl.r;
          if (inside !== pl.inside && pl.tick <= 0) {
            pl.tick = 0.5;
            this.hit(pl.owner, o, 10, null);
          }
          pl.inside = inside;
          break;
        }
        case 'drift':
          // the frozen ground bursts into spikes as it ends
          if (pl.t <= 0 && Math.hypot(o.x - pl.x, o.y - pl.y) < pl.r) {
            this.hit(pl.owner, o, 14, null);
            this.fx.push({ kind: 'boom', x: o.x, y: o.y, r: 10, t: 0, life: 0.3, col: 0xe8fcff });
          }
          break;
        default:
          break;
      }
    }
    this.pools = this.pools.filter((pl) => pl.t > 0);
    this.stasis = Math.max(0, this.stasis - dt);
    this.tickMinions(dt);
    this.tickWaves(dt);
    // ---- the walls coming in
    if (this.caveIn) {
      const c = this.caveIn;
      c.t -= dt;
      c.tick -= dt;
      const o = this.other(c.owner);
      const edge = Math.min(o.x - ARENA.x, ARENA.x + ARENA.w - o.x, o.y - ARENA.y, ARENA.y + ARENA.h - o.y);
      if (c.tick <= 0 && edge < 22) {
        c.tick = 0.5;
        this.hit(c.owner, o, 3, null);
      }
      if (c.t <= 0) this.caveIn = null;
    }

    // ---- mines
    for (const mi of this.mines) {
      mi.arm -= dt;
      mi.life -= dt;
      const o = this.other(mi.owner);
      if (mi.arm <= 0 && Math.hypot(o.x - mi.x, o.y - mi.y) < 12 * o.scale) {
        mi.life = 0;
        this.burst(mi.owner, mi.x, mi.y, 14, mi.dmg, mi.a, 'boom');
      }
    }
    this.mines = this.mines.filter((x) => x.life > 0);

    // ---- the boss's mechanic: marks on the floor, then they go off
    const def = this.boss ? this.foe.c.boss : undefined;
    if (def) {
      this.hazardT -= dt;
      if (this.hazardT <= 0) {
        this.hazardT = def.every * this.patternMul * (this.bossRage ? 0.75 : 1);
        this.bossPattern(def);
        this.bossRoar(false);
      }
      // ---- THE SECOND PHASE: at half health it gets angry -- and means it
      if (!this.bossRage && this.foe.hp > 0 && this.foe.hp <= this.foe.max * 0.5) {
        this.bossRage = true;
        this.bossRoar(true);
      }
      // ---- NO HIDING.  Out of its sight too long and it comes for you:
      // the lich blinks to where it can see you; the rest throw what they
      // have at the place you are hiding in, now
      this.hidden = this.blocked(this.foe.x, this.foe.y, me.x, me.y) ? this.hidden + dt : 0;
      if (this.hidden > HIDE_S && this.foe.hp > 0) {
        this.hidden = 0;
        const t = centerText(this, me.x, me.y - 18, 'NO HIDING!', PALETTE.gold).setDepth(60);
        this.tweens.add({ targets: t, y: t.y - 8, alpha: 0, delay: 500, duration: 500, onComplete: () => t.destroy() });
        if (def.pattern === 'teleport') this.blinkIn();
        else {
          this.bossPattern(def);
          this.hazardT = Math.max(this.hazardT, def.every * 0.6);
        }
      }
    }
    // ---- marks on the floor going off: a boss's, or a creature's own (a
    // heat lance, a dive bomb, the maw's jaws)
    for (const h of this.hazards) {
      h.t -= dt;
      if (h.seek && h.t > 0) {
        const tg = this.other(h.owner ?? this.foe);
        const dd = Math.hypot(tg.x - h.x, tg.y - h.y) || 1;
        const st = Math.min(dd, h.seek * dt);
        h.x += ((tg.x - h.x) / dd) * st;
        h.y += ((tg.y - h.y) / dd) * st;
      }
      if (h.t > 0) continue;
      const own = h.owner ?? this.foe;
      const tgt = this.other(own);
      const col = ELEMENTS[own.c.element].col;
      if (h.kind === 'line') this.fx.push({ kind: 'beam', x: h.x, y: h.y, x2: h.x2, y2: h.y2, r: h.r, t: 0, life: 0.25, col });
      else if (h.kind === 'ring') this.fx.push({ kind: 'ring', x: h.x, y: h.y, r: h.r, t: 0, life: 0.3, col });
      else this.fx.push({ kind: 'boom', x: h.x, y: h.y, r: h.r, t: 0, life: h.kind === 'meteor' ? 0.5 : 0.3, col: h.kind === 'meteor' ? 0xffb040 : col });
      if (h.kind === 'meteor') audio.sfx('arcane_blast', 0.55);
      h.go?.();
      if (h.dmg > 0 && this.caught(h, tgt.x, tgt.y) && !tgt.st.air) {
        this.hit(own, tgt, h.dmg, own.c.attacks[0]);
        if (h.holds && tgt.hp > 0) tgt.root = Math.max(tgt.root, ROOT_S);
      }
    }
    this.hazards = this.hazards.filter((h) => h.t > 0);

    // ---- cover somebody dropped: it stands its few seconds and goes
    let wentDown = false;
    for (const bar of this.barriers) {
      // (the scenery has no clock; everything dropped does -- by its `max`,
      // not the sign of `life`, which a frame's step takes past zero)
      if (bar.max === undefined) continue;
      bar.life -= dt;
      if (bar.life <= 0) wentDown = true;
    }
    if (wentDown || this.barriers.some((b) => b.max !== undefined && b.life < 1.2)) {
      const gone = this.barriers.filter((b) => b.max !== undefined && b.life <= 0);
      // a glacier slab does not just melt: it shatters
      for (const b of gone) {
        if (!b.shatter || !b.owner) continue;
        const o = this.other(b.owner);
        if (b.parts.some((q) => Math.hypot(q.x - o.x, q.y - o.y) < 20 + q.r)) this.hit(b.owner, o, 10, null);
        for (const q of b.parts) this.fx.push({ kind: 'boom', x: q.x, y: q.y, r: 14, t: 0, life: 0.3, col: 0xe8fcff });
        audio.sfx('glass_crack', 0.5);
      }
      if (gone.length) {
        const dead = new Set(gone.flatMap((b) => b.parts));
        this.props = this.props.filter((p) => !dead.has(p));
        this.barriers = this.barriers.filter((b) => !gone.includes(b));
      }
      this.repaintCover();
    }

    for (const e of this.fx) e.t += dt;
    this.fx = this.fx.filter((e) => e.t < e.life);

    // ---- the end (training has none: nothing is at stake and nothing faints)
    if (this.training) return;
    if (this.me.hp <= 0 || this.foe.hp <= 0) this.end(this.foe.hp <= 0 && this.me.hp > 0);
    else if (this.elapsed >= TIME_LIMIT) this.end(this.me.hp / this.me.max > this.foe.hp / this.foe.max);
  }

  /**
   * One round of what this boss does to the floor (see the table at the
   * top).  `at` is where it is aimed: you, normally.
   */
  // (whose it is: the boss you fight -- or, on an admin's team, yours, at them)
  private bossPattern(def: BossDef, at = { x: this.me.x, y: this.me.y }, who: Fighter = this.foe): void {
    const foe = who;
    const lead0 = who === this.foe ? this.meV : { x: 0, y: 0 };
    const col = ELEMENTS[foe.c.element];
    const cx = (x: number) => Phaser.Math.Clamp(x, ARENA.x + 10, ARENA.x + ARENA.w - 10);
    const cy = (y: number) => Phaser.Math.Clamp(y, ARENA.y + 10, ARENA.y + ARENA.h - 10);
    const put = (h: Omit<Hazard, 't0' | 'dmg' | 'r' | 'kind'> & Partial<Pick<Hazard, 'dmg' | 'r' | 'kind'>>): void => {
      this.hazards.push({ kind: 'mark', r: def.r, dmg: def.dmg, ...h, x: cx(h.x), y: cy(h.y), t0: h.t, owner: who });
    };
    switch (def.pattern) {
      case 'teleport': {
        // marks of grave-light round you, and it blinks to wherever it can see you
        for (let i = 0; i < def.n; i++) {
          const a = (i / def.n) * Math.PI * 2 + Math.random();
          put({ x: at.x + Math.cos(a) * (i === 0 ? 0 : 26), y: at.y + Math.sin(a) * (i === 0 ? 0 : 20), t: 1.2 + i * 0.15 });
        }
        this.blinkIn(who);
        break;
      }
      case 'meteor': {
        // one on you, one where you are running to, the rest round about:
        // the shadow grows for a second and a half, then it lands -- hard
        const lead = { x: at.x + lead0.x * 1.2, y: at.y + lead0.y * 1.2 };
        for (let i = 0; i < def.n; i++) {
          const base = i === 0 ? at : i === 1 ? lead : { x: at.x + (Math.random() - 0.5) * 120, y: at.y + (Math.random() - 0.5) * 80 };
          put({ kind: 'meteor', x: base.x, y: base.y, t: 1.6 + i * 0.25 });
        }
        audio.sfx('arcane_cast', 0.5);
        break;
      }
      case 'tribeam': {
        // three breaths from its three heads: at you, and either side
        const a0 = Math.atan2(at.y - foe.y, at.x - foe.x);
        for (const k of [-0.42, 0, 0.42]) {
          const a = a0 + k;
          put({ kind: 'line', x: foe.x, y: foe.y, x2: foe.x + Math.cos(a) * 300, y2: foe.y + Math.sin(a) * 300, t: 1.1 });
        }
        break;
      }
      case 'webs':
        // thrown round your feet: where you stand and the ways out of it
        put({ x: at.x, y: at.y, t: 1.0, holds: true });
        for (let i = 1; i < def.n; i++) {
          const a = (i / (def.n - 1)) * Math.PI * 2 + Math.random() * 0.5;
          put({ x: at.x + Math.cos(a) * 30, y: at.y + Math.sin(a) * 24, t: 1.2 + i * 0.1, holds: true });
        }
        break;
      case 'roots': {
        // under you, and where you are going
        put({ x: at.x, y: at.y, t: 1.0, holds: true });
        for (let i = 1; i < def.n; i++) put({ x: at.x + lead0.x * 0.5 * i + (Math.random() - 0.5) * 24, y: at.y + lead0.y * 0.5 * i + (Math.random() - 0.5) * 20, t: 1.1 + i * 0.3, holds: true });
        break;
      }
      case 'lightning': {
        // the bolts walk from the cloud straight at you, and past
        const a = Math.atan2(at.y - foe.y, at.x - foe.x);
        const d0 = Math.hypot(at.x - foe.x, at.y - foe.y);
        for (let i = 0; i < def.n; i++) {
          const d = 20 + (i / (def.n - 1)) * (d0 + 40);
          put({ x: foe.x + Math.cos(a) * d, y: foe.y + Math.sin(a) * d, t: 0.8 + i * 0.16 });
        }
        break;
      }
      case 'burrow': {
        // it goes under, and comes up beside you
        const a = Math.random() * Math.PI * 2;
        const nx = cx(at.x + Math.cos(a) * 30);
        const ny = cy(at.y + Math.sin(a) * 26);
        put({ x: nx, y: ny, t: 1.1 });
        this.fx.push({ kind: 'spark', x: foe.x, y: foe.y, r: 14, t: 0, life: 0.4, col: col.light });
        foe.invuln = 1.1;
        this.time.delayedCall(900, () => {
          if (this.over || foe.hp <= 0) return;
          foe.x = nx;
          foe.y = ny;
          this.fx.push({ kind: 'ring', x: nx, y: ny, r: 18, t: 0, life: 0.4, col: col.col });
          audio.sfx('item_thud', 0.4);
        });
        break;
      }
      case 'charge': {
        // a line drawn straight at you -- then the pounce, all the way down it
        const a = Math.atan2(at.y - foe.y, at.x - foe.x);
        const len = 230;
        put({
          kind: 'line', x: foe.x, y: foe.y, x2: foe.x + Math.cos(a) * len, y2: foe.y + Math.sin(a) * len, t: 1.0, dmg: 0,
          go: () => {
            if (this.over || foe.hp <= 0) return;
            // (user, 5 Nov) the pounce smashes every wall anyone put up on its
            // line -- the unbreakable ones too, whoever's they are
            const x2 = foe.x + Math.cos(a) * len;
            const y2 = foe.y + Math.sin(a) * len;
            for (const bar of this.barriers) {
              if (bar.max === undefined || bar.life <= 0) continue;
              if (!bar.parts.some((q) => this.segDist(q.x, q.y, foe.x, foe.y, x2, y2) < q.r + 8)) continue;
              bar.life = 0;
              for (const q of bar.parts) this.fx.push({ kind: 'boom', x: q.x, y: q.y, r: q.r + 4, t: 0, life: 0.3, col: 0xfff4c0 });
              audio.sfx('crumble', 0.6);
            }
            foe.dash = { vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, t: len / 330, dmg: def.dmg, hit: false, a: foe.c.attacks[0] };
            audio.sfx('throw_whoosh', 0.6);
          },
        });
        foe.root = 1.0;
        break;
      }
      case 'tentacles': {
        // arms roll across the floor from one side, column after column
        const fromLeft = Math.random() < 0.5;
        for (let c = 0; c < 5; c++) {
          const x = fromLeft ? ARENA.x + 16 + c * 30 : ARENA.x + ARENA.w - 16 - c * 30;
          // (a gap in each wave, somewhere different each time: get to it)
          const gap = Math.floor(Math.random() * def.n);
          for (let i = 0; i < def.n; i++) if (i !== gap) put({ x, y: ARENA.y + 14 + (i / (def.n - 1)) * (ARENA.h - 28), t: 1.0 + c * 0.45 });
        }
        break;
      }
      case 'quake':
        // it stamps: rings run out from it, one after another -- be between them
        for (let i = 0; i < 3; i++) put({ kind: 'ring', x: foe.x, y: foe.y, r: 30 + i * 32, t: 1.0 + i * 0.45 });
        audio.sfx('item_thud', 0.6);
        break;
      // ---- (5 Nov) the lich's and the maw's own, and the five new bosses'
      case 'souls':
        // souls let loose round the arena, drifting after you round the cover
        for (let i = 0; i < def.n; i++) {
          const a = (i / def.n) * Math.PI * 2 + Math.random();
          put({ x: ARENA.x + ARENA.w / 2 + Math.cos(a) * ARENA.w * 0.4, y: ARENA.y + ARENA.h / 2 + Math.sin(a) * ARENA.h * 0.4, t: 2.6 + i * 0.3, seek: 34 });
        }
        audio.sfx('voice_whisper', 0.5);
        break;
      case 'inhale': {
        // it breathes in: you are dragged toward its jaws, and they snap shut
        const tg = this.other(foe);
        const dd = Math.hypot(tg.x - foe.x, tg.y - foe.y) || 1;
        put({ x: foe.x + ((tg.x - foe.x) / dd) * 16, y: foe.y + ((tg.y - foe.y) / dd) * 12, t: 1.3, r: def.r });
        let k = 0;
        this.time.addEvent({
          delay: 50,
          repeat: 23,
          callback: () => {
            if (this.over || foe.hp <= 0 || tg.st.anchor) return;
            const d2 = Math.hypot(tg.x - foe.x, tg.y - foe.y) || 1;
            tg.kx += ((foe.x - tg.x) / d2) * 34;
            tg.ky += ((foe.y - tg.y) / d2) * 34;
            if (k++ % 3 === 0) this.fx.push({ kind: 'spark', x: tg.x + (Math.random() - 0.5) * 12, y: tg.y + (Math.random() - 0.5) * 10, r: 2, t: 0, life: 0.3, col: col.light });
          },
        });
        audio.sfx('wind_gust', 0.6);
        break;
      }
      case 'spiral':
        // strikes winding out from the middle of the arena, one after another
        for (let i = 0; i < def.n; i++) {
          const a = i * 0.95 + Math.random() * 0.2;
          const rr = 8 + i * 11;
          put({ x: ARENA.x + ARENA.w / 2 + Math.cos(a) * rr, y: ARENA.y + ARENA.h / 2 + Math.sin(a) * rr * 0.7, t: 0.9 + i * 0.16 });
        }
        audio.sfx('wind_gust', 0.5);
        break;
      case 'checker': {
        // the floor ticks: every other tile, then the rest
        const cols = 7;
        const rows = 4;
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            const x = ARENA.x + ((i + 0.5) / cols) * ARENA.w;
            const y = ARENA.y + ((j + 0.5) / rows) * ARENA.h;
            put({ x, y, t: (i + j) % 2 ? 1.1 : 2.2 });
          }
        }
        audio.sfx('item_thud', 0.5);
        break;
      }
      case 'clockhand': {
        // its shadow sweeps round it like the hand of a clock, starting behind you
        const a0 = Math.atan2(at.y - foe.y, at.x - foe.x) - 1.1;
        for (let i = 0; i < def.n; i++) {
          const a = a0 + i * 0.32;
          put({ kind: 'line', x: foe.x, y: foe.y, x2: foe.x + Math.cos(a) * 260, y2: foe.y + Math.sin(a) * 260, t: 0.8 + i * 0.14 });
        }
        audio.sfx('chime', 0.5);
        break;
      }
      case 'flood': {
        // the half of the arena you are in floods: be on the other half
        const left = at.x < ARENA.x + ARENA.w / 2;
        const x0 = left ? ARENA.x : ARENA.x + ARENA.w / 2;
        put({ kind: 'line', x: x0 + 6, y: ARENA.y + ARENA.h / 2, x2: x0 + ARENA.w / 2 - 6, y2: ARENA.y + ARENA.h / 2, r: ARENA.h / 2 - 4, t: 1.5, go: () => {
          const tg = this.other(foe);
          const inside = left ? tg.x < ARENA.x + ARENA.w / 2 : tg.x >= ARENA.x + ARENA.w / 2;
          if (inside) tg.slow = Math.max(tg.slow, 2);
        } });
        audio.sfx('water_plip', 0.6);
        break;
      }
      case 'trail': {
        // fire where you have just been, spot by spot along your path
        const tg = this.other(foe);
        const path = (tg.hist ?? []).slice(-def.n);
        path.forEach(([x, y], i) => put({ x, y, t: 0.7 + i * 0.12 }));
        if (!path.length) put({ x: at.x, y: at.y, t: 0.8 });
        audio.sfx('poison_hiss', 0.5);
        break;
      }
    }
  }

  /** The lich's trick: gone in a puff, and back somewhere that can see you. */
  private blinkIn(who: Fighter = this.foe): void {
    const foe = who;
    const spot = this.sightSpot(foe, true, this.other(who));
    if (!spot) return;
    const col = ELEMENTS[foe.c.element];
    this.fx.push({ kind: 'ring', x: spot.x, y: spot.y, r: 14, t: 0, life: 0.6, col: col.light });
    this.fx.push({ kind: 'spark', x: foe.x, y: foe.y, r: 14, t: 0, life: 0.5, col: col.col });
    foe.invuln = 0.6;
    this.time.delayedCall(550, () => {
      if (this.over || foe.hp <= 0) return;
      foe.x = spot.x;
      foe.y = spot.y;
      this.fx.push({ kind: 'spark', x: foe.x, y: foe.y, r: 14, t: 0, life: 0.5, col: col.col });
      audio.sfx('arcane_cast', 0.5);
    });
  }

  /** A hazard that is going off now: does it catch you? */
  private caught(h: Hazard, x: number, y: number): boolean {
    if (h.kind === 'line') return this.segDist(x, y, h.x, h.y, h.x2!, h.y2!) < h.r + 4;
    const d = Math.hypot(x - h.x, y - h.y);
    if (h.kind === 'ring') return Math.abs(d - h.r) < 7;
    return d < h.r + 5;
  }

  private end(won: boolean): void {
    if (this.over) return;
    this.over = true;
    if (this.sim) {
      // (the simulator keeps the result and pays nothing)
      this.sim.result = won;
      this.settled = true;
      return;
    }
    if (this.settled) return;
    this.settled = true;
    if (this.mode === 'mini') {
      this.endMini(won);
      return;
    }
    // (what the run had paid before this one, for the run's total)
    const before = store.get().creatures.ladder?.earned ?? 0;
    const r = finishBattle(won, this.foeLevel);
    audio.sfx(won ? 'cha_ching' : 'death_stinger', 0.6);
    const timeUp = this.me.hp > 0 && this.foe.hp > 0;
    const ladder = this.mode === 'ladder';
    const story = this.mode === 'story';
    this.time.delayedCall(700, () => {
      const box = this.add.container(0, 0).setDepth(2000);
      const X = GAME_W / 2;
      const Y = GAME_H / 2;
      box.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0, 0).setInteractive());
      box.add(this.add.rectangle(X, Y, 244, 96, PALETTE.ink).setStrokeStyle(1, won ? PALETTE.gold : 0xc31f2e));
      const head = won
        ? ladder
          ? this.boss ? 'LADDER CLEARED!' : `LEVEL ${this.level} OF ${LADDER_LEVELS} CLEARED`
          : story && this.boss ? (r.worldOpened ? 'WORLD CLEARED!' : 'BOSS BEATEN!') : 'VICTORY!'
        : 'DEFEATED';
      box.add(centerText(this, X, Y - 38, head, won ? PALETTE.gold : 0xff6a6a));
      if (timeUp) box.add(centerText(this, X, Y - 28, 'TIME: MORE HEALTH LEFT WINS', PALETTE.ash));
      const lines: Array<[string, number]> = [];
      if (won) {
        if (r.paid) lines.push([`+${r.paid} TOKENS`, PALETTE.gold]);
        if (story) {
          const nextW = WORLDS[this.storyWorld + 1];
          lines.push([
            r.replay
              ? 'REPLAY WON: GOOD PRACTICE'
              : this.boss ? (r.worldOpened ? (nextW ? `${nextW.name} IS OPEN!` : 'THE STORY IS DONE - THE LADDER IS OPEN!') : 'WORLD CLEARED') : this.storyStage + 1 >= STAGES ? `NEXT: ${WORLDS[this.storyWorld].bossName}` : `NEXT: BATTLE ${this.storyStage + 2} OF ${STAGES}`,
            PALETTE.cream,
          ]);
        }
        if (ladder) lines.push([this.boss ? `THE RUN PAID ${before + r.paid} TOKENS IN ALL.` : this.level >= LADDER_LEVELS ? 'NEXT: THE FINAL BOSS' : `NEXT: LEVEL ${this.level + 1} OF ${LADDER_LEVELS}`, PALETTE.cream]);
        if (!this.training) lines.push([this.xpLine(r.xp ?? 0, r.xpGap ?? 0), 0x8ae88a]);
      } else {
        lines.push([r.msg.replace(/ \+\d+ XP\..*$/, ''), PALETTE.cream]);
        if (!this.training && r.xp) lines.push([this.xpLine(r.xp, r.xpGap ?? 0), 0x8ae88a]);
        // (nothing said of what a loss does not give back: log #65)
        if (ladder && before) lines.push([`THE RUN PAID ${before} TOKENS. THEY ARE YOURS TO KEEP.`, PALETTE.ash]);
      }
      lines.forEach(([t, c], i) => box.add(centerText(this, X, Y - 16 + i * 10, t, c).setMaxWidth(232)));
      if (won && r.levelUp) {
        const up = centerText(this, X, Y - 16 + lines.length * 10, `LEVEL UP!  LV ${r.levelUp}`, PALETTE.gold);
        box.add(up);
        up.setScale(0.6);
        this.tweens.add({ targets: up, scale: 1, duration: 260, ease: 'Back.Out' });
        this.tweens.add({ targets: up, alpha: 0.55, duration: 380, yoyo: true, repeat: -1, delay: 300 });
        audio.sfx('chime', 0.7);
      }
      // back to where the fight came from: the run's ladder, or the map
      const screen = ladder ? 'ladder' : story ? 'trail' : 'map';
      box.add(button(this, X, Y + 36, 'CONTINUE', () => this.scene.start('CreatureHub', { from: this.from, screen, world: this.storyWorld }), { width: 80, height: 13 }));
    });
  }

  /**
   * A MINI GAME BOUT IS OVER.  Duels end the run here; in 3v3 the loser's
   * creature leaves and, while both sides have somebody left, the next one
   * walks in against the survivor -- which keeps the health it had.
   */
  private endMini(won: boolean): void {
    const run = currentMini();
    const kind = run?.kind ?? 'melee';
    const loser = (won ? this.foe : this.me).c.name.toUpperCase();
    const sv = won ? this.me : this.foe;
    const r = boutOver(won, Math.max(1, Math.round(sv.hp)), [sv.cds[0], sv.cds[1], sv.cds[2]], sv.ultT);
    audio.sfx(r.over ? (r.won ? 'cha_ching' : 'death_stinger') : 'bell_ding', 0.6);
    this.time.delayedCall(700, () => {
      const box = this.add.container(0, 0).setDepth(2000);
      const X = GAME_W / 2;
      const Y = GAME_H / 2;
      box.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0, 0).setInteractive());
      box.add(this.add.rectangle(X, Y, 244, 90, PALETTE.ink).setStrokeStyle(1, r.over ? (r.won ? PALETTE.gold : 0xc31f2e) : PALETTE.neon));
      box.add(centerText(this, X, Y - 34, MINI_INFO[kind].title, PALETTE.ash));
      if (!r.over && run) {
        // the next one in
        const nextMine = creatureById(run.me[0])?.name.toUpperCase() ?? '';
        const nextFoe = creatureById(run.foe[0])?.name.toUpperCase() ?? '';
        box.add(centerText(this, X, Y - 20, `${loser} FAINTS!`, won ? PALETTE.gold : 0xff6a6a));
        box.add(centerText(this, X, Y - 6, `${nextMine}  VS  ${nextFoe}`, PALETTE.cream).setMaxWidth(232));
        box.add(centerText(this, X, Y + 6, `YOU ${run.me.length} LEFT  -  THEM ${run.foe.length} LEFT`, PALETTE.fog));
        box.add(button(this, X, Y + 30, 'NEXT BOUT', () => this.scene.start('CreatureArena', { mode: 'mini', from: this.from, biome: BIOMES[Phaser.Math.Between(0, BIOMES.length - 1)].id }), { width: 80, height: 13 }));
        return;
      }
      box.add(centerText(this, X, Y - 20, r.won ? 'VICTORY!' : 'DEFEATED', r.won ? PALETTE.gold : 0xff6a6a));
      box.add(centerText(this, X, Y - 6, r.won ? `+${r.paid || MINI_PRICE[currentMini()?.kind ?? 'melee'].win} TOKENS` : 'NO TOKENS THIS TIME', r.won ? PALETTE.gold : PALETTE.ash));
      box.add(button(this, X, Y + 30, 'CONTINUE', () => this.scene.start('CreatureHub', { from: this.from, screen: 'minis' }), { width: 80, height: 13 }));
    });
  }

  /**
   * THE EXPERIENCE, AND HOW FAR TO THE NEXT LEVEL (user, 2 Nov): "+34 XP
   * LV 4 40/130", and a word when the foe was well below you -- that is why
   * it taught so little.
   */
  private xpLine(xp: number, gap: number): string {
    const own = activeOwned();
    const p = xpProgress(own?.xp ?? 0);
    if (p.max) return xp ? `+${xp} XP - MAX LEVEL` : 'MAX LEVEL - NO MORE XP';
    const note = gap <= -3 ? ' (WEAK FOE)' : gap >= 2 ? ' (TOUGH FOE!)' : '';
    return `+${xp} XP${note}  LV ${p.level}: ${p.into}/${p.need}`;
  }

  /**
   * How far the chosen attack reaches, drawn faintly on the ground from you:
   * a line for a shot, a beam or a charge, a cone for a fan, a ring for an
   * area or a blink, the throw ring for a trap, a halo for a guard.
   */
  private render(t: number): void {
    const g = this.g;
    g.clear();
    // mines and hazard marks first: they are on the ground
    for (const mi of this.mines) {
      const col = ELEMENTS[mi.owner.c.element].col;
      g.fillStyle(col, mi.arm > 0 ? 0.4 : 0.8 + Math.sin(t * 10) * 0.2).fillCircle(mi.x, mi.y, 3);
      g.lineStyle(1, 0x000000, 0.5).strokeCircle(mi.x, mi.y, 3);
    }
    // every one telegraphed: an outline the moment it is down, filling as it comes
    for (const pl of this.pools) {
      const c = ELEMENTS[pl.owner.c.element];
      const a = Math.min(1, pl.t) * (0.35 + Math.sin(t * 9 + pl.x) * 0.08);
      switch (pl.kind ?? 'burn') {
        case 'flow':
          g.lineStyle(pl.r * 2, 0xff6a20, a).lineBetween(pl.x, pl.y, pl.x2!, pl.y2!);
          for (let k = 0; k < 4; k++) {
            const q = ((t * 1.5 + k / 4) % 1);
            g.fillStyle(0xffd060, a).fillCircle(pl.x + (pl.x2! - pl.x) * q, pl.y + (pl.y2! - pl.y) * q, 2);
          }
          break;
        case 'honey':
          g.fillStyle(0xe8a830, Math.min(0.7, pl.t)).fillCircle(pl.x, pl.y, pl.r);
          break;
        case 'stink': {
          // a drifting green-yellow fog, puffs rolling in it
          const a = Math.min(0.45, pl.t * 0.4);
          g.fillStyle(0x9ab84a, a * 0.6).fillCircle(pl.x, pl.y, pl.r);
          for (let k = 0; k < 6; k++) {
            const q = t * 0.6 + k * 1.05;
            g.fillStyle(0xc8d86a, a).fillCircle(pl.x + Math.cos(q) * pl.r * 0.55, pl.y + Math.sin(q * 1.3) * pl.r * 0.45, 5 + (k % 3));
          }
          break;
        }
        case 'floe':
          g.fillStyle(0xd8f4ff, Math.min(0.6, pl.t)).fillCircle(pl.x, pl.y, pl.r);
          g.lineStyle(1, 0xffffff, Math.min(0.8, pl.t)).strokeCircle(pl.x, pl.y, pl.r);
          break;
        case 'mycel':
          g.lineStyle(1, 0xc090e0, Math.min(0.5, pl.t));
          for (let k = 0; k < 8; k++) g.lineBetween(pl.x, pl.y, pl.x + Math.cos(k * 0.8) * pl.r, pl.y + Math.sin(k * 0.8) * pl.r * 0.8);
          g.strokeCircle(pl.x, pl.y, pl.r);
          break;
        case 'rune':
          g.lineStyle(1, 0xd0c4a8, 0.9).strokeCircle(pl.x, pl.y, pl.r + Math.sin(t * 6) * 2);
          g.lineStyle(1, 0xd0c4a8, 0.4).strokeCircle(pl.x, pl.y, pl.r * 2 + ((t * 20) % 20));
          break;
        case 'beacon':
          g.fillStyle(0xfff0a0, 0.9).fillRect(pl.x - 1.5, pl.y - 8, 3, 8);
          g.fillStyle(0xfff0a0, 0.1 + Math.sin(t * 4) * 0.05).fillCircle(pl.x, pl.y, pl.r);
          break;
        case 'trail':
          g.fillStyle(0xfff4c0, Math.min(0.5, pl.t * 0.3)).fillCircle(pl.x, pl.y, 2);
          break;
        case 'drift':
          g.fillStyle(0xbfe8ff, Math.min(0.35, pl.t)).fillCircle(pl.x, pl.y, pl.r);
          g.lineStyle(1, 0xffffff, pl.t < 1 ? 0.9 : 0.5).strokeCircle(pl.x, pl.y, pl.r);
          break;
        case 'halo':
          g.lineStyle(2, 0xffe060, 0.6 + Math.sin(t * 8) * 0.3).strokeCircle(pl.x, pl.y, pl.r);
          break;
        case 'static':
          g.lineStyle(1, 0xfff4a0, 0.35 + Math.sin(t * 20) * 0.2).strokeCircle(pl.x, pl.y, pl.r);
          for (let k = 0; k < 4; k++) {
            const a = t * 7 + k * 1.57;
            g.lineStyle(1, 0xffffff, 0.8).lineBetween(pl.x + Math.cos(a) * pl.r * 0.6, pl.y + Math.sin(a) * pl.r * 0.6, pl.x + Math.cos(a + 0.3) * pl.r, pl.y + Math.sin(a + 0.3) * pl.r);
          }
          break;
        case 'fence':
          g.lineStyle(2, c.light, 0.7 + Math.sin(t * 25) * 0.3).lineBetween(pl.x, pl.y, pl.x2!, pl.y2!);
          g.lineStyle(1, 0xffffff, 0.9).lineBetween(pl.x, pl.y, pl.x2!, pl.y2!);
          g.fillStyle(0x3a3a48, 1).fillRect(pl.x - 2, pl.y - 6, 4, 8).fillRect(pl.x2! - 2, pl.y2! - 6, 4, 8);
          break;
        case 'sand':
          g.fillStyle(0xc8a060, Math.min(0.6, pl.t)).fillCircle(pl.x, pl.y, pl.r);
          for (let k = 0; k < 3; k++) g.lineStyle(1, 0x8a6a3a, 0.6).strokeCircle(pl.x, pl.y, pl.r * (((t * 0.6 + k / 3) % 1)));
          break;
        case 'miasma':
          g.fillStyle(0x7a9a3a, Math.min(0.35, pl.t * 0.3)).fillCircle(pl.x, pl.y, pl.r);
          for (let k = 0; k < 6; k++) g.fillStyle(0x9ab84a, 0.35).fillCircle(pl.x + Math.cos(t + k) * pl.r * 0.6, pl.y + Math.sin(t * 1.2 + k) * pl.r * 0.5, 4);
          break;
        case 'lane':
          g.fillStyle(0x3a8ad8, Math.min(0.3, pl.t * 0.3)).fillRect(ARENA.x, pl.y - 9, ARENA.w, 18);
          for (let k = 0; k < 8; k++) {
            const q = ((t * 0.8 * (pl.dir ?? 1) + k / 8) % 1 + 1) % 1;
            g.lineStyle(1, 0x9ad0ff, 0.7).lineBetween(ARENA.x + q * ARENA.w, pl.y - 3 + (k % 3) * 3, ARENA.x + q * ARENA.w + 8 * (pl.dir ?? 1), pl.y - 3 + (k % 3) * 3);
          }
          break;
        case 'wind':
          for (let k = 0; k < 5; k++) {
            const q = k / 4;
            const x = pl.x + (pl.x2! - pl.x) * q;
            const y = pl.y + (pl.y2! - pl.y) * q;
            g.lineStyle(1, 0xf0fff4, 0.5 + Math.sin(t * 10 + k) * 0.3).strokeEllipse(x, y, 6 + Math.sin(t * 8 + k) * 2, 3);
          }
          g.lineStyle(1, 0xf0fff4, 0.3).lineBetween(pl.x, pl.y, pl.x2!, pl.y2!);
          break;
        case 'hole': {
          // dark in the middle, its rim and the dust it swallows turning in
          const fade = Math.min(1, pl.t * 2);
          g.fillStyle(0x07040e, 0.75 * fade).fillCircle(pl.x, pl.y, pl.r * 0.55);
          g.lineStyle(1, c.light, 0.7 * fade).strokeCircle(pl.x, pl.y, pl.r * 0.55);
          for (let k = 0; k < 6; k++) {
            const q = ((t * 0.9 + k / 6) % 1);
            const ang = k * 1.05 + t * 3;
            g.fillStyle(c.light, 0.7 * fade).fillCircle(pl.x + Math.cos(ang) * pl.r * (1 - q) * 1.4, pl.y + Math.sin(ang) * pl.r * (1 - q), 1.2);
          }
          g.lineStyle(1, c.col, 0.3 * fade).strokeCircle(pl.x, pl.y, pl.r * 1.4);
          break;
        }
        default:
          g.fillStyle(c.col, a).fillCircle(pl.x, pl.y, pl.r);
          g.lineStyle(1, c.light, a).strokeCircle(pl.x, pl.y, pl.r);
      }
    }
    // the walls coming in
    if (this.caveIn) {
      for (let k = 0; k < 40; k++) {
        const e = k % 4;
        const q = ((k * 37) % 100) / 100;
        const x = e < 2 ? ARENA.x + q * ARENA.w : e === 2 ? ARENA.x + 8 : ARENA.x + ARENA.w - 8;
        const y = e === 0 ? ARENA.y + 8 : e === 1 ? ARENA.y + ARENA.h - 8 : ARENA.y + q * ARENA.h;
        g.fillStyle(0x5a4e3e, 0.9).fillCircle(x, y, 4 + (k % 3));
      }
    }
    // waves rolling out
    for (const w of this.waves) g.lineStyle(2, ELEMENTS[w.owner.c.element].light, 0.8).strokeCircle(w.x, w.y, w.r);
    // tethers: a leash, a soul siphon
    for (const f of [this.me, this.foe]) {
      if (f.st.leash && f.ref.leash) g.lineStyle(1, 0x5aa83a, 0.9).lineBetween(f.x, f.y, f.ref.leash.x, f.ref.leash.y);
      const o = this.other(f);
      if (f.st.siphon && Math.hypot(o.x - f.x, o.y - f.y) < 100) g.lineStyle(1, 0xc090e0, 0.5 + Math.sin(t * 12) * 0.3).lineBetween(f.x, f.y, o.x, o.y);
    }
    for (const h of this.hazards) {
      const k = Phaser.Math.Clamp(1 - h.t / h.t0, 0, 1);
      if (h.kind === 'line') {
        g.lineStyle(1, 0xff3a3a, 0.5 + k * 0.4).lineBetween(h.x, h.y, h.x2!, h.y2!);
        g.lineStyle(h.r * 2 * k, 0xff3a3a, 0.22).lineBetween(h.x, h.y, h.x2!, h.y2!);
      } else if (h.kind === 'ring') {
        g.lineStyle(1, 0xff3a3a, 0.4 + k * 0.5).strokeCircle(h.x, h.y, h.r);
        g.lineStyle(1, 0xff3a3a, 0.25).strokeCircle(h.x, h.y, h.r - 7).strokeCircle(h.x, h.y, h.r + 7);
      } else if (h.kind === 'meteor') {
        // the shadow grows; the star comes down out of the corner of the sky onto it
        g.fillStyle(0x000000, 0.2 + k * 0.35).fillEllipse(h.x, h.y, h.r * 2 * (0.4 + k * 0.6), h.r * 1.2 * (0.4 + k * 0.6));
        g.lineStyle(1, 0xff6a2a, 0.9).strokeCircle(h.x, h.y, h.r);
        const fall = Math.max(0, 1 - k);
        const sx = h.x + fall * 70;
        const sy = h.y - fall * 120;
        g.lineStyle(3, 0xffb040, 0.5).lineBetween(sx + 10, sy - 18, sx, sy);
        g.fillStyle(0xfff0a0, 1).fillCircle(sx, sy, 3 + k * 2);
      } else if (h.riddle) {
        // the riddle's glyphs: the true one an eye in gold, the false ones mirrors
        const truth = h.riddle === 'true';
        const c = truth ? 0xffd060 : 0xbfe8ff;
        g.lineStyle(1, c, 0.9).strokeCircle(h.x, h.y, h.r);
        g.lineStyle(1, c, 0.35).strokeCircle(h.x, h.y, h.r - 3);
        g.fillStyle(c, 0.12 + k * 0.2).fillCircle(h.x, h.y, h.r * k);
        if (truth) {
          g.fillStyle(0xfff4c0, 1).fillEllipse(h.x, h.y, 9, 5);
          g.fillStyle(0x2a1a10, 1).fillCircle(h.x, h.y, 1.6);
        } else {
          g.fillStyle(0xe8fcff, 0.8).fillTriangle(h.x - 3, h.y + 3, h.x + 3, h.y + 3, h.x, h.y - 4);
          g.lineStyle(1, 0x6a8aa8, 0.9).lineBetween(h.x - 1, h.y - 1, h.x + 1, h.y + 2);
        }
      } else {
        g.lineStyle(1, h.holds ? 0x8ae86a : 0xff3a3a, 0.9).strokeCircle(h.x, h.y, h.r);
        g.fillStyle(h.holds ? 0x8ae86a : 0xff3a3a, 0.15 + k * 0.3).fillCircle(h.x, h.y, h.r * k);
      }
    }
    // fighters, the lower one in front
    for (const f of [this.me, this.foe].sort((a, b) => a.y - b.y)) {
      if (f.shield > 0) g.lineStyle(1, 0xffffff, 0.8).strokeCircle(f.x, f.y, 11 * f.scale);
      // underground: a mound; invisible: a shimmer; up in the air: lifted
      if (f.st.under) {
        g.fillStyle(0x3a2a1e, 0.9).fillEllipse(f.x, f.y + 5, 14, 5);
        continue;
      }
      if (f.st.invis) {
        g.lineStyle(1, 0xffffff, 0.15 + Math.sin(t * 9) * 0.08).strokeEllipse(f.x, f.y, 14 * f.scale, 10 * f.scale);
        continue;
      }
      const lift = f.st.air || f.st.aloft ? 10 : f.st.u_lift ? 16 : 0;
      if (lift) g.fillStyle(0x000000, 0.3).fillEllipse(f.x, f.y + 6, 12 * f.scale, 4);
      // ---- THE BODY MOVES LIKE A BODY.  Walking, it steps: a bounce on
      // every stride and a little forward lean, with a scuff of dust off the
      // ground each time a foot comes down.  Attacking, it lunges: it draws
      // back for a beat, throws itself at the aim, and settles -- and it
      // swells a touch at the moment of the blow, so a hit reads as effort.
      const { ox, oy: oy0, k: k0 } = this.bodyMotion(f);
      let oy = oy0;
      let k = k0;
      if (this.boss && f === this.foe && f.hp > 0) {
        // ---- THE BOSS IS ALIVE: it breathes and bobs; before each mechanic
        // it rears up and swells as the power gathers in it; motes of its
        // element wheel round it, faster and more of them when it is angry
        const wind = this.started ? Phaser.Math.Clamp(1 - this.hazardT / 0.9, 0, 1) : 0;
        const breath = Math.sin(t * (this.bossRage ? 3.6 : 2.4));
        k *= 1 + breath * 0.035 + wind * 0.12;
        oy += Math.round(breath * 0.8 - wind * 3);
        const el = ELEMENTS[f.c.element];
        const n = this.bossRage ? 10 : 6;
        for (let m = 0; m < n; m++) {
          const a = t * (this.bossRage ? 2.6 : 1.5) + (m / n) * Math.PI * 2;
          const rr = (13 + wind * 4) * f.scale;
          g.fillStyle(m % 2 ? el.light : el.col, 0.55 + wind * 0.4).fillCircle(f.x + Math.cos(a) * rr, f.y - 2 + Math.sin(a) * rr * 0.45, 1 + wind);
        }
        if (wind > 0) g.lineStyle(1, el.light, wind * 0.7).strokeCircle(f.x, f.y, (10 + wind * 6) * f.scale);
        if (this.bossRage) g.lineStyle(1, 0xff4a3a, 0.45 + Math.sin(t * 8) * 0.25).strokeEllipse(f.x, f.y + 2, 24 * f.scale, 12 * f.scale);
      }
      // (banished: only a faint rift where it was; a sheep: a sheep)
      if (f.st.u_banish) {
        g.lineStyle(1, 0xc090e0, 0.5 + Math.sin(t * 9) * 0.3).strokeEllipse(f.x, f.y, 14, 5);
      } else if (f.st.u_poly) {
        g.fillStyle(0xf4f4ec, 1).fillEllipse(f.x, f.y, 14, 10);
        for (let q = 0; q < 5; q++) g.fillStyle(0xffffff, 1).fillCircle(f.x - 5 + q * 2.5, f.y - 4 + (q % 2), 2.5);
        g.fillStyle(0x2a2a2a, 1).fillEllipse(f.x + f.face * 7, f.y - 2, 5, 4).fillRect(f.x - 4, f.y + 4, 1.5, 3).fillRect(f.x + 3, f.y + 4, 1.5, 3);
      } else {
        drawCreature(g, f.c, f.x + ox, f.y - lift + oy, f.scale * k, f.face, f.st.sleep || f.st.stone || f.st.hibernate || f.st.u_ice ? 0 : f.moving ? t * 1.8 : t);
      }
      if ((f.st.hail ?? 0) > 0) for (let q = 0; q < (f.st.n_hail ?? 0); q++) g.fillStyle(0xe8fcff, 1).fillCircle(f.x + Math.cos(t * 3 + (q * Math.PI) / 3) * 14 * f.scale, f.y + Math.sin(t * 3 + (q * Math.PI) / 3) * 10 * f.scale, 1.6);
      if (f.st.u_ice) g.fillStyle(0xbfe8ff, 0.5).fillRect(f.x - 9 * f.scale, f.y - 11 * f.scale, 18 * f.scale, 18 * f.scale).lineStyle(1, 0xffffff, 0.9).strokeRect(f.x - 9 * f.scale, f.y - 11 * f.scale, 18 * f.scale, 18 * f.scale);
      if (f.st.u_bubble) g.lineStyle(1, 0x9ad0ff, 0.9).strokeCircle(f.x, f.y - 2, 13 * f.scale).fillStyle(0xbfe8ff, 0.2).fillCircle(f.x, f.y - 2, 13 * f.scale);
      if (f.st.u_lift) g.fillStyle(0x000000, 0.3).fillEllipse(f.x, f.y + 6, 12 * f.scale, 3);
      if (f.st.u_doom) {
        const n = Math.ceil(f.st.u_doom);
        g.fillStyle(0x7a2a9a, 0.9).fillCircle(f.x, f.y - 17 * f.scale, 4);
        for (let q = 0; q < n; q++) g.fillStyle(0xffffff, 1).fillRect(f.x - 3 + q * 2.5, f.y - 18 * f.scale, 1.5, 2);
      }
      if (f.st.u_leash) {
        const o = this.other(f);
        g.lineStyle(1, 0xb0e080, 0.9).lineBetween(o.x, o.y, f.x, f.y);
      }
      if ((f.st.n_skin ?? 0) > 0) g.lineStyle(2, 0xd0c4a8, 0.8).strokeCircle(f.x, f.y, 10 * f.scale);
      if (f.st.u_link) g.lineStyle(1, 0xc090e0, 0.6 + Math.sin(t * 6) * 0.3).strokeCircle(f.x, f.y, 11 * f.scale);
      if (f.st.u_counter) g.lineStyle(1, 0xffffff, 0.6 + Math.sin(t * 12) * 0.3).strokeRect(f.x - 9, f.y - 9, 18, 18);
      if (f.st.u_echo) g.lineStyle(1, 0xc0c8ff, 0.5).strokeCircle(f.x - f.face * 4, f.y, 9 * f.scale);
      if (f.st.u_phoenix) g.fillStyle(0xffb040, 0.6 + Math.sin(t * 8) * 0.3).fillCircle(f.x, f.y - 15 * f.scale, 1.5);
      if (f.st.u_hunted) g.lineStyle(1, 0xff3a3a, 0.8).strokeCircle(f.x, f.y, 4).lineBetween(f.x - 6, f.y, f.x + 6, f.y).lineBetween(f.x, f.y - 6, f.x, f.y + 6);
      if (f.st.u_carrion) g.lineStyle(1, 0x1a1024, 0.9).strokeCircle(f.x, f.y - 16 * f.scale, 3 + Math.sin(t * 5));
      if (f.st.stone) g.fillStyle(0x8a8a8a, 0.55).fillEllipse(f.x, f.y, 16 * f.scale, 15 * f.scale);
      if (f.st.cage) g.lineStyle(1, 0x9ad0ff, 0.9).strokeCircle(f.x, f.y, 12 * f.scale).fillStyle(0x9ad0ff, 0.2).fillCircle(f.x, f.y, 12 * f.scale);
      if (f.st.sleep) g.fillStyle(0xffffff, 0.9).fillRect(f.x + 6, f.y - 16 - ((t * 8) % 4), 3, 1).fillRect(f.x + 8, f.y - 15 - ((t * 8) % 4), 1, 1).fillRect(f.x + 6, f.y - 14 - ((t * 8) % 4), 3, 1);
      if (f.st.confused) for (let k = 0; k < 3; k++) g.fillStyle(0xffe060, 1).fillCircle(f.x + Math.cos(t * 6 + k * 2.1) * 7, f.y - 13 * f.scale + Math.sin(t * 6 + k * 2.1) * 2, 1);
      if (f.st.molten) g.lineStyle(1, 0xff8a3a, 0.6 + Math.sin(t * 10) * 0.3).strokeCircle(f.x, f.y, 9 * f.scale);
      if (f.st.armour) g.lineStyle(2, 0x6a4a3a, 0.7).strokeCircle(f.x, f.y, 9 * f.scale);
      if ((f.st.n_bark ?? 0) > 0) for (let k = 0; k < f.st.n_bark; k++) g.fillStyle(0x8a6a3a, 1).fillRect(f.x - 4 + k * 3, f.y - 14 * f.scale - 7, 2, 2);
      if (f.st.ward) g.lineStyle(1, 0x9ad0ff, 0.4).strokeCircle(f.x, f.y, 18 + Math.sin(t * 5) * 1.5);
      if (f.st.coil || f.st.starShell || f.st.gulp) g.lineStyle(1, 0xfff4c0, 0.8).strokeCircle(f.x, f.y, 11 * f.scale);
      if (f.st.curl) g.lineStyle(1, 0xd0c4a8, 0.8).strokeCircle(f.x, f.y, 8 * f.scale);
      if (f.st.cling) g.fillStyle(0x8ae88a, 0.8).fillRect(f.x - 1, f.y - 15 * f.scale, 2, 2);
      if (f.flash > 0) g.fillStyle(0xffffff, 0.5).fillCircle(f.x, f.y, 7 * f.scale);
      if (f.stun > 0) g.fillStyle(0xfff4a0, 1).fillRect(f.x - 5 + Math.sin(t * 20) * 3, f.y - 12 * f.scale, 2, 2);
      if (f.burn > 0) g.fillStyle(0xff8a3a, 0.8).fillTriangle(f.x - 2, f.y - 8 * f.scale, f.x + 2, f.y - 8 * f.scale, f.x, f.y - 12 * f.scale - Math.sin(t * 15) * 2);
      if (f.slow > 0 || f.chill > 0) g.lineStyle(1, 0xbff0ff, 0.8).strokeEllipse(f.x, f.y + 7 * f.scale, 14 * f.scale, 4);
      // the specials on it, so you can see what you are dealing with
      if (f.poison > 0) g.fillStyle(0x8ae86a, 0.9).fillCircle(f.x + 6 * f.scale, f.y - 9 * f.scale + Math.sin(t * 6) * 1.5, 1.5);
      if (f.marked > 0) {
        g.lineStyle(1, 0xff4a4a, 0.9).strokeCircle(f.x, f.y, 9 * f.scale);
        g.lineBetween(f.x - 11 * f.scale, f.y, f.x - 7 * f.scale, f.y).lineBetween(f.x + 7 * f.scale, f.y, f.x + 11 * f.scale, f.y);
      }
      if (f.guard > 0) g.lineStyle(1, 0xfff4c0, 0.7).strokeCircle(f.x, f.y, 10 * f.scale);
      if (f.weak > 0) g.fillStyle(0xc090e0, 0.9).fillTriangle(f.x - 8 * f.scale, f.y - 10 * f.scale, f.x - 6 * f.scale, f.y - 10 * f.scale, f.x - 7 * f.scale, f.y - 8 * f.scale);
      if (f.shred > 0) g.lineStyle(1, 0xffa060, 0.9).lineBetween(f.x - 4, f.y - 3, f.x + 4, f.y + 3);
      if (f.haste > 0 && f.moving) g.lineStyle(1, 0xf0fff4, 0.6).lineBetween(f.x - f.face * 9 * f.scale, f.y - 2, f.x - f.face * 14 * f.scale, f.y - 2);
      if (f.regen > 0) g.fillStyle(0x8ae88a, 0.8).fillRect(f.x - 1, f.y - 14 * f.scale - Math.sin(t * 5) * 2, 2, 2);
      if (f.shield > 0 && f.shieldMod) g.lineStyle(1, f.shieldMod === 'reflect' ? 0x9ad0ff : 0xffa040, 0.9).strokeCircle(f.x, f.y, 12 * f.scale);
      // the little bar over the head
      const w = 18 * f.scale;
      // (kept inside the ring: at the top wall it would sit on the move line)
      const by = Math.max(ARENA.y + 1, f.y - 12 * f.scale - 4);
      g.fillStyle(0x000000, 0.6).fillRect(f.x - w / 2, by, w, 2);
      g.fillStyle(f === this.me ? 0x6ae86a : 0xff5a5a, 1).fillRect(f.x - w / 2, by, w * (f.hp / f.max), 2);
    }
    for (const mi of this.minions) {
      const c = ELEMENTS[mi.owner.c.element];
      switch (mi.kind) {
        case 'drone':
          g.fillStyle(0xf0d030, 1).fillCircle(mi.x, mi.y, 2);
          g.fillStyle(0x2a2a2a, 1).fillRect(mi.x - 1, mi.y - 0.5, 2, 1);
          g.fillStyle(0xffffff, 0.6).fillCircle(mi.x - 1.5, mi.y - 2, 1.2).fillCircle(mi.x + 1.5, mi.y - 2, 1.2);
          break;
        case 'devil':
          for (let k = 0; k < 3; k++) g.lineStyle(1, 0xd8c8a0, 0.7).strokeEllipse(mi.x, mi.y - k * 3, 10 - k * 2, 3);
          break;
        case 'crow':
          g.fillStyle(0x1a1024, 1).fillTriangle(mi.x - 3, mi.y, mi.x + 3, mi.y, mi.x, mi.y - 2 + Math.sin(t * 20) * 1.5);
          break;
        case 'decoy': {
          // exactly as its maker looks: body, facing, and the bar over its head
          const o = mi.owner;
          drawCreature(g, o.c, mi.x, mi.y, o.scale, mi.ang >= 0 ? 1 : -1, t);
          const w = 18 * o.scale;
          const by = Math.max(ARENA.y + 1, mi.y - 12 * o.scale - 4);
          g.fillStyle(0x000000, 0.6).fillRect(mi.x - w / 2, by, w, 2);
          g.fillStyle(o === this.me ? 0x6ae86a : 0xff5a5a, 1).fillRect(mi.x - w / 2, by, w * (o.hp / o.max), 2);
          break;
        }
        case 'husk':
          g.fillStyle(0x3a4a3a, 1).fillEllipse(mi.x, mi.y, 8, 11);
          g.fillStyle(0x8affc0, 1).fillCircle(mi.x - 1.5, mi.y - 3, 0.8).fillCircle(mi.x + 1.5, mi.y - 3, 0.8);
          break;
        case 'spiderling':
          g.fillStyle(0xc8962a, 1).fillCircle(mi.x, mi.y, 2.2);
          g.lineStyle(0.6, 0x8a6a2a, 1).lineBetween(mi.x - 4, mi.y - 2, mi.x + 4, mi.y + 2).lineBetween(mi.x - 4, mi.y + 2, mi.x + 4, mi.y - 2);
          break;
        case 'copy':
          drawCreature(g, mi.owner.c, mi.x, mi.y, mi.owner.scale, -1, t);
          g.fillStyle(0xd8e8f0, 0.3 + Math.sin(t * 6) * 0.1).fillCircle(mi.x, mi.y, 9 * mi.owner.scale);
          break;
        case 'biter':
          // a small fanged hunter in its maker's colours
          g.fillStyle(c.dark, 1).fillEllipse(mi.x, mi.y, 8, 6);
          g.fillStyle(c.col, 1).fillEllipse(mi.x + mi.ang * 2, mi.y - 1, 5, 4);
          g.fillStyle(0xffffff, 1).fillRect(mi.x + mi.ang * 3.5, mi.y, 0.8, 1.2);
          g.fillStyle(0x000000, 1).fillCircle(mi.x + mi.ang * 2.5, mi.y - 2, 0.6);
          break;
        case 'turret':
          g.fillStyle(0x3a3a48, 1).fillRect(mi.x - 4, mi.y - 1, 8, 5);
          g.fillStyle(c.col, 1).fillCircle(mi.x, mi.y - 2, 3);
          g.lineStyle(1.5, c.light, 1).lineBetween(mi.x, mi.y - 2, mi.x + Math.cos(Math.atan2(this.other(mi.owner).y - mi.y, this.other(mi.owner).x - mi.x)) * 6, mi.y - 2 + Math.sin(Math.atan2(this.other(mi.owner).y - mi.y, this.other(mi.owner).x - mi.x)) * 6);
          break;
        case 'totem':
          g.fillStyle(0x6a4a2a, 1).fillRect(mi.x - 2, mi.y - 10, 4, 10);
          g.fillStyle(c.light, 0.9).fillCircle(mi.x, mi.y - 11, 2.5);
          g.lineStyle(1, 0x8ae88a, 0.25 + Math.sin(t * 4) * 0.1).strokeCircle(mi.x, mi.y, 50);
          break;
        case 'blade':
          g.lineStyle(1.5, c.light, 1).lineBetween(mi.x - Math.cos(mi.ang * 3) * 4, mi.y - Math.sin(mi.ang * 3) * 4, mi.x + Math.cos(mi.ang * 3) * 4, mi.y + Math.sin(mi.ang * 3) * 4);
          g.fillStyle(0xffffff, 0.8).fillCircle(mi.x, mi.y, 1);
          break;
        case 'twister':
          for (let k = 0; k < 5; k++) g.lineStyle(1, c.light, 0.75 - k * 0.1).strokeEllipse(mi.x + Math.sin(mi.ang + k) * 1.5, mi.y - k * 4, 16 - k * 2.5, 4);
          break;
        case 'ball':
          g.fillStyle(c.dark, 1).fillCircle(mi.x, mi.y, 7);
          g.lineStyle(1, c.light, 1).strokeCircle(mi.x, mi.y, 7);
          g.lineStyle(1, c.col, 1).lineBetween(mi.x + Math.cos(mi.ang) * 6, mi.y + Math.sin(mi.ang) * 6, mi.x - Math.cos(mi.ang) * 6, mi.y - Math.sin(mi.ang) * 6);
          break;
        case 'flower':
          for (let k = 0; k < 5; k++) g.fillStyle(0xffa0d0, 1).fillCircle(mi.x + Math.cos(k * 1.26 + t) * 2.2, mi.y + Math.sin(k * 1.26 + t) * 2.2, 1.4);
          g.fillStyle(0xfff060, 1).fillCircle(mi.x, mi.y, 1.2);
          break;
        case 'pylon':
          g.fillStyle(c.dark, 1).fillTriangle(mi.x - 3, mi.y + 2, mi.x + 3, mi.y + 2, mi.x, mi.y - 12);
          g.fillStyle(c.light, 0.6 + Math.sin(t * 6) * 0.3).fillTriangle(mi.x - 1.5, mi.y, mi.x + 1.5, mi.y, mi.x, mi.y - 9);
          break;
        case 'mirror':
          drawCreature(g, mi.owner.c, mi.x, mi.y, mi.owner.scale * 0.85, mi.owner.face, t);
          g.lineStyle(1, 0xc0e8ff, 0.5 + Math.sin(t * 8) * 0.2).strokeCircle(mi.x, mi.y, 9 * mi.owner.scale);
          break;
        case 'orb':
          g.fillStyle(0xfff4a0, 0.35).fillCircle(mi.x, mi.y, 6);
          g.fillStyle(0xffffff, 1).fillCircle(mi.x, mi.y, 2.5);
          for (let k = 0; k < 3; k++) g.lineStyle(1, 0xfff080, 0.9).lineBetween(mi.x, mi.y, mi.x + Math.cos(mi.ang + k * 2.1) * 6, mi.y + Math.sin(mi.ang + k * 2.1) * 6);
          break;
        case 'tentacle': {
          // a curling arm up out of the floor
          g.lineStyle(3, c.dark, 1);
          let px = mi.x;
          let py = mi.y;
          for (let k = 1; k <= 4; k++) {
            const nx = mi.x + Math.sin(mi.ang + k * 0.9) * k * 1.5;
            const ny = mi.y - k * 3.5;
            g.lineBetween(px, py, nx, ny);
            px = nx;
            py = ny;
          }
          g.fillStyle(c.col, 1).fillCircle(px, py, 1.5);
          break;
        }
        case 'doll':
          drawCreature(g, mi.owner.c, mi.x, mi.y, mi.owner.scale * 0.7, mi.ang >= 0 ? 1 : -1, t);
          g.fillStyle(0xff4a3a, 0.6 + Math.sin(t * 14) * 0.4).fillCircle(mi.x, mi.y - 8, 1.5);
          break;
        case 'shade': {
          const o = this.other(mi.owner);
          drawCreature(g, o.c, mi.x, mi.y, o.scale, mi.ang >= 0 ? 1 : -1, t);
          g.fillStyle(0x07040e, 0.7).fillEllipse(mi.x, mi.y, 18 * o.scale, 16 * o.scale);
          g.fillStyle(0xff3a5a, 1).fillCircle(mi.x - 2, mi.y - 3, 0.8).fillCircle(mi.x + 2, mi.y - 3, 0.8);
          break;
        }
        case 'snowball':
          g.fillStyle(0xffffff, 1).fillCircle(mi.x, mi.y, 5 * (mi.size ?? 1));
          g.lineStyle(1, 0xbfe8ff, 1).strokeCircle(mi.x, mi.y, 5 * (mi.size ?? 1));
          break;
        case 'rock':
          g.fillStyle(0x7a6a50, 1).fillCircle(mi.x, mi.y, 6);
          g.lineStyle(1, 0xe8fcff, 0.8).lineBetween(mi.x + Math.cos(mi.ang) * 5, mi.y + Math.sin(mi.ang) * 5, mi.x - Math.cos(mi.ang) * 5, mi.y - Math.sin(mi.ang) * 5);
          break;
        case 'glaive':
          for (let k = 0; k < 3; k++) {
            const a = mi.ang + (k * Math.PI * 2) / 3;
            g.fillStyle(c.light, 1).fillTriangle(mi.x, mi.y, mi.x + Math.cos(a) * 7, mi.y + Math.sin(a) * 7, mi.x + Math.cos(a + 0.5) * 4, mi.y + Math.sin(a + 0.5) * 4);
          }
          break;
        case 'lure':
          g.lineStyle(0.6, c.light, 0.8).lineBetween(mi.owner.x, mi.owner.y - 6, mi.x, mi.y);
          g.fillStyle(0xfff4a0, 0.8 + Math.sin(t * 7) * 0.2).fillCircle(mi.x, mi.y, 2.5);
          break;
      }
    }
    for (const s of this.shots) {
      const size = s.a.mod === 'grow' ? 1 + s.t * 2.2 : s.grace !== undefined && s.life < 0.4 && s.a.mod === 'none' ? 0.7 : 1;
      // what this element (or this particular shot) is made of, in flight
      const el = s.owner.c.element;
      drawShot(g, shotStyle(s.a.name, el), s.x, s.y, s.vx, s.vy, s.t, size, el, (s.ang * 97) % 13);
    }
    for (const e of this.fx) {
      const k = e.t / e.life;
      if (e.kind === 'ring') g.lineStyle(2, e.col, 1 - k).strokeCircle(e.x, e.y, e.r * (0.3 + k * 0.7));
      else if (e.kind === 'beam') {
        g.lineStyle(e.r, e.col, 1 - k).lineBetween(e.x, e.y, e.x2!, e.y2!);
        g.lineStyle(1, 0xffffff, 1 - k).lineBetween(e.x, e.y, e.x2!, e.y2!);
      } else if (e.kind === 'melee' && e.style) {
        const o = e.owner;
        drawMelee(g, e.style, o ? o.x : e.x, o ? o.y : e.y, e.ang ?? 0, k, e.r, o ? o.c.element : 'stone');
      } else if (e.kind === 'boom') g.fillStyle(e.col, 0.7 * (1 - k)).fillCircle(e.x, e.y, e.r * (0.5 + k * 0.5));
      else g.fillStyle(e.col, 1 - k).fillCircle(e.x, e.y, e.r * (1 - k * 0.5));
    }

    // murk: you only see near yourself
    this.dark.clear();
    if (this.me.blind > 0) {
      // (user, 28 Oct: darker, and a smaller circle you can see in --
      // an ink blackout closes it tighter still)
      const a = Math.min(1, this.me.blind) * 0.97;
      const r0 = this.me.st.ink ? BLIND_SEE - 8 : BLIND_SEE;
      const rt = this.darkRT!;
      const h = this.holeG!;
      rt.setVisible(true).clear().fill(0x0a0612, a);
      // the hole, with a soft rim: rings that each let a little more through
      h.clear();
      h.fillStyle(0xffffff, 0.3).fillCircle(this.me.x, this.me.y, r0 + 6);
      h.fillStyle(0xffffff, 0.3).fillCircle(this.me.x, this.me.y, r0 + 3);
      h.fillStyle(0xffffff, 0.45).fillCircle(this.me.x, this.me.y, r0);
      h.fillStyle(0xffffff, 1).fillCircle(this.me.x, this.me.y, r0 - 3);
      rt.erase(h, 0, 0);
    } else this.darkRT?.setVisible(false);

    // hud
    const u = this.ui;
    u.clear();
    const bar = (x: number, f: Fighter, right: boolean): void => {
      const w = 110;
      u.fillStyle(0x000000, 0.7).fillRect(right ? x - w : x, 13, w, 5);
      u.fillStyle(f === this.me ? 0x6ae86a : 0xff5a5a, 1).fillRect(right ? x - w * (f.hp / f.max) : x, 13, w * (f.hp / f.max), 5);
    };
    bar(8, this.me, false);
    bar(GAME_W - 8, this.foe, true);
    // (in training the clock's slot holds the LEAVE button instead)
    this.timerText.setText(this.training ? '' : `${Math.max(0, Math.ceil(TIME_LIMIT - this.elapsed))}`);
    const ic = ELEMENTS[this.me.c.element].light;
    this.me.c.attacks.forEach((a, i) => {
      const b = this.atkBtns[i];
      if (!b) return;
      const ready = Phaser.Math.Clamp(1 - this.me.cds[i] / a.cd, 0, 1);
      const cooling = ready < 1;
      // the moment it comes back: a flash round the button
      if (!cooling && !this.wasReady[i]) this.readyFlash[i] = 0.4;
      this.wasReady[i] = !cooling;
      this.readyFlash[i] = Math.max(0, this.readyFlash[i] - 1 / 60);
      const flash = this.readyFlash[i] / 0.4;
      const left = this.me.cds[i];
      // (rounded up: it never reads 0.0 while it is still not ready)
      const secs = left >= 10 ? `${Math.ceil(left)}` : (Math.ceil(left * 10) / 10).toFixed(1);
      const cd = this.cdTexts[i];
      if (this.touch) {
        u.fillStyle(i === this.sel ? 0x6a3aa8 : 0x2a2a48, 0.85).fillCircle(b.x, b.y, 12);
        u.lineStyle(1, i === this.sel ? 0xffe060 : 0x8a8ab0, 1).strokeCircle(b.x, b.y, 12);
        drawAbilityIcon(u, a, b.x, b.y, ic);
        if (cooling) {
          // dark over the part still to come back, and the seconds on top
          u.fillStyle(0x000000, 0.65).slice(b.x, b.y, 12, -Math.PI / 2, -Math.PI / 2 + (1 - ready) * Math.PI * 2, false).fillPath();
          u.lineStyle(2, 0x6ac8ff, 0.9).beginPath().arc(b.x, b.y, 12, -Math.PI / 2, -Math.PI / 2 + ready * Math.PI * 2, false).strokePath();
        }
        if (flash > 0) u.lineStyle(2, 0xfff4a0, flash).strokeCircle(b.x, b.y, 12 + (1 - flash) * 5);
        cd?.setVisible(cooling).setText(secs).setOrigin(0.5, 0.5).setPosition(b.x, b.y);
      } else {
        u.fillStyle(i === this.sel ? 0x4a2a78 : 0x1a1a30, 0.9).fillRect(b.x - 49, b.y - 7, 98, 13);
        u.lineStyle(1, i === this.sel ? 0xffe060 : 0x4a4a68, 1).strokeRect(b.x - 49, b.y - 7, 98, 13);
        // the keycap, then the ability's icon beside it
        u.fillStyle(0x0c0c18, 1).fillRect(b.x - 47, b.y - 5, 9, 9);
        u.lineStyle(1, i === this.sel ? 0xffe060 : 0x8a8ab0, 1).strokeRect(b.x - 47, b.y - 5, 9, 9);
        u.fillStyle(0xffffff, 0.12).fillRect(b.x - 46, b.y - 4, 7, 1);
        drawAbilityIcon(u, a, b.x - 30, b.y - 1, ic);
        if (cooling) {
          // RELOADING: the whole button greyed down, a bright bar filling
          // along its foot, and the seconds left at its end
          u.fillStyle(0x000000, 0.55).fillRect(b.x - 48, b.y - 6, 96, 11);
          u.fillStyle(0x0a0a14, 1).fillRect(b.x - 48, b.y + 4, 96, 2);
          u.fillStyle(0x6ac8ff, 1).fillRect(b.x - 48, b.y + 4, Math.round(96 * ready), 2);
        }
        if (flash > 0) u.lineStyle(2, 0xfff4a0, flash).strokeRect(b.x - 50, b.y - 8, 100, 15);
        // (the name gives way to the countdown, and comes back with the move)
        this.nameLabels[i]?.setText(cooling ? `RELOAD ${secs}S` : a.name).setTint(cooling ? 0x6ac8ff : PALETTE.cream);
        cd?.setVisible(false);
      }
    });
    if (this.band) {
      for (const t of this.cdTexts) t.setVisible(false);
      // the phone's own buttons carry the countdown: a ring that fills, the
      // seconds in the middle, the icon muted until it has gone all the way round
      const keys: KeyName[] = ['FOUR', 'FIVE', 'SIX'];
      this.me.c.attacks.forEach((a, i) => {
        const left = this.me.cds[i];
        const secs = left >= 10 ? `${Math.ceil(left)}` : (Math.ceil(left * 10) / 10).toFixed(1);
        touchControls.setCooldown(keys[i], left > 0 ? Phaser.Math.Clamp(left / a.cd, 0, 1) : null, secs);
      });
      // the ULT button counts down too
      if (this.me.ult) touchControls.setCooldown('I', this.me.ultT > 0 ? Phaser.Math.Clamp(this.me.ultT / ULT_COOLDOWN_S, 0, 1) : null, `${Math.ceil(this.me.ultT)}`);
    }
    this.drawUlt(u);
    // the chosen attack's line, fading
    const showing = this.infoT > 0 && !this.over && !this.dialog;
    this.info.setVisible(showing).setAlpha(Math.min(1, this.infoT * 3));
    this.info2.setVisible(false);
    this.infoPlate.setVisible(false);
    this.effLabel?.setVisible(!showing);
    this.stepLabel?.setVisible(!showing);
    if (showing) {
      const age = (this.time.now - this.infoAt) / 1000;
      const k = Phaser.Math.Clamp((age - INFO_HOLD) * INFO_SPEED, 0, this.infoRun);
      this.info.setX(INFO_X - Math.round(k));
    }
    // (user, 5 Nov: no dotted aim line and no targeting ring, desktop or phone)
    this.drawWallClocks(u);
    if (this.touch) {
      const s = this.moveStick;
      const bx = s.id >= 0 ? s.bx : s.hx;
      const by = s.id >= 0 ? s.by : s.hy;
      u.fillStyle(0x000000, 0.35).fillCircle(bx, by, 20);
      u.lineStyle(1, 0xffffff, 0.4).strokeCircle(bx, by, 20);
      u.fillStyle(0xffffff, 0.6).fillCircle(bx + s.dx, by + s.dy, 8);
    }
  }
}
