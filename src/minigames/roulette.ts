/**
 * CHAMBER.  Hard — 20 tokens in, and whatever you have the nerve to hold.
 *
 * The arcade's russian-roulette cabinet, and it is a cabinet: a cylinder
 * diagram, a hammer and three buttons.  There is no gun and nobody points
 * anything at themselves — what is at stake is the twenty tokens you put in,
 * and the whole game is on the machine's face.
 *
 * THE LOOP IS SPIN, STOP, PULL, AND EVERY STEP OF IT IS YOURS.
 *
 *   1. The cylinder is turning when the round opens.
 *   2. STOP SPINNING lets it coast down onto a chamber.
 *   3. Stopped, and only stopped, the trigger works.  Nothing fires on its
 *      own: the machine waits for PULL TRIGGER to be pressed.
 *   4. A clean pull puts five more on the machine and the barrel starts
 *      turning again by itself, which is step 2 over again.
 *
 * THERE IS NO KEEP SPINNING.  It was a third button that gave the cylinder
 * another shove, and the header below already says why that could never
 * matter: the draw is made at the trigger, so a longer spin changes nothing
 * about the odds and the machine says so out loud.  A button whose whole
 * effect is on the picture is a button that teaches the player to distrust the
 * other two.  The cylinder still turns, and stopping it is still theirs.
 *   5. CASH OUT, once there is anything to cash out, ends the round and the
 *      pot is yours.  The live round ends it and the pot goes with it.
 *
 * ONE LIVE ROUND IN FIVE, DRAWN AT THE TRIGGER.  There is no bullet sitting in
 * a chamber waiting to come round: the outcome is a fresh `Math.random()` at
 * the moment the hammer falls, against `CHAMBERS`, and the cylinder's angle is
 * scenery.  So there is nothing to time, nothing to count and nothing to
 * exploit — spinning for another ten seconds changes precisely nothing, which
 * is what "one in five, every pull" means and why the machine says it out loud.
 * The chamber that comes up red when you lose is the one the hammer was
 * actually over, worked out from the angle, so what you see is what happened.
 *
 * THE TWENTY IS SPENT THE MOMENT YOU WALK UP.  It is the shell that takes it
 * (MG-2) and it never comes back: a loss pays nothing and there is no refund
 * path.  What the round decides is only what comes out on top.
 *
 * NOTHING IS CREDITED PULL BY PULL.  `finish` is the only thing in this file
 * that moves a token, it is latched behind `over`, and it pays the pot exactly
 * once — which is what makes the live round able to take it all back, and what
 * makes cashing out twice, or collecting a pull and a cash-out for the same
 * five, impossible.
 *
 * The arithmetic, since the machine states its odds and the player should be
 * able to check them: continuing from a pot of p is worth 0.8 * (p + 5), so it
 * beats cashing out for p right up to a pot of twenty and never after.  Played
 * that way a round returns about eight of the twenty it cost.  The machine is
 * honest about its odds and it is still a machine in a casino.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

/**
 * Five chambers, so a pull is a flat 1-in-5 of ending the round.  It is the
 * only number the odds come from — the draw is
 * `Math.floor(Math.random() * CHAMBERS) === 0` and there is nothing else — and
 * it is also how many dots are drawn on the cylinder and how far it turns
 * between detents, so the picture cannot drift away from the odds.
 */
const CHAMBERS = 5;
/** What a clean pull adds to the pot. */
const PAY_PER_PULL = 5;
/** One chamber's worth of turn. */
const STEP = (Math.PI * 2) / CHAMBERS;

/** How fast the cylinder turns, in radians per millisecond. */
const SPIN_BASE = 0.012;
/**
 * The shove a fresh spin opens with, and how quickly it bleeds back down to
 * the idle turn.
 *
 * It is what the barrel does on its own after a clean pull -- it comes round
 * hard and settles -- rather than anything the player presses for.
 */
