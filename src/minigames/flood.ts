/**
 * THE FLOOD.  Hard — 5 tokens in, 10 out.
 *
 * A parkour shaft with the water coming up it.  There is one way out and it is
 * the hatch at the top; there is one way to lose and it is the water reaching
 * your feet.  Nothing else in here can kill you, and nothing else needs to —
 * the flood is the clock, the difficulty and the reason you cannot stand
 * anywhere and think about it, all at once.
 *
 * THE LEDGES ARE THE GAME.  Six kinds, and each one asks a different question:
 *   STATIC    a ledge.  Where the run breathes.
 *   SLIDE     tracks left and right.  Jump where it is going to be.
 *   RISE      tracks up and down.  Take it at the bottom of its stroke.
 *   SPIN      a bar turning on its middle.  Edge-on it is nothing to land on,
 *             flat it is a wide ledge, and the whole skill is the wait.
 *   RETRACT   slides out of the wall and back into it.  Cross while it is out.
 *   CRUMBLE   holds for half a second under a foot, then drops.  Keep moving.
 *
 * FAIR, AND GENERATED.  Every run is a different tower, but the generator is
 * not allowed to build one you cannot climb: each ledge is placed inside the
 * arc a jump actually covers, measured from the constants below rather than
 * guessed, and a MOVING ledge is placed against its WORST position, not its
 * average — so "reachable" means reachable at the moment it is furthest away.
 * A run can be hard.  It cannot be impossible.
 *
 * YOU CAN SEE WHAT IS COMING.  The camera rides above the frog rather than on
 * him, so the next two or three ledges are on screen while you are deciding;
 * the water's own line is drawn wherever it is, and a gauge down the right
 * edge shows the three things that matter — where the water is, where you are,
 * and where the hatch is — as one picture.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'fallingblocks' as const;

/** The shaft, in world pixels.  y is up-positive from the flooded floor. */
const WALL = 16;
const SHAFT_L = WALL;
const SHAFT_R = GAME_W - WALL;
const SHAFT_W = SHAFT_R - SHAFT_L;

/** Screen rows.  The HUD owns everything above TOP_SY. */
const FLOOR_SY = 178;
const TOP_SY = 30;
const VIEW_H = FLOOR_SY - TOP_SY;

/** The frog, and the arc a jump actually covers. */
const PW = 9;
const RUN = 92;
const JUMP_V = 232;
const GRAVITY = 620;
/** Apex of a standing jump: 43 pixels.  Everything else is measured off it. */
const APEX = (JUMP_V * JUMP_V) / (2 * GRAVITY);
/** How long a full jump lasts, and how far a run covers in that time. */
const AIRTIME = (2 * JUMP_V) / GRAVITY;
const REACH = RUN * AIRTIME * 0.78;

/**
 * How high the hatch is.  The ledge count is NOT fixed: the generator keeps
 * stacking until one more jump would clear the hatch, so the last step is
 * always a legal jump from the one below it rather than whatever gap a fixed
 * count happened to leave.
 */
export const GOAL_H = 720;

/**
 * The water.
 *
 * It starts well below the kerb and gets faster, because a flood that rose at
 * a constant rate would be a countdown you could read once at the start and
 * then ignore.  At these numbers it takes eight seconds to reach the floor you
 * are standing on — long enough to look up and pick a line, short enough that
 * looking twice costs you — and about sixty-five to reach the hatch, which is
 * a ledge every two and a bit seconds all the way up.
 */
const WATER_START = -70;
const WATER_V0 = 8.5;
const WATER_ACC = 0.115;

type Kind = 'static' | 'slide' | 'rise' | 'spin' | 'retract' | 'crumble';

interface Plat {
  kind: Kind;
  /** Where the generator placed it: the anchor every motion swings around. */
  ax: number;
  ay: number;
  w: number;
  /** Live position of the middle of the top surface. */
  x: number;
  y: number;
  /** Movers: half the travel, and where in the cycle it is. */
  amp: number;
  rate: number;
  phase: number;
  /** Spin only, in radians. */
  angle: number;
  /** Retract only: which wall it comes out of. */
  side: -1 | 1;
  /** Crumble only. */
  state: 'solid' | 'going' | 'gone';
  timer: number;
  art: Phaser.GameObjects.Rectangle;
  lip: Phaser.GameObjects.Rectangle;
}

