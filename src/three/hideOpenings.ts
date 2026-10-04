/**
 * THE INSIDE OF A HIDING PLACE, FROM INSIDE IT.
 *
 * Hiding used to park the camera just outside the opening and paint what the
 * box looks like from inside as a flat picture over the screen -- which moved
 * with the view, like a mask, and at its narrowest (under a table, a hem a
 * hand high) left almost nothing to see through.
 *
 * This is the box built from inside instead: its walls, its ceiling and, in
 * front of your eye, the face you are looking out through -- with the opening
 * CUT INTO IT, the real size and the real place.  It is fixed to the hiding
 * place, so turning your head moves the opening across the view the way it
 * would, and leaning to one side of a slot shows you more of the room on the
 * other.  The openings are generous: slots you can follow him through, a
 * cloth held up off the floor, a lid propped on your fingers.
 *
 * All of it is unlit and dark (it is the inside of a box, and the lamp you
 * carry must not turn it into a white wall a hand's width from your eye),
 * with a pale line along each edge of the opening where the room's light
 * catches it.  It is only shown while you are in there; the outside of the
 * box is hidden for that time instead, since you are inside it.
 *
 * It is fixed to the hiding place itself, never to the door that swings on
 * it: the eye is placed in the same space, so nothing in front of it can
 * move a millimetre the eye does not.  The face stops where the walls do (a
 * hair past, so the corners close), so no part of it reaches into the
 * furniture or wall either side; and it is drawn from both sides, so the
 * moment the eye passes through the opening on the way in it is already a
 * solid face and not a flicker of the room behind it.
 */

import * as THREE from 'three';
import type { SpotKind, SpotSkin } from './hideRooms';

/** A hole in the face: x0..x1 across, y0..y1 up, in the spot's own space. */
interface Hole {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** The box round the eye, in the spot's own space, and the face you look out of. */
interface Plan {
  /** inner walls */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  /** the face, at z = face, with its holes */
  face: number;
  holes: Hole[];
  /** the face may reach wider and taller than the walls (a bed's side rail, a tablecloth) */
  fx0?: number;
  fx1?: number;
  fy0?: number;
  fy1?: number;
  color: number;
  edge: number;
  /** No floor panel: under a bed or a table the floor is the room's own. */
  openFloor?: boolean;
}

/** Where the eye sits, in the spot's own space, for each kind of place. */
export interface HideEye {
  x: number;
  y: number;
  z: number;
}

const cache = new Map<number, THREE.CanvasTexture>();
/** A little grain, so a wall a hand away is a surface and not a void. */
function grain(color: number): THREE.CanvasTexture {
  let t = cache.get(color);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const x = c.getContext('2d')!;
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 180; i++) {
    const v = 200 + Math.floor(Math.random() * 55);
    x.fillStyle = `rgb(${v},${v},${v})`;
    x.fillRect(Math.floor(Math.random() * 32), Math.floor(Math.random() * 32), 1 + Math.floor(Math.random() * 2), 1);
  }
  t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.magFilter = THREE.NearestFilter;
  cache.set(color, t);
  return t;
}

const slots = (cy: number, n: number, pitch: number, tall: number, half: number): Hole[] =>
  Array.from({ length: n }, (_, i) => {
    const y = cy + (i - (n - 1) / 2) * pitch;
    return { x0: -half, x1: half, y0: y - tall / 2, y1: y + tall / 2 };
  });

/**
 * Where your eye goes in each place, in its own space (a chest's is scaled
 * with it, so these are before that).  A hand's width behind the face, at the
 * height of the opening.
 */
export function hideEye(kind: SpotKind, skin: SpotSkin | undefined): HideEye {
  switch (kind) {
    case 'locker':
      return { x: 0, y: 1.52, z: 0.27 };
    case 'cupboard':
      return { x: 0, y: 1.32, z: 0.27 };
    case 'chest':
      // at the lid seam; a crate's gaps are lower down its boards
      return skin === 'crate' ? { x: 0, y: 0.53, z: 0.29 } : { x: 0, y: 0.66, z: 0.29 };
    case 'bed':
      // Lying further in under it, not with your face on the hem: from a
      // hand's width behind it, the gap filled the whole picture and there was
      // nothing of the bed or the cloth to say you were under anything.  From
      // here the hem frames a strip of floor and the room beyond it -- and
      // there is room to turn your head round.
      return skin === 'tunnel'
        ? { x: 0, y: 0.4, z: 0.38 }
        : skin === 'table'
          ? { x: 0, y: 0.17, z: 0.1 }
          : { x: 0, y: 0.22, z: 0.12 };
  }
}

