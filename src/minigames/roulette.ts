/**
 * CHAMBER.  Hard — 20 tokens in, and whatever you have the nerve to hold.
 *
 * The arcade's russian-roulette cabinet, and it is a cabinet: a cylinder
 * diagram, a lever, and five chambers with one live round in them.  There is
 * no gun and nobody points anything at themselves — what is at stake is the
 * twenty tokens you put in, and the whole game is on the machine's face.
 *
 * TWENTY IN, FIVE A CLEAN PULL, AND NO LIMIT ON THE PULLS.  The pot is not
 * yours until you CASH OUT.  Every clean pull adds five to the machine and
 * hands you the same two buttons back: take what is sitting there, or risk it
 * for another five.  Take the live one and the whole pot goes with it.
 *
 * THE CYLINDER RESPINS AFTER EVERY SINGLE PULL, clean or not, and the respin
 * is a thing you watch happen before the buttons come back.  So every pull is
 * an independent ONE IN FIVE — drawn from `Math.random()` at the moment the
 * hammer falls, not acted out by an animation that knows the answer — and
 * nothing about the run so far changes the next one.
 *
 * The arithmetic, since the machine states it and the player should be able to
 * check it: continuing from a pot of p is worth 0.8 * (p + 5), so it beats
 * cashing out for p right up to a pot of twenty and never after.  Played that
 * way a round returns about eight of the twenty it cost.  The machine is
 * honest about its odds and it is still a machine in a casino.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

/**
 * One live round in five, so a pull is a flat 1-in-5 of ending the round.  It
 * is the only number the odds come from: the draw below is
 * `Math.floor(Math.random() * CHAMBERS) === 0` and there is nothing else.
 */
const CHAMBERS = 5;
/** What a clean pull adds to the pot. */
const PAY_PER_PULL = 5;
/**
 * How long the cylinder spins between the hammer falling and the buttons
 * coming back.  It is after EVERY pull — the respin is part of the loop, not
 * something that happens to be true of the first one.
 */
const RESPIN_MS = 700;

const CYL_X = GAME_W / 2;
/**
 * The cylinder sits high enough that the warning under it has a row of its
 * own.  Nothing is allowed to be printed over the machine: the player has to
 * be able to see the chambers, the hammer and the lever at all times.
 */
const CYL_Y = 80;
const CYL_R = 32;

let survived = 0;
/**
 * Tokens on the machine.  NOTHING is credited until the player cashes out —
 * `finish` is the only thing in this file that can move a token, it is latched
 * behind `over`, and it pays the pot exactly once.  That is what makes the
 * live round able to take it all back, and what makes cashing out twice or
 * collecting a pull and a cash-out for the same five impossible.
 */
let pot = 0;
let over = false;
let busy = false;
let spin = 0;
let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let chamberDots: Phaser.GameObjects.Arc[] = [];
let cylinder: Phaser.GameObjects.Arc | null = null;
let status: Phaser.GameObjects.BitmapText | null = null;
let tally: Phaser.GameObjects.BitmapText | null = null;
let pullBtn: Phaser.GameObjects.Container | null = null;
let cashBtn: Phaser.GameObjects.Container | null = null;
/** DEV only: forces the next pull's outcome so both endings are testable. */
let rigged: 'clean' | 'live' | null = null;

