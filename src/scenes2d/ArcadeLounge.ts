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
 *
 * ---- AND IT HAS A SIDE DOOR.
 *
 * In its right-hand wall, brown, flush with the panelling.  By day it is
 * barely there -- a door-shaped seam a shade off the wall, the kind of door
 * nobody notices in a building they are having fun in.  After closing it is
 * the one that was standing ajar in the alley: the player comes in through
 * it, into this room with every light in the building off, and it swings
 * shut behind them.  It does not open again from this side ("The door is
 * locked from the outside.").  The only way on is through the room and out
 * of its left-hand doorway into the dark lobby.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio, SILENCE } from '../core/audio';
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
import { paintCrane, CRANE_H, CRANE_W, type CraneKind } from '../art/loungeProps';
import { FULL_LINE, pocketsFull } from '../game/inventory';
import { GAME_W } from '../render/pixelScaler';
import { attachPockets } from '../ui/pockets';

const INTERACT_RANGE = 24;
const rgb = (c: number): [number, number, number] => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
/** The side door, in this room's right-hand wall, below the plant. */
const SIDE_DOOR = { y: 96, h: 40 };
/** The way back, on this room's LEFT wall -- the other side of the hub's right. */
const BACK_DOOR = { x: 20, y: LOUNGE_DOOR.y };
/**
 * ---- THE GAME CORNER.  The two claw machines stand in the top-left of the
 * room against the back wall, plush on the left and the strange one on the
 * right.  The floor in front of them is open.  After closing they are still
 * here, in the same places, dark.
 */
const CRANES: Array<{ kind: CraneKind; x: number; y: number; cost: number; title: string }> = [
  { kind: 'plush', x: 44, y: 74, cost: 5, title: 'PLUSH CRANE' },
  { kind: 'oddity', x: 82, y: 74, cost: 3, title: 'ODDITY CRANE' },
];