const SPIN_KICK = 0.03;
/** How quickly a kick bleeds off, per millisecond. */
const SPIN_DECAY = 0.0006;
/** How hard the cylinder is pulled onto the nearest chamber once stopped. */
const SETTLE = 0.009;
/**
 * The hammer falling: the beat between PULL TRIGGER and the machine saying
 * what happened.  The draw is made at the END of it, so the animation cannot
 * be one that knows the answer.
 */
const HAMMER_MS = 700;

const CYL_X = GAME_W / 2;
/**
 * The cylinder sits high enough that the warning under it has a row of its
 * own.  Nothing is allowed to be printed over the machine: the player has to
 * be able to see the chambers, the hammer and the buttons at all times.
 */
const CYL_Y = 80;
const CYL_R = 32;

/**
 * Where the round is, and the whole of the re-entrancy guard.
 *
 *   spinning  the cylinder is turning; stop it, or cash out
 *   stopping  it is coasting onto a chamber; nothing but cash out
 *   stopped   sitting on a chamber; pull the trigger, or cash out
 *   firing    the hammer is falling; nothing at all
 *   over      the round is finished, one way or the other
 *
 * Every button checks it before doing anything, so a mashed lever cannot fire
 * twice and a cash-out cannot land in the middle of a pull.
 */
type Phase = 'spinning' | 'stopping' | 'stopped' | 'firing' | 'over';

let phase: Phase = 'spinning';
let survived = 0;
/**
 * Tokens on the machine and NOT in the player's pocket.  See the header: only
 * `finish` moves them, and only once.
 */
let pot = 0;
let over = false;
/** Cylinder angle, radians, and how fast it is turning. */
let spin = 0;
let spinVel = SPIN_BASE;
let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let chamberDots: Phaser.GameObjects.Arc[] = [];
let status: Phaser.GameObjects.BitmapText | null = null;
let tally: Phaser.GameObjects.BitmapText | null = null;
let stopBtn: Phaser.GameObjects.Container | null = null;
let pullBtn: Phaser.GameObjects.Container | null = null;
let cashBtn: Phaser.GameObjects.Container | null = null;
/** DEV only: forces the next pull's outcome so both endings are testable. */
let rigged: 'clean' | 'live' | null = null;

