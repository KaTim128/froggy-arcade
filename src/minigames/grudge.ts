/**
 * GRUDGE.  PRD §9.8 — Hard, 5 tokens in, 10 out.
 *
 * An original 1v1 fighter (PRD MG-7 / VOC-22): original characters, original
 * art, original name.  Best of 3, 99s rounds, 100 HP.  A FROG against a
 * LIZARD, both of them up on two legs, because a fight between two coloured
 * rectangles is not a fight you can read.
 *
 * THE THREE ATTACKS LOOK LIKE THREE ATTACKS.  A HIGH strike is a straight arm
 * at head height with the shoulder turned into it; a LOW strike is a knee-high
 * sweep — low enough to go under a standing guard, but off the floor rather
 * than flat along it, so it reads as a leg coming at you and not as the
 * fighter lying down; the SPECIAL is a wound-up lunge with a ring of light
 * coming off it.  Each one is drawn through all three of its phases — the
 * wind-up, the active frame, the droop — and the fighter throwing it says so
 * in a word over their head, so what is coming at you is never a guess.
 *
 * AND THE SWEEP IS WHAT A JUMP IS FOR.  Every attack can be cleared by being
 * in the air, but the sweep is the one with room to spare: it wants only a
 * dozen pixels of daylight (`JUMP_CLEARANCE`), so an ordinary hop beats it,
 * while the higher strikes need most of the arc.  Low is answered by jumping,
 * high by blocking, and the special by not being there.
 *
 * Getting hit looks like getting hit: the fighter snaps backwards, whites out
 * for a moment, cannot act while they are reeling, and a burst goes off where
 * the blow landed.
 *
 * The special has a COOLDOWN and the cooldown is on the HUD: a bar under each
 * health bar that fills back up, and the word READY when it has.  Pressing it
 * early does nothing but buzz — it is not a silent failure.
 *
 * The AI runs a readable three-beat pattern — approach, low, high-high — with
 * a deliberate 0.6s opening after a whiffed sweep.  A player who learns the
 * pattern wins; a masher loses.  That is the whole design.
 */

import Phaser from 'phaser';
import { PALETTE, css } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';
import { silhouettes } from './decor';


const FLOOR_Y = 156;
const WALK_SPEED = 52;
const JUMP_V = -190;
const GRAVITY = 620;
const MAX_HP = 100;
const ROUND_MS = 99_000;
const ROUNDS_TO_WIN = 2;

interface MoveDef {
  dmg: number;
  startup: number;
  active: number;
  recovery: number;
  range: number;
}

// PRD §9.8 frame data, at 60fps.  `high` is the quick one at head height,
// `low` the slower sweep along the floor, `special` the one with the cooldown.
const MOVES: Record<'high' | 'low' | 'special', MoveDef> = {
  high: { dmg: 6, startup: 200, active: 66, recovery: 167, range: 28 },
  low: { dmg: 10, startup: 333, active: 100, recovery: 300, range: 36 },
  special: { dmg: 25, startup: 467, active: 133, recovery: 500, range: 46 },
};
/** What each one is called over the fighter's head. */
const MOVE_NAME: Record<'high' | 'low' | 'special', string> = {
  high: 'HIGH',
  low: 'LOW',
  special: 'SPECIAL',
};
const SPECIAL_COOLDOWN = 8000;
const BLOCK_MULT = 0.2;
/** How long a clean hit takes you out of the fight for, by move. */
const HITSTUN: Record<'high' | 'low' | 'special', number> = { high: 170, low: 230, special: 340 };
/**
 * How far off the floor you have to be for a blow to pass underneath, in
 * pixels.  A jump peaks 29px up (JUMP_V against GRAVITY) and lasts 0.61s, so
 * twelve is a wide door — roughly 0.47s of the arc clears the sweep — and
 * twenty is a narrow one.  That is the point: the sweep is the move you beat
 * by jumping, and the high strike is the move you beat by blocking.
 */
const JUMP_CLEARANCE: Record<'high' | 'low' | 'special', number> = { high: 20, low: 12, special: 20 };

/** Everything a fighter is drawn out of, so the poses can move real limbs. */
/**
 * ================= THE OTHER CORNER =================
 *
 * It used to be one lizard, every time.  Now it is somebody off a card of
 * fifteen, drawn fresh each time the cabinet is played -- ten regulars and
 * five rare ones that turn up about one fight in eight.
 *
 * NONE OF THEM IS A RECOLOURED FROG.  Each has its own silhouette -- a shell,
 * a horn, fins and spikes, eyestalks, a coil where the legs would be -- and
 * its own way of fighting, set by a handful of multipliers on the SAME moves
 * everybody uses.  Nothing here changes the rules of the fight: the same three
 * attacks, the same health, the same rounds, the same money.  What changes is
 * who you are learning to read.
 *
 * THE NUMBERS STAY CLOSE TO ONE.  The lizard is the baseline at exactly 1.0
 * across the board, and nobody strays more than about a third from it on any
 * axis -- enough that a tortoise and a gecko are plainly different fights,
 * not so much that either is a wall.  Where a fighter is strong it pays for
 * it somewhere else: the rhino hits hardest and is slowest to do it, the
 * gecko is the quickest and hits softest, the tortoise blocks everything and
 * barely walks.
 */
interface FoeDef {
  key: string;
  name: string;
  /** Turns up about one fight in eight, and says so. */
  rare: boolean;
  /** How often it is drawn, against the others. */
  weight: number;
  skin: number;
  skinLight: number;
  /** The head, where it is not the same as the light skin (a penguin's is black). */
  headCol?: number;
  glove: number;
  gloveLit: number;
  /** Body and head width, so a gorilla is not the shape of a gecko. */
  bodyW: number;
  bodyH: number;
  headW: number;
  /** Which silhouette to draw.  See `foeGear`. */
  look: string;

  // ---- HOW IT FIGHTS.  Every one of these multiplies something that already exists.
  /** Walking pace. */
  speed: number;
  /** Damage its blows do. */
  power: number;
  /** Wind-up, active and recovery time on every attack.  Above one is slower. */
  windup: number;
  /** How far its attacks reach. */
  reach: number;
  /** What gets through its block.  Below one is a better guard. */
  guard: number;
  /** How often it puts that guard up. */
  blockRate: number;
  /** The pauses in its pattern.  Below one is a busier fighter. */
  tempo: number;
  /** The chance a blow simply misses it.  Only the slippery ones have any. */
  dodge: number;
  /** What it reaches for when it attacks. */
  style: 'balanced' | 'highs' | 'lows' | 'specials';
  /** How far it wanders off its own pattern, 0 a machine and 1 anything goes. */
  chaos: number;
  /** After blocking one, the chance it hits straight back. */
  counter: number;
  /** The word over its corner, so the player knows what they have drawn. */
  note: string;
}

