/**
 * The night road.  Midnight, the arcade shut behind you, and the hotel at the
 * far end of a long straight road through the woods.
 *
 * It is a walk first: the hotel's windows small and warm a long way off, the
 * streetlights, the guard rails, the trees.  A fifth of the way along,
 * something croaks behind you.  If you turn round he is there, under the last
 * light, doing nothing but looking.  No scare.  Then the objective, in red,
 * and the run.
 *
 * The tuning is the design:
 *   walk 2.9 m/s, run 4.35, and he hunts at 4.6 -- faster than you, so the
 *     road alone does not save you unless you never stop
 *   he SEES you: a cone in front of him, longer under a lamp or on the open
 *     road, short in the dark under the trees, and the trunks block it
 *   he HEARS you: running, a branch snapping, water, gravel, the crows you put
 *     up out of the trees -- each has its own reach
 *   three seconds without sight of you and he stops chasing and starts looking
 *   the guard rails are a jump for you and a hop for him, and the hop costs
 *     him; the ponds and the river are slow and loud for both
 *   the hotel's doors are safe.  Nothing follows you through them.
 */

import { isPaused } from '../core/pause';
import Phaser from 'phaser';
import * as THREE from 'three';
import { audio, SILENCE, type SfxName } from '../core/audio';
import { isTouch } from '../core/device';
import { froggyLayer } from '../render/froggyLayer';
import { drawPixelText } from '../render/pixelFont';
import { playJumpscare, SCARE_MS } from '../froggy/jumpscare';
import { playJumpscare3D, type Scare3D } from '../froggy/jumpscare3d';
import { FroggyMonster } from '../three/froggyMonster';
import { ThreeStage } from '../render/threeStage';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { touchControls } from '../ui/touchControls';

// ------------------------------------------------------------------- the map
//
// The road runs from the arcade's street (z = 0) down -Z to the hotel.

const ROAD_LEN = 180;
const HOTEL_Z = -ROAD_LEN;
/** The doors.  Past this line, between the door posts, you are inside. */
const SAFE_Z = HOTEL_Z + 0.6;
const SAFE_HALF = 2.6;
const ROAD_HALF = 4;
/** The guard rails, either side of the road, all the way to the hotel's forecourt. */
const RAIL_X = 4.7;
const RAIL_H = 0.72;
const RAIL_Z0 = 6;
const RAIL_Z1 = HOTEL_Z + 9;
/** How far the woods go before they are too thick to walk. */
const WORLD_X = 44;
const START_Z = 4;
const BACK_Z = 9;
/** Where the croak comes from: a fifth of the way along. */
const REVEAL_Z = -ROAD_LEN * 0.2;
const RIVER_Z = -112;
const RIVER_HALF = 3.4;
const LAMP_ZS = [4, -20, -46, -74, -104, -132, -158];

const EYE = 1.6;
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
/** How long he stands and stares before he comes, once you have seen him. */
const STARE_HOLD = 1.3;

type Phase = 'walk' | 'croak' | 'stare' | 'chase' | 'safe' | 'caught';
type FrogMode = 'wait' | 'hunt' | 'investigate' | 'search' | 'patrol';

interface Crow {
  x: number;
  z: number;
  birds: THREE.Object3D[];
  /** Seconds since they went up; 0 while they sit. */
  flying: number;
}

interface Circle {
  x: number;
  z: number;
  r: number;
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

export class NightRoad3D extends Phaser.Scene {
  private stage: ThreeStage | null = null;
  private monster: FroggyMonster | null = null;
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

  private froggy = new THREE.Vector2();
  private fy = 0;
  private fYaw = 0;
  private fMode: FrogMode = 'wait';
  private fHop = 0;
  private fStepT = 0;
  private fSpeed = 0;
  private lostT = 0;
  private searchT = 0;
  private wander = new THREE.Vector2();
  private lastKnown = new THREE.Vector2();
  private seen = false;

  private phase: Phase = 'walk';
  private phaseT = 0;
  private stareT = 0;
  private retry = false;
  private clock = 0;

  private trees: Circle[] = [];
  private treeGrid = new Map<string, number[]>();
  private ponds: Circle[] = [];
  private rubble: Circle[] = [];
  private twigs: { x: number; z: number; t: number }[] = [];
  private crows: Crow[] = [];
  private crowAmbientT = 6;

