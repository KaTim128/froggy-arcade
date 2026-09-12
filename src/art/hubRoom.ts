/**
 * The arcade hub room.  ONE painter, two moods (PRD AR-6).
 *
 * Act I draws it warm.  ArcadeDark (PRD §7.13) draws the SAME geometry through
 * the palette transform with the lights off, so the player walks a room they
 * already know.  That recognition is the point.
 */

import Phaser from 'phaser';
import { PALETTE, nightify } from '../render/palette';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { centerText } from '../core/ui';

export const ROOM = {
  left: 14,
  right: GAME_W - 14,
  top: 52,
  bottom: GAME_H - 8,
};

export interface RoomOpts {
  night: boolean;
  /**
   * Which room this is dressed as.  'arcade' is the hub and the back room —
   * teal carpet, 90s confetti, a neon strip.  'casino' is the room at the very
   * back: burgundy and gold, diamonds instead of confetti, and a darker wall
   * for the lights to sit against.  Same geometry, a different building
   * standard, which is the whole reason the last room feels like somewhere
   * else rather than the same floor with different machines on it.
   */
  theme?: 'arcade' | 'casino';
  /**
   * Whether to paint the way out at the bottom of the room.
   *
   * There is exactly ONE front door in this building and it is in the hub.
   * The back room and the casino borrow this painter for their walls and
   * carpet, and used to get a copy of the front door along with them — two
   * more doors, in rooms that are two and three deep inside, that did nothing
   * and told the player the wrong thing about where the exit was.
   */
  frontDoor?: boolean;
}

export function paintHubRoom(scene: Phaser.Scene, opts: RoomOpts): void {
  const c = (col: number) => (opts.night ? nightify(col) : col);

  const casino = opts.theme === 'casino';

  // ---- carpet.  Teal and 90s confetti out front; burgundy with a gold
  // diamond lattice in the room at the back, which is the oldest trick a
  // gambling floor has and the reason they all look like that.
  scene.add.rectangle(0, 0, GAME_W, GAME_H, c(casino ? 0x4a1424 : PALETTE.tealDark)).setOrigin(0, 0);
  const carpet = scene.add.graphics();
  // Deterministic scatter — same carpet every time, in every mood.
  let seed = 1337;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  if (casino) {
    // a lattice of small diamonds, and a darker one behind each
    const gold = c(PALETTE.amberDark);
    for (let y = 48; y < GAME_H; y += 14) {
      for (let x = ((y / 14) % 2) * 9; x < GAME_W; x += 18) {
        carpet.fillStyle(0x000000, 0.18);
        carpet.fillTriangle(x + 1, y + 1, x + 5, y - 3, x + 9, y + 1);
        carpet.fillTriangle(x + 1, y + 1, x + 5, y + 5, x + 9, y + 1);
        carpet.fillStyle(gold, opts.night ? 0.12 : 0.3);
        carpet.fillTriangle(x, y, x + 4, y - 4, x + 8, y);
        carpet.fillTriangle(x, y, x + 4, y + 4, x + 8, y);
      }
    }
  } else {
    const shapes = [c(PALETTE.neon), c(PALETTE.gold), c(PALETTE.tealLight), c(PALETTE.violet)];
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(rnd() * GAME_W);
      const y = 44 + Math.floor(rnd() * (GAME_H - 44));
      const col = shapes[Math.floor(rnd() * shapes.length)];
      carpet.fillStyle(col, opts.night ? 0.22 : 0.5);
      const kind = Math.floor(rnd() * 3);
      if (kind === 0) carpet.fillRect(x, y, 5, 2);
      else if (kind === 1) carpet.fillRect(x, y, 2, 5);
      else carpet.fillTriangle(x, y, x + 5, y, x + 2, y + 5);
    }
  }

  // ---- back wall.  Panelled and gold-trimmed in the casino.
  scene.add.rectangle(0, 0, GAME_W, 46, c(casino ? 0x2a1020 : PALETTE.plum)).setOrigin(0, 0);
  if (casino) {
    for (let x = 18; x < GAME_W - 14; x += 26) {
      scene.add.rectangle(x, 12, 22, 30, 0x3a1830).setOrigin(0, 0).setStrokeStyle(1, 0x5c2440);
    }
    scene.add.rectangle(0, 42, GAME_W, 2, c(PALETTE.amberDark)).setOrigin(0, 0);
  }
  scene.add.rectangle(0, 44, GAME_W, 4, c(PALETTE.ink)).setOrigin(0, 0);

  // ---- side walls
  scene.add.rectangle(0, 0, 14, GAME_H, c(PALETTE.ink)).setOrigin(0, 0);
  scene.add.rectangle(GAME_W - 14, 0, 14, GAME_H, c(PALETTE.ink)).setOrigin(0, 0);

  // ---- neon strip along the back wall.  Gold in the casino, and a row of
  // bulbs under it rather than a single line of tube.
  const stripColour = casino ? PALETTE.gold : PALETTE.neon;
  const strip = scene.add
    .rectangle(14, 8, GAME_W - 28, 2, opts.night ? nightify(stripColour) : stripColour)
    .setOrigin(0, 0);
  strip.setAlpha(opts.night ? 0.35 : 1);
  if (casino && !opts.night) {
    for (let x = 20; x < GAME_W - 18; x += 12) {
      scene.add.circle(x, 5, 1.5, PALETTE.cream).setAlpha(0.9);
    }
  }

  // ---- front door (bottom centre).  The hub only: see RoomOpts.frontDoor.
  if (opts.frontDoor !== false) {
    scene.add.rectangle(GAME_W / 2, GAME_H - 6, 40, 8, c(PALETTE.brown)).setOrigin(0.5, 0);
    scene.add
      .rectangle(GAME_W / 2, GAME_H - 4, 30, 4, opts.night ? PALETTE.nightMid : PALETTE.cream)
      .setOrigin(0.5, 0);
  }

  if (opts.night) {
    // Moonlight through the front windows — the only light in the room.
    const moon = scene.add.graphics();
    moon.fillStyle(PALETTE.moon, 0.07);
    moon.fillTriangle(GAME_W / 2 - 46, GAME_H, GAME_W / 2 + 46, GAME_H, GAME_W / 2, 60);
  }
}

