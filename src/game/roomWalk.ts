/**
 * WALKING UP TO THINGS.
 *
 * The arcade rooms used to let a click on a machine start it from anywhere
 * in the room, and the machines themselves were pictures: you walked
 * straight through them.  Now a machine is a thing on the floor --
 *
 *  - it has a FOOTPRINT, a box at its base the player cannot stand in, so
 *    you walk round it, and behind it along the wall;
 *  - it has a place to STAND, in front of the screen, and only there does
 *    it answer [E];
 *  - and a click or tap on it does not start it: it walks you over, round
 *    whatever is in the way, and starts it when you get there.
 *
 * The same goes for doors.  Any key pressed on the way takes the walk back.
 */

import Phaser from 'phaser';
import { PLAYER_SPEED, type Player } from '../art/player';

export interface Pt {
  x: number;
  y: number;
}

/** A footprint on the floor, top-left and size, in room pixels. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Half the width of the player's feet: a footprint is grown by it. */
const FEET = 3;

export function inBox(b: Box, x: number, y: number): boolean {
  return x > b.x - FEET && x < b.x + b.w + FEET && y > b.y && y < b.y + b.h;
}

/** Something on the floor you walk up to. */
export interface Spot {
  /** Where the feet go to use it. */
  stand: Pt;
  /** Where you may not stand (none for a doorway). */
  solid?: Box;
  /** Stood at it, the right way round. */
  at(px: number, py: number): boolean;
}

/**
 * A stand-up cabinet (or a claw machine): `x` its middle, `base` the floor
 * line it stands on, `w` its width.  The box is its last eight pixels of
 * floor -- the cabinet's depth -- and you play it from the front, square on.
 */
export function machineSpot(x: number, base: number, w: number, depth = 8): Spot {
  return {
    stand: { x, y: base + 8 },
    solid: { x: x - w / 2, y: base - depth, w, h: depth + 1 },
    at: (px, py) => Math.abs(px - x) <= w / 2 + 3 && py >= base && py <= base + 18,
  };
}

/** A doorway: no footprint, just somewhere to stand. */
export function doorSpot(stand: Pt, at: (px: number, py: number) => boolean): Spot {
  return { stand, at };
}

/**
 * The step just taken ends inside something: take it back on the axis that
 * walked in, so the player stops against the edge and slides along the
 * other one.  Started inside (a spawn on a machine) -- put them out in front.
 */
export function collide(player: Player, before: Pt, solids: readonly Box[]): void {
  const hit = (x: number, y: number) => solids.some((b) => inBox(b, x, y));
  if (!hit(player.x, player.y)) return;
  if (!hit(before.x, player.y)) player.setPosition(before.x, player.y);
  else if (!hit(player.x, before.y)) player.setPosition(player.x, before.y);
  else if (!hit(before.x, before.y)) player.setPosition(before.x, before.y);
  else {
    const b = solids.find((s) => inBox(s, player.x, player.y));
    if (b) player.setPosition(player.x, b.y + b.h + 1);
  }
}

const CELL = 3;

/**
 * A path from `from` to `to` round the footprints, inside `bounds`: a
 * breadth-first search over a three-pixel grid, then pulled tight so the
 * walk is a few straight legs rather than a staircase.  Null if there is no
 * way there.
 */
