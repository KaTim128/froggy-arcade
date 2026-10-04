/**
 * ---- THE CLAW MACHINES.  The fourth room's two cranes, played up close.
 *
 * You are looking in through the glass.  The claw rides the gantry: left and
 * right to line it up, DROP (E or SPACE) to send it down, and when the clock
 * on the front runs out it drops wherever it is.  It comes down, shuts, goes
 * back up and carries whatever it is holding to the chute on the right.
 *
 *   PLUSH CRANE (5 tokens).  Animal plushies.  The claw is a claw machine's
 *   claw: line it up well and it usually holds, line it up badly and it
 *   usually does not, and now and then a toy slips out on the way over.
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

const LEFT = 36;
const RIGHT = 262;
const CHUTE_X = 288;
const TOP_Y = 34;
const PILE_Y = 140;
const CLOCK_S = 12;

interface Toy {
  id: string;
  x: number;
  y: number;
  art: Phaser.GameObjects.GameObject[];
}

type Phase = 'aim' | 'down' | 'shut' | 'up' | 'carry' | 'release' | 'result';

export class CraneGame extends Phaser.Scene {
  private kind: CraneKind = 'plush';
  private phase: Phase = 'aim';
  private clawX = LEFT + 20;
  private clawY = TOP_Y;
  private clock = CLOCK_S;
  private toys: Toy[] = [];
  private held: Toy | null = null;
  private claw!: Phaser.GameObjects.Container;
  private cable!: Phaser.GameObjects.Rectangle;
  private clockText!: Phaser.GameObjects.BitmapText;
  private result: Phaser.GameObjects.Container | null = null;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private slipAt = -1;

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
    this.clawX = LEFT + 20;
    this.clawY = TOP_Y;
    this.held = null;
    this.result = null;
    this.toys = [];

    // the inside of the machine: the back panel, the glass edges, the chute
    this.add.rectangle(0, 0, GAME_W, GAME_H, eerie ? 0x0c0812 : 0x14223a).setOrigin(0, 0);
    this.add.rectangle(GAME_W / 2, 96, 300, 150, eerie ? 0x160e20 : 0x1c3050).setStrokeStyle(2, eerie ? 0x6a3a8a : PALETTE.tealLight);
    this.add.rectangle(CHUTE_X, 128, 30, 40, PALETTE.black).setStrokeStyle(1, eerie ? 0x6a3a8a : PALETTE.neon);
    centerText(this, CHUTE_X, 104, 'PRIZE', eerie ? 0xc8a0e0 : PALETTE.gold);
    this.add.rectangle(GAME_W / 2, PILE_Y + 14, 260, 22, eerie ? 0x1e1228 : 0x24406a);
    centerText(this, GAME_W / 2 - 20, 12, eerie ? 'THE ODDITY CRANE' : 'PLUSH CRANE', eerie ? 0xc8a0e0 : PALETTE.gold);
    new TokenHud(this);
    if (eerie) {
      // the light in here is not well
      const dark = this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0).setOrigin(0, 0).setDepth(80);
      this.time.addEvent({
        delay: 120,
        loop: true,
        callback: () => dark.setAlpha(Math.random() < 0.08 ? 0.45 : Math.random() * 0.08),
      });
    }

    this.fillPile();

    // the gantry, the cable and the claw
    this.add.rectangle(GAME_W / 2 - 10, TOP_Y - 10, 250, 3, PALETTE.steel);
    this.cable = this.add.rectangle(this.clawX, TOP_Y - 9, 1, 1, PALETTE.steel).setOrigin(0.5, 0).setDepth(20);
    this.claw = this.add.container(this.clawX, this.clawY).setDepth(21);
    this.drawClaw(false);

    this.clockText = text(this, GAME_W - 70, 12, '', PALETTE.cream);
    text(this, 12, GAME_H - 12, '<- -> AIM   E / SPACE DROP', PALETTE.ash);

    const kb = this.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    this.keys = { left: bind(['A', 'LEFT']), right: bind(['D', 'RIGHT']) };
    kb?.on('keydown-E', () => this.drop());
    kb?.on('keydown-SPACE', () => this.drop());
    kb?.on('keydown-ESC', () => this.leave());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.phase === 'aim' && p.y > 40 && p.y < 160) this.drop();
    });

    if (!this.startGo()) this.leave();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__crane = {
        state: () => ({ phase: this.phase, clawX: this.clawX, toys: this.toys.map((t) => ({ id: t.id, x: t.x })), held: this.held?.id ?? null }),
        aim: (x: number) => {
          this.clawX = Phaser.Math.Clamp(x, LEFT, RIGHT);
        },
        drop: () => this.drop(),
      };
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => delete (window as unknown as Record<string, unknown>).__crane);
    }
  }

  /** The toys on the floor of the machine, scattered. */
  private fillPile(): void {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const x = LEFT + 8 + (i * (RIGHT - LEFT - 16)) / (n - 1) + Phaser.Math.Between(-4, 4);
      const y = PILE_Y + (i % 2) * 5;
      this.toys.push(this.makeToy(x, y));
    }
  }

  private makeToy(x: number, y: number): Toy {
    if (this.kind === 'plush') {
      const def = PLUSHIES[Phaser.Math.Between(0, PLUSHIES.length - 1)];
      return { id: def.id, x, y, art: drawItem(this, x, y, def, 1.3) };
    }
    // a capsule: two halves of a sphere, one clouded so you cannot see in
    const cols = [0x6a3a8a, 0x3a2a4a, 0x8a7aa0, 0x2a3a4a];
    const col = cols[Phaser.Math.Between(0, cols.length - 1)];
    const top = this.add.circle(x, y - 6, 6, col).setStrokeStyle(1, 0x1a1020);
    const band = this.add.rectangle(x, y - 6, 12, 1.4, 0xc8b0d8);
    const shine = this.add.circle(x - 2, y - 8, 1.2, 0xffffff, 0.4);
    return { id: 'capsule', x, y, art: [top, band, shine] };
  }

  private drawClaw(shut: boolean): void {
    this.claw.removeAll(true);
    this.claw.add(this.add.rectangle(0, 0, 8, 4, PALETTE.steel).setStrokeStyle(1, 0x5a626e));
    const s = shut ? 2 : 5;
    this.claw.add(this.add.line(0, 0, -2, 2, -s, 9, PALETTE.steel).setLineWidth(1.4).setOrigin(0, 0));
    this.claw.add(this.add.line(0, 0, 2, 2, s, 9, PALETTE.steel).setLineWidth(1.4).setOrigin(0, 0));
    this.claw.add(this.add.line(0, 0, -s, 9, -s + 2, 11, PALETTE.steel).setLineWidth(1.4).setOrigin(0, 0));
    this.claw.add(this.add.line(0, 0, s, 9, s - 2, 11, PALETTE.steel).setLineWidth(1.4).setOrigin(0, 0));
  }

  /** Take the tokens for a go.  False if they cannot be had. */
  private startGo(): boolean {
    if (pocketsFull()) {
      this.showResult(FULL_LINE, PALETTE.ember, false);
      return true;
    }
    if (!ledger.debit(CRANE_COST[this.kind], 'crane')) {
      this.showResult('NOT ENOUGH TOKENS', PALETTE.ember, false);
      return true;
    }
    audio.sfx('coin_drop');
    this.phase = 'aim';
    this.clock = CLOCK_S;
    return true;
  }

  private drop(): void {
    if (this.phase !== 'aim') return;
    this.phase = 'down';
    audio.sfx('ui_blip');
  }

  update(_t: number, delta: number): void {
    const dt = delta / 1000;
    if (this.phase === 'aim') {
      const dx = (this.keys.right?.some((k) => k.isDown) ? 1 : 0) - (this.keys.left?.some((k) => k.isDown) ? 1 : 0);
      this.clawX = Phaser.Math.Clamp(this.clawX + dx * 70 * dt, LEFT, RIGHT);
      this.clock -= dt;
      this.clockText.setText(`TIME ${Math.max(0, Math.ceil(this.clock))}`);
      if (this.clock <= 0) this.drop();
    } else if (this.phase === 'down') {
      this.clawY += 90 * dt;
      if (this.clawY >= PILE_Y - 18) {
        this.clawY = PILE_Y - 18;
        this.phase = 'shut';
        this.drawClaw(true);
        audio.sfx('door_shut', 0.25);
        this.time.delayedCall(350, () => this.grab());
      }
    } else if (this.phase === 'up') {
      this.clawY -= 70 * dt;
      if (this.clawY <= TOP_Y) {
        this.clawY = TOP_Y;
        this.phase = 'carry';
      }
    } else if (this.phase === 'carry') {
      this.clawX = Math.min(CHUTE_X, this.clawX + 80 * dt);
      // a plush that was only just held can slip out on the way over
      if (this.held && this.slipAt > 0 && this.clawX >= this.slipAt) {
        this.slipAt = -1;
        this.letGo(false);
      }
      if (this.clawX >= CHUTE_X) {
        this.phase = 'release';
        this.drawClaw(false);
        this.time.delayedCall(250, () => this.payOut());
      }
    }
    this.claw.setPosition(this.clawX, this.clawY);
    this.cable.setPosition(this.clawX, TOP_Y - 9).setSize(1, this.clawY - TOP_Y + 9);
    if (this.held) this.moveToy(this.held, this.clawX, this.clawY + 22);
  }

  private moveToy(t: Toy, x: number, y: number): void {
    const dx = x - t.x;
    const dy = y - t.y;
    for (const o of t.art) {
      const g = o as unknown as { x: number; y: number };
      g.x += dx;
      g.y += dy;
    }
    t.x = x;
    t.y = y;
  }

  /** The claw shuts.  What it comes up with depends on the machine. */
  private grab(): void {
    let best: Toy | null = null;
    let bestD = Infinity;
    for (const t of this.toys) {
      const d = Math.abs(t.x - this.clawX);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (this.kind === 'oddity') {
      // it never misses: the nearest capsule comes up, every time
      this.held = best;
    } else if (best && bestD < 10) {
      const odds = bestD < 4 ? 0.6 : 0.3;
      if (Math.random() < odds) {
        this.held = best;
        // and one in six slips on the way to the chute
        this.slipAt = Math.random() < 0.17 ? this.clawX + (CHUTE_X - this.clawX) * Phaser.Math.FloatBetween(0.2, 0.8) : -1;
      }
    }
    if (this.held) this.toys = this.toys.filter((t) => t !== this.held);
    this.phase = 'up';
  }

  /** It falls back on the pile. */
  private letGo(_atChute: boolean): void {
    const t = this.held;
    if (!t) return;
    this.held = null;
    audio.sfx('buzzer', 0.5);
    this.tweens.add({ targets: t.art, y: `+=${PILE_Y - t.y}`, duration: 300, ease: 'Quad.easeIn' });
    t.y = PILE_Y;
    this.toys.push(t);
  }

  private payOut(): void {
    const t = this.held;
    this.held = null;
    if (t) for (const o of t.art) o.destroy();
    if (!t) {
      this.showResult(this.kind === 'plush' ? 'IT SLIPPED. NOTHING THIS TIME.' : 'NOTHING.', PALETTE.ash, true);
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
      this.toys.push(this.makeToy(Phaser.Math.Between(LEFT + 10, RIGHT - 10), PILE_Y));
      return;
    }
    // a capsule: open it
    const what = rollCapsule();
    this.toys.push(this.makeToy(Phaser.Math.Between(LEFT + 10, RIGHT - 10), PILE_Y));
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
    c.add(button(this, GAME_W / 2 + (played ? 46 : 0), 116, 'LEAVE', () => this.leave(), { width: 60, height: 13 }));
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
    this.clawX = LEFT + 20;
    this.clawY = TOP_Y;
    this.drawClaw(false);
    this.startGo();
  }

  private leave(): void {
    if (this.phase !== 'aim' && this.phase !== 'result') return;
    fadeToScene(this, 'ArcadeLounge', { atProp: this.kind });
  }
}
