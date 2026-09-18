/**
 * FROGGY CAR CHASE.  Hard — 5 tokens in, ten and up out.
 *
 * A four-lane road seen from above, scrolling under you.  Traffic ahead is
 * slower than you and has to be threaded; the police behind are faster than
 * you and have to be shaken.  Cash sits on the road in bundles of twenty.
 *
 * THERE ARE THREE THINGS ON THE ROAD, and two of them are worth having.
 *
 *   BANANAS are the tool.  You pick one up by driving over it and you carry up
 *   to three; SPACE puts one down a car's length behind you, and the first
 *   police car to reach it goes round — spun out, siren off, sliding back down
 *   the road — and the road behind you clears for ten seconds with it.  It is
 *   the only way out of a corner that you have to have EARNED: the skin was
 *   somewhere on the road and you had to go and get it.
 *
 *   FROGGY BANKS pay fifty on the spot, which is two and a half bundles of
 *   cash for one steer.  They are the rarest thing out here, so a bank is
 *   something you cross two lanes for with the police on you, which is exactly
 *   the decision the game wants to be asking.
 *
 *   POTHOLES are the one you have to miss.  They do not end the run: the car
 *   drops in, comes out under a second later with most of its speed and half
 *   its steering gone, and whatever was behind you closes the entire gap while
 *   it happens.  A hazard that kills is a hazard you memorise; one that costs
 *   you the gap is one you drive around.
 *
 * NITRO USED TO BE THE ONE TOOL, and it was a button that made the problem go
 * away: press it, the road emptied, and the only question was whether the bar
 * had refilled.  What replaced it buys the same respite and makes you go and
 * find it first.
 *
 * Getting TO two hundred is the gentle half: the road climbs slowly, traffic
 * is thin, and a second car does not turn up for three quarters of a minute.
 *
 * Two hundred cash is the bar: ten tokens, and one more for every further
 * two hundred.  IT IS ALSO WHEN THEY START TAKING YOU SERIOUSLY.  Every two
 * hundred in the bag puts another car on the road behind you, and the first
 * three notches also make them faster, the traffic thicker and the road
 * quicker.  At six hundred they stop driving at you and start LAYING THINGS
 * IN THE ROAD.  The run ends on a crash, on being caught, or on ENTER — pull
 * over and take what you have.  Carrying on is a bet against a chase that is
 * getting worse.
 *
 * THEY CAN BE JUKED, AND THEY CAN BE CRASHED.  A chaser steers at the lane it
 * last SAW you in, and it only looks every few tenths of a second, so a late
 * swerve leaves it committed to where you were — that lag is the whole of how
 * you shake one without a banana, and it shortens as the heat climbs.  It also
 * means you can aim them: a chaser locked onto your old lane drives into the
 * back of the traffic in it, spins out, and is no use to anyone for a few
 * seconds.  The spike strips cut both ways too — a police car that drives
 * over one goes out the same way your car would have.
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
 * So the road is a weapon, not just an obstacle, and the pickups are laid out
 * to make you use it: never twice in the same lane, never behind a car that is
 * already there, always a lane or two off your line, and jittered ACROSS the
 * lane rather than parked in the middle of it — so going for one is a steer
 * you have to aim rather than a thing you drive through.
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
 * Three hundred to bank anything, fifteen tokens for it, and five more for
 * every hundred after that.  It is deliberately past the first heat notch:
 * one police car turns up at two hundred, so nobody banks a run without
 * having been chased by somebody.
 */
export const BAR_CASH = 300;
export const BASE_REWARD = 15;
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
 * a banana dropped during a crash respite extends the quiet rather than stacking
 * a second one on top of it, and nothing can send two cars out at once when it
 * ends: the spawner is on its usual one-at-a-time clock and starts from a full
 * interval, so the first car back is a car, not a wall.
 */
const RESPITE_MS = 10_000;
/** And it comes back in gently: the first spawn after a respite is unhurried. */
const RESPITE_TAIL_MS = 1800;

/**
 * BANANAS, WHICH REPLACED THE NITRO.
 *
 * Nitro was a button that made the problem go away: press it, the road
 * emptied, and the only decision was whether the bar was full.  A banana is
 * the same escape bought a different way -- you have to find one on the road,
 * which means going where it is instead of where you want to be, and then
 * choose the moment to put it down behind you.  What it buys is the same
 * respite, and it buys it by taking a chaser off the road rather than by
 * outrunning one.
 */
