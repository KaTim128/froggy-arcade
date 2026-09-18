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

  // ---- THE T-MOLDING, which is the strip of coloured trim round the edge of
  // every cabinet ever built.  Lit, and on the two front corners, because the
  // corners are the only part of the side art a player standing in front of a
  // row of these can actually see: it is what separates one machine from the
  // next in a row rather than leaving a wall of dark boxes with lit tops.
  for (const side of [-1, 1]) {
    add(lit(color), 0.04, h * 0.9, 0.05, side * (w / 2 - 0.02), h * 0.47, front - 0.01);
  }

  // ---- THE COIN RETURN, under the coin door.  A cup you could get a thumb
  // into: it is the one part of a cabinet a player's hand actually goes to,
  // and a coin door with nowhere for the change to come back is a slot in a
  // wall.
  add(lam(0x080a0e), w * 0.2, h * 0.05, 0.08, 0, waist * 0.34, front - 0.13);
  add(lam(0x2e333e), w * 0.24, 0.03, 0.09, 0, waist * 0.3, front - 0.12);

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

  // ---- GLAZING BARS.  A pane with nothing over it is a hole: at this light
  // level the dim tint alone reads as a gap in the carcass, and the prizes
  // look stacked on an open shelf.  Three uprights and a rail put something
  // IN FRONT of them, which is the whole difference between a case and a rack.
  const bar = lam(0x39435c);
  for (const t of [-1, 0, 1]) {
    add(bar, 0.05, h * 0.62, 0.06, t * w * 0.24, h * 0.62, d / 2 - 0.05);
  }
  add(bar, w - 0.16, 0.05, 0.06, 0, h * 0.62, d / 2 - 0.05);

  // ---- THE VALANCE, lit, over the top of the glass.  It is the sign every
  // prize counter has, and it is what makes the case the brightest thing
  // behind the desk rather than a dark box with colours in it.
  const val = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.24, h * 0.07, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xffd45e }),
  );
  val.position.set(0, h - h * 0.1, d / 2 - 0.03);
  g.add(val);
  // two bars of dark lettering on it, which at this size is all a word can be
  for (const row of [-1, 1]) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.4, h * 0.011, 0.02),
      new THREE.MeshLambertMaterial({ color: 0x3a2a14 }),
    );
    line.position.set(0, h - h * 0.1 - row * h * 0.016, d / 2 - 0.005);
    g.add(line);
  }
  // and the scuffed foot it stands on
  add(lam(0x4a5162), w, h * 0.05, d + 0.04, 0, h * 0.025, 0);

  return g;
}

/**
 * THE CHANGE MACHINE, which is the one thing in the room that used to be a box.
 *
 * It is furniture with a job, and the job is what makes it readable: a machine
 * that takes a note and gives back tokens has a SLOT, a TRAY and a light over
 * the two of them, and those three things in a column are the whole silhouette.
 * Painted as a cuboid it was a locker; a locker in an arcade is scenery, and
 * this room has no scenery left to spare.
 *
 * Built facing +Z with its feet at y = 0, like every other prop here.
 */
