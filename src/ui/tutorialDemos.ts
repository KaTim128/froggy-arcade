/**
 * ---- HOW TO PLAY, SHOWN.  A little moving picture for every step of every
 * cabinet's tutorial: the frog crouching and flicking, the barrel rolling at
 * you and the jump that clears it, the oil shoving a ball off its line.
 *
 * Each picture is a function of time, drawn fresh every frame into a box of
 * its own (`DEMO_W` x `DEMO_H`, its top-left at 0,0) with plain shapes -- the
 * same flat pixel look as the cabinets -- and, where a word helps, a label in
 * the small font (`lbl`).  Nothing here touches a game: a picture is only
 * ever a picture.
 */

import type Phaser from 'phaser';

export const DEMO_W = 124;
export const DEMO_H = 90;

type G = Phaser.GameObjects.Graphics;
/** A label in the small font at (x, y), centred; `col` its colour. */
export type Lbl = (x: number, y: number, s: string, col?: number) => void;
export type Demo = (g: G, t: number, lbl: Lbl) => void;

// ---------------------------------------------------------------- the ink
const INK = 0x0a0812;
const CREAM = 0xf4ecd8;
const GOLD = 0xffd45e;
const GREEN = 0x5ac85a;
const DARK_GREEN = 0x2e7a3a;
const RED = 0xe05050;
const BLUE = 0x5a9ad8;
const GREY = 0x6a7080;
const TEAL = 0x5ad8c8;

/** 0..1 through a loop `p` seconds long. */
const ph = (t: number, p: number): number => (t % p) / p;
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const ease = (k: number): number => k * k * (3 - 2 * k);

/** A frog, sitting, centred on (x, y): `s` its size. */
function frog(g: G, x: number, y: number, s = 1, col = GREEN): void {
  g.fillStyle(DARK_GREEN, 1).fillEllipse(x, y + 2 * s, 12 * s, 5 * s);
  g.fillStyle(col, 1).fillEllipse(x, y, 11 * s, 8 * s);
  g.fillStyle(col, 1).fillCircle(x - 3 * s, y - 4 * s, 2.4 * s).fillCircle(x + 3 * s, y - 4 * s, 2.4 * s);
  g.fillStyle(0xffffff, 1).fillCircle(x - 3 * s, y - 4 * s, 1.5 * s).fillCircle(x + 3 * s, y - 4 * s, 1.5 * s);
  g.fillStyle(INK, 1).fillCircle(x - 2.6 * s, y - 4 * s, 0.8 * s).fillCircle(x + 3.4 * s, y - 4 * s, 0.8 * s);
}

/** A keycap at (x, y), pressed or not, its letter in the small font. */
function key(g: G, lbl: Lbl, x: number, y: number, k: string, down = false, w = 11): void {
  const dy = down ? 1 : 0;
  g.fillStyle(0x1a1626, 1).fillRect(x - w / 2, y - 5 + 1, w, 10);
  g.fillStyle(down ? TEAL : 0x3a3450, 1).fillRect(x - w / 2, y - 5 + dy, w, 9);
  g.lineStyle(1, down ? 0xffffff : 0x8a84a8, 1).strokeRect(x - w / 2 + 0.5, y - 4.5 + dy, w - 1, 8);
  lbl(x, y - 1 + dy, k, down ? INK : CREAM);
}

/** A fingertip, landing (down) or hovering, at (x, y). */
export function tip(g: G, x: number, y: number, down: boolean): void {
  g.fillStyle(0xffffff, down ? 0.9 : 0.45).fillCircle(x, y, down ? 2.5 : 3.5);
  if (down) g.lineStyle(1, 0xffffff, 0.5).strokeCircle(x, y, 5);
}

/** The pointer: an arrow cursor at (x, y), clicking or not. */
function cursor(g: G, x: number, y: number, click = false): void {
  g.fillStyle(INK, 1).fillTriangle(x, y, x, y + 8, x + 5, y + 6);
  g.fillStyle(0xffffff, 1).fillTriangle(x + 0.8, y + 1.5, x + 0.8, y + 6.5, x + 3.8, y + 5.4);
  if (click) g.lineStyle(1, GOLD, 0.9).strokeCircle(x, y, 4);
}

/** A coin, spinning a little. */
function coin(g: G, x: number, y: number, t: number): void {
  const w = 3 + Math.abs(Math.sin(t * 5)) * 2;
  g.fillStyle(0x9a6a10, 1).fillEllipse(x, y + 1, w * 2, 8);
  g.fillStyle(GOLD, 1).fillEllipse(x, y, w * 2, 8);
}

/** An arrow from a to b. */
function arrow(g: G, x1: number, y1: number, x2: number, y2: number, col = GOLD): void {
  g.lineStyle(1, col, 1).lineBetween(x1, y1, x2, y2);
  const a = Math.atan2(y2 - y1, x2 - x1);
  g.fillStyle(col, 1).fillTriangle(x2, y2, x2 - Math.cos(a - 0.5) * 4, y2 - Math.sin(a - 0.5) * 4, x2 - Math.cos(a + 0.5) * 4, y2 - Math.sin(a + 0.5) * 4);
}

/** A dotted arc of a throw from (x0, y0), `vx`/`vy` px a second, under `grav`. */
function dots(g: G, x0: number, y0: number, vx: number, vy: number, grav: number, col: number, n = 10, wind = 0): void {
  for (let i = 1; i <= n; i++) {
    const s = i * 0.09;
    g.fillStyle(col, 1).fillRect(Math.round(x0 + vx * s + wind * s * s), Math.round(y0 + vy * s + grav * s * s), 1, 1);
  }
}

/** A card face. */
function card(g: G, lbl: Lbl, x: number, y: number, face: string, red = false): void {
  g.fillStyle(INK, 1).fillRect(x - 6, y - 8 + 1, 12, 16);
  g.fillStyle(CREAM, 1).fillRect(x - 6, y - 8, 12, 16);
  lbl(x, y - 1, face, red ? RED : INK);
}

/** A bar `k` full, at (x, y). */
function bar(g: G, x: number, y: number, w: number, k: number, col: number): void {
  g.fillStyle(0x1a1626, 1).fillRect(x, y, w, 4);
  g.fillStyle(col, 1).fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, k))), 4);
  g.lineStyle(1, 0x8a84a8, 1).strokeRect(x + 0.5, y + 0.5, w - 1, 3);
}

/** A tick or a cross, said big. */
function verdict(g: G, x: number, y: number, ok: boolean): void {
  if (ok) {
    g.lineStyle(2, GREEN, 1).lineBetween(x - 4, y, x - 1, y + 3).lineBetween(x - 1, y + 3, x + 5, y - 4);
  } else {
    g.lineStyle(2, RED, 1).lineBetween(x - 4, y - 4, x + 4, y + 4).lineBetween(x + 4, y - 4, x - 4, y + 4);
  }
}

const sky = (g: G, top: number, bottom: number): void => {
  g.fillStyle(top, 1).fillRect(0, 0, DEMO_W, DEMO_H);
  g.fillStyle(bottom, 1).fillRect(0, DEMO_H - 18, DEMO_W, 18);
};

// ---------------------------------------------------------------- the pictures

