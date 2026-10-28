/**
 * ---- A PICTURE FOR EVERY BADGE (log #59).  Each badge gets its own symbol,
 * drawn from primitives at its own centre -- never one shape recoloured --
 * so a wall of them reads at a glance: a road for Frog Cross, a bullet for
 * the Chamber, a padlock-free door for the hidden alley.  Mastery and secret
 * badges sit on a gold double ring and a star-studded rim, which is what
 * makes them read as the rare ones; story badges on a plain one.
 *
 * `size` is the medal's radius in pixels (8 on the badge screen, 9 on the
 * drop-down).  Locked, the picture is drawn in slate, unlit.
 */

import type Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;
type Draw = (g: G, x: number, y: number, k: number, ink: number, hi: number) => void;

const disc = (g: G, x: number, y: number, r: number, col: number, a = 1) => g.fillStyle(col, a).fillCircle(x, y, r);
const box = (g: G, x: number, y: number, w: number, h: number, col: number, a = 1) => g.fillStyle(col, a).fillRect(x - w / 2, y - h / 2, w, h);
const line = (g: G, x1: number, y1: number, x2: number, y2: number, col: number, w = 1) => g.lineStyle(w, col, 1).lineBetween(x1, y1, x2, y2);
const tri = (g: G, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, col: number) => g.fillStyle(col, 1).fillTriangle(ax, ay, bx, by, cx, cy);

