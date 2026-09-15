/**
 * FROGGY PINBALL.  Hard — 7 tokens in, 15 out.
 *
 * A real table, not a picture of one: a ball with momentum, two flippers on
 * hinges, bumpers that kick, a ramp that loops it back to the top, drop
 * targets that stay down, and three balls before the glass goes dark.
 *
 * IT IS A FROG TABLE ALL THE WAY DOWN.  The bumpers are lily pads that flash
 * and croak when they are hit; the drop targets spell F-R-O-G and clearing all
 * four lights the LOOP for double; the ramp is a log flume up the left side;
 * and the thing at the top of the playfield is Froggy himself, who blinks, and
 * whose mouth is worth more than anything else on the table.
 *
 * THE BAR IS A SCORE, NOT A SURVIVAL.  Three balls, and 2000 points banks the
 * cabinet's fifteen.  That is deliberately reachable off two decent balls
 * rather than a perfect three — a seven-token machine that needs a flawless
 * run is a seven-token machine nobody plays twice — and the score is the thing
 * the player is actually competing with, kept per profile.
 *
 * THE PHYSICS ARE HAND-ROLLED AND DELIBERATELY SO.  Phaser's arcade physics
 * cannot do a flipper, and a full physics engine is a dependency for one
 * cabinet.  What is here is circle-versus-segment reflection with restitution,
 * which is all a pinball table has ever needed: everything solid is either a
 * line segment or a circle, and both know how to bounce a ball.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'pinball' as const;

/** The score that banks the cabinet's reward. */
export const TARGET_SCORE = 2000;
export const BALLS = 3;

/** The glass: the playfield's own bounds, inside the cabinet art. */
const FIELD_L = 40;
const FIELD_R = 268;
const FIELD_T = 24;
const FIELD_B = 178;
/** The drain, between the flipper tips.  Anything down here is a lost ball. */
const DRAIN_L = 128;
const DRAIN_R = 180;

const BALL_R = 3.2;
const GRAVITY = 190;
const MAX_SPEED = 260;
/** How much of its speed the ball keeps off a wall, and off a flipper. */
const WALL_BOUNCE = 0.74;
const BUMPER_KICK = 118;

/**
 * The flippers.
 *
 * THEY HINGE ON THE OUTSIDE AND POINT IN, which is the only way a pinball
 * flipper has ever been built: the pivot sits out by the wall and the tip
 * reaches in toward the drain, so raising one sweeps the ball up the middle of
 * the table.  Hinged the other way round — pivot at the drain, tip swinging
 * out — they look like a pair of wipers and flick everything into the gutter.
 */
const FLIP_Y = 146;
const FLIP_LEN = 30;
/** Radians below horizontal at rest, and above it when the flipper is up. */
const FLIP_REST = 0.42;
const FLIP_UP = -0.52;
const FLIP_RATE = 15;
/** Where the two pivots sit, either side of the drain mouth. */
const HINGE_L = 96;
const HINGE_R = 212;

interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  bounce: number;
}

interface Bumper {
  x: number;
  y: number;
  r: number;
  score: number;
  lit: number;
  art: Phaser.GameObjects.Arc;
  ring: Phaser.GameObjects.Arc;
}

interface Target {
  x: number;
  y: number;
  letter: string;
  down: boolean;
  art: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
}

let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let over = false;
let score = 0;
let best = 0;
let balls = BALLS;
/** Null between balls: the plunger lane is holding the next one. */
let ball: { x: number; y: number; vx: number; vy: number } | null = null;
let launching = true;
let plunger = 0;
let multiplier = 1;
let loopLit = false;
let segs: Seg[] = [];
let bumpers: Bumper[] = [];
let targets: Target[] = [];
let flipL = FLIP_REST;
let flipR = FLIP_REST;
let flipLWant = FLIP_REST;
let flipRWant = FLIP_REST;
let ballArt: Phaser.GameObjects.Arc | null = null;
let flipLArt: Phaser.GameObjects.Rectangle | null = null;
let flipRArt: Phaser.GameObjects.Rectangle | null = null;
let mouth: Phaser.GameObjects.Ellipse | null = null;
let eyes: Phaser.GameObjects.Arc[] = [];
let blink = 0;
let hud: {
  score: Phaser.GameObjects.BitmapText;
  balls: Phaser.GameObjects.BitmapText;
  best: Phaser.GameObjects.BitmapText;
  mult: Phaser.GameObjects.BitmapText;
  note: Phaser.GameObjects.BitmapText;
  plunger: Phaser.GameObjects.Rectangle;
} | null = null;
let keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};

