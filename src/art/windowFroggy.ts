/**
 * ---- HIM, AT THE WINDOW.  Room 612, three in the morning.
 *
 * The thing from the rooms, the alley and the road -- THE LONG ONE (see
 * three/froggyMonster) -- drawn in the hotel's pixels, flattened against the
 * glass from outside six floors up:
 *
 *   the wide grey dome of Froggy's head filling the panes, the two great eyes
 *   up on the corners of it, the right one larger and higher; bloodshot
 *   whites under heavy creased lids, and pupils shrunk to a point that are on
 *   YOU; the pale muzzle with its two nostrils; the mouth -- wider than the
 *   head, hanging open, yellowed teeth in raw gums, a strand of drool;
 *
 *   the thin neck with its tendons standing out, the bony shoulders and the
 *   cage of ribs under them;
 *
 *   and the arms, far too long, up either side of the glass, the long
 *   jointed fingers splayed on it with their pads squashed white.
 *
 * Every pixel is a hard-edged rect: it is the same flat pixel world as the
 * room, and the horror is in the drawing, not in a blur.
 *
 * The canvas is the window plus a margin all round (WF.pad), so when he comes
 * through, his hands can take the frame.
 */

type Ctx = CanvasRenderingContext2D;

export const WF = { pad: 32, winW: 128, winH: 98 };
export const WF_W = WF.winW + WF.pad * 2;
export const WF_H = WF.winH + WF.pad * 2;

const C = {
  outline: '#121110',
  skinDark: '#2e2c29',
  skin: '#4a4741',
  skinLit: '#625e56',
  skinHi: '#7a756a',
  muzzle: '#77736a',
  muzzleHi: '#8e897e',
  lid: '#3a3632',
  lidCrease: '#24221f',
  sclera: '#c2b694',
  scleraShade: '#9a8462',
  vein: '#a8322a',
  pupil: '#020202',
  lip: '#3a2a28',
  gum: '#6a1420',
  gumHi: '#8e2230',
  throat: '#080304',
  tooth: '#d8ccaa',
  toothShade: '#a89a78',
  drool: '#c8ccc4',
  pad: '#9a958a',
};

const r = (g: Ctx, x: number, y: number, w: number, h: number, c: string, a = 1): void => {
  if (w <= 0 || h <= 0) return;
  g.globalAlpha = a;
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  g.globalAlpha = 1;
};

/** A filled pixel ellipse, row by row: hard edges, no smoothing. */
function ell(g: Ctx, cx: number, cy: number, rx: number, ry: number, c: string, a = 1): void {
  for (let y = -Math.floor(ry); y <= Math.floor(ry); y++) {
    const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    r(g, cx - half, cy + y, half * 2 + 1, 1, c, a);
  }
}

/** A thick pixel line, as a run of squares. */
function line(g: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, c: string): void {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    r(g, x0 + (x1 - x0) * t - w / 2, y0 + (y1 - y0) * t - w / 2, w, w, c);
  }
}

/** A limb: an outline, the skin, a lit edge. */
function limb(g: Ctx, x0: number, y0: number, x1: number, y1: number, w: number): void {
  line(g, x0, y0, x1, y1, w + 2, C.outline);
  line(g, x0, y0, x1, y1, w, C.skin);
  line(g, x0 - 1, y0 - 1, x1 - 1, y1 - 1, Math.max(1, w - 3), C.skinLit);
}

export interface WindowFroggyOpts {
  /** Seconds, for breathing and twitching. */
  t: number;
  /** 0..1 how open the mouth hangs. */
  maw: number;
  /** The arm that is striking: which side, and where it is in the blow (0 back .. 1 on the glass). */
  strike: { side: -1 | 1; k: number; at: { x: number; y: number } } | null;
  /** 0..1, coming through the broken window. */
  enter: number;
  /** 0..1, a lurch forward on an impact. */
  lean: number;
}

/**
 * Where his hands rest on the glass when they are not striking, in window
 * coordinates: up either side of him, level with his face.
 */