/** The change machine, decorative in Act I and dead at night. */
export function paintChangeMachine(scene: Phaser.Scene, night: boolean): void {
  const c = (col: number) => (night ? nightify(col) : col);
  scene.add.rectangle(262, 10, 20, 32, c(PALETTE.steel)).setOrigin(0, 0);
  scene.add.rectangle(265, 15, 14, 10, night ? PALETTE.black : PALETTE.gold).setOrigin(0, 0);
  scene.add.rectangle(266, 32, 12, 3, c(PALETTE.ink)).setOrigin(0, 0);
}

/**
 * The casino's own furniture: the things that make the last room read as a
 * room somebody decorated rather than the arcade floor in a different colour.
 *
 * A chandelier over the middle of it, brass lamps along the back wall with
 * real pools of light under them, and the four suits painted up on the
 * panelling.  Nothing stands in the doorway or on the walking line: the room
 * is small and everything in it has to be furniture you can get past.
 */
export function paintCasinoDressing(scene: Phaser.Scene): void {
  // ---- pools of light on the carpet, painted before anything stands in them
  const glow = scene.add.graphics().setDepth(0.001);
  for (const [x, r] of [
    [58, 34],
    [160, 52],
    [252, 34],
  ] as const) {
    glow.fillStyle(PALETTE.amber, 0.05);
    glow.fillEllipse(x, 104, r * 2, r);
    glow.fillStyle(PALETTE.amber, 0.04);
    glow.fillEllipse(x, 104, r * 1.3, r * 0.6);
  }

  // ---- the chandelier, over the table in the middle
  scene.add.rectangle(160, 0, 2, 14, PALETTE.amberDark).setOrigin(0.5, 0).setDepth(0.02);
  scene.add.ellipse(160, 16, 30, 8, PALETTE.amberDark).setDepth(0.02);
  scene.add.ellipse(160, 15, 24, 5, PALETTE.gold).setDepth(0.02);
  for (const [dx, dy] of [
    [-11, 19],
    [-4, 22],
    [4, 22],
    [11, 19],
  ] as const) {
    scene.add.circle(160 + dx, dy, 2, PALETTE.cream).setDepth(0.02);
    scene.add.circle(160 + dx, dy, 3.5, PALETTE.gold).setAlpha(0.25).setDepth(0.019);
  }

  // ---- brass lamps on the back wall
  for (const x of [92, 228]) {
    scene.add.rectangle(x, 16, 6, 3, PALETTE.amberDark).setOrigin(0.5, 0).setDepth(0.02);
    scene.add.triangle(x, 19, 0, 0, 10, 0, 5, 9, PALETTE.gold).setOrigin(0.5, 0).setDepth(0.02);
    scene.add.circle(x, 27, 2, PALETTE.cream).setDepth(0.02);
    const halo = scene.add.graphics().setDepth(0.018);
    halo.fillStyle(PALETTE.amber, 0.07);
    halo.fillTriangle(x - 3, 26, x + 3, 26, x, 46);
  }

  // ---- the four suits, up on the panelling
  const suits: Array<[string, number, number]> = [
    ['♠', 44, PALETTE.bone],
    ['♥', 122, PALETTE.blood],
    ['♦', 198, PALETTE.blood],
    ['♣', 276, PALETTE.bone],
  ];
  for (const [glyph, x, colour] of suits) {
    centerText(scene, x, 28, glyph, colour).setAlpha(0.55).setDepth(0.02);
  }

}
