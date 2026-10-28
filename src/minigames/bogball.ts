/**
 * BOG BALL.  Medium -- 5 tokens in, 10 out.
 *
 * Football in a swamp, played with a slingshot.  Three frogs a side on a
 * mossy marsh walled in cobblestone: GREEN (you) on the left, RED (the
 * machine) on the right, and between them a great boulder of mud.  Turn
 * about, each side picks ONE of its frogs, pulls it back like a rubber band
 * and lets go; everything on the pitch slides, bumps and settles, and only
 * when it has all come to a stop does the other side get its go.  Knock the
 * boulder through the glowing rune arch at the far end and it is a goal.
 *
 * TEN SHOTS EACH.  Most goals when they are used up wins; level, and it goes
 * to sudden death -- a few more shots each, first goal wins -- and level
 * after that is a draw, which hands the tokens back.
 *
 * THE PHYSICS is rigid circles: frogs, ball, the posts of the arches, and
 * the walls as line segments.  Momentum passes between them on contact with
 * a little bounce lost each time, and the bog drags everything to a stop.
 * The machine aims by trying its shots out first -- every frog, a spread of
 * angles and powers, played forward on the same physics -- and throws the
 * one that does it most good, with a slightly unsteady hand.
 *
 * THE LOOK is the dark, rugged, volcanic one: a pitch of moss and cracked
 * earth with standing water in it, jagged cobblestones round the edge with
 * embers in their cracks, ancient stone arches for goals with blue (yours to
 * defend) and orange (his) runes and a portal swirling in each mouth, toads
 * with warty mossy skin against frogs of cracked obsidian with magma showing
 * through, and a ball of mud that sheds clods and leaves tracks when it is
 * going fast.  Every texture is painted procedurally, once, into a canvas.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

// ------------------------------------------------------------------ layout

const HUD_Y = 19;
const P = { l: 24, r: 296, t: 37, b: 176 };
const CY = (P.t + P.b) / 2;
/** Half the height of a goal mouth, and how deep the goal box behind it is. */
const MOUTH = 21;
const BOX_D = 18;
/** How far past the line the ball's centre has to be. */
const GOAL_IN = 4;

// ------------------------------------------------------------------ rules

export const SHOTS_EACH = 10;
const SUDDEN_EACH = 3;
const FROG_R = 7;
const BALL_R = 10;
const FROG_M = 1;
const BALL_M = 1.7;
/** Pull this far back for full power. */
// (short enough that a frog right up against the wall can still be pulled
// back all the way: at 56 the edge of the screen stopped the finger first)
const PULL_MAX = 34;
const LAUNCH_MAX = 440;
/** The bog: a steady drag plus one that grows with speed. */
const MU_FROG = 120;
const MU_BALL = 90;
const DRAG = 0.85;
const E_BODY = 0.86;
const E_WALL = 0.72;
const STOP_V = 5;
const STEP = 1 / 240;

type Team = 'green' | 'red';
type Phase = 'aim' | 'think' | 'pull' | 'moving' | 'goal' | 'over';

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  m: number;
  team: Team | null;
  /** Static: the arch posts. */
  fixed?: boolean;
}

interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

// The walls: the pitch's four sides, broken at each end by a goal mouth that
// opens into a shallow box.
const WALLS: Seg[] = (() => {
  const s: Seg[] = [];
  const seg = (ax: number, ay: number, bx: number, by: number) => s.push({ ax, ay, bx, by });
  seg(P.l, P.t, P.r, P.t);
  seg(P.l, P.b, P.r, P.b);
  for (const [x, back] of [[P.l, P.l - BOX_D], [P.r, P.r + BOX_D]] as const) {
    seg(x, P.t, x, CY - MOUTH);
    seg(x, CY + MOUTH, x, P.b);
    seg(back, CY - MOUTH, back, CY + MOUTH);
    seg(x, CY - MOUTH, back, CY - MOUTH);
    seg(x, CY + MOUTH, back, CY + MOUTH);
  }
  return s;
})();
const POSTS: Body[] = [P.l, P.r].flatMap((x) => [
  { x, y: CY - MOUTH, vx: 0, vy: 0, r: 3, m: 1e9, team: null, fixed: true },
  { x, y: CY + MOUTH, vx: 0, vy: 0, r: 3, m: 1e9, team: null, fixed: true },
]);

const KICKOFF: Record<Team, Array<[number, number]>> = {
  green: [[P.l + 46, CY], [P.l + 84, CY - 36], [P.l + 84, CY + 36]],
  red: [[P.r - 46, CY], [P.r - 84, CY - 36], [P.r - 84, CY + 36]],
};

// ------------------------------------------------------------------ physics

/** One step of the bog: move, drag, bounce off each other and the walls. */
function physicsStep(bodies: Body[], dt: number): void {
  for (const b of bodies) {
    if (b.fixed) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 0) {
      const mu = b.team ? MU_FROG : MU_BALL;
      const ns = Math.max(0, sp - (mu + DRAG * sp) * dt);
      b.vx *= ns / sp;
      b.vy *= ns / sp;
    }
  }
  const all = bodies.concat(POSTS);
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rr = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const ia = a.fixed ? 0 : 1 / a.m;
      const ib = b.fixed ? 0 : 1 / b.m;
      // push them apart, the lighter one further
      const over = rr - d;
      a.x -= nx * over * (ia / (ia + ib));
      a.y -= ny * over * (ia / (ia + ib));
      b.x += nx * over * (ib / (ia + ib));
      b.y += ny * over * (ib / (ia + ib));
      // and trade momentum along the line between their centres
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn >= 0) continue;
      const jImp = (-(1 + (b.fixed ? E_WALL : E_BODY)) * vn) / (ia + ib);
      a.vx -= jImp * ia * nx;
      a.vy -= jImp * ia * ny;
      b.vx += jImp * ib * nx;
      b.vy += jImp * ib * ny;
    }
  }
  for (const b of bodies) {
    for (const w of WALLS) {
      const ex = w.bx - w.ax;
      const ey = w.by - w.ay;
      const t = Phaser.Math.Clamp(((b.x - w.ax) * ex + (b.y - w.ay) * ey) / (ex * ex + ey * ey), 0, 1);
      const cx = w.ax + ex * t;
      const cy = w.ay + ey * t;
      const dx = b.x - cx;
      const dy = b.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= b.r * b.r) continue;
      const d = Math.sqrt(d2) || 0.001;
      const nx = dx / d;
      const ny = dy / d;
      b.x = cx + nx * b.r;
      b.y = cy + ny * b.r;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx -= (1 + E_WALL) * vn * nx;
        b.vy -= (1 + E_WALL) * vn * ny;
      }
    }
  }
}