export function buildChangeMachine(
  w: number,
  h: number,
  d: number,
  grunge: THREE.Texture | null,
): THREE.Group {
  const g = new THREE.Group();
  const lam = (c: number, map = true) =>
    new THREE.MeshLambertMaterial(map && grunge ? { color: c, map: grunge } : { color: c });
  const lit = (c: number) => new THREE.MeshBasicMaterial({ color: c });

  const add = (mat: THREE.Material, sx: number, sy: number, sz: number, px: number, py: number, pz: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(px, py, pz);
    g.add(m);
    return m;
  };

  const front = d / 2;
  const steel = lam(0x555c6b);

  // ---- the carcass, and a cap that overhangs it: a machine with a lid reads
  // as sheet metal folded round a box rather than as a painted solid.
  add(lam(0x3a4150), w, h, d, 0, h / 2, 0);
  add(steel, w * 1.04, 0.1, d * 1.06, 0, h - 0.05, 0);
  // the plinth it stands on, inset, so it is bolted to the floor
  add(lam(0x21262f), w * 0.9, h * 0.05, d * 0.9, 0, h * 0.025, 0);

  // ---- the fascia: one recessed panel down the front, which is what the slot
  // and the tray are cut into.
  const fasciaH = h * 0.62;
  const fasciaY = h * 0.44;
  add(lam(0x262b36), w * 0.86, fasciaH, 0.06, 0, fasciaY, front - 0.02);
  // a brushed edge round it, four strips rather than a frame, so the panel
  // has a lip to catch the little light this corner gets
  for (const side of [-1, 1]) {
    add(steel, 0.05, fasciaH, 0.05, side * w * 0.43, fasciaY, front + 0.01);
  }
  add(steel, w * 0.86, 0.05, 0.05, 0, fasciaY + fasciaH / 2, front + 0.01);
  add(steel, w * 0.86, 0.05, 0.05, 0, fasciaY - fasciaH / 2, front + 0.01);

  // ---- THE HEADER.  Backlit, and the only thing on this machine visible from
  // the far end of the room: an arcade's change machine is a lamp first.
  const headH = h * 0.16;
  add(lit(0xffb45e), w * 0.78, headH, 0.05, 0, h - headH * 0.85, front - 0.02);
  add(lam(0x1a1e27), w * 0.86, 0.06, 0.16, 0, h - headH * 1.45, front - 0.05);
  // two lines of dark lettering across it, which at this size is all the word
  // CHANGE can be
  for (const row of [-1, 1]) {
    add(lam(0x3a2a14, false), w * 0.5, headH * 0.16, 0.02, 0, h - headH * 0.85 - row * headH * 0.22, front + 0.01);
  }

  // ---- THE NOTE SLOT, at the height a hand goes to, with the lit mouth every
  // acceptor has so you can find it in the dark.
  const slotY = h * 0.66;
  add(lam(0x101319), w * 0.42, h * 0.075, 0.07, 0, slotY, front + 0.01);
  add(lit(0x46c4bd), w * 0.34, 0.02, 0.03, 0, slotY + h * 0.018, front + 0.04);
  // and the coin chute beside it, which is the other half of a change machine
  add(lam(0x101319), w * 0.09, h * 0.04, 0.06, w * 0.3, slotY, front + 0.01);

  // ---- THE INSTRUCTION PLATE.  Pale, so it is a plate and not a hole.
  add(lam(0x8d93a0), w * 0.56, h * 0.1, 0.03, 0, h * 0.52, front + 0.02);
  for (let i = 0; i < 3; i++) {
    add(lam(0x2b2f38, false), w * 0.4, h * 0.012, 0.02, 0, h * 0.545 - i * h * 0.022, front + 0.04);
  }

  // ---- THE TRAY.  A recess with a lip under it: this is where the tokens
  // land, and a machine with nowhere for them to land does not take money.
  const trayY = h * 0.26;
  add(lam(0x0b0d12), w * 0.5, h * 0.11, 0.1, 0, trayY, front - 0.02);
  add(steel, w * 0.56, 0.05, 0.14, 0, trayY - h * 0.058, front + 0.02);
  // a token or two left in it, lit, because an empty tray is a broken machine
  for (const side of [-1, 0.4]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.05, w * 0.05, 0.02, 8), lit(0xd9b45a));
    t.rotation.x = Math.PI / 2;
    t.position.set(side * w * 0.12, trayY - h * 0.03, front + 0.01);
    g.add(t);
  }

  // ---- the lock, and the kick plate.  A cash box has a barrel lock on the
  // front of it and a scuffed foot, and both of them say it holds money.
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.045, w * 0.045, 0.06, 8), lit(0xb9a05a));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(w * 0.33, h * 0.4, front + 0.02);
  g.add(barrel);
  add(lam(0x6b727f), w * 0.9, h * 0.08, 0.05, 0, h * 0.09, front + 0.005);

  return g;
}

/**
 * THE PRIZE COUNTER, which is a wooden thing and was three grey slabs.
 *
 * The run the player vaults is the same box it always was -- the collision and
 * the vault come off the room's own `counter` runs, not off this -- so all of
 * this is what the box LOOKS like: a carcass set back under a top that
 * overhangs it, panelled at the front, with a rail at the foot and a worn
 * brass strip along the lip where thirty years of elbows have gone.
 *
 * That overhang is the whole thing.  A slab sitting flat on the floor is a
 * wall; a top standing proud of a recessed base is a counter, and the shadow
 * under the overhang is what says so in a room this dark.
 *
 * Built facing +Z: the public side is +Z, the staff side is -Z.
 */
