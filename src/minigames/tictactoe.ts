/**
 * Tic-Tac-Toe, AND ROCK PAPER SCISSORS.  PRD §9.2 — Easy, 1 token a round.
 *
 * TWO GAMES ON ONE CABINET.  The cabinet opens on a choice of the two; each
 * round is paid as it ends (a win pays the cabinet's reward, a draw hands the
 * token back) and then asks: PLAY AGAIN, for another token, or LEAVE.  A
 * session is settled hand by hand like the blackjack table's, so leaving
 * only reports how it went.
 *
 * ROCK PAPER SCISSORS: your hand on the left, Froggy's on the right.  Pick a
 * hand; both fists come up and down three times, and on the third they open.
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
import { button, centerText } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';
import { backdrop, panel } from './decor';
import { cabinetById } from '../game/content';


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
  rules: 'tic-tac-toe or rock paper scissors',
  tutorial: {
    objective: [
      'PICK A GAME: TIC-TAC-TOE OR ROCK PAPER SCISSORS.',
      'BEAT FROGGY AND THE ROUND PAYS.',
      'A DRAW GETS YOUR TOKEN BACK.',
      'THEN PLAY AGAIN, OR LEAVE.',
    ],
    controls: [
      ['MOUSE', 'CLICK A SQUARE, OR A HAND'],
    ],
  },
  // Played entirely by tapping the board.
  touch: {},

  create(scene: Phaser.Scene, api: MinigameApi) {
    board = Array<Cell>(9).fill('');
    cells = [];
    marks = [];
    busy = false;
    sceneRef = scene;
    apiRef = api;
    layer = null;
    current = null;

    // A wooden table, and the board a cream card on it.
    backdrop(scene, 0x3b2a1c, 0x2a1d14, { speckleColor: 0xffd9a0 });
    showPicker();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__ttt = {
        board: () => board.join(''),
        game: () => current,
        /**
         * Put a finished, genuinely drawn position on the board and let the
         * normal settle run.  Playing to a draw against a minimax opponent by
         * clicking squares is not something a harness can do reliably, and the
         * refund is the thing under test, not the clicking.
         */
        drawGame: () => {
          if (current !== 'ttt') startTicTacToe();
          const drawn: Cell[] = ['X', 'X', 'O', 'O', 'O', 'X', 'X', 'O', 'X'];
          for (let i = 0; i < 9; i++) board[i] = drawn[i];
          busy = false;
          render();
          settle();
        },
        pick: (g: 'ttt' | 'rps') => (g === 'ttt' ? startTicTacToe() : startRps()),
        /** Throw a hand against a hand Froggy is forced to throw. */
        rps: (mine: Hand, his: Hand) => throwHands(mine, his),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__ttt;
      });
    }
  },

  destroy() {
    cells = [];
    marks = [];
    layer = null;
    sceneRef = null;
    apiRef = null;
  },
};

type Hand = 'rock' | 'paper' | 'scissors';
const HANDS: Hand[] = ['rock', 'paper', 'scissors'];
const BEATS: Record<Hand, Hand> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
/** Everything of the current view, so a view change takes all of it. */
let layer: Phaser.GameObjects.Container | null = null;
let current: 'ttt' | 'rps' | null = null;

function freshLayer(): Phaser.GameObjects.Container {
  layer?.destroy(true);
  const s = sceneRef!;
  layer = s.add.container(0, 0);
  return layer;
}