/** Which goal the ball is in, if any: the team that SCORED. */
function goalFor(ball: Body): Team | null {
  if (ball.y < CY - MOUTH || ball.y > CY + MOUTH) return null;
  // most of the ball over the line (the box is shallower than the ball is
  // wide, so it cannot all be: it would hit the back of the arch first)
  if (ball.x < P.l - GOAL_IN) return 'red';
  if (ball.x > P.r + GOAL_IN) return 'green';
  return null;
}

const settled = (bodies: Body[]) => bodies.every((b) => Math.hypot(b.vx, b.vy) < STOP_V);

// ------------------------------------------------------------------ state

let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let frogs: Body[] = [];
let ball: Body = { x: 0, y: 0, vx: 0, vy: 0, r: BALL_R, m: BALL_M, team: null };
let bodies: Body[] = [];
let phase: Phase = 'aim';
let turn: Team = 'green';
let shots: Record<Team, number> = { green: 0, red: 0 };
let score: Record<Team, number> = { green: 0, red: 0 };
let sudden = false;
/** Who scored last: a reload during the goal goes on to the right kick-off (log #87). */
let lastGoal: Team = 'green';
let selected: Body | null = null;
let dragging = false;
let pullX = 0;
let pullY = 0;
let stillMs = 0;
let movingMs = 0;
let acc = 0;
let trackT = 0;
let clock = 0;

let frogSprites: Phaser.GameObjects.Image[] = [];
let frogGlows: Phaser.GameObjects.Image[] = [];
let ballSprite: Phaser.GameObjects.Image | null = null;
let ballShadow: Phaser.GameObjects.Ellipse | null = null;
let aimG: Phaser.GameObjects.Graphics | null = null;
let ringG: Phaser.GameObjects.Graphics | null = null;
let portalG: Phaser.GameObjects.Graphics | null = null;
let scoreG: Phaser.GameObjects.BitmapText | null = null;
let scoreR: Phaser.GameObjects.BitmapText | null = null;
let marquee: Phaser.GameObjects.BitmapText | null = null;
let powerText: Phaser.GameObjects.BitmapText | null = null;
let pipG: Phaser.GameObjects.Graphics | null = null;
let shadows: Phaser.GameObjects.Ellipse[] = [];

