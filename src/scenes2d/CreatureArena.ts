/**
 * ---- CREATURE CLASH, the fight.  Real time, top down, one on one.
 *
 *   move      WASD / arrows, or the move stick
 *   choose    1 2 3, or the three attack buttons -- BEFORE you aim
 *   aim+fire  mouse + click, or drag the aim stick and let go
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

import { countBack } from '../core/pause';
import { STAGES, WORLDS, lineupFoe, storyFoe, storyPrice } from '../game/creatureStory';
import { paintFloor } from '../art/arenaFloors';
import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { button, centerText, confirmDialog, forfeitLines, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { drawCreature } from '../art/creatureArt';
import { plainWords } from '../game/plainWords';
import { drawMelee, drawShot, meleeStyle, shotStyle, type MeleeStyle } from '../art/clashFx';
import { SPECIALS } from '../game/specials';
import { BATTLE_COST, BIOMES, ELEMENTS, LADDER_BOSS_WIN, LADDER_COST, creatureById, LADDER_LEVELS, type Attack, type Biome, type BossDef, type CoverShape, type Creature } from '../game/creatures';
import { activeOwned, finishBattle, ladderStep, nextZoneFoe, ownedCreature, startBattle, startLadderBattle, startStory } from '../game/creatureClash';
import { MAX_LEVEL, levelOf, withLevel } from '../game/creatureLevel';
import {
  AURA_POWER, AURA_S, AURA_SPEED, CHILL_S, EVADE_CHANCE, EVADE_S, FOCUS_CRIT, FOCUS_S, FURY_MUL, FURY_S, QUICK_RATE, QUICK_S, CHILL_SPEED, DRAIN_FRAC, EXECUTE_MUL, GUARD_S, HASTE_S, HASTE_SPEED, HOLD_S, LINGER_DMG, LINGER_S, MARK_MUL, MARK_S, MEND_FRAC,
  POISON_PER_S, POISON_S, WALL_DEFAULT, WALL_SPECS, REGEN_PER_S, REGEN_S, ROOT_S, SHRED_MUL, SHRED_S, SILENCE_S, STAGGER_S, STRIKE_DMG, THORNS_DMG, WEAK_MUL, WEAK_S, attackInfo, buttonWords,
} from '../game/attackInfo';
import { abilityIconURL, drawAbilityIcon } from '../art/abilityIcons';
import { setCabinetTouch } from '../game/touchLayouts';
import { backPlate } from '../ui/plate';
import { touchControls, type KeyName } from '../ui/touchControls';
import { capLabel, codeFor, gameKeys, setKeyScope } from '../core/keymap';

/** The Clash's own keys: J K L fire abilities 1 2 3 (log B6), movable in CONTROLS. */
const CLASH_KEYS = ['KeyJ', 'KeyK', 'KeyL'];
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
  dash: { vx: number; vy: number; t: number; dmg: number; hit: boolean; a: Attack; bounced?: boolean; back?: boolean } | null;
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
  kind?: 'burn' | 'flow' | 'honey' | 'floe' | 'mycel' | 'rune' | 'beacon' | 'trail' | 'drift' | 'halo';
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
  kind: 'drone' | 'devil' | 'crow' | 'decoy' | 'husk' | 'spiderling' | 'copy' | 'lure';
  x: number;
  y: number;
  ang: number;
  life: number;
  /** Health, for the ones you can shoot down (0: not a target). */
  hp: number;
  cd: number;
  /** A spiderling holding on to someone. */
  latched?: boolean;
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
  private mode: 'zone' | 'ladder' | 'training' | 'story' = 'zone';
  /** Story: which world, which of its stages, and who (drawn when the fight opens, paid at the bell). */
  private storyWorld = 0;
  private storyStage = 0;
  private storyFoeId = '';
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

  init(data: { biome?: string; mode?: 'zone' | 'ladder' | 'training' | 'story'; from?: string; training?: boolean; resumed?: boolean; sim?: SimSpec; world?: number }): void {
    this.storyWorld = data.world ?? 0;
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
    // (a fresh fight: the last one's strip mask and labels went with it)
    this.infoMask = null;
    this.effLabel = null;
    this.stepLabel = null;
    this.infoT = 0;
    this.foeLevel = 0;
    const own = activeOwned();
    const sim = this.simSpec;
    // (yours fights at its level: see creatureLevel)
    const mine = sim ? withLevel(creatureById(sim.me)!, sim.level) : own ? ownedCreature(own) : undefined;
    this.myLevel = sim ? sim.level : own ? levelOf(own.xp ?? 0) : 1;
    if (!mine) {
      this.scene.start('CreatureHub', { from: this.from, msg: 'YOU NEED A CREATURE TO FIGHT.' });
      return;
    }
    // WHO YOU ARE UP AGAINST.  A ladder fight is the run's own next step,
    // drawn when the run was paid for: the place and the opponent come from
    // it, never from here, so nothing about it can be re-rolled.
    let wild: Creature;
    if (sim) {
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
      const stage = open ? ob!.stage ?? 0 : cs.story.stage[w] ?? 0;
      const foeId = open ? ob!.foe ?? '' : stage >= STAGES ? WORLDS[w].boss : lineupFoe(w, stage);
      const sf = storyFoe(w, stage, foeId);
      if (!sf) {
        this.scene.start('CreatureHub', { from: this.from, screen: 'story', msg: 'NO SUCH FIGHT.' });
        return;
      }
      this.storyWorld = w;
      this.storyStage = stage;
      this.storyFoeId = foeId;
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
    // (a copy: the roster's own entry is never renamed)
    const foeC = this.training ? { ...wild, name: 'TRAINING DUMMY' } : wild;
    this.me = this.fighter(mine, ARENA.x + 40, ARENA.y + ARENA.h / 2, 1, 1);
    // (a boss is bigger, not huge: it has to fit the arena and be fair to hit)
    this.foe = this.fighter(foeC, ARENA.x + ARENA.w - 40, ARENA.y + ARENA.h / 2, -1, this.boss ? 1.35 : 1);
    this.lastFoePos = { x: this.foe.x, y: this.foe.y, stuck: 0 };

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
    if (!this.training && !open) {
      const r = this.mode === 'ladder' ? startLadderBattle() : this.mode === 'story' ? startStory(this.storyWorld, this.storyFoeId) : startBattle(this.biome.id, this.foe.c.id);
      if (!r.ok) {
        this.scene.start('CreatureHub', { from: this.from, screen: this.mode === 'ladder' ? 'ladder' : this.mode === 'story' ? 'story' : 'map', msg: r.msg });
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
      const t = centerText(this, ARENA.x + ARENA.w / 2, this.touch ? ARENA.y + 50 : ARENA.y + 10, 'TRAINING MODE DOES NOT AWARD TOKENS.', PALETTE.fog).setDepth(2401);
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
    const p = this.input.activePointer;
    this.fire(this.me, i, p.worldX - this.me.x, p.worldY - this.me.y);
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
      (!apart || !this.props.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + r + 10));
    const add = (parts: Prop[]): void => {
      if (!parts.length) return;
      this.barriers.push({ kind: b.prop, parts, seed: rnd.between(1, 9999), life: -1, owner: null });
      this.props.push(...parts);
    };
    const n = this.boss ? 3 : 4;
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
            if (Math.abs(y - (midY + gap)) < 15) continue;
            const x = cx + rnd.between(-2, 2);
            if (!clear(x, y, 5, false)) continue;
            parts.push({ x, y, r: 5 });
          }
          add(parts);
        }
        break;
      }
      case 'grove': {
        // clumps, the way trees grow -- real cover you can stand inside
        let guard = 0;
        while (this.barriers.length < n && guard++ < 200) {
          const cx = ARENA.x + rnd.between(46, ARENA.w - 46);
          const cy = ARENA.y + rnd.between(COVER_LANE + 4, ARENA.h - COVER_LANE - 4);
          if (!clear(cx, cy, 16)) continue;
          const parts: Prop[] = [];
          for (let i = 0; i < rnd.between(4, 6); i++) {
            const a = rnd.rotation();
            const d = rnd.between(0, 11);
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
        while (this.barriers.length < n + 2 && guard++ < 200) {
          const x = ARENA.x + rnd.between(50, ARENA.w - 50);
          const y = ARENA.y + rnd.between(COVER_LANE, ARENA.h - COVER_LANE);
          if (!clear(x, y, 9)) continue;
          add([{ x, y, r: rnd.between(6, 9) }]);
        }
        break;
      }
    }
  }

  /** A shot into a breakable piece of wall: it cracks, and at nothing it falls. */
  private chip(p: Prop, dmg: number): void {
    if (p.hp === undefined) return;
    p.hp -= dmg;
    if (p.hp > 0) {
      this.repaintCover();
      return;
    }
    this.props = this.props.filter((q) => q !== p);
    for (const b of this.barriers) b.parts = b.parts.filter((q) => q !== p);
    this.barriers = this.barriers.filter((b) => b.parts.length || b.max === undefined);
    this.fx.push({ kind: 'boom', x: p.x, y: p.y, r: 10, t: 0, life: 0.3, col: 0xd8d0c0 });
    audio.sfx('item_thud', 0.4);
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
        this.paintProp(g, p, bar);
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
    this.fire(this.me, this.sel, p.x - this.me.x, p.y - this.me.y);
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
        }),
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
    const paid = this.started;
    const c = store.get().creatures;
    const risk = !paid ? 0 : this.mode === 'ladder' ? LADDER_COST : this.mode === 'story' ? storyPrice(this.storyWorld, this.storyWorld < c.story.cleared).cost : BATTLE_COST;
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
        const screen = this.mode === 'ladder' ? 'ladder' : this.mode === 'story' ? 'story' : 'map';
        const r = paid ? finishBattle(false) : null;
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

  private askQuit(): void {
    if (!this.training) return;
    this.scene.start('CreatureHub', { from: this.from });
  }

  // ----------------------------------------------------------------- combat

  private fire(f: Fighter, i: number, ax: number, ay: number): boolean {
    if (f.cds[i] > 0 || !this.canAct(f) || f.dash || f.hp <= 0) return false;
    const a = f.c.attacks[i];
    // a boss's floor mechanic runs on its own clock, not as a button
    if (a.sp && SPECIALS[a.sp]?.ai === 'never') return false;
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
    // out of hiding the moment it attacks
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
      case 'dash':
        f.dash = { vx: ux * a.reach * mired, vy: uy * a.reach * mired, t: 0.28, dmg, hit: false, a };
        if (a.sp === 'thunder_charge') f.st.unstop = 0.3;
        if (a.sp === 'hit_and_run') {
          f.ref.retX = f.x;
          f.ref.retY = f.y;
        }
        audio.sfx('throw_whoosh', 0.4);
        break;
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
          if (this.segDist(o.x, o.y, f.x, f.y, x2, y2) < 6 * o.scale + 2 && (pierce || !this.blocked(f.x, f.y, o.x, o.y))) this.hit(f, o, Math.round(dmg * k), a);
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
          .filter((q) => Math.hypot(q.x - this.other(f).x, q.y - this.other(f).y) > 10 * this.other(f).scale);
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
          if (this.segDist(o.x, o.y, f.x, f.y, x2, y2) < 6 * o.scale + 3 && (f.c.element === 'glow' || !this.blocked(f.x, f.y, o.x, o.y))) this.hit(f, o, dmg, a);
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
      case 'storm_eye':
        f.st.eye = 4;
        audio.sfx('wind_gust', 0.6);
        return true;
      case 'cave_in':
        this.caveIn = { owner: f, t: 6, tick: 0 };
        audio.sfx('crumble', 0.7);
        return true;
      case 'mirror_riddle':
        for (let k = 0; k < 2; k++) {
          const sx = cx(ARENA.x + 40 + Math.random() * (ARENA.w - 80));
          const sy = cy(ARENA.y + 20 + Math.random() * (ARENA.h - 40));
          this.minions.push({ owner: f, kind: 'copy', x: sx, y: sy, ang: 0, life: 6, hp: 1, cd: 0 });
        }
        audio.sfx('glass_crack', 0.5);
        return true;
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
    return f.stun <= 0 && !f.st.sleep && !f.st.cage && !f.st.knock && !f.st.hibernate && !f.st.stone && !f.st.under && !f.st.channel;
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
            this.hit(mi.owner, o, 2, null);
          }
          break;
        case 'husk':
          chase(28);
          if (touching) {
            mi.life = 0;
            this.fx.push({ kind: 'boom', x: mi.x, y: mi.y, r: 14, t: 0, life: 0.35, col: 0x8affc0 });
            this.hit(mi.owner, o, 12, null);
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
    if (this.over || to.hp <= 0 || to.invuln > 0 || to.st.cage || to.st.under) return;
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
    to.hp = Math.max(0, to.hp - d);
    to.flash = 0.12;
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

  private blocked(x1: number, y1: number, x2: number, y2: number): boolean {
    return this.props.some((p) => this.segDist(p.x, p.y, x1, y1, x2, y2) < p.r);
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
    let nx = f.x + (vx + f.kx) * dt;
    let ny = f.y + (vy + f.ky) * dt;
    f.kx *= Math.pow(0.02, dt);
    f.ky *= Math.pow(0.02, dt);
    nx = Phaser.Math.Clamp(nx, ARENA.x + r, ARENA.x + ARENA.w - r);
    ny = Phaser.Math.Clamp(ny, ARENA.y + r, ARENA.y + ARENA.h - r);
    // (phasing: cover is not there for it)
    if (!f.st.phase) {
      for (const p of this.props) {
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
    if (f.st.curl) k *= 1.3;
    // spiderlings hanging off it
    k *= Math.pow(0.85, this.minions.filter((mi) => mi.kind === 'spiderling' && mi.latched && mi.owner !== f).length);
    // the floor under it
    for (const pl of this.pools) {
      if (Math.hypot(pl.x - f.x, pl.y - f.y) > pl.r) continue;
      if (pl.kind === 'honey' && pl.owner !== f) k *= 0.4;
      if (pl.kind === 'floe') k *= pl.owner === f ? 1.4 : 0.6;
      if (pl.kind === 'drift' && pl.owner !== f) k *= 0.5;
    }
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
      if (f.dash.a.mod === 'linger' && Math.random() < dt * 14) this.pool(f, f.x, f.y, 9);
      const o = this.other(f);
      if (!f.dash.hit && Math.hypot(o.x - f.x, o.y - f.y) < 7 * (o.scale + f.scale)) {
        f.dash.hit = true;
        this.hit(f, o, f.dash.dmg, f.dash.a);
      }
      if (f.dash && f.dash.t <= 0) {
        // an echoing charge: a shockwave where it stopped
        if (f.dash.a.mod === 'echo') this.burst(f, f.x, f.y, 24, Math.round(f.dash.dmg * 0.5), f.dash.a, 'ring', false);
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
    const clear = !this.blocked(f.x, f.y, p.x, p.y) || f.c.element === 'glow';
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
    this.me.hp = Math.min(this.me.max, this.me.hp + this.me.max * 0.12 * dt);
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
    if (this.training) this.trainDummy(dt);
    else this.think(dt);
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
      } else if (!s.pierce && this.props.some((p) => Math.hypot(p.x - s.x, p.y - s.y) < p.r)) {
        const p = this.props.find((q) => Math.hypot(q.x - s.x, q.y - s.y) < q.r)!;
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
        case 'rune': {
          const d = Math.hypot(pl.x - o.x, pl.y - o.y) || 1;
          if (d < 110 && d > 4) {
            o.kx += ((pl.x - o.x) / d) * 150 * dt;
            o.ky += ((pl.y - o.y) / d) * 150 * dt;
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
  private bossPattern(def: BossDef, at = { x: this.me.x, y: this.me.y }): void {
    const foe = this.foe;
    const col = ELEMENTS[foe.c.element];
    const cx = (x: number) => Phaser.Math.Clamp(x, ARENA.x + 10, ARENA.x + ARENA.w - 10);
    const cy = (y: number) => Phaser.Math.Clamp(y, ARENA.y + 10, ARENA.y + ARENA.h - 10);
    const put = (h: Omit<Hazard, 't0' | 'dmg' | 'r' | 'kind'> & Partial<Pick<Hazard, 'dmg' | 'r' | 'kind'>>): void => {
      this.hazards.push({ kind: 'mark', r: def.r, dmg: def.dmg, ...h, x: cx(h.x), y: cy(h.y), t0: h.t });
    };
    switch (def.pattern) {
      case 'teleport': {
        // marks of grave-light round you, and it blinks to wherever it can see you
        for (let i = 0; i < def.n; i++) {
          const a = (i / def.n) * Math.PI * 2 + Math.random();
          put({ x: at.x + Math.cos(a) * (i === 0 ? 0 : 26), y: at.y + Math.sin(a) * (i === 0 ? 0 : 20), t: 1.2 + i * 0.15 });
        }
        this.blinkIn();
        break;
      }
      case 'meteor': {
        // one on you, one where you are running to, the rest round about:
        // the shadow grows for a second and a half, then it lands -- hard
        const lead = { x: at.x + this.meV.x * 1.2, y: at.y + this.meV.y * 1.2 };
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
        for (let i = 1; i < def.n; i++) put({ x: at.x + this.meV.x * 0.5 * i + (Math.random() - 0.5) * 24, y: at.y + this.meV.y * 0.5 * i + (Math.random() - 0.5) * 20, t: 1.1 + i * 0.3, holds: true });
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
    }
  }

  /** The lich's trick: gone in a puff, and back somewhere that can see you. */
  private blinkIn(): void {
    const foe = this.foe;
    const spot = this.sightSpot(foe, true);
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
    // (what the run had paid before this one, for the run's total)
    const before = store.get().creatures.ladder?.earned ?? 0;
    const r = finishBattle(won);
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
            this.boss ? (r.worldOpened ? (nextW ? `${nextW.name} IS OPEN!` : 'THE STORY IS DONE - THE LADDER IS OPEN!') : 'BACK TO BATTLE 1 OF THIS WORLD.') : this.storyStage + 1 >= STAGES ? `NEXT: ${WORLDS[this.storyWorld].bossName}` : `NEXT: BATTLE ${this.storyStage + 2} OF ${STAGES}`,
            PALETTE.cream,
          ]);
        }
        if (ladder) lines.push([this.boss ? `THE RUN PAID ${before + r.paid} TOKENS IN ALL.` : this.level >= LADDER_LEVELS ? 'NEXT: THE FINAL BOSS' : `NEXT: LEVEL ${this.level + 1} OF ${LADDER_LEVELS}`, PALETTE.cream]);
        const xpLine = r.xp ? `+${r.xp} XP` : this.myLevel >= MAX_LEVEL ? 'MAX LEVEL - NO MORE XP' : '';
        if (xpLine) lines.push([xpLine, 0x8ae88a]);
      } else {
        lines.push([r.msg, PALETTE.cream]);
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
      const screen = ladder ? 'ladder' : story ? 'story' : 'map';
      box.add(button(this, X, Y + 36, 'CONTINUE', () => this.scene.start('CreatureHub', { from: this.from, screen, world: this.storyWorld }), { width: 80, height: 13 }));
    });
  }

  /**
   * How far the chosen attack reaches, drawn faintly on the ground from you:
   * a line for a shot, a beam or a charge, a cone for a fan, a ring for an
   * area or a blink, the throw ring for a trap, a halo for a guard.
   */
  private drawReach(g: Phaser.GameObjects.Graphics): void {
    const me = this.me;
    const a = me.c.attacks[this.sel];
    const inf = attackInfo(a, me.c.element);
    const col = ELEMENTS[me.c.element].light;
    let ax = this.foe.x - me.x;
    let ay = this.foe.y - me.y;
    if (!this.touch && !this.band) {
      const p = this.input.activePointer;
      ax = p.x - me.x;
      ay = p.y - me.y;
    }
    const m = Math.hypot(ax, ay) || 1;
    const ux = ax / m;
    const uy = ay / m;
    const r = inf.reachPx;
    g.lineStyle(1, col, 0.28);
    if (a.kind === 'bolt' || a.kind === 'beam' || a.kind === 'dash') {
      for (let d = 6; d < r; d += 6) g.fillStyle(col, 0.3).fillRect(me.x + ux * d, me.y + uy * d, 1, 1);
      g.strokeCircle(me.x + ux * r, me.y + uy * r, 2);
    } else if (a.kind === 'spread') {
      const ang = Math.atan2(uy, ux);
      for (const k of [-0.26, 0, 0.26]) {
        for (let d = 6; d < r; d += 8) g.fillStyle(col, 0.25).fillRect(me.x + Math.cos(ang + k) * d, me.y + Math.sin(ang + k) * d, 1, 1);
      }
    } else if (a.kind === 'nova' || a.kind === 'blink' || a.kind === 'mine') {
      g.strokeCircle(me.x, me.y, r);
    } else if (a.kind === 'shield' || a.kind === 'aura' || a.kind === 'mend') {
      g.strokeCircle(me.x, me.y, 11);
      if (a.kind !== 'shield') g.strokeCircle(me.x, me.y, 14);
    } else if (a.kind === 'arc') {
      // where it would land, and the burst it would make there
      const d = Math.min(r, m);
      g.strokeCircle(me.x + ux * d, me.y + uy * d, 16);
      for (let k = 0.15; k < 1; k += 0.15) g.fillStyle(col, 0.3).fillRect(me.x + ux * d * k, me.y + uy * d * k - Math.sin(k * Math.PI) * 10, 1, 1);
    } else if (a.kind === 'snare') {
      for (let d = 6; d < r; d += 7) g.fillStyle(col, 0.3).fillRect(me.x + ux * d, me.y + uy * d, 1, 1);
      g.strokeCircle(me.x + ux * r, me.y + uy * r, 4);
    } else if (a.kind === 'wall') {
      // the three pieces, across the way you are pointing
      const d = Math.max(16, Math.min(a.reach, m));
      for (const k of [-1, 0, 1]) g.strokeCircle(me.x + ux * d + -uy * k * 9, me.y + uy * d + ux * k * 9, 6);
    }
  }

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
      const lift = f.st.air || f.st.aloft ? 10 : 0;
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
      drawCreature(g, f.c, f.x + ox, f.y - lift + oy, f.scale * k, f.face, f.st.sleep || f.st.stone || f.st.hibernate ? 0 : f.moving ? t * 1.8 : t);
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
    }
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
    if (this.started && !this.over) this.drawReach(g);
    this.drawWallClocks(u);
    if (this.touch) {
      const s = this.moveStick;
      const bx = s.id >= 0 ? s.bx : s.hx;
      const by = s.id >= 0 ? s.by : s.hy;
      u.fillStyle(0x000000, 0.35).fillCircle(bx, by, 20);
      u.lineStyle(1, 0xffffff, 0.4).strokeCircle(bx, by, 20);
      u.fillStyle(0xffffff, 0.6).fillCircle(bx + s.dx, by + s.dy, 8);
    } else if (!this.over) {
      const p = this.input.activePointer;
      u.lineStyle(1, 0xffe060, 0.7).strokeCircle(p.x, p.y, 3);
    }
  }
}
