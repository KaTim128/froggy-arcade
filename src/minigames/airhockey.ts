/**
 * Air Hockey.  PRD §9.4 — Easy, 1 token in, 3 out.
 *
 * Mouse paddle in the player's half, first to 5, 180s cap, a tie refunds.
 * The AI tracks the puck's predicted intercept with a deliberate 140ms reaction
 * delay and an aim error, so it is beatable by feints (VOC-20).
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';
import { isTouch } from '../core/device';


const TABLE = { x: 70, y: 22, w: 180, h: 152 };
const GOAL_W = 64;
/**
 * The cooldown between rounds: three seconds with the puck sat on the spot.
 * Also used for the first face-off, so the opening of a game and the restart
 * after a goal are the same beat rather than two different ones.
 */
const ROUND_GAP_MS = 3000;
const PUCK_R = 4;
const PAD_R = 9;
/**
 * How close a mallet may get to the puck while the count is running: touching
 * it, plus a little daylight so it reads as being held off rather than as
 * being stuck to it.
 */
const KEEP_OFF = PAD_R + PUCK_R + 3;
const MAX_SPEED = 520;
// Hard tier: it reads the puck sooner and misjudges it less.  At 140ms/18px it
// was a warm-up opponent; the cabinet costs five tokens now.
const AI_REACTION_MS = 66;
const AI_AIM_ERROR = 6.8;
/**
 * How fast it can move its mallet.
 *
 * It was 150 against a puck that tops out at 520, so a well struck shot simply
 * went past it -- the opponent could only ever cover a shot it was already
 * standing in front of.
 *
 * TUNED BY MEASUREMENT, because "a little harder but not unbeatable" is a win
 * rate and nothing else.  Against one fixed scripted player, held identical
 * across every run:
 *
 *     150 / 70ms / 7px     player won 2 of 6, 19 goals for, 25 against
 *     188 / 55ms / 5.5px   player won 0 of 6,  3 goals for, 30 against
 *     164 / 63ms / 6.4px   player won 0 of 6,  5 goals for, 30 against
 *
 * The middle row is the warning: that is not a harder opponent, it is one you
 * cannot score on, and it went in as an improvement before it was measured.
 *
 * The third row is a warning about the YARDSTICK.  That scripted player moves
 * its mallet at about 186 px/s, so the win rate falls off a cliff exactly
 * where the opponent's speed crosses the player's own -- which says more
 * about the probe than about the game.  A hand on a mouse is far quicker than
 * that, so the tuning here is deliberately a small step over the original and
 * is checked against a faster probe player as well as the slow one:
 *
 *     158 / 66ms / 6.8px, probe player at 288 px/s
 *         player won 1 of 6, 10 goals for, 27 against -- one of them 4-2
 *
 * Harder than it was, and still losable by the machine: there is a real win
 * in there rather than a shutout.  If it wants softening, AI_SPEED is the
 * dial -- it is the one that moved the numbers most.
 */
const AI_SPEED = 158;
const TARGET_SCORE = 5;
const TIME_CAP_MS = 180_000;

interface Vec {
  x: number;
  y: number;
}

let puck: Phaser.GameObjects.Arc | null = null;
let pad: Phaser.GameObjects.Arc | null = null;
let aiPad: Phaser.GameObjects.Arc | null = null;
/** The faces on the two strikers, moved with them every frame. */
let padFace: Phaser.GameObjects.GameObject[] = [];
let aiFace: Phaser.GameObjects.GameObject[] = [];
let vel: Vec = { x: 0, y: 0 };
let padPrev: Vec = { x: 0, y: 0 };
/** Who conceded the last goal, which is all the AI does with the face-off. */
let openingDir = 1;
let history: Array<{ t: number; x: number; y: number }> = [];
let scoreP = 0;
let scoreA = 0;
let scoreText: Phaser.GameObjects.BitmapText | null = null;
/** The face-off count, big, on the centre spot. */
let countText: Phaser.GameObjects.BitmapText | null = null;
let elapsed = 0;
let frozen = 0;
/**
 * Whether your mallet may touch the puck yet, this round.  Not until you have
 * taken it off the ring the count held it on (or the puck is already moving):
 * see the face-off note in `update`.
 */
let armed = false;
let over = false;
let apiRef: MinigameApi | null = null;

