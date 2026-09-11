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

const WALK = 2.6;
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
const FROGGY_CHASE = RUN * 1.1;
/**
 * And what he does the rest of the time: 0.8x your top speed.
 *
 * Not a stroll.  He covers ground faster than you can walk and only a little
 * slower than you can run, so the room is never big enough to relax in — the
 * distance between you and him closes whether or not he knows where you are.
 */
const FROGGY_SEARCH = RUN * 0.8;
/**
 * And what he slows to once he has not laid eyes on you for a while.
 *
 * Losing you does not make him give up, it makes him careful: he stops
 * covering ground and starts working the room over, which is both creepier to
 * watch from inside a locker and the thing that gives a player who has just
 * broken his line of sight the seconds they need to get somewhere.
 */
const FROGGY_PROWL = RUN * 0.5;
const LOST_YOU_S = 5;
const EYE = 1.55;
const PLAYER_R = 0.42;

const VIEW_RANGE = 13;
const VIEW_HALF = Math.PI / 3.6;
/** How long he keeps coming after losing sight of you. */
const MEMORY_S = 4.0;
const CATCH_DIST = 1.15;

const SPOT_REACH = 1.6;
const DOOR_REACH = 2.2;

/**
 * What he says on the other side of the door, word for word, and how long each
 * line holds.  The last one is finished by a noise instead of a sentence.
 */
const BRIEFING: Array<[string, number]> = [
  ["LET'S PLAY ANOTHER GAME!", 2800],
  ['IF YOU SURVIVE WITH ME FOR 4 MINUTES,', 3000],
  ['I WILL SET YOU FREE.', 2800],
  ['IF NOT....', 2600],
];
/** How long his answer to "if not" is allowed to hang there. */
const BRIEFING_TAIL_MS = 2400;

/**
 * The count he gives you, and the time he then has to find you.
 *
 * He states both out loud before the round starts — "survive with me for 4
 * minutes" — so these two numbers are a promise the game has made and cannot
 * quietly retune.  See BasementSequence.paintOffer.
 */
const HIDE_S = 10;
const SEEK_S = 240;
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

/** He hears a run from here, even without seeing it. */
const HEAR_RUN = 9;
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
 * what the next four minutes are.  You cannot move during it — there is
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

interface Spot3D {
  x: number;
  z: number;
  kind: SpotKind;
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
  /** Counts down through the hiding phase, then through his four minutes. */
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
  /** Set while he is going over something: nothing blocks him until it ends. */
  private climb: {
    from: THREE.Vector2;
    to: THREE.Vector2;
    top: number;
    t: number;
    dur: number;
  } | null = null;
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
  private slideDir: 1 | -1 = 1;
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
    this.stage.start((dt) => this.tick(dt));

    this.bindInput();
    this.beginBriefing();
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

