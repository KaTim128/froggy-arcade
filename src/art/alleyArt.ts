/**
 * ---- THE ALLEYS BETWEEN THE SHOPS.  The gaps along the east street are
 * real alleys you can duck down, each its own place, built the way the
 * arcade's back alley is (scenes2d/BackAlley): a back wall in courses, the
 * side walls dark, wet asphalt, clutter with an ink edge and grime on it --
 * but laid out differently every time, so no two read as copies:
 *
 *   0  THE BIN ALLEY.  Old red brick, a fire escape, a dumpster and bags,
 *      a back door under a caged lamp.
 *   1  THE PASSAGE.  Grey blockwork, narrow -- the side walls close in --
 *      AC units dripping, cables overhead, a chain-link fence at the end.
 *   2  THE LOADING YARD.  Yellow brick, a raised dock along the back with a
 *      roller door and steps, pallets, crates and a trolley, two downpipes.
 *
 * LIT BY THE CLOCK.  Day, evening or night (life `clock`): the strip of sky
 * between the roofs is the hour's -- at night a deep blue with the moon and
 * stars -- every colour goes down to a moonlit palette in the dark, the
 * windows come on warm, and the lamps throw their pools on the ground.
 */

import { daylight, nightify } from '../render/palette';

export type AlleyLight = 'day' | 'evening' | 'night';

export interface AlleyLayout {
  /** The walk line. */
  walkY: number;
  /** How wide the side walls stand in (left, right). */
  sides: [number, number];
  /** Where the lamp hangs, if there is one: its light falls here. */
  lamp: { x: number; y: number } | null;
}

export const ALLEYS: AlleyLayout[] = [
  { walkY: 168, sides: [36, 24], lamp: { x: 246, y: 106 } },
  { walkY: 170, sides: [52, 46], lamp: { x: 150, y: 96 } },
  { walkY: 166, sides: [30, 20], lamp: { x: 214, y: 100 } },
];

type Ctx = CanvasRenderingContext2D;
const W = 320;
const H = 180;
const hex = (n: number): string => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;

