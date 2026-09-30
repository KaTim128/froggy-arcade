/**
 * DRESSING THE HIDE ROOMS, so they read as places and not as boxes.
 *
 * Two kinds of thing, and neither changes the game:
 *
 *   TRIM on what is already there.  A table was a box; now it has a top that
 *   overhangs it, a darker plinth it stands on and dark edges up its corners.
 *   A partition gets a skirting board and a rail.  The collision box is the
 *   same box it always was -- the trim sits on its faces.
 *
 *   PROPS along the walls: crates and barrels, lanterns, vines coming down
 *   from the ceiling, lily pads and a puddle on the floor, a frog on a plinth,
 *   posters.  Every one of them hugs a wall inside the strip the player can
 *   never stand in (the room keeps you 0.6m off every wall), stays clear of
 *   every door and every hiding place, and blocks nothing -- so no route, no
 *   sightline and no hiding place is any different for them.
 *
 * Seeded per room, so a room is the same room every time.
 */

import * as THREE from 'three';
import type { Box, RoomDef } from './hideRooms';

export interface DressOpts {
  def: RoomDef;
  seed: number;
  /** Is there something solid in a circle of radius `r` here? */
  blocked: (x: number, z: number, r: number) => boolean;
}

const lam = (color: number) => new THREE.MeshLambertMaterial({ color });
const basic = (color: number, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });

/** A canvas texture, drawn once and shared. */
const cache = new Map<string, THREE.CanvasTexture>();
function tex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  let t = cache.get(key);
  if (t) return t;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  cache.set(key, t);
  return t;
}

/** Planks for the crates: boards, gaps between them, and a stencil. */
function crateTex(): THREE.CanvasTexture {
  return tex('crate', 64, 64, (c) => {
    c.fillStyle = '#7a5a34';
    c.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 16) {
      c.fillStyle = y % 32 ? '#6e5030' : '#84623a';
      c.fillRect(0, y, 64, 14);
      c.fillStyle = '#3a2814';
      c.fillRect(0, y + 14, 64, 2);
    }
    c.strokeStyle = '#4a3218';
    c.lineWidth = 4;
    c.strokeRect(2, 2, 60, 60);
    c.beginPath();
    c.moveTo(4, 4);
    c.lineTo(60, 60);
    c.stroke();
    // a stamped frog, faded
    c.fillStyle = 'rgba(30,70,40,0.55)';
    c.beginPath();
    c.arc(32, 36, 9, 0, Math.PI * 2);
    c.arc(26, 27, 4, 0, Math.PI * 2);
    c.arc(38, 27, 4, 0, Math.PI * 2);
    c.fill();
  });
}

