/**
 * ---- THE STAIRS AT LILY'S, side-on: the 3D stairwell, flat.
 *
 * The whole well in one tall picture, the way the 3D one is built: on every
 * floor a landing at the left with its fire door in the back wall, a flight
 * climbing away to the right to the half-landing, and a second flight
 * doubling back up to the left to the next floor's landing -- a zigzag all
 * the way up from the lobby to the sixth, the roof door at the very top.
 * The view goes up the well with you as you climb, and down as you go down.
 *
 *   LEFT AND RIGHT walk you along the landings and up or down the flights:
 *   on a flight your feet follow the steps.  Where the flight up and the
 *   flight down meet at a landing, UP or DOWN picks which you take; walking
 *   on without either, you keep going the way you were (up if you were
 *   climbing, down if you were going down).
 *
 *   THE DOOR on each floor's landing goes through to that floor: the lobby
 *   on G, your corridor on 2, the old one on 6.  1 and 3 to 5 are other
 *   people's floors, their doors locked from this side.  The foot of the well
 *   is G's landing.  At the top, the roof door opens on to the roof: out
 *   there you walk along it, the town all round, and come back in the same
 *   way.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { KEYS } from '../core/input';
import { centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { TokenHud } from '../ui/hud';
import { attachPockets } from '../ui/pockets';
import { Player, PLAYER_SPEED } from '../art/player';
import { froggyLayer } from '../render/froggyLayer';
import { backPlate, fitPrompt, SUBTITLE_Y } from '../ui/plate';
import { resumeSpot, trackPlace } from '../game/place';
import { store } from '../core/state';
import { clock as lifeClock } from '../game/life';

export const TOP_FLOOR = 6;
/** The bottom of the well: G, the lobby's landing. */
export const G_FLOOR = 0;
/** One floor to the next, in pixels up the well. */
const FLOOR_H = 92;
/** Above the sixth: the last flight up to the roof door, and some ceiling. */
const HEAD = 96;
/** Below G's landing: just the bottom of the well (no basement: G is the bottom). */
const FOOT = 20;
const WORLD_H = HEAD + FLOOR_H * (TOP_FLOOR - G_FLOOR) + FOOT + 40;
/**
 * THE WELL'S SIDES: solid walls, the dark of a lift shaft's (see paintLift),
 * left of WALL_L and right of WALL_R.  Nothing is walked past them.
 */
const WALL_L = 44;
const WALL_R = 258;
/** The landings: the floor's at the left, the half-landing at the right. */
const FL = { x0: WALL_L + 2, x1: 104 };
// (the half-landing, with no door on it, only as deep as the turn needs)
const HL = { x0: 216, x1: WALL_R - 4 };
/** A tread: how far along it runs. */
const TREAD = 6;
/** Each floor's fire door: at the inner end of its landing, by the foot of the flight. */
const DOOR_X = 82;
/** The floor's number, black on a small white square, on the wall beside the door. */
const SIGN = { x: DOOR_X + 13, w: 9, h: 9, up: 33 };

/** The line the feet stand on at floor `f`'s landing. */
const floorY = (f: number): number => HEAD + FLOOR_H * (TOP_FLOOR - f) + 40;

/**
 * THE WAY UP, as one line: lobby landing, flight, half-landing, flight,
 * the next landing, and so on to the roof door.  Each piece knows where it
 * runs from and to; a flight's feet are on its treads, so the line it is
 * drawn and walked on is stepped.
 */
