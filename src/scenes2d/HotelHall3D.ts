/**
 * ---- LEVEL 6, AT THREE IN THE MORNING.  Out of room 612 and down.
 *
 * You are out of the room with the door shut behind you and him on the other
 * side of it, coming through the window.  The corridor is the same corridor
 * as the pixel one (art/hotelInterior): cream damask, a walnut dado with a
 * gilded rail, burgundy carpet with a gold lattice, walnut doors with brass
 * plates, sconces between them.  The lift is at the far end and the stairs
 * are beside it, on the right.
 *
 * THE LIFT.  Press its button and nothing happens -- "The elevator is not
 * working!" -- and while you are still reading it the view is turned round,
 * back down the corridor, in time to see the door of 612 come off its frame
 * and him come out after it.  He turns, and comes.
 *
 * THE STAIRS.  The fire door to the right of the lift, and a switchback well
 * going down six floors to G: two flights a floor, a landing between, a
 * yellow nosing on every tread, the floor painted big on the wall at every
 * turn, a gap down the middle you can look down -- and up.  He comes down
 * after you: he goes where you went, step for step, and he does not tire.
 * Keep running and you stay ahead; stop, or walk, and he closes.  Out of the
 * door at G and you are on the ground floor.
 *
 * Caught, and it is the scare; then you are back at the top of the stairs
 * with him in the corridor behind you.
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
import {
  texBlock,
  texCarpet,
  texCarpetBorder,
  texFireDoor,
  texLiftDoors,
  texRoomDoor,
  texSign,
  texTread,
  texWainscot,
  texWallpaper,
} from '../art/hotelInterior';

// ---- the corridor
const HALF = 1.6;
const CEIL = 3.0;
const BACK_Z = 2;
const ALCOVE_Z = -17;
const END_Z = -21;
const ALCOVE_HALF = 3;
const DADO = 0.95;
/** Room 612: on the left, by the end you came out at. */
const DOOR612_Z = 0;
const LIFT_X = -1.2;
const PANEL = { x: -0.05, z: END_Z + 0.15 };
const STAIR_DOOR = { x: 1.6, half: 0.55 };

// ---- the stairwell, behind the fire door
const SX = 1.6;
const SZ = END_Z - 1.6;
const FLOOR_H = 3;
const LEVELS = 7; // 6, 5, 4, 3, 2, 1, G
const WELL = 0.3;
const FLIGHT = 3;
const LANDING = 1.6;
const LEVEL_NAMES = ['6', '5', '4', '3', '2', '1', 'G'];

const EYE = 1.6;
const R_PLAYER = 0.3;
const WALK = 2.9;
const RUN = 4.4;
const FROG_SCALE = 1.25;
const CATCH = 1.15;

type Phase = 'escape' | 'lift' | 'smash' | 'chase' | 'stairs' | 'safe' | 'caught';
/** Where on the stairs: a landing at a floor, the first flight, the half landing, the second flight. */
type Seg = 'top' | 'A' | 'bot' | 'B';

interface Where {
  inWell: boolean;
  seg: Seg;
  f: number;
}

