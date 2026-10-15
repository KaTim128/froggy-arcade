/**
 * ---- UNIT 612, LILY'S CONDOS.  Yours for as long as the rent is paid.
 *
 * IT IS THE ROOM YOU ARRIVED IN.  Walls in off-white with a picture rail,
 * downlights in the ceiling, a wide window on the city over a radiator, a
 * light oak floor -- and at the far end, through its own doorway, a
 * BATHROOM: white tile to the picture rail, a black-and-white chequered
 * floor, a mirror over where a basin goes.
 *
 * AND IT COMES EMPTY.  There is no bath fitted, no basin, no bed: the flat
 * is four walls, a window and a blanket on the boards, and everything else
 * is bought at Home and Hearth and carried in.  The bathroom things go in
 * the bathroom (and only there); everything else goes in the room (and not
 * in the bathroom).
 *
 * DECORATE is the whole of it: pick something you own, carry it about with
 * your finger, TURN it round, and PUT IT DOWN when it looks right -- or
 * CANCEL and it goes back in the van.  Anything already down can be picked
 * up again, moved, turned or taken away, and the flat remembers exactly
 * where you left it.  What is in it is real: sit on the chairs and the
 * sofa, sleep in the bed (or on the blanket until you own one), switch the
 * TV and the lamps on, play the radio, wash in what you have plumbed in.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { button, pinToScreen, text } from '../core/ui';
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
const WINDOW = { x: 112, y: 34, w: 84, h: 56 };
/**
 * ---- THE BATHROOM, through the doorway at the far end.
 *
 * `BATH_X` is the jamb: everything right of it is tile and chequer, and it
 * is the only place a bath, a basin, a toilet or a shower may be plumbed
 * in -- and the only place nothing else may stand.  The floor runs straight
 * through the doorway, so you walk in and out of it like any other room.
 */
const BATH_X = 226;
/** The blanket on the floor, where you sleep until you own a bed. */
const BLANKET = { x: 196, y: 156 };

export class Condo extends WalkRoom {
  private room!: Phaser.GameObjects.Graphics;
  private ui!: Phaser.GameObjects.Container;
  private pieces: Piece[] = [];
  private outline!: Phaser.GameObjects.Graphics;
  private decorating = false;
  private picked: number | null = null;
  /** What is in your hands: down in the room, but not settled yet. */
  private placing: number | null = null;
  private picker: Phaser.GameObjects.Container | null = null;
  private pickerPage = 0;
  private dragging = false;
  private dragFrom: { x: number; y: number } | null = null;

  constructor() {
    super('Condo');
  }

