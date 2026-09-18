/**
 * The rooms he locks you in.  Geometry only — HideRoom3D owns the behaviour.
 *
 * Each room is a box with furniture in it.  Furniture blocks movement AND
 * sight, which is the whole game: a room of open floor has nowhere to break
 * his line of sight, and a room packed solid has nowhere to run.
 *
 * Hiding spots are chests, cupboards and lockers.  There have to be more of
 * them than he can check quickly, and they have to be spread — a cluster lets
 * him clear three in the time it takes you to reach a fourth.  The kinds are
 * not decoration: a locker across the room is a different decision from the
 * chest at your feet, and he opens all of them.
 */

export interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: number;
  /** Waist-height things you can see over but not walk through. */
  low?: boolean;
  /**
   * Built as a real prop rather than a coloured cuboid.  The collision box is
   * unchanged either way — the prop is fitted INTO the box it replaces, so
   * what you can walk through and what he can see over do not depend on how
   * nicely a thing happens to be modelled.
   */
  prop?: 'cabinet' | 'case' | 'counter' | 'change';
  /** Which way a prop with a front is facing, in radians.  0 faces +Z. */
  face?: number;
}

/**
 * What kind of thing you hide in.  Only the shape and the sound differ — and
 * the bed, which you go UNDER rather than into, and which he checks by
 * lifting the blanket.
 */
export type SpotKind = 'chest' | 'cupboard' | 'locker' | 'bed';

/** Which set of textures and props dresses the room.  See hideDecor. */
export type RoomTheme = 'lounge' | 'stores' | 'ward' | 'arcade';

export interface HideSpot {
  x: number;
  z: number;
  /** Facing, radians — the lid or door opens away from this. */
  rot: number;
  kind: SpotKind;
}

export interface RoomDef {
  name: string;
  theme: RoomTheme;
  /** Half-extents of the floor: the room spans -halfW..halfW by -halfD..halfD. */
  halfW: number;
  halfD: number;
  wallH: number;
  floor: number;
  wall: number;
  ceiling: number;
  /** Warm bulbs, positioned in room space. */
  lights: Array<{ x: number; z: number; color: number; intensity: number }>;
  furniture: Box[];
  spots: HideSpot[];
  /** The door he locks behind you.  It does not open again this round. */
  door: { x: number };
  /** Where you come in, and where he does the locking. */
  spawn: { x: number; z: number };
  /**
   * Which way you are looking on the first frame.  0 looks down -Z, which is
   * "into the room" for every room you enter through the front door — and dead
   * at the back wall for the one you enter through the back of.
   */
  spawnYaw?: number;
  /**
   * The door you came IN through, where the room wants it seen.  It is drawn
   * in the back wall so the player can turn round and find it: knowing which
   * way you came from is half of knowing which way out is.
   */
  staffDoor?: { x: number };
  /**
   * THE SECTION OF THE RIGHT-HAND WALL YOU CAN WALK THROUGH.
   *
   * `z` is its centre on the +X wall (screen-right at spawn, since yaw 0 looks
   * down -Z), `w` how wide it is.  It is not drawn, not lit, not prompted and
   * not in the nav grid: from either side it is wall, and the only thing that
   * knows otherwise is the player's own movement test.
   *
   * Deliberately narrow.  A three-metre hole would be found by anyone who ran
   * a wall; a metre and a half has to be aimed at.
   */
  secretDoor?: { z: number; w: number };
  /**
   * A doorway in a side wall that is SCENERY.
   *
   * The lit arcade has a way through to the back room in its left-hand wall,
   * and a dark version of that room without one does not look like the same
   * building.  It is lit, framed and recessed so it reads as a genuine opening
   * from across the floor -- and it is bricked up a foot behind the frame, so
   * there is nothing on the other side of it to go to.
   */
  wallOpening?: { side: 'left' | 'right'; z: number; w: number; h: number };
  /** Where he goes once he has finished with the door.  Kept off the furniture. */
  froggyStart: { x: number; z: number };
  /**
   * The prize case, where a room has one.  It is not scenery: the player has a
   * key by now, and the first thing anyone does with a key in a room with a
   * locked glass case is try it.  The room needs to know where the case is so
   * the case can say no.
   */
  prizeCase?: { x: number; z: number };
  /**
   * The counter, where a room has one, and the fact that you can get over it.
   *
   * It is declared rather than inferred from the furniture because it is the
   * escape route, not a prop: the room has to be able to say which waist-high
   * box is the one the player is allowed to climb, which side of it they have
   * to be standing on to climb it, and how high the top is.
   *
   * IT IS A LIST BECAUSE A REAL COUNTER TURNS A CORNER.  One straight run
   * across a room is a serving hatch; an arcade's ticket desk wraps round the
   * staff side so that the person behind it is enclosed, with the back-office
   * door inside the wrap.  Every run is climbable from either side, so the
   * whole thing is cover as well as a wall.
   */
  counter?: CounterRun[];
  /**
   * The front doors, where the room's way out is a pair of glass ones rather
   * than a slab of painted wood.  See `buildGlassDoors`: two leaves, a
   * mullion, and a chain and padlock across the handles that is the reason
   * pressing E at them starts a sequence instead of opening them.
   */
  glassDoor?: { w: number; h: number };
}

