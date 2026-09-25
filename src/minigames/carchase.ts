/**
 * FROGGY CAR CHASE.  Hard — 7 tokens in, fifteen and up out.
 *
 * A four-lane road seen from above, scrolling under you.  Traffic ahead is
 * slower than you and has to be threaded; the police behind are faster than
 * you and have to be shaken.  Cash sits on the road in bundles of twenty, and
 * it is the only thing out here worth driving AT.
 *
 * EVERYTHING ELSE ON THE ROAD IS TRYING TO END YOUR RUN.  There used to be
 * bananas to collect and Froggy banks worth fifty, and between them the road
 * was a place you went shopping.  What is on it now:
 *
 *   POTHOLES cost you the gap.  The car drops in, comes out under a second
 *   later with most of its speed and half its steering gone, and whatever was
 *   behind you closes the whole distance while it happens.  A hazard that
 *   kills is a hazard you memorise; one that costs you the gap is one you
 *   drive around.
 *
 *   OIL SPILLS cost you the car.  Three seconds of it going round on its own,
 *   drifting where it likes, with a fifth of the steering left — which is not
 *   enough to drive with and is just enough to save yourself with.  It is the
 *   widest thing out here and the only one with a sheen on it, because a
 *   hazard nobody swerves for is decoration.
 *
 *   BARRIERS cost you the lane.  Concrete parked across one or two of the
 *   four, hazard-striped and lamped, and the way past is the lanes it is not
 *   in.  It never closes the road and it never closes the lane you are in as
 *   it is laid — a wall with no door is not difficulty, it is theft.
 *
 *   PEOPLE cost you everything, and they cannot see you coming.  They walk out
 *   into the road, tap along it, change their mind and turn round.  They are
 *   unpredictable in DIRECTION and never in arrival: one enters at the top
 *   edge and walks at a fraction of the closing speed, so the whole height of
 *   the road is the warning.
 *
 *   SPIKE STRIPS close most of the lanes at once with a gap to thread, and
 *   they arrive last of all.
 *
 * THE ROAD DOES NOT ARRIVE FINISHED.  Potholes are out there from the gun; oil
 * at a hundred and fifty, concrete at three hundred and fifty, people at five
 * hundred, strips at six hundred — and every one of those steps also tightens
 * the clocks on everything already out there.  A player who dies in the first
 * thirty seconds died to traffic, because traffic is all there was.  See
 * `stage()`.
 *
 * THE FROGGY BOMB IS THE ONLY TOOL, AND IT IS BOUGHT, NOT FOUND.  SPACE puts
 * one down a car's length behind you and takes THIRTY OF THE CASH YOU ARE
 * PLAYING FOR to do it.  The first police car to reach it goes round — spun
 * out, siren off, sliding back down the road — and the road behind you clears
 * for ten seconds with it.  There is no carry limit, because the bag is the
 * carry limit: with four hundred on you it is four escapes, and with
 * twenty-nine it is a button that says so and does nothing.
 *
 * Spending really does cool the chase, too — the police read the bag itself,
 * so thirty off it can take a car off your tail as well as buying the bomb.
 * What it cannot do is roll the ROAD back: the hazards are staged off the most
 * cash the run has ever held, so nobody shops their way down to an easier
 * road.  See `peak`.
 *
 * Getting TO two hundred is the gentle half: the road climbs slowly, traffic
 * is thin, and a second car does not turn up for three quarters of a minute.
 *
 * Three hundred cash is the pay bar: fifteen tokens, and five more for every
 * further hundred.  TWO HUNDRED IS WHEN THEY START TAKING YOU SERIOUSLY.
 * Every two hundred in the bag puts another car on the road behind you, all
 * the way to eight, and the first three notches also make them faster, the
 * traffic thicker and the road quicker.  The run ends on a crash, on being
 * caught.  There is nothing to bank and nothing to press: three hundred in
 * the bag EARNS the tokens outright, and being caught afterwards does not
 * take them back — so carrying on past the bar is a free bet on a chase that
 * is getting worse.
 *
 * THEY CAN BE JUKED, AND THEY CAN BE CRASHED.  A chaser steers at the lane it
 * last SAW you in, and it only looks every few tenths of a second, so a late
 * swerve leaves it committed to where you were — that lag is the whole of how
 * you shake one without a bomb, and it shortens as the heat climbs.  It also
 * means you can aim them: a chaser locked onto your old lane drives into the
 * back of the traffic in it, or into the concrete in it, and spins out.  The
 * spike strips cut both ways too — a police car that drives over one goes out
 * the same way your car would have.
 *
 * THE TRAFFIC CHANGES LANES, AND IT INDICATES THREE TIMES FIRST.  Cars are not
 * rails: they follow the car in front, back off when they close on it, pull out
 * to pass, and — one at a time — move onto the line the player is sitting on.
 * That last one is what stops the road being solvable by parking: a car is
 * twelve wide in a lane four and a half times that, so standing on a lane line
 * used to be a corridor nothing could occupy.  Every change is announced, and
 * the announcement is COUNTED rather than timed: the indicator comes on, it
 * blinks exactly `SIGNAL_BLINKS` times with the car still dead in its lane, and
 * only on the far side of the third blink does it start to move — and then it
 * eases across over `LANE_CHANGE_MS`, better than a second and a half, at about
 * a quarter of the speed the player can steer.
 *
 * So the road is a weapon, not just an obstacle, and nothing on it is placed
 * where you already are: never twice in the same lane, never behind a car that
 * is already there, always a lane or two off your line, and jittered ACROSS
 * the lane rather than parked in the middle of it.
 *
 * The cash here is a score.  It is not the cash the man outside pays, it is
 * never added to it, and the only thing that leaves this cabinet is the token
 * payout through the shell (MG-3).  Best run is kept per profile.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'carchase' as const;

/**
 * The HEAT notch: every two hundred in the bag is another car on your tail.
 * This is the difficulty curve, and it is not the same number as the pay bar.
 */
export const TARGET_CASH = 200;
/**
 * The PAY bar, and what clearing it is worth.
 *
 * Three hundred to earn anything, TWENTY TOKENS for it, and five more for
 * every hundred the run ever held after that.  Clearing it is a latch: see
 * `earned`.  It is deliberately past the first heat notch:
 * one police car turns up at two hundred, so nobody banks a run without
 * having been chased by somebody.
 *
 * Twenty because the cabinet takes ten: every ten token machine on this floor
 * pays twenty for the win, and a road that paid fifteen for clearing its own
 * bar was the one that asked for more and gave back less.
 */
export const BAR_CASH = 300;
export const BASE_REWARD = 20;
export const STEP_CASH = 100;
export const STEP_REWARD = 5;
export const CASH_PER_PICKUP = 20;

/**
 * THE CAMERA IS PULLED BACK.
 *
 * The road used to be a 128px ribbon down the middle of a 320px screen, with
 * two fat verges either side that were never anything but scenery.  The view
 * is the same 320 pixels, so the only way to show MORE road is to give the
 * road more of them: the verges are trimmed to what reads as a verge and the
 * carriageway is nearly twice as wide.  Same four lanes, same 12x20 cars, so
 * every lane is now a room rather than a slot — which is most of what makes
 * the traffic readable at the new, slower lane-change speeds below.
 */
const ROAD_L = 52;
const ROAD_W = 216;
const LANE_W = ROAD_W / 4;
const LANES = [0, 1, 2, 3].map((i) => ROAD_L + LANE_W * i + LANE_W / 2);
const TOP = 18;
const BOTTOM = 180;
const CAR_W = 12;
const CAR_H = 20;

/**
 * Road speed in px/s: where it starts, how fast it climbs, where it stops.
 *
 * The climb is deliberately slower than it was: the road used to be at its
 * worst before most players had two hundred in the bag, so the run ended
 * before it had paid for itself.  Reaching the bar is the gentle half of the
 * game and the HEAT below is the hard half — which is the right way round,
 * because the heat only arrives once you have been paid.
 *
 * Eased AGAIN here — everything on this road now moves about fifteen per cent
 * slower than it did.  The road speed is what every other car on screen is
 * measured against, so dropping it is the single biggest thing that slows the
 * traffic down as the player sees it: a car closing at forty pixels a second
 * can be read and steered around, one closing at seventy has to be guessed.
 */
const SPEED_START = 88;
const SPEED_RAMP = 0.85;
const SPEED_MAX = 190;
/**
 * How hard it steers.
 *
 * 120 was a car that took most of a second to cross one lane, which on a road
 * four lanes wide meant a player pinned against a verge could not get back out
 * into it before the next thing arrived.  At 170 a lane is a flick and the
 * whole width is reachable, which is what the pickups need: they land anywhere
 * on the road and they are only worth putting there if going for one is a
 * decision rather than a commitment.
 */
const STEER = 170;
const CREEP = 50;
/**
 * THE RESPITE.  Ten seconds with nobody behind you.
 *
 * It is granted by the two things that are supposed to feel like winning: a
 * NITRO burst, and leading a chaser into the back of a traffic car.  Every
 * police car on the road drops out of the chase and no replacement is sent
 * for ten seconds, so the reward for playing well is TIME — time to breathe,
 * reposition, sweep up the cash you have been driving past, and pick a lane
 * for what comes next.
 *
 * It replaces the old reward, which was a couple of seconds of distance that
 * the speed difference took straight back.  Both triggers share one timer, so
 * a bomb dropped during a crash respite extends the quiet rather than stacking
 * a second one on top of it, and nothing can send two cars out at once when it
 * ends: the spawner is on its usual one-at-a-time clock and starts from a full
 * interval, so the first car back is a car, not a wall.
 */
const RESPITE_MS = 10_000;
/** And it comes back in gently: the first spawn after a respite is unhurried. */
const RESPITE_TAIL_MS = 1800;

/**
 * THE FROGGY BOMB, WHICH REPLACED THE NITRO AND THEN THE BANANA.
 *
 * Nitro was a button that made the problem go away: press it, the road
 * emptied, and the only decision was whether the bar was full.  Bananas fixed
 * that by making you go and find one -- but once you had, the escape was free,
 * and a free escape is a button with extra steps.
 *
 * A bomb is bought, out of the cash you are playing for, every single time.
 * That is the whole design: thirty off the bag is a token and a half off the
 * payout, so using it is a decision with a price rather than an inventory
 * check.  What it buys is unchanged -- a chaser off the road and ten seconds
 * of quiet behind you.
 */
const BOMB_COST = 30;
/** How long a dropped bomb stays on the road before the sweeper gets it. */
const BOMB_LIFE_MS = 9000;

/**
 * OIL SPILLS.  A second and a half of not driving the car.
 *
 * The pothole costs you the gap.  This costs you the WHEEL: drive over a slick
 * and the car lets go, spins, and drifts wherever it was already going for a
 * second and a half.  Everything else out here is a thing you steer around;
 * this is the one that takes the steering away, which is why it is the hazard
 * that makes a busy road frightening rather than merely busy.
 *
 * NOT A FREEZE, THOUGH.  A hazard that removes every input with four police
 * cars on your bumper is not difficulty, it is a cutscene of your own death —
 * so a fifth of the steering survives the spin.  It is not enough to drive
 * with and it is enough to save yourself with, which is the difference between
 * a hazard and a verdict.
 *
 * THREE SECONDS WAS TOO LONG.  At that length the spin outlasted the stretch
 * of road you could see coming, so there was nothing to do with the steering
 * that survived it: you went round, and whatever you were going to hit was
 * already decided.  At a second and a half the fifth of a wheel you keep is
 * worth using, which is the whole point of leaving it.
 */
const OIL_SPIN_MS = 1500;
/** What is left of the steering while the car is going round. */
const OIL_STEER = 0.2;
/**
 * How hard the spin throws the car sideways, px/s at its worst, and how many
 * times it swings there and back over the three seconds.
 *
 * A LOOSE CAR TRAVELS.  At 34 over two and a half swings the drift reversed
 * before it had gone anywhere and the whole thing read as a wobble: the car
 * ended up a quarter of a lane from where it started and the player barely had
 * to answer it.  Half the swings and half again the force, and it crosses most
 * of a lane one way before it comes back -- which the twenty per cent of
 * steering left can lean against and cannot beat.
 */
const OIL_DRIFT = 52;
const OIL_SWINGS = 1.25;
/** Degrees a second the body turns while it is loose. */
const OIL_SPIN_RATE = 520;

/**
 * ROAD BARRIERS.  The lanes themselves close.
 *
 * Traffic can be threaded and hazards can be steered round, but both of them
 * leave the whole width of the road available in principle.  A barrier takes
 * lanes off the table: concrete in one or two of them, parked there, and the
 * only way past is the lanes it is not in.  It is what stops the road being a
 * flat plane you can be anywhere on.
 *
 * IT NEVER CLOSES THE ROAD.  At most two of four lanes, never the one the
 * player is in at the moment it is laid, and never so far from them that the
 * gap cannot be reached at `STEER` before it arrives.  A wall with no door is
 * not a difficulty, it is a coin-op stealing your token.
 */
const BARRIER_MAX_LANES = 2;
const BARRIER_H = 14;
/** How often one is laid, and the floor that gap falls to at full difficulty. */
const BARRIER_GAP_MS = 5200;
const BARRIER_GAP_MIN = 2400;

