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
 *
 * THE MAZE IS A LATTICE, not four quadrants.  Every corridor meets another one
 * within a few tiles, so there is always a way round: a player who is being
 * followed can turn, loop and come back out behind the ghost that was on them,
 * which is the whole skill of the game and was impossible on a board of long
 * straight runs.  It is checked, not assumed — `tools/games.mjs` floods the
 * maze from the player's start and fails if a single pellet is unreachable.
 *
 * THE GHOSTS LIVE IN A BOX in the middle of it, with one door in the top of
 * it.  They come out one at a time rather than all at once, the door is a wall
 * to the player so the box is never a bolt-hole, and a ghost that gets eaten
 * goes back in it for TEN SECONDS before it can come out again — a power
 * pellet buys real time off the board, and clearing the last corner of the
 * maze is a thing you can plan rather than a thing you survive.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

/**
 * Original maze.  '#' wall, '-' the ghost box's door, ' ' the inside of the
 * box, '.' pellet, 'o' power pellet, 'P' player start.
 *
 * It is laid out as a lattice of corridors with wall islands between them, so
 * every junction has at least three ways out of it and almost nothing is a
 * dead end.  The door is a wall as far as the player is concerned: the inside
 * of the box is sealed, carries no pellets, and cannot be hidden in.
 */
const MAZE = [
  '#####################',
  '#o.................o#',
  '#.##.##.##.##.##.##.#',
  '#.##.##.##.##.##.##.#',
  '#...................#',
  '#.##.##.......##.##.#',
  '#.##.#####-#####.##.#',
  '#....###     ###....#',
  '#.##.###########.##.#',
  '#.##.##.......##.##.#',
  '#...................#',
  '#.##.##.##P##.##.##.#',
  '#.##.##.##.##.##.##.#',
  '#o.................o#',
  '#####################',
];

/** The box: where it is, where its door is, and where the four of them sit. */
const HOUSE = { left: 7, right: 13, top: 6, bottom: 8, doorCol: 10 };
const SEATS: Array<{ col: number; row: number }> = [
  { col: 8, row: 7 },
  { col: 9, row: 7 },
  { col: 11, row: 7 },
  { col: 12, row: 7 },
];
/** Staggered releases, so the board does not open with four of them on you. */
const RELEASE_MS = [0, 1800, 3600, 5400];
/** How long an eaten ghost sits in the box before it can come out again. */
export const GHOST_RESPAWN_MS = 10_000;
/** How fast one shuffles about inside the box and out through the door. */
const HOUSE_SPEED = 30;
/** Where the player starts, read off the maze so the two cannot drift apart. */
const START = (() => {
  for (let r = 0; r < MAZE.length; r++) {
    const c = MAZE[r].indexOf('P');
    if (c >= 0) return { col: c, row: r };
  }
  return { col: 10, row: 11 };
})();

const COLS = MAZE[0].length;
const ROWS = MAZE.length;
const TILE = 8;
const OX = Math.round((GAME_W - COLS * TILE) / 2);
/**
 * The maze is 120px tall in a 162px play area, so it is hung to leave a
 * readable gap under the HUD line and a matching one at the bottom.
 */
const OY = 40;

const PLAYER_SPEED = 44; // 5.5 tiles/s
/**
 * 4.6 tiles/s, down from 5.0.  The hunters path properly now rather than
 * guessing at the straight line (see `pathTo`), which is a large step up in
 * how dangerous they are; the speed came off to pay for it, so the player
 * keeps enough of an edge to actually shake one on a loop.
 */
const GHOST_SPEED = 37;
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

/**
 * Where a ghost is in its life.  `house` is waiting to be let out (or on its
 * way to the door), `out` is on the board and dangerous, `eaten` is sitting in
 * the box serving its ten seconds.
 */
type GhostState = 'house' | 'out' | 'eaten';