/**
 * One straight run of counter.
 *
 * `axis` is the way the run LIES -- 'x' runs across the room, 'z' runs down
 * it -- `at` is where it sits on the other axis, and `from`/`to` are its two
 * ends along `axis`.
 */
export interface CounterRun {
  axis: 'x' | 'z';
  at: number;
  from: number;
  to: number;
  top: number;
}

/**
 * Interior walls are the point of the bigger rooms.  One open box, however
 * large, means he can see you from anywhere in it and the only counterplay is
 * a chest.  Partitions give you the third option — break the sightline and
 * simply not be where he is looking.
 */
const LOUNGE_BASE: RoomDef = {
  name: 'THE LOUNGE',
  theme: 'lounge',
  halfW: 18,
  halfD: 14,
  // 4.0 rather than a domestic 3.4: the thing hunting you in here stands 3.6m,
  // and at the old height his head went through the ceiling standing still.
  // A tall old lounge reads fine and leaves him just enough room to be under
  // it rather than in it.
  wallH: 4.0,
  floor: 0x2a2119,
  wall: 0x35291f,
  ceiling: 0x140f0b,
  lights: [
    { x: -11, z: -8, color: 0xffb45e, intensity: 16 },
    { x: 9, z: -6, color: 0xff8c42, intensity: 14 },
    { x: -8, z: 7, color: 0xffb45e, intensity: 13 },
    { x: 11, z: 8, color: 0xff8c42, intensity: 12 },
    { x: 0, z: 0, color: 0xffd9a0, intensity: 10 },
  ],
  furniture: [
    // ---- partitions.  Full height, so they break sight completely.
    { x: -6.5, z: -8.0, w: 0.7, d: 12.0, h: 3.4, color: 0x2e241b },
    { x: 7.5, z: -7.0, w: 0.7, d: 14.0, h: 3.4, color: 0x2e241b },
    { x: -13.0, z: 2.5, w: 10.0, d: 0.7, h: 3.4, color: 0x2e241b },
    { x: 9.0, z: 4.5, w: 12.0, d: 0.7, h: 3.4, color: 0x2e241b },
    { x: 0.5, z: -3.5, w: 8.0, d: 0.7, h: 3.4, color: 0x2e241b },

    // ---- tall things you can lose him behind
    { x: -17.0, z: -3.0, w: 1.0, d: 6.0, h: 2.6, color: 0x3a2c20 },
    { x: 17.0, z: -2.0, w: 1.0, d: 6.0, h: 2.6, color: 0x3a2c20 },
    { x: -2.5, z: 9.5, w: 2.0, d: 1.2, h: 2.5, color: 0x3a2c20 },
    { x: 3.5, z: 11.0, w: 2.4, d: 1.2, h: 2.4, color: 0x3a2c20 },
    { x: -10.5, z: -12.0, w: 3.0, d: 1.0, h: 2.3, color: 0x3a2c20 },
    { x: 12.5, z: -11.0, w: 1.0, d: 3.4, h: 2.4, color: 0x3a2c20 },

    // ---- sofas and tables, waist height
    { x: -12.0, z: -6.0, w: 4.4, d: 1.5, h: 0.9, color: 0x5e2a34, low: true },
    { x: -9.0, z: -9.5, w: 1.5, d: 3.6, h: 0.9, color: 0x5e2a34, low: true },
    { x: 11.0, z: -8.5, w: 4.0, d: 1.5, h: 0.9, color: 0x5e2a34, low: true },
    { x: 2.0, z: 6.5, w: 4.6, d: 1.5, h: 0.9, color: 0x4a3a52, low: true },
    { x: -12.5, z: 8.0, w: 3.0, d: 1.4, h: 0.9, color: 0x4a3a52, low: true },
    // pulled off the chest beside it: a coffee table half a body-width from a
    // hiding place is a hiding place you have to sidle into
    { x: -12.2, z: -2.6, w: 2.6, d: 1.4, h: 0.6, color: 0x4a3524, low: true },
    { x: 12.0, z: -1.0, w: 2.0, d: 2.0, h: 0.6, color: 0x4a3524, low: true },
    { x: -3.0, z: 0.5, w: 2.4, d: 1.3, h: 0.6, color: 0x4a3524, low: true },
    { x: 14.0, z: 9.0, w: 2.2, d: 2.2, h: 1.2, color: 0x3f3128 },
    { x: -15.5, z: 11.5, w: 2.0, d: 2.0, h: 1.4, color: 0x3f3128 },
    { x: 6.0, z: -12.5, w: 2.2, d: 1.6, h: 1.3, color: 0x3f3128 },

    // the television, still off
    { x: -1.0, z: -13.2, w: 3.0, d: 0.6, h: 1.6, color: 0x14161a },
  ],
  spots: [
    { x: -16.0, z: -11.0, rot: 0, kind: 'cupboard' },
    { x: -9.5, z: -1.0, rot: Math.PI / 2, kind: 'chest' },
    { x: -2.0, z: -7.5, rot: 0, kind: 'chest' },
    { x: 4.5, z: -10.5, rot: 0, kind: 'cupboard' },
    { x: 14.5, z: -5.0, rot: Math.PI, kind: 'cupboard' },
    { x: 10.0, z: 1.0, rot: Math.PI / 2, kind: 'chest' },
    { x: -15.0, z: 5.0, rot: 0, kind: 'cupboard' },
    { x: -5.5, z: 6.0, rot: Math.PI / 2, kind: 'chest' },
    { x: 6.5, z: 9.5, rot: 0, kind: 'chest' },
    { x: 16.0, z: 12.0, rot: Math.PI, kind: 'cupboard' },
    // a couple of beds that were never meant to be in a lounge
    { x: -16.0, z: -6.5, rot: Math.PI / 2, kind: 'bed' },
    { x: 15.5, z: 2.0, rot: Math.PI / 2, kind: 'bed' },
  ],
  door: { x: 0 },
  // You come in through the door, so you start beside it, facing the room.
  spawn: { x: 0, z: 12.2 },
  froggyStart: { x: -13.0, z: -11.0 },
};

