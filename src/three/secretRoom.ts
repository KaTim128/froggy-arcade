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
 * WHAT IS BEHIND IT IS THE OPPOSITE OF EVERYTHING ELSE.  Warm, bright,
 * coloured, full of furniture somebody actually lives with — a couch, a
 * television that is already on, mugs and a plate and a bowl of something,
 * rugs, shelves, lamps, bunting.  The hide rooms do not get dressed down to
 * meet it halfway; the contrast IS the effect, and the moment the wall closes
 * behind you the fog goes warm and the count stops mattering.
 *
 * AND IT IS GENUINELY SAFE.  Not a better hiding place — safe.  He cannot come
 * through the wall, he cannot hear you, he cannot see you, his pathfinder does
 * not know the wall is anything but a wall, and a chase that was in progress
 * when you stepped through simply ends.  The scene refuses to catch you in
 * here at all.
 *
 * UPSTAIRS IS WHY IT IS STILL A HORROR ROOM.  A staircase out of the lounge
 * leads onto a mezzanine whose floor is glass, and under the glass is a
 * chamber with him in it, pacing, looking for something.  He cannot see up
 * through it.  You are three metres above the thing that has been hunting you
 * all night, in a warm room, eating its food, watching it work.
 *
 * Geometry is local to this module and lives at SECRET_ORIGIN, a long way from
 * any hide room, so nothing in the hunt can reach it by accident.
 */

import * as THREE from 'three';
import type { Box } from './hideRooms';
import { FroggyMonster } from './froggyMonster';

/**
 * Where the complex is built, in world space.  Far enough from every room that
 * no stray coordinate, pathfinding probe or earshot test can reach it.
 */
export const SECRET_ORIGIN = new THREE.Vector3(0, 0, -600);

/** The mezzanine's height: a full storey up, and the ceiling of the chamber. */
const MEZZ_Y = 4.6;
/** The lounge runs from the back wall to the divider; the chamber from it. */
const DIVIDE_Z = -2.5;
const MIN_X = -9;
const MAX_X = 9;
const MIN_Z = -19;
const MAX_Z = 13;
/** The staircase run, hard against the right-hand wall of the lounge. */
const STAIR_X0 = 5.0;
const STAIR_Z0 = -18.2;

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
  /** Drives the television and the thing under the glass. */
  tick(dt: number): void;
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

