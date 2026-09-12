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
import { backdrop } from './decor';


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
  tutorial: {
    objective: [
      'RACE FROGGY TO SQUARE 30.',
      'LADDERS CLIMB. SNAKES DROP.',
    ],
    controls: [
      ['MOUSE', 'CLICK ROLL TO THROW'],
    ],
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    playerPos = 0;
    aiPos = 0;
    busy = false;

    // A green baize table with a printed board on it.
    backdrop(scene, 0x2f6b3a, 0x1f4a28, { speckleColor: 0xbfe6a0 });
    centerText(scene, GAME_W / 2, 24, 'FIRST TO SQUARE 30', PALETTE.gold);

    // board: cream and tan squares, a ladder drawn up the ladder squares and
    // a snake drawn down the snake ones
    for (let n = 1; n <= SQUARES; n++) {
      const { x, y } = squareToXY(n);
      const isLadder = LADDERS[n] !== undefined;
      const isSnake = SNAKES[n] !== undefined;
      const fill = isLadder ? 0xbfe3a0 : isSnake ? 0xf0b090 : n % 2 ? 0xf3e3b8 : 0xd9c48e;
      scene.add.rectangle(x, y, CELL - 2, 20, fill).setStrokeStyle(1, 0x7a5a3a);
      text(scene, x - 13, y - 9, String(n), 0x5a4632, 8);
      const g = scene.add.graphics();
      if (isLadder) {
        g.lineStyle(1, 0x5c4326, 1);
        for (const rx of [x + 4, x + 10]) {
          g.beginPath();
          g.moveTo(rx, y - 7);
          g.lineTo(rx, y + 8);
          g.strokePath();
        }
        for (let ry = y - 5; ry < y + 8; ry += 4) {
          g.beginPath();
          g.moveTo(x + 4, ry);
          g.lineTo(x + 10, ry);
          g.strokePath();
        }
        text(scene, x - 12, y + 1, `${LADDERS[n]}`, 0x2e5e38, 8);
      }
      if (isSnake) {
        g.lineStyle(2, 0xc31f2e, 1);
        g.beginPath();
        g.moveTo(x + 2, y - 7);
        for (let k = 1; k <= 5; k++) g.lineTo(x + 2 + (k % 2 ? 6 : 0), y - 7 + k * 3);
        g.strokePath();
        g.fillStyle(0xc31f2e, 1);
        g.fillCircle(x + 2, y - 7, 2);
        text(scene, x - 12, y + 1, `${SNAKES[n]}`, 0x8a2b1a, 8);
      }
    }

    const start = squareToXY(1);
    pieces = {
      p: scene.add.circle(start.x - 6, start.y + 4, 4, PALETTE.gold).setStrokeStyle(1.5, 0x8a6a10).setDepth(10),
      a: scene.add.circle(start.x + 6, start.y + 4, 4, PALETTE.neon).setStrokeStyle(1.5, 0x8a2050).setDepth(10),
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