/** A faded poster: FROGGY, a grin, and a corner coming away. */
function posterTex(i: number): THREE.CanvasTexture {
  return tex(`poster${i}`, 48, 64, (c) => {
    const hues = ['#3a6e4a', '#6a3a5a', '#3a4e6e'];
    c.fillStyle = hues[i % hues.length];
    c.fillRect(0, 0, 48, 64);
    c.fillStyle = 'rgba(255,240,200,0.18)';
    c.fillRect(3, 3, 42, 58);
    // the frog
    c.fillStyle = '#5fc457';
    c.beginPath();
    c.arc(24, 30, 13, 0, Math.PI * 2);
    c.fill();
    for (const ex of [16, 32]) {
      c.fillStyle = '#5fc457';
      c.beginPath();
      c.arc(ex, 19, 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f4ecd8';
      c.beginPath();
      c.arc(ex, 19, 4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#111';
      c.fillRect(ex - 1, 18, 2, 2);
    }
    c.fillStyle = '#2a1a20';
    c.fillRect(16, 35, 16, 2);
    // FROGGY across the bottom, blocky
    c.fillStyle = '#ffd45e';
    c.fillRect(8, 50, 32, 6);
    c.fillStyle = hues[i % hues.length];
    for (let k = 0; k < 6; k++) c.fillRect(10 + k * 5, 52, 2, 2);
    // water damage and a torn corner
    c.fillStyle = 'rgba(40,30,20,0.35)';
    c.beginPath();
    c.ellipse(36, 12, 10, 7, 0.4, 0, Math.PI * 2);
    c.fill();
    c.clearRect(40, 56, 8, 8);
  });
}

/** A lily pad, from above: a disc with its notch and its veins. */
function padTex(): THREE.CanvasTexture {
  return tex('lilypad', 32, 32, (c) => {
    c.fillStyle = '#2f7a3a';
    c.beginPath();
    c.moveTo(16, 16);
    c.arc(16, 16, 15, -Math.PI / 2 + 0.35, Math.PI * 1.5 - 0.35);
    c.closePath();
    c.fill();
    c.strokeStyle = '#1f5a2a';
    c.lineWidth = 1;
    for (let a = 0; a < 7; a++) {
      const ang = -Math.PI / 2 + 0.6 + a * 0.75;
      c.beginPath();
      c.moveTo(16, 16);
      c.lineTo(16 + Math.cos(ang) * 13, 16 + Math.sin(ang) * 13);
      c.stroke();
    }
    c.fillStyle = 'rgba(160,220,140,0.25)';
    c.beginPath();
    c.ellipse(12, 12, 5, 3, -0.6, 0, Math.PI * 2);
    c.fill();
  });
}

// ------------------------------------------------------------------ trim

/**
 * A top that overhangs, a plinth to stand on, dark corner edges.  On the
 * faces of the box, never outside its footprint by more than a couple of
 * centimetres, so nothing walks into what it did not walk into before.
 */
export function trimFurniture(parent: THREE.Object3D, f: Box): void {
  if (f.h < 0.2) return;
  const tone = new THREE.Color(f.color);
  const top = lam(tone.clone().multiplyScalar(1.18).getHex());
  const base = lam(tone.clone().multiplyScalar(0.55).getHex());
  const edge = lam(tone.clone().multiplyScalar(0.4).getHex());
  const add = (m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
  };
  add(top, f.w + 0.04, 0.05, f.d + 0.04, f.x, f.h + 0.02, f.z);
  add(base, f.w + 0.02, 0.09, f.d + 0.02, f.x, 0.045, f.z);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) add(edge, 0.03, f.h - 0.1, 0.03, f.x + sx * (f.w / 2), f.h / 2, f.z + sz * (f.d / 2));
  }
}

/** A partition: a skirting board and a rail along both long faces. */
export function trimPartition(parent: THREE.Object3D, f: Box): void {
  const skirt = lam(0x2a2018);
  const rail = lam(0x4a3a2a);
  const long = f.w >= f.d;
  for (const s of [-1, 1]) {
    const px = long ? f.x : f.x + s * (f.w / 2 + 0.012);
    const pz = long ? f.z + s * (f.d / 2 + 0.012) : f.z;
    const w = long ? f.w : 0.025;
    const d = long ? 0.025 : f.d;
    for (const [y, h, m] of [[0.07, 0.14, skirt], [1.0, 0.05, rail]] as const) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(px, y, pz);
      parent.add(mesh);
    }
  }
}

// ------------------------------------------------------------------ props

type Wall = 'n' | 's' | 'e' | 'w';

/**
 * Put the room's props round its walls.  Returns the group, already in the
 * scene, so a room can take it away again.
 */
