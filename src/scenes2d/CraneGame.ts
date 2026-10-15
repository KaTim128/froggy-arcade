/**
 * ---- THE CLAW MACHINES.  The fourth room's two cranes, played up close.
 *
 * You are stood at the cabinet, looking in through the glass at a machine
 * piled to the top with prizes.  The controls are LEFT and RIGHT only, and
 * what they move depends on the view: from the front, the claw left and
 * right along the gantry; from the SIDE, where the front of the machine is
 * on the left and the back on the right, the claw forward and back into it.
 *
 * THE BUTTONS, IN ORDER, AND NONE CAN BE SKIPPED:
 *   front view       [SIDE VIEW]                 -- line it up left/right
 *   side view        [DROP]      and [BACK]      -- line it up front/back
 *   front, after     [DROP]      and [SIDE VIEW] -- (look again if you like)
 *   lowering         [...]
 *   settled          [GRAB]
 * The clock running out drops it, wherever it is, and grabs as it settles.  DROP sends it down from wherever it is, drifting a
 * little the way it was travelling, until it settles on the pile -- and there
 * it waits, open, until you press GRAB (the same button, relabelled).  Then
 * it shuts, comes up, and goes back to the chute at the front, where it lets
 * go of whatever it is holding.  SIDE VIEW (or V) swaps the glass for a look
 * in from the side, to judge how far back the claw is over the pile.  Every go starts with the claw parked over
 * that chute, and ends there.  When the clock runs out it drops and grabs on
 * its own -- and the clock keeps running while it waits on the pile, so
 * waiting out the clock there grabs too.  QUIT leaves at any time.
 *
 *   PLUSH CRANE (5 tokens).  Animal plushies, and -- rarely -- a Froggy.  It is a
 *   real claw machine's claw: a weak grip, and it holds one time in ten.
 *
 *   THE OTHER ONE (5 tokens).  Capsules, in the dark, under a flickering
 *   light.  A strong claw -- come down on a capsule and it brings it home
 *   four times in five -- and every capsule it brings up has tokens in it:
 *   anything from 1 to 6 -- now and then (one in ten) a LUCKY one with up
 *   to 15 -- or, one in fifty, the JACKPOT, 50.  On average
 *   a go comes back with less than it cost; the jackpot is why you stay.  And a few
 *   hold something more, that should not be in a toy machine at all, which
 *   the man outside will pay a great deal for.
 *
 * Whatever it gives you goes in a pocket, so a go is refused with full
 * pockets (the room checks before you get here, and AGAIN checks again).
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { ledger } from '../core/ledger';
import { button, centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { TokenHud } from '../ui/hud';
import { drawItem } from '../ui/pockets';
import { CAPSULE_VARIANTS, TOY_H, TOY_RES, TOY_W, plushKind, toyTexture } from '../art/craneToys';
import { bodyFor, generatePile, restPlace, settlePile, type PileBody, type PileBounds } from '../game/cranePile';
import { FULL_LINE, ODDITIES, PLUSHIES, addItem, itemDef, pocketsFull } from '../game/inventory';
import { isTouch } from '../core/device';
import { touchControls } from '../ui/touchControls';
import { showTutorial, type TutorialCard } from '../ui/tutorialCard';
import { deviceControls, deviceObjective, type ControlRow } from '../ui/controlsList';
import { touchLayoutFor } from '../game/touchLayouts';
import { store, type SavedToy } from '../core/state';

/**
 * How to play, on the same card every cabinet in the back rooms opens on.
 * The two machines play alike; what differs is what is in the glass and how
 * hard it holds on.
 */
const HOW_TO: Record<CraneKind, string[]> = {
  plush: [
    'GRAB A PLUSH AND DROP IT DOWN THE CHUTE.',
    'LINE THE CLAW UP FROM THE FRONT, THEN',
    'CHECK THE DEPTH IN THE SIDE VIEW.',
    'DROP, THEN GRAB ON THE WAY DOWN OR',
    'ONCE IT SETTLES. CENTRE GRIPS BEST!',
    'A WON TOY GOES IN YOUR POCKETS.',
  ],
  oddity: [
    'GRAB A CAPSULE AND DROP IT DOWN THE CHUTE.',
    'LINE THE CLAW UP FROM THE FRONT, THEN',
    'CHECK THE DEPTH IN THE SIDE VIEW.',
    'DROP, THEN GRAB ON THE WAY DOWN OR',
    'ONCE IT SETTLES ON A CAPSULE: 4 IN 5.',
    'WHAT IS INSIDE GOES IN YOUR POCKETS.',
  ],
};
const HOW_TO_KEYS: ControlRow[] = [
  ['A / D OR ← →', 'MOVE THE CLAW'],
  ['SPACE / E', 'SIDE VIEW, DROP, THEN GRAB'],
  ['V', 'FRONT / SIDE VIEW'],
  ['ESC', 'LEAVE'],
];

export type CraneKind = 'plush' | 'oddity';

export const CRANE_COST: Record<CraneKind, number> = { plush: 5, oddity: 5 };

/** What a capsule from the dark crane holds: tokens, always. */
export const CAPSULE_MIN = 1;
export const CAPSULE_MAX = 6;
/** One in fifty is the jackpot. */
export const CAPSULE_JACKPOT = 50;
export const JACKPOT_CHANCE = 1 / 50;
/**
 * And one in ten of the rest is a LUCKY capsule: anything up to 15 inside,
 * so there is a real chance of coming out ahead without the jackpot.
 */
export const LUCKY_MAX = 15;
export const LUCKY_CHANCE = 1 / 10;
/** And now and then something else in with them, for the man outside. */
export const ODDITY_CHANCE = 0.03;

export interface Capsule {
  tokens: number;
  jackpot: boolean;
  lucky: boolean;
  oddity: boolean;
}

/** A capsule's contents.  `rnd` is there so the odds can be tested. */
export function rollCapsule(rnd: () => number = Math.random): Capsule {
  const jackpot = rnd() < JACKPOT_CHANCE;
  const lucky = !jackpot && rnd() < LUCKY_CHANCE;
  const top = lucky ? LUCKY_MAX : CAPSULE_MAX;
  const tokens = jackpot ? CAPSULE_JACKPOT : CAPSULE_MIN + Math.floor(rnd() * (top - CAPSULE_MIN + 1));
  return { tokens, jackpot, lucky, oddity: rnd() < ODDITY_CHANCE };
}

/**
 * ---- THE TOP BAR, laid out right to left with the same gap between every
 * piece: QUIT against the right edge, the view button left of it, the title
 * plate left of that.  Each owns its own slot; nothing is placed by eye.
 * (The plate used to run 5 pixels under the view button, and QUIT sat one
 * pixel off its other side.)
 */
const BAR_GAP = 4;
const QUIT_W = 40;
const VIEW_W = 64;
const PLATE_W = 96;
const QUIT_X = GAME_W - BAR_GAP - QUIT_W / 2;
const VIEW_X = QUIT_X - QUIT_W / 2 - BAR_GAP - VIEW_W / 2;
/** The title plate's centre (and the SIDE VIEW sign that replaces its name). */
const PLATE_X = VIEW_X - VIEW_W / 2 - BAR_GAP - PLATE_W / 2;

/** The inside of the machine, in the cabinet's picture. */
/** The clock's left edge: moved left on touch, out from under the DROP button. */
const CLOCK_X = isTouch() ? 208 : 246;
const BOX = { l: 14, r: 306, top: 26, bottom: 150 };
/** Where the pile is: left/right in pixels, back/forth 0 (front) to 1 (back). */
const PILE_L = 84;
const PILE_R = 292;
/** Where a prize may lie: across the pile, and from just inside the glass to the back wall. */
const PILE_BOUNDS: PileBounds = { l: PILE_L, r: PILE_R, zMin: 0.1, zMax: 0.94 };
/** Rows of the bottom layer, back to front, in depth. */
const PILE_ROWS = [0.86, 0.64, 0.42, 0.2];
/** The heap is never built higher than this (pixels of lift): two deep, clear of the claw. */
const MAX_LIFT = 40;
/** The prize chute, front left, behind its own little glass wall. */
const CHUTE = { x: 46, z: 0.05, l: 20, r: 72 };
/**
 * How long a go gives you, in seconds.  Long enough to line it up from the
 * front, look again from the side and still think about it: the clock is
 * there so nobody stands at the glass all afternoon, not to hurry the shot.
 */
const CLOCK_S = 14;
/** How far the claw can be let down, in pixels below the gantry. */
const MAX_DROP = 118;
/** The claw is drawn this much bigger than its design, to match the toys. */
const CLAW_K = TOY_RES;
const MOVE_X = 70;
const MOVE_Z = 0.85;
const LOWER = 60;
const RAISE = 70;
/**
 * How often the claw lifts what it closed on.  The capsule crane's is the
 * whole of its odds: come down on a capsule and it is yours 80% of the
 * time, wherever on it the fingers landed, and nothing slips on the way.
 */
export const GRIP: Record<CraneKind, number> = { plush: 0.34, oddity: 0.8 };
/**
 * THE ODDS, ALL TOLD, ARE ABOUT ONE GO IN FIVE -- and they come out of how a
 * claw machine actually loses.  The claw lifts what it closed on GRIP of the
 * time with its fingers dead centre on the toy, less the further off centre
 * they came down (down to just over half that at the edge of the claw); and
 * a prize it has lifted slips out on the way to the chute SLIP of the time.
 * Aimed fairly well, that is 0.34 x ~0.75 x 0.8: about 20%.  (The plush
 * crane's: the capsule crane's odds are GRIP alone.)
 */
export const SLIP: Record<CraneKind, number> = { plush: 0.2, oddity: 0 };
/** Only the plush crane's grip weakens off centre. */
const OFF_CENTRE: Record<CraneKind, number> = { plush: 0.45, oddity: 0 };
/** How close the fingers must come down to a toy to close on it at all. */
const REACH_X = 11;
const REACH_Z = 0.1;
/** From the claw's hanging point down to its fingertips, in claw units. */
/** From the claw's hanging point to the tips of its fingers, open. */
const FINGERS = 24 * TOY_RES;

