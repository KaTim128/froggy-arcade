/**
 * ---- INSIDE THE GRAND LILY.
 *
 * Every room of the hotel painted onto a canvas -- the side-on pixel rooms the
 * 2D scene walks (one 320x180 picture each) and the surfaces the 3D corridor
 * and stairwell are dressed in -- from ONE palette and one set of motifs, so
 * the lobby you check in at and the corridor you run down at three in the
 * morning are the same building:
 *
 *   cream damask wallpaper, a lily in every repeat;
 *   dark walnut wainscot under a gilded dado rail;
 *   burgundy carpet with a gold lattice and border;
 *   walnut doors with two raised panels, a brass plate, a brass handle;
 *   brass, everywhere a hand goes.
 *
 * The 2D rooms are drawn at one pixel per pixel with hard edges; the 3D
 * surfaces are the same designs drawn at texture resolution.
 */

import { drawPixelText } from '../render/pixelFont';

export const HP = {
  paper: '#ebdfc4',
  paperShade: '#dccba6',
  paperMotif: '#cdb88c',
  gold: '#c9a24a',
  goldHi: '#ecd07a',
  goldDark: '#8a6a24',
  wood: '#5a3a22',
  woodDark: '#3a2414',
  woodHi: '#7a5232',
  woodDeep: '#2a1a0e',
  carpet: '#6e1f2e',
  carpetDark: '#4a1220',
  carpetHi: '#8a2a3c',
  marble: '#ece6da',
  marbleVein: '#c8c0b0',
  marbleDark: '#b8ae9c',
  cream: '#f4ecd6',
  creamShade: '#d8ccae',
  steel: '#a8acb0',
  steelHi: '#d4d8dc',
  steelDark: '#6a6e74',
  navy: '#22304e',
  ink: '#16100c',
  glow: '#ffe2a0',
};

type Ctx = CanvasRenderingContext2D;

const rect = (g: Ctx, x: number, y: number, w: number, h: number, c: string, a = 1): void => {
  g.globalAlpha = a;
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
  g.globalAlpha = 1;
};

