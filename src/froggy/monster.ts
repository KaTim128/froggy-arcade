/**
 * What Froggy actually is.
 *
 * The cozy mascot is drawn from flat fills, hard cartoon shadows and perfect
 * symmetry.  This is the opposite of all three on purpose: wet gradients,
 * mottled skin, and a face that is very slightly WRONG on one side — one eye
 * lower and larger than the other, a jaw hinged past where a jaw goes.  The
 * asymmetry is what makes it read as a real thing rather than a design.
 *
 * It shares the mascot's silhouette landmarks — the two eye bumps, the belly,
 * the wide mouth line — because the horror is recognition, not novelty
 * (QFD H8).  You have to be able to see who it used to be.
 *
 * Same local design space as froggy.ts: x -60..60, y -62..52, feet at +50.
 */

export interface MonsterOpts {
  /** 0 = the mascot's proportions, 1 = fully transformed. */
  morph: number;
  /** 0..1 mouth openness. */
  maw: number;
  /** 0..1 how much blood is on him and running. */
  blood: number;
  /** Pupil radius multiplier.  Tiny pupils in a wide eye is the stare. */
  pupil: number;
  /** Seconds, for wet shimmer and the blood running. */
  t: number;
  /** 0..1 vertical jitter, for the frames where he is not still. */
  shake?: number;
}

const SKIN_DARK = '#1d2b1f';
const SKIN_MID = '#33462f';
const SKIN_LIT = '#5d7248';
const SKIN_SICK = '#7d8a52';
const BLOOD = '#6d0a0c';
const BLOOD_WET = '#a5121a';
const BLOOD_FRESH = '#c8232b';
const GUM = '#5c1b22';
const THROAT = '#0a0305';
const TOOTH = '#d8cdb0';
const SCLERA = '#c9c4ad';

/** Deterministic per-index noise, so the mottling does not crawl between frames. */
const rnd = (i: number): number => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function drawMonster(ctx: CanvasRenderingContext2D, o: MonsterOpts): void {
  const m = Math.max(0, Math.min(1, o.morph));
  const shake = (o.shake ?? 0) * (rnd(Math.floor(o.t * 60)) - 0.5) * 6;

  ctx.save();
  ctx.translate(shake, shake * 0.4);

  // The head grows and the body shrinks under it as he turns.
  const headR = 40 + m * 13;
  const headY = -18 - m * 6;

  drawBody(ctx, m);
  drawHead(ctx, headR, headY, m, o);
  if (o.blood > 0) drawBlood(ctx, headR, headY, o);

  ctx.restore();
}

// ------------------------------------------------------------------------ body