export function buildCounter(
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

  const add = (mat: THREE.Material, sx: number, sy: number, sz: number, px: number, py: number, pz: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(px, py, pz);
    g.add(m);
    return m;
  };

  const topH = 0.09;
  const baseH = h - topH;
  // ---- the carcass, set back on the public side so the top can overhang it.
  const inset = Math.min(0.14, d * 0.2);
  add(lam(color), w, baseH, d - inset, 0, baseH / 2, -inset / 2);
  // ---- the top: a darker, harder-wearing slab, proud on the front and ends.
  add(lam(0x4e3520), w + 0.06, topH, d + 0.06, 0, h - topH / 2, 0);
  // the brass lip along the front edge of it, self-lit so the counter has an
  // outline from across the floor
  add(lit(0x8f7a44), w + 0.06, 0.02, 0.05, 0, h - topH, (d + 0.06) / 2 - 0.02);

  // ---- THE FRONT PANELLING: raised and fielded, not sunk.
  //
  // A panel standing PROUD of the carcass has to be LIGHTER than it.  These
  // were a darker brown a couple of centimetres forward of the front, and a
  // dark shape in front of a lit one is not read as a panel at all -- at this
  // light level the row of them looked like open cubbyholes under the desk.
  // Lighter, with a dark bead along the bottom of each for the shadow a real
  // one casts, and they come forward instead of falling away.
  const bays = Math.max(1, Math.round(w / 1.5));
  const bayW = w / bays;
  const face = (d - inset) / 2 - inset / 2 + 0.02;
  for (let i = 0; i < bays; i++) {
    const cx = -w / 2 + bayW * (i + 0.5);
    add(lam(0x8a6340), bayW * 0.74, baseH * 0.5, 0.04, cx, baseH * 0.54, face);
    add(lam(0x3a2716), bayW * 0.74, 0.03, 0.05, cx, baseH * 0.29, face + 0.005);
  }

  // ---- the foot: a rail set back under the panels, so the counter stands on
  // something instead of growing out of the carpet.
  add(lam(0x1b130c), w, baseH * 0.14, d - inset * 1.6, 0, baseH * 0.07, -inset / 2);

  return g;
}

/**
 * THE STAFF DOOR, in the back wall of the arcade.
 *
 * It was a brown box with a ball on it.  It is the door the player comes out
 * of and the only piece of the back wall they are ever standing next to, so it
 * gets what a real door has: an architrave it sits inside, four panels, a
 * lever rather than a knob, and a threshold under it.
 *
 * Built into the -Z wall, facing +Z into the room, with its foot at y = 0.
 */