/**
 * BLIND PEDESTRIANS.  They cannot see you and they are crossing anyway.
 *
 * A moving hazard that does not care where you are is a different problem from
 * traffic, which does: traffic holds a lane and announces itself, and these
 * wander.  One walks out, taps along, changes its mind, and turns round — the
 * unpredictability is the point, and it is why they get the whole height of
 * the road to be seen coming across.
 *
 * THEY ARE SLOW, AND THEY START AT THE TOP.  A pedestrian enters at the top
 * edge and walks at a fraction of the closing speed, so there is never less
 * than a second and a half of watching one before it is anywhere near the car.
 * That is the fairness: they are unpredictable in DIRECTION, never in arrival.
 */
const PED_W = 5;
const PED_H = 7;
/** How fast one walks across the road, and down it, px/s. */
const PED_CROSS = 22;
const PED_ALONG = 14;
/** How long one holds a heading before it thinks again, ms. */
const PED_TURN_MS = 900;
const PED_GAP_MS = 6000;
const PED_GAP_MIN = 2600;

/**
 * WHEN EACH OF THEM STARTS TURNING UP, in cash banked.
 *
 * The road does not arrive finished.  Potholes are there from the gun; the oil
 * comes in once the run is worth something; the concrete once it is worth a
 * lot; the pedestrians and the spike strips last of all.  A player who dies in
 * the first thirty seconds should have died to traffic, because traffic is all
 * that was out there.
 *
 * Measured against the MOST cash the run has ever held rather than what is in
 * the bag right now -- see `peak`.  Otherwise buying a bomb would roll the road
 * back to an earlier stage, and a hazard that can be un-summoned by spending
 * is a hazard the player learns to shop their way out of.
 */
const OIL_CASH = 150;
const BARRIER_CASH = 350;
const PED_CASH = 500;
/**
 * POTHOLES.  The one thing out here that does not end the run and is still
 * worth swerving for: the car drops into it, loses most of its speed and half
 * its steering for a moment, and whatever is behind you closes the whole gap
 * while it happens.  A hazard that kills is a hazard you memorise; one that
 * costs you the gap is one you drive around.
 */
const POTHOLE_JOLT_MS = 900;
/**
 * THE CAR ONLY TAKES THREE OF THEM.
 *
 * A pothole used to cost the gap and nothing else, so a player who could
 * afford the seconds could simply drive through every one on the road -- the
 * hazard had no memory and there was no reason to treat the third differently
 * from the first.  Now the car does the remembering:
 *
 *   one    the jolt, as before: most of the speed and half the steering, a beat
 *   two    the same jolt, and it starts smoking, so the damage is on screen
 *   three  the axle goes, the car rolls to a stop, and the run is over
 *
 * The count is per run and resets with everything else at the gun.  A pothole
 * is destroyed by the contact that registers it, so one hole is one hit
 * however many frames the boxes overlap for.
 */
const POTHOLE_MAX = 3;
/** Hits before the engine starts showing it. */
const SMOKE_FROM = 2;
/** How long the car takes to roll to a stop once the axle has gone. */
const BREAKDOWN_MS = 1200;
/** How often a damaged engine coughs out a puff, ms. */
const SMOKE_EVERY = 130;
const SMOKE_LIFE = 900;
/** What is left of the throttle and the steering while you are in one. */
const POTHOLE_SPEED = 0.45;
const POTHOLE_STEER = 0.4;
/** A police car this close behind you is a warning. */
const WARN_DIST = 70;
/**
 * How often a chaser looks up to see which lane you are in.  Between looks it
 * drives at where you WERE, which is what makes a late swerve work: change
 * lanes as one closes and it commits to the old line and goes past.  Sharper
 * eyes with every notch of heat, down to a floor — they get harder to juke,
 * never impossible.
 */
const POLICE_REACT_MS = 460;
const POLICE_REACT_FLOOR = 200;
/**
 * How long a police car is out of the chase after it hits something.  It
 * spins, drops its siren, slows to a crawl and falls back down the road; if
 * it is still on screen when it comes round, it starts chasing again.
 */
const POLICE_STUN_MS = 2800;
/** Crawling speed of a spun-out car, so the wreck is watchable. */
const POLICE_STUN_SPEED = 26;
/**
 * The most cars they will ever have on you at once.
 *
 * Six, and now eight.  The cap was reached at a thousand in the bag and the
 * chase stopped growing there, so the last third of a long run was the same
 * road as the middle of it: what was left to go wrong was only ever the
 * hazards.  At eight the pursuit keeps getting heavier for as long as the
 * player keeps deciding to stay out, which is the decision the whole game is
 * built around asking.
 */
const POLICE_MAX = 8;
/**
 * Cash at which the road itself turns against you: spike strips, laid across
 * most of the lanes with a gap to thread.  It is the one hazard that is not a
 * car, it arrives long after the run has paid for itself, and it is the reason
 * a big bag is worth banking.
 */
export const TRAP_CASH = 600;
/** Lanes a strip covers: two at first, three once the bag is twice over. */
const TRAP_GAP_MS = 9000;
/**
 * How much faster the police are than you, and how hard they steer at you.
 *
 * Eleven, down from twenty by way of fifteen.  It is still a gap that closes —
 * you cannot out-drive them on the throttle alone, which is the whole point of
 * the bombs and of the traffic — but it shuts at a speed a player can read and
 * answer, instead of one that turns every mistake into an arrest.
 */
const POLICE_GAIN = 11;
const POLICE_STEER = 48;
/**
 * How much they gain with the clock, as a divisor of elapsed ms.  Bigger is
 * gentler; this went 3500 to 4500 to 6000 with the same reasoning as above.
 */
const POLICE_CLOCK = 6000;
/**
 * The heat.  Every TARGET_CASH in the bag is a notch, up to HEAT_MAX: one more
 * car behind you, that much more speed on all of them, thicker traffic and a
 * quicker road.  Tying it to the cash rather than the clock is the point — the
 * run gets harder because of what you are carrying, so the decision to stay
 * out for another two hundred is a decision to be chased harder for it.
 */
const HEAT_MAX = 3;
const HEAT_POLICE_GAIN = 8;
const HEAT_ROAD = 16;

/**
 * TRAFFIC DRIVES.  IT DOES NOT SLIDE DOWN A RAIL.
 *
 * Every car used to be pinned to the centre of the lane it spawned in for its
 * whole life on screen, and that made the road solvable by standing still:
 * a car is twelve wide in a thirty-two wide lane, so a player parked ON a lane
 * line — the middle of the road most obviously — sat in a corridor nothing
 * could ever occupy.  No steering, no timing, no risk.  The fix is not a wider
 * hit box, which would only punish honest driving; it is that the cars now
 * CHANGE LANES, so there is no x on the road that traffic will not eventually
 * drive through.
 *
 * And a car that swerves without warning is just a different unfairness, so
 * every change is announced and the announcement is counted: the indicator
 * comes on, it blinks three whole times with the car still in its lane, and
 * only then does it start to move — easing across over `LANE_CHANGE_MS` rather
 * than snapping.  That is about one and a half seconds of notice before the
 * car is anywhere near your line and another one and a half while it crosses,
 * against under half a second to cross a lane at `STEER`.  Plenty, IF you are
 * watching the road.
 */
/**
 * THE INDICATOR IS COUNTED, NOT TIMED.
 *
 * `LANE_WARN_MS` is not a number somebody picked that happens to look like
 * blinking; it is exactly three blinks long, and the car is released by the
 * third one finishing rather than by a clock running out.  So "it blinks three
 * times and then it moves" is literally what the code does, and changing the
 * blink rhythm cannot quietly change how much warning the player gets.
 *
 * The lamp keeps blinking on the same rhythm all the way through the change,
 * the way a real indicator does — the three that matter are the three BEFORE
 * the car has moved an inch, which is what `blinks` counts.
 */
/**
 * The indicator's colour, which belongs to the indicator alone.  No car is
 * painted this, so the lamp can never be lost against the bodywork.
 */
const SIGNAL_ON = 0xff7a1a;
const SIGNAL_BLINKS = 3;
const BLINK_ON_MS = 260;
const BLINK_OFF_MS = 200;
const BLINK_CYCLE_MS = BLINK_ON_MS + BLINK_OFF_MS;
const LANE_WARN_MS = SIGNAL_BLINKS * BLINK_CYCLE_MS;
/**
 * And the change itself is slow.  A lane is 54px wide now, so easing across
 * one over 1.6 seconds is about 34px/s — less than a third of the 120px/s the
 * player steers at, and better than three seconds of notice end to end once
 * the three blinks in front of it are counted.  Nothing on this road snaps.
 */
const LANE_CHANGE_MS = 1600;
/** How often a car reconsiders which lane it wants to be in. */
const THINK_MS = 900;
/** How hard a car may accelerate or brake, px/s². */
const CAR_ACCEL = 34;
/**
 * And how hard it may while it is crossing a line: barely at all.  A car that
 * picks up speed halfway through a lane change arrives somewhere the player
 * did not predict from watching it start, which undoes the point of the three
 * blinks.  It holds its pace and moves over.
 */
const LANE_CHANGE_ACCEL = 8;
/** It starts easing off inside this gap to the car in front. */
const FOLLOW_GAP = CAR_H + 12;
/**
 * At most one car may be moving onto the player's line at a time, and at most
 * two may be changing lanes at all.  The point is that standing still stops
 * working, not that the road becomes a blender.
 */
const HUNTERS = 1;
const CHANGERS = 2;
/**
 * How fast traffic actually drives, px/s.  Raised from 35-75 along with the
 * drop in road speed above, and the two together are the "slow the other cars
 * down" change: what the player experiences is not a car's ground speed but
 * the speed it comes DOWN THE SCREEN at, which is the road minus this.  That
 * closing speed used to run 29-69px/s and now runs 22-48, so the slowest thing
 * on the road drifts toward you instead of arriving.
 */
const TRAFFIC_MIN = 40;
const TRAFFIC_SPAN = 26;
let nextCarId = 1;

interface Mover {
  x: number;
  y: number;
  /** Ground speed of its own, px/s, along the road. */
  own: number;
  body: Phaser.GameObjects.Container;
}

/**
 * A traffic car, with somewhere it wants to be and a speed it wants to do.
 *
 * `lane` is where it is going, `from` where the current change started, and
 * `move` how far through that change it is — -1 when it is simply driving.
 */
interface Car extends Mover {
  /** Stable across frames, so a harness can watch one car rather than a list. */
  id: number;
  lane: number;
  from: number;
  /** -1 indicating left, +1 right, 0 not indicating. */
  signal: -1 | 0 | 1;
  /** ms since the indicator came on: drives both the blink and the count. */
  signalMs: number;
  /** Blinks completed since it came on.  It may not move until SIGNAL_BLINKS. */
  blinks: number;
  /** ms of indicating left before it may start to move. */
  warn: number;
  /** 0..1 through a lane change, or -1 when it is not making one. */
  move: number;
  /** ms until it next thinks about its lane. */
  think: number;
  /** The speed it would do on an empty road, and the speed it is trying to
   * do right now.  `own` is what it is actually doing and eases toward `want`. */
  cruise: number;
  want: number;
  /** True while this change is aimed at the player's line. */
  hunting: boolean;
  lamps: Phaser.GameObjects.Rectangle[];
}

/** A chaser.  It carries what it thinks it knows and how hurt it is. */
interface Police extends Mover {
  /** The x it is steering at: your lane as of its last look, not your lane. */
  aim: number;
  /** ms until it looks again. */
  react: number;
  /** ms left of being spun out.  Zero means it is chasing. */
  stun: number;
}

/**
 * A spike strip.  `lanes[i]` is true where the strip covers lane i, so the
 * false ones are the gap you have to be in.  It scrolls down with the road
 * like everything else, which is what makes it dodgeable rather than a tax.
 */
interface Trap {
  y: number;
  lanes: boolean[];
  body: Phaser.GameObjects.Container;
}

/**
 * A slab of concrete parked in one lane.  It scrolls down with the road and it
 * does not move within it -- what makes it a hazard is that the lane it is in
 * is gone, not that it is coming for you.
 */
interface Barrier {
  x: number;
  y: number;
  lane: number;
  body: Phaser.GameObjects.Container;
}

/**
 * Somebody in the road.  `vx`/`vy` are where they are walking, `turn` is how
 * long until they think better of it, and `cane` is the white stick, which is
 * the only reason a five pixel shape at this size reads as a person.
 */
interface Ped {
  x: number;
  y: number;
  vx: number;
  vy: number;
  turn: number;
  body: Phaser.GameObjects.Container;
  cane: Phaser.GameObjects.Rectangle;
}

let scene0: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let player: Phaser.GameObjects.Container | null = null;
let px = LANES[1];
let py = 140;
let speed = SPEED_START;
let elapsed = 0;
let traffic: Car[] = [];
let police: Police[] = [];
let traps: Trap[] = [];
let trapTimer = 0;
/** The lane the last pickup went in, so the next one does not repeat it. */
let lastJarLane = -1;
let cash: Array<{ x: number; y: number; body: Phaser.GameObjects.Rectangle }> = [];
/**
 * WHAT IS LYING ON THE ROAD.
 *
 * Two kinds, one list, because they do the same thing every frame -- come down
 * the screen at road speed and get tested against the car -- and differ only
 * in what they cost when they are reached.  NEITHER IS WORTH HAVING: the road
 * used to hand out bananas and Froggy banks and there is nothing on it now
 * that is not trying to end your run, which is most of why this road is harder
 * than the one it replaced.  The cash bundles are still out there, and they
 * are the only thing left to drive AT.
 *
 *   pothole  costs you the gap: most of the speed, half the steering, a beat
 *   oil      costs you the car: three seconds of it going round on its own
 */
