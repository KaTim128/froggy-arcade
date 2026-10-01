/**
 * THE ROOM, IN MINIATURE, UNDER THE GLASS.
 *
 * It was the room as a set of plain boxes: every wall, cupboard and bed the
 * same slab of colour, every hiding place the same grey cube whatever it
 * really was, and nothing to say where anything was except the thing moving
 * among them.  This is a scale model of it instead -- an architect's model,
 * the kind you lean over -- built from the same RoomDef the hunt is running:
 *
 *   - the walls, inside and out, as walls: cut to a height you can see over,
 *     capped with a pale edge so the plan of the room reads from above, with
 *     their doorways and openings left open;
 *   - the furniture in its own colours, each piece with a top;
 *   - every hiding place as what it is -- a bed, a chest, a locker, a
 *     wardrobe -- at its real size and facing, with a gold ring round it on
 *     the floor, and its lid or door opening when the real one does;
 *   - the door he locked, the way you came in through the wall, and the name
 *     of each area painted on the floor;
 *   - and HIM, marked: a red ring under his feet and a thin red beam up to
 *     the glass, so from anywhere on the gallery you can find him at a glance.
 *
 * He is the room's own Froggy, drawn a second time (see secretRoom `watch`):
 * the marker follows the model, the model follows the hunt, and the hunt is
 * the real one.
 */

import * as THREE from 'three';
import type { HideSpot, RoomDef } from './hideRooms';
import { spotExtent } from './navGrid';

export interface Miniature {
  /** Ease the lids and doors toward how open the real ones are. */
  setLids(open: number[], dt: number): void;
  /** Put the marker under him (room coordinates) and pulse it. */
  mark(x: number, z: number, t: number): void;
  /** How far open each lid is, for the harness. */
  lids(): number[];
  /** How many pieces the model is made of. */
  pieces(): number;
}

/** Hiding places, by what they are dressed as: bright enough to find from the gallery. */
const SKIN_COLOR: Record<string, number> = {
  crate: 0x9a7440,
  prize: 0xd9a93a,
  toybox: 0xd05a8a,
  cabinet: 0x7f93a3,
  hatch: 0x70828e,
  arcade: 0x7a55c8,
  table: 0xa8845a,
  bench: 0x8c7a60,
  tunnel: 0xe0683c,
};
const KIND_COLOR: Record<HideSpot['kind'], number> = {
  chest: 0x9a6232,
  locker: 0x5f86aa,
  cupboard: 0x8a6440,
  bed: 0x7a55a0,
};

/** Wall height in the model, in room metres: low enough to see over from the gallery. */
const MODEL_WALL = 2.3;

