/**
 * ---- A ROOM YOU WALK ROUND.  The shops off the east street and your condo
 * are all one kind of place: a back wall, a floor, things standing on it
 * that you cannot walk through, and a door out.  Walk up to a thing -- or
 * tap it and you are walked there, round whatever is in the way -- and [E]
 * does whatever it does: usually opens a small panel with what it is, what
 * it costs, and what you can do with it.
 *
 * This is the arcade rooms' way of moving (game/roomWalk: footprints, a
 * place to stand, walk-to), so the shops feel like the arcade does.
 * Subclasses paint the room and say what is in it (`fixtures`).
 */

import Phaser from 'phaser';
import { PALETTE } from '../../render/palette';
import { audio } from '../../core/audio';
import { KEYS } from '../../core/input';
import { button, centerText, fadeIn, fadeToScene, text } from '../../core/ui';
import { GAME_W, GAME_H } from '../../render/pixelScaler';
import { TokenHud } from '../../ui/hud';
import { attachPockets } from '../../ui/pockets';
import { Player, depthFor, type Look } from '../../art/player';
import { froggyLayer } from '../../render/froggyLayer';
import { Walker, collide, doorSpot, machineSpot, type Box, type Spot } from '../../game/roomWalk';
import { pullBackAtClosing } from '../../game/closingPull';

/** The back wall's foot: the floor starts here. */
export const FLOOR_TOP = 100;
/** The lowest the feet go (the HUD strip along the bottom stays clear). */
export const FLOOR_BOTTOM = 170;

export interface Fixture {
  /** The middle of it, along the room. */
  x: number;
  /** Where it stands: its floor line.  (For something on the wall, the wall's foot.) */
  y: number;
  /** Its width. */
  w: number;
  /** How deep a footprint it has on the floor; 0 for a rug or something on the wall. */
  depth: number;
  /** On the back wall: you stand under it, at the wall's foot. */
  wall?: boolean;
  /** What the prompt says when you are stood at it. */
  label: () => string;
  /** [E] */
  use: () => void;
  /** Where it can be tapped, in room pixels (defaults to its own box). */
  hit?: { x: number; y: number; w: number; h: number };
}

export interface PanelButton {
  label: string;
  fn: () => void;
  disabled?: boolean;
  /** A fixed width (the < > arrows); the others share what is left. */
  w?: number;
}

export abstract class WalkRoom extends Phaser.Scene {
  protected player!: Player;
  protected locked = false;
  protected worldW = GAME_W;
  /** Where this room's floor starts (the back wall's foot). */
  protected floorTop = FLOOR_TOP;
  protected bounds!: Phaser.Geom.Rectangle;
  protected solids: Box[] = [];
  protected walker!: Walker;
  protected items: Array<{ f: Fixture; spot: Spot }> = [];
  protected target: { f: Fixture; spot: Spot } | null = null;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private prompt!: Phaser.GameObjects.BitmapText;
  private promptPlate!: Phaser.GameObjects.Rectangle;
  private mutter!: Phaser.GameObjects.BitmapText;
  protected panel: Phaser.GameObjects.Container | null = null;
  protected exitDoor!: Fixture;
  /** When a card or the wardrobe last closed: the Esc that closed it is not a pause. */
  private modalClosedAt = -Infinity;
  /** Sat on something: where you were standing, to step back to on getting up. */
  private seatReturn: { x: number; y: number } | null = null;

  /** Paint the room (wall, floor, the things in it) into the scene. */
  protected abstract paintRoom(): void;
  /** What there is to walk up to. */
  protected abstract fixtures(): Fixture[];
  /** Where the door out goes. */
  protected abstract leave(): void;
  /** Music for the room. */
  protected music(): string {
    return 'room_lounge';
  }

  create(): void {
    froggyLayer.clear();
    this.locked = false;
    this.panel = null;
    this.seatReturn = null;
    this.target = null;
    this.items = [];
    this.solids = [];
    fadeIn(this);
    audio.setScene({ music: this.music(), ambience: [] });

    this.bounds = new Phaser.Geom.Rectangle(10, this.floorTop + 8, this.worldW - 20, FLOOR_BOTTOM - this.floorTop - 8);
    this.paintRoom();
    this.paintDoor();

    this.player = new Player(this, this.spawnX(), FLOOR_BOTTOM - 14);
    this.player.setSurface('carpet');
    this.cameras.main.setBounds(0, 0, this.worldW, GAME_H);
    if (this.worldW > GAME_W) this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);

    this.exitDoor = this.exitFixture();
    for (const f of [this.exitDoor, ...this.fixtures()]) this.addFixture(f);
    this.walker = new Walker(() => this.bounds, () => this.solids);