/** Underground, and bigger again.  Racking makes the sightlines. */
const STORES_BASE: RoomDef = {
  name: 'SUB-LEVEL STORES',
  theme: 'stores',
  halfW: 24,
  halfD: 18,
  wallH: 4.6,
  floor: 0x24262a,
  wall: 0x1b1d21,
  ceiling: 0x0d0e10,
  lights: [
    { x: -16, z: -10, color: 0x9fd4ff, intensity: 16 },
    { x: 0, z: -12, color: 0x8fc0e8, intensity: 13 },
    { x: 15, z: -6, color: 0x9fd4ff, intensity: 14 },
    { x: -12, z: 6, color: 0x8fc0e8, intensity: 13 },
    { x: 10, z: 12, color: 0xffb45e, intensity: 12 },
  ],
  furniture: [
    // racking runs, leaving aisles you can lose him down
    { x: -18.0, z: -6.0, w: 1.4, d: 20.0, h: 4.0, color: 0x33383f },
    { x: -11.0, z: -6.0, w: 1.4, d: 20.0, h: 4.0, color: 0x33383f },
    { x: -4.0, z: -6.0, w: 1.4, d: 20.0, h: 4.0, color: 0x33383f },
    { x: 3.0, z: -6.0, w: 1.4, d: 20.0, h: 4.0, color: 0x33383f },
    { x: 10.0, z: -6.0, w: 1.4, d: 20.0, h: 4.0, color: 0x33383f },
    { x: 17.0, z: -6.0, w: 1.4, d: 20.0, h: 4.0, color: 0x33383f },
    // a cross wall, so the aisles are not five straight sightlines
    { x: -7.0, z: 3.0, w: 24.0, d: 0.8, h: 4.0, color: 0x26292e },
    { x: 14.0, z: 3.0, w: 12.0, d: 0.8, h: 4.0, color: 0x26292e },

    // ---- concrete pillars, floor to ceiling.  A rack run is one long wall you
    // either commit to or do not; a pillar is a thing you can put between you
    // and him and then move around while he decides which side to come down.
    // Two stand in the aisles at the far end, the rest hold up the open half.
    // two down the aisles, so a run to the far end has one thing in it
    { x: -14.5, z: -12.0, w: 1.6, d: 1.6, h: 4.6, color: 0x3b4046 },
    { x: -0.5, z: -12.0, w: 1.6, d: 1.6, h: 4.6, color: 0x3b4046 },
    // and six holding up the open half, each clear of the hiding places so
    // that none of them is a pillar you cannot get round to
    { x: -21.5, z: 5.0, w: 1.6, d: 1.6, h: 4.6, color: 0x3b4046 },
    { x: -12.5, z: 6.5, w: 1.6, d: 1.6, h: 4.6, color: 0x3b4046 },
    { x: -3.0, z: 11.0, w: 1.6, d: 1.6, h: 4.6, color: 0x3b4046 },
    { x: 4.5, z: 6.0, w: 1.6, d: 1.6, h: 4.6, color: 0x3b4046 },
    { x: 10.5, z: 11.5, w: 1.6, d: 1.6, h: 4.6, color: 0x3b4046 },
    { x: 19.5, z: 6.5, w: 1.6, d: 1.6, h: 4.6, color: 0x3b4046 },

    // pallet stacks in the open half
    { x: -20.0, z: 10.0, w: 3.2, d: 3.2, h: 2.2, color: 0x4a3a26 },
    { x: -14.0, z: 13.0, w: 2.6, d: 2.6, h: 1.4, color: 0x4a3a26, low: true },
    { x: -6.0, z: 9.0, w: 4.0, d: 2.6, h: 2.4, color: 0x4a3a26 },
    { x: 1.0, z: 13.5, w: 3.4, d: 2.4, h: 2.0, color: 0x4a3a26 },
    { x: 8.0, z: 8.5, w: 3.0, d: 2.6, h: 2.6, color: 0x4a3a26 },
    { x: 18.0, z: 11.0, w: 2.4, d: 4.0, h: 2.8, color: 0x3a3f46 },
    { x: 21.0, z: 0.0, w: 2.0, d: 5.0, h: 3.0, color: 0x3a3f46 },
  ],
  spots: [
    { x: -21.0, z: -14.0, rot: 0, kind: 'locker' },
    { x: -14.5, z: -3.0, rot: Math.PI / 2, kind: 'locker' },
    { x: -7.5, z: -14.0, rot: 0, kind: 'locker' },
    { x: -0.5, z: -8.0, rot: Math.PI / 2, kind: 'chest' },
    { x: 6.5, z: -14.0, rot: 0, kind: 'locker' },
    { x: 13.5, z: -4.0, rot: Math.PI / 2, kind: 'locker' },
    { x: 21.0, z: -12.0, rot: Math.PI, kind: 'locker' },
    { x: -17.0, z: 6.0, rot: 0, kind: 'chest' },
    { x: -2.0, z: 5.5, rot: 0, kind: 'chest' },
    { x: 12.0, z: 15.0, rot: 0, kind: 'locker' },
    { x: -10.0, z: 15.5, rot: 0, kind: 'cupboard' },
    // camp beds, in the open half, where somebody once slept down here
    { x: 14.0, z: 8.0, rot: 0, kind: 'bed' },
    { x: -9.5, z: 12.5, rot: Math.PI / 2, kind: 'bed' },
  ],
  door: { x: 0 },
  spawn: { x: 0, z: 16.2 },
  froggyStart: { x: -20.0, z: -15.0 },
};

