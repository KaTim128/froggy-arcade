/**
 * CHOMP-MAN.  PRD §9.7 — Hard, 5 tokens in, 10 out.
 *
 * An original homage (PRD MG-7 / VOC-22): original maze geometry, original
 * frog-themed ghosts, original sounds, original name.  No Namco assets, no
 * reproduced layout, no trademarked names.
 *
 * Four ghosts with distinct behaviours, three lives, four power pellets, and a
 * scatter phase every 20 seconds that is the player's breathing room — it is
 * what keeps this at a 30-45% win rate instead of 10%.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

// Original maze.  '#' wall, '.' pellet, 'o' power pellet, 'P' player start.
const MAZE = [
  '#####################',
  '#........#.#........#',
  '#o##.###.#.#.###.##o#',
  '#...................#',
  '#.##.#.#######.#.##.#',
  '#....#....#....#....#',
  '####.####.#.####.####',
  '#.......#...#.......#',
  '####.####.#.####.####',
  '#....#....#....#....#',
  '#.##.#.#######.#.##.#',
  '#...................#',
  '#o##.###.#.#.###.##o#',
  '#........#P#........#',
  '#####################',
];

const COLS = MAZE[0].length;
const ROWS = MAZE.length;
const TILE = 8;
const OX = Math.round((GAME_W - COLS * TILE) / 2);
const OY = 32;

const PLAYER_SPEED = 44; // 5.5 tiles/s
const GHOST_SPEED = 40; // 5.0 tiles/s
const FRIGHT_SPEED = 24; // 3.0 tiles/s
const FRIGHT_MS = 6000;
const FRIGHT_WARN_MS = 1500;
const SCATTER_EVERY_MS = 20_000;
const SCATTER_MS = 4000;
const LIVES = 3;

type Dir = { x: number; y: number };
const DIRS: Dir[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

type GhostKind = 'direct' | 'ambush' | 'random' | 'patrol';

interface Ghost {
  kind: GhostKind;
  col: number;
  row: number;
  px: number;
  py: number;
  dir: Dir;
  home: { col: number; row: number };
  corner: { col: number; row: number };
  sprite: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Rectangle;
  patrolIdx: number;
}

let grid: string[][] = [];
let pelletObjs: Array<Phaser.GameObjects.Arc | null> = [];
let pelletsLeft = 0;
let player = { col: 10, row: 13, px: 0, py: 0, dir: { x: 0, y: 0 }, want: { x: 0, y: 0 } };
let playerSprite: Phaser.GameObjects.Arc | null = null;
let ghosts: Ghost[] = [];
let lives = LIVES;
let frightMs = 0;
let scatterTimer = SCATTER_EVERY_MS;
let scatterMs = 0;
let over = false;
let dying = false;
let hud: Phaser.GameObjects.Text | null = null;
let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;

const isWall = (col: number, row: number): boolean =>
  col < 0 || row < 0 || col >= COLS || row >= ROWS || grid[row][col] === '#';

const tileX = (col: number) => OX + col * TILE + TILE / 2;
const tileY = (row: number) => OY + row * TILE + TILE / 2;

export const chompMan: MinigameModule = {
  id: 'chompman',
  title: 'CHOMP-MAN',
  rules: 'clear the maze',

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    sceneRef = scene;
    over = false;
    dying = false;
    lives = LIVES;
    frightMs = 0;
    scatterTimer = SCATTER_EVERY_MS;
    scatterMs = 0;
    grid = MAZE.map((r) => r.split(''));
    pelletObjs = [];
    pelletsLeft = 0;
    ghosts = [];

    scene.add.rectangle(0, 18, GAME_W, 162, PALETTE.black).setOrigin(0, 0);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = grid[r][c];
        const idx = r * COLS + c;
        pelletObjs[idx] = null;
        if (ch === '#') {
          scene.add.rectangle(tileX(c), tileY(r), TILE - 1, TILE - 1, PALETTE.violet).setAlpha(0.9);
        } else if (ch === '.') {
          pelletObjs[idx] = scene.add.circle(tileX(c), tileY(r), 1, PALETTE.cream);
          pelletsLeft++;
        } else if (ch === 'o') {
          pelletObjs[idx] = scene.add.circle(tileX(c), tileY(r), 3, PALETTE.gold);
          pelletsLeft++;
        } else if (ch === 'P') {
          player.col = c;
          player.row = r;
        }
      }
    }

    player.px = tileX(player.col);
    player.py = tileY(player.row);
    player.dir = { x: 0, y: 0 };
    player.want = { x: 0, y: 0 };
    playerSprite = scene.add.circle(player.px, player.py, 3.4, PALETTE.gold).setDepth(20);

    const spawns: Array<[GhostKind, number, number, number, number, number]> = [
      // kind, startCol, startRow, cornerCol, cornerRow, colour
      ['direct', 1, 1, 1, 1, PALETTE.blood],
      ['ambush', 19, 1, 19, 1, PALETTE.ember],
      ['random', 1, 13, 1, 13, PALETTE.tealLight],
      ['patrol', 19, 13, 19, 13, PALETTE.neon],
    ];
    for (const [kind, sc, sr, cc, cr, color] of spawns) {
      const body = scene.add.rectangle(0, 0, 7, 7, color);
      const eye = scene.add.rectangle(0, -1, 4, 2, PALETTE.white);
      const sprite = scene.add.container(tileX(sc), tileY(sr), [body, eye]).setDepth(19);
      ghosts.push({
        kind,
        col: sc,
        row: sr,
        px: tileX(sc),
        py: tileY(sr),
        dir: { ...DIRS[0] },
        home: { col: sc, row: sr },
        corner: { col: cc, row: cr },
        sprite,
        body,
        patrolIdx: 0,
      });
    }

    hud = centerText(scene, GAME_W / 2, 24, '', PALETTE.cream);
    refreshHud();

    const kb = scene.input.keyboard;
    kb?.on('keydown-RIGHT', () => (player.want = { x: 1, y: 0 }));
    kb?.on('keydown-LEFT', () => (player.want = { x: -1, y: 0 }));
    kb?.on('keydown-DOWN', () => (player.want = { x: 0, y: 1 }));
    kb?.on('keydown-UP', () => (player.want = { x: 0, y: -1 }));
  },

  update(_t: number, delta: number) {
    if (over || dying || !playerSprite) return;
    const dt = delta / 1000;

    // ---- scatter cycle
    if (scatterMs > 0) {
      scatterMs -= delta;
    } else {
      scatterTimer -= delta;
      if (scatterTimer <= 0) {
        scatterTimer = SCATTER_EVERY_MS;
        scatterMs = SCATTER_MS;
      }
    }
    if (frightMs > 0) frightMs -= delta;

    movePlayer(dt);
    for (const g of ghosts) moveGhost(g, dt);
    checkCollisions();
    refreshHud();
  },

  destroy() {
    ghosts = [];
    pelletObjs = [];
    playerSprite = null;
    apiRef = null;
    sceneRef = null;
  },
};

// ------------------------------------------------------------------ player

function atCentre(px: number, py: number, col: number, row: number): boolean {
  return Math.abs(px - tileX(col)) < 1.2 && Math.abs(py - tileY(row)) < 1.2;
}

function movePlayer(dt: number): void {
  if (!playerSprite) return;

  if (atCentre(player.px, player.py, player.col, player.row)) {
    // snap, then consider turning
    player.px = tileX(player.col);
    player.py = tileY(player.row);
    if (
      (player.want.x || player.want.y) &&
      !isWall(player.col + player.want.x, player.row + player.want.y)
    ) {
      player.dir = { ...player.want };
    }
    if (isWall(player.col + player.dir.x, player.row + player.dir.y)) {
      player.dir = { x: 0, y: 0 };
    }
  }

  player.px += player.dir.x * PLAYER_SPEED * dt;
  player.py += player.dir.y * PLAYER_SPEED * dt;
  player.col = Math.round((player.px - OX - TILE / 2) / TILE);
  player.row = Math.round((player.py - OY - TILE / 2) / TILE);
  playerSprite.setPosition(player.px, player.py);

  eatPellet();
}

function eatPellet(): void {
  const idx = player.row * COLS + player.col;
  const obj = pelletObjs[idx];
  if (!obj) return;
  const ch = grid[player.row][player.col];
  obj.destroy();
  pelletObjs[idx] = null;
  grid[player.row][player.col] = ' ';
  pelletsLeft--;
  audio.sfx('ui_hover');

  if (ch === 'o') {
    frightMs = FRIGHT_MS;
    audio.sfx('chime');
  }
  if (pelletsLeft <= 0) finish(true);
}

// ------------------------------------------------------------------- ghosts

function moveGhost(g: Ghost, dt: number): void {
  const speed = frightMs > 0 ? FRIGHT_SPEED : GHOST_SPEED;

  if (atCentre(g.px, g.py, g.col, g.row)) {
    g.px = tileX(g.col);
    g.py = tileY(g.row);
    g.dir = chooseDir(g);
  }

  g.px += g.dir.x * speed * dt;
  g.py += g.dir.y * speed * dt;
  g.col = Math.round((g.px - OX - TILE / 2) / TILE);
  g.row = Math.round((g.py - OY - TILE / 2) / TILE);
  g.sprite.setPosition(g.px, g.py);

  // frightened look, flashing for the last 1.5s
  if (frightMs > 0) {
    const flashing = frightMs < FRIGHT_WARN_MS && Math.floor(frightMs / 150) % 2 === 0;
    g.body.setFillStyle(flashing ? PALETTE.white : PALETTE.nightLight);
  } else {
    g.body.setFillStyle(ghostColor(g.kind));
  }
}

function ghostColor(kind: GhostKind): number {
  switch (kind) {
    case 'direct':
      return PALETTE.blood;
    case 'ambush':
      return PALETTE.ember;
    case 'random':
      return PALETTE.tealLight;
    case 'patrol':
      return PALETTE.neon;
  }
}

/** PRD §9.7: four distinct behaviours, plus scatter and flight. */
function chooseDir(g: Ghost): Dir {
  const options = DIRS.filter((d) => !isWall(g.col + d.x, g.row + d.y));
  if (options.length === 0) return { x: 0, y: 0 };

  // No reversing unless it is the only way out — that is what makes them read
  // as characters instead of noise.
  const forward = options.filter((d) => !(d.x === -g.dir.x && d.y === -g.dir.y));
  const legal = forward.length ? forward : options;

  if (frightMs > 0) {
    // run away
    return furthestFrom(legal, g, player.col, player.row);
  }
  if (scatterMs > 0) {
    return nearestTo(legal, g, g.corner.col, g.corner.row);
  }

  switch (g.kind) {
    case 'direct':
      return nearestTo(legal, g, player.col, player.row);
    case 'ambush':
      return nearestTo(legal, g, player.col + player.dir.x * 4, player.row + player.dir.y * 4);
    case 'random':
      return legal[Math.floor(Math.random() * legal.length)];
    case 'patrol': {
      const circuit = [
        { col: 1, row: 1 },
        { col: 19, row: 1 },
        { col: 19, row: 13 },
        { col: 1, row: 13 },
      ];
      const inQuadrant = Math.abs(player.col - g.col) < 7 && Math.abs(player.row - g.row) < 6;
      if (inQuadrant) return nearestTo(legal, g, player.col, player.row);
      const t = circuit[g.patrolIdx % circuit.length];
      if (Math.abs(g.col - t.col) + Math.abs(g.row - t.row) < 2) g.patrolIdx++;
      return nearestTo(legal, g, t.col, t.row);
    }
  }
}

