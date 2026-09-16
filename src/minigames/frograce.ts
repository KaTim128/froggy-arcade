/**
 * FROG RACE.  Hard (long) — 7 tokens in, 15 out.  Casino floor.
 *
 * Seven frogs, seven lanes, one of them is yours.  Pick before the gun.
 *
 * NOTHING ON THE CARD TELLS YOU WHICH.  The rim of this machine used to carry
 * a FORM rating beside every lane, and it was real — but a rating you can read
 * is a rating you can follow, and a race you win by following the top line is
 * a menu, not a race.  The plates now carry the lane number and nothing else.
 * Which frog to back is a guess, and it is meant to be one.
 *
 * THE FORM IS STILL THERE, AND IT IS STILL SHUFFLED EVERY RACE.  It is what
 * gives a field a favourite and a tail-ender rather than seven identical
 * sprites, so the running of the race has shape — somebody leads, somebody
 * comes through late.  It is dealt onto the colours at random before every
 * card, so it is never "the green one is fast", and it is never shown.  From
 * the seat, every lane is one in seven.
 *
 * THE RACES ARE CLOSE ON PURPOSE, AND THE NOISE HAS TO LAST.  Per-tick wobble
 * on its own does nothing over a race — a hundred fair coins average out, and
 * a field separated only by white noise is decided by whoever had the best
 * form before the gun.  That is what the first version of this did: the best
 * frog won 93 races in 100.  So the variance is in three parts, and only the
 * first of them is per-tick:
 *
 *   WOBBLE — per tick, and cosmetic: it is what makes the pack jostle.
 *   DRIFT  — a slow random walk, pulled back towards nothing, so a frog has
 *            good and bad PATCHES a few seconds long that you can watch.
 *   LUCK   — drawn ONCE per frog per race and held for the whole of it: the
 *            day it is having.  It is the same size as the whole form spread,
 *            which is what stops the best card simply winning.
 *
 * Every frog also gets a SURGE somewhere in the middle, which is what stops a
 * leader holding a lead from the gun.  The best frog in the field comes home
 * about a third of the time — which nobody can see, and which is why the race
 * is worth watching rather than worth reading.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { centerText } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'frograce' as const;

/** The field.  Seven colours, seven names, and they never change. */
const RUNNERS: Array<{ name: string; colour: number }> = [
  { name: 'GREEN', colour: 0x5fbf5a },
  { name: 'GOLD', colour: 0xffd45e },
  { name: 'RED', colour: 0xd8443c },
  { name: 'BLUE', colour: 0x46a0e0 },
  { name: 'PINK', colour: 0xff6fb0 },
  { name: 'TEAL', colour: 0x46c4bd },
  { name: 'VIOLET', colour: 0xa86ad8 },
];

const LANE_T = 44;
const LANE_H = 15;
const START_X = 42;
const FINISH_X = GAME_W - 30;
/** One square of the chequered tape, in pixels. */
const TAPE_SQ = 5;
const DIST = FINISH_X - START_X;

/**
 * How fast a frog goes, in lengths per second.
 *
 * `BASE` is the pace of the whole field and `SPREAD` is what the form is worth
 * on top of it.  The three noise terms are described at the top of the file;
 * what matters here is that `LUCK` is the same size as the whole form spread,
 * because a race where the fastest card simply wins is not a race, it is an
 * announcement.
 */
const BASE = 26;
const SPREAD = 7;
const WOBBLE = 11;
/** Held for the whole race: uniform over ±LUCK. */
const LUCK = 7;
/** The slow walk: how hard it is kicked per second, how fast it is pulled back, and its ceiling. */
const DRIFT_KICK = 26;
const DRIFT_PULL = 1.6;
const DRIFT_MAX = 9;
/** Every frog gets one, somewhere in the middle third. */
const SURGE = 16;

/**
 * One frog's pace this tick, and the walk moved on.
 *
 * The one place the race is decided, used by the race the player watches AND
 * by the headless sampler — two copies of this arithmetic is two races, and
 * the sampler would then be measuring a game nobody plays.
 */
function pace(r: { form: number; luck: number; drift: number }, t: number, surging: boolean, dt: number): number {
  r.drift += (Math.random() - 0.5) * 2 * DRIFT_KICK * dt;
  r.drift = Phaser.Math.Clamp(r.drift - r.drift * DRIFT_PULL * dt, -DRIFT_MAX, DRIFT_MAX);
  void t;
  return (
    BASE +
    r.form * SPREAD +
    r.luck +
    r.drift +
    (Math.random() - 0.5) * 2 * WOBBLE +
    (surging ? SURGE : 0)
  );
}

