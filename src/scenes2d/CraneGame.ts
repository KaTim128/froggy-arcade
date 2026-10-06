/**
 * ---- THE CLAW MACHINES.  The fourth room's two cranes, played up close.
 *
 * You are stood at the cabinet, looking in through the glass at a machine
 * piled to the top with prizes.  The claw rides a gantry in two directions:
 * left and right, and back and forth into the machine (it gets smaller the
 * further back it goes).  HOLD DROP to lower it, let go to stop it; it goes
 * down from wherever it is and drifts a little the way it was travelling.
 * When it touches the pile it shuts, comes up, and carries whatever it is
 * holding to the chute at the front.  When the clock runs out it lowers on
 * its own.  QUIT leaves at any time.
 *
 *   PLUSH CRANE (5 tokens).  Animal plushies, and a Froggy or two.  It is a
 *   real claw machine's claw: a weak grip, and it holds one time in twenty.
 *
 *   THE OTHER ONE (3 tokens).  Capsules, in the dark, under a flickering
 *   light.  It never misses -- the claw always comes up with a capsule -- but
 *   most of them are empty.  Five in a hundred hold ten tokens, one in a
 *   hundred holds a golden ticket worth ten more, and a few hold something
 *   that should not be in a toy machine at all, which the man outside will
 *   pay a great deal for.
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
import { FULL_LINE, ODDITIES, PLUSHIES, addItem, itemDef, pocketsFull } from '../game/inventory';
import { isTouch } from '../core/device';

export type CraneKind = 'plush' | 'oddity';

export const CRANE_COST: Record<CraneKind, number> = { plush: 5, oddity: 3 };

/**
 * What a capsule from the dark crane holds, in order: the chance of each,
 * and the rest is an empty capsule.  The two ten-token results are separate
 * on purpose -- a plain ten, and the rare golden ticket.
 */
export const ODDITY_TABLE: Array<{ what: 'tokens' | 'golden' | 'oddity'; chance: number }> = [
  { what: 'tokens', chance: 0.05 },
  { what: 'golden', chance: 0.01 },
  { what: 'oddity', chance: 0.03 },
];

/** A capsule's contents, off one roll. */
export function rollCapsule(r = Math.random()): 'tokens' | 'golden' | 'oddity' | 'nothing' {
  let acc = 0;
  for (const row of ODDITY_TABLE) {
    acc += row.chance;
    if (r < acc) return row.what;
  }
  return 'nothing';
}

/** The inside of the machine, in the cabinet's picture. */
const BOX = { l: 32, r: 288, top: 30, bottom: 148 };
/** Where the pile is: left/right in pixels, back/forth 0 (front) to 1 (back). */
const PILE_L = 84;
const PILE_R = 280;
/** The prize chute, front left, behind its own little glass wall. */
const CHUTE = { x: 56, z: 0.05, l: 36, r: 76 };
const CLOCK_S = 15;
/** How far the claw can be let down, in pixels below the gantry. */
const MAX_DROP = 104;
const MOVE_X = 70;
const MOVE_Z = 0.85;
const LOWER = 60;
const RAISE = 70;
/** The plush crane holds one time in twenty.  The other one always does. */
export const GRIP: Record<CraneKind, number> = { plush: 0.05, oddity: 1 };

/** Front of the floor is lower on screen; the back of it is higher. */
const floorY = (z: number): number => 144 - z * 30;
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

type Phase = 'aim' | 'lower' | 'shut' | 'up' | 'carry' | 'release' | 'result';

export class CraneGame extends Phaser.Scene {
  private kind: CraneKind = 'plush';
  private phase: Phase = 'aim';
  private clawX = PILE_L + 40;
  private clawZ = 0.3;
  private drop = 0;
  private vx = 0;
  private vz = 0;
  private sway = 0;
  private auto = false;
  private clock = CLOCK_S;
  private toys: Toy[] = [];
  private held: Toy | null = null;
  private claw!: Phaser.GameObjects.Container;
  private cable!: Phaser.GameObjects.Rectangle;
  private bar!: Phaser.GameObjects.Rectangle;
  private motor!: Phaser.GameObjects.Container;
  private clockText!: Phaser.GameObjects.BitmapText;
  private result: Phaser.GameObjects.Container | null = null;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private pointerDrop = false;

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
    this.clawX = PILE_L + 40;
    this.clawZ = 0.3;
    this.drop = 0;
    this.vx = this.vz = 0;
    this.held = null;
    this.result = null;
    this.toys = [];
    this.pointerDrop = false;
    this.auto = false;

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