/** The pictures.  `k` is a unit (size / 8); `ink` the main colour, `hi` the highlight. */
const ICONS: Record<string, Draw> = {
  // ---------------------------------------------------------------- story
  hide_seek: (g, x, y, k, ink, hi) => {
    // an eye peeping round a door
    box(g, x + 2 * k, y, 4 * k, 9 * k, ink);
    g.fillStyle(hi, 1).fillEllipse(x - 2 * k, y, 6 * k, 3.4 * k);
    disc(g, x - 2 * k, y, 1.2 * k, 0x101010);
  },
  not_homeless: (g, x, y, k, ink, hi) => {
    // a key
    g.lineStyle(1.4 * k, ink, 1).strokeCircle(x - 2.5 * k, y, 2 * k);
    line(g, x - 0.5 * k, y, x + 4 * k, y, ink, 1.4 * k);
    line(g, x + 3 * k, y, x + 3 * k, y + 2 * k, hi, 1.2 * k);
  },
  late_checkout: (g, x, y, k, ink, hi) => {
    // rooftops and a moon
    tri(g, x - 5 * k, y + 3 * k, x - 1 * k, y - 1 * k, x + 3 * k, y + 3 * k, ink);
    box(g, x + 3 * k, y + 1.5 * k, 4 * k, 3 * k, ink);
    disc(g, x + 3 * k, y - 3 * k, 1.6 * k, hi);
  },
  most_wanted: (g, x, y, k, ink, hi) => {
    // a poster with a face on it
    box(g, x, y, 8 * k, 9 * k, hi);
    disc(g, x, y - 1 * k, 2 * k, ink);
    box(g, x, y + 3 * k, 6 * k, 1 * k, ink);
  },
  new_face: (g, x, y, k, ink, hi) => {
    // a hat over glasses
    box(g, x, y - 3 * k, 5 * k, 2.5 * k, ink);
    box(g, x, y - 1.6 * k, 8 * k, 1 * k, ink);
    g.lineStyle(1, hi, 1).strokeCircle(x - 2 * k, y + 2 * k, 1.6 * k).strokeCircle(x + 2 * k, y + 2 * k, 1.6 * k);
  },
  new_leaf: (g, x, y, k, ink, hi) => {
    // a door with 213 on it -- a leaf in place of the number
    box(g, x, y, 6 * k, 9 * k, ink);
    g.fillStyle(hi, 1).fillEllipse(x, y - 1 * k, 3 * k, 4.5 * k);
    disc(g, x + 2 * k, y + 1.5 * k, 0.6 * k, hi);
  },
  low_profile: (g, x, y, k, ink, hi) => {
    // a figure crouched behind a bin
    disc(g, x - 2 * k, y - 2 * k, 1.5 * k, hi);
    box(g, x - 2 * k, y + 0.5 * k, 3 * k, 3 * k, hi);
    box(g, x + 1.5 * k, y + 1.5 * k, 5 * k, 5 * k, ink);
  },
  good_heart: (g, x, y, k, ink) => {
    // a heart
    disc(g, x - 1.6 * k, y - 1 * k, 2 * k, ink);
    disc(g, x + 1.6 * k, y - 1 * k, 2 * k, ink);
    tri(g, x - 3.5 * k, y - 0.4 * k, x + 3.5 * k, y - 0.4 * k, x, y + 3.6 * k, ink);
  },
  justice: (g, x, y, k, ink, hi) => {
    // bars
    for (const dx of [-3, -1, 1, 3]) box(g, x + dx * k, y, 1 * k, 9 * k, ink);
    box(g, x, y - 4 * k, 8 * k, 1 * k, hi);
  },
  // ------------------------------------------------------------- mastery
  m_ttt: (g, x, y, k, ink, hi) => {
    // three noughts in a row, struck through
    for (const dx of [-3, 0, 3]) g.lineStyle(1, ink, 1).strokeCircle(x + dx * k, y, 1.3 * k);
    line(g, x - 5 * k, y, x + 5 * k, y, hi, 1);
  },
  m_hoops: (g, x, y, k, ink, hi) => {
    // a fly over an open mouth
    g.fillStyle(ink, 1).fillEllipse(x, y + 2 * k, 8 * k, 4 * k);
    g.fillStyle(0x301010, 1).fillEllipse(x, y + 2.4 * k, 5 * k, 2 * k);
    disc(g, x, y - 3 * k, 1 * k, hi);
    line(g, x - 2 * k, y - 4 * k, x + 2 * k, y - 4 * k, hi, 1);
  },
  m_whack: (g, x, y, k, ink, hi) => {
    // a mallet coming down
    box(g, x + 1 * k, y - 2.5 * k, 6 * k, 3 * k, ink);
    line(g, x + 1 * k, y - 1 * k, x - 3 * k, y + 4 * k, hi, 1.2 * k);
  },
  m_bowl: (g, x, y, k, ink, hi) => {
    // three pins
    for (const dx of [-3, 0, 3]) {
      disc(g, x + dx * k, y - 2.5 * k, 1 * k, hi);
      g.fillStyle(hi, 1).fillEllipse(x + dx * k, y + 1.2 * k, 2.2 * k, 5 * k);
    }
    box(g, x, y + 0.2 * k, 9 * k, 0.6 * k, ink);
  },
  m_pond: (g, x, y, k, ink, hi) => {
    // a lily pad with a magnifier
    g.fillStyle(ink, 1).fillEllipse(x - 1 * k, y + 1 * k, 7 * k, 4 * k);
    g.lineStyle(1, hi, 1).strokeCircle(x + 1.5 * k, y - 1.5 * k, 2.2 * k);
    line(g, x + 3 * k, y, x + 4.5 * k, y + 2 * k, hi, 1.2 * k);
  },
  m_grudge: (g, x, y, k, ink, hi) => {
    // a glove
    g.fillStyle(ink, 1).fillRoundedRect(x - 3 * k, y - 3.5 * k, 6 * k, 6 * k, 2 * k);
    box(g, x, y + 3.5 * k, 4 * k, 2 * k, hi);
  },
  m_kong: (g, x, y, k, ink, hi) => {
    // a girder and a ladder up to a flag
    line(g, x - 4 * k, y + 3 * k, x + 4 * k, y + 1 * k, ink, 1.4 * k);
    line(g, x - 1 * k, y + 2.5 * k, x - 1 * k, y - 3 * k, hi, 1);
    line(g, x + 1 * k, y + 2 * k, x + 1 * k, y - 3 * k, hi, 1);
    tri(g, x + 2 * k, y - 4.5 * k, x + 5 * k, y - 3.5 * k, x + 2 * k, y - 2.5 * k, ink);
  },
  m_hockey: (g, x, y, k, ink, hi) => {
    // a puck and a striker
    g.fillStyle(ink, 1).fillEllipse(x - 2 * k, y + 2 * k, 5 * k, 2.2 * k);
    disc(g, x + 2 * k, y - 2 * k, 2.4 * k, hi);
    disc(g, x + 2 * k, y - 2 * k, 1 * k, ink);
  },
  m_flood: (g, x, y, k, ink, hi) => {
    // a hatch above rising water
    box(g, x, y - 3 * k, 5 * k, 2 * k, hi);
    for (let i = 0; i < 3; i++) line(g, x - 4 * k, y + (1 + i * 1.6) * k, x + 4 * k, y + (1 + i * 1.6) * k, ink, 1);
  },
  m_dance: (g, x, y, k, ink, hi) => {
    // four arrows, one of each
    tri(g, x, y - 4.5 * k, x - 1.6 * k, y - 2 * k, x + 1.6 * k, y - 2 * k, ink);
    tri(g, x, y + 4.5 * k, x - 1.6 * k, y + 2 * k, x + 1.6 * k, y + 2 * k, ink);
    tri(g, x - 4.5 * k, y, x - 2 * k, y - 1.6 * k, x - 2 * k, y + 1.6 * k, hi);
    tri(g, x + 4.5 * k, y, x + 2 * k, y - 1.6 * k, x + 2 * k, y + 1.6 * k, hi);
  },
  m_cross5: (g, x, y, k, ink, hi) => {
    // a road with one dash
    box(g, x, y, 9 * k, 5 * k, ink);
    box(g, x, y, 2 * k, 0.8 * k, hi);
  },
  m_cross10: (g, x, y, k, ink, hi) => {
    box(g, x, y, 9 * k, 5 * k, ink);
    for (const dx of [-2, 2]) box(g, x + dx * k, y, 2 * k, 0.8 * k, hi);
  },
  m_cross15: (g, x, y, k, ink, hi) => {
    // the road, and the frog safely over it
    box(g, x, y + 1.5 * k, 9 * k, 4 * k, ink);
    for (const dx of [-3, 0, 3]) box(g, x + dx * k, y + 1.5 * k, 1.6 * k, 0.8 * k, hi);
    disc(g, x, y - 3 * k, 1.6 * k, 0x6fd46e);
  },
  m_chase: (g, x, y, k, ink, hi) => {
    // a car with a bag of cash on its roof
    g.fillStyle(ink, 1).fillRoundedRect(x - 4 * k, y, 8 * k, 3.5 * k, 1 * k);
    disc(g, x, y - 2 * k, 2 * k, hi);
    box(g, x, y - 4 * k, 1 * k, 1.4 * k, hi);
  },
  m_fence: (g, x, y, k, ink, hi) => {
    // a fence and a shield
    for (const dx of [-4, -2, 0, 2, 4]) box(g, x + dx * k, y + 2 * k, 1 * k, 5 * k, ink);
    g.fillStyle(hi, 1).fillRoundedRect(x - 2.2 * k, y - 4.5 * k, 4.4 * k, 4.5 * k, 1.5 * k);
  },
  m_bog: (g, x, y, k, ink, hi) => {
    // a ball between two goal posts
    line(g, x - 4.5 * k, y - 3 * k, x - 4.5 * k, y + 3 * k, ink, 1.2 * k);
    line(g, x + 4.5 * k, y - 3 * k, x + 4.5 * k, y + 3 * k, ink, 1.2 * k);
    disc(g, x, y, 2.4 * k, hi);
  },
  m_slots: (g, x, y, k, ink, hi) => {
    // three sevens in a window
    box(g, x, y, 9 * k, 5 * k, hi);
    for (const dx of [-3, 0, 3]) {
      line(g, x + dx * k - 1 * k, y - 1.5 * k, x + dx * k + 1 * k, y - 1.5 * k, ink, 1);
      line(g, x + dx * k + 1 * k, y - 1.5 * k, x + dx * k - 0.5 * k, y + 1.8 * k, ink, 1);
    }
  },
  m_chamber: (g, x, y, k, ink, hi) => {
    // a cylinder of chambers, every one empty
    g.lineStyle(1, ink, 1).strokeCircle(x, y, 4 * k);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      disc(g, x + Math.cos(a) * 2.4 * k, y + Math.sin(a) * 2.4 * k, 0.9 * k, hi);
    }
  },
  m_race: (g, x, y, k, ink, hi) => {
    // a chequered flag
    line(g, x - 3 * k, y - 4 * k, x - 3 * k, y + 4 * k, ink, 1);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) box(g, x - 1.5 * k + c * 2 * k, y - 3 * k + r * 2 * k, 2 * k, 2 * k, (r + c) % 2 ? ink : hi);
  },
  m_mash: (g, x, y, k, ink, hi) => {
    // crossed swords
    line(g, x - 4 * k, y - 4 * k, x + 4 * k, y + 4 * k, hi, 1.2 * k);
    line(g, x + 4 * k, y - 4 * k, x - 4 * k, y + 4 * k, hi, 1.2 * k);
    box(g, x, y, 2 * k, 2 * k, ink);
  },
  m_croak: (g, x, y, k, ink, hi) => {
    // a gaping frog closing on a tadpole
    disc(g, x - 1.5 * k, y, 4 * k, ink);
    tri(g, x - 1.5 * k, y, x + 3 * k, y - 2.5 * k, x + 3 * k, y + 2.5 * k, 0x000000);
    disc(g, x + 4 * k, y, 1.2 * k, hi);
  },
  m_21: (g, x, y, k, ink, hi) => {
    // five cards fanned
    for (let i = 0; i < 5; i++) box(g, x + (i - 2) * 1.6 * k, y + Math.abs(i - 2) * 0.6 * k, 3 * k, 5 * k, i === 2 ? hi : ink);
  },
  m_wheel: (g, x, y, k, ink, hi) => {
    // a wheel with spokes and its pointer
    g.lineStyle(1, ink, 1).strokeCircle(x, y + 1 * k, 3.6 * k);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      line(g, x - Math.cos(a) * 3.6 * k, y + 1 * k - Math.sin(a) * 3.6 * k, x + Math.cos(a) * 3.6 * k, y + 1 * k + Math.sin(a) * 3.6 * k, ink, 1);
    }
    tri(g, x - 1.4 * k, y - 4.5 * k, x + 1.4 * k, y - 4.5 * k, x, y - 2.5 * k, hi);
  },
  m_crane: (g, x, y, k, ink, hi) => {
    // a claw over a capsule
    line(g, x, y - 5 * k, x, y - 1.5 * k, ink, 1);
    line(g, x, y - 1.5 * k, x - 2 * k, y, ink, 1);
    line(g, x, y - 1.5 * k, x + 2 * k, y, ink, 1);
    disc(g, x, y + 2.5 * k, 2 * k, hi);
  },
  m_master: (g, x, y, k, ink, hi) => {
    // a crown
    tri(g, x - 4 * k, y + 2 * k, x - 4 * k, y - 3 * k, x - 1.5 * k, y, hi);
    tri(g, x - 2 * k, y + 2 * k, x, y - 4 * k, x + 2 * k, y + 2 * k, hi);
    tri(g, x + 4 * k, y + 2 * k, x + 4 * k, y - 3 * k, x + 1.5 * k, y, hi);
    box(g, x, y + 3 * k, 8 * k, 2 * k, ink);
  },
  // ------------------------------------------------------- creature clash
  c_boss5: (g, x, y, k, ink, hi) => {
    // one horned skull
    disc(g, x, y, 3 * k, hi);
    tri(g, x - 3 * k, y - 1 * k, x - 4.5 * k, y - 4.5 * k, x - 1.5 * k, y - 2.5 * k, ink);
    tri(g, x + 3 * k, y - 1 * k, x + 4.5 * k, y - 4.5 * k, x + 1.5 * k, y - 2.5 * k, ink);
    disc(g, x - 1 * k, y, 0.7 * k, ink);
    disc(g, x + 1 * k, y, 0.7 * k, ink);
  },
  c_boss10: (g, x, y, k, ink, hi) => {
    // two of them
    for (const dx of [-2, 2]) {
      disc(g, x + dx * k, y + 1 * k, 2.2 * k, hi);
      tri(g, x + dx * k - 2 * k, y, x + dx * k - 2.6 * k, y - 3 * k, x + dx * k - 0.6 * k, y - 1.2 * k, ink);
      tri(g, x + dx * k + 2 * k, y, x + dx * k + 2.6 * k, y - 3 * k, x + dx * k + 0.6 * k, y - 1.2 * k, ink);
    }
  },
  c_story: (g, x, y, k, ink, hi) => {
    // a path of five stepping stones to a flag
    for (let i = 0; i < 4; i++) disc(g, x - 4 * k + i * 2.2 * k, y + 3 * k - i * 1.6 * k, 0.9 * k, ink);
    line(g, x + 4 * k, y - 4.5 * k, x + 4 * k, y + 1 * k, ink, 1);
    tri(g, x + 4 * k, y - 4.5 * k, x + 4 * k, y - 2 * k, x + 1 * k, y - 3.2 * k, hi);
  },
  c_boss_all: (g, x, y, k, ink, hi) => {
    // a skull with a crown on it
    disc(g, x, y + 1.5 * k, 2.8 * k, hi);
    tri(g, x - 3 * k, y - 1.5 * k, x - 3 * k, y - 4.5 * k, x - 1 * k, y - 2 * k, ink);
    tri(g, x - 1 * k, y - 1.5 * k, x, y - 5 * k, x + 1 * k, y - 1.5 * k, ink);
    tri(g, x + 3 * k, y - 1.5 * k, x + 3 * k, y - 4.5 * k, x + 1 * k, y - 2 * k, ink);
    disc(g, x - 1 * k, y + 1.5 * k, 0.7 * k, ink);
    disc(g, x + 1 * k, y + 1.5 * k, 0.7 * k, ink);
  },
  // --------------------------------------------------------------- secret
  s_lazy: (g, x, y, k, ink, hi) => {
    // a box with Zs over it
    box(g, x, y + 2 * k, 7 * k, 4 * k, ink);
    line(g, x - 1 * k, y - 4 * k, x + 1.5 * k, y - 4 * k, hi, 1);
    line(g, x + 1.5 * k, y - 4 * k, x - 1 * k, y - 1.6 * k, hi, 1);
    line(g, x - 1 * k, y - 1.6 * k, x + 1.5 * k, y - 1.6 * k, hi, 1);
  },
  s_404: (g, x, y, k, ink, hi) => {
    // a cracked screen with a wide white stare
    box(g, x, y, 9 * k, 7 * k, ink);
    disc(g, x - 1.8 * k, y - 0.5 * k, 1.4 * k, hi);
    disc(g, x + 1.8 * k, y - 0.5 * k, 1.4 * k, hi);
    line(g, x - 4 * k, y - 3 * k, x + 1 * k, y + 3 * k, 0x101010, 0.8);
  },
  s_alley: (g, x, y, k, ink, hi) => {
    // a gap between two walls, a light at the end of it
    box(g, x - 3 * k, y, 3 * k, 9 * k, ink);
    box(g, x + 3 * k, y, 3 * k, 9 * k, ink);
    disc(g, x, y + 2 * k, 1.2 * k, hi);
  },
  s_roof: (g, x, y, k, ink, hi) => {
    // a stair up to a door open on stars
    for (let i = 0; i < 3; i++) box(g, x - 3 * k + i * 2 * k, y + 3 * k - i * 1.6 * k, 2 * k, 1.6 * k, ink);
    box(g, x + 3 * k, y - 2 * k, 3 * k, 5 * k, 0x101830);
    disc(g, x + 3 * k, y - 3 * k, 0.5 * k, hi);
    disc(g, x + 2.6 * k, y - 1 * k, 0.4 * k, hi);
  },
};

