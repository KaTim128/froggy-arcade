/**
 * A SHOP ON THE STREET, built the way the arcade is.  Every shopfront --
 * these three, and any that come later -- is the arcade's front with the
 * shop's own colours: brick in courses with the grain and the odd lighter
 * brick, a cornice along the roofline and its shadow, pilasters at the ends
 * and either side of the entrance bay, a dark plinth; the shop's name in a
 * lit sign box over the door, as the arcade's is; its goods in framed
 * windows where the arcade has its posters; and the arcade's own entrance
 * (`paintEntrance`): the glass double doors, the transom, the lamps.
 *
 * And the street they stand on is the arcade's street: the same sky by the
 * hour, the same skyline, the same paving slabs and kerb.
 */

import Phaser from 'phaser';
import { grain, seeded, tone } from './surface';
import { paintEntrance, type Inside } from './exterior';
import { PALETTE, daylight, nightify } from '../render/palette';
import { centerText } from '../core/ui';

export type ShopGoods = 'furniture' | 'clothes' | 'barber' | 'none';

export interface ShopfrontOpts {
  x: number;
  w: number;
  /** The entrance, along the front. */
  doorX: number;
  name: string;
  /** The brick. */
  wall: number;
  /** The sign: its box, its lettering and its edge. */
  signBox: number;
  signInk: number;
  /** What is lit behind the glass doors. */
  inside: Inside;
  goods: ShopGoods;
  /** Its colours for what is in the windows. */
  stock: number[];
  day: boolean;
  night: boolean;
  closed: boolean;
}

/** Where every front stands: the arcade's roofline and its foot. */
export const FRONT_TOP = 72;
export const FRONT_BASE = 150;

export function paintShopfront(scene: Phaser.Scene, o: ShopfrontOpts): { doorRect: { x: number; y: number; w: number; h: number } } {
  const c = (col: number) => (o.night ? nightify(col) : o.day ? daylight(col) : col);
  const { x: fx, w: fw, doorX } = o;
  const fy = FRONT_TOP;
  const base = FRONT_BASE;
  const fh = base - fy;
  const brick = c(o.wall);

  const wall = scene.add.graphics();
  wall.fillStyle(brick, 1).fillRect(fx, fy, fw, fh);
  // brick courses: mortar lines and staggered joints, faint
  wall.fillStyle(c(PALETTE.ink), 0.32);
  for (let row = 0, y = fy + 9; y < base - 7; row++, y += 4) {
    wall.fillRect(fx, y, fw, 1);
    for (let x = fx + (row % 2 ? 4 : 0); x < fx + fw; x += 9) wall.fillRect(x, y - 3, 1, 3);
  }
  grain(wall, fx, fy + 5, fw, fh - 12, brick, 61 + fx, 0.05, 0.14);
  // a few bricks a shade lighter
  wall.fillStyle(tone(brick, 1.25), 0.35);
  for (let i = 0; i < Math.round(fw / 9); i++) {
    const bx = fx + ((i * 37) % (fw - 10));
    const by = fy + 10 + ((i * 23) % (fh - 22));
    wall.fillRect(bx, by - (by % 4) + 1, 8, 2);
  }
  // the cornice and its shadow
  wall.fillStyle(c(PALETTE.steel), 1).fillRect(fx - 2, fy, fw + 4, 5);
  wall.fillStyle(c(PALETTE.fog), 0.6).fillRect(fx - 2, fy, fw + 4, 1);
  wall.fillStyle(c(PALETTE.ink), 0.45).fillRect(fx, fy + 5, fw, 2);
  // pilasters: the ends and either side of the entrance bay
  for (const px of [fx, fx + fw - 6, doorX - 31, doorX + 25]) {
    wall.fillStyle(c(PALETTE.steel), 1).fillRect(px, fy + 5, 6, fh - 5);
    wall.fillStyle(c(PALETTE.fog), 0.35).fillRect(px, fy + 5, 1, fh - 5);
    wall.fillStyle(c(PALETTE.ink), 0.5).fillRect(px + 5, fy + 5, 1, fh - 5);
  }
  // the plinth
  wall.fillStyle(c(PALETTE.ink), 1).fillRect(fx, base - 7, fw, 7);
  wall.fillStyle(c(PALETTE.steel), 0.6).fillRect(fx, base - 7, fw, 1);

  // ---- the windows, in the bays either side of the entrance: framed like
  // the arcade's posters, lit from inside, the shop's goods on show
  const bays: Array<[number, number]> = [
    [fx + 6, doorX - 31],
    [doorX + 31, fx + fw - 6],
  ];
  for (const [l, r] of bays) {
    const ww = r - l - 10;
    if (ww < 14) continue;
    const wx = l + 5;
    const wy = fy + 22;
    const wh = 38;
    wall.fillStyle(c(PALETTE.ink), 1).fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
    wall.fillStyle(c(PALETTE.ash), 1).fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
    wall.fillStyle(o.closed ? c(PALETTE.night) : tone(o.inside.back, 1.6), 1).fillRect(wx, wy, ww, wh);
    if (!o.closed) wall.fillStyle(o.inside.floor, 0.35).fillRect(wx, wy + wh - 8, ww, 8);
    paintGoods(wall, o, wx, wy, ww, wh, c);
    // the sill under it
    wall.fillStyle(c(PALETTE.steel), 1).fillRect(wx - 3, wy + wh + 2, ww + 6, 2);
    wall.fillStyle(c(PALETTE.ink), 0.5).fillRect(wx - 3, wy + wh + 4, ww + 6, 1);
    // the glass catching the light
    wall.fillStyle(PALETTE.white, o.night ? 0.04 : 0.12).fillRect(wx + 2, wy, 4, wh);
    wall.fillStyle(PALETTE.white, o.night ? 0.03 : 0.08).fillRect(wx + 8, wy, 1, wh);
  }

  // ---- THE ENTRANCE: the arcade's
  const ent = paintEntrance(scene, wall, {
    doorX,
    base,
    lampY: fy + 30,
    closed: o.closed,
    day: o.day,
    night: o.night,
    c,
    inside: o.inside,
  });

  // ---- THE SIGN over the door: a lit box with the name in it, like the arcade's
  const sw = Math.min(fw - 16, o.name.length * 6 + 22);
  scene.add
    .rectangle(doorX, fy - 2, sw + 10, 26, o.night ? PALETTE.ink : o.signInk)
    .setAlpha(o.night ? 0.3 : 0.4);
  scene.add.rectangle(doorX, fy - 2, sw, 18, o.night ? PALETTE.ink : o.signBox).setStrokeStyle(1, o.night ? nightify(o.signInk) : o.signInk);
  centerText(scene, doorX, fy - 2, o.name, o.night ? nightify(o.signInk) : o.signInk);
  // (on the pilaster by the door, under its lamp)
  if (o.goods === 'barber') paintPole(scene, doorX + 28, fy + 40, o.night);
  return { doorRect: ent.rect };
}

