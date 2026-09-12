/**
 * DANCE OFF.  Hard — 10 tokens in, 20 out.
 *
 * A step battle against a rival on the next mat over.  Arrows climb two lanes
 * of four towards the receptors at the top; when yours reaches the line, press
 * the key that matches it.  W A S D are the four directions — A left, S down,
 * W up, D right — which is the same hand position as walking, so nobody has to
 * learn a new grip to play a game that is over in forty-five seconds.
 *
 * Forty-five seconds, one chart, and the higher score takes it.  The rival
 * gets the SAME arrows at the SAME moments and lands about seven in ten of
 * them, so beating him is a matter of accuracy rather than luck — and the
 * combo bonus is where the margin comes from: he never builds one.
 *
 * The chart is generated from a fixed seed, so the song is the same song every
 * time you pay for it.  A rhythm game whose chart is noise cannot be learned,
 * and learning it is the whole of the genre.
 *
 * Original characters, original chart, original name (PRD MG-7).
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'danceoff' as const;

export const ROUND_MS = 45_000;
const BPM = 128;
const BEAT = 60_000 / BPM;
/** The chart starts after a bar of nothing and stops before the buzzer. */
const CHART_FROM = 2200;
const CHART_TO = ROUND_MS - 2000;
/** How likely an off-beat note is, on top of the note on every beat. */
const OFFBEAT_CHANCE = 0.22;

/** Where the arrows are caught, and how fast they climb to it. */
const RECEPTOR_Y = 46;
const SPAWN_Y = 178;
const NOTE_SPEED = (SPAWN_Y - RECEPTOR_Y) / 1.45; // px per second: 1.45s of warning
/** How far either side of the beat a press still counts, ms. */
const WINDOW_MS = 145;
/** Past this the note is gone and the combo with it. */
const MISS_MS = 190;

const LANES = 4;
const LANE_W = 19;
const ARROWS = ['←', '↓', '↑', '→'];
const LANE_COLOUR = [PALETTE.neon, PALETTE.tealLight, PALETTE.mossLight, PALETTE.ember];
/** Left edge of each side's four lanes. */
const RIVAL_X = 22;
const YOU_X = GAME_W - 22 - LANES * LANE_W;

/** What a hit is worth, and what a run of them adds on top. */
const HIT_POINTS = 100;
const COMBO_STEP = 10;
const COMBO_CAP = 10;
/** How often the rival lands one.  He is good, not perfect, and never combos. */
const RIVAL_ACCURACY = 0.7;

interface Note {
  /** When it should be hit, ms into the round. */
  at: number;
  lane: number;
  mine: boolean;
  done: boolean;
  /** Did whoever owns it land it? */
  hit: boolean;
  body: Phaser.GameObjects.Rectangle | null;
  glyph: Phaser.GameObjects.BitmapText | null;
}

let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let notes: Note[] = [];
let clock = 0;
let over = false;
let score = { you: 0, rival: 0 };
let combo = 0;
let bestCombo = 0;
let hits = 0;
let misses = 0;
let receptors: Phaser.GameObjects.Rectangle[] = [];
let dancers: { you: Phaser.GameObjects.Container | null; rival: Phaser.GameObjects.Container | null } = { you: null, rival: null };
let hud: {
  you: Phaser.GameObjects.BitmapText;
  rival: Phaser.GameObjects.BitmapText;
  time: Phaser.GameObjects.BitmapText;
  combo: Phaser.GameObjects.BitmapText;
  judge: Phaser.GameObjects.BitmapText;
} | null = null;
let keys: Phaser.Input.Keyboard.Key[] = [];
let heldLast = [false, false, false, false];

/** A little deterministic generator, so the chart is a chart and not noise. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * The chart.  A note on every beat and an off-beat now and then, the same
 * moments for both sides so the two mats read as one song, with the lanes
 * drawn independently so you are not simply mirroring him.
 */
function buildChart(): Note[] {
  const rand = rng(0x5757);
  const out: Note[] = [];
  for (let t = CHART_FROM; t < CHART_TO; t += BEAT) {
    for (const mine of [false, true]) {
      out.push({ at: t, lane: Math.floor(rand() * LANES), mine, done: false, hit: false, body: null, glyph: null });
    }
    if (rand() < OFFBEAT_CHANCE) {
      const off = t + BEAT / 2;
      if (off < CHART_TO) {
        for (const mine of [false, true]) {
          out.push({ at: off, lane: Math.floor(rand() * LANES), mine, done: false, hit: false, body: null, glyph: null });
        }
      }
    }
  }
  return out;
}