export const bogBall: MinigameModule = {
  id: 'bogball',
  title: 'BOG BALL',
  music: 'game_bogball',
  rules: 'slingshot football - ten shots each',
  tutorial: {
    objective: ['KNOCK THE MUD BALL INTO HIS ARCH.', 'ONE FROG A TURN, TEN SHOTS EACH.', 'MOST GOALS WINS.'],
    controls: [
      ['CLICK A FROG', 'PICK YOUR GREEN FROG'],
      ['DRAG BACK', 'AIM AND SET THE POWER'],
      ['LET GO', 'LAUNCH IT'],
    ],
  },
  // (played entirely by dragging the frogs: nothing to put under the thumbs)
  touch: {},

  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    phase = 'aim';
    turn = 'green';
    shots = { green: 0, red: 0 };
    score = { green: 0, red: 0 };
    sudden = false;
    selected = null;
    dragging = false;
    acc = 0;
    clock = 0;
    makeTextures(scene);
    scene.add.image(0, 0, 'bog_pitch').setOrigin(0, 0).setDepth(0);
    paintArches(scene);
    portalG = scene.add.graphics().setDepth(3).setBlendMode(Phaser.BlendModes.ADD);

    frogs = [];
    shadows = [];
    frogSprites = [];
    frogGlows = [];
    for (const team of ['green', 'red'] as Team[]) {
      for (const [x, y] of KICKOFF[team]) {
        frogs.push({ x, y, vx: 0, vy: 0, r: FROG_R, m: FROG_M, team });
        shadows.push(scene.add.ellipse(x + 1, y + 2, FROG_R * 2, FROG_R * 1.4, 0x000000, 0.3).setDepth(4));
        if (team === 'red') frogGlows.push(scene.add.image(x, y, 'bog_glow').setDepth(5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6));
        frogSprites.push(scene.add.image(x, y, team === 'green' ? 'bog_toad' : 'bog_magma').setDepth(6));
      }
    }
    ball = { x: (P.l + P.r) / 2, y: CY, vx: 0, vy: 0, r: BALL_R, m: BALL_M, team: null };
    bodies = [...frogs, ball];
    ballShadow = scene.add.ellipse(ball.x + 1, ball.y + 2, BALL_R * 2, BALL_R * 1.5, 0x000000, 0.28).setDepth(4);
    ballSprite = scene.add.image(ball.x, ball.y, 'bog_ball').setDepth(7);
    ringG = scene.add.graphics().setDepth(5);
    aimG = scene.add.graphics().setDepth(9);

    // ---- the scoreboard: a slab of stone across the top
    const hud = scene.add.graphics().setDepth(20);
    hud.fillStyle(0x0c0a0c, 0.92).fillRect(0, HUD_Y - 1, GAME_W, 17);
    hud.fillStyle(0x3a3436, 1).fillRect(0, HUD_Y + 15, GAME_W, 1);
    hud.fillStyle(0x1e3a1a, 1).fillRect(4, HUD_Y + 1, 70, 12);
    hud.fillStyle(0x4a1a10, 1).fillRect(GAME_W - 74, HUD_Y + 1, 70, 12);
    hud.fillStyle(0x6fbb6a, 1).fillRect(4, HUD_Y + 1, 2, 12);
    hud.fillStyle(0xff7a3d, 1).fillRect(GAME_W - 6, HUD_Y + 1, 2, 12);
    text(scene, 9, HUD_Y + 2, 'GREEN', PALETTE.mossLight).setDepth(21);
    scoreG = text(scene, 64, HUD_Y + 2, '0', PALETTE.cream).setDepth(21);
    text(scene, GAME_W - 37, HUD_Y + 2, 'RED', PALETTE.ember).setDepth(21);
    scoreR = text(scene, GAME_W - 68, HUD_Y + 2, '0', PALETTE.cream).setDepth(21);
    hud.fillStyle(0x000000, 1).fillRect(GAME_W / 2 - 58, HUD_Y + 1, 116, 12);
    hud.lineStyle(1, 0x5a4a3a, 1).strokeRect(GAME_W / 2 - 58, HUD_Y + 1, 116, 12);
    marquee = centerText(scene, GAME_W / 2, HUD_Y + 7, '', PALETTE.gold).setDepth(21);
    // shots left: a row of pips along the foot of each side's panel
    pipG = scene.add.graphics().setDepth(21);
    powerText = centerText(scene, 0, 0, '', PALETTE.cream).setDepth(22).setVisible(false);

    scene.input.on('pointerdown', onDown);
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    scene.input.on('pointerupoutside', onUp);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointerdown', onDown);
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
      scene.input.off('pointerupoutside', onUp);
    });

    beginTurn('green');

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__bog = {
        state: () => ({
          phase,
          turn,
          shots: { ...shots },
          score: { ...score },
          sudden,
          ball: { x: ball.x, y: ball.y },
          frogs: frogs.map((f) => ({ x: f.x, y: f.y, team: f.team })),
        }),
        /** Launch frog `i` (0-2 green, 3-5 red) on whoever's turn it is. */
        shoot: (i: number, angle: number, power: number) => {
          if (phase !== 'aim' && phase !== 'think') return false;
          launch(frogs[i], angle, power);
          return true;
        },
        place: (x: number, y: number) => {
          ball.x = x;
          ball.y = y;
          ball.vx = ball.vy = 0;
        },
        placeFrog: (i: number, x: number, y: number) => {
          frogs[i].x = x;
          frogs[i].y = y;
          frogs[i].vx = frogs[i].vy = 0;
        },
        setShots: (g: number, r: number) => {
          shots = { green: g, red: r };
          refreshHud();
        },
        /** What the machine would throw from here, without throwing it. */
        plan: () => planShot(),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__bog;
      });
    }
  },

  update(_t: number, delta: number) {
    if (!sceneRef) return;
    clock += delta / 1000;
    drawPortals();
    if (phase === 'moving') {
      acc += Math.min(delta, 50) / 1000;
      while (acc >= STEP) {
        physicsStep(bodies, STEP);
        acc -= STEP;
        const g = goalFor(ball);
        if (g) {
          scored(g);
          break;
        }
      }
      movingMs += delta;
      mudTracks(delta);
      if (phase === 'moving') {
        if (settled(bodies)) stillMs += delta;
        else stillMs = 0;
        if (stillMs > 200 || movingMs > 9000) {
          for (const b of bodies) b.vx = b.vy = 0;
          endTurn();
        }
      }
    }
    render(delta);
  },

  // ---- A RELOAD (log #87): every frog and the ball, where they are and how
  // fast, whose turn, the shots taken and the score.  A shot in flight goes
  // on flying; a turn being lined up is lined up again; a goal just scored
  // goes on to its kick-off.
  snapshot() {
    return {
      frogs: frogs.map((f) => ({ x: f.x, y: f.y, vx: f.vx, vy: f.vy })),
      ball: { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy },
      phase, turn, shots: { ...shots }, score: { ...score }, sudden, stillMs, movingMs, clock, lastGoal,
    };
  },

  restore(snap: unknown) {
    type B = { x: number; y: number; vx: number; vy: number };
    const v = snap as { frogs: B[]; ball: B; phase: Phase; turn: Team; shots: Record<Team, number>; score: Record<Team, number>; sudden: boolean; stillMs: number; movingMs: number; clock: number; lastGoal: Team };
    lastGoal = v.lastGoal;
    v.frogs.forEach((b, i) => frogs[i] && Object.assign(frogs[i], b));
    Object.assign(ball, v.ball);
    shots = { ...v.shots };
    score = { ...v.score };
    sudden = v.sudden;
    clock = v.clock;
    turn = v.turn;
    refreshHud();
    if (v.phase === 'moving') {
      phase = 'moving';
      stillMs = v.stillMs;
      movingMs = v.movingMs;
      acc = 0;
      return;
    }
    if (v.phase === 'over') {
      finish();
      return;
    }
    if (v.phase === 'goal') {
      // (the goal is on the board: on to the kick-off, as `scored` goes)
      if (sudden) {
        finish();
        return;
      }
      kickoff();
      const scorer = lastGoal;
      const next: Team = scorer === 'green' ? 'red' : 'green';
      if (shots.green >= SHOTS_EACH && shots.red >= SHOTS_EACH) {
        finish();
        return;
      }
      beginTurn(shots[next] >= SHOTS_EACH ? scorer : next);
      return;
    }
    beginTurn(v.turn);
  },

  destroy() {
    sceneRef = null;
    apiRef = null;
    aimG = null;
    ringG = null;
    portalG = null;
    ballSprite = null;
    ballShadow = null;
    frogSprites = [];
    frogGlows = [];
  },
};

// ------------------------------------------------------------------ turns

function refreshHud(): void {
  scoreG?.setText(String(score.green));
  scoreR?.setText(String(score.red));
  const total = sudden ? SHOTS_EACH + SUDDEN_EACH : SHOTS_EACH;
  // the shots each side still has to come, as pips under its name
  pipG?.clear();
  for (let k = 0; k < total; k++) {
    const gLeft = k < total - shots.green;
    const rLeft = k < total - shots.red;
    pipG?.fillStyle(gLeft ? 0x9ae07c : 0x2a3a26, 1).fillRect(9 + k * 4, HUD_Y + 11, 2, 1);
    pipG?.fillStyle(rLeft ? 0xffa060 : 0x3a2016, 1).fillRect(GAME_W - 11 - k * 4, HUD_Y + 11, 2, 1);
  }
}

function say(msg: string, col: number): void {
  marquee?.setText(msg).setTint(col);
}

function beginTurn(t: Team): void {
  turn = t;
  selected = null;
  dragging = false;
  refreshHud();
  if (t === 'green') {
    phase = 'aim';
    say(sudden ? 'SUDDEN DEATH' : 'PLAYER TURN', sudden ? PALETTE.ember : PALETTE.mossLight);
  } else {
    phase = 'think';
    say("DARK FROGGY'S TURN", PALETTE.ember);
    sceneRef?.time.delayedCall(550, () => aiTurn());
  }
}

function launch(f: Body, angle: number, power: number): void {
  const sp = Phaser.Math.Clamp(power, 0, 1) * LAUNCH_MAX;
  f.vx = Math.cos(angle) * sp;
  f.vy = Math.sin(angle) * sp;
  shots[turn] += 1;
  selected = null;
  dragging = false;
  phase = 'moving';
  stillMs = 0;
  movingMs = 0;
  acc = 0;
  aimG?.clear();
  powerText?.setVisible(false);
  refreshHud();
  audio.sfx('throw_whoosh', 0.5 + power * 0.4);
  // a slap of mud off the frog's feet as it goes
  if (sceneRef) for (let i = 0; i < 5; i++) splat(f.x - Math.cos(angle) * 6, f.y - Math.sin(angle) * 6, -Math.cos(angle) * 40, -Math.sin(angle) * 40);
}

