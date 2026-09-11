/**
 * The ten basement images.  PRD §7.14.
 *
 * Static.  BS-5: no ambient animation anywhere in this sequence except the
 * frame-8 flicker.  Nothing moves, nothing breathes, nothing is alive on
 * screen.  That is what makes frame 5 work.
 *
 * These were flat: a rectangle for a room, a rectangle for a door, six little
 * rectangles for a chair.  Read as a diagram of a basement rather than a
 * basement, and a place the player does not believe in is a place they are not
 * afraid of.  They are now built the way a photograph of a cellar is built:
 *
 *   - One-point perspective.  Floor, ceiling and both side walls run to a
 *     vanishing point, and the floor is banded so it darkens with distance.
 *     Depth is the single biggest thing missing from a flat rectangle.
 *   - Light falls off.  Every room has one bulb; there is a pool under it, the
 *     walls are lit from that side, and the corners go to nothing.
 *   - Nothing is one flat colour.  Concrete is speckled with a deterministic
 *     grain (the same grain every time — a crawling one would break BS-5),
 *     walls carry damp, and edges get a one-pixel lift where the light hits.
 *   - Things cast shadows, and the shadow says where the light is.
 *
 * Still the same palette (AR-3): everything here is a PALETTE colour, dimmed
 * or alpha'd.  No new values.
 */

import Phaser from 'phaser';
import { PALETTE, dim } from '../render/palette';
import { GAME_W, GAME_H } from '../render/pixelScaler';

const DARK = 0x05070a;
/** Where every corridor and room runs to. */
const VP = { x: GAME_W / 2, y: 86 };

type Pt = { x: number; y: number };

/**
 * Deterministic per-index noise.  The grain has to be identical on every
 * repaint: a room that sparkles when it crossfades is a room that moves, and
 * nothing in this sequence moves.
 */
