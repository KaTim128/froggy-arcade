/**
 * MORE KINDS OF PLACE TO HIDE, WITHOUT MORE KINDS OF HIDING.
 *
 * The hunt knows four things: something with a LID (he lifts it), something
 * with a DOOR (a cupboard, or a locker with a lever that turns first), and
 * something you get UNDER (he goes down on his hands and lifts what hangs over
 * the gap).  Everything here is one of those four, dressed as something else:
 *
 *   lid:    a slatted produce crate, a prize box, a toy chest
 *   door:   a steel maintenance cabinet, a hatch in a false wall
 *   locker: a dead arcade cabinet you climb into through its back
 *   under:  a table with a cloth to the floor, a bench under a dust sheet,
 *           a playground crawl tube with a flap-strip curtain
 *
 * THE CONTRACT IS THE ONE `hideSpots` KEEPS.  Same footprint, same pivot in
 * the same place, the same grip points -- so how he opens it, how long it
 * takes, how loud it is and what you can see from inside are exactly the
 * spot's kind.  Only what it looks like, and what the inside of it looks like
 * from where you are crouched (see `SpotSkin` in the peephole), differ.
 */

import * as THREE from 'three';
import { bake } from './bake';
import type { SpotKind, SpotSkin } from './hideRooms';
import { buildBedSpot, buildChestSpot, buildDoorSpot, CHEST_SCALE, type BuiltSpot } from './hideSpots';

const lam = (color: number, map?: THREE.Texture): THREE.MeshLambertMaterial =>
  new THREE.MeshLambertMaterial(map ? { color, map } : { color });
const DARK = new THREE.MeshBasicMaterial({ color: 0x0c0d10 });
const STEEL = lam(0x4a5058);
const STEEL_DARK = lam(0x2a2e34);

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
function grip(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
  const g = new THREE.Object3D();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

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

/**
 * A party tablecloth: faded red gingham on cream, the hang of the folds
 * shaded down it, and a stitched hem along the bottom when it is a drape.
 * Drawn at the shape of the panel it covers, so the checks stay square.
 */
function clothTex(key: string, w: number, h: number, hem: boolean): THREE.CanvasTexture {
  return tex(`cloth:${key}`, w, h, (c) => {
    c.fillStyle = '#d6ccb8';
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(160, 58, 52, 0.28)';
    for (let x = 0; x < w; x += 8) c.fillRect(x, 0, 4, h);
    for (let y = 0; y < h; y += 8) c.fillRect(0, y, w, 4);
    // where the two stripes cross, the red is doubled
    c.fillStyle = 'rgba(140, 40, 38, 0.18)';
    for (let x = 0; x < w; x += 8) for (let y = 0; y < h; y += 8) c.fillRect(x, y, 4, 4);
    if (hem) {
      // the folds: a soft shadow down each one, a lighter ridge beside it
      for (let x = 10; x < w; x += 22) {
        c.fillStyle = 'rgba(0, 0, 0, 0.16)';
        c.fillRect(x, 0, 3, h);
        c.fillStyle = 'rgba(0, 0, 0, 0.08)';
        c.fillRect(x + 3, 0, 2, h);
        c.fillStyle = 'rgba(255, 255, 255, 0.07)';
        c.fillRect(x - 2, 0, 2, h);
      }
      // the hem, and the stitching along it
      c.fillStyle = 'rgba(90, 30, 28, 0.55)';
      c.fillRect(0, h - 4, w, 4);
      c.fillStyle = 'rgba(230, 220, 200, 0.6)';
      for (let x = 1; x < w; x += 3) c.fillRect(x, h - 3, 1, 1);
    }
  });
}

/** Rough boards with gaps: a crate. */
function slatTex(): THREE.CanvasTexture {
  return tex('slats', 64, 64, (c) => {
    c.fillStyle = '#0a0806';
    c.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 13) {
      c.fillStyle = y % 26 ? '#8a6a3e' : '#7a5a32';
      c.fillRect(0, y, 64, 10);
      c.fillStyle = 'rgba(0,0,0,0.2)';
      c.fillRect(0, y + 8, 64, 2);
    }
    c.fillStyle = 'rgba(40,20,10,0.7)';
    c.font = 'bold 10px monospace';
    c.fillText('FRAGILE', 8, 36);
  });
}

