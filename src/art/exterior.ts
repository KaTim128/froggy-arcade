/**
 * The arcade exterior.  ONE painter, three moods.
 *
 * PRD AR-6 / QFD P2: the night version is the SAME tiles run through the
 * palette transform, not a second set of art.  If the player can't tell it's
 * the same building, the effect has failed.
 *
 * Day is the third: the street the job happens on.  Open sky, a sun, the doors
 * standing open — you are meant to walk in and out of this building all
 * afternoon, and a shut, dusk-lit facade reads as a place you get one go at.
 */

import Phaser from 'phaser';
import { PALETTE, nightify, daylight } from '../render/palette';
import { GAME_W } from '../render/pixelScaler';
import { centerText } from '../core/ui';

export interface ExteriorOpts {
  night: boolean;
  /** Daylight: the working half of the game, with the doors open. */
  day?: boolean;
  /**
   * Shut: the glass doors chained through their handles from the inside.
   * Defaults to `night` -- the arcade is open by day and at dusk.
   */
  closed?: boolean;
}

export interface ExteriorRefs {
  sign: Phaser.GameObjects.Container;
  signGlow: Phaser.GameObjects.Rectangle;
  moth: Phaser.GameObjects.Arc | null;
  doorX: number;
  doorY: number;
  /**
   * The doorway as a box, so a scene can hang a hit area on the thing the
   * player is looking at rather than on a rectangle it guessed.  Whoever draws
   * the door owns where the door is.
   */
  doorRect: { x: number; y: number; w: number; h: number };
}

/** Where the man stands, and where the player sits at the start. */
export const KERB_Y = 168;
export const MAN_X = 74;

