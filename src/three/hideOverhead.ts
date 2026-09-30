/**
 * WHAT IS ABOVE THE FLOOR AND ON THE WALLS.
 *
 * Catwalks along the top of the tall racking and shelving, a way up to them,
 * doors that are locked for good, and the signs over the doorways that say
 * what each part of the building was for.  None of it is in anybody's way:
 * the catwalks sit on things that are already solid, the doors are painted
 * onto walls that are already walls, the signs are above head height.  It is
 * there so the building is bigger than the floor you are running across.
 */

import * as THREE from 'three';
import { bake } from './bake';
import type { RoomDef } from './hideRooms';

type Overhead = NonNullable<RoomDef['overhead']>;

const lam = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ color, ...extra });

function box(p: THREE.Object3D, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  p.add(mesh);
  return mesh;
}

/** Steel grating: a grid of dark slots, so the walkway reads as open metal from below. */
function gratingTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const x = c.getContext('2d')!;
  x.fillStyle = '#4a5058';
  x.fillRect(0, 0, 32, 32);
  x.fillStyle = '#0c0d10';
  for (let i = 0; i < 32; i += 4) for (let j = 0; j < 32; j += 8) x.fillRect(i + 1, j + 1, 2, 6);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  return t;
}

/** A sign: letters on a dark plate, faintly lit from inside. */
function signTex(text: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 16 + text.length * 14;
  c.height = 28;
  const x = c.getContext('2d')!;
  x.fillStyle = '#0e0e10';
  x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = color;
  x.globalAlpha = 0.5;
  x.strokeRect(2, 2, c.width - 4, c.height - 4);
  x.globalAlpha = 0.85;
  x.fillStyle = color;
  x.font = 'bold 18px monospace';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, c.width / 2, c.height / 2 + 1);
  // some of it has gone: a letter's worth of grime
  x.globalAlpha = 0.6;
  x.fillStyle = '#0e0e10';
  x.fillRect(c.width * 0.6, 6, 8, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function buildOverhead(o: Overhead, wallH: number): THREE.Group {
  const g = new THREE.Group();
  const steel = lam(0x3a3e44);
  const rail = lam(0xa08a2a);

  // ---- CATWALKS: grating on a frame, a rail along the open side, and
  // supports back to the wall every couple of metres.
  for (const c of o.catwalks) {
    const grate = gratingTex();
    grate.repeat.set(c.w / 0.6, c.d / 0.6);
    box(g, lam(0xffffff, { map: grate }), c.w, 0.06, c.d, c.x, c.y, c.z);
    box(g, steel, c.w, 0.12, 0.06, c.x, c.y - 0.06, c.z + c.d / 2);
    box(g, steel, c.w, 0.12, 0.06, c.x, c.y - 0.06, c.z - c.d / 2);
    // the rail on the room side, posts and two bars
    const n = Math.max(2, Math.round(c.w / 1.5));
    for (let i = 0; i <= n; i++) box(g, rail, 0.05, 1.0, 0.05, c.x - c.w / 2 + (i * c.w) / n, c.y + 0.5, c.z + c.d / 2);
    box(g, rail, c.w, 0.05, 0.05, c.x, c.y + 1.0, c.z + c.d / 2);
    box(g, rail, c.w, 0.04, 0.04, c.x, c.y + 0.55, c.z + c.d / 2);
    // something left up there
    box(g, lam(0x8a6a44), 0.5, 0.35, 0.4, c.x + c.w * 0.3, c.y + 0.2, c.z);
    // a lamp hanging under it, dead
    const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.2, 10), lam(0x2a2a2e));
    lamp.position.set(c.x - c.w * 0.25, Math.min(c.y + 1.4, wallH - 0.25), c.z + c.d / 2 + 0.6);
    g.add(lamp);
  }

  // ---- LOCKED DOORS: on the face of a wall, a door in a frame with a hasp,
  // a chain and a padlock across it, and a plate saying whose it was.
  for (const d of o.lockedDoors) {
    const door = new THREE.Group();
    door.position.set(d.x, 0, d.z);
    door.rotation.y = d.rot;
    box(door, lam(0x3a2a20), 1.3, 2.3, 0.08, 0, 1.15, 0.04);
    box(door, lam(0x2a1c14), 1.5, 0.1, 0.12, 0, 2.35, 0.04);
    for (const sx of [-1, 1]) box(door, lam(0x2a1c14), 0.1, 2.4, 0.12, sx * 0.7, 1.2, 0.04);
    box(door, lam(0x4a4a4e), 0.05, 0.2, 0.05, 0.45, 1.05, 0.10);
    // the chain: links round the handle and across to an eye in the frame
    for (let i = 0; i < 9; i++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 4, 8), lam(0x6a6e76));
      link.position.set(0.45 - i * 0.12, 1.05 - Math.sin((i / 8) * Math.PI) * 0.12, 0.12);
      link.rotation.y = i % 2 ? Math.PI / 2 : 0;
      door.add(link);
    }
    box(door, lam(0x8a7a3a), 0.09, 0.11, 0.04, -0.1, 0.9, 0.14);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.2), new THREE.MeshBasicMaterial({ map: signTex(d.label, '#c8b890'), color: 0x9a9080 }));
    plate.position.set(0, 1.75, 0.09);
    door.add(plate);
    g.add(door);
  }

  // ---- SIGNS over the doorways, one-sided: each faces the way you come at it.
  for (const s of o.signs) {
    const t = signTex(s.text, s.color);
    const w = 0.16 * s.text.length + 0.3;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.34), new THREE.MeshBasicMaterial({ map: t, color: 0xb8b8b8 }));
    sign.position.set(s.x, s.y, s.z);
    sign.rotation.y = s.rot;
    g.add(sign);
  }
  bake(g);
  return g;
}
