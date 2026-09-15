/**
 * Basketball Hoops.  PRD §9.5 — Medium, 3 tokens in, 6 out.
 *
 * Hold SPACE to charge, release to shoot; W and S tilt the shot while you do.
 * The meter bounces back down at the top so there is no infinite hold.  Five
 * points in sixty seconds, and a miss only costs you time.
 *
 * AND YOU CAN SEE THE SHOT BEFORE YOU TAKE IT.  A dotted arc runs from the
 * ball along the exact parabola the shot would fly — same launch speed, same
 * gravity, same arithmetic the flight itself uses — with a marker where it
 * would cross the rim's height on the way down.  The arc is GREEN when that
 * crossing lands inside the hoop and AMBER when it does not, so "will this go
 * in" stops being a thing you learn by throwing away shots.
 *
 * THE PREDICTION CHASES THE MOVING RIM.  The hoop slides, so the arc works out
 * how long the ball would be in the air and asks where the rim will BE then,
 * not where it is now — and it draws a faint ghost of the rim in that place,
 * under the mark, so the LEAD is the thing on the screen rather than a sum the
 * player is meant to be doing.  Leading a moving target is still their job;
 * the arithmetic of it is not.
 *
 * THE COURT DOES NOT SIT STILL.  Three things stack on top of the plain shot,
 * and all three are readable from the screen without being told:
 *
 *   THE RIM RUNS      it slides across the back of the court, and every score
 *                     makes it 15% quicker AND a little narrower, down to a
 *                     floor — so the last point of a run is the hardest one.
 *   ON FIRE           two in a row lights the ball: it burns, it trails, and
 *                     while it is lit every make is worth two.  One miss puts
 *                     it out, which is what makes the second shot of a streak
 *                     worth more than the first.
 *   THE BONUS RING    a small gold ring drifts across above the hoop now and
 *                     then, for a few seconds only.  Threading it is worth two
 *                     and lights the ball, and it is a genuinely harder shot
 *                     than the hoop under it.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';
import { backdrop, silhouettes } from './decor';


const CHARGE_MS = 1200;
const GRAVITY = 420;
const LAUNCH = { x: 46, y: 150 };
/** Where the shot starts out, and how far W/S can tilt it either way. */
const LAUNCH_ANGLE = -Math.PI / 3.1;
const AIM_MIN = -Math.PI * 0.46; // nearly straight up
const AIM_MAX = -Math.PI * 0.14; // a flat line drive
const AIM_RATE = 1.3; // radians per second held
/** The arrow: this long at zero charge, and this much longer at full. */
const ARROW_MIN = 12;
const ARROW_GROW = 30;
/**
 * The preview arc.
 *
 * `PREVIEW_POWER` is the shot the arc is drawn at while nobody is holding the
 * button — a reference throw, so the aim line means something before the meter
 * has moved.  The moment SPACE goes down the arc switches to the live charge.
 */
const PREVIEW_POWER = 0.55;
const ARC_DOTS = 18;
const ARC_STEP = 0.055;
/** Points, not shots: a make on fire is worth two of them. */
const TARGET_MAKES = 5;
const ROUND_MS = 60_000;
const HOOP_Y = 74;
const HOOP_W = 22;
/** The rim tightens with every score, but never past this. */
const HOOP_W_MIN = 14;
const HOOP_SHRINK = 1.6;
/** Makes in a row before the ball lights up, and what a lit make is worth. */
const FIRE_AT = 2;
const FIRE_POINTS = 2;
/** The bonus ring: how often it comes round, how long it stays, what it pays. */
const RING_EVERY_MS = 13_000;
const RING_UP_MS = 7000;
const RING_POINTS = 2;
const RING_Y = 44;
const RING_R = 7;

let power = 0;
let aim = LAUNCH_ANGLE;
let charging = false;
let chargeDir = 1;
let ball: Phaser.GameObjects.Arc | null = null;
let ballVel = { x: 0, y: 0 };
let inFlight = false;
let hoopX = 220;
let hoopDir = 1;
let hoopSpeed = 60;
let makes = 0;
let timeLeft = ROUND_MS;
let over = false;
let hoopW = HOOP_W;
/** Makes in a row.  Two lights the ball; a miss puts it out. */
let streak = 0;
let onFire = false;
/** The drifting bonus ring, when it is out. */
let ring = { x: 0, dir: 1, up: false, ttl: 0 };
let ringTimer = RING_EVERY_MS;

