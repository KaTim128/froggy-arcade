/**
 * THE FLOOD.  Hard (long) — 7 tokens in, 15 out.
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

type Kind = 'static' | 'slide' | 'rise' | 'spin' | 'retract' | 'crumble' | 'orbit';

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
  /** Spin and orbit only, in radians. */
  angle: number;
  /** Orbit only: how far out from its anchor it swings. */
  radius: number;
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
  if (p.kind === 'orbit') {
    // A ledge going round a post.  It is always solid — the difficulty is
    // WHERE it is, not whether it is there — so the only question is the same
    // one every ledge answers: how wide is it and where is it right now.
    return { left: p.x - p.w / 2, right: p.x + p.w / 2, y: p.y };
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
  payoutNote: 'WIN: 15 TOKENS',
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
          /** How many layouts the route checker threw away before this one. */
          tries: layoutTries,
          fallback: layoutFallback,
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
         * Every ledge in the built tower, anchor and travel both.
         *
         * `rise` and `gap` are to the ledge BEFORE it in the list, which is
         * useful to read and is NOT the climb: ledges are scattered inside the
         * jump rather than threaded one under the next, so the route is a path
         * through the graph and not the list in order.  A harness that wants
         * to know whether the tower goes anywhere walks it with `leap`/`span`
         * from `reach()`, the way `routeExists` does.
         */
        ladder: () =>
          plats.map((p, i) => {
            const prev = plats[i - 1];
            // How far either side of its anchor a ledge's surface ever gets.
            const span = (q: Plat) => q.w / 2 + q.amp + (q.kind === 'orbit' ? q.radius : 0);
            const near = (a: Plat, b: Plat) => {
              const ar = a.ax + span(a);
              const al = a.ax - span(a);
              const br = b.ax + span(b);
              const bl = b.ax - span(b);
              return bl > ar ? bl - ar : al > br ? al - br : 0;
            };
            return {
              kind: p.kind,
              x: Math.round(p.ax),
              y: Math.round(p.ay),
              w: p.w,
              amp: Math.round(p.amp),
              radius: Math.round(p.radius),
              // How far the surface can be from the anchor, up or down.
              slop: Math.round(p.kind === 'rise' ? p.amp : p.kind === 'orbit' ? p.radius * 0.5 : 0),
              rise: prev ? Math.round(p.ay - prev.ay) : 0,
              gap: prev ? Math.round(near(prev, p)) : 0,
            };
          }),
        reach: () => ({ apex: Math.round(APEX), run: Math.round(REACH), leap: Math.round(LEAP), span: Math.round(SPAN) }),
        /**
         * Generate and check N layouts WITHOUT building any of them, so the
         * harness can prove the validator rejects what it should and that a
         * valid tower is what actually gets built.
         */
        audit: (n: number) => {
          let valid = 0;
          const kinds = new Set<string>();
          for (let i = 0; i < n; i++) {
            const specs = generate();
            if (routeExists(specs)) valid++;
            for (const sp of specs) kinds.add(sp.kind);
          }
          return { of: n, valid, kinds: [...kinds] };
        },
        /** And that the checker says NO to something genuinely unclimbable. */
        auditBroken: () =>
          routeExists([
            { kind: 'static', x: 160, y: 0, w: 60, amp: 0, radius: 0, side: 1 },
            { kind: 'static', x: 160, y: 400, w: 20, amp: 0, radius: 0, side: 1 },
          ]),
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
/** A ledge before it has any art: what the generator makes and the checker reads. */
interface Spec {
  kind: Kind;
  x: number;
  y: number;
  w: number;
  amp: number;
  radius: number;
  side: -1 | 1;
}

/**
 * What a jump is allowed to be asked to cover.
 *
 * `LEAP` is a shade under the real apex, so the frog is never required to
 * graze a ledge at the exact top of his arc, and `SPAN` is the sideways half
 * of the same thing.  Every reachability question in this file is asked
 * against these two numbers and nothing else.
 */
const LEAP = APEX - 5;
const SPAN = REACH;

/** How far a ledge's surface can be from its anchor, at the worst moment. */
function reachSpan(sp: Spec): number {
  return sp.w / 2 + sp.amp + (sp.kind === 'orbit' ? sp.radius : 0);
}

/** The horizontal gap between two ledges AT THEIR WORST — furthest apart. */
function worstGap(a: Spec, b: Spec): number {
  const aL = a.x - reachSpan(a);
  const aR = a.x + reachSpan(a);
  const bL = b.x - reachSpan(b);
  const bR = b.x + reachSpan(b);
  return bL > aR ? bL - aR : aL > bR ? aL - bR : 0;
}

/** How far a ledge's surface can be from its anchor vertically, worst case. */
function slop(sp: Spec): number {
  return (sp.kind === 'rise' ? sp.amp : 0) + (sp.kind === 'orbit' ? sp.radius * 0.5 : 0);
}

/** The vertical gap, worst case: take-off at its lowest, landing at its highest. */
function worstRise(a: Spec, b: Spec): number {
  return b.y + slop(b) - (a.y - slop(a));
}

/**
 * IS THERE A WAY UP THIS TOWER?
 *
 * Not "is each ledge reachable from the one below it" — that was the old rule,
 * and it only ever allowed a single-file staircase.  This asks the real
 * question of the whole shaft as a graph: from the kerb, which ledges can be
 * jumped to; from those, which; and does the hatch's landing ever come up.
 * A generator that makes a mess is allowed to, as long as SOME line through
 * the mess goes all the way — and that is what lets the towers get hard.
 *
 * Every edge is measured at the WORST moment of both ledges, so a route that
 * exists here exists whatever phase everything happens to be in.
 */
export function routeExists(specs: Spec[]): boolean {
  const n = specs.length;
  if (n < 2) return false;
  const seen = new Array(n).fill(false);
  const queue = [0];
  seen[0] = true;
  while (queue.length) {
    const i = queue.shift() as number;
    if (i === n - 1) return true;
    for (let j = 0; j < n; j++) {
      if (seen[j]) continue;
      const rise = worstRise(specs[i], specs[j]);
      // Up, and not further up than a jump goes.  Dropping to something lower
      // is always allowed; it is just not how anybody gets out.
      if (rise > LEAP || rise < -140) continue;
      if (worstGap(specs[i], specs[j]) > SPAN) continue;
      seen[j] = true;
      queue.push(j);
    }
  }
  return false;
}

/**
 * Lay out a tower, at random, as hard as the height it has reached.
 *
 * Deliberately looser than the old chain: ledges are scattered inside the jump
 * rather than threaded one under the next, they get smaller and more awkward
 * the higher it goes, and above the halfway mark two moving ledges may follow
 * one another — the single biggest difficulty lever on the table, and the
 * reason the top third of the shaft is a different game from the bottom.
 *
 * Nothing here promises the result is climbable.  `routeExists` decides that,
 * and `buildTower` throws away anything that fails.
 */
function generate(): Spec[] {
  const roof = GOAL_H - 14;
  const specs: Spec[] = [
    // The kerb: the whole width of the shaft, so the run starts on something
    // solid and the first jump is a jump and not a fall.
    { kind: 'static', x: GAME_W / 2, y: 0, w: SHAFT_W, amp: 0, radius: 0, side: 1 },
  ];
  let x = GAME_W / 2;
  let y = 0;
  let prevKind: Kind = 'static';

  // Keep stacking while the hatch's landing is still out of reach of the last
  // ledge placed — measured with that ledge's own travel, because a take-off
  // that bobs downward spends part of the jump before the frog leaves it.  Get
  // this wrong and the FINAL hop is the one that cannot be made, which
  // `routeExists` then has to reject the whole tower over.
  for (let i = 0; y + LEAP - slop(specs[specs.length - 1]) < roof && i < 90; i++) {
    const t = Phaser.Math.Clamp(y / roof, 0, 1);
    const prev = specs[specs.length - 1];

    // WHAT it is comes first, because what it is decides how much of the jump
    // it has already spent before the frog leaves the ground.
    const moving = prevKind === 'slide' || prevKind === 'rise' || prevKind === 'spin' || prevKind === 'orbit';
    let kind = pickKind(t, moving);
    // Higher is narrower: a 46-pixel ledge at the bottom is a landing, a
    // 17-pixel one at the top is a target.
    const wide = Math.round(Phaser.Math.Linear(46, 30, t));
    const narrow = Math.round(Phaser.Math.Linear(26, 17, t));
    let w =
      kind === 'spin'
        ? Phaser.Math.Between(36, 52)
        : Phaser.Math.Between(kind === 'crumble' ? narrow - 3 : narrow, wide);
    let amp =
      kind === 'slide'
        ? Phaser.Math.Between(16, 26 + Math.round(t * 18))
        : kind === 'rise'
          ? Phaser.Math.Between(10, 16 + Math.round(t * 12))
          : 0;
    let radius = kind === 'orbit' ? Phaser.Math.Between(16, 22 + Math.round(t * 12)) : 0;

    // THE RISE IS WHAT IS LEFT OF THE JUMP.  A ledge that bobs and a take-off
    // that bobs each eat into the height a jump can still cover, so the gap is
    // budgeted from what remains rather than picked and hoped about — which is
    // exactly the bug the route checker caught when it was picked first.
    const here: Spec = { kind, x, y, w, amp, radius, side: 1 };
    let budget = LEAP - slop(prev) - slop(here);
    if (budget < 10) {
      // Two bobbing ledges in a row with no height left between them: this one
      // stands still instead, which is the only honest way to keep the climb.
      kind = 'static';
      amp = 0;
      radius = 0;
      w = Phaser.Math.Between(narrow, wide);
      here.kind = kind;
      here.amp = 0;
      here.radius = 0;
      here.w = w;
      budget = LEAP - slop(prev);
    }
    const rise = Phaser.Math.Between(Math.round(budget * 0.62), Math.round(budget));
    y += rise;
    here.y = y;

    // AND THE SIDEWAYS ROOM IS WHAT THE TWO LEDGES BETWEEN THEM REACH.  The
    // gap a jump has to cover is measured edge to edge, so two wide ledges may
    // stand much further apart by their middles than two narrow ones.
    const room = Math.max(12, SPAN + reachSpan(prev) + reachSpan(here) - 6);

    if (kind === 'retract') {
      const span = reachSpan(prev);
      const side: -1 | 1 = x < GAME_W / 2 ? -1 : 1;
      const need = side < 0 ? prev.x - span - SPAN - SHAFT_L : SHAFT_R - (prev.x + span) - SPAN;
      const maxArm = SHAFT_W * 0.62;
      if (need > maxArm) {
        const nx = Phaser.Math.Clamp(
          Phaser.Math.Between(Math.round(x - room), Math.round(x + room)),
          SHAFT_L + w / 2,
          SHAFT_R - w / 2,
        );
        specs.push({ kind: 'static', x: nx, y, w, amp: 0, radius: 0, side: 1 });
        x = nx;
        prevKind = 'static';
        continue;
      }
      const arm = Phaser.Math.Clamp(Math.max(w, Math.ceil(need) + 6), 26, maxArm);
      const nx = side < 0 ? SHAFT_L + arm / 2 : SHAFT_R - arm / 2;
      specs.push({ kind, x: nx, y, w: arm, amp: 0, radius: 0, side });
      x = nx;
      prevKind = kind;
      continue;
    }

    const half = w / 2 + amp + radius;
    const loX = Math.max(SHAFT_L + half, x - room);
    const hiX = Math.min(SHAFT_R - half, x + room);
    const nx =
      loX >= hiX ? Phaser.Math.Clamp(x, SHAFT_L + half, SHAFT_R - half) : Phaser.Math.Between(loX, hiX);
    specs.push({ kind, x: nx, y, w, amp, radius, side: 1 });
    x = nx;
    prevKind = kind;
  }

  // The hatch's landing, one legal jump above the last ledge: static, wide and
  // over where you took off from, because the last thing this game should take
  // from you is the run you just made.
  const top = specs[specs.length - 1];
  specs.push({
    kind: 'static',
    x: Phaser.Math.Clamp(top.x, SHAFT_L + 28, SHAFT_R - 28),
    y: roof,
    w: 54,
    amp: 0,
    radius: 0,
    side: 1,
  });
  return specs;
}

/** Tries before the generator is told to stop being clever.  See below. */
const LAYOUT_TRIES = 40;
/** What the last build actually cost, for the harness and the dev bridge. */
let layoutTries = 0;
let layoutFallback = false;

/**
 * Build a tower that can actually be climbed.
 *
 * Generate, CHECK, and throw it away if the check fails — up to forty times.
 * If forty in a row somehow failed, the last resort is a deliberately tame
 * layout: a plain staircase of static ledges built to a rule that cannot fail.
 * Shipping an unwinnable shaft to somebody who has just paid seven tokens is
 * not an option.  Shipping a dull one, once in a blue moon, is.
 */
function buildTower(scene: Phaser.Scene): void {
  layoutFallback = false;
  for (let attempt = 1; attempt <= LAYOUT_TRIES; attempt++) {
    const specs = generate();
    if (routeExists(specs)) {
      layoutTries = attempt;
      paint(scene, specs);
      return;
    }
  }
  layoutTries = LAYOUT_TRIES;
  layoutFallback = true;
  paint(scene, staircase());
}

/** The last resort: a plain, wide, boring staircase.  It always goes up. */
function staircase(): Spec[] {
  const roof = GOAL_H - 14;
  const specs: Spec[] = [{ kind: 'static', x: GAME_W / 2, y: 0, w: SHAFT_W, amp: 0, radius: 0, side: 1 }];
  let y = 0;
  let x = GAME_W / 2;
  let dir: 1 | -1 = 1;
  while (y + LEAP < roof) {
    y += Math.round(LEAP * 0.7);
    const nx = Phaser.Math.Clamp(x + dir * 40, SHAFT_L + 24, SHAFT_R - 24);
    if (nx === x) dir = (dir === 1 ? -1 : 1) as 1 | -1;
    x = Phaser.Math.Clamp(x + dir * 40, SHAFT_L + 24, SHAFT_R - 24);
    specs.push({ kind: 'static', x, y, w: 44, amp: 0, radius: 0, side: 1 });
  }
  specs.push({ kind: 'static', x, y: roof, w: 54, amp: 0, radius: 0, side: 1 });
  return specs;
}

function paint(scene: Phaser.Scene, specs: Spec[]): void {
  for (const sp of specs) push(scene, sp.kind, sp.x, sp.y, sp.w, sp.amp, sp.side, sp.radius);
  const top = specs[specs.length - 1];
  hatchGlow = scene.add.rectangle(top.x, 0, 30, 26, PALETTE.gold).setDepth(19).setAlpha(0.18);
  hatch = scene.add.rectangle(top.x, 0, 22, 20, 0x2b1c10).setDepth(20).setStrokeStyle(2, PALETTE.gold);
  scene.tweens.add({ targets: hatchGlow, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
}

/**
 * The bag, getting nastier the higher the tower goes.
 *
 * The bottom third teaches — mostly plain ledges with one thing moving — and
 * the top third tests: small, crumbling, turning, orbiting, and above the
 * halfway mark two moving ledges may follow one another, which is the jump
 * this game is really about.
 */
function pickKind(t: number, afterMover: boolean): Kind {
  const bag: Kind[] = ['static', 'static'];
  if (t > 0.08) bag.push('slide');
  if (t > 0.16) bag.push('crumble');
  if (t > 0.24) bag.push('retract', 'rise');
  if (t > 0.34) bag.push('spin', 'slide', 'orbit');
  if (t > 0.52) bag.push('spin', 'crumble', 'orbit', 'retract');
  if (t > 0.7) bag.push('crumble', 'orbit', 'slide', 'spin');
  const pick = bag[Phaser.Math.Between(0, bag.length - 1)];
  const mover = pick === 'slide' || pick === 'rise' || pick === 'spin' || pick === 'orbit';
  // Below the halfway mark a moving take-off onto a moving landing is a coin
  // toss.  Above it, it is the game.
  if (afterMover && mover && t < 0.5) return 'static';
  return pick;
}

function push(
  scene: Phaser.Scene,
  kind: Kind,
  x: number,
  y: number,
  w: number,
  amp: number,
  side: -1 | 1,
  radius = 0,
): void {
  const colour = KIND_COLOUR[kind];
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
    angle: Phaser.Math.FloatBetween(0, Math.PI * 2),
    radius,
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
    case 'orbit':
      p.angle += p.rate * 0.8 * dt;
      p.x = p.ax + Math.cos(p.angle) * p.radius;
      p.y = p.ay + Math.sin(p.angle) * p.radius * 0.5;
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

/**
 * One colour per kind, in one place.
 *
 * A player learns this table in the first ten seconds and then reads the whole
 * shaft with it: brown holds, teal moves, purple turns, pink goes round, grey
 * comes out of the wall, rust is about to go.
 */
const KIND_COLOUR: Record<Kind, number> = {
  static: PALETTE.brown,
  slide: PALETTE.tealDark,
  rise: PALETTE.tealDark,
  spin: PALETTE.violet,
  orbit: PALETTE.neon,
  retract: PALETTE.steel,
  crumble: PALETTE.rust,
};

function platColour(p: Plat): number {
  return KIND_COLOUR[p.kind];
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
