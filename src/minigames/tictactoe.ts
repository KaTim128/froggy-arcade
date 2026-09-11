/**
 * Tic-Tac-Toe.  PRD §9.2 — Easy, 1 token in, 3 out.
 *
 * AI: a uniformly random legal move 30% of the time, full minimax otherwise.
 * Decent but reliably beatable (VOC-20).
 *
 * A DRAW IS A LOSS.  This is the most important rule in the game and it is
 * stated on the board, before the player commits, and again on the result.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

type Cell = 'X' | 'O' | '';
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const RANDOM_MOVE_CHANCE = 0.3;

function winnerOf(b: Cell[]): Cell | null {
  for (const [a, c, d] of LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
}

function full(b: Cell[]): boolean {
  return b.every((c) => c !== '');
}

/** Minimax from O's point of view. */
function minimax(b: Cell[], turn: Cell): { score: number; move: number } {
  const w = winnerOf(b);
  if (w === 'O') return { score: 1, move: -1 };
  if (w === 'X') return { score: -1, move: -1 };
  if (full(b)) return { score: 0, move: -1 };

  let bestScore = turn === 'O' ? -2 : 2;
  let bestMove = -1;
  for (let i = 0; i < 9; i++) {
    if (b[i] !== '') continue;
    b[i] = turn;
    const { score } = minimax(b, turn === 'O' ? 'X' : 'O');
    b[i] = '';
    if (turn === 'O' ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = i;
    }
  }
  return { score: bestScore, move: bestMove };
}

let board: Cell[] = [];
let cells: Phaser.GameObjects.Rectangle[] = [];
let marks: Phaser.GameObjects.BitmapText[] = [];
let busy = false;

export const ticTacToe: MinigameModule = {
  id: 'tictactoe',
  title: 'TIC-TAC-TOE',
  music: 'game_tictactoe',
  rules: 'a draw is a loss',

  create(scene: Phaser.Scene, api: MinigameApi) {
    board = Array<Cell>(9).fill('');
    cells = [];
    marks = [];
    busy = false;

    centerText(scene, GAME_W / 2, 26, 'YOU ARE X   -   A DRAW IS A LOSS', PALETTE.ember);

    const size = 30;
    const ox = GAME_W / 2 - size * 1.5;
    const oy = 42;

    for (let i = 0; i < 9; i++) {
      const cx = ox + (i % 3) * size + size / 2;
      const cy = oy + Math.floor(i / 3) * size + size / 2;
      const r = scene.add.rectangle(cx, cy, size - 2, size - 2, PALETTE.ink).setStrokeStyle(1, PALETTE.steel);
      r.setInteractive({ useHandCursor: true });
      r.on('pointerover', () => {
        if (!busy && board[i] === '') r.setFillStyle(PALETTE.slate);
      });
      r.on('pointerout', () => r.setFillStyle(PALETTE.ink));
      r.on('pointerdown', () => play(scene, api, i));
      cells.push(r);

      marks.push(
        centerText(scene, cx, cy, '', PALETTE.cream, 16),
      );
    }
  },

  destroy() {
    cells = [];
    marks = [];
  },
};

function render(): void {
  for (let i = 0; i < 9; i++) {
    marks[i].setText(board[i]);
    marks[i].setTint(board[i] === 'X' ? PALETTE.gold : PALETTE.neon);
  }
}

function play(scene: Phaser.Scene, api: MinigameApi, i: number): void {
  if (busy || board[i] !== '') return;
  board[i] = 'X';
  audio.sfx('ui_blip');
  render();

  if (settle(scene, api)) return;

  busy = true;
  scene.time.delayedCall(360, () => {
    const move = aiMove();
    if (move >= 0) {
      board[move] = 'O';
      audio.sfx('ui_hover');
      render();
    }
    busy = false;
    settle(scene, api);
  });
}

function aiMove(): number {
  const open = board.map((c, i) => (c === '' ? i : -1)).filter((i) => i >= 0);
  if (open.length === 0) return -1;
  if (Math.random() < RANDOM_MOVE_CHANCE) {
    return open[Math.floor(Math.random() * open.length)];
  }
  return minimax([...board], 'O').move;
}

/** Returns true if the game is over. */
function settle(scene: Phaser.Scene, api: MinigameApi): boolean {
  const w = winnerOf(board);
  if (w === 'X') {
    busy = true;
    scene.time.delayedCall(300, () => api.win());
    return true;
  }
  if (w === 'O') {
    busy = true;
    scene.time.delayedCall(300, () => api.lose());
    return true;
  }
  if (full(board)) {
    busy = true;
    centerText(scene, GAME_W / 2, 150, 'DRAW - NO PAYOUT', PALETTE.blood);
    scene.time.delayedCall(900, () => api.lose());
    return true;
  }
  return false;
}
