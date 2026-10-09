/**
 * Arcade cabinet.  PRD §7.5: glowing marquee, floating cost badge that greys
 * out when the player can't afford it.
 */

import Phaser from 'phaser';
import { PALETTE, nightify } from '../render/palette';
import type { CabinetDef } from '../game/content';
import { centerText } from '../core/ui';
import { depthFor } from './player';
import { grain, seeded, tone } from './surface';

/** 22 wide: a cabinet about 0.75 m across beside the 26-pixel drifter. */
export const CAB_W = 22;
/**
 * 30 high against a 26-pixel man: about 1.9 m to the top of the marquee, which
 * is what a stand-up cabinet measures.  It used to be 36 -- 2.4 m of machine.
 */
export const CAB_H = 30;

/**
 * The screen a motif is drawn on, as offsets from the motif's own centre.
 * Anything outside this is drawn over the bezel or over the room behind it,
 * which reads as a glitch rather than as art.
 */
const SCREEN_HW = (CAB_W - 8) / 2; // 7
const SCREEN_HH = 5;
/**
 * The motifs are laid out on the old eighteen-by-fourteen glass; this brings
 * every one of them down to the smaller tube in one place, so the pictures
 * keep their proportions and stay inside the screen.
 */
const MS = 0.72;

/**
 * The picture on a machine's screen.  A handful of rectangles each, drawn in
 * the cabinet's own colours — enough that a player crossing the room knows
 * which machine is which without reading a single marquee.
 *
 * EVERY PART OF A MOTIF HAS TO FIT THE SCREEN.  The frog race's lead frog used
 * to be a radius-3 circle centred three pixels above the glass, so a pale disc
 * sat on the bezel of every FROG RACE cabinet in the arcade.  `put` and `dot`
 * now measure themselves in DEV, so the next one is caught the first time it is
 * drawn rather than in a screenshot.
 */
