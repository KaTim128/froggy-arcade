/**
 * Hide and seek.  First person, one room, one round.
 *
 * He gives you fifteen seconds.  He is not in the room for them and he does
 * not say anything: the count runs, you walk, you pick somewhere.  Then he
 * comes in and has his clock to find you — two minutes in the first zone, two
 * and a half in the second, three in the third.  Last it out and the
 * round is yours.
 *
 * He SEARCHES.  He does not walk at you — he tours the hiding places, stops to
 * listen, and opens the ones he has left alone longest, which is what makes
 * sitting in one box a clock rather than a plan.  Every spot he opens announces
 * itself, loudly, wherever you are: the room is otherwise silent, so his
 * footsteps and those lids are the entire information channel.
 *
 * He is half your running speed and always will be, so if he sees you the
 * answer is to break the sightline and get into something before his memory of
 * where you went runs out.
 *
 * The opening is deliberately calm.  Nothing lunges at you in the first
 * fifteen seconds; the room only turns once the count is over.
 */

import Phaser from 'phaser';
import * as THREE from 'three';
import { audio, SILENCE, type SfxName } from '../core/audio';
import { store } from '../core/state';
import { ledger } from '../core/ledger';
import { froggyLayer } from '../render/froggyLayer';
import { playJumpscare, SCARE_MS } from '../froggy/jumpscare';
import { FroggyMonster } from '../three/froggyMonster';
import { drawPixelText } from '../render/pixelFont';
import { ThreeStage } from '../render/threeStage';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { ROOMS, type Box, type CounterRun, type RoomDef, type SpotKind } from '../three/hideRooms';
import { buildGrid, findPath, lineOpen, spotExtent, type NavGrid } from '../three/navGrid';
import { dressRoom, surfaceTexture } from '../three/hideDecor';
import {
  buildCabinet,
  buildChangeMachine,
  buildCounter,
  buildDroppedKey,
  buildGlassDoors,
  buildHand,
  buildPrizeCase,
  buildStaffDoor,
} from '../three/arcadeProps';
import { buildSecretRoom, SECRET_ORIGIN, type SecretRoom } from '../three/secretRoom';

/** A walk is slow and silent; a run is fast and heard.  That is the trade. */
const WALK = 2.0;
const RUN = 4.0;
/**
 * What running is worth behind the wall.  The gallery is a long room with a
 * staircase in it and nothing in it can hurt you; the hide rooms' pace is
 * there to make crossing a room a decision, and there is no decision in here.
 */
const SECRET_RUN = 2.0;
/** Radians per second on the arrow keys, and per pixel of mouse drag. */
const TURN_RATE = 2.2;
const LOOK_SENS = 0.004;
/**
 * What he does when he can see you: 1.1x your top speed.
 *
 * He used to be pinned at exactly half your run (CH / H6), which made being
 * seen survivable by walking away from it.  He is now FASTER than you are, flat
 * out, with no stamina and no corners to lose — which means being seen is not
 * something you outrun, it is something you break line of sight from and then
 * get inside something before he arrives.  Hiding is the only counterplay,
 * which is the game this is supposed to be.
 */
const FROGGY_CHASE = RUN * 2.0;
/**
 * And what he does the rest of the time: 0.8x your top speed.
 *
 * Not a stroll.  He covers ground faster than you can walk and only a little
 * slower than you can run, so the room is never big enough to relax in — the
 * distance between you and him closes whether or not he knows where you are.
 */
const FROGGY_SEARCH = RUN * 1.1;
/**
 * And what he slows to once he has not laid eyes on you for a while.
 *
 * Losing you does not make him give up, it makes him careful: he stops
 * covering ground and starts working the room over, which is both creepier to
 * watch from inside a locker and the thing that gives a player who has just
 * broken his line of sight the seconds they need to get somewhere.
 */
const FROGGY_PROWL = RUN * 0.9;
const LOST_YOU_S = 5;
/**
 * How much faster he is in each room than in the first.  Slightly in the
 * second, noticeably in the third; the player never gets faster, so this is
 * where the difficulty climbs.
 */
const ROOM_PACE = [1, 1.08, 1.18];
/**
 * How long he takes to open a hiding place, by zone.  The lid comes up a
 * little over halfway through, so in the last room you have well under a
 * second between hearing him at the box and being found in it.
 */
const OPEN_S = [1.7, 1.3, 1.0];
/** Crouched: slow, silent, and low enough to lose him behind a sofa. */
const CROUCH = WALK * 0.55;
const EYE = 1.55;
const EYE_CROUCH = 0.8;
const PLAYER_R = 0.42;
/**
 * How big he is in here.
 *
 * At 1x he was a man-sized thing across a large room, and at 1.35 he was
 * merely tall.  At 1.75 he stands 3.6m — more than twice your eye height, with
 * his head near the ceiling in two of the three rooms — and the silhouette
 * stops being a person and starts being the reason you are under the bed.
 *
 * NONE OF THIS CHANGES HOW HE GETS AROUND.  The body that furniture and walls
 * are tested against is a 0.5m circle at his feet (see `solid` and
 * `blockerAt`), and it is deliberately NOT scaled: what grew is a head slung
 * out in front of him and arms hanging past his knees, and those pass over the
 * sofa rather than into it.  Growing the circle with the model would have
 * shrunk every gap the pathfinder thinks it can use, which is exactly how a
 * thing this size ends up wedged in a doorway.
 */
const FROGGY_SCALE = 1.75;
/**
 * And bigger again in the arcade, because the arcade has the height for it.
 *
 * The ward's ceiling is 3.8 and he stands 3.61 under it; this room was built
 * at 4.2 so the last time you see him he can be the biggest he has ever been
 * and still be under a ceiling rather than through it.  1.9 puts his head at
 * 3.92 — a hand's width of air, in a room whose machines come up to his knee.
 */
const FINAL_SCALE = 1.9;
/** How quickly he can turn, radians per second.  Below this he slides. */
const FROGGY_TURN = 5.5;
/** How quickly he gets up to speed and back down, per second. */
const FROGGY_ACCEL = 9;

const VIEW_RANGE = 13;
const VIEW_HALF = Math.PI / 3.6;
/** How long he keeps coming after losing sight of you. */
const MEMORY_S = 4.0;
/**
 * How close he has to be to have you.
 *
 * It follows his reach, but at half the rate he grows: the grab that ends the
 * round is measured hip to hip, and letting it track the whole model would
 * have made all three rooms harder simply because he got taller.  At 1.75 this
 * is 1.58m, a finger's width off what it was at 1.35.
 */
const catchFor = (scale: number): number => 1.15 * (1 + (scale - 1) * 0.5);
const CATCH_DIST = catchFor(FROGGY_SCALE);

const SPOT_REACH = 1.6;
const DOOR_REACH = 2.2;

/**
 * What he says on the other side of the door, word for word, and how long each
 * line holds.  The last one is finished by a noise instead of a sentence.
 */
const BRIEFING: Array<[string, number]> = [
  ["LET'S PLAY ANOTHER GAME!", 2800],
  // The number here is the FIRST zone's clock, filled in below from SEEK_S so
  // the promise he makes at the door cannot drift from the one the game keeps.
  ['IF YOU SURVIVE WITH ME FOR {N} MINUTES,', 3000],
  ['I WILL SET YOU FREE.', 2800],
  // Two beats, because it will not fit the frame as one line.
  ['AND YOU BETTER NOT BE HIDING IN ONE SPOT', 2800],
  ['THE ENTIRE TIME DURING OUR LITTLE GAME.', 2800],
  ['IF NOT....', 2600],
];
/**
 * What he says at the later doors.  Short: you know the rules.  Zone two he
 * is angry about the key; zone three he is barely speaking at all.
 */
const ZONE_LINES: Array<Array<[string, number]>> = [
  [],
  [
    ["YOU THINK I'D LET YOU OFF THAT EASY", 2800],
    ['AFTER YOU TRIED TO STEAL MY KEY?', 3000],
    // He is lengthening it, and he says so.  A zone that quietly got longer
    // would read as the clock being broken rather than as him moving the line.
    ['AND THIS TIME IT IS {N} MINUTES.', 2800],
  ],
  [
    ['WHERE ARE YOU....', 3200],
    ['{N} MINUTES.', 2400],
  ],
  // THE ARCADE.  One line, said over the top of a player who already has the
  // controls back (see beginArcade), and he does not say what the rules are,
  // because in this room there are none of his to say: no count, no clock,
  // nothing he is promising.  He is somewhere in the building looking for you,
  // and the objective on screen is the game's to state, not his.
  [["WHERE IS THAT USELESS BEING...", 3400]],
];

/**
 * The last room is the arcade, and it does not work like the other three.
 *
 * No clock: you are not surviving a number, you are getting out.  The way out
 * is the front door at the far end -- a pair of chained glass ones -- and it
 * takes ten seconds of turning a key you were given for something else.  He
 * hunts the whole time, slower than he did downstairs because the room is the
 * puzzle now and you need long enough in it to solve one.
 */
const FINAL_ROOM = 3;
/** No offset.  Named so the camera reads as one expression either way. */
const ZERO = new THREE.Vector3(0, 0, 0);
/**
 * How much of his search pace he keeps in the arcade.
 *
 * Downstairs he was a shade faster than a running player, which is what made
 * those rooms about not being seen at all.  Here you have to cross his floor,
 * climb his counter and stand still at a door for ten seconds — so he searches
 * at two-thirds, which leaves room to move, watch him, and go.  Sighting you
 * still puts him at full chase speed: the mercy is in the looking, not the
 * catching.
 */
const FINAL_SEARCH_PACE = 0.66;
/**
 * WHETHER HE IS IN THE ARCADE AT ALL.  He is not, for now.
 *
 * The room is the last thing the sequence teaches and the most it asks: read a
 * layout you have only ever seen from above, find that the counter wraps right
 * round the staff corner you came out into, work out that it is climbed rather
 * than walked round, and then stand still at the front doors for ten seconds.
 * A three-and-a-half metre thing hunting you through all of that is a room
 * nobody gets to look at.
 *
 * So the escape is played empty first.  Everything he needs is still here and
 * still tested — the search, the sight lines, the counter he can climb and you
 * can hide behind — and this flag is the only thing between that and him being
 * back in it.  His line still opens the room; he just says it from somewhere
 * else in the building.
 */
const FROGGY_IN_ARCADE = false;
/**
 * Rooms where he speaks but is NOT in the shot.
 *
 * Room two's line is "WHERE ARE YOU...." -- which is a thing said by something
 * that cannot see you, and he was standing nine metres in front of the player
 * saying it, filling the middle of the screen, with the room he was asking
 * about hidden behind him.  The line lands harder from nowhere: the player is
 * alone in a room they cannot yet read, and a voice in it wants to know where
 * they are.
 *
 * He is still placed, still pathing and still hunting the moment the count
 * ends -- he simply starts the round from his own corner instead of from the
 * player's face.
 */
const UNSEEN_BRIEFING = new Set([2]);
/**
 * THE DROP.  How long the key spends going at the lock before it slips.
 *
 * Short on purpose.  The first thing the sequence does is promise the player
 * they are getting out -- the key goes at the lock, it sounds right -- and the
 * promise has to be made and broken inside a couple of seconds, before anybody
 * has settled into watching a progress bar.
 */
const KEY_DROP_S = 2.6;
/** Beats inside the drop, as fractions of it. */
const DROP = {
  /** The key goes up to the lock, and it is going in. */
  toLock: 0.3,
  /** It does not.  It turns over in his fingers and goes. */
  slip: 0.44,
  /** Watching it land, and then looking at where it landed. */
  land: 0.6,
};
/**
 * WHERE IT ENDS UP.  Metres in front of the player and off to one side, on the
 * carpet.  Close enough that it is obviously theirs and obviously reachable,
 * far enough that they have to look down and find it rather than being handed
 * it back.
 */
const KEY_LIES = { ahead: 0.72, aside: -0.34 };
/** How long it is in the air, once it leaves his hand. */
const KEY_FALL_S = 0.62;
/** And how high up it leaves from: the padlock, on the face of the doors. */
const KEY_LOCK_Y = 0.98;
/** How close, and how far down, counts as looking at it. */
const KEY_REACH = 1.7;
const KEY_LOOK = -0.3;
/**
 * ONCE IT IS BACK IN HIS HAND.  The lock takes this long, and it is the last
 * thing that happens in the building.
 */
const CHASE_S = 13.0;
/**
 * THE GRAB.  How long the hand takes to come into frame, close on the key and
 * lift it off the carpet.
 *
 * It sits between the player pressing E and the rest of the ending starting,
 * and nothing else moves during it: the key does not leave the floor until a
 * hand has visibly closed on it, because a key that rises off the carpet by
 * itself is the game picking it up rather than the player.
 */
const GRAB_S = 1.3;
/** Where in the grab the fingers shut on it. */
const GRAB_CLOSE = 0.55;
/**
 * WHERE THE HAND SITS, in view space, for each of the three things it does.
 *
 * These are on the line of sight to what they are reaching for rather than at
 * its distance: a hand 0.55m from the eye at the same ANGLE as the padlock
 * 1.5m away covers it exactly, and is close enough to read as the player's own
 * rather than as somebody standing in the room.
 */
const HAND_OFF = { x: 0.26, y: -0.46, z: -0.6 };
const HAND_KEY = { x: 0.15, y: -0.17, z: -0.58 };
const HAND_LOCK = { x: 0.035, y: -0.028, z: -0.6 };
/**
 * And which way it is turned.  A hand square to the camera is a plate; a
 * three-quarter view down the back of it, tilted in from the right, is a hand.
 */
const HAND_YAW = -0.55;
/** How much of the chase the key spends going into the lock and turning. */
const INSERT_UNTIL = 0.3;
/**
 * WHERE THE WALK BECOMES A RUN.
 *
 * Everything before this is something crossing a dark room behind you at its
 * own pace, getting closer.  Everything after it is that thing having decided.
 * The cut is deliberately not a ramp: a sprint that fades in is a volume
 * slider, and what this wants is the moment the footsteps change character.
 */
const CHARGE_AT = 0.6;
/**
 * How long the key takes to turn in the front doors.
 *
 * A TAP MUST NOT DO ANYTHING.  The whole shape of the ending is standing
 * perfectly still, in the open, at the far end of the room from the counter,
 * facing a pair of glass doors you cannot look away from, for long enough that
 * you have to have decided where he is first.  Ten seconds is long enough for
 * the key to be dropped, found and worked a second time, and short enough that
 * the sequence never stops being one held breath.
 */
const UNLOCK_S = KEY_DROP_S + CHASE_S;
/**
 * Where in the second attempt each tumbler drops.  Unevenly spaced on purpose:
 * an even tick is a progress bar with a sound on it, and this wants to be a
 * lock somebody is fighting.
 */
const TUMBLERS = [0.52, 0.63, 0.71, 0.79, 0.86];
/** Eye height at the bottom of the bend, and while standing. */
const CROUCH_EYE = 0.52;
/**
 * His footsteps behind you: seconds between them at the start of the walk and
 * at the end of it, and then the sprint, which is a different animal.
 *
 * The walk closes from over a second apart to about three a second, which is
 * something big covering ground.  The sprint is five a second and lands twice
 * as hard, and the gap between the last walking step and the first running one
 * is the whole point of the sequence.
 */
const STEP_SLOW = 1.15;
const STEP_FAST = 0.34;
const SPRINT_STEP = 0.19;
/**
 * HOW FAR THE HEAD IS ALLOWED TO GO WHILE THE KEY IS IN THE DOOR.
 *
 * Twenty-four degrees either side of the doors, and not a degree more.  It is
 * enough to glance along the glass, down at your own hands and back -- so the
 * shot is a person at a lock rather than a camera bolted to one -- and it is
 * nowhere near enough to see anything that is not in front of you.  What is
 * behind the player during these ten seconds is the entire point of them, and
 * the game never lets them check.
 */
const ESCAPE_YAW = 0.42;
/**
 * And how far up and down, for the same reason -- and tighter than it looks,
 * because this is a bias ON TOP of the pose the sequence is already holding.
 * The pose spends most of the ten seconds looking down at the lock, and a
 * player leaning on it from there should end up at their own hands, not with
 * the horizon over the top of their head.
 */
const ESCAPE_PITCH = { min: -0.45, max: 0.32 };
/**
 * And how far down while the key is on the carpet.
 *
 * Further than the rest of the sequence allows, because the rest of the
 * sequence never asks the player to find something at their own feet.  It is
 * still a bias on top of the pose, and the pose is already looking downward.
 */
const KEY_PITCH_MIN = -0.9;
/**
 * WHERE THEY STAND TO DO IT, measured back from the face of the doors.
 *
 * A player who walked into the doors is 0.6m off the glass, and at that range
 * a 72-degree camera sees one pane and a white mullion: the pair of doors the
 * whole last act has been about stops being in the shot at the exact moment it
 * matters.  At a metre and a half both leaves, the chain and the padlock are
 * all in frame, and it is also simply what somebody does before working a lock
 * -- square up to it and give their hands room.
 */
const ESCAPE_STAND = 1.5;
/** How long that half-step back takes.  A beat, not a walk. */
const ESCAPE_SETTLE = 0.45;
/**
 * How close to the prize case counts as standing at it: half-width, half-depth.
 *
 * It is the case's own frontage plus a stride, and no more.  The prompt is the
 * game promising that E will do something, and a band three metres deep had it
 * lit from halfway across the floor -- so a player crossing the room to the
 * doors was told, the whole way, that they were standing at a case they were
 * nowhere near.
 */
const CASE_REACH = { hw: 3.4, hd: 2.4 };
/**
 * How far back from the counter the climb is still on offer.
 *
 * It was 2.2, which is most of the way from the desk to the prize case behind
 * it: the two bands overlapped, the climb is tested first, and a player stood
 * at the case to try their key was told to CLIMB OVER instead.  At 1.8 there
 * is still three quarters of a metre of approach either side of a desk you are
 * stopped a metre from, and the case keeps its own frontage to itself.
 */
const COUNTER_REACH = 1.8;
/** How long going over it takes.  Long enough to be a commitment, not a step. */
const VAULT_S = 0.62;
/** How far past the counter you land, so you never come down on top of it. */
const VAULT_CLEAR = 1.7;
/** How long his answer to "if not" is allowed to hang there. */
const BRIEFING_TAIL_MS = 2400;

/**
 * The count he gives you before he comes in.  He says it out loud, so it is a
 * promise the game has made.  See BasementSequence.paintOffer.
 */
const HIDE_S = 10;
/**
 * How long he hunts, by zone: two minutes, then two and a half, then three.
 *
 * The zones already get harder through his pace and how fast he opens a box;
 * the clock is the other half of it, and it is the half the player can feel
 * ticking.  Zone one being the short one is what makes it the one you learn
 * the rules in.  He states the number out loud at every door (BRIEFING and
 * ZONE_LINES take it from here), so it cannot be retuned quietly.
 */
const SEEK_S = [120, 150, 180];

