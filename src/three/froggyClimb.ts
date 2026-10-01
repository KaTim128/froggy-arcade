/**
 * HOW HE GOES OVER THINGS.
 *
 * The climb used to be a pose laid over a hop: the whole body rose on an arc
 * a metre above whatever he was crossing, the knees folded up under him and
 * the arms swung, so what you saw was a bundle of sticks floating over a
 * counter.  This is the climb as a sequence of contacts instead, worked out
 * from the thing in front of him:
 *
 *   REACH  -- both hands up onto the near edge, fingers over it, and his
 *             weight sinks into his legs.
 *   PULL   -- he hauls on it: the hips come up the face (on anything tall
 *             the feet leave the floor and hang), the body folds forward.
 *   OVER   -- one knee comes up high and that foot goes onto the top, the
 *             hips come over the edge onto it, then the other foot.
 *   CROSS  -- low on all fours across the top, a hand moved at a time to the
 *             far edge, a foot at a time behind them.
 *   DOWN   -- both hands on the far edge, he lowers himself over it and a
 *             foot reaches down for the floor, then the other, and he lets go.
 *   STAND  -- he straightens up and walks off.
 *
 * Everything here is a PLACE: where each hand and foot is, where his hips
 * are and how far he is folded.  The rig does the rest with the same leg and
 * arm solvers it walks with, and those never stretch a limb -- a foot that
 * cannot reach where it is going hangs toward it -- so the only way to get a
 * limb in the wrong place is to ask for one, and nothing below does.
 *
 * Distances are along his path, in metres from where he started (`s`), and
 * heights above the floor (`y`).  The path runs straight through the thing
 * he is climbing: it starts at `near` and ends at `far`, `top` high.
 */

export interface ClimbGeom {
  /** Along the path to the near face, and to the far one. */
  near: number;
  far: number;
  /** The whole path, start to landing. */
  len: number;
  /** How high the top is. */
  top: number;
  /** His scale: world metres per model unit. */
  size: number;
}

export interface ClimbPoint {
  s: number;
  y: number;
  /** 0..1 how much it is on the thing (hands) / how firmly placed (feet). */
  w: number;
}

/** A foot, and whether it is hanging (toes down) rather than standing on something. */
export interface ClimbFoot extends ClimbPoint {
  hang: number;
}

