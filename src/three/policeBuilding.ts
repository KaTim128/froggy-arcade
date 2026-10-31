/**
 * ---- THE CONDO BLOCK, SEARCHED: the stairs, six floors of corridor, and
 * the flats off them.
 *
 * One building, in metres, laid out the way the fire plan of a real one is:
 *
 *   THE STAIRWELL is a switchback well at the lobby end, the one HotelHall3D
 *   runs down -- block walls, two flights a floor with a half landing between,
 *   yellow nosings, red rails along the well, the floor painted big on the
 *   wall at every landing -- running up from G to 6, with a fire door on to
 *   every floor.  Well space: x -1.6..1.6, z -4.6..1.6; the floor landings at
 *   z 0..1.6, the flights going back from them, the half landings at the far
 *   end.
 *
 *   EACH FLOOR (1-6) is the corridor in the reference pictures: an alcove
 *   at the stair end with the dead lift and the fire door side by side, then
 *   a corridor 2.5 m wide with six flats either side, numbered from the
 *   stairs (n01 left, n02 right ... n12 right, at the far end).  Cream
 *   emulsion over a walnut dado, a patterned carpet, walnut doors with
 *   their numbers on brass plates, steel wall lights, ceiling fittings.
 *
 *   THE FLATS are 4.6 m by 6 m.  Which ones are open is decided at the
 *   start of every attempt (seeded, so an attempt keeps its building until it
 *   ends): about a third of them, never fewer than three a floor.  Each open
 *   one is furnished from one of three plans -- a bathroom beside the door
 *   with a bath and a curtain or a toilet with a door to hide behind; a
 *   separate WC and a bedroom; a studio with its bathroom in the far corner
 *   -- with its own beds, wardrobes, chairs, colours and floors.  Every
 *   bathroom or WC has a place to hide: behind its curtain if it has a bath,
 *   behind its door if it has not.
 *
 *   612 is at the far end of the sixth floor, on the right (the even numbers
 *   are on the right, as in the hall upstairs): Froggy's room.  Its door is
 *   the one he took off its hinges, and its window is the one he came in
 *   through -- glass hanging in jagged teeth round the frame, the plaster
 *   cracked away round it -- and six floors under it, the river: the building
 *   goes straight down into it, wide and black and moving fast.
 *
 * Everything that can stop a body or an eye is in here as plain data -- wall
 * segments, furniture boxes, doors with hinges -- and the scene moves people
 * through it and tests sight lines against it (see PoliceEscape3D).  The
 * route network the officers walk is built here too, out of the same plan.
 */

import * as THREE from 'three';
import * as HL from './hotelLobby';
import { buildHotelLobby } from './hotelLobby';
import {
  texBlock,
  texCarpet,
  texCarpetBorder,
  texConcrete,
  texFireDoor,
  texLiftDoors,
  texRoomDoor,
  texSign,
  texWainscot,
  texWallpaper,
} from '../art/hotelInterior';

// ------------------------------------------------------------------ the plan

/**
 * THE LOBBY, where it is in this building: the hotel lobby (three/hotelLobby)
 * with its stairwell door on this well's G door.  In world terms, standing
 * in the doorway looking out (+z): the front wall with the sofa ahead, the
 * front doors' end away to the right (-x), the storage room's end to the
 * left (+x).
 */
const LDX = (SDOOR_MID: number) => SDOOR_MID - HL.STAIR_X;
export const LOBBY = (() => {
  const dx = LDX((0.45 + 1.35) / 2);
  const z0 = 1.6;
  return {
    dx,
    x0: HL.X0 + dx,
    x1: HL.X1 + dx,
    z0,
    z1: z0 + HL.DEPTH,
    doorZ: z0 + HL.DOOR_Z,
    desk: { x: HL.DESK_X + dx, z: z0 + 1.5 },
    sofa: { x: HL.SOFA_X + dx, z: z0 + HL.DEPTH - 0.55 },
    bin: { x: HL.BIN.x + dx, z: z0 + HL.BIN.z },
    lift: HL.LIFT_X + dx,
  };
})();

export const FH = 3;
export const TOP = 6;
export const CEIL = 2.7;
/** The stairwell. */
export const WX = 1.6;
export const LANDING = 1.6;
export const FLIGHT = 3;
export const GAP = 0.3;
export const WZ0 = -FLIGHT - LANDING;
export const WZ1 = LANDING;
/** The fire door in the well's +z wall. */
export const SDOOR = { x0: 0.45, x1: 1.35, z: LANDING };
/** The corridor. */
export const CH = 1.25;
export const AH = 3;
export const AZ = 4.6;
/** A flat's width along the corridor, and its depth into the building. */
export const SLOT = 4.6;
export const SLOTS = 6;
export const RD = 6.0;
export const END_Z = AZ + SLOT * SLOTS;
export const OUTER = CH + RD;
export const DOOR_W = 0.9;
/**
 * Which side of the corridor 612 (and every even number) is on: walking in
 * from the stairs, along +z, the right hand is -x.
 */
export const SIDE612 = -1 as const;
/** The river's surface, under the back of the building. */
export const WATER_Y = -0.6;

export interface Seg {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface Box {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Height: a bed is low, a wardrobe is over your head. */
  h: number;
}

export type DoorKind = 'stair' | 'room' | 'bath';

export interface Door {
  id: string;
  kind: DoorKind;
  floor: number;
  /** The hinge, in world x/z. */
  hx: number;
  hz: number;
  /** The leaf's direction (world, radians from +x towards +z), shut and open. */
  shut: number;
  open: number;
  /** Where the leaf is now, and where it is going: 0 shut .. 1 open. */
  k: number;
  want: number;
  width: number;
  locked: boolean;
  /** Who opened it last: an officer leaves it as he left it. */
  by: 'player' | 'officer' | null;
  pivot: THREE.Group;
  /** The room it opens (room and bath doors). */
  room: Room | null;
  /** Moving: last frame's k, to know when to play the sounds. */
  was: number;
  /** Off its hinges for good (the lobby door Froggy came through). */
  broken?: boolean;
}

export type SpotKind = 'bed' | 'wardrobe' | 'curtain' | 'door';

export interface P3 {
  x: number;
  y: number;
  z: number;
}

export interface HideSpot {
  id: string;
  kind: SpotKind;
  room: Room;
  floor: number;
  /** Where you stand to get in (and where an officer stands to look). */
  approach: { x: number; z: number };
  /** Where you are put back on getting out. */
  exit: { x: number; z: number };
  /** The eye when hidden, and what it looks at. */
  eye: P3;
  look: P3;
  /** The eye when peeking, what it looks at, and the lens. */
  peekEye: P3;
  peekLook: P3;
  peekFov: number;
  /** Where an officer stands to search it, and what he looks at. */
  inspectFrom: { x: number; z: number };
  inspectAt: P3;
  /** Down on one knee to look (under a bed). */
  crouch: boolean;
  /** Opens and closes the furniture: 0 shut .. 1 wide; 0.12 or so for a peek. */
  setOpen: (k: number) => void;
  openK: number;
  /** The bath/WC door this spot is behind, if it is behind one. */
  door: Door | null;
  /** The room node it is searched from. */
  node: NavNode | null;
  /** When an officer last looked in it (the scene's clock), if ever. */
  inspectedAt?: number;
}

export interface Room {
  id: number;
  label: string;
  floor: number;
  side: 1 | -1;
  slot: number;
  open: boolean;
  /** World bounds. */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  door: Door;
  /** The door's middle, on the corridor wall. */
  dz: number;
  spots: HideSpot[];
  group: THREE.Group | null;
  /** Light under the door: a torch inside shows in the gap. */
  gap: THREE.Mesh;
  gapK: number;
  /** Internal route nodes (just inside the door first). */
  nodes: NavNode[];
  /** Where a search starts: the middle of the room. */
  center: NavNode | null;
  /** The corridor node outside its door. */
  outside: NavNode | null;
  /** The last time anybody searched it (seconds, scene clock). */
  searchedAt: number;
  special: 'none' | '612';
}

export interface NavNode {
  id: number;
  x: number;
  z: number;
  /** The floor it is on (in the well: the floor of the landing it belongs to). */
  f: number;
  zone: 'well' | 'corr' | 'room' | 'lobby';
  room: Room | null;
  /** Height (the well's nodes climb; everything else is f * FH). */
  y: number;
  edges: Array<{ to: NavNode; door: Door | null; cost: number }>;
}

export interface Floor {
  f: number;
  group: THREE.Group;
  walls: Seg[];
  boxes: Box[];
  rooms: Room[];
  doors: Door[];
  lights: THREE.Vector3[];
}

// ------------------------------------------------------------------ random

export function seeded(seed: number): () => number {
  let s = (seed >>> 0) % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ------------------------------------------------------------------ textures

function tex(c: HTMLCanvasElement, rx = 1, ry = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function cvs(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  return c;
}

const hx = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** Soft blots of a colour all over a canvas: the low, uneven tone of a real surface. */
function mottle(g: CanvasRenderingContext2D, W: number, H: number, r: () => number, n: number, dark: string, light: string, size: number): void {
  for (let k = 0; k < n; k++) {
    const x = r() * W;
    const y = r() * H;
    const rad = size * (0.4 + r());
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, r() < 0.5 ? dark : light);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    // (wrapped, so the tile has no seam)
    for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
  }
}

/** Painted plaster: an uneven tone, a roller's stipple, the odd hairline, scuffs and a grubby foot. */
function plasterTex(tint: number, seed: number): HTMLCanvasElement {
  const r = seeded(seed);
  const S = 512;
  return cvs(S, S, (g) => {
    g.fillStyle = hx(tint);
    g.fillRect(0, 0, S, S);
    mottle(g, S, S, r, 46, 'rgba(70,55,40,0.07)', 'rgba(255,250,240,0.08)', 90);
    // the roller: a fine stipple, and its faint vertical laps
    for (let k = 0; k < 16000; k++) {
      g.fillStyle = r() < 0.55 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)';
      g.fillRect(r() * S, r() * S, 1 + (r() < 0.2 ? 1 : 0), 1);
    }
    for (let x = 0; x < S; x += 48 + r() * 40) {
      g.fillStyle = 'rgba(0,0,0,0.025)';
      g.fillRect(x, 0, 18 + r() * 14, S);
    }
    // a hairline crack or two
    g.strokeStyle = 'rgba(60,48,36,0.18)';
    g.lineWidth = 0.8;
    for (let k = 0; k < 2; k++) {
      let x = r() * S;
      let y = r() * S * 0.6;
      g.beginPath();
      g.moveTo(x, y);
      for (let i = 0; i < 14; i++) {
        x += (r() - 0.5) * 14;
        y += 4 + r() * 8;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // scuffs low down where furniture has been pushed against it
    for (let k = 0; k < 12; k++) {
      g.fillStyle = `rgba(60,50,40,${0.05 + r() * 0.08})`;
      g.fillRect(r() * S, S * 0.8 + r() * S * 0.16, 14 + r() * 50, 1 + r() * 3);
    }
    const grd = g.createLinearGradient(0, S * 0.84, 0, S);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(40,30,20,0.16)');
    g.fillStyle = grd;
    g.fillRect(0, S * 0.84, S, S * 0.16);
  });
}

/** Floorboards: narrow planks each its own tone, a wavy grain, knots, butt joints, nail heads, a worn sheen. */
function boardsTex(base: number, seed: number): HTMLCanvasElement {
  const r = seeded(seed);
  const S = 512;
  const PW = 32;
  return cvs(S, S, (g) => {
    const col = new THREE.Color(base);
    for (let y = 0; y < S; y += PW) {
      // each run of boards, broken by butt joints at random
      let x = -r() * 200;
      while (x < S) {
        const len = 140 + r() * 220;
        const shade = 0.78 + r() * 0.34;
        const c = col.clone().multiplyScalar(shade);
        c.offsetHSL((r() - 0.5) * 0.02, 0, 0);
        g.fillStyle = hx(c.getHex());
        g.fillRect(x, y, len, PW);
        // the grain: long wavering lines down the board
        for (let k = 0; k < 9; k++) {
          const gy = y + 2 + r() * (PW - 4);
          const amp = 0.6 + r() * 2.2;
          const freq = 0.01 + r() * 0.03;
          const ph = r() * 6;
          g.strokeStyle = `rgba(50,24,6,${0.07 + r() * 0.13})`;
          g.lineWidth = 0.6 + r() * 0.9;
          g.beginPath();
          for (let xx = Math.max(0, x); xx <= Math.min(S, x + len); xx += 6) {
            const yy = gy + Math.sin(xx * freq + ph) * amp;
            if (xx === Math.max(0, x)) g.moveTo(xx, yy);
            else g.lineTo(xx, yy);
          }
          g.stroke();
        }
        // a knot, now and then, with the grain swirling round it
        if (r() < 0.35) {
          const kx = x + 20 + r() * (len - 40);
          const ky = y + 6 + r() * (PW - 12);
          for (let ring = 5; ring > 0; ring--) {
            g.strokeStyle = `rgba(60,30,8,${0.08 + ring * 0.03})`;
            g.beginPath();
            g.ellipse(kx, ky, ring * 2.6, ring * 1.1, 0, 0, Math.PI * 2);
            g.stroke();
          }
          g.fillStyle = 'rgba(50,24,6,0.45)';
          g.beginPath();
          g.ellipse(kx, ky, 2.2, 1.2, 0, 0, Math.PI * 2);
          g.fill();
        }
        // its end: a dark joint, and the two nail heads by it
        g.fillStyle = 'rgba(20,10,2,0.55)';
        g.fillRect(x, y, 1.5, PW);
        g.fillStyle = 'rgba(30,26,22,0.7)';
        g.fillRect(x + 5, y + 6, 2, 2);
        g.fillRect(x + 5, y + PW - 8, 2, 2);
        x += len;
      }
      // the gap between rows, with its shadow and the lit edge of the next
      g.fillStyle = 'rgba(10,5,0,0.6)';
      g.fillRect(0, y, S, 1.5);
      g.fillStyle = 'rgba(255,240,220,0.08)';
      g.fillRect(0, y + 1.5, S, 1);
    }
    // the varnish worn and glossy down the middle of the floor
    const sheen = g.createLinearGradient(0, 0, 0, S);
    sheen.addColorStop(0, 'rgba(255,245,230,0)');
    sheen.addColorStop(0.5, 'rgba(255,245,230,0.07)');
    sheen.addColorStop(1, 'rgba(255,245,230,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, S, S);
    mottle(g, S, S, r, 14, 'rgba(30,15,5,0.06)', 'rgba(255,240,220,0.04)', 70);
  });
}

/** Carpet in a flat: a dense pile, its fibres catching the light, faintly patterned, worn in a path. */
function pileTex(base: number, seed: number): HTMLCanvasElement {
  const r = seeded(seed);
  const S = 256;
  return cvs(S, S, (g) => {
    g.fillStyle = hx(base);
    g.fillRect(0, 0, S, S);
    mottle(g, S, S, r, 20, 'rgba(0,0,0,0.08)', 'rgba(255,255,255,0.05)', 40);
    for (let k = 0; k < 14000; k++) {
      const v = r();
      g.fillStyle = v < 0.45 ? 'rgba(0,0,0,0.12)' : v < 0.9 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.16)';
      g.fillRect(r() * S, r() * S, 1, 1 + (r() < 0.3 ? 1 : 0));
    }
    // a faint woven diamond in the pile
    g.strokeStyle = 'rgba(0,0,0,0.06)';
    g.lineWidth = 2;
    for (let d = -S; d < S * 2; d += 32) {
      g.beginPath();
      g.moveTo(d, 0);
      g.lineTo(d + S, S);
      g.moveTo(d + S, 0);
      g.lineTo(d, S);
      g.stroke();
    }
  });
}

/** Glazed tiles: each its own tone, a gloss on the top edge, grout that is grubby in places. */
function tileTex(base: number, seed: number, size = 32): HTMLCanvasElement {
  const r = seeded(seed);
  const S = 512;
  const T = size * 2;
  return cvs(S, S, (g) => {
    g.fillStyle = '#8e8e88';
    g.fillRect(0, 0, S, S);
    const col = new THREE.Color(base);
    for (let y = 0; y < S; y += T) {
      for (let x = 0; x < S; x += T) {
        g.fillStyle = hx(col.clone().multiplyScalar(0.93 + r() * 0.09).getHex());
        g.fillRect(x + 2, y + 2, T - 4, T - 4);
        const gl = g.createLinearGradient(x, y, x + T, y + T);
        gl.addColorStop(0, 'rgba(255,255,255,0.28)');
        gl.addColorStop(0.35, 'rgba(255,255,255,0)');
        gl.addColorStop(1, 'rgba(0,0,0,0.06)');
        g.fillStyle = gl;
        g.fillRect(x + 2, y + 2, T - 4, T - 4);
        g.fillStyle = 'rgba(255,255,255,0.45)';
        g.fillRect(x + 4, y + 3, T - 10, 1.5);
        if (r() < 0.06) {
          g.fillStyle = 'rgba(60,70,60,0.18)';
          g.fillRect(x, y + T - 3, T, 3);
        }
      }
    }
  });
}

/** A ceiling: textured paint, a fine stipple and a soft unevenness. */
function ceilTex(): HTMLCanvasElement {
  const r = seeded(77);
  const S = 256;
  return cvs(S, S, (g) => {
    g.fillStyle = '#eceae4';
    g.fillRect(0, 0, S, S);
    mottle(g, S, S, r, 18, 'rgba(60,50,40,0.05)', 'rgba(255,255,255,0.06)', 50);
    for (let k = 0; k < 9000; k++) {
      g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)';
      g.fillRect(r() * S, r() * S, 1, 1);
    }
  });
}

/** Woven fabric for a duvet or a chair: a fine cross-hatch over a colour, with a pattern. */
function fabricTex(base: number, seed: number, stripe = false): HTMLCanvasElement {
  const r = seeded(seed);
  return cvs(128, 128, (g) => {
    g.fillStyle = hx(base);
    g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 2) {
      g.fillStyle = 'rgba(0,0,0,0.05)';
      g.fillRect(0, y, 128, 1);
    }
    for (let x = 0; x < 128; x += 2) {
      g.fillStyle = 'rgba(255,255,255,0.04)';
      g.fillRect(x, 0, 1, 128);
    }
    if (stripe) {
      for (let x = 0; x < 128; x += 16) {
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(x, 0, 4, 128);
      }
    } else {
      for (let k = 0; k < 40; k++) {
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.beginPath();
        g.arc(r() * 128, r() * 128, 3 + r() * 4, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
}

/** Wood veneer: long grain, a few knots. */
function veneerTex(base: number, seed: number): HTMLCanvasElement {
  const r = seeded(seed);
  return cvs(128, 256, (g) => {
    g.fillStyle = hx(base);
    g.fillRect(0, 0, 128, 256);
    for (let x = 0; x < 128; x += 2) {
      g.fillStyle = `rgba(50,25,5,${0.04 + r() * 0.08})`;
      g.fillRect(x, 0, 1, 256);
    }
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = 'rgba(50,25,5,0.25)';
      g.beginPath();
      g.ellipse(r() * 128, r() * 256, 4, 10, 0, 0, Math.PI * 2);
      g.stroke();
    }
  });
}

/** A shower curtain: a printed pattern, gathered in vertical folds. */
function curtainTex(base: number, seed: number): HTMLCanvasElement {
  const r = seeded(seed);
  return cvs(256, 256, (g) => {
    g.fillStyle = hx(base);
    g.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 16) {
      const grd = g.createLinearGradient(x, 0, x + 16, 0);
      grd.addColorStop(0, 'rgba(0,0,0,0.12)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.10)');
      grd.addColorStop(1, 'rgba(0,0,0,0.12)');
      g.fillStyle = grd;
      g.fillRect(x, 0, 16, 256);
    }
    for (let k = 0; k < 60; k++) {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.arc(r() * 256, r() * 256, 2 + r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // mildew along the hem
    g.fillStyle = 'rgba(60,70,50,0.18)';
    g.fillRect(0, 238, 256, 18);
  });
}

/** A window at night from inside: the blind, the moon on it. */
function nightWindowTex(seed: number): HTMLCanvasElement {
  const r = seeded(seed);
  return cvs(64, 64, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 64);
    grd.addColorStop(0, '#1a2440');
    grd.addColorStop(1, '#0c1222');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    for (let y = 2; y < 64; y += 4) {
      g.fillStyle = `rgba(140,160,200,${0.08 + r() * 0.06})`;
      g.fillRect(2, y, 60, 2);
    }
  });
}

/** Brick: courses of it, each brick its own tone and edge, recessed mortar, rain streaks and grime. */
function brickTex(seed: number): HTMLCanvasElement {
  const r = seeded(seed);
  const S = 512;
  const BH = 16;
  const BW = 40;
  return cvs(S, S, (g) => {
    g.fillStyle = '#2e2420';
    g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += BH) {
      const off = (y / BH) % 2 ? BW / 2 : 0;
      for (let x = -BW; x < S + BW; x += BW) {
        const t = 0.62 + r() * 0.42;
        const burnt = r() < 0.12;
        const R = Math.round((burnt ? 80 : 128) * t);
        const G2 = Math.round((burnt ? 44 : 64) * t);
        const B = Math.round((burnt ? 38 : 50) * t);
        const bx = x + off + 1.5;
        const by = y + 1.5;
        g.fillStyle = `rgb(${R},${G2},${B})`;
        g.fillRect(bx, by, BW - 3, BH - 3);
        // its face: a little pitting, a lit top edge, a shadowed foot
        for (let k = 0; k < 14; k++) {
          g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,220,200,0.08)';
          g.fillRect(bx + r() * (BW - 4), by + r() * (BH - 4), 1 + r() * 2, 1);
        }
        g.fillStyle = 'rgba(255,220,200,0.12)';
        g.fillRect(bx, by, BW - 3, 1);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(bx, by + BH - 4, BW - 3, 1);
        // a chipped corner, now and then
        if (r() < 0.15) {
          g.fillStyle = '#2e2420';
          g.fillRect(bx + (r() < 0.5 ? 0 : BW - 7), by + (r() < 0.5 ? 0 : BH - 6), 4, 3);
        }
      }
    }
    // the rain down it, from the sills, and the grime
    for (let k = 0; k < 26; k++) {
      const x = r() * S;
      const w = 4 + r() * 18;
      const grd = g.createLinearGradient(0, 0, 0, S);
      grd.addColorStop(0, 'rgba(10,8,6,0.22)');
      grd.addColorStop(1, 'rgba(10,8,6,0)');
      g.fillStyle = grd;
      g.fillRect(x, r() * S * 0.5, w, S * (0.3 + r() * 0.6));
    }
    mottle(g, S, S, r, 20, 'rgba(0,0,0,0.12)', 'rgba(120,100,90,0.05)', 80);
  });
}

/**
 * A window in the building's face, seen from outside at night: a frame and
 * sash bars, and behind the glass either the dark with the moon on it, or a
 * room still up -- warm, with a drawn curtain.  `lit` picks which.
 */
function outWindowTex(seed: number, lit: boolean): HTMLCanvasElement {
  const r = seeded(seed);
  return cvs(64, 64, (g) => {
    g.fillStyle = '#c8c2b6';
    g.fillRect(0, 0, 64, 64);
    const grd = g.createLinearGradient(0, 4, 0, 60);
    if (lit) {
      grd.addColorStop(0, '#e8b868');
      grd.addColorStop(1, '#a8703a');
    } else {
      grd.addColorStop(0, '#24324a');
      grd.addColorStop(1, '#0a1020');
    }
    g.fillStyle = grd;
    g.fillRect(4, 4, 56, 56);
    if (lit) {
      // the curtain, half drawn, in folds
      const cw = 14 + r() * 20;
      for (let x = 4; x < 4 + cw; x += 4) {
        g.fillStyle = x % 8 ? 'rgba(120,60,30,0.55)' : 'rgba(160,90,50,0.55)';
        g.fillRect(x, 4, 4, 56);
      }
    } else {
      // the moon's light on the glass, a diagonal sheen
      g.fillStyle = 'rgba(160,180,220,0.18)';
      g.beginPath();
      g.moveTo(10, 4);
      g.lineTo(24, 4);
      g.lineTo(4, 34);
      g.lineTo(4, 20);
      g.fill();
    }
    // the sash bars and the sill
    g.fillStyle = '#d8d2c6';
    g.fillRect(30, 4, 4, 56);
    g.fillRect(4, 30, 56, 3);
    g.fillStyle = '#8a8478';
    g.fillRect(0, 60, 64, 4);
  });
}

/**
 * A town block's face at night: concrete or render in floors, a grid of
 * windows with most dark and some lit, a cornice at the top.
 */
function facadeTex(seed: number, tone: string): HTMLCanvasElement {
  const r = seeded(seed);
  const W = 128;
  const H = 256;
  return cvs(W, H, (g) => {
    g.fillStyle = tone;
    g.fillRect(0, 0, W, H);
    mottle(g, W, H, r, 10, 'rgba(0,0,0,0.25)', 'rgba(255,255,255,0.03)', 40);
    for (let y = 8; y < H - 8; y += 22) {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, y + 17, W, 2);
      for (let x = 6; x < W - 10; x += 20) {
        const on = r() < 0.22;
        g.fillStyle = on ? (r() < 0.5 ? '#e0a858' : '#c8d0e0') : r() < 0.5 ? '#0a0c12' : '#141a26';
        g.fillRect(x, y, 12, 14);
        if (on) {
          g.fillStyle = 'rgba(255,220,150,0.15)';
          g.fillRect(x - 2, y - 2, 16, 18);
          g.fillStyle = 'rgba(80,40,20,0.4)';
          g.fillRect(x, y, 4 + r() * 4, 14);
        }
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(x + 5.5, y, 1, 14);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(0, 0, W, 4);
  });
}

/** Cracked plaster round the broken window. */
function crackTex(seed: number): HTMLCanvasElement {
  const r = seeded(seed);
  return cvs(256, 256, (g) => {
    g.clearRect(0, 0, 256, 256);
    const crack = (x: number, y: number, a: number, len: number, w: number): void => {
      g.strokeStyle = `rgba(40,30,25,${0.5 + r() * 0.3})`;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, y);
      let cx = x;
      let cy = y;
      for (let i = 0; i < len; i++) {
        a += (r() - 0.5) * 0.7;
        cx += Math.cos(a) * 6;
        cy += Math.sin(a) * 6;
        g.lineTo(cx, cy);
        if (r() < 0.12 && w > 0.6) crack(cx, cy, a + (r() - 0.5) * 2, len / 2, w * 0.6);
      }
      g.stroke();
    };
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      crack(128 + Math.cos(a) * 60, 128 + Math.sin(a) * 50, a, 10 + r() * 8, 1.6);
    }
    // chipped patches where the plaster has come away
    for (let k = 0; k < 10; k++) {
      const a = r() * Math.PI * 2;
      g.fillStyle = 'rgba(150,140,125,0.55)';
      g.beginPath();
      g.ellipse(128 + Math.cos(a) * 70, 128 + Math.sin(a) * 60, 6 + r() * 10, 4 + r() * 6, a, 0, Math.PI * 2);
      g.fill();
    }
  });
}

// ------------------------------------------------------------------ geometry helpers

type Mat = THREE.Material;

function box(w: number, h: number, d: number, m: Mat | Mat[], parent: THREE.Object3D, x: number, y: number, z: number): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

function plane(w: number, h: number, m: Mat, parent: THREE.Object3D, x: number, y: number, z: number, ry = 0, rx = 0): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, 0, 'YXZ');
  parent.add(o);
  return o;
}