const FOES: FoeDef[] = [
  // ---- THE BASELINE.  Every other number on this card is read against these.
  { key: 'lizard', name: 'LIZARD', rare: false, weight: 10,
    skin: 0x8a9a3c, skinLight: 0xe0a44a, glove: 0x2f5fa8, gloveLit: 0x5b8fd6, bodyW: 14, bodyH: 18, headW: 12, look: 'lizard',
    speed: 1, power: 1, windup: 1, reach: 1, guard: 1, blockRate: 1, tempo: 1, dodge: 0, style: 'balanced', chaos: 0, counter: 0.35,
    note: 'AGILE COUNTERPUNCHER' },
  { key: 'fishy', name: 'MR FISHY', rare: false, weight: 10,
    skin: 0xe8b04a, skinLight: 0xfff0c9, glove: 0xc4342e, gloveLit: 0xe8635a, bodyW: 18, bodyH: 17, headW: 14, look: 'puffer',
    speed: 0.9, power: 1, windup: 1, reach: 0.95, guard: 0.5, blockRate: 1.35, tempo: 1.05, dodge: 0, style: 'balanced', chaos: 0.05, counter: 0.1,
    note: 'PUFFS UP WHEN HE BLOCKS' },
  { key: 'croc', name: 'CROC', rare: false, weight: 10,
    skin: 0x3f6e3a, skinLight: 0x9fbf6a, glove: 0x7a2a1e, gloveLit: 0xb04a3a, bodyW: 19, bodyH: 20, headW: 12, look: 'croc',
    speed: 0.8, power: 1.25, windup: 1.2, reach: 1.05, guard: 0.9, blockRate: 0.8, tempo: 1.15, dodge: 0, style: 'highs', chaos: 0.05, counter: 0.1,
    note: 'SLOW. EVERY PUNCH COUNTS' },
  { key: 'gecko', name: 'GECKO', rare: false, weight: 10,
    skin: 0x5fd0a0, skinLight: 0xc9f5de, glove: 0xf0c94c, gloveLit: 0xfff0a0, bodyW: 12, bodyH: 16, headW: 11, look: 'gecko',
    speed: 1.3, power: 0.8, windup: 0.8, reach: 0.9, guard: 1.1, blockRate: 0.8, tempo: 0.75, dodge: 0.08, style: 'highs', chaos: 0.1, counter: 0.15,
    note: 'FAST HANDS, LIGHT ONES' },
  { key: 'tortoise', name: 'TORTOISE', rare: false, weight: 10,
    skin: 0x7a8a4a, skinLight: 0xc9c99a, glove: 0x6a4a2a, gloveLit: 0x9a7040, bodyW: 16, bodyH: 17, headW: 10, look: 'shell',
    speed: 0.72, power: 1, windup: 1.1, reach: 0.95, guard: 0.35, blockRate: 1.7, tempo: 1.2, dodge: 0, style: 'balanced', chaos: 0, counter: 0.25,
    note: 'WILL NOT BE HIT' },
  { key: 'snake', name: 'SNAKE', rare: false, weight: 10,
    skin: 0x6a8a2a, skinLight: 0xd8d070, glove: 0x7a3aa8, gloveLit: 0xa870d8, bodyW: 11, bodyH: 20, headW: 11, look: 'snake',
    speed: 1.1, power: 0.9, windup: 0.95, reach: 1.1, guard: 1.1, blockRate: 0.7, tempo: 0.95, dodge: 0.22, style: 'lows', chaos: 0.15, counter: 0.2,
    note: 'NOT WHERE YOU SWUNG' },
  { key: 'rhino', name: 'RHINO', rare: false, weight: 10,
    skin: 0x8a8f96, skinLight: 0xb9bec4, glove: 0x2a2d3a, gloveLit: 0x4f5566, bodyW: 21, bodyH: 21, headW: 13, look: 'rhino',
    speed: 0.78, power: 1.3, windup: 1.25, reach: 1, guard: 0.85, blockRate: 0.7, tempo: 1.2, dodge: 0, style: 'specials', chaos: 0.05, counter: 0.05,
    note: 'HEAVYWEIGHT. TAKES HIS TIME' },
  { key: 'monkey', name: 'MONKEY', rare: false, weight: 10,
    skin: 0x8a5a34, skinLight: 0xe6c49a, glove: 0x2f8a3a, gloveLit: 0x5ac06a, bodyW: 14, bodyH: 17, headW: 13, look: 'monkey',
    speed: 1.2, power: 0.9, windup: 0.85, reach: 1, guard: 1.1, blockRate: 0.9, tempo: 0.85, dodge: 0.06, style: 'balanced', chaos: 0.7, counter: 0.2,
    note: 'NOBODY KNOWS WHAT IS NEXT' },
  { key: 'penguin', name: 'PENGUIN', rare: false, weight: 10,
    skin: 0x22252e, skinLight: 0xf4f4ee, headCol: 0x22252e, glove: 0xd84a3a, gloveLit: 0xff8a6a, bodyW: 15, bodyH: 19, headW: 12, look: 'penguin',
    speed: 1.05, power: 1.1, windup: 0.95, reach: 0.9, guard: 1, blockRate: 0.85, tempo: 0.8, dodge: 0, style: 'lows', chaos: 0.05, counter: 0.1,
    note: 'SMALL, AND WORKS THE BODY' },
  { key: 'crab', name: 'CRAB', rare: false, weight: 10,
    skin: 0xc8483a, skinLight: 0xf08a6a, glove: 0xa8302a, gloveLit: 0xe86a5a, bodyW: 22, bodyH: 14, headW: 12, look: 'crab',
    speed: 0.85, power: 1.05, windup: 1.05, reach: 1.25, guard: 0.8, blockRate: 1.1, tempo: 1.05, dodge: 0.04, style: 'highs', chaos: 0.1, counter: 0.15,
    note: 'SIDEWAYS, AND WIDE HOOKS' },

  // ---- THE RARE ONES.  A little better than the regulars on balance, and
  // never by enough to be unfair: a rare draw is a story, not a wall.
  { key: 'shark', name: 'SHARK', rare: true, weight: 2.8,
    skin: 0x5a7a96, skinLight: 0xe6eef4, glove: 0x14161e, gloveLit: 0x3a3f4e, bodyW: 18, bodyH: 20, headW: 14, look: 'shark',
    speed: 1.1, power: 1.25, windup: 0.95, reach: 1.05, guard: 1, blockRate: 0.9, tempo: 0.85, dodge: 0.05, style: 'specials', chaos: 0.1, counter: 0.2,
    note: 'SMELLS WEAKNESS' },
  { key: 'gorilla', name: 'GORILLA', rare: true, weight: 2.8,
    skin: 0x2e2a2a, skinLight: 0x6a5e58, glove: 0xc4342e, gloveLit: 0xe8635a, bodyW: 23, bodyH: 22, headW: 13, look: 'gorilla',
    speed: 0.9, power: 1.35, windup: 1.15, reach: 1.1, guard: 0.7, blockRate: 1, tempo: 1, dodge: 0, style: 'highs', chaos: 0.1, counter: 0.15,
    note: 'THE STRONGEST THING HERE' },
  { key: 'chameleon', name: 'CHAMELEON', rare: true, weight: 2.8,
    skin: 0x4fa86a, skinLight: 0xb8e6a0, glove: 0xd08cf0, gloveLit: 0xf0c0ff, bodyW: 13, bodyH: 17, headW: 12, look: 'chameleon',
    speed: 1.05, power: 0.95, windup: 0.95, reach: 1.15, guard: 1, blockRate: 0.9, tempo: 1, dodge: 0.18, style: 'balanced', chaos: 0.4, counter: 0.4,
    note: 'HARD TO PIN DOWN' },
  { key: 'komodo', name: 'KOMODO DRAGON', rare: true, weight: 2.8,
    skin: 0x5a5236, skinLight: 0xa8986a, glove: 0x8a2a2a, gloveLit: 0xc05050, bodyW: 18, bodyH: 20, headW: 12, look: 'komodo',
    speed: 0.95, power: 1.2, windup: 1.05, reach: 1.1, guard: 0.85, blockRate: 1, tempo: 1, dodge: 0, style: 'lows', chaos: 0.1, counter: 0.3,
    note: 'PATIENT, AND VENOMOUS' },
  { key: 'gator', name: 'ALLIGATOR', rare: true, weight: 2.8,
    skin: 0x2f3a2a, skinLight: 0x6a7a4a, glove: 0x4a2a6a, gloveLit: 0x7a5a9a, bodyW: 21, bodyH: 21, headW: 13, look: 'gator',
    speed: 0.85, power: 1.3, windup: 1.2, reach: 1.1, guard: 0.75, blockRate: 0.9, tempo: 1.1, dodge: 0, style: 'lows', chaos: 0.05, counter: 0.15,
    note: 'THE BIG ONE FROM THE SWAMP' },
];

/** One off the card, weighted, so the rare ones stay rare. */
function pickFoe(): FoeDef {
  const total = FOES.reduce((a, f) => a + f.weight, 0);
  let roll = Math.random() * total;
  for (const f of FOES) {
    roll -= f.weight;
    if (roll <= 0) return f;
  }
  return FOES[0];
}

interface Art {
  root: Phaser.GameObjects.Container;
  legL: Phaser.GameObjects.Rectangle;
  legR: Phaser.GameObjects.Rectangle;
  torso: Phaser.GameObjects.Ellipse;
  belly: Phaser.GameObjects.Ellipse;
  head: Phaser.GameObjects.Ellipse;
  snout: Phaser.GameObjects.Ellipse;
  eyeL: Phaser.GameObjects.Arc;
  eyeR: Phaser.GameObjects.Arc;
  pupL: Phaser.GameObjects.Arc;
  pupR: Phaser.GameObjects.Arc;
  /** The lizard's crest.  The frog has an invisible one, to keep this simple. */
  crest: Phaser.GameObjects.GameObject & { setPosition(x: number, y: number): unknown };
  arm: Phaser.GameObjects.Rectangle;
  /** The glove, and the three pieces that make it look like one. */
  fist: Phaser.GameObjects.Ellipse;
  cuff: Phaser.GameObjects.Rectangle;
  knuckle: Phaser.GameObjects.Ellipse;
  thumb: Phaser.GameObjects.Ellipse;
  shin: Phaser.GameObjects.Rectangle;
  aura: Phaser.GameObjects.Arc;
  /** The word over their head while a move is wound up or thrown. */
  call: Phaser.GameObjects.BitmapText;
  skin: number;
  skinLight: number;
  /** The head's own colour, which is not always the light skin. */
  headCol: number;
  /**
   * WHAT MAKES THIS FIGHTER THIS FIGHTER, riding the parts it belongs to.
   *
   * `render` repositions the head and torso every frame, so anything drawn on
   * them at build time would be left behind the first time the fighter
   * crouched.  These three groups are moved WITH the part they sit on.
   */
  headGear: Phaser.GameObjects.Container;
  bodyGear: Phaser.GameObjects.Container;
  backGear: Phaser.GameObjects.Container;
  /** Mr Fishy's spikes, which stand up when he blocks. */
  puff: Phaser.GameObjects.Container | null;
  /** Where the snout and eyes sit on this head. */
  snoutX: number;
  eyeX: [number, number];
  /** Eyes above the head's centre: -4 on a face, -11 up on a crab's stalks. */
  eyeY: number;
  /** The tail on its hinge at the hips, and whether it lies on the boards. */
  tail: Phaser.GameObjects.Container | null;
  tailRoot: [number, number];
  drags: boolean;
  /** A chameleon changes colour. */
  cycle: boolean;
}

interface Fighter {
  x: number;
  y: number;
  vy: number;
  hp: number;
  facing: 1 | -1;
  crouch: boolean;
  blocking: boolean;
  move: keyof typeof MOVES | null;
  phase: 'startup' | 'active' | 'recovery' | null;
  timer: number;
  hitLanded: boolean;
  specialCd: number;
  /** ms of being knocked about: no input, no AI, and it shows. */
  stun: number;
  /** Which way the last blow threw them, for the recoil. */
  recoil: number;
  /** Walk cycle phase, so the legs move when the fighter does. */
  step: number;
  art: Art;
  /** Who this is, if it is not Froggy. */
  foe: FoeDef | null;
}

let p1: Fighter | null = null;
let p2: Fighter | null = null;
let hpBar1: Phaser.GameObjects.Rectangle | null = null;
let hpBar2: Phaser.GameObjects.Rectangle | null = null;
let roundText: Phaser.GameObjects.BitmapText | null = null;
let timerText: Phaser.GameObjects.BitmapText | null = null;
let announce: Phaser.GameObjects.BitmapText | null = null;
let cd1: Phaser.GameObjects.Rectangle | null = null;
let cd2: Phaser.GameObjects.Rectangle | null = null;
let cd1Label: Phaser.GameObjects.BitmapText | null = null;
let wins1 = 0;
let wins2 = 0;
let roundMs = ROUND_MS;
let roundOver = true;
let over = false;
let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;
let keys: Record<string, Phaser.Input.Keyboard.Key> = {};

// AI state
let aiTimer = 0;
let aiBeat = 0;
let aiWhiffOpening = 0;
let aiSway = 0;
/** ms until a counterpunch goes out, after the opponent blocked one. */
let aiCounter = 0;
/** The name over their health bar, for the opponent drawn this time. */
let foeLabel: Phaser.GameObjects.BitmapText | null = null;
/** Who they are and what they do, under READY on the first round. */
let introName: Phaser.GameObjects.BitmapText | null = null;
let introNote: Phaser.GameObjects.BitmapText | null = null;
/** Seconds since the scene opened, for the idle breathing. */
let sceneClock = 0;
/** DEV only: hold the lizard still, so a test can aim at something. */
let aiFrozen = false;
/** Dev only: hold the lizard this many pixels off the floor, for jump tests. */
let aiHover: number | null = null;
/** Debounce on the "not ready" buzz, so a held key does not machine-gun it. */
let notReadyT = 0;

