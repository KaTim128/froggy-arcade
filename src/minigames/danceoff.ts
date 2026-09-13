/**
 * DANCE OFF.  Hard — 7 tokens in, 15 out.
 *
 * A step battle against a rival on the next mat over.  Arrows climb two lanes
 * of four towards the receptors at the top; when yours reaches the line, press
 * the key that matches it.  W A S D are the four directions — A left, S down,
 * W up, D right — which is the same hand position as walking, so nobody has to
 * learn a new grip to play a game that is over in forty-five seconds.
 *
 * IT IS A MATCH, BEST OF THREE.  Each round is forty-five seconds, the higher
 * score takes the round, and the first to two rounds takes the match and the
 * fifteen tokens.  Three rounds that both go one apiece and the match is a
 * draw, which — like every other tie in the building — hands the entry fee
 * back rather than keeping it.
 *
 * EVERY ROUND IS A DIFFERENT SONG AND A DIFFERENT CHART.  The tune steps up a
 * tempo each round and the chart is cut fresh to that tempo, busier every
 * time; the arrows are drawn at random from a seed taken off the clock, so no
 * two rounds — and no two matches — are the same sequence.  The chart used to
 * be one fixed seed on the argument that a rhythm game should be learnable;
 * against a rival who is supposed to get harder every round, that made the
 * second and third rounds the first one again, so the seed moves now.
 *
 * AND HE GETS BETTER EVERY TIME YOU BEAT HIM.  He gets the SAME arrows at the
 * SAME moments as you; what changes is how many of them he lands, and whether
 * he strings them together.  Take the first round off him and he starts
 * landing three in four; take the second and he is landing nearly nine in ten
 * and building combos of his own, which is the thing you were beating him
 * with.  Lose a round and he does not get any better for it: he steps up when
 * you step up.
 *
 * A hit is 100 and a run of them pays 10 more each up to +100; a WRONG KEY —
 * one with nothing of yours due in that lane — takes 100 straight back off,
 * which is what stops the game being four keys held down.
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
/** The chart starts after a bar of nothing and stops before the buzzer. */
const CHART_FROM = 2200;
const CHART_TO = ROUND_MS - 2000;

/**
 * The three rounds: which tune, how fast it runs, and how much of the chart
 * falls between the beats.  Each one is quicker and busier than the last, and
 * the chart is cut to the round's own tempo so the arrows always land where
 * the kick does.
 */
export const ROUNDS = [
  { music: 'game_danceoff', bpm: 128, offbeat: 0.2, label: 'ROUND 1' },
  { music: 'game_danceoff_2', bpm: 140, offbeat: 0.32, label: 'ROUND 2' },
  { music: 'game_danceoff_3', bpm: 152, offbeat: 0.44, label: 'FINAL ROUND' },
];
/** Rounds needed to take the match. */
const ROUNDS_TO_WIN = 2;
/** How long the round card sits between rounds. */
const CARD_MS = 2800;

/**
 * How good he is, by the number of rounds you have already taken off him.  He
 * starts a bit worse than he used to be and finishes a lot better, and from
 * the second tier he strings hits together the way you do.
 */
const RIVAL_TIERS = [
  { accuracy: 0.62, combo: 0 },
  { accuracy: 0.76, combo: 6 },
  { accuracy: 0.88, combo: 10 },
];

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
/** The physical keys, by lane.  `code` so the mapping survives a layout. */
const LANE_CODES = ['KeyA', 'KeyS', 'KeyW', 'KeyD'];
const LANE_COLOUR = [PALETTE.neon, PALETTE.tealLight, PALETTE.mossLight, PALETTE.ember];
/** Left edge of each side's four lanes. */
const RIVAL_X = 22;
const YOU_X = GAME_W - 22 - LANES * LANE_W;

/** What a hit is worth, and what a run of them adds on top. */
const HIT_POINTS = 100;
/**
 * And what a wrong key costs: exactly what a right one pays.
 *
 * Anything less and the best strategy is to hold all four down and let the
 * window sort it out.  A press only counts as wrong when there is nothing of
 * yours due in that lane — the window is 145ms either side, so this is a wrong
 * key or a press at nothing, not a slightly early one.  The score floors at
 * zero: a negative scoreboard reads as a bug rather than as a telling-off.
 */