export function paintExterior(scene: Phaser.Scene, opts: ExteriorOpts): ExteriorRefs {
  const c = (col: number) => (opts.night ? nightify(col) : opts.day ? daylight(col) : col);

  // ---- sky: day, dusk bands, or night
  const skyBands = opts.day
    ? [PALETTE.tealLight, PALETTE.tealLight, PALETTE.teal, PALETTE.moon]
    : opts.night
      ? [PALETTE.night, PALETTE.night, PALETTE.nightMid, PALETTE.nightMid]
      : [PALETTE.plum, PALETTE.violet, PALETTE.ember, PALETTE.amber];
  const bandH = 16;
  for (let i = 0; i < 4; i++) {
    scene.add.rectangle(0, i * bandH, GAME_W, bandH, skyBands[i]).setOrigin(0, 0);
  }
  scene.add
    .rectangle(0, 64, GAME_W, 22, opts.day ? PALETTE.moon : opts.night ? PALETTE.nightMid : PALETTE.amberDark)
    .setOrigin(0, 0);

  // ---- the sun, high and hard.  Nothing about this street is subtle at noon.
  if (opts.day) {
    const sun = scene.add.graphics();
    for (let i = 5; i >= 1; i--) {
      sun.fillStyle(PALETTE.cream, 0.05 + (5 - i) * 0.03);
      sun.fillCircle(268, 24, 8 + i * 4);
    }
    sun.fillStyle(PALETTE.white, 1);
    sun.fillCircle(268, 24, 9);
    sun.fillStyle(PALETTE.gold, 0.55);
    sun.fillCircle(268, 24, 12);
    sun.fillStyle(PALETTE.white, 1);
    sun.fillCircle(268, 24, 8);
    // a few flat clouds, so the sky is not an empty wash
    for (const [cx, cy, cw] of [
      [40, 18, 46],
      [120, 30, 34],
      [196, 14, 28],
    ] as const) {
      sun.fillStyle(PALETTE.white, 0.5);
      sun.fillRoundedRect(cx, cy, cw, 7, 3);
      sun.fillStyle(PALETTE.bone, 0.4);
      sun.fillRoundedRect(cx + 6, cy + 4, cw - 14, 5, 2);
    }
  }

  // ---- distant skyline
  const sky = scene.add.graphics();
  sky.fillStyle(c(PALETTE.ink), 1);
  const tops = [70, 62, 74, 58, 68, 55, 72, 64, 60, 76];
  for (let i = 0; i < tops.length; i++) {
    sky.fillRect(i * 32, tops[i], 30, 90 - tops[i]);
  }

  // ---- THE ARCADE.  A solid building: no windows -- nothing of the inside
  // shows from the street but what comes through the glass doors.  Brick, in
  // courses, between pilasters, under a cornice, on a plinth, with the
  // arcade's own posters framed on the wall and a lamp either side of the door.
  const fx = 48;
  const fw = 224;
  const fy = 72;
  const fh = 78;
  const base = fy + fh; // where the building meets the pavement
  const closed = opts.closed ?? opts.night;
  const doorX = fx + fw / 2;

  const wall = scene.add.graphics();
  wall.fillStyle(c(PALETTE.slate), 1).fillRect(fx, fy, fw, fh);
  // brick courses: mortar lines and staggered joints, faint
  wall.fillStyle(c(PALETTE.ink), 0.32);
  for (let row = 0, y = fy + 9; y < base - 7; row++, y += 4) {
    wall.fillRect(fx, y, fw, 1);
    for (let x = fx + (row % 2 ? 4 : 0); x < fx + fw; x += 9) wall.fillRect(x, y - 3, 1, 3);
  }
  // a few bricks a shade lighter, so it is not wallpaper
  wall.fillStyle(c(PALETTE.steel), 0.35);
  for (let i = 0; i < 26; i++) {
    const bx = fx + ((i * 37) % (fw - 10));
    const by = fy + 10 + ((i * 23) % (fh - 22));
    wall.fillRect(bx, by - (by % 4) + 1, 8, 2);
  }
  // the cornice along the roofline, and its shadow on the brick
  wall.fillStyle(c(PALETTE.steel), 1).fillRect(fx - 3, fy, fw + 6, 5);
  wall.fillStyle(c(PALETTE.fog), 0.6).fillRect(fx - 3, fy, fw + 6, 1);
  wall.fillStyle(c(PALETTE.ink), 0.45).fillRect(fx, fy + 5, fw, 2);
  // pilasters: at the ends, and either side of the entrance bay
  for (const px of [fx, fx + fw - 6, doorX - 31, doorX + 25]) {
    wall.fillStyle(c(PALETTE.steel), 1).fillRect(px, fy + 5, 6, fh - 5);
    wall.fillStyle(c(PALETTE.fog), 0.35).fillRect(px, fy + 5, 1, fh - 5);
    wall.fillStyle(c(PALETTE.ink), 0.5).fillRect(px + 5, fy + 5, 1, fh - 5);
  }
  // the plinth: a darker band of stone along the bottom
  wall.fillStyle(c(PALETTE.ink), 1).fillRect(fx, base - 7, fw, 7);
  wall.fillStyle(c(PALETTE.steel), 0.6).fillRect(fx, base - 7, fw, 1);
  // a drainpipe down the right-hand corner
  wall.fillStyle(c(PALETTE.ash), 1).fillRect(fx + fw - 10, fy + 5, 2, fh - 6);
  wall.fillStyle(c(PALETTE.ink), 0.6).fillRect(fx + fw - 9, fy + 5, 1, fh - 6);
  wall.fillStyle(c(PALETTE.ash), 1).fillRect(fx + fw - 12, base - 3, 6, 2);

  // the arcade's posters, framed on the wall where the windows would be
  const posters: Array<[number, number, number]> = [
    [fx + 16, c(PALETTE.violet), c(PALETTE.gold)],
    [fx + 52, c(PALETTE.tealDark), c(PALETTE.neon)],
    [doorX + 42, c(PALETTE.blood), c(PALETTE.cream)],
    [doorX + 78, c(PALETTE.moss), c(PALETTE.gold)],
  ];
  for (const [px, bg, fg] of posters) {
    const py = fy + 24;
    wall.fillStyle(c(PALETTE.ink), 1).fillRect(px - 1, py - 1, 26, 34);
    wall.fillStyle(c(PALETTE.ash), 1).fillRect(px, py, 24, 32);
    wall.fillStyle(bg, 1).fillRect(px + 2, py + 2, 20, 28);
    // a frog, a star, a title bar: an arcade poster at ten paces
    wall.fillStyle(fg, 1).fillRect(px + 4, py + 4, 16, 3);
    wall.fillStyle(c(PALETTE.mossLight), 1).fillEllipse(px + 12, py + 18, 12, 9);
    wall.fillStyle(c(PALETTE.mossLight), 1).fillCircle(px + 8, py + 13, 2.2).fillCircle(px + 16, py + 13, 2.2);
    wall.fillStyle(c(PALETTE.ink), 1).fillRect(px + 7, py + 13, 1, 1).fillRect(px + 15, py + 13, 1, 1);
    wall.fillStyle(fg, 0.8).fillRect(px + 5, py + 25, 14, 2);
    // the glass over it catching the light
    wall.fillStyle(PALETTE.white, opts.night ? 0.04 : 0.12).fillRect(px + 2, py + 2, 4, 28);
  }

  // ---- THE ALLEY MOUTH, off the arcade's right-hand corner: the gap between
  // it and the next building, in shadow, behind the pavement -- not a wall
  // standing on it.  The arcade's side wall runs back into it, the far wall
  // of the alley shows its rows of dark brick (BackAlley's), the alley's own
  // ground runs back from the kerb, and the end of the dumpster you meet in
  // there just shows.  Every view of this street has it, the same.
  paintAlleyMouth(scene, c, fx + fw, fy);

  // ---- THE ENTRANCE.  The frame from the street's open doorway -- warm tan,
  // with a transom over it -- and in it a pair of GLASS doors, the arcade's
  // purple light through them, a pull handle on each leaf either side of the
  // meeting stiles.  Shut, a chain runs through the two handles and nowhere
  // else, on the inside of the glass, and a padlock hangs from it.
  const dw = 34; // the frame, outside
  const dh = 34;
  const dTop = base - dh;
  const d = scene.add.graphics();
  // the recess in the wall and the step up to it
  d.fillStyle(c(PALETTE.ink), 1).fillRect(doorX - dw / 2 - 2, dTop - 2, dw + 4, dh + 2);
  d.fillStyle(c(PALETTE.brownLight), 1).fillRect(doorX - dw / 2, dTop, dw, dh);
  d.fillStyle(c(PALETTE.cream), 0.25).fillRect(doorX - dw / 2, dTop, dw, 1);
  d.fillStyle(c(PALETTE.brown), 1).fillRect(doorX - dw / 2 + dw - 2, dTop, 2, dh);
  // the transom: a strip of glass over the doors
  const tY = dTop + 3;
  d.fillStyle(closed ? c(PALETTE.night) : PALETTE.plum, 1).fillRect(doorX - 13, tY, 26, 4);
  d.fillStyle(c(PALETTE.brown), 1).fillRect(doorX - 14, tY + 4, 28, 1);
  // the two leaves
  const gTop = tY + 6;
  const gBot = base - 2;
  const leafW = 13;
  for (const side of [-1, 1]) {
    const lx = side < 0 ? doorX - leafW - 1 : doorX + 1;
    // the leaf's metal frame
    d.fillStyle(c(PALETTE.steel), 1).fillRect(lx, gTop, leafW, gBot - gTop);
    // the glass, and what is behind it
    const gx = lx + 1;
    const gw = leafW - 2;
    const gh = gBot - gTop - 4;
    if (closed) {
      d.fillStyle(c(PALETTE.night), 1).fillRect(gx, gTop + 1, gw, gh);
      d.fillStyle(c(PALETTE.ink), 1).fillRect(gx, gTop + gh - 6, gw, 6);
    } else {
      // the arcade's light inside, as in the open doorway
      d.fillStyle(PALETTE.plum, 1).fillRect(gx, gTop + 1, gw, gh);
      d.fillStyle(PALETTE.neonDim, 0.55).fillRect(gx, gTop + gh - 8, gw, 8);
      d.fillStyle(PALETTE.violet, 0.35).fillRect(gx, gTop + 3, gw, 3);
    }
    // the kick plate at the foot of each leaf
    d.fillStyle(c(PALETTE.ash), 1).fillRect(lx + 1, gBot - 4, leafW - 2, 3);
  }
  // the meeting stiles down the middle
  d.fillStyle(c(PALETTE.ink), 1).fillRect(doorX - 1, gTop, 2, gBot - gTop);
  // THE HANDLES: a vertical pull bar on each leaf, standing off the glass on
  // two short brackets, either side of the middle
  const hTop = gTop + 8;
  const hLen = 9;
  const hx = [doorX - 4, doorX + 3];
  for (const x of hx) {
    d.fillStyle(c(PALETTE.ash), 1).fillRect(x, hTop + 1, 1, 1).fillRect(x, hTop + hLen - 2, 1, 1);
    d.fillStyle(c(PALETTE.bone), 1).fillRect(x, hTop, 1, hLen);
  }
  if (closed) {
    // THE CHAIN, through both handles and nothing else.  Wrapped twice round
    // the pair of bars, pulled tight between them, and the padlock hanging
    // off the lower wrap.  Lit by the street, so it shows even at night.
    const steel = 0x9aa4b0;
    const dark = 0x5c6672;
    for (const wy of [hTop + 2, hTop + 5]) {
      // links: alternately face-on (a ring) and edge-on (a bar)
      for (let x = hx[0] - 1, k = 0; x <= hx[1] + 1; x++, k++) {
        d.fillStyle(k % 2 ? dark : steel, 1).fillRect(x, wy, 1, k % 2 ? 1 : 2);
      }
      // round the back of each bar
      d.fillStyle(dark, 1).fillRect(hx[0] - 1, wy - 1, 1, 3).fillRect(hx[1] + 1, wy - 1, 1, 3);
    }
    // the padlock, hanging from the lower wrap between the bars
    const lx = doorX - 1;
    const ly = hTop + 7;
    d.fillStyle(steel, 1).fillRect(lx, ly, 1, 1).fillRect(lx + 1, ly - 1, 1, 1).fillRect(lx + 2, ly, 1, 1);
    d.fillStyle(0xc9a24a, 1).fillRect(lx - 1, ly + 1, 5, 4);
    d.fillStyle(0x7a5a24, 1).fillRect(lx + 1, ly + 2, 1, 2);
    // and the glass in front of it all, so it reads as inside
    d.fillStyle(c(PALETTE.moon), 0.08).fillRect(doorX - 12, gTop + 1, 24, gBot - gTop - 4);
  }
  // reflections across the glass
  for (const side of [-1, 1]) {
    const lx = side < 0 ? doorX - leafW : doorX + 2;
    d.fillStyle(PALETTE.white, closed ? 0.07 : 0.16);
    for (let i = 0; i < 4; i++) d.fillRect(lx + 2 + i, gTop + 3 + i * 2, 1, 4);
  }
  // the threshold, and a mat on the step
  d.fillStyle(c(PALETTE.fog), 1).fillRect(doorX - dw / 2 - 2, base - 1, dw + 4, 1);
  if (!closed) d.fillStyle(c(PALETTE.neonDim), 0.8).fillRect(doorX - 10, base, 20, 2);
  const doorY = base - 16;

  // ---- the lamps either side of the door, and their light on the wall
  for (const side of [-1, 1]) {
    const lx = doorX + side * 28;
    const ly = fy + 30;
    const lit = !opts.night;
    if (lit) {
      wall.fillStyle(PALETTE.gold, opts.day ? 0.08 : 0.18).fillCircle(lx, ly + 6, 14);
      wall.fillStyle(PALETTE.gold, opts.day ? 0.1 : 0.22).fillCircle(lx, ly + 4, 7);
    }
    d.fillStyle(c(PALETTE.ink), 1).fillRect(lx - 1, ly - 3, 3, 2);
    d.fillStyle(lit ? PALETTE.cream : c(PALETTE.ash), 1).fillRect(lx - 2, ly - 1, 5, 4);
    d.fillStyle(c(PALETTE.ink), 1).fillRect(lx - 2, ly + 3, 5, 1);
  }
  if (!closed) {
    // light falling out of the glass onto the pavement
    scene.add.rectangle(doorX, base, 30, 14, opts.day ? PALETTE.gold : PALETTE.neon).setOrigin(0.5, 0).setAlpha(opts.day ? 0.12 : 0.14);
  }

  // ---- the neon frog sign
  const signGlow = scene.add
    .rectangle(doorX, fy - 2, 128, 30, opts.night ? PALETTE.ink : PALETTE.neonDim)
    .setOrigin(0.5, 0.5)
    .setAlpha(opts.night ? 0.35 : 0.55);

  const signBox = scene.add
    .rectangle(0, 0, 118, 22, opts.night ? PALETTE.ink : PALETTE.plum)
    .setStrokeStyle(1, opts.night ? nightify(PALETTE.neon) : PALETTE.neon);

  const signFrog = scene.add.graphics();
  const frogCol = opts.night ? nightify(PALETTE.mossLight) : PALETTE.mossLight;
  signFrog.fillStyle(frogCol, 1);
  signFrog.fillRoundedRect(-52, -7, 16, 12, 5);
  signFrog.fillCircle(-48, -8, 3);
  signFrog.fillCircle(-40, -8, 3);

  const signText = centerText(scene, 6, 0, 'FROGGY ARCADE', opts.night ? 0x3a3f4d : 0xff4fa3);

  const sign = scene.add.container(doorX, fy - 2, [signBox, signFrog, signText]);

  // ---- THE PAVEMENT.  Paving slabs in courses, the building's shadow along
  // its foot, a granite kerb along the front and the edge of the road past it.
  const pave = scene.add.graphics();
  pave.fillStyle(c(PALETTE.steel), 1).fillRect(0, 150, GAME_W, 26);
  pave.fillStyle(c(PALETTE.ash), 1).fillRect(0, 150, GAME_W, 2);
  pave.fillStyle(c(PALETTE.ink), 0.3).fillRect(fx, 152, fw, 2);
  // slab joints: three courses, the joints staggered
  pave.fillStyle(c(PALETTE.slate), 0.7);
  for (const [y, h, off] of [
    [152, 7, 0],
    [159, 8, 10],
    [167, 9, 4],
  ] as const) {
    pave.fillRect(0, y + h - 1, GAME_W, 1);
    for (let x = off; x < GAME_W; x += 22) pave.fillRect(x, y, 1, h);
  }
  // a few stained or cracked slabs
  pave.fillStyle(c(PALETTE.slate), 0.35);
  for (const [x, y, w] of [
    [33, 161, 8],
    [118, 170, 11],
    [207, 154, 9],
    [281, 162, 7],
  ] as const) {
    pave.fillRect(x, y, w, 1);
    pave.fillRect(x + w - 2, y + 1, 1, 2);
  }
  // the kerb, and the road beyond it
  pave.fillStyle(c(PALETTE.fog), 1).fillRect(0, 176, GAME_W, 1);
  pave.fillStyle(c(PALETTE.ash), 1).fillRect(0, 177, GAME_W, 1);
  pave.fillStyle(c(PALETTE.ink), 1).fillRect(0, 178, GAME_W, 2);
  // still wet at dusk: the street's lights lying in it
  if (!opts.night && !opts.day) {
    for (let i = 0; i < 7; i++) {
      scene.add.rectangle(18 + i * 44, 160 + (i % 3) * 5, 20, 2, PALETTE.amber).setOrigin(0, 0).setAlpha(0.2);
    }
  }
  // ---- two parked cars
  paintCar(scene, 12, 138, c(PALETTE.blood), c);
  paintCar(scene, 258, 140, c(PALETTE.tealDark), c);

  // ---- streetlight
  scene.add.rectangle(300, 96, 3, 56, c(PALETTE.steel)).setOrigin(0, 0);
  scene.add.rectangle(294, 92, 15, 5, c(PALETTE.ash)).setOrigin(0, 0);
  if (opts.night) {
    scene.add.rectangle(301, 98, 40, 56, PALETTE.moon).setOrigin(0.5, 0).setAlpha(0.10);
  }

  // ---- moth (dusk only)
  let moth: Phaser.GameObjects.Arc | null = null;
  if (!opts.night && !opts.day) {
    moth = scene.add.circle(doorX, fy - 2, 1, PALETTE.cream);
  }

  return {
    sign,
    signGlow,
    moth,
    doorX,
    doorY,
    doorRect: { x: doorX - dw / 2, y: dTop, w: dw, h: dh },
  };
}

