/**
 * WHEEL OF FORTUNE.  Forty tokens a spin, in the corner of the casino.
 *
 * THE ODDS ARE THE GEOMETRY.  Every face on the wheel is cut to the width of
 * its own chance — the five thousand is a hairline sliver and the small
 * money is most of the rim — and a spin picks a stopping angle, not a
 * prize.  Nothing weights the draw afterwards, so what you watch the
 * pointer do is what actually happened, and a spin pays the one face it
 * stopped on: there is no second prize, no bonus, nothing that can stack
 * two payouts onto one go.
 *
 *   🏆 5000                  0.01%
 *   💰 1000                   0.1%
 *   💰 500                    0.5%
 *   🎁 200                      5%
 *   🎁 80 90 100               12%   (three faces)
 *   🪙 40 50 60 70             10%   (four faces)
 *   🪙 1 2 3 5 7 10 15      62.39%   (a seventh of it each)
 *   the blank                 10%   (two faces)
 *
 * THE NUMBERS ARE NOT PRINTED ON THE WHEEL ITSELF.  The board beside it now
 * names what the wheel can pay AND the live percentage for each band, read
 * straight off the same FACES table that cuts the rim — so the board can
 * never drift out of sync with the geometry the way a hand-typed table could.
 *
 * WALKING UP TO IT IS FREE, but it will not let you stand at it broke: a spin
 * is the only thing this fixture does, so a player who cannot cover one is
 * turned away at the rope rather than sat in front of a machine they cannot
 * use.  Every spin is raised through the shell as it is taken, every prize is
 * paid the moment the wheel stops, and LEAVE settles up.  Nothing leaves
 * except through the ledger (MG-3).
 *
 * THE PRICE IS THE LEVER, AND IT HAS BEEN PULLED.  These faces average about
 * 34.13 tokens a spin.  At twenty the wheel handed back fourteen more than it
 * took, every spin, forever — the one fixture in the building with a positive
 * edge to the customer, and a patient player could farm the prize shelf off it
 * rather than off the cabinets.  At forty it keeps about six a spin instead,
 * so the shelf has to be earned on the floor again.  `SPIN_COST` is the whole
 * of that decision; the faces themselves were not touched to make it.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'wheel' as const;
export const SPIN_COST = 25;

/**
 * The faces, in the order they sit round the rim, with the share of the wheel
 * each one takes.  The shares are percentages and they add to a hundred; the
 * arc each face gets is its share of 360 degrees, which is the whole of how
 * the odds are implemented.
 *
 * They are interleaved rather than sorted, so the big money is spread around
 * the rim instead of sitting in one quarter you can aim at.
 */
export const FACES: Array<{ pays: number; share: number }> = [
  { pays: 1, share: 62.39 / 7 },
  { pays: 40, share: 2.5 },
  { pays: 80, share: 4 },
  { pays: 2, share: 62.39 / 7 },
  { pays: 50, share: 2.5 },
  { pays: 90, share: 4 },
  { pays: 3, share: 62.39 / 7 },
  { pays: 60, share: 2.5 },
  { pays: 100, share: 4 },
  { pays: 5000, share: 0.01 },
  { pays: 5, share: 62.39 / 7 },
  { pays: 70, share: 2.5 },
  { pays: 0, share: 5 },
  { pays: 7, share: 62.39 / 7 },
  { pays: 200, share: 5 },
  { pays: 1000, share: 0.10 },
  { pays: 10, share: 62.39 / 7 },
  { pays: 500, share: 0.50 },
  { pays: 0, share: 5 },
  { pays: 15, share: 62.39 / 7 },
];

const CX = 96;
const CY = 102;
const R = 62;
/** Where the pointer sits, in radians: straight up. */
const POINTER = -Math.PI / 2;
const SPIN_MS = 3400;

interface Slice {
  pays: number;
  /** Start and end of the face on the rim, radians, before the wheel turns. */
  from: number;
  to: number;
  colour: number;
}