/** A warm light, added onto whatever is under it. */
export function glow(g: Ctx, x: number, y: number, r: number, a: number, rgb = '255,206,130'): void {
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${rgb},${a})`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

// ============================================================ shared pieces

/** The 2D rooms' floor line: wall down to here, then the floor. */
export const FLOOR_Y = 152;

/** Cream damask: broad stripes, a small lily in each, pixel by pixel. */
function wallpaper(g: Ctx, x0: number, y0: number, w: number, h: number, tone: { paper: string; shade: string; motif: string }): void {
  rect(g, x0, y0, w, h, tone.paper);
  for (let x = x0; x < x0 + w; x += 16) {
    rect(g, x + 5, y0, 6, h, tone.shade);
    rect(g, x + 4, y0, 1, h, tone.motif, 0.35);
    rect(g, x + 11, y0, 1, h, tone.motif, 0.35);
    for (let y = y0 + 4; y < y0 + h - 4; y += 14) {
      // a lily: three petals and a stem
      rect(g, x + 8, y, 1, 3, tone.motif);
      rect(g, x + 6, y + 1, 1, 2, tone.motif);
      rect(g, x + 10, y + 1, 1, 2, tone.motif);
      rect(g, x + 7, y + 3, 3, 1, tone.motif);
      rect(g, x + 8, y + 4, 1, 2, tone.motif, 0.7);
    }
  }
}

/** Crown moulding along the top of the wall. */
function crown(g: Ctx, w: number, h = 9): void {
  rect(g, 0, 0, w, h, HP.creamShade);
  rect(g, 0, h - 3, w, 1, HP.cream);
  rect(g, 0, h - 2, w, 1, HP.goldDark, 0.5);
  for (let x = 1; x < w; x += 4) rect(g, x, h - 6, 2, 2, HP.cream);
  rect(g, 0, h, w, 2, '#000000', 0.12);
}

/** Walnut panelling from the dado rail down, with a gilded rail on top. */
function wainscot(g: Ctx, x0: number, w: number, top: number, bottom: number, wood = HP.wood, hi = HP.woodHi, dark = HP.woodDark): void {
  rect(g, x0, top, w, bottom - top, wood);
  // the rail
  rect(g, x0, top - 3, w, 3, dark);
  rect(g, x0, top - 3, w, 1, hi);
  rect(g, x0, top - 1, w, 1, HP.gold);
  // raised panels, at the wainscot's own height
  const ph = bottom - top - 4;
  for (let x = x0 + 2; x + 14 <= x0 + w; x += 17) {
    rect(g, x, top + 2, 14, ph, dark);
    rect(g, x + 1, top + 3, 12, ph - 2, wood);
    rect(g, x + 1, top + 3, 12, 1, hi);
    rect(g, x + 1, top + 3, 1, ph - 2, hi);
  }
  // skirting
  rect(g, x0, bottom, w, FLOOR_Y - bottom, HP.woodDeep);
  rect(g, x0, bottom, w, 1, hi, 0.6);
}

/** The corridor carpet: burgundy, a gold lattice, a border. */
function carpetFloor(g: Ctx, w: number, c = { base: HP.carpet, dark: HP.carpetDark, hi: HP.carpetHi }): void {
  rect(g, 0, FLOOR_Y, w, 180 - FLOOR_Y, c.base);
  rect(g, 0, FLOOR_Y, w, 2, c.dark);
  rect(g, 0, FLOOR_Y + 3, w, 1, HP.gold, 0.7);
  for (let y = FLOOR_Y + 7; y < 180; y += 6) {
    const off = ((y - FLOOR_Y) / 6) % 2 ? 4 : 0;
    for (let x = off; x < w; x += 8) {
      rect(g, x, y, 1, 1, HP.gold, 0.55);
      rect(g, x + 2, y + 2, 1, 1, c.hi, 0.8);
    }
  }
  // the far edge shades into the dark, the near edge catches the light
  rect(g, 0, 176, w, 4, c.dark, 0.6);
}

// ============================================================ the scale

/*
 * EVERYTHING HERE IS SIZED TO THE PLAYER.  He is 26 pixels tall, about 1.75 m,
 * so a pixel is roughly 6.7 cm:
 *
 *   a door is 34 high (2.2 m) and 16 wide;  the dado rail sits at 0.9 m;
 *   a reception desk is 17 high;  a bed's mattress is 8 off the floor;
 *   a room on the sixth floor has a 3.4 m ceiling, and over it, cut away,
 *   the roof and the sky.
 *
 * The lobby is the one tall room: a three-storey atrium, the guest floors
 * running round it on galleries, so the height reads as a building rather
 * than as a very tall wall.
 */
export const DOOR_H = 34;
export const DOOR_W = 16;
/** Top of the wainscot (the dado rail sits just above it). */
const DADO = 140;
const WAIN_BOTTOM = 148;
/** Upstairs: the ceiling line, and the top of the roof slab cut away over it. */
export const CEIL_Y = 102;
export const ROOF_Y = 94;

/**
 * A walnut room door, side-on: casing, two raised panels, a brass plate with
 * the number, a lever handle.  `cx` is its middle, it stands on `floor`.
 */
export function roomDoor(g: Ctx, cx: number, num: string, opts: { w?: number; h?: number; white?: boolean; floor?: number } = {}): void {
  const w = opts.w ?? DOOR_W;
  const h = opts.h ?? DOOR_H;
  const floor = opts.floor ?? FLOOR_Y;
  const x = Math.round(cx - w / 2);
  const y = floor - h;
  const face = opts.white ? HP.cream : HP.wood;
  const hi = opts.white ? '#ffffff' : HP.woodHi;
  const dark = opts.white ? HP.creamShade : HP.woodDark;
  // casing
  rect(g, x - 2, y - 2, w + 4, h + 2, HP.cream);
  rect(g, x - 2, y - 2, w + 4, 1, '#ffffff', 0.6);
  rect(g, x - 1, y - 1, w + 2, h + 1, HP.creamShade);
  // the door
  rect(g, x, y, w, h, face);
  const top = Math.round(h * 0.38);
  for (const [py, ph] of [
    [y + 2, top],
    [y + 4 + top, h - top - 6],
  ]) {
    rect(g, x + 2, py, w - 4, ph, dark);
    rect(g, x + 3, py + 1, w - 6, ph - 2, face);
    rect(g, x + 3, py + 1, w - 6, 1, hi);
    rect(g, x + 3, py + 1, 1, ph - 2, hi);
  }
  rect(g, x + w - 1, y, 1, h, dark);
  // handle at hand height, on its rose
  rect(g, x + w - 3, y + Math.round(h * 0.5), 1, 2, HP.goldDark);
  rect(g, x + w - 5, y + Math.round(h * 0.5), 3, 1, HP.goldHi);
  // peephole at eye height
  if (!opts.white) rect(g, x + Math.round(w / 2), y + 8, 1, 1, HP.goldHi);
  // the number plate, on the door at eye height
  if (num) {
    const pw = num.length * 6 + 2;
    rect(g, Math.round(cx - pw / 2), y + 3, pw, 7, HP.goldDark);
    rect(g, Math.round(cx - pw / 2) + 1, y + 4, pw - 2, 5, HP.gold);
    drawPixelText(g, num, cx + 0.5, y + 3, { scale: 1, color: HP.ink, center: true });
  }
}

/** A brass wall sconce with a cream shade, and its light on the wall. */
function sconce(g: Ctx, x: number, y: number, lit = true): void {
  rect(g, x, y + 3, 1, 3, HP.goldDark);
  rect(g, x - 1, y + 5, 3, 1, HP.gold);
  rect(g, x - 2, y - 1, 5, 4, lit ? '#fff0c8' : '#b8ae98');
  rect(g, x - 1, y - 2, 3, 1, lit ? '#fff6dc' : '#c8bea8');
  if (lit) {
    glow(g, x + 0.5, y + 1, 12, 0.22);
    glow(g, x + 0.5, y - 3, 6, 0.22);
  }
}

/** A framed picture: a lily on a dark ground, or a landscape. */
function picture(g: Ctx, x: number, y: number, w: number, h: number, kind: 'lily' | 'land'): void {
  rect(g, x - 1, y - 1, w + 2, h + 2, HP.goldDark);
  rect(g, x, y, w, h, HP.gold);
  const ix = x + 1;
  const iy = y + 1;
  const iw = w - 2;
  const ih = h - 2;
  if (kind === 'lily') {
    rect(g, ix, iy, iw, ih, '#26302a');
    const cx = ix + Math.floor(iw / 2);
    rect(g, cx, iy + 1, 1, 2, '#f4c8dc');
    rect(g, cx - 1, iy + 2, 3, 1, '#e08ab0');
    rect(g, cx, iy + 3, 1, ih - 3, '#5a8a4a');
  } else {
    rect(g, ix, iy, iw, Math.ceil(ih * 0.55), '#9ac0d8');
    rect(g, ix, iy + Math.ceil(ih * 0.55), iw, ih - Math.ceil(ih * 0.55), '#5a7a4a');
    rect(g, ix + iw - 2, iy + 1, 1, 1, '#fff0b0');
  }
}

/** Polished marble: big tiles, veins, and the room's lights in it. */
function marbleFloor(g: Ctx, w: number): void {
  rect(g, 0, FLOOR_Y, w, 180 - FLOOR_Y, HP.marble);
  for (let y = FLOOR_Y; y < 180; y += 7) {
    const off = ((y - FLOOR_Y) / 7) % 2 ? 8 : 0;
    rect(g, 0, y, w, 1, HP.marbleDark, 0.7);
    for (let x = off; x < w; x += 16) rect(g, x, y, 1, 7, HP.marbleDark, 0.7);
  }
  for (let k = 0; k < 40; k++) {
    const x = (k * 53) % w;
    const y = FLOOR_Y + 2 + ((k * 7) % 24);
    rect(g, x, y, 2 + (k % 3), 1, HP.marbleVein, 0.8);
  }
  rect(g, 0, FLOOR_Y, w, 2, '#8a8070', 0.6);
}

/** A run of crown moulding at any height. */
function crownAt(g: Ctx, w: number, y: number, h = 4): void {
  rect(g, 0, y, w, h, HP.creamShade);
  rect(g, 0, y + h - 2, w, 1, HP.cream);
  rect(g, 0, y + h - 1, w, 1, HP.goldDark, 0.5);
  for (let x = 1; x < w; x += 4) rect(g, x, y + 1, 2, 1, HP.cream);
  rect(g, 0, y + h, w, 1, '#000000', 0.12);
}

/**
 * The top floor's ceiling, cut away: the concrete slab of the roof in
 * section, with the roof's own clutter standing on it against the sky.
 * Above ROOF_Y the canvas is left EMPTY -- the scene puts the sky (for the
 * hour it is) behind it.
 */
function roofCutaway(g: Ctx, w: number): void {
  g.clearRect(0, 0, w, CEIL_Y);
  // the slab, in section: concrete with its hatching, a membrane on top
  rect(g, 0, ROOF_Y, w, CEIL_Y - ROOF_Y, '#6a6660');
  for (let x = -8; x < w; x += 5) for (let k = 0; k < CEIL_Y - ROOF_Y; k++) rect(g, x + k, ROOF_Y + k, 1, 1, '#57534e');
  rect(g, 0, ROOF_Y, w, 1, '#2e2c2a');
  rect(g, 0, ROOF_Y - 1, w, 1, '#3a3836');
  // the roof's furniture: a parapet at the far end, vent stacks, an air
  // handler, a water tank on legs, an aerial
  const dark = '#24262c';
  const lit = '#3e424c';
  rect(g, 0, ROOF_Y - 5, 3, 4, dark);
  rect(g, w - 3, ROOF_Y - 5, 3, 4, dark);
  for (const vx of [38, 132, 226]) {
    rect(g, vx, ROOF_Y - 7, 2, 6, dark);
    rect(g, vx - 1, ROOF_Y - 8, 4, 1, lit);
  }
  rect(g, 70, ROOF_Y - 9, 18, 8, dark);
  rect(g, 70, ROOF_Y - 9, 18, 1, lit);
  for (let k = 0; k < 4; k++) rect(g, 72 + k * 4, ROOF_Y - 7, 2, 4, '#30333a');
  rect(g, 182, ROOF_Y - 20, 16, 11, dark);
  rect(g, 182, ROOF_Y - 20, 16, 1, lit);
  rect(g, 182, ROOF_Y - 20, 1, 11, lit);
  for (const lx of [183, 196]) rect(g, lx, ROOF_Y - 9, 1, 8, dark);
  rect(g, 280, ROOF_Y - 24, 1, 23, dark);
  rect(g, 277, ROOF_Y - 20, 7, 1, dark);
  rect(g, 278, ROOF_Y - 15, 5, 1, dark);
  rect(g, 280, ROOF_Y - 25, 1, 1, '#ff3a3a');
  // the ceiling of the room under it
  crownAt(g, w, CEIL_Y, 3);
}

/** The sky over the roof: the night, the morning, or three in the morning. */
export function paintSky(g: Ctx, w: number, h: number, when: 'night' | 'day' | 'late'): void {
  const sky = g.createLinearGradient(0, 0, 0, h);
  if (when === 'day') {
    sky.addColorStop(0, '#6aaee4');
    sky.addColorStop(1, '#cfe6f2');
  } else if (when === 'night') {
    sky.addColorStop(0, '#060c24');
    sky.addColorStop(1, '#1c2a52');
  } else {
    sky.addColorStop(0, '#020308');
    sky.addColorStop(1, '#0c1020');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  if (when === 'day') {
    for (const [cx, cy, cw] of [[50, 24, 30], [190, 40, 40], [280, 18, 24]] as const) {
      rect(g, cx - cw / 2, cy, cw, 4, '#ffffff', 0.8);
      rect(g, cx - cw / 4, cy - 3, cw / 2, 3, '#ffffff', 0.8);
    }
    return;
  }
  for (let k = 0; k < 70; k++) rect(g, (k * 37) % w, (k * 23) % Math.max(1, h - 8), 1, 1, '#fff4d0', when === 'late' ? 0.35 : 0.45 + (k % 3) * 0.18);
}

// ============================================================ the lobby

/** The lobby runs on past the lift, to the storage room: wider than a screen. */
export const LOBBY_W = 420;
/** The staircase door, where the palm was; and the storage room's, past the lift. */
export const STAIR_DOOR_X = 238;
export const STORAGE_X = 372;
/** The reception desk: its top, and its span. */
export const DESK = { x: 124, w: 72, top: 135 };

/**
 * One gallery of the atrium, its floor at `floor`: the guest doors along the
 * back of it, the slab edge, and a brass-capped balustrade in front.
 */
function gallery(g: Ctx, W: number, floor: number, doors: number[]): void {
  for (const dx of doors) roomDoor(g, dx, '', { floor });
  for (const sx of doors.filter((_, k) => k % 2 === 0)) sconce(g, sx + 14, floor - 26);
  // the slab edge, with the light along its underside
  rect(g, 0, floor, W, 4, HP.cream);
  rect(g, 0, floor, W, 1, '#ffffff', 0.7);
  rect(g, 0, floor + 3, W, 1, HP.goldDark);
  rect(g, 0, floor + 4, W, 1, '#000000', 0.15);
  // the balustrade: a brass rail at waist height and turned balusters
  rect(g, 0, floor - 14, W, 2, HP.gold);
  rect(g, 0, floor - 14, W, 1, HP.goldHi);
  for (let x = 1; x < W; x += 3) rect(g, x, floor - 12, 1, 12, HP.creamShade);
  rect(g, 0, floor - 2, W, 2, HP.cream);
}

export function paintLobby(g: Ctx, night: boolean, empty = false): void {
  const W = LOBBY_W;
  crown(g, W);
  wallpaper(g, 0, 11, W, DADO - 14, { paper: HP.paper, shade: HP.paperShade, motif: HP.paperMotif });
  // ---- the atrium: two guest floors on galleries round it
  const doors = [24, 60, 132, 176, 252, 300, 338, 384];
  gallery(g, W, 48, doors);
  gallery(g, W, 98, doors);
  wainscot(g, 0, W, DADO, WAIN_BOTTOM);
  marbleFloor(g, W);
  // the runner, from the doors to the lift
  rect(g, 30, 160, 370, 12, HP.carpet);
  rect(g, 30, 160, 370, 1, HP.gold);
  rect(g, 30, 171, 370, 1, HP.gold);
  for (let x = 34; x < 396; x += 8) rect(g, x, 165, 2, 2, HP.gold, 0.6);

  // ---- the front doors: glass and brass, the night (or the day) in them
  const out = night ? '#0c1426' : '#9ac8e0';
  rect(g, 6, 112, 34, 40, HP.cream);
  rect(g, 8, 114, 30, 38, HP.goldDark);
  rect(g, 9, 115, 28, 4, out);
  rect(g, 9, 119, 28, 1, HP.gold);
  for (const dx of [9, 23]) {
    rect(g, dx, 120, 14, 32, HP.gold);
    rect(g, dx + 1, 121, 12, 29, out);
    rect(g, dx + 2, 122, 1, 9, '#ffffff', night ? 0.12 : 0.4);
    rect(g, dx + 4, 124, 1, 5, '#ffffff', night ? 0.08 : 0.3);
    rect(g, dx + 1, 148, 12, 2, HP.goldDark);
  }
  rect(g, 21, 133, 1, 6, HP.goldHi);
  rect(g, 24, 133, 1, 6, HP.goldHi);
  rect(g, 6, 150, 34, 2, HP.woodDeep);

  // ---- a velvet armchair, a side table and a lamp, at sitting height
  const ax = 56;
  rect(g, ax + 1, 136, 14, 9, '#356a54');
  rect(g, ax + 1, 136, 14, 1, '#4a8068');
  rect(g, ax, 143, 16, 5, '#2e5a48');
  rect(g, ax - 1, 141, 3, 7, '#2a5040');
  rect(g, ax + 14, 141, 3, 7, '#2a5040');
  rect(g, ax + 2, 143, 12, 1, '#3e7460');
  rect(g, ax, 148, 1, 4, HP.woodDark);
  rect(g, ax + 15, 148, 1, 4, HP.woodDark);
  rect(g, 78, 142, 8, 1, HP.wood);
  rect(g, 81, 143, 2, 8, HP.woodDark);
  rect(g, 79, 151, 6, 1, HP.woodDark);
  rect(g, 81, 138, 2, 4, HP.goldDark);
  rect(g, 79, 134, 6, 4, '#f0e0b8');
  rect(g, 80, 133, 4, 1, '#f8ecd0');
  glow(g, 82, 137, 14, 0.4);

  // ---- columns framing the desk, all three storeys
  for (const px of [104, 216]) {
    rect(g, px - 4, 11, 8, 141, HP.cream);
    for (const f of [-2, 0, 2]) rect(g, px + f, 18, 1, 118, HP.creamShade);
    rect(g, px - 5, 11, 10, 4, HP.gold);
    rect(g, px - 5, 15, 10, 1, HP.goldDark);
    rect(g, px - 5, 144, 10, 8, HP.creamShade);
    rect(g, px - 5, 144, 10, 1, '#ffffff', 0.5);
    rect(g, px + 3, 11, 1, 141, '#000000', 0.08);
  }

  // ---- behind the desk: the sign under the gallery, the pigeonholes
  rect(g, 132, 105, 56, 9, HP.woodDark);
  rect(g, 133, 106, 54, 7, HP.wood);
  rect(g, 133, 106, 54, 1, HP.gold);
  drawPixelText(g, 'RECEPTION', 160.5, 107, { scale: 1, color: '#2a1608', center: true });
  drawPixelText(g, 'RECEPTION', 160, 106, { scale: 1, color: HP.goldHi, center: true });
  for (const cx of [124, 196]) {
    rect(g, cx - 3, 118, 7, 7, HP.goldDark);
    rect(g, cx - 2, 119, 5, 5, HP.cream);
    rect(g, cx, 120, 1, 2, HP.ink);
    rect(g, cx, 122, 2, 1, HP.ink);
  }
  rect(g, 137, 117, 46, 18, HP.woodDark);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++) {
      const x = 138 + c * 5 + (c >= 4 ? 4 : 0);
      const y = 118 + r * 5;
      rect(g, x, y, 4, 4, HP.woodDeep);
      rect(g, x, y + 3, 4, 1, HP.woodHi);
      if ((r * 8 + c) % 3 !== 1) rect(g, x + 1, y + 1, 2, 2, HP.gold);
    }

  // ---- the clerk, behind it (unless nobody is)
  if (!empty) clerk(g, 160);

  // ---- the desk: walnut panels, gold trim, a marble top
  desk(g);
  paintLobbyRest(g);
}

function clerk(g: Ctx, cx: number): void {
  rect(g, cx - 5, 129, 10, 10, HP.navy);
  rect(g, cx - 1, 129, 2, 5, '#f4f0e8');
  rect(g, cx, 130, 1, 4, '#7b2a3a');
  rect(g, cx - 3, 122, 6, 7, '#e8b890');
  rect(g, cx - 3, 120, 6, 3, '#3a2414');
  rect(g, cx - 2, 125, 1, 1, HP.ink);
  rect(g, cx + 1, 125, 1, 1, HP.ink);
}

function desk(g: Ctx): void {
  const { x, w, top } = DESK;
  rect(g, x - 3, top, w + 6, 3, HP.marble);
  rect(g, x - 3, top, w + 6, 1, '#ffffff');
  rect(g, x - 3, top + 2, w + 6, 1, HP.marbleDark);
  rect(g, x, top + 3, w, FLOOR_Y - top - 3, HP.wood);
  rect(g, x, top + 3, w, 1, HP.woodDark);
  rect(g, x, top + 4, w, 1, HP.gold);
  for (let k = 0; k < 4; k++) {
    const px = x + 3 + k * 17;
    rect(g, px, top + 6, 15, 8, HP.woodDark);
    rect(g, px + 1, top + 7, 13, 6, HP.woodHi);
    rect(g, px + 2, top + 8, 11, 4, HP.wood);
    rect(g, px + 6, top + 9, 2, 2, HP.gold);
  }
  rect(g, x, FLOOR_Y - 2, w, 2, HP.woodDeep);
  // on it: a banker's lamp, the book, a bell, the lilies
  rect(g, x + 6, top - 3, 1, 3, HP.goldDark);
  rect(g, x + 3, top - 5, 6, 2, '#2e6a4a');
  rect(g, x + 3, top - 5, 6, 1, '#4a8a68');
  glow(g, x + 6, top - 2, 9, 0.45);
  rect(g, 140, top - 2, 11, 2, '#f4ecd6');
  rect(g, 145, top - 2, 1, 2, HP.creamShade);
  rect(g, 174, top - 2, 4, 2, HP.gold);
  rect(g, 175, top - 3, 2, 1, HP.goldHi);
  rect(g, 188, top - 6, 3, 6, '#c8dce8');
  rect(g, 188, top - 5, 1, 4, '#ffffff', 0.5);
  for (const [fx, fy] of [
    [187, top - 9],
    [190, top - 10],
    [192, top - 8],
  ])
    rect(g, fx, fy, 2, 2, '#f8e0ec');
}

function paintLobbyRest(g: Ctx): void {
  // ---- the staircase door: a heavy fire door in a walnut frame
  stairDoor(g, STAIR_DOOR_X);

  // ---- the lift: brass surround, brushed steel doors, the dial above
  const lx = 280;
  rect(g, lx - 13, 114, 26, 38, HP.gold);
  rect(g, lx - 13, 114, 26, 1, HP.goldHi);
  rect(g, lx - 12, 116, 24, 36, HP.goldDark);
  for (const dx of [-11, 0]) {
    rect(g, lx + dx, 117, 11, 35, HP.steel);
    for (let k = 2; k < 11; k += 3) rect(g, lx + dx + k, 117, 1, 35, HP.steelHi, 0.5);
    rect(g, lx + dx, 117, 11, 1, HP.steelHi);
  }
  rect(g, lx, 117, 1, 35, HP.steelDark);
  // the floor dial
  rect(g, lx - 6, 105, 12, 8, HP.goldDark);
  rect(g, lx - 5, 106, 10, 6, HP.ink);
  // call buttons, at hand height
  rect(g, 296, 129, 4, 7, HP.goldDark);
  rect(g, 297, 130, 2, 5, HP.gold);
  rect(g, 297, 131, 2, 1, '#ffd45e');
  rect(g, 297, 133, 2, 1, HP.goldHi);

  // ---- the chandeliers, down the middle of the atrium
  for (const chx of [56, 252, 380]) {
    rect(g, chx, 0, 1, 66, HP.goldDark);
    rect(g, chx - 9, 66, 19, 2, HP.gold);
    rect(g, chx - 6, 68, 13, 2, HP.goldDark);
    for (let k = -8; k <= 8; k += 4) {
      rect(g, chx + k, 63, 1, 3, HP.goldDark);
      rect(g, chx + k - 1, 61, 3, 2, '#fff6d8');
    }
    for (let k = -6; k <= 6; k += 3) rect(g, chx + k, 70 + (Math.abs(k) % 6 === 0 ? 1 : 2), 1, 2, '#e8f0ff');
    glow(g, chx + 0.5, 64, 40, 0.34);
    glow(g, chx + 0.5, 64, 12, 0.5);
  }
  sconce(g, 104, 124);
  sconce(g, 216, 124);
  glow(g, 160, 152, 80, 0.1);

  // ---- past the lift: a luggage trolley and the storage room door
  luggageTrolley(g, 336);
  storageDoor(g, STORAGE_X);
  sconce(g, 404, 124);
}

/** A fire door into the stairwell, dressed for the lobby. */
function stairDoor(g: Ctx, cx: number): void {
  const w = 18;
  const x = cx - w / 2;
  const y = FLOOR_Y - DOOR_H;
  rect(g, x - 2, y - 2, w + 4, DOOR_H + 2, HP.woodDark);
  rect(g, x - 2, y - 2, w + 4, 1, HP.woodHi);
  rect(g, x - 1, y - 1, w + 2, DOOR_H + 1, HP.woodDeep);
  rect(g, x, y, w, DOOR_H, '#7a5a3a');
  rect(g, x + 1, y + 1, w - 2, 1, '#9a7a52');
  // panels
  rect(g, x + 2, y + 13, w - 4, 8, '#6a4a2e');
  rect(g, x + 2, y + 24, w - 4, 7, '#6a4a2e');
  // the narrow wired-glass window
  rect(g, x + 6, y + 3, 6, 8, HP.goldDark);
  rect(g, x + 7, y + 4, 4, 6, '#2a3440');
  for (let k = 0; k < 6; k += 2) rect(g, x + 7, y + 4 + k, 4, 1, '#4a5868', 0.7);
  // push bar and kick plate
  rect(g, x + 1, y + 17, w - 2, 1, '#c8c8c0');
  rect(g, x + 1, y + 18, w - 2, 1, '#8a8a84');
  rect(g, x + 1, FLOOR_Y - 3, w - 2, 2, HP.gold);
  // the exit sign over it, glowing green
  rect(g, cx - 6, y - 8, 12, 5, '#0e5a2e');
  rect(g, cx - 5, y - 7, 10, 3, '#2ec466');
  rect(g, cx - 4, y - 7, 1, 2, '#e8ffe8');
  rect(g, cx - 2, y - 6, 2, 1, '#e8ffe8');
  rect(g, cx + 1, y - 7, 3, 2, '#e8ffe8', 0.8);
  glow(g, cx, y - 6, 12, 0.25);
}

/** A brass luggage trolley, parked by the wall: handle at about 1.8 m. */
function luggageTrolley(g: Ctx, cx: number): void {
  rect(g, cx - 8, 147, 16, 2, HP.gold);
  rect(g, cx - 8, 125, 1, 23, HP.gold);
  rect(g, cx + 7, 125, 1, 23, HP.gold);
  rect(g, cx - 8, 124, 16, 2, HP.goldHi);
  rect(g, cx - 6, 137, 8, 10, '#5a2a3a');
  rect(g, cx - 6, 137, 8, 1, '#7a3a4a');
  rect(g, cx + 1, 141, 5, 6, '#2a3a5a');
  rect(g, cx - 3, 135, 3, 2, HP.goldDark);
  for (const wx of [cx - 7, cx + 6]) rect(g, wx - 1, 149, 2, 3, HP.ink);
}

/** The storage room: a plain staff door with a small window in it. */
function storageDoor(g: Ctx, cx: number): void {
  const w = DOOR_W;
  const x = cx - w / 2;
  const y = FLOOR_Y - DOOR_H;
  rect(g, x - 2, y - 2, w + 4, DOOR_H + 2, HP.creamShade);
  rect(g, x, y, w, DOOR_H, '#8a7e6a');
  rect(g, x + 1, y + 1, w - 2, 1, '#a89c86');
  rect(g, x, y, 1, DOOR_H, '#6a604e');
  // the little window: dark inside, a mop handle and a bucket rim just showing
  rect(g, x + 4, y + 4, 8, 9, '#4a4436');
  rect(g, x + 5, y + 5, 6, 7, '#1a1c22');
  rect(g, x + 7, y + 5, 1, 7, '#8a6a3a');
  rect(g, x + 8, y + 9, 3, 3, '#c8a020');
  rect(g, x + 5, y + 5, 1, 3, '#ffffff', 0.12);
  // handle, kick plate, sign
  rect(g, x + w - 4, y + 17, 2, 1, HP.goldHi);
  rect(g, x + w - 3, y + 18, 1, 2, HP.goldDark);
  rect(g, x + 1, FLOOR_Y - 3, w - 2, 2, '#6a604e');
  rect(g, cx - 16, y - 11, 32, 8, HP.goldDark);
  rect(g, cx - 15, y - 10, 30, 6, HP.ink);
  drawPixelText(g, 'STAFF', cx, y - 10, { scale: 1, color: '#c8c2b4', center: true });
}

// ============================================================ the corridor

export const CORRIDOR_DOORS = [90, 132, 174, 216, 258, 300];

export function paintCorridor(g: Ctx): void {
  const W = 320;
  wallpaper(g, 0, CEIL_Y, W, DADO - CEIL_Y, { paper: HP.paper, shade: HP.paperShade, motif: HP.paperMotif });
  roofCutaway(g, W);
  wainscot(g, 0, W, DADO, WAIN_BOTTOM);
  carpetFloor(g, W);
  // the lift you came up in
  const lx = 22;
  rect(g, lx - 12, 116, 24, 36, HP.gold);
  rect(g, lx - 11, 117, 22, 35, HP.goldDark);
  for (const dx of [-10, 0]) {
    rect(g, lx + dx, 118, 10, 34, HP.steel);
    for (let k = 2; k < 10; k += 3) rect(g, lx + dx + k, 118, 1, 34, HP.steelHi, 0.5);
  }
  rect(g, lx, 118, 1, 34, HP.steelDark);
  rect(g, lx - 6, 107, 12, 7, HP.goldDark);
  rect(g, lx - 5, 108, 10, 5, HP.ink);
  // and the stairs beside it: a fire door, the green sign
  const sx = 56;
  rect(g, sx - 9, 116, 18, 36, '#d8d4c8');
  rect(g, sx - 8, 118, 16, 34, '#8a9088');
  rect(g, sx - 8, 118, 16, 1, '#b0b6ae');
  rect(g, sx - 3, 121, 6, 7, '#3a4440');
  rect(g, sx - 2, 122, 4, 5, '#6a8088');
  rect(g, sx - 7, 135, 14, 1, '#c0c4c0');
  rect(g, sx - 11, 106, 22, 8, '#0e5a30');
  rect(g, sx - 10, 107, 20, 6, '#1a8a4a');
  drawPixelText(g, 'EXIT', sx + 0.5, 107, { scale: 1, color: '#e8ffe8', center: true });
  glow(g, sx, 110, 10, 0.3, '120,255,160');
  // the rooms
  CORRIDOR_DOORS.forEach((x, k) => roomDoor(g, x, `${607 + k}`));
  // between them: sconces and the odd picture
  CORRIDOR_DOORS.slice(0, -1).forEach((x, k) => {
    const mx = x + 21;
    if (k % 2 === 0) sconce(g, mx, 124);
    else picture(g, mx - 5, 118, 10, 8, k % 4 === 1 ? 'lily' : 'land');
  });
  // the ceiling lights' pools down the wall
  for (let x = 40; x < W; x += 64) glow(g, x, CEIL_Y + 4, 24, 0.22);
}

// ============================================================ room 612

/**
 * The window: a tall casement from the sill (0.9 m) to just under the
 * ceiling, 40 by 31 -- exactly the window Froggy's picture was drawn for,
 * at five sixteenths (see windowFroggy's WF, and WIN_SCALE).
 */
export const ROOM_WINDOW = { x: 140, y: 107, w: 40, h: 31 };
export const WIN_SCALE = 40 / 128;
export const ROOM_DOOR_X = 22;
export const BATH_DOOR_X = 62;
/** The bed: its middle, and where a sleeper's head lies. */
export const BED = { x: 268, w: 34, top: 144 };

/**
 * The room.  `lamp` lights the bedside lamps and the room; without it the
 * room is lit only by whatever comes round the curtains.
 */
export function paintRoom(g: Ctx): void {
  const W = 320;
  // soft warm walls: a pale stripe, cream panelling below
  wallpaper(g, 0, CEIL_Y, W, DADO - CEIL_Y, { paper: '#efe6d2', shade: '#e6dbc2', motif: '#d8c8a4' });
  roofCutaway(g, W);
  wainscot(g, 0, W, DADO, WAIN_BOTTOM, '#e2d6bc', '#f4ecd8', '#c8b898');
  // the carpet: a quiet oatmeal, and a rug under the bed
  rect(g, 0, FLOOR_Y, W, 28, '#8a7a66');
  rect(g, 0, FLOOR_Y, W, 2, '#6a5a48');
  for (let y = FLOOR_Y + 4; y < 180; y += 4) for (let x = (y % 8) / 2; x < W; x += 6) rect(g, x, y, 1, 1, '#9a8a74');
  rect(g, 240, 156, 58, 14, '#7b2a3a');
  rect(g, 240, 156, 58, 1, HP.gold);
  rect(g, 240, 169, 58, 1, HP.gold);
  for (let x = 244; x < 296; x += 6) rect(g, x, 162, 2, 2, '#9a3a4c');

  // ---- the window: a cream frame and a sill
  const { x, y, w, h } = ROOM_WINDOW;
  rect(g, x - 3, y - 3, w + 6, h + 6, HP.cream);
  rect(g, x - 3, y - 3, w + 6, 1, '#ffffff');
  rect(g, x - 1, y - 1, w + 2, h + 2, HP.creamShade);
  // (the glass is left empty: the view goes behind this picture)
  g.clearRect(x, y, w, h);
  rect(g, x - 5, y + h + 2, w + 10, 2, HP.cream);
  rect(g, x - 5, y + h + 2, w + 10, 1, '#ffffff');
  rect(g, x - 5, y + h + 4, w + 10, 1, HP.creamShade);
  // a low radiator under the sill
  rect(g, x + 4, 143, w - 8, 7, '#e8e2d4');
  for (let k = x + 6; k < x + w - 5; k += 3) rect(g, k, 144, 1, 5, '#cfc6b2');
  // the rail the curtains hang from
  rect(g, x - 8, y - 5, w + 16, 1, HP.gold);
  rect(g, x - 9, y - 6, 2, 3, HP.goldHi);
  rect(g, x + w + 7, y - 6, 2, 3, HP.goldHi);

  // ---- the door out, with its chain, and the bathroom door
  roomDoor(g, ROOM_DOOR_X, '');
  rect(g, ROOM_DOOR_X + 2, 130, 4, 1, HP.goldHi);
  rect(g, ROOM_DOOR_X - 6, 128, 3, 6, '#7b2a3a');
  rect(g, ROOM_DOOR_X - 6, 127, 2, 1, '#f4ecd6');
  roomDoor(g, BATH_DOOR_X, '', { w: 15, white: true });

  // ---- the bed, foot towards you: a buttoned headboard against the wall,
  // white sheets, a burgundy throw, the pillows just showing over the duvet
  const bx = BED.x - BED.w / 2;
  rect(g, bx + 1, 128, BED.w - 2, 18, '#3e5a6a');
  rect(g, bx + 1, 128, BED.w - 2, 1, '#5a7a8a');
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) rect(g, bx + 5 + c * 7 + (r % 2) * 3, 132 + r * 5, 1, 1, '#2a3e4a');
  rect(g, bx + 4, 139, 11, 4, '#ffffff');
  rect(g, bx + 19, 139, 11, 4, '#ffffff');
  rect(g, bx + 4, 142, 26, 1, '#d8d4cc');
  rect(g, bx, BED.top, BED.w, 6, '#f6f2ea');
  rect(g, bx, BED.top, BED.w, 1, '#ffffff');
  rect(g, bx, BED.top + 3, BED.w, 3, '#7b2a3a');
  rect(g, bx, BED.top + 3, BED.w, 1, HP.gold);
  rect(g, bx - 1, BED.top + 6, BED.w + 2, 4, HP.wood);
  rect(g, bx - 1, BED.top + 6, BED.w + 2, 1, HP.woodHi);
  rect(g, bx, FLOOR_Y - 2, 2, 2, HP.woodDark);
  rect(g, bx + BED.w - 2, FLOOR_Y - 2, 2, 2, HP.woodDark);
  // nightstands and their lamps
  for (const nx of [bx - 7, bx + BED.w + 7]) {
    rect(g, nx - 4, 143, 8, 9, HP.wood);
    rect(g, nx - 4, 143, 8, 1, HP.woodHi);
    rect(g, nx - 3, 147, 6, 1, HP.woodDark);
    rect(g, nx, 148, 1, 1, HP.gold);
    rect(g, nx, 139, 1, 4, HP.goldDark);
    rect(g, nx - 2, 135, 5, 4, '#f4e6c4');
    rect(g, nx - 1, 134, 3, 1, '#fff4dc');
  }
  // a picture over the bed
  picture(g, BED.x - 6, 112, 12, 10, 'lily');
  // the ceiling light
  rect(g, 160, CEIL_Y + 3, 1, 2, HP.goldDark);
  rect(g, 156, CEIL_Y + 5, 9, 2, '#f4ecd6');
}

/** The room's lamps and their light, painted over the room (only when lit). */
export function paintRoomLight(g: Ctx): void {
  const bx = BED.x - BED.w / 2;
  for (const nx of [bx - 7, bx + BED.w + 7]) {
    glow(g, nx, 137, 24, 0.42);
    glow(g, nx, 137, 7, 0.6);
  }
  glow(g, 160, CEIL_Y + 6, 56, 0.2);
  glow(g, BED.x, 150, 44, 0.12);
}

/** The view out: the night, the morning, or three in the morning. */
export function paintView(g: Ctx, w: number, h: number, when: 'night' | 'day' | 'late'): void {
  const sky = g.createLinearGradient(0, 0, 0, h);
  if (when === 'day') {
    sky.addColorStop(0, '#7ab8e8');
    sky.addColorStop(1, '#d8ecf4');
  } else if (when === 'night') {
    sky.addColorStop(0, '#0a1230');
    sky.addColorStop(0.7, '#1c2a52');
    sky.addColorStop(1, '#3a3a5a');
  } else {
    sky.addColorStop(0, '#04060e');
    sky.addColorStop(1, '#0e1220');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const night = when !== 'day';
  if (night) {
    for (let k = 0; k < 40; k++) {
      const sx = (k * 37) % w;
      const sy = (k * 23) % Math.floor(h * 0.55);
      rect(g, sx, sy, 1, 1, '#fff4d0', when === 'late' ? 0.4 : 0.5 + (k % 3) * 0.15);
    }
    // the moon, and its light on the cloud
    const mx = Math.round(w * 0.74);
    const my = Math.round(h * 0.22);
    glow(g, mx, my, Math.max(6, h * 0.3), when === 'late' ? 0.12 : 0.22, '200,210,255');
    g.fillStyle = when === 'late' ? '#a8acb8' : '#f0ecd8';
    g.beginPath();
    g.arc(mx, my, Math.max(1.5, h * 0.07), 0, Math.PI * 2);
    g.fill();
    rect(g, mx - 1, my - 1, 1, 1, '#c8c4b0', 0.6);
  } else {
    glow(g, Math.round(w * 0.2), Math.round(h * 0.2), Math.max(6, h * 0.3), 0.5, '255,240,180');
    for (const [cx, cy] of [
      [w * 0.55, h * 0.18],
      [w * 0.82, h * 0.3],
    ]) {
      rect(g, Math.round(cx - w * 0.08), Math.round(cy), Math.round(w * 0.16), 2, '#ffffff', 0.8);
      rect(g, Math.round(cx - w * 0.05), Math.round(cy) - 1, Math.round(w * 0.1), 1, '#ffffff', 0.8);
    }
  }
  // the forest, two rows of it, and the road through it with its lamps
  const far = night ? '#101a22' : '#4a7a5a';
  const near = night ? '#060c10' : '#2e5a3e';
  const hz = Math.round(h * 0.62);
  for (let x = 0; x < w; x += 5) {
    const t = 6 + ((x * 7) % 9);
    for (let k = 0; k < t; k++) rect(g, x + Math.floor(k / 3), hz - t + k, 5 - Math.floor(k / 3) * 2, 1, far);
  }
  rect(g, 0, hz, w, h - hz, far);
  // the road, and the lamps along it going away
  rect(g, Math.round(w * 0.3), hz + 2, Math.round(w * 0.4), 3, night ? '#1a1c22' : '#5a5a5a');
  for (let k = 0; k < 5; k++) {
    const lx = Math.round(w * 0.32 + k * w * 0.09);
    rect(g, lx, hz - 3, 1, 5, night ? '#2a2a2a' : '#4a4a4a');
    if (night) {
      rect(g, lx, hz - 4, 1, 1, '#ffd890');
      glow(g, lx, hz - 3, 5, when === 'late' ? 0.15 : 0.35);
    }
  }
  for (let x = -4; x < w; x += 7) {
    const t = 10 + ((x * 13) % 12);
    for (let k = 0; k < t; k++) rect(g, x + Math.floor(k / 2.5), h - t + k - 4, 7 - Math.floor(k / 2.5) * 2, 1, near);
  }
  rect(g, 0, h - 4, w, 4, near);
  // the arcade's sign, tiny and pink, at the far end
  if (night) {
    rect(g, Math.round(w * 0.12), hz - 5, 4, 2, '#ff4fa3', when === 'late' ? 0.3 : 0.8);
    glow(g, Math.round(w * 0.12) + 2, hz - 4, 6, when === 'late' ? 0.08 : 0.25, '255,80,160');
  }
}

/** The glazing over the view: two mullions, a transom, and a sheen. */
export function paintGlazing(g: Ctx, w: number, h: number): void {
  const mull = HP.cream;
  rect(g, Math.round(w / 2), 0, 1, h, mull);
  rect(g, 0, Math.round(h * 0.3), w, 1, mull);
  for (const x0 of [3, Math.round(w / 2) + 3]) for (let d = 0; d < 5; d++) rect(g, x0 + d, 3 + d * 2, 1, 2, '#ffffff', 0.07);
}

/**
 * One curtain: heavy velvet, its folds, a gold hem and tie-back.  Drawn the
 * full width it hangs when closed; opening it squeezes the folds together.
 */
export function paintCurtain(g: Ctx, w: number, h: number, side: -1 | 1): void {
  const base = '#6a1e2e';
  const hi = '#8e3044';
  const dark = '#3e0e1a';
  rect(g, 0, 0, w, h, base);
  for (let x = 0; x < w; x += 4) {
    rect(g, x, 0, 1, h, hi);
    rect(g, x + 3, 0, 1, h, dark);
  }
  // the heading tape and rings
  rect(g, 0, 0, w, 2, dark);
  for (let x = 1; x < w; x += 4) rect(g, x, 0, 1, 1, '#c9a24a');
  // a gold hem
  rect(g, 0, h - 2, w, 1, '#c9a24a');
  rect(g, 0, h - 1, w, 1, '#8a6a24');
  // the leading edge catches the light
  const edge = side < 0 ? w - 1 : 0;
  rect(g, edge, 0, 1, h, '#b04a60');
}

// ============================================================ the bathroom

/** The mirror over the basin: chest to crown for a man standing at it. */
export const MIRROR = { x: 149, y: 115, w: 22, h: 21 };

export function paintBathroom(g: Ctx): void {
  const W = 320;
  // white subway tile to the ceiling, a burgundy band at the dado
  rect(g, 0, CEIL_Y, W, FLOOR_Y - CEIL_Y, '#f2f0ea');
  for (let y = CEIL_Y; y < FLOOR_Y; y += 4) {
    rect(g, 0, y, W, 1, '#d8d4cc');
    for (let x = ((y - CEIL_Y) / 4) % 2 ? 4 : 0; x < W; x += 8) rect(g, x, y, 1, 4, '#d8d4cc');
  }
  roofCutaway(g, W);
  rect(g, 0, DADO - 2, W, 3, '#7b2a3a');
  rect(g, 0, DADO - 2, W, 1, '#9a3a4c');
  rect(g, 0, DADO + 1, W, 1, HP.gold);
  // floor: small black-and-white tiles
  for (let y = FLOOR_Y; y < 180; y += 4)
    for (let x = 0; x < W; x += 4) rect(g, x, y, 4, 4, ((x + y) / 4) % 2 ? '#2a2a2e' : '#e8e6e0');
  rect(g, 0, FLOOR_Y, W, 2, '#8a8a8a');
  // the door back to the room
  roomDoor(g, 22, '', { w: 15, white: true });
  // a towel rail with towels, at hand height
  rect(g, 70, 128, 18, 1, HP.steelHi);
  rect(g, 72, 129, 6, 12, '#f8f6f0');
  rect(g, 72, 138, 6, 1, '#7b2a3a');
  rect(g, 80, 129, 6, 10, '#f8f6f0');
  rect(g, 80, 136, 6, 1, '#7b2a3a');
  // the vanity: mirror in gold, a light bar, a marble top, a basin
  const m = MIRROR;
  rect(g, m.x - 2, m.y - 2, m.w + 4, m.h + 4, HP.goldDark);
  rect(g, m.x - 1, m.y - 1, m.w + 2, m.h + 2, HP.gold);
  g.clearRect(m.x, m.y, m.w, m.h);
  rect(g, m.x - 2, m.y - 7, m.w + 4, 3, HP.steel);
  for (let k = 0; k < 3; k++) rect(g, m.x + 2 + k * 8, m.y - 6, 3, 1, '#fff6d8');
  glow(g, m.x + m.w / 2, m.y - 5, 24, 0.38);
  const top = 139;
  rect(g, m.x - 7, top, m.w + 14, 2, HP.marble);
  rect(g, m.x - 7, top, m.w + 14, 1, '#ffffff');
  rect(g, m.x + 6, top - 1, 10, 1, '#ffffff');
  rect(g, m.x + 10, top - 5, 1, 4, HP.steelHi);
  rect(g, m.x + 10, top - 5, 3, 1, HP.steelHi);
  rect(g, m.x - 5, top + 2, m.w + 10, FLOOR_Y - top - 2, HP.wood);
  rect(g, m.x - 5, top + 2, m.w + 10, 1, HP.woodHi);
  for (let k = 0; k < 2; k++) {
    rect(g, m.x - 3 + k * 16, top + 4, 14, 7, HP.woodDark);
    rect(g, m.x - 2 + k * 16, top + 5, 12, 5, HP.wood);
    rect(g, m.x + 3 + k * 16, top + 7, 2, 1, HP.gold);
  }
  // soap, a glass, a little orchid
  rect(g, m.x - 5, top - 2, 3, 2, '#f4c8dc');
  rect(g, m.x + m.w + 1, top - 4, 2, 4, '#c8dce8');
  rect(g, m.x + m.w + 4, top - 5, 2, 5, '#e8e2d6');
  rect(g, m.x + m.w + 4, top - 7, 2, 2, '#f8e0ec');
  // the toilet: a seat at 0.4 m, the cistern behind it
  rect(g, 214, 134, 9, 10, '#f8f6f0');
  rect(g, 214, 134, 9, 1, '#ffffff');
  rect(g, 211, 144, 14, 3, '#f0eee8');
  rect(g, 213, 147, 10, 5, '#e8e6e0');
  rect(g, 221, 136, 1, 1, HP.steelHi);
  // the bath, with a shower curtain half drawn
  rect(g, 256, 143, 40, 9, '#f8f6f0');
  rect(g, 256, 143, 40, 1, '#ffffff');
  rect(g, 258, 151, 2, 1, HP.gold);
  rect(g, 292, 151, 2, 1, HP.gold);
  rect(g, 254, 112, 44, 1, HP.steelHi);
  for (let x = 256; x < 274; x += 3) {
    rect(g, x, 113, 2, 30, '#f4f2ec');
    rect(g, x + 2, 113, 1, 30, '#d8d4cc');
  }
  for (let y = 118; y < 140; y += 8) rect(g, 264, y, 2, 2, '#e8b0c8');
  rect(g, 288, 120, 1, 6, HP.steelHi);
  rect(g, 285, 119, 6, 2, HP.steel);
  // a small frosted window high up, the night in it
  rect(g, 216, 108, 14, 11, HP.cream);
  rect(g, 217, 109, 12, 9, '#3a4a6a');
  rect(g, 222, 109, 1, 9, HP.cream);
  glow(g, 160, CEIL_Y, 60, 0.12);
}

// ============================================================ the lift

export function paintLift(g: Ctx): void {
  const W = 320;
  rect(g, 0, 0, W, 180, '#3a2414');
  // walnut walls, a brass handrail, the doors in front of you
  wainscot(g, 0, W, 26, 146);
  rect(g, 0, 0, W, 20, '#2a1a0e');
  for (let x = 20; x < W; x += 40) {
    rect(g, x, 4, 20, 10, '#fff4d8');
    glow(g, x + 10, 10, 40, 0.3);
  }
  rect(g, 0, 20, W, 3, HP.gold);
  rect(g, 0, 112, W, 3, HP.goldHi);
  rect(g, 0, 115, W, 1, HP.goldDark);
  const cx = 160;
  rect(g, cx - 44, 42, 88, 110, HP.gold);
  rect(g, cx - 42, 44, 84, 108, HP.goldDark);
  for (const dx of [-41, 0]) {
    rect(g, cx + dx, 45, 41, 107, HP.steel);
    for (let k = 2; k < 41; k += 3) rect(g, cx + dx + k, 45, 1, 107, HP.steelHi, 0.45);
    rect(g, cx + dx, 45, 41, 1, HP.steelHi);
  }
  rect(g, cx, 45, 1, 107, HP.steelDark);
  // the floor indicator, and the panel of buttons
  rect(g, cx - 16, 24, 32, 14, HP.goldDark);
  rect(g, cx - 15, 25, 30, 12, HP.ink);
  rect(g, cx + 54, 46, 22, 76, HP.goldDark);
  rect(g, cx + 55, 47, 20, 74, HP.gold);
  const labels = ['6', '5', '4', '3', '2', 'G'];
  labels.forEach((l, k) => {
    rect(g, cx + 58, 50 + k * 11, 14, 10, HP.goldDark);
    rect(g, cx + 59, 51 + k * 11, 12, 8, '#3a2a14');
    drawPixelText(g, l, cx + 65.5, 51 + k * 11, { scale: 1, color: '#fff0c0', center: true });
  });
  // the carpet under your feet
  rect(g, 0, FLOOR_Y, W, 28, HP.carpet);
  rect(g, 0, FLOOR_Y, W, 2, HP.carpetDark);
  rect(g, 0, FLOOR_Y + 3, W, 1, HP.gold, 0.7);
}

// ============================================================ 3D surfaces

/**
 * The same designs at texture resolution, for the corridor and the stairs.
 * Each returns a fresh canvas; the scene makes the textures.
 */
export function canvas(w: number, h: number, paint: (g: Ctx) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  return c;
}

/** One repeat of the damask (one metre wide, the wall's height above the rail). */
export function texWallpaper(): HTMLCanvasElement {
  return canvas(256, 512, (g) => {
    g.fillStyle = HP.paper;
    g.fillRect(0, 0, 256, 512);
    // the broad stripe and its fine edges
    g.fillStyle = HP.paperShade;
    g.fillRect(80, 0, 96, 512);
    g.fillStyle = 'rgba(160,130,80,0.35)';
    g.fillRect(72, 0, 3, 512);
    g.fillRect(181, 0, 3, 512);
    // a lily in the stripe, and small sprigs between
    for (let y = 40; y < 512; y += 128) {
      lily(g, 128, y + 30, 1.4, '#c8b07e');
      lily(g, 20, y + 94, 0.7, '#d8c49a');
      lily(g, 236, y + 94, 0.7, '#d8c49a');
    }
    // a little age in it
    for (let k = 0; k < 400; k++) {
      g.fillStyle = `rgba(120,90,50,${0.02 + (k % 5) * 0.006})`;
      g.fillRect((k * 97) % 256, (k * 61) % 512, 2, 2);
    }
  });
}

function lily(g: Ctx, x: number, y: number, s: number, col: string): void {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(0, -12, 6, 16, 0, 0, Math.PI * 2);
  g.ellipse(-12, -2, 5, 13, -0.9, 0, Math.PI * 2);
  g.ellipse(12, -2, 5, 13, 0.9, 0, Math.PI * 2);
  g.fill();
  g.fillRect(-1.5, 6, 3, 22);
  g.beginPath();
  g.ellipse(-8, 22, 8, 3, -0.4, 0, Math.PI * 2);
  g.ellipse(8, 22, 8, 3, 0.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** The walnut wainscot, one panel wide (0.8 m), rail to skirting. */
export function texWainscot(): HTMLCanvasElement {
  return canvas(256, 256, (g) => {
    const grain = (x: number, y: number, w: number, h: number, base: string): void => {
      g.fillStyle = base;
      g.fillRect(x, y, w, h);
      for (let k = 0; k < h; k += 3) {
        g.fillStyle = `rgba(30,16,6,${0.06 + ((k * 7) % 5) * 0.02})`;
        g.fillRect(x, y + k, w, 1);
      }
    };
    grain(0, 0, 256, 256, HP.wood);
    // the rail at the top
    g.fillStyle = HP.woodDark;
    g.fillRect(0, 0, 256, 18);
    g.fillStyle = HP.woodHi;
    g.fillRect(0, 0, 256, 4);
    g.fillStyle = HP.gold;
    g.fillRect(0, 14, 256, 3);
    // the raised panel
    g.fillStyle = HP.woodDark;
    g.fillRect(24, 40, 208, 176);
    grain(30, 46, 196, 164, '#6a4428');
    g.fillStyle = 'rgba(255,220,170,0.18)';
    g.fillRect(30, 46, 196, 4);
    g.fillRect(30, 46, 4, 164);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(30, 206, 196, 4);
    g.fillRect(222, 46, 4, 164);
    // the skirting
    g.fillStyle = HP.woodDeep;
    g.fillRect(0, 232, 256, 24);
    g.fillStyle = HP.woodHi;
    g.fillRect(0, 232, 256, 2);
  });
}

/** The carpet: burgundy, a gold lattice -- one repeat, half a metre. */
export function texCarpet(): HTMLCanvasElement {
  return canvas(128, 128, (g) => {
    g.fillStyle = HP.carpet;
    g.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 600; k++) {
      g.fillStyle = k % 2 ? 'rgba(0,0,0,0.08)' : 'rgba(255,200,200,0.04)';
      g.fillRect((k * 37) % 128, (k * 53) % 128, 2, 1);
    }
    g.strokeStyle = 'rgba(201,162,74,0.75)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(64, 0);
    g.lineTo(128, 64);
    g.lineTo(64, 128);
    g.lineTo(0, 64);
    g.closePath();
    g.stroke();
    g.fillStyle = HP.carpetHi;
    g.beginPath();
    g.arc(64, 64, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = HP.gold;
    g.beginPath();
    g.arc(64, 64, 4, 0, Math.PI * 2);
    g.fill();
    for (const [x, y] of [
      [0, 0],
      [128, 0],
      [0, 128],
      [128, 128],
    ]) {
      g.fillStyle = HP.carpetDark;
      g.beginPath();
      g.arc(x, y, 12, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** The carpet's border, along each side of the runner. */
export function texCarpetBorder(): HTMLCanvasElement {
  return canvas(64, 128, (g) => {
    g.fillStyle = HP.carpetDark;
    g.fillRect(0, 0, 64, 128);
    g.fillStyle = HP.gold;
    g.fillRect(10, 0, 4, 128);
    g.fillRect(50, 0, 4, 128);
    for (let y = 8; y < 128; y += 32) {
      g.beginPath();
      g.moveTo(32, y);
      g.lineTo(42, y + 16);
      g.lineTo(32, y + 32);
      g.lineTo(22, y + 16);
      g.closePath();
      g.fill();
    }
  });
}

/** A room door, front on: walnut, two panels, brass plate with its number. */
export function texRoomDoor(num: string, broken = false): HTMLCanvasElement {
  return canvas(256, 512, (g) => {
    g.fillStyle = HP.wood;
    g.fillRect(0, 0, 256, 512);
    for (let k = 0; k < 512; k += 4) {
      g.fillStyle = `rgba(30,16,6,${0.05 + ((k * 11) % 7) * 0.012})`;
      g.fillRect(0, k, 256, 2);
    }
    const panel = (x: number, y: number, w: number, h: number): void => {
      g.fillStyle = HP.woodDark;
      g.fillRect(x, y, w, h);
      g.fillStyle = '#684326';
      g.fillRect(x + 8, y + 8, w - 16, h - 16);
      g.fillStyle = 'rgba(255,220,170,0.2)';
      g.fillRect(x + 8, y + 8, w - 16, 4);
      g.fillRect(x + 8, y + 8, 4, h - 16);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(x + 8, y + h - 12, w - 16, 4);
      g.fillRect(x + w - 12, y + 8, 4, h - 16);
    };
    panel(36, 40, 184, 170);
    panel(36, 250, 184, 220);
    // the brass plate
    g.fillStyle = HP.goldDark;
    g.fillRect(84, 100, 88, 44);
    g.fillStyle = HP.gold;
    g.fillRect(88, 104, 80, 36);
    g.fillStyle = HP.goldHi;
    g.fillRect(88, 104, 80, 4);
    g.fillStyle = '#2a1608';
    g.font = 'bold 28px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(num, 128, 124);
    // the peephole
    g.fillStyle = HP.goldDark;
    g.beginPath();
    g.arc(128, 70, 6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#100a06';
    g.beginPath();
    g.arc(128, 70, 3, 0, Math.PI * 2);
    g.fill();
    // the lever handle and the card lock
    g.fillStyle = HP.goldDark;
    g.fillRect(206, 228, 20, 60);
    g.fillStyle = HP.gold;
    g.fillRect(208, 230, 16, 56);
    g.fillStyle = '#c03030';
    g.fillRect(212, 238, 8, 4);
    g.fillStyle = HP.goldHi;
    g.fillRect(170, 270, 50, 8);
    if (broken) {
      // split and gouged
      g.strokeStyle = '#1a0e06';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(40, 0);
      g.lineTo(110, 180);
      g.lineTo(90, 300);
      g.lineTo(150, 512);
      g.stroke();
      for (let k = 0; k < 4; k++) {
        g.strokeStyle = 'rgba(20,10,4,0.8)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(140 + k * 14, 180);
        g.lineTo(150 + k * 16, 260);
        g.stroke();
      }
    }
  });
}

/** The lift doors: brushed steel in brass, the dead indicator over them. */
export function texLiftDoors(): HTMLCanvasElement {
  return canvas(512, 512, (g) => {
    g.fillStyle = HP.gold;
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = HP.goldDark;
    g.fillRect(20, 20, 472, 492);
    for (const x0 of [28, 258]) {
      const grd = g.createLinearGradient(x0, 0, x0 + 226, 0);
      grd.addColorStop(0, '#9aa0a6');
      grd.addColorStop(0.5, '#c4c8cc');
      grd.addColorStop(1, '#8e9298');
      g.fillStyle = grd;
      g.fillRect(x0, 28, 226, 484);
      for (let k = 0; k < 226; k += 3) {
        g.fillStyle = `rgba(255,255,255,${0.05 + (k % 7) * 0.012})`;
        g.fillRect(x0 + k, 28, 1, 484);
      }
    }
    g.fillStyle = '#3a3e44';
    g.fillRect(254, 28, 4, 484);
  });
}

/** The fire door to the stairs: grey steel, a push bar, wired glass. */
export function texFireDoor(): HTMLCanvasElement {
  return canvas(256, 512, (g) => {
    g.fillStyle = '#7e8680';
    g.fillRect(0, 0, 256, 512);
    for (let k = 0; k < 400; k++) {
      g.fillStyle = `rgba(0,0,0,${0.03 + (k % 4) * 0.01})`;
      g.fillRect((k * 61) % 256, (k * 29) % 512, 3, 1);
    }
    g.fillStyle = '#4a524e';
    g.fillRect(84, 60, 88, 130);
    g.fillStyle = '#4a6068';
    g.fillRect(90, 66, 76, 118);
    g.strokeStyle = 'rgba(200,210,210,0.4)';
    g.lineWidth = 1;
    for (let k = 0; k < 120; k += 12) {
      g.beginPath();
      g.moveTo(90, 66 + k);
      g.lineTo(166, 66 + k);
      g.stroke();
      g.beginPath();
      g.moveTo(90 + (k * 76) / 120, 66);
      g.lineTo(90 + (k * 76) / 120, 184);
      g.stroke();
    }
    g.fillStyle = '#c4c8c4';
    g.fillRect(20, 270, 216, 22);
    g.fillStyle = '#e8ece8';
    g.fillRect(20, 270, 216, 5);
    g.fillStyle = '#a0201c';
    g.fillRect(70, 230, 116, 26);
    g.fillStyle = '#ffffff';
    g.font = 'bold 18px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('STAIRS', 128, 244);
  });
}

/** A sign: green EXIT, or the floor painted on the stairwell wall. */
export function texSign(label: string, bg: string, fg: string, w = 256, h = 96): HTMLCanvasElement {
  return canvas(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = `bold ${Math.round(h * 0.62)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, w / 2, h / 2 + 2);
  });
}

