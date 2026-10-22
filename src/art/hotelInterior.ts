/**
 * ---- INSIDE LILY'S CONDOS.
 *
 * Every room of the building painted onto a canvas -- the side-on pixel
 * rooms the 2D scene walks (one 320x180 picture each) and the surfaces the
 * 3D corridor and stairwell are dressed in -- from ONE palette and one set of
 * materials, so the lobby you come in at and the corridor you run down at
 * three in the morning are the same block of flats:
 *
 *   warm grey paint on plaster walls, a darker lower wall and a steel
 *   bumper rail, white skirting;
 *   charcoal carpet tiles in the corridors, big porcelain tiles in the lobby;
 *   flush oak-veneer flat doors with a steel number plate and lever;
 *   brushed steel wherever a hand goes, and recessed downlights.
 *
 * The 2D rooms are drawn at one pixel per pixel with hard edges; the 3D
 * surfaces are the same designs drawn at texture resolution.
 */

import { drawPixelText } from '../render/pixelFont';

export const HP = {
  // the walls: warm grey paint
  paper: '#e2ded6',
  paperShade: '#d6d1c7',
  paperMotif: '#c8c2b6',
  // (once brass; brushed steel now -- handles, rails, plates, frames)
  gold: '#a8aeb4',
  goldHi: '#d8dce0',
  goldDark: '#6a7078',
  // light oak veneer: doors, desk fronts, furniture
  wood: '#b48a5a',
  woodDark: '#8a6640',
  woodHi: '#d0a878',
  woodDeep: '#5a4430',
  // charcoal carpet tiles
  carpet: '#4e525a',
  carpetDark: '#3a3d44',
  carpetHi: '#5e636c',
  // large-format porcelain tiles
  marble: '#d6d2ca',
  marbleVein: '#c6c2ba',
  marbleDark: '#aeaaa2',
  cream: '#f2f0ea',
  creamShade: '#d6d2c8',
  steel: '#a8acb0',
  steelHi: '#d4d8dc',
  steelDark: '#6a6e74',
  navy: '#22304e',
  ink: '#16100c',
  glow: '#fff0d0',
  // the lower wall, a shade darker than the paint above it
  lowerWall: '#c9c4ba',
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

/** Painted plaster: an even warm grey, the faintest texture in it. */
function wallpaper(g: Ctx, x0: number, y0: number, w: number, h: number, tone: { paper: string; shade: string; motif: string }): void {
  rect(g, x0, y0, w, h, tone.paper);
  for (let k = 0; k < (w * h) / 40; k++) {
    const x = x0 + ((k * 97) % w);
    const y = y0 + ((k * 61) % h);
    rect(g, x, y, 1, 1, k % 3 ? tone.shade : '#ffffff', 0.35);
  }
}

/** The ceiling line along the top of the wall: a shadow gap and a white edge. */
function crown(g: Ctx, w: number, h = 9): void {
  rect(g, 0, 0, w, h, '#f4f3ef');
  rect(g, 0, h - 1, w, 1, '#ffffff', 0.7);
  rect(g, 0, h, w, 2, '#000000', 0.14);
}

/**
 * The lower wall: a shade darker than the paint above it (it takes the
 * knocks), a steel bumper rail on top at hip height, white skirting.  (The
 * colours a room passes are its lower-wall tone, the rail's light and dark.)
 */
function wainscot(g: Ctx, x0: number, w: number, top: number, bottom: number, wood = HP.lowerWall, hi = HP.steelHi, dark = HP.steelDark): void {
  const lower = wood === HP.wood ? HP.lowerWall : wood;
  rect(g, x0, top, w, bottom - top, lower);
  for (let k = 0; k < (w * (bottom - top)) / 50; k++) rect(g, x0 + ((k * 83) % w), top + ((k * 29) % (bottom - top)), 1, 1, '#ffffff', 0.18);
  // the bumper rail
  rect(g, x0, top - 3, w, 3, HP.steel);
  rect(g, x0, top - 3, w, 1, hi === HP.woodHi ? HP.steelHi : hi);
  rect(g, x0, top - 1, w, 1, dark === HP.woodDark ? HP.steelDark : dark);
  // white skirting
  rect(g, x0, bottom, w, FLOOR_Y - bottom, '#f4f3ef');
  rect(g, x0, bottom, w, 1, '#ffffff');
  rect(g, x0, FLOOR_Y - 1, w, 1, '#c8c4bc');
}

/** The corridor carpet: charcoal tiles, laid quarter-turned, flecked. */
function carpetFloor(g: Ctx, w: number, c = { base: HP.carpet, dark: HP.carpetDark, hi: HP.carpetHi }): void {
  rect(g, 0, FLOOR_Y, w, 180 - FLOOR_Y, c.base);
  for (let y = FLOOR_Y; y < 180; y += 8) {
    for (let x = 0, k = 0; x < w; x += 12, k++) {
      const along = ((y - FLOOR_Y) / 8 + k) % 2 === 0;
      for (let d = 1; d < 8; d += 2) rect(g, x, y + d, 12, 1, along ? c.hi : c.dark, 0.35);
      rect(g, x, y, 1, 8, c.dark, 0.6);
    }
    rect(g, 0, y, w, 1, c.dark, 0.6);
  }
  for (let k = 0; k < w; k++) rect(g, (k * 37) % w, FLOOR_Y + 2 + ((k * 11) % 26), 1, 1, '#8a8e96', 0.4);
  rect(g, 0, FLOOR_Y, w, 2, c.dark);
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
 * A tiny 3x5 sign font, drawn pixel by pixel: the house pixel font smears at
 * plate size, these stay crisp.  Digits and the letters the signs need.
 */
const GLYPH: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '011', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  E: ['111', '100', '110', '100', '111'],
  X: ['101', '101', '010', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  T: ['111', '010', '010', '010', '010'],
};
function signText(g: Ctx, text: string, cx: number, y: number, color: string): void {
  const w = text.length * 4 - 1;
  let x = Math.round(cx - w / 2);
  for (const ch of text) {
    const rows = GLYPH[ch];
    if (rows) rows.forEach((row, r) => [...row].forEach((b, c) => b === '1' && rect(g, x + c, y + r, 1, 1, color)));
    x += 4;
  }
}

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
  // a plain white architrave
  rect(g, x - 2, y - 2, w + 4, h + 2, '#f4f3ef');
  rect(g, x - 2, y - 2, w + 4, 1, '#ffffff');
  rect(g, x - 1, y - 1, w + 2, h + 1, HP.creamShade);
  // the door: a flush slab, its veneer running top to bottom
  rect(g, x, y, w, h, face);
  for (let k = 2; k < w - 1; k += 3) rect(g, x + k, y, 1, h, dark, 0.18);
  rect(g, x, y, w, 1, hi);
  rect(g, x, y, 1, h, hi, 0.6);
  rect(g, x + w - 1, y, 1, h, dark);
  // a lever handle in steel, and the lock rose under it
  rect(g, x + w - 3, y + Math.round(h * 0.5) - 1, 1, 3, HP.steelDark);
  rect(g, x + w - 6, y + Math.round(h * 0.5) - 1, 4, 1, HP.steelHi);
  rect(g, x + w - 3, y + Math.round(h * 0.5) + 4, 1, 1, HP.steelDark);
  // the flat's number on a steel plate, and the spy hole over it
  if (num) {
    const pw = num.length * 4 + 1;
    const px = Math.round(cx - pw / 2);
    const py = y + 6;
    rect(g, px - 1, py - 1, pw + 2, 9, HP.steelDark);
    rect(g, px, py, pw, 7, HP.steelHi);
    rect(g, px, py + 6, pw, 1, HP.steel);
    signText(g, num, cx, py + 1, '#1a1c20');
    rect(g, Math.round(cx), py - 3, 1, 1, HP.ink);
  } else if (!opts.white) rect(g, x + Math.round(w / 2), y + 8, 1, 1, HP.ink);
}

/**
 * Room 612 after the night: the door smashed in off its hinges.  The frame
 * stands, the doorway is dark, the door hangs from its top hinge on the
 * splintered jamb, and the wood he went through is on the carpet.  After the
 * police, a strip of tape across it.
 */
function brokenDoor(g: Ctx, cx: number, num: string, taped: boolean): void {
  const w = DOOR_W;
  const h = DOOR_H;
  const x = Math.round(cx - w / 2);
  const y = FLOOR_Y - h;
  rect(g, x - 2, y - 2, w + 4, h + 2, HP.cream);
  rect(g, x - 1, y - 1, w + 2, h + 1, HP.creamShade);
  // the room behind: dark, a sliver of the window's light on the floor
  rect(g, x, y, w, h, '#120d0a');
  rect(g, x + 3, FLOOR_Y - 3, w - 6, 3, '#2a2230');
  // splinters torn out of the lock side of the jamb
  for (const [dy, len] of [[10, 3], [15, 2], [18, 4], [24, 2]]) rect(g, x + w - len, y + dy, len, 1, HP.woodHi);
  rect(g, x + w + 1, y + 13, 1, 9, HP.woodDark);
  // the door, torn off the lower hinge: hanging from the top one on the
  // left, its foot swung out into the corridor and resting on the carpet
  for (let r = 0; r < h - 1; r++) {
    const lean = -Math.round((r / h) ** 1.4 * 6);
    rect(g, x + lean, y + r, 11, 1, r % 11 === 0 ? HP.woodDark : HP.wood);
    rect(g, x + lean, y + r, 1, 1, HP.woodHi);
    rect(g, x + lean + 10, y + r, 1, 1, HP.woodDark);
  }
  // a split down it, and a fist-sized hole through the top panel
  for (let r = 6; r < 24; r++) rect(g, x + 6 - Math.round((r / h) ** 1.4 * 6) + (r % 3 === 0 ? 1 : 0), y + r, 1, 1, '#120d0a');
  rect(g, x + 4, y + 14, 3, 3, '#120d0a');
  // the plate, still on what is left of it, crooked
  const pw = num.length * 4 + 1;
  rect(g, x - 1, y + 3, pw + 2, 9, HP.goldDark);
  rect(g, x, y + 4, pw, 7, HP.gold);
  signText(g, num, x + pw / 2, y + 5, '#24160a');
  // the wood on the carpet
  for (const [dx, dy, len] of [[-6, 0, 4], [-2, -1, 2], [w - 2, 0, 5], [w + 4, -1, 2], [3, 1, 3], [w + 1, 1, 2]]) {
    rect(g, x + dx, FLOOR_Y + dy, len, 1, HP.wood);
    rect(g, x + dx, FLOOR_Y + dy + 1, len, 1, HP.woodDark);
  }
  if (taped) {
    // POLICE LINE: two strips crossed over the doorway, pinned to the frame
    for (let k = 0; k <= w + 2; k++) {
      const c = (k >> 1) % 2 ? '#f0c814' : '#1a1a10';
      rect(g, x - 1 + k, y + 15 + Math.round(k * 0.6), 1, 2, c);
      rect(g, x - 1 + k, y + 25 - Math.round(k * 0.6), 1, 2, c);
    }
  }
}

/** A wall light: a slim steel cylinder washing light up and down the paint. */
function sconce(g: Ctx, x: number, y: number, lit = true): void {
  rect(g, x - 1, y - 2, 3, 7, HP.steelDark);
  rect(g, x - 1, y - 2, 1, 7, HP.steelHi);
  rect(g, x - 1, y - 3, 3, 1, lit ? '#fff6dc' : HP.steel);
  rect(g, x - 1, y + 5, 3, 1, lit ? '#fff6dc' : HP.steel);
  if (lit) {
    glow(g, x + 0.5, y - 6, 9, 0.22);
    glow(g, x + 0.5, y + 8, 9, 0.22);
  }
}

/** A framed print: thin black frame, a white mount, abstract blocks or a photo of the coast. */
function picture(g: Ctx, x: number, y: number, w: number, h: number, kind: 'lily' | 'land'): void {
  rect(g, x - 1, y - 1, w + 2, h + 2, '#1e2024');
  rect(g, x, y, w, h, '#f6f5f0');
  const ix = x + 1;
  const iy = y + 1;
  const iw = w - 2;
  const ih = h - 2;
  if (kind === 'lily') {
    rect(g, ix + 1, iy + 1, Math.ceil(iw / 2), ih - 2, '#d8a04a');
    rect(g, ix + Math.ceil(iw / 2), iy + 2, Math.floor(iw / 2) - 1, Math.ceil(ih / 2), '#3a6a8a');
    rect(g, ix + 2, iy + ih - 3, iw - 3, 1, '#2a2a2e');
  } else {
    rect(g, ix, iy, iw, Math.ceil(ih * 0.55), '#9ac0d8');
    rect(g, ix, iy + Math.ceil(ih * 0.55), iw, ih - Math.ceil(ih * 0.55), '#3a6a8a');
    rect(g, ix, iy + Math.ceil(ih * 0.55), iw, 1, '#f0f0e8');
  }
}

/** Large porcelain tiles: a warm grey, fine grout, a soft sheen. */
function marbleFloor(g: Ctx, w: number): void {
  rect(g, 0, FLOOR_Y, w, 180 - FLOOR_Y, HP.marble);
  for (let y = FLOOR_Y; y < 180; y += 9) {
    rect(g, 0, y, w, 1, HP.marbleDark, 0.6);
    for (let x = 0; x < w; x += 24) rect(g, x, y, 1, 9, HP.marbleDark, 0.6);
  }
  for (let k = 0; k < 60; k++) rect(g, (k * 53) % w, FLOOR_Y + 2 + ((k * 7) % 24), 1, 1, HP.marbleVein, 0.7);
  rect(g, 0, FLOOR_Y, w, 2, '#8a867e', 0.5);
}

/** A shadow-gap ceiling line at any height. */
function crownAt(g: Ctx, w: number, y: number, h = 4): void {
  rect(g, 0, y, w, h, '#f4f3ef');
  rect(g, 0, y + h - 1, w, 1, '#ffffff', 0.7);
  rect(g, 0, y + h, w, 1, '#000000', 0.14);
}

/**
 * The ceiling, seen from inside the room: a plaster ceiling running back to
 * the cornice, coffered between beams that come towards you, darkening as it
 * gets nearer the eye, with a heavy header across the very top -- the room
 * is closed in.  Nothing of the outside shows except through a window.
 */
function enclosedCeiling(g: Ctx, w: number, opts: { plaster?: string; beam?: string; lights?: number[] } = {}): void {
  const plaster = opts.plaster ?? '#e8e6e0';
  const top = 6;
  // flat white plaster, light by the far wall and dimmer towards us
  for (let y = top; y < CEIL_Y; y++) {
    const k = (y - top) / (CEIL_Y - top);
    rect(g, 0, y, w, 1, plaster);
    rect(g, 0, y, w, 1, '#10141c', 0.55 * (1 - k) * (1 - k) + 0.06);
  }
  // faint plasterboard joints running towards us, fanning from the far wall
  const cx = w / 2;
  for (let bx = -w; bx <= 2 * w; bx += 80) {
    for (let y = top; y < CEIL_Y; y++) {
      const k = (y - top) / (CEIL_Y - top);
      const x = Math.round(cx + (bx - cx) * (1.9 - 0.9 * k));
      rect(g, x, y, 1, 1, '#000000', 0.07);
    }
  }
  // rows of recessed downlights going away: bigger and further apart near us
  for (const k of [0.22, 0.5, 0.72, 0.88]) {
    const y = Math.round(top + k * (CEIL_Y - top));
    const r = k < 0.4 ? 3 : k < 0.8 ? 2 : 1;
    rect(g, 0, y + r, w, 1, '#000000', 0.05);
    for (let bx = -w; bx <= 2 * w; bx += 80) {
      const x = Math.round(cx + (bx - cx) * (1.9 - 0.9 * k) + 40 * (1.9 - 0.9 * k));
      if (x < -4 || x > w + 4) continue;
      rect(g, x - r - 1, y - 1, 2 * r + 3, r + 2, '#b8bcc2');
      rect(g, x - r, y, 2 * r + 1, r, '#fffaf0');
      glow(g, x, y + 2, 6 + r * 4, 0.12 + k * 0.08);
    }
  }
  for (const lx of opts.lights ?? []) {
    rect(g, lx - 2, CEIL_Y - 8, 5, 1, '#fffaf0');
    glow(g, lx, CEIL_Y - 8, 20, 0.3);
  }
  // the bulkhead nearest the eye, and the shadow gap where ceiling meets wall
  rect(g, 0, 0, w, top, '#3a3d44');
  rect(g, 0, top - 1, w, 1, '#5a5e66');
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
  // the balcony runs across the side bays only; the middle bay is open
  for (const sx of doors.filter((_, k) => k % 2 === 0)) sconce(g, sx + 14, floor - 26);
  // the slab edge, with the light along its underside
  rect(g, 0, floor, W, 4, HP.cream);
  rect(g, 0, floor, W, 1, '#ffffff', 0.7);
  rect(g, 0, floor + 3, W, 1, HP.goldDark);
  rect(g, 0, floor + 4, W, 1, '#000000', 0.15);
  // the balustrade: glass panels in a steel shoe, a steel handrail
  rect(g, 0, floor - 13, W, 11, '#bcd8e4', 0.32);
  for (let x = 0; x < W; x += 24) rect(g, x, floor - 13, 1, 11, '#ffffff', 0.35);
  rect(g, 0, floor - 14, W, 2, HP.gold);
  rect(g, 0, floor - 14, W, 1, HP.goldHi);
  rect(g, 0, floor - 2, W, 2, HP.steelDark);
}

export function paintLobby(g: Ctx, night: boolean, empty = false, evening = false): void {
  const W = LOBBY_W;
  crown(g, W);
  for (let x = 0; x < W; x += 12) rect(g, x, 0, 1, 7, HP.goldDark, 0.5);
  wallpaper(g, 0, 11, W, DADO - 14, { paper: HP.paper, shade: HP.paperShade, motif: HP.paperMotif });
  // ---- the atrium: two guest floors on galleries round it
  // guest doors only in the side bays: over the desk the atrium is open
  const doors = [24, 60, 252, 300, 338, 384];
  gallery(g, W, 48, doors);
  gallery(g, W, 98, doors);
  // ---- the middle bay, over the desk: open to the full height of the
  // atrium.  The balconies stop at the columns with a carved return; behind
  // the desk, tall panelling, a pair of arched mirrors and the great
  // chandelier hanging through all three storeys.
  rect(g, 109, 11, 102, 92, HP.paper);
  wallpaper(g, 109, 11, 102, 92, { paper: HP.paper, shade: HP.paperShade, motif: HP.paperMotif });
  // the building's name in brushed letters on the wall of the atrium
  drawPixelText(g, "LILY'S", 160.5, 18, { scale: 1, color: HP.goldDark, center: true });
  drawPixelText(g, 'CONDOS', 160.5, 27, { scale: 1, color: HP.goldDark, center: true });
  // a cluster of glass pendants, hung at different lengths through the atrium
  for (const [px, len] of [[150, 40], [160, 52], [170, 44], [155, 60], [166, 34]] as const) {
    rect(g, px, 0, 1, len, '#3a3d44');
    rect(g, px - 2, len, 5, 4, '#e8eef2');
    rect(g, px - 1, len + 4, 3, 1, '#fff6dc');
    glow(g, px + 0.5, len + 3, 12, 0.3);
  }
  glow(g, 160.5, 52, 50, 0.22);
  wainscot(g, 0, W, DADO, WAIN_BOTTOM);
  marbleFloor(g, W);
  // the entrance mat, sunk into the tiles inside the doors
  rect(g, 6, 160, 46, 12, '#3a3d44');
  for (let x = 8; x < 50; x += 3) rect(g, x, 161, 1, 10, '#4e525a');

  // ---- the front doors: glass and brass, the night (or the day) in them
  const out = night ? '#0c1426' : evening ? '#d0805e' : '#9ac8e0';
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
  rect(g, ax + 1, 137, 14, 8, '#6a7078');
  rect(g, ax + 1, 137, 14, 1, '#8a9098');
  rect(g, ax, 143, 16, 5, '#5a6068');
  rect(g, ax - 1, 141, 3, 7, '#4e545c');
  rect(g, ax + 14, 141, 3, 7, '#4e545c');
  rect(g, ax + 2, 143, 12, 1, '#7a8088');
  rect(g, ax, 148, 1, 4, HP.woodDark);
  rect(g, ax + 15, 148, 1, 4, HP.woodDark);
  rect(g, 78, 142, 8, 1, HP.wood);
  rect(g, 81, 143, 2, 8, HP.woodDark);
  rect(g, 79, 151, 6, 1, HP.woodDark);
  rect(g, 81, 138, 2, 4, HP.goldDark);
  rect(g, 79, 134, 6, 4, '#f4f2ec');
  rect(g, 80, 133, 4, 1, '#ffffff');
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

  // ---- behind the desk: the sign under the gallery, the residents' mailboxes
  rect(g, 132, 105, 56, 9, '#2a2d33');
  rect(g, 133, 106, 54, 7, '#3a3d44');
  drawPixelText(g, 'CONCIERGE', 160, 106, { scale: 1, color: '#e8eaec', center: true });
  // the intercom panels either side
  for (const cx of [124, 196]) {
    rect(g, cx - 3, 118, 7, 9, HP.steelDark);
    rect(g, cx - 2, 119, 5, 7, HP.steelHi);
    rect(g, cx - 1, 120, 3, 2, '#2a3a4a');
    for (let k = 0; k < 2; k++) rect(g, cx - 1 + k * 2, 123, 1, 1, HP.steelDark);
  }
  // the mailboxes: a steel wall of little numbered doors
  rect(g, 137, 117, 46, 18, HP.steelDark);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++) {
      const x = 138 + c * 5 + (c >= 4 ? 4 : 0);
      const y = 118 + r * 5;
      rect(g, x, y, 4, 4, HP.steel);
      rect(g, x, y, 4, 1, HP.steelHi);
      rect(g, x + 1, y + 2, 2, 1, '#3a3d44');
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
  rect(g, x - 3, top, w + 6, 3, '#f4f3ef');
  rect(g, x - 3, top, w + 6, 1, '#ffffff');
  rect(g, x - 3, top + 2, w + 6, 1, '#c8c4bc');
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
  // a monitor for the parcel log, its stand
  rect(g, x + 2, top - 8, 10, 6, '#1e2024');
  rect(g, x + 3, top - 7, 8, 4, '#4a7a9a');
  rect(g, x + 6, top - 2, 2, 2, '#3a3d44');
  glow(g, x + 7, top - 5, 8, 0.25, '160,200,255');
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

  // ---- pendant lights down the atrium
  for (const chx of [56, 252, 380]) {
    rect(g, chx, 0, 1, 62, '#3a3d44');
    rect(g, chx - 5, 62, 11, 3, '#2a2d33');
    rect(g, chx - 4, 65, 9, 1, '#fff6dc');
    glow(g, chx + 0.5, 66, 30, 0.3);
    glow(g, chx + 0.5, 66, 10, 0.45);
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

/** The parcel lockers by the wall: a bank of steel doors, a little screen. */
function luggageTrolley(g: Ctx, cx: number): void {
  rect(g, cx - 12, 120, 24, 32, HP.steelDark);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 3; c++) {
      const x = cx - 11 + c * 8;
      const y = 121 + r * 7;
      rect(g, x, y, 7, 6, HP.steel);
      rect(g, x, y, 7, 1, HP.steelHi);
      rect(g, x + 5, y + 3, 1, 1, '#3a3d44');
    }
  rect(g, cx - 3, 115, 6, 4, '#1e2024');
  rect(g, cx - 2, 116, 4, 2, '#5aa0c8');
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
  drawPixelText(g, 'STORE', cx, y - 10, { scale: 1, color: '#c8c2b4', center: true });
}

/**
 * Unit 612's door as the landlord's card shows it: a stretch of the Level 6
 * wall -- the paint, the bumper rail, the skirting, the carpet -- with the
 * walnut door in its white architrave, the steel number plate and spy hole,
 * the lever handle, a kick plate, a sconce beside it and a mat in front.
 */
export function paintUnitDoor(g: Ctx, w: number, h: number, num = '612'): void {
  const floor = h - 7;
  wallpaper(g, 0, 0, w, floor, { paper: HP.paper, shade: HP.paperShade, motif: HP.paperMotif });
  // the lower wall and its bumper rail, the skirting
  rect(g, 0, floor - 14, w, 11, HP.lowerWall);
  rect(g, 0, floor - 17, w, 3, HP.steel);
  rect(g, 0, floor - 17, w, 1, HP.steelHi);
  rect(g, 0, floor - 15, w, 1, HP.steelDark);
  rect(g, 0, floor - 3, w, 3, '#f4f3ef');
  rect(g, 0, floor - 1, w, 1, '#c8c4bc');
  // the carpet
  rect(g, 0, floor, w, h - floor, HP.carpet);
  for (let y = floor + 1; y < h; y += 2) rect(g, 0, y, w, 1, HP.carpetHi, 0.35);
  for (let x = 0; x < w; x += 12) rect(g, x, floor, 1, h - floor, HP.carpetDark, 0.6);
  const cx = Math.round(w / 2);
  const dw = 20;
  const dh = 38;
  // the light from the sconce down the wall, and the door's shadow on it
  glow(g, cx + 19, floor - 27, 16, 0.3);
  rect(g, cx + dw / 2 + 2, floor - dh - 1, 2, dh + 1, '#000000', 0.12);
  roomDoor(g, cx, num, { w: dw, h: dh, floor });
  const x = cx - dw / 2;
  const y = floor - dh;
  // two raised panels in the veneer, catching the light on their top edges
  for (const [py, ph] of [[y + 16, 9], [y + 27, 8]]) {
    rect(g, x + 3, py, dw - 6, ph, HP.woodDark, 0.35);
    rect(g, x + 4, py + 1, dw - 8, ph - 2, HP.wood);
    rect(g, x + 4, py + 1, dw - 8, 1, HP.woodHi);
  }
  // a brushed kick plate along the foot, and the threshold
  rect(g, x + 1, floor - 4, dw - 2, 3, HP.steel);
  rect(g, x + 1, floor - 4, dw - 2, 1, HP.steelHi);
  rect(g, x - 2, floor, dw + 4, 1, HP.steelDark);
  // the card reader beside the handle, its light green
  rect(g, x + dw + 3, y + 17, 3, 6, HP.ink);
  rect(g, x + dw + 4, y + 18, 1, 1, '#5adc8a');
  sconce(g, cx + 19, floor - 27);
  // the mat in front of it
  rect(g, cx - 9, floor + 2, 18, 3, '#5a4434');
  rect(g, cx - 9, floor + 2, 18, 1, '#7a5e48');
}

// ============================================================ the corridor

export const CORRIDOR_DOORS = [90, 132, 174, 216, 258, 300];

export function paintCorridor(g: Ctx, broken612: 'none' | 'broken' | 'taped' = 'none', floor = 6): void {
  const W = 320;
  wallpaper(g, 0, CEIL_Y, W, DADO - CEIL_Y, { paper: HP.paper, shade: HP.paperShade, motif: HP.paperMotif });
  enclosedCeiling(g, W, { lights: [80, 240] });
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
  // EXIT: a lit box sign bolted to the wall right on top of the door frame
  rect(g, sx - 11, 106, 22, 10, '#0a2a18');
  rect(g, sx - 10, 107, 20, 8, '#0e5a30');
  rect(g, sx - 9, 108, 18, 6, '#16a050');
  rect(g, sx - 9, 108, 18, 1, '#5ad890');
  signText(g, 'EXIT', sx, 108, '#ffffff');
  glow(g, sx, 111, 12, 0.3, '120,255,160');
  // the rooms
  // (Level 6: 607 to 612, yours at the end.  Level 2: five flats, 211 to
  // 215, 213 in the middle -- and where the sixth would be, a print)
  CORRIDOR_DOORS.forEach((x, k) => {
    if (floor !== 6 && k === 5) {
      picture(g, x - 6, 116, 12, 10, 'lily');
      return;
    }
    if (floor === 6 && k === 5 && broken612 !== 'none') brokenDoor(g, x, '612', broken612 === 'taped');
    else roomDoor(g, x, floor === 6 ? `${607 + k}` : `${floor}${11 + k}`);
  });
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
export const BED = { x: 268, w: 36, top: 158 };

/**
 * The room.  `lamp` lights the bedside lamps and the room; without it the
 * room is lit only by whatever comes round the curtains.
 */
export function paintRoom(g: Ctx, furnished = true): void {
  const W = 320;
  // soft warm walls: a pale stripe, cream panelling below
  // the flat: plain painted walls, the same paint all the way down
  wallpaper(g, 0, CEIL_Y, W, FLOOR_Y - CEIL_Y, { paper: '#e6e2da', shade: '#dad6cc', motif: '#ccc6ba' });
  enclosedCeiling(g, W, { lights: [80, 240] });
  rect(g, 0, WAIN_BOTTOM, W, FLOOR_Y - WAIN_BOTTOM, '#f4f3ef');
  rect(g, 0, WAIN_BOTTOM, W, 1, '#ffffff');
  // oak laminate, long boards (no rug: the bag lies on the boards)
  for (let y = FLOOR_Y; y < 180; y += 4) {
    const row = (y - FLOOR_Y) / 4;
    rect(g, 0, y, W, 4, row % 2 ? '#a88660' : '#b08e66');
    rect(g, 0, y, W, 1, '#8a6a48', 0.7);
    for (let x = (row * 37) % 56; x < W; x += 56) rect(g, x, y, 1, 4, '#8a6a48');
  }

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
  rect(g, ROOM_DOOR_X - 6, 128, 3, 6, '#3a7a80');
  rect(g, ROOM_DOOR_X - 6, 127, 2, 1, '#f4ecd6');
  roomDoor(g, BATH_DOOR_X, '', { w: 15, white: true });

  // (the flat comes without the bed, its lamps or the picture: bought, then put in)
  if (!furnished) {
    rect(g, 157, CEIL_Y + 3, 7, 1, '#fffaf0');
    return;
  }
  // ---- the bed is a SLEEPING BAG: what the unit comes with, the same one
  // the condo's furniture draws (see art/furnitureArt) -- rolled out on the
  // boards, the hood and its folded pillow at the right-hand end, puffed
  // channels between the stitching, a sheen along the top, the zip and pull.
  const bx = BED.x - BED.w / 2;
  const T = BED.top;
  const H = 6;
  const hood = 8;
  rect(g, bx, T + H + 1, BED.w, 1, '#000000', 0.18);
  rect(g, bx - 1, T - 1, BED.w + 2, H + 2, '#1a2420');
  rect(g, bx, T, BED.w, H, '#3a6a5a');
  for (let k = 0; k < 6; k++) {
    const x0 = bx + Math.round((BED.w * k) / 6) + 1;
    const x1 = bx + Math.round((BED.w * (k + 1)) / 6);
    rect(g, x0 + 1, T + 1, Math.max(1, x1 - x0 - 2), 1, '#5c8c7a');
    rect(g, x0, T + 2, x1 - x0, 1, '#467868', 0.6);
    rect(g, x1 - 1, T + 1, 1, H - 3, '#2e5a4c', 0.7);
    if (k > 0) for (let yy = T + 1; yy < T + H - 2; yy += 2) rect(g, x0 - 1, yy, 1, 1, '#24483c');
  }
  rect(g, bx + 2, T + 1, Math.round(BED.w * 0.55), 1, '#ffffff', 0.16);
  rect(g, bx + 1, T + H - 2, BED.w - 2, 1, '#26304a');
  rect(g, bx + 2, T + H - 2, BED.w - 4, 1, '#b8bcc4');
  rect(g, bx + BED.w - hood - 3, T + H - 3, 2, 2, '#d8dce2');
  const hx = bx + BED.w - hood;
  rect(g, hx - 1, T - 2, hood + 2, H + 3, '#121828');
  rect(g, hx, T - 1, hood, H + 1, '#2a3450');
  rect(g, hx + 1, T - 1, hood - 2, 1, '#3e4a6a');
  rect(g, hx, T - 1, 1, H, '#5a8a7a');
  rect(g, hx + hood - 1, T - 1, 1, H, '#1c2438');
  rect(g, hx + 2, T - 3, hood - 4, H - 2, '#eeeae0');
  rect(g, hx + 2, T - 3, hood - 4, 1, '#ffffff');
  rect(g, hx + 2, T + H - 6, hood - 4, 1, '#cfc8b8');
  rect(g, hx + 4, T - 2, 1, H - 4, '#d8d2c4', 0.8);
  // (no nightstands, lamps or picture: the room is bare until you buy them)
  // the ceiling light
  rect(g, 157, CEIL_Y + 3, 7, 1, '#fffaf0');
}

/** The room's lamps and their light, painted over the room (only when lit). */
export function paintRoomLight(g: Ctx, furnished = true): void {
  if (!furnished) {
    glow(g, 160, CEIL_Y + 6, 56, 0.2);
    return;
  }
  glow(g, 160, CEIL_Y + 6, 56, 0.2);
  glow(g, BED.x, 150, 44, 0.08);
}

/** The view out: the night, the morning, or three in the morning. */
export function paintView(g: Ctx, w: number, h: number, when: 'night' | 'day' | 'late' | 'evening'): void {
  const sky = g.createLinearGradient(0, 0, 0, h);
  const eve = when === 'evening';
  if (eve) {
    // the sun going down: violet overhead, through rose to amber on the trees
    sky.addColorStop(0, '#3a2c62');
    sky.addColorStop(0.45, '#b45a6e');
    sky.addColorStop(0.8, '#f09a5a');
    sky.addColorStop(1, '#ffc878');
  } else if (when === 'day') {
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
  const night = when === 'night' || when === 'late';
  if (eve) {
    // a low orange sun sinking into the forest, and long thin clouds lit from under
    const sx = Math.round(w * 0.3);
    const sy = Math.round(h * 0.56);
    glow(g, sx, sy, Math.max(8, h * 0.45), 0.55, '255,170,90');
    g.fillStyle = '#ffe2a0';
    g.beginPath();
    g.arc(sx, sy, Math.max(2, h * 0.09), 0, Math.PI * 2);
    g.fill();
    for (const [cx, cy] of [
      [w * 0.6, h * 0.22],
      [w * 0.82, h * 0.34],
    ]) {
      rect(g, Math.round(cx - w * 0.1), Math.round(cy), Math.round(w * 0.2), 1, '#ffb07a', 0.8);
      rect(g, Math.round(cx - w * 0.06), Math.round(cy) - 1, Math.round(w * 0.12), 1, '#e07a7a', 0.7);
    }
  } else if (night) {
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
  const far = night ? '#101a22' : eve ? '#3a3a3e' : '#4a7a5a';
  const near = night ? '#060c10' : eve ? '#1c1e26' : '#2e5a3e';
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
 * One curtain: a plain grey-blue linen, its folds, a stitched hem.  Drawn the
 * full width it hangs when closed; opening it squeezes the folds together.
 */
export function paintCurtain(g: Ctx, w: number, h: number, side: -1 | 1): void {
  const base = '#8a96a0';
  const hi = '#a4b0ba';
  const dark = '#6a7680';
  rect(g, 0, 0, w, h, base);
  for (let x = 0; x < w; x += 4) {
    rect(g, x, 0, 1, h, hi);
    rect(g, x + 3, 0, 1, h, dark);
  }
  // the heading tape and rings
  rect(g, 0, 0, w, 2, dark);
  for (let x = 1; x < w; x += 4) rect(g, x, 0, 1, 1, HP.steelHi);
  // a plain hem
  rect(g, 0, h - 2, w, 2, dark);
  // the leading edge catches the light
  const edge = side < 0 ? w - 1 : 0;
  rect(g, edge, 0, 1, h, '#c0cad2');
}

// ============================================================ the bathroom

/** The mirror over the basin: chest to crown for a man standing at it. */
export const MIRROR = { x: 149, y: 115, w: 22, h: 21 };

/**
 * The bathroom.  `fitted` is the hotel's: a vanity and basin under the
 * mirror, a toilet and a bath.  Without it it is the flat's -- the same tile,
 * floor, mirror, towel rail and window, and the plumbing waiting in the wall
 * for whatever the tenant buys and puts in.
 */
export function paintBathroom(g: Ctx, fitted = true): void {
  const W = 320;
  // white subway tile to the ceiling, a burgundy band at the dado
  rect(g, 0, CEIL_Y, W, FLOOR_Y - CEIL_Y, '#f2f0ea');
  for (let y = CEIL_Y; y < FLOOR_Y; y += 4) {
    rect(g, 0, y, W, 1, '#d8d4cc');
    for (let x = ((y - CEIL_Y) / 4) % 2 ? 4 : 0; x < W; x += 8) rect(g, x, y, 1, 4, '#d8d4cc');
  }
  enclosedCeiling(g, W, { lights: [80, 240] });
  rect(g, 0, DADO - 2, W, 3, '#8a96a0');
  rect(g, 0, DADO - 2, W, 1, '#a4b0ba');
  // floor: small black-and-white tiles
  for (let y = FLOOR_Y; y < 180; y += 4)
    for (let x = 0; x < W; x += 4) rect(g, x, y, 4, 4, ((x + y) / 4) % 2 ? '#2a2a2e' : '#e8e6e0');
  rect(g, 0, FLOOR_Y, W, 2, '#8a8a8a');
  // the door back to the room
  roomDoor(g, 22, '', { w: 15, white: true });
  // a towel rail with towels, at hand height
  rect(g, 70, 128, 18, 1, HP.steelHi);
  rect(g, 72, 129, 6, 12, '#f8f6f0');
  rect(g, 72, 138, 6, 1, '#3a7a80');
  rect(g, 80, 129, 6, 10, '#f8f6f0');
  rect(g, 80, 136, 6, 1, '#3a7a80');
  // the vanity: mirror in gold, a light bar, a marble top, a basin
  const m = MIRROR;
  rect(g, m.x - 2, m.y - 2, m.w + 4, m.h + 4, HP.goldDark);
  rect(g, m.x - 1, m.y - 1, m.w + 2, m.h + 2, HP.gold);
  g.clearRect(m.x, m.y, m.w, m.h);
  rect(g, m.x - 2, m.y - 7, m.w + 4, 3, HP.steel);
  for (let k = 0; k < 3; k++) rect(g, m.x + 2 + k * 8, m.y - 6, 3, 1, '#fff6d8');
  glow(g, m.x + m.w / 2, m.y - 5, 24, 0.38);
  if (!fitted) {
    // the glass, with nothing in front of it: a cool sheen
    rect(g, m.x, m.y, m.w, m.h, '#cfdde2');
    for (let d = 0; d < 6; d++) rect(g, m.x + 2 + d, m.y + 2 + d * 2, 1, 2, '#ffffff', 0.35);
    rect(g, m.x, m.y + m.h - 3, m.w, 3, '#b8c8ce');
    // the capped pipes where a basin goes, a soil pipe stub, a floor drain
    rect(g, m.x + 6, 143, 2, 5, HP.steelHi);
    rect(g, m.x + 14, 143, 2, 5, HP.steelHi);
    rect(g, m.x + 5, 142, 4, 1, HP.steel);
    rect(g, m.x + 13, 142, 4, 1, HP.steel);
    rect(g, 216, 146, 6, 6, '#e8e6e0');
    rect(g, 217, 146, 4, 1, HP.steel);
    rect(g, 274, FLOOR_Y + 8, 6, 2, HP.steelDark);
    rect(g, 275, FLOOR_Y + 8, 4, 1, HP.steel);
    // a small frosted window high up
    rect(g, 216, 108, 14, 11, HP.cream);
    rect(g, 217, 109, 12, 9, '#9ab0c4');
    rect(g, 222, 109, 1, 9, HP.cream);
    glow(g, 160, CEIL_Y, 60, 0.12);
    return;
  }
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

/**
 * The car, to the player's scale like every other room here: a steel box
 * about two of him wide each side of the doors, a lit ceiling, a handrail at
 * the hip, and in the back wall the doors -- the same size as the doors on
 * the landings -- with the floor dial over them and the buttons beside them.
 */
/** The car is painted this far up the screen, so it sits in the middle of it. */
const LIFT_UP = 36;
/** Its front edge: where the floor and the side walls leave the picture. */
const LB = 164 + LIFT_UP;
export const LIFT = {
  /** The doorway in the back wall. */
  door: { x: 150, y: FLOOR_Y - LIFT_UP - 32, w: 20, h: 32 },
  /** The floor dial over it: where the number goes. */
  dial: { x: 160, y: FLOOR_Y - LIFT_UP - 37 },
  /** The buttons, floor 1 to 6 (3 by 3 each): their top-left corners. */
  button: (floor: number) => ({ x: 174 + ((floor - 1) % 2) * 4, y: 126 - LIFT_UP + (2 - Math.floor((floor - 1) / 2)) * 5 }),
};

export function paintLift(g: Ctx): void {
  const W = 320;
  g.save();
  g.translate(0, -LIFT_UP);
  // the car: a lift's size, not a hall's -- about three of him wide, the
  // back wall with the doors in it, the side walls and the floor coming out
  // towards us, and round it the dark of the shaft
  const L = 134;
  const R = 186;
  const FL = 114;
  const FR = 206;
  const CF = 92;
  const BACK_TOP = 110;
  // the shaft: dark concrete, the guide rails and the cables
  rect(g, 0, 0, W, 180 + LIFT_UP, '#0e1014');
  for (let y = 0; y < 180 + LIFT_UP; y += 12) rect(g, 0, y, W, 1, '#16181e');
  for (const x of [96, 220]) {
    rect(g, x, 0, 4, 180 + LIFT_UP, '#2a2d33');
    rect(g, x, 0, 1, 180 + LIFT_UP, '#3a3d44');
    for (let y = 6; y < 180 + LIFT_UP; y += 24) rect(g, x - 2, y, 8, 2, '#24262c');
  }
  for (const cx of [156, 160, 164]) rect(g, cx, 0, 1, CF - 5, '#2a2d33');
  rect(g, FL + 14, CF - 6, FR - FL - 28, 5, '#24262c');
  rect(g, FL + 14, CF - 6, FR - FL - 28, 1, '#3a3d44');
  const poly = (pts: number[][], c: string, a = 1): void => {
    g.globalAlpha = a;
    g.fillStyle = c;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
  };
  // the ceiling, lit
  poly([[FL, CF], [FR, CF], [R, BACK_TOP], [L, BACK_TOP]], '#d8d6d0');
  for (let k = 0; k < 2; k++) {
    const t = 0.3 + k * 0.4;
    const y = Math.round(CF + t * (BACK_TOP - CF));
    const half = Math.round(((FR - FL) / 2) * (1 - t) + ((R - L) / 2) * t) - 8;
    rect(g, 160 - half, y, half * 2, 2, '#fff6dc');
  }
  glow(g, 160, CF + 8, 22, 0.2);
  rect(g, FL, CF - 1, FR - FL, 2, '#6a7078');
  // the side walls, panelled, the handrail running along them
  for (const [x0, x1] of [[FL, L], [FR, R]]) {
    poly([[x0, CF], [x1, BACK_TOP], [x1, FLOOR_Y], [x0, LB]], '#9aa0a8');
    for (let k = 1; k < 2; k++) {
      const x = x0 + ((x1 - x0) * k) / 2;
      const yt = CF + ((BACK_TOP - CF) * k) / 2;
      const yb = 180 - ((180 - FLOOR_Y) * k) / 2;
      rect(g, Math.round(x), Math.round(yt), 1, Math.round(yb - yt), '#7a8088');
    }
    g.strokeStyle = HP.steelHi;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0, 146);
    g.lineTo(x1, 139);
    g.stroke();
    // the front edge of the car, catching the light
    rect(g, x0 - (x0 < 160 ? 1 : 0), CF, 1, LB - CF, '#c8ccd2');
  }
  // the back wall
  rect(g, L, BACK_TOP, R - L, FLOOR_Y - BACK_TOP, '#a4aab2');
  for (let x = L; x < R; x += 3) rect(g, x, BACK_TOP, 1, FLOOR_Y - BACK_TOP, '#ffffff', 0.06);
  rect(g, L, BACK_TOP, R - L, 1, '#6a7078');
  rect(g, L, 139, R - L, 1, HP.steelHi);
  rect(g, L, 140, R - L, 1, HP.steelDark);
  rect(g, L, BACK_TOP, 1, FLOOR_Y - BACK_TOP, '#6a7078');
  rect(g, R - 1, BACK_TOP, 1, FLOOR_Y - BACK_TOP, '#6a7078');
  // the floor: rubber, studded, running out to us
  poly([[L, FLOOR_Y], [R, FLOOR_Y], [FR, LB], [FL, LB]], '#3a3d44');
  for (let y = FLOOR_Y + 3; y < LB; y += 4) {
    const k = (y - FLOOR_Y) / (LB - FLOOR_Y);
    const x0 = Math.round(L + (FL - L) * k);
    const x1 = Math.round(R + (FR - R) * k);
    for (let x = x0 + 2 + ((y / 4) % 2) * 3; x < x1 - 2; x += 6) rect(g, x, y, 2, 1, '#4e525a');
  }
  rect(g, L, FLOOR_Y, R - L, 1, '#24262c');
  g.restore();
  // the doors and their surround, landing-sized
  const d = LIFT.door;
  rect(g, d.x - 3, d.y - 3, d.w + 6, d.h + 3, HP.goldDark);
  rect(g, d.x - 2, d.y - 2, d.w + 4, d.h + 2, HP.gold);
  rect(g, d.x - 2, d.y - 2, d.w + 4, 1, HP.goldHi);
  for (const dx of [0, d.w / 2]) {
    rect(g, d.x + dx, d.y, d.w / 2, d.h, HP.steel);
    for (let k = 2; k < d.w / 2; k += 3) rect(g, d.x + dx + k, d.y, 1, d.h, HP.steelHi, 0.45);
  }
  rect(g, d.x + d.w / 2, d.y, 1, d.h, HP.steelDark);
  // the floor dial over the doors
  rect(g, LIFT.dial.x - 10, LIFT.dial.y - 4, 20, 9, HP.goldDark);
  rect(g, LIFT.dial.x - 9, LIFT.dial.y - 3, 18, 7, HP.ink);
  // the button panel, beside the doors at hand height
  rect(g, 172, 123 - LIFT_UP, 11, 19, HP.goldDark);
  rect(g, 173, 124 - LIFT_UP, 9, 17, HP.gold);
  for (let f = 1; f <= 6; f++) {
    const b = LIFT.button(f);
    rect(g, b.x, b.y, 3, 3, '#2a2d33');
    rect(g, b.x + 1, b.y + 1, 1, 1, '#bfe8ff');
  }
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

/** The painted wall: warm grey emulsion on plaster, one metre of it. */
export function texWallpaper(): HTMLCanvasElement {
  return canvas(256, 512, (g) => {
    g.fillStyle = HP.paper;
    g.fillRect(0, 0, 256, 512);
    // the roller's faint texture, and a little life in the paint
    for (let k = 0; k < 2600; k++) {
      g.fillStyle = k % 3 ? 'rgba(120,110,95,0.05)' : 'rgba(255,255,255,0.08)';
      g.fillRect((k * 97) % 256, (k * 61) % 512, 2, 1);
    }
    for (let k = 0; k < 10; k++) {
      const x = (k * 71) % 256;
      const y = (k * 137) % 512;
      const gr = g.createRadialGradient(x, y, 0, x, y, 60);
      gr.addColorStop(0, 'rgba(90,80,70,0.04)');
      gr.addColorStop(1, 'rgba(90,80,70,0)');
      g.fillStyle = gr;
      g.fillRect(x - 60, y - 60, 120, 120);
    }
  });
}

/** The lower wall: a darker paint that takes the knocks, a steel bumper rail, white skirting. */
export function texWainscot(): HTMLCanvasElement {
  return canvas(256, 256, (g) => {
    g.fillStyle = HP.lowerWall;
    g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 1200; k++) {
      g.fillStyle = k % 3 ? 'rgba(90,80,70,0.05)' : 'rgba(255,255,255,0.07)';
      g.fillRect((k * 83) % 256, (k * 29) % 256, 2, 1);
    }
    // scuffs where trolleys and shoulders brush it
    for (let k = 0; k < 6; k++) {
      g.fillStyle = 'rgba(60,56,50,0.08)';
      g.fillRect((k * 47) % 230, 120 + ((k * 31) % 80), 18, 2);
    }
    // the bumper rail at the top
    const rail = g.createLinearGradient(0, 0, 0, 22);
    rail.addColorStop(0, HP.steelHi);
    rail.addColorStop(0.5, HP.steel);
    rail.addColorStop(1, HP.steelDark);
    g.fillStyle = rail;
    g.fillRect(0, 0, 256, 22);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 22, 256, 3);
    // white skirting
    g.fillStyle = '#f4f3ef';
    g.fillRect(0, 226, 256, 30);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 226, 256, 3);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, 252, 256, 4);
  });
}

/** The carpet: charcoal tiles, quarter-turned, flecked -- one repeat, half a metre. */
export function texCarpet(): HTMLCanvasElement {
  return canvas(128, 128, (g) => {
    g.fillStyle = HP.carpet;
    g.fillRect(0, 0, 128, 128);
    for (const [x0, y0, along] of [[0, 0, true], [64, 0, false], [0, 64, false], [64, 64, true]] as const) {
      for (let k = 2; k < 64; k += 4) {
        g.fillStyle = 'rgba(0,0,0,0.12)';
        if (along) g.fillRect(x0, y0 + k, 64, 2);
        else g.fillRect(x0 + k, y0, 2, 64);
      }
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(x0, y0, 64, 1);
      g.fillRect(x0, y0, 1, 64);
    }
    for (let k = 0; k < 500; k++) {
      g.fillStyle = k % 2 ? 'rgba(150,155,165,0.12)' : 'rgba(20,20,24,0.12)';
      g.fillRect((k * 37) % 128, (k * 53) % 128, 2, 1);
    }
  });
}

/** The carpet's edge along each wall: a darker border tile. */
export function texCarpetBorder(): HTMLCanvasElement {
  return canvas(64, 128, (g) => {
    g.fillStyle = HP.carpetDark;
    g.fillRect(0, 0, 64, 128);
    for (let k = 0; k < 200; k++) {
      g.fillStyle = 'rgba(150,155,165,0.1)';
      g.fillRect((k * 23) % 64, (k * 41) % 128, 2, 1);
    }
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, 0, 1, 128);
    g.fillRect(0, 63, 64, 1);
  });
}

/** A flat's front door, face on: flush oak veneer, a steel number plate, lever and spy hole. */
export function texRoomDoor(num: string, broken = false): HTMLCanvasElement {
  return canvas(256, 512, (g) => {
    g.fillStyle = HP.wood;
    g.fillRect(0, 0, 256, 512);
    // the veneer's grain, running up the door
    for (let k = 0; k < 256; k += 3) {
      g.fillStyle = `rgba(90,60,30,${0.05 + ((k * 11) % 7) * 0.012})`;
      g.fillRect(k, 0, 1 + (k % 2), 512);
    }
    g.fillStyle = 'rgba(255,240,210,0.12)';
    g.fillRect(0, 0, 256, 6);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(250, 0, 6, 512);
    // the number plate, brushed steel, the figures cut into it
    g.fillStyle = HP.steelDark;
    g.fillRect(84, 120, 88, 48);
    const pl = g.createLinearGradient(88, 0, 168, 0);
    pl.addColorStop(0, '#c4c8cc');
    pl.addColorStop(0.5, '#e4e8ec');
    pl.addColorStop(1, '#b0b4b8');
    g.fillStyle = pl;
    g.fillRect(88, 124, 80, 40);
    g.fillStyle = '#1e2024';
    g.font = 'bold 28px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(num, 128, 145);
    // the spy hole over it
    g.fillStyle = HP.steelDark;
    g.beginPath();
    g.arc(128, 84, 6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#100a06';
    g.beginPath();
    g.arc(128, 84, 3, 0, Math.PI * 2);
    g.fill();
    // the lever handle on its rose, and the key cylinder under it
    g.fillStyle = HP.steelDark;
    g.beginPath();
    g.arc(214, 262, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = HP.steelHi;
    g.fillRect(168, 256, 50, 10);
    g.fillStyle = HP.steel;
    g.fillRect(168, 264, 50, 3);
    g.fillStyle = HP.steelDark;
    g.beginPath();
    g.arc(214, 300, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2a2a2e';
    g.fillRect(213, 296, 2, 8);
    if (broken) {
      // split and gouged
      g.strokeStyle = '#2a1a0c';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(40, 0);
      g.lineTo(110, 180);
      g.lineTo(90, 300);
      g.lineTo(150, 512);
      g.stroke();
      for (let k = 0; k < 4; k++) {
        g.strokeStyle = 'rgba(40,24,10,0.8)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(140 + k * 14, 180);
        g.lineTo(150 + k * 16, 260);
        g.stroke();
      }
    }
  });
}

/** The lift doors: brushed steel in a steel surround. */
export function texLiftDoors(): HTMLCanvasElement {
  return canvas(512, 512, (g) => {
    // a brushed steel surround
    g.fillStyle = HP.steel;
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = HP.steelDark;
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

/** Large porcelain floor tiles: warm grey, fine grout, a faint mottle. */
export function texMarble(): HTMLCanvasElement {
  let seed = 3;
  const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return canvas(256, 256, (g) => {
    g.fillStyle = '#d2cec6';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? '#cecac2' : '#d6d2ca';
        g.fillRect(i * 128 + 1, j * 128 + 1, 126, 126);
      }
    for (let k = 0; k < 1800; k++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(90,86,80,0.06)' : 'rgba(255,255,255,0.08)';
      g.fillRect(rnd() * 256, rnd() * 256, 2, 2);
    }
    g.fillStyle = 'rgba(110,106,100,0.7)';
    g.fillRect(0, 0, 256, 2);
    g.fillRect(0, 128, 256, 2);
    g.fillRect(0, 0, 2, 256);
    g.fillRect(128, 0, 2, 256);
  });
}

