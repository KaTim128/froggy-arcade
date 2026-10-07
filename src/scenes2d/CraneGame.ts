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
import { CAPSULE_VARIANTS, TOY_H, TOY_RES, plushKind, toyTexture } from '../art/craneToys';
import { FULL_LINE, ODDITIES, PLUSHIES, addItem, itemDef, pocketsFull } from '../game/inventory';
import { isTouch } from '../core/device';
import { touchControls } from '../ui/touchControls';

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

/** The inside of the machine, in the cabinet's picture. */
const BOX = { l: 14, r: 306, top: 26, bottom: 150 };
/** Where the pile is: left/right in pixels, back/forth 0 (front) to 1 (back). */
const PILE_L = 84;
const PILE_R = 292;
/** The prize chute, front left, behind its own little glass wall. */
const CHUTE = { x: 46, z: 0.05, l: 20, r: 72 };
const CLOCK_S = 25;
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
const REACH_X = 9;
const REACH_Z = 0.1;
/** From the claw's hanging point down to its fingertips, in claw units. */
const FINGERS = 19 * TOY_RES;

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
}

/** Where the claw starts every go, and goes back to after each one: right
 *  over the prize chute. */
const HOME = { x: CHUTE.x, z: CHUTE.z };
/** How far left the claw can go: over the chute. */
const CLAW_MIN_X = CHUTE.x;

type Phase = 'aim' | 'lower' | 'wait' | 'shut' | 'up' | 'carry' | 'release' | 'result';

