/**
 * Hide and seek.  First person, one room, one round.
 *
 * He gives you fifteen seconds.  He is not in the room for them and he does
 * not say anything: the count runs, you walk, you pick somewhere.  Then he
 * comes in and has three minutes to find you.  Last the three minutes and the
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
import { froggyLayer } from '../render/froggyLayer';
import { playJumpscare, SCARE_MS } from '../froggy/jumpscare';
import { FroggyMonster } from '../three/froggyMonster';
import { drawPixelText } from '../render/pixelFont';
import { ThreeStage } from '../render/threeStage';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { ROOMS, type Box, type RoomDef, type SpotKind } from '../three/hideRooms';
import { buildGrid, findPath, lineOpen, spotExtent, type NavGrid } from '../three/navGrid';
import { dressRoom, surfaceTexture } from '../three/hideDecor';

/** A walk is slow and silent; a run is fast and heard.  That is the trade. */
const WALK = 2.0;
const RUN = 4.0;
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
 * How big he is in here.  At 1x he was a man-sized thing across a large room;
 * he is now half again, which is what "something in the room with you" needs.
 * His reach scales with him.
 */
const FROGGY_SCALE = 1.35;
/** How quickly he can turn, radians per second.  Below this he slides. */
const FROGGY_TURN = 5.5;
/** How quickly he gets up to speed and back down, per second. */
const FROGGY_ACCEL = 9;

const VIEW_RANGE = 13;
const VIEW_HALF = Math.PI / 3.6;
/** How long he keeps coming after losing sight of you. */
const MEMORY_S = 4.0;
const CATCH_DIST = 1.15 * FROGGY_SCALE;

const SPOT_REACH = 1.6;
const DOOR_REACH = 2.2;

/**
 * What he says on the other side of the door, word for word, and how long each
 * line holds.  The last one is finished by a noise instead of a sentence.
 */
const BRIEFING: Array<[string, number]> = [
  ["LET'S PLAY ANOTHER GAME!", 2800],
  ['IF YOU SURVIVE WITH ME FOR 3 MINUTES,', 3000],
  ['I WILL SET YOU FREE.', 2800],
  // Two beats, because it will not fit the frame as one line.
  ['AND YOU BETTER NOT HIDE IN ONE PLACE,', 2800],
  ["'CAUSE I CAN SENSE YOUR SOUL.", 2800],
  ['IF NOT....', 2600],
];
/** How long his answer to "if not" is allowed to hang there. */
const BRIEFING_TAIL_MS = 2400;

/**
 * The count he gives you, and the time he then has to find you.
 *
 * He states both out loud before the round starts — "survive with me for 3
 * minutes" — so these two numbers are a promise the game has made and cannot
 * quietly retune.  See BasementSequence.paintOffer.
 */