function rnd(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Concrete.  Speckle, a few darker pits, and a slow vertical falloff. */
function grain(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  count: number,
  color: number,
  alpha: number,
): void {
  for (let i = 0; i < count; i++) {
    const px = Math.floor(x + rnd(seed + i * 2) * w);
    const py = Math.floor(y + rnd(seed + i * 2 + 1) * h);
    const s = rnd(seed + i * 7) > 0.86 ? 2 : 1;
    g.fillStyle(color, alpha * (0.4 + rnd(seed + i * 13) * 0.6));
    g.fillRect(px, py, s, s);
  }
}

/** Dark in the corners.  Cheap, and it does most of the work of a lens. */
function vignette(g: Phaser.GameObjects.Graphics): void {
  for (let i = 0; i < 26; i++) {
    const a = 0.055 - i * 0.002;
    if (a <= 0) break;
    g.lineStyle(1, PALETTE.black, a);
    g.strokeRect(i, i, GAME_W - i * 2, GAME_H - i * 2);
  }
}

function quad(g: Phaser.GameObjects.Graphics, pts: Pt[], color: number, alpha: number): void {
  g.fillStyle(color, alpha);
  g.fillPoints(pts, true);
}

/**
 * A room in one-point perspective, lit from a bulb at `lightX`.
 *
 * `back` is the far wall in screen space; everything else is derived from it
 * and the frame edges, so the floor and both walls actually converge.
 */
function paintShell(
  g: Phaser.GameObjects.Graphics,
  back: { x: number; y: number; w: number; h: number },
  seed: number,
  lightX = GAME_W / 2,
): void {
  const bl = { x: back.x, y: back.y + back.h };
  const br = { x: back.x + back.w, y: back.y + back.h };
  const tl = { x: back.x, y: back.y };
  const tr = { x: back.x + back.w, y: back.y };

  g.fillStyle(DARK, 1);
  g.fillRect(0, 0, GAME_W, GAME_H);

  // ---- floor, banded so it darkens with distance.  This is the depth cue.
  const bands = 9;
  for (let i = 0; i < bands; i++) {
    const t0 = i / bands;
    const t1 = (i + 1) / bands;
    const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const nearL = lerp({ x: -20, y: GAME_H }, bl, t0);
    const nearR = lerp({ x: GAME_W + 20, y: GAME_H }, br, t0);
    const farL = lerp({ x: -20, y: GAME_H }, bl, t1);
    const farR = lerp({ x: GAME_W + 20, y: GAME_H }, br, t1);
    // Nearest band is the brightest: the bulb is over the player, not the wall.
    quad(g, [nearL, nearR, farR, farL], PALETTE.slate, 0.2 - t0 * 0.15);
  }
  grain(g, 0, back.y + back.h - 6, GAME_W, GAME_H - back.y - back.h + 6, seed, 180, PALETTE.steel, 0.12);

  // ---- ceiling.  Barely lit; it exists to close the box in.
  quad(g, [{ x: -20, y: -10 }, { x: GAME_W + 20, y: -10 }, tr, tl], PALETTE.ink, 0.85);

  // ---- side walls, the lit one a shade up from the other
  const leftLit = lightX < GAME_W / 2;
  quad(g, [{ x: -20, y: -10 }, tl, bl, { x: -20, y: GAME_H + 10 }], PALETTE.slate, leftLit ? 0.16 : 0.1);
  quad(g, [{ x: GAME_W + 20, y: -10 }, tr, br, { x: GAME_W + 20, y: GAME_H + 10 }], PALETTE.slate, leftLit ? 0.1 : 0.16);
  grain(g, 0, 0, 60, GAME_H, seed + 500, 90, PALETTE.steel, 0.1);
  grain(g, GAME_W - 60, 0, 60, GAME_H, seed + 900, 90, PALETTE.steel, 0.1);

  // ---- back wall, with damp running down it
  g.fillStyle(PALETTE.slate, 0.13);
  g.fillRect(back.x, back.y, back.w, back.h);
  for (let i = 0; i < 5; i++) {
    const dx = back.x + 6 + rnd(seed + i * 31) * (back.w - 12);
    const dh = back.h * (0.3 + rnd(seed + i * 17) * 0.6);
    g.fillStyle(PALETTE.ink, 0.3);
    g.fillRect(Math.floor(dx), back.y, 1 + Math.floor(rnd(seed + i) * 3), Math.floor(dh));
  }
  grain(g, back.x, back.y, back.w, back.h, seed + 1300, 110, PALETTE.steel, 0.11);

  // ---- the corner seams, one pixel of lift where two planes meet
  g.lineStyle(1, PALETTE.steel, 0.22);
  g.beginPath();
  g.moveTo(-20, GAME_H);
  g.lineTo(bl.x, bl.y);
  g.moveTo(GAME_W + 20, GAME_H);
  g.lineTo(br.x, br.y);
  g.moveTo(-20, -10);
  g.lineTo(tl.x, tl.y);
  g.moveTo(GAME_W + 20, -10);
  g.lineTo(tr.x, tr.y);
  g.strokePath();
  g.lineStyle(1, PALETTE.ink, 0.9);
  g.strokeRect(back.x, back.y, back.w, back.h);
}

/**
 * The room, for callers outside this file.  BasementSequence paints the last
 * frame itself because half of it is tweened, and it should still stand in a
 * room rather than in front of a black rectangle.
 */
export function paintRoomShell(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  back: { x: number; y: number; w: number; h: number },
  seed: number,
  lightX = GAME_W / 2,
): void {
  const g = scene.add.graphics();
  paintShell(g, back, seed, lightX);
  vignette(g);
  c.add(g);
}

/** The pool a bare bulb throws on the floor, and the bulb itself. */
function bulbLight(g: Phaser.GameObjects.Graphics, x: number, y: number, floorY: number, reach = 60): void {
  // cord
  g.lineStyle(1, PALETTE.steel, 0.55);
  g.beginPath();
  g.moveTo(x, 0);
  g.lineTo(x, y - 3);
  g.strokePath();

  // the halo, stacked rings so it falls off instead of being a flat disc
  for (let i = 6; i >= 1; i--) {
    g.fillStyle(PALETTE.cream, 0.02 + (6 - i) * 0.012);
    g.fillCircle(x, y, i * 4);
  }
  g.fillStyle(PALETTE.gold, 0.85);
  g.fillCircle(x, y, 2.5);
  g.fillStyle(PALETTE.cream, 0.9);
  g.fillCircle(x, y - 1, 1);

  // the pool on the floor, an ellipse because the floor is not facing us
  for (let i = 5; i >= 1; i--) {
    const t = i / 5;
    g.fillStyle(PALETTE.cream, 0.035 * (1 - t) + 0.012);
    g.fillEllipse(x, floorY, reach * 2 * t, reach * 0.42 * t);
  }
}

/** A receding corridor.  `depth` stretches it without changing the tiles. */
export function paintCorridor(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  depth = 1,
  pipes = true,
): void {
  const g = scene.add.graphics();

  // The far end is simply dark: there is no back wall drawn, ever.  The
  // "back wall" here is a small dark hole at the vanishing point.
  const holeW = 34 / depth;
  const holeH = 30 / depth;
  paintShell(
    g,
    { x: VP.x - holeW / 2, y: VP.y - holeH * 0.55, w: holeW, h: holeH },
    Math.round(depth * 1000),
  );
  g.fillStyle(DARK, 1);
  g.fillRect(VP.x - holeW / 2, VP.y - holeH * 0.55, holeW, holeH);

  // ---- ceiling bulbs going away from you, dimmer and closer together
  const lamps = 3;
  for (let i = 0; i < lamps; i++) {
    const t = Math.pow((i + 1) / (lamps + 1), 1 + 0.3 * (depth - 1));
    const y = VP.y - 34 + t * 30;
    const floorY = GAME_H - t * (GAME_H - VP.y - 20);
    const reach = 58 * (1 - t) + 10;
    g.fillStyle(PALETTE.cream, 0.05 * (1 - t) + 0.01);
    g.fillEllipse(VP.x, floorY, reach * 1.8, reach * 0.5);
    g.fillStyle(PALETTE.gold, 0.5 * (1 - t) + 0.15);
    g.fillCircle(VP.x, y, 1.6 * (1 - t) + 0.6);
  }

  // ---- ribs down both walls, converging.  These are what sell the length.
  const ribs = 6;
  for (let i = 0; i < ribs; i++) {
    const t = Math.pow((i + 1) / (ribs + 1), 1 + 0.35 * (depth - 1));
    const y0 = -10 + t * (VP.y - 10 + 10);
    const y1 = GAME_H + 10 - t * (GAME_H + 10 - (VP.y + 14));
    const xl = -20 + t * (VP.x - holeW / 2 + 20);
    const xr = GAME_W + 20 - t * (GAME_W + 20 - (VP.x + holeW / 2));
    g.lineStyle(1, PALETTE.ink, 0.55 - t * 0.2);
    g.beginPath();
    g.moveTo(xl, y0);
    g.lineTo(xl, y1);
    g.moveTo(xr, y0);
    g.lineTo(xr, y1);
    g.strokePath();
    g.lineStyle(1, PALETTE.steel, 0.12);
    g.beginPath();
    g.moveTo(xl + 1, y0);
    g.lineTo(xl + 1, y1);
    g.moveTo(xr - 1, y0);
    g.lineTo(xr - 1, y1);
    g.strokePath();
  }

  if (pipes) {
    // Two runs of pipe along the ceiling, going to the same point everything
    // else does, with brackets where they pass a rib.
    for (const [off, alpha] of [
      [-13, 0.4],
      [-6, 0.32],
    ] as const) {
      g.lineStyle(2, PALETTE.steel, alpha);
      g.beginPath();
      g.moveTo(0, VP.y - 52 + off);
      g.lineTo(VP.x - holeW / 2, VP.y - holeH * 0.5);
      g.moveTo(GAME_W, VP.y - 52 + off);
      g.lineTo(VP.x + holeW / 2, VP.y - holeH * 0.5);
      g.strokePath();
      g.lineStyle(1, PALETTE.ink, alpha);
      g.beginPath();
      g.moveTo(0, VP.y - 51 + off);
      g.lineTo(VP.x - holeW / 2, VP.y - holeH * 0.5 + 1);
      g.moveTo(GAME_W, VP.y - 51 + off);
      g.lineTo(VP.x + holeW / 2, VP.y - holeH * 0.5 + 1);
      g.strokePath();
    }
  }

  vignette(g);
  container.add(g);
}

/**
 * Frame 1: concrete stairs going DOWN, and the whole frame has to say so.
 *
 * A flight of steps drawn flat is ambiguous — the same shape reads as going up
 * or down depending on nothing at all, and this one was reading as up.  Four
 * things fix which way it goes, and all four have to agree:
 *
 *   1. You are ABOVE it.  The top step is directly under the camera, running
 *      off the bottom of the frame, wide enough that you are standing on it.
 *      A flight you can see the bottom of is a flight you are looking up.
 *   2. The treads narrow and CROWD as they fall away — the gap between step
 *      edges shrinks with distance, which is the perspective a person gets
 *      looking down their own stairs.
 *   3. You see the tops of the treads and NOTHING ELSE.  This is the one that
 *      decides it: the front face of a riser is only visible from BELOW, so a
 *      staircase drawn with a row of riser faces reads as going up no matter
 *      what else is in the picture.  Looking down, each step is a flat you
 *      could put your foot on, and the step below it is hidden under its own
 *      nose — so between one tread and the next there is a seam, not a wall.
 *   4. It ends in black, and the light is over your shoulder, throwing your own
 *      shadow down the steps ahead of you.
 */
export function paintStairs(scene: Phaser.Scene, c: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  g.fillStyle(DARK, 1);
  g.fillRect(0, 0, GAME_W, GAME_H);

  // The stairwell walls, converging DOWN towards the dark at the far end.
  const vpX = GAME_W / 2;
  const vpY = 74; // the bottom of the flight, up-screen because it is far away
  quad(
    g,
    [{ x: -10, y: GAME_H + 10 }, { x: 104, y: vpY }, { x: 104, y: -10 }, { x: -10, y: -10 }],
    PALETTE.slate,
    0.14,
  );
  quad(
    g,
    [{ x: GAME_W + 10, y: GAME_H + 10 }, { x: GAME_W - 104, y: vpY }, { x: GAME_W - 104, y: -10 }, { x: GAME_W + 10, y: -10 }],
    PALETTE.slate,
    0.09,
  );
  grain(g, 0, 0, 112, GAME_H, 77, 140, PALETTE.steel, 0.1);
  grain(g, GAME_W - 112, 0, 112, GAME_H, 91, 140, PALETTE.steel, 0.08);

  // ---- the flight.  Step 0 is the one under your feet, at the bottom of the
  // frame and as wide as the stairwell; each next one is further down and
  // further away, so it is narrower AND closer to the one before it.
  const steps = 11;
  const edge = (i: number) => {
    // Distance falls off geometrically: that is what makes the treads crowd.
    const t = 1 - Math.pow(1 - i / steps, 1.7);
    return {
      y: GAME_H + 6 - t * (GAME_H + 6 - vpY),
      w: 168 - t * 118,
      shade: 0.4 - t * 0.34,
    };
  };

  for (let i = 0; i < steps; i++) {
    const near = edge(i);
    const far = edge(i + 1);

    // The tread, filling the whole gap between this step's nose and the next
    // one's.  No riser face: from up here the step below is tucked away under
    // its own nose and all you can see is the flat.
    quad(
      g,
      [
        { x: GAME_W / 2 - near.w / 2, y: near.y },
        { x: GAME_W / 2 + near.w / 2, y: near.y },
        { x: GAME_W / 2 + far.w / 2, y: far.y },
        { x: GAME_W / 2 - far.w / 2, y: far.y },
      ],
      PALETTE.slate,
      near.shade,
    );
    // The seam where it drops away to the next one: a dark line, thinning with
    // distance, and a lit nose on top of it.  A line reads as an edge you are
    // looking over; a filled band reads as a wall you are looking at.
    g.lineStyle(1, PALETTE.black, 0.55);
    g.beginPath();
    g.moveTo(GAME_W / 2 - far.w / 2, far.y + 1);
    g.lineTo(GAME_W / 2 + far.w / 2, far.y + 1);
    g.strokePath();
    g.lineStyle(1, PALETTE.fog, Math.max(0.04, 0.26 - i * 0.024));
    g.beginPath();
    g.moveTo(GAME_W / 2 - far.w / 2, far.y);
    g.lineTo(GAME_W / 2 + far.w / 2, far.y);
    g.strokePath();
  }
  grain(g, 76, vpY, 168, GAME_H - vpY, 41, 150, PALETTE.bone, 0.05);

  // ---- a handrail down the left wall, dropping with the steps.  A rail that
  // descends is the single clearest statement a staircase can make.
  g.lineStyle(2, PALETTE.brownLight, 0.3);
  g.beginPath();
  g.moveTo(58, GAME_H - 6);
  g.lineTo(vpX - 34, vpY + 6);
  g.strokePath();
  g.lineStyle(1, PALETTE.ink, 0.5);
  g.beginPath();
  g.moveTo(58, GAME_H - 3);
  g.lineTo(vpX - 34, vpY + 8);
  g.strokePath();
  for (let i = 0; i < 4; i++) {
    const t = i / 4;
    const x = 58 + (vpX - 34 - 58) * t;
    const y = GAME_H - 6 + (vpY + 6 - (GAME_H - 6)) * t;
    g.lineStyle(1, PALETTE.brown, 0.28);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 4, y + 16 * (1 - t));
    g.strokePath();
  }

  // ---- the dark the flight goes into.  No back wall: it just stops existing.
  g.fillStyle(DARK, 1);
  g.fillEllipse(vpX, vpY + 2, 62, 20);
  g.fillStyle(PALETTE.black, 0.6);
  g.fillEllipse(vpX, vpY + 6, 44, 12);

  // ---- the doorway you came through: behind and above, off the top of frame.
  g.fillStyle(PALETTE.cream, 0.06);
  g.fillEllipse(GAME_W / 2, GAME_H + 10, 300, 130);
  g.fillStyle(PALETTE.cream, 0.05);
  g.fillRect(GAME_W / 2 - 46, GAME_H - 18, 92, 18);

  // ---- and your own shadow, thrown from it, down the steps in front of you.
  quad(
    g,
    [
      { x: GAME_W / 2 - 26, y: GAME_H },
      { x: GAME_W / 2 + 26, y: GAME_H },
      { x: GAME_W / 2 + 13, y: 118 },
      { x: GAME_W / 2 - 13, y: 118 },
    ],
    PALETTE.black,
    0.42,
  );
  // the head of it, a few steps down
  g.fillStyle(PALETTE.black, 0.4);
  g.fillEllipse(GAME_W / 2, 116, 22, 9);

  vignette(g);
  c.add(g);
}