/** One heap in this many draws a Froggy in each spot: he is the rare one. */
const FROGGY_CHANCE = 0.03;

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
  /** The side view has been used this go: DROP is open. */
  private viewedSide = false;

  constructor() {
    super('CraneGame');
  }

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

    this.paintCabinet(eerie);
    this.fillPile();
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

    this.clockText = text(this, 246, 160, '', 0xff6a5a).setDepth(60);
    new TokenHud(this);
    button(this, GAME_W - 24, 10, 'QUIT', () => this.leave(true), { width: 40, height: 13, fill: 0x5a1a22 }).setDepth(70);
    // the view button: BACK in the side view, SIDE VIEW once you have
    // been there; hidden until then (the action button takes you the first time)
    this.sideBtn = button(this, 245, 10, 'SIDE VIEW', () => this.viewButton(), { width: 60, height: 13 }).setDepth(70);

    const kb = this.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    this.keys = {
      left: bind(['A', 'LEFT']),
      right: bind(['D', 'RIGHT']),
      drop: bind(['SPACE', 'E']),
    };
    kb?.on('keydown-ESC', () => this.leave(true));
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
    // a tap on the glass does the same
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      // not a press on a button (AGAIN starts a go on the same press)
      if (!over.length && p.y > BOX.top && p.y < BOX.bottom) this.press();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      touchControls.relabel('SPACE', 'SIDE VIEW');
      touchControls.showButton('X', true);
    });

    this.startGo();
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
    this.add.rectangle(GAME_W / 2 - 6, 15, 116, 20, 0x0c0814).setStrokeStyle(1, trim);
    const name = eerie ? '? CAPSULES ?' : 'FROGGY GRAB!';
    const cols = eerie ? [0xc8a0e0, 0x8a6ab0] : [0xff4fa3, 0xffc830, 0x46c46e, 0x3fb8e8, 0xff7a3d, 0xa870e8];
    const w = name.length * 6;
    [...name].forEach((ch, i) => {
      if (ch === ' ') return;
      centerText(this, GAME_W / 2 - 6 - w / 2 + i * 6 + 3, 15, ch, cols[i % cols.length]);
    });
    for (const sx of [GAME_W / 2 - 56, GAME_W / 2 + 44]) {
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
    text(this, 100, 157, `CREDIT ${CRANE_COST[this.kind]}`, ink).setDepth(59);
    this.hint = text(this, 100, 168, '', ink).setDepth(59);
    // the clock window
    this.add.rectangle(244, 158, 54, 14, 0x0c0814).setOrigin(0, 0).setStrokeStyle(1, 0x5a3a10).setDepth(59);
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
  private fillPile(): void {
    const rows = 3;
    const layers = 3;
    const specs: Array<{ x: number; z: number; lift: number }> = [];
    for (let layer = 0; layer < layers; layer++) {
      for (let r = 0; r < rows; r++) {
        const z = 0.85 - r * 0.3;
        const step = 30 + layer * 4;
        for (let x = PILE_L + 14 + (r % 2) * 14 + layer * 12; x < PILE_R - 12 - layer * 12; x += step) {
          // the heap is taller in the middle than at the edges
          const mid = 1 - Math.abs((x - (PILE_L + PILE_R) / 2) / ((PILE_R - PILE_L) / 2));
          if (layer > 0 && Math.random() > 0.2 + mid * 0.8 - (layer - 1) * 0.25) continue;
          specs.push({ x: x + Phaser.Math.Between(-3, 3), z: z + Phaser.Math.FloatBetween(-0.04, 0.04), lift: layer * 18 + Phaser.Math.Between(0, 3) });
        }
      }
    }
    // back to front, bottom to top, so nearer and higher prizes are drawn over
    specs.sort((a, b) => b.z - a.z || a.lift - b.lift);
    for (const sp of specs) this.toys.push(this.makeToy(sp.x, sp.z, sp.lift));
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
    t.art.setPosition(screenX(t.x, t.z), floorY(t.z) - t.lift * k).setScale(k).setDepth(this.toyDepth(t.z, t.lift));
  }

  private makeToy(x: number, z: number, lift: number): Toy {
    const c = this.add.container(0, 0);
    let id = 'capsule';
    let key: string;
    if (this.kind === 'plush') {
      // Froggy is the rare one: a small chance at each spot, and never more
      // than one in a heap
      const froggy = this.froggies < 1 && Math.random() < FROGGY_CHANCE;
      if (froggy) this.froggies++;
      const def = froggy ? PLUSHIES[0] : PLUSHIES[Phaser.Math.Between(1, PLUSHIES.length - 1)];
      id = def.id;
      key = toyTexture(this, plushKind(def.id));
    } else {
      key = toyTexture(this, `capsule-${Phaser.Math.Between(0, CAPSULE_VARIANTS - 1)}`);
    }
    // stood on its feet (its bottom edge), a little tumbled, a little bigger
    // or smaller than the next one: they were tipped in, not arranged
    const img = this.add.image(0, 0, key).setOrigin(0.5, 1);
    img.setAngle(Phaser.Math.Between(-8, 8)).setScale(Phaser.Math.FloatBetween(0.95, 1.03));
    if (Math.random() < 0.5 && this.kind === 'plush') img.setFlipX(true);
    // THE DEPTH.  A soft contact shadow where it sits, on the floor or on the
    // toys under it; and the light falls off into the pile -- the further back
    // and the further down a toy is, the more it is in the shade of the rest.
    c.add(this.add.ellipse(0, -1, 34, 8, 0x000000, lift > 0 ? 0.28 : 0.38));
    const light = Phaser.Math.Clamp(1 - z * 0.32 - (lift < 6 ? 0.1 : 0) + lift * 0.004, 0.55, 1);
    const v = Math.round(255 * light);
    img.setTint(Phaser.Display.Color.GetColor(v, v, Math.min(255, v + 8)));
    c.add(img);
    const t: Toy = { id, x, z, lift, art: c };
    this.placeToy(t);
    return t;
  }

  private drawClaw(shut: boolean, into: Phaser.GameObjects.Container = this.claw): void {
    into.removeAll(true);
    // the head, the prongs, and the hooked tips
    into.add(this.add.rectangle(0, 0, 10, 5, 0x9aa6b6).setStrokeStyle(1, 0x4a5666));
    into.add(this.add.rectangle(0, 3, 4, 2, 0x6a7686));
    const o = shut ? 2.5 : 7;
    for (const sx of [-1, 1]) {
      into.add(this.add.line(0, 0, sx * 2, 3, sx * o, 11, 0xc8d0dc).setLineWidth(1.6).setOrigin(0, 0));
      into.add(this.add.line(0, 0, sx * o, 11, sx * (o - 3), 15, 0xc8d0dc).setLineWidth(1.6).setOrigin(0, 0));
    }
    into.add(this.add.line(0, 0, 0, 3, 0, 13, 0xc8d0dc).setLineWidth(1.4).setOrigin(0, 0));
    if (into === this.claw && this.sideClaw) this.drawClaw(shut, this.sideClaw);
  }

  // ------------------------------------------------------------------ a go

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
    // every go starts at the first step: line it up from the front
    this.viewedSide = false;
    if (this.sideOn) this.toggleSide();
    this.clock = CLOCK_S;
    this.timedOut = false;
    this.drop = 0;
    this.syncButtons();
  }

  /**
   * The action button.  Aiming: SIDE VIEW the first time (into the side
   * view), DROP once you have been there.  Settled: GRAB.  Anything else --
   * lowering, coming up, carrying -- it does nothing.
   */
  private press(): void {
    if (this.phase === 'aim') {
      if (!this.viewedSide && !this.sideOn) this.toggleSide();
      else this.beginLower();
    } else if (this.phase === 'wait') this.shut();
  }

  /** The view button: BACK from the side view; SIDE VIEW again from the front. */
  private viewButton(): void {
    if (this.phase !== 'aim') return;
    if (this.sideOn || this.viewedSide) this.toggleSide();
  }

  private actionLabel(): string {
    if (this.phase === 'aim') return this.viewedSide || this.sideOn ? 'DROP' : 'SIDE VIEW';
    if (this.phase === 'wait') return 'GRAB';
    return '...';
  }

  /** '' when the view button is not shown. */
  private viewLabel(): string {
    if (this.phase !== 'aim') return '';
    return this.sideOn ? 'BACK' : this.viewedSide ? 'SIDE VIEW' : '';
  }

  /** Put every button's label and visibility right for where the go is. */
  private syncButtons(): void {
    const view = this.viewLabel();
    touchControls.relabel('SPACE', this.actionLabel());
    touchControls.relabel('X', view || 'BACK');
    touchControls.showButton('X', !!view);
    if (this.sideBtn) {
      this.sideBtn.setVisible(!!view);
      this.sideBtn.list.forEach((o) => {
        if (o instanceof Phaser.GameObjects.BitmapText) o.setText(view || 'SIDE VIEW');
      });
    }
    this.hint?.setText(this.hintLine());
  }

  private hint: Phaser.GameObjects.BitmapText | null = null;

  /** The control panel's second line: what to do now. */
  private hintLine(): string {
    const key = isTouch() ? '' : 'SPACE: ';
    if (this.phase === 'wait') return `${key}GRAB`;
    if (this.phase !== 'aim') return '';
    if (this.sideOn) return `${isTouch() ? '' : 'A/D '}FRONT/REAR  ${key}DROP`;
    return `${isTouch() ? '' : 'A/D '}LEFT/RIGHT  ${key}${this.viewedSide ? 'DROP' : 'SIDE VIEW'}`;
  }

  /** From wherever it is, carrying the way it was going. */
  private beginLower(): void {
    if (this.phase !== 'aim') return;
    this.phase = 'lower';
    audio.sfx('ui_blip');
    // the drop is watched from the front
    if (this.sideOn) this.toggleSide();
    this.syncButtons();
  }

  /** GRAB: the claw closes on whatever it has settled on. */
  private shut(): void {
    if (this.phase !== 'wait') return;
    this.phase = 'shut';
    this.grabCue.setVisible(false);
    this.drawClaw(true);
    audio.sfx('door_shut', 0.25);
    this.syncButtons();
    this.time.delayedCall(350, () => this.grab());
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
    const y = t ? this.topOf(t) + 6 * scaleAt(t.z) : floorY(this.clawZ);
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
      if (this.drop <= 0) {
        this.drop = 0;
        // held or not, back to the chute: that is where a go ends
        this.phase = 'carry';
        this.carryFrom.set(this.clawX, this.clawZ);
      }
    } else if (this.phase === 'carry') {
      // over to the chute, front left
      const dx = CHUTE.x - this.clawX;
      const dz = CHUTE.z - this.clawZ;
      if (this.held && this.slipAt >= 0) {
        const all = Math.max(1, Math.abs(CHUTE.x - this.carryFrom.x));
        if (1 - Math.abs(dx) / all >= this.slipAt) {
          this.slipAt = -1;
          this.slip();
        }
      }
      this.clawX += Math.sign(dx) * Math.min(Math.abs(dx), 80 * dt);
      this.clawZ += Math.sign(dz) * Math.min(Math.abs(dz), 1 * dt);
      if (Math.abs(dx) < 0.5 && Math.abs(dz) < 0.01) {
        this.phase = 'release';
        this.drawClaw(false);
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
      const hy = gantryY(this.clawZ) + (this.drop + 10 * CLAW_K + TOY_H * 0.8) * k;
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
  private grab(): void {
    const best = this.targetUnder();
    if (best) {
      // dead centre is the best grip there is; at the edge of the claw it
      // is just over half that
      const off = Math.max(Math.abs(best.x - this.clawX) / REACH_X, Math.abs(best.z - this.clawZ) / REACH_Z);
      const odds = GRIP[this.kind] * (1 - OFF_CENTRE[this.kind] * Math.min(1, off));
      if (Math.random() < odds) {
        this.held = best;
        this.heldFrom.set(best.art.x, best.art.y);
        this.heldT = 0;
        this.toys = this.toys.filter((t) => t !== best);
        // and some of what comes up does not make it to the chute
        this.slipAt = Math.random() < SLIP[this.kind] ? 0.25 + Math.random() * 0.5 : -1;
      } else {
        // it closes on it, lifts it a fraction, and lets it go
        this.tweens.add({ targets: best.art, y: '-=4', duration: 140, yoyo: true });
      }
    }
    this.phase = 'up';
  }

  /**
   * The prize slips out of the fingers on the way over and drops back onto
   * the pile, wherever the claw is.
   */
  private slip(): void {
    const t = this.held;
    if (!t) return;
    this.held = null;
    this.drawClaw(false);
    audio.sfx('door_shut', 0.15);
    t.x = this.clawX;
    t.z = Phaser.Math.Clamp(this.clawZ, 0.25, 0.95);
    let lift = 0;
    for (const o of this.toys) {
      if (Math.abs(o.x - t.x) < 16 && Math.abs(o.z - t.z) < 0.2) lift = Math.max(lift, o.lift + 18);
    }
    t.lift = Math.min(lift, 40);
    const k = scaleAt(t.z);
    this.toys.push(t);
    this.tweens.add({
      targets: t.art,
      x: screenX(t.x, t.z),
      y: floorY(t.z) - t.lift * k,
      scale: k,
      duration: 380,
      ease: 'Bounce.easeOut',
      onComplete: () => this.placeToy(t),
    });
  }

  private payOut(): void {
    const t = this.held;
    this.held = null;
    this.drawClaw(false);
    if (t) t.art.destroy();
    if (!t) {
      this.showResult(this.kind === 'plush' ? 'IT SLIPPED RIGHT OUT.  NOTHING.' : 'NOTHING.', PALETTE.ash, true);
      return;
    }
    if (this.kind === 'plush') {
      const def = itemDef(t.id);
      if (def && addItem(def.id)) {
        audio.sfx('chime');
        this.showResult(`YOU GOT A ${def.name}!`, PALETTE.gold, true, def.id);
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
        this.showResult(`${cap.jackpot ? 'JACKPOT!  ' : cap.lucky ? 'LUCKY!  ' : ''}${coins} + ${def.name}`, 0xc8a0e0, true, def.id);
        return;
      }
    }
    this.showResult(cap.jackpot ? `JACKPOT!  ${coins}` : cap.lucky ? `LUCKY CAPSULE!  ${coins}` : `INSIDE: ${coins}`, PALETTE.gold, true);
  }

  private showResult(line: string, colour: number, played: boolean, itemId?: string): void {
    this.phase = 'result';
    this.result?.destroy();
    const c = this.add.container(0, 0).setDepth(90);
    c.add(this.add.rectangle(GAME_W / 2, 92, 230, 70, PALETTE.ink, 0.95).setStrokeStyle(1, colour));
    c.add(centerText(this, GAME_W / 2, itemId ? 104 : 80, line, colour).setMaxWidth(220));
    if (itemId) {
      const d = itemDef(itemId);
      // a plush is shown as the toy itself, the one that came out of the pile
      if (d?.kind === 'plush') c.add(this.add.image(GAME_W / 2, 99, toyTexture(this, plushKind(d.id))).setOrigin(0.5, 1));
      else if (d) c.add(drawItem(this, GAME_W / 2, 92, d, 1.6));
    }
    const cost = CRANE_COST[this.kind];
    if (played) {
      c.add(button(this, GAME_W / 2 - 46, 116, `AGAIN - ${cost}`, () => this.again(), { width: 76, height: 13 }));
    }
    c.add(button(this, GAME_W / 2 + (played ? 46 : 0), 116, 'LEAVE', () => this.leave(true), { width: 60, height: 13 }));
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
    c.add(centerText(this, GAME_W / 2, BOX.top + 22, 'SIDE VIEW', 0xffffff).setAlpha(0.5));
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
    if (this.sideOn) this.viewedSide = true;
    // a move in one view does not carry on into the other's axis
    this.vx = this.vz = 0;
    this.sideBox.setVisible(this.sideOn);
    audio.sfx('ui_blip', 0.4);
    if (this.sideOn) this.fillSide();
    this.syncButtons();
  }

  /** The pile, end on: every toy at its depth and height, back to front. */
  private fillSide(): void {
    this.sideToys.removeAll(true);
    this.sideHeld = null;
    for (const t of this.toys) {
      const k = scaleAt(t.z) * sideK(t.z);
      const src = t.art.list[1] as Phaser.GameObjects.Image;
      const img = this.add.image(sideX(t.z), SIDE.floor - t.lift * k, src.texture.key).setOrigin(0.5, 1).setScale(k * 0.95);
      img.setData('toy', t);
      this.sideToys.add(img);
    }
    // the lower ones first, so a toy on top is drawn over the one it sits on
    this.sideToys.sort('y', (a: Phaser.GameObjects.Image, b: Phaser.GameObjects.Image) => (b.y - a.y) || 0);
  }

  private drawSide(): void {
    const k = scaleAt(this.clawZ) * sideK(this.clawZ);
    const x = sideX(this.clawZ);
    const tip = SIDE.top + this.drop * k;
    // the lane the claw is over, solid; the rest of the heap, a ghost
    const lane: Phaser.GameObjects.Image[] = [];
    for (const o of [...this.sideToys.list] as Phaser.GameObjects.Image[]) {
      const t = o.getData('toy') as Toy;
      if (!this.toys.includes(t)) {
        o.setVisible(false);
        continue;
      }
      if (Math.abs(t.x - this.clawX) < 22) {
        o.setAlpha(1).clearTint();
        lane.push(o);
      } else o.setAlpha(0.18).setTint(0x404a60);
    }
    // the claw's lane drawn over the ghosts, lowest first
    lane.sort((a, b) => b.y - a.y).forEach((o) => this.sideToys.bringToTop(o));
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
        this.sideHeld = this.add.image(0, 0, src.texture.key).setOrigin(0.5, 1);
        this.sideBox.add(this.sideHeld);
      }
      this.sideHeld.setPosition(x, tip + (10 * CLAW_K + TOY_H * 0.8) * k).setScale(k * 0.95).setVisible(true);
    } else if (this.sideHeld) {
      this.sideHeld.destroy();
      this.sideHeld = null;
    }
  }

  private again(): void {
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
