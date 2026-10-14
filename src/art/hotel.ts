/**
 * ---- LILY'S CONDOS, ONE PAINTING FOR BOTH STREETS.
 *
 * The building is seen twice: side-on in the pixel street (StreetWest), and
 * head-on at the end of the midnight road (NightRoad3D).  It is one building,
 * so it is one picture: this paints the front of it, pixel for pixel, onto a
 * canvas, and the street hangs that canvas on its wall while the night road
 * stretches it over the front of a box.
 *
 * The front, top to bottom: a parapet; the brown name band with the gold
 * letters and a lily at each end; a cornice; six floors of cream stone, six
 * windows to a floor, each with a lintel, a keystone and a sill; a belt
 * course; and the ground floor in rusticated stone -- the glass double doors
 * in their brass frame under a fanlight, a lamp either side, a tall lobby
 * window at each end.  In front of that (painted only for the flat street:
 * the night road builds them) the maroon canopy on its two gold posts and
 * the clipped bay trees in their planters.
 *
 * At dusk the stone goes violet, most of the rooms are lit -- not all, and
 * not all the same -- and the lamps and the door throw a warm light up the
 * front.
 */

import { drawPixelText } from '../render/pixelFont';

/** The painting's size, in pixels.  The street draws it 1:1. */
export const HOTEL_W = 150;
export const HOTEL_H = 152;
/** The door's centre, across the front. */
export const HOTEL_DOOR = 75;
/** Where the ground floor starts (the belt course), down the front. */
export const HOTEL_GROUND = 120;
/** The canopy, and the posts that hold it (for the night road to build). */
export const HOTEL_CANOPY = { x0: 49, x1: 101, top: 114, bottom: 123 };
export const HOTEL_POSTS = [51, 99];
export const HOTEL_PLANTERS = [56, 94];

export interface HotelOpts {
  dusk: boolean;
  /** Paint the canopy, its posts and the planters flat on the front (the street). */
  flat?: boolean;
}

const DAY = {
  wall: '#dcd9d2',
  slab: '#c2bfb8',
  clad: '#7c838c',
  cladEdge: '#5e646c',
  trim: '#f2f1ec',
  trimShadow: '#9a978f',
  band: '#34383e',
  bandEdge: '#1e2126',
  letter: '#eef0f2',
  steel: '#9aa2ac',
  steelDark: '#5e646c',
  plinth: '#5a5f66',
  plinthLine: '#4a4e54',
  frame: '#3a3e44',
  glass: '#8ab8d0',
  glassHi: '#c8e2ee',
  glassLo: '#6a98b4',
  rail: '#a8d4e8',
  curtain: '#d8d2c4',
  lobby: '#e8dcc0',
  lobbyHi: '#f8f0dc',
  recess: '#2a2e34',
  canopy: '#3a3e44',
  canopyHi: '#5a6068',
  leaf: '#5a8a4a',
  leafHi: '#7aaa5a',
  pot: '#8a8780',
};
const DUSK = {
  wall: '#5a5866',
  slab: '#4c4a58',
  clad: '#3a3c48',
  cladEdge: '#2a2c36',
  trim: '#76747e',
  trimShadow: '#2a2832',
  band: '#22242a',
  bandEdge: '#141518',
  letter: '#ffe6a0',
  steel: '#6a6e7a',
  steelDark: '#3a3c46',
  plinth: '#2e3038',
  plinthLine: '#24262c',
  frame: '#1e2026',
  glass: '#262a36',
  glassHi: '#363a48',
  glassLo: '#1e222c',
  rail: '#4a5a6e',
  curtain: '#a89070',
  lobby: '#ffd890',
  lobbyHi: '#fff0c0',
  recess: '#16181c',
  canopy: '#1e2026',
  canopyHi: '#34363e',
  leaf: '#2e4a2a',
  leafHi: '#42603a',
  pot: '#3e3c44',
};
const LIT = ['#ffe090', '#ffd070', '#f8c060'];

/** The window columns' centres: six bays, three either side of the door. */
export function hotelColumns(): number[] {
  return [0, 1, 2, 3, 4, 5].map((w) => HOTEL_DOOR + (w - 2.5) * 24);
}

/** Window rows' tops, six floors (levels 6 down to 1; the ground floor is below). */
export const HOTEL_FLOORS = [22, 38, 54, 70, 86, 102];
const FLOORS = HOTEL_FLOORS;

/**
 * LILY'S CONDOS: a modern block of flats.  A charcoal name band with the
 * name in aluminium letters; six floors of pale render with a slab edge at
 * each floor and dark cladding up the corners; every flat a wide window and
 * a balcony with a glass railing (the odd plant, the odd bike on it); the
 * ground floor clad in dark stone, its lobby glazed floor to ceiling, a flat
 * steel canopy over the doors, concrete planters of grasses either side.
 * At dusk most of the flats are lit -- not all, not all the same.
 */
