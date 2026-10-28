/**
 * CROAKED.  A maze, a big frog, and something small it wants to eat (log #70).
 *
 * Two ways round, chosen after PLAY:
 *
 *   PAC FROG   you are the frog.  Catch the tadpole before the clock runs out.
 *              It is QUICKER than you, and it runs: every turn it takes keeps
 *              it farthest from you with the most room behind it.  What the
 *              frog has is TRAPS -- drop one where you stand (SPACE), and a
 *              tadpole that swims into it is stuck fast for a moment.
 *   SURVIVOR   you are the tadpole, and the quicker of the two.  Eat every fly
 *              in the maze; the frog hunts you down the shortest way, cuts you
 *              off now and then, and lays traps at the junctions as it goes --
 *              a faint ring on the water.  Caught is a loss.
 *
 * (Log, follow-up to #70: the hunter has traps; the survivor is the faster.)
 *
 * A NEW MAZE EVERY ROUND, AND EVERY CORNER OF IT REACHABLE.  It is carved as a
 * perfect maze (one path between any two cells), then most of its dead ends
 * are knocked through and a few more walls opened, so there are loops to
 * escape round.  Carving never closes anything off, so every open cell -- and
 * every fly -- can be reached; the two start at the two ends of the maze's
 * longest path.
 *
 * 10 tokens a round (the cabinet's price, taken once by the shell), 20 for a
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
const HUNT_S = 45;
/** Cells a second, whoever is playing which: the tadpole is always the quicker. */
const SURVIVOR_SPEED = 6.2;
const HUNTER_SPEED = 5.1;
/** Traps: how many may lie at once, the wait between two, and how long one holds. */
const MAX_TRAPS = 3;
const TRAP_COOLDOWN = 4;
const TRAP_HOLD = 2.2;
/** The odds the computer's tadpole spots a trap it is about to swim into. */
const SPOT_TRAP = 0.4;
/** How close counts as caught, in cells. */
const CATCH = 0.62;

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
      if (openNeighbours(x, y) !== 1 || rng() > 0.85) continue;
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
  for (let i = 0; i < 6; i++) {
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
      if (!spotted.has(tk)) spotted.set(tk, Math.random() < SPOT_TRAP);
      if (spotted.get(tk)) continue;
    }
    // room to run: the cells it reaches first, from there, not passing back through here
    const mine = distances(grid, nx, ny, keyOf(m.cx, m.cy));
    let room = 0;
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if (mine[j][i] >= 0 && mine[j][i] < 14 && (hunter[j][i] < 0 || mine[j][i] + 1 < hunter[j][i])) room++;
    const back = d === ((m.dir + 2) % 4) ? -3 : 0;
    const s = hunter[ny][nx] * 2 + room * 0.6 + back + Math.random() * 0.8;
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
  m.held = TRAP_HOLD;
  audio.sfx('ui_blip', 0.6);
  return true;
}

/** Drop a trap where the frog is (the cell it is nearer).  False if it cannot. */
function dropTrap(): boolean {
  const frog = role === 'frog' ? you : them;
  if (phase !== 'play' || !frog || trapCd > 0 || traps.size >= MAX_TRAPS) return false;
  const x = frog.k < 0.5 ? frog.cx : frog.tx;
  const y = frog.k < 0.5 ? frog.cy : frog.ty;
  const k = keyOf(x, y);
  if (traps.has(k)) return false;
  traps.add(k);
  trapCd = TRAP_COOLDOWN;
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
  const a = farthest(grid, 1, 1);
  const b = farthest(grid, a[0], a[1]);
  const mine = role === 'frog' ? a : b;
  const theirs = role === 'frog' ? b : a;
  you = mover(mine[0], mine[1], role === 'frog' ? HUNTER_SPEED : SURVIVOR_SPEED);
  them = mover(theirs[0], theirs[1], role === 'frog' ? SURVIVOR_SPEED : HUNTER_SPEED);
  traps = new Set();
  spotted = new Map();
  trapCd = 1.5;
  flies = new Set();
  if (role === 'survivor') for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y][x] && keyOf(x, y) !== keyOf(...mine) && keyOf(x, y) !== keyOf(...theirs)) flies.add(keyOf(x, y));
  fliesAtStart = flies.size;
  clock = 0;
  drawWalls();
}

