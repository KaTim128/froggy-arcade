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
  // raised panels
  for (let x = x0 + 3; x + 22 <= x0 + w; x += 26) {
    rect(g, x, top + 4, 22, bottom - top - 8, dark);
    rect(g, x + 1, top + 5, 20, bottom - top - 10, wood);
    rect(g, x + 1, top + 5, 20, 1, hi);
    rect(g, x + 1, top + 5, 1, bottom - top - 10, hi);
    rect(g, x + 3, top + 7, 16, bottom - top - 14, hi, 0.25);
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

/**
 * A walnut room door, side-on: casing, two raised panels, a brass plate with
 * the number, a lever handle.  `cx` is its middle, it stands on the floor.
 */
export function roomDoor(g: Ctx, cx: number, num: string, opts: { w?: number; h?: number; white?: boolean } = {}): void {
  const w = opts.w ?? 22;
  const h = opts.h ?? 46;
  const x = Math.round(cx - w / 2);
  const y = FLOOR_Y - h;
  const face = opts.white ? HP.cream : HP.wood;
  const hi = opts.white ? '#ffffff' : HP.woodHi;
  const dark = opts.white ? HP.creamShade : HP.woodDark;
  // casing
  rect(g, x - 3, y - 3, w + 6, h + 3, HP.cream);
  rect(g, x - 3, y - 3, w + 6, 1, '#ffffff', 0.6);
  rect(g, x - 1, y - 1, w + 2, h + 1, HP.creamShade);
  // the door
  rect(g, x, y, w, h, face);
  for (const [py, ph] of [
    [y + 4, Math.round(h * 0.36)],
    [y + 8 + Math.round(h * 0.36), Math.round(h * 0.46)],
  ]) {
    rect(g, x + 3, py, w - 6, ph, dark);
    rect(g, x + 4, py + 1, w - 8, ph - 2, face);
    rect(g, x + 4, py + 1, w - 8, 1, hi);
    rect(g, x + 4, py + 1, 1, ph - 2, hi);
  }
  rect(g, x + w - 1, y, 1, h, dark);
  // handle and its rose
  rect(g, x + w - 5, y + Math.round(h * 0.52), 2, 3, HP.goldDark);
  rect(g, x + w - 8, y + Math.round(h * 0.52), 5, 1, HP.goldHi);
  // peephole
  if (!opts.white) rect(g, x + Math.round(w / 2), y + 10, 1, 1, HP.goldHi);
  // the plate over it
  if (num) {
    const pw = num.length * 6 + 4;
    rect(g, Math.round(cx - pw / 2), y - 13, pw, 9, HP.goldDark);
    rect(g, Math.round(cx - pw / 2) + 1, y - 12, pw - 2, 7, HP.gold);
    drawPixelText(g, num, cx + 0.5, y - 12, { scale: 1, color: HP.ink, center: true });
  }
}

/** A brass wall sconce with a cream shade, and its light on the wall. */
function sconce(g: Ctx, x: number, y: number, lit = true): void {
  rect(g, x - 1, y + 4, 3, 5, HP.goldDark);
  rect(g, x - 3, y + 8, 7, 1, HP.gold);
  rect(g, x - 3, y - 2, 7, 6, lit ? '#fff0c8' : '#b8ae98');
  rect(g, x - 2, y - 3, 5, 1, lit ? '#fff6dc' : '#c8bea8');
  if (lit) {
    glow(g, x + 0.5, y + 1, 15, 0.22);
    glow(g, x + 0.5, y - 5, 7, 0.22);
  }
}

/** A framed picture: a lily on a dark ground, or a landscape. */
function picture(g: Ctx, x: number, y: number, w: number, h: number, kind: 'lily' | 'land'): void {
  rect(g, x - 2, y - 2, w + 4, h + 4, HP.goldDark);
  rect(g, x - 1, y - 1, w + 2, h + 2, HP.gold);
  if (kind === 'lily') {
    rect(g, x, y, w, h, '#26302a');
    const cx = x + Math.floor(w / 2);
    const cy = y + Math.floor(h / 2);
    rect(g, cx, cy - 4, 1, 5, '#f4c8dc');
    rect(g, cx - 3, cy - 2, 2, 3, '#f4c8dc');
    rect(g, cx + 2, cy - 2, 2, 3, '#f4c8dc');
    rect(g, cx - 1, cy + 1, 3, 1, '#e08ab0');
    rect(g, cx, cy + 2, 1, h - (cy - y) - 3, '#5a8a4a');
    rect(g, cx - 3, y + h - 3, 3, 1, '#5a8a4a');
  } else {
    rect(g, x, y, w, Math.ceil(h * 0.55), '#9ac0d8');
    rect(g, x, y + Math.ceil(h * 0.55), w, h - Math.ceil(h * 0.55), '#5a7a4a');
    for (let k = 0; k < w; k += 3) rect(g, x + k, y + Math.ceil(h * 0.55) - 1 - (k % 2), 2, 2, '#3a5a3a');
    rect(g, x + w - 5, y + 2, 2, 2, '#fff0b0');
  }
  rect(g, x, y, w, 1, '#ffffff', 0.18);
}

/** Polished marble: big tiles, veins, and the room's lights in it. */
function marbleFloor(g: Ctx, w: number): void {
  rect(g, 0, FLOOR_Y, w, 180 - FLOOR_Y, HP.marble);
  for (let y = FLOOR_Y; y < 180; y += 10) {
    const off = ((y - FLOOR_Y) / 10) % 2 ? 12 : 0;
    rect(g, 0, y, w, 1, HP.marbleDark, 0.7);
    for (let x = off; x < w; x += 24) rect(g, x, y, 1, 10, HP.marbleDark, 0.7);
  }
  for (let k = 0; k < 40; k++) {
    const x = (k * 53) % w;
    const y = FLOOR_Y + 2 + ((k * 7) % 24);
    rect(g, x, y, 3 + (k % 4), 1, HP.marbleVein, 0.8);
  }
  rect(g, 0, FLOOR_Y, w, 2, '#8a8070', 0.6);
}

// ============================================================ the lobby

/** The lobby runs on past the lift, to the storage room: wider than a screen. */
export const LOBBY_W = 420;
/** The staircase door, where the palm was; and the storage room's, past the lift. */
export const STAIR_DOOR_X = 238;
export const STORAGE_X = 372;

export function paintLobby(g: Ctx, night: boolean, empty = false): void {
  const W = LOBBY_W;
  crown(g, W);
  wallpaper(g, 0, 11, W, 96, { paper: HP.paper, shade: HP.paperShade, motif: HP.paperMotif });
  wainscot(g, 0, W, 108, 146);
  marbleFloor(g, W);
  // the runner, from the doors to the lift
  rect(g, 30, 160, 370, 14, HP.carpet);
  rect(g, 30, 160, 370, 1, HP.gold);
  rect(g, 30, 173, 370, 1, HP.gold);
  for (let x = 34; x < 396; x += 8) rect(g, x, 166, 2, 2, HP.gold, 0.6);

  // ---- the front doors: glass and brass, the night (or the day) in them
  const out = night ? '#0c1426' : '#9ac8e0';
  rect(g, 4, 92, 38, 60, HP.cream);
  rect(g, 6, 94, 34, 58, HP.goldDark);
  rect(g, 7, 95, 32, 8, out);
  for (const k of [-6, 0, 6]) rect(g, 23 + k, 95, 1, 7, HP.gold);
  rect(g, 7, 103, 32, 1, HP.gold);
  for (const dx of [7, 23]) {
    rect(g, dx, 104, 16, 48, HP.gold);
    rect(g, dx + 1, 105, 14, 44, out);
    rect(g, dx + 2, 107, 1, 14, '#ffffff', night ? 0.12 : 0.4);
    rect(g, dx + 4, 109, 1, 8, '#ffffff', night ? 0.08 : 0.3);
    rect(g, dx + 1, 146, 14, 3, HP.goldDark);
  }
  rect(g, 21, 122, 1, 10, HP.goldHi);
  rect(g, 25, 122, 1, 10, HP.goldHi);
  rect(g, 4, 150, 38, 2, HP.woodDeep);

  // ---- a velvet armchair, a side table and a lamp
  const ax = 58;
  rect(g, ax, 128, 22, 16, '#2e5a48');
  rect(g, ax + 2, 118, 18, 14, '#356a54');
  rect(g, ax + 2, 118, 18, 1, '#4a8068');
  rect(g, ax - 2, 128, 5, 14, '#2a5040');
  rect(g, ax + 19, 128, 5, 14, '#2a5040');
  rect(g, ax + 3, 132, 16, 4, '#3e7460');
  rect(g, ax, 144, 2, 8, HP.woodDark);
  rect(g, ax + 20, 144, 2, 8, HP.woodDark);
  rect(g, 86, 138, 12, 2, HP.wood);
  rect(g, 91, 140, 2, 12, HP.woodDark);
  rect(g, 87, 150, 10, 2, HP.woodDark);
  rect(g, 91, 128, 2, 10, HP.goldDark);
  rect(g, 86, 120, 12, 8, '#f0e0b8');
  rect(g, 87, 119, 10, 1, '#f8ecd0');
  glow(g, 92, 126, 22, 0.4);

  // ---- columns framing the desk
  for (const px of [104, 216]) {
    rect(g, px - 5, 11, 10, 141, HP.cream);
    for (const f of [-3, 0, 3]) rect(g, px + f, 18, 1, 120, HP.creamShade);
    rect(g, px - 6, 11, 12, 5, HP.gold);
    rect(g, px - 6, 16, 12, 1, HP.goldDark);
    rect(g, px - 6, 140, 12, 12, HP.creamShade);
    rect(g, px - 6, 140, 12, 1, '#ffffff', 0.5);
    rect(g, px + 4, 11, 1, 141, '#000000', 0.08);
  }

  // ---- behind the desk: the sign, the clocks, the pigeonholes and the keys
  rect(g, 118, 22, 84, 14, HP.woodDark);
  rect(g, 119, 23, 82, 12, HP.wood);
  rect(g, 119, 23, 82, 1, HP.gold);
  rect(g, 119, 34, 82, 1, HP.goldDark);
  drawPixelText(g, 'RECEPTION', 160.5, 25, { scale: 1, color: '#2a1608', center: true });
  drawPixelText(g, 'RECEPTION', 160, 24, { scale: 1, color: HP.goldHi, center: true });
  for (const cx of [124, 196]) {
    rect(g, cx - 6, 44, 12, 12, HP.goldDark);
    rect(g, cx - 5, 45, 10, 10, HP.cream);
    rect(g, cx, 46, 1, 4, HP.ink);
    rect(g, cx, 50, 3, 1, HP.ink);
  }
  rect(g, 134, 42, 52, 34, HP.woodDark);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 6; c++) {
      const x = 136 + c * 8;
      const y = 44 + r * 8;
      rect(g, x, y, 7, 7, HP.woodDeep);
      rect(g, x, y + 6, 7, 1, HP.woodHi);
      if ((r * 6 + c) % 3 !== 1) {
        rect(g, x + 3, y + 1, 1, 3, HP.goldHi);
        rect(g, x + 2, y + 3, 3, 2, HP.gold);
      }
    }

  // ---- the clerk, behind it (unless nobody is)
  const cx = 160;
  if (!empty) clerk(g, cx);

  // ---- the desk: walnut panels, gold trim, a marble top
  desk(g);
  paintLobbyRest(g);
}