interface Ghost {
  kind: GhostKind;
  state: GhostState;
  /** ms left before it may leave the box.  Counts down in `house` and `eaten`. */
  wait: number;
  /** Its own place in the box, so four of them do not sit in one tile. */
  seat: { col: number; row: number };
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

/**
 * A wall to anything walking the maze.  The box's door counts: ghosts leave
 * through it on a scripted path of their own, and nothing — the player least
 * of all — walks through it under normal pathing.
 */
const isWall = (col: number, row: number): boolean =>
  col < 0 || row < 0 || col >= COLS || row >= ROWS || grid[row][col] === '#' || grid[row][col] === '-';

const tileX = (col: number) => OX + col * TILE + TILE / 2;
const tileY = (row: number) => OY + row * TILE + TILE / 2;

export const chompMan: MinigameModule = {
  id: 'chompman',
  title: 'CHOMP-MAN',
  music: 'game_chompman',
  rules: 'clear the maze',
  tutorial: {
    objective: [
      'CLEAR EVERY PELLET IN THE MAZE.',
      'THE GHOSTS END YOUR RUN - LOOP THEM.',
      'A POWER PELLET PUTS ONE AWAY FOR 10S.',
    ],
    controls: [
      ['W A S D', 'STEER'],
      ['ARROWS', 'STEER'],
    ],
  },

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
        } else if (ch === '-') {
          // The gate.  Drawn as a bar rather than a block so it reads as the
          // one gap in the box — which is exactly what it is, for them.
          scene.add.rectangle(tileX(c), tileY(r), TILE - 1, 2, PALETTE.tealLight).setAlpha(0.9);
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

    // The floor of the box, so it reads as a room rather than a hole in the
    // maze, and the player can see who is still in it.
    scene.add
      .rectangle(
        tileX(HOUSE.left) + TILE / 2,
        tileY(HOUSE.top) + TILE / 2,
        (HOUSE.right - HOUSE.left) * TILE - TILE,
        (HOUSE.bottom - HOUSE.top) * TILE - TILE,
        0x1a1030,
      )
      .setOrigin(0, 0);

    player.px = tileX(player.col);
    player.py = tileY(player.row);
    player.dir = { x: 0, y: 0 };
    player.want = { x: 0, y: 0 };
    player.lastTile = -1;
    // A wedge, not a disc — the mouth is what makes him read as a character
    // among a maze of dots instead of one more pellet.
    playerSprite = scene.add.arc(player.px, player.py, 4, 32, 328, false, PALETTE.gold).setDepth(20);

    // All four start in the box and are let out one at a time.  `corner` is
    // where each one runs to when the scatter phase says so, and they are the
    // four corners of the maze, which is what makes scatter readable.
    const spawns: Array<[GhostKind, number, number, number]> = [
      // kind, cornerCol, cornerRow, colour
      ['direct', 1, 1, PALETTE.blood],
      ['ambush', 19, 1, PALETTE.ember],
      ['random', 1, 13, PALETTE.tealLight],
      ['patrol', 19, 13, PALETTE.neon],
    ];
    spawns.forEach(([kind, cc, cr, color], i) => {
      const seat = SEATS[i];
      const sc = seat.col;
      const sr = seat.row;
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
        state: 'house',
        wait: RELEASE_MS[i] ?? 0,
        seat,
        col: sc,
        row: sr,
        px: tileX(sc),
        py: tileY(sr),
        dir: { x: 0, y: -1 },
        home: { col: sc, row: sr },
        corner: { col: cc, row: cr },
        sprite,
        body,
        patrolIdx: 0,
        lastTile: -1,
      });
    });

    hud = centerText(scene, GAME_W / 2, 28, '', PALETTE.cream);
    refreshHud();

    // Both schemes, live at once — WASD is added to the arrows, not instead of
    // them, so neither set can stop working without the other noticing.
    const kb = scene.input.keyboard;
    const steer = (x: number, y: number) => () => (player.want = { x, y });
    for (const key of ['RIGHT', 'D']) kb?.on(`keydown-${key}`, steer(1, 0));
    for (const key of ['LEFT', 'A']) kb?.on(`keydown-${key}`, steer(-1, 0));
    for (const key of ['DOWN', 'S']) kb?.on(`keydown-${key}`, steer(0, 1));
    for (const key of ['UP', 'W']) kb?.on(`keydown-${key}`, steer(0, -1));

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__chomp = {
        state: () => ({
          lives,
          pelletsLeft,
          frightMs: Math.round(frightMs),
          over,
          player: { col: player.col, row: player.row },
          ghosts: ghosts.map((g) => ({
            kind: g.kind,
            state: g.state,
            wait: Math.round(g.wait),
            col: g.col,
            row: g.row,
          })),
        }),
        /** The maze as data, so the harness can flood it and count the routes. */
        maze: () => MAZE.slice(),
        house: () => ({ ...HOUSE, seats: SEATS.map((s2) => ({ ...s2 })), respawnMs: GHOST_RESPAWN_MS }),
        /** Eat one, without having to find a power pellet first. */
        eat: (i = 0) => {
          const g = ghosts[i];
          if (g) sendHome(g, GHOST_RESPAWN_MS);
        },
        /** Let them all out now, for tests that want them on the board. */
        release: () => {
          for (const g of ghosts) if (g.state === 'house') g.wait = 0;
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__chomp;
      });
    }
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
  // ---- serving time, or waiting to be let out.  Neither is on the board.
  if (g.state === 'eaten' || g.state === 'house') {
    g.wait -= dt * 1000;
    if (g.state === 'eaten') {
      // Eyes only, sat in its own seat, until the ten seconds are up.
      g.sprite.setAlpha(0.4);
      g.px = tileX(g.seat.col);
      g.py = tileY(g.seat.row) + Math.sin(g.wait / 260) * 1.2;
      g.col = g.seat.col;
      g.row = g.seat.row;
      g.sprite.setPosition(g.px, g.py);
      if (g.wait <= 0) {
        g.state = 'house';
        g.wait = 0;
        g.sprite.setAlpha(1);
      }
      return;
    }
    if (g.wait > 0) {
      // Shuffling on the spot: it is in there, and you can see it is coming.
      g.py = tileY(g.seat.row) + Math.sin(g.wait / 200) * 1.6;
      g.sprite.setPosition(g.px, g.py);
      return;
    }
    leaveHouse(g, dt);
    return;
  }

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
  if (frightMs > 0 && g.state === 'out') {
    const flashing = frightMs < FRIGHT_WARN_MS && Math.floor(frightMs / 150) % 2 === 0;
    g.body.setFillStyle(flashing ? PALETTE.white : PALETTE.nightLight);
  } else {
    g.body.setFillStyle(ghostColor(g.kind));
  }
}

