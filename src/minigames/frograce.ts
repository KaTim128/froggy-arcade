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
 *
 * AND THEN THERE IS WHAT HAPPENS TO THEM ON THE WAY.  Frogs HOP rather than
 * slide: the x is continuous underneath but every one of them is in the air or
 * on the ground at any moment, and the arc is what you actually watch.  The
 * track has POTHOLES in it, and a frog arriving at one either clears it or
 * goes in — a straight coin flip, and a fall costs it most of a second of
 * scrabbling.  Any of them can SLIP on landing and sprawl.  And somewhere in
 * the middle of the race a BIRD comes down and takes one, at random, out of
 * the race entirely.
 *
 * EVERY ONE OF THOSE IS IN THE SAMPLER TOO.  `step` is the only arithmetic
 * that moves a frog, and both the race the player watches and the headless
 * odds sampler call it — because a sampler that measures a cleaner race than
 * the one being played is measuring a game nobody plays.
 *
 * THE RACE IS TWELVE SECONDS, ALWAYS.  Long enough for two setbacks and a
 * recovery, and if nobody is home when the clock runs out it is won by whoever
 * is furthest up the track.
 *
 * TEN A TICKET, AND AS MANY TICKETS AS THE POCKET WILL TAKE.  The shell debits
 * the first one at the door; the rest go through `api.raise` before the gun,
 * and the win pays twenty a ticket through `api.win`.  The betting and the
 * race know nothing about each other: the race is twelve seconds of frogs
 * whatever is riding on it.
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
/**
 * BASE IS SET BY THE CLOCK, NOT BY TASTE.  The race is twelve seconds; at 26 a
 * clean field was home in under eight and the cap never came into it, which
 * made the twelve seconds a number in a comment.  Eighteen puts the winner
 * across at around eleven, so the last second is a real last second and a frog
 * that loses a spell to a pothole genuinely runs out of track.
 */
const BASE = 15;
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
 * THE RACE IS TWELVE SECONDS.  BASE is set so a clean run is home at about
 * ten and a half, which leaves room for a fall and a slip inside the cap.
 * Anyone still running at twelve is settled on distance.
 */
const RACE_S = 12;
/** One hop: how long it takes, and how high it goes in pixels. */
const HOP_S = 0.34;
const HOP_H = 5;
/** A pothole costs this long of scrabbling, and a slip this long of sprawling. */
const HOLE_S = 0.85;
const SLIP_S = 0.65;
/** The chance of a slip on any one landing.  Small: it is a surprise, not a tax. */
const SLIP_CHANCE = 0.018;
/** How much of the track a frog loses backing out of a hole. */
const HOLE_BACK = 6;
/** Potholes per lane, and the stretch of the track they are dug in. */
const HOLES_PER_LANE = 3;
const HOLE_FROM = 0.18;
const HOLE_TO = 0.86;
/**
 * The bird comes for somebody between these two points in the race -- and only
 * in some races.  At every race it stopped being a thing that happens and
 * became a tax on the field: about a third is often enough that the player has
 * seen it and does not know when it is coming.
 */
const BIRD_CHANCE = 0.35;
const BIRD_FROM = 0.3;
const BIRD_TO = 0.68;
/** How long it takes to come down, take one, and go. */
const BIRD_DIVE_S = 0.55;
const BIRD_AWAY_S = 1.1;
/** Ten a ticket; twenty back.  Kept here so the game and the cabinet agree. */
const TICKET = 10;
const TICKET_PAYS = 20;

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

/**
 * What a frog is doing.  `run` is hopping up the track; the other three are
 * the ways that stops, and each of them is something the player can see
 * happen rather than a number going down.
 */
type Going = 'run' | 'hole' | 'slip' | 'taken';

/**
 * Everything that moves a frog, and nothing that draws one.
 *
 * Split out from `Racer` so the headless sampler can run the identical model
 * without a Phaser container per frog — see `simulate`.
 */
