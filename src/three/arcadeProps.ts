/**
 * The things in an arcade that are not boxes.
 *
 * The 3D arcade was built out of the same coloured cuboids every other room's
 * furniture is built out of, and in a room whose whole job is to be recognised
 * as the arcade the player spent the first half of the game in, a wall of
 * glowing bricks is not a recognition — it is a colour scheme.
 *
 * A cabinet is a shape before it is anything else: a tall box that steps IN at
 * the waist for the control panel and OUT again at the top for the marquee.
 * That step is the whole silhouette, and it is what the eye is actually
 * reading when it says "arcade" — more than the art, more than the screen.
 *
 * Everything that is meant to be lit is `MeshBasicMaterial`.  A marquee is
 * backlit and a screen is a screen: in a room this dark, a Lambert surface
 * with no lamp near it is black, and a cabinet whose marquee goes out is a
 * wardrobe.  The glow is also the only light most of this room has, which is
 * why the machines read from across the floor and the floor does not.
 */

import * as THREE from 'three';

/**
 * One upright cabinet, built facing +Z with its feet at y = 0 and its origin
 * in the middle of its footprint.  `w` is across the front, `d` front to back.
 */
export function buildCabinet(
  w: number,
  h: number,
  d: number,
  color: number,
  grunge: THREE.Texture | null,
): THREE.Group {
  const g = new THREE.Group();
  const lam = (c: number, map = true) =>
    new THREE.MeshLambertMaterial(map && grunge ? { color: c, map: grunge } : { color: c });
  const lit = (c: number) => new THREE.MeshBasicMaterial({ color: c });

  const hull = lam(0x1a1c24);
  const art = lam(color);

  const add = (
    mat: THREE.Material,
    sx: number,
    sy: number,
    sz: number,
    px: number,
    py: number,
    pz: number,
    rx = 0,
  ) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(px, py, pz);
    if (rx) m.rotation.x = rx;
    g.add(m);
    return m;
  };

  const front = d / 2;
  const panel = 0.1;
  // ---- the two side panels.  These carry the art, and they are the only
  // parts of a cabinet anybody ever really looks at from the side.
  for (const side of [-1, 1]) {
    add(art, panel, h, d, side * (w / 2 - panel / 2), h / 2, 0);
  }
  // back and floor of the box between them
  add(hull, w - panel * 2, h, panel, 0, h / 2, -front + panel / 2);

  // ---- the lower front: a flat face from the floor to the waist, set back
  // behind the control panel, with a coin door in it.
  const waist = h * 0.44;
  add(hull, w - panel * 2, waist, panel, 0, waist / 2, front - 0.22);
  add(lam(0x0d0f14), w * 0.42, h * 0.12, 0.06, 0, waist * 0.62, front - 0.16);
  for (const side of [-1, 1]) {
    add(lit(0xb9a05a), 0.035, h * 0.05, 0.03, side * w * 0.09, waist * 0.68, front - 0.13);
  }
  // the kick plate, inset, so it is standing on something
  add(lam(0x0a0c10), w * 0.9, h * 0.06, d * 0.9, 0, h * 0.03, 0);

  // ---- THE STEP.  The control panel juts forward and tilts up at the player.
  // This is the silhouette; everything else is decoration on it.
  const cpH = h * 0.1;
  add(lam(0x22252f), w - panel * 2, cpH, 0.42, 0, waist + cpH * 0.35, front - 0.02, -0.42);
  // a stick and three buttons, because at this scale that is what says "you
  // played this" rather than "this was here"
  const ball = new THREE.Mesh(new THREE.SphereGeometry(w * 0.055, 8, 6), lit(0xc31f2e));
  ball.position.set(-w * 0.2, waist + cpH * 0.9, front + 0.02);
  g.add(ball);
  add(lam(0x3a3f4c), w * 0.03, cpH * 0.5, 0.03, -w * 0.2, waist + cpH * 0.6, front + 0.02);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.04, w * 0.04, 0.03, 8),
      lit([0xffd45e, 0xff7a3d, 0x46c4bd][i]),
    );
    b.rotation.x = Math.PI / 2 - 0.42;
    b.position.set(w * (0.02 + i * 0.13), waist + cpH * 0.78, front + 0.01);
    g.add(b);
  }

  // ---- the screen, set back in a bezel so it reads as recessed glass, and
  // the marquee over it.
  const scrTop = h * 0.84;
  const scrBot = waist + cpH * 1.4;
  add(lam(0x0b0d12), w - panel * 2, scrTop - scrBot, panel, 0, (scrTop + scrBot) / 2, front - 0.3);
  const screen = add(
    lit(color),
    (w - panel * 2) * 0.82,
    (scrTop - scrBot) * 0.78,
    0.04,
    0,
    (scrTop + scrBot) / 2,
    front - 0.26,
  );
  // Screens are not marquees: a dim, cold version of the cabinet's colour, so
  // the two lit surfaces on the front are not the same lamp twice.
  (screen.material as THREE.MeshBasicMaterial).color.setHex(color).multiplyScalar(0.34);

  // the bezel's overhang, which is what makes the screen look set in
  add(lam(0x181b22), w - panel * 2, 0.08, 0.34, 0, scrTop + 0.04, front - 0.16);

  // ---- the marquee.  Backlit, the brightest thing on the machine, and the
  // reason a row of these reads from the far end of a dark room.
  const marH = h * 0.11;
  add(lit(color), w - panel * 2.4, marH, 0.05, 0, h - marH * 0.9, front - 0.14);
  add(lam(0x14161c), w - panel * 2, 0.06, 0.3, 0, h - marH * 1.55, front - 0.2);
  // the cap over the top of it
  add(hull, w, 0.08, d, 0, h - 0.04, 0);

  return g;
}

