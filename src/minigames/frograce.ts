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
 * on the ground at any moment, and the arc is what you actually watch.  On top
 * of that, seven things can go wrong, and NONE of them happens every race —
 * each is rolled independently per field, so two cards running never look the
 * same:
 *
 *   POTHOLES  dug in the track.  A frog arriving at one either clears it or
 *             goes in — a straight coin flip — and a fall costs it most of a
 *             second of scrabbling.
 *   SLIPS     on landing: it sprawls and loses a beat.
 *   THE BIRD  comes down mid-race and carries one off in its BEAK — held in
 *             it, not floating under it — and then DROPS IT BACK on the track
 *             to pick itself up and run the rest.  It is out of the race while
 *             it is up there, not out of the race for good.
 *   NAPS      in the last stretch, when a frog that has been going all race
 *             simply sits down and sleeps until something wakes it.
 *   SHOVES    from a frog drawing level with its neighbour: the neighbour goes
 *             over, and gets up again.  Nobody is eliminated by one.
 *   BALLOONS  rare, and a frog that gets one is lifted clean off the lane —
 *             still travelling, more slowly, until it comes back down.
 *   THE FLY   crosses the track and some of them go for it, tongue out, which
 *             costs them speed for as long as they are looking at it.
 *
 * NONE OF IT COSTS YOU THE RACE, AND NONE OF IT HIDES THE RACE.  Every one of
 * them costs seconds and nothing else — the bird used to take a frog out for
 * good, which killed the bet the moment the shadow arrived, and does not any
 * more.  And a frog under a balloon or up in a beak is still drawn at its own
 * place on the track, so who is ahead never stops having an answer you can
 * read off the screen.
 *
 * EVERY ONE OF THOSE IS IN THE SAMPLER TOO.  `step` is the only arithmetic
 * that moves a frog, and both the race the player watches and the headless
 * odds sampler call it — because a sampler that measures a cleaner race than
 * the one being played is measuring a game nobody plays.
 *
 * THE RACE IS TWENTY SECONDS, ALWAYS.  Long enough for two setbacks and a
 * recovery, and if nobody is home when the clock runs out it is won by whoever
 * is furthest up the track.
 *
 * TEN A TICKET, AND AS MANY TICKETS AS THE POCKET WILL TAKE.  The shell debits
 * the first one at the door; the rest go through `api.raise` before the gun,
 * and the win pays twenty a ticket through `api.win`.  The betting and the
 * race know nothing about each other: the race is twenty seconds of frogs
 * whatever is riding on it.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'frograce' as const;

