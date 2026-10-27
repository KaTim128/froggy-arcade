/**
 * ---- UP THE STAIRS, WITH THE POLICE IN THE BUILDING.
 *
 * The night is over and the police think it was you.  The front doors are
 * theirs; the only way out is the window Froggy came in by, six floors up in
 * 612.  So: up the stairwell from the lobby, floor by floor, with three
 * officers searching the building for you.
 *
 *   THE BUILDING is three/policeBuilding: the stairwell from G to 6, six
 *   floors of corridor, and the flats off them -- some open, most locked,
 *   which ones decided at the start of every attempt.
 *
 *   THE POLICE are three/policeOfficer: three of them, each on its own, each
 *   with a torch and the red and blue going round its shins.  They split the
 *   building between them, sweep corridors, search open flats -- sometimes
 *   under the bed, in the wardrobe, behind the curtain or the door, never
 *   all of them -- and leave every door they open open behind them.  They
 *   see the way people see: within a distance, inside a field of view,
 *   with nothing solid in between, faster close up and in their torch,
 *   slower if you are down low.  Seen, there is a beat while it lands --
 *   "POLICE! DON'T MOVE!" -- and then they run, faster than you can.  Lose
 *   them and they go to where you were last, and look.  They talk to each
 *   other on the radio.
 *
 *   HIDING is the Hide and Seek game's, in a flat: under a bed, in a
 *   wardrobe, behind a shower curtain, behind the bathroom door.  Each has its
 *   own way of looking out (see `peek`): the gap under the bed frame, the
 *   crack between the wardrobe doors, the edge of the curtain, the gap at the
 *   hinge.  A hiding place is not a safe room: an officer who searches the
 *   one you are in finds you, and one who catches you peeking at him close up
 *   will look twice.
 *
 *   612.  Through its broken door, and the rest is not yours to steer: to the
 *   window; down, at the river six floors under it; round, at the three of
 *   them in the doorway; and out -- off the sill and down, the black just
 *   before the water, and the splash.
 *
 * Caught, it is the arrest -- the officer in your face, the torch in your
 * eyes, the cuffs -- and then ARRESTED, and RESPAWN (a new building, the
 * police back where they started) or LEAVE.
 */

import Phaser from 'phaser';
import * as THREE from 'three';
import { attachMouseLook, lockedDelta, lookScale } from '../core/look';
import { isPaused, releaseMouseQuietly } from '../core/pause';
import { audio, SILENCE, type SfxName } from '../core/audio';
import { isTouch } from '../core/device';
import { store } from '../core/state';
import { froggyLayer } from '../render/froggyLayer';
import { drawPixelText } from '../render/pixelFont';
import { ThreeStage } from '../render/threeStage';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { touchControls } from '../ui/touchControls';
import { followingDay } from '../game/life';
import { earnBadge } from '../game/badges';
import { OFFICER_LOOKS, PoliceOfficer, type OfficerState } from '../three/policeOfficer';
import {
  CEIL,
  CH,
  END_Z,
  FH,
  FLIGHT,
  GAP,
  OUTER,
  PoliceBuilding,
  SIDE612,
  WATER_Y,
  SDOOR,
  TOP,
  WX,
  WZ0,
  WZ1,
  type Box,
  type Door,
  type HideSpot,
  type NavNode,
  type Room,
  type Seg,
} from '../three/policeBuilding';

// ------------------------------------------------------------------ tuning

const EYE = 1.6;
const EYE_LOW = 1.0;
const R_PLAYER = 0.28;
const R_COP = 0.3;
const WALK = 2.4;
const RUN = 4.0;
const SNEAK = 1.3;
/** The police: unhurried, hurrying, and running you down (faster than you run). */
const PATROL = 1.3;
const HURRY = 2.6;
const CHASE = 4.9;
/** After losing sight of you in a chase, how long he still knows where you are. */
const LKP_BUFFER = 2.5;
/** This close (and nothing between) he knows you are there, whichever way he faces. */
const NEAR_SENSE = 2.0;
/**
 * HOW FAST THEY REALLY GO, against you.  On the way in to his floor (the
 * sixth, the third, the first) an officer runs it at twice your run, so a
 * sprint for 612 does not simply beat them up the stairs; once he is there,
 * or once he has seen you, he is 1.4 times you: 1.4 times your walk while he
 * searches, 1.4 times your run when he is running you down.  See copPace.
 */
const EN_ROUTE = RUN * 2;
const ON_FLOOR_WALK = WALK * 1.4;
const ON_FLOOR_RUN = RUN * 1.4;
/** How close is caught. */
const CATCH = 0.85;
/** Seen: how long before it lands. */
const ALERT_S = 0.6;
/** How far a running footstep carries. */
const RUN_HEARD = 9;
const DOOR_HEARD = 7;
/** Sight: how far, how wide. */
const SIGHT = 14;
const SIGHT_LOW = 8;
const FOV_H = 0.95;
const FOV_V = 0.9;
const BEAM_ANGLE = 0.36;

type WSeg = 'top' | 'A' | 'bot' | 'B';

interface Mover {
  x: number;
  z: number;
  /** The floor (in the well: the floor of the landing this part belongs to). */
  f: number;
  well: boolean;
  seg: WSeg;
  h: number;
}

type Act =
  | { k: 'go'; n: NavNode; pace?: number }
  | { k: 'look'; t: number }
  | { k: 'search'; room: Room }
  | { k: 'inspect'; spot: HideSpot };

type CopMode = 'task' | 'alert' | 'chase' | 'lost' | 'scripted' | 'arrest';

interface Cop {
  i: number;
  model: PoliceOfficer;
  m: Mover;
  yaw: number;
  mode: CopMode;
  acts: Act[];
  path: NavNode[];
  pathI: number;
  pathTo: NavNode | null;
  pace: number;
  /** The act in hand: a look's clock, an inspection's clock. */
  t: number;
  sus: number;
  lkp: { x: number; z: number; f: number; well: boolean; h: number } | null;
  lostT: number;
  alertT: number;
  waitDoor: Door | null;
  waitT: number;
  /** How far open the door he is waiting on was, a frame ago. */
  waitK?: number;
  stuckT: number;
  /** Held up on furniture going straight at you: round by the nav graph for a moment. */
  detourT: number;
  lastPos: { x: number; z: number };
  floorGoal: number;
  /** His own floor: where he goes first, and keeps coming back to. */
  home: number;
  lastFloor: number;
  /** Rig: what the body is doing this frame. */
  st: OfficerState;
  speedNow: number;
  radioT: number;
  /** In the lobby until he comes in. */
  inLobby: boolean;
  heardT: number;
  /** Got to his floor (or seen you on the way): off the double-time. */
  arrived: boolean;
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const wrap = (a: number): number => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

// ------------------------------------------------------------------ the well's shape

function wellH(f: number, seg: WSeg, z: number): number {
  const y0 = f * FH;
  switch (seg) {
    case 'top':
      return y0;
    case 'A':
      return y0 + (FH / 2) * clamp(-z / FLIGHT, 0, 1);
    case 'bot':
      return y0 + FH / 2;
    case 'B':
      return y0 + FH / 2 + (FH / 2) * clamp((z + FLIGHT) / FLIGHT, 0, 1);
  }
}

function wellNext(f: number, seg: WSeg, x: number, z: number): { f: number; seg: WSeg } {
  if (seg === 'top') {
    if (z < 0) {
      if (x < 0 && f < TOP) return { f, seg: 'A' };
      if (x > 0 && f > 0) return { f: f - 1, seg: 'B' };
    }
  } else if (seg === 'A') {
    if (z >= 0) return { f, seg: 'top' };
    if (z < -FLIGHT) return { f, seg: 'bot' };
  } else if (seg === 'bot') {
    if (z >= -FLIGHT) return { f, seg: x < 0 ? 'A' : 'B' };
  } else if (seg === 'B') {
    if (z < -FLIGHT) return { f, seg: 'bot' };
    if (z >= 0) return { f: f + 1, seg: 'top' };
  }
  return { f, seg };
}

/** Where a piece of the well sits in the climb: G's landing is 0, its first flight 1, and so on up. */
const SEG_RANK: Record<WSeg, number> = { top: 0, A: 1, bot: 2, B: 3 };
const wellRank = (f: number, seg: WSeg): number => f * 4 + SEG_RANK[seg];

/**
 * In the well, the point to make for next to get from (f, seg) toward
 * (tf, tseg) at (tx, tz): straight at it on the same piece, otherwise the
 * mouth of the next flight or landing, a little way past it so the step
 * there crosses over.  (A straight line across the well runs into the gap
 * between the flights and stops there.)
 */
function wellAim(f: number, seg: WSeg, tf: number, tseg: WSeg, tx: number, tz: number): { x: number; z: number } {
  const a = wellRank(f, seg);
  const b = wellRank(tf, tseg);
  if (a === b) return { x: tx, z: tz };
  const L = -(WX + GAP) / 2;
  const R = (WX + GAP) / 2;
  const up = b > a;
  switch (seg) {
    case 'top':
      return up ? { x: L, z: -0.4 } : { x: R, z: -0.4 };
    case 'A':
      return up ? { x: L, z: -FLIGHT - 0.3 } : { x: L, z: 0.3 };
    case 'bot':
      return up ? { x: R, z: -FLIGHT + 0.4 } : { x: L, z: -FLIGHT + 0.4 };
    case 'B':
      return up ? { x: R, z: 0.3 } : { x: R, z: -FLIGHT - 0.3 };
  }
}

function wellClamp(f: number, seg: WSeg, x: number, z: number, r: number): { x: number; z: number } {
  x = clamp(x, -WX + r, WX - r);
  z = clamp(z, WZ0 + r, WZ1 - r);
  if (seg === 'A') x = Math.min(x, -GAP - r);
  if (seg === 'B') x = Math.max(x, GAP + r);
  if (seg === 'top' && z < 0) {
    // the gap down the middle; nothing up from 6; nothing down from G
    if (Math.abs(x) < GAP + r) z = 0;
    if (f === TOP && x < 0) z = 0;
    if (f === 0 && x > 0) z = 0;
  }
  if (seg === 'bot' && z > -FLIGHT && Math.abs(x) < GAP + r) z = -FLIGHT;
  return { x, z };
}

// ------------------------------------------------------------------ 2D geometry

function segHit(ax: number, az: number, bx: number, bz: number, s: Seg): number | null {
  const rx = bx - ax;
  const rz = bz - az;
  const sx = s.x1 - s.x0;
  const sz = s.z1 - s.z0;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((s.x0 - ax) * sz - (s.z0 - az) * sx) / den;
  const u = ((s.x0 - ax) * rz - (s.z0 - az) * rx) / den;
  if (t > 1e-4 && t < 1 - 1e-4 && u >= 0 && u <= 1) return t;
  return null;
}

function boxHit(ax: number, az: number, bx: number, bz: number, b: Box): boolean {
  // slab test
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  for (const [p, d, lo, hi] of [
    [ax, dx, b.x0, b.x1],
    [az, dz, b.z0, b.z1],
  ] as const) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return false;
    } else {
      let ta = (lo - p) / d;
      let tb = (hi - p) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
  }
  return t0 < 1 && t1 > 0;
}

function pushCircle(x: number, z: number, r: number, segs: Seg[], boxes: Box[]): { x: number; z: number } {
  for (let it = 0; it < 3; it++) {
    for (const s of segs) {
      const sx = s.x1 - s.x0;
      const sz = s.z1 - s.z0;
      const l2 = sx * sx + sz * sz;
      const t = l2 > 0 ? clamp(((x - s.x0) * sx + (z - s.z0) * sz) / l2, 0, 1) : 0;
      const px = s.x0 + sx * t;
      const pz = s.z0 + sz * t;
      const dx = x - px;
      const dz = z - pz;
      const d = Math.hypot(dx, dz);
      if (d < r && d > 1e-6) {
        x = px + (dx / d) * r;
        z = pz + (dz / d) * r;
      }
    }
    for (const b of boxes) {
      const px = clamp(x, b.x0, b.x1);
      const pz = clamp(z, b.z0, b.z1);
      const dx = x - px;
      const dz = z - pz;
      const d = Math.hypot(dx, dz);
      if (d < r) {
        if (d > 1e-6) {
          x = px + (dx / d) * r;
          z = pz + (dz / d) * r;
        } else {
          // inside: out by the nearest face
          const opts = [
            [b.x0 - r - x, 0],
            [b.x1 + r - x, 0],
            [0, b.z0 - r - z],
            [0, b.z1 + r - z],
          ];
          opts.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]));
          x += opts[0][0];
          z += opts[0][1];
        }
      }
    }
  }
  return { x, z };
}

// ------------------------------------------------------------------ the scene

type Phase = 'intro' | 'play' | 'caught' | 'cinema' | 'ending';

/** 612's beats, in seconds from walking in: when each one ends. */
const CINE = (() => {
  const room = 1.6; // into the room
  const window = room + 1.6; // to the window
  const down = window + 1.4; // lean out, look down
  const hold = down + 3.0; // the river, a long look
  const turn = hold + 1.1; // round to the door
  const them = turn + 2.4; // the three of them, in the doorway
  const back = them + 0.6; // back to the window
  const jump = back + 0.9; // up on the sill, and off
  const fall = jump + 1.9; // the fall, to just above the water
  return { room, window, down, hold, turn, them, back, jump, fall };
})();

interface HideState {
  spot: HideSpot;
  /** 0 entering .. 1 in; then leaving runs it back down. */
  k: number;
  leaving: boolean;
  peek: boolean;
  peekK: number;
  /** A little look round from inside: offsets on the spot's own view. */
  lookYaw: number;
  lookPitch: number;
  since: number;
}

export class PoliceEscape3D extends Phaser.Scene {
  private stage: ThreeStage | null = null;
  private b: PoliceBuilding | null = null;
  private cops: Cop[] = [];
  private seed = 1;
  private phase: Phase = 'intro';
  private phaseT = 0;
  private clock = 0;
  private retry = false;

  // you
  private me: Mover = { x: 0.9, z: 0.9, f: 0, well: true, seg: 'top', h: 0 };
  private yaw = 0;
  private pitch = 0;
  private crouch = false;
  private eyeNow = EYE;
  private running = false;
  private moving = false;
  private bobT = 0;
  private stepT = 0;
  private hide: HideState | null = null;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private dragging = false;
  private onLookDown: ((e: MouseEvent) => void) | null = null;
  private onLookMove: ((e: MouseEvent) => void) | null = null;
  private onLookUp: (() => void) | null = null;

  // the world's own light
  private hallLights: THREE.PointLight[] = [];
  private wellLight: THREE.PointLight | null = null;
  private fill: THREE.PointLight | null = null;
  /** The arrest: a hard cold light under the face. */
  private scareLight: THREE.PointLight | null = null;
  private flare: THREE.Sprite | null = null;
  private cuffs: THREE.Group | null = null;

  // words
  private lines: Array<{ text: string; until: number; red?: boolean }> = [];
  private objective = '';
  private prompt = '';
  private hint = '';
  private hintUntil = 0;
  private padSyncT = 0;
  /** Rooms the police have reason to look at harder: id -> 0..1. */
  private heat = new Map<number, number>();
  /** Which far officer's torch shadow is redrawn this frame (see lightsAndVisibility). */
  private shadowTick = 0;
  private pressure = 0.3;
  private sirenT = 4;
  private frozen = false;

