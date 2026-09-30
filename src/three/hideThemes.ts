/**
 * THE PLACES INSIDE THE BUILDING, BUILT AS THEMSELVES.
 *
 * The hide rooms were a lounge, a store and a ward made of coloured boxes and
 * trim.  They are now the back of an arcade: a food court and its kitchen, an
 * indoor playground, party rooms, a graveyard of dead machines, the prize
 * stockroom, racking, a workshop, the plant room, the security office, the
 * staff offices.  Every one of those is a thing you would recognise with the
 * lights off, and each is built here.
 *
 * THE SAME CONTRACT AS EVERY OTHER PROP.  A deco is fitted into the collision
 * box the room already has for it (`Box.deco`), built facing +Z with its feet
 * at y 0 and its origin in the middle of its footprint.  Nothing here decides
 * where anybody can walk, climb or see -- the box does that, as it always
 * has -- so a prop that is modelled a little generously or a little mean
 * cannot open a hole in the room or close a route.
 *
 * Lit things (screens, status lamps, exit signs) are `MeshBasicMaterial`:
 * they glow without costing a light, which is the only kind of light variety
 * a room can afford when every real lamp is paid for on every pixel.
 */

import * as THREE from 'three';
import { bake } from './bake';

export type DecoKind =
  | 'arcadeBank'
  | 'shelf'
  | 'kitchen'
  | 'stove'
  | 'fridge'
  | 'foodTable'
  | 'partyTable'
  | 'ballPit'
  | 'climbFrame'
  | 'slide'
  | 'stage'
  | 'workbench'
  | 'generator'
  | 'pipes'
  | 'monitors'
  | 'desk'
  | 'filing'
  | 'cubicle'
  | 'duct'
  | 'stairs'
  | 'cage'
  | 'boiler';

// ------------------------------------------------------------------ textures

const texCache = new Map<string, THREE.CanvasTexture>();
function tex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  let t = texCache.get(key);
  if (t) return t;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}

let seed = 1;
const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** A screen with nothing on it but the noise it makes. */
function staticTex(k: number): THREE.CanvasTexture {
  // four of them, shared: every screen in the building is one of these
  const n = ((k % 4) + 4) % 4;
  return tex(`static:${n}`, 32, 24, (c) => {
    seed = 101 + n * 7;
    c.fillStyle = '#0e1614';
    c.fillRect(0, 0, 32, 24);
    for (let i = 0; i < 260; i++) {
      const v = 60 + Math.floor(rnd() * 150);
      c.fillStyle = `rgba(${v * 0.7},${v},${v * 0.85},${0.3 + rnd() * 0.5})`;
      c.fillRect(Math.floor(rnd() * 32), Math.floor(rnd() * 24), 1, 1);
    }
    // a rolling bar, and on some of them the shape of a room
    c.fillStyle = 'rgba(180,220,200,0.12)';
    c.fillRect(0, 6 + (n % 4) * 4, 32, 3);
    if (n % 3 === 0) {
      c.strokeStyle = 'rgba(170,210,190,0.35)';
      c.strokeRect(6, 6, 20, 13);
      c.beginPath();
      c.moveTo(6, 6);
      c.lineTo(12, 10);
      c.moveTo(26, 6);
      c.lineTo(20, 10);
      c.stroke();
    }
    c.fillStyle = 'rgba(220,60,50,0.9)';
    c.fillRect(2, 2, 2, 2);
  });
}