function drawBody(ctx: CanvasRenderingContext2D, m: number): void {
  const w = 44 - m * 6;
  const top = -20;
  const bottom = 50;

  const g = ctx.createLinearGradient(-w, top, w, bottom);
  g.addColorStop(0, SKIN_MID);
  g.addColorStop(0.55, SKIN_DARK);
  g.addColorStop(1, '#0d1510');

  ctx.beginPath();
  ctx.moveTo(-w, bottom);
  ctx.bezierCurveTo(-w - 8, 4, -w + 4, top, 0, top - 4);
  ctx.bezierCurveTo(w - 4, top, w + 8, 4, w, bottom);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();

  // The belly is still there.  It is the last thing you recognise.
  const bg = ctx.createRadialGradient(0, 22, 3, 0, 22, 30);
  bg.addColorStop(0, `rgba(196,178,74,${0.85 - m * 0.45})`);
  bg.addColorStop(1, `rgba(90,84,38,${0.5 - m * 0.3})`);
  ctx.beginPath();
  ctx.ellipse(0, 22, 24 - m * 4, 26, 0, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();

  // ribs pushing through, only once he has turned
  if (m > 0.35) {
    ctx.strokeStyle = `rgba(10,14,10,${(m - 0.35) * 0.8})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const y = 4 + i * 9;
      ctx.beginPath();
      ctx.moveTo(-20, y);
      ctx.quadraticCurveTo(0, y + 5, 20, y);
      ctx.stroke();
    }
  }

  mottle(ctx, 0, 14, 40, 40, 26, m);

  // long arms, hanging wrong
  ctx.strokeStyle = SKIN_DARK;
  ctx.lineCap = 'round';
  ctx.lineWidth = 9 - m * 2;
  for (const side of [-1, 1]) {
    const reach = 26 + m * 20;
    ctx.beginPath();
    ctx.moveTo(side * (w - 6), -6);
    ctx.quadraticCurveTo(side * (w + 14), 18, side * (w + 6), 18 + reach);
    ctx.stroke();
  }
  // fingers
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    const reach = 26 + m * 20;
    for (let f = -1; f <= 1; f++) {
      ctx.beginPath();
      ctx.moveTo(side * (w + 6), 18 + reach);
      ctx.lineTo(side * (w + 6) + f * 7, 18 + reach + 12 + Math.abs(f) * -3);
      ctx.stroke();
    }
  }
}

// ------------------------------------------------------------------------ head

function drawHead(ctx: CanvasRenderingContext2D, R: number, cy: number, m: number, o: MonsterOpts): void {
  // skull: wider at the eyes, tapering to the jaw
  const g = ctx.createRadialGradient(-R * 0.35, cy - R * 0.4, R * 0.15, 0, cy, R * 1.25);
  g.addColorStop(0, SKIN_LIT);
  g.addColorStop(0.45, SKIN_MID);
  g.addColorStop(1, SKIN_DARK);

  ctx.beginPath();
  ctx.ellipse(0, cy, R, R * (0.86 + m * 0.16), 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  mottle(ctx, 0, cy, R * 1.7, R * 1.5, 34, m);

  // wet sheen across the brow
  const sh = ctx.createLinearGradient(0, cy - R, 0, cy);
  sh.addColorStop(0, `rgba(220,255,230,${0.16 + Math.sin(o.t * 2) * 0.04})`);
  sh.addColorStop(1, 'rgba(220,255,230,0)');
  ctx.beginPath();
  ctx.ellipse(0, cy - R * 0.25, R * 0.8, R * 0.45, 0, 0, Math.PI * 2);
  ctx.fillStyle = sh;
  ctx.fill();

  // The two eye bumps are the mascot's, kept and ruined.  Deliberately unequal.
  drawEye(ctx, -R * 0.46, cy - R * 0.34, R * 0.36, m, o, 1);
  drawEye(ctx, R * 0.5, cy - R * 0.27, R * 0.42, m, o, -1);

  drawMaw(ctx, R, cy, m, o);

  // veins crawling up from the jaw
  if (m > 0.2) {
    ctx.strokeStyle = `rgba(120,30,34,${(m - 0.2) * 0.7})`;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) {
      const a = -0.4 + i * 0.42;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.5);
      ctx.quadraticCurveTo(
        Math.cos(a) * R * 0.5,
        cy - R * 0.1,
        Math.cos(a) * R * 0.7 + (rnd(i) - 0.5) * 10,
        cy - R * 0.7,
      );
      ctx.stroke();
    }
  }
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  m: number,
  o: MonsterOpts,
  lidSide: number,
): void {
  // socket
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.22, r * 1.18, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8,12,8,0.85)';
  ctx.fill();

  // sclera, sickly rather than white
  const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
  g.addColorStop(0, '#e8e2cd');
  g.addColorStop(1, SCLERA);
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.96, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  // bloodshot: veins reaching in from the rim
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.96, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = `rgba(150,26,26,${0.35 + m * 0.5})`;
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 10; i++) {
    const a = rnd(i + Math.floor(x)) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.quadraticCurveTo(
      x + Math.cos(a) * r * 0.55 + (rnd(i * 3) - 0.5) * 6,
      y + Math.sin(a) * r * 0.55,
      x + Math.cos(a) * r * 0.2,
      y + Math.sin(a) * r * 0.2,
    );
    ctx.stroke();
  }
  ctx.restore();

  // The pupil.  A pinprick in all that white is the whole stare.
  const pr = Math.max(0.6, r * 0.34 * o.pupil);
  ctx.beginPath();
  ctx.ellipse(x, y, pr, pr * 1.15, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();

  // a single wet catchlight, off-centre
  ctx.beginPath();
  ctx.ellipse(x - r * 0.3, y - r * 0.35, r * 0.16, r * 0.12, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();

  // heavy lid, dragged down from one side
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.24, r * 1.2, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(x - r * 1.4, y - r * 0.5 + lidSide * r * 0.1);
  ctx.quadraticCurveTo(x, y - r * (1.0 + m * 0.3), x + r * 1.4, y - r * 0.45 - lidSide * r * 0.1);
  ctx.lineTo(x + r * 1.4, y - r * 1.6);
  ctx.lineTo(x - r * 1.4, y - r * 1.6);
  ctx.closePath();
  const lg = ctx.createLinearGradient(0, y - r * 1.2, 0, y - r * 0.4);
  lg.addColorStop(0, SKIN_MID);
  lg.addColorStop(1, SKIN_DARK);
  ctx.fillStyle = lg;
  ctx.fill();
  ctx.restore();
}

function drawMaw(ctx: CanvasRenderingContext2D, R: number, cy: number, m: number, o: MonsterOpts): void {
  const open = o.maw * (0.35 + m * 0.65);
  const halfW = R * (0.72 + m * 0.24);
  const lipY = cy + R * 0.36;
  const drop = R * (0.16 + open * (0.95 + m * 0.5));

  // the split — it goes past where a mouth should stop
  ctx.beginPath();
  ctx.moveTo(-halfW, lipY);
  ctx.quadraticCurveTo(0, lipY + drop * 0.35, halfW, lipY);
  ctx.quadraticCurveTo(halfW * 0.6, lipY + drop, 0, lipY + drop);
  ctx.quadraticCurveTo(-halfW * 0.6, lipY + drop, -halfW, lipY);
  ctx.closePath();

  const tg = ctx.createRadialGradient(0, lipY + drop * 0.5, 2, 0, lipY + drop * 0.5, halfW);
  tg.addColorStop(0, THROAT);
  tg.addColorStop(0.7, '#2a0509');
  tg.addColorStop(1, GUM);
  ctx.fillStyle = tg;
  ctx.fill();

  // teeth: irregular, too many, not a grid
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-halfW, lipY);
  ctx.quadraticCurveTo(0, lipY + drop * 0.35, halfW, lipY);
  ctx.quadraticCurveTo(halfW * 0.6, lipY + drop, 0, lipY + drop);
  ctx.quadraticCurveTo(-halfW * 0.6, lipY + drop, -halfW, lipY);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = TOOTH;
  const n = 11;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const tx = -halfW + f * halfW * 2;
    const lean = (rnd(i) - 0.5) * 5;
    const len = (5 + rnd(i + 40) * 9) * (0.6 + m * 0.8);
    const topY = lipY + Math.sin(f * Math.PI) * drop * 0.18;
    ctx.beginPath();
    ctx.moveTo(tx - 3.2, topY);
    ctx.lineTo(tx + 3.2, topY);
    ctx.lineTo(tx + lean, topY + len);
    ctx.closePath();
    ctx.fill();

    // lower jaw
    const blen = (4 + rnd(i + 90) * 8) * (0.6 + m * 0.8);
    const botY = lipY + drop - Math.sin(f * Math.PI) * drop * 0.12;
    ctx.beginPath();
    ctx.moveTo(tx - 3, botY);
    ctx.lineTo(tx + 3, botY);
    ctx.lineTo(tx - lean, botY - blen);
    ctx.closePath();
    ctx.fill();
  }

  // strands of saliva across the gap
  if (open > 0.25) {
    ctx.strokeStyle = `rgba(230,235,215,${0.28 * open})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const sx = -halfW * 0.6 + i * halfW * 0.4;
      ctx.beginPath();
      ctx.moveTo(sx, lipY + drop * 0.15);
      ctx.quadraticCurveTo(sx + 2, lipY + drop * 0.6 + Math.sin(o.t * 3 + i) * 2, sx - 1, lipY + drop * 0.9);
      ctx.stroke();
    }
  }
  ctx.restore();

  // torn corners, sinew where the jaw unhinged
  if (m > 0.3) {
    ctx.strokeStyle = `rgba(120,26,30,${(m - 0.3) * 1.2})`;
    ctx.lineWidth = 1.6;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * halfW, lipY);
      ctx.quadraticCurveTo(side * (halfW + 6), lipY + drop * 0.4, side * (halfW - 2), lipY + drop * 0.8);
      ctx.stroke();
    }
  }
}

