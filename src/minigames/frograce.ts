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
 * of that the card deals a different moment to every frog, a couple more on
 * anybody, and one or two more into THE FINAL STRETCH -- which is where the
 * race is meant to be at its meanest.  Some of them hurt and some of them
 * help, and several are a coin flip the player watches land:
 *
 *   ROCKFALL  a shadow grows under a frog for a second, then the rock: it is
 *             flattened, or missed by inches and runs off scared (a boost).
 *   THE TRAP  iron jaws set on the lane ahead, in plain view: caught and
 *             wrenching free, or hopped as they snap shut (a boost).
 *   THE LEAP  over a log at full tilt: stuck, and it is well up the track;
 *             crashed, and it tumbles and ends up worse off than before.
 *   BURSTS    head down and flat out -- a slingshot out of another frog's
 *             slipstream when there is one to pass.
 *   SLIPS     traction goes, feet scrabble, down on its seat and a skid.
 *   THE HAWK  dives, lifts a frog clean off the lane and drops it.
 *   BUGS      a gulp and a five-second sleep; the golden one is a sprint.
 *   POTHOLES and PUDDLES are dug into the lanes where everybody can see them,
 *             and never on top of each other.
 *
 * NONE OF IT HIDES THE RACE.  Every event is announced across the top as it
 * happens, and a frog in the air or in the jaws is still drawn at its own
 * place on the track, so who is ahead never stops having an answer.
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

/**
 * THE FIELD.  Four frogs, and four colours that cannot be mistaken for each
 * other at eleven pixels across while they are moving.
 *
 * `skin` is the body, `lit` the light down its back and `dark` the shadow
 * under it -- three tones per frog rather than one flat fill, so a frog reads
 * as a body with a top and an underside rather than as a coloured blob.  The
 * four hues are a quarter of the wheel apart and the two that sit closest
 * (green and yellow) differ most in brightness, which is the pair a colour
 * blind player has to tell apart.
 */
const RUNNERS: Array<{
  name: string; skin: number; lit: number; dark: number; cheek: number;
  /** Proportions.  Above one is longer and lower, below is shorter and rounder. */
  build: number;
  /** How big its eye is, because a frog's eye is most of its face. */
  eye: number;
  /** What is on its back.  Four frogs in four colours are still four of the same frog. */
  mark: 'spots' | 'stripe' | 'band' | 'blotch';
}> = [
  { name: 'GREEN', skin: 0x5fc457, lit: 0x9ae88a, dark: 0x2f7a37, cheek: 0xff9aa8, build: 1.0, eye: 1.0, mark: 'spots' },
  { name: 'PINK', skin: 0xf87fb4, lit: 0xffb6d6, dark: 0xb04274, cheek: 0xfff0f4, build: 0.9, eye: 1.16, mark: 'band' },
  { name: 'BLUE', skin: 0x59a9ef, lit: 0x9fd6ff, dark: 0x2c66ad, cheek: 0xffa3b8, build: 1.12, eye: 0.9, mark: 'stripe' },
  { name: 'YELLOW', skin: 0xf8d45c, lit: 0xfff3b8, dark: 0xb88f1e, cheek: 0xffab8f, build: 0.96, eye: 1.06, mark: 'blotch' },
];

/**
 * HOW MANY FROGS ARE IN THE RACE, AND WHERE THAT NUMBER LIVES.
 *
 * `RUNNERS` is the field, and runners have been commented out of it before --
 * it was seven and it is four.  Everything that used to say "seven" out loud
 * says this instead: the ratings spread, the card, the row prompt and the keys
 * the player can press.  A field of four with a card promising seven is a
 * machine lying to the person betting on it.
 */
