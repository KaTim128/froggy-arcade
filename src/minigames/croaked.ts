/**
 * CROAKED.  A maze, a big frog, and something small it wants to eat (log #70).
 *
 * Two ways round, chosen after PLAY:
 *
 *   BIG FROG   you are the frog.  Catch the tadpole before the clock runs out.
 *              It is QUICKER than you, and it runs: every turn it takes keeps
 *              it farthest from you with the most room behind it.  What the
 *              frog has is TRAPS -- drop one where you stand (SPACE), and a
 *              tadpole that swims into it is stuck fast for a moment.
 *   SURVIVOR   you are the tadpole, and the quicker of the two.  Eat every fly
 *              in the maze; the frog hunts you down the shortest way, cuts you
 *              off now and then, and lays traps at the junctions as it goes --
 *              a faint ring on the water.  Caught is a loss.
 *
 * (Log, follow-up to #70: the hunter has traps; the survivor is the faster.
 * User, 30 Oct: the frog was too hard to play -- now it is the quicker of the
 * two when you are it, with more time, a wider reach, and more and longer
 * traps; the maze has more loops (so a tadpole still has somewhere to run),
 * and the two start nearer, not at the far ends.)
 *
 * A NEW MAZE EVERY ROUND, AND EVERY CORNER OF IT REACHABLE.  It is carved as a
 * perfect maze (one path between any two cells), then most of its dead ends
 * are knocked through and a few more walls opened, so there are loops to
 * escape round.  Carving never closes anything off, so every open cell -- and
 * every fly -- can be reached; the two start at the two ends of the maze's
 * longest path.
 *
 * 5 tokens a round (the cabinet's price, taken once by the shell), 10 for a
 * win, nothing for a loss: the shell pays, once.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

type Role = 'frog' | 'survivor';
type Phase = 'pick' | 'count' | 'play' | 'over';
type Dir = 0 | 1 | 2 | 3; // up, right, down, left
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/** The maze: odd sizes, so the carving grid (every other cell) fits it exactly. */
const COLS = 27;
const ROWS = 13;
const CELL = 11;
/** How long the frog has to catch the tadpole. */
const HUNT_S = 60;
/** Cells a second, whoever is playing which: the tadpole is always the quicker. */
const SURVIVOR_SPEED = 6.2;
const HUNTER_SPEED = 5.1;
/** When YOU are the frog: the frog is the quicker, and the tadpole slows to a chase it can lose. */
const PLAYER_FROG_SPEED = 6.5;
const PLAYER_TADPOLE_SPEED = 5.2;
/** Traps: how many may lie at once, the wait between two, and how long one holds. */
const MAX_TRAPS = 3;
const TRAP_COOLDOWN = 4;
const TRAP_HOLD = 2.2;
/** The player-frog's own: more of them, sooner, holding longer. */
const PLAYER_MAX_TRAPS = 5;
const PLAYER_TRAP_COOLDOWN = 1.6;
const PLAYER_TRAP_HOLD = 3.4;
const maxTraps = (): number => (role === 'frog' ? PLAYER_MAX_TRAPS : MAX_TRAPS);
/** The odds the computer's tadpole spots a trap it is about to swim into. */
const SPOT_TRAP = 0.4;
/** ...and the player-frog's tadpole is less watchful. */
const PLAYER_SPOT_TRAP = 0.15;
/** How close counts as caught, in cells. */
const CATCH = 0.95;

interface Mover {
  /** The cell it is leaving and the one it is going to, and how far between (0..1). */
  cx: number;
  cy: number;
  tx: number;
  ty: number;
  k: number;
  dir: Dir;
  /** The way the player last asked for (buffered until it is possible). */
  want: Dir | null;
  speed: number;
  /** Seconds left stuck in a trap (0: free). */
  held: number;
}

let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;
let grid: boolean[][] = []; // true = open
let flies = new Set<string>();
let fliesAtStart = 0;
let role: Role = 'frog';
let phase: Phase = 'pick';
let you: Mover | null = null;
let them: Mover | null = null;
let clock = 0;
let countMs = 0;
let ox = 0;
let oy = 0;
let wallsG: Phaser.GameObjects.Graphics | null = null;
let liveG: Phaser.GameObjects.Graphics | null = null;
let hud: Phaser.GameObjects.BitmapText | null = null;
let banner: Phaser.GameObjects.BitmapText | null = null;
let picker: Phaser.GameObjects.GameObject[] = [];
let keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
let settled = false;
/** Traps on the water, by cell; the frog's wait for the next; the ones the computer's tadpole has looked at. */
let traps = new Set<string>();
let trapCd = 0;
let spotted = new Map<string, boolean>();

const open = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < COLS && y < ROWS && grid[y][x];
const keyOf = (x: number, y: number): string => `${x},${y}`;

// ------------------------------------------------------------------ the maze