let meterFill: Phaser.GameObjects.Rectangle | null = null;
let arrow: Phaser.GameObjects.Graphics | null = null;
let aimKeys: { up: Phaser.Input.Keyboard.Key[]; down: Phaser.Input.Keyboard.Key[] } = { up: [], down: [] };
let hoopRim: Phaser.GameObjects.Rectangle | null = null;
let backboard: Phaser.GameObjects.Rectangle | null = null;
let net: Phaser.GameObjects.Rectangle | null = null;
let hud: Phaser.GameObjects.BitmapText | null = null;
let apiRef: MinigameApi | null = null;
let scoredThisFlight = false;
let ringBody: Phaser.GameObjects.Arc | null = null;
let flames: Phaser.GameObjects.Graphics | null = null;
let sceneRef: Phaser.Scene | null = null;

export const hoops: MinigameModule = {
  id: 'hoops',
  title: 'HOOPS',
  music: 'game_hoops',
  rules: '5 points in 60 seconds - streaks pay double',
  tutorial: {
    objective: [
      'SCORE 5 IN 60 SECONDS.',
      'EVERY MAKE RUNS THE RIM FASTER + TIGHTER.',
      'TWO IN A ROW LIGHTS THE BALL: MAKES PAY 2.',
      'THE DOTTED ARC IS GREEN WHEN IT GOES IN.',
    ],
    controls: [
      ['HOLD SPACE', 'CHARGE, LET GO TO SHOOT'],
      ['W / S', 'TILT THE SHOT'],
    ],
  },
  // Hold the button to charge, exactly as the key is held.
  touch: { stick: 'ud', buttons: [{ label: 'SHOOT', key: 'SPACE', primary: true }] },

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    power = 0;
    aim = LAUNCH_ANGLE;
    charging = false;
    chargeDir = 1;
    inFlight = false;
    makes = 0;
    timeLeft = ROUND_MS;
    hoopSpeed = 60;
    hoopX = 220;
    hoopDir = 1;
    over = false;
    hoopW = HOOP_W;
    streak = 0;
    onFire = false;
    ring = { x: 0, dir: 1, up: false, ttl: 0 };
    ringTimer = RING_EVERY_MS;
    sceneRef = scene;

    // A gym: a dark wall, a crowd along the back, a boarded court floor.
    backdrop(scene, 0x232a36, 0x1a1f28, { band: 0.2, speckleColor: 0xffd9a0 });
    scene.add.rectangle(0, 34, GAME_W, 20, 0x2e3644).setOrigin(0, 0);
    silhouettes(scene, 48, 26, 0x141a24, 0.9);
    scene.add.rectangle(0, 54, GAME_W, 2, 0x3a4456).setOrigin(0, 0);
    scene.add.rectangle(0, 160, GAME_W, 20, PALETTE.brown).setOrigin(0, 0);
    scene.add.rectangle(0, 160, GAME_W, 2, PALETTE.brownLight).setOrigin(0, 0);
    for (let x = 0; x < GAME_W; x += 24) scene.add.rectangle(x, 162, 1, 18, 0x5a3e26).setOrigin(0, 0);
    scene.add.rectangle(GAME_W / 2, 161, 1, 19, PALETTE.cream).setOrigin(0.5, 0).setAlpha(0.5);

    backboard = scene.add.rectangle(hoopX, HOOP_Y - 18, 4, 24, PALETTE.bone).setOrigin(0.5, 0);
    hoopRim = scene.add.rectangle(hoopX, HOOP_Y, hoopW, 2, PALETTE.ember).setOrigin(0.5, 0);
    net = scene.add.rectangle(hoopX, HOOP_Y + 2, hoopW - 4, 8, PALETTE.cream).setOrigin(0.5, 0).setAlpha(0.3);

    // The bonus ring lives up above the hoop and is only out some of the time.
    ringBody = scene.add.circle(-20, RING_Y, RING_R, 0x000000, 0).setStrokeStyle(2, PALETTE.gold).setDepth(19).setVisible(false);
    flames = scene.add.graphics().setDepth(21);

    ball = scene.add.circle(LAUNCH.x, LAUNCH.y, 4, PALETTE.ember).setStrokeStyle(1, 0x8a3a10);

    scene.add.rectangle(14, 96, 8, 54, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
    meterFill = scene.add.rectangle(15, 149, 6, 0, PALETTE.gold).setOrigin(0, 1);
    text(scene, 8, 154, 'HOLD', PALETTE.ash);
    text(scene, 8, 162, 'SPACE', PALETTE.ash);
    text(scene, 44, 162, 'W/S AIM', PALETTE.ash);

    arrow = scene.add.graphics().setDepth(30);

    hud = centerText(scene, GAME_W / 2, 26, '', PALETTE.cream);
    refreshHud();

    const kb = scene.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    aimKeys = { up: bind(['W', 'UP']), down: bind(['S', 'DOWN']) };
    kb?.on('keydown-SPACE', () => {
      // A held key auto-repeats keydown.  Without the `charging` guard every
      // repeat reset power to zero, so holding SPACE pinned the meter at empty
      // and the shot always went out at minimum power.
      if (inFlight || over || charging) return;
      charging = true;
      power = 0;
      chargeDir = 1;
    });
    kb?.on('keyup-SPACE', () => {
      if (!charging || over) return;
      charging = false;
      shoot();
    });

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__hoops = {
        state: () => ({
          makes,
          over,
          inFlight,
          charging,
          power: Number(power.toFixed(3)),
          aim: Number(aim.toFixed(3)),
          hoopX: Math.round(hoopX),
          hoopW: Math.round(hoopW),
          ball: ball ? { x: Math.round(ball.x), y: Math.round(ball.y) } : null,
          target: TARGET_MAKES,
        }),
        /**
         * What the arc is telling the player right now: where the shot would
         * come down through the rim's height, where the rim will be when it
         * does, and therefore which colour the dots are.
         */
        predict: (p = power) => {
          const hit = crossing(p);
          if (!hit) return { good: false, reason: 'never reaches the rim' };
          const rim = hoopAt(hit.t);
          return {
            good: Math.abs(hit.x - rim) < hoopW / 2 - 2,
            x: Math.round(hit.x),
            t: Number(hit.t.toFixed(3)),
            rim: Math.round(rim),
            hoopNow: Math.round(hoopX),
          };
        },
        /** Aim and charge exactly as the keys would, then let go. */
        aimAt: (a: number) => {
          aim = Phaser.Math.Clamp(a, AIM_MIN, AIM_MAX);
        },
        shootAt: (p: number) => {
          if (inFlight || over) return false;
          power = Phaser.Math.Clamp(p, 0, 1);
          charging = false;
          shoot();
          return true;
        },
        /** Search the aim/power space for a shot the arc says is good. */
        findGood: () => {
          for (let a = AIM_MIN; a <= AIM_MAX; a += 0.01) {
            for (let p = 0.1; p <= 1; p += 0.02) {
              const was = aim;
              aim = a;
              const hit = crossing(p);
              const ok = hit !== null && Math.abs(hit.x - hoopAt(hit.t)) < hoopW / 2 - 2;
              aim = was;
              if (ok) return { aim: Number(a.toFixed(3)), power: Number(p.toFixed(3)) };
            }
          }
          return null;
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__hoops;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over || !ball || !hoopRim || !backboard || !net) return;
    const dt = delta / 1000;

    timeLeft -= delta;
    if (timeLeft <= 0) {
      finish();
      return;
    }
    refreshHud();

    // ---- hoop slides, and gets faster with every make
    hoopX += hoopDir * hoopSpeed * dt;
    if (hoopX > GAME_W - 30) {
      hoopX = GAME_W - 30;
      hoopDir = -1;
    }
    if (hoopX < 130) {
      hoopX = 130;
      hoopDir = 1;
    }
    hoopRim.x = hoopX;
    hoopRim.setSize(hoopW, 2);
    net.x = hoopX;
    net.setSize(Math.max(2, hoopW - 4), 8);
    backboard.x = hoopX + hoopW / 2 + 2;

    stepRing(dt, delta);

    // ---- aim.  W tilts the shot up, S flattens it.  Works at any time you
    // are not mid-flight, so you can line up before you start charging.
    if (!inFlight) {
      const tilt = (aimKeys.up.some((k) => k.isDown) ? -1 : 0) + (aimKeys.down.some((k) => k.isDown) ? 1 : 0);
      aim = Phaser.Math.Clamp(aim + tilt * AIM_RATE * dt, AIM_MIN, AIM_MAX);
    }
    drawArrow();

    // ---- charge meter, bouncing at the top
    if (charging) {
      power += (chargeDir * delta) / CHARGE_MS;
      if (power >= 1) {
        power = 1;
        chargeDir = -1;
      }
      if (power <= 0) {
        power = 0;
        chargeDir = 1;
      }
      meterFill?.setSize(6, power * 52);
    } else if (!inFlight) {
      meterFill?.setSize(6, 0);
    }

    // ---- flight
    if (inFlight) {
      const prevY = ball.y;
      ballVel.y += GRAVITY * dt;
      ball.x += ballVel.x * dt;
      ball.y += ballVel.y * dt;

      // the bonus ring, on the way up or the way down — it is a hoop with no
      // net and no wrong side
      if (!scoredThisFlight && ring.up && Math.hypot(ball.x - ring.x, ball.y - RING_Y) < RING_R - 1) {
        scoredThisFlight = true;
        ring.up = false;
        ring.ttl = 0;
        ringBody?.setVisible(false);
        ringTimer = RING_EVERY_MS;
        audio.sfx('bell_ding');
        score(RING_POINTS, 'BONUS');
        if (makes >= TARGET_MAKES) {
          finish();
          return;
        }
      }

      // through the rim, downward, within the hoop's mouth
      if (
        !scoredThisFlight &&
        ballVel.y > 0 &&
        prevY <= HOOP_Y &&
        ball.y >= HOOP_Y &&
        Math.abs(ball.x - hoopX) < hoopW / 2 - 2
      ) {
        scoredThisFlight = true;
        hoopSpeed *= 1.15; // PRD §9.5
        hoopW = Math.max(HOOP_W_MIN, hoopW - HOOP_SHRINK);
        audio.sfx('chime');
        score(onFire ? FIRE_POINTS : 1, onFire ? 'ON FIRE' : '');
        if (makes >= TARGET_MAKES) {
          finish();
          return;
        }
      }

      // backboard is real, so bank shots work
      if (
        Math.abs(ball.x - (hoopX + hoopW / 2 + 2)) < 4 &&
        ball.y > HOOP_Y - 18 &&
        ball.y < HOOP_Y + 6 &&
        ballVel.x > 0
      ) {
        ballVel.x = -Math.abs(ballVel.x) * 0.6;
        audio.sfx('ui_hover');
      }

      drawFlames();
      if (ball.y > 158 || ball.x > GAME_W + 10) reset();
    }
  },

  destroy() {
    ball = null;
    hoopRim = null;
    arrow = null;
    ringBody = null;
    flames = null;
    sceneRef = null;
    apiRef = null;
  },
};

/**
 * The launch arrow AND the arc it would fly.
 *
 * Dim while idle, so you can see where you are pointing; bright and growing
 * while SPACE is held, so the length you release at is the shot you get.  Gone
 * while the ball is in the air.
 */
function drawArrow(): void {
  if (!arrow) return;
  arrow.clear();
  if (inFlight || over) return;
  drawArc();
  const len = ARROW_MIN + (charging ? power : 0) * ARROW_GROW;
  const dx = Math.cos(aim);
  const dy = Math.sin(aim);
  const x0 = LAUNCH.x + dx * 6;
  const y0 = LAUNCH.y + dy * 6;
  const x1 = x0 + dx * len;
  const y1 = y0 + dy * len;
  const colour = charging ? PALETTE.gold : PALETTE.ash;
  arrow.lineStyle(charging ? 2 : 1, colour, charging ? 1 : 0.7);
  arrow.beginPath();
  arrow.moveTo(x0, y0);
  arrow.lineTo(x1, y1);
  arrow.strokePath();
  // the head: two short strokes back from the tip
  const h = 5;
  const a = Math.PI * 0.8;
  arrow.beginPath();
  arrow.moveTo(x1, y1);
  arrow.lineTo(x1 + Math.cos(aim + a) * h, y1 + Math.sin(aim + a) * h);
  arrow.moveTo(x1, y1);
  arrow.lineTo(x1 + Math.cos(aim - a) * h, y1 + Math.sin(aim - a) * h);
  arrow.strokePath();
}

/**
 * A score, from the hoop or from the ring.  Points, streak and the fire that
 * comes with it all live here so the two scoring paths cannot disagree.
 */
function score(points: number, note: string): void {
  makes += points;
  streak++;
  if (!onFire && streak >= FIRE_AT) {
    onFire = true;
    audio.sfx('coin_spin');
    ball?.setFillStyle(PALETTE.gold).setStrokeStyle(1, PALETTE.ember);
  }
  if (sceneRef && ball) {
    const label = note || `+${points}`;
    const pop = centerText(sceneRef, ball.x, ball.y - 10, label, onFire ? PALETTE.gold : PALETTE.cream).setDepth(40);
    sceneRef.tweens.add({ targets: pop, y: pop.y - 16, alpha: 0, duration: 620, onComplete: () => pop.destroy() });
  }
  refreshHud();
}

/**
 * The bonus ring's own clock: out of sight most of the time, across the top of
 * the court for a few seconds when its turn comes round.
 */
function stepRing(dt: number, delta: number): void {
  if (ring.up) {
    ring.x += ring.dir * 46 * dt;
    if (ring.x > GAME_W - 24) {
      ring.x = GAME_W - 24;
      ring.dir = -1;
    }
    if (ring.x < 120) {
      ring.x = 120;
      ring.dir = 1;
    }
    ring.ttl -= delta;
    ringBody?.setPosition(ring.x, RING_Y);
    // it blinks out rather than vanishing mid-shot with no warning
    ringBody?.setAlpha(ring.ttl < 1500 && Math.floor(ring.ttl / 150) % 2 === 0 ? 0.25 : 1);
    if (ring.ttl <= 0) {
      ring.up = false;
      ringBody?.setVisible(false);
      ringTimer = RING_EVERY_MS;
    }
    return;
  }
  ringTimer -= delta;
  if (ringTimer <= 0) {
    ring = { x: 130 + Math.random() * 120, dir: Math.random() < 0.5 ? -1 : 1, up: true, ttl: RING_UP_MS };
    ringBody?.setPosition(ring.x, RING_Y).setAlpha(1).setVisible(true);
    audio.sfx('ui_blip');
  }
}

/** The trail on a lit ball.  Nothing but decoration, and the point of it. */
function drawFlames(): void {
  if (!flames) return;
  flames.clear();
  if (!onFire || !ball || !inFlight) return;
  for (let i = 1; i <= 4; i++) {
    const t = i * 0.028;
    const x = ball.x - ballVel.x * t;
    const y = ball.y - ballVel.y * t;
    flames.fillStyle(i < 3 ? PALETTE.gold : PALETTE.ember, 0.55 - i * 0.1);
    flames.fillCircle(x, y, 4 - i * 0.7);
  }
}

/** The launch speed for a given charge.  One definition, used by both the
 * shot and the arc that predicts it — so the preview cannot drift from the
 * thing it is previewing. */
function launchSpeed(p: number): number {
  return 150 + p * 300;
}

/**
 * Where the shot would cross the rim's height ON THE WAY DOWN, and when.
 *
 * Straight out of the same parabola the flight integrates: solve
 * `y0 + vy t + gt^2/2 = HOOP_Y` and take the later root, which is the
 * descending crossing — the only one a ball can actually drop through a hoop
 * on.  Null when the shot never gets that high, which is itself the answer.
 */
function crossing(p: number): { x: number; t: number } | null {
  const speed = launchSpeed(p);
  const vy = Math.sin(aim) * speed;
  const vx = Math.cos(aim) * speed;
  const a = GRAVITY / 2;
  const c = LAUNCH.y - HOOP_Y;
  const disc = vy * vy - 4 * a * c;
  if (disc < 0) return null;
  const t = (-vy + Math.sqrt(disc)) / (2 * a);
  if (t <= 0) return null;
  return { x: LAUNCH.x + vx * t, t };
}

/**
 * Where the rim will be in `t` seconds.
 *
 * Walked forward rather than solved, because the rim turns round at the walls
 * and a closed form for a bouncing interval is more code than the loop is.
 */
function hoopAt(t: number): number {
  let x = hoopX;
  let dir = hoopDir;
  let left = t;
  const dt = 1 / 60;
  while (left > 0) {
    const step = Math.min(dt, left);
    x += dir * hoopSpeed * step;
    if (x > GAME_W - 30) {
      x = GAME_W - 30;
      dir = -1;
    } else if (x < 130) {
      x = 130;
      dir = 1;
    }
    left -= step;
  }
  return x;
}

/** Would the shot at this charge drop through the rim?  The scoring test, asked early. */
export function wouldScore(p: number): boolean {
  const hit = crossing(p);
  if (!hit) return false;
  return Math.abs(hit.x - hoopAt(hit.t)) < hoopW / 2 - 2;
}

function shoot(): void {
  if (!ball) return;
  const speed = launchSpeed(power);
  // Exactly the direction the arrow was drawn in.
  ballVel = { x: Math.cos(aim) * speed, y: Math.sin(aim) * speed };
  inFlight = true;
  scoredThisFlight = false;
  audio.sfx('whack');
}

/**
 * The dotted flight path, and the mark where it would fall through the rim.
 *
 * Dots rather than a line, because a solid parabola over a busy court reads as
 * a piece of scenery; a dotted one reads as a prediction.  They thin out as
 * they go, so the near end — the part the player is steering — is the loudest
 * part of it.
 */
function drawArc(): void {
  if (!arrow) return;
  const p = charging ? power : PREVIEW_POWER;
  const speed = launchSpeed(p);
  const vx = Math.cos(aim) * speed;
  const vy = Math.sin(aim) * speed;
  const hit = crossing(p);
  const good = hit !== null && Math.abs(hit.x - hoopAt(hit.t)) < hoopW / 2 - 2;
  const colour = good ? PALETTE.mossLight : PALETTE.amber;
  const alpha = charging ? 1 : 0.5;

  arrow.fillStyle(colour, alpha);
  for (let i = 1; i <= ARC_DOTS; i++) {
    const t = i * ARC_STEP;
    const x = LAUNCH.x + vx * t;
    const y = LAUNCH.y + vy * t + (GRAVITY * t * t) / 2;
    if (x > GAME_W + 4 || y > 176) break;
    if (y < 20) continue;
    arrow.fillCircle(x, y, i < ARC_DOTS / 2 ? 1.4 : 1);
  }

  if (!hit) return;

  // WHERE THE RIM WILL BE, faint, under where the ball will come down.  The
  // hoop slides, so the mark on its own only answers half the question — "it
  // lands there" means nothing without "and the rim is there by then".  Drawn
  // as a hollow bar in the rim's own width, it makes the lead the thing you
  // are steering rather than a number you are meant to have in your head.
  const rim = hoopAt(hit.t);
  arrow.lineStyle(1, PALETTE.fog, alpha * 0.55);
  arrow.strokeRect(rim - hoopW / 2, HOOP_Y - 3, hoopW, 6);

  // The mark: where it would come down through the rim's height, and whether
  // that is inside the rim.  A ring when it is, a cross when it is not.
  arrow.lineStyle(1, colour, alpha);
  if (good) {
    arrow.strokeCircle(hit.x, HOOP_Y, 4);
  } else {
    arrow.beginPath();
    arrow.moveTo(hit.x - 3, HOOP_Y - 3);
    arrow.lineTo(hit.x + 3, HOOP_Y + 3);
    arrow.moveTo(hit.x + 3, HOOP_Y - 3);
    arrow.lineTo(hit.x - 3, HOOP_Y + 3);
    arrow.strokePath();
  }
}

function reset(): void {
  if (!ball) return;
  // A flight that scored nothing is a miss, and a miss puts the fire out.
  if (!scoredThisFlight && onFire) {
    onFire = false;
    audio.sfx('ui_hover', 0.5);
  }
  if (!scoredThisFlight) streak = 0;
  ball.setFillStyle(PALETTE.ember).setStrokeStyle(1, 0x8a3a10);
  flames?.clear();
  inFlight = false;
  ball.setPosition(LAUNCH.x, LAUNCH.y);
  ballVel = { x: 0, y: 0 };
  power = 0;
  meterFill?.setSize(6, 0);
}

function refreshHud(): void {
  const fire = onFire ? '  ON FIRE x2' : streak === 1 ? '  STREAK 1' : '';
  hud?.setText(`SCORE ${makes}/${TARGET_MAKES}    ${Math.ceil(timeLeft / 1000)}s${fire}`);
  hud?.setTint(onFire ? PALETTE.gold : PALETTE.cream);
}

function finish(): void {
  if (over) return;
  over = true;
  arrow?.clear();
  flames?.clear();
  const won = makes >= TARGET_MAKES;
  ball?.scene.time.delayedCall(500, () => (won ? apiRef?.win() : apiRef?.lose()));
}
