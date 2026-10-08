/**
 * The night road.  Midnight, the arcade shut behind you, and the hotel at the
 * far end of a long straight road through the woods.
 *
 * It is a walk first, along the pavement: the hotel's windows small and warm
 * a long way off, the streetlights, the guard rails, the trees, a bus stop.
 * Something snaps in the trees behind you.  A little further on your head is
 * turned for you, back towards the hotel -- don't look back, just get there
 * -- and while you face that way he comes up the road behind you, low and
 * quiet.  Turn round and he is RIGHT there, unfolding.  Then the objective,
 * in red, and the run.
 *
 * The tuning is the design:
 *   walk 2.9 m/s, run 4.35, and he hunts at 4.6 -- faster than you, so the
 *     road alone does not save you unless you never stop
 *   he SEES you: a cone in front of him, longer under a lamp or on the open
 *     road, short in the dark under the trees, and the trunks block it
 *   he HEARS you: running, a branch snapping, water, gravel, the crows you put
 *     up out of the trees -- each has its own reach
 *   three seconds without sight of you and he stops chasing and starts looking
 *   the guard rails are solid on the walk in; once he is after you (RUN), a
 *     jump takes you over them -- walking never does -- and the gaps (the bus
 *     stop, the footpaths) let you through; they are a hop for him, which
 *     costs him; the ponds and the river are slow, and splash, for
 *     both
 *   push through the low branches and they rustle: the deeper in and the
 *     faster, the louder, and a loud rustle carries to him
 *   crouch (C) and you are slow, near silent and hard to pick out
 *   he follows your footsteps, and when you turn and look at him he looks
 *     back
 *   stay put too long while he is looking for you and, now and then, his
 *     search brings him past -- a few metres off, slow, looking about.  Under
 *     the low, heavy boughs of the big pines, crouched, he walks on by
 *   the hotel's doors are safe.  Nothing follows you through them.
 */

import { attachMouseLook, lockedDelta, lookScale } from '../core/look';
import { isPaused } from '../core/pause';
import Phaser from 'phaser';
import * as THREE from 'three';
import { audio, SILENCE, type SfxName } from '../core/audio';
import { isTouch } from '../core/device';
import { froggyLayer } from '../render/froggyLayer';
import { drawPixelText } from '../render/pixelFont';
import { playJumpscare, SCARE_MS } from '../froggy/jumpscare';
import { playJumpscare3D, prepareJumpscare3D, type Scare3D } from '../froggy/jumpscare3d';
import { FootDust } from '../three/footDust';
import { FroggyMonster } from '../three/froggyMonster';
import { ThreeStage } from '../render/threeStage';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { touchControls } from '../ui/touchControls';
import { HOTEL_CANOPY, HOTEL_DOOR, HOTEL_FLOORS, HOTEL_GROUND, HOTEL_H, HOTEL_PLANTERS, HOTEL_POSTS, HOTEL_W, paintCanopy, paintHotel } from '../art/hotel';

// ------------------------------------------------------------------- the map
//
// The road runs from the arcade's street (z = 0) down -Z to the hotel.

const ROAD_LEN = 180;
const HOTEL_Z = -ROAD_LEN;
/** The doors.  Past this line, between the door posts, you are inside. */
const SAFE_Z = HOTEL_Z + 0.6;
const SAFE_HALF = 2.6;
const ROAD_HALF = 4;
/** The pavements: from the kerb out to here, a hand high. */
const WALK_X = 6;
const KERB_H = 0.12;
/** Where the road and its pavements stop and the forecourt starts. */
const ROAD_END = -ROAD_LEN + 10;
/** The guard rails, either side, past the pavements, all the way to the forecourt. */
const RAIL_X = 6.5;
const RAIL_H = 0.72;
const RAIL_Z0 = 6;
const RAIL_Z1 = HOTEL_Z + 9;
/**
 * Openings in the rails: the bus stop's, and three footpaths into the woods.
 * Everywhere else a rail is a wall -- you cannot climb it or jump it.
 */
const GAPS: { side: number; z0: number; z1: number }[] = [
  { side: 1, z0: -23, z1: -31 },
  { side: -1, z0: -58, z1: -61 },
  { side: 1, z0: -86, z1: -89 },
  { side: -1, z0: -126, z1: -129 },
];
/** The bus stop, on the right, on its own pad through the first gap. */
const BUS_Z = -27;
/** How far the woods go before they are too thick to walk. */
const WORLD_X = 44;
const START_Z = 4;
const BACK_Z = 9;
/** Where something snaps in the trees behind you. */
const SOUND_Z = -8;
/** Where your head is turned for you, back to the hotel. */
const TURN_Z = -17;
/** A retry starts here, past the reveal. */
const REVEAL_Z = -ROAD_LEN * 0.2;
const RIVER_Z = -112;
const RIVER_HALF = 3.4;
const LAMP_ZS = [4, -20, -46, -74, -104, -132, -158];

const EYE = 1.6;
/** Eye height crouched, as a share of standing. */
const CROUCH_EYE = 0.6;
const CROUCH_SPEED = 0.55;
const PLAYER_R = 0.35;
const WALK = 2.9;
const RUN = WALK * 1.5;
const JUMP_V = 4.8;
const GRAVITY = 12;

const FROGGY_SCALE = 1.6;
const FROG_R = 0.55;
const HUNT = 4.6;
const INVESTIGATE = 3.4;
const SEARCH = 2.2;
const PATROL = 2.6;
const CATCH = 1.4;
/** Seconds without sight of you before he gives up chasing and starts looking. */
const LOST_AFTER = 3;
/** What to do, said straight after RUN. */
export const CHASE_HOW = 'Jump over the rails, hide behind trees or bushes to avoid Froggy, and make your way to the hotel.';

type Phase = 'walk' | 'turn' | 'creep' | 'reveal' | 'chase' | 'safe' | 'caught';

/** A solid box on the ground, for the bus stop's walls and bench. */
interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
type FrogMode = 'wait' | 'hunt' | 'investigate' | 'search' | 'patrol';

interface Crow {
  x: number;
  z: number;
  birds: THREE.Object3D[];
  /** Seconds since they went up; 0 while they sit. */
  flying: number;
}

interface Thicket {
  x: number;
  z: number;
  r: number;
  h: number;
  dense: number;
}

interface Circle {
  x: number;
  z: number;
  r: number;
  /** How far its branches reach out at a man's height (0: bare, or too high). */
  leaf?: number;
}