const FIELD = RUNNERS.length;
const COUNT_WORD = ['NO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
/** `FOUR`, `SEVEN`... and the number itself for a field too big to have a word here. */
const FIELD_WORD = COUNT_WORD[FIELD] ?? `${FIELD}`;

/**
 * WHERE THE TRACK SITS, AND HOW DEEP A LANE IS.
 *
 * The track used to start twenty-six pixels under the header and run out of
 * screen before the betting rail, which put the race in the top third of the
 * cabinet with the sky doing nothing above it and nothing at all below.  It is
 * dropped to the middle of the screen now: sky and scenery above it, verge and
 * crowd below, and the frogs across the line your eye already rests on.
 *
 * The lanes take the room the field does not, so four of them fill the same
 * band seven used to.
 */
const TRACK_TOP = 66;
/**
 * A LANE HAS TO BE TALLER THAN A FROG.
 *
 * The frogs are chubby now -- about eighteen pixels from the top of an eye to
 * the sole of a foot -- and at twenty-one a lane had them clipping the animal
 * in the lane above whenever one hopped.  Twenty-three gives every frog its
 * own air, and the track still ends clear of the rail at the bottom of the
 * cabinet.
 */
const LANE_H = Math.max(14, Math.min(23, Math.floor(92 / FIELD)));
const LANE_T = TRACK_TOP;
/** The bottom of the last lane, which is where the verge starts. */
const TRACK_BOTTOM = TRACK_TOP + LANE_H * FIELD;
/**
 * WHERE THE FROGS START, AND WHY IT IS NOT WHERE THE PLATES END.
 *
 * A frog is about nineteen pixels across now -- nine and a half either side of
 * its own middle -- so a starting line at 42 put the left half of every frog
 * on top of the row plate beside it.  The plates were trimmed to end at 29 and
 * the line moved out to 48, which leaves nine clear pixels between the widest
 * part of a frog at the gate and the nearest button.
 */
const PLATE = { x: 3, w: 26 };
const START_X = 48;
const FINISH_X = GAME_W - 30;
/** One square of the chequered tape, in pixels. */
const TAPE_SQ = 5;
const DIST = FINISH_X - START_X;

/**
 * How fast a frog goes, in lengths per second.
 *
 * `BASE` is the pace of the whole field.  Everything else on top of it is
 * small on purpose: THIS IS A CLOSE RACE.
 *
 * ---- WHY THE FORM IS WORTH SO LITTLE NOW.
 *
 * The old field ran on a form spread of 5.6 against a base of 8.9, so the best
 * card was travelling more than half again as fast as the worst and the race
 * was usually decided in the first ten seconds.  The spread is 1.15 now: the
 * favourite is still the favourite over a hundred races, and over any ONE race
 * it is worth about four seconds of nothing-going-wrong.  What decides a race
 * is what happens IN it.
 *
 * ---- AND WHY NOTHING RUNS AWAY WITH IT.
 *
 * `CATCH_GAIN` is the whole of the closeness.  Every frog's pace is scaled by
 * how far behind the leader it is, as a fraction of the track -- twenty pixels
 * down is about a tenth of the track, which buys back roughly twelve per cent
 * of pace until the gap closes.  It is a tow rope, not a teleport: it never
 * moves anybody, it only leans on the arithmetic that was moving them anyway,
 * so the motion stays smooth and nothing snaps.
 *
 * `CLOSING_FROM` is where that rope is pulled tight.  Inside the last quarter
 * of the track the gain doubles, which is what turns four frogs strung out
 * over thirty pixels into four frogs crossing the line inside ten of each
 * other -- and it is why the winner is not knowable until the last seconds.
 *
 * `LEADER_DRAG` is the same idea from the front: whoever is in front is
 * carrying the wind, and gives up three per cent for it.
 */
const BASE = 7.8;
const SPREAD = 1.6;
const WOBBLE = 5.5;
/** Held for the whole race: uniform over ±LUCK. */
const LUCK = 0.7;
/** The slow walk: how hard it is kicked per second, how fast it is pulled back, and its ceiling. */
const DRIFT_KICK = 5;
const DRIFT_PULL = 2.2;
const DRIFT_MAX = 2.2;
/** Every frog gets one, somewhere in the middle third.  Small: it is a nudge. */
const SURGE = 2.6;

/**
 * ---- THE CONVOY, which is how the field is shaped.
 *
 * A spring on the MEAN of the race was the first go at this and it makes a
 * blob: the force only knows how far a frog is from the middle, so pairs
 * either sit on top of each other or string right out, and four frogs
 * converge on one x and cross the line as one shape.  That is not a close
 * race, it is a tie with four colours in it.
 *
 * What the player actually reads is THE GAP TO THE FROG IN FRONT, so that is
 * what is shaped.  Every frog wants to sit in a band behind the one ahead of
 * it: closer than `GAP_MIN` it eases off, further than `GAP_MAX` it presses
 * on.  Four frogs each holding a three-to-six pixel gap is a ladder -- a
 * first, a second, a third and a fourth, all of them in shot, none of them
 * on top of another -- and at nine pixels a second that band is between a
 * third and three quarters of a second of running.
 *
 * It does not stop anybody passing.  The ease is a fifth of pace, which a
 * frog on a good patch goes straight through; what it stops is
 * two frogs sharing one x for four seconds because neither can get by.
 */
// ---- AND THE BAND IS IN PIXELS, DELIBERATELY.
//
// It was briefly rewritten in seconds, on the grounds that the race is
// designed in seconds -- and half a second of gap is a few pixels, which on a
// nineteen pixel frog is touching.  What has to
// be true is that the player can SEE who is second and who is third, and that
// is a distance on the screen, not a duration.  Four pixels of clear grass is
// about a fifth of a frog; at this pace it is also the better part of a
// second, which is the same thing said the other way round.
const GAP_MIN = 4.2;
const GAP_MAX = 5.2;
const SEP_EASE = 0.55;
/** Per pixel of gap past the band, sized so a second of gap is worth about half. */
const CONVOY_GAIN = 0.5 / BASE;
const CONVOY_MAX = 0.5;
/**
 * ---- AND THE LAST FEW PIXELS, WHICH ARE THE ONES THE PLAYER LOOKS AT.
 *
 * Inside `FINISH_CLEAR` -- about three seconds of running -- the no-overlap
 * band is widened, so a frog closing on the leader over the run-in is held a
 * body clear of it instead of arriving alongside.  Ten pixels was not enough:
 * a frog coming fast arrives two pixels down and the leader crosses while it
 * is still there, which is the photo finish this race is not allowed to have.
 * Three seconds is long enough for the ease to actually open a gap, and it is
 * the stretch the player is watching, so the frogs go over the line in a
 * readable order with daylight between them.
 */
const FINISH_CLEAR = 20;
const FINISH_GAP_MUL = 1.8;

/** The convoy pulls a little tighter over the last stretch.  A little. */
const CLOSING_FROM = 0.62;
const CLOSING_MUL = 1.35;
/**
 * Whoever is in front is carrying the wind, and it is worth more than it
 * looks.  The leader is the one frog with no convoy force on it -- nobody
 * ahead to hold a gap on -- so without a cost to leading it simply keeps
 * going and the frog in front at two thirds wins three races in four.  Four
 * and a half per cent is invisible in any one second and means the lead is
 * something that has to be held rather than something that is won early.
 */
const LEADER_DRAG = 0.955;

/**
 * ---- AND A ROPE FOR ANYBODY WHO HAS DROPPED RIGHT OFF.
 *
 * The convoy cannot help a frog that has just spent five seconds asleep: its
 * neighbour is thirty pixels up the road and the band it is trying to hold is
 * six.  This is the backstop, and it is deliberately blunt -- nothing at all
 * until a frog is `TOW_DEAD` behind the middle of the race, and never worth
 * more than `RESCUE_MAX` when it is.
 */
const TOW_DEAD = 13;
const RESCUE_GAIN = 0.03;
const RESCUE_MAX = 0.3;

/**
 * THE RACE IS THIRTY SECONDS.  BASE is set so a clean run is home at about
 * twenty-eight, which leaves room for a sleep, a slip and a bird inside the
 * cap.  Anyone still running at thirty is settled on distance.
 *
 * Everything else written in seconds -- the effects, the bands they are dealt
 * in, the jetpack's window -- is either a fraction of this or a duration in
 * its own right, so shortening the race makes each of them a bigger share of
 * it: the same eight things happen, closer together.
 */
const RACE_S = 30;
/** One hop: how long it takes, and how high it goes in pixels. */
const HOP_S = 0.34;
/**
 * How far off the lane a hop takes a frog.
 *
 * Five was a bob: at fifteen pixels of lane it read as a frog running with a
 * limp.  Nine was most of a body clear of the track -- right for the lean
 * little frogs that used to run here and too much for these ones, which are
 * nearly nineteen pixels of chubby animal in a twenty-three pixel lane: at
 * the top of the arc they were in the lane above.  Six keeps the hop a hop
 * and keeps every frog in its own lane.
 */
const HOP_H = 6;
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
/**
 * WHERE THE FACE SITS, IN PROFILE.
 *
 * These live here rather than inside `makeFrog` because `wearMood` also has to
 * know: it eases the irises back toward their rest position every frame, so if
 * the two functions disagree about where an eye belongs, the drawing wins for
 * one frame and the mood code drags it back for ever after.  They were two
 * separate copies of `side * 3.9`, which is exactly the kind of thing that
 * survives a rewrite of one of them.
 *
 * ONE EYE.  There were two -- a small far one set back and a big near one --
 * which is a head turned three quarters toward the camera, not a profile.
 * From the side of an animal you see one eye, and the moment the far one is
 * gone the frogs stop looking out of the screen at the person betting on them
 * and start looking down the track they are running along.
 */
/*
 * FACING THE PLAYER.  The frogs were turned to profile to run down the
 * track; they are turned back to face the people betting on them, as asked --
 * two eyes up on top of the head, a smile across the face, a cheek either
 * side -- and they still hop down the lane to the right.
 */
/** How big a frog is drawn, and where its feet are, which stay put. */
const FROG_S = 0.8;
const FROG_FOOT = 7;
// big eyes on a small frog: the cute ratio
const EYES = [
  { x: -3.9, y: -8, r: 3.6 },
  { x: 3.9, y: -8, r: 3.6 },
];
const MOUTH_X = 0;
const MOUTH_Y = -2.2;
const BROW_Y = -10.6;

const FOOT = 6; // where a frog's feet are, in its own drawing
/** Where each leg hangs off the body, in the frog's own drawing. */
const REAR_LEG = { x: 0, y: 5.4 };
const FORE_LEG = { x: 0, y: 6.4 };

/**
 * WHAT THE LEGS DO OVER ONE HOP.
 *
 * Read off the same `u` the body squash uses, so the push and the stretch
 * cannot drift apart from each other -- the legs drive at the exact moment
 * the body leaves the ground, because both are the same number.
 *
 *   coiled    folded up under the frog, waiting
 *   drive     rear leg straight out and back: this is the push
 *   trail     both legs stretched behind, the airborne shape
 *   reach     front leg swings forward to take the weight
 *   absorb    everything folds again as the landing is taken
 */
function legPose(u: number): { rear: { x: number; y: number; a: number }; fore: { x: number; y: number; a: number } } {
  if (u >= TAKEOFF && u < LAND) {
    const a = (u - TAKEOFF) / (LAND - TAKEOFF);
    const v = 1 - 2 * a; // +1 leaving the ground, 0 at the top, -1 coming down
    const drive = Math.max(0, v); // the push, strongest right off the ground
    const reach = Math.max(0, -v); // the landing gear, coming out on the way down
    const tuck = 1 - Math.abs(v); // fully folded at the apex
    return {
      rear: {
        x: -3.4 * drive + 1.2 * tuck + 0.6 * reach,
        y: 1.6 * drive - 2.2 * tuck - 0.4 * reach,
        a: 0.62 * drive - 0.5 * tuck - 0.18 * reach,
      },
      fore: {
        x: -1.4 * drive - 0.6 * tuck + 2.8 * reach,
        y: -0.8 * drive - 2 * tuck + 0.8 * reach,
        a: 0.3 * drive - 0.45 * tuck - 0.5 * reach,
      },
    };
  }
  const groundSpan = 1 - LAND + TAKEOFF;
  const gp = (u >= LAND ? u - LAND : u + 1 - LAND) / groundSpan;
  // splayed as it lands, then gathered under it as it coils for the next one
  const absorb = gp < 0.45 ? gp / 0.45 : 1 - (gp - 0.45) / 0.55;
  const coil = gp > 0.55 ? (gp - 0.55) / 0.45 : 0;
  return {
    rear: { x: 1.1 * absorb + 1.8 * coil, y: 0.5 * absorb - 0.6 * coil, a: -0.26 * absorb - 0.3 * coil },
    fore: { x: -0.7 * absorb - 1.2 * coil, y: 0.4 * absorb - 0.4 * coil, a: 0.28 * absorb + 0.22 * coil },
  };
}
function hopPose(u: number): { sx: number; sy: number; rot: number } {
  if (u >= TAKEOFF && u < LAND) {
    const a = (u - TAKEOFF) / (LAND - TAKEOFF);
    const v = 1 - 2 * a; // +1 leaving the ground, 0 at the top, -1 coming down
    const rise = Math.abs(v);
    // ---- A BODY WITH WEIGHT, NOT A RUBBER BALL.  It was squashed to two
    // thirds on every landing and stretched a fifth on every take-off, which
    // is a cartoon.  A frog that is running hard stays mostly the shape it
    // is: a little long off the ground, a little compressed taking the
    // landing, and pitched INTO the way it is going the whole time -- more
    // coming down than going up, because that is where the weight is.
    return { sx: 1 - 0.07 * rise, sy: 1 + 0.11 * rise, rot: 0.07 - 0.05 * v };
  }
  const groundSpan = 1 - LAND + TAKEOFF;
  const gp = (u >= LAND ? u - LAND : u + 1 - LAND) / groundSpan;
  // 0.8 taking the landing, up to 0.94 as it absorbs, back to 0.86 as it coils
  const sy = gp < 0.45 ? 0.8 + (0.14 * gp) / 0.45 : 0.94 - (0.08 * (gp - 0.45)) / 0.55;
  return { sx: 1 + (1 - sy) * 0.7, sy, rot: 0.1 - 0.06 * gp };
}
/**
 * ================= WHAT HAPPENS TO FROGS =================
 *
 * Eight things, and they are the race.  The form is worth four seconds over
 * thirty; one of these is worth about two, and every frog gets one.
 *
 * EVERY EFFECT IS MEASURED IN SECONDS OF RUNNING, not in pixels, because that
 * is how the player experiences it: "the bug cost him five seconds" is a thing
 * you can see happen.  `SEC` turns one of those seconds into the ground a frog
 * covers in it, so retuning the pace does not silently retune every effect
 * with it.
 *
 * AND NONE OF THEM TELEPORTS ANYTHING.  Each one either scales the pace for a
 * while, adds a push for a while, or takes the frog off the ground and puts it
 * back down -- and the ones that move a frog do it over their own length with
 * an ease on both ends.  Nothing in here writes a new `x` in one frame.
 */
const SEC = BASE;

/**
 * ---- THE BIRD.  Down, hooks it, lifts it, drops it, and goes STRAIGHT UP.
 *
 * It used to carry the frog backwards down the track and cost it two seconds
 * of ground.  It does not move the frog an inch any more: it picks it up where
 * it stands, lets go, and climbs out of the top of the picture, and what the
 * frog loses is the four seconds it spends on its back.  That is a cleaner
 * thing to watch and a cleaner thing to price -- a frog put back two seconds
 * is a number, and a frog flat on the lane with stars going round its head
 * while three others run past is the race.
 */
const BIRD_DIVE_S = 0.75;
/** Up off the lane, in place.  Nothing is carried anywhere. */
const BIRD_LIFT_S = 0.8;
const BIRD_AWAY_S = 1.2;
/** How high it lifts it off the lane before it lets go. */
const BIRD_LIFT = 26;
/**
 * AND WHAT BEING DROPPED COSTS: FOUR SECONDS, FROM THE HOOK TO THE FIRST HOP.
 *
 * The bird lets go and the frog FALLS -- accelerating, not easing down -- hits
 * the lane, and sits there seeing stars until the four are up.  The lift and
 * the fall are their own beats so the landing has something to be the end of,
 * and the stars get whatever is left, solved from the other two rather than
 * typed in: retune the fall and the total stays four.
 */
/**
 * HOW LONG THE FALL TAKES.
 *
 * It was 0.42 seconds, and worse than that: the frog stayed in the `taken`
 * state for the whole of it, and `taken` means "draw this frog at the bird's
 * beak".  So while the model was carefully dropping it, the picture had it
 * still stuck to a bird that was climbing away -- and then it appeared on the
 * ground.  That is the teleport.  See `stepBird` phase 3, which now hands the
 * frog to `falling`, and the `falling` pose, which tumbles it down.
 *
 * The four seconds of BIRD_TAKEN_S are unchanged; the fall simply takes a
 * bigger share of them and the dizzy spell takes a smaller one.
 */
const BIRD_DROP_S = 0.8;
const BIRD_TAKEN_S = 4.0;
const DIZZY_S = BIRD_TAKEN_S - BIRD_LIFT_S - BIRD_DROP_S;
/**
 * WHERE THE BEAK IS, inside the bird's own drawing.
 *
 * The frog it has taken is drawn AT this point rather than on the lane, so the
 * two go up together and come apart at the release rather than the frog
 * hanging in the air under a bird that has climbed away without it.
 */
const BEAK = { x: 1, y: 8 };

/**
 * ---- THE FALLING ROCK.  A shadow first, growing on the lane under the frog
 * for over a second, then the rock -- and it either lands on the frog or it
 * does not.  Flattened is a second and a half on the grass; missed by a hair
 * is a fright, and a fright is pace (see RUSH).  The shadow is the fairness:
 * nobody is hit by something they did not see coming.
 */
const ROCK_WARN_S = 1.1;
const ROCK_HIT_S = 1.6;
const ROCK_ODDS = 0.5;

/**
 * ---- THE NEAR MISS, which is worth something.  A frog that has just been
 * missed by a rock or leapt a trap as it snapped runs scared for most of a
 * second: pure pace, drawn as streaks off its back.
 */
const RUSH_S = 0.9;
const RUSH_GAIN = 0.7;

/**
 * ---- THE TRAP.  A set of iron jaws is dropped on the lane a second ahead of
 * the frog, open, where anybody can see it.  The frog either hops it at the
 * last moment -- the jaws bang shut under it and it is away on a near miss --
 * or it is caught, and spends a second and a half wrenching itself out.
 */
const TRAP_LEAD = 2.6;
const TRAP_S = 1.4;
const TRAP_ODDS = 0.5;
const TRAP_HOP_S = 0.45;
const TRAP_HOP_GAIN = 0.3;
const TRAP_HOP_H = 12;

/**
 * ---- THE BURST.  The frog puts its head down and goes: a second and a bit
 * of flat-out running, worth about a second and a half of ground.  With a
 * frog just in front of it, it is a slipstream and a slingshot past.
 */
const BURST_S = 1.2;
const BURST_GAIN = 1.4;

/**
 * ---- THE FLY.  It crosses the lanes, somebody eats it, and it sleeps it off.
 *
 * AND IT IS A WARNING BEFORE IT IS A MEAL.  It used to appear a tongue's
 * length from the frog and be licked out of the air inside a couple of
 * tenths -- the player saw a frog fall asleep and nothing that explained it.
 * It comes in from two lanes out now and no frog may touch it for
 * `FLY_WARN_S`, so there is a fly crossing the track, visibly, for over a
 * second before any tongue comes out.  That is the whole of the change: what
 * the tongue does, how far it reaches and what eating it costs are untouched.
 */
const FLY_WARN_S = 1.25;
const FLY_CROSS_S = 4.0;
const TONGUE_S = 0.45;
/** How far the lick goes, in pixels.  A frog is about eleven across. */
const TONGUE_REACH = 26;
/** A full stomach is FIVE seconds of not racing. */
const SLEEP_S = 5.0;
/** How long it takes to wake up, inside those five seconds. */
const WAKE_S = 0.8;

/** ---- THE GOLDEN FLY.  Same idea, opposite result: eat it and go. */
const GOLD_GAIN = 1.5;
const GOLD_SURGE_S = 0.9;
const GOLD_CROSS_S = 3.6;

/**
 * ---- AND BOOSTS ARE EARNED OR DEALT, NEVER HANDED TO THE LEADER.  The
 * golden fly, a burst and the fright of a near miss are the ways a frog goes
 * quicker, and every one of them lands on whoever the card or the luck picks.
 */

/**
 * ---- THE LEAP.  A log across the lane and a frog that takes it at full
 * tilt: one long arc that lands a second and a half up the track -- or, four
 * times in ten, does not.  A leap that is going wrong LOOKS wrong from the top
 * of the arc (it starts to turn over), then comes down short and tumbles for
 * over a second, which leaves it worse off than if it had never jumped.
 */
const JUMP_S = 1.5;
const JUMP_GAIN = 1.5;
const JUMP_H = 22;
const JUMP_CLEAN_ODDS = 0.6;
const CRASH_S = 1.3;
/** How much of the gain a leap that is going to crash still gets before it does. */
const CRASH_SHORT = 0.35;

/** ---- THE SLIP.  Legs go, slides, gets up.  It costs about a second. */
const SLIP_S = 1.1;
const SLIP_SLIDE = 0.35;
/** The chance of one on any landing, on top of the scheduled ones. */
const SLIP_CHANCE = 0.004;

/** ---- POTHOLES.  Thinned right out: one a lane, and half of them are cleared. */
const HOLES_PER_LANE = 1;
/**
 * ---- PUDDLES ARE ON THE TRACK, which is the whole point of them.
 *
 * A puddle used to be a card event: the frog splashed wherever it happened to
 * be standing, with a column of water appearing round it out of nothing.  That
 * is a thing happening TO a frog, and a puddle is a thing that is THERE -- so
 * it is dug into the lane like a pothole, drawn on the track where anyone can
 * see it coming, and a frog splashes because it ran into one.
 *
 * Tested on the way in, exactly as a pothole is, so a frog either clears it in
 * the air or comes down in the water.
 */
// None: the puddle is gone from the race.  (The machinery stays, at zero, so
// a lane's furniture is still one list of holes and one of water.)
const PUDDLES_PER_LANE = 0;
const PUDDLE_FROM = 0.22;
const PUDDLE_TO = 0.86;
/** How often coming down on one actually gets you: the rest are cleared. */
const PUDDLE_ODDS = 0.62;

const HOLE_FROM = 0.3;
const HOLE_TO = 0.8;
const HOLE_S = 0.7;
const HOLE_BACK = 4;

/**
 * ---- THE JETPACK, AND WHY IT IS NOT THE TOW ROPE.
 *
 * The two do the same arithmetic and they are not the same thing, so do not
 * take one out on the grounds that the other exists.
 *
 * THE TOW ROPE IS BALANCING, and it is meant to be invisible: it leans on
 * every frog, every second, by a few per cent, and what the player sees is
 * four frogs who happen to still be together.  THE JETPACK IS DRAMA, and it
 * is meant to be seen: one race in five, in the last stretch, the frog at the
 * back lights one and goes, and the player watching their ticket knows
 * exactly what is happening.
 *
 * It is the only thing in the race that is not on the card, and it is the only
 * thing the tutorial does not mention.
 */
/**
 * THE SLOWEST FROG'S LAST THROW OF THE DICE.
 *
 * Rolled before the gun, and if it comes up the frog in LAST PLACE lights it
 * inside the final three seconds of the race -- see `stepJet`, which aims the
 * burn at a point either side of the line.  Half the time it is aimed a touch
 * short and half the time a touch long, so a jetpack is a chance and not a
 * result: it may win and it may not, and either way the crowd sees it coming.
 */
const JET_CHANCE = 0.25;
const JET_WINDOW_S = 3;
/**
 * WHERE THE BURN IS AIMED, and why there is a hole in the middle of it.
 *
 * A jetpack does not queue: it is the one thing in the race that ignores the
 * convoy, so a burn aimed AT the leader's arrival lands level with it and the
 * race ends in a dead heat nobody can read.  That was a tenth of all finishes
 * and every one of them was a jetpack.
 *
 * So it is aimed at one side or the other and never at the middle: half the
 * time it goes for a length in front, half the time it comes up a length
 * short.  The coin flip is intact -- it takes about half the races it
 * appears in -- and both outcomes are something the player can see.
 */
const JET_AIM_EARLY = { min: 0.78, max: 0.9 };
const JET_AIM_LATE = { min: 1.1, max: 1.3 };
const JET_MAX_SPEED = 11 * BASE;
const JET_LIFT = 7;
const JET_RISE_S = 0.25;

/**
 * ---- WHAT EACH NEW EVENT IS WORTH, IN SECONDS OF RUNNING.
 *
 * Every one of them is measured the same way the old ones are: in seconds of
 * ground, not in pixels, because "the mushroom was worth about a second and a
 * half" is a thing you can watch happen and a thing that survives a retune of
 * the pace.
 *
 * NOTHING HERE IS A RACE-WINNER ON ITS OWN.  The biggest gain is the rocket at
 * a shade over two seconds against a thirty second race, and the biggest loss
 * is the banana at about one -- so any of them can turn a placing and none of
 * them can turn the race, which is the difference between chaotic and rigged.
 * Nothing traps a frog: every state below runs on its own clock and hands the
 * frog back to `run` when it expires.
 */
const PUDDLE_S = 0.6;
const PUDDLE_H = 9;
const PUDDLE_COST = 0.45;

/**
 * ---- THE CARD OF EFFECTS, AND THE RULE THAT EVERY FROG IS ON IT.
 *
 * Four frogs, four DIFFERENT effects, one each, spaced down the race so they
 * do not all land at once.  The bands overlap a little so the running order of
 * the effects is not the running order of the lanes.
 *
 * `EXTRA` is what is sprinkled on top: a couple more, anywhere, on anybody --
 * enough that two races do not look alike, not so many that the race is a
 * fairground ride.  Nothing is booked in the last few seconds: the finish
 * belongs to the frogs.
 */
const EFFECTS = [
  'bird', 'fly', 'golden', 'jump', 'slip',
  /** A rock out of the sky: flattened, or missed by a hair. */
  'rock',
  /** Iron jaws set on the lane: caught, or hopped as they snap. */
  'snap',
  /** Head down and flat out -- a slipstream when there is someone to pass. */
  'burst',
  /** A puddle that sits ON THE TRACK -- see `puddles`, which is where it lives. */
  'puddle',
] as const;
type EffectKind = (typeof EFFECTS)[number];
const BAND_FROM = 0.12;
const BAND_TO = 0.68;
/**
 * HOW MANY EXTRAS ON TOP OF THE FOUR.
 *
 * Cut from 3-6 when the card went from eighteen kinds to nine and the puddles
 * moved onto the track.  Measured at the old numbers the race was running 13.6
 * events -- four booked, up to six sprinkled, and about five splashes nobody
 * booked at all -- and it showed: the field finished 39px apart instead of 30,
 * the favourite's edge fell to 31% where a form card needs a third above
 * chance, and 12% of races failed to land all four of the guaranteed effects
 * because every frog was already busy when they came due.
 *
 * Chaos is not the same as volume.  Fewer, bigger, clearer.
 */
const EXTRA_MIN = 1;
const EXTRA_MAX = 2;
/**
 * HOW MANY FROGS MAY BE MID-EVENT AT ONCE.
 *
 * With four guaranteed effects and up to six extras on a thirty second card,
 * the card WILL sometimes want two or three things to start in the same
 * second -- and four frogs all doing something at once is not a chaotic race,
 * it is a screen nobody can read.  A booking that arrives while this many
 * frogs are already busy waits half a second and asks again, which spreads
 * the pile-up out instead of dropping it.
 */
const BUSY_CAP = 2;
/** Nothing new starts after this much of the race has gone -- except the finale. */
const LAST_CALL = 0.78;
/**
 * ---- THE FINAL STRETCH.  The race gets meaner at the end on purpose: one or
 * two more big moments are dealt into the last third -- a rock, a trap, a
 * burst or a leap, good or bad, on anybody -- so the run-in is where places
 * change hands rather than a procession to the tape.
 */
const FINALE_FROM = 0.68;
const FINALE_TO = 0.9;
const FINALE_MIN = 1;
const FINALE_MAX = 2;
const FINALE_KINDS: EffectKind[] = ['rock', 'snap', 'burst', 'jump'];
/**
 * ---- EXCEPT THE BUG, WHICH IS A LATE ONE ON PURPOSE.
 *
 * Every other effect is spread evenly down the race.  The bug is not, because
 * of what it does: a frog that eats one sleeps for FIVE seconds, and five
 * seconds gone at the halfway mark is a frog that quietly drops out of a race
 * nobody has started caring about yet.  Five seconds gone in the last stretch
 * is the race.
 *
 * So it has its own window at the back of the card, and the roll inside that
 * window leans on the late end of it -- square-rooted, which puts the average
 * around two thirds of the way along rather than in the middle.  Late nearly
 * every time, occasionally a little earlier, so it stays a thing that tends to
 * happen rather than a thing that happens on a timer.  It reaches past
 * `LAST_CALL`, alone among the effects, because its whole point is to land
 * where nothing else is allowed to.
 */
const BUG_FROM = 0.5;
const BUG_TO = 0.72;
const bugAt = (): number => (BUG_FROM + (BUG_TO - BUG_FROM) * Math.sqrt(Math.random())) * RACE_S;

/** One booked effect: when it goes off, who it goes off on, and what it is. */
interface Booking {
  at: number;
  who: number;
  kind: EffectKind;
  done: boolean;
  /** One of the four the field is guaranteed, rather than a sprinkled extra. */
  core: boolean;
  /** Dealt into the final stretch. */
  finale?: boolean;
}

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
function pace(r: Run, field: Run[] | undefined, surging: boolean, dt: number): number {
  r.drift += (Math.random() - 0.5) * 2 * DRIFT_KICK * dt;
  r.drift = Phaser.Math.Clamp(r.drift - r.drift * DRIFT_PULL * dt, -DRIFT_MAX, DRIFT_MAX);
  const own =
    BASE + r.form * SPREAD + r.luck + r.drift + (Math.random() - 0.5) * 2 * WOBBLE + (surging ? SURGE : 0);
  return own * tow(r, field);
}

/**
 * THE TOW ROPE, and the only reason four frogs are still together at the line.
 *
 * A spring on the MEAN of the field rather than on the leader: a frog behind
 * the middle of the race is pulled up, one ahead of it is held back, and the
 * pair of those closes a gap twice as fast as leaning on either end alone --
 * for half the visible difference in pace, which is what keeps it subtle.
 *
 * It scales pace; it never writes a position.  A frog that has just lost four
 * seconds asleep spends the next several running at something like half again
 * its own pace, and what the player sees is a frog running its heart out, not
 * a frog being handed the ground back.
 *
 * Inside the last quarter the spring stiffens, which is what turns a field
 * strung out over thirty pixels into four frogs inside ten of each other, and
 * why nobody can call it until the last seconds.
 */
function tow(r: Run, field: Run[] | undefined): number {
  if (!field || field.length < 2) return 1;
  let sum = 0;
  let n = 0;
  let lead = -1;
  // The nearest frog in front of this one, which is the one it has to not run
  // into.  Lanes do not come into it: what the player reads as a gap is the
  // distance up the TRACK, whatever lane it is in.
  let ahead = Infinity;
  for (const o of field) {
    if (o.going === 'taken') continue;
    sum += o.x;
    n++;
    if (o.x > lead) lead = o.x;
    if (o !== r && o.x > r.x) ahead = Math.min(ahead, o.x - r.x);
  }
  if (!n) return 1;
  let pull = 1;

  // ---- THE CONVOY.  Hold a gap on the frog in front: ease off inside it,
  // press on outside it, and do nothing at all in between.  The leader has
  // nobody in front and is left alone.
  const keep = r.x > DIST - FINISH_CLEAR ? GAP_MIN * FINISH_GAP_MUL : GAP_MIN;
  if (ahead < keep) {
    pull *= SEP_EASE + (1 - SEP_EASE) * (ahead / keep);
  } else if (ahead > GAP_MAX && ahead < Infinity) {
    const gain = r.x / DIST >= CLOSING_FROM ? CONVOY_GAIN * CLOSING_MUL : CONVOY_GAIN;
    pull *= 1 + Math.min(CONVOY_MAX, (ahead - GAP_MAX) * gain);
  }

  // ---- THE BACKSTOP, for a frog that has dropped right off the race.
  const off = sum / n - r.x;
  if (off > TOW_DEAD) pull *= 1 + Math.min(RESCUE_MAX, (off - TOW_DEAD) * RESCUE_GAIN);

  // And whoever is actually in front is carrying the wind.
  return r.x >= lead - 0.5 ? pull * LEADER_DRAG : pull;
}

/**
 * What a frog is doing.  `run` is hopping up the track; everything else is a
 * way that stops, and each of them is something the player can see happen
 * rather than a number going down.
 */
type Going = 'run' | 'hole' | 'slip' | 'taken' | 'sleep' | 'eat' | 'jump' | 'dizzy'
  | 'splash'
  /** Flattened by a rock. */
  | 'hit'
  /** In the jaws of a trap. */
  | 'caught'
  /** A leap that came down wrong, tumbling. */
  | 'crash'
  /**
   * LET GO BY THE BIRD AND ON ITS WAY DOWN.
   *
   * Its own state, because `taken` means "drawn at the beak" -- and the frog
   * is not in the beak any more.  See `stepBird` phase 3.
   */
  | 'falling';

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
  /** And the puddles, which are furniture in exactly the same way. */
  puddles: number[];
  puddleAt: number;
  /** Height off the lane, in pixels: the hop arc, or being carried off. */
  lift: number;

  // ---- the timed modifiers.  Each is seconds left, and each scales or adds
  // to pace rather than moving anything.
  gold: number;

  // ---- the staged movements.  Each runs from one place to another over its
  // own length, eased at both ends; see `step`.
  /** One long arc: where it left the ground and where it lands. */
  jumpFrom: number;
  jumpTo: number;
  /** Seconds of flat-out running left (a burst, or a near miss), and what it adds. */
  rush: number;
  rushPush: number;
  /** Seconds until the rock lands, 0 when none is coming; where it came down. */
  rock: number;
  rockX: number;
  /** A trap on this lane: where, and 0 none / 1 set / 2 caught it / 3 hopped it. */
  trapX: number;
  trap: number;
  /** The leap in the air is going to come down wrong. */
  crash: boolean;
  /**
   * What just happened to it, for the drawing and the commentary to pick up
   * and clear.  The model only ever writes it; the headless sampler never
   * reads it.
   */
  cue: string;
  /** How far through a lick at a fly it is, 0..1. */
  tongue: number;
  /** A slip's slide, and a lean into a shove.  Drawing only. */
  slide: number;
  lean: number;
  /** Seconds of jetpack left, and the pace it was sized to fly at. */
  jet: number;
  jetSpeed: number;

  // ---- THE LAUNCH ARC, so one mechanism serves the leap and the hop over a
  // trap.  How long it is in the air and how high it goes is all that
  // separates them.
  arcS: number;
  arcH: number;
  /** Held flat rather than arced.  Nothing on the card uses it now. */
  arcFlat: number;
  /** How far through the fall from the bird it is, 0 at the top. */
  fell: number;
  /** How far through a splash it is, 1 down to 0. */
  splash: number;
  /** What is happening to it right now, and everything that has. */
  fx: EffectKind | null;
  had: EffectKind[];
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
  /** Alive while it is on screen, and where it is in track/lane space. */
  on: boolean;
  /** The golden one is worth catching; the ordinary one is worth a nap. */
  gold: boolean;
  t: number;
  x: number;
  /** A float, not an index: it slides across the lanes towards its frog. */
  lane: number;
  /** The frog the card sent it to. */
  target: number;
}