/**
 * A wooden chair, seen from behind, standing on the floor.
 *
 * Drawn in the same perspective as the room: the back legs are shorter on
 * screen and closer together than the front pair, the seat is a foreshortened
 * quad rather than a bar, and the whole thing casts a shadow away from the
 * bulb.  Those three things are the entire difference between furniture and
 * six rectangles.
 */
function paintChair(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  groundY: number,
  lightX: number,
  scale = 1,
): void {
  const wood = PALETTE.brown;
  const woodLit = PALETTE.brownLight;
  const woodDark = dim(PALETTE.brown, 0.55);

  // Seat corners: front edge wider and lower than the back edge.
  const fw = 30 * scale; // front width
  const bw = 24 * scale;
  const seatFrontY = groundY - 20 * scale;
  const seatBackY = groundY - 26 * scale;
  const fl = { x: cx - fw / 2, y: seatFrontY };
  const fr = { x: cx + fw / 2, y: seatFrontY };
  const brr = { x: cx + bw / 2, y: seatBackY };
  const bll = { x: cx - bw / 2, y: seatBackY };

  // ---- cast shadow first, thrown away from the bulb and pooling under the seat
  const away = Math.sign(cx - lightX) || 1;
  g.fillStyle(PALETTE.black, 0.5);
  g.fillEllipse(cx + away * 5, groundY + 2, 44, 11);
  quad(
    g,
    [
      { x: fl.x - 2, y: groundY + 1 },
      { x: fr.x + 2, y: groundY + 1 },
      { x: fr.x + away * 26, y: groundY + 8 },
      { x: fl.x + away * 26, y: groundY + 8 },
    ],
    PALETTE.black,
    0.34,
  );

  // ---- back legs (further away: shorter, thinner, darker)
  for (const x of [bll.x + 2, brr.x - 3]) {
    g.fillStyle(woodDark, 1);
    g.fillRect(Math.round(x), seatBackY, 2, groundY - 6 - seatBackY);
  }

  // ---- the back: two stiles rising off the back corners, rails between them
  const backTop = seatBackY - 34 * scale;
  g.fillStyle(wood, 1);
  g.fillRect(Math.round(bll.x + 1), backTop, 3, seatBackY - backTop);
  g.fillRect(Math.round(brr.x - 4), backTop, 3, seatBackY - backTop);
  // top rail, with the light catching its upper edge
  g.fillStyle(wood, 1);
  g.fillRect(Math.round(bll.x + 1), backTop, Math.round(bw - 2), 5);
  g.fillStyle(woodLit, 0.75);
  g.fillRect(Math.round(bll.x + 1), backTop, Math.round(bw - 2), 1);
  g.fillStyle(woodDark, 0.8);
  g.fillRect(Math.round(bll.x + 1), backTop + 4, Math.round(bw - 2), 1);
  // two slats
  for (const y of [backTop + 11, backTop + 20]) {
    g.fillStyle(wood, 0.9);
    g.fillRect(Math.round(bll.x + 2), y, Math.round(bw - 4), 3);
    g.fillStyle(woodDark, 0.7);
    g.fillRect(Math.round(bll.x + 2), y + 2, Math.round(bw - 4), 1);
  }

  // ---- the seat itself: top face, then the front edge under it
  quad(g, [fl, fr, brr, bll], wood, 1);
  g.fillStyle(woodLit, 0.5);
  g.fillPoints([fl, fr, { x: fr.x - 2, y: fr.y - 2 }, { x: fl.x + 2, y: fl.y - 2 }], true);
  g.fillStyle(woodDark, 1);
  g.fillRect(fl.x, seatFrontY, fw, 3);
  g.fillStyle(PALETTE.black, 0.35);
  g.fillRect(fl.x, seatFrontY + 3, fw, 1);

  // ---- front legs (nearer: taller on screen, thicker, and lit down one side)
  for (const x of [fl.x + 1, fr.x - 4]) {
    g.fillStyle(wood, 1);
    g.fillRect(Math.round(x), seatFrontY + 2, 3, groundY - seatFrontY - 2);
    g.fillStyle(woodLit, 0.35);
    g.fillRect(Math.round(x) + (lightX < cx ? 0 : 2), seatFrontY + 2, 1, groundY - seatFrontY - 2);
  }
  // stretcher between the front legs, low down
  g.fillStyle(woodDark, 0.9);
  g.fillRect(Math.round(fl.x + 2), groundY - 7, Math.round(fw - 5), 2);
}