  private lines: { text: string; from: number; until: number; red?: boolean }[] = [];
  private hintT = 0;

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
    this.stareT = 0;
    this.clock = 0;
    this.fMode = 'wait';
    this.scare = null;
    this.lines = [];
    this.y = this.vy = 0;
    this.trees = [];
    this.treeGrid.clear();
    this.ponds = [];
    this.rubble = [];
    this.twigs = [];
    this.crows = [];

    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000).setOrigin(0, 0);
    this.cameras.main.fadeIn(800, 0, 0, 0);

    const root = document.getElementById('game-root');
    if (!root) return;
    this.stage = new ThreeStage();
    this.stage.mount(root, this.game.canvas);
    this.build();

    // A retry puts you back a few steps short of where he was first heard.
    this.pos.set(0.6, this.retry ? REVEAL_Z + 5 : START_Z);
    this.yaw = 0;
    this.froggy.set(0, 40);
    if (this.monster) this.monster.root.visible = false;

    if (this.retry) {
      this.say('Again.  Keep going.', 2.4);
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
    }

    // Look exactly as the chase does: pointer lock if the browser gives it, a
    // held left-drag if not, which is what the on-screen look pad sends.
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.event instanceof MouseEvent && document.pointerLockElement) this.yaw -= p.event.movementX * 0.0027;
    });
    this.onLookDown = (e: MouseEvent) => {
      if (e.button === 0 && !isPaused()) this.dragging = true;
    };
    this.onLookMove = (e: MouseEvent) => {
      if (!this.dragging || document.pointerLockElement || isPaused()) return;
      this.yaw -= (e.movementX || 0) * ((e as MouseEvent & { lookSens?: number }).lookSens ?? 0.0042);
    };
    this.onLookUp = () => {
      this.dragging = false;
    };
    window.addEventListener('mousedown', this.onLookDown);
    window.addEventListener('mousemove', this.onLookMove);
    window.addEventListener('mouseup', this.onLookUp);
    window.addEventListener('blur', this.onLookUp);
    this.game.canvas.addEventListener('click', () => {
      void this.game.canvas.requestPointerLock?.();
    });

    this.stage.start((dt) => this.tick(dt));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
    if (import.meta.env?.DEV) this.bridge();
  }

  // ===================================================================== world

  private build(): void {
    const st = this.stage!;
    const S = st.scene;
    const R = rng(0x6c11);
    st.camera.far = 420;
    st.camera.updateProjectionMatrix();
    S.background = new THREE.Color(0x060a14);
    S.fog = new THREE.FogExp2(0x070b14, 0.034);

    S.add(new THREE.HemisphereLight(0x3a4a6e, 0x0b0d0c, 0.9));
    const moon = new THREE.DirectionalLight(0x9fb4e0, 0.55);
    moon.position.set(-40, 60, -30);
    S.add(moon);
    // enough spill round your feet that the ground under you exists
    const fill = new THREE.PointLight(0xb8c8e8, 3.5, 7, 1.6);
    st.camera.add(fill);
    S.add(st.camera);

    // ---- the sky: a moon and stars, out past the fog
    const moonDisc = new THREE.Mesh(
      new THREE.CircleGeometry(9, 24),
      new THREE.MeshBasicMaterial({ color: 0xe8ecd8, fog: false }),
    );
    moonDisc.position.set(-120, 120, -300);
    moonDisc.lookAt(0, 0, 0);
    S.add(moonDisc);
    const starPos: number[] = [];
    for (let i = 0; i < 420; i++) {
      const a = R() * Math.PI * 2;
      const e = 0.12 + R() * 1.3;
      starPos.push(Math.cos(a) * Math.cos(e) * 380, Math.sin(e) * 380, Math.sin(a) * Math.cos(e) * 380);
    }
    const stars = new THREE.BufferGeometry();
    stars.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    S.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xc8d0e8, size: 1.4, sizeAttenuation: false, fog: false })));

    // ---- the ground, the road and its paint
    const groundTex = canvasTex(64, 64, (g) => {
      g.fillStyle = '#1b2116';
      g.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = ['#232a1b', '#151a12', '#2a2a1c', '#1e2418'][i % 4];
        g.fillRect(Math.floor(R() * 64), Math.floor(R() * 64), 2, 1);
      }
    });
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(40, 70);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 380), new THREE.MeshLambertMaterial({ map: groundTex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -90;
    S.add(ground);

    const roadTex = canvasTex(32, 64, (g) => {
      g.fillStyle = '#2b2d30';
      g.fillRect(0, 0, 32, 64);
      for (let i = 0; i < 120; i++) {
        g.fillStyle = i % 2 ? '#323438' : '#25272a';
        g.fillRect(Math.floor(R() * 32), Math.floor(R() * 64), 1, 1);
      }
      g.fillStyle = '#b8a85a';
      g.fillRect(15, 6, 2, 26);
      g.fillStyle = '#8c8e88';
      g.fillRect(1, 0, 1, 64);
      g.fillRect(30, 0, 1, 64);
    });
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
    roadTex.repeat.set(1, (ROAD_LEN + 12) / 8);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF * 2, ROAD_LEN + 12),
      new THREE.MeshLambertMaterial({ map: roadTex }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, -(ROAD_LEN + 12) / 2 + 9);
    S.add(road);

    this.buildRails(S);
    this.buildWater(S, R);
    this.buildTrees(S, R);
    this.buildLitter(S, R);
    this.buildLamps(S);
    this.buildHotel(S, R);

    this.monster = new FroggyMonster(FROGGY_SCALE);
    S.add(this.monster.root);
  }

  /** Steel guard rails on posts, both sides of the road, the bridge included. */
  private buildRails(S: THREE.Scene): void {
    const steel = new THREE.MeshLambertMaterial({ color: 0x8a9096 });
    const len = RAIL_Z0 - RAIL_Z1;
    const mid = (RAIL_Z0 + RAIL_Z1) / 2;
    const postGeo = new THREE.BoxGeometry(0.12, RAIL_H, 0.12);
    const n = Math.floor(len / 3) + 1;
    const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshLambertMaterial({ color: 0x4c5056 }), n * 2);
    const m = new THREE.Matrix4();
    let i = 0;
    for (const side of [-1, 1]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, len), steel);
      beam.position.set(side * RAIL_X, RAIL_H - 0.18, mid);
      S.add(beam);
      for (let k = 0; k < n; k++) {
        m.makeTranslation(side * (RAIL_X + 0.1), RAIL_H / 2, RAIL_Z0 - k * 3);
        posts.setMatrixAt(i++, m);
      }
    }
    S.add(posts);
  }

  /** Ponds in the woods both sides, and the river under the road's bridge. */
  private buildWater(S: THREE.Scene, R: () => number): void {
    const water = new THREE.MeshLambertMaterial({ color: 0x0e2230, emissive: 0x050c14 });
    const sheen = new THREE.MeshBasicMaterial({ color: 0x6e86a8, transparent: true, opacity: 0.18 });
    const spots: [number, number, number][] = [
      [-16, -14, 4.2],
      [19, -58, 5.5],
      [-24, -78, 6],
      [14, -146, 4.6],
      [-12, -160, 3.8],
      [28, -24, 3.6],
    ];
    for (const [x, z, r] of spots) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(r, 20), water);
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, 0.02, z);
      S.add(p);
      const glint = new THREE.Mesh(new THREE.CircleGeometry(r * 0.5, 12), sheen);
      glint.rotation.x = -Math.PI / 2;
      glint.position.set(x - r * 0.2, 0.03, z + r * 0.15);
      S.add(glint);
      this.ponds.push({ x, z, r });
    }
    for (const side of [-1, 1]) {
      const w = WORLD_X + 8 - RAIL_X;
      const river = new THREE.Mesh(new THREE.PlaneGeometry(w, RIVER_HALF * 2), water);
      river.rotation.x = -Math.PI / 2;
      river.position.set(side * (RAIL_X + w / 2), 0.02, RIVER_Z);
      S.add(river);
      // the banks: a lip of mud either side
      for (const edge of [-1, 1]) {
        const bank = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x2a2418 }));
        bank.position.set(side * (RAIL_X + w / 2), 0.04, RIVER_Z + edge * RIVER_HALF);
        S.add(bank);
      }
    }
    // The bridge: the road on a concrete deck, with its side walls down to the water.
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(RAIL_X * 2 + 0.4, 0.5, RIVER_HALF * 2 + 1.4),
      new THREE.MeshLambertMaterial({ color: 0x4a4c50 }),
    );
    deck.position.set(0, -0.24, RIVER_Z);
    S.add(deck);
    void R;
  }

  /** Pines, a few dead ones by the road, and the trunks are what you hide behind. */
  private buildTrees(S: THREE.Scene, R: () => number): void {
    const spots: Circle[] = [];
    const clear = (x: number, z: number): boolean => {
      if (Math.abs(x) < RAIL_X + 1.6) return false;
      if (Math.abs(z - RIVER_Z) < RIVER_HALF + 1.2) return false;
      if (z < HOTEL_Z + 12 && Math.abs(x) < 20) return false;
      for (const p of this.ponds) if (Math.hypot(x - p.x, z - p.z) < p.r + 1.4) return false;
      // a lamp's arm reaches over the rail
      return true;
    };
    for (let k = 0; k < 900 && spots.length < 470; k++) {
      const x = (R() < 0.5 ? -1 : 1) * (RAIL_X + 1.6 + R() * (WORLD_X - RAIL_X));
      const z = HOTEL_Z - 6 + R() * (BACK_Z + 2 - HOTEL_Z + 6);
      if (!clear(x, z)) continue;
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
    // Behind the start the road is shut by the dark: trees across it.
    for (let k = 0; k < 24; k++) spots.push({ x: -20 + R() * 40, z: BACK_Z + 2 + R() * 6, r: 0.3 });

    const trunkGeo = new THREE.CylinderGeometry(0.7, 1, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    const coneGeo = new THREE.ConeGeometry(1, 1, 7);
    coneGeo.translate(0, 0.5, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x2e241a }), spots.length);
    const cones = new THREE.InstancedMesh(coneGeo, new THREE.MeshLambertMaterial({ color: 0x15261a }), spots.length * 3);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    let c = 0;
    spots.forEach((t, i) => {
      const h = 7 + R() * 7;
      const dead = Math.abs(t.x) < RAIL_X + 5 && R() < 0.25;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28);
      m.compose(p.set(t.x, 0, t.z), q, sc.set(t.r, dead ? h * 0.7 : h * 0.45, t.r));
      trunks.setMatrixAt(i, m);
      for (let k = 0; k < 3; k++) {
        const w = (dead ? 0 : 1) * (2.6 - k * 0.65) * (0.8 + R() * 0.3);
        m.compose(p.set(t.x, h * (0.28 + k * 0.2), t.z), q, sc.set(w || 0.001, h * 0.42, w || 0.001));
        cones.setMatrixAt(c++, m);
      }
      if (Math.abs(t.x) <= WORLD_X + 0.5) this.addTree(t);
    });
    trunks.count = spots.length;
    cones.count = c;
    S.add(trunks, cones);
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
      [-6.4, -30, 2.4],
      [6.6, -62, 2.6],
      [-7, -96, 2.2],
      [6.2, -124, 2.4],
      [-6.8, -150, 2.6],
      [-11, -40, 2],
      [12, -88, 2.2],
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
  private buildLamps(S: THREE.Scene): void {
    const pole = new THREE.MeshLambertMaterial({ color: 0x3a3e44 });
    const bulb = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    const pool = new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.09, depthWrite: false });
    LAMP_ZS.forEach((z, i) => {
      const side = i % 2 ? 1 : -1;
      const x = side * (RAIL_X + 0.7);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 6, 6), pole);
      post.position.set(x, 3, z);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.08), pole);
      arm.position.set(x - side * 1, 5.9, z);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.3), bulb);
      head.position.set(x - side * 1.9, 5.82, z);
      S.add(post, arm, head);
      const light = new THREE.PointLight(0xffc98a, 46, 18, 1.3);
      light.position.set(x - side * 1.9, 5.5, z);
      S.add(light);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(5.5, 20), pool);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(x - side * 1.9, 0.03, z);
      S.add(disc);
    });
  }

  /**
   * The hotel: a dark block with its windows lit, its name in neon over a
   * warm doorway, and none of it fogged -- it is the one thing on this road
   * you can always see, a long way off.
   */
  private buildHotel(S: THREE.Scene, R: () => number): void {
    const W = 30;
    const H = 22;
    const D = 14;
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), new THREE.MeshLambertMaterial({ color: 0x1a1c22 }));
    body.position.set(0, H / 2, HOTEL_Z - 2 - D / 2);
    S.add(body);
    const facade = canvasTex(120, 88, (g) => {
      g.fillStyle = '#16181e';
      g.fillRect(0, 0, 120, 88);
      for (let row = 0; row < 7; row++)
        for (let col = 0; col < 12; col++) {
          const lit = R() < 0.42;
          g.fillStyle = lit ? (R() < 0.2 ? '#ffe9b0' : '#e8b860') : '#22262e';
          g.fillRect(4 + col * 9.6, 4 + row * 10.4, 5, 6);
        }
      g.fillStyle = '#16181e';
      g.fillRect(44, 74, 32, 14);
    });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: facade, fog: false }));
    front.position.set(0, H / 2, HOTEL_Z - 1.98);
    S.add(front);
    const sign = canvasTex(128, 20, (g) => {
      g.fillStyle = '#100a14';
      g.fillRect(0, 0, 128, 20);
      g.font = 'bold 13px monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#ff7ab8';
      g.fillText('GRAND LILY HOTEL', 64, 10);
    });
    const signM = new THREE.Mesh(new THREE.PlaneGeometry(13, 2), new THREE.MeshBasicMaterial({ map: sign, fog: false }));
    signM.position.set(0, 5.4, HOTEL_Z - 1.9);
    S.add(signM);
    const doorTex = canvasTex(32, 32, (g) => {
      g.fillStyle = '#ffcf86';
      g.fillRect(0, 0, 32, 32);
      g.fillStyle = '#c99348';
      g.fillRect(15, 0, 2, 32);
      g.fillRect(0, 0, 32, 2);
      g.fillStyle = '#fff1d0';
      g.fillRect(4, 6, 8, 20);
      g.fillRect(20, 6, 8, 20);
    });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(SAFE_HALF * 2, 3.2), new THREE.MeshBasicMaterial({ map: doorTex, fog: false }));
    door.position.set(0, 1.6, HOTEL_Z - 1.95);
    S.add(door);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 3.4), new THREE.MeshLambertMaterial({ color: 0x5a1e34 }));
    canopy.position.set(0, 3.7, HOTEL_Z - 0.4);
    S.add(canopy);
    const warm = new THREE.PointLight(0xffc27a, 60, 16, 1.2);
    warm.position.set(0, 3.2, HOTEL_Z + 1);
    S.add(warm);
    // the forecourt: flagstones out to where the rails end
    const court = new THREE.Mesh(new THREE.PlaneGeometry(26, 12), new THREE.MeshLambertMaterial({ color: 0x3a3a3c }));
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
    this.movePlayer(dt);
    this.story(dt);
    this.moveFroggy(dt);
    this.ambience(dt);
    this.updateCamera(dt);
    this.paintOverlay();
    this.publish();

    if (this.phase === 'chase' && this.pos.distanceTo(this.froggy) < CATCH && this.y < 0.9) this.caught();
    if (this.phase !== 'safe' && this.pos.y < SAFE_Z && Math.abs(this.pos.x) < SAFE_HALF) this.reachSafety();
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

  private movePlayer(dt: number): void {
    const fwd = (this.held('up') ? 1 : 0) - (this.held('down') ? 1 : 0);
    const strafe = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const turn = (this.held('turnR') ? 1 : 0) - (this.held('turnL') ? 1 : 0);
    this.yaw -= turn * 2.4 * dt;
    if (this.phase === 'safe') return;

    // the jump: over a rail, a log, out of the water
    const grounded = this.y <= 0;
    if (grounded && this.jumpKeys.some((k) => Phaser.Input.Keyboard.JustDown(k))) {
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
    this.running = this.phase === 'chase' && this.held('run');
    this.moving = fwd !== 0 || strafe !== 0;
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
    const speed = (this.running ? RUN : WALK) * (wet ? 0.55 : 1);
    dx *= speed * dt;
    dz *= speed * dt;

    const nx = this.pos.x + dx;
    const nz = this.pos.y + dz;
    // the rails: a jump clears them, a walk does not
    const crosses = (a: number, b: number) =>
      this.railsAt(this.pos.y) && this.y < RAIL_H - 0.08 && Math.sign(Math.abs(a) - RAIL_X) !== Math.sign(Math.abs(b) - RAIL_X);
    if (!crosses(this.pos.x, nx) && Math.abs(nx) < WORLD_X) this.pos.x = nx;
    if (nz < BACK_Z && nz > HOTEL_Z - 1.4 && !(nz < HOTEL_Z + 0.3 && Math.abs(this.pos.x) > SAFE_HALF + 0.2)) this.pos.y = nz;
    // (and the rails stop where the forecourt starts: entering it off the
    // verge, you stay on your side of the post)
    if (this.railsAt(this.pos.y) && this.y < RAIL_H - 0.08) {
      const inside = Math.abs(this.pos.x - dx) < RAIL_X;
      if (inside && Math.abs(this.pos.x) > RAIL_X - PLAYER_R) this.pos.x = Math.sign(this.pos.x) * (RAIL_X - PLAYER_R);
      if (!inside && Math.abs(this.pos.x) < RAIL_X + PLAYER_R) this.pos.x = Math.sign(this.pos.x) * (RAIL_X + PLAYER_R);
    }
    this.pushOutOfTrees(this.pos, PLAYER_R);

    this.bobT += dt * (this.running ? 1.5 : 1);
    this.stepT += dt;
    if (this.y === 0 && this.stepT > (this.running ? 0.28 : 0.42)) {
      this.stepT = 0;
      this.footstep(wet);
    }
  }

  private pushOutOfTrees(p: THREE.Vector2, r: number): void {
    for (const t of this.treesNear(p.x, p.y)) {
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

  /** Each step is a sound, and some sounds carry a long way. */
  private footstep(wet: boolean): void {
    const run = this.running;
    const { x, y: z } = this.pos;
    if (wet) {
      audio.sfx('splash', run ? 0.55 : 0.32);
      this.noise(run ? 20 : 11, x, z);
      return;
    }
    if (this.rubble.some((r) => Math.hypot(x - r.x, z - r.z) < r.r)) {
      audio.sfx('crumble', run ? 0.6 : 0.4);
      this.noise(run ? 17 : 10, x, z);
      return;
    }
    const twig = this.twigs.find((t) => Math.hypot(x - t.x, z - t.z) < 0.7 && this.clock > t.t);
    if (twig) {
      twig.t = this.clock + 5;
      audio.sfx('twig_snap', run ? 1 : 0.75);
      this.noise(run ? 18 : 13, x, z);
      return;
    }
    if (this.onRoad()) audio.sfx(run ? 'step_run' : 'footstep_concrete', run ? 0.5 : 0.4);
    else audio.sfx('footstep_gravel', run ? 0.45 : 0.3);
    this.noise(run ? (this.onRoad() ? 15 : 12) : 4.5, x, z);
    // and the crows, if you go running under them
    for (const c of this.crows) {
      if (c.flying > 0 || Math.hypot(x - c.x, z - c.z) > (run ? 8 : 3.5)) continue;
      this.startle(c);
    }
  }

  private land(): void {
    const wet = this.inWater(this.pos.x, this.pos.y);
    audio.sfx(wet ? 'splash' : 'footstep_gravel', wet ? 0.7 : 0.5);
    this.noise(wet ? 20 : 8, this.pos.x, this.pos.y);
  }

  private startle(c: Crow): void {
    c.flying = 0.001;
    audio.sfx('wings', 0.8, this.placeOf(c.x, c.z));
    audio.sfx('crow_caw', 0.9, this.placeOf(c.x, c.z));
    this.noise(30, c.x, c.z);
  }

  /** Something made a sound at (x, z) that carries `r` metres. */
  private noise(r: number, x: number, z: number): void {
    if (this.phase !== 'chase' || this.fMode === 'wait') return;
    const d = Math.hypot(this.froggy.x - x, this.froggy.y - z);
    if (d > r) return;
    this.lastKnown.set(x, z);
    if (this.fMode === 'hunt') {
      // he already has you; a sound only refreshes where he thinks you are
      this.lostT = Math.min(this.lostT, 1.5);
      return;
    }
    this.searchT = 0;
    if (d < r * 0.45) {
      this.fMode = 'hunt';
      this.lostT = 1.5;
    } else {
      this.fMode = 'investigate';
    }
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

  private story(dt: number): void {
    if (this.phase === 'walk' && this.pos.y < REVEAL_Z) {
      // He is put down behind you, on the road, under the light you passed --
      // or further back in the dark if you are already looking that way.
      const back = this.lookingAt(this.pos.x, this.pos.y + 10, 70) ? 24 : 15;
      this.froggy.set(0.4, this.pos.y + back);
      this.fYaw = Math.PI; // facing down the road, at you
      if (this.monster) this.monster.root.visible = true;
      this.fMode = 'wait';
      audio.sfx('croak', 1, { pan: 0, behind: 1 });
      this.phase = 'croak';
      this.phaseT = 0;
      this.hintT = 0;
      this.lines = [];
      this.say('...', 1.4);
      this.say('What was that?', 2.6);
      this.say('It came from behind me.', 6);
    }
    if (this.phase === 'croak') {
      this.hintT += dt;
      // a second croak if they keep walking without looking
      if (this.phaseT > 7 && this.phaseT - dt <= 7) audio.sfx('croak', 1.2, { pan: 0, behind: 1 });
      if (this.lookingAt(this.froggy.x, this.froggy.y, 32) || this.phaseT > 14) {
        this.phase = 'stare';
        this.phaseT = 0;
        this.stareT = 0;
        this.sayNow('', 0.01);
      }
    }
    if (this.phase === 'stare') {
      this.stareT += dt;
      if (this.stareT > 0.7 && this.lines.length === 0) this.say('Froggy...?', 9);
      if (this.stareT > STARE_HOLD + 0.9) {
        this.phase = 'chase';
        this.phaseT = 0;
        this.fMode = 'wait';
        this.sayNow('RUN.', 1.8, true);
        audio.sfx('stinger', 0.6);
      }
    }
    if (this.phase === 'chase' && this.fMode === 'wait' && this.phaseT > 1.1) {
      this.fMode = 'hunt';
      this.lostT = 0;
      this.lastKnown.copy(this.pos);
      audio.sfx('croak', 1.3, this.placeOf(this.froggy.x, this.froggy.y));
    }
    while (this.lines.length && this.lines[0].until < this.clock) this.lines.shift();
  }

  // ------------------------------------------------------------------ Froggy

  /** Can he see you from where he is? */
  private sees(): boolean {
    const dx = this.pos.x - this.froggy.x;
    const dz = this.pos.y - this.froggy.y;
    const d = Math.hypot(dx, dz);
    if (d < 3.5) return true;
    const lit = LAMP_ZS.some((z, i) => Math.hypot(this.pos.x - (i % 2 ? 1 : -1) * (RAIL_X - 1.2), this.pos.y - z) < 7.5);
    const range = lit ? 36 : this.onRoad() ? 27 : this.pos.y < HOTEL_Z + 12 ? 30 : 13;
    if (d > range) return false;
    if (this.fMode !== 'hunt') {
      // looking, he sees what is in front of him
      const ang = Math.atan2(dx, dz);
      let diff = Math.abs(ang - this.fYaw) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > THREE.MathUtils.degToRad(70)) return false;
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

    if (this.phase === 'chase' && this.fMode !== 'wait') {
      this.seen = this.sees();
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
          speed = HUNT;
          break;
        case 'investigate':
          target = this.lastKnown;
          speed = INVESTIGATE;
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
            this.wander.set(0, Math.max(HOTEL_Z + 14, Math.min(this.lastKnown.y, this.pos.y) - 12));
          }
          break;
        case 'patrol':
          speed = PATROL;
          target = this.wander;
          if (this.froggy.distanceTo(this.wander) < 1.5) {
            this.wander.set((Math.random() - 0.5) * 6, Phaser.Math.Clamp(this.pos.y + (Math.random() - 0.4) * 30, HOTEL_Z + 10, BACK_Z - 2));
          }
          break;
      }
    }

    if (target && speed > 0) {
      let dx = target.x - this.froggy.x;
      let dz = target.y - this.froggy.y;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        dx /= d;
        dz /= d;
        const wet = this.fy === 0 && this.inWater(this.froggy.x, this.froggy.y);
        const s = Math.min(d, speed * (wet ? 0.7 : 1) * (this.fHop > 0 ? 0.5 : 1) * dt);
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
        this.froggy.x = Phaser.Math.Clamp(this.froggy.x, -WORLD_X, WORLD_X);
        this.froggy.y = Phaser.Math.Clamp(this.froggy.y, HOTEL_Z + 2.5, BACK_Z + 20);
        // turn to where he is going, not snap
        const want = Math.atan2(dx, dz);
        let diff = want - this.fYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.fYaw += diff * Math.min(1, dt * 8);
        this.fStepT += dt;
        if (this.fStepT > (speed > 4 ? 0.3 : 0.55)) {
          this.fStepT = 0;
          const g = this.gainAt(this.froggy.x, this.froggy.y);
          if (g > 0.03) audio.sfx(wet ? 'splash' : speed > 4 ? 'hop_wet' : 'froggy_step', g * (wet ? 0.8 : 1), this.placeOf(this.froggy.x, this.froggy.y));
        }
      }
    } else if (this.phase === 'stare' || this.phase === 'croak' || this.fMode === 'wait') {
      // facing you, still
      const want = Math.atan2(this.pos.x - this.froggy.x, this.pos.y - this.froggy.y);
      this.fYaw += (want - this.fYaw) * Math.min(1, dt * 2);
    }
    if (this.fHop > 0) {
      this.fHop = Math.max(0, this.fHop - dt);
      this.fy = Math.sin((1 - this.fHop / 0.6) * Math.PI) * 1.1;
    } else this.fy = 0;

    const moved = this.froggy.distanceTo(was);
    this.fSpeed = dt > 0 ? moved / dt : 0;
    this.monster.setPose(this.froggy.x, this.fy, this.froggy.y, this.fYaw);
    const hunting = this.phase === 'chase' && this.fMode === 'hunt';
    const staring = this.phase === 'croak' || this.phase === 'stare' || (this.phase === 'chase' && this.fMode === 'wait');
    const cam = this.stage?.camera.position ?? null;
    this.monster.update(dt, {
      speed: this.fSpeed,
      maw: hunting ? 1 : staring ? 0.15 : 0.3,
      climb: 0,
      scan: this.fMode === 'search' || this.fMode === 'patrol' ? Math.sin(this.clock * 1.3) * 0.8 : 0,
      lunge: hunting ? 1 : 0,
      constrict: hunting || staring ? 1 : 0,
      bare: hunting ? 0.8 : 0,
      still: staring ? 1 : 0,
      menace: this.phase === 'chase' && this.fMode === 'wait' ? 1 : 0,
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

  private ambience(dt: number): void {
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
    void dt;
    const cam = this.stage!.camera;
    const amp = this.moving && this.y === 0 ? (this.running ? 0.07 : 0.04) : 0;
    const bob = Math.sin(this.bobT * Math.PI * 2 * 1.6) * amp;
    cam.position.set(this.pos.x, EYE + this.y + bob, this.pos.y);
    cam.rotation.set(0, this.yaw, 0);
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
      if (this.phase === 'chase' && this.phaseT > 1.2) {
        drawPixelText(ctx, 'OBJECTIVE', 6, 6, { scale: 1, color: '#9a4848', alpha: 0.85 });
        drawPixelText(ctx, 'RUN and hide - reach the hotel', 6, 16, { scale: 1, color: '#ff4a4a', alpha: 0.95 });
        const left = Math.max(0, Math.round(this.pos.y - HOTEL_Z));
        drawPixelText(ctx, `HOTEL ${left}m`, 6, 26, { scale: 1, color: '#7a8494', alpha: 0.75 });
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
        const scale = line.red ? 2 : line.text.length * 6 > room ? Math.max(0.5, room / (line.text.length * 6)) : 1;
        drawPixelText(ctx, line.text, GAME_W / 2 + (over.left - over.right) / 2, line.red ? GAME_H * 0.4 : GAME_H - 30, {
          scale,
          color: line.red ? '#ff4a4a' : '#e8e2cd',
          center: true,
        });
      }
      if (this.phase === 'croak' && this.hintT > 4) {
        drawPixelText(ctx, isTouch() ? 'DRAG THE PICTURE TO LOOK BEHIND YOU' : 'HOLD LEFT CLICK TO LOOK BEHIND YOU', GAME_W / 2, 14, {
          scale: 1,
          color: '#7a8494',
          center: true,
          alpha: 0.8,
        });
      }
      if (this.phase === 'chase' && this.phaseT > 1.2 && this.phaseT < 7) {
        drawPixelText(ctx, isTouch() ? 'HOLD RUN - JUMP THE RAILS' : 'SHIFT RUN - SPACE JUMPS THE RAILS', GAME_W / 2, GAME_H - 44, {
          scale: 1,
          color: '#7a8494',
          center: true,
          alpha: 0.8,
        });
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
      this.teardown();
      this.scene.restart({ retry: true });
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
      line: this.lines[0]?.text ?? '',
      yaw: this.yaw,
      clock: this.clock,
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