/** His clock for a zone, and the same number in whole minutes for his mouth. */
const seekFor = (zone: number): number => SEEK_S[Math.min(zone, SEEK_S.length - 1)];
const minutesWord = (secs: number): string => {
  const halves = Math.round(secs / 30);
  const whole = Math.floor(halves / 2);
  return halves % 2 ? `${whole} AND A HALF` : `${whole}`;
};
/** Fill {N} in his lines with the zone's own clock. */
const spoken = (lines: Array<[string, number]>, zone: number): Array<[string, number]> =>
  lines.map(([t, ms]) => [t.replace('{N}', minutesWord(seekFor(zone))), ms] as [string, number]);
/** How far his footsteps and the lids carry.  Silence is doing the work. */
const EARSHOT = 22;
const OPEN_EARSHOT = 30;
/** A spot left alone this long is the next one he goes to. */
const STALE_S = 24;
/**
 * The tallest thing he will go over.  Sofas, tables, crates and shelving are
 * all under this; the full-height partitions and the warehouse racking are not,
 * because those are what make the sightlines and a room he can walk through the
 * middle of has no hiding in it.
 */
const CLIMB_MAX_H = 2.9;
/**
 * How fast he goes over something, in metres of obstacle per second.
 *
 * It was 1.5, which put a full second and a half between him reaching a sofa
 * and him being on your side of it — long enough that climbing was a thing you
 * watched rather than a thing that happened to you, and long enough that the
 * furniture was still most of a hiding place after he had decided to cross it.
 * At 3.2 he is over a chest in under half a second.
 */
const CLIMB_SPEED = 3.2;
/** Reaching up before he goes, and gathering himself after.  Beats, not waits. */
const CLIMB_MOUNT_S = 0.17;
const CLIMB_LAND_S = 0.15;
/**
 * How close counts as arriving.  It has to be OUTSIDE the thing he came to
 * check: a spot is solid to him from 1.05m, so the old 0.6m arrival could
 * never be reached and he shouldered the furniture instead of ever opening it.
 */
const ARRIVE_DIST = 1.5;
/**
 * How long a trip gets to make headway before he gives it up, and how little
 * ground in that time counts as none.
 *
 * A waypoint on the far side of a partition he cannot climb used to leave him
 * shouldering the wall for the rest of the round: the outer walls were not
 * solid to his steering, only to the clamp that ran after it, so every frame
 * looked like a clean step that the clamp then quietly undid.  Now the walls
 * block like furniture does, and a trip that is not getting anywhere is
 * abandoned for a different spot rather than pushed at.
 */
const HEADWAY_S = 1.5;
const HEADWAY_DIST = 1.0;

/**
 * What he hears.  A run carries across most of a room.  A walk and a crouch
 * he does not hear at all — walking is the quiet choice, and slow for it.
 * Hearing gives him somewhere to look, not you.
 */
const HEAR_RUN = 18;
/**
 * The floor.
 *
 * Roughly one step in eight puts your weight on a board that gives, and it
 * carries a good way further than your footsteps do.  It is a chance rather
 * than a rule so that moving is a gamble instead of a countdown: most crossings
 * are silent, and the one that is not is the one you remember.
 */
const CREAK_CHANCE = 0.13;
const CREAK_HEARD_FROM = 17;
/**
 * How wrong he is about where the noise came from.  He heard a room, not a
 * person: the point he walks to is metres off, and he still has to look.
 */
const CREAK_SLOP = 2.6;
/** How long he pokes around the spot before giving it up. */
const INVESTIGATE_S = 7;

/**
 * `briefing` is the rules, said out loud, before anything starts.
 *
 * It happens HERE rather than in the basement because it belongs to the round:
 * you open the door, he is waiting on the other side of it, and he tells you
 * what the next few minutes are.  You cannot move during it — there is
 * nothing to do yet and letting the player wander while he talks turns a
 * threat into a cutscene they walked out of.
 */
type Mode = 'briefing' | 'hiding' | 'seeking' | 'caught' | 'survived';
/**
 * What he is doing, and the difference between two of these is the whole game.
 *
 *   search / listen / openSpot   he has no idea where you are
 *   investigate                  he HEARD something and is going to look
 *   suspicious                   he saw you a moment ago and lost you
 *   chase                        he can see you right now
 *
 * `investigate` is not hunting.  A noise gives him a place to walk to and
 * nothing else — no direction to face, no idea what made it, and no claim on
 * where you actually are.  Only `sees()` promotes him to `chase`, so a player
 * who makes a floorboard go and then keeps still behind something can still be
 * missed, which is the tension the noise is for.
 */
type FroggyMode = 'search' | 'listen' | 'openSpot' | 'investigate' | 'chase' | 'suspicious';

/**
 * As big as a line can be drawn and still fit the frame: 2x for short
 * prompts, less for a long subtitle.  The overlay is device resolution, so
 * a fractional scale stays sharp.
 */
function fitScale(s: string): number {
  return Math.max(1, Math.min(2, (GAME_W - 24) / (s.length * 6)));
}

interface Spot3D {
  x: number;
  z: number;
  kind: SpotKind;
  /** Half extents of its footprint, world axes. */
  hw: number;
  hd: number;
  /** Opened on the current sweep already.  See pickWaypoint. */
  checkedOn: number;
  /** The hinge: a chest lid tips back, a door swings sideways. */
  hinge: THREE.Object3D;
  /** 0 shut, 1 fully open. */
  open: number;
  opening: boolean;
  /** Seconds since he last looked inside this one. */
  sinceChecked: number;
}

export class HideRoom3D extends Phaser.Scene {
  private stage: ThreeStage | null = null;
  private def!: RoomDef;
  private roomIndex = 0;

  private yaw = 0;
  /**
   * Up and down.
   *
   * The view was yaw only, which was survivable in four rooms where everything
   * worth seeing is at eye height -- and impossible the moment there is a sheet
   * of glass under your feet with something standing under it.  Dragging the
   * mouse up and down pitches, clamped short of straight up and straight down
   * so the horizon never rolls over.
   */
  private pitch = 0;
  private pos = new THREE.Vector2();
  private mode: Mode = 'hiding';
  /** Counts down through the hiding phase, then through his hunt. */
  private clock = 0;
  /** Which line of the briefing he is on, before any of it starts. */
  private briefLine = 0;

  private froggy = new THREE.Vector2();
  private froggyYaw = 0;
  private fMode: FroggyMode = 'search';
  private fTimer = 0;
  private memory = 0;
  private lastSeen = new THREE.Vector2();
  private waypoint = new THREE.Vector2();
  private targetSpot: Spot3D | null = null;
  private monster: FroggyMonster | null = null;
  /** How many meshes he is made of.  See buildRoom. */
  private froggyMeshes = 0;
  /**
   * Set while he is going over something: nothing blocks him until it ends.
   * Three beats — mount (he reaches up and stops), cross (he goes over), land
   * (he drops and gathers himself) — so it reads as a climb, not a hop.
   */
  private climb: {
    from: THREE.Vector2;
    to: THREE.Vector2;
    top: number;
    t: number;
    dur: number;
    mount: number;
    land: number;
  } | null = null;
  /** His map of the room, and the route he is on.  See navGrid. */
  private grid: NavGrid | null = null;
  private path: Array<[number, number]> = [];
  private pathFor = new THREE.Vector2(NaN, NaN);
  private pathAge = 0;
  private repathFails = 0;
  /** Eased: he accelerates and turns rather than snapping. */
  private fSpeed = 0;
  private wantYaw = 0;
  /** Toggled with C.  Low, slow, quiet, and it stays on until you say so. */
  private crouching = false;
  private eyeNow = EYE;
  /** Which pass over the hiding places he is on.  Every spot gets opened once per pass. */
  private sweep = 0;
  /** Distance he has walked since his last step sound. */
  private fStep = 0;
  /** Where he stood last frame, so the walk animates off real movement. */
  private froggyWas = new THREE.Vector2();
  /** Seconds since he last had you in view.  Past LOST_YOU_S he slows down. */
  private unseenT = 0;
  /** What is left of his patience with a noise he heard. */
  private investigateT = 0;
  /** Seconds until the next drip.  The room is quiet, not dead. */
  private dripIn = 0;
  /**
   * Everything the room has made a noise doing, newest last.  The round is
   * played by ear — his feet and the lids are the whole information channel —
   * so what was audible, and how loud, is behaviour worth being able to read
   * back.  DEV telemetry publishes it.
   */
  private heard: Array<{ name: string; gain: number }> = [];

  private spots: Spot3D[] = [];
  private blockers: Box[] = [];
  private hiding: Spot3D | null = null;

  private caughtT = 0;
  private endT = 0;
  private bob = 0;
  private stepT = 0;
  private shake = 0;
  private prompt = '';
  /** Seconds of uninterrupted hold on the staff door, 0..UNLOCK_S. */
  private unlockT = 0;
  /** How many of TUMBLERS have already been heard this turn. */
  private tumbler = 0;
  /**
   * The escape, once it has started.  Seconds until the door is open, counting
   * UP to UNLOCK_S -- and once it is running nothing stops it: no key to keep
   * held, no walking away, no cancelling.  The one decision the player makes
   * is when to start it, and everything after that is watching their own hands
   * and listening to what is crossing the room.
   */
  private escaping = false;
  /** Seconds until his next footstep behind you, and which ear it lands in. */
  private stepIn = 0;
  private stepSide = 1;
  /** A running, irregular wobble, so the tremble is not two clean sines. */
  private trembleSeed = 0;
  /**
   * Going over the counter: where from, where to, and how far through it we
   * are.  Non-null means the player is committed — no steering, no stopping,
   * and the camera rides up over the top and down the other side.
   */
  private vault: { from: THREE.Vector2; to: THREE.Vector2; t: number } | null = null;
  /**
   * The half-step back at the start of the escape: where they were, and the
   * mark in front of the doors they settle onto.  Null once they are on it.
   */
  private escapeFrom = new THREE.Vector2();
  private escapeMark: THREE.Vector2 | null = null;
  /**
   * THE KEY, ONCE HE HAS DROPPED IT.
   *
   * `keyOnFloor` means it is lying there and the sequence is WAITING: no clock
   * is running, nothing is approaching, and the only thing that moves the
   * ending on is the player finding it and pressing E.  `keyTaken` starts
   * everything that comes after.
   */
  private keyOnFloor = false;
  private keyTaken = false;
  private keyAt = new THREE.Vector2();
  private keyProp: THREE.Object3D | null = null;
  /**
   * THE FALL ITSELF.
   *
   * Where it left his hand at the lock, where it is going to land, and how far
   * through the drop it is.  It exists so the key is SEEN to come off the
   * door: it used to be placed on the carpet the instant the beat ended, which
   * from the player's side is a key that was never in his hand at all.
   */
  private keyFall: { from: THREE.Vector3; to: THREE.Vector3; t: number; spin: number } | null = null;
  /** Seconds into the drop, and then into what follows it. */
  private dropT = 0;
  private chaseT = 0;
  /**
   * THE HAND, and how far through picking the key up it is.
   *
   * `grabT` counts the grab; while it is running the sequence is paused on
   * purpose — the footsteps have not started, nothing is approaching, and the
   * only thing happening is a hand closing on a key.
   */
  private handProp: THREE.Object3D | null = null;
  private grabbing = false;
  private grabT = 0;
  /** The padlock's shackle, so it can come open when the key turns. */
  private shackle: THREE.Object3D | null = null;
  /** True once the walk behind you has become a run.  Once only. */
  private charging = false;
  /** Whether the counter has been crossed at all, for the harness. */
  private vaulted = false;
  /**
   * The room behind the wall, and whether the player is in it.
   *
   * `inSecret` is the single safety switch: while it is true nothing in the
   * hunt can reach the player.  He is not paused for it -- he goes on searching
   * the room you left, which is most of the point -- he simply cannot see,
   * hear, path to or catch somebody who is not in his building any more.
   */
  private secret: SecretRoom | null = null;
  private inSecret = false;
  /** Floor height under the player.  Only the secret room has more than one. */
  private floorY = 0;
  /** The button has been pressed and the fade is running.  Once only. */
  private leaving = false;
  /**
   * The hide room's own lamps, including the torch.
   *
   * ONLY ONE ROOM IS LIT AT A TIME.  Both spaces live in the same scene, and
   * three evaluates every visible light against every fragment -- so leaving
   * both sets burning halved the frame rate, and at under twenty frames a
   * second `threeStage`'s dt clamp makes the game's own clock run slow.
   */
  private roomLights: THREE.Light[] = [];
  /**
   * The player's own torch.
   *
   * It is turned most of the way down for the escape: at arm's length from a
   * door, a 110-candela spot at a thirty degree cone is a white disc and the
   * door stops being a door.  Down at a quarter it lights the lock and the
   * hands and leaves the rest of the room to the dark, which is where it
   * belongs while something is crossing it.
   */
  private torch: THREE.SpotLight | null = null;
  private subtitle = '';
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  /** True while the left mouse button is down: dragging the view around. */
  private looking = false;
  /** Last cursor position, for working out the drag by hand. */
  private lookX = 0;
  private lookY = 0;
  private onMove: ((e: MouseEvent) => void) | null = null;
  private onDown: ((e: MouseEvent) => void) | null = null;
  private onUp: (() => void) | null = null;
  private frames = 0;
  private grace = 0;
  private stuckT = 0;
  /** Walking time on the current trip, and how far from its waypoint he was when last measured. */
  private headwayT = 0;
  private headwayDist = 0;

  constructor() {
    super('HideRoom3D');
  }

  create(): void {
    this.roomIndex = Phaser.Math.Clamp(store.get().hideRoom, 0, ROOMS.length - 1);
    this.def = ROOMS[this.roomIndex];

    // Reset every mutable field: Phaser reuses the instance across restarts.
    this.mode = 'briefing';
    this.clock = HIDE_S;
    this.briefLine = 0;
    this.caughtT = 0;
    this.endT = 0;
    this.hiding = null;
    this.spots = [];
    this.blockers = [];
    this.fMode = 'search';
    this.fTimer = 0;
    this.fStep = 0;
    this.climb = null;
    this.froggyMeshes = 0;
    this.dripIn = 6;
    this.heard = [];
    this.unseenT = 0;
    this.investigateT = 0;
    this.memory = 0;
    this.shake = 0;
    this.stuckT = 0;
    this.prompt = '';
    this.subtitle = '';
    this.unlockT = 0;
    this.tumbler = 0;
    this.escaping = false;
    this.stepIn = 0;
    this.trembleSeed = 0;
    this.vault = null;
    this.vaulted = false;
    this.escapeMark = null;
    this.keyOnFloor = false;
    this.keyTaken = false;
    this.keyProp = null;
    this.keyFall = null;
    this.handProp = null;
    this.shackle = null;
    this.grabbing = false;
    this.grabT = 0;
    this.dropT = 0;
    this.chaseT = 0;
    this.charging = false;
    this.secret = null;
    this.inSecret = false;
    this.floorY = 0;
    this.leaving = false;
    this.roomLights = [];
    this.torch = null;
    this.path = [];
    this.pathFor.set(NaN, NaN);
    this.pathAge = 0;
    this.repathFails = 0;
    this.fSpeed = 0;
    this.crouching = false;
    this.eyeNow = EYE;
    this.sweep = 0;
    this.grace = 0;

    froggyLayer.clear();
    this.cameras.main.setBackgroundColor(0x000000);
    // The rooms are silent apart from him.  That is what makes footsteps work.
    audio.setScene(SILENCE);

    this.pos.set(this.def.spawn.x, this.def.spawn.z);
    // yaw 0 looks down -Z: into the room, with the door you came through
    // behind you.  The arcade is entered through its BACK wall, so it asks for
    // the half turn — otherwise the first frame of the last room in the game
    // is a wall two metres away.
    this.yaw = this.def.spawnYaw ?? 0;
    this.pitch = 0;
    // He is outside for the count.  He walks in when it runs out.
    this.froggy.set(this.def.froggyStart.x, this.def.froggyStart.z);
    this.froggyWas.copy(this.froggy);

    this.stage = new ThreeStage();
    const root = document.getElementById('game-root');
    if (root) this.stage.mount(root, this.game.canvas);
    this.buildRoom();
    this.grid = buildGrid(this.def, CLIMB_MAX_H);
    this.stage.start((dt) => this.tick(dt));

    this.bindInput();
    // He explains the game once, at the first door.  The second and third
    // rooms open straight onto the count: you know the rules by then, and a
    // speech you have heard is a wait, not a threat.
    //
    // THE ARCADE DOES NOT GET A BRIEFING AT ALL.  See beginArcade: the player
    // has just come up out of the third room and lands behind the counter with
    // the controls already live, because a scene that takes them away again
    // the instant it hands the arcade over reads as another cutscene rather
    // than as being back on the floor.
    if (this.isFinal) {
      this.beginArcade();
    } else {
      const lines = this.roomIndex === 0 ? BRIEFING : ZONE_LINES[Math.min(this.roomIndex, ZONE_LINES.length - 1)];
      this.beginBriefing(spoken(lines, this.roomIndex));
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  // ------------------------------------------------------------------- build

  private buildRoom(): void {
    const st = this.stage!;
    const d = this.def;
    st.scene.background = new THREE.Color(0x05060a);
    st.scene.fog = new THREE.FogExp2(0x05060a, 0.032);
    const amb = new THREE.AmbientLight(0x45444a, 1.05);
    st.scene.add(amb);
    this.roomLights.push(amb);

    for (const l of d.lights) {
      // Reach has to scale with the room.  At 16m in a 36m lounge the bulbs lit
      // a puddle each and the rest was the torch and nothing.
      const bulb = new THREE.PointLight(l.color, l.intensity, 26, 1.3);
      this.roomLights.push(bulb);
      bulb.position.set(l.x, d.wallH - 0.5, l.z);
      st.scene.add(bulb);
      const shade = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 0.34, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x1a1410, side: THREE.DoubleSide }),
      );
      shade.position.set(l.x, d.wallH - 0.3, l.z);
      st.scene.add(shade);
    }

    // a torch of your own, so the far corners are not free information
    const torch = new THREE.SpotLight(0xfff0c9, 110, 18, THREE.MathUtils.degToRad(30), 0.55, 1.1);
    this.roomLights.push(torch);
    this.torch = torch;
    torch.position.set(0, 0, 0.2);
    torch.target.position.set(0, 0, -1);
    st.camera.add(torch);
    st.camera.add(torch.target);
    st.scene.add(st.camera);

