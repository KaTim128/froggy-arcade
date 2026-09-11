/**
 * CHAMBER.  Hard — 5 tokens in, 10 out.
 *
 * The arcade's russian-roulette cabinet, and it is a cabinet: a cylinder
 * diagram, a lever, and six chambers with one live round in them.  There is no
 * gun and nobody points anything at themselves — what is at stake is the five
 * tokens you put in, and the whole game is on the machine's face.
 *
 * Four clean pulls wins.  The cylinder spins between pulls, so every pull is an
 * independent one-in-six and the odds of the full run are (5/6)^4 — a shade
 * under half.  You may cash out after two, which loses the entry fee but ends
 * it: the interesting decision is whether the last two pulls are worth ten.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const CHAMBERS = 6;
const PULLS_TO_WIN = 4;
/** Cashing out is allowed only once you have something to lose. */
const CASH_OUT_AFTER = 2;

const CYL_X = GAME_W / 2;
const CYL_Y = 86;
const CYL_R = 34;

let survived = 0;
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

export const roulette: MinigameModule = {
  id: 'roulette',
  title: 'CHAMBER',
  music: 'game_roulette',
  rules: 'four clean pulls',

  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    survived = 0;
    over = false;
    busy = false;
    spin = 0;
    chamberDots = [];

    scene.add.rectangle(0, 18, GAME_W, 162, 0x1a1012).setOrigin(0, 0);
    scene.add.rectangle(0, 18, GAME_W, 2, 0x40202a).setOrigin(0, 0);

    // The machine's face: a cylinder, six chambers, and a lever.
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

    text(scene, 10, 30, `1 LIVE ROUND IN ${CHAMBERS}`, PALETTE.ash);
    tally = centerText(scene, GAME_W / 2, 132, '', PALETTE.gold);
    status = centerText(scene, GAME_W / 2, 146, 'THE CYLINDER SPINS EVERY PULL', PALETTE.ash);

    pullBtn = button(scene, GAME_W / 2 - 42, 166, 'PULL', () => pull(), { width: 60, height: 13 });
    cashBtn = button(scene, GAME_W / 2 + 42, 166, 'CASH OUT', () => cashOut(), { width: 68, height: 13 });
    cashBtn.setVisible(false);
    scene.input.keyboard?.on('keydown-SPACE', () => pull());

    refresh();
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
  tally?.setText(`${survived} / ${PULLS_TO_WIN} CLEAN`);
  cashBtn?.setVisible(survived >= CASH_OUT_AFTER && !over);
}

function pull(): void {
  if (over || busy || !sceneRef) return;
  busy = true;
  status?.setText('...');
  audio.sfx('lock_click');

  sceneRef.time.delayedCall(900, () => {
    busy = false;
    // Independent every time: the cylinder is spun between pulls.
    const live = Math.floor(Math.random() * CHAMBERS) === 0;
    if (live) {
      status?.setText('THE LIVE ONE');
      chamberDots[0]?.setFillStyle(PALETTE.blood);
      sceneRef?.cameras.main.shake(320, 0.02);
      finish(false);
      return;
    }

    survived++;
    audio.sfx('ui_blip');
    refresh();
    if (survived >= PULLS_TO_WIN) {
      status?.setText('FOUR CLEAN. THE MACHINE PAYS.');
      finish(true);
      return;
    }
    status?.setText('CLICK. AGAIN?');
  });
}

/** Ends the run without the reward.  The entry fee is already gone. */
function cashOut(): void {
  if (over || busy) return;
  status?.setText('YOU WALK AWAY');
  finish(false);
}

function finish(won: boolean): void {
  if (over) return;
  over = true;
  busy = false;
  pullBtn?.setVisible(false);
  cashBtn?.setVisible(false);
  audio.sfx(won ? 'chime' : 'buzzer');
  sceneRef?.time.delayedCall(1500, () => (won ? apiRef?.win() : apiRef?.lose()));
}
