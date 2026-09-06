/**
 * Froggy.  PRD §8 / QFD C6 — rank #1, 8.9% of the entire matrix.
 *
 * He is drawn here as resolution-independent vector paths, on the unfiltered
 * overlay canvas, in logical 320x180 coordinates.  Everything else in this game
 * is a 16- or 32-pixel sprite pushed through a NEAREST filter.  He is not.
 *
 * The player is never told why he looks wrong (FR-5).
 *
 * Three variants (PRD §8.2):
 *   V0 cozy     — the reference image, unmodified
 *   V1 uncanny  — IDENTICAL ART.  Only the animation stops and the pupils
 *                 shrink to the reference image's fourth pose.  If V1 is
 *                 distinguishable from V0 in a still frame, the foreshadowing
 *                 has leaked and it is a defect.  (FR-7, FMEA #1, RPN 240.)
 *   V2 predator — every friendly feature kept and pushed one step too far.
 *                 Same green, same yellow belly, same pink tongue.  Recognition
 *                 is the source of the fear; a new creature would not be scary.
 */

export type FroggyVariant = 'cozy' | 'uncanny' | 'predator';
export type FroggyPose = 'idleA' | 'idleB' | 'talk' | 'blank';

export interface FroggyDrawOpts {
  x: number;
  y: number;
  /** Height in logical pixels, base of feet to top of eye bumps. */
  height: number;
  variant?: FroggyVariant;
  pose?: FroggyPose;
  /** 0..1, drives the bouncy idle.  Ignored by uncanny and predator. */
  bounce?: number;
  /** Predator only: 0..1 mouth openness. */
  maw?: number;
  alpha?: number;
}

/** PRD §11.3 — the cozy palette, taken from the reference image. */
const COZY = {
  body: '#3FE39B',
  shadow: '#12B26B',
  belly: '#FCDC3C',
  bellyRim: '#F5C46B',
  eyeRing: '#F5C46B',
  pupil: '#111111',
  mouth: '#E01B1B',
  tongue: '#F55BB0',
};

/** PRD §11.4 — the same features, each pushed one step too far. */
const PREDATOR = {
  body: '#2A7D5C',
  bodyDark: '#17402F',
  shadow: '#0B2018',
  sheen: 'rgba(190,255,225,0.35)',
  belly: '#C9A62E',
  bellyRim: '#8E6F18',
  eyeRing: '#F2E9D0',
  eyeVein: '#B4433F',
  pupil: '#000000',
  mouth: '#8E0F16',
  mouthDeep: '#3A0308',
  tongue: '#F55BB0',
  tongueWet: '#FFA8D8',
};

/** Local design space: x -60..60, y -62..52.  Scaled to `height` at draw time. */
const DESIGN_H = 114;

export function drawFroggy(ctx: CanvasRenderingContext2D, o: FroggyDrawOpts): void {
  const variant = o.variant ?? 'cozy';
  const pose = o.pose ?? 'idleA';
  const s = o.height / DESIGN_H;

  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(o.x, o.y);
  ctx.scale(s, s);

  if (variant === 'predator') {
    drawPredator(ctx, o.maw ?? 1);
  } else {
    // V0 and V1 share this code path exactly.  The ONLY difference is the pose
    // the caller passes and whether it animates.  That is the whole trick.
    drawCozy(ctx, pose, variant === 'uncanny' ? 0 : (o.bounce ?? 0));
  }

  ctx.restore();
}

// ---------------------------------------------------------------- cozy (V0/V1)

function drawCozy(ctx: CanvasRenderingContext2D, pose: FroggyPose, bounce: number): void {
  // The idle squash: he breathes.  Uncanny passes bounce = 0, so he does not.
  const squash = 1 + Math.sin(bounce * Math.PI * 2) * 0.03;
  const lift = Math.sin(bounce * Math.PI * 2) * 2;
  ctx.translate(0, lift);
  ctx.scale(1 / squash, squash);

  const armShift = pose === 'idleB' ? 5 : 0;

  // ---- hard-edged cartoon drop shadow, offset down-right (reference image)
  ctx.save();
  ctx.translate(5, 5);
  ctx.fillStyle = COZY.shadow;
  bodyPath(ctx);
  ctx.fill();
  limbPaths(ctx, armShift);
  ctx.fill();
  ctx.restore();

  // ---- limbs behind the body
  ctx.fillStyle = COZY.body;
  limbPaths(ctx, armShift);
  ctx.fill();

  // ---- body + head, one fused shape
  ctx.fillStyle = COZY.body;
  bodyPath(ctx);
  ctx.fill();

  // ---- belly: a big disc covering the lower two thirds
  ctx.save();
  bodyPath(ctx);
  ctx.clip(); // the belly never spills past the silhouette
  ctx.beginPath();
  ctx.arc(0, 14, 40, 0, Math.PI * 2);
  ctx.fillStyle = COZY.belly;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = COZY.bellyRim;
  ctx.stroke();
  ctx.restore();

  // ---- mouth (talking pose only)
  if (pose === 'talk') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 2, 27, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = COZY.mouth;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 9, 18, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = COZY.tongue;
    ctx.fill();
    ctx.restore();
  }

  // ---- eyes
  const blank = pose === 'blank';
  for (const sx of [-1, 1]) {
    const ex = sx * 26;
    const ey = -38;

    // eye bump (part of the head silhouette)
    ctx.beginPath();
    ctx.arc(ex, ey, 18, 0, Math.PI * 2);
    ctx.fillStyle = COZY.body;
    ctx.fill();

    // peach ring
    ctx.beginPath();
    ctx.arc(ex, ey, 13.5, 0, Math.PI * 2);
    ctx.fillStyle = COZY.eyeRing;
    ctx.fill();

    // pupil: big and friendly, or the fourth pose's pinprick
    ctx.beginPath();
    ctx.arc(ex, ey, blank ? 2 : 10, 0, Math.PI * 2);
    ctx.fillStyle = COZY.pupil;
    ctx.fill();
  }

  // ---- nostrils
  ctx.fillStyle = COZY.pupil;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * 8, -16, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The fused head-and-body silhouette: a rounded square with a domed top. */
function bodyPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  roundRect(ctx, -40, -52, 80, 96, [34, 34, 14, 14]);
}

function limbPaths(ctx: CanvasRenderingContext2D, armShift: number): void {
  ctx.beginPath();
  // arms, out to the sides
  roundRect(ctx, -62, 6 + armShift, 30, 12, 6);
  roundRect(ctx, 32, 6 - armShift, 30, 12, 6);
  // feet
  roundRect(ctx, -34, 36, 26, 14, 6);
  roundRect(ctx, 8, 36, 26, 14, 6);
}

// ----------------------------------------------------------------- predator (V2)

/**
 * PRD §11.4.  Identity anchors that must survive: the silhouette proportions,
 * the yellow belly and its rim, the wide-set eye placement, the pink tongue.
 * Everything else is the same design pushed one step past comfortable.
 */
function drawPredator(ctx: CanvasRenderingContext2D, maw: number): void {
  // Elongated — the same frog, stretched wrong.
  ctx.scale(1.04, 1.16);

  // A real cast shadow with contact darkening, not the cartoon offset.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(4, 50, 46, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = PREDATOR.shadow;
  ctx.globalAlpha = 0.75;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = PREDATOR.body;
  limbPaths(ctx, 0);
  ctx.fill();

  // body with a wet sheen
  bodyPath(ctx);
  ctx.fillStyle = PREDATOR.body;
  ctx.fill();

  const sheen = ctx.createRadialGradient(-16, -30, 4, 0, 0, 72);
  sheen.addColorStop(0, PREDATOR.sheen);
  sheen.addColorStop(0.45, 'rgba(120,200,170,0.10)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.save();
  bodyPath(ctx);
  ctx.clip();
  ctx.fillStyle = sheen;
  ctx.fillRect(-70, -70, 140, 140);

  // the same belly, jaundiced
  ctx.beginPath();
  ctx.arc(0, 16, 40, 0, Math.PI * 2);
  ctx.fillStyle = PREDATOR.belly;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = PREDATOR.bellyRim;
  ctx.stroke();
  ctx.restore();

  // ---- the maw: opens PAST the width of the head, hinged too far back
  const openW = 40 + 26 * maw; // half-width 66 vs a 40 half-width head
  const openH = 8 + 34 * maw;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 6, openW, openH, 0, 0, Math.PI * 2);
  ctx.fillStyle = PREDATOR.mouth;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, 10 + openH * 0.15, openW * 0.66, openH * 0.55, 0, 0, Math.PI * 2);
  ctx.fillStyle = PREDATOR.mouthDeep;
  ctx.fill();

  // teeth — the one thing the cozy design does not have, kept small and even
  ctx.fillStyle = '#E8E2CE';
  const teeth = 9;
  for (let i = 0; i < teeth; i++) {
    const t = -1 + (2 * i) / (teeth - 1);
    const tx = t * openW * 0.86;
    const ty = -Math.sqrt(Math.max(0, 1 - t * t)) * openH * 0.86 + 6;
    ctx.beginPath();
    ctx.moveTo(tx - 4, ty);
    ctx.lineTo(tx + 4, ty);
    ctx.lineTo(tx, ty + 11);
    ctx.closePath();
    ctx.fill();
  }

  // the same pink tongue, now wet and far too long
  if (maw > 0.35) {
    ctx.beginPath();
    ctx.moveTo(-13, 12);
    ctx.quadraticCurveTo(-6, 30 + 26 * maw, 3, 40 + 30 * maw);
    ctx.quadraticCurveTo(12, 28 + 24 * maw, 14, 12);
    ctx.closePath();
    ctx.fillStyle = PREDATOR.tongue;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-5, 16);
    ctx.quadraticCurveTo(0, 30, 2, 36 + 22 * maw);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = PREDATOR.tongueWet;
    ctx.stroke();
  }
  ctx.restore();

  // ---- eyes: the peach ring retreats to a bloodshot rim, pupils blown black
  for (const sx of [-1, 1]) {
    const ex = sx * 27;
    const ey = -40;

    ctx.beginPath();
    ctx.arc(ex, ey, 19, 0, Math.PI * 2);
    ctx.fillStyle = PREDATOR.body;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ex, ey, 14.5, 0, Math.PI * 2);
    ctx.fillStyle = PREDATOR.eyeRing;
    ctx.fill();

    // veins
    ctx.strokeStyle = PREDATOR.eyeVein;
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + sx;
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(a) * 14, ey + Math.sin(a) * 14);
      ctx.quadraticCurveTo(
        ex + Math.cos(a + 0.4) * 9,
        ey + Math.sin(a + 0.4) * 9,
        ex + Math.cos(a) * 5,
        ey + Math.sin(a) * 5,
      );
      ctx.stroke();
    }

    // pupil, edge to edge, no highlight
    ctx.beginPath();
    ctx.arc(ex, ey, 12.5, 0, Math.PI * 2);
    ctx.fillStyle = PREDATOR.pupil;
    ctx.fill();
  }

  ctx.fillStyle = '#000';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * 8, -18, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --------------------------------------------------------------------- helpers

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | number[],
): void {
  const radii = typeof r === 'number' ? [r, r, r, r] : r;
  const [tl, tr, br, bl] = radii;
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}