function plan(kind: SpotKind, skin: SpotSkin | undefined, eye: HideEye): Plan {
  const steel = { color: 0x1b1f24, edge: 0x353c44 };
  const wood = { color: 0x1c140d, edge: 0x3e3022 };
  const cloth = { color: 0x1c1915, edge: 0x3a342a };
  if (kind === 'locker' || kind === 'cupboard') {
    const tall = kind === 'locker' || skin === 'arcade';
    const w = tall ? 0.9 : 1.2;
    const h = tall ? 2.0 : 1.8;
    const base = { x0: -w / 2 + 0.05, x1: w / 2 - 0.05, y0: 0.08, y1: h - 0.08, z0: -0.33, face: 0.4 };
    if (skin === 'arcade') {
      // the machine's dead screen, gone: a ragged window at eye height
      return { ...base, ...steel, color: 0x111114, holes: [{ x0: -0.14, x1: 0.14, y0: eye.y - 0.07, y1: eye.y + 0.08 }] };
    }
    if (kind === 'locker') {
      // five vent slots across the door at eye height, the eye level with the
      // middle one; the bars between them are solid steel, not hairlines
      return { ...base, ...steel, holes: slots(eye.y, 5, 0.05, 0.032, 0.15) };
    }
    if (skin === 'cabinet' || skin === 'hatch') {
      // louvres, five of them, a little wider than a locker's
      return { ...base, ...steel, holes: slots(eye.y, 5, 0.048, 0.03, 0.16) };
    }
    // a wardrobe: the two doors not quite met, a crack the height of them
    return { ...base, ...wood, holes: [{ x0: -0.08, x1: 0.08, y0: 0.2, y1: h - 0.14 }] };
  }
  if (kind === 'chest') {
    const base = { x0: -0.5, x1: 0.5, y0: 0.1, y1: 0.74, z0: -0.35, face: 0.4 };
    if (skin === 'crate') {
      // the gaps between the boards
      return { ...base, ...wood, holes: [{ x0: -0.48, x1: 0.48, y0: 0.46, y1: 0.505 }, { x0: -0.48, x1: 0.48, y0: 0.55, y1: 0.6 }] };
    }
    const tint = skin === 'prize' ? { color: 0x221620, edge: 0x7a5064 } : skin === 'toybox' ? { color: 0x101a2a, edge: 0x4a6488 } : wood;
    // the lid held up off the rim on your fingers
    return { ...base, ...tint, holes: [{ x0: -0.46, x1: 0.46, y0: 0.62, y1: 0.72 }] };
  }
  // ---- under something
  if (skin === 'tunnel') {
    // the flap strips parted in front of you, and hairline gaps between the rest
    const holes: Hole[] = [{ x0: -0.14, x1: 0.14, y0: 0.14, y1: 0.5 }];
    for (const s of [-1, 1]) for (const x of [0.4, 0.66, 0.92]) holes.push({ x0: s * x - 0.012, x1: s * x + 0.012, y0: 0.22, y1: 0.92 });
    return { x0: -1.12, x1: 1.12, y0: 0.08, y1: 1.0, z0: -0.45, face: 0.5, holes, color: 0x2a100c, edge: 0x7a3a2c };
  }
  if (skin === 'table' || skin === 'bench') {
    const top = skin === 'table' ? 0.78 : 0.58;
    // (the table's cloth held up a hand's height to peek under, not raised
    // like a curtain: the gap is the view, and a gap the height of the room
    // was not hiding anything)
    const lift = skin === 'table' ? 0.24 : 0.33;
    const half = skin === 'table' ? 0.5 : 0.45;
    // the cloth held up in front of you; along the rest, the gap under its hem
    return {
      x0: -1.12, x1: 1.12, y0: 0, y1: top - 0.03, z0: -0.5, face: 0.51, openFloor: true,
      holes: [
        { x0: -half, x1: half, y0: 0.003, y1: lift },
        { x0: -1.08, x1: -half - 0.04, y0: 0.003, y1: 0.1 },
        { x0: half + 0.04, x1: 1.08, y0: 0.003, y1: 0.1 },
      ],
      ...cloth,
    };
  }
  // A bed: its whole long side is open under the blanket where it hangs
  // over the edge, between the legs.
  return {
    x0: -1.14, x1: 1.14, y0: 0, y1: 0.47, z0: -0.5, face: 0.5, fy1: 0.62, openFloor: true,
    holes: [{ x0: -1.08, x1: 1.08, y0: 0.003, y1: 0.33 }],
    color: 0x16130f, edge: 0x5a5244,
  };
}