// ------------------------------------------------------------------ the building

export interface BuildingOptions {
  seed: number;
}

export class PoliceBuilding {
  readonly root = new THREE.Group();
  readonly well = new THREE.Group();
  readonly exterior = new THREE.Group();
  /** The night sky over the river: the scene's background while it is in view. */
  skyTex: THREE.Texture | null = null;

  readonly floors: Floor[] = [];
  readonly doors: Door[] = [];
  readonly stairDoors: Door[] = [];
  readonly rooms: Room[] = [];
  readonly spots: HideSpot[] = [];
  readonly nodes: NavNode[] = [];
  /** The well's walls, for sight and for bodies (floor-independent). */
  readonly wellWalls: Seg[] = [];
  /** The window of 612: where you stand to look out, and the water under it. */
  readonly window612 = { x: SIDE612 * OUTER, z: 0, sill: 0.9, w: 1.5, h: 1.3 };
  /** The river: where you land in it, under the window, and its surface. */
  readonly below = { x: SIDE612 * (OUTER + 2.6), z: 0, y: WATER_Y };
  /** Animated bits of the building (wardrobe doors, curtains) to step each frame. */
  private tickers: Array<(dt: number) => void> = [];
  private rng: () => number;
  private readonly mats: Record<string, Mat> = {};

  constructor(scene: THREE.Scene, opts: BuildingOptions) {
    this.rng = seeded(opts.seed);
    scene.add(this.root);
    this.root.add(this.well);
    this.root.add(this.exterior);
    this.makeMaterials();
    this.buildWell();
    for (let f = 0; f <= TOP; f++) this.buildFloor(f);
    this.buildExterior();
    this.buildNav();
  }

  // ------------------------------------------------------------ materials

