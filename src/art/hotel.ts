/**
 * ---- THE GRAND LILY HOTEL, ONE PAINTING FOR BOTH STREETS.
 *
 * The hotel is seen twice: side-on in the pixel street (StreetWest), and
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
  wall: '#e4d6b4',
  course: '#d4c49e',
  quoin: '#efe5ca',
  quoinEdge: '#bba984',
  trim: '#f4ecd6',
  trimShadow: '#a8987a',
  band: '#6a4226',
  bandEdge: '#3e2414',
  gold: '#d8b24a',
  goldDark: '#8a6a24',
  plinth: '#c6b28c',
  plinthLine: '#a6926c',
  frame: '#5a4632',
  glass: '#8ab8d0',
  glassHi: '#c8e2ee',
  glassLo: '#6a98b4',
  curtain: '#c87a84',
  lobby: '#d8b878',
  lobbyHi: '#eed49a',
  recess: '#3a2a24',
  maroon: '#7b2a3a',
  maroonDark: '#4a1a24',
  maroonHi: '#9a3a4c',
  leaf: '#4a7a3a',
  leafHi: '#6a9a4a',
  pot: '#5a5048',
};
const DUSK = {
  wall: '#5e4e60',
  course: '#524458',
  quoin: '#6e5e70',
  quoinEdge: '#3e3044',
  trim: '#7c6c7e',
  trimShadow: '#2e2434',
  band: '#3e2a28',
  bandEdge: '#22161a',
  gold: '#f0c860',
  goldDark: '#8a6a2a',
  plinth: '#4a3c4c',
  plinthLine: '#382c3a',
  frame: '#2a2030',
  glass: '#2a2230',
  glassHi: '#3e3648',
  glassLo: '#221a28',
  curtain: '#a0524a',
  lobby: '#ffd890',
  lobbyHi: '#fff0c0',
  recess: '#1a1218',
  maroon: '#6a2232',
  maroonDark: '#3a121c',
  maroonHi: '#8a3244',
  leaf: '#2e4a2a',
  leafHi: '#42603a',
  pot: '#3a3238',
};
const LIT = ['#ffe090', '#ffd070', '#f8c060'];

/** The window columns' centres (the glazing bar): six, three either side of the door. */
export function hotelColumns(): number[] {
  return [0, 1, 2, 3, 4, 5].map((w) => HOTEL_DOOR + (w - 2.5) * 24);
}

/** Window rows' tops, six floors (levels 6 down to 1; the ground floor is below). */
export const HOTEL_FLOORS = [22, 38, 54, 70, 86, 102];
const FLOORS = HOTEL_FLOORS;