const HIDE_S = 10;
const SEEK_S = 180;
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
/** How fast he goes over something, in metres of obstacle per second. */
const CLIMB_SPEED = 1.5;
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
 * what the next three minutes are.  You cannot move during it — there is
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
  private pos = new THREE.Vector2();
  private mode: Mode = 'hiding';
  /** Counts down through the hiding phase, then through his three minutes. */
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
  /** Held CTRL (or C).  Low, slow, quiet. */
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
  private subtitle = '';
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  /** True while the left mouse button is down: dragging the view around. */
  private looking = false;
  /** Last cursor position, for working out the drag by hand. */
  private lookX = 0;
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
    this.yaw = 0; // yaw 0 looks down -Z: into the room, door behind you
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
    if (this.roomIndex === 0) this.beginBriefing();
    else this.beginCountOnly();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  // ------------------------------------------------------------------- build

  private buildRoom(): void {
    const st = this.stage!;
    const d = this.def;
    st.scene.background = new THREE.Color(0x05060a);
    st.scene.fog = new THREE.FogExp2(0x05060a, 0.032);
    st.scene.add(new THREE.AmbientLight(0x45444a, 1.05));

    for (const l of d.lights) {
      // Reach has to scale with the room.  At 16m in a 36m lounge the bulbs lit
      // a puddle each and the rest was the torch and nothing.
      const bulb = new THREE.PointLight(l.color, l.intensity, 26, 1.3);
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
    wall(-d.halfW - 0.25, 0, 0.5, d.halfD * 2 + 1);
    wall(d.halfW + 0.25, 0, 0.5, d.halfD * 2 + 1);

    // the door out, set into the far wall
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x53331f });
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.2), doorMat);
    door.position.set(d.door.x, 1.2, d.halfD - 0.05);
    st.scene.add(door);
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xc9a62e }),
    );
    handle.position.set(d.door.x + 0.55, 1.15, d.halfD - 0.18);
    st.scene.add(handle);

    for (const f of d.furniture) {
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

    // Froggy himself: a real model, the same one the alley uses, so the thing
    // opening the lockers and the thing in the alley are one creature.  Hidden
    // for the count — the first fifteen seconds are yours, and nothing should
    // loom through them.
    this.monster = new FroggyMonster(FROGGY_SCALE);
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
      // CTRL as asked, and C beside it: the browser owns CTRL+W, and a player
      // crouch-walking forward should not lose the tab for it.
      crouch: bind(['CTRL', 'C']),
    };
    kb?.on('keydown-E', () => this.interact());

    // Window-level, not Phaser-level: the Three canvas is layered over the
    // Phaser one, so the scene's own pointer events never see the room.
    this.onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      this.looking = true;
      this.lookX = e.clientX;
      // Otherwise the drag selects the page furniture behind the canvas.
      e.preventDefault();
    };
    this.onMove = (e: MouseEvent) => {
      if (!this.looking) return;
      // Prefer the browser's own delta, fall back to tracking the cursor: some
      // browsers leave movementX at 0 outside pointer lock.
      const dx = e.movementX || e.clientX - this.lookX;
      this.lookX = e.clientX;
      this.yaw -= dx * LOOK_SENS;
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

  private interact(): void {
    if (this.mode !== 'hiding' && this.mode !== 'seeking') return;

    if (this.hiding) {
      this.stepOut(this.hiding);
      this.hiding = null;
      audio.sfx('footstep_concrete');
      return;
    }

    // The door is not the game any more.  It says so, once, and that is all.
    const d = this.def;
    if (Math.hypot(this.pos.x - d.door.x, this.pos.y - d.halfD) < DOOR_REACH) {
      this.say('LOCKED. THERE IS NOWHERE TO GO BUT UNDER SOMETHING.', 2400);
      return;
    }

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
    }
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
      this.clock -= dt;
      this.movePlayer(dt);
      this.moveFroggy(dt);
      this.checkCaught();
      this.roomTone(dt);
      if (this.clock <= 0) this.survive();
    } else if (this.mode === 'caught') {
      this.caughtT += dt;
    } else if (this.mode === 'survived') {
      this.endT += dt;
    }

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
  private beginBriefing(): void {
    this.monster?.setVisible(true);
    // Well down the room, facing you: near enough to read, far enough that he
    // is not the whole screen.
    this.froggy.set(this.def.spawn.x, this.def.spawn.z - 9);
    this.froggyWas.copy(this.froggy);
    this.froggyYaw = Math.atan2(this.pos.x - this.froggy.x, this.pos.y - this.froggy.y);
    this.fMode = 'listen';
    this.fTimer = 999;

    const say = (i: number): void => {
      const beat = BRIEFING[i];
      if (!beat) return;
      this.subtitle = beat[0];
      this.play('ui_hover', 0.35);
      this.time.delayedCall(beat[1], () => {
        if (this.mode !== 'briefing') return;
        if (i + 1 < BRIEFING.length) {
          say(i + 1);
          return;
        }
        // ...and then the noise, instead of the rest of the sentence.
        this.subtitle = '';
        audio.scare();
        this.cameras.main.shake(900, 0.03);
        this.time.delayedCall(BRIEFING_TAIL_MS, () => {
          if (this.mode !== 'briefing') return;
          this.mode = 'hiding';
          this.clock = HIDE_S;
          this.subtitle = '';
          this.monster?.setVisible(false);
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

  /** Rooms two and three: no speech, straight to the count. */
  private beginCountOnly(): void {
    this.monster?.setVisible(false);
    this.mode = 'hiding';
    this.clock = HIDE_S;
    this.fMode = 'search';
    this.fTimer = 0;
    // The echo: you got through the last one.  Once, on the way in, and not
    // a scare — the room does that itself in ten seconds.
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
    else if (this.clock > 5.2) this.subtitle = 'WASD MOVE - SHIFT RUN - CTRL CROUCH';
    else if (this.clock > 3.0) this.subtitle = 'HOLD LEFT CLICK TO LOOK';
    else if (this.clock > 1.2) this.subtitle = 'FIND SOMEWHERE TO HIDE';
    else this.subtitle = '';

    if (this.clock <= 0) {
      this.mode = 'seeking';
      this.clock = SEEK_S;
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

  /** A drip, now and then, quiet enough that his footsteps still cut through. */
  private roomTone(dt: number): void {
    this.dripIn -= dt;
    if (this.dripIn > 0) return;
    this.dripIn = 9 + Math.random() * 11;
    this.play('drip', 0.18);
  }

  private movePlayer(dt: number): void {
    // Turning on the keyboard works whatever else you are doing, including
    // from inside a box: knowing which way you are facing before you climb out
    // is worth having.
    const turn = (this.held('turnR') ? 1 : 0) - (this.held('turnL') ? 1 : 0);
    if (turn !== 0) this.yaw -= turn * TURN_RATE * dt;

    if (this.hiding) {
      this.pos.set(this.hiding.x, this.hiding.z);
      return;
    }

    const fwd = (this.held('fwd') ? 1 : 0) - (this.held('back') ? 1 : 0);
    const strafe = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    if (fwd === 0 && strafe === 0) return;

    this.crouching = this.held('crouch');
    const running = this.held('run') && !this.crouching;
    const speed = this.crouching ? CROUCH : running ? RUN : WALK;

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
        const lidAt = this.openSeconds() * 0.53;
        spot.opening = this.fTimer < lidAt;
        if (before >= lidAt && this.fTimer < lidAt) {
          this.play('spot_open', this.earshot(spot.x, spot.z, OPEN_EARSHOT, 0.3));
          spot.sinceChecked = 0;
        }
        if (this.fTimer < lidAt && this.hiding === spot) {
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
    if (this.mode !== 'seeking' || this.hiding) return;
    if (this.pos.distanceTo(this.froggy) < CATCH_DIST) this.caught();
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
    if (this.fMode === 'chase') return FROGGY_CHASE * pace;
    // Something made a noise, so he is not dawdling — but he is not chasing
    // either, because he has not seen anything to chase.
    if (this.fMode === 'investigate') return FROGGY_SEARCH * pace;
    return (this.unseenT > LOST_YOU_S ? FROGGY_PROWL : FROGGY_SEARCH) * pace;
  }

  private openSeconds(): number {
    return OPEN_S[Math.min(this.roomIndex, OPEN_S.length - 1)];
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
      this.fTimer = this.openSeconds();
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
    if (this.mode !== 'seeking') return;
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
    if (this.fMode === 'chase') return;
    // Running is louder than a board, so he gets a better fix on it — but it
    // is still only a place to walk to.
    this.lastSeen.copy(this.pos);
    this.investigate(this.pos.x, this.pos.y);
  }

  private sees(): boolean {
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
      dur: Math.max(0.6, (box.h + from.distanceTo(to)) / CLIMB_SPEED),
      mount: 0.32,
      land: 0.24,
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
    v.x = Phaser.Math.Clamp(v.x, -this.def.halfW + 0.6, this.def.halfW - 0.6);
    v.y = Phaser.Math.Clamp(v.y, -this.def.halfD + 0.6, this.def.halfD - 0.6);
  }

  // ------------------------------------------------------------------ render

  private updateCamera(dt: number): void {
    const st = this.stage!;
    const cam = st.camera;

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.6);
    const jitter = this.shake * 0.06;

    const eyeWant = this.hiding ? (this.hiding.kind === 'bed' ? 0.32 : 0.85) : this.crouching ? EYE_CROUCH : EYE;
    this.eyeNow += (eyeWant - this.eyeNow) * Math.min(1, dt * 9);
    const y = this.eyeNow + (this.hiding ? 0 : Math.sin(this.bob) * 0.035);
    cam.position.set(
      this.pos.x + (Math.random() - 0.5) * jitter,
      y + (Math.random() - 0.5) * jitter,
      this.pos.y,
    );
    cam.rotation.set(0, this.yaw, 0);

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
    if (this.climb) {
      const { beat, k } = this.climbBeat();
      const top = this.climb.top;
      if (beat === 'mount') {
        // Reaching up and hauling: the pose comes on, the body starts to rise.
        climbing = k;
        y = top * 0.3 * k * k;
      } else if (beat === 'cross') {
        // Up, along, and down: a flattened arc that tops out above the obstacle.
        climbing = 1;
        y = Math.sin(k * Math.PI) * 0.35 + top * Math.min(1, 0.3 + k * 2.2, (1 - k) * 2.2 + 0.55);
      } else {
        // Landing: down the last of it and the pose lets go.
        climbing = 1 - k;
        y = top * 0.35 * (1 - k) * (1 - k);
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

    m.update(dt, {
      speed: Math.min(6, moved),
      // The mouth is shut while he is looking for you and open once he is not.
      maw: this.fMode === 'chase' ? 1 : this.fMode === 'openSpot' ? 0.45 : 0.12,
      climb: climbing,
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
    });
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
        drawPixelText(ctx, 'HE NEVER FOUND YOU', GAME_W / 2, GAME_H * 0.42, {
          scale: 2,
          color: '#e8e2cd',
          center: true,
        });
      }

      // The count, and then his three minutes.  Both are the same clock, and it
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

      if (this.prompt && !this.hiding) {
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
      froggyScale: FROGGY_SCALE,
      roomPace: ROOM_PACE[Math.min(this.roomIndex, ROOM_PACE.length - 1)],
      crouching: this.crouching,
      pathLength: this.path.length,
      sweep: this.sweep,
      checkedThisSweep: this.spots.filter((c) => c.checkedOn >= this.sweep).length,
      secondsLeft: this.clock,
      hideSeconds: HIDE_S,
      seekSeconds: SEEK_S,
      briefingLine: this.briefLine,
      spots: this.spots.map((c) => ({ x: c.x, z: c.z, kind: c.kind, open: c.open })),
      heard: this.heard.slice(),
      playerRun: RUN,
      froggyChase: FROGGY_CHASE,
      doorX: this.def.door.x,
      doorZ: this.def.halfD,
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
   * Three minutes, and he did not find you.  He gives up and the door he locked
   * is open again — the round was the whole point, not the door.
   */
  private survive(): void {
    if (this.mode !== 'seeking') return;
    this.mode = 'survived';
    this.endT = 0;
    this.hiding = null;
    this.subtitle = '';
    this.monster?.setVisible(false);
    audio.setScene(SILENCE);
    audio.sfx('door_creak');

    const next = this.roomIndex + 1;
    this.time.delayedCall(3000, () => {
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
    this.stage?.dispose();
    this.stage = null;
    froggyLayer.clear();
    delete (window as unknown as Record<string, unknown>).__hide;
  }

  update(): void {
    // The prompt is cheap to recompute and needs to track the player.
    if ((this.mode !== 'hiding' && this.mode !== 'seeking') || this.hiding) {
      this.prompt = '';
      return;
    }
    const d = this.def;
    const spot = this.nearestSpot(SPOT_REACH);
    if (spot) {
      this.prompt = spot.kind === 'chest' ? '[E] GET IN' : '[E] GET INSIDE';
    } else if (Math.hypot(this.pos.x - d.door.x, this.pos.y - d.halfD) < DOOR_REACH) {
      this.prompt = '[E] LOCKED';
    } else {
      this.prompt = '';
    }
  }
}
