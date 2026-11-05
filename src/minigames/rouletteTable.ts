/**
 * ROULETTE.  The table at the top left of the casino (user, 5 Nov).
 *
 * A single-zero wheel and a betting layout, played as any casino plays it:
 * put chips on the felt -- a number, a dozen, red or black, odd or even,
 * low or high -- and spin.  The rules and the payouts live in game/roulette;
 * this is the table.
 *
 * THE MONEY.  Sitting down is free, like Froggy's table.  The bets on the
 * felt are nobody's until SPIN, when the whole of them is raised through the
 * shell in one go (MinigameApi.raise) -- so a chip placed and cleared again
 * costs nothing.  The pocket is drawn the moment SPIN is pressed and anything
 * it pays is paid then too (MinigameApi.payout), before the wheel has even
 * turned: a reload mid-spin cannot re-roll it, cannot lose a win, and never
 * hands a stake back.  The wheel then only shows what already happened.
 * The bets stay on the felt after a spin, so SPIN again is the same bets
 * again -- paid again.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, smallText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import { DOZENS, OUTSIDE, RED_NUMBERS, WHEEL_ORDER, colourOf, settle, spinPocket, spotLabel, type BetSpot } from '../game/roulette';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'roulettetable' as const;
const MINIMUM = 1;
const CHIPS = [1, 5, 10, 25] as const;
/** The most that may ride on one spin, all bets together. */
const TABLE_MAX = 500;

const FELT = 0x1d5c2d;
const FELT_DARK = 0x123b1e;
const RAIL = 0x6b4a2a;
const BRASS = 0xb08a3c;
const RED = 0xb3202c;
const BLACK = 0x15121a;
const ZERO = 0x2f8d4f;
const CHALK = 0xd8e8c8;

// the wheel, on the left of the felt -- big enough (user, 5 Nov) that every
// pocket can carry its own number inside it
const WX = 63;
const WY = 78;
const WR = 53;
/** The band the pockets' colours fill, and the radius their numbers sit at. */
const BAND = 12;
const NUM_R = WR - BAND / 2;
// the layout, on the right
const BX = 136;
const BY = 34;
const CW = 14;
const CH = 11;

interface SpotBox {
  s: BetSpot;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: number;
}

let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;
let bets = new Map<BetSpot, number>();
let chip = 0;
let cursor = 0;
let spinning = false;
let spins = 0;
let history: number[] = [];
let boxes: SpotBox[] = [];
let wheel: Phaser.GameObjects.Graphics | null = null;
let chipLayer: Phaser.GameObjects.Container | null = null;
let cursorBox: Phaser.GameObjects.Rectangle | null = null;
let status: Phaser.GameObjects.BitmapText | null = null;
let totals: Phaser.GameObjects.BitmapText | null = null;
let chipBtns: Phaser.GameObjects.Container[] = [];
let histLayer: Phaser.GameObjects.Container | null = null;
let resultText: Phaser.GameObjects.BitmapText | null = null;
let ball: Phaser.GameObjects.Arc | null = null;
let shownBalance = 0;
/** DEV: the next pocket, forced. */
let forced: number | null = null;

const total = (): number => [...bets.values()].reduce((a, b) => a + b, 0);
const STEP = (Math.PI * 2) / WHEEL_ORDER.length;

function layoutBoxes(): SpotBox[] {
  const out: SpotBox[] = [{ s: 0, x: BX - 14, y: BY, w: 14, h: CH * 3, fill: ZERO }];
  for (let c = 0; c < 12; c++) {
    for (let r = 0; r < 3; r++) {
      const n = c * 3 + (3 - r);
      out.push({ s: n, x: BX + c * CW, y: BY + r * CH, w: CW, h: CH, fill: RED_NUMBERS.has(n) ? RED : BLACK });
    }
  }
  DOZENS.forEach((s, i) => out.push({ s, x: BX + i * CW * 4, y: BY + CH * 3, w: CW * 4, h: CH, fill: FELT }));
  OUTSIDE.forEach((s, i) => out.push({ s, x: BX + i * CW * 2, y: BY + CH * 4, w: CW * 2, h: CH, fill: s === 'red' ? RED : s === 'black' ? BLACK : FELT }));
  return out;
}

