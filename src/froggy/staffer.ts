/**
 * The kid on the prize counter.
 *
 * After the night, somebody else stands where Froggy leaned.  He is drawn the
 * way the dealer in the casino is drawn -- the same vector paths on the same
 * unfiltered overlay, the same 320x180 logical space and the same cartoon drop
 * shadow -- because that is the quality a PERSON in this building is drawn at.
 * But he is not the dealer in a different shirt.  The dealer is narrow,
 * buttoned-up and still; this is a young man in the arcade's own uniform who
 * slouches, grins, and plainly thinks the whole job is a bit of a laugh:
 *
 *   - a purple FROGGY ARCADE polo with a teal collar and piping, short
 *     sleeves, a green frog on the chest pocket and a name badge
 *   - a pink cap on backwards
 *   - untidy ginger hair out from under it, freckles, round glasses
 *   - a lanyard, with nothing on the hook -- the missing key
 *   - one eyebrow up and a crooked smirk: he is joking with you
 *
 * Only his top half is ever seen over the counter, so that is where all of
 * that lives.
 */

export type StafferPose = 'idle' | 'talk';

export interface StafferDrawOpts {
  x: number;
  y: number;
  /** Height in logical pixels, sole of shoe to top of head. */
  height: number;
  pose?: StafferPose;
  /** 0..1, drives a slouchy sway -- more of it than the dealer allows himself. */
  bounce?: number;
  alpha?: number;
  /**
   * His right forearm laid along the counter top instead of hanging behind
   * it, the hand near the end of the counter: the lean of somebody who has
   * been stood there all shift.  The counter top is his `y`-less design line
   * 0 to 7 (see ArcadeHub's STAFFER_FEET), so that is where the arm lies.
   */
  restArm?: boolean;
}

const KIT = {
  polo: '#6B3FC4',
  poloDark: '#4E2C94',
  poloShade: '#3A2170',
  trim: '#46C4BD',
  trimDark: '#2D8E89',
  frog: '#6FBB6A',
  frogDark: '#3F7E3B',
  badge: '#F4EEDC',
  badgeInk: '#2B303C',
  lanyard: '#FFD45E',
  cap: '#FF4FA3',
  capDark: '#C2357A',
  skin: '#E2BC98',
  skinShade: '#B98E6B',
  freckle: '#B7775A',
  hair: '#B5562B',
  hairDark: '#7E3A1C',
  glass: '#1D1F26',
  lens: 'rgba(200, 225, 255, 0.28)',
  ink: '#15131A',
  mouth: '#6A2E26',
  shadow: '#0D1017',
  trousers: '#262A33',
  shoe: '#15171D',
};

/** The design space Froggy and the dealer share: x -60..60, y -62..52. */
const DESIGN_H = 114;

export function drawStaffer(ctx: CanvasRenderingContext2D, o: StafferDrawOpts): void {
  const pose = o.pose ?? 'idle';
  const s = o.height / DESIGN_H;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(o.x, o.y);
  ctx.scale(s, s);
  ctx.translate(0, -50);
  drawHim(ctx, pose, o.bounce ?? 0, o.restArm ?? false);
  lightHim(ctx);
  ctx.restore();
}