function drawMotif(scene: Phaser.Scene, cx: number, cy: number, def: CabinetDef, depth: number): void {
  const ink: number = PALETTE.ink;
  const bright: number = PALETTE.cream;
  const fits = (dx: number, dy: number, hw: number, hh: number) => {
    if (!import.meta.env?.DEV) return;
    if (Math.abs(dx) + hw > SCREEN_HW + 0.01 || Math.abs(dy) + hh > SCREEN_HH + 0.01) {
      console.warn(
        `[cabinet] the '${def.motif}' motif runs off the screen at (${dx}, ${dy}) ` +
          `±(${hw}, ${hh}); the glass is ±(${SCREEN_HW}, ${SCREEN_HH})`,
      );
    }
  };
  const put = (dx: number, dy: number, w: number, h: number, col: number = ink, alpha = 1) => {
    dx *= MS;
    dy *= MS;
    w = Math.max(1, w * MS);
    h = Math.max(1, h * MS);
    fits(dx, dy, w / 2, h / 2);
    return scene.add.rectangle(cx + dx, cy + dy, w, h, col).setOrigin(0.5, 0.5).setDepth(depth).setAlpha(alpha);
  };
  const dot = (dx: number, dy: number, r: number, col: number = ink) => {
    dx *= MS;
    dy *= MS;
    r = Math.max(0.6, r * MS);
    fits(dx, dy, r, r);
    return scene.add.circle(cx + dx, cy + dy, r, col).setDepth(depth);
  };
  /**
   * A rectangle at an angle, measured by the box it actually covers.
   *
   * Everything else here is axis-aligned, which is fine for a road or a reel
   * and useless for a limb: the one cue that says RUNNING at this size is a leg
   * kicked out on a diagonal.
   */
  const bar = (dx: number, dy: number, w: number, h: number, deg: number, col: number = ink) => {
    dx *= MS;
    dy *= MS;
    w = Math.max(1, w * MS);
    h = Math.max(0.8, h * MS);
    const a = Phaser.Math.DegToRad(deg);
    const hw = (Math.abs(Math.cos(a)) * w + Math.abs(Math.sin(a)) * h) / 2;
    const hh = (Math.abs(Math.sin(a)) * w + Math.abs(Math.cos(a)) * h) / 2;
    fits(dx, dy, hw, hh);
    return scene.add.rectangle(cx + dx, cy + dy, w, h, col).setOrigin(0.5, 0.5).setAngle(deg).setDepth(depth);
  };

  switch (def.motif) {
    // MINI DUELS.  One sword, drawn corner to corner, and nothing else: on a
    // screen this small a single clean shape reads where three crowded ones
    // turned to mush.  Stepped a pixel at a time so it stays crisp.
    case 'grid':
      // in the screen's own two colours, like every other cabinet: blade
      // bright, guard and grip dark, a bright pommel
      for (let k = 0; k <= 5; k++) put(0 + k, -0.5 - k, 2, 2, bright);
      for (let k = -2; k <= 2; k++) put(-1 + k, 0.5 + k, 2, 2, ink);
      put(-2, 1.5, 2, 2, ink);
      put(-3, 2.5, 2, 2, ink);
      put(-4, 3.5, 2, 2, bright);
      break;
    case 'blocks':
      put(-3, 3, 5, 4, bright);
      put(3, 3, 5, 4);
      put(0, -3, 5, 4, bright);
      break;
    case 'ball':
      dot(0, 0, 4, bright);
      put(0, 0, 9, 1);
      put(0, 0, 1, 9);
      break;
    case 'mallet':
      put(2, -3, 8, 4, bright);
      put(-2, 2, 2, 8);
      break;
    case 'ladder':
      put(-2, 0, 1, 12);
      put(3, 0, 1, 12);
      for (let i = -4; i <= 4; i += 4) put(0.5, i, 6, 1);
      break;
    case 'fist':
      put(-3, 0, 5, 5, bright);
      put(3, 0, 5, 5);
      put(0, 0, 3, 1);
      break;
    case 'car':
      put(0, 1, 7, 9, bright);
      put(0, -2, 5, 3);
      break;
    // FROG RACE.  ONE FROG, RUNNING, AND THE LINE IT IS RUNNING AT.
    //
    // The glass is eighteen pixels by fourteen.  Three frogs in three lanes is
    // what the game IS, and at this size it came out as a row of specks — so
    // this draws the thing a player is being sold instead: a frog at full
    // stretch, leg out behind it, speed lines off its back, chequer ahead.
    // One big silhouette reads across a room; three small ones do not.
    case 'race': {
      // the track it is running on
      put(-1, 4.6, 14, 1, ink);
      // speed lines off its back
      put(-6.4, -2.6, 3, 0.8, ink);
      put(-6.6, -0.6, 3.4, 0.8, ink);
      // the back leg kicked out behind, the foot on the end of it, and the
      // front leg reaching — both on a diagonal, which is the whole read
      bar(-4, 2, 4.5, 1.6, -27, bright);
      put(-6.6, 3.4, 2, 1, bright);
      bar(3.5, 2, 3.2, 1.2, 18, bright);
      // body, then the head set up and forward of it so the two circles make a
      // diagonal rather than a loaf
      dot(-0.5, 0.5, 3, bright);
      dot(3, -1.8, 2, bright);
      dot(3.6, -2.5, 0.85, ink);
      // and the line it is running at
      for (let i = -5; i <= 5; i += 2) put(7.5, i, 2, 2, i % 4 === 1 ? bright : ink);
      break;
    }
    // FROGSTER MASH.  A monster bolted together out of six blocks.
    //
    // Two legs, two arms either side, a torso and a head with a pair of eyes
    // on it -- the six parts the game is made of, at the size they fit on an
    // eighteen-by-fourteen screen.  The gaps between them are the point: it
    // reads as ASSEMBLED rather than as one creature.
    case 'mash':
      // A crown over crossed swords.  It used to be the stitched-together
      // monster the game was before the rewrite, which said nothing about a
      // colosseum -- and a bolted animal and a gladiator read as the same
      // grey lump at eighteen by fourteen anyway.  Two shapes, one royal and
      // one violent, is the most this much glass will carry.
      bar(0, 2.5, 11, 1.2, 40);
      bar(0, 2.5, 11, 1.2, -40);
      put(0, -2.4, 9, 2, bright);
      put(-3, -4.8, 1.6, 2.6, bright);
      put(0, -5.2, 1.8, 3.4, bright);
      put(3, -4.8, 1.6, 2.6, bright);
      dot(-3, -2.4, 0.5, ink);
      dot(0, -2.4, 0.5, ink);
      dot(3, -2.4, 0.5, ink);
      break;
    case 'road':
      put(-4, 0, 1, 12);
      put(4, 0, 1, 12);
      for (let i = -4; i <= 4; i += 4) put(0, i, 1, 2, bright);
      break;
    // CHUBBY CHOMP.  A fly on its way to a lily pad.
    //
    // It used to be a big frog face, which at eighteen by fourteen was a
    // cream blob with holes in it.  Three clean shapes instead: the dotted
    // arc of a flick, the fly at the top of it, and the pad it is dropping
    // onto -- the whole game in one glance, and nothing that reads as a face.
    case 'chomp':
      // the pad: flat and wide, the way a pad sits on the water, on whole
      // pixels so it stays a crisp shape at this size
      put(3, 3, 9, 2, bright);
      put(3, 1.5, 7, 1, bright);
      put(5.5, 1.5, 1, 1);
      // the flick: a dotted arc up from the bottom left
      for (const [x, y] of [[-7, 3], [-6, 0], [-4.5, -2], [-2.5, -3.5]] as const) put(x, y, 1, 1, bright);
      // the fly: two cream wings over a dark body
      put(-0.5, -5, 2, 1, bright);
      put(2.5, -5, 2, 1, bright);
      put(1, -3.5, 2, 2);
      break;
    case 'pond':
      // Lily pads on open water, seen from above.  This used to be a hull, a
      // mast and a flag, which put a boat on the front of a cabinet whose
      // game has no boat in it.
      dot(-4, -3, 2.6, bright);
      dot(3, -1, 3, bright);
      dot(-2, 3, 2.2, bright);
      put(4, 4, 6, 1);
      put(2, 6, 4, 1);
      break;
    case 'pins':
      for (const dx of [-4, 0, 4]) put(dx, -2, 2, 6, bright);
      dot(0, 4, 2);
      break;
    case 'cards':
      put(-2, 0, 7, 10, bright);
      put(3, 1, 7, 10, PALETTE.bone);
      break;
    case 'reels':
      for (const dx of [-4, 0, 4]) put(dx, 0, 3, 11, bright);
      break;
    case 'wheel':
      dot(0, 0, 6, bright);
      put(0, 0, 12, 1);
      put(0, 0, 1, 12);
      dot(0, 0, 1.5);
      break;
    case 'chamber':
      dot(0, 0, 5, bright);
      for (let i = 0; i < 6; i++) {
        dot(Math.cos((i / 6) * Math.PI * 2) * 3, Math.sin((i / 6) * Math.PI * 2) * 3, 1);
      }
      break;
    case 'steps':
      put(-4, 3, 4, 3, bright);
      put(0, 0, 4, 3, bright);
      put(4, -3, 4, 3, bright);
      break;
    case 'throw':
      dot(-4, 2, 2, bright);
      dot(0, -2, 1.5, bright);
      dot(4, 2, 2);
      put(0, 4, 12, 1);
      break;
    default:
      break;
  }
}

