/**
 * The machines that take money.  Through the opening on the annex's left wall.
 *
 * Slots, Froggy's blackjack table, and the chamber cabinet.  Same token economy
 * as every other cabinet in the building — nothing here costs anything but
 * tokens, and the chamber machine is a cylinder diagram on a cabinet face, not
 * a person.
 *
 * Blackjack is the exception to the wall of machines: a felt table with Froggy
 * dealing behind it.  He is drawn on the overlay, never as a sprite (FR-1).
 *
 * Darker and quieter than the arcade floor.  Nobody has ever won in here.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store, type GameId } from '../core/state';
import { ledger } from '../core/ledger';
import { canEnter } from '../core/routes';
import { KEYS } from '../core/input';
import { fadeIn, fadeToScene, text } from '../core/ui';
import { paintCasinoDressing, paintHubRoom, ROOM } from '../art/hubRoom';
import { Player } from '../art/player';
import { Cabinet } from '../art/cabinet';
import { BlackjackTable } from '../art/blackjackTable';
import { PrizeWheel } from '../art/prizeWheel';
import { TokenHud } from '../ui/hud';
import { CABINETS, cabinetsIn } from '../game/content';
import { froggyLayer } from '../render/froggyLayer';
import { drawFroggy } from '../froggy/froggy';
import { GAME_W, GAME_H } from '../render/pixelScaler';

const INTERACT_RANGE = 24;
/** The way back, on this room's right wall. */
const BACK_DOOR = { x: GAME_W - 20, y: 118 };

/** Anything you can walk up to and play.  The table is not a cabinet. */
type Fixture = Cabinet | BlackjackTable | PrizeWheel;

type Target = { kind: 'cabinet'; cab: Fixture } | { kind: 'back' } | null;

export class ArcadeCasino extends Phaser.Scene {
  private player!: Player;
  private bounds!: Phaser.Geom.Rectangle;
  private keys!: Record<string, Phaser.Input.Keyboard.Key[]>;
  private cabinets: Fixture[] = [];
  private table: BlackjackTable | null = null;
  /** Seconds, for the dealer's idle.  He breathes; the room does not. */
  private clock = 0;
  private prompt!: Phaser.GameObjects.BitmapText;
  private promptPlate!: Phaser.GameObjects.Rectangle;
  private mutter!: Phaser.GameObjects.BitmapText;
  private target: Target = null;
  private locked = false;
  private returnTo: GameId | null = null;

  constructor() {
    super('ArcadeCasino');
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
    this.table = null;
    this.clock = 0;

    fadeIn(this);
    // Its own music, and no ambience: the neon buzz read as static in here.
    audio.setScene({ music: 'casino_chiptune' });

    // No front door in here: the only way out of the building is the hub.
    paintHubRoom(this, { night: false, frontDoor: false, theme: 'casino' });
    paintCasinoDressing(this);
    this.paintDoorway();

    this.cabinets = cabinetsIn('casino').map((def) => {
      if (def.fixture === 'wheel') return new PrizeWheel(this, def);
      if (def.fixture !== 'table') return new Cabinet(this, def);
      const t = new BlackjackTable(this, def);
      this.table = t;
      return t;
    });
    for (const cab of this.cabinets) {
      const b = cab.bounds;
      this.add
        .zone(b.centerX, b.centerY, b.width, b.height)
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
    this.mutter = text(this, GAME_W / 2, GAME_H - 26, '', PALETTE.fog)
      .setOrigin(0.5, 0.5)
      .setDepth(802)
      .setVisible(false);

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
      if (this.busy()) return;
      // The dealer lives on the overlay, above every Phaser scene including
      // the settings panel, and the panel pauses this scene — so he is wiped
      // here, before it opens, or he sits in the middle of the sliders.
      froggyLayer.clear();
      this.scene.launch('SettingsModal', { from: 'ArcadeCasino' });
    });

    // The overlay is one canvas shared by every scene, so this room hands it
    // back the moment it stops owning it.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => froggyLayer.clear());