export function buildStaffDoor(w: number, h: number, grunge: THREE.Texture | null): THREE.Group {
  const g = new THREE.Group();
  const lam = (c: number, map = true) =>
    new THREE.MeshLambertMaterial(map && grunge ? { color: c, map: grunge } : { color: c });
  const lit = (c: number) => new THREE.MeshBasicMaterial({ color: c });

  const add = (mat: THREE.Material, sx: number, sy: number, sz: number, px: number, py: number, pz: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(px, py, pz);
    g.add(m);
    return m;
  };

  // ---- the architrave: two jambs and a head, proud of the wall.
  const jamb = 0.1;
  const arch = lam(0x2c2a33);
  for (const side of [-1, 1]) add(arch, jamb, h + jamb, 0.14, side * (w / 2 + jamb / 2), (h + jamb) / 2, 0.06);
  add(arch, w + jamb * 2, jamb, 0.14, 0, h + jamb / 2, 0.06);

  // ---- the leaf, and the four panels in it.
  add(lam(0x4a3524), w, h, 0.12, 0, h / 2, 0);
  for (const row of [0.28, 0.66]) {
    for (const side of [-1, 1]) {
      add(lam(0x33241a), w * 0.36, h * 0.24, 0.05, side * w * 0.21, h * row, 0.06);
    }
  }
  // ---- the sign plate, lit, because at this light level a painted sign is a
  // slightly different brown.
  add(lit(0x9aa4b4), w * 0.56, h * 0.12, 0.03, 0, h * 0.86, 0.08);
  for (const row of [-1, 1]) {
    add(lam(0x2b2f38, false), w * 0.4, h * 0.012, 0.02, 0, h * 0.86 - row * h * 0.022, 0.1);
  }

  // ---- the lever, on a rose, at the hinge-away side.  A lever says a staff
  // door; a ball on a stick says a cupboard.
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10), lit(0xb9a05a));
  rose.rotation.x = Math.PI / 2;
  rose.position.set(w * 0.33, h * 0.46, 0.08);
  g.add(rose);
  add(lit(0xc9a62e), 0.05, 0.05, 0.1, w * 0.33, h * 0.46, 0.13);
  add(lit(0xc9a62e), 0.19, 0.05, 0.05, w * 0.25, h * 0.46, 0.17);
  // the escutcheon under it
  add(lam(0x8a7b46, false), 0.05, 0.09, 0.03, w * 0.33, h * 0.36, 0.08);

  // ---- the kick plate and the threshold, both scuffed metal.
  add(lam(0x6b727f), w * 0.92, h * 0.12, 0.04, 0, h * 0.07, 0.07);
  add(lam(0x565c68), w + jamb * 2, 0.04, 0.2, 0, 0.02, 0.08);

  return g;
}

/**
 * THE FRONT DOORS.  Two glass leaves in an aluminium frame, chained shut.
 *
 * This is the objective, so it has to read as one from the far end of a dark
 * room: a painted slab in the back wall is a door the player walks past, and
 * the whole last act is walking TOWARDS something.  Glass does that on its
 * own — it is the only surface in the building with the street behind it, and
 * a pair of them with a mullion down the middle is the shape every arcade,
 * every chip shop and every shut-up unit on that street has at the front.
 *
 * AND THE LOCK IS VISIBLE.  A chain threaded through both push bars with a
 * padlock hanging off it, in self-lit brass so it stays the brightest thing on
 * the door however dark the room gets.  The player has to be able to see,
 * before pressing anything, that the way out is held shut by a specific
 * object — otherwise the ten seconds that follow are a loading bar rather than
 * a lock being fought with.
 *
 * Built into the +Z wall, facing back into the room: the room side is -Z,
 * which is where the push bars and the chain hang.
 */