/** Carve a maze, braid most of its dead ends, and return it (true = open). */
export function makeMaze(rng: () => number = Math.random): boolean[][] {
  const g: boolean[][] = Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(false));
  const stack: Array<[number, number]> = [[1, 1]];
  g[1][1] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const ways = ([0, 1, 2, 3] as Dir[]).filter((d) => {
      const nx = x + DX[d] * 2;
      const ny = y + DY[d] * 2;
      return nx > 0 && ny > 0 && nx < COLS - 1 && ny < ROWS - 1 && !g[ny][nx];
    });
    if (!ways.length) {
      stack.pop();
      continue;
    }
    const d = ways[Math.floor(rng() * ways.length)];
    g[y + DY[d]][x + DX[d]] = true;
    g[y + DY[d] * 2][x + DX[d] * 2] = true;
    stack.push([x + DX[d] * 2, y + DY[d] * 2]);
  }
  // ESCAPE ROUTES: a dead end is a death sentence for whoever is running, so
  // most are knocked through to the next corridor -- and a few walls besides
  const openNeighbours = (x: number, y: number): number => [0, 1, 2, 3].filter((d) => g[y + DY[d]]?.[x + DX[d]]).length;
  for (let y = 1; y < ROWS - 1; y += 2) {
    for (let x = 1; x < COLS - 1; x += 2) {
      if (openNeighbours(x, y) !== 1 || rng() > 0.95) continue;
      const walls = ([0, 1, 2, 3] as Dir[]).filter((d) => {
        const wx = x + DX[d];
        const wy = y + DY[d];
        const bx = x + DX[d] * 2;
        const by = y + DY[d] * 2;
        return !g[wy][wx] && bx > 0 && by > 0 && bx < COLS - 1 && by < ROWS - 1 && g[by][bx];
      });
      if (walls.length) {
        const d = walls[Math.floor(rng() * walls.length)];
        g[y + DY[d]][x + DX[d]] = true;
      }
    }
  }
  for (let i = 0; i < 16; i++) {
    const x = 1 + Math.floor(rng() * ((COLS - 2) / 2)) * 2 + (rng() < 0.5 ? 1 : 0);
    const y = 1 + Math.floor(rng() * ((ROWS - 2) / 2)) * 2 + (x % 2 ? 1 : 0);
    if (x > 0 && y > 0 && x < COLS - 1 && y < ROWS - 1) g[y][x] = true;
  }
  return g;
}

/** Steps from (sx, sy) to every open cell (-1: unreachable), through `g`. */
export function distances(g: boolean[][], sx: number, sy: number, block?: string): number[][] {
  const d = Array.from({ length: ROWS }, () => Array<number>(COLS).fill(-1));
  const q: Array<[number, number]> = [[sx, sy]];
  d[sy][sx] = 0;
  while (q.length) {
    const [x, y] = q.shift()!;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k];
      const ny = y + DY[k];
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || !g[ny][nx] || d[ny][nx] >= 0 || keyOf(nx, ny) === block) continue;
      d[ny][nx] = d[y][x] + 1;
      q.push([nx, ny]);
    }
  }
  return d;
}

/** The open cell about two thirds as far as the farthest from (x, y). */
function nearTwoThirds(g: boolean[][], x: number, y: number): [number, number] {
  const d = distances(g, x, y);
  let far = 0;
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) far = Math.max(far, d[j][i]);
  const want = Math.round(far * 0.62);
  let best: [number, number] = [x, y];
  let gap = Infinity;
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    if (d[j][i] < 0) continue;
    const e = Math.abs(d[j][i] - want);
    if (e < gap) {
      gap = e;
      best = [i, j];
    }
  }
  return best;
}

/** The farthest open cell from (x, y). */
function farthest(g: boolean[][], x: number, y: number): [number, number] {
  const d = distances(g, x, y);
  let best: [number, number] = [x, y];
  let far = -1;
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if (d[j][i] > far) {
    far = d[j][i];
    best = [i, j];
  }
  return best;
}

// ------------------------------------------------------------------ movement

const mover = (x: number, y: number, speed: number): Mover => ({ cx: x, cy: y, tx: x, ty: y, k: 1, dir: 1, want: null, speed, held: 0 });
const posOf = (m: Mover): { x: number; y: number } => ({ x: m.cx + (m.tx - m.cx) * m.k, y: m.cy + (m.ty - m.cy) * m.k });

/** On a cell now: which way next.  `choose` is the brain (the keys, or the computer). */
function step(m: Mover, dt: number, choose: (m: Mover) => Dir | null): void {
  if (m.held > 0) {
    m.held = Math.max(0, m.held - dt);
    return;
  }
  m.k += m.speed * dt;
  while (m.k >= 1) {
    const over = m.k - 1;
    m.cx = m.tx;
    m.cy = m.ty;
    if (landed(m)) {
      m.k = 1;
      return;
    }
    const d = choose(m);
    if (d === null || !open(m.cx + DX[d], m.cy + DY[d])) {
      m.k = 1;
      return;
    }
    m.dir = d;
    m.tx = m.cx + DX[d];
    m.ty = m.cy + DY[d];
    m.k = over;
    arrived(m);
  }
}

/** The player's turn at a junction: what was asked for if it is open, else straight on. */
function playerChoice(m: Mover): Dir | null {
  if (m.want !== null && open(m.cx + DX[m.want], m.cy + DY[m.want])) return m.want;
  if (open(m.cx + DX[m.dir], m.cy + DY[m.dir])) return m.dir;
  return null;
}

/**
 * THE TADPOLE RUNS.  Of the ways out of this cell it takes the one that ends
 * up farthest from where the frog is heading, weighted by how much maze lies
 * behind it (cells it could still reach before the frog could) -- so it runs
 * round the loops rather than into a corner.  It turns back only when every
 * other way is worse.
 */