function laneX(mine: boolean, lane: number): number {
  return (mine ? YOU_X : RIVAL_X) + lane * LANE_W + LANE_W / 2;
}

export const danceOff: MinigameModule = {
  id: ID,
  title: 'DANCE OFF',
  music: 'game_danceoff',
  rules: '45 seconds - out-dance him',
  tutorial: {
    objective: [
      'ARROWS CLIMB. HIT THEM ON THE LINE.',
      'A LEFT, S DOWN, W UP, D RIGHT.',
      '45 SECONDS - THE HIGHER SCORE TAKES IT.',
    ],
    controls: [
      ['A / S', 'LEFT AND DOWN'],
      ['W / D', 'UP AND RIGHT'],
    ],
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    clock = 0;
    over = false;
    score = { you: 0, rival: 0 };
    combo = 0;
    bestCombo = 0;
    hits = 0;
    misses = 0;
    receptors = [];
    heldLast = [false, false, false, false];
    notes = buildChart();

    // the hall: a dark room, a lit floor, a speaker stack either side
    scene.add.rectangle(0, 18, GAME_W, 162, 0x1d1030).setOrigin(0, 0);
    scene.add.rectangle(0, 150, GAME_W, 30, 0x140a24).setOrigin(0, 0);
    scene.add.ellipse(GAME_W / 2, 150, 150, 40, 0x3a2060).setAlpha(0.6);
    for (const sx of [8, GAME_W - 8]) {
      scene.add.rectangle(sx, 96, 14, 54, PALETTE.ink).setOrigin(0.5, 0).setStrokeStyle(1, PALETTE.slate);
      scene.add.circle(sx, 110, 5, PALETTE.slate);
      scene.add.circle(sx, 132, 3, PALETTE.slate);
    }

    // the two mats, and the receptors along the top of each
    for (const mine of [false, true]) {
      const x0 = mine ? YOU_X : RIVAL_X;
      scene.add.rectangle(x0 - 2, RECEPTOR_Y - 10, LANES * LANE_W + 4, 148, 0x000000).setOrigin(0, 0).setAlpha(0.32);
      for (let l = 0; l < LANES; l++) {
        const r = scene.add
          .rectangle(laneX(mine, l), RECEPTOR_Y, 16, 15, PALETTE.ink)
          .setStrokeStyle(1, LANE_COLOUR[l])
          .setDepth(6);
        centerText(scene, laneX(mine, l), RECEPTOR_Y, ARROWS[l], LANE_COLOUR[l]).setDepth(7).setAlpha(0.75);
        if (mine) receptors.push(r);
      }
    }

    dancers = {
      rival: makeRival(scene, 138, 148),
      you: makeDancer(scene, 182, 148),
    };

    hud = {
      rival: text(scene, RIVAL_X, 24, '', PALETTE.neon),
      you: text(scene, GAME_W - 22, 24, '', PALETTE.tealLight).setOrigin(1, 0),
      time: centerText(scene, GAME_W / 2, 28, '', PALETTE.cream),
      combo: centerText(scene, GAME_W / 2, 96, '', PALETTE.gold),
      judge: centerText(scene, GAME_W / 2, 112, '', PALETTE.fog),
    };
    refreshHud();

    const kb = scene.input.keyboard;
    keys = kb ? ['A', 'S', 'W', 'D'].map((k) => kb.addKey(k)) : [];

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__dance = {
        state: () => ({ clock, score: { ...score }, combo, bestCombo, hits, misses, notes: notes.length, over }),
        /**
         * The next few arrows of yours that are still live.  A rhythm game is
         * only testable if the harness can play it properly, and playing it
         * properly means knowing what is coming and when.
         */
        next: (n = 4) =>
          notes
            .filter((x) => x.mine && !x.done)
            .sort((a, b) => a.at - b.at)
            .slice(0, n)
            .map((x) => ({ at: x.at, lane: x.lane, in: x.at - clock })),
        window: WINDOW_MS,
        /** Play the rest of the chart perfectly, for proving a win pays. */
        ace: () => {
          for (const n of notes) {
            if (n.done || !n.mine) continue;
            n.done = true;
            n.hit = true;
            score.you += HIT_POINTS + Math.min(combo, COMBO_CAP) * COMBO_STEP;
            combo++;
            hits++;
          }
          refreshHud();
        },
        /** Miss the rest of it, for the other side of the same door. */
        flop: () => {
          for (const n of notes) {
            if (n.done || !n.mine) continue;
            n.done = true;
            misses++;
          }
          combo = 0;
          refreshHud();
        },
        finish: () => finish(),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__dance;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over) return;
    clock += delta;
    if (clock >= ROUND_MS) {
      finish();
      return;
    }

    // ---- the keys.  Edge-triggered: holding a key does not eat a lane.
    for (let l = 0; l < LANES; l++) {
      const down = keys[l]?.isDown ?? false;
      if (down && !heldLast[l]) press(l);
      heldLast[l] = down;
      receptors[l]?.setFillStyle(down ? LANE_COLOUR[l] : PALETTE.ink);
    }

    // ---- the arrows
    for (const n of notes) {
      const dt = n.at - clock;
      if (dt > 1600) continue;
      if (!n.body && !n.done && sceneRef) {
        n.body = sceneRef.add.rectangle(laneX(n.mine, n.lane), SPAWN_Y, 16, 15, LANE_COLOUR[n.lane]).setDepth(4);
        n.glyph = centerText(sceneRef, laneX(n.mine, n.lane), SPAWN_Y, ARROWS[n.lane], PALETTE.ink).setDepth(5);
      }
      if (n.body) {
        const y = RECEPTOR_Y + (dt / 1000) * NOTE_SPEED;
        n.body.setPosition(n.body.x, y).setVisible(!n.done && y < SPAWN_Y + 8 && y > RECEPTOR_Y - 14);
        n.glyph?.setPosition(n.body.x, y).setVisible(n.body.visible);
      }

      if (n.done) continue;

      // the rival plays his own side, on the beat, most of the time
      if (!n.mine && dt <= 0) {
        n.done = true;
        if (Math.random() < RIVAL_ACCURACY) {
          n.hit = true;
          score.rival += HIT_POINTS;
          bob(dancers.rival, n.lane);
        }
        clear(n);
        refreshHud();
        continue;
      }
      // yours, gone past the window
      if (n.mine && dt < -MISS_MS) {
        n.done = true;
        misses++;
        combo = 0;
        judge('MISS', PALETTE.blood);
        clear(n);
        refreshHud();
      }
    }
  },

  destroy() {
    notes = [];
    receptors = [];
    dancers = { you: null, rival: null };
    hud = null;
    keys = [];
    apiRef = null;
    sceneRef = null;
  },
};