/** Frame 4: one wooden chair, facing away.  Never explained. */
export function paintChairRoom(scene: Phaser.Scene, c: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  const back = { x: 92, y: 52, w: 136, h: 62 };
  // The bulb is well to the left, which is what gives the chair a shadow to
  // throw across the floor instead of a puddle under it.
  const lightX = 104;

  paintShell(g, back, 2200, lightX);
  bulbLight(g, lightX, 42, 148, 72);

  // ---- door on the far wall, set into the concrete
  const dw = 30;
  const dh = 50;
  const dx = GAME_W / 2 + 12;
  const dy = back.y + back.h - dh;
  g.fillStyle(PALETTE.ink, 0.9);
  g.fillRect(dx - 2, dy - 2, dw + 4, dh + 2); // frame
  g.fillStyle(dim(PALETTE.brown, 0.7), 1);
  g.fillRect(dx, dy, dw, dh);
  // two recessed panels
  for (const py of [dy + 4, dy + 27]) {
    g.fillStyle(dim(PALETTE.brown, 0.5), 1);
    g.fillRect(dx + 4, py, dw - 8, 19);
    g.lineStyle(1, PALETTE.black, 0.4);
    g.strokeRect(dx + 4, py, dw - 8, 19);
    g.lineStyle(1, PALETTE.brownLight, 0.18);
    g.beginPath();
    g.moveTo(dx + 4, py + 19);
    g.lineTo(dx + dw - 4, py + 19);
    g.strokePath();
  }
  // hinges on the far side, handle on the near side
  g.fillStyle(PALETTE.steel, 0.5);
  g.fillRect(dx + dw - 3, dy + 8, 3, 4);
  g.fillRect(dx + dw - 3, dy + dh - 14, 3, 4);
  g.fillStyle(PALETTE.gold, 0.55);
  g.fillCircle(dx + 5, dy + dh / 2, 1.5);
  // the light that is on in whatever is behind it
  g.fillStyle(PALETTE.cream, 0.09);
  g.fillRect(dx, dy + dh - 1, dw, 1);

  // ---- the chair.  It is the subject of the frame, so it stands in the light
  // and clear of the door rather than in front of it.
  paintChair(g, 138, 146, lightX, 1.35);

  vignette(g);
  c.add(g);
}

