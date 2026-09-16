/**
 * The chase.  PRD §7.15 / QFD C8 (rank #9).
 *
 * First person, in the basement corridors made real, run in reverse so the
 * player recognises the route.
 *
 * The tuning is the design (PRD CH-1..CH-7):
 *   player 4.0 m/s, Froggy EXACTLY 2.0 m/s, constant, never scaled
 *   he pathfinds directly toward the player and never stops
 *   he is kept out of the flashlight cone; the wet hopping does the work
 *   two dead-end forks that look like the right way
 *
 * Because he is half your speed he can never catch a player who knows the way.
 * He catches players who get lost.  That is the entire fear.
 */

import Phaser from 'phaser';
import * as THREE from 'three';
import { audio, SILENCE } from '../core/audio';
import { store } from '../core/state';
import { froggyLayer } from '../render/froggyLayer';
import { playJumpscare, SCARE_MS } from '../froggy/jumpscare';
import { FroggyMonster } from '../three/froggyMonster';
import { alleySurfaces, dressAlley } from '../three/alleyDecor';
import { ThreeStage } from '../render/threeStage';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import {
  CELL,
  COLS,
  GRID,
  ROWS,
  cellOf,
  findCell,
  isWall,
  nextStepToward,
  optimalRouteLength,
  worldX,
  worldZ,
} from '../three/chaseLevel';

const PLAYER_SPEED = 4.0; // W
const FROGGY_SPEED = PLAYER_SPEED * 0.5; // exactly half.  Never scaled. (CH / H6)
/**
 * How big he is down here, and how far his reach goes because of it.
 *
 * The reach follows the size for the same reason it does in the hide rooms: a
 * creature twice as wide whose grab did not grow would be one you could run
 * past through his chest.
 */
const FROGGY_SCALE = 1.35;
const CATCH_RADIUS = 1.1 * (1 + (FROGGY_SCALE - 1) * 0.5);
const FOG_DENSITY = 0.085; // full occlusion past ~12m
const HEADBOB_HZ = 1.6;
const HEADBOB_AMP = 0.04;
const EYE_HEIGHT = 1.6;
const WALL_H = 3.2;
const PLAYER_RADIUS = 0.45;
const FROGGY_HEAD_START = 8; // metres behind

export class Chase3D extends Phaser.Scene {
  private stage: ThreeStage | null = null;
  private yaw = 0;
  /** A held left button turns the view; the on-screen look pad sends one. */
  private dragging = false;
  private onLookDown: ((e: MouseEvent) => void) | null = null;
  private onLookMove: ((e: MouseEvent) => void) | null = null;
  private onLookUp: (() => void) | null = null;
  private pos = new THREE.Vector2();
  private froggy = new THREE.Vector2();
  private monster: FroggyMonster | null = null;
  /** Where he was last frame, so the walk cycle knows how fast he is going. */
  private froggyWas = new THREE.Vector2();
  /** How many meshes he is made of.  See buildAlley.  */
  private froggyMeshes = 0;
  private bobT = 0;
  private stepT = 0;
  private hopT = 0;
  private breathT = 0;
  private repathT = 0;
  private over = false;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private exit = { col: 1, row: 10 };
  /** Telemetry (PRD DV-2). */
  private elapsed = 0;
  private inConeMs = 0;
  private routeLen = 0;

  constructor() {
    super('Chase3D');
  }

  create(): void {
    froggyLayer.clear();
    this.over = false;
    this.elapsed = 0;
    this.inConeMs = 0;
    this.routeLen = optimalRouteLength(); // BFS once, not once a frame

    // No music.  Breathing, footsteps, and the hopping behind you.
    audio.setScene(SILENCE);

    // Phaser draws black underneath the Three canvas.
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000).setOrigin(0, 0);
    this.cameras.main.fadeIn(600, 0, 0, 0);

    const root = document.getElementById('game-root');
    const canvas = this.game.canvas;
    if (!root) return;

    this.stage = new ThreeStage();
    this.stage.mount(root, canvas);
    this.buildLevel();

    const start = findCell('S');
    this.exit = findCell('E');

    // Walk a few cells up the route and put the player there, with Froggy on
    // the start cell.  Spawning him at a raw metre offset put him inside the
    // wall behind the start, where pathfinding failed and he came straight
    // through the geometry.
    const lead = Math.max(1, Math.round(FROGGY_HEAD_START / CELL));
    let cur = start;
    const trail = [start];
    for (let i = 0; i < lead; i++) {
      const nxt = nextStepToward(cur, this.exit);
      if (!nxt) break;
      cur = nxt;
      trail.push(cur);
    }
    this.pos.set(worldX(cur.col), worldZ(cur.row));
    this.froggy.set(worldX(start.col), worldZ(start.row));

