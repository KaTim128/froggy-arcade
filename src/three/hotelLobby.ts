/**
 * ---- THE LOBBY AT LILY'S, IN 3D: one room, built in one place.
 *
 * The janitor's-room scene (HotelLobby3D) watches it through the storage
 * door's window; the police scene (PoliceEscape3D, through policeBuilding)
 * looks out into it through the stairwell's broken door.  Both build it
 * from here, so it is the same lobby, everything where it is: along the
 * back wall (z 0) the concierge desk with its pigeonholes and clocks, the
 * stairwell door under its green EXIT, the lift and the parcel lockers;
 * along the front wall (z DEPTH) the sofa, its low table and the bin under
 * a sconce; the front doors at the x X0 end, the storage room at the X1 end;
 * galleries and chandeliers overhead.
 *
 * In the police scene (`opts.police`) it is the night after: the stairwell
 * door is gone (the building has it lying on the floor), the front doors
 * are smashed in, and only the lights that matter are lit.
 */

import * as THREE from "three";
import {
  texCarpet,
  texLiftDoors,
  texMarble,
  texSign,
  texWainscot,
  texWallpaper,
} from "../art/hotelInterior";

/** 2D lobby x to 3D metres along it. */
export const lx = (px: number): number => (px - 200) * 0.05;

export const X0 = -10; // the front doors' end
export const X1 = 11; // the storage room's end
export const DEPTH = 7;
/** The atrium: the 2D lobby's two floors of galleries go up over it. */
export const CEIL = 6.6;
/** The gallery floors along the back wall, either side of the middle bay. */
export const GALLERY_Y = [3.0, 5.0];
/**
 * The police scene's lobby is the ground floor of a building of 3 m floors,
 * not an atrium: its ceiling sits just under floor 1's, and no gallery,
 * column or wall of it goes on up through the corridors above (the atrium's
 * 6.6 m ceiling stood across floor 2's corridor, and its galleries came
 * through the stairwell wall at floor 1).
 */
export const POLICE_CEIL = 2.95;
export const DADO = 1;
export const DESK_X = lx(160);
export const STAIR_X = lx(238);
export const LIFT_X = lx(280);
/** The storage room door, in the end wall (and the front doors are opposite it). */
export const DOOR_Z = 3.4;
export const DOOR_W = 0.9;
export const DOOR_H = 2.1;
/** Along the front wall, on your left from the storage room: a sofa, its table, a bin. */
export const SOFA_X = 2.6;
export const BIN = new THREE.Vector3(4.7, 0, DEPTH - 0.45);

export interface LobbyOpts {
  /** The police scene's lobby: stair door gone, front doors smashed, fewer lights. */
  police?: boolean;
}

/** The parts a scene moves afterwards. */
export interface LobbyParts {
  stairDoor: THREE.Group | null;
  frontPanes: THREE.Mesh[];
  frontLeaves: THREE.Group[];
  binLid: THREE.Group | null;
}

function tex(c: HTMLCanvasElement, rx = 1, ry = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function canvas(
  w: number,
  h: number,
  paint: (g: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d")!);
  return c;
}

/** Flush oak veneer in long boards over a steel kick strip, for the concierge desk's front. */
function texPanels(cols: number, w = 256, h = 128): HTMLCanvasElement {
  return canvas(w, h, (g) => {
    g.fillStyle = "#b08658";
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < w; k += 2) {
      g.fillStyle = `rgba(90,60,30,${0.04 + ((k * 7) % 5) * 0.015})`;
      g.fillRect(k, 0, 1, h);
    }
    const pw = w / cols;
    for (let i = 1; i < cols; i++) {
      g.fillStyle = "rgba(40,26,12,0.45)";
      g.fillRect(i * pw - 1, 0, 2, h);
    }
    g.fillStyle = "#8a9098";
    g.fillRect(0, h - 10, w, 6);
  });
}

/** The residents' mailboxes: a steel wall of little numbered doors. */
function texPigeonholes(): HTMLCanvasElement {
  return canvas(192, 128, (g) => {
    g.fillStyle = "#5e646c";
    g.fillRect(0, 0, 192, 128);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 6; c++) {
        const x = 6 + c * 31;
        const y = 6 + r * 30;
        const grd = g.createLinearGradient(x, 0, x + 27, 0);
        grd.addColorStop(0, "#a4aab2");
        grd.addColorStop(0.5, "#c4c8ce");
        grd.addColorStop(1, "#9aa0a8");
        g.fillStyle = grd;
        g.fillRect(x, y, 27, 26);
        g.fillStyle = "#2a2d33";
        g.fillRect(x + 6, y + 6, 15, 2);
        g.fillStyle = "#3a3d44";
        g.fillRect(x + 20, y + 16, 3, 3);
        g.fillStyle = "#1e2024";
        g.font = "bold 8px sans-serif";
        g.fillText(`${(r + 1) * 100 + c + 1}`, x + 3, y + 22);
      }
  });
}