function clerk(g: Ctx, cx: number): void {
  rect(g, cx - 9, 98, 18, 22, HP.navy);
  rect(g, cx - 3, 98, 6, 10, '#f4f0e8');
  rect(g, cx - 1, 99, 2, 8, '#7b2a3a');
  rect(g, cx - 9, 98, 3, 22, '#1a2440');
  for (const by of [108, 113]) rect(g, cx + 4, by, 1, 1, HP.goldHi);
  rect(g, cx - 4, 87, 9, 11, '#e8b890');
  rect(g, cx - 5, 84, 11, 4, '#3a2414');
  rect(g, cx - 5, 87, 2, 4, '#3a2414');
  rect(g, cx - 2, 91, 1, 1, HP.ink);
  rect(g, cx + 2, 91, 1, 1, HP.ink);
  rect(g, cx - 1, 95, 3, 1, '#b07860');
}

function desk(g: Ctx): void {
  rect(g, 110, 116, 100, 4, HP.marble);
  rect(g, 110, 116, 100, 1, '#ffffff');
  rect(g, 110, 119, 100, 1, HP.marbleDark);
  rect(g, 114, 120, 92, 32, HP.wood);
  rect(g, 114, 120, 92, 2, HP.woodDark);
  rect(g, 114, 123, 92, 1, HP.gold);
  for (let k = 0; k < 3; k++) {
    const x = 120 + k * 28;
    rect(g, x, 127, 24, 20, HP.woodDark);
    rect(g, x + 1, 128, 22, 18, HP.woodHi);
    rect(g, x + 2, 129, 20, 16, HP.wood);
    rect(g, x + 10, 134, 4, 4, HP.gold);
  }
  rect(g, 114, 148, 92, 4, HP.woodDeep);
  // on it: a banker's lamp, the book, a bell, the lilies
  rect(g, 120, 112, 2, 4, HP.goldDark);
  rect(g, 116, 108, 10, 4, '#2e6a4a');
  rect(g, 116, 108, 10, 1, '#4a8a68');
  glow(g, 121, 113, 12, 0.45);
  rect(g, 140, 113, 14, 3, '#f4ecd6');
  rect(g, 147, 113, 1, 3, HP.creamShade);
  rect(g, 176, 113, 6, 3, HP.gold);
  rect(g, 178, 111, 2, 2, HP.goldHi);
  rect(g, 196, 106, 6, 10, '#c8dce8');
  rect(g, 197, 107, 1, 8, '#ffffff', 0.5);
  for (const [fx, fy] of [
    [195, 101],
    [199, 99],
    [202, 102],
  ])
    rect(g, fx, fy, 3, 3, '#f8e0ec');
  rect(g, 198, 103, 1, 4, '#4a7a3a');
}