/**
 * Out through the gate.  The box is sealed, so this is a scripted path rather
 * than pathfinding: slide to the door's column, climb through it, and the tile
 * above the gate is where the ghost joins the maze and starts thinking again.
 */
function leaveHouse(g: Ghost, dt: number): void {
  const doorX = tileX(HOUSE.doorCol);
  const outY = tileY(HOUSE.top - 1);
  const step = HOUSE_SPEED * dt;
  if (Math.abs(g.px - doorX) > 0.6) {
    g.px += Math.sign(doorX - g.px) * Math.min(step, Math.abs(doorX - g.px));
  } else {
    g.px = doorX;
    g.py = Math.max(outY, g.py - step);
    if (g.py <= outY + 0.6) {
      g.py = outY;
      g.state = 'out';
      g.dir = { x: 0, y: -1 };
      g.lastTile = -1;
    }
  }
  g.col = Math.round((g.px - OX - TILE / 2) / TILE);
  g.row = Math.round((g.py - OY - TILE / 2) / TILE);
  g.sprite.setPosition(g.px, g.py);
}

/** Back in the box for ten seconds, and no use to anybody until they are up. */
function sendHome(g: Ghost, ms: number): void {
  g.state = 'eaten';
  g.wait = ms;
  g.col = g.seat.col;
  g.row = g.seat.row;
  g.px = tileX(g.col);
  g.py = tileY(g.row);
  g.dir = { x: 0, y: -1 };
  g.lastTile = -1;
  g.sprite.setAlpha(0.4).setPosition(g.px, g.py);
  g.body.setFillStyle(PALETTE.nightLight);
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

/**
 * Shortest-path distance from one tile to every other, walls excluded.  -1
 * where there is no route at all.
 *
 * A greedy step — "of the ways out of this tile, take the one that ends up
 * nearest in a straight line" — is the classic rule, and on a maze of long
 * corridors it works.  On THIS maze it does not: a lattice is full of ways
 * round, and a hunter that only compares straight-line distance circles the
 * same block forever while the player stands still in the next one.  So the
 * hunters path properly.  The board is 315 tiles and a ghost only decides when
 * it enters a new one, so a flood per decision costs nothing.
 */
function distanceField(tc: number, tr: number): Int16Array {
  const dist = new Int16Array(COLS * ROWS).fill(-1);
  if (isWall(tc, tr)) return dist;
  const queue = [tr * COLS + tc];
  dist[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const idx = queue[head];
    const c = idx % COLS;
    const r = (idx - c) / COLS;
    for (const d of DIRS) {
      const nc = c + d.x;
      const nr = r + d.y;
      if (isWall(nc, nr)) continue;
      const n = nr * COLS + nc;
      if (dist[n] >= 0) continue;
      dist[n] = dist[idx] + 1;
      queue.push(n);
    }
  }
  return dist;
}

/**
 * The open tile closest to a target that may be inside a wall — the ambusher
 * aims four tiles in front of the player, which is regularly a wall.
 */
function snapToOpen(tc: number, tr: number): { col: number; row: number } {
  if (!isWall(tc, tr)) return { col: tc, row: tr };
  let best = { col: player.col, row: player.row };
  let bestD = Infinity;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (isWall(c, r)) continue;
      const d = Math.hypot(c - tc, r - tr);
      if (d < bestD) {
        bestD = d;
        best = { col: c, row: r };
      }
    }
  }
  return best;
}