function endTurn(): void {
  const total = sudden ? SHOTS_EACH + SUDDEN_EACH : SHOTS_EACH;
  if (shots.green >= total && shots.red >= total) return finish();
  beginTurn(turn === 'green' ? 'red' : 'green');
}

function scored(team: Team): void {
  if (!sceneRef) return;
  phase = 'goal';
  lastGoal = team;
  score[team] += 1;
  refreshHud();
  say('GOAL!', team === 'green' ? PALETTE.mossLight : PALETTE.ember);
  audio.sfx('boom', 0.6);
  audio.sfx(team === 'green' ? 'chime' : 'buzzer', 0.6);
  goalFlash(team);
  // sudden death: the first goal settles it
  if (sudden) {
    sceneRef.time.delayedCall(1500, () => finish());
    return;
  }
  sceneRef.time.delayedCall(1500, () => {
    if (!sceneRef) return;
    kickoff();
    const total = SHOTS_EACH;
    if (shots.green >= total && shots.red >= total) return finish();
    // whoever let it in kicks off
    const next: Team = team === 'green' ? 'red' : 'green';
    beginTurn(shots[next] >= total ? team : next);
  });
}

function kickoff(): void {
  let gi = 0;
  let ri = 0;
  for (const f of frogs) {
    const [x, y] = f.team === 'green' ? KICKOFF.green[gi++] : KICKOFF.red[ri++];
    f.x = x;
    f.y = y;
    f.vx = f.vy = 0;
  }
  ball.x = (P.l + P.r) / 2;
  ball.y = CY;
  ball.vx = ball.vy = 0;
}

function finish(): void {
  if (!sceneRef || phase === 'over') return;
  if (score.green === score.red && !sudden) {
    sudden = true;
    say('SUDDEN DEATH', PALETTE.ember);
    sceneRef.time.delayedCall(1200, () => beginTurn('green'));
    return;
  }
  phase = 'over';
  const won = score.green > score.red;
  const tie = score.green === score.red;
  if (won) apiRef?.record(score.green - score.red);
  say(tie ? 'A DRAW' : won ? 'YOU WIN' : 'YOU LOSE', tie ? PALETTE.cream : won ? PALETTE.mossLight : PALETTE.ember);
  centerText(sceneRef, GAME_W / 2, CY - 8, `${score.green} - ${score.red}`, PALETTE.cream, 16).setDepth(30);
  sceneRef.time.delayedCall(1600, () => (tie ? apiRef?.draw() : won ? apiRef?.win() : apiRef?.lose()));
}

// ------------------------------------------------------------------ the player

function onDown(p: Phaser.Input.Pointer): void {
  if (phase !== 'aim' || turn !== 'green') return;
  let best: Body | null = null;
  let bd = 14;
  for (const f of frogs) {
    if (f.team !== 'green') continue;
    const d = Math.hypot(p.worldX - f.x, p.worldY - f.y);
    if (d < bd) (bd = d), (best = f);
  }
  if (!best) return;
  selected = best;
  dragging = true;
  pullX = p.worldX;
  pullY = p.worldY;
  audio.sfx('ui_blip', 0.4);
}

function onMove(p: Phaser.Input.Pointer): void {
  if (!dragging) return;
  pullX = p.worldX;
  pullY = p.worldY;
}

function onUp(p: Phaser.Input.Pointer): void {
  if (!dragging || !selected) return;
  dragging = false;
  pullX = p.worldX;
  pullY = p.worldY;
  const { angle, power } = pullOf(selected, pullX, pullY);
  // a tap, or a pull too small to mean anything, just picks the frog
  if (power < 0.08) {
    aimG?.clear();
    powerText?.setVisible(false);
    return;
  }
  launch(selected, angle, power);
}

/** Where a pull to (px, py) sends frog f: the opposite way, harder the further. */
function pullOf(f: Body, px: number, py: number): { angle: number; power: number } {
  const dx = f.x - px;
  const dy = f.y - py;
  return { angle: Math.atan2(dy, dx), power: Math.min(1, Math.hypot(dx, dy) / PULL_MAX) };
}

// ------------------------------------------------------------------ the machine

interface Plan {
  frog: number;
  angle: number;
  power: number;
  score: number;
}

/**
 * Try the shots out.  For every red frog, aim through a point just behind
 * the ball on the line from a few spots in Green's goal, spread a little
 * either side of it, at three powers; play each forward on the real physics
 * and score where the ball ends up.
 */
function planShot(): Plan {
  let best: Plan = { frog: 3, angle: Math.PI, power: 0.6, score: -Infinity };
  const goalX = P.l - 4;
  frogs.forEach((f, i) => {
    if (f.team !== 'red') return;
    for (const ty of [CY - 12, CY, CY + 12]) {
      const gx = goalX - ball.x;
      const gy = ty - ball.y;
      const gl = Math.hypot(gx, gy) || 1;
      // the spot to strike: behind the ball, away from the target
      const sx = ball.x - (gx / gl) * (BALL_R + FROG_R - 2);
      const sy = ball.y - (gy / gl) * (BALL_R + FROG_R - 2);
      const base = Math.atan2(sy - f.y, sx - f.x);
      for (const off of [-0.14, -0.07, 0, 0.07, 0.14]) {
        for (const pw of [0.55, 0.8, 1]) {
          const s = trial(i, base + off, pw);
          if (s > best.score) best = { frog: i, angle: base + off, power: pw, score: s };
        }
      }
    }
  });
  return best;
}

function trial(i: number, angle: number, power: number): number {
  const sim: Body[] = bodies.map((b) => ({ ...b }));
  const f = sim[i];
  const sb = sim[sim.length - 1];
  f.vx = Math.cos(angle) * power * LAUNCH_MAX;
  f.vy = Math.sin(angle) * power * LAUNCH_MAX;
  const startX = sb.x;
  for (let k = 0; k < 240 * 6; k++) {
    physicsStep(sim, STEP * 2);
    const g = goalFor(sb);
    if (g === 'red') return 1000 - k * 0.01;
    if (g === 'green') return -2000;
    if (k % 30 === 0 && settled(sim)) break;
  }
  // the ball further toward Green's goal is good; near his own mouth is bad
  let s = (startX - sb.x) * 1.2 - Math.abs(sb.y - CY) * 0.15;
  if (sb.x > P.r - 60 && Math.abs(sb.y - CY) < MOUTH + 10) s -= 150;
  return s;
}