/** What is in the window. */
function paintGoods(g: Phaser.GameObjects.Graphics, o: ShopfrontOpts, x: number, y: number, w: number, h: number, c: (n: number) => number): void {
  const ink = c(PALETTE.ink);
  const col = (i: number) => (o.closed ? c(PALETTE.nightMid) : o.stock[i % o.stock.length]);
  if (o.goods === 'furniture') {
    // an armchair, a lamp, a picture on the back wall
    const fl = y + h - 3;
    for (let i = 0, cx = x + 10; cx < x + w - 10; i++, cx += 26) {
      g.fillStyle(ink, 1).fillRect(cx - 9, fl - 13, 18, 13);
      g.fillStyle(col(i), 1).fillRect(cx - 8, fl - 12, 16, 7).fillRect(cx - 8, fl - 6, 3, 6).fillRect(cx + 5, fl - 6, 3, 6);
      g.fillStyle(tone(col(i), 1.25), 1).fillRect(cx - 5, fl - 7, 10, 3);
      if (cx + 16 < x + w - 4) {
        g.fillStyle(ink, 1).fillRect(cx + 13, fl - 20, 1, 20);
        g.fillStyle(o.closed ? ink : 0xfff0c0, 1).fillRect(cx + 10, fl - 24, 7, 4);
      }
    }
    g.fillStyle(ink, 1).fillRect(x + w / 2 - 7, y + 4, 14, 10);
    g.fillStyle(col(1), 1).fillRect(x + w / 2 - 6, y + 5, 12, 8);
  } else if (o.goods === 'clothes') {
    // mannequins in a row, each in something
    for (let i = 0, cx = x + 9; cx < x + w - 6; i++, cx += 16) {
      const top = y + 8;
      g.fillStyle(ink, 1).fillCircle(cx, top + 2, 3.5);
      g.fillStyle(o.closed ? ink : 0xe8e2d8, 1).fillCircle(cx, top + 2, 2.5);
      g.fillStyle(ink, 1).fillRect(cx - 6, top + 5, 12, 15);
      g.fillStyle(col(i), 1).fillRect(cx - 5, top + 6, 10, 13);
      g.fillStyle(tone(col(i), 0.75), 1).fillRect(cx - 1, top + 6, 1, 13);
      g.fillStyle(ink, 1).fillRect(cx - 1, top + 20, 2, h - 30);
      g.fillStyle(ink, 1).fillRect(cx - 4, y + h - 4, 8, 2);
    }
  } else if (o.goods === 'barber') {
    // a chair in the window and the style posters behind it
    for (let i = 0, cx = x + 8; cx < x + w - 10; i++, cx += 16) {
      g.fillStyle(ink, 1).fillRect(cx - 1, y + 4, 12, 14);
      g.fillStyle(0xf8f0e0, 1).fillRect(cx, y + 5, 10, 12);
      g.fillStyle(col(i), 1).fillRect(cx + 2, y + 6, 6, 4);
      g.fillStyle(0xe0b090, 1).fillRect(cx + 3, y + 9, 4, 5);
    }
    const cx = x + w / 2;
    const fl = y + h - 3;
    g.fillStyle(ink, 1).fillRect(cx - 8, fl - 18, 16, 14);
    g.fillStyle(o.closed ? ink : 0xa82a2a, 1).fillRect(cx - 7, fl - 17, 14, 8).fillRect(cx - 7, fl - 9, 14, 4);
    g.fillStyle(0xb8b8c0, 1).fillRect(cx - 1, fl - 5, 2, 5).fillRect(cx - 5, fl - 1, 10, 1);
  }
}

