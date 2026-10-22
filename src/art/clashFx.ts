/**
 * CREATURE CLASH: WHAT A HIT LOOKS LIKE.
 *
 * Two kinds of picture, both drawn straight into the arena's Graphics at the
 * game's own 320x180, so every one of them is a few pixels of hand-placed
 * colour rather than a texture scaled down to mush.
 *
 * THE CLOSE-UP STRIKES.  A melee attack used to be a short straight line,
 * the same for a bear's paw and a serpent's fangs.  Now each creature strikes
 * the way its body would: jaws that open and snap shut, a fist that drives out
 * and lands with a burst, claws or a blade sweeping an arc, a horn's shock
 * wave, a quick jab, the wide sweep of a fin or a wing.  Which one comes from
 * the name of its plain attack (FANG BITE bites, FIST SLAM punches).
 *
 * THE SHOTS.  Each element throws what it is made of -- a flame that flickers
 * and trails smoke, a water drop shedding spray, a tumbling leaf, an ice shard
 * that glitters, a crackling spark, a spinning rock, a curl of wind, a shadow
 * with wisps, a star -- and a few names override that (needles, bubbles,
 * seeds, spit).
 */
import Phaser from 'phaser';
import { ELEMENTS, type Creature, type Element } from '../game/creatures';

export type MeleeStyle = 'bite' | 'pincer' | 'punch' | 'claw' | 'blade' | 'ram' | 'jab' | 'sweep';
export type ShotStyle = 'flame' | 'water' | 'leaf' | 'shard' | 'spark' | 'rock' | 'gust' | 'shadow' | 'star' | 'needle' | 'bubble' | 'seed' | 'glob';

const has = (s: string, ...w: string[]) => w.some((x) => s.includes(x));

/** How this creature hits up close, from the name of its plain attack. */
export function meleeStyle(c: Creature): MeleeStyle {
  const n = c.attacks[0]?.name ?? '';
  if (has(n, 'PINCER', 'MANDIBLE')) return 'pincer';
  if (has(n, 'BITE', 'FANG', 'NIP', 'CHOMP', 'JAW')) return 'bite';
  if (has(n, 'FIST', 'PUNCH', 'SLAM', 'BONK', 'POUND', 'KICK')) return 'punch';
  if (has(n, 'SCYTHE', 'CUT', 'BLADE')) return 'blade';
  if (has(n, 'CLAW', 'SWIPE', 'RAKE', 'TALON', 'MAUL')) return 'claw';
  if (has(n, 'HORN', 'TUSK', 'ANTLER', 'BUTT', 'GORE', 'BUMP', 'RAM')) return 'ram';
  if (has(n, 'JAB', 'PECK', 'STING', 'TOUCH')) return 'jab';
  return 'sweep';
}

/** What a shot looks like: a few names have their own, the rest are their element. */
export function shotStyle(name: string, el: Element): ShotStyle {
  if (has(name, 'NEEDLE', 'QUILL', 'THORN', 'DART', 'SPINE')) return 'needle';
  if (has(name, 'BUBBLE')) return 'bubble';
  if (has(name, 'SEED')) return 'seed';
  if (has(name, 'SHARD')) return 'shard';
  if (has(name, 'SPIT', 'OOZE')) return 'glob';
  if (has(name, 'GUST')) return 'gust';
  const byEl: Record<Element, ShotStyle> = {
    ember: 'flame', tide: 'water', moss: 'leaf', frost: 'shard', volt: 'spark',
    stone: 'rock', gale: 'gust', murk: 'shadow', glow: 'star',
  };
  return byEl[el];
}

const smooth = (t: number) => {
  const u = Phaser.Math.Clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};
/** A little deterministic noise, so a flicker is a flicker and not a strobe. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** A frame at (x, y) facing `ang`: +x forward, +y to its right. */
function frame(x: number, y: number, ang: number) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return (px: number, py: number) => ({ x: x + c * px - s * py, y: y + s * px + c * py });
}

