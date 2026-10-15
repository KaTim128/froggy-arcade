/**
 * The fourth room's furniture: the two claw machines in its top-left corner.
 *
 * Everything is drawn standing on a floor line (`y` is where its feet are)
 * and y-sorted with the player through `depthFor`, so walking round behind a
 * crane puts you behind it.  After closing the same things stand in the same
 * places, switched off and dark (`night`).
 */

import Phaser from 'phaser';
import { PALETTE, nightify } from '../render/palette';
import { depthFor } from './player';
import { centerText } from '../core/ui';

export type CraneKind = 'plush' | 'oddity';
export const CRANE_W = 30;
/** A little over 2 m against the 26-pixel man, marquee and all. */
export const CRANE_H = 36;

/** One claw machine, its feet on `y`. */
export function paintCrane(scene: Phaser.Scene, x: number, y: number, kind: CraneKind, night: boolean): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(depthFor(y));
  const n = (col: number) => (night ? nightify(col, 0.75) : col);
  const W = CRANE_W;
  const H = CRANE_H;
  const eerie = kind === 'oddity';
  const frame = n(eerie ? 0x2a1a3a : PALETTE.neon);
  const trim = n(eerie ? 0x6a3a8a : PALETTE.tealLight);
  const side = n(eerie ? 0x1a1024 : 0xb0205a);
  const glassCol = n(eerie ? 0x140c1c : 0x1c2a48);
  // ---- THE BASE: the coloured body, a stripe, the prize door and the panel
  c.add(scene.add.rectangle(0, -6, W, 12, frame).setStrokeStyle(1, n(PALETTE.ink)));
  c.add(scene.add.rectangle(0, -2, W - 2, 1, trim));
  c.add(scene.add.rectangle(0, -11, W, 2, side));
  // the prize door, front left, with its flap
  c.add(scene.add.rectangle(-W / 2 + 6, -5, 8, 5, n(PALETTE.black)).setStrokeStyle(0.6, trim));
  c.add(scene.add.rectangle(-W / 2 + 6, -7, 8, 1.2, n(0x5a5a6a)));
  // the coin slot and the stick and button on the panel
  c.add(scene.add.rectangle(W / 2 - 5, -5, 3, 4, n(0x3a3a3a)));
  c.add(scene.add.rectangle(W / 2 - 5, -5, 1, 2, n(PALETTE.gold)));
  c.add(scene.add.rectangle(1, -10, 1, 3, n(0x2a2a2a)));
  c.add(scene.add.circle(1, -12, 1.4, n(0xd8202a)));
  c.add(scene.add.circle(5, -11, 1.2, n(0x46c46e)));
  // ---- THE GLASS BOX, heaped to halfway with prizes
  const gTop = -H + 7;
  const gH = -12 - gTop;
  c.add(scene.add.rectangle(0, gTop + gH / 2, W - 2, gH, glassCol));
  c.add(scene.add.rectangle(0, gTop + 2, W - 4, 4, 0xffffff, eerie ? 0.03 : 0.08));
  const pile = eerie ? [0x6a3a8a, 0x8a7aa0, 0x3a2a4a, 0x5a2a6a, 0x9fd4e0] : [0x46c46e, 0xa8743e, 0xf2e6d8, 0xffc830, 0x8a8f99, 0x7b4bd8, 0xff7ab0];
  let i = 0;
  // three layers, the back row first, each a bit narrower and higher
  for (const [row, y0, inset] of [[0, -14.5, 3], [1, -13.5, 5], [2, -16.5, 7], [3, -19, 9]] as const) {
    for (let px = -W / 2 + inset; px <= W / 2 - inset; px += 3.6) {
      const col = n(pile[(i++ * 5 + row * 3) % pile.length]);
      const py = y0 + ((i * 7) % 3) * 0.5;
      if (eerie) {
        c.add(scene.add.circle(px, py, 1.8, col));
        c.add(scene.add.rectangle(px, py, 3.4, 0.5, n(0xc8b0d8)));
      } else {
        c.add(scene.add.circle(px, py, 1.9, col));
        c.add(scene.add.circle(px - 1.1, py - 1.7, 0.7, col));
        c.add(scene.add.circle(px + 1.1, py - 1.7, 0.7, col));
      }
    }
  }
  // the claw on its gantry, holding nothing yet
  c.add(scene.add.rectangle(0, gTop + 1.5, W - 4, 1, n(PALETTE.steel)));
  c.add(scene.add.rectangle(3, gTop + 2, 3, 2, n(0x5a7aa8)));
  c.add(scene.add.rectangle(3, gTop + 4, 0.6, 3, n(0xb0b8c4)));
  c.add(scene.add.triangle(3, gTop + 6, -2, 0, 2, 0, 0, 3, n(PALETTE.steel)));
  // the corner posts, and a glint down the glass
  for (const sx of [-W / 2 + 0.5, W / 2 - 0.5]) c.add(scene.add.rectangle(sx, gTop + gH / 2, 1.5, gH, n(0xc8d0dc)));
  c.add(scene.add.rectangle(-W / 2 + 5, gTop + gH / 2, 1.2, gH - 2, 0xffffff, 0.12).setAngle(6));
  c.add(scene.add.rectangle(-W / 2 + 7.5, gTop + gH / 2, 0.6, gH - 4, 0xffffff, 0.1).setAngle(6));
  // ---- THE MARQUEE: a lit sign with a row of bulbs round it
  const head = scene.add.rectangle(0, -H + 3, W, 8, n(0x0c0814)).setStrokeStyle(1, trim);
  c.add(head);
  c.add(scene.add.rectangle(0, -H - 1.5, W + 2, 2, frame));
  c.add(centerText(scene, 0, -H + 3, eerie ? '???' : 'GRAB', n(eerie ? 0xc8a0e0 : PALETTE.gold)));
  const bulbs: Phaser.GameObjects.Arc[] = [];
  for (let b = 0; b < 7; b++) {
    const bulb = scene.add.circle(-W / 2 + 1 + b * ((W - 2) / 6), -H - 1.5, 0.8, n(eerie ? 0xc8a0e0 : 0xffe080));
    bulbs.push(bulb);
    c.add(bulb);
  }
  if (!night) {
    // The plush crane chases its lights; the other one flickers, unwell.
    const glow = scene.add.rectangle(0, -19, W + 2, 18, eerie ? 0x8a4ab8 : PALETTE.tealLight, 0.07);
    c.add(glow);
    if (eerie) {
      scene.time.addEvent({
        delay: 140,
        loop: true,
        callback: () => {
          const a = Math.random() < 0.12 ? 0.02 : 0.07 + Math.random() * 0.05;
          glow.setAlpha(a);
          bulbs.forEach((bl) => bl.setAlpha(a < 0.05 ? 0.2 : 1));
        },
      });
    } else {
      scene.tweens.add({ targets: glow, alpha: 0.03, duration: 700, yoyo: true, repeat: -1 });
      let step = 0;
      scene.time.addEvent({
        delay: 180,
        loop: true,
        callback: () => {
          step++;
          bulbs.forEach((bl, k) => bl.setAlpha((k + step) % 3 === 0 ? 0.3 : 1));
        },
      });
    }
  }
  return c;
}

