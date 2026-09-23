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
const RUNNERS: Array<{ name: string; skin: number; lit: number; dark: number; cheek: number }> = [
  { name: 'GREEN', skin: 0x5fc457, lit: 0x9ae88a, dark: 0x2f7a37, cheek: 0xff9aa8 },
  { name: 'RED', skin: 0xf2685e, lit: 0xffa79c, dark: 0xa8362f, cheek: 0xffc2b0 },
  { name: 'BLUE', skin: 0x59a9ef, lit: 0x9fd6ff, dark: 0x2c66ad, cheek: 0xffa3b8 },
  { name: 'YELLOW', skin: 0xf8d45c, lit: 0xfff3b8, dark: 0xb88f1e, cheek: 0xffab8f },
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
const START_X = 42;
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
const BASE = 8.4;
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
 * frog with a boost or a good patch goes straight through; what it stops is
 * two frogs sharing one x for four seconds because neither can get by.
 */
const GAP_MIN = 4;
const GAP_MAX = 5;
const SEP_EASE = 0.55;
const CONVOY_GAIN = 0.09;
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
const FINISH_CLEAR = 26;
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
 * The convoy cannot help a frog that has just spent four seconds asleep: its
 * neighbour is thirty pixels up the road and the band it is trying to hold is
 * six.  This is the backstop, and it is deliberately blunt -- nothing at all
 * until a frog is `TOW_DEAD` behind the middle of the race, and never worth
 * more than `RESCUE_MAX` when it is.
 */
const TOW_DEAD = 14;
const RESCUE_GAIN = 0.022;
const RESCUE_MAX = 0.3;

/**
 * THE RACE IS THIRTY SECONDS.  BASE is set so a clean run is home at about
 * twenty-eight, which leaves room for a sleep, a slip and a bird inside the
 * cap.  Anyone still running at thirty is settled on distance.
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
const FOOT = 6; // where a frog's feet are, in its own drawing
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
/**
 * ================= WHAT HAPPENS TO FROGS =================
 *
 * Nine things, and they are the race.  The form is worth four seconds over
 * thirty; one of these is worth two, and every frog gets one.
 *
 * EVERY EFFECT IS MEASURED IN SECONDS OF RUNNING, not in pixels, because that
 * is how the player experiences it: "the bird put him two seconds down" is a
 * thing you can see happen.  `SEC` turns one of those seconds into the ground
 * a frog covers in it, so retuning the pace does not silently retune every
 * effect with it.
 *
 * AND NONE OF THEM TELEPORTS ANYTHING.  Each one either scales the pace for a
 * while, adds a push for a while, or takes the frog off the ground and puts it
 * back down -- and the ones that move a frog do it over their own length with
 * an ease on both ends.  Nothing in here writes a new `x` in one frame.
 */
const SEC = BASE;

/** ---- THE BIRD.  Down, hooks it, carries it BACKWARDS, drops it, leaves. */
const BIRD_DIVE_S = 0.75;
const BIRD_CARRY_S = 1.35;
const BIRD_RELEASE_S = 0.45;
const BIRD_AWAY_S = 1.2;
/** How far back it puts the frog, in seconds of running.  The point of the bird. */
const BIRD_BACK = 2.0;
/** How high it lifts it off the lane on the way. */
const BIRD_LIFT = 26;
/**
 * WHERE THE BEAK IS, inside the bird's own drawing.
 *
 * The frog it has taken is drawn AT this point rather than at its own place on
 * the track, which is the whole of the fix: the bird flies on while it carries
 * one, and a frog left at its own x is a frog hanging in the air under a bird
 * that has gone without it.
 */
const BEAK = { x: 1, y: 8 };

/** ---- THE BALLOON.  Lifts, tows it forward, lets go, and it comes down. */
const BALLOON_S = 2.0;
const BALLOON_DOWN_S = 0.5;
const BALLOON_GAIN = 2.0;
const BALLOON_H = 12;

/** ---- THE FLY.  It crosses the lanes, somebody eats it, and it sleeps it off. */
const FLY_CROSS_S = 2.6;
const TONGUE_S = 0.45;
/** How far the lick goes, in pixels.  A frog is about eleven across. */
const TONGUE_REACH = 26;
/** A full stomach is four seconds of not racing. */
const SLEEP_S = 4.0;
/** How long it takes to wake up, inside those four seconds. */
const WAKE_S = 0.8;

/** ---- THE GOLDEN FLY.  Same idea, opposite result: eat it and go. */
const GOLD_GAIN = 1.5;
const GOLD_SURGE_S = 0.9;
const GOLD_CROSS_S = 2.2;

/** ---- THE BOOST.  A fifth more pace for two seconds, and you can see it. */
const BOOST_S = 2.0;
const BOOST_MUL = 1.2;

/** ---- THE MUD.  A quarter off for two seconds, with the splash to match. */
const MUD_S = 2.0;
const MUD_MUL = 0.75;

/** ---- THE WIND.  One second of gust, forward or back, and it is drawn. */
const WIND_S = 1.0;
const WIND_PUSH = 0.9;

/** ---- THE SUPER JUMP.  One long arc that lands a second and a half up. */
const JUMP_S = 1.5;
const JUMP_GAIN = 1.5;
const JUMP_H = 22;

/** ---- THE SLIP.  Legs go, slides, gets up.  It costs about a second. */
const SLIP_S = 1.1;
const SLIP_SLIDE = 0.35;
/** The chance of one on any landing, on top of the scheduled ones. */
const SLIP_CHANCE = 0.004;

/** ---- POTHOLES.  Thinned right out: one a lane, and half of them are cleared. */
const HOLES_PER_LANE = 1;
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
const JET_CHANCE = 0.2;
const JET_WINDOW_S = 2.5;
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
const JET_MAX_SPEED = 90;
const JET_LIFT = 7;
const JET_RISE_S = 0.25;

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
const EFFECTS = ['bird', 'balloon', 'fly', 'boost', 'mud', 'wind', 'golden', 'jump', 'slip'] as const;
type EffectKind = (typeof EFFECTS)[number];
const BAND_FROM = 0.12;
const BAND_TO = 0.68;
const EXTRA_MIN = 1;
const EXTRA_MAX = 2;
/** Nothing new starts after this much of the race has gone. */
const LAST_CALL = 0.78;

/** One booked effect: when it goes off, who it goes off on, and what it is. */
interface Booking {
  at: number;
  who: number;
  kind: EffectKind;
  done: boolean;
  /** One of the four the field is guaranteed, rather than a sprinkled extra. */
  core: boolean;
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
type Going = 'run' | 'hole' | 'slip' | 'taken' | 'sleep' | 'eat' | 'balloon' | 'jump';

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

  // ---- the timed modifiers.  Each is seconds left, and each scales or adds
  // to pace rather than moving anything.
  boost: number;
  mud: number;
  wind: number;
  windDir: number;
  gold: number;

  // ---- the staged movements.  Each runs from one place to another over its
  // own length, eased at both ends; see `step`.
  /** The bird has it: where it was taken from, where it will be put down. */
  carryFrom: number;
  carryTo: number;
  /** One long arc: where it left the ground and where it lands. */
  jumpFrom: number;
  jumpTo: number;
  /** Seconds of float left, and how far through the let-go it is. */
  balloon: number;
  balloonDown: number;
  /** How far through a lick at a fly it is, 0..1. */
  tongue: number;
  /** A slip's slide, and a lean into a shove.  Drawing only. */
  slide: number;
  lean: number;
  /** Seconds of jetpack left, and the pace it was sized to fly at. */
  jet: number;
  jetSpeed: number;
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

/** The one bird, and where it is in its five beats.  See `stepBird`. */
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
let jet: Jet = makeJet();
/** What is booked to happen to whom, and when.  See `bookField`. */
let card: Booking[] = [];
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
      'BIRDS, BALLOONS, FLIES, MUD, WIND, A SLIP.',
      'SOMETHING HAPPENS TO EVERY FROG.',
      'THEY RUN CLOSE AND IT IS WON AT THE END.',
      'THIRTY SECONDS. FIRST TO THE TAPE TAKES IT.',
      '10 A TICKET, 20 BACK ON EACH.',
    ],
    controls: [
      [`1-${FIELD} / CLICK`, 'BACK THAT FROG'],
      ['UP / DOWN', 'MORE OR FEWER TICKETS'],
      ['SPACE', 'START THE RACE'],
    ],
  },
  // The field will not fit on five buttons, and it does not need to: the whole
  // lane is a hit area, so backing one is tapping the frog you want.
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
    sub = centerText(scene, GAME_W / 2, 164, `TAP A ROW OR PRESS 1-${FIELD}`, PALETTE.cream).setDepth(60);
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
            // `balloon` is not a `going` -- a frog under one is still running --
            // so a harness that only reads `going` cannot see it at all.
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

      if (r.going === 'hole') {
        // Down in a hole: sunk to the shoulders, and scrabbling.
        body.setScale(1, 0.45);
        body.setRotation(0);
        body.y = laneY + 3 + Math.sin(clock / 60) * 0.6;
      } else if (r.going === 'slip') {
        // ---- THE SLIP.  The legs go, it slides on its side, and it is back
        // on its feet before it runs again: the pose rotates out of the fall
        // rather than snapping upright on the frame the timer ends.
        const k = Phaser.Math.Clamp(r.stuck / SLIP_S, 0, 1);
        const down = ease(Math.min(1, (1 - k) * 3));
        const up = ease(Math.max(0, (0.45 - k) / 0.45));
        const fallen = down - up;
        body.setScale(1 + 0.3 * fallen, 1 - 0.5 * fallen);
        body.setRotation(0.75 * fallen);
        body.y = laneY + 3 * fallen;
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
      } else if (r.going === 'balloon') {
        // ---- UNDER A BALLOON.  Hanging, swinging, toes pointed.
        body.setScale(0.94, 1.08);
        body.setRotation(Math.sin(clock / 240) * 0.22);
        body.y = laneY - r.lift;
      } else if (r.going === 'jump') {
        // ---- THE SUPER JUMP.  One long arc: tucked at the top, stretched at
        // both ends, and nose-down coming in.
        const k = 1 - Phaser.Math.Clamp(r.stuck / JUMP_S, 0, 1);
        const v = 1 - 2 * k;
        body.setScale(1 - 0.18 * Math.abs(v) + 0.1, 1 + 0.26 * Math.abs(v));
        body.setRotation(-0.55 * v);
        body.y = laneY - r.lift;
      } else {
        // Compressed on the lane, stretched off it, tucked at the top.  The
        // feet are pinned as it squashes — a frog that shrinks about its
        // middle sinks into the track instead of flattening onto it.
        const p = hopPose(r.hop);
        // A gust bends it; mud drags it back on its heels; a boost tips it
        // forward.  All three are read off the same timers the model uses.
        const gust = r.wind > 0 ? r.windDir * 0.22 * ease(Math.min(1, r.wind / 0.3)) : 0;
        const lean = r.boost > 0 || r.gold > 0 ? -0.16 : r.mud > 0 ? 0.12 : 0;
        body.setScale(p.sx * (r.gold > 0 ? 1.08 : 1), p.sy);
        body.setRotation(p.rot + gust + lean);
        body.y = laneY - r.lift + FOOT * (1 - p.sy);
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
      const balloon = body.getData('balloon') as Phaser.GameObjects.Container | undefined;
      if (balloon) {
        const up = r.going === 'balloon';
        balloon.setVisible(up);
        if (up) {
          // The string stays taut and the skin drifts: it is holding the frog
          // up, not sitting on top of it.
          balloon.setRotation(Math.sin(clock / 300) * 0.16);
          balloon.setScale(1, 1 + Math.sin(clock / 420) * 0.04);
        }
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
          tongue.setPosition(5 + reach / 2, -2);
        }
      }
      // ---- THE BOOST.  Three streaks off its back, drawn only while it runs.
      const trail = body.getData('trail') as Phaser.GameObjects.Rectangle[] | undefined;
      if (trail) {
        const going = (r.boost > 0 || r.gold > 0) && r.going === 'run';
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
      // ---- THE MUD.  A patch under it and three clods coming off its feet.
      const mud = body.getData('mud') as Phaser.GameObjects.Ellipse[] | undefined;
      if (mud) {
        const dirty = r.mud > 0;
        mud.forEach((clod, k) => {
          clod.setVisible(dirty);
          if (!dirty) return;
          const hop = ((clock / 90 + k * 0.4) % 1);
          clod.setPosition(-4 - k * 4 - hop * 5, 3 - Math.sin(hop * Math.PI) * 5);
          clod.setScale(1 - hop * 0.5);
          clod.setAlpha(0.9 - hop * 0.8);
        });
      }
      // ---- THE GUST.  Two streaks of moving air across it, the way it blows.
      const gustArt = body.getData('gust') as Phaser.GameObjects.Rectangle[] | undefined;
      if (gustArt) {
        const blowing = r.wind > 0;
        gustArt.forEach((line, k) => {
          line.setVisible(blowing);
          if (!blowing) return;
          const run = ((clock / 34 + k * 0.5) % 1);
          line.setSize(7 + (1 - run) * 9, 1);
          line.setPosition(r.windDir * (-12 + run * 24), -5 + k * 7);
          line.setAlpha(Math.sin(run * Math.PI) * 0.8);
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

    // ---- the fly, closing on the frog it was sent to
    if (flyArt) {
      flyArt.setVisible(fly.on);
      if (fly.on) {
        flyArt.setPosition(START_X + fly.x, LANE_T + fly.lane * LANE_H + LANE_H / 2 + 1);
        const w = flyArt.getData('wing') as Phaser.GameObjects.Rectangle;
        w.setScale(1, Math.sin(clock / 18) > 0 ? 1 : -1);
        const gold = flyArt.getData('gold') as Phaser.GameObjects.Ellipse;
        const plain = flyArt.getData('plain') as Phaser.GameObjects.Ellipse;
        gold.setVisible(fly.gold);
        plain.setVisible(!fly.gold);
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
  if (r.boost > 0) r.boost = Math.max(0, r.boost - dt);
  if (r.mud > 0) r.mud = Math.max(0, r.mud - dt);
  if (r.wind > 0) r.wind = Math.max(0, r.wind - dt);
  if (r.gold > 0) r.gold = Math.max(0, r.gold - dt);
  if (r.going === 'run' && !r.boost && !r.mud && !r.wind && !r.gold && r.jet <= 0) r.fx = null;

  // ---- IN THE BIRD'S FEET.  The bird owns where it is; see `stepBird`.
  if (r.going === 'taken') return;

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

  // ---- UNDER THE BALLOON.  It tows, then it lets go and the frog comes down.
  if (r.going === 'balloon') {
    if (r.balloon > 0) {
      r.balloon -= dt;
      // up over the first half second, held, and the frog is drawn hanging
      const up = Math.min(1, (BALLOON_S - r.balloon) / 0.5);
      r.lift = BALLOON_H * ease(Math.min(up, Math.min(1, r.balloon / 0.5) || up));
      r.lift = BALLOON_H * ease(Math.min(1, Math.min(BALLOON_S - r.balloon, r.balloon + BALLOON_DOWN_S) / 0.5));
      r.x = Math.min(DIST, r.x + (BASE + (BALLOON_GAIN * SEC) / BALLOON_S) * dt);
      if (r.balloon <= 0) r.balloonDown = BALLOON_DOWN_S;
      return;
    }
    // let go: it settles back onto the lane rather than dropping out of the sky
    r.balloonDown -= dt;
    const k = Phaser.Math.Clamp(r.balloonDown / BALLOON_DOWN_S, 0, 1);
    r.lift = BALLOON_H * ease(k) * 0.9;
    r.x = Math.min(DIST, r.x + BASE * dt);
    if (r.balloonDown <= 0) {
      r.going = 'run';
      r.lift = 0;
      r.hop = 0;
      r.fx = null;
    }
    return;
  }

  // ---- THE SUPER JUMP.  One arc, from where it took off to where it lands.
  if (r.going === 'jump') {
    r.stuck -= dt;
    const k = Phaser.Math.Clamp(1 - r.stuck / JUMP_S, 0, 1);
    r.x = Math.min(DIST, r.jumpFrom + (r.jumpTo - r.jumpFrom) * ease(k));
    r.lift = JUMP_H * 4 * k * (1 - k);
    if (r.stuck <= 0) {
      r.going = 'run';
      r.lift = 0;
      r.hop = 0;
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
    if (r.going === 'slip') {
      // It keeps sliding for a moment after the legs go, and stops dead.
      const k = Phaser.Math.Clamp(r.stuck / SLIP_S, 0, 1);
      r.slide = k;
      r.x = Math.min(DIST, r.x + BASE * SLIP_SLIDE * k * dt);
    }
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
  if (r.boost > 0) speed *= BOOST_MUL;
  if (r.mud > 0) speed *= MUD_MUL;
  // The gust and the golden surge are pushes rather than gears: they are worth
  // the same ground whoever they land on.
  if (r.wind > 0) speed += r.windDir * WIND_PUSH * SEC;
  if (r.gold > 0) speed += (GOLD_GAIN * SEC) / GOLD_SURGE_S;
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
    return;
  }

  // Landed clean.  Unless it does not.
  if (Math.random() < SLIP_CHANCE) slipUp(r);
}

/** Smooth at both ends.  Every staged effect runs through this. */
function ease(k: number): number {
  const u = Phaser.Math.Clamp(k, 0, 1);
  return u * u * (3 - 2 * u);
}

/** Down it goes, wherever it was in its stride. */
function slipUp(r: Run): void {
  r.going = 'slip';
  r.stuck = SLIP_S;
  r.slide = 1;
  r.lift = 0;
  r.fx = 'slip';
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
  const kinds = [...EFFECTS];
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

  const extras = EXTRA_MIN + Math.floor(Math.random() * (EXTRA_MAX - EXTRA_MIN + 1));
  for (let i = 0; i < extras; i++) {
    out.push({
      at: (BAND_FROM + Math.random() * (LAST_CALL - BAND_FROM)) * RACE_S,
      who: Math.floor(Math.random() * FIELD),
      kind: EFFECTS[Math.floor(Math.random() * EFFECTS.length)],
      done: false,
      core: false,
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
  if (r.going !== 'run' || r.jet > 0) return false;
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
      fly.x = r.x + 34;
      fly.lane = r.i + (Math.random() < 0.5 ? -1.1 : 1.1);
      // Recorded when it is eaten, not when it is sent.  See `stepFly`.
      return true;
    }
    case 'balloon':
      r.going = 'balloon';
      r.balloon = BALLOON_S;
      r.balloonDown = BALLOON_DOWN_S;
      r.lift = 0;
      break;
    case 'boost':
      r.boost = BOOST_S;
      break;
    case 'mud':
      r.mud = MUD_S;
      break;
    case 'wind':
      r.wind = WIND_S;
      r.windDir = Math.random() < 0.5 ? -1 : 1;
      break;
    case 'jump':
      r.going = 'jump';
      r.stuck = JUMP_S;
      r.jumpFrom = r.x;
      r.jumpTo = Math.min(DIST, r.x + (JUMP_S + JUMP_GAIN) * SEC);
      break;
    case 'slip':
      slipUp(r);
      return true;
  }
  r.fx = kind;
  r.had.push(kind);
  return true;
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
  last.balloon = 0;
  last.tongue = 0;
  last.jet = burn;
  last.jetSpeed = need;
  last.lift = 0;
}

/** The bird, idle until the card calls it. */
function makeBird(): Bird {
  return { phase: 0, t: 0, x: 0, y: 0, target: -1 };
}

/**
 * THE BIRD, IN FIVE BEATS, and the frog never leaves its feet.
 *
 *   1 APPROACH  it comes in from up the track and drops onto the frog, which
 *               is still running: the shadow arrives before the bird does.
 *   2 CARRY     it has it.  The frog is drawn at the beak and goes where the
 *               bird goes, and the bird goes BACKWARDS down the track.
 *   3 RELEASE   it lets go over the lane and climbs away; the frog falls the
 *               last few pixels onto its feet rather than being teleported.
 *   4 AWAY      out of frame, and the bird is done for the race.
 *
 * What it costs is two seconds: the ground given up hanging in the air, plus
 * the few pixels of track the carry takes back.  `BIRD_DRIFT` is solved from
 * the two so retuning the timings does not silently retune the cost.
 */
const BIRD_AIR_S = BIRD_CARRY_S + BIRD_RELEASE_S;
const BIRD_DRIFT = Math.max(0, (BIRD_BACK - BIRD_AIR_S) * SEC);

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
      r.carryFrom = r.x;
      r.carryTo = Math.max(0, r.x - BIRD_DRIFT);
      r.fx = 'bird';
      r.had.push('bird');
    }
    return;
  }

  if (b.phase === 2) {
    // Lift and carry, backwards.  The frog's own x follows the bird, so what
    // the player sees and what the race scores are the same number.
    const k = Phaser.Math.Clamp(b.t / BIRD_CARRY_S, 0, 1);
    r.x = r.carryFrom + (r.carryTo - r.carryFrom) * ease(k);
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
    // Let go: the bird climbs, the frog drops the last stretch onto its feet.
    const k = Phaser.Math.Clamp(b.t / BIRD_RELEASE_S, 0, 1);
    r.lift = BIRD_LIFT * (1 - ease(k));
    // It lets go and climbs: the frog comes down on its own from here, so the
    // bird leaves the frog's height rather than carrying it down with it.
    b.x = r.x + 26 * ease(k);
    b.y = -BIRD_LIFT - BEAK.y - 20 * ease(k);
    if (k >= 1) {
      b.phase = 4;
      b.t = 0;
      r.going = 'run';
      r.lift = 0;
      r.hop = 0;
      r.fx = null;
    }
    return;
  }

  // ---- AND OUT.  It climbs away up the track under its own power rather
  // than being switched off over the frog it just dropped.
  if (b.phase === 4) {
    const k = Phaser.Math.Clamp(b.t / BIRD_AWAY_S, 0, 1);
    b.x += 70 * dt;
    b.y = -BIRD_LIFT - 18 - 40 * ease(k);
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
  // It closes on the frog's lane and on the frog.
  const k = Phaser.Math.Clamp(f.t / (span * 0.6), 0, 1);
  f.lane += (r.i - f.lane) * Math.min(1, dt * 2.4);
  f.x += (r.x + 9 - f.x) * Math.min(1, dt * 2.0);
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

/** Potholes for one lane.  One each, well inside the track. */
function digHoles(): number[] {
  const out: number[] = [];
  for (let i = 0; i < HOLES_PER_LANE; i++) {
    const band = (HOLE_TO - HOLE_FROM) / HOLES_PER_LANE;
    out.push(HOLE_FROM + band * (i + 0.15 + Math.random() * 0.7));
  }
  return out;
}

/** A fresh field: one rating each, shuffled onto the colours. */
function makeField(): Array<{ i: number; form: number; luck: number; surgeAt: number; surgeFor: number; holes: number[] }> {
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
    boost: 0,
    mud: 0,
    wind: 0,
    windDir: 1,
    gold: 0,
    carryFrom: 0,
    carryTo: 0,
    jumpFrom: 0,
    jumpTo: 0,
    balloon: 0,
    balloonDown: 0,
    tongue: 0,
    slide: 0,
    lean: 0,
    jet: 0,
    jetSpeed: 0,
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
  field: Array<{ i: number; form: number; luck: number; surgeAt: number; surgeFor: number; holes: number[] }>,
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
  jet = makeJet();
  card = bookField();

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
  }

  racers.forEach((r) => {
    const y = LANE_T + r.i * LANE_H;
    const plate = scene.add
      .rectangle(4, y + 1, 34, Math.min(15, LANE_H - 2), PALETTE.ink)
      .setOrigin(0, 0)
      .setDepth(20)
      .setStrokeStyle(1, PALETTE.steel)
      .setInteractive({ useHandCursor: true });
    plate.on('pointerdown', () => choose(r.i));
    // The whole lane is the hit area, not just the plate: a row you have to
    // aim at a 34-pixel box to back is a menu wearing a racecard's clothes.
    scene.add
      .zone(0, y, GAME_W, LANE_H)
      .setOrigin(0, 0)
      .setDepth(19)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => choose(r.i));
    const label = centerText(scene, 21, y + Math.min(15, LANE_H - 2) / 2, '', PALETTE.cream).setDepth(21);
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

  // ---- the sky, in bands rather than one fill, warming towards the horizon
  const SKY = [0x1b3358, 0x24436a, 0x2f557f, 0x3f6a92, 0x5885a4, 0x7aa3b4, 0x9dbdb9];
  const skyH = TRACK_TOP - 18;
  SKY.forEach((c, i) => {
    scene.add
      .rectangle(0, 18 + (skyH / SKY.length) * i, GAME_W, Math.ceil(skyH / SKY.length) + 1, c)
      .setOrigin(0, 0);
  });
  // a low sun behind the hills, and its haze
  scene.add.circle(248, TRACK_TOP - 26, 11, 0xffd9a0).setAlpha(0.85);
  scene.add.circle(248, TRACK_TOP - 26, 17, 0xffd9a0).setAlpha(0.18);

  // ---- the hills.  Far row first, pale and flat; near row over it, darker.
  for (const [rowY, colour, h, alpha] of [
    [TRACK_TOP - 20, 0x6f8f92, 13, 0.85],
    [TRACK_TOP - 13, 0x4a7358, 15, 1],
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
    scene.add.ellipse(x, TRACK_TOP - 14 - h / 2, between(4, 7), h, 0x2c5238).setAlpha(0.9);
  }

  // ---- THE CROWD.  A rail, and heads behind it: two rows, the back row
  // darker and smaller, because a crowd is the one thing that says this is a
  // race and not four frogs in a field.
  const crowdY = TRACK_TOP - 9;
  scene.add.rectangle(0, crowdY - 1, GAME_W, 7, 0x2a4130).setOrigin(0, 0);
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
    const base = i % 2 ? 0x2a6636 : 0x24592f;
    scene.add.rectangle(0, y, GAME_W, LANE_H, base).setOrigin(0, 0);
    // mowing: vertical bands, alternating a shade either side of the base
    for (let x = 0; x < GAME_W; x += 16) {
      scene.add
        .rectangle(x, y, 8, LANE_H, i % 2 ? 0x2e7039 : 0x285f33)
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
  scene.add.rectangle(0, TRACK_BOTTOM, GAME_W, 6, 0x1d4326).setOrigin(0, 0);
  for (let k = 0; k < 40; k++) {
    scene.add.rectangle(between(0, GAME_W), TRACK_BOTTOM + between(0, 5), between(1, 3), 1, 0x2f6b3a).setAlpha(0.6);
  }

  // ---- the starting rail, and the chequered line.
  scene.add.rectangle(START_X - 3, LANE_T, 1, FIELD * LANE_H, PALETTE.bone).setOrigin(0, 0).setAlpha(0.5);
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
function makeFlyArt(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const plain = scene.add.ellipse(0, 0, 3.5, 2.5, 0x1a1a22);
  const gold = scene.add.ellipse(0, 0, 4.5, 3.5, PALETTE.gold);
  const halo = scene.add.ellipse(0, 0, 8, 6, PALETTE.gold).setAlpha(0.22);
  const wing = scene.add.rectangle(0, -2, 5, 1.5, 0xc8d8ff).setAlpha(0.8);
  const c = scene.add.container(0, 0, [halo, wing, plain, gold]).setDepth(41);
  c.setVisible(false);
  c.setData('wing', wing);
  c.setData('gold', gold);
  c.setData('plain', plain);
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
  if (r.going === 'slip') {
    // ---- OVER IT GOES: shocked, then sheepish as it gets back up.
    const early = r.stuck > SLIP_S * 0.45;
    return early ? { eye: 1, big: 1.5, open: 1, smile: -1 } : { eye: 0.55, smile: -0.4, irisY: 0.5 };
  }
  if (r.going === 'balloon') {
    // ---- GOING UP: thrilled, looking at the balloon.
    return { eye: 1, big: 1.25, smile: 1, irisY: -0.9, open: 0.6 };
  }
  if (r.going === 'jump') {
    // ---- AIRBORNE AND LOVING IT.
    return { eye: 1, big: 1.15, smile: 1, irisY: -0.4 };
  }
  if (r.going === 'eat') {
    // ---- MID-LICK: eyes on the fly, mouth open.
    return { eye: 1, smile: 1, open: 1, irisX: 1.2 };
  }
  if (r.going === 'hole') {
    return { eye: 0.8, smile: -0.7, irisY: 0.4, brow: 1 };
  }
  if (r.mud > 0) {
    // ---- MUD: not hurt, just fed up.
    return { eye: 0.7, smile: -0.5, brow: 1, irisX: -0.4 };
  }
  if (r.boost > 0 || r.gold > 0) {
    // ---- BOOST: chin down, eyes front, absolutely going for it.
    return { eye: 0.85, smile: 1, brow: -1, irisX: 1.2, big: 1.05 };
  }
  if (r.wind > 0) {
    return { eye: 0.65, smile: -0.3, irisX: r.windDir * 0.8 };
  }
  // ---- OTHERWISE: running along, having a look about every few seconds.
  const look = Math.sin(clock / 900);
  return { eye: 1, smile: 0.7, irisX: Math.abs(look) > 0.8 ? Math.sign(look) * 0.9 : 0 };
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
    const side = i === 0 ? -1 : 1;
    // The lid closes over the eye from the top.
    (e.lid as Phaser.GameObjects.Ellipse).setScale(1, Phaser.Math.Clamp(1 - now, 0, 1) * 1.05);
    const iris = e.iris as Phaser.GameObjects.Arc;
    const wantX = side * 4.2 + (m.irisX ?? 0);
    const wantY = -7.1 + (m.irisY ?? 0);
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
  mouthL.setPosition(-2, -1.4 - smile * 0.6);
  mouthR.setPosition(2, -1.4 - smile * 0.6);
  const gasping = (m.open ?? 0) > 0;
  gape.setVisible(gasping);
  if (gasping) gape.setScale(0.7 + (m.open ?? 0) * 0.5);
  mouthL.setVisible(!gasping);
  mouthR.setVisible(!gasping);

  const brow = m.brow ?? 0;
  brows.forEach((b, i) => {
    b.setVisible(brow !== 0);
    if (!brow) return;
    const side = i === 0 ? -1 : 1;
    b.setRotation(side * 0.4 * brow);
    b.setY(-10.2 + brow * 0.6);
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
  const parts = [
    // ---- THE RIM, which is the outside edge of the whole animal.
    //
    // Drawn as the same two shapes a shade larger and in the frog's own dark
    // tone: it keeps a green frog off green grass and it reads as the shaded
    // underside of something round rather than as an outline drawn round it.
    scene.add.ellipse(0, 6.5, 8.6, 4.2, dark),
    scene.add.ellipse(0, -0.5, 15.8, 13.2, dark),
    scene.add.ellipse(0, -4.8, 13.6, 10, dark),
    // ---- the feet, just showing under the belly
    scene.add.ellipse(-5.5, 6.2, 8, 3.6, dark),
    scene.add.ellipse(5.5, 6.2, 8, 3.6, dark),
    scene.add.ellipse(-5.5, 5.8, 6.8, 2.6, skin).setAlpha(0.9),
    scene.add.ellipse(5.5, 5.8, 6.8, 2.6, skin).setAlpha(0.9),
    // ---- THE MASS.  Body first, crown over it, same colour, no seam.
    scene.add.ellipse(0, -0.5, 14.4, 11.8, skin),
    scene.add.ellipse(0, -4.8, 12.2, 8.6, skin),
    // the light across the top of it, which is what makes it look round
    scene.add.ellipse(0, -7.4, 10, 5, lit).setAlpha(0.8),
    scene.add.ellipse(-2.8, -8.4, 4.4, 2.4, 0xffffff).setAlpha(0.2),
    // ---- the belly, low and wide, and a soft pale front
    scene.add.ellipse(0, 3.2, 10.5, 6, 0xfff6e0).setAlpha(0.45),
    scene.add.ellipse(0, 4.4, 7.5, 3.2, 0xffffff).setAlpha(0.25),
    // ---- stubby little legs, tucked against the body
    scene.add.ellipse(-7, 3.4, 4.6, 5, dark).setAlpha(0.9),
    scene.add.ellipse(7, 3.4, 4.6, 5, dark).setAlpha(0.9),
    // ---- and cheeks, low on the face where a chubby thing has them
    scene.add.ellipse(-5.4, -1.4, 4.2, 2.8, cheek).setAlpha(0.5),
    scene.add.ellipse(5.4, -1.4, 4.2, 2.8, cheek).setAlpha(0.5),
  ];
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
  const EYE_X = 4.2;
  const EYE_Y = -7;
  const eye = (side: number) => {
    const rim = scene.add.circle(side * EYE_X, EYE_Y, 4.3, dark);
    const mound = scene.add.circle(side * EYE_X, EYE_Y, 3.8, skin);
    const white = scene.add.circle(side * EYE_X, EYE_Y - 0.3, 3.2, 0xffffff);
    const iris = scene.add.circle(side * EYE_X, EYE_Y - 0.1, 2.0, PALETTE.black);
    const glint = scene.add.circle(side * EYE_X - 1, EYE_Y - 1.2, 1, 0xffffff).setAlpha(0.95);
    const spark = scene.add.circle(side * EYE_X + 1, EYE_Y + 0.8, 0.5, 0xffffff).setAlpha(0.7);
    // The lid comes down over the eye FROM ITS TOP EDGE: with the origin at
    // the top, scaleY 0 is a lid that is not there and 1 is an eye shut.  A
    // lid that scales about its own middle closes over the centre of the eye
    // and leaves a ring of white showing all round it, which is not a blink,
    // it is a mask.
    const lid = scene.add.ellipse(side * EYE_X, EYE_Y - 3.5, 7.2, 7, skin).setOrigin(0.5, 0).setScale(1, 0);
    return { rim, mound, white, iris, glint, spark, lid };
  };
  const eyes = [eye(-1), eye(1)];
  for (const e of eyes) c.add([e.rim, e.mound, e.white, e.iris, e.glint, e.spark, e.lid]);
  // A smile: two short bars that meet in the middle and turn up at the ends.
  const mouthL = scene.add.rectangle(-2, -1.4, 4.4, 1.4, 0x2a1a20).setAlpha(0.9);
  const mouthR = scene.add.rectangle(2, -1.4, 4.4, 1.4, 0x2a1a20).setAlpha(0.9);
  const gape = scene.add.ellipse(0, -0.4, 5, 4.4, 0x6b2430).setVisible(false);
  // Brows sit ON the head, not above it: the head's top edge is about -8, and
  // a brow drawn at -9.6 is a pair of sticks floating over a frog.
  const brows = [-1, 1].map((side) =>
    scene.add.rectangle(side * EYE_X, -10.2, 4, 1.1, dark).setAlpha(0.85).setVisible(false),
  );
  c.add([gape, mouthL, mouthR, ...brows]);
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

  // ---- the balloon: a string, a skin, a knot and a shine, straight up
  const string = scene.add.rectangle(0, -9, 1, 10, PALETTE.bone).setAlpha(0.6);
  const skinB = scene.add.ellipse(0, -19, 11, 13, PALETTE.neon);
  const shine = scene.add.ellipse(-2.5, -22, 3.5, 5, PALETTE.cream).setAlpha(0.65);
  const knot = scene.add.triangle(0, -13, 0, 0, 3, 0, 1.5, 2.5, PALETTE.neonDim);
  const balloon = scene.add.container(0, 0, [string, skinB, shine, knot]).setVisible(false);
  c.add(balloon);
  c.setData('balloon', balloon);

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

  // ---- the boost trail, the mud it throws, the gust that bends it and the
  // sparkle off a golden fly.  All hidden until the model says otherwise.
  const trail = [0, 1, 2].map(() => scene.add.rectangle(0, 0, 6, 1, PALETTE.cream).setVisible(false));
  trail.forEach((t) => c.add(t));
  c.setData('trail', trail);

  const mud = [0, 1, 2].map(() => scene.add.ellipse(0, 0, 3, 2.5, 0x5a3a22).setVisible(false));
  mud.forEach((m) => c.add(m));
  c.setData('mud', mud);

  const gust = [0, 1].map(() => scene.add.rectangle(0, 0, 8, 1, 0xd8ecff).setAlpha(0.7).setVisible(false));
  gust.forEach((g) => c.add(g));
  c.setData('gust', gust);

  const spark = [0, 1, 2].map(() => scene.add.rectangle(0, 0, 1.6, 1.6, PALETTE.gold).setVisible(false));
  spark.forEach((s) => c.add(s));
  c.setData('spark', spark);

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