let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let over = false;
let clock = 0;
let plats: Plat[] = [];
let px = 0;
let py = 0;
let vy = 0;
let onGround = false;
/** The ledge underfoot, so a moving one carries the frog with it. */
let rider: Plat | null = null;
let riderX = 0;
let facing = 1;
let hop = 0;
let camY = 0;
let waterY = 0;
let lastRumble = 0;
let frog: Phaser.GameObjects.Container | null = null;
let water: Phaser.GameObjects.Rectangle | null = null;
let waterLip: Phaser.GameObjects.Rectangle | null = null;
let foam: Phaser.GameObjects.Rectangle[] = [];
let bubbles: Array<{ art: Phaser.GameObjects.Arc; y: number; vy: number }> = [];
let hatch: Phaser.GameObjects.Rectangle | null = null;
let hatchGlow: Phaser.GameObjects.Rectangle | null = null;
let hud: {
  height: Phaser.GameObjects.BitmapText;
  gap: Phaser.GameObjects.BitmapText;
  gaugeWater: Phaser.GameObjects.Rectangle;
  gaugeYou: Phaser.GameObjects.Rectangle;
  note: Phaser.GameObjects.BitmapText;
} | null = null;
let keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};

const held = (g: string): boolean => keys[g]?.some((k) => k.isDown) ?? false;
/** World y -> screen y. */
const sy = (wy: number): number => FLOOR_SY - (wy - camY);

/**
 * The standable top of a ledge right now, or null if there is nothing to stand
 * on this instant — a spin bar seen edge-on, a retracted arm, a ledge that has
 * already crumbled.
 */
function surfaceOf(p: Plat): { left: number; right: number; y: number } | null {
  if (p.kind === 'crumble' && p.state === 'gone') return null;
  if (p.kind === 'spin') {
    // A bar turning on its middle presents a foreshortened ledge: as wide as
    // its own shadow.  Edge-on there is nothing there to land on, and the
    // whole move is waiting for it to come flat again.
    const flat = Math.abs(Math.cos(p.angle));
    if (flat < 0.34) return null;
    const half = (p.w / 2) * flat;
    return { left: p.x - half, right: p.x + half, y: p.y };
  }
  if (p.kind === 'retract') {
    const out = extension(p);
    if (out < 0.28) return null;
    const len = p.w * out;
    return p.side < 0
      ? { left: SHAFT_L, right: SHAFT_L + len, y: p.y }
      : { left: SHAFT_R - len, right: SHAFT_R, y: p.y };
  }
  return { left: p.x - p.w / 2, right: p.x + p.w / 2, y: p.y };
}

/** How far out of the wall a retracting arm is, 0..1, with a hold at each end. */
function extension(p: Plat): number {
  const t = (Math.sin(p.phase) + 1) / 2;
  return Phaser.Math.Clamp((t - 0.15) / 0.7, 0, 1);
}