  create(): void {
    this.floorTop = FLOOR_TOP;
    this.decorating = false;
    this.picked = null;
    this.placing = null;
    this.picker = null;
    this.pickerPage = 0;
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
    // ---- THE BLANKET, a bed of sorts: a rolled grey blanket with the folds
    // showing and a coat rolled up at one end for a pillow.  (Low and soft
    // on purpose: flat and white with a lip, it read as a bath somebody had
    // left in the middle of the floor.)
    const b = this.add.graphics().setDepth(3);
    b.fillStyle(0x000000, 0.18).fillEllipse(BLANKET.x, BLANKET.y + 1, 34, 6);
    b.fillStyle(0x3a4254, 1).fillEllipse(BLANKET.x, BLANKET.y - 2, 32, 8);
    b.fillStyle(0x58647e, 1).fillEllipse(BLANKET.x - 1, BLANKET.y - 3, 29, 6);
    for (let k = -3; k <= 3; k++) b.fillStyle(0x47536b, 0.8).fillRect(BLANKET.x + k * 4, BLANKET.y - 5, 1, 4);
    b.fillStyle(0x6a6a44, 1).fillEllipse(BLANKET.x + 11, BLANKET.y - 5, 11, 6);
    b.fillStyle(0x7e7e54, 1).fillEllipse(BLANKET.x + 11, BLANKET.y - 6, 9, 4);
    // the coat hook by the door: your clothes
    const h = this.add.graphics().setDepth(2);
    h.fillStyle(0x3a2a1e, 1).fillRect(40, 78, 14, 2);
    h.fillStyle(0x6a6a44, 1).fillRect(41, 80, 5, 12);
    h.fillStyle(0x5a3a3a, 1).fillRect(48, 80, 4, 4);
    // the bathroom's name over its doorway
    text(this, BATH_X + (GAME_W - BATH_X) / 2, 26, 'BATHROOM', 0x6a8a94).setOrigin(0.5, 0).setDepth(2);
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
    // ---- THE ROOM: off-white walls, a picture rail, the ceiling and its
    // downlights -- the room as you first walked into it.
    g.fillStyle(0xeceae4, 1).fillRect(0, 0, GAME_W, FLOOR_TOP);
    g.fillStyle(0xf4f2ee, 1).fillRect(0, 0, GAME_W, 46);
    for (let i = 0; i < 220; i++) {
      const x = (i * 97) % GAME_W;
      const y = (i * 53) % (FLOOR_TOP - 8);
      g.fillStyle(0xffffff, 0.05).fillRect(x, y + 6, 1, 1);
      g.fillStyle(0x000000, 0.03).fillRect((x + 41) % GAME_W, (y + 17) % FLOOR_TOP, 1, 1);
    }
    // the picture rail, and the shadow under it
    g.fillStyle(0xdcd8cc, 1).fillRect(0, 44, GAME_W, 2);
    g.fillStyle(0x000000, 0.06).fillRect(0, 46, GAME_W, 1);
    // the ceiling, its shadow gap and the downlights
    g.fillStyle(0xf8f7f2, 1).fillRect(0, 0, GAME_W, 7);
    g.fillStyle(0x000000, 0.1).fillRect(0, 7, GAME_W, 1);
    for (const lx of [54, 118, 182, 262]) {
      g.fillStyle(0x9a9a98, 1).fillRect(lx - 3, 2, 7, 2);
      g.fillStyle(c.dark ? 0xfff0c0 : 0xfbf8f0, 1).fillRect(lx - 2, 3, 5, 1);
      if (c.dark) g.fillStyle(0xfff0c0, 0.06).fillTriangle(lx - 2, 4, lx + 3, 4, lx + 22, FLOOR_TOP).fillTriangle(lx - 2, 4, lx + 3, 4, lx - 20, FLOOR_TOP);
    }
    // white skirting, all the way along
    g.fillStyle(0xf6f5f0, 1).fillRect(0, FLOOR_TOP - 5, GAME_W, 5);
    g.fillStyle(0xcbc8c0, 1).fillRect(0, FLOOR_TOP - 1, GAME_W, 1);
    // ---- the floor: light oak, long boards, staggered joints
    for (let y = FLOOR_TOP; y < GAME_H; y += 5) {
      const row = (y - FLOOR_TOP) / 5;
      g.fillStyle(row % 2 ? 0xc49a68 : 0xcba272, 1).fillRect(0, y, GAME_W, 5);
      g.fillStyle(0x9a7448, 0.7).fillRect(0, y, GAME_W, 1);
      for (let x = (row * 37) % 64; x < GAME_W; x += 64) g.fillStyle(0x9a7448, 0.8).fillRect(x, y, 1, 5);
      for (let x = (row * 23) % 17; x < GAME_W; x += 17) g.fillStyle(0xffffff, 0.06).fillRect(x, y + 2, 6, 1);
    }
    // the light off the window on the boards (by day)
    if (!c.dark) g.fillStyle(c.phase === 'evening' ? 0xffb070 : 0xfff6d8, 0.12).fillRect(W.x - 6, FLOOR_TOP + 2, W.w + 12, 20);

    // ---- THE WINDOW, and the sky as it is now
    g.fillStyle(0x2a2e34, 1).fillRect(W.x - 3, W.y - 3, W.w + 6, W.h + 6);
    this.paintSky(g, c);
    g.fillStyle(0x3a3f46, 1).fillRect(W.x + W.w / 2 - 1, W.y, 3, W.h);
    g.fillStyle(0x3a3f46, 1).fillRect(W.x, W.y + W.h - 3, W.w, 3);
    g.fillStyle(0xffffff, 0.12).fillRect(W.x + 4, W.y + 3, 3, W.h - 10).fillRect(W.x + W.w / 2 + 6, W.y + 3, 2, W.h - 10);
    // the sill, the blind's cassette, the sheers either side
    g.fillStyle(0xf6f5f0, 1).fillRect(W.x - 6, W.y + W.h + 3, W.w + 12, 3);
    g.fillStyle(0xe8e6e0, 1).fillRect(W.x - 4, W.y - 9, W.w + 8, 6);
    g.fillStyle(0xb8b6b0, 1).fillRect(W.x - 4, W.y - 4, W.w + 8, 1);
    g.fillStyle(0x8a8a88, 1).fillRect(W.x - 22, W.y - 12, W.w + 44, 2);
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? W.x - 20 : W.x + W.w + 6;
      for (let k = 0; k < 14; k += 2) g.fillStyle(k % 4 ? 0xf2f0ea : 0xe2e0da, 0.92).fillRect(x0 + k, W.y - 10, 2, W.h + 18);
    }
    // the radiator under it, as in the corridor rooms
    const ry = FLOOR_TOP - 22;
    g.fillStyle(0xdcdad4, 1).fillRect(W.x + 10, ry, W.w - 20, 16);
    for (let x = W.x + 12; x < W.x + W.w - 12; x += 4) g.fillStyle(0xc4c2bc, 1).fillRect(x, ry + 1, 2, 14);
    g.fillStyle(0xeeece6, 1).fillRect(W.x + 10, ry, W.w - 20, 1);