function runnerChoice(m: Mover): Dir | null {
  if (!you) return null;
  const hunter = distances(grid, you.tx, you.ty);
  let best: Dir | null = null;
  let score = -Infinity;
  for (const d of [0, 1, 2, 3] as Dir[]) {
    const nx = m.cx + DX[d];
    const ny = m.cy + DY[d];
    if (!open(nx, ny)) continue;
    // a trap ahead: seen (once, by the odds) it is a wall; unseen it is swum into
    const tk = keyOf(nx, ny);
    if (traps.has(tk)) {
      if (!spotted.has(tk)) spotted.set(tk, Math.random() < (role === 'frog' ? PLAYER_SPOT_TRAP : SPOT_TRAP));
      if (spotted.get(tk)) continue;
    }
    // room to run: the cells it reaches first, from there, not passing back through here
    const mine = distances(grid, nx, ny, keyOf(m.cx, m.cy));
    let room = 0;
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if (mine[j][i] >= 0 && mine[j][i] < 14 && (hunter[j][i] < 0 || mine[j][i] + 1 < hunter[j][i])) room++;
    const back = d === ((m.dir + 2) % 4) ? -3 : 0;
    const s = hunter[ny][nx] * 2 + room * 0.6 + back + Math.random() * (role === 'frog' ? 3.2 : 0.8);
    if (s > score) {
      score = s;
      best = d;
    }
  }
  return best;
}

/**
 * THE FROG HUNTS.  The shortest way to you -- or, one time in four, to where
 * you are heading two cells on, to cut you off at the junction.
 */
function hunterChoice(m: Mover): Dir | null {
  if (!you) return null;
  aiTraps();
  let gx = you.tx;
  let gy = you.ty;
  if (Math.random() < 0.25) {
    for (let i = 0; i < 2 && open(gx + DX[you.dir], gy + DY[you.dir]); i++) {
      gx += DX[you.dir];
      gy += DY[you.dir];
    }
  }
  const toYou = distances(grid, gx, gy);
  let best: Dir | null = null;
  let near = Infinity;
  for (const d of [0, 1, 2, 3] as Dir[]) {
    const nx = m.cx + DX[d];
    const ny = m.cy + DY[d];
    if (!open(nx, ny) || toYou[ny][nx] < 0) continue;
    const s = toYou[ny][nx] + Math.random() * 0.4;
    if (s < near) {
      near = s;
      best = d;
    }
  }
  return best;
}

/** Arriving somewhere: the survivor eats what is there. */
/** The tadpole on a cell: a trap there springs.  True if it is caught in one. */
function landed(m: Mover): boolean {
  const tad = role === 'frog' ? them : you;
  if (m !== tad) return false;
  const k = keyOf(m.cx, m.cy);
  if (!traps.delete(k)) return false;
  spotted.delete(k);
  m.held = role === 'frog' ? PLAYER_TRAP_HOLD : TRAP_HOLD;
  audio.sfx('ui_blip', 0.6);
  return true;
}

/** Drop a trap where the frog is (the cell it is nearer).  False if it cannot. */
function dropTrap(): boolean {
  const frog = role === 'frog' ? you : them;
  if (phase !== 'play' || !frog || trapCd > 0 || traps.size >= maxTraps()) return false;
  const x = frog.k < 0.5 ? frog.cx : frog.tx;
  const y = frog.k < 0.5 ? frog.cy : frog.ty;
  const k = keyOf(x, y);
  if (traps.has(k)) return false;
  traps.add(k);
  trapCd = role === 'frog' ? PLAYER_TRAP_COOLDOWN : TRAP_COOLDOWN;
  audio.sfx('water_plip', 0.5);
  return true;
}

/**
 * THE COMPUTER'S FROG LAYS TRAPS where the ways meet -- the junctions a
 * fleeing tadpole comes back round through -- once it is clear of you.
 */
function aiTraps(): void {
  if (role !== 'survivor' || !them || !you || trapCd > 0) return;
  const exits = [0, 1, 2, 3].filter((d) => open(them!.cx + DX[d], them!.cy + DY[d])).length;
  const far = Math.abs(them.cx - you.tx) + Math.abs(them.cy - you.ty);
  if (exits >= 3 && far >= 3 && Math.random() < 0.5) dropTrap();
}

function arrived(m: Mover): void {
  if (role !== 'survivor' || m !== you) return;
  const k = keyOf(m.tx, m.ty);
  if (flies.delete(k)) {
    audio.sfx('water_plip', 0.25);
    // the hunt quickens as the flies run out
    if (them) them.speed = HUNTER_SPEED * (1 + 0.12 * (1 - flies.size / Math.max(1, fliesAtStart)));
    if (!flies.size) end(true, 'EVERY FLY EATEN!');
  }
}

// ------------------------------------------------------------------ the round