interface Racer {
  i: number;
  /** 0..1, the thumb on the scale, shown on the card as FORM. */
  form: number;
  /** The day it is having.  Drawn once, held to the line, never shown. */
  luck: number;
  /** The slow walk: good and bad patches you can watch happen. */
  drift: number;
  x: number;
  /** Where in the race its surge fires, and how long it lasts. */
  surgeAt: number;
  surgeFor: number;
  hop: number;
  body: Phaser.GameObjects.Container;
}

type Phase = 'betting' | 'countdown' | 'racing' | 'result';

let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let phase: Phase = 'betting';
let over = false;
let pick = -1;
let racers: Racer[] = [];
let winner = -1;
let clock = 0;
let countdown = 0;
let rows: Array<{ plate: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.BitmapText }> = [];
let banner: Phaser.GameObjects.BitmapText | null = null;
let sub: Phaser.GameObjects.BitmapText | null = null;
let goBtn: { box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.BitmapText } | null = null;
let keys: Phaser.Input.Keyboard.Key[] = [];

export const frogRace: MinigameModule = {
  id: ID,
  title: 'FROG RACE',
  music: 'game_frograce',
  rules: 'pick one, seven run',
  payoutNote: 'WIN: 15 TOKENS',
  tutorial: {
    objective: [
      'SEVEN FROGS RACE. BACK ONE OF THEM.',
      'NOTHING SAYS WHICH. IT IS A GUESS.',
      'THEY RUN CLOSE AND THE LEAD CHANGES.',
      'YOUR FROG FIRST PAST THE POST PAYS 15.',
    ],
    controls: [
      ['1-7 / CLICK', 'BACK THAT FROG'],
      ['SPACE', 'START THE RACE'],
    ],
  },
  // Seven runners will not fit on five buttons, and they do not need to: the
  // whole lane is a hit area, so backing one is tapping the frog you want.
  touch: { buttons: [{ label: 'RACE', key: 'SPACE', primary: true }] },

  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    phase = 'betting';
    over = false;
    pick = -1;
    winner = -1;
    clock = 0;
    countdown = 0;
    rows = [];

    paintTrack(scene);
    draft(scene);

    banner = centerText(scene, GAME_W / 2, 24, 'BACK A FROG', PALETTE.gold).setDepth(60);
    sub = centerText(scene, GAME_W / 2, 164, 'TAP A ROW OR PRESS 1-7', PALETTE.cream).setDepth(60);
    goBtn = {
      box: scene.add
        .rectangle(GAME_W / 2, 150, 78, 14, PALETTE.tealDark)
        .setDepth(60)
        .setStrokeStyle(1, PALETTE.gold)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => startRace()) as Phaser.GameObjects.Rectangle,
      // On the box's own centre line, not four pixels up it.
      label: centerText(scene, GAME_W / 2, 150, 'RACE', PALETTE.cream).setDepth(61),
    };
    setGoEnabled(false);

    const kb = scene.input.keyboard;
    keys = kb ? ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'].map((n) => kb.addKey(n)) : [];
    keys.forEach((k, i) => k.on('down', () => choose(i)));
    kb?.on('keydown-SPACE', () => startRace());

    refresh();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__race = {
        state: () => ({
          phase,
          pick,
          winner,
          over,
          /** The card as the player sees it, best form first. */
          card: racers
            .map((r) => ({ name: RUNNERS[r.i].name, form: Math.round(r.form * 100), x: Math.round(r.x) }))
            .sort((a, b) => b.form - a.form),
          favourite: racers.reduce((a, b) => (b.form > a.form ? b : a)).i,
        }),
        choose: (i: number) => choose(i),
        start: () => startRace(),
        /** Run a race to the line without drawing it, for sampling the odds. */
        sample: (n: number) => {
          const wins = Array(RUNNERS.length).fill(0);
          let favWins = 0;
          for (let k = 0; k < n; k++) {
            const field = makeField();
            const fav = field.reduce((a, b) => (b.form > a.form ? b : a));
            const w = simulate(field);
            wins[w]++;
            if (w === fav.i) favWins++;
          }
          return { wins, favourite: favWins / n };
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__race;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over || !sceneRef) return;
    const dt = Math.min(0.05, delta / 1000);
    clock += delta;

    if (phase === 'countdown') {
      countdown -= delta;
      const n = Math.ceil(countdown / 700);
      banner?.setText(n > 0 ? `${n}` : 'GO!');
      if (countdown <= 0) {
        phase = 'racing';
        audio.sfx('buzzer', 0.4);
      }
    } else if (phase === 'racing') {
      for (const r of racers) {
        const t = r.x / DIST;
        const surging = t > r.surgeAt && t < r.surgeAt + r.surgeFor;
        const speed = pace(r, t, surging, dt);
        r.x = Math.min(DIST, r.x + Math.max(4, speed) * dt);
        r.hop += dt * (6 + speed * 0.08);
      }
      const home = racers.filter((r) => r.x >= DIST);
      if (home.length) {
        // A dead heat is settled by whoever was fastest into it, which is the
        // one that went furthest past the line on this frame.
        winner = home.reduce((a, b) => (b.x > a.x ? b : a)).i;
        settle();
      }
    }

    for (const r of racers) {
      r.body.setPosition(START_X + r.x, LANE_T + r.i * LANE_H + 7 - Math.abs(Math.sin(r.hop)) * 3);
    }
  },

  destroy() {
    racers = [];
    rows = [];
    banner = null;
    sub = null;
    goBtn = null;
    keys = [];
    sceneRef = null;
    apiRef = null;
  },
};

