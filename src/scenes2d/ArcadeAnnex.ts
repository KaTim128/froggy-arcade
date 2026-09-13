/**
 * The back room.  PRD §7.5, second floor space.
 *
 * The hub had run out of wall — nine cabinets left the middle of the floor
 * occupied and nowhere to put a tenth.  This is the room through the opening on
 * the hub's left wall: same arcade, more floor, and space for games that have
 * not been built yet.
 *
 * Deliberately thinner than the hub: no bell, no prize counter, no tutorial.
 * Everything that only happens once happens in there, not in here.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store, type GameId } from '../core/state';
import { ledger } from '../core/ledger';
import { canEnter } from '../core/routes';
import { KEYS } from '../core/input';
import { fadeIn, fadeToScene, text } from '../core/ui';
import { paintArcadeDressing, paintHubRoom, paintOpening, ROOM } from '../art/hubRoom';
import { Player } from '../art/player';
import { Cabinet, CAB_W, CAB_H } from '../art/cabinet';
import { TokenHud } from '../ui/hud';
import { CASINO_DOOR, CABINETS, cabinetsIn } from '../game/content';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W } from '../render/pixelScaler';

const INTERACT_RANGE = 24;
/** The way back, on this room's right wall. */
const BACK_DOOR = { x: GAME_W - 20, y: 118 };

type Target = { kind: 'cabinet'; cab: Cabinet } | { kind: 'back' } | { kind: 'casino' } | null;

export class ArcadeAnnex extends Phaser.Scene {
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
    super('ArcadeAnnex');
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

    // No front door in here: the only way out of the building is the hub.
    paintHubRoom(this, { night: false, frontDoor: false });
    paintArcadeDressing(this, {
      night: false,
      // The back room fills its middle with machines, the strip past the last
      // cabinet is the way in from the hub, and the LEFT WALL IS THE WAY ON TO
      // THE CASINO — so the whole left-hand side stays bare.  A plant stood
      // there in two different corners and read as blocking the opening in
      // both; a doorway you have to be told is a doorway is worth more than a
      // pot plant.  The bin goes up against the back wall on the right, well
      // away from either way out, and that is the lot.
      props: [{ x: 268, y: 62, kind: 'bin' }],
      // Clear of the poster at 187-205 and the WIN sign at 245-279.
      vents: [24, 210],
    });
    this.paintDoorway();
    this.paintCasinoDoor();

    this.cabinets = cabinetsIn('annex').map((def) => new Cabinet(this, def));
    for (const cab of this.cabinets) {
      this.add
        .zone(cab.def.x, cab.def.y - CAB_H / 2, CAB_W + 4, CAB_H + 2)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (this.busy()) return;
          this.launchGame(cab);
        });
    }

    this.bounds = new Phaser.Geom.Rectangle(
      ROOM.left + 8,
      ROOM.top + 6,
      ROOM.right - ROOM.left - 16,
      ROOM.bottom - ROOM.top - 6,
    );
    // You come in through the right-hand doorway, so you arrive next to it.
    const spawn = this.spawnPoint({ x: BACK_DOOR.x - 16, y: BACK_DOOR.y });
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
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0 || this.busy()) return;
      this.interact();
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.busy()) this.scene.launch('SettingsModal', { from: 'ArcadeAnnex' });
    });

    store.flush();
  }

  private paintDoorway(): void {
    // The opening back to the hub, cut into the right wall.
    paintOpening(this, { side: 'right', y: BACK_DOOR.y, glow: PALETTE.neon });

    this.add
      .zone(BACK_DOOR.x, BACK_DOOR.y, 26, 50)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (!this.busy()) this.toHub();
      });
  }

  /** On through the left wall, to the machines that take money. */
  private paintCasinoDoor(): void {
    // Gold, because that is the colour of the room on the other side of it —
    // the light coming out of an opening is the first thing that says where it
    // goes.
    paintOpening(this, { side: 'left', y: CASINO_DOOR.y, glow: PALETTE.gold });

    this.add
      .zone(CASINO_DOOR.x, CASINO_DOOR.y, 26, 50)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (!this.busy()) this.toCasino();
      });
  }

  private toCasino(): void {
    this.locked = true;
    audio.sfx('footstep_concrete');
    fadeToScene(this, 'ArcadeCasino');
  }


  /**
   * Where to stand when a cabinet hands you back.  Just below its base, which
   * is inside interact range — so the prompt is already up and you can play it
   * again without walking anywhere.
   */
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
    return this.locked || this.scene.isActive('SettingsModal');
  }

  private interact(): void {
    if (this.busy() || !this.target) return;
    if (this.target.kind === 'back') {
      this.toHub();
      return;
    }
    if (this.target.kind === 'casino') {
      this.toCasino();
      return;
    }
    this.launchGame(this.target.cab);
  }

  private toHub(): void {
    this.locked = true;
    audio.sfx('footstep_concrete');
    fadeToScene(this, 'ArcadeHub');
  }

  private launchGame(cab: Cabinet): void {
    // Nothing is charged for walking up to a machine (MG-2).  The shell opens
    // on the how-to-play card with the game unbuilt behind it, and the tokens
    // move when the player presses PLAY — so a player who cannot afford this
    // cabinet may still read what it wants and walk away.
    if (!canEnter('Minigame', store.get(), {})) {
      audio.sfx('buzzer');
      return;
    }
    this.locked = true;
    fadeToScene(this, 'Minigame', { id: cab.def.id, from: 'ArcadeAnnex' });
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

    if (px > BACK_DOOR.x - 22 && Math.abs(py - BACK_DOOR.y) < 28) return { kind: 'back' };
    if (px < CASINO_DOOR.x + 20 && Math.abs(py - CASINO_DOOR.y) < 28) return { kind: 'casino' };
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
      // Name the game on the prompt.  A row of cabinets that all say PLAY is a
      // row of identical boxes: the marquee is too small to read at this size,
      // so the thing you are about to spend tokens on says so here.
      msg = `[E] ${t.cab.def.title} - ${cost} TOKEN${cost === 1 ? '' : 'S'}`;
      colour = ledger.balance() >= cost ? PALETTE.gold : PALETTE.ash;
    } else if (t.kind === 'casino') {
      msg = '[E] THE MACHINES';
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