function paintLobbyRest(g: Ctx): void {
  // ---- the staircase door, where the palm stood: a heavy fire door in a
  // walnut frame, a push bar, a wired-glass slit, the green running man over it
  stairDoor(g, STAIR_DOOR_X);

  // ---- the lift: brass surround, brushed steel doors, the dial above
  const lx = 280;
  rect(g, lx - 20, 92, 40, 60, HP.gold);
  rect(g, lx - 20, 92, 40, 1, HP.goldHi);
  rect(g, lx - 18, 94, 36, 58, HP.goldDark);
  for (const dx of [-17, 0]) {
    rect(g, lx + dx, 95, 17, 57, HP.steel);
    for (let k = 2; k < 17; k += 3) rect(g, lx + dx + k, 95, 1, 57, HP.steelHi, 0.5);
    rect(g, lx + dx, 95, 17, 1, HP.steelHi);
  }
  rect(g, lx, 95, 1, 57, HP.steelDark);
  // the floor dial
  rect(g, lx - 12, 76, 24, 12, HP.goldDark);
  rect(g, lx - 11, 77, 22, 10, HP.ink);
  // call buttons
  rect(g, 304, 116, 6, 12, HP.goldDark);
  rect(g, 305, 117, 4, 10, HP.gold);
  rect(g, 306, 119, 2, 2, '#ffd45e');
  rect(g, 306, 123, 2, 2, HP.goldHi);

  // ---- the chandeliers, and what they do to the room
  for (const chx of [56, 252, 380]) {
    rect(g, chx, 0, 1, 16, HP.goldDark);
    rect(g, chx - 12, 16, 25, 2, HP.gold);
    rect(g, chx - 8, 18, 17, 2, HP.goldDark);
    for (let k = -10; k <= 10; k += 5) {
      rect(g, chx + k, 13, 1, 3, HP.goldDark);
      rect(g, chx + k - 1, 11, 3, 2, '#fff6d8');
    }
    for (let k = -8; k <= 8; k += 4) rect(g, chx + k, 21 + (Math.abs(k) % 8 === 0 ? 1 : 3), 1, 2, '#e8f0ff');
    glow(g, chx + 0.5, 14, 46, 0.36);
    glow(g, chx + 0.5, 14, 14, 0.5);
  }
  sconce(g, 104, 62);
  sconce(g, 216, 62);
  glow(g, 160, 152, 90, 0.1);

  // ---- past the lift: a quiet end of the lobby, a luggage trolley, and the
  // storage room door
  luggageTrolley(g, 336);
  storageDoor(g, STORAGE_X);
  sconce(g, 404, 62);
}