function paintAlleyMouth(scene: Phaser.Scene, c: (n: number) => number, x0: number, top: number): void {
  const g = scene.add.graphics();
  const deep = c(PALETTE.night);
  // the gap itself, from the roofline down to the pavement
  g.fillStyle(deep, 1).fillRect(x0, top + 4, GAME_W - x0, 150 - top - 4);
  // the far wall of the alley, set back: a shade lighter, with its brick rows
  g.fillStyle(c(PALETTE.nightMid), 1).fillRect(x0 + 14, top + 12, GAME_W - x0 - 14, 150 - top - 18);
  g.fillStyle(deep, 0.9);
  for (let i = 0; i < 7; i++) g.fillRect(x0 + 16 + (i % 2) * 8, top + 16 + i * 8, 12, 2);
  // the arcade's side wall, running back into the gap
  g.fillStyle(c(PALETTE.ink), 1).fillPoints(
    [
      new Phaser.Math.Vector2(x0, top),
      new Phaser.Math.Vector2(x0 + 14, top + 12),
      new Phaser.Math.Vector2(x0 + 14, 144),
      new Phaser.Math.Vector2(x0, 150),
    ],
    true,
  );
  g.fillStyle(c(PALETTE.slate), 0.35).fillRect(x0, top, 1, 150 - top);
  // the alley's ground, running back from the kerb
  g.fillStyle(c(PALETTE.nightMid), 1).fillPoints(
    [
      new Phaser.Math.Vector2(x0, 150),
      new Phaser.Math.Vector2(GAME_W, 150),
      new Phaser.Math.Vector2(GAME_W, 144),
      new Phaser.Math.Vector2(x0 + 14, 144),
    ],
    true,
  );
  // the near end of the dumpster, just round the corner
  g.fillStyle(c(PALETTE.moss), 1).fillRect(x0 + 26, 132, 22, 12);
  g.fillStyle(c(PALETTE.mossLight), 0.5).fillRect(x0 + 26, 130, 22, 3);
}