export function buildGlassDoors(w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const lam = (c: number) => new THREE.MeshLambertMaterial({ color: c });
  const lit = (c: number) => new THREE.MeshBasicMaterial({ color: c });

  const add = (mat: THREE.Material, sx: number, sy: number, sz: number, px: number, py: number, pz: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(px, py, pz);
    g.add(m);
    return m;
  };

  const frame = lam(0x6f7682);
  const post = 0.16;
  const leaf = (w - post * 3) / 2;

  // ---- the surround: two jambs, a head, and the mullion between the leaves.
  for (const side of [-1, 1]) add(frame, post, h, 0.24, side * (w / 2 - post / 2), h / 2, 0);
  add(frame, w, post, 0.24, 0, h - post / 2, 0);
  add(frame, post, h, 0.24, 0, h / 2, 0);
  // a transom over the top of it, so the doors sit under something
  add(lam(0x2a2233), w + 0.6, 0.5, 0.3, 0, h + 0.25, 0);

  // ---- the two leaves.  Each is a pane in a thin rail, and the pane is the
  // only transparent thing in the room: what is behind it is the street, and
  // the street is the reason this door is worth crossing a floor for.
  for (const side of [-1, 1]) {
    const cx = side * (post / 2 + leaf / 2);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(leaf - 0.1, h - 0.5, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x14202e, transparent: true, opacity: 0.55 }),
    );
    glass.position.set(cx, h / 2, -0.02);
    g.add(glass);
    // rails top and bottom, and the kick plate every public door has
    add(lam(0x5e6673), leaf, 0.14, 0.12, cx, h - 0.28, -0.04);
    add(lam(0x5e6673), leaf, 0.12, 0.12, cx, h * 0.52, -0.04);
    add(lam(0x4e555f), leaf, 0.42, 0.14, cx, 0.21, -0.05);
    // the push bar, on the room side, at the height a hand goes to
    add(lit(0xb9b3a0), leaf * 0.72, 0.08, 0.08, cx, 1.02, -0.15);
    for (const b of [-1, 1]) {
      add(lam(0x8a8f97), 0.07, 0.07, 0.18, cx + b * leaf * 0.3, 1.02, -0.1);
    }
    // a strip of faded lettering across the glass: OPEN, on a door that is not
    add(lit(0xd9b45a), leaf * 0.5, 0.1, 0.02, cx, h * 0.72, -0.06);
  }

  // ---- THE LOCK.  A chain through both handles and a padlock on it.
  // Links nearly touching, alternating flat and on edge the way a chain does,
  // on a shallow sag between the two push bars.  Spaced out, it read as a row
  // of tiles stuck to the glass rather than as something holding a door shut.
  const chain = 15;
  const span = leaf * 0.86;
  for (let i = 0; i < chain; i++) {
    const t = i / (chain - 1);
    const flat = i % 2 === 0;
    const link = new THREE.Mesh(
      new THREE.BoxGeometry(flat ? 0.1 : 0.04, 0.09, flat ? 0.04 : 0.1),
      lit(flat ? 0xc9b877 : 0x9a8f6a),
    );
    // slack: it hangs between the two bars rather than running straight
    link.position.set((t - 0.5) * span, 1.02 - Math.sin(t * Math.PI) * 0.14, -0.19);
    g.add(link);
  }
  const body = add(lit(0xc9a62e), 0.2, 0.26, 0.12, 0, 0.74, -0.21);
  body.rotation.z = 0.18;
  const shackle = new THREE.Mesh(
    new THREE.TorusGeometry(0.09, 0.028, 6, 10, Math.PI),
    lit(0xd8d2bc),
  );
  shackle.position.set(0, 0.87, -0.21);
  shackle.rotation.z = 0.18;
  // Named so the room can find it and swing it open when the key turns.
  shackle.name = 'padlockShackle';
  g.add(shackle);

  return g;
}

/**
 * THE KEY, ON THE CARPET.
 *
 * It has to be findable in a dark room by somebody who has just watched it
 * fall and is not allowed to walk about looking for it — so it is built the
 * one way a small object can be legible at knee height in the dark: in
 * self-lit brass, with a bow wide enough to read as a key at a glance and a
 * bit on the end of it that says which way round it is lying.
 *
 * Laid flat, along +Z, with the bow at the back and the tip forward.
 */
export function buildDroppedKey(): THREE.Group {
  const g = new THREE.Group();
  const brass = (c: number) => new THREE.MeshBasicMaterial({ color: c });

  const add = (mat: THREE.Material, sx: number, sy: number, sz: number, px: number, py: number, pz: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(px, py, pz);
    g.add(m);
    return m;
  };

  // the shaft
  add(brass(0xd9b45a), 0.035, 0.035, 0.26, 0, 0.018, 0);
  // the bow: a ring at the back, built as four sides so it has a hole in it
  const bow = 0.115;
  for (const [dx, dz, w, d] of [
    [0, -bow, bow * 2, 0.03],
    [0, -bow * 2 + 0.03, bow * 2, 0.03],
    [-bow + 0.015, -bow * 1.5 + 0.015, 0.03, bow],
    [bow - 0.015, -bow * 1.5 + 0.015, 0.03, bow],
  ] as const) {
    add(brass(0xc9a445), w, 0.03, d, dx, 0.016, dz - 0.05);
  }
  // the bit, two teeth on the end
  add(brass(0xe8c96e), 0.075, 0.03, 0.035, 0.03, 0.016, 0.1);
  add(brass(0xe8c96e), 0.055, 0.03, 0.03, 0.02, 0.016, 0.155);

  // NO GLINT UNDER IT.  There was a pale plane on the carpet beneath the key,
  // meant to catch the eye across a dark floor -- and what it actually read as
  // was a selection box drawn round an object, which is a thing this game does
  // not otherwise do to anything.  The key is self-lit brass; that is enough.
  return g;
}