export interface ClimbFrame {
  /** 0..1 how much of him the climb owns: eased on at the start, off at the end. */
  k: number;
  /** Where his hips are along the path; the room puts him there. */
  s: number;
  /** Height of his hip joints over the floor. */
  hip: number;
  /** How far the body is folded forward, radians. */
  pitch: number;
  /** His weight going over onto the foot that is down. */
  roll: number;
  /** [left, right]. */
  feet: [ClimbFoot, ClimbFoot];
  hands: [ClimbPoint, ClimbPoint];
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const ss = (v: number): number => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

/** One place a hand or a foot is put, and when it is there. */
interface Plant {
  s: number;
  y: number;
  /** When it arrives, and when it leaves: fractions of the whole climb. */
  on: number;
  off: number;
}

/**
 * Where a hand or foot is at `u`, going from plant to plant.  Between two it
 * swings: UP first and then over when it is going up onto something, and
 * over first and then down when it is coming off -- so it goes round the
 * edge rather than through it -- with a lift in the middle.
 */
function along(
  plants: Plant[],
  u: number,
  lift: number,
): { s: number; y: number; swing: number; up: boolean } {
  if (u <= plants[0].off)
    return { s: plants[0].s, y: plants[0].y, swing: 0, up: false };
  for (let i = 1; i < plants.length; i++) {
    const a = plants[i - 1];
    const b = plants[i];
    if (u < b.on) {
      const t = (u - a.off) / Math.max(1e-4, b.on - a.off);
      const up = b.y >= a.y;
      const ty = up ? ss(t / 0.6) : ss((t - 0.4) / 0.6);
      const ts = up ? ss((t - 0.35) / 0.65) : ss(t / 0.6);
      return {
        s: a.s + (b.s - a.s) * ts,
        y: a.y + (b.y - a.y) * ty + Math.sin(Math.PI * clamp01(t)) * lift,
        swing: Math.sin(Math.PI * clamp01(t)),
        up: b.y > a.y,
      };
    }
    if (u <= b.off) return { s: b.s, y: b.y, swing: 0, up: false };
  }
  const z = plants[plants.length - 1];
  return { s: z.s, y: z.y, swing: 0, up: false };
}

/** How tall it is for him: 0 a step up, 1 a wall he has to haul himself up. */
function tallness(g: ClimbGeom): number {
  return clamp01((g.top - 0.45 * g.size) / (1.25 * g.size));
}

/** The beats, as fractions of the whole climb: [reach, pull, over, cross, down, stand] ends. */
function beats(g: ClimbGeom): number[] {
  const tall = tallness(g);
  const depth = Math.max(0, g.far - g.near);
  const w = [
    0.17,
    0.12 + 0.16 * tall,
    0.17,
    0.1 + 0.22 * clamp01(depth / (1.2 * g.size)),
    0.2,
    0.14,
  ];
  const sum = w.reduce((x, y) => x + y, 0);
  const out: number[] = [];
  let acc = 0;
  for (const x of w) {
    acc += x / sum;
    out.push(acc);
  }
  return out;
}

/** How long the whole climb takes, in seconds: longer for a taller thing and a longer way over. */
export function climbSeconds(g: ClimbGeom): number {
  const tall = tallness(g);
  return (
    1.05 +
    tall * 0.75 +
    Math.max(0, g.far - g.near) * 0.28 +
    Math.max(0, g.len - (g.far - g.near)) * 0.12
  );
}

export function climbFrame(u: number, g: ClimbGeom): ClimbFrame {
  u = clamp01(u);
  const S = g.size;
  const h = g.top;
  const a = g.near;
  const b = Math.max(g.far, a + 0.05);
  const tall = tallness(g);
  const [tR, tP, tO, tC, tD] = beats(g);
  const dur = (x: number, y: number) => y - x;

  // ---- THE HIPS.
  const stand = 1.03 * S;
  // over the top: lower the taller it is, until he is right down on all fours
  const onTop = h + (0.86 - 0.18 * tall) * S;
  const foldTop = 0.95 + 0.4 * tall;
  // the top, from a bit in from each edge (all of it, if it is narrow)
  const mid = (a + b) / 2;
  const topIn = Math.min(a + 0.22 * S, mid);
  const topOut = Math.max(b - 0.22 * S, topIn);
  // Stopped short of it, he steps in first: close enough to reach the edge
  // and haul on it, not so close his knees or his belly are in the face --
  // further back from a tall one, which he hangs off rather than leans on.
  const inS = Math.max(0, a - (0.4 + 0.3 * tall) * S);
  const pullS = inS;
  // upright under a tall one, reaching UP; folded toward a low one
  const reachFold = 0.55 - 0.25 * tall;
  const pullY = Math.max(stand * 0.88, h - 0.05 * S);
  const downS = b + 0.42 * S;
  const downY = stand * 0.74;

  const bodyAt = (u: number): { s: number; hip: number; pitch: number } => {
    let s: number;
    let hip: number;
    let pitch: number;
    if (u < tR) {
      // stepping in and reaching up for it, the weight going down into the legs
      const t = ss(u / tR);
      s = inS * t;
      hip = stand + (stand * 0.88 - stand) * t;
      pitch = 0.2 + (reachFold - 0.2) * t;
    } else if (u < tP) {
      // the haul: slow off the bottom, quick at the top
      const t = (u - tR) / dur(tR, tP);
      const e = t * t * (2.2 - 1.2 * t);
      s = inS + (pullS - inS) * ss(t);
      hip = stand * 0.88 + (pullY - stand * 0.88) * e;
      pitch = reachFold + 0.1 * ss(t);
    } else if (u < tO) {
      // over the edge: UP first, then in, so the hips go over the corner
      const t = (u - tP) / dur(tP, tO);
      s = pullS + (topIn - pullS) * ss((t - 0.25) / 0.75);
      hip = pullY + (onTop - pullY) * ss(t / 0.6);
      // (and he only folds over it once his hips are up past the edge)
      pitch =
        reachFold + 0.1 + (foldTop - reachFold - 0.1) * ss((t - 0.3) / 0.7);
    } else if (u < tC) {
      // across the top, low
      const t = (u - tO) / dur(tO, tC);
      s = topIn + (topOut - topIn) * ss(t);
      hip = onTop + Math.sin(Math.PI * t * 2) * 0.03 * S;
      pitch = foldTop;
    } else if (u < tD) {
      // down the far side: OUT first, then down
      const t = (u - tC) / dur(tC, tD);
      s = topOut + (downS - topOut) * ss(t / 0.7);
      hip = onTop + (downY - onTop) * ss((t - 0.45) / 0.55);
      pitch = foldTop + (0.6 - foldTop) * ss(t);
    } else {
      const t = (u - tD) / dur(tD, 1);
      s = downS + (g.len - downS) * ss(t);
      hip = downY + (stand - downY) * ss(t);
      pitch = 0.6 + (0.2 - 0.6) * ss(t);
    }
    return { s, hip, pitch };
  };
  const { s, hip, pitch } = bodyAt(u);

  // ---- THE FEET.  Left leads.
  const onTopAt = (x: number) =>
    Math.min(Math.max(x, a + 0.1 * S), Math.max(a + 0.1 * S, b - 0.08 * S));
  const farFloor = b + 0.5 * S;
  const stepIn = inS > 0.05 * S;
  // Across the top he walks it on all fours, a foot at a time, each put
  // down a little behind where his hips are going -- however deep it is, no
  // foot is left behind while the rest of him goes on.
  const C = dur(tO, tC);
  const nSteps = Math.max(1, Math.round((topOut - topIn) / (0.42 * S)));
  const slot = C / (nSteps + 1);
  const crossSteps = (
    ph: number,
    behind: number,
    last: number,
    lastOff: number,
  ): Plant[] => {
    const out: Plant[] = [];
    for (let j = 0; j < nSteps; j++) {
      const on = tO + slot * (j + 0.6 + ph);
      const at =
        j === nSteps - 1
          ? last
          : onTopAt(bodyAt(Math.min(tC, on + slot * 0.6)).s - behind);
      out.push({ s: at, y: h, on, off: on + slot * 0.55 });
    }
    out[out.length - 1].off = lastOff;
    return out;
  };
  const lPlants: Plant[] = [
    { s: 0, y: 0, on: 0, off: stepIn ? tR * 0.1 : 0 },
    {
      s: inS + 0.08 * S,
      y: 0,
      on: tR * 0.5,
      off: tR + dur(tR, tP) * (0.35 - 0.2 * tall),
    },
    {
      s: onTopAt(a + 0.2 * S),
      y: h,
      on: tP + dur(tP, tO) * 0.45,
      off: tO + slot * 0.1,
    },
    ...crossSteps(0, 0.05 * S, onTopAt(b - 0.28 * S), tC + dur(tC, tD) * 0.15),
    {
      s: farFloor,
      y: 0,
      on: tC + dur(tC, tD) * 0.8,
      off: tD + dur(tD, 1) * 0.3,
    },
    { s: g.len, y: 0, on: 0.97, off: 1 },
  ];
  const rPlants: Plant[] = [
    { s: 0, y: 0, on: 0, off: stepIn ? tR * 0.45 : 0 },
    {
      s: inS - 0.04 * S,
      y: 0,
      on: tR * 0.9,
      off: tR + dur(tR, tP) * (0.8 - 0.5 * tall),
    },
    {
      s: onTopAt(a + 0.1 * S),
      y: h,
      on: tP + dur(tP, tO) * 0.9,
      off: tO + slot * 0.55,
    },
    ...crossSteps(0.5, 0.2 * S, onTopAt(b - 0.18 * S), tC + dur(tC, tD) * 0.35),
    { s: farFloor - 0.12 * S, y: 0, on: tD, off: tD + dur(tD, 1) * 0.55 },
    { s: g.len, y: 0, on: 1, off: 1 },
  ];
  const lf = along(lPlants, u, 0.16 * S);
  const rf = along(rPlants, u, 0.16 * S);
  // Hanging off the edge while the arms do the work: a foot that has left
  // the floor and cannot reach the top yet hangs under him rather than
  // pointing at somewhere it is not going to be for half a second.
  // (hip joint to sole, the leg straight: the thigh, the shin, the foot's depth)
  const reach = 1.02 * S;
  const hangFoot = (f: {
    s: number;
    y: number;
  }): { s: number; y: number; hang: number } => {
    const d = Math.hypot(f.s - s, f.y - hip);
    if (d <= reach) return { ...f, hang: 0 };
    const k = clamp01((d - reach) / (0.5 * S));
    const y = f.y + (Math.max(0, hip - reach) - f.y) * k;
    return {
      s: f.s + (s - 0.12 * S - f.s) * k,
      y,
      // (toes down in the air; a foot coming down to the floor is flat for it)
      hang: k * clamp01(y / (0.4 * S)),
    };
  };
  // And on the way up, a foot does not go up the face (the knee would be in
  // it): it leaves the floor as he hauls and tucks up under him, and comes
  // up onto the top once his hips are over it.
  const tuck = (f: {
    s: number;
    y: number;
    up: boolean;
  }): { s: number; y: number } => {
    if (!f.up) return f;
    const k = 1 - clamp01((hip - h - 0.05 * S) / (0.25 * S));
    if (k <= 0) return f;
    const t = {
      s: Math.min(s - 0.1 * S, a - 0.3 * S),
      y: Math.max(0, hip - 0.85 * S),
    };
    return { s: f.s + (t.s - f.s) * k, y: f.y + (t.y - f.y) * k };
  };
  const lFoot = hangFoot(tuck(lf));
  const rFoot = hangFoot(tuck(rf));

  // ---- THE HANDS.  The right goes up first; the left goes over first.
  const gripNear = a + 0.07 * S;
  const gripFar = b - 0.06 * S;
  const crossHand = Math.min(gripFar, Math.max(gripNear, mid));
  // Letting go, a hand comes up off the far edge and out in front of him
  // with the rest of him -- it is not dragged back through the thing.
  const letGo = { s: downS + 0.3 * S, y: Math.max(h * 0.5, downY * 0.8) };
  // They start where they hang, and go UP the face before they go onto the
  // top: a hand blended straight from hanging to the edge swings through it.
  const hang = {
    s: Math.min(0.2 * S, a - 0.1 * S),
    y: 0.45 * S,
    on: 0,
    off: 0.015,
  };
  const lHand: Plant[] = [
    hang,
    { s: gripNear, y: h, on: tR * 0.85, off: tP + dur(tP, tO) * 0.55 },
    {
      s: crossHand,
      y: h,
      on: tP + dur(tP, tO) * 0.85,
      off: tO + dur(tO, tC) * 0.2,
    },
    {
      s: gripFar,
      y: h,
      on: tO + dur(tO, tC) * 0.5,
      off: tC + dur(tC, tD) * 0.45,
    },
    { ...letGo, on: tD, off: 1 },
  ];
  const rHand: Plant[] = [
    hang,
    { s: gripNear, y: h, on: tR * 0.7, off: tO + dur(tO, tC) * 0.1 },
    {
      s: gripFar,
      y: h,
      on: tO + dur(tO, tC) * 0.75,
      off: tC + dur(tC, tD) * 0.6,
    },
    { ...letGo, on: tD + dur(tD, 1) * 0.2, off: 1 },
  ];
  const lh = along(lHand, u, 0.2 * S);
  const rh = along(rHand, u, 0.2 * S);
  // on as they arrive at the edge the first time, off once they are clear of it
  const handW = () =>
    ss(u / 0.04) * (1 - ss((u - tD - dur(tD, 1) * 0.2) / (dur(tD, 1) * 0.6)));

  // ---- AND THE WEIGHT.  It goes over onto the foot that is down.
  const roll = (rf.swing - lf.swing) * 0.1;

  const k = ss(u / 0.05) * (1 - ss((u - 0.94) / 0.06));
  return {
    k,
    s,
    hip,
    pitch,
    roll,
    feet: [
      { s: lFoot.s, y: lFoot.y, w: 1 - lf.swing, hang: lFoot.hang },
      { s: rFoot.s, y: rFoot.y, w: 1 - rf.swing, hang: rFoot.hang },
    ],
    hands: [
      { s: lh.s, y: lh.y, w: handW() },
      { s: rh.s, y: rh.y, w: handW() },
    ],
  };
}
