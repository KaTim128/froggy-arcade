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

import { resumeSpot, trackPlace } from '../../game/place';
import Phaser from 'phaser';
import { PALETTE } from '../../render/palette';
import { audio } from '../../core/audio';
import { KEYS } from '../../core/input';
import { button, centerText, fadeIn, fadeToScene, pinToScreen, text } from '../../core/ui';
import { GAME_W, GAME_H } from '../../render/pixelScaler';
import { TokenHud } from '../../ui/hud';
import { attachPockets } from '../../ui/pockets';
import { Player, depthFor, type Look } from '../../art/player';
import { froggyLayer } from '../../render/froggyLayer';
import { Walker, collide, doorSpot, machineSpot, type Box, type Spot } from '../../game/roomWalk';
import { paintEntrance, ENTRANCE_W, ENTRANCE_H } from '../../art/exterior';
import { touchControls } from '../../ui/touchControls';
import { grain, seeded } from '../../art/surface';
import { speak } from '../../ui/talkPanel';
import type { SpeakerId } from '../../ui/portraits';
import { backPlate, fitPrompt, SUBTITLE_Y } from '../../ui/plate';
import { SHOP_HOURS, clock, shopsOpen, type DayPhase } from '../../game/life';
import { onLightTurn, onPhaseTurn } from '../../game/dayNight';

/** The back wall's foot: the floor starts here. */
export const FLOOR_TOP = 100;
/** The lowest the feet go (the HUD strip along the bottom stays clear). */
export const FLOOR_BOTTOM = 170;
/**
 * What the street looks like through a shop's front doors, hour by hour: the
 * flat blue of the middle of the day, the low amber of the evening, and the
 * dark of the night with the lamps on in it.
 */
const SKY_THROUGH: Record<DayPhase, number> = { morning: 0xbfe0ee, evening: 0xf0a86a, night: 0x1a2038 };
/** And the light of that hour, washed over the whole doorway. */
const GLASS_WASH: Record<DayPhase, { col: number; a: number }> = {
  morning: { col: 0xbfe0ee, a: 0 },
  evening: { col: 0xd8632e, a: 0.28 },
  night: { col: 0x0a0e1c, a: 0.45 },
};

/** The way out: the arcade's glass doors, seen from inside, at the left of the back wall. */
export const EXIT_X = 34;
/**
 * Every shop's counter: just inside the doors, so whoever runs the place is
 * the first thing you meet coming in -- the counter's end on to the doorway,
 * its keeper behind it facing the door.  `COUNTER_RIGHT` is where the rest of
 * the shop can start.
 */
export const COUNTER_X = EXIT_X + 54;
export const COUNTER_W = 46;
export const COUNTER_RIGHT = COUNTER_X + COUNTER_W / 2 + 14;