export const grudge: MinigameModule = {
  id: 'grudge',
  title: 'GRUDGE',
  music: 'game_grudge',
  rules: 'best of 3',
  tutorial: {
    objective: [
      'BEST OF THREE ROUNDS.',
      'A DIFFERENT OPPONENT EVERY TIME.',
      'HIGH BEATS ONE THAT IS STANDING.',
      'LOW SWEEPS ONE THAT IS CROUCHING.',
      'THE SPECIAL HURTS - AND HAS A COOLDOWN.',
    ],
    controls: [
      ['A / D', 'WALK'],
      ['W / S', 'JUMP AND CROUCH'],
      ['J', 'HIGH STRIKE'],
      ['K', 'LOW SWEEP'],
      ['L', 'BLOCK'],
      ['I', 'SPECIAL'],
    ],
  },
  touch: {
    stick: 'wasd',
    buttons: [
      { label: 'HIGH', key: 'J', primary: true },
      { label: 'LOW', key: 'K' },
      { label: 'SPCL', key: 'I' },
      { label: 'BLOCK', key: 'L' },
    ],
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    sceneRef = scene;
    wins1 = 0;
    wins2 = 0;
    over = false;

    // A hall: dark walls, a spotlight on the boards, and a crowd in the dark
    // at the back with the ropes in front of them.
    scene.add.rectangle(0, 18, GAME_W, 162, PALETTE.plum).setOrigin(0, 0);
    scene.add.rectangle(0, 18, GAME_W, 162, 0x1a1030).setOrigin(0, 0).setAlpha(0.6);
    scene.add.ellipse(GAME_W / 2, FLOOR_Y + 4, 260, 60, 0xfff0c9).setAlpha(0.06);
    scene.add.ellipse(GAME_W / 2, FLOOR_Y + 4, 160, 30, 0xfff0c9).setAlpha(0.06);
    silhouettes(scene, 108, 26, 0x0e0818, 0.9);
    for (const y of [116, 124, 132]) scene.add.rectangle(0, y, GAME_W, 1, PALETTE.blood).setOrigin(0, 0).setAlpha(0.7);
    for (const x of [24, GAME_W - 24]) scene.add.rectangle(x, 112, 3, 26, PALETTE.bone).setOrigin(0.5, 0);
    scene.add.rectangle(0, FLOOR_Y, GAME_W, 24, PALETTE.brown).setOrigin(0, 0);
    scene.add.rectangle(0, FLOOR_Y, GAME_W, 2, PALETTE.brownLight).setOrigin(0, 0);
    for (let x = 0; x < GAME_W; x += 20) scene.add.rectangle(x, FLOOR_Y + 2, 1, 22, 0x5a3e26).setOrigin(0, 0);
    // crowd silhouettes
    for (let i = 0; i < 14; i++) {
      scene.add.circle(12 + i * 22, 150, 6, PALETTE.ink).setAlpha(0.7);
    }

    p1 = makeFighter(scene, 90, 'frog', 1);
    p2 = makeFighter(scene, 230, chooseFoe(), -1);

    scene.add.rectangle(8, 26, 130, 7, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
    hpBar1 = scene.add.rectangle(9, 27, 128, 5, PALETTE.tealLight).setOrigin(0, 0);
    scene.add.rectangle(GAME_W - 138, 26, 130, 7, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
    hpBar2 = scene.add.rectangle(GAME_W - 137, 27, 128, 5, PALETTE.blood).setOrigin(0, 0);

    text(scene, 8, 36, 'FROG', PALETTE.mossLight);
    foeLabel = text(scene, GAME_W - 8, 36, '', PALETTE.amber).setOrigin(1, 0);
    nameFoe();

    // ---- the special's cooldown, under each health bar.  A move on a timer
    // that the player cannot see is a move they press at random.
    scene.add.rectangle(8, 44, 64, 5, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
    cd1 = scene.add.rectangle(9, 45, 62, 3, PALETTE.ember).setOrigin(0, 0);
    cd1Label = text(scene, 76, 44, '', PALETTE.ember);
    scene.add.rectangle(GAME_W - 72, 44, 64, 5, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
    cd2 = scene.add.rectangle(GAME_W - 71, 45, 62, 3, PALETTE.ember).setOrigin(0, 0);
    // The clock is short enough to sit in the 45px gap between the HP bars; the
    // round line is not, and used to be drawn straight through both of them.
    timerText = centerText(scene, GAME_W / 2, 30, '', PALETTE.cream);
    roundText = centerText(scene, GAME_W / 2, 56, '', PALETTE.gold);
    announce = centerText(scene, GAME_W / 2, 90, '', PALETTE.gold, 16);
    introName = centerText(scene, GAME_W / 2, 106, '', PALETTE.cream);
    introNote = centerText(scene, GAME_W / 2, 116, '', PALETTE.amber);

    const kb = scene.input.keyboard;
    if (kb) {
      keys = {
        left: kb.addKey('A'),
        right: kb.addKey('D'),
        jump: kb.addKey('W'),
        crouch: kb.addKey('S'),
        high: kb.addKey('J'),
        low: kb.addKey('K'),
        block: kb.addKey('L'),
        special: kb.addKey('I'),
      };
    }

    startRound();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__grudge = {
        state: () => ({
          round: wins1 + wins2 + 1,
          wins: { you: wins1, him: wins2 },
          roundOver,
          over,
          you: p1 && { hp: Math.round(p1.hp), cd: Math.round(Math.max(0, p1.specialCd)), move: p1.move, phase: p1.phase, stun: Math.round(Math.max(0, p1.stun)) },
          him: p2 && { hp: Math.round(p2.hp), cd: Math.round(Math.max(0, p2.specialCd)), move: p2.move, phase: p2.phase, stun: Math.round(Math.max(0, p2.stun)) },
          cooldownMs: SPECIAL_COOLDOWN,
          foe: p2?.foe?.key,
        }),
        /** Every opponent on the card, rare ones included. */
        foes: () => FOES.map((f) => ({ key: f.key, name: f.name, rare: f.rare, weight: f.weight })),
        /** The one standing across the ring, with every number it fights by. */
        foe: () => p2?.foe ?? null,
        /** Swap the opponent for a named one, rebuilt in place. */
        setFoe: (key: string) => {
          const def = FOES.find((f) => f.key === key);
          if (!def || !p2) return false;
          const was = p2;
          was.art.root.destroy();
          p2 = makeFighter(scene, was.x, def, -1);
          p2.hp = was.hp;
          aiCounter = 0;
          nameFoe();
          return true;
        },
        /**
         * Hold the opponent in one pose, for looking at: a move and its phase,
         * crouched, blocking or reeling.  Freezes the AI and the move clock.
         */
        pose: (o: { move?: 'high' | 'low' | 'special' | null; phase?: 'startup' | 'active' | 'recovery' | null; crouch?: boolean; blocking?: boolean; stun?: number }) => {
          if (!p2) return;
          aiFrozen = true;
          p2.move = o.move ?? null;
          p2.phase = o.move ? (o.phase ?? 'active') : null;
          p2.timer = 1e9;
          p2.hitLanded = true;
          p2.crouch = o.crouch ?? false;
          p2.blocking = o.blocking ?? false;
          p2.stun = o.stun ?? 0;
          p2.recoil = o.stun ? -1 : 0;
        },
        /** How often each one comes up, over n draws of the real roll. */
        draws: (n: number) => {
          const tally: Record<string, number> = {};
          for (let i = 0; i < n; i++) {
            const k = pickFoe().key;
            tally[k] = (tally[k] ?? 0) + 1;
          }
          return tally;
        },
        /** Try a move the way the keyboard would: refused exactly as it would be. */
        press: (move: 'high' | 'low' | 'special') => {
          if (!p1 || p1.stun > 0 || p1.move) return false;
          if (move === 'special' && p1.specialCd > 0) {
            notReady();
            return false;
          }
          startMove(p1, move);
          return true;
        },
        /** Put the two of them where a test needs them. */
        place: (mine: number, theirs: number) => {
          if (p1) p1.x = mine;
          if (p2) p2.x = theirs;
        },
        /**
         * Hang the lizard a fixed height off the floor, as if caught mid-jump,
         * so a sweep can be tested against an airborne target without having to
         * land a move inside the 0.6s an actual jump lasts.  null drops him.
         */
        hoist: (h: number | null) => {
          aiHover = h;
          if (p2 && h !== null) {
            p2.y = FLOOR_Y - h;
            p2.vy = 0;
          }
        },
        /** Hold the lizard still, so what is under test is the move. */
        freeze: (on: boolean) => {
          aiFrozen = on;
          aiCounter = 0;
          if (p2 && on) {
            p2.move = null;
            p2.phase = null;
            p2.blocking = false;
          }
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__grudge;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over || !p1 || !p2) return;
    const dt = delta / 1000;

    if (roundOver) return;

    roundMs -= delta;
    timerText?.setText(`${Math.ceil(roundMs / 1000)}`);
    if (roundMs <= 0) {
      endRound(p1.hp >= p2.hp);
      return;
    }

    sceneClock += dt;
    if (notReadyT > 0) notReadyT -= delta;

    handleInput(dt);
    runAi(delta, dt);
    tickFighter(p1, delta, dt);
    tickFighter(p2, delta, dt);

    p1.facing = p1.x < p2.x ? 1 : -1;
    p2.facing = p2.x < p1.x ? 1 : -1;

    render(p1, dt);
    render(p2, dt);
    renderCooldowns();
    hpBar1?.setSize((Math.max(0, p1.hp) / MAX_HP) * 128, 5);
    hpBar2?.setSize((Math.max(0, p2.hp) / MAX_HP) * 128, 5);

    if (p1.hp <= 0 || p2.hp <= 0) endRound(p2.hp <= 0);
  },

  destroy() {
    sceneClock = 0;
    aiFrozen = false;
    aiHover = null;
    notReadyT = 0;
    cd1 = null;
    cd2 = null;
    cd1Label = null;
    p1 = null;
    p2 = null;
    apiRef = null;
    sceneRef = null;
  },
};

/** A colour pushed toward black, for rims and shadows on a fighter's own skin. */
function shade(c: number, k: number): number {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  return (Math.round(r * (1 - k)) << 16) | (Math.round(g * (1 - k)) << 8) | Math.round(b * (1 - k));
}

/**
 * WHAT MAKES EACH FIGHTER READ AS ITSELF.
 *
 * Built relative to the part it sits on: `head` pieces around the head's
 * centre, `body` pieces around the torso's, `back` pieces behind the torso.
 * Everything is drawn facing right; the fighter's container is mirrored for
 * whichever way it is actually looking, so none of this has to know.
 *
 * The test for every look is the silhouette alone, at the size it is drawn:
 * if you covered the colours, would you still know it was a crab?
 */
function foeGear(scene: Phaser.Scene, d: FoeDef): {
  head: Phaser.GameObjects.GameObject[];
  body: Phaser.GameObjects.GameObject[];
  back: Phaser.GameObjects.GameObject[];
  root: Phaser.GameObjects.GameObject[];
  puff: Phaser.GameObjects.GameObject[];
  tail: Phaser.GameObjects.GameObject[];
  tailRoot: [number, number];
  drags: boolean;
} {
  const head: Phaser.GameObjects.GameObject[] = [];
  const body: Phaser.GameObjects.GameObject[] = [];
  const back: Phaser.GameObjects.GameObject[] = [];
  const root: Phaser.GameObjects.GameObject[] = [];
  const puff: Phaser.GameObjects.GameObject[] = [];
  // The tail is its own group, hinged at the hips: it lifts when the body
  // drops into a crouch instead of being pushed through the floor, and it
  // sways a little, which is what shows it is attached rather than painted.
  const tailParts: Phaser.GameObjects.GameObject[] = [];
  let drags = false;
  const dark = shade(d.skin, 0.35);
  const E = (x: number, y: number, w: number, h: number, c: number) => scene.add.ellipse(x, y, w, h, c);
  const R = (x: number, y: number, w: number, h: number, c: number, a = 0) => scene.add.rectangle(x, y, w, h, c).setAngle(a);
  // ---- A TRIANGLE WHERE IT WAS ASKED FOR.
  //
  // `scene.add.triangle` does not draw its three points at (x, y) plus the
  // point: it centres the triangle's bounding box on (x, y), so any point
  // given above or left of zero moves the whole shape off by that much.  A
  // rhino's horn written to sit on its snout was drawn hovering over its
  // head.  Graphics draws the exact coordinates, which is what every one of
  // these was written against.
  const T = (x: number, y: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: number) =>
    scene.add.graphics().fillStyle(c, 1).fillTriangle(x + ax, y + ay, x + bx, y + by, x + cx, y + cy);
  const teeth = (x0: number, y: number, n: number) => {
    for (let i = 0; i < n; i++) head.push(T(x0 + i * 2.4, y, 0, 0, 1.2, 1.8, 2.4, 0, 0xf4f4ee));
  };

  // ---- TAILS AND FINS, as smooth tapered limbs rather than triangles.
  // Every one starts INSIDE the torso, behind it in the draw order, so where
  // the tail meets the body there is no seam and no gap -- it grows out of the
  // hips.  And every one rides `back`, which follows the torso every frame, so
  // it goes wherever the body goes: crouch, breathe, recoil, scuttle.
  type Pt = [number, number];
  const bw = d.bodyW / 2;
  const bh = d.bodyH / 2;
  /** Points along a cubic curve. */
  const bez = (a: Pt, b: Pt, c: Pt, e: Pt, n = 14): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      out.push([
        u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * e[0],
        u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * e[1],
      ]);
    }
    return out;
  };
  /**
   * Carry a path on into a curl that keeps its heading and tightens as it
   * goes: a monkey's tail, a chameleon's.  `dir` is which way it winds.
   */
  const curl = (pts: Pt[], r: number, turns: number, dir: 1 | -1): Pt[] => {
    const [x1, y1] = pts[pts.length - 1];
    const [x0, y0] = pts[pts.length - 2];
    const head = Math.atan2(y1 - y0, x1 - x0);
    const cx = x1 + Math.cos(head + dir * Math.PI / 2) * r;
    const cy = y1 + Math.sin(head + dir * Math.PI / 2) * r;
    const a0 = Math.atan2(y1 - cy, x1 - cx);
    const n = Math.ceil(turns * 16);
    const out = pts.slice();
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const a = a0 + dir * t * turns * Math.PI * 2;
      const rr = r * (1 - t * 0.6);
      out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return out;
  };
  /** Fill a path as one smooth outline, `w0` wide at the root and `w1` at the tip. */
  const tube = (pts: Pt[], w0: number, w1: number, c: number): Phaser.GameObjects.Graphics => {
    const left: Phaser.Math.Vector2[] = [];
    const right: Phaser.Math.Vector2[] = [];
    const last = pts.length - 1;
    for (let i = 0; i <= last; i++) {
      const [px, py] = pts[Math.max(0, i - 1)];
      const [nx, ny] = pts[Math.min(last, i + 1)];
      const len = Math.hypot(nx - px, ny - py) || 1;
      const t = i / last;
      // tapers quickly at first and slowly at the end, the way a tail does
      const w = (w1 + (w0 - w1) * Math.pow(1 - t, 0.85)) / 2;
      const ox = (-(ny - py) / len) * w;
      const oy = ((nx - px) / len) * w;
      left.push(new Phaser.Math.Vector2(pts[i][0] + ox, pts[i][1] + oy));
      right.push(new Phaser.Math.Vector2(pts[i][0] - ox, pts[i][1] - oy));
    }
    const g = scene.add.graphics();
    g.fillStyle(c, 1);
    g.fillPoints([...left, ...right.reverse()], true, true);
    // round the root into the body and round off the tip
    g.fillCircle(pts[0][0], pts[0][1], w0 / 2);
    g.fillCircle(pts[last][0], pts[last][1], w1 / 2);
    return g;
  };
  /** Marks along the top of a tail -- scutes on a croc, bands on a gecko. */
  const along = (pts: Pt[], every: number, w: number, h: number, c: number, lift: number, alpha = 0.7) => {
    for (let i = every; i < pts.length - 2; i += every) {
      const [x, y] = pts[i];
      tailParts.push(E(x, y - lift * (1 - i / pts.length), w, h, c).setAlpha(alpha));
    }
  };
  /** The standard reptile tail: out of the hips, down, and a lift at the tip. */
  const tail = (len: number, w0: number, drop: number, lift: number): Pt[] => {
    const root: Pt = [-bw + 3, bh - 5];
    const path = bez(root, [root[0] - len * 0.3, root[1] + drop * 0.8], [root[0] - len * 0.72, root[1] + drop], [root[0] - len, root[1] + drop - lift]);
    tailParts.push(tube(path, w0, 1.2, d.skin));
    return path;
  };

  switch (d.look) {
    case 'lizard': {
      const path = tail(17, 7, 7, 5);
      tailParts.push(tube(path.slice(2), 3, 0.6, d.skinLight).setAlpha(0.35));
      break;
    }
    case 'puffer':
      // ---- MR FISHY.  Round, finned, and spiked -- and the spikes are what
      // stand up when he blocks, so they live in their own group.
      // a stubby tail and a fan of a fin on the end of it, and a soft dorsal
      {
        const x0 = -bw + 2;
        tailParts.push(tube(bez([x0 + 3, 1], [x0 - 1, 1], [x0 - 3, 0.5], [x0 - 5, 0.5], 6), 7, 4, d.skin));
        tailParts.push(tube(bez([x0 - 4, 0.5], [x0 - 6, -1], [x0 - 8, -3], [x0 - 9, -5.5], 8), 4, 1.4, shade(d.skin, 0.1)));
        tailParts.push(tube(bez([x0 - 4, 0.5], [x0 - 6, 2], [x0 - 8, 4], [x0 - 9, 6.5], 8), 4, 1.4, shade(d.skin, 0.1)));
        back.push(tube(bez([2, -bh + 3], [1, -bh - 1], [-1, -bh - 3], [-4, -bh - 3.5], 8), 6, 1.2, shade(d.skin, 0.15)));
      }
      body.push(E(0, 1, d.bodyW - 4, d.bodyH - 6, shade(d.skinLight, 0.04)).setAlpha(0.6));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const rx = Math.cos(a) * (d.bodyW / 2 + 1);
        const ry = Math.sin(a) * (d.bodyH / 2 + 1);
        puff.push(T(rx, ry, 0, -1.4, 0, 1.4, Math.cos(a) * 4, Math.sin(a) * 4, 0x9a6a2a));
      }
      head.push(E(6.5, 3, 4, 3, 0xe8637a));
      for (const [sx, sy] of [[-3, 2], [2, 4], [-5, -2], [4, -1]] as const) body.push(E(sx, sy, 2.2, 2.2, 0xa8742e).setAlpha(0.7));
      break;
    case 'croc':
    case 'gator':
    case 'komodo': {
      // ---- THE LONG-SNOUTED ONES.  What separates the three is the snout:
      // a croc's is long and narrow, a gator's short and broad, a komodo's a
      // lizard's with a forked tongue out of it.
      const gator = d.look === 'gator';
      const komodo = d.look === 'komodo';
      const len = gator ? 12 : komodo ? 11 : 16;
      const hgt = gator ? 7 : komodo ? 5 : 5;
      head.push(E(4 + len / 2, 2, len, hgt, d.skinLight));
      head.push(E(4 + len / 2, 3.2, len - 1, hgt * 0.45, shade(d.skinLight, 0.15)));
      head.push(E(3 + len, 0.4, 1.4, 1.2, dark));
      if (!komodo) teeth(5, 4.2, Math.floor(len / 2.6));
      else {
        // out of the mouth, not beside it: the tongue starts two pixels inside
        // the snout and the two prongs grow straight off its tip
        const tip = 4 + len + 4;
        head.push(R(tip - 3, 3, 6, 1.2, 0xf0c94c));
        head.push(R(tip + 1, 2.3, 2.6, 0.9, 0xf0c94c, -32), R(tip + 1, 3.7, 2.6, 0.9, 0xf0c94c, 32));
      }
      // A heavy tail that drags on the boards behind them -- the floor is
      // 18px below the torso's centre -- with the scutes carried down it.
      const drag = 18 - (bh - 5) - 1.5;
      const path = tail(komodo ? 24 : gator ? 21 : 20, gator ? 11 : komodo ? 8 : 9.5, drag, 0);
      drags = true;
      along(path, 2, 2.2, 1.6, dark, gator ? 3.6 : 3);
      // the ridge down the back, as a row of rounded scutes
      for (let i = 0; i < 5; i++) back.push(E(-5 + i * 2.6, -bh + 1, 2.4, 2, dark));
      if (komodo) for (const [x, y] of [[-3, -3], [2, 1], [-2, 5], [3, -5]] as const) body.push(E(x, y, 2, 2, dark).setAlpha(0.6));
      break;
    }
    case 'gecko':
      // big round eyes are done by the eye size below; toe pads and a thin tail
      {
        const root: Pt = [-bw + 3, bh - 4];
        const path = bez(root, [root[0] - 5, root[1] + 4], [root[0] - 11, root[1] + 3], [root[0] - 13, root[1] - 3]);
        tailParts.push(tube(curl(path, 2.4, 0.7, 1), 5, 1, d.skin));
        along(path, 3, 2.2, 1.2, 0xf0c94c, 1.2, 0.6);
      }
      root.push(E(-7, -1, 4, 2.4, d.skinLight), E(-3, -1, 4, 2.4, d.skinLight));
      root.push(E(3, -1, 4, 2.4, d.skinLight), E(7, -1, 4, 2.4, d.skinLight));
      for (const [x, y] of [[-2, -4], [2, 2], [-3, 4]] as const) body.push(E(x, y, 2.6, 2, 0xf0c94c).setAlpha(0.8));
      break;
    case 'shell': {
      // ---- THE TORTOISE.  The shell is the silhouette: a dome over the back,
      // bigger than the fighter under it, with the plates picked out.
      const sw = d.bodyW + 9;
      const sh = d.bodyH + 5;
      back.push(E(-4, -2, sw + 2, sh + 2, shade(d.skin, 0.55)));
      back.push(E(-4, -2, sw, sh, 0x6a5a34));
      back.push(E(-5, -4, sw - 7, sh - 7, 0x8a7444));
      for (const [x, y] of [[-8, -5], [-2, -7], [-9, 2], [-2, 1], [-5, -1]] as const) back.push(E(x, y, 4.4, 3.8, 0x5a4a28).setAlpha(0.8));
      head.push(R(-1, 3, 5, 0.8, dark).setAlpha(0.6), R(0, 5, 4, 0.8, dark).setAlpha(0.6));
      break;
    }
    case 'snake':
      // ---- NO LEGS.  A coil where they would be, and it moves on that.
      root.push(E(0, -2, 20, 6, d.skin), E(-1, -5, 17, 5, shade(d.skin, 0.12)), E(1, -8, 13, 4, d.skin));
      root.push(E(0, -2, 17, 2.4, d.skinLight).setAlpha(0.5));
      for (let i = 0; i < 4; i++) body.push(R(0, -6 + i * 4, 3, 3, dark, 45).setAlpha(0.7));
      head.push(R(9, 3, 5, 0.8, 0xd83a4a), T(12, 3, 0, 0, 2.6, -1.4, 2.6, 1.4, 0xd83a4a));
      break;
    case 'rhino':
      head.push(T(8, -4, 0, 4, 3, -5, 6, 4, 0xe6dcc0));
      head.push(T(4, -5, 0, 3, 1.6, -2, 3.2, 3, 0xe6dcc0));
      head.push(E(-4, -6, 3, 4.4, d.skin), E(-4, -6, 1.6, 2.4, 0xd88a8a));
      head.push(R(1, -4.5, 7, 1.4, dark).setAlpha(0.8));
      for (let i = 0; i < 3; i++) body.push(R(-3, -5 + i * 4, 8, 0.8, dark).setAlpha(0.5));
      break;
    case 'monkey':
      head.push(E(-5, 0, 5, 5, d.skin), E(-5, 0, 3, 3, d.skinLight));
      head.push(E(3, 2, 8, 7, d.skinLight));
      head.push(E(5, 3.4, 1.2, 1, dark), E(3, 3.4, 1.2, 1, dark));
      // a long tail out of the base of the back, up behind him, and curled
      {
        const root: Pt = [-bw + 3, bh - 4];
        const path = bez(root, [root[0] - 9, root[1] + 4], [root[0] - 14, root[1] - 6], [root[0] - 10, root[1] - 14]);
        tailParts.push(tube(curl(path, 2.6, 0.8, 1), 3.4, 1.4, shade(d.skin, 0.08)));
      }
      break;
    case 'penguin':
      head.push(T(8, 1, 0, -1.6, 5, 0.4, 0, 2.2, 0xf0a030));
      head.push(E(1, -1, 5, 4, 0xf4f4ee));
      body.push(E(2, 1, d.bodyW - 5, d.bodyH - 3, 0xf4f4ee));
      root.push(E(-4, -0.5, 6, 2.4, 0xf0a030), E(4, -0.5, 6, 2.4, 0xf0a030));
      break;
    case 'crab':
      // ---- EYES ON STALKS, AND A LOT OF LEGS.  At this size the stalks are
      // the whole of what says crab rather than a red blob with gloves on.
      // Two stalks from inside the top of the head up to where the eyes sit:
      // the fighter's own eyes are moved up onto them (see `eyeY`).
      head.push(R(-3, -6.5, 2, 8, d.skin), R(3, -6.5, 2, 8, d.skin));
      // And the side legs, each one out of the shell rather than beside it:
      // up and out to a knee, then down towards the boards.
      for (let i = 0; i < 3; i++) {
        const y0 = -1 + i * 2.6;
        for (const side of [-1, 1]) {
          const x0 = side * (bw - 3);
          back.push(tube(bez([x0, y0], [x0 + side * 5, y0 - 3], [x0 + side * 8, y0 + 1], [x0 + side * (8.5 + i), y0 + 8 - i], 8), 2.2, 1, dark));
        }
      }
      body.push(E(0, -2, d.bodyW - 6, 4, shade(d.skinLight, 0.05)).setAlpha(0.7));
      break;
    case 'shark':
      // The dorsal fin sweeps back off the shoulders, and the tail narrows to
      // a wrist before the two lobes of the fin -- the top one the longer.
      back.push(tube(bez([3, -bh + 3], [2, -bh - 2], [-1, -bh - 6], [-5, -bh - 7.5], 10), 8, 0.8, d.skin));
      {
        const root: Pt = [-bw + 3, 2];
        const wrist: Pt = [-bw - 7, 0.5];
        tailParts.push(tube(bez(root, [root[0] - 3, 2], [wrist[0] + 3, 1], wrist, 8), 8, 3.4, d.skin));
        tailParts.push(tube(bez(wrist, [wrist[0] - 2, -2], [wrist[0] - 4, -6], [wrist[0] - 6, -10], 10), 4.4, 0.8, d.skin));
        tailParts.push(tube(bez(wrist, [wrist[0] - 2, 2], [wrist[0] - 3, 4], [wrist[0] - 5, 6.5], 8), 3.6, 0.8, d.skin));
      }
      head.push(R(4, 3.4, 8, 1.4, 0x14161e));
      teeth(1, 3, 4);
      for (let i = 0; i < 3; i++) head.push(R(-3 + i * 1.6, 1, 0.8, 4, dark).setAlpha(0.7));
      body.push(E(2, 2, d.bodyW - 6, d.bodyH - 6, d.skinLight).setAlpha(0.85));
      break;
    case 'gorilla':
      // ---- SHOULDERS.  A gorilla is a triangle standing on its point.
      back.push(E(0, -6, d.bodyW + 10, 13, d.skin));
      head.push(R(2, -3, 11, 2.4, shade(d.skin, 0.3)));
      head.push(E(4, 2.4, 9, 7, d.skinLight));
      head.push(E(6, 2, 1.4, 1.2, 0x14161e), E(4, 2, 1.4, 1.2, 0x14161e));
      body.push(E(1, 2, d.bodyW - 8, d.bodyH - 8, d.skinLight).setAlpha(0.8));
      break;
    case 'chameleon':
      head.push(T(-2, -6, 0, 5, 5, -3, 8, 5, d.skin));
      head.push(scene.add.circle(3, -2, 4, d.skin).setStrokeStyle(1, dark));
      // the tail hangs, and rolls itself up into a tight spiral
      {
        const root: Pt = [-bw + 3, bh - 4];
        const path = bez(root, [root[0] - 5, root[1] + 3], [root[0] - 10, root[1] + 5], [root[0] - 12, root[1] + 1]);
        tailParts.push(tube(curl(path, 3.2, 1.25, -1), 5, 1, d.skin));
      }
      break;
  }
  // The tail is drawn relative to where it hinges, so the hinge can turn.
  const tailRoot: [number, number] = d.look === 'puffer' ? [-bw + 3, 1] : d.look === 'shark' ? [-bw + 3, 2] : [-bw + 3, bh - 4.5];
  for (const t of tailParts) {
    const o = t as unknown as { x: number; y: number };
    o.x -= tailRoot[0];
    o.y -= tailRoot[1];
  }
  return { head, body, back, root, puff, tail: tailParts, tailRoot, drags };
}

/**
 * A fighter, built out of parts that can be posed.  The frog is round and
 * low-slung; the lizard is taller, narrower and has a snout and a tail.  Both
 * stand on two legs, and both are drawn facing right — the container is
 * mirrored for whichever way they are actually looking.
 */
function makeFighter(scene: Phaser.Scene, x: number, who: 'frog' | FoeDef, facing: 1 | -1): Fighter {
  const foe = who === 'frog' ? null : who;
  // The lizard's old art switches: every `kind === 'lizard'` below meant
  // "the opponent", and still does -- the species-specific pieces are added
  // by `foeGear` on top.
  const kind: 'frog' | 'lizard' = foe ? 'lizard' : 'frog';
  const skin = foe ? foe.skin : PALETTE.moss;
  const skinLight = foe ? foe.skinLight : PALETTE.mossLight;
  const headCol = foe?.headCol ?? skinLight;

  const legL = scene.add.rectangle(-4, -2, 4, 10, skin).setOrigin(0.5, 1);
  const legR = scene.add.rectangle(4, -2, 4, 10, skin).setOrigin(0.5, 1);
  const footL = scene.add.rectangle(-5, 0, 7, 2, skinLight).setOrigin(0.5, 1);
  const footR = scene.add.rectangle(5, 0, 7, 2, skinLight).setOrigin(0.5, 1);
  // The old lizard tail is now the lizard's own piece of gear; see `foeGear`.
  const tail = null as Phaser.GameObjects.Triangle | null;
  const torso = scene.add.ellipse(0, -18, foe ? foe.bodyW : 18, foe ? foe.bodyH : 18, skin);
  const belly = scene.add.ellipse(1, -16, foe ? Math.max(6, foe.bodyW * 0.55) : 11, 11, skinLight);
  const shin = scene.add.rectangle(6, -6, 4, 4, skinLight).setOrigin(0, 0.5).setVisible(false);
  // ---- THEY ARE BOXERS, SO THEY WEAR GLOVES.
  //
  // The arm was a bare bar with a slightly lighter bar on the end, and at
  // this size a thin bar with a bulge is not reliably a limb -- which is
  // exactly the problem with the low attack.  A glove fixes both: it is a
  // big, blunt, brightly coloured shape that cannot read as anything else,
  // and it tells the player at a glance that this is a boxing match.
  //
  // Red for the frog, blue for the bird, so you can tell whose fist is in
  // the middle of the ring.  The laced cuff is what joins it to the arm.
  const gloveCol = foe ? foe.glove : 0xc4342e;
  const gloveLit = foe ? foe.gloveLit : 0xe8635a;
  const arm = scene.add.rectangle(4, -22, 4, 6, skin).setOrigin(0, 0.5);
  // Ellipses, not rectangles.  A glove is the roundest thing in a boxing
  // ring and a square one reads as a parcel taped to the end of an arm.
  const cuff = scene.add.rectangle(8, -22, 3, 7, PALETTE.cream).setOrigin(0.5, 0.5);
  const fist = scene.add.ellipse(8, -22, 7, 8, gloveCol);
  const knuckle = scene.add.ellipse(8, -24, 6, 3, gloveLit);
  const thumb = scene.add.ellipse(8, -19, 3.5, 3, gloveLit);
  const head = scene.add.ellipse(2, -30, foe ? foe.headW : 15, 12, headCol);
  // The plain snout is right for a frog and a lizard.  The long-jawed ones
  // draw their own in `foeGear`, and a penguin has a beak instead, so theirs
  // is kept small enough to sit under what is drawn on top.
  const look = foe?.look ?? 'frog';
  const longJaw = look === 'croc' || look === 'gator' || look === 'komodo';
  const snout =
    kind === 'lizard'
      ? scene.add.ellipse(9, -29, longJaw || look === 'penguin' ? 3 : 9, longJaw ? 3 : 6, headCol)
      : scene.add.ellipse(7, -28, 5, 4, skinLight);
  // a gecko's eyes are the biggest thing on its face
  const eyeR0 = look === 'gecko' ? 4 : look === 'penguin' ? 2.4 : 3;
  const eyeL = scene.add.circle(-1, -34, eyeR0, PALETTE.cream);
  const eyeR = scene.add.circle(5, -34, eyeR0, PALETTE.cream);
  const pupL = scene.add.circle(0, -34, look === 'gecko' ? 2 : 1.4, PALETTE.black);
  const pupR = scene.add.circle(6, -34, look === 'gecko' ? 2 : 1.4, PALETTE.black);
  // A lizard has a crest, a frog does not.  At this size that is the whole of
  // telling them apart at a glance.
  const crest =
    look === 'lizard'
      ? scene.add.triangle(0, -37, 0, 6, 4, 0, 8, 6, PALETTE.rust)
      : scene.add.circle(0, -37, 0.5, skinLight).setVisible(false);
  const aura = scene.add.circle(4, -20, 4, PALETTE.ember, 0.5).setVisible(false);
  const call = centerText(scene, 0, -52, '', PALETTE.cream).setVisible(false);

  // ---- WHO THEY ARE.  Built on top of the shared parts, in three groups
  // that follow the part they belong to; see `Art.headGear`.
  const gear = foe ? foeGear(scene, foe) : { head: [], body: [], back: [], root: [], puff: [], tail: [], tailRoot: [0, 0] as [number, number], drags: false };
  const tailC = gear.tail.length ? scene.add.container(gear.tailRoot[0], -18 + gear.tailRoot[1], gear.tail) : null;
  const headGear = scene.add.container(2, -30, gear.head);
  const bodyGear = scene.add.container(0, -18, gear.body);
  const backGear = scene.add.container(0, -18, gear.back);
  const puff = gear.puff.length ? scene.add.container(0, -18, gear.puff).setScale(0.55) : null;
  // A snake has no legs: its coil is drawn in `gear.root` instead.
  if (look === 'snake') for (const leg of [legL, legR, footL, footR]) leg.setVisible(false);

  const parts: Phaser.GameObjects.GameObject[] = [...gear.root, footL, footR, legL, legR];
  if (tail) parts.push(tail);
  parts.push(backGear);
  if (tailC) parts.push(tailC);
  if (puff) parts.push(puff);
  parts.push(aura, torso, belly, bodyGear, shin, arm, cuff, fist, knuckle, thumb, head, snout, headGear, crest, eyeL, eyeR, pupL, pupR, call);
  const root = scene.add.container(x, FLOOR_Y, parts).setDepth(20);
  root.setScale(facing, 1);

  return {
    x,
    y: FLOOR_Y,
    vy: 0,
    hp: MAX_HP,
    facing,
    crouch: false,
    blocking: false,
    move: null,
    phase: null,
    timer: 0,
    hitLanded: false,
    specialCd: 0,
    stun: 0,
    recoil: 0,
    step: 0,
    art: {
      root, legL, legR, torso, belly, head, snout, eyeL, eyeR, pupL, pupR, crest, arm, fist, cuff, knuckle, thumb, shin, aura, call,
      skin, skinLight, headCol, headGear, bodyGear, backGear, puff,
      snoutX: longJaw ? 3 : 6,
      // eyes set back on the long jaws, higher and further apart on a gecko
      eyeX: longJaw ? [-3, 2] : look === 'gecko' ? [-2, 6] : [-1, 5],
      eyeY: look === 'crab' ? -11 : -4,
      tail: tailC,
      tailRoot: gear.tailRoot,
      drags: gear.drags,
      cycle: look === 'chameleon',
    },
    foe,
  };
}

function startRound(): void {
  if (!p1 || !p2) return;
  p1.hp = MAX_HP;
  p2.hp = MAX_HP;
  p1.x = 90;
  p2.x = 230;
  p1.move = p2.move = null;
  p1.phase = p2.phase = null;
  p1.specialCd = p2.specialCd = 0;
  p1.stun = p2.stun = 0;
  p1.recoil = p2.recoil = 0;
  p1.facing = 1;
  p2.facing = -1;
  roundMs = ROUND_MS;
  aiBeat = 0;
  aiTimer = 600;
  aiWhiffOpening = 0;
  aiSway = 0;
  aiCounter = 0;
  roundOver = true;

  roundText?.setText(`ROUND ${wins1 + wins2 + 1}   ${wins1}-${wins2}`);
  announce?.setText('READY');
  // Round one says who you have drawn, and what they are like.  The later
  // rounds do not: by then you know.
  const first = wins1 + wins2 === 0;
  const foe = p2.foe;
  if (first && foe) {
    introName?.setText(`VS ${foe.name}`).setTint(foe.rare ? PALETTE.gold : PALETTE.cream);
    introNote?.setText(foe.rare ? `RARE - ${foe.note}` : foe.note);
  }
  sceneRef?.time.delayedCall(first ? 1500 : 800, () => {
    introName?.setText('');
    introNote?.setText('');
    announce?.setText('FIGHT');
    roundOver = false;
    sceneRef?.time.delayedCall(500, () => announce?.setText(''));
  });
}

function endRound(playerWon: boolean): void {
  if (roundOver) return;
  roundOver = true;
  if (playerWon) wins1++;
  else wins2++;
  announce?.setText(playerWon ? 'ROUND WON' : 'ROUND LOST');
  audio.sfx(playerWon ? 'chime' : 'buzzer');

  if (wins1 >= ROUNDS_TO_WIN || wins2 >= ROUNDS_TO_WIN) {
    over = true;
    const won = wins1 >= ROUNDS_TO_WIN;
    sceneRef?.time.delayedCall(1100, () => (won ? apiRef?.win() : apiRef?.lose()));
    return;
  }
  sceneRef?.time.delayedCall(1200, () => startRound());
}

function handleInput(dt: number): void {
  if (!p1) return;
  const f = p1;
  // Reeling from a hit: no walking, no attacking, and it is visible.
  if (f.stun > 0) {
    f.blocking = false;
    return;
  }
  f.blocking = keys.block?.isDown ?? false;
  f.crouch = keys.crouch?.isDown ?? false;

  if (!f.move && !f.blocking) {
    if (keys.left?.isDown) f.x -= WALK_SPEED * dt;
    if (keys.right?.isDown) f.x += WALK_SPEED * dt;
    if (keys.jump?.isDown && f.y >= FLOOR_Y) f.vy = JUMP_V;
  }
  f.x = Phaser.Math.Clamp(f.x, 20, GAME_W - 20);

  if (!f.move && !f.blocking) {
    if (keys.high?.isDown) startMove(f, 'high');
    else if (keys.low?.isDown) startMove(f, 'low');
    else if (keys.special?.isDown) {
      if (f.specialCd <= 0) startMove(f, 'special');
      else notReady();
    }
  }
}

/** PRD §9.8: approach -> low -> high-high, with a 0.6s window after a whiff. */
function runAi(delta: number, dt: number): void {
  if (!p1 || !p2 || aiFrozen) return;
  const ai = p2;
  const dist = Math.abs(ai.x - p1.x);
  const me = ai.foe ?? FOES[0];
  const reach = (m: keyof typeof MOVES) => MOVES[m].range * me.reach + 6;

  // A counterpuncher, having just blocked one, answers straight back -- before
  // the stun check, since the answer goes out the moment the block ends.
  if (aiCounter > 0) {
    aiCounter -= delta;
    if (aiCounter <= 0 && !ai.move && ai.stun <= 0 && dist < reach('high')) {
      ai.blocking = false;
      startMove(ai, 'high');
      return;
    }
  }
  if (ai.stun > 0) {
    ai.blocking = false;
    return;
  }

  if (aiWhiffOpening > 0) {
    aiWhiffOpening -= delta;
    ai.blocking = false;
    return; // the opening: it does nothing at all
  }

  aiTimer -= delta;
  if (ai.move) return;

  // Blocks about half of punches and a third of kicks -- more for a tortoise,
  // fewer for a rhino, and never every one.
  if (p1.move && p1.phase === 'startup' && dist < 40) {
    const chance = Math.min(0.9, (p1.move === 'high' ? 0.5 : 0.3) * me.blockRate);
    ai.blocking = Math.random() < chance;
  } else {
    ai.blocking = false;
  }

  if (aiTimer > 0) {
    // This used to read `aiBeat === 0`, but aiBeat only ever counts up — it is
    // 3, 6, 9 on later cycles, so the check was false forever and Froggy stood
    // rooted to the spot after his first approach.  He now keeps his spacing:
    // steps in when he is out of kick range, backs off when you are too close.
    // The ideal distance breathes, so he circles the edge of his own kick range
    // instead of parking on it — that in-and-out is the rhythm you play against.
    aiSway += dt;
    // A long reach stands further off; a crab circles wider than a gecko.
    const ideal = MOVES.low.range * me.reach - 4 + Math.sin(aiSway * 1.7) * 11;
    const toward = Math.sign(p1.x - ai.x) || 1;
    const drift = dist > ideal + 3 ? 1 : dist < ideal - 3 ? -1 : 0;
    if (drift !== 0) {
      ai.x += toward * drift * WALK_SPEED * 0.8 * me.speed * dt;
      ai.x = Phaser.Math.Clamp(ai.x, 20, GAME_W - 20);
    }
    return;
  }

  // Off the script.  A monkey does this most of the time and a tortoise
  // never: a random blow, or a pause that breaks the rhythm you were reading.
  if (me.chaos > 0 && Math.random() < me.chaos * 0.5) {
    const roll = Math.random();
    if (roll < 0.3) aiTimer = (150 + Math.random() * 450) * me.tempo;
    else {
      const m: keyof typeof MOVES = roll < 0.4 && ai.specialCd <= 0 ? 'special' : roll < 0.7 ? 'high' : 'low';
      if (dist < reach(m)) startMove(ai, m);
      aiTimer = (200 + Math.random() * 300) * me.tempo;
    }
    aiBeat++;
    return;
  }

  switch (aiBeat % 3) {
    case 0:
      aiTimer = 500 * me.tempo;
      aiBeat++;
      break;
    case 1: {
      // The opener is where a fighter's taste shows: the baseline sweeps, a
      // croc leads with the hands, a rhino goes for the big one whenever it is
      // there, and every one of them goes for it when they are hurt.
      const hurt = ai.hp < MAX_HP * 0.4 && ai.specialCd <= 0;
      const pick: keyof typeof MOVES =
        hurt || (me.style === 'specials' && ai.specialCd <= 0) ? 'special' : me.style === 'highs' ? 'high' : 'low';
      if (dist < reach(pick)) startMove(ai, pick);
      else aiTimer = 300 * me.tempo;
      aiBeat++;
      break;
    }
    case 2: {
      // The follow-up.  The body-shot fighters dig low again half the time.
      const pick: keyof typeof MOVES = me.style === 'lows' && Math.random() < 0.5 ? 'low' : 'high';
      if (dist < reach(pick)) startMove(ai, pick);
      aiTimer = 420 * me.tempo;
      aiBeat++;
      break;
    }
  }
}

/** Put the drawn opponent's name over their health bar. */
function nameFoe(): void {
  const foe = p2?.foe;
  if (!foeLabel || !foe) return;
  foeLabel.setText(foe.rare ? `* ${foe.name}` : foe.name).setTint(foe.rare ? PALETTE.gold : PALETTE.amber);
}

/**
 * Who comes out this time: a fresh roll every time Grudge is started.  In
 * development `?foe=croc` pins one, so each can be looked at on purpose.
 */
function chooseFoe(): FoeDef {
  if (import.meta.env?.DEV && typeof location !== 'undefined') {
    const want = new URLSearchParams(location.search).get('foe');
    const def = want && FOES.find((f) => f.key === want);
    if (def) return def;
  }
  return pickFoe();
}

function startMove(f: Fighter, move: keyof typeof MOVES): void {
  if (f.stun > 0) return;
  f.move = move;
  f.phase = 'startup';
  // A rhino takes longer to wind up than a gecko.  Same move, same damage
  // table -- the fighter's own pace on top of it.
  f.timer = MOVES[move].startup * (f.foe?.windup ?? 1);
  f.hitLanded = false;
  if (move === 'special') f.specialCd = SPECIAL_COOLDOWN;
}

function tickFighter(f: Fighter, delta: number, dt: number): void {
  if (f.specialCd > 0) {
    f.specialCd -= delta;
    // The moment it comes back is worth hearing, not just seeing: the player
    // is watching the fight, not the corner of the HUD.
    if (f === p1 && f.specialCd <= 0) audio.sfx('bell_ding', 0.5);
  }
  if (f.stun > 0) {
    // Being hit interrupts whatever you were throwing: that is what makes a
    // clean hit worth landing and a wind-up worth punishing.
    f.stun -= delta;
    f.move = null;
    f.phase = null;
    f.blocking = false;
    if (f.stun <= 0) f.recoil = 0;
  }

  // gravity
  if (f === p2 && aiHover !== null) {
    f.y = FLOOR_Y - aiHover;
    f.vy = 0;
  } else if (f.y < FLOOR_Y || f.vy !== 0) {
    f.vy += GRAVITY * dt;
    f.y += f.vy * dt;
    if (f.y >= FLOOR_Y) {
      f.y = FLOOR_Y;
      f.vy = 0;
    }
  }

  if (!f.move) return;
  f.timer -= delta;
  if (f.timer > 0) {
    if (f.phase === 'active') tryHit(f);
    return;
  }

  const def = MOVES[f.move];
  if (f.phase === 'startup') {
    f.phase = 'active';
    f.timer = def.active * (f.foe?.windup ?? 1);
    audio.sfx('ui_hover');
  } else if (f.phase === 'active') {
    f.phase = 'recovery';
    f.timer = def.recovery * (f.foe?.windup ?? 1);
    // A whiffed kick from the AI is the player's invitation.
    if (f === p2 && !f.hitLanded && f.move === 'low') aiWhiffOpening = 600;
  } else {
    f.move = null;
    f.phase = null;
  }
}

function tryHit(f: Fighter): void {
  if (f.hitLanded || !f.move) return;
  const target = f === p1 ? p2 : p1;
  if (!target) return;

  const def = MOVES[f.move];
  const dist = Math.abs(f.x - target.x);
  const facingRight = target.x > f.x;
  // A crab's hooks go wide; a penguin has to get close.
  if (dist > def.range * (f.foe?.reach ?? 1)) return;
  if ((facingRight && f.facing !== 1) || (!facingRight && f.facing !== -1)) return;
  if (target.y < FLOOR_Y - JUMP_CLEARANCE[f.move]) return; // jumped over it

  // A low sweep goes under a block; a high strike does not go through one.
  const blocked = target.blocking && !(f.move === 'low' && !target.crouch);

  // ---- THE SLIPPERY ONES ARE SOMETIMES SIMPLY NOT THERE.  A clean blow at a
  // snake or a chameleon can miss outright -- the swing is spent, nothing
  // lands, and it visibly sways out of the way.  Never while the fight is
  // frozen for a test, which is measuring whether a blow lands at all.
  if (!blocked && target.foe && target.foe.dodge > 0 && !aiFrozen && Math.random() < target.foe.dodge) {
    f.hitLanded = true;
    slip(target, facingRight ? 1 : -1);
    return;
  }

  f.hitLanded = true;
  // A tortoise's guard lets through a third of what anybody else's does.
  const guard = BLOCK_MULT * (target.foe?.guard ?? 1);
  const dmg = (blocked ? def.dmg * guard : def.dmg) * (f.foe?.power ?? 1);
  // And after a block, the counterpunchers answer straight back.
  if (blocked && target === p2 && target.foe && !aiFrozen && Math.random() < target.foe.counter) aiCounter = 140;
  target.hp -= dmg;
  audio.sfx(blocked ? 'ui_blip' : f.move === 'special' ? 'boom' : 'whack');

  // knockback, and the reel that goes with it
  const away = facingRight ? 1 : -1;
  target.x += away * (blocked ? 3 : 7);
  target.x = Phaser.Math.Clamp(target.x, 20, GAME_W - 20);
  if (!blocked) {
    target.stun = HITSTUN[f.move];
    target.recoil = away * 3;
  }

  // where it landed, in world pixels: head height for a high strike, knee
  // height for a sweep, chest for the special
  const hx = f.x + f.facing * (def.range * 0.6);
  const hy = f.y - (f.move === 'low' ? 12 : f.move === 'special' ? 20 : 28);
  impact(hx, hy, f.move, blocked);
}

/**
 * Pose the fighter.  Everything about what they are doing is in the drawing:
 * the crouch, the wind-up, the strike, the droop afterwards, the block, the
 * reel from a hit, and the word over their head naming the attack.
 */
function render(f: Fighter, dt: number): void {
  const a = f.art;
  // Holding down is a full squat.  Throwing the sweep is only a dip into it:
  // at a full crouch the fighter ended up sitting on the floor with a leg
  // stuck out flat, which is not a kick, it is a fall.
  const crouch = f.crouch && f.y >= FLOOR_Y ? 5 : f.move === 'low' ? 2 : 0;
  const reel = f.stun > 0 ? f.recoil * Math.min(4, f.stun / 60) : 0;

  a.root.setPosition(f.x + reel, f.y);
  a.root.setScale(f.facing, 1);

  // ---- legs.  They step when the fighter moves and plant when they do not.
  const walking = Math.abs(f.step) > 0.01;
  const swing = walking ? Math.sin(f.step) * 3 : 0;
  a.legL.setPosition(-4 + swing, -2 - crouch * 0.4).setSize(4, 10 - crouch);
  a.legR.setPosition(4 - swing, -2 - crouch * 0.4).setSize(4, 10 - crouch);
  f.step += walking ? dt * 9 : 0;

  // ---- body and head, with the crouch taken out of the height
  const breathe = f.move ? 0 : Math.sin(sceneClock * 3 + (f === p2 ? 1.6 : 0)) * 0.6;
  a.torso.setPosition(0, -18 + crouch + breathe);
  a.belly.setPosition(1, -16 + crouch + breathe);
  a.head.setPosition(2, -30 + crouch * 1.4 + breathe);
  a.snout.setPosition(a.head.x + a.snoutX, a.head.y + 1);
  a.eyeL.setPosition(a.eyeX[0], a.head.y + a.eyeY);
  a.eyeR.setPosition(a.eyeX[1], a.head.y + a.eyeY);
  // The pupils ride the eyes.  Left behind, they float over the fighter's head
  // like two flies, which is exactly how it looked.
  a.pupL.setPosition(a.eyeX[0] + 1, a.head.y + a.eyeY);
  a.pupR.setPosition(a.eyeX[1] + 1, a.head.y + a.eyeY);
  a.crest.setPosition(0, a.head.y - 7);
  // ---- AND WHAT MAKES THEM WHO THEY ARE, riding the parts it belongs to.
  a.headGear.setPosition(a.head.x, a.head.y);
  a.bodyGear.setPosition(a.torso.x, a.torso.y);
  // A crab's legs scuttle when it moves; everybody else's back gear is still.
  const scuttle = f.foe?.look === 'crab' && walking ? Math.sin(f.step * 2) * 0.8 : 0;
  a.backGear.setPosition(a.torso.x, a.torso.y + scuttle);
  // ---- THE TAIL, on its hinge at the hips.  It follows the body down into
  // a crouch and turns up by as much as the body dropped, so one that lies
  // on the boards stays on them rather than going through; a hit flicks it;
  // and it sways, slowly, the whole time.
  if (a.tail) {
    const lift = a.drags ? crouch * 3.2 : crouch * 1.5;
    const flick = f.stun > 0 ? 9 : 0;
    const sway = Math.sin(sceneClock * 2.2 + (f === p2 ? 0.8 : 0)) * (a.drags ? 1.2 : 3.5);
    a.tail.setPosition(a.torso.x + a.tailRoot[0], a.torso.y + a.tailRoot[1] + scuttle).setAngle(lift + flick + sway);
  }
  // ---- MR FISHY PUFFS UP.  Spikes out and body swollen while he blocks, and
  // back down after -- eased, so it swells rather than pops.
  if (a.puff) {
    const want = f.blocking ? 1.12 : 0.55;
    const now = a.puff.scaleX + (want - a.puff.scaleX) * Math.min(1, dt * 14);
    a.puff.setPosition(a.torso.x, a.torso.y).setScale(now);
    a.torso.setScale(0.9 + (now - 0.55) * 0.55);
  }

  // ---- the limbs, by move and phase
  a.shin.setVisible(false);
  a.aura.setVisible(false);
  a.arm.setFillStyle(a.skin);
  // Everything that makes up the glove hangs off wherever the fist was put,
  // so no pose has to remember to move four things.
  const glove = (x: number, y: number, size: number): void => {
    a.fist.setPosition(x, y).setSize(size * 1.08, size);
    a.cuff.setPosition(x - size * 0.58, y).setSize(size * 0.4, size * 0.82);
    a.knuckle.setPosition(x + size * 0.12, y - size * 0.26).setSize(size * 0.68, size * 0.3);
    a.thumb.setPosition(x - size * 0.1, y + size * 0.3).setSize(size * 0.42, size * 0.34);
  };
  // Every arm position below is written for standing; crouched, the body
  // is lower, and a glove left at standing height sits on top of the head.
  const cy = crouch;
  if (f.move && f.phase) {
    const def = MOVES[f.move];
    if (f.move === 'high') {
      // A straight arm at head height, and the shoulder turned into it.
      if (f.phase === 'startup') {
        a.arm.setPosition(-2, a.head.y + 4).setSize(6, 6);
        glove(-5, a.head.y + 4, 8);
      } else if (f.phase === 'active') {
        a.arm.setPosition(4, a.head.y + 3).setSize(def.range * 0.7, 6);
        glove(5 + def.range * 0.7, a.head.y + 3, 9);
      } else {
        a.arm.setPosition(4, -20 + cy).setSize(def.range * 0.3, 5);
        glove(5 + def.range * 0.3, -20 + cy, 7);
      }
    } else if (f.move === 'low') {
      // ---- A BODY SHOT, AND IT HAS TO LOOK LIKE A PUNCH.
      //
      // This was drawn as a shin sweeping along at knee height: a bar four
      // or five pixels thick and thirty long, coming out of the middle of a
      // fighter at hip level.  At this size that is not a leg, and the shape
      // it does read as is not one anybody wants in an arcade cabinet.
      //
      // It is a gloved dig to the body now -- same height, same reach, same
      // purpose of going under a high guard, but thrown with a fist that is
      // unmistakably a fist, off a short thick arm rather than a long thin
      // one.  The fighter still drops his weight into it.
      a.shin.setVisible(false);
      const ly = -15 + cy;
      if (f.phase === 'startup') {
        // cocked back against the ribs
        a.arm.setPosition(-3, ly).setSize(6, 7);
        glove(-6, ly + 1, 8);
      } else if (f.phase === 'active') {
        a.arm.setPosition(3, ly).setSize(def.range * 0.62, 7);
        glove(4 + def.range * 0.62, ly, 10);
      } else {
        a.arm.setPosition(3, ly - 1).setSize(def.range * 0.26, 6);
        glove(4 + def.range * 0.26, ly - 1, 8);
      }
    } else {
      // The special: wound up with a ring of light, then thrown with both arms.
      const glow = f.phase === 'startup' ? 1 - f.timer / def.startup : 1;
      a.aura
        .setVisible(true)
        .setPosition(f.phase === 'active' ? 12 : 2, -20 + cy)
        .setRadius(4 + glow * (f.phase === 'active' ? 14 : 7))
        .setFillStyle(PALETTE.ember, f.phase === 'recovery' ? 0.25 : 0.45);
      a.arm.setFillStyle(PALETTE.ember);
      if (f.phase === 'startup') {
        a.arm.setPosition(-3, -24 + cy).setSize(7, 7);
        glove(-7, -24 + cy, 9);
      } else if (f.phase === 'active') {
        a.arm.setPosition(4, -20 + cy).setSize(def.range * 0.8, 8);
        glove(6 + def.range * 0.8, -20 + cy, 12);
      } else {
        a.arm.setPosition(3, -18 + cy).setSize(def.range * 0.3, 6);
        glove(4 + def.range * 0.3, -18 + cy, 8);
      }
    }
    a.call
      .setVisible(true)
      .setText(MOVE_NAME[f.move])
      .setTint(f.move === 'special' ? PALETTE.ember : f.move === 'low' ? PALETTE.gold : PALETTE.cream)
      .setAlpha(f.phase === 'recovery' ? 0.4 : 1);
    // The container is mirrored, so the label would be too; un-mirror it.
    a.call.setScale(f.facing, 1);
  } else {
    // ---- AND BETWEEN PUNCHES, THE GUARD IS UP.
    //
    // A boxer standing with his arm out straight is a boxer about to be hit.
    // Idle, the glove comes back to the chin and rides the breathing, which
    // is also what makes the punches read as punches: they are a departure
    // from somewhere.
    const guardBob = Math.sin(sceneClock * 3 + (f === p2 ? 1.6 : 0)) * 0.7;
    a.arm.setPosition(1, -23 + cy).setSize(6, 6);
    glove(6, -25 + cy * 1.2 + guardBob, 8);
    a.call.setVisible(false);
  }

  // ---- block, wind-up and hit, in that order of loudness
  const winding = f.phase === 'startup';
  a.torso.setStrokeStyle(f.blocking ? 2 : 0, PALETTE.white);
  a.head.setFillStyle(f.stun > 0 ? PALETTE.white : f.blocking ? PALETTE.bone : winding ? PALETTE.white : a.headCol);
  // A chameleon never quite settles on one colour.
  const skinNow = a.cycle ? Phaser.Display.Color.HSVToRGB((sceneClock * 0.09) % 1, 0.55, 0.72).color : a.skin;
  a.torso.setFillStyle(f.stun > 0 ? PALETTE.bone : skinNow);
}

/**
 * A SLIP: the blow was thrown at where it was, and it is not there now.
 * A sway away and a word, and no stun -- slipping a punch is not being hit.
 */
function slip(f: Fighter, away: number): void {
  f.x = Phaser.Math.Clamp(f.x + away * 6, 20, GAME_W - 20);
  f.recoil = away * 2;
  audio.sfx('ui_hover', 0.5);
  const pop = centerText(sceneRef!, f.x, f.y - 46, 'SLIP', PALETTE.cream).setDepth(40);
  sceneRef?.tweens.add({ targets: pop, y: pop.y - 10, alpha: 0, duration: 520, onComplete: () => pop.destroy() });
  sceneRef?.time.delayedCall(160, () => { f.recoil = 0; });
}

/** The cooldown bars, and the word that says the special is back. */
function renderCooldowns(): void {
  if (!p1 || !p2) return;
  const ready1 = p1.specialCd <= 0;
  cd1?.setSize(62 * (1 - Math.max(0, p1.specialCd) / SPECIAL_COOLDOWN), 3);
  cd1?.setFillStyle(ready1 ? PALETTE.gold : PALETTE.ember);
  cd1Label?.setText(ready1 ? 'SPECIAL READY' : 'CHARGING');
  cd1Label?.setTint(ready1 ? PALETTE.gold : PALETTE.ash);
  cd2?.setSize(62 * (1 - Math.max(0, p2.specialCd) / SPECIAL_COOLDOWN), 3);
  cd2?.setFillStyle(p2.specialCd <= 0 ? PALETTE.gold : PALETTE.ember);
}

/** Pressed the special while it was charging: say so rather than do nothing. */
function notReady(): void {
  if (!sceneRef || notReadyT > 0) return;
  notReadyT = 500;
  audio.sfx('buzzer', 0.35);
  cd1Label?.setText('NOT READY').setTint(PALETTE.blood);
}

/** The burst where a blow landed, and the shake behind a big one. */
function impact(x: number, y: number, move: keyof typeof MOVES, blocked: boolean): void {
  if (!sceneRef) return;
  const colour = blocked ? PALETTE.steel : move === 'special' ? PALETTE.ember : PALETTE.cream;
  const n = move === 'special' ? 7 : 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random();
    const bit = sceneRef.add.rectangle(x, y, 3, 3, colour).setDepth(30);
    sceneRef.tweens.add({
      targets: bit,
      x: x + Math.cos(a) * (move === 'special' ? 22 : 12),
      y: y + Math.sin(a) * (move === 'special' ? 18 : 10),
      alpha: 0,
      duration: move === 'special' ? 320 : 200,
      onComplete: () => bit.destroy(),
    });
  }
  const ring = sceneRef.add.circle(x, y, 4, colour, 0).setStrokeStyle(1, colour).setDepth(30);
  sceneRef.tweens.add({
    targets: ring,
    radius: move === 'special' ? 26 : 14,
    alpha: 0,
    duration: 260,
    onComplete: () => ring.destroy(),
  });
  if (!blocked) sceneRef.cameras.main.shake(move === 'special' ? 220 : 90, move === 'special' ? 0.008 : 0.003);
}

export const _css = css;