function aiTurn(): void {
  if (!sceneRef || phase !== 'think') return;
  const plan = planShot();
  // a slightly unsteady hand
  const angle = plan.angle + (Math.random() - 0.5) * 0.09;
  const power = Phaser.Math.Clamp(plan.power + (Math.random() - 0.5) * 0.1, 0.3, 1);
  const f = frogs[plan.frog];
  selected = f;
  phase = 'pull';
  // the pull, drawn back over most of a second, then let go
  const pull = { k: 0 };
  sceneRef.tweens.add({
    targets: pull,
    k: 1,
    duration: 700,
    ease: 'Sine.easeOut',
    onUpdate: () => {
      const d = pull.k * power * PULL_MAX;
      pullX = f.x - Math.cos(angle) * d;
      pullY = f.y - Math.sin(angle) * d;
    },
    onComplete: () => {
      if (phase !== 'pull') return;
      sceneRef?.time.delayedCall(180, () => {
        if (phase === 'pull') {
          phase = 'think';
          launch(f, angle, power);
        }
      });
    },
  });
}

// ------------------------------------------------------------------ drawing

function render(delta: number): void {
  frogs.forEach((f, i) => {
    const s = frogSprites[i];
    if (!s) return;
    s.setPosition(Math.round(f.x), Math.round(f.y));
    shadows[i]?.setPosition(f.x + 1, f.y + 2);
    const sp = Math.hypot(f.vx, f.vy);
    if (sp > 20) s.setRotation(Math.atan2(f.vy, f.vx));
    else if (selected === f && (dragging || phase === 'pull')) s.setRotation(pullOf(f, pullX, pullY).angle);
    else if (phase !== 'moving') s.setRotation(f.team === 'green' ? 0 : Math.PI);
    // a hop of squash and stretch while it is flying across the bog
    const k = Math.min(1, sp / 300);
    s.setScale(1 + k * 0.18, 1 - k * 0.12);
  });
  let gi = 0;
  frogs.forEach((f) => {
    if (f.team !== 'red') return;
    const g = frogGlows[gi++];
    g?.setPosition(f.x, f.y).setAlpha(0.45 + Math.sin(clock * 3 + gi) * 0.2);
  });
  if (ballSprite) {
    const sp = Math.hypot(ball.vx, ball.vy);
    ballSprite.setPosition(Math.round(ball.x), Math.round(ball.y));
    // it rolls: the turn is how far it went over how big it is
    if (sp > 1) ballSprite.rotation += ((sp * delta) / 1000 / BALL_R) * Math.sign(ball.vx || 1);
    ballShadow?.setPosition(ball.x + 1, ball.y + 2);
  }
  // the ring under the frog that is up, and a soft pulse under the others
  ringG?.clear();
  if (phase === 'aim' && turn === 'green') {
    for (const f of frogs) {
      if (f.team !== 'green') continue;
      const on = f === selected;
      ringG?.lineStyle(1, on ? 0xfff0a0 : 0x9ae07c, on ? 1 : 0.35 + Math.sin(clock * 5) * 0.25).strokeCircle(f.x, f.y, FROG_R + 3);
    }
  } else if (selected) {
    ringG?.lineStyle(1, 0xffb040, 1).strokeCircle(selected.x, selected.y, FROG_R + 3);
  }
  drawAim();
}

/**
 * THE SLINGSHOT: the rubber band from the frog back to the finger, and the
 * glowing vector the other way -- longer and hotter the harder the pull --
 * with the line it will travel dotted out ahead, off the walls.
 */
function drawAim(): void {
  const g = aimG;
  if (!g) return;
  g.clear();
  const f = selected;
  if (!f || !(dragging || phase === 'pull')) {
    powerText?.setVisible(false);
    return;
  }
  const { angle, power } = pullOf(f, pullX, pullY);
  if (power < 0.02) return;
  const red = f.team === 'red';
  // the band
  g.lineStyle(1, 0x3a2a18, 1).lineBetween(f.x - 3, f.y, pullX, pullY).lineBetween(f.x + 3, f.y, pullX, pullY);
  g.fillStyle(0x6b4a2f, 1).fillCircle(pullX, pullY, 2);
  // the vector: hotter the harder
  const col = power < 0.5 ? (red ? 0xff9a3c : 0x9ae07c) : power < 0.85 ? 0xffd45e : 0xff5a3a;
  const len = 10 + power * 44;
  const ex = f.x + Math.cos(angle) * len;
  const ey = f.y + Math.sin(angle) * len;
  g.lineStyle(5, col, 0.18).lineBetween(f.x, f.y, ex, ey);
  g.lineStyle(3, col, 0.35).lineBetween(f.x, f.y, ex, ey);
  g.lineStyle(1, 0xffffff, 0.95).lineBetween(f.x, f.y, ex, ey);
  const a1 = angle + Math.PI * 0.82;
  const a2 = angle - Math.PI * 0.82;
  g.fillStyle(col, 1).fillTriangle(ex + Math.cos(angle) * 3, ey + Math.sin(angle) * 3, ex + Math.cos(a1) * 5, ey + Math.sin(a1) * 5, ex + Math.cos(a2) * 5, ey + Math.sin(a2) * 5);
  // the path ahead, dotted, bouncing off the side walls
  let px = ex;
  let py = ey;
  let dx = Math.cos(angle);
  let dy = Math.sin(angle);
  const reach = power * 150;
  for (let d = 0; d < reach; d += 6) {
    px += dx * 6;
    py += dy * 6;
    if (py < P.t + FROG_R || py > P.b - FROG_R) dy = -dy;
    if (px < P.l + FROG_R || px > P.r - FROG_R) dx = -dx;
    g.fillStyle(col, 0.7 * (1 - d / reach)).fillRect(Math.round(px), Math.round(py), 1, 1);
  }
  powerText
    ?.setVisible(true)
    .setText(`${Math.round(power * 100)}%`)
    .setPosition(f.x, f.y - 14)
    .setTint(col);
}

/** The portals in the arches: slow rings of light turning in each mouth. */
function drawPortals(): void {
  const g = portalG;
  if (!g) return;
  g.clear();
  for (const [x, dir, col, hot] of [[P.l, -1, 0x3a8aff, 0x9ad0ff], [P.r, 1, 0xff6a1a, 0xffc060]] as const) {
    const cx = x + (dir * BOX_D) / 2;
    g.fillStyle(col, 0.1 + Math.sin(clock * 2) * 0.04).fillRect(Math.min(x, x + dir * BOX_D), CY - MOUTH, BOX_D, MOUTH * 2);
    for (let k = 0; k < 7; k++) {
      const t = (clock * 0.6 + k / 7) % 1;
      const yy = CY - MOUTH + t * MOUTH * 2;
      const w = Math.sin(t * Math.PI) * (BOX_D / 2 - 1);
      g.fillStyle(k % 2 ? hot : col, 0.5 * Math.sin(t * Math.PI)).fillRect(cx - w, yy, w * 2, 1);
    }
    for (let k = 0; k < 4; k++) {
      const a = clock * 2.2 + (k * Math.PI) / 2;
      g.fillStyle(hot, 0.8).fillRect(cx + Math.cos(a) * 4, CY + Math.sin(a) * (MOUTH - 4), 1, 1);
    }
  }
}