/** The stairwell: painted block, a stripe at the floor numbers. */
export function texBlock(): HTMLCanvasElement {
  // Painted concrete block: each block its own tone, a soft bevel (light on
  // the top edge, shadow under), recessed mortar, scuffs and paint runs.
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return canvas(512, 512, (g) => {
    g.fillStyle = '#9a9488';
    g.fillRect(0, 0, 512, 512);
    const bh = 64;
    const bw = 128;
    for (let row = 0; row < 512 / bh; row++) {
      const y = row * bh;
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -off; x < 512; x += bw) {
        const tone = 196 + Math.floor((rnd() - 0.5) * 16);
        const bx = x + 3;
        const by = y + 3;
        const w = bw - 6;
        const h = bh - 6;
        const grad = g.createLinearGradient(0, by, 0, by + h);
        grad.addColorStop(0, `rgb(${tone + 10},${tone + 6},${tone - 4})`);
        grad.addColorStop(0.15, `rgb(${tone},${tone - 4},${tone - 14})`);
        grad.addColorStop(1, `rgb(${tone - 12},${tone - 16},${tone - 26})`);
        g.fillStyle = grad;
        for (const dx of [0, 512, -512]) g.fillRect(bx + dx, by, w, h);
        // the bevel
        g.fillStyle = 'rgba(255,250,235,0.35)';
        for (const dx of [0, 512, -512]) g.fillRect(bx + dx, by, w, 2);
        g.fillStyle = 'rgba(40,34,26,0.28)';
        for (const dx of [0, 512, -512]) {
          g.fillRect(bx + dx, by + h - 2, w, 2);
          g.fillRect(bx + dx + w - 2, by, 2, h);
        }
      }
    }
    // pores in the block under the paint
    for (let k = 0; k < 2600; k++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      g.fillStyle = rnd() < 0.7 ? `rgba(60,52,40,${0.06 + rnd() * 0.08})` : `rgba(255,250,240,${0.05 + rnd() * 0.06})`;
      g.fillRect(x, y, 1 + Math.floor(rnd() * 2), 1 + Math.floor(rnd() * 2));
    }
    // scuffs and grime runs
    for (let k = 0; k < 18; k++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const r = 10 + rnd() * 30;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(50,44,36,0.12)');
      grad.addColorStop(1, 'rgba(50,44,36,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let k = 0; k < 7; k++) {
      const x = rnd() * 512;
      const y = rnd() * 400;
      g.fillStyle = 'rgba(70,60,46,0.08)';
      g.fillRect(x, y, 2, 30 + rnd() * 80);
    }
  });
}

/** Poured concrete: treads, slabs, the undersides of the flights. */
export function texConcrete(base = '#8e8a84'): HTMLCanvasElement {
  let seed = 11;
  const rnd = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return canvas(256, 256, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    // big soft clouds of tone, then aggregate, then the odd pit
    for (let k = 0; k < 40; k++) {
      const x = rnd() * 256;
      const y = rnd() * 256;
      const r = 20 + rnd() * 50;
      const light = rnd() < 0.5;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, light ? 'rgba(255,250,240,0.07)' : 'rgba(30,26,20,0.08)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let k = 0; k < 3200; k++) {
      const v = rnd();
      g.fillStyle = v < 0.5 ? `rgba(30,26,22,${0.08 + rnd() * 0.1})` : `rgba(240,236,226,${0.06 + rnd() * 0.1})`;
      g.fillRect(rnd() * 256, rnd() * 256, 1, 1);
    }
    for (let k = 0; k < 60; k++) {
      g.fillStyle = 'rgba(20,18,14,0.3)';
      g.fillRect(rnd() * 256, rnd() * 256, 2, 2);
    }
  });
}