function newRound(): void {
  grid = makeMaze();
  // the two start at the two ends of the longest way through it
  // (not the far ends any more: about two thirds of the way, so a chase starts
  // near enough to be a chase)
  const a = farthest(grid, 1, 1);
  const b = nearTwoThirds(grid, a[0], a[1]);
  const mine = role === 'frog' ? a : b;
  const theirs = role === 'frog' ? b : a;
  you = mover(mine[0], mine[1], role === 'frog' ? PLAYER_FROG_SPEED : SURVIVOR_SPEED);
  them = mover(theirs[0], theirs[1], role === 'frog' ? PLAYER_TADPOLE_SPEED : HUNTER_SPEED);
  traps = new Set();
  spotted = new Map();
  trapCd = 1.5;
  flies = new Set();
  if (role === 'survivor') for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y][x] && keyOf(x, y) !== keyOf(...mine) && keyOf(x, y) !== keyOf(...theirs)) flies.add(keyOf(x, y));
  fliesAtStart = flies.size;
  clock = 0;
  drawWalls();
}

/** A steady 0..1 noise for a pixel, so the textures never shimmer between redraws. */
const hash = (x: number, y: number): number => {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
};

/**
 * THE POND MAZE.  Deep water speckled with silt, a lily pad here and there,
 * and banks of mossy stone drawn as one continuous mass (no tile seams): a
 * lit moss rim along every edge that faces open water, shaded stone below it,
 * brickwork and cracks in the face, and the shadow each bank throws on the
 * water beneath it.
 */
function drawWalls(): void {
  const g = wallsG;
  if (!g) return;
  g.clear();
  const W = COLS * CELL;
  const H = ROWS * CELL;
  g.fillStyle(0x08141a, 1).fillRect(ox - 2, oy - 2, W + 4, H + 4);
  const wall = (x: number, y: number): boolean => x < 0 || y < 0 || x >= COLS || y >= ROWS || !grid[y][x];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const px = ox + x * CELL;
    const py = oy + y * CELL;
    if (grid[y][x]) {
      // the water: two depths, silt flecks, and now and then a lily pad
      g.fillStyle(0x0f2630, 1).fillRect(px, py, CELL, CELL);
      for (let i = 0; i < 5; i++) {
        const h = hash(x * 5 + i, y * 3 - i);
        g.fillStyle(h > 0.5 ? 0x14303b : 0x0b1f27, 1).fillRect(px + Math.floor(h * CELL), py + Math.floor(hash(y + i, x - i) * CELL), 1, 1);
      }
      // ripples: a pale arc and its fainter twin, here and there, and a shaft of
      // light across the water where the cell is clear of banks to the north
      const rp = hash(x * 3 + 1, y * 5 + 2);
      if (rp > 0.82) {
        const rx = px + 2 + Math.floor(hash(y, x + 9) * 6);
        const ry = py + 3 + Math.floor(hash(x, y + 4) * 5);
        g.lineStyle(1, 0x3a7a8a, 0.55).beginPath().arc(rx, ry, 2.6, Math.PI * 1.1, Math.PI * 1.9, false).strokePath();
        g.lineStyle(1, 0x2a5a6a, 0.35).beginPath().arc(rx, ry, 4.2, Math.PI * 1.15, Math.PI * 1.85, false).strokePath();
      }
      if (!wall(x, y - 1) && (x + y) % 3 === 0) g.fillStyle(0x2a6a7a, 0.1).fillRect(px, py, CELL, CELL);
      if (hash(x, y) > 0.93) {
        const lx = px + 2 + Math.floor(hash(y, x) * 4);
        const ly = py + 6;
        g.fillStyle(0x2a5a2a, 0.8).fillEllipse(lx + 2, ly + 1, 5, 3);
        g.fillStyle(0x0f2630, 1).fillRect(lx + 2, ly, 1, 1);
      }
      // the shadow of a bank to the north and the west
      if (wall(x, y - 1)) g.fillStyle(0x061016, 0.7).fillRect(px, py, CELL, 2);
      if (wall(x - 1, y)) g.fillStyle(0x061016, 0.45).fillRect(px, py, 1, CELL);
      continue;
    }
    // stone: the face, with brick courses offset every row
    g.fillStyle(0x2a4a32, 1).fillRect(px, py, CELL, CELL);
    for (let r = 0; r < CELL; r += 4) {
      g.fillStyle(0x1e3826, 1).fillRect(px, py + r + 3, CELL, 1);
      const off = ((y * CELL + r) / 4) % 2 ? 2 : 6;
      g.fillRect(px + ((off + x * CELL) % 8), py + r, 1, 3);
    }
    for (let i = 0; i < 4; i++) {
      const h = hash(x * 7 + i, y * 11 + i);
      g.fillStyle(h > 0.5 ? 0x36603e : 0x223e2a, 1).fillRect(px + Math.floor(h * (CELL - 1)), py + Math.floor(hash(x + i, y * 2) * (CELL - 1)), 1, 1);
    }
    // the edges that face the water: moss on top, shade below, a dark line at the sides
    if (!wall(x, y - 1)) {
      g.fillStyle(0x5a9a48, 1).fillRect(px, py, CELL, 2);
      g.fillStyle(0x8ac860, 1).fillRect(px, py, CELL, 1);
      for (let i = 0; i < CELL; i += 3) if (hash(x * 3 + i, y) > 0.45) g.fillStyle(0x5a9a48, 1).fillRect(px + i, py + 2, 1, 1 + Math.floor(hash(i, x + y) * 2));
    }
    if (!wall(x, y + 1)) g.fillStyle(0x16281c, 1).fillRect(px, py + CELL - 2, CELL, 2);
    if (!wall(x - 1, y)) g.fillStyle(0x3e6e44, 1).fillRect(px, py, 1, CELL);
    if (!wall(x + 1, y)) g.fillStyle(0x16281c, 1).fillRect(px + CELL - 1, py, 1, CELL);
  }
  // the pond's rim
  g.lineStyle(1, 0x3e6e44, 1).strokeRect(ox - 1.5, oy - 1.5, W + 3, H + 3);
}