/** The mud ball, going fast, leaves its tracks on the bog and throws clods. */
function mudTracks(delta: number): void {
  const sc = sceneRef;
  if (!sc) return;
  const sp = Math.hypot(ball.vx, ball.vy);
  trackT -= delta;
  if (sp < 90 || trackT > 0) return;
  trackT = 40;
  const mark = sc.add.ellipse(ball.x, ball.y + 2, 6 + Math.random() * 3, 4, Math.random() < 0.5 ? 0x2a1a0e : 0x3a2414, 0.55).setDepth(1).setRotation(Math.atan2(ball.vy, ball.vx));
  sc.tweens.add({ targets: mark, alpha: 0, delay: 900, duration: 1600, onComplete: () => mark.destroy() });
  if (Math.random() < 0.5) splat(ball.x, ball.y, -ball.vx * 0.2 + (Math.random() - 0.5) * 50, -ball.vy * 0.2 + (Math.random() - 0.5) * 50);
}

/** A clod of mud thrown off, landing as a spot that sinks in. */
function splat(x: number, y: number, vx: number, vy: number): void {
  const sc = sceneRef;
  if (!sc) return;
  const c = sc.add.rectangle(x, y, 2, 2, Math.random() < 0.5 ? 0x5a3a22 : 0x7a5434).setDepth(8);
  sc.tweens.add({
    targets: c,
    x: x + vx * 0.35,
    y: y + vy * 0.35,
    duration: 350,
    ease: 'Quad.easeOut',
    onComplete: () => sc.tweens.add({ targets: c, alpha: 0, duration: 700, onComplete: () => c.destroy() }),
  });
}

/** GOAL: the screen flashes the scorer's colour, the arch bursts, GOAL! stamps down. */
function goalFlash(team: Team): void {
  const sc = sceneRef;
  if (!sc) return;
  const col = team === 'green' ? 0x6fbb6a : 0xff6a1a;
  const flash = sc.add.rectangle(0, 0, GAME_W, 180, col, 0.55).setOrigin(0, 0).setDepth(25);
  sc.tweens.add({ targets: flash, alpha: 0, duration: 600, onComplete: () => flash.destroy() });
  sc.cameras.main.shake(260, 0.01);
  const gx = team === 'green' ? P.r + BOX_D / 2 : P.l - BOX_D / 2;
  const burst = team === 'green' ? 0xffc060 : 0x9ad0ff;
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const p = sc.add.rectangle(gx, CY, 2, 2, i % 2 ? burst : 0xffffff).setDepth(26).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: p, x: gx + Math.cos(a) * (30 + Math.random() * 40), y: CY + Math.sin(a) * (20 + Math.random() * 30), alpha: 0, duration: 700, onComplete: () => p.destroy() });
  }
  const t = centerText(sc, GAME_W / 2, CY, 'GOAL!', team === 'green' ? PALETTE.mossLight : PALETTE.ember, 16).setDepth(27).setScale(2.4).setAlpha(0);
  sc.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
  sc.tweens.add({ targets: t, alpha: 0, delay: 1100, duration: 300, onComplete: () => t.destroy() });
}

// ------------------------------------------------------------------ textures

