/**
 * The hotel lobby at the bottom of the stairs, in 3D, and the storage room
 * off the end of it.
 *
 * MODE 'hide': you are in the storage room with the door pulled to, looking
 * out through its small window down the length of the lobby.  He comes
 * through the stairwell door, searches -- the counter, the chairs -- and then
 * comes, slowly, to the storage room, and stands outside it, staring at the
 * door.  Crouched, you are below the glass: he cannot be sure, and after a
 * while (5-8 seconds, never the same) he goes -- to the front doors, where he
 * stops and looks back one last time before he goes through them.  Standing
 * while he is watching is the end of you.
 *
 * MODE 'exposed': you were still out in the lobby when the stairwell door
 * went.  He sees you.
 *
 * His footsteps are the other half of it: louder, clearer and panned as he
 * comes, stopping when he stops, going away when he goes.
 */

import { CHECK_TITLE, checkHow, checkLive, newCheck, pressCheck, releaseCheck, stepCheck, type CalmCheck, type CheckResult } from '../game/calmCheck';
import Phaser from 'phaser';
import * as THREE from 'three';
import { attachMouseLook, lockedDelta, lookScale } from '../core/look';
import { isPaused } from '../core/pause';
import { audio, SILENCE } from '../core/audio';
import { isTouch } from '../core/device';
import { froggyLayer } from '../render/froggyLayer';
import { drawPixelText } from '../render/pixelFont';
import { playJumpscare, SCARE_MS } from '../froggy/jumpscare';
import { playJumpscare3D, prepareJumpscare3D, type Scare3D } from '../froggy/jumpscare3d';
import { FootDust } from '../three/footDust';
import { FroggyMonster, type ClimbRig, type HandGoal } from '../three/froggyMonster';
import { climbFrame, climbSeconds, type ClimbGeom } from '../three/froggyClimb';
import { ThreeStage } from '../render/threeStage';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { touchControls } from '../ui/touchControls';
import { texBlock, texConcrete, texSign } from '../art/hotelInterior';
import { BIN, buildHotelLobby, DEPTH, DESK_X, DOOR_H, DOOR_W, DOOR_Z, lx, SOFA_X, STAIR_X, X0, X1 } from '../three/hotelLobby';

/** The storage room door's little window. */
const WIN = { w: 0.42, y0: 1.4, y1: 1.7 };
/** Where you are in there, and how high your eyes are. */
const HIDE = { x: X1 + 0.38, z: DOOR_Z };
const EYE_UP = 1.62;
const EYE_DOWN = 1.0;
/** Where he stands to stare at the door. */
const WATCH = new THREE.Vector3(X1 - 1.15, 0, DOOR_Z);
const FROG_SCALE = 1.25;

/**
 * ---- HIS AWARENESS, while you hide.  Tune here.
 *
 * Not a yes/no glance: SUSPICION, 0..1, that builds while he can see any
 * part of you through the storage room's glass and drains only slowly once
 * he cannot -- so ducking the moment you are seen buys you nothing if you
 * keep coming back up.  Every fresh sighting (a head appearing where there
 * was none) jolts it on top.  At 1 he has you.
 */
const AWARE = {
  /** Seconds of a full, square-on view of you for suspicion to go 0 -> 1 (from mid-lobby). */
  timeToDetect: 0.45,
  /** Suspicion lost per second while he cannot see you: slow, so peeks add up. */
  suspicionDecayRate: 0.05,
  /** The jolt the instant he catches a head coming up at the glass. */
  peekDetectionSensitivity: 0.18,
  /** Half-width of his gaze, radians. */
  fov: 0.45,
  /** At or near the storage room: wider eyes, quicker to be sure, sharper ears. */
  janitorRoomAwarenessMultiplier: 1.7,
  /** Metres from the storage door that count as "at it". */
  janitorRange: 4.5,
  /** Uneasy: his head snaps round to the storage door, and you hear it. */
  suspiciousThreshold: 0.2,
  /** He drops what he is doing and comes to the door to look. */
  investigateThreshold: 0.45,
  /** Getting up or down in there, heard at the door (suspicion added, at point-blank). */
  crouchNoise: 0.12,
  /** Metres that noise carries. */
  hearing: 6,
};

/**
 * ---- THE STORAGE ROOM IS NOT SAFE.  Tune here.
 *
 * STRESS, 0..1, climbs the whole time you are in there -- faster the longer
 * it has been, faster with him close, faster the surer he is.  It is what
 * your breathing is: calm is silent, past `loud` he can hear it through the
 * door.  Skill checks (see game/calmCheck) are how you bring it down.
 */
const NERVE = {
  /** Stress per second, before anything else. */
  base: 0.016,
  /** ...plus this much per second for every second already hidden. */
  perSecondHidden: 0.0005,
  /** ...plus this, scaled by how close he is (1 = at the door). */
  near: 0.03,
  /** Above this your breathing carries. */
  loud: 0.62,
  /** Suspicion per second from loud breathing, at the door, at full stress. */
  breathNoise: 0.1,
  /** Seconds between checks, calm and early -> late and with him close. */
  checkEvery: [9, 3.2] as [number, number],
  /** What each result does to stress. */
  perfect: -0.35,
  success: -0.12,
  failStress: 0.08,
  /** Suspicion a failed check adds at the door (grows with repeated failures). */
  failNoise: 0.16,
  /** Doorway stare: idle this long and the eyes are drawn up to his face. */
  tiltIdle: 1.1,
  /** How fast they are drawn, radians per second. */
  tiltRate: 0.32,
};

/**
 * ---- HOW LONG IT LASTS, and how long he stands at the door.  Tune here.
 *
 * The hide is 45 seconds from the stairwell door going to the moment he
 * turns his back on the storage room for good.  Every second of it you are
 * keeping yourself quiet (the checks can come at any time).  He searches
 * the lobby, comes to the door and looks in for 10 to 12 seconds -- never
 * longer, whatever he heard -- then turns and walks away.  Before the 45 are
 * up he goes back to searching; after them he takes one last look and goes.
 */
const HUNT = {
  /** Seconds of hiding, from the stairwell door to his going. */
  seconds: 45,
  /** Seconds he looks in through the glass, once at the door. */
  watch: [10, 12] as [number, number],
  /** If he has not come to the door by this many seconds before the end, he comes now. */
  comeBy: 18,
  /** Metres he walks away from the door before he does anything else. */
  walkAway: 6,
};

/** His walk to the storage door, metres a second (the last steps up to it are slower). */
const APPROACH_SPEED = 1.3;

type Mode = 'hide' | 'exposed';
type Phase = 'settle' | 'burst' | 'search' | 'approach' | 'watch' | 'leave' | 'lookback' | 'exit' | 'gone' | 'detect' | 'lunge' | 'caught';

interface Leg {
  to: THREE.Vector3;
  speed: number;
  /** What he does when he gets there, and for how long. */
  look?: THREE.Vector3;
  lean?: number;
  hold?: number;
  scan?: boolean;
  /** Lift the bin's lid while he is there. */
  bin?: boolean;
  /** Get there by going OVER something this high, between these distances along the way. */
  over?: { top: number; near: number; far: number };
}

interface LobbyClimb {
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  total: number;
  geom: ClimbGeom;
}


function tex(c: HTMLCanvasElement, rx = 1, ry = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function canvas(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  return c;
}





/** The storage room's door: plain painted staff door, the window cut out of it in geometry. */
function texStaffDoor(): HTMLCanvasElement {
  return canvas(64, 128, (g) => {
    g.fillStyle = '#8a7e6a';
    g.fillRect(0, 0, 64, 128);
    for (let k = 0; k < 40; k++) {
      g.fillStyle = `rgba(40,34,24,${0.05 + (k % 3) * 0.03})`;
      g.fillRect((k * 13) % 64, (k * 29) % 128, 2, 2);
    }
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.fillRect(0, 0, 2, 128);
  });
}

/**
 * ---- THE GAUGES YOU READ WHILE YOU HIDE, drawn like a piece of dark
 * equipment rather than flat blocks of colour: a plate of smoked glass, and
 * sunk into it a channel whose fill is lit from inside.
 */

/** The panel a gauge sits on: near-black glass, lit along the top edge. */
function plate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x - 1, y + 2, w + 2, h);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(32,30,34,0.94)');
  g.addColorStop(0.5, 'rgba(14,13,16,0.94)');
  g.addColorStop(1, 'rgba(8,7,9,0.94)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

/** An empty channel: a dark groove with its own shadow along the top lip. */
function gauge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(2,2,3,0.92)');
  g.addColorStop(1, 'rgba(18,17,20,0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(x, y + h - 1, w, 1);
}

/** A length of the channel, filled and lit: bright at the top, deep at the foot. */
function lit(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shade(col, 1.45));
  g.addColorStop(0.45, col);
  g.addColorStop(1, shade(col, 0.55));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x, y, w, 1);
}