export const airHockey: MinigameModule = {
  id: 'airhockey',
  title: 'AIR HOCKEY',
  music: 'game_airhockey',
  rules: 'first to 5 - 10 in, 20 out',
  tutorial: {
    objective: [
      'YOU AGAINST THE LIZARD. FIRST TO FIVE.',
      'TEN TOKENS IN, TWENTY BACK ON A WIN.',
      'THREE SECONDS ON THE SPOT AFTER A GOAL.',
      'USE THEM - GET BACK INTO YOUR OWN HALF.',
      ...(isTouch() ? ['UPRIGHT: DRAG IN THE PAD UNDER THE TABLE.'] : []),
    ],
    controls: [
      ['MOUSE', 'MOVES YOUR MALLET'],
    ],
  },
  // The paddle follows the finger, the way it follows the mouse.
  touch: {},

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    scoreP = 0;
    scoreA = 0;
    elapsed = 0;
    over = false;
    history = [];

    paintArena(scene);
    // the table: a wooden rail, then the playing surface with its markings
    // (painted, not flat fills: the rail in grained wood, the surface a
    // glossy teal laminate full of air holes, lit from above)
    scene.add.image(TABLE.x - 6, TABLE.y - 6, paintTable(scene)).setOrigin(0, 0);
    scene.add
      .rectangle(TABLE.x, TABLE.y, TABLE.w, TABLE.h)
      .setOrigin(0, 0)
      .setStrokeStyle(2, PALETTE.cream);
    scene.add.rectangle(TABLE.x, TABLE.y + TABLE.h / 2, TABLE.w, 1, PALETTE.cream).setOrigin(0, 0).setAlpha(0.6);
    scene.add.circle(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2, 18).setStrokeStyle(1, PALETTE.cream).setAlpha(0.6);
    scene.add.circle(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2, 2, PALETTE.cream).setAlpha(0.6);
    // the creases in front of each goal
    scene.add.arc(TABLE.x + TABLE.w / 2, TABLE.y, 22, 0, 180, false, 0x000000, 0).setStrokeStyle(1, PALETTE.neon).setAlpha(0.4);
    scene.add.arc(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h, 22, 180, 360, false, 0x000000, 0).setStrokeStyle(1, PALETTE.gold).setAlpha(0.4);

    // goals
    const gx = TABLE.x + (TABLE.w - GOAL_W) / 2;
    scene.add.rectangle(gx, TABLE.y - 1, GOAL_W, 3, PALETTE.neon).setOrigin(0, 0);
    scene.add.rectangle(gx, TABLE.y + TABLE.h - 2, GOAL_W, 3, PALETTE.gold).setOrigin(0, 0);

    // ---- TWO STRIKERS THAT ARE SOMEBODY, not two coloured discs.
    //
    // A gold circle and a cyan circle tell you which end of the table is
    // yours and nothing else.  Yours is Froggy -- green, with his eyes on
    // top of it looking down the table -- and the other one is the lizard,
    // amber with a crest.  Built from the striker outward so the face rides
    // the mallet without a container to keep in step.
    aiPad = scene.add.circle(TABLE.x + TABLE.w / 2, TABLE.y + 26, PAD_R, 0xc07a2e).setStrokeStyle(2, 0x6d4114, 0.9);
    // A crest drawn as a bare triangle read as a loose yellow wedge stuck to
    // the mallet rather than as part of anybody, so it is gone.  The lizard
    // gets eyes instead -- slit ones, which is what tells it apart from the
    // frog now that both of them have a face -- and they sit on the lower
    // edge because it is looking DOWN the table at you.
    aiFace = [
      scene.add.circle(0, 0, PAD_R * 0.62, 0xe8a94e),
      scene.add.circle(0, 0, 2.6, PALETTE.cream),
      scene.add.circle(0, 0, 2.6, PALETTE.cream),
      scene.add.rectangle(0, 0, 1.2, 3, PALETTE.black),
      scene.add.rectangle(0, 0, 1.2, 3, PALETTE.black),
    ];
    pad = scene.add.circle(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h - 26, PAD_R, 0x3d7a42).setStrokeStyle(2, 0x24492a, 0.9);
    padFace = [
      scene.add.circle(0, 0, PAD_R * 0.62, 0x5aa85f),
      scene.add.circle(0, 0, 2.6, PALETTE.cream),
      scene.add.circle(0, 0, 2.6, PALETTE.cream),
      scene.add.circle(0, 0, 1.2, PALETTE.black),
      scene.add.circle(0, 0, 1.2, PALETTE.black),
    ];
    puck = scene.add.circle(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2, PUCK_R, 0x1a1a22).setStrokeStyle(1, PALETTE.cream);
    padPrev = { x: pad.x, y: pad.y };
    // Every piece of both faces is built at the origin and only gets a
    // position from `dressPads`, so without this the first frame draws two
    // sets of eyes in the corner of the table.
    dressPads();

    // In the left-hand margin, clear of your goal mouth (it used to sit on it).
    scoreText = centerText(scene, 35, 140, '', PALETTE.cream);
    // On the centre spot, over the puck it is holding still.
    countText = centerText(scene, GAME_W / 2, TABLE.y + TABLE.h / 2 - 14, '', PALETTE.gold, 16)
      .setDepth(40)
      .setVisible(false);
    text(scene, 8, 30, isTouch() ? 'DRAG' : 'MOUSE', PALETTE.fog);
    text(scene, 8, 40, 'TO MOVE', PALETTE.fog);
    nearMs = { pad: 0, ai: 0 };
    backOffMs = 0;
    dragGoal = null;
    mountDragPad(scene);
    updateScore();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__hockey = {
        /**
         * Enough to score a game from outside.  "A little more challenging but
         * not unbeatable" is a claim about a win rate, and a win rate cannot be
         * read off a screenshot.
         */
        state: () => ({
          you: scoreP,
          them: scoreA,
          over,
          frozen,
          puck: puck ? { x: puck.x, y: puck.y } : null,
          vel: { ...vel },
          pad: pad ? { x: pad.x, y: pad.y } : null,
          aiPad: aiPad ? { x: aiPad.x, y: aiPad.y } : null,
          table: { ...TABLE },
          padR: PAD_R,
          target: TARGET_SCORE,
        }),
        /** Put the puck somewhere, moving or not -- to test what he does about it. */
        setPuck: (x: number, y: number, vx = 0, vy = 0) => {
          if (!puck) return;
          puck.setPosition(x, y);
          vel = { x: vx, y: vy };
          frozen = 0;
          armed = true;
        },
        /** Put the player's mallet somewhere, the way the mouse would. */
        setPad: (x: number, y: number) => {
          if (!pad) return;
          pad.x = Phaser.Math.Clamp(x, TABLE.x + PAD_R, TABLE.x + TABLE.w - PAD_R);
          pad.y = Phaser.Math.Clamp(y, TABLE.y + TABLE.h / 2 + PAD_R, TABLE.y + TABLE.h - PAD_R);
          dressPads();
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__hockey;
      });
    }

    // The opening face-off is the same three seconds as every restart.
    serve(1);
  },

  update(_t: number, delta: number) {
    if (over || !puck || !pad || !aiPad) return;
    const scene = puck.scene;
    elapsed += delta;

    if (frozen > 0) {
      frozen -= delta;
      // Counted down where it can be seen: three seconds of a puck that will
      // not move is a broken game unless the game says what it is waiting for.
      countText?.setText(frozen > 0 ? `${Math.ceil(frozen / 1000)}` : '').setVisible(frozen > 0);

      // ---- THE PUCK IS STILL.  THE PADDLES ARE NOT.
      //
      // The whole update used to return here, which froze the player's mallet
      // to the felt for three seconds with the mouse moving under it.  You can
      // take your position while the count runs -- and you cannot take it ON
      // the spot: both mallets are held outside a ring round the puck, so
      // nothing can be resting against it when the count ends and nobody gets
      // a goal out of the wait.  Nothing in here touches the puck's position
      // or its velocity.
      followPointer(scene);
      keepOffPuck(pad);
      // The machine waits at its own end rather than crowding the spot.
      const back = (AI_SPEED * delta) / 1000;
      aiPad.x += Phaser.Math.Clamp(TABLE.x + TABLE.w / 2 - aiPad.x, -back, back);
      aiPad.y += Phaser.Math.Clamp(TABLE.y + 26 - aiPad.y, -back, back);
      keepOffPuck(aiPad);
      // The mallet is standing still as far as the first bounce is concerned:
      // whatever the mouse did during the count is not a swing.  The machine's
      // mallet is always treated as still -- see the collide call below.
      padPrev = { x: pad.x, y: pad.y };
      // ---- AND THE FACES COME WITH THEM.
      //
      // This is the whole of the goal bug.  Both mallets are moved through
      // the whole three second face-off -- yours follows the mouse, his walks
      // back to his own end -- and the only `dressPads` call was further down,
      // past this `return`, on the live path.  So from the moment the puck
      // crossed the line until play restarted, both sets of eyes stayed
      // floating wherever the goal had left them while the strikers they
      // belong to slid out from under them.
      dressPads();
      return;
    }
    countText?.setVisible(false);

    // ---- player paddle follows the mouse, clamped to the lower half
    followPointer(scene);
    // ---- THE FACE-OFF IS NOT PRE-LOADED.  Held against the ring through the
    // count with the pointer on the puck, the mallet used to jump onto it on
    // the first live frame -- a first hit every round, decided before the
    // round began.  Now it stays held off until you take the pointer back off
    // the ring and come in again (or the puck is already moving, from his
    // side), the way his mallet has to come in from his end.
    if (!armed) {
      const p = aimPoint(scene);
      const off = Math.hypot(p.x - puck.x, p.y - puck.y) >= KEEP_OFF;
      if (off || vel.x !== 0 || vel.y !== 0) armed = true;
      else {
        keepOffPuck(pad);
        padPrev = { x: pad.x, y: pad.y };
      }
    }

    // where his mallet starts this frame, for how fast it swings into the puck
    const aiFrom: Vec = { x: aiPad.x, y: aiPad.y };

    // ---- AI: chase a 140ms-old view of the puck
    history.push({ t: elapsed, x: puck.x, y: puck.y });
    while (history.length > 2 && elapsed - history[0].t > AI_REACTION_MS) history.shift();
    const seen = history[0];
    // ---- AND SOMEBODY HAS TO GO AND GET IT.
    //
    // A puck that waits to be hit is a puck nobody hits, if the opponent only
    // ever reacts to one already moving: the round would sit there until the
    // clock ran out.  Dead on the spot, he comes for it -- keenly if he just
    // conceded, warily if he just scored, which is the difference between
    // wanting the restart and being happy to let you take it.
    const dead = vel.x === 0 && vel.y === 0;
    const eager = openingDir > 0 ? 1 : 0.55;
    // ---- IT CHASES THE PUCK ITSELF, and that turns out to be the right call.
    //
    // Predicting where the puck would CROSS ITS GOAL LINE and standing there
    // was tried, and it made the opponent much worse: measured against the
    // same scripted player it went from taking 4 games of 6 to losing 5 of 6,
    // conceding 28 instead of 19.  The reason is that the mallet does not wait
    // on its goal line -- it advances to meet the puck at roughly the puck's
    // own height -- so aiming at the crossing point put it at the wrong x for
    // the whole of the approach and only at the right one if the puck got all
    // the way through.  Predicting a point you do not stand on is worse than
    // covering the puck you can see.
    //
    // ---- AND A SLOW PUCK ON HIS SIDE IS HIS TO HIT.  "Dead" used to mean a
    // speed of exactly nothing, which only the face-off ever has: friction
    // never quite stops a puck, so one dribbling along the boards in his half
    // was "moving away" and he went home and watched it.  Now anything slow
    // that he can reach -- his half, and the strip of yours his mallet can
    // still touch across the line -- is a loose puck, and he goes and STRIKES
    // it: round behind it (the side away from your goal), then through it.
    const midY = TABLE.y + TABLE.h / 2;
    const speed = Math.hypot(vel.x, vel.y);
    const reach = puck.y < midY + PUCK_R + 1;
    const loose = !dead && reach && speed < 140;
    let wantX: number;
    let wantY: number;
    if (loose) {
      const strike = strikePoint(aiPad, puck);
      wantX = strike.x;
      wantY = strike.y;
    } else {
      wantX = dead
        ? puck.x + (Math.random() - 0.5) * AI_AIM_ERROR * 0.5
        : vel.y < 0
          ? seen.x + (Math.random() - 0.5) * AI_AIM_ERROR
          : TABLE.x + TABLE.w / 2 + (seen.x - (TABLE.x + TABLE.w / 2)) * 0.35;
      wantY = dead
        ? Math.min(puck.y - PAD_R * 0.4, midY - PAD_R)
        : vel.y < 0 ? Math.min(seen.y + 10, midY - PAD_R) : TABLE.y + 26;
    }
    // backing off after breaking an orbit: home, and let the puck go
    if (backOffMs > 0) {
      backOffMs -= delta;
      wantX = TABLE.x + TABLE.w / 2;
      wantY = TABLE.y + PAD_R + 2;
    }
    const aiSpeed = dead ? AI_SPEED * eager : AI_SPEED;
    const step = (aiSpeed * delta) / 1000;
    aiPad.x += Phaser.Math.Clamp(wantX - aiPad.x, -step, step);
    aiPad.y += Phaser.Math.Clamp(wantY - aiPad.y, -step, step);
    aiPad.x = Phaser.Math.Clamp(aiPad.x, TABLE.x + PAD_R, TABLE.x + TABLE.w - PAD_R);
    aiPad.y = Phaser.Math.Clamp(aiPad.y, TABLE.y + PAD_R, TABLE.y + TABLE.h / 2 - PAD_R);

    // the faces ride their strikers
    dressPads();

    // ---- THE PUCK, IN SMALL STEPS.
    //
    // A fast puck -- or a mallet that jumps with the mouse -- can travel
    // further in one frame than the two of them are wide, and checked once a
    // frame it was found halfway through the mallet and pushed out of the
    // wrong side: the puck that seemed to pass through, or to wrap round it.
    // The frame is cut into steps no longer than the puck's radius, the two
    // mallets swept along their paths through it, and every step is the
    // walls, then each mallet.
    const dt = delta / 1000;
    const padFrom = { ...padPrev };
    const padMove = Math.hypot(pad.x - padFrom.x, pad.y - padFrom.y);
    const aiMove = Math.hypot(aiPad.x - aiFrom.x, aiPad.y - aiFrom.y);
    const puckMove = Math.hypot(vel.x, vel.y) * dt;
    const steps = Phaser.Math.Clamp(Math.ceil(Math.max(padMove, aiMove, puckMove) / (PUCK_R * 0.75)), 1, 12);
    const sdt = dt / steps;
    // each mallet's velocity over the frame, px/s
    const padVel: Vec = { x: (pad.x - padFrom.x) / Math.max(dt, 1e-4), y: (pad.y - padFrom.y) / Math.max(dt, 1e-4) };
    const aiVel: Vec = { x: (aiPad.x - aiFrom.x) / Math.max(dt, 1e-4), y: (aiPad.y - aiFrom.y) / Math.max(dt, 1e-4) };
    let hit = false;
    for (let k = 1; k <= steps; k++) {
      const f = k / steps;
      puck.x += vel.x * sdt;
      puck.y += vel.y * sdt;
      const scored = walls();
      if (scored !== null) return goal(scored);
      hit = collide({ x: padFrom.x + (pad.x - padFrom.x) * f, y: padFrom.y + (pad.y - padFrom.y) * f }, padVel, sdt) || hit;
      hit = collide({ x: aiFrom.x + (aiPad.x - aiFrom.x) * f, y: aiFrom.y + (aiPad.y - aiFrom.y) * f }, aiVel, sdt) || hit;
    }
    if (hit) audio.sfx('whack');

    unstick(pad, 'pad', delta);
    unstick(aiPad, 'ai', delta);

    // friction and cap
    vel.x *= 0.9995;
    vel.y *= 0.9995;
    const sp = Math.hypot(vel.x, vel.y);
    if (sp > MAX_SPEED) {
      vel.x = (vel.x / sp) * MAX_SPEED;
      vel.y = (vel.y / sp) * MAX_SPEED;
    }

    if (elapsed > TIME_CAP_MS) finish();
  },

  destroy() {
    dragEl?.remove();
    dragEl = null;
    dragGoal = null;
    puck = null;
    pad = null;
    aiPad = null;
    scoreText = null;
    countText = null;
    apiRef = null;
  },
};