/**
 * Frame 5.  PRD H2 / FMEA #7.
 *
 * A frog-like shape with a single visible eye, far down the corridor.  About 12
 * logical pixels tall, drawn a hair above the background value and never lit,
 * never animated.  Most players will not be sure they saw anything, and the
 * game never acknowledges it — not here, not in frame 6, not ever.
 *
 * Do not brighten this.  Do not add a glow.  Do not make it move.
 */
export function paintFarFigure(scene: Phaser.Scene, c: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  const x = GAME_W / 2 + 3;
  const y = 94;

  // barely above the background: a fixed, small delta in palette space
  g.fillStyle(0x121a20, 1);
  g.fillRoundedRect(x - 5, y - 7, 10, 11, 3);
  g.fillCircle(x - 3, y - 8, 2.4);
  g.fillCircle(x + 3, y - 8, 2.4);

  // one eye catches something.  Only one.
  g.fillStyle(0x1c2630, 1);
  g.fillCircle(x + 3, y - 8, 1.1);

  c.add(g);
}

/** Frames 6 / 4: a plain door at the end of a corridor. */
export function paintPlainDoor(scene: Phaser.Scene, c: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  const w = 44;
  const h = 78;
  const x = GAME_W / 2 - w / 2;
  const y = 56;

  // The wall it is set into, so it is not a door floating in a corridor.
  g.fillStyle(PALETTE.slate, 0.1);
  g.fillRect(x - 16, y - 8, w + 32, h + 10);
  grain(g, x - 16, y - 8, w + 32, h + 10, 640, 60, PALETTE.steel, 0.1);
  g.fillStyle(PALETTE.ink, 0.95);
  g.fillRect(x - 3, y - 3, w + 6, h + 3);

  g.fillStyle(dim(PALETTE.brown, 0.75), 1);
  g.fillRect(x, y, w, h);
  // grain in the wood, vertical
  for (let i = 0; i < 14; i++) {
    const gx = x + 2 + Math.floor(rnd(700 + i) * (w - 4));
    g.fillStyle(dim(PALETTE.brown, 0.55), 0.5);
    g.fillRect(gx, y + 2, 1, h - 4);
  }
  // panels
  for (const py of [y + 6, y + 43]) {
    g.fillStyle(dim(PALETTE.brown, 0.55), 1);
    g.fillRect(x + 6, py, w - 12, 30);
    g.lineStyle(1, PALETTE.black, 0.45);
    g.strokeRect(x + 6, py, w - 12, 30);
    g.lineStyle(1, PALETTE.brownLight, 0.16);
    g.beginPath();
    g.moveTo(x + 6, py + 30);
    g.lineTo(x + w - 6, py + 30);
    g.strokePath();
  }
  // handle, hinges, and the gap at the bottom
  g.fillStyle(PALETTE.gold, 0.6);
  g.fillCircle(x + w - 8, y + h / 2, 2);
  g.fillStyle(PALETTE.amberDark, 0.5);
  g.fillRect(x + w - 10, y + h / 2 + 1, 5, 1);
  g.fillStyle(PALETTE.steel, 0.45);
  g.fillRect(x, y + 12, 3, 5);
  g.fillRect(x, y + h - 18, 3, 5);
  g.fillStyle(PALETTE.black, 0.6);
  g.fillRect(x, y + h - 2, w, 2);

  vignette(g);
  c.add(g);
}

