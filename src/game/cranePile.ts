/**
 * ---- THE HEAP IN A CLAW MACHINE, AS ONE THING.
 *
 * Every prize in the glass has ONE position -- `x` across the glass (front
 * view pixels), `z` from the front glass (0) to the back wall (1), and
 * `lift`, how far its feet are off the floor -- and both views are drawn
 * from it: the front view shows x and lift, the side view z and lift.
 * Nothing is placed or moved for one view only.
 *
 * WHAT TOUCHES WHAT is decided on each prize's BODY, not its picture: the
 * pictures are square canvases with empty space round the toy (a capsule is
 * a ball at the foot of its canvas; a plush has ears and arms), so contact
 * is measured on a simplified body -- a box `hw` either side across, `hz`
 * either side in depth, `h` tall to the part something else rests on.
 *
 * A prize is SUPPORTED when it stands on the floor, or when enough of the
 * middle of its body is over the tops of prizes that actually reach up to
 * it -- in BOTH directions, across and in depth.  Screen overlap alone is not
 * support: a toy that looks to be on another from the front may be in front
 * of it or behind it.  An ear or a corner is not enough to balance on.
 *
 * `generatePile` builds a heap bottom up, only putting a prize where it is
 * supported.  `settlePile` makes any heap stable again after something is
 * taken out, knocked or dropped: lowest first, each prize comes down onto
 * what is under it, or slides off an edge it cannot balance on.
 */

/** All the contact tolerances, in one place, in the heap's own units. */
export const CONTACT = {
  /** Body half-width across the glass, as a share of the toy's canvas width. */
  halfW: { plush: 0.31, capsule: 0.34 },
  /**
   * How far up the toy something else rests on it, as a share of its canvas
   * height: a plush's crown, squashed a little; the top of a capsule's ball.
   */
  top: { plush: 0.78, capsule: 0.72 },
  /** Depth units (0..1 = the machine) per pixel of body, for the body's depth. */
  zPerPx: 1 / 250,
  /** How far a soft prize sinks into what it sits on, in pixels. */
  sink: 2,
  /**
   * Two prizes side by side may overlap this share of the narrower body
   * before one has to go on top of the other: soft toys squash together.
   */
  sideBySide: 0.3,
  /** Share of a prize's middle that must be over a support for it to stay put. */
  cover: 0.5,
  /** The middle of the body that has to be held up: this share of it. */
  core: 0.7,
  /** How far an unsupported prize slides off an edge per step, and how many steps. */
  slideX: 4,
  slideZ: 0.025,
  slideSteps: 10,
  /** A change smaller than this is not a move (no jitter). */
  still: 0.5,
};

/** A prize's body in the heap. */
export interface PileBody {
  x: number;
  z: number;
  lift: number;
  /** Half its width across the glass, pixels. */
  hw: number;
  /** Half its depth, in depth units. */
  hz: number;
  /** Height up to where something rests on it, pixels. */
  h: number;
}

/** Where a prize may be: across, and in depth. */
export interface PileBounds {
  l: number;
  r: number;
  zMin: number;
  zMax: number;
}

/** A body for a toy of `kind` drawn `canvasW` x `canvasH` pixels (at the heap's own scale). */
export function bodyFor(kind: 'plush' | 'capsule', canvasW: number, canvasH: number): Pick<PileBody, 'hw' | 'hz' | 'h'> {
  const hw = canvasW * CONTACT.halfW[kind];
  return { hw, hz: hw * CONTACT.zPerPx, h: canvasH * CONTACT.top[kind] };
}

const overlap = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** How much two bodies overlap, across and in depth, as shares of the narrower one. */
function footprintOverlap(a: PileBody, b: PileBody): { x: number; z: number } {
  const ox = overlap(a.x - a.hw, a.x + a.hw, b.x - b.hw, b.x + b.hw) / (2 * Math.min(a.hw, b.hw));
  const oz = overlap(a.z - a.hz, a.z + a.hz, b.z - b.hz, b.z + b.hz) / (2 * Math.min(a.hz, b.hz));
  return { x: ox, z: oz };
}