const held = (g: string): boolean => keys[g]?.some((k) => k.isDown) ?? false;

export const pinball: MinigameModule = {
  id: ID,
  title: 'FROGGY PINBALL',
  music: 'game_pinball',
  rules: 'three balls, two thousand points',
  payoutNote: 'WIN: 15 TOKENS',
  tutorial: {
    objective: [
      'THREE BALLS. SCORE 2000 TO WIN.',
      'LILY PADS KICK. FROGGY’S MOUTH PAYS 300.',
      'DROP F-R-O-G TO LIGHT THE LOOP FOR 2X.',
      'LOSE A BALL DOWN THE MIDDLE AND IT IS GONE.',
    ],
    controls: [
      ['A / LEFT', 'LEFT FLIPPER'],
      ['D / RIGHT', 'RIGHT FLIPPER'],
      ['HOLD SPACE', 'PULL THE PLUNGER, LET GO TO FIRE'],
    ],
  },
  touch: {
    buttons: [
      { label: '◀', key: 'A' },
      { label: 'FIRE', key: 'SPACE', primary: true },
      { label: '▶', key: 'D' },
    ],
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    over = false;
    score = 0;
    best = store.highScore(ID);
    balls = BALLS;
    multiplier = 1;
    loopLit = false;
    launching = true;
    plunger = 0;
    blink = 0;
    ball = null;
    segs = [];
    bumpers = [];
    targets = [];
    eyes = [];
    flipL = flipLWant = FLIP_REST;
    flipR = flipRWant = FLIP_REST;

    buildTable(scene);
    ballArt = scene.add.circle(0, 0, BALL_R, PALETTE.bone).setDepth(30).setVisible(false);

    hud = {
      score: text(scene, 4, 21, '', PALETTE.gold).setDepth(40),
      balls: text(scene, GAME_W - 4, 21, '', PALETTE.cream).setOrigin(1, 0).setDepth(40),
      best: text(scene, 4, 170, '', PALETTE.ash).setDepth(40),
      mult: centerText(scene, GAME_W / 2, 21, '', PALETTE.neon).setDepth(40),
      note: centerText(scene, GAME_W / 2, 92, '', PALETTE.gold, 16).setDepth(50).setVisible(false),
      plunger: scene.add.rectangle(GAME_W - 26, FIELD_B - 6, 5, 0, PALETTE.ember).setOrigin(0, 1).setDepth(28),
    };

    const kb = scene.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    keys = { left: bind(['A', 'LEFT']), right: bind(['D', 'RIGHT']), fire: bind(['SPACE']) };
    kb?.on('keyup-SPACE', () => fire());

    newBall();
    refreshHud();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__pin = {
        state: () => ({
          score,
          best,
          balls,
          multiplier,
          loopLit,
          launching,
          over,
          ball: ball ? { x: Math.round(ball.x), y: Math.round(ball.y), vx: Math.round(ball.vx), vy: Math.round(ball.vy) } : null,
          targets: targets.map((t) => ({ letter: t.letter, down: t.down })),
          target: TARGET_SCORE,
        }),
        /** Put the ball somewhere with a velocity, for testing the table. */
        setBall: (x: number, y: number, vx = 0, vy = 0) => {
          launching = false;
          ball = { x, y, vx, vy };
        },
        setScore: (n: number) => {
          score = n;
          refreshHud();
        },
        flip: (side: 'left' | 'right', up: boolean) => {
          if (side === 'left') flipLWant = up ? FLIP_UP : FLIP_REST;
          else flipRWant = up ? FLIP_UP : FLIP_REST;
        },
        fire: () => {
          plunger = 1;
          fire();
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__pin;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over || !sceneRef) return;
    const dt = Math.min(0.033, delta / 1000);

    // ---- the flippers.  They swing rather than snap, because a flipper that
    // teleported would put the ball through itself.
    flipLWant = held('left') ? FLIP_UP : FLIP_REST;
    flipRWant = held('right') ? FLIP_UP : FLIP_REST;
    const swing = (a: number, want: number) => a + Phaser.Math.Clamp(want - a, -FLIP_RATE * dt, FLIP_RATE * dt);
    const lWas = flipL;
    const rWas = flipR;
    flipL = swing(flipL, flipLWant);
    flipR = swing(flipR, flipRWant);

    // ---- the plunger
    if (launching) {
      if (held('fire')) plunger = Math.min(1, plunger + dt * 1.6);
      hud?.plunger.setSize(5, plunger * 26);
    } else {
      hud?.plunger.setSize(5, 0);
    }

    if (ball && !launching) step(dt, flipL - lWas, flipR - rWas);

    blink += delta;
    const shut = blink % 3400 < 130;
    for (const e of eyes) e.setScale(1, shut ? 0.15 : 1);

    draw();
    refreshHud();
  },

  destroy() {
    segs = [];
    bumpers = [];
    targets = [];
    eyes = [];
    ball = null;
    ballArt = null;
    flipLArt = null;
    flipRArt = null;
    mouth = null;
    hud = null;
    keys = {};
    sceneRef = null;
    apiRef = null;
  },
};

// ------------------------------------------------------------------ the table

function seg(x1: number, y1: number, x2: number, y2: number, bounce = WALL_BOUNCE): void {
  segs.push({ x1, y1, x2, y2, bounce });
}

function buildTable(scene: Phaser.Scene): void {
  // ---- the cabinet the glass is set into
  scene.add.rectangle(0, 18, GAME_W, 162, 0x120b1e).setOrigin(0, 0);
  scene.add.rectangle(FIELD_L - 6, FIELD_T - 4, FIELD_R - FIELD_L + 12, FIELD_B - FIELD_T + 8, 0x1d4a2e).setOrigin(0, 0);
  scene.add.rectangle(FIELD_L - 6, FIELD_T - 4, FIELD_R - FIELD_L + 12, 3, 0x2f7a49).setOrigin(0, 0);
  // pond dressing: reeds down the sides and a couple of ripples on the felt
  for (let i = 0; i < 12; i++) {
    const y = FIELD_T + 6 + i * 13;
    scene.add.rectangle(FIELD_L - 4, y, 3, 8, 0x2f7a49).setOrigin(0, 0).setAlpha(0.7);
    scene.add.rectangle(FIELD_R + 1, y + 5, 3, 8, 0x2f7a49).setOrigin(0, 0).setAlpha(0.7);
  }
  for (const [rx, ry, rr] of [
    [90, 66, 15],
    [210, 108, 12],
    [150, 132, 18],
  ] as const) {
    scene.add.circle(rx, ry, rr, 0x2a5f3c).setAlpha(0.35).setDepth(1);
  }

  // ---- the walls.  Everything solid on this table is one of these segments.
  seg(FIELD_L, FIELD_T, FIELD_R, FIELD_T); // the top rail
  seg(FIELD_L, FIELD_T, FIELD_L, FIELD_B); // left wall
  seg(FIELD_R, FIELD_T, FIELD_R, FIELD_B); // right wall
  // The two slopes that funnel a dying ball down onto the flipper pivots.
  seg(FIELD_L, 116, HINGE_L, FLIP_Y);
  seg(FIELD_R - 18, 116, HINGE_R, FLIP_Y);
  // The plunger lane: a wall up the right side with a one-way gap at the top,
  // so a fired ball goes up it and never comes back down it.
  seg(FIELD_R - 18, FIELD_B, FIELD_R - 18, FIELD_T + 22);
  // The log flume: a rail up the left that returns a looping ball to the top.
  seg(FIELD_L + 16, 108, FIELD_L + 16, FIELD_T + 16);
  seg(FIELD_L + 16, FIELD_T + 16, FIELD_L + 40, FIELD_T + 6);
  for (const s of segs) {
    scene.add
      .line(0, 0, s.x1, s.y1, s.x2, s.y2, 0x3f8f56)
      .setOrigin(0, 0)
      .setLineWidth(1)
      .setDepth(2)
      .setAlpha(0.8);
  }

  // ---- the lily pads.  Three in a triangle, where a ball off the top rail
  // will find them, and they kick hard enough to keep it alive.
  for (const [bx, by, sc] of [
    [110, 62, 60],
    [168, 54, 60],
    [140, 92, 80],
  ] as const) {
    const art = scene.add.circle(bx, by, 9, 0x54b36a).setDepth(4).setStrokeStyle(1, 0x8fe3a3);
    const ring = scene.add.circle(bx, by, 12, 0xffffff, 0).setDepth(3).setStrokeStyle(1, PALETTE.cream, 0);
    bumpers.push({ x: bx, y: by, r: 9, score: sc, lit: 0, art, ring });
    // the notch that makes a circle read as a lily pad rather than a button
    scene.add.triangle(bx, by, 0, 0, 9, -4, 9, 4, 0x1d4a2e).setDepth(5).setAngle(90);
  }

  // ---- F R O G, across the middle.  They stay down once dropped.
  'FROG'.split('').forEach((letter, i) => {
    const tx = 78 + i * 34;
    const ty = 118;
    const art = scene.add.rectangle(tx, ty, 16, 7, PALETTE.gold).setDepth(4).setStrokeStyle(1, 0x7a5c14);
    const label = centerText(scene, tx, ty - 3, letter, PALETTE.ink).setDepth(5);
    targets.push({ x: tx, y: ty, letter, down: false, art, label });
  });

  // ---- Froggy, at the top of the playfield, with the mouth that pays.
  const fx = GAME_W / 2 - 10;
  scene.add.ellipse(fx, FIELD_T + 16, 44, 26, 0x6fbb6a).setDepth(3);
  scene.add.ellipse(fx, FIELD_T + 20, 30, 14, 0x9ad97f).setDepth(4);
  for (const side of [-1, 1]) {
    scene.add.circle(fx + side * 13, FIELD_T + 6, 7, 0x6fbb6a).setDepth(4);
    const white = scene.add.circle(fx + side * 13, FIELD_T + 6, 5, PALETTE.cream).setDepth(5);
    eyes.push(white);
    scene.add.circle(fx + side * 13, FIELD_T + 6, 2, PALETTE.black).setDepth(6);
  }
  mouth = scene.add.ellipse(fx, FIELD_T + 22, 18, 9, 0x3a1020).setDepth(5).setStrokeStyle(1, PALETTE.gold);

  flipLArt = scene.add.rectangle(0, 0, FLIP_LEN, 5, PALETTE.neon).setOrigin(0, 0.5).setDepth(20);
  flipRArt = scene.add.rectangle(0, 0, FLIP_LEN, 5, PALETTE.neon).setOrigin(0, 0.5).setDepth(20);
}

/** Where a flipper's tip is right now, given its pivot and its angle. */
function flipperTip(side: -1 | 1, angle: number): { hx: number; hy: number; tx: number; ty: number; a: number } {
  const hx = side < 0 ? HINGE_L : HINGE_R;
  const hy = FLIP_Y;
  // The left arm reaches right, the right arm reaches left; both drop below
  // the horizontal at rest and rise above it when the button is held.
  const a = side < 0 ? angle : Math.PI - angle;
  return { hx, hy, tx: hx + Math.cos(a) * FLIP_LEN, ty: hy + Math.sin(a) * FLIP_LEN, a };
}

// ------------------------------------------------------------------ the ball

function newBall(): void {
  launching = true;
  plunger = 0;
  ball = { x: FIELD_R - 9, y: FIELD_B - 14, vx: 0, vy: 0 };
  // Every ball puts the letters back up: they are a shot to make, not a
  // one-off, and a table that only offers its multiplier once is a table you
  // stop aiming at after twenty seconds.
  for (const t of targets) {
    t.down = false;
    t.art.setVisible(true);
    t.label.setVisible(true);
  }
  multiplier = 1;
  loopLit = false;
}

function fire(): void {
  if (over || !launching || !ball) return;
  const power = Math.max(0.35, plunger);
  ball.vy = -(140 + power * 120);
  ball.vx = -8;
  launching = false;
  plunger = 0;
  audio.sfx('throw_whoosh', 0.5);
}

/**
 * One step of the table.
 *
 * Substepped, because a ball at 260 px/s and a 3-pixel radius will tunnel
 * straight through a one-pixel wall at 60fps if it is moved in one go.  Five
 * sub-steps puts the worst-case move under a radius.
 */
function step(dt: number, dFlipL: number, dFlipR: number): void {
  const N = 5;
  const h = dt / N;
  for (let i = 0; i < N && ball && !over; i++) {
    ball.vy += GRAVITY * h;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > MAX_SPEED) {
      ball.vx *= MAX_SPEED / sp;
      ball.vy *= MAX_SPEED / sp;
    }
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
    collide(dFlipL / N, dFlipR / N);
  }
}