/**
 * Frame 7: a dim bulb, a key hanging from it, and the door behind them both.
 *
 * The door is the whole point of the composition.  It is directly behind the
 * key, in the same light, so the moment the key is in your hand you have
 * already been looking at the way on for a full minute — and when the thing
 * behind you makes you turn round and then lets you turn back, there is
 * exactly one thing in the frame to walk towards.
 */
export function paintKeyRoom(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
): { bulb: Phaser.GameObjects.Arc; key: Phaser.GameObjects.Container; glow: Phaser.GameObjects.Arc } {
  const g = scene.add.graphics();
  const back = { x: 96, y: 50, w: 128, h: 64 };
  paintShell(g, back, 3100, GAME_W / 2);

  // ---- the door in the back wall, dead centre, under the bulb.  Heavier than
  // the ones behind you: steel-braced, and the only thing in the room that is
  // not concrete.
  const dw = 40;
  const dh = 58;
  const dx = GAME_W / 2 - dw / 2;
  const dy = back.y + back.h - dh;
  g.fillStyle(PALETTE.ink, 0.95);
  g.fillRect(dx - 3, dy - 3, dw + 6, dh + 3);
  g.fillStyle(dim(PALETTE.brown, 0.8), 1);
  g.fillRect(dx, dy, dw, dh);
  for (const by of [dy + 9, dy + 30, dy + 48]) {
    g.fillStyle(PALETTE.steel, 0.4);
    g.fillRect(dx + 2, by, dw - 4, 3);
    g.fillStyle(PALETTE.ink, 0.5);
    g.fillRect(dx + 2, by + 3, dw - 4, 1);
  }
  // the lock it takes, at hand height, catching the bulb
  g.fillStyle(PALETTE.steel, 0.75);
  g.fillRect(dx + dw - 11, dy + dh / 2 - 4, 8, 9);
  g.fillStyle(PALETTE.gold, 0.85);
  g.fillCircle(dx + dw - 7, dy + dh / 2, 1.6);
  // and the light under it, so it reads as somewhere rather than as a panel
  g.fillStyle(PALETTE.cream, 0.1);
  g.fillRect(dx, dy + dh - 1, dw, 1);
  g.fillStyle(PALETTE.cream, 0.05);
  g.fillEllipse(GAME_W / 2, dy + dh + 6, dw + 16, 10);

  // the cord, all the way to the ceiling
  g.lineStyle(1, PALETTE.steel, 0.6);
  g.beginPath();
  g.moveTo(GAME_W / 2, 0);
  g.lineTo(GAME_W / 2, 74);
  g.strokePath();

  // the pool it throws, and the shadow the key casts inside it
  for (let i = 5; i >= 1; i--) {
    const t = i / 5;
    g.fillStyle(PALETTE.cream, 0.03 * (1 - t) + 0.012);
    g.fillEllipse(GAME_W / 2, 142, 150 * t, 38 * t);
  }
  g.fillStyle(PALETTE.black, 0.35);
  g.fillEllipse(GAME_W / 2 + 3, 142, 12, 4);

  vignette(g);
  c.add(g);

  const glow = scene.add.circle(GAME_W / 2, 78, 30, PALETTE.cream, 0.06);
  const bulb = scene.add.circle(GAME_W / 2, 78, 4, PALETTE.gold, 0.85);

  // A real key: a bow, a shaft, and two bits, lit down one side.
  const ring = scene.add.circle(0, -4, 3).setStrokeStyle(1, PALETTE.bone);
  const shaft = scene.add.rectangle(0, 3, 2, 10, PALETTE.bone);
  const edge = scene.add.rectangle(-1, 3, 1, 10, PALETTE.white).setAlpha(0.5);
  const bit = scene.add.rectangle(2, 6, 4, 2, PALETTE.bone);
  const bit2 = scene.add.rectangle(2, 3, 3, 1, PALETTE.bone);
  const key = scene.add.container(GAME_W / 2, 94, [ring, shaft, edge, bit, bit2]);

  c.add([glow, bulb, key]);
  return { bulb, key, glow };
}

