/**
 * Hide and seek.  Three rooms behind the basement door.
 *
 * The chase in Act VI is about navigation; this is about stillness.  Froggy
 * sweeps the room on his own business and only becomes fast once he has
 * actually seen you — so the game is won by breaking his line of sight and
 * staying broken, not by outrunning him.  He is faster than you in a straight
 * line, deliberately: running is a losing move on its own.
 *
 * Survive the room's minute and the door opens.  Three rooms, three settings,
 * props scattered fresh every time so a memorised route is worth nothing.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { KEYS } from '../core/input';
import { centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { froggyLayer } from '../render/froggyLayer';
import { drawFroggy } from '../froggy/froggy';

const ROOM = { left: 10, right: GAME_W - 10, top: 30, bottom: GAME_H - 10 };
const ROUND_MS = 60_000;

const PLAYER_SPEED = 62;
const SEARCH_SPEED = 30;
/** Faster than you.  Losing him means breaking sight, not winning a footrace. */
const CHASE_SPEED = 74;

const VIEW_RANGE = 78;
const VIEW_HALF_ANGLE = Math.PI / 3.4;
/** How long he keeps coming after losing sight of you. */
const MEMORY_MS = 2200;
const CATCH_DIST = 9;
const FROGGY_SPAWN = { x: ROOM.left + 24, y: ROOM.top + 22 };

export interface RoomTheme {
  name: string;
  floor: number;
  wall: number;
  grime: number;
  props: Array<{ w: number; h: number; color: number; top: number }>;
}

/** Three settings, so the run does not feel like one room three times. */
const THEMES: RoomTheme[] = [
  {
    name: 'STOCKROOM',
    floor: 0x2a2f38,
    wall: 0x191d24,
    grime: 0x141820,
    props: [
      { w: 22, h: 16, color: 0x6b4c2a, top: 0x8a6437 }, // crates
      { w: 16, h: 22, color: 0x5c4325, top: 0x7a5a31 },
      { w: 30, h: 12, color: 0x3f4a58, top: 0x55637a }, // shelving
    ],
  },
  {
    name: 'BREAK ROOM',
    floor: 0x333026,
    wall: 0x1f1d17,
    grime: 0x18160f,
    props: [
      { w: 34, h: 15, color: 0x6c3340, top: 0x8d4455 }, // couches
      { w: 26, h: 14, color: 0x3c5a4a, top: 0x4e7561 },
      { w: 18, h: 18, color: 0x5a4a2c, top: 0x76633b }, // tables
    ],
  },
  {
    name: 'PARTY ROOM',
    floor: 0x3a2430,
    wall: 0x241520,
    grime: 0x1b0f18,
    props: [
      { w: 36, h: 13, color: 0x7b4bd8, top: 0x9a6ff0 }, // long tables
      { w: 20, h: 20, color: 0xc23b52, top: 0xe05068 }, // ball pit walls
      { w: 14, h: 24, color: 0x2f6d63, top: 0x3f8d80 },
    ],
  },
];

interface Prop {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Props you can get behind.  All of them, but the flag keeps it explicit. */
  hideable: boolean;
}

type Mode = 'search' | 'chase' | 'suspicious';

export class HideAndSeek extends Phaser.Scene {
  private roomIndex = 0;
  private theme!: RoomTheme;

  private player = { x: 0, y: 0 };
  private playerDot!: Phaser.GameObjects.Rectangle;
  private hidden = false;
  private hideProp: Prop | null = null;

  private froggy = { x: 0, y: 0, dir: 0 };
  private mode: Mode = 'search';
  private memory = 0;
  private lastSeen = { x: 0, y: 0 };
  private waypoint = { x: 0, y: 0 };
  private repaintAcc = 0;

  private props: Prop[] = [];
  private timeLeft = ROUND_MS;
  private over = false;

  private clock!: Phaser.GameObjects.BitmapText;
  private banner!: Phaser.GameObjects.BitmapText;
  private hint!: Phaser.GameObjects.BitmapText;
  private alertRing!: Phaser.GameObjects.Arc;
  private keys!: Record<string, Phaser.Input.Keyboard.Key[]>;

  constructor() {
    super('HideAndSeek');
  }

