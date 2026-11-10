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
import { depthFor } from './player';
import { bevel, grain, tone } from './surface';

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

  // ---- the pile of the carpet: a fine weave of lighter and darker tufts,
  // and the floor darkening into the corners where the light does not reach
  const base = c(casino ? 0x4a1424 : PALETTE.tealDark);
  const weave = scene.add.graphics().setDepth(0.0003);
  grain(weave, 14, 46, GAME_W - 28, GAME_H - 46, base, casino ? 91 : 17, 0.07, 0.16);
  for (let i = 0; i < 6; i++) {
    weave.fillStyle(0x000000, (opts.night ? 0.07 : 0.05) * (6 - i) / 6);
    weave.fillRect(14, 48 + i * 2, GAME_W - 28, 2);
    weave.fillRect(14 + i * 2, 48, 2, GAME_H - 48);
    weave.fillRect(GAME_W - 16 - i * 2, 48, 2, GAME_H - 48);
  }

  // ---- floor detail.  A bare carpet the size of this one reads as a
  // corridor; what makes it read as a room is the things a floor has on it.
  // None of this is interactive and none of it stands where the player walks:
  // it is paint, seams and scuffs, under everything else in the room.
  const floor = scene.add.graphics().setDepth(0.0005);
  if (!casino) {
    // seams, as though the carpet came in strips
    floor.fillStyle(0x000000, opts.night ? 0.25 : 0.12);
    for (let y = 60; y < GAME_H; y += 26) floor.fillRect(14, y, GAME_W - 28, 1);
    // a painted ring in the middle of the floor, the way a real arcade puts
    // its name where everybody stands
    floor.lineStyle(2, c(PALETTE.tealLight), opts.night ? 0.06 : 0.14);
    floor.strokeEllipse(GAME_W / 2, 128, 150, 62);
    floor.lineStyle(1, c(PALETTE.gold), opts.night ? 0.05 : 0.12);
    floor.strokeEllipse(GAME_W / 2, 128, 132, 50);
    // scuffs, where the traffic is
    floor.fillStyle(0x000000, opts.night ? 0.2 : 0.08);
    for (let i = 0; i < 26; i++) {
      const x = 20 + Math.floor(rnd() * (GAME_W - 40));
      const y = 60 + Math.floor(rnd() * (GAME_H - 70));
      floor.fillRect(x, y, 2 + Math.floor(rnd() * 5), 1);
    }
  }

  // ---- back wall.  Panelled and gold-trimmed in the casino.
  scene.add.rectangle(0, 0, GAME_W, 46, c(casino ? 0x2a1020 : PALETTE.plum)).setOrigin(0, 0);
  if (!casino) {
    // Panelling, a skirting board, and the wall vents and cable runs that make
    // the back of a room look like the back of a building.
    const wall = scene.add.graphics().setDepth(0.001);
    grain(wall, 14, 0, GAME_W - 28, 44, c(PALETTE.plum), 23, 0.05, 0.12);
    for (let x = 16; x < GAME_W - 14; x += 30) {
      // a recessed panel: shaded along its top and left (the lip above it
      // throws a shadow in), lit along its bottom and right
      const p = c(0x3a2050);
      wall.fillStyle(p, 0.6).fillRect(x, 10, 26, 30);
      wall.fillStyle(tone(p, 0.55), 0.8).fillRect(x, 10, 26, 1).fillRect(x, 10, 1, 30);
      wall.fillStyle(c(0x5c3a78), 0.7).fillRect(x, 39, 26, 1).fillRect(x + 25, 10, 1, 30);
    }
    // a skirting board along the foot of the wall, lit on its top edge
    wall.fillStyle(c(0x241634), 1).fillRect(14, 40, GAME_W - 28, 4);
    wall.fillStyle(c(0x4a2e64), 1).fillRect(14, 40, GAME_W - 28, 1);
    // a cable run along the top of the wall, with a sag between each hook
    const cable = scene.add.graphics().setDepth(0.02);
    cable.lineStyle(1, c(0x1b1128), 0.9);
    for (let x = 18; x < GAME_W - 18; x += 34) {
      cable.beginPath();
      cable.moveTo(x, 12);
      cable.lineTo(x + 17, 17);
      cable.lineTo(x + 34, 12);
      cable.strokePath();
    }
    // The vents are hung by the room (see `paintArcadeDressing`), because where
    // they can go depends on what that room has bolted to its back wall.
  }
  if (casino) {
    for (let x = 18; x < GAME_W - 14; x += 26) {
      scene.add.rectangle(x, 12, 22, 30, 0x3a1830).setOrigin(0, 0).setStrokeStyle(1, 0x5c2440);
      const pg = scene.add.graphics().setDepth(0.001);
      grain(pg, x + 1, 13, 20, 28, 0x3a1830, x, 0.08, 0.14);
      pg.fillStyle(0x1e0a18, 1).fillRect(x + 1, 13, 20, 1);
      pg.fillStyle(PALETTE.amberDark, 0.35).fillRect(x + 1, 40, 20, 1);
    }
    scene.add.rectangle(0, 42, GAME_W, 2, c(PALETTE.amberDark)).setOrigin(0, 0);
  }
  scene.add.rectangle(0, 44, GAME_W, 4, c(PALETTE.ink)).setOrigin(0, 0);

  // ---- side walls
  // (user, 8 Nov: solid, never see-through -- above the back wall's
  // panelling, which used to show through the top of them)
  scene.add.rectangle(0, 0, 14, GAME_H, c(PALETTE.ink)).setOrigin(0, 0).setDepth(0.002);
  scene.add.rectangle(GAME_W - 14, 0, 14, GAME_H, c(PALETTE.ink)).setOrigin(0, 0).setDepth(0.002);

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

