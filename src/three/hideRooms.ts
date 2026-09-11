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

/** What kind of thing you climb into.  Only the shape and the sound differ. */
export type SpotKind = 'chest' | 'cupboard' | 'locker';

export interface HideSpot {
  x: number;
  z: number;
  /** Facing, radians — the lid or door opens away from this. */
  rot: number;
  kind: SpotKind;
}

export interface RoomDef {
  name: string;
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
export const LIVING_ROOM: RoomDef = {
  name: 'THE LOUNGE',
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
    { x: -11.0, z: -2.0, w: 2.6, d: 1.4, h: 0.6, color: 0x4a3524, low: true },
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
  ],
  door: { x: 0 },
  // You come in through the door, so you start beside it, facing the room.
  spawn: { x: 0, z: 12.2 },
  froggyStart: { x: -13.0, z: -11.0 },
};

/** Underground, and bigger again.  Racking makes the sightlines. */
export const WAREHOUSE: RoomDef = {
  name: 'SUB-LEVEL STORES',
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
  ],
  door: { x: 0 },
  spawn: { x: 0, z: 16.2 },
  froggyStart: { x: -20.0, z: -15.0 },
};

export const ROOMS: RoomDef[] = [LIVING_ROOM, WAREHOUSE];