/**
 * The height `b` comes to rest at among `others`: on top of the highest of
 * them that it is really over (more than side-by-side squashing allows, in
 * both directions), or on the floor.
 */
export function restingLift(b: PileBody, others: readonly PileBody[]): number {
  let lift = 0;
  for (const o of others) {
    if (o === b) continue;
    const f = footprintOverlap(b, o);
    if (f.x > CONTACT.sideBySide && f.z > CONTACT.sideBySide) lift = Math.max(lift, o.lift + o.h - CONTACT.sink);
  }
  return Math.max(0, lift);
}

/**
 * How much of the middle of `b`'s body, standing at `lift`, is over the top
 * of something that reaches up to it: a 3 x 3 grid over the core of its
 * footprint, the share of points held up.  The floor holds everything.
 */
export function supportCover(b: PileBody, lift: number, others: readonly PileBody[]): number {
  if (lift <= CONTACT.still) return 1;
  let held = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const px = b.x + i * b.hw * CONTACT.core;
      const pz = b.z + j * b.hz * CONTACT.core;
      if (others.some((o) => o !== b && Math.abs(px - o.x) <= o.hw && Math.abs(pz - o.z) <= o.hz && o.lift + o.h >= lift + CONTACT.sink - 1)) held++;
    }
  }
  return held / 9;
}

export function isSupported(b: PileBody, lift: number, others: readonly PileBody[]): boolean {
  return supportCover(b, lift, others) >= CONTACT.cover;
}

/**
 * Where `b` ends up if it is let go among `others`: straight down onto what
 * is under it -- or, if it would only be balanced on an edge, off that edge
 * a step at a time (away from the middle of what it was perched on) until it
 * is held up or down on the floor.  Bounded: it never loops.
 */
export function restPlace(b: PileBody, others: readonly PileBody[], bounds: PileBounds): { x: number; z: number; lift: number } {
  const p: PileBody = { ...b, ...clampTo(b, b.x, b.z, bounds) };
  for (let step = 0; step <= CONTACT.slideSteps; step++) {
    const lift = restingLift(p, others);
    if (isSupported(p, lift, others)) return { x: p.x, z: p.z, lift };
    // off the edge of the highest thing it is perched on
    let perch: PileBody | null = null;
    for (const o of others) {
      if (o === b) continue;
      const f = footprintOverlap(p, o);
      if (f.x > CONTACT.sideBySide && f.z > CONTACT.sideBySide && (!perch || o.lift + o.h > perch.lift + perch.h)) perch = o;
    }
    if (!perch) break;
    const dx = p.x - perch.x || (p.x < (bounds.l + bounds.r) / 2 ? 1 : -1);
    const dz = p.z - perch.z || (p.z < (bounds.zMin + bounds.zMax) / 2 ? 1 : -1);
    Object.assign(p, clampTo(p, p.x + Math.sign(dx) * CONTACT.slideX, p.z + Math.sign(dz) * CONTACT.slideZ, bounds));
  }
  // Wedged where nothing holds it (a hollow, or against the glass): the
  // nearest place that does, searched outwards on a bounded grid.
  let best: { x: number; z: number; lift: number } | null = null;
  let bestD = Infinity;
  for (let i = -16; i <= 16; i++) {
    for (let j = -12; j <= 12; j++) {
      const d = (i * CONTACT.slideX) ** 2 + ((j * CONTACT.slideZ) / CONTACT.zPerPx) ** 2 * 0.25;
      if (d >= bestD) continue;
      const q: PileBody = { ...p, ...clampTo(p, p.x + i * CONTACT.slideX, p.z + j * CONTACT.slideZ, bounds) };
      const lift = restingLift(q, others);
      if (isSupported(q, lift, others)) {
        best = { x: q.x, z: q.z, lift };
        bestD = d;
      }
    }
  }
  return best ?? { x: p.x, z: p.z, lift: restingLift(p, others) };
}

