/**
 * Tic-Tac-Toe.  PRD §9.2 — Easy, 1 token in, 3 out.
 *
 * AI: a uniformly random legal move 30% of the time, full minimax otherwise.
 * Decent but reliably beatable (VOC-20).
 *
 * A DRAW GETS YOUR TOKEN BACK.  Nobody won, so nobody pays: the entry cost
 * comes straight back and nothing is paid on top of it.  It is stated on the
 * board before the player commits, and again on the result.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';
import { backdrop, panel } from './decor';


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
let marks: Phaser.GameObjects.Graphics[] = [];
let busy = false;

export const ticTacToe: MinigameModule = {
  id: 'tictactoe',
  title: 'TIC-TAC-TOE',
  music: 'game_tictactoe',
  rules: 'a draw gets your token back',
  tutorial: {
    objective: [
      'THREE IN A ROW BEATS FROGGY.',
      'A DRAW GETS YOUR TOKEN BACK.',
    ],
    controls: [
      ['MOUSE', 'CLICK A SQUARE TO PLACE X'],
    ],
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    board = Array<Cell>(9).fill('');
    cells = [];
    marks = [];
    busy = false;

    // A wooden table, and the board a cream card on it.
    backdrop(scene, 0x3b2a1c, 0x2a1d14, { speckleColor: 0xffd9a0 });
    centerText(scene, GAME_W / 2, 26, 'YOU ARE X   -   A DRAW REFUNDS', PALETTE.gold);

    const size = 34;
    const ox = GAME_W / 2 - size * 1.5;
    const oy = 40;
    panel(scene, ox - 8, oy - 8, size * 3 + 16, size * 3 + 16, 0x5c4326, 0x8a6a3a, 5);

    for (let i = 0; i < 9; i++) {
      const cx = ox + (i % 3) * size + size / 2;
      const cy = oy + Math.floor(i / 3) * size + size / 2;
      const r = scene.add.rectangle(cx, cy, size - 3, size - 3, 0xfff0c9).setStrokeStyle(1, 0x8a6a3a);
      r.setInteractive({ useHandCursor: true });
      r.on('pointerover', () => {
        if (!busy && board[i] === '') r.setFillStyle(0xffe08a);
      });
      r.on('pointerout', () => r.setFillStyle(0xfff0c9));
      r.on('pointerdown', () => play(scene, api, i));
      cells.push(r);

      marks.push(scene.add.graphics().setDepth(5));
    }
  },

  destroy() {
    cells = [];
    marks = [];
  },
};

function render(): void {
  for (let i = 0; i < 9; i++) {
    // Drawn marks, not typed ones: a thick X in ember, a ring in teal.
    const g = marks[i];
    const { x, y } = cells[i];
    if (board[i] !== '') cells[i].setFillStyle(0xfff0c9); // no hover tint on a taken square
    g.clear();
    if (board[i] === 'X') {
      g.lineStyle(3, PALETTE.ember, 1);
      g.beginPath();
      g.moveTo(x - 8, y - 8);
      g.lineTo(x + 8, y + 8);
      g.moveTo(x + 8, y - 8);
      g.lineTo(x - 8, y + 8);
      g.strokePath();
    } else if (board[i] === 'O') {
      g.lineStyle(3, PALETTE.teal, 1);
      g.strokeCircle(x, y, 8);
    }
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
    centerText(scene, GAME_W / 2, 150, 'DRAW - TOKEN BACK', PALETTE.tealLight);
    scene.time.delayedCall(900, () => api.draw());
    return true;
  }
  return false;
}