  private makeMaterials(): void {
    const M = this.mats;
    M.white = new THREE.MeshPhongMaterial({ color: 0xf4f2ec, specular: 0x606060, shininess: 70 });
    M.ceramic = new THREE.MeshPhongMaterial({ color: 0xf6f6f2, specular: 0xb0b0b0, shininess: 110 });
    M.chrome = new THREE.MeshPhongMaterial({ color: 0xc8ccd2, specular: 0xffffff, shininess: 120 });
    M.steel = new THREE.MeshPhongMaterial({ color: 0x8a9098, specular: 0x9aa0a8, shininess: 50 });
    M.brass = new THREE.MeshLambertMaterial({ color: 0xa8aeb4, emissive: 0x101214 });
    M.lamp = new THREE.MeshBasicMaterial({ color: 0xfff2d0 });
    M.dark = new THREE.MeshBasicMaterial({ color: 0x05070e });
    M.ceil = new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex(ceilTex(), 3, 3) });
    M.cream = new THREE.MeshLambertMaterial({ color: 0xf0e6cc });
    M.walnut = new THREE.MeshLambertMaterial({ map: tex(veneerTex(0x6a4428, 3)) });
    M.oak = new THREE.MeshLambertMaterial({ map: tex(veneerTex(0xa07a4a, 5)) });
    M.pine = new THREE.MeshLambertMaterial({ map: tex(veneerTex(0xc8a070, 7)) });
    M.whiteWood = new THREE.MeshLambertMaterial({ map: tex(veneerTex(0xe8e4dc, 9)) });
    M.linen = new THREE.MeshLambertMaterial({ map: tex(fabricTex(0xf2efe8, 11, true)) });
    M.pillow = new THREE.MeshLambertMaterial({ color: 0xf8f6f0 });
    M.mattress = new THREE.MeshLambertMaterial({ color: 0xe8e4dc });
    M.slat = new THREE.MeshLambertMaterial({ color: 0x5a4028 });
    M.dust = new THREE.MeshBasicMaterial({ color: 0x8a8478, transparent: true, opacity: 0.5 });
    M.glassNight = new THREE.MeshBasicMaterial({ map: tex(nightWindowTex(3)) });
    M.gap = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    M.mirror = new THREE.MeshPhongMaterial({ color: 0x9aa8b0, specular: 0xffffff, shininess: 140, emissive: 0x101418 });
  }

  // ------------------------------------------------------------ the stairwell

  private buildWell(): void {
    const S = this.well;
    const W = WX * 2;
    const D = LANDING + FLIGHT + LANDING;
    const bottom = -0.3;
    const top = TOP * FH + CEIL;
    const hgt = top - bottom;
    const cz = (WZ0 + WZ1) / 2;
    const blockT = tex(texBlock(), 1, 1);
    const blockMat = (w: number): THREE.MeshLambertMaterial => {
      const t = blockT.clone();
      t.repeat.set(w / 1.6, hgt / 1.6);
      t.needsUpdate = true;
      return new THREE.MeshLambertMaterial({ map: t, color: 0xd8d2c4 });
    };
    plane(D, hgt, blockMat(D), S, -WX, bottom + hgt / 2, cz, Math.PI / 2);
    plane(D, hgt, blockMat(D), S, WX, bottom + hgt / 2, cz, -Math.PI / 2);
    plane(W, hgt, blockMat(W), S, 0, bottom + hgt / 2, WZ0, 0);
    // The +z wall, with a hole at every floor for its fire door.  Built in
    // bands: below each door, the strips either side of it, and over it.
    const back = new THREE.MeshLambertMaterial({ map: (() => { const t = blockT.clone(); t.repeat.set(1, 1); t.needsUpdate = true; return t; })(), color: 0xd8d2c4 });
    for (let f = 0; f <= TOP; f++) {
      const y0 = f * FH;
      const dw = SDOOR.x1 - SDOOR.x0;
      // left of the door, right of the door, over the door, the slab band below
      plane(SDOOR.x0 + WX, FH, back, S, (-WX + SDOOR.x0) / 2, y0 + FH / 2 - 0.3, WZ1, Math.PI);
      plane(WX - SDOOR.x1, FH, back, S, (SDOOR.x1 + WX) / 2, y0 + FH / 2 - 0.3, WZ1, Math.PI);
      plane(dw, FH - 2.15, back, S, (SDOOR.x0 + SDOOR.x1) / 2, y0 + 2.15 + (FH - 2.15) / 2 - 0.3, WZ1, Math.PI);
      if (f === 0) plane(W, 0.3, back, S, 0, -0.15, WZ1, Math.PI);
    }
    const roof = plane(W, D, new THREE.MeshLambertMaterial({ color: 0xb8b2a4 }), S, 0, top, cz, 0, Math.PI / 2);
    void roof;
    this.wellWalls.push(
      { x0: -WX, z0: WZ0, x1: -WX, z1: WZ1 },
      { x0: WX, z0: WZ0, x1: WX, z1: WZ1 },
      { x0: -WX, z0: WZ0, x1: WX, z1: WZ0 },
      { x0: -WX, z0: WZ1, x1: SDOOR.x0, z1: WZ1 },
      { x0: SDOOR.x1, z0: WZ1, x1: WX, z1: WZ1 },
    );

    const slab = new THREE.MeshLambertMaterial({ map: tex(texConcrete('#8a8680'), 2, 1) });
    const under = new THREE.MeshLambertMaterial({ map: tex(texConcrete('#b4aea0'), 1, 3), emissive: 0x2e2a24 });
    const concrete = new THREE.MeshLambertMaterial({ map: tex(texConcrete('#96928a'), 2, 1) });
    const string = new THREE.MeshLambertMaterial({ map: tex(texConcrete('#a29c90'), 1, 4), emissive: 0x1c1a16 });
    const nosingMat = new THREE.MeshLambertMaterial({ color: 0xc8a030 });
    const rail = new THREE.MeshLambertMaterial({ color: 0x8a1a1a });
    const post = new THREE.MeshLambertMaterial({ color: 0x5a5e62 });
    const lamp = new THREE.MeshBasicMaterial({ color: 0xe8f4ff });
    const steps = 10;
    const stepD = FLIGHT / steps;
    const stepH = FH / 2 / steps;
    const stepDeep = stepH + 0.32;
    const stepGeo = new THREE.BoxGeometry(WX - GAP, stepDeep, stepD);
    const treads = new THREE.InstancedMesh(stepGeo, concrete, TOP * steps * 2);
    const nosings = new THREE.InstancedMesh(new THREE.BoxGeometry(WX - GAP, 0.012, 0.05), nosingMat, TOP * steps * 2);
    let ti = 0;
    const m4 = new THREE.Matrix4();
    // the floor of the well at G, all of it
    box(W, 0.2, D, slab, S, 0, -0.1, cz);
    for (let f = 0; f <= TOP; f++) {
      const y0 = f * FH;
      if (f > 0) box(W, 0.2, LANDING, slab, S, 0, y0 - 0.1, LANDING / 2);
      // the floor painted big on the wall beside the door, and the ceiling light
      const name = f === 0 ? 'G' : String(f);
      const sign = plane(0.6, 0.6, new THREE.MeshBasicMaterial({ map: tex(texSign(name, '#c8c2b4', '#7a1a1a', 128, 128)) }), S, -0.75, y0 + 1.7, WZ1 - 0.02, Math.PI);
      void sign;
      box(0.9, 0.05, 0.16, lamp, S, 0, y0 + FH - 0.35, 0.8);
      if (f === 0) {
        const ex = plane(0.5, 0.18, new THREE.MeshBasicMaterial({ map: tex(texSign('LOBBY', '#0e7a3e', '#e8ffe8')) }), S, (SDOOR.x0 + SDOOR.x1) / 2, y0 + 2.35, WZ1 - 0.03, Math.PI);
        void ex;
      }
      if (f === TOP) {
        // nothing goes up from the sixth: the far side railed off
        for (const yy of [0.95, 0.5]) box(WX + GAP, 0.05, 0.05, rail, S, -WX + (WX + GAP) / 2, y0 + yy, 0);
        for (const px of [-WX + 0.05, -0.8]) box(0.03, 0.95, 0.03, post, S, px, y0 + 0.475, 0);
        continue;
      }
      // the half landing over this floor
      box(W, 0.2, LANDING, slab, S, 0, y0 + FH / 2 - 0.1, WZ0 + LANDING / 2);
      // A (x<0) climbs going -z from the floor; B (x>0) climbs going +z from the half landing
      for (const side of [-1, 1]) {
        const x = side * (GAP + (WX - GAP) / 2);
        for (let k = 0; k < steps; k++) {
          const z = side < 0 ? -(k + 0.5) * stepD : -FLIGHT + (k + 0.5) * stepD;
          const topY = side < 0 ? y0 + (k + 1) * stepH : y0 + FH / 2 + (k + 1) * stepH;
          m4.makeTranslation(x, topY - stepDeep / 2, z);
          treads.setMatrixAt(ti, m4);
          const edge = side < 0 ? z + stepD / 2 - 0.025 : z - stepD / 2 + 0.025;
          m4.makeTranslation(x, topY + 0.006, edge);
          nosings.setMatrixAt(ti, m4);
          ti++;
        }
        const slope = Math.atan2(FH / 2, FLIGHT);
        const tilt = side < 0 ? slope : -slope;
        const len = Math.hypot(FH / 2, FLIGHT);
        const ymid = side < 0 ? y0 + FH / 4 : y0 + (3 * FH) / 4;
        const u = box(WX - GAP, 0.2, len, under, S, x, ymid - 0.45, -FLIGHT / 2);
        u.rotation.x = tilt;
        const sh = 0.78;
        const st = box(0.07, sh * Math.cos(slope), len + 0.02, string, S, side * (GAP + 0.035), ymid + 0.14 - sh / 2, -FLIGHT / 2);
        st.rotation.x = tilt;
        const r = box(0.05, 0.05, len + 0.1, rail, S, side * GAP, ymid + 0.95, -FLIGHT / 2);
        r.rotation.x = tilt;
        for (let k = 0; k <= 3; k++) {
          const pz = -(k / 3) * FLIGHT;
          const py = side < 0 ? y0 + (k / 3) * (FH / 2) : y0 + FH - (k / 3) * (FH / 2);
          box(0.03, 0.95, 0.03, post, S, side * GAP, py + 0.475, pz);
        }
      }
      box(GAP * 2 + 0.05, 0.05, 0.05, rail, S, 0, y0 + FH / 2 + 0.95, -FLIGHT);
      // (not at G: nothing comes down to meet it there, so it was a stub of
      // rail sticking out over the foot of the first flight)
      if (f > 0) box(GAP * 2 + 0.05, 0.05, 0.05, rail, S, 0, y0 + 0.95, 0);
    }
    // (at G the floor runs under the second flight, as at the foot of the
    // stairs Froggy chases you down: no rail across it into the wall)
    treads.count = ti;
    nosings.count = ti;
    S.add(treads);
    S.add(nosings);

    // the fire doors, one a floor
    const fireMat = new THREE.MeshLambertMaterial({ map: tex(texFireDoor()) });
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x4a5048 });
    for (let f = 0; f <= TOP; f++) {
      const d = this.makeDoor({
        id: `stair-${f}`,
        kind: 'stair',
        floor: f,
        // hinged on the right as you come out of the well; into the corridor
        hx: SDOOR.x1,
        hz: SDOOR.z,
        shut: Math.PI,
        open: Math.PI / 2,
        width: SDOOR.x1 - SDOOR.x0,
        locked: f === 0,
        front: fireMat,
        back: fireMat,
        parent: S,
        y: f * FH,
      });
      // the kick plate and the push bar on the well side
      box(0.7, 0.04, 0.04, this.mats.steel, d.pivot, 0.45, 1.0, -0.04);
      this.stairDoors.push(d);
      // THE FRAME: a steel jamb either side and a head over it, through the
      // wall and standing proud of both faces, lapping the edges of the leaf
      // -- no slit of the corridor's light down the sides, no gap over the
      // top, from the stairs or from the corridor
      const y0 = f * FH;
      // (at G the leaf is gone and the doorway opens straight on the lobby, where
      // a frame 0.2 m deep stood out of the wall like a stub of masonry: there it
      // is a flat trim, flush with the wall's thickness, slim jambs)
      const fz = f === 0 ? 0.06 : 0.2;
      for (const [x, w] of [
        [SDOOR.x0 - (f === 0 ? 0.025 : 0.035), f === 0 ? 0.06 : 0.1],
        [SDOOR.x1 + (f === 0 ? 0.025 : 0.035), f === 0 ? 0.06 : 0.1],
      ] as const)
        box(w, 2.24, fz, frameMat, S, x, y0 + 1.12, SDOOR.z);
      box(SDOOR.x1 - SDOOR.x0 + (f === 0 ? 0.11 : 0.17), f === 0 ? 0.09 : 0.12, fz, frameMat, S, (SDOOR.x0 + SDOOR.x1) / 2, y0 + 2.18, SDOOR.z);
      // the stops the leaf shuts against, inside the jambs and under the head
      // (not at G: there is no leaf there now, and with nothing to shut
      // against them they read as a second, smaller frame inside the first)
      if (f > 0) {
        for (const x of [SDOOR.x0 + 0.012, SDOOR.x1 - 0.012]) box(0.03, 2.1, 0.04, frameMat, S, x, y0 + 1.07, SDOOR.z - 0.05);
        box(SDOOR.x1 - SDOOR.x0, 0.03, 0.04, frameMat, S, (SDOOR.x0 + SDOOR.x1) / 2, y0 + 2.115, SDOOR.z - 0.05);
      }
      // the threshold
      box(SDOOR.x1 - SDOOR.x0 + 0.1, 0.015, fz, this.mats.steel, S, (SDOOR.x0 + SDOOR.x1) / 2, y0 + 0.008, SDOOR.z);
    }
    this.breakLobbyDoor(S, fireMat);
  }

  /**
   * THE LOBBY DOOR, AS FROGGY LEFT IT.  He came through it after you on the
   * night (the janitor room), so it is off its hinges and out on the lobby
   * floor where it landed, the frame split where the hinges tore out -- and
   * through the doorway is the lobby itself, as it is from the janitor's
   * room: the big grey tiles and the dark runner, wallpaper over panelling,
   * the grey sofa against the front wall with its low table, the steel bin
   * by it, the sconces -- lit warm, with the police lights from the front
   * doors going round in it.  Open for good (the officers come up through
   * it); you cannot go back down into the lobby.
   */
  private breakLobbyDoor(S: THREE.Object3D, fireMat: Mat): void {
    const d = this.stairDoors[0];
    d.k = d.want = 1;
    d.pivot.visible = false;
    d.broken = true;
    const w = SDOOR.x1 - SDOOR.x0;
    const edge = this.mats.walnut;
    const LZ = (z: number) => WZ1 + z;
    // ---- THE LOBBY ITSELF: the janitor's-room scene's own, built by the
    // same code (three/hotelLobby), set so that its stairwell door is this
    // doorway.  Looking out you face across it at the front wall -- the
    // sofa, its table and the bin under the sconce, square on -- with the
    // smashed front doors away on your right and the storage room on your
    // left.  The night after: the door gone, the front doors in pieces.
    const lobby = new THREE.Group();
    lobby.position.set(LOBBY.dx, 0, WZ1);
    S.add(lobby);
    buildHotelLobby(lobby, { police: true });
    // the police lights, out past the smashed front doors, washing in
    const flash = new THREE.PointLight(0xff2a3a, 0, 16, 1.1);
    flash.position.set(LOBBY.x0 - 1.5, 1.8, LOBBY.doorZ);
    S.add(flash);
    // ---- the door, where it came down: out on the lobby floor, face up,
    // its top end on the lip of the runner and the push bar towards you
    // (its length out across the lobby floor, away from the wall: laid the
    // other way it ran back through the wall it came out of)
    const leaf = new THREE.Group();
    leaf.position.set(SDOOR.x1 + 0.35, 0.03, LZ(0.45));
    leaf.rotation.set(-Math.PI / 2 + 0.03, Math.PI - 0.35, 0, 'YXZ');
    S.add(leaf);
    box(w - 0.02, 2.08, 0.045, [edge, edge, edge, edge, fireMat, fireMat], leaf, w / 2, 1.04, 0);
    box(0.7, 0.04, 0.04, this.mats.steel, leaf, w / 2, 1.0, 0.04);
    box(0.22, 0.3, 0.02, new THREE.MeshLambertMaterial({ color: 0x3a3a3c }), leaf, w / 2 + 0.1, 1.5, 0.03);
    for (const y of [0.25, 1.85]) box(0.03, 0.12, 0.05, this.mats.chrome, leaf, 0.01, y, 0);
    // what came away with it: splinters of the frame and plaster on the tiles
    const wood = new THREE.MeshLambertMaterial({ color: 0x6a5a48 });
    const plaster = new THREE.MeshLambertMaterial({ color: 0xd8d2c4 });
    let seed = 77;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 14; k++) {
      const bit = box(0.03 + rnd() * 0.08, 0.02, 0.02 + rnd() * 0.05, k % 3 ? plaster : wood, S, SDOOR.x0 - 0.3 + rnd() * 1.6, 0.012, LZ(0.15 + rnd() * 1.4));
      bit.rotation.y = rnd() * Math.PI;
    }
    // the frame where the hinges were: three torn hinge plates on the steel
    // jamb's face, on the lobby side (a dark strip and splinters set inside
    // the jamb stuck through it, in the wall)
    for (const y of [0.25, 1.05, 1.85]) box(0.035, 0.11, 0.008, this.mats.steel, S, SDOOR.x1 + 0.005, y, WZ1 + 0.105);
    let t = 0;
    this.addTicker((dt) => {
      t += dt;
      const ph = Math.sin(t * 6);
      flash.color.setHex(ph > 0 ? 0xff2a3a : 0x2a5aff);
      flash.intensity = 2.2 * Math.abs(ph);

    });
  }

  // ------------------------------------------------------------ a door

  private makeDoor(o: {
    id: string;
    kind: DoorKind;
    floor: number;
    hx: number;
    hz: number;
    shut: number;
    open: number;
    width: number;
    locked: boolean;
    front: Mat;
    back: Mat;
    parent: THREE.Object3D;
    y: number;
    /** Local hinge, if the parent is a mirrored room group. */
    local?: { x: number; z: number; shut: number };
    room?: Room | null;
  }): Door {
    const pivot = new THREE.Group();
    const lx = o.local?.x ?? o.hx;
    const lz = o.local?.z ?? o.hz;
    pivot.position.set(lx, o.parent === this.well ? o.y : 0, lz);
    o.parent.add(pivot);
    // the leaf runs along the pivot's +x; 4 cm thick, a gap under it
    const edge = this.mats.walnut;
    const leaf = box(o.width - 0.02, 2.08, 0.045, [edge, edge, edge, edge, o.front, o.back], pivot, o.width / 2, 1.06, 0);
    leaf.name = 'leaf';
    // the lever handles, both sides, at the latch end
    for (const s of [1, -1]) {
      const rose = box(0.05, 0.05, 0.012, this.mats.chrome, pivot, o.width - 0.1, 1.0, s * 0.03);
      void rose;
      box(0.12, 0.018, 0.018, this.mats.chrome, pivot, o.width - 0.15, 1.0, s * 0.05);
    }
    const d: Door = {
      id: o.id,
      kind: o.kind,
      floor: o.floor,
      hx: o.hx,
      hz: o.hz,
      shut: o.shut,
      open: o.open,
      k: 0,
      want: 0,
      width: o.width,
      locked: o.locked,
      by: null,
      pivot,
      room: o.room ?? null,
      was: 0,
    };
    (pivot.userData as { door: Door; localShut?: number; mirror?: number }).door = d;
    (pivot.userData as { localShut?: number }).localShut = o.local?.shut ?? o.shut;
    this.doors.push(d);
    this.poseDoor(d);
    return d;
  }

  /** The leaf's world direction now. */
  static angle(d: Door): number {
    let delta = d.open - d.shut;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return d.shut + delta * d.k;
  }

  /** The leaf as a wall: hinge to latch. */
  static leaf(d: Door): Seg {
    const a = PoliceBuilding.angle(d);
    return { x0: d.hx, z0: d.hz, x1: d.hx + Math.cos(a) * d.width, z1: d.hz + Math.sin(a) * d.width };
  }

  poseDoor(d: Door): void {
    const ud = d.pivot.userData as { localShut: number; mirror?: number };
    let delta = d.open - d.shut;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    // in a mirrored room the local swing goes the other way round
    const m = ud.mirror ?? 1;
    const local = ud.localShut + delta * d.k * m;
    d.pivot.rotation.y = -local;
  }

  // ------------------------------------------------------------ a floor

  private buildFloor(f: number): void {
    const group = new THREE.Group();
    group.position.y = f * FH;
    this.root.add(group);
    const fl: Floor = { f, group, walls: [], boxes: [], rooms: [], doors: [], lights: [] };
    this.floors.push(fl);
    if (f === 0) {
      // G: the lobby itself is drawn with the stairwell (see `breakLobbyDoor`);
      // here only where the officers waiting in it can walk
      const L = LOBBY;
      fl.walls.push(
        { x0: L.x0, z0: L.z0, x1: SDOOR.x0, z1: L.z0 },
        { x0: SDOOR.x1, z0: L.z0, x1: L.x1, z1: L.z0 },
        { x0: L.x0, z0: L.z1, x1: L.x1, z1: L.z1 },
        { x0: L.x0, z0: L.z0, x1: L.x0, z1: L.z1 },
        { x0: L.x1, z0: L.z0, x1: L.x1, z1: L.z1 },
      );
      // the desk, the sofa and its table, the bin: in the way
      fl.boxes.push(
        { x0: L.desk.x - 1.9, x1: L.desk.x + 1.9, z0: L.desk.z - 0.42, z1: L.desk.z + 0.42, h: 1.15 },
        { x0: L.sofa.x - 1.1, x1: L.sofa.x + 1.1, z0: L.sofa.z - 1.4, z1: L.sofa.z + 0.5, h: 0.8 },
        { x0: L.bin.x - 0.3, x1: L.bin.x + 0.3, z0: L.bin.z - 0.3, z1: L.bin.z + 0.3, h: 0.8 },
      );
      return;
    }
    const paperT = tex(texWallpaper(), 1, 1);
    const panelT = tex(texWainscot(), 1, 1);
    const paper = (len: number): THREE.MeshLambertMaterial => {
      const t = paperT.clone();
      t.repeat.set(len, 1);
      t.needsUpdate = true;
      return new THREE.MeshLambertMaterial({ map: t });
    };
    const panel = (len: number): THREE.MeshLambertMaterial => {
      const t = panelT.clone();
      t.repeat.set(len / 0.8, 1);
      t.needsUpdate = true;
      return new THREE.MeshLambertMaterial({ map: t });
    };
    const DADO = 0.95;
    /** A wall of the corridor, facing the way `ry` says, from (x0,z0) to (x1,z1). */
    const wall = (x0: number, z0: number, x1: number, z1: number, ry: number): void => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 0.01) return;
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      plane(len, CEIL - DADO, paper(len), group, mx, DADO + (CEIL - DADO) / 2, mz, ry);
      plane(len, DADO, panel(len), group, mx, DADO / 2, mz, ry);
      const crown = box(len, 0.05, 0.03, new THREE.MeshLambertMaterial({ color: 0x3a3d44 }), group, mx, CEIL - 0.07, mz);
      crown.rotation.y = ry;
      fl.walls.push({ x0, z0, x1, z1 });
    };
    // the alcove: the end wall with the fire door and the lift, the sides
    wall(-AH, WZ1, SDOOR.x0, WZ1, 0);
    wall(SDOOR.x1, WZ1, AH, WZ1, 0);
    plane(SDOOR.x1 - SDOOR.x0, CEIL - 2.15, paper(1), group, (SDOOR.x0 + SDOOR.x1) / 2, 2.15 + (CEIL - 2.15) / 2, WZ1 + 0.001, 0);
    wall(-AH, WZ1, -AH, AZ, Math.PI / 2);
    wall(AH, WZ1, AH, AZ, -Math.PI / 2);
    wall(-AH, AZ, -CH, AZ, Math.PI);
    wall(CH, AZ, AH, AZ, Math.PI);
    wall(-CH, END_Z, CH, END_Z, Math.PI);
    // the lift, dead, and the exit sign over the fire door
    plane(1.4, 2.3, new THREE.MeshLambertMaterial({ map: tex(texLiftDoors()) }), group, -1.6, 1.15, WZ1 + 0.012, 0);
    box(0.5, 0.18, 0.04, new THREE.MeshLambertMaterial({ color: 0x120c08 }), group, -1.6, 2.45, WZ1 + 0.03);
    box(0.14, 0.3, 0.03, this.mats.brass, group, -0.6, 1.2, WZ1 + 0.02);
    plane(0.5, 0.18, new THREE.MeshBasicMaterial({ map: tex(texSign('EXIT', '#0e7a3e', '#e8ffe8')) }), group, (SDOOR.x0 + SDOOR.x1) / 2, 2.35, WZ1 + 0.03, 0);
    // a floor number on the alcove wall, big, for whoever comes out of the stairs
    plane(0.5, 0.5, new THREE.MeshBasicMaterial({ map: tex(texSign(String(f), '#efe6cc', '#7a5a2a', 128, 128)) }), group, AH - 0.02, 1.6, 3.1, -Math.PI / 2);

    // the floor: the lattice carpet down the corridor, its border, the alcove
    const corrLen = END_Z - AZ;
    const carpet = plane(CH * 2, corrLen, new THREE.MeshLambertMaterial({ map: tex(texCarpet(), (CH * 2) / 0.6, corrLen / 0.6) }), group, 0, 0, (AZ + END_Z) / 2, 0, -Math.PI / 2);
    void carpet;
    for (const sx of [-1, 1]) {
      plane(0.24, corrLen, new THREE.MeshLambertMaterial({ map: tex(texCarpetBorder(), 1, corrLen / 0.6) }), group, sx * (CH - 0.12), 0.004, (AZ + END_Z) / 2, 0, -Math.PI / 2);
    }
    plane(AH * 2, AZ - WZ1, new THREE.MeshLambertMaterial({ map: tex(texCarpet(), (AH * 2) / 0.6, (AZ - WZ1) / 0.6) }), group, 0, 0, (WZ1 + AZ) / 2, 0, -Math.PI / 2);
    // the ceiling over all of it, and its fittings (lit by the scene's pool of lights)
    plane(AH * 2, END_Z - WZ1, this.mats.ceil, group, 0, CEIL, (WZ1 + END_Z) / 2, 0, Math.PI / 2);
    for (let z = 3.1; z < END_Z; z += 4.4) {
      const fit = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.05, 16), this.mats.lamp);
      fit.position.set(0, CEIL - 0.03, z);
      group.add(fit);
      fl.lights.push(new THREE.Vector3(0, f * FH + CEIL - 0.3, z));
    }
    // the steel wall lights between the doors
    for (let k = 0; k < SLOTS; k++) {
      const z = AZ + k * SLOT + SLOT / 2;
      for (const side of [-1, 1]) {
        box(0.04, 0.3, 0.08, this.mats.brass, group, side * (CH - 0.02), 1.85, z);
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.26, 12), this.mats.brass);
        s.position.set(side * (CH - 0.1), 1.85, z);
        group.add(s);
      }
    }

    // ---- the flats
    const r = this.rng;
    const order: Array<{ side: 1 | -1; slot: number }> = [];
    for (let k = 0; k < SLOTS; k++) for (const side of [-1, 1] as const) order.push({ side, slot: k });
    // about a third open, at least three a floor, and 612 always (see buildRoom)
    const want = new Set<number>();
    // (612 is open anyway, so on the top floor it is never one of the three)
    const special612 = f === TOP ? order.findIndex((o) => o.side === SIDE612 && o.slot === SLOTS - 1) : -1;
    const shuffled = [...order.keys()].filter((i) => i !== special612).sort(() => r() - 0.5);
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) want.add(shuffled[i]);
    // never a floor whose only open flats are at the far end: one near the stairs
    if (![0, 1, 2, 3].some((i) => want.has(i))) want.add(Math.floor(r() * 4));
    order.forEach(({ side, slot }, i) => {
      const num = slot * 2 + (side === SIDE612 ? 2 : 1);
      const special = f === TOP && side === SIDE612 && slot === SLOTS - 1;
      this.buildRoom(fl, side, slot, f * 100 + num, special || want.has(i), special);
    });
    // the corridor's long walls, with the doorways left in them
    for (const side of [-1, 1] as const) {
      const gaps = fl.rooms.filter((rm) => rm.side === side).map((rm) => [rm.dz - DOOR_W / 2, rm.dz + DOOR_W / 2]).sort((a, b) => a[0] - b[0]);
      let z = AZ;
      const x = side * CH;
      const ry = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      for (const [g0, g1] of gaps) {
        wall(x, z, x, g0, ry);
        // over the door
        plane(DOOR_W, CEIL - 2.15, paper(1), group, x, 2.15 + (CEIL - 2.15) / 2, (g0 + g1) / 2, ry);
        z = g1;
      }
      wall(x, z, x, END_Z, ry);
    }
  }

  // ------------------------------------------------------------ a flat

  private buildRoom(fl: Floor, side: 1 | -1, slot: number, id: number, open: boolean, special: boolean): void {
    const r = this.rng;
    const z0 = AZ + slot * SLOT;
    // which end of the slot the door is at, and so which way the plan runs
    const flip = special ? true : r() < 0.5;
    const B = (b: number): number => (flip ? SLOT - b : b);
    const doorB = B(0.7);
    const dz = z0 + doorB;
    const wx = (a: number): number => side * (CH + a);
    const room: Room = {
      id,
      label: String(id),
      floor: fl.f,
      side,
      slot,
      open,
      x0: Math.min(wx(0), wx(RD)),
      x1: Math.max(wx(0), wx(RD)),
      z0,
      z1: z0 + SLOT,
      door: null as unknown as Door,
      dz,
      spots: [],
      group: null,
      gap: null as unknown as THREE.Mesh,
      gapK: 0,
      nodes: [],
      center: null,
      outside: null,
      searchedAt: -1e9,
      special: special ? '612' : 'none',
    };
    fl.rooms.push(room);
    this.rooms.push(room);

    // The room's own frame: local a = into the room from the corridor wall,
    // b = along the corridor from the slot's start.  World x = side*(CH + a).
    const g = new THREE.Group();
    g.position.set(side * CH, 0, z0);
    g.scale.x = side;
    fl.group.add(g);
    room.group = g;

    // the door, hinged at the slot-end side of its opening, swinging in
    const hingeB = B(0.25);
    const shutLocal = flip ? -Math.PI / 2 : Math.PI / 2;
    // world: the leaf runs along z, then swings into the room (along +x for
    // side +1, -x for side -1)
    const shutW = flip ? -Math.PI / 2 : Math.PI / 2;
    const openW = side > 0 ? 0 : Math.PI;
    const doorFace = tex(texRoomDoor(room.label, special));
    // (the left-hand flats are built mirrored: turn the number back the right way)
    if (side < 0) {
      doorFace.repeat.x = -1;
      doorFace.offset.x = 1;
    }
    const front = new THREE.MeshLambertMaterial({ map: doorFace });
    const back = new THREE.MeshLambertMaterial({ map: tex(veneerTex(0x7a5230, id)) });
    const door = this.makeDoor({
      id: `room-${id}`,
      kind: 'room',
      floor: fl.f,
      hx: wx(0),
      hz: z0 + hingeB,
      shut: shutW,
      open: openW,
      width: DOOR_W,
      locked: !open,
      // the number faces the corridor: with the leaf along +b the corridor is
      // its local -z side, along -b its +z side
      front: flip ? back : front,
      back: flip ? front : back,
      parent: g,
      y: 0,
      local: { x: 0, z: hingeB, shut: shutLocal },
      room,
    });
    // a mirrored room turns its door the other way round
    (door.pivot.userData as { mirror: number }).mirror = side;
    room.door = door;
    fl.doors.push(door);
    // the casing on the corridor side, cream, round the opening
    for (const [db, w, hh, y] of [
      [-0.5, 0.08, 2.22, 1.11],
      [0.5, 0.08, 2.22, 1.11],
      [0, 1.08, 0.08, 2.18],
    ] as const) {
      box(0.04, hh, w, this.mats.cream, g, -0.02, y, doorB + db);
    }
    // the light under the door: lit by a torch inside, seen from the corridor
    const gap = plane(DOOR_W - 0.06, 0.03, this.mats.gap.clone(), g, -0.03, 0.016, doorB, -Math.PI / 2);
    gap.renderOrder = 6;
    gap.userData.noShadow = true;
    room.gap = gap;

    // the walls either side (shared with the next flat; built by both, harmless)
    fl.walls.push({ x0: wx(0), z0, x1: wx(RD), z1: z0 }, { x0: wx(0), z0: z0 + SLOT, x1: wx(RD), z1: z0 + SLOT }, { x0: wx(RD), z0, x1: wx(RD), z1: z0 + SLOT });

    if (special) {
      this.build612(fl, room, g, B, wx);
      return;
    }
    if (!open) return;

    // ---- an open flat: walls, floor, ceiling, window, and one of three plans
    const tints = [0xe8e0d0, 0xdfe4dc, 0xe6dccc, 0xd8dce4, 0xeae2d8, 0xd8ccc0];
    // (a faint glow of their own: the flats are lit only from the corridor and
    // by your own light, and a wall turned away from both read as a black hole)
    const wallMat = new THREE.MeshLambertMaterial({ map: tex(plasterTex(tints[Math.floor(r() * tints.length)], id), 2, 1), emissive: 0x1e1b16 });
    const woodFloor = r() < 0.55;
    const floorMat = woodFloor
      ? new THREE.MeshLambertMaterial({ map: tex(boardsTex([0x9a6a40, 0xb08050, 0x7a5a3a][Math.floor(r() * 3)], id + 1), 2, 2) })
      : new THREE.MeshLambertMaterial({ map: tex(pileTex([0x5a6a7a, 0x7a5a5a, 0x6a6a5a, 0x4a5a4a][Math.floor(r() * 4)], id + 1), 4, 4) });
    plane(RD, SLOT, floorMat, g, RD / 2, 0.002, SLOT / 2, 0, -Math.PI / 2);
    plane(RD, SLOT, this.mats.ceil, g, RD / 2, CEIL, SLOT / 2, 0, Math.PI / 2);
    // inside faces of the four walls (the corridor wall's back, with the door hole)
    plane(SLOT, CEIL, wallMat, g, RD - 0.001, CEIL / 2, SLOT / 2, -Math.PI / 2);
    plane(RD, CEIL, wallMat, g, RD / 2, CEIL / 2, 0.001, 0);
    plane(RD, CEIL, wallMat, g, RD / 2, CEIL / 2, SLOT - 0.001, Math.PI);
    {
      const d0 = doorB - DOOR_W / 2;
      const d1 = doorB + DOOR_W / 2;
      plane(d0, CEIL, wallMat, g, 0.001, CEIL / 2, d0 / 2, Math.PI / 2);
      plane(SLOT - d1, CEIL, wallMat, g, 0.001, CEIL / 2, (d1 + SLOT) / 2, Math.PI / 2);
      plane(DOOR_W, CEIL - 2.15, wallMat, g, 0.001, 2.15 + (CEIL - 2.15) / 2, doorB, Math.PI / 2);
    }
    // a skirting board round the room
    for (const [w, x, z, ry] of [
      [SLOT, RD - 0.01, SLOT / 2, Math.PI / 2],
      [RD, RD / 2, 0.01, 0],
      [RD, RD / 2, SLOT - 0.01, 0],
    ] as const) {
      const sk = box(w, 0.08, 0.015, this.mats.whiteWood, g, x, 0.04, z);
      sk.rotation.y = ry;
    }
    // a ceiling light, off, and a smoke alarm
    box(0.3, 0.04, 0.3, this.mats.white, g, RD / 2, CEIL - 0.02, SLOT / 2);
    const smoke = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), this.mats.white);
    smoke.position.set(1.2, CEIL - 0.015, SLOT / 2);
    g.add(smoke);

    const plan = r();
    const kind = plan < 0.4 ? 'A' : plan < 0.72 ? 'B' : 'C';
    const ctx = new RoomCtx(this, fl, room, g, B, wx, flip, wallMat, r);
    if (kind === 'A') ctx.planA(r() < 0.55);
    else if (kind === 'B') ctx.planB();
    else ctx.planC();
  }

  // ------------------------------------------------------------ 612

  private build612(fl: Floor, room: Room, g: THREE.Group, B: (b: number) => number, wx: (a: number) => number): void {
    const r = this.rng;
    // the door he took off its hinges: open, and staying open, its leaf down
    room.door.k = 1;
    room.door.want = 1;
    room.door.locked = false;
    const leaf = room.door.pivot.getObjectByName('leaf');
    if (leaf) {
      // lying where it fell, inside the room against the wall
      room.door.pivot.visible = false;
      const fallen = leaf.clone();
      fallen.position.set(0.7, 0.03, B(1.6));
      fallen.rotation.set(-Math.PI / 2, 0, 0.3);
      g.add(fallen);
    }
    // white walls with a speckle, pale boards: the room from the pixel one
    const white = new THREE.MeshLambertMaterial({ map: tex(plasterTex(0xf2f0ec, 612), 2, 1) });
    const boards = new THREE.MeshLambertMaterial({ map: tex(boardsTex(0xb88450, 613), 2, 2) });
    plane(RD, SLOT, boards, g, RD / 2, 0.002, SLOT / 2, 0, -Math.PI / 2);
    plane(RD, SLOT, this.mats.ceil, g, RD / 2, CEIL, SLOT / 2, 0, Math.PI / 2);
    plane(RD, CEIL, white, g, RD / 2, CEIL / 2, 0.001, 0);
    plane(RD, CEIL, white, g, RD / 2, CEIL / 2, SLOT - 0.001, Math.PI);
    const doorB = B(0.7);
    {
      const d0 = Math.min(doorB, SLOT - doorB) - DOOR_W / 2;
      void d0;
      const lo = doorB - DOOR_W / 2;
      const hi = doorB + DOOR_W / 2;
      plane(lo, CEIL, white, g, 0.001, CEIL / 2, lo / 2, Math.PI / 2);
      plane(SLOT - hi, CEIL, white, g, 0.001, CEIL / 2, (hi + SLOT) / 2, Math.PI / 2);
      plane(DOOR_W, CEIL - 2.15, white, g, 0.001, 2.15 + (CEIL - 2.15) / 2, doorB, Math.PI / 2);
    }
    // the splintered frame round the doorway
    for (let k = 0; k < 9; k++) {
      const s = box(0.03 + r() * 0.03, 0.15 + r() * 0.35, 0.03, this.mats.walnut, g, 0.04, 0.3 + r() * 1.7, doorB + (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.04));
      s.rotation.set(r(), r(), r());
    }
    // ---- THE WINDOW: in the outside wall, the middle of the room
    const W = this.window612;
    const wb = SLOT / 2;
    W.z = room.z0 + wb;
    W.x = wx(RD);
    this.below.z = W.z;
    this.below.x = wx(RD) + side(room) * 2.6;
    const sill = W.sill;
    const top = sill + W.h;
    const half = W.w / 2;
    // the wall round the hole
    plane(SLOT, sill, white, g, RD - 0.001, sill / 2, SLOT / 2, -Math.PI / 2);
    plane(SLOT, CEIL - top, white, g, RD - 0.001, top + (CEIL - top) / 2, SLOT / 2, -Math.PI / 2);
    plane(wb - half, W.h, white, g, RD - 0.001, sill + W.h / 2, (wb - half) / 2, -Math.PI / 2);
    plane(SLOT - wb - half, W.h, white, g, RD - 0.001, sill + W.h / 2, (wb + half + SLOT) / 2, -Math.PI / 2);
    // the depth of the reveal, and the cracked plaster round it
    const reveal = new THREE.MeshLambertMaterial({ color: 0xd8d2c8 });
    box(0.28, 0.04, W.w, reveal, g, RD + 0.14, sill, wb);
    box(0.28, 0.04, W.w, reveal, g, RD + 0.14, top, wb);
    box(0.28, W.h, 0.04, reveal, g, RD + 0.14, sill + W.h / 2, wb - half);
    box(0.28, W.h, 0.04, reveal, g, RD + 0.14, sill + W.h / 2, wb + half);
    const crack = new THREE.MeshLambertMaterial({ map: tex(crackTex(612)), transparent: true, depthWrite: false });
    plane(W.w * 2, W.h * 2, crack, g, RD - 0.004, sill + W.h / 2, wb, -Math.PI / 2);
    // the frame: white, with the sash bar half torn out
    const frame = this.mats.whiteWood;
    box(0.08, 0.06, W.w + 0.1, frame, g, RD + 0.06, sill + 0.03, wb);
    box(0.08, 0.06, W.w + 0.1, frame, g, RD + 0.06, top - 0.03, wb);
    box(0.08, W.h, 0.06, frame, g, RD + 0.06, sill + W.h / 2, wb - half + 0.03);
    box(0.08, W.h, 0.06, frame, g, RD + 0.06, sill + W.h / 2, wb + half - 0.03);
    // (hanging down the side of the frame, out of the way of the hole)
    const bar = box(0.05, 0.05, W.w * 0.5, frame, g, RD + 0.08, sill + W.h * 0.35, wb + half - 0.12);
    bar.rotation.x = 1.25;
    // the glass that is left: jagged teeth round the frame, each its own shard
    // (a dull, dark pane: a white-hot specular under their torches turned each
    // tooth into a flat white triangle right across the view out)
    const glass = new THREE.MeshPhongMaterial({ color: 0x6a8290, specular: 0x2a343c, shininess: 40, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false, emissive: 0x0c1218 });
    const edgeGlass = new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    const shard = (pts: Array<[number, number]>): void => {
      const s = new THREE.Shape();
      s.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
      s.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(s), glass);
      m.position.set(RD + 0.07, 0, 0);
      m.rotation.y = -Math.PI / 2;
      m.renderOrder = 7;
      g.add(m);
      // a bright edge along the break
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(([u, v]) => new THREE.Vector3(u, v, 0))), new THREE.LineBasicMaterial({ color: 0xc0d4e0, transparent: true, opacity: 0.55 }));
      line.position.copy(m.position);
      line.rotation.copy(m.rotation);
      g.add(line);
      void edgeGlass;
    };
    // in the window's own plane: u along the wall (-b), v up
    const u0 = wb - half + 0.05;
    const u1 = wb + half - 0.05;
    const v0 = sill + 0.05;
    const v1 = top - 0.05;
    const steps = 9;
    for (let k = 0; k < steps; k++) {
      const a = u0 + ((u1 - u0) * k) / steps;
      const b = u0 + ((u1 - u0) * (k + 1)) / steps;
      const tip = (a + b) / 2 + (r() - 0.5) * 0.06;
      // from the top rail, down; from the sill, up
      shard([[a, v1], [b, v1], [tip, v1 - 0.06 - r() * 0.32]]);
      if (r() < 0.75) shard([[a, v0], [b, v0], [tip, v0 + 0.05 + r() * 0.28]]);
    }
    for (let k = 0; k < 5; k++) {
      const a = v0 + ((v1 - v0) * k) / 5;
      const b = v0 + ((v1 - v0) * (k + 1)) / 5;
      const tip = (a + b) / 2;
      shard([[u0, a], [u0, b], [u0 + 0.05 + r() * 0.3, tip]]);
      shard([[u1, a], [u1, b], [u1 - 0.05 - r() * 0.3, tip]]);
    }
    // broken glass all over the floor under it, glinting
    const bits = new THREE.InstancedMesh(new THREE.CircleGeometry(0.025, 3), new THREE.MeshPhongMaterial({ color: 0xd0e4ee, specular: 0xffffff, shininess: 200, side: THREE.DoubleSide }), 160);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let k = 0; k < 160; k++) {
      const a = RD - 0.15 - Math.pow(r(), 1.6) * 1.8;
      const b = wb + (r() - 0.5) * 2.2 * (1 - (RD - a) / 3);
      q.setFromEuler(new THREE.Euler(-Math.PI / 2 + (r() - 0.5) * 0.4, r() * 6, 0));
      const sc = 0.4 + r() * 1.4;
      m4.compose(new THREE.Vector3(a, 0.006 + r() * 0.004, b), q, new THREE.Vector3(sc, sc * (0.5 + r()), 1));
      bits.setMatrixAt(k, m4);
    }
    bits.userData.noShadow = true;
    g.add(bits);
    // the radiator under it, and the teal sleeping bag on the floor
    const rad = new THREE.Group();
    rad.position.set(RD - 0.07, 0, wb);
    g.add(rad);
    for (let k = 0; k < 12; k++) box(0.06, 0.55, 0.05, this.mats.white, rad, 0, 0.42, -0.4 + k * 0.073);
    box(0.08, 0.04, 0.9, this.mats.white, rad, 0, 0.7, 0);
    const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.4, 6, 12), new THREE.MeshLambertMaterial({ map: tex(fabricTex(0x2e6a62, 77, true)) }));
    bag.rotation.z = Math.PI / 2;
    bag.scale.set(0.35, 1, 1);
    bag.position.set(2.2, 0.1, B(3.1));
    bag.rotation.order = 'ZYX';
    g.add(bag);
    fl.boxes.push(this.toWorldBox(room, B, wx, 1.4, 3.0, 3.0, 3.35, 0.2));
    // the bathroom door, white, shut: not the way out
    const bathDoor = box(0.045, 2.05, 0.8, new THREE.MeshLambertMaterial({ color: 0xf4f2ee }), g, 2.8, 1.03, B(0.03));
    bathDoor.rotation.y = Math.PI / 2;
    // the wall the bathroom is behind
    fl.walls.push(...this.toWorldSegs(B, wx, [[0, 0.03, RD, 0.03]], room.z0));
    // the window as a wall, below the sill and either side (the hole is the way out)
    fl.walls.push({ x0: wx(RD), z0: room.z0, x1: wx(RD), z1: room.z0 + SLOT });
    // a nav point in the middle of the room
    void wx;
  }

  /** A box given in room-local a/b, to the world. */
  toWorldBox(room: Room, B: (b: number) => number, wx: (a: number) => number, a0: number, a1: number, b0: number, b1: number, h: number): Box {
    const xa = wx(a0);
    const xb = wx(a1);
    const za = room.z0 + B(b0);
    const zb = room.z0 + B(b1);
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), z0: Math.min(za, zb), z1: Math.max(za, zb), h };
  }

  toWorldSegs(B: (b: number) => number, wx: (a: number) => number, segs: Array<[number, number, number, number]>, z0: number): Seg[] {
    return segs.map(([a0, b0, a1, b1]) => ({ x0: wx(a0), z0: z0 + B(b0), x1: wx(a1), z1: z0 + B(b1) }));
  }

  addTicker(fn: (dt: number) => void): void {
    this.tickers.push(fn);
  }

  get m(): Record<string, Mat> {
    return this.mats;
  }

  // ------------------------------------------------------------ outside

  /**
   * OUTSIDE 612: THE RIVER.  The back of the building goes straight down into
   * it -- no yard, no alley, the brick running wet into the water -- and it
   * is wide: forty-odd metres of black water going past fast, the moon laid
   * across it in pieces, the lamps of the far embankment each dropping a
   * long broken streak of light down it, the bridge downstream with the
   * police lights on it.  Built on the +x side and mirrored over to 612's.
   */
  private buildExterior(): void {
    const X = new THREE.Group();
    X.scale.x = SIDE612;
    this.exterior.add(X);
    const wallX = OUTER + 0.3;
    const zMid = (AZ + END_Z) / 2;
    const WY = WATER_Y;
    const RIVER = 44;
    const far = wallX + RIVER;
    // ---- the water: a deep base that moves, and two layers of light on it
    // that move at their own speeds, so it reads as a current, not a sheet
    const baseTex = tex(cvs(256, 256, (g) => {
      const r = seeded(31);
      g.fillStyle = '#08141c';
      g.fillRect(0, 0, 256, 256);
      // long low swells running with the current (along v)
      for (let k = 0; k < 220; k++) {
        const x = r() * 256;
        const y = r() * 256;
        const len = 18 + r() * 50;
        g.fillStyle = r() < 0.5 ? 'rgba(26,52,64,0.4)' : 'rgba(2,6,10,0.45)';
        g.fillRect(x, y, 2 + r() * 5, len);
      }
      for (let k = 0; k < 900; k++) {
        g.fillStyle = r() < 0.5 ? 'rgba(70,110,124,0.14)' : 'rgba(0,0,0,0.25)';
        g.fillRect(r() * 256, r() * 256, 1, 2 + r() * 4);
      }
    }), RIVER / 3, 140 / 5);
    const water = new THREE.MeshBasicMaterial({ map: baseTex, fog: true });
    plane(RIVER, 140, water, X, wallX + RIVER / 2, WY, zMid, 0, -Math.PI / 2);
    const glintTex = tex(cvs(128, 256, (g) => {
      const r = seeded(32);
      g.clearRect(0, 0, 128, 256);
      for (let k = 0; k < 260; k++) {
        const a = 0.08 + r() * 0.3;
        g.fillStyle = `rgba(170,200,214,${a})`;
        g.fillRect(r() * 128, r() * 256, 1 + r() * 3, 1);
      }
    }), RIVER / 8, 140 / 12);
    const glints = new THREE.MeshBasicMaterial({ map: glintTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 });
    const glintPlane = plane(RIVER, 140, glints, X, wallX + RIVER / 2, WY + 0.01, zMid, 0, -Math.PI / 2);
    glintPlane.renderOrder = 2;
    // the water breaking white along the foot of the wall, and round the piers
    const foamTex = tex(cvs(64, 256, (g) => {
      const r = seeded(33);
      for (let k = 0; k < 500; k++) {
        const x = Math.pow(r(), 2.2) * 64;
        g.fillStyle = `rgba(220,232,236,${0.15 + (1 - x / 64) * 0.5 * r()})`;
        g.fillRect(x, r() * 256, 1 + r() * 2, 1 + r() * 3);
      }
    }), 1, 140 / 6);
    const foam = new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, opacity: 0.85 });
    const foamPlane = plane(1.4, 140, foam, X, wallX + 0.7, WY + 0.02, zMid, 0, -Math.PI / 2);
    foamPlane.renderOrder = 3;
    // light laid down the water in a broken streak, toward wherever you stand
    const streakTex = tex(cvs(64, 256, (g) => {
      const r = seeded(34);
      for (let k = 0; k < 340; k++) {
        const y = r() * 256;
        const w = (6 + r() * 26) * (0.4 + (y / 256) * 0.6);
        g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.55})`;
        g.fillRect(32 - w / 2 + (r() - 0.5) * 10, y, w, 1 + r() * 2);
      }
    }));
    const streaks: THREE.Mesh[] = [];
    const streak = (x: number, z: number, len: number, wide: number, col: number, op: number): void => {
      const m = new THREE.MeshBasicMaterial({ map: streakTex.clone(), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: op });
      m.map!.needsUpdate = true;
      // (long along x: from the far side of the water toward the building)
      const s = plane(wide, len, m, X, x, WY + 0.03, z, 0, -Math.PI / 2);
      s.rotation.z = Math.PI / 2;
      s.renderOrder = 4;
      streaks.push(s);
    };
    // ---- the building's own face: brick, wet and dark to the waterline
    const faceH = FH * TOP + 3 - WY;
    // (and the buildings either side of it carry the same wall on along the
    // water, so there is no corner to see round on the way down)
    const faceL = END_Z - AZ + 70;
    // (at a brick's real size: one repeat is 2.4m of wall)
    const brick = new THREE.MeshLambertMaterial({ map: tex(brickTex(9), faceL / 2.4, faceH / 2.4) });
    // its windows from outside, most dark, a few still up
    const winDark = [41, 42, 43].map((k) => new THREE.MeshBasicMaterial({ map: tex(outWindowTex(k, false)) }));
    const winLit = [44, 45].map((k) => new THREE.MeshBasicMaterial({ map: tex(outWindowTex(k, true)) }));
    const pickWin = (rr: () => number): THREE.Material => (rr() < 0.16 ? winLit[Math.floor(rr() * winLit.length)] : winDark[Math.floor(rr() * winDark.length)]);
    plane(faceL, faceH, brick, X, wallX, WY + faceH / 2 - 0.3, zMid, Math.PI / 2);
    const wet = new THREE.MeshBasicMaterial({ color: 0x050a0c, transparent: true, opacity: 0.6 });
    plane(faceL, 1.6, wet, X, wallX + 0.01, WY + 0.8, zMid, Math.PI / 2);
    {
      const rr = seeded(18);
      for (let z = AZ - 34; z < END_Z + 34; z += 3.2) {
        if (z > AZ - 1 && z < END_Z + 1) continue;
        for (let f = 0; f <= TOP; f++) if (rr() < 0.6) plane(1.1, 1.1, pickWin(rr), X, wallX + 0.02, f * FH + 1.5, z, Math.PI / 2);
      }
    }
    {
      const rr = seeded(19);
      for (let f = 0; f <= TOP; f++) {
        for (let k = 0; k < SLOTS; k++) {
          const z = AZ + k * SLOT + SLOT / 2;
          if (f === TOP && k === SLOTS - 1) continue;
          plane(1.2, 1.1, pickWin(rr), X, wallX + 0.02, f * FH + 1.5, z, Math.PI / 2);
          // a stone sill under each, catching the light off the water
          box(1.34, 0.08, 0.12, new THREE.MeshLambertMaterial({ color: 0x8a8478 }), X, wallX + 0.06, f * FH + 0.92, z);
        }
      }
    }
    // ---- the far embankment: a stone wall out of the water, a walk along
    // the top with its lamps, and the town behind it
    const stone = new THREE.MeshLambertMaterial({ map: tex(cvs(256, 128, (g) => {
      const r = seeded(35);
      g.fillStyle = '#2a2a2c';
      g.fillRect(0, 0, 256, 128);
      // dressed stone in courses, each block its own grey, worn at the edges
      for (let y = 0; y < 128; y += 32)
        for (let x = (y / 32) % 2 ? -32 : 0; x < 256; x += 64) {
          const t = 0.8 + r() * 0.3;
          g.fillStyle = `rgb(${Math.round(78 * t)},${Math.round(78 * t)},${Math.round(80 * t)})`;
          g.fillRect(x + 2, y + 2, 60, 28);
          for (let k = 0; k < 40; k++) {
            g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.06)';
            g.fillRect(x + 2 + r() * 58, y + 2 + r() * 26, 1 + r() * 2, 1);
          }
          g.fillStyle = 'rgba(255,255,255,0.08)';
          g.fillRect(x + 2, y + 2, 60, 1);
        }
      // green weed and the wet line along the water
      const wet = g.createLinearGradient(0, 70, 0, 128);
      wet.addColorStop(0, 'rgba(20,40,30,0)');
      wet.addColorStop(1, 'rgba(20,40,30,0.6)');
      g.fillStyle = wet;
      g.fillRect(0, 70, 256, 58);
    }), 140 / 8, 1), color: 0x6a6e76 });
    // (lit by its own lamps, not by anything here: a basic material, dim)
    const stoneLit = new THREE.MeshBasicMaterial({ map: stone.map, color: 0x4a4e56 });
    plane(140, 2.2, stoneLit, X, far, WY + 1.1, zMid, -Math.PI / 2);
    plane(6, 140, new THREE.MeshBasicMaterial({ color: 0x1c1e22 }), X, far + 3, WY + 2.2, zMid, 0, -Math.PI / 2);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    const postMat = new THREE.MeshLambertMaterial({ color: 0x1a1c20 });
    const glowTex = tex(cvs(64, 64, (g) => {
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,220,160,0.9)');
      grd.addColorStop(0.3, 'rgba(255,190,110,0.3)');
      grd.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
    }));
    for (let z = AZ - 26; z < END_Z + 18; z += 8) {
      box(0.12, 3.2, 0.12, postMat, X, far + 0.6, WY + 2.2 + 1.6, z);
      const head = box(0.3, 0.16, 0.3, lampMat, X, far + 0.6, WY + 2.2 + 3.25, z);
      void head;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.set(far + 0.6, WY + 2.2 + 3.2, z);
      glow.scale.setScalar(2.2);
      X.add(glow);
      // its light down the water, broken by the current
      streak(far - 4, z, 8, 3.2, 0xffc890, 0.26);
    }
    // the town behind it: blocks against the sky, their faces in floors of
    // windows, most dark, a few still lit; a taller, dimmer row behind them
    const tones = ['#2a2c32', '#30302e', '#262a30', '#34302c'];
    const r = seeded(17);
    const roofMat = new THREE.MeshBasicMaterial({ color: 0x0c0d10 });
    for (const row of [0, 1]) {
      for (let z = AZ - 40; z < END_Z + 34; ) {
        const w = 5 + r() * 8;
        const h = row ? 16 + r() * 18 : 6 + r() * 12;
        const dx = far + 7 + r() * 4 + row * 12;
        const ft = facadeTex(Math.floor(r() * 9999), tones[Math.floor(r() * tones.length)]);
        // (a window is about 1.8m across and a floor 3m up: 128 by 256 is 11.5m by 35m)
        const face = new THREE.MeshBasicMaterial({ map: tex(ft, w / 11.5, h / 35), color: row ? 0x7a7e88 : 0xb4b8c0, fog: true });
        const side = new THREE.MeshBasicMaterial({ map: tex(ft, 6 / 11.5, h / 35), color: row ? 0x5a5e66 : 0x8a8e96, fog: true });
        // (faces: +x, -x, top, bottom, +z, -z; the one that looks at us is -x)
        box(6, h, w, [side, face, roofMat, roofMat, side, side], X, dx + 3, WY + 2.2 + h / 2, z + w / 2);
        // a water tank or a plant room on some of the roofs
        if (r() < 0.4) box(2 + r() * 2, 1.4 + r() * 1.4, 2 + r() * 2, roofMat, X, dx + 3, WY + 2.2 + h + 0.9, z + w / 2);
        z += w + 0.4 + r() * 2;
      }
    }
    // the sky: deep blue going to black overhead, and stars in it
    const skyT = tex(cvs(512, 256, (g) => {
      const rs = seeded(91);
      const grd = g.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, '#02040a');
      grd.addColorStop(0.6, '#0a1430');
      grd.addColorStop(1, '#1a2848');
      g.fillStyle = grd;
      g.fillRect(0, 0, 512, 256);
      for (let k = 0; k < 420; k++) {
        const y = Math.pow(rs(), 1.6) * 200;
        g.fillStyle = `rgba(230,235,255,${0.25 + rs() * 0.7})`;
        g.fillRect(rs() * 512, y, rs() < 0.1 ? 2 : 1, rs() < 0.1 ? 2 : 1);
      }
      // the town's glow along the bottom
      const glowT = g.createLinearGradient(0, 200, 0, 256);
      glowT.addColorStop(0, 'rgba(200,140,80,0)');
      glowT.addColorStop(1, 'rgba(200,140,80,0.22)');
      g.fillStyle = glowT;
      g.fillRect(0, 200, 512, 56);
    }));
    skyT.wrapS = skyT.wrapT = THREE.ClampToEdgeWrapping;
    // (behind everything, as the scene's background, while the outside is in view)
    this.skyTex = skyT;
    // ---- the bridge, downstream, with the police on it
    const bz = END_Z + 48;
    const deck = new THREE.MeshBasicMaterial({ color: 0x1e2026 });
    box(RIVER + 8, 0.9, 5, deck, X, wallX + RIVER / 2, 6.5, bz);
    box(RIVER + 8, 0.6, 0.15, deck, X, wallX + RIVER / 2, 7.25, bz - 2.45);
    for (const px of [wallX + RIVER * 0.3, wallX + RIVER * 0.7]) {
      box(1.6, 6.5 - WY, 2.2, stoneLit, X, px, WY + (6.5 - WY) / 2, bz);
    }
    for (let k = 0; k < 7; k++) {
      const px = wallX + 3 + k * ((RIVER - 6) / 6);
      box(0.08, 1.6, 0.08, postMat, X, px, 7.7, bz - 2.4);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.set(px, 8.5, bz - 2.4);
      glow.scale.setScalar(1.6);
      X.add(glow);
    }
    // the night over it all: the moon, and its light broken across the water
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(cvs(64, 64, (g) => {
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,240,1)');
      grd.addColorStop(0.35, 'rgba(240,240,230,0.9)');
      grd.addColorStop(0.4, 'rgba(200,210,230,0.25)');
      grd.addColorStop(1, 'rgba(200,210,230,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
    })), depthWrite: false, fog: false }));
    moon.position.set(wallX + 60, 30, this.window612.z - 6);
    moon.scale.setScalar(12);
    X.add(moon);
    streak(wallX + 24, this.window612.z - 3, 34, 4.5, 0xd8e4f0, 0.7);
    // a cold light off the water on to the face of the building
    const fill = new THREE.PointLight(0x6a8aa8, 16, 34, 1.1);
    fill.position.set(wallX + 6, WY + 6, this.window612.z);
    X.add(fill);
    // and the police on the bridge, red and blue on the water
    const pol = new THREE.PointLight(0xff2030, 0, 30, 1.1);
    pol.position.set(wallX + 10, 8, bz - 3);
    X.add(pol);
    // (one light, turning red and blue, not one of each: every light in the
    // scene is paid for on every pixel of every frame, lit or not)
    pol.position.set(wallX + 12, 8, bz - 3);
    const polRed = new THREE.MeshBasicMaterial({ color: 0xff2030 });
    const polBlue = new THREE.MeshBasicMaterial({ color: 0x2a50ff });
    const barR = box(0.4, 0.12, 0.2, polRed, X, wallX + 10, 7.5, bz - 1.5);
    const barB = box(0.4, 0.12, 0.2, polBlue, X, wallX + 10.45, 7.5, bz - 1.5);
    box(1.8, 0.9, 4.2, new THREE.MeshLambertMaterial({ color: 0x101216 }), X, wallX + 10.2, 7.4, bz - 0.2);
    const polStreak = new THREE.MeshBasicMaterial({ map: streakTex.clone(), color: 0xff2030, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    polStreak.map!.needsUpdate = true;
    const ps = plane(2.4, 14, polStreak, X, wallX + 10, WY + 0.04, bz - 9, 0, -Math.PI / 2);
    ps.renderOrder = 4;
    let t = 0;
    this.addTicker((dt) => {
      t += dt;
      // the current: the water and its light go by, at their own speeds
      baseTex.offset.y = (baseTex.offset.y - dt * 0.09) % 1;
      glintTex.offset.y = (glintTex.offset.y - dt * 0.16) % 1;
      glintTex.offset.x = Math.sin(t * 0.7) * 0.02;
      foamTex.offset.y = (foamTex.offset.y - dt * 0.35) % 1;
      for (const [i, s] of streaks.entries()) {
        const m = s.material as THREE.MeshBasicMaterial;
        m.map!.offset.y = (t * 0.25 + i * 0.37) % 1;
        m.map!.offset.x = Math.sin(t * 2.3 + i) * 0.04;
      }
      const ph = Math.floor(t * 6) % 4;
      pol.intensity = 18;
      pol.color.setHex(ph < 2 ? 0xff2030 : 0x2a50ff);
      barR.visible = ph < 2;
      barB.visible = ph >= 2;
      polStreak.color.setHex(ph < 2 ? 0xff2030 : 0x2a50ff);
      polStreak.opacity = 0.5;
      polStreak.map!.offset.y = (t * 0.3) % 1;
    });
  }

  // ------------------------------------------------------------ the route network

  private node(x: number, z: number, f: number, zone: NavNode['zone'], room: Room | null = null, y = f * FH): NavNode {
    const n: NavNode = { id: this.nodes.length, x, z, f, zone, room, y, edges: [] };
    this.nodes.push(n);
    return n;
  }

  link(a: NavNode, b: NavNode, door: Door | null = null): void {
    const cost = Math.hypot(a.x - b.x, a.z - b.z) + Math.abs(a.y - b.y) * 1.5;
    a.edges.push({ to: b, door, cost });
    b.edges.push({ to: a, door, cost });
  }

  /** Landing nodes per floor (by the fire door), for the scene. */
  readonly landing: NavNode[] = [];
  /** The corridor node outside each fire door. */
  readonly stairOut: NavNode[] = [];
  /** The lobby, behind the G door. */
  lobby: NavNode | null = null;
  /** Inside the lobby's smashed front doors: where the three of them come in. */
  entrance: NavNode | null = null;
  /** Every corridor node per floor, stairs end first. */
  readonly corridor: NavNode[][] = [];

  private buildNav(): void {
    for (let f = 0; f <= TOP; f++) this.landing.push(this.node(0.9, 0.85, f, 'well'));
    for (let f = 0; f < TOP; f++) {
      const y0 = f * FH;
      const a1 = this.node(-0.95, 0.3, f, 'well', null, y0);
      const a2 = this.node(-0.95, -3.3, f, 'well', null, y0 + FH / 2);
      const h = this.node(0, -3.85, f, 'well', null, y0 + FH / 2);
      const b1 = this.node(0.95, -3.3, f, 'well', null, y0 + FH / 2);
      const b2 = this.node(0.95, 0.3, f + 1, 'well', null, y0 + FH);
      this.link(this.landing[f], a1);
      this.link(a1, a2);
      this.link(a2, h);
      this.link(h, b1);
      this.link(b1, b2);
      this.link(b2, this.landing[f + 1]);
    }
    // (to one side of the doorway, so whoever waits there is not stood in it)
    this.lobby = this.node(-0.2, 4.0, 0, 'lobby');
    this.link(this.landing[0], this.lobby, this.stairDoors[0]);
    // and down the runner to the front doors, where the police come in
    // (across the lobby from the front doors, on your right as you look out,
    // along the runner to the stair door)
    const half = this.node((LOBBY.x0 + 0.9) / 2, LOBBY.doorZ, 0, 'lobby');
    this.entrance = this.node(LOBBY.x0 + 1.0, LOBBY.doorZ, 0, 'lobby');
    this.link(this.lobby, half);
    this.link(half, this.entrance);
    this.stairOut.push(this.lobby);
    this.corridor.push([]);
    for (let f = 1; f <= TOP; f++) {
      const out = this.node(0.9, 2.3, f, 'corr');
      this.stairOut.push(out);
      this.link(this.landing[f], out, this.stairDoors[f]);
      const alc = this.node(0, 3.6, f, 'corr');
      this.link(out, alc);
      const fl = this.floors[f];
      // the corridor's spine: a node level with every door, in order
      const zs = [...new Set(fl.rooms.map((r) => Math.round(r.dz * 100) / 100))].sort((a, b) => a - b);
      const spine: NavNode[] = [alc];
      for (const z of zs) spine.push(this.node(0, z, f, 'corr'));
      spine.push(this.node(0, END_Z - 0.6, f, 'corr'));
      for (let i = 1; i < spine.length; i++) this.link(spine[i - 1], spine[i]);
      this.corridor.push([out, ...spine]);
      // each open flat: outside its door, inside it, and its own plan
      for (const rm of fl.rooms) {
        if (!rm.open) continue;
        const near = spine.reduce((b, n) => (Math.abs(n.z - rm.dz) < Math.abs(b.z - rm.dz) ? n : b), spine[0]);
        const o = this.node(rm.side * 0.72, rm.dz, f, 'corr');
        this.link(near, o);
        const inn = this.node(rm.side * (CH + 0.55), rm.dz, f, 'room', rm);
        this.link(o, inn, rm.door);
        rm.nodes.unshift(inn);
        rm.outside = o;
        rm.center = inn;
        // the plan's nodes were stored as local points; link them in a chain
        const pts = (rm as Room & { plan?: PlanPts }).plan;
        if (!pts) continue;
        const made = new Map<string, NavNode>();
        made.set('in', inn);
        for (const [key, p] of Object.entries(pts.pts)) made.set(key, this.node(p.x, p.z, f, 'room', rm));
        rm.center = made.get('c') ?? inn;
        for (const [a, b, door] of pts.links) {
          const na = made.get(a);
          const nb = made.get(b);
          if (na && nb) this.link(na, nb, door ?? null);
        }
        rm.nodes.push(...[...made.values()].filter((n) => n !== inn));
        for (const sp of rm.spots) {
          const key = (sp as HideSpot & { navKey?: string }).navKey;
          const parent = key ? made.get(key) : undefined;
          const at = this.node(sp.inspectFrom.x, sp.inspectFrom.z, f, 'room', rm);
          if (parent) this.link(parent, at, sp.kind === 'door' ? null : null);
          sp.node = at;
        }
      }
    }
  }

  // ------------------------------------------------------------ queries

  /** Walls, closed leaves and furniture on a floor -- and the well's walls. */
  segsFor(f: number, withWell: boolean): Seg[] {
    const out = [...(this.floors[f]?.walls ?? [])];
    if (withWell) out.push(...this.wellWalls);
    for (const d of this.doors) if (d.floor === f && d.pivot.visible) out.push(PoliceBuilding.leaf(d));
    return out;
  }

  /** The room a point on a floor is in, if it is in one. */
  roomAt(f: number, x: number, z: number): Room | null {
    for (const r of this.floors[f]?.rooms ?? []) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return r;
    return null;
  }

  update(dt: number): void {
    for (const t of this.tickers) t(dt);
  }
}

function side(room: Room): number {
  return room.side;
}

/** A flat's plan: its route points (world) and their links. */
interface PlanPts {
  pts: Record<string, { x: number; z: number }>;
  links: Array<[string, string, Door | null]>;
}

// ------------------------------------------------------------------ furnishing

/**
 * Builds one open flat's furniture, its bathroom and its hiding places, in the
 * flat's own frame (a into the room, b along it), keeping every world-space
 * fact -- walls, boxes, spots, route points -- in step with the meshes.
 */
class RoomCtx {
  private plan: PlanPts = { pts: {}, links: [] };

  constructor(
    private b: PoliceBuilding,
    private fl: Floor,
    private room: Room,
    private g: THREE.Group,
    private B: (b: number) => number,
    private wx: (a: number) => number,
    private flip: boolean,
    private wallMat: THREE.Material,
    private r: () => number,
  ) {
    (room as Room & { plan?: PlanPts }).plan = this.plan;
  }

  private get M(): Record<string, Mat> {
    return this.b.m;
  }

  /** Room-local (a, b) to world (x, z). */
  W(a: number, bb: number): { x: number; z: number } {
    return { x: this.wx(a), z: this.room.z0 + this.B(bb) };
  }

  W3(a: number, y: number, bb: number): P3 {
    const p = this.W(a, bb);
    return { x: p.x, y: this.fl.f * FH + y, z: p.z };
  }

  /** A local rotation (about y) under the b-flip. */
  T(theta: number): number {
    return this.flip ? Math.PI - theta : theta;
  }

  /** A furniture group at local (a, b), its front facing local direction theta. */
  grp(a: number, bb: number, theta: number): THREE.Group {
    const o = new THREE.Group();
    o.position.set(a, 0, this.B(bb));
    o.rotation.y = this.T(theta);
    this.g.add(o);
    return o;
  }

  solid(a0: number, a1: number, b0: number, b1: number, h: number): void {
    this.fl.boxes.push(this.b.toWorldBox(this.room, this.B, this.wx, a0, a1, b0, b1, h));
  }

  wall(a0: number, b0: number, a1: number, b1: number, h = CEIL, mat = this.wallMat): void {
    this.fl.walls.push(...this.b.toWorldSegs(this.B, this.wx, [[a0, b0, a1, b1]], this.room.z0));
    // drawn both sides, as a thin box
    const len = Math.hypot(a1 - a0, b1 - b0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.08), mat);
    m.position.set((a0 + a1) / 2, h / 2, this.B((b0 + b1) / 2));
    m.rotation.y = -Math.atan2(this.B(b1) - this.B(b0), a1 - a0);
    this.g.add(m);
  }

  pt(key: string, a: number, bb: number): void {
    this.plan.pts[key] = this.W(a, bb);
  }

  link(a: string, c: string, door: Door | null = null): void {
    this.plan.links.push([a, c, door]);
  }

  /** A window on the outside wall at b0..b1, the moon on its blind. */
  window(b0: number, b1: number): void {
    const w = Math.abs(b1 - b0);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.1), this.M.glassNight);
    m.position.set(RD - 0.012, 1.5, this.B((b0 + b1) / 2));
    m.rotation.y = -Math.PI / 2;
    this.g.add(m);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, w + 0.1), this.M.whiteWood);
    sill.position.set(RD - 0.05, 0.93, this.B((b0 + b1) / 2));
    this.g.add(sill);
  }

  // ---------------------------------------------------- pieces

  /** A bed, head against the outside wall (a = RD), b0..b1 wide; open side faces -b (or +b with `openHigh`). */
  bed(a0: number, b0: number, b1: number, openHigh: boolean, under: boolean, navKey: string): void {
    const r = this.r;
    const len = RD - a0;
    const w = b1 - b0;
    const am = a0 + len / 2;
    const bm = (b0 + b1) / 2;
    const o = this.grp(am, bm, 0);
    // (group-local: x along the bed's length toward the head, z across it)
    o.rotation.y = 0;
    const frameMat = [this.M.walnut, this.M.oak, this.M.whiteWood][Math.floor(r() * 3)];
    const duvetCol = [0x3a5a8a, 0x8a4a4a, 0x4a6a5a, 0xd8d0c0, 0x5a4a6a, 0x9a8a5a][Math.floor(r() * 6)];
    const duvet = new THREE.MeshLambertMaterial({ map: (() => { const t = new THREE.CanvasTexture(fabricTex(duvetCol, this.room.id, r() < 0.4)); t.colorSpace = THREE.SRGBColorSpace; return t; })() });
    const clear = under ? 0.36 : 0;
    // legs, rails and the base: open under it, or a solid divan
    if (under) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.07, clear, 0.07, frameMat, o, sz * (len / 2 - 0.05), clear / 2, sx * (w / 2 - 0.05));
      for (const sz of [-1, 1]) box(len, 0.12, 0.05, frameMat, o, 0, clear + 0.06, sz * (w / 2 - 0.025));
      box(0.05, 0.12, w, frameMat, o, -len / 2 + 0.025, clear + 0.06, 0);
      // the slats under the mattress, seen from beneath; and the dust down there
      for (let k = 0; k < 12; k++) box(0.08, 0.02, w - 0.1, this.M.slat, o, -len / 2 + 0.12 + k * ((len - 0.24) / 11), clear + 0.01, 0);
      for (let k = 0; k < 5; k++) {
        const d = new THREE.Mesh(new THREE.CircleGeometry(0.03 + r() * 0.04, 6), this.M.dust);
        d.rotation.x = -Math.PI / 2;
        d.position.set((r() - 0.5) * (len - 0.3), 0.006, (r() - 0.5) * (w - 0.3));
        o.add(d);
      }
    } else {
      box(len, 0.36, w, frameMat, o, 0, 0.18, 0);
    }
    box(len - 0.04, 0.22, w - 0.04, this.M.mattress, o, 0, 0.36 + 0.11, 0);
    // the duvet over most of it, turned down at the head
    const dv = box(len * 0.78, 0.08, w + 0.06, duvet, o, -len * 0.11, 0.62, 0);
    void dv;
    for (const sz of [-1, 1]) box(len * 0.78, 0.3, 0.02, duvet, o, -len * 0.11, 0.48, sz * (w / 2 + 0.03));
    box(0.02, 0.3, w + 0.06, duvet, o, -len / 2 + 0.01, 0.48, 0);
    // pillows and the headboard
    const pillows = w > 1.2 ? 2 : 1;
    for (let k = 0; k < pillows; k++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, w / pillows - 0.1), this.M.pillow);
      p.position.set(len / 2 - 0.25, 0.64, (k - (pillows - 1) / 2) * (w / pillows));
      p.scale.set(1, 1, 1);
      o.add(p);
    }
    box(0.06, 1.1, w + 0.1, frameMat, o, len / 2 - 0.03, 0.55, 0);
    this.solid(a0, RD, b0, b1, 0.65);
    if (!under) return;
    // ---- under it
    const side = openHigh ? 1 : -1;
    const edgeB = openHigh ? b1 : b0;
    const sp: HideSpot = {
      id: `${this.room.id}-bed`,
      kind: 'bed',
      room: this.room,
      floor: this.fl.f,
      approach: this.W(am, edgeB + side * 0.55),
      exit: this.W(am, edgeB + side * 0.55),
      eye: this.W3(am, 0.17, bm - side * 0.15),
      look: this.W3(am, 0.16, edgeB + side * 3),
      peekEye: this.W3(am, 0.13, edgeB - side * 0.12),
      peekLook: this.W3(am - 0.3, 0.25, edgeB + side * 3),
      peekFov: 64,
      inspectFrom: this.W(am, edgeB + side * 0.7),
      inspectAt: this.W3(am, 0.18, bm),
      crouch: true,
      setOpen: () => undefined,
      openK: 0,
      door: null,
      node: null,
    };
    (sp as HideSpot & { navKey?: string }).navKey = navKey;
    this.room.spots.push(sp);
    this.b.spots.push(sp);
  }

  /** A wardrobe: back against a wall, its middle at (a, b), facing local theta. */
  wardrobe(a: number, bb: number, theta: number, navKey: string): void {
    const o = this.grp(a, bb, theta);
    const mat = [this.M.walnut, this.M.oak, this.M.whiteWood, this.M.pine][Math.floor(this.r() * 4)];
    const W = 1.1;
    const D = 0.6;
    const H = 2.0;
    // (group-local: x across its width, z out of its front; its back at z -D/2)
    box(W, H, 0.03, mat, o, 0, H / 2, -D / 2 + 0.015);
    for (const s of [-1, 1]) box(0.03, H, D, mat, o, s * (W / 2 - 0.015), H / 2, 0);
    box(W, 0.03, D, mat, o, 0, H - 0.015, 0);
    box(W, 0.08, D, mat, o, 0, 0.04, 0);
    box(W + 0.04, 0.05, D + 0.04, mat, o, 0, H + 0.025, 0);
    // the rail and what is on it
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, W - 0.08, 8), this.M.chrome);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 1.7, -0.02);
    o.add(rail);
    const cols = [0x2a3a5a, 0x8a3a3a, 0xd8d0c0, 0x3a5a3a, 0x5a4a3a, 0x9a9aa0];
    for (let k = 0; k < 5; k++) {
      const shirt = box(0.06 + this.r() * 0.05, 0.75 + this.r() * 0.3, 0.42, new THREE.MeshLambertMaterial({ color: cols[Math.floor(this.r() * cols.length)] }), o, -0.4 + k * 0.17, 1.25, -0.02);
      shirt.rotation.y = (this.r() - 0.5) * 0.3;
    }
    // the two doors, hinged at the outside edges
    const doors: THREE.Group[] = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Group();
      p.position.set(s * (W / 2), 0, D / 2);
      o.add(p);
      const leaf = box(W / 2 - 0.01, H - 0.1, 0.025, mat, p, -s * (W / 4), H / 2, 0);
      void leaf;
      // a knob near the middle, a mirror on one
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), this.M.chrome);
      knob.position.set(-s * (W / 2 - 0.06), 1.0, 0.025);
      p.add(knob);
      if (s > 0 && this.r() < 0.5) box(W / 2 - 0.12, 1.2, 0.006, this.M.mirror, p, -s * (W / 4), 1.25, 0.016);
      doors.push(p);
    }
    let cur = 0;
    let want = 0;
    const setOpen = (k: number): void => {
      want = k;
    };
    this.b.addTicker((dt) => {
      cur += (want - cur) * Math.min(1, dt * 7);
      // (both swing out, into the room)
      doors.forEach((p, i) => (p.rotation.y = (i === 0 ? -1 : 1) * cur * 1.75));
    });
    // its footprint, in room-local space: centre (a, b), width along the wall
    const fx = Math.sin(this.T(theta));
    const fz = Math.cos(this.T(theta));
    // fx/fz is the facing in (a, flippedB) space; turn it back to (a, b)
    const fa = fx;
    const fb = this.flip ? -fz : fz;
    const wa = Math.abs(fb) > 0.5 ? W : D;
    const wb = Math.abs(fb) > 0.5 ? D : W;
    this.solid(a - wa / 2, a + wa / 2, bb - wb / 2, bb + wb / 2, H);
    const at = (out: number, y: number): P3 => this.W3(a + fa * out, y, bb + fb * out);
    const sp: HideSpot = {
      id: `${this.room.id}-wardrobe`,
      kind: 'wardrobe',
      room: this.room,
      floor: this.fl.f,
      approach: this.W(a + fa * 0.95, bb + fb * 0.95),
      exit: this.W(a + fa * 0.9, bb + fb * 0.9),
      eye: at(-0.05, 1.55),
      look: at(3, 1.4),
      peekEye: at(0.2, 1.55),
      peekLook: at(3, 1.35),
      peekFov: 52,
      inspectFrom: this.W(a + fa * 1.0, bb + fb * 1.0),
      inspectAt: at(0, 1.3),
      crouch: false,
      setOpen: (k) => {
        sp.openK = k;
        setOpen(k);
      },
      openK: 0,
      door: null,
      node: null,
    };
    (sp as HideSpot & { navKey?: string }).navKey = navKey;
    this.room.spots.push(sp);
    this.b.spots.push(sp);
  }

  /** A bath against walls, its length along `along`; its curtain on the open side. */
  bath(a0: number, a1: number, b0: number, b1: number, openSide: 'a0' | 'a1' | 'b0' | 'b1', navKey: string): void {
    const ce = this.M.ceramic;
    const am = (a0 + a1) / 2;
    const bm = (b0 + b1) / 2;
    const la = a1 - a0;
    const lb = b1 - b0;
    const o = this.grp(am, bm, 0);
    o.rotation.y = 0;
    // walls of the tub as boxes, local x = a, z = b (it is the same either way round)
    const zb = (v: number): number => v;
    box(la, 0.06, lb, ce, o, 0, 0.06, 0);
    box(la, 0.55, 0.06, ce, o, 0, 0.3, zb(-lb / 2 + 0.03));
    box(la, 0.55, 0.06, ce, o, 0, 0.3, zb(lb / 2 - 0.03));
    box(0.06, 0.55, lb, ce, o, -la / 2 + 0.03, 0.3, 0);
    box(0.06, 0.55, lb, ce, o, la / 2 - 0.03, 0.3, 0);
    box(la - 0.12, 0.01, lb - 0.12, new THREE.MeshPhongMaterial({ color: 0xdfe8ea, shininess: 140, specular: 0xffffff }), o, 0, 0.1, 0);
    // the taps at one end
    const tap = box(0.04, 0.12, 0.04, this.M.chrome, o, -la / 2 + 0.08, 0.66, 0);
    void tap;
    this.solid(a0, a1, b0, b1, 0.6);
    // ---- the curtain, on a rail across the open side, 2 m up
    const alongA = openSide === 'b0' || openSide === 'b1';
    const lineAt = openSide === 'a0' ? a0 : openSide === 'a1' ? a1 : openSide === 'b0' ? b0 : b1;
    const len = alongA ? la : lb;
    const cur = new THREE.MeshLambertMaterial({
      map: (() => { const t = new THREE.CanvasTexture(curtainTex([0xc8d8e0, 0xe8d8c8, 0xd8e8d0, 0xf0f0f0, 0xc8c0d8][Math.floor(this.r() * 5)], this.room.id)); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t; })(),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.94,
    });
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 8), this.M.chrome);
    const railG = new THREE.Group();
    // railG local: x along the curtain line from its fixed end
    const fixedA = alongA ? a1 : lineAt;
    const fixedB = alongA ? lineAt : b1;
    railG.position.set(fixedA, 0, this.B(fixedB));
    // point local +x back along the line, toward the free end
    const dirA = alongA ? -1 : 0;
    const dirB = alongA ? 0 : -1;
    railG.rotation.y = -Math.atan2(this.flip ? -dirB : dirB, dirA);
    this.g.add(railG);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(len / 2, 2.0, 0);
    railG.add(rail);
    const geo = new THREE.PlaneGeometry(1, 1.85, 24, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + 0.5;
      pos.setXYZ(i, x, pos.getY(i), Math.sin(x * 60) * 0.035);
    }
    geo.computeVertexNormals();
    const curtain = new THREE.Mesh(geo, cur);
    curtain.position.set(0, 1.05, 0);
    curtain.userData.noShadow = true;
    railG.add(curtain);
    let k = 0;
    let want = 0;
    this.b.addTicker((dt) => {
      k += (want - k) * Math.min(1, dt * 6);
      // shut: the full length; open: bunched up at the fixed end
      curtain.scale.x = len * (1 - 0.82 * k);
    });
    // points across the line: out of the bath is the open side's outward normal
    const outA = openSide === 'a0' ? -1 : openSide === 'a1' ? 1 : 0;
    const outB = openSide === 'b0' ? -1 : openSide === 'b1' ? 1 : 0;
    const P = (along: number, out: number, y: number): P3 => {
      const a = alongA ? a1 - along : lineAt + outA * out;
      const b = alongA ? lineAt + outB * out : b1 - along;
      return this.W3(a, y, b);
    };
    const P2 = (along: number, out: number): { x: number; z: number } => {
      const p = P(along, out, 0);
      return { x: p.x, z: p.z };
    };
    const sp: HideSpot = {
      id: `${this.room.id}-curtain`,
      kind: 'curtain',
      room: this.room,
      floor: this.fl.f,
      approach: P2(len / 2, 0.6),
      exit: P2(len / 2, 0.6),
      eye: P(len * 0.45, -0.35, 1.68),
      look: P(len * 0.45, 3, 1.5),
      peekEye: P(len - 0.14, 0.04, 1.66),
      peekLook: P(len - 0.6, 2.5, 1.45),
      peekFov: 56,
      inspectFrom: P2(len / 2, 0.65),
      inspectAt: P(len / 2, -0.35, 1.3),
      crouch: false,
      setOpen: (v) => {
        sp.openK = v;
        want = v;
      },
      openK: 0,
      door: null,
      node: null,
    };
    (sp as HideSpot & { navKey?: string }).navKey = navKey;
    this.room.spots.push(sp);
    this.b.spots.push(sp);
  }

  /**
   * A bathroom door in a partition: hinge at (ha, hb), shut running toward
   * local direction `shutDir` (radians in a/b), opening to `openDir`; with
   * `pocket` the space behind it when open is a place to hide.
   */
  bathDoor(ha: number, hb: number, shutDir: number, openDir: number, pocket: { a: number; b: number; peekA: number; peekB: number; lookA: number; lookB: number; fromA: number; fromB: number } | null, navKey: string): Door {
    const world = (dir: number): number => {
      const da = Math.cos(dir);
      const db = Math.sin(dir);
      const wa = da * this.room.side;
      const wb = this.flip ? -db : db;
      return Math.atan2(wb, wa);
    };
    const localDir = (dir: number): number => {
      // the pivot is in the room group (scaled by side in x): local angle with b flipped
      const db = Math.sin(dir);
      return Math.atan2(this.flip ? -db : db, Math.cos(dir));
    };
    const hw = this.W(ha, hb);
    const white = new THREE.MeshLambertMaterial({ map: (() => { const t = new THREE.CanvasTexture(veneerTex(0xf0ece4, this.room.id + 5)); t.colorSpace = THREE.SRGBColorSpace; return t; })() });
    const d = (this.b as unknown as { makeDoor: (o: unknown) => Door }).makeDoor({
      id: `bath-${this.room.id}`,
      kind: 'bath',
      floor: this.fl.f,
      hx: hw.x,
      hz: hw.z,
      shut: world(shutDir),
      open: world(openDir),
      width: 0.78,
      locked: false,
      front: white,
      back: white,
      parent: this.g,
      y: 0,
      local: { x: ha, z: this.B(hb), shut: localDir(shutDir) },
      room: this.room,
    });
    // the local swing's sense under the room's mirror and the b-flip
    const sweepW = ((): number => {
      let x = world(openDir) - world(shutDir);
      while (x > Math.PI) x -= Math.PI * 2;
      while (x < -Math.PI) x += Math.PI * 2;
      return x;
    })();
    const sweepL = ((): number => {
      let x = localDir(openDir) - localDir(shutDir);
      while (x > Math.PI) x -= Math.PI * 2;
      while (x < -Math.PI) x += Math.PI * 2;
      return x;
    })();
    (d.pivot.userData as { mirror: number }).mirror = Math.sign(sweepL) === Math.sign(sweepW) ? 1 : -1;
    this.b.poseDoor(d);
    this.fl.doors.push(d);
    if (pocket) {
      const sp: HideSpot = {
        id: `${this.room.id}-door`,
        kind: 'door',
        room: this.room,
        floor: this.fl.f,
        approach: this.W(pocket.fromA, pocket.fromB),
        exit: this.W(pocket.fromA, pocket.fromB),
        eye: this.W3(pocket.a, 1.6, pocket.b),
        look: this.W3(pocket.a + (ha - pocket.a) * 3, 1.5, pocket.b),
        peekEye: this.W3(pocket.peekA, 1.58, pocket.peekB),
        peekLook: this.W3(pocket.lookA, 1.4, pocket.lookB),
        peekFov: 48,
        inspectFrom: this.W(pocket.fromA, pocket.fromB),
        inspectAt: this.W3(pocket.a, 1.3, pocket.b),
        crouch: false,
        setOpen: () => undefined,
        openK: 0,
        door: d,
        node: null,
      };
      (sp as HideSpot & { navKey?: string }).navKey = navKey;
      this.room.spots.push(sp);
      this.b.spots.push(sp);
    }
    return d;
  }

  toilet(a: number, bb: number, theta: number): void {
    const o = this.grp(a, bb, theta);
    const ce = this.M.ceramic;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.4, 16), ce);
    base.position.set(0, 0.2, 0.05);
    base.scale.z = 1.3;
    o.add(base);
    const seat = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 20), ce);
    seat.rotation.x = Math.PI / 2;
    seat.scale.y = 1.3;
    seat.position.set(0, 0.42, 0.06);
    o.add(seat);
    box(0.38, 0.38, 0.17, ce, o, 0, 0.6, -0.2);
    box(0.06, 0.02, 0.03, this.M.chrome, o, 0.12, 0.8, -0.12);
    const fa = Math.sin(this.T(theta));
    const fb = this.flip ? -Math.cos(this.T(theta)) : Math.cos(this.T(theta));
    const ha = Math.abs(fa) > 0.5 ? 0.3 : 0.22;
    const hb = Math.abs(fb) > 0.5 ? 0.3 : 0.22;
    this.solid(a - ha, a + ha, bb - hb, bb + hb, 0.8);
  }

  sink(a: number, bb: number, theta: number, mirror = true): void {
    const o = this.grp(a, bb, theta);
    const ce = this.M.ceramic;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.75, 12), ce);
    ped.position.set(0, 0.375, -0.05);
    o.add(ped);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.14, 18, 1, true), ce);
    bowl.position.set(0, 0.82, 0.02);
    bowl.scale.z = 0.8;
    o.add(bowl);
    box(0.04, 0.1, 0.04, this.M.chrome, o, 0, 0.94, -0.14);
    if (mirror) box(0.5, 0.6, 0.02, this.M.mirror, o, 0, 1.5, -0.2);
    this.solid(a - 0.25, a + 0.25, bb - 0.25, bb + 0.25, 0.9);
  }

  nightstand(a: number, bb: number): void {
    const o = this.grp(a, bb, Math.PI);
    box(0.4, 0.5, 0.36, this.M.oak, o, 0, 0.25, 0);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.18, 12, 1, true), new THREE.MeshLambertMaterial({ color: 0xf0e0c0, emissive: 0x2a2010, side: THREE.DoubleSide }));
    lamp.position.set(0, 0.78, 0);
    o.add(lamp);
    box(0.03, 0.2, 0.03, this.M.chrome, o, 0, 0.6, 0);
    this.solid(a - 0.2, a + 0.2, bb - 0.18, bb + 0.18, 0.55);
  }

  armchair(a: number, bb: number, theta: number): void {
    const o = this.grp(a, bb, theta);
    const mat = new THREE.MeshLambertMaterial({ map: (() => { const t = new THREE.CanvasTexture(fabricTex([0x6a3a3a, 0x3a4a6a, 0x5a6a4a, 0x8a7a5a][Math.floor(this.r() * 4)], this.room.id + 9)); t.colorSpace = THREE.SRGBColorSpace; return t; })() });
    box(0.7, 0.42, 0.7, mat, o, 0, 0.21, 0);
    box(0.7, 0.5, 0.15, mat, o, 0, 0.67, -0.28);
    for (const s of [-1, 1]) box(0.14, 0.25, 0.65, mat, o, s * 0.28, 0.55, 0);
    this.solid(a - 0.36, a + 0.36, bb - 0.36, bb + 0.36, 0.95);
  }

  desk(a: number, bb: number, theta: number): void {
    const o = this.grp(a, bb, theta);
    box(1.0, 0.04, 0.5, this.M.oak, o, 0, 0.74, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 0.72, 0.04, this.M.steel, o, sx * 0.46, 0.36, sz * 0.21);
    // a lamp, a few books
    box(0.12, 0.25, 0.12, this.M.steel, o, 0.35, 0.88, -0.1);
    for (let k = 0; k < 3; k++) box(0.04, 0.24, 0.17, new THREE.MeshLambertMaterial({ color: [0x8a2a2a, 0x2a4a6a, 0x3a5a3a][k] }), o, -0.4 + k * 0.05, 0.88, -0.12);
    const fa = Math.abs(Math.sin(this.T(theta)));
    const wa = fa > 0.5 ? 0.5 : 1.0;
    const wb = fa > 0.5 ? 1.0 : 0.5;
    this.solid(a - wa / 2, a + wa / 2, bb - wb / 2, bb + wb / 2, 0.78);
  }

  plant(a: number, bb: number): void {
    const o = this.grp(a, bb, 0);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.28, 12), new THREE.MeshLambertMaterial({ color: 0xa85a32 }));
    pot.position.y = 0.14;
    o.add(pot);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x3a7a3a, side: THREE.DoubleSide });
    for (let k = 0; k < 9; k++) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.42), leafMat);
      l.position.set(0, 0.48, 0);
      l.rotation.set(0.4 + this.r() * 0.4, (k / 9) * Math.PI * 2, 0, 'YXZ');
      o.add(l);
    }
    this.solid(a - 0.15, a + 0.15, bb - 0.15, bb + 0.15, 0.8);
  }

  rug(a: number, bb: number, la: number, lb: number): void {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(la, lb), new THREE.MeshLambertMaterial({ map: (() => { const t = new THREE.CanvasTexture(fabricTex([0x8a4a3a, 0x4a5a7a, 0x7a6a4a][Math.floor(this.r() * 3)], this.room.id + 3)); t.colorSpace = THREE.SRGBColorSpace; return t; })() }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(a, 0.006, this.B(bb));
    this.g.add(m);
  }

  picture(a: number, bb: number, onWall: 'b0' | 'b1' | 'a1'): void {
    const c = new THREE.CanvasTexture(cvs(64, 48, (g) => {
      const r = this.r;
      const grd = g.createLinearGradient(0, 0, 0, 48);
      grd.addColorStop(0, hx([0x6a8ab0, 0xc89a6a, 0x8ab08a][Math.floor(r() * 3)]));
      grd.addColorStop(1, hx([0x3a4a3a, 0x6a4a2a, 0x2a3a5a][Math.floor(r() * 3)]));
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 48);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(0, 30, 64, 18);
    }));
    c.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshLambertMaterial({ map: c }));
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.51, 0.02), this.M.walnut);
    const o = new THREE.Group();
    this.g.add(o);
    o.add(fr);
    m.position.z = 0.012;
    o.add(m);
    if (onWall === 'a1') {
      o.position.set(RD - 0.02, 1.6, this.B(bb));
      o.rotation.y = -Math.PI / 2;
    } else {
      const atB = onWall === 'b0' ? 0.02 : SLOT - 0.02;
      o.position.set(a, 1.6, this.B(atB));
      const facePlus = onWall === 'b0';
      o.rotation.y = (facePlus !== this.flip) ? 0 : Math.PI;
    }
  }

  /** Bathroom floor tiles and a tiled wall half-way up, inside a local rectangle. */
  tiles(a0: number, a1: number, b0: number, b1: number): void {
    const t = new THREE.CanvasTexture(tileTex([0xe8eef0, 0xf0e8e0, 0xdde8e0][Math.floor(this.r() * 3)], this.room.id));
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set((a1 - a0) / 0.8, (b1 - b0) / 0.8);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(a1 - a0, b1 - b0), new THREE.MeshPhongMaterial({ map: t, shininess: 60, specular: 0x404040 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((a0 + a1) / 2, 0.004, this.B((b0 + b1) / 2));
    this.g.add(m);
  }

  // ---------------------------------------------------- the three plans
  //
  // (Laid out for a flat RD deep and SLOT wide -- 6 m by 4.6 m: the furniture
  // its real size and against its walls, so there is floor between it, and
  // room to get round the bed, into the wardrobe, behind the bathroom door.)

  /**
   * A: the bathroom beside the door (a 0..2.4, b 1.75..SLOT), the bedroom
   * beyond.  With a bath: the curtain is the place to hide.  Without: a
   * toilet and basin, and the space behind the opened door.
   */
  planA(withBath: boolean): void {
    const r = this.r;
    this.tiles(0, 2.4, 1.75, SLOT);
    // the partition: along b = 1.75 with the bath door at a 0.87..1.65, and along a = 2.4
    this.wall(0, 1.75, 0.86, 1.75);
    this.wall(1.65, 1.75, 2.4, 1.75);
    this.wall(2.4, 1.75, 2.4, SLOT);
    const above = new THREE.Mesh(new THREE.BoxGeometry(0.8, CEIL - 2.1, 0.08), this.wallMat);
    above.position.set(1.26, 2.1 + (CEIL - 2.1) / 2, this.B(1.75));
    this.g.add(above);
    this.pt('p1', 2.6, 1.0);
    this.pt('c', 4.2, 1.6);
    this.pt('bo', 1.25, 1.25);
    this.pt('bi', 1.25, 2.45);
    this.link('in', 'p1');
    this.link('p1', 'c');
    this.link('p1', 'bo');
    this.link('in', 'bo');
    let door: Door;
    if (withBath) {
      door = this.bathDoor(1.65, 1.75, Math.PI, Math.PI / 2, null, 'bi');
      this.bath(0.05, 1.75, SLOT - 0.75, SLOT - 0.02, 'b0', 'bi');
      this.toilet(2.1, 2.35, -Math.PI / 2);
      this.sink(0.3, 2.05, Math.PI / 2);
    } else {
      // the pocket behind the door: between the opened leaf (a 1.65) and the wall (a 2.4)
      door = this.bathDoor(1.65, 1.75, Math.PI, Math.PI / 2, { a: 2.0, b: 2.18, peekA: 1.74, peekB: 1.82, lookA: 1.1, lookB: -1.4, fromA: 1.25, fromB: 2.4 }, 'bi');
      this.toilet(0.35, SLOT - 0.35, Math.PI / 2);
      this.sink(0.3, 2.08, Math.PI / 2);
      if (r() < 0.6) this.plant(2.05, SLOT - 0.3);
    }
    this.link('bo', 'bi', door);
    const under = r() < 0.85;
    this.bed(RD - 1.95, 2.3, 3.85, false, under, 'c');
    this.nightstand(RD - 0.25, 4.1);
    if (r() < 0.75) this.wardrobe(3.9, 0.31, 0, 'c');
    else this.desk(3.9, 0.3, 0);
    if (r() < 0.6) this.desk(2.6, 0.27, 0);
    if (r() < 0.6) this.armchair(3.0, 3.9, Math.PI);
    if (r() < 0.6) this.plant(RD - 0.3, 0.3);
    this.window(0.6, 1.9);
    this.rug(4.2, 1.5, 1.6, 0.9);
    this.picture(4.4, 0, 'b1');
  }

  /**
   * B: a separate WC off the entry (a 0..WC_A, b SLOT-WC_B..SLOT) and a
   * bedroom.  Big enough to walk into and shut the door behind you: the door
   * opens in, and in a WC 1.5 m deep you were standing where it swings, so it
   * stopped against you and would not shut.
   */
  planB(): void {
    const r = this.r;
    const WC_A = 2.3;
    const WC_B = 2.2;
    const wb = SLOT - WC_B;
    this.tiles(0, WC_A, wb, SLOT);
    this.wall(0, wb, 0.55, wb);
    this.wall(1.33, wb, WC_A, wb);
    this.wall(WC_A, wb, WC_A, SLOT);
    const above = new THREE.Mesh(new THREE.BoxGeometry(0.78, CEIL - 2.1, 0.08), this.wallMat);
    above.position.set(0.94, 2.1 + (CEIL - 2.1) / 2, this.B(wb));
    this.g.add(above);
    this.pt('p1', 2.6, 2.3);
    this.pt('c', 4.0, 2.8);
    this.pt('wo', 0.95, wb - 0.45);
    this.pt('wi', 0.95, wb + 0.48);
    this.link('in', 'p1');
    this.link('p1', 'c');
    this.link('in', 'wo');
    this.link('wo', 'p1');
    // the WC door hinged at its wall end: open, it leaves a pocket against the corridor wall
    const door = this.bathDoor(0.55, wb, 0, Math.PI / 2, { a: 0.29, b: wb + 0.38, peekA: 0.47, peekB: wb + 0.06, lookA: 1.45, lookB: wb - 2.1, fromA: 1.0, fromB: wb + 0.48 }, 'wi');
    this.link('wo', 'wi', door);
    this.toilet(WC_A - 0.4, SLOT - 0.3, Math.PI);
    this.sink(0.85, SLOT - 0.22, Math.PI, false);
    const under = r() < 0.85;
    this.bed(RD - 2.0, 0.18, 1.78, true, under, 'c');
    this.nightstand(RD - 0.25, 1.98);
    this.wardrobe(3.6, SLOT - 0.31, Math.PI, 'c');
    if (r() < 0.7) this.armchair(RD - 0.4, 3.0, -Math.PI / 2);
    this.desk(2.2, 0.27, 0);
    if (r() < 0.6) this.plant(RD - 0.3, SLOT - 0.3);
    this.rug(3.6, 1.0, 1.6, 0.9);
    this.window(2.4, 3.6);
    this.picture(3.0, 0, 'b0');
  }

  /**
   * C: a studio, its bathroom in the far corner (a RD-2..RD, b SLOT-2..SLOT)
   * with a bath -- room enough inside, past the door's swing, to shut it.
   */
  planC(): void {
    const r = this.r;
    const ba = RD - 2.0;
    const bb = SLOT - 2.0;
    this.tiles(ba, RD, bb, SLOT);
    this.wall(ba, bb, ba + 0.1, bb);
    this.wall(ba + 0.88, bb, RD, bb);
    this.wall(ba, bb, ba, SLOT);
    const above = new THREE.Mesh(new THREE.BoxGeometry(0.78, CEIL - 2.1, 0.08), this.wallMat);
    above.position.set(ba + 0.49, 2.1 + (CEIL - 2.1) / 2, this.B(bb));
    this.g.add(above);
    this.pt('c', 3.0, 1.5);
    this.pt('bo', ba + 0.47, bb - 0.5);
    this.pt('bi', ba + 0.47, bb + 0.5);
    this.link('in', 'c');
    this.link('c', 'bo');
    const door = this.bathDoor(ba + 0.1, bb, 0, Math.PI / 2, null, 'bi');
    this.link('bo', 'bi', door);
    this.bath(RD - 0.7, RD - 0.02, bb + 0.05, SLOT - 0.02, 'a0', 'bi');
    this.toilet(ba + 0.35, SLOT - 0.3, Math.PI);
    const under = r() < 0.8;
    this.bedAlong(1.2, 3.15, SLOT - 1.55, under, 'c');
    this.wardrobe(RD - 0.31, 0.9, -Math.PI / 2, 'c');
    this.desk(0.27, 2.0, Math.PI / 2);
    if (r() < 0.7) this.plant(3.4, 0.25);
    if (r() < 0.6) this.armchair(2.0, 0.5, 0);
    this.rug(2.6, 1.6, 1.8, 1.0);
    this.window(1.4, 2.4);
    this.picture(2.2, 0, 'b1');
  }

  /** A bed against the b = SLOT wall, head at the outside end, a0..a1 along it, open toward -b. */
  private bedAlong(a0: number, a1: number, b0: number, under: boolean, navKey: string): void {
    // (built as a bed turned through 90 degrees: reuse `bed` by thinking in a/b swapped)
    const r = this.r;
    const len = a1 - a0;
    const w = SLOT - b0 - 0.05;
    const am = (a0 + a1) / 2;
    const bm = b0 + w / 2;
    const o = this.grp(am, bm, 0);
    o.rotation.y = this.T(0) + (this.flip ? 0 : 0);
    const frameMat = [this.M.walnut, this.M.oak, this.M.whiteWood][Math.floor(r() * 3)];
    const duvet = new THREE.MeshLambertMaterial({ map: (() => { const t = new THREE.CanvasTexture(fabricTex([0x5a4a6a, 0x9a8a5a, 0x3a5a8a][Math.floor(r() * 3)], this.room.id + 1, true)); t.colorSpace = THREE.SRGBColorSpace; return t; })() });
    // (group-local: x along a, z along the flipped b)
    const zs = this.flip ? -1 : 1;
    const clear = under ? 0.36 : 0;
    if (under) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.07, clear, 0.07, frameMat, o, sx * (len / 2 - 0.05), clear / 2, sz * (w / 2 - 0.05));
      for (const sz of [-1, 1]) box(len, 0.12, 0.05, frameMat, o, 0, clear + 0.06, sz * (w / 2 - 0.025));
      for (let k = 0; k < 12; k++) box(0.08, 0.02, w - 0.1, this.M.slat, o, -len / 2 + 0.12 + k * ((len - 0.24) / 11), clear + 0.01, 0);
    } else box(len, 0.36, w, frameMat, o, 0, 0.18, 0);
    box(len - 0.04, 0.22, w - 0.04, this.M.mattress, o, 0, 0.47, 0);
    box(len * 0.78, 0.08, w + 0.06, duvet, o, -len * 0.11, 0.62, 0);
    box(len * 0.78, 0.3, 0.02, duvet, o, -len * 0.11, 0.48, zs * -(w / 2 + 0.03));
    box(0.36, 0.12, w - 0.1, this.M.pillow, o, len / 2 - 0.25, 0.64, 0);
    box(0.06, 1.0, w + 0.1, frameMat, o, len / 2 - 0.03, 0.5, 0);
    this.solid(a0, a1, b0, SLOT, 0.65);
    if (!under) return;
    const sp: HideSpot = {
      id: `${this.room.id}-bed`,
      kind: 'bed',
      room: this.room,
      floor: this.fl.f,
      approach: this.W(am, b0 - 0.55),
      exit: this.W(am, b0 - 0.55),
      eye: this.W3(am, 0.17, bm + 0.15),
      look: this.W3(am, 0.16, b0 - 3),
      peekEye: this.W3(am, 0.13, b0 + 0.12),
      peekLook: this.W3(am + 0.3, 0.25, b0 - 3),
      peekFov: 64,
      inspectFrom: this.W(am, b0 - 0.7),
      inspectAt: this.W3(am, 0.18, bm),
      crouch: true,
      setOpen: () => undefined,
      openK: 0,
      door: null,
      node: null,
    };
    (sp as HideSpot & { navKey?: string }).navKey = navKey;
    this.room.spots.push(sp);
    this.b.spots.push(sp);
  }
}