export function paintHotel(g: CanvasRenderingContext2D, o: HotelOpts): void {
  const P = o.dusk ? DUSK : DAY;
  const r = (x: number, y: number, w: number, h: number, c: string, a = 1): void => {
    g.globalAlpha = a;
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
  };
  g.clearRect(0, 0, HOTEL_W, HOTEL_H);

  // ---- the stone: courses every eight, quoins up both corners
  r(0, 0, HOTEL_W, HOTEL_H, P.wall);
  for (let y = 26; y < HOTEL_GROUND; y += 8) r(6, y, HOTEL_W - 12, 1, P.course);
  for (let y = 18, k = 0; y < HOTEL_GROUND; y += 5, k++) {
    const w = k % 2 ? 4 : 6;
    r(0, y, w, 4, P.quoin);
    r(0, y + 4, w, 1, P.quoinEdge);
    r(HOTEL_W - w, y, w, 4, P.quoin);
    r(HOTEL_W - w, y + 4, w, 1, P.quoinEdge);
  }

  // ---- the parapet and the name band
  r(0, 0, HOTEL_W, 2, P.trim);
  r(0, 2, HOTEL_W, 13, P.band);
  r(0, 2, HOTEL_W, 1, P.bandEdge);
  r(2, 4, HOTEL_W - 4, 1, P.gold);
  r(2, 13, HOTEL_W - 4, 1, P.goldDark);
  r(2, 4, 1, 10, P.gold);
  r(HOTEL_W - 3, 4, 1, 10, P.goldDark);
  const name = 'GRAND LILY HOTEL';
  drawPixelText(g, name, HOTEL_DOOR + 1, 6, { scale: 1, color: P.bandEdge, center: true });
  drawPixelText(g, name, HOTEL_DOOR, 5, { scale: 1, color: o.dusk ? '#ffe090' : P.gold, center: true });
  // a lily at each end: three petals and a stem
  for (const lx of [10, HOTEL_W - 11]) {
    r(lx, 6, 1, 3, '#f4a8c8');
    r(lx - 2, 7, 1, 2, '#f4a8c8');
    r(lx + 2, 7, 1, 2, '#f4a8c8');
    r(lx - 1, 9, 3, 1, '#e07aa8');
    r(lx, 10, 1, 2, P.leafHi);
  }
  // the cornice: a lip, the dentils under it, its shadow on the wall
  r(0, 15, HOTEL_W, 1, P.trim);
  r(0, 16, HOTEL_W, 2, P.course);
  for (let x = 1; x < HOTEL_W; x += 3) r(x, 17, 1, 1, P.trimShadow);
  r(0, 18, HOTEL_W, 1, P.trimShadow, 0.5);

  // ---- the rooms
  const cols = hotelColumns();
  FLOORS.forEach((top, f) => {
    cols.forEach((cx, w) => {
      const x = cx - 5;
      const lit = o.dusk && (f * 7 + w * 3) % 4 !== 0;
      const tone = LIT[(f * 5 + w) % 3];
      const curtain = (f * 3 + w * 5) % 4;
      // lintel with its keystone, and the sill with its shadow
      r(x - 1, top - 2, 12, 2, P.trim);
      r(cx - 1, top - 3, 2, 3, P.trim);
      r(x - 1, top - 1, 12, 1, P.trimShadow, 0.4);
      r(x - 1, top + 11, 12, 1, P.trim);
      r(x, top + 12, 10, 1, P.trimShadow, 0.5);
      // frame and glass
      r(x, top, 10, 11, P.frame);
      r(x + 1, top + 1, 8, 9, lit ? tone : P.glass);
      if (!lit) {
        // the sky in it: lighter at the top, a glint across
        r(x + 1, top + 1, 8, 2, P.glassHi);
        r(x + 2, top + 4, 1, 1, P.glassHi);
        r(x + 1, top + 8, 8, 2, P.glassLo);
      } else {
        // a room: a lamp's warmth low down, and somebody's shape now and then
        r(x + 1, top + 7, 8, 3, '#e8a850', 0.5);
        if ((f + w * 2) % 5 === 0) r(x + 5, top + 4, 2, 6, '#5a3a2a', 0.55);
      }
      if (curtain === 0) {
        r(x + 1, top + 1, 2, 9, P.curtain, lit ? 0.85 : 0.7);
        r(x + 7, top + 1, 2, 9, P.curtain, lit ? 0.85 : 0.7);
      } else if (curtain === 1) {
        r(x + 1, top + 1, 8, 3, P.curtain, lit ? 0.6 : 0.5);
      }
      // the glazing bars
      r(cx, top + 1, 1, 9, P.frame);
      r(x + 1, top + 4, 8, 1, P.frame);
    });
  });

  // ---- the belt course, and the ground floor in rusticated stone
  r(0, HOTEL_GROUND - 2, HOTEL_W, 1, P.trim);
  r(0, HOTEL_GROUND - 1, HOTEL_W, 2, P.course);
  r(0, HOTEL_GROUND + 1, HOTEL_W, HOTEL_H - HOTEL_GROUND - 1, P.plinth);
  for (let y = HOTEL_GROUND + 6, k = 0; y < HOTEL_H; y += 6, k++) {
    r(0, y, HOTEL_W, 1, P.plinthLine);
    for (let x = k % 2 ? 6 : 0; x < HOTEL_W; x += 12) r(x, y - 5, 1, 5, P.plinthLine);
  }

  // the lobby windows, tall, one at each end
  for (const cx of [cols[0], cols[1], cols[4], cols[5]]) {
    const x = cx - 6;
    r(x - 1, 126, 14, 2, P.trim);
    r(x, 128, 12, 18, P.frame);
    r(x + 1, 129, 10, 16, P.lobby);
    r(x + 1, 129, 10, 3, P.lobbyHi);
    r(x + 1, 141, 10, 4, '#b8864a', 0.45);
    r(cx, 129, 1, 16, P.frame);
    r(x + 1, 134, 10, 1, P.frame);
    r(x - 1, 146, 14, 1, P.trim);
    r(x, 147, 12, 1, P.trimShadow, 0.6);
  }

  // the entrance: a stone surround, a fanlight, the glass doors in brass
  const d = HOTEL_DOOR;
  r(d - 15, 122, 30, HOTEL_H - 122, P.trim);
  r(d - 14, 123, 28, 1, P.trim);
  r(d - 13, 124, 26, HOTEL_H - 124, P.recess);
  r(d - 2, 121, 4, 3, P.trim); // the keystone
  // fanlight
  r(d - 11, 125, 22, 5, P.lobbyHi);
  r(d - 11, 129, 22, 1, P.gold);
  for (const k of [-7, -3, 0, 3, 7]) r(d + k, 125, 1, 4, P.goldDark);
  // the two doors
  for (const s of [-1, 1]) {
    const x = s < 0 ? d - 11 : d + 1;
    r(x, 130, 10, HOTEL_H - 130, P.gold);
    r(x + 1, 131, 8, HOTEL_H - 134, P.lobby);
    r(x + 1, 131, 8, 4, P.lobbyHi);
    r(x + 2, 133, 1, 8, '#ffffff', 0.45);
    r(x + 1, HOTEL_H - 4, 8, 3, P.goldDark); // kick plate
    // the long brass pull
    r(s < 0 ? x + 8 : x + 1, 137, 1, 8, P.goldDark);
    r(s < 0 ? x + 7 : x + 2, 137, 1, 8, P.gold);
  }
  r(d - 1, 130, 2, HOTEL_H - 130, P.goldDark);
  // the step
  r(d - 16, HOTEL_H - 2, 32, 2, P.trim);
  r(d - 16, HOTEL_H - 2, 32, 1, '#ffffff', 0.25);

  // a lamp either side: bracket, brass cage, the glass
  for (const lx of [d - 20, d + 19]) {
    r(lx - 1, 133, 3, 1, P.goldDark);
    r(lx, 128, 1, 5, P.goldDark);
    r(lx - 1, 128, 3, 4, o.dusk ? '#fff0b0' : '#f0e0b0');
    r(lx - 2, 127, 5, 1, P.gold);
    r(lx - 1, 132, 3, 1, P.gold);
  }

  // ---- dusk: warm light from the doors and the lamps up the stone
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
    glow(d, HOTEL_H - 8, 34, 0.32);
    glow(d - 20, 130, 12, 0.5);
    glow(d + 19, 130, 12, 0.5);
    // the corners lit from below
    glow(4, HOTEL_H, 26, 0.18);
    glow(HOTEL_W - 4, HOTEL_H, 26, 0.18);
    g.restore();
  }

  if (!o.flat) return;

  // ---- in front of it all (the street only): planters, canopy, posts
  for (const px of HOTEL_PLANTERS) {
    r(px - 3, HOTEL_H - 6, 7, 6, P.pot);
    r(px - 3, HOTEL_H - 6, 7, 1, P.trim);
    r(px, HOTEL_H - 10, 1, 4, P.frame);
    g.fillStyle = P.leaf;
    g.beginPath();
    g.arc(px + 0.5, HOTEL_H - 13, 4, 0, Math.PI * 2);
    g.fill();
    r(px - 2, HOTEL_H - 16, 3, 2, P.leafHi);
    r(px + 2, HOTEL_H - 13, 1, 1, P.leafHi);
  }
  const C = HOTEL_CANOPY;
  for (const px of HOTEL_POSTS) {
    r(px - 1, C.bottom, 2, HOTEL_H - C.bottom, P.gold);
    r(px, C.bottom, 1, HOTEL_H - C.bottom, P.goldDark);
    r(px - 2, HOTEL_H - 2, 4, 2, P.goldDark);
    r(px - 2, C.bottom, 4, 1, P.gold);
  }
  paintCanopy(g, o, C.x0, C.top);
}

