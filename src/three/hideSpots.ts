/**
 * THE THINGS YOU HIDE IN, BUILT AS THINGS.
 *
 * They were boxes with a box for a door.  A locker is pressed steel with a
 * frame round the door, louvred vents, a lever that turns before the door
 * will move, three hinges you can see, a number stencilled on it and dents
 * along the bottom.  A chest is planks with iron bands, corner brackets, a
 * hasp and a domed lid on two strap hinges.  A wardrobe is panelled wood
 * with a moulding along the top.  A bed is an iron frame with rails at head
 * and foot, a thin mattress, a pillow and a blanket that hangs over the edge.
 *
 * THE CONTRACT DOES NOT CHANGE.  Every builder puts its moving part on the
 * pivot the room already swings (a lid tips about x, a door about y), at the
 * same place, and hands back the same grip points his hands reach for -- so
 * nothing about how he opens them, or where you can stand, moves at all.
 * Everything here is looks.
 */

import * as THREE from 'three';

// ------------------------------------------------------------------ surfaces

const texCache = new Map<string, THREE.CanvasTexture>();

function canvasTex(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}

let seed = 1;
const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Planks, with grain, knots and dark seams between them. */
function woodTex(base: string, dark: string): THREE.CanvasTexture {
  return canvasTex(`wood:${base}`, 64, 64, (ctx) => {
    seed = 17;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.08})`;
      ctx.fillRect(0, rnd() * 64, 64, 1);
    }
    for (let y = 0; y < 64; y += 16) {
      ctx.fillStyle = dark;
      ctx.fillRect(0, y, 64, 1.5);
    }
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(rnd() * 64, rnd() * 64, 2.4, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Painted steel: flat colour, scratches, rust bloom along the bottom. */
function steelTex(base: string): THREE.CanvasTexture {
  return canvasTex(`steel:${base}`, 64, 128, (ctx) => {
    seed = 29;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 128);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(220,225,230,${0.08 + rnd() * 0.12})`;
      ctx.lineWidth = 0.6;
      const x = rnd() * 64;
      const y = rnd() * 128;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 12, y + (rnd() - 0.5) * 4);
      ctx.stroke();
    }
    const g = ctx.createLinearGradient(0, 96, 0, 128);
    g.addColorStop(0, 'rgba(110,50,20,0)');
    g.addColorStop(1, 'rgba(110,50,20,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 96, 64, 32);
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(90,40,16,${0.2 + rnd() * 0.3})`;
      ctx.beginPath();
      ctx.arc(rnd() * 64, 100 + rnd() * 28, 1 + rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Woven cloth: a fine cross-hatch and a few stains. */
function clothTex(base: string): THREE.CanvasTexture {
  return canvasTex(`cloth:${base}`, 64, 64, (ctx) => {
    seed = 41;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, y, 64, 1);
    }
    for (let x = 0; x < 64; x += 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, 0, 1, 64);
    }
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = `rgba(80,60,30,${0.12 + rnd() * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(rnd() * 64, rnd() * 64, 4 + rnd() * 8, 3 + rnd() * 5, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

const lam = (color: number, map?: THREE.Texture, repeat?: [number, number]): THREE.MeshLambertMaterial => {
  if (!map) return new THREE.MeshLambertMaterial({ color });
  const m = map.clone();
  m.needsUpdate = true;
  if (repeat) m.repeat.set(repeat[0], repeat[1]);
  return new THREE.MeshLambertMaterial({ color, map: m });
};
const IRON = new THREE.MeshLambertMaterial({ color: 0x3a3d42 });
const IRON_LIT = new THREE.MeshLambertMaterial({ color: 0x6a6e76 });
const BRASS = new THREE.MeshLambertMaterial({ color: 0x9a8350 });
const DARK = new THREE.MeshBasicMaterial({ color: 0x0c0d10 });

function box(parent: THREE.Object3D, mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function cyl(parent: THREE.Object3D, mat: THREE.Material, r: number, h: number, x: number, y: number, z: number, axis: 'x' | 'y' | 'z' = 'y'): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), mat);
  m.position.set(x, y, z);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  parent.add(m);
  return m;
}

export interface BuiltSpot {
  /** The moving part, already on its pivot. */
  hinge: THREE.Group;
  /** Where his hands go, riding on the moving part. */
  grips: THREE.Object3D[];
  /** A lever that has to turn before the door will move, if it has one. */
  lever?: THREE.Object3D;
}

// ------------------------------------------------------------------ builders

/**
 * A steel locker (`locker`) or a wooden wardrobe (anything else), 0.75 deep,
 * standing on the floor, its door on a hinge down its left edge.
 */
export function buildDoorSpot(group: THREE.Group, locker: boolean, number: number): BuiltSpot {
  const h = locker ? 2.0 : 1.8;
  const w = locker ? 0.9 : 1.2;
  const bodyMat = locker ? lam(0x5a6878, steelTex('#8a98a8'), [1, 1]) : lam(0x7a5634, woodTex('#8a6440', '#3a2412'), [1.5, 2]);
  const trim = locker ? lam(0x4a5664) : lam(0x5a3c22, woodTex('#6a4a2c', '#2a180a'), [1, 1]);

  // the carcass: back, sides, top and a plinth, so it is a cabinet you can
  // see the edges of rather than one solid block
  box(group, bodyMat, w, h - 0.08, 0.06, 0, h / 2, -0.345);
  for (const sx of [-1, 1]) box(group, bodyMat, 0.05, h, 0.75, sx * (w / 2 - 0.025), h / 2, 0);
  box(group, trim, w + (locker ? 0.02 : 0.1), 0.07, 0.8 + (locker ? 0 : 0.06), 0, h - 0.035 + (locker ? 0 : 0.02), 0);
  box(group, locker ? IRON : trim, w - 0.04, 0.08, 0.72, 0, 0.04, 0);
  // the dark inside, so an open door shows a hollow and not the back wall
  box(group, DARK, w - 0.1, h - 0.2, 0.02, 0, h / 2, -0.3);
  if (locker) {
    // a shelf across the top of the inside, and a coat hook
    box(group, IRON_LIT, w - 0.1, 0.02, 0.6, 0, h - 0.34, -0.02);
    cyl(group, IRON_LIT, 0.012, 0.12, 0, h - 0.5, -0.24, 'z');
    // four feet
    for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(group, IRON, 0.025, 0.05, fx * (w / 2 - 0.06), 0.025, fz * 0.3);
  } else {
    // a crown moulding and bun feet
    box(group, trim, w + 0.14, 0.05, 0.86, 0, h + 0.035, 0);
    for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), trim);
      f.position.set(fx * (w / 2 - 0.08), 0.03, fz * 0.3);
      group.add(f);
    }
  }

  // ---- THE DOOR, on the pivot the room swings (see `buildSpot`).
  const hinge = new THREE.Group();
  hinge.position.set(-w / 2, h / 2, 0.38);
  const doorMat = locker ? lam(0x62707f, steelTex('#94a2b2'), [1, 1]) : lam(0x86603a, woodTex('#8e6844', '#3a2412'), [1.2, 2]);
  box(hinge, doorMat, w, h - 0.12, 0.05, w / 2, 0, 0);
  // a rolled frame round the door's edge
  const edge = locker ? lam(0x4e5a68) : trim;
  box(hinge, edge, w, 0.04, 0.07, w / 2, (h - 0.12) / 2 - 0.02, 0.01);
  box(hinge, edge, w, 0.04, 0.07, w / 2, -(h - 0.12) / 2 + 0.02, 0.01);
  box(hinge, edge, 0.04, h - 0.12, 0.07, 0.02, 0, 0.01);
  box(hinge, edge, 0.04, h - 0.12, 0.07, w - 0.02, 0, 0.01);
  if (locker) {
    // louvres: angled slats top and bottom, each a dark slot under a lip
    for (const band of [h * 0.34, -h * 0.36]) {
      for (let i = 0; i < 5; i++) {
        const y = band - i * 0.05;
        box(hinge, DARK, w * 0.56, 0.018, 0.01, w / 2, y, 0.027);
        const lip = box(hinge, edge, w * 0.58, 0.012, 0.03, w / 2, y + 0.014, 0.035);
        lip.rotation.x = -0.5;
      }
    }
    // a stencilled number plate
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.1),
      new THREE.MeshBasicMaterial({ map: numberTex(number), transparent: true }),
    );
    plate.position.set(w / 2, h * 0.14, 0.028);
    hinge.add(plate);
    // dents along the bottom, where it has been kicked
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshLambertMaterial({ color: 0x4a5664 }));
      d.scale.set(1.4, 0.8, 0.25);
      d.position.set(w * (0.3 + i * 0.2), -h * 0.42 + (i % 2) * 0.05, 0.026);
      hinge.add(d);
    }
  } else {
    // two raised panels
    for (const py of [h * 0.2, -h * 0.2]) {
      box(hinge, trim, w * 0.72, h * 0.32, 0.02, w / 2, py, 0.03);
      box(hinge, doorMat, w * 0.62, h * 0.26, 0.02, w / 2, py, 0.04);
    }
  }
  // the hinges themselves: knuckles down the left edge
  for (const hy of [h * 0.36, 0, -h * 0.36]) {
    cyl(hinge, IRON_LIT, 0.018, 0.12, 0, hy, 0.02);
    box(hinge, IRON, 0.07, 0.1, 0.008, 0.04, hy, 0.028);
  }

  // ---- THE HANDLE.  A locker's is a lever on a pivot that turns before the
  // door will come -- the sound of it is the warning -- and a wardrobe's is a
  // knob that does not move.
  let lever: THREE.Object3D | undefined;
  if (locker) {
    const pivot = new THREE.Group();
    pivot.position.set(w - 0.14, 0, 0.05);
    hinge.add(pivot);
    box(pivot, IRON, 0.08, 0.16, 0.012, 0, 0, -0.012); // the escutcheon
    cyl(pivot, IRON_LIT, 0.02, 0.04, 0, 0, 0.01, 'z');
    box(pivot, IRON_LIT, 0.035, 0.16, 0.025, 0, -0.07, 0.03);
    box(pivot, DARK, 0.02, 0.02, 0.01, 0, 0.05, -0.004); // the padlock hole
    lever = pivot;
  } else {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), BRASS);
    knob.position.set(w - 0.14, 0, 0.07);
    hinge.add(knob);
    cyl(hinge, BRASS, 0.012, 0.04, w - 0.14, 0, 0.045, 'z');
  }
  // just in front of the handle, where a palm closes on it
  const g = new THREE.Object3D();
  g.position.set(w - 0.14, 0, 0.16);
  hinge.add(g);
  return { hinge, grips: [g], lever };
}