type PickupKind = 'pothole' | 'oil';
let pickups: Array<{ x: number; y: number; kind: PickupKind; body: Phaser.GameObjects.Container }> = [];
let jarTimer = 0;
/** Bombs already down on the road.  There is no carrying any more: see BOMB_COST. */
let drops: Array<{ x: number; y: number; life: number; body: Phaser.GameObjects.Container }> = [];
/** Milliseconds left of being in a pothole.  See POTHOLE_JOLT_MS. */
let joltMs = 0;
/** Milliseconds left of the car being loose, and which way it is going round. */
let spinMs = 0;
let spinDir = 1;
/** Potholes hit this run, out of POTHOLE_MAX.  Reset at the gun. */
let potholeHits = 0;
/** Milliseconds of rolling to a stop with a broken axle.  0 when driving. */
let brokenMs = 0;
let smokeTimer = 0;
let smoke: Array<{ x: number; y: number; life: number; body: Phaser.GameObjects.Arc }> = [];
let barriers: Barrier[] = [];
let barrierTimer = 0;
let peds: Ped[] = [];
let pedTimer = 0;
/**
 * The most cash this run has ever held.
 *
 * The hazards are staged off THIS, not off what is in the bag: buying a bomb
 * takes thirty out of the bag, and a road that quietly went back to being
 * gentle every time you bought one would be a road you could shop your way
 * down.  The police still read the bag itself, so spending really does cool
 * the chase -- that is what the thirty buys besides the bomb.
 */
let peak = 0;
/**
 * THE REWARD IS EARNED AT THE BAR, AND THEN IT IS THE PLAYER'S.
 *
 * It used to be worked out from what was in the bag when the run ended, which
 * meant two ways of losing it after clearing three hundred: buy a bomb and
 * drop back under the bar, or get caught and have the whole run pay nothing.
 * Both read as the machine taking back something it had already given.
 *
 * So the bar is a latch.  The moment the bag touches `BAR_CASH` this turns
 * true and nothing turns it off again -- not a bomb, not a crash, not the
 * law -- and the payout is worked out from `peak`, the most the run ever
 * held.  Caught before the bar is still nothing, which is the bet.
 */
let earned = false;
let warnT = 0;
let dashes: Array<Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc | Phaser.GameObjects.Container> = [];
let trafficTimer = 0;
let policeTimer = 0;
/** Milliseconds left with the road behind you empty.  See RESPITE_MS. */
let respiteMs = 0;
/** Dev only: nothing on the road can end the run, for testing the police. */
let shielded = false;
let cashTimer = 0;
let collected = 0;
let best = 0;
/** The last heat notch the player was told about, so it is announced once. */
let heatShown = 0;
let over = false;
/** What ended the run, for the HUD's sake and for the harness's. */
let reason = '';
let keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
let hud: {
  cash: Phaser.GameObjects.BitmapText;
  best: Phaser.GameObjects.BitmapText;
  time: Phaser.GameObjects.BitmapText;
  bank: Phaser.GameObjects.BitmapText;
  bombLabel: Phaser.GameObjects.BitmapText;
  damage: Phaser.GameObjects.BitmapText;
  warn: Phaser.GameObjects.BitmapText;
  clear: Phaser.GameObjects.BitmapText;
} | null = null;

export function chasePayout(c: number): number {
  if (c < BAR_CASH) return 0;
  return BASE_REWARD + STEP_REWARD * Math.floor((c - BAR_CASH) / STEP_CASH);
}

/**
 * What this run is worth right now: nothing until the bar is cleared, and
 * from then on what the run's best bag was worth, however it ends.
 */
function runReward(): number {
  return earned ? chasePayout(Math.max(peak, collected)) : 0;
}

/**
 * How hard they are chasing, from what is in the bag.  A pure function of the
 * cash, so nothing can drift out of step with it — the pickup only decides
 * when to SAY so.
 */
export function chaseHeat(c: number): number {
  return Math.min(HEAT_MAX, Math.floor(c / TARGET_CASH));
}

