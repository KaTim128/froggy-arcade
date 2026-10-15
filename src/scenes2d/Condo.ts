/**
 * ---- UNIT 612, LILY'S CONDOS.  Yours for as long as the rent is paid.
 *
 * A mid-range flat, and it comes bare: painted walls, an oak floor, a
 * fitted kitchenette, a window on the city and a blanket on the floor.  The
 * bed and the bathroom (toilet, basin, bath) are yours to buy at Home and
 * Hearth.  You walk round it like any room (see rooms/WalkRoom), and what
 * you have put in it is solid and USABLE: sit on the chairs and the sofa,
 * sleep in the bed (or on the blanket until you own one), switch the TV and
 * the lamps on, play the radio.  The coat hook by the door is your
 * wardrobe.  DECORATE places, moves, turns and takes away what you own, and
 * the room keeps it exactly where you left it.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { button, pinToScreen } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { furnitureById, type FurnitureDef } from '../game/catalog';
import { onPhaseTurn } from '../game/dayNight';
import { NIGHT_HOUR, SUNRISE_HOUR, twelveHour, clock, movePlacement, placeFurniture, removePlacement, sleep, visit, type Placement } from '../game/life';
import { useOf, washLine } from '../game/furnitureUse';
import { WalkRoom, type Fixture } from './rooms/WalkRoom';
import { Piece } from './rooms/piece';

const FLOOR_TOP = 124;
const FLOOR_BOTTOM = 160;
const WALL_TOP = 28;
const WALL_BOTTOM = 112;
const WINDOW = { x: 118, y: 34, w: 84, h: 62 };
/** The blanket on the floor, where you sleep until you own a bed. */
const BLANKET = { x: 278, y: 158 };

export class Condo extends WalkRoom {
  private room!: Phaser.GameObjects.Graphics;
  private ui!: Phaser.GameObjects.Container;
  private pieces: Piece[] = [];
  private outline!: Phaser.GameObjects.Graphics;
  private decorating = false;
  private picked: number | null = null;
  private dragging = false;
  private dragFrom: { x: number; y: number } | null = null;

  constructor() {
    super('Condo');
  }