/** A key went down in a lane: take the nearest arrow of yours that is due. */
function press(lane: number): void {
  if (over) return;
  let best: Note | null = null;
  let bestGap = Infinity;
  for (const n of notes) {
    if (!n.mine || n.done || n.lane !== lane) continue;
    const gap = Math.abs(n.at - clock);
    if (gap < bestGap) {
      bestGap = gap;
      best = n;
    }
  }
  if (!best || bestGap > WINDOW_MS) {
    // A press into an empty lane is not free: it is how mashing loses.
    combo = 0;
    judge('OFF BEAT', PALETTE.steel);
    refreshHud();
    audio.sfx('ui_hover', 0.4);
    return;
  }
  best.done = true;
  best.hit = true;
  hits++;
  score.you += HIT_POINTS + Math.min(combo, COMBO_CAP) * COMBO_STEP;
  combo++;
  bestCombo = Math.max(bestCombo, combo);
  judge(bestGap < 55 ? 'PERFECT' : 'GOOD', bestGap < 55 ? PALETTE.gold : PALETTE.tealLight);
  audio.sfx(bestGap < 55 ? 'ui_blip' : 'ui_hover', 0.6);
  bob(dancers.you, lane);
  clear(best);
  refreshHud();
}

function clear(n: Note): void {
  n.body?.destroy();
  n.glyph?.destroy();
  n.body = null;
  n.glyph = null;
}