    // Face the way the route goes, so the first thing the player sees is the
    // corridor ahead rather than a wall.
    const ahead = nextStepToward(cur, this.exit) ?? cur;
    this.yaw = Math.atan2(-(worldX(ahead.col) - this.pos.x), -(worldZ(ahead.row) - this.pos.y));

    const kb = this.input.keyboard;
    if (kb) {
      this.keys = {
        up: [kb.addKey('W'), kb.addKey('UP')],
        down: [kb.addKey('S'), kb.addKey('DOWN')],
        left: [kb.addKey('A'), kb.addKey('LEFT')],
        right: [kb.addKey('D'), kb.addKey('RIGHT')],
        turnL: [kb.addKey('Q')],
        turnR: [kb.addKey('E')],
      };
    }
    // Look, two ways, and neither of them is a movement key: pointer lock if
    // the browser gives it, and a held left-drag if not — which is also what
    // the on-screen look pad sends.  The Three canvas is over the Phaser one,
    // so the drag is listened for at the window.
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.event instanceof MouseEvent && document.pointerLockElement) {
        this.yaw -= p.event.movementX * 0.0022;
      }
    });
    this.onLookDown = (e: MouseEvent) => {
      if (e.button === 0) this.dragging = true;
    };
    this.onLookMove = (e: MouseEvent) => {
      if (!this.dragging || document.pointerLockElement) return;
      this.yaw -= (e.movementX || 0) * 0.0035;
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

    if (import.meta.env?.DEV) {
      console.info(`[chase] optimal route ${this.routeLen}m ≈ ${(this.routeLen / PLAYER_SPEED).toFixed(0)}s`);
    }
  }

  // ------------------------------------------------------------------- level

  private buildLevel(): void {
    const st = this.stage!;
    st.scene.fog = new THREE.FogExp2(0x05070a, FOG_DENSITY);
    st.scene.background = new THREE.Color(0x05070a);

    // Enough ambience to read the corridor shape, and no more.
    st.scene.add(new THREE.AmbientLight(0x2c3c50, 0.55));

    // the flashlight: a 35 degree cone, 10m, mounted to the camera
    // 35 degree cone (17.5 half-angle), 11m reach, mounted to the camera.
    // Three's lighting is physical by default, so intensity is candela: the
    // values that look right in a legacy renderer read as pitch black here.
    const light = new THREE.SpotLight(0xfff0c9, 220, 16, THREE.MathUtils.degToRad(17.5), 0.5, 1.0);
    light.position.set(0, 0, 0);
    st.camera.add(light);
    st.camera.add(light.target);
    light.target.position.set(0, 0, -1);
    // a little spill so your own feet exist
    const fill = new THREE.PointLight(0xcfe0ff, 6, 6, 1.6);
    st.camera.add(fill);
    st.scene.add(st.camera);

    // Brick, wet concrete and a stained ceiling, instead of three flat colours.
    // With a torch on them, three flat colours is not a place -- it is a maze
    // demo where every junction is the same junction.
    const surf = alleySurfaces();
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x8a949e, map: surf.wall });
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x9aa4ae, map: surf.floor });
    const ceilMat = new THREE.MeshLambertMaterial({ color: 0x8a949e, map: surf.ceiling });
    const wallGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);

    const floorSize = Math.max(COLS, ROWS) * CELL;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(floorSize, floorSize), floorMat);
    floor.rotation.x = -Math.PI / 2;
    st.scene.add(floor);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(floorSize, floorSize), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = WALL_H;
    st.scene.add(ceil);

    // One instanced mesh for every wall cell: cheap, and the walls cannot gap.
    let wallCount = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (GRID[r][c] === '#') wallCount++;
    const walls = new THREE.InstancedMesh(wallGeo, wallMat, wallCount);
    const m = new THREE.Matrix4();
    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (GRID[r][c] !== '#') continue;
        m.makeTranslation(worldX(c), WALL_H / 2, worldZ(r));
        walls.setMatrixAt(i++, m);
      }
    }
    st.scene.add(walls);

    // the way out: the stairs up, the only warm thing down here
    const exitCell = findCell('E');
    const exitLight = new THREE.PointLight(0xffb038, 60, 12, 1.2);
    exitLight.position.set(worldX(exitCell.col), 2.2, worldZ(exitCell.row));
    st.scene.add(exitLight);
    const stairs = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.8, 0.6, CELL * 0.8),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2f }),
    );
    stairs.position.set(worldX(exitCell.col), 0.3, worldZ(exitCell.row));
    st.scene.add(stairs);

    // And then everything that has been left down here: pipe runs, doors that
    // have been shut a long time, cables across the corridors, bins, crates,
    // planks, bags and litter.  None of it is a collider -- see alleyDecor.
    dressAlley({
      scene: st.scene,
      cols: COLS,
      rows: ROWS,
      cell: CELL,
      wallH: WALL_H,
      isWall: (c, r) => c < 0 || r < 0 || c >= COLS || r >= ROWS || isWall(c, r),
      worldX,
      worldZ,
    });

    // Froggy: the SAME model the hide rooms use.  He was a billboard of a
    // different drawing of him here, so walking out of the basement swapped the
    // creature for a different one — same name, different animal.
    //
    // AND HE IS THE SIZE HE IS UPSTAIRS, as near as the ceiling allows.  At
    // scale 1 he was 2.4m in a 3.2m corridor and read as a man in a suit; the
    // hide rooms run him at 1.75, which folds to 3.6m and would put his head
    // through this ceiling.  1.42 folds to about 2.9m: he fills the corridor,
    // he clears the pipes, and he is unmistakably the thing from the rooms.
    this.monster = new FroggyMonster(FROGGY_SCALE);
    st.scene.add(this.monster.root);
    this.froggyWas.copy(this.froggy);
    // Same fingerprint the hide rooms publish: the harness compares them.
    this.froggyMeshes = 0;
    this.monster.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) this.froggyMeshes++;
    });
  }

  // -------------------------------------------------------------------- loop

  private tick(dt: number): void {
    if (this.over || !this.stage) return;
    this.elapsed += dt * 1000;

    this.movePlayer(dt);
    this.moveFroggy(dt);
    this.updateCamera(dt);
    this.updateAudio(dt);

    if (import.meta.env?.DEV) {
      // Telemetry for the automated harness (PRD DV-2).
      (window as unknown as Record<string, unknown>).__chase = {
        px: this.pos.x,
        pz: this.pos.y,
        fx: this.froggy.x,
        fz: this.froggy.y,
        dist: this.pos.distanceTo(this.froggy),
        elapsed: this.elapsed,
        inConePct: this.elapsed > 0 ? (this.inConeMs / this.elapsed) * 100 : 0,
        over: this.over,
        playerSpeed: PLAYER_SPEED,
        froggySpeed: FROGGY_SPEED,
        optimalRoute: this.routeLen,
        froggyMeshes: this.froggyMeshes,
      };
    }

    // caught
    if (this.pos.distanceTo(this.froggy) < CATCH_RADIUS) {
      this.caught();
      return;
    }

    // out
    const cell = cellOf(this.pos.x, this.pos.y);
    if (cell.col === this.exit.col && cell.row === this.exit.row) this.escaped();

  }

  private moveInput(): { fwd: number; strafe: number; turn: number } {
    const held = (g: string) => this.keys[g]?.some((k) => k.isDown) ?? false;
    return {
      fwd: (held('up') ? 1 : 0) - (held('down') ? 1 : 0),
      strafe: (held('right') ? 1 : 0) - (held('left') ? 1 : 0),
      turn: (held('turnR') ? 1 : 0) - (held('turnL') ? 1 : 0),
    };
  }

  /**
   * W AND S WALK, A AND D STEP SIDEWAYS, AND ONLY THE MOUSE TURNS YOU.
   *
   * A and D used to steer when the browser had not given up pointer lock —
   * the corridor had to be turnable somehow on a trackpad, and that was the
   * somehow.  It made the two keys mean different things depending on a
   * browser permission the player never sees, and in a corridor where you are
   * being followed, a key that swings the whole view when you meant to sidle
   * round a corner is the difference between getting past him and walking
   * into him.  The view is the mouse's, held or locked; the keys are the
   * feet's.  Q and E are still there for anyone who wants to turn on the
   * keyboard, and they are the only keys that do.
   */
  private movePlayer(dt: number): void {
    const { fwd, strafe, turn } = this.moveInput();
    this.yaw -= turn * 2.4 * dt;
    if (fwd === 0 && strafe === 0) return;

    // Three's camera looks down -Z, so forward is (-sin yaw, -cos yaw) and
    // right is that turned a quarter: (-cos yaw, sin yaw).
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let dx = -sin * fwd - cos * strafe;
    let dz = -cos * fwd + sin * strafe;
    // Diagonals must not be faster than straight lines.
    const len = Math.hypot(dx, dz);
    if (len > 1) {
      dx /= len;
      dz /= len;
    }
    dx *= PLAYER_SPEED * dt;
    dz *= PLAYER_SPEED * dt;

    // slide along walls instead of sticking to them
    if (!this.blocked(this.pos.x + dx, this.pos.y)) this.pos.x += dx;
    if (!this.blocked(this.pos.x, this.pos.y + dz)) this.pos.y += dz;

    this.bobT += dt;
    this.stepT += dt;
    if (this.stepT > 0.34) {
      this.stepT = 0;
      audio.sfx('footstep_concrete');
    }
  }

  private blocked(x: number, z: number): boolean {
    for (const [ox, oz] of [
      [PLAYER_RADIUS, 0],
      [-PLAYER_RADIUS, 0],
      [0, PLAYER_RADIUS],
      [0, -PLAYER_RADIUS],
    ]) {
      const c = cellOf(x + ox, z + oz);
      if (isWall(c.col, c.row)) return true;
    }
    return false;
  }

  /** CH-1: directly toward the player, always, at exactly half speed. */
  private moveFroggy(dt: number): void {
    this.repathT -= dt;
    const from = cellOf(this.froggy.x, this.froggy.y);
    const to = cellOf(this.pos.x, this.pos.y);

    const step = nextStepToward(from, to);
    const targetX = step ? worldX(step.col) : this.pos.x;
    const targetZ = step ? worldZ(step.row) : this.pos.y;

    const dx = targetX - this.froggy.x;
    const dz = targetZ - this.froggy.y;
    const d = Math.hypot(dx, dz);
    if (d > 0.001) {
      const s = Math.min(d, FROGGY_SPEED * dt);
      this.froggy.x += (dx / d) * s;
      this.froggy.y += (dz / d) * s;
    }

    if (this.monster) {
      // He is coming for you down a corridor he knows: mouth open the whole way.
      const moved = this.froggy.distanceTo(this.froggyWas);
      this.froggyWas.copy(this.froggy);
      // Built facing +Z, so the angle that points +Z down the alley at you is
      // the angle he wears.  No half turn: that walked him backwards.
      this.monster.setPose(this.froggy.x, 0, this.froggy.y, Math.atan2(dx, dz));
      this.monster.update(dt, {
        speed: dt > 0 ? moved / dt : 0,
        maw: 1,
        climb: 0,
        scan: 0,
        lunge: 1,
      });
    }
  }

  private updateCamera(dt: number): void {
    const cam = this.stage!.camera;
    this.bobT += dt * 0;
    const bob = Math.sin(this.bobT * Math.PI * 2 * HEADBOB_HZ) * HEADBOB_AMP;
    cam.position.set(this.pos.x, EYE_HEIGHT + bob, this.pos.y);
    cam.rotation.set(0, this.yaw, 0);

    // CH-2 telemetry: how much of the run does he spend lit?
    const toFroggy = new THREE.Vector2(this.froggy.x - this.pos.x, this.froggy.y - this.pos.y);
    const facing = new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw));
    const cos = toFroggy.clone().normalize().dot(facing.normalize());
    if (cos > Math.cos(THREE.MathUtils.degToRad(17.5)) && toFroggy.length() < 11) {
      this.inConeMs += dt * 1000;
    }
  }

  /** CH-3: the wet hopping gets louder as he closes.  It does the work. */
  private updateAudio(dt: number): void {
    const d = this.pos.distanceTo(this.froggy);

    this.hopT -= dt;
    if (this.hopT <= 0) {
      // he hops faster-sounding when close, though his speed never changes
      this.hopT = Phaser.Math.Clamp(d / 14, 0.34, 1.1);
      if (d < 22) audio.sfx('hop_wet');
    }

    this.breathT -= dt;
    if (this.breathT <= 0) {
      this.breathT = 1.6;
      audio.sfx('footstep_carpet'); // stands in for the breath until Phase 7
    }
  }

  // ------------------------------------------------------------------ ending

  /** The telemetry freezes on the terminal frame, so stamp the outcome. */
  private markOver(how: string): void {
    if (!import.meta.env?.DEV) return;
    const t = (window as unknown as Record<string, Record<string, unknown>>).__chase;
    if (t) {
      t.over = true;
      t.outcome = how;
    }
  }

  private caught(): void {
    if (this.over) return;
    this.over = true;
    this.markOver('caught');

    // The same scare the basement uses, because it is the same creature.
    playJumpscare(this);

    this.time.delayedCall(SCARE_MS + 400, () => {
      froggyLayer.clear();
      this.teardown();
      // PRD CH-5 / open question #5: a death is a full reset to Boot.
      store.resetRun();
      this.scene.start('EndCard', { title: 'YOU WERE EATEN', quiet: true, noReset: true });
      this.time.delayedCall(4000, () => this.scene.start('Boot'));
    });
  }

  private escaped(): void {
    if (this.over) return;
    this.over = true;
    this.markOver('escaped');
    if (import.meta.env?.DEV) {
      console.info(
        `[chase] escaped in ${(this.elapsed / 1000).toFixed(1)}s, ` +
          `Froggy lit ${((this.inConeMs / this.elapsed) * 100).toFixed(0)}% of it`,
      );
    }
    store.patch({ route: 'ended' });
    store.flush();
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.time.delayedCall(900, () => {
      this.teardown();
      if (this.scene.get('OutroCutscene3D')) this.scene.start('OutroCutscene3D');
      else this.scene.start('EndCard', { title: 'End' });
    });
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
