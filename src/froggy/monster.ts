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
  // Behind the head, so the tufts read as a silhouette he has rather than as
  // things stuck on the front of him.
  drawGrowths(ctx, headR, headY, m);
  drawHead(ctx, headR, headY, m, o);
  if (o.blood > 0) drawBlood(ctx, headR, headY, o);

  ctx.restore();
}

// ------------------------------------------------------------------------ body

/**
 * THE BODY, AND WHY IT IS A BALL.
 *
 * He used to be a tapering sack with two long arms hanging past his knees out
 * of it and no legs drawn at all -- a hunched thing.  He stands up now, on two
 * feet, and what he stands on is one heavy round mass with the head sunk into
 * the top of it: no neck, no shoulders, no join.  That is the whole silhouette
 * -- a swollen frog, upright -- and it is what makes him read as a frog first
 * and as a horror second, which is the right way round.
 *
 * Two arms, two legs, and nothing else growing out of him.
 */
function drawBody(ctx: CanvasRenderingContext2D, m: number): void {
  const w = 46 - m * 2;
  const top = -24;
  const bottom = 40;

  const g = ctx.createRadialGradient(-w * 0.3, 2, 6, 0, 14, w * 1.5);
  g.addColorStop(0, SKIN_MID);
  g.addColorStop(0.6, SKIN_DARK);
  g.addColorStop(1, '#0d1510');

  // ---- the mass itself: round, and wider than it is tall.
  ctx.beginPath();
  ctx.ellipse(0, 8, w, (bottom - top) / 2 + 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  // ---- the belly.  Pale, cracked, and the last thing you recognise.
  const bg = ctx.createRadialGradient(0, 20, 4, 0, 20, 34);
  bg.addColorStop(0, `rgba(198,186,104,${0.8 - m * 0.3})`);
  bg.addColorStop(1, `rgba(96,92,44,${0.5 - m * 0.25})`);
  ctx.beginPath();
  ctx.ellipse(0, 20, w * 0.62, 28, 0, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  // and the cracks across it, which is what the belly is FOR on this version
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 20, w * 0.62, 28, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = `rgba(92,22,24,${0.35 + m * 0.3})`;
  for (let i = 0; i < 9; i++) {
    const x0 = (rnd(i + 210) - 0.5) * w;
    const y0 = 2 + rnd(i + 220) * 36;
    ctx.lineWidth = 0.6 + rnd(i + 230) * 1.1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + (rnd(i + 240) - 0.5) * 22, y0 + 8, x0 + (rnd(i + 250) - 0.5) * 34, y0 + 16);
    ctx.stroke();
  }
  ctx.restore();

  mottle(ctx, 0, 12, w * 1.9, 46, 26, m);

  // ---- TWO ARMS.  Short, held at the sides, ending in long fingers.  They
  // used to reach past the bottom of the drawing, which is an ape.
  ctx.strokeStyle = SKIN_DARK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    ctx.lineWidth = 8 - m;
    const sx = side * (w - 8);
    ctx.beginPath();
    ctx.moveTo(sx, -6);
    ctx.quadraticCurveTo(side * (w + 9), 8, side * (w + 5), 30);
    ctx.stroke();
    // three long fingers, splayed
    ctx.lineWidth = 2.6;
    for (let fgr = -1; fgr <= 1; fgr++) {
      ctx.beginPath();
      ctx.moveTo(side * (w + 5), 30);
      ctx.quadraticCurveTo(
        side * (w + 6) + fgr * 4,
        38,
        side * (w + 4) + fgr * 8,
        44 - Math.abs(fgr) * 3,
      );
      ctx.stroke();
    }
  }

  // ---- TWO LEGS, and he is stood on them.  A frog's: folded out at the knee,
  // dropping to a long flat foot with toes that spread across the floor.
  for (const side of [-1, 1]) {
    ctx.strokeStyle = SKIN_DARK;
    ctx.lineWidth = 11 - m;
    ctx.beginPath();
    ctx.moveTo(side * 16, 30);
    ctx.quadraticCurveTo(side * 26, 40, side * 20, 50);
    ctx.stroke();
    // the foot: flat on the ground, long, with four toes off the front of it
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(side * 20, 50);
    ctx.lineTo(side * 20, 51);
    ctx.stroke();
    ctx.lineWidth = 2.4;
    for (let toe = 0; toe < 4; toe++) {
      const spread = (toe / 3 - 0.5) * 2;
      ctx.beginPath();
      ctx.moveTo(side * 20, 50);
      ctx.quadraticCurveTo(side * (20 + spread * 6), 53, side * (20 + spread * 13), 52 + Math.abs(spread) * 2);
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

  mottle(ctx, 0, cy, R * 1.7, R * 1.5, 110, m);

  // Scars and splits.  Short, dark, going nowhere in particular -- the thing
  // that stops a large area of one colour from reading as a balloon.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, cy, R, R * (0.86 + m * 0.16), 0, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 16; i++) {
    const sx = (rnd(i + 600) - 0.5) * R * 1.9;
    const sy = cy + (rnd(i + 620) - 0.5) * R * 1.7;
    const len = R * (0.08 + rnd(i + 640) * 0.3);
    const ang = rnd(i + 660) * Math.PI * 2;
    ctx.strokeStyle = `rgba(8,14,9,${0.3 + m * 0.35})`;
    ctx.lineWidth = 0.7 + rnd(i + 680) * 1.6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(
      sx + Math.cos(ang) * len * 0.5 + (rnd(i + 700) - 0.5) * 5,
      sy + Math.sin(ang) * len * 0.5,
      sx + Math.cos(ang) * len,
      sy + Math.sin(ang) * len,
    );
    ctx.stroke();
    // a pale lip on one side, so it is a split and not a pen line
    ctx.strokeStyle = `rgba(150,166,110,${0.16 + m * 0.18})`;
    ctx.lineWidth *= 0.5;
    ctx.stroke();
  }
  ctx.restore();

  // wet sheen across the brow
  const sh = ctx.createLinearGradient(0, cy - R, 0, cy);
  sh.addColorStop(0, `rgba(220,255,230,${0.16 + Math.sin(o.t * 2) * 0.04})`);
  sh.addColorStop(1, 'rgba(220,255,230,0)');
  ctx.beginPath();
  ctx.ellipse(0, cy - R * 0.25, R * 0.8, R * 0.45, 0, 0, Math.PI * 2);
  ctx.fillStyle = sh;
  ctx.fill();

  // ---- TWO EYES.  EXACTLY TWO, AND THEY ARE A PAIR.
  //
  // There used to be eight more scattered over the head and one of the main
  // pair was lower and larger than the other.  Both are gone: he is a frog
  // with a frog's two eyes, and what is wrong with him is that they are twice
  // the size they should be, bloodshot to the iris and pointed at you.  A
  // matched pair looks BACK at the player; a scatter of wrong ones is a
  // texture, and a texture cannot stare.
  //
  // Set high and wide, where a frog's are -- bulging off the top of the skull
  // rather than sunk into the front of it.
  drawEye(ctx, -R * 0.52, cy - R * 0.46, R * 0.44, m, o, 1);
  drawEye(ctx, R * 0.52, cy - R * 0.46, R * 0.44, m, o, -1);

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

/**
 * WHAT HIS SKIN IS LIKE.
 *
 * Warts, and nothing else: raised nodules over the hide with a shadow under
 * each, so they are bumps rather than spots.  There used to be forty ragged
 * tufts of matted hair off the silhouette as well; they are gone, because a
 * frog does not have hair and the brief for this thing is a FROG -- round,
 * cracked, swollen -- rather than a pile of mutations.  The cracks in
 * `drawHead` do the job the tufts were doing, which is stopping a large
 * ellipse from reading as a balloon.
 */
function drawGrowths(ctx: CanvasRenderingContext2D, R: number, cy: number, m: number): void {
  if (m < 0.1) return;
  const a = Math.min(1, (m - 0.1) / 0.3);
  ctx.save();
  ctx.globalAlpha = a;
  // nodules: raised, with a shadow under each, so they are bumps and not spots
  for (let i = 0; i < 26; i++) {
    const ang = rnd(i + 60) * Math.PI * 2;
    const rad = rnd(i + 70) * R * 0.82;
    const x = Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad * 0.88;
    const r = 1.6 + rnd(i + 80) * 3.4;
    ctx.beginPath();
    ctx.ellipse(x + 0.8, y + 1.1, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = rnd(i + 90) < 0.5 ? SKIN_SICK : SKIN_LIT;
    ctx.fill();
  }
  ctx.restore();
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
  // Not a clean white.  Nothing on him is clean, and an eye that is reads as
  // a cartoon eye however bloodshot it gets.
  const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
  g.addColorStop(0, '#ded7bf');
  g.addColorStop(0.7, SCLERA);
  g.addColorStop(1, '#847f68');
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.96, 0, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  // bloodshot: veins reaching in from the rim
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.96, 0, 0, Math.PI * 2);
  ctx.clip();
  // Veins crawl IN FROM THE RIM and stop short, branching as they go.  Ten
  // lines run from the edge to the pupil and the eye becomes a wagon wheel,
  // which is what it was.
  for (let i = 0; i < 16; i++) {
    const a = rnd(i + Math.floor(x)) * Math.PI * 2;
    const reach = 0.3 + rnd(i + 31) * 0.45;
    ctx.strokeStyle = `rgba(150,26,26,${(0.3 + m * 0.5) * (0.5 + rnd(i + 7) * 0.5)})`;
    ctx.lineWidth = 0.5 + rnd(i + 13) * 0.9;
    const ex = x + Math.cos(a) * r;
    const ey = y + Math.sin(a) * r;
    const tx = x + Math.cos(a) * r * (1 - reach);
    const ty = y + Math.sin(a) * r * (1 - reach);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.quadraticCurveTo(
      (ex + tx) / 2 + (rnd(i * 3) - 0.5) * r * 0.3,
      (ey + ty) / 2 + (rnd(i * 5) - 0.5) * r * 0.3,
      tx,
      ty,
    );
    ctx.stroke();
    // a branch off it, half the length, so they fork rather than radiate
    ctx.lineWidth *= 0.6;
    ctx.beginPath();
    ctx.moveTo((ex + tx) / 2, (ey + ty) / 2);
    ctx.lineTo(
      (ex + tx) / 2 + (rnd(i + 41) - 0.5) * r * 0.5,
      (ey + ty) / 2 + (rnd(i + 43) - 0.5) * r * 0.5,
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
  // ---- AND IT IS THE BIGGEST THING ON HIM.  Nearly the width of the head and
  // set low on it, under two eyes that take the top: a frog's face, at the
  // proportions of something that swallows what it catches.
  const halfW = R * (0.8 + m * 0.26);
  const lipY = cy + R * 0.3;
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

  // ---- A SECOND SET, FURTHER BACK.  One ring of teeth is a mouth.  Two, with
  // the far one smaller and turned the other way, is a throat that also bites,
  // and it is the single nastiest thing on the drawing.
  if (open > 0.3 && m > 0.35) {
    const inW = halfW * 0.5;
    const inY = lipY + drop * 0.52;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, inY, inW, drop * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TOOTH;
    for (let i = 0; i < 9; i++) {
      const f = i / 8;
      const tx = -inW + f * inW * 2;
      const len = (2.5 + rnd(i + 120) * 4.5) * (0.5 + m * 0.7);
      ctx.beginPath();
      ctx.moveTo(tx - 1.9, inY - drop * 0.1);
      ctx.lineTo(tx + 1.9, inY - drop * 0.1);
      ctx.lineTo(tx + (rnd(i + 130) - 0.5) * 3, inY - drop * 0.1 + len);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tx - 1.7, inY + drop * 0.1);
      ctx.lineTo(tx + 1.7, inY + drop * 0.1);
      ctx.lineTo(tx - (rnd(i + 140) - 0.5) * 3, inY + drop * 0.1 - len * 0.8);
      ctx.closePath();
      ctx.fill();
    }
    // AND A LIGHT DOWN THERE.  One red point, deep, where nothing should be
    // lit at all -- it is the only part of him that is not reflecting the
    // player's torch but making its own.
    const dg = ctx.createRadialGradient(0, inY, 0.5, 0, inY, drop * 0.5);
    dg.addColorStop(0, 'rgba(255,60,44,0.95)');
    dg.addColorStop(0.35, 'rgba(180,18,14,0.5)');
    dg.addColorStop(1, 'rgba(120,0,0,0)');
    ctx.beginPath();
    ctx.ellipse(0, inY, drop * 0.5, drop * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = dg;
    ctx.fill();
  }

  // ---- saliva.  Long strings from the upper teeth, hanging past the lower
  // jaw with a bead on the end and a slow sway, rather than four short ticks.
  if (open > 0.2) {
    for (let i = 0; i < 9; i++) {
      const f = i / 8;
      const sx = -halfW * 0.82 + f * halfW * 1.64;
      const hang = drop * (0.35 + rnd(i + 200) * 0.75) * open;
      const sway = Math.sin(o.t * 2.1 + i * 1.3) * 2.4;
      ctx.strokeStyle = `rgba(232,238,214,${0.3 + 0.35 * open})`;
      ctx.lineWidth = 0.8 + rnd(i + 210) * 1.1;
      ctx.beginPath();
      ctx.moveTo(sx, lipY + drop * 0.1);
      ctx.quadraticCurveTo(sx + sway, lipY + hang * 0.6, sx + sway * 1.4, lipY + hang);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx + sway * 1.4, lipY + hang, 0.9 + rnd(i + 220) * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(232,238,214,${0.45 * open})`;
      ctx.fill();
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