/** The stairwell door: a grey steel fire door with a wired-glass slit and a push bar. */
function texStairDoor(): HTMLCanvasElement {
  return canvas(128, 256, (g) => {
    g.fillStyle = "#8a9088";
    g.fillRect(0, 0, 128, 256);
    for (let k = 0; k < 50; k++) {
      g.fillStyle = `rgba(30,34,30,${0.04 + (k % 3) * 0.02})`;
      g.fillRect((k * 23) % 128, (k * 41) % 256, 3, 1);
    }
    g.fillStyle = "#5a605a";
    g.fillRect(44, 18, 40, 76);
    g.fillStyle = "#1e2630";
    g.fillRect(48, 22, 32, 68);
    g.strokeStyle = "rgba(120,140,160,0.6)";
    for (let y = 22; y < 90; y += 10) {
      g.beginPath();
      g.moveTo(48, y);
      g.lineTo(80, y);
      g.stroke();
    }
    g.fillStyle = "#c8c8c0";
    g.fillRect(10, 150, 108, 8);
    g.fillStyle = "#a0201c";
    g.fillRect(34, 112, 60, 18);
    g.fillStyle = "#ffffff";
    g.font = "bold 11px sans-serif";
    g.textAlign = "center";
    g.fillText("STAIRS", 64, 125);
    g.fillStyle = "#6a7078";
    g.fillRect(4, 236, 120, 16);
  });
}

/** Through the front doors: the night, a street lamp, the trees. */
function texNight(): HTMLCanvasElement {
  return canvas(256, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#04060e");
    grad.addColorStop(0.6, "#0c1426");
    grad.addColorStop(1, "#141a22");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#05080a";
    for (let k = 0; k < 9; k++) {
      const x = k * 32 - 8;
      g.beginPath();
      g.moveTo(x, 170);
      g.lineTo(x + 20, 80 + (k % 3) * 20);
      g.lineTo(x + 40, 170);
      g.fill();
    }
    g.fillStyle = "#2a2e34";
    g.fillRect(0, 200, 256, 56);
    const lamp = g.createRadialGradient(190, 120, 2, 190, 120, 70);
    lamp.addColorStop(0, "rgba(255,220,160,0.7)");
    lamp.addColorStop(1, "rgba(255,220,160,0)");
    g.fillStyle = lamp;
    g.fillRect(100, 40, 180, 180);
    g.fillStyle = "#3a3e44";
    g.fillRect(188, 120, 3, 90);
  });
}

