/**
 * The night clerk at the Grand Lily's reception desk.
 *
 * Drawn the way every PERSON in this building is drawn -- the dealer, the kid
 * on the prize counter (froggy/staffer.ts) -- in vector paths on the smooth
 * overlay, in the same 320x180 logical space with the same cartoon drop
 * shadow and the same lamp across the head and shoulders.  He is not the kid
 * in a different shirt: he is a hotel's man, upright and immaculate, in the
 * Grand Lily's own colours:
 *
 *   - a navy tailored jacket with gold piping on the lapels and two gold
 *     buttons, over a crisp white shirt and a burgundy tie
 *   - a brass name badge, and a small lily pinned to his lapel
 *   - dark hair, neatly side-parted and combed flat
 *   - a calm, polite half-smile; his mouth moves when he speaks to you
 *
 * Only his top half is ever seen over the desk, so that is where the detail
 * lives -- but he is drawn whole.
 */

export type ClerkPose = 'idle' | 'talk';

export interface ClerkDrawOpts {
  x: number;
  y: number;
  /** Height in logical pixels, sole of shoe to top of head. */
  height: number;
  pose?: ClerkPose;
  /** 0..1, a slow breath -- he does not slouch. */
  breath?: number;
  /** 0..1, how lit the lobby is. */
  alpha?: number;
}

const KIT = {
  jacket: '#22304E',
  jacketDark: '#17213A',
  jacketShade: '#111A2E',
  piping: '#C9A24A',
  pipingHi: '#ECD07A',
  shirt: '#F4F0E8',
  shirtShade: '#D6D0C4',
  tie: '#7B2A3A',
  tieDark: '#5A1C2A',
  badge: '#C9A24A',
  badgeInk: '#2A1608',
  lily: '#F8E0EC',
  lilyDeep: '#E08AB0',
  skin: '#E8B890',
  skinShade: '#C08E6A',
  hair: '#2E2018',
  hairHi: '#4A3626',
  ink: '#15131A',
  mouth: '#7A3A30',
  shadow: '#0D1017',
  trousers: '#1A2236',
  shoe: '#0E0F14',
};

/** The design space the dealer and the kid share: x -60..60, y -62..52. */
const DESIGN_H = 114;

export function drawClerk(ctx: CanvasRenderingContext2D, o: ClerkDrawOpts): void {
  const s = o.height / DESIGN_H;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(o.x, o.y);
  ctx.scale(s, s);
  ctx.translate(0, -50);
  drawHim(ctx, o.pose ?? 'idle', o.breath ?? 0);
  lightHim(ctx);
  ctx.restore();
}