function nearestTo(opts: Dir[], g: Ghost, tc: number, tr: number): Dir {
  let best = opts[0];
  let bestD = Infinity;
  for (const d of opts) {
    const dist = Math.hypot(g.col + d.x - tc, g.row + d.y - tr);
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}

function furthestFrom(opts: Dir[], g: Ghost, tc: number, tr: number): Dir {
  let best = opts[0];
  let bestD = -Infinity;
  for (const d of opts) {
    const dist = Math.hypot(g.col + d.x - tc, g.row + d.y - tr);
    if (dist > bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}

// --------------------------------------------------------------- collisions

function checkCollisions(): void {
  for (const g of ghosts) {
    if (Math.hypot(g.px - player.px, g.py - player.py) > 6) continue;

    if (frightMs > 0) {
      audio.sfx('coin_spin');
      g.col = g.home.col;
      g.row = g.home.row;
      g.px = tileX(g.col);
      g.py = tileY(g.row);
      g.sprite.setPosition(g.px, g.py);
      continue;
    }
    loseLife();
    return;
  }
}

function loseLife(): void {
  if (dying || over) return;
  dying = true;
  lives--;
  audio.sfx('buzzer');
  refreshHud();

  if (lives <= 0) {
    finish(false);
    return;
  }
  sceneRef?.time.delayedCall(900, () => {
    player.col = 10;
    player.row = 13;
    player.px = tileX(player.col);
    player.py = tileY(player.row);
    player.dir = { x: 0, y: 0 };
    player.want = { x: 0, y: 0 };
    playerSprite?.setPosition(player.px, player.py);
    for (const g of ghosts) {
      g.col = g.home.col;
      g.row = g.home.row;
      g.px = tileX(g.col);
      g.py = tileY(g.row);
      g.sprite.setPosition(g.px, g.py);
    }
    frightMs = 0;
    dying = false;
  });
}

function refreshHud(): void {
  hud?.setText(`LIVES ${lives}    PELLETS ${pelletsLeft}`);
}

function finish(won: boolean): void {
  if (over) return;
  over = true;
  sceneRef?.time.delayedCall(700, () => (won ? apiRef?.win() : apiRef?.lose()));
}