function collide(dFlipL: number, dFlipR: number): void {
  if (!ball) return;

  for (const s of segs) bounceSeg(s.x1, s.y1, s.x2, s.y2, s.bounce, 0);

  // ---- the flippers, as moving segments.  A flipper on its way up adds its
  // own swing to the ball, which is where a pinball's power comes from.
  for (const side of [-1, 1] as const) {
    const angle = side < 0 ? flipL : flipR;
    const d = side < 0 ? dFlipL : dFlipR;
    const { hx, hy, tx, ty } = flipperTip(side, angle);
    if (bounceSeg(hx, hy, tx, ty, 0.62, d < 0 ? 200 : 0)) audio.sfx('fence_thunk', 0.4);
  }

  // ---- the lily pads
  for (const b of bumpers) {
    const dx = ball.x - b.x;
    const dy = ball.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d >= b.r + BALL_R || d === 0) continue;
    const nx = dx / d;
    const ny = dy / d;
    ball.x = b.x + nx * (b.r + BALL_R + 0.5);
    ball.y = b.y + ny * (b.r + BALL_R + 0.5);
    const into = ball.vx * nx + ball.vy * ny;
    ball.vx += nx * (BUMPER_KICK - into * 1.4);
    ball.vy += ny * (BUMPER_KICK - into * 1.4);
    b.lit = 260;
    add(b.score);
    audio.sfx('hop_wet', 0.45);
  }

  // ---- the letters
  for (const t of targets) {
    if (t.down) continue;
    if (Math.abs(ball.x - t.x) > 8 + BALL_R || Math.abs(ball.y - t.y) > 3.5 + BALL_R) continue;
    t.down = true;
    t.art.setVisible(false);
    t.label.setVisible(false);
    ball.vy = -Math.abs(ball.vy) * 0.6 - 30;
    add(120);
    audio.sfx('ui_blip', 0.6);
    if (targets.every((o) => o.down)) {
      loopLit = true;
      multiplier = 2;
      note('F-R-O-G!  LOOP LIT  2X');
      audio.sfx('chime', 0.6);
    }
  }

  // ---- Froggy's mouth, which is the whole reason to aim at the top
  if (mouth && Math.abs(ball.x - mouth.x) < 9 && Math.abs(ball.y - mouth.y) < 5) {
    add(300);
    note('GULP!  300');
    audio.sfx('vault', 0.5);
    // spat back down the table, hard
    ball.vy = 150;
    ball.vx = Phaser.Math.Between(-40, 40);
  }

  // ---- the loop at the top of the flume, worth double when it is lit
  if (loopLit && ball.y < FIELD_T + 12 && ball.x < FIELD_L + 46) {
    add(400);
    note('LOOP!  400');
    audio.sfx('coin_spin', 0.5);
    loopLit = false;
  }

  // ---- the drain
  if (ball.y > FIELD_B - 2) {
    if (ball.x > DRAIN_L && ball.x < DRAIN_R) loseBall();
    else {
      // the outlanes kick it back out rather than swallowing it
      ball.y = FIELD_B - 3;
      ball.vy = -Math.abs(ball.vy) * 0.5 - 20;
    }
  }
}