/**
 * Where his mallet goes to hit a loose puck: BEHIND it, on the line from your
 * goal through the puck, so moving onto that point drives it at your end.
 * Coming at it from the wrong side, he first goes round it, wide of it, so
 * he does not knock it back into his own goal on the way.  Pinned against his
 * own end wall, with no room behind it, he knocks it out sideways instead.
 */
function strikePoint(ai: Vec, p: Vec): Vec {
  const goalX = TABLE.x + TABLE.w / 2;
  const goalY = TABLE.y + TABLE.h;
  let dx = p.x - goalX;
  let dy = p.y - goalY;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d;
  dy /= d;
  const contact = PAD_R + PUCK_R;
  const top = TABLE.y + PAD_R;
  // no room behind it: against the end wall, from the side, toward the middle
  if (p.y - contact * 0.6 < top) {
    const side = p.x < goalX ? -1 : 1;
    const x = p.x + side * (contact - 3);
    // ...unless it is in the corner, where there is no side to get to either.
    // Pressing on it there only wedges it; he stands off on the diagonal and
    // lets it come off the boards to him.
    if (x < TABLE.x + PAD_R || x > TABLE.x + TABLE.w - PAD_R) {
      return { x: p.x - side * (contact + 4) * 0.71, y: p.y + (contact + 4) * 0.71 };
    }
    return { x, y: Math.max(top, p.y) };
  }
  // the wrong side of it: round it first
  if (ai.y > p.y - 3) {
    const room = (s: number) => {
      const x = p.x + s * (contact + 5);
      return x > TABLE.x + PAD_R && x < TABLE.x + TABLE.w - PAD_R;
    };
    let side = ai.x < p.x ? -1 : 1;
    if (!room(side)) side = -side;
    return { x: p.x + side * (contact + 5), y: Math.max(top, p.y - contact) };
  }
  // behind it, and through it
  return { x: p.x + dx * (contact - 4), y: p.y + dy * (contact - 4) };
}