    // ---- THE BATHROOM, through the doorway at the far end
    this.paintBath(g, c);

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
    g.fillStyle(0xf4f2ec, 1).fillRect(86, 70, 8, 8);
    g.fillStyle(0x46c4bd, 1).fillRect(88, 72, 4, 2);
    g.fillStyle(0xf4f2ec, 1).fillRect(80, FLOOR_TOP - 13, 6, 5);
    g.fillStyle(0x6a6a6a, 1).fillRect(81, FLOOR_TOP - 11, 1, 2).fillRect(84, FLOOR_TOP - 11, 1, 2);

    // ---- night: the room dimmer, the downlights' pools on the floor
    this.dim?.clear();
    if (c.dark) {
      const d = this.dim!;
      d.fillStyle(0x0a1030, 0.28).fillRect(0, 0, GAME_W, GAME_H);
      for (const lx of [54, 118, 182, 262]) d.fillStyle(0xfff0c0, 0.07).fillEllipse(lx, FLOOR_TOP + 22, 80, 22);
    } else if (c.phase === 'evening') {
      this.dim!.fillStyle(0xff9a50, 0.06).fillRect(0, 0, GAME_W, GAME_H);
    }
  }

  /**
   * ---- THE BATHROOM, and it is EMPTY.
   *
   * White metro tile to the picture rail, a chequered floor, a shaver light
   * over a mirror, a towel rail and the stub of pipe the plumber left --
   * and not a thing plumbed into it.  No bath, no basin, no toilet: those
   * are bought at Home and Hearth and put in here with DECORATE, which is
   * the whole point of the room standing empty.
   */
  private paintBath(g: Phaser.GameObjects.Graphics, c: ReturnType<typeof clock>): void {
    const x0 = BATH_X;
    const w = GAME_W - x0;
    // the wall: tile from the skirting to the rail
    g.fillStyle(0xf2f4f3, 1).fillRect(x0, 0, w, FLOOR_TOP);
    g.fillStyle(0xe4eceb, 1).fillRect(x0, 46, w, FLOOR_TOP - 46);
    for (let ty = 48, r = 0; ty < FLOOR_TOP - 5; ty += 7, r++) {
      g.fillStyle(0xc8d6d4, 1).fillRect(x0, ty, w, 1);
      for (let tx = x0 + ((r % 2) * 7); tx < GAME_W; tx += 14) g.fillStyle(0xc8d6d4, 1).fillRect(tx, ty, 1, 7);
    }
    g.fillStyle(0xf8faf9, 1).fillRect(x0, 0, w, 46);
    // the floor: black and white chequer, right through the doorway
    for (let y = FLOOR_TOP; y < GAME_H; y += 8) {
      for (let x = x0; x < GAME_W; x += 8) {
        const k = (Math.floor((x - x0) / 8) + Math.floor((y - FLOOR_TOP) / 8)) % 2;
        g.fillStyle(k ? 0x24242a : 0xeceae4, 1).fillRect(x, y, 8, 8);
      }
    }
    g.fillStyle(0xffffff, 0.08).fillRect(x0, FLOOR_TOP, w, 2);
    // the jamb: a white frame round the opening, and the threshold strip
    g.fillStyle(0xf6f5f0, 1).fillRect(x0 - 5, 36, 6, FLOOR_TOP - 36);
    g.fillStyle(0x000000, 0.12).fillRect(x0 + 1, 36, 2, FLOOR_TOP - 36);
    g.fillStyle(0xf6f5f0, 1).fillRect(x0 - 5, 36, w + 5, 6);
    g.fillStyle(0xcbc8c0, 1).fillRect(x0 - 5, 42, w + 5, 1);
    g.fillStyle(0xb8a070, 1).fillRect(x0 - 2, FLOOR_TOP, 3, GAME_H - FLOOR_TOP);
    // the mirror over where a basin goes, and the shaver light over it
    const mx = x0 + 34;
    g.fillStyle(0xdfe6e4, 1).fillRect(mx - 15, 56, 30, 28);
    g.fillStyle(0xcfe0e4, 1).fillRect(mx - 13, 58, 26, 24);
    g.fillStyle(0xffffff, 0.45).fillRect(mx - 9, 61, 4, 18);
    g.fillStyle(0xdcdad4, 1).fillRect(mx - 9, 50, 18, 4);
    g.fillStyle(c.dark ? 0xfff0c0 : 0xf8f8f0, 1).fillRect(mx - 8, 53, 16, 1);
    // the towel rail, with a towel over it
    g.fillStyle(0xb0b6b8, 1).fillRect(GAME_W - 30, 92, 24, 2);
    g.fillStyle(0x8ec0c8, 1).fillRect(GAME_W - 26, 94, 16, 18);
    g.fillStyle(0xaad4da, 1).fillRect(GAME_W - 26, 94, 16, 3);
    // the pipe stub waiting for a basin, and the drain in the floor
    g.fillStyle(0xb0b6b8, 1).fillRect(mx - 2, FLOOR_TOP - 12, 3, 7);
    g.fillStyle(0x8a9094, 1).fillRect(mx - 4, FLOOR_TOP - 6, 7, 2);
    g.fillStyle(0x9aa0a4, 1).fillCircle(GAME_W - 18, FLOOR_TOP + 22, 3);
    g.fillStyle(0x6a7074, 1).fillCircle(GAME_W - 18, FLOOR_TOP + 22, 2);
    // its name on the jamb, so nobody wonders what the tiled end is for
    g.fillStyle(0x000000, 0.07).fillRect(x0 + 6, 24, w - 12, 10);
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

  /** Bathroom things go in the bathroom; everything else stays out of it. */
  private roomFor(f: FurnitureDef): 'bath' | 'room' {
    return f.cat === 'bath' ? 'bath' : 'room';
  }

  /** Why `f` cannot go at (x, y) -- or '' if it can. */
  private whyNot(f: FurnitureDef, x: number, y: number, uid: number | null): string {
    const r = new Phaser.Geom.Rectangle(x - f.w / 2, y - f.h, f.w, f.h);
    if (r.x < 4 || r.right > GAME_W - 4) return 'IT WILL NOT FIT THERE.';
    // ---- WHICH ROOM.  The bath, the basin, the toilet and the shower are
    // plumbed in, and the plumbing is through the tiled end: they go in
    // there and nowhere else, and nothing else goes in there with them.
    if (this.roomFor(f) === 'bath') {
      if (r.x < BATH_X + 2) return 'THAT BELONGS IN THE BATHROOM.';
    } else if (r.right > BATH_X - 2) return 'THAT DOES NOT GO IN THE BATHROOM.';
    if (f.wall) {
      if (r.y < WALL_TOP || r.bottom > WALL_BOTTOM) return 'TOO HIGH OR TOO LOW FOR THE WALL.';
      if (Phaser.Geom.Intersects.RectangleToRectangle(r, new Phaser.Geom.Rectangle(WINDOW.x - 22, WINDOW.y - 8, WINDOW.w + 44, WINDOW.h + 16))) return 'NOT OVER THE WINDOW.';
    } else {
      if (y < FLOOR_TOP + 6 || y > FLOOR_BOTTOM) return 'IT HAS TO STAND ON THE FLOOR.';
      if (r.x < 34 && y < FLOOR_TOP + 20) return 'NOT IN FRONT OF THE DOOR.';
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
        if (Phaser.Geom.Intersects.RectangleToRectangle(fa, fb)) return 'SOMETHING IS ALREADY THERE.';
      } else if (Phaser.Geom.Intersects.RectangleToRectangle(r, or)) return 'SOMETHING IS ALREADY THERE.';
    }
    return '';
  }

  private valid(f: FurnitureDef, x: number, y: number, uid: number | null): boolean {
    return !this.whyNot(f, x, y, uid);
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

  /**
   * ---- DECORATING, in two states.
   *
   * CARRYING something (`placing` is its uid): it is down in the room but
   * not settled -- drag it about, TURN it round, and PUT IT DOWN when the
   * outline is green.  CANCEL at any point and it goes back in the van as
   * though it had never come out.
   *
   * NOT CARRYING: tap anything already in the room to pick it up again --
   * the same drag, the same TURN, and TAKE AWAY to put it back in storage.
   * PLACE opens the list of what you own and have not put out yet.
   */
  private buildButtons(): void {
    this.ui.removeAll(true);
    const y = GAME_H - 11;
    if (!this.decorating) {
      this.ui.add(button(this, GAME_W / 2, 31, 'DECORATE', () => this.setDecorating(true), { width: 58, height: 11 }));
      pinToScreen(this.ui);
      return;
    }
    this.ui.add(this.add.rectangle(0, GAME_H - 17, GAME_W, 17, PALETTE.black, 0.8).setOrigin(0, 0));
    if (this.placing !== null) {
      const p = this.placements().find((q) => q.uid === this.placing);
      const f = p ? furnitureById(p.id) : null;
      const ok = !!p && !!f && this.valid(f, p.x, p.y, p.uid);
      this.ui.add(button(this, 40, y, 'TURN', () => this.flipPicked(), { width: 56, height: 11 }));
      this.ui.add(button(this, 150, y, ok ? 'PUT IT DOWN' : 'NOT THERE', () => this.confirmPlacing(), { width: 92, height: 11, disabled: !ok, fill: ok ? PALETTE.tealDark : PALETTE.ink }));
      this.ui.add(button(this, 262, y, 'CANCEL', () => this.cancelPlacing(), { width: 68, height: 11, fill: 0x2a1424, hoverFill: 0x5a2040 }));
      pinToScreen(this.ui);
      return;
    }
    const l = store.get().life;
    const unplaced = this.unplaced().length;
    this.ui.add(button(this, 44, y, unplaced ? `PLACE (${unplaced})` : 'NOTHING TO PLACE', () => this.openPicker(), { width: 76, height: 11, disabled: !unplaced }));
    this.ui.add(button(this, 128, y, 'TURN', () => this.flipPicked(), { width: 46, height: 11, disabled: this.picked === null }));
    this.ui.add(button(this, 196, y, 'TAKE AWAY', () => this.removePicked(), { width: 76, height: 11, disabled: this.picked === null, fill: 0x2a1424, hoverFill: 0x5a2040 }));
    this.ui.add(button(this, 282, y, 'DONE', () => this.setDecorating(false), { width: 60, height: 11 }));
    void l;
    pinToScreen(this.ui);
  }

  private setDecorating(on: boolean): void {
    if (on && super.busy()) return;
    // (walking out of DECORATE with something still in your hands puts it back)
    if (!on && this.placing !== null) this.cancelPlacing(true);
    this.decorating = on;
    this.picked = null;
    this.buildButtons();
    this.drawOutline();
    if (!on) this.rebuild();
    if (on) this.say(store.get().life.placed.length ? 'TAP SOMETHING TO PICK IT UP. DRAG TO MOVE IT.' : 'BUY FURNITURE AT HOME AND HEARTH, EAST OF THE ARCADE.');
  }

  /** What you own and have not put out. */
  private unplaced(): Array<{ f: FurnitureDef; n: number }> {
    const l = store.get().life;
    return Object.entries(l.furniture)
      .map(([id, n]) => ({ f: furnitureById(id)!, n: n - l.placed.filter((p) => p.id === id).length }))
      .filter((e) => e.f && e.n > 0);
  }

  /**
   * THE VAN: everything of yours that is not out yet, two columns of it on
   * one card, with what room each piece goes in.  Picking one brings it in
   * and puts it in your hands (see `startPlacing`).
   */
  private openPicker(): void {
    const items = this.unplaced();
    if (!items.length) return;
    this.pickerPage = Math.min(this.pickerPage, Math.max(0, Math.ceil(items.length / 8) - 1));
    const page = items.slice(this.pickerPage * 8, this.pickerPage * 8 + 8);
    const c = this.add.container(0, 0).setDepth(880);
    c.add(this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.55).setOrigin(0, 0).setInteractive());
    const W = 236;
    const H = 112;
    const x0 = (GAME_W - W) / 2;
    const y0 = 30;
    c.add(this.add.rectangle(x0, y0, W, H, PALETTE.ink, 0.97).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold));
    c.add(text(this, x0 + 6, y0 + 4, 'WHAT TO PUT OUT', PALETTE.gold));
    page.forEach((e, i) => {
      const bx = x0 + 6 + (i % 2) * (W / 2 - 4);
      const by = y0 + 17 + Math.floor(i / 2) * 20;
      const plate = this.add.rectangle(bx, by, W / 2 - 10, 18, PALETTE.black, 0.45).setOrigin(0, 0).setStrokeStyle(1, PALETTE.slate);
      plate.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        c.destroy();
        this.picker = null;
        this.startPlacing(e.f);
      });
      c.add(plate);
      c.add(text(this, bx + 4, by + 2, e.f.name.length > 16 ? `${e.f.name.slice(0, 15)}.` : e.f.name, PALETTE.cream).setMaxWidth(W / 2 - 18));
      c.add(text(this, bx + 4, by + 10, `${e.f.cat === 'bath' ? 'BATHROOM' : e.f.wall ? 'ON THE WALL' : 'ON THE FLOOR'}${e.n > 1 ? `  x${e.n}` : ''}`, PALETTE.fog));
    });
    if (items.length > 8) {
      c.add(button(this, x0 + 60, y0 + H - 9, 'MORE', () => {
        this.pickerPage = (this.pickerPage + 1) % Math.ceil(items.length / 8);
        c.destroy();
        this.picker = null;
        this.openPicker();
      }, { width: 70, height: 11 }));
    }
    c.add(button(this, x0 + W - 48, y0 + H - 9, 'BACK', () => {
      c.destroy();
      this.picker = null;
    }, { width: 70, height: 11 }));
    pinToScreen(c);
    this.picker = c;
  }

  /** It comes in, lands somewhere free, and you are holding it. */
  private startPlacing(f: FurnitureDef): void {
    const spot = this.freeSpot(f);
    if (!spot) {
      this.say('NO ROOM FOR THAT YET. MOVE SOMETHING FIRST.');
      return;
    }
    const r = placeFurniture(f.id, spot[0], spot[1]);
    if (!r.ok) {
      this.say(r.msg);
      return;
    }
    const uid = store.get().life.placed[store.get().life.placed.length - 1]?.uid ?? null;
    this.placing = uid;
    this.picked = uid;
    this.say(`${f.name}: DRAG IT WHERE YOU WANT IT, TURN IT ROUND, THEN PUT IT DOWN.`);
    this.buildButtons();
    this.placePieces();
  }

  /** Somewhere it can go: the middle of its own room, working outwards. */
  private freeSpot(f: FurnitureDef): [number, number] | null {
    const bath = this.roomFor(f) === 'bath';
    const lo = bath ? BATH_X + 6 : 40;
    const hi = bath ? GAME_W - 10 : BATH_X - 10;
    const mid = (x: number): number => Math.abs(x - (lo + hi) / 2);
    const tries: Array<[number, number]> = [];
    if (f.wall) for (let y = Math.max(WALL_TOP + f.h + 4, 54 + f.h); y <= WALL_BOTTOM; y += 8) for (let x = lo; x < hi; x += 8) tries.push([x, y]);
    else for (let y = FLOOR_BOTTOM - 4; y > FLOOR_TOP + 6; y -= 6) for (let x = lo; x < hi; x += 8) tries.push([x, y]);
    tries.sort((a, b) => (f.wall ? mid(a[0]) - mid(b[0]) || a[1] - b[1] : b[1] - a[1] || mid(a[0]) - mid(b[0])));
    return tries.find(([x, y]) => this.valid(f, x, y, null)) ?? null;
  }

  /** Down it goes, and it stays there. */
  private confirmPlacing(): void {
    const p = this.placements().find((q) => q.uid === this.placing);
    const f = p ? furnitureById(p.id) : null;
    if (!p || !f) return;
    const why = this.whyNot(f, p.x, p.y, p.uid);
    if (why) {
      this.say(why);
      audio.sfx('buzzer', 0.4);
      return;
    }
    this.placing = null;
    audio.sfx('item_thud', 0.4);
    this.say(`${f.name} IS IN. TAP IT AGAIN TO MOVE IT.`);
    this.buildButtons();
    this.rebuild();
  }

  /** Changed your mind: it goes back in the van, still yours. */
  private cancelPlacing(quiet = false): void {
    if (this.placing === null) return;
    removePlacement(this.placing);
    this.placing = null;
    this.picked = null;
    if (!quiet) this.say('PUT BACK. IT IS STILL YOURS.');
    this.buildButtons();
    this.placePieces();
  }

  private flipPicked(): void {
    const p = this.placements().find((q) => q.uid === this.picked);
    if (!p) return;
    movePlacement(p.uid, p.x, p.y, !p.flip);
    audio.sfx('ui_blip', 0.4);
    this.placePieces();
  }

  private removePicked(): void {
    if (this.picked === null) return;
    removePlacement(this.picked);
    this.picked = null;
    this.say('PUT AWAY. IT IS STILL YOURS.');
    this.buildButtons();
    this.placePieces();
    this.rebuild();
  }

  private pointerDown(p: Phaser.Input.Pointer): void {
    // (`busy()` counts decorating itself as busy -- it is what stops you
    // walking about while you rearrange -- so the test here is what ELSE is
    // going on.  Asking this.busy() meant no tap ever reached the furniture
    // and nothing could be picked up or dragged at all.)
    if (!this.decorating || super.busy() || this.picker || p.y > GAME_H - 18) return;
    // carrying something: the finger moves THAT, wherever it goes down
    if (this.placing !== null) {
      this.dragging = true;
      this.dragFrom = null;
      this.pointerMove(p);
      return;
    }
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
    if (this.placing !== null) this.buildButtons();
  }

  private pointerUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    const q = this.placements().find((x) => x.uid === this.picked);
    if (!q) return;
    const why = this.whyNot(furnitureById(q.id)!, q.x, q.y, q.uid);
    // something you are still carrying may rest anywhere while you think;
    // something already in the room goes back where it was
    if (why && this.placing === null && this.dragFrom) {
      movePlacement(q.uid, this.dragFrom.x, this.dragFrom.y);
      this.say(why);
      audio.sfx('buzzer', 0.4);
    } else if (why) this.say(why);
    this.placePieces();
    this.buildButtons();
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