    this.clockText = text(this, 238, 158, '', 0xff6a5a).setDepth(60);
    new TokenHud(this);
    button(this, GAME_W - 24, 10, 'QUIT', () => this.leave(true), { width: 40, height: 13, fill: 0x5a1a22 }).setDepth(70);

    const kb = this.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    this.keys = {
      left: bind(['A', 'LEFT']),
      right: bind(['D', 'RIGHT']),
      back: bind(['W', 'UP']),
      front: bind(['S', 'DOWN']),
      drop: bind(['SPACE', 'E']),
    };
    kb?.on('keydown-ESC', () => this.leave(true));
    // a held press on the glass lowers it too
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if ((this.phase === 'aim' || this.phase === 'lower') && p.y > 30 && p.y < 148) this.pointerDrop = true;
    });
    this.input.on('pointerup', () => {
      this.pointerDrop = false;
    });

    this.startGo();

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
          this.clawX = Phaser.Math.Clamp(x, PILE_L - 40, PILE_R);
          this.clawZ = Phaser.Math.Clamp(z, 0, 1);
          this.vx = this.vz = 0;
        },
        /** All the way down, as if DROP were held. */
        drop: () => this.beginLower(true),
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
    this.add.rectangle(GAME_W / 2, 15, 170, 20, 0x0c0814).setStrokeStyle(1, trim);
    const name = eerie ? '? ? ?  CAPSULES  ? ? ?' : 'FROGGY GRAB!';
    const cols = eerie ? [0xc8a0e0, 0x8a6ab0] : [0xff4fa3, 0xffc830, 0x46c46e, 0x3fb8e8, 0xff7a3d, 0xa870e8];
    const w = name.length * 6;
    [...name].forEach((ch, i) => {
      if (ch === ' ') return;
      centerText(this, GAME_W / 2 - w / 2 + i * 6 + 3, 15, ch, cols[i % cols.length]);
    });
    for (const sx of [GAME_W / 2 - 78, GAME_W / 2 + 78]) {
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
    for (const [x, w2] of [[60, 6], [70, 2], [250, 4]] as const) {
      this.add.rectangle(x, BOX.top + 4, w2, BOX.bottom - BOX.top - 8, 0xffffff, 0.06).setOrigin(0, 0).setAngle(8).setDepth(56);
    }
    // the control panel along the bottom
    this.add.rectangle(BOX.l - 6, BOX.bottom + 2, BOX.r - BOX.l + 12, GAME_H - BOX.bottom - 6, eerie ? 0x2a1a3a : 0xffc830).setOrigin(0, 0).setStrokeStyle(1, eerie ? 0x7a4aa8 : 0xb88a20).setDepth(58);
    const ink = eerie ? 0xc8a0e0 : 0x5a3a10;
    // the stick
    this.add.rectangle(52, 168, 14, 4, 0x2a2a2a).setDepth(59);
    this.add.rectangle(52, 162, 2, 10, 0x3a3a3a).setDepth(59);
    this.add.circle(52, 157, 4, 0xd8202a).setStrokeStyle(1, 0x7a1018).setDepth(59);
    // the buttons
    this.add.circle(76, 163, 5, 0x46c46e).setStrokeStyle(1, 0x2a7a44).setDepth(59);
    this.add.circle(92, 163, 5, 0xd8202a).setStrokeStyle(1, 0x7a1018).setDepth(59);
    text(this, 108, 155, `CREDIT ${CRANE_COST[this.kind]}`, ink).setDepth(59);
    text(this, 108, 166, isTouch() ? 'STICK  HOLD DROP' : 'WASD  HOLD SPACE', ink).setDepth(59);
    // the clock window
    this.add.rectangle(236, 156, 54, 14, 0x0c0814).setOrigin(0, 0).setStrokeStyle(1, 0x5a3a10).setDepth(59);
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
    const top = floorY(0) - 34;
    this.add.rectangle(CHUTE.l, top, CHUTE.r - CHUTE.l, floorY(0) + 6 - top, 0x9fd4ff, 0.12).setOrigin(0, 0).setStrokeStyle(1, 0xc8e0ff, 0.6).setDepth(50);
    this.add.rectangle(CHUTE.l, top, CHUTE.r - CHUTE.l, 2, 0xc8e0ff, 0.6).setOrigin(0, 0).setDepth(50);
    centerText(this, (CHUTE.l + CHUTE.r) / 2, top - 6, 'PRIZE', eerie ? 0xc8a0e0 : PALETTE.gold).setDepth(50);
  }

  /**
   * THE PILE: a machine full to the glass.  Four rows from the back to the
   * front and three deep, every gap filled, so the claw comes down on a heap
   * of prizes rather than nine in a line.
   */
  private fillPile(): void {
    const rows = 5;
    const layers = 3;
    const specs: Array<{ x: number; z: number; lift: number }> = [];
    for (let layer = 0; layer < layers; layer++) {
      for (let r = 0; r < rows; r++) {
        const z = 0.95 - r * 0.21;
        const step = 13 + layer * 2;
        for (let x = PILE_L + 6 + (r % 2) * 6 + layer * 4; x < PILE_R - 4 - layer * 4; x += step) {
          // the heap is taller in the middle than at the edges
          const mid = 1 - Math.abs((x - (PILE_L + PILE_R) / 2) / ((PILE_R - PILE_L) / 2));
          if (layer > 0 && Math.random() > 0.35 + mid * 0.6) continue;
          specs.push({ x: x + Phaser.Math.Between(-2, 2), z: z + Phaser.Math.FloatBetween(-0.04, 0.04), lift: layer * 9 + Phaser.Math.Between(0, 2) });
        }
      }
    }
    // back to front, bottom to top, so nearer and higher prizes are drawn over
    specs.sort((a, b) => b.z - a.z || a.lift - b.lift);
    for (const sp of specs) this.toys.push(this.makeToy(sp.x, sp.z, sp.lift));
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
    if (this.kind === 'plush') {
      // Froggies are the rare one in the heap
      const def = Math.random() < 0.12 ? PLUSHIES[0] : PLUSHIES[Phaser.Math.Between(1, PLUSHIES.length - 1)];
      id = def.id;
      c.add(drawItem(this, 0, 0, def, 1.25));
    } else {
      // a capsule: two halves, one clouded so you cannot see in
      const cols = [0x6a3a8a, 0x3a2a4a, 0x8a7aa0, 0x2a3a4a, 0x5a2a6a];
      const col = cols[Phaser.Math.Between(0, cols.length - 1)];
      c.add([
        this.add.circle(0, -6, 6.5, col).setStrokeStyle(1, 0x1a1020),
        this.add.rectangle(0, -6, 13, 1.4, 0xc8b0d8),
        this.add.circle(-2, -8.5, 1.4, 0xffffff, 0.4),
      ]);
    }
    const t: Toy = { id, x, z, lift, art: c };
    this.placeToy(t);
    return t;
  }

  private drawClaw(shut: boolean): void {
    this.claw.removeAll(true);
    // the head, the prongs, and the hooked tips
    this.claw.add(this.add.rectangle(0, 0, 10, 5, 0x9aa6b6).setStrokeStyle(1, 0x4a5666));
    this.claw.add(this.add.rectangle(0, 3, 4, 2, 0x6a7686));
    const o = shut ? 2.5 : 7;
    for (const sx of [-1, 1]) {
      this.claw.add(this.add.line(0, 0, sx * 2, 3, sx * o, 11, 0xc8d0dc).setLineWidth(1.6).setOrigin(0, 0));
      this.claw.add(this.add.line(0, 0, sx * o, 11, sx * (o - 3), 15, 0xc8d0dc).setLineWidth(1.6).setOrigin(0, 0));
    }
    this.claw.add(this.add.line(0, 0, 0, 3, 0, 13, 0xc8d0dc).setLineWidth(1.4).setOrigin(0, 0));
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
    this.clock = CLOCK_S;
    this.drop = 0;
    this.auto = false;
  }

  /** From wherever it is, carrying the way it was going. */
  private beginLower(auto = false): void {
    if (this.phase !== 'aim') return;
    this.phase = 'lower';
    this.auto = auto;
    audio.sfx('ui_blip');
  }

  private dropHeld(): boolean {
    return this.pointerDrop || (this.keys.drop?.some((k) => k.isDown) ?? false);
  }

  /** How high the pile comes up under the claw, as a drop distance. */
  private floorUnder(): number {
    let lift = 0;
    for (const t of this.toys) {
      if (Math.abs(t.x - this.clawX) < 8 && Math.abs(t.z - this.clawZ) < 0.12) lift = Math.max(lift, t.lift + 8);
    }
    const k = scaleAt(this.clawZ);
    return floorY(this.clawZ) - lift * k - 12 * k - gantryY(this.clawZ);
  }

  update(_t: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    const held = (g: string) => this.keys[g]?.some((k) => k.isDown) ?? false;
    if (this.phase === 'aim') {
      const ix = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
      const iz = (held('back') ? 1 : 0) - (held('front') ? 1 : 0);
      // a little weight to it: it eases into a move and out of one
      this.vx += (ix * MOVE_X - this.vx) * Math.min(1, dt * 8);
      this.vz += (iz * MOVE_Z - this.vz) * Math.min(1, dt * 8);
      this.clawX = Phaser.Math.Clamp(this.clawX + this.vx * dt, PILE_L - 40, PILE_R);
      this.clawZ = Phaser.Math.Clamp(this.clawZ + this.vz * dt, 0, 1);
      this.clock -= dt;
      this.clockText.setText(`TIME ${Math.max(0, Math.ceil(this.clock))}`);
      if (this.dropHeld()) this.beginLower();
      else if (this.clock <= 0) this.beginLower(true);
    } else if (this.phase === 'lower') {
      // the way it was going carries it on a little, and dies away
      this.clawX = Phaser.Math.Clamp(this.clawX + this.vx * dt, PILE_L - 40, PILE_R);
      this.clawZ = Phaser.Math.Clamp(this.clawZ + this.vz * dt, 0, 1);
      this.vx *= Math.exp(-dt * 3.5);
      this.vz *= Math.exp(-dt * 3.5);
      this.clock -= dt;
      this.clockText.setText(`TIME ${Math.max(0, Math.ceil(this.clock))}`);
      if (this.clock <= 0) this.auto = true;
      if (this.auto || this.dropHeld()) this.drop += LOWER * dt;
      const bottom = Math.min(MAX_DROP, this.floorUnder());
      if (this.drop >= bottom) {
        this.drop = bottom;
        this.phase = 'shut';
        this.drawClaw(true);
        audio.sfx('door_shut', 0.25);
        this.time.delayedCall(350, () => this.grab());
      }
    } else if (this.phase === 'up') {
      this.drop -= RAISE * dt;
      if (this.drop <= 0) {
        this.drop = 0;
        this.phase = this.held ? 'carry' : 'release';
        if (!this.held) this.time.delayedCall(200, () => this.payOut());
      }
    } else if (this.phase === 'carry') {
      // over to the chute, front left
      const dx = CHUTE.x - this.clawX;
      const dz = CHUTE.z - this.clawZ;
      this.clawX += Math.sign(dx) * Math.min(Math.abs(dx), 80 * dt);
      this.clawZ += Math.sign(dz) * Math.min(Math.abs(dz), 1 * dt);
      if (Math.abs(dx) < 0.5 && Math.abs(dz) < 0.01) {
        this.phase = 'release';
        this.drawClaw(false);
        const t = this.held;
        if (t) {
          this.tweens.add({ targets: t.art, y: floorY(0) + 4, duration: 260, ease: 'Quad.easeIn' });
        }
        this.time.delayedCall(320, () => this.payOut());
      }
    }
    // the swing on the cable, more the faster it went
    this.sway = Math.sin(this.time.now / 160) * Math.min(2.5, Math.abs(this.vx) / 25 + this.drop / 80);
    this.drawRig();
    if (this.held && this.phase !== 'release') {
      const k = scaleAt(this.clawZ);
      const hx = screenX(this.clawX, this.clawZ) + this.sway;
      const hy = gantryY(this.clawZ) + (this.drop + 22) * k;
      this.held.art.setPosition(hx, hy).setScale(k).setDepth(44);
    }
  }

  private drawRig(): void {
    const k = scaleAt(this.clawZ);
    const gy = gantryY(this.clawZ);
    const sx = screenX(this.clawX, this.clawZ);
    this.bar.setPosition(GAME_W / 2, gy).setScale(1 - this.clawZ * 0.1, 1);
    this.motor.setPosition(sx, gy).setScale(k);
    const tipY = gy + this.drop * k;
    this.cable.setPosition(sx, gy + 2).setSize(1, Math.max(1, tipY - gy));
    this.claw.setPosition(sx + this.sway, tipY + 4).setScale(k);
  }

  /** The claw shuts.  What it comes up with depends on the machine. */
  private grab(): void {
    let best: Toy | null = null;
    let bestScore = Infinity;
    for (const t of this.toys) {
      const dx = Math.abs(t.x - this.clawX);
      const dz = Math.abs(t.z - this.clawZ) * 60;
      if (dx > 12 || dz > 12) continue;
      // the one on top, nearest the middle of the claw
      const score = dx + dz - t.lift * 0.6;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    if (best && Math.random() < GRIP[this.kind]) {
      this.held = best;
      this.toys = this.toys.filter((t) => t !== best);
    } else if (best) {
      // it closes on it, lifts it a fraction, and lets it go
      const t = best;
      this.tweens.add({ targets: t.art, y: '-=4', duration: 140, yoyo: true });
    }
    this.phase = 'up';
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
    // a capsule: open it
    const what = rollCapsule();
    if (what === 'tokens' || what === 'golden') {
      ledger.credit(10, 'crane');
      audio.sfx('cha_ching');
      this.showResult(what === 'golden' ? 'A GOLDEN TICKET!  10 TOKENS' : 'INSIDE: 10 TOKENS', PALETTE.gold, true);
      return;
    }
    if (what === 'oddity') {
      const def = ODDITIES[Phaser.Math.Between(0, ODDITIES.length - 1)];
      if (addItem(def.id)) {
        audio.sfx('chime');
        this.showResult(`INSIDE: ${def.name}`, 0xc8a0e0, true, def.id);
      } else this.showResult(FULL_LINE, PALETTE.ember, true);
      return;
    }
    audio.sfx('ui_blip', 0.4);
    this.showResult('THE CAPSULE IS EMPTY.', PALETTE.ash, true);
  }

  private showResult(line: string, colour: number, played: boolean, itemId?: string): void {
    this.phase = 'result';
    this.result?.destroy();
    const c = this.add.container(0, 0).setDepth(90);
    c.add(this.add.rectangle(GAME_W / 2, 92, 230, 70, PALETTE.ink, 0.95).setStrokeStyle(1, colour));
    c.add(centerText(this, GAME_W / 2, itemId ? 104 : 80, line, colour).setMaxWidth(220));
    if (itemId) {
      const d = itemDef(itemId);
      if (d) c.add(drawItem(this, GAME_W / 2, 92, d, 1.6));
    }
    const cost = CRANE_COST[this.kind];
    if (played) {
      c.add(button(this, GAME_W / 2 - 46, 116, `AGAIN - ${cost}`, () => this.again(), { width: 76, height: 13 }));
    }
    c.add(button(this, GAME_W / 2 + (played ? 46 : 0), 116, 'LEAVE', () => this.leave(true), { width: 60, height: 13 }));
    this.result = c;
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
    this.clawX = PILE_L + 40;
    this.clawZ = 0.3;
    this.vx = this.vz = 0;
    this.drawClaw(false);
    this.startGo();
  }

  /** QUIT, LEAVE or Esc: back to the room.  A go already paid for is spent. */
  private leave(force = false): void {
    if (!force && this.phase !== 'aim' && this.phase !== 'result') return;
    fadeToScene(this, 'ArcadeLounge', { atProp: this.kind });
  }
}
