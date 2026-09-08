/**
 * The rooms he locks you in.  Geometry only — HideRoom3D owns the behaviour.
 *
 * Each room is a box with furniture in it.  Furniture blocks movement AND
 * sight, which is the whole game: a room of open floor has nowhere to break
 * his line of sight, and a room packed solid has nowhere to run.
 *
 * Chests are the hiding places.  There have to be more of them than he can
 * check quickly, and they have to be spread — a cluster lets him clear three
 * in the time it takes you to reach a fourth.
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

export interface Chest {
  x: number;
  z: number;
  /** Facing, radians — the lid hinges away from this. */
  rot: number;
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
  chests: Chest[];
  /** Where the key can be, one picked at random on entry. */
  keySpots: Array<{ x: number; z: number }>;
  /** The locked door out, on the -Z wall. */
  door: { x: number };
  /** Where you come in, and where he does the locking. */
  spawn: { x: number; z: number };
  /** Where he goes once he has finished with the door.  Kept off the furniture. */
  froggyStart: { x: number; z: number };
}

export const LIVING_ROOM: RoomDef = {
  name: 'THE LOUNGE',
  halfW: 9,
  halfD: 7,
  wallH: 3.0,
  floor: 0x2a2119,
  wall: 0x35291f,
  ceiling: 0x140f0b,
  lights: [
    { x: -4, z: -2, color: 0xffb45e, intensity: 14 },
    { x: 5, z: 3, color: 0xff8c42, intensity: 10 },
  ],
  furniture: [
    // sofas
    { x: -6.2, z: -4.0, w: 3.6, d: 1.3, h: 0.9, color: 0x5e2a34, low: true },
    { x: 6.0, z: -3.4, w: 1.3, d: 3.2, h: 0.9, color: 0x5e2a34, low: true },
    { x: -5.2, z: 2.6, w: 1.2, d: 3.4, h: 0.9, color: 0x4a3a52, low: true },
    // shelving, tall enough to hide behind completely
    { x: -8.2, z: 1.5, w: 0.8, d: 4.0, h: 2.2, color: 0x3a2c20 },
    { x: 8.2, z: 2.0, w: 0.8, d: 3.4, h: 2.2, color: 0x3a2c20 },
    { x: 1.5, z: -6.2, w: 3.0, d: 0.7, h: 1.9, color: 0x3a2c20 },
    // a big television nobody has turned on
    { x: -0.5, z: -5.9, w: 2.4, d: 0.5, h: 1.4, color: 0x14161a },
    // tables and clutter
    { x: -3.6, z: 1.2, w: 2.2, d: 1.2, h: 0.55, color: 0x4a3524, low: true },
    { x: 3.4, z: 0.4, w: 1.6, d: 1.6, h: 0.6, color: 0x4a3524, low: true },
    { x: 2.0, z: 3.6, w: 1.1, d: 1.1, h: 1.1, color: 0x3f3128 },
    { x: -6.6, z: 3.4, w: 1.4, d: 1.4, h: 1.3, color: 0x3f3128 },
  ],
  chests: [
    { x: -7.6, z: -1.2, rot: 0 },
    { x: 7.4, z: -0.6, rot: Math.PI },
    { x: -2.6, z: -2.6, rot: Math.PI / 2 },
    { x: 4.6, z: 4.8, rot: 0 },
    { x: -5.0, z: 5.6, rot: 0 },
    { x: 0.8, z: 1.6, rot: Math.PI / 2 },
  ],
  keySpots: [
    { x: -3.6, z: 1.2 },
    { x: 3.4, z: 0.4 },
    { x: -6.6, z: 3.4 },
    { x: 2.0, z: 3.6 },
    { x: 6.0, z: -3.4 },
  ],
  door: { x: 0 },
  // You come in through the door, so you start beside it, facing the room.
  spawn: { x: 0, z: 5.2 },
  froggyStart: { x: -6.5, z: -5.0 },
};

/** Underground and much bigger, with racking instead of sofas. */
export const WAREHOUSE: RoomDef = {
  name: 'SUB-LEVEL STORES',
  halfW: 14,
  halfD: 11,
  wallH: 4.2,
  floor: 0x24262a,
  wall: 0x1b1d21,
  ceiling: 0x0d0e10,
  lights: [
    { x: -8, z: -5, color: 0x9fd4ff, intensity: 12 },
    { x: 7, z: 2, color: 0x8fc0e8, intensity: 10 },
    { x: 0, z: 8, color: 0xffb45e, intensity: 8 },
  ],
  furniture: [
    // racking runs, leaving aisles
    { x: -9.5, z: -3, w: 1.2, d: 9, h: 3.0, color: 0x33383f },
    { x: -4.5, z: -3, w: 1.2, d: 9, h: 3.0, color: 0x33383f },
    { x: 0.5, z: -3, w: 1.2, d: 9, h: 3.0, color: 0x33383f },
    { x: 5.5, z: -3, w: 1.2, d: 9, h: 3.0, color: 0x33383f },
    { x: 10.5, z: -3, w: 1.2, d: 9, h: 3.0, color: 0x33383f },
    // pallet stacks in the open half
    { x: -11.0, z: 6.5, w: 2.4, d: 2.4, h: 1.6, color: 0x4a3a26 },
    { x: -6.0, z: 7.6, w: 2.0, d: 2.0, h: 1.2, color: 0x4a3a26, low: true },
    { x: 2.0, z: 6.2, w: 3.0, d: 2.0, h: 1.8, color: 0x4a3a26 },
    { x: 8.0, z: 7.8, w: 2.6, d: 2.2, h: 1.5, color: 0x4a3a26 },
    { x: 12.0, z: 4.0, w: 1.8, d: 3.0, h: 2.0, color: 0x3a3f46 },
  ],
  chests: [
    { x: -12.2, z: -8.0, rot: 0 },
    { x: -7.0, z: -1.0, rot: Math.PI / 2 },
    { x: -2.0, z: -7.5, rot: 0 },
    { x: 3.0, z: -1.5, rot: Math.PI / 2 },
    { x: 8.0, z: -7.0, rot: 0 },
    { x: 12.4, z: -2.0, rot: Math.PI },
    { x: -9.0, z: 9.0, rot: 0 },
    { x: 5.0, z: 9.4, rot: 0 },
  ],
  keySpots: [
    { x: -11.0, z: 6.5 },
    { x: 2.0, z: 6.2 },
    { x: 8.0, z: 7.8 },
    { x: 12.0, z: 4.0 },
    { x: -6.0, z: 7.6 },
  ],
  door: { x: 0 },
  spawn: { x: 0, z: 9.2 },
  froggyStart: { x: -11.0, z: -8.0 },
};

export const ROOMS: RoomDef[] = [LIVING_ROOM, WAREHOUSE];
