/**
 * The roulette table, top left of the casino (user, 5 Nov).  Furniture, not
 * a machine, and NOT a blackjack table: it is long and straight-sided, the
 * wheel sits sunk in a wooden bowl at its far end, and the felt is the
 * betting layout -- the zero, the three rows of twelve, the outside bets
 * along the near edge.  What it shares with Froggy's table is the house's
 * materials: the same walnut rail and apron, the same green baize, the same
 * brass, so the two read as one room's furniture.
 *
 * Nobody deals here.  The wheel turns on its own between spins.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import type { CabinetDef } from '../game/content';
import { centerText } from '../core/ui';
import { RED_NUMBERS, WHEEL_ORDER } from '../game/roulette';

/** Footprint of the table, in world pixels.  `def.y` is the near edge. */
export const RTABLE_W = 66;
export const RTABLE_H = 22;

/** The house's baize and brass, as on the blackjack table. */
const FELT = 0x1d5c2d;
const FELT_DARK = 0x123b1e;
const BRASS = 0xb08a3c;
const RED = 0xb3202c;
const BLACK = 0x15121a;
const ZERO = 0x2f8d4f;

export class RouletteTable {
  readonly def: CabinetDef;
  readonly bounds: Phaser.Geom.Rectangle;
  private badgeBox: Phaser.GameObjects.Rectangle;
  private badgeText: Phaser.GameObjects.BitmapText;
  private affordable = true;

  constructor(scene: Phaser.Scene, def: CabinetDef) {
    this.def = def;
    const { x, y } = def;
    const d = y / 1000;
    const L = x - RTABLE_W / 2;
    const top = y - RTABLE_H;

    const g = scene.add.graphics().setDepth(d);
    // shadow, the apron (two legs at the ends), the rail, the felt
    g.fillStyle(PALETTE.black, 0.35).fillEllipse(x, y + 3, RTABLE_W + 6, 8);
    g.fillStyle(0x4a3320, 1).fillRect(L + 3, y - 1, 4, 7).fillRect(L + RTABLE_W - 7, y - 1, 4, 7);
    g.fillStyle(PALETTE.brown, 1).fillRect(L + 1, y - 8, RTABLE_W - 2, 8);
    g.fillStyle(0x4a3320, 1).fillRect(L + 1, y - 2, RTABLE_W - 2, 2);
    g.fillStyle(PALETTE.brown, 1).fillRoundedRect(L, top - 2, RTABLE_W, RTABLE_H - 4, 4);
    g.fillStyle(0x7a5232, 1).fillRect(L + 3, top - 1, RTABLE_W - 6, 1);
    g.fillStyle(FELT, 1).fillRoundedRect(L + 3, top + 1, RTABLE_W - 6, RTABLE_H - 10, 2);

    // ---- the betting layout on the felt: the zero, then twelve columns of
    // three, each square its own number's colour, ruled in pale chalk
    const gx = L + 28;
    const gy = top + 2;
    const cw = 2.5;
    const ch = 2.6;
    g.fillStyle(ZERO, 1).fillRect(gx - 3, gy, 3, ch * 3);
    for (let c = 0; c < 12; c++) {
      for (let r = 0; r < 3; r++) {
        const n = c * 3 + (3 - r);
        g.fillStyle(RED_NUMBERS.has(n) ? RED : BLACK, 1).fillRect(gx + c * cw, gy + r * ch, cw - 0.5, ch - 0.5);
      }
    }
    g.lineStyle(0.5, 0xd8e8c8, 0.6).strokeRect(gx - 3, gy, 3 + 12 * cw, ch * 3);
    // the dozens and the outside bets along the near edge
    g.fillStyle(FELT_DARK, 1).fillRect(gx, gy + ch * 3 + 0.5, 12 * cw, 2);
    for (let k = 0; k < 6; k++) {
      const col = k === 2 ? RED : k === 3 ? BLACK : FELT_DARK;
      g.fillStyle(col, 1).fillRect(gx + k * 5, gy + ch * 3 + 3, 4.5, 2);
    }

    // ---- the wheel's bowl at the far end: walnut, a brass lip, and the
    // numbered ring that turns
    const wx = L + 13;
    const wy = top + 5;
    g.fillStyle(0x3a2616, 1).fillEllipse(wx, wy + 1.5, 21, 13);
    g.fillStyle(BRASS, 1).fillEllipse(wx, wy, 19, 11);
    g.fillStyle(0x5e3c22, 1).fillEllipse(wx, wy, 16.5, 9);
    // (user, 8 Nov: the ring was a flattened circle turned as a whole, so
    // the flat oval itself spun round.  The oval stays put and the pockets
    // turn inside it: redrawn each frame on the tilted ellipse.)
    const ring = scene.add.graphics().setDepth(d + 0.0001).setPosition(wx, wy);
    const N = WHEEL_ORDER.length;
    const RX = 7.6;
    const RY = 7.6 * 0.55;
    const paint = (turn: number): void => {
      ring.clear();
      for (let i = 0; i < N; i++) {
        const n = WHEEL_ORDER[i];
        const a0 = turn + (i / N) * Math.PI * 2;
        const a1 = turn + ((i + 1) / N) * Math.PI * 2;
        ring.fillStyle(n === 0 ? ZERO : RED_NUMBERS.has(n) ? RED : BLACK, 1);
        ring.fillTriangle(0, 0, Math.cos(a0) * RX, Math.sin(a0) * RY, Math.cos(a1) * RX, Math.sin(a1) * RY);
      }
      ring.fillStyle(0x7a5232, 1).fillEllipse(0, 0, 8.4, 8.4 * 0.55);
      ring.fillStyle(BRASS, 1).fillEllipse(0, 0, 3.6, 3.6 * 0.55);
      for (let i = 0; i < 4; i++) {
        const k = turn + (i / 4) * Math.PI * 2;
        ring.lineStyle(0.8, BRASS, 1).lineBetween(0, 0, Math.cos(k) * 3.6, Math.sin(k) * 3.6 * 0.55);
      }
    };
    let turn = 0;
    paint(0);
    // the ball, riding the track the other way
    const ball = scene.add.circle(wx, wy, 0.9, 0xffffff).setDepth(d + 0.0002);
    let a = 0;
    scene.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => {
      turn += dt * ((Math.PI * 2) / 9000);
      paint(turn);
      a -= dt * 0.0016;
      ball.setPosition(wx + Math.cos(a) * 8.2, wy + Math.sin(a) * 4.4);
    });