/** Front of the floor is lower on screen; the back of it is higher. */
const floorY = (z: number): number => 146 - z * 32;
/** Further back, smaller. */
const scaleAt = (z: number): number => 1 - z * 0.28;
/** And drawn a little in toward the middle, for the depth. */
const screenX = (x: number, z: number): number => GAME_W / 2 + (x - GAME_W / 2) * (1 - z * 0.12);
const gantryY = (z: number): number => BOX.top + 6 - z * 6;

interface Toy {
  id: string;
  x: number;
  z: number;
  /** Height up the pile, in pixels at the front. */
  lift: number;
  art: Phaser.GameObjects.Container;
  /** How it was drawn: kept so the heap can be put back exactly as it was. */
  look: string;
  size: number;
  tilt: number;
  flip: boolean;
  /** Knocked over by the claw, degrees. */
  lean: number;
  /** Where it is drawn while it is settling: both views follow this, not a jump. */
  anim?: { x: number; z: number; lift: number };
}

/**
 * ---- WHAT EACH TOY IS LIKE TO GRAB.  `weight`: heavier is harder to lift
 * and likelier to slip (1 is an ordinary plush).  `stable`: how hard it is
 * to knock over -- the big ones barely tip when the claw bumps them.
 * `head`: how much worse a grab round the head is than round the body (a
 * round body fills the fingers; a head slides out between them).
 */
const FEEL: Record<string, { weight: number; stable: number; head: number }> = {
  frog: { weight: 1.2, stable: 0.9, head: 0.7 },
  lion: { weight: 1.15, stable: 0.85, head: 0.75 },
  panda: { weight: 1.12, stable: 0.8, head: 0.75 },
  unicorn: { weight: 1.05, stable: 0.55, head: 0.65 },
  bear: { weight: 1.0, stable: 0.6, head: 0.8 },
  fox: { weight: 0.95, stable: 0.45, head: 0.75 },
  penguin: { weight: 0.95, stable: 0.5, head: 0.85 },
  owl: { weight: 0.9, stable: 0.5, head: 0.85 },
  bunny: { weight: 0.85, stable: 0.3, head: 0.6 },
  cat: { weight: 0.85, stable: 0.4, head: 0.8 },
  pig: { weight: 0.9, stable: 0.55, head: 0.85 },
  duck: { weight: 0.8, stable: 0.35, head: 0.85 },
  capsule: { weight: 0.8, stable: 0.7, head: 1 },
};
const feelOf = (t: Toy) => FEEL[t.look.startsWith('capsule') ? 'capsule' : t.look] ?? FEEL.bear;

/** The real calendar day: the heap is tipped in fresh once a day. */
const today = (): string => new Date().toLocaleDateString('en-CA');

/** Where the claw starts every go, and goes back to after each one: right
 *  over the prize chute. */
const HOME = { x: CHUTE.x, z: CHUTE.z };
/** How far left the claw can go: over the chute. */
const CLAW_MIN_X = CHUTE.x;

/**
 * An animal for the heap, rarer the more it is worth: weight 1/value squared,
 * so a 10-cash duck turns up about nine times as often as a 30-cash unicorn.
 */
function pickPlush(): (typeof PLUSHIES)[number] {
  const pool = PLUSHIES.slice(1);
  const w = pool.map((d) => 1 / (d.value * d.value));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return pool[i];
  }
  return pool[0];
}

/** How far the prongs close round a toy they meet (0 = fully shut): the hooks hug it. */
const GRIP_SHUT = 0.38;
/**
 * A GRAB THAT DOES NOT HOLD STILL LIFTS IT.  The claw shuts on the toy and
 * carries it this far up off the heap before the thing slides out of the
 * prongs and drops back -- so a miss reads as a toy that was had and lost,
 * not as a claw that closed on nothing.
 */
const FUMBLE_LIFT = 26;
/**
 * NOTHING CAME UP.  Both cranes say the same thing in the same colour, from
 * here: a go that gives you nothing is not a loss to be announced, just a go
 * that gave you nothing, with the next one there to be had.  Neither machine
 * has its own wording or colour for it.
 */
const NO_PRIZE_TITLE = 'NO PRIZE';
const NO_PRIZE_COL = 0xffb050;

type Phase = 'pay' | 'aim' | 'opening' | 'lower' | 'wait' | 'shut' | 'up' | 'carry' | 'release' | 'result';

/** One heap in this many draws a Froggy in each spot: he is the rare one. */
const FROGGY_CHANCE = 0.012;

/** THE SIDE VIEW: the glass seen from its right-hand end.  Front of the
 *  machine on the left, back on the right, the floor along the bottom. */
const SIDE = { l: BOX.l + 34, r: BOX.r - 26, top: BOX.top + 12, floor: BOX.bottom - 10 };
const sideX = (z: number): number => SIDE.l + z * (SIDE.r - SIDE.l);
/** Front-view pixels at depth z, as side-view pixels: both measure the same
 *  drop from the gantry to the floor, so the claw meets a toy in both at once. */
const sideK = (z: number): number => (SIDE.floor - SIDE.top) / (floorY(z) - gantryY(z));

export class CraneGame extends Phaser.Scene {
  private kind: CraneKind = 'plush';
  private phase: Phase = 'aim';
  private clawX = HOME.x;
  private clawZ = HOME.z;
  private drop = 0;
  private vx = 0;
  private vz = 0;
  private sway = 0;
  /** Gliding back to HOME after a go. */
  private homing = false;
  private clock = CLOCK_S;
  /** The clock ran out this go: the claw drops and grabs by itself. */
  private timedOut = false;
  private toys: Toy[] = [];
  private held: Toy | null = null;
  private claw!: Phaser.GameObjects.Container;
  private cable!: Phaser.GameObjects.Rectangle;
  private bar!: Phaser.GameObjects.Rectangle;
  private motor!: Phaser.GameObjects.Container;
  private clockText!: Phaser.GameObjects.BitmapText;
  private result: Phaser.GameObjects.Container | null = null;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  /** Where the held prize was when the claw closed on it, and how long since. */
  private heldFrom = new Phaser.Math.Vector2();
  private heldT = 0;
  /** How far through the carry the prize slips out, or -1 if it holds. */
  private slipAt = -1;
  /**
   * A grab that did not hold: the drop the claw lifts the toy up to before
   * the fingers give and it falls back.  -1 when the claw has it properly.
   */
  private fumbleAt = -1;
  private carryFrom = new Phaser.Math.Vector2();
  /** How many Froggies this heap has (at most one). */
  private froggies = 0;
  private grabCue!: Phaser.GameObjects.BitmapText;
  private sideOn = false;
  private sideBox!: Phaser.GameObjects.Container;
  private sideToys!: Phaser.GameObjects.Container;
  private sideClaw!: Phaser.GameObjects.Container;
  private sideRig!: Phaser.GameObjects.Graphics;
  private sideHeld: Phaser.GameObjects.Image | null = null;
  private sideBtn: Phaser.GameObjects.Container | null = null;
  private marquee: Phaser.GameObjects.BitmapText[] = [];
  private sideTag: Phaser.GameObjects.BitmapText | null = null;
  /** The side view has been used this go: DROP is open. */

  constructor() {
    super('CraneGame');
  }

  private howTo: TutorialCard | null = null;

  init(data: { kind?: CraneKind } = {}): void {
    this.kind = data.kind === 'oddity' ? 'oddity' : 'plush';
  }

  create(): void {
    fadeIn(this);
    const eerie = this.kind === 'oddity';
    audio.setScene({ music: eerie ? 'lab_calm' : 'room_lounge', ambience: ['cabinet_bleeps'] });
    this.phase = 'aim';
    this.clawX = HOME.x;
    this.clawZ = HOME.z;
    this.homing = false;
    this.drop = 0;
    this.vx = this.vz = 0;
    this.held = null;
    this.result = null;
    this.toys = [];
    this.froggies = 0;
    this.sideOn = false;
    this.sideHeld = null;
    this.marquee = [];
    this.payPanel = null;

    this.paintCabinet(eerie);
    this.fillPile();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.saveGlass());
    this.paintChuteGlass(eerie);

    // the gantry: two rails, the bar across them, the motor block on the bar
    this.bar = this.add.rectangle(GAME_W / 2, gantryY(0.3), BOX.r - BOX.l - 8, 3, 0x8a96a6).setDepth(40);
    this.motor = this.add.container(0, 0).setDepth(41);
    const mbody = this.add.rectangle(0, 0, 14, 8, 0x5a7aa8).setStrokeStyle(1, 0x2a3a5a);
    this.motor.add([mbody, this.add.rectangle(0, -2, 10, 2, 0x8ab0e0), this.add.circle(-5, 3, 1.5, 0x2a3a5a), this.add.circle(5, 3, 1.5, 0x2a3a5a)]);
    this.cable = this.add.rectangle(0, 0, 1, 1, 0xb0b8c4).setOrigin(0.5, 0).setDepth(42);
    this.claw = this.add.container(0, 0).setDepth(43);
    this.drawClaw(false);
    this.buildSideView(eerie);
    this.grabCue = centerText(this, GAME_W / 2, BOX.top + 10, isTouch() ? 'TAP GRAB!' : 'PRESS SPACE TO GRAB!', PALETTE.gold).setDepth(65).setVisible(false);
    this.tweens.add({ targets: this.grabCue, alpha: 0.35, duration: 380, yoyo: true, repeat: -1 });

    this.clockText = text(this, CLOCK_X, 160, '', 0xff6a5a).setDepth(60);
    new TokenHud(this);
    button(this, QUIT_X, 10, 'QUIT', () => this.leave(true), { width: QUIT_W, height: 13, fill: 0x5a1a22 }).setDepth(70);
    // the view button: BACK in the side view, SIDE VIEW once you have
    // been there; hidden until then (the action button takes you the first time).
    // Clear of QUIT and the title plate, and the only view button on touch too:
    // a second one in the touch pad sat on top of DROP.
    // wide enough for FRONT VIEW, which is the longer of the two words it
    // carries: at 52 the F and the W hung over the ends of the button.
    this.sideBtn = button(this, VIEW_X, 10, 'SIDE VIEW', () => this.viewButton(), { width: VIEW_W, height: 13 }).setDepth(70);