export const flood: MinigameModule = {
  id: ID,
  title: 'THE FLOOD',
  music: 'game_flood',
  rules: 'climb out before the water gets you',
  payoutNote: 'WIN: 10 TOKENS',
  tutorial: {
    objective: [
      'THE SHAFT IS FLOODING. CLIMB OUT OF IT.',
      'JUMP THE LEDGES UP TO THE HATCH AT THE TOP.',
      'THEY SLIDE, SPIN, RETRACT AND CRUMBLE.',
      'THE WATER TOUCHES YOU AND THE RUN IS OVER.',
    ],
    controls: [
      ['A / D', 'RUN LEFT AND RIGHT'],
      ['ARROWS', 'RUN LEFT AND RIGHT'],
      ['SPACE / W', 'JUMP'],
    ],
  },
  touch: {
    stick: 'lr',
    arrows: true,
    buttons: [{ label: 'JUMP', key: 'SPACE', also: 'W', primary: true }],
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    over = false;
    clock = 0;
    px = GAME_W / 2;
    py = 6;
    vy = 0;
    onGround = true;
    rider = null;
    facing = 1;
    hop = 0;
    camY = -16;
    waterY = WATER_START;
    lastRumble = 0;
    plats = [];
    foam = [];
    bubbles = [];

    paintShaft(scene);
    buildTower(scene);

    // ---- the water.  Drawn as one body with a lit lip and a bit of froth on
    // it, and it is always the last thing between the frog and the bottom.
    water = scene.add.rectangle(SHAFT_L, 0, SHAFT_W, 400, 0x1b4f7a).setOrigin(0, 0).setDepth(30).setAlpha(0.82);
    waterLip = scene.add.rectangle(SHAFT_L, 0, SHAFT_W, 2, 0x7fd4f0).setOrigin(0, 0).setDepth(31);
    for (let i = 0; i < 9; i++) {
      foam.push(scene.add.rectangle(0, 0, 6, 1, PALETTE.cream).setOrigin(0, 0).setDepth(32).setAlpha(0.5));
    }

    frog = makeFrog(scene);

    hud = {
      height: text(scene, 6, 21, '', PALETTE.tealLight).setDepth(60),
      gap: centerText(scene, GAME_W / 2, 21, '', PALETTE.cream).setDepth(60),
      gaugeWater: scene.add.rectangle(GAME_W - 9, 0, 6, 2, 0x7fd4f0).setOrigin(0, 0.5).setDepth(61),
      gaugeYou: scene.add.rectangle(GAME_W - 9, 0, 6, 2, PALETTE.mossLight).setOrigin(0, 0.5).setDepth(61),
      note: centerText(scene, GAME_W / 2, 96, '', PALETTE.gold, 16).setDepth(70).setVisible(false),
    };
    // The gauge: the whole shaft as one column, with the hatch at the top of it.
    scene.add.rectangle(GAME_W - 9, TOP_SY, 6, VIEW_H, PALETTE.ink).setOrigin(0, 0).setDepth(60).setStrokeStyle(1, PALETTE.steel);
    scene.add.rectangle(GAME_W - 9, TOP_SY, 6, 2, PALETTE.gold).setOrigin(0, 0).setDepth(61);

    const kb = scene.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    keys = { left: bind(['A', 'LEFT']), right: bind(['D', 'RIGHT']) };
    for (const k of ['SPACE', 'W', 'UP']) kb?.on(`keydown-${k}`, () => jump());

    draw();
    refreshHud();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__flood = {
        state: () => ({
          clock: Math.round(clock),
          x: Math.round(px),
          height: Math.round(py),
          goal: GOAL_H,
          water: Math.round(waterY),
          /** Seconds of air left at the water's current speed. */
          left: Math.max(0, Math.round((py - waterY) / (WATER_V0 + WATER_ACC * (clock / 1000)))),
          onGround,
          riding: rider ? rider.kind : null,
          kinds: plats.map((p) => p.kind),
          standable: plats.filter((p) => surfaceOf(p) !== null).length,
          over,
        }),
        /** Put the frog where a test needs him, in world coordinates. */
        setPlayer: (x: number, y: number) => {
          px = Phaser.Math.Clamp(x, SHAFT_L + PW / 2, SHAFT_R - PW / 2);
          py = Math.max(0, y);
          vy = 0;
          rider = null;
        },
        setWater: (y: number) => {
          waterY = y;
        },
        jump: () => jump(),
        /**
         * Every step of the tower, with the gap to the one below it — what the
         * generator promised, for a test to hold it to.
         */
        ladder: () =>
          plats.map((p, i) => {
            const prev = plats[i - 1];
            // The gap a jump has to cover, measured edge to edge and at the
            // WORST moment: both ledges pushed as far apart as they travel.
            const near = (a: Plat, b: Plat) => {
              const ar = a.ax + a.w / 2 + a.amp;
              const al = a.ax - a.w / 2 - a.amp;
              const br = b.ax + b.w / 2 + b.amp;
              const bl = b.ax - b.w / 2 - b.amp;
              return bl > ar ? bl - ar : al > br ? al - br : 0;
            };
            return {
              kind: p.kind,
              x: Math.round(p.ax),
              y: Math.round(p.ay),
              w: p.w,
              amp: Math.round(p.amp),
              rise: prev ? Math.round(p.ay - prev.ay) : 0,
              gap: prev ? Math.round(near(prev, p)) : 0,
            };
          }),
        reach: () => ({ apex: Math.round(APEX), run: Math.round(REACH) }),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__flood;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over || !sceneRef) return;
    const dt = Math.min(0.05, delta / 1000);
    clock += delta;

    // ---- the water, and the noise it makes doing it
    const rate = WATER_V0 + WATER_ACC * (clock / 1000);
    waterY += rate * dt;
    if (waterY - lastRumble > 90) {
      lastRumble = waterY;
      audio.sfx('water_rise', 0.4);
    }

    for (const p of plats) tickPlat(p, dt);

    // ---- the frog
    const dx = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    if (dx !== 0) facing = dx;
    px = Phaser.Math.Clamp(px + dx * RUN * dt, SHAFT_L + PW / 2, SHAFT_R - PW / 2);

    const feetWas = py;
    if (rider) {
      const s = surfaceOf(rider);
      const on = s !== null && px + PW / 2 > s.left && px - PW / 2 < s.right;
      if (!on || rider.state === 'gone') {
        rider = null;
      } else {
        // A ledge that moves takes the frog with it, sideways as well as up.
        px = Phaser.Math.Clamp(px + (rider.x - riderX), SHAFT_L + PW / 2, SHAFT_R - PW / 2);
        riderX = rider.x;
        py = s.y;
        vy = 0;
      }
    }
    if (!rider) {
      vy -= GRAVITY * dt;
      py += vy * dt;
    }

    // ---- landing.  Only ever from above, and only on something that is there.
    onGround = false;
    if (rider) {
      onGround = true;
    } else if (vy <= 0) {
      for (const p of plats) {
        const s = surfaceOf(p);
        if (!s) continue;
        if (px + PW / 2 <= s.left || px - PW / 2 >= s.right) continue;
        if (feetWas >= s.y - 1 && py <= s.y) {
          py = s.y;
          vy = 0;
          rider = p;
          riderX = p.x;
          onGround = true;
          audio.sfx('footstep_concrete', 0.3);
          if (p.kind === 'crumble' && p.state === 'solid') {
            p.state = 'going';
            p.timer = 520;
            audio.sfx('crumble', 0.4);
          }
          break;
        }
      }
    }

    // ---- the hatch
    if (py >= GOAL_H - 2) {
      py = GOAL_H;
      finish(true, 'OUT!');
      return;
    }

    // ---- the water, again: it only has to touch him once
    if (py <= waterY + 1) {
      audio.sfx('splash');
      sceneRef.cameras.main.shake(300, 0.01);
      for (let i = 0; i < 10; i++) spawnBubble(px + Phaser.Math.Between(-8, 8), waterY);
      finish(false, 'DROWNED');
      return;
    }

    // ---- camera.  ABOVE the frog, not on him: the next three ledges are the
    // ones being decided about, so they are the ones on screen.  It also never
    // lets the water off the bottom of the picture when it is close.
    // The floor is SIXTEEN BELOW ZERO, not zero: the kerb is at world 0 and a
    // camera that stopped there put the frog's feet on the last row of the
    // screen with his legs off it.
    const want = Math.max(-16, py - VIEW_H * 0.34);
    camY += (want - camY) * Math.min(1, dt * 5);
    camY = Math.min(camY, Math.max(-16, waterY - 8));

    hop = onGround ? 0 : hop + dt * 9;
    tickBubbles(dt);
    draw();
    refreshHud();
  },

  destroy() {
    plats = [];
    foam = [];
    bubbles = [];
    frog = null;
    water = null;
    waterLip = null;
    hatch = null;
    hatchGlow = null;
    hud = null;
    keys = {};
    sceneRef = null;
    apiRef = null;
  },
};

