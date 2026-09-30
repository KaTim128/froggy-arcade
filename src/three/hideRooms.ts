import type { DecoKind } from './hideThemes';

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
  /**
   * Built as one of the building's own things -- a bank of dead machines,
   * racking, a stove, a ball pit -- by `hideThemes`.  Fitted into the box, the
   * same as a prop: see DecoKind.
   */
  deco?: DecoKind;
  /**
   * A duct at floor level.  Crouched, the player goes through it; he never
   * does -- to him and to his map it is a wall.  See `duct` below.
   */
  crawl?: boolean;
  /** Which way a prop with a front is facing, in radians.  0 faces +Z. */
  face?: number;
}

/**
 * What kind of thing you hide in.  Only the shape and the sound differ — and
 * the bed, which you go UNDER rather than into, and which he checks by
 * lifting the blanket.
 */
export type SpotKind = 'chest' | 'cupboard' | 'locker' | 'bed';

/**
 * What a hiding place LOOKS like, where it is not the kind's own build.  The
 * hunt only ever sees the kind: see `hideSpotSkins`.
 *
 *   chest:    crate, prize (a prize box), toybox
 *   cupboard: cabinet (steel, maintenance), hatch (in a false wall)
 *   locker:   arcade (a dead machine you get into through its back)
 *   bed:      table (a cloth to the floor), bench (under a dust sheet), tunnel
 */
export type SpotSkin = 'crate' | 'prize' | 'toybox' | 'cabinet' | 'hatch' | 'arcade' | 'table' | 'bench' | 'tunnel';

/** Which set of textures and props dresses the room.  See hideDecor. */
export type RoomTheme = 'lounge' | 'stores' | 'ward' | 'arcade';