  create(): void {
    // Phaser reuses scene instances, so every mutable field resets here.
    this.over = false;
    this.hidden = false;
    this.hideProp = null;
    this.mode = 'search';
    this.memory = 0;
    this.props = [];
    this.timeLeft = ROUND_MS;
    this.repaintAcc = 0;

    this.roomIndex = Phaser.Math.Clamp(store.get().hideRoom, 0, THEMES.length - 1);
    this.theme = THEMES[this.roomIndex];

    froggyLayer.clear();
    fadeIn(this);
    // The rooms keep the arcade's silence: no music, no bed.  Only him.
    audio.setScene({});

    this.paintRoom();
    this.scatterProps();

    this.player = { x: GAME_W / 2, y: ROOM.bottom - 14 };
    this.playerDot = this.add.rectangle(this.player.x, this.player.y, 7, 10, PALETTE.cream).setDepth(400);

    this.froggy = { ...FROGGY_SPAWN, dir: 0 };
    this.pickWaypoint();

    this.alertRing = this.add.circle(0, 0, 7).setStrokeStyle(1, PALETTE.blood).setDepth(500).setVisible(false);

    this.paintHud();

    this.keys = {
      up: this.bind(KEYS.up),
      down: this.bind(KEYS.down),
      left: this.bind(KEYS.left),
      right: this.bind(KEYS.right),
    };
    this.input.keyboard?.on('keydown-E', () => this.toggleHide());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => froggyLayer.clear());
  }

  private bind(names: readonly string[]): Phaser.Input.Keyboard.Key[] {
    const kb = this.input.keyboard;
    return kb ? names.map((n) => kb.addKey(n)) : [];
  }

  private held(group: string): boolean {
    return this.keys[group]?.some((k) => k.isDown) ?? false;
  }

  // ------------------------------------------------------------------ the room

  private paintRoom(): void {
    const t = this.theme;
    this.add.rectangle(0, 0, GAME_W, GAME_H, t.wall).setOrigin(0, 0);
    this.add.rectangle(ROOM.left, ROOM.top, ROOM.right - ROOM.left, ROOM.bottom - ROOM.top, t.floor).setOrigin(0, 0);

    // floor grime, so the room is not a flat slab
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(ROOM.left, ROOM.right - 6);
      const y = Phaser.Math.Between(ROOM.top, ROOM.bottom - 4);
      this.add.rectangle(x, y, Phaser.Math.Between(3, 10), 2, t.grime).setOrigin(0, 0).setAlpha(0.5);
    }
    // skirting
    this.add.rectangle(ROOM.left, ROOM.top, ROOM.right - ROOM.left, 2, t.grime).setOrigin(0, 0);

    // the door you came in by, welded shut behind you
    this.add.rectangle(GAME_W / 2, ROOM.bottom + 4, 26, 8, 0x1a1116).setOrigin(0.5, 0);
  }

  /**
   * Props on a jittered grid.  Random placement alone piles them up and leaves
   * whole corners bare, which is the difference between a room and a mess.
   */
  private scatterProps(): void {
    const cols = 5;
    const rows = 3;
    const cellW = (ROOM.right - ROOM.left) / cols;
    const cellH = (ROOM.bottom - ROOM.top - 18) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.22) continue; // gaps, so sightlines exist
        const def = Phaser.Utils.Array.GetRandom(this.theme.props);
        const cx = ROOM.left + c * cellW + cellW / 2 + Phaser.Math.Between(-6, 6);
        const cy = ROOM.top + 14 + r * cellH + cellH / 2 + Phaser.Math.Between(-5, 5);

        // Keep both spawns clear.  A prop on top of the player boxes them in on
        // arrival; a prop on top of Froggy wedges him against it and he never
        // takes another step for the whole minute.
        if (Math.abs(cx - GAME_W / 2) < 22 && cy > ROOM.bottom - 34) continue;
        if (Math.hypot(cx - FROGGY_SPAWN.x, cy - FROGGY_SPAWN.y) < 26) continue;

        const p: Prop = { x: cx, y: cy, w: def.w, h: def.h, hideable: true };
        this.props.push(p);

        this.add.rectangle(p.x, p.y, p.w, p.h, def.color).setDepth(100);
        this.add.rectangle(p.x, p.y - p.h / 2 + 2, p.w, 3, def.top).setDepth(101);
        this.add.rectangle(p.x, p.y + p.h / 2, p.w + 2, 2, 0x000000, 0.35).setDepth(99);
      }
    }
  }

  private paintHud(): void {
    this.add.rectangle(0, 0, GAME_W, 18, PALETTE.black, 0.8).setOrigin(0, 0).setDepth(900);
    text(this, 4, 5, `${this.theme.name}  ${this.roomIndex + 1}/${THEMES.length}`, PALETTE.ash).setDepth(901);
    this.clock = centerText(this, GAME_W - 34, 9, '', PALETTE.cream).setDepth(901);
    this.banner = centerText(this, GAME_W / 2, 84, '', PALETTE.blood, 16).setDepth(950).setVisible(false);
    this.hint = centerText(this, GAME_W / 2, GAME_H - 6, '[E] HIDE', PALETTE.fog)
      .setDepth(901)
      .setAlpha(0)
      .setOrigin(0.5, 1);
  }

  // ------------------------------------------------------------------ the loop

  update(_t: number, delta: number): void {
    if (this.over) return;

    this.timeLeft -= delta;
    this.clock.setText(`${Math.max(0, Math.ceil(this.timeLeft / 1000))}s`);
    this.clock.setTint(this.timeLeft < 10_000 ? PALETTE.gold : PALETTE.cream);
    if (this.timeLeft <= 0) {
      this.survive();
      return;
    }

    const dt = delta / 1000;
    this.movePlayer(dt);
    this.moveFroggy(dt, delta);
    this.paintFroggy(delta);

    if (!this.hidden && Phaser.Math.Distance.Between(this.froggy.x, this.froggy.y, this.player.x, this.player.y) < CATCH_DIST) {
      this.caught();
    }
  }

  private movePlayer(dt: number): void {
    const near = this.nearestHideable();
    this.hint.setAlpha(this.hidden ? 1 : near ? 1 : 0);
    this.hint.setText(this.hidden ? '[E] COME OUT' : '[E] HIDE');

    if (this.hidden) {
      // Tuck in behind the prop rather than standing where you pressed E, so
      // hiding reads as a place you are rather than a state you toggled.
      if (this.hideProp) {
        this.player.x = this.hideProp.x;
        this.player.y = this.hideProp.y + this.hideProp.h / 2 - 1;
        this.playerDot.setPosition(this.player.x, this.player.y);
      }
      this.playerDot.setAlpha(0.25);
      return;
    }
    this.playerDot.setAlpha(1);

    const dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const dy = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    if (dx === 0 && dy === 0) return;

    const len = Math.hypot(dx, dy) || 1;
    const nx = this.player.x + (dx / len) * PLAYER_SPEED * dt;
    const ny = this.player.y + (dy / len) * PLAYER_SPEED * dt;

    // props are solid: you go around them, which is what makes them cover
    if (!this.blocked(nx, this.player.y)) this.player.x = nx;
    if (!this.blocked(this.player.x, ny)) this.player.y = ny;

    this.player.x = Phaser.Math.Clamp(this.player.x, ROOM.left + 4, ROOM.right - 4);
    this.player.y = Phaser.Math.Clamp(this.player.y, ROOM.top + 5, ROOM.bottom - 5);
    this.playerDot.setPosition(this.player.x, this.player.y);
  }

  private moveFroggy(dt: number, delta: number): void {
    const canSee = !this.hidden && this.sees();

    if (canSee) {
      if (this.mode !== 'chase') {
        audio.sfx('buzzer');
        this.cameras.main.shake(160, 0.008);
      }
      this.mode = 'chase';
      this.memory = MEMORY_MS;
      this.lastSeen = { x: this.player.x, y: this.player.y };
    } else if (this.mode === 'chase') {
      this.memory -= delta;
      if (this.memory <= 0) {
        // He goes to where you were, has a look, then resumes his sweep.
        this.mode = 'suspicious';
        this.waypoint = { ...this.lastSeen };
      }
    }

    const target =
      this.mode === 'chase'
        ? { x: this.player.x, y: this.player.y }
        : this.mode === 'suspicious'
          ? this.lastSeen
          : this.waypoint;

    const speed = this.mode === 'chase' ? CHASE_SPEED : SEARCH_SPEED;
    const ax = target.x - this.froggy.x;
    const ay = target.y - this.froggy.y;
    const dist = Math.hypot(ax, ay);

    if (dist < 4) {
      if (this.mode === 'suspicious') this.mode = 'search';
      this.pickWaypoint();
    } else {
      this.froggy.dir = Math.atan2(ay, ax);
      const nx = this.froggy.x + (ax / dist) * speed * dt;
      const ny = this.froggy.y + (ay / dist) * speed * dt;
      // He walks around props too, and re-routes when he snags on one.
      const freeX = !this.blocked(nx, this.froggy.y);
      const freeY = !this.blocked(this.froggy.x, ny);
      if (freeX) this.froggy.x = nx;
      if (freeY) this.froggy.y = ny;
      if (!freeX && !freeY) {
        // Wedged into a corner of something.  Re-routing alone can pick another
        // blocked heading forever, so shove him toward open floor as well.
        const cx = (ROOM.left + ROOM.right) / 2;
        const cy = (ROOM.top + ROOM.bottom) / 2;
        this.froggy.x += Math.sign(cx - this.froggy.x) * speed * dt;
        this.froggy.y += Math.sign(cy - this.froggy.y) * speed * dt;
        if (this.mode !== 'chase') this.pickWaypoint();
      } else if (!freeX || !freeY) {
        if (this.mode !== 'chase') this.pickWaypoint();
      }
    }

    this.froggy.x = Phaser.Math.Clamp(this.froggy.x, ROOM.left + 6, ROOM.right - 6);
    this.froggy.y = Phaser.Math.Clamp(this.froggy.y, ROOM.top + 8, ROOM.bottom - 6);

    this.alertRing.setVisible(this.mode === 'chase').setPosition(this.froggy.x, this.froggy.y - 16);
  }

  private pickWaypoint(): void {
    this.waypoint = {
      x: Phaser.Math.Between(ROOM.left + 12, ROOM.right - 12),
      y: Phaser.Math.Between(ROOM.top + 12, ROOM.bottom - 12),
    };
  }

  /** Cone plus line of sight.  Props are what break it. */
  private sees(): boolean {
    const dx = this.player.x - this.froggy.x;
    const dy = this.player.y - this.froggy.y;
    const dist = Math.hypot(dx, dy);
    if (dist > VIEW_RANGE) return false;

    const delta = Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - this.froggy.dir);
    // Very close is felt, not seen — you cannot stand behind him and be safe.
    if (dist > 14 && Math.abs(delta) > VIEW_HALF_ANGLE) return false;

    const steps = Math.ceil(dist / 4);
    for (let i = 1; i < steps; i++) {
      const f = i / steps;
      if (this.blocked(this.froggy.x + dx * f, this.froggy.y + dy * f)) return false;
    }
    return true;
  }

  private blocked(x: number, y: number): boolean {
    for (const p of this.props) {
      if (Math.abs(x - p.x) < p.w / 2 + 3 && Math.abs(y - p.y) < p.h / 2 + 3) return true;
    }
    return false;
  }

  private nearestHideable(): Prop | null {
    let best: Prop | null = null;
    let bestD = 15;
    for (const p of this.props) {
      const d = Math.hypot(this.player.x - p.x, this.player.y - p.y);
      if (p.hideable && d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private toggleHide(): void {
    if (this.over) return;
    if (this.hidden) {
      this.hidden = false;
      this.hideProp = null;
      audio.sfx('footstep_concrete');
      return;
    }
    const p = this.nearestHideable();
    if (!p) return;
    this.hidden = true;
    this.hideProp = p;
    audio.sfx('hop_wet');
  }

  // ------------------------------------------------------------------- Froggy

  private paintFroggy(delta: number): void {
    // The overlay is a full-resolution repaint; 30Hz is plenty and halves it.
    this.repaintAcc += delta;
    if (this.repaintAcc < 33) return;
    this.repaintAcc = 0;

    const chasing = this.mode === 'chase';
    froggyLayer.paint((ctx) => {
      drawFroggy(ctx, {
        x: this.froggy.x,
        y: this.froggy.y + 6,
        height: 34,
        variant: 'monster',
        morph: 1,
        maw: chasing ? 1 : 0.2,
        blood: 0.65,
        pupil: chasing ? 0.5 : 0.12,
        t: this.time.now / 1000,
        shake: chasing ? 0.6 : 0,
      });
    });
  }

  // ------------------------------------------------------------------ endings

  private caught(): void {
    if (this.over) return;
    this.over = true;
    audio.scare();
    this.cameras.main.shake(500, 0.05);
    this.cameras.main.flash(120, 140, 6, 10);

    froggyLayer.paint((ctx) => {
      drawFroggy(ctx, {
        x: GAME_W / 2,
        y: 60,
        height: 380,
        variant: 'monster',
        anchor: 'face',
        morph: 1,
        maw: 1,
        blood: 1,
        pupil: 0.1,
        t: this.time.now / 1000,
        shake: 1,
      });
    });

    this.banner.setText('FOUND YOU').setVisible(true);
    this.time.delayedCall(1600, () => {
      froggyLayer.clear();
      // The room restarts — the run does not.  Being caught costs the minute.
      this.scene.restart();
    });
  }

  private survive(): void {
    if (this.over) return;
    this.over = true;
    audio.sfx('chime');
    this.banner.setTint(PALETTE.gold).setText('THE DOOR OPENS').setVisible(true);
    froggyLayer.clear();

    const next = this.roomIndex + 1;
    this.time.delayedCall(1800, () => {
      if (next >= THEMES.length) {
        store.patch({ route: 'chase', hideRoom: 0 });
        store.flush();
        fadeToScene(this, 'Chase3D');
        return;
      }
      store.patch({ hideRoom: next });
      store.flush();
      fadeToScene(this, 'HideAndSeek');
    });
  }
}