/**
 * The things that make an arcade an arcade: signs over the machines, posters
 * on the wall, a strip light and its cable, a bin, a plant nobody waters.
 *
 * All of it is furniture rather than fixtures — nothing here is interactive,
 * nothing stands in the walking line, and every piece sorts by its own base
 * so the player passes in front of it.  `avoid` is the span across the middle
 * that the room's own furniture owns (the prize counter in the hub), so the
 * dressing does not get hung on top of it.
 */
export function paintArcadeDressing(
  scene: Phaser.Scene,
  opts: {
    night: boolean;
    /** Stretches of the back wall the room's own fixtures own. */
    avoid?: Array<{ from: number; to: number }>;
    /**
     * Where the floor props stand, given by the room.
     *
     * They are NOT placed here any more.  A bin hard against the left wall
     * looked fine until the cabinets were re-spaced and one of them moved
     * under it — a grey box sitting over the front of Tic-Tac-Toe's screen,
     * drawn on the player's own depth scale so it covered the machine.  Only
     * the room knows where its machines are, so only the room may say where
     * there is floor to put something on.
     */
    props?: Array<{ x: number; y: number; kind: 'bin' | 'plant' }>;
    /** Left edges of the wall vents.  Defaults to one in each top corner. */
    vents?: number[],
  },
): void {
  const c = (col: number) => (opts.night ? nightify(col) : col);
  const lit = !opts.night;
  const avoid = opts.avoid ?? [];
  const clear = (from: number, to: number): boolean => avoid.every((a) => to < a.from || from > a.to);

  // ---- hanging signs over the machines, on their own little chains.
  //
  // There is no sign on the left-hand side any more: the token HUD owns that
  // corner of every room, and a lit box hanging a few pixels under it read as
  // part of the HUD rather than as part of the room.
  const signs: Array<[number, string, number]> = [[262, 'WIN', PALETTE.gold]];
  for (const [x, word, colour] of signs) {
    if (!clear(x - 20, x + 20)) continue;
    // Hung below the token HUD, which owns the top-left corner of every room.
    scene.add.rectangle(x - 12, 0, 1, 24, c(PALETTE.steel)).setOrigin(0, 0).setDepth(0.02);
    scene.add.rectangle(x + 12, 0, 1, 24, c(PALETTE.steel)).setOrigin(0, 0).setDepth(0.02);
    scene.add
      .rectangle(x, 30, 34, 11, c(PALETTE.ink))
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(1, lit ? colour : nightify(colour))
      .setDepth(0.02);
    centerText(scene, x, 30, word, lit ? colour : nightify(colour)).setDepth(0.021).setAlpha(lit ? 1 : 0.4);
  }

  // ---- vents, where the room says the wall is bare.  The right-hand one used
  // to be at a fixed x that the hub's change machine also stands at, so it
  // looked welded to the side of it.
  for (const vx of opts.vents ?? [24, GAME_W - 46]) {
    scene.add.rectangle(vx, 20, 22, 12, c(0x241638)).setOrigin(0, 0).setStrokeStyle(1, c(0x140c22));
    scene.add.rectangle(vx, 32, 22, 1, c(0x4a3466)).setOrigin(0, 0);
    scene.add.rectangle(vx + 1, 33, 20, 3, 0x000000).setOrigin(0, 0).setAlpha(0.15);
    for (let i = 0; i < 4; i++) {
      scene.add.rectangle(vx + 2, 22 + i * 3, 18, 1, c(0x150d24)).setOrigin(0, 0);
    }
  }

  // ---- posters, taped flat to the wall between the panels
  const posters: Array<[number, number, number]> = [
    [104, 14, PALETTE.ember],
    [196, 14, PALETTE.tealLight],
  ];
  for (const [x, y, colour] of posters) {
    if (!clear(x - 9, x + 9)) continue;
    scene.add.rectangle(x + 1, y + 1, 18, 24, 0x000000).setOrigin(0.5, 0).setDepth(0.019).setAlpha(0.3);
    scene.add.rectangle(x, y, 18, 24, c(PALETTE.bone)).setOrigin(0.5, 0).setDepth(0.02).setAlpha(lit ? 0.9 : 0.5);
    // tape at the top corners, and the bottom corner lifting away from the wall
    scene.add.rectangle(x - 8, y, 4, 2, c(0xe8e0c0)).setOrigin(0.5, 0.5).setDepth(0.022).setAlpha(0.7);
    scene.add.rectangle(x + 8, y, 4, 2, c(0xe8e0c0)).setOrigin(0.5, 0.5).setDepth(0.022).setAlpha(0.7);
    scene.add.triangle(x + 9, y + 24, 0, 0, -4, 0, 0, -4, c(tone(PALETTE.bone, 0.7))).setOrigin(0, 0).setDepth(0.022);
    scene.add.rectangle(x, y + 3, 12, 9, lit ? colour : nightify(colour)).setOrigin(0.5, 0).setDepth(0.021);
    for (let i = 0; i < 3; i++) {
      scene.add.rectangle(x - 5, y + 15 + i * 3, 10, 1, c(PALETTE.steel)).setOrigin(0, 0).setDepth(0.021);
    }
  }

  // ---- the floor props, where the room said there is room for them
  for (const prop of opts.props ?? []) {
    const d = depthFor(prop.y);
    if (prop.kind === 'bin') {
      scene.add.ellipse(prop.x + 5, prop.y, 14, 3, 0x000000, 0.3).setDepth(d);
      scene.add.rectangle(prop.x - 1, prop.y + 1, 12, 14, c(0x0c0a10)).setOrigin(0, 1).setDepth(d);
      scene.add.rectangle(prop.x, prop.y, 10, 12, c(PALETTE.steel)).setOrigin(0, 1).setDepth(d);
      // ribs pressed into the metal, lit on one side
      for (let k = 2; k < 10; k += 3) {
        scene.add.rectangle(prop.x + k, prop.y - 1, 1, 9, c(tone(PALETTE.steel, 1.3))).setOrigin(0, 1).setDepth(d);
        scene.add.rectangle(prop.x + k + 1, prop.y - 1, 1, 9, c(tone(PALETTE.steel, 0.75))).setOrigin(0, 1).setDepth(d);
      }
      scene.add.rectangle(prop.x, prop.y - 11, 10, 2, c(PALETTE.slate)).setOrigin(0, 1).setDepth(d);
      scene.add.rectangle(prop.x + 2, prop.y - 8, 6, 1, c(PALETTE.ink)).setOrigin(0, 1).setDepth(d);
    } else {
      // A pot with a rim, soil in it, and a plant with leaves that overlap —
      // three ellipses in one green read as a bush somebody dropped.
      const cx = prop.x + 6;
      scene.add.ellipse(cx, prop.y, 16, 3, 0x000000, 0.3).setDepth(d);
      scene.add.rectangle(prop.x, prop.y + 1, 12, 9, c(0x1a0e08)).setOrigin(0, 1).setDepth(d);
      scene.add.rectangle(prop.x + 1, prop.y, 10, 7, c(PALETTE.rust)).setOrigin(0, 1).setDepth(d);
      scene.add.rectangle(prop.x + 9, prop.y, 2, 7, c(tone(PALETTE.rust, 0.7))).setOrigin(0, 1).setDepth(d);
      scene.add.rectangle(prop.x, prop.y - 6, 12, 3, c(PALETTE.ember)).setOrigin(0, 1).setDepth(d);
      scene.add.rectangle(prop.x + 1, prop.y - 7, 10, 1, c(0x2a1a12)).setOrigin(0, 1).setDepth(d);
      // the stems
      scene.add.rectangle(cx - 1, prop.y - 8, 1, 5, c(PALETTE.moss)).setOrigin(0, 1).setDepth(d);
      // the leaves, back layer dark and front layer light, so it has depth
      for (const [dx, dy, w, h, dark] of [
        [-5, -9, 7, 5, true],
        [5, -10, 7, 5, true],
        [0, -14, 6, 6, true],
        [-3, -11, 6, 4, false],
        [3, -12, 6, 4, false],
        [0, -16, 5, 5, false],
      ] as const) {
        scene.add
          .ellipse(cx + dx, prop.y + dy, w, h, c(dark ? PALETTE.moss : PALETTE.mossLight))
          .setDepth(d);
      }
    }
  }

  // ---- a strip light down the middle of the ceiling, and the glow under it
  if (lit) {
    scene.add.rectangle(GAME_W / 2 - 60, 2, 120, 3, PALETTE.cream).setOrigin(0, 0).setDepth(0.02).setAlpha(0.8);
    const halo = scene.add.graphics().setDepth(0.0006);
    halo.fillStyle(PALETTE.cream, 0.025);
    halo.fillTriangle(GAME_W / 2 - 60, 6, GAME_W / 2 + 60, 6, GAME_W / 2, 120);
  }
}