export const carChase: MinigameModule = {
  id: ID,
  title: 'FROGGY CAR CHASE',
  music: 'game_carchase',
  rules: 'dodge, grab cash, bomb the law',
  tutorial: {
    objective: [
      'GRAB CASH AND LOSE THE LAW.',
      'SPACE BUYS A FROGGY BOMB - 30 CASH.',
      'IT SPINS THE LAW AND CLEARS THEM 10s.',
      'OIL SPINS YOU 1.5s. CONCRETE ENDS YOU.',
      'POTHOLE 1 SLOWS YOU. 2 STARTS SMOKE.',
      'POTHOLE 3 BREAKS THE CAR - RUN OVER.',
      'REACH 300 FOR 20, +5 EVERY 100. KEPT.',
    ],
    controls: [
      ['A / D', 'STEER'],
      ['W / S', 'SPEED UP OR EASE OFF'],
      ['SPACE', 'BUY A BOMB - 30 CASH'],
    ],
    // There is no bank button and no way to stop: once three hundred is in
    // the bag the tokens are safe, so the only question left on the road is
    // how much further it goes.  The HUD says `n TOKENS SAFE` for it.
  },
  touch: {
    stick: 'wasd',
    buttons: [
      { label: 'BOMB\n30', key: 'SPACE', primary: true },
    ],
  },
  payoutNote: 'WIN: 20+',

  create(scene: Phaser.Scene, api: MinigameApi) {
    scene0 = scene;
    apiRef = api;
    px = LANES[1];
    py = 140;
    speed = SPEED_START;
    elapsed = 0;
    traffic = [];
    police = [];
    cash = [];
    dashes = [];
    trafficTimer = 2600;
    policeTimer = 8000;
    respiteMs = 0;
    shielded = false;
    cashTimer = 900;
    pickups = [];
    drops = [];
    jarTimer = 3000;
    lastJarLane = -1;
    traps = [];
    trapTimer = TRAP_GAP_MS;
    warnT = 0;
    collected = 0;
    earned = false;
    peak = 0;
    best = store.highScore(ID);
    drops = [];
    pickups = [];
    barriers = [];
    barrierTimer = BARRIER_GAP_MS;
    peds = [];
    pedTimer = PED_GAP_MS;
    joltMs = 0;
    spinMs = 0;
    spinDir = 1;
    potholeHits = 0;
    brokenMs = 0;
    smokeTimer = 0;
    smoke = [];
    heatShown = 0;
    over = false;
    reason = '';

    // verge, road, lane lines.  Things spawn above the top edge and scroll
    // in, and the shell's title bar has to stay on top of them — so nothing is
    // drawn until it is below the bar (see `onScreen`).  Negative depths were
    // tried for this and put the whole road under the shell's black backdrop.
    // ---- THE GROUND EITHER SIDE, IN LAYERS.
    //
    // It was one flat 0x17301c slab from edge to edge, which read as a green
    // wall the road had been cut into.  The verge is built outward from the
    // kerb instead - gravel where the tarmac has spilled over, then grass,
    // then the dark treeline at the screen edge - so the eye has somewhere to
    // measure speed against and the road reads as a road through somewhere
    // rather than a strip on a background.
    const VERGE_R = ROAD_L + ROAD_W + 3;
    scene.add.rectangle(0, TOP, GAME_W, BOTTOM - TOP, 0x1c3a22).setOrigin(0, 0).setDepth(1);
    for (const [gx, gw] of [[0, 18], [GAME_W - 18, 18]] as const) {
      scene.add.rectangle(gx, TOP, gw, BOTTOM - TOP, 0x102a17).setOrigin(0, 0).setDepth(1);
    }
    for (const [sx2, sw] of [[ROAD_L - 11, 8], [VERGE_R, 8]] as const) {
      scene.add.rectangle(sx2, TOP, sw, BOTTOM - TOP, 0x3a3a30).setOrigin(0, 0).setDepth(1);
      scene.add.rectangle(sx2, TOP, sw, BOTTOM - TOP, 0x4a4a3c).setOrigin(0, 0).setDepth(1).setAlpha(0.35);
    }
    // ---- THE ROAD.  Wheel tracks down each lane and a scatter of chippings,
    // because at this camera height the tarmac is half the screen.
    scene.add.rectangle(ROAD_L, TOP, ROAD_W, BOTTOM - TOP, 0x2a2d33).setOrigin(0, 0).setDepth(1);
    for (let i = 0; i < 4; i++) {
      const cx2 = ROAD_L + LANE_W * i + LANE_W / 2;
      for (const off of [-5, 5]) {
        scene.add.rectangle(cx2 + off, TOP, 5, BOTTOM - TOP, 0x31343b).setOrigin(0.5, 0).setDepth(1).setAlpha(0.6);
      }
    }
    for (let i = 0; i < 90; i++) {
      const gx2 = ROAD_L + ((i * 53 + (i % 9) * 7) % ROAD_W);
      const gy2 = TOP + ((i * 31) % (BOTTOM - TOP));
      scene.add.rectangle(gx2, gy2, 1, 1, i % 3 ? 0x3c3f46 : 0x1f2228).setOrigin(0, 0).setDepth(1).setAlpha(0.55);
    }
    scene.add.rectangle(ROAD_L - 3, TOP, 3, BOTTOM - TOP, PALETTE.bone).setOrigin(0, 0).setDepth(1);
    scene.add.rectangle(ROAD_L + ROAD_W, TOP, 3, BOTTOM - TOP, PALETTE.bone).setOrigin(0, 0).setDepth(1);
    for (let i = 1; i < 4; i++) {
      for (let y = TOP; y < BOTTOM + 16; y += 16) {
        dashes.push(scene.add.rectangle(ROAD_L + LANE_W * i, y, 1, 8, 0x6a6e76).setOrigin(0.5, 0).setDepth(2));
      }
    }
    // ---- WHAT GOES PAST.
    //
    // Everything below scrolls with the road on the same 178 pixel cycle the
    // lane dashes use, so each piece is one container and wraps whole rather
    // than coming apart a rectangle at a time.  Nothing reaches past x49 on
    // the left or x271 on the right: the verge is scenery and the road is the
    // game, and the two never share a pixel.
    const scenery = (x: number, y: number, parts: Phaser.GameObjects.GameObject[]): void => {
      dashes.push(scene.add.container(x, y, parts).setDepth(2));
    };
    const tree = (x: number, y: number, big: boolean): void => {
      const r = big ? 8 : 5;
      scenery(x, y, [
        scene.add.ellipse(1, r - 1, r * 2.2, 4, 0x0b1a10).setAlpha(0.5),
        scene.add.rectangle(0, r - 2, 2, 6, 0x3a2a18),
        scene.add.circle(0, 0, r, 0x24482c),
        scene.add.circle(-r * 0.4, -r * 0.4, r * 0.7, 0x2e5e38),
        scene.add.circle(r * 0.35, r * 0.15, r * 0.5, 0x1a3a22),
      ]);
    };
    const lamp = (x: number, y: number, right: boolean): void => {
      const arm = right ? -1 : 1;
      scenery(x, y, [
        scene.add.rectangle(0, 0, 2, 22, 0x4a4f58).setOrigin(0.5, 0),
        scene.add.rectangle(arm * 3, 0, 8, 2, 0x4a4f58),
        scene.add.rectangle(arm * 6, 2, 5, 3, 0xffd98a),
        scene.add.ellipse(arm * 9, 8, 22, 16, 0xffd98a).setAlpha(0.1),
      ]);
    };
    const shed = (x: number, y: number): void => {
      scenery(x, y, [
        scene.add.rectangle(0, 0, 16, 20, 0x3a3f4a).setOrigin(0.5, 0),
        scene.add.rectangle(0, 0, 16, 3, 0x596170).setOrigin(0.5, 0),
        scene.add.rectangle(0, 3, 16, 1, 0x232833).setOrigin(0.5, 0),
        ...[0, 1, 2].flatMap((r) =>
          [-4, 4].map((c) => scene.add.rectangle(c, 7 + r * 5, 4, 3, 0x1a1f28)),
        ),
        scene.add.rectangle(-4, 7, 4, 3, 0xffd98a).setAlpha(0.35),
        scene.add.rectangle(4, 17, 4, 3, 0xffd98a).setAlpha(0.25),
      ]);
    };
    // A hoarding with him on it, once a side, because it is his arcade the
    // road runs through and the verge is the only place left to say so.
    const hoarding = (x: number, y: number): void => {
      scenery(x, y, [
        scene.add.rectangle(-6, 6, 2, 10, 0x4a4f58),
        scene.add.rectangle(6, 6, 2, 10, 0x4a4f58),
        scene.add.rectangle(0, 0, 30, 16, 0x1d2430),
        scene.add.rectangle(0, 0, 27, 13, 0x2f7a46),
        scene.add.ellipse(0, 3, 15, 7, 0x7fc884),
        scene.add.ellipse(0, -2, 11, 6, 0x7fc884),
        scene.add.ellipse(-3, -3.5, 3.6, 3.2, PALETTE.cream),
        scene.add.ellipse(3, -3.5, 3.6, 3.2, PALETTE.cream),
        scene.add.rectangle(-3, -3.5, 1.4, 1.8, 0x121a14),
        scene.add.rectangle(3, -3.5, 1.4, 1.8, 0x121a14),
        scene.add.rectangle(0, 5.5, 17, 1, 0xffd45e).setAlpha(0.8),
      ]);
    };

    const CYCLE = BOTTOM - TOP + 16;
    for (let i = 0; i < 12; i++) {
      const right = i % 2 === 1;
      const x = right ? VERGE_R + 12 + ((i * 13) % 22) : ROAD_L - 15 - ((i * 13) % 22);
      tree(x, TOP + ((i * 61) % CYCLE), i % 3 === 0);
    }
    for (let i = 0; i < 6; i++) {
      const right = i % 2 === 1;
      lamp(right ? VERGE_R + 6 : ROAD_L - 9, TOP + ((i * 59 + 20) % CYCLE), right);
    }
    for (let i = 0; i < 4; i++) {
      shed(i % 2 ? GAME_W - 10 : 10, TOP + ((i * 83 + 40) % CYCLE));
    }
    hoarding(24, TOP + 30);
    hoarding(GAME_W - 24, TOP + 118);

    // ---- SOMETHING FOR THE READOUTS TO SIT ON.
    //
    // The verge used to be a flat green slab and the corner text sat on it
    // perfectly well.  Now there are trees and a lit hoarding going past
    // behind it, and CASH over a tree canopy is not a readout.  Three plates,
    // all of them inside the verge and none of them touching the road, at a
    // depth under the HUD and over the scenery.
    for (const [hx, hy, hw, hh] of [
      [0, TOP, 46, 13],
      [GAME_W - 46, TOP, 46, 13],
      [0, 136, 46, BOTTOM - 136],
    ] as const) {
      scene.add.rectangle(hx, hy, hw, hh, 0x0b0d12).setOrigin(0, 0).setDepth(8).setAlpha(0.72);
    }

    player = carSprite(scene, px, py, PALETTE.mossLight, false, true).setDepth(6).setVisible(true);

    hud = {
      cash: text(scene, 6, 21, '', PALETTE.cream),
      best: text(scene, GAME_W - 6, 21, '', PALETTE.gold).setOrigin(1, 0),
      time: centerText(scene, GAME_W / 2, 25, '', PALETTE.fog),
      bank: centerText(scene, GAME_W / 2, 170, '', PALETTE.gold).setVisible(false),
      bombLabel: text(scene, 4, 150, '', PALETTE.gold),
      damage: text(scene, 4, 140, '', PALETTE.amber),
      warn: centerText(scene, GAME_W / 2, 150, 'POLICE CLOSE', PALETTE.blood, 16).setVisible(false),
      // The quiet is the reward, so the quiet is on the HUD and counting down:
      // ten seconds you cannot see is ten seconds you cannot spend.
      clear: centerText(scene, GAME_W / 2, 30, '', PALETTE.tealLight, 16).setVisible(false),
    };
    hud.bombLabel.setDepth(9);
    hud.damage.setDepth(9);
    hud.warn.setDepth(9);
    hud.clear.setDepth(9);
    hud.cash.setDepth(9);
    hud.best.setDepth(9);
    hud.time.setDepth(9);
    hud.bank.setDepth(9);
    text(scene, 4, 160, 'SPACE', PALETTE.ash).setDepth(9);
    text(scene, 4, 168, 'BUYS', PALETTE.ash).setDepth(9);
    refreshHud();

    const kb = scene.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    keys = {
      left: bind(['A', 'LEFT']),
      right: bind(['D', 'RIGHT']),
      up: bind(['W', 'UP']),
      down: bind(['S', 'DOWN']),
    };
    kb?.on('keydown-SPACE', () => dropBomb());

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__chase = {
        state: () => ({
          cash: collected,
          peak,
          best,
          speed,
          bombCost: BOMB_COST,
          earned,
          reward: runReward(),
          drops: drops.length,
          jolted: joltMs > 0,
          spinning: spinMs > 0,
          spin: Math.max(0, Math.round(spinMs)),
          spinFor: OIL_SPIN_MS,
          potholeHits,
          potholeMax: POTHOLE_MAX,
          smoking: potholeHits >= SMOKE_FROM,
          smoke: smoke.length,
          broken: brokenMs > 0,
          stage: stage(),
          barriers: barriers.length,
          barrierLanes: barriers.map((b) => b.lane),
          peds: peds.length,
          pedXs: peds.map((p) => Math.round(p.x)),
          heat: chaseHeat(collected),
          policeCap: policeCap(),
          policeSpeed: speed + POLICE_GAIN + chaseHeat(collected) * HEAT_POLICE_GAIN + elapsed / POLICE_CLOCK,
          pickups: pickups.length,
          pickupKinds: pickups.map((j) => j.kind),
          pickupLanes: pickups.map((j) => laneOf(j.x)),
          // The real x, not the lane's: they are jittered across the lane, so
          // a harness that aims at the lane centre misses by more than the
          // car is wide.
          pickupXs: pickups.map((j) => j.x),
          traffic: traffic.length,
          respite: Math.max(0, Math.round(respiteMs)),
          police: police.length,
          chasing: police.filter((p) => p.stun <= 0).length,
          stunned: police.filter((p) => p.stun > 0).length,
          traps: traps.length,
          trapLanes: traps.map((t) => t.lanes.slice()),
          cars: police.map((p) => ({
            x: Math.round(p.x),
            y: Math.round(p.y),
            lane: laneOf(p.x),
            aim: laneOf(p.aim),
            stun: Math.round(p.stun),
          })),
          over,
          reason,
          player: { x: px, y: py },
        }),
        /** Put a chaser in a known lane, at a known distance behind you. */
        spawnPolice: (lane: number, y?: number) => {
          spawnPolice();
          const p = police[police.length - 1];
          if (!p) return;
          p.x = LANES[Phaser.Math.Clamp(lane | 0, 0, 3)];
          p.aim = p.x;
          p.y = y ?? py + 40;
          p.react = POLICE_REACT_MS;
        },
        /** Drop a traffic car in a lane, at a y of your choosing. */
        spawnTrafficAt: (lane: number, y: number) => {
          if (!scene0) return;
          const idx = Phaser.Math.Clamp(lane | 0, 0, 3);
          const x = LANES[idx];
          const body = carSprite(scene0, x, y, PALETTE.ember, false);
          traffic.push({
            id: nextCarId++,
            x,
            y,
            own: 40,
            cruise: 40,
            want: 40,
            body,
            lane: idx,
            from: x,
            signal: 0,
            signalMs: 0,
            blinks: 0,
            warn: 0,
            move: -1,
            think: THINK_MS,
            hunting: false,
            lamps: body.getData('lamps') as Phaser.GameObjects.Rectangle[],
          });
        },
        /** What the traffic is doing, so a harness can watch it indicate. */
        trafficState: () =>
          traffic.map((c) => ({
            id: c.id,
            x: c.x,
            y: Math.round(c.y),
            lane: c.lane,
            signal: c.signal,
            blinks: c.blinks,
            warn: Math.max(0, Math.round(c.warn)),
            changing: c.move >= 0,
            hunting: c.hunting,
            own: Math.round(c.own),
          })),
        spawnTrap: () => spawnTrap(),
        /** Put the strip clock on a hair trigger, without touching the guard. */
        armTrap: () => {
          trapTimer = 300;
        },
        dropPickup: (kind: PickupKind) => spawnPickup(kind),
        /** Sweep the road, so a test can aim at one hazard and only one. */
        clearRoad: () => {
          for (const c of traffic) c.body.destroy();
          for (const pc of police) pc.body.destroy();
          for (const t of traps) t.body.destroy();
          // EVERYTHING, not just the cars.  A test that aims at one pickup and
          // reads the first one in the list gets a stale one otherwise -- and
          // a bundle of cash landing in the same frame makes a fifty look like
          // a seventy.
          for (const j of pickups) j.body.destroy();
          for (const d of drops) d.body.destroy();
          for (const c of cash) c.body.destroy();
          for (const b of barriers) b.body.destroy();
          for (const ped of peds) ped.body.destroy();
          for (const puff of smoke) puff.body.destroy();
          traffic = [];
          police = [];
          traps = [];
          pickups = [];
          drops = [];
          cash = [];
          barriers = [];
          peds = [];
          smoke = [];
          joltMs = 0;
          spinMs = 0;
          // NOT the pothole count, and not the broken axle.  Those are the
          // CAR's state and this sweeps the ROAD -- wiping them here made
          // "clear the hazards so I can aim at one" quietly mean "and repair
          // the car", so damage could never be accumulated a hole at a time.
          // The run's own reset is in `create`, which is the only place a
          // fresh car comes from.
          policeTimer = 60_000;
          trafficTimer = 60_000;
          trapTimer = 60_000;
          cashTimer = 60_000;
          jarTimer = 60_000;
          barrierTimer = 60_000;
          pedTimer = 60_000;
        },
        /** Put the car back together, for a test that wants a fresh one. */
        repair: () => {
          potholeHits = 0;
          brokenMs = 0;
          for (const puff of smoke) puff.body.destroy();
          smoke = [];
          refreshHud();
        },
        /** Park the car somewhere exact, for aiming a test at a hazard. */
        setPlayer: (x: number, y: number) => {
          px = Phaser.Math.Clamp(x, ROAD_L + CAR_W / 2, ROAD_L + ROAD_W - CAR_W / 2);
          py = Phaser.Math.Clamp(y, 70, 160);
          player?.setPosition(px, py);
        },
        laneX: (lane: number) => LANES[Phaser.Math.Clamp(lane | 0, 0, 3)],
        laneOf: (x: number) => laneOf(x),
        setCash: (n: number) => {
          collected = n;
          peak = Math.max(peak, n);
          if (n >= BAR_CASH) earned = true;
          heatShown = chaseHeat(n);
          refreshHud();
        },
        /** Wind the road's own difficulty back, without touching the bag. */
        setPeak: (n: number) => {
          peak = n;
        },
        /** Empty the tank, for watching it fill itself back up. */
        /**
         * Make the car unhittable, so a test of the CHASE is not cut short by
         * a traffic car the harness was never steering around.
         */
        shield: (on: boolean) => {
          shielded = on;
        },
        /** Lay a barrier in a known lane, at a y of your choosing. */
        spawnBarrierAt: (lane: number, y: number) => {
          spawnBarrier([Phaser.Math.Clamp(lane | 0, 0, 3)], y);
        },
        /**
         * Lay one the way the GAME lays them -- lanes chosen by `layBarrier`,
         * not by the caller.  This is the one a fairness test has to drive:
         * the question is whether the road ever closes on the player, and
         * that is decided by the chooser, not by the spawner.
         */
        layBarrier: () => layBarrier(),
        /**
         * One pedestrian, spawned the way the GAME spawns them -- their own
         * heading, their own clock, their own mind.  `spawnPedAt` below freezes
         * that clock so a test can aim at one, which makes it exactly the wrong
         * thing to ask "do they change their mind?" with.
         */
        spawnPed: () => spawnPed(),
        /** Put somebody in the road at an exact spot, walking a known way. */
        spawnPedAt: (x: number, y: number, vx: number, vy: number) => {
          spawnPed();
          const ped = peds[peds.length - 1];
          if (!ped) return;
          ped.x = x;
          ped.y = y;
          ped.vx = vx;
          ped.vy = vy;
          ped.turn = 4000;
        },
        drop: () => dropBomb(),
        /**
         * End the run the only way it ends now: caught.  There is no pull-over
         * key any more, so a test that wants to see what a run PAID has to be
         * able to have the law take it.
         */
        bust: () => crash('BUSTED'),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__chase;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over || !player || !scene0) return;
    const dt = delta / 1000;
    elapsed += delta;

    // ---- the pothole you are still climbing out of.  Nothing here ends the
    // run; what it costs is the gap, and the gap is what the police are for.
    if (joltMs > 0) joltMs -= delta;
    const jolted = joltMs > 0;
    // ---- and the slick you are still going round on.  Three seconds, and the
    // car is barely yours for any of it.
    if (spinMs > 0) spinMs -= delta;
    const spinning = spinMs > 0;
    // ---- and the axle you broke on the third hole.  Nothing the player does
    // reaches the car from here: it coasts down and the run ends with it.
    if (brokenMs > 0) {
      brokenMs -= delta;
      if (brokenMs <= 0) {
        crash('BROKEN DOWN');
        return;
      }
    }
    const broken = brokenMs > 0;
    // What is left of the engine: full, or winding down to nothing over the
    // roll-out, so the car is seen to stop rather than being switched off.
    const engine = broken ? Math.max(0, brokenMs / BREAKDOWN_MS) : 1;
    const heat = chaseHeat(collected);
    peak = Math.max(peak, collected);
    if (collected >= BAR_CASH) earned = true;

    // ---- the road, and you on it.  It runs quicker the more you are carrying.
    speed = Math.min(SPEED_MAX + heat * HEAT_ROAD, SPEED_START + (elapsed / 1000) * SPEED_RAMP + heat * HEAT_ROAD);
    const ground = speed * (jolted ? POTHOLE_SPEED : 1) * engine;
    const dx = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    const dy = (held('down') ? 1 : 0) - (held('up') ? 1 : 0);
    // What is left of the steering.  A pothole takes half of it for under a
    // second; a slick takes four fifths of it for three.
    // A broken car does not steer at all; a spinning one barely does.
    const grip = broken ? 0 : spinning ? OIL_STEER : jolted ? POTHOLE_STEER : 1;
    // ---- AND THE SLICK DRIVES THE CAR FOR YOU while it lasts: a sideways
    // drift that swings one way and back rather than a constant shove, so the
    // car wanders across the road the way one that has let go actually does.
    const loose = spinning
      ? Math.sin((1 - spinMs / OIL_SPIN_MS) * Math.PI * 2 * OIL_SWINGS) * OIL_DRIFT * spinDir
      : 0;
    px = Phaser.Math.Clamp(
      px + (dx * STEER * grip + loose) * dt,
      ROAD_L + CAR_W / 2,
      ROAD_L + ROAD_W - CAR_W / 2,
    );
    py = Phaser.Math.Clamp(py + dy * CREEP * (spinning ? OIL_STEER : 1) * dt, 70, 160);
    player.setPosition(px, py);
    // leaning where you are steering, eased so it is a car and not a cursor --
    // or going round and round, which is what a car on oil does.
    if (spinning) player.setAngle(player.angle + spinDir * OIL_SPIN_RATE * dt);
    else player.setAngle(Phaser.Math.Linear(player.angle, dx * 7, Math.min(1, dt * 9)));
    // The damage, on screen, behind the car.
    stepSmoke(dt, delta, ground);
    for (const d of dashes) {
      d.y += ground * dt;
      if (d.y > BOTTOM) d.y -= BOTTOM - TOP + 16;
      d.setVisible(d.y >= TOP);
    }

    // ---- traffic: slower than you, so it comes down the screen at you
    trafficTimer -= delta;
    if (trafficTimer <= 0) {
      spawnTraffic();
      trafficTimer = Math.max(460, 1250 - elapsed / 120 - heat * 130);
    }
    for (const c of traffic) {
      // ---- the speed it wants.  Its own cruise, unless there is somebody
      // slower in front of it, in which case it backs off to their pace rather
      // than driving through them.
      const leader = carAhead(c);
      const gap = leader ? c.y - leader.y : Infinity;
      c.want = leader && gap < FOLLOW_GAP * 2 ? Math.min(c.cruise, leader.own - 3) : c.cruise;
      // and it gets there at a finite rate, so nothing on this road changes
      // speed instantly — and at a much finer one while it is crossing a line,
      // so a car that has announced a change does not also surprise you with
      // the speed it makes it at.
      const step = (c.move >= 0 ? LANE_CHANGE_ACCEL : CAR_ACCEL) * dt;
      c.own = Math.max(16, c.own + Phaser.Math.Clamp(c.want - c.own, -step, step));
      c.y += (ground - c.own) * dt;

      // ---- indicating, then moving.  Nothing moves sideways until the lamp
      // has been on for the full warning.
      c.think -= delta;
      if (c.think <= 0) {
        c.think = THINK_MS * (0.6 + Math.random() * 0.8);
        thinkCar(c);
      }
      if (c.signal !== 0) c.signalMs += delta;
      if (c.warn > 0) {
        // Counting the blinks off, not just running a clock down: the car is
        // released by the THIRD blink finishing, and `blinks` is what says so.
        c.warn -= delta;
        c.blinks = Math.min(SIGNAL_BLINKS, Math.floor(c.signalMs / BLINK_CYCLE_MS));
        if (c.warn <= 0) {
          c.blinks = SIGNAL_BLINKS;
          c.move = 0;
        }
      } else if (c.move >= 0) {
        c.move += delta / LANE_CHANGE_MS;
        if (c.move >= 1) {
          c.x = LANES[c.lane];
          c.move = -1;
          c.signal = 0;
          c.signalMs = 0;
          c.blinks = 0;
          c.hunting = false;
        } else {
          // Eased both ends: a car leans out of its lane and settles into the
          // next one, it does not translate between them.
          const k = c.move * c.move * (3 - 2 * c.move);
          c.x = c.from + (LANES[c.lane] - c.from) * k;
        }
      }
      // The lamps themselves, on this car's own clock — a blink counted off a
      // shared `elapsed` would be a different fraction of a blink for every
      // car, and "exactly three" would mean nothing.
      const blink = c.signal !== 0 && c.signalMs % BLINK_CYCLE_MS < BLINK_ON_MS;
      c.lamps[0]?.setVisible(blink && c.signal < 0);
      c.lamps[1]?.setVisible(blink && c.signal > 0);

      // and it leans out of the lane and settles back, rather than sliding
      // across perfectly square to the road
      c.body.setAngle(c.move >= 0 ? c.signal * 7 * Math.sin(Math.PI * c.move) : 0);
      c.body.setPosition(c.x, c.y).setVisible(onScreen(c.y));
    }
    traffic = traffic.filter((c) => keep(c, c.y < BOTTOM + CAR_H && c.y > TOP - CAR_H * 3));

    // ---- police: faster than you, so they come UP the screen, and steer at you
    if (respiteMs > 0) {
      respiteMs -= delta;
      // The clock does not start until the quiet is over, and it starts from a
      // FULL interval — so the road cannot produce two cars the moment it does.
      policeTimer = Math.max(policeTimer, RESPITE_TAIL_MS);
    } else {
      policeTimer -= delta;
      if (policeTimer <= 0 && police.length < policeCap()) {
        spawnPolice();
        policeTimer = Math.max(1500, 3000 - heat * 500);
      }
    }
    for (const p of police) {
      const siren = (p.body.getData('siren') ?? []) as Phaser.GameObjects.Rectangle[];
      if (p.stun > 0) {
        // Spun out: siren dead, no steering, crawling, and falling back down
        // the road.  It is still a lump of metal in a lane, so it can still be
        // hit — it just is not chasing anybody.
        p.stun -= delta;
        p.own = POLICE_STUN_SPEED;
        p.y += (ground - p.own) * dt;
        p.body.setPosition(p.x, p.y).setVisible(onScreen(p.y));
        p.body.setAngle(p.body.angle + delta * 0.3);
        for (const lamp of siren) lamp.setFillStyle(PALETTE.steel);
        if (p.stun <= 0) {
          // Back on its wheels, and it has to earn the distance again.
          p.body.setAngle(0);
          p.aim = px;
          p.react = reactMs(heat);
        }
        continue;
      }
      // It only looks every so often.  Between looks it drives at the lane it
      // last saw you in, which is the whole of how a juke works.
      p.react -= delta;
      if (p.react <= 0) {
        p.aim = px;
        p.react = reactMs(heat);
      }
      p.own = speed + POLICE_GAIN + heat * HEAT_POLICE_GAIN + elapsed / POLICE_CLOCK;
      p.y += (ground - p.own) * dt;
      // Full lock until the last few pixels and then it settles, instead of
      // driving flat out at the line and stopping dead on it.  Past twelve
      // pixels this is exactly the old constant rate, so a late swerve still
      // leaves a chaser committed to the lane it last saw you in.
      const lock = Phaser.Math.Clamp((p.aim - p.x) * 4, -POLICE_STEER, POLICE_STEER);
      if (Math.abs(p.aim - p.x) > 0.5) p.x += lock * dt;
      p.body.setAngle((lock / POLICE_STEER) * 6);
      p.body.setPosition(p.x, p.y).setVisible(onScreen(p.y));
      // The bar alternates rather than blinking on and off: red one beat,
      // blue the next, which is what a police car in the mirror looks like.
      const on = Math.floor(elapsed / 120) % 2 === 0;
      siren[0]?.setFillStyle(on ? PALETTE.blood : tone(PALETTE.blood, 0.35));
      siren[1]?.setFillStyle(on ? tone(PALETTE.tealLight, 0.35) : PALETTE.tealLight);
    }

    // ---- and what happens when a chaser drives into the traffic it was not
    // looking at.  This is the reason to lead them: a car locked onto the lane
    // you just left goes into the back of whatever is in it.
    for (const p of police) {
      if (p.stun > 0) continue;
      const into = traffic.find((c) => Math.abs(p.x - c.x) < CAR_W - 3 && Math.abs(p.y - c.y) < CAR_H - 4);
      if (into) {
        spinOut(p);
        wreck(into);
        // Putting one into the traffic clears the road the same way a bomb
        // does.  Leading them is meant to be worth more than outrunning
        // them, and this is what makes it worth more.
        startRespite();
      }
    }
    traffic = traffic.filter((c) => c.body.active);
    // Shaken, they fall off the bottom and come back later.
    police = police.filter((p) => keep(p, p.y < BOTTOM + CAR_H * 2 && p.y > TOP - CAR_H * 2));

    // ---- cash on the road
    cashTimer -= delta;
    if (cashTimer <= 0) {
      spawnCash();
      cashTimer = 900 + Math.random() * 900;
    }
    for (const c of cash) {
      c.y += ground * dt;
      c.body.setPosition(c.x, c.y).setVisible(c.y > TOP + 4);
    }
    // ---- WHAT IS LYING ON THE ROAD.  One clock for both, and neither of them
    // is worth having: a pothole often enough that the road is never a clear
    // run, and — once the run is worth something — oil, which is the one that
    // takes the car off you.
    jarTimer -= delta;
    if (jarTimer <= 0) {
      // Potholes from the gun; oil once the run is worth something, and then
      // an increasing share of what goes down is oil rather than holes.
      const oiled = peak >= OIL_CASH;
      spawnPickup(oiled && Math.random() < 0.42 ? 'oil' : 'pothole');
      // And they come thicker as the road gets worse: a gap that starts at a
      // second and a half and closes toward half of that.
      jarTimer = Math.max(700, 1500 - stage() * 260) + Math.random() * Math.max(600, 1600 - stage() * 300);
    }
    for (const j of pickups) {
      j.y += ground * dt;
      j.body.setPosition(j.x, j.y).setVisible(j.y > TOP + 6);
    }
    pickups = pickups.filter((j) => {
      const touched = Math.abs(j.x - px) < CAR_W / 2 + 4 && Math.abs(j.y - py) < CAR_H / 2 + 5;
      if (touched) {
        if (j.kind === 'oil') {
          // THE SLICK.  The car lets go: a second and a half of it going round
          // on its own with a fifth of the steering left, and everything that
          // was behind you arriving while it happens.
          //
          // A SECOND SLICK STARTS A WHOLE FRESH SPIN rather than topping up
          // what is left of the first.  The clock is set, not added to, and
          // the direction is re-rolled with it -- two slicks in a row is two
          // spins, and the one you are in now is always a full one.
          spinMs = OIL_SPIN_MS;
          spinDir = Math.random() < 0.5 ? -1 : 1;
          audio.sfx('splash', 0.7);
          scene0?.cameras.main.shake(420, 0.014);
        } else {
          // THE POTHOLE.  You are in it, and out of it in under a second --
          // with most of your speed gone and whatever was behind you a lot
          // closer than it was.  And the car remembers it: see POTHOLE_MAX.
          joltMs = POTHOLE_JOLT_MS;
          potholeHits++;
          audio.sfx('item_thud', 0.8);
          if (potholeHits >= POTHOLE_MAX) {
            breakDown();
          } else {
            scene0?.cameras.main.shake(260, 0.012);
            // The one that starts the smoke is worth saying out loud -- the
            // smoke itself is behind the car, where the driver cannot see it.
            if (potholeHits === SMOKE_FROM) warn('SOMETHING IS SMOKING');
          }
        }
        refreshHud();
        j.body.destroy();
        return false;
      }
      if (j.y > BOTTOM + 10) {
        j.body.destroy();
        return false;
      }
      return true;
    });

    // ---- SKINS ALREADY DOWN.  You put one where you were and it stays there,
    // scrolling away with the road.  A chaser that drives over one goes round
    // exactly the way it would off a spike strip, and the road behind you
    // clears with it.
    drops = drops.filter((d) => {
      d.y += ground * dt;
      d.life -= delta;
      d.body.setPosition(d.x, d.y).setVisible(d.y > TOP + 4);
      const hit = police.find(
        (pc) => pc.stun <= 0 && Math.abs(pc.x - d.x) < CAR_W / 2 + 3 && Math.abs(pc.y - d.y) < CAR_H / 2 + 3,
      );
      if (hit) {
        spinOut(hit);
        startRespite();
        audio.sfx('splash', 0.5);
        d.body.destroy();
        return false;
      }
      if (d.life <= 0 || d.y > BOTTOM + 10) {
        d.body.destroy();
        return false;
      }
      return true;
    });

    // ---- CONCRETE, once the run has been worth something for a while.  It is
    // laid on its own clock and the clock tightens with the stage.
    if (stage() >= 2) {
      barrierTimer -= delta;
      if (barrierTimer <= 0) {
        layBarrier();
        barrierTimer = Math.max(BARRIER_GAP_MIN, BARRIER_GAP_MS - (peak - BARRIER_CASH) * 3) + Math.random() * 1400;
      }
    }
    for (const b of barriers) {
      b.y += ground * dt;
      b.body.setPosition(b.x, b.y).setVisible(b.y > TOP + 2);
    }
    barriers = barriers.filter((b) => {
      if (b.y > BOTTOM + BARRIER_H) {
        b.body.destroy();
        return false;
      }
      return true;
    });
    // Concrete does not care whose car it is.  A chaser locked onto a lane you
    // just left drives into it exactly the way you would have.
    for (const b of barriers) {
      for (const p of police) {
        if (p.stun <= 0 && Math.abs(b.x - p.x) < (LANE_W - 8 + CAR_W) / 2 - 3 && Math.abs(b.y - p.y) < (BARRIER_H + CAR_H) / 2 - 4) {
          spinOut(p);
        }
      }
      if (Math.abs(b.x - px) < (LANE_W - 8 + CAR_W) / 2 - 3 && Math.abs(b.y - py) < (BARRIER_H + CAR_H) / 2 - 4) {
        crash('CONCRETE');
        return;
      }
    }

    // ---- PEOPLE IN THE ROAD, last of the four and the only one that moves of
    // its own accord.  They walk, they change their mind, and they do not look.
    if (stage() >= 3) {
      pedTimer -= delta;
      if (pedTimer <= 0) {
        spawnPed();
        pedTimer = Math.max(PED_GAP_MIN, PED_GAP_MS - (peak - PED_CASH) * 3) + Math.random() * 2000;
      }
    }
    for (const ped of peds) {
      ped.turn -= delta;
      if (ped.turn <= 0) {
        ped.turn = PED_TURN_MS * (0.6 + Math.random() * 1.1);
        // Thinks again: carry on, turn round, or set off down the road
        // instead.  Never stops dead -- somebody stood still is a bollard.
        const r = Math.random();
        if (r < 0.3) {
          ped.vx = -ped.vx || (Math.random() < 0.5 ? -PED_CROSS : PED_CROSS);
        } else if (r < 0.5) {
          ped.vx = ped.vx === 0 ? (Math.random() < 0.5 ? -PED_CROSS : PED_CROSS) : 0;
          ped.vy = ped.vx === 0 ? PED_ALONG : 0;
        }
      }
      ped.x += ped.vx * dt;
      // They drift down the screen with the road as well as walking on it:
      // standing still on a road moving under you is still moving.
      ped.y += (ground * 0.82 + ped.vy) * dt;
      // Turned round by the verge rather than walking off it.
      if (ped.x < ROAD_L + 2) {
        ped.x = ROAD_L + 2;
        ped.vx = Math.abs(ped.vx) || PED_CROSS;
      }
      if (ped.x > ROAD_L + ROAD_W - 2) {
        ped.x = ROAD_L + ROAD_W - 2;
        ped.vx = -Math.abs(ped.vx) || -PED_CROSS;
      }
      ped.body.setPosition(ped.x, ped.y).setVisible(ped.y > TOP + 2);
      // the cane sweeping side to side in front of them
      ped.cane.setAngle(Math.sin(elapsed / 170) * 38);
    }
    peds = peds.filter((ped) => {
      if (ped.y > BOTTOM + PED_H) {
        ped.body.destroy();
        return false;
      }
      return true;
    });
    for (const ped of peds) {
      if (Math.abs(ped.x - px) < (PED_W + CAR_W) / 2 - 2 && Math.abs(ped.y - py) < (PED_H + CAR_H) / 2 - 2) {
        crash('YOU HIT SOMEBODY');
        return;
      }
    }

    // ---- spike strips, once the bag is big enough to be worth stopping
    if (collected >= TRAP_CASH) {
      trapTimer -= delta;
      if (trapTimer <= 0) {
        spawnTrap();
        // They come quicker the longer you stay out with a full bag.
        trapTimer = Math.max(4200, TRAP_GAP_MS - (collected - TRAP_CASH) * 4) + Math.random() * 1200;
      }
    }
    for (const t of traps) {
      t.y += ground * dt;
      t.body.setPosition(0, t.y).setVisible(t.y > TOP + 2);
    }
    traps = traps.filter((t) => {
      if (t.y > BOTTOM + 6) {
        t.body.destroy();
        return false;
      }
      return true;
    });
    // A strip does not care whose tyres they are.  A chaser that drives over
    // one goes out exactly the way you would have.
    for (const t of traps) {
      for (const p of police) {
        if (p.stun <= 0 && Math.abs(t.y - p.y) < CAR_H / 2 + 2 && spiked(t, p.x)) spinOut(p);
      }
      if (Math.abs(t.y - py) < CAR_H / 2 + 2 && spiked(t, px)) {
        crash('SPIKED');
        return;
      }
    }

    cash = cash.filter((c) => {
      if (Math.abs(c.x - px) < CAR_W / 2 + 4 && Math.abs(c.y - py) < CAR_H / 2 + 4) {
        collected += CASH_PER_PICKUP;
        audio.sfx('coin_spin', 0.7);
        if (collected > best) {
          best = collected;
          store.setHighScore(ID, best);
        }
        // Crossing two hundred, and every two hundred after it, is said out
        // loud: a chase that quietly got harder reads as the game cheating.
        announceHeat();
        refreshHud();
        c.body.destroy();
        return false;
      }
      if (c.y > BOTTOM + 8) {
        c.body.destroy();
        return false;
      }
      return true;
    });

    // ---- what ends it
    for (const c of traffic) {
      if (hits(c)) {
        crash('CRASHED');
        return;
      }
    }
    for (const p of police) {
      if (hits(p)) {
        // A spun-out car is wreckage in a lane, not an arrest.
        crash(p.stun > 0 ? 'CRASHED' : 'BUSTED');
        return;
      }
    }

    hud?.time.setText(heat > 0 ? `${Math.floor(elapsed / 1000)}s   HEAT ${heat}` : `${Math.floor(elapsed / 1000)}s`);
    hud?.time.setTint(heat > 0 ? PALETTE.blood : PALETTE.fog);

    // ---- the quiet, counted down where the player can spend it
    if (respiteMs > 0) {
      hud?.clear.setText(`ROAD CLEAR  ${Math.ceil(respiteMs / 1000)}`).setVisible(true);
      hud?.clear.setTint(respiteMs < 2600 ? PALETTE.amber : PALETTE.tealLight);
    } else {
      hud?.clear.setVisible(false);
    }

    // ---- the warning: a police car right behind you, flashing and beeping
    const close = police.some(
      (p) => p.stun <= 0 && p.y > py && p.y - py < WARN_DIST && Math.abs(p.x - px) < LANE_W * 1.5,
    );
    if (close) {
      warnT += delta;
      hud?.warn.setVisible(Math.floor(warnT / 160) % 2 === 0);
      if (warnT % 700 < delta) audio.sfx('buzzer', 0.25);
    } else {
      warnT = 0;
      hud?.warn.setVisible(false);
    }
  },

  destroy() {
    traffic = [];
    police = [];
    traps = [];
    cash = [];
    pickups = [];
    drops = [];
    barriers = [];
    peds = [];
    smoke = [];
    dashes = [];
    player = null;
    hud = null;
    apiRef = null;
    scene0 = null;
  },
};