interface Piece {
  kind: 'landing' | 'half' | 'flight';
  /** For a landing, the floor it is. */
  floor: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function buildPath(): Piece[] {
  const out: Piece[] = [];
  for (let f = G_FLOOR; f <= TOP_FLOOR; f++) {
    const y = floorY(f);
    out.push({ kind: 'landing', floor: f, x0: FL.x0, y0: y, x1: FL.x1, y1: y });
    // up and away to the right, to the half-landing
    const hy = y - FLOOR_H / 2;
    out.push({ kind: 'flight', floor: f, x0: FL.x1, y0: y, x1: HL.x0, y1: hy });
    out.push({ kind: 'half', floor: f, x0: HL.x0, y0: hy, x1: HL.x1, y1: hy });
    // and back up to the left, to the next floor (or, from the sixth, the roof)
    out.push({ kind: 'flight', floor: f, x0: HL.x0, y0: hy, x1: FL.x1, y1: hy - FLOOR_H / 2 });
  }
  // the roof door's landing, at the head of the last flight
  const ry = floorY(TOP_FLOOR) - FLOOR_H;
  out.push({ kind: 'landing', floor: TOP_FLOOR + 1, x0: FL.x0, y0: ry, x1: FL.x1, y1: ry });
  return out;
}

const PATH = buildPath();
/** The flights, in order up the well: the line you climb along. */
const FLIGHTS = PATH.filter((p) => p.kind === 'flight');
const FLEN = HL.x0 - FL.x1;
const TOTAL = FLEN * FLIGHTS.length;
/**
 * Where two flights meet there is a landing off to the side: at the even
 * joins (0 = G's, 2 = level 1's, ... 12 = level 6's, 14 = the roof door's) the
 * floor's landing out to the left, at the odd ones a half-landing out to
 * the right.
 */
const JOINS = FLIGHTS.length;
const joinY = (j: number): number => (j % 2 === 0 ? floorY(G_FLOOR) - (j / 2) * FLOOR_H : floorY(G_FLOOR) - ((j - 1) / 2) * FLOOR_H - FLOOR_H / 2);
const joinX = (j: number): number => (j % 2 === 0 ? FL.x1 : HL.x0);
/** Which way is out on to a join's landing: left for a floor's, right for a half's. */
const outward = (j: number): 1 | -1 => (j % 2 === 0 ? -1 : 1);
/** How far along its landing you can go from the join (to the door end, or the wall). */
const spurEnd = (j: number): number => (j % 2 === 0 ? FL.x0 + 2 : HL.x1 - 2);

/** Where the feet are at `s` along the flights: on the tread under them. */
export function feetAt(s: number): { x: number; y: number } {
  s = Phaser.Math.Clamp(s, 0, TOTAL);
  const i = Math.min(FLIGHTS.length - 1, Math.floor(s / FLEN));
  const p = FLIGHTS[i];
  const k = (s - i * FLEN) / FLEN;
  const x = p.x0 + (p.x1 - p.x0) * k;
  if (k <= 0.001) return { x, y: p.y0 };
  if (k >= 0.999) return { x, y: p.y1 };
  const n = Math.round(FLEN / TREAD);
  const step = Math.min(n - 1, Math.floor(k * n));
  return { x, y: Math.round(p.y0 + ((p.y1 - p.y0) * (step + 0.5)) / n) };
}

type Spot = 'door' | 'roof' | 'roofdoor' | null;

/** The roof, out of the roof door: where the feet stand, and how far along it you can go. */
const ROOF = { y: 150, x0: 30, x1: GAME_W - 26, door: 40 };
/** Floors whose doors are locked from the stairs (other people's). */
const LOCKED = new Set([1, 3, 4, 5]);

export class Stairwell extends Phaser.Scene {
  private floor = 1;
  private player!: Player;
  /** How far up the flights you are... */
  private s = 0;
  /** ...or, off them, which landing you are out on and where along it. */
  private spur: number | null = null;
  private sx = 0;
  /** Which way along the flights you were last going: +1 up, -1 down. */
  private going: 1 | -1 = 1;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private prompt!: Phaser.GameObjects.BitmapText;
  private promptPlate!: Phaser.GameObjects.Rectangle;
  private mutter!: Phaser.GameObjects.BitmapText;
  private spot: Spot = null;
  private locked = false;
  private stepT = 0;

  constructor() {
    super('Stairwell');
  }

  /** Out on the roof (through the roof door), and the picture of it. */
  private onRoof = false;
  private roofImg: Phaser.GameObjects.Image | null = null;
  private wellImg: Phaser.GameObjects.Image | null = null;
  private rail: Phaser.GameObjects.Graphics | null = null;

  init(data: { floor?: number } = {}): void {
    this.floor = Phaser.Math.Clamp(Math.round(data.floor ?? G_FLOOR), G_FLOOR, TOP_FLOOR);
  }