export function paintHotel(g: CanvasRenderingContext2D, o: HotelOpts): void {
  const P = o.dusk ? DUSK : DAY;
  const r = (x: number, y: number, w: number, h: number, c: string, a = 1): void => {
    g.globalAlpha = a;
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
  };
  g.clearRect(0, 0, HOTEL_W, HOTEL_H);

  // ---- the render, faintly mottled, and the cladding up the corners
  r(0, 0, HOTEL_W, HOTEL_H, P.wall);
  for (let k = 0; k < 220; k++) r((k * 37) % HOTEL_W, 18 + ((k * 23) % (HOTEL_GROUND - 18)), 1, 1, k % 2 ? P.slab : P.trim, 0.35);
  for (const x0 of [0, HOTEL_W - 7]) {
    r(x0, 15, 7, HOTEL_GROUND - 15, P.clad);
    for (let y = 22; y < HOTEL_GROUND; y += 8) r(x0, y, 7, 1, P.cladEdge);
    r(x0 + 3, 15, 1, HOTEL_GROUND - 15, P.cladEdge, 0.6);
  }

  // ---- the parapet and the name band: aluminium letters on charcoal
  r(0, 0, HOTEL_W, 2, P.trim);
  r(0, 2, HOTEL_W, 13, P.band);
  r(0, 2, HOTEL_W, 1, P.bandEdge);
  r(0, 14, HOTEL_W, 1, P.bandEdge);
  const name = "LILY'S CONDOS";
  drawPixelText(g, name, HOTEL_DOOR + 1, 6, { scale: 1, color: P.bandEdge, center: true });
  drawPixelText(g, name, HOTEL_DOOR, 5, { scale: 1, color: P.letter, center: true });
  // the roofline, flat, and its shadow
  r(0, 15, HOTEL_W, 2, P.trim);
  r(0, 17, HOTEL_W, 1, P.trimShadow, 0.5);

  // ---- the flats: a wide window and a balcony to each, a slab at each floor
  const cols = hotelColumns();
  FLOORS.forEach((top, f) => {
    // the floor slab's edge, running right across
    r(7, top + 13, HOTEL_W - 14, 2, P.trim);
    r(7, top + 15, HOTEL_W - 14, 1, P.trimShadow, 0.5);
    cols.forEach((cx, w) => {
      const x = cx - 8;
      const lit = o.dusk && (f * 7 + w * 3) % 4 !== 0;
      const tone = LIT[(f * 5 + w) % 3];
      // the window wall: a sliding door onto the balcony
      r(x, top - 1, 16, 14, P.frame);
      r(x + 1, top, 14, 13, lit ? tone : P.glass);
      if (!lit) {
        r(x + 1, top, 14, 2, P.glassHi);
        r(x + 3, top + 3, 1, 3, P.glassHi);
        r(x + 1, top + 10, 14, 3, P.glassLo);
      } else {
        r(x + 1, top + 8, 14, 5, '#e8a850', 0.45);
        if ((f + w * 2) % 5 === 0) r(x + 9, top + 3, 2, 9, '#5a3a2a', 0.55);
      }
      // a curtain drawn to one side, now and then
      if ((f * 3 + w * 5) % 4 === 0) r(x + 1, top, 3, 13, P.curtain, lit ? 0.85 : 0.7);
      r(cx, top, 1, 13, P.frame);
      // the balcony: its glass railing on the slab, a steel top rail
      r(x - 1, top + 7, 18, 6, P.rail, 0.45);
      r(x - 1, top + 6, 18, 1, P.steel);
      r(x - 1, top + 6, 1, 7, P.steel);
      r(x + 16, top + 6, 1, 7, P.steel);
      // what people keep out there
      const kind = (f * 11 + w * 7) % 6;
      if (kind === 0) {
        r(x + 2, top + 9, 3, 4, P.pot);
        r(x + 1, top + 7, 5, 3, P.leaf);
        r(x + 2, top + 6, 2, 1, P.leafHi);
      } else if (kind === 3) {
        r(x + 10, top + 10, 4, 1, P.steelDark);
        r(x + 10, top + 11, 1, 2, P.steelDark);
        r(x + 13, top + 11, 1, 2, P.steelDark);
      }
    });
  });

  // ---- the ground floor: dark stone cladding, a glazed lobby
  r(0, HOTEL_GROUND - 2, HOTEL_W, 2, P.trim);
  r(0, HOTEL_GROUND, HOTEL_W, HOTEL_H - HOTEL_GROUND, P.plinth);
  for (let x = 12; x < HOTEL_W; x += 18) r(x, HOTEL_GROUND, 1, HOTEL_H - HOTEL_GROUND, P.plinthLine);
  r(0, HOTEL_GROUND + 14, HOTEL_W, 1, P.plinthLine);
  // the lobby's glass, either side of the doors: the lobby lit inside
  for (const [x0, x1] of [[10, HOTEL_DOOR - 18], [HOTEL_DOOR + 18, HOTEL_W - 10]]) {
    r(x0 - 1, 124, x1 - x0 + 2, HOTEL_H - 125, P.frame);
    r(x0, 125, x1 - x0, HOTEL_H - 127, P.lobby);
    r(x0, 125, x1 - x0, 3, P.lobbyHi);
    r(x0, HOTEL_H - 8, x1 - x0, 6, '#b8a080', 0.35);
    for (let x = x0 + 9; x < x1; x += 10) r(x, 125, 1, HOTEL_H - 127, P.frame);
    // inside: the mailboxes on one side, a plant on the other
    if (x0 < HOTEL_DOOR) {
      r(x0 + 3, 132, 12, 9, P.steel, 0.8);
      for (let k = 0; k < 3; k++) r(x0 + 3, 134 + k * 3, 12, 1, P.steelDark, 0.8);
    } else {
      r(x1 - 9, 140, 5, 6, P.pot);
      r(x1 - 11, 133, 9, 7, P.leaf, 0.9);
    }
  }
  // the entrance: a deep recess, frameless glass doors, the number over them
  const d = HOTEL_DOOR;
  r(d - 15, 122, 30, HOTEL_H - 122, P.recess);
  for (const s of [-1, 1]) {
    const x = s < 0 ? d - 11 : d + 1;
    r(x, 128, 10, HOTEL_H - 129, P.frame);
    r(x + 1, 129, 8, HOTEL_H - 131, P.lobby);
    r(x + 2, 131, 1, 8, '#ffffff', 0.45);
    // the long steel pull
    r(s < 0 ? x + 8 : x + 1, 134, 1, 10, P.steel);
  }
  r(d - 1, 128, 2, HOTEL_H - 128, P.frame);
  // the step
  r(d - 16, HOTEL_H - 2, 32, 2, P.trim);
  r(d - 16, HOTEL_H - 2, 32, 1, '#ffffff', 0.25);
  // the wall lights either side: slim boxes washing up and down
  for (const lx of [d - 19, d + 18]) {
    r(lx, 128, 2, 6, P.steelDark);
    r(lx, 128, 2, 1, o.dusk ? '#fff0b0' : '#e8e8e0');
    r(lx, 133, 2, 1, o.dusk ? '#fff0b0' : '#e8e8e0');
  }

  // ---- dusk: the light from the lobby and the wall lights
  if (o.dusk) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const glow = (x: number, y: number, rad: number, a: number): void => {
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(255,190,110,${a})`);
      gr.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    };
    glow(d, HOTEL_H - 8, 34, 0.3);
    glow(d - 18, 130, 10, 0.45);
    glow(d + 19, 130, 10, 0.45);
    glow(30, HOTEL_H - 10, 22, 0.16);
    glow(HOTEL_W - 30, HOTEL_H - 10, 22, 0.16);
    g.restore();
  }

  if (!o.flat) return;

  // ---- in front (the street only): concrete planters of grasses, the canopy
  for (const px of HOTEL_PLANTERS) {
    r(px - 4, HOTEL_H - 7, 9, 7, P.pot);
    r(px - 4, HOTEL_H - 7, 9, 1, P.trim);
    for (let k = -3; k <= 3; k += 2) r(px + k, HOTEL_H - 12 + Math.abs(k), 1, 5 - Math.abs(k) + 0, P.leaf);
    r(px, HOTEL_H - 13, 1, 2, P.leafHi);
  }
  const C = HOTEL_CANOPY;
  for (const px of HOTEL_POSTS) {
    r(px - 1, C.bottom, 2, HOTEL_H - C.bottom, P.steel);
    r(px, C.bottom, 1, HOTEL_H - C.bottom, P.steelDark);
  }
  paintCanopy(g, o, C.x0, C.top);
}

/** The canopy's front, at (x, y): a flat slab of steel with downlights under it. */
export function paintCanopy(g: CanvasRenderingContext2D, o: HotelOpts, x = 0, y = 0): void {
  const P = o.dusk ? DUSK : DAY;
  const C = HOTEL_CANOPY;
  const w = C.x1 - C.x0;
  const r = (xx: number, yy: number, ww: number, hh: number, c: string): void => {
    g.fillStyle = c;
    g.fillRect(x + xx, y + yy, ww, hh);
  };
  r(0, 2, w, 4, P.canopy);
  r(0, 2, w, 1, P.canopyHi);
  r(0, 5, w, 1, '#000000');
  // the building number on its fascia
  r(Math.floor(w / 2) - 5, 3, 10, 2, P.steel);
  // downlights under it
  for (const k of [6, Math.floor(w / 2), w - 7]) r(k, 6, 2, 1, o.dusk ? '#fff0b0' : '#dcdcd4');
}