/** A fire door into the stairwell, dressed for the lobby. */
function stairDoor(g: Ctx, cx: number): void {
  const w = 24;
  const x = cx - w / 2;
  rect(g, x - 3, 96, w + 6, 56, HP.woodDark);
  rect(g, x - 3, 96, w + 6, 1, HP.woodHi);
  rect(g, x - 1, 98, w + 2, 54, HP.woodDeep);
  rect(g, x, 99, w, 53, '#7a5a3a');
  rect(g, x + 1, 100, w - 2, 1, '#9a7a52');
  // panels
  rect(g, x + 3, 118, w - 6, 14, '#6a4a2e');
  rect(g, x + 3, 136, w - 6, 13, '#6a4a2e');
  // the narrow wired-glass window
  rect(g, x + 8, 102, 8, 13, HP.goldDark);
  rect(g, x + 9, 103, 6, 11, '#2a3440');
  for (let k = 0; k < 11; k += 3) rect(g, x + 9, 103 + k, 6, 1, '#4a5868', 0.7);
  rect(g, x + 11, 103, 1, 11, '#4a5868', 0.7);
  // push bar and kick plate
  rect(g, x + 2, 128, w - 4, 2, '#c8c8c0');
  rect(g, x + 2, 130, w - 4, 1, '#8a8a84');
  rect(g, x + 1, 147, w - 2, 4, HP.gold);
  // the exit sign over it, glowing green, and STAIRS on a plate
  rect(g, cx - 9, 86, 18, 7, '#0e5a2e');
  rect(g, cx - 8, 87, 16, 5, '#2ec466');
  rect(g, cx - 6, 88, 2, 3, '#e8ffe8');
  rect(g, cx - 4, 89, 3, 1, '#e8ffe8');
  rect(g, cx + 1, 88, 5, 3, '#e8ffe8', 0.8);
  glow(g, cx, 89, 16, 0.25);
  rect(g, cx - 10, 106, 1, 1, HP.ink);
  drawPixelText(g, 'STAIRS', cx, 77, { scale: 1, color: '#c8f0d0', center: true });
}