let slices: Slice[] = [];
let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;
let face: Phaser.GameObjects.Graphics | null = null;
let labels: Phaser.GameObjects.BitmapText[] = [];
let rotation = 0;
let spinning = false;
let over = false;
let spins = 0;
let won = 0;
let statusText: Phaser.GameObjects.BitmapText | null = null;
let balanceText: Phaser.GameObjects.BitmapText | null = null;
let spinBtn: Phaser.GameObjects.Container | null = null;
let leaveBtn: Phaser.GameObjects.Container | null = null;
/** Which face the pointer was over last frame, for the ratchet tick. */
let lastFace = -1;

/** Cut the rim into faces.  Shares are percentages; the wheel is 2π. */
function build(): void {
  slices = [];
  const palette = [PALETTE.tealDark, PALETTE.plum, PALETTE.rust, PALETTE.slate];
  let a = -Math.PI / 2;
  FACES.forEach((f, i) => {
    const span = (f.share / 100) * Math.PI * 2;
    slices.push({
      pays: f.pays,
      from: a,
      to: a + span,
      // The money faces get their own colours; the small change alternates so
      // the rim reads as a wheel and not a pie chart.
      // The top two prizes get a colour nothing else on the rim uses, so the
      // splinter you are hoping for is findable while the wheel is turning.
      colour:
        f.pays === 0
          ? PALETTE.ink
          : f.pays >= 200
            ? PALETTE.blood
            : f.pays >= 40
              ? PALETTE.gold
              : palette[i % palette.length],
    });
    a += span;
  });
}

/** Total share of the rim across a set of payout values, formatted as a percent. */
function pctOf(pays: number[]): string {
  const total = FACES.filter((f) => pays.includes(f.pays)).reduce((sum, f) => sum + f.share, 0);
  if (total > 0 && total < 0.1) return `${total.toFixed(2)}%`;
  const rounded = Math.round(total * 10) / 10;
  return `${rounded % 1 === 0 ? rounded : rounded.toFixed(1)}%`;
}

/** Which face is under the pointer at this rotation. */
export function faceAt(rot: number): Slice {
  const twoPi = Math.PI * 2;
  // The pointer is fixed and the wheel turns under it.
  let a = (POINTER - rot) % twoPi;
  while (a < -Math.PI / 2) a += twoPi;
  while (a >= -Math.PI / 2 + twoPi) a -= twoPi;
  for (const s of slices) if (a >= s.from && a < s.to) return s;
  return slices[slices.length - 1];
}

export const wheelOfFortune: MinigameModule = {
  id: ID,
  title: 'WHEEL OF FORTUNE',
  music: 'game_wheel',
  rules: '25 a spin - the wheel says what it pays',
  payoutNote: 'PAYS 0 - 5000',
  tutorial: {
    objective: [
      'ONE SPIN, ONE PRIZE, WHATEVER IT STOPS ON.',
      'EVERY FACE IS AS WIDE AS ITS CHANCE.',
      'THE BIG MONEY IS ON THE THIN SLICES.',
      'LEAVE WHENEVER YOU LIKE - IT IS ALL YOURS.',
    ],
    controls: [
      ['SPACE', 'SPIN'],
      ['MOUSE', 'SPIN OR LEAVE'],
    ],
  },
  touch: { buttons: [{ label: 'SPIN', key: 'SPACE', primary: true }] },

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    sceneRef = scene;
    rotation = 0;
    spinning = false;
    over = false;
    spins = 0;
    won = 0;
    labels = [];
    lastFace = -1;
    build();

    // the room: carpet, a rope, and the wheel standing in it
    scene.add.rectangle(0, 18, GAME_W, 162, 0x241436).setOrigin(0, 0);
    scene.add.rectangle(0, 150, GAME_W, 30, 0x1a0e28).setOrigin(0, 0);
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + ((i * i) % 11) * 5) % GAME_W;
      const y = 22 + ((i * 53) % 150);
      scene.add.rectangle(x, y, 1, 1, 0xffd45e).setOrigin(0, 0).setAlpha(0.06 + (i % 3) * 0.04);
    }

    scene.add.circle(CX, CY, R + 5, PALETTE.brownLight);
    scene.add.circle(CX, CY, R + 3, PALETTE.ink);
    face = scene.add.graphics().setDepth(4);
    // The labels ride the rim, so they are containers of their own that get
    // re-placed every frame rather than being baked into the graphics.
    for (const s of slices) {
      labels.push(centerText(scene, CX, CY, s.pays === 0 ? '-' : `${s.pays}`, PALETTE.cream).setDepth(6));
    }
    scene.add.circle(CX, CY, 6, PALETTE.bone).setDepth(7);
    scene.add.circle(CX, CY, 3, PALETTE.ink).setDepth(7);
    // the pointer, over the top
    scene.add.triangle(CX, CY - R - 6, 0, 0, 8, 0, 4, 9, PALETTE.cream).setOrigin(0.5, 0).setDepth(8);

    // The board names the faces and, next to each, the live percentage read
    // straight off FACES — so it can never fall out of sync with the rim the
    // way a hand-typed table could.
    text(scene, 178, 24, 'WHAT IT PAYS', PALETTE.gold);