/** The two games, side by side. */
function showPicker(): void {
  const s = sceneRef;
  if (!s) return;
  current = null;
  const L = freshLayer();
  L.add(centerText(s, GAME_W / 2, 34, 'PICK A GAME', PALETTE.gold, 16));
  L.add(centerText(s, GAME_W / 2, 52, 'BEAT FROGGY - A DRAW GETS YOUR TOKEN BACK', PALETTE.cream));
  // a little picture of each over its button
  const g = s.add.graphics();
  L.add(g);
  g.fillStyle(0xfff0c9, 1).fillRoundedRect(68, 72, 54, 54, 4);
  g.lineStyle(2, 0x8a6a3a, 1);
  for (let k = 1; k < 3; k++) {
    g.lineBetween(68 + k * 18, 74, 68 + k * 18, 124);
    g.lineBetween(70, 72 + k * 18, 120, 72 + k * 18);
  }
  g.lineStyle(3, PALETTE.ember, 1).lineBetween(73, 77, 83, 87).lineBetween(83, 77, 73, 87);
  g.lineStyle(3, PALETTE.teal, 1).strokeCircle(95, 99, 5);
  L.add(drawHand(s, 'rock', 214, 102, 1, SKIN, false));
  L.add(drawHand(s, 'scissors', 250, 102, 1, FROG, true));
  L.add(button(s, 95, 146, 'TIC-TAC-TOE', () => startTicTacToe(), { width: 96, height: 16 }));
  L.add(button(s, 232, 146, 'ROCK PAPER SCISSORS', () => startRps(), { width: 128, height: 16 }));
}

/** The board, empty. */
function startTicTacToe(): void {
  const s = sceneRef;
  if (!s) return;
  current = 'ttt';
  board = Array<Cell>(9).fill('');
  cells = [];
  marks = [];
  busy = false;
  const L = freshLayer();
  L.add(centerText(s, GAME_W / 2, 26, 'YOU ARE X   -   A DRAW REFUNDS', PALETTE.gold));

  const size = 34;
  const ox = GAME_W / 2 - size * 1.5;
  const oy = 40;
  L.add(panel(s, ox - 8, oy - 8, size * 3 + 16, size * 3 + 16, 0x5c4326, 0x8a6a3a, 5));

  for (let i = 0; i < 9; i++) {
    const cx = ox + (i % 3) * size + size / 2;
    const cy = oy + Math.floor(i / 3) * size + size / 2;
    const r = s.add.rectangle(cx, cy, size - 3, size - 3, 0xfff0c9).setStrokeStyle(1, 0x8a6a3a);
    r.setInteractive({ useHandCursor: true });
    r.on('pointerover', () => {
      if (!busy && board[i] === '') r.setFillStyle(0xffe08a);
    });
    r.on('pointerout', () => r.setFillStyle(0xfff0c9));
    r.on('pointerdown', () => play(i));
    cells.push(r);
    const m = s.add.graphics().setDepth(5);
    marks.push(m);
    L.add([r, m]);
  }
}

// ---------------------------------------------------- rock paper scissors

const SKIN = 0xe8b890;
const SKIN_DARK = 0xb8865e;
const FROG = 0x46c46e;
const FROG_DARK = 0x2a7a44;

/**
 * A hand, as a little drawing: the fist, the flat palm, or two fingers out.
 * Drawn pointing right (the player's, from the left of the table) or, with
 * `flip`, pointing left (Froggy's, from the right).  Froggy's has the round
 * pads on its fingertips.
 */