type Target =
  | { kind: 'cabinet'; cab: Cabinet }
  | { kind: 'back' }
  | { kind: 'side' }
  | { kind: 'crane'; crane: (typeof CRANES)[number] }
  | null;

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
  /** After closing: every light off, and the side door is how you got in. */
  private night = false;
  private fromAlley = false;
  private sideDoor: { leaf: Phaser.GameObjects.Rectangle; gap: Phaser.GameObjects.Rectangle } | null = null;
  private mutter: Phaser.GameObjects.BitmapText | null = null;

  constructor() {
    super('ArcadeLounge');
  }

  /** Back from a crane: stand where you left it. */
  private atProp: CraneKind | null = null;

  init(data: { atCabinet?: GameId; fromAlley?: boolean; atProp?: CraneKind } = {}): void {
    this.returnTo = data.atCabinet ?? null;
    this.fromAlley = data.fromAlley === true;
    this.atProp = data.atProp ?? null;
  }

  create(): void {
    // Phaser reuses scene instances, so every mutable field resets here.
    this.locked = false;
    this.target = null;
    this.cabinets = [];

    // The night is the break-in's: the route says which side of it we are on.
    this.night = store.get().route === 'ejected';
    this.sideDoor = null;

    fadeIn(this);
    // After closing the building is silent, here as in the lobby (see
    // ArcadeDark's silence contract): footsteps and the door, nothing else.
    // The cranes: the room has its own nerdy little tune.
    audio.setScene(this.night ? SILENCE : { music: 'room_lounge', ambience: ['cabinet_bleeps'] });

    paintHubRoom(this, { night: this.night, frontDoor: false });
    paintArcadeDressing(this, {
      night: this.night,
      props: [{ x: 284, y: 70, kind: 'plant' }],
      // (one, clear of the claw machines that now stand where the other was)
      vents: [236],
    });
    this.paintSign();
    this.paintSideDoor();

    this.cabinets = cabinetsIn('lounge').map((def) => new Cabinet(this, def, this.night));
    // The game corner: two cranes.
    for (const cr of CRANES) {
      paintCrane(this, cr.x, cr.y, cr.kind, this.night);
      this.add
        .zone(cr.x, cr.y - CRANE_H / 2, CRANE_W + 4, CRANE_H)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (!this.busy()) this.useCrane(cr);
        });
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
    // You come in through the left-hand doorway, so you arrive next to it --
    // or, after closing, through the side door, so you arrive at that.
    const prop = CRANES.find((c) => c.kind === this.atProp);
    const spawn = this.fromAlley
      ? { x: ROOM.right - 22, y: SIDE_DOOR.y + SIDE_DOOR.h / 2 + 4 }
      : prop
        ? { x: prop.x, y: prop.y + 12 }
        : this.spawnPoint({ x: BACK_DOOR.x + 18, y: BACK_DOOR.y });
    this.player = new Player(this, spawn.x, spawn.y, this.night);
    if (this.night) this.player.setSurface('carpet');

    // (no tokens to count after closing: the HUD is the daytime's)
    if (!this.night) new TokenHud(this);
    if (!this.night) attachPockets(this, () => this.busy());
    this.mutter = text(this, GAME_W / 2, 180 - 30, '', PALETTE.fog).setOrigin(0.5, 0.5).setDepth(802).setVisible(false);
    if (this.night && this.fromAlley) this.shutBehind();

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
    if (this.night) {
      // Switched off: the letters are there, dark on dark, and nothing buzzes.
      this.add.rectangle(x, y, 122, 26, PALETTE.black).setStrokeStyle(1, PALETTE.slate).setDepth(1);
      centerText(this, x, y - 5, 'GAME CORNER', PALETTE.slate).setDepth(2).setAlpha(0.6);
      centerText(this, x, y + 5, 'CLAW MACHINES', PALETTE.slate).setDepth(2).setAlpha(0.5);
      return;
    }
    this.add.rectangle(x, y, 122, 26, PALETTE.ink).setStrokeStyle(1, PALETTE.neon).setDepth(1);
    this.add.rectangle(x, y, 118, 22, PALETTE.plum, 0.35).setDepth(1);
    centerText(this, x, y - 5, 'GAME CORNER', PALETTE.gold).setDepth(2);
    centerText(this, x, y + 5, 'CLAW MACHINES', PALETTE.neon).setDepth(2);
    // It buzzes like every other sign in the building.
    const glow = this.add.rectangle(x, y, 126, 30, PALETTE.neon, 0.08).setDepth(0.9);
    this.tweens.add({ targets: glow, alpha: 0.02, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private paintDoorway(): void {
    // The opening back to the hub, in this room's left wall, lit the hub's pink.
    paintOpening(this, { side: 'left', y: BACK_DOOR.y, glow: PALETTE.neon, night: this.night });
    this.add
      .zone(BACK_DOOR.x, BACK_DOOR.y, 26, 50)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (!this.busy()) this.toHub();
      });
  }

  /**
   * The side door in the right-hand wall.  It is IN the wall, not on it: the
   * leaf fills a door-sized patch of the wall's own band and nothing of it
   * reaches past the wall's face into the room -- no frame, no step, no edge
   * standing proud.  All there is to see is a pair of hairline seams and a
   * leaf a shade warmer than the wall round it: by day almost nothing, after
   * closing a dim brown door.  It swings open and shut within that patch.
   */
  private paintSideDoor(): void {
    const top = SIDE_DOOR.y - SIDE_DOOR.h / 2;
    // the wall's band runs from the room's right edge to the screen's
    const x = ROOM.right + 1;
    const w = GAME_W - ROOM.right - 2;
    const wall = new Phaser.Display.Color(...rgb(PALETTE.ink));
    const warm = new Phaser.Display.Color(...rgb(this.night ? 0x2e2218 : PALETTE.brown));
    // by day a quarter of the way from the wall to brown; at night the door itself
    const mix = Phaser.Display.Color.Interpolate.ColorWithColor(wall, warm, 100, this.night ? 100 : 22);
    const leafColour = Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b);
    // what is behind it when it is open: nothing but black
    const gap = this.add.rectangle(x, top, w, SIDE_DOOR.h, PALETTE.black).setOrigin(0, 0).setDepth(0.56);
    const leaf = this.add.rectangle(x, top, w, SIDE_DOOR.h, leafColour).setOrigin(0, 0).setDepth(0.57);
    // the seams: hairlines down the room-side edge and along the top, flush
    const seam = this.night ? 0.55 : 0.18;
    this.add.rectangle(x, top, 1, SIDE_DOOR.h, PALETTE.black).setOrigin(0, 0).setDepth(0.58).setAlpha(seam);
    this.add.rectangle(x, top, w, 1, PALETTE.black).setOrigin(0, 0).setDepth(0.58).setAlpha(seam);
    // and a handle, barely
    this.add
      .rectangle(x + 2, SIDE_DOOR.y + 2, 1, 3, this.night ? 0x5a4a38 : PALETTE.amberDark)
      .setOrigin(0, 0)
      .setDepth(0.58)
      .setAlpha(this.night ? 0.7 : 0.15);
    this.sideDoor = { leaf, gap };
  }

  /**
   * In from the alley: the door is standing open behind the player as the
   * room comes up, and swings shut on its own a moment later.
   */
  private shutBehind(): void {
    const d = this.sideDoor;
    if (!d) return;
    this.locked = true;
    d.leaf.setScale(0.15, 1);
    this.time.delayedCall(650, () => {
      this.tweens.add({
        targets: d.leaf,
        scaleX: 1,
        duration: 260,
        ease: 'Quad.easeIn',
        onComplete: () => {
          audio.sfx('door_shut', 0.7);
          this.cameras.main.shake(90, 0.003);
          this.locked = false;
        },
      });
    });
  }

  private say(msg: string): void {
    const m = this.mutter;
    if (!m) return;
    m.setText(msg).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(m);
    this.tweens.add({ targets: m, alpha: 0, delay: 1800, duration: 600 });
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
    if (this.target.kind === 'side') {
      audio.sfx('door_rattle', 0.7);
      this.say('The door is locked from the outside.');
      return;
    }
    if (this.target.kind === 'crane') {
      this.useCrane(this.target.crane);
      return;
    }
    this.launchGame(this.target.cab, 'play');
  }

  /**
   * A go on a claw machine: it costs what its plate says, and whatever comes
   * out of it goes in a pocket -- so it asks for a free one before it takes
   * the tokens, not after.
   */
  private useCrane(cr: (typeof CRANES)[number]): void {
    if (this.night) {
      this.say('Switched off. The glass is cold.');
      return;
    }
    if (pocketsFull()) {
      audio.sfx('buzzer');
      this.say(FULL_LINE);
      return;
    }
    if (!ledger.canAfford(cr.cost)) {
      audio.sfx('buzzer');
      this.say(`${cr.cost} tokens a go.`);
      return;
    }
    this.locked = true;
    fadeToScene(this, 'CraneGame', { kind: cr.kind });
  }

  private toHub(): void {
    this.locked = true;
    audio.sfx('footstep_carpet');
    // after closing the doorway goes to the lobby as it is now: dark
    if (this.night) fadeToScene(this, 'ArcadeDark', { fromLounge: true });
    else fadeToScene(this, 'ArcadeHub', { fromDoor: 'lounge' });
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
    if (!this.night) for (const c of this.cabinets) c.setAffordable(bal >= c.def.cost);

    this.target = this.findTarget();
    this.renderPrompt();
  }

  private findTarget(): Target {
    const px = this.player.x;
    const py = this.player.y;
    // After closing, the side door you came in by is something to try --
    // and the machines are switched off.
    if (this.night && px > ROOM.right - 32 && Math.abs(py - (SIDE_DOOR.y + SIDE_DOOR.h / 2)) < 26) return { kind: 'side' };
    let best: Cabinet | null = null;
    let bestD = this.night ? -1 : INTERACT_RANGE;
    for (const c of this.cabinets) {
      const d = c.distanceTo(px, py);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) return { kind: 'cabinet', cab: best };
    for (const cr of CRANES) if (Math.abs(px - cr.x) < 16 && py - cr.y >= -4 && py - cr.y < 22) return { kind: 'crane', crane: cr };
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
    } else if (t.kind === 'side') {
      msg = '[E] DOOR';
    } else if (t.kind === 'crane') {
      msg = this.night ? '[E] CRANE' : `[E] ${t.crane.title} - ${t.crane.cost} TOKENS`;
      colour = this.night || ledger.balance() >= t.crane.cost ? PALETTE.gold : PALETTE.ash;
    } else {
      msg = this.night ? '[E] LOBBY' : '[E] ARCADE';
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
