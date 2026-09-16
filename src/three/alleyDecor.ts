/**
 * What the alley is made of, and what has been left in it.
 *
 * The chase ran through three flat Lambert colours: one for the walls, one for
 * the floor, one for the ceiling.  With a torch on them that is not a place,
 * it is a corridor in a maze demo — every junction identical to every other,
 * nothing to tell you whether you have been down here before, and nothing for
 * the light to find.
 *
 * SO IT IS DIRTY NOW.  Brick with the mortar showing and the damp coming
 * through it, concrete with puddles standing in the low spots, a ceiling
 * stained where the pipes leak.  And it has THINGS in it: pipe runs along the
 * walls with brackets and joints, cables sagging across the corridors, doors
 * that have been shut a long time, bins and crates and planks and rubbish
 * bags, and dark broken lamps that are not going to come on.
 *
 * ALL OF IT IS OFF THE FLOOR PLAN.  Nothing here is a collider and nothing
 * here moves: the chase is a footrace through a grid and the grid is the only
 * thing either of you can touch.  A crate that stopped you dead in a corner
 * would turn a pacing problem into a physics bug, and the one thing this
 * sequence cannot afford is a player who lost because they caught on scenery.
 */

import * as THREE from 'three';

const SIZE = 256;

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  return [c, c.getContext('2d')!];
}

