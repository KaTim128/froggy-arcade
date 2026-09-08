/**
 * The rooms.  First person, and he has the key.
 *
 * He is half your running speed and always will be, so he cannot catch anyone
 * who keeps moving — which is exactly why the room is built to stop you moving.
 * You need the key, the key is somewhere in the furniture, and looking for it
 * means being out in the open.
 *
 * Hiding is a chest, and a chest is a trap as much as a refuge: he opens them.
 * Not all of them, and not always — sometimes he walks straight past, sometimes
 * he stops and listens first — so a spot that worked twice is not safe a third
 * time.  Sitting still is a decision with a cost, which is the point.
 */

import Phaser from 'phaser';
import * as THREE from 'three';
import { audio, SILENCE } from '../core/audio';
import { store } from '../core/state';
import { froggyLayer } from '../render/froggyLayer';
import { drawFroggy } from '../froggy/froggy';
import { drawPixelText } from '../render/pixelFont';
import { ThreeStage } from '../render/threeStage';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { ROOMS, type Box, type RoomDef } from '../three/hideRooms';

const WALK = 2.3;
const RUN = 4.0;
/** Exactly half your run.  He never gets faster than this. (CH / H6) */
const FROGGY_CHASE = RUN * 0.5;
// Faster than it looks it should be: the rooms are 36m across now, and at
// 1.15 m/s he took half a minute to cross one and felt absent rather than near.
const FROGGY_SEARCH = 1.7;
const EYE = 1.55;
const PLAYER_R = 0.42;

const VIEW_RANGE = 13;
const VIEW_HALF = Math.PI / 3.6;
/** How long he keeps coming after losing sight of you. */
const MEMORY_S = 3.0;
const CATCH_DIST = 1.15;

const CHEST_REACH = 1.6;
const KEY_REACH = 1.9;
const DOOR_REACH = 2.2;

/** He hears a run from here, even without seeing it. */
const HEAR_RUN = 9;

type Mode = 'intro' | 'play' | 'caught' | 'escaping';
type FroggyMode = 'search' | 'listen' | 'openChest' | 'chase' | 'suspicious';

interface Chest3D {
  x: number;
  z: number;
  lid: THREE.Object3D;
  /** 0 shut, 1 fully open. */
  open: number;
  opening: boolean;
}

export class HideRoom3D extends Phaser.Scene {
  private stage: ThreeStage | null = null;
  private def!: RoomDef;
  private roomIndex = 0;

  private yaw = 0;
  private pos = new THREE.Vector2();
  private mode: Mode = 'intro';

  private froggy = new THREE.Vector2();
  private froggyYaw = 0;
  private fMode: FroggyMode = 'search';
  private fTimer = 0;
  private memory = 0;
  private lastSeen = new THREE.Vector2();
  private waypoint = new THREE.Vector2();
  private targetChest: Chest3D | null = null;
  private sprite: THREE.Sprite | null = null;

  private chests: Chest3D[] = [];
  private blockers: Box[] = [];
  private hiding: Chest3D | null = null;
  private hasKey = false;
  private keyAt = new THREE.Vector2();
  private keyMesh: THREE.Object3D | null = null;

  private introT = 0;
  private caughtT = 0;
  private bob = 0;
  private stepT = 0;
  private shake = 0;
  private prompt = '';
  private subtitle = '';
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private onMouse: ((e: MouseEvent) => void) | null = null;
  private frames = 0;
  private grace = 0;
  private stuckT = 0;
  private slideDir: 1 | -1 = 1;

  constructor() {
    super('HideRoom3D');
  }