    const kb = this.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    this.keys = {
      left: bind(['A', 'LEFT']),
      right: bind(['D', 'RIGHT']),
      drop: bind(['SPACE', 'E']),
    };
    kb?.on('keydown-ESC', () => !this.howTo && this.leave(true));
    // A press is DROP while aiming and GRAB once the claw has settled
    // (polling `isDown` in the loop misses a tap that goes down and up
    // between two frames; a key held down and auto-repeating is one press).
    const press = (e?: KeyboardEvent) => {
      if (e?.repeat) return;
      this.press();
    };
    kb?.on('keydown-SPACE', press);
    kb?.on('keydown-E', press);
    kb?.on('keydown-X', () => this.viewButton());
    kb?.on('keydown-V', () => this.viewButton());
    kb?.on('keydown-B', () => this.viewButton());
    // (no tap-on-the-glass drop: a tap meant for BACK that missed it
    // dropped the claw and grabbed)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => touchControls.relabel('SPACE', 'SIDE VIEW'));

    this.showHowTo();
    // (the touch layout is put up after create, which shows every button:
    // set them again once it is there)
    this.time.delayedCall(60, () => this.syncButtons());

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__crane = {
        state: () => ({
          phase: this.phase,
          clawX: this.clawX,
          clawZ: this.clawZ,
          drop: this.drop,
          toys: this.toys.length,
          held: this.held?.id ?? null,
        }),
        aim: (x: number, z = this.clawZ) => {
          this.clawX = Phaser.Math.Clamp(x, CLAW_MIN_X, PILE_R);
          this.clawZ = Phaser.Math.Clamp(z, 0, 1);
          this.vx = this.vz = 0;
        },
        /** DROP, or GRAB once it has settled: the button. */
        drop: () => this.press(),
        side: () => this.toggleSide(),
        view: () => this.viewButton(),
        buttons: () => ({ action: this.actionLabel(), view: this.viewLabel() }),
        /** The toy under the claw and where the fingertips are, on screen. */
        target: () => {
          const t = this.targetUnder();
          const k = scaleAt(this.clawZ);
          return {
            toy: t ? { x: t.x, z: t.z, sx: screenX(t.x, t.z), top: this.topOf(t) } : null,
            claw: { sx: screenX(this.clawX, this.clawZ), tips: gantryY(this.clawZ) + this.drop * k + FINGERS * k },
          };
        },
        toyAt: (i: number) => {
          const t = this.toys[i];
          return t ? { x: t.x, z: t.z } : null;
        },
        sideOn: () => this.sideOn,
        froggies: () => this.toys.filter((t) => t.id === PLUSHIES[0].id).length,
        home: () => ({ x: HOME.x, z: HOME.z }),
        setClock: (sec: number) => {
          this.clock = sec;
        },
      };
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => delete (window as unknown as Record<string, unknown>).__crane);
    }
  }

  // ------------------------------------------------------------- the picture

  /**
   * The cabinet you are stood at: a coloured frame, a lit marquee with the
   * machine's name across it, the glass box with its corner posts, the back
   * wall, and the control panel along the bottom with the stick, the buttons
   * and the clock.  The plush one is red and yellow and bright; the other is
   * dark violet, and its light is not well.
   */
  private paintCabinet(eerie: boolean): void {
    const frame = eerie ? 0x2a1640 : 0xc8283a;
    const trim = eerie ? 0x7a4aa8 : 0xffc830;
    const wall = eerie ? 0x120a1c : 0x1c2a48;
    this.add.rectangle(0, 0, GAME_W, GAME_H, eerie ? 0x08060c : 0x221a2e).setOrigin(0, 0);
    // the frame
    this.add.rectangle(BOX.l - 8, 2, BOX.r - BOX.l + 16, GAME_H - 4, frame).setOrigin(0, 0).setStrokeStyle(2, trim);
    // the marquee, with the name in lit letters
    // (narrow enough to leave room for SIDE VIEW and QUIT on its right)
    const MQ = PLATE_X; // in its own slot of the top bar, clear of the token readout and the buttons
    this.add.rectangle(MQ, 15, PLATE_W, 20, 0x0c0814).setStrokeStyle(1, trim);
    const name = eerie ? '? CAPSULES ?' : 'FROGGY GRAB!';
    const cols = eerie ? [0xc8a0e0, 0x8a6ab0] : [0xff4fa3, 0xffc830, 0x46c46e, 0x3fb8e8, 0xff7a3d, 0xa870e8];
    const w = name.length * 6;
    [...name].forEach((ch, i) => {
      if (ch === ' ') return;
      this.marquee.push(centerText(this, MQ - w / 2 + i * 6 + 3, 15, ch, cols[i % cols.length]));
    });
    // in the side view the plate says so (it used to be written across the
    // glass, where the claw went straight through it)
    this.sideTag = centerText(this, MQ, 15, 'SIDE VIEW', 0xffffff).setVisible(false);
    for (const sx of [MQ - 44, MQ + 44]) {
      const star = this.add.star(sx, 15, 4, 1.5, 4, eerie ? 0xc8a0e0 : 0xffe080);
      this.tweens.add({ targets: star, alpha: 0.3, duration: 500 + Math.random() * 300, yoyo: true, repeat: -1 });
    }
    // inside the glass: the back wall, lit from the top
    this.add.rectangle(BOX.l, BOX.top, BOX.r - BOX.l, BOX.bottom - BOX.top, wall).setOrigin(0, 0);
    this.add.rectangle(BOX.l, BOX.top, BOX.r - BOX.l, 22, 0xffffff, eerie ? 0.03 : 0.08).setOrigin(0, 0);
    // the floor of the machine, in depth
    const g = this.add.graphics();
    g.fillStyle(eerie ? 0x1a1024 : 0x2a3e66, 1);
    g.fillPoints([
      new Phaser.Math.Vector2(screenX(BOX.l, 0), floorY(0) + 6),
      new Phaser.Math.Vector2(screenX(BOX.r, 0), floorY(0) + 6),
      new Phaser.Math.Vector2(screenX(BOX.r, 1), floorY(1)),
      new Phaser.Math.Vector2(screenX(BOX.l, 1), floorY(1)),
    ], true);
    // the gantry rails along the top, front and back
    this.add.rectangle(GAME_W / 2, gantryY(0), BOX.r - BOX.l - 4, 2, 0x6a7686).setDepth(39);
    this.add.rectangle(GAME_W / 2, gantryY(1), BOX.r - BOX.l - 20, 2, 0x4a5666).setDepth(39);
    // the corner posts and their glints
    for (const x of [BOX.l + 1, BOX.r - 1]) {
      this.add.rectangle(x, BOX.top, 4, BOX.bottom - BOX.top, 0xc8d0dc).setOrigin(0.5, 0).setDepth(55);
      this.add.rectangle(x - 1, BOX.top, 1, BOX.bottom - BOX.top, 0xffffff, 0.6).setOrigin(0.5, 0).setDepth(55);
    }
    // glass streaks over the whole box
    for (const [x, w2] of [[96, 6], [106, 2], [270, 4]] as const) {
      this.add.rectangle(x, BOX.top + 4, w2, BOX.bottom - BOX.top - 8, 0xffffff, 0.06).setOrigin(0, 0).setAngle(8).setDepth(56);
    }
    // the control panel along the bottom
    this.add.rectangle(BOX.l - 6, BOX.bottom + 2, BOX.r - BOX.l + 12, GAME_H - BOX.bottom - 6, eerie ? 0x2a1a3a : 0xffc830).setOrigin(0, 0).setStrokeStyle(1, eerie ? 0x7a4aa8 : 0xb88a20).setDepth(58);
    const ink = eerie ? 0xc8a0e0 : 0x5a3a10;
    // the stick
    this.add.rectangle(42, 170, 14, 4, 0x2a2a2a).setDepth(59);
    this.add.rectangle(42, 164, 2, 10, 0x3a3a3a).setDepth(59);
    this.add.circle(42, 159, 4, 0xd8202a).setStrokeStyle(1, 0x7a1018).setDepth(59);
    // the buttons
    this.add.circle(68, 165, 5, 0x46c46e).setStrokeStyle(1, 0x2a7a44).setDepth(59);
    this.add.circle(84, 165, 5, 0xd8202a).setStrokeStyle(1, 0x7a1018).setDepth(59);
    this.credit = text(this, 100, 157, `CREDIT ${CRANE_COST[this.kind]}`, ink).setDepth(59);
    this.hint = text(this, 100, 168, '', ink).setDepth(59);
    // the clock window
    this.add.rectangle(CLOCK_X - 2, 158, 54, 14, 0x0c0814).setOrigin(0, 0).setStrokeStyle(1, 0x5a3a10).setDepth(59);
    if (eerie) {
      // the light in here is not well
      const dark = this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0).setOrigin(0, 0).setDepth(80);
      this.time.addEvent({
        delay: 120,
        loop: true,
        callback: () => dark.setAlpha(Math.random() < 0.08 ? 0.45 : Math.random() * 0.08),
      });
    }
  }

  /** The chute's own little glass wall, in front of the pile. */
  private paintChuteGlass(eerie: boolean): void {
    const top = floorY(0) - 46;
    this.add.rectangle(CHUTE.l, top, CHUTE.r - CHUTE.l, floorY(0) + 6 - top, 0x9fd4ff, 0.12).setOrigin(0, 0).setStrokeStyle(1, 0xc8e0ff, 0.6).setDepth(50);
    this.add.rectangle(CHUTE.l, top, CHUTE.r - CHUTE.l, 2, 0xc8e0ff, 0.6).setOrigin(0, 0).setDepth(50);
    centerText(this, (CHUTE.l + CHUTE.r) / 2, top - 6, 'PRIZE', eerie ? 0xc8a0e0 : PALETTE.gold).setDepth(50);
  }

  /**
   * THE PILE: fewer prizes than before, each half again as big, heaped close
   * -- three rows from the back to the front, three layers deep in the middle
   * -- so every toy is easy to see and to aim at, and still touches its
   * neighbours.
   */
  /**
   * The glass as it was left -- every toy where it lay, knocked over or not --
   * unless it is a new day, or the machine has been emptied, in which case
   * it is tipped in fresh.
   */
  private fillPile(): void {
    const saved = store.get().cranes[this.kind];
    if (saved && saved.day === today() && saved.toys.length > 0) {
      for (const st of saved.toys) this.toys.push(this.makeToy(st.x, st.z, st.lift, st));
      this.froggies = this.toys.filter((t) => t.id === PLUSHIES[0].id).length;
      // (a heap saved before it was built properly is made good, quietly)
      this.settle(false);
      return;
    }
    this.freshPile();
    this.saveGlass();
  }

  /** Keep the glass exactly as it is now. */
  private saveGlass(): void {
    const toys = this.toys.map((t) => ({ id: t.id, look: t.look, x: t.x, z: t.z, lift: t.lift, size: t.size, tilt: t.tilt, flip: t.flip, lean: t.lean }));
    store.patch({ cranes: { ...store.get().cranes, [this.kind]: { day: today(), toys } } });
  }

  /**
   * A fresh heap, built from the floor up (game/cranePile): the bottom layer
   * in staggered rows, and the ones on top only where something is really
   * under them -- across the glass AND in depth -- never at a height made
   * up for them.  Every view draws this one heap.
   */
  private freshPile(): void {
    const specs = generatePile({
      bounds: PILE_BOUNDS,
      body: bodyFor(this.kind === 'oddity' ? 'capsule' : 'plush', TOY_W, TOY_H),
      rows: PILE_ROWS,
      upper: 0.55,
      maxLift: MAX_LIFT,
      rnd: Math.random,
    });
    // back to front, bottom to top, so nearer and higher prizes are drawn over
    specs.sort((a, b) => b.z - a.z || a.lift - b.lift);
    for (const sp of specs) this.toys.push(this.makeToy(sp.x, sp.z, sp.lift));
  }

  /** A toy's body in the heap: its contact box, not its picture's canvas. */
  private bodyOf(t: Toy): PileBody {
    return { x: t.x, z: t.z, lift: t.lift, ...bodyFor(t.look.startsWith('capsule') ? 'capsule' : 'plush', TOY_W, TOY_H) };
  }

  /**
   * ---- THE HEAP SETTLES.  After anything is taken out of it, knocked about
   * or dropped back on it, every prize is checked from the bottom up and
   * anything left without support comes down onto what is under it, or
   * slides off an edge it was perched on -- chains of them in order.  Each
   * one that moves FALLS there (a short eased drop, both views following it)
   * unless `animate` is off (a heap being put back as it was saved).
   */
  private settle(animate = true): void {
    const bodies = this.toys.map((t) => this.bodyOf(t));
    const moved = settlePile(bodies, PILE_BOUNDS);
    for (const m of moved) {
      const t = this.toys[m.i];
      const from = t.anim ? { ...t.anim } : { x: t.x, z: t.z, lift: t.lift };
      t.x = m.x;
      t.z = m.z;
      t.lift = m.lift;
      if (animate) this.slideTo(t, from);
      else this.placeToy(t);
    }
    if (moved.length) {
      this.saveGlass();
      if (this.sideOn) this.fillSide();
    }
  }

  /** It drops (or slides) from `from` to where it now is: gravity, not a teleport. */
  private slideTo(t: Toy, from: { x: number; z: number; lift: number }): void {
    if (t.anim) this.tweens.killTweensOf(t.anim);
    const p = { ...from };
    t.anim = p;
    const fall = Math.max(0, from.lift - t.lift);
    const ms = Phaser.Math.Clamp(Math.sqrt(fall + Math.abs(from.x - t.x)) * 40, 120, 480);
    this.tweens.add({
      targets: p,
      x: t.x,
      z: t.z,
      lift: t.lift,
      duration: ms,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        const k = scaleAt(p.z);
        t.art.setPosition(screenX(p.x, p.z), floorY(p.z) - p.lift * k).setScale(k).setDepth(this.toyDepth(p.z, p.lift));
      },
      onComplete: () => {
        t.anim = undefined;
        this.placeToy(t);
      },
    });
  }

  /** Over any toy at the claw's depth or further back, however high it is piled. */
  private clawDepth(): number {
    return this.toyDepth(this.clawZ, 80) + 0.2;
  }

  private toyDepth(z: number, lift: number): number {
    return 10 + (1 - z) * 20 + lift * 0.05;
  }

  private placeToy(t: Toy): void {
    const k = scaleAt(t.z);
    t.art.setPosition(screenX(t.x, t.z), floorY(t.z) - t.lift * k).setScale(k).setDepth(this.toyDepth(t.z, t.lift)).setAngle(t.lean);
  }

  private makeToy(x: number, z: number, lift: number, saved?: SavedToy): Toy {
    const c = this.add.container(0, 0);
    let id = 'capsule';
    let key: string;
    let look: string;
    // drawn at the size it sits at, a little bigger or smaller than the next
    // one and a little tumbled: they were tipped in, not arranged
    const size = saved ? saved.size : scaleAt(z) * Phaser.Math.FloatBetween(0.96, 1.04);
    const tilt = saved ? saved.tilt : Phaser.Math.Between(-2, 2) * 3;
    if (saved) {
      id = saved.id;
      look = saved.look;
      key = toyTexture(this, look as Parameters<typeof toyTexture>[1], size, tilt);
    } else if (this.kind === 'plush') {
      // Froggy is the rare one: a small chance at each spot, and never more
      // than one in a heap
      const froggy = this.froggies < 1 && Math.random() < FROGGY_CHANCE;
      if (froggy) this.froggies++;
      const def = froggy ? PLUSHIES[0] : pickPlush();
      id = def.id;
      look = plushKind(def.id);
      key = toyTexture(this, plushKind(def.id), size, tilt);
    } else {
      look = `capsule-${Phaser.Math.Between(0, CAPSULE_VARIANTS - 1)}`;
      key = toyTexture(this, look as `capsule-${number}`, size, tilt);
    }
    // stood on its feet (its bottom edge), a little tumbled, a little bigger
    // or smaller than the next one: they were tipped in, not arranged
    // (shown at 1 / its drawn size inside a container scaled by the depth: one
    // texel to one pixel)
    const drawn = Math.round(size * 25) / 25;
    const img = this.add.image(0, 0, key).setOrigin(0.5, 1).setScale(1 / drawn).setData('drawn', drawn);
    const flip = saved ? saved.flip : Math.random() < 0.5 && this.kind === 'plush';
    // (never mirrored: the front drawing is the front, the way it was sewn)
    // THE DEPTH.  A soft contact shadow where it sits, on the floor or on the
    // toys under it; and the light falls off into the pile -- the further back
    // and the further down a toy is, the more it is in the shade of the rest.
    c.add(this.add.ellipse(0, -1, 34, 8, 0x000000, lift > 0 ? 0.28 : 0.38));
    // (gently: shaded too far, the back of the heap was a brown blur)
    const light = Phaser.Math.Clamp(1 - z * 0.18 - (lift < 6 ? 0.06 : 0) + lift * 0.003, 0.74, 1);
    const v = Math.round(255 * light);
    img.setTint(Phaser.Display.Color.GetColor(v, v, Math.min(255, v + 8)));
    c.add(img);
    const t: Toy = { id, x, z, lift, art: c, look, size, tilt, flip, lean: saved?.lean ?? 0 };
    this.placeToy(t);
    return t;
  }

  /**
   * THE CLAW: a hub on the cable, and three prongs -- one each side and one
   * at the back -- each bent at a knuckle and hooked at the tip.  Open, the
   * side prongs stand out wider than a toy's head; shut, the hooks meet
   * under it.  `open` is 1 for open, 0 for shut, anything between while it
   * closes.  Drawn big enough that what it closes on is visibly inside it.
   */
  private drawClaw(open: boolean | number, into: Phaser.GameObjects.Container = this.claw): void {
    const v = typeof open === 'number' ? Phaser.Math.Clamp(open, 0, 1) : open ? 1 : 0;
    this.clawOpen = v;
    into.removeAll(true);
    const steel = 0xc8d0dc;
    const dark = 0x5a6676;
    // the hub: a housing with a collar where the cable goes in
    into.add(this.add.rectangle(0, -1, 6, 3, 0x6a7686).setStrokeStyle(1, 0x3a4656));
    into.add(this.add.rectangle(0, 2.5, 14, 6, 0x9aa6b6).setStrokeStyle(1, 0x4a5666));
    into.add(this.add.rectangle(0, 2, 12, 1, 0xd8e0ea));
    // the back prong, behind the others: straight down, hooked forward
    into.add(this.add.line(0, 0, 0, 5, 0, 20, dark).setLineWidth(1.6).setOrigin(0, 0));
    // the side prongs: shoulder, knuckle, tip
    const knee = 5 + 8 * v; // how far out the knuckle stands
    const tip = 2 + 8 * v; // and the hook
    for (const sx of [-1, 1]) {
      into.add(this.add.line(0, 0, sx * 5, 5, sx * knee, 14, steel).setLineWidth(2).setOrigin(0, 0));
      into.add(this.add.line(0, 0, sx * knee, 14, sx * tip, 21, steel).setLineWidth(2).setOrigin(0, 0));
      // the hooked tip, turned in
      into.add(this.add.rectangle(sx * tip - sx * 1, 21, 3, 2, steel).setStrokeStyle(0.6, dark));
      // the knuckle pin
      into.add(this.add.circle(sx * knee, 14, 1.1, 0x8a96a6));
    }
    if (into === this.claw && this.sideClaw) this.drawClaw(v, this.sideClaw);
  }

  private clawOpen = 1;

  /** Close (or open) the claw over `ms`, drawn as it goes. */
  private moveClaw(to: number, ms: number, done?: () => void): void {
    const from = this.clawOpen;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      ease: 'Quad.easeOut',
      onUpdate: (tw) => this.drawClaw(from + (to - from) * (tw.getValue() ?? 1)),
      onComplete: () => done?.(),
    });
  }

  // ------------------------------------------------------------------ a go

  private payPanel: Phaser.GameObjects.Container | null = null;

  /**
   * PAY FIRST.  Walking up to the machine starts nothing: it asks for its
   * tokens, and the clock does not run until they are in.  No tokens (or no
   * free pocket for a prize), and it says so and does not start at all.
   */
  /** The how-to-play card, first thing, before a token is asked for. */
  private showHowTo(): void {
    this.phase = 'pay';
    const cost = CRANE_COST[this.kind];
    const layout = touchLayoutFor('CraneGame');
    this.howTo = showTutorial(this, {
      title: this.kind === 'oddity' ? 'ODDITY CRANE' : 'PLUSH CRANE',
      tutorial: { objective: deviceObjective(HOW_TO[this.kind], layout), controls: deviceControls(HOW_TO_KEYS, layout) },
      cost,
      balance: ledger.balance(),
      payNote: 'WIN: THE PRIZE YOU DROP IN THE CHUTE',
      onPlay: () => {
        this.howTo = null;
        this.askToPay();
        this.pay();
      },
      onLeave: () => {
        this.howTo = null;
        this.leave(true);
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.howTo?.destroy());
  }

  private askToPay(): void {
    this.phase = 'pay';
    this.clockText.setText(`TIME ${CLOCK_S}`);
    if (pocketsFull()) {
      this.showResult(FULL_LINE, PALETTE.ember, false);
      return;
    }
    const cost = CRANE_COST[this.kind];
    if (!ledger.canAfford(cost)) {
      this.showResult(`${cost} TOKENS TO PLAY - NOT ENOUGH TOKENS`, PALETTE.ember, false);
      return;
    }
    const c = this.add.container(0, 0).setDepth(90);
    c.add(this.add.rectangle(GAME_W / 2, 92, 210, 62, PALETTE.ink, 0.95).setStrokeStyle(1, PALETTE.gold));
    c.add(centerText(this, GAME_W / 2, 74, `${cost} TOKENS A GO`, PALETTE.gold));
    c.add(centerText(this, GAME_W / 2, 86, `you have ${ledger.balance()}`, PALETTE.fog));
    c.add(button(this, GAME_W / 2 - 46, 106, `INSERT ${cost}`, () => this.pay(), { width: 76, height: 13 }));
    c.add(button(this, GAME_W / 2 + 46, 106, 'LEAVE', () => this.leave(true), { width: 60, height: 13 }));
    this.payPanel = c;
    this.syncButtons();
  }

  /** The tokens go in -- once -- and only then does the go (and the clock) start. */
  private pay(): void {
    if (this.phase !== 'pay' || !this.payPanel) return;
    this.payPanel.destroy();
    this.payPanel = null;
    this.startGo();
  }

  /** Take the tokens for a go. */
  private startGo(): void {
    if (pocketsFull()) {
      this.showResult(FULL_LINE, PALETTE.ember, false);
      return;
    }
    if (!ledger.debit(CRANE_COST[this.kind], 'crane')) {
      this.showResult('NOT ENOUGH TOKENS', PALETTE.ember, false);
      return;
    }
    audio.sfx('coin_drop');
    this.phase = 'aim';
    // shut while it is being lined up: it opens when it is sent down
    this.drawClaw(false);
    this.outcome = null;
    this.slipAt = -1;
    this.fumbleAt = -1;
    // every go starts at the first step: line it up from the front
    if (this.sideOn) this.toggleSide();
    this.clock = CLOCK_S;
    this.timedOut = false;
    this.drop = 0;
    this.syncButtons();
  }

  /**
   * The action button, one step at a time, every go:
   *   FRONT VIEW  -- move left and right; the button says SIDE VIEW
   *   SIDE VIEW   -- set the depth; the button says DROP, and only here
   *   dropped     -- the button says GRAB
   * Nothing drops or grabs from the front view, and changing view never does
   * anything by itself.
   */
  private press(): void {
    if (this.howTo) return;
    if (this.phase === 'pay') return this.pay();
    if (this.phase === 'aim') {
      if (!this.sideOn) this.toggleSide();
      else this.beginLower();
    } else if (this.phase === 'lower') {
      // GRABBING EARLY.  You do not have to let it settle: press again on the
      // way down and the fingers close where they are.  Catch a toy standing
      // proud of the heap on the way past and it is yours; close too high and
      // they shut on air, which is the gamble.
      this.shut(true);
    } else if (this.phase === 'wait' && this.sideOn) this.shut();
  }

  /** The view button: back to the front from the side.  That starts the sequence over. */
  private viewButton(): void {
    if (this.phase !== 'aim') return;
    if (this.sideOn) {
      this.toggleSide();
      this.syncButtons();
    }
  }

  private actionLabel(): string {
    if (this.phase === 'aim') return this.sideOn ? 'DROP' : 'SIDE VIEW';
    // on the way down as well as settled: the fingers can shut at any height
    if (this.phase === 'wait' || this.phase === 'lower') return 'GRAB';
    if (this.phase === 'pay') return 'INSERT';
    return '...';
  }

  /** '' when the view button is not shown. */
  private viewLabel(): string {
    if (this.phase !== 'aim') return '';
    return this.sideOn ? 'FRONT VIEW' : '';
  }

  /** Put every button's label and visibility right for where the go is. */
  private syncButtons(): void {
    const view = this.viewLabel();
    touchControls.relabel('SPACE', this.actionLabel());
    if (this.sideBtn) {
      this.sideBtn.setVisible(!!view);
      this.sideBtn.list.forEach((o) => {
        if (o instanceof Phaser.GameObjects.BitmapText) o.setText(view || 'SIDE VIEW');
      });
    }
    // two short lines, so neither runs into the clock window
    const move = this.phase === 'aim' ? `  ${isTouch() ? '' : 'A/D '}${this.sideOn ? 'DEPTH' : 'MOVE'}` : '';
    this.credit?.setText(`CREDIT ${CRANE_COST[this.kind]}${move}`);
    this.hint?.setText(this.hintLine());
  }

  private hint: Phaser.GameObjects.BitmapText | null = null;
  private credit: Phaser.GameObjects.BitmapText | null = null;

  /** The control panel's second line: the button, and what it does now. */
  private hintLine(): string {
    const key = isTouch() ? '' : 'SPACE: ';
    if (this.phase === 'wait') return `${key}GRAB`;
    if (this.phase === 'pay') return `${key}INSERT ${CRANE_COST[this.kind]} TOKENS`;
    if (this.phase !== 'aim') return '';
    return `${key}${this.sideOn ? 'DROP' : 'SIDE VIEW'}`;
  }

  /** From wherever it is, carrying the way it was going. */
  private beginLower(): void {
    // only from the side view: never from the front
    if (this.phase !== 'aim' || !this.sideOn) return;
    // FIRST it opens, where it hangs -- the prongs swinging out wide, plainly
    // -- and only then goes down
    this.phase = 'opening';
    audio.sfx('lock_click', 0.5);
    this.syncButtons();
    this.moveClaw(1, 420, () => {
      if (this.phase !== 'opening') return;
      this.phase = 'lower';
      audio.sfx('ui_blip');
      // the button says GRAB from here down: it can be shut at any height
      this.syncButtons();
    });
    // (it stays in the side view: the drop and the grab are watched from there)
  }

  /** GRAB: the claw closes on whatever it has settled on. */
  private shut(early = false): void {
    if (this.phase !== (early ? 'lower' : 'wait')) return;
    this.phase = 'shut';
    this.grabCue.setVisible(false);
    audio.sfx('door_shut', 0.25);
    this.syncButtons();
    // the prongs swing in round whatever is under them -- stopping where
    // they meet it (a toy between the hooks), or all the way on nothing --
    // then a beat as it takes the grip, and it grabs
    const on = this.targetUnder();
    this.moveClaw(on ? GRIP_SHUT : 0, 380, () => this.time.delayedCall(220, () => this.grab(early)));
  }

  /** The screen y of the top of a toy's head. */
  private topOf(t: Toy): number {
    return floorY(t.z) - (t.lift + TOY_H * 0.72) * scaleAt(t.z);
  }

  /**
   * THE TOY THE CLAW IS OVER: of the toys within the claw's reach, the one
   * whose head is highest -- the one the fingers meet first coming down.  The
   * drop stops on it and the grab closes on it, so what the claw comes down
   * on is what it picks up.
   */
  private targetUnder(): Toy | null {
    let best: Toy | null = null;
    for (const t of this.toys) {
      if (Math.abs(t.x - this.clawX) >= REACH_X || Math.abs(t.z - this.clawZ) >= REACH_Z) continue;
      if (!best || this.topOf(t) < this.topOf(best)) best = t;
    }
    return best;
  }

  /**
   * How far down the claw goes, in its own units (`drawRig` scales the drop
   * by the depth once -- this used to be in screen pixels and got scaled
   * again, so the further back you aimed the higher above the toy it stopped).
   * The fingertips come down a little over the target's head, or to the
   * floor if there is nothing under it.
   */
  private floorUnder(): number {
    const k = scaleAt(this.clawZ);
    const t = this.targetUnder();
    // (the open prongs come down either side of its head, a third of the way down it)
    const y = t ? this.topOf(t) + 15 * scaleAt(t.z) : floorY(this.clawZ);
    return (y - gantryY(this.clawZ)) / k - FINGERS;
  }

  update(_t: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    const held = (g: string) => this.keys[g]?.some((k) => k.isDown) ?? false;
    if (this.phase === 'aim') {
      // LEFT and RIGHT only: along the gantry from the front, and -- the side
      // view has the front of the machine on the left -- in and out of it
      // from the side
      const lr = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
      const ix = this.sideOn ? 0 : lr;
      const iz = this.sideOn ? lr : 0;
      // a little weight to it: it eases into a move and out of one
      this.vx += (ix * MOVE_X - this.vx) * Math.min(1, dt * 8);
      this.vz += (iz * MOVE_Z - this.vz) * Math.min(1, dt * 8);
      this.clawX = Phaser.Math.Clamp(this.clawX + this.vx * dt, CLAW_MIN_X, PILE_R);
      this.clawZ = Phaser.Math.Clamp(this.clawZ + this.vz * dt, 0, 1);
      this.clock -= dt;
      this.clockText.setText(`TIME ${Math.max(0, Math.ceil(this.clock))}`);
      // the clock running out drops it, wherever it is -- and grabs (below)
      if (this.clock <= 0) {
        this.timedOut = true;
        this.beginLower();
      }
    } else if (this.phase === 'lower') {
      // the way it was going carries it on a little, and dies away
      this.clawX = Phaser.Math.Clamp(this.clawX + this.vx * dt, CLAW_MIN_X, PILE_R);
      this.clawZ = Phaser.Math.Clamp(this.clawZ + this.vz * dt, 0, 1);
      this.vx *= Math.exp(-dt * 3.5);
      this.vz *= Math.exp(-dt * 3.5);
      this.clock -= dt;
      this.clockText.setText(`TIME ${Math.max(0, Math.ceil(this.clock))}`);
      if (this.clock <= 0) this.timedOut = true;
      this.drop += LOWER * dt;
      const bottom = Math.min(MAX_DROP, this.floorUnder());
      if (this.drop >= bottom) {
        // settled on the pile, open: it waits there for GRAB -- or, out of
        // time, it shuts on its own a beat after it lands
        this.drop = bottom;
        this.phase = 'wait';
        this.disturb();
        this.vx = this.vz = 0;
        this.grabCue.setVisible(true);
        this.syncButtons();
        audio.sfx('ui_blip', 0.5);
        if (this.timedOut) this.time.delayedCall(300, () => this.shut());
      }
    } else if (this.phase === 'wait') {
      // the clock does not stop for it: run it out here and it grabs
      if (!this.timedOut) {
        this.clock -= dt;
        this.clockText.setText(`TIME ${Math.max(0, Math.ceil(this.clock))}`);
        if (this.clock <= 0) {
          this.timedOut = true;
          this.shut();
        }
      }
    } else if (this.phase === 'up') {
      this.drop -= RAISE * dt;
      // Lifted clear of the heap: it hangs there a moment, tilting in the
      // prongs -- you have it -- and then they give.
      if (this.fumbleAt >= 0 && this.held && this.drop <= this.fumbleAt) {
        this.fumbleAt = -1;
        const slipping = this.held;
        this.tweens.add({ targets: slipping.art, angle: slipping.lean + 18, duration: 300, ease: 'Sine.easeIn' });
        this.time.delayedCall(320, () => {
          if (this.held === slipping) this.loseGrip('missed');
        });
      }
      if (this.drop <= 0) {
        this.drop = 0;
        // held or not, back to the chute: that is where a go ends -- watched
        // from the front, where the chute is (the drop and grab are done)
        this.phase = 'carry';
        this.carryFrom.set(this.clawX, this.clawZ);
        if (this.sideOn) this.toggleSide();
      }
    } else if (this.phase === 'carry') {
      // over to the chute, front left
      const dx = CHUTE.x - this.clawX;
      const dz = CHUTE.z - this.clawZ;
      if (this.held && this.slipAt >= 0) {
        const all = Math.max(1, Math.abs(CHUTE.x - this.carryFrom.x));
        if (1 - Math.abs(dx) / all >= this.slipAt) {
          this.slipAt = -1;
          this.loseGrip('slipped');
        }
      }
      this.clawX += Math.sign(dx) * Math.min(Math.abs(dx), 80 * dt);
      this.clawZ += Math.sign(dz) * Math.min(Math.abs(dz), 1 * dt);
      if (Math.abs(dx) < 0.5 && Math.abs(dz) < 0.01) {
        this.phase = 'release';
        // the prongs swing open over the chute and it drops
        this.moveClaw(1, 320);
        const t = this.held;
        if (t) {
          this.tweens.add({ targets: t.art, y: floorY(0) + 4, duration: 260, ease: 'Quad.easeIn' });
        }
        this.time.delayedCall(320, () => {
          this.payOut();
          // and home again, so the next go starts where every go starts
          this.homing = true;
        });
      }
    }
    if (this.homing) {
      const dx = HOME.x - this.clawX;
      const dz = HOME.z - this.clawZ;
      this.clawX += Math.sign(dx) * Math.min(Math.abs(dx), 80 * dt);
      this.clawZ += Math.sign(dz) * Math.min(Math.abs(dz), 1 * dt);
      if (Math.abs(dx) < 0.5 && Math.abs(dz) < 0.01) {
        this.clawX = HOME.x;
        this.clawZ = HOME.z;
        this.homing = false;
      }
    }
    // the swing on the cable, more the faster it went
    this.sway = Math.sin(this.time.now / 160) * Math.min(2.5, Math.abs(this.vx) / 25 + this.drop / 80);
    this.drawRig();
    if (this.sideOn) this.drawSide();
    if (this.held && this.phase !== 'release') {
      const k = scaleAt(this.clawZ);
      const hx = screenX(this.clawX, this.clawZ) + this.sway;
      // hanging from the closed claw by its head
      // its head between the closed prongs: the hooks under its chin
      const hy = gantryY(this.clawZ) + (this.drop + 9 * CLAW_K + TOY_H * 0.74) * k;
      // from where it lay into the claw's fingers, over a moment, not a snap
      this.heldT = Math.min(1, this.heldT + dt / 0.3);
      const e = this.heldT * this.heldT * (3 - 2 * this.heldT);
      this.held.art
        .setPosition(Phaser.Math.Linear(this.heldFrom.x, hx, e), Phaser.Math.Linear(this.heldFrom.y, hy, e))
        .setScale(k)
        .setDepth(this.clawDepth() - 0.005);
    }
  }

  private drawRig(): void {
    const k = scaleAt(this.clawZ);
    const gy = gantryY(this.clawZ);
    const sx = screenX(this.clawX, this.clawZ);
    this.bar.setPosition(GAME_W / 2, gy).setScale(1 - this.clawZ * 0.1, 1);
    this.motor.setPosition(sx, gy).setScale(k * CLAW_K);
    const tipY = gy + this.drop * k;
    this.cable.setPosition(sx, gy + 2).setSize(1, Math.max(1, tipY - gy));
    this.claw.setPosition(sx + this.sway, tipY + 4 * CLAW_K).setScale(k * CLAW_K);
    // In the pile at its own depth: over every toy as far back as it is or
    // further, under the ones nearer the glass -- so it goes down INTO the
    // heap, behind the front row, instead of being pasted over all of it.
    const d = this.clawDepth();
    this.claw.setDepth(d);
    this.cable.setDepth(d - 0.01);
  }

  /** The claw shuts.  What it comes up with depends on the machine. */
  private grab(early = false): void {
    // Shut on the way down, the fingers only have what they have reached: the
    // tips level with the toy's head or below.  Let it settle and they are
    // always there, so a settled grab is judged exactly as it always was.
    const under = this.targetUnder();
    const k = scaleAt(this.clawZ);
    const tips = gantryY(this.clawZ) + (this.drop + FINGERS) * k;
    const best = under && (!early || tips >= this.topOf(under)) ? under : null;
    if (best) {
      // dead centre is the best grip there is; at the edge of the claw it
      // is just over half that
      const off = Math.max(Math.abs(best.x - this.clawX) / REACH_X, Math.abs(best.z - this.clawZ) / REACH_Z);
      // WHERE the fingers closed: square over it, round the fat body; off to
      // the side, round the head -- which slides out more easily.  And how
      // heavy it is: the claw's grip is the same for everything.
      const feel = feelOf(best);
      const onBody = off < 0.4 && Math.abs(best.lean) < 30;
      const part = onBody ? 1.12 : feel.head;
      const odds = Phaser.Math.Clamp((GRIP[this.kind] * (1 - OFF_CENTRE[this.kind] * Math.min(1, off)) * part) / feel.weight, 0.02, 0.95);
      if (Math.random() < odds) {
        this.banner('GOT IT!', 0x8ae88a, onBody ? 'ROUND THE BODY' : 'ONLY BY THE HEAD...');
        audio.sfx('lock_click', 0.6);
        this.held = best;
        this.heldFrom.set(best.art.x, best.art.y);
        this.heldT = 0;
        this.toys = this.toys.filter((t) => t !== best);
        // what it was holding up comes down as it is lifted away
        this.time.delayedCall(150, () => this.settle());
        // and some of what comes up does not make it to the chute
        // heavier toys, and toys held by the head, slip more often
        const slip = SLIP[this.kind] * feel.weight * (onBody ? 0.85 : 1.35);
        this.slipAt = Math.random() < slip ? 0.25 + Math.random() * 0.5 : -1;
      } else {
        // IT HAS IT, AND THEN IT HAS NOT.  The prongs close on it and the
        // claw lifts it clear of the heap -- you watch it come up -- and only
        // then does it slide out of them and drop back.  (`fumbleAt` is the
        // drop it gets to before the fingers give: the lift happens in the
        // 'up' phase, where everything else the claw carries is drawn.)
        this.held = best;
        this.heldFrom.set(best.art.x, best.art.y);
        this.heldT = 0;
        this.toys = this.toys.filter((t) => t !== best);
        this.time.delayedCall(150, () => this.settle());
        this.fumbleAt = Math.max(0, this.drop - FUMBLE_LIFT);
        this.slipAt = -1;
        audio.sfx('lock_click', 0.45);
      }
    }
    else {
      // (nothing said here: the result box at the end of the go says it)
      this.outcome = 'empty';
    }
    this.saveGlass();
    this.phase = 'up';
  }

  /**
   * IT COMES OUT OF THE FINGERS AND DROPS BACK onto the pile, wherever the
   * claw has got to: either straight off the heap, a grab that never really
   * held (`missed`), or halfway to the chute (`slipped`).  The one fall for
   * both, so a dropped prize always lands and settles the same way.
   */
  private loseGrip(why: 'missed' | 'slipped'): void {
    const t = this.held;
    if (!t) return;
    this.held = null;
    this.dropSideHeld();
    this.outcome = why;
    // the prongs give -- they spring open -- and it drops out of them
    // (no banner: the one result box at the end of the go says how it went)
    this.moveClaw(0.85, 160);
    audio.sfx('door_shut', 0.15);
    t.x = Phaser.Math.Clamp(this.clawX, PILE_BOUNDS.l + 8, PILE_BOUNDS.r - 8);
    t.z = Phaser.Math.Clamp(this.clawZ, PILE_BOUNDS.zMin, PILE_BOUNDS.zMax);
    // it lands where the heap under it will really hold it -- on top of what
    // it falls on, or off the edge of it and down
    const place = restPlace(this.bodyOf(t), this.toys.map((o) => this.bodyOf(o)), PILE_BOUNDS);
    t.x = place.x;
    t.z = place.z;
    t.lift = place.lift;
    this.toys.push(t);
    this.fall(t, why === 'slipped');
  }

  /**
   * ---- A DROPPED PRIZE FALLS.  Out of the fingers, down into the glass, and
   * it lands -- it is never set down where it ends up.  It picks up speed the
   * whole way (a real fall, not an eased slide), turns as it goes, squashes
   * where it lands, bounces once, and rocks to a stop.  How far it has to
   * fall sets how long it takes, so a prize lost over the pile drops in a
   * moment and one lost up at the gantry takes its time coming down.
   */
  private fall(t: Toy, tumbling: boolean): void {
    const k = scaleAt(t.z);
    const art = t.art;
    const y0 = art.y;
    const x1 = screenX(t.x, t.z);
    const y1 = floorY(t.z) - t.lift * k;
    const drop = Math.max(0, y1 - y0);
    // t = sqrt(2h/g): twice the height is not twice the time
    const ms = Phaser.Math.Clamp(Math.sqrt(drop) * 44, 160, 620);
    const spin = (tumbling ? 28 : 16) * (Math.random() < 0.5 ? -1 : 1) * (1 - feelOf(t).stable * 0.5);
    const land = Phaser.Math.Clamp(t.lean + spin, -60, 60);
    art.setDepth(this.toyDepth(t.z, t.lift) + 0.3);
    this.tweens.add({
      targets: art,
      x: x1,
      y: y1,
      scale: k,
      angle: land,
      duration: ms,
      ease: 'Quad.easeIn',
      onComplete: () => {
        audio.sfx('door_shut', 0.1);
        // it lands on its side, gives under itself, and rocks to a stop
        const squash = Phaser.Math.Clamp(drop / 180, 0.08, 0.22);
        this.tweens.add({
          targets: art,
          scaleX: k * (1 + squash),
          scaleY: k * (1 - squash),
          duration: 70,
          yoyo: true,
          ease: 'Quad.easeOut',
        });
        this.tweens.add({
          targets: art,
          y: y1 - Math.min(9, drop * 0.09),
          duration: 150,
          yoyo: true,
          ease: 'Quad.easeOut',
          delay: 60,
          onComplete: () => {
            t.lean = land;
            this.placeToy(t);
            this.saveGlass();
            this.settle();
          },
        });
        this.tweens.add({
          targets: art,
          angle: land + (spin > 0 ? -7 : 7),
          duration: 120,
          yoyo: true,
          repeat: 1,
          ease: 'Sine.easeInOut',
        });
      },
    });
  }

  /**
   * THE CLAW HITS THE HEAP.  Coming down, its frame and fingers shove what is
   * round the toy it is landing on: away from it sideways, a little back, and
   * -- unless it is a big steady one -- tipped over.  Light toys go further.
   */
  private disturb(): void {
    const target = this.targetUnder();
    for (const t of this.toys) {
      if (t === target) continue;
      const dx = t.x - this.clawX;
      const dz = t.z - this.clawZ;
      if (Math.abs(dx) > 24 || Math.abs(dz) > 0.2) continue;
      const near = 1 - Math.abs(dx) / 24;
      this.knock(t, Math.sign(dx) || 1, near);
    }
    // the target itself is nudged by an off-centre landing
    if (target) {
      const off = target.x - this.clawX;
      if (Math.abs(off) > 3) this.knock(target, Math.sign(off), 0.35);
    }
    // and whatever was shoved off its support comes down once the shove is done
    this.time.delayedCall(380, () => this.settle());
  }

  /** Push one toy `dir` (+1 right, -1 left), `force` 0..1. */
  private knock(t: Toy, dir: number, force: number): void {
    const feel = feelOf(t);
    let push = (7 * force) / feel.weight;
    // shoved, but not INTO a neighbour beside it: it stops against it
    const me = this.bodyOf(t);
    for (const o of this.toys) {
      if (o === t || Math.abs(o.lift - t.lift) > me.h / 2 || Math.abs(o.z - t.z) > me.hz * 2) continue;
      const gap = dir > 0 ? o.x - t.x : t.x - o.x;
      if (gap > 0) push = Math.min(push, Math.max(0, gap - me.hw * 2 * (1 - 0.3)));
    }
    t.x = Phaser.Math.Clamp(t.x + dir * push, PILE_L + 8, PILE_R - 8);
    t.z = Phaser.Math.Clamp(t.z + (Math.random() - 0.5) * 0.05 * force, 0.1, 0.95);
    const tip = (1 - feel.stable) * 40 * force;
    if (tip > 4) t.lean = Phaser.Math.Clamp(t.lean + dir * tip, -70, 70);
    const k = scaleAt(t.z);
    this.tweens.add({
      targets: t.art,
      x: screenX(t.x, t.z),
      y: floorY(t.z) - t.lift * k,
      angle: t.lean,
      duration: 220 + 140 * force,
      ease: 'Back.easeOut',
      onComplete: () => this.placeToy(t),
    });
  }

  /** How the go ended, if not with a prize: for the result to say why. */
  private outcome: 'missed' | 'slipped' | 'empty' | null = null;
  private bannerBox: Phaser.GameObjects.Container | null = null;
  /**
   * GOT IT!, big and plain across the top of the glass, with a smaller line
   * under it.  Only the win is called out as it happens: a go that comes to
   * nothing is not announced over the glass, it is simply told by the one NO
   * PRIZE box at the end, so a loss is never reported twice.
   */
  private banner(msg: string, col: number, sub = ''): void {
    this.bannerBox?.destroy();
    const c = this.add.container(GAME_W / 2, BOX.top + 22).setDepth(70);
    const t = centerText(this, 0, 0, msg, col, 16);
    const w = Math.max(t.width, sub.length * 6) + 16;
    c.add(this.add.rectangle(0, sub ? 4 : 0, w, sub ? 30 : 20, PALETTE.ink, 0.92).setStrokeStyle(1, col));
    c.add(t);
    if (sub) c.add(centerText(this, 0, 13, sub, PALETTE.cream));
    c.setScale(0.6);
    this.tweens.add({ targets: c, scale: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({ targets: c, alpha: 0, delay: 1400, duration: 400, onComplete: () => c.destroy() });
    this.bannerBox = c;
  }

  private payOut(): void {
    const t = this.held;
    this.held = null;
    this.drawClaw(false);
    // it is out of the machine: gone from both views, nothing left behind
    if (t) {
      this.tweens.killTweensOf(t.art);
      t.art.destroy();
    }
    this.dropSideHeld();
    if (!t) {
      const why = this.outcome === 'slipped' ? 'IT SLIPPED ON THE WAY' : this.outcome === 'missed' ? 'THE CLAW LOST ITS GRIP' : 'THE CLAW CAME UP EMPTY';
      this.showResult(`YOU GOT NOTHING - ${why}.`, NO_PRIZE_COL, true, undefined, NO_PRIZE_TITLE);
      return;
    }
    if (this.kind === 'plush') {
      const def = itemDef(t.id);
      if (def && addItem(def.id)) {
        audio.sfx('chime');
        this.showResult(`YOU GOT A ${def.name}!`, PALETTE.gold, true, def.id, 'YOU WIN!');
      } else {
        this.showResult(FULL_LINE, PALETTE.ember, true);
      }
      return;
    }
    // a capsule: open it.  There are always tokens in it.
    const cap = rollCapsule();
    ledger.credit(cap.tokens, 'crane');
    audio.sfx('cha_ching');
    const coins = `${cap.tokens} TOKEN${cap.tokens === 1 ? '' : 'S'}`;
    if (cap.oddity) {
      // and something else, under them
      const def = ODDITIES[Phaser.Math.Between(0, ODDITIES.length - 1)];
      if (addItem(def.id)) {
        audio.sfx('chime');
        this.showResult(`${cap.jackpot ? 'JACKPOT!  ' : cap.lucky ? 'LUCKY!  ' : ''}${coins} + ${def.name}`, 0xc8a0e0, true, def.id, 'YOU WIN!');
        return;
      }
    }
    this.showResult(cap.jackpot ? `JACKPOT!  ${coins}` : cap.lucky ? `LUCKY CAPSULE!  ${coins}` : `INSIDE: ${coins}`, PALETTE.gold, true, undefined, 'YOU WIN!');
  }

  private showResult(line: string, colour: number, played: boolean, itemId?: string, title?: string): void {
    this.phase = 'result';
    this.result?.destroy();
    const c = this.add.container(0, 0).setDepth(90);
    c.add(this.add.rectangle(GAME_W / 2, 92, 230, 70, PALETTE.ink, 0.95).setStrokeStyle(1, colour));
    // WIN or LOSE, big, over the panel
    if (title) {
      const tt = centerText(this, GAME_W / 2, 50, title, colour, 16);
      c.add(this.add.rectangle(GAME_W / 2, 50, tt.width + 14, 20, PALETTE.ink, 0.95).setStrokeStyle(1, colour));
      c.add(tt);
      tt.setScale(0.5);
      this.tweens.add({ targets: tt, scale: 1, duration: 260, ease: 'Back.Out' });
      if (title === 'YOU WIN!') this.tweens.add({ targets: tt, alpha: 0.6, duration: 420, yoyo: true, repeat: -1, delay: 300 });
    }
    c.add(centerText(this, GAME_W / 2, itemId ? 104 : 80, line, colour).setMaxWidth(220));
    if (itemId) {
      const d = itemDef(itemId);
      // a plush is shown as the toy itself, the one that came out of the pile
      if (d?.kind === 'plush') c.add(this.add.image(GAME_W / 2, 99, toyTexture(this, plushKind(d.id))).setOrigin(0.5, 1));
      else if (d) c.add(drawItem(this, GAME_W / 2, 92, d, 1.6));
    }
    const cost = CRANE_COST[this.kind];
    if (played) {
      c.add(button(this, GAME_W / 2 - 51, 116, `TRY AGAIN - ${cost}`, () => this.again(), { width: 90, height: 13 }));
    }
    c.add(button(this, GAME_W / 2 + (played ? 54 : 0), 116, 'LEAVE', () => this.leave(true), { width: 60, height: 13 }));
    this.result = c;
  }

  // ---------------------------------------------------------- the side view

  /**
   * The glass from its right-hand end: the front of the machine (the chute,
   * where the player stands) on the left and the back wall on the right, the
   * pile at its real depths and heights, and the claw at its own depth and
   * drop.  Toys in the claw's left-right lane are drawn solid; the rest of the
   * heap is a faint ghost behind them, so it is plain what the claw will come
   * down on.
   */
  private buildSideView(eerie: boolean): void {
    const c = this.add.container(0, 0).setDepth(57).setVisible(false);
    const wall = eerie ? 0x120a1c : 0x1c2a48;
    c.add(this.add.rectangle(BOX.l, BOX.top, BOX.r - BOX.l, BOX.bottom - BOX.top, wall).setOrigin(0, 0));
    c.add(this.add.rectangle(BOX.l, BOX.top, BOX.r - BOX.l, 18, 0xffffff, eerie ? 0.03 : 0.07).setOrigin(0, 0));
    // the floor, the front glass and the back wall, end on
    c.add(this.add.rectangle(BOX.l, SIDE.floor, BOX.r - BOX.l, BOX.bottom - SIDE.floor, eerie ? 0x1a1024 : 0x2a3e66).setOrigin(0, 0));
    c.add(this.add.rectangle(SIDE.l - 10, BOX.top, 2, BOX.bottom - BOX.top, 0xc8e0ff, 0.5).setOrigin(0.5, 0));
    c.add(this.add.rectangle(SIDE.r + 10, BOX.top, 3, BOX.bottom - BOX.top, 0x4a5666).setOrigin(0.5, 0));
    // the gantry rail, the length of the machine
    c.add(this.add.rectangle(sideX(0), SIDE.top - 4, sideX(1) - sideX(0) + 16, 2, 0x8a96a6).setOrigin(0, 0.5).setX(sideX(0) - 8));
    // depth marks along the floor, a quarter of the machine apart
    for (let q = 0; q <= 4; q++) {
      const x = sideX(q / 4);
      c.add(this.add.rectangle(x, SIDE.floor + 1, 1, 4, 0xffffff, 0.35).setOrigin(0.5, 0));
    }
    c.add(text(this, SIDE.l - 6, BOX.bottom - 9, 'FRONT', PALETTE.gold).setOrigin(0, 0.5));
    c.add(text(this, SIDE.r + 6, BOX.bottom - 9, 'REAR', PALETTE.gold).setOrigin(1, 0.5));
    this.sideToys = this.add.container(0, 0);
    c.add(this.sideToys);
    this.sideRig = this.add.graphics();
    c.add(this.sideRig);
    this.sideClaw = this.add.container(0, 0);
    c.add(this.sideClaw);
    this.sideBox = c;
    this.drawClaw(false, this.sideClaw);
  }

  private toggleSide(): void {
    if (this.phase === 'result') return;
    this.sideOn = !this.sideOn;
    // a move in one view does not carry on into the other's axis
    this.vx = this.vz = 0;
    this.sideBox.setVisible(this.sideOn);
    for (const m of this.marquee) m.setVisible(!this.sideOn);
    this.sideTag?.setVisible(this.sideOn);
    audio.sfx('ui_blip', 0.4);
    if (this.sideOn) this.fillSide();
    this.syncButtons();
  }

  /**
   * ---- THE PILE, END ON.
   *
   * The side view looks down the machine's width: left to right is DEPTH,
   * and the whole width of the glass is squashed into the one picture.  A
   * toy's height up the heap cannot be carried over from the front view --
   * what it is resting on there is very often at another x, which is off to
   * one side of this picture entirely, and the toy came out hanging in mid
   * air over nothing with its support nowhere to be seen.
   *
   * So the heap is PACKED AGAIN for this view, in depth only: lowest first,
   * each toy set down on the highest thing already standing where it would
   * land.  Every toy keeps its depth -- which is the one thing this view
   * exists to show -- and the pile is a pile, with nothing floating and
   * nothing here that is not in the glass.
   */
  /**
   * ---- THE SAME HEAP, END ON.
   *
   * Nothing is placed for this view: each prize is drawn where it IS -- its
   * depth along the floor, its height up the heap -- with its own profile
   * drawing at that depth's scale.  Looking in from the right-hand end, the
   * prizes further right in the glass are nearer you, so they are drawn
   * over the ones further left; at the same place, the higher over the lower.
   */
  private fillSide(): void {
    // (the prize in the claw is not part of the heap and keeps its own image)
    this.sideToys.removeAll(true);
    const order = [...this.toys].sort((a, b) => a.x - b.x || a.lift - b.lift);
    for (const t of order) {
      const drawn = Math.round(t.size * 25) / 25;
      const key = toyTexture(this, t.look as Parameters<typeof toyTexture>[1], drawn, 0, 'side');
      const img = this.add.image(0, 0, key).setOrigin(0.5, 1).setData('toy', t).setData('drawn', drawn);
      this.placeSide(img, t);
      this.sideToys.add(img);
    }
  }

  /** Where a prize is in the side view: straight from the heap (or its fall, mid-fall). */
  private placeSide(img: Phaser.GameObjects.Image, t: Toy): void {
    const p = t.anim ?? t;
    const k = scaleAt(p.z) * sideK(p.z);
    img.setPosition(sideX(p.z), SIDE.floor - p.lift * k).setScale(k / (img.getData('drawn') as number));
  }

  private drawSide(): void {
    const k = scaleAt(this.clawZ) * sideK(this.clawZ);
    const x = sideX(this.clawZ);
    const tip = SIDE.top + this.drop * k;
    // THE HEAP BEHIND THE LANE.  The toys are scattered through the whole
    // depth of the glass, so end on they already read as one pile: the claw's
    // own lane is drawn in full and the rest of it dimmed behind, each toy
    // its own shape.  (Nothing is blocked in behind them: a slab drawn under
    // the heap to fill the gaps showed up as plain rectangles behind the
    // round capsules in the dark machine.)
    const lane: Phaser.GameObjects.Image[] = [];
    for (const o of [...this.sideToys.list] as Phaser.GameObjects.Image[]) {
      const t = o.getData('toy') as Toy;
      if (!this.toys.includes(t)) {
        // taken out of the machine: its picture goes with it
        o.destroy();
        continue;
      }
      // (a prize settling is seen coming down here too)
      this.placeSide(o, t);
      if (Math.abs(t.x - this.clawX) < 22) {
        o.setVisible(true).setAlpha(1).clearTint();
        lane.push(o);
      } else o.setVisible(true).setAlpha(0.55).setTint(0x7482a0);
    }
    // the claw's lane drawn over the profile, lowest first
    lane
      .sort((a, b) => (a.getData('toy') as Toy).x - (b.getData('toy') as Toy).x || b.y - a.y)
      .forEach((o) => this.sideToys.bringToTop(o));
    const g = this.sideRig;
    g.clear();
    // the carriage on the rail, the cable down, and a guide straight down from
    // the claw to the floor so you can see where it will land
    g.fillStyle(0x5a7aa8, 1).fillRect(x - 7, SIDE.top - 8, 14, 7);
    g.fillStyle(0xb0b8c4, 1).fillRect(x, SIDE.top - 1, 1, Math.max(1, tip - SIDE.top + 4));
    g.fillStyle(PALETTE.gold, 0.55);
    for (let y = tip + 22 * k; y < SIDE.floor; y += 5) g.fillRect(x, y, 1, 2);
    g.fillStyle(PALETTE.gold, 0.8).fillTriangle(x - 4, SIDE.floor + 6, x + 4, SIDE.floor + 6, x, SIDE.floor + 1);
    this.sideClaw.setPosition(x, tip + 4 * CLAW_K * k).setScale(k * CLAW_K);
    // a held prize hangs from it here too
    if (this.held && this.phase !== 'release') {
      if (!this.sideHeld) {
        const src = this.held.art.list[1] as Phaser.GameObjects.Image;
        const drawn = (src.getData('drawn') as number) || 1;
        this.sideHeld = this.add.image(0, 0, toyTexture(this, this.held.look as Parameters<typeof toyTexture>[1], drawn, 0, 'side')).setOrigin(0.5, 1).setData('drawn', drawn);
        this.sideBox.add(this.sideHeld);
      }
      this.sideHeld.setPosition(x, tip + (10 * CLAW_K + TOY_H * 0.8) * k).setScale(k / (this.sideHeld.getData('drawn') as number)).setVisible(true);
    } else this.dropSideHeld();
  }

  /** The side view's picture of the prize in the claw, gone with it. */
  private dropSideHeld(): void {
    this.sideHeld?.destroy();
    this.sideHeld = null;
  }

  private again(): void {
    // emptied: the attendant tips a fresh heap in
    if (this.toys.length === 0) {
      this.freshPile();
      this.saveGlass();
    }
    if (pocketsFull()) {
      this.showResult(FULL_LINE, PALETTE.ember, false);
      return;
    }
    if (!ledger.canAfford(CRANE_COST[this.kind])) {
      this.showResult('NOT ENOUGH TOKENS', PALETTE.ember, false);
      return;
    }
    this.result?.destroy();
    this.result = null;
    // (a go always starts from home, even if it is not quite back yet)
    this.homing = false;
    this.clawX = HOME.x;
    this.clawZ = HOME.z;
    this.vx = this.vz = 0;
    this.drop = 0;
    this.drawClaw(false);
    this.startGo();
  }

  /** QUIT, LEAVE or Esc: back to the room.  A go already paid for is spent. */
  private leave(force = false): void {
    if (!force && this.phase !== 'aim' && this.phase !== 'result') return;
    fadeToScene(this, 'ArcadeLounge', { atProp: this.kind });
  }
}
