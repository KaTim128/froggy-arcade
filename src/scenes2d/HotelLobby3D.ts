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

import Phaser from 'phaser';
import * as THREE from 'three';
import { lookScale } from '../core/look';
import { isPaused } from '../core/pause';
import { audio, SILENCE } from '../core/audio';
import { isTouch } from '../core/device';
import { froggyLayer } from '../render/froggyLayer';
import { drawPixelText } from '../render/pixelFont';
import { playJumpscare, SCARE_MS } from '../froggy/jumpscare';
import { playJumpscare3D, type Scare3D } from '../froggy/jumpscare3d';
import { FroggyMonster } from '../three/froggyMonster';
import { ThreeStage } from '../render/threeStage';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { touchControls } from '../ui/touchControls';
import { texBlock, texCarpet, texConcrete, texLiftDoors, texSign, texWainscot, texWallpaper } from '../art/hotelInterior';

/** 2D lobby x to 3D metres along it. */
const lx = (px: number): number => (px - 200) * 0.05;

const X0 = -10; // the front doors' end
const X1 = 11; // the storage room's end
const DEPTH = 7;
const CEIL = 4;
const DADO = 1;
const DESK_X = lx(160);
const STAIR_X = lx(238);
const LIFT_X = lx(280);
/** The storage room door, in the end wall, and its little window. */
const DOOR_Z = 3.4;
const DOOR_W = 0.9;
const DOOR_H = 2.1;
const WIN = { w: 0.42, y0: 1.4, y1: 1.7 };
/** Where you are in there, and how high your eyes are. */
const HIDE = { x: X1 + 0.38, z: DOOR_Z };
const EYE_UP = 1.62;
const EYE_DOWN = 1.0;
/** Where he stands to stare at the door. */
const WATCH = new THREE.Vector3(X1 - 1.15, 0, DOOR_Z);
const FROG_SCALE = 1.25;

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
}

/** Along the front wall, on your left from the storage room: a sofa, its table, a bin. */
const SOFA_X = 2.6;
const BIN = new THREE.Vector3(7.2, 0, DEPTH - 0.45);

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

/** Polished marble: big pale tiles with grey veins. */
function texMarble(): HTMLCanvasElement {
  let seed = 3;
  const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return canvas(256, 256, (g) => {
    g.fillStyle = '#e4ddd0';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? '#ddd5c6' : '#e8e2d6';
        g.fillRect(i * 128 + 1, j * 128 + 1, 126, 126);
      }
    g.strokeStyle = 'rgba(120,112,100,0.35)';
    for (let k = 0; k < 14; k++) {
      g.lineWidth = 0.6 + rnd();
      g.beginPath();
      let x = rnd() * 256;
      let y = rnd() * 256;
      g.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (rnd() - 0.3) * 40;
        y += (rnd() - 0.5) * 30;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.fillStyle = 'rgba(90,84,74,0.6)';
    g.fillRect(0, 0, 256, 1);
    g.fillRect(0, 128, 256, 1);
    g.fillRect(0, 0, 1, 256);
    g.fillRect(128, 0, 1, 256);
  });
}

/** Walnut with raised panels, for the desk front and the stairwell door. */
function texPanels(cols: number, rows: number, w = 256, h = 128): HTMLCanvasElement {
  return canvas(w, h, (g) => {
    g.fillStyle = '#5a3a22';
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 60; k++) {
      g.fillStyle = `rgba(30,16,8,${0.08 + (k % 4) * 0.03})`;
      g.fillRect(0, (k * 37) % h, w, 1);
    }
    const pw = w / cols;
    const ph = h / rows;
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const x = i * pw + pw * 0.12;
        const y = j * ph + ph * 0.14;
        g.fillStyle = '#6e4a2c';
        g.fillRect(x, y, pw * 0.76, ph * 0.72);
        g.fillStyle = 'rgba(255,220,160,0.18)';
        g.fillRect(x, y, pw * 0.76, 2);
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(x, y + ph * 0.72 - 2, pw * 0.76, 2);
        g.fillStyle = '#c9a24a';
        g.fillRect(x + pw * 0.33, y + ph * 0.3, pw * 0.1, ph * 0.1);
      }
  });
}