/** The one bird, and where it is in its four beats.  See `stepBird`. */
interface Bird {
  /** Who it takes.  Named by the card before it comes in. */
  target: number;
  /** 0 idle, 1 approach, 2 carry, 3 release, 4 gone. */
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
/** The race has reached its final stretch, and says so. */
let finaleOn = false;
/** Seconds left on the commentary line before it goes back to quiet. */
let callT = 0;
let jet: Jet = makeJet();
/** What is booked to happen to whom, and when.  See `bookField`. */
let card: Booking[] = [];
/** What each frog was last doing, so a change can be heard. */
const fxWas = new Map<number, EffectKind | null>();

/**
 * WHAT EACH EVENT SOUNDS LIKE.
 *
 * One line per event, so the noise a thing makes is written down next to what
 * the thing is rather than buried at the site that starts it.
 */
const FX_SOUND: Partial<Record<EffectKind, Parameters<typeof audio.sfx>[0]>> = {
  bird: 'throw_whoosh',
  fly: 'ui_hover',
  golden: 'cha_ching',
  puddle: 'splash',
};
const FX_VOL: Partial<Record<EffectKind, number>> = {
  bird: 0.5, fly: 0.4, golden: 0.5, puddle: 0.55,
};
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
  rules: `pick one, ${FIELD} run, 30 seconds`,
  payoutNote: 'WIN: 20 A TICKET',
  tutorial: {
    objective: [
      `${FIELD_WORD} FROGS RACE. BACK ONE OF THEM.`,
      'NOTHING SAYS WHICH. IT IS A GUESS.',
      'ROCKS FALL, TRAPS SNAP, HAWKS DIVE.',
      'A NEAR MISS OR A BURST CAN STEAL IT.',
      'THE FINAL STRETCH IS THE WILDEST.',
      'THIRTY SECONDS. FIRST TO THE TAPE WINS.',
      '10 A TICKET, 20 BACK ON EACH.',
    ],
    controls: [
      [`1-${FIELD} / NUMBER`, 'BACK THAT FROG'],
      ['UP / DOWN', 'MORE OR FEWER TICKETS'],
      ['SPACE', 'START THE RACE'],
    ],
  },
  // The field will not fit on five buttons, and it does not need to: the whole
  // lane is a hit area, so backing one is tapping the frog you want.
  // Tap a frog to back it; the ticket count has its own two buttons, since
  // UP and DOWN are keys a phone does not have.
  touch: {
    buttons: [
      { label: 'RACE', key: 'SPACE', primary: true },
      { label: 'MORE', key: 'UP' },
      { label: 'LESS', key: 'DOWN' },
    ],
  },

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
    sub = centerText(scene, GAME_W / 2, 164, `TAP A NUMBER OR PRESS 1-${FIELD}`, PALETTE.cream).setDepth(60);
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
    // Only the keys there are frogs for: a 5 that does nothing is a key the
    // player presses twice before deciding the machine is broken.
    const numberKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'].slice(0, FIELD);
    keys = kb ? numberKeys.map((n) => kb.addKey(n)) : [];
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
            .map((r) => ({
              name: RUNNERS[r.i].name,
              form: Math.round(r.form * 100),
              x: Math.round(r.x),
              going: r.going,
              fx: r.fx,
              had: [...r.had],
            }))
            .sort((a, b) => b.form - a.form),
          // `destroy` empties the field, and a bridge that throws once the game
          // is over is a bridge that cannot be used to check how it ended.
          favourite: racers.length ? racers.reduce((a, b) => (b.form > a.form ? b : a)).i : -1,
        }),
        /** Height off the lane for every frog, so a harness can see the hop. */
        lifts: () => racers.map((r) => r.lift),
        /**
         * The fly: where it is, whose it is, and how long it has been on the
         * track.  The warning it gives is a duration, so it has to be readable
         * as one rather than guessed at from a screenshot.
         */
        flyNow: () => ({
          on: fly.on,
          gold: fly.gold,
          t: fly.t,
          warn: FLY_WARN_S,
          target: fly.target,
          x: START_X + fly.x,
          y: LANE_T + fly.lane * LANE_H + LANE_H / 2 + 1,
          lane: fly.lane,
          licking: racers.some((r) => r.i === fly.target && r.going === 'eat'),
        }),
        /**
         * The bird: which beat it is on and where it is, in lane-relative
         * pixels, so a harness can watch it leave the top of the picture
         * rather than trust that it did.
         */
        birdNow: () => ({
          phase: bird.phase,
          target: bird.target,
          x: START_X + bird.x,
          /** Negative is up off the lane it is working; see `stepBird`. */
          y: bird.y,
        }),
        /**
         * `n` fresh cards, dealt but never run.  The bug's window is a
         * DISTRIBUTION -- usually late, sometimes less so -- and a distribution
         * cannot be checked by watching one race.
         */
        cards: (n: number) =>
          Array.from({ length: n }, () => bookField().map((b) => ({ at: b.at, kind: b.kind }))),
        raceLength: RACE_S,
        /** The comeback as it stands in this race: armed, lit, and who is flying. */
        jet: () => ({
          armed: jet.armed,
          who: jet.who,
          flying: racers.filter((r) => r.jet > 0).map((r) => RUNNERS[r.i].name),
        }),
        jetWindow: JET_WINDOW_S,
        /** How many frogs are actually in the race.  See FIELD. */
        runners: FIELD,
        /**
         * Start one effect on one frog, through the same `fire` the card
         * uses -- so what a harness watches is the mechanic and not a second
         * copy of it.  Returns false if that frog is busy.
         */
        fire: (kind: EffectKind, who = 0) => {
          const r = racers.find((o) => o.i === who);
          return r ? fire(kind, r, bird, fly) : false;
        },
        kinds: [...EFFECTS],
        /** The trap and the rock on every lane, as drawn. */
        gearNow: () =>
          racers.map((r) => {
            const g = gear.get(r.i);
            return {
              trap: r.trap,
              trapX: r.trapX,
              rock: r.rock,
              jawL: g?.jawL.rotation,
              jawR: g?.jawR.rotation,
              trapShown: g?.trap.visible,
              rockShown: g?.rock.visible,
            };
          }),
        /** Holes and puddles on every lane, in pixels along the track. */
        furniture: () => racers.map((r) => ({ holes: r.holes.map((h) => h * DIST), puddles: r.puddles.map((q) => q * DIST) })),
        /** Deal fresh fields and report the closest any puddle came to a hole on its lane. */
        /** Where each row's numbered button is, in game pixels. */
        rows: () => rows.map((r) => ({ x: r.plate.x, y: r.plate.y, w: r.plate.width, h: r.plate.height })),
        waterGap: (n: number) => {
          let worst = Infinity;
          for (let k = 0; k < n; k++) {
            for (const f of makeField()) {
              for (const h of f.holes) for (const q of f.puddles) worst = Math.min(worst, Math.abs(h - q) * DIST);
            }
          }
          return worst;
        },
        /** The card of effects as it stands, and what each frog is in. */
        effects: () => ({
          card: card.map((b) => ({ at: Math.round(b.at * 100) / 100, who: RUNNERS[b.who].name, kind: b.kind, done: b.done })),
          on: racers.map((r) => ({ name: RUNNERS[r.i].name, fx: r.fx, going: r.going, had: [...r.had] })),
          spread: racers.length ? Math.max(...racers.map((r) => r.x)) - Math.min(...racers.map((r) => r.x)) : 0,
          dist: DIST,
        }),
        /**
         * THE RACE, MEASURED, over whole fields: how long it takes, how close
         * they are, whether every frog got something and whether the leader at
         * two thirds is the frog that wins.  It runs the same model the player
         * watches -- the card, the bird, the fly, the jetpack and the tow.
         */
        shape: (n: number) => {
          let total = 0;
          let capped = 0;
          let allFed = 0;
          let distinct = 0;
          let gapSum = 0;
          let gapWorst = 0;
          let lateSum = 0;
          let heldOn = 0;
          let effTotal = 0;
          // ---- THE SPACING, which is what a player actually reads.
          //
          // Measured between NEIGHBOURS in the running order rather than
          // between first and last: what says "he is second and he is third"
          // is the gap between those two, and a field can be four pixels end
          // to end with three invisible gaps in it.  Reported in seconds of
          // running, because that is the unit the race is designed in.
          let adjSum = 0;
          let adjN = 0;
          let adjTightest = 999;
          let sameSpot = 0;
          let marginSum = 0;
          let marginWorst = 999;
          let swaps = 0;
          let tooClose = 0;
          for (let k = 0; k < n; k++) {
            const runs = toRuns(makeField());
            const b = makeBird();
            const f = makeFly();
            const cd = bookField();
            const jt = makeJet();
            const dt = 1 / 60;
            let t = 0;
            let done = 0;
            let leadLate = -1;
            let spreadLate = 0;
            let wasLead = -1;
            let sampled = 0;
            while (t < RACE_S) {
              t += dt;
              stepCard(cd, runs, b, f, t);
              for (const r of runs) step(r, dt, runs);
              stepBird(b, runs, t, dt);
              stepFly(f, runs, t, dt);
              stepJet(jt, runs, t, dt);
              if (leadLate < 0 && t >= RACE_S * 0.66) {
                leadLate = runs.reduce((a, o) => (o.x > a.x ? o : a)).i;
                spreadLate = Math.max(...runs.map((o) => o.x)) - Math.min(...runs.map((o) => o.x));
              }
              // Every tenth of a second: the gaps between neighbours, and
              // whether the frog in front has changed.
              if (t - sampled >= 0.1) {
                sampled = t;
                const order = [...runs].sort((a, o) => o.x - a.x);
                if (order[0].i !== wasLead) {
                  if (wasLead >= 0) swaps++;
                  wasLead = order[0].i;
                }
                for (let q = 1; q < order.length; q++) {
                  const gap = order[q - 1].x - order[q].x;
                  adjSum += gap;
                  adjN++;
                  adjTightest = Math.min(adjTightest, gap);
                  if (gap < 2) sameSpot++;
                }
              }
              if (runs.some((r) => r.going !== 'taken' && r.x >= DIST)) {
                done = t;
                break;
              }
            }
            // How far clear the winner was as it crossed.
            const line = [...runs].sort((a, o) => o.x - a.x);
            const margin = line.length > 1 ? line[0].x - line[1].x : 0;
            marginSum += margin;
            marginWorst = Math.min(marginWorst, margin);
            // Two pixels is half a frog: under that the player cannot see who
            // won, which is the one finish this race is not allowed to have.
            if (margin < 2) tooClose++;
            if (!done) capped++;
            total += done || RACE_S;
            // How close they were at the line, and at two thirds.
            const gap = Math.max(...runs.map((o) => o.x)) - Math.min(...runs.map((o) => o.x));
            gapSum += gap;
            gapWorst = Math.max(gapWorst, gap);
            lateSum += spreadLate;
            const won = settleField(runs);
            if (won === leadLate) heldOn++;
            // THE PROMISE, MEASURED.  Every frog gets one of the four the
            // card guarantees, and those four are different from each other --
            // asked of the bookings themselves, because the extras sprinkled
            // on top can land first and would otherwise be counted as the
            // guarantee.
            const core = cd.filter((x) => x.core && x.done);
            // Asked of the frogs, not of the paperwork: a booking that was
            // sent and missed is not an effect the frog had.
            if (runs.every((r) => r.had.length > 0)) allFed++;
            if (new Set(core.map((x) => x.kind)).size === FIELD) distinct++;
            effTotal += runs.reduce((a, r) => a + r.had.length, 0);
          }
          return {
            races: n,
            meanSeconds: total / n,
            hitTheCap: capped / n,
            everyFrogFed: allFed / n,
            allDifferent: distinct / n,
            meanEffects: effTotal / n,
            meanFinishGap: gapSum / n,
            worstFinishGap: gapWorst,
            meanGapTwoThirds: lateSum / n,
            leaderHeldOn: heldOn / n,
            dist: DIST,
            // ---- spacing, in seconds of running
            meanNeighbourGap: adjN ? adjSum / adjN / BASE : 0,
            /** The same gap in pixels, which is what the player can actually see. */
            meanNeighbourPx: adjN ? adjSum / adjN : 0,
            tightestGap: adjTightest / BASE,
            /** How much of the race has two frogs inside two pixels of each other. */
            onTopOfEachOther: adjN ? sameSpot / adjN : 0,
            meanWinMargin: marginSum / n / BASE,
            closestFinish: marginWorst / BASE,
            leadChanges: swaps / n,
            tooCloseToCall: tooClose / n,
          };
        },
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
            const cd = bookField();
            const jt = makeJet();
            const dt = 1 / 60;
            let t = 0;
            let done = 0;
            let grabbed = false;
            while (t < RACE_S) {
              t += dt;
              stepCard(cd, runs, b, f, t);
              for (const r of runs) step(r, dt, runs);
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
            const cd = bookField();
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
              stepCard(cd, runs, b, f, t);
              for (const r of runs) step(r, dt, runs);
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
        callT = 0.8;
        audio.sfx('buzzer', 0.4);
      }
    } else if (phase === 'racing') {
      raceT += dt;
      // One tick of the model, and it is the SAME model the sampler runs.
      // The card first: an effect that is due this tick starts before
      // anything moves, so it is never a frame late.
      stepCard(card, racers, bird, fly, raceT);
      for (const r of racers) step(r, dt, racers);
      stepBird(bird, racers, raceT, dt);
      stepFly(fly, racers, raceT, dt);
      // ---- AND EVERY EVENT MAKES A NOISE.
      //
      // Read off `fx` changing rather than played from inside `fire`, because
      // `fire` is also run thousands of times by the headless sampler that
      // works out the odds -- a sound in there would be a sound for a race
      // nobody is watching.
      for (const r of racers) {
        const was = fxWas.get(r.i) ?? null;
        if (r.fx !== was) {
          fxWas.set(r.i, r.fx);
          if (r.fx && FX_SOUND[r.fx]) audio.sfx(FX_SOUND[r.fx]!, FX_VOL[r.fx] ?? 0.5);
          if (r.fx === 'bird' && r.going === 'taken') call(`A HAWK TAKES ${RUNNERS[r.i].name}`, PALETTE.blood);
          if (r.fx === 'golden') call(`${RUNNERS[r.i].name} GULPS A GOLDEN FLY`, PALETTE.gold);
          if (r.fx === 'fly') call(`${RUNNERS[r.i].name} EATS A BUG - OUT COLD`, PALETTE.ash);
          if (r.fx === 'puddle') call(`${RUNNERS[r.i].name} HITS THE WATER`, PALETTE.fog);
        }
      }
      // ---- WHAT JUST HAPPENED, said out loud and shown.  The model leaves a
      // cue on the frog; this is the one place that turns it into a sound, a
      // line of commentary and the dust, and clears it.
      for (const r of racers) {
        if (r.cue) {
          onCue(r, r.cue);
          r.cue = '';
        }
      }
      if (!finaleOn && raceT >= FINALE_FROM * RACE_S && winner < 0) {
        finaleOn = true;
        call('FINAL STRETCH!', PALETTE.gold, 1.8);
        audio.sfx('bell_ding', 0.6);
        sceneRef.cameras.main.shake(260, 0.0025);
      }
      callT -= dt;
      if (callT <= 0 && banner) {
        banner.setText(finaleOn ? 'FINAL STRETCH' : '');
        banner.setTint(PALETTE.gold);
        banner.setAlpha(finaleOn ? 0.55 + 0.45 * Math.abs(Math.sin(clock / 180)) : 1);
      }
      const wasLit = jet.who;
      stepJet(jet, racers, raceT, dt);
      if (jet.who >= 0 && wasLit < 0) {
        audio.sfx('throw_whoosh', 0.75);
        call(`${RUNNERS[jet.who].name} LIGHTS A JETPACK!`, PALETTE.gold);
      }
      if (bird.phase === 1 && bird.t <= dt) audio.sfx('throw_whoosh', 0.5);

      const home = racers.filter((r) => r.going !== 'taken' && r.x >= DIST);
      // First past the post, or -- at twenty seconds -- whoever is furthest.
      if (home.length || raceT >= RACE_S) {
        winner = settleField(racers);
        settle();
      }
    }

    // ---- where everything is drawn.
    //
    // NOTHING IN HERE DECIDES ANYTHING.  Every branch reads a number the model
    // already settled and turns it into a pose, so an animation can never put
    // a frog somewhere the race does not think it is.
    for (const r of racers) {
      const laneY = LANE_T + r.i * LANE_H + LANE_H / 2 + 1;
      const body = r.body;
      body.setPosition(START_X + r.x, laneY - r.lift);
      body.setVisible(true);
      body.setAlpha(1);
      // ---- ANYTHING OFF THE GROUND IS DRAWN OVER EVERYTHING ON IT.
      //
      // A lane is twenty-one pixels and a balloon lifts a frog twelve, so a
      // frog in the air is over the lane above it whatever the numbers are.
      // Depth by height settles it the way the eye already reads it: the
      // higher thing is the nearer thing.  A frog in the beak goes over the
      // bird as well -- it is in its claws, not behind it.
      // ---- AND WHO IS IN FRONT OF WHOM.
      //
      // The crowd is at the back and lane four is nearest the camera, so a
      // lower lane draws over a higher one: where two frogs do overlap -- at
      // the top of a hop, or under a balloon -- it reads as one being in
      // front of the other rather than as two shapes fighting.  Height still
      // wins over lane, because a frog in the air is nearer than either.
      body.setDepth(r.going === 'taken' ? 39 : 10 + r.i * 0.6 + Math.min(8, r.lift / 2.5));
      /** Legs flung out wide, 0 to 1: set by a fall, read by the legs below. */
      let splay = 0;
      /** Where in a stride the legs are drawn: the hop, unless they are scrabbling. */
      let legU = r.hop;
      /** Spray coming off it as it skids, 0 to 1. */
      let spray = 0;

      if (r.going === 'hole') {
        // Down in a hole: sunk to the shoulders, and scrabbling.
        body.setScale(1, 0.45);
        body.setRotation(0);
        body.y = laneY + 3 + Math.sin(clock / 60) * 0.6;
      } else if (r.going === 'slip' || r.going === 'crash') {
        // ---- LOSING IT.
        //
        // A SLIP starts as a loss of traction you can see: the feet scrabble
        // faster than the frog is going and it rocks back on them.  Then they
        // shoot out from under it and it goes down hard on its backside,
        // skids on across the grass with its legs flung out and spray coming
        // off it, and scrambles up.  A CRASHED LANDING skips the scrabble --
        // it arrives nose first and cartwheels once before it skids.
        //
        // `p` runs 0 to 1 across the whole thing, so every beat is a slice of
        // one clock and none of them can drift out of step with the model.
        const crash = r.going === 'crash';
        const total = crash ? CRASH_S : SLIP_S;
        const p = Phaser.Math.Clamp(1 - r.stuck / total, 0, 1);
        const lose = crash ? 1 : Phaser.Math.Clamp(p / 0.2, 0, 1);
        const scrabble = crash ? 0 : 1 - lose;
        const goes = crash ? 0 : 0.2;
        const down = ease(Phaser.Math.Clamp((p - goes) / 0.1, 0, 1));
        const bump = Math.sin(Phaser.Math.Clamp((p - goes - 0.08) / 0.14, 0, 1) * Math.PI);
        const up = ease(Phaser.Math.Clamp((p - 0.74) / 0.26, 0, 1));
        const sit = down * (1 - up);
        const hop = Math.sin(up * Math.PI);
        splay = sit;
        spray = sit * Phaser.Math.Clamp(r.slide * 1.6, 0, 1);
        if (scrabble > 0) legU = (clock / 55) % 1;
        // rocking back on the scrabble, over onto its seat, a jolt as it lands
        let rot = -0.34 * lose * (1 - down) + Math.sin(clock / 22) * 0.1 * scrabble;
        rot += -0.26 * sit * (1 - bump) + Math.sin(clock / 70) * 0.05 * sit;
        if (crash) rot -= Math.PI * 2 * ease(Phaser.Math.Clamp(p / 0.34, 0, 1));
        body.setScale(1 + 0.22 * sit - 0.1 * bump - 0.06 * hop, 1 - 0.28 * sit + 0.12 * bump + 0.12 * hop);
        body.setRotation(rot);
        body.y = laneY + 3 * sit - 2.5 * bump - 3 * hop - (crash ? 6 * Math.sin(Phaser.Math.Clamp(p / 0.34, 0, 1) * Math.PI) : 0);
      } else if (r.going === 'hit') {
        // ---- FLATTENED.  Pressed into the grass under the rock, quivering,
        // then it peels itself up and shakes it off.
        const p = Phaser.Math.Clamp(1 - r.stuck / ROCK_HIT_S, 0, 1);
        const flat = 1 - ease(Phaser.Math.Clamp((p - 0.55) / 0.3, 0, 1));
        const shake = Math.sin(clock / 18) * 0.05 * flat;
        const pop = Math.sin(Phaser.Math.Clamp((p - 0.82) / 0.18, 0, 1) * Math.PI);
        splay = flat;
        body.setScale(1 + 0.45 * flat + shake, 1 - 0.55 * flat + 0.1 * pop);
        body.setRotation(shake);
        body.y = laneY + 4.5 * flat - 3 * pop;
      } else if (r.going === 'caught') {
        // ---- IN THE JAWS.  Heaving against them, side to side, and then it
        // wrenches free with a hop.
        const p = Phaser.Math.Clamp(1 - r.stuck / TRAP_S, 0, 1);
        const heave = Math.sin(clock / 48);
        const free = Math.sin(Phaser.Math.Clamp((p - 0.84) / 0.16, 0, 1) * Math.PI);
        legU = (clock / 90) % 1;
        body.setScale(1 + 0.06 * Math.abs(heave), 0.9 - 0.05 * Math.abs(heave) + 0.12 * free);
        body.setRotation(heave * 0.26 * (1 - free));
        body.y = laneY + 1 - 4 * free;
      } else if (r.going === 'falling') {
        // ---- COMING DOWN OUT OF THE SKY.
        //
        // Drawn at its OWN place on its OWN lane -- this is the whole reason
        // `falling` exists as a state rather than being part of `taken`, which
        // pins the frog to the bird's beak.
        //
        // It tumbles, and it tumbles FASTER the further it has fallen, because
        // a thing that has been falling for a while is turning quicker than a
        // thing that has just been let go.  The legs go the whole way down:
        // nothing about a dropped frog is calm.
        const f = r.fell;
        body.setPosition(START_X + r.x, laneY - r.lift);
        // stretched out at the top of the fall, bracing as the ground arrives
        //
        // It does not spin.  A face-on frog turned end over end is a smear,
        // not a frog: it comes down the right way up in a starfish, legs
        // flung out and kicking, rocking side to side, and tucks up to brace
        // as the ground arrives.
        const brace = ease(Math.max(0, (f - 0.7) / 0.3));
        splay = 1 - brace;
        body.setScale(0.94 + 0.16 * brace, 1.1 - 0.22 * brace);
        body.setRotation(Math.sin(clock / 85) * 0.3 * (1 - brace));
      } else if (r.going === 'taken') {
        // ---- HELD IN THE BEAK, and held THERE.  The frog is drawn at the
        // beak -- the bird's position plus the beak's own offset inside its
        // drawing -- so it cannot hang in the air under a bird that has flown
        // on without it.
        body.setPosition(START_X + bird.x + BEAK.x, laneY + bird.y + BEAK.y);
        body.setScale(0.95, 1.12);
        // It struggles.  Slower and smaller as the carry goes on.
        body.setRotation(Math.sin(clock / 55) * 0.4 * (r.lift / BIRD_LIFT));
      } else if (r.jet > 0) {
        // ---- ON THE JETPACK.  Flat out, nose up, and shaking with it.
        body.setScale(1.18, 0.88);
        body.setRotation(-0.22 + Math.sin(clock / 30) * 0.05);
        body.y = laneY - r.lift;
      } else if (r.going === 'dizzy') {
        // ---- FLAT, THEN WOBBLING, THEN UP.
        //
        // The first beat is the landing itself: squashed wide and low, which
        // is what a dropped frog looks like for a tenth of a second.  Then it
        // sits up and sways while it sees stars, and over the last beat it
        // straightens out -- so it is running again from a frog that got up,
        // not from a pose that vanished.
        //
        // The landing has a BOUNCE in it: flat on impact, a little rebound
        // hop off the grass, a second smaller squash to settle, then the
        // dazed sway.  One squash and straight into swaying read as the frog
        // being stamped flat rather than dropped.
        const left = r.stuck / DIZZY_S;
        const t = 1 - left;
        const splat = 1 - ease(Math.min(1, t / 0.1));
        const rebound = Math.sin(Phaser.Math.Clamp((t - 0.06) / 0.14, 0, 1) * Math.PI);
        const settle = Math.sin(Phaser.Math.Clamp((t - 0.2) / 0.08, 0, 1) * Math.PI);
        const up = ease(Math.max(0, (0.28 - left) / 0.28));
        const sway = Math.sin(clock / 105) * (1 - up) * (t > 0.28 ? 1 : 0);
        splay = Math.max(splat, settle * 0.5);
        body.setScale(
          1 + 0.36 * splat - 0.08 * rebound + 0.14 * settle + 0.06 * (1 - up),
          1 - 0.42 * splat + 0.14 * rebound - 0.16 * settle - 0.08 * (1 - up),
        );
        body.setRotation(sway * 0.16);
        body.y = laneY + 3 * splat - 4 * rebound + 1.4 * settle + 1.2 * (1 - up) * (t > 0.28 ? 1 : 0);
      } else if (r.going === 'sleep') {
        // ---- ASLEEP, and waking up out of it.  Sat back on its haunches,
        // breathing slowly, then a stretch and a shake in the last beat so it
        // does not simply start running from a sitting position.
        const waking = r.stuck < WAKE_S;
        const w = waking ? ease(1 - r.stuck / WAKE_S) : 0;
        const breath = Math.sin(clock / 260);
        body.setScale(1.12 + breath * 0.05 - w * 0.12, 0.7 - breath * 0.04 + w * 0.3);
        body.setRotation(0.12 - w * 0.12 + (waking ? Math.sin(clock / 30) * 0.05 * w : 0));
        body.y = laneY + 3 * (1 - w);
      } else if (r.going === 'eat') {
        // ---- AFTER THE FLY.  Up on its back legs, leaning into the lick.
        body.setScale(0.9, 1.14);
        body.setRotation(-0.2);
        body.y = laneY - 1;
      } else if (r.going === 'splash') {
        // ---- OUT OF THE PUDDLE.  Shot up by the water, arms out, and it
        // comes down flatter than it went up.
        const k = 1 - r.splash;
        body.setScale(1 - 0.14 * Math.sin(k * Math.PI), 1 + 0.2 * Math.sin(k * Math.PI));
        body.setRotation(Math.sin(k * Math.PI * 2) * 0.3);
        body.y = laneY - r.lift;
      } else if (r.going === 'jump') {
        // ---- A LAUNCH.  Driven off the log stretched out, tucked at the top,
        // reaching for the ground coming in.  A leap that is going to crash
        // starts to go over from the top of the arc -- legs flailing, turning
        // -- so the landing is something the player saw coming.
        const span = r.arcS > 0 ? r.arcS : JUMP_S;
        const k = 1 - Phaser.Math.Clamp(r.stuck / span, 0, 1);
        const v = 1 - 2 * k;
        const tuck = 1 - Math.abs(v);
        body.setScale(1 - 0.1 * Math.abs(v) + 0.06 * tuck, 1 + 0.16 * Math.abs(v) - 0.08 * tuck);
        let rot = 0.12 - 0.18 * v;
        if (r.crash) {
          const wrong = Phaser.Math.Clamp((k - 0.45) / 0.55, 0, 1);
          rot += 1.1 * wrong * wrong + Math.sin(clock / 30) * 0.2 * wrong;
          splay = wrong;
          legU = (clock / 70) % 1;
        }
        body.setRotation(rot);
        body.y = laneY - r.lift;
      } else if (phase !== 'racing') {
        // ---- ON THE START LINE, AND STOOD ON IT.
        //
        // Every frog is given a random point in its hop cycle when the field
        // is dealt, so that they are not all bouncing in step once the gun
        // goes.  Before the gun nothing advances that cycle -- so each frog
        // sat FROZEN at whatever frame it was handed: one flat on its belly at
        // 0.66 of its height, one stretched at 1.2, one somewhere between.
        // Four frogs at four different squashes, none of them moving, which
        // reads as four badly drawn frogs rather than as four frogs waiting.
        //
        // They stand up and breathe instead until the race starts, on their
        // own clocks so the line is not a chorus line.  The feet stay pinned
        // the same way the hop pins them.
        const breath = Math.sin(clock / 540 + r.i * 1.7) * 0.022;
        const sy = 1 + breath;
        body.setScale(1 - breath * 0.6, sy);
        body.setRotation(0);
        body.y = laneY - r.lift + FOOT * (1 - sy);
      } else {
        // Compressed on the lane, stretched off it, tucked at the top.  The
        // feet are pinned as it squashes — a frog that shrinks about its
        // middle sinks into the track instead of flattening onto it.
        const p = hopPose(r.hop);
        // Flat out -- a golden fly, a burst, the fright of a near miss -- it
        // leans hard into the way it is going and stretches long.
        const flat = r.gold > 0 || r.rush > 0;
        const lean = flat ? 0.2 : finaleOn ? 0.06 : 0;
        body.setScale(p.sx * (flat ? 1.08 : 1), p.sy * (flat ? 0.96 : 1));
        body.setRotation(p.rot + lean);
        body.y = laneY - r.lift + FOOT * (1 - p.sy);
      }

      // ---- THE PROPS.  Each is the visible half of a rule in `step`, and
      // every one of them is read off the model rather than kept on a timer
      // of its own -- so what is on the screen and what is moving the frog
      // cannot disagree.
      const showProp = (key: string, on: boolean): Phaser.GameObjects.Container | undefined => {
        const g = body.getData(key) as Phaser.GameObjects.Container | undefined;
        g?.setVisible(on);
        return on ? g : undefined;
      };
      const sp = showProp('splashArt', r.going === 'splash');
      if (sp) sp.setScale(1, 0.5 + r.splash);

      // ---- FALLING, WHICH IS NOT THE SAME AS DESCENDING.
      //
      // A frog that has lost its balloon or run its jetpack dry used to come
      // straight down like a dropped weight.  It turns over now and its legs
      // go, and the higher it was when it started coming down the more of
      // both -- so a long fall reads as a long fall and not as a short one
      // played further away.
      const prevLift = (body.getData('prevLift') as number | undefined) ?? r.lift;
      body.setData('prevLift', r.lift);
      let paddle = 0;
      if (r.lift < prevLift - 0.02 && r.lift > 1 && r.going !== 'taken') {
        const high = Phaser.Math.Clamp(r.lift / (JUMP_H / 2), 0, 1);
        // the bird's drop draws its own rock (see `falling`); anything else
        // coming down gets this one
        if (r.going !== 'falling' && r.going !== 'jump') body.setRotation(body.rotation + Math.sin(clock / 46) * 0.3 * high);
        paddle = 1 + high * 2.4;
      }

      // ---- AND THE LEGS.
      //
      // Posed off the SAME `r.hop` the body squash is posed from, so the
      // push-off and the stretch are the same instant rather than two
      // animations that happen to look alike.  A fall overrides them into a
      // paddle, because a frog in trouble kicks.
      const legRear = body.getData('legRear') as Phaser.GameObjects.Container | undefined;
      const legFore = body.getData('legFore') as Phaser.GameObjects.Container | undefined;
      if (legRear && legFore) {
        const lp = legPose(legU);
        const kickA = paddle > 0 ? Math.sin(clock / 34) * paddle : 0;
        const kickB = paddle > 0 ? Math.sin(clock / 34 + 2.1) * paddle : 0;
        // Seen from the front, the big back legs are a pair out either side:
        // they drive DOWN and splay on the push, fold up tight at the top of
        // the hop, and splay again to take the landing.  The front feet do the
        // same under the chest, smaller.
        // `splay` flings both pairs out wide: a frog sat down hard, or one
        // coming down out of the sky in a starfish.
        legRear.setPosition(REAR_LEG.x + kickA * 0.5, REAR_LEG.y + lp.rear.y * 1.2 * (1 - splay) - Math.abs(kickA) * 0.4 - splay * 1.2);
        legRear.setScale((1 + lp.rear.x * 0.06 + Math.abs(lp.rear.a) * 0.1) * (1 + 0.32 * splay), 1 - 0.12 * splay);
        legRear.setRotation(kickA * 0.18);
        legFore.setPosition(FORE_LEG.x + kickB * 0.4, FORE_LEG.y + lp.fore.y * 0.9 * (1 - splay) - Math.abs(kickB) * 0.4 + splay * 0.6);
        legFore.setScale((1 + lp.fore.x * 0.05) * (1 + 0.7 * splay), 1);
        legFore.setRotation(kickB * 0.18);
      }

      // ---- THE FACE.  A blink on its own clock, and a mood read off what
      // the race is doing to this frog.  Nothing here is decided twice: the
      // expression is a function of the state the model already keeps.
      let blinkIn = (body.getData('blinkIn') as number) - delta;
      let blinking = (body.getData('blink') as number) - delta;
      if (blinkIn <= 0) {
        blinking = 110;
        blinkIn = 1600 + Math.random() * 3200;
      }
      body.setData('blinkIn', blinkIn);
      body.setData('blink', Math.max(0, blinking));
      // A blink is a lid down and up inside a tenth of a second.
      const shut = blinking > 0 ? Math.sin((1 - blinking / 110) * Math.PI) : 0;
      wearMood(body, moodOf(r, clock), shut, dt);

      // ---- THE EXTRAS.  Each is a child of the frog, so it moves, scales and
      // turns with it and cannot drift off the body it belongs to.
      const zzz = body.getData('zzz') as Phaser.GameObjects.BitmapText | undefined;
      if (zzz) {
        const napping = r.going === 'sleep' && r.stuck > WAKE_S;
        zzz.setVisible(napping);
        if (napping) {
          zzz.setY(-10 - ((clock / 90) % 6));
          zzz.setAlpha(1 - ((clock / 90) % 6) / 8);
        }
      }
      // ---- THE SPRAY off a skid: grass and water thrown up from its heels.
      const sprayBits = body.getData('spray') as Phaser.GameObjects.Rectangle[] | undefined;
      if (sprayBits) {
        sprayBits.forEach((bit, k) => {
          bit.setVisible(spray > 0.05);
          if (spray <= 0.05) return;
          const t = ((clock / 160 + k * 0.27) % 1);
          bit.setPosition(9 + t * 9 + k, 6 - Math.sin(t * Math.PI) * (4 + k * 1.5));
          bit.setAlpha((1 - t) * spray);
        });
      }
      // ---- A NEAR MISS: the "!" over its head.
      const alert = body.getData('alert') as Phaser.GameObjects.BitmapText | undefined;
      if (alert) {
        const left = Math.max(0, ((body.getData('alertT') as number) ?? 0) - dt);
        body.setData('alertT', left);
        alert.setVisible(left > 0);
        if (left > 0) alert.setY(-24 - (0.7 - left) * 8);
      }
      const pack = body.getData('jet') as Phaser.GameObjects.Container | undefined;
      if (pack) {
        pack.setVisible(r.jet > 0);
        if (r.jet > 0) {
          const lick = 0.7 + Math.abs(Math.sin(clock / 40)) * 0.8;
          (body.getData('flame') as Phaser.GameObjects.Triangle).setScale(lick, 1);
          (body.getData('ember') as Phaser.GameObjects.Triangle).setScale(lick * 1.2, 1);
        }
      }
      const tongue = body.getData('tongue') as Phaser.GameObjects.Rectangle | undefined;
      if (tongue) {
        tongue.setVisible(r.going === 'eat');
        if (r.going === 'eat') {
          const reach = r.tongue * TONGUE_REACH;
          tongue.setSize(Math.max(1, reach), 2);
          tongue.setPosition(3.4 + reach / 2, MOUTH_Y);
        }
      }
      // ---- THE SUGAR.  Three streaks off its back, drawn only while it runs.
      const trail = body.getData('trail') as Phaser.GameObjects.Rectangle[] | undefined;
      if (trail) {
        const going = (r.gold > 0 || r.rush > 0) && r.going === 'run';
        trail.forEach((line, k) => {
          line.setVisible(going);
          if (!going) return;
          const wag = ((clock / 26 + k * 2) % 6) / 6;
          line.setSize(5 + wag * 8, 1);
          line.setPosition(-8 - wag * 7, -3 + k * 3);
          line.setAlpha(0.85 - wag * 0.7);
          line.setFillStyle(r.gold > 0 ? PALETTE.gold : PALETTE.cream);
        });
      }
      // ---- THE STARS, going round its head for as long as it is dizzy.
      const stars = body.getData('stars') as Phaser.GameObjects.Container[] | undefined;
      if (stars) {
        const seeing = r.going === 'dizzy';
        stars.forEach((st, k) => {
          st.setVisible(seeing);
          if (!seeing) return;
          // An ellipse rather than a circle, because a ring of stars seen from
          // slightly above is an ellipse, and it keeps them off the frog.
          const a = clock / 150 + (k * Math.PI * 2) / 3;
          st.setPosition(Math.cos(a) * 8.5, -12 + Math.sin(a) * 2.6);
          // The ones going round the back are smaller and dimmer.
          const far = (Math.sin(a) + 1) / 2;
          st.setScale(0.7 + far * 0.45);
          st.setAlpha(0.55 + far * 0.45);
          st.setRotation(a * 1.5);
        });
      }

      // ---- THE GOLDEN FLY'S SPARKLE, for as long as the sugar lasts.
      const spark = body.getData('spark') as Phaser.GameObjects.Rectangle[] | undefined;
      if (spark) {
        const lit = r.gold > 0;
        spark.forEach((bit, k) => {
          bit.setVisible(lit);
          if (!lit) return;
          const a = clock / 140 + (k * Math.PI * 2) / 3;
          bit.setPosition(Math.cos(a) * 9, -4 + Math.sin(a) * 6);
          bit.setAlpha(0.4 + 0.6 * Math.abs(Math.sin(a * 2)));
        });
      }
    }

    // ---- THE TRACK FURNITURE THE EVENTS BRING WITH THEM: the rock and its
    // shadow, the trap, the log, the dust and the skid marks.
    for (const r of racers) {
      const g = gear.get(r.i);
      if (g) drawGear(r, g, LANE_T + r.i * LANE_H + LANE_H / 2 + 1, dt);
      // a scuff of dust where it lands, every hop, more of it flat out
      const body = r.body;
      const prevHop = (body.getData('prevHop') as number | undefined) ?? r.hop;
      body.setData('prevHop', r.hop);
      if (phase === 'racing' && r.going === 'run' && r.hop < prevHop - 0.5) {
        const flat = r.rush > 0 || r.gold > 0;
        spawnDust(START_X + r.x - 3, LANE_T + r.i * LANE_H + LANE_H / 2 + 7, flat ? 2 : 1, flat ? 16 : 9);
      }
    }
    stepPuffs(dt);
    stepSkids(dt);

    // ---- the fly, closing on the frog it was sent to
    if (flyArt) {
      flyArt.setVisible(fly.on);
      if (fly.on) {
        // A little bob on the way in, because a fly does not fly in a straight
        // line and a wobble is the thing the eye catches.
        const bob = Math.sin(clock / 70) * 1.6;
        flyArt.setPosition(START_X + fly.x, LANE_T + fly.lane * LANE_H + LANE_H / 2 + 1 + bob);
        const beat = 0.35 + 0.65 * Math.abs(Math.sin(clock / 26));
        (flyArt.getData('wing') as Phaser.GameObjects.Ellipse).setScale(1, beat);
        (flyArt.getData('wing2') as Phaser.GameObjects.Ellipse).setScale(1, beat);
        const gold = flyArt.getData('gold') as Phaser.GameObjects.Ellipse;
        const plain = flyArt.getData('plain') as Phaser.GameObjects.Ellipse;
        gold.setVisible(fly.gold);
        plain.setVisible(!fly.gold);
        for (const part of flyArt.getData('face') as Phaser.GameObjects.GameObject[]) {
          (part as Phaser.GameObjects.Rectangle).setVisible(!fly.gold);
        }
        if (fly.gold) gold.setScale(1 + Math.sin(clock / 90) * 0.12);
      }
    }

    // ---- the bird, and the shadow that arrives before it does
    if (birdArt) {
      const on = bird.phase >= 1 && bird.phase <= 4;
      birdArt.setVisible(on);
      if (on) {
        const lane = racers.find((r) => r.i === bird.target);
        const y = lane ? LANE_T + lane.i * LANE_H + LANE_H / 2 + 1 : 100;
        birdArt.setPosition(START_X + bird.x, y + bird.y);
        const wings = birdArt.getData('wings') as Phaser.GameObjects.Ellipse[];
        // Slow and heavy while it is carrying something, quick when it is not.
        const beat = Math.sin(clock / (bird.phase === 2 ? 70 : 42)) * 3;
        wings[0].setY(-3 - beat);
        wings[1].setY(3 + beat);
        birdArt.setRotation(bird.phase === 1 ? 0.25 : bird.phase === 3 ? -0.2 : 0);
      }
      const shade = birdArt.getData('shadow') as Phaser.GameObjects.Ellipse;
      shade.setVisible(on);
      if (on) {
        // On the lane, under the bird, and it grows as the bird comes down.
        const lane = racers.find((r) => r.i === bird.target);
        const y = lane ? LANE_T + lane.i * LANE_H + LANE_H / 2 + 5 : 104;
        const high = Phaser.Math.Clamp(-bird.y / (BIRD_LIFT * 2), 0, 1);
        shade.setPosition(0, y - (birdArt.y ?? 0) + (birdArt.y - birdArt.y));
        shade.setPosition(0, y - birdArt.y);
        shade.setScale(1.4 - high * 0.7, 1.4 - high * 0.7);
        shade.setAlpha(0.45 - high * 0.3);
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
    for (const p of puffs) p.obj.destroy();
    puffs = [];
    skids = [];
    gear.clear();
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
 * race with the bird and the sleeping and the mud in it, not of a clean one.
 *
 * EVERYTHING THAT MOVES A FROG MOVES IT OVER TIME.  There is no branch in here
 * that writes a new `x` in one frame: the staged effects -- the carry, the
 * jump, the balloon -- run from where the frog was to where it is going over
 * their own length, eased at both ends, and everything else is a pace the frog
 * runs at for a while.
 */
function step(r: Run, dt: number, field?: Run[]): void {
  if (r.lean > 0) r.lean = Math.max(0, r.lean - dt);
  if (r.gold > 0) r.gold = Math.max(0, r.gold - dt);
  if (r.rush > 0) r.rush = Math.max(0, r.rush - dt);
  if (r.going === 'run' && !r.gold && r.jet <= 0 && r.rush <= 0 && r.rock <= 0 && r.trap !== 1) r.fx = null;

  // ---- THE ROCK COMES DOWN.  Wherever the frog has got to by then: if it is
  // on its feet and running it is a coin flip, and anything else -- in the
  // air, in the beak, on a jetpack -- is a miss.
  if (r.rock > 0) {
    r.rock -= dt;
    if (r.rock <= 0) {
      r.rock = 0;
      r.rockX = r.x;
      if (r.going === 'run' && r.jet <= 0 && Math.random() < ROCK_ODDS) {
        r.going = 'hit';
        r.stuck = ROCK_HIT_S;
        r.lift = 0;
        r.hop = 0;
        r.fx = 'rock';
        r.cue = 'rock_hit';
      } else {
        rushOn(r, RUSH_S, RUSH_GAIN);
        r.cue = 'rock_miss';
      }
    }
  }

  // ---- IN THE BIRD'S FEET, OR ON ITS WAY DOWN FROM THEM.
  //
  // `stepBird` owns both: it writes the lift for the carry and for the drop,
  // and hands the frog to `dizzy` when it lands.  Falling MUST be in here --
  // the generic stuck-timer below would see a state with no time on its clock
  // and put the frog straight back to running, in mid-air, on the first frame
  // of the fall.
  if (r.going === 'taken' || r.going === 'falling') return;

  // ---- ON THE JETPACK.  Nothing on the track reaches a frog that is off it.
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

  // ---- A LAUNCH.  One arc, from where it took off to where it lands -- the
  // same code for the leap and the hop over a trap, which differ only in
  // `arcS`, `arcH` and what is drawn.
  if (r.going === 'jump') {
    r.stuck -= dt;
    const span = r.arcS > 0 ? r.arcS : JUMP_S;
    const k = Phaser.Math.Clamp(1 - r.stuck / span, 0, 1);
    r.x = Math.min(DIST, r.jumpFrom + (r.jumpTo - r.jumpFrom) * ease(k));
    // A rocket goes up once and stays up until it quits; a frog arcs.
    const h = r.arcH > 0 ? r.arcH : JUMP_H;
    r.lift = r.arcFlat > 0 ? h * Math.min(1, k * 5) * Math.min(1, (1 - k) * 5) : h * 4 * k * (1 - k);
    if (r.stuck <= 0) {
      r.lift = 0;
      r.hop = 0;
      r.arcS = 0;
      r.arcH = 0;
      r.arcFlat = 0;
      r.tongue = 0;
      if (r.crash) {
        // ---- AND IT CAME DOWN WRONG.  Short, nose first, and over it goes.
        r.crash = false;
        r.going = 'crash';
        r.stuck = CRASH_S;
        r.slide = 1;
        r.fx = 'jump';
        r.cue = 'crash';
      } else {
        r.going = 'run';
        if (r.fx === 'jump') r.cue = 'landed';
        r.fx = null;
      }
    }
    return;
  }

  // ---- IN THE PUDDLE.  Straight up on a column of water, straight back
  // down, and a little ground gone while it climbs out.
  if (r.going === 'splash') {
    r.stuck -= dt;
    const k = Phaser.Math.Clamp(1 - r.stuck / PUDDLE_S, 0, 1);
    r.splash = 1 - k;
    r.lift = PUDDLE_H * Math.sin(k * Math.PI);
    r.x = Math.min(DIST, r.x + BASE * PUDDLE_COST * dt);
    if (r.stuck <= 0) {
      r.going = 'run';
      r.lift = 0;
      r.hop = 0;
      r.splash = 0;
      r.fx = null;
    }
    return;
  }

  if (r.going !== 'run') {
    // In a hole, on its face, asleep, or eating.  The clock runs; the frog
    // does not -- except a slip, which slides as it goes down.
    r.stuck -= dt;
    if (r.going === 'eat') {
      // Out and back inside the one beat, so the tongue is a lick rather than
      // a thing that hangs there.
      r.tongue = 1 - Math.abs(1 - (2 * (TONGUE_S - r.stuck)) / TONGUE_S);
      if (r.stuck <= 0) {
        // What was on the end of it decides what happens next.
        r.tongue = 0;
        if (r.fx === 'golden') {
          r.going = 'run';
          r.gold = GOLD_SURGE_S;
          r.hop = 0;
        } else {
          r.going = 'sleep';
          r.stuck = SLEEP_S;
        }
        return;
      }
    }
    if (r.going === 'slip' || r.going === 'crash') {
      // It keeps sliding for a moment after the legs go, and stops dead.
      const k = Phaser.Math.Clamp(r.stuck / (r.going === 'slip' ? SLIP_S : CRASH_S), 0, 1);
      r.slide = k;
      r.x = Math.min(DIST, r.x + BASE * SLIP_SLIDE * k * dt);
    }
    // Out of the jaws: they stay on the lane, shut, and it runs on.
    if (r.going === 'caught' && r.stuck <= 0) r.cue = 'trap_free';
    if (r.stuck <= 0) {
      r.going = 'run';
      r.hop = 0;
      r.tongue = 0;
      r.slide = 0;
      r.fx = null;
    }
    return;
  }

  const t = r.x / DIST;

  const surging = t > r.surgeAt && t < r.surgeAt + r.surgeFor;
  let speed = pace(r, field, surging, dt);
  // The golden surge is a push rather than a gear: worth the same ground
  // whoever it lands on.  So is a burst, and so is the fright of a near miss.
  if (r.gold > 0) speed += (GOLD_GAIN * SEC) / GOLD_SURGE_S;
  if (r.rush > 0) speed += r.rushPush;
  speed = Math.max(2, speed);

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
  // whatever the frame rate.
  r.x = Math.min(DIST, r.x + speed * dt * hopTravel(was, du));

  // ---- THE TRAP, when it gets there.  Hopped as the jaws go, or caught.
  if (r.trap === 1 && r.x >= r.trapX - 5) {
    if (r.x > r.trapX + 6) {
      r.trap = 3; // it was past it before it was ever tested (a jetpack, a leap)
    } else if (Math.random() < TRAP_ODDS) {
      r.trap = 2;
      // the jaws close where the frog is, so that is where they are
      r.trapX = r.x;
      r.going = 'caught';
      r.stuck = TRAP_S;
      r.lift = 0;
      r.hop = 0;
      r.fx = 'snap';
      r.cue = 'trap_caught';
      return;
    } else {
      r.trap = 3;
      launch(r, TRAP_HOP_S, TRAP_HOP_GAIN, TRAP_HOP_H);
      r.fx = 'snap';
      r.cue = 'trap_dodge';
      // the fright carries on past the landing
      rushOn(r, RUSH_S + TRAP_HOP_S, RUSH_GAIN);
      return;
    }
  }

  if (!landed && was <= 1) {
    // A POTHOLE IS TESTED ON THE WAY IN, not on landing: a frog reaching one
    // either clears it in the air or comes down in it.
    while (r.holeAt < r.holes.length && t >= r.holes[r.holeAt]) {
      r.holeAt++;
      if (Math.random() < 0.5) {
        r.going = 'hole';
        r.stuck = HOLE_S;
        r.lift = 0;
        r.x = Math.max(0, r.x - HOLE_BACK);
        return;
      }
    }
    // ---- AND THE PUDDLES, on the same terms: the frog is running into a
    // thing that is drawn on the track in front of it, not being handed an
    // event by the card.
    while (r.puddleAt < r.puddles.length && t >= r.puddles[r.puddleAt]) {
      r.puddleAt++;
      if (Math.random() < PUDDLE_ODDS) {
        splashIn(r);
        return;
      }
    }
    return;
  }

  // Landed clean.  Unless it does not.
  if (Math.random() < SLIP_CHANCE) slipUp(r);
}

/** A spell of flat-out running worth `gain` seconds of ground over `secs`. */
function rushOn(r: Run, secs: number, gain: number): void {
  r.rush = secs;
  r.rushPush = (gain * SEC) / secs;
}

/** Smooth at both ends.  Every staged effect runs through this. */
function ease(k: number): number {
  const u = Phaser.Math.Clamp(k, 0, 1);
  return u * u * (3 - 2 * u);
}

/** Down it goes, wherever it was in its stride. */
/**
 * INTO THE WATER.
 *
 * Shared by the puddles on the track and by `fire`, so there is one answer to
 * what landing in a puddle does and a harness can start one without having to
 * walk a frog onto one.
 */
function splashIn(r: Run): void {
  r.going = 'splash';
  r.stuck = PUDDLE_S;
  r.splash = 1;
  r.lift = 0;
  r.fx = 'puddle';
  r.had.push('puddle');
}

function slipUp(r: Run): void {
  r.going = 'slip';
  r.stuck = SLIP_S;
  r.slide = 1;
  r.lift = 0;
  r.fx = 'slip';
  r.cue = 'slip';
  r.had.push('slip');
}

/**
 * ================= THE CARD, AND WHAT IT PUTS ON WHOM =================
 *
 * `bookField` deals one effect to every frog -- a DIFFERENT one each -- and
 * spaces them down the race, then sprinkles a few extras.  `fire` is the only
 * place an effect starts, so there is one answer to "what can happen to a
 * frog and when", and the harness can read the card rather than watching the
 * screen and hoping.
 */
function bookField(): Booking[] {
  // A puddle is not dealt: it is furniture on the track, and a frog gets one
  // by running into it.  See `digPuddles`.
  const kinds = EFFECTS.filter((k) => k !== 'puddle');
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const band = (BAND_TO - BAND_FROM) / FIELD;
  const out: Booking[] = RUNNERS.map((_, k) => ({
    // One per frog, each in its own band of the race, in a random order of
    // frogs so the lane order is not the order things happen in.
    at: (BAND_FROM + band * (k + 0.15 + Math.random() * 0.7)) * RACE_S,
    who: k,
    kind: kinds[k % kinds.length],
    done: false,
    core: true,
  }));
  // Whose band is whose, shuffled: otherwise lane one is always first.
  const who = [...RUNNERS.keys()];
  for (let i = who.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [who[i], who[j]] = [who[j], who[i]];
  }
  out.forEach((b, k) => (b.who = who[k]));
  // The bug ignores the bands and takes its own late window; see `bugAt`.
  for (const b of out) if (b.kind === 'fly') b.at = bugAt();

  const extras = EXTRA_MIN + Math.floor(Math.random() * (EXTRA_MAX - EXTRA_MIN + 1));
  for (let i = 0; i < extras; i++) {
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    out.push({
      at: kind === 'fly' ? bugAt() : (BAND_FROM + Math.random() * (LAST_CALL - BAND_FROM)) * RACE_S,
      who: Math.floor(Math.random() * FIELD),
      kind,
      done: false,
      core: false,
    });
  }
  // ---- AND THE FINAL STRETCH, which gets one or two big moments of its own.
  const finale = FINALE_MIN + Math.floor(Math.random() * (FINALE_MAX - FINALE_MIN + 1));
  for (let i = 0; i < finale; i++) {
    out.push({
      at: (FINALE_FROM + Math.random() * (FINALE_TO - FINALE_FROM)) * RACE_S,
      who: Math.floor(Math.random() * FIELD),
      kind: FINALE_KINDS[Math.floor(Math.random() * FINALE_KINDS.length)],
      done: false,
      core: false,
      finale: true,
    });
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}

/**
 * Work the card.  A booking whose frog is busy is held rather than dropped --
 * pushed on half a second and tried again -- so the promise that every frog
 * gets one is kept even when two land on the same frog at once.
 */
function stepCard(card: Booking[], runs: Run[], bird: Bird, fly: Fly, raceT: number): void {
  for (const b of card) {
    if (b.done || raceT < b.at) continue;
    const r = runs.find((o) => o.i === b.who);
    if (!r || r.x >= DIST) {
      b.done = true;
      continue;
    }
    // Not while the screen is already full: a race where every frog is in the
    // air at the same moment reads as a bug, not as chaos.
    const busy = runs.filter((o) => o.going !== 'run' || o.jet > 0 || o.rock > 0 || o.trap === 1).length;
    if (busy >= BUSY_CAP) {
      b.at += 0.5;
      continue;
    }
    if (!fire(b.kind, r, bird, fly)) {
      b.at += 0.5;
      continue;
    }
    b.done = true;
  }
}

/**
 * Start one effect on one frog.  Returns false if it cannot be started yet --
 * the frog is already in the middle of something, or the one bird is busy.
 */
function fire(kind: EffectKind, r: Run, bird: Bird, fly: Fly): boolean {
  if (r.going !== 'run' || r.jet > 0 || r.rock > 0 || r.trap === 1) return false;
  switch (kind) {
    case 'bird': {
      if (bird.phase !== 0) return false;
      bird.phase = 1;
      bird.t = 0;
      bird.target = r.i;
      bird.x = r.x + 60;
      bird.y = -BIRD_LIFT * 2;
      // NOT RECORDED HERE.  The bird is only on its way; what has happened to
      // this frog is nothing at all until the beak closes on it, and a card
      // that counted the send-off would count an effect that a frog crossing
      // the line first never actually had.  See `stepBird`.
      return true;
    }
    case 'fly':
    case 'golden': {
      if (fly.on) return false;
      fly.on = true;
      fly.gold = kind === 'golden';
      fly.t = 0;
      fly.target = r.i;
      // Well out in front and two lanes off, so the approach is a flight
      // across the track rather than a pop-in beside the frog.
      fly.x = r.x + 62;
      fly.lane = r.i + (Math.random() < 0.5 ? -2.2 : 2.2);
      // Recorded when it is eaten, not when it is sent.  See `stepFly`.
      return true;
    }
    case 'jump': {
      // Decided at the take-off and SHOWN from the top of the arc: a leap
      // that is going to crash starts to turn over in the air.
      r.crash = Math.random() >= JUMP_CLEAN_ODDS;
      launch(r, JUMP_S, r.crash ? JUMP_GAIN * CRASH_SHORT : JUMP_GAIN, JUMP_H);
      r.cue = 'leap';
      break;
    }
    case 'rock':
      // The shadow is on the lane from this moment; the rock follows it.
      r.rock = ROCK_WARN_S;
      r.cue = 'rock';
      break;
    case 'snap': {
      // Set a second ahead, on clear grass: never in a hole or a puddle.
      const x = clearGround(r, r.x + TRAP_LEAD * SEC);
      if (x > DIST - 14) return false;
      r.trapX = x;
      r.trap = 1;
      r.cue = 'trap';
      break;
    }
    case 'burst': {
      rushOn(r, BURST_S, BURST_GAIN);
      r.cue = 'burst';
      break;
    }
    case 'puddle':
      // The track deals these, not the card -- see `digPuddles`.  Kept here
      // so a harness can start one on demand.
      splashIn(r);
      return true;
    case 'slip':
      slipUp(r);
      return true;
  }
  r.fx = kind;
  r.had.push(kind);
  return true;
}

/**
 * ONE LAUNCH, TWO EVENTS.
 *
 * The leap over the log and the hop over a snapping trap are the same
 * movement: the frog leaves from where it is, arrives somewhere ahead, and
 * takes a fixed time doing it.  What tells them apart is how long, how far,
 * how high -- and the art.
 *
 * `gain` is in SECONDS OF RUNNING, so a mushroom worth one and a half seconds
 * stays worth one and a half seconds if the pace is ever retuned.  And it is
 * clamped to the finish: nothing here can throw a frog past the line it has
 * not run to.
 */
function launch(r: Run, secs: number, gain: number, height: number): void {
  r.going = 'jump';
  r.stuck = secs;
  r.arcS = secs;
  r.arcH = height;
  r.arcFlat = 0;
  r.jumpFrom = r.x;
  r.jumpTo = Math.min(DIST, r.x + (secs + gain) * SEC);
}

/**
 * The first spot at or after `x` that is clear grass on this frog's lane:
 * out of every hole and every puddle by a body's width.  Where the trap goes.
 */
function clearGround(r: Run, x: number): number {
  const busy = [...r.holes, ...r.puddles].map((f) => f * DIST);
  let at = x;
  for (let guard = 0; guard < 6; guard++) {
    const near = busy.find((b) => Math.abs(b - at) < 16);
    if (near === undefined) return at;
    at = near + 16;
  }
  return at;
}

/** A jetpack, or not.  Rolled before the gun, the same as everything else. */
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
 * ends, and lights it.  One per race: it is spent whether it fires or not.
 */
function stepJet(j: Jet, runs: Run[], raceT: number, dt: number): void {
  void dt;
  if (!j.armed) return;
  const live = runs.filter((r) => r.going !== 'taken' && r.x < DIST);
  if (live.length < 2) return;

  const leader = live.reduce((a, b) => (b.x > a.x ? b : a));
  // THE LEADER'S PACE INCLUDES THE ROPE.  Its own form is what it would run
  // alone; out in front it is also carrying the wind and being held back by
  // the field behind it, and a projection that leaves that out reads the
  // leader as arriving sooner than it does -- which lit the burn four or five
  // seconds out instead of in the last stretch.
  const leaderPace = Math.max(4, (BASE + leader.form * SPREAD + leader.luck) * tow(leader, live));
  const endsIn = Math.min((DIST - leader.x) / leaderPace, RACE_S - raceT);
  if (endsIn > JET_WINDOW_S) return;

  // Spent from here, whichever way it goes.
  j.armed = false;

  const last = live.reduce((a, b) => (b.x < a.x ? b : a));
  if (last === leader) return;

  const band = Math.random() < 0.5 ? JET_AIM_EARLY : JET_AIM_LATE;
  const aim = band.min + Math.random() * (band.max - band.min);
  const burn = Phaser.Math.Clamp(endsIn * aim, 0.3, Math.max(0.3, RACE_S - raceT - 0.05));
  const need = (DIST - last.x) / burn;
  if (need > JET_MAX_SPEED) return;

  j.who = last.i;
  // The burn takes it out of whatever it was in -- a hole, a nap, its own face.
  last.going = 'run';
  last.stuck = 0;
  last.tongue = 0;
  last.crash = false;
  last.jet = burn;
  last.jetSpeed = need;
  last.lift = 0;
}

/** The bird, idle until the card calls it. */
function makeBird(): Bird {
  return { phase: 0, t: 0, x: 0, y: 0, target: -1 };
}

/**
 * THE BIRD, IN FOUR BEATS, and the frog never leaves its own lane.
 *
 *   1 APPROACH  it comes in from up the track and drops onto the frog, which
 *               is still running: the shadow arrives before the bird does.
 *   2 LIFT      it has it.  The frog is drawn at the beak and goes straight
 *               UP, over the spot it was standing on -- nothing is carried
 *               anywhere and no ground changes hands.
 *   3 DROP      it lets go and climbs; the frog falls onto its back.
 *   4 AWAY      straight up and out of the top of the picture, and the bird
 *               is done for the race.
 *
 * What it costs is the four seconds between the hook and the frog's next hop,
 * and nothing else.  There is no displacement left to solve for: `BIRD_BACK`,
 * `BIRD_DRIFT` and the whole arithmetic of carrying a frog backwards are gone
 * with the mechanic they served.
 */

function stepBird(b: Bird, runs: Run[], raceT: number, dt: number): void {
  void raceT;
  if (b.phase === 0 || b.phase >= 5) return;
  b.t += dt;
  const r = runs.find((o) => o.i === b.target);
  if (!r) {
    b.phase = 5;
    return;
  }

  if (b.phase === 1) {
    // Down and along, onto a frog that is still running away from it.
    const k = Phaser.Math.Clamp(b.t / BIRD_DIVE_S, 0, 1);
    b.x = r.x + 60 * (1 - ease(k)) + BEAK.x * 0;
    b.y = -BIRD_LIFT * 2 + (BIRD_LIFT * 2 - 2) * ease(k);
    if (k >= 1) {
      b.phase = 2;
      b.t = 0;
      r.going = 'taken';
      r.lift = 0;
      r.hop = 0;
      r.fx = 'bird';
      r.had.push('bird');
    }
    return;
  }

  if (b.phase === 2) {
    // Straight up, over the spot the frog was standing on.  `r.x` is not
    // written here at all -- a taken frog does not walk, and now it does not
    // get moved either, so the ground it had when it was hooked is the ground
    // it comes back down onto.
    const k = Phaser.Math.Clamp(b.t / BIRD_LIFT_S, 0, 1);
    r.lift = BIRD_LIFT * ease(Math.min(1, k * 2.5));
    // THE BIRD IS ABOVE THE FROG, not level with it.  The frog is drawn at
    // `BEAK` inside the bird's own drawing, so the bird has to sit that far
    // higher for the frog to end up at the height the model says it is --
    // otherwise the lift is spent moving the bird and the frog hangs at the
    // lane it was supposed to have been carried off.
    b.x = r.x;
    b.y = -r.lift - BEAK.y + 2;
    if (k >= 1) {
      b.phase = 3;
      b.t = 0;
    }
    return;
  }

  if (b.phase === 3) {
    // ---- LET GO, AND DOWN IT COMES.
    //
    // THE FROG IS NO LONGER IN THE BEAK, and the drawing has to know that: it
    // goes to `falling`, which draws it at its own place on its own lane
    // rather than pinned to the bird.  Without this the frog rode the bird up
    // and away for the whole drop and then appeared on the ground.
    //
    // `k * k` is a drop that gathers speed the way a dropped thing does, where
    // an eased one floats down like a feather.  `fell` is that same progress
    // handed to the pose, so the tumble and the descent are one number and
    // cannot disagree.
    if (r.going !== 'falling') {
      r.going = 'falling';
      r.hop = 0;
    }
    const k = Phaser.Math.Clamp(b.t / BIRD_DROP_S, 0, 1);
    r.lift = BIRD_LIFT * (1 - k * k);
    r.fell = k;
    b.x = r.x + 6 * ease(k);
    b.y = -BIRD_LIFT - BEAK.y - 30 * ease(k);
    if (k >= 1) {
      b.phase = 4;
      b.t = 0;
      // ---- IT HITS THE GROUND, AND IT IS SEEING STARS.
      //
      // Whatever is left of the four seconds, and it is the ordinary
      // stuck-timer that runs them: a dizzy frog is a frog that is not
      // running, which the model already knows how to be, so nothing new has
      // to be unwound if the race ends in the middle of it.
      r.going = 'dizzy';
      r.stuck = DIZZY_S;
      r.lift = 0;
      r.hop = 0;
      r.fell = 0;
    }
    return;
  }

  // ---- AND OUT, STRAIGHT UP.
  //
  // It used to leave along the track, which read as a bird going somewhere and
  // left it in shot over the frog it had just dropped for most of a second.
  // Now it goes up and off the top of the picture and does not come back, so
  // what is on screen while the frog lands is the frog.  A little sideways
  // drift, because nothing in this game moves on a ruler.
  if (b.phase === 4) {
    const k = Phaser.Math.Clamp(b.t / BIRD_AWAY_S, 0, 1);
    b.x += 14 * dt;
    b.y = -BIRD_LIFT - BEAK.y - 30 - 200 * ease(k);
    if (k >= 1) b.phase = 5;
  }
}

/** The fly, idle until the card calls it.  `gold` is the one worth catching. */
function makeFly(): Fly {
  return { on: false, gold: false, t: 0, x: 0, lane: 0, target: -1 };
}

/**
 * THE FLY, AND THE FROG THAT CANNOT LEAVE IT ALONE.
 *
 * It comes in across the lanes towards the frog the card named, and when it is
 * within a tongue's reach that frog has a go at it.  The ordinary one is a
 * meal and a four second sleep; the golden one is a mouthful of sugar and a
 * second and a half of running.  Same animation, opposite outcome, and the
 * colour is the only warning.
 */
function stepFly(f: Fly, runs: Run[], raceT: number, dt: number): void {
  void raceT;
  if (!f.on) return;
  f.t += dt;
  const r = runs.find((o) => o.i === f.target);
  const span = f.gold ? GOLD_CROSS_S : FLY_CROSS_S;
  if (!r || f.t > span) {
    f.on = false;
    return;
  }
  // It closes on the frog's lane and on the frog, at a pace that takes about
  // as long as the warning: it is still arriving while the player is noticing
  // it.
  const k = Phaser.Math.Clamp(f.t / (span * 0.6), 0, 1);
  f.lane += (r.i - f.lane) * Math.min(1, dt * 1.0);
  f.x += (r.x + 9 - f.x) * Math.min(1, dt * 0.85);
  // ---- AND NOTHING HAPPENS UNTIL THE PLAYER HAS HAD TIME TO SEE IT.  The
  // one gate: everything past here -- the reach, the lick, the meal -- is
  // exactly as it was.
  if (f.t < FLY_WARN_S) return;
  if (k >= 1 || Math.abs(f.x - r.x) > TONGUE_REACH) return;
  if (r.going !== 'run' || r.jet > 0) return;
  // Got it.  The lick is its own short state and the meal follows it.
  r.going = 'eat';
  r.stuck = TONGUE_S;
  r.tongue = 0;
  r.lift = 0;
  r.fx = f.gold ? 'golden' : 'fly';
  r.had.push(r.fx);
  f.on = false;
}

/**
 * Where this lane's puddles lie, as fractions of the track -- and NEVER ON A
 * HOLE.  They were dealt independently of the potholes, so now and then the
 * water was drawn straight over the hole and the hole disappeared under it.
 * A puddle is rerolled until its whole width (and a margin) is clear of every
 * hole on the lane; the band is wide enough that one always is.
 */
const WATER_CLEAR = 30 / DIST;
function digPuddles(holes: number[]): number[] {
  const out: number[] = [];
  const band = (PUDDLE_TO - PUDDLE_FROM) / PUDDLES_PER_LANE;
  for (let i = 0; i < PUDDLES_PER_LANE; i++) {
    let at = PUDDLE_FROM + band * (i + 0.15 + Math.random() * 0.7);
    for (let tries = 0; tries < 40 && holes.some((h) => Math.abs(h - at) < WATER_CLEAR); tries++) {
      at = PUDDLE_FROM + band * (i + 0.15 + Math.random() * 0.7);
    }
    // Still on top of one after all that: put it on the far side of the hole.
    const on = holes.find((h) => Math.abs(h - at) < WATER_CLEAR);
    if (on !== undefined) at = on + (on < 0.5 ? WATER_CLEAR : -WATER_CLEAR);
    out.push(at);
  }
  return out;
}

function digHoles(): number[] {
  const out: number[] = [];
  for (let i = 0; i < HOLES_PER_LANE; i++) {
    const band = (HOLE_TO - HOLE_FROM) / HOLES_PER_LANE;
    out.push(HOLE_FROM + band * (i + 0.15 + Math.random() * 0.7));
  }
  return out;
}

/** A fresh field: one rating each, shuffled onto the colours. */
function makeField(): Array<{ i: number; form: number; luck: number; surgeAt: number; surgeFor: number; holes: number[]; puddles: number[] }> {
  // ---- THE RATINGS, SPREAD ACROSS WHATEVER SIZE THE FIELD IS.
  //
  // The ends are always 1 and 0 and the rest are evenly spaced between them,
  // whoever is in the race -- so commenting a runner out of RUNNERS cannot
  // quietly cut the bottom off the card.
  const forms = RUNNERS.map((_, k) => (FIELD > 1 ? 1 - k / (FIELD - 1) : 1));
  const order = [...RUNNERS.keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.map((idx, k) => {
    const holes = digHoles();
    return {
      i: idx,
      form: forms[k],
      // Drawn here rather than at the gun, so the sampler and the race are
      // rolling the same field in the same order.
      luck: (Math.random() - 0.5) * 2 * LUCK,
      surgeAt: 0.25 + Math.random() * 0.45,
      surgeFor: 0.12 + Math.random() * 0.16,
      puddles: digPuddles(holes),
      holes,
    };
  });
}

/** A field turned into runnable state, for the race or for the sampler. */
function toRuns(
  field: Array<{ i: number; form: number; luck: number; surgeAt: number; surgeFor: number; holes: number[]; puddles?: number[] }>,
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
    puddles: f.puddles ?? [],
    puddleAt: 0,
    lift: 0,
    gold: 0,
    jumpFrom: 0,
    jumpTo: 0,
    rush: 0,
    rushPush: 0,
    rock: 0,
    rockX: 0,
    trapX: 0,
    trap: 0,
    crash: false,
    cue: '',
    tongue: 0,
    slide: 0,
    lean: 0,
    jet: 0,
    jetSpeed: 0,
    arcS: 0,
    arcH: 0,
    arcFlat: 0,
    fell: 0,
    splash: 0,
    fx: null,
    had: [] as EffectKind[],
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
  field: Array<{ i: number; form: number; luck: number; surgeAt: number; surgeFor: number; holes: number[]; puddles: number[] }>,
): number {
  const runs = toRuns(field);
  const bird = makeBird();
  const fly = makeFly();
  const cd = bookField();
  const jet = makeJet();
  const dt = 1 / 60;
  let t = 0;
  while (t < RACE_S) {
    t += dt;
    stepCard(cd, runs, bird, fly, t);
    for (const r of runs) step(r, dt, runs);
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
  racers = toRuns(field).map((r) => ({ ...r, body: makeFrog(scene, RUNNERS[r.i]) }));
  racers.sort((a, b) => a.i - b.i);
  bird = makeBird();
  birdArt = makeBird4(scene);
  fly = makeFly();
  flyArt = makeFlyArt(scene);
  finaleOn = false;
  callT = 0;
  gear.clear();
  for (const r of racers) gear.set(r.i, makeGear(scene));
  jet = makeJet();
  card = bookField();
  fxWas.clear();

  // The potholes, dug where the model says they are.  Drawn UNDER the frogs
  // and over the lane, so a frog in one is visibly down in it.  There is one a
  // lane now: they were furniture, and the track is about the frogs.
  for (const r of racers) {
    const y = LANE_T + r.i * LANE_H + LANE_H / 2 + 1;
    for (const h of r.holes) {
      const hx = START_X + h * DIST;
      scene.add.ellipse(hx, y + 3, 13, 6, 0x0c1f14).setDepth(6);
      scene.add.ellipse(hx, y + 2, 12, 5, 0x05100a).setDepth(7);
      scene.add.ellipse(hx - 1, y + 4, 8, 2, 0x25452c).setDepth(8).setAlpha(0.7);
      // a lip of turf on the near side, so it reads as a hole and not a stain
      scene.add.ellipse(hx + 1, y + 5, 12, 2, 0x2f6b3a).setDepth(8).setAlpha(0.5);
    }
    // ---- AND THE PUDDLES, which a frog can see coming.
    //
    // Water sitting in a dip in the lane: a dark rim so it reads against
    // grass, open water inside it, a sky-coloured highlight because water
    // reflects, and a couple of reeds at the edge.  Same depths as the
    // potholes, so a frog is drawn standing IN one rather than on top of it.
    for (const q of r.puddles) {
      const px = START_X + q * DIST;
      scene.add.ellipse(px, y + 3, 22, 9, 0x1d4a3a).setDepth(6).setAlpha(0.9);
      scene.add.ellipse(px, y + 3, 20, 7, 0x2f7f9e).setDepth(7);
      scene.add.ellipse(px, y + 2.5, 17, 5, 0x49a6c4).setDepth(7);
      scene.add.ellipse(px - 3, y + 2, 7, 2, 0xbfe8f2).setDepth(8).setAlpha(0.55);
      scene.add.ellipse(px + 5, y + 4, 4, 1.4, 0xbfe8f2).setDepth(8).setAlpha(0.35);
      scene.add.rectangle(px - 9, y + 1, 1, 4, 0x3f7a46).setDepth(8).setAlpha(0.8);
      scene.add.rectangle(px + 9, y + 2, 1, 3, 0x3f7a46).setDepth(8).setAlpha(0.8);
    }
  }

  racers.forEach((r) => {
    const y = LANE_T + r.i * LANE_H;
    // THE NUMBER IS THE BUTTON, and the only one: the lanes and the frogs in
    // them are the race, not a menu, and a stray tap on the track used to back
    // whichever frog was under the finger.
    const plate = scene.add
      .rectangle(PLATE.x, y + 1, PLATE.w, Math.min(15, LANE_H - 2), PALETTE.tealDark)
      .setOrigin(0, 0)
      .setDepth(20)
      .setStrokeStyle(1, PALETTE.steel)
      .setInteractive({ useHandCursor: true });
    plate.on('pointerdown', () => choose(r.i));
    const label = centerText(scene, PLATE.x + PLATE.w / 2, y + Math.min(15, LANE_H - 2) / 2, '', PALETTE.cream).setDepth(
      21,
    );
    rows[r.i] = { plate, label };
  });
}

/**
 * ================= THE PLACE THE RACE HAPPENS =================
 *
 * Four bands, back to front, and the whole point of them is DEPTH: the eye
 * reads a picture as having distance in it when the things behind are
 * flatter, cooler and less contrasty than the things in front, and when
 * something overlaps something else.
 *
 *   sky      a graded wash, warm at the horizon and cool at the top
 *   hills    two rows of them, the far row pale and the near row overlapping
 *   crowd    a rail and a line of heads: the thing that makes it a RACE
 *   track    four lanes, mown in stripes, with a verge in front of the crowd
 *
 * Everything here is drawn once, at create, under the frogs.  Nothing in it
 * moves and nothing in it is read by the model.
 */
function paintTrack(scene: Phaser.Scene): void {
  // A seeded shuffle, so the ground is the same ground every time the cabinet
  // is switched on.  Scenery that is different on every play is scenery the
  // player cannot learn the room from.
  let seed = 19770413;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const between = (a: number, b: number): number => a + rnd() * (b - a);

  // ---- THE SKY.  It is the middle of a summer afternoon.
  //
  // It used to be dusk -- deep blue at the top, a low sun sitting in the
  // hills -- and a night race is a race the player squints at: dark frogs on
  // dark grass under a dark sky.  Same seven bands, same warming towards the
  // horizon, but blue daylight now, with the sun high and a few clouds in it.
  const SKY = [0x2f8fd8, 0x45a0e2, 0x5fb1ea, 0x7cc2f0, 0x9dd3f2, 0xc2e4f1, 0xdcefe4];
  const skyH = TRACK_TOP - 18;
  SKY.forEach((c, i) => {
    scene.add
      .rectangle(0, 18 + (skyH / SKY.length) * i, GAME_W, Math.ceil(skyH / SKY.length) + 1, c)
      .setOrigin(0, 0);
  });
  // the sun, high and bright, with its haze around it
  scene.add.circle(252, 32, 20, 0xfff2c4).setAlpha(0.13);
  scene.add.circle(252, 32, 13, 0xfff2c4).setAlpha(0.3);
  scene.add.circle(252, 32, 8, 0xfffbe4).setAlpha(0.95);
  // and a few fair-weather clouds, flat-bottomed, built out of overlapping
  // ellipses so that none of them is a lozenge
  for (const [cx, cy, scale] of [
    [54, 30, 1],
    [140, 24, 0.75],
    [196, 40, 0.6],
  ] as const) {
    for (const [ox, oy, w, h] of [
      [-9, 1, 16, 7],
      [0, -2, 18, 9],
      [9, 1, 14, 7],
    ] as const) {
      scene.add.ellipse(cx + ox * scale, cy + oy * scale, w * scale, h * scale, PALETTE.white).setAlpha(0.82);
    }
    scene.add.rectangle(cx - 12 * scale, cy + 3 * scale, 24 * scale, 2 * scale, 0xdce9f4).setAlpha(0.6);
  }

  // ---- the hills.  Far row first, pale and flat; near row over it, darker.
  for (const [rowY, colour, h, alpha] of [
    [TRACK_TOP - 20, 0x9dbfae, 13, 0.85],
    [TRACK_TOP - 13, 0x5f9a5c, 15, 1],
  ] as const) {
    let x = -10;
    while (x < GAME_W + 10) {
      const w = between(34, 68);
      scene.add
        .ellipse(x + w / 2, rowY, w, h * between(0.8, 1.25), colour)
        .setAlpha(alpha)
        .setDepth(0);
      x += w * 0.72;
    }
  }
  // a line of trees along the near hills, small and dark
  for (let i = 0; i < 26; i++) {
    const x = between(0, GAME_W);
    const h = between(4, 8);
    scene.add.ellipse(x, TRACK_TOP - 14 - h / 2, between(4, 7), h, 0x35733f).setAlpha(0.9);
  }

  // ---- THE CROWD.  A rail, and heads behind it: two rows, the back row
  // darker and smaller, because a crowd is the one thing that says this is a
  // race and not four frogs in a field.
  const crowdY = TRACK_TOP - 9;
  scene.add.rectangle(0, crowdY - 1, GAME_W, 7, 0x3a5741).setOrigin(0, 0);
  for (const [row, size, tone] of [
    [0, 3, 0.55],
    [1, 4, 1],
  ] as const) {
    for (let x = -2; x < GAME_W + 4; x += between(5, 9)) {
      const hue = [0xd8443c, 0x3d8fdd, 0xf0c33c, 0xe8e2cd, 0xa86ad8, 0x46a83f][Math.floor(rnd() * 6)];
      scene.add
        .circle(x, crowdY + 2 + row * 2, size / 2, hue)
        .setAlpha(tone)
        .setDepth(1);
      scene.add
        .rectangle(x, crowdY + 3 + row * 2, size, 3, 0x1d2b22)
        .setAlpha(tone * 0.8)
        .setDepth(1);
    }
  }
  // the rail in front of them
  scene.add.rectangle(0, TRACK_TOP - 4, GAME_W, 1, 0xd6dce4).setOrigin(0, 0).setAlpha(0.8).setDepth(2);
  for (let x = 4; x < GAME_W; x += 24) {
    scene.add.rectangle(x, TRACK_TOP - 4, 1, 4, 0x9aa6b4).setOrigin(0, 0).setAlpha(0.7).setDepth(2);
  }

  // ---- THE TRACK.  Mown stripes across each lane, a white line between
  // lanes, and grain: three tones of green per lane rather than one flat fill.
  for (let i = 0; i < FIELD; i++) {
    const y = LANE_T + i * LANE_H;
    const base = i % 2 ? 0x368043 : 0x2e7139;
    scene.add.rectangle(0, y, GAME_W, LANE_H, base).setOrigin(0, 0);
    // mowing: vertical bands, alternating a shade either side of the base
    for (let x = 0; x < GAME_W; x += 16) {
      scene.add
        .rectangle(x, y, 8, LANE_H, i % 2 ? 0x3d8c49 : 0x357a40)
        .setOrigin(0, 0)
        .setAlpha(0.55);
    }
    // grain, and a shadow along the top edge so the lane has a lip
    for (let k = 0; k < 26; k++) {
      scene.add
        .rectangle(between(0, GAME_W), y + between(1, LANE_H - 2), between(2, 5), 1, 0x18401f)
        .setAlpha(0.35);
    }
    scene.add.rectangle(0, y, GAME_W, 1, 0x152f1c).setOrigin(0, 0).setAlpha(0.6);
    scene.add.rectangle(0, y + LANE_H - 1, GAME_W, 1, 0x6fbb6a).setOrigin(0, 0).setAlpha(0.12);
  }
  // the verge in front of the track, so the bottom lane sits on something
  scene.add.rectangle(0, TRACK_BOTTOM, GAME_W, 6, 0x265630).setOrigin(0, 0);
  for (let k = 0; k < 40; k++) {
    scene.add.rectangle(between(0, GAME_W), TRACK_BOTTOM + between(0, 5), between(1, 3), 1, 0x2f6b3a).setAlpha(0.6);
  }

  // ---- the starting rail, and the chequered line.
  scene.add.rectangle(START_X - 11, LANE_T, 1, FIELD * LANE_H, PALETTE.bone).setOrigin(0, 0).setAlpha(0.5);
  // THE CHEQUER RUNS THE WHOLE FIELD, counted off the lanes, so it cannot come
  // up short however many frogs are in the race.
  const tapeH = FIELD * LANE_H;
  for (let i = 0; i * TAPE_SQ < tapeH; i++) {
    scene.add
      .rectangle(FINISH_X, LANE_T + i * TAPE_SQ, 4, Math.min(TAPE_SQ, tapeH - i * TAPE_SQ), i % 2 ? PALETTE.white : PALETTE.ink)
      .setOrigin(0, 0)
      .setDepth(2);
  }
  scene.add.rectangle(FINISH_X + 4, LANE_T - 4, 2, tapeH + 8, PALETTE.bone).setOrigin(0, 0).setDepth(2);
  // a post and a flag over the line, so the finish reads from across the room
  scene.add.rectangle(FINISH_X + 4, LANE_T - 16, 2, 12, 0xd6dce4).setOrigin(0, 0).setDepth(2);
  scene.add.triangle(FINISH_X + 10, LANE_T - 13, 0, 0, 9, 3, 0, 6, PALETTE.neon).setDepth(2);
}

/**
 * THE BIRD, and the shadow it throws.
 *
 * The shadow is the half of it that sells the dive: it lands on the lane
 * before the bird does and grows as the bird comes down, so a player watching
 * the frogs sees something coming without having to look up.
 */
function makeBird4(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const tailF = scene.add.triangle(-9, 0, 0, 0, 6, -3, 6, 3, 0x3a3a48);
  const body = scene.add.ellipse(0, 0, 15, 7, 0x4a4a58);
  const belly = scene.add.ellipse(0, 2, 11, 3, 0x6a6a7c).setAlpha(0.6);
  const head = scene.add.circle(6, -2, 3.4, 0x54545f);
  const beak = scene.add.triangle(BEAK.x - 2, BEAK.y - 4, 0, 0, 6, 2.5, 0, 5, 0xffb45e);
  const claw = scene.add.rectangle(2, 4, 4, 2, 0xffb45e);
  const wingL = scene.add.ellipse(-1, -4, 14, 5, 0x76768a);
  const wingR = scene.add.ellipse(-1, 4, 14, 5, 0x35354a);
  const eye = scene.add.circle(7.4, -3, 1.1, PALETTE.black);
  const glint = scene.add.circle(7.8, -3.4, 0.4, PALETTE.white);
  // The shadow is a child, so it follows the bird across the track, and it is
  // positioned onto the lane every frame -- see the draw block.
  const shadow = scene.add.ellipse(0, 0, 14, 4, 0x000000).setAlpha(0.35);
  const c = scene.add
    .container(0, 0, [shadow, wingR, tailF, body, belly, head, beak, claw, eye, glint, wingL])
    .setDepth(40);
  c.setVisible(false);
  c.setData('wings', [wingL, wingR]);
  c.setData('shadow', shadow);
  return c;
}

/**
 * THE FLY.  Two of them in one drawing: the ordinary one is a dark speck and
 * the golden one glows, because they ask for the same lick and pay opposite
 * things, and the colour is the only warning the player gets.
 */
// ------------------------------------------------------ the track furniture

/**
 * EVERYTHING AN EVENT PUTS ON THE TRACK, per lane.  Drawing only: each piece
 * is posed every frame from numbers the model already keeps (`rock`, `trap`,
 * `trapX`, ...), so what is on the grass and what the race is doing cannot
 * disagree.
 */
interface Gear {
  shadow: Phaser.GameObjects.Ellipse;
  rock: Phaser.GameObjects.Container;
  trap: Phaser.GameObjects.Container;
  jawL: Phaser.GameObjects.Container;
  jawR: Phaser.GameObjects.Container;
  log: Phaser.GameObjects.Container;
  /** The rock after it has come down: where, how long ago, and whether it hit. */
  down: { x: number; y: number; t: number; hit: boolean } | null;
  logX: number;
  logT: number;
}
const gear = new Map<number, Gear>();
/** The trap's jaws: how long a bar is, where it hinges, and its two angles. */
const JAW = 6.4;
const JAW_PIVOT = 4.5;
const JAW_OPEN_L = -Math.PI;
const JAW_SHUT_L = -Math.acos(JAW_PIVOT / JAW);
const JAW_OPEN_R = 0;
const JAW_SHUT_R = -Math.PI + Math.acos(JAW_PIVOT / JAW);
/** Dust in the air: kicked up on landings, impacts and bursts. */
let puffs: Array<{ obj: Phaser.GameObjects.Ellipse; vx: number; vy: number; life: number; max: number }> = [];
/** Skid marks torn in the grass by a slip or a crashed landing. */
let skids: Array<{ i: number; lines: Phaser.GameObjects.Rectangle[]; x0: number; fade: number }> = [];

function makeGear(scene: Phaser.Scene): Gear {
  const shadow = scene.add.ellipse(0, 0, 12, 4, 0x000000).setAlpha(0.35).setDepth(9).setVisible(false);
  // A boulder: a dark mass, a lit face, a highlight and a crack across it.
  const rock = scene.add
    .container(0, 0, [
      scene.add.ellipse(0, 0, 12, 10, 0x4a4540),
      scene.add.ellipse(-0.8, -0.8, 10, 8, 0x77716a),
      scene.add.ellipse(-2.6, -2.6, 3.6, 2.4, 0xb0aa9f).setAlpha(0.85),
      scene.add.rectangle(1.6, 0.6, 4, 0.9, 0x34302c).setAngle(-30),
      scene.add.rectangle(3, 2, 2.2, 0.9, 0x34302c).setAngle(40),
      scene.add.ellipse(1, 3.4, 9, 2.6, 0x3a3632).setAlpha(0.7),
    ])
    .setDepth(42)
    .setVisible(false);
  // Iron jaws: a base plate and two toothed bars hinged at either end of it.
  // Open, they lie flat on the grass pointing outwards, teeth up; sprung,
  // each swings up over the top and they meet in an arch with the teeth
  // biting inwards -- which is where a caught frog's legs are.
  const bar = (x: number, teethSide: number) => {
    const parts: Phaser.GameObjects.GameObject[] = [
      scene.add.rectangle(JAW / 2, 0, JAW, 1.8, 0x9ea4ae),
      scene.add.rectangle(JAW / 2, -teethSide * 0.6, JAW, 0.6, 0x5a5e66),
    ];
    for (const tx of [1.6, 3.3, 5]) {
      parts.push(scene.add.triangle(tx, teethSide * 1.5, -0.9, -teethSide * 0.6, 0.9, -teethSide * 0.6, 0, teethSide * 1.4, 0xd8dce2));
    }
    return scene.add.container(x, 0, parts);
  };
  const jawL = bar(-JAW_PIVOT, 1).setRotation(JAW_OPEN_L);
  const jawR = bar(JAW_PIVOT, -1).setRotation(JAW_OPEN_R);
  const trap = scene.add
    .container(0, 0, [
      scene.add.ellipse(0, 1.4, 22, 4.4, 0x000000).setAlpha(0.3),
      scene.add.rectangle(0, 0.8, JAW_PIVOT * 2 + 2, 2, 0x3a3c44),
      scene.add.circle(0, 0.6, 1.4, 0x7a7e88),
      scene.add.circle(-JAW_PIVOT, 0, 1, 0x5a5e66),
      scene.add.circle(JAW_PIVOT, 0, 1, 0x5a5e66),
      jawL,
      jawR,
    ])
    .setDepth(8)
    .setVisible(false);
  // A log across the lane: bark, the cut end with its rings.
  const log = scene.add
    .container(0, 0, [
      scene.add.ellipse(0, 1.5, 12, 3, 0x000000).setAlpha(0.3),
      scene.add.ellipse(0, 0, 11, 5.4, 0x5a3c22),
      scene.add.rectangle(-1, -1.2, 7, 0.8, 0x7a5634),
      scene.add.ellipse(4.8, 0, 2.8, 5, 0xc09a66),
      scene.add.ellipse(4.8, 0, 1.4, 2.6, 0x8a6a42),
    ])
    .setDepth(9)
    .setVisible(false);
  return { shadow, rock, trap, jawL, jawR, log, down: null, logX: 0, logT: 0 };
}

function drawGear(r: Racer, g: Gear, laneY: number, dt: number): void {
  // ---- THE ROCK, on its way: its shadow grows on the lane under the frog
  // as the rock drops out of the sky onto the same spot.
  if (r.rock > 0) {
    const k = 1 - r.rock / ROCK_WARN_S;
    const gx = START_X + r.x + 1;
    g.shadow.setVisible(true).setPosition(gx, laneY + 6).setScale(0.35 + 0.8 * k).setAlpha(0.12 + 0.42 * k);
    // Out of the sky and onto the spot: it is in the picture for the whole
    // warning, and it gathers speed as it comes.
    g.rock.setVisible(true).setAlpha(1).setScale(1).setPosition(gx, laneY - 2 - (1 - k * k) * (laneY - 24)).setRotation(k * 5);
  } else if (!g.down) {
    g.shadow.setVisible(false);
    g.rock.setVisible(false);
  }
  // ---- AND DOWN.  On the frog it sits on it, then rolls off; beside it,
  // it bounces once and crumbles.
  if (g.down) {
    const d = g.down;
    d.t += dt;
    g.shadow.setVisible(false);
    let x = d.x;
    let y = d.y - (d.hit ? 4 : 1);
    let rot = 0;
    if (d.hit && d.t > 0.8) {
      const u = d.t - 0.8;
      x += u * 26;
      y += u * u * 30;
      rot = u * 6;
    } else if (!d.hit) {
      y -= Math.abs(Math.sin(d.t * 9)) * 4 * Math.max(0, 1 - d.t * 2);
    }
    const gone = Phaser.Math.Clamp((d.t - (d.hit ? 1.2 : 0.7)) / 0.5, 0, 1);
    g.rock.setVisible(true).setPosition(x, y).setRotation(rot).setAlpha(1 - gone).setScale(1 - gone * 0.4);
    if (gone >= 1) {
      g.down = null;
      g.rock.setVisible(false).setAlpha(1).setScale(1);
    }
  }
  // ---- THE TRAP.  Open on the lane until it is reached, then shut; while a
  // frog is in it the jaws are drawn in front of the frog, round its legs.
  if (r.trap > 0) {
    g.trap.setVisible(true).setPosition(START_X + r.trapX, laneY + 5);
    const shut = r.trap >= 2;
    const k = Math.min(1, dt * 40);
    const wantL = shut ? JAW_SHUT_L : JAW_OPEN_L;
    const wantR = shut ? JAW_SHUT_R : JAW_OPEN_R;
    // Read the angles back from our own copy: Phaser wraps a rotation into
    // -pi..pi, and the left jaw's open angle sits right on that seam.
    const aL = (g.jawL.getData('a') as number | undefined) ?? JAW_OPEN_L;
    const aR = (g.jawR.getData('a') as number | undefined) ?? JAW_OPEN_R;
    const nL = aL + (wantL - aL) * k;
    const nR = aR + (wantR - aR) * k;
    g.jawL.setData('a', nL).setRotation(nL);
    g.jawR.setData('a', nR).setRotation(nR);
    g.trap.setDepth(r.going === 'caught' ? 10 + r.i * 0.6 + 6 : 8);
    g.trap.setAlpha(r.trap === 3 || (r.trap === 2 && r.going !== 'caught') ? 0.75 : 1);
  } else {
    g.trap.setVisible(false);
    g.jawL.setData('a', JAW_OPEN_L).setRotation(JAW_OPEN_L);
    g.jawR.setData('a', JAW_OPEN_R).setRotation(JAW_OPEN_R);
  }
  // ---- THE LOG the leap was taken over.
  if (g.logT > 0) {
    g.logT -= dt;
    g.log.setVisible(true).setPosition(g.logX, laneY + 4).setAlpha(Math.min(1, g.logT / 0.4));
  } else g.log.setVisible(false);
}

/** A handful of dust, thrown back and up. */
function spawnDust(x: number, y: number, n: number, power: number, colour = 0xd8cba4): void {
  if (!sceneRef) return;
  for (let k = 0; k < n; k++) {
    const obj = sceneRef.add.ellipse(x + (Math.random() - 0.5) * 4, y, 3 + Math.random() * 2, 2, colour).setDepth(9).setAlpha(0.7);
    const max = 0.3 + Math.random() * 0.25 + power / 120;
    puffs.push({ obj, vx: -power * (0.3 + Math.random() * 0.7), vy: -power * Math.random() * 0.5, life: max, max });
  }
}

function stepPuffs(dt: number): void {
  puffs = puffs.filter((p) => {
    p.life -= dt;
    if (p.life <= 0) {
      p.obj.destroy();
      return false;
    }
    const k = p.life / p.max;
    p.obj.setPosition(p.obj.x + p.vx * dt, p.obj.y + p.vy * dt);
    p.vx *= 0.9;
    p.vy += 30 * dt;
    p.obj.setScale(1 + (1 - k) * 1.2).setAlpha(0.7 * k);
    return true;
  });
}

/** Two scars in the grass that follow a skidding frog, then fade. */
function skid(r: Run): void {
  if (!sceneRef) return;
  const y = LANE_T + r.i * LANE_H + LANE_H / 2 + 1;
  const x0 = START_X + r.x;
  const lines = [6, 8].map((dy) => sceneRef!.add.rectangle(x0, y + dy, 1, 1, 0x1c4424).setOrigin(0, 0.5).setDepth(7).setAlpha(0.75));
  skids.push({ i: r.i, lines, x0, fade: 2.5 });
}

function stepSkids(dt: number): void {
  skids = skids.filter((sk) => {
    const r = racers.find((o) => o.i === sk.i);
    const going = r && (r.going === 'slip' || r.going === 'crash');
    if (going && r) {
      const w = Math.max(1, START_X + r.x - 4 - sk.x0);
      sk.lines.forEach((l, k) => l.setSize(w - k * 2, 1));
      return true;
    }
    sk.fade -= dt;
    sk.lines.forEach((l) => l.setAlpha(0.75 * Math.max(0, sk.fade / 2.5)));
    if (sk.fade <= 0) {
      sk.lines.forEach((l) => l.destroy());
      return false;
    }
    return true;
  });
}

/** One line of commentary across the top of the track. */
function call(msg: string, tint: number, secs = 1.5): void {
  if (!banner) return;
  banner.setText(msg).setTint(tint).setAlpha(1);
  callT = secs;
}

/**
 * WHAT HAPPENED, MADE SEEN AND HEARD.  The model sets a cue on a frog; this
 * says what it was, plays it, throws the dust and starts the marks.
 */
function onCue(r: Racer, cue: string): void {
  const name = RUNNERS[r.i].name;
  const g = gear.get(r.i);
  const laneY = LANE_T + r.i * LANE_H + LANE_H / 2 + 1;
  const x = START_X + r.x;
  const cam = sceneRef?.cameras.main;
  const alertOn = () => r.body.setData('alertT', 0.7);
  switch (cue) {
    case 'rock':
      call(`ROCKFALL OVER ${name}!`, PALETTE.blood);
      audio.sfx('throw_whoosh', 0.55);
      break;
    case 'rock_hit':
      call(`${name} FLATTENED BY A ROCK`, PALETTE.blood);
      audio.sfx('boom', 0.5);
      audio.sfx('crumble', 0.5);
      cam?.shake(180, 0.005);
      if (g) g.down = { x, y: laneY, t: 0, hit: true };
      spawnDust(x, laneY + 5, 6, 30);
      break;
    case 'rock_miss':
      call(`${name} - MISSED BY INCHES!`, PALETTE.mossLight);
      audio.sfx('item_thud', 0.7);
      audio.sfx('crumble', 0.4);
      cam?.shake(120, 0.003);
      if (g) g.down = { x: x - 11, y: laneY, t: 0, hit: false };
      spawnDust(x - 11, laneY + 5, 5, 26);
      alertOn();
      break;
    case 'trap':
      call(`JAWS SET IN FRONT OF ${name}`, PALETTE.fog);
      audio.sfx('lock_click', 0.5);
      break;
    case 'trap_caught':
      call(`${name} CAUGHT IN THE JAWS!`, PALETTE.blood);
      audio.sfx('whack', 0.6);
      audio.sfx('fence_thunk', 0.5);
      cam?.shake(120, 0.003);
      break;
    case 'trap_dodge':
      call(`${name} LEAPS THE TRAP!`, PALETTE.mossLight);
      audio.sfx('lock_click', 0.8);
      audio.sfx('hop_wet', 0.5);
      alertOn();
      break;
    case 'trap_free':
      audio.sfx('fence_thunk', 0.4);
      break;
    case 'leap':
      call(`${name} GOES FOR THE LOG!`, PALETTE.cream);
      audio.sfx('throw_whoosh', 0.5);
      if (g) {
        g.logX = x + 8;
        g.logT = 2;
      }
      break;
    case 'landed':
      call(`${name} STICKS THE LANDING!`, PALETTE.mossLight);
      audio.sfx('hop_wet', 0.7);
      spawnDust(x, laneY + 6, 4, 22);
      break;
    case 'crash':
      call(`${name} CRASHES THE LANDING`, PALETTE.blood);
      audio.sfx('item_thud', 0.8);
      audio.sfx('crumble', 0.4);
      cam?.shake(140, 0.004);
      spawnDust(x, laneY + 6, 6, 28);
      skid(r);
      break;
    case 'slip':
      call(`${name} LOSES ITS FOOTING`, PALETTE.fog);
      audio.sfx('fence_thunk', 0.5);
      skid(r);
      break;
    case 'burst': {
      const ahead = racers.some((o) => o !== r && o.x > r.x && o.x - r.x < 26);
      call(ahead ? `${name} SLINGSHOTS OUT OF THE DRAFT` : `${name} DIGS IN - BURST!`, PALETTE.gold);
      audio.sfx('throw_whoosh', 0.7);
      spawnDust(x - 4, laneY + 6, 3, 20);
      break;
    }
  }
}

function makeFlyArt(scene: Phaser.Scene): Phaser.GameObjects.Container {
  // BIG ENOUGH TO BE A WARNING.  It was a three pixel dark speck on dark
  // grass, which is a thing the player finds out about afterwards.  It has a
  // body with a face on it, two wings that beat, and a pale ring behind it so
  // that it reads against the green -- and it is a couple of pixels bigger all
  // round, which at this size is the difference between seen and not seen.
  const ring = scene.add.ellipse(0, 0, 11, 9, PALETTE.cream).setAlpha(0.16);
  const wingL = scene.add.ellipse(-2, -2.6, 5, 3, 0xdce9ff).setAlpha(0.75);
  const wingR = scene.add.ellipse(2, -2.6, 5, 3, 0xdce9ff).setAlpha(0.75);
  const plain = scene.add.ellipse(0, 0, 5.5, 4, 0x24242e);
  const stripe = scene.add.rectangle(0.6, 0.4, 3.4, 1, 0x4a4a5e).setAlpha(0.9);
  const eyeL = scene.add.circle(-1.4, -0.8, 0.9, PALETTE.cream);
  const eyeR = scene.add.circle(1.1, -0.9, 0.9, PALETTE.cream);
  const gold = scene.add.ellipse(0, 0, 6, 4.6, PALETTE.gold);
  const halo = scene.add.ellipse(0, 0, 10, 7.5, PALETTE.gold).setAlpha(0.22);
  const c = scene.add
    .container(0, 0, [ring, halo, wingL, wingR, plain, stripe, eyeL, eyeR, gold])
    .setDepth(41);
  c.setVisible(false);
  c.setData('wing', wingL);
  c.setData('wing2', wingR);
  c.setData('gold', gold);
  c.setData('plain', plain);
  c.setData('face', [stripe, eyeL, eyeR]);
  return c;
}

/**
 * ---- WHAT A FROG'S FACE IS DOING, and what decides it.
 *
 * One function, read off the state the model already keeps: there is no
 * second set of flags saying "look worried" that could drift out of step with
 * what is actually happening to the frog.  Every field is optional, so a mood
 * only has to say what makes it different from an ordinary running frog.
 *
 *   eye     how open the eyes are: 1 wide, 0 shut
 *   iris    where the pupils sit, in pixels -- up, down, left, right
 *   big     pupil size, which is most of what reads as surprise
 *   smile   +1 a grin, 0 a flat line, -1 a worried curve
 *   open    the mouth as an O, for a gasp
 *   brow    a pair of brows, for determination and for annoyance
 *   squash  the whole head, for a bounce
 */
interface Mood {
  eye?: number;
  irisX?: number;
  irisY?: number;
  big?: number;
  smile?: number;
  open?: number;
  brow?: number;
}

/** The mood a frog is in, decided entirely by what the race is doing to it. */
function moodOf(r: Run, clock: number): Mood {
  if (r.going === 'taken') {
    // ---- IN THE BIRD'S FEET: eyes wide, mouth open, brows up.
    return { eye: 1, big: 1.35, open: 1, smile: -1, irisY: -0.6 };
  }
  if (r.jet > 0) {
    // ---- ON THE JETPACK: delighted, eyes forward, teeth out.
    return { eye: 1, big: 1.1, smile: 1, irisX: 1.1, brow: -1 };
  }
  if (r.going === 'sleep') {
    // ---- ASLEEP: shut, and a small contented smile.
    return { eye: r.stuck < WAKE_S ? 1 - r.stuck / WAKE_S : 0, smile: 0.6 };
  }
  if (r.going === 'dizzy') {
    // ---- SEEING STARS.  The pupils wander in a circle rather than looking at
    // anything, which is the whole of what reads as dizzy on a face this size,
    // and the mouth hangs open while it works out which way is up.
    const roll = clock / 130;
    return {
      eye: 0.85,
      big: 0.85,
      open: 0.7,
      smile: -0.2,
      irisX: Math.cos(roll) * 1.1,
      irisY: Math.sin(roll) * 0.9,
    };
  }
  if (r.going === 'slip') {
    // ---- OVER IT GOES: shocked, then sheepish as it gets back up.
    const early = r.stuck > SLIP_S * 0.45;
    return early ? { eye: 1, big: 1.5, open: 1, smile: -1 } : { eye: 0.55, smile: -0.4, irisY: 0.5 };
  }
  if (r.going === 'jump') {
    // ---- AIRBORNE: committed, eyes on where it is coming down -- and, on a
    // leap that is going wrong, knowing it.
    if (r.crash && r.stuck < r.arcS * 0.55) return { eye: 1.2, big: 1.4, open: 1, smile: -1, brow: 1, irisY: 0.8 };
    return { eye: 0.9, brow: -1, smile: 0.2, irisY: 0.3, irisX: 0.8 };
  }
  if (r.going === 'hit') {
    // ---- UNDER THE ROCK: eyes screwed shut, then dazed.
    const early = r.stuck > ROCK_HIT_S * 0.4;
    return early ? { eye: 0.15, smile: -1, brow: 1 } : { eye: 0.7, open: 0.6, smile: -0.4, irisX: Math.cos(clock / 130) * 0.9 };
  }
  if (r.going === 'caught') {
    // ---- IN THE JAWS: panic.
    return { eye: 1.2, big: 1.45, open: 1, smile: -1, brow: 1, irisY: 0.7 };
  }
  if (r.going === 'crash') {
    return { eye: 1.2, big: 1.35, open: 1, smile: -1, brow: 1 };
  }
  if (r.rock > 0) {
    // ---- IT HAS SEEN THE SHADOW: eyes up, wide, and worried.
    return { eye: 1.15, big: 1.3, irisY: -1.1, smile: -0.7, brow: 1 };
  }
  if (r.trap === 1) {
    // ---- EYES ON THE JAWS IN FRONT OF IT.
    return { eye: 1, big: 1.15, irisX: 1, irisY: 0.6, brow: -1, smile: -0.3 };
  }
  if (r.rush > 0) {
    // ---- FLAT OUT: chin down, eyes front, gritted.
    return { eye: 0.85, brow: -1, irisX: 1.2, smile: 0.2 };
  }
  if (r.going === 'eat') {
    // ---- MID-LICK: eyes on the fly, mouth open.
    return { eye: 1, smile: 1, open: 1, irisX: 1.2 };
  }
  if (r.going === 'hole') {
    return { eye: 0.8, smile: -0.7, irisY: 0.4, brow: 1 };
  }
  if (r.going === 'falling') {
    // ---- DROPPED OUT OF THE SKY: eyes enormous, mouth open, no dignity.
    return { eye: 1.3, smile: -1, brow: 1, irisY: -0.6, big: 1.06 };
  }
  if (r.gold > 0) {
    // ---- THE GOLDEN FLY: chin down, eyes front, absolutely going for it.
    return { eye: 0.85, smile: 1, brow: -1, irisX: 1.2, big: 1.05 };
  }
  // ---- OTHERWISE: running, and racing -- a glance across at the others
  // every few seconds, and in the final stretch nothing but grit.
  const look = Math.sin(clock / 900);
  if (finaleOn) return { eye: 0.9, brow: -1, smile: 0, irisX: 1 };
  return { eye: 1, smile: 0.35, irisX: Math.abs(look) > 0.8 ? Math.sign(look) * 0.9 : 0 };
}

/**
 * Put a mood on a frog's face.  Drawing only: nothing in here is read back by
 * anything, and every value eases towards its target so an expression changes
 * over a few frames rather than snapping between two faces.
 */
function wearMood(body: Phaser.GameObjects.Container, m: Mood, blink: number, dt: number): void {
  const eyes = body.getData('eyes') as Array<Record<string, Phaser.GameObjects.Shape>>;
  const [mouthL, mouthR] = body.getData('mouth') as Phaser.GameObjects.Rectangle[];
  const gape = body.getData('gape') as Phaser.GameObjects.Ellipse;
  const brows = body.getData('brows') as Phaser.GameObjects.Rectangle[];
  const k = Math.min(1, dt * 12);

  const openWant = Math.min(m.eye ?? 1, 1 - blink);
  const held = (body.getData('eyeNow') as number) ?? 1;
  const now = held + (openWant - held) * k;
  body.setData('eyeNow', now);

  eyes.forEach((e, i) => {
    // The lid closes over the eye from the top.
    (e.lid as Phaser.GameObjects.Ellipse).setScale(1, Phaser.Math.Clamp(1 - now, 0, 1) * 1.05);
    const iris = e.iris as Phaser.GameObjects.Arc;
    // Read off the same table `makeFrog` drew them from.  These used to be a
    // second, separate copy of the eye positions, so moving the face in one
    // place and not the other left the irises easing back to where the old
    // symmetric face had them -- off the side of the head.
    const wantX = EYES[i].x + (m.irisX ?? 0);
    const wantY = EYES[i].y + 0.1 + (m.irisY ?? 0);
    iris.setPosition(iris.x + (wantX - iris.x) * k, iris.y + (wantY - iris.y) * k);
    const big = m.big ?? 1;
    iris.setScale(iris.scaleX + (big - iris.scaleX) * k);
    (e.glint as Phaser.GameObjects.Arc).setVisible(now > 0.45);
    (e.spark as Phaser.GameObjects.Arc).setVisible(now > 0.6);
  });

  // The mouth: two bars that tip up for a smile and down for a worry.
  const smile = m.smile ?? 0;
  const tip = 0.45 * smile;
  mouthL.setRotation(mouthL.rotation + (tip - mouthL.rotation) * k);
  mouthR.setRotation(mouthR.rotation + (-tip - mouthR.rotation) * k);
  mouthL.setPosition(MOUTH_X - 1.8, MOUTH_Y - smile * 0.6);
  mouthR.setPosition(MOUTH_X + 1.8, MOUTH_Y - smile * 0.6);
  const gasping = (m.open ?? 0) > 0;
  gape.setVisible(gasping);
  if (gasping) gape.setScale(0.7 + (m.open ?? 0) * 0.5);
  mouthL.setVisible(!gasping);
  mouthR.setVisible(!gasping);

  const brow = m.brow ?? 0;
  brows.forEach((b, i) => {
    b.setVisible(brow !== 0);
    if (!brow) return;
    // a face seen head on: the two brows are a mirrored pair
    b.setRotation((i === 0 ? 1 : -1) * 0.34 * brow);
    b.setY(BROW_Y + (EYES[i].y + 8) + brow * 0.6);
  });
}

/**
 * ONE FROG, IN THREE TONES.
 *
 * It was a flat ellipse with two dots on it.  A frog at eleven pixels can
 * still have a top and an underside: the light comes from above and behind, so
 * the back is `lit`, the body is `skin`, and everything under the waterline --
 * the belly shadow, the haunches, the feet -- is `dark`.  That is what makes
 * four frogs of four colours readable while they are all moving at once.
 *
 * The extras that only sometimes apply are built once, hidden, and live on the
 * frog's own container so they move, scale and turn with it and cannot drift
 * off the body they belong to.
 */
function makeFrog(scene: Phaser.Scene, kit: (typeof RUNNERS)[number]): Phaser.GameObjects.Container {
  const { skin, lit, dark, cheek } = kit;
  // ================= ONE SHAPE, NOT TWO =================
  //
  // The frog before this one was a head ellipse THIRTEEN wide sitting on a
  // body ellipse TEN wide, which is a big head attached to a small body with
  // a waist where they met.  What is drawn now is one round mass: a wide
  // chubby body, and a crown that is NARROWER than it and overlaps most of
  // the way down, so the two read as the top and bottom of a single animal
  // and there is no neck anywhere.  Both are drawn in the same skin with no
  // edge between them -- the only rim is round the OUTSIDE of the pair.
  //
  // Everything else is small by comparison on purpose: stubby legs, feet that
  // just peek out underneath, and eyes set into the top of the mass rather
  // than perched above it.  That is the whole recipe for chubby and cute at
  // this size.
  // ---- THE LIMBS ARE DARKER THAN THE BODY.
  //
  // They were drawn in the frog's own `skin`, which is the one colour on the
  // animal guaranteed to be the same value as the rest of it -- so the green
  // frog's feet disappeared into green grass at exactly the moment they are
  // doing the interesting thing, which is moving.  Every frog gets limbs
  // mixed part of the way toward its shadow tone, so the rule is the same for
  // the whole field and no runner is lit differently from the others.
  const mixTone = (a: number, b: number, k: number): number => {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k);
  };
  const limb = mixTone(skin, dark, 0.42);
  // ---- AND NO TWO OF THEM ARE THE SAME ANIMAL.
  //
  // Four frogs in four colours are still four copies of one frog.  `build`
  // stretches the body front to back and drops it correspondingly lower, so
  // the blue one is long and low and the pink one is short and round -- and
  // the mass stays about the same, because a frog twice as long that is also
  // twice as tall is just a bigger frog.
  const BX = kit.build;
  const BY = 1 / Math.sqrt(kit.build);

  // ================= THE LEGS ARE LIMBS =================
  //
  // They were four flat ellipses lying in the body drawing, so what the game
  // called a jump was the whole animal squashing and stretching with its feet
  // painted on underneath -- the frog changed shape but nothing about it ever
  // pushed against the ground.
  //
  // A frog jumps with its back legs: it folds them right up under itself,
  // drives them straight out behind, trails them through the air and swings
  // them forward again to take the landing.  These two containers hold the
  // foot and the shank of each leg and are posed every frame from the hop
  // phase by `legPose`, so the push-off, the trail and the reach are all
  // actually drawn.  REAR is the one that does the work.
  // ---- THE LEGS, FROM THE FRONT.  The big back legs fold out either side
  // of the body -- a thigh and a long webbed foot each -- and the front feet
  // sit under the chest.  Both pairs are posed every frame from the hop by
  // `legPose`, so the push, the tuck and the landing are drawn.
  const legRear = scene.add.container(REAR_LEG.x, REAR_LEG.y, [
    scene.add.ellipse(-7.4, -2.4, 6, 6.4, dark),
    scene.add.ellipse(7.4, -2.4, 6, 6.4, dark),
    scene.add.ellipse(-7.4, -2.6, 5, 5.4, limb),
    scene.add.ellipse(7.4, -2.6, 5, 5.4, limb),
    scene.add.ellipse(-8.4, 0.6, 7.2, 2.8, dark),
    scene.add.ellipse(8.4, 0.6, 7.2, 2.8, dark),
    scene.add.ellipse(-8.4, 0.4, 6.2, 2, limb),
    scene.add.ellipse(8.4, 0.4, 6.2, 2, limb),
    scene.add.ellipse(-10.6, 0.4, 1.4, 1.2, mixTone(limb, lit, 0.35)).setAlpha(0.8),
    scene.add.ellipse(10.6, 0.4, 1.4, 1.2, mixTone(limb, lit, 0.35)).setAlpha(0.8),
  ]);
  const legFore = scene.add.container(FORE_LEG.x, FORE_LEG.y, [
    scene.add.ellipse(-3.4, 0, 4.4, 2.4, dark),
    scene.add.ellipse(3.4, 0, 4.4, 2.4, dark),
    scene.add.ellipse(-3.4, -0.2, 3.6, 1.6, limb),
    scene.add.ellipse(3.4, -0.2, 3.6, 1.6, limb),
  ]);

  // ================= AND IT FACES THE PLAYER =================
  //
  // One chubby mass seen head on: a wide round body and a head a little
  // narrower overlapping most of the way down it, both in the same skin with
  // no edge between them -- the only rim is round the outside.  Two eyes set
  // into the top, a smile across the face, a cheek either side, two nostrils.
  // `build` still makes the four of them different animals: it widens and
  // flattens the body, so one is broad and low and another round and tall.
  const parts = [
    // ---- THE RIM, the outside edge of the whole animal
    scene.add.ellipse(0, 0.6, 16.6 * BX, 12.6 * BY, dark),
    scene.add.ellipse(0, -4.4 * BY, 13.8 * BX, 9.6 * BY, dark),
    // ---- the legs, which are LIMBS and not painted-on feet: see `legRear`
    legRear,
    legFore,
    // ---- THE MASS.  Body, then the head over the top of it, no seam.
    scene.add.ellipse(0, 0.6, 15.2 * BX, 11.2 * BY, skin),
    scene.add.ellipse(0, -4.4 * BY, 12.4 * BX, 8.4 * BY, skin),
    // the light across the top of the head, from above
    scene.add.ellipse(0, -7.2 * BY, 9 * BX, 3 * BY, lit).setAlpha(0.8),
    scene.add.ellipse(-2.4, -7.6 * BY, 3.4, 1.6, 0xffffff).setAlpha(0.22),
    // ---- the pale belly and throat, down the middle of the front
    scene.add.ellipse(0, 3 * BY, 10 * BX, 6 * BY, 0xfff6e0).setAlpha(0.5),
    scene.add.ellipse(0, 4.2 * BY, 6.6 * BX, 3 * BY, 0xffffff).setAlpha(0.25),
    // ---- the two nostrils, and a cheek either side
    scene.add.ellipse(-1.3, -4.4 * BY, 1, 0.9, dark).setAlpha(0.7),
    scene.add.ellipse(1.3, -4.4 * BY, 1, 0.9, dark).setAlpha(0.7),
    scene.add.ellipse(-5.4 * BX, -1.2, 3.6, 2.2, cheek).setAlpha(0.5),
    scene.add.ellipse(5.4 * BX, -1.2, 3.6, 2.2, cheek).setAlpha(0.5),
  ];
  // ---- MARKINGS, the other half of telling them apart.  A colour swap alone
  // reads as the same frog recoloured; a pattern reads as a different animal.
  // Laid out symmetrically, the way they are on a frog seen from the front.
  const markCol = mixTone(dark, 0x101010, 0.2);
  if (kit.mark === 'spots') {
    for (const [mx, my, mr] of [[-4.6, -5.4, 1.4], [4.6, -5.4, 1.4], [-6, 1, 1.5], [6, 1, 1.5], [0, -7, 1.1]] as const) {
      parts.push(scene.add.ellipse(mx * BX, my * BY, mr * 2 * BX, mr * 1.5 * BY, markCol).setAlpha(0.42));
    }
  } else if (kit.mark === 'stripe') {
    parts.push(scene.add.ellipse(0, -5.6 * BY, 2.2 * BX, 6.6 * BY, markCol).setAlpha(0.4));
    parts.push(scene.add.ellipse(-5.8 * BX, 0.6, 1.8 * BX, 7 * BY, markCol).setAlpha(0.28));
    parts.push(scene.add.ellipse(5.8 * BX, 0.6, 1.8 * BX, 7 * BY, markCol).setAlpha(0.28));
  } else if (kit.mark === 'band') {
    parts.push(scene.add.ellipse(0, -0.6 * BY, 14 * BX, 2.6 * BY, markCol).setAlpha(0.3));
  } else {
    parts.push(scene.add.ellipse(-5 * BX, -3.6 * BY, 4.6 * BX, 3.6 * BY, markCol).setAlpha(0.3));
    parts.push(scene.add.ellipse(5 * BX, -3.6 * BY, 4.6 * BX, 3.6 * BY, markCol).setAlpha(0.3));
  }
  const c = scene.add.container(0, 0, parts).setDepth(10);

  // ---- THE FACE, which is its own group so it can be given an expression.
  //
  // Eye mound, white, iris, pupil and a glint apiece, plus a lid that drops
  // over the top for a blink and a squint.  The mouth is a separate piece so
  // it can be a smile, an O of surprise or a flat line of concentration
  // without anything else on the frog having to change.
  // The eye sits IN the top of the mass rather than on top of it: the mound
  // is the same skin as the crown and overlaps it, so what shows above the
  // silhouette is the top third of an eye, the way a frog's eyes sit.
  // In profile the two eyes are no longer a mirrored pair: the far one sits
  // back and a little higher and is drawn SMALLER, which is the cheapest
  // honest way to say that one of them is further away.
  const eye = (i: number) => {
    const { x: ex0, y: ey0, r: r0 } = EYES[i];
    const ex = ex0 * BX;
    const ey = ey0 * BY;
    const r = r0 * kit.eye;
    const rim = scene.add.circle(ex, ey, r + 0.45, dark);
    const mound = scene.add.circle(ex, ey, r, skin);
    const white = scene.add.circle(ex, ey - 0.25, r * 0.75, 0xffffff);
    const iris = scene.add.circle(ex, ey - 0.1, r * 0.47, PALETTE.black);
    const glint = scene.add.circle(ex - 0.85, ey - 1, r * 0.24, 0xffffff).setAlpha(0.95);
    const spark = scene.add.circle(ex + 0.85, ey + 0.7, r * 0.13, 0xffffff).setAlpha(0.7);
    // The lid comes down over the eye FROM ITS TOP EDGE: with the origin at
    // the top, scaleY 0 is a lid that is not there and 1 is an eye shut.  A
    // lid that scales about its own middle closes over the centre of the eye
    // and leaves a ring of white showing all round it, which is not a blink,
    // it is a mask.
    const lid = scene.add.ellipse(ex, ey - r * 0.86, r * 1.8, r * 1.72, skin).setOrigin(0.5, 0).setScale(1, 0);
    return { rim, mound, white, iris, glint, spark, lid };
  };
  const eyes = EYES.map((_, i) => eye(i));
  for (const e of eyes) c.add([e.rim, e.mound, e.white, e.iris, e.glint, e.spark, e.lid]);
  // The mouth runs along the side of the snout now rather than across a face:
  // a back half and a front half, so a smile still turns up at the front and
  // a worried one still turns down.
  // A smile across the face, in two halves, so each corner can turn up for a
  // smile and down for a worry.
  const mouthL = scene.add.rectangle(MOUTH_X - 1.8, MOUTH_Y, 3.6, 1, 0x2a1a20).setAlpha(0.8);
  const mouthR = scene.add.rectangle(MOUTH_X + 1.8, MOUTH_Y, 3.6, 1, 0x2a1a20).setAlpha(0.8);
  const gape = scene.add.ellipse(MOUTH_X, MOUTH_Y + 0.7, 4.2, 3.6, 0x6b2430).setVisible(false);
  // Brows sit ON the head, one over each eye, not floating above it.
  const brows = EYES.map((e) =>
    scene.add.rectangle(e.x, BROW_Y + (e.y + 8), e.r * 1.05, 1.1, dark).setAlpha(0.85).setVisible(false),
  );
  c.add([gape, mouthL, mouthR, ...brows]);
  c.setData('legRear', legRear);
  c.setData('legFore', legFore);
  c.setData('eyes', eyes);
  c.setData('mouth', [mouthL, mouthR]);
  c.setData('gape', gape);
  c.setData('brows', brows);
  // Everybody blinks, and not in time with each other.
  c.setData('blinkIn', 1200 + Math.random() * 2600);
  c.setData('blink', 0);

  // ---- a Z coming off a sleeping frog
  const zzz = text(scene, 4, -10, 'Z', PALETTE.bone).setVisible(false);
  c.add(zzz);
  c.setData('zzz', zzz);

  // ---- a "!" over its head for a near miss
  const alert = text(scene, -2, -24, '!', PALETTE.gold).setVisible(false);
  c.add(alert);
  c.setData('alert', alert);
  c.setData('alertT', 0);

  // ---- the spray thrown off its heels as it skids
  const spray = [0, 1, 2, 3].map((k) =>
    scene.add.rectangle(0, 0, k % 2 ? 1.6 : 2.2, k % 2 ? 1.6 : 1.2, k % 2 ? 0xbfe8f2 : 0x3f8a46).setVisible(false),
  );
  spray.forEach((b) => c.add(b));
  c.setData('spray', spray);

  // ---- the jetpack: a tank on its back and the thrust off the bottom of it
  const tank = scene.add.rectangle(-6, -2, 4, 7, PALETTE.ash);
  const cap = scene.add.rectangle(-6, -5, 5, 1, PALETTE.bone);
  const flame = scene.add.triangle(-11, 1, 0, 0, 0, 5, -7, 2.5, PALETTE.gold);
  const ember = scene.add.triangle(-9, 1, 0, 0, 0, 3, -4, 1.5, PALETTE.cream);
  const pack = scene.add.container(0, 0, [tank, cap, flame, ember]).setVisible(false);
  c.add(pack);
  c.setData('jet', pack);
  c.setData('flame', flame);
  c.setData('ember', ember);

  // ---- the tongue, which is one pink rectangle that grows out of its mouth
  const tongue = scene.add.rectangle(5, -2, 1, 2, 0xff6f91).setOrigin(0.5, 0.5).setVisible(false);
  c.add(tongue);
  c.setData('tongue', tongue);

  // ================= THE PROPS =================
  //
  // One per event, every one a child of the frog, so it moves, scales and
  // turns with the animal it belongs to and cannot drift off it.  All hidden
  // until the thing they belong to happens.  An event the player cannot SEE
  // is an event that did not happen as far as a race is concerned, so each of
  // these is the visible half of a rule in `step`.
  const prop = (parts: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Container => {
    const g = scene.add.container(0, 0, parts).setVisible(false);
    c.add(g);
    return g;
  };
  // the water it came down in
  const splashArt = prop([
    scene.add.ellipse(0, 8, 18, 5, 0x4fa3c7).setAlpha(0.6),
    scene.add.ellipse(-5, 2, 3, 8, 0x8fd6ef).setAlpha(0.8),
    scene.add.ellipse(5, 2, 3, 8, 0x8fd6ef).setAlpha(0.8),
    scene.add.ellipse(0, -1, 3.4, 10, 0xbfeaf8).setAlpha(0.85),
    scene.add.circle(-7, -4, 1.4, 0xdff5fc),
    scene.add.circle(7, -5, 1.6, 0xdff5fc),
    scene.add.circle(0, -9, 1.2, 0xdff5fc),
  ]);
  c.setData('splashArt', splashArt);

  // ---- the streaks off a frog that has eaten something golden, the mud it
  // throws, the gust that bends it and that fly's own sparkle.  All hidden
  // until the model says otherwise.
  const trail = [0, 1, 2].map(() => scene.add.rectangle(0, 0, 6, 1, PALETTE.cream).setVisible(false));
  trail.forEach((t) => c.add(t));
  c.setData('trail', trail);

  const mud = [0, 1, 2].map(() => scene.add.ellipse(0, 0, 3, 2.5, 0x5a3a22).setVisible(false));
  mud.forEach((m) => c.add(m));

  const gust = [0, 1].map(() => scene.add.rectangle(0, 0, 8, 1, 0xd8ecff).setAlpha(0.7).setVisible(false));
  gust.forEach((g) => c.add(g));

  const spark = [0, 1, 2].map(() => scene.add.rectangle(0, 0, 1.6, 1.6, PALETTE.gold).setVisible(false));
  spark.forEach((s) => c.add(s));
  c.setData('spark', spark);

  // ---- and the stars that go round its head after the bird drops it.  Each
  // is a little four-pointed cross rather than a square, so three pixels of
  // gold still read as a star.
  const stars = [0, 1, 2].map(() => {
    const across = scene.add.rectangle(0, 0, 3.4, 1.1, PALETTE.gold);
    const down = scene.add.rectangle(0, 0, 1.1, 3.4, PALETTE.gold);
    const core = scene.add.rectangle(0, 0, 1.8, 1.8, PALETTE.cream);
    return scene.add.container(0, 0, [across, down, core]).setVisible(false);
  });
  stars.forEach((st) => c.add(st));
  c.setData('stars', stars);

  // ---- SMALLER, AND CUTER FOR IT.  Everything above is drawn at the size
  // it always was and then carried in one group at FROG_S, so every pose,
  // limb and prop keeps its proportions and scales together.  The group is
  // dropped by what the scale takes off the legs, so the feet stay on the
  // grass rather than the frog hovering over its own lane.
  const kids = [...c.list];
  c.removeAll(false);
  c.add(scene.add.container(0, FROG_FOOT * (1 - FROG_S), kids).setScale(FROG_S));
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
  if (won) apiRef?.record(pays);
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
    row.plate.setFillStyle(mine ? 0x2a2410 : PALETTE.tealDark);
  }
}