/** Gift wrap gone soft: stripes, stars, a torn corner. */
function giftTex(base: string, stripe: string): THREE.CanvasTexture {
  return tex(`gift:${base}`, 64, 64, (c) => {
    c.fillStyle = base;
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = stripe;
    for (let x = -64; x < 64; x += 16) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 6, 0);
      c.lineTo(x + 70, 64);
      c.lineTo(x + 64, 64);
      c.fill();
    }
    c.fillStyle = 'rgba(255,240,200,0.7)';
    for (const [sx, sy] of [[12, 14], [44, 22], [26, 48], [52, 54]]) {
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r = i % 2 ? 2 : 5;
        c.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
      }
      c.fill();
    }
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.fillRect(0, 56, 64, 8);
  });
}

/** Printed vinyl: primary colours, a frog, scuffed. */
function tubeTex(base: string): THREE.CanvasTexture {
  return tex(`tube:${base}`, 64, 32, (c) => {
    c.fillStyle = base;
    c.fillRect(0, 0, 64, 32);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(0, 4, 64, 3);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 18; i++) c.fillRect((i * 37) % 64, (i * 13) % 32, 3, 1);
  });
}

/**
 * Build the spot `kind` wearing `skin`, into `group` (already placed and
 * turned by the room).  No skin, or the kind's own, is the original build.
 */
export function buildSkinnedSpot(group: THREE.Group, kind: SpotKind, skin: SpotSkin | undefined, number: number): BuiltSpot {
  const built = buildRaw(group, kind, skin, number);
  // The body never moves and the moving part moves as one piece (apart from
  // a locker's lever), so each is merged down to a mesh per material.
  bake(group);
  bake(built.hinge, built.lever ? [built.lever] : []);
  return built;
}

function buildRaw(group: THREE.Group, kind: SpotKind, skin: SpotSkin | undefined, number: number): BuiltSpot {
  switch (skin) {
    case 'crate':
    case 'prize':
    case 'toybox':
      if (kind === 'chest') return lidBox(group, skin);
      break;
    case 'cabinet':
    case 'hatch':
      if (kind === 'cupboard') return steelCupboard(group, skin);
      break;
    case 'arcade':
      if (kind === 'locker') return arcadeLocker(group, number);
      break;
    case 'table':
    case 'bench':
    case 'tunnel':
      if (kind === 'bed') return under(group, skin);
      break;
  }
  return kind === 'bed' ? buildBedSpot(group) : kind === 'chest' ? buildChestSpot(group) : buildDoorSpot(group, kind === 'locker', number);
}

// ------------------------------------------------------------------ lids

/** Chest-sized, lid on the chest's pivot (see buildChestSpot): 1.1 x 0.8, lid at 0.7. */
function lidBox(group: THREE.Group, skin: 'crate' | 'prize' | 'toybox'): BuiltSpot {
  group.scale.setScalar(CHEST_SCALE);
  const body =
    skin === 'crate'
      ? lam(0x9a7a4a, slatTex())
      : skin === 'prize'
        ? lam(0xffffff, giftTex('#b03a5a', '#e8c040'))
        : lam(0x3a6ab0);
  // four walls and a floor
  box(group, body, 1.1, 0.66, 0.05, 0, 0.35, 0.375);
  box(group, body, 1.1, 0.66, 0.05, 0, 0.35, -0.375);
  for (const sx of [-1, 1]) box(group, body, 0.05, 0.66, 0.8, sx * 0.525, 0.35, 0);
  box(group, DARK, 1.0, 0.02, 0.7, 0, 0.06, 0);
  if (skin === 'crate') {
    // corner posts and a stencil
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(group, lam(0x6a4a26), 0.07, 0.68, 0.07, cx * 0.52, 0.35, cz * 0.37);
    box(group, lam(0x6a4a26), 1.12, 0.06, 0.06, 0, 0.1, 0.39);
  } else if (skin === 'prize') {
    // ribbon down the front and a bow that has come undone
    box(group, lam(0xe8c040), 0.1, 0.66, 0.02, 0, 0.35, 0.41);
    box(group, lam(0xe8c040), 0.1, 0.66, 0.02, 0, 0.35, -0.41);
    // a tag
    const tagM = box(group, lam(0xe8e0c8), 0.14, 0.09, 0.01, 0.3, 0.5, 0.405);
    tagM.rotation.z = 0.2;
  } else {
    // a toy chest: bright panels and painted letters
    const pal = [0xc83a3a, 0xe8c040, 0x3aa05a];
    for (let i = 0; i < 3; i++) box(group, lam(pal[i]), 0.26, 0.26, 0.02, -0.33 + i * 0.33, 0.38, 0.405);
    // a teddy's arm hanging out under the lid
    const arm = cyl(group, lam(0x8a6a4a), 0.035, 0.18, 0.28, 0.62, 0.41, 'y', 8);
    arm.rotation.z = 0.3;
  }

  const hinge = new THREE.Group();
  hinge.position.set(0, 0.7, -0.4);
  const lidMat = skin === 'crate' ? lam(0x8a6a3e, slatTex()) : skin === 'prize' ? lam(0xffffff, giftTex('#b03a5a', '#e8c040')) : lam(0x2a5a9a);
  box(hinge, lidMat, 1.12, 0.06, 0.82, 0, 0, 0.4);
  if (skin === 'prize') {
    // the ribbon over the lid, and the bow
    box(hinge, lam(0xe8c040), 0.1, 0.02, 0.82, 0, 0.04, 0.4);
    box(hinge, lam(0xe8c040), 1.12, 0.02, 0.1, 0, 0.04, 0.4);
    for (const s of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 12), lam(0xe8c040));
      loop.position.set(s * 0.07, 0.1, 0.4);
      loop.rotation.set(0, Math.PI / 2, s * 0.6);
      hinge.add(loop);
    }
  } else if (skin === 'toybox') {
    box(hinge, lam(0xe8c040), 1.0, 0.02, 0.1, 0, 0.04, 0.78);
  } else {
    for (const bx of [-0.4, 0, 0.4]) box(hinge, lam(0x6a4a26), 0.06, 0.03, 0.82, bx, 0.04, 0.4);
  }
  const grips = [grip(hinge, -0.36, -0.02, 0.84), grip(hinge, 0.36, -0.02, 0.84)];
  return { hinge, grips };
}