export const roulette: MinigameModule = {
  id: 'roulette',
  title: 'CHAMBER',
  music: 'game_roulette',
  rules: '20 in, five a pull, one live round in five',
  payoutNote: `PAYS ${PAY_PER_PULL} A PULL`,
  tutorial: {
    objective: [
      `EVERY CLEAN PULL PAYS ${PAY_PER_PULL}.`,
      `ONE ROUND IN ${CHAMBERS} IS LIVE, EVERY PULL.`,
      'CASH OUT AND KEEP IT - OR LOSE THE LOT.',
    ],
    controls: [
      ['SPACE', 'PULL THE TRIGGER'],
      ['MOUSE', 'PULL OR CASH OUT'],
    ],
  },
  touch: { buttons: [{ label: 'PULL', key: 'SPACE', primary: true }] },

  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    survived = 0;
    pot = 0;
    over = false;
    busy = false;
    spin = 0;
    chamberDots = [];

    scene.add.rectangle(0, 18, GAME_W, 162, 0x1a1012).setOrigin(0, 0);
    scene.add.rectangle(0, 18, GAME_W, 2, 0x40202a).setOrigin(0, 0);

    // The machine's face: a cylinder, five chambers, and a lever.
    scene.add.ellipse(CYL_X, CYL_Y + 12, CYL_R * 3.2, CYL_R * 2.4, 0x3a2028).setAlpha(0.5);
    scene.add.circle(CYL_X, CYL_Y, CYL_R + 8, 0x6b4a52);
    scene.add.circle(CYL_X, CYL_Y, CYL_R + 6, 0x2b1a1e);
    cylinder = scene.add.circle(CYL_X, CYL_Y, CYL_R, 0x3d2a2e).setStrokeStyle(1, 0x6b4a52);
    for (let i = 0; i < CHAMBERS; i++) {
      const a = (i / CHAMBERS) * Math.PI * 2 - Math.PI / 2;
      const dot = scene.add.circle(
        CYL_X + Math.cos(a) * (CYL_R - 12),
        CYL_Y + Math.sin(a) * (CYL_R - 12),
        6,
        0x120a0c,
      );
      dot.setStrokeStyle(1, 0x5a3d44);
      chamberDots.push(dot);
    }
    // the hammer, so the top chamber reads as the one that fires
    scene.add.triangle(CYL_X, CYL_Y - CYL_R - 12, 0, 0, 8, 0, 4, 8, 0x8a6a72);

    // The deal, on the face of the machine, before a token moves.
    text(scene, 10, 30, `1 LIVE ROUND IN ${CHAMBERS}`, PALETTE.ash);
    text(scene, 10, 40, `${PAY_PER_PULL} A CLEAN PULL`, PALETTE.gold);
    text(scene, GAME_W - 10, 30, 'AS OFTEN AS YOU DARE', PALETTE.ash).setOrigin(1, 0);
    text(scene, GAME_W - 10, 40, 'CASH OUT ANY TIME', PALETTE.gold).setOrigin(1, 0);
    // The warning, in plain words and clear of the machine.  "THE LIVE ONE
    // TAKES THE LOT" was a card-room turn of phrase for the one rule a player
    // has to understand before they touch the lever, and it sat across the
    // bottom of the cylinder while it said it.
    scene.add.rectangle(18, 122, GAME_W - 36, 13, 0x2a0f14).setOrigin(0, 0).setStrokeStyle(1, 0x5a2028);
    centerText(scene, GAME_W / 2, 128, 'IF YOU GET SHOT, YOU LOSE ALL YOUR TOKENS', PALETTE.blood);

    tally = centerText(scene, GAME_W / 2, 142, '', PALETTE.gold);
    status = centerText(scene, GAME_W / 2, 153, 'THE CYLINDER RESPINS AFTER EVERY PULL', PALETTE.ash);

    pullBtn = button(scene, GAME_W / 2 - 48, 168, 'PULL', () => pull(), { width: 68, height: 12 });
    cashBtn = button(scene, GAME_W / 2 + 48, 168, 'CASH OUT', () => cashOut(), { width: 68, height: 12 });
    scene.input.keyboard?.on('keydown-SPACE', () => pull());

    refresh();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__chamber = {
        state: () => ({ survived, pot, over, busy, chambers: CHAMBERS, payPerPull: PAY_PER_PULL }),
        /** Pull without the cylinder deciding, for testing both endings. */
        rig: (outcome: 'clean' | 'live') => {
          rigged = outcome;
        },
        /**
         * Sample the DRAW itself.  A pull takes a second and a half of spinning
         * before it says anything, so the odds cannot be checked by pulling —
         * and what is under test is the decision, which is this line.  It is
         * the same expression `pull` uses and there is no second one.
         */
        sample: (n: number) => {
          let live = 0;
          for (let i = 0; i < n; i++) if (Math.floor(Math.random() * CHAMBERS) === 0) live++;
          return live;
        },
        pull: () => pull(),
        walk: () => cashOut(),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__chamber;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over || !busy || !cylinder) return;
    // Spinning: the chambers blur round the face.
    spin += delta * 0.012;
    chamberDots.forEach((d, i) => {
      const a = (i / CHAMBERS) * Math.PI * 2 - Math.PI / 2 + spin;
      d.setPosition(CYL_X + Math.cos(a) * (CYL_R - 12), CYL_Y + Math.sin(a) * (CYL_R - 12));
    });
  },

  destroy() {
    chamberDots = [];
    cylinder = null;
    status = null;
    tally = null;
    pullBtn = null;
    cashBtn = null;
    sceneRef = null;
    apiRef = null;
  },
};