    store.flush();
  }

  /**
   * The dealer, sat at his own table.
   *
   * He is drawn LOW and clipped off at the felt, so the table edge crosses his
   * belly and everything below it is behind the table: from the floor he reads
   * as someone sitting at the far side dealing, rather than a mascot standing
   * behind a piece of furniture.  That is the whole point of him being there —
   * a player who walks past has to be able to tell at a glance that the frog
   * runs this game.
   */
  private paintDealer(): void {
    const spot = this.table?.dealerSpot();
    if (!spot) return;
    froggyLayer.paint((ctx) => {
      // Clip to everything above the felt: no legs, no feet, no floating.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, GAME_W, spot.y);
      ctx.clip();
      drawFroggy(ctx, {
        x: spot.x,
        // Below the cut line, so the bottom third of him is behind the table.
        y: spot.y + 13,
        height: 40,
        variant: 'cozy',
        pose: this.target?.kind === 'cabinet' && this.target.cab === this.table ? 'talk' : 'idleA',
        // Seated, so he sways rather than bounces: half the travel of a stand.
        bounce: (this.clock * 0.4) % 1,
      });
      ctx.restore();
    });
  }

  private paintDoorway(): void {
    // The opening back to the hub, cut into the right wall.
    this.add.rectangle(ROOM.right - 2, BACK_DOOR.y, 12, 46, PALETTE.black).setOrigin(0, 0.5);
    this.add.rectangle(ROOM.right - 4, BACK_DOOR.y, 4, 46, PALETTE.ink).setOrigin(0, 0.5);
    text(this, ROOM.right - 52, BACK_DOOR.y - 34, 'BACK ROOM', PALETTE.ash).setAlpha(0.7);

    this.add
      .zone(BACK_DOOR.x, BACK_DOOR.y, 26, 50)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (!this.busy()) this.toAnnex();
      });
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
      this.toAnnex();
      return;
    }
    this.launchGame(this.target.cab);
  }

  private toAnnex(): void {
    this.locked = true;
    audio.sfx('footstep_concrete');
    froggyLayer.clear();
    fadeToScene(this, 'ArcadeAnnex');
  }

  private launchGame(cab: Fixture): void {
    const { cost } = cab.def;
    // The table and the wheel cost nothing to walk up to: their rules are
    // free to read and the first token moves when the player deals or spins.
    // Everything else takes its coin at the door.
    const free = cab.def.freeToEnter === true;
    if (!free && !canEnter('Minigame', store.get(), { cost })) {
      audio.sfx('buzzer');
      this.say(
        cab.def.fixture === 'table'
          ? `TABLE MINIMUM IS ${cost} — COME BACK WITH IT`
          : `NOT ENOUGH TOKENS — NEED ${cost}`,
      );
      return;
    }
    if (!free && !ledger.debit(cost, 'game.cost')) {
      audio.sfx('buzzer');
      return;
    }
    store.bumpGamePlayed(cab.def.id);
    store.flush();
    this.locked = true;
    froggyLayer.clear();
    fadeToScene(this, 'Minigame', { id: cab.def.id, from: 'ArcadeCasino' });
  }

  private say(msg: string): void {
    this.mutter.setText(msg).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.mutter);
    this.tweens.add({ targets: this.mutter, alpha: 0, delay: 1200, duration: 500 });
  }

  update(_time: number, delta: number): void {
    if (this.busy()) {
      this.promptPlate.setVisible(false);
      this.prompt.setVisible(false);
      froggyLayer.clear();
      return;
    }

    this.clock += delta / 1000;
    this.paintDealer();

    const dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const dy = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    this.player.move(dx, dy, delta, this.bounds);

    const bal = ledger.balance();
    // A free fixture never reads as unaffordable — you can always walk up to
    // the table or the wheel, whatever is in your pocket.
    for (const c of this.cabinets) c.setAffordable(c.def.freeToEnter === true || bal >= c.def.cost);

    this.target = this.findTarget();
    this.renderPrompt();
  }

  private findTarget(): Target {
    const px = this.player.x;
    const py = this.player.y;

    let best: Fixture | null = null;
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
      // The table and the wheel take a bet, not a price — walking up to them
      // costs nothing, so the prompt says what a go costs rather than what the
      // door costs, and it never greys out: you can always read the rules.
      if (t.cab.def.freeToEnter) {
        msg =
          t.cab.def.fixture === 'table'
            ? `[E] ${t.cab.def.title} - FREE TO SIT, ${cost} MIN BET`
            : `[E] ${t.cab.def.title} - FREE TO LOOK, ${cost} A SPIN`;
        colour = PALETTE.gold;
      } else {
        msg = `[E] ${t.cab.def.title} - ${cost} TOKEN${cost === 1 ? '' : 'S'}`;
        colour = ledger.balance() >= cost ? PALETTE.gold : PALETTE.ash;
      }
    } else {
      msg = '[E] BACK ROOM';
    }

    this.prompt.setText(msg).setTint(colour === PALETTE.gold ? 0xffd45e : 0x5c6b7d);
    const x = Phaser.Math.Clamp(this.player.x, 70, GAME_W - 70);
    // Above the player's head, except at the table: Froggy stands there, on an
    // overlay nothing in the world can draw over, and he ate half the line.
    const atTable = t.kind === 'cabinet' && t.cab.def.fixture === 'table';
    const y = atTable ? Math.min(this.player.y + 20, GAME_H - 36) : this.player.y - 34;
    this.prompt.setPosition(x, y).setVisible(true);
    this.promptPlate
      .setPosition(x, y)
      .setSize(this.prompt.width + 6, 11)
      .setVisible(true);
  }
}
