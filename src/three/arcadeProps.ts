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