/** Which badges are the rare ones: drawn on the gold double ring. */
export const isRare = (id: string): boolean => id.startsWith('m_') || id.startsWith('s_') || id.startsWith('c_');

/** The medal for `id`, centred on (x, y), radius `size`. */
export function drawBadgeIcon(g: G, id: string, x: number, y: number, size: number, col: number, locked = false): void {
  const k = size / 8;
  const rare = isRare(id);
  const ink = locked ? 0x2f3540 : 0x14100c;
  const hi = locked ? 0x4a5260 : 0xf4ecd8;
  // the medal itself
  disc(g, x, y, size, locked ? 0x262b34 : col);
  if (rare) {
    // the prestige: a gold double ring, studs round the rim
    g.lineStyle(1, locked ? 0x3a414c : 0xffd45e, 1).strokeCircle(x, y, size).strokeCircle(x, y, size - 1.6);
    if (!locked) for (let i = 0; i < 8; i++) disc(g, x + Math.cos((i / 8) * Math.PI * 2) * size, y + Math.sin((i / 8) * Math.PI * 2) * size, 0.8, 0xfff2b0);
  } else g.lineStyle(1, locked ? 0x3a414c : 0x14100c, 1).strokeCircle(x, y, size);
  const draw = ICONS[id];
  if (draw) draw(g, x, y, k * 0.82, ink, hi);
  if (!locked) disc(g, x - size * 0.45, y - size * 0.5, size * 0.18, 0xffffff, 0.35);
}

/** For the harness: every badge id that has a picture of its own. */
export const ICON_IDS = Object.keys(ICONS);
