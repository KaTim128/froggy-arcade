/**
 * The room that is not on the map.
 *
 * There is a section of the right-hand wall of each hide room that you can
 * walk straight through.  Nothing marks it — no door, no seam, no prompt, no
 * glow, no line of dialogue anywhere in the game that mentions it.  The only
 * way in is to already know, which means somebody told you, which is the point:
 * it is the one thing in this sequence that is passed between players rather
 * than taught by it.
 *
 * WHAT IS BEHIND IT IS A LABORATORY.  Pale blue tile and pale blue light,
 * a bench of glassware and monitors, a gurney with its straps undone, a rack
 * of blinking things, an empty cage too big for anything that belongs in a
 * cage -- and in the middle of it all, floor to ceiling, a containment tube
 * with another of HIM floating in it.  Calm music plays.  A heater is wheeled
 * up to the glass, and switching it on is the one thing in here that makes
 * anything happen to him.  A few things on the benches can be picked up and
 * put down again.  The hide rooms do not get dressed down to meet it; the
 * cold, clean calm of it IS the effect.
 *
 * AND IT IS GENUINELY SAFE.  Not a better hiding place — safe.  He cannot come
 * through the wall, he cannot hear you, he cannot see you, his pathfinder does
 * not know the wall is anything but a wall, and a chase that was in progress
 * when you stepped through simply ends.  The scene refuses to catch you in
 * here at all.
 *
 * UPSTAIRS IS WHY IT IS STILL A HORROR ROOM.  A staircase out of the lab
 * leads onto a mezzanine whose floor is glass, and under the glass is THE ROOM
 * YOU WERE JUST IN -- the whole of it, rebuilt from the same definition the
 * hunt is running in, at a third of size so it fits under the pane.  Room one,
 * two or three, whichever round this is.  It is an observation gallery over an
 * enclosure, and the animal in the enclosure is the thing that was chasing
 * you: still in there, still working the boxes, still looking for a player who
 * is now standing over it.
 *
 * HE IS NOT A SECOND FROGGY.  The twin down there decides nothing -- every
 * frame it is handed the pose the room's own model is wearing (see `watch`),
 * so what you are watching is the real search, in real time, for you.  He
 * cannot see up through the glass, cannot hear through it, cannot reach it and
 * has no path to it: the only thing that crosses the pane is your line of
 * sight.
 *
 * Geometry is local to this module and lives at SECRET_ORIGIN, a long way from
 * any hide room, so nothing in the hunt can reach it by accident.
 */

import * as THREE from 'three';
import type { Box, RoomDef } from './hideRooms';
import { FroggyMonster, type FroggyPose } from './froggyMonster';

/**
 * What the room says he is doing this frame, handed straight to the twin in
 * the enclosure.  Position and facing are in ROOM coordinates: the enclosure
 * group carries the scale, so nothing here has to know what it is.
 */
export interface Watched {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pose: FroggyPose;
  /**
   * How far open each hiding place is, 0..1, in the same order as the room's
   * own `spots`.
   *
   * THE ENCLOSURE IS NOT A SECOND HUNT.  It is this hunt, drawn twice: the
   * position, the facing, the pose and now the LIDS all come off the real
   * room's state every frame.  When he walks to a wardrobe down there and
   * opens it, it is because he has walked to that wardrobe up here and opened
   * it -- there is nothing scripted in the glass and nothing to keep in step.
   */
  lids?: number[];
}

/**
 * Where the complex is built, in world space.  Far enough from every room that
 * no stray coordinate, pathfinding probe or earshot test can reach it.
 */
export const SECRET_ORIGIN = new THREE.Vector3(0, 0, -600);

/**
 * How big he is, which is the hide rooms' own number.  He is built INSIDE the
 * enclosure group, so the room's scale is applied to him too and he stands the
 * same height against that furniture down there as he does against the real
 * thing upstairs.
 */
const FROGGY_SCALE = 1.75;

/** The mezzanine's height: a full storey up, and the ceiling of the enclosure. */
const MEZZ_Y = 4.6;
/** The lounge runs from the back wall to the divider; the chamber from it. */
const DIVIDE_Z = -2.5;
const MIN_X = -9;
const MAX_X = 9;
const MIN_Z = -19;
const MAX_Z = 13;
/** The staircase run, against the right-hand wall, from level with the pedestal. */
const STAIR_X0 = 5.0;
const STAIR_Z0 = -10.5;