// ------------------------------------------------------------------ the card

/** A fresh field: seven forms, shuffled onto the seven colours. */
function makeField(): Array<{ i: number; form: number; luck: number; surgeAt: number; surgeFor: number }> {
  // Seven evenly spread ratings, handed out at random — so the favourite is a
  // different colour every race and the spread is the same every race.
  const forms = [1, 0.82, 0.64, 0.5, 0.36, 0.2, 0];
  const order = [...RUNNERS.keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.map((idx, k) => ({
    i: idx,
    form: forms[k],
    // Drawn here rather than at the gun, so the sampler and the race are
    // rolling the same field in the same order.
    luck: (Math.random() - 0.5) * 2 * LUCK,
    surgeAt: 0.25 + Math.random() * 0.45,
    surgeFor: 0.12 + Math.random() * 0.16,
  }));
}

/** Run a field to the line with no drawing, and say who won. */
function simulate(field: Array<{ i: number; form: number; luck: number; surgeAt: number; surgeFor: number }>): number {
  const xs = field.map(() => 0);
  const runs = field.map((f) => ({ form: f.form, luck: f.luck, drift: 0 }));
  const dt = 1 / 60;
  for (let step = 0; step < 4000; step++) {
    let best = -1;
    for (let k = 0; k < field.length; k++) {
      const t = xs[k] / DIST;
      const surging = t > field[k].surgeAt && t < field[k].surgeAt + field[k].surgeFor;
      const speed = pace(runs[k], t, surging, dt);
      xs[k] = Math.min(DIST, xs[k] + Math.max(4, speed) * dt);
      if (xs[k] >= DIST && (best === -1 || xs[k] > xs[best])) best = k;
    }
    if (best >= 0) return field[best].i;
  }
  return field[0].i;
}

function draft(scene: Phaser.Scene): void {
  const field = makeField();
  racers = field.map((f) => ({
    i: f.i,
    form: f.form,
    luck: f.luck,
    drift: 0,
    x: 0,
    surgeAt: f.surgeAt,
    surgeFor: f.surgeFor,
    hop: Math.random() * 6,
    body: makeFrog(scene, RUNNERS[f.i].colour),
  }));
  racers.sort((a, b) => a.i - b.i);

  racers.forEach((r) => {
    const y = LANE_T + r.i * LANE_H;
    const plate = scene.add
      .rectangle(4, y - 6, 34, 13, PALETTE.ink)
      .setOrigin(0, 0)
      .setDepth(20)
      .setStrokeStyle(1, PALETTE.steel)
      .setInteractive({ useHandCursor: true });
    plate.on('pointerdown', () => choose(r.i));
    // The whole lane is the hit area, not just the plate: a row you have to
    // aim at a 34-pixel box to back is a menu wearing a racecard's clothes.
    scene.add
      .zone(0, y - 7, GAME_W, LANE_H)
      .setOrigin(0, 0)
      .setDepth(19)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => choose(r.i));
    const label = centerText(scene, 21, y, '', PALETTE.cream).setDepth(21);
    rows[r.i] = { plate, label };
  });
}