    new TokenHud(this);
    attachPockets(this, () => this.busy());
    pullBackAtClosing(this, () => !this.busy(), () => (this.locked = true));
    this.promptPlate = this.add.rectangle(0, 0, 4, 12, PALETTE.black, 0.72).setDepth(800).setVisible(false);
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setDepth(801).setOrigin(0.5, 0.5).setVisible(false);
    this.mutter = centerText(this, GAME_W / 2, GAME_H - 30, '', PALETTE.cream).setDepth(860).setScrollFactor(0).setVisible(false).setMaxWidth(290);

    const kb = this.input.keyboard;
    const bind = (n: readonly string[]) => (kb ? n.map((k) => kb.addKey(k)) : []);
    this.keys = { up: bind(KEYS.up), down: bind(KEYS.down), left: bind(KEYS.left), right: bind(KEYS.right) };
    kb?.on('keydown-E', () => this.interact());
    kb?.on('keydown-ESC', () => this.closePanel());
    this.events.on('shop-closed', () => this.afterModal());
    this.entered();
  }

  /** The way out: by default the door standing at the left end of the floor. */
  protected exitFixture(): Fixture {
    return {
      x: 18,
      y: FLOOR_BOTTOM - 4,
      w: 16,
      depth: 0,
      label: () => '[E] LEAVE',
      use: () => this.goOut(),
      hit: { x: 4, y: this.floorTop + 20, w: 28, h: 52 },
    };
  }

  /** Where you come in: just inside the door. */
  protected spawnX(): number {
    return 30;
  }

  /** Called once the room is up. */
  protected entered(): void {}

  /** A modal scene (the wardrobe, say) closed over this room. */
  protected afterModal(): void {
    this.modalClosedAt = performance.now();
    this.locked = false;
    // (the wardrobe may have changed what you have on)
    this.refreshPlayer();
  }

  protected addFixture(f: Fixture): void {
    const spot = f.wall
      ? doorSpot({ x: f.x, y: this.floorTop + 12 }, (px, py) => Math.abs(px - f.x) <= Math.max(8, f.w / 2 + 3) && py < this.floorTop + 24)
      : f.depth > 0
        ? machineSpot(f.x, f.y, f.w, f.depth)
        : doorSpot({ x: f.x, y: Math.min(FLOOR_BOTTOM, f.y + 4) }, (px, py) => Math.abs(px - f.x) <= f.w / 2 + 4 && Math.abs(py - f.y) <= 10);
    this.items.push({ f, spot });
    if (spot.solid) this.solids.push(spot.solid);
    const h = f.hit ?? { x: f.x - f.w / 2 - 2, y: f.wall ? f.y - 60 : f.y - 30, w: f.w + 4, h: f.wall ? 60 : 32 };
    this.add
      .zone(h.x, h.y, h.w, h.h)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.walkTo(f, spot));
  }

  private walkTo(f: Fixture, spot: Spot): void {
    if (this.busy()) return;
    this.walker.to(this.player, spot, () => {
      if (!this.busy()) {
        this.target = { f, spot };
        f.use();
      }
    });
  }

  protected paintDoor(): void {
    // the door out, in the left wall: a frame, the street's light through it
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x14100c, 1).fillRect(4, this.floorTop + 18, 24, FLOOR_BOTTOM - this.floorTop - 16);
    g.fillStyle(0x5a3a22, 1).fillRect(5, this.floorTop + 19, 22, FLOOR_BOTTOM - this.floorTop - 18);
    g.fillStyle(0xbfe0ee, 0.9).fillRect(9, this.floorTop + 23, 14, 18);
    g.fillStyle(0xd8a838, 1).fillRect(23, this.floorTop + 46, 2, 2);
    text(this, 16, this.floorTop + 10, 'EXIT', 0x7fd88a).setOrigin(0.5, 0).setDepth(2);
  }

  protected goOut(): void {
    if (this.locked) return;
    this.locked = true;
    audio.sfx('door_open', 0.5);
    this.leave();
  }

  protected exitTo(scene: string, data: object): void {
    fadeToScene(this, scene, data);
  }

  protected busy(): boolean {
    return (
      this.locked ||
      !!this.panel ||
      this.scene.isActive('Shop') ||
      this.scene.isActive('SettingsModal') ||
      this.scene.isActive('Goals') ||
      this.scene.isActive('InventoryModal')
    );
  }

  protected say(m: string): void {
    this.mutter.setText(m).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.mutter);
    this.tweens.add({ targets: this.mutter, alpha: 0, delay: 2400, duration: 500 });
  }

  protected interact(): void {
    if (this.panel) return;
    if (this.busy() || !this.target) return;
    this.target.f.use();
  }

  /**
   * Esc closes the card that is up (or has just closed the wardrobe over the
   * room), and only that: it opens the pause menu when nothing else is open.
   */
  handleEscape(): boolean {
    if (this.panel) {
      this.closePanel();
      return true;
    }
    return performance.now() - this.modalClosedAt < 250;
  }

  // ------------------------------------------------------------------ panel

  /**
   * A card over the room: a title, lines, an optional picture drawn by
   * `preview` into the box on the left, and buttons along the bottom.
   * Movement stops while it is up; ESC or CLOSE takes it down.
   */
  protected openPanel(title: string, lines: string[], buttons: PanelButton[], preview?: (c: Phaser.GameObjects.Container, x: number, y: number) => void): void {
    this.closePanel();
    const W = 236;
    const H = 112;
    const x0 = (GAME_W - W) / 2;
    const y0 = 34;
    const c = this.add.container(0, 0).setDepth(900).setScrollFactor(0);
    c.add(this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.45).setOrigin(0, 0).setInteractive());
    c.add(this.add.rectangle(x0, y0, W, H, PALETTE.ink, 0.97).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold));
    c.add(text(this, x0 + 6, y0 + 5, title, PALETTE.gold));
    const pv = preview ? 70 : 0;
    if (preview) {
      c.add(this.add.rectangle(x0 + 6, y0 + 16, 64, 62, 0x10141e).setOrigin(0, 0).setStrokeStyle(1, 0x2a3040));
      preview(c, x0 + 38, y0 + 72);
    }
    lines.forEach((l, i) => c.add(text(this, x0 + 8 + pv, y0 + 18 + i * 10, l, i === 0 ? PALETTE.cream : PALETTE.fog).setMaxWidth(W - 14 - pv)));
    const all: PanelButton[] = [...buttons, { label: 'CLOSE', fn: () => this.closePanel() }];
    const fixed = all.reduce((n, b) => n + (b.w ?? 0), 0);
    const flex = all.filter((b) => !b.w).length;
    const bw = Math.floor((W - 12 - (all.length - 1) * 4 - fixed) / Math.max(1, flex));
    let bx = x0 + 6;
    for (const b of all) {
      const w = b.w ?? bw;
      c.add(button(this, bx + w / 2, y0 + H - 12, b.label, b.fn, { width: w, height: 12, disabled: b.disabled }));
      bx += w + 4;
    }
    this.panel = c;
    this.player.move(0, 0, 16, this.bounds);
  }

  protected closePanel(): void {
    if (!this.panel) return;
    this.panel.destroy();
    this.panel = null;
    this.modalClosedAt = performance.now();
  }

  // ------------------------------------------------------------------ frame

  update(_t: number, delta: number): void {
    if (this.busy()) {
      this.prompt.setVisible(false);
      this.promptPlate.setVisible(false);
      return;
    }
    const held = (k: string) => this.keys[k]?.some((x) => x.isDown) ?? false;
    const dx = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    const dy = (held('down') ? 1 : 0) - (held('up') ? 1 : 0);
    const before = { x: this.player.x, y: this.player.y };
    if (dx || dy) this.walker.cancel();
    if (this.player.seated && !dx && !dy && !this.walker.active) {
      // sat down: stays sat until moved
    } else if (this.seatReturn) {
      // up off the seat, back to where you stood (never left inside it)
      this.player.getUp();
      this.player.setPosition(this.seatReturn.x, this.seatReturn.y);
      this.seatReturn = null;
    } else if (this.walker.active) this.walker.drive(this.player, delta);
    else this.player.move(dx, dy, delta, this.bounds);
    collide(this.player, before, this.solids);
    this.tick(delta);

    const px = this.player.x;
    const py = this.player.y;
    this.target = this.items.find((it) => it.spot.at(px, py)) ?? null;
    if (!this.target) {
      this.prompt.setVisible(false);
      this.promptPlate.setVisible(false);
      return;
    }
    const x = Phaser.Math.Clamp(px, this.cameras.main.scrollX + 50, this.cameras.main.scrollX + GAME_W - 50);
    const y = Math.max(28, py - 36);
    this.prompt.setText(this.target.f.label()).setPosition(x, y).setVisible(true);
    this.promptPlate.setPosition(x, y).setSize(this.prompt.width + 6, 11).setVisible(true);
  }

  /**
   * Sit on something at (x, y) -- a chair, a sofa, the barber's chair -- or
   * lie on a bed (`floor`).  Any move gets up again, back where you stood.
   */
  protected sitOn(x: number, y: number, kind: 'chair' | 'floor', facing = 1): void {
    this.walker.cancel();
    this.seatReturn = { x: this.player.x, y: this.player.y };
    this.player.setPosition(x, y);
    this.player.sit(kind, { facing });
  }

  /**
   * Draw the player again -- in what they now have on, or in `look` (a
   * preview: the barber's mirror, a fitting) -- where they are, sat or not.
   */
  protected refreshPlayer(look?: Look): void {
    const { x, y } = this.player;
    const seated = this.player.seated;
    this.player.sprite.destroy();
    this.player = look ? new Player(this, x, y, false, look) : new Player(this, x, y);
    this.player.setSurface('carpet');
    if (seated) this.player.sit('chair', { facing: 1 });
    if (this.worldW > GAME_W) this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);
  }

  /** Each frame, for the room's own business. */
  protected tick(_delta: number): void {}

  /** A depth for something standing on `y`, sorted with the player. */
  protected depthAt(y: number): number {
    return depthFor(y);
  }
}