function paintCar(scene: Phaser.Scene, x: number, y: number, body: number, c: (n: number) => number): void {
  scene.add.rectangle(x, y, 50, 12, body).setOrigin(0, 0);
  scene.add.rectangle(x + 10, y - 7, 28, 8, body).setOrigin(0, 0);
  scene.add.rectangle(x + 13, y - 5, 10, 5, c(PALETTE.fog)).setOrigin(0, 0);
  scene.add.rectangle(x + 25, y - 5, 10, 5, c(PALETTE.fog)).setOrigin(0, 0);
  scene.add.circle(x + 11, y + 12, 4, c(PALETTE.ink));
  scene.add.circle(x + 39, y + 12, 4, c(PALETTE.ink));
}

/** The sign's irregular flicker.  Gaps of 0.1s to 4s (PRD §7.2). */
export function startSignFlicker(scene: Phaser.Scene, refs: ExteriorRefs): void {
  const flick = () => {
    const on = Math.random() > 0.22;
    refs.sign.setAlpha(on ? 1 : 0.35);
    refs.signGlow.setAlpha(on ? 0.55 : 0.15);
    scene.time.delayedCall(on ? 100 + Math.random() * 3900 : 40 + Math.random() * 90, flick);
  };
  flick();
}

/** The moth's lazy figure-eight.  Nobody will notice it.  It stays anyway. */
export function startMoth(scene: Phaser.Scene, refs: ExteriorRefs): void {
  if (!refs.moth) return;
  const moth = refs.moth;
  const cx = refs.doorX;
  const cy = 70;
  let t = 0;
  scene.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) => {
    t += delta / 1000;
    moth.x = cx + Math.sin(t * 1.1) * 46;
    moth.y = cy + Math.sin(t * 2.2) * 11;
  });
}