export function paintSideAlley(g: Ctx, variant: number, light: AlleyLight): void {
  const L = ALLEYS[variant] ?? ALLEYS[0];
  const c = (n: number): string => hex(light === 'night' ? nightify(n, 0.38) : light === 'day' ? daylight(n, 0.25) : n);
  const rect = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  let seed = 31 + variant * 977;
  const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ground = L.walkY - 18;

  // ---- the sky between the roofs: the hour's
  const skyH = variant === 1 ? 10 : 7;
  if (light === 'night') {
    const sk = g.createLinearGradient(0, 0, 0, skyH);
    sk.addColorStop(0, '#0a1030');
    sk.addColorStop(1, '#1a2450');
    g.fillStyle = sk;
    g.fillRect(0, 0, W, skyH);
    for (let i = 0; i < 14; i++) rect(R() * W, R() * (skyH - 1), 1, 1, R() < 0.5 ? '#e8ecff' : '#8a94c0');
    // the moon, caught in the gap
    g.fillStyle = '#f4f0dc';
    g.beginPath();
    g.arc(70 + variant * 80, 3, 3, 0, Math.PI * 2);
    g.fill();
  } else {
    rect(0, 0, W, skyH, light === 'day' ? '#8fd4e8' : '#e8a050');
    rect(0, skyH, W, 1, 'rgba(255,255,255,0.25)');
  }

  // ---- the back wall
  const bricks: Record<number, { mortar: number; tones: number[]; lit: number; course: number; len: number }> = {
    0: { mortar: 0x3c2a30, tones: [0x6a3a34, 0x5e3430, 0x74423a, 0x583030], lit: 0x8a5446, course: 6, len: 12 },
    1: { mortar: 0x3a3c40, tones: [0x6a6c70, 0x626468, 0x72747a, 0x5a5c60], lit: 0x8a8c92, course: 8, len: 16 },
    2: { mortar: 0x5a4a2a, tones: [0xb8944a, 0xa8863e, 0xc4a058, 0x9a7a3a], lit: 0xd8b870, course: 6, len: 12 },
  };
  const B = bricks[variant] ?? bricks[0];
  rect(0, skyH, W, ground - skyH, c(B.mortar));
  for (let row = 0; skyH + row * B.course < ground; row++) {
    const off = row % 2 ? B.len / 2 : 0;
    const y = skyH + row * B.course;
    for (let x = -off; x < W; x += B.len) {
      rect(x + 1, y + 1, B.len - 2, B.course - 2, c(B.tones[Math.floor(R() * 4)]));
      rect(x + 1, y + 1, B.len - 2, 1, c(B.lit));
      if (R() < 0.04) rect(x + 3, y + 2, 4, 2, c(0x1c1418));
    }
  }
  const grime = g.createLinearGradient(0, skyH, 0, ground);
  grime.addColorStop(0, 'rgba(0,0,0,0.05)');
  grime.addColorStop(1, 'rgba(10,6,10,0.45)');
  g.fillStyle = grime;
  g.fillRect(0, skyH, W, ground - skyH);

  // ---- the ground: asphalt (or the yard's concrete), cracks, grit
  rect(0, ground, W, H - ground, c(variant === 2 ? 0x4a4844 : 0x2a2c34));
  rect(0, ground, W, 2, c(variant === 2 ? 0x6a6660 : 0x4a4e58));
  for (let i = 0; i < 150; i++) rect(R() * W, ground + 3 + R() * (H - ground - 3), 1 + Math.floor(R() * 2), 1, c(R() < 0.5 ? 0x34363e : 0x202228));
  g.strokeStyle = c(0x16171c);
  g.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    const x = 70 + R() * 200;
    const y = ground + 6 + R() * 12;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 5, y + 3);
    g.lineTo(x + 3, y + 7);
    g.lineTo(x + 10, y + 9);
    g.stroke();
  }

  // ---- what is in it
  const ink = c(0x14100c);
  const win = (x: number, y: number, w: number, h: number) => {
    rect(x - 2, y - 2, w + 4, h + 4, c(0x1a1c24));
    const glass = light === 'night' ? 'rgba(255,200,120,0.55)' : light === 'evening' ? 'rgba(255,190,120,0.35)' : 'rgba(150,200,225,0.5)';
    rect(x, y, w / 2 - 1, h / 2 - 1, glass);
    rect(x + w / 2 + 1, y, w / 2 - 1, h / 2 - 1, glass);
    rect(x, y + h / 2 + 1, w / 2 - 1, h / 2 - 1, glass);
    rect(x + w / 2 + 1, y + h / 2 + 1, w / 2 - 1, h / 2 - 1, glass);
    rect(x - 3, y + h + 2, w + 6, 2, c(0x6a5a4a));
  };
  const pipe = (x: number, top: number) => {
    rect(x, top, 4, ground - top, c(0x4a5258));
    rect(x, top, 1, ground - top, c(0x6a747c));
    for (let y = top + 20; y < ground; y += 38) rect(x - 1, y, 6, 2, c(0x30363a));
  };
  const crate = (x: number, y: number, w: number, h: number) => {
    rect(x - 1, y - 1, w + 2, h + 2, ink);
    rect(x, y, w, h, c(0x8a6238));
    rect(x, y, w, 1, c(0xb88a58));
    rect(x, y + h - 1, w, 1, c(0x5a3c22));
    g.strokeStyle = c(0x5a3c22);
    g.beginPath();
    g.moveTo(x + 1, y + 1);
    g.lineTo(x + w - 1, y + h - 1);
    g.stroke();
  };
  const bag = (x: number, r: number, tone: number) => {
    g.fillStyle = c(tone);
    g.beginPath();
    g.ellipse(x, ground + 1 - r, r, r, 0, 0, Math.PI * 2);
    g.fill();
    rect(x - r / 2, ground + 1 - r * 1.6, 2, 2, 'rgba(160,170,190,0.3)');
  };
  const door = (x: number, w: number, h: number, col: number) => {
    rect(x - 2, ground - h - 2, w + 4, h + 2, ink);
    rect(x, ground - h, w, h, c(col));
    rect(x, ground - h, w, 1, c(0xa8a8a0));
    rect(x + w - 4, ground - h / 2, 2, 2, c(0xc0c4c8));
  };

  if (variant === 0) {
    win(66, 40, 22, 26);
    pipe(122, skyH);
    // fire escape: landing, rails, the ladder down
    rect(150, 34, 74, 4, c(0x2c3238));
    rect(150, 34, 74, 1, c(0x5a646e));
    for (let x = 152; x < 224; x += 6) rect(x, 22, 1, 12, c(0x3a424a));
    rect(150, 22, 74, 2, c(0x3a424a));
    rect(166, 38, 3, 84, c(0x4a545e));
    rect(210, 38, 3, 84, c(0x4a545e));
    for (let i = 0; i < 7; i++) rect(166, 44 + i * 12, 47, 2, c(0x5e6a74));
    door(236, 22, 32, 0x5a3c24);
    // dumpster, and bags beside it
    const dx = 56;
    rect(dx - 3, ground - 23, 58, 24, ink);
    rect(dx, ground - 18, 52, 18, c(0x2f6a3e));
    for (let k = 0; k < 5; k++) rect(dx + 5 + k * 10, ground - 15, 2, 13, c(0x24542f));
    rect(dx - 2, ground - 22, 56, 4, c(0x1c4026));
    rect(dx - 2, ground - 22, 56, 1, c(0x5aa06a));
    bag(dx + 62, 7, 0x1a1c22);
    bag(dx + 71, 5, 0x24262e);
    crate(200, ground - 16, 18, 16);
  } else if (variant === 1) {
    // cables strung overhead, sagging
    g.strokeStyle = c(0x14141a);
    for (const [y0, sag] of [[20, 8], [26, 5]]) {
      g.beginPath();
      g.moveTo(L.sides[0], y0);
      g.quadraticCurveTo(W / 2, y0 + sag * 2, W - L.sides[1], y0 + 2);
      g.stroke();
    }
    // two AC units on the wall, a dark stain of drip under each
    for (const ax of [84, 196]) {
      rect(ax - 1, 58, 26, 18, ink);
      rect(ax, 59, 24, 16, c(0xb8bcc0));
      for (let k = 0; k < 5; k++) rect(ax + 3, 62 + k * 2, 18, 1, c(0x7a7e84));
      rect(ax + 10, 76, 3, ground - 76, 'rgba(20,24,30,0.25)');
    }
    win(130, 34, 18, 20);
    // the chain-link fence across the far end, posts and a gate
    rect(226, ground - 40, 2, 40, c(0x5a6068));
    rect(270, ground - 40, 2, 40, c(0x5a6068));
    g.strokeStyle = c(0x8a9098);
    for (let x = 226; x < 272; x += 4) {
      g.beginPath();
      g.moveTo(x, ground - 38);
      g.lineTo(x + 8, ground);
      g.moveTo(x + 8, ground - 38);
      g.lineTo(x, ground);
      g.stroke();
    }
    rect(226, ground - 40, 46, 2, c(0x6a7078));
    // pallets stacked against the wall, a bin with its lid open
    for (let k = 0; k < 4; k++) {
      rect(62, ground - 4 - k * 4, 30, 1, c(0x9a7a4a));
      rect(62, ground - 3 - k * 4, 30, 2, c(0x6a5030));
    }
    rect(170, ground - 15, 14, 15, ink);
    rect(171, ground - 14, 12, 14, c(0x3a4a8a));
    rect(170, ground - 19, 16, 3, c(0x2a3a6a));
    // a tag sprayed on the blocks
    g.strokeStyle = light === 'night' ? 'rgba(200,80,160,0.35)' : 'rgba(200,60,140,0.6)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(108, 112);
    g.bezierCurveTo(118, 100, 126, 122, 136, 106);
    g.bezierCurveTo(142, 98, 148, 114, 156, 108);
    g.stroke();
    g.lineWidth = 1;
  } else {
    // the loading dock along the back: a raised slab, a roller door, steps
    const dockTop = ground - 12;
    rect(60, dockTop, 200, 12, c(0x7a766e));
    rect(60, dockTop, 200, 2, c(0xa8a49a));
    rect(60, dockTop + 9, 200, 3, c(0xd8b830));
    for (let x = 64; x < 260; x += 8) rect(x, dockTop + 9, 4, 3, c(0x1a1a14));
    rect(110, dockTop - 46, 64, 46, ink);
    rect(112, dockTop - 44, 60, 44, c(0x8a929e));
    for (let y = dockTop - 42; y < dockTop; y += 3) {
      rect(112, y, 60, 1, c(0x5a626e));
      rect(112, y + 1, 60, 1, c(0xb8c0ca));
    }
    for (let k = 0; k < 3; k++) rect(262 + k * 6, dockTop + k * 4, 8, 12 - k * 4, c(0x6a665e));
    pipe(42, skyH);
    pipe(284, skyH);
    win(196, 30, 20, 24);
    // a sign over the dock door
    rect(118, dockTop - 58, 48, 9, ink);
    rect(119, dockTop - 57, 46, 7, c(0x2a3a5a));
    rect(121, dockTop - 54, 42, 1, c(0xe8e0c8));
    // pallets, crates and a hand trolley on the dock
    crate(70, dockTop - 14, 16, 14);
    crate(88, dockTop - 10, 12, 10);
    crate(214, dockTop - 18, 20, 18);
    rect(240, dockTop - 22, 2, 22, c(0x9aa0a8));
    rect(240, dockTop - 2, 10, 2, c(0x9aa0a8));
    g.fillStyle = c(0x14141a);
    g.beginPath();
    g.arc(243, dockTop - 1, 2, 0, Math.PI * 2);
    g.fill();
  }

  // ---- the side walls, in shadow, and the shadow they throw in
  const [lw, rw] = L.sides;
  for (const [x, w] of [[0, lw], [W - rw, rw]] as const) {
    rect(x, 0, w, H, c(0x1c1418));
    for (let y = 0; y < H; y += 6) rect(x + ((y / 6) % 2 ? 2 : 6), y + 1, w - 8, 4, c(0x2a1e22));
  }
  const shl = g.createLinearGradient(lw, 0, lw + 18, 0);
  shl.addColorStop(0, 'rgba(0,0,0,0.45)');
  shl.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = shl;
  g.fillRect(lw, 0, 18, H);
  const shr = g.createLinearGradient(W - rw, 0, W - rw - 18, 0);
  shr.addColorStop(0, 'rgba(0,0,0,0.45)');
  shr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = shr;
  g.fillRect(W - rw - 18, 0, 18, H);

  // ---- the lamp, and its pool: bright against the dark at night
  if (L.lamp) {
    const { x, y } = L.lamp;
    const a = light === 'night' ? 0.55 : light === 'evening' ? 0.4 : 0.18;
    const cone = g.createRadialGradient(x, y + 6, 2, x, ground, 60);
    cone.addColorStop(0, `rgba(255,214,140,${a})`);
    cone.addColorStop(1, 'rgba(255,214,140,0)');
    g.fillStyle = cone;
    g.beginPath();
    g.moveTo(x - 4, y + 6);
    g.lineTo(x + 4, y + 6);
    g.lineTo(x + 46, H);
    g.lineTo(x - 46, H);
    g.fill();
    rect(x - 6, y - 2, 12, 3, c(0x2a2c30));
    rect(x - 4, y + 1, 8, 5, '#ffe6a8');
    for (let k = 0; k < 3; k++) rect(x - 4 + k * 3, y + 1, 1, 5, c(0x2a2c30));
  }
  // at night, the moon's cold light down the open top of it
  if (light === 'night') {
    const moon = g.createLinearGradient(0, 0, 0, H);
    moon.addColorStop(0, 'rgba(120,140,200,0.12)');
    moon.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = moon;
    g.fillRect(lw, 0, W - lw - rw, H);
  }
  // the way back out, on the left: the street's light at the alley's mouth
  const mouth = g.createLinearGradient(0, 0, 26, 0);
  mouth.addColorStop(0, light === 'night' ? 'rgba(160,170,220,0.12)' : 'rgba(255,250,235,0.18)');
  mouth.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mouth;
  g.fillRect(0, 0, 26, H);
}