function setStatus(msg: string, col: number = PALETTE.cream): void {
  status?.setText(msg).setTint(col);
}

function render(): void {
  const sc = sceneRef;
  if (!sc) return;
  chipLayer?.destroy();
  chipLayer = sc.add.container(0, 0).setDepth(6);
  for (const b of boxes) {
    const amt = bets.get(b.s);
    if (!amt) continue;
    // in the spot's top-right corner, so the felt's own label still reads
    const lbl = amt > 999 ? '1K+' : `${amt}`;
    const w = Math.max(7, lbl.length * 4 + 3);
    const cx = b.x + b.w - w / 2 - 0.5;
    const cy = b.y + 0.5;
    chipLayer.add(sc.add.rectangle(cx, cy, w, 7, PALETTE.gold).setStrokeStyle(1, PALETTE.ink));
    const t = smallText(sc, cx, cy - 2, lbl, PALETTE.ink);
    t.setOrigin(0.5, 0);
    chipLayer.add(t);
  }
  const cb = boxes[cursor];
  cursorBox?.setPosition(cb.x, cb.y).setSize(cb.w, cb.h);
  cursorBox?.setDisplaySize(cb.w, cb.h);
  totals?.setText(`BET ${total()}   TOKENS ${shownBalance}`);
  chipBtns.forEach((b, i) => {
    const box = b.list[0] as Phaser.GameObjects.Rectangle;
    box.setStrokeStyle(1, i === chip ? PALETTE.gold : PALETTE.neon);
    box.setFillStyle(i === chip ? 0x5e4a1a : PALETTE.plum);
  });
  histLayer?.destroy();
  histLayer = sc.add.container(0, 0).setDepth(6);
  history.slice(-10).forEach((n, i) => {
    const x = BX - 14 + i * 13;
    const c = colourOf(n);
    histLayer!.add(sc.add.rectangle(x, 22, 12, 8, c === 'red' ? RED : c === 'black' ? BLACK : ZERO).setOrigin(0, 0).setStrokeStyle(1, i === Math.min(history.length, 10) - 1 ? PALETTE.gold : RAIL));
    histLayer!.add(smallText(sc, x + 6, 24, `${n}`, PALETTE.cream).setOrigin(0.5, 0));
  });
}

function place(i: number): void {
  if (spinning || !apiRef) return;
  cursor = i;
  const add = CHIPS[chip];
  const now = total();
  if (now + add > TABLE_MAX) {
    audio.sfx('buzzer');
    setStatus(`THE TABLE LIMIT IS ${TABLE_MAX} A SPIN`, PALETTE.blood);
    render();
    return;
  }
  if (now + add > apiRef.balance()) {
    audio.sfx('buzzer');
    setStatus('YOU CANNOT COVER THAT', PALETTE.blood);
    render();
    return;
  }
  const s = boxes[i].s;
  bets.set(s, (bets.get(s) ?? 0) + add);
  audio.sfx('coin_drop', 0.4);
  setStatus(`${add} ON ${spotLabel(s)}`);
  render();
}

function clearBets(): void {
  if (spinning) return;
  bets.clear();
  audio.sfx('ui_hover');
  setStatus('PLACE YOUR CHIPS');
  render();
}

function cycleChip(): void {
  chip = (chip + 1) % CHIPS.length;
  audio.sfx('ui_hover');
  render();
}

/** Arrow keys walk the cursor to the nearest spot that way. */
function moveCursor(dx: number, dy: number): void {
  if (spinning) return;
  const a = boxes[cursor];
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  let best = -1;
  let bestS = Infinity;
  boxes.forEach((b, i) => {
    if (i === cursor) return;
    const vx = b.x + b.w / 2 - ax;
    const vy = b.y + b.h / 2 - ay;
    const along = vx * dx + vy * dy;
    if (along <= 0.5) return;
    const across = Math.abs(vx * dy - vy * dx);
    const sc = along + across * 2.5;
    if (sc < bestS) {
      bestS = sc;
      best = i;
    }
  });
  if (best >= 0) {
    cursor = best;
    audio.sfx('ui_hover', 0.3);
    render();
  }
}