const held = (g: string): boolean => keys[g]?.some((k) => k.isDown) ?? false;

/** Fully below the title bar.  Things above it are there, just not drawn yet. */
const onScreen = (y: number): boolean => y - CAR_H / 2 >= TOP;

/** Which lane an x is in.  Lane 0 is the left-hand one. */
function laneOf(x: number): number {
  return Phaser.Math.Clamp(Math.floor((x - ROAD_L) / LANE_W), 0, 3);
}

/**
 * How many are on you at once: ONE until the first two hundred, TWO from two
 * hundred, and one more for every further two hundred in the bag, up to EIGHT.
 * It is a pure function of the cash — the clock has no say — so the chase is
 * exactly as heavy as what you are carrying, and the player can read their own
 * bag and know what is behind them.
 *
 * Which also means spending it lightens the chase.  A bomb costs thirty, and
 * thirty across a notch takes a car off your tail as well as spinning one out:
 * that is deliberate, it is the only thing in the game that can make the
 * pursuit smaller, and it costs exactly what it looks like it costs.  The
 * ROAD is not on this clock — see `stage()` — so nobody spends their way back
 * to an emptier one.
 */
export function policeFor(cash: number): number {
  return Math.min(POLICE_MAX, 1 + Math.floor(cash / TARGET_CASH));
}