  // the arrest and the end
  private catcher: Cop | null = null;
  private scareT = 0;
  private cine: { t: number; step: number; from: THREE.Vector3; yaw0: number; p0?: THREE.Vector3; black?: boolean; riverT?: number } | null = null;
  private endLines: Array<{ text: string; dur: number; col: string }> = [];
  private endI = 0;
  private endT = 0;

  constructor() {
    super('PoliceEscape3D');
  }

  init(data: { retry?: boolean } = {}): void {
    this.retry = !!data.retry;
  }

  create(): void {
    froggyLayer.clear();
    audio.setScene(SILENCE);
    // a new building every attempt: which flats are open, what is in them
    this.seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    this.phase = 'intro';
    this.phaseT = 0;
    this.clock = 0;
    this.lines = [];
    this.cops = [];
    this.hide = null;
    this.heat.clear();
    this.pressure = 0.3;
    this.catcher = null;
    this.cine = null;
    this.endLines = [];
    this.crouch = false;
    this.eyeNow = EYE;
    this.frozen = false;
    // (the scene object is kept between attempts: a RESPAWN must not find it
    // already arrested, or the second arrest never leaves the black)
    this.arrested = false;
    this.finished = false;
    this.hallLights = [];
    this.me = { x: 0.9, z: 0.95, f: 0, well: true, seg: 'top', h: 0 };
    // (facing the stairs, the lobby door at your back)
    this.yaw = 0.5;
    this.pitch = 0;
    if (store.get().hotelAfter !== 'police') {
      store.patch({ hotelAfter: 'police' });
      store.flush();
    }

    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000).setOrigin(0, 0);
    const root = document.getElementById('game-root');
    if (!root) return;
    this.stage = new ThreeStage();
    this.stage.mount(root, this.game.canvas);
    this.build();

    this.objective = 'Get to room 612 on floor 6.';
    if (this.retry) {
      this.say('Again. Quiet, this time.', 2.4);
    } else {
      // (short: the less there is over the picture, the better)
      this.say('Not the front. Up -- 612, his window.', 3);
      this.time.delayedCall(2600, () => {
        audio.sfx('radio_static', 0.5);
        this.say('RADIO: "Search every floor."', 1.8, true);
      });
    }
    this.hint = isTouch() ? 'STICK TO WALK - DRAG TO LOOK - CROUCH TO SNEAK' : 'W A S D TO WALK - SHIFT RUN - C CROUCH - E USE';
    this.hintUntil = 7;

