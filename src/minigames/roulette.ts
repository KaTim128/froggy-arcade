/**
 * CHAMBER.  Hard — 5 tokens in, and up to 15 back out.
 *
 * The arcade's russian-roulette cabinet, and it is a cabinet: a cylinder
 * diagram, a lever, and six chambers with one live round in them.  There is no
 * gun and nobody points anything at themselves — what is at stake is the five
 * tokens you put in, and the whole game is on the machine's face.
 *
 * FIVE PULLS, three tokens a clean one, and the pot is not yours until you
 * walk.  Leave whenever you like and you keep what is on the machine; take the
 * live one and the whole pot goes with it.  The cylinder spins between pulls,
 * so every pull is an independent one in six and nothing about the run so far
 * changes the next one.
 *
 * The arithmetic, since the machine states it and the player should be able to
 * check it: surviving all five is (5/6)^5 = 40%, which pays 15 against the 5 it
 * cost — about a token of expected value a play.  Stopping early is worse than
 * going on at every single step, which is the joke: the machine is honest, and
 * the honest play is to keep pulling.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const CHAMBERS = 6;
/** The most it will let you pull.  There is no sixth. */
const MAX_PULLS = 5;
/** What a clean pull adds to the pot, and what the pot tops out at. */
const PAY_PER_PULL = 3;
export const MAX_POT = MAX_PULLS * PAY_PER_PULL;

const CYL_X = GAME_W / 2;
/**
 * The cylinder sits high enough that the warning under it has a row of its
 * own.  Nothing is allowed to be printed over the machine: the player has to
 * be able to see the chambers, the hammer and the lever at all times.
 */
const CYL_Y = 80;
const CYL_R = 32;

let survived = 0;
/** Tokens on the machine.  Nothing is credited until the player walks. */
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
  rules: 'three a pull, five pulls, one live round',
  payoutNote: 'PAYS 3 A PULL',
  tutorial: {
    objective: [
      'EVERY CLEAN PULL PAYS 3. FIVE PULLS MAX.',
      'ONE ROUND IN SIX IS LIVE.',
      'WALK AND KEEP IT - OR LOSE THE LOT.',
    ],
    controls: [
      ['SPACE', 'PULL'],
      ['MOUSE', 'PULL OR WALK AWAY'],
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

    // The machine's face: a cylinder, six chambers, and a lever.
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
    text(scene, GAME_W - 10, 30, `${MAX_PULLS} PULLS MAX`, PALETTE.ash).setOrigin(1, 0);
    text(scene, GAME_W - 10, 40, `UP TO ${MAX_POT}`, PALETTE.gold).setOrigin(1, 0);
    // The warning, in plain words and clear of the machine.  "THE LIVE ONE
    // TAKES THE LOT" was a card-room turn of phrase for the one rule a player
    // has to understand before they touch the lever, and it sat across the
    // bottom of the cylinder while it said it.
    scene.add.rectangle(18, 122, GAME_W - 36, 13, 0x2a0f14).setOrigin(0, 0).setStrokeStyle(1, 0x5a2028);
    centerText(scene, GAME_W / 2, 128, 'IF YOU GET SHOT, YOU LOSE ALL YOUR TOKENS', PALETTE.blood);

    tally = centerText(scene, GAME_W / 2, 142, '', PALETTE.gold);
    status = centerText(scene, GAME_W / 2, 153, 'THE CYLINDER SPINS EVERY PULL', PALETTE.ash);

    pullBtn = button(scene, GAME_W / 2 - 46, 168, 'PULL', () => pull(), { width: 60, height: 12 });
    cashBtn = button(scene, GAME_W / 2 + 46, 168, 'WALK AWAY', () => cashOut(), { width: 72, height: 12 });
    scene.input.keyboard?.on('keydown-SPACE', () => pull());

    refresh();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__chamber = {
        state: () => ({ survived, pot, over, busy, maxPulls: MAX_PULLS, payPerPull: PAY_PER_PULL }),
        /** Pull without the cylinder deciding, for testing both endings. */
        rig: (outcome: 'clean' | 'live') => {
          rigged = outcome;
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
  tally?.setText(`${survived} / ${MAX_PULLS} CLEAN   -   ${pot} ON THE MACHINE`);
  // You may walk at any point, including before you have pulled at all.
  cashBtn?.setVisible(!over);
  pullBtn?.setVisible(!over && survived < MAX_PULLS);
}

function pull(): void {
  if (over || busy || !sceneRef) return;
  // Five and no more.  The button goes with the fifth, and this is the latch
  // behind it so nothing else can ask for a sixth.
  if (survived >= MAX_PULLS) return;
  busy = true;
  status?.setText('...');
  audio.sfx('lock_click');

  sceneRef.time.delayedCall(900, () => {
    busy = false;
    // Independent every time: the cylinder is spun between pulls.
    const live = rigged ? rigged === 'live' : Math.floor(Math.random() * CHAMBERS) === 0;
    rigged = null;
    if (live) {
      status?.setText(pot > 0 ? `THE LIVE ONE. THE ${pot} GOES WITH IT.` : 'THE LIVE ONE');
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
    if (survived >= MAX_PULLS) {
      status?.setText(`FIVE CLEAN. THE MACHINE PAYS ${pot}.`);
      finish(true);
      return;
    }
    status?.setText(`CLICK.  ${pot} ON THE MACHINE.  AGAIN?`);
  });
}

/**
 * Walking away with the pot.  The entry fee is spent either way — what is
 * being decided here is whether the tokens on the machine come with you.
 */
function cashOut(): void {
  if (over || busy) return;
  status?.setText(pot > 0 ? `YOU WALK WITH ${pot}` : 'YOU WALK AWAY');
  finish(pot > 0);
}

/**
 * `won` here means "there is a pot to pay".  The shell credits exactly what is
 * on the machine — nothing was credited pull by pull, which is what makes the
 * live round able to take it all back.
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