// ------------------------------------------------------------------ the tower

/**
 * Build a climbable tower, at random, that is guaranteed to be climbable.
 *
 * Every ledge is placed relative to the one below it inside the arc a jump
 * actually covers: no more than `APEX` minus a margin above it, and no further
 * sideways than a run can carry you while you are in the air.  A ledge that
 * MOVES is checked against its worst case rather than its anchor — the moment
 * it is furthest from where you are standing — so a slide never places itself
 * out of reach at the wrong half of its stroke.
 *
 * The kinds are drawn from a bag that gets nastier as the tower goes up, so
 * the first few ledges teach and the last few test.  Two moving ledges never
 * follow one another: a jump from a thing that is moving onto a thing that is
 * moving is not difficulty, it is a coin toss.
 */
function buildTower(scene: Phaser.Scene): void {
  const maxRise = APEX - 9; // 34: comfortably inside the arc
  const roof = GOAL_H - 14;
  let prevKind: Kind = 'static';
  let x = GAME_W / 2;
  let y = 0;

  // The kerb: the whole width of the shaft, at the waterline, so the run
  // starts on something solid and the first jump is a jump and not a fall.
  push(scene, 'static', GAME_W / 2, 0, SHAFT_W, 0, 1);

  for (let i = 0; y + maxRise < roof && i < 80; i++) {
    const t = Phaser.Math.Clamp(y / roof, 0, 1);
    const rise = Phaser.Math.Between(Math.round(maxRise * 0.62), Math.round(maxRise));
    y += rise;

    const moving = prevKind === 'slide' || prevKind === 'rise' || prevKind === 'spin';
    const kind = pickKind(t, moving);
    const w = kind === 'spin' ? Phaser.Math.Between(40, 56) : Phaser.Math.Between(kind === 'crumble' ? 22 : 26, 46);
    // How far this ledge can wander from its anchor, and therefore how much of
    // the jump's reach it has already spent before the frog even leaves.
    const amp = kind === 'slide' ? Phaser.Math.Between(14, 34) : kind === 'rise' ? Phaser.Math.Between(10, 20) : 0;
    const spend = kind === 'slide' ? amp : 0;
    const room = Math.max(14, REACH - spend - w * 0.2);

    let nx: number;
    if (kind === 'retract') {
      // An arm out of a wall.  Only its TIP is reachable, and the tip is set
      // by how long the arm is — so the arm is grown until the tip is inside
      // the jump, rather than the ledge being placed and hoped about.  If even
      // a full-length arm cannot be reached from here, it does not get built.
      const prev = plats[plats.length - 1];
      const prevL = prev.ax - prev.w / 2 - prev.amp;
      const prevR = prev.ax + prev.w / 2 + prev.amp;
      const side: -1 | 1 = x < GAME_W / 2 ? -1 : 1;
      const need = side < 0 ? prevL - REACH - SHAFT_L : SHAFT_R - prevR - REACH;
      const maxArm = SHAFT_W * 0.62;
      if (need > maxArm) {
        // Out of reach from this wall at any length: a plain ledge instead.
        const lo = Math.max(SHAFT_L + w / 2, x - REACH);
        const hi = Math.min(SHAFT_R - w / 2, x + REACH);
        nx = lo >= hi ? Phaser.Math.Clamp(x, SHAFT_L + w / 2, SHAFT_R - w / 2) : Phaser.Math.Between(lo, hi);
        push(scene, 'static', nx, y, w, 0, 1);
        x = nx;
        prevKind = 'static';
        continue;
      }
      const arm = Phaser.Math.Clamp(Math.max(w, Math.ceil(need) + 6), 26, maxArm);
      nx = side < 0 ? SHAFT_L + arm / 2 : SHAFT_R - arm / 2;
      push(scene, kind, nx, y, arm, 0, side);
    } else {
      const lo = Math.max(SHAFT_L + w / 2 + amp, x - room);
      const hi = Math.min(SHAFT_R - w / 2 - amp, x + room);
      nx = lo >= hi ? Phaser.Math.Clamp(x, SHAFT_L + w / 2 + amp, SHAFT_R - w / 2 - amp) : Phaser.Math.Between(lo, hi);
      push(scene, kind, nx, y, w, amp, 1);
    }
    x = nx;
    prevKind = kind;
  }

  // The hatch, one legal jump above the last ledge, with a landing under it
  // you cannot miss: static, wide, and directly over where you took off from.
  const top = plats[plats.length - 1];
  push(scene, 'static', Phaser.Math.Clamp(top.ax, SHAFT_L + 28, SHAFT_R - 28), roof, 54, 0, 1);
  hatchGlow = scene.add.rectangle(top.ax, 0, 30, 26, PALETTE.gold).setDepth(19).setAlpha(0.18);
  hatch = scene.add.rectangle(top.ax, 0, 22, 20, 0x2b1c10).setDepth(20).setStrokeStyle(2, PALETTE.gold);
  scene.tweens.add({ targets: hatchGlow, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
}

/** The bag of ledge kinds, getting nastier the higher the tower goes. */
function pickKind(t: number, afterMover: boolean): Kind {
  const bag: Kind[] = ['static', 'static'];
  if (t > 0.1) bag.push('slide');
  if (t > 0.2) bag.push('crumble');
  if (t > 0.3) bag.push('retract', 'rise');
  if (t > 0.45) bag.push('spin', 'slide');
  if (t > 0.65) bag.push('spin', 'crumble', 'retract');
  const pick = bag[Phaser.Math.Between(0, bag.length - 1)];
  // Never two movers in a row: a moving take-off onto a moving landing is a
  // coin toss, not a jump.
  if (afterMover && (pick === 'slide' || pick === 'rise' || pick === 'spin')) return 'static';
  return pick;
}

function push(scene: Phaser.Scene, kind: Kind, x: number, y: number, w: number, amp: number, side: -1 | 1): void {
  const colour =
    kind === 'crumble'
      ? PALETTE.rust
      : kind === 'spin'
        ? PALETTE.violet
        : kind === 'retract'
          ? PALETTE.steel
          : kind === 'static'
            ? PALETTE.brown
            : PALETTE.tealDark;
  const art = scene.add.rectangle(x, 0, w, 6, colour).setDepth(12);
  const lip = scene.add.rectangle(x, 0, w, 2, PALETTE.bone).setDepth(13).setAlpha(0.55);
  plats.push({
    kind,
    ax: x,
    ay: y,
    w,
    x,
    y,
    amp,
    rate: Phaser.Math.FloatBetween(0.7, 1.5),
    phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
    angle: Phaser.Math.FloatBetween(0, Math.PI),
    side,
    state: 'solid',
    timer: 0,
    art,
    lip,
  });
}

function tickPlat(p: Plat, dt: number): void {
  p.phase += p.rate * dt;
  switch (p.kind) {
    case 'slide':
      p.x = p.ax + Math.sin(p.phase) * p.amp;
      break;
    case 'rise':
      p.y = p.ay + Math.sin(p.phase) * p.amp;
      break;
    case 'spin':
      p.angle += p.rate * 1.1 * dt;
      break;
    case 'retract': {
      const len = p.w * extension(p);
      p.x = p.side < 0 ? SHAFT_L + len / 2 : SHAFT_R - len / 2;
      break;
    }
    case 'crumble':
      if (p.state === 'going') {
        p.timer -= dt * 1000;
        if (p.timer <= 0) {
          p.state = 'gone';
          p.timer = 2600;
        }
      } else if (p.state === 'gone') {
        p.timer -= dt * 1000;
        if (p.timer <= 0) p.state = 'solid';
      }
      break;
    default:
      break;
  }
}

// ------------------------------------------------------------------ the frog

function jump(): void {
  if (over || !onGround) return;
  vy = JUMP_V;
  rider = null;
  onGround = false;
  audio.sfx('hop_wet', 0.5);
}

// ------------------------------------------------------------------ drawing

function paintShaft(scene: Phaser.Scene): void {
  scene.add.rectangle(0, 18, GAME_W, 162, 0x0d1420).setOrigin(0, 0);
  scene.add.rectangle(0, 18, WALL, 162, 0x1a2334).setOrigin(0, 0);
  scene.add.rectangle(GAME_W - WALL, 18, WALL, 162, 0x1a2334).setOrigin(0, 0);
  // brickwork down both walls, and a wet sheen on the inside faces
  for (let i = 0; i < 40; i++) {
    const y = 20 + ((i * 29) % 158);
    scene.add.rectangle((i % 2) * 5 + 2, y, 8, 2, 0x243049).setOrigin(0, 0);
    scene.add.rectangle(GAME_W - 12 - (i % 2) * 5, y + 6, 8, 2, 0x243049).setOrigin(0, 0);
  }
  scene.add.rectangle(WALL - 1, 18, 1, 162, 0x3f5a7a).setOrigin(0, 0).setAlpha(0.6);
  scene.add.rectangle(GAME_W - WALL, 18, 1, 162, 0x3f5a7a).setOrigin(0, 0).setAlpha(0.6);
}

function spawnBubble(x: number, y: number): void {
  if (!sceneRef || bubbles.length > 26) return;
  const art = sceneRef.add.circle(0, 0, Phaser.Math.Between(1, 2), 0xbfe9fb).setDepth(33).setAlpha(0.7);
  bubbles.push({ art, y, vy: Phaser.Math.FloatBetween(8, 22) });
  art.setPosition(x, sy(y));
}

function tickBubbles(dt: number): void {
  for (const b of bubbles) {
    b.y += b.vy * dt;
    b.art.setAlpha(Math.max(0, b.art.alpha - dt * 0.7));
  }
  bubbles = bubbles.filter((b) => {
    if (b.art.alpha > 0.02) return true;
    b.art.destroy();
    return false;
  });
  // A steady few coming off the surface, so the water is never a still block.
  if (sceneRef && Math.random() < 0.12) {
    spawnBubble(Phaser.Math.Between(SHAFT_L + 4, SHAFT_R - 4), waterY - Phaser.Math.Between(2, 14));
  }
}

function draw(): void {
  for (const p of plats) {
    const top = sy(p.y);
    const inView = top > TOP_SY - 14 && top < FLOOR_SY + 14;
    // A LEDGE IS ALWAYS DRAWN AS THE OBJECT IT IS, not as the surface it
    // currently offers.  A bar edge-on and an arm halfway into its wall carry
    // no weight, but you have to be able to WATCH them to time the jump; a
    // ledge that vanished when it stopped being standable would be asking the
    // player to learn a rhythm they cannot see.  Only a crumbled one is
    // genuinely gone, and even that leaves its outline so you know it returns.
    const gone = p.kind === 'crumble' && p.state === 'gone';
    p.art.setVisible(inView && !gone);
    p.lip.setVisible(inView && !gone);
    if (!inView) continue;
    if (gone) continue;

    if (p.kind === 'spin') {
      p.art.setPosition(p.x, top).setSize(p.w, 6).setRotation(p.angle);
      p.lip.setPosition(p.x, top).setSize(p.w, 2).setRotation(p.angle);
      // Solid when it will hold you, hollow when it will not: the same bar,
      // and the difference is the whole timing of the jump.
      const flat = Math.abs(Math.cos(p.angle));
      p.art.setAlpha(flat < 0.34 ? 0.35 : 1);
      p.lip.setAlpha(flat < 0.34 ? 0.2 : 0.55);
    } else if (p.kind === 'retract') {
      const len = Math.max(4, p.w * extension(p));
      const cx = p.side < 0 ? SHAFT_L + len / 2 : SHAFT_R - len / 2;
      p.art.setPosition(cx, top + 3).setSize(len, 6).setRotation(0);
      p.lip.setPosition(cx, top).setSize(len, 2).setRotation(0);
      const out = extension(p);
      p.art.setAlpha(out < 0.28 ? 0.4 : 1);
      p.lip.setAlpha(out < 0.28 ? 0.2 : 0.55);
    } else {
      p.art.setPosition(p.x, top + 3).setSize(p.w, 6).setRotation(0).setAlpha(1);
      p.lip.setPosition(p.x, top).setSize(p.w, 2).setRotation(0).setAlpha(0.55);
    }
    // A ledge about to go says so: it flashes for the half second it has left.
    const doomed = p.kind === 'crumble' && p.state === 'going';
    p.art.setFillStyle(doomed && Math.floor(p.timer / 90) % 2 === 0 ? PALETTE.blood : platColour(p));
  }

  const wTop = sy(waterY);
  water?.setPosition(SHAFT_L, wTop).setSize(SHAFT_W, Math.max(0, FLOOR_SY + 200 - wTop));
  waterLip?.setPosition(SHAFT_L, wTop);
  foam.forEach((f, i) => {
    const t = clock / 260 + i;
    f.setPosition(SHAFT_L + 6 + i * (SHAFT_W - 12) / foam.length, wTop - 1 + Math.sin(t) * 1.5);
    f.setVisible(wTop > TOP_SY && wTop < FLOOR_SY + 4);
  });
  for (const b of bubbles) b.art.setY(sy(b.y));

  hatch?.setPosition(hatch.x, sy(GOAL_H + 4));
  hatchGlow?.setPosition(hatch?.x ?? GAME_W / 2, sy(GOAL_H + 4));
  const hv = sy(GOAL_H) > TOP_SY - 20 && sy(GOAL_H) < FLOOR_SY + 20;
  hatch?.setVisible(hv);
  hatchGlow?.setVisible(hv);

  if (frog) {
    frog.setPosition(px, sy(py));
    frog.setVisible(frog.y > TOP_SY - 4 && frog.y < FLOOR_SY + 10);
    const squash = Math.sin(hop) * 0.13;
    frog.setScale(facing * (1 - squash), 1 + squash);
  }
}

function platColour(p: Plat): number {
  switch (p.kind) {
    case 'crumble':
      return PALETTE.rust;
    case 'spin':
      return PALETTE.violet;
    case 'retract':
      return PALETTE.steel;
    case 'static':
      return PALETTE.brown;
    default:
      return PALETTE.tealDark;
  }
}

function refreshHud(): void {
  if (!hud) return;
  hud.height.setText(`UP ${Math.max(0, Math.round(py))} / ${GOAL_H}`);

  // The one number that matters: how long before the water is where you are.
  const rate = WATER_V0 + WATER_ACC * (clock / 1000);
  const secs = Math.max(0, (py - waterY) / rate);
  hud.gap.setText(`WATER IN ${secs.toFixed(0)}s`);
  hud.gap.setTint(secs < 4 ? PALETTE.blood : secs < 9 ? PALETTE.amber : PALETTE.cream);

  // And the same thing as a picture: the shaft end to end, the water climbing
  // it, and the frog somewhere in between.
  const at = (wy: number) => TOP_SY + VIEW_H * (1 - Phaser.Math.Clamp(wy / GOAL_H, 0, 1));
  hud.gaugeWater.setPosition(GAME_W - 9, at(waterY)).setSize(6, Math.max(2, FLOOR_SY - at(waterY)));
  hud.gaugeWater.setOrigin(0, 0);
  hud.gaugeYou.setPosition(GAME_W - 11, at(py)).setSize(10, 2).setOrigin(0, 0.5);
}

function finish(won: boolean, why: string): void {
  if (over || !sceneRef) return;
  over = true;
  hud?.note.setText(why).setVisible(true);
  hud?.note.setTint(won ? PALETTE.gold : PALETTE.blood);
  audio.sfx(won ? 'chime' : 'buzzer');
  if (won) sceneRef.cameras.main.flash(240, 255, 240, 180);
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
  return scene.add.container(0, 0, parts).setDepth(25);
}