export interface CounterOpts {
  /** Who stands behind it. */
  look: Look;
  /** Its top, its front, and the edge along the top. */
  top: number;
  front: number;
  trim: number;
  /** Who talks, and what they say. */
  who: SpeakerId;
  line: string;
  /** Something on it: a till, a bell, a stack of books. Drawn at the counter's top. */
  dress?: (g: Phaser.GameObjects.Graphics, x: number, top: number) => void;
  /**
   * What [E] at the counter does instead of a line of talk: the shops put
   * their whole stock on one card here (see scenes2d/Shop), which is the
   * only part of a shop a phone has to be able to reach.
   */
  onUse?: () => void;
  /** The prompt for that, when there is one. */
  useLabel?: string;
}

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
  /** The prompt goes under your feet, not over your head (so it does not cover whoever is behind a counter). */
  promptBelow?: boolean;
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
  /** Where what is said goes, across the screen (a room whose floor is down there moves it up). */
  protected mutterY = SUBTITLE_Y;
  protected panel: Phaser.GameObjects.Container | null = null;
  protected exitDoor!: Fixture;
  /** When a card or the wardrobe last closed: the Esc that closed it is not a pause. */
  private modalClosedAt = -Infinity;
  /** Sat on something: where you were standing, to step back to on getting up. */
  private seatReturn: { x: number; y: number } | null = null;

  /**
   * A shop keeps the shops' hours (see life `shopsOpen`): shut all night.
   * Night falling while you are in one, you are shown out; arriving at
   * night, you are not let in.
   */
  protected keepsShopHours = false;
  private closingNight = false;

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
    // (a room left with a panel open must not take the pad with it)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.releasePad());
    this.locked = false;
    this.closingNight = false;
    this.panel = null;
    this.talking = null;
    this.seatReturn = null;
    this.target = null;
    this.items = [];
    this.solids = [];
    fadeIn(this);
    audio.setScene({ music: this.music(), ambience: [] });

    this.bounds = new Phaser.Geom.Rectangle(10, this.floorTop + 8, this.worldW - 20, FLOOR_BOTTOM - this.floorTop - 8);
    this.paintRoom();
    this.paintDoor();

    // in through the doors: stood just inside them
    this.player = new Player(this, this.spawnX(), this.floorTop + 16);
    this.player.setSurface('carpet');
    this.cameras.main.setBounds(0, 0, this.worldW, GAME_H);
    if (this.worldW > GAME_W) this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);

    this.exitDoor = this.exitFixture();
    for (const f of [this.exitDoor, ...this.fixtures()]) this.addFixture(f);
    this.walker = new Walker(() => this.bounds, () => this.solids);

    new TokenHud(this);
    attachPockets(this, () => this.busy());
    this.promptPlate = this.add.rectangle(0, 0, 4, 12, PALETTE.black, 0.72).setDepth(800).setVisible(false);
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setDepth(801).setOrigin(0.5, 0.5).setVisible(false);
    this.mutter = centerText(this, GAME_W / 2, this.mutterY, '', PALETTE.cream).setDepth(860).setScrollFactor(0).setVisible(false).setMaxWidth(290);
    backPlate(this, this.mutter);

    const kb = this.input.keyboard;
    const bind = (n: readonly string[]) => (kb ? n.map((k) => kb.addKey(k)) : []);
    this.keys = { up: bind(KEYS.up), down: bind(KEYS.down), left: bind(KEYS.left), right: bind(KEYS.right) };
    kb?.on('keydown-E', () => this.interact());
    kb?.on('keydown-ESC', () => this.closePanel());
    this.events.on('shop-closed', () => this.afterModal());
    this.entered();
    // Kept with the run, and put back on the spot when it was resumed here.
    // Sat down, the spot is where you stood up from, not the seat.
    trackPlace(
      this,
      () => {
        const p = this.player;
        if (!p) return null;
        if (!p.seated || !this.seatReturn) return p;
        const at = this.seatReturn;
        return { x: at.x, y: at.y, facing: p.facing, setPosition: (x: number, y: number) => p.setPosition(x, y), face: (d: number) => p.face(d) };
      },
      this.placeData(),
      resumeSpot(this.sys.settings.data),
    );
    if (this.keepsShopHours) {
      if (!shopsOpen()) this.time.delayedCall(300, () => this.closeForNight());
      onLightTurn(this, (dark) => dark && this.closeForNight());
    }
  }

  /** Night: whatever is open is put away, the keeper says so, and you are shown out. */
  protected closeForNight(): void {
    // (already on the way out of the door, or shown out already)
    if (this.closingNight || (this.locked && !this.scene.isActive('Shop'))) return;
    this.closingNight = true;
    this.closePanel();
    if (this.scene.isActive('Shop')) this.scene.stop('Shop');
    this.talking?.destroy();
    this.talking = null;
    if (this.player.seated) this.player.getUp();
    this.walker.cancel();
    this.locked = true;
    this.say(`WE ARE CLOSING FOR THE NIGHT. OPEN AGAIN ${SHOP_HOURS}.`);
    this.time.delayedCall(1800, () => {
      audio.sfx('door_open', 0.5);
      this.leave();
    });
  }

  /** The way out: by default the door standing at the left end of the floor. */
  protected exitFixture(): Fixture {
    return {
      x: EXIT_X,
      y: this.floorTop,
      w: ENTRANCE_W - 6,
      depth: 0,
      wall: true,
      label: () => '[E] LEAVE',
      use: () => this.goOut(),
      hit: { x: EXIT_X - ENTRANCE_W / 2, y: this.floorTop - ENTRANCE_H, w: ENTRANCE_W, h: ENTRANCE_H + 8 },
    };
  }

  /** What this room needs to be entered the same way again, when a run is resumed in it. */
  protected placeData(): Record<string, string | number | boolean> {
    return {};
  }

  /** Where you come in: just inside the door. */
  protected spawnX(): number {
    return EXIT_X;
  }

  /** Called once the room is up. */
  protected entered(): void {}

  /** A modal scene (the wardrobe, say) closed over this room. */
  protected afterModal(): void {
    this.modalClosedAt = performance.now();
    // (not when it was night that closed it: you are on your way out)
    if (!this.closingNight) this.locked = false;
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

  /**
   * The way out: the same glass doors as the arcade's (and every shop's) front,
   * from the inside -- the street's daylight through the glass, a lamp either
   * side, and a lit EXIT over them.
   */
  protected paintDoor(): void {
    const g = this.add.graphics().setDepth(1);
    // THE DAY, THROUGH THE GLASS.  The street outside is whatever hour it
    // actually is: the glass was painted a flat midday blue whatever the
    // clock said, so a quarter to eight in the evening looked like noon from
    // inside every shop.  The sky behind the doors is the hour's, and a wash
    // over the whole opening carries the light of it into the doorway -- and
    // it follows the hour over, so evening arriving while you are browsing is
    // seen in the doorway rather than waiting for you to leave.
    const c0 = clock();
    const night = c0.phase === 'night';
    const ent = paintEntrance(this, g, {
      doorX: EXIT_X,
      base: this.floorTop,
      lampY: this.floorTop - 30,
      closed: false,
      day: c0.phase === 'morning',
      night,
      c: (n) => n,
      inside: { back: SKY_THROUGH[c0.phase], floor: night ? 0x3a3a44 : 0x9a9488, band: night ? 0xc8d0e0 : 0xffffff, mat: 0x6a4a3a, spill: 0xfff0c0 },
      depth: 1,
    });
    const r = ent.rect;
    const wash = this.add.rectangle(r.x, r.y, r.w, r.h, GLASS_WASH[c0.phase].col, GLASS_WASH[c0.phase].a).setOrigin(0, 0).setDepth(1.6);
    onPhaseTurn(this, (phase) => {
      const w = GLASS_WASH[phase];
      this.tweens.add({ targets: wash, alpha: w.a, duration: 900 });
      wash.setFillStyle(w.col, w.a);
    });
    const top = this.floorTop - ENTRANCE_H - 9;
    g.fillStyle(0x14100c, 1).fillRect(EXIT_X - 11, top - 1, 22, 9);
    g.fillStyle(0x1e6a3a, 1).fillRect(EXIT_X - 10, top, 20, 7);
    text(this, EXIT_X, top + 4, 'EXIT', 0xbfffd0).setOrigin(0.5, 0.5).setDepth(2);
  }

  /**
   * The finish the arcade's rooms have: a weave of lighter and darker specks
   * over the wall and the floor, the floor darkening along the foot of the
   * wall and into the ends of the room, a few scuffs where people walk, and
   * the pools the ceiling lights make on it.  Every shop calls it with the
   * colours of its own wall and floor once it has painted them.
   */
  protected surfaces(wall: number, floor: number, floorGrain = 0.05): void {
    const W = this.worldW;
    const top = this.floorTop;
    const g = this.add.graphics().setDepth(0.5);
    grain(g, 0, 0, W, top - 6, wall, 31 + W, 0.035, 0.08);
    grain(g, 0, top, W, GAME_H - top, floor, 47 + W, floorGrain, 0.1);
    // the contact shadow along the foot of the wall, and the dark ends
    for (let i = 0; i < 6; i++) {
      g.fillStyle(0x000000, 0.07 * (6 - i) / 6);
      g.fillRect(0, top + i * 2, W, 2);
      g.fillRect(i * 3, top, 3, GAME_H - top);
      g.fillRect(W - 3 - i * 3, top, 3, GAME_H - top);
    }
    // scuffs, where the traffic is
    const rnd = seeded(W);
    g.fillStyle(0x000000, 0.08);
    for (let i = 0; i < Math.round(W / 14); i++) {
      g.fillRect(20 + Math.floor(rnd() * (W - 40)), top + 14 + Math.floor(rnd() * (GAME_H - top - 24)), 2 + Math.floor(rnd() * 5), 1);
    }
    // the ceiling lights' pools on the floor
    for (let x = 60; x < W; x += 110) {
      this.add.ellipse(x, top + 34, 90, 26, 0xfff0c8, 0.07).setDepth(0.6).setBlendMode(Phaser.BlendModes.ADD);
    }
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
      !!this.talking ||
      this.scene.isActive('Shop') ||
      this.scene.isActive('SettingsModal') ||
      this.scene.isActive('Goals') ||
      this.scene.isActive('InventoryModal')
    );
  }

  /**
   * The counter by the door and its keeper (see COUNTER_X): drawn, made solid
   * from the wall to its front so nobody walks round behind it, and a fixture
   * to talk to them at.
   */
  protected paintCounter(o: CounterOpts): Fixture {
    const x = COUNTER_X;
    const w = COUNTER_W;
    const front = this.floorTop + 30;
    const top = front - 15;
    // the keeper, behind it: feet hidden by the counter, facing the doors
    const keeper = new Player(this, x + 4, this.floorTop + 21, false, o.look);
    keeper.sprite.setScale(-1, 1);
    const g = this.add.graphics().setDepth(depthFor(front));
    // its shadow on the floor
    g.fillStyle(0x000000, 0.18).fillRect(x - w / 2 + 1, front, w, 3);
    // the body: ink outline, the front panel with its edge and its kick plate
    g.fillStyle(0x14100c, 1).fillRect(x - w / 2 - 1, top - 1, w + 2, front - top + 2);
    g.fillStyle(o.front, 1).fillRect(x - w / 2, top + 3, w, front - top - 3);
    g.fillStyle(0x000000, 0.18).fillRect(x - w / 2, front - 3, w, 3);
    for (let k = x - w / 2 + 8; k < x + w / 2 - 4; k += 10) g.fillStyle(0x000000, 0.12).fillRect(k, top + 6, 1, front - top - 10);
    // the top, and its lit edge
    g.fillStyle(o.top, 1).fillRect(x - w / 2 - 2, top, w + 4, 3);
    g.fillStyle(o.trim, 1).fillRect(x - w / 2 - 2, top + 3, w + 4, 1);
    g.fillStyle(0xffffff, 0.25).fillRect(x - w / 2 - 2, top, w + 4, 1);
    o.dress?.(g, x, top);
    return {
      x,
      y: front,
      w,
      depth: front - this.floorTop,
      label: () => o.useLabel ?? (o.onUse ? '[E] THE COUNTER' : '[E] TALK'),
      use: () => (o.onUse ? o.onUse() : this.talkAs(o.who, o.line)),
      promptBelow: true,
      hit: { x: x - w / 2 - 2, y: this.floorTop - 6, w: w + 4, h: front - this.floorTop + 8 },
    };
  }

  /** Somebody in the room says something: their box, their portrait. */
  protected talkAs(who: SpeakerId, line: string): void {
    if (this.talking) return;
    this.player.move(0, 0, 16, this.bounds);
    this.talking = speak(this, who, line, () => (this.talking = null));
  }

  protected talking: Phaser.GameObjects.Container | null = null;

  protected say(m: string): void {
    this.mutter.setText(m).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.mutter);
    this.tweens.add({ targets: this.mutter, alpha: 0, delay: 2400, duration: 500 });
  }

  protected interact(): void {
    if (this.panel) return;
    // (on the way somewhere: it is used when you get there, not on the way)
    if (this.walker.active) return;
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
    // (every button in it answers where it is drawn, however far the camera
    // has followed the player along a room wider than the screen)
    pinToScreen(c);
    this.panel = c;
    // THE PAD GOES WHILE THE PANEL IS UP.  On a phone the arrows and the E
    // button are real elements over the picture, so they take the tap before
    // the canvas under them ever sees it -- and the panel's own buttons sit
    // in exactly that corner.  That is why BUY, WEAR and the barber's arrows
    // did nothing on a phone: the thing being pressed was the d-pad.
    if (!this.padHeld) {
      this.padHeld = true;
      touchControls.holdStick();
    }
    this.player.move(0, 0, 16, this.bounds);
  }

  protected closePanel(): void {
    if (!this.panel) return;
    this.panel.destroy();
    this.panel = null;
    this.releasePad();
    this.modalClosedAt = performance.now();
  }

  /** The pad comes back when nothing is over it any more. */
  protected releasePad(): void {
    if (!this.padHeld) return;
    this.padHeld = false;
    touchControls.releaseStick();
  }

  private padHeld = false;

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
    const y = this.target.f.promptBelow ? Math.min(GAME_H - 8, py + 8) : Math.max(28, py - 36);
    this.prompt.setText(this.target.f.label()).setPosition(x, y).setVisible(true);
    fitPrompt(this.promptPlate, this.prompt);
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
