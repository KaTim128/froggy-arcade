/**
 * FALLING BLOCKS.  Hard — 5 tokens in, 10 out.
 *
 * A TETRIS WELL WITH A FROG LOOSE IN IT.  Four-cell pieces — the seven shapes,
 * in random turns — drift down a ten-column shaft and pile up where they land.
 * Nobody is steering them.  The frog is the only thing you steer, and the
 * ledge at the top of the shaft is the only thing you are trying to reach.
 *
 * THE PILE IS THE STAIRCASE.  Pieces settle into terrain, the floor of the
 * shaft climbs, and the frog climbs with it — but only if he is standing on
 * top of it.  He jumps between the pile and the pieces still in the air, and
 * a piece he lands on carries him down while he lines up the next hop, so
 * every bit of height is taken rather than given.
 *
 * AND A PIECE WILL CRUSH HIM.  This is the part that costs you the round: a
 * piece coming down on a frog with the pile under his feet has nowhere to put
 * him, and that is the end of it.  In open air it only shoves him down — he
 * rides the underside until he can get out from under.  The frog is never
 * moved anywhere he did not walk, jump or get pushed to: no snapping, no
 * teleporting out of trouble.
 *
 * NOTHING LANDS WITHOUT WARNING.  Every piece in the air draws a hollow GHOST
 * of itself where it is going to come to rest, recomputed every frame against
 * the pile as it stands right now, and the frog flashes red the moment one of
 * those ghosts is sitting on top of him.  Pieces are aimed near the frog, so
 * standing in a corner is not a plan — but you can always see the one that is
 * coming for you, and you always have seconds to be somewhere else.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'fallingblocks' as const;

/** A minute in the well.  The countdown is on screen the whole time. */
export const ROUND_MS = 60_000;

/**
 * The shaft: TWELVE columns, centred, on a 16x12 cell.
 *
 * Twelve rather than ten because the shaft is the room to move in.  With ten,
 * four or five pieces in the air covered most of the floor between them and a
 * frog with nowhere to stand is not being asked to play well, he is being
 * asked to be lucky.  Two more columns is thirty-two pixels of somewhere else
 * to be, every second of the round.
 */
const COLS = 12;
const BW = 16;
const BH = 12;
const SHAFT_W = COLS * BW;
const SHAFT_L = Math.round((GAME_W - SHAFT_W) / 2);

/** Screen rows.  The world is y-up from the shaft floor; this is the bottom. */
const FLOOR_SY = 172;
/** The HUD row owns everything above this, so nothing is drawn into it. */
const TOP_SY = 34;
const VIEW_H = FLOOR_SY - TOP_SY;

/**
 * How high the ledge is, in world pixels above the floor — twenty rows.
 *
 * Tuned against the pile rather than against a perfect run.  The pile is the
 * lift and the jump is the climb: a frog can take four rows off the top of a
 * hop, so twenty rows is a handful of good jumps above wherever the pile has
 * got to.  A frog who survives the minute on top of the pile arrives with time
 * in hand, and one who spends it running along the bottom does not.  Surviving
 * is the game — the height is the clock you are measured against.
 */
export const GOAL_H = 240;

/** The frog. */
const PW = 10;
const PH = 12;
const RUN = 80;
/**
 * A hop peaks at 47 pixels, which is very nearly four rows of the pile.  It
 * used to be three and a quarter, which meant most steps up the pile had to
 * wait for a piece to come and be jumped off — the climb is the point, so the
 * frog gets to make it under his own steam.
 */
const JUMP_V = 210;
const GRAVITY = 470;

/**
 * How fast a piece comes down, and how often one is let go.
 *
 * These two are the fairness dial, not the difficulty dial.  A piece crosses
 * the shaft in about five seconds, which is how long the warning lasts, and
 * one goes every one-and-a-quarter seconds, which puts four in the air at once
 * across twelve columns.  Faster or more often and the frog gets boxed in by
 * pieces he had no way to be somewhere else for, which is not hard, it is
 * arbitrary.
 */
const FALL_V = 30;
const DROP_MS = 1250;