/** Seeded, so the alley is the same alley every time it is built. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Brick, mortar, damp and the writing on it. */
function paintWall(ctx: CanvasRenderingContext2D): void {
  const r = rng(7);
  ctx.fillStyle = '#3c4149';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // courses of brick, offset every other row, each one its own shade
  const bh = 16;
  const bw = 34;
  for (let row = 0; row * bh < SIZE; row++) {
    const off = row % 2 ? -bw / 2 : 0;
    for (let col = -1; col * bw + off < SIZE; col++) {
      const x = col * bw + off;
      const y = row * bh;
      const v = 0.72 + r() * 0.5;
      ctx.fillStyle = `rgb(${Math.round(62 * v)},${Math.round(68 * v)},${Math.round(76 * v)})`;
      ctx.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
    }
  }

  // damp, coming down from the top.  Long, uneven, and darker where it pools.
  for (let i = 0; i < 16; i++) {
    const x = r() * SIZE;
    const w = 6 + r() * 26;
    const h = 40 + r() * 190;
    const g = ctx.createLinearGradient(x, 0, x, h);
    g.addColorStop(0, 'rgba(10,16,20,0.5)');
    g.addColorStop(1, 'rgba(10,16,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, h);
  }

  // cracks: a few long ones that fork
  ctx.strokeStyle = 'rgba(8,10,14,0.85)';
  for (let i = 0; i < 9; i++) {
    let x = r() * SIZE;
    let y = r() * SIZE;
    ctx.lineWidth = 0.6 + r() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 7; k++) {
      x += (r() - 0.35) * 26;
      y += (r() - 0.2) * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // stains and scuffs
  for (let i = 0; i < 40; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const rad = 4 + r() * 22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, r() < 0.6 ? 'rgba(18,22,18,0.38)' : 'rgba(86,74,48,0.24)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // somebody wrote on it once, and it has been painted over badly
  for (let i = 0; i < 5; i++) {
    const x = r() * SIZE;
    const y = 40 + r() * (SIZE - 80);
    ctx.strokeStyle = `rgba(${90 + r() * 60},${70 + r() * 40},${60 + r() * 60},0.2)`;
    ctx.lineWidth = 2 + r() * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      ctx.quadraticCurveTo(x + k * 9 + r() * 8, y - 10 + r() * 20, x + (k + 1) * 11, y + (r() - 0.5) * 14);
    }
    ctx.stroke();
  }
}

/** Concrete with water standing on it. */
function paintFloor(ctx: CanvasRenderingContext2D): void {
  const r = rng(23);
  ctx.fillStyle = '#2b3138';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // slabs, with the joints showing
  for (let gx = 0; gx < SIZE; gx += 64) {
    for (let gy = 0; gy < SIZE; gy += 64) {
      const v = 0.85 + r() * 0.3;
      ctx.fillStyle = `rgb(${Math.round(44 * v)},${Math.round(50 * v)},${Math.round(57 * v)})`;
      ctx.fillRect(gx + 1, gy + 1, 62, 62);
    }
  }

  // grime in the joints and worn tracks down the middle
  for (let i = 0; i < 70; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const rad = 3 + r() * 20;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(12,16,18,0.42)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // PUDDLES.  Dark, with a pale rim where the water has crept and dried, and
  // a cold highlight in them -- they are the only thing down here that shines
  // when the torch crosses it, which is what makes the floor read as wet.
  for (let i = 0; i < 9; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const rw = 14 + r() * 34;
    const rh = rw * (0.45 + r() * 0.4);
    ctx.fillStyle = 'rgba(14,20,26,0.8)';
    ctx.beginPath();
    ctx.ellipse(x, y, rw, rh, r() * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,132,120,0.14)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = 'rgba(150,180,200,0.13)';
    ctx.beginPath();
    ctx.ellipse(x - rw * 0.25, y - rh * 0.3, rw * 0.4, rh * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // cracks across the slabs
  ctx.strokeStyle = 'rgba(10,12,16,0.8)';
  for (let i = 0; i < 11; i++) {
    let x = r() * SIZE;
    let y = r() * SIZE;
    ctx.lineWidth = 0.5 + r() * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (r() - 0.5) * 40;
      y += (r() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/** The underside of whatever is above, stained where it has been leaking. */
function paintCeiling(ctx: CanvasRenderingContext2D): void {
  const r = rng(41);
  ctx.fillStyle = '#1a1f25';
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 26; i++) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const rad = 10 + r() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    // rust-coloured rings, because the stain is older at the edge
    g.addColorStop(0, 'rgba(58,40,22,0.4)');
    g.addColorStop(0.7, 'rgba(38,28,18,0.2)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = 'rgba(8,10,13,0.5)';
    ctx.fillRect(r() * SIZE, r() * SIZE, 2 + r() * 40, 1 + r() * 3);
  }
}

export interface AlleySurfaces {
  wall: THREE.Texture;
  floor: THREE.Texture;
  ceiling: THREE.Texture;
}

let cached: AlleySurfaces | null = null;

/** Built once and shared: the alley is one place, not thirty-nine of them. */
export function alleySurfaces(): AlleySurfaces {
  if (cached) return cached;
  const mk = (paint: (c: CanvasRenderingContext2D) => void, repeat: number): THREE.Texture => {
    const [c, x] = canvas();
    paint(x);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  cached = {
    wall: mk(paintWall, 1),
    floor: mk(paintFloor, 14),
    ceiling: mk(paintCeiling, 10),
  };
  return cached;
}

export interface DressOpts {
  scene: THREE.Scene;
  cols: number;
  rows: number;
  cell: number;
  wallH: number;
  isWall: (col: number, row: number) => boolean;
  worldX: (col: number) => number;
  worldZ: (row: number) => number;
}

/**
 * Everything that has been left down here.
 *
 * Walks the grid and, for each open cell, decides what is against the walls
 * around it.  Deterministic from the cell's own coordinates, so the alley is
 * furnished the same way every run and a player who comes back knows where
 * they are -- which is the entire point of furnishing it.
 */
export function dressAlley(o: DressOpts): void {
  const { scene, cols, rows, cell, wallH, isWall, worldX, worldZ } = o;
  const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c });
  const rust = lam(0x4a3a2c);
  const steel = lam(0x555f68);
  const dark = lam(0x1b2026);
  const timber = lam(0x4e3d28);

  /** Deterministic per cell and per purpose, so nothing crawls between runs. */
  const at = (c: number, r: number, k: number): number => {
    const s = Math.sin(c * 127.1 + r * 311.7 + k * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };

  const add = (m: THREE.Object3D, x: number, y: number, z: number, ry = 0): void => {
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isWall(c, r)) continue;
      const x = worldX(c);
      const z = worldZ(r);

      // ---- which sides have a wall to hang things on
      const sides: Array<[number, number, number]> = [
        [0, -1, 0],
        [0, 1, Math.PI],
        [-1, 0, -Math.PI / 2],
        [1, 0, Math.PI / 2],
      ];
      for (const [dc, dr, ry] of sides) {
        if (!isWall(c + dc, r + dr)) continue;
        const face = at(c, r, dc * 3 + dr * 7);
        const wx = x + dc * (cell / 2 - 0.12);
        const wz = z + dr * (cell / 2 - 0.12);

        // A PIPE RUN, up near the ceiling, with a bracket and a joint.
        if (face < 0.34) {
          const len = cell * 0.96;
          const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 8), rust);
          pipe.rotation.z = Math.PI / 2;
          // HIGH, AND TIGHT TO THE WALL.  He is 2.79m through here and the
          // ceiling is 3.2; anything slung lower than about 2.9 is something
          // his head goes through on every run down this corridor.
          add(pipe, wx, wallH - 0.24 - at(c, r, 11) * 0.12, wz, ry);
          const joint = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 8), steel);
          joint.rotation.z = Math.PI / 2;
          add(joint, wx, pipe.position.y, wz, ry);
          const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.06), steel);
          add(bracket, wx, pipe.position.y + 0.16, wz, ry);
        } else if (face < 0.48) {
          // A DOOR, shut, with the handle gone dull.  Nothing is behind it.
          const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.12), timber);
          add(door, wx, 1.05, wz, ry);
          const frame = new THREE.Mesh(new THREE.BoxGeometry(1.22, 2.3, 0.06), dark);
          add(frame, wx - dc * 0.04, 1.15, wz - dr * 0.04, ry);
          const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), steel);
          add(knob, wx + (dc === 0 ? 0.34 : 0), 1.0, wz + (dr === 0 ? 0.34 : 0));
        } else if (face < 0.58) {
          // A dead lamp in a cage.  It is not going to come on.
          const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.3, 8, 1, true), steel);
          add(cage, wx, wallH - 0.7, wz, ry);
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), lam(0x2a2a22));
          add(bulb, wx, wallH - 0.7, wz);
        }
      }

      // ---- CABLES.  Slung across the corridor and sagging, because a ceiling
      // with nothing under it is a lid.
      if (at(c, r, 2) < 0.3) {
        // Sagging, but not into his head: the lowest point of the lowest cable
        // sits at 2.93, which is a hand's width over him.
        const sag = 0.06 + at(c, r, 5) * 0.16;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x - cell / 2, wallH - 0.15, z),
          new THREE.Vector3(x, wallH - 0.15 - sag, z),
          new THREE.Vector3(x + cell / 2, wallH - 0.15, z),
        ]);
        const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.035, 5, false), dark);
        scene.add(cable);
      }

      // ---- RUBBISH.  Low, off to the sides, and never in the middle: the
      // middle is where two of you are running.
      const junk = at(c, r, 17);
      if (junk < 0.42) {
        const ox = (at(c, r, 19) - 0.5) * (cell - 1.1);
        const oz = (at(c, r, 23) - 0.5) * (cell - 1.1);
        const pick = at(c, r, 29);
        if (pick < 0.3) {
          const crate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.58), timber);
          add(crate, x + ox, 0.25, z + oz, at(c, r, 31) * 3);
        } else if (pick < 0.55) {
          const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.82, 9), steel);
          add(bin, x + ox, 0.41, z + oz);
          const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.06, 9), dark);
          add(lid, x + ox + 0.4, 0.03, z + oz + 0.2, at(c, r, 37) * 3);
        } else if (pick < 0.78) {
          // a bag, slumped
          const bag = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), lam(0x23262b));
          bag.scale.set(1, 0.78, 0.9);
          add(bag, x + ox, 0.22, z + oz);
        } else {
          // planks against the wall
          for (let k = 0; k < 3; k++) {
            const plank = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.04), timber);
            plank.rotation.z = 0.35 + k * 0.06;
            add(plank, x + ox + k * 0.1, 0.72, z + oz, at(c, r, 41) * 3);
          }
        }
      }

      // ---- litter, flat on the floor: paper, a can, a scrap of something
      if (at(c, r, 43) < 0.55) {
        const bit = new THREE.Mesh(
          new THREE.PlaneGeometry(0.16 + at(c, r, 47) * 0.2, 0.12 + at(c, r, 53) * 0.16),
          lam(at(c, r, 59) < 0.5 ? 0x6a6458 : 0x3a4148),
        );
        bit.rotation.x = -Math.PI / 2;
        bit.rotation.z = at(c, r, 61) * 3;
        add(bit, x + (at(c, r, 67) - 0.5) * cell * 0.7, 0.012, z + (at(c, r, 71) - 0.5) * cell * 0.7);
      }
    }
  }
}