function drawWalls(): void {
  const g = wallsG;
  if (!g) return;
  g.clear();
  g.fillStyle(0x0c1820, 1).fillRect(ox - 2, oy - 2, COLS * CELL + 4, ROWS * CELL + 4);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const px = ox + x * CELL;
    const py = oy + y * CELL;
    if (grid[y][x]) {
      // the water floor, a little lighter where it is lit
      g.fillStyle(((x + y) % 2) ? 0x10222c : 0x12262f, 1).fillRect(px, py, CELL, CELL);
      continue;
    }
    // mossy stone: a dark block, its face, a light top edge where the open water is above it
    g.fillStyle(0x1a3424, 1).fillRect(px, py, CELL, CELL);
    g.fillStyle(0x2e5a3a, 1).fillRect(px + 1, py + 1, CELL - 2, CELL - 3);
    if (open(x, y - 1)) g.fillStyle(0x6a9a5a, 1).fillRect(px, py, CELL, 1);
    if (!open(x, y + 1) && y < ROWS - 1) g.fillStyle(0x2e5a3a, 1).fillRect(px + 1, py + CELL - 2, CELL - 2, 2);
    if ((x * 7 + y * 3) % 5 === 0) g.fillStyle(0x4a7a3a, 1).fillRect(px + 3, py + 3, 2, 2);
  }
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
  side(cx - 58, 'PAC FROG', 'CATCH IT: IT IS', 'QUICKER - TRAP IT', 'frog', '[1]');
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
  if (tadM) {
    const p = posOf(tadM);
    const px = ox + p.x * CELL + CELL / 2;
    const py = oy + p.y * CELL + CELL / 2;
    // a tadpole: a round head, and a tail that wags behind it
    const back = (tadM.dir + 2) % 4;
    for (let i = 1; i <= 3; i++) {
      const w = Math.sin(t * 16 - i) * i * 0.5;
      g.fillStyle(0x3a6ad8, 1 - i * 0.2).fillCircle(px + DX[back] * i * 1.6 + DY[back] * w, py + DY[back] * i * 1.6 + DX[back] * w, 1.6 - i * 0.3);
    }
    g.fillStyle(0x5a8af0, 1).fillCircle(px, py, 3);
    if (tadM.held > 0) {
      // caught in the reeds: a net that shrinks as it lets go
      g.lineStyle(1, 0xf0d060, 1).strokeCircle(px, py, 3 + tadM.held * 1.4);
      g.lineStyle(1, 0xc8a050, 0.8).lineBetween(px - 5, py, px + 5, py).lineBetween(px, py - 5, px, py + 5);
    }
    g.fillStyle(0xffffff, 1).fillCircle(px + DX[tadM.dir] * 1.2 - DY[tadM.dir], py + DY[tadM.dir] * 1.2 - DX[tadM.dir], 0.8);
  }
  if (frogM) {
    const p = posOf(frogM);
    const px = ox + p.x * CELL + CELL / 2;
    const py = oy + p.y * CELL + CELL / 2;
    // PAC FROG: a round green frog whose mouth opens and shuts the way it goes
    const gape = 0.15 + Math.abs(Math.sin(t * 12)) * 0.6;
    const face = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][frogM.dir];
    g.fillStyle(0x2e7a3a, 1).fillCircle(px, py + 1, 5.2);
    g.fillStyle(0x5ac85a, 1).slice(px, py, 5, face + gape, face - gape + Math.PI * 2, false).fillPath();
    g.fillStyle(0x8a1a2a, 1).slice(px, py, 3, face - gape * 0.7, face + gape * 0.7, false).fillPath();
    // its eyes, on top
    const ex = -DY[frogM.dir] * 2.4;
    const ey = DX[frogM.dir] * 2.4 - 3;
    g.fillStyle(0xffffff, 1).fillCircle(px + ex, py + ey, 1.4).fillCircle(px - ex, py + (DX[frogM.dir] ? -3 : ey), 1.4);
    g.fillStyle(0x0a0812, 1).fillCircle(px + ex, py + ey, 0.7).fillCircle(px - ex, py + (DX[frogM.dir] ? -3 : ey), 0.7);
  }
}

function refreshHud(): void {
  if (!hud) return;
  if (phase === 'pick') hud.setText('');
  else if (role === 'frog') {
    const trap = traps.size >= MAX_TRAPS ? 'ALL DOWN' : trapCd > 0 ? `${Math.ceil(trapCd)}S` : 'READY';
    hud.setText(`PAC FROG   CATCH IT: ${Math.max(0, Math.ceil(HUNT_S - clock))}S   TRAP ${trap}  ${traps.size}/${MAX_TRAPS}`);
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
      { say: 'AFTER PLAY, PICK A SIDE: PAC FROG HUNTS, THE SURVIVOR RUNS.', demo: 'croak.pick' },
      { say: `PAC FROG: CATCH THE TADPOLE IN ${HUNT_S} SECONDS. IT IS QUICKER THAN YOU, SO CORNER IT.`, demo: 'croak.hunt' },
      { say: `SPACE DROPS A TRAP WHERE YOU STAND (${MAX_TRAPS} AT ONCE). A TADPOLE THAT SWIMS IN IS STUCK - GRAB IT.`, phone: `TAP TRAP TO DROP ONE WHERE YOU STAND (${MAX_TRAPS} AT ONCE). A TADPOLE THAT SWIMS IN IS STUCK - GRAB IT.`, demo: 'croak.trap' },
      { say: 'SURVIVOR: YOU ARE QUICKER. EAT EVERY FLY, AND MIND THE FAINT RINGS - THE FROG\'S TRAPS.', demo: 'croak.survive' },
      { say: 'W A S D OR THE ARROWS STEER. PRESS A WAY EARLY AND YOU TURN AT THE NEXT GAP.', phone: 'THE STICK STEERS. PUSH A WAY EARLY AND YOU TURN AT THE NEXT GAP.', demo: 'croak.steer' },
    ],
    objective: ['PICK A SIDE. PAC FROG: TRAP AND CATCH THE QUICKER TADPOLE IN TIME.', 'SURVIVOR: EAT EVERY FLY, DODGE THE FROG AND ITS TRAPS.', 'A NEW MAZE EVERY ROUND.'],
    controls: [
      ['W A S D', 'STEER'],
      ['ARROWS', 'STEER'],
      ['SPACE', 'DROP A TRAP (PAC FROG)'],
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