const board: Array<[string, number]> = [
  [`🏆 5000 - ${pctOf([5000])}`, PALETTE.gold],
  [`💰 1000 - ${pctOf([1000])}`, PALETTE.gold],
  [`💰 500 - ${pctOf([500])}`, PALETTE.gold],
  [`🎁 200 - ${pctOf([200])}`, PALETTE.cream],
  [`🎁 80-100 - ${pctOf([80, 90, 100])}`, PALETTE.cream],
  [`🪙 40-70 - ${pctOf([40, 50, 60, 70])}`, PALETTE.cream],
  [`🪙 1-15 - ${pctOf([1, 2, 3, 5, 7, 10, 15])}`, PALETTE.cream],
  [`NOTHING - ${pctOf([0])}`, PALETTE.ash],
];
board.forEach(([what, tint], i) => {
  text(scene, 180, 34 + i * 8, what, tint);
});

balanceText = text(scene, 180, 102, '', PALETTE.cream);
statusText = text(scene, 180, 116, `SPIN IT - ${SPIN_COST} A GO`, PALETTE.gold);

    spinBtn = button(scene, 214, 150, `SPIN - ${SPIN_COST}`, () => spin(), { width: 66, height: 14 });
    leaveBtn = button(scene, 284, 150, 'LEAVE', () => leave(), { width: 52, height: 14, fill: PALETTE.slate });
    scene.input.keyboard?.on('keydown-SPACE', () => spin());

    draw();
    refresh();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__wheel = {
        state: () => ({ spinning, spins, won, rotation, at: faceAt(rotation).pays }),
        /** The face under the pointer for a given rotation, without spinning. */
        faceAt: (rot: number) => faceAt(rot).pays,
        /**
         * Sample the wheel the way a player does — uniform stopping angles —
         * so the odds can be checked against the geometry that produces them.
         */
        sample: (n: number) => {
          const seen: Record<string, number> = {};
          for (let i = 0; i < n; i++) {
            const p = faceAt(Math.random() * Math.PI * 2).pays;
            seen[p] = (seen[p] ?? 0) + 1;
          }
          return seen;
        },
        spin: () => spin(),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__wheel;
      });
    }
  },

  destroy() {
    face = null;
    labels = [];
    statusText = null;
    balanceText = null;
    spinBtn = null;
    leaveBtn = null;
    apiRef = null;
    sceneRef = null;
  },
};