/** The player's mallet, under the mouse and inside its own half. */
/** Where the player wants the mallet: the mouse/finger on the table, or the drag pad. */
function aimPoint(scene: Phaser.Scene): Vec {
  if (dragGoal) return dragGoal;
  const p = scene.input.activePointer;
  return { x: p.worldX, y: p.worldY };
}

function followPointer(scene: Phaser.Scene): void {
  if (!pad) return;
  const p = aimPoint(scene);
  const px = Phaser.Math.Clamp(p.x, TABLE.x + PAD_R, TABLE.x + TABLE.w - PAD_R);
  const py = Phaser.Math.Clamp(p.y, TABLE.y + TABLE.h / 2 + PAD_R, TABLE.y + TABLE.h - PAD_R);
  padPrev = { x: pad.x, y: pad.y };
  pad.setPosition(px, py);
}

/**
 * Hold a mallet outside a ring round the puck, and move the MALLET to do it.
 *
 * Used only while the count is running.  A mallet that was allowed to rest
 * against a stationary puck would be touching it the instant the count ended,
 * which is a free goal for whoever got there first -- and pushing the puck out
 * of the way instead would be the puck moving during a count that exists to
 * keep it still.
 */
function keepOffPuck(p: Phaser.GameObjects.Arc): void {
  if (!puck) return;
  const dx = p.x - puck.x;
  const dy = p.y - puck.y;
  const d = Math.hypot(dx, dy);
  if (d >= KEEP_OFF) return;
  // Straight out from the puck; from exactly on top of it, downwards.
  const nx = d === 0 ? 0 : dx / d;
  const ny = d === 0 ? 1 : dy / d;
  p.setPosition(puck.x + nx * KEEP_OFF, puck.y + ny * KEEP_OFF);
}