  create(): void {
    froggyLayer.clear();
    fadeIn(this);
    audio.setScene({ music: 'hotel_lobby', ambience: [] });
    this.locked = false;
    this.spot = null;
    this.stepT = 0;
    this.onRoof = false;
    const key = 'stairwell_well_v4';
    if (!this.textures.exists(key)) {
      const t = this.textures.createCanvas(key, GAME_W, WORLD_H);
      if (t) {
        paintWell(t.getContext());
        t.refresh();
      }
    }
    // (each floor's number is painted in, on its little white square by the door)
    this.wellImg = this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

    // in at this floor's door, facing the stairs
    this.spur = this.floor * 2;
    this.sx = DOOR_X;
    this.s = this.spur * FLEN;
    this.player = new Player(this, this.sx, joinY(this.spur), false);
    this.player.setSurface('concrete');
    this.player.sprite.setDepth(500);
    const resume = resumeSpot(this.sys.settings.data);
    trackPlace(this, () => this.player, { floor: this.floor }, resume);
    if (resume) this.nearest(this.player.x, this.player.y);
    this.place();

    // the rails up the front of every flight, over the feet
    const rail = this.add.graphics().setDepth(700);
    this.rail = rail;
    for (const p of PATH) {
      if (p.kind !== 'flight') continue;
      const a = Math.min(p.x0, p.x1);
      const b = Math.max(p.x0, p.x1);
      for (let x = a; x <= b; x++) {
        const k = (x - p.x0) / (p.x1 - p.x0);
        const y = Math.round(p.y0 + (p.y1 - p.y0) * k) - 12;
        rail.fillStyle(0x6a6e74, 1).fillRect(x, y, 1, 1);
        rail.fillStyle(0xd4d8dc, 1).fillRect(x, y - 1, 1, 1);
      }
      for (let x = a + 6; x < b; x += 14) {
        const k = (x - p.x0) / (p.x1 - p.x0);
        const y = Math.round(p.y0 + (p.y1 - p.y0) * k);
        rail.fillStyle(0x6a6e74, 1).fillRect(x, y - 12, 1, 12);
      }
    }

    // the view: the width of the well, and up and down it with you
    const cam = this.cameras.main;
    cam.setBounds(0, 0, GAME_W, WORLD_H);
    cam.scrollY = Phaser.Math.Clamp(this.player.y - GAME_H * 0.62, 0, WORLD_H - GAME_H);

    new TokenHud(this);
    attachPockets(this, () => this.locked);
    this.promptPlate = this.add.rectangle(0, 0, 4, 12, PALETTE.black, 0.72).setDepth(800).setVisible(false);
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setDepth(801).setOrigin(0.5, 0.5).setVisible(false);
    this.mutter = centerText(this, GAME_W / 2, SUBTITLE_Y, '', PALETTE.cream).setDepth(860).setScrollFactor(0).setVisible(false).setMaxWidth(290);
    backPlate(this, this.mutter);

    const kb = this.input.keyboard;
    const bind = (n: readonly string[]) => (kb ? n.map((k) => kb.addKey(k)) : []);
    this.keys = { up: bind(KEYS.up), down: bind(KEYS.down), left: bind(KEYS.left), right: bind(KEYS.right) };
    kb?.on('keydown-E', () => this.interact());
    // a tap on a door goes through it (once you are at it)
    for (let f = G_FLOOR; f <= TOP_FLOOR; f++) {
      this.add
        .zone(DOOR_X - 12, floorY(f) - 40, 24, 42)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (this.spot === 'door' && this.landingFloor() === f && !this.onRoof) this.interact();
          else this.say('WALK UP TO THE DOOR.');
        });
    }
  }

  /** Put the feet at the spot nearest where a save left them. */
  private nearest(x: number, y: number): void {
    let bd = Infinity;
    for (let s = 0; s <= TOTAL; s += 2) {
      const p = feetAt(s);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) {
        bd = d;
        this.s = s;
        this.spur = null;
      }
    }
    for (let j = 0; j <= JOINS; j++) {
      const d = Math.abs(joinY(j) - y) + (Math.sign(x - joinX(j)) === outward(j) ? 0 : 99);
      if (d < bd) {
        bd = d;
        this.spur = j;
        this.sx = Phaser.Math.Clamp(x, Math.min(joinX(j), spurEnd(j)), Math.max(joinX(j), spurEnd(j)));
        this.s = j * FLEN;
      }
    }
  }

  /** The floor whose landing you are on (0 is G), or -1 for anywhere else (7: the roof door's). */
  private landingFloor(): number {
    return this.spur !== null && this.spur % 2 === 0 ? this.spur / 2 : -1;
  }

  private feet(): { x: number; y: number } {
    return this.spur !== null ? { x: this.sx, y: joinY(this.spur) } : feetAt(this.s);
  }

  private place(): void {
    const at = this.feet();
    this.player.setPosition(Math.round(at.x), at.y);
  }

  private say(m: string): void {
    this.mutter.setText(m).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.mutter);
    this.tweens.add({ targets: this.mutter, alpha: 0, delay: 2400, duration: 500 });
  }

  private held(k: string): boolean {
    return this.keys[k]?.some((x) => x.isDown) ?? false;
  }

  update(_t: number, delta: number): void {
    const cam = this.cameras.main;
    // the view follows you up and down the well, a little behind
    const want = this.onRoof ? 0 : Phaser.Math.Clamp(this.player.y - GAME_H * 0.62, 0, WORLD_H - GAME_H);
    cam.scrollY += (want - cam.scrollY) * Math.min(1, (delta / 1000) * 5);
    if (this.locked) {
      this.prompt.setVisible(false);
      this.promptPlate.setVisible(false);
      return;
    }
    const dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const dy = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    if (this.onRoof) return this.roofFrame(dx, delta);
    const was = this.feet();
    if (dx || dy) this.walk(dx, dy, (PLAYER_SPEED * delta) / 1000);
    const now = this.feet();
    const mx = now.x - was.x;
    if (mx || now.y !== was.y) {
      this.player.stride(mx ? Math.sign(mx) : dx || 1, delta);
      this.place();
      this.stepT += delta;
      if (this.stepT > 300) {
        this.stepT = 0;
        audio.sfx('footstep_concrete', 0.5);
      }
    } else this.player.stand();

    const lf = this.landingFloor();
    const at = this.feet();
    this.spot = lf >= G_FLOOR && lf <= TOP_FLOOR && Math.abs(at.x - DOOR_X) < 12 ? 'door' : lf === TOP_FLOOR + 1 && at.x < FL.x0 + 30 ? 'roof' : null;
    if (!this.spot) {
      this.prompt.setVisible(false);
      this.promptPlate.setVisible(false);
      return;
    }
    const label = this.spot === 'roof' ? '[E] OUT ON TO THE ROOF' : lf === G_FLOOR ? '[E] TO THE LOBBY' : `[E] TO LEVEL ${lf}`;
    this.prompt.setText(label).setPosition(Phaser.Math.Clamp(this.player.x, 50, GAME_W - 50), this.player.y - 36).setVisible(true);
    fitPrompt(this.promptPlate, this.prompt);
  }

  /**
   * One step.  Out on a landing, left and right walk along it, and walking
   * back in to where the flights meet takes you on to one: up or down picks
   * which, and otherwise you keep going the way you were.  On the flights,
   * left and right go along the one you are on; at the top or the bottom of
   * it you stop where the landing is, and walking on takes you out on to it.
   * Up and down alone climb or go down without stopping.
   */
  private walk(dx: number, dy: number, step: number): void {
    const toFlight = (j: number, way: 1 | -1): void => {
      // (none down from the lobby, none up past the roof door's landing)
      if (j === 0) way = 1;
      if (j === JOINS) way = -1;
      this.spur = null;
      this.s = Phaser.Math.Clamp(j * FLEN + way * 0.5, 0, TOTAL);
      this.going = way;
    };
    if (this.spur !== null) {
      const j = this.spur;
      const out = outward(j);
      const lo = Math.min(joinX(j), spurEnd(j));
      const hi = Math.max(joinX(j), spurEnd(j));
      // UP OR DOWN, anywhere out on a landing: walk in to the stairs and
      // straight on to the flight that way -- nobody has to line up on the
      // exact spot first.  (No flight down from the lobby, none up from the
      // roof door: there, it is a wall.)
      // (pushed out towards the door at the same time, it is the door you want)
      const way: 1 | -1 | 0 = dx === out ? 0 : dy < 0 ? (j < JOINS ? 1 : 0) : dy > 0 ? (j > 0 ? -1 : 0) : 0;
      if (way) {
        this.sx = Phaser.Math.Clamp(this.sx - out * step, lo, hi);
        if (Math.abs(this.sx - joinX(j)) < 0.5) toFlight(j, way);
        return;
      }
      if (dx) this.sx = Phaser.Math.Clamp(this.sx + dx * step, lo, hi);
      // back in at the join, still walking in: on to a flight
      const atJoin = Math.abs(this.sx - joinX(j)) < 0.5;
      if (atJoin && dx === -out) toFlight(j, this.going);
      return;
    }
    // UP OR DOWN held on the flights: on up or down them, through every join
    // -- held with left or right too (a stick held on the diagonal), it is
    // still the climb, not a walk into the half-landing's wall.  Only at a
    // floor's landing does a push out towards its door take you on to it.
    if (dy) {
      const from = this.s;
      const to = Phaser.Math.Clamp(this.s - dy * step, 0, TOTAL);
      // (a floor's join on the way, or right here, with a push out to its door)
      if (dx) {
        for (let jn = 0; jn <= JOINS; jn += 2) {
          const js = jn * FLEN;
          if (dx === outward(jn) && js >= Math.min(from, to) - 0.5 && js <= Math.max(from, to) + 0.5) {
            this.s = js;
            this.spur = jn;
            this.sx = joinX(jn) + outward(jn) * 0.5;
            return;
          }
        }
      }
      this.s = to;
      this.going = dy < 0 ? 1 : -1;
      return;
    }
    if (!dx) {
      // up and down: straight on, through the joins
      this.s = Phaser.Math.Clamp(this.s - dy * step, 0, TOTAL);
      this.going = dy < 0 ? 1 : -1;
      return;
    }
    // at a join: out on to its landing, or on to the flight up or down
    const jn = Math.round(this.s / FLEN);
    if (Math.abs(this.s - jn * FLEN) < 0.5) {
      if (dx === outward(jn)) {
        this.spur = jn;
        this.sx = joinX(jn) + outward(jn) * 0.5;
        return;
      }
      toFlight(jn, dy ? (dy < 0 ? 1 : -1) : this.going);
      return;
    }
    // along the flight you are on, stopping at its top or its foot
    const i = Math.floor(this.s / FLEN);
    const dir = FLIGHTS[i].x1 > FLIGHTS[i].x0 ? 1 : -1;
    const ds = dx * dir;
    this.s = Phaser.Math.Clamp(this.s + ds * step, i * FLEN, (i + 1) * FLEN);
    this.going = ds > 0 ? 1 : -1;
  }

  private interact(): void {
    if (this.locked || !this.spot) return;
    if (this.spot === 'roof') return this.toRoof(true);
    if (this.spot === 'roofdoor') return this.toRoof(false);
    const f = this.landingFloor();
    if (LOCKED.has(f)) {
      audio.sfx('door_rattle', 0.6);
      this.say(`LEVEL ${f}. RESIDENTS' CARDS ONLY. LOCKED FROM THIS SIDE.`);
      return;
    }
    this.locked = true;
    audio.sfx('door_creak', 0.5);
    if (f === G_FLOOR) fadeToScene(this, 'Hotel', { area: 'lobby', from: 'stairwell' });
    else fadeToScene(this, 'Hotel', { area: 'corridor', from: 'stairwell', level: f });
  }

  // ------------------------------------------------------------- the roof

  /** Through the roof door: out on to the roof, or back in to the top landing. */
  private toRoof(out: boolean): void {
    this.locked = true;
    audio.sfx('door_creak', 0.5);
    const cam = this.cameras.main;
    cam.fadeOut(220, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.onRoof = out;
      if (out) {
        const sky = this.roofSky();
        const key = `stairwell_roof_${sky}`;
        if (!this.textures.exists(key)) {
          const t = this.textures.createCanvas(key, GAME_W, GAME_H);
          if (t) {
            paintRoof(t.getContext(), sky);
            t.refresh();
          }
        }
        this.roofImg?.destroy();
        this.roofImg = this.add.image(0, 0, key).setOrigin(0, 0).setDepth(1).setScrollFactor(0);
        cam.setBounds(0, 0, GAME_W, GAME_H);
        cam.scrollY = 0;
        this.sx = ROOF.door + 14;
        this.player.setPosition(this.sx, ROOF.y);
      } else {
        this.roofImg?.destroy();
        this.roofImg = null;
        cam.setBounds(0, 0, GAME_W, WORLD_H);
        this.spur = JOINS;
        this.sx = FL.x0 + 10;
        this.place();
        cam.scrollY = Phaser.Math.Clamp(this.player.y - GAME_H * 0.62, 0, WORLD_H - GAME_H);
      }
      this.wellImg?.setVisible(!out);
      this.rail?.setVisible(!out);
      cam.fadeIn(260);
      this.locked = false;
      if (out) this.say('THE ROOF. THE WHOLE TOWN, AND NOWHERE TO GO.');
    });
  }

  private roofSky(): 'day' | 'evening' | 'night' {
    const c = lifeClock();
    if (store.get().timeOfDay !== 'day' || c.dark) return 'night';
    return c.phase === 'evening' ? 'evening' : 'day';
  }

  /** On the roof: along it, left and right, and the roof door at the left end. */
  private roofFrame(dx: number, delta: number): void {
    const before = this.sx;
    if (dx) this.sx = Phaser.Math.Clamp(this.sx + (dx * PLAYER_SPEED * delta) / 1000, ROOF.x0, ROOF.x1);
    const moved = this.sx - before;
    this.player.setPosition(Math.round(this.sx), ROOF.y);
    if (moved) {
      this.player.stride(Math.sign(moved), delta);
      this.stepT += delta;
      if (this.stepT > 300) {
        this.stepT = 0;
        audio.sfx('footstep_concrete', 0.45);
      }
    } else this.player.stand();
    this.spot = Math.abs(this.sx - ROOF.door) < 14 ? 'roofdoor' : null;
    if (!this.spot) {
      this.prompt.setVisible(false);
      this.promptPlate.setVisible(false);
      return;
    }
    this.prompt.setText('[E] BACK IN').setPosition(Phaser.Math.Clamp(this.player.x, 50, GAME_W - 50), this.player.y - 36).setVisible(true);
    fitPrompt(this.promptPlate, this.prompt);
  }
}