function pickRole(r: Role): void {
  if (phase !== 'pick') return;
  role = r;
  for (const o of picker) o.destroy();
  picker = [];
  newRound();
  phase = 'count';
  countMs = 2400;
  audio.sfx('ui_blip', 0.5);
}

function showPicker(scene: Phaser.Scene): void {
  const cx = GAME_W / 2;
  // everything laid out from the panel's own top edge, inside its outline
  const H = 98;
  const top = Math.round(oy + (ROWS * CELL - H) / 2);
  picker.push(scene.add.rectangle(cx, top, 236, H, PALETTE.ink, 0.96).setOrigin(0.5, 0).setStrokeStyle(1, PALETTE.gold).setDepth(40));
  picker.push(centerText(scene, cx, top + 10, 'PICK YOUR SIDE', PALETTE.gold).setDepth(41));
  const side = (x: number, label: string, line1: string, line2: string, r: Role, key: string): void => {
    picker.push(button(scene, x, top + 32, label, () => pickRole(r), { width: 104, height: 22, fill: r === 'frog' ? 0x2e6a3a : 0x2a4a7a }).setDepth(42));
    picker.push(centerText(scene, x, top + 54, line1, PALETTE.cream).setDepth(41));
    picker.push(centerText(scene, x, top + 64, line2, PALETTE.ash).setDepth(41));
    picker.push(centerText(scene, x, top + 82, key, PALETTE.tealLight).setDepth(41));
  };
  side(cx - 58, 'BIG FROG', 'RUN IT DOWN, OR', 'TRAP IT IN TIME', 'frog', '[1]');
  side(cx + 58, 'SURVIVOR', 'EAT EVERY FLY,', 'MIND THE TRAPS', 'survivor', '[2]');
}

function end(won: boolean, why: string): void {
  if (phase === 'over' || settled) return;
  phase = 'over';
  settled = true;
  audio.sfx(won ? 'chime' : 'buzzer', 0.6);
  banner?.setText(why).setTint(won ? PALETTE.gold : PALETTE.blood).setVisible(true);
  if (won) apiRef?.record(Math.round(clock * 10) / 10);
  sceneRef?.time.delayedCall(1700, () => (won ? apiRef?.win() : apiRef?.lose()));
}

// ------------------------------------------------------------------ drawing

function drawLive(t: number): void {
  const g = liveG;
  if (!g) return;
  g.clear();
  // the traps: a snare of reeds.  Your own are plain; the frog's, when you are
  // the tadpole, only a faint ring that breathes
  for (const k of traps) {
    const [x, y] = k.split(',').map(Number);
    const px = ox + x * CELL + CELL / 2;
    const py = oy + y * CELL + CELL / 2;
    const a = role === 'frog' ? 1 : 0.3 + 0.2 * Math.sin(t * 4 + x);
    g.lineStyle(1, 0xc8a050, a).strokeCircle(px, py, 4);
    g.lineStyle(1, 0x8a6a30, a).lineBetween(px - 3, py - 3, px + 3, py + 3).lineBetween(px + 3, py - 3, px - 3, py + 3);
  }
  for (const k of flies) {
    const [x, y] = k.split(',').map(Number);
    const px = ox + x * CELL + CELL / 2;
    const py = oy + y * CELL + CELL / 2;
    const flap = Math.sin(t * 18 + x * 3 + y) > 0;
    // a fly: a glinting body and two wings that buzz
    g.fillStyle(0xe8f4ff, 0.9).fillRect(px - 2, py - (flap ? 2 : 1), 1, 1).fillRect(px + 1, py - (flap ? 2 : 1), 1, 1);
    g.fillStyle(0xf0d060, 1).fillRect(px - 0.5, py - 0.5, 2, 2);
  }
  const frogM = role === 'frog' ? you : them;
  const tadM = role === 'frog' ? them : you;
  if (tadM) drawTadpole(g, tadM, t);
  if (frogM) drawFrog(g, frogM, t);
}

/**
 * THE TADPOLE: a plump glossy body with a belly, a long tail that sweeps
 * behind it in a wave, two eyes on top and a sheen -- and in a trap, a net.
 */