interface Run {
  i: number;
  /** 0..1, the thumb on the scale.  Never shown. */
  form: number;
  /** The day it is having.  Drawn once, held to the line, never shown. */
  luck: number;
  /** The slow walk: good and bad patches you can watch happen. */
  drift: number;
  x: number;
  /** Where in the race its surge fires, and how long it lasts. */
  surgeAt: number;
  surgeFor: number;
  /** 0..1 through the current hop.  Drives the arc and the landing. */
  hop: number;
  going: Going;
  /** Seconds left of whatever it is doing instead of running. */
  stuck: number;
  /** Potholes in its lane, as fractions of the track, and how far it has got. */
  holes: number[];
  holeAt: number;
  /** Height off the lane, in pixels: the hop arc, or being carried off. */
  lift: number;
}

interface Racer extends Run {
  body: Phaser.GameObjects.Container;
}

/** The one bird, and where it is in its dive.  One per race, at most. */
interface Bird {
  /** When it comes, as a fraction of RACE_S. */
  at: number;
  /** Who it takes.  Chosen when it arrives, from whoever is still running. */
  target: number;
  /** 0 waiting, 1 diving, 2 carrying off, 3 gone. */
  phase: number;
  t: number;
  x: number;
  y: number;
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
/** Seconds since the gun.  The race is settled at RACE_S whatever else. */
let raceT = 0;
let bird: Bird = makeBird();
let birdArt: Phaser.GameObjects.Container | null = null;
/** How many tickets are on this race.  Ten tokens each, twenty back each. */
let tickets = 1;
let ticketLabel: Phaser.GameObjects.BitmapText | null = null;
let ticketBtns: Array<{ box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.BitmapText }> = [];
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
  payoutNote: 'WIN: 20 A TICKET',
  tutorial: {
    objective: [
      'SEVEN FROGS RACE. BACK ONE OF THEM.',
      'NOTHING SAYS WHICH. IT IS A GUESS.',
      'POTHOLES, SPILLS, AND A BIRD THAT TAKES ONE.',
      'TWELVE SECONDS. 10 A TICKET, 20 BACK.',
    ],
    controls: [
      ['1-7 / CLICK', 'BACK THAT FROG'],
      ['UP / DOWN', 'MORE OR FEWER TICKETS'],
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
    raceT = 0;
    countdown = 0;
    tickets = 1;
    ticketBtns = [];
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
    // ---- THE TICKETS.
    //
    // The shell already took one at the door, so the counter starts at one and
    // anything above it is bought with `api.raise` at the gun -- which is also
    // what stops a player buying five and then walking out with four of them
    // unspent.  The ceiling is what the pocket will take and nothing else.
    ticketLabel = centerText(scene, GAME_W / 2, 136, '', PALETTE.cream).setDepth(61);
    const mkBtn = (x: number, text: string, onClick: () => void) => {
      const box = scene.add
        .rectangle(x, 136, 16, 14, PALETTE.tealDark)
        .setDepth(60)
        .setStrokeStyle(1, PALETTE.gold)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', onClick) as Phaser.GameObjects.Rectangle;
      return { box, label: centerText(scene, x, 136, text, PALETTE.cream).setDepth(61) };
    };
    ticketBtns = [
      mkBtn(GAME_W / 2 - 52, '-', () => setTickets(tickets - 1)),
      mkBtn(GAME_W / 2 + 52, '+', () => setTickets(tickets + 1)),
    ];

    setGoEnabled(false);
    setTickets(1);

    const kb = scene.input.keyboard;
    keys = kb ? ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'].map((n) => kb.addKey(n)) : [];
    keys.forEach((k, i) => k.on('down', () => choose(i)));
    kb?.on('keydown-SPACE', () => startRace());
    kb?.on('keydown-UP', () => setTickets(tickets + 1));
    kb?.on('keydown-DOWN', () => setTickets(tickets - 1));

    refresh();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__race = {
        state: () => ({
          phase,
          pick,
          winner,
          over,
          /** The card as the player sees it, best form first. */
          tickets,
          raceT,
          birdPhase: bird.phase,
          birdTarget: bird.target,
          card: racers
            .map((r) => ({ name: RUNNERS[r.i].name, form: Math.round(r.form * 100), x: Math.round(r.x), going: r.going }))
            .sort((a, b) => b.form - a.form),
          // `destroy` empties the field, and a bridge that throws once the game
          // is over is a bridge that cannot be used to check how it ended.
          favourite: racers.length ? racers.reduce((a, b) => (b.form > a.form ? b : a)).i : -1,
        }),
        choose: (i: number) => choose(i),
        setTickets: (n: number) => setTickets(n),
        tickets: () => tickets,
        raceSeconds: RACE_S,
        ticketCost: TICKET,
        ticketPays: TICKET_PAYS,
        start: () => startRace(),
        /** How long a field takes and how often the bird gets somebody. */
        timing: (n: number) => {
          let total = 0;
          let taken = 0;
          let capped = 0;
          for (let k = 0; k < n; k++) {
            const runs = toRuns(makeField());
            const b = makeBird();
            const dt = 1 / 60;
            let t = 0;
            let done = 0;
            while (t < RACE_S) {
              t += dt;
              for (const r of runs) step(r, dt);
              stepBird(b, runs, t, dt);
              if (runs.some((r) => r.going !== 'taken' && r.x >= DIST)) {
                done = t;
                break;
              }
            }
            if (!done) capped++;
            total += done || RACE_S;
            if (runs.some((r) => r.going === 'taken')) taken++;
          }
          return { meanSeconds: total / n, birdTook: taken / n, hitTheCap: capped / n };
        },
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
      raceT += dt;
      // One tick of the model, and it is the SAME model the sampler runs.
      for (const r of racers) step(r, dt);
      stepBird(bird, racers, raceT, dt);
      if (bird.phase === 1 && bird.t <= dt) audio.sfx('throw_whoosh', 0.5);

      const home = racers.filter((r) => r.going !== 'taken' && r.x >= DIST);
      // First past the post, or -- at twelve seconds -- whoever is furthest.
      if (home.length || raceT >= RACE_S) {
        winner = settleField(racers);
        settle();
      }
    }

    // ---- where everything is drawn.
    for (const r of racers) {
      const laneY = LANE_T + r.i * LANE_H + 7;
      const body = r.body;
      body.setPosition(START_X + r.x, laneY - r.lift);
      if (r.going === 'taken' && bird.phase === 3) {
        body.setVisible(false);
        continue;
      }
      // Down in a hole: sunk, and shuffling.  On its face: flat and sprawled.
      if (r.going === 'hole') {
        body.setScale(1, 0.45);
        body.y = laneY + 3 + Math.sin(clock / 60) * 0.6;
      } else if (r.going === 'slip') {
        body.setScale(1.25, 0.5);
        body.setRotation(0.5);
        body.y = laneY + 2;
      } else {
        body.setScale(1, 1);
        // Leaning into the hop, and tucked at the top of it.
        body.setRotation(-Math.sin(r.hop * Math.PI * 2) * 0.22);
      }
    }

    if (birdArt) {
      const on = bird.phase === 1 || bird.phase === 2;
      birdArt.setVisible(on);
      if (on) {
        const lane = racers.find((r) => r.i === bird.target);
        birdArt.setPosition(START_X + bird.x, (lane ? LANE_T + lane.i * LANE_H + 7 : 90) + bird.y);
        const wings = birdArt.getData('wings') as Phaser.GameObjects.Ellipse[];
        const beat = Math.sin(clock / 45) * 3;
        wings[0].setY(-3 - beat);
        wings[1].setY(3 + beat);
      }
    }
  },

  destroy() {
    racers = [];
    rows = [];
    ticketBtns = [];
    ticketLabel = null;
    birdArt = null;
    banner = null;
    sub = null;
    goBtn = null;
    keys = [];
    sceneRef = null;
    apiRef = null;
  },
};

// ------------------------------------------------------------------ the card

/**
 * ONE FROG, ONE TICK.  The only arithmetic that moves anything.
 *
 * The live race and the headless sampler both call this, which is the whole
 * reason it exists: the odds the machine advertises have to be the odds of the
 * race with the potholes and the bird in it, not of a clean one.
 *
 * Returns true if this frog landed on this tick, which is when a slip can
 * happen and when a pothole gets tested — a frog in the air is committed.
 */
function step(r: Run, dt: number): void {
  if (r.going === 'taken') return;

  if (r.going !== 'run') {
    // In a hole or on its face.  The clock runs; nothing else does.
    r.stuck -= dt;
    if (r.stuck <= 0) {
      r.going = 'run';
      r.hop = 0;
    }
    return;
  }

  const t = r.x / DIST;
  const surging = t > r.surgeAt && t < r.surgeAt + r.surgeFor;
  const speed = Math.max(4, pace(r, t, surging, dt));
  r.x = Math.min(DIST, r.x + speed * dt);

  // The hop.  It is a real cycle rather than a bob: the frog is off the ground
  // for most of it and touches down at the end, and touching down is the only
  // moment anything can go wrong.
  const was = r.hop;
  r.hop += dt / HOP_S;
  const landed = r.hop >= 1;
  if (landed) r.hop -= Math.floor(r.hop);
  r.lift = Math.sin(r.hop * Math.PI) * HOP_H;

  if (!landed && was <= 1) {
    // A POTHOLE IS TESTED ON THE WAY IN, not on landing: a frog reaching one
    // either clears it in the air or comes down in it, and the coin is flipped
    // at the lip so the player sees the result rather than the decision.
    while (r.holeAt < r.holes.length && t >= r.holes[r.holeAt]) {
      r.holeAt++;
      if (Math.random() < 0.5) {
        r.going = 'hole';
        r.stuck = HOLE_S;
        r.lift = 0;
        // and it loses the ground it was over when it went in
        r.x = Math.max(0, r.x - HOLE_BACK);
        return;
      }
    }
    return;
  }

  // Landed clean.  Unless it does not.
  if (Math.random() < SLIP_CHANCE) {
    r.going = 'slip';
    r.stuck = SLIP_S;
    r.lift = 0;
  }
}

/** A bird, or not.  One per race, timed before the gun like everything else. */
function makeBird(): Bird {
  // A bird that is not coming is one that has already finished: phase 3.
  if (Math.random() > BIRD_CHANCE) {
    return { at: 0, target: -1, phase: 3, t: 0, x: 0, y: 0 };
  }
  return {
    at: BIRD_FROM + Math.random() * (BIRD_TO - BIRD_FROM),
    target: -1,
    phase: 0,
    t: 0,
    x: 0,
    y: 0,
  };
}

/**
 * The bird's own clock, and the one thing in the race that removes a runner.
 *
 * It picks from whoever is STILL RUNNING when it arrives -- not before -- so
 * it cannot be predicted from the card and cannot take a frog that is already
 * out of it.  `runs` is indexed by colour, the same as everything else.
 */
function stepBird(b: Bird, runs: Run[], raceT: number, dt: number): void {
  if (b.phase === 3) return;
  if (b.phase === 0) {
    if (raceT < b.at * RACE_S) return;
    const live = runs.filter((r) => r.going !== 'taken' && r.x < DIST);
    if (!live.length) {
      b.phase = 3;
      return;
    }
    b.target = live[Math.floor(Math.random() * live.length)].i;
    b.phase = 1;
    b.t = 0;
    return;
  }
  const victim = runs.find((r) => r.i === b.target);
  if (!victim) {
    b.phase = 3;
    return;
  }
  b.t += dt;
  if (b.phase === 1) {
    b.x = victim.x;
    b.y = -26 + (b.t / BIRD_DIVE_S) * 26;
    if (b.t >= BIRD_DIVE_S) {
      victim.going = 'taken';
      b.phase = 2;
      b.t = 0;
    }
    return;
  }
  // Carrying it off: up and forward, and the frog goes with it.
  const k = b.t / BIRD_AWAY_S;
  b.y = -k * 46;
  b.x = victim.x + k * 30;
  victim.lift = -b.y;
  if (b.t >= BIRD_AWAY_S) b.phase = 3;
}

/** Potholes for one lane: a few, spread, never two on top of each other. */
function digHoles(): number[] {
  const out: number[] = [];
  for (let i = 0; i < HOLES_PER_LANE; i++) {
    const band = (HOLE_TO - HOLE_FROM) / HOLES_PER_LANE;
    out.push(HOLE_FROM + band * (i + 0.2 + Math.random() * 0.6));
  }
  return out;
}

/** A fresh field: seven forms, shuffled onto the seven colours. */
function makeField(): Array<{ i: number; form: number; luck: number; surgeAt: number; surgeFor: number; holes: number[] }> {
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
    holes: digHoles(),
  }));
}

