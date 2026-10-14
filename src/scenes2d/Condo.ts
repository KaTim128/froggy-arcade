/**
 * ---- UNIT 612, LILY'S CONDOS.  Yours for as long as the rent is paid.
 *
 * It comes empty: a window, its curtains, bare boards, a blanket on the
 * floor.  You walk round it like any room (see rooms/WalkRoom), and what
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
import { button } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { furnitureById, type FurnitureDef } from '../game/catalog';
import { onLightTurn } from '../game/dayNight';
import { DUSK_HOUR, clock, movePlacement, placeFurniture, removePlacement, sleep, visit, type Placement } from '../game/life';
import { useOf } from '../game/furnitureUse';
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
    // dusk or dawn in here: the window goes dark (or light) with it
    onLightTurn(this, (dark) => {
      this.paintWalls();
      if (dark) this.say('IT IS DARK OUT. TIME FOR BED.');
    });
  }

  // ------------------------------------------------------------------ room

  protected paintRoom(): void {
    this.room = this.add.graphics().setDepth(0);
    this.outline = this.add.graphics().setDepth(700);
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
        label: () => (verb === 'sit' ? `[E] SIT ON THE ${f.name}` : verb === 'lie' ? `[E] SLEEP IN THE ${f.name}` : verb === 'switch' ? `[E] ${f.name}: ${piece.on ? 'OFF' : 'ON'}` : verb === 'play' ? `[E] PLAY THE ${f.name}` : f.name),
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
      default:
        this.say(`YOUR ${f.name}. ${f.note}.`);
    }
  }

  private openWardrobe(): void {
    if (this.busy()) return;
    this.locked = true;
    this.scene.launch('Shop', { kind: 'wardrobe', from: 'Condo' });
  }

  private paintWalls(): void {
    const g = this.room;
    g.clear();
    const c = clock();
    // the wall: plain plaster, a dado rail, the skirting
    g.fillStyle(0xcfc2a8, 1).fillRect(0, 0, GAME_W, FLOOR_TOP);
    g.fillStyle(0xbfb196, 1).fillRect(0, 0, GAME_W, 8);
    for (let x = 0; x < GAME_W; x += 6) g.fillStyle(0xc6b99e, 1).fillRect(x, 8, 1, FLOOR_TOP - 8);
    g.fillStyle(0x8a7a5e, 1).fillRect(0, FLOOR_TOP - 6, GAME_W, 6);
    g.fillStyle(0x6a5a42, 1).fillRect(0, FLOOR_TOP - 1, GAME_W, 1);
    // the floor: bare boards
    for (let y = FLOOR_TOP; y < GAME_H; y += 5) {
      g.fillStyle(y % 10 === 0 ? 0x8a6440 : 0x7e5a38, 1).fillRect(0, y, GAME_W, 5);
      g.fillStyle(0x5a3e24, 1).fillRect(0, y, GAME_W, 1);
      for (let x = (y * 7) % 40; x < GAME_W; x += 40) g.fillStyle(0x5a3e24, 1).fillRect(x, y, 1, 5);
    }
    // the window: what time it is outside
    const W = WINDOW;
    const sky = c.dark ? 0x10183a : c.hour < 9 || c.hour >= 18 ? 0xe89858 : 0x7ac0e8;
    g.fillStyle(0x14100c, 1).fillRect(W.x - 3, W.y - 3, W.w + 6, W.h + 6);
    g.fillStyle(0xe8e0d0, 1).fillRect(W.x - 2, W.y - 2, W.w + 4, W.h + 4);
    g.fillStyle(sky, 1).fillRect(W.x, W.y, W.w, W.h);
    // the city beyond
    for (let i = 0; i < 9; i++) {
      const bx = W.x + i * 10;
      const bh = 10 + ((i * 37) % 26);
      g.fillStyle(c.dark ? 0x0a0e1c : 0x5a6a80, 1).fillRect(bx, W.y + W.h - bh, 9, bh);
      if (c.dark) for (let k = 0; k < 4; k++) if ((i + k) % 3) g.fillStyle(0xf0d070, 1).fillRect(bx + 2 + (k % 2) * 4, W.y + W.h - bh + 3 + Math.floor(k / 2) * 5, 2, 2);
    }
    g.fillStyle(0xe8e0d0, 1).fillRect(W.x + W.w / 2 - 1, W.y, 2, W.h).fillRect(W.x, W.y + W.h / 2 - 1, W.w, 2);
    g.fillStyle(0xd8d0c0, 1).fillRect(W.x - 6, W.y + W.h + 2, W.w + 12, 3);
    // the curtains, and their rail
    g.fillStyle(0x3a3a3a, 1).fillRect(W.x - 22, W.y - 8, W.w + 44, 2);
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? W.x - 20 : W.x + W.w + 4;
      for (let k = 0; k < 16; k += 2) {
        g.fillStyle(k % 4 ? 0x7b2a3a : 0x8e3a4a, 1).fillRect(x0 + k, W.y - 6, 2, W.h + 14);
      }
    }
    // the door you came in by
    g.fillStyle(0x14100c, 1).fillRect(5, 58, 26, 66);
    g.fillStyle(0x6a4a2a, 1).fillRect(6, 59, 24, 65);
    g.fillStyle(0xd8a838, 1).fillRect(26, 92, 2, 2);
    g.fillStyle(0x14100c, 1);
    g.lineStyle(1, 0x14100c, 1);
  }

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
      return;
    }
    // one button, up out of the way of your feet
    this.ui.add(button(this, GAME_W / 2, 31, 'DECORATE', () => this.setDecorating(true), { width: 58, height: 11 }));
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
      this.say(`YOU ARE NOT TIRED. SLEEP COMES AFTER ${DUSK_HOUR}:00.`);
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