function policeCap(): number {
  return policeFor(collected);
}

/**
 * HOW FAR INTO THE RUN THE ROAD IS, 0 to 3.
 *
 * One number that every new hazard reads, so "it gets worse gradually" is a
 * single curve rather than four unrelated ones that happen to point the same
 * way.  Each step is a thing that was not out there before:
 *
 *   0  traffic, cash, potholes
 *   1  oil, at a hundred and fifty
 *   2  concrete, at three hundred and fifty
 *   3  people in the road, at five hundred
 *
 * and each step also tightens the clocks on everything already out there.  It
 * reads `peak` rather than `collected`: see the note on `peak`.
 */
function stage(): number {
  if (peak >= PED_CASH) return 3;
  if (peak >= BARRIER_CASH) return 2;
  if (peak >= OIL_CASH) return 1;
  return 0;
}

/** How long a chaser goes between looks.  Sharper with every notch of heat. */
function reactMs(heat: number): number {
  return Math.max(POLICE_REACT_FLOOR, POLICE_REACT_MS - heat * 80);
}

/**
 * Spin one out.  It keeps its place on the road — a wreck does not teleport —
 * but it stops steering, stops gaining and stops being a chaser for a while.
 */
function spinOut(p: Police): void {
  if (p.stun > 0) return;
  p.stun = POLICE_STUN_MS;
  p.own = POLICE_STUN_SPEED;
  audio.sfx('whack', 0.5);
  scene0?.cameras.main.shake(140, 0.006);
}

/**
 * Clear the road and keep it clear for ten seconds.
 *
 * Every car on you drops out at once, whatever it was doing: it spins, falls
 * back down the road under its own dead weight and is off the bottom of the
 * screen within a second or two, which is the same exit a bomb always
 * gave them.  They are left in the list to drive away rather than deleted, so
 * the exit is something the player watches happen instead of a row of cars
 * blinking out.
 *
 * Extending is not stacking: a second trigger inside the quiet sets the clock
 * back to ten, it does not add ten to what is left.
 */
function startRespite(): void {
  respiteMs = RESPITE_MS;
  for (const p of police) {
    if (p.stun <= 0) spinOut(p);
    // Long enough that it is off the road before it could ever right itself.
    p.stun = Math.max(p.stun, RESPITE_MS);
  }
}

/** The traffic car that took the hit.  It is gone; the road is that much clearer. */
function wreck(c: Mover): void {
  if (!scene0) return;
  const puff = scene0.add.circle(c.x, c.y, 7, PALETTE.bone, 0.8).setDepth(7);
  scene0.tweens.add({ targets: puff, radius: 14, alpha: 0, duration: 420, onComplete: () => puff.destroy() });
  c.body.destroy();
}

/** Does a strip cover this x?  Measured against the car's body, not its centre. */
function spiked(t: Trap, x: number): boolean {
  const half = (CAR_W - 4) / 2;
  return t.lanes.some((on, i) => {
    if (!on) return false;
    const left = ROAD_L + i * LANE_W;
    return x + half > left && x - half < left + LANE_W;
  });
}

/** They have called it in.  Said once per notch, and never quietly. */
function heatUp(notch: number): void {
  if (!scene0) return;
  audio.sfx('buzzer', 0.5);
  scene0.cameras.main.shake(180, 0.006);
  const line = notch >= HEAT_MAX ? 'ROADBLOCK - EVERY CAR THEY HAVE' : 'THEY CALL FOR BACKUP';
  const t = centerText(scene0, GAME_W / 2, 96, line, PALETTE.blood).setDepth(50);
  scene0.tweens.add({ targets: t, y: 86, alpha: 0, duration: 1600, onComplete: () => t.destroy() });
}

function keep(m: Mover, ok: boolean): boolean {
  if (!ok) m.body.destroy();
  return ok;
}

/**
 * Contact.  Deliberately smaller than the paint: a car is 12x20 and this is
 * 8x14 between centres, so a gap you can see is a gap you get through.  The
 * old box clipped on misses that looked clean, which reads as the game
 * cheating rather than as your mistake.
 */
function hits(m: Mover): boolean {
  return Math.abs(m.x - px) < CAR_W - 4 && Math.abs(m.y - py) < CAR_H - 6;
}

/** Darken a packed colour, for the panels and shadows on a car's own paint. */
function tone(colour: number, k: number): number {
  const c = Phaser.Display.Color.IntegerToColor(colour);
  const m = (v: number) => Phaser.Math.Clamp(Math.round(v * k), 0, 255);
  return (m(c.red) << 16) | (m(c.green) << 8) | m(c.blue);
}

/**
 * A car, twelve by twenty, facing up the road.
 *
 * Everything on it is built out of the same handful of rectangles, and the
 * SHAPE is the bit that matters at this size: a 12x16 hull with a narrower
 * nose and tail stuck on the ends reads as rounded without a single curve,
 * which is what the flat 12x20 slab it replaced never did.  Wheels go on
 * first so the hull covers all but the lug that pokes out of each arch, and
 * the cabin is the body's own colour taken down a third rather than a new
 * one — so a car is one object with panels, not three stacked boxes.
 *
 * THE THREE KINDS ARE TOLD APART BY SHAPE AND NOT BY COLOUR ALONE:
 *   the player has a frog sat in it, eyes over the roof line;
 *   the police have a light bar and black doors;
 *   the traffic has indicators and nothing else.
 *
 * `CAR_W`/`CAR_H` and the contact box in `hits` are untouched: this is paint.
 */
function carSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  colour: number,
  cop: boolean,
  hero = false,
): Phaser.GameObjects.Container {
  const dark = tone(colour, 0.66);
  const lit = tone(colour, 1.12);
  const parts: Phaser.GameObjects.GameObject[] = [];

  // ---- WHEELS, under everything: only the lug outside the arch shows.
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      parts.push(scene.add.rectangle(sx * 6, sy * 5, 2, 4, PALETTE.black));
    }
  }

  // ---- THE HULL: a 12x16 middle with a narrower nose and a tail on the ends.
  parts.push(scene.add.rectangle(0, 0, CAR_W, CAR_H - 4, colour));
  parts.push(scene.add.rectangle(0, -9, 10, 2, colour));
  parts.push(scene.add.rectangle(0, 9, 10, 2, colour));
  // A line of shadow down each flank, so it has a side as well as a top.
  for (const sx of [-1, 1]) parts.push(scene.add.rectangle(sx * 5.5, 0, 1, 14, dark));
  // Bonnet in front of the glass, roof behind it.
  parts.push(scene.add.rectangle(0, -6.5, 8, 3, lit));
  parts.push(scene.add.rectangle(0, 4.5, 8, 5, tone(colour, 0.82)));

  // ---- GLASS.  The screen up front, a smaller one at the back.
  parts.push(scene.add.rectangle(0, -2, 8, 6, PALETTE.ink));
  parts.push(scene.add.rectangle(0, 4, 5, 2, PALETTE.ink).setAlpha(0.75));

  // ---- LIGHTS.  Headlights lead, tail lights follow, both inside the panel
  // they are set into rather than hung off the end of it.
  for (const sx of [-1, 1]) {
    parts.push(scene.add.rectangle(sx * 2.5, -9.5, 3, 1, PALETTE.cream));
    parts.push(scene.add.rectangle(sx * 2.5, 9.5, 3, 1, PALETTE.blood));
  }

  const lamps: Phaser.GameObjects.Rectangle[] = [];
  const siren: Phaser.GameObjects.Rectangle[] = [];

  if (cop) {
    // ---- POLICE: black doors down the flanks and a bar across the roof.
    for (const sx of [-1, 1]) parts.push(scene.add.rectangle(sx * 4.5, 3.5, 2, 7, PALETTE.ink));
    parts.push(scene.add.rectangle(0, 2, 8, 2.5, PALETTE.black));
    for (const [sx, hue] of [[-1, PALETTE.blood], [1, PALETTE.tealLight]] as const) {
      const lamp = scene.add.rectangle(sx * 2, 2, 3, 1.5, hue);
      siren.push(lamp);
      parts.push(lamp);
    }
  } else if (hero) {
    // ---- THE FROGGY CAR.  There is a frog driving it and you can see him
    // through the screen: a pale head filling the cabin and two eyes up at
    // the top of it.  Nothing else on this road has a face, so the player
    // never loses their own car in traffic.
    parts.push(scene.add.ellipse(0, -1, 9, 8, lit));
    for (const sx of [-1, 1]) {
      parts.push(scene.add.circle(sx * 2.5, -3, 1.8, PALETTE.cream));
      parts.push(scene.add.circle(sx * 2.5, -3, 0.9, PALETTE.black));
    }
    // A wide frog mouth, closed, somewhere between pleased and concentrating.
    parts.push(scene.add.rectangle(0, 1, 5, 1, tone(colour, 0.45)));
  } else {
    // ---- TRAFFIC: a glint on the screen, and indicators at the back corners
    // where the player -- who is behind every one of these cars -- can see
    // them.
    parts.push(scene.add.rectangle(-2, -4, 3, 1, PALETTE.fog).setAlpha(0.55));
    for (const sx of [-1, 1]) {
      // ---- A SIGNAL HAS TO BE VISIBLE ON EVERY CAR IT IS FITTED TO.
      //
      // The lamp was PALETTE.amber and amber was one of the five paints a
      // traffic car could be sprayed, so one car in five announced its lane
      // change with a light exactly the colour of the panel it was mounted
      // on.  The warning was there and could not be seen, which is worse than
      // no warning at all because the player learns to trust it.
      //
      // It is a signal orange nothing else on the road uses, and it sits on a
      // dark housing, so it reads against any paint the spawner picks.
      parts.push(scene.add.rectangle(sx * (CAR_W / 2 - 1), CAR_H / 2 - 3, 4, 6, 0x1a1208).setVisible(true).setAlpha(0.85));
      const lamp = scene.add.rectangle(sx * (CAR_W / 2 - 1), CAR_H / 2 - 3, 2.6, 4.4, SIGNAL_ON).setVisible(false);
      lamps.push(lamp);
      parts.push(lamp);
    }
  }

  const c = scene.add.container(x, y, parts).setDepth(4).setVisible(false);
  c.setData('lamps', lamps);
  c.setData('siren', siren);
  return c;
}

/**
 * Is a lane clear around this point on the road?  Used both for spawning and
 * for deciding a lane change is survivable for the car making it.
 */
function laneClear(lane: number, y: number, span: number, except?: Car): boolean {
  return !traffic.some((c) => c !== except && (c.lane === lane || laneOf(c.x) === lane) && Math.abs(c.y - y) < span);
}

/** The same question for the player: somewhere left to go once a car moves. */
function playerHasAnOut(blocked: number): boolean {
  const here = laneOf(px);
  return [0, 1, 2, 3].some(
    (i) => i !== blocked && Math.abs(i - here) <= 1 && laneClear(i, py, CAR_H + 8),
  );
}

/**
 * One car's mind, ticked once a think.  It decides one thing: which lane it
 * wants.  Everything else — indicating, moving, easing — falls out of that.
 *
 * It will move onto the player's line, and that is the point: it is what makes
 * standing still stop working.  But only one car at a time may do it, it only
 * does it from in front of the player where the change is visible, and it will
 * not do it if the player would have nowhere to go afterwards.
 */
function thinkCar(c: Car): void {
  if (c.move >= 0 || c.warn > 0) return;
  const changing = traffic.filter((o) => o.move >= 0 || o.warn > 0).length;
  if (changing >= CHANGERS) return;

  const options = [c.lane - 1, c.lane + 1].filter(
    (i) => i >= 0 && i <= 3 && laneClear(i, c.y, CAR_H * 2.2, c),
  );
  if (!options.length) return;

  let want = -1;
  // ---- hunting: sweep across the line the player is sitting on.
  const hunters = traffic.filter((o) => o.hunting && (o.move >= 0 || o.warn > 0)).length;
  const ahead = c.y < py - CAR_H && py - c.y < 150;
  const off = px - c.x;
  if (hunters < HUNTERS && ahead && elapsed > 6000 && Math.abs(off) > 3) {
    const toward = c.lane + Math.sign(off);
    if (options.includes(toward) && playerHasAnOut(toward)) want = toward;
  }
  // ---- or simply getting past somebody slower, which is what real traffic
  // spends its time doing and what keeps the road alive when nobody is parked.
  if (want < 0) {
    const leader = carAhead(c);
    const stuck = leader && c.y - leader.y < FOLLOW_GAP * 1.6 && leader.cruise < c.cruise - 3;
    if ((stuck || Math.random() < 0.18) && options.length) {
      want = options[Phaser.Math.Between(0, options.length - 1)];
    }
  }
  if (want < 0 || want === c.lane) return;

  c.signal = want < c.lane ? -1 : 1;
  c.signalMs = 0;
  c.blinks = 0;
  c.hunting = Math.abs(px - LANES[want]) < LANE_W;
  c.warn = LANE_WARN_MS;
  c.from = c.x;
  c.lane = want;
}

/** The car this one is following: same lane, further up the road, nearest. */
function carAhead(c: Car): Car | null {
  let best: Car | null = null;
  for (const o of traffic) {
    if (o === c || o.lane !== c.lane || o.y >= c.y) continue;
    if (!best || o.y > best.y) best = o;
  }
  return best;
}

function spawnTraffic(): void {
  if (!scene0) return;
  let idx = Phaser.Math.Between(0, 3);
  // The first ten seconds never drop one straight down your lane: you get to
  // see how the road works before it is aimed at you.
  if (elapsed < 10000 && Math.abs(LANES[idx] - px) < LANE_W / 2) idx = (idx + 1) % 4;
  // Not into the back of one already there.
  if (!laneClear(idx, TOP - CAR_H, CAR_H * 2)) return;
  const lane = LANES[idx];
  const own = TRAFFIC_MIN + Math.random() * TRAFFIC_SPAN;
  // Amber is gone from the paints: it is the indicator's colour, and a car
  // the same colour as its own indicator cannot announce anything.
  const colours = [PALETTE.ember, PALETTE.neon, PALETTE.violet, PALETTE.bone, PALETTE.tealLight];
  const body = carSprite(scene0, lane, TOP - CAR_H, colours[Phaser.Math.Between(0, colours.length - 1)], false);
  traffic.push({
    id: nextCarId++,
    x: lane,
    y: TOP - CAR_H,
    own,
    cruise: own,
    want: own,
    body,
    lane: idx,
    from: lane,
    signal: 0,
    signalMs: 0,
    blinks: 0,
    warn: 0,
    move: -1,
    think: THINK_MS * (0.5 + Math.random()),
    hunting: false,
    lamps: body.getData('lamps') as Phaser.GameObjects.Rectangle[],
  });
}

function spawnPolice(): void {
  if (!scene0) return;
  const lane = LANES[Phaser.Math.Between(0, 3)];
  const body = carSprite(scene0, lane, BOTTOM + CAR_H, PALETTE.bone, true);
  // It comes on aimed at the lane it can see you in, and looks again on its
  // own clock from there.
  police.push({
    x: lane,
    y: BOTTOM + CAR_H,
    own: speed + POLICE_GAIN,
    body,
    aim: px,
    react: POLICE_REACT_MS,
    stun: 0,
  });
  audio.sfx('buzzer', 0.35);
}

/**
 * A spike strip across the road, with a gap.  Two lanes at first and three
 * once the bag is twice the trap threshold; the gap is never where the player
 * already is, because a strip you are standing in is not a hazard, it is a
 * verdict.
 */
function spawnTrap(): void {
  if (!scene0) return;
  // The other half of the pact in `layBarrier`: a strip laid onto concrete
  // that is already coming down closes the road just as completely.
  if (barriers.some((b) => b.y < BOTTOM * 0.6)) return;
  const width = collected >= TRAP_CASH * 2 ? 3 : 2;
  const here = laneOf(px);
  // Pick the gap first: a lane you can actually get to from where you are.
  const gapChoices = [0, 1, 2, 3].filter((i) => Math.abs(i - here) <= 2);
  const gap = gapChoices[Phaser.Math.Between(0, gapChoices.length - 1)];
  const lanes = [0, 1, 2, 3].map((i) => i !== gap);
  // With only three spikes on a four-lane road, open a second lane as well —
  // whichever is furthest from the gap, so the strip still reads as a wall.
  if (width === 2) {
    const spare = [0, 1, 2, 3]
      .filter((i) => i !== gap)
      .sort((a, b) => Math.abs(b - gap) - Math.abs(a - gap))[0];
    lanes[spare] = false;
  }

  const parts: Phaser.GameObjects.GameObject[] = [];
  lanes.forEach((on, i) => {
    if (!on) return;
    const left = ROAD_L + i * LANE_W;
    parts.push(scene0!.add.rectangle(left + 1, -3, LANE_W - 2, 6, 0x2b2118).setOrigin(0, 0));
    // Enough spikes to span the lane whatever the lane is worth: a strip with
    // a visible hole in it reads as a gap, and the gap is supposed to be the
    // lane that has no strip on it at all.
    const spikes = Math.max(5, Math.round((LANE_W - 6) / 6));
    for (let t = 0; t < spikes; t++) {
      parts.push(
        scene0!.add.triangle(left + 3 + (t * (LANE_W - 6)) / spikes, -3, 0, 5, 2.5, 0, 5, 5, PALETTE.bone),
      );
    }
  });
  const body = scene0.add.container(0, TOP - 6, parts).setDepth(3).setVisible(false);
  traps.push({ y: TOP - 6, lanes, body });

  audio.sfx('lock_click', 0.5);
  const warn = centerText(scene0, GAME_W / 2, 62, 'SPIKES', PALETTE.blood).setDepth(50);
  scene0.tweens.add({ targets: warn, alpha: 0, duration: 900, onComplete: () => warn.destroy() });
}

/**
 * Where the next hazard goes.  Never the lane the last one was in, never behind
 * a car that is already at the top of the road, and — given a choice — a lane
 * or two off the player's line.  It was written to stop pickups being
 * collectable by holding a direction; with nothing out there worth collecting
 * any more it does the opposite job just as well, which is that a hazard never
 * lands on the line you are already committed to.
 */
function jarLane(): number {
  const clear = [0, 1, 2, 3].filter(
    (i) =>
      i !== lastJarLane &&
      !traffic.some((c) => laneOf(c.x) === i && c.y < TOP + CAR_H * 3) &&
      !pickups.some((j) => laneOf(j.x) === i && j.y < TOP + 48),
  );
  const pool = clear.length ? clear : [0, 1, 2, 3].filter((i) => i !== lastJarLane);
  const here = laneOf(px);
  // Furthest from the player's lane, but two is as far as it is worth putting
  // one: a jar on the far verge of a busy road is decoration, not a pickup.
  const reach = (i: number): number => Math.min(2, Math.abs(i - here));
  const best = Math.max(...pool.map(reach));
  const picks = pool.filter((i) => reach(i) === best);
  return picks[Phaser.Math.Between(0, picks.length - 1)];
}

/**
 * Crossing a heat notch is said out loud once.  A chase that quietly got
 * harder reads as the game cheating, and there are two ways to cross one now.
 */
function announceHeat(): void {
  const notch = chaseHeat(collected);
  if (notch > heatShown) {
    heatShown = notch;
    heatUp(notch);
  }
}

/**
 * One thing on the road, in a lane and OFF the lane's middle.
 *
 * They used to land dead centre of a lane, which made a hazard a thing you
 * lined up against once and then held a line around.  Jittered across most of
 * the lane's width, missing one is a steer you have to aim and two in a row
 * are never in the same place.
 */
