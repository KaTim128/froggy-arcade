/**
 * FROGGY SLOTS.  Two tokens a spin, and it keeps taking them.
 *
 * Five reels.  Three Froggys in a row pays six; all five pays fifteen.  The
 * paytable is on the machine, the odds are not: three in a row lands three
 * spins in ten, five in a row one in ten, and the rest is a near miss.  The
 * outcome is decided when the button is pressed and the reels are then made
 * to show it — which is exactly how a real one works.
 *
 * It is a session, like the blackjack table: the first spin is the entry
 * cost the room took, every spin after that is raised through the shell, and
 * every win is paid out on the spot.  LEAVE cashes out; QUIT does the same.
 * Nothing here touches cash — tokens in, tokens out, through the ledger.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

export const SPIN_COST = 2;
export const PAY_THREE = 6;
export const PAY_FIVE = 15;
/** The odds.  On the machine they are a secret; in the code they are a fact. */
const P_FIVE = 0.1;
const P_THREE = 0.3;

const REELS = 5;
const REEL_X = [52, 106, 160, 214, 268];
const REEL_Y = 84;

/** Colour and label per symbol.  Froggy's face is index 0. */
const SYMBOLS = [
  { label: 'F', color: 0x3fe39b },
  { label: '7', color: 0xff4fa3 },
  { label: 'C', color: 0xffd45e },
  { label: 'B', color: 0xff7a3d },
  { label: 'X', color: 0x7b4bd8 },
  { label: 'O', color: 0x46c4bd },
  { label: 'V', color: 0xd6dce4 },
];
const FROG = 0;

interface Reel {
  index: number;
  spinning: boolean;
  stopAt: number;
  face: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.BitmapText;
  eyes: Phaser.GameObjects.Rectangle[];
}

let reels: Reel[] = [];
let busy = false;
let over = false;
let firstSpin = true;
let tick = 0;
let status: Phaser.GameObjects.BitmapText | null = null;
let balance: Phaser.GameObjects.BitmapText | null = null;
let spinBtn: Phaser.GameObjects.Container | null = null;
let leaveBtn: Phaser.GameObjects.Container | null = null;
let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;

export const slots: MinigameModule = {
  id: 'slots',
  title: 'FROGGY SLOTS',
  rules: 'two tokens a spin',
  payoutNote: 'PAYS 6 / 15',

  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    over = false;
    busy = false;
    firstSpin = true;
    tick = 0;
    reels = [];

    scene.add.rectangle(0, 18, GAME_W, 162, 0x2b1430).setOrigin(0, 0);
    // cabinet body and the reel window
    scene.add.rectangle(20, 40, 280, 96, 0x53215c).setOrigin(0, 0).setStrokeStyle(1, 0xff4fa3);
    scene.add.rectangle(26, 58, 268, 54, 0x1a0a1e).setOrigin(0, 0);
    // the paytable, on the machine where a player reads it before paying
    text(scene, 30, 45, '3 FROGGYS IN A ROW = 6 TOKENS', PALETTE.gold);
    text(scene, GAME_W - 30, 45, `5 = ${PAY_FIVE}`, PALETTE.gold).setOrigin(1, 0);

    REEL_X.forEach((x, i) => {
      scene.add.rectangle(x, REEL_Y, 48, 46, 0x08040a);
      const face = scene.add.rectangle(x, REEL_Y, 42, 40, SYMBOLS[FROG].color);
      const label = centerText(scene, x, REEL_Y, SYMBOLS[FROG].label, PALETTE.ink, 16);
      // Froggy's eyes, so his symbol is a face and not a letter.
      const eyes = [scene.add.rectangle(x - 9, REEL_Y - 13, 5, 5, PALETTE.ink), scene.add.rectangle(x + 9, REEL_Y - 13, 5, 5, PALETTE.ink)];
      reels.push({ index: i, spinning: false, stopAt: FROG, face, label, eyes });
      show(reels[i], FROG);
    });

    balance = text(scene, 30, 118, '', PALETTE.cream);
    status = centerText(scene, GAME_W / 2, 124, 'SPIN TO PLAY', PALETTE.cream);
    spinBtn = button(scene, GAME_W / 2 - 40, 156, `SPIN - ${SPIN_COST}`, () => spin(), { width: 70, height: 14 });
    leaveBtn = button(scene, GAME_W / 2 + 40, 156, 'LEAVE', () => leave(), { width: 56, height: 14, fill: PALETTE.slate });
    scene.input.keyboard?.on('keydown-SPACE', () => spin());
    refresh();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__slots = {
        state: () => ({ busy, firstSpin, reels: reels.map((r) => r.stopAt) }),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__slots;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over) return;
    tick += delta;
    // Reels blur while they turn; the symbol underneath is only real on a stop.
    for (const r of reels) {
      if (!r.spinning) continue;
      show(r, Math.floor((tick / 55 + r.index * 2) % SYMBOLS.length));
    }
  },

  destroy() {
    reels = [];
    status = null;
    balance = null;
    spinBtn = null;
    leaveBtn = null;
    sceneRef = null;
    apiRef = null;
  },
};