/** Frame 9: the reverse angle.  There is nothing there. */
export function paintReverse(scene: Phaser.Scene, c: Phaser.GameObjects.Container): void {
  const g = scene.add.graphics();
  const back = { x: 88, y: 48, w: 144, h: 68 };
  paintShell(g, back, 4400, GAME_W / 2);

  // just the door you came through, shut, with nothing near it
  const w = 38;
  const h = 58;
  const x = GAME_W / 2 - w / 2;
  const y = back.y + back.h - h;
  g.fillStyle(PALETTE.ink, 0.95);
  g.fillRect(x - 2, y - 2, w + 4, h + 2);
  g.fillStyle(dim(PALETTE.brown, 0.55), 1);
  g.fillRect(x, y, w, h);
  for (const py of [y + 5, y + 32]) {
    g.fillStyle(dim(PALETTE.brown, 0.4), 1);
    g.fillRect(x + 5, py, w - 10, 21);
    g.lineStyle(1, PALETTE.black, 0.4);
    g.strokeRect(x + 5, py, w - 10, 21);
  }
  g.fillStyle(PALETTE.gold, 0.35);
  g.fillCircle(x + w - 7, y + h / 2, 1.5);
  g.fillStyle(PALETTE.black, 0.55);
  g.fillRect(x, y + h - 2, w, 2);

  vignette(g);
  c.add(g);
}