/** An arc of thick stroke, tapered from `w0` at its start to `w1` at its end. */
function taperArc(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, a0: number, a1: number, w0: number, w1: number, col: number, alpha: number): void {
  const n = Math.max(3, Math.ceil(Math.abs(a1 - a0) * r / 2));
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const b0 = a0 + (a1 - a0) * t0;
    const b1 = a0 + (a1 - a0) * t1;
    g.lineStyle(Math.max(0.5, w0 + (w1 - w0) * t0), col, alpha * (0.35 + 0.65 * t0));
    g.lineBetween(cx + Math.cos(b0) * r, cy + Math.sin(b0) * r, cx + Math.cos(b1) * r, cy + Math.sin(b1) * r);
  }
}

/**
 * One close-up strike, `k` of the way through (0..1), from a creature at
 * (x, y) facing `ang`, reaching `len` pixels.
 */
export function drawMelee(g: Phaser.GameObjects.Graphics, style: MeleeStyle, x: number, y: number, ang: number, k: number, len: number, el: Element): void {
  const E = ELEMENTS[el];
  const P = frame(x, y, ang);
  const fade = 1 - smooth((k - 0.65) / 0.35);
  switch (style) {
    case 'bite':
    case 'pincer': {
      // ---- JAWS: wide open, then SNAP shut on the target, and a flash
      const d = len * 0.72;
      const shut = smooth(k / 0.5);
      const open = (1 - shut) * 0.8 + 0.12;
      const jaw = 13;
      const hinge = P(d - jaw * 0.62, 0);
      const tips = [-1, 1].map((side) => {
        const a = ang + side * open;
        return { a, side, x: hinge.x + Math.cos(a) * jaw, y: hinge.y + Math.sin(a) * jaw };
      });
      // the dark of the mouth between them
      if (style === 'bite') g.fillStyle(0x1a0c12, 0.55 * fade).fillTriangle(hinge.x, hinge.y, tips[0].x, tips[0].y, tips[1].x, tips[1].y);
      for (const { a, side, x: tx, y: ty } of tips) {
        if (style === 'pincer') {
          // a curved chitin claw, closing like tongs
          g.lineStyle(3.4, E.dark, fade).lineBetween(hinge.x, hinge.y, tx, ty);
          g.lineStyle(1.2, E.light, fade).lineBetween(hinge.x, hinge.y, tx, ty);
          const hook = { x: tx - Math.cos(a - side * 1.4) * 3.5, y: ty - Math.sin(a - side * 1.4) * 3.5 };
          g.lineStyle(2.4, E.dark, fade).lineBetween(tx, ty, hook.x, hook.y);
        } else {
          // the jaw: a gum, its element's colour outside, and a row of teeth
          // along the inside edge, the front ones the longest
          g.lineStyle(4, E.dark, fade).lineBetween(hinge.x, hinge.y, tx, ty);
          g.lineStyle(2, 0x9a2a3a, fade).lineBetween(hinge.x, hinge.y, tx, ty);
          g.lineStyle(1, E.col, fade).lineBetween(hinge.x - Math.sin(a) * side * 1.4, hinge.y + Math.cos(a) * side * 1.4, tx - Math.sin(a) * side * 1.4, ty + Math.cos(a) * side * 1.4);
          const inward = a - side * (Math.PI / 2);
          for (let i = 1; i <= 4; i++) {
            const q = i / 4.4;
            const bx = hinge.x + Math.cos(a) * jaw * q;
            const by = hinge.y + Math.sin(a) * jaw * q;
            const tl = i >= 3 ? 3.4 : 2.4;
            g.fillStyle(0xffffff, fade).fillTriangle(
              bx - Math.cos(a) * 1.2, by - Math.sin(a) * 1.2,
              bx + Math.cos(a) * 1.2, by + Math.sin(a) * 1.2,
              bx + Math.cos(inward) * tl, by + Math.sin(inward) * tl,
            );
          }
        }
      }
      if (k > 0.45) {
        const f = 1 - smooth((k - 0.45) / 0.5);
        const c = P(d + 4, 0);
        g.fillStyle(0xffffff, f * 0.8).fillCircle(c.x, c.y, 1.4 * f + 0.4);
        for (let i = 0; i < 5; i++) {
          const a = ang + (i - 2) * 0.55;
          const r = 3 + (1 - f) * 6;
          g.fillStyle(E.light, f).fillRect(c.x + Math.cos(a) * r - 0.5, c.y + Math.sin(a) * r - 0.5, 1.5, 1.5);
        }
      }
      break;
    }
    case 'punch': {
      // ---- A FIST: out fast, a beat at the end, back.  The burst is the landing.
      const out = smooth(k / 0.32);
      const back = smooth((k - 0.7) / 0.3);
      const d = 5 + (len * 0.82 - 5) * out * (1 - back * 0.7);
      const c = P(d, 0);
      // speed lines behind it while it travels
      if (out < 1) {
        for (const off of [-2.5, 0, 2.5]) {
          const a = P(d - 4, off);
          const b = P(d - 10 - Math.abs(off), off);
          g.lineStyle(1, E.light, 0.7).lineBetween(a.x, a.y, b.x, b.y);
        }
      }
      g.fillStyle(E.dark, fade).fillCircle(c.x, c.y, 4.4);
      g.fillStyle(E.col, fade).fillCircle(c.x - Math.cos(ang) * 0.4, c.y - Math.sin(ang) * 0.4, 3.6);
      // the knuckles across the front, and the light on top of them
      for (const off of [-2.2, -0.7, 0.8, 2.3]) {
        const kn = P(d + 2.4, off);
        g.fillStyle(E.light, fade).fillRect(kn.x - 0.6, kn.y - 0.6, 1.3, 1.3);
      }
      const th = P(d - 1, -3.4);
      g.fillStyle(E.dark, fade).fillCircle(th.x, th.y, 1.6);
      if (k > 0.3 && k < 0.85) {
        const f = 1 - (k - 0.3) / 0.55;
        const hit = P(d + 5, 0);
        g.lineStyle(1, 0xffffff, f);
        for (let i = 0; i < 7; i++) {
          const a = ang + (i - 3) * 0.48;
          const r0 = 2 + (1 - f) * 3;
          const r1 = r0 + 3 + (1 - f) * 2;
          g.lineBetween(hit.x + Math.cos(a) * r0, hit.y + Math.sin(a) * r0, hit.x + Math.cos(a) * r1, hit.y + Math.sin(a) * r1);
        }
        g.lineStyle(1, E.light, f * 0.8).strokeCircle(hit.x, hit.y, 2 + (1 - f) * 6);
      }
      break;
    }
    case 'claw':
    case 'blade':
    case 'sweep': {
      // ---- AN ARC SWEPT ACROSS THE FRONT: three claw rakes, one bright blade,
      // or the broad smear of a fin or a wing
      const spread = style === 'sweep' ? 1.2 : 1.05;
      const head = ang - spread + spread * 2 * smooth(k / 0.55);
      const tailLen = style === 'blade' ? 1.3 : 0.95;
      const tail = Math.max(ang - spread, head - tailLen);
      const r = len * (style === 'sweep' ? 0.7 : 0.78);
      if (style === 'claw') {
        for (const dr of [-3.2, 0, 3.2]) {
          taperArc(g, x, y, r + dr, tail, head, 0.6, 2, E.dark, fade);
          taperArc(g, x, y, r + dr, tail, head, 0.4, 1, 0xffffff, fade);
        }
      } else if (style === 'blade') {
        taperArc(g, x, y, r, tail, head, 0.8, 4.2, E.col, fade);
        taperArc(g, x, y, r + 0.6, tail, head, 0.4, 1.6, 0xffffff, fade);
        // the glint on its leading edge
        const gx = x + Math.cos(head) * r;
        const gy = y + Math.sin(head) * r;
        g.fillStyle(0xffffff, fade).fillCircle(gx, gy, 1.6);
      } else {
        taperArc(g, x, y, r, tail, head, 1, 5, E.col, fade * 0.55);
        taperArc(g, x, y, r + 2, tail, head, 0.5, 1.4, E.light, fade);
        taperArc(g, x, y, r - 3, tail, head, 0.5, 1, E.light, fade * 0.6);
      }
      break;
    }
    case 'ram': {
      // ---- A HORN OR A TUSK DRIVEN IN: a wedge of force rolling forward
      const go = smooth(k / 0.45);
      for (let i = 0; i < 3; i++) {
        const d = 6 + (len * 0.85 - 6) * go - i * 5;
        if (d < 4) continue;
        const a = P(d, 0);
        const l = P(d - 4, -4 + i * 0.5);
        const r = P(d - 4, 4 - i * 0.5);
        g.lineStyle(2 - i * 0.5, i === 0 ? 0xffffff : E.light, fade * (1 - i * 0.28));
        g.lineBetween(l.x, l.y, a.x, a.y).lineBetween(a.x, a.y, r.x, r.y);
      }
      if (k > 0.4) {
        const f = 1 - smooth((k - 0.4) / 0.6);
        const c = P(len * 0.85 + 2, 0);
        g.lineStyle(1.5, E.light, f).strokeCircle(c.x, c.y, 2 + (1 - f) * 7);
        for (let i = 0; i < 4; i++) {
          const a = ang + Math.PI + (i - 1.5) * 0.5;
          const rr = 3 + (1 - f) * 5;
          g.fillStyle(E.col, f).fillCircle(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, 1.2);
        }
      }
      break;
    }
    case 'jab': {
      // ---- A QUICK THRUST: a bright point driven out, a glint, gone
      const out = smooth(k / 0.3) * (1 - smooth((k - 0.6) / 0.4) * 0.8);
      const tip = P(4 + (len - 4) * out, 0);
      const base = P(4 + (len - 4) * out * 0.35, 0);
      g.lineStyle(2, E.dark, fade).lineBetween(base.x, base.y, tip.x, tip.y);
      g.lineStyle(1, E.light, fade).lineBetween(base.x, base.y, tip.x, tip.y);
      const l = P(4 + (len - 4) * out - 3, -1.6);
      const r = P(4 + (len - 4) * out - 3, 1.6);
      g.fillStyle(0xffffff, fade).fillTriangle(l.x, l.y, r.x, r.y, tip.x + Math.cos(ang) * 1.5, tip.y + Math.sin(ang) * 1.5);
      if (k > 0.25 && k < 0.7) {
        const f = 1 - (k - 0.25) / 0.45;
        g.lineStyle(1, 0xffffff, f);
        g.lineBetween(tip.x - 3, tip.y, tip.x + 3, tip.y).lineBetween(tip.x, tip.y - 3, tip.x, tip.y + 3);
      }
      break;
    }
  }
}

