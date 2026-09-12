/**
 * FALLING BLOCKS.  Medium — 3 tokens in, 6 out.
 *
 * A shaft with a ledge at the top of it and forty-five seconds to be standing
 * on that ledge.  Blocks fall down the shaft the whole time, and they are the
 * only way up: you jump onto one while it is still in the air, it carries you
 * down while you line up the next one, and you leave it before it costs you
 * more height than it gave.  A frog gets about three quarters of a block's
 * height out of a jump, so climbing is a chain of small wins against a shaft
 * that is always pulling you back down.
 *
 * A BLOCK THAT REACHES THE BOTTOM STAYS THERE.  It lands on the floor, or on
 * whatever else has already landed in its column, and becomes terrain.  That
 * is what stops a fall being the end of the run: the longer the game goes on,
 * the higher the floor you fall back onto, and the ground under the shaft
 * builds itself into a staircase while you are working above it.
 *
 * The clock is the only way to lose.  Nothing here kills you: a block that
 * comes down on your head shoves you out from under it rather than ending the
 * run, because the whole difficulty is meant to be the climb and the
 * forty-five seconds, not a hazard you cannot see coming.
 *
 * Blocks are aimed at the column the player is in, give or take two, so there
 * is always something in the air within reach.  A shaft that dropped them
 * uniformly left a player stranded on the wrong side of it watching blocks
 * fall somewhere else, which is not difficulty, it is waiting.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'fallingblocks' as const;

/** Forty-five seconds, and the countdown is on screen the whole time. */
export const ROUND_MS = 45_000;

/** The shaft: eight columns of blocks, centred. */
const COLS = 8;
const BW = 20;
const BH = 14;
const SHAFT_W = COLS * BW;
const SHAFT_L = Math.round((GAME_W - SHAFT_W) / 2);

/** Screen rows.  The world is y-up from the shaft floor; this is the bottom. */
const FLOOR_SY = 172;
/** The HUD row owns everything above this, so nothing is drawn into it. */
const TOP_SY = 34;
const VIEW_H = FLOOR_SY - TOP_SY;

/**
 * How high the ledge is, in world pixels above the floor.
 *
 * Tuned against the safety net rather than against a perfect run: blocks
 * landing under a stationary frog lift him, and forty-five seconds of that
 * alone is worth about 280 pixels.  The last eighty have to be climbed, so
 * standing still is not a strategy and is not a trap either.
 */
export const GOAL_H = 360;

/** The frog. */
const PW = 10;
const PH = 12;
const RUN = 78;
const JUMP_V = 192;
const GRAVITY = 470;

/** How fast a block comes down, and how often one is dropped. */
const FALL_V = 32;
const DROP_MS = 430;

interface Block {
  /** Column index, 0..COLS-1. */
  col: number;
  /** World y of the block's BOTTOM edge. */
  y: number;
  /** Set the moment it comes to rest; it becomes terrain on the next tick. */
  landed: boolean;
  body: Phaser.GameObjects.Rectangle;
  face: Phaser.GameObjects.Rectangle;
}

/** A block that has come to rest: a column, a height, and the art on it. */
interface Settled {
  col: number;
  y: number;
  art: Phaser.GameObjects.Rectangle;
}

let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let over = false;
let clock = 0;
let dropTimer = 0;
/** Landed blocks per column, as a count — landed blocks are terrain, not objects. */
let stack: number[] = [];
let settled: Settled[] = [];
let falling: Block[] = [];
/** Player, in world coordinates: x is screen-x, y is the FEET, up-positive. */
let px = 0;
let py = 0;
let vy = 0;
let onFloor = false;
/** The block currently underfoot, so a falling one carries the player down. */
let rider: Block | null = null;
let facing = 1;
let hop = 0;
let camY = 0;
let frog: Phaser.GameObjects.Container | null = null;
let ledge: Phaser.GameObjects.Rectangle | null = null;
let flag: Phaser.GameObjects.Triangle | null = null;
let hud: {
  time: Phaser.GameObjects.BitmapText;
  height: Phaser.GameObjects.BitmapText;
  bar: Phaser.GameObjects.Rectangle;
  note: Phaser.GameObjects.BitmapText;
} | null = null;
let keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};