    // ---- chips waiting on the layout, and the dolly on a winning number
    const chips: [number, number, number][] = [
      [gx + 7, gy + 3, PALETTE.gold],
      [gx + 18, gy + 5.5, PALETTE.neon],
      [gx + 12.5, gy + ch * 3 + 4, PALETTE.cream],
    ];
    for (const [cx, cy, col] of chips) {
      for (let i = 0; i < 2; i++) scene.add.ellipse(cx, cy - i, 2.6, 1.4, col).setDepth(d + 0.0003 + i * 0.00001);
    }
    scene.add.rectangle(gx + 23, gy + 1, 1, 2, 0xe8e0c8).setDepth(d + 0.0003);

    // ---- stools along the near side: no high-back chair here, everyone stands round
    for (const sx of [x - 18, x, x + 18]) {
      scene.add.ellipse(sx, y + 9, 8, 4, 0x5e1f2a).setDepth(d + 0.001);
      scene.add.rectangle(sx, y + 9, 6, 1, 0x76293a).setDepth(d + 0.001);
      scene.add.rectangle(sx, y + 11, 1, 5, PALETTE.steel).setOrigin(0.5, 0).setDepth(d + 0.001);
    }

    // ---- its sign on the back wall, level with Froggy 21's
    const signY = 40;
    scene.add.rectangle(x, signY - 10, 2, 10, PALETTE.steel).setDepth(d);
    const sign = scene.add.rectangle(x, signY, 60, 11, def.color).setDepth(d).setStrokeStyle(1, PALETTE.ink);
    centerText(scene, x, signY, def.title, PALETTE.cream).setDepth(d + 0.001);
    scene.tweens.add({ targets: sign, alpha: 0.7, duration: 1300, yoyo: true, repeat: -1 });

    // ---- the minimum, like the blackjack table's
    this.badgeBox = scene.add.rectangle(0, 0, 20, 11, PALETTE.black, 0.75).setStrokeStyle(1, PALETTE.gold);
    this.badgeText = centerText(scene, 0, 0, `${def.cost}+`, PALETTE.gold);
    const badge = scene.add.container(x + RTABLE_W / 2 + 6, y - 16, [this.badgeBox, this.badgeText]).setDepth(500);
    scene.tweens.add({ targets: badge, y: y - 18, duration: 1200, yoyo: true, repeat: -1 });

    this.bounds = new Phaser.Geom.Rectangle(L, top - 4, RTABLE_W, RTABLE_H + 18);
  }

  setAffordable(v: boolean): void {
    if (v === this.affordable) return;
    this.affordable = v;
    this.badgeBox.setStrokeStyle(1, v ? PALETTE.gold : PALETTE.steel);
    this.badgeText.setTint(v ? PALETTE.gold : PALETTE.ash);
  }

  /** From the near edge, where you stand to bet. */
  distanceTo(x: number, y: number): number {
    return Phaser.Math.Distance.Between(this.def.x, this.def.y + 6, x, y);
  }
}