export const roulette: MinigameModule = {
  id: 'roulette',
  title: 'CHAMBER',
  music: 'game_roulette',
  rules: 'six chambers, one live round, five a pull',
  payoutNote: `PAYS ${PAY_PER_PULL} A PULL`,
  tutorial: {
    objective: [
      'SPIN THE CHAMBER, STOP IT, THEN PULL.',
      `ONE LIVE ROUND IN ${CHAMBERS}, EVERY PULL.`,
      `A CLEAN PULL PAYS ${PAY_PER_PULL}. CASH OUT TO KEEP IT.`,
    ],
    controls: [
      ['SPACE', 'STOP THE SPIN, THEN PULL'],
      ['ENTER', 'CASH OUT'],
      ['MOUSE', 'EVERY BUTTON ON THE MACHINE'],
    ],
  },
  touch: {
    buttons: [
      { label: 'STOP /\nPULL', key: 'SPACE', primary: true },
      { label: 'CASH\nOUT', key: 'ENTER' },
    ],
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    survived = 0;
    pot = 0;
    over = false;
    phase = 'spinning';
    spin = 0;
    spinVel = SPIN_BASE;
    chamberDots = [];

    // ---- THE ROOM THIS MACHINE LIVES IN.
    //
    // It was one flat maroon rectangle, which puts the cylinder in a void:
    // nowhere, with nothing at stake but the numbers.  This is a back room --
    // the one behind the arcade floor with the good carpet and no windows --
    // and every part of it is arranged to push the eye down onto the machine
    // and to make standing there feel like a decision.
    //
    // Nothing here is bright.  The cylinder and the three buttons are the
    // only things in the frame allowed to hold light, because they are the
    // only things the player has to read.
    const FLOOR_Y2 = 132;
    scene.add.rectangle(0, 18, GAME_W, 162, 0x140d0f).setOrigin(0, 0);

    // ---- THE BACK WALL: panelling, and a dado rail across it.
    scene.add.rectangle(0, 18, GAME_W, FLOOR_Y2 - 18, 0x24161a).setOrigin(0, 0);
    for (let x = 0; x < GAME_W; x += 22) {
      scene.add.rectangle(x, 18, 1, FLOOR_Y2 - 18, 0x2f1d22).setOrigin(0, 0);
      scene.add.rectangle(x + 1, 18, 1, FLOOR_Y2 - 18, 0x1b1013).setOrigin(0, 0).setAlpha(0.7);
    }
    scene.add.rectangle(0, 92, GAME_W, 3, 0x3a2228).setOrigin(0, 0);
    scene.add.rectangle(0, 92, GAME_W, 1, 0x50313a).setOrigin(0, 0);
    // damp creeping up from the skirting, because nobody maintains this room
    for (let i = 0; i < 9; i++) {
      const dx = (i * 41) % GAME_W;
      scene.add.ellipse(dx, FLOOR_Y2 - 4, 26 + (i % 3) * 14, 16, 0x0f0a0c).setAlpha(0.35);
    }

    // ---- THE FLOOR: boards running away from the player, and the machine's
    // own shadow pooling under it.
    scene.add.rectangle(0, FLOOR_Y2, GAME_W, 180 - FLOOR_Y2, 0x2a1a18).setOrigin(0, 0);
    scene.add.rectangle(0, FLOOR_Y2, GAME_W, 2, 0x140d0f).setOrigin(0, 0);
    for (let i = 0; i < 7; i++) {
      scene.add.rectangle(0, FLOOR_Y2 + 6 + i * 7, GAME_W, 1, 0x1e1214).setOrigin(0, 0).setAlpha(0.6);
    }
    scene.add.ellipse(CYL_X, FLOOR_Y2 + 8, 150, 26, 0x0c0709).setAlpha(0.55);

    // ---- THE LAMP.  One bulb on a flex, directly over the machine, and the
    // cone of light it throws.  It is the reason the corners are dark.
    scene.add.rectangle(CYL_X - 0.5, 18, 1, 14, 0x3a2228).setOrigin(0, 0);
    scene.add.ellipse(CYL_X, 34, 26, 9, 0x3f2a30);
    scene.add.ellipse(CYL_X, 33, 22, 7, 0x5a3c44);
    scene.add.circle(CYL_X, 38, 3.4, 0xffd9a0).setAlpha(0.95);
    // A Phaser triangle sits on the CENTROID of its points, not on the first
    // one -- placing this at the bulb put the apex thirty pixels above it,
    // which is up inside the header.  The offset is a third of the height.
    const coneH = 104;
    scene.add.triangle(CYL_X, 38 + coneH / 3, -54, coneH, 54, coneH, 0, 0, 0xffd9a0).setAlpha(0.055);
    scene.add.triangle(CYL_X, 38 + coneH / 3, -30, coneH, 30, coneH, 0, 0, 0xffd9a0).setAlpha(0.045);

    // ---- AND WHOSE ROOM IT IS.
    //
    // A framed portrait on the back wall, off to one side, lit badly: Froggy,
    // watching whoever is at the machine.  Environmental storytelling rather
    // than decoration -- the house is present while you gamble, and it is not
    // saying anything.
    // Clear of the two rules lines across the top -- it was hanging through
    // the word CLEAN -- and low enough to sit on the panelling rather than in
    // the text.
    const px = 40;
    const py = 72;
    scene.add.rectangle(px - 15, py - 16, 30, 32, 0x4a3018).setOrigin(0, 0);
    scene.add.rectangle(px - 13, py - 14, 26, 28, 0x1c2a1e).setOrigin(0, 0);
    scene.add.ellipse(px, py + 6, 17, 16, 0x2f5d33);
    scene.add.ellipse(px, py - 3, 18, 14, 0x3d7a42);
    for (const sx of [-4.6, 4.6]) {
      scene.add.ellipse(px + sx, py - 7, 6.4, 6, PALETTE.cream).setAlpha(0.92);
      scene.add.circle(px + sx, py - 6.6, 2.4, PALETTE.black);
    }
    // Badly lit, not unlit.  At 0.45 he was a dark green smear in a frame and
    // the one thing the portrait is for -- being looked at -- did not happen.
    scene.add.rectangle(px - 13, py - 14, 26, 28, 0x000000).setOrigin(0, 0).setAlpha(0.2);

    // a bare bulb bracket and a dead one beside the portrait, for the corner
    scene.add.rectangle(GAME_W - 34, 44, 10, 2, 0x3a2228).setOrigin(0, 0);
    scene.add.circle(GAME_W - 30, 48, 2.2, 0x2a1a1e);
    scene.add.rectangle(0, 18, GAME_W, 2, 0x40202a).setOrigin(0, 0);

    // The machine's face: a cylinder, five chambers, and a hammer.
    scene.add.ellipse(CYL_X, CYL_Y + 12, CYL_R * 3.2, CYL_R * 2.4, 0x3a2028).setAlpha(0.5);
    scene.add.circle(CYL_X, CYL_Y, CYL_R + 8, 0x6b4a52);
    scene.add.circle(CYL_X, CYL_Y, CYL_R + 6, 0x2b1a1e);
    scene.add.circle(CYL_X, CYL_Y, CYL_R, 0x3d2a2e).setStrokeStyle(1, 0x6b4a52);
    for (let i = 0; i < CHAMBERS; i++) {
      const dot = scene.add.circle(CYL_X, CYL_Y, 6, 0x120a0c);
      dot.setStrokeStyle(1, 0x5a3d44);
      chamberDots.push(dot);
    }
    // the hammer, so the top chamber reads as the one that fires
    scene.add.triangle(CYL_X, CYL_Y - CYL_R - 12, 0, 0, 8, 0, 4, 8, 0x8a6a72);
    placeDots();

    // The deal, on the face of the machine, before a token moves.
    text(scene, 10, 30, `ONE LIVE ROUND IN ${CHAMBERS}`, PALETTE.ash);
    text(scene, 10, 40, `${PAY_PER_PULL} A CLEAN PULL`, PALETTE.gold);
    text(scene, GAME_W - 10, 30, 'SPIN, STOP, THEN PULL', PALETTE.ash).setOrigin(1, 0);
    text(scene, GAME_W - 10, 40, 'CASH OUT ANY TIME', PALETTE.gold).setOrigin(1, 0);
    // The warning, in plain words and clear of the machine.  "THE LIVE ONE
    // TAKES THE LOT" was a card-room turn of phrase for the one rule a player
    // has to understand before they touch the lever, and it sat across the
    // bottom of the cylinder while it said it.
    scene.add.rectangle(18, 122, GAME_W - 36, 13, 0x2a0f14).setOrigin(0, 0).setStrokeStyle(1, 0x5a2028);
    centerText(scene, GAME_W / 2, 128, 'IF YOU GET SHOT, YOU LOSE ALL YOUR TOKENS', PALETTE.blood);

    tally = centerText(scene, GAME_W / 2, 142, '', PALETTE.gold);
    status = centerText(scene, GAME_W / 2, 153, '', PALETTE.ash);

    // Two slots, and a button is shown only when its action is available —
    // so what the machine will let you do next is readable without reading.
    stopBtn = button(scene, 160, 168, 'STOP SPINNING', () => stopSpin(), { width: 92, height: 12 });
    pullBtn = button(scene, 160, 168, 'PULL TRIGGER', () => pull(), { width: 92, height: 12 });
    cashBtn = button(scene, 264, 168, 'CASH OUT', () => cashOut(), { width: 84, height: 12 });
    // SPACE is whichever of the two it could sensibly be: stop a turning
    // cylinder, pull a stopped one.  It never does both in one press, so the
    // trigger is still something the player asks for on purpose.
    scene.input.keyboard?.on('keydown-SPACE', () => {
      if (phase === 'spinning') stopSpin();
      else if (phase === 'stopped') pull();
    });
    scene.input.keyboard?.on('keydown-ENTER', () => cashOut());

    refresh();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__chamber = {
        state: () => ({
          survived,
          pot,
          over,
          phase,
          spinning: phase === 'spinning',
          canPull: phase === 'stopped',
          chambers: CHAMBERS,
          payPerPull: PAY_PER_PULL,
          dots: chamberDots.length,
        }),
        /** Pull without the cylinder deciding, for testing both endings. */
        rig: (outcome: 'clean' | 'live') => {
          rigged = outcome;
        },
        stop: () => stopSpin(),
        pull: () => pull(),
        walk: () => cashOut(),
        /**
         * Sample the DRAW itself.  A pull takes a spin, a stop and the hammer
         * before it says anything, so the odds cannot be checked by pulling —
         * and what is under test is the decision, which is this line.  It is
         * the same expression `pull` uses and there is no second one.
         */
        sample: (n: number) => {
          let live = 0;
          for (let i = 0; i < n; i++) if (Math.floor(Math.random() * CHAMBERS) === 0) live++;
          return live;
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__chamber;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over) return;
    if (phase === 'spinning') {
      // The shove a pull hands back bleeds off to the idle turn, so the
      // barrel visibly comes round and settles instead of running flat.
      spinVel = Math.max(SPIN_BASE, spinVel - SPIN_DECAY * delta);
      spin += spinVel * delta;
      placeDots();
    } else if (phase === 'stopping') {
      // Coasting down onto the nearest chamber ahead of it, the way a cylinder
      // drops onto its detent, rather than halting wherever the frame landed.
      const target = Math.ceil(spin / STEP) * STEP;
      spin = Math.min(target, spin + Math.max(SETTLE * delta, (target - spin) * 0.12));
      placeDots();
      if (target - spin < 0.004) {
        spin = target;
        placeDots();
        phase = 'stopped';
        audio.sfx('lock_click', 0.6);
        refresh();
      }
    }
  },

  destroy() {
    chamberDots = [];
    status = null;
    tally = null;
    stopBtn = null;
    pullBtn = null;
    cashBtn = null;
    sceneRef = null;
    apiRef = null;
  },
};

/** Lay the six chambers round the face at the cylinder's current angle. */
function placeDots(): void {
  chamberDots.forEach((d, i) => {
    const a = i * STEP - Math.PI / 2 + spin;
    d.setPosition(CYL_X + Math.cos(a) * (CYL_R - 12), CYL_Y + Math.sin(a) * (CYL_R - 12));
  });
}

/**
 * Which chamber the hammer is actually over, from the angle rather than from
 * an assumption.  It is only ever used to colour the losing one in, so the
 * picture agrees with what the machine just said.
 */
function underHammer(): number {
  let best = 0;
  let closest = Infinity;
  chamberDots.forEach((d, i) => {
    const gap = Math.abs(d.y - (CYL_Y - (CYL_R - 12))) + Math.abs(d.x - CYL_X);
    if (gap < closest) {
      closest = gap;
      best = i;
    }
  });
  return best;
}

/** Let it coast down onto a chamber.  The trigger works once it has. */
function stopSpin(): void {
  if (phase !== 'spinning') return;
  phase = 'stopping';
  status?.setText('...');
  refresh();
}

/**
 * One trigger pull, and it only happens because the player asked for it: the
 * machine never fires on its own when the cylinder stops.
 *
 * `phase` is the whole of the guard.  It goes to `firing` the moment the
 * hammer starts to fall and nothing brings it back except the outcome, so the
 * lever, the space bar and the cash-out button are all dead for the length of
 * a pull.  Nothing here credits anything — a clean pull only raises `pot`.
 */
function pull(): void {
  if (phase !== 'stopped' || !sceneRef) return;
  phase = 'firing';
  refresh();
  status?.setText('...');
  audio.sfx('lock_click');

  sceneRef.time.delayedCall(HAMMER_MS, () => {
    // ONE IN FIVE, drawn here and nowhere else.  The cylinder's angle is
    // scenery; this line is the machine being fair.
    const live = rigged ? rigged === 'live' : Math.floor(Math.random() * CHAMBERS) === 0;
    rigged = null;
    if (live) {
      phase = 'over';
      status?.setText(pot > 0 ? `THE LIVE ONE. THE ${pot} GOES WITH IT.` : 'THE LIVE ONE');
      // Everything on the machine goes with it, and it goes BEFORE `finish`
      // reads the pot — so there is nothing left for the shell to be handed.
      pot = 0;
      refresh();
      chamberDots[underHammer()]?.setFillStyle(PALETTE.blood);
      sceneRef?.cameras.main.shake(320, 0.02);
      finish(false);
      return;
    }

    survived++;
    pot += PAY_PER_PULL;
    audio.sfx('ui_blip');
    // AND THEN THE BARREL TURNS AGAIN, by itself.  Step 4 of the loop: the
    // player is handed the same decision back, with more on the machine.
    phase = 'spinning';
    spinVel = SPIN_KICK;
    refresh();
    status?.setText(`CLICK. +${PAY_PER_PULL}. THE BARREL SPINS AGAIN.`);
  });
}

/**
 * Cashing out with the pot.  The twenty is spent either way — what is being
 * decided here is whether the tokens on the machine come with you.
 *
 * It cannot be taken twice, and it cannot be taken mid-pull: `finish` latches
 * `over`, and `phase` is checked before anything else happens.
 */
function cashOut(): void {
  if (over || pot <= 0) return;
  if (phase !== 'spinning' && phase !== 'stopping' && phase !== 'stopped') return;
  phase = 'over';
  status?.setText(`YOU CASH OUT WITH ${pot}`);
  finish(true);
}

function refresh(): void {
  tally?.setText(pot > 0 ? `${survived} CLEAN   -   ${pot} UNCASHED` : `${survived} CLEAN   -   NOTHING ON THE MACHINE`);
  // A button is on screen exactly when pressing it would do something.
  stopBtn?.setVisible(phase === 'spinning');
  pullBtn?.setVisible(phase === 'stopped');
  // Cash out only once there is something to cash out, and never once the
  // round is finished.
  const canCash = pot > 0 && (phase === 'spinning' || phase === 'stopping' || phase === 'stopped');
  cashBtn?.setVisible(canCash);
  const cashLabel = cashBtn?.getAt(1) as Phaser.GameObjects.BitmapText | undefined;
  cashLabel?.setText(`CASH OUT ${pot}`);
  if (phase === 'spinning') status?.setText('SPINNING. STOP IT WHEN YOU LIKE.');
  else if (phase === 'stopped') status?.setText('STOPPED. PULL WHEN YOU ARE READY.');
}

/**
 * `won` here means "there is a pot to pay".  The shell credits exactly what is
 * on the machine — nothing was credited pull by pull, which is what makes the
 * live round able to take it all back.
 *
 * `paid` is read once, here, and closed over, so nothing that happens in the
 * second and a half before the shell is called can change what it is handed.
 */
function finish(won: boolean): void {
  if (over) return;
  over = true;
  phase = 'over';
  stopBtn?.setVisible(false);
  pullBtn?.setVisible(false);
  cashBtn?.setVisible(false);
  audio.sfx(won ? 'chime' : 'buzzer');
  const paid = pot;
  sceneRef?.time.delayedCall(1500, () => (won && paid > 0 ? apiRef?.win(paid) : apiRef?.lose()));
}