/** The pigeonholes behind the desk, keys hanging in most of them. */
function texPigeonholes(): HTMLCanvasElement {
  return canvas(192, 128, (g) => {
    g.fillStyle = '#3a2414';
    g.fillRect(0, 0, 192, 128);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 6; c++) {
        const x = 6 + c * 31;
        const y = 6 + r * 30;
        g.fillStyle = '#24160c';
        g.fillRect(x, y, 27, 26);
        g.fillStyle = '#7a5232';
        g.fillRect(x, y + 24, 27, 2);
        if ((r * 6 + c) % 3 !== 1) {
          g.fillStyle = '#ecd07a';
          g.fillRect(x + 12, y + 4, 3, 10);
          g.fillStyle = '#c9a24a';
          g.fillRect(x + 9, y + 12, 9, 7);
        }
      }
  });
}

/** The stairwell door: a heavy fire door with a wired-glass slit and a push bar. */
function texStairDoor(): HTMLCanvasElement {
  return canvas(128, 256, (g) => {
    g.fillStyle = '#7a5a3a';
    g.fillRect(0, 0, 128, 256);
    for (let k = 0; k < 50; k++) {
      g.fillStyle = `rgba(40,22,10,${0.06 + (k % 3) * 0.03})`;
      g.fillRect((k * 23) % 128, 0, 1, 256);
    }
    g.fillStyle = '#6a4a2e';
    g.fillRect(14, 120, 100, 50);
    g.fillRect(14, 180, 100, 60);
    g.fillStyle = '#8a6a24';
    g.fillRect(44, 18, 40, 76);
    g.fillStyle = '#1e2630';
    g.fillRect(48, 22, 32, 68);
    g.strokeStyle = 'rgba(120,140,160,0.6)';
    for (let y = 22; y < 90; y += 10) {
      g.beginPath();
      g.moveTo(48, y);
      g.lineTo(80, y);
      g.stroke();
    }
    g.fillStyle = '#c8c8c0';
    g.fillRect(10, 150, 108, 8);
    g.fillStyle = '#c9a24a';
    g.fillRect(4, 236, 120, 16);
  });
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

/** Through the front doors: the night, a street lamp, the trees. */
function texNight(): HTMLCanvasElement {
  return canvas(256, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#04060e');
    grad.addColorStop(0.6, '#0c1426');
    grad.addColorStop(1, '#141a22');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#05080a';
    for (let k = 0; k < 9; k++) {
      const x = k * 32 - 8;
      g.beginPath();
      g.moveTo(x, 170);
      g.lineTo(x + 20, 80 + (k % 3) * 20);
      g.lineTo(x + 40, 170);
      g.fill();
    }
    g.fillStyle = '#2a2e34';
    g.fillRect(0, 200, 256, 56);
    const lamp = g.createRadialGradient(190, 120, 2, 190, 120, 70);
    lamp.addColorStop(0, 'rgba(255,220,160,0.7)');
    lamp.addColorStop(1, 'rgba(255,220,160,0)');
    g.fillStyle = lamp;
    g.fillRect(100, 40, 180, 180);
    g.fillStyle = '#3a3e44';
    g.fillRect(188, 120, 3, 90);
  });
}