/** The counter's lamp across his head and shoulders, the same way the dealer is lit. */
function lightHim(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(0, -66, 0, 52);
  g.addColorStop(0, 'rgba(255, 220, 170, 0.22)');
  g.addColorStop(0.25, 'rgba(255, 210, 150, 0.08)');
  g.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(10, 6, 14, 0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(-60, -70, 120, 122);
  ctx.restore();
}

function drawHim(ctx: CanvasRenderingContext2D, pose: StafferPose, bounce: number, restArm: boolean): void {
  // A slouch that comes and goes: he shifts his weight, the dealer never does.
  const sway = Math.sin(bounce * Math.PI * 2);
  ctx.translate(sway * 0.8, Math.abs(sway) * 0.6);
  ctx.rotate(sway * 0.012);

  // ---- drop shadow, the house style
  ctx.save();
  ctx.translate(5, 5);
  ctx.fillStyle = KIT.shadow;
  ctx.beginPath();
  ctx.ellipse(0, -44, 17, 20, 0, 0, Math.PI * 2);
  roundRect(ctx, -34, -28, 68, 44, 10);
  roundRect(ctx, -22, 12, 44, 38, 4);
  ctx.fill();
  ctx.restore();

  // ---- legs and shoes (behind the counter, but drawn: he is a whole person)
  ctx.fillStyle = KIT.shoe;
  ctx.beginPath();
  roundRect(ctx, -22, 41, 20, 9, 4);
  roundRect(ctx, 2, 41, 22, 9, 4);
  ctx.fill();
  ctx.fillStyle = KIT.trousers;
  ctx.beginPath();
  roundRect(ctx, -21, 12, 19, 31, 4);
  roundRect(ctx, 2, 12, 19, 31, 4);
  ctx.fill();

  // ---- the polo: rounder shoulders than the dealer's jacket, and a slouch
  ctx.fillStyle = KIT.polo;
  ctx.beginPath();
  ctx.moveTo(-31, -14);
  ctx.quadraticCurveTo(-33, -25, -20, -28);
  ctx.lineTo(20, -28);
  ctx.quadraticCurveTo(33, -25, 31, -14);
  ctx.lineTo(27, 16);
  ctx.lineTo(-27, 16);
  ctx.closePath();
  ctx.fill();
  // the side away from the lamp
  ctx.fillStyle = KIT.poloDark;
  ctx.beginPath();
  ctx.moveTo(-31, -14);
  ctx.quadraticCurveTo(-33, -25, -20, -28);
  ctx.lineTo(-16, -28);
  ctx.lineTo(-20, 16);
  ctx.lineTo(-27, 16);
  ctx.closePath();
  ctx.fill();

  // short sleeves with teal piping, and bare forearms hanging down behind
  // the counter
  for (const sx of [-1, 1]) {
    ctx.fillStyle = KIT.poloShade;
    ctx.beginPath();
    roundRect(ctx, sx < 0 ? -40 : 28, -24, 12, 17, 5);
    ctx.fill();
    ctx.fillStyle = KIT.trim;
    ctx.beginPath();
    roundRect(ctx, sx < 0 ? -40 : 28, -9, 12, 3, 1.5);
    ctx.fill();
    ctx.fillStyle = KIT.skin;
    ctx.beginPath();
    if (sx > 0 && restArm) {
      // down from the sleeve to the elbow on the counter's back edge, and the
      // forearm along the top of it, out towards the end
      roundRect(ctx, 30, -6, 9, 10, 4);
      ctx.fill();
      ctx.fillStyle = KIT.skinShade;
      ctx.beginPath();
      roundRect(ctx, 30, 0, 14, 7, 3);
      ctx.fill();
      ctx.fillStyle = KIT.skin;
      ctx.beginPath();
      roundRect(ctx, 30, -0.5, 14, 5, 2.5);
      // the hand, resting flat, fingers towards the end of the counter
      ctx.ellipse(46, 2.5, 5, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = KIT.skinShade;
      ctx.fillRect(43, 4.2, 7, 1);
      continue;
    }
    roundRect(ctx, sx < 0 ? -38 : 30, -6, 9, 22, 4);
    ctx.fill();
  }

  // the placket, three buttons, and the collar in teal
  ctx.fillStyle = KIT.poloShade;
  ctx.beginPath();
  roundRect(ctx, -3, -26, 6, 16, 2);
  ctx.fill();
  ctx.fillStyle = KIT.badge;
  for (const by of [-22, -17, -12]) {
    ctx.beginPath();
    ctx.arc(0, by, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = KIT.trim;
  ctx.beginPath();
  ctx.moveTo(-13, -29);
  ctx.lineTo(-3, -24);
  ctx.lineTo(-6, -19);
  ctx.lineTo(-15, -25);
  ctx.closePath();
  ctx.moveTo(13, -29);
  ctx.lineTo(3, -24);
  ctx.lineTo(6, -19);
  ctx.lineTo(15, -25);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = KIT.trimDark;
  ctx.fillRect(-31, -15, 2, 30);

  // the lanyard round his neck, with an empty clip at the bottom
  ctx.strokeStyle = KIT.lanyard;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-8, -28);
  ctx.quadraticCurveTo(-9, -12, -2, -4);
  ctx.moveTo(8, -28);
  ctx.quadraticCurveTo(9, -12, 2, -4);
  ctx.stroke();
  ctx.strokeStyle = '#9AA3B2';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, -2, 2.2, 0, Math.PI * 2);
  ctx.stroke();

  // ---- the frog on the pocket: the logo, a green face with two eyes
  ctx.fillStyle = KIT.frog;
  ctx.beginPath();
  ctx.ellipse(-15, -16, 6, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-18, -20, 2.4, 0, Math.PI * 2);
  ctx.arc(-12, -20, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = KIT.badge;
  ctx.beginPath();
  ctx.arc(-18, -20, 1.3, 0, Math.PI * 2);
  ctx.arc(-12, -20, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = KIT.ink;
  ctx.beginPath();
  ctx.arc(-18, -20, 0.6, 0, Math.PI * 2);
  ctx.arc(-12, -20, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = KIT.frogDark;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(-15, -16, 2.5, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // ---- the name badge on the other side, pinned a little crooked
  ctx.save();
  ctx.translate(15, -18);
  ctx.rotate(-0.08);
  ctx.fillStyle = KIT.badge;
  ctx.beginPath();
  roundRect(ctx, -7, -4, 14, 8, 1.5);
  ctx.fill();
  ctx.fillStyle = KIT.cap;
  ctx.fillRect(-7, -4, 14, 2.2);
  ctx.fillStyle = KIT.badgeInk;
  ctx.fillRect(-5, 0, 10, 1);
  ctx.fillRect(-5, 2, 6, 1);
  ctx.restore();

  // ---- neck
  ctx.fillStyle = KIT.skinShade;
  ctx.beginPath();
  roundRect(ctx, -7, -34, 14, 9, 3);
  ctx.fill();

  // ---- head: rounder and younger than the dealer's long face
  ctx.fillStyle = KIT.skin;
  ctx.beginPath();
  ctx.ellipse(0, -45, 17, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -45, 17, 18, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = KIT.skinShade;
  ctx.fillRect(-17, -64, 5, 40);
  ctx.restore();
  // ears
  ctx.fillStyle = KIT.skin;
  ctx.beginPath();
  ctx.ellipse(-17, -44, 3, 4.5, 0, 0, Math.PI * 2);
  ctx.ellipse(17, -44, 3, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- hair: untidy, sticking out from under the cap at the sides and the
  // front, where a backwards cap leaves it
  ctx.fillStyle = KIT.hair;
  ctx.beginPath();
  ctx.moveTo(-17, -50);
  ctx.lineTo(-20, -44);
  ctx.lineTo(-15, -46);
  ctx.lineTo(-16, -40);
  ctx.lineTo(-12, -47);
  ctx.closePath();
  ctx.moveTo(17, -50);
  ctx.lineTo(20, -45);
  ctx.lineTo(15, -46);
  ctx.lineTo(16, -41);
  ctx.lineTo(12, -47);
  ctx.closePath();
  ctx.fill();
  // the fringe poking out under the band, over the forehead
  ctx.beginPath();
  ctx.moveTo(-11, -56);
  ctx.lineTo(-7, -50);
  ctx.lineTo(-4, -55);
  ctx.lineTo(0, -49);
  ctx.lineTo(3, -55);
  ctx.lineTo(7, -50);
  ctx.lineTo(10, -56);
  ctx.closePath();
  ctx.fill();

  // ---- the cap, on backwards: the crown, the band, and the peak sticking
  // out over the back of his head
  ctx.fillStyle = KIT.cap;
  ctx.beginPath();
  ctx.ellipse(0, -58, 17.5, 10, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = KIT.capDark;
  ctx.beginPath();
  roundRect(ctx, -17.5, -59, 35, 4, 2);
  ctx.fill();
  // the peak, at the back, seen past his right ear
  ctx.beginPath();
  ctx.moveTo(12, -62);
  ctx.quadraticCurveTo(26, -63, 27, -58);
  ctx.lineTo(14, -57);
  ctx.closePath();
  ctx.fill();
  // the button on top, and a little frog on the band
  ctx.fillStyle = KIT.capDark;
  ctx.beginPath();
  ctx.arc(0, -68, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = KIT.frog;
  ctx.beginPath();
  ctx.arc(-6, -64, 2.6, 0, Math.PI * 2);
  ctx.fill();

  // ---- round glasses
  ctx.strokeStyle = KIT.glass;
  ctx.lineWidth = 1.3;
  for (const sx of [-1, 1]) {
    ctx.fillStyle = KIT.lens;
    ctx.beginPath();
    ctx.arc(sx * 6.8, -45, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-2.2, -45.5);
  ctx.lineTo(2.2, -45.5);
  ctx.moveTo(-11.4, -46);
  ctx.lineTo(-16, -47);
  ctx.moveTo(11.4, -46);
  ctx.lineTo(16, -47);
  ctx.stroke();

  // ---- eyes behind them, and one eyebrow up: he thinks you are joking
  ctx.fillStyle = KIT.ink;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * 6.8, -44.6, 1.7, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = KIT.hairDark;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(-10.5, -51);
  ctx.quadraticCurveTo(-7, -52.4, -3.5, -51.2);
  ctx.moveTo(3.5, -52.6);
  ctx.quadraticCurveTo(7, -55.4, 10.5, -53.6);
  ctx.stroke();

  // ---- freckles over the nose
  ctx.fillStyle = KIT.freckle;
  for (const [fx, fy] of [
    [-5, -39],
    [-3, -38],
    [-6.5, -37.5],
    [5, -39],
    [3, -38],
    [6.5, -37.6],
  ]) {
    ctx.beginPath();
    ctx.arc(fx, fy, 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // nose
  ctx.strokeStyle = KIT.skinShade;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(0, -43);
  ctx.quadraticCurveTo(2.4, -38.5, 0, -38);
  ctx.stroke();

  // ---- the mouth: a crooked smirk, or open mid-joke
  if (pose === 'talk') {
    ctx.fillStyle = KIT.mouth;
    ctx.beginPath();
    ctx.ellipse(1.5, -33, 5, 2.8, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = KIT.badge;
    ctx.fillRect(-2, -35.2, 6, 1.1);
  } else {
    ctx.strokeStyle = KIT.mouth;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-5, -33.6);
    ctx.quadraticCurveTo(1, -32.2, 6, -35);
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