function spawnPickup(kind: PickupKind): void {
  if (!scene0) return;
  const idx = jarLane();
  lastJarLane = idx;
  const x = LANES[idx] + (Math.random() - 0.5) * (LANE_W - CAR_W - 4);
  const parts: Phaser.GameObjects.GameObject[] = [];

  if (kind === 'oil') {
    // A SLICK.  Wider than a pothole and the only thing on this road with a
    // sheen on it: black in the middle with a rainbow edge, because a hazard
    // that reads as "shadow" is a hazard nobody swerves for.  It is the widest
    // thing you have to miss, which is the point -- it is also the worst.
    parts.push(scene0.add.ellipse(0, 0, 26, 13, 0x0c0d11));
    parts.push(scene0.add.ellipse(-4, -1, 12, 7, 0x1a1c24));
    parts.push(scene0.add.ellipse(6, 2, 9, 5, 0x1a1c24));
    // the sheen, in three arcs of colour round the leading edge
    parts.push(scene0.add.ellipse(-6, -3, 7, 3, 0x2f4d6b).setAlpha(0.8));
    parts.push(scene0.add.ellipse(2, -4, 6, 2, 0x5c3a6b).setAlpha(0.7));
    parts.push(scene0.add.ellipse(8, -2, 5, 2, 0x2a5c4a).setAlpha(0.7));
  } else {
    // A POTHOLE: a ragged black hole with a lip of broken tarmac, which is the
    // only thing out here drawn DARKER than the road so it cannot be mistaken
    // for something worth driving at.
    parts.push(scene0.add.ellipse(0, 0, 15, 10, 0x2a2b30));
    parts.push(scene0.add.ellipse(0, 0, 12, 7, 0x0a0b0e));
    parts.push(scene0.add.rectangle(-4, -3, 3, 2, 0x3c3e44));
    parts.push(scene0.add.rectangle(5, 2, 3, 2, 0x3c3e44));
  }

  const body = scene0.add.container(x, TOP - 6, parts).setDepth(kind === 'pothole' ? 2 : 3).setVisible(false);
  pickups.push({ x, y: TOP - 6, kind, body });
}

/**
 * BUY ONE, AND PUT IT DOWN BEHIND YOU.
 *
 * THE TOOL IS BOUGHT NOW, NOT FOUND.  A banana was a thing lying in a lane:
 * you drove where it was, you carried up to three, and from then on the escape
 * was free and the only question was whether you had one left.  A Froggy bomb
 * costs THIRTY OF THE CASH YOU ARE PLAYING FOR, every time, which makes every
 * use of it a real decision -- thirty off the bag is a token and a half off
 * the payout and a notch of heat you have to earn back.
 *
 * The cost is also the only brake on it: there is no carry limit any more
 * because the bag is the carry limit.  With four hundred on you it is four
 * escapes; with twenty-nine it is a button that does nothing, and the HUD says
 * which of those you are in before you press it.
 *
 * It goes a car's length back, which is the only place it is any use: one
 * under your own wheels does nothing, and one dropped in front would be a
 * thing you drove into.
 */
function dropBomb(): void {
  if (over || !scene0) return;
  if (collected < BOMB_COST) {
    // Told, not ignored.  A button that silently does nothing reads as broken.
    audio.sfx('ui_blip', 0.35);
    const t = centerText(scene0, GAME_W / 2, 118, `BOMBS COST ${BOMB_COST}`, PALETTE.blood).setDepth(50);
    scene0.tweens.add({ targets: t, alpha: 0, duration: 800, onComplete: () => t.destroy() });
    return;
  }
  collected -= BOMB_COST;
  const parts = [
    // A dark round body with a lit fuse and his eyes on it, so what is sitting
    // in the road is a bomb and is his.
    scene0.add.circle(0, 1, 5, 0x1b2028),
    scene0.add.circle(0, 1, 3, PALETTE.moss),
    scene0.add.rectangle(-1, -1, 2, 2, PALETTE.cream),
    scene0.add.rectangle(2, -1, 2, 2, PALETTE.cream),
    scene0.add.rectangle(1, -5, 1, 3, PALETTE.brown),
    scene0.add.circle(2, -7, 1.5, PALETTE.amber),
  ];
  const y = py + CAR_H / 2 + 4;
  const body = scene0.add.container(px, y, parts).setDepth(2);
  drops.push({ x: px, y, life: BOMB_LIFE_MS, body });
  audio.sfx('throw_whoosh', 0.45);
  refreshHud();
}

/**
 * CONCRETE IN A LANE, AND A WAY ROUND IT.
 *
 * `lanes` is which lanes it fills.  The caller picks them; the fairness is in
 * `layBarrier` below, which is the only thing that ever chooses them itself.
 */
function spawnBarrier(lanes: number[], y = TOP - BARRIER_H): void {
  if (!scene0) return;
  for (const lane of lanes) {
    const x = LANES[lane];
    const w = LANE_W - 8;
    const parts: Phaser.GameObjects.GameObject[] = [
      // A jersey barrier seen from above: grey slab, a darker shadow down one
      // side so it has height, and the diagonal hazard stripes that are the
      // only reason it reads at a glance as "do not drive here".
      scene0.add.rectangle(0, 0, w, BARRIER_H, 0x8c8f96),
      scene0.add.rectangle(0, BARRIER_H / 2 - 2, w, 3, 0x5a5d64),
      scene0.add.rectangle(0, -BARRIER_H / 2 + 1, w, 2, 0xb6b9c0),
    ];
    for (let i = -2; i <= 2; i++) {
      parts.push(scene0.add.rectangle(i * 8, 0, 3, BARRIER_H - 4, PALETTE.blood).setAlpha(0.85));
    }
    // and a lamp on top of it, lit, so it is visible before the paint is
    parts.push(scene0.add.circle(w / 2 - 3, -BARRIER_H / 2 + 2, 2, PALETTE.amber));
    const body = scene0.add.container(x, y, parts).setDepth(4).setVisible(false);
    barriers.push({ x, y, lane, body });
  }
}

/**
 * Choose where the concrete goes, and leave a door in it.
 *
 * THE RULES ARE THE WHOLE POINT.  At most two of the four lanes, never the
 * lane the player is in as it is laid, and the gap the player is nearest has
 * to be inside a lane of where they already are -- so the way round is always
 * a steer they have time to make rather than a sprint across the road.  It
 * also will not lay one on top of a spike strip that is already coming, which
 * between them could close every lane on the board.
 */
function layBarrier(): void {
  // ---- NOT ON TOP OF A STRIP.  Both of these close lanes, both are laid at
  // the top of the road, and both scroll down at the same speed -- so one laid
  // while the other is still coming stays the same few pixels behind it for
  // the whole way down, and the two of them together are one wall with no door
  // in it.  The strip has the stronger claim (it is the older hazard and it
  // picks its own gap), so the concrete waits.
  if (traps.some((t) => t.y < BOTTOM * 0.6)) return;
  const here = laneOf(px);
  const free = [0, 1, 2, 3].filter((i) => i !== here);
  if (!free.length) return;
  // How many lanes it fills: one to start with, two once the road is bad.
  const want = stage() >= 2 && Math.random() < 0.45 ? BARRIER_MAX_LANES : 1;
  const lanes: number[] = [];
  for (const cand of free.sort(() => Math.random() - 0.5)) {
    if (lanes.length >= want) break;
    // Leaving this one out still has to leave the player somewhere to be that
    // is next door to where they are.
    const after = [...lanes, cand];
    const open = [0, 1, 2, 3].filter((i) => !after.includes(i));
    if (!open.some((i) => Math.abs(i - here) <= 1)) continue;
    lanes.push(cand);
  }
  if (!lanes.length) return;
  spawnBarrier(lanes);
  audio.sfx('fence_thunk', 0.4);
}

/**
 * SOMEBODY IN THE ROAD.
 *
 * They come in at the top like everything else and they walk -- across the
 * lanes, or down the road, and they change their mind about which on their own
 * clock.  They do not look, they do not hurry and they do not get out of the
 * way, which is exactly what makes them harder to plan around than a car.
 */
function spawnPed(): void {
  if (!scene0) return;
  // Crossing, or walking along it.  Crossers start at a verge so the whole
  // width of the road is the warning; walkers start in a lane.
  const crossing = Math.random() < 0.65;
  const fromLeft = Math.random() < 0.5;
  const x = crossing ? (fromLeft ? ROAD_L + 3 : ROAD_L + ROAD_W - 3) : LANES[Phaser.Math.Between(0, 3)];
  const parts: Phaser.GameObjects.GameObject[] = [
    scene0.add.rectangle(0, 0, PED_W, PED_H, PALETTE.brownLight),
    scene0.add.rectangle(0, -PED_H / 2 - 1, 3, 3, PALETTE.cream),
    // dark glasses, which with the cane is the whole of the read at this size
    scene0.add.rectangle(0, -PED_H / 2 - 1, 3, 1, PALETTE.black),
  ];
  const cane = scene0.add.rectangle(3, 2, 1, 7, PALETTE.white);
  parts.push(cane);
  const body = scene0.add.container(x, TOP - PED_H, parts).setDepth(5).setVisible(false);
  peds.push({
    x,
    y: TOP - PED_H,
    vx: crossing ? (fromLeft ? PED_CROSS : -PED_CROSS) : 0,
    vy: crossing ? 0 : PED_ALONG,
    turn: PED_TURN_MS,
    body,
    cane,
  });
}

/**
 * THE AXLE GOES.
 *
 * Not a crash: a breakdown.  The car keeps its place on the road and coasts
 * down over `BREAKDOWN_MS` with the steering gone, so the player watches the
 * run end rather than being told it has -- and whatever was chasing arrives
 * while it happens, which is the right last image for this game.
 *
 * `crash` is what actually ends it, from the update loop, once the roll-out is
 * spent.  Calling it here would cut the roll-out off at the first frame.
 */
function breakDown(): void {
  if (brokenMs > 0 || over) return;
  brokenMs = BREAKDOWN_MS;
  audio.sfx('crumble', 0.8);
  scene0?.cameras.main.shake(620, 0.02);
  warn('THE AXLE IS GONE');
}

/** A line over the road, for the things the driver cannot see for themselves. */
function warn(line: string): void {
  if (!scene0) return;
  const t = centerText(scene0, GAME_W / 2, 74, line, PALETTE.blood).setDepth(50);
  scene0.tweens.add({ targets: t, y: 66, alpha: 0, duration: 1500, onComplete: () => t.destroy() });
}

/**
 * THE SMOKE, once the engine has taken two.
 *
 * Puffs off the back of the car, drifting down the road with everything else
 * and fading as they go.  It is the only part of the damage the player can
 * see, so it keeps going for as long as the car is hurt rather than being a
 * one-off puff at the moment of the hit.
 */
function stepSmoke(dt: number, delta: number, ground: number): void {
  if (!scene0) return;
  if (potholeHits >= SMOKE_FROM && !over) {
    smokeTimer -= delta;
    if (smokeTimer <= 0) {
      smokeTimer = SMOKE_EVERY;
      const x = px + (Math.random() - 0.5) * (CAR_W - 4);
      const y = py + CAR_H / 2 - 1;
      // Darker the worse it is: a car on its last hole is burning something.
      const shade = potholeHits >= POTHOLE_MAX - 1 ? 0x4a4a52 : 0x7d8088;
      const body = scene0.add.circle(x, y, 2, shade, 0.7).setDepth(5);
      smoke.push({ x, y, life: SMOKE_LIFE, body });
    }
  }
  smoke = smoke.filter((puff) => {
    puff.life -= delta;
    // Down the road with everything else, and wandering as it lifts.
    puff.y += ground * dt * 0.9;
    puff.x += Math.sin(puff.life / 90) * 8 * dt;
    const k = Math.max(0, puff.life / SMOKE_LIFE);
    puff.body.setPosition(puff.x, puff.y).setRadius(2 + (1 - k) * 4).setAlpha(k * 0.6);
    if (puff.life <= 0 || puff.y > BOTTOM + 8) {
      puff.body.destroy();
      return false;
    }
    return true;
  });
}

function spawnCash(): void {
  if (!scene0) return;
  const lane = LANES[Phaser.Math.Between(0, 3)];
  const body = scene0.add.rectangle(lane, TOP - 6, 9, 7, PALETTE.mossLight).setStrokeStyle(1, PALETTE.cream).setDepth(3).setVisible(false);
  cash.push({ x: lane, y: TOP - 6, body });
}

function crash(why: string): void {
  if (shielded) return;
  if (over || !scene0) return;
  reason = why;
  audio.sfx('whack');
  scene0.cameras.main.shake(300, 0.02);
  centerText(scene0, GAME_W / 2, 80, why, PALETTE.blood, 16).setDepth(50);
  finish();
}

function refreshHud(): void {
  if (!hud) return;
  hud.cash.setText(`CASH ${collected}`);
  hud.best.setText(`BEST ${best}`);
  const banked = runReward();
  // Not an offer any more -- there is nothing to press.  It is the receipt:
  // once it is up, it is up for the rest of the run whatever happens next.
  hud.bank.setText(`${banked} TOKENS SAFE`).setVisible(banked > 0);
  // What the tool costs and whether the bag covers it.  A price you cannot
  // read is a button you press and nothing happens.
  hud.bombLabel.setText(`BOMB ${BOMB_COST}`);
  hud.bombLabel.setTint(collected >= BOMB_COST ? PALETTE.gold : PALETTE.steel);
  // ---- AND HOW MUCH CAR IS LEFT.  The smoke says something is wrong; this
  // says how wrong, which is what a player deciding whether to risk the next
  // hole actually needs.  Hidden while the car is clean, so an undamaged run
  // is not carrying a meter that only ever reads full.
  const left = POTHOLE_MAX - potholeHits;
  hud.damage.setText(potholeHits > 0 ? `CAR ${'#'.repeat(left)}${'.'.repeat(potholeHits)}` : '').setVisible(potholeHits > 0);
  hud.damage.setTint(left <= 1 ? PALETTE.blood : PALETTE.amber);
}

function finish(): void {
  if (over) return;
  over = true;
  store.setHighScore(ID, collected);
  const payout = runReward();
  scene0?.time.delayedCall(700, () => (payout > 0 ? apiRef?.win(payout) : apiRef?.lose()));
}