/**
 * Bounce the ball off a line segment, if it is touching one.
 *
 * `push` is extra speed along the normal, which is how a flipper on its way up
 * hits harder than a flipper standing still.  Returns whether it touched.
 */
function bounceSeg(x1: number, y1: number, x2: number, y2: number, bounce: number, push: number): boolean {
  if (!ball) return false;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return false;
  const t = Phaser.Math.Clamp(((ball.x - x1) * dx + (ball.y - y1) * dy) / len2, 0, 1);
  const cx = x1 + dx * t;
  const cy = y1 + dy * t;
  let nx = ball.x - cx;
  let ny = ball.y - cy;
  const d = Math.hypot(nx, ny);
  if (d >= BALL_R || d === 0) return false;
  nx /= d;
  ny /= d;
  ball.x = cx + nx * (BALL_R + 0.4);
  ball.y = cy + ny * (BALL_R + 0.4);
  const into = ball.vx * nx + ball.vy * ny;
  if (into < 0) {
    ball.vx -= (1 + bounce) * into * nx;
    ball.vy -= (1 + bounce) * into * ny;
  }
  if (push > 0) {
    ball.vx += nx * push;
    ball.vy += ny * push;
  }
  return true;
}

function add(n: number): void {
  score += n * multiplier;
  if (score > best) best = score;
}