/** The canopy's front, at (x, y): the night road paints it on its own. */
export function paintCanopy(g: CanvasRenderingContext2D, o: HotelOpts, x = 0, y = 0): void {
  const P = o.dusk ? DUSK : DAY;
  const C = HOTEL_CANOPY;
  const w = C.x1 - C.x0;
  const r = (xx: number, yy: number, ww: number, hh: number, c: string): void => {
    g.fillStyle = c;
    g.fillRect(x + xx, y + yy, ww, hh);
  };
  r(0, 0, w, 7, P.maroon);
  r(0, 0, w, 1, P.gold);
  r(0, 1, w, 1, P.maroonHi);
  r(0, 6, w, 1, P.maroonDark);
  // the valance: scallops along the edge
  for (let k = 0; k < w; k += 4) {
    r(k, 7, 4, 1, P.maroon);
    r(k + 1, 8, 2, 1, P.maroon);
    r(k, 7, 1, 1, P.maroonDark);
  }
  // a gold lily in the middle
  const m = Math.floor(w / 2);
  r(m, 2, 1, 3, P.gold);
  r(m - 2, 3, 1, 2, P.gold);
  r(m + 2, 3, 1, 2, P.gold);
  r(m - 1, 5, 3, 1, P.goldDark);
  // stripes of gold piping either side of it
  r(4, 3, m - 8, 1, P.goldDark);
  r(m + 5, 3, m - 8, 1, P.goldDark);
  if (o.dusk) for (const k of [8, m, w - 9]) r(k, 7, 2, 1, '#fff0b0');
}