/** The chandelier and the desk lamp, warm across his head and shoulders. */
function lightHim(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(0, -66, 0, 52);
  g.addColorStop(0, 'rgba(255, 220, 160, 0.24)');
  g.addColorStop(0.28, 'rgba(255, 210, 150, 0.08)');
  g.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(10, 6, 14, 0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(-60, -70, 120, 122);
  ctx.restore();
}

function drawHim(ctx: CanvasRenderingContext2D, pose: ClerkPose, breath: number): void {
  // Upright: only the breath moves him.
  ctx.translate(0, Math.sin(breath * Math.PI * 2) * 0.4);

  // ---- drop shadow, the house style
  ctx.save();
  ctx.translate(5, 5);
  ctx.fillStyle = KIT.shadow;
  ctx.beginPath();
  ctx.ellipse(0, -45, 15, 18, 0, 0, Math.PI * 2);
  roundRect(ctx, -30, -28, 60, 46, 8);
  roundRect(ctx, -20, 12, 40, 38, 4);
  ctx.fill();
  ctx.restore();

  // ---- legs and shoes
  ctx.fillStyle = KIT.shoe;
  ctx.beginPath();
  roundRect(ctx, -20, 41, 18, 9, 4);
  roundRect(ctx, 2, 41, 18, 9, 4);
  ctx.fill();
  ctx.fillStyle = KIT.trousers;
  ctx.beginPath();
  roundRect(ctx, -19, 12, 17, 31, 3);
  roundRect(ctx, 2, 12, 17, 31, 3);
  ctx.fill();

  // ---- the jacket: square, tailored shoulders, a sharp line down
  ctx.fillStyle = KIT.jacket;
  ctx.beginPath();
  ctx.moveTo(-30, -16);
  ctx.quadraticCurveTo(-31, -26, -19, -28);
  ctx.lineTo(19, -28);
  ctx.quadraticCurveTo(31, -26, 30, -16);
  ctx.lineTo(27, 18);
  ctx.lineTo(-27, 18);
  ctx.closePath();
  ctx.fill();
  // the side away from the lamp
  ctx.fillStyle = KIT.jacketDark;
  ctx.beginPath();
  ctx.moveTo(-30, -16);
  ctx.quadraticCurveTo(-31, -26, -19, -28);
  ctx.lineTo(-15, -28);
  ctx.lineTo(-19, 18);
  ctx.lineTo(-27, 18);
  ctx.closePath();
  ctx.fill();
  // sleeves, hands folded in front of him below the desk line
  for (const sx of [-1, 1]) {
    ctx.fillStyle = KIT.jacketShade;
    ctx.beginPath();
    roundRect(ctx, sx < 0 ? -36 : 25, -24, 11, 34, 5);
    ctx.fill();
    ctx.fillStyle = KIT.piping;
    ctx.fillRect(sx < 0 ? -36 : 25, 7, 11, 1.2);
  }
  ctx.fillStyle = KIT.skin;
  ctx.beginPath();
  ctx.ellipse(-4, 12, 6, 4, 0.2, 0, Math.PI * 2);
  ctx.ellipse(4, 12, 6, 4, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // ---- the shirt and tie in the V of the jacket
  ctx.fillStyle = KIT.shirt;
  ctx.beginPath();
  ctx.moveTo(-10, -28);
  ctx.lineTo(10, -28);
  ctx.lineTo(0, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = KIT.shirtShade;
  ctx.beginPath();
  ctx.moveTo(-10, -28);
  ctx.lineTo(-6, -28);
  ctx.lineTo(0, -6);
  ctx.closePath();
  ctx.fill();
  // collar points
  ctx.fillStyle = KIT.shirt;
  ctx.beginPath();
  ctx.moveTo(-8, -30);
  ctx.lineTo(-1, -26);
  ctx.lineTo(-6, -23);
  ctx.closePath();
  ctx.moveTo(8, -30);
  ctx.lineTo(1, -26);
  ctx.lineTo(6, -23);
  ctx.closePath();
  ctx.fill();
  // the tie: a knot and a blade
  ctx.fillStyle = KIT.tieDark;
  ctx.beginPath();
  ctx.moveTo(-2.4, -27);
  ctx.lineTo(2.4, -27);
  ctx.lineTo(1.8, -23.5);
  ctx.lineTo(-1.8, -23.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = KIT.tie;
  ctx.beginPath();
  ctx.moveTo(-1.8, -23.5);
  ctx.lineTo(1.8, -23.5);
  ctx.lineTo(3, -10);
  ctx.lineTo(0, -7);
  ctx.lineTo(-3, -10);
  ctx.closePath();
  ctx.fill();

  // ---- lapels, piped in gold
  ctx.fillStyle = KIT.jacketDark;
  ctx.strokeStyle = KIT.piping;
  ctx.lineWidth = 0.9;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 10, -28);
    ctx.lineTo(sx * 15, -25);
    ctx.lineTo(sx * 11, -18);
    ctx.lineTo(sx * 13, -16);
    ctx.lineTo(sx * 1.5, -5);
    ctx.lineTo(sx * 2, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // two gold buttons below the V
  for (const by of [0, 7]) {
    ctx.fillStyle = KIT.piping;
    ctx.beginPath();
    ctx.arc(0, by, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = KIT.pipingHi;
    ctx.beginPath();
    ctx.arc(-0.4, by - 0.4, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // the breast pocket and its square
  ctx.fillStyle = KIT.jacketShade;
  ctx.fillRect(14, -14, 9, 1.2);
  ctx.fillStyle = KIT.shirt;
  ctx.beginPath();
  ctx.moveTo(15.5, -14);
  ctx.lineTo(17.5, -16.5);
  ctx.lineTo(19.5, -14);
  ctx.closePath();
  ctx.fill();

  // ---- a lily on the lapel
  ctx.save();
  ctx.translate(-12, -19);
  ctx.fillStyle = KIT.lily;
  for (const a of [-0.9, 0, 0.9]) {
    ctx.beginPath();
    ctx.ellipse(Math.sin(a) * 2.2, -Math.cos(a) * 2.2, 1.2, 2.4, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = KIT.lilyDeep;
  ctx.beginPath();
  ctx.arc(0, 0, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- the brass name badge
  ctx.save();
  ctx.translate(-17, -9);
  ctx.fillStyle = KIT.badge;
  ctx.beginPath();
  roundRect(ctx, -6, -2.6, 12, 5.2, 1.2);
  ctx.fill();
  ctx.fillStyle = KIT.pipingHi;
  ctx.fillRect(-5.5, -2.2, 11, 0.8);
  ctx.fillStyle = KIT.badgeInk;
  ctx.fillRect(-4, -0.2, 8, 0.8);
  ctx.fillRect(-3, 1.2, 6, 0.6);
  ctx.restore();

  // ---- neck
  ctx.fillStyle = KIT.skinShade;
  ctx.beginPath();
  roundRect(ctx, -6, -35, 12, 8, 3);
  ctx.fill();

  // ---- head: a longer, composed face
  ctx.fillStyle = KIT.skin;
  ctx.beginPath();
  ctx.ellipse(0, -46, 15, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -46, 15, 18, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = KIT.skinShade;
  ctx.fillRect(-15, -66, 4, 40);
  ctx.restore();
  // ears
  ctx.fillStyle = KIT.skin;
  ctx.beginPath();
  ctx.ellipse(-15, -45, 2.6, 4.2, 0, 0, Math.PI * 2);
  ctx.ellipse(15, -45, 2.6, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- hair: dark, side-parted, combed flat with a sheen
  ctx.fillStyle = KIT.hair;
  ctx.beginPath();
  ctx.moveTo(-16, -46);
  ctx.quadraticCurveTo(-17, -63, -2, -65);
  ctx.quadraticCurveTo(15, -66, 16, -48);
  ctx.lineTo(13, -52);
  ctx.quadraticCurveTo(4, -58, -5, -56);
  ctx.lineTo(-13, -52);
  ctx.closePath();
  ctx.fill();
  // the parting, and the comb lines
  ctx.strokeStyle = KIT.hairHi;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6, -64);
  ctx.quadraticCurveTo(-7, -60, -6, -56.5);
  ctx.moveTo(-1, -63);
  ctx.quadraticCurveTo(8, -62, 13, -55);
  ctx.moveTo(2, -60);
  ctx.quadraticCurveTo(9, -59, 12, -53);
  ctx.stroke();
  // sideburns
  ctx.fillStyle = KIT.hair;
  ctx.fillRect(-15, -50, 2.4, 6);
  ctx.fillRect(12.6, -50, 2.4, 6);

  // ---- eyes and brows: attentive, calm
  ctx.fillStyle = KIT.ink;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * 6, -45, 1.6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * 6 + 0.5, -45.7, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = KIT.hair;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-9.5, -50);
  ctx.quadraticCurveTo(-6, -51.4, -2.8, -50.4);
  ctx.moveTo(2.8, -50.4);
  ctx.quadraticCurveTo(6, -51.4, 9.5, -50);
  ctx.stroke();
  // nose
  ctx.strokeStyle = KIT.skinShade;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -44);
  ctx.quadraticCurveTo(2.2, -39.5, 0, -39);
  ctx.stroke();

  // ---- the mouth: a polite half-smile, or open as he speaks
  if (pose === 'talk') {
    ctx.fillStyle = KIT.mouth;
    ctx.beginPath();
    ctx.ellipse(0, -34, 3.6, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = KIT.shirt;
    ctx.fillRect(-2.4, -35.6, 4.8, 0.9);
  } else {
    ctx.strokeStyle = KIT.mouth;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-4, -34.6);
    ctx.quadraticCurveTo(0, -32.6, 4, -34.6);
    ctx.stroke();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}