function note(msg: string): void {
  if (!hud || !sceneRef) return;
  hud.note.setText(msg).setVisible(true).setAlpha(1);
  sceneRef.tweens.killTweensOf(hud.note);
  sceneRef.tweens.add({ targets: hud.note, alpha: 0, delay: 900, duration: 500 });
}

function loseBall(): void {
  if (!sceneRef || over) return;
  balls -= 1;
  ball = null;
  audio.sfx('buzzer', 0.4);
  sceneRef.cameras.main.shake(180, 0.006);
  if (balls <= 0) {
    finish();
    return;
  }
  note(`BALL ${BALLS - balls + 1}`);
  sceneRef.time.delayedCall(900, () => {
    if (!over) newBall();
  });
}

function finish(): void {
  if (over || !sceneRef) return;
  over = true;
  const won = score >= TARGET_SCORE;
  store.setHighScore(ID, score);
  hud?.note.setText(won ? `${score}  -  YOU WIN` : `${score}  -  GAME OVER`).setVisible(true).setAlpha(1);
  hud?.note.setTint(won ? PALETTE.gold : PALETTE.blood);
  audio.sfx(won ? 'chime' : 'buzzer');
  if (won) sceneRef.cameras.main.flash(220, 255, 240, 180);
  // MG-3: the shell pays, once, and it is the only thing that moves tokens.
  sceneRef.time.delayedCall(1500, () => (won ? apiRef?.win() : apiRef?.lose()));
}

