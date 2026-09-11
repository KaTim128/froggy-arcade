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
  /** Tile this entity last made a turn decision in.  See `arrived`. */
  lastTile: number;
}

let grid: string[][] = [];
let pelletObjs: Array<Phaser.GameObjects.Arc | null> = [];
let pelletsLeft = 0;
let player = { col: 10, row: 13, px: 0, py: 0, dir: { x: 0, y: 0 }, want: { x: 0, y: 0 }, lastTile: -1 };
let playerSprite: Phaser.GameObjects.Arc | null = null;
let chompPhase = 0;
let ghosts: Ghost[] = [];
let lives = LIVES;
let frightMs = 0;
let scatterTimer = SCATTER_EVERY_MS;
let scatterMs = 0;
let over = false;
let dying = false;
let hud: Phaser.GameObjects.BitmapText | null = null;
let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;

const isWall = (col: number, row: number): boolean =>
  col < 0 || row < 0 || col >= COLS || row >= ROWS || grid[row][col] === '#';

const tileX = (col: number) => OX + col * TILE + TILE / 2;
const tileY = (row: number) => OY + row * TILE + TILE / 2;

export const chompMan: MinigameModule = {
  id: 'chompman',
  title: 'CHOMP-MAN',
  music: 'game_chompman',
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

    scene.add.rectangle(0, 18, GAME_W, 162, 0x0a0618).setOrigin(0, 0);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = grid[r][c];
        const idx = r * COLS + c;
        pelletObjs[idx] = null;
        if (ch === '#') {
          // a neon wall: a lit edge round a dark core
          scene.add.rectangle(tileX(c), tileY(r), TILE - 1, TILE - 1, PALETTE.violet).setAlpha(0.9);
          scene.add.rectangle(tileX(c), tileY(r), TILE - 5, TILE - 5, 0x2a1a4a);
        } else if (ch === '.') {
          pelletObjs[idx] = scene.add.circle(tileX(c), tileY(r), 1, PALETTE.cream);
          pelletsLeft++;
        } else if (ch === 'o') {
          // Cream, not gold: gold is the player, and at 8px a gold dot and a
          // gold player circle were the same object to the eye.
          pelletObjs[idx] = scene.add.circle(tileX(c), tileY(r), 3, PALETTE.cream);
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
    player.lastTile = -1;
    // A wedge, not a disc — the mouth is what makes him read as a character
    // among a maze of dots instead of one more pellet.
    playerSprite = scene.add.arc(player.px, player.py, 4, 32, 328, false, PALETTE.gold).setDepth(20);

    const spawns: Array<[GhostKind, number, number, number, number, number]> = [
      // kind, startCol, startRow, cornerCol, cornerRow, colour
      ['direct', 1, 1, 1, 1, PALETTE.blood],
      ['ambush', 19, 1, 19, 1, PALETTE.ember],
      ['random', 1, 13, 1, 13, PALETTE.tealLight],
      ['patrol', 19, 13, 19, 13, PALETTE.neon],
    ];
    for (const [kind, sc, sr, cc, cr, color] of spawns) {
      // a ghost: a rounded head, a frilled hem, two eyes that look at you
      const body = scene.add.rectangle(0, 0, 7, 7, color);
      const dome = scene.add.circle(0, -2, 3.5, color);
      const hemL = scene.add.rectangle(-2.5, 3.5, 2, 1, color);
      const hemR = scene.add.rectangle(2.5, 3.5, 2, 1, color);
      const eyeL = scene.add.rectangle(-1.7, -1.5, 2, 2, PALETTE.white);
      const eyeR = scene.add.rectangle(1.7, -1.5, 2, 2, PALETTE.white);
      const pupL = scene.add.rectangle(-1.4, -1.5, 1, 1, 0x1a1a3a);
      const pupR = scene.add.rectangle(2, -1.5, 1, 1, 0x1a1a3a);
      const sprite = scene.add.container(tileX(sc), tileY(sr), [dome, body, hemL, hemR, eyeL, eyeR, pupL, pupR]).setDepth(19);
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
        lastTile: -1,
      });
    }

    hud = centerText(scene, GAME_W / 2, 24, '', PALETTE.cream);
    refreshHud();

    // Both schemes, live at once — WASD is added to the arrows, not instead of
    // them, so neither set can stop working without the other noticing.
    const kb = scene.input.keyboard;
    const steer = (x: number, y: number) => () => (player.want = { x, y });
    for (const key of ['RIGHT', 'D']) kb?.on(`keydown-${key}`, steer(1, 0));
    for (const key of ['LEFT', 'A']) kb?.on(`keydown-${key}`, steer(-1, 0));
    for (const key of ['DOWN', 'S']) kb?.on(`keydown-${key}`, steer(0, 1));
    for (const key of ['UP', 'W']) kb?.on(`keydown-${key}`, steer(0, -1));
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

/**
 * True on the frame an entity settles into a tile it has not decided in yet.
 *
 * The decision USED to run on every frame `atCentre` was true, and it re-snaps
 * position to the tile centre.  At 60fps a step is 0.64-0.70px, well inside the
 * 1.2px centre band, so the snap undid the step and re-ran forever: nothing in
 * the maze ever moved, player or ghost.  It only came unstuck below ~33fps,
 * where one step finally cleared the band — which is why it looked fine in a
 * throttled tab and dead in a real one.
 *
 * Deciding once per entered tile also gives Pac-Man's turn buffering for free:
 * a direction pressed mid-tile applies at the next centre.
 */
function arrived(px: number, py: number, col: number, row: number, dir: Dir, lastTile: number): boolean {
  if (!atCentre(px, py, col, row)) return false;
  const stopped = dir.x === 0 && dir.y === 0;
  return stopped || lastTile !== row * COLS + col;
}

function movePlayer(dt: number): void {
  if (!playerSprite) return;
  chompPhase += dt * 9;

  if (arrived(player.px, player.py, player.col, player.row, player.dir, player.lastTile)) {
    player.lastTile = player.row * COLS + player.col;
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
  animateMouth();

  eatPellet();
}

/** Chomp on the move, mouth shut when idle, always facing the way he is going. */
function animateMouth(): void {
  if (!playerSprite) return;
  const moving = player.dir.x !== 0 || player.dir.y !== 0;
  if (!moving) {
    playerSprite.setStartAngle(8);
    playerSprite.setEndAngle(352);
    return;
  }
  playerSprite.setAngle(Math.atan2(player.dir.y, player.dir.x) * (180 / Math.PI));
  const gape = 6 + Math.abs(Math.sin(chompPhase)) * 34;
  playerSprite.setStartAngle(gape);
  playerSprite.setEndAngle(360 - gape);
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

  if (arrived(g.px, g.py, g.col, g.row, g.dir, g.lastTile)) {
    g.lastTile = g.row * COLS + g.col;
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
      g.lastTile = -1;
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
    player.lastTile = -1;
    playerSprite?.setPosition(player.px, player.py);
    for (const g of ghosts) {
      g.col = g.home.col;
      g.row = g.home.row;
      g.px = tileX(g.col);
      g.py = tileY(g.row);
      g.lastTile = -1;
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