/** A brass luggage trolley, parked by the wall. */
function luggageTrolley(g: Ctx, cx: number): void {
  rect(g, cx - 12, 146, 24, 3, HP.gold);
  rect(g, cx - 12, 108, 2, 40, HP.gold);
  rect(g, cx + 10, 108, 2, 40, HP.gold);
  rect(g, cx - 12, 106, 24, 3, HP.goldHi);
  rect(g, cx - 9, 128, 12, 18, '#5a2a3a');
  rect(g, cx - 9, 128, 12, 1, '#7a3a4a');
  rect(g, cx + 2, 134, 8, 12, '#2a3a5a');
  rect(g, cx - 4, 125, 4, 3, HP.goldDark);
  for (const wx of [cx - 10, cx + 9]) {
    rect(g, wx - 1, 149, 3, 3, HP.ink);
  }
}

/** The storage room: a plain staff door with a small window in it. */
function storageDoor(g: Ctx, cx: number): void {
  const w = 22;
  const x = cx - w / 2;
  rect(g, x - 2, 98, w + 4, 54, HP.creamShade);
  rect(g, x, 100, w, 52, '#8a7e6a');
  rect(g, x + 1, 101, w - 2, 1, '#a89c86');
  rect(g, x, 100, 1, 52, '#6a604e');
  // the little window: dark inside, a mop handle and a bucket rim just showing
  rect(g, x + 6, 105, 10, 13, '#4a4436');
  rect(g, x + 7, 106, 8, 11, '#1a1c22');
  rect(g, x + 9, 106, 1, 11, '#8a6a3a');
  rect(g, x + 11, 113, 4, 4, '#c8a020');
  rect(g, x + 7, 106, 2, 4, '#ffffff', 0.12);
  // handle, kick plate, sign
  rect(g, x + w - 5, 126, 3, 2, HP.goldHi);
  rect(g, x + w - 4, 128, 1, 3, HP.goldDark);
  rect(g, x + 1, 147, w - 2, 4, '#6a604e');
  rect(g, cx - 17, 87, 34, 9, HP.goldDark);
  rect(g, cx - 16, 88, 32, 7, HP.ink);
  drawPixelText(g, 'STAFF', cx, 88, { scale: 1, color: '#c8c2b4', center: true });
}

// ============================================================ the corridor

export const CORRIDOR_DOORS = [90, 132, 174, 216, 258, 300];

export function paintCorridor(g: Ctx): void {
  const W = 320;
  rect(g, 0, 0, W, 11, '#3a2e26');
  crown(g, W);
  wallpaper(g, 0, 11, W, 96, { paper: HP.paper, shade: HP.paperShade, motif: HP.paperMotif });
  wainscot(g, 0, W, 108, 146);
  carpetFloor(g, W);
  // the lift you came up in
  const lx = 22;
  rect(g, lx - 18, 96, 36, 56, HP.gold);
  rect(g, lx - 16, 98, 32, 54, HP.goldDark);
  for (const dx of [-15, 0]) {
    rect(g, lx + dx, 99, 15, 53, HP.steel);
    for (let k = 2; k < 15; k += 3) rect(g, lx + dx + k, 99, 1, 53, HP.steelHi, 0.5);
  }
  rect(g, lx, 99, 1, 53, HP.steelDark);
  rect(g, lx - 10, 82, 20, 10, HP.goldDark);
  rect(g, lx - 9, 83, 18, 8, HP.ink);
  // and the stairs beside it: a fire door, the green sign
  const sx = 56;
  rect(g, sx - 12, 104, 24, 48, '#d8d4c8');
  rect(g, sx - 10, 106, 20, 46, '#8a9088');
  rect(g, sx - 10, 106, 20, 1, '#b0b6ae');
  rect(g, sx - 4, 112, 8, 10, '#3a4440');
  rect(g, sx - 3, 113, 6, 8, '#6a8088');
  rect(g, sx - 9, 128, 18, 2, '#c0c4c0');
  rect(g, sx - 14, 93, 28, 10, '#0e5a30');
  rect(g, sx - 13, 94, 26, 8, '#1a8a4a');
  drawPixelText(g, 'EXIT', sx + 0.5, 94, { scale: 1, color: '#e8ffe8', center: true });
  glow(g, sx, 99, 12, 0.3, '120,255,160');
  // the rooms
  CORRIDOR_DOORS.forEach((x, k) => roomDoor(g, x, `${607 + k}`));
  // between them: sconces, pictures, a console table
  CORRIDOR_DOORS.slice(0, -1).forEach((x, k) => {
    const mx = x + 21;
    sconce(g, mx, 52);
    if (k % 2 === 0) picture(g, mx - 8, 70, 16, 12, k % 4 === 0 ? 'lily' : 'land');
  });
  // the ceiling lights' pools down the wall
  for (let x = 40; x < W; x += 64) glow(g, x, 12, 30, 0.22);
}