const BANANA_MAX = 3;
/** How long a dropped skin stays on the road before the sweeper gets it. */
const BANANA_LIFE_MS = 9000;
/** What a Froggy Bank is worth when you drive over it. */
const BANK_CASH = 50;
/**
 * POTHOLES.  The one thing out here that does not end the run and is still
 * worth swerving for: the car drops into it, loses most of its speed and half
 * its steering for a moment, and whatever is behind you closes the whole gap
 * while it happens.  A hazard that kills is a hazard you memorise; one that
 * costs you the gap is one you drive around.
 */
const POTHOLE_JOLT_MS = 900;
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
/** The most cars they will ever have on you at once. */
const POLICE_MAX = 6;
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
 * the bananas and of the traffic — but it shuts at a speed a player can read and
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
 * Three kinds, one list, because they all do the same thing every frame -- come
 * down the screen at road speed and get tested against the car -- and differ
 * only in what happens when they are reached.
 *
 *   banana   picked up, and kept until you choose to put it down
 *   bank     picked up, and worth fifty on the spot
 *   pothole  not picked up at all: it is the one you have to miss
 */
type PickupKind = 'banana' | 'bank' | 'pothole';
let pickups: Array<{ x: number; y: number; kind: PickupKind; body: Phaser.GameObjects.Container }> = [];
let jarTimer = 0;
/** Skins the player is carrying, and skins already down on the road. */
let bananas = 0;
let drops: Array<{ x: number; y: number; life: number; body: Phaser.GameObjects.Container }> = [];
/** Milliseconds left of being in a pothole.  See POTHOLE_JOLT_MS. */
let joltMs = 0;
let warnT = 0;
let dashes: Array<Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc> = [];
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
  bananaLabel: Phaser.GameObjects.BitmapText;
  warn: Phaser.GameObjects.BitmapText;
  clear: Phaser.GameObjects.BitmapText;
} | null = null;