function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Smooth value noise on a grid, for patches of moss and mud. */
function noise2(R: () => number, w: number, h: number, cell: number): (x: number, y: number) => number {
  const gw = Math.ceil(w / cell) + 2;
  const gh = Math.ceil(h / cell) + 2;
  const v = Array.from({ length: gw * gh }, () => R());
  const at = (i: number, j: number) => v[j * gw + i];
  return (x, y) => {
    const fx = x / cell;
    const fy = y / cell;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * sx;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx;
    return a + (b - a) * sy;
  };
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const mix = (a: number, b: number, t: number) => {
  const ch = (s: number) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

function makeTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('bog_pitch')) paintPitch(scene);
  if (!scene.textures.exists('bog_toad')) paintFrog(scene, 'bog_toad', false);
  if (!scene.textures.exists('bog_magma')) paintFrog(scene, 'bog_magma', true);
  if (!scene.textures.exists('bog_ball')) paintBall(scene);
  if (!scene.textures.exists('bog_glow')) {
    const t = scene.textures.createCanvas('bog_glow', 28, 28);
    if (t) {
      const g = t.getContext();
      const grd = g.createRadialGradient(14, 14, 2, 14, 14, 14);
      grd.addColorStop(0, 'rgba(255,120,40,0.9)');
      grd.addColorStop(1, 'rgba(255,60,0,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 28, 28);
      t.refresh();
    }
  }
}

/** The marsh, the cracked earth and standing water, and the cobbles round it. */
function paintPitch(scene: Phaser.Scene): void {
  const W = GAME_W;
  const H = 180;
  const tex = scene.textures.createCanvas('bog_pitch', W, H);
  if (!tex) return;
  const g = tex.getContext();
  const R = rng(4242);
  // ---- outside the pitch: dark volcanic rock
  g.fillStyle = '#121012';
  g.fillRect(0, 0, W, H);
  // ---- the marsh, pixel by pixel from two octaves of noise
  const n1 = noise2(R, W, H, 18);
  const n2 = noise2(R, W, H, 5);
  const moss = [0x14261a, 0x1c3420, 0x24422a, 0x2e4a26, 0x2a3a1c, 0x2e2a1a];
  for (let y = P.t; y < P.b; y++) {
    for (let x = P.l - BOX_D; x < P.r + BOX_D; x++) {
      if ((x < P.l || x >= P.r) && (y < CY - MOUTH || y >= CY + MOUTH)) continue;
      const v = n1(x, y) * 0.7 + n2(x, y) * 0.3 + (R() - 0.5) * 0.12;
      const k = Phaser.Math.Clamp(v, 0, 0.999) * moss.length;
      const i = Math.floor(k);
      g.fillStyle = hex(mix(moss[i], moss[Math.min(moss.length - 1, i + 1)], k - i));
      g.fillRect(x, y, 1, 1);
    }
  }
  // standing water: dark pools with a cold sheen on their far edge
  for (let i = 0; i < 7; i++) {
    const px = P.l + 20 + R() * (P.r - P.l - 40);
    const py = P.t + 12 + R() * (P.b - P.t - 24);
    const rx = 6 + R() * 10;
    const ry = 3 + R() * 4;
    g.fillStyle = 'rgba(8,18,20,0.85)';
    g.beginPath();
    g.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(90,130,120,0.35)';
    g.beginPath();
    g.ellipse(px, py, rx, ry, 0, 0.2, Math.PI - 0.2);
    g.stroke();
  }
  // cracked earth: wandering dark lines that fork
  g.lineWidth = 1;
  const crack = (x: number, y: number, a: number, len: number, depth: number) => {
    g.strokeStyle = depth ? 'rgba(6,10,6,0.7)' : 'rgba(6,10,6,0.9)';
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < len; s++) {
      a += (R() - 0.5) * 0.9;
      x += Math.cos(a) * 2;
      y += Math.sin(a) * 2;
      g.lineTo(Math.round(x) + 0.5, Math.round(y) + 0.5);
      if (depth < 2 && R() < 0.08) crack(x, y, a + (R() < 0.5 ? 1 : -1), len / 2, depth + 1);
    }
    g.stroke();
  };
  for (let i = 0; i < 14; i++) crack(P.l + R() * (P.r - P.l), P.t + R() * (P.b - P.t), R() * Math.PI * 2, 8 + R() * 10, 0);
  // tufts of reed and lighter moss
  for (let i = 0; i < 260; i++) {
    g.fillStyle = R() < 0.5 ? '#3e6a2e' : '#4f7a34';
    g.fillRect(Math.floor(P.l + R() * (P.r - P.l)), Math.floor(P.t + R() * (P.b - P.t)), 1, R() < 0.3 ? 2 : 1);
  }
  // the worn markings: halfway line, centre circle, the arcs in front of the goals
  g.strokeStyle = 'rgba(190,220,160,0.16)';
  g.setLineDash([3, 2]);
  g.beginPath();
  g.moveTo(W / 2 + 0.5, P.t);
  g.lineTo(W / 2 + 0.5, P.b);
  g.stroke();
  g.beginPath();
  g.arc(W / 2, CY, 22, 0, Math.PI * 2);
  g.stroke();
  for (const [x, a0, a1] of [[P.l, -Math.PI / 2, Math.PI / 2], [P.r, Math.PI / 2, (Math.PI * 3) / 2]] as const) {
    g.beginPath();
    g.arc(x, CY, 34, a0, a1);
    g.stroke();
  }
  g.setLineDash([]);
  // ---- the cobblestone border: rows of rough stones, mortar between them,
  // moss in the cracks and now and then an ember glowing in one
  const stones = ['#2f2c30', '#3a3639', '#45404a', '#35302e', '#4a4440'];
  const stoneRow = (x0: number, x1: number, y0: number, y1: number) => {
    for (let y = y0; y < y1; ) {
      const sh = 5 + Math.floor(R() * 4);
      for (let x = x0 - Math.floor(R() * 6); x < x1; ) {
        const sw = 6 + Math.floor(R() * 7);
        const cx = Math.max(x0, x);
        const cw = Math.min(x1, x + sw) - cx;
        const ch = Math.min(y1, y + sh) - y;
        if (cw > 1 && ch > 1) {
          g.fillStyle = '#0a0809';
          g.fillRect(cx, y, cw, ch);
          g.fillStyle = stones[Math.floor(R() * stones.length)];
          g.fillRect(cx + 1, y + 1, cw - 2, ch - 2);
          g.fillStyle = 'rgba(255,255,255,0.12)';
          g.fillRect(cx + 1, y + 1, cw - 2, 1);
          g.fillStyle = 'rgba(0,0,0,0.3)';
          g.fillRect(cx + 1, y + ch - 2, cw - 2, 1);
          if (R() < 0.25) {
            g.fillStyle = '#2a4a22';
            g.fillRect(cx, y + ch - 1, Math.min(cw, 3), 1);
          }
          if (R() < 0.05) {
            g.fillStyle = 'rgba(255,110,30,0.75)';
            g.fillRect(cx + 2, y + 2, Math.max(1, cw - 5), 1);
          }
        }
        x += sw;
      }
      y += sh;
    }
  };
  stoneRow(0, W, P.t - 18 > 0 ? P.t - 18 : 0, P.t);
  stoneRow(0, W, P.b, H);
  stoneRow(0, P.l - BOX_D, P.t, P.b);
  stoneRow(P.r + BOX_D, W, P.t, P.b);
  stoneRow(P.l - BOX_D, P.l, P.t, CY - MOUTH);
  stoneRow(P.l - BOX_D, P.l, CY + MOUTH, P.b);
  stoneRow(P.r, P.r + BOX_D, P.t, CY - MOUTH);
  stoneRow(P.r, P.r + BOX_D, CY + MOUTH, P.b);
  // a jagged lip where the stones meet the marsh, and their shadow on it
  for (let x = P.l; x < P.r; x++) {
    const j = Math.floor(R() * 3);
    g.fillStyle = '#0a0809';
    g.fillRect(x, P.t, 1, j);
    g.fillRect(x, P.b - j, 1, j);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x, P.t + j, 1, 2);
  }
  // ---- and the dark pressing in at the corners
  const vig = g.createRadialGradient(W / 2, CY, 60, W / 2, CY, 200);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);
  tex.refresh();
}