// ----------------------------------------------------------------------- blood

function drawBlood(ctx: CanvasRenderingContext2D, R: number, cy: number, o: MonsterOpts): void {
  const a = Math.min(1, o.blood);
  const run = Math.min(1, o.blood * 1.4);

  // from the mouth, down the chin and chest
  ctx.fillStyle = `rgba(109,10,12,${0.9 * a})`;
  ctx.beginPath();
  ctx.moveTo(-R * 0.5, cy + R * 0.5);
  ctx.quadraticCurveTo(0, cy + R * 0.75, R * 0.5, cy + R * 0.5);
  ctx.lineTo(R * 0.34, cy + R * 0.5 + 34 * run);
  ctx.quadraticCurveTo(0, cy + R * 0.5 + 46 * run, -R * 0.3, cy + R * 0.5 + 30 * run);
  ctx.closePath();
  ctx.fill();

  // individual runs, at different rates
  for (let i = 0; i < 6; i++) {
    const x = -R * 0.55 + rnd(i) * R * 1.1;
    const len = (14 + rnd(i + 7) * 40) * run;
    // Tapered, not a bar: wide where it leaves the wound, thinning as it runs,
    // with the bead of weight at the tip.
    const top = cy + R * 0.55;
    const wide = 1.4 + rnd(i + 3) * 1.6;
    const sway = (rnd(i + 11) - 0.5) * 5;
    ctx.beginPath();
    ctx.moveTo(x - wide, top);
    ctx.quadraticCurveTo(x + sway - 0.6, top + len * 0.6, x - 0.7, top + len);
    ctx.lineTo(x + 0.7, top + len);
    ctx.quadraticCurveTo(x + sway + 0.6, top + len * 0.6, x + wide, top);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? `rgba(165,18,26,${a})` : `rgba(200,35,43,${a * 0.85})`;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, top + len, 1.6, 2.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = BLOOD_FRESH;
    ctx.globalAlpha = a;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // wept from the eyes
  ctx.strokeStyle = `rgba(140,14,20,${a * 0.9})`;
  ctx.lineWidth = 2.5;
  for (const ex of [-R * 0.46, R * 0.5]) {
    ctx.beginPath();
    ctx.moveTo(ex, cy - R * 0.05);
    ctx.quadraticCurveTo(ex + 2, cy + R * 0.3, ex - 1, cy + R * 0.55 + 18 * run);
    ctx.stroke();
  }

  // gloss, so it reads wet rather than painted
  ctx.strokeStyle = `rgba(255,140,140,${0.3 * a})`;
  ctx.lineWidth = 0.8;
  for (const ex of [-R * 0.44, R * 0.52]) {
    ctx.beginPath();
    ctx.moveTo(ex - 1, cy - R * 0.02);
    ctx.quadraticCurveTo(ex + 1, cy + R * 0.28, ex - 2, cy + R * 0.5);
    ctx.stroke();
  }
  void BLOOD;
  void BLOOD_WET;
  void SKIN_SICK;
}

// ----------------------------------------------------------------------- detail

/** Pores and blotching.  Flat fills are what make a cartoon; this is the cure. */
function mottle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  count: number,
  m: number,
): void {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const px = cx + (rnd(i) - 0.5) * w;
    const py = cy + (rnd(i + 500) - 0.5) * h;
    const r = 1 + rnd(i + 900) * 4;
    const dark = rnd(i + 1300) > 0.45;
    ctx.beginPath();
    ctx.ellipse(px, py, r, r * (0.6 + rnd(i + 77) * 0.7), rnd(i) * 3, 0, Math.PI * 2);
    ctx.fillStyle = dark
      ? `rgba(12,20,14,${0.25 + m * 0.35})`
      : `rgba(125,138,82,${0.14 + m * 0.2})`;
    ctx.fill();
  }
  ctx.restore();
}
