/**
 * ---- THE STAIRS AT LILY'S, side-on.
 *
 * One screen to a floor, in the building's own 2D paint (the corridor's
 * fire door, the hotel palette): the landing in the middle, painted block
 * walls, the green EXIT box over the fire door with the floor's number
 * stencilled big beside it.
 *
 *   FORWARD AND BACK on the landing: up and down walk you towards the door
 *   in the back wall or out to the rail at the front.
 *
 *   LEFT AND RIGHT along the flights: the stairs climb to the right.  The
 *   flight off the right of the landing goes up to the next floor, the one
 *   coming in on the left comes up from the floor below -- walk off either
 *   end and you are on the next landing.  On a flight your feet follow the
 *   steps (and stay on the treads: the flights are narrower than the
 *   landing).  The ground floor has no flight down; the sixth's flight up
 *   ends at the roof door, alarmed.
 *
 *   THE DOOR on each landing goes through to that floor: the lobby on 1,
 *   your corridor on 2, the old one on 6.  3 to 5 are other people's
 *   floors, their doors locked from this side.
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

export const TOP_FLOOR = 6;
/** The landing: from here to here along, and its back (the wall) to front (the rail). */
const LAND_L = 104;
const LAND_R = 216;
const BACK = 130;
const DEPTH = 22;
/** How far a flight climbs across the screen. */
const RISE = 30;
/** A flight's treads, as depths from its line: narrower than the landing. */
const TREAD = { min: 6, max: 16 };
const DOOR_X = 160;

/** The line the feet are on at `x` (before the depth is added): the landing, or a flight's slope. */
export function stairBase(x: number): number {
  if (x < LAND_L) return BACK + ((LAND_L - x) / LAND_L) * RISE;
  if (x > LAND_R) return BACK - ((x - LAND_R) / (GAME_W - LAND_R)) * RISE;
  return BACK;
}

type Spot = 'door' | 'roof' | 'basement' | null;

export class Stairwell extends Phaser.Scene {
  private floor = 1;
  private enterAt: 'left' | 'right' | 'door' = 'door';
  private player!: Player;
  private px = DOOR_X;
  private d = 4;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private prompt!: Phaser.GameObjects.BitmapText;
  private promptPlate!: Phaser.GameObjects.Rectangle;
  private mutter!: Phaser.GameObjects.BitmapText;
  private spot: Spot = null;
  private locked = false;

  constructor() {
    super('Stairwell');
  }

  init(data: { floor?: number; enter?: 'left' | 'right' | 'door' } = {}): void {
    this.floor = Phaser.Math.Clamp(Math.round(data.floor ?? 1), 1, TOP_FLOOR);
    this.enterAt = data.enter ?? 'door';
  }

