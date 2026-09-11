/**
 * Snakes & Ladders.  PRD §9.3 — Easy, 1 token in, 3 out.
 *
 * 30 squares, player vs one AI token, pure luck at roughly 50%.  The piece hops
 * square to square at 120ms a square, which is most of the charm.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const SQUARES = 30;
const LADDERS: Record<number, number> = { 3: 16, 7: 19, 12: 24, 20: 27 };
const SNAKES: Record<number, number> = { 25: 9, 22: 11, 18: 6 };
const HOP_MS = 120;

const COLS = 6;
const CELL = 34;
const OX = GAME_W / 2 - (COLS * CELL) / 2;
const OY = 34;

/** Serpentine board: 1 is bottom-left, the rows alternate direction. */
function squareToXY(n: number): { x: number; y: number } {
  const i = n - 1;
  const row = Math.floor(i / COLS);
  const colRaw = i % COLS;
  const col = row % 2 === 0 ? colRaw : COLS - 1 - colRaw;
  return { x: OX + col * CELL + CELL / 2, y: OY + (4 - row) * 22 + 11 };
}

let playerPos = 0;
let aiPos = 0;
let pieces: { p: Phaser.GameObjects.Arc; a: Phaser.GameObjects.Arc } | null = null;
let status: Phaser.GameObjects.BitmapText | null = null;
let rollBtn: Phaser.GameObjects.Container | null = null;
let busy = false;

export const snakesAndLadders: MinigameModule = {
  id: 'snakes',
  title: 'SNAKES + LADDERS',
  music: 'game_snakes',
  rules: 'first to 30',

  create(scene: Phaser.Scene, api: MinigameApi) {
    playerPos = 0;
    aiPos = 0;
    busy = false;

    centerText(scene, GAME_W / 2, 24, 'FIRST TO SQUARE 30', PALETTE.ember);

    // board
    for (let n = 1; n <= SQUARES; n++) {
      const { x, y } = squareToXY(n);
      const isLadder = LADDERS[n] !== undefined;
      const isSnake = SNAKES[n] !== undefined;
      const fill = isLadder ? PALETTE.moss : isSnake ? PALETTE.rust : n % 2 ? PALETTE.ink : PALETTE.slate;
      scene.add.rectangle(x, y, CELL - 2, 20, fill).setStrokeStyle(1, PALETTE.steel);
      text(scene, x - 13, y - 9, String(n), PALETTE.ash, 8);
      if (isLadder) text(scene, x + 2, y - 1, `^${LADDERS[n]}`, PALETTE.mossLight, 8);
      if (isSnake) text(scene, x + 2, y - 1, `v${SNAKES[n]}`, PALETTE.ember, 8);
    }

    const start = squareToXY(1);
    pieces = {
      p: scene.add.circle(start.x - 6, start.y + 4, 4, PALETTE.gold).setDepth(10),
      a: scene.add.circle(start.x + 6, start.y + 4, 4, PALETTE.neon).setDepth(10),
    };

    status = centerText(scene, GAME_W / 2, 152, 'your roll', PALETTE.cream);
    rollBtn = button(scene, GAME_W / 2, 168, 'ROLL', () => roll(scene, api), { width: 60, height: 13 });
  },

  destroy() {
    pieces = null;
    status = null;
    rollBtn = null;
  },
};

function place(who: 'p' | 'a', pos: number): void {
  if (!pieces) return;
  const { x, y } = squareToXY(Math.max(1, pos));
  const piece = who === 'p' ? pieces.p : pieces.a;
  piece.setPosition(x + (who === 'p' ? -6 : 6), y + 4);
}

function roll(scene: Phaser.Scene, api: MinigameApi): void {
  if (busy) return;
  busy = true;
  rollBtn?.setAlpha(0.4);

  const d = Phaser.Math.Between(1, 6);
  status?.setText(`you rolled ${d}`);
  hop(scene, 'p', playerPos, playerPos + d, (end) => {
    playerPos = end;
    if (playerPos >= SQUARES) {
      status?.setText('you win');
      scene.time.delayedCall(500, () => api.win());
      return;
    }
    // AI turn
    scene.time.delayedCall(400, () => {
      const ad = Phaser.Math.Between(1, 6);
      status?.setText(`froggy rolled ${ad}`);
      hop(scene, 'a', aiPos, aiPos + ad, (aend) => {
        aiPos = aend;
        if (aiPos >= SQUARES) {
          status?.setText('you lose');
          scene.time.delayedCall(500, () => api.lose());
          return;
        }
        busy = false;
        rollBtn?.setAlpha(1);
        status?.setText('your roll');
      });
    });
  });
}

/** Walk square by square, then apply any snake or ladder at the landing spot. */
function hop(
  scene: Phaser.Scene,
  who: 'p' | 'a',
  from: number,
  to: number,
  done: (end: number) => void,
): void {
  let cur = from;
  const step = () => {
    if (cur >= to || cur >= SQUARES) {
      const landed = Math.min(cur, SQUARES);
      const jump = LADDERS[landed] ?? SNAKES[landed];
      if (jump !== undefined) {
        scene.time.delayedCall(260, () => {
          audio.sfx(LADDERS[landed] ? 'chime' : 'buzzer');
          place(who, jump);
          scene.time.delayedCall(320, () => done(jump));
        });
      } else {
        done(landed);
      }
      return;
    }
    cur++;
    place(who, cur);
    audio.sfx('ui_hover');
    scene.time.delayedCall(HOP_MS, step);
  };
  step();
}
