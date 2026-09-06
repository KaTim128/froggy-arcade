/**
 * The arcade hub room.  ONE painter, two moods (PRD AR-6).
 *
 * Act I draws it warm.  ArcadeDark (PRD §7.13) draws the SAME geometry through
 * the palette transform with the lights off, so the player walks a room they
 * already know.  That recognition is the point.
 */

import Phaser from 'phaser';
import { PALETTE, nightify } from '../render/palette';
import { GAME_W, GAME_H } from '../render/pixelScaler';

export const ROOM = {
  left: 14,
  right: GAME_W - 14,
  top: 52,
  bottom: GAME_H - 8,
};

export interface RoomOpts {
  night: boolean;
}

export function paintHubRoom(scene: Phaser.Scene, opts: RoomOpts): void {
  const c = (col: number) => (opts.night ? nightify(col) : col);

  // ---- carpet: chaotic 90s pattern, teal ground
  scene.add.rectangle(0, 0, GAME_W, GAME_H, c(PALETTE.tealDark)).setOrigin(0, 0);
  const carpet = scene.add.graphics();
  const shapes = [c(PALETTE.neon), c(PALETTE.gold), c(PALETTE.tealLight), c(PALETTE.violet)];
  // Deterministic scatter — same carpet every time, in both moods.
  let seed = 1337;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rnd() * GAME_W);
    const y = 44 + Math.floor(rnd() * (GAME_H - 44));
    const col = shapes[Math.floor(rnd() * shapes.length)];
    carpet.fillStyle(col, opts.night ? 0.22 : 0.5);
    const kind = Math.floor(rnd() * 3);
    if (kind === 0) carpet.fillRect(x, y, 5, 2);
    else if (kind === 1) carpet.fillRect(x, y, 2, 5);
    else carpet.fillTriangle(x, y, x + 5, y, x + 2, y + 5);
  }

  // ---- back wall
  scene.add.rectangle(0, 0, GAME_W, 46, c(PALETTE.plum)).setOrigin(0, 0);
  scene.add.rectangle(0, 44, GAME_W, 4, c(PALETTE.ink)).setOrigin(0, 0);

  // ---- side walls
  scene.add.rectangle(0, 0, 14, GAME_H, c(PALETTE.ink)).setOrigin(0, 0);
  scene.add.rectangle(GAME_W - 14, 0, 14, GAME_H, c(PALETTE.ink)).setOrigin(0, 0);

  // ---- neon strip along the back wall
  const strip = scene.add.rectangle(14, 8, GAME_W - 28, 2, opts.night ? nightify(PALETTE.neon) : PALETTE.neon).setOrigin(0, 0);
  strip.setAlpha(opts.night ? 0.35 : 1);

  // ---- front door (bottom centre)
  scene.add.rectangle(GAME_W / 2, GAME_H - 6, 40, 8, c(PALETTE.brown)).setOrigin(0.5, 0);
  scene.add.rectangle(GAME_W / 2, GAME_H - 4, 30, 4, opts.night ? PALETTE.nightMid : PALETTE.cream).setOrigin(0.5, 0);

  if (opts.night) {
    // Moonlight through the front windows — the only light in the room.
    const moon = scene.add.graphics();
    moon.fillStyle(PALETTE.moon, 0.07);
    moon.fillTriangle(GAME_W / 2 - 46, GAME_H, GAME_W / 2 + 46, GAME_H, GAME_W / 2, 60);
  }
}

/** The change machine, decorative in Act I and dead at night. */
export function paintChangeMachine(scene: Phaser.Scene, night: boolean): void {
  const c = (col: number) => (night ? nightify(col) : col);
  scene.add.rectangle(262, 10, 20, 32, c(PALETTE.steel)).setOrigin(0, 0);
  scene.add.rectangle(265, 15, 14, 10, night ? PALETTE.black : PALETTE.gold).setOrigin(0, 0);
  scene.add.rectangle(266, 32, 12, 3, c(PALETTE.ink)).setOrigin(0, 0);
}