  create(): void {
    froggyLayer.clear();
    fadeIn(this);
    audio.setScene({ music: 'hotel_lobby', ambience: [] });
    this.locked = false;
    this.spot = null;
    const key = `stairwell_v1_${this.floor}`;
    if (!this.textures.exists(key)) {
      const t = this.textures.createCanvas(key, GAME_W, GAME_H);
      if (t) {
        paintStairwell(t.getContext(), this.floor);
        t.refresh();
      }
    }
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
    // the floor's number, big, stencilled on the block wall by the door
    centerText(this, DOOR_X - 34, BACK - 36, String(this.floor), 0x2a6a4a, 24).setDepth(1).setAlpha(0.85);
    centerText(this, DOOR_X - 34, BACK - 18, this.floor === 1 ? 'LOBBY' : `LEVEL ${this.floor}`, 0x2a4a3a).setDepth(1);

    // in at the door, or off the end of the flight you came along
    if (this.enterAt === 'left') {
      this.px = 6;
      this.d = 11;
    } else if (this.enterAt === 'right') {
      this.px = GAME_W - 6;
      this.d = 11;
    } else {
      this.px = DOOR_X;
      this.d = 3;
    }
    this.player = new Player(this, this.px, stairBase(this.px) + this.d, false);
    this.player.setSurface('concrete');
    if (this.enterAt === 'right') this.player.face(-1);
    const resume = resumeSpot(this.sys.settings.data);
    trackPlace(this, () => this.player, { floor: this.floor }, resume);
    if (resume) {
      this.px = Phaser.Math.Clamp(this.player.x, 4, GAME_W - 4);
      this.d = Phaser.Math.Clamp(this.player.y - stairBase(this.px), 0, DEPTH);
    }

    // the rail along the front of the landing and down each flight, over the feet
    const rail = this.add.graphics().setDepth(700);
    const railAt = (x: number) => stairBase(x) + DEPTH + 2;
    for (let x = 0; x < GAME_W; x += 1) {
      if (this.floor === 1 && x < LAND_L - 4) continue;
      const y = Math.round(railAt(x) - 9);
      rail.fillStyle(0x6a6e74, 1).fillRect(x, y, 1, 1);
      rail.fillStyle(0xd4d8dc, 1).fillRect(x, y - 1, 1, 1);
    }
    for (let x = this.floor === 1 ? LAND_L : 8; x < GAME_W; x += 22) {
      const y = Math.round(railAt(x));
      rail.fillStyle(0x6a6e74, 1).fillRect(x, y - 9, 1, 9);
    }

    new TokenHud(this);
    attachPockets(this, () => this.locked);
    this.promptPlate = this.add.rectangle(0, 0, 4, 12, PALETTE.black, 0.72).setDepth(800).setVisible(false);
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setDepth(801).setOrigin(0.5, 0.5).setVisible(false);
    this.mutter = centerText(this, GAME_W / 2, SUBTITLE_Y, '', PALETTE.cream).setDepth(860).setVisible(false).setMaxWidth(290);
    backPlate(this, this.mutter);

    const kb = this.input.keyboard;
    const bind = (n: readonly string[]) => (kb ? n.map((k) => kb.addKey(k)) : []);
    this.keys = { up: bind(KEYS.up), down: bind(KEYS.down), left: bind(KEYS.left), right: bind(KEYS.right) };
    kb?.on('keydown-E', () => this.interact());
    // a tap on the door goes through it (once you are at it)
    this.add
      .zone(DOOR_X - 12, BACK - 40, 24, 42)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.spot === 'door') this.interact();
        else this.say('WALK UP TO THE DOOR.');
      });
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
    if (this.locked) {
      this.prompt.setVisible(false);
      this.promptPlate.setVisible(false);
      return;
    }
    const dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const dy = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      const step = (PLAYER_SPEED * delta) / 1000;
      let nx = this.px + (dx / len) * step;
      let nd = this.d + (dy / len) * step;
      // the ends: no flight down from the ground floor, none up past the roof door
      const minX = this.floor === 1 ? LAND_L - 2 : 0;
      const maxX = this.floor === TOP_FLOOR ? GAME_W - 26 : GAME_W;
      nx = Phaser.Math.Clamp(nx, minX, maxX);
      // on a flight the feet keep to the treads; the landing is the full depth
      const onFlight = nx < LAND_L || nx > LAND_R;
      if (onFlight) {
        // stepping off the landing onto a flight from outside the treads: led
        // in on to them, a pixel a frame, rather than walking into the rail
        nd = Phaser.Math.Clamp(nd, Math.max(0, Math.min(this.d, TREAD.min)), Math.min(DEPTH, Math.max(this.d, TREAD.max)));
        nd += Phaser.Math.Clamp(Phaser.Math.Clamp(nd, TREAD.min, TREAD.max) - nd, -1, 1);
      } else nd = Phaser.Math.Clamp(nd, 0, DEPTH);
      this.px = nx;
      this.d = nd;
      // the stride, and the feet on the step
      this.player.stride(dx, delta);
      this.player.setPosition(Math.round(this.px), Math.round(stairBase(this.px) + this.d));
      this.stepT += delta;
      if (this.stepT > 300) {
        this.stepT = 0;
        audio.sfx('footstep_concrete', 0.5);
      }
      // off the end of a flight: the next floor's landing
      if (this.px >= GAME_W - 1 && dx > 0 && this.floor < TOP_FLOOR) return this.go(this.floor + 1, 'left');
      if (this.px <= 1 && dx < 0 && this.floor > 1) return this.go(this.floor - 1, 'right');
    } else this.player.stand();

    this.spot = Math.abs(this.px - DOOR_X) < 12 && this.d < 8 ? 'door' : this.floor === TOP_FLOOR && this.px > GAME_W - 30 ? 'roof' : this.floor === 1 && this.px < LAND_L + 4 ? 'basement' : null;
    if (!this.spot) {
      this.prompt.setVisible(false);
      this.promptPlate.setVisible(false);
      return;
    }
    const label =
      this.spot === 'roof'
        ? '[E] ROOF DOOR'
        : this.spot === 'basement'
          ? '[E] BASEMENT'
          : this.floor === 1
            ? '[E] TO THE LOBBY'
            : `[E] TO LEVEL ${this.floor}`;
    this.prompt.setText(label).setPosition(Phaser.Math.Clamp(this.player.x, 50, GAME_W - 50), Math.max(28, this.player.y - 36)).setVisible(true);
    fitPrompt(this.promptPlate, this.prompt);
  }

  private stepT = 0;

  private go(floor: number, enter: 'left' | 'right'): void {
    this.locked = true;
    fadeToScene(this, 'Stairwell', { floor, enter }, { ms: 220 });
  }

  private interact(): void {
    if (this.locked || !this.spot) return;
    if (this.spot === 'roof') {
      audio.sfx('door_rattle', 0.6);
      this.say('ROOF ACCESS. ALARMED. NOT AGAIN.');
      return;
    }
    if (this.spot === 'basement') {
      audio.sfx('door_rattle', 0.6);
      this.say('A CAGE DOOR OVER THE STEPS DOWN. PADLOCKED.');
      return;
    }
    if (this.floor >= 3 && this.floor <= 5) {
      audio.sfx('door_rattle', 0.6);
      this.say(`LEVEL ${this.floor}. RESIDENTS' CARDS ONLY. LOCKED FROM THIS SIDE.`);
      return;
    }
    this.locked = true;
    audio.sfx('door_creak', 0.5);
    if (this.floor === 1) fadeToScene(this, 'Hotel', { area: 'lobby', from: 'stairwell' });
    else fadeToScene(this, 'Hotel', { area: 'corridor', from: 'stairwell', level: this.floor });
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
 * One floor of the stairwell: painted block walls (cream over a green dado,
 * like the corridor's fire door), the shaft dark below the flights, the
 * landing's concrete slab with its yellow nosing, the steps of both flights
 * side-on, the fire door with its wired glass and the green EXIT box.
 */
export function paintStairwell(g: Ctx, floor: number): void {
  const W = GAME_W;
  // the shaft behind and below everything: a dark well
  rect(g, 0, 0, W, GAME_H, '#1c1e22');
  // the wall: painted blockwork, cream above, green below the line
  const wallFoot = (x: number) => stairBase(x);
  for (let x = 0; x < W; x++) {
    const foot = Math.round(wallFoot(x));
    rect(g, x, 30, 1, foot - 30, '#d8d4c8');
    rect(g, x, foot - 22, 1, 22, '#7a8a7e');
    rect(g, x, foot - 23, 1, 1, '#5a6a5e');
  }
  // the block courses
  for (let y = 34; y < 160; y += 6) {
    for (let x = (y / 6) % 2 ? 0 : 9; x < W; x += 18) {
      if (y < Math.round(wallFoot(x))) rect(g, x, y, 1, 5, '#000000', 0.06);
    }
    for (let x = 0; x < W; x++) if (y < Math.round(wallFoot(x)) - 1) rect(g, x, y, 1, 1, '#000000', 0.05);
  }
  // the ceiling slab of the flight above, cut away, and its strip light
  rect(g, 0, 24, W, 6, '#9a968c');
  rect(g, 0, 29, W, 1, '#6a665e');
  rect(g, 120, 30, 80, 2, '#f4f0e0');
  const glowG = g.createRadialGradient(160, 32, 2, 160, 32, 90);
  glowG.addColorStop(0, 'rgba(255,246,220,0.25)');
  glowG.addColorStop(1, 'rgba(255,246,220,0)');
  g.fillStyle = glowG;
  g.fillRect(60, 30, 200, 100);

  // ---- the floor: the landing's slab and the treads of both flights
  const slab = (x: number) => Math.round(stairBase(x));
  for (let x = 0; x < W; x++) {
    if (floor === 1 && x < LAND_L - 4) continue;
    const top = slab(x);
    // the walking surface, back to front
    rect(g, x, top, 1, DEPTH + 2, '#8e8a84');
    rect(g, x, top, 1, 1, '#6e6a64');
    // the slab's front edge and its underside
    rect(g, x, top + DEPTH + 2, 1, 3, '#6a665e');
    rect(g, x, top + DEPTH + 5, 1, 6, '#2a2a2e');
  }
  // the treads: a riser every six pixels along each flight, nosed in yellow
  const flight = (x0: number, x1: number) => {
    for (let x = x0; x < x1; x += 6) {
      const top = slab(x);
      rect(g, x, top, 1, DEPTH + 2, '#6e6a64', 0.9);
      rect(g, x + 1, top, 5, 1, '#a8a49c');
      rect(g, x, top + DEPTH + 1, 6, 1, '#d8b830', 0.8);
    }
  };
  if (floor > 1) flight(0, LAND_L);
  flight(LAND_R, floor === TOP_FLOOR ? W - 24 : W);
  // the landing's yellow safety line at its front edge
  rect(g, LAND_L, BACK + DEPTH + 1, LAND_R - LAND_L, 1, '#d8b830');

  // ---- the fire door to the floor, in the back wall of the landing
  const dx = DOOR_X;
  rect(g, dx - 10, BACK - 38, 20, 38, '#d8d4c8');
  rect(g, dx - 9, BACK - 36, 18, 36, '#14100c');
  rect(g, dx - 8, BACK - 35, 16, 35, '#8a9088');
  rect(g, dx - 8, BACK - 35, 16, 1, '#b0b6ae');
  rect(g, dx + 7, BACK - 35, 1, 35, '#6a7068');
  // the wired glass
  rect(g, dx - 3, BACK - 31, 7, 9, '#3a4440');
  rect(g, dx - 2, BACK - 30, 5, 7, '#6a8088');
  for (let k = 0; k < 7; k += 2) rect(g, dx - 2, BACK - 30 + k, 5, 1, '#4a5a60', 0.6);
  // the push bar
  rect(g, dx - 7, BACK - 17, 14, 2, '#c0c4c0');
  rect(g, dx - 7, BACK - 15, 14, 1, '#6a6e74');
  // the EXIT box over it
  rect(g, dx - 11, BACK - 50, 22, 10, '#0a2a18');
  rect(g, dx - 10, BACK - 49, 20, 8, '#16a050');
  rect(g, dx - 10, BACK - 49, 20, 1, '#5ad890');
  const eg = g.createRadialGradient(dx, BACK - 45, 1, dx, BACK - 45, 16);
  eg.addColorStop(0, 'rgba(120,255,160,0.25)');
  eg.addColorStop(1, 'rgba(120,255,160,0)');
  g.fillStyle = eg;
  g.fillRect(dx - 16, BACK - 61, 32, 32);
  // EXIT in white, the house sign letters
  const GL: Record<string, string[]> = {
    E: ['111', '100', '110', '100', '111'],
    X: ['101', '101', '010', '101', '101'],
    I: ['111', '010', '010', '010', '111'],
    T: ['111', '010', '010', '010', '010'],
  };
  let lx = dx - 7;
  for (const ch of 'EXIT') {
    GL[ch].forEach((row, r) => [...row].forEach((b, c) => b === '1' && rect(g, lx + c, BACK - 48 + r, 1, 1, '#ffffff')));
    lx += 4;
  }

  // ---- the ends
  if (floor === 1) {
    // the cage over the steps to the basement, padlocked
    rect(g, LAND_L - 24, BACK - 34, 20, 34, '#2a2a2e');
    for (let x = LAND_L - 24; x < LAND_L - 4; x += 3) rect(g, x, BACK - 34, 1, 34 + DEPTH, '#8a8e94');
    for (let y = BACK - 34; y < BACK + DEPTH; y += 6) rect(g, LAND_L - 24, y, 20, 1, '#8a8e94');
    rect(g, LAND_L - 8, BACK - 8, 3, 4, '#c8a838');
  }
  if (floor === TOP_FLOOR) {
    // the roof door at the head of the last flight, with its alarm bar
    const rx = W - 20;
    const top = slab(W - 24);
    rect(g, rx - 2, top - 38, 20, 38, '#d8d4c8');
    rect(g, rx, top - 36, 16, 36, '#7a2a2a');
    rect(g, rx, top - 36, 16, 1, '#a84a4a');
    rect(g, rx + 2, top - 18, 12, 2, '#e8e8e0');
    rect(g, rx + 3, top - 28, 10, 5, '#f0d020');
    rect(g, rx + 4, top - 27, 8, 3, '#141414');
  }
}