function draw(): void {
  if (ballArt) {
    ballArt.setVisible(ball !== null);
    if (ball) ballArt.setPosition(ball.x, ball.y);
  }
  for (const side of [-1, 1] as const) {
    const art = side < 0 ? flipLArt : flipRArt;
    const { hx, hy, a } = flipperTip(side, side < 0 ? flipL : flipR);
    art?.setPosition(hx, hy).setRotation(a);
  }
  for (const b of bumpers) {
    if (b.lit > 0) b.lit -= 16;
    const t = Math.max(0, b.lit) / 260;
    b.art.setFillStyle(t > 0 ? 0x8fe3a3 : 0x54b36a);
    b.ring.setStrokeStyle(1, PALETTE.cream, t);
    b.ring.setRadius(12 + t * 4);
  }
}

function refreshHud(): void {
  if (!hud) return;
  hud.score.setText(`${score}`);
  hud.score.setTint(score >= TARGET_SCORE ? PALETTE.mossLight : PALETTE.gold);
  hud.balls.setText(`BALL ${Math.min(BALLS, BALLS - balls + 1)}/${BALLS}`);
  hud.best.setText(`BEST ${best}   NEED ${TARGET_SCORE}`);
  hud.mult.setText(multiplier > 1 ? '2X' : '');
}
