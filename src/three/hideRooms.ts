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
}

/**
 * What kind of thing you hide in.  Only the shape and the sound differ — and
 * the bed, which you go UNDER rather than into, and which he checks by
 * lifting the blanket.
 */
export type SpotKind = 'chest' | 'cupboard' | 'locker' | 'bed';

/** Which set of textures and props dresses the room.  See hideDecor. */
export type RoomTheme = 'lounge' | 'stores' | 'ward';

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
  /** Where he goes once he has finished with the door.  Kept off the furniture. */
  froggyStart: { x: number; z: number };
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
  wallH: 3.4,
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
export const LIVING_ROOM: RoomDef = scaleRoom(LOUNGE_BASE, 1.5, 1.3);
/**
 * The stores was the largest room in the building and it played like it: long
 * racking runs, a lot of ground between one locker and the next, and a hunt
 * that came down to picking a box and staying in it.  It is pulled back to its
 * drawn size (1.0), and its racking and pallets are slimmed (0.85) so the
 * aisles stay wide — smaller room, same number of ways through it, and a real
 * chance to leave one spot for another while he is working the other end.
 */
export const WAREHOUSE: RoomDef = scaleRoom(STORES_BASE, 1.0, 0.85);
export const WARD: RoomDef = scaleRoom(WARD_BASE, 1.1);

export const ROOMS: RoomDef[] = [LIVING_ROOM, WAREHOUSE, WARD];