/**
 * The prize case: a glass box with a lit shelf of prizes in it, standing
 * against the wall behind the counter.  Built facing +Z like the cabinets.
 *
 * It is the first thing in the room the player walks to and the only thing in
 * it that answers them, so it cannot be a slab: the prizes have to be visible
 * and countable through the glass from the other side of the counter.
 */
export function buildPrizeCase(
  w: number,
  h: number,
  d: number,
  grunge: THREE.Texture | null,
): THREE.Group {
  const g = new THREE.Group();
  const lam = (c: number) =>
    new THREE.MeshLambertMaterial(grunge ? { color: c, map: grunge } : { color: c });
  const frame = lam(0x2a3246);

  const add = (mat: THREE.Material, sx: number, sy: number, sz: number, px: number, py: number, pz: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(px, py, pz);
    g.add(m);
    return m;
  };

  // carcass: back, sides, top, and a solid plinth under the glass
  add(lam(0x161b28), w, h, 0.12, 0, h / 2, -d / 2 + 0.06);
  for (const side of [-1, 1]) add(frame, 0.12, h, d, side * (w / 2 - 0.06), h / 2, 0);
  add(frame, w, 0.12, d, 0, h - 0.06, 0);
  add(frame, w, h * 0.3, d, 0, h * 0.15, 0);

  // ---- two lit shelves of prizes.  The colours are the prize counter's own.
  const PRIZES = [0x6fbb6a, 0xffd45e, 0xff7a3d, 0xf2e9d0, 0xff4fa3, 0x7b4bd8, 0x46c4bd, 0xc31f2e];
  for (const [row, y] of [
    [0, h * 0.46],
    [1, h * 0.72],
  ] as const) {
    add(frame, w - 0.2, 0.06, d * 0.8, 0, y - 0.1, 0);
    for (let i = 0; i < 8; i++) {
      const c = PRIZES[(i + row * 3) % PRIZES.length];
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.075, h * 0.16, d * 0.35),
        new THREE.MeshBasicMaterial({ color: c }),
      );
      p.position.set(-w * 0.39 + (i / 7) * w * 0.78, y + h * 0.05, 0);
      g.add(p);
    }
  }

  // the glass: one dim pane across the front, so the prizes are behind
  // something rather than sitting on a shelf in the open
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.16, h * 0.62, 0.04),
    new THREE.MeshBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.12 }),
  );
  glass.position.set(0, h * 0.62, d / 2 - 0.04);
  g.add(glass);

  return g;
}