/**
 * THE PLAYER'S OWN HAND, for the two moments the ending needs one.
 *
 * Everything in the hide rooms happens to a camera: the player is a point of
 * view with a torch, and nothing of them is ever on screen.  That is right for
 * the hunt -- a body in the corner of the frame is a character, and this is
 * meant to be you -- and wrong for the two beats at the end where the whole
 * point is a physical act.  Watching a key rise off the carpet by itself, or a
 * lock open with nothing touching it, reads as the game doing it for you.
 *
 * So there is a hand, and it exists for about six seconds: it comes into frame
 * to pick the key up off the floor, and it holds the key in the lock while it
 * turns.  It is parented to the camera, so it is drawn in view space and the
 * room's own lighting never has to reach it.
 *
 * Built palm-down, fingers forward along -Z, wrist at the origin.
 */
export function buildHand(): THREE.Group {
  const g = new THREE.Group();
  // SELF-SHADED, NOT LIT.  The torch is a 110-candela spot mounted on the
  // camera, and the hand is half a metre from it: under a Lambert material it
  // came out as a white slab with no shape in it at all.  These are fixed
  // tones -- a lit top, a mid, and a shadowed underside -- so the hand carries
  // its own form and no lamp in the room can flatten it.
  const skin = new THREE.MeshBasicMaterial({ color: 0xb4947a });
  const skinLit = new THREE.MeshBasicMaterial({ color: 0xd2b291 });
  const skinDark = new THREE.MeshBasicMaterial({ color: 0x7d6350 });

  const add = (mat: THREE.Material, sx: number, sy: number, sz: number, px: number, py: number, pz: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(px, py, pz);
    g.add(m);
    return m;
  };

  // THE WRIST, AND NO MORE THAN THAT.  There was a forearm and a dark sleeve
  // cuff behind the hand, and because they sit NEARER the camera than the hand
  // does they loomed over it -- a black slab across the middle of the frame
  // with a small hand poking out of the side.  What is wanted is the hand and
  // just enough wrist to say it is attached to somebody; the arm leaves the
  // shot immediately, which is what an arm does at this range.
  add(skin, 0.062, 0.058, 0.1, 0, -0.004, 0.06);
  add(skinDark, 0.05, 0.006, 0.09, 0, -0.03, 0.06);
  // the back of the hand, with a lit plane on top and a dark one under, so it
  // has a top and a bottom from any angle
  add(skin, 0.09, 0.042, 0.11, 0, 0, -0.06);
  add(skinLit, 0.08, 0.008, 0.1, 0, 0.022, -0.06);
  add(skinDark, 0.08, 0.008, 0.1, 0, -0.022, -0.06);
  // knuckles, which is what tells you it is a hand and not a glove
  for (let i = 0; i < 4; i++) {
    add(skinLit, 0.016, 0.012, 0.016, -0.031 + i * 0.021, 0.02, -0.105);
  }

  // FOUR FINGERS, on their own group so they can close on something.  They
  // curl about the knuckle line rather than bending in the middle: at this
  // size a curl is the only part of a grip anybody reads.
  const fingers = new THREE.Group();
  fingers.position.set(0, -0.01, -0.11);
  fingers.name = 'fingers';
  for (let i = 0; i < 4; i++) {
    const len = 0.078 - Math.abs(i - 1.5) * 0.012;
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.021, len), i % 2 ? skin : skinLit);
    f.position.set(-0.031 + i * 0.021, 0, -len / 2 - 0.004);
    fingers.add(f);
    // a dark line down each gap, so four fingers are four fingers
    const gap = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.023, len), skinDark);
    gap.position.set(-0.041 + i * 0.021, 0, -len / 2 - 0.004);
    fingers.add(gap);
  }
  g.add(fingers);

  // and the thumb, which closes from the side
  const thumb = new THREE.Group();
  thumb.position.set(0.045, -0.005, -0.05);
  thumb.name = 'thumb';
  const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.022, 0.024), skin);
  t.position.set(-0.025, 0, -0.02);
  thumb.add(t);
  g.add(thumb);

  return g;
}