export function furnishWalls(scene: THREE.Scene, o: DressOpts): THREE.Group {
  const d = o.def;
  const g = new THREE.Group();
  g.name = 'dressing';
  scene.add(g);
  let s = (o.seed * 2654435761) >>> 0 || 1;
  const rnd = () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return (s >>> 8) / 16777216;
  };
  const arcade = d.theme === 'arcade';

  // ---- where a prop may NOT go: doors, openings, and near a hiding place.
  const nearDoor = (w: Wall, along: number): boolean => {
    if (w === 's') {
      const half = d.glassDoor ? d.glassDoor.w / 2 + 0.9 : 1.5;
      return Math.abs(along - d.door.x) < half;
    }
    if (w === 'n' && d.staffDoor) return Math.abs(along - d.staffDoor.x) < 1.3;
    if (w === 'e' && d.secretDoor) return Math.abs(along - d.secretDoor.z) < d.secretDoor.w / 2 + 0.8;
    if (d.wallOpening) {
      const side: Wall = d.wallOpening.side === 'left' ? 'w' : 'e';
      if (w === side && Math.abs(along - d.wallOpening.z) < d.wallOpening.w / 2 + 0.7) return true;
    }
    return false;
  };
  const nearSpot = (x: number, z: number): boolean =>
    d.spots.some((sp) => Math.hypot(sp.x - x, sp.z - z) < 1.7);

  /** A point `off` metres in from wall `w`, `along` it. */
  const at = (w: Wall, along: number, off: number): { x: number; z: number; face: number } => {
    switch (w) {
      case 'n':
        return { x: along, z: -d.halfD + off, face: 0 };
      case 's':
        return { x: along, z: d.halfD - off, face: Math.PI };
      case 'w':
        return { x: -d.halfW + off, z: along, face: Math.PI / 2 };
      default:
        return { x: d.halfW - off, z: along, face: -Math.PI / 2 };
    }
  };

  // ---- shared parts
  const crateMat = new THREE.MeshLambertMaterial({ map: crateTex() });
  const crateGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
  const barrelGeo = new THREE.CylinderGeometry(0.19, 0.2, 0.6, 12);
  const barrelMat = lam(0x6a4424);
  const hoopMat = lam(0x3a3d42);
  const hoopGeo = new THREE.CylinderGeometry(0.205, 0.205, 0.035, 12, 1, true);
  const vineMat = lam(0x2f6a34);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8a3e, side: THREE.DoubleSide });
  const padMat = new THREE.MeshLambertMaterial({ map: padTex(), transparent: true, alphaTest: 0.5 });
  const lanternGlass = basic(0xffb65a);
  const lanternFrame = lam(0x2a2620);
  const glowMat = basic(0xffb65a, 0.16);

  const crate = (x: number, z: number, face: number, stack: boolean) => {
    const c = new THREE.Mesh(crateGeo, crateMat);
    c.position.set(x, 0.21, z);
    c.rotation.y = face + (rnd() - 0.5) * 0.3;
    g.add(c);
    if (stack) {
      const c2 = new THREE.Mesh(crateGeo, crateMat);
      c2.position.set(x + (rnd() - 0.5) * 0.06, 0.63, z + (rnd() - 0.5) * 0.06);
      c2.rotation.y = face + (rnd() - 0.5) * 0.6;
      c2.scale.setScalar(0.85);
      g.add(c2);
    }
  };
  const barrel = (x: number, z: number) => {
    const b = new THREE.Mesh(barrelGeo, barrelMat);
    b.position.set(x, 0.3, z);
    g.add(b);
    for (const y of [0.1, 0.5]) {
      const h = new THREE.Mesh(hoopGeo, hoopMat);
      h.position.set(x, y, z);
      g.add(h);
    }
    const lid = new THREE.Mesh(new THREE.CircleGeometry(0.19, 12), lam(0x4a3018));
    lid.rotation.x = -Math.PI / 2;
    lid.position.set(x, 0.601, z);
    g.add(lid);
  };
  const frogStatue = (x: number, z: number, face: number) => {
    const grp = new THREE.Group();
    grp.position.set(x, 0, z);
    grp.rotation.y = face;
    const stone = lam(0x6a6e66);
    const moss = lam(0x3f6a3a);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), stone);
    plinth.position.y = 0.15;
    grp.add(plinth);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), moss);
    body.scale.set(1.1, 0.8, 1);
    body.position.y = 0.42;
    grp.add(body);
    for (const ex of [-0.07, 0.07]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), moss);
      eye.position.set(ex, 0.54, 0.06);
      grp.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), basic(0x111111));
      pupil.position.set(ex, 0.55, 0.105);
      grp.add(pupil);
    }
    g.add(grp);
  };
  const lantern = (x: number, z: number, face: number) => {
    const grp = new THREE.Group();
    grp.position.set(x, 2.0, z);
    grp.rotation.y = face;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.2), lanternFrame);
    arm.position.set(0, 0.12, 0.1);
    grp.add(arm);
    const cage = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.14), lanternFrame);
    cage.position.set(0, 0, 0.2);
    grp.add(cage);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.15), lanternGlass);
    glass.position.set(0, 0, 0.2);
    grp.add(glass);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.08, 4), lanternFrame);
    cap.position.set(0, 0.14, 0.2);
    cap.rotation.y = Math.PI / 4;
    grp.add(cap);
    // a soft halo on the wall behind it, which is all the light it gives
    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), glowMat);
    halo.position.set(0, 0, 0.012);
    grp.add(halo);
    g.add(grp);
  };
  const vine = (x: number, z: number, face: number) => {
    const grp = new THREE.Group();
    grp.position.set(x, 0, z);
    grp.rotation.y = face;
    const len = 1.0 + rnd() * 1.1;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      pts.push(new THREE.Vector3(Math.sin(t * 5 + rnd()) * 0.08, d.wallH - t * len, 0.04 + Math.sin(t * 3) * 0.03));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.014, 5, false), vineMat));
    for (let k = 0; k < 7; k++) {
      const p = curve.getPoint(0.1 + k * 0.13);
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.06), leafMat);
      leaf.position.copy(p).add(new THREE.Vector3(k % 2 ? 0.04 : -0.04, 0, 0.02));
      leaf.rotation.set(-0.3, k % 2 ? 0.6 : -0.6, k % 2 ? 0.5 : -0.5);
      grp.add(leaf);
    }
    g.add(grp);
  };
  const pads = (x: number, z: number) => {
    const n = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34 + rnd() * 0.2, 0.34 + rnd() * 0.2), padMat);
      p.rotation.set(-Math.PI / 2, 0, rnd() * Math.PI * 2);
      p.position.set(x + (rnd() - 0.5) * 0.7, 0.006 + k * 0.001, z + (rnd() - 0.5) * 0.7);
      g.add(p);
    }
    // and the water they are sitting in
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), basic(0x1f3a3a, 0.55));
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.set(1.3, 1, 1);
    puddle.position.set(x, 0.004, z);
    g.add(puddle);
  };
  const poster = (x: number, z: number, face: number, i: number) => {
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.8),
      new THREE.MeshLambertMaterial({ map: posterTex(i), transparent: true }),
    );
    p.position.set(x, 1.55 + (rnd() - 0.5) * 0.2, z);
    p.rotation.set(0, face, (rnd() - 0.5) * 0.12);
    g.add(p);
  };

  // ---- walk each wall and dress it
  const walls: Array<[Wall, number]> = [
    ['n', d.halfW],
    ['s', d.halfW],
    ['w', d.halfD],
    ['e', d.halfD],
  ];
  let posterN = 0;
  for (const [w, half] of walls) {
    for (let along = -half + 1.1; along < half - 1.1; along += 1.6 + rnd() * 1.2) {
      if (nearDoor(w, along)) continue;
      const roll = rnd();
      // things on the wall: lanterns, vines, posters -- no footprint at all
      if (roll < 0.16) {
        const p = at(w, along, 0.02);
        lantern(p.x, p.z, p.face);
        continue;
      }
      if (roll < 0.3 && !arcade) {
        const p = at(w, along, 0.02);
        vine(p.x, p.z, p.face);
        continue;
      }
      if (roll < 0.4) {
        const p = at(w, along, 0.015);
        poster(p.x, p.z, p.face, posterN++);
        continue;
      }
      // things on the floor, tight to the wall
      if (roll < 0.62) {
        const p = at(w, along, 0.24);
        if (nearSpot(p.x, p.z) || o.blocked(p.x, p.z, 0.26)) continue;
        crate(p.x, p.z, p.face, rnd() < 0.4);
        continue;
      }
      if (roll < 0.78 && !arcade) {
        const p = at(w, along, 0.22);
        if (nearSpot(p.x, p.z) || o.blocked(p.x, p.z, 0.22)) continue;
        barrel(p.x, p.z);
        continue;
      }
      if (roll < 0.86) {
        const p = at(w, along, 0.2);
        if (nearSpot(p.x, p.z) || o.blocked(p.x, p.z, 0.2)) continue;
        frogStatue(p.x, p.z, p.face);
        continue;
      }
      if (!arcade) {
        const p = at(w, along, 0.45);
        if (o.blocked(p.x, p.z, 0.3)) continue;
        pads(p.x, p.z);
      }
    }
  }
  return g;
}