function drawTadpole(g: Phaser.GameObjects.Graphics, m: Mover, t: number): void {
  const p = posOf(m);
  const px = ox + p.x * CELL + CELL / 2;
  const py = oy + p.y * CELL + CELL / 2;
  const fx = DX[m.dir];
  const fy = DY[m.dir];
  const sx = -fy;
  const sy = fx;
  const at = (a: number, b: number): [number, number] => [px + fx * a + sx * b, py + fy * a + sy * b];
  g.fillStyle(0x000000, 0.3).fillEllipse(px + 0.5, py + 3.6, 8, 2.4);
  // the tail: a ribbon of shrinking beads, swinging as it swims
  for (let i = 1; i <= 6; i++) {
    const w = Math.sin(t * 15 - i * 0.9) * (0.4 + i * 0.28);
    const [x, y] = at(-i * 1.35, w);
    g.fillStyle(0x1a2f6a, 1).fillCircle(x, y, 1.9 - i * 0.22);
    g.fillStyle(0x3f6ed4, 1).fillCircle(x - 0.2, y - 0.3, Math.max(0.3, 1.5 - i * 0.2));
  }
  // the body: dark rim, blue mass, pale belly, a bright sheen top-left
  g.fillStyle(0x14224a, 1).fillCircle(px, py, 4.1);
  g.fillStyle(0x3a66d0, 1).fillCircle(px, py, 3.5);
  const [bx, by] = at(-0.3, 0);
  g.fillStyle(0x6a9aee, 1).fillEllipse(bx + 0.2, by + 0.9, 4.4, 2.6);
  g.fillStyle(0x2a4a9a, 1).fillCircle(px - sx * 1.6 - fx * 1.3, py - sy * 1.6 - fy * 1.3, 0.9).fillCircle(px + sx * 1.4 - fx * 1.7, py + sy * 1.4 - fy * 1.7, 0.7);
  g.fillStyle(0xd8ecff, 0.95).fillCircle(px - 1.1, py - 1.4, 1.1);
  // eyes, on the front of the head
  for (const side of [-1, 1]) {
    const [ex, ey] = at(1.6, side * 1.7);
    g.fillStyle(0xffffff, 1).fillCircle(ex, ey, 1);
    g.fillStyle(0x0a0812, 1).fillCircle(ex + fx * 0.3, ey + fy * 0.3, 0.55);
  }
  if (m.held > 0) {
    // caught in the reeds: a net that shrinks as it lets go
    g.lineStyle(1, 0xf0d060, 1).strokeCircle(px, py, 3 + m.held * 1.4);
    g.lineStyle(1, 0xc8a050, 0.8).lineBetween(px - 5, py, px + 5, py).lineBetween(px, py - 5, px, py + 5);
  }
}

/**
 * THE BIG FROG, from above: a green body with a pale belly, back legs folded
 * out behind, front legs forward, a head with two raised eyes and a wide
 * mouth, spots down its back -- and it hops: the body stretches and squashes
 * with its stride.  Facing whichever way it is going.
 */
function drawFrog(g: Phaser.GameObjects.Graphics, m: Mover, t: number): void {
  const p = posOf(m);
  const px = ox + p.x * CELL + CELL / 2;
  const py = oy + p.y * CELL + CELL / 2;
  const fx = DX[m.dir];
  const fy = DY[m.dir];
  const sx = -fy;
  const sy = fx;
  const at = (a: number, b: number): [number, number] => [px + fx * a + sx * b, py + fy * a + sy * b];
  const moving = m.held <= 0 && m.k < 1;
  const hop = moving ? Math.abs(Math.sin(t * 14)) : 0;
  const L = 1 + hop * 0.18;
  g.fillStyle(0x000000, 0.34).fillEllipse(px + 0.5, py + 5, 11 - hop * 2, 3);
  // back legs: thigh out to the side, shin and webbed foot back
  for (const side of [-1, 1]) {
    const [kx, ky] = at(-2.2, side * 4.2);
    const [fxp, fyp] = at(-5.2 - hop * 1.2, side * 3.4);
    g.fillStyle(0x1e5a2a, 1).fillCircle(kx, ky, 2.2).fillCircle(fxp, fyp, 1.6);
    g.fillStyle(0x3aa048, 1).fillCircle(kx - 0.2, ky - 0.2, 1.7);
    g.fillStyle(0x2a7a34, 1).fillCircle(fxp, fyp, 1.1);
    const [t1x, t1y] = at(-6.4 - hop * 1.2, side * 3.9);
    const [t2x, t2y] = at(-6.2 - hop * 1.2, side * 2.6);
    g.fillStyle(0x6ad86a, 1).fillCircle(t1x, t1y, 0.7).fillCircle(t2x, t2y, 0.7);
  }
  // front legs
  for (const side of [-1, 1]) {
    const [hx, hy] = at(2.4 * L, side * 3.4);
    g.fillStyle(0x1e5a2a, 1).fillCircle(hx, hy, 1.7);
    g.fillStyle(0x4ab858, 1).fillCircle(hx, hy, 1.2);
  }
  // the body: a rim, the green back, a pale belly edge, a lit shoulder, spots
  const [cx, cy] = at(-0.6, 0);
  g.fillStyle(0x0e3a1e, 1).fillEllipse(cx, cy, 11 * L, 8.4);
  g.fillStyle(0x3aa048, 1).fillEllipse(cx, cy, 9.8 * L, 7.2);
  g.fillStyle(0x8ad878, 1).fillEllipse(cx + sx * 0.2 - fx * 0.2, cy + sy * 0.2 - fy * 0.2, 5.4, 3.4);
  g.fillStyle(0x6ad86a, 1).fillCircle(px - 1.3, py - 1.5, 2.1);
  for (const [a, b, r] of [[-2.4, -1.8, 0.9], [-3.4, 1.6, 0.8], [-0.8, 2.4, 0.7], [-1.6, -0.2, 0.6]] as const) {
    const [spx, spy] = at(a, b);
    g.fillStyle(0x1e6a2c, 1).fillCircle(spx, spy, r);
  }
  // the head and its wide mouth, working as it goes
  const gape = moving ? 0.5 + 0.5 * Math.abs(Math.sin(t * 9)) : 0.15;
  const [hx, hy] = at(3.4, 0);
  g.fillStyle(0x0e3a1e, 1).fillCircle(hx, hy, 3.5);
  g.fillStyle(0x3aa048, 1).fillCircle(hx, hy, 3);
  const [m1x, m1y] = at(4.9, -2.2);
  const [m2x, m2y] = at(4.9, 2.2);
  g.lineStyle(1, 0x3a0a14, 1).lineBetween(m1x, m1y, m2x, m2y);
  if (gape > 0.3) {
    const [m3x, m3y] = at(5.1 + gape * 0.8, 0);
    g.fillStyle(0x5a0a18, 1).fillTriangle(m1x, m1y, m2x, m2y, m3x, m3y);
    const [tx, ty] = at(5 + gape * 0.5, 0);
    g.fillStyle(0xe05a7a, 1).fillCircle(tx, ty, 0.7);
  }
  // two raised eyes, gold-ringed
  for (const side of [-1, 1]) {
    const [ex, ey] = at(2.7, side * 2.4);
    g.fillStyle(0x1e5a2a, 1).fillCircle(ex, ey, 1.9);
    g.fillStyle(0xe8c850, 1).fillCircle(ex, ey, 1.5);
    g.fillStyle(0x0a0812, 1).fillCircle(ex + fx * 0.35, ey + fy * 0.35, 0.8);
    g.fillStyle(0xffffff, 1).fillRect(ex - 0.9, ey - 1, 1, 1);
  }
}

