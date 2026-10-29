/**
 * ---- THE SCREENS, PLAYING.
 *
 * Every cabinet's glass runs a little loop of its own game, the way the
 * CREATURE CLASH upright's does (art/loungeProps): not a still picture but
 * the thing itself going on -- a fly zigzagging past a pad, barrels rolling
 * down girders, reels spinning and stopping one by one.
 *
 * ONLY THE PICTURE MOVES.  The cabinet round it -- its shell, marquee, bezel,
 * glass and colours -- is drawn exactly as before by `Cabinet`; this draws on
 * the screen it already has, in the screen's own two inks (dark and cream)
 * over the machine's colour, and the scanlines and glare are still laid over
 * the top of it.
 *
 * The glass is FOURTEEN PIXELS BY TEN.  Everything here is whole pixels on
 * that grid and is clipped to it (`px`), so nothing can ever spill onto the
 * bezel, and each loop is a few rectangles a frame: one Graphics per machine,
 * redrawn eight times a second.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import type { Motif } from '../game/content';

export const SCREEN_W = 14;
export const SCREEN_H = 10;
/** How often a screen moves on a frame, in ms.  Eight a second reads as arcade. */
const FRAME_MS = 125;

type Px = (x: number, y: number, w?: number, h?: number, col?: number, a?: number) => void;

/**
 * Start `motif` playing on the screen whose top-left pixel is (x0, y0).  The
 * loop belongs to the scene's clock, so it stops when the room does.
 */
export function playScreen(scene: Phaser.Scene, x0: number, y0: number, motif: Motif | undefined, depth: number, seed = 0): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  const ink = PALETTE.ink;
  const px: Px = (x, y, w = 1, h = 1, col = ink, a = 1) => {
    // clipped to the glass, on whole pixels
    let X = Math.round(x);
    let Y = Math.round(y);
    let W = Math.round(w);
    let H = Math.round(h);
    if (X < 0) (W += X), (X = 0);
    if (Y < 0) (H += Y), (Y = 0);
    W = Math.min(W, SCREEN_W - X);
    H = Math.min(H, SCREEN_H - Y);
    if (W <= 0 || H <= 0) return;
    g.fillStyle(col, a).fillRect(x0 + X, y0 + Y, W, H);
  };
  // (machines side by side do not run in lock-step)
  let t = Math.floor(seed) % 997;
  const draw = LOOPS[motif ?? ''] ?? LOOPS.default;
  const frame = (): void => {
    g.clear();
    draw(px, t);
    t++;
  };
  frame();
  scene.time.addEvent({ delay: FRAME_MS, loop: true, callback: frame });
  return g;
}

const C = PALETTE.cream;
const K = PALETTE.ink;
const B = PALETTE.bone;
/** A triangle wave 0..n..0 over 2n frames. */
const tri = (t: number, n: number) => {
  const m = t % (2 * n);
  return m < n ? m : 2 * n - m;
};

