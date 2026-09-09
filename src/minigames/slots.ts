/**
 * FROGGY SLOTS.  Medium — 3 tokens in, 6 out.
 *
 * Three reels, three spins to land a line.  The reels stop left to right with a
 * beat between them, which is the whole appeal of a slot machine: the third
 * reel is the only one that has ever mattered.
 *
 * The odds are deliberately readable rather than generous — seven symbols means
 * a straight three-of-a-kind is 1 in 49 a spin, so two of a kind pays as well
 * and three spins gets the win rate somewhere near a third.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

/** Colour and label per symbol.  Froggy's face is the jackpot, obviously. */
const SYMBOLS = [
  { label: 'F', color: 0x3fe39b },
  { label: '7', color: 0xff4fa3 },
  { label: 'C', color: 0xffd45e },
  { label: 'B', color: 0xff7a3d },
  { label: 'X', color: 0x7b4bd8 },
  { label: 'O', color: 0x46c4bd },
  { label: 'V', color: 0xd6dce4 },
];

const SPINS = 3;
const REEL_X = [96, 160, 224];

interface Reel {
  index: number;
  spinning: boolean;
  stopAt: number;
  face: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
}

let reels: Reel[] = [];
let spinsLeft = SPINS;
let busy = false;
let over = false;
let tick = 0;
let status: Phaser.GameObjects.BitmapText | null = null;
let counter: Phaser.GameObjects.BitmapText | null = null;
let lever: Phaser.GameObjects.Container | null = null;
let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;

export const slots: MinigameModule = {
  id: 'slots',
  title: 'FROGGY SLOTS',
  rules: 'three spins, land a line',

  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    over = false;
    busy = false;
    spinsLeft = SPINS;
    tick = 0;
    reels = [];

    scene.add.rectangle(0, 18, GAME_W, 162, 0x2b1430).setOrigin(0, 0);
    // cabinet body
    scene.add.rectangle(64, 46, 192, 84, 0x53215c).setOrigin(0, 0).setStrokeStyle(1, 0xff4fa3);
    scene.add.rectangle(70, 52, 180, 60, 0x1a0a1e).setOrigin(0, 0);

    REEL_X.forEach((x, i) => {
      scene.add.rectangle(x, 82, 48, 52, 0x08040a);
      const face = scene.add.rectangle(x, 82, 42, 46, SYMBOLS[0].color);
      const label = centerText(scene, x, 82, SYMBOLS[0].label, PALETTE.ink, 16);
      reels.push({ index: i, spinning: false, stopAt: 0, face, label });
    });

    counter = centerText(scene, GAME_W / 2, 34, '', PALETTE.gold);
    status = centerText(scene, GAME_W / 2, 124, 'PULL THE LEVER', PALETTE.cream);
    lever = button(scene, GAME_W / 2, 150, 'SPIN', () => spin(), { width: 64, height: 14 });
    scene.input.keyboard?.on('keydown-SPACE', () => spin());

    refresh();
  },

  update(_t: number, delta: number) {
    if (over) return;
    tick += delta;
    // Reels blur while they turn; the number underneath is only real on a stop.
    for (const r of reels) {
      if (!r.spinning) continue;
      const s = SYMBOLS[Math.floor((tick / 60 + r.index * 2) % SYMBOLS.length)];
      r.face.setFillStyle(s.color);
      r.label.setText(s.label);
    }
  },

  destroy() {
    reels = [];
    status = null;
    counter = null;
    lever = null;
    sceneRef = null;
    apiRef = null;
  },
};

function refresh(): void {
  counter?.setText(`SPINS ${spinsLeft}`);
}

function spin(): void {
  if (over || busy || spinsLeft <= 0 || !sceneRef) return;
  busy = true;
  spinsLeft--;
  refresh();
  status?.setText('...');
  audio.sfx('ticket_machine');

  for (const r of reels) {
    r.spinning = true;
    r.stopAt = Math.floor(Math.random() * SYMBOLS.length);
  }

  // Left to right, with a beat between: the third reel is the one that matters.
  reels.forEach((r, i) => {
    sceneRef!.time.delayedCall(700 + i * 520, () => {
      r.spinning = false;
      const s = SYMBOLS[r.stopAt];
      r.face.setFillStyle(s.color);
      r.label.setText(s.label);
      audio.sfx('ui_blip');
      if (i === reels.length - 1) settle();
    });
  });
}

function settle(): void {
  if (!sceneRef) return;
  const [a, b, c] = reels.map((r) => r.stopAt);

  if (a === b && b === c) {
    status?.setText(a === 0 ? 'FROGGY JACKPOT' : 'THREE OF A KIND');
    finish(true);
    return;
  }
  if (a === b || b === c || a === c) {
    status?.setText('TWO OF A KIND - PAYS');
    finish(true);
    return;
  }

  busy = false;
  if (spinsLeft <= 0) {
    status?.setText('NO LINE');
    finish(false);
  } else {
    status?.setText('NOTHING. AGAIN?');
  }
}

function finish(won: boolean): void {
  if (over) return;
  over = true;
  busy = true;
  lever?.setVisible(false);
  audio.sfx(won ? 'chime' : 'buzzer');
  sceneRef?.time.delayedCall(1300, () => (won ? apiRef?.win() : apiRef?.lose()));
}