/** `col` (a #rrggbb) lightened or darkened by `k`. */
function shade(col: string, k: number): string {
  const n = parseInt(col.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}


export class HotelLobby3D extends Phaser.Scene {
  private stage: ThreeStage | null = null;
  private monster: FroggyMonster | null = null;
  private shardMat: THREE.MeshLambertMaterial | null = null;
  private glassBitMat: THREE.MeshLambertMaterial | null = null;
  private woodBitMat: THREE.MeshLambertMaterial | null = null;
  private footDust: FootDust | null = null;
  private scare: Scare3D | null = null;
  private mode: Mode = 'hide';
  private startX = 238;

  private phase: Phase = 'settle';
  private phaseT = 0;
  private clock = 0;

  // you
  private yaw = Math.PI / 2;
  private pitch = 0;
  private eye = EYE_UP;
  private crouched = false;
  /** What the touch button last said, so it is relabelled only on a change. */
  private crouchLabel = '';
  private camPos = new THREE.Vector3();
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private dragging = false;
  private onLookDown: ((e: MouseEvent) => void) | null = null;
  private onLookMove: ((e: MouseEvent) => void) | null = null;
  private onLookUp: (() => void) | null = null;

  // him
  private fpos = new THREE.Vector3();
  private fWas = new THREE.Vector3();
  private fYaw = 0;
  private legs: Leg[] = [];
  private holdT = 0;
  private watchFor = 6;
  /** Seconds since the stairwell door went (the hide's own clock). */
  private hideClock = 0;
  /** Been to the door and looked in, at least once. */
  private watched = false;
  /** The last footstep: when, and where, for the marker on the screen. */
  private lastStep: { t: number; at: THREE.Vector3; hard: number } | null = null;
  /** The calm key just went down: the plate lights. */
  private pressedAt = -9;
  /** It was your breathing that gave you away, not your face at the glass. */
  private heardYou = false;
  private faceTo: THREE.Vector3 | null = null;
  private faceK = 0;
  private lean = 0;
  private scanT = 0;
  private frogLight: THREE.PointLight | null = null;

  // the room
  private stairDoor: THREE.Group | null = null;
  private stairFly: { v: THREE.Vector3; spin: number } | null = null;
  private frontLeaves: THREE.Group[] = [];
  private frontFly: Array<{ v: THREE.Vector3; spin: number }> = [];
  /** The front doors' glass, which goes to pieces when he goes through it. */
  private frontPanes: THREE.Mesh[] = [];
  private staffDoor: THREE.Group | null = null;
  private binLid: THREE.Group | null = null;
  private binOpen = 0;
  private climbing: LobbyClimb | null = null;
  private devCam: { at: THREE.Vector3; to: THREE.Vector3 } | null = null;
  private binRustle = 0;
  /** How long his eyes have been on you, standing at the glass. */
  /** His suspicion, 0..1: see AWARE. */
  private sus = 0;
  /** See NERVE. */
  private stress = 0;
  private hideT = 0;
  private check: CalmCheck | null = null;
  private checkIn = 6;
  private breathT = 0;
  private recentFails = 0;
  /** He has had a look at you: what he hears from the room, he goes straight to. */
  private sawYou = false;
  /** Last time the player moved the view, for the doorway stare. */
  private lookedAt = 0;
  private flash: { text: string; colour: string; until: number } | null = null;
  /** Whether he could see any of you last frame (a new sighting is a jolt). */
  private susSeen = false;
  /** 0 calm, 1 uneasy, 2 coming to check: the cues fire as it climbs. */
  private susStage = 0;
  /** His head snapped round to the storage door, for this long. */
  private alertLook = 0;
  private bulb: THREE.PointLight | null = null;
  private bits: Array<{ m: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; rest: boolean; half: number; flat?: boolean }> = [];
  private bangT = 0;
  private heartT = 0;

  // words
  private lines: Array<{ text: string; until: number; red?: boolean }> = [];
  private hint = '';

  constructor() {
    super('HotelLobby3D');
  }

  init(data: { mode?: Mode; x?: number } = {}): void {
    this.mode = data.mode === 'exposed' ? 'exposed' : 'hide';
    this.startX = typeof data.x === 'number' ? data.x : 238;
  }

  create(): void {
    audio.preloadScream();
    froggyLayer.clear();
    audio.setScene(SILENCE);
    this.phase = this.mode === 'hide' ? 'settle' : 'burst';
    this.phaseT = 0;
    this.clock = 0;
    this.scare = null;
    this.lines = [];
    this.legs = [];
    this.bits = [];
    this.frontLeaves = [];
    this.frontFly = [];
    this.frontPanes = [];
    this.stairFly = null;
    this.crouched = false;
    this.crouchLabel = '';
    this.sus = 0;
    this.stress = 0;
    this.hideT = 0;
    this.check = null;
    this.checkIn = 6;
    this.breathT = 1;
    this.recentFails = 0;
    this.sawYou = false;
    this.lookedAt = 0;
    this.flash = null;
    this.susSeen = false;
    this.susStage = 0;
    this.alertLook = 0;
    this.climbing = null;
    this.binOpen = 0;
    this.eye = EYE_UP;
    this.faceTo = null;
    this.faceK = 0;
    this.lean = 0;
    this.holdT = 0;
    this.bangT = 0.6;
    this.heartT = 0;
    // a different wait every time (10 to 12 seconds): he cannot be timed
    this.watchFor = Phaser.Math.FloatBetween(HUNT.watch[0], HUNT.watch[1]);
    this.hideClock = 0;
    this.watched = false;
    this.lastStep = null;
    this.pressedAt = -9;
    this.heardYou = false;

    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000).setOrigin(0, 0);
    const root = document.getElementById('game-root');
    if (!root) return;
    this.stage = new ThreeStage();
    this.stage.mount(root, this.game.canvas);
    this.build();

    if (this.mode === 'hide') {
      this.camPos.set(HIDE.x, EYE_UP, HIDE.z);
      this.yaw = Math.PI / 2;
      this.pitch = 0;
      this.say('He is right behind that stairwell door.', 3);
      this.say('Stay down. Stay quiet.', 3, true);
    } else {
      this.camPos.set(Phaser.Math.Clamp(lx(this.startX), X0 + 1, X1 - 1), EYE_UP, 3.6);
      this.yaw = Math.atan2(this.camPos.x - STAIR_X, this.camPos.z - 0.2);
      this.pitch = 0;
      this.burst();
    }

    const kb = this.input.keyboard;
    if (kb) {
      this.keys = {
        left: [kb.addKey('A'), kb.addKey('LEFT')],
        right: [kb.addKey('D'), kb.addKey('RIGHT')],
        up: [kb.addKey('W'), kb.addKey('UP')],
        down: [kb.addKey('S'), kb.addKey('DOWN')],
      };
      kb.on('keydown-C', () => this.toggleCrouch());
      kb.on('keydown-CTRL', () => this.toggleCrouch());
      kb.on('keydown-E', () => this.press());
      // (a key held down repeats: only the first press is a press)
      kb.on('keydown-SPACE', (e: KeyboardEvent) => {
        if (!e.repeat) this.calmKey(true);
      });
      kb.on('keyup-SPACE', () => this.calmKey(false));
    }
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.event instanceof MouseEvent && document.pointerLockElement) this.turn(lockedDelta(p.event).dx * 0.0027, lockedDelta(p.event).dy * 0.0027);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > GAME_H * 0.62 && this.lines.length) this.lines.shift();
    });
    this.onLookDown = (e: MouseEvent) => {
      if (e.button === 0 && !isPaused()) this.dragging = true;
    };
    this.onLookMove = (e: MouseEvent) => {
      // any movement of the mouse breaks the doorway stare (see doorwayStare)
      if (e.movementX || e.movementY) this.lookedAt = this.clock;
      if (!this.dragging || document.pointerLockElement || isPaused()) return;
      const k = (e as MouseEvent & { lookSens?: number }).lookSens ?? 0.0042;
      this.turn((e.movementX || 0) * k, (e.movementY || 0) * k);
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

  // ================================================================== world

  private build(): void {
    const st = this.stage!;
    const S = st.scene;
    st.camera.near = 0.05;
    st.camera.far = 60;
    st.camera.fov = 70;
    st.camera.updateProjectionMatrix();
    // The lobby as it is in 2D: cream and gold under its chandeliers, the
    // lights left on all night.  Warm, and lit enough to read every piece of
    // it from the storage room -- the dark is in the corners and behind him.
    S.background = new THREE.Color(0x0a0806);
    S.fog = new THREE.FogExp2(0x0c0a08, 0.028);
    S.add(new THREE.HemisphereLight(0x8a7a62, 0x1a140c, 0.85));
    S.add(st.camera);

    const parts = buildHotelLobby(S);
    this.stairDoor = parts.stairDoor;
    this.frontPanes = parts.frontPanes;
    this.frontLeaves = parts.frontLeaves;
    this.binLid = parts.binLid;
    this.buildStorage(S);

    // The breakages' materials, made now and put in the scene (hidden), so
    // they are built in the warm-up and not on the frame of the smash.
    this.shardMat = new THREE.MeshLambertMaterial({ color: 0xa8c4e0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, emissive: 0x1a2a3a });
    this.glassBitMat = new THREE.MeshLambertMaterial({ color: 0x9ab8d8, transparent: true, opacity: 0.6 });
    this.woodBitMat = new THREE.MeshLambertMaterial({ color: 0x6a4428 });
    for (const m of [this.shardMat, this.glassBitMat, this.woodBitMat]) {
      const warm = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), m);
      warm.position.set(0, -5, 0);
      warm.visible = false;
      S.add(warm);
    }
    this.monster = new FroggyMonster(FROG_SCALE);
    this.monster.root.visible = false;
    S.add(this.monster.root);
    // his steps are his feet: the sound and a kick of grit the moment each
    // one comes down, where it comes down
    this.footDust = new FootDust(S);
    this.monster.onFootfall = (_foot, at, hard) => {
      if (!this.monster?.root.visible) return;
      // louder than they were, and never so quiet at the far end of the
      // lobby that you lose him: you should always know where he is
      this.heard(at.clone().setY(0.1), 'froggy_step', 0.95 + hard * 0.5, 0.16);
      this.lastStep = { t: this.clock, at: at.clone(), hard };
      this.footDust?.puff(at, hard, FROG_SCALE * 0.8);
    };
    if (this.stage) prepareJumpscare3D(this.stage, this.monster);
    // a cold light that goes with him, so his face reads in the dark
    this.frogLight = new THREE.PointLight(0xb8c4e0, 4.5, 6, 1.5);
    S.add(this.frogLight);
  }

  private buildStorage(S: THREE.Scene): void {
    const R0 = X1;
    const R1 = X1 + 2.0;
    const Z0 = DOOR_Z - 1.25;
    const Z1 = DOOR_Z + 1.25;
    const H = 2.7;
    const blockT = tex(texBlock());
    const block = (w: number, h: number): THREE.MeshLambertMaterial => {
      const t = blockT.clone();
      t.repeat.set(w / 1.6, h / 1.6);
      t.needsUpdate = true;
      return new THREE.MeshLambertMaterial({ map: t, color: 0xbcb4a4 });
    };
    const inner = 0.12; // the wall's thickness
    const wx = R0 + inner;
    // the wall with the door in it, from inside
    const sr0 = DOOR_Z - DOOR_W / 2;
    const sr1 = DOOR_Z + DOOR_W / 2;
    for (const [a, b, y0, y1] of [
      [Z0, sr0, 0, H],
      [sr1, Z1, 0, H],
      [sr0, sr1, DOOR_H, H],
    ] as const) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b - a, y1 - y0), block(b - a, y1 - y0));
      m.position.set(wx, (y0 + y1) / 2, (a + b) / 2);
      m.rotation.y = Math.PI / 2;
      S.add(m);
    }
    // the reveal: the wall's thickness round the door
    const jamb = new THREE.MeshLambertMaterial({ color: 0x6a604e });
    for (const z of [sr0, sr1]) {
      const j = new THREE.Mesh(new THREE.BoxGeometry(inner, DOOR_H, 0.02), jamb);
      j.position.set(R0 + inner / 2, DOOR_H / 2, z);
      S.add(j);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(inner, 0.02, DOOR_W), jamb);
    lintel.position.set(R0 + inner / 2, DOOR_H, DOOR_Z);
    S.add(lintel);
    // the other three walls, floor, ceiling
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(Z1 - Z0, H), block(Z1 - Z0, H));
    backWall.position.set(R1, H / 2, DOOR_Z);
    backWall.rotation.y = -Math.PI / 2;
    S.add(backWall);
    for (const [z, ry] of [
      [Z0, 0],
      [Z1, Math.PI],
    ] as const) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(R1 - wx, H), block(R1 - wx, H));
      w.position.set((wx + R1) / 2, H / 2, z);
      w.rotation.y = ry;
      S.add(w);
    }
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(R1 - wx, Z1 - Z0), new THREE.MeshLambertMaterial({ map: tex(texConcrete('#7a766e'), 2, 2) }));
    fl.rotation.x = -Math.PI / 2;
    fl.position.set((wx + R1) / 2, 0.001, DOOR_Z);
    S.add(fl);
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(R1 - wx, Z1 - Z0), new THREE.MeshLambertMaterial({ color: 0x8a8478 }));
    cl.rotation.x = Math.PI / 2;
    cl.position.set((wx + R1) / 2, H, DOOR_Z);
    S.add(cl);

    // ---- the door: hinged on its left, a small window in it
    const door = new THREE.Group();
    door.position.set(R0 + 0.06, 0, sr0);
    const doorMat = new THREE.MeshLambertMaterial({ map: tex(texStaffDoor()) });
    const T = 0.045;
    const wz0 = (DOOR_W - WIN.w) / 2;
    for (const [h, y, w, z] of [
      [WIN.y0, WIN.y0 / 2, DOOR_W, DOOR_W / 2],
      [DOOR_H - WIN.y1, (DOOR_H + WIN.y1) / 2, DOOR_W, DOOR_W / 2],
      [WIN.y1 - WIN.y0, (WIN.y0 + WIN.y1) / 2, wz0, wz0 / 2],
      [WIN.y1 - WIN.y0, (WIN.y0 + WIN.y1) / 2, wz0, DOOR_W - wz0 / 2],
    ] as const) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(T, h, w), doorMat);
      p.position.set(0, y, z);
      door.add(p);
    }
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(WIN.w, WIN.y1 - WIN.y0),
      new THREE.MeshLambertMaterial({ color: 0x9ab0c0, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
    );
    pane.rotation.y = Math.PI / 2;
    pane.position.set(0, (WIN.y0 + WIN.y1) / 2, DOOR_W / 2);
    door.add(pane);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshLambertMaterial({ color: 0xc9a24a }));
    knob.position.set(0.05, 1.0, DOOR_W - 0.1);
    door.add(knob);
    S.add(door);
    this.staffDoor = door;

    // ---- what is kept in here: shelves of supplies, mops, buckets
    const steel = new THREE.MeshLambertMaterial({ color: 0x8a8e94 });
    const sx = R1 - 0.3;
    for (const y of [0.35, 0.95, 1.55, 2.15]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, 2.2), steel);
      shelf.position.set(sx, y, DOOR_Z);
      S.add(shelf);
    }
    for (const dz of [-1.08, 1.08]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.2, 0.03), steel);
      post.position.set(sx + 0.2, 1.1, DOOR_Z + dz);
      S.add(post);
      const post2 = post.clone();
      post2.position.x = sx - 0.2;
      S.add(post2);
    }
    // on the shelves: bottles, toilet rolls, boxes of soap
    const cols = [0x2a7ac8, 0xe8d040, 0xc83a3a, 0x3ab878, 0xf0f0f0, 0x8a5ac8];
    let n = 0;
    for (const y of [0.37, 0.97, 1.57, 2.17])
      for (let dz = -0.95; dz <= 0.95; dz += 0.19) {
        n++;
        if (n % 5 === 0) continue;
        const kind = n % 3;
        let m: THREE.Mesh;
        if (kind === 0) {
          m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.24, 8), new THREE.MeshLambertMaterial({ color: cols[n % cols.length] }));
          m.position.set(sx + ((n * 7) % 3) * 0.08 - 0.08, y + 0.12, DOOR_Z + dz);
        } else if (kind === 1) {
          m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.11, 10), new THREE.MeshLambertMaterial({ color: 0xf4f2ec }));
          m.position.set(sx, y + 0.06, DOOR_Z + dz);
        } else {
          m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.16), new THREE.MeshLambertMaterial({ color: 0xb08a5a }));
          m.position.set(sx, y + 0.1, DOOR_Z + dz);
        }
        S.add(m);
      }
    // mops and a broom leaning in the corner, a wringer bucket, a pail
    const handle = new THREE.MeshLambertMaterial({ color: 0x9a7a4a });
    const mophead = new THREE.MeshLambertMaterial({ color: 0xd8d0b8 });
    for (const [z, tilt, head] of [
      [Z0 + 0.22, 0.12, true],
      [Z0 + 0.38, -0.08, true],
      [Z1 - 0.25, 0.1, false],
    ] as const) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 6), handle);
      h.position.set(wx + 0.55, 0.85, z);
      h.rotation.z = tilt;
      S.add(h);
      const hd = head
        ? new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.22, 10), mophead)
        : new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.32), new THREE.MeshLambertMaterial({ color: 0x3a3a3a }));
      hd.position.set(wx + 0.55 + Math.sin(-tilt) * 0.7, 0.1, z);
      S.add(hd);
    }
    const yellow = new THREE.MeshLambertMaterial({ color: 0xe8b020 });
    const bucket = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.5), yellow);
    bucket.position.set(wx + 0.95, 0.2, Z0 + 0.5);
    S.add(bucket);
    const wringer = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.22), new THREE.MeshLambertMaterial({ color: 0x8a8a40 }));
    wringer.position.set(wx + 0.95, 0.45, Z0 + 0.62);
    S.add(wringer);
    for (const [x, z, c] of [
      [wx + 1.3, Z1 - 0.4, 0x3a6ac8],
      [wx + 1.05, Z1 - 0.35, 0x9a9a9a],
    ] as const) {
      const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.3, 12), new THREE.MeshLambertMaterial({ color: c }));
      pail.position.set(x, 0.15, z);
      S.add(pail);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.15), new THREE.MeshLambertMaterial({ map: tex(texSign('WET FLOOR', '#e8c020', '#202020', 256, 96)) }));
    sign.position.set(wx + 0.7, 0.35, Z1 - 0.02);
    sign.rotation.y = Math.PI;
    S.add(sign);
    // the one bulb
    const bulbM = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe8b0 }));
    bulbM.position.set(wx + 1.0, H - 0.25, DOOR_Z);
    S.add(bulbM);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    cord.position.set(wx + 1.0, H - 0.12, DOOR_Z);
    S.add(cord);
    this.bulb = new THREE.PointLight(0xffd890, 0.9, 3.2, 1.8);
    this.bulb.position.set(wx + 1.0, H - 0.3, DOOR_Z);
    S.add(this.bulb);
  }

  // ===================================================================== loop

  private held(g: string): boolean {
    return this.keys[g]?.some((k) => k.isDown) ?? false;
  }

  private turn(dx: number, dy: number): void {
    if (this.phase === 'caught') return;
    if (dx || dy) this.lookedAt = this.clock;
    this.yaw -= dx * lookScale();
    this.pitch = Phaser.Math.Clamp(this.pitch - dy * lookScale(), -1.0, 0.9);
    if (this.mode === 'hide') this.yaw = Phaser.Math.Clamp(this.yaw, Math.PI / 2 - 2.3, Math.PI / 2 + 2.3);
  }

  private toggleCrouch(): void {
    if (this.mode !== 'hide' || this.phase === 'caught' || this.phase === 'lunge') return;
    this.crouched = !this.crouched;
    // down below the glass, the eyes go up to it
    this.pitch = this.crouched ? Math.max(this.pitch, 0.1) : Math.min(this.pitch, 0.05);
    audio.sfx('floor_creak', 0.25);
    this.crouchNoise();
  }

  private press(): void {
    if (this.phase !== 'gone') return;
    this.phase = 'caught'; // (nothing more happens here)
    audio.sfx('door_open', 0.8);
    froggyLayer.clear();
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(450, () => this.scene.start('Hotel', { area: 'lobby', from: 'storage' }));
  }

  private tick(dt: number): void {
    if (!this.stage) return;
    if (this.phase === 'caught') {
      this.scare?.update(dt);
      return;
    }
    dt = Math.min(dt, 0.05);
    this.clock += dt;
    this.phaseT += dt;
    // keys turn the head too
    const kx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const ky = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    if (kx || ky) this.turn(kx * dt * 1.6, ky * dt * 1.2);
    this.syncPad();
    this.story(dt);
    this.moveFroggy(dt);
    this.animateBits(dt);
    this.updateCamera(dt);
    this.paintOverlay();
    this.publish();
  }

  private syncPad(): void {
    if (!isTouch()) return;
    touchControls.showButton('C', this.mode === 'hide' && this.phase !== 'gone');
    // The button says what it will DO: CROUCH while standing, STAND once down.
    const crouchLabel = this.crouched ? 'STAND' : 'CROUCH';
    if (crouchLabel !== this.crouchLabel) {
      this.crouchLabel = crouchLabel;
      touchControls.relabel('C', crouchLabel);
    }
    touchControls.showButton('E', this.phase === 'gone');
    // (always there while you hide, not only while a check is up: you should
    // not have to find it on the screen with him at the window)
    touchControls.showButton('SPACE', this.mode === 'hide' && this.phase !== 'gone');
  }

  /** Standing up where he could see you. */
  private standing(): boolean {
    return this.eye > 1.3;
  }

  /**
   * Eye contact: you are up at the glass AND his gaze -- where his face is
   * turned, or his body and the sweep of his head -- is on the door.  Up
   * while he is looking elsewhere, he does not see you.
   */
  /** Whether he is at, or close by, the storage room. */
  private nearStore(): boolean {
    return this.fpos.distanceTo(new THREE.Vector3(X1, 0, DOOR_Z)) < AWARE.janitorRange;
  }

  /**
   * How much of you he can see, 0..1.  Not one point at your middle: the
   * top of your head, your eyes and both shoulders, each tested against the
   * actual opening of the glass -- so the top of a head coming up into the
   * window is seen before your eyes are over the sill -- and then against
   * where he is looking.
   */
  private visibleOfYou(): number {
    if (this.mode !== 'hide') return this.standing() ? 1 : 0;
    const fx = this.fpos.x;
    const fz = this.fpos.z;
    const gaze = this.faceTo && this.faceK > 0.5 ? Math.atan2(this.faceTo.x - fx, this.faceTo.z - fz) : this.fYaw + this.scanT;
    const fov = AWARE.fov * (this.nearStore() ? AWARE.janitorRoomAwarenessMultiplier : 1);
    const pts: [number, number, number][] = [
      // [height, sideways, weight]
      [this.eye + 0.14, 0, 1],
      [this.eye, 0, 1],
      [this.eye - 0.24, -0.18, 0.5],
      [this.eye - 0.24, 0.18, 0.5],
    ];
    let seen = 0;
    for (const [y, side, w] of pts) {
      if (y < WIN.y0 - 0.02 || y > WIN.y1 + 0.04 || Math.abs(side) > WIN.w / 2) continue;
      let d = Math.atan2(this.camPos.x - fx, this.camPos.z + side - fz) - gaze;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(d) < fov) seen += w;
    }
    return Math.min(1, seen / 2);
  }

  /**
   * Suspicion: up while he can see you (faster the closer he is, and at the
   * storage room), a jolt for every fresh sighting, slowly down when he
   * cannot.  True when he is sure.
   */
  private spotted(dt: number): boolean {
    const near = this.nearStore();
    const mult = near ? AWARE.janitorRoomAwarenessMultiplier : 1;
    const vis = this.visibleOfYou();
    if (vis > 0) {
      // In his line of sight he has you almost at once, near or far: the
      // glass is what hides you, not the length of the lobby.
      if (!this.susSeen) this.sus += AWARE.peekDetectionSensitivity * mult * vis;
      this.sus += (dt / AWARE.timeToDetect) * vis * 1.5 * mult;
      // and he remembers the room you were seen in
      if (this.sus >= AWARE.suspiciousThreshold) this.sawYou = true;
    } else this.sus -= AWARE.suspicionDecayRate * dt;
    this.susSeen = vis > 0;
    this.sus = Phaser.Math.Clamp(this.sus, 0, 1);
    this.reactToSuspicion();
    return this.sus >= 1;
  }

  /**
   * What he does about it, so you can tell: uneasy, his head snaps round to
   * the storage door with a sound; past investigateThreshold he leaves the
   * search and marches on the door to look.
   */
  private reactToSuspicion(): void {
    if (this.sus < AWARE.suspiciousThreshold * 0.5) this.susStage = 0;
    if (this.susStage < 1 && this.sus >= AWARE.suspiciousThreshold) {
      this.susStage = 1;
      this.alertLook = 1.4;
      this.heard(this.fpos.clone().setY(1.6), 'floor_creak', 0.6);
      audio.sfx('eerie_swell', 0.3);
    }
    if (this.susStage < 2 && this.sus >= AWARE.investigateThreshold) {
      this.susStage = 2;
      this.investigate();
    }
  }

  /** Off his round and straight to the storage door, to look in. */
  private investigate(): void {
    this.alertLook = 1.8;
    audio.sfx('dun', 0.55);
    // already at it: he is looking already, and the look ends when it ends
    // (it is never stretched -- it used to grow by four seconds a time)
    if (this.phase === 'watch') return;
    if (this.phase === 'approach') return;
    if (!(this.phase === 'search' || this.phase === 'leave') || this.climbing) {
      // (mid-climb: as soon as he is down)
      this.susStage = 1;
      return;
    }
    this.holdT = 0;
    this.comeToDoor();
    // (heard something: he hurries)
    for (const l of this.legs) l.speed *= 1.35;
  }

  // ============================================================ the nerve

  /** 0..1: how close he is to the storage room (1 = at the door). */
  private nearK(): number {
    const m = this.monster;
    if (!m?.root.visible) return 0;
    const d = this.fpos.distanceTo(new THREE.Vector3(X1, 0, DOOR_Z));
    return Phaser.Math.Clamp(1 - (d - 1) / 11, 0, 1);
  }

  /**
   * Stress, breathing, and the checks that keep them down -- every frame he
   * is in the lobby and you are in the cupboard.
   */
  private nerve(dt: number): void {
    this.hideT += dt;
    const near = this.nearK();
    this.stress += dt * (NERVE.base + this.hideT * NERVE.perSecondHidden + near * NERVE.near + this.sus * 0.03);
    this.recentFails = Math.max(0, this.recentFails - dt / 12);

    // your breathing: quiet, then audible, then ragged
    this.breathT -= dt;
    if (this.breathT <= 0) {
      this.breathT = Math.max(0.7, 2.8 - this.stress * 1.9);
      audio.sfx('breath', 0.1 + this.stress * 0.9);
    }
    // ...and past `loud`, he can hear it.  Having seen you, he comes at once.
    if (this.stress > NERVE.loud && near > 0.3) {
      const k = (this.stress - NERVE.loud) / (1 - NERVE.loud);
      this.noise(dt * NERVE.breathNoise * k * near * (this.sawYou ? 2 : 1));
      if (this.sawYou && this.susStage < 2 && k > 0.5) {
        this.susStage = 2;
        this.investigate();
      }
    }
    // ---- STRESS ALL THE WAY UP, THE BAR RED TO THE END: you cannot hold it
    // in any more, and he hears you.  He turns on the door and comes through
    // it (the same end as being seen: see `detect`, the lunge, `caught`).
    if (this.stress >= 1) {
      this.stress = 1;
      audio.sfx('breath', 1);
      this.time.delayedCall(220, () => audio.sfx('breath', 1));
      this.say('You can\'t hold it in.', 1.6, true);
      this.check = null;
      this.sawYou = true;
      this.heardYou = true;
      this.detect();
      return;
    }

    // the checks: more often, and harder, the longer it goes and the nearer he is
    if (!this.check) {
      this.checkIn -= dt * (1 + near * 0.9);
      if (this.checkIn <= 0) {
        const hard = Phaser.Math.Clamp(this.hideT / 90 + near * 0.3, 0, 1);
        this.check = newCheck(hard, near > 0.6);
        this.checkIn = Phaser.Math.Linear(NERVE.checkEvery[0], NERVE.checkEvery[1], hard) + Math.random() * 2;
      }
    } else {
      const r = stepCheck(this.check, dt);
      if (r) this.checkDone(r);
    }
    this.stress = Phaser.Math.Clamp(this.stress, 0, 1);
  }

  private calmKey(down: boolean): void {
    if (!this.check || this.phase === 'caught' || this.phase === 'lunge') return;
    if (down) this.pressedAt = this.clock;
    const r = down ? pressCheck(this.check) : releaseCheck(this.check);
    if (r) this.checkDone(r);
  }

  private checkDone(r: CheckResult): void {
    this.check = null;
    // a failure with your nerve already gone is a panic
    if (r === 'fail' && this.stress > 0.85) r = 'critical';
    const show = (text: string, colour: string) => (this.flash = { text, colour, until: this.clock + 1.1 });
    if (r === 'perfect') {
      this.stress += NERVE.perfect;
      this.breathT = Math.max(this.breathT, 2.5);
      show(`CALM  -${Math.round(-NERVE.perfect * 100)}% STRESS`, '#7fd88a');
    } else if (r === 'success') {
      this.stress += NERVE.success;
      show(`STEADY  -${Math.round(-NERVE.success * 100)}% STRESS`, '#f0d060');
    } else if (r === 'fail') {
      this.stress += NERVE.failStress;
      this.recentFails += 1;
      audio.sfx('breath', 0.9);
      this.noise(NERVE.failNoise * (1 + this.recentFails * 0.6) * Math.max(0.25, this.nearK()));
      if (this.sawYou && this.susStage < 2) {
        this.susStage = 2;
        this.investigate();
      }
      show(`TOO LOUD  +${Math.round(NERVE.failStress * 100)}% STRESS`, '#ff7060');
    } else {
      this.panic();
      show('YOU GASP', '#ff4030');
    }
    this.stress = Phaser.Math.Clamp(this.stress, 0, 1);
  }

  /** Panic: a ragged gasp he cannot miss, and he comes straight to the door. */
  private panic(): void {
    audio.sfx('breath', 1);
    this.time.delayedCall(260, () => audio.sfx('breath', 1));
    this.noise(0.25);
    if (this.susStage < 2) {
      this.susStage = 2;
      this.investigate();
    }
  }

  /** A sound from the storage room, heard by him as far as it carries. */
  private noise(amount: number): void {
    const m = this.monster;
    if (!m?.root.visible || this.mode !== 'hide') return;
    const d = this.fpos.distanceTo(new THREE.Vector3(X1, 0, DOOR_Z));
    const reach = AWARE.hearing * 1.6;
    if (d > reach) return;
    const mult = this.nearStore() ? AWARE.janitorRoomAwarenessMultiplier : 1;
    this.sus = Math.min(0.99, this.sus + amount * (1 - d / reach) * mult);
    this.reactToSuspicion();
  }

  /**
   * HE IS AT THE DOOR, LOOKING IN.  Leave the view alone and your eyes are
   * drawn up, slowly, to his face; touch the mouse (or the screen) and they
   * are yours again at once.  Nothing is taken from you.
   */
  private doorwayStare(dt: number): void {
    if (this.mode !== 'hide' || this.phase !== 'watch' || !this.monster?.root.visible) return;
    if (this.clock - this.lookedAt < NERVE.tiltIdle) return;
    const head = new THREE.Vector3(this.fpos.x, 2.3 * FROG_SCALE * 0.9, this.fpos.z);
    const dx = head.x - this.camPos.x;
    const dz = head.z - this.camPos.z;
    const dy = head.y - this.camPos.y;
    const wantYaw = Math.atan2(-dx, -dz);
    const wantPitch = Math.atan2(dy, Math.hypot(dx, dz));
    let dyaw = wantYaw - this.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    const step = NERVE.tiltRate * dt;
    this.yaw = Phaser.Math.Clamp(this.yaw + Phaser.Math.Clamp(dyaw, -step, step), Math.PI / 2 - 2.3, Math.PI / 2 + 2.3);
    this.pitch += Phaser.Math.Clamp(wantPitch - this.pitch, -step, step);
    // and it does nothing for your nerve
    this.stress = Math.min(1, this.stress + dt * 0.02);
  }

  /** Getting up or down in there makes a sound, and at the door he hears it. */
  private crouchNoise(): void {
    const m = this.monster;
    if (!m?.root.visible || this.mode !== 'hide') return;
    if (!['burst', 'search', 'approach', 'watch', 'leave', 'lookback'].includes(this.phase)) return;
    const d = this.fpos.distanceTo(new THREE.Vector3(X1, 0, DOOR_Z));
    if (d > AWARE.hearing) return;
    const mult = this.nearStore() ? AWARE.janitorRoomAwarenessMultiplier : 1;
    this.sus = Math.min(0.99, this.sus + AWARE.crouchNoise * (1 - d / AWARE.hearing) * mult);
    this.reactToSuspicion();
  }

  private story(dt: number): void {
    const m = this.monster;
    // the banging on the stairwell door, until it goes
    if (this.phase === 'settle') {
      this.hint = this.crouched ? '' : isTouch() ? 'TAP CROUCH TO GET DOWN' : 'C TO CROUCH';
      this.bangT -= dt;
      if (this.bangT <= 0) {
        this.bangT = 1.1 + Math.random() * 0.4;
        this.heard(new THREE.Vector3(STAIR_X, 1.2, 0), 'item_thud', 0.9);
        this.heard(new THREE.Vector3(STAIR_X, 1.2, 0), 'door_rattle', 0.7);
        if (this.stairDoor) this.stairDoor.rotation.y = 0.06;
        this.time.delayedCall(90, () => {
          if (this.stairDoor && !this.stairFly) this.stairDoor.rotation.y = 0;
        });
      }
      if (this.phaseT > 6.5) this.burst();
      return;
    }
    // looking round the lobby: on your feet at the glass, he sees you
    // (a second to get down after the door goes, before he looks your way)
    // (one check for all of it: his suspicion, see AWARE)
    if (this.alertLook > 0) this.alertLook -= dt;
    const hunting = this.phase === 'search' || this.phase === 'approach' || this.phase === 'watch' || this.phase === 'leave' || this.phase === 'lookback' || (this.phase === 'burst' && this.phaseT > 1.0);
    if (this.mode === 'hide') {
      if (hunting && this.spotted(dt)) return this.detect();
      if (!hunting) this.sus = Math.max(0, this.sus - AWARE.suspicionDecayRate * dt);
      // the 45 seconds are the ones you have to keep yourself quiet through;
      // once he has turned his back for good you can breathe again
      const keepQuiet = hunting && (this.hideClock < HUNT.seconds || this.phase === 'approach' || this.phase === 'watch');
      if (keepQuiet) this.nerve(dt);
      else if (hunting) {
        this.check = null;
        this.stress = Math.max(0, this.stress - dt * 0.12);
      }
      // your heart, louder and faster the surer he is
      const fear = Math.max(this.sus, this.stress * 0.85);
      if (this.phase !== 'watch' && fear > 0.15) {
        this.heartT -= dt;
        if (this.heartT <= 0) {
          this.heartT = 0.9 - fear * 0.45;
          audio.heartbeat(0.3 + fear * 0.4);
        }
      }
    }
    // (hiding: he stands and stares at the storage door a moment before the search)
    if (this.phase === 'burst' && this.phaseT > (this.mode === 'hide' ? 2.8 : 1.6)) {
      if (this.mode === 'exposed') {
        // he has seen you
        this.phase = 'detect';
        this.phaseT = 0;
        audio.sfx('dun', 1);
      } else {
        this.phase = 'search';
        this.phaseT = 0;
        this.legs = this.searchPlan();
      }
    }
    if (this.mode === 'hide' && this.phase !== 'burst') this.hideClock += dt;
    // ---- THE 45 SECONDS.  Not to the door yet with the end coming: he
    // leaves the rest of the lobby and comes.  Been, and the time is up:
    // he stops searching and goes (the last look, then the doors).
    if (this.phase === 'search' && !this.climbing) {
      const end = this.mode === 'hide' && this.hideClock >= HUNT.seconds;
      if (end && this.watched) {
        this.legs = [];
        this.goForGood();
      } else if (this.legs.length === 0 || (this.mode === 'hide' && !this.watched && this.hideClock >= HUNT.seconds - this.timeToWatch())) {
        this.comeToDoor();
      }
    }
    if (this.phase === 'approach') {
      if (this.legs.length === 0) {
        this.phase = 'watch';
        this.phaseT = 0;
        this.watched = true;
        // the look: 10 to 12 seconds from now, set once, never stretched
        this.watchFor = Phaser.Math.FloatBetween(HUNT.watch[0], HUNT.watch[1]);
        audio.sfx('eerie_swell', 0.35);
      }
    }
    if (this.phase === 'watch') {
      // the heart, going hard, and nothing else
      this.heartT -= dt;
      if (this.heartT <= 0) {
        const fear = Math.max(this.sus, this.stress);
        this.heartT = 0.62 - fear * 0.22;
        audio.heartbeat(0.55 + fear * 0.35);
      }
      // The look ends on time, whatever he heard (seen, he has you: that is
      // `spotted`, not this).  He turns his back on the door -- on the spot,
      // first, not walking backwards -- and walks a good few steps away.
      if (this.phaseT >= this.watchFor) {
        this.phase = 'leave';
        this.phaseT = 0;
        this.sus = Math.min(this.sus, AWARE.investigateThreshold * 0.8);
        this.susStage = Math.min(this.susStage, 1);
        audio.sfx('floor_creak', 0.35);
        this.legs = [{ to: new THREE.Vector3(WATCH.x - HUNT.walkAway, 0, DOOR_Z - 0.4), speed: 1.05 }];
      }
      return;
    }
    if (this.phase === 'leave' && this.legs.length === 0) {
      // away from the door: back to the search while there is time left,
      // and when it is up, the last look back and out
      if (this.mode === 'hide' && this.hideClock < HUNT.seconds) {
        this.phase = 'search';
        this.phaseT = 0;
        this.legs = this.searchPlan().filter((l) => !l.over && l.to.x < WATCH.x - 2).slice(-4);
      } else this.goForGood();
    }
    if (this.phase === 'lookback') {
      // the last look back at the door: quiet, and long
      if (this.phaseT > 5.2) {
        this.phase = 'exit';
        this.phaseT = 0;
        this.legs = [{ to: new THREE.Vector3(X0 + 0.5, 0, DOOR_Z), speed: 1.6 }];
      }
    }
    if (this.phase === 'exit') {
      if (this.legs.length === 0 && this.frontFly.length === 0) this.smashFront();
      if (this.frontFly.length && this.legs.length === 0 && this.phaseT > 0.4) this.legs = [{ to: new THREE.Vector3(X0 - 4, 0, DOOR_Z + 0.4), speed: 1.6 }];
      if (m && this.fpos.x < X0 - 3.2) {
        m.root.visible = false;
        this.phase = 'gone';
        this.phaseT = 0;
        this.say("...He's gone.", 2.6);
        this.say('Out into the night.', 2.6);
      }
    }
    if (this.phase === 'gone') this.hint = this.phaseT > 1.5 ? (isTouch() ? 'TAP LEAVE - OUT OF THE STORAGE ROOM' : '[E] LEAVE THE STORAGE ROOM') : '';
    if (this.phase === 'detect' && this.phaseT > (this.mode === 'exposed' ? 0.6 : 0.75)) {
      this.phase = 'lunge';
      this.phaseT = 0;
      audio.sfx('froggy_screech', 1);
    }
  }

  /**
   * Seconds from setting off for the door to the end of his look through
   * it: the walk (at the approach's own pace) and the look.  He sets off
   * that long before the 45 are up, so the look ends when they do.
   */
  private timeToWatch(): number {
    // (+4: the last slow steps up to the glass, and his turns)
    const walk = this.fpos.distanceTo(WATCH) / APPROACH_SPEED + 4;
    return Math.max(HUNT.comeBy, walk + HUNT.watch[1]);
  }

  /** From wherever he is in the lobby, to the storage door, to look in. */
  private comeToDoor(): void {
    this.phase = 'approach';
    this.phaseT = 0;
    const legs: Leg[] = [];
    if (this.fpos.x < 2.5) legs.push({ to: new THREE.Vector3(2.5, 0, 3.3), speed: APPROACH_SPEED });
    legs.push({ to: new THREE.Vector3(7.6, 0, DOOR_Z), speed: APPROACH_SPEED }, { to: WATCH.clone(), speed: 0.55 });
    this.legs = legs;
  }

  /** Time is up: no more searching -- the last look back at the door, then out. */
  private goForGood(): void {
    this.phase = 'lookback';
    this.phaseT = 0;
    audio.sfx('floor_creak', 0.3);
  }

  /** The search: out of the stairwell, the counter, the chairs, the floor. */
  private searchPlan(): Leg[] {
    return [
      { to: new THREE.Vector3(STAIR_X, 0, 1.7), speed: 0.7, hold: 2.4, scan: true },
      // round the end of the counter and along behind it, looking down
      // up to the counter, and over it -- not round
      { to: new THREE.Vector3(DESK_X + 0.6, 0, 2.7), speed: 0.85 },
      { to: new THREE.Vector3(DESK_X + 0.6, 0, 0.5), speed: 0.6, over: { top: 1.16, near: 2.7 - 1.85, far: 2.7 - 1.15 } },
      { to: new THREE.Vector3(DESK_X + 0.6, 0, 0.55), speed: 0.6, look: new THREE.Vector3(DESK_X - 0.4, 0.1, 0.7), lean: 0.85, hold: 2.6 },
      { to: new THREE.Vector3(DESK_X - 1.0, 0, 0.6), speed: 0.6, look: new THREE.Vector3(DESK_X - 1.0, 0.2, 1.1), lean: 0.7, hold: 1.8 },
      { to: new THREE.Vector3(DESK_X - 2.4, 0, 0.7), speed: 0.75 },
      { to: new THREE.Vector3(DESK_X - 1.4, 0, 2.5), speed: 0.7, look: new THREE.Vector3(DESK_X - 1.4, 0.6, 0.9), lean: 0.45, hold: 1.8 },
      { to: new THREE.Vector3(lx(69) + 0.4, 0, 2.3), speed: 0.75, look: new THREE.Vector3(lx(69), 0.4, 0.9), lean: 0.4, hold: 1.8 },
      { to: new THREE.Vector3(lx(69) + 1.6, 0, 3.6), speed: 0.7, hold: 2.2, scan: true },
      // the sofa: behind it and under the table
      { to: new THREE.Vector3(SOFA_X, 0, DEPTH - 2.3), speed: 0.75, look: new THREE.Vector3(SOFA_X, 0.3, DEPTH - 0.6), lean: 0.6, hold: 2.2 },
      // the bin: the lid up, a long look in
      { to: new THREE.Vector3(BIN.x, 0, BIN.z - 0.75), speed: 0.7, look: new THREE.Vector3(BIN.x, 0.5, BIN.z), lean: 0.8, hold: 2.6, bin: true },
    ];
  }

  /** The stairwell door goes, and he comes out of the dark behind it. */
  private burst(): void {
    this.phase = 'burst';
    this.phaseT = 0;
    this.hint = '';
    audio.sfx('door_smash', 1);
    audio.sfx('boom', 0.6);
    this.time.delayedCall(250, () => audio.sfx('froggy_screech', 0.8));
    this.stairFly = { v: new THREE.Vector3(0.6, 1.6, 3.4), spin: 3 };
    this.debris(new THREE.Vector3(STAIR_X, 1.2, 0.2), new THREE.Vector3(0, 0, 1), 0x6a4428);
    this.fpos.set(STAIR_X, 0, -0.7);
    this.fWas.copy(this.fpos);
    this.fYaw = 0;
    this.legs = [{ to: new THREE.Vector3(STAIR_X, 0, this.mode === 'exposed' ? 1.4 : 1.7), speed: 1.4 }];
    if (this.monster) this.monster.root.visible = true;
  }

  /**
   * The front doors: he goes through them and the glass SHATTERS.  Both panes
   * burst into shards -- big jagged plates and a spray of small ones -- that
   * fly out into the night and skitter back across the marble; a few jagged
   * teeth stay stuck in the frames; and the frames, torn off their hinges,
   * are thrown out after them.
   */
  private smashFront(): void {
    audio.sfx('glass_shatter', 1);
    this.time.delayedCall(90, () => audio.sfx('glass_shatter', 0.7));
    this.time.delayedCall(260, () => audio.sfx('glass_crack', 0.5));
    audio.sfx('door_smash', 0.8);
    const S = this.stage?.scene;
    for (const p of this.frontPanes) p.visible = false;
    this.frontFly = this.frontLeaves.map((_, i) => ({ v: new THREE.Vector3(-2.2, 0.9, (i ? 1 : -1) * 0.8), spin: 2 }));
    if (!S) return;
    const glassMat = this.shardMat!;
    const shard = (size: number): THREE.BufferGeometry => {
      // a jagged triangle, never the same twice
      const a = Math.random() * Math.PI * 2;
      const pts = [0, 1, 2].map((k) => {
        const ang = a + k * 2.1 + (Math.random() - 0.5) * 0.9;
        const r = size * (0.5 + Math.random() * 0.7);
        return new THREE.Vector2(Math.cos(ang) * r, Math.sin(ang) * r);
      });
      return new THREE.ShapeGeometry(new THREE.Shape(pts));
    };
    for (const pane of this.frontPanes) {
      const c = pane.getWorldPosition(new THREE.Vector3());
      for (let k = 0; k < 70; k++) {
        const big = k < 10;
        const m = new THREE.Mesh(shard(big ? 0.12 + Math.random() * 0.14 : 0.025 + Math.random() * 0.06), glassMat);
        m.position.set(c.x, c.y + (Math.random() - 0.5) * 2.3, c.z + (Math.random() - 0.5) * 0.75);
        m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        S.add(m);
        // out into the night, mostly; some of it back in across the floor
        const inward = Math.random() < 0.3;
        const v = new THREE.Vector3(
          inward ? 0.8 + Math.random() * 2 : -(1.5 + Math.random() * 3.5),
          Math.random() * 2.2,
          (Math.random() - 0.5) * 3,
        );
        this.bits.push({ m, v, spin: new THREE.Vector3(Math.random() * 14, Math.random() * 14, Math.random() * 14), rest: false, half: 0.006, flat: true });
      }
      // jagged teeth left in the frame
      const leaf = pane.parent!;
      for (let k = 0; k < 5; k++) {
        const t = new THREE.Mesh(shard(0.08 + Math.random() * 0.1), glassMat);
        const top = k < 2;
        t.position.set(0, top ? 2.45 : k < 4 ? 0.2 : 1.3, pane.position.z + (Math.random() - 0.5) * 0.6);
        t.rotation.set(0, Math.PI / 2, Math.random() * 6);
        leaf.add(t);
      }
    }
    this.debris(new THREE.Vector3(X0, 1.3, DOOR_Z), new THREE.Vector3(-1, 0, 0), 0x9ab8d8, true);
  }

  private debris(at: THREE.Vector3, dir: THREE.Vector3, col: number, glass = false): void {
    const S = this.stage?.scene;
    if (!S) return;
    const mat = glass ? this.glassBitMat! : this.woodBitMat!.clone();
    if (!glass) mat.color.setHex(col);
    for (let k = 0; k < (glass ? 40 : 50); k++) {
      const s = glass ? 0.03 + Math.random() * 0.08 : 0.02 + Math.random() * 0.04;
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, glass ? 0.005 : s * 0.6, glass ? s : 0.1 + Math.random() * 0.3), mat);
      m.position.set(at.x + (Math.random() - 0.5) * 0.8, at.y + (Math.random() - 0.5) * 1.6, at.z + (Math.random() - 0.5) * 0.8);
      S.add(m);
      const v = dir.clone().multiplyScalar(1.5 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2.5, (Math.random() - 0.5) * 2));
      this.bits.push({ m, v, spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10), rest: false, half: 0.01 });
    }
  }

  private animateBits(dt: number): void {
    for (const b of this.bits) {
      if (b.rest) continue;
      b.m.position.addScaledVector(b.v, dt);
      b.v.y -= 9.8 * dt;
      b.m.rotation.x += b.spin.x * dt;
      b.m.rotation.y += b.spin.y * dt;
      if (b.m.position.y < b.half && b.v.y < 0) {
        b.m.position.y = b.half;
        b.v.multiplyScalar(0.4);
        b.v.y = Math.abs(b.v.y) * 0.4;
        if (b.v.length() < 0.4) {
          b.rest = true;
          // a shard comes to rest lying flat on the floor
          if (b.flat) b.m.rotation.set(-Math.PI / 2, 0, Math.random() * 6);
        }
      }
    }
    const fly = (o: THREE.Object3D, f: { v: THREE.Vector3; spin: number }, floorY: number): boolean => {
      o.position.addScaledVector(f.v, dt);
      f.v.y -= 9.8 * dt;
      o.rotation.x -= f.spin * dt * 0.5;
      if (o.position.y <= floorY && f.v.y < 0) {
        o.position.y = floorY;
        o.rotation.x = -Math.PI / 2;
        return true;
      }
      return false;
    };
    if (this.stairDoor && this.stairFly) {
      if (fly(this.stairDoor, this.stairFly, 0.03)) {
        this.stairFly = null;
        audio.sfx('item_thud', 0.8);
      }
    }
    this.frontLeaves.forEach((g, i) => {
      const f = this.frontFly[i];
      if (!f || f.v.lengthSq() === 0) return;
      g.position.addScaledVector(f.v, dt);
      f.v.y -= 9.8 * dt;
      g.rotation.z += f.spin * dt * 0.4;
      if (g.position.y <= 0 && f.v.y < 0) {
        g.position.y = 0;
        f.v.set(0, 0, 0);
      }
    });
    // the bulb is not a good bulb
    if (this.bulb) this.bulb.intensity = Math.sin(this.clock * 37) > 0.96 ? 0.25 : 0.9;
  }

  /** A sound from somewhere in the lobby, as heard from where you are. */
  private heard(at: THREE.Vector3, name: Parameters<typeof audio.sfx>[0], gain: number, floor = 0.06): void {
    const cam = this.camPos;
    const v = at.clone().sub(cam);
    const d = Math.max(0.3, v.length());
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const pan = Phaser.Math.Clamp((v.dot(right) / d) * 0.9, -1, 1);
    const ahead = v.dot(fwd) / d;
    // through a shut door, everything is a little dull
    const muffle = this.mode === 'hide' && this.phase !== 'lunge' ? 0.3 : 0;
    const behind = Phaser.Math.Clamp(Math.max(0, -ahead) * 0.8 + muffle, 0, 1);
    const g = gain * Phaser.Math.Clamp(1.3 - d / 13, floor, 1);
    audio.sfx(name, g, { pan, behind });
  }

  private detect(): void {
    if (this.phase === 'detect' || this.phase === 'lunge') return;
    this.phase = 'detect';
    this.phaseT = 0;
    this.legs = [];
    audio.sfx('dun', 1);
  }

  /** He walks his legs, does what each one ends with, and is heard all the way. */
  private moveFroggy(dt: number): void {
    const m = this.monster;
    if (!m || !m.root.visible) return;
    const cam = this.camPos.clone();
    let speedWant = 0;
    let binWant = 0;
    let climbK = 0;
    let rig: ClimbRig | null = null;
    let hands: [HandGoal | null, HandGoal | null] | undefined;
    let still = 0;
    let scan = 0;
    let tilt = 0;
    let lunge = 0;
    let faceTo: THREE.Vector3 | null = null;
    let leanWant = 0;
    let crouchK = 0;

    if (this.phase === 'detect') {
      // turned on you, dead still, for one long moment
      faceTo = cam;
      still = 1;
      // down to the glass, to look at you through it
      if (this.mode === 'hide') {
        leanWant = 1;
        crouchK = 0.75;
      }
      const want = Math.atan2(cam.x - this.fpos.x, cam.z - this.fpos.z);
      this.fYaw = this.turnTo(this.fYaw, want, dt * 9);
    } else if (this.phase === 'lunge') {
      lunge = 1;
      faceTo = cam;
      const to = cam.clone().setY(0);
      const dir = to.clone().sub(this.fpos);
      const d = dir.length();
      const step = (this.mode === 'exposed' ? 6 : 7) * dt;
      if (this.mode === 'hide' && this.staffDoor && this.fpos.distanceTo(WATCH) < 1.6 && this.staffDoor.rotation.y === 0) {
        // through the door
        this.staffDoor.rotation.y = -1.6;
        audio.sfx('door_smash', 1);
      }
      if (d > 0.01) this.fpos.addScaledVector(dir.normalize(), Math.min(step, d));
      this.fYaw = this.turnTo(this.fYaw, Math.atan2(to.x - this.fpos.x, to.z - this.fpos.z), dt * 10);
      if (d < 1.25) return this.caught();
    } else if (this.legs.length && this.legs[0].over) {
      const leg = this.legs[0];
      const o = leg.over!;
      if (!this.climbing) {
        const len = Math.max(0.1, leg.to.distanceTo(this.fpos.clone().setY(0)));
        const geom: ClimbGeom = { near: o.near, far: o.far, len, top: o.top, size: FROG_SCALE };
        this.climbing = { from: this.fpos.clone().setY(0), to: leg.to.clone(), t: 0, total: climbSeconds(geom) * 1.35, geom };
        this.heard(this.fpos.clone().setY(1), 'item_thud', 0.5);
      }
      const c = this.climbing;
      c.t += dt;
      const f = climbFrame(c.t / c.total, c.geom);
      this.fpos.lerpVectors(c.from, c.to, f.s / c.geom.len);
      this.fYaw = this.turnTo(this.fYaw, Math.atan2(c.to.x - c.from.x, c.to.z - c.from.z), dt * 6);
      climbK = f.k;
      const pt = (sAlong: number, y: number, side = 0): THREE.Vector3 => {
        const ux = (c.to.x - c.from.x) / c.geom.len;
        const uz = (c.to.z - c.from.z) / c.geom.len;
        return new THREE.Vector3(c.from.x + ux * sAlong + uz * side, y, c.from.z + uz * sAlong - ux * side);
      };
      const spread = 0.34 * FROG_SCALE;
      rig = {
        k: f.k,
        hip: f.hip,
        pitch: f.pitch,
        roll: f.roll,
        top: o.top,
        feet: [pt(f.feet[0].s, f.feet[0].y, -0.24 * FROG_SCALE * f.splay), pt(f.feet[1].s, f.feet[1].y, 0.24 * FROG_SCALE * f.splay)],
        hang: [f.feet[0].hang, f.feet[1].hang],
        twist: f.twist,
        drop: f.drop,
        strain: f.strain,
        splay: f.splay,
      };
      hands = [0, 1].map((i) => {
        const p = f.hands[i];
        return p.w < 0.01 ? null : { at: pt(p.s, p.y + 0.04 * FROG_SCALE, i === 0 ? -spread : spread), weight: p.w, grip: 0.95 };
      }) as [HandGoal | null, HandGoal | null];
      // the gaze stays on the room while the body heaves
      faceTo = new THREE.Vector3(c.to.x, 1.4, c.to.z - 3);
      if (c.t >= c.total) {
        this.fpos.copy(c.to);
        this.climbing = null;
        this.legs.shift();
        this.heard(this.fpos.clone().setY(0.2), 'item_thud', 0.7);
      }
    } else if (this.legs.length) {
      const leg = this.legs[0];
      const dir = leg.to.clone().sub(this.fpos).setY(0);
      const d = dir.length();
      if (d > 0.05) {
        // ---- TURN, THEN WALK.  Facing well away from where he is going,
        // he turns on the spot first and only steps off as he comes round,
        // instead of sliding off backwards while he turns.
        const want = Math.atan2(dir.x, dir.z);
        let off = want - this.fYaw;
        while (off > Math.PI) off -= Math.PI * 2;
        while (off < -Math.PI) off += Math.PI * 2;
        const facing = Phaser.Math.Clamp((Math.cos(off) - 0.35) / 0.65, 0, 1);
        speedWant = leg.speed * facing;
        const step = leg.speed * facing * dt;
        this.fpos.addScaledVector(dir.normalize(), Math.min(step, d));
        this.fYaw = this.turnTo(this.fYaw, want, dt * (facing < 0.5 ? 3 : 2.2));
        this.holdT = leg.hold ?? 0;
        // a slow head, turning as he walks, looking
        scan = Math.sin(this.clock * 0.9) * 0.35;
      } else {
        // there: what he came to do here
        if (leg.look) {
          faceTo = leg.look;
          leanWant = leg.lean ?? 0;
          this.fYaw = this.turnTo(this.fYaw, Math.atan2(leg.look.x - this.fpos.x, leg.look.z - this.fpos.z), dt * 1.6);
        }
        if (leg.scan) scan = Math.sin(this.clock * 1.3) * 0.9;
        if (leg.bin && this.binOpen === 0) this.heard(BIN.clone().setY(0.8), 'bin_lid', 0.9);
        if (leg.bin && this.binOpen > 0.8) {
          this.binRustle -= dt;
          if (this.binRustle <= 0) {
            this.binRustle = 0.35 + Math.random() * 0.3;
            this.heard(BIN.clone().setY(0.6), 'bin_rummage', 0.8);
          }
        }
        if (leg.bin) binWant = 1;
        this.holdT -= dt;
        if (this.holdT <= 0) this.legs.shift();
      }
    } else if (this.phase === 'watch') {
      // at the door, the face at the glass, looking over the top of you: down
      // below the sill he cannot see you, and his eyes never drop to you
      faceTo = new THREE.Vector3(X1 + 2, WIN.y1 + Math.sin(this.clock * 0.7) * 0.08, DOOR_Z + Math.sin(this.clock * 0.43) * 0.25);
      this.fYaw = this.turnTo(this.fYaw, Math.PI / 2, dt * 2);
      still = 0.55 + Math.sin(this.clock * 0.6) * 0.3;
      tilt = Math.sin(this.clock * 0.37) * 0.25;
      leanWant = 0.22 + Math.max(0, Math.sin(this.clock * 0.5)) * 0.15;
    } else if (this.phase === 'lookback') {
      // the last look: round to face the storage room, and hold it
      const t = this.phaseT;
      const back = Math.atan2(X1 - this.fpos.x, DOOR_Z - this.fpos.z);
      const away = -Math.PI / 2;
      if (t < 1.6) this.fYaw = this.turnTo(this.fYaw, back, dt * 1.4);
      else if (t < 4.4) {
        faceTo = new THREE.Vector3(X1, 1.3, DOOR_Z);
        still = 1;
      } else this.fYaw = this.turnTo(this.fYaw, away, dt * 1.6);
    }

    // his steps: you hear him coming, stopping, and going
    const moved = this.fpos.distanceTo(this.fWas) / Math.max(dt, 1e-4);
    this.fWas.copy(this.fpos);
    // (the steps themselves are his footfalls: see onFootfall)

    // out of the stairwell, a second, then the head comes round to the storage door
    if (this.phase === 'burst' && this.phaseT > 0.9 && this.mode === 'hide') faceTo = new THREE.Vector3(X1, 1.5, DOOR_Z);
    // uneasy: the head snaps round to the storage door's glass
    if (this.alertLook > 0 && this.phase !== 'detect' && this.phase !== 'lunge') faceTo = new THREE.Vector3(X1, (WIN.y0 + WIN.y1) / 2, DOOR_Z);
    this.faceTo = faceTo;
    this.faceK += ((faceTo ? 1 : 0) - this.faceK) * Math.min(1, dt * 2);
    this.lean += (leanWant - this.lean) * Math.min(1, dt * 1.5);
    this.scanT = scan;
    // the bin's lid: up while he looks in, dropped with a clang after
    const wasOpen = this.binOpen;
    this.binOpen = Phaser.Math.Clamp(this.binOpen + (binWant ? 2.5 : -4) * dt, 0, 1);
    if (wasOpen > 0 && this.binOpen === 0) {
      this.heard(BIN.clone().setY(0.8), 'bin_lid', 1);
      this.heard(BIN.clone().setY(0.8), 'item_thud', 0.4);
    }
    if (this.binLid) this.binLid.rotation.x = this.binOpen * 1.7;
    m.setPose(this.fpos.x, 0, this.fpos.z, this.fYaw);
    this.footDust?.update(dt);
    m.update(dt, {
      speed: moved,
      maw: lunge ? 1 : this.phase === 'detect' ? 0.6 : 0.15,
      climb: climbK,
      climbRig: rig,
      hands,
      scan: this.scanT,
      lunge,
      constrict: 1,
      bare: lunge ? 1 : 0.4,
      still,
      tilt,
      hunch: 0.35,
      lean: this.lean,
      crouch: crouchK,
      faceTo: this.faceTo,
      faceK: this.faceK,
      reachAt: lunge ? cam : null,
      viewer: cam,
      mawRate: 4,
    });
    this.frogLight?.position.set(this.fpos.x + Math.cos(this.fYaw) * 0, 2.9, this.fpos.z);
    void speedWant;
  }

  private turnTo(from: number, to: number, k: number): number {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return from + d * Math.min(1, k);
  }

  private updateCamera(dt: number): void {
    const cam = this.stage!.camera;
    const want = this.mode === 'hide' && this.crouched ? EYE_DOWN : EYE_UP;
    this.eye += (want - this.eye) * Math.min(1, dt * 7);
    // a held breath: the smallest sway
    const sway = Math.sin(this.clock * 1.3) * 0.004;
    this.camPos.y = this.eye + sway;
    const shake = this.phase === 'burst' && this.phaseT < 0.4 ? (0.4 - this.phaseT) * 0.03 : 0;
    cam.position.set(this.camPos.x + (Math.random() - 0.5) * shake, this.camPos.y, this.camPos.z + (Math.random() - 0.5) * shake);
    this.doorwayStare(dt);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch, this.yaw, 0);
    // (dev only: a free camera, to look at things from where the player cannot)
    if (this.devCam) {
      cam.position.copy(this.devCam.at);
      cam.lookAt(this.devCam.to);
    }
  }

  // ================================================================= endings

  private caught(): void {
    if (this.phase === 'caught') return;
    this.phase = 'caught';
    this.publish('caught');
    this.scare = this.stage && this.monster ? playJumpscare3D(this, this.stage, this.monster, { floor: 0 }) : null;
    if (!this.scare) playJumpscare(this);
    this.time.delayedCall(SCARE_MS + 600, () => {
      froggyLayer.clear();
      const again = this.mode === 'hide' ? { key: 'HotelLobby3D', data: { mode: 'hide' } } : { key: 'Hotel', data: { area: 'lobby', from: 'stairs' } };
      this.scene.start('DeathScreen', { ...again, line: this.mode === 'hide' ? (this.heardYou ? 'He heard you breathing.' : 'He saw you through the glass.') : 'Nowhere to hide.' });
    });
  }

  // =================================================================== words

  private say(text: string, dur: number, red = false): void {
    const from = this.lines.length ? this.lines[this.lines.length - 1].until : this.clock;
    this.lines.push({ text, until: from + dur, red });
  }

  private paintOverlay(): void {
    while (this.lines.length && this.lines[0].until < this.clock) this.lines.shift();
    froggyLayer.paint((ctx) => {
      const intro = Math.max(0, 1 - this.clock / 0.8);
      if (intro > 0) {
        ctx.fillStyle = `rgba(0,0,0,${intro})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }
      // a dark edge to the view: you are in a cupboard
      if (this.mode === 'hide') {
        const v = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, GAME_H * 0.35, GAME_W / 2, GAME_H / 2, GAME_W * 0.62);
        v.addColorStop(0, 'rgba(0,0,0,0)');
        v.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        drawPixelText(ctx, this.crouched ? 'CROUCHING' : 'STANDING', 6, 6, { scale: 1, color: this.crouched ? '#8ab890' : '#d07060', alpha: 0.85 });
        if (!isTouch()) drawPixelText(ctx, this.crouched ? 'C: STAND' : 'C: CROUCH', 6, 14, { scale: 1, color: '#c8c0b0', alpha: 0.7 });
        this.paintNerve(ctx);
      }
      const line = this.lines[0];
      if (line) {
        const over = touchControls.overBottom();
        const cx = GAME_W / 2 + (over.left - over.right) / 2;
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
      if (this.hint) {
        const y = 44;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(GAME_W / 2 - (this.hint.length * 6) / 2 - 4, y - 3, this.hint.length * 6 + 7, 13);
        drawPixelText(ctx, this.hint, GAME_W / 2, y, { scale: 1, color: '#f0d890', center: true });
      }
    });
  }

  /**
   * ---- WHERE HE IS, at a glance.  When he is out of your view, a marker at
   * that edge of the screen that pulses with each of his footsteps, brighter
   * the closer he is.  (No line saying what he is up to -- searching, at the
   * door, looking back: you find that out by listening and looking, which is
   * the whole of hiding.)
   */
  private paintCues(ctx: CanvasRenderingContext2D): void {
    const m = this.monster;
    if (!m?.root.visible) return;
    const near = this.nearK();
    // which way he is from where you are looking
    const v = this.fpos.clone().sub(this.camPos).setY(0);
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const rel = Math.atan2(v.dot(right), v.dot(fwd));
    if (Math.abs(rel) < 0.55) return; // in view: you can see him
    const side = rel > 0 ? 1 : -1;
    const since = this.lastStep ? this.clock - this.lastStep.t : 9;
    const beat = Math.max(0, 1 - since / 0.45);
    const a = 0.35 + near * 0.35 + beat * 0.4;
    const ex = side > 0 ? GAME_W - 10 : 10;
    const ey = GAME_H / 2;
    ctx.fillStyle = `rgba(255,${Math.round(200 - near * 120)},${Math.round(120 - near * 90)},${a.toFixed(2)})`;
    // an arrowhead pointing off the edge, and a footprint behind it
    for (let k = 0; k < 6; k++) ctx.fillRect(ex + side * k - (side > 0 ? 0 : 0), ey - 6 + k, 1, 12 - k * 2);
    ctx.fillRect(ex - side * 7, ey - 3, 3, 5);
    ctx.fillRect(ex - side * 6, ey - 5, 1, 1);
    ctx.fillRect(ex - side * 8, ey - 5, 1, 1);
    if (beat > 0.2) drawPixelText(ctx, 'STEPS', side > 0 ? ex - 40 : ex + 6, ey + 8, { scale: 1, color: '#f0d0a0', alpha: beat });
  }

  /** The stress meter, the check in progress, and how the last one went. */
  private paintNerve(ctx: CanvasRenderingContext2D): void {
    if (this.hideT <= 0) return;
    // the edges close in as it climbs, in time with the breathing
    if (this.stress > 0.3) {
      const pulse = 0.5 + 0.5 * Math.sin(this.clock * (2 + this.stress * 5));
      const a = (this.stress - 0.3) * 0.5 * (0.7 + 0.3 * pulse);
      const v = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, GAME_H * 0.25, GAME_W / 2, GAME_H / 2, GAME_W * 0.55);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(40,0,0,${a.toFixed(3)})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, GAME_W, GAME_H);
    }
    const x = 6;
    const y = isTouch() ? 16 : 24;
    drawPixelText(ctx, 'STRESS', x, y, { scale: 1, color: '#c8c0b0', alpha: 0.8 });
    // the gauge: a dark glass channel with the fill lit inside it
    gauge(ctx, x, y + 9, 52, 5);
    const sc = this.stress < 0.5 ? '#7fd88a' : this.stress < NERVE.loud ? '#f0d060' : '#ff6050';
    const sw = Math.round(50 * this.stress);
    if (sw > 0) {
      lit(ctx, x + 1, y + 10, sw, 3, sc);
    }

    // how long is left to hold out, under the stress bar
    if (this.hideClock < HUNT.seconds && this.phase !== 'detect' && this.phase !== 'lunge') {
      const left = Math.ceil(HUNT.seconds - this.hideClock);
      drawPixelText(ctx, `HOLD ON ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, x, y + 18, { scale: 1, color: '#c8c0b0', alpha: 0.8 });
    }
    // past three quarters, a warning: at the end of the bar he hears you
    if (this.stress > 0.8 && Math.sin(this.clock * 9) > -0.2) {
      drawPixelText(ctx, 'TOO STRESSED - HE WILL HEAR YOU', GAME_W / 2, 64, { scale: 1, color: '#ff6050', center: true });
    }
    this.paintCues(ctx);

    const c = this.check;
    if (c) {
      const w = 150;
      const bx = Math.round(GAME_W / 2 - w / 2);
      const by = 128;
      const live = checkLive(c);
      // ---- the plate: dark glass, a lit top edge, a shadow under it; it
      // lights up the moment the key goes down, so a press is felt
      plate(ctx, bx - 8, by - 30, w + 16, 56);
      if (this.clock - this.pressedAt < 0.16) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(bx - 8, by - 30, w + 16, 1);
        ctx.fillRect(bx - 8, by + 25, w + 16, 1);
        ctx.fillRect(bx - 8, by - 30, 1, 56);
        ctx.fillRect(bx + w + 7, by - 30, 1, 56);
      }
      drawPixelText(ctx, CHECK_TITLE[c.kind], GAME_W / 2, by - 25, { scale: 1, color: '#f6e3a4', center: true });
      // ---- the track: a channel sunk into the plate, the bands lit in it
      const ty = by - 14;
      const th = 10;
      gauge(ctx, bx - 1, ty - 1, w + 2, th + 2);
      const zone = (z: [number, number], col: string): void => {
        const zx = bx + Math.round(z[0] * w);
        const zw = Math.max(1, Math.round((z[1] - z[0]) * w));
        lit(ctx, zx, ty, zw, th, col);
      };
      zone([0, 1], '#8c2a24');
      if (c.kind === 'react') {
        zone([0, 1], c.pos >= 1 ? '#3fb455' : '#8c2a24');
      } else {
        zone(c.yellow, '#c8a634');
        // the green glows while the line is in it: now is the moment
        zone(c.green, live?.good ? '#6ff08a' : '#3fb455');
        // the band edges, so where one ends and the next begins is plain
        for (const e of [c.yellow[0], c.yellow[1], c.green[0], c.green[1]]) {
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(bx + Math.round(e * w), ty, 1, th);
        }
        // a hold fills the bar as you hold it
        if (c.kind === 'hold' && c.pos > 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.28)';
          ctx.fillRect(bx, ty + 2, Math.round(c.pos * w), th - 4);
        }
      }
      // the glass over the whole channel: bright along the top, dim at the foot
      const gloss = ctx.createLinearGradient(0, ty, 0, ty + th);
      gloss.addColorStop(0, 'rgba(255,255,255,0.30)');
      gloss.addColorStop(0.42, 'rgba(255,255,255,0.07)');
      gloss.addColorStop(0.46, 'rgba(0,0,0,0.12)');
      gloss.addColorStop(1, 'rgba(0,0,0,0.32)');
      ctx.fillStyle = gloss;
      ctx.fillRect(bx, ty, w, th);
      if (c.kind !== 'react') {
        // ---- the needle: a bright blade with its own glow and a dark edge
        // (green-white while it is in the green)
        const mx = bx + Math.round(c.pos * w);
        const glow = ctx.createRadialGradient(mx, ty + th / 2, 0, mx, ty + th / 2, 9);
        glow.addColorStop(0, live?.good ? 'rgba(160,255,170,0.7)' : 'rgba(255,255,255,0.45)');
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(mx - 9, ty - 4, 18, th + 8);
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(mx - 2, ty - 3, 4, th + 6);
        ctx.fillStyle = live?.good ? '#d8ffd8' : '#ffffff';
        ctx.fillRect(mx - 1, ty - 2, 2, th + 4);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(mx - 1, ty - 4, 2, 2);
        ctx.fillRect(mx - 1, ty + th + 2, 2, 2);
      }
      // ---- what to do, in two lines; the second is the live word while it plays
      const act = isTouch() ? 'CALM' : 'SPACE';
      const [what, how] = checkHow(c.kind, act);
      drawPixelText(ctx, what, GAME_W / 2, by + 1, { scale: 1, color: '#d4ccbc', center: true });
      if (live && (live.good || c.kind === 'react' || c.kind === 'hold')) {
        drawPixelText(ctx, live.text, GAME_W / 2, by + 10, { scale: 1, color: live.good ? '#7fff8f' : '#f0d060', center: true });
      } else drawPixelText(ctx, how, GAME_W / 2, by + 10, { scale: 1, color: '#f6e3a4', center: true });
      // the time it has left, as a thin lit line under it all
      const left = Math.round(w * Math.max(0, 1 - c.t / c.dur));
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx, by + 20, w, 2);
      if (left > 0) {
        const tl = ctx.createLinearGradient(bx, 0, bx + left, 0);
        tl.addColorStop(0, 'rgba(255,255,255,0.35)');
        tl.addColorStop(1, 'rgba(255,255,255,0.8)');
        ctx.fillStyle = tl;
        ctx.fillRect(bx, by + 20, left, 2);
      }
    }
    const f = this.flash;
    if (f && f.until > this.clock) {
      // (over the gauge's box, not on its title)
      const fy = 84;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(GAME_W / 2 - (f.text.length * 6) / 2 - 3, fy - 2, f.text.length * 6 + 5, 11);
      drawPixelText(ctx, f.text, GAME_W / 2, fy, { scale: 1, color: f.colour, center: true });
    }
  }

  // ==================================================================== misc

  private publish(outcome?: string): void {
    if (!import.meta.env?.DEV) return;
    const w = window as unknown as Record<string, Record<string, unknown>>;
    const t = w.__lobby ?? {};
    Object.assign(t, {
      mode: this.mode,
      phase: this.phase,
      phaseT: this.phaseT,
      crouched: this.crouched,
      eye: this.eye,
      fx: this.fpos.x,
      fz: this.fpos.z,
      watchFor: this.watchFor,
      hideClock: this.hideClock,
      watched: this.watched,
      sus: this.sus,
      stress: this.stress,
      check: this.check ? { kind: this.check.kind, pos: this.check.pos, green: this.check.green } : null,
      sawYou: this.sawYou,
      outcome: outcome ?? t.outcome,
    });
    w.__lobby = t;
  }

  private bridge(): void {
    const w = window as unknown as Record<string, Record<string, unknown>>;
    w.__lobby = {
      crouch: (v: boolean) => {
        this.crouched = v;
      },
      cam: (at: number[] | null, to?: number[]) => {
        this.devCam = at && to ? { at: new THREE.Vector3(...at), to: new THREE.Vector3(...to) } : null;
      },
      froggy: () => ({ x: this.fpos.x, z: this.fpos.z, climbing: !!this.climbing }),
      look: (yaw: number, pitch: number) => {
        this.yaw = yaw;
        this.pitch = pitch;
        this.lookedAt = this.clock;
      },
      calm: (down: boolean) => this.calmKey(down),
      setStress: (v: number) => {
        this.stress = v;
      },
      forceCheck: () => {
        this.checkIn = 0;
      },
      skip: (phase: Phase) => {
        this.phaseT = 99;
        if (phase === 'approach') {
          if (this.phase === 'settle') this.burst();
          this.legs = [];
          this.phase = 'search';
          this.fpos.set(5, 0, DOOR_Z);
        }
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