    const floorMat = new THREE.MeshLambertMaterial({ color: d.floor });
    const wallMat = new THREE.MeshLambertMaterial({ color: d.wall });
    const ceilMat = new THREE.MeshLambertMaterial({ color: d.ceiling });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(d.halfW * 2, d.halfD * 2), floorMat);
    floor.rotation.x = -Math.PI / 2;
    st.scene.add(floor);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(d.halfW * 2, d.halfD * 2), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = d.wallH;
    st.scene.add(ceil);

    const wall = (x: number, z: number, w: number, dp: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, d.wallH, dp), wallMat);
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
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(f.w, f.h, f.d),
        new THREE.MeshLambertMaterial({ color: f.color }),
      );
      mesh.position.set(f.x, f.h / 2, f.z);
      st.scene.add(mesh);
      this.blockers.push(f);
    }

    for (const c of d.spots) this.spots.push(this.buildSpot(c.x, c.z, c.rot, c.kind));

    // Froggy himself: a real model, the same one the alley uses, so the thing
    // opening the lockers and the thing in the alley are one creature.  Hidden
    // for the count — the first fifteen seconds are yours, and nothing should
    // loom through them.
    this.monster = new FroggyMonster();
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

    if (kind === 'chest') {
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
    return { x, z, kind, hinge, open: 0, opening: false, sinceChecked: 0 };
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
      this.hiding = spot;
      audio.sfx('hop_wet');
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
      if (c.kind === 'chest') c.hinge.rotation.x = -c.open * 1.5;
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
    else if (this.clock > 3.5) this.subtitle = 'WASD TO MOVE - HOLD LEFT CLICK TO LOOK';
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

    const running = this.held('run');
    const speed = running ? RUN : WALK;

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

    this.bob += dt * (running ? 9 : 5.5);
    this.stepT += dt * speed;
    if (this.stepT > 1.9) {
      this.stepT = 0;
      audio.sfx('footstep_concrete');
      // Running is loud.  He does not need to see you to know where you are.
      if (running && this.froggy.distanceTo(this.pos) < HEAR_RUN) this.alert();
      else if (Math.random() < CREAK_CHANCE) this.creak();
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
      if (this.fMode !== 'chase') audio.sfx('buzzer');
      this.fMode = 'chase';
      this.memory = MEMORY_S;
      this.lastSeen.copy(this.pos);
    } else if (this.fMode === 'chase') {
      this.memory -= dt;
      if (this.memory <= 0) {
        this.fMode = 'suspicious';
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
        // The lid comes up at the halfway mark, and it is heard when it does —
        // from anywhere in the room.  This is the sound the round is played by.
        spot.opening = this.fTimer < 0.9;
        if (before >= 0.9 && this.fTimer < 0.9) {
          this.play('spot_open', this.earshot(spot.x, spot.z, OPEN_EARSHOT, 0.3));
          spot.sinceChecked = 0;
        }
        if (this.fTimer < 0.9 && this.hiding === spot) {
          this.caught();
          return;
        }
      }
      if (this.fTimer <= 0) {
        if (this.targetSpot) this.targetSpot.opening = false;
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
    const speed = this.froggySpeed();
    const ax = target.x - this.froggy.x;
    const az = target.y - this.froggy.y;
    const dist = Math.hypot(ax, az);

    if (dist < ARRIVE_DIST) {
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

    this.froggyYaw = Math.atan2(ax, az);
    const nx = this.froggy.x + (ax / dist) * speed * dt;
    const nz = this.froggy.y + (az / dist) * speed * dt;
    // The outer walls are solid here too, not just in the clamp below.  If
    // they were not, a step into a wall counted as a clean step and none of
    // the stuck handling ever saw it.
    const freeX = this.inRoom(nx, this.froggy.y) && !this.solid(nx, this.froggy.y, 0.5);
    const freeZ = this.inRoom(this.froggy.x, nz) && !this.solid(this.froggy.x, nz, 0.5);

    const inTheWay =
      this.blockerAt(nx, nz, 0.5) ??
      this.blockerAt(nx, this.froggy.y, 0.5) ??
      this.blockerAt(this.froggy.x, nz, 0.5);

    if (freeX && freeZ) {
      this.froggy.x = nx;
      this.froggy.y = nz;
      this.stuckT = 0;
    } else if (inTheWay && this.startClimb(inTheWay, ax, az)) {
      // Straight over it.
      this.stuckT = 0;
    } else if (freeX || freeZ) {
      // Slide along whichever axis is open, at FULL speed.  Keeping only that
      // axis's share of the heading meant a waypoint straight through a sofa
      // moved him about a centimetre a second and he looked frozen.
      //
      // When the open axis is also the one he has no reason to move along —
      // the waypoint is dead ahead through the obstacle — he has to pick a side
      // to go around, and flip that choice if it is not getting him anywhere.
      this.stuckT += dt;
      if (this.stuckT > 1.4) {
        this.slideDir = this.slideDir === 1 ? -1 : 1;
        this.stuckT = 0;
      }
      if (freeX) {
        const dir = Math.abs(ax) > 0.4 ? Math.sign(ax) : this.slideDir;
        this.froggy.x += dir * speed * dt;
      } else {
        const dir = Math.abs(az) > 0.4 ? Math.sign(az) : this.slideDir;
        this.froggy.y += dir * speed * dt;
      }
    } else {
      // Blocked both ways: a pocket.  Give it a moment in case it is a corner
      // he is about to slide out of, then put him on open floor and send him
      // somewhere else.  This used to re-pick a waypoint every frame, which
      // was a different blocked heading every frame and read as a twitch.
      this.stuckT += dt;
      if (this.stuckT > 0.6) {
        this.stuckT = 0;
        this.freeFroggy(true);
        if (this.fMode !== 'chase') this.giveUpTrip();
      }
    }
    this.clampToRoom(this.froggy);
    this.footsteps(dt, speed);

    // Headway.  Sliding and climbing are both fine as long as they get him
    // somewhere; a trip that has not, for a while, is one he cannot make, and
    // he goes and checks somewhere else instead.  A chase is exempt — that is
    // him losing you behind a wall, and memory running out already ends it.
    this.headwayT += dt;
    if (this.headwayT >= HEADWAY_S) {
      const now = this.froggy.distanceTo(this.waypoint);
      const gained = this.headwayDist - now;
      this.headwayT = 0;
      this.headwayDist = now;
      if (gained < HEADWAY_DIST && this.fMode !== 'chase') this.giveUpTrip();
    }
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
    if (this.fMode === 'chase') return FROGGY_CHASE;
    // Something made a noise, so he is not dawdling — but he is not chasing
    // either, because he has not seen anything to chase.
    if (this.fMode === 'investigate') return FROGGY_SEARCH;
    return this.unseenT > LOST_YOU_S ? FROGGY_PROWL : FROGGY_SEARCH;
  }

  /** What he does on reaching a waypoint: check it, listen, or move on. */
  private arrive(): void {
    const spot = this.spotNear(this.froggy, 1.8);
    const roll = Math.random();
    // A spot he has not touched in a while gets opened almost every time.  That
    // is the pressure on the player: any one hiding place has a shelf life.
    if (spot && (spot.sinceChecked > STALE_S || roll < 0.5)) {
      this.targetSpot = spot;
      this.fMode = 'openSpot';
      this.fTimer = 1.7;
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
    let picked = false;
    if (this.spots.length > 0 && Math.random() < 0.8) {
      let best: Spot3D | null = null;
      for (let i = 0; i < 3; i++) {
        const c = Phaser.Utils.Array.GetRandom(this.spots);
        if (!best || c.sinceChecked > best.sinceChecked) best = c;
      }
      if (best) {
        this.waypoint.set(best.x, best.z);
        picked = true;
      }
    }
    if (!picked) {
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
      if (this.solid(this.froggy.x + dx * f, this.froggy.y + dz * f, 0)) return false;
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

    this.climb = { from, to, top: box.h, t: 0, dur: Math.max(0.7, (box.h + from.distanceTo(to)) / CLIMB_SPEED) };
    this.play('hop_wet', this.earshot(from.x, from.y, EARSHOT, 0));
    return true;
  }

  /** Runs a climb to its end.  Returns true while he is still on top of it. */
  private stepClimb(dt: number): boolean {
    const c = this.climb;
    if (!c) return false;
    c.t += dt;
    const k = Math.min(1, c.t / c.dur);
    this.froggy.lerpVectors(c.from, c.to, k);
    if (k >= 1) {
      this.climb = null;
      this.fStep = 0;
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
      if (Math.abs(x - c.x) < 0.55 + pad && Math.abs(z - c.z) < 0.4 + pad) return true;
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

    const y = this.hiding ? 0.85 : EYE + Math.sin(this.bob) * 0.035;
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
      const k = this.climb.t / this.climb.dur;
      // Up, along, and down: a flattened arc that tops out above the obstacle.
      y = Math.sin(Math.min(1, k) * Math.PI) * 0.35 + this.climb.top * Math.min(1, k * 2.2, (1 - k) * 2.2 + 0.55);
      climbing = 1;
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
        drawPixelText(ctx, `${mm}:${ss}`, GAME_W - 30, 6, {
          scale: 1,
          color: left <= 30 ? '#ffd45e' : '#7a8494',
          alpha: 0.85,
        });
      }

      if (this.subtitle) {
        drawPixelText(ctx, this.subtitle, GAME_W / 2, GAME_H - 26, {
          scale: 1,
          color: '#e8e2cd',
          center: true,
        });
      }

      if (this.prompt && !this.hiding) {
        drawPixelText(ctx, this.prompt, GAME_W / 2, GAME_H * 0.62, {
          scale: 1,
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
