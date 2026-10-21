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

/**
 * One claw machine, its feet on `y`.
 *
 * Built to the CREATURE CLASH cabinet's finish: one dark outline round the
 * whole silhouette, every panel lit along its top edge and shaded beneath,
 * chrome posts that catch the light, a lit interior with an LED bar throwing
 * a cone of light down over the prizes, a real claw on a gantry with a
 * motor carriage, a sloped control deck with a ball-top stick and domed
 * buttons, a prize door with a swing flap, a coin door, and glass that
 * shows its reflections.  The plush one is bright pink and teal; the other
 * is a bruise of violets, and its light is not well.
 */
export function paintCrane(scene: Phaser.Scene, x: number, y: number, kind: CraneKind, night: boolean): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(depthFor(y));
  const n = (col: number) => (night ? nightify(col, 0.75) : col);
  const W = CRANE_W;
  const H = CRANE_H;
  const L = -W / 2;
  const R = W / 2;
  const eerie = kind === 'oddity';
  const frame = n(eerie ? 0x2a1a3a : PALETTE.neon);
  const frameLit = n(eerie ? 0x4a2a62 : 0xff8ac4);
  const frameDark = n(eerie ? 0x160c20 : 0x8a1848);
  const trim = n(eerie ? 0x6a3a8a : PALETTE.tealLight);
  const wallTop = n(eerie ? 0x1c1028 : 0x2a3e66);
  const wallLow = n(eerie ? 0x0c0612 : 0x141e36);
  const chrome = n(0xc8d0dc);
  const g = scene.add.graphics();
  c.add(g);
  // the glow it throws on the floor, and its contact shadow
  if (!night) g.fillStyle(eerie ? 0x8a4ab8 : PALETTE.neon, 0.1).fillEllipse(0, 1, W + 12, 6);
  g.fillStyle(0x000000, 0.3).fillEllipse(0, 0, W + 4, 4);
  // ---- THE OUTLINE, round the whole machine
  g.fillStyle(n(0x0a0812), 1).fillRect(L - 1, -H - 3, W + 2, H + 3);

  // ---- THE BASE: the coloured body, lit along its top, shaded under it
  g.fillStyle(frame, 1).fillRect(L, -12, W, 12);
  g.fillStyle(frameLit, 1).fillRect(L, -12, W, 1);
  g.fillStyle(frameLit, 0.6).fillRect(L, -12, 1, 12);
  g.fillStyle(frameDark, 1).fillRect(R - 1, -12, 1, 12);
  // a pin-stripe in the trim colour, and a bevelled seam above the kick plate
  g.fillStyle(trim, 1).fillRect(L + 1, -3, W - 2, 1);
  g.fillStyle(n(0x0a0812), 1).fillRect(L, -2, W, 2);
  if (!night) g.fillStyle(trim, 0.55).fillRect(L + 2, -1, W - 4, 1);
  // the prize door, front left: a chrome frame, a dark mouth, a swing flap
  const dx = L + 2;
  g.fillStyle(n(0x0a0812), 1).fillRect(dx, -10, 10, 7);
  g.fillStyle(chrome, 1).fillRect(dx, -10, 10, 1).fillRect(dx, -10, 1, 7);
  g.fillStyle(n(0x7a828c), 1).fillRect(dx + 9, -10, 1, 7).fillRect(dx, -4, 10, 1);
  g.fillStyle(n(0x2a2e38), 1).fillRect(dx + 1, -9, 8, 3);
  g.fillStyle(n(0x5a6270), 1).fillRect(dx + 1, -9, 8, 1);
  g.fillStyle(n(0x000000), 1).fillRect(dx + 1, -6, 8, 2);
  // the coin door, front right, with its lit slot and a reject button
  const cx = R - 8;
  g.fillStyle(n(0x0a0812), 1).fillRect(cx, -10, 6, 7);
  g.fillStyle(n(0x3a3a46), 1).fillRect(cx + 1, -9, 4, 5);
  g.fillStyle(n(0x5a5a68), 1).fillRect(cx + 1, -9, 4, 1);
  g.fillStyle(n(night ? 0x3a2a10 : PALETTE.gold), 1).fillRect(cx + 2, -8, 2, 2);
  g.fillStyle(n(0x000000), 1).fillRect(cx + 2.5, -8, 1, 2);
  g.fillStyle(n(0xd8202a), 1).fillRect(cx + 2, -5, 2, 1);

  // ---- THE CONTROL DECK: sloped forward, lit along its lip
  g.fillStyle(n(0x0a0812), 1).fillRect(L - 1, -15, W + 2, 4);
  g.fillStyle(n(0x3a4250), 1).fillRect(L, -14, W, 2);
  g.fillStyle(n(0x6a7480), 1).fillRect(L, -14, W, 1);
  g.fillStyle(trim, night ? 0.4 : 0.9).fillRect(L, -12, W, 1);
  // the stick: a dust washer, the shaft, a red ball-top with its highlight
  g.fillStyle(n(0x101010), 1).fillEllipse(2, -13, 4, 1.6);
  g.fillStyle(n(0x8a929c), 1).fillRect(1.5, -16, 1, 3);
  g.fillStyle(n(0x7a1018), 1).fillCircle(2, -16.5, 1.7);
  g.fillStyle(n(0xd8202a), 1).fillCircle(1.8, -16.7, 1.3);
  if (!night) g.fillStyle(0xffffff, 0.85).fillRect(1, -17.5, 1, 1);
  // two domed buttons in dark collars, each with a pinprick of light
  for (const [bx, col] of [[6, 0x46c46e], [9.5, 0xffc830]] as const) {
    g.fillStyle(n(0x101010), 1).fillEllipse(bx, -13, 3.4, 1.8);
    g.fillStyle(n(col), 1).fillEllipse(bx, -13.4, 2.6, 1.4);
    if (!night) {
      g.fillStyle(col, 0.25).fillCircle(bx, -13.4, 2.4);
      g.fillStyle(0xffffff, 0.8).fillRect(bx - 0.8, -14, 1, 0.6);
    }
  }

  // ---- THE GLASS BOX: a lit interior, the prizes, the claw
  const gTop = -H + 7;
  const gBot = -15;
  const gH = gBot - gTop;
  // the back wall, lighter up top where the LED bar is
  g.fillStyle(wallLow, 1).fillRect(L + 1, gTop, W - 2, gH);
  g.fillStyle(wallTop, 1).fillRect(L + 1, gTop, W - 2, Math.ceil(gH * 0.55));
  g.fillStyle(wallTop, 0.5).fillRect(L + 1, gTop + Math.ceil(gH * 0.55), W - 2, 2);
  // the floor of the box, a lighter strip in perspective
  g.fillStyle(n(eerie ? 0x241634 : 0x3a5288), 1).fillRect(L + 1, gBot - 2, W - 2, 2);
  // the light cone off the LED bar, falling on the heap
  const cone = scene.add.graphics();
  c.add(cone);
  if (!night) {
    cone.fillStyle(eerie ? 0xb080e0 : 0xfff6d8, eerie ? 0.07 : 0.12).fillTriangle(-4, gTop + 2, 4, gTop + 2, 0, gTop + 2).fillPoints(
      [new Phaser.Geom.Point(-5, gTop + 2), new Phaser.Geom.Point(5, gTop + 2), new Phaser.Geom.Point(12, gBot - 1), new Phaser.Geom.Point(-12, gBot - 1)],
      true,
    );
  }
  // the heap, three layers deep, the back row first
  const pile = eerie ? [0x6a3a8a, 0x8a7aa0, 0x3a2a4a, 0x5a2a6a, 0x9fd4e0] : [0x46c46e, 0xa8743e, 0xf2e6d8, 0xffc830, 0x8a8f99, 0x7b4bd8, 0xff7ab0];
  const pg = scene.add.graphics();
  c.add(pg);
  let i = 0;
  for (const [row, y0, inset] of [[0, -18, 3], [1, -17, 5], [2, -20, 7], [3, -22.5, 9]] as const) {
    for (let px = L + inset; px <= R - inset; px += 3.6) {
      const col = n(pile[(i++ * 5 + row * 3) % pile.length]);
      const py = y0 + ((i * 7) % 3) * 0.5;
      // the body, a shade under it and a lit cap
      pg.fillStyle(col, 1).fillCircle(px, py, 2);
      pg.fillStyle(0x000000, 0.18).fillRect(px - 1, py + 1, 3, 1);
      pg.fillStyle(0xffffff, night ? 0.05 : 0.4).fillRect(px - 1, py - 1.4, 1, 1);
      if (eerie) {
        // capsules: a pale seam round the middle
        pg.fillStyle(n(0xc8b0d8), 1).fillRect(px - 1.7, py - 0.25, 3.4, 0.5);
      } else {
        // plush: two little ears and a dot of an eye
        pg.fillStyle(col, 1).fillCircle(px - 1.1, py - 1.7, 0.7).fillCircle(px + 1.1, py - 1.7, 0.7);
        pg.fillStyle(n(0x0a0812), 1).fillRect(px - 0.6, py - 0.6, 0.6, 0.6);
      }
    }
  }
  // the prize chute's own little glass wall, front left
  const chute = scene.add.graphics();
  c.add(chute);
  chute.fillStyle(0x9fd4ff, night ? 0.04 : 0.1).fillRect(L + 2, gBot - 7, 7, 7);
  chute.fillStyle(0xc8e0ff, night ? 0.1 : 0.5).fillRect(L + 2, gBot - 7, 7, 1);
  // ---- THE GANTRY: two rails, the carriage on them, the cable, the claw
  const rig = scene.add.graphics();
  c.add(rig);
  rig.fillStyle(n(0x3a4250), 1).fillRect(L + 2, gTop + 1, W - 4, 2);
  rig.fillStyle(n(0x8a96a6), 1).fillRect(L + 2, gTop + 1, W - 4, 1);
  for (const bx of [L + 3, R - 4]) rig.fillStyle(n(0x1a1e26), 1).fillRect(bx, gTop + 1, 1, 2);
  // the LED bar along the front of the ceiling
  rig.fillStyle(n(eerie ? 0x8a6ab0 : 0xfff0c9), night ? 0.3 : 1).fillRect(L + 3, gTop, W - 6, 1);
  const clawX = 3;
  rig.fillStyle(n(0x0a0812), 1).fillRect(clawX - 2.5, gTop + 2, 5, 3);
  rig.fillStyle(n(0x5a7aa8), 1).fillRect(clawX - 2, gTop + 2, 4, 2);
  rig.fillStyle(n(0x8aaad8), 1).fillRect(clawX - 2, gTop + 2, 4, 1);
  rig.fillStyle(n(0x8a929c), 1).fillRect(clawX - 0.3, gTop + 4, 0.6, 3);
  // the claw: a hub, two prongs out and hooked in, and the back prong
  rig.fillStyle(n(0x6a7686), 1).fillRect(clawX - 1.8, gTop + 7, 3.6, 1.6);
  rig.fillStyle(chrome, 1).fillRect(clawX - 1.8, gTop + 7, 3.6, 0.6);
  rig.lineStyle(0.8, chrome, 1);
  rig.lineBetween(clawX - 1.2, gTop + 8.6, clawX - 2.6, gTop + 10.6).lineBetween(clawX - 2.6, gTop + 10.6, clawX - 1.6, gTop + 12);
  rig.lineBetween(clawX + 1.2, gTop + 8.6, clawX + 2.6, gTop + 10.6).lineBetween(clawX + 2.6, gTop + 10.6, clawX + 1.6, gTop + 12);
  rig.lineStyle(0.6, n(0x5a6676), 1).lineBetween(clawX, gTop + 8.6, clawX, gTop + 11.4);

  // ---- THE GLASS: chrome posts at the corners, the panes catching the light
  const glass = scene.add.graphics();
  c.add(glass);
  for (const sx of [L + 0.5, R - 1.5]) {
    glass.fillStyle(n(0x6a7480), 1).fillRect(sx, gTop - 1, 1.5, gH + 1);
    glass.fillStyle(chrome, 1).fillRect(sx, gTop - 1, 0.8, gH + 1);
  }
  glass.fillStyle(chrome, 1).fillRect(L, gBot, W, 0.8);
  if (!night) {
    // a broad diagonal glare and a thin one beside it, and a soft sheen
    // across the top where the pane meets the frame
    glass.fillStyle(0xffffff, 0.06).fillPoints(
      [new Phaser.Geom.Point(L + 3, gBot), new Phaser.Geom.Point(L + 6, gBot), new Phaser.Geom.Point(L + 10, gTop), new Phaser.Geom.Point(L + 7, gTop)],
      true,
    );
    glass.fillStyle(0xffffff, 0.09).fillPoints(
      [new Phaser.Geom.Point(L + 8, gBot), new Phaser.Geom.Point(L + 8.8, gBot), new Phaser.Geom.Point(L + 12.8, gTop), new Phaser.Geom.Point(L + 12, gTop)],
      true,
    );
    glass.fillStyle(0xffffff, 0.05).fillRect(L + 1, gTop, W - 2, 2);
    glass.fillStyle(0xffffff, 0.5).fillRect(R - 4, gTop + 1, 1, 1);
  } else {
    glass.fillStyle(0xa0b0d0, 0.06).fillRect(L + 4, gTop + 2, 3, gH - 4);
  }

  // ---- THE MARQUEE: a lightbox with a lit name and a row of bulbs round it
  const mqT = -H - 2;
  g.fillStyle(frame, 1).fillRect(L, mqT, W, 2);
  g.fillStyle(frameLit, 1).fillRect(L, mqT, W, 1);
  g.fillStyle(n(0x0c0814), 1).fillRect(L, -H, W, 7);
  g.fillStyle(trim, 1).fillRect(L, -H, W, 0.8).fillRect(L, -H + 6.2, W, 0.8).fillRect(L, -H, 0.8, 7).fillRect(R - 0.8, -H, 0.8, 7);
  if (!night) g.fillStyle(eerie ? 0x6a3a8a : PALETTE.gold, 0.18).fillRect(L + 1, -H + 2, W - 2, 3);
  c.add(centerText(scene, 0, -H + 3, eerie ? '???' : 'GRAB', n(eerie ? 0xc8a0e0 : PALETTE.gold)));
  const bulbs: Phaser.GameObjects.Arc[] = [];
  for (let b = 0; b < 7; b++) {
    const bulb = scene.add.circle(L + 1 + b * ((W - 2) / 6), mqT + 0.5, 0.8, n(eerie ? 0xc8a0e0 : 0xffe080));
    bulbs.push(bulb);
    c.add(bulb);
  }
  // the gloss down the front edge of the body
  g.fillStyle(0xffffff, night ? 0.03 : 0.1).fillRect(L + 1, -11, 1, 8);

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
          cone.setAlpha(a < 0.05 ? 0.2 : 1);
          bulbs.forEach((bl) => bl.setAlpha(a < 0.05 ? 0.2 : 1));
        },
      });
    } else {
      scene.tweens.add({ targets: glow, alpha: 0.03, duration: 700, yoyo: true, repeat: -1 });
      scene.tweens.add({ targets: cone, alpha: 0.6, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
