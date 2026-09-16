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
  prop?: 'cabinet' | 'case';
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
   */
  counter?: { z: number; top: number; from: number; to: number };
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
 * dimensions, with the lights on.  Recognising it is the point: the counter is
 * where the counter has always been, the prize case is behind it, and the
 * machines stand in the two rows they stand in upstairs.
 *
 * THE SHAPE OF IT IS THE ESCAPE.  You come in through the staff door BEHIND
 * the counter, which is a wall to you and a step to him.  The only way onto
 * the floor is over it, and the counter runs the full width so there is no end
 * to walk around.  Once you are over, you are on the floor with him, and the
 * way out is the front door at the far end — as far from the counter as this
 * room goes.
 *
 * COVER, NOT CONTAINERS.  Nineteen cabinets, a change machine, a bin, a plant
 * and a photo booth: this is a room you hide BEHIND rather than inside, so
 * most of the furniture is chest-high or taller and the sightlines down the
 * lanes are long.  The handful of real hiding places are the staff side's —
 * the stock cupboard and the lockers — because they are what an arcade would
 * actually have out of sight of the customers.
 */
const ARCADE_BASE: RoomDef = {
  name: 'THE ARCADE',
  // 26 by 30.  It was 40 by 34, which is a warehouse with cabinets in it: the
  // lanes were long enough that nothing was ever near anything, and the room
  // stopped reading as the arcade the player spent the first half of the game
  // in.  This is the lit hub's own footprint, deep rather than wide.
  theme: 'arcade',
  halfW: 13,
  halfD: 15,
  // Tall enough for the thing hunting you to stand up in, and no taller: an
  // arcade with a warehouse ceiling stops being an arcade.
  wallH: 4.2,
  floor: 0x1b3440,
  wall: 0x3b2a52,
  ceiling: 0x120c1c,
  lights: [
    // Placed on what is actually in the room, and nothing in the middle: the
    // open floor the player crosses is meant to be the dark part, and the
    // machines light themselves.  One warm lamp over the counter, because that
    // is the first thing the room has to be able to say.
    { x: 0, z: -11.5, color: 0xffb45e, intensity: 13 },
    { x: 10, z: -13.5, color: 0xffd45e, intensity: 9 },
    { x: -7.6, z: -4.0, color: 0xff4fa3, intensity: 11 },
    { x: -7.6, z: 9.6, color: 0xffd45e, intensity: 11 },
    { x: 9.5, z: 9.6, color: 0x7b4bd8, intensity: 11 },
    { x: 0, z: 13.5, color: 0xc8d8ff, intensity: 9 },
    // One cold fill over the open middle -- not to light the room, but so the
    // floor between the counter and the door has a shape to it rather than
    // being a black gap the player walks across on faith.
    { x: 0, z: -1.0, color: 0x6a7fa8, intensity: 7 },
  ],
  furniture: [
    // ---- THE COUNTER.  Free standing, nine metres of it, at the back of the
    // room in front of the prize case.
    //
    // It used to be a hole in a full-height partition that crossed the whole
    // room, which made the climb the only way onto the floor -- and made the
    // back of the arcade a wall with a serving hatch in it, which is not what
    // the room looks like.  This is a ticket desk standing on the floor, open
    // at both ends, exactly as it is upstairs.  You can walk round it.  The
    // climb is a shortcut and a piece of cover now rather than a gate, which
    // is the trade the open layout costs.
    { x: -0.3, z: -11.5, w: 4.4, d: 1.2, h: 1.15, color: 0x6b4a2f, low: true },
    { x: 4.3, z: -11.5, w: 4.4, d: 1.2, h: 1.15, color: 0x6b4a2f, low: true },

    // ---- THE BACK WALL: the prize case, and the staff door beside it.
    // The case is BEHIND the counter and the door is next to the case, so the
    // first thing the room says is "you came out of there, past this".
    { x: 1.5, z: -14.3, w: 8.0, d: 0.9, h: 2.8, color: 0x203048, prop: 'case', face: 0 },
    // the change machine, in the top right corner, where the lit room keeps it
    { x: 11.4, z: -14.0, w: 1.8, d: 1.2, h: 2.3, color: 0x4a4258 },
    // and the bin in the top left, where the lit room keeps that
    { x: -11.7, z: -13.6, w: 1.0, d: 1.0, h: 1.0, color: 0x30384a, low: true },

    // ---- SIX MACHINES, in the arrangement the lit room has them: a pair up
    // by the counter on the left, a pair down by the door on the left, a pair
    // down by the door on the right, and a wide open middle to stand in.
    //
    // ALL SIX FACE BACK UP THE ROOM, towards the counter you come in behind.
    // A top-down pixel drawing has to draw every cabinet front-on and so says
    // nothing about which way they point; in here it decides whether the room
    // is a row of lit machines or a row of black slabs, because the backs are
    // unlit hardboard and the player walks the whole length of it.
    { x: -9.6, z: -4.0, w: 2.0, d: 1.3, h: 2.1, color: 0xff4fa3, prop: 'cabinet', face: Math.PI },
    { x: -5.6, z: -4.0, w: 2.0, d: 1.3, h: 2.1, color: 0xff7a3d, prop: 'cabinet', face: Math.PI },
    { x: -9.6, z: 9.6, w: 2.0, d: 1.3, h: 2.1, color: 0xffd45e, prop: 'cabinet', face: Math.PI },
    { x: -5.6, z: 9.6, w: 2.0, d: 1.3, h: 2.1, color: 0x6fbb6a, prop: 'cabinet', face: Math.PI },
    { x: 7.6, z: 9.6, w: 2.0, d: 1.3, h: 2.1, color: 0xb9884f, prop: 'cabinet', face: Math.PI },
    { x: 11.4, z: 9.6, w: 2.0, d: 1.3, h: 2.1, color: 0x1d6f8f, prop: 'cabinet', face: Math.PI },

    // a plant by the way out, the last thing you pass
    { x: -3.0, z: 12.6, w: 1.2, d: 1.2, h: 0.9, color: 0x3a5a3a, low: true },
  ],
  spots: [
    // Behind the counter, where an arcade keeps things out of the customers'
    // way, and neither is on the line from the staff door to the floor.
    { x: -11.6, z: -11.8, rot: Math.PI / 2, kind: 'cupboard' },
    { x: -11.6, z: -6.8, rot: Math.PI / 2, kind: 'locker' },
    // and four down the walls, in the gaps the six machines leave
    { x: -11.8, z: 1.6, rot: Math.PI / 2, kind: 'chest' },
    // Both pushed well down the room: at z = -6 they stood between the spawn
    // and everything worth seeing, and the first frame of the last room in the
    // game was two boxes.
    { x: 11.8, z: 3.0, rot: -Math.PI / 2, kind: 'locker' },
    { x: 11.8, z: 7.6, rot: -Math.PI / 2, kind: 'cupboard' },
    { x: 2.6, z: 12.8, rot: 0, kind: 'cupboard' },
  ],
  // The front door, straight down the room from the counter.
  door: { x: 0 },
  // ---- WHERE YOU COME IN, AND WHICH WAY YOU ARE FACING.
  //
  // Through the staff door, which is in the back wall AT YOUR SHOULDER, with
  // the prize case along the wall beside it and the counter in front.  You
  // start turned round to face down the room, so the first frame is the
  // counter, the machines either side of an open middle, and the front door at
  // the end of it.
  spawn: { x: 8.4, z: -13.0 },
  spawnYaw: Math.PI,
  staffDoor: { x: 8.4 },
  froggyStart: { x: 0.0, z: 12.0 },
  prizeCase: { x: 1.5, z: -14.3 },
  // The whole of it, from either side: nine metres of waist-high cover in the
  // middle of the room, which is what a counter is actually for.
  counter: { z: -11.5, top: 1.15, from: -2.5, to: 6.5 },
  // The way through to the back room, in the left-hand wall where the lit
  // arcade has it.  Scenery: see RoomDef.wallOpening.
  wallOpening: { side: 'left', z: 4.6, w: 3.0, h: 2.8 },
};

export const ARCADE: RoomDef = ARCADE_BASE;

export const ROOMS: RoomDef[] = [LIVING_ROOM, WAREHOUSE, WARD, ARCADE];