export interface SecretRoom {
  root: THREE.Group;
  /** Collision, in local coordinates.  The walls are handled by `clamp`. */
  blockers: Box[];
  /** Where you arrive, and which way you are looking when you do. */
  spawn: { x: number; z: number; yaw: number };
  /** The way on to the next room.  Chunky, lit, and impossible to miss. */
  button: { x: number; z: number };
  /** Floor height under a point: 0 in the lounge, ramping up the stairs, MEZZ_Y on the glass. */
  floorAt(x: number, z: number): number;
  /** Keep the player inside the shell. */
  clamp(v: THREE.Vector2): void;
  /** Drives the lab, the tube and the thing under the glass. */
  tick(dt: number): void;
  /** The heater by the tube: where it is, and switching it. Returns whether it is now on. */
  heater: { x: number; z: number };
  toggleHeater(): boolean;
  /** The closest thing within reach that can be picked up, if any. */
  nearestPickable(x: number, z: number, floorY: number): { id: string; name: string } | null;
  /** Lift it: from now on it goes where `carry` puts it. */
  pickUp(id: string): void;
  /** Hold the carried thing at this WORLD position (in front of the camera). */
  carry(world: THREE.Vector3, yaw: number): void;
  /** Put it down on the floor at this LOCAL position. */
  drop(x: number, z: number, floorY: number): void;
  /** What is being carried, if anything. */
  carrying(): string | null;
  /**
   * MIRROR THE HUNT.  Called every frame with the pose the room's own model is
   * wearing, so the thing in the enclosure is the thing still looking for you
   * rather than a second one with its own ideas.
   */
  watch(w: Watched): void;
  /** What is in the enclosure and where it is, for a harness that cannot look down. */
  watching(): {
    x: number;
    z: number;
    yaw: number;
    scale: number;
    props: number;
    room: string;
    /** How far open each lid in the enclosure is, for a harness that cannot look down. */
    lids: number[];
  };
  /**
   * Whether the complex is being rendered and lit at all.
   *
   * IT IS OFF UNTIL THE PLAYER IS IN IT, and this is not an optimisation, it
   * is a correctness fix.  Three evaluates every visible light in the scene
   * for every fragment of every material, and `threeStage` clamps dt at 50ms
   * -- so ten extra lamps burning in a room nobody is in dropped the hide
   * rooms under twenty frames a second, and under twenty frames a second the
   * clamp makes in-game time run SLOWER THAN THE WALL CLOCK.  He stopped
   * getting across the furniture in the time he had.  Invisible lights are
   * skipped by the renderer, and an invisible group is not traversed.
   */
  setActive(on: boolean): void;
  dispose(): void;
}

/**
 * Floor height.
 *
 * There is no physics here and there does not need to be one: the complex has
 * exactly three surfaces and which one you are standing on is a function of
 * where you are.  The ramp is continuous with both ends, so the camera rises
 * smoothly while the steps under it look like steps.
 */
function floorAt(x: number, z: number): number {
  if (z >= DIVIDE_Z) return MEZZ_Y;
  if (x >= STAIR_X0 && z >= STAIR_Z0) {
    const t = Math.min(1, Math.max(0, (z - STAIR_Z0) / (DIVIDE_Z - STAIR_Z0)));
    return t * MEZZ_Y;
  }
  return 0;
}

/**
 * @param watched The room the player just stepped out of -- the one that is
 *   rebuilt under the glass.  Room one, two or three, whichever this is.
 */