/**
 * The last room.  A ward: rows of beds with curtain rails between them, a
 * nurses' station, and lockers along the walls.  Beds are most of the cover,
 * which is the point of it — under one, you can see his feet go past.
 */
const WARD_BASE: RoomDef = {
  name: 'THE WARD',
  theme: 'ward',
  halfW: 26,
  halfD: 19,
  wallH: 3.8,
  floor: 0x3a3d3a,
  wall: 0x505a52,
  ceiling: 0x1a1d1a,
  lights: [
    { x: -16, z: -11, color: 0xc8ffd8, intensity: 14 },
    { x: 0, z: -11, color: 0xd8ffe8, intensity: 12 },
    { x: 16, z: -11, color: 0xc8ffd8, intensity: 14 },
    { x: -16, z: 7, color: 0xd8ffe8, intensity: 12 },
    { x: 16, z: 7, color: 0xc8ffd8, intensity: 12 },
    { x: 0, z: 12, color: 0xffb45e, intensity: 9 },
  ],
  furniture: [
    // curtain rails: full-height partitions between the bays
    { x: -13.0, z: -12.0, w: 0.4, d: 12.0, h: 3.8, color: 0x6a7368 },
    { x: -4.0, z: -12.0, w: 0.4, d: 12.0, h: 3.8, color: 0x6a7368 },
    { x: 5.0, z: -12.0, w: 0.4, d: 12.0, h: 3.8, color: 0x6a7368 },
    { x: 14.0, z: -12.0, w: 0.4, d: 12.0, h: 3.8, color: 0x6a7368 },
    // the corridor wall down the middle, with gaps at both ends
    { x: -8.0, z: -2.5, w: 22.0, d: 0.6, h: 3.8, color: 0x555e55 },
    { x: 15.0, z: -2.5, w: 14.0, d: 0.6, h: 3.8, color: 0x555e55 },
    // the nurses' station, and the wall behind it
    { x: 0.0, z: 6.0, w: 7.0, d: 2.2, h: 1.1, color: 0x7a7266 },
    { x: 0.0, z: 8.6, w: 9.0, d: 0.5, h: 3.8, color: 0x555e55 },
    // trolleys and cabinets you can go over
    { x: -18.0, z: 3.0, w: 1.6, d: 1.0, h: 1.0, color: 0x8a8f8a, low: true },
    { x: -9.0, z: 12.0, w: 2.2, d: 1.2, h: 1.6, color: 0x6e6a62 },
    { x: 9.0, z: 13.0, w: 2.2, d: 1.2, h: 1.6, color: 0x6e6a62 },
    { x: 20.0, z: 4.0, w: 1.6, d: 1.0, h: 1.0, color: 0x8a8f8a, low: true },
    { x: -22.0, z: 12.0, w: 2.6, d: 2.6, h: 2.6, color: 0x4a4d4a },
    { x: 22.0, z: 13.0, w: 2.6, d: 2.6, h: 2.6, color: 0x4a4d4a },
    { x: -20.0, z: -4.5, w: 3.0, d: 1.4, h: 0.9, color: 0x5c5a52, low: true },
    { x: 21.0, z: -5.0, w: 3.0, d: 1.4, h: 0.9, color: 0x5c5a52, low: true },
  ],
  spots: [
    // a bed in every bay
    { x: -22.0, z: -14.0, rot: 0, kind: 'bed' },
    { x: -17.5, z: -8.0, rot: 0, kind: 'bed' },
    { x: -8.5, z: -14.0, rot: 0, kind: 'bed' },
    { x: -8.5, z: -7.0, rot: 0, kind: 'bed' },
    { x: 0.5, z: -14.0, rot: 0, kind: 'bed' },
    { x: 9.5, z: -14.0, rot: 0, kind: 'bed' },
    { x: 9.5, z: -7.0, rot: 0, kind: 'bed' },
    { x: 18.5, z: -14.0, rot: 0, kind: 'bed' },
    { x: 22.0, z: -8.0, rot: 0, kind: 'bed' },
    // and lockers and a cupboard in the open half
    { x: -24.5, z: 0.0, rot: Math.PI / 2, kind: 'locker' },
    { x: 24.5, z: 0.0, rot: -Math.PI / 2, kind: 'locker' },
    { x: -14.0, z: 16.5, rot: 0, kind: 'cupboard' },
    { x: 15.0, z: 16.5, rot: 0, kind: 'locker' },
    { x: 5.0, z: 3.0, rot: Math.PI / 2, kind: 'chest' },
  ],
  door: { x: 0 },
  spawn: { x: 0, z: 17.2 },
  froggyStart: { x: -23.0, z: -16.0 },
};