/** The field.  Seven colours, seven names, and they never change. */
const RUNNERS: Array<{ name: string; colour: number }> = [
  { name: 'GREEN', colour: 0x5fbf5a },
  { name: 'GOLD', colour: 0xffd45e },
  // { name: 'RED', colour: 0xd8443c },
  // { name: 'BLUE', colour: 0x46a0e0 },
  { name: 'PINK', colour: 0xff6fb0 },
  // { name: 'TEAL', colour: 0x46c4bd },
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
 * BASE IS SET BY THE CLOCK, NOT BY TASTE.  The race is twenty seconds; at 15 a
 * clean field was home in under twelve and the cap never came into it, which
 * made the twenty seconds a number in a comment.  The whole set below is the
 * old twelve-second one scaled by the ratio of the two clocks, so the pace
 * comes off without changing the shape of the race.  Measured over six hundred
 * fields: the winner is home at around seventeen and about one race in fifteen
 * is still running at twenty and settled on distance — which is what a nap, a
 * shove and a pothole in the same race are supposed to cost.
 *
 * SPREAD IS THE ONE THAT DID NOT SCALE.  Straight scaling left the favourite on
 * 32%, close enough to the sampler's floor to trip it on a bad draw; the longer
 * clock gives the chaos more room, so the form has to be worth more to stay
 * readable.  At 5.6 the favourite takes 37% and every colour still wins.
 */
const BASE = 8.9;
const SPREAD = 5.6;
const WOBBLE = 7;
/** Held for the whole race: uniform over ±LUCK. */
const LUCK = 4.5;
/** The slow walk: how hard it is kicked per second, how fast it is pulled back, and its ceiling. */
const DRIFT_KICK = 17;
const DRIFT_PULL = 1.6;
const DRIFT_MAX = 5.8;
/** Every frog gets one, somewhere in the middle third. */
const SURGE = 10;

/**
 * THE RACE IS TWENTY SECONDS.  BASE is set so a clean run is home at about
 * eighteen, which leaves room for a fall, a slip and a nap inside the cap.
 * Anyone still running at twenty is settled on distance.
 */
const RACE_S = 20;
/** One hop: how long it takes, and how high it goes in pixels. */
const HOP_S = 0.34;
/**
 * How far off the lane a hop takes a frog.
 *
 * Five was a bob: at fifteen pixels of lane it read as a frog running with a
 * limp.  Nine is most of a body clear of the track at the top of the arc,
 * which is what a frog does -- it is airborne for most of its stride and the
 * running is the exception.
 */
const HOP_H = 9;
/**
 * THE HOP IS THE MOTION, NOT A BOB ON TOP OF IT.
 *
 * A frog used to travel at a constant rate with a sine wave laid over its
 * height, which is a hovercraft with a nodding animation: the feet never had a
 * moment on the ground and nothing ever pushed off. Now the cycle has a ground
 * phase and an air phase, and the frog only really travels in the air.
 *
 * `hop` runs 0..1 and wraps. TAKEOFF..LAND is the airborne slice of it; the
 * rest is the frog gathering itself, which is where the compress lives.
 *
 * `GROUND_RATE` is what a gathering frog still creeps forward at, as a
 * multiple of its own pace, and `AIR_RATE` is solved from it so the pair
 * INTEGRATE TO EXACTLY 1 OVER A CYCLE. That is the whole trick: a frog covers
 * precisely the ground per second that `pace` says it does, so the race is the
 * same race and the odds on the rim are still the odds. Only the look changed.
 */
const TAKEOFF = 0.2;
const LAND = 0.88;
const GROUND_RATE = 0.12;
const AIR_RATE = (1 - GROUND_RATE * (1 - (LAND - TAKEOFF))) / (LAND - TAKEOFF);

/** Where in its cycle a frog is travelling, as a multiple of its average pace. */
function hopRate(u: number): number {
  return u >= TAKEOFF && u < LAND ? AIR_RATE : GROUND_RATE;
}

/** Height off the lane. Ballistic while airborne, flat on the ground. */
function hopLift(u: number): number {
  if (u < TAKEOFF || u >= LAND) return 0;
  const a = (u - TAKEOFF) / (LAND - TAKEOFF);
  return HOP_H * 4 * a * (1 - a);
}

/**
 * The gate's MEAN value across one tick of the cycle, integrated exactly
 * rather than sampled at an end point.
 *
 * Sampling would make the distance covered depend on where the frame boundaries
 * happened to fall — a frog whose tick began one pixel before take-off would be
 * charged a whole tick of standing still — and the sampler runs at a fixed
 * 1/60 while the race runs at whatever the browser gives it.  Two different
 * frame rates have to produce the same race or the odds on the rim are a lie.
 */
function hopTravel(u0: number, du: number): number {
  if (du <= 0) return hopRate(u0 % 1);
  let acc = 0;
  let u = u0;
  let left = du;
  while (left > 1e-9) {
    const p = u % 1;
    const next = p < TAKEOFF ? TAKEOFF : p < LAND ? LAND : 1;
    const span = Math.min(left, next - p);
    acc += hopRate(p) * span;
    u += span;
    left -= span;
  }
  return acc / du;
}

/**
 * How a hopping frog is squashed, stretched and tilted at this point in its
 * cycle.  Drawing only — nothing here moves a frog up the track.
 *
 * It compresses on touchdown, absorbs, coils, then leaves the ground stretched
 * out, tucks at the top of the arc and comes down stretched again.  The tilt
 * follows the arc: nose up off the ground, level at the top, nose down coming
 * in.
 */
const FOOT = 4; // where a frog's feet are, in its own drawing
function hopPose(u: number): { sx: number; sy: number; rot: number } {
  if (u >= TAKEOFF && u < LAND) {
    const a = (u - TAKEOFF) / (LAND - TAKEOFF);
    const v = 1 - 2 * a; // +1 leaving the ground, 0 at the top, -1 coming down
    const rise = Math.abs(v);
    return { sx: 1 - 0.13 * rise, sy: 1 + 0.2 * rise, rot: -0.3 * v };
  }
  const groundSpan = 1 - LAND + TAKEOFF;
  const gp = (u >= LAND ? u - LAND : u + 1 - LAND) / groundSpan;
  // 0.66 flat on impact, up to 0.88 as it absorbs, back to 0.74 as it coils
  const sy = gp < 0.45 ? 0.66 + (0.22 * gp) / 0.45 : 0.88 - (0.14 * (gp - 0.45)) / 0.55;
  return { sx: 1 + (1 - sy) * 0.85, sy, rot: -0.12 * gp };
}
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
/**
 * How far up the track the bird carries it, in pixels.
 *
 * IT HAS TO BE A LOSS.  At 34 the carry put the frog further up the track than
 * the three and a quarter seconds it spends out of the race would have taken
 * it, so being caught by the bird was the best thing that could happen to a
 * frog.  Twelve is a shove forward that still leaves it about two seconds down
 * on the field, which is what a hazard is.
 */
const BIRD_CARRY = 12;
const BIRD_DIVE_S = 0.55;
const BIRD_AWAY_S = 1.6;
/**
 * WHERE THE BEAK IS, inside the bird's own drawing.
 *
 * The frog it has taken is drawn AT this point rather than at its own place on
 * the track, which is the whole of the fix: the bird flies on while it carries
 * one, and a frog left at its own x is a frog hanging in the air under a bird
 * that has gone without it.  Kept beside the drawing it belongs to, so moving
 * the beak moves what is in it.
 */
const BEAK = { x: 12, y: 2 };
/**
 * ---- THE THINGS THAT HAPPEN TO FROGS, and how often.
 *
 * None of them fires in every race and none of them fires for every frog.  The
 * card is seven ratings and the race is twenty seconds of those ratings being
 * interfered with, so what the player is actually betting on is a frog's form
 * surviving whatever the track does to it.  Every one of these is rolled per
 * race and per frog, so two races of the same field do not look alike.
 */

/** A frog nods off in the last stretch.  Late, so it costs a lead. */
const SLEEP_CHANCE = 0.3;
const SLEEP_FROM = 0.6;
const SLEEP_S = 1.9;

/**
 * Shoving.  A frog leans into the lane beside it and puts its neighbour over.
 *
 * It only reaches a frog it is actually ALONGSIDE -- within half a body up the
 * track -- so what the player sees is two frogs level and one of them going
 * down, rather than a frog being knocked over by somebody it has never been
 * near.  Each frog gets at most one go, which is what stops the back of the
 * field being flattened by the front of it.
 */
const SHOVE_CHANCE = 0.45;
const SHOVE_FROM = 0.2;
const SHOVE_TO = 0.85;
const SHOVE_REACH = 7;
const SHOVE_LEAN = 5;
const SHOVE_LEAN_S = 0.5;
/** And what it costs the frog that goes over. */
const DOWN_S = 1.0;

/** A balloon, which is the rarest thing on this track. */
const BALLOON_CHANCE = 0.16;
const BALLOON_FROM = 0.25;
const BALLOON_TO = 0.7;
const BALLOON_S = 2.6;
const BALLOON_H = 22;
/**
 * What floating does to a frog's pace: it drifts on rather than hopping, which
 * is slower than a good frog and faster than a bad one.  A balloon is luck,
 * not a win.
 */
const BALLOON_PACE = 0.72;

/** The fly, and the frogs that cannot leave it alone. */
const FLY_CHANCE = 0.45;
const FLY_FROM = 0.15;
const FLY_TO = 0.75;
const FLY_S = 2.4;
/** The chance ONE frog takes a go at it as the fly passes its lane. */
const FLY_NOTICE = 0.4;
const TONGUE_S = 0.6;
/** How far the lick goes, in pixels.  A frog is about ten across. */
const TONGUE_REACH = 26;

/**
 * ---- THE JETPACK.  The comeback, and the one thing on this track the card
 * does not hint at and the tutorial does not mention.
 *
 * In the last stretch of the race -- the final two seconds of it, whether
 * those are the last two before the cap or the last two before the leader
 * crosses -- whoever is dead last may light a jetpack and come up the track at
 * it.  It is rolled before the gun like everything else, so most races do not
 * have one.
 *
 * IT DOES NOT MOVE THE CLOCK.  The burn is sized from the ground the frog has
 * left and the time the race has left, so a lit jetpack always puts its frog
 * on the line INSIDE the existing race -- and never after it.  What it does
 * not guarantee is the win: it is aimed at the leader's projected arrival, and
 * the leader is a frog with wobble and drift and a pothole in front of it, so
 * the projection is a guess and the finish is a race.
 */
const JET_CHANCE = 0.3;
/** How much of the end of the race counts as the last stretch, in seconds. */
const JET_WINDOW_S = 2;
/**
 * Where it aims, as a fraction of the time the race has left when it lights.
 *
 * IT STRADDLES THE LEADER.  Sized entirely under 1 the burn beat the leader's
 * projection every time and the comeback won 95% of the races it appeared in,
 * which is not a comeback, it is an announcement -- and it took five points
 * off the favourite in the sampler.  Straddling means some burns are aimed
 * past the leader and get there second, and a frog that flew and lost is the
 * point of the thing.  Either way the burn is sized inside the clock, so it is
 * never a jetpack that runs out in the middle of the track.
 */
const JET_AIM = { min: 0.82, max: 1.16 };
/** The burn will not be lit for a frog that would need to be fired up the track faster than this. */
const JET_MAX_SPEED = 120;
/** How high off the lane it flies, and how long it takes to get up there. */
const JET_LIFT = 7;
const JET_RISE_S = 0.25;

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
type Going = 'run' | 'hole' | 'slip' | 'taken' | 'sleep' | 'down' | 'tongue';

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
  /** Seconds left of floating under a balloon, and when it goes up. */
  balloon: number;
  balloonAt: number;
  /** When it nods off, if it does at all.  -1 is a frog that stays awake. */
  sleepAt: number;
  /** When it tries to put a neighbour over, and whether it still has its go. */
  shoveAt: number;
  shoved: boolean;
  /** Seconds left leaning sideways into the shove.  Drawing only. */
  lean: number;
  /** How far through a lick at the fly it is, 0..1, and which way. */
  tongue: number;
  /** Seconds of jetpack left, and the pace it was sized to fly at. */
  jet: number;
  jetSpeed: number;
}

