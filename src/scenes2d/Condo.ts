/**
 * ---- UNIT 612, LILY'S CONDOS.  Yours for as long as the rent is paid.
 *
 * IT IS ROOM 612.  Up in the lift, along Level 6, through the last door:
 * the same room the hotel's guests get -- the plain warm walls, the oak
 * floor, the tall window in the middle with its curtains tied back, the
 * door out and the white bathroom door beside it, the bed against the far
 * wall between its lamps -- painted by the same hand (art/hotelInterior).
 *
 * THE BATHROOM IS ITS OWN ROOM, through its own door: white tile, the
 * chequered floor, the mirror and its light, a towel rail -- and nothing
 * plumbed in.  No bath, no basin, no toilet: the pipes are capped in the
 * wall, waiting.  Those are bought at Home and Hearth and put in there.
 *
 * DECORATE is the same in both rooms: pick something you own, carry it
 * about with your finger, TURN it round, and PUT IT DOWN when it looks
 * right -- or CANCEL and it goes back in the van.  Anything already down can
 * be picked up again, moved, turned or taken away, and the flat remembers
 * exactly where you left it.  The bathroom things go in the bathroom (and
 * only there); everything else goes in the room.  What is in it is real:
 * sit on the chairs, sleep in the bed, switch the lamps on, play the radio,
 * wash in what you have plumbed in.
 */