/**
 * The seven shapes, each as the cells it fills: [column offset, row offset],
 * row 0 being the bottom row of the piece.  Every rotation that reads as a
 * different silhouette is listed outright — nobody rotates these in play, so
 * a table is cheaper and clearer than a rotation matrix.
 */
interface Shape {
  name: string;
  color: number;
  turns: [number, number][][];
}
const SHAPES: Shape[] = [
  {
    name: 'I',
    color: PALETTE.tealLight,
    turns: [
      [[0, 0], [1, 0], [2, 0], [3, 0]],
      [[0, 0], [0, 1], [0, 2], [0, 3]],
    ],
  },
  { name: 'O', color: PALETTE.gold, turns: [[[0, 0], [1, 0], [0, 1], [1, 1]]] },
  {
    name: 'T',
    color: 0xa86ad8,
    turns: [
      [[0, 0], [1, 0], [2, 0], [1, 1]],
      [[1, 0], [0, 1], [1, 1], [1, 2]],
      [[1, 0], [0, 1], [1, 1], [2, 1]],
      [[0, 0], [0, 1], [1, 1], [0, 2]],
    ],
  },
  {
    name: 'S',
    color: PALETTE.mossLight,
    turns: [
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
  },
  {
    name: 'Z',
    color: PALETTE.blood,
    turns: [
      [[1, 0], [2, 0], [0, 1], [1, 1]],
      [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
  },
  {
    name: 'J',
    color: 0x4f7ddb,
    turns: [
      [[0, 0], [1, 0], [2, 0], [0, 1]],
      [[0, 0], [1, 0], [1, 1], [1, 2]],
      [[2, 0], [0, 1], [1, 1], [2, 1]],
      [[0, 0], [0, 1], [0, 2], [1, 2]],
    ],
  },
  {
    name: 'L',
    color: PALETTE.ember,
    turns: [
      [[0, 0], [1, 0], [2, 0], [2, 1]],
      [[0, 0], [1, 0], [0, 1], [0, 2]],
      [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [0, 2], [1, 2]],
    ],
  },
];

interface Piece {
  /** The cells, relative to the piece's bottom-left. */
  cells: [number, number][];
  /** Left-most column in the shaft. */
  col: number;
  /** World y of the piece's BOTTOM edge. */
  y: number;
  color: number;
  /** Set the moment it comes to rest; it becomes terrain on the next tick. */
  landed: boolean;
  arts: Phaser.GameObjects.Rectangle[];
  ghosts: Phaser.GameObjects.Rectangle[];
}

/** A cell that has come to rest: where it is and the art standing in it. */
interface Settled {
  col: number;
  /** Row index above the shaft floor. */
  row: number;
  art: Phaser.GameObjects.Rectangle;
}

let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let over = false;
let clock = 0;
let dropTimer = 0;
/** Pile height per column, in ROWS.  Terrain is a height, not a set of boxes. */
let stack: number[] = [];
let settled: Settled[] = [];
let falling: Piece[] = [];
/** Player, in world coordinates: x is screen-x, y is the FEET, up-positive. */
let px = 0;
let py = 0;
let vy = 0;
let onFloor = false;
/** The piece currently underfoot, so one still falling carries the player down. */
let rider: Piece | null = null;
let facing = 1;
let hop = 0;
let camY = 0;
/** Counts down while a ghost is sitting on the frog, for the warning flash. */
let danger = 0;
/** Dev only: a held direction, so a test can play the game without a keyboard. */
let forcedDx: number | null = null;
let frog: Phaser.GameObjects.Container | null = null;
let ledge: Phaser.GameObjects.Rectangle | null = null;
let flag: Phaser.GameObjects.Triangle | null = null;
let hud: {
  time: Phaser.GameObjects.BitmapText;
  height: Phaser.GameObjects.BitmapText;
  bar: Phaser.GameObjects.Rectangle;
  note: Phaser.GameObjects.BitmapText;
  warn: Phaser.GameObjects.BitmapText;
} | null = null;
let keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};

const held = (g: string): boolean => keys[g]?.some((k) => k.isDown) ?? false;
const colX = (c: number): number => SHAFT_L + c * BW;
/** World y -> screen y. */
const sy = (wy: number): number => FLOOR_SY - (wy - camY);
/** The height of the pile in a column, in world pixels. */
const stackTop = (c: number): number => (stack[c] ?? 0) * BH;

/** The highest terrain under the player's feet, across the columns he covers. */
function groundUnder(x: number): number {
  let top = 0;
  for (let c = 0; c < COLS; c++) {
    if (x + PW / 2 <= colX(c) || x - PW / 2 >= colX(c) + BW) continue;
    top = Math.max(top, stackTop(c));
  }
  return top;
}

/**
 * Where a piece would come to rest against the pile AS IT STANDS NOW, as a
 * world y for its bottom edge.  This is what the ghost is drawn at, and what
 * the piece is tested against on the way down, so the outline the player is
 * reading and the thing that lands on them are the same calculation.
 */
function restHeight(p: Piece): number {
  let rest = 0;
  for (const [cx, cy] of p.cells) {
    rest = Math.max(rest, stackTop(p.col + cx) - cy * BH);
  }
  return rest;
}

/** Does this piece, at this height, overlap the frog's box? */
function overlapsFrog(p: Piece, atY: number): boolean {
  for (const [cx, cy] of p.cells) {
    const cellL = colX(p.col + cx);
    const cellB = atY + cy * BH;
    if (px + PW / 2 <= cellL || px - PW / 2 >= cellL + BW) continue;
    if (py + PH > cellB && py < cellB + BH) return true;
  }
  return false;
}

/** The lowest cell bottom of this piece that is over the frog's column span. */
function ceilingOver(p: Piece): number {
  let low = Infinity;
  for (const [cx, cy] of p.cells) {
    const cellL = colX(p.col + cx);
    if (px + PW / 2 <= cellL || px - PW / 2 >= cellL + BW) continue;
    low = Math.min(low, p.y + cy * BH);
  }
  return low;
}

export const fallingBlocks: MinigameModule = {
  id: ID,
  title: 'FALLING BLOCKS',
  music: 'game_fallingblocks',
  rules: 'climb the pile, do not get crushed',
  payoutNote: 'WIN: 10 TOKENS',
  tutorial: {
    objective: [
      'TETRIS PIECES FALL AND PILE UP.',
      'CLIMB THE PILE TO THE LEDGE AT THE TOP.',
      'THE OUTLINE SHOWS WHERE ONE WILL LAND -',
      'CAUGHT UNDER IT ON THE PILE AND YOU ARE FLAT.',
    ],
    controls: [
      ['A / D', 'RUN LEFT AND RIGHT'],
      ['ARROWS', 'RUN LEFT AND RIGHT'],
      ['SPACE / W', 'JUMP'],
    ],
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    over = false;
    clock = 0;
    dropTimer = 1500;
    stack = Array<number>(COLS).fill(0);
    settled = [];
    falling = [];
    px = SHAFT_L + SHAFT_W / 2;
    py = 0;
    vy = 0;
    onFloor = true;
    rider = null;
    facing = 1;
    hop = 0;
    camY = 0;
    danger = 0;
    forcedDx = null;

    // ---- the room the shaft is in: brick either side, and a lit-up back wall
    scene.add.rectangle(0, 18, GAME_W, 162, 0x140e22).setOrigin(0, 0);
    for (let i = 0; i < 26; i++) {
      const x = (i % 2) * 6 + ((i * 37) % Math.max(1, SHAFT_L - 8));
      const y = 20 + ((i * 53) % 150);
      scene.add.rectangle(x, y, 5, 3, 0x241a3a).setOrigin(0, 0);
      scene.add.rectangle(GAME_W - x - 5, y + 7, 5, 3, 0x241a3a).setOrigin(0, 0);
    }
    scene.add.rectangle(SHAFT_L - 4, TOP_SY - 4, 4, FLOOR_SY - TOP_SY + 12, PALETTE.slate).setOrigin(0, 0);
    scene.add.rectangle(SHAFT_L + SHAFT_W, TOP_SY - 4, 4, FLOOR_SY - TOP_SY + 12, PALETTE.slate).setOrigin(0, 0);
    scene.add.rectangle(SHAFT_L, TOP_SY - 4, SHAFT_W, FLOOR_SY - TOP_SY + 12, 0x1c1430).setOrigin(0, 0);
    // the guide lines between columns, so the shaft reads as a grid
    for (let c = 1; c < COLS; c++) {
      scene.add.rectangle(colX(c), TOP_SY - 4, 1, FLOOR_SY - TOP_SY + 12, 0x2a2046).setOrigin(0, 0).setAlpha(0.7);
    }
    // the lip of the shaft, so the pieces read as coming out of somewhere
    scene.add.rectangle(SHAFT_L - 6, TOP_SY - 6, SHAFT_W + 12, 3, PALETTE.steel).setOrigin(0, 0).setDepth(11);

    // ---- the ledge at the top, and the flag on it
    ledge = scene.add.rectangle(SHAFT_L, 0, SHAFT_W, 6, PALETTE.mossLight).setOrigin(0, 0).setDepth(6);
    flag = scene.add.triangle(SHAFT_L + SHAFT_W / 2, 0, 0, 0, 12, 5, 0, 10, PALETTE.gold).setDepth(7);

    frog = makeFrog(scene);

    hud = {
      time: centerText(scene, GAME_W / 2, 24, '', PALETTE.cream),
      height: text(scene, 6, 24, '', PALETTE.tealLight),
      bar: scene.add.rectangle(GAME_W - 10, FLOOR_SY, 4, 0, PALETTE.gold).setOrigin(0, 1).setDepth(9),
      note: centerText(scene, GAME_W / 2, 96, '', PALETTE.gold, 16).setDepth(40).setVisible(false),
      warn: centerText(scene, GAME_W / 2, 40, 'MOVE!', PALETTE.blood).setDepth(12).setVisible(false),
    };
    scene.add.rectangle(GAME_W - 10, TOP_SY, 4, VIEW_H, PALETTE.ink).setOrigin(0, 0).setDepth(8).setStrokeStyle(1, PALETTE.steel);
    hud.bar.setDepth(9);
    hud.time.setDepth(9);
    hud.height.setDepth(9);

    const kb = scene.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    keys = {
      left: bind(['A', 'LEFT']),
      right: bind(['D', 'RIGHT']),
      jump: bind(['SPACE', 'W', 'UP']),
    };
    kb?.on('keydown-SPACE', () => jump());
    kb?.on('keydown-W', () => jump());
    kb?.on('keydown-UP', () => jump());

    refreshHud();
    draw();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__blocks = {
        state: () => ({
          clock: Math.round(clock),
          left: Math.max(0, Math.round((ROUND_MS - clock) / 1000)),
          x: Math.round(px),
          height: Math.round(py),
          goal: GOAL_H,
          falling: falling.length,
          cells: falling.map((p) => p.cells.length),
          stack: stack.slice(),
          settled: settled.length,
          onFloor,
          riding: rider !== null,
          danger: danger > 0,
          /** The columns every ghost currently covers, and where it will rest. */
          ghosts: falling.map((p) => ({
            cols: p.cells.map(([cx]) => p.col + cx).filter((c, i, a) => a.indexOf(c) === i),
            rest: Math.round(restHeight(p)),
            y: Math.round(p.y),
          })),
          cols: COLS,
          shaftL: SHAFT_L,
          cellW: BW,
          over,
        }),
        /** Put the frog where a test needs him, in world coordinates. */
        setPlayer: (x: number, y: number) => {
          px = Phaser.Math.Clamp(x, SHAFT_L + PW / 2, SHAFT_L + SHAFT_W - PW / 2);
          py = Math.max(0, y);
          vy = 0;
          rider = null;
        },
        /** Drop a named shape down a named column, for testing the platforming. */
        drop: (col: number, shape?: string) =>
          spawn(Phaser.Math.Clamp(col | 0, 0, COLS - 1), SHAPES.find((s) => s.name === shape)),
        /** Hang one directly over the frog's head, a row up, to test the crush. */
        dropOnHead: () => {
          const c = Phaser.Math.Clamp(Math.floor((px - SHAFT_L) / BW), 0, COLS - 1);
          const p = spawn(c, SHAPES.find((s) => s.name === 'O'));
          if (p) p.y = py + PH + 2;
          return p !== null;
        },
        /** Hold a direction, so a test can walk the frog about. null lets go. */
        hold: (dir: number | null) => {
          forcedDx = dir === null ? null : Phaser.Math.Clamp(dir, -1, 1);
        },
        jump: () => jump(),
        /** Wind the clock on, so the buzzer can be tested in a second. */
        setClock: (ms: number) => {
          clock = ms;
        },
        shapes: () => SHAPES.map((s) => s.name),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__blocks;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over || !sceneRef) return;
    const dt = Math.min(0.05, delta / 1000);
    clock += delta;
    if (clock >= ROUND_MS) {
      finish(false, 'OUT OF TIME');
      return;
    }

    // ---- the pieces.  They fall until the pile under them is in the way.
    dropTimer -= delta;
    if (dropTimer <= 0) {
      spawn(aimColumn());
      dropTimer = DROP_MS;
    }
    for (const p of falling) {
      const restAt = restHeight(p);
      p.y -= FALL_V * dt;
      if (p.y <= restAt) {
        p.y = restAt;
        land(p);
      }
    }
    falling = falling.filter((p) => !p.landed);

    // ---- the frog
    const dx = forcedDx ?? (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    if (dx !== 0) facing = dx;
    px = Phaser.Math.Clamp(px + dx * RUN * dt, SHAFT_L + PW / 2, SHAFT_L + SHAFT_W - PW / 2);

    const feetWas = py;
    if (rider) {
      // Standing on a piece that is still coming down: it takes you with it.
      const top = riderTop(rider);
      if (top === null || rider.landed) {
        rider = null;
      } else {
        py = top;
        vy = 0;
      }
    }
    if (!rider) {
      vy -= GRAVITY * dt;
      py += vy * dt;
    }

    // ---- what is underfoot.  Terrain first, then anything still in the air.
    onFloor = false;
    const ground = groundUnder(px);
    if (py <= ground && vy <= 0) {
      py = ground;
      vy = 0;
      onFloor = true;
      rider = null;
    } else if (vy <= 0) {
      for (const p of falling) {
        const top = riderTop(p);
        if (top === null) continue;
        const wasAbove = feetWas >= top + FALL_V * dt - 1;
        if (wasAbove && py <= top) {
          py = top;
          vy = 0;
          rider = p;
          audio.sfx('footstep_concrete', 0.35);
          break;
        }
      }
    }

    // ---- CRUSHED, or shoved.  A piece that has caught the frog against the
    // pile has nowhere to put him and that is the round; one that catches him
    // in open air just pushes him down until he can get out from under it.
    for (const p of falling) {
      if (p === rider) continue;
      if (!overlapsFrog(p, p.y)) continue;
      const ceiling = ceilingOver(p);
      if (!Number.isFinite(ceiling)) continue;
      const room = ceiling - PH;
      if (room <= groundUnder(px) + 0.5) {
        crush(p);
        return;
      }
      py = Math.min(py, room);
      vy = Math.min(vy, -FALL_V);
      rider = null;
    }

    // ---- the warning: is a ghost sitting on top of the frog right now?
    danger = Math.max(0, danger - delta);
    for (const p of falling) {
      if (overlapsFrog(p, restHeight(p))) {
        danger = 260;
        break;
      }
    }

    // ---- the top
    if (py >= GOAL_H) {
      py = GOAL_H;
      finish(true, 'THE TOP!');
      return;
    }

    // ---- camera.  The frog sits a third of the way up the view, and it never
    // drops below the floor of the shaft.
    const want = Math.max(0, py - VIEW_H * 0.38);
    camY += (want - camY) * Math.min(1, dt * 6);

    hop = onFloor || rider ? 0 : hop + dt * 8;
    draw();
    refreshHud();
  },

  destroy() {
    falling = [];
    settled = [];
    stack = [];
    frog = null;
    ledge = null;
    flag = null;
    hud = null;
    keys = {};
    sceneRef = null;
    apiRef = null;
  },
};

/**
 * The height the frog would stand at on this piece, or null if he is not over
 * any part of it.  A tetromino is not a rectangle — you can stand on the long
 * arm of an L and walk off the short one — so the top is per column.
 */
function riderTop(p: Piece): number | null {
  let top: number | null = null;
  for (const [cx, cy] of p.cells) {
    const cellL = colX(p.col + cx);
    if (px + PW / 2 <= cellL || px - PW / 2 >= cellL + BW) continue;
    const t = p.y + (cy + 1) * BH;
    top = top === null ? t : Math.max(top, t);
  }
  return top;
}

/** A jump, if there is anything to jump off. */
function jump(): void {
  if (over) return;
  if (!onFloor && !rider) return;
  vy = JUMP_V;
  rider = null;
  onFloor = false;
  audio.sfx('hop_wet', 0.5);
}

/**
 * Which column to let the next one go down.  Near the frog most of the time,
 * so there is always something in the air he has to deal with and standing in
 * a corner is not a plan — but one in four goes anywhere at all, so the pile
 * builds across the whole shaft instead of digging a canyon around him.
 */
function aimColumn(): number {
  if (Phaser.Math.Between(0, 3) === 0) return Phaser.Math.Between(0, COLS - 1);
  const here = Phaser.Math.Clamp(Math.floor((px - SHAFT_L) / BW), 0, COLS - 1);
  return Phaser.Math.Clamp(here + Phaser.Math.Between(-4, 4), 0, COLS - 1);
}

/** Let one go: a random shape in a random turn, clamped inside the shaft. */
function spawn(col: number, forced?: Shape): Piece | null {
  if (!sceneRef) return null;
  const shape = forced ?? SHAPES[Phaser.Math.Between(0, SHAPES.length - 1)];
  const cells = shape.turns[Phaser.Math.Between(0, shape.turns.length - 1)];
  const width = Math.max(...cells.map(([cx]) => cx)) + 1;
  const left = Phaser.Math.Clamp(col, 0, COLS - width);
  // From above the top of the view, so it comes into shot already moving.
  const y = camY + VIEW_H + 20;
  const piece: Piece = {
    cells: cells.map(([cx, cy]) => [cx, cy] as [number, number]),
    col: left,
    y,
    color: shape.color,
    landed: false,
    arts: [],
    ghosts: [],
  };
  for (let i = 0; i < cells.length; i++) {
    piece.arts.push(
      sceneRef.add.rectangle(0, 0, BW - 2, BH - 2, shape.color).setOrigin(0, 0).setDepth(4).setStrokeStyle(1, 0x0b0d12),
    );
    piece.ghosts.push(
      sceneRef.add
        .rectangle(0, 0, BW - 2, BH - 2, shape.color, 0.1)
        .setOrigin(0, 0)
        .setDepth(2)
        .setStrokeStyle(1, shape.color, 0.75),
    );
  }
  falling.push(piece);
  return piece;
}

/** It has come to rest.  From here it is terrain, and it is drawn as terrain. */
function land(p: Piece): void {
  if (!sceneRef) return;
  p.landed = true;
  for (const a of p.arts) a.destroy();
  for (const g of p.ghosts) g.destroy();
  p.arts = [];
  p.ghosts = [];

  // Four cells go down and four cells stay down — the piece is drawn exactly
  // where it stopped, gaps and all, the way a well full of tetrominoes looks.
  // The walkable surface of a column is the top of its highest cell, so a
  // cave under a bridged S is a cave you can see and never fall into, and the
  // pile grows by what actually landed rather than by what got packed in.
  const base = Math.round(p.y / BH);
  const tops = new Map<number, number>();
  for (const [cx, cy] of p.cells) {
    const c = p.col + cx;
    const row = base + cy;
    tops.set(c, Math.max(tops.get(c) ?? 0, row + 1));
    const art = sceneRef.add
      .rectangle(0, 0, BW - 2, BH - 2, p.color)
      .setOrigin(0, 0)
      .setDepth(3)
      .setStrokeStyle(1, 0x0b0d12)
      .setAlpha(0.8);
    settled.push({ col: c, row, art });
  }
  for (const [c, top] of tops) stack[c] = Math.max(stack[c] ?? 0, top);
  audio.sfx('item_thud', 0.35);
  sceneRef.cameras.main.shake(60, 0.0015);
}

function draw(): void {
  for (const p of falling) {
    const rest = restHeight(p);
    p.cells.forEach(([cx, cy], i) => {
      const x = colX(p.col + cx) + 1;
      const top = sy(p.y + (cy + 1) * BH - 1);
      const art = p.arts[i];
      art.setPosition(x, top);
      // Nothing is drawn into the HUD row or under the floor.
      art.setVisible(top > TOP_SY - BH && top < FLOOR_SY + BH);
      const gy = sy(rest + (cy + 1) * BH - 1);
      const ghost = p.ghosts[i];
      ghost.setPosition(x, gy);
      // The ghost is only worth drawing while the piece is still above it.
      ghost.setVisible(gy > TOP_SY - BH && gy < FLOOR_SY + BH && p.y > rest + 2);
    });
  }
  for (const s of settled) {
    s.art.setPosition(colX(s.col) + 1, sy((s.row + 1) * BH - 1));
    s.art.setVisible(s.art.y > TOP_SY - BH && s.art.y < FLOOR_SY + BH);
  }
  ledge?.setPosition(SHAFT_L, sy(GOAL_H));
  ledge?.setVisible(sy(GOAL_H) > TOP_SY - 6 && sy(GOAL_H) < FLOOR_SY + 6);
  flag?.setPosition(SHAFT_L + SHAFT_W / 2 + 8, sy(GOAL_H) - 10);
  flag?.setVisible(ledge?.visible === true);
  if (frog) {
    frog.setPosition(px, sy(py));
    frog.setVisible(frog.y > TOP_SY - 2 && frog.y < FLOOR_SY + 8);
    // a squash on the way up, so the jump reads at 12 pixels tall
    const squash = Math.sin(hop) * 0.12;
    frog.setScale(facing * (1 - squash), 1 + squash);
    // and he goes red under a ghost, because that is the one thing in here
    // that ends the round
    const flash = danger > 0 && Math.floor(danger / 90) % 2 === 0;
    frog.setAlpha(flash ? 0.55 : 1);
  }
  hud?.warn.setVisible(danger > 0);
}

function refreshHud(): void {
  if (!hud) return;
  const left = Math.max(0, Math.ceil((ROUND_MS - clock) / 1000));
  hud.time.setText(`${left}s`);
  hud.time.setTint(left <= 10 ? PALETTE.blood : PALETTE.cream);
  hud.height.setText(`UP ${Math.max(0, Math.round(py))} / ${GOAL_H}`);
  hud.bar.setSize(4, Math.min(1, py / GOAL_H) * VIEW_H);
}

/** Caught between a piece and the pile.  That is the round. */
function crush(p: Piece): void {
  if (!sceneRef) return;
  // Put the piece down where it caught him, so the last frame shows why.
  p.y = Math.max(restHeight(p), groundUnder(px));
  draw();
  sceneRef.cameras.main.shake(220, 0.012);
  frog?.setScale(1.5, 0.25);
  finish(false, 'CRUSHED');
}

function finish(won: boolean, why: string): void {
  if (over || !sceneRef) return;
  over = true;
  hud?.note.setText(why).setVisible(true);
  hud?.note.setTint(won ? PALETTE.gold : PALETTE.blood);
  hud?.warn.setVisible(false);
  audio.sfx(won ? 'chime' : 'buzzer');
  if (won) sceneRef.cameras.main.flash(220, 255, 240, 180);
  sceneRef.time.delayedCall(1200, () => (won ? apiRef?.win() : apiRef?.lose()));
}

/** The climber: a frog, seen from the side, with his legs under him. */
function makeFrog(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const parts = [
    scene.add.ellipse(-3, -1, 5, 3, PALETTE.moss),
    scene.add.ellipse(3, -1, 5, 3, PALETTE.moss),
    scene.add.ellipse(0, -6, 10, 10, PALETTE.mossLight),
    scene.add.ellipse(0, -4, 6, 5, 0xcfe8a0),
    scene.add.circle(-2, -10, 2, PALETTE.cream),
    scene.add.circle(2, -10, 2, PALETTE.cream),
    scene.add.circle(-2, -10, 1, PALETTE.black),
    scene.add.circle(2, -10, 1, PALETTE.black),
  ];
  return scene.add.container(0, 0, parts).setDepth(10);
}