  create(): void {
    this.floorTop = FLOOR_TOP;
    this.decorating = false;
    this.picked = null;
    this.dragging = false;
    this.pieces = [];
    super.create();
    visit('condo');
    this.ui = this.add.container(0, 0).setDepth(850).setScrollFactor(0);
    this.buildButtons();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.pointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.pointerMove(p));
    this.input.on('pointerup', () => this.pointerUp());
  }

  protected leave(): void {
    this.exitTo('Hotel', { area: 'lobby', from: 'lift' });
  }

  protected spawnX(): number {
    return 40;
  }

  protected paintDoor(): void {
    // (the door is part of the wall: see paintWalls)
  }

  protected exitFixture(): Fixture {
    return {
      x: 18,
      y: FLOOR_TOP + 10,
      w: 22,
      depth: 0,
      label: () => '[E] LEAVE',
      use: () => this.goOut(),
      hit: { x: 5, y: 58, w: 26, h: 66 },
    };
  }

  protected busy(): boolean {
    return super.busy() || this.decorating;
  }

  protected entered(): void {
    // the window keeps time: the sun crosses it, evening comes, night falls
    this.time.addEvent({ delay: 4000, loop: true, callback: () => this.paintWalls() });
    onPhaseTurn(this, (p) => {
      this.paintWalls();
      if (p === 'night') this.say('IT IS NIGHT. TIME FOR BED.');
      else if (p === 'evening') this.say('THE SUN IS GOING DOWN.');
      else this.say('SUNRISE. A NEW DAY.');
    });
  }

  // ------------------------------------------------------------------ room

  protected paintRoom(): void {
    this.room = this.add.graphics().setDepth(0);
    this.outline = this.add.graphics().setDepth(700);
    this.dim = this.add.graphics().setDepth(690);
    this.paintWalls();
    // the blanket, folded on the boards: a bed of sorts
    const b = this.add.graphics().setDepth(3);
    b.fillStyle(0x14100c, 1).fillRect(BLANKET.x - 15, BLANKET.y - 6, 30, 7);
    b.fillStyle(0x5a6a8a, 1).fillRect(BLANKET.x - 14, BLANKET.y - 5, 28, 5);
    b.fillStyle(0x7a8aaa, 1).fillRect(BLANKET.x - 14, BLANKET.y - 5, 28, 1);
    b.fillStyle(0xe8e0d0, 1).fillRect(BLANKET.x + 6, BLANKET.y - 7, 8, 3);
    // the coat hook by the door: your clothes
    const h = this.add.graphics().setDepth(2);
    h.fillStyle(0x3a2a1e, 1).fillRect(40, 78, 14, 2);
    h.fillStyle(0x6a6a44, 1).fillRect(41, 80, 5, 12);
    h.fillStyle(0x5a3a3a, 1).fillRect(48, 80, 4, 4);
    this.placePieces();
  }

  /** Every placed piece, as a thing in the room. */
  private placePieces(): void {
    for (const p of this.pieces) p.destroy();
    this.pieces = [];
    for (const pl of store.get().life.placed) {
      const f = furnitureById(pl.id);
      if (f) this.pieces.push(new Piece(this, f, pl.x, pl.y, pl.flip));
    }
    this.drawOutline();
  }

  protected fixtures(): Fixture[] {
    const out: Fixture[] = [
      {
        x: 47,
        y: FLOOR_TOP + 2,
        w: 14,
        depth: 0,
        wall: true,
        label: () => '[E] WARDROBE',
        use: () => this.openWardrobe(),
        hit: { x: 38, y: 76, w: 18, h: 20 },
      },
    ];
    const hasBed = store.get().life.placed.some((p) => furnitureById(p.id)?.cat === 'bed');
    if (!hasBed) {
      out.push({ x: BLANKET.x, y: BLANKET.y, w: 30, depth: 0, label: () => '[E] SLEEP ON THE BLANKET', use: () => this.goToSleep('floor') });
    }
    for (const piece of this.pieces) {
      const f = piece.def;
      const verb = useOf(f);
      if (f.wall || f.cat === 'rug') continue;
      out.push({
        x: piece.x,
        y: piece.y,
        w: Math.max(10, f.w),
        depth: Math.min(8, Math.max(4, Math.round(f.h / 3))),
        label: () => (verb === 'sit' ? `[E] SIT ON THE ${f.name}` : verb === 'lie' ? `[E] SLEEP IN THE ${f.name}` : verb === 'wash' ? `[E] USE THE ${f.name}` : verb === 'switch' ? `[E] ${f.name}: ${piece.on ? 'OFF' : 'ON'}` : verb === 'play' ? `[E] PLAY THE ${f.name}` : f.name),
        use: () => this.usePiece(piece),
      });
    }
    return out;
  }

  private usePiece(piece: Piece): void {
    const f = piece.def;
    switch (useOf(f)) {
      case 'sit':
        this.sitOn(piece.x, piece.y + 1, 'chair', piece.flip ? -1 : 1);
        this.say('YOU SIT DOWN. MOVE TO GET UP.');
        break;
      case 'lie':
        this.goToSleep(f.id === 'fur_bed' ? 'bed' : 'mattress');
        break;
      case 'switch':
        this.say(piece.toggle() ? `THE ${f.name} IS ON.` : `THE ${f.name} IS OFF.`);
        break;
      case 'play':
        piece.play();
        this.say(`THE ${f.name} PLAYS.`);
        break;
      case 'wash':
        audio.sfx('splash', 0.4);
        this.say(washLine(f));
        break;
      default:
        this.say(`YOUR ${f.name}. ${f.note}.`);
    }
  }

  private openWardrobe(): void {
    if (this.busy()) return;
    this.locked = true;
    this.scene.launch('Shop', { kind: 'wardrobe', from: 'Condo' });
  }

  /**
   * The flat itself: a mid-range condo, not a hotel room.  Painted walls with
   * a sage feature wall, white skirting and downlights, light oak laminate,
   * a fitted kitchenette along the right (cupboards, a hob, a fridge -- no
   * sink: the bathroom things are yours to buy), a slim aluminium window with
   * a roller blind and sheers, and a plain white front door with an intercom.
   * The window is the sky as it is now: morning, evening or night, the sun
   * crossing it through the day, and the room dims when it is dark.
   */
  private paintWalls(): void {
    const g = this.room;
    g.clear();
    const c = clock();
    const W = WINDOW;
    // ---- the walls: warm grey paint, and the sage feature wall round the window
    g.fillStyle(0xd9d3c8, 1).fillRect(0, 0, GAME_W, FLOOR_TOP);
    g.fillStyle(0x9aae9e, 1).fillRect(W.x - 30, 0, W.w + 60, FLOOR_TOP);
    for (let i = 0; i < 260; i++) {
      const x = (i * 97) % GAME_W;
      const y = (i * 53) % (FLOOR_TOP - 8);
      g.fillStyle(0xffffff, 0.06).fillRect(x, y + 6, 1, 1);
      g.fillStyle(0x000000, 0.04).fillRect((x + 41) % GAME_W, (y + 17) % FLOOR_TOP, 1, 1);
    }
    // the ceiling line, a shadow gap and the downlights
    g.fillStyle(0xf2efe8, 1).fillRect(0, 0, GAME_W, 6);
    g.fillStyle(0x000000, 0.12).fillRect(0, 6, GAME_W, 1);
    for (const lx of [60, 160, 260]) {
      g.fillStyle(0x8a8a8a, 1).fillRect(lx - 3, 2, 7, 2);
      g.fillStyle(c.dark ? 0xfff0c0 : 0xf8f4e8, 1).fillRect(lx - 2, 3, 5, 1);
      if (c.dark) g.fillStyle(0xfff0c0, 0.06).fillTriangle(lx - 2, 4, lx + 3, 4, lx + 22, FLOOR_TOP).fillTriangle(lx - 2, 4, lx + 3, 4, lx - 20, FLOOR_TOP);
    }
    // white skirting
    g.fillStyle(0xf4f2ec, 1).fillRect(0, FLOOR_TOP - 5, GAME_W, 5);
    g.fillStyle(0xc8c4bc, 1).fillRect(0, FLOOR_TOP - 1, GAME_W, 1);
    // ---- the floor: light oak laminate, long planks, staggered joints
    for (let y = FLOOR_TOP; y < GAME_H; y += 5) {
      const row = (y - FLOOR_TOP) / 5;
      g.fillStyle(row % 2 ? 0xc49a68 : 0xcba272, 1).fillRect(0, y, GAME_W, 5);
      g.fillStyle(0x9a7448, 0.7).fillRect(0, y, GAME_W, 1);
      for (let x = (row * 37) % 64; x < GAME_W; x += 64) g.fillStyle(0x9a7448, 0.8).fillRect(x, y, 1, 5);
      for (let x = (row * 23) % 17; x < GAME_W; x += 17) g.fillStyle(0xffffff, 0.06).fillRect(x, y + 2, 6, 1);
    }
    // the light off the window on the floor (by day)
    if (!c.dark) g.fillStyle(c.phase === 'evening' ? 0xffb070 : 0xfff6d8, 0.12).fillRect(W.x - 6, FLOOR_TOP + 2, W.w + 12, 20);

    // ---- the window: the sky now
    g.fillStyle(0x2a2e34, 1).fillRect(W.x - 3, W.y - 3, W.w + 6, W.h + 6);
    this.paintSky(g, c);
    // slim aluminium frame: a fixed pane and a sliding one
    g.fillStyle(0x3a3f46, 1).fillRect(W.x + W.w / 2 - 1, W.y, 3, W.h);
    g.fillStyle(0x3a3f46, 1).fillRect(W.x, W.y + W.h - 3, W.w, 3);
    g.fillStyle(0xffffff, 0.12).fillRect(W.x + 4, W.y + 3, 3, W.h - 10).fillRect(W.x + W.w / 2 + 6, W.y + 3, 2, W.h - 10);
    // the sill, the roller blind rolled up in its cassette, the sheers either side
    g.fillStyle(0xf4f2ec, 1).fillRect(W.x - 6, W.y + W.h + 3, W.w + 12, 3);
    g.fillStyle(0xe8e4dc, 1).fillRect(W.x - 4, W.y - 9, W.w + 8, 6);
    g.fillStyle(0xb8b4ac, 1).fillRect(W.x - 4, W.y - 4, W.w + 8, 1);
    g.fillStyle(0x6a6a6a, 1).fillRect(W.x - 22, W.y - 12, W.w + 44, 2);
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? W.x - 20 : W.x + W.w + 6;
      for (let k = 0; k < 14; k += 2) g.fillStyle(k % 4 ? 0xf0ece4 : 0xe0dcd2, 0.92).fillRect(x0 + k, W.y - 10, 2, W.h + 18);
    }

    // ---- the kitchenette along the right: wall cupboards, worktop, hob, fridge
    const kx = 236;
    const kw = 56;
    g.fillStyle(0x14100c, 1).fillRect(kx - 1, 38, kw + 2, 22);
    g.fillStyle(0xf2f0ea, 1).fillRect(kx, 39, kw, 20);
    for (let d = 0; d < 3; d++) {
      g.fillStyle(0xd8d4cc, 1).fillRect(kx + d * (kw / 3), 39, 1, 20);
      g.fillStyle(0x8a8a8a, 1).fillRect(kx + d * (kw / 3) + kw / 3 - 4, 54, 2, 3);
    }
    // the splashback tiles
    g.fillStyle(0xe6ecef, 1).fillRect(kx, 60, kw, 38);
    for (let ty = 60; ty < 98; ty += 5) g.fillStyle(0xc8d0d4, 1).fillRect(kx, ty, kw, 1);
    for (let ty = 60, r = 0; ty < 98; ty += 5, r++) for (let tx = kx + (r % 2) * 5; tx < kx + kw; tx += 10) g.fillStyle(0xc8d0d4, 1).fillRect(tx, ty, 1, 5);
    // base units and the worktop
    g.fillStyle(0x14100c, 1).fillRect(kx - 1, 98, kw + 2, FLOOR_TOP - 98);
    g.fillStyle(0x4a5a6a, 1).fillRect(kx, 102, kw, FLOOR_TOP - 104);
    for (let d = 0; d < 3; d++) {
      g.fillStyle(0x3a4856, 1).fillRect(kx + d * (kw / 3), 102, 1, FLOOR_TOP - 104);
      g.fillStyle(0xb8b8c0, 1).fillRect(kx + d * (kw / 3) + 4, 105, 8, 1);
    }
    g.fillStyle(0x2a2a2e, 1).fillRect(kx - 2, 98, kw + 4, 4);
    g.fillStyle(0x5a5a62, 1).fillRect(kx - 2, 98, kw + 4, 1);
    // the hob: two rings
    g.fillStyle(0x14161c, 1).fillRect(kx + 30, 96, 18, 2);
    g.fillStyle(0x6a6a72, 1).fillRect(kx + 32, 96, 5, 1).fillRect(kx + 41, 96, 5, 1);
    // a kettle and a jar on the worktop
    g.fillStyle(0x14100c, 1).fillRect(kx + 8, 90, 8, 8);
    g.fillStyle(0xc83a3a, 1).fillRect(kx + 9, 91, 6, 7);
    g.fillStyle(0x14100c, 1).fillRect(kx + 19, 92, 5, 6);
    g.fillStyle(0xe8d8a8, 1).fillRect(kx + 20, 93, 3, 5);
    // the fridge
    const fx = kx + kw + 4;
    g.fillStyle(0x14100c, 1).fillRect(fx - 1, 56, 22, FLOOR_TOP - 56);
    g.fillStyle(0xdfe3e6, 1).fillRect(fx, 57, 20, FLOOR_TOP - 58);
    g.fillStyle(0xb8bec4, 1).fillRect(fx, 82, 20, 1);
    g.fillStyle(0x8a9098, 1).fillRect(fx + 16, 62, 2, 14).fillRect(fx + 16, 86, 2, 18);
    g.fillStyle(0xffffff, 0.3).fillRect(fx + 1, 58, 2, FLOOR_TOP - 60);

    // ---- the front door: plain white, lever handle, a spy hole, the intercom
    g.fillStyle(0xbab4a8, 1).fillRect(3, 56, 30, FLOOR_TOP - 56);
    g.fillStyle(0x14100c, 1).fillRect(5, 58, 26, FLOOR_TOP - 58);
    g.fillStyle(0xf2f0ea, 1).fillRect(6, 59, 24, FLOOR_TOP - 59);
    g.fillStyle(0xe2dfd8, 1).fillRect(9, 63, 18, 22).fillRect(9, 90, 18, 28);
    g.fillStyle(0x6a6a72, 1).fillRect(24, 92, 5, 2);
    g.fillStyle(0x3a3a3a, 1).fillRect(17, 66, 2, 2);
    // the intercom and the light switch beside it
    g.fillStyle(0x14100c, 1).fillRect(60, 72, 7, 11);
    g.fillStyle(0xe8e8e0, 1).fillRect(61, 73, 5, 9);
    g.fillStyle(0x3a8a5a, 1).fillRect(62, 75, 3, 2);
    g.fillStyle(0xf4f2ec, 1).fillRect(61, 88, 4, 5);
    // a thermostat and a socket
    g.fillStyle(0xf4f2ec, 1).fillRect(214, 70, 8, 8);
    g.fillStyle(0x46c4bd, 1).fillRect(216, 72, 4, 2);
    g.fillStyle(0xf4f2ec, 1).fillRect(80, FLOOR_TOP - 13, 6, 5);
    g.fillStyle(0x6a6a6a, 1).fillRect(81, FLOOR_TOP - 11, 1, 2).fillRect(84, FLOOR_TOP - 11, 1, 2);

    // ---- night: the room dimmer, the downlights' pools on the floor
    this.dim?.clear();
    if (c.dark) {
      const d = this.dim!;
      d.fillStyle(0x0a1030, 0.28).fillRect(0, 0, GAME_W, GAME_H);
      for (const lx of [60, 160, 260]) d.fillStyle(0xfff0c0, 0.07).fillEllipse(lx, FLOOR_TOP + 22, 80, 22);
    } else if (c.phase === 'evening') {
      this.dim!.fillStyle(0xff9a50, 0.06).fillRect(0, 0, GAME_W, GAME_H);
    }
  }

  /** What the window shows: the sky for the hour, the sun or the moon, the city. */
  private paintSky(g: Phaser.GameObjects.Graphics, c: ReturnType<typeof clock>): void {
    const W = WINDOW;
    const bands =
      c.phase === 'morning'
        ? [0x5aa8e0, 0x6ab4e6, 0x7ac0ea, 0x9ad0ee]
        : c.phase === 'evening'
          ? [0x5a3a7a, 0xa84a6a, 0xe8784a, 0xf0b060]
          : [0x060a1c, 0x0a1028, 0x0e1634, 0x141c40];
    const bh = Math.ceil(W.h / bands.length);
    bands.forEach((col, i) => g.fillStyle(col, 1).fillRect(W.x, W.y + i * bh, W.w, Math.min(bh, W.h - i * bh)));
    // where the sun is: across the window from sunrise to night, low in the evening
    const h = c.hour + c.minute / 60;
    if (c.phase !== 'night') {
      const k = Math.min(1, Math.max(0, (h - SUNRISE_HOUR) / (NIGHT_HOUR - SUNRISE_HOUR)));
      const sx = W.x + 8 + k * (W.w - 16);
      const sy = W.y + W.h - 14 - Math.sin(k * Math.PI) * (W.h - 26);
      g.fillStyle(c.phase === 'evening' ? 0xffd080 : 0xfff4c0, 0.35).fillCircle(sx, sy, 8);
      g.fillStyle(c.phase === 'evening' ? 0xffb050 : 0xfffae0, 1).fillCircle(sx, sy, 5);
      // a cloud or two by day
      if (c.phase === 'morning') {
        g.fillStyle(0xffffff, 0.85).fillEllipse(W.x + 20, W.y + 14, 16, 5).fillEllipse(W.x + 26, W.y + 12, 10, 5);
        g.fillStyle(0xffffff, 0.7).fillEllipse(W.x + W.w - 18, W.y + 22, 14, 4);
      }
    } else {
      for (let i = 0; i < 14; i++) g.fillStyle(0xffffff, 0.5 + (i % 3) * 0.15).fillRect(W.x + 3 + ((i * 29) % (W.w - 6)), W.y + 3 + ((i * 17) % 30), 1, 1);
      g.fillStyle(0xf0ecd0, 1).fillCircle(W.x + W.w - 16, W.y + 12, 5);
      g.fillStyle(0x0a1028, 1).fillCircle(W.x + W.w - 14, W.y + 11, 4);
    }
    // the city beyond, lit windows when it is dark
    for (let i = 0; i < 9; i++) {
      const bx = W.x + i * 10;
      const tall = 10 + ((i * 37) % 26);
      g.fillStyle(c.dark ? 0x0a0e1c : c.phase === 'evening' ? 0x4a3a5a : 0x5a6a80, 1).fillRect(bx, W.y + W.h - tall, 9, tall);
      if (c.phase !== 'morning') for (let k = 0; k < 4; k++) if ((i + k) % 3) g.fillStyle(0xf0d070, c.dark ? 1 : 0.6).fillRect(bx + 2 + (k % 2) * 4, W.y + W.h - tall + 3 + Math.floor(k / 2) * 5, 2, 2);
    }
  }

  private dim: Phaser.GameObjects.Graphics | null = null;

  private placements(): Placement[] {
    return store.get().life.placed;
  }

  private rectOf(p: Placement, f = furnitureById(p.id)!): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(p.x - f.w / 2, p.y - f.h, f.w, f.h);
  }

  /** Can `f` stand at (x, y) without floating, clipping, or covering the window? */
  private valid(f: FurnitureDef, x: number, y: number, uid: number | null): boolean {
    const r = new Phaser.Geom.Rectangle(x - f.w / 2, y - f.h, f.w, f.h);
    if (r.x < 4 || r.right > GAME_W - 4) return false;
    if (f.wall) {
      if (r.y < WALL_TOP || r.bottom > WALL_BOTTOM) return false;
      if (Phaser.Geom.Intersects.RectangleToRectangle(r, new Phaser.Geom.Rectangle(WINDOW.x - 22, WINDOW.y - 8, WINDOW.w + 44, WINDOW.h + 16))) return false;
    } else {
      if (y < FLOOR_TOP + 6 || y > FLOOR_BOTTOM) return false;
      if (r.x < 34 && y < FLOOR_TOP + 20) return false; // not in front of the door
    }
    for (const p of this.placements()) {
      if (p.uid === uid) continue;
      const o = furnitureById(p.id);
      if (!o || o.wall !== f.wall) continue;
      // rugs lie under things; nothing else shares a footprint
      if (!f.wall && (o.cat === 'rug' || f.cat === 'rug')) continue;
      const or = this.rectOf(p, o);
      if (!f.wall) {
        // floor items collide on their FOOTPRINT: the bottom few pixels
        const fa = new Phaser.Geom.Rectangle(r.x, y - 6, r.width, 6);
        const fb = new Phaser.Geom.Rectangle(or.x, p.y - 6, or.width, 6);
        if (Phaser.Geom.Intersects.RectangleToRectangle(fa, fb)) return false;
      } else if (Phaser.Geom.Intersects.RectangleToRectangle(r, or)) return false;
    }
    return true;
  }

  /** The picked piece's outline while decorating. */
  private drawOutline(): void {
    const g = this.outline;
    g.clear();
    if (!this.decorating || this.picked === null) return;
    const p = this.placements().find((q) => q.uid === this.picked);
    if (!p) return;
    const f = furnitureById(p.id)!;
    const r = this.rectOf(p, f);
    g.lineStyle(1, this.valid(f, p.x, p.y, p.uid) ? 0x7fd88a : 0xff5040, 1).strokeRect(r.x - 2, r.y - 2, r.width + 4, r.height + 4);
  }

  /** Something moved, was put out or put away: the room is built again. */
  private rebuild(): void {
    this.placePieces();
    // the footprints and the things to use follow the furniture
    this.items = this.items.filter((it) => it.f === this.exitDoor);
    this.solids = [];
    for (const f of this.fixtures()) this.addFixture(f);
  }

  // ------------------------------------------------------------- buttons

  private buildButtons(): void {
    this.ui.removeAll(true);
    const y = 176;
    if (this.decorating) {
      const l = store.get().life;
      const unplaced = Object.entries(l.furniture).filter(([id, n]) => n > l.placed.filter((p) => p.id === id).length);
      this.ui.add(this.add.rectangle(0, GAME_H - 17, GAME_W, 17, PALETTE.black, 0.8).setOrigin(0, 0));
      this.ui.add(button(this, 34, y - 6, unplaced.length ? `PLACE (${unplaced.length})` : 'NOTHING TO PLACE', () => this.placeNext(), { width: 62, height: 11, disabled: !unplaced.length }));
      this.ui.add(button(this, 100, y - 6, 'FLIP', () => this.flipPicked(), { width: 40, height: 11, disabled: this.picked === null }));
      this.ui.add(button(this, 148, y - 6, 'REMOVE', () => this.removePicked(), { width: 48, height: 11, disabled: this.picked === null }));
      this.ui.add(button(this, 284, y - 6, 'DONE', () => this.setDecorating(false), { width: 50, height: 11 }));
      pinToScreen(this.ui);
      return;
    }
    // one button, up out of the way of your feet
    this.ui.add(button(this, GAME_W / 2, 31, 'DECORATE', () => this.setDecorating(true), { width: 58, height: 11 }));
    pinToScreen(this.ui);
  }

  private setDecorating(on: boolean): void {
    if (on && super.busy()) return;
    this.decorating = on;
    this.picked = null;
    this.buildButtons();
    this.drawOutline();
    if (!on) this.rebuild();
    if (on) this.say(store.get().life.placed.length ? 'TAP SOMETHING TO PICK IT UP, DRAG TO MOVE IT.' : 'BUY FURNITURE AT HOME AND HEARTH, EAST OF THE ARCADE.');
  }

  /** The next owned piece that is not out yet, set down somewhere free. */
  private placeNext(): void {
    const l = store.get().life;
    const entry = Object.entries(l.furniture).find(([id, n]) => n > l.placed.filter((p) => p.id === id).length);
    if (!entry) return;
    const f = furnitureById(entry[0])!;
    const tries: Array<[number, number]> = [];
    // from the middle of the room outwards, and clear of the HUD in the top corner
    const mid = (x: number): number => Math.abs(x - GAME_W / 2);
    if (f.wall) for (let y = Math.max(WALL_TOP + f.h + 4, 44 + f.h); y <= WALL_BOTTOM; y += 10) for (let x = 30; x < GAME_W - 20; x += 12) tries.push([x, y]);
    else for (let y = FLOOR_BOTTOM - 4; y > FLOOR_TOP + 6; y -= 8) for (let x = 40; x < GAME_W - 20; x += 10) tries.push([x, y]);
    tries.sort((a, b) => (f.wall ? mid(a[0]) - mid(b[0]) || a[1] - b[1] : b[1] - a[1] || mid(a[0]) - mid(b[0])));
    const spot = tries.find(([x, y]) => this.valid(f, x, y, null));
    if (!spot) {
      this.say('NO ROOM FOR THAT. MOVE SOMETHING FIRST.');
      return;
    }
    const r = placeFurniture(f.id, spot[0], spot[1]);
    this.say(r.msg);
    this.picked = store.get().life.placed[store.get().life.placed.length - 1]?.uid ?? null;
    this.buildButtons();
    this.placePieces();
  }

  private flipPicked(): void {
    const p = this.placements().find((q) => q.uid === this.picked);
    if (!p) return;
    movePlacement(p.uid, p.x, p.y, !p.flip);
    this.placePieces();
  }

  private removePicked(): void {
    if (this.picked === null) return;
    removePlacement(this.picked);
    this.picked = null;
    this.say('PUT AWAY. IT IS STILL YOURS.');
    this.buildButtons();
    this.placePieces();
  }

  private pointerDown(p: Phaser.Input.Pointer): void {
    if (!this.decorating || this.busy() || p.y > GAME_H - 18) return;
    // the frontmost thing under the finger
    const hit = [...this.placements()]
      .reverse()
      .find((q) => Phaser.Geom.Rectangle.Contains(this.rectOf(q), p.worldX, p.worldY));
    this.picked = hit ? hit.uid : null;
    this.dragging = !!hit;
    this.dragFrom = hit ? { x: hit.x, y: hit.y } : null;
    this.buildButtons();
    this.placePieces();
  }

  private pointerMove(p: Phaser.Input.Pointer): void {
    if (!this.dragging || this.picked === null || !p.isDown) return;
    const q = this.placements().find((x) => x.uid === this.picked);
    if (!q) return;
    const f = furnitureById(q.id)!;
    // the base follows the finger; it never leaves the floor (or the wall)
    const y = Math.round(f.wall ? Phaser.Math.Clamp(p.worldY + f.h / 2, WALL_TOP + f.h, WALL_BOTTOM) : Phaser.Math.Clamp(p.worldY + f.h / 2, FLOOR_TOP + 6, FLOOR_BOTTOM));
    const x = Math.round(Phaser.Math.Clamp(p.worldX, 4 + f.w / 2, GAME_W - 4 - f.w / 2));
    movePlacement(q.uid, x, y);
    this.placePieces();
  }

  private pointerUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    const q = this.placements().find((x) => x.uid === this.picked);
    if (!q || !this.dragFrom) return;
    // let go somewhere it cannot be: back where it was
    if (!this.valid(furnitureById(q.id)!, q.x, q.y, q.uid)) {
      movePlacement(q.uid, this.dragFrom.x, this.dragFrom.y);
      this.say('IT CANNOT GO THERE.');
      audio.sfx('buzzer', 0.4);
    }
    this.placePieces();
  }

  // ------------------------------------------------------------ sleeping

  private goToSleep(on: 'floor' | 'mattress' | 'bed'): void {
    if (this.busy()) return;
    // (only at night: a slept night is a morning, and mornings are not for sleeping)
    if (!clock().dark) {
      this.say(`YOU ARE NOT TIRED. SLEEP COMES AFTER ${twelveHour(NIGHT_HOUR)}.`);
      return;
    }
    this.locked = true;
    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.time.delayedCall(1000, () => {
      const r = sleep(on);
      this.paintWalls();
      this.cameras.main.fadeIn(900, 0, 0, 0);
      this.say(`${on === 'floor' ? 'ON THE BLANKET. ' : ''}${r.msg}`);
      this.locked = false;
    });
  }

  protected tick(): void {
    // evicted while standing in it (the grace day ran out): shown the door
    if (!store.get().life.rented && !this.locked) {
      this.locked = true;
      this.say('THE LANDLORD IS AT THE DOOR. YOU HAVE TO GO.');
      this.time.delayedCall(1800, () => this.exitTo('Hotel', { area: 'lobby', from: 'lift' }));
    }
  }

  update(t: number, delta: number): void {
    super.update(t, delta);
    // (the eviction check runs even while a menu is up)
    if (super.busy() || this.decorating) this.tick();
  }
}

void clock;
void audio;