/**
 * Stretch a room.  Positions scale by `k` and heights never do.
 *
 * Footprints scale separately (`bulk`, defaulting to `k`), and the gap between
 * the two is the useful part: spreading the layout further than the furniture
 * grows opens the floor BETWEEN things without moving a single sightline the
 * layout was designed around.  That is how the first zone gets room to move
 * between hiding places while staying the same room.
 */
function scaleRoom(def: RoomDef, k: number, bulk = k): RoomDef {
  return {
    ...def,
    halfW: Math.round(def.halfW * k),
    halfD: Math.round(def.halfD * k),
    lights: def.lights.map((l) => ({ ...l, x: l.x * k, z: l.z * k })),
    furniture: def.furniture.map((f) => ({ ...f, x: f.x * k, z: f.z * k, w: f.w * bulk, d: f.d * bulk })),
    spots: def.spots.map((s) => ({ ...s, x: s.x * k, z: s.z * k })),
    door: { x: def.door.x * k },
    spawn: { x: def.spawn.x * k, z: def.spawn.z * k },
    froggyStart: { x: def.froggyStart.x * k, z: def.froggyStart.z * k },
  };
}

/**
 * The lounge is the room you learn the game in, and it was the tightest of the
 * three: sofas and tables at every turn, and a run to the next chest that came
 * down to threading a gap.  It is spread out (1.5) further than its furniture
 * has grown (1.3), so the walls, the partitions and the spots are where they
 * always were relative to each other and there is simply more floor in between.
 */