const LOOPS: Record<string, (px: Px, t: number) => void> = {
  // MINI DUELS: two blades swing in and meet in the middle with a spark
  grid: (px, t) => {
    const k = tri(t, 5); // 0 apart .. 5 crossed
    px(0, 9, 14, 1, K);
    for (let i = 0; i < 4; i++) {
      px(1 + i + Math.floor(k / 2), 7 - i, 1, 1, C);
      px(12 - i - Math.floor(k / 2), 7 - i, 1, 1, C);
    }
    px(0 + Math.floor(k / 2), 8, 2, 1, K);
    px(12 - Math.floor(k / 2), 8, 2, 1, K);
    if (k >= 4) {
      px(6, 3, 2, 2, C);
      px(5, 2, 1, 1, C);
      px(8, 2, 1, 1, C);
      px(5, 5, 1, 1, C);
      px(8, 5, 1, 1, C);
    }
  },
  // CHUBBY CHOMP: a fly zigzags overhead; the tongue flicks up off the pad and takes it
  chomp: (px, t) => {
    const cyc = t % 24;
    px(6, 8, 8, 2, C);
    px(7, 7, 5, 1, C);
    px(9, 7, 1, 1, K);
    const fx = cyc < 16 ? 1 + ((cyc * 3) % 12) : 9;
    const fy = cyc < 16 ? 2 + (cyc % 2) : 2;
    if (cyc < 18) {
      px(fx - 1, fy - 1, 1, 1, C);
      px(fx + 1, fy - 1, 1, 1, C);
      px(fx, fy, 1, 1, K);
    }
    if (cyc >= 15 && cyc < 19) {
      const reach = (cyc - 14) * 2;
      px(9, 7 - reach, 1, reach, K);
    }
    if (cyc >= 18 && cyc < 21) px(8, 4, 3, 1, C);
  },
  // WHACK-A-FROG: heads pop up out of three holes and the mallet comes down on one
  mallet: (px, t) => {
    for (const hx of [1, 6, 11]) px(hx, 8, 3, 1, K);
    const cyc = t % 9;
    const hole = Math.floor(t / 9) % 3;
    const hx = [1, 6, 11][(hole * 2) % 3];
    if (cyc >= 1 && cyc < 7) {
      const up = cyc < 3 ? cyc : cyc > 5 ? 7 - cyc : 3;
      px(hx, 8 - up, 3, up, C);
      if (up >= 2) px(hx, 8 - up, 1, 1, K), px(hx + 2, 8 - up, 1, 1, K);
    }
    const drop = cyc === 5 ? 3 : cyc === 4 ? 1 : 0;
    px(hx - 1, 0 + drop, 5, 2, C);
    px(hx + 1, 2 + drop, 1, 2, K);
    if (cyc === 5) px(hx - 2, 4, 1, 1, C), px(hx + 4, 4, 1, 1, C);
  },
  // BOWLING: the ball rolls up the lane and the pins go over
  pins: (px, t) => {
    const cyc = t % 16;
    px(0, 9, 14, 1, K);
    const hit = cyc >= 11;
    for (const [i, pxx] of [[0, 4], [1, 7], [2, 10]] as const) {
      if (hit && cyc - 11 >= i % 2) {
        px(pxx - 1 + i, 7, 3, 1, C);
        px(pxx - 1 + i, 6, 1, 1, K);
      } else {
        px(pxx, 3, 1, 5, C);
        px(pxx, 4, 1, 1, K);
      }
    }
    if (!hit) {
      const bx = 1 + cyc * 0.6;
      px(Math.round(bx * 1.0) - 1, 6, 3, 3, K);
    }
  },
  // FROG POND HUNT: ripples spreading off the pads, and a frog hopping pad to pad
  pond: (px, t) => {
    const pads: [number, number][] = [[2, 2], [10, 3], [5, 7]];
    for (const [x, y] of pads) px(x - 1, y, 3, 2, C);
    const r = t % 8;
    const [rx, ry] = pads[Math.floor(t / 8) % 3];
    if (r > 0) {
      px(rx - 1 - r, ry + 1, 1, 1, B, 0.7);
      px(rx + 1 + r, ry + 1, 1, 1, B, 0.7);
      px(rx, ry - r + 1, 1, 1, B, 0.7);
      px(rx, ry + 1 + r, 1, 1, B, 0.7);
    }
    const hop = t % 12;
    const a = pads[Math.floor(t / 12) % 3];
    const b = pads[(Math.floor(t / 12) + 1) % 3];
    const k = Math.min(1, hop / 6);
    const fx = a[0] + (b[0] - a[0]) * k;
    const fy = a[1] + (b[1] - a[1]) * k - Math.sin(Math.PI * k) * 2;
    px(fx, fy - 1, 1, 1, K);
  },
  // GRUDGE: the frog throws a punch, the lizard reels and comes back
  fist: (px, t) => {
    const cyc = t % 10;
    const jab = cyc >= 3 && cyc < 6;
    const reel = cyc >= 4 && cyc < 8 ? 1 : 0;
    px(0, 9, 14, 1, K);
    px(2, 4, 3, 5, C);
    px(3, 3, 2, 1, C);
    px(jab ? 5 : 4, 5, jab ? 3 : 2, 1, C);
    px(9 + reel, 4, 3, 5, K);
    px(9 + reel, 3, 2, 1, K);
    px(8 + reel, 6, 1, 1, K);
    if (cyc === 4 || cyc === 5) px(8, 3, 1, 1, C), px(8, 7, 1, 1, C), px(7, 5, 1, 1, C);
  },
  // BARREL CLIMB: barrels roll down the girders while the frog climbs the ladder
  ladder: (px, t) => {
    px(0, 3, 10, 1, K);
    px(4, 6, 10, 1, K);
    px(0, 9, 14, 1, K);
    px(11, 0, 1, 6, C);
    px(13, 0, 1, 6, C);
    px(11, 2, 3, 1, C);
    px(11, 4, 3, 1, C);
    const b1 = (t % 14) - 2;
    px(b1, 1, 2, 2, C);
    const b2 = 14 - ((t + 7) % 14);
    px(b2, 4, 2, 2, C);
    px(b2 + (t % 2), 4, 1, 1, K);
    const climb = 8 - (Math.floor(t / 2) % 9);
    px(12, Math.max(0, climb - 1), 1, 2, K);
  },
  // AIR HOCKEY: the puck caroms round the table between two mallets
  ball: (px, t) => {
    px(7, 0, 1, 10, B, 0.5);
    const x = tri(t, 11) + 1;
    const y = tri(t * 2 + 3, 7) + 1;
    px(x, y, 2, 2, C);
    const my = Math.max(1, Math.min(7, y));
    px(0, my - 1, 2, 3, K);
    px(12, Math.max(1, Math.min(7, 9 - y)) - 1, 2, 3, K);
  },
  // THE FLOOD: the water rises up the tower and the frog hops up the blocks ahead of it
  blocks: (px, t) => {
    const cyc = t % 40;
    px(1, 7, 4, 3, C);
    px(6, 4, 4, 2, C);
    px(10, 1, 4, 2, C);
    const level = 10 - Math.floor(cyc / 4);
    for (let x = 0; x < 14; x++) px(x, level + ((x + t) % 3 === 0 ? 0 : 1), 1, 10, K, 0.8);
    const spot: [number, number] = cyc < 14 ? [2, 6] : cyc < 26 ? [7, 3] : [11, 0];
    const up = cyc % 12 === 0 ? 1 : 0;
    px(spot[0], spot[1] - up, 2, 1, K);
  },
  // DANCE OFF: arrows scroll up to the target row and flash as they are hit
  steps: (px, t) => {
    for (const lx of [1, 5, 9]) px(lx, 1, 3, 1, B, 0.8);
    for (let i = 0; i < 3; i++) {
      const lane = (i * 2 + Math.floor((t + i * 4) / 12)) % 3;
      const lx = [1, 5, 9][lane];
      const y = 10 - ((t + i * 4) % 12);
      if (y <= 1) {
        px(lx - 1, 0, 5, 3, C);
        continue;
      }
      px(lx + 1, y, 1, 1, C);
      px(lx, y + 1, 3, 1, C);
      px(lx + 1, y + 2, 1, 1, K);
    }
  },
  // FROG CROSS: cars stream both ways and the frog hops up through the gaps
  road: (px, t) => {
    px(0, 2, 14, 1, B, 0.5);
    px(0, 5, 14, 1, B, 0.5);
    px(0, 8, 14, 1, B, 0.5);
    for (let k = 0; k < 2; k++) {
      px(((t + k * 7) % 18) - 3, 3, 3, 2, K);
      px(14 - ((t + k * 9) % 18), 6, 3, 2, K);
    }
    const lane = Math.floor(t / 6) % 4;
    px(6, 9 - lane * 3, 2, 1, C);
    px(6, 8 - lane * 3, 1, 1, C);
  },
  // CAR CHASE: the road scrolls down, the getaway car swerves, the lights come after it
  car: (px, t) => {
    px(1, 0, 1, 10, K);
    px(12, 0, 1, 10, K);
    for (let y = -2; y < 10; y += 4) px(7, y + (t % 4), 1, 2, C);
    const sway = Math.round(Math.sin(t * 0.5) * 2);
    px(5 + sway, 2, 3, 4, C);
    px(5 + sway, 3, 3, 1, K);
    const chase = Math.round(Math.sin(t * 0.5 - 1.2) * 2);
    px(5 + chase, 7, 3, 3, K);
    px(5 + chase + (t % 2 ? 0 : 2), 7, 1, 1, C);
  },
  // FENCE WARS: something arcs over the fence one way, then back the other
  throw: (px, t) => {
    px(0, 9, 14, 1, K);
    px(6, 4, 2, 5, K);
    px(1, 7, 2, 2, C);
    px(11, 7, 2, 2, B);
    const cyc = t % 24;
    const k = (cyc % 12) / 11;
    const dir = cyc < 12 ? 1 : -1;
    const x = dir > 0 ? 2 + k * 9 : 11 - k * 9;
    const y = 6 - Math.sin(Math.PI * k) * 6;
    px(x, y, 1, 1, C);
    if (cyc % 12 === 11) px(dir > 0 ? 10 : 2, 6, 3, 1, C);
  },
  // FROGGY SLOTS: three reels spin and stop one after another, then flash
  reels: (px, t) => {
    const cyc = t % 30;
    // the payline across all three
    px(0, 4, 1, 2, K);
    px(13, 4, 1, 2, K);
    for (let r = 0; r < 3; r++) {
      const x = 1 + r * 4;
      px(x, 0, 3, 10, C);
      const stopped = cyc > 10 + r * 5;
      if (!stopped) {
        // a blur of symbols streaming down
        for (let y = 0; y < 10; y++) if ((y + t * 2 + r * 3) % 4 < 2) px(x + ((y + r) % 2), y, 2, 1, K, 0.55);
      } else {
        // landed: the same symbol on every reel -- a seven -- and it flashes at the end
        const lit = cyc > 24 && t % 2;
        px(x, 4, 3, 1, lit ? PALETTE.blood : K);
        px(x + 2, 5, 1, 1, lit ? PALETTE.blood : K);
        px(x + 1, 6, 1, 1, lit ? PALETTE.blood : K);
        px(x + 1, 1, 1, 1, K, 0.4);
        px(x + 1, 8, 1, 1, K, 0.4);
      }
    }
  },
  // BLACKJACK: two cards dealt in, turned up, then swept away
  cards: (px, t) => {
    const cyc = t % 20;
    const slide = (start: number) => Math.max(0, Math.min(1, (cyc - start) / 3));
    const a = slide(0);
    const b = slide(4);
    if (cyc < 17) {
      px(1 + (1 - a) * 10, 1 - (1 - a) * 4, 5, 7, B);
      if (a >= 1) px(2, 2, 1, 1, K), px(4, 6, 1, 1, K);
      px(6 + (1 - b) * 6, 2 - (1 - b) * 4, 5, 7, C);
      if (b >= 1) px(7, 3, 1, 1, PALETTE.blood), px(9, 7, 1, 1, PALETTE.blood);
    }
    if (cyc >= 9 && cyc < 15 && t % 2) px(0, 9, 14, 1, C);
  },
  // THE WHEEL: the spokes turn, slowing and starting again
  wheel: (px, t) => {
    const cyc = t % 32;
    const ang = (cyc < 24 ? cyc * cyc * 0.02 : 24 * 24 * 0.02) + Math.floor(t / 32) * 1.3;
    for (let r = 1; r <= 4; r++)
      for (const a of [ang, ang + Math.PI / 2, ang + Math.PI, ang + Math.PI * 1.5]) px(7 + Math.cos(a) * r, 5 + Math.sin(a) * r, 1, 1, C);
    px(6, 4, 2, 2, K);
    px(7, 0, 1, 1, K);
  },
  // CHAMBER: the cylinder turns a chamber at a time
  chamber: (px, t) => {
    const step = Math.floor(t / 3);
    const ease = (t % 3) / 3;
    for (let i = 0; i < 6; i++) {
      const a = ((i + step + ease) / 6) * Math.PI * 2;
      const x = 7 + Math.cos(a) * 3.6;
      const y = 5 + Math.sin(a) * 3.6;
      px(x - 0.5, y - 0.5, 2, 2, i === 0 ? K : C);
    }
    px(6, 4, 2, 2, K);
  },
  // FROG RACE: three frogs bound along the lanes for the chequered line
  race: (px, t) => {
    for (let y = 0; y < 10; y += 2) px(12, y, 1, 1, (y + Math.floor(t / 2)) % 4 ? C : K), px(13, y + 1, 1, 1, (y + Math.floor(t / 2)) % 4 ? K : C);
    for (let lane = 0; lane < 3; lane++) {
      const speed = [1, 0.8, 0.9][lane];
      const x = ((t * speed + lane * 3) % 13) - 1;
      const hop = (Math.floor(t + lane) % 4) < 2 ? 1 : 0;
      px(x, 1 + lane * 3 - hop, 2, 2, lane === 0 ? C : B);
    }
  },
  // FROGSTER MASH: two swords strike across under the crown, and it glints
  mash: (px, t) => {
    const cyc = t % 12;
    const k = tri(cyc, 3);
    for (let i = 0; i < 6; i++) {
      px(2 + i + k, 9 - i, 1, 1, K);
      px(11 - i - k, 9 - i, 1, 1, K);
    }
    px(3, 1, 8, 2, C);
    px(3, 0, 1, 1, C);
    px(7, 0, 1, 1, C);
    px(10, 0, 1, 1, C);
    if (cyc === 6) px(6, 4, 2, 1, C), px(7, 3, 1, 3, C);
    if (t % 8 === 0) px(5, 1, 1, 1, K);
  },
  // PAD BATTLES: a grid of pads, one flashing and gone, frogs hopping between
  pads: (px, t) => {
    const gone = Math.floor(t / 6) % 12;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 4; c++) {
        const i = r * 4 + c;
        if (i === gone && t % 6 > 3) continue;
        px(1 + c * 3.2, 1 + r * 3, 2, 2, i === gone && t % 2 ? K : C);
      }
    px(1 + ((t / 2) % 4) * 3.2, 0.5, 1, 1, B);
    px(10 - ((t / 3) % 4) * 3.2, 6.5, 1, 1, K);
  },
  // CROAKED: the frog gulps its way round a little maze after the tadpole
  maze: (px, t) => {
    px(0, 0, 14, 1, B);
    px(0, 9, 14, 1, B);
    px(4, 3, 6, 1, B);
    px(4, 6, 6, 1, B);
    const loop = [[1, 1], [12, 1], [12, 7], [1, 7]];
    const at = (s: number): [number, number] => {
      const p = s % 38;
      if (p < 11) return [loop[0][0] + p, 1];
      if (p < 19) return [12, 1 + ((p - 11) * 6) / 8];
      if (p < 30) return [12 - (p - 19), 7];
      return [1, 7 - ((p - 30) * 6) / 8];
    };
    const [rx, ry] = at(t * 0.7 + 9);
    px(rx, ry, 1, 1, C);
    const [fx, fy] = at(t * 0.7);
    px(fx, fy, 2, 2, K);
    if (t % 4 < 2) px(fx + 1, fy, 1, 1, B);
  },
  // BOG BALL: a frog flies in off the slingshot, the mud ball rolls into the arch
  bog: (px, t) => {
    const cyc = t % 18;
    px(13, 3, 1, 4, B);
    px(12, 2, 2, 1, K);
    px(12, 7, 2, 1, K);
    const hit = 8;
    const fx = cyc < hit ? 1 + cyc * 0.6 : 1 + hit * 0.6 - (cyc - hit) * 0.2;
    px(fx, 6, 2, 2, C);
    px(fx + 1, 6, 1, 1, K);
    const bx = cyc < hit ? 7 : Math.min(12, 7 + (cyc - hit) * 0.7);
    const by = cyc < hit ? 5 : 5 - Math.min(1, (cyc - hit) * 0.15);
    px(bx - 1, by - 1, 3, 3, K);
    px(bx - 1, by - 1, 1, 1, C);
    if (bx >= 12 && t % 2) px(12, 3, 2, 4, C, 0.6);
  },
  default: (px, t) => {
    px(t % 14, 4, 2, 2, C);
  },
};