const WRONG_POINTS = 100;
const COMBO_STEP = 10;
const COMBO_CAP = 10;

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
/** Which round is on, 0-based, and how the match stands. */
let round = 0;
let wins = { you: 0, rival: 0 };
/** ms left of the card between rounds.  Nothing is playable while it is up. */
let cardMs = 0;
/** The card's own objects, torn down when the next round starts. */
let cardBits: Phaser.GameObjects.GameObject[] = [];
/** The round title, so a round that ends early can take it down with it. */
let banners: Phaser.GameObjects.GameObject[] = [];
/** His run of hits this round, for the tiers that let him keep one. */
let rivalCombo = 0;
let score = { you: 0, rival: 0 };
let combo = 0;
let bestCombo = 0;
let hits = 0;
let misses = 0;
/** Presses at nothing.  They cost points, so they are counted like the rest. */
let wrongs = 0;
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
let onKey: ((e: KeyboardEvent) => void) | null = null;

/** A little deterministic generator, so the chart is a chart and not noise. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * The chart for one round.  A note on every beat of that round's tempo and an
 * off-beat now and then, the same moments for both sides so the two mats read
 * as one song, with the lanes drawn independently so you are not simply
 * mirroring him.
 *
 * The seed is the round's, so a fresh one is cut every round and every match.
 */
function buildChart(seed: number, bpm: number, offbeat: number): Note[] {
  const rand = rng(seed);
  const beat = 60_000 / bpm;
  const out: Note[] = [];
  for (let t = CHART_FROM; t < CHART_TO; t += beat) {
    for (const mine of [false, true]) {
      out.push({ at: t, lane: Math.floor(rand() * LANES), mine, done: false, hit: false, body: null, glyph: null });
    }
    if (rand() < offbeat) {
      const off = t + beat / 2;
      if (off < CHART_TO) {
        for (const mine of [false, true]) {
          out.push({ at: off, lane: Math.floor(rand() * LANES), mine, done: false, hit: false, body: null, glyph: null });
        }
      }
    }
  }
  return out;
}