export function buildSecretRoom(scene: THREE.Scene): SecretRoom {
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
  const floorMat = lam(0x6b4a33);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(MAX_X - MIN_X, MAX_Z - MIN_Z), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((MIN_X + MAX_X) / 2, 0.01, (MIN_Z + MAX_Z) / 2);
  root.add(floor);

  const wallMat = lam(0xc2895c);
  const H = 7.5;
  box(wallMat, MAX_X - MIN_X + 1, H, 0.5, 0, 0, MIN_Z - 0.25);
  box(wallMat, MAX_X - MIN_X + 1, H, 0.5, 0, 0, MAX_Z + 0.25);
  box(wallMat, 0.5, H, MAX_Z - MIN_Z + 1, MIN_X - 0.25, 0, (MIN_Z + MAX_Z) / 2);
  box(wallMat, 0.5, H, MAX_Z - MIN_Z + 1, MAX_X + 0.25, 0, (MIN_Z + MAX_Z) / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(MAX_X - MIN_X, MAX_Z - MIN_Z), lam(0xe8d3b0));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, H, (MIN_Z + MAX_Z) / 2);
  root.add(ceil);

  // A dado rail and skirting, because a room with one flat wall colour in it
  // is a box, and the whole argument this room is making is "somebody lives
  // here".
  box(lam(0x8c5a3a), MAX_X - MIN_X, 0.18, 0.1, 0, 1.15, MIN_Z + 0.2);
  box(lam(0xf0e0c4), MAX_X - MIN_X, 0.24, 0.1, 0, 0, MIN_Z + 0.2);

  // ------------------------------------------------------------ warm lighting
  // Bright, and warm, and a LOT of it.  The hide rooms run one dim ambient and
  // a torch; this wants to feel like walking into a lit living room from a
  // corridor, which means the lamps have to overwhelm what the player's eye has
  // spent the last few minutes adjusting to.
  const amb = new THREE.AmbientLight(0xffe2b8, 1.9);
  root.add(amb);
  lights.push(amb);
  for (const [x, y, z, c, i] of [
    [-4, 4.4, -15, 0xffd9a0, 26],
    [4, 4.4, -15, 0xffc98a, 22],
    [-5, 4.4, -8, 0xffd9a0, 26],
    [3, 4.4, -9, 0xffb877, 22],
    [0, 6.6, -12, 0xfff0d8, 18],
    [-2, 4.4, -4, 0xffd9a0, 20],
  ] as const) {
    const l = new THREE.PointLight(c, i, 20, 1.3);
    l.position.set(x, y, z);
    root.add(l);
    lights.push(l);
  }

  // ---------------------------------------------------------------- the couch
  // The main thing in the room, facing the television, deep enough to sit back
  // in.  Base, back, two arms and three cushions.
  //
  // EVERYTHING FACES DOWN THE ROOM.  You come in at the back wall and the
  // lounge runs away from you towards the stairs, so the couch has its back to
  // you and the television is beyond it, already lit -- the glow is the first
  // thing in frame, before a single object has been read.  Laid out the other
  // way round, the first thing you saw walking through the wall was the BACK
  // of a television, which is a cupboard.
  const couchMat = lam(0x3f7d6a);
  const cushion = lam(0x59a189);
  const cx = -3.0;
  const cz = -8.4;

  // ------------------------------------------------------------------ the rug
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), lam(0xb5384a));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(cx, 0.02, cz + 0.6);
  root.add(rug);
  const rugIn = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 4.4), lam(0xd9a23c));
  rugIn.rotation.x = -Math.PI / 2;
  rugIn.position.set(cx, 0.03, cz + 0.6);
  root.add(rugIn);

  box(couchMat, 6.0, 0.45, 2.4, cx, 0, cz, true, 0x3f7d6a);
  box(couchMat, 6.0, 1.15, 0.45, cx, 0.45, cz - 0.98);
  box(couchMat, 0.5, 0.95, 2.4, cx - 2.75, 0.45, cz);
  box(couchMat, 0.5, 0.95, 2.4, cx + 2.75, 0.45, cz);
  for (let i = -1; i <= 1; i++) box(cushion, 1.6, 0.3, 1.7, cx + i * 1.7, 0.45, cz + 0.2);
  // throw pillows, because nobody's couch is tidy
  box(lam(0xe8734a), 0.7, 0.7, 0.25, cx - 2.1, 0.75, cz + 0.6);
  box(lam(0xf0c05a), 0.7, 0.7, 0.25, cx + 2.0, 0.75, cz + 0.6);
  // and a blanket over one arm
  box(lam(0x7b5ea8), 0.9, 0.12, 1.9, cx + 2.75, 1.4, cz + 0.1);

  // ----------------------------------------------------------- the television
  // On the far wall from the couch, already playing.  It is the only light in
  // the complex that changes, and that is what makes the room read as OCCUPIED
  // rather than as a set.
  const tvZ = cz + 3.6;
  box(lam(0x2a2a30), 4.4, 0.6, 1.0, cx, 0, tvZ, true, 0x2a2a30);
  box(lam(0x1a1a1f), 4.0, 2.3, 0.3, cx, 0.6, tvZ);
  const screenMat = lit(0x6fbbd8);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.9, 0.06), screenMat);
  screen.position.set(cx, 0.6 + 1.2, tvZ - 0.2);
  root.add(screen);
  // the glow it throws back into the room
  const tvGlow = new THREE.PointLight(0x9fd4ff, 9, 9, 1.5);
  tvGlow.position.set(cx, 1.9, tvZ - 0.9);
  root.add(tvGlow);
  lights.push(tvGlow);

  // --------------------------------------------------- the table, and the food
  const tableTop = lam(0x8a5a33);
  const tz = cz + 1.9;
  box(tableTop, 2.8, 0.14, 1.6, cx, 0.66, tz, true, 0x8a5a33);
  for (const [dx, dz] of [
    [-1.2, -0.6],
    [1.2, -0.6],
    [-1.2, 0.6],
    [1.2, 0.6],
  ] as const) {
    box(lam(0x6b4423), 0.14, 0.66, 0.14, cx + dx, 0, tz + dz);
  }
  // mugs, a plate with something on it, a bowl, a bottle and two glasses
  const mug = (x: number, z: number, c: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.26, 10), lam(c));
    m.position.set(x, 0.93, z);
    root.add(m);
  };
  mug(cx - 0.9, tz + 0.3, 0xf2e9d0);
  mug(cx - 0.45, tz - 0.3, 0x46c4bd);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 14), lam(0xf2e9d0));
  plate.position.set(cx + 0.5, 0.83, tz + 0.1);
  root.add(plate);
  for (let i = 0; i < 4; i++) {
    const food = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.22), lam([0xd9822b, 0xc31f2e, 0x6fbb6a, 0xffd45e][i]));
    food.position.set(cx + 0.5 + Math.cos(i * 1.6) * 0.2, 0.9, tz + 0.1 + Math.sin(i * 1.6) * 0.2);
    root.add(food);
  }
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xff7a3d));
  bowl.rotation.x = Math.PI;
  bowl.position.set(cx + 1.2, 1.05, tz - 0.2);
  root.add(bowl);
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.5, 10), lam(0x2f7fb5));
  bottle.position.set(cx - 1.25, 1.05, tz - 0.2);
  root.add(bottle);

  // --------------------------------------------------------------- the shelves
  // Along the left wall: books, a plant, a lamp, and a row of things in
  // colours that have no business in this building.
  for (const y of [1.3, 2.3, 3.3]) {
    box(lam(0x8a5a33), 0.5, 0.12, 5.6, MIN_X + 0.6, y, -14.6);
    for (let i = 0; i < 11; i++) {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.5 + ((i * 7) % 3) * 0.12, 0.13),
        lam([0xc31f2e, 0xffd45e, 0x46c4bd, 0x7b4bd8, 0x6fbb6a, 0xff7a3d][(i + Math.round(y)) % 6]),
      );
      b.position.set(MIN_X + 0.6, y + 0.06 + 0.3, -17.0 + i * 0.47);
      root.add(b);
    }
  }
  const potPlant = (x: number, z: number) => {
    box(lam(0xb5563a), 0.6, 0.55, 0.6, x, 0, z, true, 0xb5563a);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), lam(0x4f9e4a));
      leaf.scale.set(1, 0.6, 1);
      leaf.position.set(x + Math.cos(i * 1.3) * 0.3, 0.75 + i * 0.16, z + Math.sin(i * 1.3) * 0.3);
      root.add(leaf);
    }
  };
  potPlant(MIN_X + 1.4, -3.4);
  potPlant(MAX_X - 1.4, -17.8);

  // a standing lamp with a shade that is actually emitting
  box(lam(0x4a4a52), 0.16, 1.9, 0.16, 2.4, 0, -16.2);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.7, 12, 1, true), lit(0xffe2a8));
  shade.position.set(2.4, 2.2, -16.2);
  root.add(shade);
  const lampLight = new THREE.PointLight(0xffd9a0, 14, 10, 1.4);
  lampLight.position.set(2.4, 2.1, -16.2);
  root.add(lampLight);
  lights.push(lampLight);

  // bunting across the lounge, because somebody decorated in here
  for (let i = 0; i < 14; i++) {
    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.04),
      lit([0xff4fa3, 0xffd45e, 0x46c4bd, 0x6fbb6a, 0xff7a3d][i % 5]),
    );
    flag.position.set(MIN_X + 0.8 + i * 1.28, 4.6 + Math.sin(i * 0.7) * 0.22, -17.4);
    flag.rotation.z = Math.PI / 4;
    root.add(flag);
  }

  // ---------------------------------------------------------- THE WAY ONWARD
  // A pedestal with a lit button on it, in the middle of the lounge floor where
  // it cannot be walked past.  Nothing in the hide rooms hints that this
  // exists, so once you are in here it is allowed to be as loud as it likes.
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
  // Hard against the right-hand wall, with a wall along its inside edge so the
  // only way onto it is from the bottom.  Fifteen steps, built as steps; the
  // camera rides the ramp under them (see floorAt).
  const STEPS = 15;
  const run = (DIVIDE_Z - STAIR_Z0) / STEPS;
  for (let i = 0; i < STEPS; i++) {
    const y = (i / STEPS) * MEZZ_Y;
    box(lam(i % 2 ? 0x8a5a33 : 0x9a6a40), 3.7, 0.32, run + 0.06, (STAIR_X0 + MAX_X) / 2 - 0.15, y, STAIR_Z0 + i * run + run / 2);
  }
  // the wall down the inside of the run
  box(lam(0xc2895c), 0.4, 5.2, 11.5, STAIR_X0 - 0.2, 0, -8.25, true, 0xc2895c);
  // and the divider between the lounge and the drop, everywhere except the run
  box(lam(0xc2895c), 14.0, 5.2, 0.5, -2.0, 0, DIVIDE_Z, true, 0xc2895c);

  // ------------------------------------------------- THE CHAMBER, AND THE GLASS
  // Below the mezzanine: a dim room with him in it.  The glass is its ceiling
  // and the mezzanine's floor, it is solid to walk on, and it is transparent
  // from above and mirrored from below -- which is the point, and which costs
  // nothing to fake, because he has no reflection to check.
  const chamberMinZ = DIVIDE_Z;
  const chamberFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(MAX_X - MIN_X, MAX_Z - chamberMinZ),
    lam(0x2a2f36),
  );
  chamberFloor.rotation.x = -Math.PI / 2;
  chamberFloor.position.set(0, 0.02, (chamberMinZ + MAX_Z) / 2);
  root.add(chamberFloor);
  for (const [x, z] of [
    [-5, 2],
    [5, 9],
  ] as const) {
    const l = new THREE.PointLight(0x7d93a8, 11, 16, 1.4);
    l.position.set(x, 3.2, z);
    root.add(l);
    lights.push(l);
  }
  // a few shapes down there, so it is a place rather than an empty tray
  for (const [x, z, w, d, h] of [
    [-7.2, 4.0, 1.6, 1.6, 1.4],
    [6.6, 1.2, 2.2, 1.0, 1.9],
    [0.5, 11.0, 3.0, 1.2, 1.6],
    [-3.0, 8.0, 1.0, 1.0, 0.8],
  ] as const) {
    box(lam(0x3a424e), w, h, d, x, 0, z);
  }

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(MAX_X - MIN_X, MAX_Z - chamberMinZ),
    new THREE.MeshBasicMaterial({
      color: 0xbfe4ff,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  glass.rotation.x = -Math.PI / 2;
  glass.position.set(0, MEZZ_Y, (chamberMinZ + MAX_Z) / 2);
  root.add(glass);
  // a frame round it, so it reads as a pane and not as a missing floor
  for (const [x, z, w, d] of [
    [0, chamberMinZ + 0.15, MAX_X - MIN_X, 0.3],
    [0, MAX_Z - 0.15, MAX_X - MIN_X, 0.3],
    [MIN_X + 0.15, (chamberMinZ + MAX_Z) / 2, 0.3, MAX_Z - chamberMinZ],
    [MAX_X - 0.15, (chamberMinZ + MAX_Z) / 2, 0.3, MAX_Z - chamberMinZ],
  ] as const) {
    box(lam(0x4a5260), w, 0.12, d, x, MEZZ_Y - 0.12, z);
  }
  // and a railing, so standing on a sheet of glass over that is survivable
  for (const [x, z, w, d] of [
    [0, MAX_Z - 0.3, MAX_X - MIN_X, 0.2],
    [MIN_X + 0.3, (chamberMinZ + MAX_Z) / 2, 0.2, MAX_Z - chamberMinZ],
    [MAX_X - 0.3, (chamberMinZ + MAX_Z) / 2, 0.2, MAX_Z - chamberMinZ],
  ] as const) {
    box(lam(0x5a6270), w, 1.05, d, x, MEZZ_Y, z, true, 0x5a6270);
  }

  // HIM, under the glass.  Off to one side of where the stairs put you, so the
  // first thing you see when you step onto the pane is not the top of his head
  // -- you have to walk out over him to find him, which is worse.
  const monster = new FroggyMonster(1.75);
  root.add(monster.root);
  // Dark and unlit until somebody walks through the wall.  See setActive.
  root.visible = false;
  for (const l of lights) l.visible = false;
  /** A slow beat down there: two long legs of a patrol, and a pause at each end. */
  const PATROL: Array<[number, number]> = [
    [-5.5, 2.4],
    [5.0, 9.6],
  ];
  let leg = 0;
  let at = new THREE.Vector2(PATROL[0][0], PATROL[0][1]);
  let goal = new THREE.Vector2(PATROL[1][0], PATROL[1][1]);
  let pause = 1.2;
  let yaw = 0;
  let clock = 0;

  const tick = (dt: number): void => {
    clock += dt;
    // The television: a cheap channel-change flicker, cycling slowly.  It does
    // not have to show anything -- it has to not be a still.
    const k = (Math.sin(clock * 1.7) + Math.sin(clock * 0.61) * 0.6) * 0.5 + 0.5;
    screenMat.color.setRGB(0.35 + k * 0.4, 0.55 + k * 0.32, 0.72 + k * 0.28);
    tvGlow.intensity = 7 + k * 5;
    knobLight.intensity = 6 + Math.sin(clock * 2.4) * 1.6;

    // Him.  1.1 m/s -- a walk, not a hunt, because he has nothing to hunt.
    let speed = 0;
    if (pause > 0) {
      pause -= dt;
    } else {
      const dx = goal.x - at.x;
      const dz = goal.y - at.y;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.4) {
        leg = 1 - leg;
        goal.set(PATROL[leg][0], PATROL[leg][1]);
        pause = 2.2 + Math.random() * 2.5;
      } else {
        speed = 1.1;
        at.x += (dx / dist) * speed * dt;
        at.y += (dz / dist) * speed * dt;
        yaw = Math.atan2(dx, dz);
      }
    }
    monster.setPose(at.x, 0, at.y, yaw);
    monster.update(dt, {
      speed,
      // Shut.  He is not chasing anything; he is looking, and that is the
      // whole of what makes watching him from up here unpleasant.
      maw: 0.12,
      climb: 0,
      // The head sweeps the room the way it does upstairs, and it never once
      // comes up -- he does not know there is an up.
      scan: Math.sin(clock * 0.5) * 0.7,
    });
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