import Phaser from 'phaser';
import { caughtByPolice, stealthPhase } from '../game/patrol';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { button, pinToScreen, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { furnitureById, type FurnitureDef } from '../game/catalog';
import { onPhaseTurn } from '../game/dayNight';
import { unitNo } from '../game/life';
import { earnBadge } from '../game/badges';
import { NIGHT_HOUR, twelveHour, clock, furnishStarterRoom, movePlacement, placeFurniture, removePlacement, sleep, visit, type Placement } from '../game/life';
import { useOf, washLine } from '../game/furnitureUse';
import { WalkRoom, type Fixture } from './rooms/WalkRoom';
import { Piece } from './rooms/piece';
import { furnitureCover, type Cover } from '../game/indoorPatrol';
import type { Place } from '../game/policeVisits';
import { touchControls } from '../ui/touchControls';
import {
  BATH_DOOR_X,
  CEIL_Y,
  FLOOR_Y,
  ROOM_DOOR_X,
  ROOM_WINDOW,
  paintBathroom,
  paintCurtain,
  paintGlazing,
  paintRoom as paintHotelRoom,
  paintRoomLight,
  paintView,
} from '../art/hotelInterior';

type Area = 'room' | 'bath';

/**
 * WHERE THINGS GO.  The floor is the strip along the back wall -- furniture
 * stands against it, as the bed does, and the front of the floor is kept to
 * walk on (so nothing you put down can ever shut you away from a door or
 * the bed).  Things for the wall hang between the ceiling and the skirting.
 */
const PLACE_TOP = FLOOR_Y + 4;
const PLACE_BOTTOM = FLOOR_Y + 12;
const WALL_TOP = CEIL_Y + 3;
const WALL_BOTTOM = FLOOR_Y - 6;
/** The doors (and the floor in front of them): the corridor door and the bathroom's. */
const DOORS_RIGHT = BATH_DOOR_X + 11;
/** The bathroom's one door, back to the room. */
const BATH_BACK_X = 22;
/** The coat hook: your clothes, the wardrobe. */
const HOOK = { x: 104, y: 124 };

export class Condo extends WalkRoom {
  private area: Area = 'room';
  private from: 'corridor' | 'room' | 'bath' = 'corridor';
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
  private view: Phaser.GameObjects.Image | null = null;
  private lamps: Phaser.GameObjects.Image | null = null;
  private curtainL: Phaser.GameObjects.Image | null = null;
  private curtainR: Phaser.GameObjects.Image | null = null;
  private curtainsOpen = true;
  /** The coat hook: only there while no wardrobe stands in the room. */
  private hook: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super('Condo');
  }

  init(data: { area?: Area; from?: 'corridor' | 'room' | 'bath' } = {}): void {
    this.area = data.area ?? 'room';
    this.from = data.from ?? (this.area === 'bath' ? 'room' : 'corridor');
  }

  create(): void {
    // (the floor line of the hotel's rooms: the feet walk just in front of it)
    this.floorTop = FLOOR_Y - 2;
    this.decorating = false;
    this.picked = null;
    this.placing = null;
    this.picker = null;
    this.pickerPage = 0;
    this.dragging = false;
    this.pieces = [];
    this.view = null;
    this.lamps = null;
    this.dim = null;
    super.create();
    visit('condo');
    // the man's flat, the first time through its door
    if (unitNo() === 213 && earnBadge('new_leaf', this)) this.time.delayedCall(900, () => this.say('ROOM 213. A PLACE OF MY OWN. FOR A WEEK, ANYWAY.'));
    this.ui = this.add.container(0, 0).setDepth(850).setScrollFactor(0);
    this.buildButtons();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.pointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.pointerMove(p));
    this.input.on('pointerup', () => this.pointerUp());
    // (left mid-decorate -- evicted, say -- the pad comes back)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.decorating) touchControls.releaseStick();
      this.decorating = false;
    });
  }

  protected music(): string {
    return 'hotel_room';
  }

  /** Out of the flat: on to Level 6, outside your door. */
  protected leave(): void {
    if (this.area === 'bath') {
      this.exitTo('Condo', { area: 'room', from: 'bath' });
      return;
    }
    this.exitTo('Hotel', { area: 'corridor', from: 'room', level: unitNo() === 213 ? 2 : 6 });
  }

  protected placeData(): Record<string, string | number | boolean> {
    return { area: this.area };
  }

  protected spawnX(): number {
    if (this.area === 'bath') return BATH_BACK_X + 14;
    return this.from === 'bath' ? BATH_DOOR_X + 2 : ROOM_DOOR_X + 14;
  }

  protected paintDoor(): void {
    // (the doors are part of the painted room: see paintRoom)
  }

  protected exitFixture(): Fixture {
    const x = this.area === 'bath' ? BATH_BACK_X : ROOM_DOOR_X;
    return {
      x,
      y: this.floorTop,
      w: 16,
      depth: 0,
      wall: true,
      label: () => (this.area === 'bath' ? '[E] BACK TO THE ROOM' : '[E] CORRIDOR'),
      use: () => this.goOut(),
      hit: { x: x - 10, y: FLOOR_Y - 38, w: 20, h: 46 },
    };
  }

  protected busy(): boolean {
    return super.busy() || this.decorating;
  }

  protected entered(): void {
    // the window keeps time: the sky in it is the hour's, and the room is
    // lit by the lamps once it is dark
    onPhaseTurn(this, (p) => {
      this.paintLight();
      if (p === 'night') this.say('IT IS NIGHT. TIME FOR BED.');
      else if (p === 'evening') this.say('THE SUN IS GOING DOWN.');
      else this.say('SUNRISE. A NEW DAY.');
    });
    if (!store.get().life.placed.some((p) => this.areaOf(p) === 'bath') && this.area === 'bath') {
      this.time.delayedCall(500, () => this.say('NOTHING PLUMBED IN YET. DECORATE TO PUT IN WHAT YOU BUY.'));
    }
  }

  // ------------------------------------------------------------------ room

  /** A canvas texture painted once and kept, keyed by what it shows. */
  private painted(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): string {
    if (!this.textures.exists(key)) {
      const t = this.textures.createCanvas(key, w, h);
      if (t) {
        paint(t.getContext());
        t.refresh();
      }
    }
    return key;
  }

  protected paintRoom(): void {
    this.outline = this.add.graphics().setDepth(700);
    this.dim = this.add.graphics().setDepth(690);
    if (this.area === 'bath') {
      this.add.image(0, 0, this.painted('condo_bath_v1', GAME_W, GAME_H, (g) => paintBathroom(g, false))).setOrigin(0, 0).setDepth(-2);
    } else {
      const { x, y, w, h } = ROOM_WINDOW;
      // the sky through the window, behind the room; the glazing over it
      this.view = this.add.image(x, y, this.viewKey()).setOrigin(0, 0).setDepth(-4);
      this.add.image(x, y, this.painted(`hotel_glazing_${w}`, w, h, (g) => paintGlazing(g, w, h))).setOrigin(0, 0).setDepth(-3);
      this.add.image(0, 0, this.painted('condo_room_v1', GAME_W, GAME_H, (g) => paintHotelRoom(g, false))).setOrigin(0, 0).setDepth(-2);
      // the curtains, tied back either side
      const cw = w / 2 + 4;
      const ch = h + 7;
      this.curtainL = this.add.image(x - 6, y - 4, this.painted(`hotel_curtain_l_${cw}`, cw, ch, (g) => paintCurtain(g, cw, ch, -1))).setOrigin(0, 0).setDepth(-1);
      this.curtainR = this.add.image(x + w + 6, y - 4, this.painted(`hotel_curtain_r_${cw}`, cw, ch, (g) => paintCurtain(g, cw, ch, 1))).setOrigin(1, 0).setDepth(-1);
      this.setCurtains(this.registry.get('condoCurtains') !== false, true);
      // the coat hook by the doors, with your coat on it: the wardrobe
      const hk = this.add.graphics().setDepth(-1);
      this.hook = hk;
      hk.fillStyle(0x6a7078, 1).fillRect(HOOK.x - 7, HOOK.y, 14, 2);
      hk.fillStyle(0xd4d8dc, 1).fillRect(HOOK.x - 7, HOOK.y, 14, 1);
      hk.fillStyle(0x6a6a44, 1).fillRect(HOOK.x - 6, HOOK.y + 2, 6, 15);
      hk.fillStyle(0x58583a, 1).fillRect(HOOK.x - 6, HOOK.y + 14, 6, 3);
      hk.fillStyle(0x5a3a3a, 1).fillRect(HOOK.x + 2, HOOK.y + 2, 4, 6);
      this.lamps = this.add.image(0, 0, this.painted('condo_room_light_v1', GAME_W, GAME_H, (g) => paintRoomLight(g, false))).setOrigin(0, 0).setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
      // the flat's number over the inside of its door
      text(this, ROOM_DOOR_X, CEIL_Y + 5, String(unitNo()), 0x8a8070).setOrigin(0.5, 0).setDepth(-1);
    }
    // (a unit rented before it came furnished gets its sleeping bag and wardrobe now)
    furnishStarterRoom();
    this.settle();
    this.paintLight();
    this.placePieces();
  }

  private viewKey(): string {
    const c = clock();
    // morning, the sun going down (from 5 PM), or night
    const when = c.dark ? 'night' : c.phase === 'evening' ? 'evening' : 'day';
    const { w, h } = ROOM_WINDOW;
    return this.painted(`hotel_view_${when}_${w}`, w, h, (g) => paintView(g, w, h, when));
  }

  /** The hour on the room: the sky in the window, the lamps, the dark. */
  private paintLight(): void {
    const c = clock();
    this.view?.setTexture(this.viewKey());
    this.lamps?.setVisible(c.dark);
    const d = this.dim;
    if (!d) return;
    d.clear();
    if (c.dark) d.fillStyle(0x0a1030, this.area === 'bath' ? 0.22 : 0.3).fillRect(0, 0, GAME_W, GAME_H);
    else if (c.phase === 'evening') d.fillStyle(0xff9a50, 0.07).fillRect(0, 0, GAME_W, GAME_H);
  }

  /** Which room a placed piece is in: by what it is. */
  private areaOf(p: Placement): Area {
    const f = furnitureById(p.id);
    return f && this.roomFor(f) === 'bath' ? 'bath' : 'room';
  }

  /**
   * The flat as it was left: anything of this room's standing somewhere it
   * can no longer go (a save from before the flat was the hotel's room)
   * is moved to somewhere it can, or back into the van if there is nowhere.
   */
  private settle(): void {
    for (const p of [...this.areaPlacements()]) {
      const f = furnitureById(p.id);
      if (!f || this.valid(f, p.x, p.y, p.uid)) continue;
      const spot = this.freeSpot(f, p.uid);
      if (spot) movePlacement(p.uid, spot[0], spot[1]);
      else removePlacement(p.uid);
    }
  }

  /** Every placed piece in this room, as a thing in the room. */
  private placePieces(): void {
    for (const p of this.pieces) p.destroy();
    this.pieces = [];
    for (const pl of this.areaPlacements()) {
      const f = furnitureById(pl.id);
      if (f) this.pieces.push(new Piece(this, f, pl.x, pl.y, pl.flip));
    }
    this.hook?.setVisible(!this.hasWardrobe());
    this.drawOutline();
  }

  /**
   * Your own flat: the police never come into it (log #89).  (They used to
   * come up to look round it now and then.)
   */
  protected policePlace(): Place | null {
    return null;
  }

  /** A wardrobe or a tall bookcase hides you; the bed and the sofa do not. */
  protected covers(): Cover[] {
    return this.areaPlacements()
      .map((p) => {
        const f = furnitureById(p.id);
        return f ? furnitureCover(f, p.x, p.y) : null;
      })
      .filter((c): c is Cover => !!c);
  }

  protected fixtures(): Fixture[] {
    const out: Fixture[] = [];
    if (this.area === 'room') {
      out.push(
        {
          x: BATH_DOOR_X,
          y: this.floorTop,
          w: 15,
          depth: 0,
          wall: true,
          label: () => '[E] BATHROOM',
          use: () => this.toBathroom(),
          hit: { x: BATH_DOOR_X - 10, y: FLOOR_Y - 38, w: 20, h: 46 },
        },
        ...(this.hasWardrobe() ? [] : [{
          x: HOOK.x,
          y: this.floorTop,
          w: 14,
          depth: 0,
          wall: true,
          label: () => '[E] WARDROBE',
          use: () => this.openWardrobe(),
          hit: { x: HOOK.x - 9, y: HOOK.y - 2, w: 18, h: 22 },
        }]),
        {
          x: ROOM_WINDOW.x + ROOM_WINDOW.w / 2,
          y: this.floorTop,
          w: 30,
          depth: 0,
          wall: true,
          label: () => (this.curtainsOpen ? '[E] CLOSE THE CURTAINS' : '[E] OPEN THE CURTAINS'),
          use: () => this.toggleCurtains(),
          hit: { x: ROOM_WINDOW.x - 8, y: ROOM_WINDOW.y - 6, w: ROOM_WINDOW.w + 16, h: ROOM_WINDOW.h + 12 },
        },
      );
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
        label: () => (f.id === 'fur_wardrobe' ? '[E] WARDROBE' : verb === 'sit' ? `[E] SIT ON THE ${f.name}` : verb === 'lie' ? `[E] SLEEP IN THE ${f.name}` : verb === 'wash' ? `[E] USE THE ${f.name}` : verb === 'switch' ? `[E] ${f.name}: ${piece.on ? 'OFF' : 'ON'}` : verb === 'play' ? `[E] PLAY THE ${f.name}` : f.name),
        use: () => this.usePiece(piece),
      });
    }
    return out;
  }

  /** Tied back (open) or drawn (closed): squeezed to the sides, or across the glass. */
  private setCurtains(open: boolean, instant = false): void {
    this.curtainsOpen = open;
    this.registry.set('condoCurtains', open);
    for (const c of [this.curtainL, this.curtainR]) {
      if (!c) continue;
      this.tweens.killTweensOf(c);
      if (instant) c.setScale(open ? 0.24 : 1, 1);
      else this.tweens.add({ targets: c, scaleX: open ? 0.24 : 1, duration: 700, ease: 'Sine.easeInOut' });
    }
  }

  private toggleCurtains(): void {
    if (this.busy()) return;
    audio.sfx('door_creak', 0.25);
    this.setCurtains(!this.curtainsOpen);
    this.say(this.curtainsOpen ? 'THE CURTAINS ARE OPEN.' : 'THE CURTAINS ARE DRAWN.');
  }

  /** Through the white door, into the bathroom. */
  private toBathroom(): void {
    if (this.busy()) return;
    this.locked = true;
    audio.sfx('door_open', 0.6);
    this.exitTo('Condo', { area: 'bath', from: 'room' });
  }

  private usePiece(piece: Piece): void {
    const f = piece.def;
    switch (useOf(f)) {
      case 'sit':
        this.sitOn(piece.x, piece.y + 1, 'chair', piece.flip ? -1 : 1);
        this.say('YOU SIT DOWN. MOVE TO GET UP.');
        break;
      case 'lie':
        this.goToSleep(f.id === 'fur_bed' || f.id === 'fur_bed_premium' ? 'bed' : 'mattress');
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
        if (f.id === 'fur_wardrobe') return this.openWardrobe();
        this.say(`YOUR ${f.name}. ${f.note}.`);
    }
  }

  private hasWardrobe(): boolean {
    return this.area === 'room' && this.areaPlacements().some((p) => p.id === 'fur_wardrobe');
  }

  private openWardrobe(): void {
    if (this.busy()) return;
    this.locked = true;
    this.scene.launch('Shop', { kind: 'wardrobe', from: 'Condo' });
  }

  private dim: Phaser.GameObjects.Graphics | null = null;

  private placements(): Placement[] {
    return store.get().life.placed;
  }

  /** What is in this room (the bathroom's things in the bathroom, the rest in the room). */
  private areaPlacements(): Placement[] {
    return this.placements().filter((p) => this.areaOf(p) === this.area);
  }

  private rectOf(p: Placement, f = furnitureById(p.id)!): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(p.x - f.w / 2, p.y - f.h, f.w, f.h);
  }

  /** Bathroom things go in the bathroom; everything else stays out of it. */
  private roomFor(f: FurnitureDef): Area {
    return f.cat === 'bath' ? 'bath' : 'room';
  }

  /** Why `f` cannot go at (x, y) in this room -- or '' if it can. */
  private whyNot(f: FurnitureDef, x: number, y: number, uid: number | null): string {
    // ---- WHICH ROOM.  The bath, the basin, the toilet and the shower are
    // plumbed in, and the plumbing is in the bathroom: they go in there and
    // nowhere else, and nothing else goes in there with them.
    if (this.roomFor(f) !== this.area) return this.area === 'bath' ? 'THAT DOES NOT GO IN THE BATHROOM.' : 'THAT BELONGS IN THE BATHROOM.';
    const r = new Phaser.Geom.Rectangle(x - f.w / 2, y - f.h, f.w, f.h);
    if (r.x < 4 || r.right > GAME_W - 4) return 'IT WILL NOT FIT THERE.';
    const over = (x0: number, x1: number) => r.right > x0 && r.x < x1;
    const doorsRight = this.area === 'bath' ? BATH_BACK_X + 11 : DOORS_RIGHT;
    if (f.wall) {
      if (r.y < WALL_TOP || r.bottom > WALL_BOTTOM) return 'TOO HIGH OR TOO LOW FOR THE WALL.';
      if (over(0, doorsRight)) return 'NOT OVER THE DOOR.';
      if (this.area === 'room') {
        const W = ROOM_WINDOW;
        if (over(W.x - 14, W.x + W.w + 14)) return 'NOT OVER THE WINDOW.';
        // (the hook is only there until you have a wardrobe: then the wall is yours)
        if (!this.hasWardrobe() && over(HOOK.x - 9, HOOK.x + 9)) return 'THE COAT HOOK IS THERE.';
      } else if (over(140, 180) || over(212, 234)) return 'THE MIRROR AND THE WINDOW ARE THERE.';
    } else {
      if (y < PLACE_TOP || y > PLACE_BOTTOM) return 'IT HAS TO STAND ON THE FLOOR.';
      if (f.cat !== 'rug') {
        if (over(0, doorsRight)) return 'NOT IN FRONT OF THE DOOR.';
      }
    }
    for (const p of this.areaPlacements()) {
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
      // (right of the clock and the rent, clear of the settings gear on a phone)
      this.ui.add(button(this, GAME_W - 70, 31, 'DECORATE', () => this.setDecorating(true), { width: 58, height: 11 }));
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
    // (on a phone the pad and the E button are real elements over the
    // picture, right where PLACE and DONE are: they go while you decorate)
    if (on !== this.decorating) {
      if (on) touchControls.holdStick();
      else touchControls.releaseStick();
    }
    this.decorating = on;
    this.picked = null;
    this.buildButtons();
    this.drawOutline();
    if (!on) this.rebuild();
    if (on) {
      const here = this.areaPlacements().length || this.unplaced().length;
      const elsewhere = this.unplaced(this.area === 'bath' ? 'room' : 'bath').length;
      this.say(
        here
          ? 'TAP SOMETHING TO PICK IT UP. DRAG TO MOVE IT.'
          : elsewhere
            ? this.area === 'bath'
              ? 'NOTHING FOR THE BATHROOM YET. THE REST GOES IN THE ROOM.'
              : 'THE BATHROOM THINGS GO IN THE BATHROOM, THROUGH THE WHITE DOOR.'
            : 'BUY FURNITURE AT HOME AND HEARTH, EAST OF THE ARCADE.',
      );
    }
  }

  /** What you own and have not put out, that goes in this room (or in `area`). */
  private unplaced(area: Area = this.area): Array<{ f: FurnitureDef; n: number }> {
    const l = store.get().life;
    return Object.entries(l.furniture)
      .map(([id, n]) => ({ f: furnitureById(id)!, n: n - l.placed.filter((p) => p.id === id).length }))
      .filter((e) => e.f && e.n > 0 && this.roomFor(e.f) === area);
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
        // (a frame later: the same tap must not also be the finger that drags it)
        this.time.delayedCall(0, () => this.startPlacing(e.f));
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
    const spot = this.freeSpot(f, null);
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

  /** Somewhere it can go: the open middle of this room, working outwards. */
  private freeSpot(f: FurnitureDef, uid: number | null): [number, number] | null {
    const lo = 40;
    const hi = GAME_W - 10;
    const centre = this.area === 'bath' ? 180 : 170;
    const mid = (x: number): number => Math.abs(x - centre);
    const tries: Array<[number, number]> = [];
    if (f.wall) for (let y = WALL_TOP + f.h + 4; y <= WALL_BOTTOM; y += 4) for (let x = lo; x < hi; x += 4) tries.push([x, y]);
    else for (let y = PLACE_BOTTOM - 2; y >= PLACE_TOP; y -= 2) for (let x = lo; x < hi; x += 4) tries.push([x, y]);
    tries.sort((a, b) => mid(a[0]) - mid(b[0]) || (f.wall ? a[1] - b[1] : b[1] - a[1]));
    return tries.find(([x, y]) => this.valid(f, x, y, uid)) ?? null;
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
    const hit = [...this.areaPlacements()]
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
    const y = Math.round(f.wall ? Phaser.Math.Clamp(p.worldY + f.h / 2, WALL_TOP + f.h, WALL_BOTTOM) : Phaser.Math.Clamp(p.worldY + f.h / 2, PLACE_TOP, PLACE_BOTTOM));
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
    // (the man said it: lie down with the poster's face, and they have you)
    if (stealthPhase()) {
      this.locked = true;
      caughtByPolice(this, 'sleep');
      return;
    }
    this.locked = true;
    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.time.delayedCall(1000, () => {
      const r = sleep(on);
      this.paintLight();
      this.cameras.main.fadeIn(900, 0, 0, 0);
      this.say(r.msg);
      this.locked = false;
    });
  }

  protected tick(): void {
    // evicted while standing in it (the grace day ran out): shown the door
    if (!store.get().life.rented && !this.locked) {
      this.locked = true;
      this.say('THE LANDLORD IS AT THE DOOR. YOU HAVE TO GO.');
      this.time.delayedCall(1800, () => this.exitTo('Hotel', { area: 'corridor', from: 'room', level: unitNo() === 213 ? 2 : 6 }));
    }
  }

  update(t: number, delta: number): void {
    super.update(t, delta);
    // the coat hook comes down once a wardrobe is in (its wall is free for shelves and pictures)
    this.hook?.setVisible(!this.hasWardrobe());
    // (the eviction check runs even while a menu is up)
    if (super.busy() || this.decorating) this.tick();
  }
}