export function findPath(from: Pt, to: Pt, bounds: Phaser.Geom.Rectangle, solids: readonly Box[]): Pt[] | null {
  const cols = Math.floor(bounds.width / CELL) + 1;
  const rows = Math.floor(bounds.height / CELL) + 1;
  const cx = (c: number) => bounds.x + c * CELL;
  const cy = (r: number) => bounds.y + r * CELL;
  const free = (x: number, y: number) =>
    x >= bounds.x && x <= bounds.right && y >= bounds.y && y <= bounds.bottom && !solids.some((b) => inBox(b, x, y));
  const cellOf = (p: Pt) => ({
    c: Phaser.Math.Clamp(Math.round((p.x - bounds.x) / CELL), 0, cols - 1),
    r: Phaser.Math.Clamp(Math.round((p.y - bounds.y) / CELL), 0, rows - 1),
  });
  const s = cellOf(from);
  const g = cellOf(to);
  const prev = new Int32Array(cols * rows).fill(-1);
  const start = s.r * cols + s.c;
  const goal = g.r * cols + g.c;
  prev[start] = start;
  const queue = [start];
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi];
    if (i === goal) break;
    const c = i % cols;
    const r = (i - c) / cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const n = nr * cols + nc;
      if (prev[n] !== -1) continue;
      if (!free(cx(nc), cy(nr))) continue;
      // no cutting a corner through a footprint
      if (dc && dr && (!free(cx(c + dc), cy(r)) || !free(cx(c), cy(r + dr)))) continue;
      prev[n] = i;
      queue.push(n);
    }
  }
  if (prev[goal] === -1) return null;
  const cells: Pt[] = [];
  for (let i = goal; i !== start; i = prev[i]) cells.push({ x: cx(i % cols), y: cy(Math.floor(i / cols)) });
  cells.reverse();
  cells[cells.length - 1] = { ...to };
  if (cells.length === 0) cells.push({ ...to });
  // pulled tight: from each corner, straight to the furthest one in sight
  const clear = (a: Pt, b: Pt) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
    for (let k = 1; k < n; k++) if (!free(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n)) return false;
    return true;
  };
  const legs: Pt[] = [];
  let at: Pt = from;
  let i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !clear(at, cells[j])) j--;
    legs.push(cells[j]);
    at = cells[j];
    i = j + 1;
  }
  return legs;
}

/**
 * Walks the player along a path and does the thing at the end of it.  The
 * room calls `drive` from its update instead of moving the player itself
 * while a walk is on, and `cancel` the moment a movement key is pressed.
 */
export class Walker {
  private path: Pt[] = [];
  private done: (() => void) | null = null;
  private stuck = 0;
  private last: Pt = { x: 0, y: 0 };

  constructor(
    private readonly bounds: () => Phaser.Geom.Rectangle,
    private readonly solids: () => readonly Box[],
  ) {}

  get active(): boolean {
    return this.path.length > 0;
  }

  cancel(): void {
    this.path = [];
    this.done = null;
  }

  /** Walk to `spot` and then `then()` -- or just do it, if already there. */
  to(player: Player, spot: Spot, then: () => void): void {
    // Already stood where it is used from: use it.  In reach but off to one
    // side, the last few steps are still walked -- the thing is used from its
    // place, never from wherever the click happened to find you.
    const there = Math.hypot(player.x - spot.stand.x, player.y - spot.stand.y) <= 3;
    if (there) {
      this.cancel();
      then();
      return;
    }
    const path = findPath({ x: player.x, y: player.y }, spot.stand, this.bounds(), this.solids());
    if (!path) {
      // (no way to the spot itself, but in reach of it: that will do)
      if (spot.at(player.x, player.y)) {
        this.cancel();
        then();
      }
      return;
    }
    this.path = path;
    this.done = then;
    this.stuck = 0;
    this.last = { x: player.x, y: player.y };
  }

  drive(player: Player, delta: number): void {
    const next = this.path[0];
    if (!next) return;
    const dx = next.x - player.x;
    const dy = next.y - player.y;
    const step = (PLAYER_SPEED * delta) / 1000;
    if (Math.hypot(dx, dy) <= Math.max(1, step)) {
      player.setPosition(next.x, next.y);
      this.path.shift();
      if (this.path.length === 0) {
        player.move(0, 0, delta, this.bounds());
        const f = this.done;
        this.done = null;
        f?.();
      }
      return;
    }
    player.move(dx, dy, delta, this.bounds());
    // held up against something for half a second: give up
    if (Math.hypot(player.x - this.last.x, player.y - this.last.y) < 0.05) this.stuck += delta;
    else this.stuck = 0;
    this.last = { x: player.x, y: player.y };
    if (this.stuck > 500) this.cancel();
  }
}