export const LIVING_ROOM: RoomDef = { ...scaleRoom(LOUNGE_BASE, 1.5, 1.3), secretDoor: { z: 9.0, w: 1.6 } };
/**
 * The stores was the largest room in the building and it played like it: long
 * racking runs, a lot of ground between one locker and the next, and a hunt
 * that came down to picking a box and staying in it.  It is pulled back to its
 * drawn size (1.0), and its racking and pallets are slimmed (0.85) so the
 * aisles stay wide — smaller room, same number of ways through it, and a real
 * chance to leave one spot for another while he is working the other end.
 */
export const WAREHOUSE: RoomDef = { ...scaleRoom(STORES_BASE, 1.0, 0.85), secretDoor: { z: 10.0, w: 1.6 } };
/**
 * THE SECRET DOORS.  Set after scaling, in final room coordinates, and each
 * one sited on the clearest stretch of its room's +X wall -- clear of every
 * piece of furniture and every hiding place, so walking into it is walking
 * into bare wall and nothing about the dressing hints at it.
 */
export const WARD: RoomDef = { ...scaleRoom(WARD_BASE, 1.1), secretDoor: { z: -10.8, w: 1.6 } };

/**
 * THE ARCADE, IN THREE DIMENSIONS.  The last room of the sequence, and the
 * only one the player has already walked around — from above, in two
 * dimensions, with the lights on.
 *
 * IT IS NOT DRAWN FROM THE PICTURE OF THE LIT ROOM.  IT IS DRAWN FROM ITS
 * COORDINATES.  Every position below is `game/content.ts` put through one
 * linear map, so this room and the hub the player spent the first half of the
 * night in are the same floor plan rather than two people's idea of it:
 *
 *   COUNTER        x 112..258   the desk, right of centre with the floor open
 *                               to its left
 *   PRIZE_CASE     x 126..226   along the back wall, behind the desk
 *   STAFF_DOOR     x 232        INSIDE the counter's span, at its right-hand
 *                               end, which is the whole reason the only way to
 *                               it is over the top
 *   CABINETS       (52,88)      one against the left wall
 *                  (52,164) (98,164) (244,164) (290,164)
 *                               four along the front wall, two either side of
 *                               the doors
 *   change machine x 272        past the right-hand end of the desk
 *
 * `x3d = (x2d - 160) * 22/292` maps the hub's 292 walkable pixels onto this
 * room's twenty-two metres.  The DEPTH axis is not mapped with it: a flat
 * three-quarter room foreshortens everything running away from the camera, so
 * the counter's eighteen pixels are a desk AND its height at once and the
 * service strip behind it is six pixels — one body, because that is all a flat
 * room needs it to be.  Laid out at that scale in three dimensions it is a
 * corridor nobody can turn round in.  The depth here is the lit room's ORDER,
 * at metric clearances: wall, case, staff floor, counter, open floor,
 * machines, doors.
 *
 * YOU COME OUT OF THE BACK OFFICE, AND THE COUNTER IS ROUND YOU.  The desk
 * wraps: one run across the front of the staff corner and one down each end
 * into the back wall, so the corner is closed on all four sides and the staff
 * door in the wall behind is inside it.  The floor is over the top, from any
 * run, in either direction.
 *
 * COVER, NOT CONTAINERS.  There is NOTHING in this room to get inside.  Five
 * cabinets, a change machine and the desk: it is a room you break a sightline
 * in and keep moving through, and the hiding mechanic the three rooms
 * downstairs taught is deliberately taken away for the one room whose
 * objective is a door rather than a clock.  Nothing is in here that is not in
 * the lit room's own layout.
 */