// ----------------------------------------------------------------- doors

/**
 * Cupboard-sized (1.2 wide, 1.8 tall, 0.75 deep), door on the cupboard's
 * pivot: a steel maintenance cabinet, or a hatch in a panelled false wall.
 */
function steelCupboard(group: THREE.Group, skin: 'cabinet' | 'hatch'): BuiltSpot {
  const h = 1.8;
  const w = 1.2;
  const hatch = skin === 'hatch';
  const body = hatch ? lam(0x5a4a3a) : lam(0x5a6a5a);
  box(group, body, w, h - 0.08, 0.06, 0, h / 2, -0.345);
  for (const sx of [-1, 1]) box(group, body, 0.05, h, 0.75, sx * (w / 2 - 0.025), h / 2, 0);
  box(group, body, w, 0.06, 0.78, 0, h - 0.03, 0);
  box(group, body, w, 0.06, 0.78, 0, 0.03, 0);
  box(group, DARK, w - 0.1, h - 0.2, 0.02, 0, h / 2, -0.3);
  if (hatch) {
    // the false wall it is set into: panels either side and above, flush with the front
    for (const sx of [-1, 1]) box(group, lam(0x4a3a2c), 0.08, h + 0.5, 0.8, sx * (w / 2 + 0.04), (h + 0.5) / 2, 0);
    box(group, lam(0x4a3a2c), w + 0.16, 0.5, 0.8, 0, h + 0.25, 0);
  } else {
    // a hazard sticker and a sign
    box(group, new THREE.MeshLambertMaterial({ color: 0xc8a020 }), 0.3, 0.14, 0.01, 0, h - 0.25, 0.4);
  }
  const hinge = new THREE.Group();
  hinge.position.set(-w / 2, h / 2, 0.38);
  const door = hatch ? lam(0x6a5440) : lam(0x6a7a6a);
  box(hinge, door, w, h - 0.12, 0.05, w / 2, 0, 0);
  if (hatch) {
    // wall panelling on the hatch too, so shut it is only a seam
    for (const py of [0.45, -0.1, -0.6]) box(hinge, lam(0x5a4632), w * 0.9, 0.3, 0.02, w / 2, py, 0.03);
    box(hinge, STEEL_DARK, 0.04, 0.12, 0.03, w - 0.12, 0, 0.04);
  } else {
    // louvres, a T-handle, a padlock hasp hanging open
    for (let i = 0; i < 6; i++) box(hinge, DARK, w * 0.5, 0.02, 0.01, w / 2, 0.55 - i * 0.05, 0.028);
    box(hinge, STEEL, 0.04, 0.2, 0.04, w - 0.14, 0, 0.05);
    box(hinge, STEEL, 0.12, 0.03, 0.04, w - 0.14, 0.08, 0.06);
    box(hinge, lam(0x8a7a3a), 0.05, 0.07, 0.02, w - 0.14, -0.14, 0.05);
  }
  for (const hy of [0.6, 0, -0.6]) cyl(hinge, STEEL, 0.016, 0.1, 0, hy, 0.02);
  return { hinge, grips: [grip(hinge, w - 0.14, 0, 0.16)] };
}