function spin(): void {
  if (spinning || !apiRef || !sceneRef || !wheel) return;
  const stake = total();
  if (stake < MINIMUM) {
    audio.sfx('buzzer');
    setStatus('PUT A CHIP ON THE FELT FIRST', PALETTE.blood);
    return;
  }
  if (!apiRef.raise(stake)) {
    audio.sfx('buzzer');
    setStatus('YOU CANNOT COVER THAT', PALETTE.blood);
    return;
  }
  // drawn, and paid, before the wheel moves
  const n = import.meta.env?.DEV && forced !== null ? forced : spinPocket();
  forced = null;
  const pay = settle(bets, n);
  if (pay > 0) apiRef.payout(pay);
  spins++;
  spinning = true;
  shownBalance -= stake;
  resultText?.setText('');
  setStatus('NO MORE BETS');
  render();
  audio.sfx('coin_spin', 0.7);
  // round to the pocket, with the pointer at the top
  const i = WHEEL_ORDER.indexOf(n);
  const cur = wheel.rotation;
  const want = -i * STEP;
  let delta = (((want - cur) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  delta += Math.PI * 2 * 4;
  sceneRef.tweens.add({
    targets: wheel,
    rotation: cur + delta,
    duration: 3200,
    ease: 'Cubic.easeOut',
    onUpdate: () => {
      const t = wheel!.rotation;
      ball?.setPosition(WX + Math.cos(-t * 1.3 - Math.PI / 2) * (WR - BAND - 3), WY + Math.sin(-t * 1.3 - Math.PI / 2) * (WR - BAND - 3));
    },
    onComplete: () => {
      spinning = false;
      ball?.setPosition(WX, WY - WR + BAND + 3);
      history.push(n);
      shownBalance += pay;
      const c = colourOf(n);
      resultText?.setText(`${n}`).setTint(c === 'red' ? 0xff6a6a : c === 'black' ? PALETTE.cream : 0x6aff8a);
      const net = pay - stake;
      if (pay > 0) {
        audio.sfx('bell_ding', 0.7);
        setStatus(`${n} ${c.toUpperCase()} - PAYS ${pay}${net > 0 ? ` (+${net})` : ''}`, PALETTE.gold);
      } else {
        audio.sfx('buzzer', 0.5);
        setStatus(`${n} ${c.toUpperCase()} - NOTHING ON IT`, PALETTE.ash);
      }
      render();
    },
  });
}

function leave(): void {
  if (spinning || !apiRef) return;
  apiRef.cashOut();
}

let nums: Phaser.GameObjects.BitmapText[] = [];
function placeNumbers(): void {
  if (!wheel) return;
  const r = wheel.rotation;
  nums.forEach((t, i) => {
    const a = -Math.PI / 2 + i * STEP + r;
    t.setPosition(Math.round(WX + Math.cos(a) * NUM_R), Math.round(WY + Math.sin(a) * NUM_R));
  });
}

function paintTable(scene: Phaser.Scene): void {
  scene.add.rectangle(0, 18, GAME_W, 162, 0x2a0e16).setOrigin(0, 0);
  // the walnut rail round the baize, as on Froggy's table
  scene.add.rectangle(4, 18, GAME_W - 8, 120, RAIL).setOrigin(0, 0).setStrokeStyle(1, 0x3a2616);
  scene.add.rectangle(8, 21, GAME_W - 16, 114, FELT).setOrigin(0, 0);
  // the wheel's bowl
  scene.add.circle(WX, WY, WR + 4, 0x3a2616);
  scene.add.circle(WX, WY, WR + 3, BRASS);
  scene.add.circle(WX, WY, WR + 1, 0x2a1a10);
  wheel = scene.add.graphics().setPosition(WX, WY).setDepth(4);
  WHEEL_ORDER.forEach((n, i) => {
    const a0 = -Math.PI / 2 + (i - 0.5) * STEP;
    wheel!.fillStyle(n === 0 ? ZERO : RED_NUMBERS.has(n) ? RED : BLACK, 1);
    wheel!.slice(0, 0, WR, a0, a0 + STEP, false).fillPath();
    wheel!.lineStyle(1, BRASS, 0.8).lineBetween(Math.cos(a0) * (WR - BAND), Math.sin(a0) * (WR - BAND), Math.cos(a0) * WR, Math.sin(a0) * WR);
  });
  wheel.fillStyle(0x7a5232, 1).fillCircle(0, 0, WR - BAND);
  wheel.lineStyle(1, BRASS, 0.9).strokeCircle(0, 0, WR - BAND);
  wheel.fillStyle(0x5e3c22, 1).fillCircle(0, 0, WR - BAND - 6);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    wheel.lineStyle(2, BRASS, 1).lineBetween(Math.cos(a) * 12, Math.sin(a) * 12, Math.cos(a) * (WR - BAND - 4), Math.sin(a) * (WR - BAND - 4));
  }
  wheel.fillStyle(0x3a2616, 1).fillCircle(0, 0, 11);
  wheel.lineStyle(1, BRASS, 1).strokeCircle(0, 0, 11);
  // ---- THE NUMBERS, each in its own pocket.  Upright (turned pixel type
  // cannot be read), set on the middle of the pocket's band, and moved round
  // with the wheel every frame.
  nums = WHEEL_ORDER.map((n) => smallText(scene, 0, 0, `${n}`, PALETTE.cream).setOrigin(0.5, 0.5).setDepth(5));
  placeNumbers();
  scene.events.on(Phaser.Scenes.Events.UPDATE, placeNumbers);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, placeNumbers));
  // the pointer over the top, and the ball
  scene.add.triangle(WX, WY - WR - 5, 0, 0, 6, 0, 3, 6, PALETTE.cream).setOrigin(0.5, 0).setDepth(7);
  ball = scene.add.circle(WX, WY - WR + BAND + 3, 2, 0xffffff).setDepth(8).setStrokeStyle(1, 0x9a9aa8);
  // the number that came up, in the hub
  resultText = centerText(scene, WX, WY - 4, '', PALETTE.cream, 8).setDepth(8);

  // the layout
  const g = scene.add.graphics().setDepth(5);
  for (const b of boxes) {
    g.fillStyle(b.fill, 1).fillRect(b.x, b.y, b.w, b.h);
    g.lineStyle(1, CHALK, 0.7).strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    const lbl = spotLabel(b.s);
    smallText(scene, b.x + b.w / 2, b.y + 3, lbl, typeof b.s === 'number' || b.s === 'red' || b.s === 'black' ? PALETTE.cream : CHALK)
      .setOrigin(0.5, 0)
      .setDepth(5);
  }
  g.fillStyle(FELT_DARK, 0.6).fillRect(BX - 14, BY + CH * 5 + 2, 14 + CW * 12, 1);
  cursorBox = scene.add.rectangle(0, 0, CW, CH).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold).setFillStyle(0xffffff, 0.12).setDepth(7);
  smallText(scene, BX - 14, BY - 5, 'LAST SPINS', CHALK).setDepth(5).setOrigin(0, 1).setVisible(false);
}