/**
 * The boards and the goal mouths, for one step.  Returns who scored if the
 * puck went in (true: you), or null.
 */
function walls(): boolean | null {
  if (!puck) return null;
  if (puck.x < TABLE.x + PUCK_R) {
    puck.x = TABLE.x + PUCK_R;
    vel.x = Math.abs(vel.x);
    audio.sfx('ui_hover');
  }
  if (puck.x > TABLE.x + TABLE.w - PUCK_R) {
    puck.x = TABLE.x + TABLE.w - PUCK_R;
    vel.x = -Math.abs(vel.x);
    audio.sfx('ui_hover');
  }
  const gx0 = TABLE.x + (TABLE.w - GOAL_W) / 2;
  const inGoalX = puck.x > gx0 && puck.x < gx0 + GOAL_W;
  if (puck.y < TABLE.y + PUCK_R) {
    if (inGoalX) return true;
    puck.y = TABLE.y + PUCK_R;
    vel.y = Math.abs(vel.y);
  }
  if (puck.y > TABLE.y + TABLE.h - PUCK_R) {
    if (inGoalX) return false;
    puck.y = TABLE.y + TABLE.h - PUCK_R;
    vel.y = -Math.abs(vel.y);
  }
  return null;
}

/** How much of the speed into a mallet comes back out of it. */
const RESTITUTION = 0.88;

/**
 * ONE MALLET AGAINST THE PUCK, as a real collision.
 *
 * The mallet is the heavy one (a hand is behind it), so it is not moved: the
 * puck is put back outside it along the line between their centres, and --
 * only if the two are closing on each other along that line -- the part of
 * the puck's velocity relative to the mallet that points into it is turned
 * round, a little softer.  So a puck that meets a still mallet glances off
 * it at the angle it came in at; a mallet swung into a still puck sends it
 * off along the line of the hit at up to twice the swing; and a puck already
 * leaving is let go, instead of being turned back into the mallet to go
 * round and round it (which is what the old one did).
 */