/**
 * Locker-sized (0.9 wide, 2.0 tall): a dead arcade cabinet, its back panel
 * swung away, and room inside for one person folded up small.  The door is
 * the back panel, on the locker's pivot, with the locker's lever -- the
 * coin-door key he turns before it comes.
 */
function arcadeLocker(group: THREE.Group, number: number): BuiltSpot {
  const h = 2.0;
  const w = 0.9;
  const colors = [0x6a2a4a, 0x2a4a6a, 0x4a6a2a, 0x6a4a2a];
  const art = lam(colors[number % colors.length]);
  const hull = lam(0x14151a);
  // the cabinet faces AWAY from the opening: its screen is on the back (-z)
  for (const sx of [-1, 1]) box(group, art, 0.05, h, 0.75, sx * (w / 2 - 0.025), h / 2, 0);
  box(group, hull, w, h - 0.08, 0.06, 0, h / 2, -0.345);
  box(group, art, w, 0.25, 0.4, 0, h - 0.12, -0.2);
  box(group, hull, w, 0.08, 0.72, 0, 0.04, 0);
  box(group, DARK, w - 0.1, h - 0.2, 0.02, 0, h / 2, -0.3);
  // on the far side, the screen and panel, dead
  box(group, lam(0x0a0a0c), w * 0.7, 0.45, 0.02, 0, h * 0.68, -0.38);
  const panel = box(group, hull, w * 0.9, 0.06, 0.3, 0, h * 0.48, -0.5);
  panel.rotation.x = 0.35;
  const hinge = new THREE.Group();
  hinge.position.set(-w / 2, h / 2, 0.38);
  box(hinge, hull, w, h - 0.12, 0.04, w / 2, 0, 0);
  // the back of a machine: vents, a warning label, the coin door's lock
  for (let i = 0; i < 6; i++) box(hinge, DARK, w * 0.5, 0.02, 0.01, w / 2, 0.55 - i * 0.05, 0.022);
  box(hinge, lam(0xd8d0b8), 0.22, 0.14, 0.01, w / 2, -0.2, 0.022);
  const pivot = new THREE.Group();
  pivot.position.set(w - 0.14, 0, 0.04);
  hinge.add(pivot);
  box(pivot, STEEL_DARK, 0.08, 0.12, 0.012, 0, 0, -0.012);
  cyl(pivot, STEEL, 0.018, 0.04, 0, 0, 0.01, 'z');
  box(pivot, STEEL, 0.03, 0.12, 0.02, 0, -0.05, 0.025);
  return { hinge, grips: [grip(hinge, w - 0.14, 0, 0.16)], lever: pivot };
}

// ----------------------------------------------------------------- under

/**
 * Bed-sized (2.3 x 1.0): something low you get under, with what hangs over
 * the gap on the bed's own pivot (a blanket's, at the far edge) -- a table's
 * cloth, a dust sheet over a bench, or the flap strips over a crawl tube's
 * side opening.
 */