/** A field turned into runnable state, for the race or for the sampler. */
function toRuns(
  field: Array<{ i: number; form: number; luck: number; surgeAt: number; surgeFor: number; holes: number[] }>,
): Run[] {
  return field.map((f) => ({
    i: f.i,
    form: f.form,
    luck: f.luck,
    drift: 0,
    x: 0,
    surgeAt: f.surgeAt,
    surgeFor: f.surgeFor,
    hop: Math.random(),
    going: 'run' as Going,
    stuck: 0,
    holes: f.holes,
    holeAt: 0,
    lift: 0,
  }));
}

/**
 * Who has won, given where everybody is.
 *
 * First past the post if anybody is; otherwise, at the cap, whoever is
 * furthest up the track.  A frog the bird took is not in either answer -- it
 * is not in the race any more.
 */
function settleField(runs: Run[]): number {
  const live = runs.filter((r) => r.going !== 'taken');
  const home = live.filter((r) => r.x >= DIST);
  const pool = home.length ? home : live;
  if (!pool.length) return runs[0].i;
  return pool.reduce((a, b) => (b.x > a.x ? b : a)).i;
}

/**
 * Run a field to the line with no drawing, and say who won.
 *
 * The SAME `step` and `stepBird` the watched race uses, on the same twelve
 * second clock: potholes, slips, the bird and all.  Anything less and the
 * sampler is measuring a race nobody gets to bet on.
 */
