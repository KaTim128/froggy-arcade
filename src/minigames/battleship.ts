/**
 * BATTLESHIP.  Medium — 3 tokens in, 6 out.
 *
 * Seven-by-seven, four ships a side, alternating fire.  The opponent is what
 * sets the difficulty: it fires at random until it draws blood, then works the
 * neighbours of that hit until the ship is dead, which is exactly how a person
 * plays and roughly twice as dangerous as pure random.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const N = 7;
const CELL = 12;
const SHIPS = [3, 3, 2, 2];
const GRID_Y = 44;
const MINE_X = 26;
const THEIRS_X = 186;

type Cell = 'empty' | 'ship' | 'hit' | 'miss';

interface Side {
  grid: Cell[];
  rects: Phaser.GameObjects.Rectangle[];
  /** Cells still holding an unhit ship segment. */
  afloat: number;
}

let mine: Side | null = null;
let theirs: Side | null = null;
let turn: 'player' | 'enemy' = 'player';
let over = false;
let status: Phaser.GameObjects.BitmapText | null = null;
let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;

/** Cells the opponent knows are worth following up. */
let hunt: number[] = [];
let tried: Set<number> = new Set();

const idx = (c: number, r: number) => r * N + c;
const inside = (c: number, r: number) => c >= 0 && r >= 0 && c < N && r < N;

export const battleship: MinigameModule = {
  id: 'battleship',
  title: 'BATTLESHIP',
  music: 'game_battleship',
  rules: 'sink all four',
  tutorial: {
    objective: [
      'SINK ALL FOUR OF HIS SHIPS',
      'BEFORE HE SINKS ALL FOUR OF YOURS.',
    ],
    controls: [
      ['MOUSE', 'CLICK THEIR GRID TO FIRE'],
    ],
  },
  // Played entirely by tapping the grid.
  touch: {},

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    sceneRef = scene;
    over = false;
    turn = 'player';
    hunt = [];
    tried = new Set();

    scene.add.rectangle(0, 18, GAME_W, 162, 0x0b1a24).setOrigin(0, 0);
    // a horizon, so the board reads as water rather than graph paper
    scene.add.rectangle(0, 30, GAME_W, 1, 0x18394a).setOrigin(0, 0);
    // and waves on it: short pale dashes, staggered row on row
    for (let i = 0; i < 120; i++) {
      const wx = ((i * 53) % (GAME_W - 8)) + 4;
      const wy = 36 + ((i * 29) % 140);
      scene.add.rectangle(wx, wy, 4 + (i % 3), 1, 0x9fd4ff).setOrigin(0, 0).setAlpha(0.12);
    }

    text(scene, MINE_X, 34, 'YOUR FLEET', PALETTE.tealLight);
    text(scene, THEIRS_X, 34, 'THEIRS', PALETTE.blood);

    mine = makeSide(scene, MINE_X, true);
    theirs = makeSide(scene, THEIRS_X, false);

    status = centerText(scene, GAME_W / 2, 150, 'FIRE AT WILL', PALETTE.cream);
    centerText(scene, GAME_W / 2, 164, 'click a square on their grid', PALETTE.ash).setAlpha(0.7);
  },

  destroy() {
    mine = null;
    theirs = null;
    status = null;
    apiRef = null;
    sceneRef = null;
  },
};

// -------------------------------------------------------------------- setup

function makeSide(scene: Phaser.Scene, ox: number, isMine: boolean): Side {
  const side: Side = { grid: new Array(N * N).fill('empty'), rects: [], afloat: 0 };
  placeFleet(side);
  side.afloat = side.grid.filter((c) => c === 'ship').length;

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const x = ox + c * CELL;
      const y = GRID_Y + r * CELL;
      const rect = scene.add
        .rectangle(x, y, CELL - 1, CELL - 1, 0x14384e)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x2a6a86);
      // coordinates down the side and along the top of each board
      if (c === 0) text(scene, ox - 8, y + 2, String.fromCharCode(65 + r), 0x4a8aa6, 8);
      if (r === N - 1) text(scene, x + 3, GRID_Y + N * CELL + 1, String(c + 1), 0x4a8aa6, 8);
      side.rects.push(rect);

      if (!isMine) {
        rect.setInteractive({ useHandCursor: true });
        rect.on('pointerdown', () => fire(idx(c, r)));
      }
    }
  }

  if (isMine) repaint(side, true);
  return side;
}