const REST = { left: { x: 30, y: 30 }, right: { x: 98, y: 34 } };

/**
 * HIM, WHOLE.  Standing on the ledge outside, filling the window from his
 * feet to the top of his head -- three times your height and no wider than a
 * post: the dome of Froggy's head with the two great eyes up on its corners,
 * the pale muzzle and the mouth hanging open under it; a neck like a wrist;
 * a narrow cage of ribs over a belly sunk in; legs that fold at knobbed knees
 * down to splayed frog's feet; and arms far too long, up the glass.
 */
export function drawWindowFroggy(g: Ctx, o: WindowFroggyOpts): void {
  g.clearRect(0, 0, WF_W, WF_H);
  const P = WF.pad;
  const breathe = Math.sin(o.t * 2.1) * 0.6;
  const twitch = Math.sin(o.t * 23) > 0.96 ? 1 : 0;
  g.save();
  g.translate(P, P);
  const cx = 64 + twitch;

  // ---- the legs: long, folded at the knee, down to the ledge
  const legs = (side: -1 | 1): void => {
    const hip = { x: cx + side * 5, y: 66 };
    const knee = { x: cx + side * 16, y: 80 };
    const foot = { x: cx + side * 11, y: 96 };
    limb(g, hip.x, hip.y, knee.x, knee.y, 3);
    limb(g, knee.x, knee.y, foot.x, foot.y, 3);
    ell(g, knee.x, knee.y, 3, 3, C.outline);
    ell(g, knee.x, knee.y, 2, 2, C.skinLit);
    // a frog's foot: three long toes splayed on the ledge
    for (const d of [-5, 0, 5]) line(g, foot.x, foot.y, foot.x + side * 3 + d, foot.y + 2, 2, C.outline);
    for (const d of [-5, 0, 5]) r(g, foot.x + side * 3 + d - 1, foot.y + 1, 3, 1, C.skin);
  };
  legs(-1);
  legs(1);

  // ---- the trunk: a narrow cage of ribs over a sunken belly, hips all bone
  ell(g, cx, 61, 7, 6, C.outline);
  ell(g, cx, 61, 6, 5, C.skinDark);
  r(g, cx - 7, 64, 14, 3, C.outline);
  r(g, cx - 6, 64, 12, 2, C.skin);
  ell(g, cx, 47, 11, 13, C.outline);
  ell(g, cx, 47, 10, 12, C.skinDark);
  ell(g, cx - 2, 44, 7, 9, C.skin);
  for (let k = 0; k < 5; k++) {
    const y = 40 + k * 4 + breathe;
    const w = 16 - k * 2;
    r(g, cx - w / 2, y, w, 1, C.skinLit);
    r(g, cx - w / 2, y + 1, w, 1, C.outline, 0.7);
  }
  r(g, cx, 37, 1, 22, C.skinDark);
  // shoulders: two knobs of bone, and the clavicles between
  for (const side of [-1, 1]) {
    ell(g, cx + side * 11, 37, 4, 3, C.outline);
    ell(g, cx + side * 11, 37, 3, 2, C.skin);
    r(g, cx + side * 11 - 1, 35, 2, 1, C.skinHi);
  }
  r(g, cx - 9, 35, 18, 1, C.skinLit);
  // the neck: thin as a wrist, the tendons standing out
  r(g, cx - 4, 28, 8, 9, C.outline);
  r(g, cx - 3, 28, 6, 9, C.skinDark);
  r(g, cx - 2, 29, 1, 7, C.skinLit);
  r(g, cx + 1, 29, 1, 7, C.skinLit);

  // ---- the arms: far too long, up the glass either side of him
  const arm = (side: -1 | 1): void => {
    const sh = { x: cx + side * 11, y: 38 };
    const rest = side < 0 ? REST.left : REST.right;
    let hand = { ...rest };
    let hs = 1;
    let splay = 1;
    if (o.strike && o.strike.side === side) {
      const k = o.strike.k;
      const back = { x: rest.x + (sh.x - rest.x) * 0.5, y: rest.y + 14 };
      if (k < 0.6) {
        const b = k / 0.6;
        hand = { x: rest.x + (back.x - rest.x) * b, y: rest.y + (back.y - rest.y) * b };
        hs = 1 - 0.3 * b;
        splay = 1 - 0.6 * b;
      } else if (k < 0.72) {
        const b = (k - 0.6) / 0.12;
        hand = { x: back.x + (o.strike.at.x - back.x) * b, y: back.y + (o.strike.at.y - back.y) * b };
        hs = 0.7 + 0.5 * b;
        splay = 0.4 + 0.8 * b;
      } else {
        hand = { ...o.strike.at };
        hs = 1.2 - (k - 0.72) * 0.5;
        splay = 1.2;
      }
    }
    if (o.enter > 0) {
      // through the frame: the hands take the sides of it
      const e = Math.min(1, o.enter * 2);
      const grip = { x: side < 0 ? -1 : WF.winW + 1, y: 46 };
      hand = { x: hand.x + (grip.x - hand.x) * e, y: hand.y + (grip.y - hand.y) * e };
    }
    // the elbow hangs low and wide: the arm is longer than his legs
    const elbow = { x: sh.x + side * 15, y: Math.max(sh.y + 18, hand.y + 22) };
    limb(g, sh.x, sh.y, elbow.x, elbow.y, 3);
    ell(g, elbow.x, elbow.y, 2, 2, C.skinLit);
    limb(g, elbow.x, elbow.y, hand.x, hand.y + 4 * hs, 2);
    // the hand: a narrow palm, four long jointed fingers, pads on the glass
    ell(g, hand.x, hand.y + 2 * hs, 3 * hs, 3 * hs, C.outline);
    ell(g, hand.x, hand.y + 2 * hs, 2 * hs, 2 * hs, C.skin);
    for (let f = 0; f < 4; f++) {
      const ang = -Math.PI / 2 + (f - 1.5) * 0.34 * splay + side * 0.12;
      const len = (10 + (f === 1 || f === 2 ? 3 : 0)) * hs;
      const kx = hand.x + Math.cos(ang) * len * 0.5;
      const ky = hand.y + Math.sin(ang) * len * 0.5;
      const tx = hand.x + Math.cos(ang) * len;
      const ty = hand.y + Math.sin(ang) * len;
      line(g, hand.x, hand.y, kx, ky, 2, C.outline);
      line(g, kx, ky, tx, ty, 2, C.outline);
      line(g, hand.x, hand.y, tx, ty, 1, C.skinLit);
      r(g, kx, ky, 1, 1, C.skinHi);
      r(g, tx - 1, ty - 1, 2, 2, C.pad);
    }
    line(g, hand.x, hand.y + 2 * hs, hand.x - side * 5 * hs, hand.y - 1, 2, C.outline);
    r(g, hand.x - side * 5 * hs - 1, hand.y - 2, 2, 2, C.pad);
  };
  arm(-1);
  arm(1);

  // ---- the head: Froggy's dome, the eyes up on its corners
  const hy = 18 - o.lean * 2;
  const hr = 1 + o.lean * 0.06;
  ell(g, cx, hy, 20 * hr, 13 * hr, C.outline);
  ell(g, cx, hy, 19 * hr, 12 * hr, C.skinDark);
  ell(g, cx - 1, hy - 1, 17 * hr, 10 * hr, C.skin);
  ell(g, cx - 4, hy - 5, 10, 5, C.skinLit);
  for (let k = 0; k < 10; k++) r(g, cx - 14 + ((k * 13) % 28), hy - 7 + ((k * 7) % 12), 2, 1, k % 2 ? C.skinDark : C.skinHi, 0.7);
  // the eyes: big, bulging, the right one larger and higher; heavy lids,
  // bloodshot whites, pupils shrunk to a point
  const eye = (ex: number, ey: number, rad: number, look: number): void => {
    ell(g, ex, ey, rad + 2, rad + 2, C.outline);
    ell(g, ex, ey, rad + 1, rad + 1, C.lid);
    ell(g, ex, ey + 1, rad - 1, rad - 1, C.sclera);
    r(g, ex - rad + 2, ey + rad - 1, rad * 2 - 3, 1, '#8e2a2a');
    for (const [vx, vy] of [
      [-rad + 2, 1],
      [rad - 3, 0],
      [-1, rad - 2],
    ])
      r(g, ex + vx, ey + vy, 2, 1, C.vein);
    // the lid, down over nearly half of it
    for (let y = -rad - 1; y < -1; y++) {
      const half = Math.floor((rad + 1) * Math.sqrt(Math.max(0, 1 - (y * y) / ((rad + 1) * (rad + 1)))));
      r(g, ex - half, ey + y, half * 2 + 1, 1, C.lid);
    }
    r(g, ex - rad, ey - 1, rad * 2 + 1, 1, C.lidCrease);
    r(g, ex - rad + 2, ey - Math.round(rad * 0.6), rad * 2 - 3, 1, C.lidCrease, 0.6);
    r(g, ex + look, ey + 1, 2, 2, C.pupil);
    r(g, ex + look + 1, ey + 1, 1, 1, '#ffffff', 0.5);
  };
  const dart = Math.sin(o.t * 1.3) > 0.85 ? 1 : 0;
  eye(cx - 11, hy - 9, 6, dart);
  eye(cx + 11, hy - 10, 7, -dart);
  // the muzzle: the pale half of the face, two nostrils
  ell(g, cx, hy + 4, 15 * hr, 7 * hr, C.muzzle);
  ell(g, cx - 2, hy + 2, 10, 3, C.muzzleHi);
  r(g, cx - 4, hy, 2, 1, C.outline);
  r(g, cx + 3, hy, 2, 1, C.outline);

  // ---- the mouth: wider than the muzzle, hanging open, long teeth
  const open = Math.round(5 + o.maw * 7 + o.lean * 2);
  const my = hy + 6;
  const mw = 16;
  ell(g, cx, my + open / 2, mw + 1, open / 2 + 2, C.outline);
  ell(g, cx, my + open / 2, mw, open / 2 + 1, C.lip);
  ell(g, cx, my + open / 2, mw - 2, open / 2, C.throat);
  r(g, cx - mw + 3, my + 1, (mw - 3) * 2, 1, C.gum);
  r(g, cx - mw + 4, my + open - 1, (mw - 4) * 2, 1, C.gum);
  for (let k = 0; k < 12; k++) {
    const tx = cx - mw + 4 + k * 2.4;
    const len = 2 + ((k * 7) % 3) + (k === 2 || k === 9 ? 2 : 0);
    r(g, tx, my + 2, 1, len, C.tooth);
    r(g, tx, my + 1 + len, 1, 1, C.toothShade);
  }
  for (let k = 0; k < 10; k++) {
    const tx = cx - mw + 6 + k * 2.6;
    const len = 2 + ((k * 5) % 3);
    r(g, tx, my + open - 1 - len, 1, len, C.tooth);
  }
  r(g, cx - mw - 2, my, 3, 3, C.skinDark);
  r(g, cx + mw - 1, my, 3, 3, C.skinDark);
  // drool, and his breath on the glass
  const drop = (Math.sin(o.t * 0.9) * 0.5 + 0.5) * 5;
  r(g, cx + 5, my + open + 1, 1, 3 + drop, C.drool, 0.8);
  ell(g, cx, my + 3, 14, 5, '#d8dce0', 0.1 + Math.max(0, breathe) * 0.06);
  g.restore();
}