const held = (g: string): boolean => keys[g]?.some((k) => k.isDown) ?? false;
const colX = (c: number): number => SHAFT_L + c * BW;
/** World y -> screen y. */
const sy = (wy: number): number => FLOOR_SY - (wy - camY);
/** The height of the landed stack in a column, in world pixels. */
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

export const fallingBlocks: MinigameModule = {
  id: ID,
  title: 'FALLING BLOCKS',
  music: 'game_fallingblocks',
  rules: 'ride the blocks to the top',
  payoutNote: 'WIN: 6 TOKENS',
  tutorial: {
    objective: [
      'GET TO THE LEDGE AT THE TOP.',
      'THE FALLING BLOCKS ARE THE ONLY WAY UP.',
      'JUMP ON ONE, THEN JUMP OFF IT AGAIN.',
      'YOU HAVE 45 SECONDS.',
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
    dropTimer = 600;
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

    // ---- the room the shaft is in: brick either side, and a lit-up back wall
    scene.add.rectangle(0, 18, GAME_W, 162, 0x140e22).setOrigin(0, 0);
    for (let i = 0; i < 26; i++) {
      const x = (i % 2) * 6 + ((i * 37) % (SHAFT_L - 8));
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
    // the lip of the shaft, so the blocks read as coming out of somewhere
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
          height: Math.round(py),
          goal: GOAL_H,
          falling: falling.length,
          stack: stack.slice(),
          onFloor,
          riding: rider !== null,
          over,
        }),
        /** Put the frog where a test needs him, in world coordinates. */
        setPlayer: (x: number, y: number) => {
          px = Phaser.Math.Clamp(x, SHAFT_L + PW / 2, SHAFT_L + SHAFT_W - PW / 2);
          py = Math.max(0, y);
          vy = 0;
          rider = null;
        },
        /** Drop one, in a named column, for testing the platforming. */
        drop: (col: number) => spawn(Phaser.Math.Clamp(col | 0, 0, COLS - 1)),
        jump: () => jump(),
        /** Wind the clock on, so the buzzer can be tested in a second. */
        setClock: (ms: number) => {
          clock = ms;
        },
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
      finish(false);
      return;
    }

    // ---- blocks.  They fall until the column under them is in the way.
    dropTimer -= delta;
    if (dropTimer <= 0) {
      spawn(aimColumn());
      dropTimer = DROP_MS;
    }
    for (const b of falling) {
      const restAt = stackTop(b.col);
      b.y -= FALL_V * dt;
      if (b.y <= restAt) {
        b.y = restAt;
        land(b);
      }
    }
    falling = falling.filter((b) => !b.landed);

    // ---- the frog
    const dx = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    if (dx !== 0) facing = dx;
    px = Phaser.Math.Clamp(px + dx * RUN * dt, SHAFT_L + PW / 2, SHAFT_L + SHAFT_W - PW / 2);

    const feetWas = py;
    if (rider) {
      // Standing on a block that is still coming down: it takes you with it.
      const overIt = px + PW / 2 > colX(rider.col) && px - PW / 2 < colX(rider.col) + BW;
      if (!overIt || rider.landed) {
        rider = null;
      } else {
        py = rider.y + BH;
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
      for (const b of falling) {
        const top = b.y + BH;
        const wasAbove = feetWas >= top + FALL_V * dt - 1;
        const overIt = px + PW / 2 > colX(b.col) && px - PW / 2 < colX(b.col) + BW;
        if (overIt && wasAbove && py <= top) {
          py = top;
          vy = 0;
          rider = b;
          audio.sfx('footstep_concrete', 0.35);
          break;
        }
      }
    }

    // ---- a block coming down on your head shoves you out from under it
    for (const b of falling) {
      if (b === rider) continue;
      const overIt = px + PW / 2 > colX(b.col) && px - PW / 2 < colX(b.col) + BW;
      if (!overIt) continue;
      if (py + PH > b.y && py < b.y + BH) {
        py = Math.max(groundUnder(px), b.y - PH);
        vy = Math.min(vy, 0);
        rider = null;
      }
    }

    // ---- the top
    if (py >= GOAL_H) {
      py = GOAL_H;
      finish(true);
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
 * Which column to drop the next one down.  Near the player, so there is always
 * something in the air he can actually reach, but not always the exact column
 * he is standing in — that would be a ladder rather than a game.
 */
function aimColumn(): number {
  const here = Phaser.Math.Clamp(Math.floor((px - SHAFT_L) / BW), 0, COLS - 1);
  const spread = Phaser.Math.Between(-2, 2);
  return Phaser.Math.Clamp(here + spread, 0, COLS - 1);
}

function spawn(col: number): void {
  if (!sceneRef) return;
  // From above the top of the view, so it comes into shot already moving.
  const y = camY + VIEW_H + 16;
  const body = sceneRef.add.rectangle(0, 0, BW - 2, BH - 2, PALETTE.tealDark).setOrigin(0, 0).setDepth(4);
  const face = sceneRef.add.rectangle(0, 0, BW - 2, 3, PALETTE.tealLight).setOrigin(0, 0).setDepth(5);
  falling.push({ col, y, landed: false, body, face });
}

/** It has come to rest.  From here it is terrain, and it is drawn as terrain. */
function land(b: Block): void {
  if (!sceneRef) return;
  b.landed = true;
  stack[b.col] = (stack[b.col] ?? 0) + 1;
  b.body.destroy();
  b.face.destroy();
  const art = sceneRef.add.rectangle(0, 0, BW - 2, BH - 2, PALETTE.slate).setOrigin(0, 0).setDepth(3);
  art.setStrokeStyle(1, 0x6a7180);
  settled.push({ col: b.col, y: b.y, art });
  audio.sfx('item_thud', 0.35);
  sceneRef.cameras.main.shake(60, 0.0015);
}

function draw(): void {
  for (const b of falling) {
    const top = sy(b.y + BH - 1);
    b.body.setPosition(colX(b.col) + 1, top);
    b.face.setPosition(colX(b.col) + 1, top);
    // Nothing is drawn into the HUD row or under the floor.
    const show = top > TOP_SY - BH && top < FLOOR_SY + BH;
    b.body.setVisible(show);
    b.face.setVisible(show);
  }
  for (const s of settled) {
    s.art.setPosition(colX(s.col) + 1, sy(s.y + BH - 1));
    s.art.setVisible(s.art.y > TOP_SY - BH && s.art.y < FLOOR_SY + BH);
  }
  ledge?.setPosition(SHAFT_L, sy(GOAL_H));
  ledge?.setVisible(sy(GOAL_H) > TOP_SY - 6 && sy(GOAL_H) < FLOOR_SY + 6);
  flag?.setPosition(SHAFT_L + SHAFT_W / 2 + 8, sy(GOAL_H) - 10);
  flag?.setVisible(ledge?.visible === true);
  if (frog) {
    frog.setPosition(px, sy(py));
    frog.setVisible(frog.y > TOP_SY - 2 && frog.y < FLOOR_SY + 8);
    frog.setScale(facing, 1);
    // a squash on the way up, so the jump reads at 12 pixels tall
    const squash = Math.sin(hop) * 0.12;
    frog.setScale(facing * (1 - squash), 1 + squash);
  }
}

function refreshHud(): void {
  if (!hud) return;
  const left = Math.max(0, Math.ceil((ROUND_MS - clock) / 1000));
  hud.time.setText(`${left}s`);
  hud.time.setTint(left <= 10 ? PALETTE.blood : PALETTE.cream);
  hud.height.setText(`UP ${Math.max(0, Math.round(py))} / ${GOAL_H}`);
  hud.bar.setSize(4, Math.min(1, py / GOAL_H) * VIEW_H);
}

function finish(won: boolean): void {
  if (over || !sceneRef) return;
  over = true;
  hud?.note.setText(won ? 'THE TOP!' : 'OUT OF TIME').setVisible(true);
  hud?.note.setTint(won ? PALETTE.gold : PALETTE.blood);
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