    const kb = this.input.keyboard;
    if (kb) {
      this.keys = {
        up: [kb.addKey('W'), kb.addKey('UP')],
        down: [kb.addKey('S'), kb.addKey('DOWN')],
        left: [kb.addKey('A'), kb.addKey('LEFT')],
        right: [kb.addKey('D'), kb.addKey('RIGHT')],
        run: [kb.addKey('SHIFT')],
      };
      kb.on('keydown-E', () => this.press());
      kb.on('keydown-Q', () => this.togglePeek());
      kb.on('keydown-C', () => {
        if (!this.hide && this.phase === 'play') this.crouch = !this.crouch;
      });
    }
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.event instanceof MouseEvent && document.pointerLockElement) {
        const d = lockedDelta(p.event);
        this.look(d.dx * 0.0027 * lookScale(), d.dy * 0.0022 * lookScale());
      }
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.phase === 'ending') this.advanceEnd();
      else if (p.y > GAME_H * 0.62 && this.lines.length) this.lines.shift();
    });
    this.onLookDown = (e: MouseEvent) => {
      if (e.button === 0 && !isPaused()) this.dragging = true;
      if (e.button === 2 && this.hide) this.togglePeek();
    };
    this.onLookMove = (e: MouseEvent) => {
      if (!this.dragging || document.pointerLockElement || isPaused()) return;
      const sens = (e as MouseEvent & { lookSens?: number }).lookSens ?? 0.0042;
      this.look((e.movementX || 0) * sens * lookScale(), (e.movementY || 0) * sens * 0.8 * lookScale());
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

  private look(dx: number, dy: number): void {
    if (this.phase === 'cinema' || this.phase === 'caught' || this.phase === 'ending') return;
    if (this.hide) {
      // from inside you can turn your head, a little
      this.hide.lookYaw = clamp(this.hide.lookYaw - dx, -0.55, 0.55);
      this.hide.lookPitch = clamp(this.hide.lookPitch - dy, -0.3, 0.3);
      return;
    }
    this.yaw -= dx;
    this.pitch = clamp(this.pitch - dy, -1.1, 1.0);
  }

  // ===================================================================== world

  private build(): void {
    const st = this.stage!;
    const S = st.scene;
    st.camera.near = 0.05;
    st.camera.far = 90;
    st.camera.fov = 72;
    st.camera.updateProjectionMatrix();
    S.background = new THREE.Color(0x05060a);
    S.fog = new THREE.FogExp2(0x05060a, 0.045);
    S.add(new THREE.HemisphereLight(0x4a4a5a, 0x100c0a, 0.5));
    S.add(st.camera);
    // a little light of your own: up and behind the eye, so a door or a
    // wardrobe's inside a hand's width away is not burned white by it
    this.fill = new THREE.PointLight(0xffe8d0, 0.7, 6, 1.6);
    this.fill.position.set(0, 0.35, 0.6);
    st.camera.add(this.fill);
    this.b = new PoliceBuilding(S, { seed: this.seed });
    // the corridor's lights: a few, moved to the fittings nearest you
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffd9a0, 7, 8, 1.4);
      S.add(l);
      this.hallLights.push(l);
    }
    this.wellLight = new THREE.PointLight(0xe8f0ff, 3.4, 9, 1.2);
    S.add(this.wellLight);
    this.scareLight = new THREE.PointLight(0xc8d8ff, 0, 3, 1.5);
    S.add(this.scareLight);
    this.flare = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: (() => {
          const c = document.createElement('canvas');
          c.width = c.height = 64;
          const g = c.getContext('2d')!;
          const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
          grd.addColorStop(0, 'rgba(255,255,255,1)');
          grd.addColorStop(0.25, 'rgba(255,250,230,0.7)');
          grd.addColorStop(1, 'rgba(255,240,200,0)');
          g.fillStyle = grd;
          g.fillRect(0, 0, 64, 64);
          return new THREE.CanvasTexture(c);
        })(),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        opacity: 0,
      }),
    );
    this.flare.scale.setScalar(0.6);
    this.flare.renderOrder = 20;
    S.add(this.flare);
    // the cuffs, for the arrest: two steel rings and their chain
    this.cuffs = new THREE.Group();
    const steel = new THREE.MeshPhongMaterial({ color: 0xc8ccd4, specular: 0xffffff, shininess: 120 });
    for (const s of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 8, 20), steel);
      ring.position.x = s * 0.06;
      this.cuffs.add(ring);
    }
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 6), steel);
    chain.rotation.z = Math.PI / 2;
    this.cuffs.add(chain);
    this.cuffs.visible = false;
    S.add(this.cuffs);
    this.makeCops();
  }

  /**
   * THE THREE OF THEM, at the lobby's smashed front doors.  They come in one
   * after another a few seconds after you, and each has his floor: the first
   * goes straight up after you, all the way to the sixth; the second follows
   * him up and takes the third; the last stays on the first.  Once there,
   * each is his own -- searching his floor, then any floor, drawn to where
   * you have been seen or heard (and to his own more than the others).
   */
  private makeCops(): void {
    const b = this.b!;
    const door = b.entrance!;
    const plan = [
      { home: TOP, at: { x: door.x + 0.3, z: door.z - 0.45 }, wait: this.retry ? 2.5 : 4 },
      { home: 3, at: { x: door.x - 0.2, z: door.z + 0.5 }, wait: this.retry ? 3.7 : 5.4 },
      { home: 1, at: { x: door.x - 0.6, z: door.z - 0.1 }, wait: this.retry ? 5 : 7 },
    ];
    OFFICER_LOOKS.forEach((look, i) => {
      const model = new PoliceOfficer(look, 101 + i * 7);
      this.stage!.scene.add(model.root);
      const p = plan[i];
      const c: Cop = {
        i,
        model,
        m: { x: p.at.x, z: p.at.z, f: 0, well: false, seg: 'top', h: 0 },
        // (facing in, across the lobby, at the stairs)
        yaw: Math.PI / 2,
        mode: 'task',
        acts: [{ k: 'look', t: p.wait }],
        path: [],
        pathI: 0,
        pathTo: null,
        pace: PATROL,
        t: 0,
        sus: 0,
        lkp: null,
        lostT: 0,
        alertT: 0,
        waitDoor: null,
        waitT: 0,
        stuckT: 0,
        detourT: 0,
        lastPos: { x: 0, z: 0 },
        floorGoal: p.home,
        lastFloor: 0,
        home: p.home,
        st: { speed: 0, run: false, aimYaw: 0, aimPitch: 0, crouch: 0, reach: 0, point: 0, shout: 0, grab: 0, beamLen: 8, torch: 1, lights: 1 },
        speedNow: 0,
        radioT: 8 + i * 4,
        inLobby: true,
        heardT: 0,
        arrived: false,
      };
      model.onFootfall = (at, run) => this.sfxAt('police_step', at, run ? 0.9 : 0.6);
      this.cops.push(c);
    });
  }

  /** What each of them says on the radio as he comes in, and where he goes. */
  private comeIn(c: Cop): void {
    const b = this.b!;
    c.inLobby = false;
    c.acts = [];
    c.t = 0;
    this.sfxAt('police_radio', this.eyeOf(c.m, 1.6), 0.9);
    const words = ['"GOING UP."', '"TAKING THREE."', '"FIRST FLOOR."'];
    this.say(words[c.i] ?? '"MOVING IN."', 1.3, true);
    // straight up to his floor -- the first one fast, after you -- and then
    // his floor, flat by flat
    this.sweepFloor(c, c.home, false, c.i === 0 ? HURRY : c.i === 1 ? HURRY * 0.92 : PATROL * 1.3);
    void b;
  }

  // ===================================================================== loop

  private held(g: string): boolean {
    return this.keys[g]?.some((k) => k.isDown) ?? false;
  }

  private tick(dt: number): void {
    if (!this.stage || !this.b) return;
    dt = Math.min(dt, 0.05);
    this.clock += dt;
    this.phaseT += dt;
    this.b.update(dt);
    this.animateDoors(dt);
    if (this.phase === 'intro' && this.clock > 0.8) this.phase = 'play';
    if (this.phase === 'caught') {
      this.arrestFrame(dt);
    } else if (this.phase === 'cinema') {
      this.cinemaFrame(dt);
      for (const c of this.cops) this.poseCop(c, dt);
    } else if (this.phase === 'ending') {
      this.endFrame(dt);
    } else {
      this.syncPad(dt);
      this.movePlayer(dt);
      this.hideFrame(dt);
      if (!this.frozen) for (const c of this.cops) this.copFrame(c, dt);
      for (const c of this.cops) this.poseCop(c, dt);
      this.ambience(dt);
      this.check612();
      this.updateCamera(dt);
    }
    this.lightsAndVisibility(dt);
    this.paintOverlay();
    this.publish();
  }

  private syncPad(dt: number): void {
    this.padSyncT -= dt;
    if (!isTouch() || this.padSyncT > 0) return;
    this.padSyncT = 0.25;
    touchControls.showButton('Q', !!this.hide);
    touchControls.showButton('SHIFT', !this.hide);
    touchControls.showButton('C', !this.hide);
  }

  // ===================================================================== you

  private eyeOf(m: Mover, eye: number): THREE.Vector3 {
    return new THREE.Vector3(m.x, m.h + eye, m.z);
  }

  /** The floor whose corridor a mover is level with (the well's middle reads as the nearer floor). */
  private levelOf(m: Mover): number {
    return m.well ? Math.round(m.h / FH) : m.f;
  }

  /**
   * One step of a body: through the corridor and the flats (walls, doors,
   * furniture), or up and down the stairs, and through the fire doors
   * between them.  `who` decides what a body may do: the player cannot go
   * back down into the lobby; the police can.
   */
  private step(m: Mover, nx: number, nz: number, r: number, who: 'me' | 'cop', boxes = true): void {
    const b = this.b!;
    if (m.well) {
      const sd = b.stairDoors[m.f];
      const inDoor = nx > SDOOR.x0 + 0.12 && nx < SDOOR.x1 - 0.12;
      if (m.seg === 'top' && nz > WZ1 - r - 0.02 && inDoor && sd && sd.k > 0.55) {
        if (m.f === 0 && who === 'me') {
          // The lobby is theirs: you can come up to the threshold, into the
          // broken doorway, and lean out to look along it -- to the front
          // doors on your right, where they come in -- but no further
          // (and out there, in the doorway, they can see you too).
          m.x = clamp(nx, SDOOR.x0 + 0.12, SDOOR.x1 - 0.12);
          m.z = Math.min(nz, WZ1 + 0.5);
          m.h = 0;
          return;
        } else if (nz > WZ1 + 0.02) {
          m.well = false;
          m.x = nx;
          m.z = nz;
          m.h = m.f * FH;
          return;
        } else {
          m.x = clamp(nx, SDOOR.x0 + 0.12, SDOOR.x1 - 0.12);
          m.z = nz;
          return;
        }
      }
      const w = wellNext(m.f, m.seg, nx, nz);
      const c = wellClamp(w.f, w.seg, nx, nz, r);
      const w2 = wellNext(m.f, m.seg, c.x, c.z);
      m.f = w2.f;
      m.seg = w2.seg;
      m.x = c.x;
      m.z = c.z;
      m.h = wellH(m.f, m.seg, m.z);
      return;
    }
    // into the well through the fire door
    const sd = b.stairDoors[m.f];
    if (nz < WZ1 + r && nx > SDOOR.x0 + 0.1 && nx < SDOOR.x1 - 0.1 && sd && sd.k > 0.55) {
      if (nz < WZ1 - 0.02) {
        m.well = true;
        m.seg = 'top';
        m.x = nx;
        m.z = nz;
        m.h = m.f * FH;
        return;
      }
      m.x = clamp(nx, SDOOR.x0 + 0.1, SDOOR.x1 - 0.1);
      m.z = nz;
      return;
    }
    const segs = this.segsCache(m.f, false);
    const p = pushCircle(nx, nz, r, segs, boxes ? b.floors[m.f].boxes : []);
    m.x = p.x;
    m.z = p.z;
    m.h = m.f * FH;
  }

  private segCache = new Map<string, { t: number; segs: Seg[] }>();
  private segsCache(f: number, well: boolean): Seg[] {
    const key = `${f}${well ? 'w' : ''}`;
    const c = this.segCache.get(key);
    if (c && c.t === this.clock) return c.segs;
    const segs = this.b!.segsFor(f, well);
    this.segCache.set(key, { t: this.clock, segs });
    return segs;
  }

  private movePlayer(dt: number): void {
    if (this.hide || this.phase !== 'play') {
      this.moving = false;
      return;
    }
    const fwd = (this.held('up') ? 1 : 0) - (this.held('down') ? 1 : 0);
    const strafe = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    this.running = this.held('run') && !this.crouch;
    this.moving = fwd !== 0 || strafe !== 0;
    this.eyeNow += ((this.crouch ? EYE_LOW : EYE) - this.eyeNow) * Math.min(1, dt * 8);
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
    const sp = (this.crouch ? SNEAK : this.running ? RUN : WALK) * dt;
    const wasWell = this.me.well;
    const wasF = this.me.f;
    this.step(this.me, this.me.x + dx * sp, this.me.z + dz * sp, R_PLAYER, 'me');
    if (this.me.well && this.me.f === 0 && this.me.seg === 'top' && this.me.z > WZ1 - 0.36 && this.me.x > SDOOR.x0 && this.me.x < SDOOR.x1 && !this.lines.length) {
      this.say("Not the lobby. They're down there. Up.", 2.4);
    }
    if (wasWell !== this.me.well || wasF !== this.me.f) this.segCache.clear();
    this.bobT += dt * (this.running ? 1.5 : this.crouch ? 0.6 : 1);
    this.stepT += dt;
    const every = this.running ? 0.3 : this.crouch ? 0.6 : 0.44;
    if (this.stepT > every) {
      this.stepT = 0;
      if (!this.crouch) audio.sfx(this.me.well ? 'footstep_concrete' : 'footstep_carpet', this.running ? 0.75 : 0.42);
      // running is heard
      if (this.running) this.noise(this.me.x, this.me.z, RUN_HEARD, 'run');
    }
  }

  // ===================================================================== using things

  private nearestDoor(): Door | null {
    const b = this.b!;
    let best: Door | null = null;
    let bd = 1.35;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    for (const d of b.doors) {
      if (d.floor !== this.me.f || !d.pivot.visible) continue;
      // (a fire door from the well side is the well's; from the corridor, the corridor's)
      const leaf = PoliceBuilding.leaf(d);
      const shutEnd = { x: d.hx + Math.cos(d.shut) * d.width, z: d.hz + Math.sin(d.shut) * d.width };
      const mx = (d.hx + shutEnd.x) / 2;
      const mz = (d.hz + shutEnd.z) / 2;
      const lx = (leaf.x0 + leaf.x1) / 2;
      const lz = (leaf.z0 + leaf.z1) / 2;
      const dd = Math.min(Math.hypot(this.me.x - mx, this.me.z - mz), Math.hypot(this.me.x - lx, this.me.z - lz));
      const facing = ((mx - this.me.x) * fx + (mz - this.me.z) * fz) / Math.max(0.01, Math.hypot(mx - this.me.x, mz - this.me.z));
      if (dd < bd && facing > -0.2) {
        bd = dd;
        best = d;
      }
    }
    return best;
  }

  private nearestSpot(): HideSpot | null {
    if (this.me.well) return null;
    let best: HideSpot | null = null;
    let bd = 0.95;
    for (const sp of this.b!.spots) {
      if (sp.floor !== this.me.f) continue;
      const d = Math.hypot(this.me.x - sp.approach.x, this.me.z - sp.approach.z);
      if (d < bd) {
        bd = d;
        best = sp;
      }
    }
    return best;
  }

  private spotVerb(sp: HideSpot): string {
    return sp.kind === 'bed' ? 'HIDE UNDER THE BED' : sp.kind === 'wardrobe' ? 'HIDE IN THE WARDROBE' : sp.kind === 'curtain' ? 'HIDE BEHIND THE CURTAIN' : 'HIDE BEHIND THE DOOR';
  }

  private press(): void {
    if (this.phase !== 'play') {
      if (this.phase === 'ending') this.advanceEnd();
      return;
    }
    if (this.hide) {
      if (this.hide.leaving || this.hide.k < 1) return;
      // out, unless one of them is right there
      const sp = this.hide.spot;
      const blocker = this.cops.find((c) => !c.m.well && c.m.f === sp.floor && Math.hypot(c.m.x - sp.exit.x, c.m.z - sp.exit.z) < 1.1);
      if (blocker) {
        this.sayNow("Not now -- he's right there.", 1.6, true);
        return;
      }
      this.hide.leaving = true;
      this.hide.peek = false;
      if (sp.kind === 'wardrobe') {
        sp.setOpen(1);
        audio.sfx('wardrobe', 0.6);
      } else if (sp.kind === 'curtain') {
        sp.setOpen(0.6);
        audio.sfx('curtain', 0.6);
      }
      return;
    }
    const sp = this.nearestSpot();
    if (sp) return this.enterSpot(sp);
    const d = this.nearestDoor();
    if (d) return this.useDoor(d);
    if (this.atLobbyGap()) {
      this.sayNow("The police are in the lobby. Up -- not down.", 1.6);
      return;
    }
    if (!this.me.well && this.me.z < 2.2 && Math.abs(this.me.x + 1.6) < 1.0) {
      audio.sfx('lift_dead', 0.8);
      this.say('Dead. Nothing lights up.', 1.8);
    }
  }

  /** At the foot of the stairs, by the doorway Froggy broke through. */
  private atLobbyGap(): boolean {
    const m = this.me;
    return m.well && m.f === 0 && m.seg === 'top' && m.z > WZ1 - 0.9 && m.x > SDOOR.x0 - 0.3 && m.x < SDOOR.x1 + 0.3;
  }

  private useDoor(d: Door): void {
    if (d.locked) {
      audio.sfx('door_rattle', 0.7);
      this.sayNow(d.kind === 'stair' ? "The police are in the lobby. Up -- not down." : 'Locked.', 1.6);
      this.noise(d.hx, d.hz, 4, 'door');
      return;
    }
    // (a door that would swing into you does not)
    const opening = d.want < 0.5;
    d.want = opening ? 1 : 0;
    d.by = 'player';
    audio.sfx('door_handle', 0.5);
    this.noise(d.hx, d.hz, DOOR_HEARD, 'door');
  }

  private enterSpot(sp: HideSpot): void {
    // somebody is searching it right now
    if (this.cops.some((c) => c.acts[0]?.k === 'inspect' && (c.acts[0] as { spot: HideSpot }).spot === sp && c.t > 0)) return;
    // SEEN GOING IN: whoever had you in sight as you got in knows exactly
    // where you are -- straight over, open it up, and that is you caught
    const saw = this.phase === 'play' ? this.cops.filter((c) => this.seesYouNow(c)) : [];
    this.hide = { spot: sp, k: 0, leaving: false, peek: false, peekK: 0, lookYaw: 0, lookPitch: 0, since: 0 };
    if (saw.length && sp.node) {
      for (const c of saw) {
        c.mode = 'lost';
        c.inLobby = false;
        c.sus = 1;
        c.t = 0;
        c.path = [];
        c.acts = [{ k: 'go', n: sp.node, pace: CHASE * 0.9 }, { k: 'inspect', spot: sp }];
      }
      this.lines = [];
      this.sfxAt('police_shout', this.eyeOf(saw[0].m, 1.7), 1);
      this.say(sp.kind === 'bed' ? 'I SAW YOU GET UNDER THERE!' : 'I SAW YOU GO IN THERE!', 1.8, true);
    }
    this.crouch = false;
    if (sp.kind === 'wardrobe') {
      sp.setOpen(1);
      audio.sfx('wardrobe', 0.6);
    } else if (sp.kind === 'curtain') {
      sp.setOpen(0.6);
      audio.sfx('curtain', 0.6);
    } else if (sp.kind === 'door' && sp.door) {
      sp.door.want = 1;
      sp.door.by = 'player';
      audio.sfx('door_handle', 0.4);
    } else audio.sfx('item_thud', 0.25);
    this.hint = sp.kind === 'bed' ? 'UNDER THE BED' : '';
    this.hintUntil = 0;
  }

  private togglePeek(): void {
    if (!this.hide || this.hide.k < 1 || this.hide.leaving) return;
    this.hide.peek = !this.hide.peek;
    const sp = this.hide.spot;
    if (sp.kind === 'wardrobe') sp.setOpen(this.hide.peek ? 0.14 : 0.02);
    if (sp.kind === 'curtain') sp.setOpen(this.hide.peek ? 0.12 : 0);
    if (sp.kind === 'wardrobe' || sp.kind === 'curtain') audio.sfx(sp.kind === 'wardrobe' ? 'wardrobe' : 'curtain', 0.25);
  }

  private hideFrame(dt: number): void {
    const h = this.hide;
    if (!h) return;
    const sp = h.spot;
    h.peekK += ((h.peek ? 1 : 0) - h.peekK) * Math.min(1, dt * 6);
    if (h.leaving) {
      h.k -= dt / 0.65;
      if (h.k <= 0) {
        this.hide = null;
        this.me.x = sp.exit.x;
        this.me.z = sp.exit.z;
        this.me.well = false;
        this.me.f = sp.floor;
        this.me.h = sp.floor * FH;
        // face back into the room the way you came out
        this.yaw = Math.atan2(-(sp.exit.x - sp.eye.x), -(sp.exit.z - sp.eye.z));
        this.pitch = 0;
        if (sp.kind === 'wardrobe') sp.setOpen(0);
        if (sp.kind === 'curtain') sp.setOpen(0);
        return;
      }
    } else if (h.k < 1) {
      h.k = Math.min(1, h.k + dt / 0.7);
      if (h.k >= 1) {
        if (sp.kind === 'wardrobe') {
          sp.setOpen(0.02);
          audio.sfx('wardrobe', 0.4);
        }
        if (sp.kind === 'curtain') {
          sp.setOpen(0);
          audio.sfx('curtain', 0.35);
        }
        this.hint = isTouch() ? 'PEEK TO LOOK OUT - INTERACT TO GET OUT' : 'Q TO PEEK - E TO GET OUT';
        this.hintUntil = this.clock + 4;
      }
    } else h.since += dt;
    // your body is where the spot is, for anyone looking
    this.me.x = sp.eye.x;
    this.me.z = sp.eye.z;
    this.me.f = sp.floor;
    this.me.well = false;
    this.me.h = sp.floor * FH;
  }

  // ===================================================================== noise and heat

  private noise(x: number, z: number, range: number, kind: 'run' | 'door'): void {
    const lvl = this.levelOf(this.me);
    const me = this.me;
    for (const c of this.cops) {
      if (c.inLobby) continue;
      // (the well carries a sound up and down it: a floor either way)
      const inWell = c.m.well && me.well;
      if (inWell ? Math.abs(c.m.h - me.h) > FH * 1.5 : Math.abs(this.levelOf(c.m) - lvl) > 0 || Math.abs(c.m.h - me.h) > 2) continue;
      const d = Math.hypot(c.m.x - x, c.m.z - z);
      if (d > range) continue;
      // RUNNING IS HEARD, AND HE KNOWS IT IS YOU: after you, to where the
      // footsteps are.  (Every step heard puts him back on them; out of
      // earshot he goes to the last of them, and then searches.)
      if (kind === 'run') {
        c.lkp = { x: me.x, z: me.z, f: me.f, well: me.well, h: me.h };
        c.lostT = 0;
        if (c.mode !== 'chase') {
          c.mode = 'chase';
          c.acts = [];
          c.path = [];
          c.sus = 1;
          if (this.clock - c.heardT > 3) {
            c.heardT = this.clock;
            audio.sfx('radio_static', 0.3);
          }
        }
        continue;
      }
      if (c.mode !== 'task' || this.clock - c.heardT < 3) continue;
      c.heardT = this.clock;
      // somewhere to go and look: not where you are, just where it came from
      const at = this.nearestNode({ x, z, f: lvl, well: this.me.well, seg: this.me.seg, h: this.me.h });
      if (!at) continue;
      c.acts = [{ k: 'go', n: at, pace: HURRY }, { k: 'look', t: 1.6 + Math.random() }];
      const rm = this.b!.roomAt(lvl, x, z) ?? this.roomNear(lvl, x, z, 4);
      if (rm) {
        this.heatAt(rm, 0.8);
        c.acts.push({ k: 'search', room: rm });
      }
      c.path = [];
      void kind;
    }
  }

  private heatAt(rm: Room, k: number): void {
    this.heat.set(rm.id, Math.max(this.heat.get(rm.id) ?? 0, k));
  }

  private roomNear(f: number, x: number, z: number, within: number): Room | null {
    let best: Room | null = null;
    let bd = within;
    for (const r of this.b!.floors[f]?.rooms ?? []) {
      if (!r.open || r.special !== 'none') continue;
      const d = Math.hypot(x - r.side * (CH + 0.5), z - r.dz);
      if (d < bd) {
        bd = d;
        best = r;
      }
    }
    return best;
  }

  // ===================================================================== the police

  private nearestNode(m: Mover): NavNode | null {
    const b = this.b!;
    let best: NavNode | null = null;
    let bd = Infinity;
    let bestClear: NavNode | null = null;
    let bdc = Infinity;
    const segs = m.well ? [] : this.segsCache(m.f, false);
    for (const n of b.nodes) {
      if (m.well) {
        if (n.zone !== 'well' || Math.abs(n.y - m.h) > 1.7) continue;
      } else {
        if (n.zone === 'well' || n.f !== m.f) continue;
      }
      const d = Math.hypot(n.x - m.x, n.z - m.z) + (m.well ? Math.abs(n.y - m.h) : 0);
      if (d < bd) {
        bd = d;
        best = n;
      }
      if (d < bdc && (m.well || !segs.some((s) => segHit(m.x, m.z, n.x, n.z, s) !== null))) {
        bdc = d;
        bestClear = n;
      }
    }
    return bestClear ?? best;
  }

  private route(from: NavNode, to: NavNode): NavNode[] {
    const b = this.b!;
    const dist = new Map<number, number>();
    const prev = new Map<number, NavNode>();
    const open: NavNode[] = [from];
    dist.set(from.id, 0);
    const seen = new Set<number>();
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if ((dist.get(open[i].id) ?? Infinity) < (dist.get(open[bi].id) ?? Infinity)) bi = i;
      const n = open.splice(bi, 1)[0];
      if (n === to) break;
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      for (const e of n.edges) {
        // never through a locked flat; the lobby door is theirs
        if (e.door && e.door.locked && e.door.kind !== 'stair') continue;
        const nd = (dist.get(n.id) ?? 0) + e.cost;
        if (nd < (dist.get(e.to.id) ?? Infinity)) {
          dist.set(e.to.id, nd);
          prev.set(e.to.id, n);
          open.push(e.to);
        }
      }
    }
    if (!prev.has(to.id) && from !== to) return [];
    const out: NavNode[] = [to];
    let cur = to;
    while (cur !== from) {
      const p = prev.get(cur.id);
      if (!p) break;
      out.unshift(p);
      cur = p;
    }
    void b;
    return out;
  }

  private edgeDoor(a: NavNode, c: NavNode): Door | null {
    return a.edges.find((e) => e.to === c)?.door ?? null;
  }

  /** A floor's worth of work for one officer: up to it, along it, into some of its flats. */
  private sweepFloor(c: Cop, f: number, here = false, pace?: number): void {
    const b = this.b!;
    c.floorGoal = f;
    if (!here) c.acts.push({ k: 'go', n: b.stairOut[f], pace });
    const spine = b.corridor[f].slice(2);
    const rooms = b.floors[f].rooms.filter((r) => r.open && r.special === 'none').sort((p, q) => p.dz - q.dz);
    // from the near end or the far end, whichever is nearer
    const fromFar = here && c.m.z > (spine[0].z + spine[spine.length - 1].z) / 2;
    const ordered = fromFar ? [...rooms].reverse() : rooms;
    // (a flat another officer already has on his list is his: not two at one door)
    const theirs = new Set<Room>();
    for (const o of this.cops) if (o !== c) for (const a of o.acts) if (a.k === 'search') theirs.add(a.room);
    for (const rm of ordered) {
      if (rm.outside) c.acts.push({ k: 'go', n: rm.outside });
      if (theirs.has(rm)) continue;
      const recent = this.clock - rm.searchedAt < 50;
      const heat = this.heat.get(rm.id) ?? 0;
      const p = (recent ? 0.15 : 0.5) + heat * 0.5;
      if (Math.random() < p) c.acts.push({ k: 'search', room: rm });
      else if (Math.random() < 0.3) c.acts.push({ k: 'look', t: 0.8 + Math.random() * 1.2 });
    }
    c.acts.push({ k: 'go', n: fromFar ? spine[0] : spine[spine.length - 1] });
    c.acts.push({ k: 'look', t: 1 + Math.random() * 1.5 });
    if (Math.random() < 0.6) c.acts.push({ k: 'go', n: b.stairOut[f] });
  }

  /** Which floor next: not the one another is on, more and more often near you. */
  private pickFloor(c: Cop): number {
    const lvl = this.levelOf(this.me);
    const w: number[] = [];
    for (let f = 1; f <= TOP; f++) {
      let k = 1;
      if (this.cops.some((o) => o !== c && o.floorGoal === f)) k *= 0.2;
      if (Math.abs(f - lvl) <= 1) k *= 1 + 2.5 * this.pressure;
      if (f === lvl) k *= 1 + this.pressure;
      if (f === c.lastFloor) k *= 0.35;
      // (his own floor, more than the others: each of them keeps a part of the building)
      if (f === c.home) k *= 2;
      w.push(k);
    }
    let roll = Math.random() * w.reduce((a, x) => a + x, 0);
    for (let i = 0; i < w.length; i++) {
      roll -= w[i];
      if (roll <= 0) return i + 1;
    }
    return 1 + Math.floor(Math.random() * TOP);
  }

  private expandSearch(c: Cop, rm: Room): Act[] {
    const out: Act[] = [];
    if (rm.center) out.push({ k: 'go', n: rm.center });
    out.push({ k: 'look', t: 1 + Math.random() * 1.2 });
    const heat = this.heat.get(rm.id) ?? 0;
    const spots = [...rm.spots].sort(() => Math.random() - 0.5);
    for (const sp of spots) {
      if (!sp.node) continue;
      // (you have been in there a long time: the longer, the likelier)
      const camping = this.hide?.spot === sp ? Math.min(0.4, this.hide.since / 90) : 0;
      // (one he or another opened not long ago: less likely, unless there is reason)
      const fresh = sp.inspectedAt !== undefined && this.clock - sp.inspectedAt < 45 ? 0.35 : 1;
      const p = clamp((0.28 + heat * 0.45) * (heat > 0.5 ? 1 : fresh) + camping, 0, 0.95);
      if (Math.random() < p) {
        out.push({ k: 'go', n: sp.node });
        out.push({ k: 'inspect', spot: sp });
      }
    }
    rm.searchedAt = this.clock;
    if (rm.nodes[0]) out.push({ k: 'go', n: rm.nodes[0] });
    void c;
    return out;
  }

  /**
   * The pace an officer actually goes at, for a pace asked for: double your
   * run on the way in to his floor, and then 1.4 times you -- your walk for
   * the unhurried and the hurried, your run for anything at a chase.
   */
  private copPace(c: Cop, asked: number): number {
    if (!c.arrived) return EN_ROUTE;
    return asked >= CHASE * 0.8 ? ON_FLOOR_RUN : ON_FLOOR_WALK;
  }

  private copFrame(c: Cop, dt: number): void {
    // there: his own floor reached, or you seen (a chase is a chase, not a sprint in)
    if (!c.arrived && !c.inLobby && ((!c.m.well && c.m.f === c.home) || c.mode === 'chase' || c.mode === 'alert')) c.arrived = true;
    c.st.reach = 0;
    c.st.point = 0;
    c.st.shout = Math.max(0, c.st.shout - dt * 1.5);
    c.st.crouch = 0;
    c.st.grab = 0;
    c.st.run = false;
    c.speedNow = 0;
    // ---- at the front doors, waiting to come in
    if (c.inLobby) {
      c.t += dt;
      const a = c.acts[0];
      // (a torch going over the floor in front of him while he waits)
      c.st.aimYaw = Math.sin(c.t * 0.9 + c.i * 2) * 0.5;
      c.st.aimPitch = -0.45;
      if (a?.k === 'look' && c.t < a.t) return;
      this.comeIn(c);
    }
    // ---- seeing you
    if (c.mode === 'task' || c.mode === 'lost') this.watch(c, dt);
    if (c.mode === 'alert') {
      c.alertT += dt;
      c.st.point = 1;
      c.st.shout = 1;
      this.faceToward(c, this.me.x, this.me.z, dt, 10);
      if (c.alertT > ALERT_S) {
        c.mode = 'chase';
        c.lostT = 0;
      }
      return;
    }
    if (c.mode === 'chase') return this.chase(c, dt);
    // ---- something half-seen: stop, turn to it, look properly
    if (c.mode === 'task' && c.sus > 0.35 && this.phase === 'play' && !this.hide) {
      this.faceToward(c, this.me.x, this.me.z, dt, 3);
      c.st.aimYaw *= 0.8;
      return;
    }
    // ---- the work in hand
    const a = c.acts[0];
    if (!a) {
      c.lastFloor = c.floorGoal;
      const f = this.pickFloor(c);
      this.sweepFloor(c, f, f === this.levelOf(c.m) && !c.m.well);
      return;
    }
    if (a.k === 'go') {
      if (this.walk(c, a.n, a.pace ?? (c.mode === 'lost' ? HURRY : PATROL), dt)) {
        c.acts.shift();
        c.path = [];
      }
      return;
    }
    if (a.k === 'look') {
      c.t += dt;
      // a slow look round, the torch going with it
      c.st.aimYaw = Math.sin(c.t * 1.3 + c.i) * 0.9;
      c.st.aimPitch = -0.08 + Math.sin(c.t * 0.7) * 0.1;
      if (c.t > a.t) {
        c.t = 0;
        c.acts.shift();
        if (c.mode === 'lost' && !c.acts.length) c.mode = 'task';
      }
      return;
    }
    if (a.k === 'search') {
      c.acts.shift();
      c.acts.unshift(...this.expandSearch(c, a.room));
      return;
    }
    if (a.k === 'inspect') return this.inspect(c, a.spot, dt);
  }

  /**
   * Walk toward a node along the network, opening doors on the way and
   * leaving them open.  True when there.
   */
  private walk(c: Cop, goal: NavNode, pace: number, dt: number): boolean {
    pace = this.copPace(c, pace);
    if (c.pathTo !== goal || !c.path.length) {
      const from = this.nearestNode(c.m);
      if (!from) return true;
      c.path = this.route(from, goal);
      c.pathI = 0;
      c.pathTo = goal;
      if (!c.path.length) return true;
    }
    // a door in the way: stop, reach, open it, go on
    if (c.waitDoor) {
      const wd = c.waitDoor;
      c.st.reach = 1;
      c.waitT += dt;
      // (after you, he goes through as soon as there is room for him)
      const enough = c.mode === 'chase' ? 0.56 : 0.7;
      if (wd.k > enough || c.waitT > 2.5) {
        c.waitDoor = null;
        c.waitT = 0;
      } else {
        // STOOD IN ITS WAY.  A leaf stops against whoever it would swing
        // into -- him, there with his hand on it -- and he waited it out.
        // Not moving while it should be: a step back, away from the hinge.
        if (wd.want > wd.k && c.waitT > 0.25 && wd.k - (c.waitK ?? -1) < 0.002) {
          const ax = c.m.x - wd.hx;
          const az = c.m.z - wd.hz;
          const al = Math.hypot(ax, az) || 1;
          this.step(c.m, c.m.x + (ax / al) * 1.2 * dt, c.m.z + (az / al) * 1.2 * dt, R_COP, 'cop', false);
        }
        c.waitK = wd.k;
        return false;
      }
    }
    const n = c.path[c.pathI];
    if (!n) return true;
    const prev = c.path[c.pathI - 1];
    if (prev) {
      const d = this.edgeDoor(prev, n);
      if (d && d.k < (c.mode === 'chase' ? 0.56 : 0.7) && d.pivot.visible) {
        if (d.want < 1) {
          d.want = 1;
          d.by = 'officer';
          this.sfxAt('door_handle', new THREE.Vector3(d.hx, d.floor * FH + 1, d.hz), 0.6);
        }
        c.waitDoor = d;
        c.waitT = 0;
        this.faceToward(c, n.x, n.z, dt, 6);
        return false;
      }
    }
    // keep apart: if another officer is right in front, give him a moment
    for (const o of this.cops) {
      if (o === c || o.i > c.i) continue;
      if (Math.abs(o.m.h - c.m.h) < 1 && Math.hypot(o.m.x - c.m.x, o.m.z - c.m.z) < 0.9) {
        c.stuckT += dt;
        if (c.stuckT < 1.2) return false;
      }
    }
    const dx = n.x - c.m.x;
    const dz = n.z - c.m.z;
    const d = Math.hypot(dx, dz) + (c.m.well ? Math.abs(n.y - c.m.h) * 0.3 : 0);
    if (d < 0.25) {
      c.pathI++;
      return c.pathI >= c.path.length;
    }
    const s = Math.min(Math.hypot(dx, dz), pace * dt);
    const before = { x: c.m.x, z: c.m.z };
    // (in small steps at a run: a stride that size goes through a wall)
    const n2 = Math.max(1, Math.ceil(s / 0.12));
    for (let k = 0; k < n2; k++) this.step(c.m, c.m.x + (dx / Math.hypot(dx, dz)) * (s / n2), c.m.z + (dz / Math.hypot(dx, dz)) * (s / n2), R_COP, 'cop', false);
    const moved = Math.hypot(c.m.x - before.x, c.m.z - before.z);
    c.speedNow = moved / Math.max(dt, 1e-4);
    c.st.run = pace > 3;
    this.faceToward(c, n.x, n.z, dt, pace > 3 ? 9 : 5);
    // aim ahead, a little down, as you would walking with a torch
    c.st.aimYaw *= 0.9;
    c.st.aimPitch = -0.12;
    // stuck on something: skip ahead, and if that does not help, start over
    if (moved < pace * dt * 0.2) {
      c.stuckT += dt;
      // a shuffle to one side first: round the corner of whatever it is
      if (c.stuckT > 0.6) {
        const ux = dx / Math.hypot(dx, dz);
        const uz = dz / Math.hypot(dx, dz);
        const side = c.i % 2 ? 1 : -1;
        this.step(c.m, c.m.x - uz * side * pace * dt, c.m.z + ux * side * pace * dt, R_COP, 'cop', false);
      }
      if (c.stuckT > 1.5) {
        c.stuckT = 0;
        c.pathI++;
        if (c.pathI >= c.path.length) {
          c.path = [];
          return true;
        }
      }
    } else c.stuckT = Math.max(0, c.stuckT - dt);
    return false;
  }

  private faceToward(c: Cop, x: number, z: number, dt: number, rate: number): void {
    const want = Math.atan2(x - c.m.x, z - c.m.z);
    c.yaw += wrap(want - c.yaw) * Math.min(1, dt * rate);
  }

  /** Searching a hiding place: the right move for what it is, and you, if you are in it. */
  private inspect(c: Cop, sp: HideSpot, dt: number): void {
    c.t += dt;
    sp.inspectedAt = this.clock;
    this.faceToward(c, sp.inspectAt.x, sp.inspectAt.z, dt, 6);
    const eye = this.eyeOf(c.m, 1.7);
    const dy = sp.inspectAt.y - eye.y;
    const dh = Math.hypot(sp.inspectAt.x - eye.x, sp.inspectAt.z - eye.z);
    c.st.aimYaw = 0;
    c.st.aimPitch = Math.atan2(dy, Math.max(0.3, dh));
    if (sp.crouch) c.st.crouch = Math.min(1, c.t / 0.5);
    else c.st.reach = c.t < 1.2 ? 1 : 0.3;
    if (c.t > 0.35 && c.t - dt <= 0.35) {
      if (sp.kind === 'wardrobe') {
        sp.setOpen(1);
        this.sfxAt('wardrobe', eye, 0.7);
      } else if (sp.kind === 'curtain') {
        sp.setOpen(1);
        this.sfxAt('curtain', eye, 0.8);
      } else if (sp.kind === 'door' && sp.door) {
        sp.door.want = 1;
        this.sfxAt('door_handle', eye, 0.5);
      }
    }
    // found
    if (c.t > 0.8 && this.hide?.spot === sp && !this.hide.leaving) {
      this.caught(c);
      return;
    }
    if (c.t > (sp.crouch ? 2.2 : 1.8)) {
      c.t = 0;
      c.acts.shift();
    }
  }

  /** Can this officer see that point, with nothing solid in between? */
  private sightLine(c: Cop, tx: number, tz: number, th: number, low: boolean): boolean {
    const eye = this.eyeOf(c.m, 1.7);
    if (Math.abs(c.m.h - (th - (low ? EYE_LOW : EYE))) > 1.7) return false;
    const lvl = this.levelOf(c.m);
    const segs = this.segsCache(lvl, true);
    for (const s of segs) if (segHit(eye.x, eye.z, tx, tz, s) !== null) return false;
    // (in the well, the flights and slabs between levels are the height test above)
    const boxes = this.b!.floors[lvl]?.boxes ?? [];
    for (const bx of boxes) {
      const blocks = bx.h >= 1.4 || (low && bx.h >= 0.6);
      if (blocks && boxHit(eye.x, eye.z, tx, tz, bx)) {
        // (a box you are standing right beside does not hide you from over it)
        return false;
      }
    }
    return true;
  }

  private inBeam(c: Cop, p: THREE.Vector3): boolean {
    const { pos, dir } = c.model.torchRay();
    const v = p.clone().sub(pos);
    const d = v.length();
    if (d > c.st.beamLen + 0.5) return false;
    return v.normalize().dot(dir) > Math.cos(BEAM_ANGLE);
  }

  private watch(c: Cop, dt: number): void {
    c.sus = Math.max(0, c.sus - dt * 0.35);
    if (this.phase !== 'play') return;
    const h = this.hide;
    const me = this.me;
    const low = this.crouch;
    const target = h ? new THREE.Vector3(h.spot.eye.x, h.spot.eye.y, h.spot.eye.z) : this.eyeOf(me, this.eyeNow);
    const eye = this.eyeOf(c.m, 1.7);
    const v = target.clone().sub(eye);
    const d = Math.hypot(v.x, v.z);
    if (h) {
      // hidden: only a close look straight at a peeking face gives you away
      if (!h.peek || d > 3.2 || h.spot.floor !== this.levelOf(c.m)) return;
      const ang = Math.abs(wrap(Math.atan2(v.x, v.z) - (c.yaw + c.st.aimYaw)));
      if (ang > 0.5 || !this.inBeam(c, target)) return;
      c.sus += dt * 0.9;
      if (c.sus >= 1) this.caught(c);
      return;
    }
    if (d > (low ? SIGHT_LOW : SIGHT) + (this.inBeam(c, target) ? 3 : 0)) return;
    const ang = Math.abs(wrap(Math.atan2(v.x, v.z) - (c.yaw + c.st.aimYaw * 0.65)));
    if (ang > FOV_H && d > 1.2) return;
    if (Math.abs(Math.atan2(v.y, Math.max(0.1, d))) > FOV_V) return;
    if (!this.sightLine(c, target.x, target.z, target.y, low)) return;
    const near = d < 3 ? 2.2 : d < 7 ? 1.3 : 0.7;
    const rate = near * (this.inBeam(c, target) ? 1.8 : 1) * (low ? 0.5 : 1) * (this.moving ? 1.2 : 0.75);
    c.sus += rate * dt * 1.4;
    if (c.sus > 0.3) {
      // a second look: the head and the torch turn your way
      const rel = wrap(Math.atan2(v.x, v.z) - c.yaw);
      c.st.aimYaw += (clamp(rel, -1.2, 1.2) - c.st.aimYaw) * Math.min(1, dt * 4);
    }
    if (c.sus >= 1) this.spotted(c);
  }

  /**
   * Does this officer have you in sight right now -- after you, a moment
   * ago (`lostT`), or simply looking your way with nothing in between?
   * (For going into a hiding place in front of him: see `enterSpot`.)
   */
  private seesYouNow(c: Cop): boolean {
    if (c.inLobby || c.mode === 'arrest' || c.mode === 'scripted') return false;
    const me = this.me;
    if (this.levelOf(c.m) !== this.levelOf(me) || Math.abs(c.m.h - me.h) > 1.7) return false;
    const target = this.eyeOf(me, this.eyeNow);
    const ok = this.sightLine(c, target.x, target.z, target.y, this.crouch);
    if (!ok) return false;
    // after you and only just out of sight, or still on you: he saw that
    if (c.mode === 'chase' || c.mode === 'alert') return true;
    const eye = this.eyeOf(c.m, 1.7);
    const v = target.clone().sub(eye);
    const d = Math.hypot(v.x, v.z);
    if (d > (this.crouch ? SIGHT_LOW : SIGHT) + (this.inBeam(c, target) ? 3 : 0)) return false;
    const ang = Math.abs(wrap(Math.atan2(v.x, v.z) - (c.yaw + c.st.aimYaw * 0.65)));
    // (right behind him, he knows: a step or two away is not out of sight)
    return ang <= FOV_H || d < NEAR_SENSE;
  }

  private spotted(c: Cop): void {
    c.mode = 'alert';
    c.alertT = 0;
    c.sus = 1;
    c.lkp = { x: this.me.x, z: this.me.z, f: this.me.f, well: this.me.well, h: this.me.h };
    this.sfxAt('police_shout', this.eyeOf(c.m, 1.7), 1);
    // (a shout cuts in over whatever was being said)
    this.lines = [];
    this.say(['POLICE! DON\'T MOVE!', 'STOP RIGHT THERE!', 'HEY! YOU! FREEZE!'][c.i % 3], 1.6, true);
    // the radio: the others come
    this.time.delayedCall(500, () => {
      audio.sfx('radio_static', 0.45);
      // (the radio is heard, not read: the shout already said it)
      const lvl = this.levelOf(this.me);
      const b = this.b!;
      let first = true;
      for (const o of this.cops) {
        if (o === c || o.mode === 'chase' || o.mode === 'alert' || o.inLobby) continue;
        // one heads for the stairs on that floor to cut you off; the others to where you were
        const where = this.nearestNode({ x: this.me.x, z: this.me.z, f: lvl, well: this.me.well, seg: this.me.seg, h: this.me.h });
        o.acts = first && lvl >= 1 ? [{ k: 'go', n: b.landing[lvl], pace: HURRY }, { k: 'look', t: 3 }] : where ? [{ k: 'go', n: where, pace: HURRY }, { k: 'look', t: 2 }] : [];
        o.path = [];
        o.mode = 'lost';
        first = false;
      }
    });
    this.pressure = Math.min(1, this.pressure + 0.2);
  }

  private chase(c: Cop, dt: number): void {
    const me = this.me;
    const visible = this.phase === 'play' && !this.hide && this.sightLine(c, me.x, me.z, me.h + this.eyeNow, this.crouch) && Math.abs(c.m.h - me.h) < 1.7;
    c.st.run = true;
    if (visible) {
      c.lkp = { x: me.x, z: me.z, f: me.f, well: me.well, h: me.h };
      c.lostT = 0;
      const sameZone = c.m.well === me.well && (c.m.well || c.m.f === me.f);
      c.detourT = Math.max(0, c.detourT - dt);
      /** Straight at you, as on a floor: the stairs' own shape takes him up or down them. */
      const closeIn = (): void => {
        // (both in the well: by the flights, not across the gap between them)
        const aim = c.m.well && me.well ? wellAim(c.m.f, c.m.seg, me.f, me.seg, me.x, me.z) : me;
        const dx = aim.x - c.m.x;
        const dz = aim.z - c.m.z;
        const d = Math.hypot(dx, dz) || 1e-4;
        const s = Math.min(d, this.copPace(c, CHASE) * dt);
        const before = { x: c.m.x, z: c.m.z };
        const n2 = Math.max(1, Math.ceil(s / 0.12));
        for (let k = 0; k < n2; k++) this.step(c.m, c.m.x + (dx / d) * (s / n2), c.m.z + (dz / d) * (s / n2), R_COP, 'cop', true);
        const moved = Math.hypot(c.m.x - before.x, c.m.z - before.z);
        c.speedNow = moved / Math.max(dt, 1e-4);
        this.faceToward(c, me.x, me.z, dt, 10);
        // pressed up against a bed or a wardrobe between you: go round it
        // by the way through the flat instead of running on the spot
        if (d > CATCH && moved < s * 0.25) {
          c.stuckT += dt;
          if (c.stuckT > 0.45) {
            c.stuckT = 0;
            c.detourT = 1.6;
            c.path = [];
          }
        } else c.stuckT = Math.max(0, c.stuckT - dt);
      };
      if (sameZone && !c.m.well && c.detourT <= 0) {
        closeIn();
      } else {
        const goal = this.nearestNode(me);
        if (goal && (c.pathTo !== goal || this.clock % 0.5 < dt)) c.path = [];
        const there = goal ? this.walk(c, goal, CHASE, dt) : true;
        // AT THE NODE NEAREST YOU, AND YOU ARE NOT THERE.  In the well the
        // nodes are the landings: you a few steps up the flight from one, and
        // him on it, the route was done and he stood there for good.  The last
        // stretch is straight at you.
        const near = Math.hypot(me.x - c.m.x, me.z - c.m.z) < 4.5 && Math.abs(me.h - c.m.h) < 2.4;
        if (there && near && (sameZone || c.m.well || me.well) && c.detourT <= 0) closeIn();
      }
      c.st.aimYaw = 0;
      c.st.aimPitch = Math.atan2(me.h + this.eyeNow - (c.m.h + 1.7), Math.max(0.5, Math.hypot(me.x - c.m.x, me.z - c.m.z)));
    } else {
      // (working a door open after you is still after you)
      if (!c.waitDoor) c.lostT += dt;
      // OUT OF SIGHT IS NOT GONE.  For the first moments after he loses
      // sight of you -- round a corner, through a door you shut behind you,
      // a juke past him -- he still knows where you went: he keeps after
      // where you are, not where you were.  Hidden, you are not followed.
      if (c.lostT < LKP_BUFFER && !this.hide && this.phase === 'play') c.lkp = { x: me.x, z: me.z, f: me.f, well: me.well, h: me.h };
      const l = c.lkp;
      if (l) {
        const goal = this.nearestNode({ x: l.x, z: l.z, f: l.f, well: l.well, seg: 'top', h: l.h });
        const arrived = goal ? this.walk(c, goal, CHASE * 0.85, dt) : true;
        if (arrived || c.lostT > 6) {
          // gone: look round where you were, and then the flats nearby
          c.mode = 'lost';
          c.path = [];
          c.acts = [{ k: 'look', t: 2.4 }];
          const lvl = l.well ? Math.round(l.h / FH) : l.f;
          const rm = this.b!.roomAt(lvl, l.x, l.z) ?? this.roomNear(lvl, l.x, l.z, 6);
          if (rm) {
            this.heatAt(rm, 1);
            c.acts.push({ k: 'search', room: rm });
          }
          const other = this.roomNear(lvl, l.x + (Math.random() - 0.5) * 6, l.z + (Math.random() - 0.5) * 6, 8);
          if (other && other !== rm) {
            this.heatAt(other, 0.6);
            c.acts.push({ k: 'search', room: other });
          }
          audio.sfx('radio_static', 0.3);
        }
      } else c.mode = 'task';
    }
    // caught
    const d = Math.hypot(me.x - c.m.x, me.z - c.m.z);
    if (this.phase === 'play' && !this.hide && d < CATCH && Math.abs(c.m.h - me.h) < 1) this.caught(c);
  }

  /** Pose the rig, aim the torch, cut the beam at what it hits, and gate its light. */
  private poseCop(c: Cop, dt: number): void {
    const m = c.model;
    m.setPose(c.m.x, c.m.h, c.m.z, c.yaw);
    c.st.speed = c.speedNow;
    // where the beam stops: the first wall it meets, or the floor
    const { pos, dir } = m.torchRay();
    const lvl = this.levelOf(c.m);
    const segs = this.segsCache(lvl, true);
    let len = 9;
    const far = { x: pos.x + dir.x * 9, z: pos.z + dir.z * 9 };
    for (const s of segs) {
      const t = segHit(pos.x, pos.z, far.x, far.z, s);
      if (t !== null) len = Math.min(len, t * 9);
    }
    if (dir.y < -0.02) len = Math.min(len, (pos.y - c.m.h) / -dir.y);
    // ...or the ceiling: aimed up (at you in the window, say) the cone ran on
    // up through it and showed as a white wedge across the top of the picture
    if (dir.y > 0.02 && !c.m.well) len = Math.min(len, Math.max(0.2, (c.m.f * FH + CEIL - 0.02 - pos.y) / dir.y));
    // (eased, so a beam swinging past a door frame does not jump in length)
    c.st.beamLen += (len - c.st.beamLen) * Math.min(1, dt * 14);
    // what you can see of his light from where you are (see `zoneSees`)
    // (in the cinematic, all three are in the room with you, lit)
    const vis = this.phase === 'cinema' ? 1 : this.zoneSees(c);
    c.st.torch += (vis - c.st.torch) * Math.min(1, dt * 3.5);
    c.st.lights = c.st.torch;
    m.update(dt, c.st);
    // the light under a shut door, when his torch is behind it
    const rm = c.m.well ? null : this.b!.roomAt(c.m.f, c.m.x, c.m.z);
    if (rm && rm.door.k < 0.15) rm.gapK = Math.max(rm.gapK, 0.9);
    // the radio on his chest, now and then
    c.radioT -= dt;
    if (c.radioT <= 0) {
      c.radioT = 9 + Math.random() * 10;
      this.sfxAt('police_radio', this.eyeOf(c.m, 1.4), 0.55);
    }
  }

  /**
   * How much of an officer's light reaches the part of the building you are
   * in: all of it in the same part, through an open door, or up and down
   * the well; none through a shut door or a floor.
   */
  private zoneSees(c: Cop): number {
    if (this.phase === 'caught' || this.phase === 'cinema') return 1;
    const me = this.me;
    const b = this.b!;
    const lvlC = this.levelOf(c.m);
    const lvlM = this.levelOf(me);
    if (c.m.well && me.well) return Math.abs(c.m.h - me.h) < 3.5 ? 1 : 0;
    if (c.m.well !== me.well) {
      const f = c.m.well ? lvlM : lvlC;
      const other = c.m.well ? c : null;
      void other;
      const near = Math.abs((c.m.well ? c.m.h : me.h) - f * FH) < 2;
      return (lvlC === lvlM || near) && b.stairDoors[f]?.k > 0.08 ? 1 : 0;
    }
    if (c.m.f !== me.f) return 0;
    const rc = b.roomAt(c.m.f, c.m.x, c.m.z);
    const rm = b.roomAt(me.f, me.x, me.z);
    if (rc === rm) return 1;
    const through = (r: Room | null): boolean => !r || r.door.k > 0.12 || !r.door.pivot.visible;
    return through(rc) && through(rm) ? 1 : 0;
  }

  // ===================================================================== doors

  private animateDoors(dt: number): void {
    const b = this.b!;
    for (const r of b.rooms) r.gapK = 0;
    for (const d of b.doors) {
      if (Math.abs(d.want - d.k) < 0.001) continue;
      const was = d.k;
      const next = d.k + Math.sign(d.want - d.k) * Math.min(Math.abs(d.want - d.k), dt * 1.8);
      // never through somebody: a leaf that would sweep into a body stops
      const test = { ...d, k: next } as Door;
      const leaf = PoliceBuilding.leaf(test);
      // (one an officer is opening, he shoulders through: it does not stop
      // against him, or the man stood at it waits for good)
      const bodies: Array<{ x: number; z: number; f: number; well: boolean }> = d.by === 'officer' && d.want > d.k ? [this.me] : [this.me, ...this.cops.map((c) => c.m)];
      const hit = bodies.some((m) => {
        if (m.well !== (d.kind === 'stair' && false) && d.kind !== 'stair' && m.well) return false;
        if (this.levelOf(m as Mover) !== d.floor) return false;
        const sx = leaf.x1 - leaf.x0;
        const sz = leaf.z1 - leaf.z0;
        const t = clamp(((m.x - leaf.x0) * sx + (m.z - leaf.z0) * sz) / (sx * sx + sz * sz), 0, 1);
        return Math.hypot(m.x - (leaf.x0 + sx * t), m.z - (leaf.z0 + sz * t)) < 0.22;
      });
      if (hit && d.kind !== 'stair') continue;
      d.k = next;
      if (was < 0.02 && d.k >= 0.02) this.sfxAt(d.kind === 'stair' ? 'door_open' : 'door_creak', new THREE.Vector3(d.hx, d.floor * FH + 1, d.hz), 0.5);
      if (was > 0.05 && d.k <= 0.05 && d.want === 0) this.sfxAt('door_shut', new THREE.Vector3(d.hx, d.floor * FH + 1, d.hz), 0.6);
      b.poseDoor(d);
    }
    this.segCache.clear();
  }

  // ===================================================================== sound

  /** A sound from a place: quieter with distance and with every floor between, panned, dulled behind. */
  private sfxAt(name: SfxName, at: THREE.Vector3, gain: number): void {
    const cam = this.stage?.camera;
    if (!cam) return;
    const v = at.clone().sub(cam.position);
    const floors = Math.abs(Math.round(at.y / FH) - Math.round((this.me.h + 0.5) / FH));
    const d = v.length();
    const g = gain * clamp(1.2 - d / 18, 0, 1) * Math.pow(0.4, floors);
    if (g < 0.02) return;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const flat = new THREE.Vector3(v.x, 0, v.z).normalize();
    audio.sfx(name, g, { pan: clamp(flat.dot(right), -1, 1) * 0.8, behind: clamp(-flat.dot(fwd), 0, 1) });
  }

  private ambience(dt: number): void {
    this.sirenT -= dt;
    if (this.sirenT <= 0) {
      this.sirenT = 8 + Math.random() * 7;
      audio.sfx('siren', 0.12);
    }
    // the longer you go, the harder they look near you
    this.pressure = Math.min(1, this.pressure + dt * 0.004);
    for (const [k, v] of this.heat) this.heat.set(k, Math.max(0, v - dt * 0.02));
  }

  // ===================================================================== the view

  private updateCamera(dt: number): void {
    const cam = this.stage!.camera;
    cam.rotation.order = 'YXZ';
    const h = this.hide;
    if (h) {
      const sp = h.spot;
      // from where you stood, into the spot; and peeking, to the gap
      const stand = new THREE.Vector3(sp.approach.x, sp.floor * FH + EYE, sp.approach.z);
      const eye = new THREE.Vector3(sp.eye.x, sp.eye.y, sp.eye.z).lerp(new THREE.Vector3(sp.peekEye.x, sp.peekEye.y, sp.peekEye.z), h.peekK);
      const look = new THREE.Vector3(sp.look.x, sp.look.y, sp.look.z).lerp(new THREE.Vector3(sp.peekLook.x, sp.peekLook.y, sp.peekLook.z), h.peekK);
      const k = h.k * h.k * (3 - 2 * h.k);
      // (the bed: down low first, then under)
      const mid = sp.kind === 'bed' ? new THREE.Vector3(stand.x, sp.eye.y + 0.25, stand.z) : stand;
      const p = k < 0.5 ? stand.clone().lerp(mid, k * 2) : mid.clone().lerp(eye, (k - 0.5) * 2);
      cam.position.copy(p);
      const yawIn = Math.atan2(-(look.x - eye.x), -(look.z - eye.z)) + h.lookYaw;
      const pitchIn = Math.atan2(look.y - eye.y, Math.hypot(look.x - eye.x, look.z - eye.z)) + h.lookPitch;
      const yaw = this.yaw + wrap(yawIn - this.yaw) * k;
      cam.rotation.set(this.pitch + (pitchIn - this.pitch) * k, yaw, 0);
      const fov = 72 + (sp.peekFov - 72) * h.peekK;
      if (Math.abs(cam.fov - fov) > 0.1) {
        cam.fov = fov;
        cam.updateProjectionMatrix();
      }
      return;
    }
    const amp = this.moving ? (this.running ? 0.06 : 0.03) : 0;
    const bob = Math.sin(this.bobT * Math.PI * 2 * 1.6) * amp;
    cam.position.set(this.me.x, this.me.h + this.eyeNow + bob, this.me.z);
    cam.rotation.set(this.pitch, this.yaw, 0);
    if (Math.abs(cam.fov - 72) > 0.1) {
      cam.fov += (72 - cam.fov) * Math.min(1, dt * 4);
      cam.updateProjectionMatrix();
    }
  }

  /** Only what can be seen is drawn: your floor, the well, the one through an open fire door. */
  private lightsAndVisibility(dt: number): void {
    const b = this.b!;
    const me = this.me;
    const lvl = this.phase === 'cinema' ? TOP : this.levelOf(me);
    for (const fl of b.floors) {
      let on = fl.f === lvl && (!me.well || b.stairDoors[fl.f].k > 0.05 || Math.abs(me.h - fl.f * FH) < 0.5);
      if (me.well && Math.abs(me.h - fl.f * FH) < 2.4 && b.stairDoors[fl.f].k > 0.05) on = true;
      if (!me.well && fl.f === me.f) on = true;
      fl.group.visible = on;
    }
    // THE TORCHES' SHADOWS, WHERE THEY COST.  Each one is the whole scene drawn
    // again from his lens; three of them every frame was most of the frame.
    // The nearest officer's is drawn every frame, the others' in turn, one
    // frame in four -- a far one's shadow lags a moment, which nobody sees.
    let nearest: Cop | null = null;
    let nd = Infinity;
    for (const c of this.cops) {
      const d = Math.hypot(c.m.x - me.x, c.m.z - me.z) + Math.abs(c.m.h - me.h) * 2;
      if (d < nd) {
        nd = d;
        nearest = c;
      }
    }
    this.shadowTick = (this.shadowTick + 1) % 4;
    for (const c of this.cops) {
      const sh = c.model.torch.shadow;
      sh.autoUpdate = false;
      sh.needsUpdate = c === nearest || this.shadowTick === c.i + 1;
    }
    // hidden, nearly none of it: what you see is the room's light and theirs
    // (caught, only the light under his face: the room goes dark round it)
    if (this.fill) this.fill.intensity = this.phase === 'caught' ? 0.04 : this.hide ? 0.08 : 0.7;
    // (near the stairs from the corridor, open or shut: the door and its
    // frame are the well's, and a shut one left a black hole where it was)
    b.well.visible = me.well || me.z < 9 || this.phase === 'caught';
    b.exterior.visible = lvl === TOP && (SIDE612 * me.x > CH || this.phase === 'cinema' || this.phase === 'ending');
    // the corridor's lights at the fittings nearest you
    const fl = b.floors[clamp(lvl, 1, TOP)];
    const near = [...fl.lights].sort((p, q) => Math.abs(p.z - me.z) - Math.abs(q.z - me.z));
    this.hallLights.forEach((l, i) => {
      const p = near[i];
      if (p) l.position.copy(p);
      // a little flicker on a fitting that is going
      // (caught: they go down to almost nothing as he gets you, the hall
      // falling away into the dark behind him)
      const caught = this.phase === 'caught' ? 1 - 0.85 * clamp((this.scareT - 0.3) / 0.4, 0, 1) : 1;
      l.intensity = 7 * caught * (i === 2 && Math.sin(this.clock * 23) > 0.93 ? 0.4 : 1) * (me.well && lvl === 0 ? 0 : 1);
    });
    this.wellLight?.position.set(0, me.h + 2.5, -1.5);
    // the light under the doors
    for (const r of b.rooms) {
      const mat = r.gap.material as THREE.MeshBasicMaterial;
      mat.opacity += (r.gapK * (0.6 + 0.4 * Math.sin(this.clock * 9 + r.id)) - mat.opacity) * Math.min(1, dt * 8);
    }
  }

  // ===================================================================== 612

  private check612(): void {
    if (this.phase !== 'play' || this.hide) return;
    const me = this.me;
    if (me.well || me.f !== TOP) return;
    const rm = this.b!.roomAt(TOP, me.x, me.z);
    if (rm?.special === '612' && SIDE612 * me.x > CH + 0.45) this.startCinema();
  }

  private startCinema(): void {
    this.phase = 'cinema';
    this.phaseT = 0;
    this.lines = [];
    this.prompt = '';
    this.objective = '';
    this.crouch = false;
    for (const c of this.cops) {
      c.mode = 'scripted';
      c.acts = [];
      c.path = [];
    }
    this.cine = { t: 0, step: 0, from: new THREE.Vector3(this.me.x, this.me.h + this.eyeNow, this.me.z), yaw0: this.yaw };
    audio.setScene(SILENCE);
    this.say('The window...', 2);
  }

  private cinemaFrame(dt: number): void {
    const cn = this.cine!;
    cn.t += dt;
    const b = this.b!;
    const W = b.window612;
    const cam = this.stage!.camera;
    cam.rotation.order = 'YXZ';
    const y0 = TOP * FH;
    // (612 is on the right of the corridor: its x runs the other way)
    const S = SIDE612;
    const door = b.rooms.find((r) => r.special === '612')!;
    const inside = new THREE.Vector3(S * (CH + 0.9), y0 + EYE, door.dz);
    const mid = new THREE.Vector3((S * (CH + OUTER)) / 2, y0 + EYE, (door.dz + W.z) / 2);
    const sill = new THREE.Vector3(S * (OUTER - 0.5), y0 + EYE, W.z);
    const leanOut = new THREE.Vector3(S * (OUTER + 0.5), y0 + W.sill + 0.7, W.z);
    const outward = new THREE.Vector3(S * (OUTER + 5), 0, W.z);
    const ease = (k: number): number => k * k * (3 - 2 * k);
    const yawTo = (from: THREE.Vector3, to: THREE.Vector3): number => Math.atan2(-(to.x - from.x), -(to.z - from.z));
    // looking out and down at the river, a good way across it
    const downAt = (p: THREE.Vector3): number => -Math.atan2(p.y - WATER_Y, 24);
    const t = cn.t;
    const T = CINE;
    let pos = sill.clone();
    let yaw = cn.yaw0;
    let pitch = 0;
    let roll = 0;
    const bob = (k: number): number => Math.sin(k * Math.PI * 2 * 1.4) * 0.03;
    const at = (when: number): boolean => t - dt < when && t >= when;
    // THE RIVER, HEARD.  From the moment you are at the window it is there
    // under everything -- the rush of fast water six floors down, a churn of
    // white water against the wall -- louder leaning out over it, quieter
    // turned back to the room, and coming up at you, loud, as you fall.
    if (t > T.room + 0.6 && !cn.black) {
      cn.riverT = (cn.riverT ?? 0) - dt;
      if (cn.riverT <= 0) {
        const out = t < T.window ? 0.35 : t < T.hold ? 0.9 : t < T.back ? 0.5 : t < T.jump ? 0.85 : 1.25;
        audio.sfx('river_flow', out);
        audio.sfx('river_rapids', out * (t > T.jump ? 1.1 : 0.7));
        // (faster as you fall: the roar closing in)
        cn.riverT = t > T.jump ? 0.45 : 0.9 + Math.random() * 0.3;
      }
    }
    if (t < T.room) {
      const k = ease(t / T.room);
      pos = cn.from.clone().lerp(inside, k).add(new THREE.Vector3(0, bob(t), 0));
      yaw = cn.yaw0 + wrap(yawTo(inside, sill) - cn.yaw0) * k;
    } else if (t < T.window) {
      const k = ease((t - T.room) / (T.window - T.room));
      pos = k < 0.5 ? inside.clone().lerp(mid, k * 2) : mid.clone().lerp(sill, (k - 0.5) * 2);
      pos.y += bob(t);
      yaw = yawTo(inside, sill) + wrap(yawTo(mid, sill) - yawTo(inside, sill)) * k;
    } else if (t < T.hold) {
      const k = ease(clamp((t - T.window) / (T.down - T.window), 0, 1));
      // leaning out through the hole, over the sill, looking down six floors at the water
      pos = sill.clone().lerp(leanOut, k);
      yaw = yawTo(sill, outward);
      pitch = downAt(pos) * k;
      // (the night thins out so the river can be seen, all the way across)
      const fog = this.stage!.scene.fog as THREE.FogExp2;
      fog.density = 0.045 - 0.035 * k;
      // and the eye goes to it, as it would
      cam.fov = 72 - 10 * k;
      cam.updateProjectionMatrix();
      if (at(T.window + 0.3)) audio.sfx('river_rapids', 0.9);
      if (at(T.window + 0.4)) this.say('Six floors down... the river.', 2.4);
      if (at(T.window + 2.9)) {
        audio.sfx('river_flow', 0.8);
        this.say("It's deep. And it's moving fast.", 2.2);
      }
    } else if (t < T.them) {
      const k = ease(clamp((t - T.hold) / (T.turn - T.hold), 0, 1));
      pos = leanOut.clone().lerp(sill, k);
      (this.stage!.scene.fog as THREE.FogExp2).density = 0.01 + 0.035 * k;
      if (k < 1) {
        cam.fov = 62 + 10 * k;
        cam.updateProjectionMatrix();
      }
      const out = yawTo(sill, outward);
      const back = yawTo(sill, new THREE.Vector3(S * (CH + 0.8), 0, door.dz));
      yaw = out + wrap(back - out) * k;
      pitch = downAt(sill) * (1 - k);
      if (at(T.hold)) this.copsToDoor();
      if (at(T.hold + 0.9)) {
        this.sfxAt('police_shout', new THREE.Vector3(S * (CH + 1), y0 + 1.7, door.dz), 1);
        this.say('POLICE! DON\'T MOVE!', 1.4, true);
      }
      if (at(T.turn + 1.2)) this.say('"Hands where we can see them! Step away from the window!"', 2.2, true);
      // a tremble, now
      if (t > T.turn) pos.add(new THREE.Vector3((Math.random() - 0.5) * 0.008, (Math.random() - 0.5) * 0.008, 0));
    } else if (t < T.back) {
      const k = ease((t - T.them) / (T.back - T.them));
      const back = yawTo(sill, new THREE.Vector3(S * (CH + 0.8), 0, door.dz));
      const out = yawTo(sill, outward);
      yaw = back + wrap(out - back) * k;
      pos = sill.clone();
      if (at(T.them + 0.1)) {
        this.lines = [];
        this.say('No.', 0.8);
      }
      // (and the night thins again as you turn back to the window)
      (this.stage!.scene.fog as THREE.FogExp2).density = 0.045 - 0.033 * k;
    } else if (t < T.jump) {
      // up on to the sill -- a step up, crouched in the hole -- and the push off
      const k = (t - T.back) / (T.jump - T.back);
      yaw = yawTo(sill, outward);
      const up = Math.sin(Math.min(1, k * 1.3) * Math.PI * 0.5);
      pos = sill.clone().lerp(leanOut, ease(k));
      // (crouched low in the hole, under the glass still hanging in the top of it)
      pos.y = sill.y - 0.2 + up * 0.08 - Math.max(0, k - 0.7) * 0.4;
      pitch = -0.15 - k * 0.25;
      (this.stage!.scene.fog as THREE.FogExp2).density = 0.012;
      if (at(T.back + 0.05)) audio.sfx('glass_crack', 0.6);
      if (at(T.back + 0.35)) audio.sfx('breath', 0.8);
      cn.p0 = pos.clone();
    } else if (t < T.fall) {
      // THE FALL.  Out and away from the wall, and down: slow for a breath,
      // then faster and faster, the brick going up past you, the water
      // coming up black and wide, the world turning over a little -- and
      // the black before you reach it.
      const k = (t - T.jump) / (T.fall - T.jump);
      const p0 = cn.p0 ?? leanOut;
      // (the black comes a few metres above it: close to, the water is only
      // a flat picture)
      const bottom = WATER_Y + 3.2;
      pos = new THREE.Vector3(p0.x + S * (0.5 + 2.2 * Math.sqrt(k)), p0.y - (p0.y - bottom) * k * k, p0.z + Math.sin(k * 2.1) * 0.3);
      // turning as you go, so the face of the building is there beside you --
      // the brick and the dark windows going up past, faster and faster --
      // and the water below coming up at you
      const out = yawTo(sill, outward);
      yaw = out + 0.75 * ease(Math.min(1, k * 1.6)) + Math.sin(k * 2.6) * 0.1 * k;
      pitch = -0.35 - ease(Math.min(1, k * 1.4)) * 0.55;
      roll = Math.sin(k * 3.2) * 0.2 * k;
      cam.fov = 72 + 18 * k;
      cam.updateProjectionMatrix();
      (this.stage!.scene.fog as THREE.FogExp2).density = 0.012;
      // the shake of the air
      pos.add(new THREE.Vector3((Math.random() - 0.5) * 0.03 * k, 0, (Math.random() - 0.5) * 0.03 * k));
      if (at(T.jump + 0.02)) audio.sfx('throw_whoosh', 0.9);
      if (at(T.jump + 0.3)) audio.sfx('wind_gust', 1);
      if (at(T.jump + 1.0)) audio.sfx('wind_gust', 1);
    } else {
      // the black, and the water closing over you
      if (!cn.black) {
        cn.black = true;
        // into the water: the slap of it, the plunge, the spray coming back
        // down over the surface, and the roar cut off under it
        audio.sfx('plunge', 1);
        audio.sfx('splash', 1);
        this.time.delayedCall(120, () => audio.sfx('splash', 0.8));
        this.time.delayedCall(380, () => audio.sfx('water_plip', 0.7));
        this.time.delayedCall(620, () => audio.sfx('water_plip', 0.5));
      }
      if (t > T.fall + 1.4) this.toEnding();
      return;
    }
    cam.position.copy(pos);
    cam.rotation.set(pitch, yaw, roll);
    this.yaw = yaw;
    if ((t < T.window || (t > T.turn && t < T.jump)) && Math.abs(cam.fov - 72) > 0.1) {
      cam.fov += (72 - cam.fov) * Math.min(1, dt * 5);
      cam.updateProjectionMatrix();
    }
    // the night sky behind it all, deep blue rather than nothing
    // (the stars, the deep blue going down to the town's glow)
    const scn = this.stage!.scene;
    if (this.b!.skyTex) scn.background = this.b!.skyTex;
    else if (scn.background instanceof THREE.Color) scn.background.setHex(0x0a1226);
    // the three of them, coming in
    for (const c of this.cops) {
      const mark = (c as Cop & { mark?: THREE.Vector3 }).mark;
      if (!mark) continue;
      const dx = mark.x - c.m.x;
      const dz = mark.z - c.m.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const s = Math.min(d, 4.2 * dt);
        c.m.x += (dx / d) * s;
        c.m.z += (dz / d) * s;
        c.speedNow = s / dt;
        c.st.run = true;
        c.yaw = Math.atan2(dx, dz);
      } else {
        c.speedNow = 0;
        this.faceToward(c, pos.x, pos.z, dt, 6);
        c.st.point = c.i === 0 ? 1 : 0;
        c.st.aimPitch = Math.atan2(pos.y - (c.m.h + 1.5), Math.max(0.5, Math.hypot(pos.x - c.m.x, pos.z - c.m.z)));
        c.st.aimYaw = 0;
      }
      c.st.shout = t > T.hold + 0.9 && t < T.hold + 1.6 ? 1 : Math.max(0, c.st.shout - dt);
    }
  }

  /** The three of them, in the corridor outside, then through the door to their marks. */
  private copsToDoor(): void {
    const b = this.b!;
    const door = b.rooms.find((r) => r.special === '612')!;
    const y = TOP * FH;
    const S = SIDE612;
    const marks = [
      new THREE.Vector3(S * (CH + 0.75), y, door.dz - 0.1),
      new THREE.Vector3(S * (CH + 0.35), y, door.dz + 0.75),
      new THREE.Vector3(S * (CH + 0.4), y, door.dz - 0.85),
    ];
    this.cops.forEach((c, i) => {
      c.m = { x: S * 0.2, z: door.dz - 3 - i * 1.2, f: TOP, well: false, seg: 'top', h: y };
      c.yaw = 0;
      c.inLobby = false;
      (c as Cop & { mark?: THREE.Vector3 }).mark = marks[i];
      c.st.torch = 1;
    });
    // the second and third stop in the doorway itself
    (this.cops[1] as Cop & { mark?: THREE.Vector3 }).mark = new THREE.Vector3(S * 0.6, y, door.dz + 0.5);
    (this.cops[2] as Cop & { mark?: THREE.Vector3 }).mark = new THREE.Vector3(S * 0.6, y, door.dz - 0.6);
    for (let k = 0; k < 6; k++) this.time.delayedCall(k * 140, () => audio.sfx('step_run', 0.6));
  }

  private toEnding(): void {
    this.phase = 'ending';
    this.phaseT = 0;
    this.lines = [];
    // (slowly: a beat of the black first, and each line given time)
    this.endLines = [
      { text: '', dur: 1.4, col: '#e8e2cd' },
      { text: 'You escaped the police...', dur: 4.6, col: '#e8e2cd' },
      { text: '...but Froggy is still out there.', dur: 5.0, col: '#d06060' },
      { text: 'THE FOLLOWING DAY', dur: 4.4, col: '#ffd45e' },
      { text: "Lily's Condos is boarding up the sixth floor.", dur: 4.8, col: '#e8e2cd' },
      { text: 'Froggy still has not turned up.', dur: 5.0, col: '#d06060' },
    ];
    this.endI = 0;
    this.endT = 0;
    this.time.delayedCall(600, () => audio.sfx('eerie_swell', 0.3));
  }

  private advanceEnd(): void {
    // (a tap moves the words on, never before they have been up a moment)
    if (this.phase !== 'ending' || this.endT < 1.2) return;
    this.endT = 99;
  }

  private endFrame(dt: number): void {
    this.endT += dt;
    const l = this.endLines[this.endI];
    if (!l) return;
    if (this.endT > l.dur) {
      this.endI++;
      this.endT = 0;
      if (this.endI >= this.endLines.length) this.finish();
    }
  }

  private finished = false;
  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    store.patch({ hotelAfter: 'escaped', timeOfDay: 'day', hotelNight: false, checkedIn: false, arc: 'back' });
    // the next morning, outside the arcade -- and the man
    followingDay();
    earnBadge('late_checkout');
    store.flush();
    froggyLayer.clear();
    this.teardown();
    this.scene.start('ExteriorDay', {});
  }

  // ===================================================================== the arrest

  private caught(c: Cop): void {
    if (this.phase !== 'play') return;
    this.phase = 'caught';
    this.phaseT = 0;
    this.scareT = 0;
    this.catcher = c;
    this.arrestEye = null;
    this.lines = [];
    this.prompt = '';
    c.mode = 'arrest';
    audio.setScene(SILENCE);
    audio.sfx('police_shout', 1);
    this.time.delayedCall(60, () => audio.sfx('step_run', 0.9));
    this.time.delayedCall(170, () => audio.sfx('step_run', 0.9));
    this.publish('caught');
  }

  /**
   * THE ARREST.  The camera is yours, frozen where you were caught (pulled
   * out from where you hid); the officer comes at it from a few strides off,
   * fast, the torch straight in your eyes, stops with his face in yours,
   * and the cuffs come up -- a hard cold light under his face, the picture
   * jolting, the click -- and then the black.
   */
  /** Where you stood when he got you, and how far off he came from. */
  private arrestEye: THREE.Vector3 | null = null;
  private arrestFrom = 2.8;

  private arrestFrame(dt: number): void {
    const c = this.catcher;
    const st = this.stage!;
    const cam = st.camera;
    if (!c) return;
    this.scareT += dt;
    const t = this.scareT;
    // where you are: out of the hiding place, stood; looking at him
    const h = this.hide;
    if (h) {
      const sp = h.spot;
      cam.position.set(sp.approach.x, sp.floor * FH + (sp.kind === 'bed' ? 0.5 : EYE), sp.approach.z);
      this.hide = null;
      if (sp.kind === 'wardrobe' || sp.kind === 'curtain') sp.setOpen(1);
    }
    // Where you stand is fixed the first frame and kept: the camera is moved
    // back and shaken below, and reading it again each frame walked the
    // picture (and him with it) backwards through the walls and out of the
    // building in under two seconds.
    if (!this.arrestEye || t < dt * 1.5) {
      this.arrestEye = cam.position.clone();
      const eye0 = this.arrestEye;
      const toCop = new THREE.Vector3(c.m.x - eye0.x, 0, c.m.z - eye0.z);
      // he comes from in front of you: put him on the line you are looking down
      const fwd = toCop.lengthSq() > 0.01 ? toCop.normalize() : new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      (c as Cop & { line?: THREE.Vector3 }).line = fwd.clone();
      // ...from no further off than the room allows: never through a wall
      const segs = this.segsCache(this.levelOf(this.me), true);
      let room = 2.8;
      for (const sg of segs) {
        const hit = segHit(eye0.x, eye0.z, eye0.x + fwd.x * 2.8, eye0.z + fwd.z * 2.8, sg);
        if (hit !== null) room = Math.min(room, hit * 2.8 - 0.3);
      }
      this.arrestFrom = Math.max(0.95, room);
    }
    const eye = this.arrestEye.clone();
    const line = (c as Cop & { line?: THREE.Vector3 }).line ?? new THREE.Vector3(0, 0, -1);
    const rush = 0.38;
    const k = clamp(t / rush, 0, 1);
    // the lunge, and then -- close enough to feel his breath -- still
    // coming, an inch at a time, all the while he is shouting in your face
    const creep = clamp((t - rush) / 1.6, 0, 1);
    const dist = this.arrestFrom + (0.66 - this.arrestFrom) * (1 - Math.pow(1 - k, 3)) - 0.14 * creep;
    const floorY = this.levelOf(this.me) * FH + (this.me.well ? 0 : 0);
    const baseY = this.me.well ? this.me.h : floorY;
    c.m.x = eye.x + line.x * dist;
    c.m.z = eye.z + line.z * dist;
    c.m.h = baseY;
    c.yaw = Math.atan2(-line.x, -line.z);
    c.speedNow = k < 1 ? 5 : 0;
    c.st.run = k < 1;
    c.st.shout = t > 0.25 ? 0.85 + Math.sin(t * 9) * 0.15 : 0.6;
    c.st.grab = t > 0.3 ? 1 : 0;
    c.st.torch = 1;
    c.st.lights = 1;
    // the torch on you
    c.st.aimPitch = Math.atan2(eye.y - (baseY + 1.45), Math.max(0.3, dist));
    c.st.aimYaw = 0;
    c.model.setPose(c.m.x, c.m.h, c.m.z, c.yaw);
    c.model.update(dt, c.st);
    // look him in the face, and the picture jolts as he arrives
    const head = c.model.headWorld();
    const shake = t > rush && t < rush + 0.45 ? (rush + 0.45 - t) * 0.16 : 0.006 + creep * 0.004;
    // (held a little back and up from where you stood, so his shoulders are
    // not in the lens and his face is level with yours)
    const back = 0.18 * k;
    cam.position.set(eye.x - line.x * back + (Math.random() - 0.5) * shake, Math.max(eye.y, head.y - 0.05) + (Math.random() - 0.5) * shake, eye.z - line.z * back);
    cam.lookAt(head);
    // (closing in on his face: everything else falls away out of the frame)
    const fov = 72 + (46 - 72) * k - 8 * creep;
    cam.fov = fov;
    cam.updateProjectionMatrix();
    // the light under his face, the torch's flare in your eyes
    // THE LIGHT ON HIM: hard and cold, from under his chin -- the sockets
    // of his eyes and the underside of his brow gone black, the mouth a
    // hole -- and it stutters, as a torch held in a struggle does
    if (this.scareLight) {
      this.scareLight.position.copy(head).add(new THREE.Vector3(line.x * -0.75, -0.62, line.z * -0.75));
      const stutter = t > rush && Math.random() < 0.08 ? 0.35 : 1;
      this.scareLight.intensity = 2.6 * k * stutter;
    }
    const { pos } = c.model.torchRay();
    if (this.flare) {
      this.flare.position.copy(pos);
      (this.flare.material as THREE.SpriteMaterial).opacity = 0.75 * k;
      this.flare.scale.setScalar(0.4 + 0.5 * k);
    }
    if (this.cuffs) {
      this.cuffs.visible = t > rush;
      const ck = clamp((t - rush) / 0.25, 0, 1);
      this.cuffs.position.copy(head).lerp(eye, 0.35 + 0.4 * ck).add(new THREE.Vector3(0, -0.35 + 0.1 * ck, 0));
      this.cuffs.lookAt(eye);
    }
    if (t > rush && t - dt <= rush) {
      audio.sfx('arrest_hit', 1);
      audio.sfx('death_stinger', 0.9);
      const canvas = document.getElementById('three-canvas') as HTMLCanvasElement | null;
      if (canvas) {
        canvas.style.filter = 'contrast(1.7) brightness(1.3)';
        window.setTimeout(() => (canvas.style.filter = ''), 120);
      }
    }
    if (t > rush + 0.25 && t - dt <= rush + 0.25) audio.sfx('cuffs', 1);
    if (t > 2.45) this.toArrested();
  }

  private arrested = false;
  private toArrested(): void {
    if (this.arrested) return;
    this.arrested = true;
    froggyLayer.clear();
    this.teardown();
    this.scene.start('DeathScreen', { key: 'PoliceEscape3D', data: { retry: true }, title: 'ARRESTED', line: ['They caught you.', 'Hands behind your back.', 'Nowhere left to run.'][Math.floor(Math.random() * 3)] });
  }

  // ===================================================================== words

  /** Said now, over whatever was being said (what a door or a hiding place tells you). */
  private sayNow(text: string, dur: number, red = false): void {
    for (const l of this.lines) l.until += dur;
    this.lines.unshift({ text, until: this.clock + dur, red });
  }

  private say(text: string, dur: number, red = false): void {
    // (an officer's line does not wait behind another officer's: it replaces
    // it, so the bottom of the screen is never a queue of shouting)
    if (red) this.lines = this.lines.filter((l) => !l.red);
    const from = this.lines.length ? this.lines[this.lines.length - 1].until : this.clock;
    this.lines.push({ text, until: Math.max(from, this.clock) + dur, red });
  }

  private paintOverlay(): void {
    while (this.lines.length && this.lines[0].until < this.clock) this.lines.shift();
    // what is in reach, said simply
    this.prompt = '';
    if (this.phase === 'play') {
      const tap = isTouch() ? 'INTERACT: ' : '[E] ';
      if (this.hide) this.prompt = '';
      else {
        const sp = this.nearestSpot();
        const d = this.nearestDoor();
        if (sp) this.prompt = tap + this.spotVerb(sp);
        else if (d) this.prompt = tap + (d.locked ? 'TRY THE DOOR' : d.want > 0.5 ? 'CLOSE THE DOOR' : 'OPEN THE DOOR');
        else if (this.atLobbyGap()) this.prompt = tap + 'THE LOBBY';
      }
    }
    froggyLayer.paint((ctx) => {
      if (this.phase === 'ending') {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        const l = this.endLines[this.endI];
        if (l) {
          const a = clamp(Math.min(this.endT / 1.3, (l.dur - this.endT) / 1.0), 0, 1);
          const scale = l.text === 'THE FOLLOWING DAY' ? 2 : 1;
          drawPixelText(ctx, l.text, GAME_W / 2, GAME_H / 2 - 4 * scale, { scale, color: l.col, center: true, alpha: a });
        }
        return;
      }
      if (this.phase === 'cinema' && this.cine) {
        // bars top and bottom, coming in
        const k = clamp(this.cine.t / 0.8, 0, 1);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, GAME_W, 14 * k);
        ctx.fillRect(0, GAME_H - 14 * k, GAME_W, 14 * k);
        // (the black, all at once, just before the water)
        if (this.cine.black) {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, GAME_W, GAME_H);
        }
      }
      if (this.phase === 'caught') {
        const t = this.scareT;
        // the world closing in round his face: black from the edges
        const close = clamp(t / 0.5, 0, 1);
        const vg = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, GAME_H * (0.5 - 0.22 * close), GAME_W / 2, GAME_H / 2, GAME_W * 0.62);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, `rgba(0,0,0,${0.55 + 0.4 * close})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        // the hit: a flash, white into red
        if (t > 0.38 && t < 0.62) {
          const a = 1 - (t - 0.38) / 0.24;
          ctx.fillStyle = t < 0.46 ? `rgba(255,240,240,${0.7 * a})` : `rgba(200,10,20,${0.45 * a})`;
          ctx.fillRect(0, 0, GAME_W, GAME_H);
        }
        if (t > 0.38) {
          // a pulse of red at the edges with every shout, and the picture
          // breaking up: grain, and a torn line or two
          const pulse = 0.12 + 0.1 * Math.max(0, Math.sin(t * 9));
          const rg = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, GAME_H * 0.3, GAME_W / 2, GAME_H / 2, GAME_W * 0.6);
          rg.addColorStop(0, 'rgba(120,0,0,0)');
          rg.addColorStop(1, `rgba(140,0,8,${pulse})`);
          ctx.fillStyle = rg;
          ctx.fillRect(0, 0, GAME_W, GAME_H);
          for (let i = 0; i < 260; i++) {
            ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.25)';
            ctx.fillRect(Math.random() * GAME_W, Math.random() * GAME_H, 1, 1);
          }
          if (Math.random() < 0.25) {
            const y = Math.random() * GAME_H;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, y, GAME_W, 1 + Math.random() * 3);
          }
        }
        if (t > 1.85) {
          ctx.fillStyle = `rgba(0,0,0,${clamp((t - 1.85) / 0.5, 0, 1)})`;
          ctx.fillRect(0, 0, GAME_W, GAME_H);
        }
        return;
      }
      const intro = Math.max(0, 1 - this.clock / 0.9);
      if (intro > 0) {
        ctx.fillStyle = `rgba(0,0,0,${intro})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }
      this.paintHideMask(ctx);
      const over = touchControls.overBottom();
      const top = isTouch() ? 40 : 6;
      if (this.objective) {
        drawPixelText(ctx, 'OBJECTIVE', 6, top, { scale: 1, color: '#9a4848', alpha: 0.85 });
        drawPixelText(ctx, this.objective, 6, top + 10, { scale: 1, color: '#ff4a4a', alpha: 0.95 });
        const lvl = this.levelOf(this.me);
        drawPixelText(ctx, this.me.well ? `STAIRS - FLOOR ${lvl === 0 ? 'G' : lvl}` : `FLOOR ${lvl === 0 ? 'G' : lvl}`, 6, top + 20, { scale: 1, color: '#7a8494', alpha: 0.75 });
      }
      // how close they are to seeing you: an eye that opens
      const sus = Math.max(0, ...this.cops.filter((c) => c.mode !== 'chase').map((c) => c.sus));
      const chased = this.cops.some((c) => c.mode === 'chase' || c.mode === 'alert');
      // (not over the film of 612: that is not yours to play)
      if ((sus > 0.05 || chased) && this.phase !== 'cinema') {
        const cx = GAME_W / 2;
        const cy = 18;
        const open = chased ? 1 : sus;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(cx - 13, cy - 7, 26, 14);
        ctx.strokeStyle = chased ? '#ff3a3a' : open > 0.6 ? '#ff9a50' : '#f0d060';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 10, Math.max(0.5, 5 * open), 0, 0, Math.PI * 2);
        ctx.stroke();
        if (open > 0.3) {
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fillRect(cx - 1.5, cy - 1.5 * open, 3, 3 * open);
        }
      }
      const line = this.lines[0];
      if (line) {
        const cx = GAME_W / 2 + (over.left - over.right) / 2;
        if (line.red && line.text.length < 24 && !line.text.startsWith('RADIO')) {
          drawPixelText(ctx, line.text, cx, GAME_H * 0.36, { scale: 1, color: '#ff4a4a', center: true });
        } else {
          const room = GAME_W - 24 - over.left - over.right;
          const per = Math.max(10, Math.floor(room / 6));
          const rows: string[] = [];
          for (const word of line.text.split(' ')) {
            const last = rows[rows.length - 1];
            if (last !== undefined && (last + ' ' + word).length <= per) rows[rows.length - 1] = last + ' ' + word;
            else rows.push(word);
          }
          rows.forEach((r, i) => {
            const y = GAME_H - 30 - (rows.length - 1 - i) * 9;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(cx - (r.length * 6) / 2 - 2, y - 2, r.length * 6 + 3, 11);
            drawPixelText(ctx, r, cx, y, { scale: 1, color: line.red ? '#ff6a5a' : '#e8e2cd', center: true });
          });
        }
      }
      let hint = this.prompt;
      if (!hint && this.hide && this.hide.k >= 1 && !this.hide.leaving) hint = isTouch() ? (this.hide.peek ? 'PEEK: STOP LOOKING - INTERACT: GET OUT' : 'PEEK: LOOK OUT - INTERACT: GET OUT') : this.hide.peek ? 'Q STOP PEEKING - E GET OUT' : 'Q PEEK - E GET OUT';
      if (!hint && this.clock < this.hintUntil) hint = this.hint;
      if (hint && this.phase === 'play') {
        const y = 44;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(GAME_W / 2 - (hint.length * 6) / 2 - 4, y - 3, hint.length * 6 + 7, 13);
        drawPixelText(ctx, hint, GAME_W / 2, y, { scale: 1, color: '#f0d890', center: true });
      }
      if (this.crouch && !this.hide) drawPixelText(ctx, 'CROUCHED', GAME_W - 54, top + 10, { scale: 1, color: '#9ab0c0', alpha: 0.7 });
    });
  }

  /** What you can see from where you are hiding: each place its own. */
  private paintHideMask(ctx: CanvasRenderingContext2D): void {
    const h = this.hide;
    if (!h) return;
    const k = h.k;
    const p = h.peekK;
    const W = GAME_W;
    const H = GAME_H;
    const soft = (x0: number, x1: number, dir: 1 | -1, a: number): void => {
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, `rgba(0,0,0,${dir > 0 ? a : 0})`);
      g.addColorStop(1, `rgba(0,0,0,${dir > 0 ? 0 : a})`);
      ctx.fillStyle = g;
      ctx.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), H);
    };
    switch (h.spot.kind) {
      case 'bed': {
        // the frame overhead: a dark band down from the top, the gap under it
        const band = H * (0.62 - 0.2 * p);
        ctx.fillStyle = `rgba(0,0,0,${0.92 * k})`;
        ctx.fillRect(0, 0, W, band);
        const g = ctx.createLinearGradient(0, band, 0, band + 16);
        g.addColorStop(0, `rgba(0,0,0,${0.92 * k})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, band, W, 16);
        ctx.fillStyle = `rgba(0,0,0,${0.35 * k})`;
        ctx.fillRect(0, H - 10, W, 10);
        break;
      }
      case 'wardrobe': {
        // inside: dark, but for the crack between the doors
        const slit = W * (0.05 + 0.2 * p);
        ctx.fillStyle = `rgba(0,0,0,${0.9 * k})`;
        ctx.fillRect(0, 0, W / 2 - slit / 2 - 10, H);
        ctx.fillRect(W / 2 + slit / 2 + 10, 0, W / 2 - slit / 2 - 10, H);
        soft(W / 2 - slit / 2 - 10, W / 2 - slit / 2, 1, 0.9 * k);
        soft(W / 2 + slit / 2, W / 2 + slit / 2 + 10, -1, 0.9 * k);
        break;
      }
      case 'curtain': {
        // the fabric: the light through it; at the edge, when you pull it, the room
        ctx.fillStyle = `rgba(190,200,210,${0.28 * k * (1 - p * 0.6)})`;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = `rgba(0,0,0,${0.55 * k})`;
        ctx.fillRect(0, 0, W * (1 - 0.35 * p), H);
        soft(W * (1 - 0.35 * p), W * (1 - 0.35 * p) + 14, 1, 0.55 * k);
        break;
      }
      case 'door': {
        // the crack at the hinge: a sliver of the room
        const slit = W * (0.02 + 0.1 * p);
        const cx = W / 2;
        ctx.fillStyle = `rgba(0,0,0,${0.94 * k})`;
        ctx.fillRect(0, 0, cx - slit / 2 - 6, H);
        ctx.fillRect(cx + slit / 2 + 6, 0, W, H);
        soft(cx - slit / 2 - 6, cx - slit / 2, 1, 0.94 * k);
        soft(cx + slit / 2, cx + slit / 2 + 6, -1, 0.94 * k);
        break;
      }
    }
  }

  // ===================================================================== misc

  private publish(outcome?: string): void {
    if (!import.meta.env?.DEV) return;
    const w = window as unknown as Record<string, Record<string, unknown>>;
    const t = w.__police ?? {};
    Object.assign(t, {
      phase: this.phase,
      seed: this.seed,
      px: this.me.x,
      pz: this.me.z,
      ph: this.me.h,
      pf: this.me.f,
      level: this.levelOf(this.me),
      well: this.me.well,
      seg: this.me.seg,
      hidden: this.hide ? { id: this.hide.spot.id, kind: this.hide.spot.kind, k: this.hide.k, peek: this.hide.peek } : null,
      prompt: this.prompt,
      line: this.lines[0]?.text ?? '',
      cops: this.cops.map((c) => ({
        i: c.i,
        x: c.m.x,
        z: c.m.z,
        h: c.m.h,
        f: c.m.f,
        well: c.m.well,
        level: this.levelOf(c.m),
        mode: c.mode,
        act: c.acts[0]?.k ?? '',
        sus: c.sus,
        torch: c.st.torch,
        beam: c.st.beamLen,
        floorGoal: c.floorGoal,
        home: c.home,
      })),
      cine: this.cine?.t ?? 0,
      endI: this.endI,
    });
    if (outcome) t.outcome = outcome;
    w.__police = t;
  }

  private bridge(): void {
    const w = window as unknown as Record<string, Record<string, unknown>>;
    const b = (): PoliceBuilding => this.b!;
    w.__police = {
      warp: (x: number, z: number, f: number, well = false) => {
        this.me = { x, z, f, well, seg: 'top', h: f * FH };
        this.segCache.clear();
      },
      /** Walk straight at a point through the real collision and stairs, in small steps. */
      walkTo: (x: number, z: number, maxSteps = 600) => {
        for (let i = 0; i < maxSteps; i++) {
          const dx = x - this.me.x;
          const dz = z - this.me.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.06) break;
          const s = Math.min(0.05, d);
          this.step(this.me, this.me.x + (dx / d) * s, this.me.z + (dz / d) * s, R_PLAYER, 'me');
          this.segCache.clear();
        }
        return { x: this.me.x, z: this.me.z, h: this.me.h, f: this.me.f, well: this.me.well, seg: this.me.seg, level: this.levelOf(this.me) };
      },
      face: (yaw: number, pitch = 0) => {
        this.yaw = yaw;
        this.pitch = pitch;
      },
      freeze: (on: boolean) => {
        this.frozen = on;
      },
      rooms: () =>
        b().rooms.map((r) => ({ id: r.id, f: r.floor, open: r.open, side: r.side, dz: r.dz, x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, spots: r.spots.map((s) => ({ id: s.id, kind: s.kind, ax: s.approach.x, az: s.approach.z })), special: r.special, door: { k: r.door.k, locked: r.door.locked } })),
      doors: () => b().doors.map((d) => ({ id: d.id, kind: d.kind, f: d.floor, k: d.k, want: d.want, locked: d.locked, by: d.by, hx: d.hx, hz: d.hz })),
      setDoor: (id: string, k: number) => {
        const d = b().doors.find((x) => x.id === id);
        if (!d) return;
        d.k = d.want = k;
        b().poseDoor(d);
        this.segCache.clear();
      },
      useDoor: (id: string) => {
        const d = b().doors.find((x) => x.id === id);
        if (d) this.useDoor(d);
      },
      hideIn: (id: string) => {
        const sp = b().spots.find((s) => s.id === id);
        if (!sp) return false;
        this.me = { x: sp.approach.x, z: sp.approach.z, f: sp.floor, well: false, seg: 'top', h: sp.floor * FH };
        this.enterSpot(sp);
        return true;
      },
      peek: () => this.togglePeek(),
      press: () => this.press(),
      crouch: (on: boolean) => {
        this.crouch = on;
      },
      putCop: (i: number, x: number, z: number, f: number, yaw = 0) => {
        const c = this.cops[i];
        if (!c) return;
        c.m = { x, z, f, well: false, seg: 'top', h: f * FH };
        c.yaw = yaw;
        c.inLobby = false;
        c.acts = [];
        c.path = [];
        c.mode = 'task';
        c.sus = 0;
      },
      copInspect: (i: number, spotId: string) => {
        const c = this.cops[i];
        const sp = b().spots.find((s) => s.id === spotId);
        if (!c || !sp || !sp.node) return;
        c.inLobby = false;
        c.mode = 'task';
        c.acts = [{ k: 'go', n: sp.node, pace: HURRY }, { k: 'inspect', spot: sp }];
        c.path = [];
      },
      copGo: (i: number, f: number) => {
        const c = this.cops[i];
        if (!c) return;
        c.inLobby = false;
        c.mode = 'task';
        c.acts = [];
        c.path = [];
        this.sweepFloor(c, f);
      },
      copSearch: (i: number, roomId: number) => {
        const c = this.cops[i];
        const rm = b().rooms.find((r) => r.id === roomId);
        if (!c || !rm) return;
        c.inLobby = false;
        c.mode = 'task';
        c.acts = [{ k: 'search', room: rm }];
        c.path = [];
      },
      copHold: (i: number, t: number) => {
        const c = this.cops[i];
        if (!c) return;
        c.acts = [{ k: 'look', t }];
        c.t = 0;
      },
      caught: () => this.caught(this.cops[0]),
      to612: () => {
        const rm = b().rooms.find((r) => r.special === '612')!;
        this.me = { x: SIDE612 * (CH + 0.6), z: rm.dz, f: TOP, well: false, seg: 'top', h: TOP * FH };
        this.segCache.clear();
      },
      floorSpots: (f: number) => b().spots.filter((s) => s.floor === f).map((s) => s.id),
    };
  }

  private teardown(): void {
    this.stage?.dispose();
    this.stage = null;
    if (this.onLookDown) window.removeEventListener('mousedown', this.onLookDown);
    if (this.onLookMove) window.removeEventListener('mousemove', this.onLookMove);
    if (this.onLookUp) {
      window.removeEventListener('mouseup', this.onLookUp);
      window.removeEventListener('blur', this.onLookUp);
    }
    this.onLookDown = this.onLookMove = null;
    this.onLookUp = null;
    this.dragging = false;
    // (letting go of the mouse on the way out is not the player pausing)
    releaseMouseQuietly();
  }
}

void END_Z;