function drawHand(s: Phaser.Scene, kind: Hand, x: number, y: number, k: number, col: number, flip: boolean): Phaser.GameObjects.Container {
  const frog = col === FROG;
  const dark = frog ? FROG_DARK : SKIN_DARK;
  const c = s.add.container(x, y);
  const R = (dx: number, dy: number, w: number, h: number, colr: number, r = 2) => {
    const g = s.add.graphics();
    g.fillStyle(dark, 1).fillRoundedRect(dx - w / 2 - 1, dy - h / 2 - 1, w + 2, h + 2, r + 1);
    g.fillStyle(colr, 1).fillRoundedRect(dx - w / 2, dy - h / 2, w, h, r);
    c.add(g);
  };
  const pad = (dx: number, dy: number) => {
    if (frog) c.add(s.add.circle(dx, dy, 2.2, 0x6fe08e).setStrokeStyle(0.8, dark));
  };
  // the wrist and the back of the hand
  R(-16, 0, 14, 12, col, 3);
  R(-3, 0, 16, 18, col, 5);
  if (kind === 'rock') {
    // fingers curled: four knuckles stacked on the front
    for (let i = 0; i < 4; i++) R(6, -6 + i * 4, 7, 4, col, 2);
    R(-2, 7, 10, 4, col, 2); // the thumb across under
  } else if (kind === 'paper') {
    // fingers straight out, a little spread
    for (let i = 0; i < 4; i++) {
      R(12, -6.6 + i * 4.4, 16, 3.6, col, 1.8);
      pad(20, -6.6 + i * 4.4);
    }
    R(-1, -11, 10, 4, col, 2); // the thumb up
  } else {
    // two fingers out in a V, two curled
    for (const ang of [-16, 10]) {
      const f = s.add.container(4, -3).setAngle(ang);
      const g = s.add.graphics();
      g.fillStyle(dark, 1).fillRoundedRect(-1, -3, 20, 6, 2.5);
      g.fillStyle(col, 1).fillRoundedRect(0, -2, 18, 4, 2);
      f.add(g);
      if (frog) f.add(s.add.circle(18, 0, 2.2, 0x6fe08e).setStrokeStyle(0.8, dark));
      c.add(f);
    }
    R(6, 4.5, 7, 4, col, 2);
    R(6, 8.5, 7, 4, col, 2);
  }
  c.setScale(flip ? -k : k, k);
  return c;
}

let myHand: Phaser.GameObjects.Container | null = null;
let hisHand: Phaser.GameObjects.Container | null = null;

function startRps(): void {
  const s = sceneRef;
  if (!s) return;
  current = 'rps';
  busy = false;
  const L = freshLayer();
  L.add(centerText(s, GAME_W / 2, 26, 'ROCK PAPER SCISSORS   -   A DRAW REFUNDS', PALETTE.gold));
  L.add(centerText(s, 70, 44, 'YOU', PALETTE.cream));
  L.add(centerText(s, 250, 44, 'FROGGY', PALETTE.mossLight));
  myHand = drawHand(s, 'rock', 74, 84, 1.6, SKIN, false);
  hisHand = drawHand(s, 'rock', 246, 84, 1.6, FROG, true);
  L.add([myHand, hisHand]);
  L.add(centerText(s, GAME_W / 2, 122, 'PICK YOUR HAND', PALETTE.cream));
  // the three choices, each a button with its hand on it
  HANDS.forEach((h, i) => {
    const x = 92 + i * 68;
    const b = button(s, x, 150, '', () => throwHands(h, null), { width: 58, height: 30 });
    b.add(drawHand(s, h, -2, -3, 0.6, SKIN, false));
    b.add(centerText(s, 0, 10, h.toUpperCase(), PALETTE.cream));
    L.add(b);
  });
}

/** Both fists up and down three times, then open on the third. */
function throwHands(mine: Hand, forced: Hand | null): void {
  const s = sceneRef;
  if (!s || busy || current !== 'rps' || !myHand || !hisHand) return;
  busy = true;
  const his = forced ?? HANDS[Math.floor(Math.random() * 3)];
  audio.sfx('ui_blip');
  const L = layer!;
  let mh = myHand;
  let hh = hisHand;
  const y0 = mh.y;
  s.tweens.add({
    targets: [mh, hh],
    y: y0 - 16,
    duration: 170,
    yoyo: true,
    repeat: 2,
    ease: 'Sine.easeInOut',
    onRepeat: () => audio.sfx('ui_hover'),
    onComplete: () => {
      // open them
      const mx = mh.x;
      const hx = hh.x;
      mh.destroy();
      hh.destroy();
      mh = drawHand(s, mine, mx, y0, 1.6, SKIN, false);
      hh = drawHand(s, his, hx, y0, 1.6, FROG, true);
      myHand = mh;
      hisHand = hh;
      L.add([mh, hh]);
      audio.sfx('item_thud');
      const result = mine === his ? 'draw' : BEATS[mine] === his ? 'win' : 'lose';
      s.time.delayedCall(450, () => roundOver(result, `${mine.toUpperCase()} vs ${his.toUpperCase()}`));
    },
  });
}

