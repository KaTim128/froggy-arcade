/**
 * The seeker's map of the room.
 *
 * A grid of half-metre cells over the floor.  A cell is a WALL if it is inside
 * something he cannot climb — the outer walls, the full-height partitions, the
 * racking, the hiding places — and it COSTS EXTRA if it is inside something he
 * can climb, so a route over a sofa is taken when it is genuinely shorter and
 * not otherwise.  A* over that, eight ways, no cutting corners through walls.
 *
 * He used to walk a straight line at whatever he wanted and slide along what
 * he hit, which is fine in an empty room and a disaster in a furnished one:
 * he shouldered partitions, jittered in corners and gave up on reachable
 * spots.  A path is the difference between "heading that way" and "going
 * there".
 */

import type { HideSpot, RoomDef } from './hideRooms';

export const CELL = 0.5;
/** What a step through climbable furniture costs, against 1 for open floor. */
const CLIMB_COST = 4.5;
/** Keep this much clear of things.  Roughly his body radius. */
const PAD = 0.5;

export interface NavGrid {
  cols: number;
  rows: number;
  /** 0 = open, 1 = climbable, 2 = wall. */
  cell: Uint8Array;
  toCell(x: number, z: number): [number, number];
  toWorld(c: number, r: number): [number, number];
}

export interface SpotExtent {
  x: number;
  z: number;
  hw: number;
  hd: number;
}

/** The size of a hiding place's footprint, by kind and facing. */
export function spotExtent(s: HideSpot): SpotExtent {
  const turned = Math.abs(Math.sin(s.rot)) > 0.5;
  let hw = 0.55;
  let hd = 0.4;
  if (s.kind === 'bed') {
    hw = 1.15;
    hd = 0.55;
  }
  return turned ? { x: s.x, z: s.z, hw: hd, hd: hw } : { x: s.x, z: s.z, hw, hd };
}

export function buildGrid(def: RoomDef, climbMaxH: number): NavGrid {
  const cols = Math.ceil((def.halfW * 2) / CELL);
  const rows = Math.ceil((def.halfD * 2) / CELL);
  const cell = new Uint8Array(cols * rows);
  const toCell = (x: number, z: number): [number, number] => [
    Math.max(0, Math.min(cols - 1, Math.floor((x + def.halfW) / CELL))),
    Math.max(0, Math.min(rows - 1, Math.floor((z + def.halfD) / CELL))),
  ];
  const toWorld = (c: number, r: number): [number, number] => [
    -def.halfW + (c + 0.5) * CELL,
    -def.halfD + (r + 0.5) * CELL,
  ];

  const spots = def.spots.map(spotExtent);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const [x, z] = toWorld(c, r);
      let v = 0;
      if (Math.abs(x) > def.halfW - 0.7 || Math.abs(z) > def.halfD - 0.7) v = 2;
      for (const s of spots) {
        if (Math.abs(x - s.x) < s.hw + PAD && Math.abs(z - s.z) < s.hd + PAD) v = 2;
      }
      for (const b of def.furniture) {
        if (Math.abs(x - b.x) < b.w / 2 + PAD && Math.abs(z - b.z) < b.d / 2 + PAD) {
          v = Math.max(v, b.h > climbMaxH ? 2 : 1);
        }
      }
      cell[r * cols + c] = v;
    }
  }
  return { cols, rows, cell, toCell, toWorld };
}

/**
 * A path from here to there, as world points, first step first.  Empty if
 * there is none.  The start is snapped to the nearest open cell so a seeker
 * stood half inside something still gets a route out.
 */
export function findPath(g: NavGrid, fx: number, fz: number, tx: number, tz: number): Array<[number, number]> {
  const [sc0, sr0] = g.toCell(fx, fz);
  const [tc0, tr0] = g.toCell(tx, tz);
  const start = nearestOpen(g, sc0, sr0);
  const goal = nearestOpen(g, tc0, tr0);
  if (!start || !goal) return [];
  const [sc, sr] = start;
  const [tc, tr] = goal;
  const n = g.cols * g.rows;
  const idx = (c: number, r: number) => r * g.cols + c;
  const gScore = new Float32Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open: number[] = [];
  const fScore = new Float32Array(n).fill(Infinity);
  const h = (c: number, r: number) => Math.hypot(c - tc, r - tr);

  const s = idx(sc, sr);
  gScore[s] = 0;
  fScore[s] = h(sc, sr);
  open.push(s);

  const DIRS = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];

  let guard = 0;
  while (open.length > 0 && guard++ < 60000) {
    // Smallest f.  A heap would be faster; the rooms are small enough.
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[bi]]) bi = i;
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cc = cur % g.cols;
    const cr = Math.floor(cur / g.cols);
    if (cc === tc && cr === tr) {
      const out: Array<[number, number]> = [];
      let k = cur;
      while (k !== -1 && k !== s) {
        out.push(g.toWorld(k % g.cols, Math.floor(k / g.cols)));
        k = from[k];
      }
      out.reverse();
      return out;
    }
    for (const [dc, dr, w] of DIRS) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows) continue;
      const ni = idx(nc, nr);
      const v = g.cell[ni];
      if (v === 2 || closed[ni]) continue;
      // No squeezing diagonally between two walls.
      if (dc !== 0 && dr !== 0 && (g.cell[idx(cc + dc, cr)] === 2 || g.cell[idx(cc, cr + dr)] === 2)) continue;
      const step = w * (v === 1 ? CLIMB_COST : 1);
      const tentative = gScore[cur] + step;
      if (tentative < gScore[ni]) {
        gScore[ni] = tentative;
        fScore[ni] = tentative + h(nc, nr);
        from[ni] = cur;
        open.push(ni);
      }
    }
  }
  return [];
}

function nearestOpen(g: NavGrid, c0: number, r0: number): [number, number] | null {
  if (g.cell[r0 * g.cols + c0] !== 2) return [c0, r0];
  for (let radius = 1; radius < 8; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const c = c0 + dc;
        const r = r0 + dr;
        if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) continue;
        if (g.cell[r * g.cols + c] !== 2) return [c, r];
      }
    }
  }
  return null;
}

/** Is a straight line between two points clear of walls (climbables allowed)? */
export function lineOpen(g: NavGrid, ax: number, az: number, bx: number, bz: number, allowClimb: boolean): boolean {
  const d = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(d / (CELL * 0.5)));
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const [c, r] = g.toCell(ax + (bx - ax) * f, az + (bz - az) * f);
    const v = g.cell[r * g.cols + c];
    if (v === 2 || (v === 1 && !allowClimb)) return false;
  }
  return true;
}
