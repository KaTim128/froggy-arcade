/**
 * The arcade exterior.  ONE painter, three moods.
 *
 * PRD AR-6 / QFD P2: the night version is the SAME tiles run through the
 * palette transform, not a second set of art.  If the player can't tell it's
 * the same building, the effect has failed.
 *
 * Day is the third: the street the job happens on.  Open sky, a sun, the doors
 * standing open — you are meant to walk in and out of this building all
 * afternoon, and a shut, dusk-lit facade reads as a place you get one go at.
 */

import Phaser from 'phaser';
import { PALETTE, nightify, daylight } from '../render/palette';
import { GAME_W } from '../render/pixelScaler';
import { centerText } from '../core/ui';

export interface ExteriorOpts {
  night: boolean;
  /** Daylight: the working half of the game, with the doors open. */
  day?: boolean;
}

export interface ExteriorRefs {
  sign: Phaser.GameObjects.Container;
  signGlow: Phaser.GameObjects.Rectangle;
  windows: Phaser.GameObjects.Rectangle[];
  moth: Phaser.GameObjects.Arc | null;
  doorX: number;
  doorY: number;
}

/** Where the man stands, and where the player sits at the start. */
export const KERB_Y = 168;
export const MAN_X = 74;

export function paintExterior(scene: Phaser.Scene, opts: ExteriorOpts): ExteriorRefs {
  const c = (col: number) => (opts.night ? nightify(col) : opts.day ? daylight(col) : col);

  // ---- sky: day, dusk bands, or night
  const skyBands = opts.day
    ? [PALETTE.tealLight, PALETTE.tealLight, PALETTE.teal, PALETTE.moon]
    : opts.night
      ? [PALETTE.night, PALETTE.night, PALETTE.nightMid, PALETTE.nightMid]
      : [PALETTE.plum, PALETTE.violet, PALETTE.ember, PALETTE.amber];
  const bandH = 16;
  for (let i = 0; i < 4; i++) {
    scene.add.rectangle(0, i * bandH, GAME_W, bandH, skyBands[i]).setOrigin(0, 0);
  }
  scene.add
    .rectangle(0, 64, GAME_W, 22, opts.day ? PALETTE.moon : opts.night ? PALETTE.nightMid : PALETTE.amberDark)
    .setOrigin(0, 0);

  // ---- the sun, high and hard.  Nothing about this street is subtle at noon.
  if (opts.day) {
    const sun = scene.add.graphics();
    for (let i = 5; i >= 1; i--) {
      sun.fillStyle(PALETTE.cream, 0.05 + (5 - i) * 0.03);
      sun.fillCircle(268, 24, 8 + i * 4);
    }
    sun.fillStyle(PALETTE.white, 1);
    sun.fillCircle(268, 24, 9);
    sun.fillStyle(PALETTE.gold, 0.55);
    sun.fillCircle(268, 24, 12);
    sun.fillStyle(PALETTE.white, 1);
    sun.fillCircle(268, 24, 8);
    // a few flat clouds, so the sky is not an empty wash
    for (const [cx, cy, cw] of [
      [40, 18, 46],
      [120, 30, 34],
      [196, 14, 28],
    ] as const) {
      sun.fillStyle(PALETTE.white, 0.5);
      sun.fillRoundedRect(cx, cy, cw, 7, 3);
      sun.fillStyle(PALETTE.bone, 0.4);
      sun.fillRoundedRect(cx + 6, cy + 4, cw - 14, 5, 2);
    }
  }

  // ---- distant skyline
  const sky = scene.add.graphics();
  sky.fillStyle(c(PALETTE.ink), 1);
  const tops = [70, 62, 74, 58, 68, 55, 72, 64, 60, 76];
  for (let i = 0; i < tops.length; i++) {
    sky.fillRect(i * 32, tops[i], 30, 90 - tops[i]);
  }

  // ---- the arcade facade
  const fx = 48;
  const fw = 224;
  const fy = 72;
  const fh = 78;
  scene.add.rectangle(fx, fy, fw, fh, c(PALETTE.slate)).setOrigin(0, 0);
  scene.add.rectangle(fx, fy, fw, 4, c(PALETTE.steel)).setOrigin(0, 0);
  scene.add.rectangle(fx, fy + fh - 3, fw, 3, c(PALETTE.ink)).setOrigin(0, 0);

  // ---- windows, warm light spilling out
  const windows: Phaser.GameObjects.Rectangle[] = [];
  const winColor = opts.night ? PALETTE.black : opts.day ? PALETTE.amber : PALETTE.gold;
  for (let i = 0; i < 4; i++) {
    const wx = fx + 14 + i * 52;
    const w = scene.add.rectangle(wx, fy + 34, 38, 30, winColor).setOrigin(0, 0);
    w.setStrokeStyle(1, c(PALETTE.ink));
    windows.push(w);
    if (!opts.night) {
      // light spill on the pavement
      scene.add.rectangle(wx - 2, 150, 42, 14, PALETTE.amberDark).setOrigin(0, 0).setAlpha(0.5);
    }
  }

  // ---- door.  By day it stands open: a dark doorway with the arcade's own
  // light inside it, and both leaves folded back against the frame.
  const doorX = fx + fw / 2;
  const doorY = fy + fh - 16;
  scene.add.rectangle(doorX, fy + fh - 30, 30, 30, c(PALETTE.brown)).setOrigin(0.5, 0);
  if (opts.day) {
    scene.add.rectangle(doorX, fy + fh - 28, 24, 28, PALETTE.black).setOrigin(0.5, 0);
    scene.add.rectangle(doorX, fy + fh - 26, 20, 24, PALETTE.plum).setOrigin(0.5, 0).setAlpha(0.85);
    scene.add.rectangle(doorX, fy + fh - 14, 18, 12, PALETTE.neonDim).setOrigin(0.5, 0).setAlpha(0.5);
    // the leaves, hooked back out of the way
    for (const side of [-1, 1]) {
      scene.add
        .rectangle(doorX + side * 15, fy + fh - 30, 5, 28, c(PALETTE.brownLight))
        .setOrigin(0.5, 0);
    }
    // light falling out of the doorway onto the pavement
    scene.add.rectangle(doorX, 150, 34, 16, PALETTE.gold).setOrigin(0.5, 0).setAlpha(0.18);
  } else {
    scene.add
      .rectangle(doorX, fy + fh - 26, 22, 16, opts.night ? PALETTE.black : PALETTE.cream)
      .setOrigin(0.5, 0);
  }

  // ---- the neon frog sign
  const signGlow = scene.add
    .rectangle(doorX, fy - 2, 128, 30, opts.night ? PALETTE.ink : PALETTE.neonDim)
    .setOrigin(0.5, 0.5)
    .setAlpha(opts.night ? 0.35 : 0.55);

  const signBox = scene.add
    .rectangle(0, 0, 118, 22, opts.night ? PALETTE.ink : PALETTE.plum)
    .setStrokeStyle(1, opts.night ? nightify(PALETTE.neon) : PALETTE.neon);

  const signFrog = scene.add.graphics();
  const frogCol = opts.night ? nightify(PALETTE.mossLight) : PALETTE.mossLight;
  signFrog.fillStyle(frogCol, 1);
  signFrog.fillRoundedRect(-52, -7, 16, 12, 5);
  signFrog.fillCircle(-48, -8, 3);
  signFrog.fillCircle(-40, -8, 3);

  const signText = centerText(scene, 6, 0, 'FROGGY ARCADE', opts.night ? 0x3a3f4d : 0xff4fa3);

  const sign = scene.add.container(doorX, fy - 2, [signBox, signFrog, signText]);

  // ---- pavement
  scene.add.rectangle(0, 150, GAME_W, 30, c(PALETTE.steel)).setOrigin(0, 0);
  scene.add.rectangle(0, 150, GAME_W, 2, c(PALETTE.ash)).setOrigin(0, 0);
  // wet reflections (dusk only — the rain has stopped by night, PRD §7.10)
  if (!opts.night && !opts.day) {
    for (let i = 0; i < 7; i++) {
      scene.add
        .rectangle(18 + i * 44, 160 + (i % 3) * 5, 20, 2, PALETTE.amber)
        .setOrigin(0, 0)
        .setAlpha(0.25);
    }
  }

  // ---- two parked cars
  paintCar(scene, 12, 138, c(PALETTE.blood), c);
  paintCar(scene, 258, 140, c(PALETTE.tealDark), c);

  // ---- streetlight
  scene.add.rectangle(300, 96, 3, 56, c(PALETTE.steel)).setOrigin(0, 0);
  scene.add.rectangle(294, 92, 15, 5, c(PALETTE.ash)).setOrigin(0, 0);
  if (opts.night) {
    scene.add.rectangle(301, 98, 40, 56, PALETTE.moon).setOrigin(0.5, 0).setAlpha(0.10);
  }

  // ---- moth (dusk only)
  let moth: Phaser.GameObjects.Arc | null = null;
  if (!opts.night && !opts.day) {
    moth = scene.add.circle(doorX, fy - 2, 1, PALETTE.cream);
  }

  return { sign, signGlow, windows, moth, doorX, doorY };
}