const ARCADE_BASE: RoomDef = {
  name: 'THE ARCADE',
  // 22 by 20.  The width is the hub's own, to scale; the depth is the hub's
  // order given room to stand in.
  halfW: 11,
  halfD: 10,
  theme: 'arcade',
  // Tall enough for the thing hunting you to stand up in, and no taller: an
  // arcade with a warehouse ceiling stops being an arcade.
  wallH: 4.2,
  floor: 0x1b3440,
  wall: 0x3b2a52,
  ceiling: 0x120c1c,
  lights: [
    // the desk and the case behind it, which is what the room has to say first
    { x: 1.2, z: -7.8, color: 0xffb45e, intensity: 13 },
    { x: 5.6, z: -6.4, color: 0xffd45e, intensity: 9 },
    // the machine on the left wall, lighting the wall it stands against
    { x: -8.6, z: -1.3, color: 0xff4fa3, intensity: 10 },
    // the front row, either side of the doors
    { x: -6.4, z: 7.4, color: 0xffd45e, intensity: 10 },
    { x: 8.0, z: 7.4, color: 0x7b4bd8, intensity: 10 },
    // and the doors, which are the objective and are lit like one
    { x: 0, z: 8.8, color: 0xc8d8ff, intensity: 10 },
    // One cold fill over the open middle -- not to light the room, but so the
    // floor between the counter and the doors has a shape to it rather than
    // being a black gap the player walks across on faith.
    { x: 0, z: 1.0, color: 0x6a7fa8, intensity: 7 },
  ],
  furniture: [
    // ---- THE COUNTER, IN THREE RUNS, WRAPPING THE STAFF CORNER.
    //
    // The front run is COUNTER x 112..258 to scale.  The two returns are what
    // the flat room gets for free from having a back wall six pixels behind
    // the desk: they close the ends, so the corner is somewhere you are rather
    // than a strip you stand in, and there is no walking round into it.
    // `face` is the PUBLIC side of each run: the front looks down the room, and
    // the two returns look outwards, away from the staff corner between them.
    // It is what decides which way the top overhangs and which side carries
    // the panelling, so a return built facing the wrong way would put its
    // shadow inside the corner nobody can see into.
    { x: 1.88, z: -5.4, w: 11.0, d: 1.2, h: 1.15, color: 0x6b4a2f, low: true, prop: 'counter', face: 0 },
    { x: -3.61, z: -7.7, w: 1.2, d: 5.8, h: 1.15, color: 0x6b4a2f, low: true, prop: 'counter', face: -Math.PI / 2 },
    { x: 7.38, z: -7.7, w: 1.2, d: 5.8, h: 1.15, color: 0x6b4a2f, low: true, prop: 'counter', face: Math.PI / 2 },

    // ---- THE BACK WALL: the prize case, and the staff door beside it.
    // PRIZE_CASE x 126..226, which lands it inside the wrap with the staff
    // door at its right -- exactly the arrangement the lit room draws.  It
    // stands two and a half metres clear of the desk, so there is floor to
    // stand on in front of it rather than a slot to be wedged into.
    { x: 1.2, z: -9.5, w: 7.4, d: 0.9, h: 2.8, color: 0x203048, prop: 'case', face: 0 },
    // the change machine, past the right-hand end of the desk, where x 272 is
    { x: 9.6, z: -9.3, w: 1.8, d: 1.2, h: 2.3, color: 0x4a4258, prop: 'change', face: 0 },

    // ---- FIVE MACHINES, WHERE THE LIT ROOM STANDS THEM.
    //
    // One against the left wall at (52, 88), turned to face into the room the
    // way a machine against a wall has to be.
    { x: -10.3, z: -1.3, w: 1.3, d: 2.0, h: 2.1, color: 0xff4fa3, prop: 'cabinet', face: Math.PI / 2 },
    // And four along the front wall at y 164, two either side of the doors,
    // ALL FACING BACK UP THE ROOM at the counter.  That is the way the lit
    // room has them and it is the way a player standing at the doors sees
    // them: you come over the desk into a row of lit fronts, and the backs are
    // what the wall gets.
    { x: -8.13, z: 8.7, w: 2.0, d: 1.3, h: 2.1, color: 0xff7a3d, prop: 'cabinet', face: Math.PI },
    { x: -4.67, z: 8.7, w: 2.0, d: 1.3, h: 2.1, color: 0x6fbb6a, prop: 'cabinet', face: Math.PI },
    { x: 6.33, z: 8.7, w: 2.0, d: 1.3, h: 2.1, color: 0xb9884f, prop: 'cabinet', face: Math.PI },
    { x: 9.79, z: 8.7, w: 2.0, d: 1.3, h: 2.1, color: 0x1d6f8f, prop: 'cabinet', face: Math.PI },
  ],
  // ---- NOTHING TO HIDE IN, and nothing that is not in the lit room either.
  // The bin and the plant that used to be by the doors are gone with the
  // lockers: the hub has no bin and no plant, and this room is the hub.
  spots: [],
  // The front doors, straight down the room from the staff corner.
  door: { x: 0 },
  // THE MAIN ENTRANCE, IN GLASS.  Two leaves and a mullion, chained shut: it
  // is the one thing in the room you can see the outside through, and the
  // chain across the handles is why looking at it is not the same as leaving.
  glassDoor: { w: 3.6, h: 2.7 },
  // ---- WHERE YOU COME IN, AND WHICH WAY YOU ARE FACING.
  //
  // Behind the desk, in the staff corner, a stride out and to the left of the
  // staff door in the back wall.  NOT DIRECTLY UNDER IT: the door is at the
  // desk's right-hand end, which puts anybody standing in it inside reach of
  // the return, and the first frame of the last room in the game should be the
  // room rather than a prompt offering to climb something.  Out here it is
  // clear of the return, clear of the case along the wall to the left and
  // clear of the desk in front, so nothing is being offered until the player
  // walks at it.  Turned to face down the room, so the first frame is the
  // desk, the machines either side of an open middle, and the glass doors at
  // the end of it.
  spawn: { x: 5.0, z: -7.8 },
  spawnYaw: Math.PI,
  staffDoor: { x: 6.1 },
  froggyStart: { x: 0.0, z: 4.6 },
  prizeCase: { x: 1.2, z: -9.5 },
  // All three runs, from either side.  The lit room only lets you over the
  // right-hand end, under the staff door; in here the desk is also the one
  // piece of waist-high cover on the floor, and cover you are not allowed back
  // behind is not cover.
  counter: [
    { axis: 'x', at: -5.4, from: -3.61, to: 7.38, top: 1.15 },
    { axis: 'z', at: -3.61, from: -10.0, to: -4.8, top: 1.15 },
    { axis: 'z', at: 7.38, from: -10.0, to: -4.8, top: 1.15 },
  ],
  // The way through to the back room, in the left-hand wall where the lit
  // arcade has its doorway (y 95..141).  Scenery: see RoomDef.wallOpening.
  wallOpening: { side: 'left', z: 2.5, w: 3.4, h: 2.8 },
};

export const ARCADE: RoomDef = ARCADE_BASE;

export const ROOMS: RoomDef[] = [LIVING_ROOM, WAREHOUSE, WARD, ARCADE];

/**
 * Which of them the arcade is.
 *
 * The three hide and seek rooms are 0, 1 and 2 and the arcade is whatever comes
 * after them.  Anything that wants to put the player in the arcade -- the jump
 * TEST_NAME takes, the harness, the transition out of the third room -- asks
 * here rather than writing 3 down, so adding a room in the middle of the
 * sequence cannot quietly send them somewhere else.
 */
export const ARCADE_ROOM = ROOMS.indexOf(ARCADE);
