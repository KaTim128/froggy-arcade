/**
 * The new room.  Through the opening in the hub's RIGHT wall.
 *
 * The hub, the back room and the machines are full, and the next games need
 * somewhere to stand.  This is that somewhere: the same arcade -- same carpet,
 * same walls, same light -- with its floor marked out for the machines that
 * are on their way and a sign saying so.  A cabinet is put in here the way it
 * is put in any room, by giving it `room: 'lounge'` in `game/content.ts`; the
 * room builds whatever is listed for it and walks the player up to it exactly
 * as the others do.
 *
 * Deliberately thin, like the back room: no counter, no bell, no tutorial.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store, type GameId } from '../core/state';
import { ledger } from '../core/ledger';
import { canEnter } from '../core/routes';
import { KEYS } from '../core/input';
import { centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { paintArcadeDressing, paintHubRoom, paintOpening, ROOM } from '../art/hubRoom';
import { Player } from '../art/player';
import { Cabinet, CAB_W, CAB_H } from '../art/cabinet';
import { TokenHud } from '../ui/hud';
import { CABINETS, LOUNGE_DOOR, cabinetsIn } from '../game/content';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W } from '../render/pixelScaler';

const INTERACT_RANGE = 24;
/** The way back, on this room's LEFT wall -- the other side of the hub's right. */
const BACK_DOOR = { x: 20, y: LOUNGE_DOOR.y };
/**
 * Where the next machines will stand, marked on the carpet.  Two rows of
 * four, the hub's own spacing, clear of the doorway on the left.
 */
const PLOTS = [
  ...[84, 142, 200, 258].map((x) => ({ x, y: 104 })),
  ...[84, 142, 200, 258].map((x) => ({ x, y: 160 })),
];

type Target = { kind: 'cabinet'; cab: Cabinet } | { kind: 'back' } | null;

export class ArcadeLounge extends Phaser.Scene {
  private player!: Player;
  private bounds!: Phaser.Geom.Rectangle;
  private keys!: Record<string, Phaser.Input.Keyboard.Key[]>;
  private cabinets: Cabinet[] = [];
  private prompt!: Phaser.GameObjects.BitmapText;
  private promptPlate!: Phaser.GameObjects.Rectangle;
  private target: Target = null;
  private locked = false;
  private returnTo: GameId | null = null;

  constructor() {
    super('ArcadeLounge');
  }

  init(data: { atCabinet?: GameId } = {}): void {
    this.returnTo = data.atCabinet ?? null;
  }