// ------------------------------------------------------------- the round

/**
 * The round is over: pay it now, say so, and ask PLAY AGAIN or LEAVE.  Each
 * round settles itself (a win pays the reward, a draw hands the token back),
 * so LEAVE is only the session's report.
 */
function roundOver(result: 'win' | 'lose' | 'draw', detail = ''): void {
  const s = sceneRef;
  const api = apiRef;
  if (!s || !api) return;
  busy = true;
  const def = cabinetById('tictactoe');
  if (result === 'win') {
    api.payout(def.reward);
    audio.sfx('chime');
  } else if (result === 'draw') {
    api.payout(def.cost);
    audio.sfx('coin_drop');
  } else {
    audio.sfx('buzzer');
  }
  const L = layer!;
  const box = s.add.rectangle(GAME_W / 2, 150, 236, 48, PALETTE.ink, 0.92).setStrokeStyle(1, result === 'win' ? PALETTE.gold : PALETTE.steel);
  const head =
    result === 'win' ? `YOU WIN  +${def.reward}` : result === 'draw' ? `A DRAW  -  ${def.cost} BACK` : 'FROGGY WINS';
  L.add(box);
  L.add(centerText(s, GAME_W / 2, 135, detail ? `${detail}  -  ${head}` : head, result === 'win' ? PALETTE.gold : PALETTE.cream));
  const game = current;
  L.add(
    button(s, GAME_W / 2 - 74, 158, 'PLAY AGAIN', () => {
      if (!api.raise(def.cost)) {
        L.add(centerText(s, GAME_W / 2, 124, 'NOT ENOUGH TOKENS', PALETTE.ember));
        audio.sfx('buzzer');
        return;
      }
      audio.sfx('coin_drop');
      if (game === 'rps') startRps();
      else startTicTacToe();
    }, { width: 80, height: 14, fill: PALETTE.moss }),
  );
  L.add(button(s, GAME_W / 2, 158, 'OTHER GAME', () => {
    if (!api.raise(def.cost)) {
      L.add(centerText(s, GAME_W / 2, 124, 'NOT ENOUGH TOKENS', PALETTE.ember));
      audio.sfx('buzzer');
      return;
    }
    if (game === 'rps') startTicTacToe();
    else startRps();
  }, { width: 64, height: 14 }));
  L.add(button(s, GAME_W / 2 + 74, 158, 'LEAVE', () => api.cashOut(), { width: 56, height: 14, fill: 0x5a1a22 }));
}

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

function play(i: number): void {
  const scene = sceneRef;
  if (!scene || busy || board[i] !== '') return;
  board[i] = 'X';
  audio.sfx('ui_blip');
  render();

  if (settle()) return;

  busy = true;
  scene.time.delayedCall(360, () => {
    const move = aiMove();
    if (move >= 0) {
      board[move] = 'O';
      audio.sfx('ui_hover');
      render();
    }
    busy = false;
    settle();
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
function settle(): boolean {
  const scene = sceneRef;
  if (!scene) return false;
  const w = winnerOf(board);
  if (w === 'X') {
    busy = true;
    scene.time.delayedCall(300, () => roundOver('win'));
    return true;
  }
  if (w === 'O') {
    busy = true;
    scene.time.delayedCall(300, () => roundOver('lose'));
    return true;
  }
  if (full(board)) {
    busy = true;
    scene.time.delayedCall(300, () => roundOver('draw'));
    return true;
  }
  return false;
}
