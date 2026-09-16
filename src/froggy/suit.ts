/**
 * The man in the suit.
 *
 * He deals blackjack after the night in the dark arcade, at the table Froggy
 * used to stand behind, and he is drawn here for exactly one reason: he has to
 * be the wrong shape.
 *
 * Froggy is a cartoon — a fused green blob, two enormous eyes, a yellow belly,
 * all bounce.  This is a person: narrow, vertical, symmetrical, buttoned up,
 * and almost still.  Nothing about the two silhouettes overlaps, so a player
 * who walks back into the casino knows something has changed before they are
 * close enough to read a word of it.
 *
 * He is drawn on the same unfiltered overlay canvas as Froggy, in the same
 * resolution-independent vector paths and the same 320x180 logical space, so
 * he inherits the same quality of being *drawn differently from the rest of
 * the game*.  That was always the tell, and it does not stop being true just
 * because the frog has gone.
 *
 * He is not a monster and he is not a twist.  He is a man at a table who will
 * not answer the question, which is worse.
 */

export type SuitPose = 'idle' | 'talk';

export interface SuitDrawOpts {
  x: number;
  y: number;
  /** Height in logical pixels, sole of shoe to top of head. */
  height: number;
  pose?: SuitPose;
  /**
   * 0..1, drives the idle.  HALF THE TRAVEL OF FROGGY'S ON PURPOSE: he
   * breathes and that is all, where the frog bobbed.  A player who saw a lot
   * of Froggy reads the stillness before they read the suit.
   */
  bounce?: number;
  /** What `y` means: the ground line, or the point between the eyes. */
  anchor?: 'feet' | 'face';
  alpha?: number;
}

/** Charcoal, shirt, and a tie the colour of the felt he deals on. */
const SUIT = {
  jacket: '#2B303C',
  jacketDark: '#1B1F28',
  lapel: '#232833',
  shadow: '#0D1017',
  shirt: '#E6E9F0',
  shirtShade: '#BCC2D0',
  tie: '#6E1C28',
  tieDark: '#47121B',
  skin: '#C6A88D',
  skinShade: '#9A7C62',
  hair: '#1C1814',
  ink: '#101014',
  mouth: '#40231C',
  shoe: '#13151B',
};

/** The same local design space Froggy uses: x -60..60, y -62..52. */
const DESIGN_H = 114;

export function drawSuitedMan(ctx: CanvasRenderingContext2D, o: SuitDrawOpts): void {
  const pose = o.pose ?? 'idle';
  const s = o.height / DESIGN_H;

  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(o.x, o.y);
  ctx.scale(s, s);
  // Feet at +50, the point between the eyes at -44 — Froggy's anchors, so the
  // two can be swapped at a call site without moving the drawing.
  ctx.translate(0, o.anchor === 'face' ? 44 : -50);
  drawMan(ctx, pose, o.bounce ?? 0);
  ctx.restore();
}