/** The barber's pole, beside the door, turning. */
function paintPole(scene: Phaser.Scene, x: number, y: number, night: boolean): void {
  const g = scene.add.graphics();
  g.fillStyle(0x14100c, 1).fillRect(x - 3, y - 2, 7, 30);
  g.fillStyle(0xd8a838, 1).fillRect(x - 3, y - 3, 7, 2).fillRect(x - 3, y + 27, 7, 2);
  const stripes = scene.add.graphics();
  let t = 0;
  const draw = () => {
    stripes.clear();
    stripes.fillStyle(night ? 0x8a8a90 : 0xffffff, 1).fillRect(x - 2, y, 5, 26);
    for (let k = -8; k < 26; k += 8) {
      const yy = y + ((k + t) % 32);
      if (yy >= y && yy < y + 25) {
        stripes.fillStyle(night ? 0x5a2020 : 0xc83030, 1).fillRect(x - 2, yy, 5, 2);
        stripes.fillStyle(night ? 0x20305a : 0x3050c8, 1).fillRect(x - 2, Math.min(y + 25, yy + 3), 5, 1);
      }
    }
  };
  draw();
  scene.time.addEvent({ delay: 160, loop: true, callback: () => ((t = (t + 1) % 8), draw()) });
}

/** The arcade street's sky, skyline and pavement, `w` wide. */
export function paintStreet(scene: Phaser.Scene, w: number, mood: { day: boolean; night: boolean }): void {
  const c = (col: number) => (mood.night ? nightify(col) : mood.day ? daylight(col) : col);
  const bands = mood.day
    ? [PALETTE.tealLight, PALETTE.tealLight, PALETTE.teal, PALETTE.moon]
    : mood.night
      ? [PALETTE.night, PALETTE.night, PALETTE.nightMid, PALETTE.nightMid]
      : [PALETTE.plum, PALETTE.violet, PALETTE.ember, PALETTE.amber];
  for (let i = 0; i < 4; i++) scene.add.rectangle(0, i * 16, w, 16, bands[i]).setOrigin(0, 0);
  scene.add.rectangle(0, 64, w, 22, mood.day ? PALETTE.moon : mood.night ? PALETTE.nightMid : PALETTE.amberDark).setOrigin(0, 0);
  if (mood.day) {
    const g = scene.add.graphics();
    for (const [cx, cy, cw] of [
      [60, 18, 46],
      [180, 30, 34],
      [330, 14, 40],
      [470, 26, 30],
      [590, 16, 38],
    ] as const) {
      g.fillStyle(PALETTE.white, 0.5).fillRoundedRect(cx, cy, cw, 7, 3);
      g.fillStyle(PALETTE.bone, 0.4).fillRoundedRect(cx + 6, cy + 4, cw - 14, 5, 2);
    }
  }
  // the far skyline, with its lit windows
  const sky = scene.add.graphics();
  const rnd = seeded(9);
  for (let x = 0, i = 0; x < w; x += 32, i++) {
    const top = 54 + Math.floor(rnd() * 22);
    sky.fillStyle(c(PALETTE.ink), 1).fillRect(x, top, 30, 90 - top);
    sky.fillStyle(c(PALETTE.slate), 0.6).fillRect(x, top, 30, 1);
    for (let k = 0; k < 4; k++) {
      sky.fillStyle(mood.day ? c(0x3a4250) : PALETTE.amber, mood.day ? 0.8 : 0.5).fillRect(x + 3 + Math.floor(rnd() * 24), top + 4 + Math.floor(rnd() * 14), 2, 2);
    }
  }
  // the pavement: slabs in three staggered courses, the kerb, the road
  const pave = scene.add.graphics();
  pave.fillStyle(c(PALETTE.steel), 1).fillRect(0, 150, w, 26);
  pave.fillStyle(c(PALETTE.ash), 1).fillRect(0, 150, w, 2);
  pave.fillStyle(c(PALETTE.ink), 0.3).fillRect(0, 152, w, 2);
  pave.fillStyle(c(PALETTE.slate), 0.7);
  for (const [y, h, off] of [
    [152, 7, 0],
    [159, 8, 10],
    [167, 9, 4],
  ] as const) {
    pave.fillRect(0, y + h - 1, w, 1);
    for (let x = off; x < w; x += 22) pave.fillRect(x, y, 1, h);
  }
  pave.fillStyle(c(PALETTE.fog), 1).fillRect(0, 176, w, 1);
  pave.fillStyle(c(PALETTE.ash), 1).fillRect(0, 177, w, 1);
  pave.fillStyle(c(PALETTE.ink), 1).fillRect(0, 178, w, 2);
  grain(pave, 0, 152, w, 24, c(PALETTE.steel), 78, 0.06, 0.12);
}