function refreshHud(): void {
  if (!hud) return;
  if (phase === 'pick') hud.setText('');
  else if (role === 'frog') {
    const trap = traps.size >= maxTraps() ? 'ALL DOWN' : trapCd > 0 ? `${Math.ceil(trapCd)}S` : 'READY';
    hud.setText(`BIG FROG   CATCH IT: ${Math.max(0, Math.ceil(HUNT_S - clock))}S   TRAP ${trap}  ${traps.size}/${maxTraps()}`);
  }
  else hud.setText(`SURVIVOR    FLIES LEFT ${flies.size}    ${Math.floor(clock)}S`);
}

// ------------------------------------------------------------------ the module

export const croaked: MinigameModule = {
  id: 'croaked',
  title: 'CROAKED',
  rules: 'catch it, or eat everything and live',
  tutorial: {
    pitch: 'A MAZE, A BIG FROG, AND SOMETHING SMALL. PICK A SIDE.',
    steps: [
      { say: 'AFTER PLAY, PICK A SIDE: BIG FROG HUNTS, THE SURVIVOR RUNS.', demo: 'croak.pick' },
      { say: `BIG FROG: CATCH THE TADPOLE IN ${HUNT_S} SECONDS. YOU ARE THE QUICKER, SO RUN IT DOWN OR TRAP IT.`, demo: 'croak.hunt' },
      { say: `SPACE DROPS A TRAP WHERE YOU STAND (${PLAYER_MAX_TRAPS} AT ONCE). A TADPOLE THAT SWIMS IN IS STUCK - GRAB IT.`, phone: `TAP TRAP TO DROP ONE WHERE YOU STAND (${PLAYER_MAX_TRAPS} AT ONCE). A TADPOLE THAT SWIMS IN IS STUCK - GRAB IT.`, demo: 'croak.trap' },
      { say: 'SURVIVOR: YOU ARE THE SMALL ONE. EAT EVERY FLY, AND MIND THE FAINT RINGS - THE FROG\'S TRAPS.', demo: 'croak.survive' },
      { say: 'W A S D OR THE ARROWS STEER. PRESS A WAY EARLY AND YOU TURN AT THE NEXT GAP.', phone: 'THE STICK STEERS. PUSH A WAY EARLY AND YOU TURN AT THE NEXT GAP.', demo: 'croak.steer' },
    ],
    objective: ['PICK A SIDE. BIG FROG: RUN DOWN OR TRAP THE TADPOLE IN TIME.', 'SURVIVOR: EAT EVERY FLY, DODGE THE FROG AND ITS TRAPS.', 'A NEW MAZE EVERY ROUND.'],
    controls: [
      ['W A S D', 'STEER'],
      ['ARROWS', 'STEER'],
      ['SPACE', 'DROP A TRAP (BIG FROG)'],
      ['1 / 2', 'PICK A SIDE'],
    ],
  },
  touch: { stick: 'wasd', arrows: true, buttons: [{ label: 'TRAP', key: 'SPACE', primary: true }] },

  inPlay() {
    return phase === 'play' || phase === 'count';
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    sceneRef = scene;
    phase = 'pick';
    settled = false;
    picker = [];
    flies = new Set();
    you = null;
    them = null;
    traps = new Set();
    spotted = new Map();
    ox = Math.round((GAME_W - COLS * CELL) / 2);
    oy = api.area.y + 12;
    grid = makeMaze();
    scene.add.rectangle(0, api.area.y, GAME_W, 180 - api.area.y, 0x081016).setOrigin(0, 0);
    wallsG = scene.add.graphics().setDepth(1);
    liveG = scene.add.graphics().setDepth(2);
    hud = text(scene, ox, api.area.y + 2, '', PALETTE.cream).setDepth(5);
    banner = centerText(scene, GAME_W / 2, oy + (ROWS * CELL) / 2, '', PALETTE.gold, 16).setDepth(30).setVisible(false);
    drawWalls();
    showPicker(scene);
    const kb = scene.input.keyboard!;
    const k = (n: string) => kb.addKey(n);
    keys = { up: [k('W'), k('UP')], right: [k('D'), k('RIGHT')], down: [k('S'), k('DOWN')], left: [k('A'), k('LEFT')] };
    kb.on('keydown-ONE', () => pickRole('frog'));
    kb.on('keydown-TWO', () => pickRole('survivor'));
    kb.on('keydown-SPACE', () => {
      if (role === 'frog') dropTrap();
    });
    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__croak = {
        trap: () => dropTrap(),
        // a trap on the cell the tadpole is swimming to (to see one spring)
        trapAhead: () => {
          const tad = role === 'frog' ? them : you;
          if (tad) traps.add(keyOf(tad.tx, tad.ty));
        },
        traps: () => [...traps],
        state: () => ({ phase, role, clock, flies: flies.size, held: (role === 'frog' ? them : you)?.held ?? 0, trapCd, you: you && posOf(you), them: them && posOf(them) }),
        pick: (r: Role) => pickRole(r),
        // the maze, checked: every open cell reachable from the first one
        solvable: () => {
          let sx = -1;
          let sy = -1;
          for (let y = 0; y < ROWS && sx < 0; y++) for (let x = 0; x < COLS; x++) if (grid[y][x]) {
            sx = x;
            sy = y;
            break;
          }
          const d = distances(grid, sx, sy);
          for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y][x] && d[y][x] < 0) return false;
          return true;
        },
        eatAll: () => {
          flies = new Set([...flies].slice(0, 1));
        },
        catchNow: () => {
          if (you && them) Object.assign(them, { cx: you.tx, cy: you.ty, tx: you.tx, ty: you.ty, k: 1 });
        },
        timeOut: () => {
          clock = HUNT_S;
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => delete (window as unknown as Record<string, unknown>).__croak);
    }
  },

  update(time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    drawLive(time / 1000);
    refreshHud();
    if (phase === 'count') {
      countMs -= delta;
      banner?.setText(countMs > 1600 ? '3' : countMs > 800 ? '2' : countMs > 0 ? '1' : 'GO!').setTint(PALETTE.cream).setVisible(true);
      if (countMs <= -300) {
        banner?.setVisible(false);
        phase = 'play';
      }
      return;
    }
    if (phase !== 'play' || !you || !them) return;
    trapCd = Math.max(0, trapCd - dt);
    // the way asked for: held, or the last one pressed
    for (const [d, name] of [[0, 'up'], [1, 'right'], [2, 'down'], [3, 'left']] as Array<[Dir, string]>) if (keys[name]?.some((x) => x.isDown)) you.want = d;
    // (from a standstill, a press sets off at once)
    if (you.held <= 0 && you.k >= 1 && you.want !== null && open(you.cx + DX[you.want], you.cy + DY[you.want])) {
      you.dir = you.want;
      you.tx = you.cx + DX[you.want];
      you.ty = you.cy + DY[you.want];
      you.k = 0;
      arrived(you);
    }
    step(you, dt, playerChoice);
    if (phase !== 'play') return;
    step(them, dt, role === 'frog' ? runnerChoice : hunterChoice);
    clock += dt;
    const a = posOf(you);
    const b = posOf(them);
    if (Math.hypot(a.x - b.x, a.y - b.y) < CATCH) {
      audio.sfx('croak', 0.7);
      end(role === 'frog', role === 'frog' ? 'GULP! CAUGHT IT!' : 'CROAKED!');
      return;
    }
    if (role === 'frog' && clock >= HUNT_S) end(false, 'IT GOT AWAY');
  },

  snapshot() {
    return { role, phase, grid, flies: [...flies], fliesAtStart, you, them, clock, traps: [...traps], trapCd };
  },

  restore(snap: unknown) {
    const v = snap as { role: Role; phase: Phase; grid: boolean[][]; flies: string[]; fliesAtStart: number; you: Mover | null; them: Mover | null; clock: number; traps?: string[]; trapCd?: number };
    if (v.phase === 'pick' || !v.you || !v.them) return;
    for (const o of picker) o.destroy();
    picker = [];
    role = v.role;
    grid = v.grid;
    flies = new Set(v.flies);
    fliesAtStart = v.fliesAtStart;
    you = { ...v.you };
    them = { ...v.them };
    clock = v.clock;
    traps = new Set(v.traps ?? []);
    spotted = new Map();
    trapCd = v.trapCd ?? 0;
    you.held ??= 0;
    them.held ??= 0;
    drawWalls();
    // (back from a reload: the count again, then on)
    phase = v.phase === 'over' ? 'over' : 'count';
    countMs = 2400;
  },

  destroy() {
    wallsG = liveG = null;
    hud = banner = null;
    picker = [];
    you = them = null;
    apiRef = null;
    sceneRef = null;
  },
};