export class Cabinet {
  readonly def: CabinetDef;
  /** Pointer/interact hit box, so a room can treat any fixture the same way. */
  readonly bounds: Phaser.Geom.Rectangle;
  private marquee: Phaser.GameObjects.Rectangle;
  private badge: Phaser.GameObjects.Container;
  private badgeBox: Phaser.GameObjects.Rectangle;
  private badgeText: Phaser.GameObjects.BitmapText;
  private screen: Phaser.GameObjects.Rectangle;
  private affordable = true;

  constructor(scene: Phaser.Scene, def: CabinetDef, night = false) {
    this.def = def;
    const c = (col: number) => (night ? nightify(col) : col);
    const { x, y } = def;

    this.bounds = new Phaser.Geom.Rectangle(x - (CAB_W + 4) / 2, y - CAB_H - 1, CAB_W + 4, CAB_H + 2);

    // ONE DEPTH FOR THE WHOLE CABINET, on the player's own scale (depthFor),
    // taken at FOUR TENTHS OF ITS HEIGHT: walk up past that line on a machine
    // and it is drawn in front of you, so you are going behind it; below it you
    // are in front of it.  It sat under every depth the player can have, so the
    // player was drawn over the machine whichever side of it they were on.
    const d = depthFor(y - CAB_H * 0.4);

    // ---- the box itself.  Drawn as one Graphics so the whole machine is a
    // single object to sort, with the same finish the player has: a dark
    // outline round the silhouette, lit top edges, shaded undersides, and a
    // pixel of wear here and there -- a physical cabinet, not a coloured box.
    const shell = c(PALETTE.slate);
    const trim = night ? nightify(def.color) : def.color;
    const seed = Math.round(x * 7 + y * 13);
    const rnd = seeded(seed);
    const L = x - CAB_W / 2;
    const T = y - CAB_H;
    const g = scene.add.graphics().setDepth(d);
    // a soft contact shadow on the carpet
    g.fillStyle(0x000000, night ? 0.4 : 0.28).fillEllipse(x + 1, y, CAB_W + 8, 5);
    // outline
    g.fillStyle(c(0x0c0a10), 1).fillRect(L - 1, T - 1, CAB_W + 2, CAB_H + 1);
    // the body, a touch of grain in the laminate
    g.fillStyle(shell, 1).fillRect(L, T, CAB_W, CAB_H);
    grain(g, L + 3, T + 6, CAB_W - 6, CAB_H - 8, shell, seed, 0.06, 0.12);
    // side art panels in the machine's colour, lit on the outer edge, a darker
    // inner edge where the panel meets the front, and a T-moulding strip
    for (const [px, outer] of [[L, true], [L + CAB_W - 3, false]] as const) {
      g.fillStyle(trim, night ? 0.35 : 1).fillRect(px, T, 3, CAB_H);
      g.fillStyle(tone(trim, 0.62), night ? 0.35 : 1).fillRect(outer ? px + 2 : px, T, 1, CAB_H);
      g.fillStyle(tone(trim, 1.45), night ? 0.3 : 0.9).fillRect(outer ? px : px + 2, T, 1, CAB_H);
      // scuffs on the panel, low down where knees and bags catch it
      for (let k = 0; k < 3; k++) {
        g.fillStyle(tone(trim, 1.6), night ? 0.15 : 0.55).fillRect(px + Math.floor(rnd() * 3), y - 6 - Math.floor(rnd() * 10), 1, 1);
      }
    }
    // the plinth and kick plate, worn pale along the front edge
    g.fillStyle(c(PALETTE.ink), 1).fillRect(L - 1, y - 4, CAB_W + 2, 4);
    g.fillStyle(c(0x2a3040), 1).fillRect(L, y - 4, CAB_W, 1);
    for (let k = 0; k < 4; k++) g.fillStyle(c(0x4a5060), 0.8).fillRect(L + 2 + Math.floor(rnd() * (CAB_W - 6)), y - 1, 2, 1);

    // ---- the marquee: a lit box with a highlight along the top and a dark
    // lip where it overhangs the bezel
    this.marquee = scene.add
      .rectangle(x, T + 6, CAB_W - 2, 6, night ? nightify(def.color) : def.color)
      .setOrigin(0.5, 1)
      .setDepth(d);
    if (night) this.marquee.setAlpha(0.25);
    const mq = scene.add.graphics().setDepth(d + 0.00005);
    mq.fillStyle(night ? 0x000000 : tone(def.color, 1.5), night ? 0 : 0.9).fillRect(L + 2, T, CAB_W - 4, 1);
    mq.fillStyle(0x000000, 0.35).fillRect(L + 1, T + 5, CAB_W - 2, 1);
    if (!night) mq.fillStyle(def.color, 0.18).fillRect(L - 2, T - 3, CAB_W + 4, 3); // the glow off its top
    if (!night && def.symbol) {
      centerText(scene, x, T + 3, def.symbol, PALETTE.ink).setDepth(d + 0.0001);
    }

    // ---- the screen, set in a black bezel with a bevelled inner edge, a
    // motif on it, scanlines over that, and the glass catching the light
    g.fillStyle(c(PALETTE.black), 1).fillRect(L + 2, T + 5, CAB_W - 4, 12);
    g.fillStyle(c(0x2a2a34), 1).fillRect(L + 2, T + 5, CAB_W - 4, 1).fillRect(L + 2, T + 5, 1, 12);
    g.fillStyle(c(0x050508), 1).fillRect(L + 3, T + 16, CAB_W - 6, 1);
    this.screen = scene.add
      .rectangle(x, T + 16, CAB_W - 8, 10, night ? PALETTE.black : c(def.color))
      .setOrigin(0.5, 1)
      .setDepth(d);
    this.screen.setAlpha(night ? 1 : 0.85);
    if (!night) {
      drawMotif(scene, x, T + 11, def, d + 0.0001);
      const glass = scene.add.graphics().setDepth(d + 0.0002);
      for (let i = 0; i < 5; i++) glass.fillStyle(PALETTE.black, 0.18).fillRect(L + 4, T + 6 + i * 2, CAB_W - 8, 1);
      // the curve of the tube: darker corners
      glass.fillStyle(PALETTE.black, 0.35);
      for (const [cx, cy] of [[L + 4, T + 6], [L + CAB_W - 5, T + 6], [L + 4, T + 15], [L + CAB_W - 5, T + 15]]) glass.fillRect(cx, cy, 1, 1);
      // a glare streak across the glass, and a hot spot in its top corner
      glass.fillStyle(0xffffff, 0.16).fillTriangle(L + 4, T + 6, L + 9, T + 6, L + 4, T + 11);
      glass.fillStyle(0xffffff, 0.5).fillRect(L + 5, T + 7, 2, 1);
    } else {
      // a dead tube still has a sheen on it
      const glass = scene.add.graphics().setDepth(d + 0.0002);
      glass.fillStyle(0xa0b0d0, 0.08).fillTriangle(L + 4, T + 6, L + 10, T + 6, L + 4, T + 12);
    }

    // ---- the control deck, at hand height for a 26-pixel man: a sloped
    // panel with a lit front lip, a stick and buttons that sit IN it (a dark
    // ring under each) and catch the light
    g.fillStyle(c(PALETTE.steel), 1).fillRect(L, y - 10, CAB_W, 6);
    g.fillStyle(c(tone(PALETTE.steel, 1.3)), 1).fillRect(L, y - 10, CAB_W, 1);
    g.fillStyle(c(0x2a3040), 1).fillRect(L, y - 5, CAB_W, 1);
    grain(g, L + 1, y - 9, CAB_W - 2, 3, c(PALETTE.steel), seed + 1, 0.12, 0.1);
    const parts = scene.add.graphics().setDepth(d + 0.0001);
    // the stick: a dust washer, the shaft, and a ball-top with a highlight
    parts.fillStyle(c(PALETTE.ink), 1).fillEllipse(x - 6, y - 7, 4, 2);
    parts.fillStyle(c(0x6a6e78), 1).fillRect(x - 6.5, y - 10, 1, 3);
    const ball = night ? nightify(PALETTE.blood) : PALETTE.blood;
    parts.fillStyle(tone(ball, 0.6), 1).fillCircle(x - 6, y - 10, 1.8);
    parts.fillStyle(ball, 1).fillCircle(x - 6.3, y - 10.3, 1.4);
    if (!night) parts.fillStyle(0xffffff, 0.8).fillRect(x - 7, y - 11, 1, 1);
    // the buttons, each in a dark collar with a pinprick of light on top
    for (let i = 0; i < 3; i++) {
      const bx = x - 1 + i * 3.5;
      const col = night ? nightify(trim) : [PALETTE.gold, PALETTE.cream, trim][i];
      parts.fillStyle(c(0x101218), 1).fillCircle(bx, y - 7.5, 1.9);
      parts.fillStyle(tone(col, 0.7), 1).fillCircle(bx, y - 7.5, 1.4);
      parts.fillStyle(col, 1).fillCircle(bx - 0.2, y - 7.8, 1.05);
      if (!night) parts.fillStyle(0xffffff, 0.7).fillRect(bx - 1, y - 9, 1, 1);
    }
    // ---- the coin slots, set in the kick plate: lit orange in the day
    for (const sx of [x - 3, x + 1]) {
      g.fillStyle(night ? 0x1a1010 : PALETTE.ember, 1).fillRect(sx, y - 3, 3, 2);
      g.fillStyle(PALETTE.black, 1).fillRect(sx + 1, y - 3, 1, 2);
    }
    // the speaker grille between the screen and the deck
    g.fillStyle(c(tone(PALETTE.slate, 1.25)), 1).fillRect(L + 3, T + 18, CAB_W - 6, 1);

    // floating cost badge
    this.badgeBox = scene.add.rectangle(0, 0, 12, 11, PALETTE.black, 0.75).setStrokeStyle(1, PALETTE.gold);
    this.badgeText = centerText(scene, 0, 0, String(def.cost), PALETTE.gold);
    this.badge = scene.add.container(x, y - CAB_H - 8, [this.badgeBox, this.badgeText]).setDepth(500);
    this.badge.setVisible(!night);

    if (!night) {
      scene.tweens.add({ targets: this.badge, y: y - CAB_H - 10, duration: 1200, yoyo: true, repeat: -1 });
    }
  }

  /** PRD §6.8: greys out when unaffordable. */
  setAffordable(v: boolean): void {
    if (v === this.affordable) return;
    this.affordable = v;
    this.badgeBox.setStrokeStyle(1, v ? PALETTE.gold : PALETTE.steel);
    this.badgeText.setTint(v ? PALETTE.gold : PALETTE.ash);
  }

  distanceTo(x: number, y: number): number {
    return Phaser.Math.Distance.Between(this.def.x, this.def.y - 6, x, y);
  }
}