function tex(c: HTMLCanvasElement, rx = 1, ry = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class HotelHall3D extends Phaser.Scene {
  private stage: ThreeStage | null = null;
  private monster: FroggyMonster | null = null;
  private scare: Scare3D | null = null;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private dragging = false;
  private onLookDown: ((e: MouseEvent) => void) | null = null;
  private onLookMove: ((e: MouseEvent) => void) | null = null;
  private onLookUp: (() => void) | null = null;

  private phase: Phase = 'escape';
  private phaseT = 0;
  private clock = 0;
  private retry = false;

  // you
  private pos = new THREE.Vector2();
  private h = 0;
  private where: Where = { inWell: false, seg: 'top', f: 0 };
  private yaw = 0;
  private pitch = 0;
  private autoTurn: { from: number; to: number; t: number; dur: number } | null = null;
  private bobT = 0;
  private stepT = 0;
  private moving = false;
  private running = false;

  // him
  private fpos = new THREE.Vector3();
  private fWas = new THREE.Vector3();
  private fYaw = 0;
  private trail: THREE.Vector3[] = [];
  private trailIdx = 0;
  private lungeT = 0;
  private lungeCd = 3;
  private hopT = 0;
  /** A beat before he comes, on a retry: you have to see where he is. */
  private holdT = 0;

  // the room door, and the lights
  private door612: THREE.Mesh | null = null;
  private doorBroken: THREE.CanvasTexture | null = null;
  private doorFly: { v: THREE.Vector3; spin: number } | null = null;
  private splinters: Array<{ m: THREE.Mesh; v: THREE.Vector3 }> = [];
  private bangT = 0;
  private hallLights: THREE.PointLight[] = [];
  private wellLight: THREE.PointLight | null = null;
  private frogLight: THREE.PointLight | null = null;

  // words
  private lines: Array<{ text: string; until: number; red?: boolean }> = [];
  private objective = '';
  private prompt = '';
  private padSyncT = 0;

  constructor() {
    super('HotelHall3D');
  }

  init(data: { retry?: boolean } = {}): void {
    this.retry = !!data.retry;
  }

  create(): void {
    audio.preloadScream();
    froggyLayer.clear();
    audio.setScene(SILENCE);
    this.phase = 'escape';
    this.phaseT = 0;
    this.clock = 0;
    this.scare = null;
    this.lines = [];
    this.trail = [];
    this.trailIdx = 0;
    this.lungeT = 0;
    this.lungeCd = 3;
    this.holdT = 0;
    this.splinters = [];
    this.doorFly = null;
    this.hallLights = [];
    this.autoTurn = null;
    this.pitch = 0;
    this.h = 0;
    this.where = { inWell: false, seg: 'top', f: 0 };

    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000).setOrigin(0, 0);
    const root = document.getElementById('game-root');
    if (!root) return;
    this.stage = new ThreeStage();
    this.stage.mount(root, this.game.canvas);
    this.build();

    if (this.retry) {
      // back at the top of the stairs, him in the corridor behind you
      this.pos.set(SX - 0.6, SZ + 0.8);
      this.where = { inWell: true, seg: 'top', f: 0 };
      this.yaw = 0;
      this.breakDoor(true);
      this.fpos.set(0.4, 0, END_Z + 11);
      this.holdT = 1.4;
      this.fWas.copy(this.fpos);
      if (this.monster) this.monster.root.visible = true;
      this.trail = [new THREE.Vector3(STAIR_DOOR.x, 0, END_Z + 0.4), new THREE.Vector3(SX, 0, SZ + 1.2), new THREE.Vector3(this.pos.x, 0, this.pos.y)];
      this.phase = 'stairs';
      this.objective = 'Run down to the G Floor.';
      this.say('RUN.', 1.6, true);
      audio.sfx('froggy_screech', 0.8);
    } else {
      // just out of the room, the door shut behind you
      this.pos.set(-0.5, DOOR612_Z - 1.1);
      this.yaw = 0;
      this.objective = 'Get to the elevator.';
      this.say('I have to get to the elevator!', 3.2);
      audio.sfx('door_shut', 1);
      if (this.monster) this.monster.root.visible = false;
    }

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
    }
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.autoTurn) return;
      if (p.event instanceof MouseEvent && document.pointerLockElement) this.yaw -= p.event.movementX * 0.0027 * lookScale();
    });
    // a click or a tap on the words moves them on
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > GAME_H * 0.62 && this.lines.length) this.lines.shift();
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
    st.camera.near = 0.08;
    st.camera.far = 80;
    st.camera.updateProjectionMatrix();
    S.background = new THREE.Color(0x07060a);
    S.fog = new THREE.FogExp2(0x07060a, 0.045);
    S.add(new THREE.HemisphereLight(0x5a4a40, 0x120c0a, 0.55));
    S.add(st.camera);
    const fill = new THREE.PointLight(0xffe4c0, 1.6, 5, 1.6);
    st.camera.add(fill);

    this.buildCorridor(S);
    this.buildStairs(S);

    this.monster = new FroggyMonster(FROG_SCALE);
    this.monster.root.visible = false;
    S.add(this.monster.root);
    this.frogLight = new THREE.PointLight(0xb8c4e0, 7, 7, 1.4);
    S.add(this.frogLight);
  }

  private buildCorridor(S: THREE.Scene): void {
    const paperT = tex(texWallpaper(), 1, 1);
    const panelT = tex(texWainscot(), 1, 1);
    const paper = (len: number): THREE.MeshLambertMaterial => {
      const t = paperT.clone();
      t.repeat.set(len, 1);
      t.needsUpdate = true;
      return new THREE.MeshLambertMaterial({ map: t });
    };
    const panel = (len: number): THREE.MeshLambertMaterial => {
      const t = panelT.clone();
      t.repeat.set(len / 0.8, 1);
      t.needsUpdate = true;
      return new THREE.MeshLambertMaterial({ map: t });
    };
    const wall = (x: number, z: number, len: number, ry: number): void => {
      const up = new THREE.Mesh(new THREE.PlaneGeometry(len, CEIL - DADO), paper(len));
      up.position.set(x, DADO + (CEIL - DADO) / 2, z);
      up.rotation.y = ry;
      S.add(up);
      const lo = new THREE.Mesh(new THREE.PlaneGeometry(len, DADO), panel(len));
      lo.position.set(x, DADO / 2, z);
      lo.rotation.y = ry;
      S.add(lo);
      // the crown moulding
      const crown = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.08), new THREE.MeshLambertMaterial({ color: 0xe8dcc0 }));
      crown.position.set(x, CEIL - 0.07, z);
      crown.rotation.y = ry;
      S.add(crown);
    };
    const corrLen = BACK_Z - ALCOVE_Z;
    const corrMid = (BACK_Z + ALCOVE_Z) / 2;
    wall(-HALF, corrMid, corrLen, Math.PI / 2);
    wall(HALF, corrMid, corrLen, -Math.PI / 2);
    wall(0, BACK_Z, HALF * 2, Math.PI);
    // the alcove at the end
    const alcLen = ALCOVE_Z - END_Z;
    wall(-ALCOVE_HALF, (ALCOVE_Z + END_Z) / 2, alcLen, Math.PI / 2);
    wall(ALCOVE_HALF, (ALCOVE_Z + END_Z) / 2, alcLen, -Math.PI / 2);
    // (these two face into the alcove, back toward the lift)
    wall(-(ALCOVE_HALF + HALF) / 2, ALCOVE_Z, ALCOVE_HALF - HALF, Math.PI);
    wall((ALCOVE_HALF + HALF) / 2, ALCOVE_Z, ALCOVE_HALF - HALF, Math.PI);
    wall(0, END_Z, ALCOVE_HALF * 2, 0);

    // the carpet: the lattice down the middle, the border either side
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, corrLen), new THREE.MeshLambertMaterial({ map: tex(texCarpet(), HALF * 2 / 0.6, corrLen / 0.6) }));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0, corrMid);
    S.add(carpet);
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.28, corrLen), new THREE.MeshLambertMaterial({ map: tex(texCarpetBorder(), 1, corrLen / 0.6) }));
      b.rotation.x = -Math.PI / 2;
      b.position.set(sx * (HALF - 0.14), 0.004, corrMid);
      S.add(b);
    }
    const alcFloor = new THREE.Mesh(new THREE.PlaneGeometry(ALCOVE_HALF * 2, alcLen), new THREE.MeshLambertMaterial({ map: tex(texCarpet(), ALCOVE_HALF * 2 / 0.6, alcLen / 0.6) }));
    alcFloor.rotation.x = -Math.PI / 2;
    alcFloor.position.set(0, 0, (ALCOVE_Z + END_Z) / 2);
    S.add(alcFloor);
    // the ceiling, and its lights
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ALCOVE_HALF * 2, BACK_Z - END_Z), new THREE.MeshLambertMaterial({ color: 0xece4d4 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, CEIL, (BACK_Z + END_Z) / 2);
    S.add(ceil);
    const lamp = new THREE.MeshBasicMaterial({ color: 0xfff2d0 });
    for (let z = 0; z > END_Z; z -= 6) {
      const fit = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.05, 16), lamp);
      fit.position.set(0, CEIL - 0.03, z - 1.5);
      S.add(fit);
      const l = new THREE.PointLight(0xffd9a0, 9, 9, 1.4);
      l.position.set(0, CEIL - 0.3, z - 1.5);
      S.add(l);
      this.hallLights.push(l);
    }

    // the doors: 612 is yours, on the left by the end you came out at
    const doorAt = (num: string, side: number, z: number): THREE.Mesh => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.15), new THREE.MeshLambertMaterial({ map: tex(texRoomDoor(num)) }));
      m.position.set(side * (HALF - 0.012), 1.075, z);
      m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      S.add(m);
      // the casing round it
      const cream = new THREE.MeshLambertMaterial({ color: 0xf0e6cc });
      for (const [dz, w, hh, y] of [
        [-0.56, 0.1, 2.25, 1.125],
        [0.56, 0.1, 2.25, 1.125],
        [0, 1.22, 0.1, 2.2],
      ] as const) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, hh, w), cream);
        c.position.set(side * (HALF - 0.02), y, z + dz);
        S.add(c);
      }
      return m;
    };
    this.door612 = doorAt('612', -1, DOOR612_Z);
    this.doorBroken = tex(texRoomDoor('612', true));
    // the dark of the room behind it
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.15), new THREE.MeshBasicMaterial({ color: 0x05070e }));
    hole.position.set(-HALF - 0.01, 1.075, DOOR612_Z);
    hole.rotation.y = Math.PI / 2;
    S.add(hole);
    const nums = [
      ['611', 1, -2.5],
      ['610', -1, -5],
      ['609', 1, -7.5],
      ['608', -1, -10],
      ['607', 1, -12.5],
      ['606', -1, -15.4],
      ['605', 1, -15.4],
    ] as const;
    for (const [n, s, z] of nums) doorAt(n, s, z);

    // sconces between the doors: brass, a cream shade, lit
    const brass = new THREE.MeshLambertMaterial({ color: 0xc9a24a, emissive: 0x2a1c06 });
    const shade = new THREE.MeshBasicMaterial({ color: 0xffefc8 });
    for (let z = -1.25; z > ALCOVE_Z; z -= 2.5) {
      for (const side of [-1, 1]) {
        const x = side * (HALF - 0.06);
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.1), brass);
        plate.position.set(side * (HALF - 0.02), 1.85, z);
        S.add(plate);
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.16, 12), shade);
        s.position.set(x, 1.98, z);
        S.add(s);
      }
    }
    // a console table with lilies and a mirror on the back wall
    const wood = new THREE.MeshLambertMaterial({ color: 0x5a3a22 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.4), wood);
    table.position.set(0, 0.8, BACK_Z - 0.22);
    S.add(table);
    for (const dx of [-0.52, 0.52]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 0.05), wood);
      leg.position.set(dx, 0.4, BACK_Z - 0.22);
      S.add(leg);
    }
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.3, 12), new THREE.MeshPhongMaterial({ color: 0xc8dce8, shininess: 80 }));
    vase.position.set(0.3, 0.98, BACK_Z - 0.22);
    S.add(vase);
    for (let k = 0; k < 5; k++) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshLambertMaterial({ color: 0xf8e0ec }));
      fl.position.set(0.3 + Math.cos(k * 1.3) * 0.08, 1.2 + (k % 2) * 0.05, BACK_Z - 0.22 + Math.sin(k * 1.3) * 0.06);
      S.add(fl);
    }
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), new THREE.MeshPhongMaterial({ color: 0x8a96a0, shininess: 120, specular: 0xffffff }));
    mirror.position.set(0, 1.65, BACK_Z - 0.02);
    mirror.rotation.y = Math.PI;
    S.add(mirror);
    const mFrame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 0.03), brass);
    mFrame.position.set(0, 1.65, BACK_Z - 0.005);
    S.add(mFrame);

    // ---- the end: the lift, its dead dial, its button; the stairs beside it
    const lift = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.4), new THREE.MeshLambertMaterial({ map: tex(texLiftDoors()) }));
    lift.position.set(LIFT_X, 1.2, END_Z + 0.012);
    S.add(lift);
    const dial = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.04), new THREE.MeshLambertMaterial({ color: 0x120c08 }));
    dial.position.set(LIFT_X, 2.6, END_Z + 0.03);
    S.add(dial);
    const panelM = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.03), brass);
    panelM.position.set(PANEL.x, 1.2, END_Z + 0.02);
    S.add(panelM);
    const btn = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    btn.position.set(PANEL.x, 1.25, END_Z + 0.04);
    S.add(btn);
    const fire = new THREE.Mesh(new THREE.PlaneGeometry(STAIR_DOOR.half * 2, 2.15), new THREE.MeshLambertMaterial({ map: tex(texFireDoor()) }));
    fire.position.set(STAIR_DOOR.x, 1.075, END_Z + 0.012);
    S.add(fire);
    const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), new THREE.MeshBasicMaterial({ map: tex(texSign('EXIT', '#0e7a3e', '#e8ffe8')) }));
    exit.position.set(STAIR_DOOR.x, 2.45, END_Z + 0.03);
    S.add(exit);
    const exitGlow = new THREE.PointLight(0x40ff90, 1.2, 3, 1.6);
    exitGlow.position.set(STAIR_DOOR.x, 2.3, END_Z + 0.4);
    S.add(exitGlow);
  }

  /** The well: seven floors of block wall, landings, two flights a floor. */
  private buildStairs(S: THREE.Scene): void {
    const W = 3.2;
    const D = LANDING + FLIGHT + LANDING;
    const top = 3;
    const bottom = -(LEVELS - 1) * FLOOR_H - 0.3;
    const hgt = top - bottom;
    const cz = SZ + (LANDING - (FLIGHT + LANDING)) / 2;
    const blockT = tex(texBlock(), 1, 1);
    const blockMat = (w: number): THREE.MeshLambertMaterial => {
      const t = blockT.clone();
      t.repeat.set(w / 1.2, hgt / 1.2);
      t.needsUpdate = true;
      return new THREE.MeshLambertMaterial({ map: t, color: 0xd8d2c4 });
    };
    const plane = (w: number, x: number, z: number, ry: number): void => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), blockMat(w));
      m.position.set(x, bottom + hgt / 2, z);
      m.rotation.y = ry;
      S.add(m);
    };
    plane(D, SX - W / 2, cz, Math.PI / 2);
    plane(D, SX + W / 2, cz, -Math.PI / 2);
    plane(W, SX, SZ - FLIGHT - LANDING, 0);
    // the +z wall, with a gap at the top for the door you come in by
    const back = SZ + LANDING;
    const left = new THREE.Mesh(new THREE.PlaneGeometry(W, hgt), blockMat(W));
    left.position.set(SX, bottom + hgt / 2, back);
    left.rotation.y = Math.PI;
    S.add(left);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ color: 0xb8b2a4 }));
    roof.rotation.x = Math.PI / 2;
    roof.position.set(SX, top, cz);
    S.add(roof);

    const slab = new THREE.MeshLambertMaterial({ color: 0x8a8680 });
    const under = new THREE.MeshLambertMaterial({ color: 0xa8a294 });
    const treadMat = new THREE.MeshLambertMaterial({ map: tex(texTread()) });
    const rail = new THREE.MeshLambertMaterial({ color: 0x8a1a1a });
    const post = new THREE.MeshLambertMaterial({ color: 0x5a5e62 });
    const fireMat = new THREE.MeshLambertMaterial({ map: tex(texFireDoor()) });
    const lamp = new THREE.MeshBasicMaterial({ color: 0xe8f4ff });
    const steps = 10;
    const stepD = FLIGHT / steps;
    const stepH = FLOOR_H / 2 / steps;
    const stepGeo = new THREE.BoxGeometry(W / 2 - WELL, stepH, stepD);
    const treads = new THREE.InstancedMesh(stepGeo, treadMat, LEVELS * steps * 2);
    let ti = 0;
    const m4 = new THREE.Matrix4();
    for (let f = 0; f < LEVELS; f++) {
      const y0 = -f * FLOOR_H;
      // the landing at this floor, the half landing below it
      const tl = new THREE.Mesh(new THREE.BoxGeometry(W, 0.2, LANDING), slab);
      tl.position.set(SX, y0 - 0.1, SZ + LANDING / 2);
      S.add(tl);
      // the floor, painted big beside the door, and the door itself
      const name = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: tex(texSign(LEVEL_NAMES[f], '#c8c2b4', '#7a1a1a', 128, 128)) }));
      name.position.set(SX - 1.15, y0 + 1.7, back - 0.02);
      name.rotation.y = Math.PI;
      S.add(name);
      {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.1), fireMat);
        d.position.set(SX, y0 + 1.05, back - 0.015);
        d.rotation.y = Math.PI;
        S.add(d);
      }
      if (f === LEVELS - 1) {
        const ex = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), new THREE.MeshBasicMaterial({ map: tex(texSign('EXIT', '#0e7a3e', '#e8ffe8')) }));
        ex.position.set(SX, y0 + 2.35, back - 0.03);
        ex.rotation.y = Math.PI;
        S.add(ex);
        const g = new THREE.PointLight(0x40ff90, 2, 4, 1.4);
        g.position.set(SX, y0 + 2.2, back - 0.5);
        S.add(g);
        const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.2, D), slab);
        floor.position.set(SX, y0 - 0.1, cz);
        S.add(floor);
      }
      // a fitting on the ceiling of each landing
      const fit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.16), lamp);
      fit.position.set(SX, y0 + FLOOR_H - 0.35, SZ + 0.8);
      S.add(fit);
      if (f === LEVELS - 1) continue;
      const hl = new THREE.Mesh(new THREE.BoxGeometry(W, 0.2, LANDING), slab);
      hl.position.set(SX, y0 - FLOOR_H / 2 - 0.1, SZ - FLIGHT - LANDING / 2);
      S.add(hl);
      // the two flights: treads, their underside, a red rail along the well
      for (const side of [-1, 1]) {
        const x = SX + side * (WELL + (W / 2 - WELL) / 2);
        for (let k = 0; k < steps; k++) {
          // A descends going -z from the floor; B descends going +z from the half landing
          const z = side < 0 ? SZ - (k + 0.5) * stepD : SZ - FLIGHT + (k + 0.5) * stepD;
          const yTop = side < 0 ? y0 - (k + 1) * stepH : y0 - FLOOR_H / 2 - (k + 1) * stepH;
          m4.makeTranslation(x, yTop + stepH / 2 - 0.0, z);
          treads.setMatrixAt(ti++, m4);
        }
        const slope = Math.atan2(FLOOR_H / 2, FLIGHT);
        const len = Math.hypot(FLOOR_H / 2, FLIGHT);
        const u = new THREE.Mesh(new THREE.BoxGeometry(W / 2 - WELL, 0.12, len), under);
        const ymid = side < 0 ? y0 - FLOOR_H / 4 : y0 - (3 * FLOOR_H) / 4;
        u.position.set(x, ymid - 0.22, SZ - FLIGHT / 2);
        u.rotation.x = side < 0 ? slope : -slope;
        S.add(u);
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, len + 0.2), rail);
        r.position.set(SX + side * WELL, ymid + 0.95, SZ - FLIGHT / 2);
        r.rotation.x = side < 0 ? slope : -slope;
        S.add(r);
        for (let k = 0; k <= 3; k++) {
          const pz = SZ - (k / 3) * FLIGHT;
          const py = side < 0 ? y0 - (k / 3) * (FLOOR_H / 2) : y0 - FLOOR_H + (k / 3) * (FLOOR_H / 2);
          const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.95, 0.03), post);
          p.position.set(SX + side * WELL, py + 0.475, pz);
          S.add(p);
        }
      }
      // a rail round the well at the half landing
      const hr = new THREE.Mesh(new THREE.BoxGeometry(WELL * 2 + 0.05, 0.05, 0.05), rail);
      hr.position.set(SX, y0 - FLOOR_H / 2 + 0.95, SZ - FLIGHT);
      S.add(hr);
    }
    treads.count = ti;
    S.add(treads);
    // light that goes where you go, and a little everywhere
    this.wellLight = new THREE.PointLight(0xe8f0ff, 3.5, 10, 1.2);
    S.add(this.wellLight);
  }

  // ====================================================== the stairwell's shape

  /** Local stairwell coordinates of a world point. */
  private local(x: number, z: number): { x: number; z: number } {
    return { x: x - SX, z: z - SZ };
  }

  /** The height of the floor under (x, z) on a given part of the stairs. */
  private heightOn(w: Where, x: number, z: number): number {
    if (!w.inWell) return 0;
    const l = this.local(x, z);
    const y0 = -w.f * FLOOR_H;
    switch (w.seg) {
      case 'top':
        return y0;
      case 'A':
        return y0 - (FLOOR_H / 2) * Phaser.Math.Clamp(-l.z / FLIGHT, 0, 1);
      case 'bot':
        return y0 - FLOOR_H / 2;
      case 'B':
        return y0 - FLOOR_H / 2 - (FLOOR_H / 2) * Phaser.Math.Clamp((l.z + FLIGHT) / FLIGHT, 0, 1);
    }
  }

  /** Where you are after a step from `w` to local (x, z). */
  private nextWhere(w: Where, x: number, z: number): Where {
    const l = this.local(x, z);
    const n = { ...w };
    if (w.seg === 'top') {
      if (l.z < 0) {
        if (l.x < 0 && w.f < LEVELS - 1) n.seg = 'A';
        else if (l.x > 0 && w.f > 0) {
          n.seg = 'B';
          n.f = w.f - 1;
        }
      }
    } else if (w.seg === 'A') {
      if (l.z >= 0) n.seg = 'top';
      else if (l.z < -FLIGHT) n.seg = 'bot';
    } else if (w.seg === 'bot') {
      if (l.z >= -FLIGHT) n.seg = l.x < 0 ? 'A' : 'B';
    } else if (w.seg === 'B') {
      if (l.z < -FLIGHT) n.seg = 'bot';
      else if (l.z >= 0) {
        n.seg = 'top';
        n.f = w.f + 1;
      }
    }
    return n;
  }

  /** Keep a point inside the well, off the gap down the middle, off walls. */
  private clampWell(w: Where, x: number, z: number, r: number): { x: number; z: number } {
    const l = this.local(x, z);
    l.x = Phaser.Math.Clamp(l.x, -1.6 + r, 1.6 - r);
    l.z = Phaser.Math.Clamp(l.z, -FLIGHT - LANDING + r, LANDING - r);
    if (w.seg === 'A') l.x = Math.min(l.x, -WELL - r);
    if (w.seg === 'B') l.x = Math.max(l.x, WELL + r);
    if (w.seg === 'top' && l.z < 0) {
      // no way up from the sixth, no way down from G
      if (w.f === 0 && l.x > -WELL - r) l.z = 0;
      if (w.f === LEVELS - 1) l.z = 0;
      if (Math.abs(l.x) < WELL + r) l.z = Math.max(l.z, 0);
    }
    if (w.seg === 'bot' && l.z > -FLIGHT && Math.abs(l.x) < WELL + r) l.z = -FLIGHT;
    return { x: l.x + SX, z: l.z + SZ };
  }

  // ===================================================================== loop

  private held(g: string): boolean {
    return this.keys[g]?.some((k) => k.isDown) ?? false;
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
    this.syncPad(dt);
    this.movePlayer(dt);
    this.story(dt);
    this.moveFroggy(dt);
    this.animateDoor(dt);
    this.updateCamera(dt);
    this.paintOverlay();
    this.publish();
  }

  /** RUN only once he is coming; PRESS only at the lift. */
  private syncPad(dt: number): void {
    this.padSyncT -= dt;
    if (!isTouch() || this.padSyncT > 0) return;
    this.padSyncT = 0.25;
    touchControls.showButton('SHIFT', this.phase === 'chase' || this.phase === 'stairs' || this.phase === 'escape');
    touchControls.showButton('E', this.phase === 'escape' && this.nearPanel());
  }

  private nearPanel(): boolean {
    return !this.where.inWell && Math.hypot(this.pos.x - PANEL.x, this.pos.y - PANEL.z) < 1.5;
  }

  private press(): void {
    if (this.phase !== 'escape' || !this.nearPanel()) return;
    // nothing.  Nothing at all.
    this.phase = 'lift';
    this.phaseT = 0;
    audio.sfx('lift_dead', 1);
    this.lines = [];
    this.say('The elevator is not working!', 3.4, true);
    this.time.delayedCall(700, () => audio.sfx('lift_dead', 0.6));
    // turned round, back down the corridor, while you are still reading it
    const to = this.yawToward(0, DOOR612_Z);
    this.autoTurn = { from: this.yaw, to: this.unwrap(this.yaw, to), t: 0, dur: 1.1 };
  }

  private yawToward(x: number, z: number): number {
    return Math.atan2(-(x - this.pos.x), -(z - this.pos.y));
  }

  private unwrap(from: number, to: number): number {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return from + d;
  }

  private movePlayer(dt: number): void {
    if (this.autoTurn) {
      this.autoTurn.t += dt;
      const k = Math.min(1, this.autoTurn.t / this.autoTurn.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.yaw = this.autoTurn.from + (this.autoTurn.to - this.autoTurn.from) * e;
      if (k >= 1) this.autoTurn = null;
    }
    const locked = this.phase === 'lift' || this.phase === 'smash' || this.phase === 'safe';
    const fwd = locked ? 0 : (this.held('up') ? 1 : 0) - (this.held('down') ? 1 : 0);
    const strafe = locked ? 0 : (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    this.running = this.held('run');
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
    const sp = (this.running ? RUN : WALK) * dt;
    let nx = this.pos.x + dx * sp;
    let nz = this.pos.y + dz * sp;

    if (!this.where.inWell) {
      // the corridor, the alcove, and the door into the stairs
      const inAlcove = nz < ALCOVE_Z + R_PLAYER;
      const lim = inAlcove ? ALCOVE_HALF - R_PLAYER : HALF - R_PLAYER;
      if (this.pos.y < ALCOVE_Z && nz >= ALCOVE_Z - 0.0 && Math.abs(nx) > HALF - R_PLAYER) nz = this.pos.y;
      nx = Phaser.Math.Clamp(nx, -lim, lim);
      nz = Math.min(nz, BACK_Z - R_PLAYER);
      const atDoor = Math.abs(nx - STAIR_DOOR.x) < STAIR_DOOR.half - 0.12;
      if (nz < END_Z + R_PLAYER) {
        if (atDoor && this.phase !== 'escape' && this.phase !== 'lift' && this.phase !== 'smash') {
          if (nz < END_Z) {
            this.where = { inWell: true, seg: 'top', f: 0 };
            this.enterStairs();
          }
        } else {
          if (atDoor && this.phase === 'escape' && !this.lines.length) this.say("The elevator's quicker. It's right here.", 2.4);
          nz = END_Z + R_PLAYER;
        }
      }
      this.pos.set(nx, nz);
    } else {
      // out of the well the way you came, at the top
      const l = this.local(nx, nz);
      if (this.where.seg === 'top' && this.where.f === 0 && l.z > LANDING - R_PLAYER && Math.abs(l.x) < STAIR_DOOR.half - 0.12) {
        if (nz > END_Z) {
          this.where = { inWell: false, seg: 'top', f: 0 };
          this.pos.set(nx, nz);
          return;
        }
      }
      // out at G
      if (this.where.seg === 'top' && this.where.f === LEVELS - 1 && l.z > LANDING - R_PLAYER - 0.05 && Math.abs(l.x) < 0.5) {
        this.reachG();
        return;
      }
      const w = this.nextWhere(this.where, nx, nz);
      const c = this.clampWell(w, nx, nz, R_PLAYER);
      this.where = this.nextWhere(this.where, c.x, c.z);
      this.pos.set(c.x, c.z);
    }
    this.h = this.heightOn(this.where, this.pos.x, this.pos.y);

    this.bobT += dt * (this.running ? 1.5 : 1);
    this.stepT += dt;
    if (this.stepT > (this.running ? 0.28 : 0.42)) {
      this.stepT = 0;
      audio.sfx(this.where.inWell ? 'footstep_concrete' : 'footstep_carpet', this.running ? 0.8 : 0.5);
    }
    // the path you take is the path he takes
    const last = this.trail[this.trail.length - 1];
    const here = new THREE.Vector3(this.pos.x, this.h, this.pos.y);
    if ((this.phase === 'chase' || this.phase === 'stairs') && (!last || last.distanceTo(here) > 0.3)) this.trail.push(here);
  }

  private enterStairs(): void {
    if (this.phase === 'stairs') return;
    this.phase = 'stairs';
    this.phaseT = 0;
    this.objective = 'Run down to the G Floor.';
    audio.sfx('door_open', 0.9);
    this.time.delayedCall(250, () => audio.sfx('door_shut', 0.7));
    this.say('Run down to the G Floor.', 2.6, true);
  }

  /** The beats: the banging, the lift, the door, the chase. */
  private story(dt: number): void {
    if (this.phase === 'escape') {
      // him, in the room behind you, and the door taking it
      this.bangT -= dt;
      if (this.bangT <= 0) {
        this.bangT = 1.1 + Math.random() * 0.8;
        audio.sfx('item_thud', 0.6);
        audio.sfx('door_rattle', 0.5);
        if (this.door612) this.door612.position.x = -HALF + 0.012 + 0.03;
        this.time.delayedCall(80, () => {
          if (this.door612 && !this.doorFly) this.door612.position.x = -HALF + 0.012;
        });
      }
      this.prompt = this.nearPanel() ? (isTouch() ? 'TAP E - CALL THE LIFT' : '[E] CALL THE LIFT') : '';
      return;
    }
    this.prompt = '';
    if (this.phase === 'lift' && this.phaseT > 1.4) {
      this.phase = 'smash';
      this.phaseT = 0;
      this.breakDoor(false);
    }
    if (this.phase === 'smash') {
      // out of the doorway, into the corridor, turning to you
      const k = Math.min(1, this.phaseT / 1.4);
      this.fpos.set(-HALF + 0.2 + k * 1.4, 0, DOOR612_Z - k * 0.6);
      this.fYaw = Math.PI / 2 + (Math.atan2(this.pos.x - this.fpos.x, this.pos.y - this.fpos.z) - Math.PI / 2) * k;
      if (this.phaseT > 0.6 && this.phaseT - dt <= 0.6) audio.sfx('froggy_screech', 1);
      if (this.phaseT > 2.0) {
        this.phase = 'chase';
        this.phaseT = 0;
        this.objective = 'Take the stairs!';
        this.say('RUN!', 1.4, true);
        this.say('The stairs, next to the elevator!', 3, true);
        this.trail = [new THREE.Vector3(this.pos.x, 0, this.pos.y)];
        this.trailIdx = 0;
      }
    }
    // the lights do not like him
    if (this.phase === 'chase' || this.phase === 'stairs' || this.phase === 'smash') {
      for (const [i, l] of this.hallLights.entries()) {
        const near = Math.abs(l.position.z - this.fpos.z) < 7;
        const flick = near && Math.sin(this.clock * (17 + i * 3)) > 0.6 ? 0.2 : 1;
        l.intensity = 9 * flick;
      }
    }
  }

  /** The door of 612 comes off its frame. */
  private breakDoor(already: boolean): void {
    const d = this.door612;
    if (!d) return;
    (d.material as THREE.MeshLambertMaterial).map = this.doorBroken;
    (d.material as THREE.MeshLambertMaterial).needsUpdate = true;
    if (this.monster) this.monster.root.visible = true;
    if (already) {
      // where it fell
      d.position.set(-0.4, 0.06, DOOR612_Z - 1.2);
      d.rotation.set(-Math.PI / 2, 0, 0.4);
      return;
    }
    audio.sfx('door_smash', 1);
    audio.sfx('boom', 0.6);
    this.doorFly = { v: new THREE.Vector3(3.2, 2.2, -1.2), spin: 4 };
    this.fpos.set(-HALF - 0.2, 0, DOOR612_Z);
    this.fWas.copy(this.fpos);
    // splinters
    const wood = new THREE.MeshLambertMaterial({ color: 0x6a4428 });
    for (let k = 0; k < 18; k++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.03 + Math.random() * 0.05, 0.02, 0.1 + Math.random() * 0.25), wood);
      m.position.set(-HALF + 0.1, 0.6 + Math.random() * 1.4, DOOR612_Z + (Math.random() - 0.5) * 0.9);
      this.stage?.scene.add(m);
      this.splinters.push({ m, v: new THREE.Vector3(1.5 + Math.random() * 3, Math.random() * 3, (Math.random() - 0.5) * 3) });
    }
  }

  private animateDoor(dt: number): void {
    const d = this.door612;
    if (d && this.doorFly) {
      d.position.addScaledVector(this.doorFly.v, dt);
      this.doorFly.v.y -= 9.8 * dt;
      d.rotation.z += this.doorFly.spin * dt * 0.3;
      d.rotation.x -= this.doorFly.spin * dt * 0.4;
      if (d.position.y <= 0.06 && this.doorFly.v.y < 0) {
        d.position.y = 0.06;
        d.rotation.set(-Math.PI / 2, 0, d.rotation.z);
        this.doorFly = null;
        audio.sfx('item_thud', 1);
      }
    }
    for (const s of this.splinters) {
      if (s.m.position.y <= 0.02) continue;
      s.m.position.addScaledVector(s.v, dt);
      s.v.y -= 9.8 * dt;
      s.m.rotation.x += dt * 8;
      s.m.rotation.y += dt * 5;
      if (s.m.position.y < 0.02) s.m.position.y = 0.02;
    }
  }

  /** He follows the way you went, and he does not stop. */
  private moveFroggy(dt: number): void {
    const m = this.monster;
    if (!m || !m.root.visible) return;
    this.holdT = Math.max(0, this.holdT - dt);
    const hunting = (this.phase === 'chase' || this.phase === 'stairs') && this.holdT <= 0;
    if (hunting) {
      // how far behind is he, along the way you went?
      let target = this.trail[Math.min(this.trailIdx, this.trail.length - 1)] ?? new THREE.Vector3(this.pos.x, this.h, this.pos.y);
      const you = new THREE.Vector3(this.pos.x, this.h, this.pos.y);
      // in the corridor with you, nothing between: straight at you
      if (!this.where.inWell && this.fpos.y > -0.5 && Math.abs(this.fpos.y) < 0.5) {
        target = you;
        this.trailIdx = this.trail.length - 1;
      }
      let gap = this.fpos.distanceTo(target);
      for (let i = this.trailIdx; i < this.trail.length - 1; i++) gap += this.trail[i].distanceTo(this.trail[i + 1]);
      gap += this.trail.length ? this.trail[this.trail.length - 1].distanceTo(you) : 0;
      // the further behind, the faster he comes; close, a little slower than you run
      let speed = (this.where.inWell ? 4.1 : 3.9) + Math.max(0, gap - 8) * 0.22;
      speed = Math.min(speed, 6.2);
      this.lungeCd -= dt;
      if (this.lungeT > 0) {
        this.lungeT -= dt;
        speed = 5.6;
      } else if (gap < 5 && this.lungeCd <= 0) {
        this.lungeT = 0.55;
        this.lungeCd = 2.5 + Math.random() * 2;
        audio.sfx('froggy_screech', 0.6);
      }
      let step = speed * dt;
      while (step > 0) {
        const t = this.trailIdx < this.trail.length ? this.trail[this.trailIdx] : you;
        const d = this.fpos.distanceTo(t);
        if (d <= step) {
          this.fpos.copy(t);
          step -= d;
          if (this.trailIdx < this.trail.length) this.trailIdx++;
          else break;
        } else {
          this.fpos.addScaledVector(t.clone().sub(this.fpos).normalize(), step);
          step = 0;
        }
      }
      const look = this.trailIdx < this.trail.length ? this.trail[this.trailIdx] : you;
      const want = Math.atan2(look.x - this.fpos.x, look.z - this.fpos.z);
      let d = want - this.fYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.fYaw += d * Math.min(1, dt * 8);
      // his steps, wet and heavy, faster the closer he is
      this.hopT -= dt;
      const dist = this.fpos.distanceTo(you);
      if (this.hopT <= 0) {
        this.hopT = Phaser.Math.Clamp(dist / 14, 0.26, 0.7);
        if (dist < 26) audio.sfx('froggy_step', Phaser.Math.Clamp(1.2 - dist / 26, 0.2, 1));
      }
      if (dist < CATCH && Math.abs(this.fpos.y - this.h) < 1.4) this.caught();
    }
    const moved = this.fpos.distanceTo(this.fWas) / Math.max(dt, 1e-4);
    this.fWas.copy(this.fpos);
    m.setPose(this.fpos.x, this.fpos.y, this.fpos.z, this.fYaw);
    const cam = this.stage?.camera.position ?? null;
    m.update(dt, { speed: moved, maw: 1, climb: 0, scan: 0, lunge: this.lungeT > 0 ? 1 : 0.5, constrict: 1, bare: 0.8, reachAt: hunting ? cam : null, viewer: cam });
    this.frogLight?.position.set(this.fpos.x, this.fpos.y + 2.4, this.fpos.z);
  }

  private updateCamera(dt: number): void {
    const cam = this.stage!.camera;
    const amp = this.moving ? (this.running ? 0.06 : 0.035) : 0;
    const bob = Math.sin(this.bobT * Math.PI * 2 * 1.6) * amp;
    // on a flight, the eyes go down the stairs
    const onFlight = this.where.inWell && (this.where.seg === 'A' || this.where.seg === 'B');
    this.pitch += ((onFlight ? -0.28 : 0) - this.pitch) * Math.min(1, dt * 5);
    const shake = this.phase === 'smash' && this.phaseT < 0.5 ? (0.5 - this.phaseT) * 0.06 : 0;
    cam.position.set(this.pos.x + (Math.random() - 0.5) * shake, this.h + EYE + bob + (Math.random() - 0.5) * shake, this.pos.y);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch, this.yaw, 0);
    this.wellLight?.position.set(SX, this.h + 2.6, SZ - 1.5);
    // the door coming off: the eye goes to it, as a lens would
    const fov = this.phase === 'lift' || this.phase === 'smash' ? (this.phase === 'smash' && this.phaseT > 1.6 ? 72 : 34) : 72;
    if (Math.abs(cam.fov - fov) > 0.1) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * (fov < cam.fov ? 2.2 : 3));
      cam.updateProjectionMatrix();
    }
  }

  // ================================================================= endings

  private caught(): void {
    if (this.phase === 'caught') return;
    this.phase = 'caught';
    this.publish('caught');
    this.scare = this.stage && this.monster ? playJumpscare3D(this, this.stage, this.monster, { floor: this.h }) : null;
    if (!this.scare) playJumpscare(this);
    this.time.delayedCall(SCARE_MS + 600, () => {
      froggyLayer.clear();
      this.teardown();
      this.scene.restart({ retry: true });
    });
  }

  /** Out of the door at G. */
  private reachG(): void {
    if (this.phase === 'safe') return;
    this.phase = 'safe';
    this.phaseT = 0;
    this.publish('safe');
    audio.sfx('door_open', 1);
    this.time.delayedCall(900, () => {
      audio.sfx('door_shut', 1);
      froggyLayer.clear();
      this.teardown();
      this.scene.start('Hotel', { area: 'lobby', from: 'stairs' });
    });
  }

  // ================================================================= words

  private say(text: string, dur: number, red = false): void {
    const from = this.lines.length ? this.lines[this.lines.length - 1].until : this.clock;
    this.lines.push({ text, until: from + dur, red });
  }

  private paintOverlay(): void {
    while (this.lines.length && this.lines[0].until < this.clock) this.lines.shift();
    froggyLayer.paint((ctx) => {
      if (this.phase === 'safe') {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.phaseT / 0.8)})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        return;
      }
      const intro = Math.max(0, 1 - this.clock / 0.8);
      if (intro > 0) {
        ctx.fillStyle = `rgba(0,0,0,${intro})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }
      if (this.objective) {
        drawPixelText(ctx, 'OBJECTIVE', 6, 6, { scale: 1, color: '#9a4848', alpha: 0.85 });
        drawPixelText(ctx, this.objective, 6, 16, { scale: 1, color: '#ff4a4a', alpha: 0.95 });
        if (this.where.inWell) drawPixelText(ctx, `FLOOR ${LEVEL_NAMES[this.where.f]}`, 6, 26, { scale: 1, color: '#7a8494', alpha: 0.75 });
      }
      const line = this.lines[0];
      if (line) {
        const over = touchControls.overBottom();
        const cx = GAME_W / 2 + (over.left - over.right) / 2;
        if (line.red && line.text.length < 12) {
          drawPixelText(ctx, line.text, cx, GAME_H * 0.4, { scale: 2, color: '#ff4a4a', center: true });
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
      // what to press, when it is the thing to do
      let hint = this.prompt;
      if (!hint && (this.phase === 'chase' || this.phase === 'stairs') && this.phaseT < 4) hint = isTouch() ? 'HOLD RUN TO RUN' : 'HOLD SHIFT TO RUN';
      if (!hint && this.phase === 'escape' && this.clock > 4 && this.clock < 9) hint = isTouch() ? 'THE STICK WALKS - DRAG TO LOOK' : 'W A S D TO WALK - SHIFT TO RUN';
      if (hint) {
        const y = 44;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(GAME_W / 2 - (hint.length * 6) / 2 - 4, y - 3, hint.length * 6 + 7, 13);
        drawPixelText(ctx, hint, GAME_W / 2, y, { scale: 1, color: '#f0d890', center: true });
      }
    });
  }

  // ================================================================= misc

  private publish(outcome?: string): void {
    if (!import.meta.env?.DEV) return;
    const w = window as unknown as Record<string, Record<string, unknown>>;
    const t = w.__hall ?? {};
    Object.assign(t, {
      phase: this.phase,
      px: this.pos.x,
      pz: this.pos.y,
      h: this.h,
      seg: this.where.seg,
      f: this.where.f,
      well: this.where.inWell,
      fx: this.fpos.x,
      fy: this.fpos.y,
      fz: this.fpos.z,
      dist: this.fpos.distanceTo(new THREE.Vector3(this.pos.x, this.h, this.pos.y)),
      line: this.lines[0]?.text ?? '',
      objective: this.objective,
      yaw: this.yaw,
    });
    if (outcome) t.outcome = outcome;
    w.__hall = t;
  }

  private bridge(): void {
    const w = window as unknown as Record<string, Record<string, unknown>>;
    w.__hall = {
      warp: (x: number, z: number) => {
        this.pos.set(x, z);
      },
      face: (yaw: number) => {
        this.yaw = yaw;
      },
      put: (x: number, y: number, z: number) => this.fpos.set(x, y, z),
      press: () => this.press(),
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