/** The tier he is dancing at: one step up for every round you have taken. */
function rivalTier(): { accuracy: number; combo: number } {
  return RIVAL_TIERS[Math.min(RIVAL_TIERS.length - 1, wins.you)];
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
      'HIT THE ARROWS AS THEY REACH THE LINE.',
      'A WRONG KEY COSTS YOU 100 - NO MASHING.',
      'BEST OF THREE. 45 SECONDS A ROUND.',
      'NEW SONG EACH ROUND - AND HE GETS BETTER.',
    ],
    controls: [
      ['A / S', 'LEFT AND DOWN'],
      ['W / D', 'UP AND RIGHT'],
    ],
  },
  // The four arrows ARE the game, so they are four buttons and not a stick.
  touch: {
    buttons: [
      { label: '\u25c0', key: 'A' },
      { label: '\u25bc', key: 'S' },
      { label: '\u25b2', key: 'W' },
      { label: '\u25b6', key: 'D' },
    ],
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    clock = 0;
    over = false;
    round = 0;
    wins = { you: 0, rival: 0 };
    cardMs = 0;
    cardBits = [];
    banners = [];
    rivalCombo = 0;
    score = { you: 0, rival: 0 };
    combo = 0;
    bestCombo = 0;
    hits = 0;
    misses = 0;
    wrongs = 0;
    receptors = [];
    notes = [];

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

    // Input comes off the DOM, once per key press, and nothing else.
    //
    // Polling `isDown` per frame drops a tap that begins and ends inside one
    // frame and reads every other one up to 16ms late — 11% of the hit window
    // spent on nothing.  Phaser's own keydown events are worse for this: its
    // queue re-emits, and ten presses measured as forty-six, which in a game
    // that docks you for a wrong key is ten mistakes charged as forty-six.
    // The DOM counts presses exactly; `repeat` filters the held-key stream.
    const kb = scene.input.keyboard;
    keys = kb ? ['A', 'S', 'W', 'D'].map((k) => kb.addKey(k)) : [];
    onKey = (ev: KeyboardEvent) => {
      if (over || cardMs > 0 || ev.repeat) return;
      const lane = LANE_CODES.indexOf(ev.code);
      if (lane >= 0) press(lane);
    };
    window.addEventListener('keydown', onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (onKey) window.removeEventListener('keydown', onKey);
      onKey = null;
    });

    startRound(0);

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__dance = {
        state: () => ({
          clock,
          score: { ...score },
          combo,
          bestCombo,
          hits,
          misses,
          wrongs,
          notes: notes.length,
          over,
          round,
          wins: { ...wins },
          cardUp: cardMs > 0,
          bpm: ROUNDS[Math.min(round, ROUNDS.length - 1)].bpm,
          music: ROUNDS[Math.min(round, ROUNDS.length - 1)].music,
          rival: rivalTier(),
          /** The round's arrows, in order, so two rounds can be compared. */
          chart: notes
            .filter((n) => n.mine)
            .sort((a, b) => a.at - b.at)
            .map((n) => `${Math.round(n.at)}:${n.lane}`)
            .join(','),
        }),
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
        /** End the round on the spot, wherever the clock is. */
        finish: () => endRound(),
        /** And skip the card between rounds, so a test need not wait it out. */
        skipCard: () => {
          if (cardMs > 0) cardMs = 1;
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__dance;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over) return;

    // Between rounds: the card is up, nothing is on the mats, and no key
    // pressed at it reaches the next round's chart.
    if (cardMs > 0) {
      cardMs -= delta;
      if (cardMs <= 0) {
        cardMs = 0;
        startRound(round);
      }
      return;
    }

    clock += delta;
    if (clock >= ROUND_MS) {
      endRound();
      return;
    }

    // ---- the receptors light while a key is held.  Presses arrive as events;
    // this is only the lamp.
    for (let l = 0; l < LANES; l++) {
      receptors[l]?.setFillStyle(keys[l]?.isDown ? LANE_COLOUR[l] : PALETTE.ink);
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
        const tier = rivalTier();
        if (Math.random() < tier.accuracy) {
          n.hit = true;
          score.rival += HIT_POINTS + Math.min(rivalCombo, tier.combo) * COMBO_STEP;
          rivalCombo++;
          bob(dancers.rival, n.lane);
        } else {
          rivalCombo = 0;
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
    if (onKey) window.removeEventListener('keydown', onKey);
    onKey = null;
    notes = [];
    cardBits = [];
    banners = [];
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
  if (over || cardMs > 0) return;
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
    wrongs++;
    score.you = Math.max(0, score.you - WRONG_POINTS);
    combo = 0;
    judge(`WRONG -${WRONG_POINTS}`, PALETTE.blood);
    refreshHud();
    audio.sfx('buzzer', 0.35);
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
  hud.rival.setText(`RIVAL ${score.rival}  (${wins.rival})`);
  hud.you.setText(`(${wins.you})  YOU ${score.you}`);
  const left = Math.max(0, Math.ceil((ROUND_MS - clock) / 1000));
  hud.time.setText(`R${Math.min(round + 1, ROUNDS.length)}   ${left}s`);
  hud.combo.setText(combo >= 3 ? `${combo} IN A ROW` : '');
}

/**
 * Put a round on: its own tune, its own tempo, its own chart.  The scores on
 * the board are per ROUND — the match is counted in rounds won, which is what
 * the brackets in the HUD are — so they reset here too.
 */
function startRound(i: number): void {
  if (!sceneRef) return;
  round = i;
  const cfg = ROUNDS[Math.min(i, ROUNDS.length - 1)];
  for (const o of cardBits) o.destroy();
  cardBits = [];
  for (const n of notes) clear(n);
  // A seed off the clock and the round number: a different sequence every
  // round, and a different one again next time the cabinet is paid for.
  notes = buildChart((Date.now() ^ (i * 0x9e3779b1)) >>> 0, cfg.bpm, cfg.offbeat);
  clock = 0;
  combo = 0;
  rivalCombo = 0;
  score = { you: 0, rival: 0 };
  audio.setScene({ music: cfg.music });
  refreshHud();

  const banner = centerText(sceneRef, GAME_W / 2, 88, cfg.label, PALETTE.gold, 16).setDepth(50);
  const sub = centerText(
    sceneRef,
    GAME_W / 2,
    106,
    i === 0 ? 'BEST OF THREE' : `HE IS DANCING HARDER  -  ${cfg.bpm} BPM`,
    PALETTE.cream,
  ).setDepth(50);
  // Kept, not forgotten: a round that ends early — the buzzer, or a test —
  // must not leave the round's own title fading under the result card.
  banners = [banner, sub];
  sceneRef.tweens.add({
    targets: banners,
    alpha: 0,
    delay: 900,
    duration: 700,
    onComplete: () => clearBanner(),
  });
}

/** Take the round's title off the screen, whenever the round is done with it. */
function clearBanner(): void {
  for (const o of banners) o.destroy();
  banners = [];
}

/** The buzzer.  Whoever is ahead takes the round; the match may end here. */
function endRound(): void {
  if (over || cardMs > 0 || !sceneRef) return;
  clearBanner();
  for (const n of notes) clear(n);
  hud?.combo.setText('');

  const youTook = score.you > score.rival;
  const drawn = score.you === score.rival;
  if (youTook) wins.you++;
  else if (!drawn) wins.rival++;
  refreshHud();

  if (wins.you >= ROUNDS_TO_WIN || wins.rival >= ROUNDS_TO_WIN || round >= ROUNDS.length - 1) {
    endMatch(drawn && wins.you === wins.rival);
    return;
  }

  // Another round to dance.  The card says how it stands and what is coming.
  const line = youTook ? 'ROUND TO YOU' : drawn ? 'ROUND DRAWN' : 'ROUND TO HIM';
  cardBits = [
    sceneRef.add.rectangle(GAME_W / 2, 100, 220, 62, PALETTE.ink).setDepth(49).setStrokeStyle(1, PALETTE.gold),
    centerText(sceneRef, GAME_W / 2, 84, line, youTook ? PALETTE.gold : PALETTE.fog, 16).setDepth(50),
    centerText(sceneRef, GAME_W / 2, 102, `${score.you} - ${score.rival}`, PALETTE.cream).setDepth(50),
    centerText(sceneRef, GAME_W / 2, 114, `ROUNDS  YOU ${wins.you}  -  HIM ${wins.rival}`, PALETTE.ash).setDepth(50),
  ];
  audio.sfx(youTook ? 'chime' : 'buzzer', 0.6);
  round++;
  cardMs = CARD_MS;
}

/** The match.  Rounds won decides it, and a level match is a level match. */
function endMatch(levelOnThree = false): void {
  if (over || !sceneRef) return;
  over = true;
  clearBanner();
  for (const n of notes) clear(n);
  const won = wins.you > wins.rival;
  const tied = wins.you === wins.rival;
  const line = won ? 'YOU TOOK THE MATCH' : tied ? 'A DRAW - TOKENS BACK' : 'HE TOOK THE MATCH';
  centerText(sceneRef, GAME_W / 2, 88, line, won ? PALETTE.gold : PALETTE.fog, 16).setDepth(50);
  centerText(sceneRef, GAME_W / 2, 106, `ROUNDS  ${wins.you} - ${wins.rival}`, PALETTE.cream).setDepth(50);
  centerText(
    sceneRef,
    GAME_W / 2,
    118,
    `${hits} HIT  ${misses} MISSED  ${wrongs} WRONG  BEST ${bestCombo}`,
    PALETTE.ash,
  ).setDepth(50);
  if (levelOnThree) {
    centerText(sceneRef, GAME_W / 2, 130, 'THREE ROUNDS AND NOTHING IN IT', PALETTE.ash).setDepth(50);
  }
  sceneRef.time.delayedCall(1800, () => (won ? apiRef?.win() : tied ? apiRef?.draw() : apiRef?.lose()));
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
