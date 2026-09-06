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
import { drawFroggy } from '../froggy/froggy';
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
const CATCH_RADIUS = 1.1;
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
  private pos = new THREE.Vector2();
  private froggy = new THREE.Vector2();
  private froggySprite: THREE.Sprite | null = null;
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
    // Mouse look, without demanding pointer lock.
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.event instanceof MouseEvent && document.pointerLockElement) {
        this.yaw -= p.event.movementX * 0.0022;
      }
    });
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

    const wallMat = new THREE.MeshLambertMaterial({ color: 0x46525f });
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x333c46 });
    const ceilMat = new THREE.MeshLambertMaterial({ color: 0x1d242c });
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

    // Froggy: the SAME vector art, rasterised for the 3D consumer (PRD FR-3).
    const tex = new THREE.CanvasTexture(this.renderFroggyTexture());
    tex.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: true, transparent: true }));
    sprite.scale.set(2.6, 2.6, 1);
    st.scene.add(sprite);
    this.froggySprite = sprite;
  }

  /** One source of truth for his art; this is just a different consumer. */
  private renderFroggyTexture(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.save();
    ctx.translate(128, 0);
    ctx.scale(1.6, 1.6);
    ctx.translate(-60, 6);
    drawFroggy(ctx, { x: 60, y: 140, height: 140, variant: 'predator', maw: 0.85 });
    ctx.restore();
    return c;
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

  private movePlayer(dt: number): void {
    const { fwd, strafe, turn } = this.moveInput();
    this.yaw -= turn * 2.4 * dt;

    // Without pointer lock, strafing steers: A/D turn you when you are not
    // also holding forward, so the game is playable on a trackpad.
    if (!document.pointerLockElement && strafe !== 0 && fwd === 0) {
      this.yaw -= strafe * 2.0 * dt;
      return;
    }
    if (!document.pointerLockElement && strafe !== 0) this.yaw -= strafe * 1.4 * dt;

    if (fwd === 0) return;
    // Three's camera looks down -Z, so forward is (-sin yaw, -cos yaw).
    const dx = -Math.sin(this.yaw) * fwd * PLAYER_SPEED * dt;
    const dz = -Math.cos(this.yaw) * fwd * PLAYER_SPEED * dt;

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

    if (this.froggySprite) {
      this.froggySprite.position.set(this.froggy.x, 1.3, this.froggy.y);
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
    audio.sfx('death_stinger');

    // He fills the frame, on the same overlay as the basement scare.
    let maw = 0.5;
    const paint = () =>
      froggyLayer.paint((ctx) => {
        drawFroggy(ctx, {
          x: GAME_W / 2,
          y: 60,
          height: 320,
          variant: 'predator',
          anchor: 'face',
          maw,
        });
      });
    paint();
    this.cameras.main.shake(400, 0.03);
    this.time.addEvent({
      delay: 55,
      repeat: 9,
      callback: () => {
        maw = Math.min(1, maw + 0.06);
        paint();
      },
    });

    this.time.delayedCall(1400, () => {
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
    this.froggySprite = null;
    if (document.pointerLockElement) document.exitPointerLock?.();
  }
}