function under(group: THREE.Group, skin: 'table' | 'bench' | 'tunnel'): BuiltSpot {
  if (skin === 'tunnel') return tunnel(group);
  const table = skin === 'table';
  const top = table ? 0.78 : 0.58;
  const legs = STEEL_DARK;
  // the frame underneath: legs and a top
  for (const [lx, lz] of [[-1.05, -0.42], [1.05, -0.42], [-1.05, 0.42], [1.05, 0.42]]) cyl(group, legs, 0.03, top, lx, top / 2, lz);
  box(group, table ? lam(0x6a5038) : lam(0x5a4a3a), 2.2, 0.05, 0.95, 0, top, 0);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.0), new THREE.MeshBasicMaterial({ color: 0x060607, transparent: true, opacity: 0.8 }));
  under.rotation.x = -Math.PI / 2;
  under.position.set(0, 0.01, 0);
  group.add(under);
  // the cloth hanging at the ends and the back, fixed.  The table's is a
  // real tablecloth -- checked, folded, hemmed -- and toned down, because a
  // plain pale cloth in the torch at a metre burned out to a white block.
  const drapeCloth = table ? lam(0xc9c0b0, clothTex('drape', 128, 40, true)) : lam(0x6e6b62);
  const endCloth = table ? lam(0xc9c0b0, clothTex('end', 56, 40, true)) : drapeCloth;
  const topCloth = table ? lam(0xc9c0b0, clothTex('top', 128, 56, false)) : drapeCloth;
  box(group, endCloth, 0.03, top - 0.08, 1.0, -1.12, top / 2 + 0.05, 0);
  box(group, endCloth, 0.03, top - 0.08, 1.0, 1.12, top / 2 + 0.05, 0);
  box(group, drapeCloth, 2.26, top - 0.08, 0.03, 0, top / 2 + 0.05, -0.51);
  // ---- THE FRONT, over the gap, on the blanket's pivot at the far edge
  const hinge = new THREE.Group();
  hinge.position.set(0, top + 0.03, -0.5);
  box(hinge, topCloth, 2.26, 0.02, 1.04, 0, 0, 0.5);
  const drape = box(hinge, drapeCloth, 2.26, top - 0.1, 0.03, 0, -(top - 0.1) / 2, 1.02);
  drape.rotation.x = 0.03;
  if (table) {
    // a place laid on it, a cake with a candle, gone grey
    cyl(hinge, lam(0x9a8a7a), 0.18, 0.14, 0.3, 0.08, 0.5, 'y', 14);
    cyl(hinge, lam(0xe8e0d0), 0.01, 0.08, 0.3, 0.19, 0.5, 'y', 4);
    for (let i = 0; i < 4; i++) cyl(hinge, lam(0xd8d0c0), 0.09, 0.01, -0.8 + i * 0.4, 0.015, 0.25 + (i % 2) * 0.5, 'y', 12);
  } else {
    // the sheet's creases, and a shape under it that is only the bench
    for (let i = 0; i < 4; i++) box(hinge, lam(0x8a867a), 0.02, 0.02, 1.0, -0.8 + i * 0.5, 0.012, 0.5);
  }
  const grips = [grip(hinge, -0.45, 0.02, 1.0), grip(hinge, 0.45, 0.02, 1.0)];
  return { hinge, grips };
}

/** A crawl tube 2.3 long lying along x, its side opening hung with flap strips. */
function tunnel(group: THREE.Group): BuiltSpot {
  const r = 0.5;
  // The tube, as staves round its length -- open along the front for the
  // doorway -- so the inside is the inside of boxes, not a double-sided
  // surface (one fewer shader to build on the way into a room).
  const shell = lam(0xffffff, tubeTex('#c84a3a'));
  const staves = 14;
  for (let i = 0; i < staves; i++) {
    const a = Math.PI * 0.22 + (i / (staves - 1)) * Math.PI * 1.56;
    const st = box(group, shell, 2.25, 0.05, 0.24, 0, r + 0.02 + Math.cos(a) * r, Math.sin(a) * r * -1);
    st.rotation.x = a;
  }
  // padded rings at each end, and the frame it sits in
  for (const ex of [-1.12, 1.12]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 8, 20), lam(0xe8c040));
    ring.rotation.y = Math.PI / 2;
    ring.position.set(ex, r + 0.02, 0);
    group.add(ring);
  }
  box(group, lam(0x3a8a4a), 2.3, 0.08, 0.9, 0, 0.04, 0);
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.8), new THREE.MeshBasicMaterial({ color: 0x0a0506 }));
  inside.rotation.x = -Math.PI / 2;
  inside.position.set(0, 0.09, 0);
  group.add(inside);
  // ---- THE FLAPS: hung from the top of the opening, on the bed's pivot line
  // (the blanket's hinge is at the far edge; here the curtain hangs from a
  // rail along the top of the tube, and lifts the same way).
  const hinge = new THREE.Group();
  hinge.position.set(0, r * 2 + 0.02, -0.5);
  const flap = lam(0x4a6070);
  // (the pivot is at the far edge like a blanket's, so the rail and the
  // strips hanging from it are a metre in front of it, across the opening)
  box(hinge, lam(0xe8c040), 2.25, 0.04, 0.06, 0, 0, 1.0);
  for (let i = 0; i < 9; i++) {
    const s = box(hinge, flap, 0.22, 0.85, 0.01, -1.0 + i * 0.25, -0.44, 1.02);
    s.rotation.z = (i % 3 - 1) * 0.02;
  }
  const grips = [grip(hinge, -0.45, -0.8, 1.04), grip(hinge, 0.45, -0.8, 1.04)];
  return { hinge, grips };
}