export function chasePayout(c: number): number {
  if (c < BAR_CASH) return 0;
  return BASE_REWARD + STEP_REWARD * Math.floor((c - BAR_CASH) / STEP_CASH);
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
  rules: 'dodge, grab cash, lose the law',
  tutorial: {
    objective: [
      'GRAB CASH AND LOSE THE LAW.',
      'BANANAS SPIN THE POLICE. BANKS PAY 50.',
      'TRAFFIC BLINKS 3 TIMES, THEN MOVES OVER.',
      'SWERVE LATE - THEY DRIVE AT YOUR OLD LANE.',
      'A BANANA OR A CRASH CLEARS THEM FOR 10s.',
      'PULL OVER AT 300 FOR 15, +5 EVERY 100.',
    ],
    controls: [
      ['A / D', 'STEER'],
      ['W / S', 'SPEED UP OR EASE OFF'],
      ['SPACE', 'DROP A BANANA'],
    ],
    // ENTER pulls over with the cash, and it is NOT listed here.  It does
    // nothing until there is cash to pull over with, and the moment there is,
    // the HUD says `[ENTER] PULL OVER FOR n TOKENS` on the road itself.
  },
  touch: {
    stick: 'wasd',
    buttons: [
      { label: 'DROP\nBANANA', key: 'SPACE', primary: true },
      { label: 'PULL\nOVER', key: 'ENTER' },
    ],
  },
  payoutNote: 'WIN: 15+',

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
    best = store.highScore(ID);
    bananas = 1;
    drops = [];
    pickups = [];
    joltMs = 0;
    heatShown = 0;
    over = false;
    reason = '';

    // verge, road, lane lines.  Things spawn above the top edge and scroll
    // in, and the shell's title bar has to stay on top of them — so nothing is
    // drawn until it is below the bar (see `onScreen`).  Negative depths were
    // tried for this and put the whole road under the shell's black backdrop.
    scene.add.rectangle(0, TOP, GAME_W, BOTTOM - TOP, 0x17301c).setOrigin(0, 0).setDepth(1);
    scene.add.rectangle(ROAD_L, TOP, ROAD_W, BOTTOM - TOP, 0x2a2d33).setOrigin(0, 0).setDepth(1);
    scene.add.rectangle(ROAD_L - 3, TOP, 3, BOTTOM - TOP, PALETTE.bone).setOrigin(0, 0).setDepth(1);
    scene.add.rectangle(ROAD_L + ROAD_W, TOP, 3, BOTTOM - TOP, PALETTE.bone).setOrigin(0, 0).setDepth(1);
    for (let i = 1; i < 4; i++) {
      for (let y = TOP; y < BOTTOM + 16; y += 16) {
        dashes.push(scene.add.rectangle(ROAD_L + LANE_W * i, y, 1, 8, 0x6a6e76).setOrigin(0.5, 0).setDepth(2));
      }
    }
    // trees and bushes on the verges, scrolling with the road
    for (let i = 0; i < 14; i++) {
      // The verges are narrower now the camera is back, so the scenery is
      // packed into what is left of them rather than off the side of the view.
      const side = i % 2 ? ROAD_L - 8 - ((i * 37) % 36) : ROAD_L + ROAD_W + 8 + ((i * 41) % 36);
      const y = TOP + ((i * 53) % (BOTTOM - TOP + 16));
      const r = 4 + (i % 3) * 2;
      dashes.push(scene.add.circle(side, y, r, i % 3 === 0 ? 0x2e5e38 : 0x24482c).setDepth(2));
    }

    player = carSprite(scene, px, py, PALETTE.mossLight, false).setDepth(6).setVisible(true);

    hud = {
      cash: text(scene, 6, 21, '', PALETTE.cream),
      best: text(scene, GAME_W - 6, 21, '', PALETTE.gold).setOrigin(1, 0),
      time: centerText(scene, GAME_W / 2, 25, '', PALETTE.fog),
      bank: centerText(scene, GAME_W / 2, 170, '', PALETTE.gold).setVisible(false),
      bananaLabel: text(scene, 4, 150, '', PALETTE.gold),
      warn: centerText(scene, GAME_W / 2, 150, 'POLICE CLOSE', PALETTE.blood, 16).setVisible(false),
      // The quiet is the reward, so the quiet is on the HUD and counting down:
      // ten seconds you cannot see is ten seconds you cannot spend.
      clear: centerText(scene, GAME_W / 2, 30, '', PALETTE.tealLight, 16).setVisible(false),
    };
    hud.bananaLabel.setDepth(9);
    hud.warn.setDepth(9);
    hud.clear.setDepth(9);
    hud.cash.setDepth(9);
    hud.best.setDepth(9);
    hud.time.setDepth(9);
    hud.bank.setDepth(9);
    text(scene, 4, 160, 'SPACE', PALETTE.ash).setDepth(9);
    text(scene, 4, 168, 'DROPS', PALETTE.ash).setDepth(9);
    refreshHud();

    const kb = scene.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    keys = {
      left: bind(['A', 'LEFT']),
      right: bind(['D', 'RIGHT']),
      up: bind(['W', 'UP']),
      down: bind(['S', 'DOWN']),
    };
    kb?.on('keydown-SPACE', () => dropBanana());
    kb?.on('keydown-ENTER', () => {
      if (!over && collected >= BAR_CASH) finish();
    });

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__chase = {
        state: () => ({
          cash: collected,
          best,
          speed,
          bananas,
          drops: drops.length,
          jolted: joltMs > 0,
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
          traffic = [];
          police = [];
          traps = [];
          pickups = [];
          drops = [];
          cash = [];
          joltMs = 0;
          policeTimer = 60_000;
          trafficTimer = 60_000;
          trapTimer = 60_000;
          cashTimer = 60_000;
          jarTimer = 60_000;
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
          heatShown = chaseHeat(n);
          refreshHud();
        },
        /** Empty the tank, for watching it fill itself back up. */
        /**
         * Make the car unhittable, so a test of the CHASE is not cut short by
         * a traffic car the harness was never steering around.
         */
        shield: (on: boolean) => {
          shielded = on;
        },
        setBananas: (n: number) => {
          bananas = Math.max(0, Math.min(BANANA_MAX, n | 0));
          refreshHud();
        },
        drop: () => dropBanana(),
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
    const heat = chaseHeat(collected);

    // ---- the road, and you on it.  It runs quicker the more you are carrying.
    speed = Math.min(SPEED_MAX + heat * HEAT_ROAD, SPEED_START + (elapsed / 1000) * SPEED_RAMP + heat * HEAT_ROAD);
    const ground = speed * (jolted ? POTHOLE_SPEED : 1);
    const dx = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    const dy = (held('down') ? 1 : 0) - (held('up') ? 1 : 0);
    px = Phaser.Math.Clamp(
      px + dx * STEER * (jolted ? POTHOLE_STEER : 1) * dt,
      ROAD_L + CAR_W / 2,
      ROAD_L + ROAD_W - CAR_W / 2,
    );
    py = Phaser.Math.Clamp(py + dy * CREEP * dt, 70, 160);
    player.setPosition(px, py);
    // leaning where you are steering, eased so it is a car and not a cursor
    player.setAngle(Phaser.Math.Linear(player.angle, dx * 7, Math.min(1, dt * 9)));
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
      const light = p.body.getAt(2) as Phaser.GameObjects.Rectangle;
      if (p.stun > 0) {
        // Spun out: siren dead, no steering, crawling, and falling back down
        // the road.  It is still a lump of metal in a lane, so it can still be
        // hit — it just is not chasing anybody.
        p.stun -= delta;
        p.own = POLICE_STUN_SPEED;
        p.y += (ground - p.own) * dt;
        p.body.setPosition(p.x, p.y).setVisible(onScreen(p.y));
        p.body.setAngle(p.body.angle + delta * 0.3);
        light.setFillStyle(PALETTE.steel);
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
      // lights
      const on = Math.floor(elapsed / 120) % 2 === 0;
      light.setFillStyle(on ? PALETTE.blood : PALETTE.moon);
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
        // Putting one into the traffic clears the road the same way a banana
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
    // ---- WHAT IS LYING ON THE ROAD.  One clock for all three, and which one
    // it puts down is a weighted roll: mostly bananas, because they are the
    // tool; a pothole often enough that the road is never a clear run; and a
    // bank rarely, so fifty on the floor is something you go out of your way
    // for rather than something that arrives.
    jarTimer -= delta;
    if (jarTimer <= 0) {
      const r = Math.random();
      spawnPickup(r < 0.42 ? 'banana' : r < 0.82 ? 'pothole' : 'bank');
      jarTimer = 1500 + Math.random() * 1600;
    }
    for (const j of pickups) {
      j.y += ground * dt;
      j.body.setPosition(j.x, j.y).setVisible(j.y > TOP + 6);
    }
    pickups = pickups.filter((j) => {
      const touched = Math.abs(j.x - px) < CAR_W / 2 + 4 && Math.abs(j.y - py) < CAR_H / 2 + 5;
      if (touched) {
        if (j.kind === 'bank') {
          collected += BANK_CASH;
          best = Math.max(best, collected);
          audio.sfx('cha_ching', 0.6);
          announceHeat();
        } else if (j.kind === 'banana') {
          bananas = Math.min(BANANA_MAX, bananas + 1);
          audio.sfx('chime', 0.5);
        } else {
          // THE POTHOLE.  You are in it, and out of it in under a second --
          // with most of your speed gone and whatever was behind you a lot
          // closer than it was.
          joltMs = POTHOLE_JOLT_MS;
          audio.sfx('item_thud', 0.8);
          scene0?.cameras.main.shake(260, 0.012);
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
 * hundred, and one more for every further two hundred in the bag, up to six.
 * It is a pure function of the cash — the clock no longer has a say — so the
 * chase is exactly as heavy as what you are carrying, and the player can read
 * their own bag and know what is behind them.
 */
export function policeFor(cash: number): number {
  return Math.min(POLICE_MAX, 1 + Math.floor(cash / TARGET_CASH));
}

function policeCap(): number {
  return policeFor(collected);
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
 * screen within a second or two, which is the same exit a banana always
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

function carSprite(scene: Phaser.Scene, x: number, y: number, colour: number, cop: boolean): Phaser.GameObjects.Container {
  const body = scene.add.rectangle(0, 0, CAR_W, CAR_H, colour);
  const glass = scene.add.rectangle(0, -4, CAR_W - 4, 5, PALETTE.ink);
  const roof = scene.add.rectangle(0, 2, cop ? 6 : CAR_W - 4, cop ? 3 : 4, cop ? PALETTE.blood : PALETTE.black).setAlpha(cop ? 1 : 0.35);
  const parts: Phaser.GameObjects.GameObject[] = [body, glass, roof];
  // Indicators, at the back corners where the player — who is behind every one
  // of these cars — can actually see them.  Police do not signal.
  const lamps: Phaser.GameObjects.Rectangle[] = [];
  if (!cop) {
    for (const side of [-1, 1]) {
      const lamp = scene.add.rectangle(side * (CAR_W / 2 - 1), CAR_H / 2 - 3, 2, 4, PALETTE.amber).setVisible(false);
      lamps.push(lamp);
      parts.push(lamp);
    }
  }
  const c = scene.add.container(x, y, parts).setDepth(4).setVisible(false);
  c.setData('lamps', lamps);
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
  const colours = [PALETTE.ember, PALETTE.neon, PALETTE.amber, PALETTE.violet, PALETTE.bone];
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
  const body = carSprite(scene0, lane, BOTTOM + CAR_H, PALETTE.moon, true);
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
 * Where the next jar goes.  Never the lane the last one was in, never behind
 * a car that is already at the top of the road, and — given a choice — a lane
 * or two off the player's line, so a top-up is a decision about traffic and
 * not something you collect by holding a direction.
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
 * The jars used to land dead centre of a lane, which made them a thing you
 * lined up once and then drove through.  These are jittered across most of the
 * lane's width, so reaching one is a steer rather than a lane choice and two
 * in a row are never in the same place.
 */
function spawnPickup(kind: PickupKind): void {
  if (!scene0) return;
  const idx = jarLane();
  lastJarLane = idx;
  const x = LANES[idx] + (Math.random() - 0.5) * (LANE_W - CAR_W - 4);
  const parts: Phaser.GameObjects.GameObject[] = [];

  if (kind === 'banana') {
    // A skin: a fat crescent, drawn as three blocks stepping round, with a
    // brown tip so it is not just a yellow smear at this size.
    parts.push(scene0.add.rectangle(-3, -2, 4, 3, 0xf2d04b));
    parts.push(scene0.add.rectangle(0, 0, 5, 3, 0xffe46b));
    parts.push(scene0.add.rectangle(3, 2, 4, 3, 0xf2d04b));
    parts.push(scene0.add.rectangle(-5, -3, 2, 2, 0x6b4a2f));
  } else if (kind === 'bank') {
    // A FROGGY BANK: a green money box with a slot in the top and his eyes on
    // it, so the fifty reads as his before the player has been told.
    parts.push(scene0.add.rectangle(0, 1, 11, 9, PALETTE.moss).setStrokeStyle(1, 0x1e3f24));
    parts.push(scene0.add.rectangle(0, -4, 7, 2, 0x14261a));
    parts.push(scene0.add.rectangle(-3, 0, 2, 2, PALETTE.cream));
    parts.push(scene0.add.rectangle(3, 0, 2, 2, PALETTE.cream));
    parts.push(scene0.add.rectangle(0, 4, 9, 2, PALETTE.gold));
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
 * PUT ONE DOWN, BEHIND YOU.
 *
 * It goes a car's length back, which is the only place it is any use: a skin
 * under your own wheels does nothing, and one dropped in front would be a
 * thing you drove into.  Nothing stops you dropping the lot at once -- the
 * limit is how many you found.
 */
function dropBanana(): void {
  if (over || bananas <= 0 || !scene0) return;
  bananas -= 1;
  const parts = [
    scene0.add.rectangle(-3, -2, 4, 3, 0xd8b93f),
    scene0.add.rectangle(0, 0, 5, 3, 0xf2d04b),
    scene0.add.rectangle(3, 2, 4, 3, 0xd8b93f),
  ];
  const y = py + CAR_H / 2 + 4;
  const body = scene0.add.container(px, y, parts).setDepth(2);
  drops.push({ x: px, y, life: BANANA_LIFE_MS, body });
  audio.sfx('throw_whoosh', 0.45);
  refreshHud();
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
  const banked = chasePayout(collected);
  hud.bank.setText(`[ENTER] PULL OVER FOR ${banked} TOKENS`).setVisible(banked > 0);
  hud.bananaLabel.setText(`BANANA x${bananas}`);
  hud.bananaLabel.setTint(bananas > 0 ? PALETTE.gold : PALETTE.steel);
}

function finish(): void {
  if (over) return;
  over = true;
  store.setHighScore(ID, collected);
  const payout = chasePayout(collected);
  scene0?.time.delayedCall(700, () => (payout > 0 ? apiRef?.win(payout) : apiRef?.lose()));
}