// ---------------------------------------------------------------- painting

type Ctx = CanvasRenderingContext2D;
const rect = (g: Ctx, x: number, y: number, w: number, h: number, c: string, a = 1): void => {
  g.globalAlpha = a;
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  g.globalAlpha = 1;
};

/**
 * The whole well, top to bottom: painted block walls (cream over a green
 * dado on each floor, like the corridor's fire doors), the dark of the
 * shaft through the middle, each floor's slab with its yellow nosing and
 * its fire door and green EXIT box, the half-landings, the flights side-on
 * step by step with the concrete under them, a strip light over every
 * landing, the cage at the foot and the roof door at the top.
 */
function paintWell(g: Ctx): void {
  const W = GAME_W;
  const H = WORLD_H;
  // the blockwork, the height of the well
  rect(g, 0, 0, W, H, '#d2cec2');
  for (let y = 0; y < H; y += 6) {
    rect(g, 0, y, W, 1, '#000000', 0.05);
    for (let x = (y / 6) % 2 ? 0 : 9; x < W; x += 18) rect(g, x, y, 1, 6, '#000000', 0.06);
  }
  // the shaft between the flights: the dark gap down the middle of the well
  const sg = g.createLinearGradient(0, 0, W, 0);
  sg.addColorStop(0, 'rgba(20,22,26,0)');
  sg.addColorStop(0.35, 'rgba(20,22,26,0.18)');
  sg.addColorStop(0.5, 'rgba(20,22,26,0.28)');
  sg.addColorStop(0.65, 'rgba(20,22,26,0.18)');
  sg.addColorStop(1, 'rgba(20,22,26,0)');
  g.fillStyle = sg;
  g.fillRect(0, 0, W, H);
  // the top and the bottom of it in shadow
  const vg = g.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(10,10,14,0.55)');
  vg.addColorStop(0.08, 'rgba(10,10,14,0)');
  vg.addColorStop(0.92, 'rgba(10,10,14,0)');
  vg.addColorStop(1, 'rgba(10,10,14,0.7)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);

  // each floor: the green dado behind its landing, its strip light and glow
  for (let f = G_FLOOR; f <= TOP_FLOOR + 1; f++) {
    const y = f <= TOP_FLOOR ? floorY(f) : floorY(TOP_FLOOR) - FLOOR_H;
    rect(g, WALL_L, y - 22, FL.x1 + 6 - WALL_L, 22, '#7a8a7e');
    rect(g, WALL_L, y - 23, FL.x1 + 6 - WALL_L, 1, '#5a6a5e');
    const hy = y - FLOOR_H / 2;
    if (f <= TOP_FLOOR) {
      rect(g, HL.x0 - 6, hy - 22, HL.x1 - HL.x0 + 12, 22, '#7a8a7e');
      rect(g, HL.x0 - 6, hy - 23, HL.x1 - HL.x0 + 12, 1, '#5a6a5e');
    }
    // the strip lights, over the landing and the half-landing
    for (const [lx, ly] of [
      [FL.x0 + 20, y - 64],
      [HL.x0 - 1, hy - 64],
    ]) {
      if (f > TOP_FLOOR && lx > W / 2) continue;
      rect(g, lx, ly, 40, 2, '#f4f0e0');
      rect(g, lx - 1, ly - 1, 42, 1, '#8a867c');
      const gl = g.createRadialGradient(lx + 20, ly + 2, 2, lx + 20, ly + 2, 70);
      gl.addColorStop(0, 'rgba(255,246,220,0.22)');
      gl.addColorStop(1, 'rgba(255,246,220,0)');
      g.fillStyle = gl;
      g.fillRect(lx - 50, ly - 10, 140, 90);
    }
  }

  // ---- the flights, side-on: the steps, and the slab under them
  for (const p of PATH) {
    if (p.kind !== 'flight') continue;
    const n = Math.round(Math.abs(p.x1 - p.x0) / TREAD);
    const dir = p.x1 >= p.x0 ? 1 : -1;
    // the underside: a straight concrete soffit from one end to the other,
    // the slab a step's height thick
    for (let j = 0; j <= Math.abs(p.x1 - p.x0); j++) {
      const x = p.x0 + dir * j;
      const k = j / Math.abs(p.x1 - p.x0);
      const top = p.y0 + (p.y1 - p.y0) * k;
      rect(g, x, top + 1, 1, 7, '#8a867e');
      rect(g, x, top + 8, 1, 1, '#4a4842');
    }
    // the treads and risers, nosed in yellow
    for (let t = 0; t < n; t++) {
      const xa = p.x0 + dir * t * TREAD;
      const y = Math.round(p.y0 + ((p.y1 - p.y0) * (t + 0.5)) / n);
      const xl = dir > 0 ? xa : xa - TREAD;
      rect(g, xl, y, TREAD, 1, '#a8a49c');
      rect(g, xl, y + 1, TREAD, Math.max(1, Math.round(Math.abs(p.y1 - p.y0) / n)), '#7a766e');
      rect(g, dir > 0 ? xl + TREAD - 1 : xl, y - 1, 1, 1, '#d8b830');
    }
  }
  // ---- the landings and half-landings: the slab, its nosing, its edge
  for (const p of PATH) {
    if (p.kind === 'flight') continue;
    const x0 = p.kind === 'landing' ? WALL_L : p.x0 - 4;
    const x1 = p.kind === 'landing' ? p.x1 + 2 : p.x1 + 4;
    rect(g, x0, p.y0, x1 - x0, 1, '#a8a49c');
    rect(g, x0, p.y0 + 1, x1 - x0, 6, '#8e8a84');
    rect(g, x0, p.y0 + 7, x1 - x0, 2, '#4a4842');
    rect(g, x0, p.y0, x1 - x0, 1, '#d8b830', 0.6);
  }

  // ---- the doors: a fire door with wired glass and its EXIT box on every floor
  for (let f = G_FLOOR; f <= TOP_FLOOR; f++) {
    const y = floorY(f);
    const dx = DOOR_X;
    rect(g, dx - 10, y - 38, 20, 38, '#d8d4c8');
    rect(g, dx - 9, y - 36, 18, 36, '#14100c');
    rect(g, dx - 8, y - 35, 16, 35, LOCKED.has(f) ? '#7a8078' : '#8a9088');
    rect(g, dx - 8, y - 35, 16, 1, '#b0b6ae');
    rect(g, dx + 7, y - 35, 1, 35, '#6a7068');
    rect(g, dx - 3, y - 31, 7, 9, '#3a4440');
    rect(g, dx - 2, y - 30, 5, 7, '#6a8088');
    for (let k = 0; k < 7; k += 2) rect(g, dx - 2, y - 30 + k, 5, 1, '#4a5a60', 0.6);
    rect(g, dx - 7, y - 17, 14, 2, '#c0c4c0');
    rect(g, dx - 7, y - 15, 14, 1, '#6a6e74');
    // the green EXIT box, glowing
    rect(g, dx - 11, y - 50, 22, 10, '#0a2a18');
    rect(g, dx - 10, y - 49, 20, 8, '#16a050');
    rect(g, dx - 10, y - 49, 20, 1, '#5ad890');
    const eg = g.createRadialGradient(dx, y - 45, 1, dx, y - 45, 16);
    eg.addColorStop(0, 'rgba(120,255,160,0.25)');
    eg.addColorStop(1, 'rgba(120,255,160,0)');
    g.fillStyle = eg;
    g.fillRect(dx - 16, y - 61, 32, 32);
    const GL: Record<string, string[]> = {
      E: ['111', '100', '110', '100', '111'],
      X: ['101', '101', '010', '101', '101'],
      I: ['111', '010', '010', '010', '111'],
      T: ['111', '010', '010', '010', '010'],
    };
    let lx = dx - 7;
    for (const ch of 'EXIT') {
      GL[ch].forEach((row, r) => [...row].forEach((b, c) => b === '1' && rect(g, lx + c, y - 48 + r, 1, 1, '#ffffff')));
      lx += 4;
    }
  }

  // ---- the foot: G's slab is the bottom of the well (nothing below it)
  {
    const y = floorY(G_FLOOR);
    rect(g, 0, y + 9, W, H - y - 9, '#1c1e22');
  }
  // ---- the head: the roof door, red, with its alarm bar
  {
    const y = floorY(TOP_FLOOR) - FLOOR_H;
    rect(g, 0, 0, W, Math.max(0, y - 70), '#1c1e22', 0.6);
    const rx = FL.x0 + 4;
    rect(g, rx - 2, y - 38, 20, 38, '#d8d4c8');
    rect(g, rx, y - 36, 16, 36, '#7a2a2a');
    rect(g, rx, y - 36, 16, 1, '#a84a4a');
    rect(g, rx + 2, y - 18, 12, 2, '#e8e8e0');
    // ROOF, on a plate on the door
    rect(g, rx + 3, y - 29, 10, 6, '#e8e4d8');
    rect(g, rx + 3, y - 23, 10, 1, '#8a867c');
  }

  // ---- each floor's number: black, on a small white square beside its door
  const DIGITS: Record<string, string[]> = {
    G: ['111', '100', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '011', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
  };
  for (let f = G_FLOOR; f <= TOP_FLOOR; f++) {
    const sx = SIGN.x;
    const sy = floorY(f) - SIGN.up;
    rect(g, sx - 1, sy - 1, SIGN.w + 2, SIGN.h + 2, '#6a6a66');
    rect(g, sx, sy, SIGN.w, SIGN.h, '#f4f4f0');
    rect(g, sx, sy + SIGN.h - 1, SIGN.w, 1, '#c8c8c0');
    DIGITS[f === G_FLOOR ? 'G' : String(f)].forEach((row, r) => [...row].forEach((b, c) => b === '1' && rect(g, sx + 3 + c, sy + 2 + r, 1, 1, '#101010')));
  }

  // ---- THE SIDES OF THE WELL: solid, the dark of a lift shaft -- concrete
  // in courses, and a steel guide rail down the edge with its brackets
  for (const [x0, x1, rail] of [
    [0, WALL_L, WALL_L - 4],
    [WALL_R, W, WALL_R],
  ]) {
    rect(g, x0, 0, x1 - x0, H, '#0e1014');
    for (let y = 0; y < H; y += 12) rect(g, x0, y, x1 - x0, 1, '#16181e');
    rect(g, rail, 0, 4, H, '#2a2d33');
    rect(g, rail, 0, 1, H, '#3a3d44');
    for (let y = 6; y < H; y += 24) rect(g, rail - 2, y, 8, 2, '#24262c');
  }
  // and the shadow they throw on the block walls beside them
  for (const [x, d] of [
    [WALL_L, 1],
    [WALL_R, -1],
  ]) {
    for (let k = 0; k < 6; k++) rect(g, d > 0 ? x + k : x - 1 - k, 0, 1, H, '#000000', 0.22 - k * 0.035);
  }
}

/**
 * THE ROOF, side-on: the sky (by the time of day), the town's roofs and
 * towers behind, and in front the roof itself -- its gravel, the parapet
 * along the front edge, a water tank on legs, the air-conditioning boxes
 * and a vent stack, and at the left the little stair house with the roof
 * door in it.
 */
function paintRoof(g: Ctx, sky: 'day' | 'evening' | 'night'): void {
  const W = GAME_W;
  const H = GAME_H;
  const night = sky === 'night';
  const top = night ? '#0a1024' : sky === 'evening' ? '#3a2a52' : '#6aa8d8';
  const low = night ? '#1c2440' : sky === 'evening' ? '#e8906a' : '#bcdcf0';
  const sg = g.createLinearGradient(0, 0, 0, ROOF.y - 20);
  sg.addColorStop(0, top);
  sg.addColorStop(1, low);
  g.fillStyle = sg;
  g.fillRect(0, 0, W, ROOF.y);
  // stars by night, a sun or a low one otherwise
  let seed = 7;
  const r = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
  if (night) {
    for (let k = 0; k < 70; k++) rect(g, r() * W, r() * (ROOF.y - 50), 1, 1, '#ffffff', 0.3 + r() * 0.6);
    rect(g, W - 70, 18, 8, 8, '#e8ecf4');
    rect(g, W - 68, 18, 6, 1, '#ffffff');
  } else {
    const sunY = sky === 'evening' ? 70 : 24;
    const gl = g.createRadialGradient(60, sunY, 2, 60, sunY, 40);
    gl.addColorStop(0, 'rgba(255,250,220,0.95)');
    gl.addColorStop(0.2, 'rgba(255,240,200,0.5)');
    gl.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gl;
    g.fillRect(20, sunY - 40, 80, 80);
  }
  // the town behind: two rows of blocks, the far one paler, windows in them
  for (const [base, tone, alpha] of [
    [ROOF.y - 34, night ? '#141a2c' : sky === 'evening' ? '#5a4a6a' : '#8aa0b8', 1],
    [ROOF.y - 20, night ? '#0c1020' : sky === 'evening' ? '#3a2e48' : '#5a7088', 1],
  ] as const) {
    let x = -4;
    while (x < W) {
      const w = 14 + Math.floor(r() * 22);
      const h = 20 + Math.floor(r() * 46);
      rect(g, x, base - h, w, h + 30, tone, alpha);
      for (let wy = base - h + 4; wy < base - 2; wy += 6)
        for (let wx = x + 2; wx < x + w - 2; wx += 4) {
          const lit = night ? r() < 0.35 : r() < 0.08;
          if (lit || r() < 0.5) rect(g, wx, wy, 2, 3, lit ? '#f0d890' : '#000000', lit ? 0.9 : 0.18);
        }
      x += w + 1;
    }
  }
  // the roof: gravel, to the bottom of the picture
  rect(g, 0, ROOF.y - 6, W, H - ROOF.y + 6, night ? '#3a3a40' : '#8a8680');
  for (let k = 0; k < 600; k++) rect(g, r() * W, ROOF.y - 6 + r() * (H - ROOF.y + 6), 1, 1, r() < 0.5 ? '#000000' : '#ffffff', 0.12);
  // the parapet along the front edge, its coping
  rect(g, 0, H - 14, W, 14, night ? '#4a4844' : '#a8a298');
  rect(g, 0, H - 15, W, 2, night ? '#6a6862' : '#c8c2b6');
  for (let x = 0; x < W; x += 16) rect(g, x, H - 14, 1, 14, '#000000', 0.15);
  // the water tank on its legs, and its ladder
  const tx = 210;
  rect(g, tx, ROOF.y - 66, 40, 34, night ? '#4a3c30' : '#8a6a4a');
  for (let y = ROOF.y - 64; y < ROOF.y - 32; y += 6) rect(g, tx, y, 40, 1, '#000000', 0.25);
  rect(g, tx - 2, ROOF.y - 70, 44, 5, night ? '#3a3028' : '#6a5038');
  for (const lx of [tx + 3, tx + 35]) rect(g, lx, ROOF.y - 32, 2, 26, '#2a2a2e');
  rect(g, tx + 3, ROOF.y - 20, 34, 1, '#2a2a2e');
  // the air-conditioning boxes, their fans
  for (const ax of [118, 150]) {
    rect(g, ax, ROOF.y - 22, 26, 16, night ? '#6a6e74' : '#b4b8bc');
    rect(g, ax, ROOF.y - 22, 26, 1, '#e0e4e8', 0.6);
    rect(g, ax + 6, ROOF.y - 19, 14, 10, '#2a2c30');
    rect(g, ax + 12, ROOF.y - 19, 1, 10, '#6a6e74');
    rect(g, ax + 6, ROOF.y - 14, 14, 1, '#6a6e74');
  }
  // a vent stack
  rect(g, 272, ROOF.y - 34, 6, 28, night ? '#4a4c50' : '#8a8c90');
  rect(g, 270, ROOF.y - 36, 10, 3, '#2a2c30');
  // the stair house at the left, with the roof door
  rect(g, 0, ROOF.y - 58, 62, 52, night ? '#5a564e' : '#c4bcae');
  rect(g, 0, ROOF.y - 61, 66, 4, night ? '#3a3832' : '#8a8478');
  rect(g, ROOF.door - 9, ROOF.y - 40, 18, 34, '#d8d4c8');
  rect(g, ROOF.door - 8, ROOF.y - 38, 16, 32, '#7a2a2a');
  rect(g, ROOF.door - 8, ROOF.y - 38, 16, 1, '#a84a4a');
  rect(g, ROOF.door + 4, ROOF.y - 22, 2, 3, '#e8e8e0');
  // a light over it
  rect(g, ROOF.door - 4, ROOF.y - 46, 8, 3, '#f0e8c8');
  const lg = g.createRadialGradient(ROOF.door, ROOF.y - 44, 1, ROOF.door, ROOF.y - 44, 26);
  lg.addColorStop(0, 'rgba(255,240,200,0.35)');
  lg.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = lg;
  g.fillRect(ROOF.door - 30, ROOF.y - 70, 60, 60);
}