// ============================================================ room 612

export const ROOM_WINDOW = { x: 96, y: 22, w: 128, h: 98 };
export const ROOM_DOOR_X = 22;
export const BATH_DOOR_X = 62;

/**
 * The room.  `lamp` lights the bedside lamps and the room; without it the
 * room is lit only by whatever comes round the curtains.
 */
export function paintRoom(g: Ctx): void {
  const W = 320;
  // soft warm walls: a pale stripe, cream panelling below
  rect(g, 0, 0, W, 9, HP.creamShade);
  rect(g, 0, 7, W, 1, HP.cream);
  rect(g, 0, 9, W, 2, '#000000', 0.1);
  wallpaper(g, 0, 11, W, 98, { paper: '#efe6d2', shade: '#e6dbc2', motif: '#d8c8a4' });
  wainscot(g, 0, W, 110, 146, '#e2d6bc', '#f4ecd8', '#c8b898');
  // the carpet: a quiet oatmeal, and a rug under the bed
  rect(g, 0, FLOOR_Y, W, 28, '#8a7a66');
  rect(g, 0, FLOOR_Y, W, 2, '#6a5a48');
  for (let y = FLOOR_Y + 4; y < 180; y += 4) for (let x = (y % 8) / 2; x < W; x += 6) rect(g, x, y, 1, 1, '#9a8a74');
  rect(g, 226, 158, 92, 16, '#7b2a3a');
  rect(g, 226, 158, 92, 1, HP.gold);
  rect(g, 226, 173, 92, 1, HP.gold);
  for (let x = 230; x < 316; x += 6) rect(g, x, 165, 2, 2, '#9a3a4c');

  // ---- the window: a deep cream frame, a sill, a seat under it
  const { x, y, w, h } = ROOM_WINDOW;
  rect(g, x - 6, y - 6, w + 12, h + 12, HP.cream);
  rect(g, x - 6, y - 6, w + 12, 1, '#ffffff');
  rect(g, x - 3, y - 3, w + 6, h + 6, HP.creamShade);
  // (the glass is left empty: the view goes behind this picture)
  g.clearRect(x, y, w, h);
  rect(g, x - 8, y + h + 3, w + 16, 4, HP.cream);
  rect(g, x - 8, y + h + 3, w + 16, 1, '#ffffff');
  rect(g, x - 8, y + h + 7, w + 16, 1, HP.creamShade);
  // the window seat: a cushion on a panelled box
  rect(g, x - 2, 128, w + 4, 18, '#d8ccb0');
  for (let k = 0; k < 4; k++) rect(g, x + 4 + k * 31, 132, 27, 11, '#e8dcc0');
  rect(g, x - 2, 124, w + 4, 5, '#5a7a8a');
  rect(g, x - 2, 124, w + 4, 1, '#7a9aaa');
  rect(g, x + 10, 118, 14, 7, '#e8c8a0');
  rect(g, x + 104, 118, 14, 7, '#7b2a3a');
  // the rail the curtains hang from
  rect(g, x - 16, y - 12, w + 32, 2, HP.gold);
  rect(g, x - 18, y - 13, 3, 4, HP.goldHi);
  rect(g, x + w + 15, y - 13, 3, 4, HP.goldHi);

  // ---- the door out, with its chain, and the bathroom door
  roomDoor(g, ROOM_DOOR_X, '', { w: 22, h: 48 });
  rect(g, ROOM_DOOR_X + 3, 122, 6, 1, HP.goldHi);
  rect(g, ROOM_DOOR_X + 2, 118, 2, 2, '#f4ecd6');
  rect(g, ROOM_DOOR_X + 1, 120, 5, 7, '#7b2a3a');
  roomDoor(g, BATH_DOOR_X, '', { w: 20, h: 46, white: true });

  // ---- the bed: an upholstered headboard, white sheets, a burgundy throw
  rect(g, 240, 102, 66, 34, '#3e5a6a');
  rect(g, 240, 102, 66, 2, '#5a7a8a');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) rect(g, 246 + c * 10 + (r % 2) * 5, 108 + r * 8, 1, 1, '#2a3e4a');
  rect(g, 238, 102, 2, 50, HP.woodDark);
  rect(g, 306, 102, 2, 50, HP.woodDark);
  rect(g, 236, 136, 74, 12, HP.wood);
  rect(g, 236, 136, 74, 1, HP.woodHi);
  rect(g, 238, 148, 3, 4, HP.woodDark);
  rect(g, 305, 148, 3, 4, HP.woodDark);
  rect(g, 236, 126, 74, 11, '#f6f2ea');
  rect(g, 236, 126, 74, 1, '#ffffff');
  rect(g, 244, 118, 18, 9, '#ffffff');
  rect(g, 244, 126, 18, 1, '#d8d4cc');
  rect(g, 266, 118, 18, 9, '#ffffff');
  rect(g, 266, 126, 18, 1, '#d8d4cc');
  rect(g, 288, 120, 12, 7, '#7b2a3a');
  rect(g, 288, 120, 12, 1, '#9a3a4c');
  rect(g, 268, 128, 42, 9, '#ece6da');
  rect(g, 268, 128, 1, 9, '#d8d0c0');
  rect(g, 292, 128, 18, 9, '#7b2a3a');
  rect(g, 292, 128, 18, 1, HP.gold);
  // nightstands and their lamps
  for (const nx of [228, 314]) {
    rect(g, nx - 7, 130, 14, 22, HP.wood);
    rect(g, nx - 7, 130, 14, 1, HP.woodHi);
    rect(g, nx - 5, 136, 10, 1, HP.woodDark);
    rect(g, nx - 1, 137, 2, 1, HP.gold);
    rect(g, nx - 1, 120, 2, 10, HP.goldDark);
    rect(g, nx - 2, 128, 4, 2, HP.gold);
    rect(g, nx - 5, 112, 10, 8, '#f4e6c4');
    rect(g, nx - 4, 111, 8, 1, '#fff4dc');
  }
  // a picture over the bed
  picture(g, 262, 62, 22, 16, 'lily');
  // the ceiling light
  rect(g, 160, 0, 1, 4, HP.goldDark);
  rect(g, 152, 4, 17, 3, '#f4ecd6');
}