/** A chest 1.1 wide, 0.8 deep: planks, iron bands, a domed lid on strap hinges. */
export function buildChestSpot(group: THREE.Group): BuiltSpot {
  const wood = lam(0x7a5430, woodTex('#7c5632', '#301c0c'), [1.4, 1]);
  // the box: four walls and a floor, so the inside is a space
  box(group, wood, 1.1, 0.62, 0.05, 0, 0.35, 0.375);
  box(group, wood, 1.1, 0.62, 0.05, 0, 0.35, -0.375);
  for (const sx of [-1, 1]) box(group, wood, 0.05, 0.62, 0.8, sx * 0.525, 0.35, 0);
  box(group, DARK, 1.0, 0.02, 0.7, 0, 0.1, 0);
  // feet
  for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(group, IRON, 0.1, 0.06, 0.1, fx * 0.5, 0.03, fz * 0.35);
  // iron bands round it, and corner brackets with rivets
  for (const bx of [-0.33, 0.33]) {
    box(group, IRON, 0.06, 0.62, 0.82, bx, 0.35, 0);
  }
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    box(group, IRON_LIT, 0.08, 0.12, 0.012, cx * 0.49, 0.62, cz * 0.405);
    box(group, IRON_LIT, 0.08, 0.12, 0.012, cx * 0.49, 0.1, cz * 0.405);
  }
  // the hasp plate on the front, with the lock's keyhole
  box(group, BRASS, 0.12, 0.14, 0.02, 0, 0.56, 0.41);
  box(group, DARK, 0.02, 0.04, 0.01, 0, 0.54, 0.422);
  // side handles
  for (const sx of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), IRON_LIT);
    ring.rotation.set(0, (sx * Math.PI) / 2, Math.PI);
    ring.position.set(sx * 0.56, 0.5, 0);
    group.add(ring);
  }

  // ---- THE LID, on the pivot along the back edge (see `buildSpot`).
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.7, -0.4);
  const lidMat = lam(0x86603a, woodTex('#86603a', '#301c0c'), [1.4, 1]);
  // a stepped lid: the board, and a raised panel on top of it
  box(hinge, lidMat, 1.1, 0.08, 0.8, 0, 0, 0.4);
  box(hinge, lidMat, 1.0, 0.06, 0.68, 0, 0.07, 0.4);
  // the lid's own bands, over the step, and the hasp's tongue
  for (const bx of [-0.33, 0.33]) {
    box(hinge, IRON, 0.065, 0.1, 0.82, bx, 0.02, 0.4);
    box(hinge, IRON, 0.065, 0.02, 0.7, bx, 0.105, 0.4);
  }
  box(hinge, BRASS, 0.08, 0.16, 0.02, 0, -0.06, 0.81);
  // the strap hinges, running from the back edge over the lid
  for (const sx of [-0.25, 0.25]) {
    box(hinge, IRON_LIT, 0.06, 0.012, 0.3, sx, 0.05, 0.12);
    cyl(hinge, IRON_LIT, 0.02, 0.1, sx, 0, 0, 'x');
  }
  // under the front edge of the lid, a hand's width in from each corner
  const grips: THREE.Object3D[] = [];
  for (const gx of [-0.36, 0.36]) {
    const g = new THREE.Object3D();
    g.position.set(gx, -0.02, 0.84);
    hinge.add(g);
    grips.push(g);
  }
  return { hinge, grips };
}