export class HotelLobby3D extends Phaser.Scene {
  private stage: ThreeStage | null = null;
  private monster: FroggyMonster | null = null;
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
  private stepT = 0;
  private watchFor = 6;
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
  private staffDoor: THREE.Group | null = null;
  private binLid: THREE.Group | null = null;
  private binOpen = 0;
  private bulb: THREE.PointLight | null = null;
  private bits: Array<{ m: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; rest: boolean; half: number }> = [];
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
    this.stairFly = null;
    this.crouched = false;
    this.eye = EYE_UP;
    this.faceTo = null;
    this.faceK = 0;
    this.lean = 0;
    this.holdT = 0;
    this.bangT = 0.6;
    this.heartT = 0;
    // a different wait every time: he cannot be timed
    this.watchFor = 5 + Math.random() * 3;

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
    }
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.event instanceof MouseEvent && document.pointerLockElement) this.turn(p.event.movementX * 0.0027, p.event.movementY * 0.0027);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > GAME_H * 0.62 && this.lines.length) this.lines.shift();
    });
    this.onLookDown = (e: MouseEvent) => {
      if (e.button === 0 && !isPaused()) this.dragging = true;
    };
    this.onLookMove = (e: MouseEvent) => {
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
    this.game.canvas.addEventListener('click', () => {
      void this.game.canvas.requestPointerLock?.();
    });

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
    S.background = new THREE.Color(0x040508);
    S.fog = new THREE.FogExp2(0x05060a, 0.045);
    S.add(new THREE.HemisphereLight(0x3a3a52, 0x0c0a08, 0.5));
    S.add(st.camera);

    this.buildLobby(S);
    this.buildStorage(S);

    this.monster = new FroggyMonster(FROG_SCALE);
    this.monster.root.visible = false;
    S.add(this.monster.root);
    // a cold light that goes with him, so his face reads in the dark
    this.frogLight = new THREE.PointLight(0xb8c4e0, 4.5, 6, 1.5);
    S.add(this.frogLight);
  }

  private buildLobby(S: THREE.Scene): void {
    const paperT = tex(texWallpaper());
    const panelT = tex(texWainscot());
    const paper = (len: number): THREE.MeshLambertMaterial => {
      const t = paperT.clone();
      t.repeat.set(len, 1);
      t.needsUpdate = true;
      return new THREE.MeshLambertMaterial({ map: t });
    };
    const panel = (len: number): THREE.MeshLambertMaterial => {
      const t = panelT.clone();
      t.repeat.set(len, 1);
      t.needsUpdate = true;
      return new THREE.MeshLambertMaterial({ map: t });
    };
    const brass = new THREE.MeshLambertMaterial({ color: 0xc9a24a });
    const cream = new THREE.MeshLambertMaterial({ color: 0xe8dcc0 });
    const wood = new THREE.MeshLambertMaterial({ color: 0x4a2e18 });

    /** A stretch of wall: wallpaper over wainscot, from a to b along it. */
    const wall = (a: number, b: number, at: (m: THREE.Mesh, mid: number) => void, top = CEIL, bottom = 0): void => {
      const len = b - a;
      if (len <= 0.001) return;
      const mid = (a + b) / 2;
      if (top > DADO) {
        const lo = Math.max(DADO, bottom);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(len, top - lo), paper(len));
        m.position.y = (top + lo) / 2;
        at(m, mid);
        S.add(m);
      }
      if (bottom < DADO) {
        const hi = Math.min(DADO, top);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(len, hi - bottom), panel(len));
        m.position.y = (hi + bottom) / 2;
        at(m, mid);
        S.add(m);
      }
    };
    const back = (m: THREE.Mesh, mid: number): void => {
      m.position.x = mid;
      m.position.z = 0;
    };
    // the back wall, with the stairwell door's opening in it
    const sd0 = STAIR_X - 0.55;
    const sd1 = STAIR_X + 0.55;
    wall(X0, sd0, back);
    wall(sd1, X1, back);
    wall(sd0, sd1, back, CEIL, 2.25);
    // the front wall
    wall(X0, X1, (m, mid) => {
      m.position.x = mid;
      m.position.z = DEPTH;
      m.rotation.y = Math.PI;
    });
    // the front doors' end, with the doors' opening
    const fd0 = DOOR_Z - 0.85;
    const fd1 = DOOR_Z + 0.85;
    const left = (m: THREE.Mesh, mid: number): void => {
      m.position.x = X0;
      m.position.z = mid;
      m.rotation.y = Math.PI / 2;
    };
    wall(0, fd0, left);
    wall(fd1, DEPTH, left);
    wall(fd0, fd1, left, CEIL, 2.7);
    // the storage room's end, with its door's opening
    const sr0 = DOOR_Z - DOOR_W / 2;
    const sr1 = DOOR_Z + DOOR_W / 2;
    const right = (m: THREE.Mesh, mid: number): void => {
      m.position.x = X1;
      m.position.z = mid;
      m.rotation.y = -Math.PI / 2;
    };
    wall(0, sr0, right);
    wall(sr1, DEPTH, right);
    wall(sr0, sr1, right, CEIL, DOOR_H);

    // floor, runner, ceiling, crown
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, DEPTH), new THREE.MeshLambertMaterial({ map: tex(texMarble(), (X1 - X0) / 2.4, DEPTH / 2.4) }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((X0 + X1) / 2, 0, DEPTH / 2);
    S.add(floor);
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 - 1, 1.1), new THREE.MeshLambertMaterial({ map: tex(texCarpet(), (X1 - X0 - 1) / 1.1, 1) }));
    runner.rotation.x = -Math.PI / 2;
    runner.position.set((X0 + X1) / 2, 0.006, DOOR_Z);
    S.add(runner);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, DEPTH), new THREE.MeshLambertMaterial({ color: 0xd8cfb8 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set((X0 + X1) / 2, CEIL, DEPTH / 2);
    S.add(ceil);
    for (const z of [0.04, DEPTH - 0.04]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, 0.14, 0.08), cream);
      c.position.set((X0 + X1) / 2, CEIL - 0.07, z);
      S.add(c);
      const r = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, 0.05, 0.05), brass);
      r.position.set((X0 + X1) / 2, DADO, z);
      S.add(r);
    }

    // ---- the reception desk, the sign, the pigeonholes, the clocks
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.1, 0.7), [
      wood,
      wood,
      wood,
      wood,
      new THREE.MeshLambertMaterial({ map: tex(texPanels(3, 1)) }),
      wood,
    ]);
    desk.position.set(DESK_X, 0.55, 1.5);
    S.add(desk);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.75, 0.06, 0.82), new THREE.MeshLambertMaterial({ color: 0xece6da }));
    top.position.set(DESK_X, 1.13, 1.5);
    S.add(top);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.1, 12), new THREE.MeshLambertMaterial({ color: 0x2e7a4a, emissive: 0x123a20 }));
    shade.position.set(DESK_X - 1.2, 1.5, 1.4);
    S.add(shade);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.32, 6), brass);
    stem.position.set(DESK_X - 1.2, 1.3, 1.4);
    S.add(stem);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), brass);
    bell.position.set(DESK_X + 1.0, 1.16, 1.65);
    S.add(bell);
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.3), new THREE.MeshLambertMaterial({ color: 0x5a1a22 }));
    book.position.set(DESK_X - 0.4, 1.17, 1.6);
    S.add(book);
    const holes = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7), new THREE.MeshLambertMaterial({ map: tex(texPigeonholes()) }));
    holes.position.set(DESK_X, 2.25, 0.02);
    S.add(holes);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.5), new THREE.MeshLambertMaterial({ map: tex(texSign('RECEPTION', '#5a3a22', '#ecd07a', 512, 96)) }));
    sign.position.set(DESK_X, 3.45, 0.02);
    S.add(sign);
    for (const dx of [-1.9, 1.9]) {
      const clock = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), new THREE.MeshLambertMaterial({ color: 0xf0e8d8 }));
      clock.position.set(DESK_X + dx, 2.9, 0.02);
      S.add(clock);
      const rim = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.26, 20), brass);
      rim.position.set(DESK_X + dx, 2.9, 0.021);
      S.add(rim);
    }
    // columns framing the desk
    for (const px of [104, 216]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, CEIL, 16), cream);
      col.position.set(lx(px), CEIL / 2, 0.32);
      S.add(col);
      for (const y of [0.1, CEIL - 0.15]) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.62), y < 1 ? cream : brass);
        cap.position.set(lx(px), y, 0.32);
        S.add(cap);
      }
    }

    // ---- the stairwell door, the dark behind it, the green sign over it
    const stairOpening = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.25, 1.2), new THREE.MeshBasicMaterial({ color: 0x020203, side: THREE.BackSide }));
    stairOpening.position.set(STAIR_X, 1.125, -0.6);
    S.add(stairOpening);
    const frame = new THREE.MeshLambertMaterial({ color: 0x2a1a0e });
    for (const [w, h, x, y] of [
      [0.08, 2.3, STAIR_X - 0.59, 1.15],
      [0.08, 2.3, STAIR_X + 0.59, 1.15],
      [1.26, 0.1, STAIR_X, 2.3],
    ] as const) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), frame);
      f.position.set(x, y, 0.03);
      S.add(f);
    }
    this.stairDoor = new THREE.Group();
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.08, 2.23, 0.06), [wood, wood, wood, wood, new THREE.MeshLambertMaterial({ map: tex(texStairDoor()) }), wood]);
    leaf.position.set(0.54, 1.115, 0);
    this.stairDoor.add(leaf);
    this.stairDoor.position.set(STAIR_X - 0.54, 0, 0.04);
    S.add(this.stairDoor);
    const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.22), new THREE.MeshBasicMaterial({ map: tex(texSign('STAIRS', '#0e7a3e', '#e8ffe8', 256, 96)) }));
    exit.position.set(STAIR_X, 2.62, 0.03);
    S.add(exit);
    const green = new THREE.PointLight(0x40ff90, 1.6, 4, 1.6);
    green.position.set(STAIR_X, 2.5, 0.5);
    S.add(green);

    // ---- the lift, dead
    const lift = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.5), new THREE.MeshLambertMaterial({ map: tex(texLiftDoors()) }));
    lift.position.set(LIFT_X, 1.25, 0.02);
    S.add(lift);
    for (const [w, h, x, y] of [
      [0.1, 2.6, LIFT_X - 0.9, 1.3],
      [0.1, 2.6, LIFT_X + 0.9, 1.3],
      [1.9, 0.12, LIFT_X, 2.6],
    ] as const) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), brass);
      f.position.set(x, y, 0.04);
      S.add(f);
    }
    const dial = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.26, 0.04), new THREE.MeshLambertMaterial({ color: 0x141820 }));
    dial.position.set(LIFT_X, 2.95, 0.03);
    S.add(dial);

    // ---- along the front wall: a sofa, a low table, and a bin with a lid
    const leather = new THREE.MeshLambertMaterial({ color: 0x5a2a22 });
    const sz = DEPTH - 0.5;
    for (const [w, h, d, x, y, z] of [
      [2.0, 0.42, 0.85, SOFA_X, 0.3, sz],
      [2.0, 0.75, 0.2, SOFA_X, 0.72, sz + 0.33],
      [0.2, 0.6, 0.85, SOFA_X - 1.0, 0.45, sz],
      [0.2, 0.6, 0.85, SOFA_X + 1.0, 0.45, sz],
    ] as const) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), leather);
      b.position.set(x, y, z);
      S.add(b);
    }
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.6), wood);
    tableTop.position.set(SOFA_X, 0.42, sz - 1.0);
    S.add(tableTop);
    for (const [dx, dz] of [[-0.52, -0.24], [0.52, -0.24], [-0.52, 0.24], [0.52, 0.24]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), wood);
      leg.position.set(SOFA_X + dx, 0.2, sz - 1.0 + dz);
      S.add(leg);
    }
    const steel = new THREE.MeshLambertMaterial({ color: 0x6a6e72 });
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.75, 16), steel);
    can.position.set(BIN.x, 0.375, BIN.z);
    S.add(can);
    const inside = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), new THREE.MeshBasicMaterial({ color: 0x0a0a0a }));
    inside.rotation.x = -Math.PI / 2;
    inside.position.set(BIN.x, 0.74, BIN.z);
    S.add(inside);
    // the lid, hinged at the wall side
    const lid = new THREE.Group();
    lid.position.set(BIN.x, 0.76, BIN.z + 0.24);
    const lidTop = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 16), steel);
    lidTop.position.set(0, 0.02, -0.24);
    lid.add(lidTop);
    const lidKnob = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.04), brass);
    lidKnob.position.set(0, 0.07, -0.24);
    lid.add(lidKnob);
    S.add(lid);
    this.binLid = lid;

    // ---- the armchair, the lamp beside it, the trolley past the lift
    const velvet = new THREE.MeshLambertMaterial({ color: 0x2e5a48 });
    const cx = lx(69);
    for (const [w, h, d, x, y, z] of [
      [0.9, 0.42, 0.8, cx, 0.32, 0.9],
      [0.9, 0.8, 0.18, cx, 0.75, 0.55],
      [0.16, 0.6, 0.8, cx - 0.48, 0.5, 0.9],
      [0.16, 0.6, 0.8, cx + 0.48, 0.5, 0.9],
    ] as const) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), velvet);
      b.position.set(x, y, z);
      S.add(b);
    }
    const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.5, 6), brass);
    lampPole.position.set(lx(92), 0.75, 0.5);
    S.add(lampPole);
    const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.3, 14), new THREE.MeshLambertMaterial({ color: 0xf0e0b8, emissive: 0x3a2a10 }));
    lampShade.position.set(lx(92), 1.6, 0.5);
    S.add(lampShade);
    const lampLight = new THREE.PointLight(0xffc880, 1.4, 4.5, 1.6);
    lampLight.position.set(lx(92), 1.45, 0.8);
    S.add(lampLight);
    const tx = lx(336);
    for (const dx of [-0.55, 0.55]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 6), brass);
      pole.position.set(tx + dx, 0.95, 0.5);
      S.add(pole);
    }
    const arch = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 0.05), brass);
    arch.position.set(tx, 1.85, 0.5);
    S.add(arch);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.6), brass);
    base.position.set(tx, 0.12, 0.5);
    S.add(base);
    for (const [w, h, x, col] of [
      [0.55, 0.75, -0.2, 0x5a2a3a],
      [0.4, 0.55, 0.3, 0x2a3a5a],
    ] as const) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), new THREE.MeshLambertMaterial({ color: col }));
      bag.position.set(tx + x, 0.15 + h / 2, 0.5);
      S.add(bag);
    }

    // ---- the front doors, the night through them
    const night = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ map: tex(texNight()), fog: false }));
    night.position.set(X0 - 3, 1.6, DOOR_Z);
    night.rotation.y = Math.PI / 2;
    S.add(night);
    const porch = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshLambertMaterial({ color: 0x2a2e34 }));
    porch.rotation.x = -Math.PI / 2;
    porch.position.set(X0 - 1.5, 0, DOOR_Z);
    S.add(porch);
    const glass = new THREE.MeshLambertMaterial({ color: 0x8aa8c8, transparent: true, opacity: 0.22 });
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      const hingeZ = DOOR_Z + side * 0.85;
      g.position.set(X0, 0, hingeZ);
      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.5, 0.78), glass);
      pane.position.set(0, 1.3, -side * 0.42);
      g.add(pane);
      for (const [h, y] of [
        [0.1, 0.06],
        [0.08, 2.58],
      ] as const) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.84), brass);
        rail.position.set(0, y, -side * 0.42);
        g.add(rail);
      }
      for (const dz of [0.02, 0.82]) {
        const stile = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.6, 0.05), brass);
        stile.position.set(0, 1.3, -side * dz);
        g.add(stile);
      }
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.03), brass);
      handle.position.set(0.04, 1.1, -side * 0.78);
      g.add(handle);
      S.add(g);
      this.frontLeaves.push(g);
    }
    const moon = new THREE.PointLight(0x7f9ccf, 5, 12, 1.4);
    moon.position.set(X0 + 0.6, 2.4, DOOR_Z);
    S.add(moon);
    // what light is left on: a sconce or two, very low
    for (const x of [lx(104), lx(216), lx(404)]) {
      const sc = new THREE.PointLight(0xffb070, 0.9, 5, 1.6);
      sc.position.set(x, 2.6, 0.5);
      S.add(sc);
    }
    const deskGlow = new THREE.PointLight(0xa0ffb0, 0.8, 3, 1.6);
    deskGlow.position.set(DESK_X - 1.2, 1.35, 1.7);
    S.add(deskGlow);
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
    touchControls.showButton('E', this.phase === 'gone');
  }

  /** Standing up where he could see you. */
  private standing(): boolean {
    return this.eye > 1.3;
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
    if (this.mode === 'hide' && (this.phase === 'search' || (this.phase === 'burst' && this.phaseT > 0.6)) && this.standing()) return this.detect();
    if (this.phase === 'burst' && this.phaseT > 1.6) {
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
    if (this.phase === 'search' && this.legs.length === 0) {
      this.phase = 'approach';
      this.phaseT = 0;
      this.legs = [
        { to: new THREE.Vector3(2.5, 0, 3.3), speed: 1.0 },
        { to: new THREE.Vector3(7.6, 0, DOOR_Z), speed: 0.9 },
        { to: WATCH.clone(), speed: 0.55 },
      ];
    }
    if (this.phase === 'approach') {
      // coming at the door, and you are still on your feet
      if (this.standing()) return this.detect();
      if (this.legs.length === 0) {
        this.phase = 'watch';
        this.phaseT = 0;
        audio.sfx('eerie_swell', 0.35);
      }
    }
    if (this.phase === 'watch') {
      if (this.standing()) return this.detect();
      // the heart, going hard, and nothing else
      this.heartT -= dt;
      if (this.heartT <= 0) {
        this.heartT = 0.62;
        audio.heartbeat(0.55);
      }
      if (this.phaseT > this.watchFor) {
        this.phase = 'leave';
        this.phaseT = 0;
        this.legs = [{ to: new THREE.Vector3(X0 + 2.2, 0, DOOR_Z), speed: 1.2 }];
      }
      return;
    }
    if (this.phase === 'leave' && this.legs.length === 0) {
      this.phase = 'lookback';
      this.phaseT = 0;
      audio.sfx('floor_creak', 0.3);
    }
    if (this.phase === 'lookback') {
      // the last look back at the door: quiet, and long
      if (this.phaseT > 1.6 && this.phaseT < 4.4 && this.standing()) return this.detect();
      if (this.phaseT > 5.2) {
        this.phase = 'exit';
        this.phaseT = 0;
        this.legs = [{ to: new THREE.Vector3(X0 + 0.5, 0, DOOR_Z), speed: 1.4 }];
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

  /** The search: out of the stairwell, the counter, the chairs, the floor. */
  private searchPlan(): Leg[] {
    const behindDesk = new THREE.Vector3(DESK_X + 0.3, 0.7, 0.9);
    return [
      { to: new THREE.Vector3(STAIR_X, 0, 1.7), speed: 0.7, hold: 2.4, scan: true },
      { to: new THREE.Vector3(DESK_X + 0.5, 0, 2.45), speed: 0.85, look: behindDesk, lean: 0.6, hold: 3.0 },
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

  /** The front doors: through them, glass everywhere. */
  private smashFront(): void {
    audio.sfx('glass_shatter', 0.9);
    audio.sfx('door_smash', 0.8);
    this.frontFly = this.frontLeaves.map((_, i) => ({ v: new THREE.Vector3(-3.4, 1.2, (i ? 1 : -1) * 1.1), spin: 3 }));
    this.debris(new THREE.Vector3(X0, 1.3, DOOR_Z), new THREE.Vector3(-1, 0, 0), 0x9ab8d8, true);
  }

  private debris(at: THREE.Vector3, dir: THREE.Vector3, col: number, glass = false): void {
    const S = this.stage?.scene;
    if (!S) return;
    const mat = new THREE.MeshLambertMaterial({ color: col, transparent: glass, opacity: glass ? 0.6 : 1 });
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
        if (b.v.length() < 0.4) b.rest = true;
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
  private heard(at: THREE.Vector3, name: Parameters<typeof audio.sfx>[0], gain: number): void {
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
    const g = gain * Phaser.Math.Clamp(1.3 - d / 13, 0.06, 1);
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
    } else if (this.legs.length) {
      const leg = this.legs[0];
      const dir = leg.to.clone().sub(this.fpos).setY(0);
      const d = dir.length();
      if (d > 0.05) {
        speedWant = leg.speed;
        const step = leg.speed * dt;
        this.fpos.addScaledVector(dir.normalize(), Math.min(step, d));
        this.fYaw = this.turnTo(this.fYaw, Math.atan2(dir.x, dir.z), dt * 2.2);
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
        if (leg.bin && this.binOpen === 0) audio.sfx('door_shut', 0.35);
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
    if (moved > 0.15) {
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = Phaser.Math.Clamp(0.62 / Math.max(0.4, moved / 0.9), 0.18, 0.9);
        this.heard(this.fpos.clone().setY(0.1), 'froggy_step', lunge ? 1.2 : 1);
      }
    } else this.stepT = 0.1;

    this.faceTo = faceTo;
    this.faceK += ((faceTo ? 1 : 0) - this.faceK) * Math.min(1, dt * 2);
    this.lean += (leanWant - this.lean) * Math.min(1, dt * 1.5);
    this.scanT = scan;
    // the bin's lid: up while he looks in, dropped with a clang after
    const wasOpen = this.binOpen;
    this.binOpen = Phaser.Math.Clamp(this.binOpen + (binWant ? 2.5 : -4) * dt, 0, 1);
    if (wasOpen > 0 && this.binOpen === 0) audio.sfx('item_thud', 0.5);
    if (this.binLid) this.binLid.rotation.x = this.binOpen * 1.7;
    m.setPose(this.fpos.x, 0, this.fpos.z, this.fYaw);
    m.update(dt, {
      speed: moved,
      maw: lunge ? 1 : this.phase === 'detect' ? 0.6 : 0.15,
      climb: 0,
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
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch, this.yaw, 0);
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
      this.scene.start('DeathScreen', { ...again, line: this.mode === 'hide' ? 'He saw you through the glass.' : 'Nowhere to hide.' });
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
      look: (yaw: number, pitch: number) => {
        this.yaw = yaw;
        this.pitch = pitch;
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