function simulate(
  field: Array<{ i: number; form: number; luck: number; surgeAt: number; surgeFor: number; holes: number[] }>,
): number {
  const runs = toRuns(field);
  const bird = makeBird();
  const dt = 1 / 60;
  let t = 0;
  while (t < RACE_S) {
    t += dt;
    for (const r of runs) step(r, dt);
    stepBird(bird, runs, t, dt);
    const home = runs.filter((r) => r.going !== 'taken' && r.x >= DIST);
    if (home.length) return settleField(runs);
  }
  return settleField(runs);
}

function draft(scene: Phaser.Scene): void {
  const field = makeField();
  racers = toRuns(field).map((r) => ({ ...r, body: makeFrog(scene, RUNNERS[r.i].colour) }));
  racers.sort((a, b) => a.i - b.i);
  bird = makeBird();
  birdArt = makeBird4(scene);

  // The potholes, dug where the model says they are.  Drawn UNDER the frogs
  // and over the lane, so a frog in one is visibly down in it.
  for (const r of racers) {
    const y = LANE_T + r.i * LANE_H + 7;
    for (const h of r.holes) {
      const hx = START_X + h * DIST;
      scene.add.ellipse(hx, y + 2, 11, 5, 0x0a1a10).setDepth(6);
      scene.add.ellipse(hx, y + 1, 11, 4, 0x061009).setDepth(7);
      scene.add.ellipse(hx - 1, y + 3, 7, 2, 0x1c3a26).setDepth(8).setAlpha(0.7);
    }
  }

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

/**
 * The bird.  Four shapes and a wing beat -- it is on screen for under two
 * seconds and it only has to read as "something came down and took one".
 */
function makeBird4(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const body = scene.add.ellipse(0, 0, 13, 6, 0x4a4a58);
  const head = scene.add.circle(6, -2, 3, 0x4a4a58);
  const beak = scene.add.triangle(10, -1, 0, 0, 5, 2, 0, 4, 0xffb45e);
  const wingL = scene.add.ellipse(-1, -3, 12, 4, 0x6a6a7c);
  const wingR = scene.add.ellipse(-1, 3, 12, 4, 0x3a3a48);
  const eye = scene.add.circle(7, -3, 1, PALETTE.black);
  const c = scene.add.container(0, 0, [wingR, body, head, beak, eye, wingL]).setDepth(40);
  c.setVisible(false);
  c.setData('wings', [wingL, wingR]);
  return c;
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

/**
 * How many tickets are on this race.
 *
 * The ceiling is one plus whatever else the pocket can cover, because the
 * first ticket is already paid for -- the shell debited it before the game
 * existed.  A player who cannot afford a second simply never sees the counter
 * move, which is a clearer no than a button that works and then fails.
 */
function maxTickets(): number {
  const spare = apiRef ? Math.floor(apiRef.balance() / TICKET) : 0;
  return Math.max(1, 1 + spare);
}

function setTickets(n: number): void {
  if (phase !== 'betting') return;
  const want = Phaser.Math.Clamp(Math.round(n), 1, maxTickets());
  if (want !== tickets) audio.sfx('ui_blip', 0.5);
  tickets = want;
  const cap = maxTickets();
  ticketLabel?.setText(`${tickets} x ${TICKET} = ${tickets * TICKET}`);
  ticketBtns[0]?.label.setTint(tickets > 1 ? PALETTE.cream : PALETTE.ash);
  ticketBtns[1]?.label.setTint(tickets < cap ? PALETTE.cream : PALETTE.ash);
  refresh();
}

function setGoEnabled(on: boolean): void {
  goBtn?.box.setFillStyle(on ? PALETTE.tealDark : PALETTE.slate);
  goBtn?.label.setTint(on ? PALETTE.cream : PALETTE.ash);
}

function startRace(): void {
  if (phase !== 'betting' || pick < 0) return;
  // The extra tickets are bought HERE, at the gun, and not a moment before:
  // until the race starts there is nothing to have bought.  If the raise
  // cannot be covered the stake drops to what the pocket holds rather than
  // refusing the race -- the player has already paid for one.
  const extra = (tickets - 1) * TICKET;
  if (extra > 0 && !(apiRef?.raise(extra) ?? false)) {
    tickets = 1;
    setTickets(1);
  }
  phase = 'countdown';
  countdown = 2100;
  raceT = 0;
  goBtn?.box.setVisible(false).disableInteractive();
  goBtn?.label.setVisible(false);
  for (const b of ticketBtns) {
    b.box.setVisible(false).disableInteractive();
    b.label.setVisible(false);
  }
  ticketLabel?.setVisible(false);
  sub?.setText(`${tickets} ON ${RUNNERS[pick].name}`);
  audio.sfx('coin_drop', 0.5);
  refresh();
}

function settle(): void {
  if (phase === 'result') return;
  phase = 'result';
  const won = winner === pick;
  const pays = tickets * TICKET_PAYS;
  const mine = racers.find((r) => r.i === pick);
  banner?.setText(won ? `${RUNNERS[winner].name} WINS - YOU WIN` : `${RUNNERS[winner].name} WINS`);
  banner?.setTint(won ? PALETTE.gold : PALETTE.blood);
  // A frog the bird took did not lose the race; it was removed from it, and
  // the result card should say which of those happened.
  sub?.setText(
    won
      ? `PAYS ${pays} TOKENS`
      : mine?.going === 'taken'
        ? `A BIRD TOOK ${RUNNERS[pick].name}`
        : `YOU WERE ON ${RUNNERS[pick].name}`,
  );
  sub?.setTint(won ? PALETTE.mossLight : PALETTE.ash);
  refresh();
  audio.sfx(won ? 'chime' : 'buzzer');
  if (won && sceneRef) sceneRef.cameras.main.flash(220, 255, 240, 180);
  store.setHighScore(ID, won ? 1 : 0);
  over = true;
  // MG-3: the shell pays, once.  A race is one decision and one result, so
  // there is nothing here to pay twice.
  sceneRef?.time.delayedCall(1800, () => (won ? apiRef?.win(pays) : apiRef?.lose()));
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