/** The way out of this tile that actually gets there soonest. */
function pathTo(opts: Dir[], g: Ghost, tc: number, tr: number): Dir {
  const goal = snapToOpen(tc, tr);
  const field = distanceField(goal.col, goal.row);
  let best = opts[0];
  let bestD = Infinity;
  for (const d of opts) {
    const c = g.col + d.x;
    const r = g.row + d.y;
    const v = field[r * COLS + c];
    // Unreachable steps sort last, by straight line, so there is always an
    // answer even if the flood somehow found nothing.
    const dist = v < 0 ? 10_000 + Math.hypot(c - goal.col, r - goal.row) : v;
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
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
    // Running away is deliberately DAFT — straight-line, one step at a time —
    // because a frightened ghost that pathed its way out of trouble would make
    // the power pellets worthless.
    return furthestFrom(legal, g, player.col, player.row);
  }
  if (scatterMs > 0) {
    return pathTo(legal, g, g.corner.col, g.corner.row);
  }

  switch (g.kind) {
    case 'direct':
      // The hunter.  It knows the way, and standing still is not a plan.
      return pathTo(legal, g, player.col, player.row);
    case 'ambush':
      // Cuts you off: it paths to where you are GOING, four tiles ahead.
      return pathTo(legal, g, player.col + player.dir.x * 4, player.row + player.dir.y * 4);
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
    // Only the ones actually on the board can touch you, or be touched.
    if (g.state !== 'out') continue;
    if (Math.hypot(g.px - player.px, g.py - player.py) > 6) continue;

    if (frightMs > 0) {
      audio.sfx('coin_spin');
      sendHome(g, GHOST_RESPAWN_MS);
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
    player.col = START.col;
    player.row = START.row;
    player.px = tileX(player.col);
    player.py = tileY(player.row);
    player.dir = { x: 0, y: 0 };
    player.want = { x: 0, y: 0 };
    player.lastTile = -1;
    playerSprite?.setPosition(player.px, player.py);
    // Everyone back in the box, and let out one at a time again — losing a
    // life should hand back the opening breath, not four ghosts on the door.
    ghosts.forEach((g, i) => {
      g.state = 'house';
      g.wait = RELEASE_MS[i] ?? 0;
      g.col = g.seat.col;
      g.row = g.seat.row;
      g.px = tileX(g.col);
      g.py = tileY(g.row);
      g.dir = { x: 0, y: -1 };
      g.lastTile = -1;
      g.sprite.setAlpha(1).setPosition(g.px, g.py);
    });
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