/** `x`, `z` kept inside `bounds` for a body of `b`'s size. */
function clampTo(b: PileBody, x: number, z: number, bounds: PileBounds): { x: number; z: number } {
  return {
    x: Math.min(bounds.r - b.hw, Math.max(bounds.l + b.hw, x)),
    z: Math.min(bounds.zMax, Math.max(bounds.zMin, z)),
  };
}

/**
 * Make the whole heap stable.  Lowest first, each prize comes to rest on
 * what has already settled under it (`restPlace`), so a chain of them --
 * one taken out from under two -- comes down in one pass, in order.
 * Returns the index and new place of every prize that moved; the bodies are
 * updated in place.
 */
export function settlePile(bodies: PileBody[], bounds: PileBounds): Array<{ i: number; x: number; z: number; lift: number }> {
  const order = bodies.map((_, i) => i).sort((a, b) => bodies[a].lift - bodies[b].lift);
  const settled: PileBody[] = [];
  const moved: Array<{ i: number; x: number; z: number; lift: number }> = [];
  for (const i of order) {
    const b = bodies[i];
    const to = restPlace(b, settled, bounds);
    if (Math.abs(to.lift - b.lift) > CONTACT.still || Math.abs(to.x - b.x) > CONTACT.still || Math.abs(to.z - b.z) > 0.005) {
      b.x = to.x;
      b.z = to.z;
      b.lift = to.lift;
      moved.push({ i, ...to });
    }
    settled.push(b);
  }
  return moved;
}

/**
 * A fresh heap, BOTTOM UP.  The floor first: rows from the back to the
 * front, staggered, with a little squash between neighbours.  Then the
 * prizes that go on top, each only where it is properly held up and below
 * `maxLift` -- more of them towards the middle, where a heap is tallest.
 * Every try is bounded; a place that cannot be made good is not used.
 */
export function generatePile(o: {
  bounds: PileBounds;
  body: Pick<PileBody, 'hw' | 'hz' | 'h'>;
  rows: number[];
  /** How many go on top, as a share of the bottom layer. */
  upper: number;
  maxLift: number;
  rnd: () => number;
}): Array<{ x: number; z: number; lift: number }> {
  const { bounds, body, rnd } = o;
  const placed: PileBody[] = [];
  const jitter = (n: number) => (rnd() * 2 - 1) * n;
  // ---- the floor layer
  o.rows.forEach((rz, row) => {
    const step = body.hw * 2 * (1 - CONTACT.sideBySide * 0.6);
    for (let x = bounds.l + body.hw + (row % 2) * step * 0.5 + rnd() * 4; x <= bounds.r - body.hw; x += step + jitter(2)) {
      const b: PileBody = { ...body, x: 0, z: 0, lift: 0 };
      Object.assign(b, clampTo(b, x + jitter(2), rz + jitter(0.06), bounds));
      // (no two on the floor deeper into each other than squashing allows)
      if (restingLift(b, placed) > 0) continue;
      placed.push(b);
    }
  });
  // ---- the ones on top, only where something holds them up
  const want = Math.round(placed.length * o.upper);
  const mid = (bounds.l + bounds.r) / 2;
  const half = (bounds.r - bounds.l) / 2;
  let added = 0;
  for (let tries = 0; tries < want * 30 && added < want; tries++) {
    // towards the middle: the mean of two throws
    const x = mid + ((rnd() + rnd()) / 2 - 0.5) * 2 * (half - body.hw);
    const z = bounds.zMin + rnd() * (bounds.zMax - bounds.zMin);
    const b: PileBody = { ...body, x, z, lift: 0 };
    const lift = restingLift(b, placed);
    if (lift <= 0 || lift > o.maxLift) continue;
    if (!isSupported(b, lift, placed)) continue;
    b.lift = lift;
    placed.push(b);
    added++;
  }
  return placed.map((b) => ({ x: b.x, z: b.z, lift: b.lift }));
}