interface Racer extends Run {
  body: Phaser.GameObjects.Container;
}

/**
 * THE FLY.  One per race at most, and it is not a hazard -- it is a
 * temptation.  It crosses the lanes and whichever frogs happen to notice it
 * stop racing for half a second to have a go at it with their tongue.
 */
interface Fly {
  /** When it comes, as a fraction of RACE_S.  -1 for a race without one. */
  at: number;
  /** Alive while it is on screen, and where it is in track/lane space. */
  on: boolean;
  t: number;
  x: number;
  lane: number;
  /** Which frogs have already had their go, so nobody licks twice. */
  tried: number[];
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

/**
 * The race's one jetpack.  `armed` is a race that has one going spare;
 * `who` is the colour wearing it once it has been lit, and -1 before that.
 */
interface Jet {
  armed: boolean;
  who: number;
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
let fly: Fly = makeFly();
let flyArt: Phaser.GameObjects.Container | null = null;
let jet: Jet = makeJet();
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
      'POTHOLES, NAPS, SHOVES, BALLOONS AND A BIRD.',
      'FIRST TO THE TAPE WINS IT. AT TWENTY',
      'SECONDS, WHOEVER IS FURTHEST UP TAKES IT.',
      'YOUR FROG LOSES, THE TICKET IS GONE.',
      '10 A TICKET, 20 BACK ON EACH.',
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
            // `balloon` is not a `going` -- a frog under one is still running --
            // so a harness that only reads `going` cannot see it at all.
            .map((r) => ({
              name: RUNNERS[r.i].name,
              form: Math.round(r.form * 100),
              x: Math.round(r.x),
              going: r.going,
              balloon: r.balloon > 0,
            }))
            .sort((a, b) => b.form - a.form),
          // `destroy` empties the field, and a bridge that throws once the game
          // is over is a bridge that cannot be used to check how it ended.
          favourite: racers.length ? racers.reduce((a, b) => (b.form > a.form ? b : a)).i : -1,
        }),
        /** Height off the lane for every frog, so a harness can see the hop. */
        lifts: () => racers.map((r) => r.lift),
        /** The comeback as it stands in this race: armed, lit, and who is flying. */
        jet: () => ({
          armed: jet.armed,
          who: jet.who,
          flying: racers.filter((r) => r.jet > 0).map((r) => RUNNERS[r.i].name),
        }),
        jetWindow: JET_WINDOW_S,
        /**
         * Light it now, through the real path: the window is handed to the
         * same code the race runs, so what a harness sees is the mechanic and
         * not a second copy of it.
         */
        lightJet: () => {
          jet.armed = true;
          jet.who = -1;
          stepJet(jet, racers, RACE_S - JET_WINDOW_S, 0);
          return jet.who;
        },
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
            const f = makeFly();
            const jt = makeJet();
            const dt = 1 / 60;
            let t = 0;
            let done = 0;
            let grabbed = false;
            while (t < RACE_S) {
              t += dt;
              for (const r of runs) step(r, dt, runs, t);
              stepBird(b, runs, t, dt);
              stepFly(f, runs, t, dt);
              stepJet(jt, runs, t, dt);
              // The bird PUTS THEM BACK, so `taken` is a state that comes and
              // goes: reading it at the line would say the bird never came.
              if (runs.some((r) => r.going === 'taken')) grabbed = true;
              if (runs.some((r) => r.going !== 'taken' && r.x >= DIST)) {
                done = t;
                break;
              }
            }
            if (!done) capped++;
            total += done || RACE_S;
            if (grabbed) taken++;
          }
          return { meanSeconds: total / n, birdTook: taken / n, hitTheCap: capped / n };
        },
        /**
         * THE COMEBACK, MEASURED.  How often a jetpack is lit, whether the
         * burn fits inside the twenty seconds, whether its frog really was
         * last when it went up, and how often it takes the race.
         */
        comeback: (n: number) => {
          let lit = 0;
          let inTheClock = 0;
          let fromLast = 0;
          let reached = 0;
          let won = 0;
          let fired = 0;
          let late = 0;
          for (let k = 0; k < n; k++) {
            const runs = toRuns(makeField());
            const b = makeBird();
            const f = makeFly();
            const jt = makeJet();
            const dt = 1 / 60;
            let t = 0;
            let hero: Run | null = null;
            let at = 0;
            let burn = 0;
            let behind = 0;
            let endAt = RACE_S;
            while (t < RACE_S) {
              t += dt;
              for (const r of runs) step(r, dt, runs, t);
              stepBird(b, runs, t, dt);
              stepFly(f, runs, t, dt);
              const before = jt.who;
              stepJet(jt, runs, t, dt);
              if (jt.who >= 0 && before < 0) {
                hero = runs.find((r) => r.i === jt.who) ?? null;
                at = t;
                burn = hero ? hero.jet : 0;
                behind = hero ? runs.filter((r) => r.going !== 'taken' && r.x > hero!.x).length : 0;
              }
              if (runs.some((r) => r.going !== 'taken' && r.x >= DIST)) {
                endAt = t;
                break;
              }
            }
            if (!hero) continue;
            lit++;
            fired += at;
            if (at + burn <= RACE_S) inTheClock++;
            // Last of everybody still in the race when the burn went up.
            if (behind === runs.filter((r) => r.going !== 'taken').length - 1) fromLast++;
            if (hero.x >= DIST) reached++;
            if (settleField(runs) === hero.i) won++;
            if (endAt - at <= JET_WINDOW_S + 1e-6) late++;
          }
          return {
            races: n,
            lit: lit / n,
            inTheClock: lit ? inTheClock / lit : 0,
            fromLast: lit ? fromLast / lit : 0,
            reachedTheLine: lit ? reached / lit : 0,
            won: lit ? won / lit : 0,
            insideTheWindow: lit ? late / lit : 0,
            meanFiredAt: lit ? fired / lit : 0,
          };
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
      for (const r of racers) step(r, dt, racers, raceT);
      stepBird(bird, racers, raceT, dt);
      stepFly(fly, racers, raceT, dt);
      const wasLit = jet.who;
      stepJet(jet, racers, raceT, dt);
      if (jet.who >= 0 && wasLit < 0) audio.sfx('throw_whoosh', 0.75);
      if (bird.phase === 1 && bird.t <= dt) audio.sfx('throw_whoosh', 0.5);

      const home = racers.filter((r) => r.going !== 'taken' && r.x >= DIST);
      // First past the post, or -- at twenty seconds -- whoever is furthest.
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
      body.setVisible(true);
      // Down in a hole: sunk, and shuffling.  On its face: flat and sprawled.
      if (r.going === 'hole') {
        body.setScale(1, 0.45);
        body.setRotation(0);
        body.y = laneY + 3 + Math.sin(clock / 60) * 0.6;
      } else if (r.going === 'slip') {
        body.setScale(1.25, 0.5);
        body.setRotation(0.5);
        body.y = laneY + 2;
      } else if (r.going === 'taken') {
        // ---- HELD IN THE BEAK, and held THERE.
        //
        // The frog used to be drawn at its own x while the bird flew on ahead
        // of it, so what the player saw was a frog hanging in the air under a
        // bird that had left without it.  While the bird has it, the frog is
        // drawn at the beak: the bird's position plus the beak's own offset
        // inside its drawing, and nothing else decides where it is.
        body.setPosition(START_X + bird.x + BEAK.x, laneY + bird.y + BEAK.y);
        body.setScale(0.95, 1.1);
        body.setRotation(Math.sin(clock / 90) * 0.35);
      } else if (r.going === 'sleep') {
        // ---- ASLEEP.  Sat down, breathing, with a Z coming off it.
        const breath = Math.sin(clock / 220);
        body.setScale(1.1 + breath * 0.05, 0.72 - breath * 0.04);
        body.setRotation(0.1);
        body.y = laneY + 2;
      } else if (r.going === 'down') {
        // ---- PUT OVER.  On its side, and getting up again at the end of it.
        const up = 1 - Phaser.Math.Clamp(r.stuck / DOWN_S, 0, 1);
        body.setScale(1.3 - up * 0.3, 0.45 + up * 0.55);
        body.setRotation(-0.8 + up * 0.8);
        body.y = laneY + 3 - up * 3;
      } else if (r.going === 'tongue') {
        // ---- AFTER THE FLY.  Up on its back legs, leaning at it.
        body.setScale(0.92, 1.12);
        body.setRotation(-0.18);
        body.y = laneY - 1;
      } else if (r.jet > 0) {
        // ---- ON THE JETPACK.  Flat out, nose up, and shaking with it.
        body.setScale(1.18, 0.88);
        body.setRotation(-0.22 + Math.sin(clock / 30) * 0.05);
        body.y = laneY - r.lift;
      } else if (r.balloon > 0) {
        // ---- UNDER A BALLOON.  Hanging, and swinging a little.
        body.setScale(0.95, 1.05);
        body.setRotation(Math.sin(clock / 260) * 0.2);
        body.y = laneY - r.lift;
      } else {
        // Compressed on the lane, stretched off it, tucked at the top.  The
        // feet are pinned as it squashes — a frog that shrinks about its middle
        // sinks into the track instead of flattening onto it.
        const p = hopPose(r.hop);
        body.setScale(p.sx, p.sy);
        // A frog mid-shove leans into the lane it is shoving at.
        body.setRotation(p.rot + (r.lean > 0 ? 0.35 : 0));
        body.y = laneY - r.lift + FOOT * (1 - p.sy);
        if (r.lean > 0) body.x += Math.sin((r.lean / SHOVE_LEAN_S) * Math.PI) * SHOVE_LEAN * 0.4;
      }

      // ---- THE EXTRAS, which are only ever on one frog at a time.
      const zzz = body.getData('zzz') as Phaser.GameObjects.BitmapText | undefined;
      if (zzz) {
        zzz.setVisible(r.going === 'sleep');
        if (r.going === 'sleep') zzz.setY(-10 - ((clock / 90) % 6));
      }
      const balloon = body.getData('balloon') as Phaser.GameObjects.Container | undefined;
      if (balloon) balloon.setVisible(r.balloon > 0);
      const pack = body.getData('jet') as Phaser.GameObjects.Container | undefined;
      if (pack) {
        pack.setVisible(r.jet > 0);
        if (r.jet > 0) {
          // The flame guttering, so the burn reads as a burn rather than a
          // triangle glued to a frog.
          const lick = 0.7 + Math.abs(Math.sin(clock / 40)) * 0.8;
          (body.getData('flame') as Phaser.GameObjects.Triangle).setScale(lick, 1);
          (body.getData('ember') as Phaser.GameObjects.Triangle).setScale(lick * 1.2, 1);
        }
      }
      const tongue = body.getData('tongue') as Phaser.GameObjects.Rectangle | undefined;
      if (tongue) {
        tongue.setVisible(r.going === 'tongue');
        if (r.going === 'tongue') {
          // Two and a half frog-lengths of it.  At sixteen the lick was a pink
          // pixel on a ten pixel frog and you had to be told it had happened.
          const reach = r.tongue * TONGUE_REACH;
          tongue.setSize(Math.max(1, reach), 2);
          tongue.setPosition(4 + reach / 2, -2);
        }
      }
    }

    // ---- the fly, wandering across the lanes
    if (flyArt) {
      flyArt.setVisible(fly.on);
      if (fly.on) {
        flyArt.setPosition(START_X + fly.x, LANE_T + fly.lane * LANE_H + 4);
        const w = flyArt.getData('wing') as Phaser.GameObjects.Rectangle;
        w.setScale(1, Math.sin(clock / 18) > 0 ? 1 : -1);
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
    flyArt = null;
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
function step(r: Run, dt: number, field?: Run[], raceT = 0): void {
  if (r.lean > 0) r.lean -= dt;
  if (r.going === 'taken') return;

  // ---- ON THE JETPACK.  Nothing on the track reaches a frog that is off it:
  // no hop, no pothole, no landing to slip on.  It flies the pace it was sized
  // to fly and it comes down when the burn is out.
  if (r.jet > 0) {
    r.jet -= dt;
    r.hop = (r.hop + dt * 3) % 1;
    r.lift = Math.min(JET_LIFT, r.lift + (JET_LIFT / JET_RISE_S) * dt);
    r.x = Math.min(DIST, r.x + r.jetSpeed * dt);
    if (r.jet <= 0 || r.x >= DIST) {
      r.jet = 0;
      r.lift = 0;
      r.hop = 0;
    }
    return;
  }

  if (r.going !== 'run') {
    // In a hole, on its face, asleep, or busy with a fly.  The clock runs;
    // nothing else does.
    r.stuck -= dt;
    if (r.going === 'tongue') {
      // Out and back inside the one beat, so the tongue is a lick rather than
      // a thing that hangs there.
      r.tongue = 1 - Math.abs(1 - (2 * (TONGUE_S - r.stuck)) / TONGUE_S);
    }
    if (r.stuck <= 0) {
      r.going = 'run';
      r.hop = 0;
      r.tongue = 0;
    }
    return;
  }

  const t = r.x / DIST;

  // ---- THE BALLOON.  It goes up when its moment comes and it carries the
  // frog on at its own steady drift; nothing else can happen to a frog that is
  // off the ground, which is most of why it is worth having.
  if (r.balloon > 0) {
    r.balloon -= dt;
    const k = Phaser.Math.Clamp(Math.min(r.balloon, BALLOON_S - r.balloon) / 0.5, 0, 1);
    r.lift = BALLOON_H * k;
    r.x = Math.min(DIST, r.x + BASE * BALLOON_PACE * dt);
    if (r.balloon <= 0) {
      r.lift = 0;
      r.hop = 0;
    }
    return;
  }
  if (r.balloonAt > 0 && t >= r.balloonAt) {
    r.balloonAt = -1;
    r.balloon = BALLOON_S;
    return;
  }

  // ---- NODDING OFF.  Late, and only for the frogs that drew it.
  if (r.sleepAt > 0 && t >= r.sleepAt) {
    r.sleepAt = -1;
    r.going = 'sleep';
    r.stuck = SLEEP_S;
    r.lift = 0;
    return;
  }

  // ---- AND PUTTING A NEIGHBOUR OVER.  One go each, and only at a frog it is
  // genuinely alongside: the shove reaches half a body up the track, so what
  // the player sees is two frogs level and one of them going down.
  if (!r.shoved && field && r.shoveAt > 0 && t >= r.shoveAt) {
    const mark = field.find(
      (o) =>
        o !== r &&
        Math.abs(o.i - r.i) === 1 &&
        o.going === 'run' &&
        o.balloon <= 0 &&
        Math.abs(o.x - r.x) < SHOVE_REACH,
    );
    if (mark) {
      r.shoved = true;
      r.lean = SHOVE_LEAN_S;
      mark.going = 'down';
      mark.stuck = DOWN_S;
      mark.lift = 0;
      mark.hop = 0;
    }
  }
  void raceT;

  const surging = t > r.surgeAt && t < r.surgeAt + r.surgeFor;
  const speed = Math.max(4, pace(r, t, surging, dt));

  // The hop.  It is a real cycle rather than a bob: the frog gathers itself on
  // the lane, pushes off, sails, and touches down — and touching down is the
  // only moment anything can go wrong.
  const was = r.hop;
  const du = dt / HOP_S;
  r.hop += du;
  const landed = r.hop >= 1;
  if (landed) r.hop -= Math.floor(r.hop);
  r.lift = hopLift(r.hop);

  // The ground it covers is the hop, gated.  `hopTravel` integrates the gate
  // across the tick rather than sampling it, so the distance is the same
  // whatever the frame rate and a tick that straddles the take-off is not
  // rounded into a free step or a lost one.
  r.x = Math.min(DIST, r.x + speed * dt * hopTravel(was, du));

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

/** A jetpack, or not.  Rolled before the gun, the same as the bird and the fly. */
function makeJet(): Jet {
  return { armed: Math.random() < JET_CHANCE, who: -1 };
}

/**
 * THE COMEBACK, and the arithmetic that keeps it inside the clock.
 *
 * Every tick it asks how long the race has left -- the smaller of the cap and
 * the leader's own run to the line at the pace its form says it runs -- and
 * does nothing until that is inside the last stretch.  Then it takes whoever
 * is genuinely last, sizes a burn that lands them on the line before the race
 * ends, and lights it.  One per race: it is spent whether it fires or not, so
 * a frog too far back to be got there honestly is a race without a comeback
 * rather than a jetpack that gets cheaper every tick.
 */
function stepJet(j: Jet, runs: Run[], raceT: number, dt: number): void {
  void dt;
  if (!j.armed) return;
  const live = runs.filter((r) => r.going !== 'taken' && r.x < DIST);
  if (live.length < 2) return;

  const leader = live.reduce((a, b) => (b.x > a.x ? b : a));
  const leaderPace = Math.max(4, BASE + leader.form * SPREAD + leader.luck);
  const endsIn = Math.min((DIST - leader.x) / leaderPace, RACE_S - raceT);
  if (endsIn > JET_WINDOW_S) return;

  // Spent from here, whichever way it goes.
  j.armed = false;

  const last = live.reduce((a, b) => (b.x < a.x ? b : a));
  if (last === leader) return;

  const aim = JET_AIM.min + Math.random() * (JET_AIM.max - JET_AIM.min);
  // Aimed past the leader or not, it has to be on the line before the cap.
  const burn = Phaser.Math.Clamp(endsIn * aim, 0.3, Math.max(0.3, RACE_S - raceT - 0.05));
  const need = (DIST - last.x) / burn;
  if (need > JET_MAX_SPEED) return;

  j.who = last.i;
  // The burn takes it out of whatever it was in -- a hole, a nap, its own face.
  last.going = 'run';
  last.stuck = 0;
  last.balloon = 0;
  last.balloonAt = -1;
  last.tongue = 0;
  last.jet = burn;
  last.jetSpeed = need;
  last.lift = 0;
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
  // ---- CARRYING IT OFF, and then thinking better of it.
  //
  // It used to be the one thing in the race that removed a runner for good: a
  // taken frog never came back and the bet on it was dead from the moment the
  // shadow arrived.  Now the bird gets bored of it -- it lifts, carries it up
  // the track and drops it, and the frog picks itself up and runs.  What the
  // bird costs is the seconds and the ground, which is a hazard; what it cost
  // before was the ticket, which is a different game.
  //
  // `b.x` is the bird's own position and the frog is drawn at its beak (see
  // BEAK), so nothing here has to move the frog to keep the two together.
  const k = b.t / BIRD_AWAY_S;
  b.y = -Math.sin(k * Math.PI) * 46;
  b.x = victim.x + k * BIRD_CARRY;
  victim.lift = -b.y;
  if (b.t >= BIRD_AWAY_S) {
    b.phase = 3;
    // Put down where the bird got to, on its face, and up again in a moment.
    victim.x = Math.min(DIST - 1, b.x);
    victim.lift = 0;
    victim.going = 'down';
    victim.stuck = DOWN_S;
    victim.hop = 0;
  }
}

/** A fly, or not.  Timed before the gun like everything else. */
function makeFly(): Fly {
  if (Math.random() > FLY_CHANCE) return { at: -1, on: false, t: 0, x: 0, lane: 0, tried: [] };
  return {
    at: FLY_FROM + Math.random() * (FLY_TO - FLY_FROM),
    on: false,
    t: 0,
    x: 0,
    lane: 0,
    tried: [],
  };
}

/**
 * The fly's own clock.
 *
 * It comes in at one edge, wanders across the lanes and leaves, and as it
 * crosses each lane the frog in that lane gets ONE chance to be distracted by
 * it.  Most are not.  A frog that goes for it stops to do so, which is the
 * whole cost: the fly does not have to be catchable for the tongue to be a
 * mistake.
 */
function stepFly(f: Fly, runs: Run[], raceT: number, dt: number): void {
  if (f.at < 0) return;
  if (!f.on) {
    if (raceT < f.at * RACE_S || f.t > 0) return;
    f.on = true;
    f.t = 0;
    return;
  }
  f.t += dt;
  const k = f.t / FLY_S;
  if (k >= 1) {
    f.on = false;
    f.at = -1;
    return;
  }
  // Across the lanes and up the track at the same time, with a wander on it so
  // it is an insect rather than a projectile.
  f.lane = k * (RUNNERS.length - 1) + Math.sin(f.t * 7) * 0.35;
  f.x = DIST * (0.3 + k * 0.4) + Math.sin(f.t * 5.5) * 10;

  // Whoever's lane it is over right now, once each.
  const near = Math.round(f.lane);
  const victim = runs.find((r) => r.i === near);
  if (!victim || f.tried.includes(near)) return;
  if (Math.abs(f.lane - near) > 0.3) return;
  f.tried.push(near);
  if (victim.going !== 'run' || Math.random() > FLY_NOTICE) return;
  victim.going = 'tongue';
  victim.stuck = TONGUE_S;
  victim.tongue = 0;
  victim.lift = 0;
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
    balloon: 0,
    balloonAt: Math.random() < BALLOON_CHANCE ? BALLOON_FROM + Math.random() * (BALLOON_TO - BALLOON_FROM) : -1,
    sleepAt: Math.random() < SLEEP_CHANCE ? SLEEP_FROM + Math.random() * (0.95 - SLEEP_FROM) : -1,
    shoveAt: Math.random() < SHOVE_CHANCE ? SHOVE_FROM + Math.random() * (SHOVE_TO - SHOVE_FROM) : -1,
    shoved: false,
    lean: 0,
    tongue: 0,
    x: 0,
    surgeAt: f.surgeAt,
    surgeFor: f.surgeFor,
    hop: Math.random(),
    going: 'run' as Going,
    stuck: 0,
    holes: f.holes,
    holeAt: 0,
    lift: 0,
    jet: 0,
    jetSpeed: 0,
  }));
}