export interface HideSpot {
  x: number;
  z: number;
  /** Facing, radians — the lid or door opens away from this. */
  rot: number;
  kind: SpotKind;
  skin?: SpotSkin;
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
  /**
   * What is above the floor and on the walls, none of which is in the way of
   * anything: catwalks along the top of the tall racking, doors that are
   * locked for good, and the signs over the doorways that say what is where.
   */
  overhead?: {
    catwalks: Array<{ x: number; z: number; w: number; d: number; y: number }>;
    lockedDoors: Array<{ x: number; z: number; rot: number; label: string }>;
    signs: Array<{ x: number; z: number; y: number; rot: number; text: string; color: string }>;
  };
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

// ============================================================== the layouts
//
// THE BACK OF THE BUILDING, IN THREE ZONES.
//
// They were a lounge, a store and a ward: one big box each, with partitions
// and furniture in it.  They are now the parts of an arcade nobody was meant
// to see after closing -- each zone several places, joined up.
//
// HOW THEY ARE LAID OUT, WHATEVER THE THEME:
//
//   WINGS WITH MORE THAN ONE WAY IN.  Every area has at least two doorways,
//   so there is always a loop round the block he is coming down and never a
//   room you can only leave the way you came.
//
//   VENTS, GRILLED SHUT.  Ducts at floor level (`crawl`) run through the
//   walls between wings, with a grille bolted over each end.  They used to be
//   open, a way through on hands and knees that he could not follow -- which
//   made the inside of one the one place in the building he could never find
//   you.  He still treats them as walls; now so do you.
//
//   BLIND CORNERS AND SAFE POCKETS.  Doorways are offset rather than lined
//   up, so no two rooms share a sightline; the racking and the machines make
//   aisles that turn; the lit rooms and the dark ones alternate.
//
//   HEIGHT.  Catwalks along the top of the tall racking and shelving, with
//   the stairs up to them, and a locked door or two -- a building with more
//   in it than the floor you are on.  (Up there is scenery: the round is
//   played on the floor, where he is.)
//
//   HIDING PLACES OF EVERY SORT.  Still four kinds as far as the hunt is
//   concerned -- a lid, a door, a locker, something to get under -- dressed
//   as what the area would have in it: see `SpotSkin`.
//
// EVERY ZONE KEEPS ITS WIDTH, AND ITS SECRET DOOR WHERE IT WAS.  The +X wall
// is where it always was and the way through it is at the same point along
// it; the zones grew in depth, toward the front doors.

/** A full-height wall along x at `z`, from `x0` to `x1`, with doorways cut in it: [centre, width]. */
function wallX(z: number, x0: number, x1: number, gaps: Array<[number, number]>, h: number, color: number, t = 0.6): Box[] {
  return runs(x0, x1, gaps).map(([a, b]) => ({ x: (a + b) / 2, z, w: b - a, d: t, h, color }));
}
/** The same, along z at `x`. */
function wallZ(x: number, z0: number, z1: number, gaps: Array<[number, number]>, h: number, color: number, t = 0.6): Box[] {
  return runs(z0, z1, gaps).map(([a, b]) => ({ x, z: (a + b) / 2, w: t, d: b - a, h, color }));
}
function runs(a0: number, a1: number, gaps: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let at = a0;
  for (const [c, w] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (c - w / 2 > at + 0.05) out.push([at, c - w / 2]);
    at = c + w / 2;
  }
  if (a1 > at + 0.05) out.push([at, a1]);
  return out;
}
/**
 * A duct through a wall: 1.2 wide, 1.1 high, `len` long, lying across the
 * wall it goes through, grilled shut at both ends.  Low enough that he sees
 * over it; solid to both of you.
 */
function duct(x: number, z: number, along: 'x' | 'z', len = 2.6): Box {
  return along === 'x'
    ? { x, z, w: len, d: 1.2, h: 1.1, color: 0x6a7078, low: true, crawl: true, deco: 'duct' }
    : { x, z, w: 1.2, d: len, h: 1.1, color: 0x6a7078, low: true, crawl: true, deco: 'duct' };
}

const PI = Math.PI;

// ------------------------------------------------------------ zone one
//
// THE PARTY WING.  The front of it is the food court you come in through,
// the kitchen behind its pass on the left; beyond, the indoor playground on
// the left, a party room in the middle with a corridor all the way round it,
// two more party rooms on the right; and at the back, the arcade graveyard --
// banks of dead machines under a catwalk -- and the prize redemption counter
// with its stockroom and cage.

const P1 = 0x2e241b;
const PARTY_WING: RoomDef = {
  name: 'THE PARTY WING',
  theme: 'lounge',
  halfW: 27,
  halfD: 25,
  wallH: 4.0,
  floor: 0x2a2119,
  wall: 0x35291f,
  ceiling: 0x140f0b,
  lights: [
    // the kitchen's tubes, cold; the food court, warm; the playground's
    // coloured wash; the party rooms; the prize counter.  Party room one and
    // the machine graveyard get nothing: the graveyard is lit only by the
    // one screen in it still on, and that is the point of it.  (Five, as the
    // other zones have -- every lamp is paid for on every pixel.)
    { x: -19, z: 18.5, color: 0xd8f0ff, intensity: 11 },
    { x: 7, z: 18, color: 0xffb45e, intensity: 13 },
    { x: -17, z: 3, color: 0xff7ab0, intensity: 10 },
    { x: 11, z: 3, color: 0xb07aff, intensity: 11 },
    { x: 15, z: -16, color: 0xffb45e, intensity: 10 },
  ],
  furniture: [
    // ---- the kitchen: its wall to the food court, a door and a serving pass
    { x: -12, z: 13.6, w: 0.6, d: 2.6, h: 3.4, color: P1 },
    { x: -12, z: 18.05, w: 0.6, d: 1.9, h: 3.4, color: P1 },
    { x: -12, z: 20.8, w: 0.9, d: 3.6, h: 1.05, color: 0x6e7466, low: true, deco: 'kitchen', face: PI / 2 },
    { x: -12, z: 23.8, w: 0.6, d: 2.4, h: 3.4, color: P1 },
    ...wallX(12, -27, -11.7, [[-19, 2.4]], 3.4, P1),
    { x: -26.0, z: 20.5, w: 0.8, d: 6, h: 1.0, color: 0x6e7466, low: true, deco: 'kitchen', face: PI / 2 },
    { x: -21, z: 24.05, w: 2.4, d: 0.9, h: 1.0, color: 0x3a3c40, low: true, deco: 'stove', face: PI },
    { x: -14.2, z: 23.95, w: 1.3, d: 1.0, h: 2.2, color: 0x8a9094, deco: 'fridge', face: PI },

    // ---- the food court
    { x: -7, z: 16.5, w: 1.6, d: 1.6, h: 0.78, color: 0xc8503a, low: true, deco: 'foodTable' },
    { x: -3.5, z: 20.8, w: 1.6, d: 1.6, h: 0.78, color: 0x3a8ac8, low: true, deco: 'foodTable' },
    { x: 4.5, z: 20.2, w: 1.6, d: 1.6, h: 0.78, color: 0xe8c040, low: true, deco: 'foodTable' },
    { x: 9, z: 16, w: 1.6, d: 1.6, h: 0.78, color: 0x5ab45a, low: true, deco: 'foodTable' },
    { x: 13.5, z: 20.5, w: 1.6, d: 1.6, h: 0.78, color: 0xc8503a, low: true, deco: 'foodTable' },
    { x: 18, z: 16.5, w: 1.6, d: 1.6, h: 0.78, color: 0x3a8ac8, low: true, deco: 'foodTable' },
    { x: 22.5, z: 20.5, w: 1.6, d: 1.6, h: 0.78, color: 0xe8c040, low: true, deco: 'foodTable' },

    // ---- the playground: its wall to the corridor, with a door and a duct
    ...wallZ(-7, -5, 12, [[4, 2.4], [-1, 1.2]], 3.4, P1),
    duct(-7, -1, 'x'),
    { x: -21.5, z: 7.5, w: 5, d: 3, h: 2.8, color: 0x3a6ab0, deco: 'climbFrame' },
    { x: -21.5, z: 0.5, w: 5, d: 4, h: 0.9, color: 0x3a6ab0, low: true, deco: 'ballPit' },
    { x: -10.5, z: 8, w: 1.2, d: 4, h: 2.4, color: 0xc83a3a, deco: 'slide' },
    { x: -13, z: -2.3, w: 3, d: 3, h: 2.8, color: 0xc8a040, deco: 'climbFrame' },

    // ---- party room one, in the middle, with the corridor round it
    ...wallX(-1, -3.3, 9.3, [[3, 2.4]], 3.4, P1),
    ...wallX(8, -3.3, 9.3, [[6, 2.4]], 3.4, P1),
    ...wallZ(-3, -0.7, 7.7, [[5.5, 1.2]], 3.4, P1),
    duct(-3, 5.5, 'x'),
    ...wallZ(9, -0.7, 7.7, [[3, 2.4]], 3.4, P1),

    // ---- party rooms two and three, on the right
    ...wallZ(13, -5, 12, [[-1, 2.4], [8.5, 2.4]], 3.4, P1),
    ...wallX(4, 13.3, 27, [[17, 2.4]], 3.4, P1),
    ...wallX(12, 13, 27, [[20, 2.4]], 3.4, P1),
    { x: 23.5, z: -3.35, w: 5, d: 2, h: 0.5, color: 0x6a1a2a, low: true, deco: 'stage' },
    { x: 16.5, z: 7.9, w: 2.4, d: 1.1, h: 0.78, color: 0x8a3a5a, low: true, deco: 'partyTable' },

    // ---- across the building: the wall between the front and the back half
    ...wallX(-5, -27, 27, [[-20, 2.4], [-13, 1.2], [-5, 2.4], [11, 2.4], [22, 2.4]], 3.4, P1),
    duct(-13, -5, 'z'),

    // ---- the arcade graveyard, and the wall to the prize room
    ...wallZ(5, -25, -5.3, [[-15, 2.4]], 3.4, P1),
    { x: -17, z: -11, w: 6, d: 2.2, h: 2.1, color: 0x14151a, deco: 'arcadeBank' },
    { x: -5.75, z: -11, w: 6.5, d: 2.2, h: 2.1, color: 0x14151a, deco: 'arcadeBank' },
    { x: -19.25, z: -19, w: 5.5, d: 2.2, h: 2.1, color: 0x14151a, deco: 'arcadeBank' },
    { x: -7.5, z: -18.5, w: 7, d: 2.2, h: 2.1, color: 0x14151a, deco: 'arcadeBank' },
    // the catwalk's shelving along the back wall, and the stairs up to it
    { x: -15, z: -23.9, w: 16, d: 1.0, h: 3.0, color: 0x3a3e44, deco: 'shelf' },
    { x: -24.8, z: -20.4, w: 1.4, d: 5, h: 3.0, color: 0x3a3e44, deco: 'stairs', face: 0 },

    // ---- prize redemption
    { x: 13, z: -13, w: 8, d: 1.1, h: 1.1, color: 0x6b4a2f, low: true, prop: 'counter', face: 0 },
    { x: 13, z: -24.1, w: 8, d: 0.9, h: 2.8, color: 0x203048, prop: 'case', face: 0 },
    { x: 23.5, z: -22.5, w: 4, d: 3, h: 2.6, color: 0x5a5e62, deco: 'cage' },
  ],
  spots: [
    // the kitchen
    { x: -25.9, z: 14.5, rot: PI / 2, kind: 'cupboard' },
    { x: -16.5, z: 23.7, rot: PI, kind: 'chest', skin: 'crate' },
    { x: -19.5, z: 18.2, rot: 0, kind: 'bed', skin: 'table' },
    // the food court
    { x: 3.5, z: 13.6, rot: PI, kind: 'bed', skin: 'table' },
    { x: -10.5, z: 23.7, rot: PI, kind: 'locker' },
    { x: 24.6, z: 23.7, rot: PI, kind: 'chest', skin: 'toybox' },
    { x: 25.9, z: 16.5, rot: -PI / 2, kind: 'cupboard', skin: 'cabinet' },
    // the playground
    { x: -16.5, z: 4.5, rot: 0, kind: 'bed', skin: 'tunnel' },
    { x: -24.5, z: -3.3, rot: 0, kind: 'bed', skin: 'tunnel' },
    { x: -8.6, z: 11.0, rot: PI, kind: 'chest', skin: 'toybox' },
    // party room one
    { x: 0.5, z: 5.3, rot: PI, kind: 'bed', skin: 'table' },
    { x: 5.8, z: 1.2, rot: 0, kind: 'bed', skin: 'table' },
    { x: -1.6, z: 1.3, rot: PI / 2, kind: 'chest', skin: 'prize' },
    // party rooms two and three
    { x: 25.9, z: 1.9, rot: -PI / 2, kind: 'cupboard' },
    { x: 18.5, z: 0.4, rot: 0, kind: 'bed', skin: 'table' },
    { x: 15.0, z: 10.6, rot: PI, kind: 'chest', skin: 'toybox' },
    // the arcade graveyard
    { x: 1.8, z: -18.5, rot: -PI / 2, kind: 'locker', skin: 'arcade' },
    { x: -25.9, z: -13, rot: PI / 2, kind: 'locker', skin: 'arcade' },
    { x: -12.8, z: -15, rot: 0, kind: 'chest', skin: 'crate' },
    // prize redemption
    { x: 22.5, z: -8.0, rot: PI / 2, kind: 'chest', skin: 'prize' },
    { x: 13, z: -20.5, rot: 0, kind: 'chest', skin: 'prize' },
    { x: 25.9, z: -17, rot: -PI / 2, kind: 'cupboard', skin: 'cabinet' },
    { x: 6.5, z: -23.6, rot: 0, kind: 'locker' },
  ],
  door: { x: 0 },
  spawn: { x: 0, z: 22.3 },
  froggyStart: { x: -19, z: -15 },
  secretDoor: { z: 9.0, w: 1.6 },
  overhead: {
    catwalks: [{ x: -15, z: -23.9, w: 16, d: 1.3, y: 3.05 }],
    lockedDoors: [{ x: 16, z: -4.7, rot: 0, label: 'STAFF ONLY' }],
    signs: [
      { x: -11.65, z: 16, y: 2.75, rot: PI / 2, text: 'KITCHEN', color: '#d8f0ff' },
      { x: -17, z: 12.3, y: 3.0, rot: 0, text: 'PLAY ZONE', color: '#ff7ab0' },
      { x: 3, z: -1.35, y: 2.9, rot: PI, text: 'PARTY ROOM 1', color: '#ffd45e' },
      { x: 12.65, z: -1, y: 2.9, rot: -PI / 2, text: 'PARTY ROOM 2', color: '#b07aff' },
      { x: 12.65, z: 8.5, y: 2.9, rot: -PI / 2, text: 'PARTY ROOM 3', color: '#b07aff' },
      { x: 13, z: -12.4, y: 2.6, rot: 0, text: 'PRIZES', color: '#ffd45e' },
    ],
  },
};

// ------------------------------------------------------------ zone two
//
// THE STOCKROOMS.  In through the loading bay, the security office behind
// its glass on the left; the plant room -- generators, the boiler, pipes --
// down the left; the racking maze through the middle under its catwalk; the
// maintenance workshop on the right.

const P2 = 0x26292e;
const STOCKROOMS: RoomDef = {
  name: 'THE STOCKROOMS',
  theme: 'stores',
  halfW: 24,
  halfD: 22,
  wallH: 4.6,
  floor: 0x24262a,
  wall: 0x1b1d21,
  ceiling: 0x0d0e10,
  lights: [
    { x: -18, z: 17, color: 0x9fd4ff, intensity: 10 },
    { x: 5, z: 15, color: 0xffb45e, intensity: 12 },
    { x: -16, z: -8, color: 0xff6a3a, intensity: 11 },
    { x: 3, z: -10, color: 0x8fc0e8, intensity: 11 },
    { x: 19, z: -10, color: 0xd8f0ff, intensity: 11 },
  ],
  furniture: [
    // ---- the security office
    ...wallX(12, -24, -11.7, [[-15, 2.4]], 4.0, P2),
    ...wallZ(-12, 12.3, 22, [[18, 2.4]], 4.0, P2),
    { x: -19, z: 21.2, w: 5, d: 1.2, h: 2.4, color: 0x2a2a30, deco: 'monitors', face: PI },
    { x: -16, z: 14.3, w: 1.8, d: 0.9, h: 0.78, color: 0x6a5a44, low: true, deco: 'desk', face: 0 },
    { x: -23.3, z: 17.5, w: 0.7, d: 2.4, h: 1.3, color: 0x5a6064, low: true, deco: 'filing', face: PI / 2 },

    // ---- the plant room's wall, with two doors and a duct
    ...wallZ(-8, -22, 10, [[-12, 2.4], [3, 2.4], [-4, 1.2]], 4.0, P2),
    duct(-8, -4, 'x'),
    { x: -19.5, z: -16.5, w: 3, d: 2, h: 1.9, color: 0x3a4a3a, deco: 'generator' },
    { x: -19.5, z: -8.5, w: 3, d: 2, h: 1.9, color: 0x3a4a3a, deco: 'generator' },
    { x: -12.5, z: -19.5, w: 2.4, d: 2.4, h: 3.2, color: 0x5a4a3a, deco: 'boiler' },
    { x: -23.7, z: -6, w: 0.4, d: 24, h: 3.5, color: 0x5a4030, deco: 'pipes' },
    { x: -16, z: -21.55, w: 15, d: 0.5, h: 3.5, color: 0x5a4030, deco: 'pipes' },
    { x: -14, z: 4, w: 3, d: 1.2, h: 1.2, color: 0x3a4a3a, low: true, deco: 'workbench', face: 0 },

    // ---- the racking maze, and the catwalk along the back of it
    { x: -3.5, z: -14.5, w: 1.2, d: 8, h: 3.2, color: 0x33383f, deco: 'shelf' },
    { x: 1, z: -11.5, w: 1.2, d: 10, h: 3.2, color: 0x33383f, deco: 'shelf' },
    { x: 5.5, z: -15, w: 1.2, d: 7, h: 3.2, color: 0x33383f, deco: 'shelf' },
    { x: 10, z: -10, w: 1.2, d: 12, h: 3.2, color: 0x33383f, deco: 'shelf' },
    { x: -2, z: -4, w: 5, d: 1.2, h: 3.2, color: 0x33383f, deco: 'shelf' },
    { x: 6.5, z: 0, w: 5, d: 1.2, h: 3.2, color: 0x33383f, deco: 'shelf' },
    { x: -4.5, z: 3, w: 1.2, d: 4, h: 3.2, color: 0x33383f, deco: 'shelf' },
    { x: 2.5, z: 4.5, w: 1.2, d: 3.5, h: 3.2, color: 0x33383f, deco: 'shelf' },
    { x: 3.5, z: -21.4, w: 16, d: 1.0, h: 3.2, color: 0x33383f, deco: 'shelf' },
    { x: -6.4, z: -17.5, w: 1.2, d: 5, h: 3.2, color: 0x3a3e44, deco: 'stairs', face: 0 },

    // ---- the workshop, and the wall between it and the maze
    ...wallZ(14, -22, 6, [[-15, 2.4], [0, 2.4]], 4.0, P2),
    ...wallX(6, 14.3, 24, [[19, 2.4]], 4.0, P2),
    { x: 19.5, z: -21.1, w: 4, d: 1.1, h: 0.95, color: 0x5a3e26, low: true, deco: 'workbench', face: 0 },
    { x: 23.1, z: -8, w: 1.1, d: 3.5, h: 0.95, color: 0x5a3e26, low: true, deco: 'workbench', face: -PI / 2 },
    { x: 18, z: -9, w: 3, d: 2.5, h: 2.6, color: 0x5a5e62, deco: 'cage' },

    // ---- the loading bay: the wall across it, pallets
    ...wallX(8, -7.7, 14, [[-2, 2.4], [9, 2.4]], 4.0, P2),
    { x: 4, z: 14, w: 2.6, d: 2.2, h: 1.3, color: 0x4a3a26, low: true },
    { x: 10.5, z: 17.5, w: 2.4, d: 2.4, h: 1.8, color: 0x4a3a26 },
    { x: -6, z: 17, w: 3, d: 2, h: 1.5, color: 0x4a3a26, low: true },
    { x: 17, z: 13.5, w: 2.4, d: 2.2, h: 2.2, color: 0x4a3a26 },

    // ---- concrete pillars, floor to ceiling, holding the building up and
    // breaking the open floors into something you can put between you and him
    { x: -8.5, z: 16, w: 1.2, d: 1.2, h: 4.6, color: 0x3b4046 },
    { x: 12.5, z: 11, w: 1.2, d: 1.2, h: 4.6, color: 0x3b4046 },
    { x: 21, z: 17, w: 1.2, d: 1.2, h: 4.6, color: 0x3b4046 },
    { x: 7.5, z: -5, w: 1.2, d: 1.2, h: 4.6, color: 0x3b4046 },
    { x: 19.5, z: 2, w: 1.2, d: 1.2, h: 4.6, color: 0x3b4046 },
    { x: -15, z: -3.5, w: 1.2, d: 1.2, h: 4.6, color: 0x3b4046 },
  ],
  spots: [
    // the security office
    { x: -23.0, z: 13.6, rot: PI / 2, kind: 'locker' },
    { x: -18.5, z: 16.9, rot: 0, kind: 'bed' },
    { x: -13.4, z: 20.6, rot: -PI / 2, kind: 'cupboard', skin: 'hatch' },
    // the loading bay
    { x: 6.5, z: 20.4, rot: PI, kind: 'chest', skin: 'crate' },
    { x: -4, z: 11.2, rot: 0, kind: 'bed', skin: 'table' },
    { x: 20.7, z: 20.8, rot: PI, kind: 'locker' },
    // the plant room
    { x: -22.4, z: -1.5, rot: PI / 2, kind: 'cupboard', skin: 'cabinet' },
    { x: -14, z: -13, rot: 0, kind: 'chest', skin: 'crate' },
    { x: -16.5, z: 0.2, rot: 0, kind: 'bed', skin: 'bench' },
    // the racking maze
    { x: -1.2, z: -19.8, rot: 0, kind: 'locker' },
    { x: 3.3, z: -8.5, rot: PI / 2, kind: 'chest', skin: 'crate' },
    { x: 12.1, z: -19.8, rot: 0, kind: 'cupboard', skin: 'cabinet' },
    { x: -5.6, z: -8.5, rot: PI / 2, kind: 'chest', skin: 'prize' },
    // the workshop
    { x: 15.35, z: -13, rot: PI / 2, kind: 'locker' },
    { x: 23.0, z: 0, rot: -PI / 2, kind: 'cupboard', skin: 'cabinet' },
    { x: 19, z: -3.2, rot: 0, kind: 'bed', skin: 'bench' },
  ],
  door: { x: 0 },
  spawn: { x: 0, z: 20.2 },
  froggyStart: { x: -18, z: -12.5 },
  secretDoor: { z: 10.0, w: 1.6 },
  overhead: {
    catwalks: [{ x: 3.5, z: -21.4, w: 16, d: 1.3, y: 3.25 }],
    lockedDoors: [{ x: -24, z: -13, rot: PI / 2, label: 'PLANT' }],
    signs: [
      { x: -15, z: 11.65, y: 3.2, rot: PI, text: 'SECURITY', color: '#9fd4ff' },
      { x: -7.7, z: 3, y: 3.2, rot: PI / 2, text: 'PLANT ROOM', color: '#ff8a5a' },
      { x: 13.65, z: 0, y: 3.2, rot: -PI / 2, text: 'WORKSHOP', color: '#d8f0ff' },
      { x: 9, z: 8.3, y: 3.2, rot: 0, text: 'STOCK', color: '#ffb45e' },
    ],
  },
};

// ------------------------------------------------------------ zone three
//
// STAFF ONLY.  Reception and the break room at the front, the laundry in the
// corner; the offices -- cubicles, and the manager's office, locked -- down
// the left; the first-aid ward through the middle; the staff locker room on
// the right.

const P3 = 0x555e55;
const STAFF_ONLY: RoomDef = {
  name: 'STAFF ONLY',
  theme: 'ward',
  halfW: 29,
  halfD: 25,
  wallH: 3.8,
  floor: 0x3a3d3a,
  wall: 0x505a52,
  ceiling: 0x1a1d1a,
  lights: [
    { x: 0, z: -17, color: 0xc8ffd8, intensity: 12 },
    { x: 0, z: -2, color: 0xd8ffe8, intensity: 10 },
    { x: -20, z: -3, color: 0xd8e0ff, intensity: 10 },
    { x: 0, z: 18, color: 0xffb45e, intensity: 10 },
    { x: 19, z: 18, color: 0xffd9a0, intensity: 10 },
    { x: 19, z: -10, color: 0xc8ffd8, intensity: 10 },
  ],
  furniture: [
    // ---- across the building: the front half and the back
    ...wallX(12, -29, 29, [[-20, 2.4], [-3, 2.4], [5, 2.4], [20, 2.4]], 3.8, P3),
    // ---- the offices' wall to the ward, two doors and a duct
    ...wallZ(-10, -25, 11.7, [[-6, 2.4], [6, 2.4], [-18, 1.2]], 3.8, P3),
    duct(-10, -18, 'x'),
    // ---- the manager's office: walled up, and locked
    { x: -24.2, z: -20.3, w: 9.6, d: 9.4, h: 3.8, color: P3 },
    // cubicles
    { x: -22, z: -9, w: 8, d: 0.2, h: 1.6, color: 0x4a5a6a, deco: 'cubicle' },
    { x: -22, z: -1.5, w: 8, d: 0.2, h: 1.6, color: 0x4a5a6a, deco: 'cubicle' },
    { x: -22, z: 5.5, w: 8, d: 0.2, h: 1.6, color: 0x4a5a6a, deco: 'cubicle' },
    { x: -14.5, z: -9, w: 5, d: 0.2, h: 1.6, color: 0x4a5a6a, deco: 'cubicle' },
    { x: -14.5, z: 2, w: 5, d: 0.2, h: 1.6, color: 0x4a5a6a, deco: 'cubicle' },
    { x: -24, z: -10.2, w: 1.6, d: 0.8, h: 0.76, color: 0x6a5a44, low: true, deco: 'desk', face: PI },
    { x: -19.5, z: -10.2, w: 1.6, d: 0.8, h: 0.76, color: 0x6a5a44, low: true, deco: 'desk', face: PI },
    { x: -24, z: -0.3, w: 1.6, d: 0.8, h: 0.76, color: 0x6a5a44, low: true, deco: 'desk', face: 0 },
    { x: -19.5, z: -0.3, w: 1.6, d: 0.8, h: 0.76, color: 0x6a5a44, low: true, deco: 'desk', face: 0 },
    { x: -14.5, z: -7.8, w: 1.6, d: 0.8, h: 0.76, color: 0x6a5a44, low: true, deco: 'desk', face: 0 },
    { x: -24, z: 4.3, w: 1.6, d: 0.8, h: 0.76, color: 0x6a5a44, low: true, deco: 'desk', face: PI },
    { x: -28.3, z: -4.5, w: 0.7, d: 2.5, h: 1.3, color: 0x5a6064, low: true, deco: 'filing', face: PI / 2 },

    // ---- the ward: bays down the back, a corridor wall with two gaps, the station
    ...wallZ(-3.5, -25, -14, [], 3.8, 0x6a7368, 0.3),
    ...wallZ(3.5, -25, -14, [], 3.8, 0x6a7368, 0.3),
    ...wallX(-8, -9.7, 9.7, [[-6, 2.4], [6, 2.4]], 3.8, P3),
    { x: 0, z: 3, w: 6, d: 2, h: 1.1, color: 0x7a7266, low: true, prop: 'counter', face: PI },
    { x: -7.6, z: 9.5, w: 1.6, d: 1.0, h: 1.0, color: 0x8a8f8a, low: true },
    { x: 7.6, z: -3.5, w: 1.6, d: 1.0, h: 1.0, color: 0x8a8f8a, low: true },

    // ---- the locker room
    ...wallZ(10, -25, 11.7, [[-15, 2.4], [3, 2.4]], 3.8, P3),
    { x: 19, z: -17, w: 6, d: 0.8, h: 2.0, color: 0x5a6878, deco: 'shelf' },
    { x: 19, z: -3, w: 6, d: 0.8, h: 2.0, color: 0x5a6878, deco: 'shelf' },

    // ---- the front: reception, the break room, the laundry
    { x: 0, z: 15.5, w: 5, d: 1.1, h: 1.1, color: 0x6b4a2f, low: true, prop: 'counter', face: PI },
    { x: 27.9, z: 17.5, w: 1.0, d: 5, h: 1.0, color: 0x6e7466, low: true, deco: 'kitchen', face: -PI / 2 },
    { x: 16, z: 21.5, w: 1.6, d: 1.6, h: 0.78, color: 0xc8503a, low: true, deco: 'foodTable' },
    { x: 22, z: 21.5, w: 1.6, d: 1.6, h: 0.78, color: 0x3a8ac8, low: true, deco: 'foodTable' },
    { x: 13, z: 14.5, w: 1.3, d: 1.0, h: 2.1, color: 0x4a4258, prop: 'change', face: 0 },
    { x: -24, z: 24.1, w: 6, d: 0.8, h: 2.0, color: 0x5a6064, deco: 'shelf' },
    { x: -14.5, z: 18, w: 2.4, d: 1.2, h: 1.1, color: 0x8a9094, low: true },
  ],
  spots: [
    // the ward
    { x: -7, z: -21.8, rot: 0, kind: 'bed' },
    { x: 0, z: -21.8, rot: 0, kind: 'bed' },
    { x: 7, z: -21.8, rot: 0, kind: 'bed' },
    { x: -6, z: -11.2, rot: PI, kind: 'bed' },
    { x: 6, z: -11.2, rot: PI, kind: 'bed' },
    // the offices
    { x: -16, z: 9.4, rot: PI, kind: 'bed', skin: 'table' },
    { x: -28.0, z: 1.5, rot: PI / 2, kind: 'cupboard', skin: 'hatch' },
    { x: -12.3, z: -13, rot: -PI / 2, kind: 'chest', skin: 'crate' },
    { x: -28.0, z: 9.5, rot: PI / 2, kind: 'locker' },
    // the front
    { x: -28.0, z: 17.5, rot: PI / 2, kind: 'cupboard' },
    { x: -20, z: 20.5, rot: 0, kind: 'bed', skin: 'bench' },
    { x: -9, z: 23.7, rot: PI, kind: 'chest', skin: 'prize' },
    { x: 18.5, z: 16.5, rot: 0, kind: 'bed', skin: 'table' },
    { x: 28.0, z: 23.0, rot: -PI / 2, kind: 'cupboard', skin: 'cabinet' },
    // the locker room
    { x: 11.35, z: -21.5, rot: PI / 2, kind: 'locker' },
    { x: 11.35, z: -8.5, rot: PI / 2, kind: 'locker' },
    { x: 28.0, z: 4, rot: -PI / 2, kind: 'locker' },
    { x: 20, z: -23.6, rot: 0, kind: 'locker' },
    { x: 19, z: -10, rot: 0, kind: 'bed', skin: 'bench' },
    { x: 24, z: 9.3, rot: PI, kind: 'chest', skin: 'crate' },
  ],
  door: { x: 0 },
  spawn: { x: 0, z: 22.9 },
  froggyStart: { x: -22, z: -5.5 },
  secretDoor: { z: -10.8, w: 1.6 },
  overhead: {
    catwalks: [],
    lockedDoors: [{ x: -24.2, z: -15.55, rot: 0, label: 'MANAGER' }],
    signs: [
      { x: -20, z: 12.35, y: 2.9, rot: 0, text: 'OFFICES', color: '#d8e0ff' },
      { x: 0, z: -7.7, y: 2.9, rot: 0, text: 'FIRST AID', color: '#c8ffd8' },
      { x: 20, z: 12.35, y: 2.9, rot: 0, text: 'STAFF LOCKERS', color: '#c8ffd8' },
      { x: 0, z: 16.2, y: 2.85, rot: 0, text: 'RECEPTION', color: '#ffb45e' },
    ],
  },
};

export const LIVING_ROOM: RoomDef = PARTY_WING;
export const WAREHOUSE: RoomDef = STOCKROOMS;
export const WARD: RoomDef = STAFF_ONLY;

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
    { x: 4.67, z: 8.7, w: 2.0, d: 1.3, h: 2.1, color: 0xb9884f, prop: 'cabinet', face: Math.PI },
    { x: 8.13, z: 8.7, w: 2.0, d: 1.3, h: 2.1, color: 0x1d6f8f, prop: 'cabinet', face: Math.PI },
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
  // Nudged in off the right-hand return, and built narrow (see STAFF_DOOR_W
  // in HideRoom3D), so the architrave and the end of the counter are two
  // things with a gap between them rather than one running into the other.
  staffDoor: { x: 5.95 },
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