  create(): void {
    froggyLayer.clear();
    // Phaser reuses scene instances, so every mutable field resets here.
    this.locked = false;
    this.target = null;
    this.cabinets = [];

    fadeIn(this);
    audio.setScene({ music: 'room_annex', ambience: ['cabinet_bleeps'] });

    paintHubRoom(this, { night: false, frontDoor: false });
    paintArcadeDressing(this, {
      night: false,
      props: [{ x: 296, y: 62, kind: 'plant' }],
      vents: [60, 236],
    });
    this.paintSign();

    this.cabinets = cabinetsIn('lounge').map((def) => new Cabinet(this, def));
    // The floor is marked where a machine is coming, and only where there is
    // not one standing already.
    for (const plot of PLOTS) {
      if (this.cabinets.some((c) => Math.abs(c.def.x - plot.x) < CAB_W && Math.abs(c.def.y - plot.y) < CAB_H)) continue;
      this.paintPlot(plot.x, plot.y);
    }
    for (const cab of this.cabinets) {
      this.add
        .zone(cab.def.x, cab.def.y - CAB_H / 2, CAB_W + 4, CAB_H + 2)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (this.busy()) return;
          this.launchGame(cab, 'card');
        });
    }
    this.paintDoorway();

    this.bounds = new Phaser.Geom.Rectangle(
      ROOM.left + 8,
      ROOM.top + 6,
      ROOM.right - ROOM.left - 16,
      ROOM.bottom - ROOM.top - 6,
    );
    // You come in through the left-hand doorway, so you arrive next to it.
    const spawn = this.spawnPoint({ x: BACK_DOOR.x + 18, y: BACK_DOOR.y });
    this.player = new Player(this, spawn.x, spawn.y);

    new TokenHud(this);

    this.promptPlate = this.add.rectangle(0, 0, 4, 12, PALETTE.black, 0.7).setDepth(800).setVisible(false);
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setDepth(801).setOrigin(0.5, 0.5).setVisible(false);
    this.keys = {
      up: this.bindKeys(KEYS.up),
      down: this.bindKeys(KEYS.down),
      left: this.bindKeys(KEYS.left),
      right: this.bindKeys(KEYS.right),
    };
    this.input.keyboard?.on('keydown-E', () => this.interact());
    // A click on the floor is floor.  The door answers a click on the door,
    // a machine a click on the machine; nothing is reached by proximity.

    store.flush();
  }

  /** The sign on the back wall, lit, saying what the empty floor is for. */
  private paintSign(): void {
    const x = GAME_W / 2;
    const y = 22;
    this.add.rectangle(x, y, 122, 26, PALETTE.ink).setStrokeStyle(1, PALETTE.neon).setDepth(1);
    this.add.rectangle(x, y, 118, 22, PALETTE.plum, 0.35).setDepth(1);
    centerText(this, x, y - 5, 'NEW GAMES', PALETTE.gold).setDepth(2);
    centerText(this, x, y + 5, 'COMING SOON', PALETTE.neon).setDepth(2);
    // It buzzes like every other sign in the building.
    const glow = this.add.rectangle(x, y, 126, 30, PALETTE.neon, 0.08).setDepth(0.9);
    this.tweens.add({ targets: glow, alpha: 0.02, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /**
   * A machine's footprint taped out on the carpet: the corners of where it
   * will stand, and the four dents a heavy cabinet leaves in pile.
   */
  private paintPlot(x: number, y: number): void {
    const g = this.add.graphics().setDepth(0.6);
    const w = CAB_W + 2;
    const h = 12;
    const l = x - w / 2;
    const t = y - h;
    g.fillStyle(PALETTE.gold, 0.55);
    for (const [cx, cy, dx, dy] of [
      [l, t, 1, 1],
      [l + w, t, -1, 1],
      [l, t + h, 1, -1],
      [l + w, t + h, -1, -1],
    ]) {
      g.fillRect(dx > 0 ? cx : cx - 5, cy - (dy > 0 ? 0 : 1), 5, 1);
      g.fillRect(cx - (dx > 0 ? 0 : 1), dy > 0 ? cy : cy - 5, 1, 5);
    }
    g.fillStyle(PALETTE.black, 0.22);
    for (const [fx, fy] of [
      [l + 3, t + 2],
      [l + w - 5, t + 2],
      [l + 3, t + h - 4],
      [l + w - 5, t + h - 4],
    ]) {
      g.fillRect(fx, fy, 2, 2);
    }
  }

  private paintDoorway(): void {
    // The opening back to the hub, in this room's left wall, lit the hub's pink.
    paintOpening(this, { side: 'left', y: BACK_DOOR.y, glow: PALETTE.neon });
    this.add
      .zone(BACK_DOOR.x, BACK_DOOR.y, 26, 50)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (!this.busy()) this.toHub();
      });
  }

  private spawnPoint(fallback: { x: number; y: number }): { x: number; y: number } {
    if (!this.returnTo) return fallback;
    const def = CABINETS.find((c) => c.id === this.returnTo);
    if (!def) return fallback;
    return {
      x: Phaser.Math.Clamp(def.x, ROOM.left + 12, ROOM.right - 12),
      y: Phaser.Math.Clamp(def.y + 12, ROOM.top + 12, ROOM.bottom - 8),
    };
  }

  private bindKeys(names: readonly string[]): Phaser.Input.Keyboard.Key[] {
    const kb = this.input.keyboard;
    if (!kb) return [];
    return names.map((n) => kb.addKey(n));
  }

  private held(group: string): boolean {
    return this.keys[group]?.some((k) => k.isDown) ?? false;
  }

  private busy(): boolean {
    return this.locked;
  }

  private interact(): void {
    if (this.busy() || !this.target) return;
    if (this.target.kind === 'back') {
      this.toHub();
      return;
    }
    this.launchGame(this.target.cab, 'play');
  }

  private toHub(): void {
    this.locked = true;
    audio.sfx('footstep_carpet');
    fadeToScene(this, 'ArcadeHub', { fromDoor: 'lounge' });
  }

  /** Into a cabinet: see ArcadeAnnex.launchGame, which this follows exactly. */
  private launchGame(cab: Cabinet, how: 'card' | 'play'): void {
    if (!canEnter('Minigame', store.get(), {})) {
      audio.sfx('buzzer');
      return;
    }
    this.locked = true;
    fadeToScene(this, 'Minigame', { id: cab.def.id, from: 'ArcadeLounge', straight: how === 'play' });
  }

  update(_time: number, delta: number): void {
    if (this.busy()) {
      this.promptPlate.setVisible(false);
      this.prompt.setVisible(false);
      return;
    }

    const dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const dy = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    this.player.move(dx, dy, delta, this.bounds);

    const bal = ledger.balance();
    for (const c of this.cabinets) c.setAffordable(bal >= c.def.cost);

    this.target = this.findTarget();
    this.renderPrompt();
  }

  private findTarget(): Target {
    const px = this.player.x;
    const py = this.player.y;
    let best: Cabinet | null = null;
    let bestD = INTERACT_RANGE;
    for (const c of this.cabinets) {
      const d = c.distanceTo(px, py);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) return { kind: 'cabinet', cab: best };
    if (px < BACK_DOOR.x + 20 && Math.abs(py - BACK_DOOR.y) < 28) return { kind: 'back' };
    return null;
  }

  private renderPrompt(): void {
    const t = this.target;
    if (!t) {
      this.promptPlate.setVisible(false);
      this.prompt.setVisible(false);
      return;
    }
    let msg: string;
    let colour: number = PALETTE.gold;
    if (t.kind === 'cabinet') {
      const { cost } = t.cab.def;
      msg = `[E] ${t.cab.def.title} - ${cost} TOKEN${cost === 1 ? '' : 'S'}`;
      colour = ledger.balance() >= cost ? PALETTE.gold : PALETTE.ash;
    } else {
      msg = '[E] ARCADE';
    }
    this.prompt.setText(msg).setTint(colour === PALETTE.gold ? 0xffd45e : 0x5c6b7d);
    const x = Phaser.Math.Clamp(this.player.x, 70, GAME_W - 70);
    const y = this.player.y - 34;
    this.prompt.setPosition(x, y).setVisible(true);
    this.promptPlate
      .setPosition(x, y)
      .setSize(this.prompt.width + 6, 11)
      .setVisible(true);
  }
}