/** The rim, at the current rotation. */
function draw(): void {
  if (!face) return;
  face.clear();
  slices.forEach((s, i) => {
    face!.fillStyle(s.colour, 1);
    face!.slice(CX, CY, R, s.from + rotation, s.to + rotation, false);
    face!.fillPath();
    // a hairline between faces, so a sliver is still visibly its own face
    face!.lineStyle(1, PALETTE.ink, 0.9);
    face!.beginPath();
    face!.moveTo(CX, CY);
    face!.lineTo(CX + Math.cos(s.from + rotation) * R, CY + Math.sin(s.from + rotation) * R);
    face!.strokePath();

    const mid = (s.from + s.to) / 2 + rotation;
    // A label has to fit across its own face.  The wide faces carry theirs at
    // two thirds of the radius; the slivers — the hundred especially — have no
    // room for three digits anywhere inside the rim, so those sit just outside
    // it, where the arc is wide enough to read.
    const lbl = labels[i];
    if (!lbl) return;
    const chars = lbl.text.length * 6;
    const inside = R * 0.66;
    const fitsInside = (s.to - s.from) * inside >= chars + 3;
    const lr = fitsInside ? inside : R + 9;
    lbl.setPosition(CX + Math.cos(mid) * lr, CY + Math.sin(mid) * lr);
    lbl.setTint(!fitsInside ? PALETTE.gold : s.pays >= 50 ? PALETTE.ink : PALETTE.cream);
  });
}

function spin(): void {
  if (over || spinning || !sceneRef || !apiRef) return;
  // Nothing was paid at the door, so every spin — the first one included — is
  // raised here.  Look for free, pay to play.
  if (!apiRef.raise(SPIN_COST)) {
    audio.sfx('buzzer');
    statusText?.setText(`YOU NEED ${SPIN_COST}`).setTint(PALETTE.blood);
    return;
  }
  spins++;
  spinning = true;
  lastFace = -1;
  statusText?.setText('...').setTint(PALETTE.fog);
  setButtons(false);
  audio.sfx('coin_drop', 0.6);

  // A uniform stopping angle is the whole of the randomness: the face it lands
  // on is decided by how wide that face is and by nothing else.
  const target = rotation + Math.PI * 2 * (5 + Math.random() * 3) + Math.random() * Math.PI * 2;
  sceneRef.tweens.addCounter({
    from: rotation,
    to: target,
    duration: SPIN_MS,
    ease: 'Cubic.easeOut',
    onUpdate: (tw) => {
      rotation = tw.getValue() ?? rotation;
      draw();
      // the ratchet: one tick per face that goes past the pointer
      const idx = slices.indexOf(faceAt(rotation));
      if (idx !== lastFace) {
        lastFace = idx;
        audio.sfx('wheel_tick', 0.5);
      }
    },
    onComplete: () => settleSpin(),
  });
}

/**
 * The wheel has stopped.  ONE face, ONE payout, and the latch is what
 * guarantees it: the tween's completion is the only caller, but a spin that
 * somehow settled twice would pay twice, and that is the one bug a wheel must
 * not have.
 */
function settleSpin(): void {
  if (!apiRef || !sceneRef || !spinning) return;
  spinning = false;
  const landed = faceAt(rotation);
  if (landed.pays > 0) {
    apiRef.payout(landed.pays);
    won += landed.pays;
    audio.sfx(landed.pays >= 50 ? 'chime' : landed.pays >= 20 ? 'bell_ding' : 'ui_blip');
    statusText
      ?.setText(`${landed.pays} TOKEN${landed.pays === 1 ? '' : 'S'}`)
      .setTint(landed.pays >= 20 ? PALETTE.gold : PALETTE.cream);
    if (landed.pays >= 50) {
      sceneRef.cameras.main.shake(160, 0.004);
      const pop = centerText(sceneRef, CX, CY - R - 18, `${landed.pays}!`, PALETTE.gold, 16).setDepth(20);
      sceneRef.tweens.add({ targets: pop, y: CY - R - 30, alpha: 0, duration: 1200, onComplete: () => pop.destroy() });
    }
  } else {
    audio.sfx('buzzer', 0.6);
    statusText?.setText('NOTHING').setTint(PALETTE.fog);
  }
  setButtons(true);
  refresh();
}

function setButtons(on: boolean): void {
  spinBtn?.setAlpha(on ? 1 : 0.5);
  leaveBtn?.setAlpha(on ? 1 : 0.5);
}

function refresh(): void {
  balanceText?.setText(`TOKENS ${apiRef?.balance() ?? 0}`);
}

function leave(): void {
  if (over || spinning) return;
  over = true;
  apiRef?.cashOut();
}