// ================================================================ the glass

/** Where the blows land, in window coordinates, one per hit. */
export const HITS: Array<{ x: number; y: number; side: -1 | 1 }> = [
  { x: 40, y: 48, side: -1 },
  { x: 90, y: 44, side: 1 },
  { x: 34, y: 64, side: -1 },
  { x: 94, y: 62, side: 1 },
  { x: 52, y: 36, side: -1 },
  { x: 78, y: 66, side: 1 },
  { x: 46, y: 54, side: -1 },
  { x: 84, y: 50, side: 1 },
];

const seeded = (n: number): (() => number) => {
  let s = n * 9301 + 49297;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
};

/**
 * The cracks after `hits` blows: each blow a star of jagged lines and a ring
 * round it, and every later blow drives the older cracks further across the
 * glass until they meet.  `fresh` is 0..1 into the newest one, which grows.
 */
export function drawCracks(g: Ctx, hits: number, fresh: number): void {
  g.clearRect(0, 0, WF.winW, WF.winH);
  for (let i = 0; i < Math.min(hits, HITS.length); i++) {
    const p = HITS[i];
    const R = seeded(i + 1);
    const age = hits - 1 - i;
    const grow = i === hits - 1 ? fresh : 1;
    const reach = (12 + age * 10) * grow;
    // the white bruise where it landed
    ell(g, p.x, p.y, 2 + Math.min(3, age), 2 + Math.min(2, age), '#e8f0f4', 0.5);
    ell(g, p.x, p.y, 1, 1, '#ffffff', 0.8);
    const rays = 5 + (i % 3);
    for (let k = 0; k < rays; k++) {
      let a = (k / rays) * Math.PI * 2 + R() * 0.5;
      let x = p.x;
      let y = p.y;
      const len = reach * (0.6 + R() * 0.7);
      for (let d = 0; d < len; d += 3) {
        a += (R() - 0.5) * 0.5;
        const nx = x + Math.cos(a) * 3;
        const ny = y + Math.sin(a) * 3;
        // brighter near the blow, fading out toward the tip
        g.globalAlpha = 0.85 - (d / len) * 0.55;
        g.fillStyle = '#eef4f8';
        const n = 3;
        for (let j = 0; j <= n; j++) g.fillRect(Math.round(x + ((nx - x) * j) / n), Math.round(y + ((ny - y) * j) / n), 1, 1);
        g.globalAlpha = 1;
        // a shadow beside it gives the crack an edge
        r(g, nx + 1, ny, 1, 1, '#3a4652', 0.35);
        // now and then a short branch
        if (R() < 0.18) {
          const b = a + (R() < 0.5 ? 0.9 : -0.9);
          line(g, nx, ny, nx + Math.cos(b) * 4, ny + Math.sin(b) * 4, 1, '#dfe8ee');
        }
        x = nx;
        y = ny;
        if (x < 0 || y < 0 || x > WF.winW || y > WF.winH) break;
      }
    }
    // the ring of breaks round the point
    const ring = Math.min(reach * 0.35, 6 + age * 2);
    for (let k = 0; k < 10; k++) {
      if (R() < 0.45) continue;
      const a0 = (k / 14) * Math.PI * 2;
      const a1 = a0 + 0.35;
      line(g, p.x + Math.cos(a0) * ring, p.y + Math.sin(a0) * ring, p.x + Math.cos(a1) * ring, p.y + Math.sin(a1) * ring, 1, '#dfe8ee');
    }
  }
}

/** What is left in the frame once it has gone: jagged teeth round the edge. */
export function drawBrokenEdge(g: Ctx): void {
  g.clearRect(0, 0, WF.winW, WF.winH);
  const R = seeded(99);
  const edge = (x0: number, y0: number, dx: number, dy: number, n: number, ix: number, iy: number): void => {
    for (let k = 0; k < n; k += 4) {
      const depth = 2 + Math.floor(R() * 9);
      for (let j = 0; j < depth; j++) r(g, x0 + dx * k + ix * j, y0 + dy * k + iy * j, 4 - Math.floor((j * 3) / depth), 1, '#cfdce4', 0.75);
    }
  };
  edge(0, 0, 1, 0, WF.winW, 0, 1);
  edge(0, WF.winH - 1, 1, 0, WF.winW, 0, -1);
  edge(0, 0, 0, 1, WF.winH, 1, 0);
  edge(WF.winW - 1, 0, 0, 1, WF.winH, -1, 0);
}