/** A dancer leans the way the arrow pointed. */
function bob(who: Phaser.GameObjects.Container | null, lane: number): void {
  if (!who || !sceneRef) return;
  const dx = lane === 0 ? -3 : lane === 3 ? 3 : 0;
  const dy = lane === 1 ? 2 : lane === 2 ? -3 : 0;
  sceneRef.tweens.killTweensOf(who);
  who.setPosition(who.x + dx, who.y + dy);
  sceneRef.tweens.add({ targets: who, x: who.x - dx, y: who.y - dy, duration: 130, ease: 'Quad.easeOut' });
}

function judge(word: string, colour: number): void {
  if (!hud || !sceneRef) return;
  hud.judge.setText(word).setTint(colour).setAlpha(1);
  sceneRef.tweens.killTweensOf(hud.judge);
  sceneRef.tweens.add({ targets: hud.judge, alpha: 0, delay: 320, duration: 260 });
}

function refreshHud(): void {
  if (!hud) return;
  hud.rival.setText(`RIVAL ${score.rival}`);
  hud.you.setText(`YOU ${score.you}`);
  hud.time.setText(`${Math.max(0, Math.ceil((ROUND_MS - clock) / 1000))}s`);
  hud.combo.setText(combo >= 3 ? `${combo} IN A ROW` : '');
}

function finish(): void {
  if (over || !sceneRef) return;
  over = true;
  for (const n of notes) clear(n);
  hud?.combo.setText('');
  const won = score.you > score.rival;
  const line = won ? 'YOU TOOK IT' : score.you === score.rival ? 'A DRAW - NO PRIZE' : 'HE TOOK IT';
  centerText(sceneRef, GAME_W / 2, 92, line, won ? PALETTE.gold : PALETTE.fog, 16).setDepth(50);
  centerText(sceneRef, GAME_W / 2, 110, `${score.you} - ${score.rival}`, PALETTE.cream).setDepth(50);
  centerText(sceneRef, GAME_W / 2, 122, `${hits} HIT  ${misses} MISSED  BEST RUN ${bestCombo}`, PALETTE.ash).setDepth(50);
  sceneRef.time.delayedCall(1800, () => (won ? apiRef?.win() : apiRef?.lose()));
}

/** You: the frog, on the mat, in a cap. */
function makeDancer(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const parts = [
    scene.add.ellipse(-6, -2, 9, 4, PALETTE.moss),
    scene.add.ellipse(6, -2, 9, 4, PALETTE.moss),
    scene.add.ellipse(0, -12, 22, 19, PALETTE.mossLight),
    scene.add.ellipse(0, -9, 13, 9, 0xcfe8a0),
    scene.add.circle(-5, -21, 4, PALETTE.cream),
    scene.add.circle(5, -21, 4, PALETTE.cream),
    scene.add.circle(-4, -21, 2, PALETTE.black),
    scene.add.circle(6, -21, 2, PALETTE.black),
    scene.add.rectangle(0, -25, 16, 4, PALETTE.neon).setOrigin(0.5, 1),
    scene.add.rectangle(7, -24, 8, 3, PALETTE.neon).setOrigin(0, 1),
  ];
  return scene.add.container(x, y, parts).setDepth(10);
}

/** Him: taller, sharper, and enjoying himself more than you are. */
function makeRival(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const skin = 0x8f6fe0;
  const parts = [
    scene.add.ellipse(-5, -2, 8, 4, 0x5a3f9c),
    scene.add.ellipse(5, -2, 8, 4, 0x5a3f9c),
    scene.add.rectangle(0, -4, 14, 16, skin).setOrigin(0.5, 1),
    scene.add.rectangle(0, -12, 18, 4, 0x5a3f9c).setOrigin(0.5, 1),
    scene.add.circle(0, -26, 8, skin),
    scene.add.circle(-3, -27, 2, PALETTE.cream),
    scene.add.circle(3, -27, 2, PALETTE.cream),
    scene.add.rectangle(0, -22, 7, 1, 0x3d2a5c),
    // a quiff, because he has a look and you do not
    scene.add.triangle(0, -33, 0, 6, 7, 0, 10, 8, PALETTE.gold).setOrigin(0.5, 1),
  ];
  return scene.add.container(x, y, parts).setDepth(10);
}