/** Random placement, retried until every ship fits without touching another. */
function placeFleet(side: Side): void {
  for (const len of SHIPS) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const horiz = Math.random() < 0.5;
      const c = Phaser.Math.Between(0, N - (horiz ? len : 1));
      const r = Phaser.Math.Between(0, N - (horiz ? 1 : len));
      let ok = true;
      for (let i = 0; i < len && ok; i++) {
        const cc = c + (horiz ? i : 0);
        const rr = r + (horiz ? 0 : i);
        // Ships may not touch, or a sunk one tells you too much about the next.
        for (let dc = -1; dc <= 1 && ok; dc++) {
          for (let dr = -1; dr <= 1 && ok; dr++) {
            if (inside(cc + dc, rr + dr) && side.grid[idx(cc + dc, rr + dr)] === 'ship') ok = false;
          }
        }
      }
      if (!ok) continue;
      for (let i = 0; i < len; i++) {
        side.grid[idx(c + (horiz ? i : 0), r + (horiz ? 0 : i))] = 'ship';
      }
      break;
    }
  }
}

// --------------------------------------------------------------------- play

function fire(at: number): void {
  if (over || turn !== 'player' || !theirs) return;
  const cell = theirs.grid[at];
  if (cell === 'hit' || cell === 'miss') return;

  const hitShip = cell === 'ship';
  theirs.grid[at] = hitShip ? 'hit' : 'miss';
  if (hitShip) theirs.afloat--;
  repaint(theirs, false);
  audio.sfx(hitShip ? 'whack' : 'drip');

  if (theirs.afloat <= 0) {
    finish(true);
    return;
  }

  status?.setText(hitShip ? 'HIT' : 'MISS');
  turn = 'enemy';
  // A beat before they answer, so the turns read as turns.
  sceneRef?.time.delayedCall(650, enemyTurn);
}

function enemyTurn(): void {
  if (over || !mine) return;

  let at = -1;
  while (hunt.length > 0) {
    const candidate = hunt.pop()!;
    if (!tried.has(candidate)) {
      at = candidate;
      break;
    }
  }
  if (at < 0) {
    const open: number[] = [];
    for (let i = 0; i < N * N; i++) if (!tried.has(i)) open.push(i);
    if (open.length === 0) return;
    at = Phaser.Utils.Array.GetRandom(open);
  }

  tried.add(at);
  const hitShip = mine.grid[at] === 'ship';
  mine.grid[at] = hitShip ? 'hit' : 'miss';
  if (hitShip) mine.afloat--;
  repaint(mine, true);
  audio.sfx(hitShip ? 'buzzer' : 'drip');

  if (hitShip) {
    // Work the neighbours until the thing stops bleeding.
    const c = at % N;
    const r = Math.floor(at / N);
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (inside(c + dc, r + dr) && !tried.has(idx(c + dc, r + dr))) hunt.push(idx(c + dc, r + dr));
    }
  }

  if (mine.afloat <= 0) {
    finish(false);
    return;
  }

  status?.setText(hitShip ? 'THEY HIT YOU' : 'THEY MISSED');
  turn = 'player';
}

function repaint(side: Side, revealShips: boolean): void {
  for (let i = 0; i < side.grid.length; i++) {
    const cell = side.grid[i];
    const rect = side.rects[i];
    if (cell === 'hit') rect.setFillStyle(PALETTE.blood);
    else if (cell === 'miss') rect.setFillStyle(0x0a1c26);
    else if (cell === 'ship' && revealShips) rect.setFillStyle(0x3f5a68);
    else rect.setFillStyle(0x123243);
  }
}

function finish(won: boolean): void {
  if (over) return;
  over = true;
  status?.setText(won ? 'FLEET SUNK' : 'YOU ARE SUNK');
  if (theirs) repaint(theirs, true);
  sceneRef?.time.delayedCall(900, () => (won ? apiRef?.win() : apiRef?.lose()));
}