/**
 * An opening in a side wall: the way from one room into the next.
 *
 * It used to be two black rectangles and a word on the carpet, which read as a
 * hole rather than as a door — and a hole is not somewhere a player thinks
 * they can walk.  What makes it read is the frame and the light: a lintel and
 * a threshold in the wall's own metal, a strip of the NEXT room's colour down
 * the back of the recess, and that colour spilling out across this room's
 * floor in a wedge, the way light actually leaves a doorway.  There is NO SIGN
 * on it.  A lit recess with the next room's colour coming out of it says door
 * on its own; the plate that used to hang beside it said the same thing again
 * in words, across the wall at eye level, and the walk-up prompt already names
 * the room the moment the player is close enough for the name to matter.
 *
 * Everything here sorts below the player (depth < 50), so walking into the
 * doorway puts the player in it rather than behind it.
 */
export function paintOpening(
  scene: Phaser.Scene,
  opts: {
    side: 'left' | 'right';
    /** Middle of the opening, in room coordinates. */
    y: number;
    /** How tall the opening is.  46 is a double door. */
    h?: number;
    /** The colour of the room on the other side of it. */
    glow: number;
    night?: boolean;
  },
): void {
  const c = (col: number) => (opts.night ? nightify(col) : col);
  const h = opts.h ?? 46;
  const left = opts.side === 'left';
  const dir = left ? 1 : -1;
  // The mouth of the opening, at the inside face of the wall.
  const mouth = left ? ROOM.left : ROOM.right;
  const top = opts.y - h / 2;
  const glow = opts.night ? nightify(opts.glow) : opts.glow;

  // ---- (user, 10 Nov) an OPENING, not a door, and cut INTO the wall rather
  // than framed out from it: nothing here crosses the wall's inside face
  // (`mouth`), so the wall line stays straight and the arch reads as a hole
  // through it.  What makes it noticeable is light, not trim: the next room's
  // colour fills the arch, brightest at the far end, and breathes out across
  // this room's floor.
  const night = !!opts.night;
  const wallOuter = left ? 0 : GAME_W;
  const x0 = left ? wallOuter + 2 : mouth; // the cut, 12 px into the 14 px wall
  const w = 12;
  const arch = 0; // (user, 10 Nov: a rounded head read as a stray handle -- square, flush)

  // the floor glow, a wedge out of the mouth, pulsing slowly
  const spill = scene.add.graphics().setDepth(0.4);
  spill.fillStyle(glow, night ? 0.05 : 0.16);
  spill.fillTriangle(mouth, top + 3, mouth, top + h, mouth + dir * 52, opts.y + h / 4);
  spill.fillStyle(glow, night ? 0.04 : 0.12);
  spill.fillTriangle(mouth, top + 8, mouth, top + h - 2, mouth + dir * 28, opts.y + h / 5);
  if (!night) {
    scene.tweens.add({ targets: spill, alpha: { from: 1, to: 0.6 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  const g = scene.add.graphics().setDepth(0.5);
  // a 1 px steel trim around the cut, on the wall face
  g.fillStyle(c(PALETTE.steel), 1);
  g.fillRect(x0 - 1, top + arch - 1, w + 2, h - arch + 2);
  // the hole: dark, then the next room's light layered in toward the far side
  g.fillStyle(PALETTE.black, 1);
  g.fillRect(x0, top + arch, w, h - arch);
  const bands = night ? [0.1, 0.06, 0.03] : [0.7, 0.4, 0.18];
  bands.forEach((alpha, i) => {
    const bw = 4;
    const bx = left ? x0 + i * bw : x0 + w - (i + 1) * bw;
    g.fillStyle(glow, alpha);
    g.fillRect(bx, top + arch + 1, bw, h - arch - 1);
  });
  // the floor running through: a threshold strip at the foot of the arch
  g.fillStyle(c(PALETTE.slate), 1).fillRect(x0, top + h - 2, w, 2);
  g.fillStyle(glow, night ? 0.1 : 0.5).fillRect(x0, top + h - 2, w, 1);
  // the lit edge where the wall turns into the opening, room side
  g.fillStyle(glow, night ? 0.2 : 0.9);
  g.fillRect(left ? mouth - 1 : mouth, top + arch, 1, h - arch - 2);
}

/** The change machine, decorative in Act I and dead at night. */
export function paintChangeMachine(scene: Phaser.Scene, night: boolean, at: { x: number; y: number } = { x: 282, y: 164 }): void {
  // ---- THE CASH EXCHANGE (user, 8 Nov): a machine of its own on the floor,
  // not a panel on the wall -- an upright with a lit marquee, a screen that
  // says what it does, a slot for notes and a tray the tokens drop into.
  // Feet on `at.y`, y-sorted with the player like every other machine.
  const c = (col: number) => (night ? nightify(col) : col);
  const W = 24;
  const H = 38;
  const x0 = Math.round(at.x - W / 2);
  const y0 = at.y - H;
  const g = scene.add.graphics().setDepth(depthFor(at.y));
  // its shadow on the carpet
  g.fillStyle(0x000000, 0.35).fillEllipse(at.x, at.y + 1, W + 6, 5);
  // the cabinet: a dark outline, steel sides, a lighter face set into them
  g.fillStyle(c(0x0c0a10), 1).fillRect(x0 - 1, y0 - 1, W + 2, H + 2);
  g.fillStyle(c(tone(PALETTE.steel, 0.75)), 1).fillRect(x0, y0, W, H);
  g.fillStyle(c(PALETTE.steel), 1).fillRect(x0 + 2, y0 + 2, W - 4, H - 3);
  grain(g, x0 + 3, y0 + 3, W - 6, H - 6, c(PALETTE.steel), at.x, 0.08, 0.12);
  bevel(g, x0 + 2, y0 + 2, W - 4, H - 3, c(PALETTE.steel));
  // the marquee along the top, lit gold
  g.fillStyle(c(PALETTE.ink), 1).fillRect(x0 + 2, y0 + 2, W - 4, 7);
  g.fillStyle(night ? 0x2a2210 : PALETTE.gold, 1).fillRect(x0 + 3, y0 + 3, W - 6, 5);
  // the screen: cash in, tokens out
  g.fillStyle(c(PALETTE.ink), 1).fillRect(x0 + 4, y0 + 11, W - 8, 10);
  g.fillStyle(night ? 0x0a1410 : 0x123a2a, 1).fillRect(x0 + 5, y0 + 12, W - 10, 8);
  if (!night) {
    g.fillStyle(0x6ad86a, 1).fillRect(x0 + 6, y0 + 14, 3, 4); // the $ note
    g.fillStyle(0x6ad86a, 1).fillTriangle(x0 + 10, y0 + 15, x0 + 10, y0 + 17, x0 + 12, y0 + 16); // the arrow
    g.fillStyle(PALETTE.gold, 1).fillCircle(x0 + 15.5, y0 + 16, 2); // a token
    g.fillStyle(0xffffff, 0.25).fillTriangle(x0 + 5, y0 + 12, x0 + 10, y0 + 12, x0 + 5, y0 + 16);
  }
  // the note slot, its green lip, and the coin slot beside it
  g.fillStyle(c(PALETTE.ink), 1).fillRect(x0 + 5, y0 + 24, 9, 2);
  g.fillStyle(night ? 0x1a2a1a : 0x4ac85a, 1).fillRect(x0 + 5, y0 + 26, 9, 1);
  g.fillStyle(c(PALETTE.ink), 1).fillRect(x0 + 17, y0 + 23, 2, 4);
  // the tray at the bottom, with a token in it
  g.fillStyle(c(PALETTE.ink), 1).fillRect(x0 + 5, y0 + 30, W - 10, 5);
  g.fillStyle(c(tone(PALETTE.steel, 1.3)), 1).fillRect(x0 + 5, y0 + 35, W - 10, 1);
  if (!night) g.fillStyle(PALETTE.gold, 1).fillCircle(x0 + 9, y0 + 33, 1.5);
  // the light on top, and the word on the marquee
  g.fillStyle(night ? 0x1a1010 : PALETTE.ember, 1).fillRect(at.x - 1, y0 - 3, 3, 2);
  centerText(scene, at.x, y0 + 5, '$', night ? 0x4a4030 : PALETTE.ink).setDepth(depthFor(at.y) + 0.0001);
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