    // Painted surfaces: see hideDecor.  Each is drawn from the room's base
    // colour so the palette the designer picked is still the palette.
    const seed = this.roomIndex + 1;
    const floorMat = new THREE.MeshLambertMaterial({
      map: surfaceTexture(d.theme, 'floor', d.floor, seed, d.halfW * 2, d.halfD * 2),
    });
    const wallMatX = new THREE.MeshLambertMaterial({
      map: surfaceTexture(d.theme, 'wall', d.wall, seed, d.halfW * 2, d.wallH),
    });
    const wallMatZ = new THREE.MeshLambertMaterial({
      map: surfaceTexture(d.theme, 'wall', d.wall, seed, d.halfD * 2, d.wallH),
    });
    const ceilMat = new THREE.MeshLambertMaterial({
      map: surfaceTexture(d.theme, 'ceiling', d.ceiling, seed, d.halfW * 2, d.halfD * 2),
    });
    // Furniture is tinted flat colour under a shared wear texture.
    const grunge = surfaceTexture(d.theme, 'grunge', 0xffffff, seed, 3, 3);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(d.halfW * 2, d.halfD * 2), floorMat);
    floor.rotation.x = -Math.PI / 2;
    st.scene.add(floor);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(d.halfW * 2, d.halfD * 2), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = d.wallH;
    st.scene.add(ceil);

    const wall = (x: number, z: number, w: number, dp: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, d.wallH, dp), w > dp ? wallMatX : wallMatZ);
      m.position.set(x, d.wallH / 2, z);
      st.scene.add(m);
    };
    wall(0, -d.halfD - 0.25, d.halfW * 2 + 1, 0.5);
    wall(0, d.halfD + 0.25, d.halfW * 2 + 1, 0.5);
    // The side walls go up in one piece each, EXCEPT where a decorative
    // opening is cut into one: there it goes up in two, with a gap left
    // between them.  A dark panel laid flat on an unbroken wall reads as a
    // stain, not as a way through; the eye needs the wall to actually stop.
    const openSide = d.wallOpening;
    for (const sx of [-1, 1] as const) {
      const wx = sx * (d.halfW + 0.25);
      const side = sx < 0 ? 'left' : 'right';
      if (!openSide || openSide.side !== side) {
        wall(wx, 0, 0.5, d.halfD * 2 + 1);
        continue;
      }
      const lo = -d.halfD - 0.5;
      const hi = d.halfD + 0.5;
      const gapA = openSide.z - openSide.w / 2;
      const gapB = openSide.z + openSide.w / 2;
      wall(wx, (lo + gapA) / 2, 0.5, gapA - lo);
      wall(wx, (gapB + hi) / 2, 0.5, hi - gapB);
      // and a lintel across the top of the gap, so the hole has a height
      wall(wx, openSide.z, 0.5, openSide.w);
      const lintelFix = st.scene.children[st.scene.children.length - 1] as THREE.Mesh;
      lintelFix.scale.y = (d.wallH - openSide.h) / d.wallH;
      lintelFix.position.y = openSide.h + (d.wallH - openSide.h) / 2;
    }

    // ---- THE WAY OUT, set into the far wall.
    //
    // Downstairs it is a painted slab he locks behind you and it is scenery.
    // In the arcade it is the main entrance, in glass, chained shut — and it
    // is the objective, so it is built rather than blocked out.  See
    // buildGlassDoors.
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x53331f });
    if (d.glassDoor) {
      const gd = d.glassDoor;
      // Stood off the wall far enough to have a night behind it.  A pane with
      // the room's own purple wall a centimetre behind it is a purple panel;
      // what makes glass read as glass is that the thing through it is a
      // different colour from everything else in the picture.
      const doorZ = d.halfD - 0.38;
      const doors = buildGlassDoors(gd.w, gd.h);
      doors.position.set(d.door.x, 0, doorZ);
      st.scene.add(doors);
      this.shackle = doors.getObjectByName('padlockShackle') ?? null;
      // AND THEY ARE SOLID.  The room's own clamp stops the player 0.6m short
      // of the wall plane, which is INSIDE a door that stands off it — so the
      // doors get a collider of their own and the player is held half a metre
      // in front of the glass, which is where somebody working a lock stands.
      this.blockers.push({
        x: d.door.x,
        z: doorZ,
        w: gd.w,
        d: 0.5,
        h: gd.h,
        color: 0x0a0d14,
      });
      // THE STREET.  Unlit black-blue, so no lamp in here can wash it out and
      // it stays the one cold hole in a room made of purple and carpet.
      const street = new THREE.Mesh(
        new THREE.BoxGeometry(gd.w + 0.2, gd.h + 0.2, 0.08),
        new THREE.MeshBasicMaterial({ color: 0x080d16 }),
      );
      street.position.set(d.door.x, gd.h / 2, d.halfD - 0.14);
      st.scene.add(street);
      // and one lamp out there, BEHIND the doors, so what it does is rim the
      // frame and glow through the glass rather than flatten the front of it
      const outside = new THREE.PointLight(0x9fd4ff, 4, 5, 1.8);
      outside.position.set(d.door.x, gd.h * 0.55, d.halfD - 0.2);
      st.scene.add(outside);
      this.roomLights.push(outside);
    } else {
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.2), doorMat);
      door.position.set(d.door.x, 1.2, d.halfD - 0.05);
      st.scene.add(door);
      const handle = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xc9a62e }),
      );
      handle.position.set(d.door.x + 0.55, 1.15, d.halfD - 0.18);
      st.scene.add(handle);
    }

    // The door you came IN through, in the wall behind the spawn.  It is not
    // interactive and it never opens again; it is there so that turning round
    // answers "where am I" without a line of dialogue, and so the front door
    // at the other end reads as the other one.
    // The door the player walks out of, and the only part of the back wall they
    // are ever stood next to.  A brown box with a ball on it read as a cupboard
    // from a metre away, which is the one distance it is always seen from.
    if (d.staffDoor) {
      const back = buildStaffDoor(1.6, 2.4, grunge);
      back.position.set(d.staffDoor.x, 0, -d.halfD + 0.05);
      st.scene.add(back);
    }

    for (const f of d.furniture) {
      // A few things in the arcade are built rather than blocked out.  The
      // collision box is the same either way: the prop is fitted into the box
      // it replaces, so nothing about where you can walk or what he can see
      // over depends on how nicely a thing is modelled.
      if (f.prop) {
        const turned = Math.abs(Math.cos(f.face ?? 0)) < 0.5;
        // Facing along x means its width runs down z, so the two extents swap
        // before they go to a builder that always works front-to-back in +Z.
        const bw = turned ? f.d : f.w;
        const bd = turned ? f.w : f.d;
        const g =
          f.prop === 'cabinet'
            ? buildCabinet(bw, f.h, bd, f.color, grunge)
            : f.prop === 'counter'
              ? buildCounter(bw, f.h, bd, f.color, grunge)
              : f.prop === 'change'
                ? buildChangeMachine(bw, f.h, bd, grunge)
                : buildPrizeCase(bw, f.h, bd, grunge);
        g.position.set(f.x, 0, f.z);
        g.rotation.y = f.face ?? 0;
        st.scene.add(g);
        this.blockers.push(f);
        continue;
      }

      // Full-height partitions are walls and look like the walls; the rest is
      // furniture, worn.
      const isWall = f.h >= d.wallH - 0.05;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(f.w, f.h, f.d),
        isWall
          ? new THREE.MeshLambertMaterial({ map: surfaceTexture(d.theme, 'wall', f.color, seed + 3, Math.max(f.w, f.d), f.h) })
          : new THREE.MeshLambertMaterial({ color: f.color, map: grunge }),
      );
      mesh.position.set(f.x, f.h / 2, f.z);
      st.scene.add(mesh);
      this.blockers.push(f);
    }

    for (const c of d.spots) this.spots.push(this.buildSpot(c.x, c.z, c.rot, c.kind));

    // The dirt, the litter, the damp.  Placed off anything solid.
    dressRoom(st.scene, d, seed, (x, z) => this.solid(x, z, 0.3));

    // THE WAY THROUGH TO THE BACK ROOM, WHICH ISN'T ONE.
    //
    // A recess cut into the side wall with a lit frame round it, so from the
    // floor it reads as an opening you could walk into.  It is bricked up a
    // foot behind the frame, and the room's own clamp stops you a good half
    // metre short of the wall plane in the first place -- so there are two
    // independent reasons the player never gets through it, and neither of
    // them is a hole in the collision that could be found somewhere else.
    if (d.wallOpening) {
      const w = d.wallOpening;
      const sx = w.side === 'left' ? -1 : 1;
      const wallX = sx * d.halfW;
      // A short passage behind the gap, going away from the room and ending in
      // a wall.  It has depth, so from an angle you see the inside of it and
      // it reads as somewhere rather than as a painted rectangle -- and there
      // is nothing in it, because there is nothing to find.
      // Near black, and unlit by anything in the room: what the eye should get
      // through the frame is depth it cannot measure, not a grey panel it can.
      const passage = new THREE.Mesh(
        new THREE.BoxGeometry(3.0, w.h, w.w),
        new THREE.MeshLambertMaterial({ color: 0x090c14 }),
      );
      passage.position.set(wallX + sx * 1.5, w.h / 2, w.z);
      st.scene.add(passage);
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, w.h, w.w + 0.6),
        new THREE.MeshLambertMaterial({ color: 0x0b0e15 }),
      );
      back.position.set(wallX + sx * 3.1, w.h / 2, w.z);
      st.scene.add(back);
      // The frame, standing proud of the wall on the ROOM side, lit: the one
      // thing down that wall with any colour in it, and what makes the eye
      // read the gap as a doorway rather than as a missing panel.
      for (const off of [-1, 1]) {
        const jamb = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, w.h + 0.2, 0.26),
          new THREE.MeshBasicMaterial({ color: 0x2f8f9f }),
        );
        jamb.position.set(wallX + sx * -0.2, (w.h + 0.2) / 2, w.z + off * (w.w / 2 + 0.13));
        st.scene.add(jamb);
      }
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.24, w.w + 0.52),
        new THREE.MeshBasicMaterial({ color: 0x2f8f9f }),
      );
      head.position.set(wallX + sx * -0.2, w.h + 0.1, w.z);
      st.scene.add(head);
      // ---- THE LIGHT ON IT, AND HOW LITTLE OF IT THERE IS.
      //
      // A six-candela lamp a metre off the frame washed the whole corner teal
      // and turned the one unlit thing in the room into the best lit.  It is
      // down to a third of that and pulled back INTO the recess, so what
      // reaches the floor is a rim on the jambs and nothing else: the doorway
      // is legible as a doorway and the two metres in front of it are as dark
      // as the room gets, which is the point of having it there at all.
      const spill = new THREE.PointLight(0x46c4bd, 2, 5.5, 2.2);
      spill.position.set(wallX + sx * 0.35, w.h * 0.62, w.z);
      st.scene.add(spill);
      this.roomLights.push(spill);
      // AND IT IS SHUT.  A collider filling the gap, so the one place the wall
      // has a hole in it is the one place the player is stopped by something
      // other than the wall.  The room's own clamp already holds them half a
      // metre short; this is the reason that stays true if the clamp changes.
      this.blockers.push({
        x: wallX + sx * 0.45,
        z: w.z,
        w: 1.0,
        d: w.w + 0.4,
        h: w.h,
        color: 0x0a0d14,
      });
    }

    // The room behind the wall, built six hundred metres away so that nothing
    // in the hunt -- no waypoint, no earshot test, no path probe -- can reach
    // it by arithmetic.  It costs a few dozen meshes the player will probably
    // never see, and the alternative is building it on entry, which would put
    // a stall exactly where the surprise is.
    if (d.secretDoor) this.secret = buildSecretRoom(st.scene, d);
    this.secret?.setActive(false);

    // Froggy himself: a real model, the same one the alley uses, so the thing
    // opening the lockers and the thing in the alley are one creature.  Hidden
    // for the count — the first fifteen seconds are yours, and nothing should
    // loom through them.
    // ...unless this is the arcade, where he is not in the room at all: no
    // model, nothing to position, nothing to animate.  See FROGGY_IN_ARCADE.
    if (!this.hunted) return;
    this.monster = new FroggyMonster(this.isFinal ? FINAL_SCALE : FROGGY_SCALE);
    this.monster.setVisible(false);
    st.scene.add(this.monster.root);
    // A fingerprint of the model, published for the harness: the alley reports
    // the same number, and that is how "it is still the same creature over
    // there" stops being a thing anyone has to remember to check by eye.
    this.monster.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) this.froggyMeshes++;
    });
  }

  /**
   * A thing you can get inside.  Three shapes, one contract: a body you cannot
   * walk through and a hinge that swings when he checks it.  The chest tips its
   * lid back; the cupboard and the locker swing a door, which is also why they
   * read differently across a dark room.
   */
  private buildSpot(x: number, z: number, rot: number, kind: SpotKind): Spot3D {
    const st = this.stage!;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rot;

    const hinge = new THREE.Group();

    if (kind === 'bed') {
      // A bed frame on legs with a gap under it you can get into.  The
      // blanket is the hinge: he checks a bed by throwing it back.
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 0.16, 1.1),
        new THREE.MeshLambertMaterial({ color: 0x6b6f6b }),
      );
      frame.position.y = 0.5;
      group.add(frame);
      for (const [lx, lz] of [[-1.05, -0.45], [1.05, -0.45], [-1.05, 0.45], [1.05, 0.45]]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.5, 0.08),
          new THREE.MeshLambertMaterial({ color: 0x4a4d4a }),
        );
        leg.position.set(lx, 0.25, lz);
        group.add(leg);
      }
      const mattress = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.22, 1.0),
        new THREE.MeshLambertMaterial({ color: 0x8a8272 }),
      );
      mattress.position.y = 0.69;
      group.add(mattress);
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.9, 1.1),
        new THREE.MeshLambertMaterial({ color: 0x4a4d4a }),
      );
      head.position.set(-1.12, 0.6, 0);
      group.add(head);
      // the blanket, hinged along the far edge
      hinge.position.set(0, 0.82, -0.5);
      const blanket = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.08, 1.0),
        new THREE.MeshLambertMaterial({ color: 0x3f4a5a }),
      );
      blanket.position.z = 0.5;
      hinge.add(blanket);
    } else if (kind === 'chest') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.7, 0.8),
        new THREE.MeshLambertMaterial({ color: 0x4a3520 }),
      );
      body.position.y = 0.35;
      group.add(body);

      // The lid is its own pivot so it can swing rather than slide.
      hinge.position.set(0, 0.7, -0.4);
      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.14, 0.8),
        new THREE.MeshLambertMaterial({ color: 0x5c4326 }),
      );
      lid.position.z = 0.4;
      hinge.add(lid);
    } else {
      const locker = kind === 'locker';
      const h = locker ? 2.0 : 1.8;
      const w = locker ? 0.9 : 1.2;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, 0.75),
        new THREE.MeshLambertMaterial({ color: locker ? 0x3d4652 : 0x4a3520 }),
      );
      body.position.y = h / 2;
      group.add(body);

      // The door hangs off the left edge and swings out towards you.
      hinge.position.set(-w / 2, h / 2, 0.38);
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(w, h - 0.12, 0.09),
        new THREE.MeshLambertMaterial({ color: locker ? 0x4d5866 : 0x5c4326 }),
      );
      door.position.x = w / 2;
      hinge.add(door);
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.26, 0.07),
        new THREE.MeshBasicMaterial({ color: 0x9a8a5c }),
      );
      handle.position.set(w - 0.14, 0, 0.08);
      hinge.add(handle);
      if (locker) {
        // Vents.  They are the reason a locker reads as a locker at 20 metres.
        for (let i = 0; i < 3; i++) {
          const slat = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.6, 0.05, 0.02),
            new THREE.MeshBasicMaterial({ color: 0x232a33 }),
          );
          slat.position.set(w / 2, h * 0.32 - i * 0.12, 0.06);
          hinge.add(slat);
        }
      }
    }

    group.add(hinge);
    st.scene.add(group);
    const ext = spotExtent({ x, z, rot, kind });
    return { x, z, kind, hw: ext.hw, hd: ext.hd, checkedOn: -1, hinge, open: 0, opening: false, sinceChecked: 0 };
  }

  // ------------------------------------------------------------------- input

  /**
   * Controls.  W forward, S back, A left, D right, always — no mode where the
   * keys mean something else.  Hold the left mouse button and drag to turn.
   *
   * This used to demand pointer lock for mouse look and, without it, quietly
   * turned A and D into a steering wheel.  In a room where the whole game is
   * getting from one box to another before he reaches it, a key that sometimes
   * strafes and sometimes rotates you is the difference between escaping and
   * walking into a wall.  Arrow left/right still turn, so the round is
   * playable with no mouse at all.
   */
  private bindInput(): void {
    const kb = this.input.keyboard;
    const bind = (names: readonly string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    this.keys = {
      fwd: bind(['W', 'UP']),
      back: bind(['S', 'DOWN']),
      left: bind(['A']),
      right: bind(['D']),
      turnL: bind(['LEFT', 'Q']),
      turnR: bind(['RIGHT']),
      run: bind(['SHIFT']),
      // E is both a press and a hold: a press gets you into a box, and a press
      // at the front doors turns a key in them.  It needs a Key object anyway,
      // because `keydown-E` repeats and cannot tell a held key from fifty
      // keyboard auto-repeats.
      use: bind(['E']),
    };
    kb?.on('keydown-E', () => this.interact());
    // Crouch is a TOGGLE on C, not a key you hold.  You crouch to cross a room
    // slowly and quietly, which can be most of a minute, and holding a key for
    // a minute with the other hand on WASD and the mouse is a hand cramp, not
    // a decision.  CTRL is gone with the holding: the browser owns CTRL+W, and
    // crouch-walking forward should never close the tab.
    kb?.on('keydown-C', () => this.toggleCrouch());

    // Window-level, not Phaser-level: the Three canvas is layered over the
    // Phaser one, so the scene's own pointer events never see the room.
    this.onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      this.looking = true;
      this.lookX = e.clientX;
      this.lookY = e.clientY;
      // Otherwise the drag selects the page furniture behind the canvas.
      e.preventDefault();
    };
    this.onMove = (e: MouseEvent) => {
      if (!this.looking) return;
      // Prefer the browser's own delta, fall back to tracking the cursor: some
      // browsers leave movementX at 0 outside pointer lock.
      const dx = e.movementX || e.clientX - this.lookX;
      const dy = e.movementY || e.clientY - this.lookY;
      this.lookX = e.clientX;
      this.lookY = e.clientY;
      this.yaw -= dx * LOOK_SENS;
      // Clamped well short of vertical: past about sixty degrees the room
      // stops having a floor and the player loses which way they are facing.
      this.pitch = Phaser.Math.Clamp(this.pitch - dy * LOOK_SENS, -1.15, 1.0);
      // AND HELD ON THE DOORS while the key is in them.  See holdOnDoor: the
      // clamp is applied here so the drag itself cannot overshoot, and again
      // every frame so no other way of turning gets round it.
      this.holdOnDoor();
    };
    this.onUp = () => {
      this.looking = false;
    };
    window.addEventListener('mousedown', this.onDown);
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('mouseup', this.onUp);
    // Letting go outside the window, or alt-tabbing mid-drag, must not leave
    // the view stuck to the mouse.
    window.addEventListener('blur', this.onUp);
  }

  private held(g: string): boolean {
    return this.keys[g]?.some((k) => k.isDown) ?? false;
  }

  /**
   * Down, or up.  It sticks either way — the eye height tweens to it, the
   * footsteps go silent at it, and it survives being let go of, because the
   * thing it is for is the long quiet walk across a room he is standing in.
   *
   * No effect from inside a box: you are already as low as you get in there,
   * and toggling it would only change what you see when you climb out.
   */
  private toggleCrouch(): void {
    if (this.mode !== 'hiding' && this.mode !== 'seeking') return;
    // Not while the key is in the door: the sequence owns the eye height for
    // the whole ten seconds, and a crouch toggled under it fights the pose.
    if (this.hiding || this.escaping) return;
    this.crouching = !this.crouching;
  }

  private interact(): void {
    if (this.mode !== 'hiding' && this.mode !== 'seeking') return;

    // Once the key is in the door, the only thing E is still good for is the
    // one moment the sequence hands back: the key on the carpet.  Nothing else
    // in it can be restarted, hurried or pressed through.
    if (this.escaping) {
      if (this.atKey()) this.takeKey();
      return;
    }

    // Inside the wall there is exactly one thing to press, and nothing else in
    // here answers to E: no spots, no doors, no case.
    if (this.inSecret) {
      if (this.atButton()) this.leaveBySecret();
      return;
    }

    if (this.hiding) {
      this.stepOut(this.hiding);
      this.hiding = null;
      audio.sfx('footstep_concrete');
      return;
    }

    // Same order the prompt uses.  A press that does something other than what
    // the line above the player's hands says it will do is worse than a press
    // that does nothing.
    const spot = this.nearestSpot(SPOT_REACH);
    if (spot && !spot.opening) {
      // If he is watching you climb in, the box is not a secret: he comes
      // straight to it.  If he is not, it is — a sound is not a sighting.
      const watched = this.mode === 'seeking' && this.grace <= 0 && (this.fMode === 'chase' || this.sees());
      this.hiding = spot;
      audio.sfx('hop_wet');
      if (watched) {
        this.fMode = 'suspicious';
        this.memory = 0;
        this.waypoint.set(spot.x, spot.z);
        this.startTrip();
        this.targetSpot = null;
      }
      return;
    }

    if (this.atDoor()) {
      // ONE PRESS.  In the arcade the doors are the game, and pressing E at
      // them hands the next ten seconds to the sequence.  Everywhere else the
      // door is scenery and says so, once.
      if (this.isFinal) this.startEscape();
      else this.say('LOCKED. THERE IS NOWHERE TO GO BUT UNDER SOMETHING.', 2400);
      return;
    }

    if (this.atCounter()) {
      this.startVault();
      return;
    }

    if (this.atCase()) this.tryCase();
  }

  /**
   * Climbing out.
   *
   * Hiding parks you at the centre of the thing you are inside — which is also
   * the middle of its collision box, so on coming out every direction was
   * solid and W A S D did nothing at all until you found the one diagonal that
   * escaped it.  In a round where the whole game is leaving a box before he
   * reaches it, that is the difference between playing and being caught.
   *
   * You come out facing the way you were looking, if there is floor there, and
   * round the sides if there is not.
   */
  private stepOut(spot: Spot3D): void {
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const q = Math.PI / 6;
    const offsets = [0, q, -q, 2 * q, -2 * q, 3 * q, -3 * q, 4 * q, -4 * q, 5 * q, -5 * q, Math.PI];

    for (const r of [1.35, 1.9, 2.5]) {
      for (const o of offsets) {
        const dx = fx * Math.cos(o) - fz * Math.sin(o);
        const dz = fx * Math.sin(o) + fz * Math.cos(o);
        const x = spot.x + dx * r;
        const z = spot.z + dz * r;
        if (Math.abs(x) > this.def.halfW - 0.8 || Math.abs(z) > this.def.halfD - 0.8) continue;
        if (!this.solid(x, z)) {
          this.pos.set(x, z);
          return;
        }
      }
    }
    // Boxed in on every side: stay put rather than step into the furniture.
    this.pos.set(spot.x, spot.z);
  }

  /**
   * Standing at the one door in the room that goes anywhere.
   *
   * A radius round the middle of a single-leaf door; a rectangle across the
   * front of a double one, because a circle round the middle of three and a
   * half metres of glass either misses both leaves or reaches out past the
   * frame into the wall on either side.
   */
  private atDoor(): boolean {
    const d = this.def;
    const g = d.glassDoor;
    if (g) {
      return (
        Math.abs(this.pos.x - d.door.x) < g.w / 2 + 0.5 &&
        Math.abs(this.pos.y - d.halfD) < DOOR_REACH
      );
    }
    return Math.hypot(this.pos.x - d.door.x, this.pos.y - d.halfD) < DOOR_REACH;
  }

  /** In front of the prize case, where a room has one. */
  private atCase(): boolean {
    const c = this.def.prizeCase;
    if (!c) return false;
    // A rectangle, not a radius: the case is six metres of frontage and a
    // circle round its middle either misses both ends or reaches behind it.
    // And only from IN FRONT of it (+Z): it stands against the back wall, so a
    // symmetric band would offer the prompt through that wall to somebody
    // standing outside the room with their back to it.
    //
    // It is out on the floor side of the counter, which is the point: the
    // player comes up in the staff corner with the counter wrapped round them,
    // and the one thing in this room that answers a key is on the other side
    // of it.  Nothing about the counter is in the way once they are over --
    // there is two and a half metres of clear floor between the two.
    const dz = this.pos.y - c.z;
    return Math.abs(this.pos.x - c.x) < CASE_REACH.hw && dz > 0 && dz < CASE_REACH.hd;
  }

  /**
   * At the counter, close enough to get over it — ANY part of it, FROM EITHER
   * SIDE.
   *
   * It was the staff side only and once only.  That made the climb a door
   * rather than a counter, and it cost the room the other half of what a
   * counter is for: you cannot duck behind a thing you are not allowed back
   * behind.  The counter is eight metres of waist-high cover in the middle of
   * a room with something hunting in it, and crouching behind it breaks his
   * line of sight like any other low furniture — so being able to get back
   * over is the mechanic, not a leak in it.
   *
   * IN THE ARCADE THERE IS NOTHING TO WALK ROUND.  The counter wraps the staff
   * corner and both its ends die into a wall, so the climb is the only way out
   * of the corner the player comes up in -- and, afterwards, the only way back
   * into it.
   */
  private atCounter(): boolean {
    return this.counterRun() !== null;
  }

  /**
   * Which run of the counter the player is stood at, if any.
   *
   * The counter turns a corner, so there is more than one of them and the
   * nearest wins: at the inside of the corner both runs are within reach, and
   * climbing the one you are further from would send the player over a stretch
   * of counter they are not stood at.
   */
  private counterRun(): CounterRun | null {
    const runs = this.def.counter;
    if (!runs || this.vault) return null;
    let best: CounterRun | null = null;
    let bestD = COUNTER_REACH;
    for (const r of runs) {
      const along = r.axis === 'x' ? this.pos.x : this.pos.y;
      const across = r.axis === 'x' ? this.pos.y : this.pos.x;
      if (along < r.from - 0.4 || along > r.to + 0.4) continue;
      const gap = Math.abs(across - r.at);
      if (gap < bestD) {
        bestD = gap;
        best = r;
      }
    }
    return best;
  }

  /**
   * Over the top, and it is a climb rather than a teleport.
   *
   * The player is committed for the whole of it — no steering, no stopping,
   * and he cannot be caught mid-air, because being frozen in the open by the
   * one move the room requires would be a trap rather than a decision.  It is
   * loud, though: a body going over a counter is the least quiet thing you can
   * do in this room, and he hears it from wherever he is.
   */
  private startVault(): void {
    const c = this.counterRun();
    if (!c) return;
    const along = c.axis === 'x' ? this.pos.x : this.pos.y;
    const across = c.axis === 'x' ? this.pos.y : this.pos.x;
    // Over to the OTHER side, whichever side that is.
    const side = across < c.at ? 1 : -1;
    const landAcross = c.at + side * VAULT_CLEAR;
    const to = new THREE.Vector2();
    // Straight over is usually clear, but a cabinet the other side is not our
    // problem to shove through: slide along the counter until there is floor.
    let landed = false;
    for (const off of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4]) {
      const a = Phaser.Math.Clamp(along + off, c.from + 0.3, c.to - 0.3);
      const x = c.axis === 'x' ? a : landAcross;
      const z = c.axis === 'x' ? landAcross : a;
      if (!this.solid(x, z)) {
        to.set(x, z);
        landed = true;
        break;
      }
    }
    if (!landed) return;

    this.vault = { from: this.pos.clone(), to, t: 0 };
    this.play('hop_wet', 0.5);
    this.alert();
  }

  /** The arc: up the near face, across the top, down the far side. */
  private stepVault(dt: number): void {
    const v = this.vault;
    if (!v) return;
    v.t = Math.min(1, v.t + dt / VAULT_S);
    // Ease in and out, so the weight is at the top rather than at the ends.
    const k = v.t < 0.5 ? 2 * v.t * v.t : 1 - 2 * (1 - v.t) * (1 - v.t);
    this.pos.set(
      Phaser.Math.Linear(v.from.x, v.to.x, k),
      Phaser.Math.Linear(v.from.y, v.to.y, k),
    );
    if (v.t >= 1) {
      this.vault = null;
      this.vaulted = true;
      this.play('footstep_concrete', 0.45);
    }
  }

  /**
   * The key, in the prize case.
   *
   * IT DOES NOT FIT, AND IT IS NOT SPENT.  The player has been carrying this
   * key since the basement believing it was for the bunny in the case, and the
   * case is the first thing in this room they will walk to.  It has to be able
   * to say no — and the no has to land as an answer rather than a locked door,
   * because it is the moment the whole night stops being an accident.
   *
   * Nothing is consumed and nothing is flagged.  The key still opens the staff
   * door, which is what it was cut for, which is the part he never said.
   */
  private tryCase(): void {
    if (!store.get().hasKey) {
      audio.sfx('door_rattle', 0.5);
      this.say('IT NEEDS A KEY.', 2000);
      return;
    }
    // Quiet.  A stinger here would make it a scare; it is a realisation, and
    // the room is silent enough that a swell under it is plenty.
    audio.sfx('lock_click', 0.4);
    this.time.delayedCall(260, () => audio.sfx('eerie_swell', 0.35));
    this.say("THIS KEY ISN'T FOR THE PRIZE CASE...", 2600);
    this.time.delayedCall(2600, () => this.say('FROGGY MUST HAVE KNOWN ALL ALONG...', 3000));
  }

  /**
   * THE ESCAPE.  Ten seconds, one press, and no way to stop it.
   *
   * It was a five-second hold with a ring round it -- a progress bar you could
   * fail by letting go of, which put a test of a thumb in the one place in
   * this game where the thing under test should be nerve.  Now E starts it and
   * that is the last decision the player makes.  What fills the time is their
   * own hands making a mess of the job: the key goes in, slips, hits the
   * floor, has to be found by feel, and goes back in -- while something the
   * player cannot turn round and look at crosses the room behind them.
   *
   * The feet are locked and the head is not.  They can still look about,
   * within ESCAPE_YAW of the doors, because a player who has been frozen solid
   * is watching a cutscene and a player who can still move their head is in
   * the room -- and they can never look far enough round to see what is coming,
   * because not being allowed to is the whole of why it is frightening.
   */
  private startEscape(): void {
    if (this.escaping || this.mode !== 'seeking') return;
    this.escaping = true;
    this.unlockT = 0;
    this.tumbler = 0;
    this.stepIn = STEP_SLOW;
    this.crouching = false;
    this.prompt = '';
    this.subtitle = '';
    // Square up to the doors, and take the half-step back off them that puts
    // both leaves and the chain in the shot.  See ESCAPE_STAND: it only ever
    // moves them AWAY from the door, so starting the sequence from across the
    // room does not drag anybody forward into it.
    this.escapeFrom.copy(this.pos);
    const face = this.def.halfD - (this.def.glassDoor ? 0.38 : 0.05);
    this.escapeMark = new THREE.Vector2(this.pos.x, Math.min(this.pos.y, face - ESCAPE_STAND));
    this.yaw = this.doorFacing();
    this.pitch = 0;
    audio.sfx('key_turn', 0.55);
    if (this.torch) this.torch.intensity = 26;
  }

  /** The yaw that looks straight at the way out from wherever the player is. */
  private doorFacing(): number {
    return Math.atan2(this.def.door.x - this.pos.x, this.def.halfD - this.pos.y) + Math.PI;
  }

  /**
   * HOLD THE HEAD ON THE DOORS.
   *
   * One clamp, applied from everywhere that can change where the player is
   * looking -- the mouse drag, the arrow keys, and every frame of the sequence
   * on top of both -- so there is no route to a view over their own shoulder.
   * A small amount of play either side keeps the shot alive; past that the
   * angle simply does not exist for ten seconds.
   */
  private holdOnDoor(): void {
    if (!this.escaping) return;
    const face = this.doorFacing();
    // ---- ONCE THE KEY IS BACK IN HIS HAND, THE VIEW IS NOT THE PLAYER'S.
    //
    // Nothing they do moves it: not the mouse, not the arrow keys, not
    // anything. It is nailed to the glass for the rest of the sequence,
    // because the whole of what is being built is a player listening to
    // something come up behind them that they are not allowed to look at, and
    // a few degrees of play is a few degrees of looking for it.
    if (this.keyTaken) {
      this.yaw = face;
      this.pitch = 0;
      return;
    }
    const off = Phaser.Math.Angle.Wrap(this.yaw - face);
    this.yaw = face + Phaser.Math.Clamp(off, -ESCAPE_YAW, ESCAPE_YAW);
    // Down far enough to find something on the carpet at your own feet: the
    // sequence asks the player to look at the floor, so it has to let them.
    this.pitch = Phaser.Math.Clamp(this.pitch, KEY_PITCH_MIN, ESCAPE_PITCH.max);
  }

  /**
   * 0..1 through the whole sequence, for the tremble and the harness.
   *
   * The wait on the floor does not advance it: nothing is happening during it
   * and the hands should not be shaking harder for the player having taken
   * longer to look down.
   */
  private get escapeK(): number {
    return Phaser.Math.Clamp((this.dropT + this.chaseT) / UNLOCK_S, 0, 1);
  }

  /**
   * Runs the ten seconds: the hands, the lock, and him.
   *
   * Every beat here is something the player HEARS rather than something they
   * are told, because the one thing they cannot do is turn round and check.
   */
  private runEscape(dt: number): void {
    if (!this.escaping || this.mode !== 'seeking') return;
    // Belt and braces on the view: whatever else moved it this frame, it comes
    // back inside the arc before anything is drawn.
    this.holdOnDoor();

    // The half-step back, eased out over the first beat.
    if (this.escapeMark) {
      const t = Phaser.Math.Clamp(this.dropT / ESCAPE_SETTLE, 0, 1);
      const e = Phaser.Math.Easing.Sine.Out(t);
      this.pos.set(
        Phaser.Math.Linear(this.escapeFrom.x, this.escapeMark.x, e),
        Phaser.Math.Linear(this.escapeFrom.y, this.escapeMark.y, e),
      );
      if (t >= 1) this.escapeMark = null;
    }

    if (!this.keyOnFloor) {
      this.runDrop(dt);
      return;
    }
    // PICKING IT UP.  The hand is on its way to the key and nothing else is
    // happening: no clock, no footsteps, nothing approaching.
    if (this.grabbing) {
      this.trembleSeed += dt * 2.2;
      this.runGrab(dt);
      return;
    }
    // WAITING.  The key is on the carpet, nothing is coming, and no clock is
    // running.  This is the one part of the ending the player is in charge of,
    // and it lasts exactly as long as it takes them to look down.
    if (!this.keyTaken) {
      this.trembleSeed += dt * 2.0;
      return;
    }
    this.runCharge(dt);
  }

  /**
   * THE FIRST TRY, AND THE SLIP.
   *
   * It looks like the door is being unlocked.  The key comes up, it finds the
   * lock, it sounds exactly like a key going into a lock -- and then it turns
   * over in his fingers and goes on the floor.  Nothing about the first two
   * seconds tells the player it is not working, which is the whole of why the
   * moment it hits the carpet lands.
   */
  private runDrop(dt: number): void {
    const before = this.dropT / KEY_DROP_S;
    this.dropT = Math.min(KEY_DROP_S, this.dropT + dt);
    const k = this.dropT / KEY_DROP_S;
    this.trembleSeed += dt * 2.6;
    const at = (mark: number): boolean => before < mark && k >= mark;

    if (at(DROP.toLock)) audio.sfx('key_turn', 0.6);
    if (at(DROP.slip)) {
      // IT GOES.  Off the lock, out of his fingers, and down -- and it is on
      // screen for every frame of it.
      this.releaseKey();
      audio.sfx('lock_click', 0.4);
    }
    // ---- THE DROP, FRAME BY FRAME.  A parabola off the lock face down to the
    // carpet, tumbling as it goes, because a key that falls straight is a key
    // being lowered.
    if (this.keyFall) {
      const f = this.keyFall;
      f.t = Math.min(1, f.t + dt / KEY_FALL_S);
      const e = f.t;
      const prop = this.keyProp;
      if (prop) {
        // Across and down on their own curves: the sideways travel is even,
        // the vertical is squared, which is what gravity looks like.
        prop.position.set(
          Phaser.Math.Linear(f.from.x, f.to.x, e),
          Math.max(f.to.y, Phaser.Math.Linear(f.from.y, f.to.y, e * e)),
          Phaser.Math.Linear(f.from.z, f.to.z, e),
        );
        // Tumbling end over end, slowing as it lands so it does not stop dead
        // in mid-spin.
        const settle = 1 - e * e;
        prop.rotation.set(f.spin * 5.2 * e * settle, f.spin * 2.1 * e, f.spin * 3.4 * e * settle);
      }
      if (f.t >= 1) this.landKey();
    }
    if (this.dropT >= KEY_DROP_S && !this.keyOnFloor) this.landKey();
  }

  /**
   * OUT OF HIS HAND, AT THE LOCK.
   *
   * The key is built and put where it actually was -- up at the padlock, on
   * the face of the doors -- and given somewhere to land.  Nothing about it is
   * on the floor yet.
   */
  private releaseKey(): void {
    if (this.keyFall || this.keyOnFloor) return;
    const d = this.def;
    const face = this.doorFacing();
    const fx = -Math.sin(face);
    const fz = -Math.cos(face);
    // Where it lands: in front of the player and off to one side.
    this.keyAt.set(
      this.pos.x + fx * KEY_LIES.ahead - fz * KEY_LIES.aside,
      this.pos.y + fz * KEY_LIES.ahead + fx * KEY_LIES.aside,
    );
    // Where it leaves: the lock, which is the padlock on the mullion.
    const doorZ = d.halfD - (d.glassDoor ? 0.38 : 0.05);
    const from = new THREE.Vector3(d.door.x, KEY_LOCK_Y, doorZ - 0.3);
    const to = new THREE.Vector3(this.keyAt.x, 0.02, this.keyAt.y);
    const st = this.stage;
    if (st) {
      const key = buildDroppedKey();
      key.position.copy(from);
      st.scene.add(key);
      this.keyProp = key;
    }
    this.keyFall = { from, to, t: 0, spin: Math.random() < 0.5 ? -1 : 1 };
  }

  /** It hits the carpet, and stays there. */
  private landKey(): void {
    if (this.keyOnFloor) return;
    this.keyOnFloor = true;
    this.keyFall = null;
    const face = this.doorFacing();
    if (this.keyProp) {
      this.keyProp.position.set(this.keyAt.x, 0.02, this.keyAt.y);
      // Lying flat, at whatever angle it came to rest at.
      this.keyProp.rotation.set(0, face + 0.6, 0);
    }
    audio.sfx('item_thud', 0.8);
    this.shake = Math.max(this.shake, 1);
    this.say('', 0);
  }

  /**
   * Put it on the carpet, as an object.
   *
   * It is a real thing in the room from here on: it is built into the scene at
   * a point on the floor, it is lit by the torch like everything else down
   * there, and it does not move again until somebody picks it up.
   */
  /** Standing over the key he dropped, and looking down at it. */
  private atKey(): boolean {
    // Not once the hand is already on its way to it: the offer has been taken,
    // and a prompt still reading [E] PICK IT UP over a hand picking it up is
    // the game asking for something it is in the middle of doing.
    if (!this.keyOnFloor || this.keyTaken || this.grabbing) return false;
    if (Math.hypot(this.pos.x - this.keyAt.x, this.pos.y - this.keyAt.y) > KEY_REACH) return false;
    // AND LOOKING AT IT.  It is at their feet, so the distance is never the
    // test that fails -- what the beat is actually asking for is that the
    // player takes their eyes off the door and looks at the floor, which is
    // the last thing anybody wants to do with something crossing the room.
    return this.pitch < KEY_LOOK;
  }

  /**
   * Picking it up, and everything that starts the moment he does.
   *
   * The camera stops being the player's here.  Up to now they have had a few
   * degrees either way; from here it is pinned on the glass and nothing they
   * do moves it, because the entire sequence is being made to listen to
   * something they are not allowed to look at.
   */
  private takeKey(): void {
    if (!this.atKey() || this.grabbing) return;
    // THE HAND COMES IN FIRST.  Nothing else starts until it has closed on the
    // key: `keyTaken` is what begins the footsteps and the lock, and it is not
    // set here.  See runGrab.
    this.grabbing = true;
    this.grabT = 0;
    this.prompt = '';
    const st = this.stage;
    if (st && !this.handProp) {
      const hand = buildHand();
      hand.position.set(HAND_OFF.x, HAND_OFF.y, HAND_OFF.z);
      hand.rotation.set(-0.55, HAND_YAW, 0.2);
      st.camera.add(hand);
      this.handProp = hand;
    }
    audio.sfx('footstep_carpet', 0.5);
  }

  /**
   * REACHING DOWN AND PICKING IT UP.
   *
   * The hand comes up into frame from below, out along the line of sight to
   * the key on the carpet, and closes on it; the key leaves the floor only on
   * that close, and it leaves by being handed to the hand rather than by being
   * deleted.  The player is crouched over it for the whole thing, which is the
   * pose `escapePose` is already holding.
   */
  private runGrab(dt: number): void {
    this.grabT = Math.min(GRAB_S, this.grabT + dt);
    const k = this.grabT / GRAB_S;
    // ---- THE POSE TAKES THE VIEW BACK.  `escapePose`'s pitch is a bias on top
    // of the player's own, and the player has just been looking as far down as
    // the sequence allows to find the key -- so the two stack into a camera
    // pointed at their own shoes, with the key and the hand off the top of the
    // frame.  Easing their contribution out hands the framing to the pose,
    // which is aimed at the key.
    this.pitch = Phaser.Math.Linear(this.pitch, 0, Math.min(1, dt * 5));
    const hand = this.handProp;
    const st = this.stage;
    if (!hand || !st) return;

    // ---- out to the key, then back up with it
    const reach = Phaser.Math.Easing.Sine.Out(Phaser.Math.Clamp(k / GRAB_CLOSE, 0, 1));
    const lift = Phaser.Math.Easing.Sine.InOut(Phaser.Math.Clamp((k - GRAB_CLOSE) / (1 - GRAB_CLOSE), 0, 1));
    hand.position.set(
      Phaser.Math.Linear(HAND_OFF.x, HAND_KEY.x, reach),
      Phaser.Math.Linear(HAND_OFF.y, HAND_KEY.y, reach) + lift * 0.1,
      Phaser.Math.Linear(HAND_OFF.z, HAND_KEY.z, reach),
    );
    hand.rotation.set(-0.55 + reach * 0.45, HAND_YAW, 0.2 - reach * 0.12);

    // ---- the fingers.  Open on the way down, shut on the key.
    const curl = Phaser.Math.Clamp((k - GRAB_CLOSE * 0.8) / 0.25, 0, 1);
    const fingers = hand.getObjectByName('fingers');
    const thumb = hand.getObjectByName('thumb');
    if (fingers) fingers.rotation.x = curl * 1.15;
    if (thumb) thumb.rotation.y = -curl * 0.8;

    // ---- AND THE KEY CHANGES HANDS, on the close, from the floor to the fist.
    if (k >= GRAB_CLOSE && this.keyProp && this.keyProp.parent !== hand) {
      st.scene.remove(this.keyProp);
      hand.add(this.keyProp);
      this.keyProp.position.set(0, -0.02, -0.16);
      this.keyProp.rotation.set(0, 0, 0.2);
      audio.sfx('lock_click', 0.35);
    }

    if (this.grabT >= GRAB_S) {
      this.grabbing = false;
      this.keyTaken = true;
      this.chaseT = 0;
      this.charging = false;
      this.stepIn = STEP_SLOW;
      // Square up on the doors and stay there.  holdOnDoor pins it from here.
      this.yaw = this.doorFacing();
      this.pitch = 0;
    }
  }

  /**
   * PUTTING IT IN THE LOCK, AND TURNING IT.
   *
   * The hand carries the key up the line of sight until it is over the
   * padlock, pushes it in, and then turns -- and the shackle comes open on the
   * last of it.  Every click the player hears has the hand moving on it, so
   * the sound is a consequence of the picture rather than a substitute for it.
   */
  private runInsert(k: number): void {
    const hand = this.handProp;
    if (!hand) return;
    // ---- up to the lock over the first third of the insert, then it stays.
    const up = Phaser.Math.Easing.Sine.InOut(Phaser.Math.Clamp(k / (INSERT_UNTIL * 0.45), 0, 1));
    hand.position.set(
      Phaser.Math.Linear(HAND_KEY.x, HAND_LOCK.x, up),
      Phaser.Math.Linear(HAND_KEY.y + 0.1, HAND_LOCK.y, up),
      Phaser.Math.Linear(HAND_KEY.z, HAND_LOCK.z, up),
    );
    hand.rotation.set(-0.1 + (1 - up) * 0.25, HAND_YAW + up * 0.2, 0.08);

    // ---- pushing it home, and then working it round.  The turn is not one
    // sweep: it goes, stops against a ward, and goes again -- which is the
    // same shape the tumblers are already making in the audio.
    const worked = Phaser.Math.Clamp((k - INSERT_UNTIL * 0.45) / (INSERT_UNTIL * 0.55), 0, 1);
    const key = this.keyProp;
    if (key) {
      key.position.set(0, -0.02, -0.16 - worked * 0.05);
      const turn = worked * Math.PI * 0.55;
      const catchOn = Math.sin(worked * Math.PI * 3) * 0.12 * (1 - worked);
      key.rotation.set(0, 0, 0.2 + turn + catchOn);
    }
    hand.rotation.z = 0.08 + worked * 0.5;

    // ---- and the lock gives.  It opens once, on the far side of the turn.
    if (this.shackle && worked > 0.92) this.shackle.rotation.z = 0.18 - 1.15;
  }

  /**
   * HIM, BEHIND YOU, AND THEN HIM RUNNING.
   *
   * Two gaits and a hard cut between them.  The walk starts far off and over a
   * second apart and closes to about three a second, getting louder and less
   * dulled as it comes -- which is what an ear reads as something approaching
   * from behind.  Then, without a ramp, it becomes a sprint: five a second,
   * twice the weight, and no further away than the last step was.
   *
   * He is never drawn.  There is nothing to see and the player cannot turn
   * round anyway; the whole thing is built out of what they can hear.
   */
  private runCharge(dt: number): void {
    const before = this.chaseT / CHASE_S;
    this.chaseT = Math.min(CHASE_S, this.chaseT + dt);
    const k = this.chaseT / CHASE_S;
    this.trembleSeed += dt * (2.4 + k * 6.5);
    const at = (mark: number): boolean => before < mark && k >= mark;

    // ---- THE KEY GOING IN, AND TURNING.  The hand is doing it on screen for
    // the whole of the first third; see runInsert.
    if (k < INSERT_UNTIL) this.runInsert(k);
    // ---- the lock, being fought with properly this time
    if (at(0.06)) audio.sfx('key_turn', 0.75);
    if (k > 0.1) {
      while (this.tumbler < TUMBLERS.length && k >= TUMBLERS[this.tumbler]) {
        this.tumbler++;
        audio.sfx('lock_click', 0.45 + this.tumbler * 0.1);
      }
    }

    // ---- and him
    if (at(CHARGE_AT)) {
      // THE MOMENT HE DECIDES.  One beat of nothing, which is worse than a
      // noise, and then he is running.
      this.charging = true;
      this.stepIn = 0.26;
      this.shake = Math.max(this.shake, 0.7);
      audio.sfx('eerie_swell', 0.5);
    }

    this.stepIn -= dt;
    if (this.stepIn <= 0) {
      this.stepSide = -this.stepSide;
      if (this.charging) {
        // Heavier, faster, and close: barely dulled, barely panned, because
        // by now he is not across the room any more.
        const c = Phaser.Math.Clamp((k - CHARGE_AT) / (1 - CHARGE_AT), 0, 1);
        this.stepIn = SPRINT_STEP * (1 - c * 0.25);
        audio.sfx('froggy_step', 1, { behind: 0.35 - c * 0.2, pan: this.stepSide * 0.12 });
        // A second, lower thump under each one, so a sprinting step is a
        // different sound from a walking one rather than the same sound
        // played sooner.
        this.time.delayedCall(38, () => audio.sfx('item_thud', 0.4 + c * 0.35));
      } else {
        const w = Phaser.Math.Clamp(k / CHARGE_AT, 0, 1);
        this.stepIn = Phaser.Math.Linear(STEP_SLOW, STEP_FAST, Math.pow(w, 0.8));
        audio.sfx('froggy_step', 0.08 + Math.pow(w, 1.4) * 0.72, {
          behind: 1 - w * 0.4,
          pan: this.stepSide * (0.55 - w * 0.3),
        });
      }
    }

    if (at(0.95)) {
      audio.sfx('key_turn', 1);
      this.time.delayedCall(140, () => audio.sfx('lock_click', 1));
      this.time.delayedCall(360, () => audio.sfx('door_open'));
    }
    if (this.chaseT >= CHASE_S) this.survive();
  }

  /**
   * Where the eye is, and what it is doing, through the sequence.
   *
   * Returns the height to stand the camera at and a pitch bias -- the two
   * things the animation is actually made of.  He raises the key, watches it
   * fall, goes down after it on the floor, and comes back up.
   */
  private escapePose(): { eye: number; pitch: number } {
    const ease = Phaser.Math.Easing.Sine.InOut;
    // WORKING THE LOCK.  The head is down on the hands and the chain, not
    // level with the glass: at this range a level view is a sheet of pane, and
    // what the player should be looking at is the thing holding the door shut.
    const WORK = -0.34;

    // ---- the first try, and watching it go
    if (!this.keyOnFloor) {
      const k = this.dropT / KEY_DROP_S;
      if (k < DROP.toLock) return { eye: EYE + 0.04, pitch: WORK };
      if (k < DROP.land) {
        // The head goes after it, fast, and finds the floor.
        const t = ease(Phaser.Math.Clamp((k - DROP.toLock) / (DROP.land - DROP.toLock), 0, 1));
        return { eye: EYE, pitch: WORK - t * 0.44 };
      }
      return { eye: EYE, pitch: -0.78 };
    }

    // ---- it is on the carpet and nobody has picked it up.  He is stood
    // looking down at it, and the player decides how long that goes on for.
    if (!this.keyTaken && !this.grabbing) return { eye: EYE, pitch: -0.5 };
    // ---- GOING DOWN FOR IT.  He drops into a crouch over the key as the hand
    // reaches, and the pose holds there until the grab is done.
    if (this.grabbing) {
      const t = Phaser.Math.Easing.Sine.InOut(Phaser.Math.Clamp(this.grabT / (GRAB_S * 0.5), 0, 1));
      return { eye: Phaser.Math.Linear(EYE, CROUCH_EYE, t), pitch: Phaser.Math.Linear(-0.5, -0.6, t) };
    }

    // ---- down after it, up with it, and back to the lock
    // ---- UP, WITH IT.  He straightens out of the crouch while the hand
    // carries the key to the lock, so the two movements are one movement.
    const k = this.chaseT / CHASE_S;
    if (k < INSERT_UNTIL * 0.6) {
      const t = ease(k / (INSERT_UNTIL * 0.6));
      return { eye: Phaser.Math.Linear(CROUCH_EYE, EYE, t), pitch: -0.78 + t * 0.44 };
    }
    return { eye: EYE + 0.04, pitch: WORK };
  }

  /**
   * How badly the hands are shaking, 0..1.
   *
   * It starts as almost nothing and ends as a lot, on a curve rather than a
   * ramp, because the last three seconds are meant to be the worst three.
   */
  private get tremble(): number {
    return this.escaping ? 0.1 + Math.pow(this.escapeK, 1.7) * 0.9 : 0;
  }

  /**
   * Through the wall.
   *
   * Everything that could still touch the player is cut here, in one place, so
   * there is no second path by which a chase already in flight lands after the
   * fact: the hiding spot is let go of, the vault is cancelled, and `inSecret`
   * goes true -- after which `sees`, `alert`, `creak` and `checkCaught` all
   * refuse on sight.
   *
   * HE IS NOT STOPPED.  He keeps searching the room, because the room is still
   * there and he is still in it; he has simply lost the only thing he was
   * looking for, and the pathfinder has no idea the wall was ever anything
   * else.
   */
  private enterSecret(): void {
    const sec = this.secret;
    if (!sec || this.inSecret) return;
    this.inSecret = true;
    this.hiding = null;
    this.vault = null;
    this.crouching = false;
    this.subtitle = '';
    this.prompt = '';
    this.unlockT = 0;
    if (this.fMode === 'chase') {
      this.fMode = 'search';
      this.memory = 0;
      this.pickWaypoint();
    }

    this.pos.set(sec.spawn.x, sec.spawn.z);
    this.yaw = sec.spawn.yaw;
    this.pitch = 0;
    this.floorY = sec.floorAt(sec.spawn.x, sec.spawn.z);
    this.eyeNow = EYE;

    // The air changes.  Warm and thin instead of cold and thick, and it is the
    // first thing the player notices before they have read a single object.
    const st = this.stage;
    if (st) st.scene.fog = new THREE.FogExp2(0x3a2418, 0.012);
    // The lights change hands.  His room goes dark behind you -- it is six
    // hundred metres away and nothing in here can see into it -- and the
    // lounge comes up.
    for (const l of this.roomLights) l.visible = false;
    sec.setActive(true);
    audio.setScene(SILENCE);
    audio.sfx('door_shut', 0.5);
  }

  /** Standing at the pedestal in the lounge. */
  private atButton(): boolean {
    if (!this.inSecret || !this.secret) return false;
    const b = this.secret.button;
    return Math.hypot(this.pos.x - b.x, this.pos.y - b.z) < 2.2 && this.floorY < 1.0;
  }

  private say(text: string, ms: number): void {
    this.subtitle = text;
    this.time.delayedCall(ms, () => {
      if (this.subtitle === text) this.subtitle = '';
    });
  }

  private nearestSpot(within: number): Spot3D | null {
    let best: Spot3D | null = null;
    let bestD = within;
    for (const c of this.spots) {
      const dist = Math.hypot(this.pos.x - c.x, this.pos.y - c.z);
      if (dist < bestD) {
        bestD = dist;
        best = c;
      }
    }
    return best;
  }

  // -------------------------------------------------------------------- loop

  private tick(dt: number): void {
    if (!this.stage) return;

    if (this.mode === 'briefing') {
      // Nothing moves.  He is talking, and there is nowhere to be yet.
      this.updateCamera(dt);
      this.updateSprite(dt);
      this.paintOverlay();
      this.publishTelemetry();
      return;
    }

    if (this.mode === 'hiding') {
      this.runCount(dt);
      this.movePlayer(dt);
    } else if (this.mode === 'seeking') {
      // The arcade has no clock.  You leave by the door or not at all.
      if (!this.isFinal) this.clock -= dt;
      this.movePlayer(dt);
      this.runEscape(dt);
      if (this.hunted) {
        this.moveFroggy(dt);
        this.checkCaught();
      }
      this.roomTone(dt);
      if (!this.isFinal && this.clock <= 0) this.survive();
    } else if (this.mode === 'caught') {
      this.caughtT += dt;
    } else if (this.mode === 'survived') {
      this.endT += dt;
    }

    // WHICH FLOOR THE PLAYER IS ON.  Every frame, not only the ones they are
    // pressing a key on: `movePlayer` returns early when nothing is held, so
    // running this in there left the height stale after any teleport and left
    // the button unreachable from the pedestal it is standing on.  Eased, so
    // the steps read as steps instead of the camera jumping up each one.
    if (this.inSecret && this.secret) {
      const want = this.secret.floorAt(this.pos.x, this.pos.y);
      this.floorY += (want - this.floorY) * Math.min(1, dt * 12);
    }

    // The television, the button's lamp and the thing under the glass.  It
    // runs whether or not anyone is in there: walking in on a room that starts
    // moving when you arrive is walking onto a set.
    this.secret?.tick(dt);

    for (const c of this.spots) {
      if (this.mode === 'seeking') c.sinceChecked += dt;
      const want = c.opening ? 1 : 0;
      c.open += (want - c.open) * Math.min(1, dt * 6);
      // A lid tips back; a door swings out on its side hinge.
      if (c.kind === 'chest' || c.kind === 'bed') c.hinge.rotation.x = -c.open * 1.5;
      else c.hinge.rotation.y = c.open * 1.9;
    }

    this.updateCamera(dt);
    this.updateSprite(dt);
    this.paintOverlay();
    this.publishTelemetry();
  }

  /**
   * He is waiting on the other side of the door, and he explains the game.
   *
   * He is visible for it — stood a good way off, watching, mouth working — and
   * then he is gone when the count starts, which is worse than him walking
   * away.  The player is frozen for the whole thing on purpose.
   */
  private beginBriefing(lines: Array<[string, number]>): void {
    if (lines.length === 0) {
      this.beginCountOnly();
      return;
    }
    // Later zones: the echo for the one you got through, then his line.
    if (this.roomIndex > 0) audio.sfx('zone_clear');
    const unseen = UNSEEN_BRIEFING.has(this.roomIndex) || !this.hunted;
    this.monster?.setVisible(!unseen);
    // Well down the room, facing you: near enough to read, far enough that he
    // is not the whole screen.
    // NINE METRES INTO THE ROOM, whichever end of it you came in at.  The
    // first three rooms put you at the +z wall, so "towards the middle" was
    // always -z and the nine could simply be subtracted; the arcade lets you in
    // at the BACK, behind the counter, and subtracting there stood him outside
    // the room and on top of you — close enough that the round opened with him
    // already having you.
    const inward = this.def.spawn.z > 0 ? -1 : 1;
    if (unseen) {
      // Out of the shot entirely: his own starting corner, which is where the
      // count would have put him anyway.
      this.froggy.set(this.def.froggyStart.x, this.def.froggyStart.z);
    } else {
      this.froggy.set(this.def.spawn.x, this.def.spawn.z + inward * 9);
    }
    this.froggyWas.copy(this.froggy);
    this.froggyYaw = Math.atan2(this.pos.x - this.froggy.x, this.pos.y - this.froggy.y);
    this.fMode = 'listen';
    this.fTimer = 999;

    const say = (i: number): void => {
      const beat = lines[i];
      if (!beat) return;
      this.subtitle = beat[0];
      this.play('ui_hover', 0.35);
      this.time.delayedCall(beat[1], () => {
        if (this.mode !== 'briefing') return;
        if (i + 1 < lines.length) {
          say(i + 1);
          return;
        }
        // ...and then the noise, instead of the rest of the sentence.  The
        // first door gets the scream; the later ones a creak and the dark.
        this.subtitle = '';
        if (this.roomIndex === 0) {
          audio.scare();
          this.cameras.main.shake(900, 0.03);
        } else {
          audio.sfx('door_creak');
        }
        this.time.delayedCall(this.roomIndex === 0 ? BRIEFING_TAIL_MS : 900, () => {
          if (this.mode !== 'briefing') return;
          // NO COUNT IN THE ARCADE.  The ten seconds exist because he shuts
          // the door and gives them to you; up here he is already in the room
          // and has promised nothing, so the round simply starts.
          this.mode = this.isFinal ? 'seeking' : 'hiding';
          this.clock = this.isFinal ? 0 : HIDE_S;
          this.subtitle = '';
          this.monster?.setVisible(this.hunted && this.isFinal);
          this.fMode = 'search';
          this.fTimer = 0;
          this.freeFroggy();
          this.pickWaypoint();
        });
      });
      this.briefLine = i;
    };
    say(0);
  }

  /**
   * THE ARCADE, AND THE CONTROLS ARE ALREADY YOURS.
   *
   * Every other room opens on a speech the player cannot move through, which
   * is right at a door he is standing on the other side of.  This one is not a
   * door he opened: the third room ended, and the next thing is the staff
   * corner of the arcade with the counter round it.  So there is no freeze, no
   * count and no clock — WASD, the mouse and E all work on the first frame, and
   * the one line he has left is said over the top of a player already walking.
   *
   * What the room wants is stated as an objective on the overlay rather than
   * by him, because in here he is not promising anything.
   */
  private beginArcade(): void {
    this.mode = 'seeking';
    this.clock = 0;
    this.fMode = 'search';
    this.fTimer = 0;
    this.grace = 1.5;
    this.monster?.setVisible(this.hunted);
    audio.sfx('door_shut', 0.5);
    const [text, ms] = ZONE_LINES[FINAL_ROOM][0];
    this.say(text, ms);
    this.freeFroggy();
    this.pickWaypoint();
  }

  /** A zone with nothing to say: straight to the count. */
  private beginCountOnly(): void {
    this.monster?.setVisible(false);
    this.mode = 'hiding';
    this.clock = HIDE_S;
    this.fMode = 'search';
    this.fTimer = 0;
    audio.sfx('zone_clear');
    this.say(`ZONE ${this.roomIndex + 1}`, 1600);
    this.freeFroggy();
    this.pickWaypoint();
  }

  /**
   * The count.  Ten seconds of an empty room and a number.
   *
   * Nothing happens here on purpose: no face, no line, no sting.  The player
   * gets to walk the room, find out what is in it and choose somewhere, and the
   * whole tone of the round turns over exactly once — when the count ends.
   */
  private runCount(dt: number): void {
    const before = this.clock;
    this.clock -= dt;

    // A soft tick on each of the last five seconds.  The only warning there is.
    const secLeft = Math.ceil(this.clock);
    if (secLeft <= 5 && Math.ceil(before) !== secLeft && secLeft > 0) this.play('ui_hover', 0.5);

    // The count is also where the controls are taught.  The settings manual is
    // rendered from BINDINGS and is full to the bottom of its panel, and a room
    // whose whole game is crossing it quickly cannot afford a player who does
    // not know they can strafe.
    if (this.clock > 7.5) this.subtitle = 'HIDE';
    else if (this.clock > 5.2) this.subtitle = 'WASD MOVE - SHIFT RUN - C CROUCH';
    else if (this.clock > 3.0) this.subtitle = 'HOLD LEFT CLICK TO LOOK';
    else if (this.clock > 1.2) this.subtitle = 'FIND SOMEWHERE TO HIDE';
    else this.subtitle = '';

    if (this.clock <= 0) {
      this.mode = 'seeking';
      this.clock = seekFor(this.roomIndex);
      this.subtitle = 'READY OR NOT';
      this.time.delayedCall(2400, () => {
        if (this.subtitle === 'READY OR NOT') this.subtitle = '';
      });
      // He comes in now, and only now.
      this.monster?.setVisible(true);
      audio.sfx('door_creak');
      this.grace = 1.5;
      this.freeFroggy();
      this.pickWaypoint();
    }
  }

  /**
   * What the room does on its own: a drip, a board settling somewhere, a low
   * swell that is nothing, two steps that are not his — and, most of the
   * time, nothing at all.  The gaps are the instrument.  Everything here is
   * quiet enough that his real footsteps still cut through it.
   */
  private roomTone(dt: number): void {
    this.dripIn -= dt;
    if (this.dripIn > 0) return;
    this.dripIn = 5 + Math.random() * 13;
    const roll = Math.random();
    if (roll < 0.3) {
      this.play('drip', 0.18);
    } else if (roll < 0.55) {
      this.play('floor_creak', 0.22);
    } else if (roll < 0.75) {
      this.play('eerie_swell', 0.5);
    } else if (roll < 0.9) {
      // Two faint steps from nowhere in particular.  Not him.  Probably.
      this.play('froggy_step', 0.06);
      this.time.delayedCall(520 + Math.random() * 300, () => {
        if (this.mode === 'seeking' || this.mode === 'hiding') this.play('froggy_step', 0.05);
      });
    }
    // ...and the rest of the time, the silence stays.
  }

  private movePlayer(dt: number): void {
    // Turning on the keyboard works whatever else you are doing, including
    // from inside a box: knowing which way you are facing before you climb out
    // is worth having.
    const turn = (this.held('turnR') ? 1 : 0) - (this.held('turnL') ? 1 : 0);
    if (turn !== 0) this.yaw -= turn * TURN_RATE * dt;
    // The arrow keys are a second way of turning, and the door holds the head
    // whichever one is being used.
    if (this.escaping) this.holdOnDoor();

    if (this.hiding) {
      this.pos.set(this.hiding.x, this.hiding.z);
      return;
    }

    // Committed.  The arc owns where he is until he is down the other side.
    if (this.vault) {
      this.stepVault(dt);
      return;
    }

    // And once the key is in the door, the feet stay where they are: no WASD,
    // no strafe, no run, no crouch.  The head does not freeze with them -- see
    // holdOnDoor -- because a player frozen solid is watching a cutscene and a
    // player who can still move their head is in the room.
    if (this.escaping) return;

    const fwd = (this.held('fwd') ? 1 : 0) - (this.held('back') ? 1 : 0);
    const strafe = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    if (fwd === 0 && strafe === 0) return;

    // SHIFT stands you up rather than being ignored: a player holding run is
    // telling you they want to move, and the toggle should not argue with it.
    if (this.crouching && this.held('run')) this.crouching = false;
    const running = this.held('run') && !this.crouching;
    // ---- TWICE THE PACE, AND ONLY IN HERE.  Nothing behind the wall is
    // listening for a footstep, so the careful pace the hide rooms are built
    // around is just distance in the gallery.  It is read off `inSecret` every
    // frame rather than latched on the way in, so stepping back out through
    // the wall is back to the room's pace on the same frame.
    const speed = (this.crouching ? CROUCH : running ? RUN : WALK) * (running && this.inSecret ? SECRET_RUN : 1);

    // Camera looks down -Z, so forward is (-sin, -cos) and right is (cos, -sin).
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const dx = -sin * fwd + cos * strafe;
    const dz = -cos * fwd - sin * strafe;
    const len = Math.hypot(dx, dz) || 1;
    const nx = this.pos.x + (dx / len) * speed * dt;
    const nz = this.pos.y + (dz / len) * speed * dt;

    if (!this.solid(nx, this.pos.y)) this.pos.x = nx;
    if (!this.solid(this.pos.x, nz)) this.pos.y = nz;
    this.clampToRoom(this.pos);

    if (this.inSecret) {
      this.bob += dt * (running ? 9 : this.crouching ? 3.5 : 5.5);
      return;
    }
    // Past the face of the wall inside the secret door's span: you are in.
    if (this.def.secretDoor && this.pos.x > this.def.halfW - 0.2) {
      this.enterSecret();
      return;
    }

    this.bob += dt * (running ? 9 : this.crouching ? 3.5 : 5.5);
    this.stepT += dt * speed;
    if (this.stepT > 1.9) {
      this.stepT = 0;
      // Three gaits.  A run is a slap he hears across the room, and it is
      // the only gait that sets a board off.  A walk is a soft step YOU hear
      // and he does not; a crouch is nothing at all.
      if (this.crouching) return;
      if (running) {
        this.play('step_run', 0.55);
        if (this.froggy.distanceTo(this.pos) < HEAR_RUN) this.alert();
        else if (Math.random() < CREAK_CHANCE) this.creak();
      } else {
        this.play('step_walk', 0.32);
      }
    }
  }

  private moveFroggy(dt: number): void {
    // A few seconds of grace.  Without it he is already looking straight down
    // the room as the intro ends, and the first thing the room does is chase.
    this.grace = Math.max(0, this.grace - dt);
    const seen = this.grace <= 0 && !this.hiding && this.sees();
    this.unseenT = seen ? 0 : this.unseenT + dt;

    // A noise buys a look, not a hunt.  When the look runs out he goes back to
    // working the room, none the wiser.
    if (this.fMode === 'investigate') {
      this.investigateT -= dt;
      if (this.investigateT <= 0) {
        this.fMode = 'search';
        this.pickWaypoint();
      }
    }

    if (seen) {
      if (this.fMode !== 'chase') {
        audio.sfx('buzzer');
        // The chase has its own music, and only the chase: the room is
        // silent until he has you in view, and silent again once he loses you.
        audio.setScene({ music: 'chase_pulse' });
      }
      this.fMode = 'chase';
      this.memory = MEMORY_S;
      this.lastSeen.copy(this.pos);
    } else if (this.fMode === 'chase') {
      this.memory -= dt;
      if (this.memory <= 0) {
        this.fMode = 'suspicious';
        audio.setScene(SILENCE);
        this.waypoint.copy(this.lastSeen);
        this.startTrip();
      }
    }

    // Standing still and listening, or working a lid, means not walking.
    if (this.fMode === 'listen' || this.fMode === 'openSpot') {
      const before = this.fTimer;
      this.fTimer -= dt;
      if (this.fMode === 'openSpot' && this.targetSpot) {
        const spot = this.targetSpot;
        // The lid comes up a little past the halfway mark, and it is heard
        // when it does — from anywhere in the room.  This is the sound the
        // round is played by.
        const total = this.openSeconds(spot);
        // A lid comes up just past halfway.  A BLANKET comes up once he is
        // already down on the floor -- he does not lift it on the way past.
        const lidAt = total * (spot.kind === 'bed' ? 0.58 : 0.53);
        spot.opening = this.fTimer < lidAt;
        if (before >= lidAt && this.fTimer < lidAt) {
          this.play('spot_open', this.earshot(spot.x, spot.z, OPEN_EARSHOT, 0.3));
          spot.sinceChecked = 0;
        }
        // AND HE HAS TO LOOK BEFORE HE FINDS YOU.  Under a bed the catch waits
        // until he is properly down and the blanket is up -- a fifth of the
        // beat after the lift -- so what happens to a player hiding there is a
        // thing they watch coming rather than a thing that has happened.
        const findAt = spot.kind === 'bed' ? total * 0.38 : lidAt;
        if (this.fTimer < findAt && this.hiding === spot) {
          this.caught();
          return;
        }
      }
      if (this.fTimer <= 0) {
        if (this.targetSpot) {
          this.targetSpot.opening = false;
          this.targetSpot.checkedOn = this.sweep;
        }
        this.targetSpot = null;
        this.fMode = 'search';
        this.pickWaypoint();
      }
      return;
    }

    // Mid-climb he is committed: no steering, no collision, no stopping.
    if (this.climb) {
      this.stepClimb(dt);
      return;
    }

    const target = this.fMode === 'chase' ? this.pos : this.waypoint;
    const dist = target.distanceTo(this.froggy);
    // Arriving at a hiding place means standing beside it, and a bed is a
    // good deal wider than a chest.
    const spotTarget = this.fMode === 'chase' ? null : this.spotNear(this.waypoint, 0.2);
    const arriveAt = spotTarget ? Math.max(spotTarget.hw, spotTarget.hd) + 1.5 : ARRIVE_DIST;

    if (dist < arriveAt) {
      if (this.fMode === 'investigate') {
        // Nothing here.  Look around the spot rather than walking off it: the
        // sound was approximate, so the search has to be too.
        if (this.investigateT > 1.2) {
          const a = Math.random() * Math.PI * 2;
          const r = 2.5 + Math.random() * 3;
          const look = new THREE.Vector2(this.froggy.x + Math.cos(a) * r, this.froggy.y + Math.sin(a) * r);
          this.clampToRoom(look);
          if (!this.solid(look.x, look.y, 0.5)) {
            this.waypoint.copy(look);
            this.startTrip();
          }
          this.arrive();
          return;
        }
        this.fMode = 'search';
      }
      if (this.fMode === 'suspicious') this.fMode = 'search';
      this.arrive();
      return;
    }

    // ---- the route.  Replanned when the target has moved, when it is old,
    // or when it is gone.  A chase replans often because you move.
    this.pathAge += dt;
    const stale = this.pathAge > (this.fMode === 'chase' ? 0.6 : 2.0);
    const moved = Number.isNaN(this.pathFor.x) || this.pathFor.distanceTo(target) > 1.2;
    if (this.path.length === 0 || moved || stale) this.replan(target);

    // Next point: the furthest node ahead he can walk to in a straight line
    // without crossing furniture, so the route is a walk and not a stagger
    // from cell to cell.  Climbable cells are left to the path itself, so a
    // climb happens where the route chose it.
    let nx = target.x;
    let nz = target.y;
    if (this.path.length > 0 && this.grid) {
      while (this.path.length > 1 && Math.hypot(this.path[0][0] - this.froggy.x, this.path[0][1] - this.froggy.y) < 0.45) {
        this.path.shift();
      }
      let k = 0;
      for (let i = Math.min(this.path.length - 1, 14); i > 0; i--) {
        if (lineOpen(this.grid, this.froggy.x, this.froggy.y, this.path[i][0], this.path[i][1], false)) {
          k = i;
          break;
        }
      }
      [nx, nz] = this.path[k];
    }

    // ---- steering.  He turns at a bounded rate and moves the way he is
    // FACING, so a change of direction is an arc rather than a slide; he
    // slows into sharp turns and accelerates out of them.
    const wantSpeed = this.froggySpeed();
    this.fSpeed += (wantSpeed - this.fSpeed) * Math.min(1, dt * FROGGY_ACCEL);
    this.wantYaw = Math.atan2(nx - this.froggy.x, nz - this.froggy.y);
    const dyaw = Phaser.Math.Angle.Wrap(this.wantYaw - this.froggyYaw);
    this.froggyYaw = Phaser.Math.Angle.Wrap(this.froggyYaw + Phaser.Math.Clamp(dyaw, -FROGGY_TURN * dt, FROGGY_TURN * dt));
    const align = Math.max(0, Math.cos(dyaw));
    const step = this.fSpeed * dt * (0.3 + 0.7 * align);
    const ax = Math.sin(this.froggyYaw);
    const az = Math.cos(this.froggyYaw);
    const speed = this.fSpeed;
    const tx = this.froggy.x + ax * step;
    const tz = this.froggy.y + az * step;

    // The outer walls are solid here too, not just in the clamp below.  If
    // they were not, a step into a wall counted as a clean step and none of
    // the stuck handling ever saw it.
    const freeX = this.inRoom(tx, this.froggy.y) && !this.solid(tx, this.froggy.y, 0.5);
    const freeZ = this.inRoom(this.froggy.x, tz) && !this.solid(this.froggy.x, tz, 0.5);

    const inTheWay =
      this.blockerAt(tx, tz, 0.5) ??
      this.blockerAt(tx, this.froggy.y, 0.5) ??
      this.blockerAt(this.froggy.x, tz, 0.5);

    if (freeX && freeZ) {
      this.froggy.x = tx;
      this.froggy.y = tz;
      this.stuckT = 0;
    } else if (inTheWay && this.startClimb(inTheWay, ax, az)) {
      // Straight over it.
      this.stuckT = 0;
    } else if (freeX || freeZ) {
      // Sliding along whatever he clipped, at full speed.  The route should
      // not bring him here often; when it does, this is one frame of it.
      this.stuckT += dt;
      if (freeX) this.froggy.x += Math.sign(ax || 1) * speed * dt * 0.8;
      else this.froggy.y += Math.sign(az || 1) * speed * dt * 0.8;
      if (this.stuckT > 0.5) {
        this.stuckT = 0;
        this.replan(target);
      }
    } else {
      // Blocked both ways: a pocket.  A moment in case it is a corner he is
      // about to turn out of, then onto open floor and a fresh route.
      this.stuckT += dt;
      if (this.stuckT > 0.5) {
        this.stuckT = 0;
        this.freeFroggy(true);
        this.replan(target);
      }
    }
    this.clampToRoom(this.froggy);
    this.footsteps(dt, speed);

    // Headway.  A trip that is not getting anywhere is replanned once, and if
    // the second route is no better it is abandoned for a different spot.  A
    // chase is exempt: memory running out already ends that.
    this.headwayT += dt;
    if (this.headwayT >= HEADWAY_S) {
      const now = this.froggy.distanceTo(this.waypoint);
      const gained = this.headwayDist - now;
      this.headwayT = 0;
      this.headwayDist = now;
      if (gained < HEADWAY_DIST && this.fMode !== 'chase') {
        if (this.repathFails++ < 1) this.replan(target);
        else this.giveUpTrip();
      }
    }
  }

  /** A fresh route to wherever he is going.  No route at all means give it up. */
  private replan(target: THREE.Vector2): void {
    if (!this.grid) return;
    this.path = findPath(this.grid, this.froggy.x, this.froggy.y, target.x, target.y);
    this.pathFor.copy(target);
    this.pathAge = 0;
    if (this.path.length === 0 && this.fMode !== 'chase') this.giveUpTrip();
  }

  /**
   * Abandon the current waypoint for a hiding spot other than the one he was
   * heading to.  Random, not nearest: nearest is usually the one behind the
   * same wall.
   */
  private giveUpTrip(): void {
    const was = this.waypoint.clone();
    const others = this.spots.filter((s) => Math.hypot(s.x - was.x, s.z - was.y) > 1);
    if (others.length > 0) {
      const s = Phaser.Utils.Array.GetRandom(others);
      this.waypoint.set(s.x, s.z);
      this.startTrip();
    } else {
      this.pickWaypoint();
    }
    if (this.fMode === 'investigate' || this.fMode === 'suspicious') this.fMode = 'search';
    this.stuckT = 0;
    this.path = [];
    this.pathFor.set(NaN, NaN);
    // And if what stopped him was being inside something, put him on the floor.
    this.freeFroggy();
  }

  private inRoom(x: number, z: number): boolean {
    return Math.abs(x) < this.def.halfW - 0.6 && Math.abs(z) < this.def.halfD - 0.6;
  }

  /**
   * Standing in reach of him, out in the open, is being caught.
   *
   * This used to live at the end of his walking code, which meant it only ran
   * on frames where he was walking: stop to listen, or open a lid, with the
   * player next to him, and he would stand there touching them and do nothing.
   * It belongs to the round, not to one branch of his behaviour.
   *
   * Hiding is the exception, and the only one: inside something, the only
   * thing that finds you is him opening it.
   */
  private checkCaught(): void {
    // Mid-vault he cannot be taken.  The counter is the one move the room
    // REQUIRES, and a move you have to make that can end the round while you
    // are unable to steer out of it is a trap, not a decision.  It lasts under
    // two thirds of a second and it is loud, so he is already coming.
    if (this.mode !== 'seeking' || this.hiding || this.vault) return;
    // AND HERE, BELT AND BRACES.  Nothing catches you through a wall he does
    // not know is a door, and six hundred metres of world space between the
    // two of you would already have made the distance test pass -- but this
    // must be true because it is stated, not because the arithmetic happens
    // to agree.
    if (this.inSecret) return;
    // His reach follows his size, so the arcade's larger model has the arcade's
    // larger grab rather than the one the smaller rooms were tuned for.
    const reach = this.isFinal ? catchFor(FINAL_SCALE) : CATCH_DIST;
    if (this.pos.distanceTo(this.froggy) < reach) this.caught();
  }

  /**
   * His steps.  The room has no score and no ambience worth the name, so this
   * is how you know where he is while you are looking at the inside of a lid.
   * Volume is distance and nothing else — no stinger, no music cue.
   */
  private footsteps(dt: number, speed: number): void {
    this.fStep += speed * dt;
    const stride = this.fMode === 'chase' ? 1.1 : 1.5;
    if (this.fStep < stride) return;
    this.fStep = 0;
    const gain = this.earshot(this.froggy.x, this.froggy.y, EARSHOT, 0);
    if (gain > 0.04) this.play('froggy_step', gain);
  }

  /**
   * Everything audible in here goes through one door, so distance is applied
   * once and the round's soundtrack can be read back in one place.
   */
  private play(name: SfxName, gain = 1): void {
    audio.sfx(name, gain);
    if (!import.meta.env?.DEV) return;
    this.heard.push({ name, gain: Math.round(gain * 1000) / 1000 });
    if (this.heard.length > 24) this.heard.shift();
  }

  /** How loud something at (x,z) is from where the player is standing. */
  private earshot(x: number, z: number, range: number, floor: number): number {
    const d = Math.hypot(this.pos.x - x, this.pos.y - z);
    const near = Math.max(0, 1 - d / range);
    return Math.max(floor, near * near);
  }

  /**
   * How fast he is going, right now.
   *
   * Three gears and nothing in between: after you, hunting for you, or — once
   * five seconds have gone by without a sight of you — prowling.
   */
  private froggySpeed(): number {
    const pace = ROOM_PACE[Math.min(this.roomIndex, ROOM_PACE.length - 1)];
    // ONCE HE HAS SEEN YOU HE IS THE SAME EVERYWHERE.  The arcade slows his
    // SEARCH, not his chase: the room is the puzzle up here and you need time
    // in it, but being spotted has to cost exactly what it always cost.
    if (this.fMode === 'chase') return FROGGY_CHASE * pace;
    const hunt = this.isFinal ? pace * FINAL_SEARCH_PACE : pace;
    // Something made a noise, so he is not dawdling — but he is not chasing
    // either, because he has not seen anything to chase.
    if (this.fMode === 'investigate') return FROGGY_SEARCH * hunt;
    return (this.unseenT > LOST_YOU_S ? FROGGY_PROWL : FROGGY_SEARCH) * hunt;
  }

  /**
   * The arcade: the last room, and the only one with a door instead of a
   * clock.  Everything that behaves differently up here asks this.
   */
  private get isFinal(): boolean {
    return this.roomIndex === FINAL_ROOM;
  }

  /** Whether there is anything hunting you in this room at all. */
  private get hunted(): boolean {
    return !this.isFinal || FROGGY_IN_ARCADE;
  }

  /**
   * How long he spends on a hiding place.
   *
   * A BED TAKES LONGER, because a bed is the only one he has to get down on
   * the floor for.  Lifting a lid is a reach; looking underneath something is
   * a squat, a look, a hold, and a stand -- and at 1.7 seconds that whole
   * sequence is a twitch.  Twice and a bit gives each beat room to land.
   */
  private openSeconds(spot?: Spot3D | null): number {
    const base = OPEN_S[Math.min(this.roomIndex, OPEN_S.length - 1)];
    return spot?.kind === 'bed' ? base * 2.3 : base;
  }

  /**
   * 0..1 through a check of a bed, for the crouch.
   *
   * Eased in over the first quarter, held flat while he is actually looking,
   * and out over the last fifth -- so he goes down deliberately, stays down
   * long enough for the player under there to have to watch him, and stands up
   * as the beat ends rather than snapping upright.
   */
  private bedCrouch(): number {
    const spot = this.targetSpot;
    if (this.fMode !== 'openSpot' || !spot || spot.kind !== 'bed') return 0;
    const total = this.openSeconds(spot);
    const k = 1 - Phaser.Math.Clamp(this.fTimer / total, 0, 1);
    if (k < 0.26) return Phaser.Math.Easing.Sine.InOut(k / 0.26);
    if (k > 0.82) return Phaser.Math.Easing.Sine.InOut((1 - k) / 0.18);
    return 1;
  }

  /** What he does on reaching a waypoint: check it, listen, or move on. */
  private arrive(): void {
    const spot = this.spotNear(this.froggy, 3.0);
    const roll = Math.random();
    // He opens what he walked to.  Every spot gets checked once a sweep, and
    // a spot he has not touched in a while gets opened whatever the sweep says.
    if (spot && (spot.checkedOn < this.sweep || spot.sinceChecked > STALE_S || roll < 0.5)) {
      this.targetSpot = spot;
      this.fMode = 'openSpot';
      this.fTimer = this.openSeconds(spot);
      this.froggyYaw = Math.atan2(spot.x - this.froggy.x, spot.z - this.froggy.y);
      return;
    }
    if (roll < 0.65) {
      // Stops dead and listens.  If you are running, this is when he hears it.
      this.fMode = 'listen';
      this.fTimer = 0.9 + Math.random() * 0.9;
      return;
    }
    // Otherwise he keeps walking.  Pausing on four arrivals out of five made
    // him a statue: most of any given minute was him standing somewhere.
    this.fMode = 'search';
    this.pickWaypoint();
  }

  private spotNear(p: THREE.Vector2, within: number): Spot3D | null {
    let best: Spot3D | null = null;
    let bestD = within;
    for (const c of this.spots) {
      const dist = Math.hypot(p.x - c.x, p.y - c.z);
      if (dist < bestD) {
        bestD = dist;
        best = c;
      }
    }
    return best;
  }

  /**
   * Shove him onto open floor.  Spawning him inside a sofa wedged him against
   * it for the whole room — he could not move on either axis, so he simply
   * stood in the furniture for as long as you cared to look at him.
   */
  private freeFroggy(force = false): void {
    if (!force && !this.solid(this.froggy.x, this.froggy.y, 0.5)) return;
    for (let r = 0.5; r < 8; r += 0.5) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        const x = this.froggy.x + Math.cos(a) * r;
        const z = this.froggy.y + Math.sin(a) * r;
        if (Math.abs(x) > this.def.halfW - 1 || Math.abs(z) > this.def.halfD - 1) continue;
        if (!this.solid(x, z, 0.5)) {
          this.froggy.set(x, z);
          return;
        }
      }
    }
  }

  /**
   * Where he goes next.  He works the room instead of wandering it: of three
   * spots picked at random he takes whichever he has left alone longest, so the
   * sweep reaches everywhere eventually and no box stays safe by being ignored.
   * One trip in five is just a walk across the floor, which is what stops him
   * being a circuit you can time.
   */
  private pickWaypoint(): void {
    if (this.spots.length > 0) {
      // Every hiding place gets opened once per sweep; when the last one is
      // done the sweep starts again, which is the recheck.  Mostly he takes
      // the nearest one still to do, so a sweep is a walk around the room and
      // not a tour of its far corners — and one trip in five is a spot he has
      // already done, so having been checked is not the same as being safe.
      let pool = this.spots.filter((c) => c.checkedOn < this.sweep);
      if (pool.length === 0) {
        this.sweep++;
        pool = this.spots.slice();
      }
      let pick: Spot3D;
      if (Math.random() < 0.2) {
        pick = Phaser.Utils.Array.GetRandom(this.spots);
      } else {
        const here = this.froggy;
        pool.sort((a, b) => Math.hypot(a.x - here.x, a.z - here.y) - Math.hypot(b.x - here.x, b.z - here.y));
        pick = pool[Math.floor(Math.random() * Math.min(2, pool.length))];
      }
      this.waypoint.set(pick.x, pick.z);
    } else {
      this.waypoint.set(
        Phaser.Math.FloatBetween(-this.def.halfW + 1.5, this.def.halfW - 1.5),
        Phaser.Math.FloatBetween(-this.def.halfD + 1.5, this.def.halfD - 1.5),
      );
    }
    this.startTrip();
  }

  /** A fresh trip gets a full headway window, measured from where it starts. */
  private startTrip(): void {
    this.headwayT = 0;
    this.headwayDist = this.froggy.distanceTo(this.waypoint);
    this.repathFails = 0;
    this.path = [];
    this.pathFor.set(NaN, NaN);
  }

  /**
   * A board goes under your foot.
   *
   * You hear it, and if he is close enough he hears it too — but all he gets
   * is somewhere to go.  He does not learn where you are, he does not turn to
   * face you, and he does not start hunting: he walks over to have a look, and
   * whether that finds you is down to whether you are still in the open when he
   * arrives.
   */
  private creak(): void {
    this.play('floor_creak', 0.9);
    if (this.mode !== 'seeking' || this.inSecret) return;
    if (this.froggy.distanceTo(this.pos) > CREAK_HEARD_FROM) return;
    this.investigate(this.pos.x, this.pos.y);
  }

  /**
   * Go and look at a noise.  Never a promotion to hunting: if he can already
   * see you he is doing something better than this, and if he cannot then a
   * sound is not allowed to tell him where you are.
   */
  private investigate(x: number, z: number): void {
    if (this.fMode === 'chase') return;
    // He heard a direction and a rough distance, not a position.
    const slop = () => (Math.random() - 0.5) * 2 * CREAK_SLOP;
    const guess = new THREE.Vector2(x + slop(), z + slop());
    this.clampToRoom(guess);
    if (this.solid(guess.x, guess.y, 0.5)) guess.set(x, z); // do not send him into a sofa

    this.fMode = 'investigate';
    this.investigateT = INVESTIGATE_S;
    this.waypoint.copy(guess);
    this.startTrip();
    this.targetSpot = null;
  }

  private alert(): void {
    if (this.inSecret || this.fMode === 'chase') return;
    // Running is louder than a board, so he gets a better fix on it — but it
    // is still only a place to walk to.
    this.lastSeen.copy(this.pos);
    this.investigate(this.pos.x, this.pos.y);
  }

  private sees(): boolean {
    // THE SAFETY, AT THE ROOT.  Sight, hearing and the catch test all come
    // back through here or through `inSecret` directly, so there is one answer
    // rather than four places that each have to remember.
    if (this.inSecret) return false;
    const dx = this.pos.x - this.froggy.x;
    const dz = this.pos.y - this.froggy.y;
    const dist = Math.hypot(dx, dz);
    if (dist > VIEW_RANGE) return false;
    const delta = Phaser.Math.Angle.Wrap(Math.atan2(dx, dz) - this.froggyYaw);
    if (dist > 1.6 && Math.abs(delta) > VIEW_HALF) return false;

    const steps = Math.ceil(dist / 0.5);
    for (let i = 1; i < steps; i++) {
      const f = i / steps;
      if (this.opaque(this.froggy.x + dx * f, this.froggy.y + dz * f, this.crouching)) return false;
    }
    return true;
  }

  /**
   * The furniture in his way, if any.  Sight and bodies both use `solid`; this
   * is for the one thing that needs to know WHAT is blocking it rather than
   * just that something is.
   */
  private blockerAt(x: number, z: number, pad: number): Box | null {
    for (const b of this.blockers) {
      if (Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) return b;
    }
    return null;
  }

  /**
   * Go over it.
   *
   * A room full of furniture used to be a room full of walls he shouldered
   * against: he would slide along a sofa, give up, pick another waypoint and
   * leave, which made cover permanent and the far side of a table completely
   * safe.  Now anything short enough gets climbed — he mounts it, crosses the
   * top and drops off the other side, and while he is doing it nothing is
   * solid to him.  Only the full-height partitions and the racking still stop
   * him, because those are the sightlines the round is played around.
   *
   * The player cannot do this.  That asymmetry is the threat.
   */
  private startClimb(box: Box, dirX: number, dirZ: number): boolean {
    if (this.climb || box.h > CLIMB_MAX_H) return false;

    const len = Math.hypot(dirX, dirZ) || 1;
    const ux = dirX / len;
    const uz = dirZ / len;
    // Far enough past the box to land clear of it, whichever way he crossed.
    const reach = Math.hypot(box.w, box.d) / 2 + 1.2;
    const from = this.froggy.clone();
    const to = new THREE.Vector2(this.froggy.x + ux * reach, this.froggy.y + uz * reach);
    this.clampToRoom(to);
    // Landing inside something else is worse than not climbing at all.
    if (this.solid(to.x, to.y, 0.5)) return false;

    this.climb = {
      from,
      to,
      top: box.h,
      t: 0,
      dur: Math.max(0.32, (box.h + from.distanceTo(to)) / CLIMB_SPEED),
      mount: CLIMB_MOUNT_S,
      land: CLIMB_LAND_S,
    };
    this.wantYaw = Math.atan2(to.x - from.x, to.y - from.y);
    this.play('hop_wet', this.earshot(from.x, from.y, EARSHOT, 0));
    return true;
  }

  /** 0..1 how far into the climb, by beat: -1 mounting, 0..1 crossing, 2 landing. */
  private climbBeat(): { beat: 'mount' | 'cross' | 'land'; k: number } {
    const c = this.climb!;
    if (c.t < c.mount) return { beat: 'mount', k: c.t / c.mount };
    if (c.t < c.mount + c.dur) return { beat: 'cross', k: (c.t - c.mount) / c.dur };
    return { beat: 'land', k: Math.min(1, (c.t - c.mount - c.dur) / c.land) };
  }

  /** Runs a climb to its end.  Returns true while he is still on top of it. */
  private stepClimb(dt: number): boolean {
    const c = this.climb;
    if (!c) return false;
    c.t += dt;
    // He faces the thing he is climbing, and turns to it before he moves.
    const dyaw = Phaser.Math.Angle.Wrap(this.wantYaw - this.froggyYaw);
    this.froggyYaw = Phaser.Math.Angle.Wrap(this.froggyYaw + Phaser.Math.Clamp(dyaw, -FROGGY_TURN * dt, FROGGY_TURN * dt));
    const { beat, k } = this.climbBeat();
    if (beat === 'mount') this.froggy.copy(c.from);
    else if (beat === 'cross') this.froggy.lerpVectors(c.from, c.to, k);
    else this.froggy.copy(c.to);
    if (c.t >= c.mount + c.dur + c.land) {
      this.climb = null;
      this.fStep = 0;
      this.fSpeed *= 0.5;
      this.play('froggy_step', this.earshot(this.froggy.x, this.froggy.y, EARSHOT, 0));
    }
    return true;
  }

  /** Furniture is solid to bodies and to sight.  `pad` widens it for him. */
  private solid(x: number, z: number, pad = PLAYER_R): boolean {
    // Two spaces, one test.  Inside the wall the room's own furniture is six
    // hundred metres away and irrelevant; only the lounge's is.
    if (this.inSecret && this.secret) {
      for (const b of this.secret.blockers) {
        if (Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) return true;
      }
      return false;
    }
    for (const b of this.blockers) {
      if (Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) return true;
    }
    for (const c of this.spots) {
      if (Math.abs(x - c.x) < c.hw + pad && Math.abs(z - c.z) < c.hd + pad) return true;
    }
    return false;
  }

  /**
   * What blocks SIGHT, which is not quite what blocks bodies: waist-height
   * furniture stops you walking but you can see over it — unless you are
   * crouched behind it, which is what crouching is for.
   */
  private opaque(x: number, z: number, lowCounts: boolean): boolean {
    for (const b of this.blockers) {
      if (b.low && !lowCounts) continue;
      if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return true;
    }
    for (const c of this.spots) {
      if (Math.abs(x - c.x) < c.hw && Math.abs(z - c.z) < c.hd) return true;
    }
    return false;
  }

  private clampToRoom(v: THREE.Vector2): void {
    if (this.inSecret && this.secret) {
      this.secret.clamp(v);
      return;
    }
    const d = this.def;
    // THE ONE HOLE IN THE WALL.  Every other millimetre of every wall clamps
    // exactly as it always did; inside the secret door's span the +X clamp is
    // pushed out far enough to step THROUGH, and movePlayer picks that up on
    // the next frame.  Doing it here rather than by deleting a collider is what
    // keeps it to this span: there is no geometry to get wrong, and nothing
    // else in the game -- him included -- ever calls this.
    const through = d.secretDoor && Math.abs(v.y - d.secretDoor.z) < d.secretDoor.w / 2;
    v.x = Phaser.Math.Clamp(v.x, -d.halfW + 0.6, through ? d.halfW + 1.4 : d.halfW - 0.6);
    v.y = Phaser.Math.Clamp(v.y, -d.halfD + 0.6, d.halfD - 0.6);
  }

  // ------------------------------------------------------------------ render

  private updateCamera(dt: number): void {
    const st = this.stage!;
    const cam = st.camera;

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.6);
    const jitter = this.shake * 0.06;

    // The escape owns the eye height and adds a pitch of its own, so the
    // player watches the key go down and comes back up with it.
    const esc = this.escaping ? this.escapePose() : null;
    const eyeWant = esc
      ? esc.eye
      : this.hiding
        ? this.hiding.kind === 'bed'
          ? 0.32
          : 0.85
        : this.crouching
          ? EYE_CROUCH
          : EYE;
    if (this.vault) {
      // Up and over.  Set rather than eased: the lerp below takes most of a
      // second to arrive and the whole climb is shorter than that, so easing
      // it would have him watching the counter go past at chest height.
      this.eyeNow = EYE + Math.sin(this.vault.t * Math.PI) * 0.85;
    } else {
      this.eyeNow += (eyeWant - this.eyeNow) * Math.min(1, dt * 9);
    }
    const y = this.eyeNow + (this.hiding ? 0 : Math.sin(this.bob) * 0.035);
    // ---- FEAR, WHICH IS NOT THE SAME AS SHAKING.
    //
    // Three things layered, none of them a clean oscillation: a fast fine
    // tremor, a slow sway underneath it, and a wander that comes from noise
    // rather than a sine -- so it reads as a person who cannot keep still
    // rather than as a camera being rattled.  It starts at a tenth and ends at
    // full, on a curve, because the last three seconds are the worst three.
    const tr = this.tremble;
    let shx = 0;
    let shy = 0;
    let shYaw = 0;
    let shPit = 0;
    if (tr > 0) {
      const t = this.trembleSeed;
      const fine = Math.sin(t * 17.3) * 0.55 + Math.sin(t * 23.9 + 1.7) * 0.45;
      const sway = Math.sin(t * 3.1 + 0.6) * 0.8 + Math.sin(t * 1.7 + 2.2) * 0.6;
      // and an occasional harder one, at no particular interval
      const jolt = Math.max(0, Math.sin(t * 0.83) - 0.86) * 9;
      shx = (fine * 0.018 + sway * 0.012 + (Math.random() - 0.5) * 0.01) * tr * (1 + jolt);
      shy = (Math.sin(t * 19.1 + 0.4) * 0.016 + sway * 0.009) * tr * (1 + jolt);
      shYaw = (fine * 0.012 + sway * 0.016) * tr * (1 + jolt);
      shPit = (Math.sin(t * 21.7 + 1.1) * 0.011 + sway * 0.008) * tr * (1 + jolt);
    }

    // The secret complex is built at SECRET_ORIGIN, and `pos` stays local to
    // whichever space the player is in, so the offset is applied once, here.
    const o = this.inSecret ? SECRET_ORIGIN : ZERO;
    cam.position.set(
      o.x + this.pos.x + (Math.random() - 0.5) * jitter + shx,
      o.y + this.floorY + y + (Math.random() - 0.5) * jitter + shy,
      o.z + this.pos.y,
    );
    // YXZ: yaw about the world's up, then pitch about the camera's own right.
    // The default XYZ order tips the horizon over as soon as both are non-zero.
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch + (esc ? esc.pitch : 0) + shPit, this.yaw + shYaw, 0);

    // Being hidden means being close to him and unable to move — the room
    // shakes when he is right outside, which is the only warning you get.
    if (this.hiding) {
      const d = this.froggy.distanceTo(this.pos);
      if (d < 3.2) this.shake = Math.max(this.shake, 1 - d / 3.2);
    }
  }

  private updateSprite(dt: number): void {
    const m = this.monster;
    if (!m) return;

    // Height off the floor: on the ground, or partway over something.
    let y = 0;
    let climbing = 0;
    // 0..1 across the whole crossing, for the hand-over-hand haul.  The model
    // needs to know how far up he is, not merely that he is up.
    let climbT = 0;
    if (this.climb) {
      const { beat, k } = this.climbBeat();
      climbT = beat === 'mount' ? 0 : beat === 'cross' ? k : 1;
      const top = this.climb.top;
      if (beat === 'mount') {
        // Reaching up: the pose comes on, feet still on the floor.
        climbing = k;
        y = 0;
      } else if (beat === 'cross') {
        // Up the near face, over the top, down the far face — and on the floor
        // at BOTH ends, so he never stands on air past the far edge.  A
        // version of this arc ended half the obstacle's height up and he
        // hung there; that is the floating that was reported.
        climbing = 1;
        y = top * Math.max(0, Math.min(1, k * 3, (1 - k) * 3));
      } else {
        // Landed: crouched from the drop, straightening as the pose lets go.
        climbing = 1 - k;
        y = 0;
      }
    }

    // The model is built facing +Z and `froggyYaw` is already the angle that
    // points +Z at whatever he is going towards, so it goes in as it is.  It
    // used to get a half turn added, which walked him backwards through the
    // whole round: what came at you was the back of his head, and the face —
    // the entire point of him — was aimed at the wall behind.
    m.setPose(this.froggy.x, y, this.froggy.y, this.froggyYaw);

    // The walk runs off ground actually covered rather than off which mode he
    // is in, so a pause reads as a pause and the prowl reads as a prowl.
    const moved = this.froggy.distanceTo(this.froggyWas) / Math.max(dt, 0.0001);
    this.froggyWas.copy(this.froggy);

    const pose = {
      speed: Math.min(6, moved),
      // The mouth is shut while he is looking for you and open once he is not.
      maw: this.fMode === 'chase' ? 1 : this.fMode === 'openSpot' ? 0.45 : 0.12,
      climb: climbing,
      climbT,
      // Down on his haunches at a bed, craning about under it.
      crouch: this.bedCrouch(),
      peer: 1,
      // Hunting, his head swings slowly across the room.  Once he has you it
      // stops dead on you and stays there, which is much worse than the swing.
      // Investigating, he sweeps his head faster and wider: looking FOR
      // something rather than merely looking.
      scan:
        this.fMode === 'chase'
          ? 0
          : Math.sin(this.clock * (this.fMode === 'investigate' ? 1.5 : 0.55)) *
            (this.fMode === 'investigate' ? 0.75 : 0.5),
      lunge: this.fMode === 'chase' ? 1 : 0,
    };
    m.update(dt, pose);
    // ---- AND THE SAME POSE, DOWN THE HOLE.  The enclosure under the secret
    // room's glass is this room, so the thing in it is this model: one hunt,
    // drawn twice, rather than two hunts that have to be kept in step.
    this.secret?.watch({ x: this.froggy.x, y, z: this.froggy.y, yaw: this.froggyYaw, pose });
  }

  /**
   * All UI lives here.  The 3D canvas sits above Phaser's, so a Phaser text
   * object in this scene is behind the world and invisible.  The overlay's
   * context is already transformed into 320x180 game space.
   */
  private paintOverlay(): void {
    // The jumpscare owns the overlay from the moment he finds you.
    if (this.mode === 'caught') return;
    froggyLayer.paint((ctx) => {
      if (this.hiding) this.paintPeephole(ctx);

      if (this.mode === 'survived') {
        ctx.fillStyle = `rgba(4,8,10,${Math.min(0.8, this.endT * 1.4)})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        // Downstairs it is a report on the round.  Out of the arcade it is a
        // verdict on the night, and it gets the bigger of the two.
        drawPixelText(ctx, this.isFinal ? 'You have survived.' : 'HE NEVER FOUND YOU', GAME_W / 2, GAME_H * 0.42, {
          scale: 2,
          color: '#e8e2cd',
          center: true,
        });
      }

      // The count, and then his hunt.  Both are the same clock, and it
      // is the only thing on screen that is not the room.
      if (this.mode === 'briefing') {
        // No number yet.  The count has not started, and it says so.
        drawPixelText(ctx, 'DO NOT MOVE', GAME_W / 2, GAME_H * 0.3, {
          scale: 1,
          color: '#7a8494',
          center: true,
          alpha: 0.75,
        });
      } else if (this.mode === 'hiding') {
        drawPixelText(ctx, `${Math.max(0, Math.ceil(this.clock))}`, GAME_W / 2, GAME_H * 0.3, {
          scale: 3,
          color: '#e8e2cd',
          center: true,
          alpha: 0.9,
        });
      } else if (this.mode === 'seeking' && this.isFinal && this.escaping) {
        // The objective is answered; there is nothing left to tell them and
        // the last thing the room should be doing is talking.
      } else if (this.mode === 'seeking' && this.isFinal) {
        // WHAT TO DO, NOT HOW LONG IS LEFT.  A clock in the corner of this
        // room would be answering a question nobody asked: there is no time
        // limit here, only a door, and the player has to be told which.
        drawPixelText(ctx, 'OBJECTIVE', 6, 6, { scale: 1, color: '#7a8494', alpha: 0.8 });
        drawPixelText(ctx, 'REACH THE DOOR', 6, 16, { scale: 1.5, color: '#ffd45e', alpha: 0.9 });
      } else if (this.mode === 'seeking') {
        const left = Math.max(0, Math.ceil(this.clock));
        const mm = Math.floor(left / 60);
        const ss = `${left % 60}`.padStart(2, '0');
        drawPixelText(ctx, `${mm}:${ss}`, GAME_W - 44, 6, {
          scale: 1.5,
          color: left <= 30 ? '#ffd45e' : '#7a8494',
          alpha: 0.85,
        });
      }

      if (this.subtitle) {
        drawPixelText(ctx, this.subtitle, GAME_W / 2, GAME_H - 30, {
          scale: fitScale(this.subtitle),
          color: '#e8e2cd',
          center: true,
        });
      }

      if (this.prompt && !this.hiding && (this.mode === 'hiding' || this.mode === 'seeking')) {
        drawPixelText(ctx, this.prompt, GAME_W / 2, GAME_H * 0.62, {
          scale: fitScale(this.prompt),
          color: '#ffd45e',
          center: true,
          alpha: 0.9,
        });
      }

    });
  }

  /** A slit of vision, and everything else is the inside of the box. */
  private paintPeephole(ctx: CanvasRenderingContext2D): void {
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, GAME_W, GAME_H);
    ctx.ellipse(cx, cy, GAME_W * 0.23, GAME_H * 0.16, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill('evenodd');
    ctx.restore();

    // A soft rim, so it reads as a gap in the lid rather than a mask laid over
    // the picture.
    const g = ctx.createRadialGradient(cx, cy, GAME_W * 0.15, cx, cy, GAME_W * 0.26);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.95)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    drawPixelText(ctx, '[E] COME OUT', GAME_W / 2, GAME_H - 16, {
      scale: 1,
      color: '#7a8494',
      center: true,
      alpha: 0.8,
    });
  }

  private publishTelemetry(): void {
    if (!import.meta.env?.DEV) return;
    (window as unknown as Record<string, unknown>).__hide = {
      room: this.roomIndex,
      roomName: this.def.name,
      mode: this.mode,
      froggyMode: this.fMode,
      px: this.pos.x,
      pz: this.pos.y,
      fx: this.froggy.x,
      fz: this.froggy.y,
      dist: this.pos.distanceTo(this.froggy),
      hiding: !!this.hiding,
      climbing: !!this.climb,
      froggySpeed: this.froggySpeed(),
      investigating: this.fMode === 'investigate',
      investigateLeft: this.investigateT,
      creakChance: CREAK_CHANCE,
      memorySeconds: MEMORY_S,
      unseenSeconds: this.unseenT,
      froggySearch: FROGGY_SEARCH,
      froggyProwl: FROGGY_PROWL,
      lostYouSeconds: LOST_YOU_S,
      froggyMeshes: this.froggyMeshes,
      froggyScale: this.isFinal ? FINAL_SCALE : FROGGY_SCALE,
      roomPace: ROOM_PACE[Math.min(this.roomIndex, ROOM_PACE.length - 1)],
      crouching: this.crouching,
      pathLength: this.path.length,
      sweep: this.sweep,
      checkedThisSweep: this.spots.filter((c) => c.checkedOn >= this.sweep).length,
      secondsLeft: this.clock,
      hideSeconds: HIDE_S,
      seekSeconds: seekFor(this.roomIndex),
      briefingLine: this.briefLine,
      spots: this.spots.map((c) => ({ x: c.x, z: c.z, kind: c.kind, open: c.open })),
      heard: this.heard.slice(),
      playerRun: RUN,
      froggyChase: FROGGY_CHASE,
      doorX: this.def.door.x,
      doorZ: this.def.halfD,
      atDoor: this.atDoor(),
      atCase: this.atCase(),
      atCounter: this.atCounter(),
      inSecret: this.inSecret,
      secretRun: SECRET_RUN,
      /** What running is worth where the player is standing, right now. */
      runNow: RUN * (this.inSecret ? SECRET_RUN : 1),
      /** The enclosure under the glass, and the twin of him in it. */
      pen: this.secret?.watching() ?? null,
      toSecret: () => this.enterSecret(),
      hasSecret: !!this.def.secretDoor,
      secretDoorZ: this.def.secretDoor?.z ?? null,
      atButton: this.atButton(),
      floorY: this.floorY,
      vaulting: !!this.vault,
      vaulted: this.vaulted,
      yaw: this.yaw,
      pitch: this.pitch,
      doorFacing: this.doorFacing(),
      keyOnFloor: this.keyOnFloor,
      keyTaken: this.keyTaken,
      grabbing: this.grabbing,
      grabT: this.grabT,
      grabSeconds: GRAB_S,
      handUp: !!this.handProp,
      keyInHand: !!this.keyProp && this.keyProp.parent === this.handProp,
      keyX: this.keyAt.x,
      keyZ: this.keyAt.y,
      atKey: this.atKey(),
      charging: this.charging,
      chaseT: this.chaseT,
      chaseSeconds: CHASE_S,
      chargeAt: CHARGE_AT,
      dropSeconds: KEY_DROP_S,
      unlockT: this.unlockT,
      unlockSeconds: UNLOCK_S,
      escapeYaw: ESCAPE_YAW,
      escaping: this.escaping,
      escapeK: this.escapeK,
      tremble: this.tremble,
      eyeNow: this.eyeNow,
      tumblers: this.tumbler,
      prompt: this.prompt,
      subtitle: this.subtitle,
      hasKey: store.get().hasKey,
      isFinal: this.isFinal,
      dbg: {
        fwd: this.held('fwd'),
        strafe: (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0),
        looking: this.looking,
        frames: ++this.frames,
        blockedAtSpawn: this.solid(this.pos.x, this.pos.y),
        froggyBlocked: this.solid(this.froggy.x, this.froggy.y, 0.5),
      },
    };
  }

  // ----------------------------------------------------------------- endings

  /** Found.  There is no beat between the two — the scare IS the catch. */
  private caught(): void {
    if (this.mode !== 'seeking') return;
    audio.setScene(SILENCE);
    this.mode = 'caught';
    this.caughtT = 0;
    this.hiding = null;
    playJumpscare(this);

    this.time.delayedCall(SCARE_MS + 700, () => {
      froggyLayer.clear();
      this.scene.restart();
    });
  }

  /**
   * The button, and on to the next room.
   *
   * It is the same advance the clock running out gives you, taken early and
   * from somewhere he cannot follow.  No card: HE NEVER FOUND YOU is a verdict
   * on a round that was played, and this was not one.
   */
  private leaveBySecret(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.prompt = '';
    this.subtitle = '';
    audio.sfx('chime', 0.8);
    this.time.delayedCall(700, () => {
      const next = this.roomIndex + 1;
      froggyLayer.clear();
      if (next >= ROOMS.length) {
        store.patch({ route: 'chase', hideRoom: 0 });
        store.flush();
        this.scene.start('Chase3D');
        return;
      }
      store.patch({ hideRoom: next });
      store.flush();
      this.scene.restart();
    });
  }

  /**
   * Out.
   *
   * Downstairs this is his clock running out: he did not find you, he gives up,
   * and the door he locked is open again — the round was the point, not the
   * door.  In the arcade it is the lock finally turning, which is a different
   * thing entirely, and it ends the night rather than the room.
   */
  private survive(): void {
    if (this.mode !== 'seeking') return;
    this.mode = 'survived';
    this.endT = 0;
    this.hiding = null;
    this.subtitle = '';
    this.prompt = '';
    this.unlockT = 0;
    this.tumbler = 0;
    this.escaping = false;
    this.escapeMark = null;
    this.grabbing = false;
    this.monster?.setVisible(false);
    audio.setScene(SILENCE);
    // The last of the five: the bolt coming back, and then the door.
    if (this.isFinal) {
      audio.sfx('lock_click', 1);
      this.time.delayedCall(280, () => audio.sfx('door_open'));
    } else {
      audio.sfx('door_creak');
    }

    const next = this.roomIndex + 1;
    this.time.delayedCall(this.isFinal ? 4200 : 3000, () => {
      if (this.isFinal) {
        // THE NIGHT IS OVER, and the game goes back to being a game.  The run
        // returns to the ordinary route so the arcade is open again — but it
        // is not the same arcade, because `froggyGone` stays set: the blackjack
        // table has somebody else behind it, and running out of tokens no
        // longer summons anybody (see core/broke).
        store.patch({ route: 'normal', hideRoom: 0, froggyGone: true });
        // AND YOU COME OUT WITH ONE TOKEN.  Not a reward and not a handout --
        // it is what was in the pocket, and it is exactly enough for one go on
        // the cheapest machine in the building.
        ledger.setAfterNight(1);
        store.flush();
        froggyLayer.clear();
        this.scene.start('StartScreen');
        return;
      }
      if (next >= ROOMS.length) {
        store.patch({ route: 'chase', hideRoom: 0 });
        store.flush();
        this.scene.start('Chase3D');
        return;
      }
      store.patch({ hideRoom: next });
      store.flush();
      this.scene.restart();
    });
  }

  private teardown(): void {
    if (this.onMove) window.removeEventListener('mousemove', this.onMove);
    if (this.onDown) window.removeEventListener('mousedown', this.onDown);
    if (this.onUp) {
      window.removeEventListener('mouseup', this.onUp);
      window.removeEventListener('blur', this.onUp);
    }
    this.onMove = null;
    this.onDown = null;
    this.onUp = null;
    this.looking = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.secret?.dispose();
    this.secret = null;
    this.stage?.dispose();
    this.stage = null;
    froggyLayer.clear();
    delete (window as unknown as Record<string, unknown>).__hide;
  }

  update(): void {
    // The prompt is cheap to recompute and needs to track the player.
    // It also comes DOWN for the escape: there is nothing left to press, and
    // a line reading HOLD [E] over a sequence that no longer wants anything
    // held is the game contradicting itself for ten seconds.
    if ((this.mode !== 'hiding' && this.mode !== 'seeking') || this.hiding || this.escaping) {
      // ONE EXCEPTION, and it is the only thing the sequence asks for: the key
      // he dropped, once the player has looked down far enough to see it.
      this.prompt = this.atKey() ? '[E] PICK IT UP' : '';
      return;
    }

    if (this.inSecret) {
      // NOTHING PROMPTS THE WALL, on either side of it.  The button is the one
      // thing in the sequence that is allowed to shout, and only once you are
      // standing in a room nobody was told about.
      this.prompt = this.atButton() ? '[E] GO ON' : '';
      return;
    }
    const spot = this.nearestSpot(SPOT_REACH);
    if (spot) {
      this.prompt = spot.kind === 'chest' ? '[E] GET IN' : '[E] GET INSIDE';
    } else if (this.atCounter()) {
      this.prompt = '[E] CLIMB OVER';
    } else if (this.atDoor()) {
      // Short on purpose while it is turning: the ring is drawn round this
      // text, and a full sentence in a 60px circle is a sentence with a circle
      // through it.
      this.prompt = this.isFinal ? '[E] UNLOCK' : '[E] LOCKED';
    } else if (this.atCase()) {
      this.prompt = '[E] PRIZE CASE';
    } else {
      this.prompt = '';
    }
  }
}