/** The arches: stone pillars either side of each mouth, carved with glowing runes. */
function paintArches(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(2);
  const runes = scene.add.graphics().setDepth(3).setBlendMode(Phaser.BlendModes.ADD);
  for (const [x, dir, col] of [[P.l, -1, 0x3a8aff], [P.r, 1, 0xff6a1a]] as const) {
    for (const yEnd of [CY - MOUTH, CY + MOUTH]) {
      const up = yEnd < CY ? -1 : 1;
      // the pillar: a block of dark stone set into the wall at the mouth
      const px = Math.min(x, x + dir * (BOX_D + 3));
      const py = up < 0 ? yEnd - 9 : yEnd + 1;
      g.fillStyle(0x0a0809, 1).fillRect(px - 1, py - 1, BOX_D + 5, 10);
      g.fillStyle(0x4a4450, 1).fillRect(px, py, BOX_D + 3, 8);
      g.fillStyle(0x6a6470, 1).fillRect(px, py, BOX_D + 3, 1);
      g.fillStyle(0x24202a, 1).fillRect(px, py + 7, BOX_D + 3, 1);
      // the runes cut into it
      for (let k = 0; k < 3; k++) {
        const rx = px + 3 + k * 5;
        runes.fillStyle(col, 0.9).fillRect(rx, py + 2, 1, 4).fillRect(rx + 1, py + 2 + (k % 2) * 2, 2, 1);
      }
      // the post itself, round, at the mouth
      g.fillStyle(0x0a0809, 1).fillCircle(x, yEnd, 4);
      g.fillStyle(0x5a5460, 1).fillCircle(x, yEnd, 3);
      g.fillStyle(0x8a8490, 1).fillRect(x - 2, yEnd - 2, 2, 1);
    }
    // the back of the arch, carved, with a rune of its own glowing
    const bx = x + dir * BOX_D;
    g.fillStyle(0x0a0809, 1).fillRect(bx - (dir < 0 ? 3 : 0), CY - MOUTH, 3, MOUTH * 2);
    runes.fillStyle(col, 0.7).fillRect(bx + (dir < 0 ? -2 : 1), CY - 4, 1, 8);
  }
  scene.tweens.add({ targets: runes, alpha: 0.45, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

/**
 * A frog from above, facing right: back legs folded at its sides, front legs
 * forward, two eyes up on the head.  The toad's skin is warty and mossy; the
 * other's is cracked obsidian plates with magma glowing in the seams.
 */
function paintFrog(scene: Phaser.Scene, key: string, magma: boolean): void {
  const S = 22;
  const tex = scene.textures.createCanvas(key, S, S);
  if (!tex) return;
  const g = tex.getContext();
  const R = rng(magma ? 77 : 33);
  const c = S / 2;
  const base = magma ? '#1c1214' : '#4a7a3a';
  const dark = magma ? '#0a0607' : '#2a4a20';
  const line = magma ? '#000000' : '#0e1a0a';
  const ell = (x: number, y: number, rx: number, ry: number, col: string) => {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  };
  // the legs, outline then skin
  for (const sy of [-1, 1]) {
    ell(c - 5, c + sy * 6, 4.5, 2.6, line);
    ell(c - 5, c + sy * 6, 3.6, 1.8, dark);
    ell(c + 4, c + sy * 5, 2.6, 1.6, line);
    ell(c + 4, c + sy * 5, 1.8, 1.1, dark);
  }
  // the body
  ell(c, c, 7.6, 6.8, line);
  ell(c, c, 6.8, 6, base);
  // the head, forward
  ell(c + 4, c, 4.6, 4.8, line);
  ell(c + 4, c, 3.9, 4.1, base);
  const img = g.getImageData(0, 0, S, S);
  // the skin, pixel by pixel inside the body
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      if (img.data[i + 3] === 0) continue;
      const r = img.data[i];
      const isLine = r < 20 && img.data[i + 1] < 30;
      if (isLine) continue;
      const v = R();
      if (magma) {
        // obsidian: near black with glassy lighter facets
        if (v < 0.12) (img.data[i] = 60), (img.data[i + 1] = 50), (img.data[i + 2] = 62);
      } else {
        // warts: dark pits and light bumps, and patches of moss
        if (v < 0.12) (img.data[i] = 38), (img.data[i + 1] = 64), (img.data[i + 2] = 28);
        else if (v < 0.22) (img.data[i] = 120), (img.data[i + 1] = 150), (img.data[i + 2] = 80);
        else if (v < 0.3) (img.data[i] = 96), (img.data[i + 1] = 128), (img.data[i + 2] = 44);
      }
    }
  g.putImageData(img, 0, 0);
  if (magma) {
    // the magma in the cracks between the plates
    g.strokeStyle = '#ff6a1a';
    g.lineWidth = 1;
    for (const pts of [[[c - 6, c - 2], [c - 2, c], [c - 4, c + 4]], [[c - 2, c], [c + 2, c - 3], [c + 5, c - 1]], [[c - 1, c + 1], [c + 2, c + 4]]]) {
      g.beginPath();
      pts.forEach(([x, y], k) => (k ? g.lineTo(x + 0.5, y + 0.5) : g.moveTo(x + 0.5, y + 0.5)));
      g.stroke();
    }
    g.fillStyle = '#ffc060';
    g.fillRect(c - 2, c, 1, 1);
    g.fillRect(c + 2, c - 3, 1, 1);
  } else {
    // a pale belly line down its back and a sheen on the crown
    g.fillStyle = 'rgba(200,230,150,0.35)';
    g.fillRect(c - 5, c - 1, 8, 1);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(c + 2, c - 3, 2, 1);
  }
  // the eyes, up on top of the head
  for (const sy of [-1, 1]) {
    g.fillStyle = line;
    g.fillRect(c + 4, c + sy * 3 - 1, 3, 3);
    g.fillStyle = magma ? '#ffd040' : '#e8c840';
    g.fillRect(c + 5, c + sy * 3 - 1 + 1, 2, 1);
    g.fillStyle = '#000';
    g.fillRect(c + 5, c + sy * 3, 1, 1);
  }
  tex.refresh();
}

/** The ball: a great boulder of wet mud, lumpy, with stones stuck in it. */
function paintBall(scene: Phaser.Scene): void {
  const S = BALL_R * 2 + 2;
  const tex = scene.textures.createCanvas('bog_ball', S, S);
  if (!tex) return;
  const g = tex.getContext();
  const R = rng(909);
  const c = S / 2;
  const n = noise2(R, S, S, 4);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const d = Math.hypot(dx, dy);
      // a lumpy edge
      const edge = BALL_R + (n(x, y) - 0.5) * 2;
      if (d > edge) continue;
      if (d > edge - 1) {
        g.fillStyle = '#120a04';
        g.fillRect(x, y, 1, 1);
        continue;
      }
      // lit from the top left, dark round the far side
      const light = Phaser.Math.Clamp(0.7 - (dx + dy) / (BALL_R * 4) - (d / BALL_R) * 0.25 + (n(x * 2, y * 2) - 0.5) * 0.4, 0, 1);
      const col = mix(0x3a2412, 0x9a6c40, light);
      g.fillStyle = hex(col);
      g.fillRect(x, y, 1, 1);
    }
  // clumps and pebbles stuck in it
  for (let i = 0; i < 10; i++) {
    const a = R() * Math.PI * 2;
    const r = R() * (BALL_R - 3);
    const x = Math.round(c + Math.cos(a) * r);
    const y = Math.round(c + Math.sin(a) * r);
    g.fillStyle = i % 3 === 0 ? '#6a6260' : i % 3 === 1 ? '#2a1a0c' : '#9a7448';
    g.fillRect(x, y, i % 3 === 0 ? 2 : 1, 1);
  }
  // the wet sheen
  g.fillStyle = 'rgba(255,240,210,0.45)';
  g.fillRect(c - 5, c - 6, 3, 1);
  g.fillRect(c - 6, c - 5, 1, 2);
  tex.refresh();
}