function paintCar(scene: Phaser.Scene, x: number, y: number, body: number, c: (n: number) => number): void {
  scene.add.rectangle(x, y, 50, 12, body).setOrigin(0, 0);
  scene.add.rectangle(x + 10, y - 7, 28, 8, body).setOrigin(0, 0);
  scene.add.rectangle(x + 13, y - 5, 10, 5, c(PALETTE.fog)).setOrigin(0, 0);
  scene.add.rectangle(x + 25, y - 5, 10, 5, c(PALETTE.fog)).setOrigin(0, 0);
  scene.add.circle(x + 11, y + 12, 4, c(PALETTE.ink));
  scene.add.circle(x + 39, y + 12, 4, c(PALETTE.ink));
}

/** The sign's irregular flicker.  Gaps of 0.1s to 4s (PRD §7.2). */
export function startSignFlicker(scene: Phaser.Scene, refs: ExteriorRefs): void {
  const flick = () => {
    const on = Math.random() > 0.22;
    refs.sign.setAlpha(on ? 1 : 0.35);
    refs.signGlow.setAlpha(on ? 0.55 : 0.15);
    scene.time.delayedCall(on ? 100 + Math.random() * 3900 : 40 + Math.random() * 90, flick);
  };
  flick();
}

/** The moth's lazy figure-eight.  Nobody will notice it.  It stays anyway. */
export function startMoth(scene: Phaser.Scene, refs: ExteriorRefs): void {
  if (!refs.moth) return;
  const moth = refs.moth;
  const cx = refs.doorX;
  const cy = 70;
  let t = 0;
  scene.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) => {
    t += delta / 1000;
    moth.x = cx + Math.sin(t * 1.1) * 46;
    moth.y = cy + Math.sin(t * 2.2) * 11;
  });
}