/**
 * One shot in flight at (x, y), moving (vx, vy), `age` seconds old, at `size`
 * (1 is normal), `seed` keeping its own flicker its own.
 */
export function drawShot(g: Phaser.GameObjects.Graphics, style: ShotStyle, x: number, y: number, vx: number, vy: number, age: number, size: number, el: Element, seed: number): void {
  const E = ELEMENTS[el];
  const ang = Math.atan2(vy, vx);
  const P = frame(x, y, ang);
  const s = size;
  const fl = (i: number) => hash(seed + Math.floor(age * 30) * 7.3 + i);
  switch (style) {
    case 'flame': {
      // smoke, then the tongues, then the white-hot heart
      for (let i = 5; i >= 1; i--) {
        const p = P(-i * 2.1 * s, (fl(i) - 0.5) * 2.2 * s);
        const r = (2.9 - i * 0.42) * s;
        const col = i >= 4 ? 0x5a3a30 : i >= 3 ? 0xc23a12 : 0xf07020;
        g.fillStyle(col, i >= 4 ? 0.35 : 0.85).fillCircle(p.x, p.y, Math.max(0.6, r));
      }
      for (let i = 0; i < 3; i++) {
        const a = P(-1 * s, (i - 1) * 1.6 * s);
        const t = P((-5 - fl(i + 9) * 3) * s, (i - 1) * 2.6 * s);
        g.fillStyle(0xffa030, 0.9).fillTriangle(a.x, a.y - 0.8, a.x, a.y + 0.8, t.x, t.y);
      }
      g.fillStyle(0xffd060, 1).fillCircle(x, y, 2.6 * s);
      g.fillStyle(0xfff8d0, 1).fillCircle(x + Math.cos(ang) * 0.6, y + Math.sin(ang) * 0.6, 1.4 * s);
      break;
    }
    case 'water': {
      // a teardrop, a highlight, and spray shed behind it
      for (let i = 1; i <= 3; i++) {
        const p = P(-i * 3 * s - 1, (fl(i) - 0.5) * 3 * s);
        g.fillStyle(E.light, 0.75 - i * 0.18).fillCircle(p.x, p.y, (1.3 - i * 0.25) * s);
      }
      const a = P(-6 * s, 0);
      const l = P(-0.5, -2.4 * s);
      const r = P(-0.5, 2.4 * s);
      g.fillStyle(E.col, 0.95).fillTriangle(a.x, a.y, l.x, l.y, r.x, r.y);
      g.fillStyle(E.col, 1).fillCircle(x, y, 2.6 * s);
      g.fillStyle(E.dark, 0.9).fillCircle(x - Math.cos(ang) * 0.6 + Math.sin(ang) * 0.8, y - Math.sin(ang) * 0.6 - Math.cos(ang) * 0.8, 1.2 * s);
      const h = P(0.8, -1.1 * s);
      g.fillStyle(0xffffff, 1).fillRect(h.x - 0.6, h.y - 0.6, 1.3, 1.3);
      break;
    }
    case 'leaf': {
      // tumbling as it goes, with its vein down the middle
      const Q = frame(x, y, ang + Math.sin(age * 14 + seed) * 0.7);
      const pts = [Q(4.2 * s, 0), Q(1.5 * s, -2.2 * s), Q(-2 * s, -1.6 * s), Q(-4 * s, 0), Q(-2 * s, 1.6 * s), Q(1.5 * s, 2.2 * s)];
      g.fillStyle(E.dark, 1).fillPoints(pts.map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
      const inner = [Q(3.2 * s, 0), Q(1.2 * s, -1.4 * s), Q(-1.6 * s, -1 * s), Q(-3 * s, 0), Q(-1.6 * s, 1 * s), Q(1.2 * s, 1.4 * s)];
      g.fillStyle(E.col, 1).fillPoints(inner.map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
      const v0 = Q(3.4 * s, 0);
      const v1 = Q(-5 * s, 0);
      g.lineStyle(0.8, E.light, 1).lineBetween(v0.x, v0.y, v1.x, v1.y);
      break;
    }
    case 'shard': {
      // a long diamond of ice, lit on one face, with glitter behind it
      for (let i = 1; i <= 3; i++) {
        if (fl(i) < 0.45) continue;
        const p = P(-i * 3.2 * s - 2, (fl(i + 4) - 0.5) * 4);
        g.fillStyle(0xffffff, 0.9 - i * 0.2).fillRect(p.x - 0.5, p.y - 0.5, 1, 1);
      }
      const tip = P(5 * s, 0);
      const back = P(-4 * s, 0);
      const l = P(0, -2 * s);
      const r = P(0, 2 * s);
      g.fillStyle(E.dark, 1).fillTriangle(tip.x, tip.y, r.x, r.y, back.x, back.y);
      g.fillStyle(E.light, 1).fillTriangle(tip.x, tip.y, l.x, l.y, back.x, back.y);
      g.lineStyle(0.8, 0xffffff, 1).lineBetween(tip.x, tip.y, l.x, l.y);
      break;
    }
    case 'spark': {
      // a hot white core in a halo, with lightning crawling round it
      g.fillStyle(E.col, 0.35).fillCircle(x, y, 4 * s);
      g.lineStyle(0.8, E.light, 1);
      for (let b = 0; b < 3; b++) {
        let a = fl(b) * Math.PI * 2;
        let px = x + Math.cos(a) * 1.5;
        let py = y + Math.sin(a) * 1.5;
        for (let j = 0; j < 3; j++) {
          a += (fl(b * 3 + j + 20) - 0.5) * 1.6;
          const r = 2.2 + j * 1.5;
          const nx = x + Math.cos(a) * r * s;
          const ny = y + Math.sin(a) * r * s;
          g.lineBetween(px, py, nx, ny);
          px = nx;
          py = ny;
        }
      }
      const t = P(-4 * s, 0);
      g.lineStyle(1, E.col, 0.7).lineBetween(x, y, t.x, t.y);
      g.fillStyle(E.col, 1).fillCircle(x, y, 2 * s);
      g.fillStyle(0xffffff, 1).fillCircle(x, y, 1.1 * s);
      break;
    }
    case 'rock': {
      // a lump of stone, spinning, kicking up dust behind it
      for (let i = 1; i <= 3; i++) {
        const p = P(-i * 2.6 * s - 1, (fl(i) - 0.5) * 2);
        g.fillStyle(E.light, 0.4 - i * 0.1).fillCircle(p.x, p.y, (1.6 - i * 0.2) * s);
      }
      const spin = age * 9 + seed;
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 7; i++) {
        const a = spin + (i / 7) * Math.PI * 2;
        const r = (2.6 + (hash(seed + i) - 0.5) * 1.4) * s;
        pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r));
      }
      g.fillStyle(E.dark, 1).fillPoints(pts, true);
      g.fillStyle(E.col, 1).fillCircle(x - 0.4, y - 0.5, 1.8 * s);
      g.fillStyle(E.light, 1).fillRect(x - 1.2, y - 1.4, 1.2, 1);
      g.lineStyle(0.6, E.dark, 1).lineBetween(x - 0.3, y - 1.5, x + 0.8, y + 1);
      break;
    }
    case 'gust': {
      // two curls of air, turning
      const spin = age * 12;
      g.lineStyle(1.4, E.light, 0.95);
      g.beginPath().arc(x, y, 3 * s, spin, spin + 3.6).strokePath();
      g.lineStyle(1, E.col, 0.85);
      g.beginPath().arc(x - Math.cos(ang) * 2, y - Math.sin(ang) * 2, 1.8 * s, spin + 2, spin + 5.2).strokePath();
      for (let i = 1; i <= 2; i++) {
        const a = P(-i * 4 * s, -1.5 + i);
        const b = P(-i * 4 * s - 4, -1.5 + i);
        g.lineStyle(0.8, E.light, 0.7 - i * 0.2).lineBetween(a.x, a.y, b.x, b.y);
      }
      break;
    }
    case 'shadow': {
      // a knot of dark with a violet rim, and wisps coming off it
      for (let i = 1; i <= 4; i++) {
        const p = P(-i * 2.4 * s, Math.sin(age * 10 + i * 1.7 + seed) * 1.6 * s);
        g.fillStyle(E.col, 0.6 - i * 0.12).fillCircle(p.x, p.y, (2 - i * 0.3) * s);
      }
      g.fillStyle(E.light, 0.5).fillCircle(x, y, 3.2 * s);
      g.fillStyle(E.dark, 1).fillCircle(x, y, 2.6 * s);
      g.fillStyle(0x140a1e, 1).fillCircle(x + Math.cos(ang) * 0.5, y + Math.sin(ang) * 0.5, 1.6 * s);
      const e = P(0.8, -0.8);
      g.fillStyle(E.light, 1).fillRect(e.x - 0.5, e.y - 0.5, 1, 1);
      break;
    }
    case 'star': {
      // a four-pointed star of light, turning, in its own halo
      g.fillStyle(0xfff4c0, 0.3).fillCircle(x, y, 4.2 * s);
      for (const a of [0, Math.PI / 2]) {
        const R = frame(x, y, age * 6 + seed + a);
        const t0 = R(4.4 * s, 0);
        const t1 = R(-4.4 * s, 0);
        const l = R(0, -1.1 * s);
        const r = R(0, 1.1 * s);
        g.fillStyle(0xfff8e0, 1).fillTriangle(t0.x, t0.y, l.x, l.y, r.x, r.y).fillTriangle(t1.x, t1.y, l.x, l.y, r.x, r.y);
      }
      g.fillStyle(0xffffff, 1).fillCircle(x, y, 1.3 * s);
      const t = P(-5 * s, 0);
      g.lineStyle(1, 0xfff0a0, 0.5).lineBetween(x, y, t.x, t.y);
      break;
    }
    case 'needle': {
      // a thin spine, point first, with a flight at the back
      const tip = P(4.5 * s, 0);
      const back = P(-4 * s, 0);
      g.lineStyle(1.6, E.dark, 1).lineBetween(tip.x, tip.y, back.x, back.y);
      g.lineStyle(0.7, E.light, 1).lineBetween(tip.x, tip.y, back.x, back.y);
      g.fillStyle(0xffffff, 1).fillRect(tip.x - 0.5, tip.y - 0.5, 1.2, 1.2);
      const f0 = P(-3 * s, -1.6 * s);
      const f1 = P(-3 * s, 1.6 * s);
      g.fillStyle(E.col, 1).fillTriangle(back.x, back.y, f0.x, f0.y, P(-1.5 * s, 0).x, P(-1.5 * s, 0).y).fillTriangle(back.x, back.y, f1.x, f1.y, P(-1.5 * s, 0).x, P(-1.5 * s, 0).y);
      break;
    }
    case 'bubble': {
      // wobbling, see-through, with the shine on it
      const r = (3 + Math.sin(age * 18 + seed) * 0.35) * s;
      g.fillStyle(E.light, 0.25).fillCircle(x, y, r);
      g.lineStyle(1, E.light, 0.95).strokeCircle(x, y, r);
      g.fillStyle(0xffffff, 1).fillRect(x - r * 0.5, y - r * 0.6, 1.3, 1.3);
      g.fillStyle(0xffffff, 0.6).fillRect(x + r * 0.3, y + r * 0.3, 0.8, 0.8);
      break;
    }
    case 'seed': {
      // a husk with a stripe, end over end
      const Q = frame(x, y, ang + age * 16);
      const pts = [Q(3 * s, 0), Q(0.8 * s, -1.8 * s), Q(-2.6 * s, -1 * s), Q(-2.6 * s, 1 * s), Q(0.8 * s, 1.8 * s)];
      g.fillStyle(0x8a5a2a, 1).fillPoints(pts.map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
      const a = Q(2.4 * s, 0);
      const b = Q(-2.2 * s, 0);
      g.lineStyle(0.8, 0xd8b070, 1).lineBetween(a.x, a.y, b.x, b.y);
      const sp = Q(-3.4 * s, 0);
      g.fillStyle(E.col, 1).fillCircle(sp.x, sp.y, 1 * s);
      break;
    }
    case 'glob': {
      // a gobbet with drips flying off the back of it
      for (let i = 1; i <= 3; i++) {
        const p = P(-i * 2.8 * s, (fl(i) - 0.5) * 2.4);
        g.fillStyle(E.col, 0.85 - i * 0.2).fillCircle(p.x, p.y, (1.5 - i * 0.3) * s);
      }
      g.fillStyle(E.dark, 1).fillCircle(x, y, 2.9 * s);
      g.fillStyle(E.col, 1).fillCircle(x + Math.cos(ang) * 0.4, y + Math.sin(ang) * 0.4, 2.2 * s);
      g.fillStyle(E.light, 1).fillCircle(x + Math.cos(ang - 1) * 1, y + Math.sin(ang - 1) * 1, 0.9 * s);
      break;
    }
  }
}