export function buildMiniature(pen: THREE.Group, def: RoomDef, mezzY: number, k: number): Miniature {
  const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c });
  const lit = (c: number, opacity = 1) =>
    new THREE.MeshBasicMaterial({ color: c, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  const mats = new Map<number, THREE.MeshLambertMaterial>();
  const mat = (c: number) => {
    let m = mats.get(c);
    if (!m) mats.set(c, (m = lam(c)));
    return m;
  };
  const shade = (c: number, f: number) => new THREE.Color(c).multiplyScalar(f).getHex();
  const tint = (c: number, f: number) => new THREE.Color(c).lerp(new THREE.Color(0xffffff), f).getHex();

  /** A block, footprint-centred, base on `y`, turned by `rot`. */
  const block = (color: number, w: number, h: number, d: number, x: number, z: number, y = 0, rot = 0): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y + h / 2, z);
    m.rotation.y = rot;
    pen.add(m);
    return m;
  };

  // ---- the floor, with a faint metre grid over it like a plan
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(def.halfW * 2, def.halfD * 2), lam(def.floor));
  floor.rotation.x = -Math.PI / 2;
  pen.add(floor);
  {
    const pts: number[] = [];
    for (let x = -def.halfW; x <= def.halfW + 1e-6; x += 2) pts.push(x, 0.02, -def.halfD, x, 0.02, def.halfD);
    for (let z = -def.halfD; z <= def.halfD + 1e-6; z += 2) pts.push(-def.halfW, 0.02, z, def.halfW, 0.02, z);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    pen.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 })));
  }

  // ---- WALLS.  Low, and capped with a pale edge, so from above the room is
  // a plan: every wall a clear line, every doorway a clear gap.
  const wallC = tint(def.wall, 0.12);
  const capC = tint(def.wall, 0.55);
  const wallRun = (x: number, z: number, w: number, d: number): void => {
    if (w <= 0.01 || d <= 0.01) return;
    block(wallC, w, MODEL_WALL, d, x, z);
    block(capC, w + 0.04, 0.12, d + 0.04, x, z, MODEL_WALL);
  };
  /** A wall along x at `z` from x0 to x1 with gaps [a, b] left open. */
  const wallAlongX = (z: number, x0: number, x1: number, gaps: Array<[number, number]>): void => {
    let from = x0;
    for (const [a, b] of gaps.sort((p, q) => p[0] - q[0])) {
      wallRun((from + a) / 2, z, a - from, 0.5);
      from = b;
    }
    wallRun((from + x1) / 2, z, x1 - from, 0.5);
  };
  const wallAlongZ = (x: number, z0: number, z1: number, gaps: Array<[number, number]>): void => {
    let from = z0;
    for (const [a, b] of gaps.sort((p, q) => p[0] - q[0])) {
      wallRun(x, (from + a) / 2, 0.5, a - from);
      from = b;
    }
    wallRun(x, (from + z1) / 2, 0.5, z1 - from);
  };
  const W = def.halfW + 0.25;
  const D = def.halfD + 0.25;
  // the back wall, with the staff door if there is one
  wallAlongX(-D, -W, W, def.staffDoor ? [[def.staffDoor.x - 0.8, def.staffDoor.x + 0.8]] : []);
  // the front wall, with the door he locked in it
  const doorW = def.glassDoor ? def.glassDoor.w : 2.2;
  wallAlongX(D, -W, W, [[def.door.x - doorW / 2, def.door.x + doorW / 2]]);
  // the sides, with their openings, and the stretch of wall you walked through
  const sideGaps = (side: 'left' | 'right'): Array<[number, number]> => {
    const g: Array<[number, number]> = (def.wallOpenings ?? []).filter((o) => o.side === side).map((o) => [o.z - o.w / 2, o.z + o.w / 2]);
    if (side === 'right' && def.secretDoor) g.push([def.secretDoor.z - def.secretDoor.w / 2, def.secretDoor.z + def.secretDoor.w / 2]);
    return g;
  };
  wallAlongZ(-W, -D, D, sideGaps('left'));
  wallAlongZ(W, -D, D, sideGaps('right'));

  // THE DOOR HE LOCKED: shut in its gap, dark, with a red lamp over it.
  block(0x2b2119, doorW, MODEL_WALL * 0.9, 0.3, def.door.x, def.halfD + 0.1);
  const doorLamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.3), lit(0xff3040));
  doorLamp.position.set(def.door.x, MODEL_WALL + 0.3, def.halfD + 0.1);
  pen.add(doorLamp);
  // The way you came in: the gap in the right-hand wall, lit green along its sill.
  if (def.secretDoor) {
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, def.secretDoor.w), lit(0x3fe39b));
    sill.position.set(def.halfW + 0.2, 0.05, def.secretDoor.z);
    pen.add(sill);
  }

  // ---- FURNITURE.  Full-height pieces inside the room are its partitions and
  // are drawn as walls; the rest in their own colours, each with a lighter top.
  for (const f of def.furniture) {
    if (f.crawl) continue; // (the ducts are in the walls, grilled shut)
    const tall = !f.low && f.h >= Math.min(def.wallH - 0.4, 3.0);
    if (tall) {
      wallRun(f.x, f.z, f.w, f.d);
      continue;
    }
    const h = Math.min(f.h, MODEL_WALL - 0.1);
    block(shade(f.color, 0.85), f.w, h, f.d, f.x, f.z);
    block(tint(f.color, 0.18), f.w * 0.96, 0.06, f.d * 0.96, f.x, f.z, h);
  }

  // ---- THE HIDING PLACES, as what they are.
  const gold = lit(0xffd45e, 0.55);
  const moving: Array<{ pivot: THREE.Object3D; axis: 'x' | 'y'; sign: number; max: number; open: number }> = [];
  for (const s of def.spots) {
    const e = spotExtent(s);
    // the footprint as built, before its turn
    const turned = Math.abs(Math.sin(s.rot)) > 0.5;
    const w = (turned ? e.hd : e.hw) * 2;
    const d = (turned ? e.hw : e.hd) * 2;
    const c = (s.skin && SKIN_COLOR[s.skin]) ?? KIND_COLOR[s.kind];
    const g = new THREE.Group();
    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.rot;
    pen.add(g);
    const part = (color: number, pw: number, ph: number, pd: number, x: number, y: number, z: number): THREE.Mesh => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), mat(color));
      m.position.set(x, y + ph / 2, z);
      g.add(m);
      return m;
    };
    if (s.kind === 'bed') {
      // frame, mattress, pillow, and a blanket turned down
      part(shade(c, 0.7), w, 0.42, d, 0, 0, 0);
      part(0xe8e2d0, w * 0.94, 0.14, d * 0.9, 0, 0.42, 0);
      part(0xf4f0e6, w * 0.22, 0.12, d * 0.7, -w * 0.36, 0.56, 0);
      part(c, w * 0.6, 0.08, d * 0.92, w * 0.16, 0.56, 0);
      moving.push({ pivot: new THREE.Object3D(), axis: 'x', sign: 1, max: 0, open: 0 });
    } else if (s.kind === 'chest') {
      part(shade(c, 0.8), w, 0.7, d, 0, 0, 0);
      part(0x2a2018, w * 1.02, 0.08, 0.06, 0, 0.35, d / 2);
      // the lid, hinged along the back
      const hinge = new THREE.Group();
      hinge.position.set(0, 0.7, -d / 2);
      g.add(hinge);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.14, d * 1.04), mat(tint(c, 0.12)));
      lid.position.set(0, 0.07, d / 2);
      hinge.add(lid);
      moving.push({ pivot: hinge, axis: 'x', sign: -1, max: 1.3, open: 0 });
    } else {
      // a locker or a wardrobe: tall, a door on the front hinged at one side
      const h = s.kind === 'locker' ? 1.95 : 1.85;
      part(shade(c, 0.78), w, h, d, 0, 0, 0);
      part(tint(c, 0.3), w * 1.02, 0.08, d * 1.02, 0, h, 0);
      const hinge = new THREE.Group();
      hinge.position.set(-w / 2, 0, d / 2 + 0.02);
      g.add(hinge);
      const door = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.96, 0.06), mat(c));
      door.position.set(w / 2, h / 2, 0);
      hinge.add(door);
      // slats on a locker, a split on a wardrobe
      const line = new THREE.Mesh(new THREE.BoxGeometry(s.kind === 'locker' ? w * 0.6 : 0.03, s.kind === 'locker' ? 0.05 : h * 0.9, 0.02), mat(shade(c, 0.5)));
      line.position.set(w / 2, s.kind === 'locker' ? h * 0.8 : h / 2, 0.04);
      hinge.add(line);
      moving.push({ pivot: hinge, axis: 'y', sign: -1, max: 1.7, open: 0 });
    }
    // and on the floor round it, a gold ring: somewhere a person could be
    const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(w, d) * 0.62, Math.max(w, d) * 0.62 + 0.14, 28), gold);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(s.x, 0.03, s.z);
    pen.add(ring);
  }

  // ---- THE NAMES OF THE PLACES, painted on the floor where their signs hang.
  const label = (text: string, x: number, z: number, color: string, size = 1): void => {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 96;
    const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
    ctx.font = 'bold 64px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(text, 256, 48, 500);
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 48, 500);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(6 * size, 1.1 * size),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    // read from the gallery, which looks down the room from its near end
    m.rotation.z = Math.PI;
    m.position.set(x, 0.05, z);
    pen.add(m);
  };
  for (const s of def.overhead?.signs ?? []) {
    // just inside the doorway the sign hangs over, on the side you read it from
    label(s.text, s.x + Math.sin(s.rot) * 2.2, s.z + Math.cos(s.rot) * 2.2, s.color, 1.7);
  }
  label('LOCKED DOOR', def.door.x, def.halfD - 1.8, '#ff6a6a', 1.4);
  if (def.secretDoor) label('YOU CAME IN HERE', def.halfW - 5.4, def.secretDoor.z, '#6fffb8', 1.2);

  // ---- AND HIM, MARKED.
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0.85, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.3, 32), markerMat);
  ring.rotation.x = -Math.PI / 2;
  pen.add(ring);
  const pulse = new THREE.Mesh(
    new THREE.RingGeometry(1.25, 1.45, 32),
    new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  pulse.rotation.x = -Math.PI / 2;
  pen.add(pulse);
  // a thin beam up to just under the glass
  const beamH = (mezzY - 0.3) / k;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, beamH, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff3848, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  pen.add(beam);

  return {
    setLids(open: number[], dt: number) {
      for (let i = 0; i < moving.length; i++) {
        const m = moving[i];
        const want = Math.min(1, Math.max(0, open[i] ?? 0));
        m.open += (want - m.open) * Math.min(1, dt * 6);
        if (m.max <= 0) continue;
        if (m.axis === 'x') m.pivot.rotation.x = m.sign * m.max * m.open;
        else m.pivot.rotation.y = m.sign * m.max * m.open;
      }
    },
    mark(x: number, z: number, t: number) {
      ring.position.set(x, 0.06, z);
      const p = (t * 0.9) % 1;
      pulse.position.set(x, 0.05, z);
      pulse.scale.setScalar(1 + p * 1.6);
      (pulse.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - p);
      markerMat.opacity = 0.7 + 0.25 * Math.sin(t * 5);
      beam.position.set(x, beamH / 2, z);
    },
    lids: () => moving.map((m) => +m.open.toFixed(3)),
    pieces: () => pen.children.length,
  };
}