/** A flat panel, facing +z unless turned. */
function panel(g: THREE.Group, mat: THREE.Material, w: number, h: number, x: number, y: number, z: number, ry = 0, rx = 0): void {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, 0);
  g.add(m);
}

/**
 * Build the inside of `kind` (dressed as `skin`) in the spot's own space,
 * around `eye`.  Hidden until someone is in it.
 */
export function buildOpening(kind: SpotKind, skin: SpotSkin | undefined, eye: HideEye): THREE.Group {
  const p = plan(kind, skin, eye);
  const g = new THREE.Group();
  g.name = 'hide-inside';
  const wall = new THREE.MeshBasicMaterial({ color: p.color, map: grain(p.color), side: THREE.DoubleSide });
  const edge = new THREE.MeshBasicMaterial({ color: p.edge, side: THREE.DoubleSide });

  // ---- THE FACE: a panel with the openings cut out of it, facing in.
  // (only just past the walls: from inside the walls hide anything wider, and
  // anything wider stood into the next locker along, flush with its door)
  const fx0 = p.fx0 ?? p.x0 - 0.01;
  const fx1 = p.fx1 ?? p.x1 + 0.01;
  const fy0 = p.fy0 ?? Math.max(0, p.y0 - 0.01);
  const fy1 = p.fy1 ?? p.y1 + 0.01;
  // (built mirrored in x and turned half round, so its front faces the eye)
  const shape = new THREE.Shape();
  shape.moveTo(-fx1, fy0);
  shape.lineTo(-fx0, fy0);
  shape.lineTo(-fx0, fy1);
  shape.lineTo(-fx1, fy1);
  shape.closePath();
  for (const h of p.holes) {
    const hole = new THREE.Path();
    hole.moveTo(-h.x1, h.y0);
    hole.lineTo(-h.x1, h.y1);
    hole.lineTo(-h.x0, h.y1);
    hole.lineTo(-h.x0, h.y0);
    hole.closePath();
    shape.holes.push(hole);
  }
  const face = new THREE.Mesh(new THREE.ShapeGeometry(shape), wall);
  face.rotation.y = Math.PI;
  face.position.z = p.face;
  g.add(face);
  // the lit edges of each opening: a thin pale line just inside it
  const t = 0.003;
  for (const h of p.holes) {
    const z = p.face - 0.005;
    const w = h.x1 - h.x0;
    const hh = h.y1 - h.y0;
    panel(g, edge, w, t, (h.x0 + h.x1) / 2, h.y1 - t / 2, z, Math.PI);
    if (h.y0 > 0.01) panel(g, edge, w, t, (h.x0 + h.x1) / 2, h.y0 + t / 2, z, Math.PI);
    if (hh > 0.06) {
      panel(g, edge, t, hh, h.x0 + t / 2, (h.y0 + h.y1) / 2, z, Math.PI);
      panel(g, edge, t, hh, h.x1 - t / 2, (h.y0 + h.y1) / 2, z, Math.PI);
    }
  }

  // ---- THE REST OF THE BOX round you: sides, back, ceiling, and a floor
  // unless the floor is the room's.
  const wx = p.x1 - p.x0;
  const hy = p.y1 - p.y0;
  const dz = p.face - p.z0;
  const cx = (p.x0 + p.x1) / 2;
  const cy = (p.y0 + p.y1) / 2;
  const cz = (p.face + p.z0) / 2;
  panel(g, wall, wx, hy, cx, cy, p.z0, 0);
  panel(g, wall, dz, hy, p.x0, cy, cz, Math.PI / 2);
  panel(g, wall, dz, hy, p.x1, cy, cz, -Math.PI / 2);
  panel(g, wall, wx, dz, cx, p.y1, cz, 0, Math.PI / 2);
  if (!p.openFloor) panel(g, wall, wx, dz, cx, p.y0, cz, 0, -Math.PI / 2);
  g.visible = false;
  // where the face is, for whoever has to know which side of it the eye is on
  g.userData.face = p.face;
  return g;
}