function collide(m: Vec, mVel: Vec, stepS: number): boolean {
  if (!puck) return false;
  let dx = puck.x - m.x;
  let dy = puck.y - m.y;
  let d = Math.hypot(dx, dy);
  const reach = PAD_R + PUCK_R;
  if (d >= reach) return false;
  // ---- BACK TO THE MOMENT THEY TOUCHED.  Found up to a step inside the
  // mallet, the line between the centres is not the one they met on, and
  // the bounce comes off at the wrong angle (an off-centre hit sent nearly
  // flat).  Run the two back along their relative motion to where they were
  // just touching -- within this step -- and bounce from there.
  const wx = vel.x - mVel.x;
  const wy = vel.y - mVel.y;
  const ww = wx * wx + wy * wy;
  let back = 0;
  if (ww > 1e-6) {
    const dw = dx * wx + dy * wy;
    const disc = dw * dw - ww * (dx * dx + dy * dy - reach * reach);
    if (disc >= 0) back = Math.min(stepS, Math.max(0, (dw + Math.sqrt(disc)) / ww));
  }
  if (back > 0) {
    dx -= wx * back;
    dy -= wy * back;
    d = Math.hypot(dx, dy);
  }
  // dead centre: out the way the mallet is moving, or down the table
  const ms = Math.hypot(mVel.x, mVel.y);
  const nx = d > 1e-6 ? dx / d : ms > 1e-6 ? mVel.x / ms : 0;
  const ny = d > 1e-6 ? dy / d : ms > 1e-6 ? mVel.y / ms : 1;
  // (the contact point, as the mallet stands now)
  puck.x = m.x + nx * (reach + 0.25);
  puck.y = m.y + ny * (reach + 0.25);

  // Never out through the boards: a mallet pressing a puck into the side or
  // an end wall is pushing it into something that pushes back, so it comes
  // off along the boards instead of out through them.
  let wedgedX = false;
  let wedgedY = false;
  if (puck.x < TABLE.x + PUCK_R || puck.x > TABLE.x + TABLE.w - PUCK_R) {
    puck.x = Phaser.Math.Clamp(puck.x, TABLE.x + PUCK_R, TABLE.x + TABLE.w - PUCK_R);
    wedgedX = true;
  }
  const gx0 = TABLE.x + (TABLE.w - GOAL_W) / 2;
  const inGoalX = puck.x > gx0 && puck.x < gx0 + GOAL_W;
  if (!inGoalX && (puck.y < TABLE.y + PUCK_R || puck.y > TABLE.y + TABLE.h - PUCK_R)) {
    puck.y = Phaser.Math.Clamp(puck.y, TABLE.y + PUCK_R, TABLE.y + TABLE.h - PUCK_R);
    wedgedY = true;
  }

  // the puck's velocity as the mallet sees it, along the line between them
  const rvx = vel.x - mVel.x;
  const rvy = vel.y - mVel.y;
  const closing = rvx * nx + rvy * ny;
  if (closing >= 0) return false; // already parting: nothing to bounce
  const j = -(1 + RESTITUTION) * closing;
  vel.x += j * nx;
  vel.y += j * ny;
  // and on from the touch for the part of the step it was run back
  puck.x += (vel.x - mVel.x) * back;
  puck.y += (vel.y - mVel.y) * back;
  // squeezed against the boards: the blocked direction is handed back as the
  // way out, so it squirts along the wall instead of sticking to it
  if (wedgedX) vel.x = -vel.x * 0.6;
  if (wedgedY) vel.y = -vel.y * 0.6;
  // no faster than the table allows, straight away: a mallet that jumped
  // with the mouse would otherwise fling it across the rest of this frame
  const sp = Math.hypot(vel.x, vel.y);
  if (sp > MAX_SPEED) {
    vel.x = (vel.x / sp) * MAX_SPEED;
    vel.y = (vel.y / sp) * MAX_SPEED;
  }
  return true;
}

function goal(playerScored: boolean): void {
  if (playerScored) scoreP++;
  else scoreA++;
  audio.sfx(playerScored ? 'chime' : 'buzzer');
  updateScore();
  if (scoreP >= TARGET_SCORE || scoreA >= TARGET_SCORE) {
    finish();
    return;
  }
  serve(playerScored ? -1 : 1);
}

/**
 * Centre the puck and hold it there for the cooldown.
 *
 * THREE SECONDS BETWEEN ROUNDS, not half of one.  The old half second put the
 * puck back in play before either mallet had been moved off wherever the last
 * goal left it, so the restart was a scramble rather than a fresh face-off.
 * Three is long enough to get back to your own half and watch the count, and
 * the count is on screen because three silent seconds reads as a hang.
 */
function serve(dir: number): void {
  if (!puck) return;
  // ---- IT IS A FACE-OFF, NOT A SERVE.
  //
  // The puck used to launch itself down the table at one of them the instant
  // the count ran out, which means the first thing that happens in every
  // round is decided by a random number rather than by either player.  It
  // sits dead on the centre spot now and waits to be hit, the way a puck on
  // a real table does -- whoever gets there first gets the first say.
  //
  // `dir` is kept because the caller knows who conceded and the AI reads it
  // to decide how hard to commit to the opening; nothing moves on its own.
  puck.setPosition(TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2);
  vel = { x: 0, y: 0 };
  openingDir = dir;
  frozen = ROUND_GAP_MS;
  history = [];
  armed = false;
}

/** Put each striker's face back on it, wherever the mallet has got to. */
function dressPads(): void {
  if (pad && padFace.length === 5) {
    const [belly, eyeL, eyeR, pupL, pupR] = padFace as Phaser.GameObjects.Arc[];
    belly.setPosition(pad.x, pad.y + 1);
    eyeL.setPosition(pad.x - 3.2, pad.y - 3);
    eyeR.setPosition(pad.x + 3.2, pad.y - 3);
    pupL.setPosition(pad.x - 3.2, pad.y - 3.6);
    pupR.setPosition(pad.x + 3.2, pad.y - 3.6);
  }
  if (aiPad && aiFace.length === 5) {
    const [belly, eyeL, eyeR, pupL, pupR] = aiFace as Array<
      Phaser.GameObjects.GameObject & { setPosition(x: number, y: number): unknown }
    >;
    belly.setPosition(aiPad.x, aiPad.y - 1);
    eyeL.setPosition(aiPad.x - 3.2, aiPad.y + 3);
    eyeR.setPosition(aiPad.x + 3.2, aiPad.y + 3);
    pupL.setPosition(aiPad.x - 3.2, aiPad.y + 3.4);
    pupR.setPosition(aiPad.x + 3.2, aiPad.y + 3.4);
  }
}

function updateScore(): void {
  scoreText?.setText(`LIZARD ${scoreA}\n\nYOU ${scoreP}`);
}

/** PRD §9.4: on timeout the higher score wins.  Level on the clock is a tie. */
function finish(): void {
  if (over) return;
  over = true;
  const won = scoreP > scoreA;
  const tied = scoreP === scoreA;
  if (won) apiRef?.record(scoreP - scoreA);
  puck?.scene.time.delayedCall(400, () => (won ? apiRef?.win() : tied ? apiRef?.draw() : apiRef?.lose()));
}

export const _debug = { TABLE, GAME_H };