/** An iron bed 2.3 long: rails at head and foot, a mattress, a pillow, a blanket. */
export function buildBedSpot(group: THREE.Group): BuiltSpot {
  const iron = lam(0x5a5e62, steelTex('#7a7e82'), [1, 1]);
  // the frame: two side rails and slats under the mattress
  for (const sz of [-0.5, 0.5]) box(group, iron, 2.3, 0.07, 0.05, 0, 0.52, sz);
  for (let i = 0; i < 7; i++) box(group, IRON, 0.06, 0.03, 1.0, -0.95 + i * 0.32, 0.53, 0);
  // legs, on little castors
  for (const [lx, lz] of [[-1.12, -0.5], [1.12, -0.5], [-1.12, 0.5], [1.12, 0.5]]) {
    cyl(group, iron, 0.025, 0.5, lx, 0.27, lz);
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), IRON);
    wheel.position.set(lx, 0.03, lz);
    group.add(wheel);
  }
  // head and foot: tubular posts with bars between them, the head taller
  for (const [ex, top] of [[-1.13, 1.2], [1.13, 0.9]] as const) {
    for (const sz of [-0.5, 0.5]) cyl(group, iron, 0.03, top, ex, top / 2, sz);
    cyl(group, iron, 0.025, 1.0, ex, top - 0.05, 0, 'z');
    cyl(group, iron, 0.02, 1.0, ex, 0.62, 0, 'z');
    for (let i = 1; i < 6; i++) cyl(group, iron, 0.012, top - 0.7, ex, (top + 0.62) / 2, -0.5 + i * (1 / 6));
    for (const sz of [-0.5, 0.5]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), BRASS);
      cap.position.set(ex, top + 0.01, sz);
      group.add(cap);
    }
  }
  // the mattress, thin and ticked, and a pillow at the head
  const tick = lam(0xb4aa92, clothTex('#c8bea4'), [2, 1]);
  const mattress = box(group, tick, 2.2, 0.18, 1.0, 0, 0.66, 0);
  mattress.scale.set(1, 1, 1);
  for (let i = 0; i < 6; i++) box(group, lam(0x8a826c), 0.02, 0.19, 1.0, -0.9 + i * 0.36, 0.66, 0);
  const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), lam(0xd8d0bc, clothTex('#e0d8c4'), [1, 1]));
  pillow.scale.set(0.7, 0.28, 1.35);
  pillow.position.set(-0.85, 0.8, 0);
  group.add(pillow);
  // the dark underneath, so the gap under it reads as a place
  const under = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.0), new THREE.MeshBasicMaterial({ color: 0x060607, transparent: true, opacity: 0.8 }));
  under.rotation.x = -Math.PI / 2;
  under.position.set(0, 0.01, 0);
  group.add(under);

  // ---- THE BLANKET, hinged along the far edge (see `buildSpot`), with the
  // near side hanging down over the edge of the mattress.
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.82, -0.5);
  const wool = lam(0x4a5a6e, clothTex('#5a6a80'), [2, 1]);
  box(hinge, wool, 2.0, 0.05, 1.0, 0.1, 0, 0.5);
  const drape = box(hinge, wool, 2.0, 0.26, 0.04, 0.1, -0.12, 1.0);
  drape.rotation.x = 0.08;
  // a turned-down edge at the head, and a stripe across it
  box(hinge, lam(0xd8d0bc, clothTex('#e0d8c4'), [2, 1]), 0.22, 0.06, 1.0, -0.8, 0.01, 0.5);
  box(hinge, lam(0x7a2a2a), 0.06, 0.055, 1.0, 0.7, 0.005, 0.5);
  const grips: THREE.Object3D[] = [];
  for (const gx of [-0.45, 0.45]) {
    const g = new THREE.Object3D();
    g.position.set(gx, 0.06, 0.98);
    hinge.add(g);
    grips.push(g);
  }
  return { hinge, grips };
}

/** A stencilled locker number. */
function numberTex(n: number): THREE.CanvasTexture {
  return canvasTex(`num:${n}`, 36, 20, (ctx) => {
    ctx.fillStyle = '#d8d4c8';
    ctx.fillRect(0, 0, 36, 20);
    ctx.fillStyle = '#2a2e34';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n).padStart(2, '0'), 18, 11);
  });
}