/** Cardboard boxes: brown, taped, stencilled. */
function cardboardTex(): THREE.CanvasTexture {
  return tex('cardboard', 32, 32, (c) => {
    seed = 7;
    c.fillStyle = '#8a6a44';
    c.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(0,0,0,${0.04 + rnd() * 0.06})`;
      c.fillRect(0, Math.floor(rnd() * 32), 32, 1);
    }
    c.fillStyle = '#b8a37a';
    c.fillRect(14, 0, 4, 32);
    c.fillStyle = 'rgba(30,20,10,0.6)';
    c.fillRect(4, 20, 8, 2);
    c.fillRect(4, 24, 6, 2);
  });
}

/** Black and yellow: somebody wanted you to stay back from this. */
function hazardTex(): THREE.CanvasTexture {
  return tex('hazard', 32, 32, (c) => {
    c.fillStyle = '#1a1a14';
    c.fillRect(0, 0, 32, 32);
    c.fillStyle = '#c8a020';
    for (let i = -32; i < 64; i += 12) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i + 6, 0);
      c.lineTo(i + 6 + 32, 32);
      c.lineTo(i + 32, 32);
      c.closePath();
      c.fill();
    }
  });
}

/** Padded vinyl, the kind a playground is upholstered in, gone dull. */
function vinylTex(base: string): THREE.CanvasTexture {
  return tex(`vinyl:${base}`, 32, 32, (c) => {
    seed = 23;
    c.fillStyle = base;
    c.fillRect(0, 0, 32, 32);
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.strokeRect(1, 1, 30, 30);
    for (let i = 0; i < 14; i++) {
      c.fillStyle = `rgba(0,0,0,${0.08 + rnd() * 0.1})`;
      c.beginPath();
      c.arc(rnd() * 32, rnd() * 32, 1 + rnd() * 3, 0, Math.PI * 2);
      c.fill();
    }
  });
}

// ------------------------------------------------------------------- parts

const lam = (color: number, map?: THREE.Texture): THREE.MeshLambertMaterial =>
  new THREE.MeshLambertMaterial(map ? { color, map } : { color });
const glow = (color: number): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color });

function box(p: THREE.Object3D, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  p.add(mesh);
  return mesh;
}
function cyl(p: THREE.Object3D, m: THREE.Material, r: number, h: number, x: number, y: number, z: number, axis: 'x' | 'y' | 'z' = 'y', seg = 10): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
  mesh.position.set(x, y, z);
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  p.add(mesh);
  return mesh;
}

const STEEL = lam(0x4a5058);
/** A colour gone dull: half as bright and greyed toward the room. */
function dim(c: number): number {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  const grey = (r + g + b) / 3;
  const f = (v: number) => Math.round((v * 0.6 + grey * 0.4) * 0.5);
  return (f(r) << 16) | (f(g) << 8) | f(b);
}
const STEEL_DARK = lam(0x2a2e34);
const WOOD = lam(0x5a3e26);
const BLACK = lam(0x101114);

// --------------------------------------------------------------- builders

/**
 * Build one deco into a group, facing +Z, fitted to `w` x `h` x `d`.
 * `n` is a per-prop number, so two of a thing are not the same thing.
 */
export function buildDeco(kind: DecoKind, w: number, h: number, d: number, color: number, n: number): THREE.Group {
  const g = new THREE.Group();
  seed = 31 + n * 13;
  switch (kind) {
    case 'arcadeBank':
      arcadeBank(g, w, h, d, n);
      break;
    case 'shelf':
      shelf(g, w, h, d);
      break;
    case 'kitchen':
      kitchen(g, w, h, d);
      break;
    case 'stove':
      stove(g, w, h, d);
      break;
    case 'fridge':
      fridge(g, w, h, d);
      break;
    case 'foodTable':
      foodTable(g, w, h, d, color);
      break;
    case 'partyTable':
      partyTable(g, w, h, d, color);
      break;
    case 'ballPit':
      ballPit(g, w, h, d);
      break;
    case 'climbFrame':
      climbFrame(g, w, h, d, color);
      break;
    case 'slide':
      slide(g, w, h, d, color);
      break;
    case 'stage':
      stage(g, w, h, d, color);
      break;
    case 'workbench':
      workbench(g, w, h, d);
      break;
    case 'generator':
      generator(g, w, h, d);
      break;
    case 'pipes':
      pipes(g, w, h, d);
      break;
    case 'monitors':
      monitors(g, w, h, d, n);
      break;
    case 'desk':
      desk(g, w, h, d, n);
      break;
    case 'filing':
      filing(g, w, h, d);
      break;
    case 'cubicle':
      cubicle(g, w, h, d, color);
      break;
    case 'duct':
      duct(g, w, h, d);
      break;
    case 'stairs':
      stairs(g, w, h, d);
      break;
    case 'cage':
      cage(g, w, h, d);
      break;
    case 'boiler':
      boiler(g, w, h, d);
      break;
  }
  // one mesh per material, not one per board: see bake
  bake(g);
  return g;
}

/** A row of dead machines: back to back when the bank is deep enough for two rows. */
function arcadeBank(g: THREE.Group, w: number, h: number, d: number, n: number): void {
  const colors = [0x6a2a4a, 0x2a4a6a, 0x4a6a2a, 0x6a4a2a, 0x3a2a6a, 0x2a6a5a];
  const count = Math.max(1, Math.floor(w / 1.15));
  const cw = w / count;
  const rows = d >= 1.9 ? [1, -1] : [1];
  const cd = d / rows.length;
  let k = n;
  for (const side of rows) {
    for (let i = 0; i < count; i++) {
      k++;
      const cab = new THREE.Group();
      const x = -w / 2 + cw * (i + 0.5);
      // Dead machines: the colour is still in the art, gone dull, and the
      // sides are the black of the hull -- a bank of them is a dark wall
      // with faded fronts in it, not a row of painted boards.
      const body = lam(dim(colors[k % colors.length]));
      const hull = lam(0x14151a);
      const cw2 = cw * 0.92;
      // lower body, the control panel stepping in, the upper body and marquee
      box(cab, hull, cw2, h * 0.45, cd * 0.9, 0, h * 0.225, 0);
      const panel = box(cab, hull, cw2, 0.08, cd * 0.45, 0, h * 0.47, cd * 0.2);
      panel.rotation.x = -0.35;
      box(cab, hull, cw2, h * 0.42, cd * 0.6, 0, h * 0.7, -cd * 0.12);
      // the art, a panel on the front of the upper body
      box(cab, body, cw2 * 0.96, h * 0.4, 0.02, 0, h * 0.7, cd * 0.19);
      box(cab, hull, 0.04, h, cd * 0.92, -cw2 / 2, h / 2, 0);
      box(cab, hull, 0.04, h, cd * 0.92, cw2 / 2, h / 2, 0);
      // side art, a stripe, faded
      for (const sx of [-1, 1]) box(cab, body, 0.005, h * 0.5, cd * 0.3, sx * (cw2 / 2 + 0.021), h * 0.62, 0);
      // the screen: dead black, or cracked, or -- one in five -- still on
      const alive = k % 5 === 0;
      const scr = box(cab, alive ? new THREE.MeshBasicMaterial({ map: staticTex(k), color: 0x88aa99 }) : BLACK, cw2 * 0.7, h * 0.24, 0.02, 0, h * 0.68, cd * 0.19);
      scr.rotation.x = -0.12;
      if (!alive && k % 2) {
        // a crack across it
        const crack = box(cab, lam(0x5a6068), cw2 * 0.6, 0.008, 0.005, 0, h * 0.68, cd * 0.2 + 0.012);
        crack.rotation.z = 0.5;
      }
      // the marquee, unlit, with its colour still just there
      box(cab, lam(dim(colors[(k + 2) % colors.length])), cw2 * 0.96, h * 0.1, cd * 0.3, 0, h * 0.94, cd * 0.02);
      // two dead buttons and a stick
      for (const bx of [-0.12, 0.12]) cyl(cab, lam(0x5a1a1a), 0.025, 0.02, bx * cw2, h * 0.5, cd * 0.26);
      cyl(cab, STEEL, 0.012, 0.1, -0.25 * cw2, h * 0.53, cd * 0.24);
      cab.position.set(x, 0, side * cd * 0.5 * (rows.length > 1 ? 1 : 0));
      cab.rotation.y = side > 0 ? 0 : Math.PI;
      // one of them tipped: leaning on its neighbour
      if (k % 7 === 3) cab.rotation.z = 0.06;
      g.add(cab);
    }
  }
}

/** Steel racking, three or four shelves, stacked with boxes and the odd crate. */
function shelf(g: THREE.Group, w: number, h: number, d: number): void {
  const levels = Math.max(2, Math.round(h / 0.9));
  const card = lam(0xa0805a, cardboardTex());
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) box(g, STEEL_DARK, 0.06, h, 0.06, sx * (w / 2 - 0.03), h / 2, sz * (d / 2 - 0.03));
  }
  for (let i = 0; i < levels; i++) {
    const y = 0.15 + (i * (h - 0.25)) / (levels - 1 || 1);
    box(g, STEEL, w, 0.04, d, 0, y, 0);
    // boxes on it, never quite filling it
    if (i === levels - 1 && h > 3) continue;
    let x = -w / 2 + 0.1;
    while (x < w / 2 - 0.3) {
      const bw = 0.35 + rnd() * 0.45;
      if (x + bw > w / 2 - 0.05) break;
      if (rnd() > 0.2) {
        const bh = Math.min(0.2 + rnd() * 0.45, (h - 0.25) / (levels - 1 || 1) - 0.08);
        const bd = d * (0.55 + rnd() * 0.35);
        const b = box(g, card, bw * 0.95, bh, bd, x + bw / 2, y + 0.02 + bh / 2, (rnd() - 0.5) * (d - bd) * 0.8);
        b.rotation.y = (rnd() - 0.5) * 0.2;
      }
      x += bw + 0.04;
    }
  }
}

/** Kitchen units: cupboard doors, a worktop, a sink, a splashback of old tiles. */
function kitchen(g: THREE.Group, w: number, h: number, d: number): void {
  const unit = lam(0x4a4e46);
  box(g, unit, w, h - 0.05, d * 0.92, 0, (h - 0.05) / 2, -d * 0.04);
  box(g, lam(0x6a665e), w + 0.04, 0.05, d, 0, h - 0.025, 0);
  const doors = Math.max(1, Math.floor(w / 0.6));
  for (let i = 0; i < doors; i++) {
    const x = -w / 2 + (w / doors) * (i + 0.5);
    box(g, lam(0x565a50), w / doors - 0.04, h - 0.2, 0.02, x, (h - 0.1) / 2, d / 2 - 0.02);
    box(g, STEEL, 0.1, 0.015, 0.02, x, h - 0.2, d / 2);
  }
  // the sink, and a tap
  box(g, lam(0x8a9096), 0.5, 0.02, d * 0.6, w * 0.2, h + 0.001, 0);
  box(g, BLACK, 0.44, 0.02, d * 0.5, w * 0.2, h + 0.004, 0);
  cyl(g, STEEL, 0.015, 0.25, w * 0.2, h + 0.12, -d * 0.3);
  // old dishes left out
  for (let i = 0; i < 3; i++) cyl(g, lam(0xc8c4b8), 0.1, 0.02 + i * 0.015, -w * 0.25 + i * 0.03, h + 0.02 + i * 0.015, 0);
}

/** A range: four rings, an oven door, a hood that is off. */
function stove(g: THREE.Group, w: number, h: number, d: number): void {
  box(g, lam(0x3a3c40), w, h, d, 0, h / 2, 0);
  box(g, BLACK, w * 0.8, h * 0.5, 0.02, 0, h * 0.4, d / 2 + 0.005);
  box(g, STEEL, w * 0.6, 0.03, 0.03, 0, h * 0.7, d / 2 + 0.02);
  for (const [rx, rz] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 4, 14), BLACK);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(rx * w, h + 0.01, rz * d);
    g.add(ring);
  }
  // a pot, and grease down the front
  cyl(g, STEEL_DARK, 0.14, 0.18, -0.25 * w, h + 0.1, -0.2 * d, 'y', 12);
}

/** A tall steel fridge, one door ajar. */
function fridge(g: THREE.Group, w: number, h: number, d: number): void {
  box(g, lam(0x8a9094), w, h, d * 0.9, 0, h / 2, -d * 0.05);
  const door = new THREE.Group();
  door.position.set(-w / 2, 0, d / 2 - 0.05);
  door.rotation.y = -0.25;
  box(door, lam(0x9aa0a4), w, h * 0.96, 0.05, w / 2, h / 2, 0);
  box(door, STEEL_DARK, 0.03, h * 0.3, 0.04, w - 0.1, h * 0.55, 0.04);
  g.add(door);
  // the dark inside, and a little light still on in there
  box(g, BLACK, w * 0.9, h * 0.9, 0.02, 0, h / 2, d / 2 - 0.08);
  box(g, glow(0x6a7050), 0.08, 0.04, 0.02, 0, h * 0.85, d / 2 - 0.07);
}

/** A food-court table and its fixed stools, on one post. */
function foodTable(g: THREE.Group, w: number, h: number, d: number, color: number): void {
  const top = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.32, Math.min(w, d) * 0.32, 0.04, 18), lam(color));
  top.position.y = h;
  g.add(top);
  cyl(g, STEEL, 0.04, h, 0, h / 2, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const r = Math.min(w, d) * 0.42;
    const sx = Math.cos(a) * r;
    const sz = Math.sin(a) * r;
    cyl(g, STEEL, 0.02, h * 0.55, sx, h * 0.28, sz);
    cyl(g, lam(color ^ 0x202020), 0.14, 0.04, sx, h * 0.56, sz, 'y', 12);
  }
  // somebody's tray, abandoned
  if (rnd() < 0.6) box(g, lam(0xa03a2a), 0.36, 0.02, 0.26, 0.05, h + 0.03, 0.02);
}

/** A party table: a cloth to the floor, hats, cups, and balloons that have lost the will. */
function partyTable(g: THREE.Group, w: number, h: number, d: number, color: number): void {
  box(g, lam(color), w, 0.04, d, 0, h, 0);
  box(g, lam(color), w, h - 0.08, d - 0.04, 0, (h - 0.08) / 2 + 0.06, 0);
  const pal = [0xc83a4a, 0x3a8ac8, 0xe8c040, 0x5ab45a];
  for (let i = 0; i < 5; i++) {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 8), lam(pal[i % pal.length]));
    hat.position.set(-w / 2 + 0.3 + (i * (w - 0.6)) / 4, h + 0.1, (i % 2 ? 1 : -1) * d * 0.25);
    if (i === 2) hat.rotation.z = 1.4;
    g.add(hat);
    cyl(g, lam(0xe8e4d8), 0.035, 0.09, hat.position.x + 0.12, h + 0.05, hat.position.z * -0.6, 'y', 8);
  }
  // two balloons tied to the corner, sagging
  for (const [bx, by, c] of [[w / 2 - 0.1, 1.55, pal[0]], [w / 2 - 0.25, 1.35, pal[1]]] as const) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), lam(c));
    b.scale.set(1, 1.15, 1);
    b.position.set(bx, by, -d / 2 + 0.1);
    g.add(b);
    cyl(g, lam(0xdddddd), 0.003, by - h, bx, (by + h) / 2, -d / 2 + 0.1, 'y', 3);
  }
}

/** A ball pit: padded walls and a shallow sea of faded balls. */
function ballPit(g: THREE.Group, w: number, h: number, d: number): void {
  const pad = lam(0x3a6ab0, vinylTex('#3a6ab0'));
  box(g, pad, w, h, 0.25, 0, h / 2, d / 2 - 0.125);
  box(g, pad, w, h, 0.25, 0, h / 2, -d / 2 + 0.125);
  box(g, pad, 0.25, h, d, w / 2 - 0.125, h / 2, 0);
  box(g, pad, 0.25, h, d, -w / 2 + 0.125, h / 2, 0);
  const pal = [0x9a3a3a, 0x3a5a9a, 0xa0902a, 0x3a8a4a, 0x8a4a9a];
  const mats = pal.map((c) => lam(c));
  const ball = new THREE.SphereGeometry(0.08, 6, 4);
  const count = Math.min(140, Math.floor(w * d * 8));
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(ball, mats[i % mats.length]);
    m.position.set((rnd() - 0.5) * (w - 0.6), h * 0.55 + rnd() * 0.12, (rnd() - 0.5) * (d - 0.6));
    g.add(m);
  }
  // a few out on the floor
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(ball, mats[i % mats.length]);
    m.position.set((rnd() - 0.5) * w * 1.2, 0.08, d / 2 + 0.2 + rnd() * 0.6);
    g.add(m);
  }
}

/** A soft-play climbing frame: posts, platforms, nets, a roof. */
function climbFrame(g: THREE.Group, w: number, h: number, d: number, color: number): void {
  const post = lam(color);
  const pad = lam(0xc8a040, vinylTex('#c8a040'));
  const net = lam(0x2a2a2a);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, post, 0.08, h, sx * (w / 2 - 0.1), h / 2, sz * (d / 2 - 0.1));
  for (const y of [h * 0.35, h * 0.7]) box(g, pad, w - 0.1, 0.12, d - 0.1, 0, y, 0);
  // nets round the sides
  // cargo nets: cords, not a see-through sheet (which would cost the room a
  // shader of its own to build)
  for (const sz of [-1, 1]) {
    const nz = sz * (d / 2 - 0.1);
    for (let i = 0; i <= 6; i++) box(g, net, 0.02, h * 0.65, 0.02, -(w - 0.2) / 2 + (i * (w - 0.2)) / 6, h * 0.55, nz);
    for (let j = 0; j <= 4; j++) box(g, net, w - 0.2, 0.02, 0.02, 0, h * 0.225 + (j * h * 0.65) / 4, nz);
  }
  // the roof, a little pointed
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.6, 0.5, 4), lam(0xb03a3a));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
  roof.position.y = h + 0.2;
  g.add(roof);
  // a padded block at the foot of it
  box(g, lam(0x3a8a4a, vinylTex('#3a8a4a')), w * 0.5, 0.35, 0.5, -w * 0.2, 0.18, d / 2 - 0.3);
}

/** A slide: a ladder up the back, a chute down the front. */
function slide(g: THREE.Group, w: number, h: number, d: number, color: number): void {
  const frame = lam(0x4a4a50);
  for (const sx of [-1, 1]) cyl(g, frame, 0.04, h, sx * (w / 2 - 0.08), h / 2, -d / 2 + 0.1);
  for (let i = 1; i < 6; i++) cyl(g, frame, 0.02, w - 0.16, 0, (i * h) / 6, -d / 2 + 0.1, 'x');
  box(g, frame, w, 0.08, 0.6, 0, h - 0.04, -d / 2 + 0.35);
  const chute = box(g, lam(color), w * 0.8, 0.06, Math.hypot(h, d - 0.6), 0, h / 2, 0.3);
  chute.rotation.x = Math.atan2(h, d - 0.6);
  for (const sx of [-1, 1]) {
    const lip = box(g, lam(color), 0.05, 0.14, Math.hypot(h, d - 0.6), sx * w * 0.4, h / 2 + 0.05, 0.3);
    lip.rotation.x = chute.rotation.x;
  }
}

/** A little stage, a curtain behind it, a dead spotlight on a stand. */
function stage(g: THREE.Group, w: number, h: number, d: number, color: number): void {
  box(g, WOOD, w, h, d, 0, h / 2, 0);
  box(g, lam(0x2a1a14), w, 0.04, d, 0, h + 0.02, 0);
  const curtain = lam(color);
  for (let i = 0; i < 8; i++) {
    const fold = box(g, curtain, w / 8 + 0.02, 2.6, 0.06, -w / 2 + (w / 8) * (i + 0.5), h + 1.3, -d / 2 + 0.06 + (i % 2) * 0.04);
    fold.rotation.y = (i % 2 ? 1 : -1) * 0.06;
  }
  // a stand with a lamp, facing the empty room
  cyl(g, STEEL_DARK, 0.02, 1.4, w / 2 - 0.3, h + 0.7, d / 2 - 0.3);
  cyl(g, STEEL_DARK, 0.1, 0.18, w / 2 - 0.3, h + 1.45, d / 2 - 0.25, 'z');
}

/** A workshop bench: a vice, tools, a pegboard of outlines of tools that are gone. */
function workbench(g: THREE.Group, w: number, h: number, d: number): void {
  box(g, WOOD, w, 0.06, d, 0, h, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, STEEL_DARK, 0.06, h, 0.06, sx * (w / 2 - 0.05), h / 2, sz * (d / 2 - 0.05));
  box(g, STEEL_DARK, w - 0.1, 0.04, d - 0.1, 0, 0.2, 0);
  // the vice
  box(g, lam(0x3a4a6a), 0.18, 0.14, 0.2, -w / 2 + 0.2, h + 0.1, d / 2 - 0.12);
  // tools lying about
  box(g, lam(0xa03a2a), 0.25, 0.03, 0.04, 0.1, h + 0.045, 0.05).rotation.y = 0.5;
  box(g, STEEL, 0.3, 0.02, 0.03, -0.2, h + 0.04, -0.1).rotation.y = -0.3;
  // the pegboard at the back, if the bench is deep enough to have a back
  box(g, lam(0x8a7250), w, 1.0, 0.03, 0, h + 0.6, -d / 2 + 0.02);
  for (let i = 0; i < 5; i++) box(g, BLACK, 0.04 + rnd() * 0.1, 0.2 + rnd() * 0.3, 0.01, -w / 2 + 0.3 + i * (w - 0.6) / 4, h + 0.6, -d / 2 + 0.04);
  // a tool chest beside it on the floor
  box(g, lam(0x8a1a1a), 0.5, 0.6, 0.4, w / 2 - 0.35, 0.3, d / 2 - 0.25);
}

/** A standby generator: the engine block, the exhaust, the stripes, one lamp still on. */
function generator(g: THREE.Group, w: number, h: number, d: number): void {
  box(g, lam(0x3a4a3a), w, h * 0.8, d, 0, h * 0.4, 0);
  box(g, lam(0x2a3a2a), w * 0.9, h * 0.15, d * 0.9, 0, h * 0.87, 0);
  box(g, lam(0xffffff, hazardTex()), w + 0.02, 0.12, d + 0.02, 0, 0.06, 0);
  // the louvres down the side
  for (let i = 0; i < 6; i++) box(g, BLACK, w * 0.6, 0.03, 0.01, 0, h * 0.2 + i * h * 0.08, d / 2 + 0.005);
  // the exhaust, up and into the wall
  cyl(g, STEEL_DARK, 0.08, h * 0.8, w / 2 - 0.2, h * 1.1, -d / 2 + 0.2);
  // its panel: one lamp that is still, somehow, on
  box(g, STEEL_DARK, 0.4, 0.3, 0.03, -w / 2 + 0.35, h * 0.6, d / 2 + 0.01);
  box(g, glow(0xc03020), 0.05, 0.05, 0.02, -w / 2 + 0.25, h * 0.66, d / 2 + 0.03);
  box(g, glow(0x40a040), 0.05, 0.05, 0.02, -w / 2 + 0.4, h * 0.66, d / 2 + 0.03);
}

/** A run of pipes along a wall: several bores, flanges, a valve wheel, a drip stain. */
function pipes(g: THREE.Group, w: number, h: number, d: number): void {
  const along = w >= d;
  const len = along ? w : d;
  const cols = [0x5a4030, 0x4a5058, 0x6a3a2a, 0x3a4a5a];
  for (let i = 0; i < 4; i++) {
    const r = 0.06 + (i % 2) * 0.04;
    const y = 0.3 + i * (h - 0.4) / 3;
    const p = cyl(g, lam(cols[i]), r, len, 0, y, 0, along ? 'x' : 'z', 12);
    p.position.z = along ? (i % 2 ? 0.08 : -0.08) : 0;
    p.position.x = along ? 0 : i % 2 ? 0.08 : -0.08;
    for (let f = 0; f < Math.floor(len / 1.5); f++) {
      const at = -len / 2 + 0.75 + f * 1.5;
      cyl(g, STEEL_DARK, r + 0.03, 0.05, along ? at : p.position.x, y, along ? p.position.z : at, along ? 'x' : 'z', 12);
    }
  }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 16), lam(0x8a2a2a));
  wheel.position.set(along ? len * 0.2 : d / 2 + 0.05, h * 0.5, along ? d / 2 + 0.05 : len * 0.2);
  if (along) wheel.rotation.y = 0;
  else wheel.rotation.y = Math.PI / 2;
  g.add(wheel);
}

/** The security desk: a bank of monitors, all static, one of them showing a room. */
function monitors(g: THREE.Group, w: number, h: number, d: number, n: number): void {
  // the desk
  box(g, lam(0x3a3a40), w, 0.05, d * 0.5, 0, 0.78, d * 0.2);
  box(g, lam(0x2a2a30), w, 0.76, 0.05, 0, 0.38, d * 0.45);
  // the wall of screens behind it
  const cols = Math.max(2, Math.floor(w / 0.55));
  const rows = h > 2.2 ? 3 : 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (w / cols) * (c + 0.5);
      const y = 1.05 + r * 0.45;
      box(g, lam(0x1a1a1c), w / cols - 0.04, 0.42, 0.35, x, y, -d * 0.2);
      box(g, new THREE.MeshBasicMaterial({ map: staticTex(n + r * cols + c), color: 0x9fc0b0 }), w / cols - 0.12, 0.32, 0.01, x, y, -d * 0.2 + 0.18);
    }
  }
  // a chair pushed back, a mug, a clipboard
  cyl(g, lam(0x1a1a1a), 0.25, 0.08, 0.2, 0.48, d * 0.45 + 0.35, 'y', 10);
  cyl(g, STEEL_DARK, 0.03, 0.45, 0.2, 0.22, d * 0.45 + 0.35);
  cyl(g, lam(0xd8d0c0), 0.04, 0.1, -w / 2 + 0.3, 0.85, d * 0.25, 'y', 8);
}

/** An office desk, a chair and a computer that is off. */
function desk(g: THREE.Group, w: number, h: number, d: number, n: number): void {
  box(g, lam(0x6a5a44), w, 0.04, d, 0, h, 0);
  box(g, lam(0x5a4a36), 0.04, h, d, -w / 2 + 0.02, h / 2, 0);
  box(g, lam(0x5a4a36), 0.4, h, d, w / 2 - 0.2, h / 2, 0);
  for (let i = 0; i < 3; i++) box(g, STEEL, 0.1, 0.015, 0.02, w / 2 - 0.2, h * (0.2 + i * 0.28), d / 2 + 0.005);
  // the monitor, one in three still showing a login that nobody will make
  const on = n % 3 === 0;
  box(g, lam(0x2a2a2e), 0.5, 0.36, 0.05, -0.1, h + 0.3, -d * 0.2);
  box(g, on ? glow(0x3a5a7a) : BLACK, 0.44, 0.28, 0.01, -0.1, h + 0.3, -d * 0.2 + 0.03);
  box(g, lam(0x2a2a2e), 0.4, 0.02, 0.15, -0.1, h + 0.01, 0.1);
  // papers everywhere
  for (let i = 0; i < 4; i++) {
    const p = box(g, lam(0xd8d4c4), 0.21, 0.004, 0.29, (rnd() - 0.5) * w * 0.6, h + 0.025 + i * 0.002, (rnd() - 0.5) * d * 0.4);
    p.rotation.y = rnd() * 0.6;
  }
  // the chair, pushed away from it
  const chair = new THREE.Group();
  chair.position.set(0.2, 0, d / 2 + 0.45);
  chair.rotation.y = 0.4 + (n % 3) * 0.3;
  cyl(chair, lam(0x1a1a1e), 0.23, 0.07, 0, 0.47, 0, 'y', 10);
  box(chair, lam(0x1a1a1e), 0.42, 0.45, 0.05, 0, 0.75, 0.2);
  cyl(chair, STEEL_DARK, 0.025, 0.45, 0, 0.22, 0);
  g.add(chair);
}

/** Filing cabinets, a drawer left open. */
function filing(g: THREE.Group, w: number, h: number, d: number): void {
  const count = Math.max(1, Math.floor(w / 0.5));
  for (let i = 0; i < count; i++) {
    const x = -w / 2 + (w / count) * (i + 0.5);
    box(g, lam(0x5a6064), w / count - 0.03, h, d, x, h / 2, 0);
    for (let k = 0; k < 4; k++) {
      const open = (i + k) % 7 === 2;
      box(g, lam(0x6a7074), w / count - 0.08, h / 4 - 0.04, 0.03, x, h * (0.13 + k * 0.25), d / 2 + (open ? 0.3 : 0.01));
      box(g, STEEL_DARK, 0.1, 0.02, 0.03, x, h * (0.2 + k * 0.25), d / 2 + (open ? 0.33 : 0.03));
    }
  }
}

/** Office partition panels: fabric over a frame, pinned-up notes. */
function cubicle(g: THREE.Group, w: number, h: number, d: number, color: number): void {
  box(g, lam(color), w, h, d, 0, h / 2, 0);
  box(g, lam(0x3a3a3e), w + 0.02, 0.05, d + 0.02, 0, h, 0);
  for (let i = 0; i < 6; i++) {
    const note = box(g, lam(rnd() < 0.5 ? 0xd8c860 : 0xe0dcd0), 0.1, 0.1, 0.005, (rnd() - 0.5) * (w - 0.3), h * (0.5 + rnd() * 0.35), d / 2 + 0.004);
    note.rotation.z = (rnd() - 0.5) * 0.3;
  }
}

/**
 * A ventilation duct at floor level: a steel tunnel you can get into on hands
 * and knees and he cannot.  Built HOLLOW -- a roof and two walls, every face
 * drawn from both sides -- so from inside it you see the inside of a duct and
 * not the room through missing walls.  The ends are open, with a grille
 * hanging off its screws at one of them.
 */
function duct(g: THREE.Group, w: number, h: number, d: number): void {
  // Boxes, so both faces of every wall are there to be seen from inside
  // and out without a double-sided material.
  const sheet = new THREE.MeshLambertMaterial({ color: 0x3e434a });
  const along = w >= d;
  const len = along ? w : d;
  const wid = along ? d : w;
  const run = (x: number, z: number, lw: number, ld: number, y: number, hh: number) => box(g, sheet, lw, hh, ld, x, y, z);
  if (along) {
    run(0, 0, len, wid, h - 0.02, 0.04);
    run(0, wid / 2 - 0.02, len, 0.04, h / 2, h);
    run(0, -wid / 2 + 0.02, len, 0.04, h / 2, h);
  } else {
    run(0, 0, wid, len, h - 0.02, 0.04);
    run(wid / 2 - 0.02, 0, 0.04, len, h / 2, h);
    run(-wid / 2 + 0.02, 0, 0.04, len, h / 2, h);
  }
  // seams round it every half metre
  for (let i = 0; i <= Math.floor(len / 0.5); i++) {
    const a = -len / 2 + i * 0.5;
    if (along) box(g, STEEL_DARK, 0.03, 0.03, wid + 0.02, a, h, 0);
    else box(g, STEEL_DARK, wid + 0.02, 0.03, 0.03, 0, h, a);
  }
  // a dark floor inside, seen through the bars
  box(g, lam(0x1a1c1e), along ? len : wid - 0.06, 0.01, along ? wid - 0.06 : len, 0, 0.005, 0);
  // GRILLED SHUT, both ends: a steel frame bolted over the mouth, and bars
  // across it you can see the dark of the duct through and not get through.
  for (const end of [-1, 1]) {
    const grille = new THREE.Group();
    const at = end * (len / 2 + 0.012);
    if (along) grille.position.set(at, 0, 0);
    else grille.position.set(0, 0, at);
    grille.rotation.y = along ? Math.PI / 2 : 0;
    // the frame
    box(grille, STEEL_DARK, wid, 0.05, 0.03, 0, h - 0.04, 0);
    box(grille, STEEL_DARK, wid, 0.05, 0.03, 0, 0.04, 0);
    for (const s of [-1, 1]) box(grille, STEEL_DARK, 0.05, h, 0.03, s * (wid / 2 - 0.025), h / 2, 0);
    // the bars, and a bolt at each corner
    const bars = Math.round(wid / 0.09);
    for (let i = 1; i < bars; i++) box(grille, STEEL, 0.018, h - 0.08, 0.02, -wid / 2 + (i * wid) / bars, h / 2, 0);
    for (const [bx, by] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) box(grille, STEEL, 0.03, 0.03, 0.04, bx * (wid / 2 - 0.05), by ? h - 0.06 : 0.06, 0);
    g.add(grille);
  }
}

/** Steel stairs up to the catwalk: treads, stringers, a handrail. */
function stairs(g: THREE.Group, w: number, h: number, d: number): void {
  const steps = Math.max(4, Math.round(h / 0.2));
  const tread = lam(0x3a3e44);
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) / steps;
    box(g, tread, w, 0.04, d / steps + 0.02, 0, h * t, d / 2 - d * t);
  }
  for (const sx of [-1, 1]) {
    const s = box(g, STEEL_DARK, 0.05, 0.2, Math.hypot(h, d), sx * (w / 2), h / 2, 0);
    s.rotation.x = Math.atan2(h, d);
    const rail = box(g, lam(0xa08a2a), 0.04, 0.04, Math.hypot(h, d), sx * (w / 2), h / 2 + 0.9, 0);
    rail.rotation.x = Math.atan2(h, d);
  }
  // under the stairs, what is kept under stairs
  box(g, lam(0xa0805a, cardboardTex()), w * 0.6, 0.4, 0.5, 0, 0.2, d / 2 - 0.5);
}

/** A mesh cage: the prize stock, locked, a padlock on its door. */
function cage(g: THREE.Group, w: number, h: number, d: number): void {
  const bar = lam(0x4a4e52);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, STEEL_DARK, 0.05, h, 0.05, sx * (w / 2 - 0.025), h / 2, sz * (d / 2 - 0.025));
  // the mesh, as bars: you see in between them, and nothing is transparent
  for (const sz of [-1, 1]) for (let x = -w / 2 + 0.15; x < w / 2; x += 0.15) box(g, bar, 0.015, h, 0.015, x, h / 2, sz * d / 2);
  for (const sx of [-1, 1]) for (let z = -d / 2 + 0.15; z < d / 2; z += 0.15) box(g, bar, 0.015, h, 0.015, sx * w / 2, h / 2, z);
  for (const y of [0.05, h / 2, h - 0.05]) {
    for (const sz of [-1, 1]) box(g, bar, w, 0.02, 0.02, 0, y, sz * d / 2);
    for (const sx of [-1, 1]) box(g, bar, 0.02, 0.02, d, sx * w / 2, y, 0);
  }
  // what is in it: prize boxes, a big plush frog face down
  const card = lam(0xa0805a, cardboardTex());
  for (let i = 0; i < 6; i++) box(g, card, 0.5, 0.4, 0.4, -w / 2 + 0.4 + (i % 3) * 0.6, 0.2 + Math.floor(i / 3) * 0.42, -d / 4);
  const plush = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), lam(0x3a8a4a));
  plush.scale.set(1.2, 0.6, 1);
  plush.position.set(w / 4, 0.25, d / 5);
  g.add(plush);
  // the padlock
  box(g, lam(0x8a7a3a), 0.08, 0.1, 0.04, w / 4, h * 0.45, d / 2 + 0.03);
}

/** A boiler: a tall tank, gauges, pipes out of the top into the ceiling. */
function boiler(g: THREE.Group, w: number, h: number, d: number): void {
  const r = Math.min(w, d) / 2 - 0.05;
  cyl(g, lam(0x5a4a3a), r, h * 0.85, 0, h * 0.425, 0, 'y', 16);
  cyl(g, lam(0x4a3a2a), r * 1.02, 0.1, 0, h * 0.85, 0, 'y', 16);
  cyl(g, STEEL_DARK, 0.1, h * 0.3, r * 0.4, h, 0);
  cyl(g, STEEL_DARK, 0.07, h * 0.3, -r * 0.4, h, 0);
  for (let i = 0; i < 2; i++) {
    cyl(g, lam(0xd8d0c0), 0.08, 0.03, (i - 0.5) * 0.3, h * 0.55, r + 0.01, 'z', 12);
  }
  box(g, glow(0xc86a20), 0.06, 0.06, 0.02, 0, h * 0.3, r + 0.01);
}