// ------------------------------------------------------------ anti-orbit

let nearMs = { pad: 0, ai: 0 };
let backOffMs = 0;

/**
 * THE PUCK MAY NOT ORBIT A MALLET.  Pressed against a striker that keeps
 * re-chasing it, the puck could be carried round and round it for ever --
 * neither hit nor free.  Held in contact for more than half a second, it is
 * flicked off, away from the mallet and towards the far half, and if it was
 * the lizard's mallet the lizard goes home for a moment and lets it go.
 */
function unstick(p: Phaser.GameObjects.Arc, who: 'pad' | 'ai', delta: number): void {
  if (!puck) return;
  const dx = puck.x - p.x;
  const dy = puck.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  if (d > PAD_R + PUCK_R + 4) {
    nearMs[who] = 0;
    return;
  }
  nearMs[who] += delta;
  if (nearMs[who] < 550) return;
  nearMs[who] = 0;
  const away = who === 'ai' ? 1 : -1; // the lizard's puck goes down the table, yours up it
  const speed = 150;
  vel.x = (dx / d) * speed * 0.6;
  vel.y = away * speed * 0.8 + (dy / d) * speed * 0.2;
  puck.x = p.x + (dx / d) * (PAD_R + PUCK_R + 2);
  puck.y = p.y + (dy / d) * (PAD_R + PUCK_R + 2);
  if (who === 'ai') backOffMs = 600;
}

// ------------------------------------------------------------ the drag pad

let dragEl: HTMLDivElement | null = null;
let dragGoal: Vec | null = null;

/**
 * UPRIGHT ON A PHONE the table is a small picture at the top of the glass and
 * the rest is black.  That black becomes a trackpad: drag anywhere on it and
 * the mallet moves the same way, the pad's width standing for the table's,
 * so your thumb is not covering the thing it is playing.
 */
function mountDragPad(scene: Phaser.Scene): void {
  if (!isTouch() || window.innerHeight < window.innerWidth) return;
  const canvas = document.querySelector('#game-root canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const pic = canvas.getBoundingClientRect();
  const top = Math.round(pic.bottom + 70);
  if (window.innerHeight - top < 120) return;
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    left: '12px',
    right: '12px',
    top: `${top}px`,
    bottom: '16px',
    border: '2px dashed rgba(255, 212, 94, 0.35)',
    borderRadius: '18px',
    background: 'rgba(0, 0, 0, 0.6)',
    zIndex: '40',
    touchAction: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255, 240, 201, 0.55)',
    font: '700 15px ui-monospace, monospace',
    letterSpacing: '2px',
  } as Partial<CSSStyleDeclaration>);
  el.textContent = 'DRAG HERE TO MOVE';
  document.body.appendChild(el);
  dragEl = el;
  let last: { x: number; y: number } | null = null;
  const kx = TABLE.w / Math.max(80, el.clientWidth);
  const ky = (TABLE.h / 2) / Math.max(80, el.clientHeight) * 1.4;
  el.addEventListener('pointerdown', (e) => {
    last = { x: e.clientX, y: e.clientY };
    el.setPointerCapture(e.pointerId);
    if (!dragGoal && pad) dragGoal = { x: pad.x, y: pad.y };
  });
  el.addEventListener('pointermove', (e) => {
    if (!last || !dragGoal) return;
    dragGoal = {
      x: Phaser.Math.Clamp(dragGoal.x + (e.clientX - last.x) * kx, TABLE.x + PAD_R, TABLE.x + TABLE.w - PAD_R),
      y: Phaser.Math.Clamp(dragGoal.y + (e.clientY - last.y) * ky, TABLE.y + TABLE.h / 2 + PAD_R, TABLE.y + TABLE.h - PAD_R),
    };
    last = { x: e.clientX, y: e.clientY };
  });
  const end = () => {
    last = null;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  // a finger on the table itself takes over again
  scene.input.on('pointerdown', () => {
    dragGoal = null;
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    el.remove();
    if (dragEl === el) dragEl = null;
  });
}

// ------------------------------------------------------------ the arena

/**
 * Not a starfield: an arcade's air hockey corner.  A dark plum room with a
 * neon tube along the top of the back wall, the glow of it on the wall, a
 * scoreboard housing over the table, and rubber matting on the floor.
 */
/**
 * THE TABLE, painted once: the same teal and the same wood as ever, but made
 * of something -- the rail a grained, rounded hardwood with a lit top edge
 * and a shadow where it meets the surface; the surface a glossy laminate,
 * a shade lighter at the far end, pricked all over with the air holes in
 * rows, and one broad soft reflection of the room's lights across it.
 */