function drawMan(ctx: CanvasRenderingContext2D, pose: SuitPose, bounce: number): void {
  // A breath, not a bounce: a third of Froggy's lift and none of his squash.
  const lift = Math.sin(bounce * Math.PI * 2) * 0.7;
  ctx.translate(0, lift);

  // ---- the same hard-edged cartoon drop shadow the frog casts, so he belongs
  // to this drawing and not to a different game.
  ctx.save();
  ctx.translate(5, 5);
  ctx.fillStyle = SUIT.shadow;
  silhouette(ctx);
  ctx.fill();
  ctx.restore();

  // ---- shoes
  ctx.fillStyle = SUIT.shoe;
  ctx.beginPath();
  roundRect(ctx, -26, 40, 24, 10, [4, 6, 3, 3]);
  roundRect(ctx, 2, 40, 24, 10, [6, 4, 3, 3]);
  ctx.fill();

  // ---- trousers, with a crease down each leg
  ctx.fillStyle = SUIT.jacketDark;
  ctx.beginPath();
  roundRect(ctx, -24, 8, 22, 34, 4);
  roundRect(ctx, 2, 8, 22, 34, 4);
  ctx.fill();
  ctx.strokeStyle = SUIT.shadow;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-13, 12);
  ctx.lineTo(-13, 40);
  ctx.moveTo(13, 12);
  ctx.lineTo(13, 40);
  ctx.stroke();

  // ---- the shirt and the tie, under the jacket and over the chest
  ctx.fillStyle = SUIT.shirt;
  ctx.beginPath();
  roundRect(ctx, -13, -24, 26, 36, 3);
  ctx.fill();
  ctx.fillStyle = SUIT.shirtShade;
  ctx.beginPath();
  roundRect(ctx, -13, -24, 6, 36, 3);
  ctx.fill();

  ctx.fillStyle = SUIT.tie;
  ctx.beginPath();
  ctx.moveTo(-5, -20);
  ctx.lineTo(5, -20);
  ctx.lineTo(7, 10);
  ctx.lineTo(0, 16);
  ctx.lineTo(-7, 10);
  ctx.closePath();
  ctx.fill();
  // the knot
  ctx.fillStyle = SUIT.tieDark;
  ctx.beginPath();
  roundRect(ctx, -6, -24, 12, 8, 2);
  ctx.fill();

  // ---- the jacket, two halves with the shirt showing between them
  ctx.fillStyle = SUIT.jacket;
  ctx.beginPath();
  // left half: shoulder out to -32, in to the button line
  ctx.moveTo(-32, -18);
  ctx.quadraticCurveTo(-34, -22, -26, -25);
  ctx.lineTo(-12, -27);
  ctx.lineTo(-4, -6);
  ctx.lineTo(-6, 14);
  ctx.lineTo(-30, 14);
  ctx.closePath();
  // right half, mirrored
  ctx.moveTo(32, -18);
  ctx.quadraticCurveTo(34, -22, 26, -25);
  ctx.lineTo(12, -27);
  ctx.lineTo(4, -6);
  ctx.lineTo(6, 14);
  ctx.lineTo(30, 14);
  ctx.closePath();
  ctx.fill();

  // lapels: a flat notch either side of the collar, a shade off the jacket so
  // they read at 40 logical pixels tall
  ctx.fillStyle = SUIT.lapel;
  ctx.beginPath();
  ctx.moveTo(-13, -27);
  ctx.lineTo(-4, -7);
  ctx.lineTo(-14, -12);
  ctx.lineTo(-17, -25);
  ctx.closePath();
  ctx.moveTo(13, -27);
  ctx.lineTo(4, -7);
  ctx.lineTo(14, -12);
  ctx.lineTo(17, -25);
  ctx.closePath();
  ctx.fill();

  // ---- sleeves, straight down the sides, and the hands clasped at the waist
  ctx.fillStyle = SUIT.jacket;
  ctx.beginPath();
  roundRect(ctx, -36, -20, 12, 32, 5);
  roundRect(ctx, 24, -20, 12, 32, 5);
  ctx.fill();
  ctx.fillStyle = SUIT.jacketDark;
  ctx.beginPath();
  roundRect(ctx, -36, 6, 12, 6, 3);
  roundRect(ctx, 24, 6, 12, 6, 3);
  ctx.fill();

  ctx.fillStyle = SUIT.skin;
  ctx.beginPath();
  roundRect(ctx, -20, 10, 18, 11, 5);
  roundRect(ctx, 2, 10, 18, 11, 5);
  ctx.fill();
  ctx.strokeStyle = SUIT.skinShade;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 11);
  ctx.lineTo(0, 20);
  ctx.stroke();

  // ---- neck and collar
  ctx.fillStyle = SUIT.skinShade;
  ctx.beginPath();
  roundRect(ctx, -8, -32, 16, 12, 3);
  ctx.fill();
  ctx.fillStyle = SUIT.shirt;
  ctx.beginPath();
  ctx.moveTo(-14, -28);
  ctx.lineTo(-7, -22);
  ctx.lineTo(0, -26);
  ctx.lineTo(7, -22);
  ctx.lineTo(14, -28);
  ctx.lineTo(10, -31);
  ctx.lineTo(-10, -31);
  ctx.closePath();
  ctx.fill();

  // ---- head
  ctx.fillStyle = SUIT.skin;
  ctx.beginPath();
  ctx.ellipse(0, -44, 16, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  // the side the light is not on
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -44, 16, 20, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = SUIT.skinShade;
  ctx.beginPath();
  ctx.rect(-16, -64, 6, 40);
  ctx.fill();
  ctx.restore();

  // ---- hair: flat, short, parted hard on one side.  It is the only thing
  // about him with any shape to it, and it still has none.
  ctx.fillStyle = SUIT.hair;
  ctx.beginPath();
  ctx.ellipse(0, -52, 16.5, 12, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-16, -52);
  ctx.quadraticCurveTo(-14, -44, -15, -40);
  ctx.lineTo(-10, -44);
  ctx.lineTo(-8, -52);
  ctx.closePath();
  ctx.moveTo(16, -52);
  ctx.quadraticCurveTo(14, -46, 15, -43);
  ctx.lineTo(11, -47);
  ctx.closePath();
  ctx.fill();

  // ---- eyes.  Small, level, and the same in both poses: he is polite, and he
  // is not going to look surprised about anything.
  ctx.fillStyle = SUIT.ink;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * 6.5, -45, 2.2, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // brows: two short flat strokes, no arch
  ctx.strokeStyle = SUIT.hair;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-10, -51);
  ctx.lineTo(-3, -51);
  ctx.moveTo(3, -51);
  ctx.lineTo(10, -51);
  ctx.stroke();

  // ---- nose and mouth
  ctx.strokeStyle = SUIT.skinShade;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, -44);
  ctx.lineTo(1.5, -38);
  ctx.lineTo(-1.5, -38);
  ctx.stroke();

  if (pose === 'talk') {
    ctx.fillStyle = SUIT.mouth;
    ctx.beginPath();
    ctx.ellipse(0, -32, 4.5, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = SUIT.mouth;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-5, -32);
    ctx.lineTo(5, -32);
    ctx.stroke();
  }
}

/** One closed outline of the whole figure, for the drop shadow. */
function silhouette(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.ellipse(0, -44, 16, 20, 0, 0, Math.PI * 2);
  roundRect(ctx, -8, -34, 16, 12, 3);
  roundRect(ctx, -36, -27, 72, 41, 6);
  roundRect(ctx, -24, 8, 48, 34, 4);
  roundRect(ctx, -26, 40, 52, 10, 4);
}

/** Froggy's, copied rather than exported: the two files draw nothing in common. */
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
}