export const DEMOS: Record<string, Demo> = {
  // ---------- MINI DUELS
  'ttt.pick': (g, t, lbl) => {
    const k = ph(t, 2.4);
    g.fillStyle(0x1a1430, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const on = k < 0.5 ? 0 : 1;
    for (let i = 0; i < 2; i++) {
      const x = 32 + i * 60;
      g.fillStyle(i === on ? 0x3a2a68 : 0x241a40, 1).fillRect(x - 26, 22, 52, 40);
      g.lineStyle(1, i === on ? GOLD : 0x5a4a88, 1).strokeRect(x - 25.5, 22.5, 51, 39);
    }
    // a little board, and a little hand
    g.lineStyle(1, CREAM, 1).lineBetween(26, 32, 26, 52).lineBetween(38, 32, 38, 52).lineBetween(18, 39, 46, 39).lineBetween(18, 46, 46, 46);
    g.fillStyle(CREAM, 1).fillCircle(92, 42, 7);
    lbl(32, 70, 'TIC-TAC-TOE', on === 0 ? GOLD : CREAM);
    lbl(92, 70, 'ROCK-PAPER', on === 1 ? GOLD : CREAM);
    lbl(92, 77, 'SCISSORS', on === 1 ? GOLD : CREAM);
    cursor(g, on === 0 ? 34 : 94, 44, (k % 0.5) > 0.3);
  },
  'ttt.board': (g, t, lbl) => {
    g.fillStyle(0x1a1430, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const x0 = 38;
    const y0 = 14;
    const c = 16;
    g.lineStyle(1, CREAM, 1);
    for (let i = 1; i < 3; i++) g.lineBetween(x0 + i * c, y0, x0 + i * c, y0 + 3 * c).lineBetween(x0, y0 + i * c, x0 + 3 * c, y0 + i * c);
    const moves: Array<[number, number, 'x' | 'o']> = [[0, 0, 'x'], [1, 1, 'o'], [1, 0, 'x'], [2, 2, 'o'], [2, 0, 'x']];
    const n = Math.floor(ph(t, 5) * 7);
    moves.slice(0, n).forEach(([cx, cy, w]) => {
      const x = x0 + cx * c + c / 2;
      const y = y0 + cy * c + c / 2;
      if (w === 'x') g.lineStyle(2, GOLD, 1).lineBetween(x - 4, y - 4, x + 4, y + 4).lineBetween(x + 4, y - 4, x - 4, y + 4);
      else g.lineStyle(2, BLUE, 1).strokeCircle(x, y, 4.5);
    });
    if (n >= 6) {
      g.lineStyle(2, GREEN, 1).lineBetween(x0 + 4, y0 + c / 2, x0 + 3 * c - 4, y0 + c / 2);
      lbl(DEMO_W / 2, 74, 'THREE IN A ROW!', GREEN);
    } else lbl(DEMO_W / 2, 74, 'CLICK A SQUARE', CREAM);
  },
  'ttt.rps': (g, t, lbl) => {
    g.fillStyle(0x1a1430, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const names = ['ROCK', 'PAPER', 'SCISSORS'];
    const i = Math.floor(ph(t, 4.5) * 3);
    const beats = (i + 2) % 3;
    const shape = (x: number, y: number, which: number, col: number): void => {
      if (which === 0) g.fillStyle(col, 1).fillCircle(x, y, 8);
      else if (which === 1) g.fillStyle(col, 1).fillRect(x - 7, y - 9, 14, 18);
      else g.lineStyle(2, col, 1).lineBetween(x - 6, y - 8, x + 4, y + 6).lineBetween(x + 6, y - 8, x - 4, y + 6);
    };
    shape(34, 36, i, GOLD);
    shape(90, 36, beats, GREY);
    lbl(62, 36, 'BEATS', CREAM);
    lbl(34, 58, names[i], GOLD);
    lbl(90, 58, names[beats], GREY);
  },
  'ttt.pay': (g, t, lbl) => {
    g.fillStyle(0x1a1430, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 3);
    lbl(36, 16, 'WIN', GREEN);
    lbl(88, 16, 'DRAW', GOLD);
    for (let i = 0; i < 3; i++) coin(g, 26 + i * 10, 40 - Math.max(0, Math.sin((k * 2 - i * 0.2) * Math.PI)) * 8, t + i);
    coin(g, 88, 40, t);
    lbl(36, 62, 'IT PAYS', CREAM);
    lbl(88, 62, 'TOKEN BACK', CREAM);
  },

  // ---------- HOOPS
  'hoops.flick': (g, t, lbl) => {
    sky(g, 0x284a6a, 0x2a6a3a);
    const k = ph(t, 2.2);
    const crouch = k < 0.45;
    frog(g, 22, crouch ? 70 : 68, 1.2);
    if (crouch) bar(g, 10, 80, 26, k / 0.45, GOLD);
    if (!crouch) {
      const s = (k - 0.45) / 0.55;
      const x = lerp(26, 96, s);
      const y = 64 - Math.sin(s * Math.PI) * 40;
      g.fillStyle(INK, 1).fillCircle(x, y, 2);
      g.fillStyle(0xd0e0ff, 0.8).fillEllipse(x - 2, y - 2, 4, 2).fillEllipse(x + 2, y - 2, 4, 2);
    }
    lbl(DEMO_W / 2, 8, crouch ? 'HOLD: CROUCH' : 'LET GO: FLICK', crouch ? GOLD : CREAM);
  },
  'hoops.tilt': (g, t, lbl) => {
    sky(g, 0x284a6a, 0x2a6a3a);
    const k = Math.sin(t * 1.6) * 0.5 + 0.5;
    frog(g, 20, 70, 1.1);
    const green = Math.abs(k - 0.62) < 0.12;
    dots(g, 24, 64, 90, -80 - k * 60, 110, green ? GREEN : CREAM, 14);
    // the target pad
    g.fillStyle(DARK_GREEN, 1).fillEllipse(100, 74, 22, 6);
    lbl(DEMO_W / 2, 8, green ? 'GREEN: IT LANDS' : 'TILT THE SHOT', green ? GREEN : CREAM);
  },
  'hoops.lead': (g, t, lbl) => {
    sky(g, 0x284a6a, 0x2a6a3a);
    const x = 70 + Math.sin(t * 1.2) * 24;
    g.fillStyle(DARK_GREEN, 1).fillEllipse(x, 74, 24, 6);
    frog(g, x, 66, 1.4, 0x7ae06a);
    arrow(g, x + (Math.cos(t * 1.2) > 0 ? 6 : -6), 54, x + (Math.cos(t * 1.2) > 0 ? 18 : -18), 54, GOLD);
    lbl(DEMO_W / 2, 8, 'IT DRIFTS: AIM AHEAD', CREAM);
    lbl(DEMO_W / 2, 18, '5 FLIES IN 75 SECONDS', GOLD);
  },
  'hoops.streak': (g, t, lbl) => {
    sky(g, 0x284a6a, 0x2a6a3a);
    const k = ph(t, 2);
    for (let i = 0; i < 2; i++) {
      g.fillStyle(INK, 1).fillCircle(40 + i * 20, 40, 2.5);
      verdict(g, 40 + i * 20, 54, true);
    }
    g.fillStyle(GOLD, 0.4 + 0.5 * Math.sin(k * Math.PI)).fillCircle(90, 40, 7);
    g.fillStyle(INK, 1).fillCircle(90, 40, 2.5);
    lbl(DEMO_W / 2, 10, 'TWO IN A ROW', CREAM);
    lbl(DEMO_W / 2, 72, 'THE LIT FLY PAYS 2', GOLD);
  },

  // ---------- WHACK-A-FROG
  'whack.hit': (g, t, lbl) => {
    g.fillStyle(0x3a5a2a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 1.6);
    for (let i = 0; i < 3; i++) {
      const x = 26 + i * 36;
      g.fillStyle(0x1a1008, 1).fillEllipse(x, 56, 22, 8);
      if (i === 1) {
        const up = k < 0.7 ? Math.min(1, k / 0.2) : Math.max(0, 1 - (k - 0.7) / 0.2);
        frog(g, x, 56 - up * 10, 1.1);
        g.fillStyle(0x1a1008, 1).fillRect(x - 12, 58, 24, 6);
        // the mallet
        const swing = k > 0.4 && k < 0.6;
        g.fillStyle(0x8a5a2a, 1).fillRect(x + 6, swing ? 30 : 22, 3, 14);
        g.fillStyle(RED, 1).fillRect(x + 1, swing ? 40 : 18, 13, 7);
        if (swing) lbl(x, 26, 'WHACK!', GOLD);
      }
    }
    lbl(DEMO_W / 2, 80, 'CLICK A FROG', CREAM);
  },
  'whack.quick': (g, t, lbl) => {
    g.fillStyle(0x3a5a2a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    for (let i = 0; i < 5; i++) {
      const x = 14 + i * 24;
      g.fillStyle(0x1a1008, 1).fillEllipse(x, 50, 18, 7);
      const k = ph(t * (1 + i * 0.3), 1.2);
      if (k < 0.4) frog(g, x, 50 - Math.sin((k / 0.4) * Math.PI) * 9, 0.9);
      g.fillStyle(0x1a1008, 1).fillRect(x - 10, 52, 20, 5);
    }
    lbl(DEMO_W / 2, 14, 'THEY DUCK BACK DOWN', CREAM);
    lbl(DEMO_W / 2, 74, 'AND GET QUICKER', GOLD);
  },
  'whack.pay': (g, t, lbl) => {
    g.fillStyle(0x1a1430, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 3);
    const hits = Math.floor(k * 70);
    bar(g, 12, 40, 100, hits / 70, hits >= 55 ? GREEN : hits >= 45 ? GOLD : GREY);
    g.fillStyle(GOLD, 1).fillRect(12 + Math.round((45 / 70) * 100), 36, 1, 12);
    g.fillStyle(GREEN, 1).fillRect(12 + Math.round((55 / 70) * 100), 36, 1, 12);
    lbl(DEMO_W / 2, 20, `${hits} WHACKS`, CREAM);
    lbl(76, 56, '45: 10', GOLD);
    lbl(104, 56, '55: 15', GREEN);
  },

  // ---------- BOWLING
  'bowl.aim': (g, t, lbl) => {
    g.fillStyle(0x6a4a2a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.fillStyle(0xc89a5a, 1).fillRect(40, 0, 44, DEMO_H);
    const x = 62 + Math.sin(t * 1.4) * 14;
    const aim = Math.sin(t * 2.1) * 0.25;
    g.lineStyle(1, GOLD, 0.8).lineBetween(x, 78, x + Math.sin(aim) * 60, 78 - Math.cos(aim) * 60);
    g.fillStyle(0x3a2a68, 1).fillCircle(x, 78, 4);
    for (const [px, py] of [[62, 10], [57, 6], [67, 6]]) g.fillStyle(CREAM, 1).fillCircle(px, py, 1.6);
    lbl(20, 40, 'WALK', CREAM);
    lbl(104, 40, 'AIM', GOLD);
  },
  'bowl.hook': (g, t, lbl) => {
    g.fillStyle(0x6a4a2a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.fillStyle(0xc89a5a, 1).fillRect(40, 0, 44, DEMO_H);
    const bend = Math.sin(t * 1.2);
    for (let i = 0; i <= 16; i++) {
      const s = i / 16;
      g.fillStyle(bend > 0 ? GOLD : TEAL, 1).fillRect(Math.round(62 + bend * 14 * s * s), Math.round(80 - s * 70), 1, 1);
    }
    lbl(DEMO_W / 2, 84, bend > 0 ? 'HOOK RIGHT' : 'HOOK LEFT', CREAM);
  },
  'bowl.throw': (g, t, lbl) => {
    g.fillStyle(0x6a4a2a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.fillStyle(0xc89a5a, 1).fillRect(40, 0, 44, DEMO_H);
    // an oil patch, and its shove
    g.fillStyle(0x2a2418, 0.6).fillRect(52, 30, 18, 16);
    arrow(g, 56, 38, 68, 38, 0xffb060);
    const k = ph(t, 2.6);
    if (k < 0.4) bar(g, 10, 70, 26, k / 0.4, GOLD);
    else {
      const s = (k - 0.4) / 0.6;
      const shove = s > 0.45 ? (s - 0.45) * 14 : 0;
      g.fillStyle(0x3a2a68, 1).fillCircle(58 + shove, 80 - s * 72, 4);
    }
    lbl(20, 60, k < 0.4 ? 'HOLD' : 'THROW', GOLD);
    lbl(104, 38, 'OIL', 0xffb060);
  },
  'bowl.score': (g, t, lbl) => {
    g.fillStyle(0x1a1430, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 2.4);
    const pins: Array<[number, number]> = [[62, 20], [57, 28], [67, 28], [52, 36], [62, 36], [72, 36]];
    pins.forEach(([x, y], i) => {
      const down = k > 0.3 + i * 0.03;
      g.fillStyle(CREAM, down ? 0.35 : 1).fillCircle(x + (down ? (i % 2 ? 4 : -4) : 0), y, 2);
    });
    lbl(DEMO_W / 2, 58, k > 0.5 ? 'STRIKE! +5' : '', GOLD);
    lbl(DEMO_W / 2, 72, 'SPARE +3. A TIE REFUNDS', CREAM);
  },

  // ---------- POND HUNT
  'pond.hide': (g, t, lbl) => {
    g.fillStyle(0x1a4a6a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 3);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) g.fillStyle(DARK_GREEN, 1).fillEllipse(17 + c * 18, 18 + r * 16, 12, 7);
    if (k > 0.5) frog(g, 53, 34, 0.7);
    cursor(g, k < 0.5 ? lerp(10, 53, ease(k * 2)) : 53, k < 0.5 ? lerp(80, 34, ease(k * 2)) : 34, k > 0.45 && k < 0.6);
    lbl(DEMO_W / 2, 84, 'HIDE ON YOUR POND', CREAM);
  },
  'pond.hunt': (g, t, lbl) => {
    g.fillStyle(0x1a4a6a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) g.fillStyle(DARK_GREEN, 1).fillEllipse(17 + c * 18, 18 + r * 16, 12, 7);
    const k = ph(t, 3);
    const hit = k > 0.5;
    const [cx, cy] = hit ? [71, 50] : [35, 18];
    g.lineStyle(1, 0xffffff, 0.8).strokeCircle(cx, cy, 3 + ph(t, 0.6) * 6);
    if (hit) frog(g, cx, cy, 0.7, GOLD);
    lbl(DEMO_W / 2, 84, hit ? 'FOUND ONE' : 'A MISS', hit ? GOLD : CREAM);
  },
  'pond.clues': (g, t, lbl) => {
    g.fillStyle(0x1a4a6a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) g.fillStyle(DARK_GREEN, 1).fillEllipse(17 + c * 18, 18 + r * 16, 12, 7);
    const k = ph(t, 1.2);
    g.lineStyle(1, 0xffffff, 1 - k).strokeCircle(53, 34, 2 + k * 10);
    for (let i = 0; i < 3; i++) g.fillStyle(0xd0f0ff, 0.8).fillCircle(89 + i * 2, 50 - ((k * 12 + i * 4) % 12), 1);
    lbl(53, 76, 'RIPPLE', CREAM);
    lbl(92, 76, 'BUBBLES', CREAM);
    lbl(DEMO_W / 2, 6, 'THEY MOVE - FOLLOW THE CLUES', GOLD);
  },

  // ---------- GRUDGE
  'grudge.move': (g, t, lbl) => {
    sky(g, 0x2a1e3a, 0x4a3a2a);
    const x = 40 + Math.sin(t * 1.5) * 20;
    const k = ph(t, 2);
    const jump = k > 0.5 && k < 0.8 ? Math.sin(((k - 0.5) / 0.3) * Math.PI) * 14 : 0;
    const crouch = k > 0.15 && k < 0.35;
    frog(g, x, 66 - jump + (crouch ? 3 : 0), crouch ? 1 : 1.2);
    lbl(DEMO_W / 2, 8, jump ? 'JUMP' : crouch ? 'CROUCH' : 'WALK', GOLD);
  },
  'grudge.high': (g, t, lbl) => {
    sky(g, 0x2a1e3a, 0x4a3a2a);
    const k = ph(t, 1.4);
    frog(g, 40, 64, 1.3);
    g.fillStyle(0xc87a4a, 1).fillEllipse(84, 60, 14, 20);
    const hit = k > 0.3 && k < 0.55;
    g.fillStyle(GREEN, 1).fillRect(46, 56, hit ? 26 : 8, 4);
    if (hit) lbl(84, 40, 'HIT!', GOLD);
    lbl(DEMO_W / 2, 8, 'HIGH: BEATS ONE STANDING', CREAM);
  },
  'grudge.low': (g, t, lbl) => {
    sky(g, 0x2a1e3a, 0x4a3a2a);
    const k = ph(t, 2.8);
    const sweep = k < 0.5;
    frog(g, 40, 66, 1.3);
    if (sweep) {
      g.fillStyle(0xc87a4a, 1).fillEllipse(84, 68, 16, 12);
      const hit = k > 0.15 && k < 0.35;
      g.fillStyle(GREEN, 1).fillRect(46, 68, hit ? 26 : 8, 3);
      if (hit) lbl(84, 52, 'HIT!', GOLD);
      lbl(DEMO_W / 2, 8, 'LOW: BEATS ONE CROUCHING', CREAM);
    } else {
      g.fillStyle(0xc87a4a, 1).fillEllipse(84, 60, 14, 20);
      g.lineStyle(2, TEAL, 1).lineBetween(52, 52, 52, 72);
      lbl(DEMO_W / 2, 8, 'BLOCK: TAKE LESS', CREAM);
    }
  },
  'grudge.special': (g, t, lbl) => {
    sky(g, 0x2a1e3a, 0x4a3a2a);
    const k = ph(t, 3);
    frog(g, 36, 64, 1.3);
    g.fillStyle(0xc87a4a, 1).fillEllipse(90, 60, 14, 20);
    if (k < 0.3) {
      g.fillStyle(GOLD, 0.8).fillCircle(lerp(44, 88, k / 0.3), 58, 5);
    }
    // the cooldown coming back
    const back = Math.min(1, Math.max(0, (k - 0.3) / 0.7));
    g.lineStyle(2, 0x4a4060, 1).strokeCircle(62, 24, 8);
    g.lineStyle(2, TEAL, 1).beginPath().arc(62, 24, 8, -Math.PI / 2, -Math.PI / 2 + back * Math.PI * 2, false).strokePath();
    lbl(62, 24, back >= 1 ? 'GO' : '', GOLD);
    lbl(DEMO_W / 2, 82, 'IT HURTS, THEN RECHARGES', CREAM);
  },

  // ---------- BARREL CLIMB
  'kong.climb': (g, t, lbl) => {
    g.fillStyle(0x10101e, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    for (const y of [26, 54, 82]) g.fillStyle(0xc83a3a, 1).fillRect(6, y, 112, 3);
    g.fillStyle(0x5ad8f0, 1).fillRect(88, 54, 2, 28).fillRect(96, 54, 2, 28);
    for (let i = 0; i < 6; i++) g.fillRect(88, 58 + i * 4, 10, 1);
    const k = ph(t, 4);
    const x = k < 0.5 ? lerp(20, 93, k * 2) : 93;
    const y = k < 0.5 ? 76 : lerp(76, 48, (k - 0.5) * 2);
    frog(g, x, y, 0.9);
    lbl(40, 46, k < 0.5 ? 'RUN' : 'CLIMB', GOLD);
  },
  'kong.jump': (g, t, lbl) => {
    g.fillStyle(0x10101e, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.fillStyle(0xc83a3a, 1).fillRect(6, 74, 112, 3);
    const k = ph(t, 2);
    const bx = lerp(120, -10, k);
    g.fillStyle(0xe8c040, 1).fillCircle(bx, 69, 4.5);
    g.lineStyle(1, 0x8a6a10, 1).strokeCircle(bx, 69, 3);
    const near = Math.abs(bx - 50);
    const jump = near < 16 ? Math.cos((near / 16) * (Math.PI / 2)) * 14 : 0;
    frog(g, 50, 68 - jump, 1);
    lbl(DEMO_W / 2, 10, 'YELLOW ROLLS: JUMP IT', CREAM);
  },
  'kong.hop': (g, t, lbl) => {
    g.fillStyle(0x10101e, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.fillStyle(0xc83a3a, 1).fillRect(6, 74, 112, 3);
    const k = ph(t, 2.2);
    const bx = lerp(110, 10, k);
    const up = Math.abs(Math.sin(k * Math.PI * 3)) * 18;
    g.fillStyle(0xe87a30, 1).fillCircle(bx, 69 - up, 4.5);
    frog(g, 54, 68, 1);
    lbl(DEMO_W / 2, 10, 'ORANGE HOPS: GO UNDER', CREAM);
  },
  'kong.lives': (g, t, lbl) => {
    g.fillStyle(0x10101e, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 3);
    for (let i = 0; i < 3; i++) frog(g, 40 + i * 22, 38, 0.8, i === 2 && k > 0.5 ? GREY : GREEN);
    lbl(DEMO_W / 2, 16, 'THREE LIVES', CREAM);
    lbl(DEMO_W / 2, 64, 'REACH THE EXIT AT THE TOP', GOLD);
  },

  // ---------- AIR HOCKEY
  'hockey.mallet': (g, t, lbl) => {
    g.fillStyle(0x1a3a5a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.lineStyle(1, 0x5a9ad8, 1).lineBetween(DEMO_W / 2, 0, DEMO_W / 2, DEMO_H).strokeCircle(DEMO_W / 2, DEMO_H / 2, 12);
    const x = 30 + Math.sin(t * 1.3) * 16;
    const y = 45 + Math.sin(t * 2.1) * 20;
    g.fillStyle(RED, 1).fillCircle(x, y, 7);
    g.fillStyle(0xffa0a0, 1).fillCircle(x, y, 3);
    cursor(g, x + 2, y + 2);
    lbl(DEMO_W / 2, 10, 'IT FOLLOWS THE MOUSE', CREAM);
  },
  'hockey.goal': (g, t, lbl) => {
    g.fillStyle(0x1a3a5a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.fillStyle(INK, 1).fillRect(DEMO_W - 4, 30, 4, 30);
    const k = ph(t, 1.8);
    g.fillStyle(RED, 1).fillCircle(24, 45, 7);
    g.fillStyle(INK, 1).fillCircle(lerp(34, 120, k), 45 + Math.sin(k * 6) * 6, 4);
    lbl(DEMO_W / 2, 10, 'FIRST TO FIVE', GOLD);
    if (k > 0.85) lbl(100, 72, 'GOAL!', GREEN);
  },
  'hockey.reset': (g, t, lbl) => {
    g.fillStyle(0x1a3a5a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.lineStyle(1, 0x5a9ad8, 1).lineBetween(DEMO_W / 2, 0, DEMO_W / 2, DEMO_H);
    const k = ph(t, 3);
    g.fillStyle(RED, 1).fillCircle(lerp(90, 30, ease(Math.min(1, k * 1.5))), 45, 7);
    lbl(DEMO_W / 2, 10, `${3 - Math.floor(k * 3)}`, GOLD);
    lbl(DEMO_W / 2, 80, 'BACK TO YOUR HALF', CREAM);
  },

  // ---------- FLOOD
  'flood.jump': (g, t, lbl) => {
    g.fillStyle(0x16202a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const ledges: Array<[number, number]> = [[20, 76], [62, 58], [100, 40]];
    for (const [x, y] of ledges) g.fillStyle(0x8a7a5a, 1).fillRect(x - 12, y, 24, 4);
    const k = ph(t, 3);
    const i = Math.min(1, Math.floor(k * 2));
    const s = (k * 2) % 1;
    const [x0, y0] = ledges[i];
    const [x1, y1] = ledges[i + 1];
    frog(g, lerp(x0, x1, s), lerp(y0, y1, s) - 4 - Math.sin(s * Math.PI) * 12, 0.9);
    lbl(30, 12, 'JUMP', GOLD);
  },
  'flood.ledges': (g, t, lbl) => {
    g.fillStyle(0x16202a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.fillStyle(0x8a7a5a, 1).fillRect(20 + Math.sin(t * 1.5) * 16, 30, 24, 4);
    lbl(32, 22, 'SLIDES', CREAM);
    const c = ph(t, 2);
    g.fillStyle(0x8a7a5a, c < 0.6 ? 1 : 0.3).fillRect(78, 54 + (c > 0.6 ? (c - 0.6) * 30 : 0), 24, 4);
    lbl(90, 46, 'CRUMBLES', CREAM);
  },
  'flood.water': (g, t, lbl) => {
    g.fillStyle(0x16202a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 4);
    const top = lerp(86, 30, k);
    g.fillStyle(0x2a6ab8, 0.85).fillRect(0, top, DEMO_W, DEMO_H - top);
    for (let x = 0; x < DEMO_W; x += 6) g.fillStyle(0x8ac8ff, 1).fillRect(x + Math.round(Math.sin(t * 4 + x) * 1.5), top, 3, 1);
    g.fillStyle(0x9a9aaa, 1).fillRect(52, 4, 20, 4);
    lbl(62, 14, 'THE HATCH', GOLD);
    lbl(DEMO_W / 2, top - 6 > 20 ? top - 6 : 22, 'DO NOT LET IT REACH YOU', CREAM);
  },

  // ---------- DANCE OFF
  'dance.arrows': (g, t, lbl) => {
    g.fillStyle(0x1a1030, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.fillStyle(0x4a3a68, 1).fillRect(20, 14, 84, 2);
    const cols = [0xff5a8a, 0x5ad8f0, 0x8ae86a, 0xffd45e];
    for (let i = 0; i < 4; i++) {
      const x = 32 + i * 20;
      const y = 14 + ((ph(t + i * 0.4, 1.6) * 80) % 80);
      g.fillStyle(cols[i], 1).fillTriangle(x - 5, y + 4, x + 5, y + 4, x, y - 4);
      g.lineStyle(1, cols[i], 0.5).strokeTriangle(x - 5, 19, x + 5, 19, x, 11);
    }
    lbl(DEMO_W / 2, 84, 'HIT IT ON THE LINE', CREAM);
  },
  'dance.keys': (g, t, lbl) => {
    g.fillStyle(0x1a1030, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const i = Math.floor(ph(t, 2.4) * 4);
    const keys = ['A', 'S', 'W', 'D'];
    const words = ['LEFT', 'DOWN', 'UP', 'RIGHT'];
    keys.forEach((k, j) => key(g, lbl, 22 + j * 27, 40, k, j === i));
    lbl(DEMO_W / 2, 60, words[i], GOLD);
    lbl(DEMO_W / 2, 78, 'A WRONG KEY COSTS 100', RED);
  },
  'dance.rounds': (g, t, lbl) => {
    g.fillStyle(0x1a1030, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const won = Math.floor(ph(t, 4.5) * 4);
    const pays = ['20', '35', '50'];
    for (let i = 0; i < 3; i++) {
      g.fillStyle(i < won ? GOLD : 0x3a3050, 1).fillCircle(32 + i * 30, 38, 8);
      lbl(32 + i * 30, 56, pays[i], i < won ? GOLD : GREY);
    }
    lbl(DEMO_W / 2, 14, 'THREE ROUNDS', CREAM);
    lbl(DEMO_W / 2, 76, 'LOSE ONE: STOP, KEEP IT', CREAM);
  },

  // ---------- FROG CROSS
  'cross.hop': (g, t, lbl) => {
    g.fillStyle(0x3a3a3a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.fillStyle(0x3a7a3a, 1).fillRect(0, 0, DEMO_W, 12).fillRect(0, DEMO_H - 12, DEMO_W, 12);
    const steps = Math.floor(ph(t, 3) * 6);
    frog(g, 62, 82 - steps * 14, 0.8);
    lbl(102, 46, 'HOP', GOLD);
  },
  'cross.cars': (g, t, lbl) => {
    g.fillStyle(0x3a3a3a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    for (let l = 0; l < 4; l++) {
      const y = 16 + l * 18;
      const dir = l % 2 ? -1 : 1;
      for (let c = 0; c < 2; c++) {
        const x = ((ph(t * (0.7 + l * 0.2), 2) * 160 + c * 80) % 160) - 20;
        g.fillStyle(l % 2 ? BLUE : RED, 1).fillRect(dir > 0 ? x : DEMO_W - x, y - 4, l === 2 ? 22 : 14, 8);
      }
    }
    frog(g, 62, 84, 0.7);
    lbl(DEMO_W / 2, 6, 'GO THROUGH THE GAPS', CREAM);
  },
  'cross.bank': (g, t, lbl) => {
    g.fillStyle(0x1a1430, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const n = Math.floor(ph(t, 4) * 6);
    for (let i = 0; i < 5; i++) verdict(g, 22 + i * 20, 34, i < n);
    lbl(DEMO_W / 2, 14, 'FIVE CROSSINGS', CREAM);
    lbl(DEMO_W / 2, 58, n >= 5 ? 'PAYS 20 - BANK IT' : '', GOLD);
    lbl(DEMO_W / 2, 74, 'THREE LIVES', CREAM);
  },

  // ---------- CAR CHASE
  'chase.drive': (g, t, lbl) => {
    g.fillStyle(0x3a3a3a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    for (let i = 0; i < 6; i++) g.fillStyle(CREAM, 1).fillRect(41, ((i * 16 + t * 60) % 96) - 6, 2, 8).fillRect(81, ((i * 16 + t * 60) % 96) - 6, 2, 8);
    const x = 62 + Math.sin(t * 1.4) * 34;
    g.fillStyle(GREEN, 1).fillRect(x - 6, 62, 12, 18);
    g.fillStyle(INK, 1).fillRect(x - 4, 66, 8, 4);
    lbl(DEMO_W / 2, 6, 'STEER, SPEED UP, EASE OFF', CREAM);
  },
  'chase.cash': (g, t, lbl) => {
    g.fillStyle(0x3a3a3a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 2);
    for (let i = 0; i < 3; i++) {
      const y = ((k * 100 + i * 33) % 100) - 10;
      if (y < 60) {
        g.fillStyle(0x3aa84a, 1).fillRect(56 - 5, y, 10, 6);
        lbl(56, y + 3, '$', CREAM);
      }
    }
    g.fillStyle(GREEN, 1).fillRect(50, 64, 12, 18);
    lbl(98, 30, '300: 20', GOLD);
    lbl(98, 42, '+5 PER 100', GOLD);
  },
  'chase.bomb': (g, t, lbl) => {
    g.fillStyle(0x3a3a3a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 2.4);
    g.fillStyle(GREEN, 1).fillRect(56, 20, 12, 18);
    const spin = k > 0.5;
    g.fillStyle(BLUE, 1).fillRect(56, 66, 12, 18);
    if (!spin) g.fillStyle(INK, 1).fillCircle(62, lerp(40, 64, k * 2), 3);
    else {
      g.lineStyle(1, GOLD, 1).strokeCircle(62, 74, 6 + (k - 0.5) * 20);
      lbl(98, 74, 'SPUN OUT', GOLD);
    }
    lbl(98, 30, 'BOMB: 30', CREAM);
  },
  'chase.hazards': (g, _t, lbl) => {
    g.fillStyle(0x3a3a3a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.fillStyle(INK, 0.8).fillEllipse(26, 40, 16, 8);
    lbl(26, 54, 'OIL: SPIN', CREAM);
    g.fillStyle(0x1a1a1a, 1).fillCircle(62, 40, 5);
    lbl(62, 54, 'POTHOLE', CREAM);
    g.fillStyle(0x9a9aa0, 1).fillRect(90, 34, 20, 12);
    lbl(100, 54, 'CONCRETE', RED);
    lbl(DEMO_W / 2, 76, 'DAMAGE ADDS UP', GOLD);
  },

  // ---------- FENCE WARS
  'fence.aim': (g, t, lbl) => {
    sky(g, 0x5a8ac8, 0x4a8a3a);
    g.fillStyle(0x8a6a4a, 1).fillRect(60, 40, 5, 32);
    frog(g, 18, 66, 1);
    const k = Math.sin(t * 1.4) * 0.5 + 0.5;
    dots(g, 22, 60, 60, -60 - k * 50, 70, CREAM, 12);
    lbl(DEMO_W / 2, 10, 'AIM HIGHER OR LOWER', CREAM);
  },
  'fence.power': (g, t, lbl) => {
    sky(g, 0x5a8ac8, 0x4a8a3a);
    g.fillStyle(0x8a6a4a, 1).fillRect(60, 40, 5, 32);
    frog(g, 18, 66, 1);
    g.fillStyle(0x7a9a6a, 1).fillEllipse(106, 66, 12, 10);
    const k = ph(t, 2.6);
    if (k < 0.4) bar(g, 6, 78, 30, k / 0.4, GOLD);
    else {
      const s = (k - 0.4) / 0.6;
      g.fillStyle(GREY, 1).fillCircle(lerp(22, 104, s), 60 - Math.sin(s * Math.PI) * 44, 3);
    }
    lbl(DEMO_W / 2, 10, k < 0.4 ? 'HOLD FOR POWER' : 'LET GO TO THROW', GOLD);
  },
  'fence.wind': (g, t, lbl) => {
    sky(g, 0x5a8ac8, 0x4a8a3a);
    g.fillStyle(0x8a6a4a, 1).fillRect(60, 40, 5, 32);
    const w = Math.sin(t * 0.8) * 60;
    arrow(g, 62, 14, 62 + w / 4, 14, CREAM);
    dots(g, 22, 60, 62, -110, 90, GOLD, 14, w);
    lbl(DEMO_W / 2, 24, 'THE WIND BENDS IT', CREAM);
  },
  'fence.items': (g, t, lbl) => {
    g.fillStyle(0x1a1430, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const i = Math.floor(ph(t, 4.8) * 6);
    const cols = [GREY, RED, GREEN, 0x9a5ad8, 0x5ad8f0, 0xffb0e0];
    const names = ['ROCK', 'DYNAMITE', 'HEAL', 'POISON', 'SLEEP', 'CONFUSE'];
    for (let j = 0; j < 6; j++) {
      g.fillStyle(j === i ? 0x3a2a68 : 0x241a40, 1).fillRect(8 + j * 18, 30, 16, 16);
      g.fillStyle(cols[j], 1).fillCircle(16 + j * 18, 38, 4);
      lbl(16 + j * 18, 54, `${j + 1}`, j === i ? GOLD : GREY);
    }
    lbl(DEMO_W / 2, 72, names[i], GOLD);
  },

  // ---------- BOG BALL
  'bog.pick': (g, t, lbl) => {
    g.fillStyle(0x4a5a2a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const i = Math.floor(ph(t, 3) * 3);
    for (let j = 0; j < 3; j++) {
      frog(g, 24, 22 + j * 24, 0.9);
      if (j === i) g.lineStyle(1, GOLD, 1).strokeCircle(24, 22 + j * 24, 9);
    }
    cursor(g, 28, 24 + i * 24, true);
    lbl(80, 46, 'PICK A FROG', CREAM);
  },
  'bog.sling': (g, t, lbl) => {
    g.fillStyle(0x4a5a2a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 2.4);
    if (k < 0.5) {
      const pull = ease(k * 2) * 24;
      frog(g, 40 - pull, 46 + pull * 0.3, 1);
      arrow(g, 40 - pull, 46 + pull * 0.3, 40 + pull * 2, 46 - pull * 0.6, GOLD);
      lbl(DEMO_W / 2, 8, 'DRAG BACK', GOLD);
    } else {
      const s = (k - 0.5) * 2;
      frog(g, lerp(16, 110, s), lerp(53, 20, s), 1);
      lbl(DEMO_W / 2, 8, 'LET GO', GOLD);
    }
  },
  'bog.goal': (g, t, lbl) => {
    g.fillStyle(0x4a5a2a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.lineStyle(2, 0xc89a5a, 1).strokeRect(100, 30, 18, 30);
    const k = ph(t, 2);
    g.fillStyle(0x6a4a2a, 1).fillCircle(lerp(40, 110, k), 45, 5);
    frog(g, lerp(20, 34, Math.min(1, k * 4)), 45, 0.9);
    lbl(DEMO_W / 2, 8, 'INTO HIS ARCH', CREAM);
    lbl(DEMO_W / 2, 80, 'TEN SHOTS EACH', GOLD);
  },

  // ---------- SLOTS
  'slots.spin': (g, t, lbl) => {
    g.fillStyle(0x2a1030, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 2.4);
    const cols = [GOLD, GREEN, BLUE, RED, 0x9a5ad8];
    for (let r = 0; r < 5; r++) {
      const stop = k > 0.2 + r * 0.12;
      for (let row = 0; row < 3; row++) {
        const c = stop ? cols[(r + row) % 5] : cols[Math.floor(t * 20 + r + row) % 5];
        g.fillStyle(c, 1).fillCircle(18 + r * 22, 26 + row * 16, 5);
      }
    }
    lbl(DEMO_W / 2, 82, 'SPIN', GOLD);
  },
  'slots.lines': (g, t, lbl) => {
    g.fillStyle(0x2a1030, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const which = Math.floor(ph(t, 4.5) * 3);
    for (let r = 0; r < 5; r++) for (let row = 0; row < 3; row++) g.fillStyle(0x4a3a68, 1).fillCircle(18 + r * 22, 26 + row * 16, 5);
    const line: Array<[number, number]> = which === 0 ? [[0, 1], [1, 1], [2, 1], [3, 1]] : which === 1 ? [[2, 0], [2, 1], [2, 2]] : [[0, 0], [1, 1], [2, 2]];
    for (const [c, r] of line) g.fillStyle(GOLD, 1).fillCircle(18 + c * 22, 26 + r * 16, 5);
    lbl(DEMO_W / 2, 82, ['ACROSS', 'DOWN', 'DIAGONAL'][which], GOLD);
  },
  'slots.froggy': (g, t, lbl) => {
    g.fillStyle(0x2a1030, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    for (let i = 0; i < 3; i++) frog(g, 30 + i * 32, 34, 1);
    g.fillStyle(GOLD, 0.6 + Math.sin(t * 6) * 0.3).fillCircle(62, 66, 6);
    lbl(DEMO_W / 2, 12, 'FROGGY PAYS MOST', CREAM);
    lbl(DEMO_W / 2, 82, 'GOLD IS WILD', GOLD);
  },

  // ---------- FROGGY 21
  'bj.bet': (g, t, lbl) => {
    g.fillStyle(0x1a4a2a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const bet = 1 + Math.floor(ph(t, 3) * 4) * 5;
    for (let i = 0; i < Math.min(6, Math.ceil(bet / 3)); i++) g.fillStyle(i % 2 ? RED : GOLD, 1).fillEllipse(62, 54 - i * 3, 18, 6);
    lbl(DEMO_W / 2, 20, `BET ${bet}`, GOLD);
    lbl(DEMO_W / 2, 76, 'THEN DEAL', CREAM);
  },
  'bj.hit': (g, t, lbl) => {
    g.fillStyle(0x1a4a2a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const n = 2 + Math.floor(ph(t, 3) * 2);
    const faces = ['7', '6', '5', 'K'];
    for (let i = 0; i < n; i++) card(g, lbl, 36 + i * 16, 44, faces[i], i === 1);
    const total = [7, 13, 18, 28].slice(0, n).pop()!;
    lbl(DEMO_W / 2, 14, n < 3 ? 'HIT FOR A CARD' : 'STAND TO STOP', CREAM);
    lbl(DEMO_W / 2, 74, `${[0, 0, 13, 18][n]}`, GOLD);
    void total;
  },
  'bj.cards': (g, _t, lbl) => {
    g.fillStyle(0x1a4a2a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    card(g, lbl, 24, 36, 'J');
    card(g, lbl, 40, 36, 'Q', true);
    card(g, lbl, 56, 36, 'K');
    lbl(40, 58, '= 10', GOLD);
    card(g, lbl, 96, 36, 'A', true);
    lbl(96, 58, '1 / 10 / 11', GOLD);
    lbl(DEMO_W / 2, 80, 'ACE: 1 OR 10 AFTER TWO', CREAM);
  },
  'bj.rules': (g, t, lbl) => {
    g.fillStyle(0x1a4a2a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const i = Math.floor(ph(t, 6) * 3);
    if (i === 0) {
      card(g, lbl, 52, 40, 'A');
      card(g, lbl, 70, 40, 'K', true);
      lbl(DEMO_W / 2, 64, '21 ON TWO: 2X', GOLD);
    } else if (i === 1) {
      for (let j = 0; j < 3; j++) card(g, lbl, 44 + j * 16, 40, ['7', '7', '7'][j]);
      lbl(DEMO_W / 2, 64, '21 ON THREE: WIN', GREEN);
    } else {
      for (let j = 0; j < 5; j++) card(g, lbl, 26 + j * 18, 40, ['2', '3', '4', '2', '5'][j]);
      lbl(DEMO_W / 2, 64, 'FIVE, NOT BUST: WIN', GREEN);
      lbl(DEMO_W / 2, 76, '21 ON FIVE LOSES', RED);
    }
  },

  // ---------- CHAMBER
  'chamber.spin': (g, t, lbl) => {
    g.fillStyle(0x1a1418, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 2.6);
    const a = k < 0.6 ? t * 12 : 0;
    g.fillStyle(0x6a6a74, 1).fillCircle(62, 42, 20);
    for (let i = 0; i < 5; i++) {
      const b = a + (i / 5) * Math.PI * 2;
      g.fillStyle(INK, 1).fillCircle(62 + Math.cos(b) * 12, 42 + Math.sin(b) * 12, 4);
    }
    lbl(DEMO_W / 2, 78, k < 0.6 ? 'IT SPINS' : 'STOP, THEN PULL', GOLD);
  },
  'chamber.odds': (g, t, lbl) => {
    g.fillStyle(0x1a1418, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    for (let i = 0; i < 5; i++) g.fillStyle(i === 2 ? RED : GREY, 1).fillCircle(22 + i * 20, 34, 6);
    lbl(DEMO_W / 2, 14, 'ONE LIVE ROUND', CREAM);
    coin(g, 62, 62, t);
    lbl(DEMO_W / 2, 80, 'A CLEAN PULL PAYS', GOLD);
  },
  'chamber.cash': (g, t, lbl) => {
    g.fillStyle(0x1a1418, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 3);
    for (let i = 0; i < 3; i++) coin(g, 46 + i * 16, 40 - (k > 0.5 ? (k - 0.5) * 20 : 0), t + i);
    lbl(DEMO_W / 2, 14, 'CASH OUT TO KEEP IT', GOLD);
    lbl(DEMO_W / 2, 74, 'A LIVE ROUND TAKES IT ALL', RED);
  },

  // ---------- WHEEL
  'wheel.spin': (g, t, lbl) => {
    g.fillStyle(0x1a1430, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 3);
    const rot = (1 - Math.pow(1 - Math.min(1, k * 1.3), 3)) * Math.PI * 6;
    const cols = [GOLD, RED, BLUE, GREEN, 0x9a5ad8, 0xe87a30];
    for (let i = 0; i < 12; i++) {
      const a0 = rot + (i / 12) * Math.PI * 2;
      g.fillStyle(cols[i % 6], 1).slice(62, 44, 30, a0, a0 + Math.PI / 6 - (i === 0 ? 0.35 : 0), false).fillPath();
    }
    g.fillStyle(CREAM, 1).fillTriangle(58, 8, 66, 8, 62, 16);
    lbl(DEMO_W / 2, 84, 'SPIN', GOLD);
  },
  'wheel.odds': (g, _t, lbl) => {
    g.fillStyle(0x1a1430, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.fillStyle(GREY, 1).slice(40, 46, 26, -0.9, 0.9, false).fillPath();
    g.fillStyle(GOLD, 1).slice(90, 46, 26, -0.08, 0.08, false).fillPath();
    lbl(40, 80, 'WIDE: OFTEN', CREAM);
    lbl(90, 80, 'THIN: RARE', GOLD);
  },
  'wheel.keep': (g, t, lbl) => {
    g.fillStyle(0x1a1430, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    for (let i = 0; i < 4; i++) coin(g, 38 + i * 16, 42, t + i * 0.5);
    lbl(DEMO_W / 2, 16, 'WHERE IT STOPS', CREAM);
    lbl(DEMO_W / 2, 70, 'IS YOURS', GOLD);
  },

  // ---------- FROG RACE
  'race.back': (g, t, lbl) => {
    g.fillStyle(0x3a6a2a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const pick = Math.floor(ph(t, 4) * 4);
    for (let i = 0; i < 4; i++) {
      frog(g, 20, 16 + i * 18, 0.8, [GREEN, BLUE, RED, GOLD][i]);
      lbl(36, 16 + i * 18, `${i + 1}`, i === pick ? GOLD : CREAM);
      if (i === pick) g.lineStyle(1, GOLD, 1).strokeRect(8, 8 + i * 18, 34, 16);
    }
    lbl(86, 30, 'BACK ONE', GOLD);
    lbl(86, 52, 'MORE TICKETS', CREAM);
    lbl(86, 60, 'MORE BACK', CREAM);
  },
  'race.run': (g, t, lbl) => {
    g.fillStyle(0x3a6a2a, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.fillStyle(CREAM, 1).fillRect(110, 0, 2, DEMO_H);
    const k = ph(t, 3);
    for (let i = 0; i < 4; i++) frog(g, lerp(10, 104, Math.min(1, k * (0.8 + ((i * 37) % 5) * 0.08))), 16 + i * 18, 0.8, [GREEN, BLUE, RED, GOLD][i]);
    g.fillStyle(0x8a7a6a, 1).fillCircle(60, 34 - ph(t, 1) * 6, 3);
    lbl(60, 82, 'ROCKS, TRAPS, HAWKS', CREAM);
  },
  'race.pay': (g, t, lbl) => {
    g.fillStyle(0x1a1430, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    lbl(DEMO_W / 2, 18, '10 A TICKET', CREAM);
    for (let i = 0; i < 2; i++) coin(g, 50 + i * 24, 44, t + i);
    lbl(DEMO_W / 2, 70, '20 BACK ON EACH', GOLD);
  },

  // ---------- FROGSTER MASH
  'mash.chests': (g, t, lbl) => {
    g.fillStyle(0x2a1a10, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const i = Math.floor(ph(t, 4) * 4);
    for (let j = 0; j < 4; j++) {
      const x = 18 + j * 29;
      g.fillStyle(0x8a5a2a, 1).fillRect(x - 10, 36, 20, 14);
      g.fillStyle(0xc89a5a, 1).fillRect(x - 10, 33 - (j === i ? 4 : 0), 20, 4);
      if (j === i) g.lineStyle(1, GOLD, 1).strokeRect(x - 11.5, 30.5, 23, 21);
    }
    lbl(DEMO_W / 2, 14, 'PICK A CHEST, OPEN IT', CREAM);
    lbl(DEMO_W / 2, 70, 'WHAT IS INSIDE IS YOURS', GOLD);
  },
  'mash.gear': (g, _t, lbl) => {
    g.fillStyle(0x2a1a10, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    frog(g, 62, 50, 1.6);
    g.fillStyle(GREY, 1).fillRect(52, 34, 20, 4);
    g.fillStyle(0xc8c8d0, 1).fillRect(76, 34, 3, 22);
    lbl(DEMO_W / 2, 12, 'A WEAPON AND ARMOUR', CREAM);
  },
  'mash.fight': (g, t, lbl) => {
    g.fillStyle(0x2a1a10, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 1.2);
    frog(g, 40 + (k < 0.3 ? k * 30 : 0), 56, 1.4);
    g.fillStyle(0x8a4a3a, 1).fillEllipse(88, 54, 16, 20);
    lbl(DEMO_W / 2, 12, 'HE FIGHTS ON HIS OWN', CREAM);
    lbl(DEMO_W / 2, 80, 'EACH ROUND WON: 25', GOLD);
  },
  'mash.bank': (g, t, lbl) => {
    g.fillStyle(0x2a1a10, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 3);
    const n = 1 + Math.floor(k * 4);
    for (let i = 0; i < n; i++) coin(g, 34 + i * 14, 42, t + i);
    lbl(DEMO_W / 2, 14, `BANK ${n * 25}`, GOLD);
    lbl(30, 72, 'TAKE IT', GREEN);
    lbl(94, 72, 'OR RISK IT', RED);
  },

  // ---------- CROAKED
  'croak.pick': (g, t, lbl) => {
    g.fillStyle(0x0c1820, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const left = ph(t, 3) < 0.5;
    g.fillStyle(0x2e6a3a, 1).fillRect(8, 30, 50, 18);
    g.fillStyle(0x2a4a7a, 1).fillRect(66, 30, 50, 18);
    g.lineStyle(1, GOLD, 1).strokeRect(left ? 7.5 : 65.5, 29.5, 51, 19);
    lbl(33, 39, 'PAC FROG', CREAM);
    lbl(91, 39, 'SURVIVOR', CREAM);
    lbl(33, 60, 'YOU HUNT', GREEN);
    lbl(91, 60, 'YOU RUN', 0x8ab0ff);
    lbl(DEMO_W / 2, 12, 'PICK A SIDE', GOLD);
  },
  'croak.hunt': (g, t, lbl) => {
    g.fillStyle(0x0c1820, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.fillStyle(0x2e5a3a, 1).fillRect(10, 24, 104, 6).fillRect(10, 66, 104, 6).fillRect(40, 44, 44, 6);
    const k = ph(t, 3);
    const tx = 20 + k * 84;
    g.fillStyle(0x5a8af0, 1).fillCircle(tx, 38, 3);
    g.fillStyle(0x5ac85a, 1).fillCircle(Math.max(14, tx - 24), 38, 5);
    lbl(DEMO_W / 2, 12, 'CHASE IT DOWN', CREAM);
    lbl(DEMO_W / 2, 82, 'BEFORE THE CLOCK ENDS', GOLD);
  },
  'croak.trap': (g, t, lbl) => {
    g.fillStyle(0x0c1820, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.fillStyle(0x2e5a3a, 1).fillRect(8, 30, 108, 5).fillRect(8, 56, 108, 5);
    const k = ph(t, 3.5);
    // the frog drops a snare and backs off; the tadpole swims in and is held
    g.lineStyle(1, 0xc8a050, k < 0.75 ? 1 : 0).strokeCircle(70, 46, 4);
    const tx = k < 0.5 ? 116 - k * 92 : 70;
    g.fillStyle(0x5a8af0, 1).fillCircle(tx, 46, 3);
    if (k >= 0.5) g.lineStyle(1, 0xf0d060, 1).strokeCircle(70, 46, 3 + (1 - k) * 8);
    g.fillStyle(0x5ac85a, 1).fillCircle(k < 0.5 ? 40 : 40 + (k - 0.5) * 50, 46, 5);
    lbl(DEMO_W / 2, 14, 'DROP A TRAP', CREAM);
    lbl(DEMO_W / 2, 76, k >= 0.5 ? 'STUCK - GRAB IT!' : 'IT SWIMS IN...', GOLD);
  },
  'croak.survive': (g, t, lbl) => {
    g.fillStyle(0x0c1820, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    const k = ph(t, 3);
    const tx = 16 + k * 92;
    for (let i = 0; i < 10; i++) {
      const fx = 16 + i * 10;
      if (fx > tx) g.fillStyle(0xd8e8ff, 1).fillRect(fx, 44, 2, 2);
    }
    g.fillStyle(0x5a8af0, 1).fillCircle(tx, 45, 3);
    g.fillStyle(0x5ac85a, 1).fillCircle(tx - 30, 45, 5);
    lbl(DEMO_W / 2, 12, 'EAT EVERY FLY', CREAM);
    g.lineStyle(1, 0xc8a050, 0.4).strokeCircle(96, 45, 4);
    lbl(DEMO_W / 2, 74, 'FAINT RING = TRAP', RED);
  },
  'croak.steer': (g, t, lbl) => {
    g.fillStyle(0x0c1820, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    g.fillStyle(0x2e5a3a, 1).fillRect(10, 30, 50, 30).fillRect(72, 30, 42, 30);
    const k = ph(t, 2.5);
    const x = k < 0.5 ? 20 + k * 90 : 66;
    const y = k < 0.5 ? 25 : 25 + (k - 0.5) * 80;
    g.fillStyle(0x5ac85a, 1).fillCircle(x, Math.min(y, 70), 4);
    key(g, lbl, 98, 76, 'S');
    lbl(46, 12, 'PRESS EARLY: TURN AT THE GAP', CREAM);
  },

  // ---------- anything without a picture of its own
  default: (g, t, lbl) => {
    g.fillStyle(0x1a1430, 1).fillRect(0, 0, DEMO_W, DEMO_H);
    frog(g, DEMO_W / 2, 48 + Math.sin(t * 3) * 3, 2);
    lbl(DEMO_W / 2, 82, '', CREAM);
  },
};

/** The picture for `id`, or the default one. */
export const demoFor = (id: string): Demo => DEMOS[id] ?? DEMOS.default;