export const rouletteTable: MinigameModule = {
  id: ID,
  title: 'ROULETTE',
  music: 'casino_chiptune',
  rules: 'One zero. Chips on the felt, then spin.',
  payoutNote: 'NUMBER 36X - DOZEN 3X - OUTSIDE 2X',
  tutorial: {
    pitch: 'PUT YOUR CHIPS DOWN AND SPIN.',
    steps: [
      { say: 'CLICK A SPOT ON THE FELT TO PUT A CHIP ON IT. F CHANGES THE CHIP.', phone: 'TAP A SPOT ON THE FELT TO PUT A CHIP ON IT. CHIP CHANGES THE CHIP.', demo: 'rt.chips' },
      { say: 'ENTER SPINS: EVERY BET ON THE FELT IS PAID FOR AT ONCE.', phone: 'SPIN SPINS: EVERY BET ON THE FELT IS PAID FOR AT ONCE.', demo: 'rt.spin' },
      { say: 'A NUMBER PAYS 36X, A DOZEN 3X, THE REST 2X. ON THE ZERO THEY ALL LOSE.', demo: 'rt.pays' },
    ],
    objective: [
      'CHIPS ON THE FELT, THEN SPIN.',
      'A NUMBER PAYS 35 TO 1, A DOZEN 2 TO 1.',
      'RED/BLACK, ODD/EVEN, 1-18/19-36: 1 TO 1.',
      'ON THE ZERO EVERY OUTSIDE BET LOSES.',
    ],
    controls: [
      ['ARROWS', 'PICK A SPOT'],
      ['SPACE', 'PUT A CHIP DOWN'],
      ['F', 'CHANGE CHIP'],
      ['ENTER', 'SPIN'],
      ['X / C', 'CLEAR / CASH OUT'],
    ],
  },
  touch: {
    stick: 'wasd',
    arrows: true,
    buttons: [
      { label: 'SPIN', key: 'ENTER', primary: true },
      { label: 'CHIP\nDOWN', key: 'SPACE' },
      { label: 'CHIP', key: 'F' },
      { label: 'CLEAR', key: 'X' },
      { label: 'CASH\nOUT', key: 'C' },
    ],
  },
  inPlay: () => spins > 0 || spinning,
  // every spin is paid the moment it is spun, so walking out risks nothing
  atRisk: () => 0,
  reportsSitting: true,
  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    sceneRef = scene;
    bets = new Map();
    chip = 0;
    spinning = false;
    spins = 0;
    history = [];
    forced = null;
    boxes = layoutBoxes();
    cursor = boxes.findIndex((b) => b.s === 'red');
    shownBalance = api.balance();
    chipLayer = null;
    histLayer = null;
    paintTable(scene);

    // the chips, the totals, the narration, the three buttons
    text(scene, BX - 14, 104, 'CHIP', CHALK).setDepth(5);
    chipBtns = CHIPS.map((v, i) => button(scene, BX + 24 + i * 24, 108, `${v}`, () => ((chip = i), audio.sfx('ui_hover'), render()), { width: 22, height: 13 }).setDepth(6));
    totals = text(scene, BX - 14, 119, '', PALETTE.gold).setDepth(5);
    status = text(scene, GAME_W / 2, 141, 'PLACE YOUR CHIPS', PALETTE.cream).setOrigin(0.5, 0).setDepth(5);
    button(scene, 62, 162, 'CLEAR', () => clearBets(), { width: 70, height: 15, fill: PALETTE.tealDark }).setDepth(6);
    button(scene, GAME_W / 2, 162, 'SPIN', () => spin(), { width: 70, height: 15 }).setDepth(6);
    button(scene, GAME_W - 62, 162, 'CASH OUT', () => leave(), { width: 70, height: 15 }).setDepth(6);

    // a click on the felt puts the chip there
    boxes.forEach((b, i) => {
      scene.add
        .zone(b.x, b.y, b.w, b.h)
        .setOrigin(0, 0)
        .setDepth(9)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => place(i));
    });

    const kb = scene.input.keyboard;
    kb?.on('keydown-LEFT', () => moveCursor(-1, 0));
    kb?.on('keydown-RIGHT', () => moveCursor(1, 0));
    kb?.on('keydown-UP', () => moveCursor(0, -1));
    kb?.on('keydown-DOWN', () => moveCursor(0, 1));
    kb?.on('keydown-A', () => moveCursor(-1, 0));
    kb?.on('keydown-D', () => moveCursor(1, 0));
    kb?.on('keydown-W', () => moveCursor(0, -1));
    kb?.on('keydown-S', () => moveCursor(0, 1));
    kb?.on('keydown-SPACE', () => place(cursor));
    kb?.on('keydown-ENTER', () => spin());
    kb?.on('keydown-F', () => cycleChip());
    kb?.on('keydown-X', () => clearBets());
    kb?.on('keydown-C', () => leave());

    render();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__roulette = {
        state: () => ({ bets: [...bets.entries()], chip: CHIPS[chip], cursor: boxes[cursor].s, spinning, spins, history: [...history], total: total() }),
        place: (s: BetSpot) => place(boxes.findIndex((b) => b.s === s)),
        force: (n: number) => (forced = n),
        spin,
        clear: clearBets,
      };
    }
  },
  destroy() {
    apiRef = null;
    sceneRef = null;
    wheel = null;
    ball = null;
    chipLayer = null;
    histLayer = null;
    cursorBox = null;
    status = null;
    totals = null;
    resultText = null;
    chipBtns = [];
  },
};