function show(r: Reel, sym: number): void {
  const s = SYMBOLS[sym];
  r.face.setFillStyle(s.color);
  r.label.setText(s.label);
  for (const e of r.eyes) e.setVisible(sym === FROG);
}

function refresh(): void {
  balance?.setText(`TOKENS ${apiRef?.balance() ?? 0}`);
}

/**
 * Decide the spin, then dress the reels to match.  A three is EXACTLY three
 * in a row somewhere on the line, with the other two reels not Froggy; a
 * loss never has three consecutive Froggys anywhere on it.
 */
function draw(): number[] {
  const roll = Math.random();
  const notFrog = () => 1 + Math.floor(Math.random() * (SYMBOLS.length - 1));
  if (roll < P_FIVE) return [FROG, FROG, FROG, FROG, FROG];
  if (roll < P_FIVE + P_THREE) {
    const start = Math.floor(Math.random() * (REELS - 2));
    return Array.from({ length: REELS }, (_, i) => (i >= start && i < start + 3 ? FROG : notFrog()));
  }
  // a loss, with a near miss now and then
  for (;;) {
    const line = Array.from({ length: REELS }, () => (Math.random() < 0.3 ? FROG : notFrog()));
    let run = 0;
    let longest = 0;
    for (const s of line) {
      run = s === FROG ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    if (longest < 3) return line;
  }
}

function spin(): void {
  if (over || busy || !sceneRef || !apiRef) return;
  // The first spin is the entry cost the room already took (api.staked());
  // every one after it is two more tokens, or nothing.
  if (!firstSpin) {
    if (apiRef.balance() < SPIN_COST || !apiRef.raise(SPIN_COST)) {
      status?.setText(`NEED ${SPIN_COST} TOKENS`);
      audio.sfx('buzzer');
      return;
    }
  }
  firstSpin = false;
  busy = true;
  refresh();
  status?.setText('...');
  audio.sfx('ticket_machine');

  const line = draw();
  reels.forEach((r, i) => {
    r.spinning = true;
    r.stopAt = line[i];
  });

  // Left to right, with a beat between, so the last reel is the one that
  // matters.
  reels.forEach((r, i) => {
    sceneRef!.time.delayedCall(600 + i * 380, () => {
      r.spinning = false;
      show(r, r.stopAt);
      audio.sfx('ui_blip');
      if (i === reels.length - 1) settle();
    });
  });
}

function settle(): void {
  if (!apiRef) return;
  const line = reels.map((r) => r.stopAt);
  const five = line.every((s) => s === FROG);
  let three = false;
  for (let i = 0; i + 2 < REELS && !three; i++) three = line[i] === FROG && line[i + 1] === FROG && line[i + 2] === FROG;

  // Five outranks three: one payout per spin, never both.
  if (five) {
    apiRef.payout(PAY_FIVE);
    status?.setText(`FIVE FROGGYS  -  ${PAY_FIVE} TOKENS`);
    audio.sfx('chime');
  } else if (three) {
    apiRef.payout(PAY_THREE);
    status?.setText(`THREE IN A ROW  -  ${PAY_THREE} TOKENS`);
    audio.sfx('chime');
  } else {
    status?.setText('NO REWARD');
    audio.sfx('buzzer', 0.6);
  }
  refresh();
  busy = false;
}

function leave(): void {
  if (over || busy) return;
  over = true;
  spinBtn?.setVisible(false);
  leaveBtn?.setVisible(false);
  apiRef?.cashOut();
}