/** Same woods every night: a seeded generator, so a retry is the same road. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small canvas, as a crisp texture. */
function canvasTex(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Pull a flat thing towards the camera in the depth buffer, so it is drawn
 * over whatever it lies on and never flickers through it at a distance.
 */
function decal<M extends THREE.Material>(m: M, k = 1): M {
  m.polygonOffset = true;
  m.polygonOffsetFactor = -k;
  m.polygonOffsetUnits = -k * 2;
  return m;
}

export class NightRoad3D extends Phaser.Scene {
  private stage: ThreeStage | null = null;
  private monster: FroggyMonster | null = null;
  private footDust: FootDust | null = null;
  private scare: Scare3D | null = null;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private jumpKeys: Phaser.Input.Keyboard.Key[] = [];

  private yaw = 0;
  private dragging = false;
  private onLookDown: ((e: MouseEvent) => void) | null = null;
  private onLookMove: ((e: MouseEvent) => void) | null = null;
  private onLookUp: (() => void) | null = null;

  private pos = new THREE.Vector2();
  private y = 0;
  private vy = 0;
  private bobT = 0;
  private stepT = 0;
  private moving = false;
  private running = false;
  private crouched = false;
  private wasWet = false;
  /** (for the test hooks: how many of each the scene has made) */
  private counts = { rustle: 0, splash: 0, wade: 0 };
  private rustleT = 0;
  private ripples: { m: THREE.Mesh; t: number }[] = [];
  private rippleMat: THREE.MeshBasicMaterial | null = null;
  private twinkle: THREE.PointsMaterial | null = null;
  private eye = EYE;
  /** The camera being turned for you: from, to, and how far along. */
  private autoTurn: { from: number; to: number; t: number } | null = null;
  private heardSnap = false;
  private shake = 0;
  private boxes: Box[] = [];
  private posts: Circle[] = [];
  private waterMats: THREE.Texture[] = [];
  private sky: THREE.Group | null = null;
  /** The CLOSED sign over the arcade's doors, flickering. */
  private beacon: { mesh: THREE.Mesh; light: THREE.PointLight } | null = null;
  /** Going to a sound he could place exactly: he comes at a run. */
  private urgent = false;
  /** The river's current and its glints, which run downstream (-x). */
  private riverFlow: THREE.Texture[] = [];

  private froggy = new THREE.Vector2();
  private fy = 0;
  private fYaw = 0;
  private fMode: FrogMode = 'wait';
  private fHop = 0;
  private fSpeed = 0;
  private lostT = 0;
  private searchT = 0;
  private wander = new THREE.Vector2();
  private lastKnown = new THREE.Vector2();
  private seen = false;
  /**
   * HOW AWARE OF YOU HE IS, 0..1+.  It builds while he can see you -- faster
   * close up, in the open, moving, dead ahead of him -- and drains slowly
   * once he can't.  Past a third he has half-seen something and goes to look
   * where it was; at 1 he has you.  (See `watchFor`.)
   */
  private aware = 0;
  /** Seconds since he last actually saw you. */
  private sinceSeen = 99;

  private phase: Phase = 'walk';
  private phaseT = 0;
  private retry = false;
  private clock = 0;

  private trees: Circle[] = [];
  private treeGrid = new Map<string, number[]>();
  private ponds: Circle[] = [];
  /** The big pines' low boughs: crouch inside one and you are under cover. */
  private skirts: Circle[] = [];
  /** Big bushes you can get into: h is how tall, dense how thick (0..1). */
  private thickets: Thicket[] = [];
  private inThicket: Thicket | null = null;
  private thicketT = 0;
  /** What the foliage shaders read: the breeze, you, and how hard you shook it. */
  private wind = {
    uTime: { value: 0 },
    uPlayer: { value: new THREE.Vector4() },
    uShake: { value: 0 },
    uGust: { value: 0 },
  };
  private gustT = 8;
  private gust = 0;
  private riverT = 0;
  private rapidsT = 0;
  private plipT = 3;
  private creakT = 6;
  private rapids: { x: number; z: number }[] = [];
  private foam: THREE.MeshBasicMaterial[] = [];
  private fall: { pts: THREE.Points; vel: Float32Array } | null = null;
  /** How long you have stood in one place, and his walk past if it comes. */
  private stillT = 0;
  private passT = 0;
  private passBy: { a: THREE.Vector2; b: THREE.Vector2; leg: 0 | 1 } | null = null;
  private rubble: Circle[] = [];
  private twigs: { x: number; z: number; t: number }[] = [];
  private crows: Crow[] = [];
  private crowAmbientT = 6;

  private lines: { text: string; from: number; until: number; red?: boolean }[] = [];
  private hintT = 0;
  /** Once over a rail in the chase: the hiding hint, for a while, the first time. */
  private overRail = false;
  private hideHintT = 0;
  /** How long the jump hint has been up at the rail, and whether it is up. */
  private railHint = 0;
  private padSyncT = 0;

  constructor() {
    super('NightRoad3D');
  }

  init(data: { retry?: boolean } = {}): void {
    this.retry = !!data.retry;
  }

  create(): void {
    audio.preloadScream();
    froggyLayer.clear();
    audio.setScene(SILENCE);
    this.phase = 'walk';
    this.phaseT = 0;
    this.clock = 0;
    this.fMode = 'wait';
    this.urgent = false;
    this.scare = null;
    this.lines = [];
    this.y = this.vy = 0;
    this.trees = [];
    this.treeGrid.clear();
    this.ponds = [];
    this.rubble = [];
    this.twigs = [];
    this.crows = [];
    this.boxes = [];
    this.posts = [];
    this.skirts = [];
    this.thickets = [];
    this.inThicket = null;
    this.thicketT = 0;
    this.rapids = [];
    this.foam = [];
    this.fall = null;
    this.gust = 0;
    this.gustT = 8;
    this.stillT = 0;
    this.passT = 0;
    this.passBy = null;
    this.aware = 0;
    this.sinceSeen = 99;
    this.waterMats = [];
    this.riverFlow = [];
    this.crouched = false;
    this.wasWet = false;
    this.counts = { rustle: 0, splash: 0, wade: 0 };
    this.rustleT = 0;
    this.ripples = [];
    this.eye = EYE;
    this.autoTurn = null;
    this.heardSnap = false;
    this.shake = 0;
    this.hintT = 0;
    this.overRail = false;
    this.hideHintT = 0;
    this.railHint = 0;
    this.padSyncT = 0;

    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000).setOrigin(0, 0);
    this.cameras.main.fadeIn(800, 0, 0, 0);

    const root = document.getElementById('game-root');
    if (!root) return;
    this.stage = new ThreeStage();
    this.stage.mount(root, this.game.canvas);
    this.build();

    // You walk on the right-hand pavement.  A retry puts you back a little
    // past where he came up behind you, with him already on the road.
    this.pos.set(4.9, this.retry ? REVEAL_Z + 5 : START_Z);
    this.yaw = 0;
    this.froggy.set(0, 40);
    if (this.monster) this.monster.root.visible = false;

    if (this.retry) {
      this.froggy.set(0.5, this.pos.y + 16);
      this.fYaw = Math.PI;
      if (this.monster) this.monster.root.visible = true;
      this.phase = 'chase';
      this.fMode = 'wait';
      this.sayNow('RUN.', 1.8, true);
      this.say(CHASE_HOW, 6);
    } else {
      this.say("It's so quiet out here.", 3);
      this.say('The hotel is at the end of this road.', 3.4);
      this.say('Just keep walking.', 2.6);
    }

    const kb = this.input.keyboard;
    if (kb) {
      this.keys = {
        up: [kb.addKey('W'), kb.addKey('UP')],
        down: [kb.addKey('S'), kb.addKey('DOWN')],
        left: [kb.addKey('A'), kb.addKey('LEFT')],
        right: [kb.addKey('D'), kb.addKey('RIGHT')],
        turnL: [kb.addKey('Q')],
        turnR: [kb.addKey('E')],
        run: [kb.addKey('SHIFT')],
      };
      this.jumpKeys = [kb.addKey('SPACE')];
      // Crouch is a toggle, as it is in the hide rooms.
      kb.on('keydown-C', () => {
        if (this.phase === 'safe' || this.phase === 'caught') return;
        this.crouched = !this.crouched;
      });
    }

    // Look exactly as the chase does: pointer lock if the browser gives it, a
    // held left-drag if not, which is what the on-screen look pad sends.
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.autoTurn) return;
      if (p.event instanceof MouseEvent && document.pointerLockElement) this.yaw -= lockedDelta(p.event).dx * 0.0027 * lookScale();
    });
    this.onLookDown = (e: MouseEvent) => {
      if (e.button === 0 && !isPaused()) this.dragging = true;
    };
    this.onLookMove = (e: MouseEvent) => {
      if (!this.dragging || document.pointerLockElement || isPaused() || this.autoTurn) return;
      this.yaw -= (e.movementX || 0) * ((e as MouseEvent & { lookSens?: number }).lookSens ?? 0.0042) * lookScale();
    };
    this.onLookUp = () => {
      this.dragging = false;
    };
    window.addEventListener('mousedown', this.onLookDown);
    window.addEventListener('mousemove', this.onLookMove);
    window.addEventListener('mouseup', this.onLookUp);
    window.addEventListener('blur', this.onLookUp);
    attachMouseLook(this);

    this.stage.start((dt) => this.tick(dt));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    if (import.meta.env?.DEV) this.bridge();
  }

  // ===================================================================== world

  private build(): void {
    const st = this.stage!;
    const S = st.scene;
    const R = rng(0x6c11);
    // A nearer near plane than the default gives the depth buffer the
    // precision to keep the road, its kerbs, the pavements and the forecourt
    // apart all the way to the hotel -- they used to shimmer through each
    // other a few dozen metres out.
    st.camera.near = 0.2;
    st.camera.far = 420;
    st.camera.updateProjectionMatrix();
    S.background = new THREE.Color(0x04070e);
    S.fog = new THREE.FogExp2(0x05080f, 0.038);

    S.add(new THREE.HemisphereLight(0x2c3a58, 0x080a09, 0.72));
    const moon = new THREE.DirectionalLight(0x8fa4d0, 0.42);
    moon.position.set(-40, 60, -30);
    S.add(moon);
    // enough spill round your feet that the ground under you exists
    const fill = new THREE.PointLight(0xb8c8e8, 2.6, 6.5, 1.6);
    st.camera.add(fill);
    S.add(st.camera);

    // ---- THE SKY.  A dome, out past the fog: near black overhead, a deep
    // navy at the horizon with the faint glow of the town in it, and paler
    // round the moon.  Stars of different sizes and colours, the brightest
    // twinkling, and the faint band of the Milky Way across it.
    // (all of it hung on one group that rides with the camera: the dome is 400
    // across and the far plane 420, so left at the world's origin its far side
    // was clipped away to a black disc in the sky once you were down the road)
    const sky = new THREE.Group();
    S.add(sky);
    this.sky = sky;
    const moonDir = new THREE.Vector3(-120, 120, -300).normalize();
    const domeGeo = new THREE.SphereGeometry(400, 40, 20);
    const dc: number[] = [];
    const zen = new THREE.Color(0x020309);
    const mid = new THREE.Color(0x060b18);
    const hor = new THREE.Color(0x15223a);
    const glow = new THREE.Color(0x24345a);
    const v = new THREE.Vector3();
    const cc = new THREE.Color();
    const pos = domeGeo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const up = Math.max(0, v.y);
      cc.copy(hor).lerp(mid, Math.min(1, up / 0.25)).lerp(zen, Math.max(0, (up - 0.25) / 0.75));
      if (v.y < 0) cc.copy(hor).multiplyScalar(0.6);
      const near = Math.max(0, v.dot(moonDir));
      cc.lerp(glow, Math.pow(near, 14) * 0.85);
      dc.push(cc.r, cc.g, cc.b);
    }
    domeGeo.setAttribute('color', new THREE.Float32BufferAttribute(dc, 3));
    const dome = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.renderOrder = -10;
    sky.add(dome);

    const starLayer = (n: number, size: number, bright: boolean, band: boolean): THREE.PointsMaterial => {
      const p2: number[] = [];
      const c2: number[] = [];
      for (let i = 0; i < n; i++) {
        let a = R() * Math.PI * 2;
        // even over the whole sky, right down to the skyline (the old spread
        // bunched them overhead and left the lower sky bare)
        let e = 0.03 + Math.asin(R()) * 1.5;
        if (band) {
          // the Milky Way: a band tipped across the sky
          a = R() * Math.PI * 2;
          e = 0.35 + Math.sin(a * 1.0 + 0.6) * 0.45 + (R() - 0.5) * 0.18;
          if (e < 0.08) continue;
        }
        p2.push(Math.cos(a) * Math.cos(e) * 380, Math.sin(e) * 380, Math.sin(a) * Math.cos(e) * 380);
        const tint = R();
        cc.setHex(tint < 0.15 ? 0xffd8b0 : tint < 0.35 ? 0xb8ccff : 0xe8ecf8).multiplyScalar(band ? 0.35 + R() * 0.2 : bright ? 1 : 0.45 + R() * 0.45);
        c2.push(cc.r, cc.g, cc.b);
      }
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
      g2.setAttribute('color', new THREE.Float32BufferAttribute(c2, 3));
      const mat = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false });
      const pts = new THREE.Points(g2, mat);
      pts.renderOrder = -9;
      sky.add(pts);
      return mat;
    };
    starLayer(1400, 1, false, true);
    starLayer(1300, 1, false, false);
    this.twinkle = starLayer(70, 2, true, false);

    // ---- THE MOON: a shaded disc with its seas and craters, and a soft
    // glow round it that thins out into the sky
    const moonTex = canvasTex(64, 64, (g) => {
      const grd = g.createRadialGradient(26, 26, 4, 32, 32, 30);
      grd.addColorStop(0, '#f6f4e6');
      grd.addColorStop(0.7, '#d8d6c6');
      grd.addColorStop(1, '#a8a89c');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(32, 32, 30, 0, Math.PI * 2);
      g.fill();
      // the seas
      g.fillStyle = 'rgba(120,124,128,0.45)';
      for (const [x, y, rx, ry] of [[24, 22, 9, 6], [38, 30, 7, 9], [30, 42, 10, 5], [44, 20, 4, 4]]) {
        g.beginPath();
        g.ellipse(x, y, rx, ry, 0.4, 0, Math.PI * 2);
        g.fill();
      }
      // craters: a dark ring and a lit lip
      for (let k = 0; k < 14; k++) {
        const x = 10 + R() * 44;
        const y = 10 + R() * 44;
        if (Math.hypot(x - 32, y - 32) > 26) continue;
        const r = 1 + R() * 2.4;
        g.fillStyle = 'rgba(110,112,112,0.55)';
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,245,0.5)';
        g.fillRect(x + r * 0.3, y + r * 0.3, 1, 1);
      }
      // the terminator: a little shadow down one side
      const sh = g.createLinearGradient(58, 0, 40, 0);
      sh.addColorStop(0, 'rgba(10,14,24,0.55)');
      sh.addColorStop(1, 'rgba(10,14,24,0)');
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = sh;
      g.fillRect(0, 0, 64, 64);
    });
    moonTex.magFilter = THREE.LinearFilter;
    const moonDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false }),
    );
    moonDisc.position.copy(moonDir).multiplyScalar(330);
    moonDisc.lookAt(0, 0, 0);
    moonDisc.renderOrder = -7;
    sky.add(moonDisc);
    const haloTex = canvasTex(64, 64, (g) => {
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(200,214,255,0.55)');
      grd.addColorStop(0.25, 'rgba(150,170,230,0.22)');
      grd.addColorStop(0.6, 'rgba(90,110,170,0.07)');
      grd.addColorStop(1, 'rgba(60,80,140,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
    });
    haloTex.magFilter = THREE.LinearFilter;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, transparent: true }));
    halo.position.copy(moonDir).multiplyScalar(335);
    halo.scale.set(90, 90, 1);
    halo.renderOrder = -8;
    sky.add(halo);

    // ---- the ground: grass gone to seed, bare earth, pine needles
    const groundTex = canvasTex(128, 128, (g) => {
      g.fillStyle = '#151b12';
      g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = i % 3 ? 'rgba(34,28,18,0.55)' : 'rgba(26,36,20,0.6)';
        g.beginPath();
        g.ellipse(R() * 128, R() * 128, 4 + R() * 10, 3 + R() * 7, R() * 3, 0, Math.PI * 2);
        g.fill();
      }
      for (let i = 0; i < 900; i++) {
        g.fillStyle = ['#1f2817', '#10140d', '#2a2618', '#1a2214', '#2e3a1e', '#3a2e1c'][i % 6];
        g.fillRect(Math.floor(R() * 128), Math.floor(R() * 128), R() < 0.3 ? 2 : 1, R() < 0.5 ? 2 : 1);
      }
    });
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(26, 46);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 380), new THREE.MeshLambertMaterial({ map: groundTex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -90;
    S.add(ground);
    // past the woods the ground goes on, dark, out under the fog -- so there
    // is never an edge to see
    const farGround = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshLambertMaterial({ color: 0x0c0f0c }));
    farGround.rotation.x = -Math.PI / 2;
    farGround.position.set(0, -0.03, -90);
    S.add(farGround);
    this.buildHorizon(R);

    // ---- the road: worn asphalt, its edge lines, the dashes down the middle
    const roadLen = BACK_Z - ROAD_END;
    const roadMid = BACK_Z - roadLen / 2;
    const roadTex = canvasTex(64, 128, (g) => {
      g.fillStyle = '#1e2023';
      g.fillRect(0, 0, 64, 128);
      for (let i = 0; i < 700; i++) {
        g.fillStyle = ['#26282b', '#18191b', '#2c2d2f', '#212326'][i % 4];
        g.fillRect(Math.floor(R() * 64), Math.floor(R() * 128), 1, 1);
      }
      // tar-sealed cracks and a patch
      g.strokeStyle = '#121314';
      g.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        let x = 8 + R() * 48;
        let y = R() * 128;
        g.moveTo(x, y);
        for (let s = 0; s < 6; s++) {
          x += (R() - 0.5) * 8;
          y += 3 + R() * 5;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.fillStyle = 'rgba(14,15,16,0.7)';
      g.fillRect(40, 70, 14, 10);
      // the paint, a little worn
      g.fillStyle = '#9a9c96';
      g.fillRect(2, 0, 2, 128);
      g.fillRect(60, 0, 2, 128);
      g.fillStyle = '#b09a4e';
      g.fillRect(31, 12, 2, 50);
      g.fillStyle = 'rgba(30,32,35,0.6)';
      for (let i = 0; i < 18; i++) g.fillRect([2, 60, 31][i % 3] + (R() < 0.5 ? 0 : 1), Math.floor(R() * 128), 1, 2);
    });
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
    roadTex.repeat.set(1, roadLen / 8);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF * 2, roadLen),
      decal(new THREE.MeshLambertMaterial({ map: roadTex }), 1),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.005, roadMid);
    S.add(road);

    // ---- the pavements: concrete slabs a hand high, behind a kerb
    const slabTex = canvasTex(32, 32, (g) => {
      g.fillStyle = '#3e3e3c';
      g.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 160; i++) {
        g.fillStyle = ['#454543', '#363634', '#4a4946', '#33332f'][i % 4];
        g.fillRect(Math.floor(R() * 32), Math.floor(R() * 32), 1, 1);
      }
      g.fillStyle = 'rgba(30,30,28,0.5)';
      g.beginPath();
      g.ellipse(10 + R() * 12, 10 + R() * 12, 5, 3, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#242422';
      g.fillRect(0, 0, 32, 1);
      g.fillRect(0, 0, 1, 32);
    });
    slabTex.wrapS = slabTex.wrapT = THREE.RepeatWrapping;
    slabTex.repeat.set(1, roadLen / 2);
    const slab = new THREE.MeshLambertMaterial({ map: slabTex });
    const kerb = new THREE.MeshLambertMaterial({ color: 0x5a5a56 });
    for (const side of [-1, 1]) {
      const w = WALK_X - ROAD_HALF;
      const pave = new THREE.Mesh(new THREE.BoxGeometry(w, KERB_H, roadLen), slab);
      pave.position.set(side * (ROAD_HALF + w / 2), KERB_H / 2, roadMid);
      S.add(pave);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.18, KERB_H + 0.03, roadLen), kerb);
      edge.position.set(side * (ROAD_HALF + 0.09), (KERB_H + 0.03) / 2, roadMid);
      S.add(edge);
    }

    this.buildRails(S);
    this.buildWater(S, R);
    this.buildTrees(S, R);
    this.buildLitter(S, R);
    this.buildLamps(S);
    this.buildBusStop(S);
    this.buildHotel(S);
    this.buildTown(S, R);

    this.monster = new FroggyMonster(FROGGY_SCALE);
    S.add(this.monster.root);
    // his steps are his feet: each sound, and its kick of grit, the moment a
    // foot lands -- softly while he creeps, a splash in the water
    this.footDust = new FootDust(S, 0x4a4a40);
    this.monster.onFootfall = (_foot, at, hard) => {
      if (!this.monster?.root.visible) return;
      const wet = this.fy === 0 && this.inWater(at.x, at.z);
      const g = this.gainAt(at.x, at.z) * (this.phase === 'creep' ? 0.3 : 1);
      if (g > 0.03) audio.sfx(wet ? 'splash' : this.fSpeed > 4 ? 'hop_wet' : 'froggy_step', g * (wet ? 0.8 : 1) * (0.8 + hard * 0.3), this.placeOf(at.x, at.z));
      if (!wet) this.footDust?.puff(at, hard, FROGGY_SCALE * 0.7);
    };
    if (this.stage) prepareJumpscare3D(this.stage, this.monster);
  }

  /**
   * ROADSIDE GUARDRAILS, both sides, past the pavements: a continuous
   * galvanised W-beam -- two rounded ridges with the groove between them --
   * on steel posts every two metres, each through a spacer block that holds
   * the beam off the post, the way a crash barrier is built.  No fence rails
   * and nothing to climb.  They stop for the gaps -- the bus stop and the
   * footpaths -- with a post either side, and a trodden path runs off into
   * the trees from each footpath gap.
   */
  private buildRails(S: THREE.Scene): void {
    const steel = new THREE.MeshLambertMaterial({ color: 0x8c9298 });
    const ridge = new THREE.MeshLambertMaterial({ color: 0xa4aab0 });
    const postMat = new THREE.MeshLambertMaterial({ color: 0x4a4e54 });
    const posts: THREE.Matrix4[] = [];
    const blocks: THREE.Matrix4[] = [];
    for (const side of [-1, 1]) {
      const cuts = GAPS.filter((g) => g.side === side).sort((a, b) => b.z0 - a.z0);
      const runs: [number, number][] = [];
      let from = RAIL_Z0;
      for (const g of cuts) {
        runs.push([from, g.z0]);
        from = g.z1;
      }
      runs.push([from, RAIL_Z1]);
      for (const [a, b] of runs) {
        const len = a - b;
        const mid = (a + b) / 2;
        // the beam: a flat web, and the two ridges standing proud of it
        const beamY = RAIL_H - 0.17;
        const web = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, len), steel);
        web.position.set(side * (RAIL_X - 0.02), beamY, mid);
        S.add(web);
        for (const dy of [0.09, -0.09]) {
          const r = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, len, 8, 1), ridge);
          r.rotation.x = Math.PI / 2;
          r.position.set(side * (RAIL_X - 0.05), beamY + dy, mid);
          S.add(r);
        }
        const n = Math.max(1, Math.round(len / 2));
        for (let k = 0; k <= n; k++) {
          const z = a - (k * len) / n;
          posts.push(new THREE.Matrix4().makeTranslation(side * (RAIL_X + 0.16), RAIL_H / 2 - 0.02, z));
          blocks.push(new THREE.Matrix4().makeTranslation(side * (RAIL_X + 0.06), beamY, z));
        }
      }
    }
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, RAIL_H - 0.04, 0.14), postMat, posts.length);
    posts.forEach((m, i) => inst.setMatrixAt(i, m));
    S.add(inst);
    const spacers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.2, 0.12), postMat, blocks.length);
    blocks.forEach((m, i) => spacers.setMatrixAt(i, m));
    S.add(spacers);
    const path = decal(new THREE.MeshLambertMaterial({ color: 0x2a2219 }), 1);
    for (const g of GAPS.slice(1)) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(10, g.z0 - g.z1 - 0.4), path);
      m.rotation.x = -Math.PI / 2;
      m.position.set(g.side * (RAIL_X + 5), 0.004, (g.z0 + g.z1) / 2);
      S.add(m);
    }
  }

  /**
   * Ponds in the woods both sides, and the river under the road's bridge.
   * Black water with a slow ripple on it that takes the lamp and the moon,
   * a ring of churned mud, reeds standing round the edge and lily pads.
   */
  private buildWater(S: THREE.Scene, R: () => number): void {
    const ripple = canvasTex(64, 64, (g) => {
      g.fillStyle = '#0b1822';
      g.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 90; i++) {
        g.fillStyle = i % 3 ? 'rgba(40,64,84,0.45)' : 'rgba(90,120,150,0.3)';
        g.fillRect(Math.floor(R() * 64), Math.floor(R() * 64), 3 + Math.floor(R() * 6), 1);
      }
    });
    ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping;
    ripple.repeat.set(3, 3);
    this.waterMats.push(ripple);
    const water = decal(new THREE.MeshPhongMaterial({ color: 0x0c1a26, map: ripple, specular: 0x8fa8c8, shininess: 70, emissive: 0x02060a }), 3);
    const mud = decal(new THREE.MeshLambertMaterial({ color: 0x231c13 }), 2);
    const padMat = decal(new THREE.MeshLambertMaterial({ color: 0x1d3a1b }), 4);
    const reedGeo = new THREE.ConeGeometry(0.035, 1, 3);
    reedGeo.translate(0, 0.5, 0);
    const reeds = new THREE.InstancedMesh(reedGeo, new THREE.MeshLambertMaterial({ color: 0x3b4a22 }), 700);
    let nReeds = 0;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const reed = (x: number, z: number) => {
      if (nReeds >= 700) return;
      q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.35, R() * 6.28, (R() - 0.5) * 0.35));
      m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, 0.6 + R() * 0.9, 1));
      reeds.setMatrixAt(nReeds++, m);
    };
    const spots: [number, number, number][] = [
      [-16, -14, 4.2],
      [19, -58, 5.5],
      [-24, -78, 6],
      [14, -146, 4.6],
      [-12, -160, 3.8],
      [28, -24, 3.6],
    ];
    for (const [x, z, r] of spots) {
      const bank = new THREE.Mesh(new THREE.RingGeometry(r * 0.9, r + 0.9, 32), mud);
      bank.rotation.x = -Math.PI / 2;
      bank.position.set(x, 0.003, z);
      const p = new THREE.Mesh(new THREE.CircleGeometry(r, 32), water);
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, 0.006, z);
      S.add(bank, p);
      for (let k = 0; k < 4 + Math.floor(R() * 4); k++) {
        const a = R() * 6.28;
        const d = Math.sqrt(R()) * r * 0.7;
        const lily = new THREE.Mesh(new THREE.CircleGeometry(0.22 + R() * 0.16, 9, 0.4, 5.6), padMat);
        lily.rotation.set(-Math.PI / 2, 0, R() * 6.28);
        lily.position.set(x + Math.cos(a) * d, 0.009, z + Math.sin(a) * d);
        S.add(lily);
      }
      for (let k = 0; k < r * 9; k++) {
        const a = R() * 6.28;
        const d = r * (0.88 + R() * 0.3);
        reed(x + Math.cos(a) * d, z + Math.sin(a) * d);
      }
      this.ponds.push({ x, z, r });
    }
    // THE RIVER MOVES.  Long streaks of current drawn along it, and over them a
    // second, brighter layer of ripples and glints going a little faster and
    // wobbling across -- two speeds against each other read as running water.
    const current = canvasTex(128, 64, (g) => {
      g.fillStyle = '#0a1620';
      g.fillRect(0, 0, 128, 64);
      for (let i = 0; i < 160; i++) {
        const y = Math.floor(R() * 64);
        g.fillStyle = i % 4 ? 'rgba(36,62,84,0.5)' : 'rgba(70,104,132,0.4)';
        g.fillRect(Math.floor(R() * 128), y, 10 + Math.floor(R() * 26), 1);
      }
    });
    current.wrapS = current.wrapT = THREE.RepeatWrapping;
    current.repeat.set(5, 1.4);
    const glints = canvasTex(128, 64, (g) => {
      g.clearRect(0, 0, 128, 64);
      for (let i = 0; i < 70; i++) {
        const x = R() * 128;
        const y = R() * 64;
        g.strokeStyle = i % 3 ? 'rgba(120,150,190,0.35)' : 'rgba(200,215,240,0.45)';
        g.beginPath();
        g.ellipse(x, y, 3 + R() * 6, 0.6 + R() * 1.2, 0, Math.PI * 0.1, Math.PI * 0.9);
        g.stroke();
      }
    });
    glints.wrapS = glints.wrapT = THREE.RepeatWrapping;
    glints.repeat.set(4, 1.2);
    this.riverFlow = [current, glints];
    const riverMat = decal(new THREE.MeshPhongMaterial({ color: 0x0d1c28, map: current, specular: 0x9ab0d0, shininess: 80, emissive: 0x02060a }), 3);
    const glintMat = new THREE.MeshBasicMaterial({ map: glints, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const side of [-1, 1]) {
      const w = WORLD_X + 8 - RAIL_X;
      const river = new THREE.Mesh(new THREE.PlaneGeometry(w, RIVER_HALF * 2), riverMat);
      river.rotation.x = -Math.PI / 2;
      river.position.set(side * (RAIL_X + w / 2), 0.006, RIVER_Z);
      S.add(river);
      const sheen = new THREE.Mesh(new THREE.PlaneGeometry(w, RIVER_HALF * 2), glintMat);
      sheen.rotation.x = -Math.PI / 2;
      sheen.position.set(side * (RAIL_X + w / 2), 0.011, RIVER_Z);
      S.add(sheen);
      // the banks: a lip of mud either side, with reeds along it
      for (const edge of [-1, 1]) {
        const bank = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.6), new THREE.MeshLambertMaterial({ color: 0x231c13 }));
        bank.position.set(side * (RAIL_X + w / 2), 0.04, RIVER_Z + edge * RIVER_HALF);
        S.add(bank);
        for (let k = 0; k < 40; k++) reed(side * (RAIL_X + 1 + R() * (w - 2)), RIVER_Z + edge * (RIVER_HALF - 0.2 - R() * 0.5));
      }
    }
    reeds.count = nReeds;
    S.add(reeds);
    // The bridge: the road on a concrete deck, its top just under the road
    // (they used to share a height, and fought over it).
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(RAIL_X * 2 + 0.4, 0.5, RIVER_HALF * 2 + 1.4),
      new THREE.MeshLambertMaterial({ color: 0x46484c }),
    );
    deck.position.set(0, -0.27, RIVER_Z);
    S.add(deck);
  }

  /** Nothing grows on the footpaths, the bus stop's pad or the water. */
  private clearGround(x: number, z: number, margin: number): boolean {
    if (Math.abs(x) < RAIL_X + margin) return false;
    if (Math.abs(z - RIVER_Z) < RIVER_HALF + 1.2) return false;
    if (z < HOTEL_Z + 12 && Math.abs(x) < 20) return false;
    for (const p of this.ponds) if (Math.hypot(x - p.x, z - p.z) < p.r + 1.4) return false;
    for (const g of GAPS) {
      if (Math.sign(x) === g.side && z < g.z0 + 1.5 && z > g.z1 - 1.5 && Math.abs(x) < RAIL_X + 11) return false;
    }
    return true;
  }

  /**
   * The woods.  Pines, each a trunk of ridged bark and five tiers of needles
   * stepped up it, every tier turned and tinted a little differently so no
   * two trees are the same green; some dead ones by the road, bare; and low
   * scrub between them.  The trunks are what you hide behind.
   */
  private buildTrees(S: THREE.Scene, R: () => number): void {
    const spots: Circle[] = [];
    for (let k = 0; k < 900 && spots.length < 470; k++) {
      const x = (R() < 0.5 ? -1 : 1) * (RAIL_X + 1.6 + R() * (WORLD_X - RAIL_X));
      const z = HOTEL_Z - 6 + R() * (BACK_Z + 2 - HOTEL_Z + 6);
      if (!this.clearGround(x, z, 1.6)) continue;
      const r = 0.22 + R() * 0.24;
      if (spots.some((t) => Math.hypot(t.x - x, t.z - z) < 2.2)) continue;
      spots.push({ x, z, r });
    }
    // and a wall of them past where you can walk, so the woods have no edge
    for (let k = 0; k < 260; k++) {
      const x = (R() < 0.5 ? -1 : 1) * (WORLD_X + 1 + R() * 24);
      const z = HOTEL_Z - 30 + R() * (BACK_Z + 40 - HOTEL_Z);
      spots.push({ x, z, r: 0.3 + R() * 0.2 });
    }
    // (Behind the start is the town now -- see buildTown -- so no trees across it.)

    // bark: deep vertical furrows, and plates between them catching the light
    const bark = canvasTex(32, 64, (g) => {
      g.fillStyle = '#6a5a4a';
      g.fillRect(0, 0, 32, 64);
      for (let i = 0; i < 110; i++) {
        g.fillStyle = ['#3a2e24', '#54463a', '#7e6e5c', '#2a2018'][i % 4];
        g.fillRect(Math.floor(R() * 32), Math.floor(R() * 64), 1 + Math.floor(R() * 2), 3 + Math.floor(R() * 10));
      }
    });
    bark.wrapS = bark.wrapT = THREE.RepeatWrapping;
    bark.repeat.set(2, 3);
    // Leaves: a sheet of them on clear ground, each a pointed oval with a
    // midrib, in five greens -- cut out, so a clump of them is ragged at its
    // edge and the sky shows through it.
    const leafTex = (dark: boolean): THREE.CanvasTexture => {
      const t = canvasTex(64, 64, (g) => {
        g.clearRect(0, 0, 64, 64);
        const greens = dark
          ? ['#1e3020', '#28402a', '#173018', '#30482e', '#22381e']
          : ['#3e5a30', '#4e6a38', '#2e4a26', '#5e7a42', '#36522c'];
        for (let i = 0; i < 85; i++) {
          const x = R() * 64;
          const y = R() * 64;
          const a = R() * Math.PI;
          g.save();
          g.translate(x, y);
          g.rotate(a);
          g.fillStyle = greens[i % 5];
          g.beginPath();
          g.ellipse(0, 0, 4 + R() * 2.5, 1.6 + R() * 1.2, 0, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.fillRect(-3, -0.25, 6, 0.5);
          g.restore();
        }
      });
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(4, 3);
      return t;
    };
    // A pine bough's needles: a fringe of strokes hanging off a twig, cut out
    const boughTex = canvasTex(64, 32, (g) => {
      g.clearRect(0, 0, 64, 32);
      for (let i = 0; i < 260; i++) {
        const x = R() * 64;
        const y = 2 + R() * 28;
        g.strokeStyle = ['#2a3e2c', '#3a5038', '#1e3020', '#4a6044', '#2e4630'][i % 5];
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (R() - 0.5) * 3, y + 3 + R() * 4);
        g.stroke();
      }
    });
    boughTex.wrapS = boughTex.wrapT = THREE.RepeatWrapping;

    // EVERYTHING GREEN MOVES.  A breeze that comes and goes leans the crowns
    // (more the higher up), and anything near you is pushed aside by your
    // body and shaken when you barge through it.  Done on the GPU, per vertex,
    // from the world position, so ten thousand boughs cost nothing to move.
    const windify = <M extends THREE.Material>(mat: M, sway: number, pushR: number, base = 0.6): M => {
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = this.wind.uTime;
        sh.uniforms.uPlayer = this.wind.uPlayer;
        sh.uniforms.uShake = this.wind.uShake;
        sh.uniforms.uGust = this.wind.uGust;
        sh.vertexShader = sh.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
uniform float uTime; uniform vec4 uPlayer; uniform float uShake; uniform float uGust;`,
          )
          .replace(
            '#include <project_vertex>',
            `vec4 wpos = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
wpos = instanceMatrix * wpos;
#endif
wpos = modelMatrix * wpos;
float hh = max(0.0, wpos.y - ${base.toFixed(2)});
float ph = wpos.x * 0.13 + wpos.z * 0.11;
float gust = (0.55 + 0.45 * sin(uTime * 0.31 + wpos.x * 0.015 + wpos.z * 0.01)) * (1.0 + uGust);
wpos.x += (sin(uTime * 1.6 + ph) + 0.4 * sin(uTime * 4.1 + ph * 3.0)) * ${sway.toFixed(4)} * hh * gust;
wpos.z += (cos(uTime * 1.2 + ph * 1.3) + 0.3 * sin(uTime * 3.7 + ph * 2.0)) * ${(sway * 0.7).toFixed(4)} * hh * gust;
vec2 dp = wpos.xz - uPlayer.xy;
float dd = length(dp);
float near = 1.0 - smoothstep(0.0, ${pushR.toFixed(2)}, dd);
float low = clamp(1.0 - wpos.y / 2.6, 0.0, 1.0);
wpos.xz += (dd > 0.001 ? dp / dd : vec2(0.0)) * near * low * uPlayer.z * 0.55;
wpos.x += sin(uTime * 37.0 + ph * 9.0) * uShake * near * 0.07;
wpos.y += cos(uTime * 31.0 + ph * 7.0) * uShake * near * 0.04;
vec4 mvPosition = viewMatrix * wpos;
gl_Position = projectionMatrix * mvPosition;`,
          );
      };
      return mat;
    };

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);

    // The parts every tree is made of, each an instanced mesh: a tapering
    // trunk; limbs (and the branches and twigs off them, the same shape
    // smaller); pine boughs, each a drooping fan of needles; and the leafy
    // clumps of the broadleaves.
    const trunkGeo = new THREE.CylinderGeometry(0.55, 1, 1, 7, 1, true);
    trunkGeo.translate(0, 0.5, 0);
    const limbGeo = new THREE.CylinderGeometry(0.45, 1, 1, 4, 1, true);
    limbGeo.translate(0, 0.5, 0);
    // a bough: an open, flattened cone lying on its side, apex at the trunk
    const boughGeo = new THREE.ConeGeometry(0.5, 1, 5, 1, true);
    boughGeo.translate(0, -0.5, 0);
    boughGeo.rotateZ(Math.PI / 2);
    boughGeo.scale(1, 0.45, 1);
    const clumpGeo = new THREE.IcosahedronGeometry(1, 0);
    const tipGeo = new THREE.ConeGeometry(1, 1, 8, 1, true);
    tipGeo.translate(0, 0.5, 0);

    const barkMat = windify(new THREE.MeshLambertMaterial({ map: bark }), 0.004, 0, 2);
    const limbMat = windify(new THREE.MeshLambertMaterial({ map: bark }), 0.012, 1.4, 1.5);
    const boughMat = windify(
      new THREE.MeshLambertMaterial({ map: boughTex, alphaTest: 0.35, side: THREE.DoubleSide }),
      0.02,
      1.6,
      0.4,
    );
    const leafMat = windify(
      new THREE.MeshLambertMaterial({ map: leafTex(false), alphaTest: 0.4, side: THREE.DoubleSide }),
      0.022,
      1.5,
      0.5,
    );
    // Every part is filed by where it stands, and each patch of woods drawn
    // as its own batch -- so the woods behind you, or off to the side, are
    // not drawn at all.
    type Part = { geo: THREE.BufferGeometry; mat: THREE.Material; items: { m: THREE.Matrix4; c: THREE.Color }[] };
    const parts: Record<string, Part> = {};
    const put = (kind: string, geo: THREE.BufferGeometry, mat: THREE.Material, mm: THREE.Matrix4, c: THREE.Color): void => {
      (parts[kind] ??= { geo, mat, items: [] }).items.push({ m: mm.clone(), c: c.clone() });
    };
    const flush = (): void => {
      // (what the graphics level may thin: greenery only -- never trunks, which
      // are what you hide behind, nor the thickets you hide in)
      const thin = new Set(['bough', 'clump', 'limb', 'tip', 'scrub']);
      for (const [kind, part] of Object.entries(parts)) {
        const groups = new Map<string, { m: THREE.Matrix4; c: THREE.Color }[]>();
        for (const it of part.items) {
          const key = `${Math.floor(it.m.elements[14] / 22)}:${Math.floor(it.m.elements[12] / 22)}`;
          let g = groups.get(key);
          if (!g) groups.set(key, (g = []));
          g.push(it);
        }
        for (const g of groups.values()) {
          // shuffled, so a lower graphics level thins every tree a little
          // rather than stripping the last few bare
          if (thin.has(kind)) {
            for (let k = g.length - 1; k > 0; k--) {
              const j = Math.floor(R() * (k + 1));
              [g[k], g[j]] = [g[j], g[k]];
            }
          }
          const im = new THREE.InstancedMesh(part.geo, part.mat, g.length);
          g.forEach((it, k) => {
            im.setMatrixAt(k, it.m);
            im.setColorAt(k, it.c);
          });
          im.computeBoundingSphere();
          if (thin.has(kind)) im.userData.foliage = g.length;
          S.add(im);
        }
      }
      for (const k of Object.keys(parts)) delete parts[k];
    };
    const limb = (x: number, y: number, z: number, dir: THREE.Vector3, len: number, rad: number, tint: THREE.Color): void => {
      q.setFromUnitVectors(up, dir);
      m.compose(p.set(x, y, z), q, sc.set(rad, len, rad));
      put('limb', limbGeo, limbMat, m, tint);
    };
    const clump = (x: number, y: number, z: number, r: number, hue: number, light: number): void => {
      q.setFromEuler(new THREE.Euler(R() * 6.28, R() * 6.28, R() * 6.28));
      m.compose(p.set(x, y, z), q, sc.set(r * (0.9 + R() * 0.3), r * (0.7 + R() * 0.25), r * (0.9 + R() * 0.3)));
      put('clump', clumpGeo, leafMat, m, col.setHSL(hue, 0.42, light));
    };
    const dirFrom = (yaw: number, tilt: number): THREE.Vector3 =>
      new THREE.Vector3(Math.sin(tilt) * Math.cos(yaw), Math.cos(tilt), Math.sin(tilt) * Math.sin(yaw));

    spots.forEach((t) => {
      const far = Math.abs(t.x) > WORLD_X + 0.5;
      const dead = !far && Math.abs(t.x) < RAIL_X + 5 && R() < 0.2;
      // a third of the woods is broadleaf: oak-ish, and here and there a birch
      const broad = !dead && R() < 0.34;
      const birch = broad && R() < 0.3;
      const h = broad ? 6 + R() * 5 : 7 + R() * 7;
      const barkTint = new THREE.Color().setHSL(0.07, birch ? 0.04 : 0.18, birch ? 0.85 + R() * 0.1 : dead ? 0.6 + R() * 0.12 : 0.5 + R() * 0.15);
      const lean = new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.08, R() * 6.28, (R() - 0.5) * 0.08));
      const trunkH = dead ? h * 0.75 : broad ? h * 0.62 : h * 0.96;
      m.compose(p.set(t.x, 0, t.z), lean, sc.set(t.r * (birch ? 0.7 : 1), trunkH, t.r * (birch ? 0.7 : 1)));
      put('trunk', trunkGeo, barkMat, m, barkTint);
      let reach = 0;
      const hue = 0.3 + (R() - 0.5) * 0.07;
      const light = 0.13 + R() * 0.08;

      if (dead) {
        // Bare limbs all the way up, longer low down, angled up, some forked.
        const n = 7 + Math.floor(R() * 5);
        for (let k = 0; k < n; k++) {
          const f = 0.2 + (k / n) * 0.7;
          const yaw = R() * 6.28;
          const dir = dirFrom(yaw, 0.7 + R() * 0.6);
          const len = (2.6 - f * 2) * (0.7 + R() * 0.5);
          const y0 = trunkH * f;
          limb(t.x, y0, t.z, dir, len, 0.05, barkTint);
          if (len > 1.2) {
            const fd = dirFrom(yaw + (R() < 0.5 ? -0.7 : 0.7), 0.5 + R() * 0.4);
            limb(t.x + dir.x * len * 0.5, y0 + dir.y * len * 0.5, t.z + dir.z * len * 0.5, fd, len * 0.45, 0.03, barkTint);
          }
        }
      } else if (broad) {
        // THE BROADLEAF: the trunk forks into three to five limbs, each limb
        // into branches, each branch into twigs, and the leaves hang in
        // clumps off the ends -- a crown, with sky through it.
        const nLimb = 3 + Math.floor(R() * 3);
        const forkY = trunkH * (0.55 + R() * 0.25);
        for (let k = 0; k < nLimb; k++) {
          const yaw = (k / nLimb) * 6.28 + R() * 0.8;
          const dir = dirFrom(yaw, 0.45 + R() * 0.45);
          const len = h * (0.32 + R() * 0.14);
          limb(t.x, forkY, t.z, dir, len, t.r * 0.55, barkTint);
          const ex = t.x + dir.x * len;
          const ey = forkY + dir.y * len;
          const ez = t.z + dir.z * len;
          clump(ex, ey + 0.3, ez, 1.2 + R() * 0.6, hue, light + 0.03);
          // branches off the limb, and twigs off those (past the edge, where
          // you never come near, the crown is enough)
          const nBr = far ? 0 : 2 + Math.floor(R() * 2);
          for (let b = 0; b < nBr; b++) {
            const f = 0.45 + R() * 0.4;
            const bx = t.x + dir.x * len * f;
            const by = forkY + dir.y * len * f;
            const bz = t.z + dir.z * len * f;
            const bd = dirFrom(yaw + (R() - 0.5) * 1.8, 0.6 + R() * 0.7);
            const bl = len * (0.4 + R() * 0.3);
            limb(bx, by, bz, bd, bl, t.r * 0.25, barkTint);
            const cx = bx + bd.x * bl;
            const cy = by + bd.y * bl;
            const cz = bz + bd.z * bl;
            clump(cx, cy, cz, 0.9 + R() * 0.6, hue + (R() - 0.5) * 0.02, light + R() * 0.03);
            for (let w = 0; w < 1; w++) {
              const td = dirFrom(yaw + (R() - 0.5) * 2.6, 0.4 + R() * 1.0);
              limb(cx, cy, cz, td, 0.5 + R() * 0.5, 0.025, barkTint);
            }
            // the lowest leaves can hang to head height: those are the ones you brush
            if (cy - 1 < 1.8) reach = Math.max(reach, Math.hypot(cx - t.x, cz - t.z) + 0.9);
          }
        }
        clump(t.x, forkY + h * 0.38, t.z, 1.5 + R() * 0.6, hue, light + 0.04);
      } else {
        // THE PINE: whorls of boughs up the trunk, four to six to a whorl,
        // long and drooping low down, short and lifted near the top, each
        // with its limb inside it, and a spire of needles at the crown.
        // About one in four is an old, heavy one: its lowest boughs sweep
        // nearly to the ground, and there is room under them for a man.
        const big = Math.abs(t.x) <= WORLD_X && R() < 0.26;
        if (big) this.skirts.push({ x: t.x, z: t.z, r: 2.3 });
        const start = big ? 0.5 : 1.3 + R() * 0.8;
        const gap = far ? 2.2 : 1.15 + R() * 0.3;
        const crown = trunkH;
        for (let y = start; y < crown - 0.6; y += gap) {
          const f = y / crown;
          const per = far ? 3 : 3 + Math.floor(R() * 2);
          const yaw0 = R() * 6.28;
          const len = (2.6 * (1 - f) + 0.45) * (big && f < 0.25 ? 1.5 : 1) * (0.85 + R() * 0.3);
          for (let k = 0; k < per; k++) {
            const yaw = yaw0 + (k / per) * 6.28 + (R() - 0.5) * 0.5;
            const droop = (0.15 + (1 - f) * 0.35) * (0.8 + R() * 0.4);
            const e = new THREE.Euler(0, -yaw, -droop, 'YXZ');
            q.setFromEuler(e);
            const wide = len * (0.7 + R() * 0.3);
            m.compose(p.set(t.x, y, t.z), q, sc.set(len, wide, wide));
            put('bough', boughGeo, boughMat, m, col.setHSL(hue, 0.35, 0.34 + f * 0.12 + R() * 0.06));
            if (!far && len > 1.5 && y < 3) {
              const dir = new THREE.Vector3(Math.cos(yaw), -Math.sin(droop), Math.sin(yaw)).normalize();
              limb(t.x, y, t.z, dir, len * 0.8, 0.04, barkTint);
            }
          }
          for (const yy of [0.6, 1.1, 1.6]) {
            // how far its boughs stand out at hip, chest and head height
            if (Math.abs(yy - y) < gap) reach = Math.max(reach, len * (1 - Math.abs(yy - y) / (gap * 1.5)));
          }
        }
        // the spire
        m.compose(p.set(t.x, crown - 1.4, t.z), lean, sc.set(0.55, 2.4, 0.55));
        put('tip', tipGeo, boughMat, m, col.setHSL(hue, 0.35, 0.42));
      }
      t.leaf = reach;
      if (!far) this.addTree(t);
    });
    flush();

    // ---- the scrub: low leafy bushes between the trunks, that lean in the
    // wind and part round your legs
    const scrubMat = windify(
      new THREE.MeshLambertMaterial({ map: leafTex(true), alphaTest: 0.4, side: THREE.DoubleSide }),
      0.05,
      1.3,
      0,
    );
    let ns = 0;
    for (let k = 0; k < 1400 && ns < 420; k++) {
      const x = (R() < 0.5 ? -1 : 1) * (RAIL_X + 1.2 + R() * (WORLD_X - RAIL_X - 1.2));
      const z = HOTEL_Z + 8 + R() * (BACK_Z - HOTEL_Z - 8);
      if (!this.clearGround(x, z, 1.2)) continue;
      const s2 = 0.35 + R() * 0.55;
      q.setFromAxisAngle(up, R() * 6.28);
      m.compose(p.set(x, s2 * 0.4, z), q, sc.set(s2 * (1 + R() * 0.5), s2 * 0.75, s2));
      put('scrub', clumpGeo, scrubMat, m, col.setHSL(0.3 + (R() - 0.5) * 0.08, 0.4, 0.35 + R() * 0.2));
      ns++;
    }

    // ---- THICKETS.  Big, dense bushes you can get INTO: a ring of leafy
    // masses round a hollow, some waist high and thin, some over a man's head
    // and thick.  Inside, the world is glimpses between leaves.  Going in is
    // loud; moving inside rustles; keeping still is silent.
    const thickMat = windify(
      new THREE.MeshLambertMaterial({ map: leafTex(true), alphaTest: 0.45, side: THREE.DoubleSide }),
      0.035,
      1.8,
      0,
    );
    for (let k = 0; k < 2400 && this.thickets.length < 64; k++) {
      const x = (R() < 0.5 ? -1 : 1) * (RAIL_X + 2.5 + R() * (WORLD_X - RAIL_X - 4));
      const z = HOTEL_Z + 14 + R() * (BACK_Z - HOTEL_Z - 18);
      const r = 1.2 + R() * 1.1;
      if (!this.clearGround(x, z, r + 0.4)) continue;
      if (this.treesNear(x, z).some((t) => Math.hypot(t.x - x, t.z - z) < r + t.r + 0.3)) continue;
      if (this.thickets.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + r + 2)) continue;
      const tall = R() < 0.55;
      const hgt = tall ? 1.85 + R() * 0.5 : 1.2 + R() * 0.35;
      const dense = 0.35 + R() * 0.65;
      this.thickets.push({ x, z, r, h: hgt, dense });
      const pieces = 6 + Math.floor(dense * 6);
      const tint = 0.3 + R() * 0.15;
      for (let n = 0; n < pieces; n++) {
        const a = (n / pieces) * 6.28 + R() * 0.4;
        const rr = r * (0.55 + R() * 0.3);
        const s2 = r * (0.5 + R() * 0.25);
        q.setFromEuler(new THREE.Euler(R() * 6.28, R() * 6.28, R() * 6.28));
        m.compose(p.set(x + Math.cos(a) * rr, hgt * (0.35 + R() * 0.2), z + Math.sin(a) * rr), q, sc.set(s2, hgt * 0.55, s2));
        put('thick', clumpGeo, thickMat, m, col.setHSL(0.29 + (R() - 0.5) * 0.06, 0.4, tint + R() * 0.08));
      }
      // and a crown over the hollow: from inside, a roof of leaves
      q.setFromEuler(new THREE.Euler(R() * 6.28, R() * 6.28, R() * 6.28));
      m.compose(p.set(x, hgt * 0.85, z), q, sc.set(r * 0.9, hgt * 0.3, r * 0.9));
      put('thick', clumpGeo, thickMat, m, col.setHSL(0.3, 0.4, tint));
    }
    flush();

    // ---- leaves coming down: a few hundred, around wherever you are
    this.buildFallingLeaves(S, R);
    this.buildRapids(S, R);
  }

  /**
   * The bus stop, on the right, through its gap in the rail: a concrete pad,
   * a shelter of dark green steel and scratched glass with a bench along the
   * back, a lit timetable, a fluorescent tube that is not quite well, and the
   * stop's pole and sign at the kerb.  Its walls and bench are solid.
   */
  private busLight: THREE.PointLight | null = null;
  private busTube: THREE.MeshBasicMaterial | null = null;

  private buildBusStop(S: THREE.Scene): void {
    const bx = RAIL_X + 1.9;
    const z0 = BUS_Z - 2.2;
    const z1 = BUS_Z + 2.2;
    const front = bx - 1.4;
    const concrete = new THREE.MeshLambertMaterial({ color: 0x4a4a46 });
    const frame = new THREE.MeshLambertMaterial({ color: 0x22362a });
    const glass = new THREE.MeshPhongMaterial({ color: 0x8aa4b4, transparent: true, opacity: 0.16, specular: 0xaaccee, shininess: 80, depthWrite: false });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(bx + 0.7 - WALK_X, 0.08, 7.6), concrete);
    pad.position.set((WALK_X + bx + 0.7) / 2, 0.04, BUS_Z);
    S.add(pad);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      S.add(mesh);
      return mesh;
    };
    for (const [x, z] of [
      [front, z0],
      [front, z1],
      [bx, z0],
      [bx, z1],
    ]) add(new THREE.BoxGeometry(0.08, 2.45, 0.08), frame, x, 1.22, z);
    add(new THREE.BoxGeometry(0.04, 1.7, z1 - z0), glass, bx, 1.25, BUS_Z);
    for (const z of [z0, z1]) add(new THREE.BoxGeometry(1.4, 1.7, 0.04), glass, bx - 0.7, 1.25, z);
    // the frame's rails round the glass
    add(new THREE.BoxGeometry(0.06, 0.06, z1 - z0), frame, bx, 0.4, BUS_Z);
    add(new THREE.BoxGeometry(0.06, 0.06, z1 - z0), frame, bx, 2.1, BUS_Z);
    const roof = add(new THREE.BoxGeometry(1.9, 0.08, z1 - z0 + 0.5), new THREE.MeshLambertMaterial({ color: 0x2a2e33 }), bx - 0.7, 2.48, BUS_Z);
    roof.rotation.z = -0.05;
    // the bench
    add(new THREE.BoxGeometry(0.42, 0.05, 3.2), new THREE.MeshLambertMaterial({ color: 0x4a3626 }), bx - 0.3, 0.48, BUS_Z);
    for (const z of [BUS_Z - 1.4, BUS_Z + 1.4]) add(new THREE.BoxGeometry(0.06, 0.46, 0.06), frame, bx - 0.3, 0.24, z);
    // the timetable and the poster, lit from behind
    const poster = canvasTex(32, 48, (g) => {
      g.fillStyle = '#d8e0d0';
      g.fillRect(0, 0, 32, 48);
      g.fillStyle = '#5a1e34';
      g.fillRect(0, 0, 32, 10);
      g.fillStyle = '#ffd9e8';
      g.fillRect(3, 3, 26, 1);
      g.fillRect(3, 6, 18, 1);
      g.fillStyle = '#3a3c40';
      for (let r2 = 0; r2 < 9; r2++) g.fillRect(3, 14 + r2 * 3.6, 10 + ((r2 * 7) % 14), 1);
      g.fillStyle = '#9a2a2a';
      g.fillRect(3, 44, 26, 2);
    });
    const ad = add(new THREE.PlaneGeometry(0.8, 1.2), new THREE.MeshBasicMaterial({ map: poster, color: 0x9aa8a0 }), bx - 0.04, 1.35, BUS_Z + 1.3);
    ad.rotation.y = -Math.PI / 2;
    // the tube under the roof, and the light it gives
    this.busTube = new THREE.MeshBasicMaterial({ color: 0xcfe8ff });
    add(new THREE.BoxGeometry(0.05, 0.04, 2.8), this.busTube, bx - 0.8, 2.4, BUS_Z);
    this.busLight = new THREE.PointLight(0xbfe0ff, 7, 7, 1.6);
    this.busLight.position.set(bx - 0.8, 2.2, BUS_Z);
    S.add(this.busLight);
    // the stop itself, at the kerb: a pole and a round sign
    const poleX = ROAD_HALF + 0.45;
    const poleZ = BUS_Z - 3.4;
    add(new THREE.CylinderGeometry(0.04, 0.04, 2.7, 6), frame, poleX, 1.35, poleZ);
    const sign = canvasTex(32, 32, (g) => {
      g.fillStyle = '#1b5a2e';
      g.beginPath();
      g.arc(16, 16, 15, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e8e2cd';
      g.beginPath();
      g.arc(16, 16, 12, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1b5a2e';
      g.font = 'bold 10px monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('BUS', 16, 17);
    });
    const plate = add(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshLambertMaterial({ map: sign, side: THREE.DoubleSide }), poleX, 2.5, poleZ);
    plate.rotation.y = Math.PI / 2;
    // what is solid: the back and the two ends, the bench, the posts and the pole
    this.boxes.push(
      { x0: bx - 0.06, x1: bx + 0.06, z0, z1 },
      { x0: front, x1: bx + 0.06, z0: z0 - 0.05, z1: z0 + 0.05 },
      { x0: front, x1: bx + 0.06, z0: z1 - 0.05, z1: z1 + 0.05 },
      { x0: bx - 0.55, x1: bx - 0.05, z0: BUS_Z - 1.6, z1: BUS_Z + 1.6 },
    );
    this.posts.push({ x: poleX, z: poleZ, r: 0.08 });
  }

  private addTree(t: Circle): void {
    const i = this.trees.length;
    this.trees.push(t);
    const key = `${Math.floor(t.x / 4)},${Math.floor(t.z / 4)}`;
    const list = this.treeGrid.get(key);
    if (list) list.push(i);
    else this.treeGrid.set(key, [i]);
  }

  private treesNear(x: number, z: number): Circle[] {
    const out: Circle[] = [];
    const cx = Math.floor(x / 4);
    const cz = Math.floor(z / 4);
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++) {
        const l = this.treeGrid.get(`${cx + a},${cz + b}`);
        if (l) for (const i of l) out.push(this.trees[i]);
      }
    return out;
  }

  /** Fallen branches, gravel and broken kerb, and the crows in the trees. */
  private buildLitter(S: THREE.Scene, R: () => number): void {
    const wood = new THREE.MeshLambertMaterial({ color: 0x4a3a28 });
    const stickGeo = new THREE.CylinderGeometry(0.03, 0.04, 1, 4);
    stickGeo.rotateZ(Math.PI / 2);
    const sticks = new THREE.InstancedMesh(stickGeo, wood, 160);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    let n = 0;
    for (let k = 0; k < 400 && n < 160; k++) {
      const x = (R() < 0.5 ? -1 : 1) * (RAIL_X + 1 + R() * (WORLD_X - RAIL_X - 1));
      const z = HOTEL_Z + 10 + R() * (BACK_Z - HOTEL_Z - 10);
      if (this.inWater(x, z)) continue;
      q.setFromAxisAngle(up, R() * 6.28);
      m.compose(new THREE.Vector3(x, 0.04, z), q, new THREE.Vector3(0.8 + R() * 0.9, 1, 1));
      sticks.setMatrixAt(n++, m);
      this.twigs.push({ x, z, t: 0 });
    }
    sticks.count = n;
    S.add(sticks);

    const stone = new THREE.MeshLambertMaterial({ color: 0x5a5852 });
    const rockGeo = new THREE.DodecahedronGeometry(0.16, 0);
    const rocks = new THREE.InstancedMesh(rockGeo, stone, 260);
    let r = 0;
    const patches: [number, number, number][] = [
      [-9.6, -34, 2.2],
      [9.6, -64, 2.4],
      [-10, -96, 2.2],
      [9.4, -120, 2.2],
      [-9.8, -150, 2.4],
      [-13, -42, 2],
      [14, -87.5, 1.8],
    ];
    for (const [x, z, rad] of patches) {
      this.rubble.push({ x, z, r: rad });
      for (let k = 0; k < 36 && r < 260; k++) {
        const a = R() * 6.28;
        const d = Math.sqrt(R()) * rad;
        const s = 0.5 + R() * 1.4;
        q.setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3));
        m.compose(new THREE.Vector3(x + Math.cos(a) * d, 0.05, z + Math.sin(a) * d), q, new THREE.Vector3(s, s * 0.6, s));
        rocks.setMatrixAt(r++, m);
      }
    }
    rocks.count = r;
    S.add(rocks);

    // Crows: a few black shapes on the low branches by the road.  Run under
    // them and they go up, loudly, and everything in the woods knows where.
    const crowMat = new THREE.MeshLambertMaterial({ color: 0x08080a });
    const perches: [number, number][] = [
      [-8, -12],
      [9, -38],
      [-10, -66],
      [8, -92],
      [-9, -128],
      [10, -152],
      [-22, -52],
      [24, -118],
    ];
    for (const [x, z] of perches) {
      const birds: THREE.Object3D[] = [];
      for (let k = 0; k < 3; k++) {
        const b = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.34), crowMat);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), crowMat);
        head.position.set(0, 0.1, 0.17);
        b.add(body, head);
        b.position.set(x + (k - 1) * 0.5, 3.4 + R() * 0.8, z + R() * 0.6);
        b.rotation.y = R() * 6.28;
        S.add(b);
        birds.push(b);
      }
      this.crows.push({ x, z, birds, flying: 0 });
    }
  }

  /** Streetlights, alternating sides, with the arm out over the road. */
  /**
   * ---- BEHIND YOU: THE TOWN YOU RAN FROM.
   *
   * Turn round on the road and the arcade is there on your left, from the
   * back: its service door and roll-up loading bay, vents and ducts, air
   * conditioners on brackets and on the roof, pipes, dumpsters, a warning
   * beacon, a ladder, its old sign dark.  Across the road, more of the town:
   * shops and flats with a few windows lit, neon, the mouths of alleys, street
   * lights going on up the road, and past all of it a skyline of lit windows
   * that the fog cannot quite swallow.
   *
   * None of it can be reached.  The road's back edge (BACK_Z) is a hard stop
   * on your position, whatever your height -- it is tested on where you are,
   * not on what you collide with, so there is nothing to jump, climb or slip
   * past -- and the world's sides (WORLD_X) are the same.  The town is all
   * past that line.
   */
  private buildTown(S: THREE.Scene, R: () => number): void {
    const Z0 = BACK_Z + 4;
    const lam = (c: number, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e });
    const box = (m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y + h / 2, z);
      S.add(b);
      return b;
    };
    /**
     * A facade, drawn at 32 pixels a bay: brick courses with their mortar, a
     * ledge at every floor, each window framed with a sill under it, the lit
     * ones warm or cold with a curtain half across or a blind, a few with
     * someone's lamp in them -- and a shop level at the bottom.
     */
    const facade = (cols: number, rows: number, base: string, lit: number, seed: number): THREE.CanvasTexture => {
      let q = seed;
      const RR = () => ((q = (q * 16807) % 2147483647) / 2147483647);
      const BW = 32;
      const BH = 40;
      const W = cols * BW;
      const H = rows * BH;
      const t = canvasTex(W, H, (g) => {
        g.fillStyle = base;
        g.fillRect(0, 0, W, H);
        // brick courses, every brick a hair different
        for (let y = 0; y < H; y += 4) {
          for (let x = (y / 4) % 2 ? -4 : 0; x < W; x += 8) {
            const v = Math.floor((RR() - 0.5) * 18);
            g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 240 : 0},${v > 0 ? 230 : 0},${Math.abs(v) / 120})`;
            g.fillRect(x, y, 7, 3);
          }
          g.fillStyle = 'rgba(0,0,0,0.22)';
          g.fillRect(0, y + 3, W, 1);
        }
        // grime down from every ledge
        for (let ry = 0; ry < rows; ry++) {
          const grd = g.createLinearGradient(0, ry * BH, 0, ry * BH + 14);
          grd.addColorStop(0, 'rgba(0,0,0,0.3)');
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grd;
          g.fillRect(0, ry * BH, W, 14);
          g.fillStyle = 'rgba(200,200,210,0.18)';
          g.fillRect(0, ry * BH, W, 2);
        }
        for (let cx = 0; cx < cols; cx++) {
          for (let ry = 0; ry < rows - 1; ry++) {
            const x = cx * BW + 7;
            const y = ry * BH + 9;
            // frame and sill
            g.fillStyle = '#2a2a30';
            g.fillRect(x - 2, y - 2, 22, 27);
            g.fillStyle = '#9a9690';
            g.fillRect(x - 3, y + 25, 24, 3);
            const on = RR() < lit;
            if (on) {
              const warm = RR() < 0.7;
              const glass = g.createLinearGradient(x, y, x, y + 23);
              glass.addColorStop(0, warm ? '#ffe2a0' : '#bcd8ff');
              glass.addColorStop(1, warm ? '#d89048' : '#5a7ab8');
              g.fillStyle = glass;
              g.fillRect(x, y, 18, 23);
              // a curtain, or a blind, or a lamp in the room
              const k = RR();
              g.fillStyle = warm ? 'rgba(120,40,30,0.75)' : 'rgba(30,40,70,0.7)';
              if (k < 0.4) g.fillRect(x, y, 6 + Math.floor(RR() * 4), 23);
              else if (k < 0.7) for (let b = 0; b < 23; b += 3) g.fillRect(x, y + b, 18, 1);
              else {
                g.fillStyle = 'rgba(255,250,220,0.9)';
                g.fillRect(x + 11, y + 12, 3, 4);
              }
            } else {
              g.fillStyle = '#0c0e14';
              g.fillRect(x, y, 18, 23);
              g.fillStyle = 'rgba(120,140,180,0.18)';
              g.fillRect(x + 2, y + 2, 5, 9);
            }
            // the glazing bars
            g.fillStyle = '#2a2a30';
            g.fillRect(x + 8, y, 2, 23);
            g.fillRect(x, y + 11, 18, 2);
          }
        }
        // the shop level: a fascia, glass, a door
        const sy = (rows - 1) * BH;
        g.fillStyle = '#1a1c22';
        g.fillRect(0, sy, W, BH);
        g.fillStyle = '#2a2c34';
        g.fillRect(0, sy, W, 8);
        for (let cx = 0; cx < cols; cx++) {
          const shopLit = RR() < lit * 0.8;
          g.fillStyle = shopLit ? '#7a6a4a' : '#101218';
          g.fillRect(cx * BW + 3, sy + 11, BW - 6, BH - 14);
          g.fillStyle = 'rgba(0,0,0,0.5)';
          g.fillRect(cx * BW + 3, sy + 11, BW - 6, 2);
        }
      });
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.anisotropy = 4;
      return t;
    };
    const faced = (tex: THREE.Texture, w: number, h: number, d: number, x: number, z: number, color = 0x8a8a90) => {
      const side = new THREE.MeshLambertMaterial({ color: 0x1a1a20 });
      const front = new THREE.MeshLambertMaterial({ map: tex, color, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, side, front]);
      // the windowed face (-z) looks down the road, toward you
      b.position.set(x, h / 2, z);
      S.add(b);
      return b;
    };

    // the road goes on into town, kerbs and all, and a lamp each side
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 60), lam(0x1e2024));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.03, BACK_Z + 30);
    S.add(road);
    for (let z = BACK_Z + 3; z < BACK_Z + 60; z += 6) box(lam(0x8a7a3a), 0.15, 0.01, 2, 0, 0.035, z);
    for (const sx of [-1, 1]) box(lam(0x3a3c40), 2.4, KERB_H, 60, sx * (ROAD_HALF + 1.2), 0, BACK_Z + 30);
    // (only two of them really light anything: every real light costs every
    // pixel in the scene, and the road already carries a dozen)
    [[-6, Z0 + 2], [6, Z0 + 14], [-6, Z0 + 26], [6, Z0 + 38]].forEach(([x, z], i) => {
      box(lam(0x3a3e44), 0.14, 6, 0.14, x, 0, z);
      // the arm out to the lamp head (without it the head hung in mid-air)
      box(lam(0x4a4e54), 1.5, 0.1, 0.1, x - Math.sign(x) * 0.68, 5.92, z);
      box(lam(0x4a4e54), 0.7, 0.08, 0.36, x - Math.sign(x) * 1.2, 5.92, z);
      box(new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), 0.6, 0.12, 0.3, x - Math.sign(x) * 1.2, 5.8, z);
      if (i % 2 === 0) {
        const l = new THREE.PointLight(0xffc98a, 30, 16, 1.4);
        l.position.set(x - Math.sign(x) * 1.2, 5.5, z);
        S.add(l);
      }
    });

    // ---- THE ARCADE, FROM BEHIND (your left, turned round: +x), its back to the road
    // Built facing -z in its own space and turned to face the road: its back
    // wall, with all the service end of the business on it, looks across the
    // road at the shops opposite.
    const arc = new THREE.Group();
    arc.rotation.y = Math.PI / 2;
    arc.position.set(ROAD_HALF + 3.4, 0, Z0 + 13);
    S.add(arc);
    const boxA = (mm: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh => {
      const bb = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mm);
      bb.position.set(x, y + h / 2, z);
      arc.add(bb);
      return bb;
    };
    const ax = 0;
    const az = 0;
    const aw = 18;
    const ad = 16;
    const ah = 8;
    // Brick at 64 pixels a metre: mortar beds, each brick its own shade with
    // a lit top edge and speckle, so the wall reads as laid brick up close.
    const brick = canvasTex(128, 128, (g) => {
      let q = 91;
      const RB = () => ((q = (q * 16807) % 2147483647) / 2147483647);
      g.fillStyle = '#5a5054';
      g.fillRect(0, 0, 128, 128);
      for (let row = 0; row < 16; row++) {
        for (let x = (row % 2) * -8; x < 128; x += 16) {
          const k = RB();
          g.fillStyle = k < 0.33 ? '#7a4038' : k < 0.66 ? '#6a3832' : '#844a3e';
          g.fillRect(x + 1, row * 8 + 1, 14, 6);
          g.fillStyle = 'rgba(255,220,200,0.12)';
          g.fillRect(x + 1, row * 8 + 1, 14, 1);
          g.fillStyle = 'rgba(0,0,0,0.22)';
          g.fillRect(x + 1, row * 8 + 6, 14, 1);
          for (let n = 0; n < 4; n++) {
            g.fillStyle = RB() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,230,210,0.1)';
            g.fillRect(x + 2 + Math.floor(RB() * 12), row * 8 + 2 + Math.floor(RB() * 4), 1, 1);
          }
        }
      }
    });
    brick.wrapS = brick.wrapT = THREE.RepeatWrapping;
    brick.repeat.set(aw / 2, ah / 2);
    brick.anisotropy = 4;
    const brickMat = new THREE.MeshLambertMaterial({ map: brick, emissive: 0xffffff, emissiveMap: brick, emissiveIntensity: 0.12 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(aw, ah, ad), brickMat);
    body.position.set(ax, ah / 2, az + ad / 2);
    arc.add(body);
    // ---- ITS FRONT, AS THE STREET KNOWS IT (the 2D street's own painting,
    // built): a cornice, the sign board with the frog on it, two pillars, a
    // poster either side of each, the glass doors chained shut and padlocked,
    // and CLOSED in red over them.
    const fz = az - 0.01;
    const steel = lam(0x5a6068);
    const trim = lam(0x4a5468);
    // the cornice along the top, and the pilasters at the corners
    boxA(trim, aw + 0.6, 0.5, 0.5, ax, ah - 0.5, fz - 0.2);
    for (const px of [ax - aw / 2 + 0.3, ax + aw / 2 - 0.3]) boxA(trim, 0.6, ah - 0.5, 0.5, px, 0, fz - 0.2);
    // the sign board: dark, a purple frame, the frog and the name
    const board = canvasTex(256, 48, (g) => {
      g.fillStyle = '#141820';
      g.fillRect(0, 0, 256, 48);
      g.strokeStyle = '#7a5aa8';
      g.lineWidth = 2;
      g.strokeRect(2, 2, 252, 44);
      // the frog's head
      g.fillStyle = '#5a86a8';
      g.beginPath();
      g.ellipse(30, 26, 16, 13, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(22, 13, 5, 0, Math.PI * 2);
      g.arc(38, 13, 5, 0, Math.PI * 2);
      g.fill();
      g.font = 'bold 22px monospace';
      g.fillStyle = '#8a96a8';
      g.fillText('FROGGY ARCADE', 56, 33);
    });
    const boardM = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 1.7),
      new THREE.MeshLambertMaterial({ map: board, emissive: 0xffffff, emissiveMap: board, emissiveIntensity: 0.4 }),
    );
    boardM.rotation.y = Math.PI;
    boardM.position.set(ax, ah + 0.4, fz - 0.3);
    arc.add(boardM);
    boxA(lam(0x1a1c24), 9.4, 2.1, 0.3, ax, ah - 0.65, fz - 0.1);
    // two pillars either side of the doorway, a lamp on each
    for (const sx of [-1, 1]) {
      boxA(trim, 0.45, ah - 0.6, 0.45, ax + sx * 2.6, 0, fz - 0.3);
      boxA(lam(0x2a2c34), 0.25, 0.3, 0.2, ax + sx * 2.6, 3.4, fz - 0.6);
      boxA(new THREE.MeshBasicMaterial({ color: 0x8a96b0 }), 0.15, 0.08, 0.05, ax + sx * 2.6, 3.42, fz - 0.71);
    }
    // the posters: a frog face on each, four colours
    const poster = (bg: string, band: string) =>
      canvasTex(32, 48, (g) => {
        g.fillStyle = '#20242e';
        g.fillRect(0, 0, 32, 48);
        g.fillStyle = bg;
        g.fillRect(2, 2, 28, 44);
        g.fillStyle = band;
        g.fillRect(6, 6, 20, 3);
        g.fillRect(8, 38, 16, 2);
        g.fillStyle = '#7aa0b8';
        g.beginPath();
        g.ellipse(16, 25, 8, 6, 0, 0, Math.PI * 2);
        g.fill();
        g.fillRect(9, 16, 4, 4);
        g.fillRect(19, 16, 4, 4);
        g.fillStyle = '#1a2028';
        g.fillRect(11, 23, 2, 2);
        g.fillRect(19, 23, 2, 2);
      });
    for (const [px, bg, band] of [
      [ax - 7, '#3e3e8a', '#b8b8e8'],
      [ax - 4.4, '#2e3e4e', '#7a6ab8'],
      [ax + 4.4, '#5a2a3e', '#b8a8e8'],
      [ax + 7, '#3e5a6a', '#c8d8e8'],
    ] as const) {
      const t = poster(bg, band);
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.2), new THREE.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 }));
      pm.rotation.y = Math.PI;
      pm.position.set(px, 2.6, fz - 0.03);
      arc.add(pm);
    }
    // the doors: a frame, two glass leaves, a dark lobby behind them, and
    // the chain across the handles with a padlock on it
    boxA(lam(0x6a7078), 2.8, 3.0, 0.2, ax, 0, fz - 0.05);
    boxA(lam(0x05070a), 2.5, 2.7, 0.05, ax, 0.05, fz - 0.16);
    const glass = new THREE.MeshLambertMaterial({ color: 0x5a7088, transparent: true, opacity: 0.45 });
    for (const sx of [-1, 1]) {
      boxA(glass, 1.15, 2.6, 0.04, ax + sx * 0.62, 0.08, fz - 0.2);
      boxA(steel, 0.06, 0.6, 0.06, ax + sx * 0.12, 1.0, fz - 0.26);
    }
    const chain = lam(0x9aa4ae);
    for (let k = 0; k < 10; k++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 4, 8), chain);
      link.position.set(ax - 0.4 + k * 0.09, 1.35 - Math.sin((k / 9) * Math.PI) * 0.15, fz - 0.3);
      link.rotation.y = k % 2 ? Math.PI / 2 : 0;
      arc.add(link);
    }
    boxA(lam(0xc8a040, 0x2a1c08), 0.14, 0.16, 0.06, ax, 1.06, fz - 0.32);
    // CLOSED, in red, over the doors -- and the one light it throws
    const closed = canvasTex(96, 24, (g) => {
      g.fillStyle = '#1a0606';
      g.fillRect(0, 0, 96, 24);
      g.strokeStyle = '#e8323c';
      g.strokeRect(1, 1, 94, 22);
      g.font = 'bold 16px monospace';
      g.fillStyle = '#ff3a3a';
      g.fillText('CLOSED', 18, 18);
    });
    const closedM = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: closed }));
    closedM.rotation.y = Math.PI;
    closedM.position.set(ax, 3.45, fz - 0.06);
    arc.add(closedM);
    const red = new THREE.PointLight(0xff3020, 5, 9, 1.6);
    red.position.set(ax, 3.3, fz - 1);
    arc.add(red);
    this.beacon = { mesh: closedM, light: red };
    // the pavement in front, and a car parked at the kerb
    boxA(lam(0x3a3c44), aw, 0.12, 2.2, ax, 0, fz - 1.1);
    boxA(lam(0x5a2a30), 3.6, 0.8, 1.6, ax - 6, 0.3, fz - 4.9);
    boxA(lam(0x5a2a30), 2, 0.6, 1.5, ax - 6.2, 1.1, fz - 4.9);
    boxA(lam(0x5a6a88), 1.8, 0.4, 1.52, ax - 6.2, 1.15, fz - 4.9);
    for (const wx of [-1.2, 1.2]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.7, 10), lam(0x111214));
      w.rotation.x = Math.PI / 2;
      w.position.set(ax - 6 + wx, 0.32, fz - 4.9);
      arc.add(w);
    }

    // ---- ACROSS THE ROAD (your right: -x): a row of shops and flats, alleys
    // between them, and neon
    const blocks: Array<[number, number, number, number, string, number]> = [
      // x, z, width, height, wall colour, lit fraction
      [-11, Z0 + 4, 7, 9, '#4a4248', 0.35],
      [-11, Z0 + 14, 6, 13, '#3a3e48', 0.25],
      [-12, Z0 + 25, 8, 7, '#504038', 0.4],
      [-11, Z0 + 36, 7, 16, '#383840', 0.3],
      [-13, Z0 + 48, 9, 11, '#463a40', 0.3],
    ];
    blocks.forEach(([x, z, w, h, colr, lit], i) => {
      const t = facade(Math.round(w / 1.3), Math.round(h / 2.2), colr, lit, 31 + i * 17);
      const b = new THREE.Mesh(new THREE.BoxGeometry(8, h, w), [
        new THREE.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35 }),
        new THREE.MeshLambertMaterial({ color: 0x1a1a20 }),
        new THREE.MeshLambertMaterial({ color: 0x1a1a20 }),
        new THREE.MeshLambertMaterial({ color: 0x1a1a20 }),
        new THREE.MeshLambertMaterial({ color: 0x1a1a20 }),
        new THREE.MeshLambertMaterial({ color: 0x1a1a20 }),
      ]);
      // the windowed face is +x: toward the road
      b.position.set(x - 4, h / 2, z);
      S.add(b);
    });
    // neon: a bar, a laundrette, a noodle place
    for (const [z, y, colr, w] of [[Z0 + 4, 3.2, 0xff3fa0, 2.4], [Z0 + 25, 2.8, 0x3fd8ff, 3], [Z0 + 36, 3.6, 0xffb040, 2]] as const) {
      box(new THREE.MeshBasicMaterial({ color: colr, fog: false }), 0.08, 0.5, w, -6.9, y, z);
      if (z === Z0 + 4) {
        const nl = new THREE.PointLight(colr, 6, 8, 1.8);
        nl.position.set(-6.3, y, z);
        S.add(nl);
      }
    }
    // an awning and a shop window, lit, at street level
    box(lam(0x6a1a28), 1.2, 0.1, 5, -7.6, 2.6, Z0 + 4);
    box(new THREE.MeshBasicMaterial({ color: 0x2a3a48 }), 0.05, 1.6, 4, -6.98, 0.5, Z0 + 4);

    // ---- FAR OFF: the rest of the town, a skyline of lit windows the fog
    // only half takes, and the glow of it on the low cloud
    for (let k = 0; k < 22; k++) {
      const x = -70 + k * 6.5 + (R() - 0.5) * 3;
      const h = 14 + R() * 30;
      const t = facade(4, Math.round(h / 3), '#141820', 0.22, 101 + k);
      const tower = faced(t, 5 + R() * 3, h, 5, x, BACK_Z + 95 + R() * 25, 0x8088a0);
      (tower.material as THREE.Material[]).forEach((m) => ((m as THREE.MeshLambertMaterial).fog = false));
      if (R() < 0.3) {
        const blink = box(new THREE.MeshBasicMaterial({ color: 0xff2a2a, fog: false }), 0.4, 0.4, 0.4, x, h, tower.position.z);
        void blink;
      }
    }
    // (soft all round -- a flat sheet left a hard edge across the sky and
    // blotted out the stars -- and drawn under the stars, not over them)
    const glowTex = canvasTex(128, 64, (g) => {
      const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      grd.addColorStop(0, 'rgba(58,42,64,0.45)');
      grd.addColorStop(1, 'rgba(58,42,64,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 64);
    });
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 60),
      new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, fog: false, depthWrite: false }),
    );
    glow.position.set(0, 25, BACK_Z + 125);
    glow.rotation.y = Math.PI;
    glow.renderOrder = -9.5;
    S.add(glow);

    // ---- THE TOWN CLOSES ROUND YOU.  Behind the arcade an alley, a fence and
    // warehouses; beyond the shops more blocks; the street ends at a building
    // across it.  From anywhere you can stand, every way you look is town or
    // trees -- never the end of the world.
    const texes = [0, 1, 2, 3, 4, 5].map((k) =>
      facade(6, 6, ['#3a3438', '#2e3038', '#40362e', '#34343a', '#3a2e30', '#2c2e30'][k], 0.12 + (k % 3) * 0.08, 211 + k * 13),
    );
    const roof = new THREE.MeshLambertMaterial({ color: 0x15161a });
    const bld = (x: number, z: number, w: number, d: number, h: number, k: number): void => {
      const t = texes[k % texes.length];
      const wall = new THREE.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [wall, wall, roof, roof, wall, wall]);
      b.position.set(x, h / 2, z);
      S.add(b);
      // a parapet and, now and then, something on the roof
      box(roof, w + 0.3, 0.5, d + 0.3, x, h, z);
      if (R() < 0.35) box(lam(0x2a2c30), 1.6, 1.4, 1.6, x + (R() - 0.5) * w * 0.5, h + 0.5, z + (R() - 0.5) * d * 0.5);
    };
    // the warehouses: long, low, corrugated
    const tin = canvasTex(64, 32, (g) => {
      g.fillStyle = '#3a3e42';
      g.fillRect(0, 0, 64, 32);
      for (let x = 0; x < 64; x += 4) {
        g.fillStyle = '#2a2e32';
        g.fillRect(x, 0, 1, 32);
        g.fillStyle = '#4a4e52';
        g.fillRect(x + 2, 0, 1, 32);
      }
      g.fillStyle = 'rgba(90,50,30,0.35)';
      for (let i = 0; i < 12; i++) g.fillRect(Math.floor(R() * 64), 20 + Math.floor(R() * 12), 3, 12);
    });
    tin.wrapS = tin.wrapT = THREE.RepeatWrapping;
    const shed = (x: number, z: number, w: number, d: number, h: number): void => {
      const t = tin.clone();
      t.repeat.set(Math.max(w, d) / 4, h / 4);
      t.needsUpdate = true;
      const m = new THREE.MeshLambertMaterial({ map: t });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [m, m, roof, roof, m, m]);
      b.position.set(x, h / 2, z);
      S.add(b);
      // a roller door and a caged lamp over it, facing the alley (-x)
      box(lam(0x24282c), 0.1, 3.2, 3.6, x - w / 2 - 0.05, 0, z);
      box(new THREE.MeshBasicMaterial({ color: 0xffcf8a }), 0.2, 0.15, 0.3, x - w / 2 - 0.2, 3.7, z);
    };
    const AX = ROAD_HALF + 3.4 + 16; // the arcade's back wall
    // the alley behind it: cracked concrete, bins, a dumpster, pallets
    const alley = new THREE.Mesh(new THREE.PlaneGeometry(9, 70), lam(0x1c1d20));
    alley.rotation.x = -Math.PI / 2;
    alley.position.set(AX + 4.5, 0.025, Z0 + 30);
    S.add(alley);
    box(lam(0x2a4a34), 1.8, 1.3, 1.1, AX + 1.2, 0, Z0 + 8);
    box(lam(0x22262a), 0.7, 1, 0.7, AX + 0.6, 0, Z0 + 11);
    box(lam(0x22262a), 0.7, 1, 0.7, AX + 0.6, 0, Z0 + 12);
    for (let k = 0; k < 3; k++) box(lam(0x5a4630), 1.2, 0.15, 1, AX + 1, k * 0.16, Z0 + 21);
    // a chain-link fence along the far side of the alley, on posts
    const mesh = canvasTex(16, 16, (g) => {
      g.clearRect(0, 0, 16, 16);
      g.strokeStyle = '#7a8088';
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(16, 16);
      g.moveTo(16, 0);
      g.lineTo(0, 16);
      g.stroke();
    });
    mesh.wrapS = mesh.wrapT = THREE.RepeatWrapping;
    mesh.repeat.set(70 / 0.6, 2.4 / 0.6);
    const fence = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 2.4),
      new THREE.MeshLambertMaterial({ map: mesh, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }),
    );
    fence.rotation.y = Math.PI / 2;
    fence.position.set(AX + 8.5, 1.2, Z0 + 30);
    S.add(fence);
    for (let z = Z0 - 4; z < Z0 + 65; z += 3) box(lam(0x4a4e54), 0.08, 2.5, 0.08, AX + 8.5, 0, z);
    // power poles down the alley, with the wires sagging between them
    let last: THREE.Vector3 | null = null;
    for (let z = Z0 - 2; z < Z0 + 64; z += 12) {
      box(lam(0x3a2e24), 0.25, 9, 0.25, AX + 7.6, 0, z);
      box(lam(0x3a2e24), 2.2, 0.15, 0.15, AX + 7.6, 8.4, z);
      const top = new THREE.Vector3(AX + 7.6, 8.5, z);
      if (last) {
        for (const off of [-0.9, 0, 0.9]) {
          const a = last.clone().setX(last.x + off);
          const b = top.clone().setX(top.x + off);
          const mid = a.clone().lerp(b, 0.5).setY(a.y - 0.8);
          const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
          S.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(10)), new THREE.LineBasicMaterial({ color: 0x0a0a0c })));
        }
      }
      last = top;
    }
    // the warehouses past the fence, end to end, one with a water tank on it
    shed(AX + 18, Z0 + 4, 18, 16, 7);
    shed(AX + 17, Z0 + 24, 16, 18, 9);
    shed(AX + 19, Z0 + 46, 20, 20, 8);
    box(lam(0x3a3028), 3, 3.2, 3, AX + 19, 9, Z0 + 24);
    for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) box(lam(0x2a2420), 0.15, 0.9, 0.15, AX + 19 + dx, 9, Z0 + 24 + dz);
    // and blocks past them, out to the trees
    for (let k = 0; k < 6; k++) bld(AX + 40 + (k % 2) * 12, Z0 - 6 + k * 12, 10, 10, 10 + R() * 14, k);
    // beyond the arcade's far end (the side away from the trees), a block
    bld(ROAD_HALF + 12, Z0 + 30, 14, 9, 12, 2);
    bld(ROAD_HALF + 12, Z0 + 44, 14, 12, 16, 3);
    // behind the shops across the road, more of the town, rising
    for (let k = 0; k < 6; k++) bld(-30 - (k % 2) * 14, Z0 - 2 + k * 11, 12, 10, 12 + R() * 16, k + 1);
    for (let k = 0; k < 5; k++) bld(-60 - (k % 2) * 12, Z0 + k * 13, 12, 12, 16 + R() * 18, k + 3);
    // the street does not just stop: a building across the end of it
    bld(0, Z0 + 66, 34, 10, 18, 4);
    bld(-24, Z0 + 66, 14, 10, 13, 5);
    bld(24, Z0 + 68, 14, 10, 22, 0);
  }

  /**
   * THE HORIZON.  A band all the way round, out past everything and moving
   * with you: the fog's own colour at the bottom, so the ground melts into
   * it, rising to a skyline -- treetops round the woods, and over the town
   * behind you roofs and a few lit windows.  Whatever way you look, the land
   * goes on.
   */
  private buildHorizon(R: () => number): void {
    if (!this.sky) return;
    const W = 2048;
    const H = 128;
    const tex = canvasTex(W, H, (g) => {
      g.clearRect(0, 0, W, H);
      const fogC = '#05080f';
      // the town lies behind the start: +z, which on this band is u ~ 0.75
      const townAt = (u: number) => {
        const d = Math.abs(((u - 0.75 + 1.5) % 1) - 0.5);
        return d < 0.14;
      };
      let x = 0;
      while (x < W) {
        const u = x / W;
        if (townAt(u)) {
          const w = 10 + Math.floor(R() * 22);
          const h = 30 + Math.floor(R() * 60);
          g.fillStyle = '#0a0c14';
          g.fillRect(x, H - h, w, h);
          for (let y = H - h + 4; y < H - 30; y += 5) {
            for (let wx = x + 2; wx < x + w - 2; wx += 4) {
              if (R() < 0.12) {
                g.fillStyle = R() < 0.7 ? '#d8a050' : '#8aa0d0';
                g.fillRect(wx, y, 2, 2);
              }
            }
          }
          x += w;
        } else {
          // treetops: pines' points and the rounder broadleaf crowns
          const w = 6 + Math.floor(R() * 10);
          const h = 26 + Math.floor(R() * 34);
          g.fillStyle = '#060a0a';
          g.beginPath();
          if (R() < 0.6) {
            g.moveTo(x - 4, H);
            g.lineTo(x + w / 2, H - h);
            g.lineTo(x + w + 4, H);
          } else {
            g.ellipse(x + w / 2, H - h * 0.7, w, h * 0.35, 0, 0, Math.PI * 2);
            g.rect(x, H - h * 0.7, w, h * 0.7);
          }
          g.fill();
          x += w - 2;
        }
      }
      // and the fog over the lower part of all of it
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0.35, 'rgba(5,8,15,0)');
      grd.addColorStop(0.85, fogC);
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    });
    tex.wrapS = THREE.RepeatWrapping;
    // the band: 60 m tall, 300 m out, from well below your feet to a little
    // above the horizon; and a skirt of solid fog under it
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(300, 300, 60, 64, 1, true),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    band.position.y = 5;
    band.renderOrder = -9;
    this.sky.add(band);
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(300, 300, 200, 64, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x05080f, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    skirt.position.y = -125;
    skirt.renderOrder = -9;
    this.sky.add(skirt);
  }

  private buildLamps(S: THREE.Scene): void {
    const pole = new THREE.MeshLambertMaterial({ color: 0x3a3e44 });
    const bulb = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    const pool = decal(new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.08, depthWrite: false }), 6);
    LAMP_ZS.forEach((z, i) => {
      const side = i % 2 ? 1 : -1;
      const x = side * (RAIL_X + 0.7);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 6, 6), pole);
      post.position.set(x, 3, z);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.12), new THREE.MeshLambertMaterial({ color: 0x4a4e54 }));
      arm.position.set(x - side * 1, 5.9, z);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.3), bulb);
      head.position.set(x - side * 1.9, 5.82, z);
      S.add(post, arm, head);
      const light = new THREE.PointLight(0xffc98a, 40, 17, 1.35);
      light.position.set(x - side * 1.9, 5.5, z);
      S.add(light);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(5.5, 20), pool);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(x - side * 1.9, KERB_H + 0.012, z);
      S.add(disc);
    });
  }

  /**
   * The hotel: a dark block with its windows lit, its name in neon over a
   * warm doorway, and none of it fogged -- it is the one thing on this road
   * you can always see, a long way off.
   */
  /**
   * The Grand Lily, head-on: the front is the very painting the pixel street
   * hangs on its wall (art/hotel.ts), five pixels to a metre, so the two are
   * one building.  What stands out from the front is built: the maroon canopy
   * on its gold posts, the bay trees either side of the door.
   */
  private buildHotel(S: THREE.Scene): void {
    const PX = 5;
    const W = HOTEL_W / PX;
    const H = HOTEL_H / PX;
    const D = 22;
    const fx = (px: number): number => (px - HOTEL_DOOR) / PX;
    const fy = (py: number): number => (HOTEL_H - py) / PX;
    // Its sides: stone with rows of windows, a few lit, so from an angle it is
    // a building and not a painted board on a box.
    // Its sides: stone, with windows on exactly the front's floors -- six
    // above the ground floor, level with the front's -- so from an angle it
    // is the same six-storey building, not a taller one.  `hm` metres of wall
    // up from the ground, `wm` across: the wings are built from the same.
    const sideFace = (wm: number, hm: number): THREE.CanvasTexture => {
      const TW = Math.round(wm * 8);
      const TH = Math.round(hm * 8);
      const k = 8 / PX; // texture pixels per painting pixel
      const cut = HOTEL_H - hm * PX; // the painting's y at the top of this wall
      const t = canvasTex(TW, TH, (g) => {
        g.fillStyle = '#4a3c48';
        g.fillRect(0, 0, TW, TH);
        for (let y = 0; y < TH; y += 6) {
          g.fillStyle = 'rgba(0,0,0,0.2)';
          g.fillRect(0, y + 5, TW, 1);
          for (let x = (y / 6) % 2 ? -6 : 0; x < TW; x += 12) {
            g.fillStyle = `rgba(255,240,230,${(((x * 7 + y * 3) % 9) / 9) * 0.06})`;
            g.fillRect(x, y, 11, 5);
          }
        }
        // a belt course at the ground floor, as on the front
        g.fillStyle = '#6a5a66';
        g.fillRect(0, Math.round((HOTEL_GROUND - 2 - cut) * k), TW, 4);
        const rows = [...HOTEL_FLOORS, HOTEL_GROUND + 8].filter((top) => top >= cut + 2);
        rows.forEach((top) => {
          const fy2 = Math.round((top - cut) * k);
          const wh = Math.round(11 * k);
          for (let fx2 = 10; fx2 < TW - 14; fx2 += 22) {
            const on = (fx2 * 13 + fy2 * 7) % 5 === 0;
            g.fillStyle = '#2a2430';
            g.fillRect(fx2 - 2, fy2 - 2, 14, wh + 4);
            g.fillStyle = on ? '#f0c070' : '#141018';
            g.fillRect(fx2, fy2, 10, wh);
            g.fillStyle = '#9a8a88';
            g.fillRect(fx2 - 3, fy2 + wh + 1, 16, 2);
          }
        });
      });
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      return t;
    };
    const faceMat = (t: THREE.Texture) => new THREE.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 });
    const sideTex = sideFace(D, H);
    sideTex.magFilter = THREE.LinearFilter;
    sideTex.minFilter = THREE.LinearMipmapLinearFilter;
    const sideMat = new THREE.MeshLambertMaterial({ map: sideTex, emissive: 0xffffff, emissiveMap: sideTex, emissiveIntensity: 0.25 });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x2a2430 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [sideMat, sideMat, roofMat, roofMat, roofMat, roofMat]);
    body.position.set(0, H / 2, HOTEL_Z - 2 - D / 2);
    S.add(body);
    // The front: the street's painting, drawn four times over with the stone
    // between the windows given courses and grain, so up close it is masonry
    // and not a blown-up sprite.
    const facade = canvasTex(HOTEL_W * 4, HOTEL_H * 4, (g) => {
      const small = document.createElement('canvas');
      small.width = HOTEL_W;
      small.height = HOTEL_H;
      const sg = small.getContext('2d')!;
      paintHotel(sg, { dusk: true });
      g.imageSmoothingEnabled = false;
      g.drawImage(small, 0, 0, HOTEL_W * 4, HOTEL_H * 4);
      const px = sg.getImageData(0, 0, HOTEL_W, HOTEL_H).data;
      for (let y = 0; y < HOTEL_H; y++) {
        for (let x = 0; x < HOTEL_W; x++) {
          const i = (y * HOTEL_W + x) * 4;
          const lum = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
          if (px[i + 3] < 10 || lum > 120) continue; // windows, lamps, the sign: left clean
          // stone: a mortar line every few rows, and grain
          if (y % 3 === 0) {
            g.fillStyle = 'rgba(0,0,0,0.16)';
            g.fillRect(x * 4, y * 4, 4, 1);
          }
          if ((x + (Math.floor(y / 3) % 2) * 3) % 6 === 0) {
            g.fillStyle = 'rgba(0,0,0,0.12)';
            g.fillRect(x * 4, y * 4, 1, 4);
          }
          g.fillStyle = `rgba(255,245,235,${(((x * 31 + y * 17) % 7) / 7) * 0.07})`;
          g.fillRect(x * 4 + ((x * y) % 3), y * 4 + 1, 2, 2);
        }
      }
    });
    facade.magFilter = THREE.LinearFilter;
    facade.minFilter = THREE.LinearMipmapLinearFilter;
    facade.anisotropy = 4;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: facade, fog: false }));
    front.position.set(0, H / 2, HOTEL_Z - 1.98);
    S.add(front);

    // IT IS A BUILDING, NOT A BOARD.  Real stone stands out of the painting:
    // corner piers, a heavy cornice along the top, a plinth either side of
    // the doors; a parapet and plant on the roof; lower wings set back either
    // side; and the city's towers behind it, over its shoulders.
    const stone = new THREE.MeshLambertMaterial({ color: 0x6a5a66, emissive: 0x1a1218 });
    const slab = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = stone): void => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y + h / 2, z);
      S.add(b);
    };
    const FZ = HOTEL_Z - 2;
    for (const sx of [-1, 1]) {
      slab(1.4, H + 0.4, 1.2, sx * (W / 2 + 0.2), 0, FZ - 0.3);
      slab(W / 2 - 4.5, 0.7, 0.5, sx * (W / 4 + 2.25), 0, FZ + 0.2);
    }
    slab(W + 2, 1.1, 1.6, 0, H - 0.2, FZ - 0.4);
    slab(W + 1.4, 0.35, 1.0, 0, H - 0.75, FZ - 0.2);
    // the parapet round the roof, and what sits on it
    slab(W, 1.2, 0.4, 0, H + 0.9, FZ - 0.4);
    slab(W, 1.2, 0.4, 0, H + 0.9, FZ - D + 0.2);
    for (const sx of [-1, 1]) slab(0.4, 1.2, D, sx * (W / 2 - 0.2), H + 0.9, FZ - D / 2);
    slab(8, 3.5, 6, -5, H, FZ - D / 2 - 2, roofMat);
    slab(3, 4, 3, 7, H, FZ - D / 2 + 3, roofMat);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 10), new THREE.MeshLambertMaterial({ color: 0x3a3430 }));
    tank.position.set(7, H + 5.3, FZ - D / 2 + 3);
    S.add(tank);
    // the wings: lower, set back, windowed like the sides
    // (the ground floor and three above it, topping out under the main block's
    // level-4 sills)
    const WH = (HOTEL_H - (HOTEL_FLOORS[3] - 4)) / PX;
    const wingSide = faceMat(sideFace(18, WH));
    const wingEnd = faceMat(sideFace(9, WH));
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(9, WH, 18), [wingSide, wingSide, roofMat, roofMat, wingEnd, wingEnd]);
      wing.position.set(sx * (W / 2 + 4.5), WH / 2, FZ - 4 - 9);
      S.add(wing);
      slab(9.6, 0.8, 18.6, sx * (W / 2 + 4.5), WH, FZ - 13);
    }
    // the city behind it: towers rising past its roof, lit here and there
    const towerTex = canvasTex(64, 256, (g) => {
      g.fillStyle = '#1a1c24';
      g.fillRect(0, 0, 64, 256);
      for (let y = 6; y < 250; y += 8) {
        for (let x = 4; x < 60; x += 8) {
          const k = (x * 7 + y * 13) % 17;
          g.fillStyle = k < 2 ? '#e0a860' : k < 3 ? '#9ab0e0' : '#0c0d12';
          g.fillRect(x, y, 4, 5);
        }
      }
    });
    towerTex.magFilter = THREE.LinearFilter;
    const towerMat = new THREE.MeshLambertMaterial({ map: towerTex, emissive: 0xffffff, emissiveMap: towerTex, emissiveIntensity: 0.4 });
    const backs: Array<[number, number, number, number]> = [
      // x, z (behind the hotel), width, height
      [-26, -40, 14, 44],
      [-8, -48, 16, 52],
      [12, -44, 14, 40],
      [30, -38, 12, 36],
      [-44, -30, 12, 30],
      [46, -28, 12, 28],
      [0, -70, 30, 60],
    ];
    for (const [x, dz, w, h] of backs) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, 12), [towerMat, towerMat, roofMat, roofMat, towerMat, towerMat]);
      t.position.set(x, h / 2, HOTEL_Z + dz);
      S.add(t);
    }

    // the canopy: out over the step, its scalloped front the street's
    const C = HOTEL_CANOPY;
    const cw = (C.x1 - C.x0) / PX;
    const ch = (C.bottom - C.top) / PX;
    const depth = 3.6;
    const cz = HOTEL_Z - 1.98 + depth / 2;
    const face = canvasTex(C.x1 - C.x0, C.bottom - C.top, (g) => paintCanopy(g, { dusk: true }));
    const maroon = new THREE.MeshLambertMaterial({ color: 0x6a2232, emissive: 0x2a0a12 });
    const under = new THREE.MeshBasicMaterial({ color: 0x2a0e16, fog: false });
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, depth), [
      maroon,
      maroon,
      maroon,
      under,
      new THREE.MeshBasicMaterial({ map: face, transparent: true, fog: false }),
      maroon,
    ]);
    canopy.position.set(0, fy(C.top) - ch / 2, cz);
    S.add(canopy);
    // the bulbs under it
    for (const k of [-0.32, 0, 0.32]) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0b0, fog: false }));
      bulb.position.set(k * cw, fy(C.bottom) - 0.1, cz + depth * 0.3);
      S.add(bulb);
    }
    const gold = new THREE.MeshLambertMaterial({ color: 0xc9a24a, emissive: 0x3a2a08 });
    const postH = fy(C.bottom);
    for (const px of HOTEL_POSTS) {
      const x = fx(px);
      const z = cz + depth / 2 - 0.2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, postH, 8), gold);
      post.position.set(x, postH / 2, z);
      S.add(post);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.18, 10), gold);
      foot.position.set(x, 0.09, z);
      S.add(foot);
      this.boxes.push({ x0: x - 0.15, x1: x + 0.15, z0: z - 0.15, z1: z + 0.15 });
    }
    // the bay trees in their planters, either side of the door
    const pot = new THREE.MeshLambertMaterial({ color: 0x3a3238 });
    const leaf = new THREE.MeshLambertMaterial({ color: 0x2e4a2a, emissive: 0x0a1408 });
    for (const px of HOTEL_PLANTERS) {
      const x = fx(px);
      const z = HOTEL_Z - 1.3;
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), pot);
      box.position.set(x, 0.45, z);
      S.add(box);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), new THREE.MeshLambertMaterial({ color: 0x3a2a1e }));
      stem.position.set(x, 1.3, z);
      S.add(stem);
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), leaf);
      ball.position.set(x, 2.1, z);
      S.add(ball);
      this.boxes.push({ x0: x - 0.6, x1: x + 0.6, z0: z - 0.6, z1: z + 0.6 });
    }
    // the carpet down the step, and the light the doors and the canopy throw
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(SAFE_HALF * 2 - 0.4, 4.2), decal(new THREE.MeshLambertMaterial({ color: 0x6a1a28 }), 2));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.02, HOTEL_Z + 0.1);
    S.add(carpet);
    const warm = new THREE.PointLight(0xffc27a, 70, 18, 1.2);
    warm.position.set(0, postH - 0.6, HOTEL_Z + 1);
    S.add(warm);
    // the forecourt: flagstones out to where the rails end
    // Polished stone: big veined slabs in two tones laid as a chequer, a fine
    // dark joint between them, and a gloss that takes the canopy's light.
    const R2 = rng(77);
    const slabTex = canvasTex(256, 256, (g) => {
      const T = 64;
      for (let ty = 0; ty < 4; ty++) {
        for (let tx = 0; tx < 4; tx++) {
          const light = (tx + ty) % 2 === 0;
          g.fillStyle = light ? '#b8b0a2' : '#5c5650';
          g.fillRect(tx * T, ty * T, T, T);
          // soft cloud in the stone
          for (let k = 0; k < 14; k++) {
            g.fillStyle = light ? 'rgba(150,142,128,0.18)' : 'rgba(40,36,34,0.22)';
            g.beginPath();
            g.ellipse(tx * T + R2() * T, ty * T + R2() * T, 6 + R2() * 14, 4 + R2() * 9, R2() * 3, 0, Math.PI * 2);
            g.fill();
          }
          // veins
          g.strokeStyle = light ? 'rgba(110,100,90,0.45)' : 'rgba(170,160,148,0.3)';
          g.lineWidth = 1;
          g.beginPath();
          let x = tx * T + R2() * T;
          let y = ty * T;
          g.moveTo(x, y);
          for (let k = 0; k < 6; k++) {
            x += (R2() - 0.5) * 18;
            y += T / 6;
            g.lineTo(Math.max(tx * T, Math.min(tx * T + T, x)), y);
          }
          g.stroke();
          // a sheen along the top edge, a shadow along the bottom
          g.fillStyle = 'rgba(255,250,240,0.12)';
          g.fillRect(tx * T, ty * T, T, 2);
          g.fillStyle = 'rgba(0,0,0,0.18)';
          g.fillRect(tx * T, ty * T + T - 2, T, 2);
        }
      }
      // the joints
      g.fillStyle = '#1c1a18';
      for (let k = 0; k <= 4; k++) {
        g.fillRect(k * 64 - 1, 0, 2, 256);
        g.fillRect(0, k * 64 - 1, 256, 2);
      }
    });
    slabTex.wrapS = slabTex.wrapT = THREE.RepeatWrapping;
    slabTex.repeat.set(26 / 4.8, 12 / 4.8);
    slabTex.anisotropy = 4;
    const court = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 12),
      decal(new THREE.MeshPhongMaterial({ map: slabTex, color: 0xd8d2c8, specular: 0x6a6460, shininess: 90 }), 1),
    );
    court.rotation.x = -Math.PI / 2;
    court.position.set(0, 0.015, HOTEL_Z + 4);
    S.add(court);
  }

  // ===================================================================== loop

  private tick(dt: number): void {
    if (!this.stage) return;
    if (this.phase === 'caught') {
      this.scare?.update(dt);
      return;
    }
    this.clock += dt;
    this.phaseT += dt;
    for (const t of this.waterMats) t.offset.set(this.clock * 0.012, Math.sin(this.clock * 0.3) * 0.02);
    if (this.riverFlow.length === 2) {
      this.riverFlow[0].offset.set(this.clock * 0.18, Math.sin(this.clock * 0.4) * 0.03);
      this.riverFlow[1].offset.set(this.clock * 0.3, Math.sin(this.clock * 0.9) * 0.06 + this.clock * 0.01);
    }
    this.stepRipples(dt);
    this.stirFoliage(dt);
    this.sky?.position.copy(this.stage.camera.position);
    if (this.beacon) {
      // the CLOSED sign: a tired neon, mostly on, now and then a stutter
      const on = Math.sin(this.clock * 23) > -0.85 || Math.sin(this.clock * 1.3) < 0.7;
      this.beacon.light.intensity = on ? 5 : 0.6;
      (this.beacon.mesh.material as THREE.MeshBasicMaterial).color.setHex(on ? 0xffffff : 0x502020);
    }
    if (this.twinkle) this.twinkle.opacity = 0.7 + Math.sin(this.clock * 2.3) * 0.2 + Math.sin(this.clock * 5.1) * 0.1;
    if (this.busLight && this.busTube) {
      // the tube is not well: mostly on, now and then a stutter
      const on = Math.sin(this.clock * 23) > -0.92 || Math.sin(this.clock * 1.7) < 0.6;
      this.busLight.intensity = on ? 7 : 1.5;
      this.busTube.color.setHex(on ? 0xcfe8ff : 0x4a5866);
    }
    this.movePlayer(dt);
    this.chaseHints(dt);
    this.story(dt);
    this.moveFroggy(dt);
    this.ambience(dt);
    this.updateCamera(dt);
    this.paintOverlay();
    this.publish();

    if (this.phase === 'chase' && this.pos.distanceTo(this.froggy) < CATCH && this.y < 0.9) this.caught();
    if (this.phase !== 'safe' && this.pos.y < SAFE_Z && Math.abs(this.pos.x) < SAFE_HALF) this.reachSafety();
  }

  /**
   * What the controls offer, and what to press, as each becomes the thing to
   * do.  On the walk in there is no RUN and no JUMP on the touch pad -- only
   * walking.  RUN brings both.  Up against a rail in the chase, how to jump it;
   * over the first one, how to hide.
   */
  private chaseHints(dt: number): void {
    const chase = this.phase === 'chase';
    // (the pad is put up again after create, and on every pause and resume,
    // showing every button: so it is kept in step a few times a second)
    this.padSyncT -= dt;
    if (isTouch() && this.padSyncT <= 0) {
      this.padSyncT = 0.25;
      touchControls.showButton('SHIFT', chase);
      touchControls.showButton('SPACE', chase);
    }
    if (!chase) return;
    const ax = Math.abs(this.pos.x);
    if (!this.overRail && ax > RAIL_X + 0.2) {
      this.overRail = true;
      this.hideHintT = 7;
      this.railHint = 0;
    }
    this.hideHintT = Math.max(0, this.hideHintT - dt);
    // at a rail, your side of it, with no gap to walk through
    const atRail = !this.overRail && ax > RAIL_X - 1.1 && ax < RAIL_X && this.railBlocks(this.pos.x, this.pos.y);
    this.railHint = atRail ? this.railHint + dt : Math.max(0, Math.min(this.railHint, 1.5) - dt);
  }

  private held(g: string): boolean {
    return this.keys[g]?.some((k) => k.isDown) ?? false;
  }

  private onRoad(x = this.pos.x): boolean {
    return Math.abs(x) < RAIL_X;
  }

  private inWater(x: number, z: number): boolean {
    if (Math.abs(x) > RAIL_X + 0.2 && Math.abs(z - RIVER_Z) < RIVER_HALF) return true;
    return this.ponds.some((p) => Math.hypot(x - p.x, z - p.z) < p.r);
  }

  private railsAt(z: number): boolean {
    return z < RAIL_Z0 && z > RAIL_Z1;
  }

  /** Is there rail at this point of the line -- not a gap? */
  private railBlocks(x: number, z: number): boolean {
    if (!this.railsAt(z)) return false;
    const side = Math.sign(x) || 1;
    return !GAPS.some((g) => g.side === side && z < g.z0 && z > g.z1);
  }

  private onPavement(x = this.pos.x, z = this.pos.y): boolean {
    return Math.abs(x) > ROAD_HALF && Math.abs(x) < WALK_X && z > ROAD_END;
  }

  private movePlayer(dt: number): void {
    const fwd = (this.held('up') ? 1 : 0) - (this.held('down') ? 1 : 0);
    const strafe = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const turn = (this.held('turnR') ? 1 : 0) - (this.held('turnL') ? 1 : 0);
    if (!this.autoTurn) this.yaw -= turn * 2.4 * dt;
    // crouched, your eye comes down; up on the pavement, a hand higher
    const eyeWant = EYE * (this.crouched ? CROUCH_EYE : 1) + (this.onPavement() ? KERB_H : 0);
    this.eye += (eyeWant - this.eye) * Math.min(1, dt * 8);
    if (this.phase === 'safe') return;

    // the jump: over a log, out of the water -- and, once he is after you, a rail
    const grounded = this.y <= 0;
    // (walking in, you are tired and going home: no running, no jumping)
    if (grounded && !this.crouched && this.jumpKeys.some((k) => Phaser.Input.Keyboard.JustDown(k)) && this.phase === 'chase') {
      this.vy = this.inWater(this.pos.x, this.pos.y) ? JUMP_V * 0.7 : JUMP_V;
      audio.sfx('step_run', 0.5);
    }
    if (this.y > 0 || this.vy > 0) {
      this.vy -= GRAVITY * dt;
      this.y = Math.max(0, this.y + this.vy * dt);
      if (this.y === 0) {
        this.vy = 0;
        this.land();
      }
    }

    // Running is the chase's.  Before then you are walking home, tired.
    this.running = this.phase === 'chase' && this.held('run') && !this.crouched;
    this.moving = fwd !== 0 || strafe !== 0;
    this.brushThickets(dt);
    if (!this.moving) return;

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let dx = -sin * fwd + cos * strafe;
    let dz = -cos * fwd - sin * strafe;
    const len = Math.hypot(dx, dz);
    if (len > 1) {
      dx /= len;
      dz /= len;
    }
    const wet = this.y === 0 && this.inWater(this.pos.x, this.pos.y);
    const speed = (this.running ? RUN : WALK) * (wet ? 0.55 : 1) * (this.crouched ? CROUCH_SPEED : 1);
    dx *= speed * dt;
    dz *= speed * dt;

    const was = this.pos.x;
    const nx = this.pos.x + dx;
    const nz = this.pos.y + dz;
    // THE RAILS: solid while you walk in -- walking or jumping, you do not
    // get past one, only through a gap.  From the moment RUN is said (the
    // chase), a jump takes you over the top; walking still does not.
    const over = this.phase === 'chase' && this.y >= RAIL_H - 0.08;
    const crosses = Math.sign(Math.abs(this.pos.x) - RAIL_X) !== Math.sign(Math.abs(nx) - RAIL_X);
    if (!(crosses && !over && this.railBlocks(nx, this.pos.y)) && Math.abs(nx) < WORLD_X) this.pos.x = nx;
    if (nz < BACK_Z && nz > HOTEL_Z - 1.4 && !(nz < HOTEL_Z + 0.3 && Math.abs(this.pos.x) > SAFE_HALF + 0.2)) this.pos.y = nz;
    // (walking along the line from a gap into the rail, you stay your side)
    if (!over && this.railBlocks(this.pos.x, this.pos.y)) {
      const inside = Math.abs(was) < RAIL_X;
      if (inside && Math.abs(this.pos.x) > RAIL_X - PLAYER_R) this.pos.x = Math.sign(this.pos.x) * (RAIL_X - PLAYER_R);
      if (!inside && Math.abs(this.pos.x) < RAIL_X + PLAYER_R) this.pos.x = Math.sign(this.pos.x) * (RAIL_X + PLAYER_R);
    }
    this.pushOutOfTrees(this.pos, PLAYER_R);
    this.pushOutOfBoxes(this.pos, PLAYER_R);
    this.touchWater();
    this.brushLeaves(dt);

    this.bobT += dt * (this.running ? 1.5 : this.crouched ? 0.6 : 1);
    this.stepT += dt;
    if (this.y === 0 && this.stepT > (this.running ? 0.28 : this.crouched ? 0.62 : 0.42)) {
      this.stepT = 0;
      this.footstep(wet);
    }
  }

  /**
   * INTO AND OUT OF THE WATER.  Stepping into a pond or the river is a
   * splash, with rings spreading from your feet; every step in it is a wade
   * (see footstep); climbing out, the water runs off you.  All of it carries.
   */
  private touchWater(): void {
    const wet = this.y === 0 && this.inWater(this.pos.x, this.pos.y);
    if (wet && !this.wasWet) {
      audio.sfx('splash', this.running ? 0.75 : this.crouched ? 0.35 : 0.55);
      this.counts.splash++;
      this.noise(this.running ? 20 : this.crouched ? 7 : 13, this.pos.x, this.pos.y);
      this.ripple();
    } else if (!wet && this.wasWet && this.y === 0) {
      audio.sfx('wade', 0.25);
    }
    this.wasWet = wet;
  }

  /** A ring spreading out on the water from where you stand. */
  private ripple(): void {
    const S = this.stage?.scene;
    if (!S) return;
    if (!this.rippleMat) {
      this.rippleMat = decal(new THREE.MeshBasicMaterial({ color: 0x9ab8d8, transparent: true, opacity: 0.5, depthWrite: false }), 5);
    }
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 24), this.rippleMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.set(this.pos.x, 0.012, this.pos.y);
    m.scale.setScalar(0.2);
    S.add(m);
    this.ripples.push({ m, t: 0 });
  }

  private stepRipples(dt: number): void {
    this.ripples = this.ripples.filter((r) => {
      r.t += dt;
      const k = r.t / 1.4;
      r.m.scale.setScalar(0.2 + k * 1.6);
      (r.m.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k);
      if (k >= 1) {
        r.m.removeFromParent();
        r.m.geometry.dispose();
        (r.m.material as THREE.Material).dispose();
        return false;
      }
      return true;
    });
  }

  /**
   * THROUGH THE BRANCHES.  How deep you are into a tree's boughs (0 at their
   * tips, 1 against the trunk) and how fast you are going decide the rustle:
   * brushing the tips is a soft shush now and then; pushing through the
   * middle of a low pine at a run is loud and quick, and it carries.
   */
  private brushLeaves(dt: number): void {
    let deep = 0;
    for (const t of this.treesNear(this.pos.x, this.pos.y)) {
      if (!t.leaf) continue;
      const d = Math.hypot(this.pos.x - t.x, this.pos.y - t.z) - PLAYER_R;
      if (d < t.leaf) deep = Math.max(deep, 1 - Math.max(0, d) / t.leaf);
    }
    this.rustleT -= dt;
    if (deep <= 0 || this.rustleT > 0) return;
    const pace = this.running ? 1.35 : this.crouched ? 0.55 : 1;
    this.rustleT = (0.5 - deep * 0.28) / pace;
    audio.sfx('leaf_rustle', Math.min(1, (0.25 + deep * 0.75) * pace));
    this.wind.uShake.value = Math.max(this.wind.uShake.value, (0.3 + deep * 0.7) * pace);
    this.counts.rustle++;
    this.noise((3 + deep * 13) * pace, this.pos.x, this.pos.y, true);
  }

  private thicketAt(x: number, z: number): Thicket | null {
    return this.thickets.find((b) => Math.hypot(x - b.x, z - b.z) < b.r * 0.9) ?? null;
  }

  /**
   * INTO A THICKET.  Pushing in is loud -- the whole bush thrashes, and it
   * carries.  Inside, every move rustles: a crouched creep barely, a walk
   * plainly, a run like an animal breaking cover.  Keep still and it is
   * silent.  Out again, one last shush.
   */
  private brushThickets(dt: number): void {
    const b = this.thicketAt(this.pos.x, this.pos.y);
    const pace = this.running ? 1.5 : this.crouched ? 0.45 : 1;
    if (b && b !== this.inThicket) {
      audio.sfx('bush_rustle', Math.min(1, 0.45 + 0.4 * pace));
      this.wind.uShake.value = 1.2;
      this.counts.rustle++;
      this.noise((7 + 9 * b.dense) * pace, this.pos.x, this.pos.y, true);
      this.thicketT = 0.5;
    } else if (b && this.moving) {
      this.thicketT -= dt;
      if (this.thicketT <= 0) {
        this.thicketT = this.running ? 0.28 : this.crouched ? 0.8 : 0.45;
        audio.sfx('bush_rustle', this.running ? 0.85 : this.crouched ? 0.2 : 0.45);
        this.wind.uShake.value = Math.max(this.wind.uShake.value, this.running ? 1 : this.crouched ? 0.25 : 0.55);
        this.counts.rustle++;
        const carry = this.running ? 15 : this.crouched ? 2.5 : 7;
        this.noise(carry * (0.6 + b.dense * 0.6), this.pos.x, this.pos.y, true);
      }
    } else if (!b && this.inThicket) {
      audio.sfx('bush_rustle', 0.3 * pace);
      this.wind.uShake.value = Math.max(this.wind.uShake.value, 0.5);
    }
    this.inThicket = b;
  }

  private pushOutOfTrees(p: THREE.Vector2, r: number): void {
    for (const t of [...this.treesNear(p.x, p.y), ...this.posts]) {
      const dx = p.x - t.x;
      const dz = p.y - t.z;
      const d = Math.hypot(dx, dz);
      const min = t.r + r;
      if (d < min && d > 0.0001) {
        p.x = t.x + (dx / d) * min;
        p.y = t.z + (dz / d) * min;
      }
    }
  }

  /** The bus stop's walls and bench: nothing walks through them. */
  private pushOutOfBoxes(p: THREE.Vector2, r: number): void {
    for (const b of this.boxes) {
      const cx = Phaser.Math.Clamp(p.x, b.x0, b.x1);
      const cz = Phaser.Math.Clamp(p.y, b.z0, b.z1);
      const dx = p.x - cx;
      const dz = p.y - cz;
      const d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d > 0.0001) {
        p.x = cx + (dx / d) * r;
        p.y = cz + (dz / d) * r;
      } else {
        // inside it: out by the nearest face
        const out = [
          [b.x0 - r - p.x, 0],
          [b.x1 + r - p.x, 0],
          [0, b.z0 - r - p.y],
          [0, b.z1 + r - p.y],
        ].sort((a, c) => Math.hypot(a[0], a[1]) - Math.hypot(c[0], c[1]))[0];
        p.x += out[0];
        p.y += out[1];
      }
    }
  }

  /** Each step is a sound, and some sounds carry a long way. */
  private footstep(wet: boolean): void {
    const run = this.running;
    // crouched, you put each foot down: a fraction of the sound, and it
    // carries a fraction of the way
    const soft = this.crouched ? 0.4 : 1;
    const { x, y: z } = this.pos;
    if (wet) {
      audio.sfx('wade', (run ? 0.8 : 0.5) * soft);
      this.counts.wade++;
      if (run) audio.sfx('splash', 0.35);
      if (Math.random() < 0.6) this.ripple();
      this.noise((run ? 20 : 11) * soft, x, z);
      return;
    }
    if (this.rubble.some((r) => Math.hypot(x - r.x, z - r.z) < r.r)) {
      audio.sfx('crumble', (run ? 0.6 : 0.4) * soft);
      this.noise((run ? 17 : 10) * soft, x, z);
      return;
    }
    const twig = this.twigs.find((t) => Math.hypot(x - t.x, z - t.z) < 0.7 && this.clock > t.t);
    if (twig) {
      twig.t = this.clock + 5;
      audio.sfx('twig_snap', (run ? 1 : 0.75) * (this.crouched ? 0.6 : 1));
      this.noise((run ? 18 : 13) * (this.crouched ? 0.55 : 1), x, z);
      return;
    }
    if (this.onRoad()) audio.sfx(run ? 'step_run' : 'footstep_concrete', (run ? 0.5 : 0.4) * soft);
    else audio.sfx('footstep_gravel', (run ? 0.45 : 0.3) * soft);
    // A walk on the hard road carries: he will hear it and come and look.
    this.noise(run ? (this.onRoad() ? 16 : 13) : this.crouched ? 1.8 : this.onRoad() ? 7.5 : 5.5, x, z);
    // and the crows, if you go running under them
    for (const c of this.crows) {
      if (this.crouched || c.flying > 0 || Math.hypot(x - c.x, z - c.z) > (run ? 8 : 3.5)) continue;
      this.startle(c);
    }
  }

  private land(): void {
    const wet = this.inWater(this.pos.x, this.pos.y);
    if (wet) {
      this.ripple();
      this.wasWet = true;
    }
    audio.sfx(wet ? 'splash' : 'footstep_gravel', wet ? 0.7 : 0.5);
    this.noise(wet ? 24 : 8, this.pos.x, this.pos.y, wet);
  }

  private startle(c: Crow): void {
    c.flying = 0.001;
    audio.sfx('wings', 0.8, this.placeOf(c.x, c.z));
    audio.sfx('crow_caw', 0.9, this.placeOf(c.x, c.z));
    this.noise(30, c.x, c.z);
  }

  /** Something made a sound at (x, z) that carries `r` metres. */
  private noise(r: number, x: number, z: number, exact = false): void {
    if (this.phase !== 'chase' || this.fMode === 'wait') return;
    const d = Math.hypot(this.froggy.x - x, this.froggy.y - z);
    if (d > r) return;
    // A SOUND IS A DIRECTION, NOT AN ADDRESS.  He learns roughly where it
    // came from -- the further off, the rougher -- and goes to look there.
    // It never tells him where you are now, and while he cannot see you it
    // does not keep him on you: he has to find you with his eyes.
    // (leaves thrashing and water splashing are easy to place: he comes
    // straight to them)
    const blur = exact ? Math.min(1.5, 0.3 + d * 0.05) : Math.min(6, 0.8 + d * 0.22);
    const a = Math.random() * Math.PI * 2;
    const rr = Math.random() * blur;
    this.lastKnown.set(x + Math.cos(a) * rr, z + Math.sin(a) * rr);
    if (this.fMode === 'hunt') return;
    this.searchT = 0;
    this.fMode = 'investigate';
    this.urgent = exact;
  }

  // ---------------------------------------------------------------- the story

  private say(text: string, secs: number, red = false): void {
    const from = Math.max(this.clock, this.lines.length ? this.lines[this.lines.length - 1].until : this.clock);
    this.lines.push({ text, from, until: from + secs, red });
  }

  private sayNow(text: string, secs: number, red = false): void {
    this.lines = [{ text, from: this.clock, until: this.clock + secs, red }];
  }

  private lookingAt(x: number, z: number, deg: number): boolean {
    const vx = x - this.pos.x;
    const vz = z - this.pos.y;
    const d = Math.hypot(vx, vz) || 1;
    const dot = (vx / d) * -Math.sin(this.yaw) + (vz / d) * -Math.cos(this.yaw);
    return dot > Math.cos(THREE.MathUtils.degToRad(deg));
  }

  /**
   * THE WALK, AND WHAT COMES UP BEHIND YOU.
   *
   *   walk    the pavement, the lights, the bus stop.  Something snaps in the
   *           trees behind you -- look if you like; there is nothing there.
   *   turn    a little further on your head is turned for you, smoothly,
   *           back down the road to the hotel.  Don't look back.
   *   creep   and while you face that way he comes up the road behind you,
   *           low, quiet, closing to an arm's length and keeping there
   *           however you walk.  A footstep or two you might hear.
   *   reveal  turn round, and he is right there -- unfolding up out of his
   *           crouch, the mouth coming open, looking at you.  You keep
   *           control the whole time.
   *   chase   then RUN.
   */
  private story(dt: number): void {
    if (this.phase === 'walk' && !this.heardSnap && this.pos.y < SOUND_Z) {
      this.heardSnap = true;
      audio.sfx('twig_snap', 0.9, this.placeOf(this.pos.x - 7, this.pos.y + 12));
      this.say('...?', 2.2);
    }
    if (this.phase === 'walk' && this.pos.y < TURN_Z) {
      // the nearest heading straight down the road to the hotel
      const to = this.yaw - Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
      this.autoTurn = { from: this.yaw, to, t: 0 };
      this.phase = 'turn';
      this.phaseT = 0;
      this.lines = [];
      this.say("Don't look back.", 2.4);
      this.say('Just get to the hotel.', 3.2);
    }
    if (this.autoTurn) {
      this.autoTurn.t = Math.min(1, this.autoTurn.t + dt / 1.6);
      const k = this.autoTurn.t;
      const e = k * k * (3 - 2 * k);
      this.yaw = this.autoTurn.from + (this.autoTurn.to - this.autoTurn.from) * e;
      if (k >= 1) this.autoTurn = null;
    }
    if (this.phase === 'turn' && !this.autoTurn) {
      this.phase = 'creep';
      this.phaseT = 0;
      this.hintT = 0;
      this.froggy.set(this.pos.x, this.pos.y + 9);
      this.fYaw = Math.PI;
      if (this.monster) this.monster.root.visible = true;
      this.fMode = 'wait';
    }
    if (this.phase === 'creep') {
      this.hintT += dt;
      if (this.phaseT > 5 && this.phaseT - dt <= 5) this.say('...footsteps?', 3);
      if (this.phaseT > 15 && this.phaseT - dt <= 15) audio.sfx('croak', 1.1, this.placeOf(this.froggy.x, this.froggy.y));
      const close = this.pos.distanceTo(this.froggy) < 7;
      if ((close && this.lookingAt(this.froggy.x, this.froggy.y, 38)) || this.pos.distanceTo(this.froggy) < 1.7) {
        this.phase = 'reveal';
        this.phaseT = 0;
        this.lines = [];
        this.shake = 0.6;
        audio.sfx('stinger', 0.95);
        audio.sfx('croak', 1.3, this.placeOf(this.froggy.x, this.froggy.y));
      }
    }
    if (this.phase === 'reveal') {
      if (this.phaseT > 1 && this.lines.length === 0) this.say('Froggy...?', 3);
      if (this.phaseT > 2.6) {
        this.phase = 'chase';
        this.phaseT = 0;
        this.fMode = 'wait';
        this.sayNow('RUN.', 1.8, true);
        this.say(CHASE_HOW, 6);
        audio.sfx('froggy_screech', 0.8, this.placeOf(this.froggy.x, this.froggy.y));
      }
    }
    if (this.phase === 'chase' && this.fMode === 'wait' && this.phaseT > 1.6) {
      this.fMode = 'hunt';
      this.lostT = 0;
      this.lastKnown.copy(this.pos);
      audio.sfx('croak', 1.3, this.placeOf(this.froggy.x, this.froggy.y));
    }
    while (this.lines.length && this.lines[0].until < this.clock) this.lines.shift();
  }

  // ------------------------------------------------------------------ Froggy

  /**
   * STAY PUT AND HE MAY COME BY.  Once you have been still for a while
   * and he is only looking for you (not on you), every few seconds there is a
   * small chance his search turns your way: he walks a line that passes a few
   * metres from where you are -- from the side he is already on, at a slow
   * searching walk, looking about -- and on past.  He comes from wherever he
   * is; nothing is put anywhere.  He still has to SEE you: in the open he
   * will; crouched under the boughs of a big pine, or behind its trunk, he
   * walks on by.
   */
  private maybePassBy(dt: number): void {
    this.stillT = this.moving ? 0 : this.stillT + dt;
    if (this.passBy && (this.fMode === 'hunt' || this.moving)) this.passBy = null;
    if (this.passBy || this.fMode === 'hunt' || this.fMode === 'wait' || this.fMode === 'investigate') return;
    if (this.stillT < 9) return;
    this.passT -= dt;
    if (this.passT > 0) return;
    this.passT = 4;
    if (Math.random() > 0.2) return;
    const far = this.froggy.distanceTo(this.pos);
    if (far > 70) return;
    // only where his search already is: near where he last had you, not
    // wherever you have got to since
    if (this.lastKnown.distanceTo(this.pos) > 25) return;
    // the line he walks: from his side of you, past you at 3.5 - 6 m, and on
    const dir = new THREE.Vector2(this.froggy.x - this.pos.x, this.froggy.y - this.pos.y).normalize();
    const perp = new THREE.Vector2(-dir.y, dir.x).multiplyScalar((Math.random() < 0.5 ? -1 : 1) * (3.5 + Math.random() * 2.5));
    const clampP = (v: THREE.Vector2) =>
      v.set(Phaser.Math.Clamp(v.x, -WORLD_X + 1, WORLD_X - 1), Phaser.Math.Clamp(v.y, HOTEL_Z + 6, BACK_Z - 1));
    const a = clampP(new THREE.Vector2(this.pos.x + perp.x + dir.x * 9, this.pos.y + perp.y + dir.y * 9));
    const b = clampP(new THREE.Vector2(this.pos.x + perp.x - dir.x * 12, this.pos.y + perp.y - dir.y * 12));
    this.passBy = { a, b, leg: 0 };
    this.fMode = 'patrol';
    this.passT = 15;
  }

  private underBoughs(): boolean {
    return this.skirts.some((k) => Math.hypot(this.pos.x - k.x, this.pos.y - k.z) < k.r);
  }

  /**
   * AWARENESS.  Seeing you is not a switch.  While you are in his sight his
   * awareness of you builds -- quickly close up, quickly if you move, more
   * quickly still dead ahead of him; slowly far off, crouched and still --
   * and once he has had a clear look, crouching where you stand does not
   * take you out of it: you have to get behind something, into a bush,
   * under the boughs, into the dark or away.  Lose him and he still has
   * you for a moment -- where you were a second ago, where you were going --
   * and the awareness drains away over a few seconds, not at once.
   *
   * Returns whether he has you now (the old `seen`).
   */
  private watchFor(dt: number, d: number): boolean {
    const had = this.fMode === 'hunt' || this.aware >= 0.6;
    const vis = this.sees(had);
    if (vis) {
      this.sinceSeen = 0;
      // dead ahead of him: within 25 degrees of where he is facing
      const ang = Math.atan2(this.pos.x - this.froggy.x, this.pos.y - this.froggy.y);
      let off = Math.abs(ang - this.fYaw) % (Math.PI * 2);
      if (off > Math.PI) off = Math.PI * 2 - off;
      const ahead = off < THREE.MathUtils.degToRad(25) ? 1.4 : 1;
      const motion = this.moving ? (this.running ? 2.2 : 1.5) : 0.7;
      const rate = (1.1 + 9 / Math.max(2, d)) * (this.crouched ? 0.55 : 1) * motion * ahead;
      this.aware = d < 3.5 ? 1.4 : Math.min(1.4, this.aware + rate * dt);
      this.lastKnown.copy(this.pos);
    } else {
      this.sinceSeen += dt;
      this.aware = Math.max(0, this.aware - dt * 0.3);
    }
    // half-seen: something there -- he goes to look, straight to where it was
    if (vis && this.aware >= 0.35 && this.aware < 1 && this.fMode !== 'hunt' && this.fMode !== 'investigate') {
      this.searchT = 0;
      this.fMode = 'investigate';
      this.urgent = this.aware > 0.6;
    }
    if (this.aware >= 1 && vis) return true;
    // just lost: he still has you for a beat
    return this.fMode === 'hunt' && this.sinceSeen < 0.8 && this.aware >= 0.6;
  }

  /** Can he see you from where he is? */
  private sees(asIfStanding = false): boolean {
    // Once he has a good look at you, ducking down where you stand does not
    // make you vanish: only real cover does (the boughs, a thicket, a trunk
    // between you, the dark, distance).
    const low = this.crouched && !asIfStanding;
    const dx = this.pos.x - this.froggy.x;
    const dz = this.pos.y - this.froggy.y;
    const d = Math.hypot(dx, dz);
    if (d < (low ? 2.5 : 3.5)) return true;
    // crouched in under a big pine's low boughs, you are a shape in the dark
    if (this.crouched && this.underBoughs()) return false;
    // In a thicket: down in a thick one, or in one taller than you, you are
    // gone; a thin one only blurs you.
    const bush = this.thicketAt(this.pos.x, this.pos.y);
    let cover = 1;
    if (bush) {
      const under = this.crouched || bush.h > 1.8;
      if (under && bush.dense > 0.55) return false;
      cover = under ? 0.3 : 0.65;
    }
    const lit = LAMP_ZS.some((z, i) => Math.hypot(this.pos.x - (i % 2 ? 1 : -1) * (RAIL_X - 1.2), this.pos.y - z) < 7.5);
    const range = (lit ? 36 : this.onRoad() ? 27 : this.pos.y < HOTEL_Z + 12 ? 30 : 13) * (low ? 0.6 : 1) * cover;
    if (d > range) return false;
    {
      // He sees what is in front of him: looking about, a cone of seventy
      // degrees either side; on your heels, wider -- but never behind him.
      const ang = Math.atan2(dx, dz);
      let diff = Math.abs(ang - this.fYaw) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > THREE.MathUtils.degToRad(this.fMode === 'hunt' ? 115 : 70)) return false;
    }
    return this.lineClear(this.froggy.x, this.froggy.y, this.pos.x, this.pos.y);
  }

  private lineClear(ax: number, az: number, bx: number, bz: number): boolean {
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(len / 3);
    const seen = new Set<Circle>();
    for (let s = 0; s <= steps; s++) {
      const k = s / Math.max(1, steps);
      for (const t of this.treesNear(ax + (bx - ax) * k, az + (bz - az) * k)) {
        if (seen.has(t)) continue;
        seen.add(t);
        // distance from the trunk to the line of sight
        const vx = bx - ax;
        const vz = bz - az;
        const u = Phaser.Math.Clamp(((t.x - ax) * vx + (t.z - az) * vz) / (len * len || 1), 0, 1);
        const px = ax + vx * u - t.x;
        const pz = az + vz * u - t.z;
        // a trunk hides you if you are close enough behind it for it to
        // matter -- the widest trunk in these woods does not hide a man at 30m
        if (u > 0.02 && u < 0.98 && Math.hypot(px, pz) < t.r + 0.32) return false;
      }
    }
    return true;
  }

  private moveFroggy(dt: number): void {
    if (!this.monster) return;
    const was = this.froggy.clone();
    let speed = 0;
    let target: THREE.Vector2 | null = null;
    const toYou = this.pos.distanceTo(this.froggy);
    // you are looking straight at him
    const watched = toYou < 40 && this.lookingAt(this.froggy.x, this.froggy.y, 28);

    if (this.phase === 'creep') {
      // Low and quiet up the road behind you: to an arm's length back from
      // where you are facing, and kept there however you walk.
      const back = new THREE.Vector2(this.pos.x + Math.sin(this.yaw) * 2.6, this.pos.y + Math.cos(this.yaw) * 2.6);
      target = back;
      speed = this.froggy.distanceTo(back) > 2.5 ? 4.4 : this.moving ? WALK * 1.05 : 1.2;
    }

    if (this.phase === 'chase') this.maybePassBy(dt);

    if (this.phase === 'chase' && this.fMode !== 'wait') {
      // Turn and look at him while he is looking for you, close enough, and
      // he sees you looking.
      // (only if he can see you too: in front of him, in range, not hidden)
      if ((this.fMode === 'search' || this.fMode === 'patrol' || this.fMode === 'investigate') && watched && toYou < (this.crouched ? 9 : 24) && this.sees()) {
        this.fMode = 'hunt';
        this.lostT = 0;
        this.aware = 1.2;
        this.lastKnown.copy(this.pos);
        audio.sfx('froggy_screech', 0.3, this.placeOf(this.froggy.x, this.froggy.y));
      }
      this.seen = this.watchFor(dt, toYou);
      if (this.seen) {
        if (this.fMode !== 'hunt') audio.sfx('froggy_screech', 0.25, this.placeOf(this.froggy.x, this.froggy.y));
        this.fMode = 'hunt';
        this.lostT = 0;
        this.lastKnown.copy(this.pos);
      }
      switch (this.fMode) {
        case 'hunt':
          if (!this.seen) this.lostT += dt;
          if (this.lostT > LOST_AFTER) {
            this.fMode = 'search';
            this.searchT = 0;
            this.wander.copy(this.lastKnown);
          }
          target = this.seen ? this.pos : this.lastKnown;
          // he comes on hard, and harder: a few seconds' start to run in
          speed = HUNT * Math.min(1, 0.72 + this.phaseT * 0.02);
          break;
        case 'investigate':
          target = this.lastKnown;
          speed = this.urgent ? INVESTIGATE * 1.25 : INVESTIGATE;
          if (this.froggy.distanceTo(this.lastKnown) < 1.2) {
            this.fMode = 'search';
            this.searchT = 0;
            this.wander.copy(this.lastKnown);
          }
          break;
        case 'search':
          this.searchT += dt;
          speed = SEARCH;
          if (this.froggy.distanceTo(this.wander) < 1.2) {
            const a = Math.random() * Math.PI * 2;
            const r = 3 + Math.random() * 9;
            this.wander.set(
              Phaser.Math.Clamp(this.lastKnown.x + Math.cos(a) * r, -WORLD_X + 1, WORLD_X - 1),
              Phaser.Math.Clamp(this.lastKnown.y + Math.sin(a) * r, HOTEL_Z + 6, BACK_Z - 1),
            );
          }
          target = this.wander;
          if (this.searchT > 12) {
            // He goes back to the road between you and the doors, and walks it.
            this.fMode = 'patrol';
            this.wander.set(0, Math.max(HOTEL_Z + 14, this.lastKnown.y - 12));
          }
          break;
        case 'patrol':
          speed = PATROL;
          target = this.wander;
          if (this.passBy) {
            // the walk past: slow, looking about, along a line a few metres off you
            speed = SEARCH;
            target = this.passBy.leg === 0 ? this.passBy.a : this.passBy.b;
            if (this.froggy.distanceTo(target) < 1.3) {
              if (this.passBy.leg === 0) this.passBy.leg = 1;
              else {
                this.passBy = null;
                this.wander.copy(this.froggy);
              }
            }
            break;
          }
          if (this.froggy.distanceTo(this.wander) < 1.5) {
            // up and down the road between where he last had you and the
            // hotel -- where he knows you are going -- not where you are
            this.wander.set((Math.random() - 0.5) * 6, Phaser.Math.Clamp(this.lastKnown.y - Math.random() * 30 + 6, HOTEL_Z + 10, BACK_Z - 2));
          }
          break;
      }
      // YOU RUN, HE RUNS.  Your feet set his pace: whatever he is doing, he
      // goes up into a run when you do -- just short of yours while he is
      // on you, so running still buys distance but never much.
      if (this.running && this.moving) speed = Math.max(speed, this.fMode === 'hunt' ? RUN * 0.98 : RUN * 0.85);
    }

    if (target && speed > 0) {
      let dx = target.x - this.froggy.x;
      let dz = target.y - this.froggy.y;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        dx /= d;
        dz /= d;
        const wet = this.fy === 0 && this.inWater(this.froggy.x, this.froggy.y);
        const s = Math.min(Math.max(0, d - (this.phase === 'creep' ? 0.05 : 0)), speed * (wet ? 0.7 : 1) * (this.fHop > 0 ? 0.5 : 1) * dt);
        const nx = this.froggy.x + dx * s;
        // the rails: he hops them, and the hop costs him
        if (
          this.fHop <= 0 &&
          this.railsAt(this.froggy.y) &&
          Math.sign(Math.abs(this.froggy.x) - RAIL_X) !== Math.sign(Math.abs(nx) - RAIL_X)
        ) {
          this.fHop = 0.6;
          audio.sfx('hop_wet', this.gainAt(this.froggy.x, this.froggy.y), this.placeOf(this.froggy.x, this.froggy.y));
        }
        this.froggy.x = nx;
        this.froggy.y += dz * s;
        this.pushOutOfTrees(this.froggy, FROG_R);
        this.pushOutOfBoxes(this.froggy, FROG_R);
        this.froggy.x = Phaser.Math.Clamp(this.froggy.x, -WORLD_X, WORLD_X);
        this.froggy.y = Phaser.Math.Clamp(this.froggy.y, HOTEL_Z + 2.5, BACK_Z + 20);
        // turn to where he is going, not snap
        const want = Math.atan2(dx, dz);
        let diff = want - this.fYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.fYaw += diff * Math.min(1, dt * 8);
        // (his steps are his footfalls: see onFootfall)
      }
    }
    // HE LOOKS BACK.  Still, or creeping, or caught in your eye while he goes
    // about the woods, his body comes round to face you -- not snapped, turned.
    // (and only if he can SEE you: hidden, you can stare at him all you like)
    const faceYou = this.phase === 'creep' || this.phase === 'reveal' || this.fMode === 'wait' || (watched && this.seen && this.fSpeed < 3.6);
    if (faceYou) {
      const want = Math.atan2(this.pos.x - this.froggy.x, this.pos.y - this.froggy.y);
      let diff = want - this.fYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.fYaw += diff * Math.min(1, dt * (this.phase === 'reveal' ? 6 : 3));
    }
    if (this.fHop > 0) {
      this.fHop = Math.max(0, this.fHop - dt);
      this.fy = Math.sin((1 - this.fHop / 0.6) * Math.PI) * 1.1;
    } else this.fy = 0;

    const moved = this.froggy.distanceTo(was);
    this.fSpeed = dt > 0 ? moved / dt : 0;
    this.monster.setPose(this.froggy.x, this.fy, this.froggy.y, this.fYaw);
    const hunting = this.phase === 'chase' && this.fMode === 'hunt';
    const creeping = this.phase === 'creep';
    const revealing = this.phase === 'reveal';
    // the reveal: up out of the crouch over a second, the mouth coming open
    const rise = revealing ? Math.min(1, this.phaseT / 1.1) : 0;
    const staring = revealing || (this.phase === 'chase' && this.fMode === 'wait');
    const cam = this.stage?.camera.position ?? null;
    // his eyes and his face are on you whenever he is after you, or you are
    // looking at him
    this.monster.lookAt(cam && (staring || creeping || ((hunting || watched) && this.seen)) ? cam : null);
    this.footDust?.update(dt);
    this.monster.update(dt, {
      speed: this.fSpeed,
      maw: hunting ? 1 : revealing ? 0.25 + rise * 0.55 : staring ? 0.15 : creeping ? 0.08 : 0.3,
      climb: 0,
      scan: (this.fMode === 'search' || this.fMode === 'patrol') && !watched ? Math.sin(this.clock * 1.3) * 0.8 : 0,
      lunge: hunting ? 1 : 0,
      constrict: hunting || staring || creeping ? 1 : 0,
      bare: hunting ? 0.8 : revealing ? rise * 0.6 : 0,
      still: staring && !revealing ? 1 : 0,
      crouch: creeping ? 0.75 : revealing ? 0.75 * (1 - rise) : 0,
      hunch: creeping || revealing ? 1 : 0,
      menace: revealing ? rise : this.phase === 'chase' && this.fMode === 'wait' ? 1 : 0,
      faceTo: cam && (staring || (watched && this.seen)) ? cam : null,
      faceK: 0.8,
      reachAt: hunting && this.pos.distanceTo(this.froggy) < 9 ? cam : null,
      viewer: cam,
    });
  }

  // ------------------------------------------------------------------- sound

  /** Where a sound at (x, z) is, to your ears: left/right and behind. */
  private placeOf(x: number, z: number): { pan: number; behind: number } {
    const vx = x - this.pos.x;
    const vz = z - this.pos.y;
    const d = Math.hypot(vx, vz) || 1;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    return {
      pan: Phaser.Math.Clamp(((vx * rx + vz * rz) / d) * 0.9, -1, 1),
      behind: Math.max(0, -((vx * fx + vz * fz) / d)),
    };
  }

  private gainAt(x: number, z: number): number {
    const d = Math.hypot(x - this.pos.x, z - this.pos.y);
    return Phaser.Math.Clamp(1 - d / 34, 0, 1) ** 1.4;
  }

  /** The breeze, your body in the leaves, the foam, the leaves coming down. */
  private stirFoliage(dt: number): void {
    const w = this.wind;
    w.uTime.value = this.clock;
    w.uPlayer.value.set(this.pos.x, this.pos.y, this.crouched ? 0.7 : 1, 0);
    w.uShake.value = Math.max(0, w.uShake.value - dt * 2.2);
    // a gust: comes up over a second or two, holds, and dies away
    this.gustT -= dt;
    if (this.gustT <= 0) {
      this.gustT = 10 + Math.random() * 12;
      this.gust = 1;
      audio.sfx('wind_gust', 0.35 + Math.random() * 0.2, { pan: (Math.random() - 0.5) * 1.2, behind: Math.random() * 0.5 });
    }
    this.gust = Math.max(0, this.gust - dt * 0.22);
    w.uGust.value = Math.sin(Math.min(1, this.gust) * Math.PI) * 1.3;
    this.foam.forEach((f, i) => (f.opacity = 0.45 + Math.sin(this.clock * (7 + i) + i * 2) * 0.2 + Math.sin(this.clock * 13.3 + i) * 0.1));
    if (this.fall && this.stage) {
      const c = this.stage.camera.position;
      const pos = this.fall.pts.geometry.getAttribute('position') as THREE.BufferAttribute;
      const a = pos.array as Float32Array;
      const v = this.fall.vel;
      const drift = 0.4 + w.uGust.value * 1.2;
      for (let i = 0; i < pos.count; i++) {
        const k = i * 3;
        a[k] += (Math.sin(this.clock * 2.1 + i) * 0.5 + drift) * dt;
        a[k + 1] -= v[i] * dt;
        a[k + 2] += Math.cos(this.clock * 1.7 + i * 1.3) * 0.4 * dt;
        // keep them in a box round you: what leaves one side comes in the other
        if (a[k + 1] < 0.02) a[k + 1] = 9 + Math.random() * 4;
        if (a[k] - c.x > 16) a[k] -= 32;
        if (a[k] - c.x < -16) a[k] += 32;
        if (a[k + 2] - c.z > 16) a[k + 2] -= 32;
        if (a[k + 2] - c.z < -16) a[k + 2] += 32;
      }
      pos.needsUpdate = true;
    }
  }

  private buildFallingLeaves(S: THREE.Scene, R: () => number): void {
    const N = 240;
    const a = new Float32Array(N * 3);
    const vel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      a[i * 3] = (R() - 0.5) * 32;
      a[i * 3 + 1] = R() * 12;
      a[i * 3 + 2] = BACK_Z - 10 + (R() - 0.5) * 32;
      vel[i] = 0.35 + R() * 0.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(a, 3));
    const tex = canvasTex(8, 8, (g) => {
      g.clearRect(0, 0, 8, 8);
      g.fillStyle = '#6a5a2a';
      g.beginPath();
      g.ellipse(4, 4, 3.5, 1.6, 0.6, 0, Math.PI * 2);
      g.fill();
    });
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, size: 0.14, alphaTest: 0.5, color: 0x8a8a6a }));
    pts.frustumCulled = false;
    pts.userData.particles = N;
    S.add(pts);
    this.fall = { pts, vel };
  }

  /**
   * Rapids: rocks across part of the river, with white water flickering
   * round them -- what you hear before you see.
   */
  private buildRapids(S: THREE.Scene, R: () => number): void {
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x3a3e44 });
    for (const x of [-(RAIL_X + 11), RAIL_X + 17]) {
      this.rapids.push({ x, z: RIVER_Z });
      for (let k = 0; k < 9; k++) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + R() * 0.45, 0), rockMat);
        rock.position.set(x + (R() - 0.5) * 5, 0.05, RIVER_Z + (R() - 0.5) * (RIVER_HALF * 1.6));
        rock.rotation.set(R() * 3, R() * 3, R() * 3);
        rock.scale.y = 0.55;
        S.add(rock);
        const foam = new THREE.MeshBasicMaterial({ color: 0xd8e4ee, transparent: true, opacity: 0.5, depthWrite: false });
        this.foam.push(foam);
        const f = new THREE.Mesh(new THREE.CircleGeometry(0.5 + R() * 0.5, 7), foam);
        f.rotation.x = -Math.PI / 2;
        f.scale.set(1.8, 0.7, 1);
        f.position.set(rock.position.x - 0.5, 0.02, rock.position.z);
        S.add(f);
      }
    }
  }

  /**
   * The woods' own sounds.  The river: a rush that swells as you come
   * nearer, from where it is; white water at the rapids; a plip now and then.
   * And branches creaking in the trees round you.
   */
  private woodsSound(dt: number): void {
    const toRiver = Math.max(0, Math.abs(this.pos.y - RIVER_Z) - RIVER_HALF);
    const rg = Math.max(0, 1 - toRiver / 42) ** 1.6;
    this.riverT -= dt;
    if (this.riverT <= 0) {
      this.riverT = 1.4;
      if (rg > 0.02) audio.sfx('river_flow', rg * 0.9, this.placeOf(this.pos.x, RIVER_Z));
    }
    this.rapidsT -= dt;
    if (this.rapidsT <= 0) {
      this.rapidsT = 0.9;
      for (const r of this.rapids) {
        const g = Math.max(0, 1 - Math.hypot(r.x - this.pos.x, r.z - this.pos.y) / 40) ** 1.5;
        if (g > 0.03) audio.sfx('river_rapids', g, this.placeOf(r.x, r.z));
      }
    }
    this.plipT -= dt;
    if (this.plipT <= 0) {
      this.plipT = 1.5 + Math.random() * 3.5;
      if (rg > 0.12) {
        const x = this.pos.x + (Math.random() - 0.5) * 24;
        audio.sfx(Math.random() < 0.7 ? 'water_plip' : 'splash', rg * (0.25 + Math.random() * 0.3), this.placeOf(x, RIVER_Z));
      }
    }
    this.creakT -= dt;
    if (this.creakT <= 0) {
      this.creakT = 5 + Math.random() * 9 - this.gust * 3;
      const near = this.treesNear(this.pos.x, this.pos.y).filter((t) => Math.hypot(t.x - this.pos.x, t.z - this.pos.y) < 18);
      if (near.length) {
        const t = near[Math.floor(Math.random() * near.length)];
        audio.sfx('branch_creak', 0.25 + this.gust * 0.3, this.placeOf(t.x, t.z));
      }
    }
  }

  private ambience(dt: number): void {
    this.woodsSound(dt);
    this.crowAmbientT -= dt;
    if (this.crowAmbientT <= 0) {
      this.crowAmbientT = 9 + Math.random() * 10;
      const c = this.crows[Math.floor(Math.random() * this.crows.length)];
      const pick: SfxName = Math.random() < 0.75 ? 'crow_caw' : 'twig_snap';
      audio.sfx(pick, 0.3, this.placeOf(c.x + 14, c.z));
    }
    for (const c of this.crows) {
      if (c.flying <= 0) continue;
      c.flying += dt;
      c.birds.forEach((b, i) => {
        b.position.y += dt * (3 + i);
        b.position.x += dt * (i - 1) * 2;
        b.position.z -= dt * 2.5;
        b.rotation.z = Math.sin(c.flying * 30 + i) * 0.5;
        if (c.flying > 4) b.visible = false;
      });
    }
  }

  // ------------------------------------------------------------------ camera

  private updateCamera(dt: number): void {
    const cam = this.stage!.camera;
    const amp = this.moving && this.y === 0 ? (this.running ? 0.07 : this.crouched ? 0.02 : 0.04) : 0;
    const bob = Math.sin(this.bobT * Math.PI * 2 * 1.6) * amp;
    this.shake = Math.max(0, this.shake - dt);
    const jolt = this.shake * 0.08;
    cam.position.set(
      this.pos.x + (Math.random() - 0.5) * jolt,
      this.eye + this.y + bob + (Math.random() - 0.5) * jolt,
      this.pos.y,
    );
    cam.rotation.set((Math.random() - 0.5) * jolt * 0.4, this.yaw, 0);
  }

  // ------------------------------------------------------------------ overlay

  private paintOverlay(): void {
    froggyLayer.paint((ctx) => {
      // The Three canvas is above Phaser's, so its camera fades cannot cover
      // the road: the black in and out is painted here instead.
      const black = this.phase === 'safe' ? Math.min(1, this.phaseT / 0.9) : Math.max(0, 1 - this.clock / 0.9);
      if (black > 0) {
        ctx.fillStyle = `rgba(0,0,0,${black})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        if (this.phase === 'safe') return;
      }
      if (this.inThicket) {
        // in the bush: leaves crowd the edges of what you can see
        const g = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, GAME_H * 0.25, GAME_W / 2, GAME_H / 2, GAME_W * 0.6);
        g.addColorStop(0, 'rgba(6,14,6,0)');
        g.addColorStop(1, `rgba(6,14,6,${0.55 + this.inThicket.dense * 0.3})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }
      if (this.phase === 'chase' && this.phaseT > 1.2) {
        drawPixelText(ctx, 'OBJECTIVE', 6, 6, { scale: 1, color: '#9a4848', alpha: 0.85 });
        drawPixelText(ctx, 'RUN and hide - reach the hotel', 6, 16, { scale: 1, color: '#ff4a4a', alpha: 0.95 });
        const left = Math.max(0, Math.round(this.pos.y - HOTEL_Z));
        drawPixelText(ctx, `HOTEL ${left}m`, 6, 26, { scale: 1, color: '#7a8494', alpha: 0.75 });
        // how close he is to having you: an eye's worth of bar, top right,
        // filling amber to red as he looks, draining as you get away
        if (this.aware > 0.02 && !(this.seen && this.fMode === 'hunt')) {
          const w = 54;
          const k = Math.min(1, this.aware);
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(GAME_W - 6 - w, 16, w, 4);
          ctx.fillStyle = k < 0.35 ? '#c8a050' : k < 1 ? '#e07030' : '#ff3a3a';
          ctx.fillRect(GAME_W - 6 - w, 16, Math.round(w * k), 4);
        }
        if (this.seen && this.fMode === 'hunt') {
          drawPixelText(ctx, 'HE SEES YOU', GAME_W - 6 - 11 * 6, 6, { scale: 1, color: '#ff4a4a', alpha: 0.6 + Math.sin(this.clock * 9) * 0.3 });
        } else if (this.fMode === 'search' || this.fMode === 'investigate' || this.fMode === 'patrol') {
          drawPixelText(ctx, 'HE IS LOOKING', GAME_W - 6 - 13 * 6, 6, { scale: 1, color: '#c8a050', alpha: 0.7 });
        }
      }
      const line = this.lines[0];
      if (line && line.text && this.clock >= line.from) {
        const over = touchControls.overBottom();
        const room = GAME_W - 24 - over.left - over.right;
        const cx = GAME_W / 2 + (over.left - over.right) / 2;
        if (line.red) {
          drawPixelText(ctx, line.text, cx, GAME_H * 0.4, { scale: 2, color: '#ff4a4a', center: true });
        } else {
          // too long for one line: wrapped onto as many as it needs, at full size
          const per = Math.max(10, Math.floor(room / 6));
          const rows: string[] = [];
          for (const word of line.text.split(' ')) {
            const last = rows[rows.length - 1];
            if (last !== undefined && (last + ' ' + word).length <= per) rows[rows.length - 1] = last + ' ' + word;
            else rows.push(word);
          }
          rows.forEach((r, i) => {
            const y = GAME_H - 30 - (rows.length - 1 - i) * 9;
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(cx - (r.length * 6) / 2 - 2, y - 2, r.length * 6 + 3, 11);
            drawPixelText(ctx, r, cx, y, { scale: 1, color: '#e8e2cd', center: true });
          });
        }
      }
      if (this.crouched && this.phase !== 'safe') {
        drawPixelText(ctx, 'CROUCHED', GAME_W / 2, GAME_H - 12, { scale: 1, color: '#7a8494', center: true, alpha: 0.7 });
      }
      if (this.phase === 'creep' && this.hintT > 10) {
        drawPixelText(ctx, isTouch() ? 'DRAG THE PICTURE TO LOOK BEHIND YOU' : 'HOLD LEFT CLICK TO LOOK BEHIND YOU', GAME_W / 2, 14, {
          scale: 1,
          color: '#7a8494',
          center: true,
          alpha: 0.8,
        });
      }
      // what to press, only when it is the thing to do (under the objective,
      // clear of the subtitles at the bottom)
      if (this.phase === 'chase') {
        const touch = isTouch();
        let hint = '';
        if (this.phaseT > 1.2 && this.phaseT < 5.5 && !this.overRail) hint = touch ? 'HOLD RUN TO RUN' : 'HOLD SHIFT TO RUN';
        if (this.railHint > 0) hint = touch ? 'TAP JUMP TO JUMP OVER THE RAIL' : 'PRESS SPACE TO JUMP OVER THE RAIL';
        if (this.hideHintT > 0) hint = touch ? 'HIDE BEHIND TREES AND BUSHES - TAP CROUCH' : 'HIDE BEHIND TREES AND BUSHES - C TO CROUCH';
        if (hint) {
          const a = this.hideHintT > 0 ? Math.min(1, this.hideHintT, 7 - this.hideHintT + 0.2) : 1;
          const y = 44;
          ctx.fillStyle = `rgba(0,0,0,${0.55 * a})`;
          ctx.fillRect(GAME_W / 2 - (hint.length * 6) / 2 - 4, y - 3, hint.length * 6 + 7, 13);
          drawPixelText(ctx, hint, GAME_W / 2, y, { scale: 1, color: '#f0d890', center: true, alpha: a });
        }
      }
    });
  }

  // ------------------------------------------------------------------ endings

  private caught(): void {
    if (this.phase === 'caught') return;
    this.phase = 'caught';
    this.publish('caught');
    this.scare = this.stage && this.monster ? playJumpscare3D(this, this.stage, this.monster) : null;
    if (!this.scare) playJumpscare(this);
    this.time.delayedCall(SCARE_MS + 600, () => {
      froggyLayer.clear();
      this.scene.start('DeathScreen', { key: 'NightRoad3D', data: { retry: true } });
    });
  }

  private reachSafety(): void {
    this.phase = 'safe';
    this.phaseT = 0;
    this.fMode = 'wait';
    this.publish('safe');
    audio.sfx('door_open', 0.8);
    this.lines = [];
    this.time.delayedCall(1000, () => {
      audio.sfx('door_shut', 0.8);
      froggyLayer.clear();
      this.teardown();
      this.scene.start('Hotel', { area: 'lobby' });
    });
  }

  // -------------------------------------------------------------------- misc

  private publish(outcome?: string): void {
    if (!import.meta.env?.DEV) return;
    const w = window as unknown as Record<string, Record<string, unknown>>;
    const t = w.__night ?? {};
    Object.assign(t, {
      phase: this.phase,
      mode: this.fMode,
      px: this.pos.x,
      pz: this.pos.y,
      py: this.y,
      fx: this.froggy.x,
      fz: this.froggy.y,
      dist: this.pos.distanceTo(this.froggy),
      sees: this.seen,
      aware: this.aware,
      line: this.lines[0]?.text ?? '',
      yaw: this.yaw,
      clock: this.clock,
      crouched: this.crouched,
      counts: { ...this.counts, ripples: this.ripples.length },
      eye: this.eye,
      fyaw: this.fYaw,
    });
    if (outcome) t.outcome = outcome;
    w.__night = t;
  }

  /** Test hooks: put the player (or him) somewhere, and turn the head. */
  private bridge(): void {
    const w = window as unknown as Record<string, Record<string, unknown>>;
    w.__night = {
      warp: (x: number, z: number) => this.pos.set(x, z),
      face: (yaw: number) => {
        this.yaw = yaw;
      },
      put: (x: number, z: number) => this.froggy.set(x, z),
      sees: () => this.sees(),
      clear: (ax: number, az: number, bx: number, bz: number) => this.lineClear(ax, az, bx, bz),
      noise: (r: number, x: number, z: number) => this.noise(r, x, z),
      crouch: () => {
        this.crouched = !this.crouched;
      },
      blocks: (x: number, z: number) => this.railBlocks(x, z),
      skirts: () => this.skirts.map((k) => [k.x, k.z]),
      leafy: () => this.trees.filter((t) => (t.leaf ?? 0) > 1).slice(0, 40).map((t) => [t.x, t.z, t.leaf]),
      under: () => this.underBoughs(),
      thickets: () => this.thickets.map((b) => ({ ...b })),
      inBush: () => !!this.inThicket,
      passBy: () => (this.passBy ? { leg: this.passBy.leg, a: [this.passBy.a.x, this.passBy.a.y], b: [this.passBy.b.x, this.passBy.b.y] } : null),
      setMode: (m: FrogMode) => {
        this.fMode = m;
      },
    };
  }

  private teardown(): void {
    this.stage?.dispose();
    this.stage = null;
    this.monster = null;
    if (this.onLookDown) window.removeEventListener('mousedown', this.onLookDown);
    if (this.onLookMove) window.removeEventListener('mousemove', this.onLookMove);
    if (this.onLookUp) {
      window.removeEventListener('mouseup', this.onLookUp);
      window.removeEventListener('blur', this.onLookUp);
    }
    this.onLookDown = this.onLookMove = null;
    this.onLookUp = null;
    this.dragging = false;
    if (document.pointerLockElement) document.exitPointerLock?.();
  }
}