export const CLASH_W = 40;
/** Taller than everything else in the room: the corner's centrepiece. */
export const CLASH_H = 50;

/** CREATURE CLASH, the cabinet: feet on `y`, sorted with the player like the cranes. */
export function paintClashCabinet(scene: Phaser.Scene, x: number, y: number, night: boolean): Phaser.GameObjects.Container {
  // ---- CREATURE CLASH: a premium upright, the room's centrepiece.
  //
  // A cabinet you would cross an arcade for: a shaped silhouette with a
  // swept-back top, a lightbox marquee with the logo on it, side art of the
  // two starters squaring up, neon edge tubes in the game's pink and teal,
  // a deep-bezelled screen with a fight running on it, a sloped control deck
  // with a stick and three lit buttons, a coin door, and a kick plate with a
  // strip of light under it that throws a glow on the floor.  After closing
  // it is all there and all switched off.
  const c = scene.add.container(x, y).setDepth(depthFor(y));
  const n = (col: number) => (night ? nightify(col, 0.7) : col);
  const W = CLASH_W;
  const H = CLASH_H;
  const L = -W / 2;
  const R = W / 2;
  const PINK = 0xff3d9a;
  const TEAL = 0x2ee6d0;
  const g = scene.add.graphics();
  c.add(g);
  const poly = (pts: number[][], col: number, a = 1): void => {
    g.fillStyle(col, a).beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath().fillPath();
  };
  // the glow it throws on the floor, out in front of it
  if (!night) {
    g.fillStyle(PINK, 0.12).fillEllipse(0, 1, W + 18, 8);
    g.fillStyle(TEAL, 0.1).fillEllipse(0, 1, W + 6, 5);
  }
  g.fillStyle(0x000000, 0.3).fillEllipse(0, 0, W + 4, 4);
  // ---- THE BODY: the silhouette -- a straight back, the top swept forward
  // over the marquee, the control deck jutting out, the base set back
  const body = [
    [L, 0], [L, -H + 8], [L + 3, -H], [R - 3, -H], [R, -H + 8], [R, -18], [R + 2, -15], [R + 2, -12], [R, -10], [R, 0],
  ];
  poly(body.map(([px, py]) => [px - 1, py + (py === 0 ? 0 : -1)]), n(0x0a0812));
  poly(body, n(0x18122e));
  // side art: a darker bevel down each side, with the panel's own artwork --
  // a sweep of colour and the two starters' silhouettes facing off
  for (const [sx, dir] of [[L, 1], [R, -1]] as const) {
    poly([[sx, -H + 8], [sx + dir * 5, -H + 6], [sx + dir * 5, -2], [sx, -2]], n(0x241a44));
    for (let k = 0; k < 6; k++) g.fillStyle(n(k % 2 ? PINK : 0x7a3ad8), 0.35).fillRect(sx + (dir > 0 ? 1 : -4), -H + 12 + k * 5, 3, 2);
  }
  g.fillStyle(n(0xe8642a), 0.85).fillCircle(L + 3, -16, 2);
  g.fillStyle(n(0x3a8ad8), 0.85).fillCircle(R - 3, -16, 2);
  // ---- THE NEON EDGE TUBES: up both sides and over the top
  const tubes = scene.add.graphics();
  c.add(tubes);
  const drawTubes = (a: number): void => {
    tubes.clear();
    if (night) {
      tubes.lineStyle(1, 0x2a2440, 1);
    } else {
      tubes.lineStyle(3, PINK, 0.18 * a);
      tubes.beginPath().moveTo(L, -2).lineTo(L, -H + 8).lineTo(L + 3, -H).lineTo(R - 3, -H).lineTo(R, -H + 8).lineTo(R, -2).strokePath();
      tubes.lineStyle(1, PINK, a);
    }
    tubes.beginPath().moveTo(L, -2).lineTo(L, -H + 8).lineTo(L + 3, -H).lineTo(R - 3, -H).lineTo(R, -H + 8).lineTo(R, -2).strokePath();
    if (!night) {
      tubes.lineStyle(1, TEAL, 0.9 * a);
      tubes.beginPath().moveTo(L + 5, -3).lineTo(L + 5, -H + 13).strokePath();
      tubes.beginPath().moveTo(R - 5, -3).lineTo(R - 5, -H + 13).strokePath();
    }
  };
  drawTubes(1);
  // ---- THE MARQUEE: a lightbox, the logo on it, lit from behind
  const mq = -H + 2;
  g.fillStyle(n(0x0a0812), 1).fillRect(L + 3, mq - 1, W - 6, 12);
  g.fillStyle(n(night ? 0x1a1424 : 0x2a0a3a), 1).fillRect(L + 4, mq, W - 8, 10);
  if (!night) {
    // the backlight: a hot band through the middle of the panel
    g.fillStyle(0xff7ac0, 0.35).fillRect(L + 4, mq + 3, W - 8, 4);
    g.fillStyle(0xffffff, 0.2).fillRect(L + 4, mq, W - 8, 1);
    // a starburst behind the logo
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      g.lineStyle(1, 0xffd060, 0.35).lineBetween(0, mq + 5, Math.cos(ang) * 14, mq + 5 + Math.sin(ang) * 6);
    }
  }
  // the logo at full size (scaled down it was unreadable), a creature's
  // head either side of it squaring up
  c.add(centerText(scene, 0, mq + 5, 'CLASH', night ? nightify(PINK, 0.5) : 0xffffff));
  g.fillStyle(n(0xe8642a), 1).fillCircle(L + 6, mq + 5, 1.6);
  g.fillStyle(n(0x3a8ad8), 1).fillCircle(R - 6, mq + 5, 1.6);
  // ---- THE SCREEN: a deep bezel, a curved glass, and a fight on it
  const sx0 = L + 7;
  const sy0 = -H + 15;
  const sw = W - 14;
  const sh = 14;
  g.fillStyle(n(0x05040a), 1).fillRect(sx0 - 2, sy0 - 2, sw + 4, sh + 4);
  g.fillStyle(n(0x3a3060), 1).fillRect(sx0 - 1, sy0 - 1, sw + 2, 1);
  g.fillStyle(n(0x0c1020), 1).fillRect(sx0, sy0, sw, sh);
  const scr = scene.add.graphics();
  c.add(scr);
  let tick = 0;
  const drawScreen = (): void => {
    scr.clear();
    if (night) return;
    // an arena floor, two fighters dancing about, shots going between them
    scr.fillStyle(0x24603a, 1).fillRect(sx0, sy0 + 8, sw, sh - 8);
    scr.fillStyle(0x16224a, 1).fillRect(sx0, sy0, sw, 8);
    for (let k = 0; k < 4; k++) scr.fillStyle(0xffffff, 0.6).fillRect(sx0 + ((k * 7 + tick) % sw), sy0 + 1 + (k % 3), 1, 1);
    const bob = (k: number) => Math.round(Math.sin(tick * 0.6 + k) * 1.2);
    const lx = sx0 + 6 + bob(0);
    const rx = sx0 + sw - 6 - bob(2);
    scr.fillStyle(0xe8642a, 1).fillCircle(lx, sy0 + 9 + bob(1), 2.4);
    scr.fillStyle(0x3a8ad8, 1).fillCircle(rx, sy0 + 9 - bob(1), 2.4);
    scr.fillStyle(0xffffff, 1).fillRect(lx + 1, sy0 + 8 + bob(1), 1, 1).fillRect(rx - 1, sy0 + 8 - bob(1), 1, 1);
    const shot = (tick * 2) % (rx - lx - 6);
    scr.fillStyle(0xfff4a0, 1).fillRect(lx + 3 + shot, sy0 + 9, 2, 1);
    // the HUD bars, ticking down
    scr.fillStyle(0x6ae86a, 1).fillRect(sx0 + 1, sy0 + 1, 6 - (tick % 6), 1);
    scr.fillStyle(0xff5a5a, 1).fillRect(sx0 + sw - 7 + (tick % 4), sy0 + 1, 6 - (tick % 4), 1);
    // the glass over it: a scanline and a curved reflection
    for (let yy = sy0; yy < sy0 + sh; yy += 2) scr.fillStyle(0x000000, 0.18).fillRect(sx0, yy, sw, 1);
    scr.fillStyle(0xffffff, 0.12).fillRect(sx0 + 1, sy0 + 1, 3, sh - 2);
    scr.fillStyle(0xffffff, 0.08).fillRect(sx0 + 4, sy0 + 1, sw - 6, 1);
  };
  drawScreen();
  // the screen's light, washing out over the bezel
  if (!night) {
    const wash = scene.add.rectangle(0, sy0 + sh / 2, sw + 6, sh + 6, 0x8ab0ff, 0.12);
    c.add(wash);
    scene.tweens.add({ targets: wash, alpha: 0.03, duration: 600, yoyo: true, repeat: -1 });
  }
  // ---- THE SPEAKER GRILLE under the screen
  for (let k = 0; k < 5; k++) g.fillStyle(n(0x3a3060), 1).fillRect(L + 9 + k * 5, -H + 32, 3, 1);
  // ---- THE CONTROL DECK: sloped, lit along its edge, a stick and three
  // buttons in the game's colours, and the player-one start button
  poly([[L + 1, -18], [R + 1, -18], [R + 2, -13], [L - 1, -13]], n(0x2a2052));
  g.fillStyle(n(0x3e3478), 1).fillRect(L + 1, -18, W, 1);
  g.fillStyle(n(night ? 0x2a2440 : TEAL), night ? 1 : 0.85).fillRect(L - 1, -13, W + 3, 1);
  // the stick: a ball top on a shaft, in a dust washer
  g.fillStyle(n(0x101010), 1).fillEllipse(L + 9, -15, 5, 2);
  g.fillStyle(n(0x606060), 1).fillRect(L + 8.5, -19, 1, 4);
  g.fillStyle(n(0xd83a4a), 1).fillCircle(L + 9, -19.5, 1.8);
  g.fillStyle(0xffffff, night ? 0.1 : 0.55).fillRect(L + 8, -20.5, 1, 1);
  const btns: Array<[number, number]> = [[2, 0xffd060], [7, 0x5ae87a], [12, 0x4aa8ff]];
  for (const [bx, col] of btns) {
    g.fillStyle(n(0x101010), 1).fillEllipse(bx, -15.5, 4, 2.4);
    g.fillStyle(n(col), 1).fillEllipse(bx, -16, 3.4, 2);
    if (!night) g.fillStyle(col, 0.25).fillCircle(bx, -16, 3);
  }
  // ---- THE COIN DOOR and the kick plate
  g.fillStyle(n(0x0a0812), 1).fillRect(-6, -11, 12, 8);
  g.fillStyle(n(0x241a44), 1).fillRect(-5, -10, 10, 6);
  for (const cx of [-2.5, 2.5]) {
    g.fillStyle(n(0x3a3060), 1).fillRect(cx - 1.5, -9, 3, 4);
    g.fillStyle(n(night ? 0x3a2a20 : 0xff4a3a), 1).fillRect(cx - 0.5, -8.5, 1, 2);
  }
  g.fillStyle(n(0x0a0812), 1).fillRect(L + 1, -3, W - 2, 3);
  g.fillStyle(n(night ? 0x1a1424 : PINK), night ? 1 : 0.9).fillRect(L + 2, -1, W - 4, 1);
  // ---- THE GLOSS: one highlight down the front edge of the cabinet
  g.fillStyle(0xffffff, night ? 0.03 : 0.1).fillRect(L + 1, -H + 9, 1, H - 12);
  // ---- AND IT IS ALIVE: the tubes breathe, the screen plays, and now and
  // then the marquee flickers like a real tube warming up
  if (!night) {
    const pulse = { a: 1 };
    scene.tweens.add({ targets: pulse, a: 0.55, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', onUpdate: () => drawTubes(pulse.a) });
    scene.time.addEvent({ delay: 140, loop: true, callback: () => { tick++; drawScreen(); } });
  }
  return c;
}