/**
 * Who has won, given where everybody is.
 *
 * First past the post if anybody is; otherwise, at the cap, whoever is
 * furthest up the track.  A frog that is IN THE AIR at the gun -- the one the
 * bird happens to be holding as the clock runs out -- cannot win from up
 * there, but it is not out of the race either: it is put down again a moment
 * later, so it only loses this answer if the race ends while it is off the
 * ground.
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
 * The SAME `step`, `stepBird` and `stepFly` the watched race uses, on the same
 * twenty second clock: potholes, slips, the bird, the sleepers, the shoving,
 * the balloons and the fly.  Anything less and the
 * sampler is measuring a race nobody gets to bet on.
 */
function simulate(
  field: Array<{ i: number; form: number; luck: number; surgeAt: number; surgeFor: number; holes: number[] }>,
): number {
  const runs = toRuns(field);
  const bird = makeBird();
  const fly = makeFly();
  const jet = makeJet();
  const dt = 1 / 60;
  let t = 0;
  while (t < RACE_S) {
    t += dt;
    for (const r of runs) step(r, dt, runs, t);
    stepBird(bird, runs, t, dt);
    stepFly(fly, runs, t, dt);
    stepJet(jet, runs, t, dt);
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
  fly = makeFly();
  flyArt = makeFlyArt(scene);
  jet = makeJet();

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
  const beak = scene.add.triangle(BEAK.x - 2, BEAK.y - 3, 0, 0, 5, 2, 0, 4, 0xffb45e);
  const wingL = scene.add.ellipse(-1, -3, 12, 4, 0x6a6a7c);
  const wingR = scene.add.ellipse(-1, 3, 12, 4, 0x3a3a48);
  const eye = scene.add.circle(7, -3, 1, PALETTE.black);
  const c = scene.add.container(0, 0, [wingR, body, head, beak, eye, wingL]).setDepth(40);
  c.setVisible(false);
  c.setData('wings', [wingL, wingR]);
  return c;
}

/**
 * The fly.  Two pixels of body and a wing that flickers -- it is three pixels
 * across and the only thing it has to do is be findable while it crosses.
 */
function makeFlyArt(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const body = scene.add.rectangle(0, 0, 3, 2, 0x1a1a22);
  const wing = scene.add.rectangle(0, -2, 4, 1.5, 0xc8d8ff).setAlpha(0.75);
  const c = scene.add.container(0, 0, [wing, body]).setDepth(41);
  c.setVisible(false);
  c.setData('wing', wing);
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
  const c = scene.add.container(0, 0, parts).setDepth(10);

  // ---- THE THREE THINGS THAT ONLY SOMETIMES APPLY, built once per frog and
  // hidden until they do.  They live on the frog's own container so they move,
  // scale and rotate with it without anything having to keep them in step.
  //
  // A Z coming off a sleeping frog.
  const zzz = text(scene, 4, -10, 'Z', PALETTE.bone).setVisible(false);
  c.add(zzz);
  c.setData('zzz', zzz);

  // The balloon: a string and a skin, straight up.
  const string = scene.add.rectangle(0, -9, 1, 10, PALETTE.bone).setAlpha(0.6);
  const skin = scene.add.ellipse(0, -18, 9, 11, PALETTE.neon);
  const shine = scene.add.ellipse(-2, -20, 3, 4, PALETTE.cream).setAlpha(0.6);
  const knot = scene.add.triangle(0, -13, 0, 0, 3, 0, 1.5, 2.5, PALETTE.neonDim);
  const balloon = scene.add.container(0, 0, [string, skin, shine, knot]).setVisible(false);
  c.add(balloon);
  c.setData('balloon', balloon);

  // The jetpack: a tank on its back and the flame off the bottom of it, both
  // hidden until the last stretch of a race that has one in it.
  const tank = scene.add.rectangle(-6, -2, 4, 7, PALETTE.ash);
  const cap = scene.add.rectangle(-6, -5, 5, 1, PALETTE.bone);
  // The thrust goes BACKWARDS, which is the only reason the frog is going
  // forwards: a flame under a frog reads as a frog on fire.
  const flame = scene.add.triangle(-11, 1, 0, 0, 0, 5, -7, 2.5, PALETTE.gold);
  const ember = scene.add.triangle(-9, 1, 0, 0, 0, 3, -4, 1.5, PALETTE.cream);
  const pack = scene.add.container(0, 0, [tank, cap, flame, ember]).setVisible(false);
  c.add(pack);
  c.setData('jet', pack);
  c.setData('flame', flame);
  c.setData('ember', ember);

  // And the tongue, which is one pink rectangle that grows out of its mouth.
  const tongue = scene.add.rectangle(4, -2, 1, 1.5, 0xff6f91).setOrigin(0.5, 0.5).setVisible(false);
  c.add(tongue);
  c.setData('tongue', tongue);

  return c;
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