export function buildHotelLobby(
  S: THREE.Object3D,
  opts: LobbyOpts = {},
): LobbyParts {
  const CEIL_H = opts.police ? POLICE_CEIL : CEIL;
  const parts: LobbyParts = {
    stairDoor: null,
    frontPanes: [],
    frontLeaves: [],
    binLid: null,
  };
  const paperT = tex(texWallpaper());
  const panelT = tex(texWainscot());
  const paper = (len: number): THREE.MeshLambertMaterial => {
    const t = paperT.clone();
    t.repeat.set(len, 1);
    t.needsUpdate = true;
    return new THREE.MeshLambertMaterial({ map: t });
  };
  const panel = (len: number): THREE.MeshLambertMaterial => {
    const t = panelT.clone();
    t.repeat.set(len, 1);
    t.needsUpdate = true;
    return new THREE.MeshLambertMaterial({ map: t });
  };
  // brushed steel, white paint and light oak: a modern block's lobby
  const brass = new THREE.MeshLambertMaterial({
    color: 0xa8aeb4,
    emissive: 0x101214,
  });
  const cream = new THREE.MeshLambertMaterial({ color: 0xeceae4 });
  const wood = new THREE.MeshLambertMaterial({ color: 0x9a7448 });

  /** A stretch of wall: wallpaper over wainscot, from a to b along it. */
  const wall = (
    a: number,
    b: number,
    at: (m: THREE.Mesh, mid: number) => void,
    top = CEIL_H,
    bottom = 0,
  ): void => {
    const len = b - a;
    if (len <= 0.001) return;
    const mid = (a + b) / 2;
    if (top > DADO) {
      const lo = Math.max(DADO, bottom);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(len, top - lo),
        paper(len),
      );
      m.position.y = (top + lo) / 2;
      at(m, mid);
      S.add(m);
    }
    if (bottom < DADO) {
      const hi = Math.min(DADO, top);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(len, hi - bottom),
        panel(len),
      );
      m.position.y = (hi + bottom) / 2;
      at(m, mid);
      S.add(m);
    }
  };
  const back = (m: THREE.Mesh, mid: number): void => {
    m.position.x = mid;
    m.position.z = 0;
  };
  // the back wall, with the stairwell door's opening in it
  // (in the police scene the opening is the stairwell's own fire door's,
  // 0.9 m, so the one steel frame round it is the whole doorway -- not a
  // wider hole with a second frame inside it)
  const sdHalf = opts.police ? 0.45 : 0.55;
  const sd0 = STAIR_X - sdHalf;
  const sd1 = STAIR_X + sdHalf;
  wall(X0, sd0, back);
  wall(sd1, X1, back);
  // (over it: in the police scene down into the steel frame head, 2.12-2.24,
  // so there is no slit between the head and the wallpaper)
  wall(sd0, sd1, back, CEIL_H, opts.police ? 2.2 : 2.25);
  // the front wall
  wall(X0, X1, (m, mid) => {
    m.position.x = mid;
    m.position.z = DEPTH;
    m.rotation.y = Math.PI;
  });
  // the front doors' end, with the doors' opening
  const fd0 = DOOR_Z - 0.85;
  const fd1 = DOOR_Z + 0.85;
  const left = (m: THREE.Mesh, mid: number): void => {
    m.position.x = X0;
    m.position.z = mid;
    m.rotation.y = Math.PI / 2;
  };
  wall(0, fd0, left);
  wall(fd1, DEPTH, left);
  wall(fd0, fd1, left, CEIL_H, 2.7);
  // the storage room's end, with its door's opening
  const sr0 = DOOR_Z - DOOR_W / 2;
  const sr1 = DOOR_Z + DOOR_W / 2;
  const right = (m: THREE.Mesh, mid: number): void => {
    m.position.x = X1;
    m.position.z = mid;
    m.rotation.y = -Math.PI / 2;
  };
  wall(0, sr0, right);
  wall(sr1, DEPTH, right);
  // (the police scene builds no storage room behind it: the door is shut)
  if (opts.police) {
    wall(sr0, sr1, right, DOOR_H, 0);
    const shut = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W, DOOR_H), new THREE.MeshLambertMaterial({ color: 0x8a7e6a }));
    shut.position.set(X1 - 0.01, DOOR_H / 2, DOOR_Z);
    shut.rotation.y = -Math.PI / 2;
    S.add(shut);
  }
  wall(sr0, sr1, right, CEIL_H, DOOR_H);

  // floor, runner, ceiling, crown
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(X1 - X0, DEPTH),
    new THREE.MeshLambertMaterial({
      map: tex(texMarble(), (X1 - X0) / 2.4, DEPTH / 2.4),
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((X0 + X1) / 2, 0, DEPTH / 2);
  S.add(floor);
  const runner = new THREE.Mesh(
    new THREE.PlaneGeometry(X1 - X0 - 1, 1.1),
    new THREE.MeshLambertMaterial({
      map: tex(texCarpet(), (X1 - X0 - 1) / 1.1, 1),
    }),
  );
  runner.rotation.x = -Math.PI / 2;
  runner.position.set((X0 + X1) / 2, 0.006, DOOR_Z);
  S.add(runner);
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(X1 - X0, DEPTH),
    new THREE.MeshLambertMaterial({ color: 0xeceae4 }),
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set((X0 + X1) / 2, CEIL_H, DEPTH / 2);
  S.add(ceil);
  for (const z of [0.04, DEPTH - 0.04]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, 0.14, 0.08), cream);
    c.position.set((X0 + X1) / 2, CEIL_H - 0.07, z);
    S.add(c);
    // the dado rail, broken for the stairwell doorway on the back wall (run
    // through it, it was a bar across the opening at knee height)
    const runs: [number, number][] = z < 1 ? [[X0, sd0 - 0.09], [sd1 + 0.09, X1]] : [[X0, X1]];
    for (const [a, b] of runs) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(b - a, 0.05, 0.05), brass);
      r.position.set((a + b) / 2, DADO, z);
      S.add(r);
    }
  }

  // ---- the reception desk, the sign, the pigeonholes, the clocks
  const desk = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.1, 0.7), [
    wood,
    wood,
    wood,
    wood,
    new THREE.MeshLambertMaterial({ map: tex(texPanels(3)) }),
    wood,
  ]);
  desk.position.set(DESK_X, 0.55, 1.5);
  S.add(desk);
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(3.75, 0.06, 0.82),
    new THREE.MeshLambertMaterial({ color: 0xf4f3ef }),
  );
  top.position.set(DESK_X, 1.13, 1.5);
  S.add(top);
  // the concierge's monitor on its stand
  const shade = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.32, 0.03),
    new THREE.MeshLambertMaterial({ color: 0x1e2024, emissive: 0x1a3a5a }),
  );
  shade.position.set(DESK_X - 1.2, 1.5, 1.4);
  S.add(shade);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.02, 0.32, 6),
    brass,
  );
  stem.position.set(DESK_X - 1.2, 1.3, 1.4);
  S.add(stem);
  const bell = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    brass,
  );
  bell.position.set(DESK_X + 1.0, 1.16, 1.65);
  S.add(bell);
  const book = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.03, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2a2d33 }),
  );
  book.position.set(DESK_X - 0.4, 1.17, 1.6);
  S.add(book);
  const holes = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.7),
    new THREE.MeshLambertMaterial({ map: tex(texPigeonholes()) }),
  );
  holes.position.set(DESK_X, 2.25, 0.02);
  // (under the police scene's low ceiling: the wall behind the desk is shorter)
  if (opts.police) {
    holes.scale.y = 0.72;
    holes.position.y = 2.0;
  }
  S.add(holes);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 0.5),
    new THREE.MeshLambertMaterial({
      map: tex(texSign("CONCIERGE", "#2a2d33", "#e8eaec", 512, 96)),
    }),
  );
  sign.position.set(DESK_X, 3.45, 0.02);
  if (opts.police) {
    sign.scale.set(0.7, 0.55, 1);
    sign.position.y = 2.79;
  }
  S.add(sign);
  for (const dx of [-1.9, 1.9]) {
    const clock = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 20),
      new THREE.MeshLambertMaterial({ color: 0xf0e8d8 }),
    );
    const cy = opts.police ? 2.55 : 2.9;
    clock.position.set(DESK_X + dx, cy, 0.02);
    S.add(clock);
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.26, 20), brass);
    rim.position.set(DESK_X + dx, cy, 0.021);
    S.add(rim);
  }
  // columns framing the desk
  for (const px of [104, 216]) {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.26, CEIL_H, 16),
      cream,
    );
    col.position.set(lx(px), CEIL_H / 2, 0.32);
    S.add(col);
    for (const y of [0.1, CEIL_H - 0.15]) {
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.22, 0.62),
        y < 1 ? cream : brass,
      );
      cap.position.set(lx(px), y, 0.32);
      S.add(cap);
    }
  }

  // ---- the stairwell door, the dark behind it, the green sign over it
  // (in the police scene the stairwell itself is behind it, and you are in it)
  if (!opts.police) {
    const stairOpening = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 2.25, 1.2),
      new THREE.MeshBasicMaterial({ color: 0x020203, side: THREE.BackSide }),
    );
    stairOpening.position.set(STAIR_X, 1.125, -0.6);
    S.add(stairOpening);
  }
  const frame = new THREE.MeshLambertMaterial({ color: 0x2a1a0e });
  // (the police scene's doorway has the stairwell's steel frame through it)
  if (!opts.police) for (const [w, h, x, y] of [
    [0.08, 2.3, STAIR_X - 0.59, 1.15],
    [0.08, 2.3, STAIR_X + 0.59, 1.15],
    [1.26, 0.1, STAIR_X, 2.3],
  ] as const) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), frame);
    f.position.set(x, y, 0.03);
    S.add(f);
  }
  if (!opts.police) {
    parts.stairDoor = new THREE.Group();
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.08, 2.23, 0.06), [
      wood,
      wood,
      wood,
      wood,
      new THREE.MeshLambertMaterial({ map: tex(texStairDoor()) }),
      wood,
    ]);
    leaf.position.set(0.54, 1.115, 0);
    parts.stairDoor.add(leaf);
    parts.stairDoor.position.set(STAIR_X - 0.54, 0, 0.04);
    S.add(parts.stairDoor);
  }
  const exit = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.22),
    new THREE.MeshBasicMaterial({
      map: tex(texSign("EXIT", "#0e7a3e", "#e8ffe8", 256, 96)),
    }),
  );
  exit.position.set(STAIR_X, 2.62, 0.03);
  S.add(exit);
  // (in the police scene you are standing in that doorway: the green is
  // out over the lobby floor, softer, not on the door's jambs in your face)
  const green = new THREE.PointLight(0x40ff90, opts.police ? 0.5 : 1.6, 4, 1.6);
  green.position.set(STAIR_X, 2.5, opts.police ? 1.6 : 0.5);
  S.add(green);

  // ---- the lift, dead
  const lift = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 2.5),
    new THREE.MeshLambertMaterial({ map: tex(texLiftDoors()) }),
  );
  lift.position.set(LIFT_X, 1.25, 0.02);
  S.add(lift);
  for (const [w, h, x, y] of [
    [0.1, 2.6, LIFT_X - 0.9, 1.3],
    [0.1, 2.6, LIFT_X + 0.9, 1.3],
    [1.9, 0.12, LIFT_X, 2.6],
  ] as const) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), brass);
    f.position.set(x, y, 0.04);
    S.add(f);
  }
  const dial = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.26, 0.04),
    new THREE.MeshLambertMaterial({ color: 0x141820 }),
  );
  dial.position.set(LIFT_X, 2.95, 0.03);
  S.add(dial);

  // ---- along the front wall: a sofa, a low table, and a bin with a lid
  // A lounge sofa in grey woven fabric: three seat cushions on a dark
  // steel plinth.  Its back is to the wall (+z).
  const leather = new THREE.MeshLambertMaterial({
    color: 0x6a7078,
    emissive: 0x0c0d0f,
  });
  const leatherLit = new THREE.MeshLambertMaterial({
    color: 0x7c828a,
    emissive: 0x0e0f11,
  });
  const darkWood = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const brassStud = new THREE.MeshLambertMaterial({ color: 0x6a7078 });
  const sz = DEPTH - 0.55;
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    m: THREE.Material,
  ): THREE.Mesh => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    S.add(b);
    return b;
  };
  // the plinth and its feet
  box(2.1, 0.12, 0.86, SOFA_X, 0.17, sz, darkWood);
  for (const dx of [-0.98, 0.98]) {
    for (const dz of [-0.36, 0.36]) {
      const foot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.025, 0.12, 8),
        darkWood,
      );
      foot.position.set(SOFA_X + dx, 0.06, sz + dz);
      S.add(foot);
    }
  }
  // the seat base, then three cushions with a seam between each
  box(1.7, 0.2, 0.8, SOFA_X, 0.33, sz, leather);
  for (const i of [-1, 0, 1]) {
    box(0.55, 0.13, 0.66, SOFA_X + i * 0.565, 0.495, sz - 0.05, leatherLit);
  }
  // the back, tall and slightly raked, buttoned in a diamond grid
  const sofaBack = box(1.9, 0.62, 0.2, SOFA_X, 0.74, sz + 0.33, leather);
  sofaBack.rotation.x = -0.08;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 7 - row; col++) {
      const btn = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 6, 4),
        darkWood,
      );
      btn.position.set(
        SOFA_X - 0.78 + row * 0.13 + col * 0.26,
        0.68 + row * 0.18,
        sz + 0.22 + row * 0.015,
      );
      S.add(btn);
    }
  }
  // rolled arms: a block with a fat roll along the top, studded with brass
  for (const side of [-1, 1]) {
    const ax = SOFA_X + side * 0.95;
    box(0.2, 0.42, 0.84, ax, 0.44, sz, leather);
    const roll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.86, 14),
      leatherLit,
    );
    roll.rotation.x = Math.PI / 2;
    roll.position.set(ax + side * 0.02, 0.68, sz);
    S.add(roll);
    const scroll = new THREE.Mesh(new THREE.CircleGeometry(0.13, 14), leather);
    scroll.position.set(ax + side * 0.02, 0.68, sz - 0.431);
    scroll.rotation.y = Math.PI;
    S.add(scroll);
    for (let k = 0; k < 6; k++) {
      const stud = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 5, 4),
        brassStud,
      );
      stud.position.set(ax + side * 0.105, 0.26 + k * 0.05, sz - 0.42);
      S.add(stud);
    }
  }
  // a cushion thrown in the corner
  const pillow = box(
    0.32,
    0.3,
    0.12,
    SOFA_X - 0.62,
    0.7,
    sz + 0.12,
    new THREE.MeshLambertMaterial({ color: 0xc8a868 }),
  );
  pillow.rotation.set(-0.3, 0.25, 0.15);

  // The table: a walnut top with a lipped edge, turned legs, a shelf below,
  // and what a hotel leaves on one -- magazines, an ashtray, a lamp-lit vase.
  const tz = sz - 1.05;
  box(1.2, 0.05, 0.6, SOFA_X, 0.45, tz, wood);
  box(1.26, 0.03, 0.66, SOFA_X, 0.415, tz, darkWood);
  box(1.05, 0.03, 0.46, SOFA_X, 0.12, tz, darkWood);
  for (const [dx, dz] of [
    [-0.55, -0.25],
    [0.55, -0.25],
    [-0.55, 0.25],
    [0.55, 0.25],
  ]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 0.4, 8),
      darkWood,
    );
    leg.position.set(SOFA_X + dx, 0.2, tz + dz);
    S.add(leg);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), darkWood);
    knob.position.set(SOFA_X + dx, 0.3, tz + dz);
    S.add(knob);
  }
  for (const [i, col] of [
    [0, 0x2a4a7a],
    [1, 0xd8c8a0],
    [2, 0x7a2a2a],
  ] as const) {
    const mag = box(
      0.28,
      0.012,
      0.2,
      SOFA_X - 0.3 + i * 0.02,
      0.48 + i * 0.012,
      tz + i * 0.015,
      new THREE.MeshLambertMaterial({ color: col }),
    );
    mag.rotation.y = 0.2 - i * 0.25;
  }
  const tray = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.06, 0.03, 12),
    new THREE.MeshLambertMaterial({ color: 0x9aa4ac }),
  );
  tray.position.set(SOFA_X + 0.15, 0.49, tz + 0.1);
  S.add(tray);
  const vase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 0.26, 12),
    new THREE.MeshLambertMaterial({ color: 0x3a6a5a, emissive: 0x0a1a14 }),
  );
  vase.position.set(SOFA_X + 0.38, 0.6, tz - 0.05);
  S.add(vase);
  for (const [dx, dy, dz] of [
    [0, 0.82, 0],
    [-0.05, 0.78, 0.04],
    [0.05, 0.79, -0.03],
  ]) {
    const bloom = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xd8c0a0 }),
    );
    bloom.position.set(SOFA_X + 0.38 + dx, dy, tz - 0.05 + dz);
    S.add(bloom);
  }
  const steel = new THREE.MeshLambertMaterial({
    color: 0xb4bac0,
    emissive: 0x15171a,
  });
  const can = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.2, 0.75, 16),
    steel,
  );
  can.position.set(BIN.x, 0.375, BIN.z);
  S.add(can);
  const inside = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 16),
    new THREE.MeshBasicMaterial({ color: 0x0a0a0a }),
  );
  inside.rotation.x = -Math.PI / 2;
  inside.position.set(BIN.x, 0.74, BIN.z);
  S.add(inside);
  // the lid, hinged at the wall side
  const lid = new THREE.Group();
  lid.position.set(BIN.x, 0.76, BIN.z + 0.24);
  const lidTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, 0.05, 16),
    steel,
  );
  lidTop.position.set(0, 0.02, -0.24);
  lid.add(lidTop);
  const lidKnob = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.04, 0.04),
    brass,
  );
  lidKnob.position.set(0, 0.07, -0.24);
  lid.add(lidKnob);
  S.add(lid);
  parts.binLid = lid;
  // a wall light over them, so they read from the storage room
  const sconce = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.36, 0.08),
    new THREE.MeshLambertMaterial({ color: 0xd8dce0, emissive: 0x807868 }),
  );
  sconce.position.set((SOFA_X + BIN.x) / 2, 2.3, DEPTH - 0.05);
  S.add(sconce);
  const sconceLight = new THREE.PointLight(0xffd090, 2.2, 7, 1.4);
  sconceLight.position.set((SOFA_X + BIN.x) / 2, 2.1, DEPTH - 0.6);
  S.add(sconceLight);

  // ---- THE FRONT WALL, FURNISHED.  It was a long bare stretch of paper
  // with one sofa on it.  Now, along it from the front doors' end: a pair of
  // armchairs round a side table under a wall clock; a console table with
  // a lamp and a mirror over it; a tall plant; the sofa with a big painting
  // over it and a rug under its table; the bin, another plant; a bench with
  // two framed prints over it; and, by the storage door, a radiator and the
  // fire extinguisher on its bracket.  (No new lights: what glows does it
  // with its own colour.)
  {
    const F = DEPTH; // the wall's face
    // a picture: a frame, a mount, and a painted canvas
    const picture = (x: number, y: number, w: number, h: number, paint: (g: CanvasRenderingContext2D, w: number, h: number) => void, frameCol = 0x2a2018): void => {
      box(w + 0.08, h + 0.08, 0.04, x, y, F - 0.03, new THREE.MeshLambertMaterial({ color: frameCol }));
      const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex(canvas(128, Math.round((128 * h) / w), (g) => paint(g, 128, Math.round((128 * h) / w)))) }));
      art.position.set(x, y, F - 0.055);
      art.rotation.y = Math.PI;
      S.add(art);
    };
    // the big one over the sofa: a dark sea under a low storm sky
    picture(SOFA_X - 0.35, 1.95, 1.5, 0.95, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#3a4450');
      sky.addColorStop(0.55, '#8a8470');
      sky.addColorStop(0.56, '#2a3a40');
      sky.addColorStop(1, '#141e22');
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      for (let k = 0; k < 160; k++) {
        g.fillStyle = `rgba(${k % 2 ? '220,210,180' : '20,30,34'},${0.08 + (k % 5) * 0.03})`;
        g.fillRect((k * 37) % w, h * 0.56 + ((k * 13) % (h * 0.44)), 4 + (k % 7), 1);
      }
      g.fillStyle = 'rgba(240,230,200,0.5)';
      g.fillRect(w * 0.62, h * 0.18, 14, 6);
    });
    // two prints over the bench: botanical, a leaf each
    for (const [i, x] of [7.0, 7.9].entries()) {
      picture(x, 1.75, 0.6, 0.8, (g, w, h) => {
        g.fillStyle = '#ece4d0';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = '#4a6a3a';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(w / 2, h * 0.9);
        g.quadraticCurveTo(w * (0.3 + i * 0.4), h * 0.5, w / 2, h * 0.12);
        g.stroke();
        g.fillStyle = '#6a8a4a';
        for (let k = 0; k < 7; k++) {
          const y = h * (0.2 + k * 0.1);
          g.beginPath();
          g.ellipse(w / 2 + (k % 2 ? 14 : -14), y, 14, 6, k % 2 ? -0.5 : 0.5, 0, Math.PI * 2);
          g.fill();
        }
      }, 0xc8b078);
    }
    // the rug under the sofa's table
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.7),
      new THREE.MeshLambertMaterial({
        map: tex(canvas(128, 96, (g) => {
          g.fillStyle = '#5a2a2a';
          g.fillRect(0, 0, 128, 96);
          g.strokeStyle = '#c8a868';
          g.lineWidth = 3;
          g.strokeRect(8, 8, 112, 80);
          g.strokeStyle = '#2a1414';
          g.strokeRect(16, 16, 96, 64);
          g.fillStyle = '#8a4a3a';
          g.beginPath();
          g.ellipse(64, 48, 28, 16, 0, 0, Math.PI * 2);
          g.fill();
        })),
      }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(SOFA_X, 0.009, F - 1.45);
    S.add(rug);
    // tall plants in black pots, either side of the sofa and the bin
    const pot = new THREE.MeshLambertMaterial({ color: 0x1e2024 });
    const leaf = new THREE.MeshLambertMaterial({ color: 0x2e5a32 });
    const leafLit = new THREE.MeshLambertMaterial({ color: 0x4a7a40 });
    const plant = (x: number): void => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.5, 14), pot);
      p.position.set(x, 0.25, F - 0.35);
      S.add(p);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.1, 6), new THREE.MeshLambertMaterial({ color: 0x4a3a24 }));
      stem.position.set(x, 1.0, F - 0.35);
      S.add(stem);
      for (let k = 0; k < 9; k++) {
        const a = k * 2.4;
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), k % 3 ? leaf : leafLit);
        l.scale.set(1.6, 0.35, 0.7);
        l.position.set(x + Math.cos(a) * 0.22, 0.95 + k * 0.1, F - 0.35 + Math.sin(a) * 0.18);
        l.rotation.set(0.4 * Math.sin(a), a, 0.5 * Math.cos(a));
        S.add(l);
      }
    };
    plant(SOFA_X - 1.45);
    plant(BIN.x + 0.8);
    // the console table, its lamp (lit from inside) and the mirror over it
    const cx2 = -1.6;
    box(1.4, 0.04, 0.4, cx2, 0.82, F - 0.24, wood);
    for (const dx of [-0.64, 0.64]) box(0.04, 0.8, 0.36, cx2 + dx, 0.41, F - 0.24, darkWood);
    box(1.3, 0.03, 0.34, cx2, 0.22, F - 0.24, darkWood);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.32, 10), brass);
    base.position.set(cx2 - 0.4, 1.0, F - 0.24);
    S.add(base);
    const shadeM = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.22, 14), new THREE.MeshLambertMaterial({ color: 0xf4ead0, emissive: 0x8a7448 }));
    shadeM.position.set(cx2 - 0.4, 1.27, F - 0.24);
    S.add(shadeM);
    box(0.24, 0.1, 0.18, cx2 + 0.3, 0.89, F - 0.24, new THREE.MeshLambertMaterial({ color: 0x7a2a2a }));
    box(1.1, 1.0, 0.04, cx2, 1.75, F - 0.03, brass);
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.9), new THREE.MeshPhongMaterial({ color: 0x9aa8b0, specular: 0xffffff, shininess: 120, emissive: 0x1a2024 }));
    mirror.position.set(cx2, 1.75, F - 0.055);
    mirror.rotation.y = Math.PI;
    S.add(mirror);
    // two armchairs round a little side table, under a wall clock
    const velvet2 = new THREE.MeshLambertMaterial({ color: 0x4a5a5e });
    for (const [x, turn] of [[-4.6, 0.35], [-3.2, -0.35]] as const) {
      const g = new THREE.Group();
      g.position.set(x, 0, F - 0.6);
      g.rotation.y = Math.PI + turn;
      S.add(g);
      for (const [w, h, d, px, py, pz] of [
        [0.8, 0.4, 0.75, 0, 0.3, 0],
        [0.8, 0.7, 0.16, 0, 0.7, -0.3],
        [0.14, 0.55, 0.75, -0.42, 0.45, 0],
        [0.14, 0.55, 0.75, 0.42, 0.45, 0],
      ] as const) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), velvet2);
        b.position.set(px, py, pz);
        g.add(b);
      }
    }
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 16), wood);
    st.position.set(-3.9, 0.55, F - 0.5);
    S.add(st);
    const stLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.53, 8), darkWood);
    stLeg.position.set(-3.9, 0.27, F - 0.5);
    S.add(stLeg);
    const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshLambertMaterial({ color: 0xf0e8d8 }));
    clockFace.position.set(-3.9, 2.2, F - 0.04);
    clockFace.rotation.y = Math.PI;
    S.add(clockFace);
    const clockRim = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.35, 24), brass);
    clockRim.position.set(-3.9, 2.2, F - 0.035);
    clockRim.rotation.y = Math.PI;
    S.add(clockRim);
    for (const [len, a] of [[0.2, 0.9], [0.26, -1.9]] as const) {
      const hand = box(0.02, len, 0.01, -3.9, 2.2, F - 0.05, darkWood);
      hand.geometry.translate(0, len / 2, 0);
      hand.rotation.z = a;
    }
    // the bench, a coat stand, a radiator, the extinguisher by the storage door
    box(1.6, 0.06, 0.45, 7.45, 0.46, F - 0.3, wood);
    for (const dx of [-0.7, 0.7]) box(0.06, 0.44, 0.4, 7.45 + dx, 0.22, F - 0.3, darkWood);
    box(0.36, 0.05, 0.3, 7.0, 0.51, F - 0.3, new THREE.MeshLambertMaterial({ color: 0x2a4a7a }));
    for (let k = 0; k < 10; k++) box(0.06, 0.6, 0.06, 9.0 + k * 0.1, 0.42, F - 0.08, cream);
    box(1.05, 0.05, 0.08, 9.45, 0.74, F - 0.08, cream);
    const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 12), new THREE.MeshLambertMaterial({ color: 0xb01818, emissive: 0x2a0404 }));
    ext.position.set(10.35, 0.75, F - 0.12);
    S.add(ext);
    box(0.06, 0.08, 0.06, 10.35, 1.04, F - 0.12, darkWood);
    const extSign = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: tex(texSign('FIRE', '#b01818', '#ffffff', 128, 128)) }));
    extSign.position.set(10.35, 1.45, F - 0.02);
    extSign.rotation.y = Math.PI;
    S.add(extSign);
    // the panelling: mouldings marking the wainscot into panels along the wall
    for (let x = X0 + 0.6; x < X1 - 0.3; x += 1.2) box(0.035, DADO - 0.2, 0.02, x, (DADO - 0.2) / 2 + 0.1, F - 0.012, cream);
  }

  // ---- the armchair, the lamp beside it, the trolley past the lift
  const velvet = new THREE.MeshLambertMaterial({ color: 0x5a6068 });
  const cx = lx(69);
  for (const [w, h, d, x, y, z] of [
    [0.9, 0.42, 0.8, cx, 0.32, 0.9],
    [0.9, 0.8, 0.18, cx, 0.75, 0.55],
    [0.16, 0.6, 0.8, cx - 0.48, 0.5, 0.9],
    [0.16, 0.6, 0.8, cx + 0.48, 0.5, 0.9],
  ] as const) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), velvet);
    b.position.set(x, y, z);
    S.add(b);
  }
  const lampPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.03, 1.5, 6),
    brass,
  );
  lampPole.position.set(lx(92), 0.75, 0.5);
  S.add(lampPole);
  const lampShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.24, 0.3, 14),
    new THREE.MeshLambertMaterial({ color: 0xf4f3ef, emissive: 0x3a3428 }),
  );
  lampShade.position.set(lx(92), 1.6, 0.5);
  S.add(lampShade);
  if (!opts.police) {
    const lampLight = new THREE.PointLight(0xffc880, 1.4, 4.5, 1.6);
    lampLight.position.set(lx(92), 1.45, 0.8);
    S.add(lampLight);
  }
  // the parcel lockers past the lift: a bank of steel doors and a screen
  const tx = lx(336);
  const lockers = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.0, 0.45), [
    brass,
    brass,
    brass,
    brass,
    new THREE.MeshLambertMaterial({ map: tex(texPigeonholes()) }),
    brass,
  ]);
  lockers.position.set(tx, 1.0, 0.3);
  S.add(lockers);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.2),
    new THREE.MeshBasicMaterial({ color: 0x5aa0c8 }),
  );
  screen.position.set(tx, 1.4, 0.53);
  S.add(screen);

  // ---- the front doors, the night through them
  const night = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 4),
    new THREE.MeshBasicMaterial({ map: tex(texNight()), fog: false }),
  );
  night.position.set(X0 - 3, 1.6, DOOR_Z);
  night.rotation.y = Math.PI / 2;
  S.add(night);
  const porch = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3),
    new THREE.MeshLambertMaterial({ color: 0x2a2e34 }),
  );
  porch.rotation.x = -Math.PI / 2;
  porch.position.set(X0 - 1.5, 0, DOOR_Z);
  S.add(porch);
  const glass = new THREE.MeshLambertMaterial({
    color: 0x8aa8c8,
    transparent: true,
    opacity: 0.22,
  });
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    const hingeZ = DOOR_Z + side * 0.85;
    g.position.set(X0, 0, hingeZ);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.5, 0.78), glass);
    pane.position.set(0, 1.3, -side * 0.42);
    g.add(pane);
    parts.frontPanes.push(pane);
    for (const [h, y] of [
      [0.1, 0.06],
      [0.08, 2.58],
    ] as const) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.84), brass);
      rail.position.set(0, y, -side * 0.42);
      g.add(rail);
    }
    for (const dz of [0.02, 0.82]) {
      const stile = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 2.6, 0.05),
        brass,
      );
      stile.position.set(0, 1.3, -side * dz);
      g.add(stile);
    }
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.5, 0.03),
      brass,
    );
    handle.position.set(0.04, 1.1, -side * 0.78);
    g.add(handle);
    S.add(g);
    parts.frontLeaves.push(g);
  }
  const moon = new THREE.PointLight(0x7f9ccf, 5, 12, 1.4);
  moon.position.set(X0 + 0.6, 2.4, DOOR_Z);
  S.add(moon);
  // what light is left on: a sconce or two, very low
  // (in the police scene, the building's own lights are already many: only
  // the chandeliers, the sconce, the EXIT and the night through the doors)
  if (!opts.police) {
    for (const x of [lx(104), lx(216), lx(404)]) {
      const sc = new THREE.PointLight(0xffb070, 0.9, 5, 1.6);
      sc.position.set(x, 2.6, 0.5);
      S.add(sc);
    }
    const deskGlow = new THREE.PointLight(0xa0c8ff, 0.8, 3, 1.6);
    deskGlow.position.set(DESK_X - 1.2, 1.35, 1.7);
    S.add(deskGlow);
  }
  // the night after: the front doors smashed in -- the glass gone, the two
  // frames torn off and thrown down outside on the step
  if (opts.police) {
    for (const p of parts.frontPanes) p.visible = false;
    parts.frontLeaves.forEach((g, i) => {
      g.position.set(X0 - 1.2 - i * 0.5, 0.03, DOOR_Z + (i ? 0.9 : -0.8));
      g.rotation.set(0, i ? 0.4 : -0.5, Math.PI / 2 - 0.04);
    });
    const glassBits = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.03, 3),
      new THREE.MeshLambertMaterial({
        color: 0xc8dce6,
        side: THREE.DoubleSide,
        emissive: 0x2a3a44,
      }),
      120,
    );
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let seed = 41;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 120; k++) {
      q.setFromEuler(new THREE.Euler(-Math.PI / 2, r() * 6, 0));
      const sc = 0.4 + r() * 1.3;
      m4.compose(
        new THREE.Vector3(
          X0 + 0.15 + Math.pow(r(), 1.6) * 3,
          0.012,
          DOOR_Z + (r() - 0.5) * 3,
        ),
        q,
        new THREE.Vector3(sc, sc, 1),
      );
      glassBits.setMatrixAt(k, m4);
    }
    S.add(glassBits);
  }

  buildAtrium(S, brass, cream, opts);
  return parts;
}