function refresh(): void {
  tally?.setText(`${survived} CLEAN   -   ${pot} ON THE MACHINE`);
  // Both buttons, after every clean pull, for as long as the player wants
  // them: cash out with what is on the machine, or put it back on the lever.
  cashBtn?.setVisible(!over);
  pullBtn?.setVisible(!over);
  // The lever says what pressing it actually costs you now.  Before the first
  // pull there is nothing on the machine to lose, so it is just a pull.
  const lbl = pullBtn?.getAt(1) as Phaser.GameObjects.BitmapText | undefined;
  lbl?.setText(pot > 0 ? 'CONTINUE' : 'PULL');
}

/**
 * One trigger pull.
 *
 * `busy` is the whole of the re-entrancy guard: it goes up the moment the
 * lever moves and does not come down until the cylinder has respun, so the
 * lever, the space bar and the cash-out button are all dead for the length of
 * a pull.  Nothing here credits anything — a clean pull only raises `pot`, and
 * the pot is paid once, by `finish`, when the player cashes out.
 */
function pull(): void {
  if (over || busy || !sceneRef) return;
  busy = true;
  refresh();
  status?.setText('...');
  audio.sfx('lock_click');

  sceneRef.time.delayedCall(900, () => {
    // ONE IN FIVE, drawn here and nowhere else.  The spinning above is the
    // machine being watchable; this line is the machine being fair.
    const live = rigged ? rigged === 'live' : Math.floor(Math.random() * CHAMBERS) === 0;
    rigged = null;
    if (live) {
      busy = false;
      status?.setText(pot > 0 ? `THE LIVE ONE. THE ${pot} GOES WITH IT.` : 'THE LIVE ONE');
      // Everything on the machine goes with it, and it goes BEFORE `finish`
      // reads the pot — so there is nothing left for the shell to be handed.
      pot = 0;
      refresh();
      chamberDots[0]?.setFillStyle(PALETTE.blood);
      sceneRef?.cameras.main.shake(320, 0.02);
      finish(false);
      return;
    }

    survived++;
    pot += PAY_PER_PULL;
    audio.sfx('ui_blip');
    refresh();
    // AND THEN IT RESPINS.  Every pull, clean or not — this is the clean half,
    // and the live half ended the round instead.  The buttons stay dead until
    // the cylinder has come round, so "cash out or continue" is a choice made
    // against a chamber nobody knows anything about.
    status?.setText(`CLICK.  +${PAY_PER_PULL}.  RESPINNING...`);
    sceneRef?.time.delayedCall(RESPIN_MS, () => {
      if (over) return;
      busy = false;
      refresh();
      status?.setText(`${pot} ON THE MACHINE.  CASH OUT OR CONTINUE?`);
    });
  });
}

/**
 * Cashing out with the pot.  The twenty is spent either way — what is being
 * decided here is whether the tokens on the machine come with you.
 *
 * It cannot be taken twice: `finish` latches `over`, and `over` is the first
 * thing this checks.
 */
function cashOut(): void {
  if (over || busy) return;
  status?.setText(pot > 0 ? `YOU CASH OUT WITH ${pot}` : 'YOU WALK AWAY WITH NOTHING');
  finish(pot > 0);
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
  busy = false;
  pullBtn?.setVisible(false);
  cashBtn?.setVisible(false);
  audio.sfx(won ? 'chime' : 'buzzer');
  const paid = pot;
  sceneRef?.time.delayedCall(1500, () => (won && paid > 0 ? apiRef?.win(paid) : apiRef?.lose()));
}