function paintTable(scene: Phaser.Scene): string {
  const key = 'airhockey_table_v3';
  if (scene.textures.exists(key)) return key;
  const W = TABLE.w + 12;
  const H = TABLE.h + 12;
  const tex = scene.textures.createCanvas(key, W, H);
  if (!tex) return key;
  const g = tex.getContext();
  let seed = 4117;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // the rail: hardwood, grain running round it
  g.fillStyle = '#5c4326';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const y = rnd() * H;
    const x = rnd() * W;
    g.fillStyle = rnd() < 0.5 ? 'rgba(30,18,8,0.35)' : 'rgba(150,110,60,0.25)';
    if (x < 6 || x > W - 6) g.fillRect(Math.floor(x), Math.floor(y), 1, 3 + Math.floor(rnd() * 6));
    else g.fillRect(Math.floor(x), Math.floor(y), 3 + Math.floor(rnd() * 8), 1);
  }
  // rounded: lit along its top and left, dark along its bottom and right
  g.fillStyle = '#8a6a3a';
  g.fillRect(0, 0, W, 2);
  g.fillRect(0, 0, 2, H);
  g.fillStyle = 'rgba(255,230,180,0.35)';
  g.fillRect(1, 1, W - 2, 1);
  g.fillStyle = '#3a2814';
  g.fillRect(0, H - 2, W, 2);
  g.fillRect(W - 2, 0, 2, H);
  // the surface
  const sx = 6;
  const sy = 6;
  const sw = TABLE.w;
  const sh = TABLE.h;
  const lam = g.createLinearGradient(0, sy, 0, sy + sh);
  lam.addColorStop(0, '#2a8282');
  lam.addColorStop(0.5, '#1f6e6e');
  lam.addColorStop(1, '#185a5c');
  g.fillStyle = lam;
  g.fillRect(sx, sy, sw, sh);
  // the air holes, in rows, each a dark prick with a lit lower edge
  for (let y = sy + 4; y < sy + sh - 2; y += 6) {
    for (let x = sx + ((y / 6) % 2 ? 4 : 7); x < sx + sw - 2; x += 6) {
      g.fillStyle = 'rgba(4,30,32,0.55)';
      g.fillRect(x, y, 1, 1);
      g.fillStyle = 'rgba(160,240,236,0.18)';
      g.fillRect(x, y + 1, 1, 1);
    }
  }
  // the room's lights in the gloss: one broad soft band, and a narrow one
  g.save();
  g.beginPath();
  g.rect(sx, sy, sw, sh);
  g.clip();
  for (const [x0, w0, a] of [[30, 46, 0.1], [92, 12, 0.08]] as const) {
    const band = g.createLinearGradient(sx + x0, 0, sx + x0 + w0, 0);
    band.addColorStop(0, 'rgba(255,255,255,0)');
    band.addColorStop(0.5, `rgba(230,255,250,${a})`);
    band.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = band;
    g.save();
    g.translate(sx + x0 + w0 / 2, sy + sh / 2);
    g.transform(1, 0, -0.45, 1, 0, 0);
    g.translate(-(sx + x0 + w0 / 2), -(sy + sh / 2));
    g.fillRect(sx + x0, sy - 20, w0, sh + 40);
    g.restore();
  }
  g.restore();
  // the rail's shadow falling on the surface, all round its inside edge
  const inner = (x: number, y: number, w: number, h: number, a: number) => {
    g.fillStyle = `rgba(0,0,0,${a})`;
    g.fillRect(x, y, w, h);
  };
  inner(sx, sy, sw, 2, 0.28);
  inner(sx, sy, 2, sh, 0.2);
  inner(sx, sy + sh - 1, sw, 1, 0.12);
  inner(sx + sw - 1, sy, 1, sh, 0.12);
  tex.refresh();
  return key;
}

function paintArena(scene: Phaser.Scene): void {
  const key = 'airhockey_arena_v2';
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, GAME_W, GAME_H);
    if (tex) {
      const g = tex.getContext();
      const wall = g.createLinearGradient(0, 16, 0, GAME_H);
      wall.addColorStop(0, '#1d1230');
      wall.addColorStop(0.55, '#140d24');
      wall.addColorStop(1, '#0b0a14');
      g.fillStyle = wall;
      g.fillRect(0, 0, GAME_W, GAME_H);
      // wall panels
      for (let x = 0; x < GAME_W; x += 32) {
        g.fillStyle = 'rgba(255,255,255,0.03)';
        g.fillRect(x, 16, 1, 110);
      }
      // the neon tubes, pink over the lizard's end, gold over yours
      const tube = (y: number, col: string) => {
        const glow = g.createLinearGradient(0, y - 10, 0, y + 22);
        glow.addColorStop(0, 'rgba(0,0,0,0)');
        glow.addColorStop(0.35, col.replace('1)', '0.22)'));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = glow;
        g.fillRect(0, y - 10, GAME_W, 32);
        g.fillStyle = col;
        g.fillRect(6, y, 52, 2);
        g.fillRect(GAME_W - 58, y, 52, 2);
      };
      tube(26, 'rgba(255,79,163,1)');
      tube(150, 'rgba(255,212,94,1)');
      // rubber floor matting under the table
      g.fillStyle = '#0d0d12';
      g.fillRect(0, 128, GAME_W, GAME_H - 128);
      for (let y = 130; y < GAME_H; y += 4) {
        for (let x = (y / 4) % 2 ? 0 : 2; x < GAME_W; x += 4) {
          g.fillStyle = 'rgba(255,255,255,0.035)';
          g.fillRect(x, y, 2, 2);
        }
      }
      // posters either side: a puck and a mallet in neon outline
      const poster = (x: number, tint: string, label: string) => {
        g.fillStyle = 'rgba(0,0,0,0.45)';
        g.fillRect(x, 58, 44, 56);
        g.strokeStyle = tint;
        g.lineWidth = 1;
        g.strokeRect(x + 0.5, 58.5, 43, 55);
        g.beginPath();
        g.arc(x + 22, 80, 10, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.arc(x + 22, 80, 4, 0, Math.PI * 2);
        g.stroke();
        void label;
      };
      poster(13, 'rgba(70,196,189,0.8)', 'PLAY');
      poster(GAME_W - 57, 'rgba(255,79,163,0.8)', 'FIRST TO 5');
      tex.refresh();
    }
  }
  scene.add.image(0, 0, key).setOrigin(0, 0);
  centerText(scene, 35, 106, 'PLAY', PALETTE.tealLight).setAlpha(0.8);
  centerText(scene, GAME_W - 35, 102, 'FIRST', PALETTE.neon).setAlpha(0.8);
  centerText(scene, GAME_W - 35, 110, 'TO 5', PALETTE.neon).setAlpha(0.8);
}