  create(): void {
    this.roomIndex = Phaser.Math.Clamp(store.get().hideRoom, 0, ROOMS.length - 1);
    this.def = ROOMS[this.roomIndex];

    // Reset every mutable field: Phaser reuses the instance across restarts.
    this.mode = 'intro';
    this.introT = 0;
    this.caughtT = 0;
    this.hiding = null;
    this.hasKey = false;
    this.chests = [];
    this.blockers = [];
    this.fMode = 'search';
    this.fTimer = 0;
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
    this.froggy.set(this.def.froggyStart.x, this.def.froggyStart.z);

    const spot = Phaser.Utils.Array.GetRandom(this.def.keySpots);
    this.keyAt.set(spot.x, spot.z);

    this.stage = new ThreeStage();
    const root = document.getElementById('game-root');
    if (root) this.stage.mount(root, this.game.canvas);
    this.buildRoom();
    this.stage.start((dt) => this.tick(dt));

    this.bindInput();
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

    for (const c of d.chests) this.chests.push(this.buildChest(c.x, c.z, c.rot));

    // The key, hidden in the furniture — small, dull, and easy to walk past.
    const key = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.06, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xd8b45a }),
    );
    const bow = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.03, 6, 10),
      new THREE.MeshBasicMaterial({ color: 0xd8b45a }),
    );
    bow.position.x = -0.22;
    bow.rotation.y = Math.PI / 2;
    key.add(shaft, bow);
    key.position.set(this.keyAt.x, 0.75, this.keyAt.y);
    st.scene.add(key);
    this.keyMesh = key;

    // Froggy, the same art rasterised for 3D (PRD FR-3).
    const tex = new THREE.CanvasTexture(this.froggyTexture());
    tex.minFilter = THREE.LinearFilter;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: true, transparent: true }));
    this.sprite.scale.set(2.4, 2.4, 1);
    st.scene.add(this.sprite);
  }

  private buildChest(x: number, z: number, rot: number): Chest3D {
    const st = this.stage!;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rot;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.7, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x4a3520 }),
    );
    body.position.y = 0.35;
    group.add(body);

    // The lid is its own pivot so it can swing rather than slide.
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.7, -0.4);
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.14, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x5c4326 }),
    );
    lid.position.z = 0.4;
    hinge.add(lid);
    group.add(hinge);

    st.scene.add(group);
    return { x, z, lid: hinge, open: 0, opening: false };
  }

  private froggyTexture(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.save();
    ctx.translate(128, 10);
    ctx.scale(1.7, 1.7);
    drawFroggy(ctx, {
      x: 0,
      y: 130,
      height: 132,
      variant: 'monster',
      morph: 1,
      maw: 0.55,
      blood: 0.7,
      pupil: 0.14,
      t: 0,
    });
    ctx.restore();
    return c;
  }

  // ------------------------------------------------------------------- input

  private bindInput(): void {
    const kb = this.input.keyboard;
    const bind = (names: readonly string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    this.keys = {
      fwd: bind(['W', 'UP']),
      back: bind(['S', 'DOWN']),
      left: bind(['A', 'LEFT']),
      right: bind(['D', 'RIGHT']),
      run: bind(['SHIFT']),
    };
    kb?.on('keydown-E', () => this.interact());
    kb?.on('keydown-ESC', () => {
      if (document.pointerLockElement) document.exitPointerLock();
    });

    this.onMouse = (e: MouseEvent) => {
      if (document.pointerLockElement) this.yaw -= e.movementX * 0.0022;
    };
    window.addEventListener('mousemove', this.onMouse);
    this.input.on('pointerdown', () => {
      if (!document.pointerLockElement) void this.game.canvas.requestPointerLock?.();
    });
  }

  private held(g: string): boolean {
    return this.keys[g]?.some((k) => k.isDown) ?? false;
  }

  private interact(): void {
    if (this.mode !== 'play') return;

    if (this.hiding) {
      this.hiding = null;
      audio.sfx('footstep_concrete');
      return;
    }

    // the door, if you have what it opens
    const d = this.def;
    if (Math.hypot(this.pos.x - d.door.x, this.pos.y - d.halfD) < DOOR_REACH) {
      if (this.hasKey) this.escape();
      else this.say('LOCKED. HE HAS THE KEY... SOMEWHERE.', 2200);
      return;
    }

    if (!this.hasKey && this.pos.distanceTo(this.keyAt) < KEY_REACH) {
      this.hasKey = true;
      this.keyMesh?.parent?.remove(this.keyMesh);
      this.keyMesh = null;
      audio.sfx('lock_click');
      this.say('THE KEY. GET TO THE DOOR.', 2600);
      return;
    }

    const chest = this.nearestChest(CHEST_REACH);
    if (chest && !chest.opening) {
      this.hiding = chest;
      audio.sfx('hop_wet');
    }
  }

  private say(text: string, ms: number): void {
    this.subtitle = text;
    this.time.delayedCall(ms, () => {
      if (this.subtitle === text) this.subtitle = '';
    });
  }

  private nearestChest(within: number): Chest3D | null {
    let best: Chest3D | null = null;
    let bestD = within;
    for (const c of this.chests) {
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

    if (this.mode === 'intro') {
      this.runIntro(dt);
    } else if (this.mode === 'play') {
      this.movePlayer(dt);
      this.moveFroggy(dt);
    } else if (this.mode === 'caught') {
      this.caughtT += dt;
    }

    for (const c of this.chests) {
      const want = c.opening ? 1 : 0;
      c.open += (want - c.open) * Math.min(1, dt * 6);
      c.lid.rotation.x = -c.open * 1.5;
    }

    this.updateCamera(dt);
    this.updateSprite();
    this.paintOverlay();
    this.publishTelemetry();
  }

  /** He shuts the door behind you, throws the key, and tells you the rules. */
  private runIntro(dt: number): void {
    this.introT += dt;
    const t = this.introT;

    // He stands at the door doing the locking, then walks off into the room.
    if (t < 4.0) {
      this.froggy.set(this.def.door.x, this.def.halfD - 1.4);
      this.yaw = Math.PI; // you are watching him do it
    } else if (t < 4.2) {
      this.yaw = 0;
      this.froggy.set(this.def.froggyStart.x, this.def.froggyStart.z);
    }
    if (t < 1.0) this.subtitle = '';
    else if (t < 4.2) this.subtitle = "LET'S PLAY A GAME!";
    else if (t < 7.4) this.subtitle = 'FIND THE KEY AND LET YOURSELF FREE';
    else if (t < 9.4) this.subtitle = '...OR DIE.';
    else this.subtitle = '';

    if (t > 2.6 && t < 2.8) audio.sfx('lock_click');
    if (t > 3.0 && t < 3.2) audio.sfx('door_rattle');

    if (t >= 9.8) {
      this.mode = 'play';
      this.subtitle = '';
      this.grace = 4;
      this.freeFroggy();
      this.pickWaypoint();
    }
  }

  private movePlayer(dt: number): void {
    if (this.hiding) {
      this.pos.set(this.hiding.x, this.hiding.z);
      return;
    }

    const fwd = (this.held('fwd') ? 1 : 0) - (this.held('back') ? 1 : 0);
    const strafe = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);

    // Without pointer lock, A/D steer instead of strafing, so it is playable
    // on a trackpad exactly like the chase is.
    if (!document.pointerLockElement && strafe !== 0) {
      this.yaw -= strafe * (fwd === 0 ? 2.0 : 1.3) * dt;
      if (fwd === 0) return;
    }

    const running = this.held('run');
    const speed = running ? RUN : WALK;
    if (fwd === 0 && (strafe === 0 || !document.pointerLockElement)) return;

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let dx = -sin * fwd;
    let dz = -cos * fwd;
    if (document.pointerLockElement) {
      dx += cos * strafe;
      dz += -sin * strafe;
    }
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
    }
  }

  private moveFroggy(dt: number): void {
    // A few seconds of grace.  Without it he is already looking straight down
    // the room as the intro ends, and the first thing the room does is chase.
    this.grace = Math.max(0, this.grace - dt);
    const seen = this.grace <= 0 && !this.hiding && this.sees();
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
      }
    }

    // Standing still and listening, or working a chest, means not walking.
    if (this.fMode === 'listen' || this.fMode === 'openChest') {
      this.fTimer -= dt;
      if (this.fMode === 'openChest' && this.targetChest) {
        // The lid comes up at the halfway mark.
        this.targetChest.opening = this.fTimer < 0.9;
        if (this.fTimer < 0.9 && this.hiding === this.targetChest) {
          this.caught();
          return;
        }
      }
      if (this.fTimer <= 0) {
        if (this.targetChest) this.targetChest.opening = false;
        this.targetChest = null;
        this.fMode = 'search';
        this.pickWaypoint();
      }
      return;
    }

    const target = this.fMode === 'chase' ? this.pos : this.waypoint;
    const speed = this.fMode === 'chase' ? FROGGY_CHASE : FROGGY_SEARCH;
    const ax = target.x - this.froggy.x;
    const az = target.y - this.froggy.y;
    const dist = Math.hypot(ax, az);

    if (dist < 0.6) {
      if (this.fMode === 'suspicious') this.fMode = 'search';
      this.arrive();
      return;
    }

    this.froggyYaw = Math.atan2(ax, az);
    const nx = this.froggy.x + (ax / dist) * speed * dt;
    const nz = this.froggy.y + (az / dist) * speed * dt;
    const freeX = !this.solid(nx, this.froggy.y, 0.5);
    const freeZ = !this.solid(this.froggy.x, nz, 0.5);

    if (freeX && freeZ) {
      this.froggy.x = nx;
      this.froggy.y = nz;
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
      // Blocked both ways: a pocket.  Re-routing alone can pick another blocked
      // heading forever, so if he genuinely cannot move, put him back on floor.
      this.stuckT += dt;
      if (this.fMode !== 'chase') this.pickWaypoint();
      if (this.stuckT > 1.2) {
        this.stuckT = 0;
        this.freeFroggy(true);
      }
    }
    this.clampToRoom(this.froggy);

    if (this.fMode !== 'chase' && this.pos.distanceTo(this.froggy) < CATCH_DIST) this.caught();
    if (this.fMode === 'chase' && this.pos.distanceTo(this.froggy) < CATCH_DIST) this.caught();
  }

  /** What he does on reaching a waypoint: check it, listen, or move on. */
  private arrive(): void {
    const chest = this.chestNear(this.froggy, 1.8);
    const roll = Math.random();
    if (chest && roll < 0.45) {
      this.targetChest = chest;
      this.fMode = 'openChest';
      this.fTimer = 1.6;
      audio.sfx('door_creak');
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

  private chestNear(p: THREE.Vector2, within: number): Chest3D | null {
    let best: Chest3D | null = null;
    let bestD = within;
    for (const c of this.chests) {
      const dist = Math.hypot(p.x - c.x, p.y - c.z);
      if (dist < bestD) {
        bestD = dist;
        best = c;
      }
    }
    return best;
  }

  /**
   * Waypoints favour the chests, so he tours the hiding places rather than
   * wandering the middle of the floor where there is nothing to find.
   */
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

  private pickWaypoint(): void {
    if (Math.random() < 0.65 && this.chests.length > 0) {
      const c = Phaser.Utils.Array.GetRandom(this.chests);
      this.waypoint.set(c.x, c.z);
      return;
    }
    this.waypoint.set(
      Phaser.Math.FloatBetween(-this.def.halfW + 1.5, this.def.halfW - 1.5),
      Phaser.Math.FloatBetween(-this.def.halfD + 1.5, this.def.halfD - 1.5),
    );
  }

  private alert(): void {
    if (this.fMode === 'chase') return;
    this.lastSeen.copy(this.pos);
    this.waypoint.copy(this.pos);
    this.fMode = 'suspicious';
    this.targetChest = null;
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

  /** Furniture is solid to bodies and to sight.  `pad` widens it for him. */
  private solid(x: number, z: number, pad = PLAYER_R): boolean {
    for (const b of this.blockers) {
      if (Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) return true;
    }
    for (const c of this.chests) {
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

  private updateSprite(): void {
    if (!this.sprite) return;
    this.sprite.position.set(this.froggy.x, 1.2, this.froggy.y);
    const chasing = this.fMode === 'chase';
    this.sprite.scale.set(chasing ? 2.7 : 2.4, chasing ? 2.7 : 2.4, 1);
  }

  /**
   * All UI lives here.  The 3D canvas sits above Phaser's, so a Phaser text
   * object in this scene is behind the world and invisible.  The overlay's
   * context is already transformed into 320x180 game space.
   */
  private paintOverlay(): void {
    froggyLayer.paint((ctx) => {
      if (this.hiding) this.paintPeephole(ctx);

      if (this.mode === 'caught') {
        ctx.fillStyle = `rgba(20,2,4,${Math.min(0.86, this.caughtT * 1.6)})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        drawPixelText(ctx, 'HE FOUND YOU', GAME_W / 2, GAME_H * 0.42, {
          scale: 2,
          color: '#c8232b',
          center: true,
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

      if (this.mode === 'play') {
        drawPixelText(ctx, this.hasKey ? 'KEY' : '- - -', 6, 6, {
          scale: 1,
          color: this.hasKey ? '#ffd45e' : '#7a8494',
          alpha: 0.85,
        });
      }
    });
  }

  /** A slit of vision, and everything else is the inside of a box. */
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
      hasKey: this.hasKey,
      keyX: this.keyAt.x,
      keyZ: this.keyAt.y,
      chests: this.chests.map((c) => ({ x: c.x, z: c.z, open: c.open })),
      playerRun: RUN,
      froggyChase: FROGGY_CHASE,
      doorX: this.def.door.x,
      doorZ: this.def.halfD,
      dbg: {
        fwd: this.held('fwd'),
        pointerLock: !!document.pointerLockElement,
        frames: ++this.frames,
        blockedAtSpawn: this.solid(this.pos.x, this.pos.y),
        froggyBlocked: this.solid(this.froggy.x, this.froggy.y, 0.5),
      },
    };
  }

  // ----------------------------------------------------------------- endings

  private caught(): void {
    if (this.mode !== 'play') return;
    this.mode = 'caught';
    this.caughtT = 0;
    this.hiding = null;
    audio.scare();

    froggyLayer.paint((ctx) => {
      ctx.fillStyle = '#140306';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      drawFroggy(ctx, {
        x: GAME_W / 2,
        y: 58,
        height: 320,
        variant: 'monster',
        anchor: 'face',
        morph: 1,
        maw: 1,
        blood: 1,
        pupil: 0.1,
        t: 0,
        shake: 1,
      });
    });

    this.time.delayedCall(2200, () => {
      froggyLayer.clear();
      this.scene.restart();
    });
  }

  private escape(): void {
    if (this.mode !== 'play') return;
    this.mode = 'escaping';
    audio.sfx('door_creak');
    this.subtitle = '';

    const next = this.roomIndex + 1;
    this.time.delayedCall(1200, () => {
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
    if (this.onMouse) window.removeEventListener('mousemove', this.onMouse);
    this.onMouse = null;
    if (document.pointerLockElement) document.exitPointerLock();
    this.stage?.dispose();
    this.stage = null;
    froggyLayer.clear();
    delete (window as unknown as Record<string, unknown>).__hide;
  }

  update(): void {
    // The prompt is cheap to recompute and needs to track the player.
    if (this.mode !== 'play') {
      this.prompt = '';
      return;
    }
    if (this.hiding) {
      this.prompt = '';
      return;
    }
    const d = this.def;
    if (Math.hypot(this.pos.x - d.door.x, this.pos.y - d.halfD) < DOOR_REACH) {
      this.prompt = this.hasKey ? '[E] UNLOCK' : '[E] LOCKED';
    } else if (!this.hasKey && this.pos.distanceTo(this.keyAt) < KEY_REACH) {
      this.prompt = '[E] TAKE THE KEY';
    } else if (this.nearestChest(CHEST_REACH)) {
      this.prompt = '[E] HIDE';
    } else {
      this.prompt = '';
    }
  }
}