/** The room's lamps and their light, painted over the room (only when lit). */
export function paintRoomLight(g: Ctx): void {
  for (const nx of [228, 314]) {
    glow(g, nx, 116, 34, 0.42);
    glow(g, nx, 116, 10, 0.6);
  }
  glow(g, 160, 6, 70, 0.2);
  glow(g, 270, 150, 60, 0.12);
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
    glow(g, mx, my, 26, when === 'late' ? 0.12 : 0.22, '200,210,255');
    g.fillStyle = when === 'late' ? '#a8acb8' : '#f0ecd8';
    g.beginPath();
    g.arc(mx, my, 7, 0, Math.PI * 2);
    g.fill();
    rect(g, mx - 3, my - 2, 2, 2, '#c8c4b0', 0.6);
    rect(g, mx + 2, my + 2, 2, 1, '#c8c4b0', 0.6);
  } else {
    glow(g, Math.round(w * 0.2), Math.round(h * 0.2), 30, 0.5, '255,240,180');
    for (const [cx, cy] of [
      [w * 0.55, h * 0.18],
      [w * 0.82, h * 0.3],
    ]) {
      rect(g, Math.round(cx) - 10, Math.round(cy), 20, 4, '#ffffff', 0.8);
      rect(g, Math.round(cx) - 6, Math.round(cy) - 3, 12, 3, '#ffffff', 0.8);
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
  for (const k of [1, 2]) rect(g, Math.round((w * k) / 3) - 1, 0, 3, h, mull);
  rect(g, 0, Math.round(h * 0.28), w, 2, mull);
  for (let k = 0; k < 3; k++) {
    const x0 = Math.round((w * k) / 3) + 6;
    for (let d = 0; d < 10; d++) rect(g, x0 + d, 10 + d * 2, 1, 2, '#ffffff', 0.06);
  }
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
  for (let x = 0; x < w; x += 6) {
    rect(g, x, 0, 2, h, hi);
    rect(g, x + 4, 0, 2, h, dark);
  }
  // the heading tape and rings
  rect(g, 0, 0, w, 4, dark);
  for (let x = 2; x < w; x += 6) rect(g, x, 0, 2, 2, '#c9a24a');
  // a gold hem
  rect(g, 0, h - 3, w, 2, '#c9a24a');
  rect(g, 0, h - 1, w, 1, '#8a6a24');
  // the leading edge catches the light
  const edge = side < 0 ? w - 1 : 0;
  rect(g, edge, 0, 1, h, '#b04a60');
}

// ============================================================ the bathroom

export const MIRROR = { x: 140, y: 46, w: 44, h: 46 };

export function paintBathroom(g: Ctx): void {
  const W = 320;
  // white subway tile to the ceiling, a burgundy band at the dado
  rect(g, 0, 0, W, FLOOR_Y, '#f2f0ea');
  for (let y = 0; y < FLOOR_Y; y += 5) {
    rect(g, 0, y, W, 1, '#d8d4cc');
    for (let x = (y / 5) % 2 ? 5 : 0; x < W; x += 10) rect(g, x, y, 1, 5, '#d8d4cc');
  }
  rect(g, 0, 104, W, 4, '#7b2a3a');
  rect(g, 0, 104, W, 1, '#9a3a4c');
  rect(g, 0, 108, W, 1, HP.gold);
  // floor: small black-and-white tiles
  for (let y = FLOOR_Y; y < 180; y += 4)
    for (let x = 0; x < W; x += 4) rect(g, x, y, 4, 4, ((x + y) / 4) % 2 ? '#2a2a2e' : '#e8e6e0');
  rect(g, 0, FLOOR_Y, W, 2, '#8a8a8a');
  // the door back to the room
  roomDoor(g, 22, '', { w: 20, h: 46, white: true });
  // a towel rail with towels
  rect(g, 70, 96, 30, 2, HP.steelHi);
  rect(g, 74, 98, 10, 22, '#f8f6f0');
  rect(g, 74, 116, 10, 1, '#7b2a3a');
  rect(g, 86, 98, 10, 18, '#f8f6f0');
  rect(g, 86, 112, 10, 1, '#7b2a3a');
  // the vanity: mirror in gold, a light bar, a marble top, a basin
  const m = MIRROR;
  rect(g, m.x - 3, m.y - 3, m.w + 6, m.h + 6, HP.goldDark);
  rect(g, m.x - 2, m.y - 2, m.w + 4, m.h + 4, HP.gold);
  g.clearRect(m.x, m.y, m.w, m.h);
  rect(g, m.x - 4, m.y - 12, m.w + 8, 5, HP.steel);
  for (let k = 0; k < 3; k++) rect(g, m.x + 4 + k * 16, m.y - 11, 6, 3, '#fff6d8');
  glow(g, m.x + m.w / 2, m.y - 9, 34, 0.38);
  rect(g, m.x - 10, 114, m.w + 20, 4, HP.marble);
  rect(g, m.x - 10, 114, m.w + 20, 1, '#ffffff');
  rect(g, m.x + 12, 112, 20, 3, '#ffffff');
  rect(g, m.x + 21, 106, 2, 6, HP.steelHi);
  rect(g, m.x + 21, 106, 6, 1, HP.steelHi);
  rect(g, m.x - 8, 118, m.w + 16, 34, HP.wood);
  rect(g, m.x - 8, 118, m.w + 16, 1, HP.woodHi);
  for (let k = 0; k < 2; k++) {
    rect(g, m.x - 5 + k * 31, 122, 27, 26, HP.woodDark);
    rect(g, m.x - 4 + k * 31, 123, 25, 24, HP.wood);
    rect(g, m.x + 8 + k * 31, 132, 4, 1, HP.gold);
  }
  // soap, a glass, a little orchid
  rect(g, m.x - 6, 111, 5, 3, '#f4c8dc');
  rect(g, m.x + 40, 108, 4, 6, '#c8dce8');
  rect(g, m.x + 47, 106, 4, 8, '#e8e2d6');
  rect(g, m.x + 46, 102, 3, 3, '#f8e0ec');
  // the toilet
  rect(g, 214, 118, 14, 20, '#f8f6f0');
  rect(g, 214, 118, 14, 1, '#ffffff');
  rect(g, 210, 136, 22, 6, '#f0eee8');
  rect(g, 212, 142, 18, 10, '#e8e6e0');
  rect(g, 226, 122, 2, 2, HP.steelHi);
  // the bath, with a shower curtain half drawn
  rect(g, 250, 128, 66, 24, '#f8f6f0');
  rect(g, 250, 128, 66, 2, '#ffffff');
  rect(g, 252, 150, 4, 2, HP.gold);
  rect(g, 310, 150, 4, 2, HP.gold);
  rect(g, 248, 40, 70, 2, HP.steelHi);
  for (let x = 250; x < 280; x += 4) {
    rect(g, x, 42, 3, 86, '#f4f2ec');
    rect(g, x + 3, 42, 1, 86, '#d8d4cc');
  }
  for (let y = 54; y < 120; y += 18) rect(g, 262, y, 3, 3, '#e8b0c8');
  rect(g, 300, 60, 2, 10, HP.steelHi);
  rect(g, 296, 58, 10, 3, HP.steel);
  // a small frosted window high up, the night in it
  rect(g, 216, 14, 24, 20, HP.cream);
  rect(g, 218, 16, 20, 16, '#3a4a6a');
  rect(g, 227, 16, 2, 16, HP.cream);
  glow(g, 160, 0, 80, 0.12);
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