/**
 * ---- THE ATRIUM, as the 2D lobby draws it: either side of the middle
 * bay, two floors of galleries along the back wall -- a cream slab, a gold
 * rail on cream balusters, room doors behind -- and the middle bay open to
 * the ceiling, with the great chandelier in it and a smaller one over each
 * side.
 */
function buildAtrium(
  S: THREE.Object3D,
  brass: THREE.Material,
  cream: THREE.Material,
  opts: LobbyOpts,
): void {
  const CEIL_H = opts.police ? POLICE_CEIL : CEIL;
  const bays: Array<[number, number]> = [
    [X0, lx(104) - 0.32],
    [lx(216) + 0.32, X1],
  ];
  for (const [a, b] of bays) {
    const len = b - a;
    const mid = (a + b) / 2;
    // (none in the police scene's single-height lobby: see POLICE_CEIL)
    for (const gy of opts.police ? [] : GALLERY_Y) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(len, 0.2, 1.0), cream);
      slab.position.set(mid, gy - 0.1, 0.5);
      S.add(slab);
      const fascia = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.06, 0.04),
        brass,
      );
      fascia.position.set(mid, gy - 0.12, 1.02);
      S.add(fascia);
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.06, 0.08),
        brass,
      );
      rail.position.set(mid, gy + 0.95, 0.96);
      S.add(rail);
      // a glass balustrade under the steel rail
      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.9, 0.02),
        new THREE.MeshLambertMaterial({
          color: 0xbcd8e4,
          transparent: true,
          opacity: 0.28,
        }),
      );
      pane.position.set(mid, gy + 0.47, 0.96);
      S.add(pane);
      // (no doors along the galleries: plain wall behind the rail)
    }
  }
  // the pendant lights: clusters of glass globes on long black flexes
  const globeM = new THREE.MeshLambertMaterial({
    color: 0xf4f8fa,
    emissive: 0x908a78,
  });
  const flex = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const chandelier = (
    x: number,
    y: number,
    z: number,
    r: number,
    power: number,
  ): void => {
    const n = Math.max(3, Math.round(r * 7));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const px = x + Math.cos(a) * r * 0.6;
      const pz = z + Math.sin(a) * r * 0.6;
      const py = y - (k % 3) * 0.25;
      const cord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, CEIL_H - py, 4),
        flex,
      );
      cord.position.set(px, (CEIL_H + py) / 2, pz);
      S.add(cord);
      const globe = new THREE.Mesh(
        new THREE.SphereGeometry(0.11 + r * 0.05, 12, 8),
        globeM,
      );
      globe.position.set(px, py, pz);
      S.add(globe);
    }
    if (opts.police && r < 0.8) return;
    const light = new THREE.PointLight(0xfff0d8, power, 9 + r * 4, 1.3);
    light.position.set(x, y - 0.3, z);
    S.add(light);
  };
  // (under the low ceiling, the great one hangs as low as the small ones)
  chandelier(DESK_X, opts.police ? 2.55 : 4.4, 2.0, 0.85, 5.5);
  chandelier(lx(36), opts.police ? 2.45 : 2.55, 2.4, 0.5, 2.8);
  chandelier(lx(360), opts.police ? 2.45 : 2.55, 2.4, 0.5, 2.8);
}