export function buildSecretRoom(scene: THREE.Scene, watched: RoomDef): SecretRoom {
  const root = new THREE.Group();
  root.position.copy(SECRET_ORIGIN);
  scene.add(root);

  /** Every lamp in here, so they can all be put out while nobody is home. */
  const lights: THREE.Light[] = [];
  const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c });
  const lit = (c: number) => new THREE.MeshBasicMaterial({ color: c });
  const blockers: Box[] = [];

  /** A box, positioned by its footprint centre with its base on `y`. */
  const box = (
    mat: THREE.Material,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    solid = false,
    color = 0,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    root.add(m);
    if (solid) blockers.push({ x, z, w, d, h, color });
    return m;
  };

  // ---------------------------------------------------------------- the shell
  // A laboratory nobody was meant to find: pale blue tile underfoot, pale
  // blue-white walls, and a ceiling of flat, even, cold light.  Clean the way
  // somewhere is clean when it has to be hosed down.
  const floorMat = lam(0x9ec6d6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAX_X - MIN_X, MAX_Z - MIN_Z), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((MIN_X + MAX_X) / 2, 0.01, (MIN_Z + MAX_Z) / 2);
  root.add(floor);
  // the tile grid: thin grout lines a metre apart over the lab half
  const grout = lam(0x7fa7b8);
  for (let x = MIN_X + 1; x < MAX_X; x += 1) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(0.04, DIVIDE_Z - MIN_Z), grout);
    g.rotation.x = -Math.PI / 2;
    g.position.set(x, 0.015, (MIN_Z + DIVIDE_Z) / 2);
    root.add(g);
  }
  for (let z = MIN_Z + 1; z < DIVIDE_Z; z += 1) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(MAX_X - MIN_X, 0.04), grout);
    g.rotation.x = -Math.PI / 2;
    g.position.set(0, 0.015, z);
    root.add(g);
  }

  const wallMat = lam(0xc9e4ee);
  const H = 7.5;
  box(wallMat, MAX_X - MIN_X + 1, H, 0.5, 0, 0, MIN_Z - 0.25);
  box(wallMat, MAX_X - MIN_X + 1, H, 0.5, 0, 0, MAX_Z + 0.25);
  box(wallMat, 0.5, H, MAX_Z - MIN_Z + 1, MIN_X - 0.25, 0, (MIN_Z + MAX_Z) / 2);
  box(wallMat, 0.5, H, MAX_Z - MIN_Z + 1, MAX_X + 0.25, 0, (MIN_Z + MAX_Z) / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(MAX_X - MIN_X, MAX_Z - MIN_Z), lam(0xeaf6fb));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, H, (MIN_Z + MAX_Z) / 2);
  root.add(ceil);
  // a wipe-clean band round the walls at waist height, and a coved skirting
  box(lam(0x86b3c6), MAX_X - MIN_X, 0.9, 0.08, 0, 0, MIN_Z + 0.06);
  box(lam(0x5f8ea3), MAX_X - MIN_X, 0.1, 0.1, 0, 0.9, MIN_Z + 0.08);
  box(lam(0x86b3c6), 0.08, 0.9, DIVIDE_Z - MIN_Z, MIN_X + 0.06, 0, (MIN_Z + DIVIDE_Z) / 2);
  box(lam(0x5f8ea3), 0.1, 0.1, DIVIDE_Z - MIN_Z, MIN_X + 0.08, 0.9, (MIN_Z + DIVIDE_Z) / 2);

  // ------------------------------------------------------------ cold lighting
  // Even and pale, from long panels in the ceiling.  The hide rooms run one
  // dim ambient and a torch; this is the opposite -- you can see everything in
  // here, which is the problem with it.
  const amb = new THREE.AmbientLight(0xd6efff, 1.05);
  root.add(amb);
  lights.push(amb);
  for (const [x, z] of [
    [-4, -15],
    [4, -15],
    [-4, -7],
    [3, -8],
    [0, -11.5],
  ] as const) {
    const l = new THREE.PointLight(0xcfeeff, 12, 18, 1.3);
    l.position.set(x, 6.4, z);
    root.add(l);
    lights.push(l);
    // the panel the light comes out of
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.7), lit(0xf2fbff));
    panel.position.set(x, H - 0.05, z);
    root.add(panel);
  }

  // ----------------------------------------------------- THE CONTAINMENT TUBE
  // The first thing in frame when you come through the wall: a column of
  // pale blue liquid, floor to ceiling, lit from inside, with HIM in it.  Not
  // the one hunting you -- that one is under the glass upstairs.  This one is
  // another of him, suspended, still, and watching you walk round it.
  const tube = { x: -3.2, z: -9.2 };
  const TUBE_R = 1.35;
  const TUBE_H = 5.2;
  const steel = lam(0x3b4b58);
  const steelLight = lam(0x6a7f8e);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(TUBE_R + 0.35, TUBE_R + 0.5, 0.6, 24), steel);
  plinth.position.set(tube.x, 0.3, tube.z);
  root.add(plinth);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(TUBE_R + 0.18, TUBE_R + 0.18, 0.18, 24), steelLight);
  collar.position.set(tube.x, 0.69, tube.z);
  root.add(collar);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(TUBE_R + 0.5, TUBE_R + 0.35, 0.7, 24), steel);
  cap.position.set(tube.x, 0.6 + TUBE_H + 0.35, tube.z);
  root.add(cap);
  // pipes from the cap into the ceiling
  for (const a of [0.3, 2.4, 4.4]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, H - TUBE_H - 1.2, 8), steelLight);
    pipe.position.set(tube.x + Math.cos(a) * 0.9, 0.6 + TUBE_H + 0.7 + (H - TUBE_H - 1.3) / 2, tube.z + Math.sin(a) * 0.9);
    root.add(pipe);
  }
  // the liquid, and the glass round it
  const liquidMat = new THREE.MeshLambertMaterial({ color: 0x74d8f2, transparent: true, opacity: 0.32, depthWrite: false });
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(TUBE_R - 0.05, TUBE_R - 0.05, TUBE_H - 0.2, 28, 1, true), liquidMat);
  liquid.position.set(tube.x, 0.6 + TUBE_H / 2, tube.z);
  root.add(liquid);
  const glassMat = new THREE.MeshBasicMaterial({
    color: 0xd8f6ff,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const tubeGlass = new THREE.Mesh(new THREE.CylinderGeometry(TUBE_R, TUBE_R, TUBE_H, 28, 1, true), glassMat);
  tubeGlass.position.set(tube.x, 0.6 + TUBE_H / 2, tube.z);
  root.add(tubeGlass);
  // two thin steel ribs up the glass, so it reads as a tube and not a hologram
  for (const a of [Math.PI * 0.25, Math.PI * 1.25]) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, TUBE_H, 0.08), steelLight);
    rib.position.set(tube.x + Math.cos(a) * TUBE_R, 0.6 + TUBE_H / 2, tube.z + Math.sin(a) * TUBE_R);
    root.add(rib);
  }
  blockers.push({ x: tube.x, z: tube.z, w: (TUBE_R + 0.5) * 2, d: (TUBE_R + 0.5) * 2, h: TUBE_H + 1.2, color: 0x3b4b58 });
  // the glow of it on everything near it
  const tubeLight = new THREE.PointLight(0x7fe3ff, 14, 9, 1.4);
  tubeLight.position.set(tube.x, 3.0, tube.z);
  root.add(tubeLight);
  lights.push(tubeLight);
  // bubbles, rising the whole time
  const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.6 });
  const bubbles: Array<{ m: THREE.Mesh; a: number; r: number; speed: number }> = [];
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random() * 0.05, 6, 4), bubbleMat);
    const b = { m, a: Math.random() * Math.PI * 2, r: Math.random() * (TUBE_R - 0.25), speed: 0.4 + Math.random() * 0.7 };
    m.position.set(tube.x + Math.cos(b.a) * b.r, 0.7 + Math.random() * (TUBE_H - 0.4), tube.z + Math.sin(b.a) * b.r);
    root.add(m);
    bubbles.push(b);
  }
  // HIM.  Smaller than the one in the rooms, so he floats with room above
  // and below, turned to face whoever comes through the wall.
  const specimen = new FroggyMonster(1.05);
  specimen.setPose(tube.x, 0.9, tube.z, 0);
  root.add(specimen.root);
  /** How much he is fighting the tube: 0 floating, 1 thrashing. */
  let agony = 0;

  // ------------------------------------------------------------ THE HEATER
  // A little industrial heater on a trolley, wheeled up to the tube with its
  // coils facing the glass.  It is the one thing in here that does anything
  // to him, and he does not like it.
  const heater = { x: tube.x + 2.5, z: tube.z + 0.6 };
  box(steel, 0.9, 0.12, 0.7, heater.x, 0.18, heater.z);
  for (const [dx, dz] of [
    [-0.35, -0.25],
    [0.35, -0.25],
    [-0.35, 0.25],
    [0.35, 0.25],
  ] as const) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 8), lam(0x1d2328));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(heater.x + dx, 0.09, heater.z + dz);
    root.add(wheel);
  }
  box(lam(0x8a929a), 0.8, 1.0, 0.55, heater.x, 0.3, heater.z, true, 0x8a929a);
  // the grille faces the tube
  const coilMat = lit(0x3a1410);
  for (let i = 0; i < 4; i++) {
    const coil = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.5), coilMat);
    coil.position.set(heater.x - 0.41, 0.5 + i * 0.18, heater.z);
    root.add(coil);
  }
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 10), lit(0xffd45e));
  dial.rotation.x = Math.PI / 2;
  dial.position.set(heater.x + 0.2, 1.1, heater.z + 0.29);
  root.add(dial);
  const heatLight = new THREE.PointLight(0xff6a2a, 0, 4, 1.6);
  heatLight.position.set(heater.x - 0.7, 0.9, heater.z);
  root.add(heatLight);
  lights.push(heatLight);
  let heaterOn = false;
  let heaterT = 0;
  /** Which pickable is in the player's hands, if any. */
  let carried: string | null = null;

  // ---------------------------------------------- the bench and what is on it
  // Down the left wall: a long steel bench with monitors, glassware, a
  // centrifuge, and jars with small green things in them.
  const benchX = MIN_X + 1.0;
  box(lam(0xd7e7ee), 1.4, 0.1, 7.0, benchX, 1.0, -14.0, true, 0xd7e7ee);
  box(steel, 1.3, 1.0, 0.1, benchX, 0, -17.45);
  box(steel, 1.3, 1.0, 0.1, benchX, 0, -10.55);
  box(lam(0x9fb3be), 1.2, 0.9, 6.6, benchX, 0, -14.0);
  // monitors, each showing a trace
  const screens: THREE.MeshBasicMaterial[] = [];
  for (const z of [-16.4, -14.6]) {
    box(lam(0x22282e), 0.14, 0.9, 1.2, benchX - 0.3, 1.1, z);
    const sm = new THREE.MeshBasicMaterial({ color: 0x0f3a3a });
    screens.push(sm);
    const scr = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.72, 1.02), sm);
    scr.position.set(benchX - 0.22, 1.1 + 0.45, z);
    root.add(scr);
  }
  const trace = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.9), lit(0x5dffb0));
  trace.position.set(benchX - 0.2, 1.55, -16.4);
  root.add(trace);
  // a centrifuge
  const fuge = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.4, 16), lam(0xe8eef2));
  fuge.position.set(benchX, 1.3, -12.9);
  root.add(fuge);
  const fugeLid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), lit(0x7fe3ff));
  fugeLid.position.set(benchX, 1.53, -12.9);
  root.add(fugeLid);
  // specimen jars: a murky liquid and something small and green in each
  for (let i = 0; i < 4; i++) {
    const z = -11.5 - i * 0.0 + (i - 1.5) * 0.3;
    const jar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.42, 12),
      new THREE.MeshLambertMaterial({ color: 0xb8e2a0, transparent: true, opacity: 0.55 }),
    );
    jar.position.set(benchX + 0.35, 1.31, z);
    root.add(jar);
    const thing = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lam(0x4f8e44));
    thing.scale.set(1, 0.7, 1.2);
    thing.position.set(benchX + 0.35, 1.26, z);
    root.add(thing);
    // two white dots on it, which are eyes
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), lit(0xf4f0e0));
      eye.position.set(benchX + 0.43, 1.3, z + s * 0.04);
      root.add(eye);
    }
  }

  // ------------------------------------------ the gurney, and the drip stand
  // In the middle of the floor: a steel gurney with the straps undone and a
  // dent in the pad the shape of something long.
  const gurney = { x: 1.2, z: -15.2 };
  box(lam(0xd6dde2), 2.6, 0.12, 1.0, gurney.x, 0.9, gurney.z, true, 0xd6dde2);
  box(lam(0x9fc6d6), 2.4, 0.1, 0.85, gurney.x, 1.02, gurney.z);
  for (const [dx, dz] of [
    [-1.15, -0.4],
    [1.15, -0.4],
    [-1.15, 0.4],
    [1.15, 0.4],
  ] as const) {
    box(steel, 0.06, 0.9, 0.06, gurney.x + dx, 0, gurney.z + dz);
  }
  for (const dx of [-0.8, 0, 0.8]) {
    // straps, hanging open over the edge
    box(lam(0x3b2f2a), 0.12, 0.02, 1.2, gurney.x + dx, 1.12, gurney.z + 0.1);
    box(lam(0x3b2f2a), 0.12, 0.45, 0.02, gurney.x + dx, 0.68, gurney.z + 0.71);
  }
  // the drip stand, with a bag of something green
  box(steel, 0.05, 2.1, 0.05, gurney.x + 1.7, 0, gurney.z - 0.2);
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 0.08), new THREE.MeshLambertMaterial({ color: 0x8fe08a, transparent: true, opacity: 0.8 }));
  bag.position.set(gurney.x + 1.7, 1.85, gurney.z - 0.2);
  root.add(bag);

  // ------------------------------------------------ a rack of blinking things
  // Against the back wall, humming.
  box(lam(0x2a3038), 2.4, 3.2, 0.9, -5.6, 0, MIN_Z + 0.55, true, 0x2a3038);
  const blinkers: THREE.MeshBasicMaterial[] = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 5; c++) {
      const bm = new THREE.MeshBasicMaterial({ color: 0x3fe39b });
      blinkers.push(bm);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), bm);
      led.position.set(-6.5 + c * 0.42, 0.6 + r * 0.45, MIN_Z + 1.01);
      root.add(led);
    }
  }
  // and a cage in the corner, open, empty, and too big for anything that
  // should be kept in a cage
  const cageMat = lam(0x55636e);
  const cage = { x: 6.6, z: -17.4 };
  for (let i = 0; i <= 6; i++) {
    box(cageMat, 0.05, 2.0, 0.05, cage.x - 1.1 + i * 0.37, 0, cage.z + 0.8);
    box(cageMat, 0.05, 2.0, 0.05, cage.x - 1.1 + i * 0.37, 0, cage.z - 0.6);
  }
  box(cageMat, 2.3, 0.06, 1.5, cage.x, 2.0, cage.z + 0.1, true, 0x55636e);

  // ----------------------------------------- THINGS THAT CAN BE PICKED UP
  // A few, not everything: things a hand would pick up in a lab.  E takes
  // one, Q puts it down again at your feet.  Each remembers where it started.
  interface Pickable {
    id: string;
    name: string;
    mesh: THREE.Object3D;
    /** Where it sits on its own, in local coordinates: the floor under it is `y`. */
    x: number;
    y: number;
    z: number;
  }
  const pickables: Pickable[] = [];
  const addPick = (id: string, name: string, mesh: THREE.Object3D, x: number, y: number, z: number): void => {
    mesh.position.set(x, y, z);
    root.add(mesh);
    pickables.push({ id, name, mesh, x, y, z });
  };
  const flask = (liquidColor: number): THREE.Group => {
    const g = new THREE.Group();
    const glassBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.16, 0.3, 12),
      new THREE.MeshLambertMaterial({ color: 0xe6f7ff, transparent: true, opacity: 0.45 }),
    );
    glassBody.position.y = 0.15;
    g.add(glassBody);
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.14, 12), lam(liquidColor));
    fill.position.y = 0.08;
    g.add(fill);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 8), glassBody.material);
    neck.position.y = 0.36;
    g.add(neck);
    return g;
  };
  addPick('flask-green', 'FLASK', flask(0x6fdc5f), benchX + 0.3, 1.1, -15.4);
  addPick('flask-pink', 'FLASK', flask(0xff5fa8), benchX + 0.35, 1.1, -13.7);
  addPick('flask-blue', 'FLASK', flask(0x5fb8ff), gurney.x - 0.6, 1.07, gurney.z - 0.1);
  {
    const board = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.46), lam(0x8a5a33));
    board.add(back);
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.022, 0.4), lam(0xf4f1e6));
    paper.position.y = 0.005;
    board.add(paper);
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.05), steelLight);
    clip.position.set(0, 0.01, -0.21);
    board.add(clip);
    addPick('clipboard', 'CLIPBOARD', board, gurney.x + 0.5, 1.09, gurney.z + 0.1);
  }
  {
    const jar = new THREE.Group();
    const glassJar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.36, 12),
      new THREE.MeshLambertMaterial({ color: 0xb8e2a0, transparent: true, opacity: 0.55 }),
    );
    glassJar.position.y = 0.18;
    jar.add(glassJar);
    const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), lam(0xf4f0e0));
    eyeball.position.y = 0.16;
    jar.add(eyeball);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), lam(0x101010));
    pupil.position.set(0, 0.16, 0.07);
    jar.add(pupil);
    addPick('eye-jar', 'SPECIMEN JAR', jar, -1.4, 0.02, -16.9);
  }

  // ---------------------------------------------------------- THE WAY ONWARD
  // A pedestal with a lit button on it, in the middle of the floor where it
  // cannot be walked past.  Nothing in the hide rooms hints that this exists,
  // so once you are in here it is allowed to be as loud as it likes.
  const buttonAt = { x: 3.2, z: -12.6 };
  box(lam(0x3a4050), 1.1, 0.95, 1.1, buttonAt.x, 0, buttonAt.z, true, 0x3a4050);
  box(lam(0x22262f), 1.3, 0.12, 1.3, buttonAt.x, 0.95, buttonAt.z);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 14), lit(0x3fe39b));
  knob.position.set(buttonAt.x, 1.14, buttonAt.z);
  root.add(knob);
  const knobLight = new THREE.PointLight(0x3fe39b, 7, 5, 1.6);
  knobLight.position.set(buttonAt.x, 1.5, buttonAt.z);
  root.add(knobLight);
  lights.push(knobLight);

  // ------------------------------------------------------------ the staircase
  // Half the length it was.  The old run went the whole depth of the room,
  // back wall to divider, and every trip to the gallery was a hike; this one
  // starts level with the pedestal and climbs the same storey in twelve steep
  // steps, lit along each nose, with a steel handrail up its open side.
  const STEPS = 12;
  const run = (DIVIDE_Z - STAIR_Z0) / STEPS;
  const stairW = MAX_X - STAIR_X0;
  for (let i = 0; i < STEPS; i++) {
    const y = ((i + 1) / STEPS) * MEZZ_Y;
    // each step a solid block down to the floor, so the flight has a side
    box(lam(i % 2 ? 0x7fa7b8 : 0x8fb6c6), stairW - 0.3, y, run + 0.02, (STAIR_X0 + MAX_X) / 2, 0, STAIR_Z0 + i * run + run / 2);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(stairW - 0.5, 0.04, 0.06), lit(0x9ff0ff));
    nose.position.set((STAIR_X0 + MAX_X) / 2, y + 0.02, STAIR_Z0 + i * run + 0.04);
    root.add(nose);
  }
  // the handrail, on posts, up the open side
  const railLen = Math.hypot(DIVIDE_Z - STAIR_Z0, MEZZ_Y);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, railLen), steelLight);
  rail.position.set(STAIR_X0 + 0.05, MEZZ_Y / 2 + 1.0, (STAIR_Z0 + DIVIDE_Z) / 2);
  rail.rotation.x = -Math.atan2(MEZZ_Y, DIVIDE_Z - STAIR_Z0);
  root.add(rail);
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    box(steelLight, 0.06, 1.0, 0.06, STAIR_X0 + 0.05, t * MEZZ_Y, STAIR_Z0 + t * (DIVIDE_Z - STAIR_Z0));
  }
  // the side of the flight is solid, so the only way on is the bottom step
  blockers.push({
    x: STAIR_X0 - 0.1,
    z: (STAIR_Z0 + DIVIDE_Z) / 2 + 0.6,
    w: 0.3,
    d: DIVIDE_Z - STAIR_Z0 - 1.2,
    h: MEZZ_Y,
    color: 0x7fa7b8,
  });
  // and the divider between the lab and the drop, everywhere except the run
  box(lam(0xc9e4ee), STAIR_X0 - MIN_X, 5.2, 0.5, (MIN_X + STAIR_X0) / 2, 0, DIVIDE_Z, true, 0xc9e4ee);

  // ------------------------------------------- THE ENCLOSURE, AND THE GLASS
  //
  // Below the mezzanine is THE ROOM YOU JUST LEFT, laid out from the same
  // RoomDef the hunt is running in: the same floor, the same walls, the same
  // furniture in the same places and the same boxes you were hiding in ten
  // seconds ago.  It is built to a third of size so the whole of it fits under
  // the pane, which is exactly what an enclosure is -- a whole habitat, seen
  // at once, from above, by somebody who is not in it.
  //
  // THE THING IN IT IS NOT A SECOND FROGGY.  Nothing down there decides
  // anything: `watch` is handed the pose the room's own model is wearing this
  // frame and the twin copies it.  What the player is looking down at is the
  // real hunt, still going, in the real room, for them.
  const pitMinZ = DIVIDE_Z;
  const pitCZ = (pitMinZ + MAX_Z) / 2;
  const pitW = MAX_X - MIN_X - 1.4;
  const pitD = MAX_Z - pitMinZ - 1.4;
  /** One metre of that room, in here.  The smaller axis wins so nothing is cropped. */
  const k = Math.min(pitW / (watched.halfW * 2), pitD / (watched.halfD * 2));

  const pen = new THREE.Group();
  pen.position.set(0, 0.02, pitCZ);
  pen.scale.setScalar(k);
  root.add(pen);
  /** A box in ROOM coordinates, dropped into the enclosure at enclosure scale. */
  const penBox = (color: number, w: number, h: number, d: number, x: number, z: number, y = 0): void => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color));
    m.position.set(x, y + h / 2, z);
    pen.add(m);
  };

  const penFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(watched.halfW * 2, watched.halfD * 2),
    lam(watched.floor),
  );
  penFloor.rotation.x = -Math.PI / 2;
  pen.add(penFloor);
  // The shell.  Low enough to see over from up here -- the point of the pane
  // is that the room has no lid on it any more and he has not noticed.
  const penH = watched.wallH;
  penBox(watched.wall, watched.halfW * 2 + 0.6, penH, 0.6, 0, -watched.halfD - 0.3);
  penBox(watched.wall, watched.halfW * 2 + 0.6, penH, 0.6, 0, watched.halfD + 0.3);
  penBox(watched.wall, 0.6, penH, watched.halfD * 2 + 0.6, -watched.halfW - 0.3, 0);
  penBox(watched.wall, 0.6, penH, watched.halfD * 2 + 0.6, watched.halfW + 0.3, 0);
  // Everything that is in that room, where it is in that room.
  for (const f of watched.furniture) penBox(f.color, f.w, f.h, f.d, f.x, f.z);
  // and the boxes he opens, marked out from the furniture so it is obvious
  // which ones he is working and which ones he has not got to yet.
  /** The lids, kept, because they open when the real ones do.  See `Watched`. */
  const penLids: Array<{ mesh: THREE.Mesh; base: number; open: number }> = [];
  for (const spot of watched.spots) {
    const h = spot.kind === 'bed' ? 0.7 : 1.4;
    penBox(0x6b7789, 1.5, h, 1.5, spot.x, spot.z);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1.6), lam(0x93a3b8));
    lid.position.set(spot.x, h + 0.06, spot.z);
    pen.add(lid);
    penLids.push({ mesh: lid, base: h + 0.06, open: 0 });
  }
  // the door he locked behind you, shut, in the wall it is in
  penBox(0x2b2119, 2.2, 3.0, 0.5, watched.door.x, watched.halfD - 0.1);

  // ITS OWN LIGHT, taken off the room's own bulbs so the enclosure is lit the
  // colour the room is lit -- two of them, not nine, because ten more lamps in
  // here is what put the hide rooms under twenty frames a second.
  for (const l of watched.lights.slice(0, 3)) {
    // Hung off the underside of the pane rather than at the room's own ceiling
    // height, and carrying a long way: at the bulbs' own reach the enclosure
    // was a dark tray with something moving in it, and the whole point of the
    // gallery is that you can SEE him work.
    const pl = new THREE.PointLight(l.color, 34, 26, 1.1);
    pl.position.set(l.x * k, 3.6, pitCZ + l.z * k);
    root.add(pl);
    lights.push(pl);
  }

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(MAX_X - MIN_X, MAX_Z - pitMinZ),
    new THREE.MeshBasicMaterial({
      color: 0xbfe4ff,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  glass.rotation.x = -Math.PI / 2;
  glass.position.set(0, MEZZ_Y, pitCZ);
  root.add(glass);
  // a frame round it, so it reads as a pane and not as a missing floor
  for (const [x, z, w, d] of [
    [0, pitMinZ + 0.15, MAX_X - MIN_X, 0.3],
    [0, MAX_Z - 0.15, MAX_X - MIN_X, 0.3],
    [MIN_X + 0.15, pitCZ, 0.3, MAX_Z - pitMinZ],
    [MAX_X - 0.15, pitCZ, 0.3, MAX_Z - pitMinZ],
  ] as const) {
    box(lam(0x4a5260), w, 0.12, d, x, MEZZ_Y - 0.12, z);
  }
  // and a railing, so standing on a sheet of glass over that is survivable
  for (const [x, z, w, d] of [
    [0, MAX_Z - 0.3, MAX_X - MIN_X, 0.2],
    [MIN_X + 0.3, pitCZ, 0.2, MAX_Z - pitMinZ],
    [MAX_X - 0.3, pitCZ, 0.2, MAX_Z - pitMinZ],
  ] as const) {
    box(lam(0x5a6270), w, 1.05, d, x, MEZZ_Y, z, true, 0x5a6270);
  }

  // HIM, in the enclosure, at the enclosure's scale because he is in the group
  // with the room he is searching.  Posed by `watch` and by nothing else.
  const monster = new FroggyMonster(FROGGY_SCALE);
  pen.add(monster.root);
  // Dark and unlit until somebody walks through the wall.  See setActive.
  root.visible = false;
  for (const l of lights) l.visible = false;
  let clock = 0;
  /** The last thing the room said he was doing.  Standing still, until it does. */
  let seen: Watched = {
    x: watched.froggyStart.x,
    y: 0,
    z: watched.froggyStart.z,
    yaw: 0,
    pose: { speed: 0, maw: 0.12, climb: 0, scan: 0 },
  };

  const tick = (dt: number): void => {
    clock += dt;
    knobLight.intensity = 6 + Math.sin(clock * 2.4) * 1.6;
    // The lab ticking over: the traces on the monitors, the LEDs on the rack,
    // the centrifuge lid glowing, the tube's own light breathing.
    for (let i = 0; i < screens.length; i++) {
      const k = 0.5 + 0.5 * Math.sin(clock * (1.3 + i) + i);
      screens[i].color.setRGB(0.04, 0.18 + k * 0.1, 0.2 + k * 0.08);
    }
    trace.position.y = 1.55 + Math.sin(clock * 9) * 0.06 * (1 + agony * 3);
    for (let i = 0; i < blinkers.length; i++) {
      const on = Math.sin(clock * (2 + (i % 7)) + i * 1.7) > 0.3;
      blinkers[i].color.setHex(on ? (i % 5 === 0 ? 0xffd45e : 0x3fe39b) : 0x12301f);
    }

    // ---- THE HEATER, AND HIM.
    //
    // Switched on, the coils come up to orange over a second and a half, and
    // a moment after the glass warms he starts: the calm float goes, the jaw
    // drops, the arms go for the glass, the whole of him twisting in the
    // liquid.  Off, he settles back -- slowly -- and stares at whoever did it.
    heaterT = Math.max(0, Math.min(1.5, heaterT + (heaterOn ? dt : -dt * 0.8)));
    const glow = heaterT / 1.5;
    coilMat.color.setRGB(0.23 + glow * 0.77, 0.08 + glow * 0.34, 0.06 + glow * 0.04);
    heatLight.intensity = glow * 9;
    const want = heaterOn && heaterT > 0.6 ? 1 : 0;
    agony += (want - agony) * Math.min(1, dt * (want ? 3 : 0.8));
    tubeLight.intensity = 12 + Math.sin(clock * 0.9) * 2 + agony * 6 * Math.abs(Math.sin(clock * 11));
    for (const b of bubbles) {
      b.m.position.y += b.speed * (1 + agony * 3) * dt;
      if (b.m.position.y > 0.6 + TUBE_H - 0.2) b.m.position.y = 0.7;
      b.a += dt * 0.3;
      b.m.position.x = tube.x + Math.cos(b.a) * b.r;
      b.m.position.z = tube.z + Math.sin(b.a) * b.r;
    }
    // He floats: a slow bob and turn, always coming back round to face the
    // wall you came in through.  In agony he jerks and twists.
    const bob = Math.sin(clock * 0.7) * 0.12 + agony * Math.sin(clock * 17) * 0.08;
    const turn = Math.sin(clock * 0.23) * 0.35 + agony * Math.sin(clock * 9) * 0.5;
    specimen.setPose(tube.x + agony * Math.sin(clock * 13) * 0.12, 0.9 + bob, tube.z, turn);
    specimen.update(dt, {
      speed: 0,
      maw: 0.08 + agony * 0.92,
      mawRate: 6,
      climb: 0,
      scan: 0,
      lunge: agony,
      grab: agony,
      reachAt: null,
      viewer: null,
    });

    // Him, doing downstairs exactly what he is doing in the room: the pose is
    // the room's, not ours.  He never once looks up -- there is nothing in the
    // hunt that knows there is an up.
    monster.setPose(seen.x, seen.y, seen.z, seen.yaw);
    // (all of it but where you are: he reaches for you up there, not down here)
    // (the floor and the solids are in room space, which is this enclosure's
    // own; where he turns his face is a point in the world, so it comes down
    // the hole with him)
    const faceTo = seen.pose.faceTo && monster.root.parent ? monster.root.parent.localToWorld(seen.pose.faceTo.clone()) : null;
    monster.update(dt, { ...seen.pose, reachAt: null, viewer: null, faceTo });

    // ---- AND THE LIDS COME UP WHEN THE REAL ONES DO.
    //
    // The box he is working down there is the box he is working up here,
    // because the number comes out of the room's own `spots` every frame.
    // Eased rather than snapped, so a lid takes a moment to swing -- which is
    // what makes it read as him opening it rather than as a light going on.
    for (let i = 0; i < penLids.length; i++) {
      const want = Math.min(1, Math.max(0, seen.lids?.[i] ?? 0));
      const lid = penLids[i];
      lid.open += (want - lid.open) * Math.min(1, dt * 6);
      lid.mesh.position.y = lid.base + lid.open * 0.55;
      lid.mesh.rotation.z = lid.open * 0.5;
    }
  };

  return {
    root,
    blockers,
    spawn: { x: -4.2, z: -17.6, yaw: Math.PI },
    button: buttonAt,
    floorAt,
    clamp: (v: THREE.Vector2) => {
      v.x = Math.min(MAX_X - 0.6, Math.max(MIN_X + 0.6, v.x));
      v.y = Math.min(MAX_Z - 0.6, Math.max(MIN_Z + 0.6, v.y));
    },
    tick,
    heater,
    toggleHeater: () => {
      heaterOn = !heaterOn;
      return heaterOn;
    },
    nearestPickable: (x: number, z: number, floorY: number) => {
      let best: Pickable | null = null;
      let bestD = 1.7;
      for (const p of pickables) {
        if (p.id === carried) continue;
        if (Math.abs(floorAt(p.x, p.z) - floorY) > 0.8) continue;
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      return best ? { id: best.id, name: best.name } : null;
    },
    pickUp: (id: string) => {
      carried = pickables.some((p) => p.id === id) ? id : null;
    },
    carry: (world: THREE.Vector3, yaw: number) => {
      const p = pickables.find((q) => q.id === carried);
      if (!p) return;
      p.mesh.position.copy(world).sub(root.position);
      p.mesh.rotation.set(0, yaw, 0);
    },
    drop: (x: number, z: number, floorY: number) => {
      const p = pickables.find((q) => q.id === carried);
      carried = null;
      if (!p) return;
      p.x = x;
      p.z = z;
      p.y = floorY + 0.02;
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.set(0, Math.random() * Math.PI * 2, 0);
    },
    carrying: () => carried,
    watch: (w: Watched) => {
      seen = w;
    },
    watching: () => ({
      x: monster.root.position.x,
      z: monster.root.position.z,
      yaw: monster.root.rotation.y,
      scale: k,
      // Everything rebuilt from the room definition, the shell included.
      props: pen.children.length - 2,
      room: watched.name,
      lids: penLids.map((l) => +l.open.toFixed(3)),
    }),
    setActive: (on: boolean) => {
      root.visible = on;
      for (const l of lights) l.visible = on;
    },
    dispose: () => {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          const mat = m.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat.dispose();
        }
      });
      root.removeFromParent();
    },
  };
}