function paintTrack(scene: Phaser.Scene): void {
  scene.add.rectangle(0, 18, GAME_W, 162, 0x123322).setOrigin(0, 0);
  for (let i = 0; i < RUNNERS.length; i++) {
    const y = LANE_T + i * LANE_H;
    scene.add.rectangle(0, y - 7, GAME_W, LANE_H - 1, i % 2 ? 0x18412a : 0x14381f).setOrigin(0, 0);
  }
  // the rail, the post and the chequered line
  scene.add.rectangle(START_X - 3, LANE_T - 8, 1, RUNNERS.length * LANE_H, PALETTE.bone).setOrigin(0, 0).setAlpha(0.5);
  // THE CHEQUER RUNS THE WHOLE FIELD.  It used to be a fixed count of squares
  // — two per runner, five pixels each — which is seventy pixels of a
  // hundred-and-five pixel field, so the bottom two lanes ran at a finish line
  // that was not there.  Counted off the lanes instead, it cannot come up
  // short again however many frogs are in the race.
  const tapeTop = LANE_T - 8;
  const tapeH = RUNNERS.length * LANE_H;
  for (let i = 0; i * TAPE_SQ < tapeH; i++) {
    scene.add
      .rectangle(
        FINISH_X,
        tapeTop + i * TAPE_SQ,
        4,
        Math.min(TAPE_SQ, tapeH - i * TAPE_SQ),
        i % 2 ? PALETTE.white : PALETTE.ink,
      )
      .setOrigin(0, 0)
      .setDepth(2);
  }
  scene.add.rectangle(FINISH_X + 4, LANE_T - 12, 2, RUNNERS.length * LANE_H + 6, PALETTE.bone).setOrigin(0, 0);
}

function makeFrog(scene: Phaser.Scene, colour: number): Phaser.GameObjects.Container {
  const parts = [
    scene.add.ellipse(0, 0, 11, 8, colour),
    scene.add.ellipse(1, 1, 6, 4, 0xffffff).setAlpha(0.25),
    scene.add.circle(-3, -4, 2.5, colour),
    scene.add.circle(3, -4, 2.5, colour),
    scene.add.circle(-3, -4, 1.2, PALETTE.black),
    scene.add.circle(3, -4, 1.2, PALETTE.black),
    scene.add.ellipse(-5, 3, 4, 2, colour),
    scene.add.ellipse(5, 3, 4, 2, colour),
  ];
  return scene.add.container(0, 0, parts).setDepth(10);
}

// ------------------------------------------------------------------ the bet

function choose(i: number): void {
  if (phase !== 'betting' || i < 0 || i >= RUNNERS.length) return;
  pick = i;
  audio.sfx('ui_blip', 0.6);
  setGoEnabled(true);
  refresh();
}

function setGoEnabled(on: boolean): void {
  goBtn?.box.setFillStyle(on ? PALETTE.tealDark : PALETTE.slate);
  goBtn?.label.setTint(on ? PALETTE.cream : PALETTE.ash);
}

function startRace(): void {
  if (phase !== 'betting' || pick < 0) return;
  phase = 'countdown';
  countdown = 2100;
  goBtn?.box.setVisible(false).disableInteractive();
  goBtn?.label.setVisible(false);
  sub?.setText(`YOU ARE ON ${RUNNERS[pick].name}`);
  audio.sfx('coin_drop', 0.5);
  refresh();
}

function settle(): void {
  if (phase === 'result') return;
  phase = 'result';
  const won = winner === pick;
  banner?.setText(won ? `${RUNNERS[winner].name} WINS - YOU WIN` : `${RUNNERS[winner].name} WINS`);
  banner?.setTint(won ? PALETTE.gold : PALETTE.blood);
  sub?.setText(won ? 'PAYS 15 TOKENS' : `YOU WERE ON ${RUNNERS[pick].name}`);
  sub?.setTint(won ? PALETTE.mossLight : PALETTE.ash);
  refresh();
  audio.sfx(won ? 'chime' : 'buzzer');
  if (won && sceneRef) sceneRef.cameras.main.flash(220, 255, 240, 180);
  store.setHighScore(ID, won ? 1 : 0);
  over = true;
  // MG-3: the shell pays, once.  A race is one decision and one result, so
  // there is nothing here to pay twice.
  sceneRef?.time.delayedCall(1800, () => (won ? apiRef?.win() : apiRef?.lose()));
}

function refresh(): void {
  for (const r of racers) {
    const row = rows[r.i];
    if (!row) continue;
    const mine = r.i === pick;
    row.label.setText(`${r.i + 1}`);
    row.label.setTint(mine ? PALETTE.gold : PALETTE.fog);
    row.plate.setStrokeStyle(1, mine ? PALETTE.gold : PALETTE.steel);
    row.plate.setFillStyle(mine ? 0x2a2410 : PALETTE.ink);
  }
}
