/**
 * ---- THE EIGHTY BODIES, as parts for art/sdf's one-skin renderer.
 *
 * Each is a function of time (`t`, in seconds) that lays out its parts --
 * the body, the limbs, the horns and fins -- joined smoothly into one
 * silhouette, plus the decals that sit on it (eyes, stripes, spots, glyphs).
 * Units: one unit is a pixel at scale 1; the creature faces +x, its feet
 * are about y = 7.5, and it stands about 18 units tall (a boss, more).
 *
 * The element shows in the body itself -- flame crests, ice spikes, crystal
 * quills, a lantern -- always grown out of the body (joined, not laid on
 * top), so nothing floats.  The only parts that do float are meant to: a
 * halo, a storm's rain (drawn by creatureArt as weather, not body).
 */

import { Build, type BodyDesc, type Tone } from './sdf';
import type { Body, BossBody } from '../game/creatures';

const FLAME = 0xff8a3a;
const FLAME2 = 0xffd060;
const ICE = 0xd8f4ff;
const IVORY = 0xf0ead8;
const PINK = 0xe88a9a;
const BEAK = 0xe8a030;

type Def = (t: number) => BodyDesc;

const flames = (B: Build, x: number, y: number, n: number, t: number, h = 4) => {
  for (let i = 0; i < n; i++) {
    const u = x + (i - (n - 1) / 2) * 1.8;
    const w = Math.sin(t * 9 + i * 1.3) * 0.8;
    B.tri(u - 1.1, y + 0.6, u + 1.1, y + 0.6, u + w, y - h - (i % 2) * 0.8, FLAME, 0.7);
    B.tri(u - 0.5, y + 0.3, u + 0.5, y + 0.3, u + w * 0.6, y - h * 0.55, FLAME2, 0.4);
  }
};
const spikes = (B: Build, pts: [number, number, number][], tone: Tone = ICE) => {
  for (const [x, y, h] of pts) B.tri(x - 0.9, y + 0.5, x + 0.9, y + 0.5, x + 0.2, y - h, tone, 0.5);
};

export const BODY_DEFS: Record<Body | BossBody, Def> = {
  // ================================================================= EMBER
  mole: (t) => {
    const B = new Build();
    const bob = Math.sin(t * 4) * 0.3;
    B.e(-3, 6.4, 1.8, 1.2, 'd').e(3, 6.4, 1.8, 1.2, 'd');
    B.e(0, 1 + bob, 6.5, 5.4, 'b', 0, 1.4);
    B.e(4.6, 1.8 + bob, 2.8, 2.1, 'l', 0, 1.2);
    B.c(7, 1.4 + bob, 1, PINK, 0.4);
    B.tri(4.4, 4.6, 6.4, 4.4, 6.6, 6.6, IVORY, 0.5);
    flames(B, -1.5, -3.6 + bob, 3, t);
    B.eye(2.6, -0.9 + bob, 1).dl(-4, 2.5 + bob, -1, 3.5 + bob, 0.3, 'd');
    return B.done();
  },
  wisp: (t) => {
    const B = new Build();
    const w = Math.sin(t * 3) * 1;
    B.c(0, -0.5 + w, 4.6, 'b', 1);
    B.tri(-3.6, 1 + w, 3.6, 1 + w, Math.sin(t * 5) * 1.5, 8 + w, 'b', 1.6);
    flames(B, 0, -4 + w, 3, t, 4.5);
    B.dc(0, 0.5 + w, 2.2, 'l').eye(-1.2, -0.6 + w, 0.9).eye(1.6, -0.6 + w, 0.9);
    return B.done();
  },
  slug: (t) => {
    const B = new Build();
    const r = Math.sin(t * 3) * 0.4;
    B.e(-1, 4.2, 8.2, 2.6, 'b', 0, 1);
    B.e(-3, 2.4 + r, 4.8, 2.4, 'd', 0, 1.4);
    for (const k of [0, 1]) {
      const sx = 5.3 + k * 1.4 + Math.sin(t * 2 + k) * 0.7;
      B.cap(4.6 + k * 1.2, 3, sx, -1.4, 0.45, 0.35, 'b', 0.6).c(sx, -1.7, 0.85, 'l', 0.3);
    }
    for (let i = 0; i < 4; i++) B.dc(-6 + i * 2, 2.4 + r, 0.5, Math.sin(t * 4 + i) > 0 ? FLAME2 : FLAME);
    B.dl(-7, 3.6, 4, 3.6, 0.25, 'l');
    B.dc(5.4 + Math.sin(t * 2) * 0.7 + 0.2, -1.7, 0.4, 'k').dc(6.8 + Math.sin(t * 2 + 1) * 0.7 + 0.2, -1.7, 0.4, 'k');
    return B.done();
  },
  scorpion: (t) => {
    const B = new Build();
    const st = Math.sin(t * 9) * 0.6;
    for (let i = 0; i < 3; i++) for (const k of [-1, 1]) B.cap(-1 + i * 2, 4, -2 + i * 2.6 + k * st * 0.3, 7.4, 0.35, 0.3, 'd', 0.3);
    B.e(0, 3.2, 5.2, 2.6, 'b', 0, 1);
    B.e(4.4, 3.2, 2.4, 2, 'b', 0, 0.8);
    B.cap(5, 3.2, 8, 1.2, 0.6, 0.6, 'd', 0.5).e(8.8, 0.8, 1.5, 1.1, 'd', -0.4, 0.5);
    B.cutTri(9, 0, 10.6, -0.2, 9.4, 1);
    B.chain([[-4.5, 2.2], [-6.6, -0.6], [-6.2, -4.2], [-3.8 + Math.sin(t * 2) * 0.4, -6.4]], 1.6, 1.1, 'b', 0.8);
    B.tri(-3.6 + Math.sin(t * 2) * 0.4, -7.4, -2.4, -6.2, -3.4, -5.4, FLAME, 0.3);
    for (let i = 0; i < 3; i++) B.dl(-2.5 + i * 2, 1.2, -2.5 + i * 2, 5, 0.25, 'd');
    B.glow(5.2, 2.2, 0.55, FLAME2);
    return B.done();
  },
  boar: (t) => {
    const B = new Build();
    const st = Math.sin(t * 7) * 0.6;
    for (const [u, p] of [[-4.5, st], [-2, -st], [2.5, st], [4.5, -st]] as const) B.cap(u, 3, u + p * 0.4, 7.4, 1, 0.8, 'd', 0.4);
    B.e(-1, 1.4, 7, 4.4, 'b', 0, 1.2);
    B.e(5.2, 2, 3.4, 3, 'b', 0, 1.4);
    B.box(8.2, 2.9, 2.6, 2.4, 0.9, 'l', 0, 0.6);
    B.tri(7.8, 3.6, 8.8, 3.4, 9.4, 0.4, IVORY, 0.3);
    B.tri(3.2, -0.6, 5, -1.2, 3.6, -3.6, 'd', 0.5);
    flames(B, -1.5, -2.6, 4, t, 3);
    B.dl(-4, 0.5, 2, 0.5, 0.3, 'd').dl(-3.5, 2.5, 1.5, 2.5, 0.3, 'd');
    B.dc(8.6, 2.6, 0.35, 'k').dc(8.6, 3.4, 0.35, 'k').eye(5.4, 0.8, 0.75);
    return B.done();
  },
  heron: (t) => {
    const B = new Build();
    const sw = Math.sin(t * 2) * 0.6;
    B.cap(-1, 2.6, -1.6, 7.6, 0.4, 0.35, BEAK, 0.4).cap(0.6, 2.6, 1, 7.6, 0.4, 0.35, BEAK, 0.4);
    B.e(-1, 0.4, 4.2, 3, 'b', -0.2, 1);
    B.chain([[2, -0.8], [3.6, -3.4], [3 + sw, -6], [4.2 + sw, -7.6]], 1.1, 0.8, 'b', 1);
    B.c(4.8 + sw, -7.8, 1.6, 'b', 0.8);
    B.cap(6, -7.9 + 0, 9.8 + sw, -7.4, 0.6, 0.15, BEAK, 0.4);
    flames(B, -4.6, -0.6, 2, t, 3.2);
    B.tri(-5, 0.4, -4.6, 2.2, -8.4, 2.8, FLAME, 0.6);
    B.de(-1.4, 0.6, 2.6, 1.4, 'd', -0.2).eye(5.1 + sw, -8.2, 0.55);
    return B.done();
  },
  // ================================================================== TIDE
  toad: (t) => {
    const B = new Build();
    const bob = Math.sin(t * 4) * 0.3;
    B.e(-5, 6.6, 2.4, 1.1, 'd').e(5, 6.6, 2.4, 1.1, 'd');
    B.e(0, 2 + bob, 7, 5, 'b', 0, 1.2);
    B.c(-2.4, -2.4 + bob, 2, 'b', 1).c(2.4, -2.4 + bob, 2, 'b', 1);
    B.tri(-0.8, -3 + bob, 0.8, -3 + bob, 0.2, -6.4 + bob, 'l', 0.6);
    B.de(0, 3.6 + bob, 5, 2.4, 'l').dl(-2.6, 1.6 + bob, 2.6, 1.6 + bob, 0.3, 'd');
    B.eye(-2.2, -2.6 + bob, 1.2).eye(2.6, -2.6 + bob, 1.2);
    return B.done();
  },
  ray: (t) => {
    const B = new Build();
    const fl = Math.sin(t * 5) * 1.4;
    B.tri(-8, 0.5 + fl, 0, -4.6, 0, 3.6, 'b', 0.8, 0.6).tri(8, 0.5 - fl, 0, -4.6, 0, 3.6, 'b', 0.8, 0.6);
    B.cap(-2, 2.4, -9, 5 + Math.sin(t * 3), 0.6, 0.15, 'd', 0.4);
    B.de(0, 1.6, 3, 1.6, 'l').eye(-1.4, -1, 0.85).eye(1.6, -1, 0.85);
    return B.done();
  },
  puffer: (t) => {
    const B = new Build();
    const p = (Math.sin(t * 2) + 1) * 0.35;
    const R = 5 + p;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      B.tri(Math.cos(a - 0.18) * R, Math.sin(a - 0.18) * R, Math.cos(a + 0.18) * R, Math.sin(a + 0.18) * R, Math.cos(a) * (R + 2), Math.sin(a) * (R + 2), 'l', 0.4);
    }
    B.c(0, 0, R, 'b', 1);
    B.tri(-R + 0.4, 0, -R - 3.2, -2.4 + Math.sin(t * 6), -R - 3.2, 2.4 + Math.sin(t * 6), 'd', 0.8);
    B.de(0.6, 1.6, 3.6, 2.4, 'l').dc(R - 0.8, 1.2, 0.6, 'k').eye(2.2, -1.4, 1.2);
    return B.done();
  },
  urchin: (t) => {
    const B = new Build();
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (1.05 + (i / 8) * 0.9) + Math.sin(t * 2 + i) * 0.05;
      B.cap(Math.cos(a) * 3, 2 + Math.sin(a) * 3, Math.cos(a) * 10, 2 + Math.sin(a) * 9.5, 0.6, 0.3, 'd', 0.5);
    }
    for (const u of [-4, -2, 0, 2, 4]) B.c(u, 6.6 + Math.sin(t * 6 + u) * 0.3, 0.8, 'l', 0.6);
    B.e(0, 2.6, 5.6, 4.4, 'b', 0, 1.2);
    B.dc(-2, 1, 0.5, 'l').dc(1.6, 0, 0.5, 'l').dc(0, 3.6, 0.5, 'l').eye(-1.4, 2.4, 0.8).eye(1.8, 2.4, 0.8);
    return B.done();
  },
  newt: (t) => {
    const B = new Build();
    const sw = Math.sin(t * 4);
    for (const [u, k] of [[-3, 1], [3, -1]] as const) B.cap(u, 3.6, u + k * 0.5 + sw * 0.4 * k, 6.8, 0.6, 0.5, 'b', 0.4);
    B.chain([[-4.6, 3.2], [-7.6, 3 + sw * 0.8], [-10.4, 2 + sw * 1.4]], 1.6, 0.4, 'b', 1);
    B.e(0, 3, 5.6, 2.6, 'b', 0, 1.2);
    B.e(5, 2.2, 3, 2.4, 'b', 0, 1.2);
    for (const b of [0, 0.8, 1.6]) B.cap(3.8, 0.6 + b * 0.4, 2.2, -2 + b, 0.45, 0.3, 0xff8ab0, 0.4);
    B.de(0, 4, 4.4, 1.2, 'l').eye(6.2, 1.6, 0.7).dl(6.2, 3.2, 7.4, 3, 0.25, 'd');
    return B.done();
  },
  seahorse: (t) => {
    const B = new Build();
    const b = Math.sin(t * 3) * 0.7;
    B.chain([[0, 3.4 + b], [1.8, 6.4 + b], [3.6, 6 + b], [3.4, 4.2 + b], [2.2, 4.6 + b]], 1.6, 0.6, 'b', 1);
    B.cap(-0.3, -3.6 + b, 0, 3 + b, 2.2, 2.4, 'b', 1);
    B.e(1.2, -6 + b, 2.4, 2, 'b', 0, 1.2);
    B.cap(2.6, -6 + b, 6, -5.2 + b, 0.85, 0.65, 'b', 0.6);
    B.tri(-2.2, -2 + b, -2.4, 1.4 + b, -5 + Math.sin(t * 9) * 0.5, -0.4 + b, 'l', 0.6);
    spikes(B, [[0.4, -7.6 + b, 1.6], [-0.8, -7.2 + b, 1.2]], 'l');
    for (let i = 0; i < 4; i++) B.dl(1.2, -2 + i * 1.4 + b, 2.2, -2 + i * 1.4 + b, 0.25, 'l');
    B.eye(1.6, -6.6 + b, 0.8);
    return B.done();
  },
  // ================================================================== MOSS
  crab: (t) => {
    const B = new Build();
    const w = Math.sin(t * 5) * 0.4;
    for (let i = 0; i < 3; i++) for (const k of [-1, 1]) B.cap(k * (3 + i), 4, k * (5.4 + i * 1.3), 7.4, 0.45, 0.35, 'd', 0.3);
    for (const k of [-1, 1]) {
      B.cap(k * 5, 1.4, k * 8, -1.6 + w, 0.9, 0.9, 'b', 0.6).c(k * 8.4, -3 + w, 2.1, 'b', 0.6);
      B.cutTri(k * 8.4, -3.4 + w, k * 10.8, -5.8 + w, k * 10.8, -2.8 + w);
    }
    B.e(0, 2.2, 6.4, 4, 'b', 0, 1.2);
    for (const k of [-1, 1]) B.cap(k * 1.6, -0.8, k * 1.6, -3.4, 0.4, 0.4, 'd', 0.5).c(k * 1.6, -3.6, 1.1, 'w', 0.3);
    B.cap(0, -1.4, 0.4, -4.6, 0.3, 0.2, 0x3a7a28, 0.4).e(1.4, -4.6, 1.4, 0.7, 0x6ab84a, -0.4, 0.3);
    B.de(0, 3.4, 4.2, 1.4, 'l').dc(-1.6 + 0.3, -3.6, 0.5, 'k').dc(1.6 + 0.3, -3.6, 0.5, 'k');
    return B.done();
  },
  sprout: (t) => {
    const B = new Build();
    const sw = Math.sin(t * 2.5) * 0.6;
    for (const [a, b, s] of [[-2, -5, 1], [-0.6, -2.2, -1], [1, 2.4, 1], [2, 5.4, -1]] as const) B.chain([[a, 3], [(a + b) / 2 + s * Math.sin(t * 4) * 0.4, 5.6], [b, 7.4]], 0.6, 0.4, 0x6a4a2a, 0.6);
    B.e(0, 0, 4.6, 4.6, 'b', 0, 1.4);
    for (const k of [-1, 0, 1]) B.e(k * 2.6 + sw, -6 + Math.abs(k), 1.5, 2.8, 0x3a7a28, k * 0.5, 0.8);
    B.de(-1.5, -1.8, 1.2, 1.8, 'l').eye(-1.4, -0.4, 0.95).eye(1.7, -0.4, 0.95).dl(-0.8, 1.7, 0.9, 1.7, 0.3, 'd');
    return B.done();
  },
  stag: (t) => {
    const B = new Build();
    const st = Math.sin(t * 7) * 0.8;
    for (const [u, p] of [[-4.6, st], [-3, -st], [2.4, -st], [4, st]] as const) B.cap(u, 2.6, u + p, 7.4, 0.55, 0.45, 'd', 0.5);
    B.e(-1, 0.6, 6, 3.4, 'b', 0, 1.2);
    B.cap(3.4, -0.6, 5.2, -4, 1.6, 1.2, 'b', 1);
    B.e(6.2, -4.8, 2.4, 1.7, 'b', 0.2, 1);
    B.cap(7.6, -4.2, 8.6, -3.6, 0.9, 0.7, 'l', 0.5);
    B.chain([[5.6, -6.2], [4.4, -9], [3.2, -11.4]], 0.45, 0.3, 0x6a4a2a, 0.4).cap(4.6, -8.6, 6.6, -10.4, 0.35, 0.25, 0x6a4a2a, 0.2).cap(3.6, -10.4, 1.8, -11.4, 0.3, 0.2, 0x6a4a2a, 0.2);
    B.e(6.8, -10.8, 1.1, 0.6, 0x6ab84a, -0.5, 0.2).e(1.4, -11.6, 1, 0.55, 0x6ab84a, 0.5, 0.2);
    B.tri(-6.6, -1.2, -7.8, -2.6, -6.2, 0.4, 'l', 0.4);
    B.dc(-3, -0.5, 0.5, 'l').dc(-1, -1, 0.5, 'l').dc(1, -0.4, 0.5, 'l').eye(6.8, -5.2, 0.6);
    return B.done();
  },
  bear: (t) => {
    const B = new Build();
    const st = Math.sin(t * 5) * 0.6;
    for (const [u, p] of [[-5, st], [-2.6, -st], [2.4, st], [4.6, -st]] as const) B.cap(u, 3, u + p * 0.3, 7.2, 1.4, 1.3, 'd', 0.6);
    B.e(-1, 1, 7.6, 5.4, 'b', 0, 1.4);
    B.c(5.6, -1.6, 3.4, 'b', 1.4);
    B.c(4.2, -4.6, 1.2, 'b', 0.6).c(7, -4.4, 1.2, 'b', 0.6);
    B.e(8.3, -0.8, 1.9, 1.4, 'l', 0, 0.8);
    for (const [x, y] of [[-4, -1.6], [-1, -2.6], [2, -1.8]] as const) B.de(x, y, 1.6, 1, 'd').dl(x - 1, y, x + 1, y, 0.2, 0x3a2a1e);
    B.dc(9.6, -1.2, 0.5, 'k').eye(6.4, -2.4, 0.7);
    return B.done();
  },
  sloth: (t) => {
    const B = new Build();
    const r = Math.sin(t * 1.5) * 0.5;
    B.chain([[3, 0], [6.4, 3 + r], [7.4, 6.6]], 1.1, 0.9, 'b', 1);
    B.chain([[-3, 1.5], [-6, 4.4 - r], [-6.4, 7]], 1.1, 0.9, 'b', 1);
    for (const k of [0, 1]) B.tri(7 + k, 6.4, 7.6 + k, 6.4, 8.8 + k, 7.8, IVORY, 0.2);
    B.e(0, 2, 6, 4, 'b', 0, 1.4);
    B.c(4, -1.6, 2.8, 'b', 1.2);
    for (const [x, y] of [[-3, -1.4], [-0.6, -1.8], [1.6, -1.6]] as const) B.c(x, y, 1.1, 0x5aa83a, 0.6);
    B.de(4.6, -1.4, 2, 1.6, 'l').de(3.9, -1.8, 0.9, 0.5, 'd').de(5.5, -1.8, 0.9, 0.5, 'd').dc(4.2, -1.8, 0.35, 'k').dc(5.8, -1.8, 0.35, 'k').dl(4.4, -0.2, 5.2, -0.2, 0.2, 'd');
    return B.done();
  },
  bee: (t) => {
    const B = new Build();
    const fl = Math.sin(t * 22);
    const b = Math.sin(t * 4) * 0.6;
    for (const k of [-1, 1]) B.e(k * 0.6 - 0.5, -4.4 + b, 1.6, 2.8 + fl * 0.6, 0xe8f8ff, k * 0.5, 0.4);
    for (const k of [-1, 1]) B.cap(3 + k * 0.6, 2.6 + b, 3 + k * 1.1, 6.4 + b, 0.3, 0.25, 'k', 0.3);
    B.e(-1, 0 + b, 5, 3.8, 'b', 0, 1.2);
    B.tri(-5.6, -0.4 + b, -5.6, 0.8 + b, -8.4, 0.2 + b, 'k', 0.5);
    B.c(4, -0.4 + b, 2.6, 'k', 1);
    B.cap(4.6, -2.6 + b, 5.6, -5.4 + b, 0.25, 0.2, 'k', 0.3).c(5.7, -5.6 + b, 0.55, 'k', 0.2);
    for (const u of [-3.5, -1, 1.5]) B.dl(u, -3.4 + b, u, 3.4 + b, 0.7, 'k');
    B.glow(5, -0.8 + b, 0.8, 0xffe060);
    return B.done();
  },
  // ================================================================= FROST
  golem: (t) => {
    const B = new Build();
    const st = Math.sin(t * 3) * 0.5;
    B.box(-3, 5.6 + st * 0.3, 3.4, 4, 0.8, 'd').box(3, 5.6 - st * 0.3, 3.4, 4, 0.8, 'd');
    B.box(0, -0.6, 11, 8.6, 1.6, 'b', 0, 1.2);
    B.box(-6.8, 0.6 - st, 3, 7.6, 1, 'b', 0, 0.8).box(6.8, 0.6 + st, 3, 7.6, 1, 'b', 0, 0.8);
    B.box(0, -6.6, 6, 4.4, 1.2, 'b', 0, 1);
    spikes(B, [[-5.6, -4.4, 3], [-3.8, -4.6, 2], [5.6, -4.4, 3], [4, -4.6, 2]]);
    B.dl(-3, -1, 1, 1.6, 0.3, 'l').dl(2, -2.6, 3.2, 0, 0.25, 'l');
    B.glow(-1.4, -6.6, 0.75, 0x9affff).glow(1.6, -6.6, 0.75, 0x9affff);
    return B.done();
  },
  jelly: (t) => {
    const B = new Build();
    const w = Math.sin(t * 2.5) * 1.4;
    // the bell first, flat underneath (the cut), then the tentacles under it
    B.e(0, -0.6 + w, 6.6, 5.6, 'b', 0, 1);
    B.cutBox(0, 4 + w, 16, 6);
    for (let i = -2; i <= 2; i++) {
      const u = i * 1.9;
      B.chain([[u, 0.4 + w], [u + Math.sin(t * 4 + i) * 0.9, 3.4 + w], [u + Math.sin(t * 4 + i + 1) * 1.1, 6.4 + w]], 0.55, 0.25, 'l', 0.5);
    }
    B.dt(-3, -1 + w, -1, -4.4 + w, 0, -0.6 + w, ICE).dt(1, -0.6 + w, 2.6, -3.6 + w, 3.4, 0 + w, 'l');
    B.eye(-1.8, -1.4 + w, 0.8).eye(1.9, -1.4 + w, 0.8);
    return B.done();
  },
  ram: (t) => {
    const B = new Build();
    const st = Math.sin(t * 7) * 0.8;
    for (const [u, p] of [[-4.5, st], [-2.5, -st], [2.5, st], [4.5, -st]] as const) B.cap(u, 2.6, u + p * 0.3, 7.4, 0.7, 0.6, 'k', 0.3);
    for (const [u, v, r] of [[-4, -0.4, 3], [-1, -1.4, 3.2], [2, -0.4, 3], [-2.5, 1.6, 3], [1.5, 1.6, 2.8]] as const) B.c(u, v, r, 'w', 1.2);
    B.e(6, -1, 1.8, 2.6, 0x5a5050, 0.3, 1);
    B.chain([[5.2, -3.2], [3.6, -4.4], [3, -2.6], [4.2, -1.4]], 1.1, 0.7, 'b', 0.6);
    B.eye(6.6, -1.8, 0.6);
    return B.done();
  },
  penguin: (t) => {
    const B = new Build();
    const wd = Math.sin(t * 6) * 0.25;
    B.e(-1.6, 7, 1.8, 0.8, BEAK).e(1.8, 7, 1.8, 0.8, BEAK);
    B.e(0, 0, 4.4, 6.6, 'k', wd, 1.2);
    B.e(-4, 0.4, 1, 3.4, 'k', 0.4 + wd * 2, 0.8).e(4, 0.4, 1, 3.4, 'k', -0.4 + wd * 2, 0.8);
    B.tri(3.4, -3.4, 3.4, -2.2, 6.6, -2.8, BEAK, 0.4);
    spikes(B, [[-0.4, -6.2, 2], [1, -6, 1.4]]);
    B.de(0.8, 1.2, 3, 5, 'w').de(1.5, -3.6, 1.4, 1.2, 'w').eye(2, -3.4, 0.7);
    return B.done();
  },
  yeti: (t) => {
    const B = new Build();
    const kw = Math.sin(t * 4) * 0.6;
    B.cap(-2, 3, -2.6, 7.2, 1.4, 1.3, 'l', 0.6).cap(1, 3.4, 0.6, 7.2, 1.4, 1.3, 'l', 0.6);
    B.chain([[3, -2.2], [6, 2 + kw], [6.4, 6.4]], 1.8, 1.6, 'l', 1).c(6.6, 6.4, 1.9, 'l', 0.6);
    B.e(-0.4, 0, 6.4, 5.2, 'l', 0.2, 1.4);
    B.c(3.6, -5, 2.8, 'l', 1.2);
    spikes(B, [[2.4, -7.4, 2], [4.2, -7.6, 1.6]]);
    B.de(4.6, -4.6, 1.8, 1.6, 0x6a8aa8).dl(3.6, -5.8, 5.8, -5.8, 0.35, 'd').eye(5, -5, 0.6).dl(4.4, -3.6, 5.6, -3.6, 0.25, 'k');
    return B.done();
  },
  // ================================================================== VOLT
  hound: (t) => {
    const B = new Build();
    const st = Math.sin(t * 9) * 1;
    for (const [u, p] of [[-4.4, st], [-3, -st], [2.4, -st], [3.8, st]] as const) B.cap(u, 2, u + p, 7.4, 0.6, 0.5, 'd', 0.5);
    B.e(-0.6, 0.4, 5.6, 3, 'b', -0.1, 1.2);
    B.e(5, -2.4, 2.6, 2.2, 'b', 0, 1.2);
    B.cap(6.6, -1.8, 9, -1.2, 1, 0.8, 'b', 0.6);
    B.tri(3.8, -4, 5.4, -4.4, 4, -7.4, 'b', 0.5);
    B.chain([[-5.6, -0.6], [-7.4, -3], [-6.6, -4.4], [-8.4, -6]], 0.7, 0.4, 'l', 0.6);
    B.dc(9.2, -1.6, 0.5, 'k').eye(5.6, -3, 0.7).dl(-4, 0, 2, -1.2, 0.3, 'l');
    return B.done();
  },
  spider: (t) => {
    const B = new Build();
    const METAL = 0x5a5e68;
    for (let i = 0; i < 4; i++) {
      const st = Math.sin(t * 8 + i * 1.6) * 0.8;
      for (const k of [-1, 1]) {
        const knee = k * (5 + i * 1.2);
        const foot = k * (7 + i * 1.5);
        B.cap(k * (1.5 + i * 0.6), 0, knee, -3 + i * 0.4 - st * k, 0.45, 0.4, METAL, 0.4).cap(knee, -3 + i * 0.4 - st * k, foot, 7.2, 0.4, 0.3, METAL, 0.2);
      }
    }
    B.c(-2.2, -0.4, 4.4, 'b', 1).c(3.4, 0.4, 2.8, 0x3a3e48, 1);
    for (const [u, v] of [[-4.5, -1.5], [-2, -3.8], [0.4, -1.4], [-2, 2]] as const) B.dc(u, v, 0.45, 0xc8ccd4);
    for (const [u, v] of [[4.4, -0.4], [5.4, 0.6], [4.2, 1.4]] as const) B.glow(u, v, 0.55, 0xff3a3a);
    return B.done();
  },
  gecko: (t) => {
    const B = new Build();
    const sw = Math.sin(t * 5);
    for (const [x, y, k] of [[-3, 4, -1], [3, 4, 1]] as const) {
      B.cap(x, y, x + k * 1.6, 2.4 + 4.4, 0.55, 0.45, 'b', 0.4).c(x + k * 1.6, 6.8, 0.8, 'l', 0.3);
      B.cap(x - 1, y, x - 1 - k * 1, 6.8, 0.5, 0.4, 'b', 0.4).c(x - 1 - k * 1, 6.9, 0.7, 'l', 0.3);
    }
    B.chain([[-5, 4.2], [-8.4, 3.6 + sw * 0.8], [-10.4, 1.4 + sw], [-9.2, 0 + sw]], 1.4, 0.35, 'b', 1);
    B.e(0, 4, 6, 2, 'b', 0, 1);
    B.e(6, 3.4, 2.6, 1.8, 'b', 0, 1);
    spikes(B, [[-3, 2.4, 1.4], [-1, 2.2, 1.8], [1, 2.4, 1.4]], 'l');
    B.dc(-2, 4.6, 0.5, 'l').dc(1.6, 4.4, 0.5, 'l').eye(6.6, 2.6, 0.9);
    return B.done();
  },
  ferret: (t) => {
    const B = new Build();
    const st = Math.sin(t * 10) * 0.6;
    for (const [u, p] of [[-4, st], [-2.6, -st], [2.6, -st], [4, st]] as const) B.cap(u, 4, u + p, 7.2, 0.6, 0.5, 'd', 0.4);
    B.cap(-4.6, 3.6, 3.6, 3, 2.2, 2.4, 'b', 1);
    B.e(6, 2, 2.5, 1.9, 'b', 0, 1.2);
    B.c(4.8, 0, 0.8, 'b', 0.5).c(6.6, -0.2, 0.8, 'b', 0.5);
    B.chain([[-6, 3.4], [-8.4, 2 + Math.sin(t * 6) * 0.6], [-10.4, -0.4 + Math.sin(t * 6)]], 1.3, 0.8, 'b', 0.8).c(-10.6, -0.8 + Math.sin(t * 6), 1, 'l', 0.4);
    B.de(6.2, 1.6, 2, 0.6, 'k').de(6.8, 2.8, 1.4, 0.8, 'w').dc(8.4, 2.2, 0.4, 'k').eye(6.9, 1.6, 0.6, 0xfff4a0);
    return B.done();
  },
  rhino: (t) => {
    const B = new Build();
    const st = Math.sin(t * 5) * 0.6;
    for (const [u, p] of [[-5, st], [-2.6, -st], [2.4, st], [4.4, -st]] as const) B.cap(u, 3, u + p * 0.3, 7.2, 1.3, 1.3, 'd', 0.5);
    B.e(-1, 1, 7.6, 5, 'b', 0, 1.4);
    B.e(6, 1.6, 3.6, 2.8, 'b', 0.2, 1.4);
    B.tri(7.6, -0.4, 9.4, 0.6, 9.8, -4.6, 'l', 0.4).tri(5.6, -0.8, 6.8, -0.6, 6.4, -2.8, 'l', 0.3);
    B.tri(3.4, -1.2, 4.6, -1.6, 3.6, -3.4, 'b', 0.4);
    B.dl(-4, -3, -4.6, 4, 0.3, 'd').dl(0.5, -3.6, 0.2, 4.6, 0.3, 'd').dl(4, -1.2, 4, 3.6, 0.3, 'd');
    B.dl(-6, -1, 3, -2, 0.35, 'l').eye(6.6, 0.6, 0.6);
    return B.done();
  },
  eel: (t) => {
    const B = new Build();
    const pts: [number, number][] = [];
    for (let i = 0; i <= 6; i++) pts.push([7 - i * 2.8, -1 + Math.sin(t * 4 - i * 0.9) * 1.8 + i * 0.3]);
    B.chain(pts, 2.2, 0.5, 'b', 1);
    for (let i = 1; i < 5; i++) B.tri(pts[i][0] - 1, pts[i][1] - 0.8, pts[i][0] + 1, pts[i][1] - 0.8, pts[i][0], pts[i][1] - 3.2, 'l', 0.8);
    B.e(7.6, -1, 2.6, 1.8, 'b', 0, 0.8);
    for (let i = 1; i < 6; i++) B.glow(pts[i][0], pts[i][1] + 0.4, 0.45, 0xfff4a0);
    B.dl(8, 0, 9.8, -0.2, 0.25, 'k').eye(8, -1.6, 0.7);
    return B.done();
  },
  // ================================================================= STONE
  beetle: (t) => {
    const B = new Build();
    for (let i = 0; i < 3; i++) for (const k of [-1, 1]) B.cap(-3 + i * 3, 3, -3 + i * 3 + k * 1.6 + Math.sin(t * 10 + i) * 0.4, 7.4, 0.4, 0.35, 'd', 0.3);
    B.e(-1, 0.4, 6.6, 4.8, 'b', 0, 1.2);
    B.e(5, 1.4, 2.4, 2.2, 'd', 0, 1);
    B.chain([[6.2, 0.2], [8.2, -1.6], [9, -4.4]], 0.9, 0.25, 'l', 0.5);
    B.dl(-1, -4.2, -1, 4.6, 0.25, 'd').de(-3.4, -1.4, 1.8, 1, 'l').eye(5.6, 0.8, 0.6);
    return B.done();
  },
  roller: (t) => {
    const B = new Build();
    const roll = (t * 3) % 1;
    B.cap(-5, 4, -5, 7.2, 0.8, 0.7, 'd', 0.3).cap(3, 4, 3, 7.2, 0.8, 0.7, 'd', 0.3);
    B.e(0, 4, 7.4, 6.6, 'b', 0, 1);
    B.cutBox(0, 8, 18, 8);
    B.tri(6, 1, 6.6, 4, 10.6, 3.2, 'l', 0.6).tri(6.2, 1.2, 7.4, 0.6, 6.6, -2.4, 'l', 0.4);
    for (let i = 0; i < 5; i++) {
      const u = -5.6 + (i + roll) * 2.6;
      if (Math.abs(u) < 6.4) B.dl(u, -2.4 + Math.abs(u) * 0.3, u, 3.8, 0.3, 'd');
    }
    B.eye(7.4, 2.2, 0.6);
    return B.done();
  },
  tortoise: (t) => {
    const B = new Build();
    const st = Math.sin(t * 3) * 0.4;
    const SKIN = 0x8a7a5a;
    for (const [u, p] of [[-4.6, st], [-1.6, -st], [1.8, st], [4.6, -st]] as const) B.e(u + p, 6.2, 1.5, 1.4, SKIN, 0, 0.5);
    B.cap(4.8, 2.4, 7.6, 1, 1.3, 1.2, SKIN, 0.8).c(8, 0.6, 1.9, SKIN, 0.6);
    B.e(0, 3.6, 7.6, 1.8, 'd', 0, 0.8);
    B.e(0, 0.6, 6.8, 5, 'b', 0, 1);
    for (const [x, y] of [[-3, -3.4], [0.4, -4.4], [3.2, -3]] as const) B.box(x, y, 2.2, 1.8, 0.4, 'l', 0.3, 0.6);
    for (const [x, y] of [[-3.6, 0], [0, -1], [3.4, 0.2], [-1.6, 2], [1.8, 2]] as const) B.de(x, y, 1.4, 1, 'd').de(x, y, 1, 0.65, 'b');
    B.eye(8.6, 0.2, 0.55);
    return B.done();
  },
  obelisk: (t) => {
    const B = new Build();
    const hv = Math.sin(t * 2) * 0.5;
    B.box(0, 6, 9, 3, 0.6, 'd', 0, 0.6);
    B.tri(-3.6, 5, 3.6, 5, 0, -10.4, 'b', 1.2, 0.8);
    B.chain([[-2.6, -2], [-5.6, 0.6 + hv], [-6.4, 2.4 + hv]], 1.1, 1.1, 'b', 0.8).c(-6.6, 3 + hv, 1.8, 'b', 0.6);
    B.chain([[2.6, -2], [5.6, 0.6 - hv], [6.4, 2.4 - hv]], 1.1, 1.1, 'b', 0.8).c(6.6, 3 - hv, 1.8, 'b', 0.6);
    const glow = Math.sin(t * 3) > 0 ? 0x9affd0 : 0x6ad8a8;
    B.dl(-0.8, -1, 0.8, -1, 0.25, glow).dl(0, -2, 0, 2.6, 0.25, glow).dl(-1.2, 1.6, 1.2, 0.6, 0.25, glow);
    B.de(0, -5.6, 1.2, 0.5, glow);
    return B.done();
  },
  hedgehog: (t) => {
    const B = new Build();
    const st = Math.sin(t * 8) * 0.4;
    const CRYS = 0xc8a0ff;
    for (const u of [-3, 2.6]) B.cap(u, 5, u + st, 7.2, 0.6, 0.5, 0x6a5040, 0.4);
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (1.08 + i * 0.12);
      B.tri(Math.cos(a - 0.12) * 5 - 1, 2 + Math.sin(a - 0.12) * 4, Math.cos(a + 0.12) * 5 - 1, 2 + Math.sin(a + 0.12) * 4, Math.cos(a) * 8.6 - 1, 2 + Math.sin(a) * 7.4, i % 2 ? CRYS : 'l', 0.4);
    }
    B.e(-0.6, 2.4, 6, 4, 'b', 0, 1.2);
    B.e(5.2, 3.2, 2.4, 1.8, 0xd8b090, 0, 1);
    B.dc(7.4, 3, 0.55, 'k').eye(5.4, 2.4, 0.6);
    return B.done();
  },
  // ================================================================== GALE
  moth: (t) => {
    const B = new Build();
    const fl = Math.sin(t * 12) * 0.35;
    for (const k of [-1, 1]) {
      B.e(k * 3.6, -3, 3.2, 2.6 + fl * 1.4, 'l', k * 0.4, 0.8);
      B.e(k * 3, 2, 2.4, 2 + fl, 'l', -k * 0.4, 0.8);
    }
    B.cap(0, -3, 0, 4, 1.3, 1, 'd', 0.8).c(0, -4.4, 1.5, 'd', 0.6);
    for (const k of [-1, 1]) B.chain([[k * 0.6, -5.4], [k * 1.6, -7.4], [k * 3, -8.4]], 0.3, 0.2, 'd', 0.3);
    for (const k of [-1, 1]) B.dc(k * 4, -3, 1, 'd').dc(k * 4, -3, 0.5, 'w');
    B.eye(-0.6, -4.6, 0.55).eye(0.7, -4.6, 0.55);
    return B.done();
  },
  mantis: (t) => {
    const B = new Build();
    const tw = Math.sin(t * 6) * 0.8;
    B.cap(-1, 1, -3, 7.4, 0.45, 0.35, 'd', 0.3).cap(0.5, 1, 1.5, 7.4, 0.45, 0.35, 'd', 0.3);
    B.e(-4.2, 0.4, 4.2, 1.6, 'b', -0.15, 0.8);
    B.cap(0, 1.4, 0.4, -5, 1, 0.8, 'b', 0.8);
    B.tri(-1.4, -5.8, 3.4, -6.4, 1.2, -3.2, 'b', 0.6);
    for (const k of [0, 1]) {
      const v = -3.5 + k * 1.5;
      B.cap(0.6, v, 3.8, v - 2 + tw, 0.45, 0.4, 'd', 0.4).cap(3.8, v - 2 + tw, 5.6, v + 1.5 + tw, 0.4, 0.15, 'l', 0.2);
    }
    for (const k of [0.5, 1.6]) B.cap(k, -6.4, k * 2 - 1.5, -9.4, 0.2, 0.15, 'd', 0.2);
    B.glow(-0.6, -6.2, 0.9, 'l').eye(2.4, -6.2, 0.8);
    return B.done();
  },
  hare: (t) => {
    const B = new Build();
    const hop = Math.max(0, Math.sin(t * 6)) * 1.6;
    const y = -hop;
    B.e(-2.4, 5.6 + y, 3, 1.5, 'd', 0, 0.8);
    B.cap(3, 4 + y, 3.4, 7.2 + y, 0.5, 0.45, 'b', 0.4);
    B.e(-1, 2 + y, 4.6, 3.4, 'b', -0.2, 1.2);
    B.e(3.6, -1.6 + y, 2.4, 2.2, 'b', 0, 1.2);
    B.e(2.6, -6.6 + y, 0.95, 3.4, 'b', -0.25, 0.8).e(4.4, -6.4 + y, 0.95, 3.4, 'b', 0.15, 0.8);
    B.c(-5.6, 1.4 + y, 1.5, 'w', 0.6);
    B.de(2.6, -6.6 + y, 0.4, 2.4, PINK, -0.25).de(4.4, -6.4 + y, 0.4, 2.4, PINK, 0.15).dc(5.8, -1.2 + y, 0.4, PINK).eye(4.2, -2.2 + y, 0.7);
    return B.done();
  },
  fox: (t) => {
    const B = new Build();
    const st = Math.sin(t * 8) * 0.8;
    for (const [u, p] of [[-3.6, st], [-2.4, -st], [2, -st], [3.2, st]] as const) B.cap(u, 2.6, u + p, 7.4, 0.5, 0.4, 'd', 0.4);
    B.e(-6, -1, 3.4, 1.8, 'b', -0.6, 1).c(-8.6, -3, 1.2, 'w', 0.5);
    B.e(-0.6, 1, 5, 2.8, 'b', 0, 1.2);
    B.e(4.4, -1.6, 2.4, 2, 'b', 0, 1.2);
    B.tri(5.8, -2, 5.8, -0.2, 8.6, -0.6, 'b', 0.6);
    B.tri(2.6, -3, 4.4, -3.6, 2, -10.2 + Math.sin(t * 3) * 0.4, 'b', 0.5).tri(4.4, -3.4, 6, -3, 6.2, -9.6 + Math.sin(t * 3 + 1) * 0.4, 'b', 0.5);
    B.dt(2.8, -4, 3.9, -4.3, 2.5, -8.6, 'l').dt(4.9, -4, 5.6, -3.8, 5.8, -8.2, 'l').de(0, 2.4, 3, 1, 'w').dc(8.4, -0.6, 0.4, 'k').eye(4.8, -2.2, 0.65);
    return B.done();
  },
  falcon: (t) => {
    const B = new Build();
    const fl = Math.sin(t * 9) * 2;
    const b = Math.sin(t * 4) * 0.6;
    B.tri(-1, -2 + b, -10, -8 + fl + b, -3, 2 + b, 'b', 1).tri(1, -2 + b, 10, -8 + fl + b, 3, 2 + b, 'b', 1);
    B.tri(-1.6, 3.8 + b, 1.6, 3.8 + b, 0, 8 + b, 'd', 0.6);
    for (const k of [-1, 1]) B.cap(k * 1, 3 + b, k * 1.4, 6.4 + b, 0.35, 0.3, BEAK, 0.3);
    B.e(0, 0 + b, 3.4, 4.4, 'b', 0, 1.2);
    B.c(1.4, -4.4 + b, 2.2, 'b', 1);
    B.tri(3.2, -4.8 + b, 3.2, -3.4 + b, 5.4, -3.6 + b, BEAK, 0.3);
    for (const k of [-1, 1]) for (let i = 0; i < 3; i++) B.dl(k * (5 + i * 1.6), -5 + i * 0.6 + fl * 0.6 + b, k * (4.4 + i * 1.6), -2.6 + i * 0.6 + b, 0.25, 'd');
    B.de(0.4, 1 + b, 2.2, 2.8, 'l').dl(2.2, -4.2 + b, 2, -2.2 + b, 0.35, 'k').eye(2.2, -4.8 + b, 0.65);
    return B.done();
  },
  // ================================================================== MURK
  serpent: (t) => {
    const B = new Build();
    const w = Math.sin(t * 5);
    B.chain([[-7.4, 5], [-4.4, 5.6 + w * 0.4], [-1.4, 4.8], [1.4, 3.4 - w * 0.4], [3.6, 0.4], [4.8, -2.4]], 1.2, 2, 'b', 1);
    B.e(5.8, -3.2, 2.4, 1.7, 'b', 0, 0.8);
    B.e(4.6, -2, 2, 2.6, 'd', 0, 0.8);
    B.cap(8, -2.8, 9.8, -2.4 + w * 0.3, 0.2, 0.2, 0xe04a5a, 0.2);
    for (let i = 0; i < 4; i++) B.dc(-6 + i * 2.6, 5 + (i % 2 ? 0.6 : -0.2), 0.6, 'l');
    B.eye(6.4, -3.8, 0.65, 0xffd060);
    return B.done();
  },
  bat: (t) => {
    const B = new Build();
    const fl = Math.sin(t * 12);
    for (const k of [-1, 1]) {
      const tip = -6 + fl * 4;
      B.tri(k * 1.5, -1, k * 10, tip, k * 8, 3 + fl, 'd', 0.8).tri(k * 1.5, -1, k * 8, 3 + fl, k * 3, 3, 'd', 0.6);
    }
    B.e(0, 0, 2.6, 3.2, 'b', 0, 1);
    B.tri(-2, -2.4, -0.6, -2.4, -1.8, -6, 'b', 0.5).tri(2, -2.4, 0.6, -2.4, 1.8, -6, 'b', 0.5);
    for (const k of [-1, 1]) B.dl(k * 1.6, -1, k * 9.4, -6 + fl * 4, 0.2, 'l').dl(k * 1.6, -1, k * 6, 2 + fl, 0.2, 'l');
    B.dt(-0.4, 0.6, 0.1, 0.6, -0.15, 1.6, 0xffffff).glow(-0.9, -1.2, 0.6, 0xff4a8a).glow(0.9, -1.2, 0.6, 0xff4a8a);
    return B.done();
  },
  shroom: (t) => {
    const B = new Build();
    const sh = Math.sin(t * 3) * 0.3;
    const STEM = 0xd8c8b0;
    // the cap, flattened underneath, then the stem grown up into it
    B.e(0, -3 + sh, 7.4, 3.8, 'b', 0, 1.2);
    B.cutBox(0, 1.8 + sh, 20, 3);
    B.e(0, -0.4 + sh, 6.2, 1, 'd', 0, 0.4);
    B.box(0, 2.6, 4.6, 8.4, 1.8, STEM, sh * 0.1, 1);
    B.e(-2, 7, 1.4, 0.8, STEM, 0, 0.6).e(2, 7, 1.4, 0.8, STEM, 0, 0.6);
    for (const [x, y, r] of [[-3.6, -4, 1.1], [0, -5.4, 1.2], [3.6, -3.6, 1], [-1.6, -2, 0.7], [2, -1.8, 0.6]] as const) B.dc(x, y + sh, r, 'l');
    B.eye(-1, 2.6, 0.75, 0x9a4ad8).eye(1.4, 2.6, 0.75, 0x9a4ad8).dl(-0.6, 4.4, 0.8, 4.4, 0.25, 0x6a5a4a);
    return B.done();
  },
  crow: (t) => {
    const B = new Build();
    const hop = Math.max(0, Math.sin(t * 5)) * 0.8;
    B.cap(-0.6, 4 - hop, -1, 7.4, 0.3, 0.25, 0x3a3a40, 0.3).cap(1, 4 - hop, 1.4, 7.4, 0.3, 0.25, 0x3a3a40, 0.3);
    B.tri(-3.6, 1 - hop, -3.6, 3 - hop, -8.6, 3.4 - hop, 'k', 0.8).tri(-3.6, 2 - hop, -8, 1.2 - hop, -8.4, 4.6 - hop, 'k', 0.6);
    B.e(-0.4, 1 - hop, 4, 3.4, 'k', -0.2, 1.2);
    B.c(3, -2.6 - hop, 2.2, 'k', 1);
    B.cap(4.6, -2.6 - hop, 7.8, -2 - hop, 0.75, 0.2, 0x5a5a64, 0.4);
    B.de(-1, 0.8 - hop, 2.8, 1.8, 0x3a2a4a, -0.2).dl(-2.4, 1.8 - hop, 1, 2.6 - hop, 0.25, 0x4a3a5a).glow(3.6, -3.2 - hop, 0.7, 'l');
    return B.done();
  },
  lynx: (t) => {
    const B = new Build();
    const st = Math.sin(t * 7) * 0.7;
    for (const [u, p] of [[-4.2, st], [-2.6, -st], [2.4, -st], [3.8, st]] as const) B.cap(u, 2.8, u + p, 7.4, 0.7, 0.6, 'b', 0.5);
    B.cap(-5.6, 0.4, -7.4, -0.6, 1, 0.9, 'b', 0.6);
    B.e(-0.8, 1.4, 5.6, 3, 'b', 0, 1.2);
    B.e(4.6, -1.2, 2.6, 2.3, 'b', 0, 1.2);
    B.tri(3, -2.8, 4.4, -3.4, 3.2, -6.4, 'b', 0.4).tri(5, -3.2, 6.4, -2.8, 6, -6.2, 'b', 0.4);
    B.cap(3.2, -6.4, 3.4, -8, 0.2, 0.15, 'k', 0.2).cap(6, -6.2, 6.3, -7.8, 0.2, 0.15, 'k', 0.2);
    B.tri(2.6, 0, 3.4, -1, 1.6, 1.4, 'l', 0.4);
    for (const [x, y] of [[-3.6, 0.4], [-1.4, 1.6], [0.8, 0.2], [-2.4, 2.8]] as const) B.dc(x, y, 0.5, 'd');
    B.dc(7, -0.8, 0.4, PINK).glow(5.2, -1.8, 0.65, 0xc0ff60);
    return B.done();
  },
  wraith: (t) => {
    const B = new Build();
    const sw = Math.sin(t * 2) * 0.8;
    B.e(0, 6.6, 7, 1.6, 0x2a3a2a, 0, 0.5);
    B.cap(0, 6, 0.4 + sw * 0.3, -2.6, 3.2, 2.2, 'b', 1.2);
    B.c(0.6 + sw * 0.3, -5.2, 2.6, 'b', 1);
    B.chain([[2, -2], [5.6, 0 + sw], [7.4, 2.6 + sw]], 0.7, 0.5, 'b', 0.8);
    B.chain([[-1.6, -1.6], [-4.6, 0.6 - sw], [-6, 3 - sw]], 0.7, 0.5, 'b', 0.8);
    for (const k of [-1.4, 0, 1.4, 2.6]) B.chain([[k + sw * 0.3, -6.6], [k - 0.8 + sw * 0.3, -3.4], [k - 1.4 + Math.sin(t * 3 + k) * 0.6, 0]], 0.45, 0.2, 0x3a6a3a, 0.4);
    B.glow(-0.2 + sw * 0.3, -5.4, 0.7, 0xc0ffd0).glow(1.8 + sw * 0.3, -5.4, 0.7, 0xc0ffd0).de(0.8 + sw * 0.3, -3.6, 1, 0.5, 'k');
    return B.done();
  },
  // ================================================================== GLOW
  owl: (t) => {
    const B = new Build();
    const bl = Math.sin(t * 1.3) > 0.97;
    B.e(-1.6, 7, 1, 0.7, BEAK).e(1.6, 7, 1, 0.7, BEAK);
    B.e(-4.6, 1, 1.6, 4, 'd', 0.2, 1).e(4.6, 1, 1.6, 4, 'd', -0.2, 1);
    B.e(0, 0.4, 5, 6.2, 'b', 0, 1.2);
    B.tri(-3.6, -4.6, -1.8, -5, -3.6, -8, 'b', 0.5).tri(3.6, -4.6, 1.8, -5, 3.6, -8, 'b', 0.5);
    B.de(0, -2.4, 4, 3, 'l').dt(-0.6, -1.2, 0.6, -1.2, 0, 0.6, BEAK).de(0, 2.6, 2.6, 2.8, 'l');
    if (bl) B.dl(-2.6, -2.8, -0.8, -2.8, 0.3, 'k').dl(0.8, -2.8, 2.6, -2.8, 0.3, 'k');
    else B.eye(-1.7, -2.8, 1.2, 0xffa020).eye(1.7, -2.8, 1.2, 0xffa020);
    return B.done();
  },
  centipede: (t) => {
    const B = new Build();
    const n = 8;
    for (let i = n - 1; i >= 0; i--) {
      const u = -8 + i * 2;
      const v = 3 + Math.sin(t * 6 - i * 0.8);
      const lg = Math.sin(t * 14 - i) * 0.7;
      B.cap(u, v, u - 0.6 + lg, v + 3.6, 0.25, 0.2, 'd', 0.2).cap(u, v, u + 0.6 - lg, v + 3.6, 0.25, 0.2, 'd', 0.2);
      B.c(u, v, 1.7, i % 2 ? 'd' : 'b', 0.6);
    }
    const hv = 3 + Math.sin(t * 6 - 6.4);
    B.c(8.4, hv - 0.3, 2.2, 'b', 0.8);
    B.cap(9.2, hv - 2, 11.4, hv - 5 + Math.sin(t * 5), 0.25, 0.2, 'd', 0.3).cap(8.2, hv - 2.2, 9.4, hv - 5.6 + Math.sin(t * 5 + 1), 0.25, 0.2, 'd', 0.3);
    B.tri(10.2, hv, 11.8, hv + 0.6, 10.2, hv + 1.4, 'd', 0.3);
    for (let i = 0; i < n; i += 2) B.glow(-8 + i * 2, 2.4 + Math.sin(t * 6 - i * 0.8), 0.5, 0xffffff);
    B.eye(9, hv - 0.8, 0.6);
    return B.done();
  },
  angler: (t) => {
    const B = new Build();
    const sw = Math.sin(t * 2.5);
    B.tri(-5.4, 0, -9, -3 + sw, -9, 3 + sw, 'd', 0.8);
    B.tri(-1, -4, 2, -4.4, -3, -6.4, 'd', 0.6).tri(0, 4, 2, 4, -1.6, 6.4, 'd', 0.6);
    B.e(0, 0, 6, 4.6, 'b', 0, 1.2);
    B.cutTri(6.4, -1.4, 6.4, 3.4, 2.6, 1);
    B.chain([[2.4, -4], [4.6, -7.4], [7, -7.6 + sw * 0.4]], 0.35, 0.25, 'd', 0.4).c(7.6, -7.2 + sw * 0.4, 1.4, 0xfff4a0, 0.3);
    for (let i = 0; i < 4; i++) B.dt(5.6 - i * 0.9, -1.1 + i * 0.5, 4.9 - i * 0.9, -0.9 + i * 0.5, 5.4 - i * 0.9, 0.4 + i * 0.5, 0xffffff);
    B.dc(-2, -1.4, 0.5, 'l').dc(-3.4, 1, 0.5, 'l').eye(2.8, -2, 0.7);
    return B.done();
  },
  firefly: (t) => {
    const B = new Build();
    const b = Math.sin(t * 3) * 0.8;
    const fl = Math.sin(t * 20) * 0.6;
    for (const k of [-1, 1]) B.e(k * 0.8, -4 + b, 1.4, 2.8 + fl, 0xe8f8ff, k * 0.6, 0.4);
    for (const k of [-1, 0, 1]) B.cap(1 + k * 1.2, 1 + b, 1.4 + k * 1.6, 4.4 + b, 0.25, 0.2, 'k', 0.2);
    B.e(-3.4, 0.6 + b, 3.6, 2.4, 0xfff4a0, 0.15, 1);
    B.e(1, -0.6 + b, 2.2, 2, 'd', 0, 1);
    B.c(3.6, -1.6 + b, 1.5, 'k', 0.8);
    B.cap(4.2, -2.8 + b, 5.8, -5 + b, 0.2, 0.15, 'k', 0.2).cap(3.6, -3 + b, 4.2, -5.6 + b, 0.2, 0.15, 'k', 0.2);
    B.dc(-3.6, 0.6 + b, 2 + Math.sin(t * 5) * 0.3, 0xffffff).eye(4, -2, 0.55);
    return B.done();
  },
  snail: (t) => {
    const B = new Build();
    const st = Math.sin(t * 2) * 0.4;
    const FOOT = 0xd8c8a0;
    B.cap(-6.6, 5.4, 7, 5.4, 1.5, 1.2, FOOT, 0.6);
    B.cap(5.4, 5, 6.8, 1, 1.3, 1.1, FOOT, 0.8);
    for (const k of [0, 1]) B.cap(6.2 + k, 0.6, 6.8 + k * 1.6 + st, -2.6, 0.3, 0.25, FOOT, 0.3).c(6.8 + k * 1.6 + st, -2.8, 0.75, FOOT, 0.2);
    B.c(-1, -0.4, 4.8, 'b', 1);
    for (const r of [3.6, 2.2, 0.9]) B.decals.push({ s: { t: 'ring', x: -1 + (3.6 - r) * 0.3, y: -0.4, r, th: 0.3 }, col: 'd' });
    for (const [x, y] of [[-3.4, -3.2], [1.6, -3], [-3.6, 1.6]] as const) B.dc(x, y, 0.45 + Math.max(0, Math.sin(t * 4 + x)) * 0.3, 0xffffff);
    B.dc(7.1 + st, -2.8, 0.4, 'k').dc(8.6 + st, -2.8, 0.4, 'k');
    return B.done();
  },

  // ============================================ THE TWENTY NEW ONES (28 Oct)
  salamander: (t) => {
    const B = new Build();
    const st = Math.sin(t * 9) * 0.5;
    for (const [u, p] of [[-4, st], [-1.5, -st], [2.5, st], [4.8, -st]] as const) B.cap(u, 4.4, u + p, 7.3, 0.45, 0.35, 'd', 0.3);
    B.chain([[-4, 4.2], [-7, 4.6], [-9.5, 3.6 + Math.sin(t * 4)]], 1.2, 0.4, 'b', 0.7);
    B.e(0, 3.8, 5.4, 2.1, 'b', 0, 1);
    B.e(5.6, 3.2, 2.6, 1.9, 'b', 0, 0.9);
    flames(B, -1, 1.8, 3, t, 2.6);
    for (let i = 0; i < 4; i++) B.dc(-3 + i * 2, 3.4, 0.45, FLAME2);
    B.eye(6.2, 2.2, 0.7);
    return B.done();
  },
  chick: (t) => {
    const B = new Build();
    const hop = Math.abs(Math.sin(t * 5)) * 0.8;
    B.cap(-1, 4.6 - hop, -1.2, 7.5, 0.35, 0.3, BEAK, 0.3).cap(1.2, 4.6 - hop, 1.4, 7.5, 0.35, 0.3, BEAK, 0.3);
    B.c(0, 1.6 - hop, 4.4, 'b', 1);
    B.e(-3.6, 1.4 - hop, 1.6, 2.6 + Math.sin(t * 12) * 0.6, 'd', 0.4, 0.8);
    B.tri(3.6, 0.6 - hop, 3.6, 2 - hop, 6, 1.3 - hop, BEAK, 0.4);
    flames(B, 0, -2.4 - hop, 3, t, 3);
    B.dc(0, 2.4 - hop, 2, 'l').eye(1.8, 0.2 - hop, 0.85);
    return B.done();
  },
  otter: (t) => {
    const B = new Build();
    const st = Math.sin(t * 8) * 0.5;
    for (const [u, p] of [[-3.5, st], [-1.5, -st], [2.5, st], [4.2, -st]] as const) B.cap(u, 4.6, u + p, 7.4, 0.6, 0.5, 'd', 0.3);
    B.chain([[-4.6, 3.6], [-7.6, 4.8], [-10, 4.2 + Math.sin(t * 3) * 0.6]], 1.4, 0.7, 'b', 0.7);
    B.e(0, 3, 5.6, 2.8, 'b', -0.1, 1);
    B.c(5.6, 1, 2.4, 'b', 0.9);
    B.c(4.8, -0.9, 0.7, 'd', 0.4);
    B.de(0.6, 4, 3.6, 1.2, 'l').de(6.6, 1.8, 1.4, 0.9, 'l');
    B.dc(7.8, 1.2, 0.45, 'k').eye(6, 0.3, 0.7);
    return B.done();
  },
  octopus: (t) => {
    const B = new Build();
    for (let i = 0; i < 6; i++) {
      const u = -5 + i * 2;
      const w = Math.sin(t * 4 + i) * 1.2;
      B.chain([[u * 0.6, 3], [u, 5.4], [u + w, 7.4]], 0.9, 0.4, 'b', 0.7);
    }
    B.e(0, -1.4, 4.6, 5, 'b', 0, 1.2);
    for (let i = 0; i < 5; i++) B.dc(-2.4 + i * 1.2, -3.8 + (i % 2), 0.45, 'l');
    B.eye(-1.6, 0.6, 1).eye(1.8, 0.6, 1);
    return B.done();
  },
  badger: (t) => {
    const B = new Build();
    const st = Math.sin(t * 5) * 0.4;
    for (const [u, p] of [[-4, st], [-1.6, -st], [2.4, st], [4.6, -st]] as const) B.cap(u, 4, u + p, 7.4, 0.9, 0.75, 'd', 0.4);
    B.e(-0.6, 2.2, 6.8, 3.6, 'b', 0, 1.2);
    B.e(5.4, 2.6, 3, 2.4, 'b', 0, 1);
    B.tri(5, 1, 9, 2.6, 5.4, 4, 'l', 0.4);
    B.dl(3.6, 0.8, 8.4, 2.4, 0.5, 'k');
    for (let i = 0; i < 4; i++) B.dc(-4 + i * 2.2, -0.6, 0.6, 'l');
    B.dc(8.8, 2.6, 0.5, 'k').eye(6.2, 1.6, 0.6);
    return B.done();
  },
  caterpillar: (t) => {
    const B = new Build();
    for (let i = 0; i < 6; i++) {
      const u = -6 + i * 2.2;
      const v = 4.4 - Math.max(0, Math.sin(t * 3 - i * 0.6)) * 1.6;
      B.c(u, v, 1.9, i % 2 ? 'b' : 'l', 0.9);
      B.cap(u, v + 1.4, u, 7.4, 0.3, 0.25, 'd', 0.3);
    }
    B.c(7, 2.8 - Math.max(0, Math.sin(t * 3 - 3.6)) * 1.6, 2.4, 'b', 0.9);
    B.cap(6.4, 0.8, 5.6, -1.6, 0.25, 0.2, 'd', 0.3).cap(7.8, 0.8, 8.4, -1.6, 0.25, 0.2, 'd', 0.3);
    B.eye(7.8, 2.4, 0.7);
    return B.done();
  },
  walrus: (t) => {
    const B = new Build();
    const br = Math.sin(t * 2) * 0.4;
    B.e(-5.4, 6.6, 2.6, 1, 'd').e(3.8, 6.8, 2.2, 0.9, 'd');
    B.e(-1, 2.4 + br, 7.6, 5, 'b', 0, 1.3);
    B.c(5, 0.2 + br, 3.6, 'b', 1);
    B.e(6.6, 1.8 + br, 2, 1.4, 'l', 0, 0.8);
    B.tri(5.8, 2.6 + br, 6.6, 2.6 + br, 6.4, 7, IVORY, 0.2).tri(7, 2.6 + br, 7.8, 2.6 + br, 7.6, 6.8, IVORY, 0.2);
    spikes(B, [[-3, -2.4 + br, 2], [-0.5, -2.6 + br, 2.4], [2, -2.4 + br, 2]]);
    B.eye(5.4, -1 + br, 0.7);
    return B.done();
  },
  ermine: (t) => {
    const B = new Build();
    const w = Math.sin(t * 6) * 0.6;
    B.cap(-3.6, 4.6, -3.8 + w, 7.4, 0.5, 0.4, 'd', 0.3).cap(2.6, 4.6, 2.8 - w, 7.4, 0.5, 0.4, 'd', 0.3);
    B.chain([[-6.5, 3.8], [-3, 3.6], [1, 3.2], [3.6, 1.6]], 1.7, 1.5, 'b', 1);
    B.c(5.2, 0.4, 2.2, 'b', 0.9);
    B.c(4.6, -1.6, 0.7, 'b', 0.4);
    B.chain([[-6.4, 3.4], [-9, 2.4 + w], [-10.4, 1 + w]], 0.9, 0.5, 'l', 0.6);
    B.dc(-10.4, 1 + w, 0.9, 'k');
    B.dc(7.2, 0.6, 0.4, 'k').eye(5.6, -0.2, 0.65);
    return B.done();
  },
  wasp: (t) => {
    const B = new Build();
    const fl = Math.sin(t * 30) * 1.2;
    const bob = Math.sin(t * 4) * 0.8;
    B.e(-1, -4 + bob + fl * 0.3, 3, 1.4, 'l', -0.5, 0.5).e(1.6, -4.2 + bob - fl * 0.3, 2.6, 1.2, 'l', 0.5, 0.5);
    B.e(-3.4, 0.6 + bob, 3.4, 2.4, 'b', 0.2, 0.8);
    B.c(1, -0.4 + bob, 1.6, 'd', 0.6);
    B.c(3.6, -1 + bob, 1.9, 'b', 0.8);
    B.tri(-6.6, 1.4 + bob, -6.4, 2.4 + bob, -8.6, 2.4 + bob, 'k', 0.3);
    for (let i = 0; i < 3; i++) B.dl(-5 + i * 1.6, -1 + bob, -5 + i * 1.6, 2.6 + bob, 0.45, 'k');
    B.eye(4.4, -1.4 + bob, 0.75);
    return B.done();
  },
  mouse: (t) => {
    const B = new Build();
    const st = Math.sin(t * 12) * 0.4;
    B.cap(-2, 5, -2 + st, 7.4, 0.4, 0.35, 'd', 0.3).cap(2, 5, 2 - st, 7.4, 0.4, 0.35, 'd', 0.3);
    B.e(0, 4, 4, 2.8, 'b', 0, 1);
    B.c(4, 2.6, 2, 'b', 0.8);
    B.c(2.8, 0.2, 1.4, 'b', 0.6).c(4.6, 0, 1.2, 'b', 0.6);
    B.chain([[-3.8, 4.6], [-6.5, 4], [-8, 1.6], [-7, -0.4 + Math.sin(t * 6)]], 0.4, 0.3, 'd', 0.4);
    B.dc(2.8, 0.2, 0.7, PINK).dc(6, 2.8, 0.4, PINK).eye(4.4, 2, 0.6);
    B.glow(-7, -0.4 + Math.sin(t * 6), 0.6, 0xfff07a);
    return B.done();
  },
  armadillo: (t) => {
    const B = new Build();
    const st = Math.sin(t * 5) * 0.4;
    B.cap(-3, 5, -3 + st, 7.4, 0.6, 0.5, 'd', 0.3).cap(2.4, 5, 2.4 - st, 7.4, 0.6, 0.5, 'd', 0.3);
    B.e(-0.6, 2.4, 6.2, 4.4, 'b', 0, 1.1);
    B.cap(5, 4, 8.2, 4.6, 1.4, 0.6, 'l', 0.6);
    B.chain([[-6.4, 4.4], [-8.6, 5.6], [-9.6, 6.6]], 0.9, 0.4, 'b', 0.5);
    for (let i = 0; i < 5; i++) B.dl(-4.6 + i * 2.2, -1.2, -4.8 + i * 2.2, 5.8, 0.4, 'd');
    B.eye(6.2, 3.2, 0.55);
    return B.done();
  },
  crocodile: (t) => {
    const B = new Build();
    const st = Math.sin(t * 6) * 0.4;
    for (const u of [-4, 2]) B.cap(u, 5.4, u + st, 7.4, 0.6, 0.5, 'd', 0.3);
    B.chain([[-4.6, 4.8], [-8, 5.2], [-11, 5 + Math.sin(t * 3) * 0.6]], 1.6, 0.4, 'b', 0.6);
    B.e(-0.6, 4.6, 5.6, 1.9, 'b', 0, 1);
    B.box(6.6, 4.6, 5.4, 1.9, 0.6, 'b', 0, 0.7);
    B.c(4.4, 3, 1.1, 'b', 0.5);
    for (let i = 0; i < 4; i++) B.tri(-4 + i * 2.2, 3, -3.2 + i * 2.2, 3, -3.6 + i * 2.2, 1.6, 'd', 0.3);
    for (let i = 0; i < 3; i++) B.dt(5.4 + i * 1.4, 5.4, 6 + i * 1.4, 5.4, 5.7 + i * 1.4, 6.2, IVORY);
    B.eye(4.5, 2.5, 0.6);
    return B.done();
  },
  parrot: (t) => {
    const B = new Build();
    const fl = Math.sin(t * 7) * 1.6;
    const bob = Math.sin(t * 3) * 0.6;
    B.cap(-0.4, 3.4 + bob, -0.6, 7.4, 0.35, 0.3, 'd', 0.3).cap(1, 3.4 + bob, 1.2, 7.4, 0.35, 0.3, 'd', 0.3);
    B.e(0, -0.4 + bob, 3, 4.2, 'b', 0.15, 1);
    B.e(-2.8, -0.6 + bob + fl * 0.4, 1.6, 3.4, 'd', 0.5 + fl * 0.1, 0.6);
    B.tri(-2, 3.2 + bob, -0.4, 3.4 + bob, -3.6, 8.4 + bob, 'l', 0.4);
    B.c(1.4, -4.4 + bob, 2.2, 'b', 0.8);
    B.tri(3, -5 + bob, 3, -3 + bob, 5, -3.2 + bob, BEAK, 0.4);
    B.dc(1.6, -3.4 + bob, 0.9, 'l').eye(1.8, -5 + bob, 0.65);
    return B.done();
  },
  dragonfly: (t) => {
    const B = new Build();
    const fl = Math.sin(t * 28) * 0.45;
    const bob = Math.sin(t * 3) * 1;
    B.e(-0.4, -1.5 + bob + fl, 4.4, 1.2, 'l', -0.3, 0.9).e(-0.8, -0.5 + bob - fl, 4.2, 1.1, 'l', 0.3, 0.9);
    B.cap(-8.6, 1.4 + bob, 0, 0.6 + bob, 0.4, 0.8, 'b', 0.6);
    B.c(1.6, 0.4 + bob, 1.4, 'b', 0.6);
    B.c(3.8, 0 + bob, 1.6, 'b', 0.7);
    for (let i = 0; i < 4; i++) B.dl(-7 + i * 1.8, 0.6 + bob, -7 + i * 1.8, 1.8 + bob, 0.3, 'd');
    B.eye(4.4, -0.6 + bob, 0.9);
    return B.done();
  },
  leech: (t) => {
    const B = new Build();
    const w = Math.sin(t * 3);
    B.chain([[-7, 6], [-3.6, 4.4 - w], [0, 5.6 + w * 0.6], [3.6, 3.4 - w * 0.4], [6, 1.6]], 1.6, 1.9, 'b', 1);
    B.c(6.6, 1.2, 1.9, 'd', 0.6);
    B.ring(7.2, 1, 1.1, 0.35, 'k');
    for (let i = 0; i < 4; i++) B.dl(-5 + i * 2.6, 3.2, -4.6 + i * 2.6, 6.4, 0.3, 'l');
    B.eye(5.2, 0.2, 0.55);
    return B.done();
  },
  possum: (t) => {
    const B = new Build();
    const st = Math.sin(t * 6) * 0.4;
    for (const [u, p] of [[-3.6, st], [-1.4, -st], [2.2, st], [4, -st]] as const) B.cap(u, 4.6, u + p, 7.4, 0.45, 0.4, 'd', 0.3);
    B.e(-0.4, 3, 5, 3, 'b', 0, 1);
    B.e(4.8, 1.6, 2.4, 1.8, 'l', 0.2, 0.8);
    B.cap(6.2, 2, 8.4, 2.6, 0.9, 0.4, 'l', 0.5);
    B.c(4, -0.6, 1, 'd', 0.5);
    B.chain([[-5, 3.4], [-8, 3], [-9.4, 0.6], [-8, -1.2]], 0.5, 0.4, 'l', 0.5);
    B.dc(8.6, 2.6, 0.4, PINK).eye(5.2, 0.9, 0.7);
    return B.done();
  },
  worm: (t) => {
    const B = new Build();
    const r = Math.max(0, Math.sin(t * 2)) * 2.4;
    B.e(-3, 6.8, 4, 1, 'd');
    B.chain([[-6, 6.6], [-2.6, 6], [0.6, 4 - r * 0.4], [1.8, 0.6 - r], [3.6, -2.2 - r]], 1.1, 1.3, 'b', 1);
    for (let i = 0; i < 5; i++) B.dl(-5 + i * 1.8, 5.8, -5 + i * 1.8, 7, 0.25, 'd');
    B.glow(3.8, -2.6 - r, 1.2, 'l');
    B.eye(4.2, -2.4 - r, 0.55);
    return B.done();
  },
  starfish: (t) => {
    const B = new Build();
    const spin = t * 1.2;
    for (let i = 0; i < 5; i++) {
      const a = spin + (i / 5) * Math.PI * 2;
      B.cap(0, 0.6, Math.cos(a) * 6.4, 0.6 + Math.sin(a) * 6.4, 1.8, 0.6, 'b', 0.9);
    }
    B.c(0, 0.6, 2.6, 'b', 1);
    for (let i = 0; i < 5; i++) {
      const a = spin + (i / 5) * Math.PI * 2;
      B.dc(Math.cos(a) * 3.6, 0.6 + Math.sin(a) * 3.6, 0.5, 'l');
    }
    B.eye(-0.9, 0, 0.6).eye(1, 0, 0.6);
    return B.done();
  },
  porcupine: (t) => {
    const B = new Build();
    const st = Math.sin(t * 5) * 0.4;
    B.cap(-2.6, 5, -2.6 + st, 7.4, 0.6, 0.5, 'd', 0.3).cap(2.4, 5, 2.4 - st, 7.4, 0.6, 0.5, 'd', 0.3);
    B.e(-0.4, 3, 5.4, 3.8, 'b', 0, 1);
    B.e(5, 3.8, 2, 1.6, 'l', 0, 0.8);
    for (let i = 0; i < 7; i++) {
      const a = -2.8 + i * 0.32;
      const q = Math.sin(t * 2 + i) * 0.3;
      B.tri(Math.cos(a) * 4 - 0.6, 3 + Math.sin(a) * 3, Math.cos(a) * 4 + 0.6, 3 + Math.sin(a) * 3, Math.cos(a) * 8.4, 3 + Math.sin(a) * 6.8 + q, IVORY, 0.3);
    }
    B.dc(6.8, 3.8, 0.45, 'k').eye(5, 3, 0.55);
    return B.done();
  },
  zebra: (t) => {
    const B = new Build();
    const g = Math.sin(t * 8) * 0.8;
    for (const [u, p] of [[-3.6, g], [-2, -g], [2.4, g], [3.8, -g]] as const) B.cap(u, 2.6, u + p * 0.6, 7.5, 0.6, 0.45, 'b', 0.4);
    B.e(0, 1.4, 5.2, 2.8, 'b', 0, 1);
    B.chain([[3.8, 0], [5.4, -3], [6.4, -5]], 1.4, 1, 'b', 0.9);
    B.e(7.4, -4.6, 2.2, 1.3, 'b', 0.4, 0.7);
    for (let i = 0; i < 5; i++) B.dl(-4 + i * 1.8, -0.8, -3.4 + i * 1.8, 3.8, 0.55, 'k');
    B.dl(4.6, -1.6, 5.8, -3.8, 0.5, 'k');
    for (let i = 0; i < 4; i++) B.tri(4 + i * 0.6, -1 - i * 1.2, 4.8 + i * 0.6, -1.4 - i * 1.2, 4 + i * 0.6, -2.6 - i * 1.2, 'k', 0.2);
    B.glow(7.6, -5.6, 0.5, 0xfff07a).eye(7.2, -5, 0.55);
    return B.done();
  },
  // ============================================ TWENTY MORE (28 Oct)
  camel: (t) => {
    const B = new Build();
    const g = Math.sin(t * 6) * 0.6;
    for (const [u, p] of [[-3.8, g], [-2.4, -g], [2.2, g], [3.6, -g]] as const) B.cap(u, 2.4, u + p * 0.5, 7.5, 0.55, 0.45, 'b', 0.4);
    B.e(0, 1.2, 5.4, 2.6, 'b', 0, 1);
    B.c(-1.8, -1.2, 2.2, 'b', 1).c(1.8, -1, 2, 'b', 1);
    B.chain([[4.4, 0.6], [6, -2], [6.8, -4.6]], 1.2, 0.9, 'b', 0.9);
    B.e(8, -4.8, 1.9, 1.1, 'b', 0.2, 0.8);
    B.cap(-5.2, 0.4, -6.6, 3 + Math.sin(t * 3) * 0.5, 0.35, 0.25, 'd', 0.3);
    B.de(-1.8, -2.4, 1.2, 0.5, 'l').de(1.8, -2.2, 1.1, 0.5, 'l');
    flames(B, 0, -3, 2, t, 1.6);
    B.dc(9.4, -4.6, 0.35, 'k').eye(7.6, -5.4, 0.5);
    return B.done();
  },
  flamingo: (t) => {
    const B = new Build();
    const sway = Math.sin(t * 2) * 0.5;
    B.cap(0.4, 2, 0.6, 7.6, 0.35, 0.3, 'd', 0.2);
    B.cap(-0.6, 2, -2.2, 4.4, 0.35, 0.3, 'd', 0.2).cap(-2.2, 4.4, -0.4, 5, 0.3, 0.25, 'd', 0.2);
    B.e(0, 0.6, 3.8, 2.4, 'b', -0.15, 1);
    B.e(-3.6, 0.2, 1.6, 1.2, 'd', 0.4, 0.6);
    B.chain([[2.8, -0.4], [4 + sway, -3], [2.8 + sway, -5.6], [4.2 + sway, -7.4]], 0.8, 0.6, 'b', 0.8);
    B.c(4.6 + sway, -7.6, 1.2, 'b', 0.8);
    B.tri(5.4 + sway, -8, 5.4 + sway, -7, 7.6 + sway, -6.4, 0x24202c, 0.2);
    flames(B, -4, -1.2, 2, t, 2);
    B.eye(4.8 + sway, -8, 0.45);
    return B.done();
  },
  shark: (t) => {
    const B = new Build();
    const s2 = Math.sin(t * 5) * 0.8;
    B.e(0, 2, 7, 2.8, 'b', 0, 1);
    B.tri(-1, -0.4, 2.6, -0.6, 0.2, -4.6, 'b', 0.6);
    B.tri(-6.4, 1.6, -9.8, -1.6 + s2, -8.6, 2 + s2 * 0.2, 'b', 0.5).tri(-6.4, 2.4, -9.6, 5.4 - s2, -8.4, 2.2, 'b', 0.5);
    B.tri(1, 4, 3.4, 4.2, 0.4, 7, 'd', 0.4);
    B.de(1, 3.6, 5.6, 1.1, 'w');
    for (let i = 0; i < 3; i++) B.dl(3.6 + i * 0.8, 1, 3.4 + i * 0.8, 2.8, 0.25, 'd');
    for (let i = 0; i < 4; i++) B.tri(5.2 + i * 0.5, 3.1, 5.6 + i * 0.5, 3.1, 5.4 + i * 0.5, 3.8, 'w', 0.1);
    B.eye(5, 1, 0.55);
    return B.done();
  },
  lobster: (t) => {
    const B = new Build();
    const snap = Math.max(0, Math.sin(t * 3)) * 0.6;
    for (let i = 0; i < 4; i++) B.cap(-1 + i * 1.4, 3.6, -1.6 + i * 1.4, 7.4, 0.3, 0.25, 'd', 0.2);
    B.chain([[-1, 2.4], [-4, 2.8], [-6.6, 3.8], [-8.4, 5.4]], 1.9, 0.9, 'b', 0.7);
    B.tri(-8.4, 5, -10.6, 4, -10, 7, 'd', 0.4);
    B.e(1.4, 2, 3.4, 2.2, 'b', 0, 1);
    for (const k of [-1, 1]) {
      B.cap(3.4, 1.6 + k * 0.6, 6, -0.6 + k * 1.8, 0.6, 0.5, 'b', 0.5);
      B.e(7.4, -1 + k * 2.2, 1.8, 1.1, 'b', 0.2 * k, 0.6);
      B.tri(8.4, -1.4 + k * 2.2 - snap, 10.2, -2 + k * 2.2 - snap, 9, -0.8 + k * 2.2, 'd', 0.3);
    }
    B.cap(4, 0.4, 8.6, -5 + Math.sin(t * 4) * 0.6, 0.15, 0.1, 'd', 0.2).cap(4.2, 0.8, 9.4, -3.6, 0.15, 0.1, 'd', 0.2);
    for (let i = 0; i < 3; i++) B.dl(-3.2 - i * 1.8, 1.4, -3.4 - i * 1.8, 4, 0.25, 'd');
    B.eye(4.2, 0.6, 0.5);
    return B.done();
  },
  koala: (t) => {
    const B = new Build();
    const nod = Math.sin(t * 1.5) * 0.4;
    B.cap(-2.2, 5, -2.4, 7.4, 0.9, 0.8, 'd', 0.4).cap(2, 5, 2.2, 7.4, 0.9, 0.8, 'd', 0.4);
    B.e(0, 3, 4.4, 4, 'b', 0, 1);
    B.c(0.8, -2 + nod, 3.4, 'b', 1);
    for (const k of [-1, 1]) {
      B.c(0.8 + k * 3.4, -4.4 + nod, 1.9, 'b', 0.8);
      B.dc(0.8 + k * 3.4, -4.4 + nod, 1.1, 'l');
    }
    B.e(1.6, -1.4 + nod, 1.2, 1.6, 0x24202c, 0, 0.6);
    B.de(0, 4, 2.6, 2.4, 'l');
    B.cap(3.6, 2.4, 5.6, 1, 0.6, 0.5, 'b', 0.4);
    B.eye(-0.8, -2.6 + nod, 0.55).eye(3, -2.6 + nod, 0.55);
    return B.done();
  },
  ladybug: (t) => {
    const B = new Build();
    const st = Math.sin(t * 10) * 0.4;
    for (let i = 0; i < 3; i++) B.cap(-2 + i * 2, 4.8, -2.4 + i * 2 + st, 7.2, 0.4, 0.32, 0x24202c, 0.4);
    B.e(0, 2.6, 5.4, 4, 'b', 0, 1);
    B.c(5.6, 3.2, 2.2, 0x24202c, 0.8);
    B.dl(0, -1.2, 0, 6.4, 0.3, 0x24202c);
    for (const [x, y, r] of [[-2.6, 1.4, 1], [2.4, 1.2, 0.9], [-1.6, 4, 0.8], [2.2, 4.2, 0.85], [0, 0, 0.6]] as const) B.dc(x, y, r, 0x24202c);
    B.cap(6.4, 2.2, 8, -1.4 + st, 0.3, 0.2, 0x24202c, 0.5).cap(5.6, 2.2, 6.4, -1.8 - st, 0.3, 0.2, 0x24202c, 0.5);
    B.de(-1.6, 0.6, 1.4, 0.6, 'l');
    B.dc(6.4, 2.8, 0.55, 0xffffff).dc(6.6, 2.8, 0.3, 0x000000);
    return B.done();
  },
  beaver: (t) => {
    const B = new Build();
    const st = Math.sin(t * 6) * 0.5;
    B.box(-8, 4.6 + Math.sin(t * 2) * 0.3, 4.2, 1.8, 0.8, 'd', -0.15, 0.5);
    for (let i = 0; i < 3; i++) B.dl(-9.6 + i * 1.4, 4, -9.2 + i * 1.4, 5.4, 0.2, 'k');
    B.cap(-2, 5, -2 + st, 7.4, 0.7, 0.6, 'd', 0.4).cap(2.4, 5, 2.4 - st, 7.4, 0.7, 0.6, 'd', 0.4);
    B.e(-0.6, 3, 5.2, 3.4, 'b', 0, 1);
    B.c(4.6, 0.8, 2.6, 'b', 0.9);
    B.c(3.4, -1.4, 0.8, 'd', 0.4);
    B.box(6.4, 2.4, 1.2, 1.4, 0.2, 'w', 0, 0.2);
    B.dl(6.4, 1.8, 6.4, 3, 0.15, 'd');
    B.de(-0.4, 4.2, 3.4, 1.4, 'l');
    B.dc(7.2, 0.6, 0.45, 'k').eye(5.4, -0.2, 0.55);
    return B.done();
  },
  moose: (t) => {
    const B = new Build();
    const g = Math.sin(t * 5) * 0.6;
    for (const [u, p] of [[-3.6, g], [-2, -g], [2.6, g], [4, -g]] as const) B.cap(u, 2.4, u + p * 0.5, 7.6, 0.6, 0.45, 'd', 0.4);
    B.e(0, 1, 5.8, 3, 'b', 0, 1);
    B.c(3.4, -1.4, 2.2, 'b', 0.9);
    B.chain([[4.6, -1], [6.2, -2.2], [7.6, -1.4]], 1.6, 1.3, 'b', 0.8);
    B.e(8.2, -0.6, 1.4, 1.6, 'b', 0, 0.6);
    B.cap(6.4, 0, 6.6, 2.6, 0.5, 0.3, 'd', 0.3);
    for (const k of [-1, 1]) {
      B.cap(4.4, -2, 5.4 + k * 1.6, -5.2, 0.8, 0.6, 'w', 0.8);
      B.e(5.4 + k * 1.6, -5.4, 2.6, 1, 'w', k * 0.5, 0.8);
      for (let i = 0; i < 3; i++) B.tri(4 + k * 1.6 + i * 1.4, -6, 4.8 + k * 1.6 + i * 1.4, -6, 4.2 + k * 1.6 + i * 1.4, -7.8, 'w', 0.2);
    }
    spikes(B, [[-3, -1.6, 1.4], [0, -2, 1.2], [3, -1.8, 1]]);
    B.eye(6.4, -2.6, 0.5);
    return B.done();
  },
  narwhal: (t) => {
    const B = new Build();
    const sw = Math.sin(t * 2.5) * 0.8;
    B.e(0, 2 + sw * 0.3, 6.6, 3.2, 'b', 0, 1);
    B.tri(-6, 2 + sw * 0.3, -9.6, -0.6 + sw, -9.2, 4.6 + sw, 'b', 0.6);
    B.e(1.4, 4.8 + sw * 0.3, 1.8, 0.8, 'd', 0.5, 0.5);
    B.cap(5.8, 0.6 + sw * 0.3, 11.4, -2.4 + sw * 0.3, 0.6, 0.15, IVORY, 0.2);
    for (let i = 0; i < 4; i++) B.dl(6.8 + i * 1.1, 0.2 - i * 0.6 + sw * 0.3, 7.2 + i * 1.1, 0.6 - i * 0.6 + sw * 0.3, 0.15, 'd');
    B.de(1, 3.6 + sw * 0.3, 5.4, 1.4, 'l');
    for (const [x, y] of [[-2, 0.6], [0, -0.4], [-3.8, 1.4], [2, 0]] as const) B.dc(x, y + sw * 0.3, 0.5, 'd');
    B.eye(4.4, 1.4 + sw * 0.3, 0.5);
    return B.done();
  },
  lemur: (t) => {
    const B = new Build();
    const st = Math.sin(t * 7) * 0.5;
    const tail: [number, number][] = [[-3, 3], [-6, 1.4], [-7.4, -2], [-6.4, -5.4 + Math.sin(t * 3)]];
    B.chain(tail, 1, 0.8, 'b', 0.6);
    for (let i = 0; i < 4; i++) {
      const [x, y] = tail[Math.min(3, i)];
      B.dc(x + (i === 0 ? -1 : 0), y, 0.9, 0x24202c);
    }
    B.cap(-1.4, 4.4, -1.6 + st, 7.4, 0.5, 0.4, 'd', 0.3).cap(1.8, 4.4, 1.8 - st, 7.4, 0.5, 0.4, 'd', 0.3);
    B.e(0, 2.4, 3.4, 2.8, 'b', 0, 1);
    B.c(3.4, -1, 2.2, 'b', 0.9);
    B.tri(4.6, -1.4, 4.6, 0.4, 7.4, -0.4, 'b', 0.4);
    B.tri(2, -2.6, 3.4, -2.8, 2.2, -4.8, 'd', 0.2);
    B.de(3.6, -0.6, 1.6, 1.2, 'w');
    B.dc(7.2, -0.4, 0.4, 'k');
    B.eye(3.4, -1.4, 0.8, 0xe8a020);
    return B.done();
  },
  cricket: (t) => {
    const B = new Build();
    const kick = Math.max(0, Math.sin(t * 4)) * 1.2;
    B.e(0, 3, 5.6, 1.9, 'b', 0, 1);
    B.e(-1, 1.8, 4.6, 1.1, 'd', -0.1, 0.6);
    B.cap(-2.6, 3, -1 + kick, -1.6, 0.7, 0.5, 'b', 0.4).cap(-1 + kick, -1.6, -5.6, 7.4, 0.5, 0.3, 'b', 0.3);
    B.cap(1, 4, 0.6, 7.4, 0.45, 0.35, 'd', 0.4).cap(3, 4, 3.4, 7.4, 0.45, 0.35, 'd', 0.4);
    B.c(5.6, 2.6, 1.8, 'b', 0.8);
    B.cap(6.2, 2, 10.6, -4.6 + Math.sin(t * 6) * 0.5, 0.35, 0.22, 'd', 0.5).cap(6, 2.2, 9.4, -5.6, 0.35, 0.22, 'd', 0.5);
    for (let i = 0; i < 3; i++) B.dl(-3.4 + i * 1.6, 1.4, -2.6 + i * 1.6, 2.4, 0.2, 'l');
    B.glow(6.6, 1.6, 0.4, 0xfff07a).eye(6.2, 2, 0.5);
    return B.done();
  },
  pangolin: (t) => {
    const B = new Build();
    const st = Math.sin(t * 5) * 0.4;
    B.chain([[-4, 3.4], [-7, 4.6], [-9.4, 6.4]], 2, 0.9, 'b', 0.8);
    B.cap(-1.6, 5, -1.6 + st, 7.4, 0.6, 0.5, 'd', 0.3).cap(2.4, 5, 2.4 - st, 7.4, 0.6, 0.5, 'd', 0.3);
    B.e(0, 3, 5, 3.4, 'b', 0, 1);
    B.e(5, 4, 2.4, 1.4, 'l', 0.2, 0.8);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) B.decals.push({ s: { t: 'ring', x: -3.6 + i * 2.2 + (r % 2) * 1.1, y: 0.6 + r * 1.6, r: 1.1, th: 0.25 }, col: 'd' });
    for (let i = 0; i < 3; i++) B.decals.push({ s: { t: 'ring', x: -6 - i * 1.6, y: 4.4 + i * 0.7, r: 0.8, th: 0.2 }, col: 'd' });
    B.dc(7.2, 4.4, 0.35, 'k').eye(5.2, 3.4, 0.45);
    return B.done();
  },
  goat: (t) => {
    const B = new Build();
    const g = Math.sin(t * 6) * 0.6;
    for (const [u, p] of [[-3.2, g], [-2, -g], [2, g], [3.2, -g]] as const) B.cap(u, 3, u + p * 0.5, 7.5, 0.5, 0.4, 'd', 0.4);
    B.e(0, 2, 4.8, 2.6, 'b', 0, 1);
    B.c(4.6, -0.6, 2, 'b', 0.9);
    B.e(6.4, 0.2, 1.5, 1, 'b', 0.3, 0.6);
    B.chain([[3.8, -2.2], [2.6, -4.6], [0.6, -5], [0, -3.4]], 0.8, 0.4, 'w', 0.4);
    B.tri(5.6, 1.2, 6.6, 1.2, 5.8, 3.6, 'w', 0.2);
    B.cap(-4.6, 0.8, -5.6, -0.4, 0.4, 0.3, 'b', 0.3);
    B.de(0, 3.2, 3.6, 1.2, 'l');
    B.dc(7.6, 0.2, 0.35, 'k').eye(5, -1.2, 0.5, 0xc8a040);
    return B.done();
  },
  squirrel: (t) => {
    const B = new Build();
    const st = Math.sin(t * 9) * 0.5;
    const flick = Math.sin(t * 3) * 0.8;
    B.chain([[-2.4, 4], [-5.6, 2.4], [-6.4, -1.6], [-4.4 + flick, -5]], 2.4, 2.2, 'b', 0.9);
    B.chain([[-5, 1.6], [-5.4, -1.4], [-4.2 + flick, -4.2]], 1.2, 1, 'l', 0.6);
    B.cap(-0.6, 5, -1 + st, 7.4, 0.5, 0.4, 'd', 0.3).cap(2, 5, 2.4 - st, 7.4, 0.5, 0.4, 'd', 0.3);
    B.e(0.6, 3.4, 3, 2.6, 'b', 0, 1);
    B.c(3.6, 0.6, 2, 'b', 0.9);
    B.tri(2.6, -0.8, 3.6, -1.2, 2.8, -3.4, 'b', 0.2);
    B.de(1.2, 4.2, 1.6, 1.2, 'l');
    B.e(5, 3, 0.9, 1, 0x8a5a2a, 0, 0.3);
    B.dc(5.4, 0.8, 0.35, 'k').eye(3.8, 0, 0.55);
    return B.done();
  },
  swan: (t) => {
    const B = new Build();
    const fl = Math.sin(t * 3) * 0.6;
    B.e(-0.6, 3.4, 5.4, 2.8, 'b', 0, 1);
    B.e(-1.6, 1.6 - fl, 4, 1.8, 'l', -0.3, 0.7);
    B.tri(-5.4, 2.4, -8.6, 1 - fl, -6, 4, 'b', 0.4);
    B.chain([[3.6, 2.4], [5, -0.6], [4, -3.6], [5.2, -6]], 0.9, 0.6, 'b', 0.8);
    B.c(5.8, -6.4, 1.2, 'b', 0.8);
    B.tri(6.6, -7, 6.6, -5.8, 8.8, -6, 0xe88a30, 0.2);
    B.dc(6.4, -6.4, 0.5, 'k');
    B.cap(-1, 6, -0.6, 7.5, 0.3, 0.25, 0xe88a30, 0.2).cap(1, 6, 1.4, 7.5, 0.3, 0.25, 0xe88a30, 0.2);
    B.eye(6, -6.8, 0.4);
    return B.done();
  },
  raccoon: (t) => {
    const B = new Build();
    const st = Math.sin(t * 7) * 0.5;
    const tail: [number, number][] = [[-3.4, 3.6], [-6.4, 3], [-8.6, 1.6 + Math.sin(t * 3) * 0.6]];
    B.chain(tail, 1.6, 1.2, 'b', 0.8);
    for (let i = 0; i < 3; i++) B.dl(-4.6 - i * 1.6, 2.2 - i * 0.4, -4.4 - i * 1.6, 4.6 - i * 0.4, 0.45, 'k');
    B.cap(-1.6, 5, -1.6 + st, 7.4, 0.6, 0.5, 'k', 0.3).cap(2.2, 5, 2.2 - st, 7.4, 0.6, 0.5, 'k', 0.3);
    B.e(0, 3, 4.4, 3, 'b', 0, 1);
    B.c(4.4, 0.4, 2.4, 'b', 0.9);
    B.tri(6, 0, 6, 1.6, 8, 1, 'b', 0.4);
    B.tri(3, -1.4, 4.4, -1.8, 3.2, -3.8, 'b', 0.2).tri(4.6, -1.6, 6, -1.4, 5.4, -3.6, 'b', 0.2);
    B.de(4.8, 0.4, 2, 0.8, 'k');
    B.de(5.6, 1.4, 1.4, 0.6, 'w');
    B.dc(8, 1, 0.4, 'k').eye(4.4, 0.3, 0.45).eye(5.8, 0.3, 0.4);
    return B.done();
  },
  vulture: (t) => {
    const B = new Build();
    const bob = Math.sin(t * 2) * 0.5;
    B.cap(-1, 5, -1.2, 7.5, 0.4, 0.35, 0xb8a090, 0.2).cap(1.4, 5, 1.6, 7.5, 0.4, 0.35, 0xb8a090, 0.2);
    B.e(-0.4, 2.4, 4.8, 3.6, 'b', 0.2, 1);
    B.e(-1.6, 1.6, 4, 2.6, 'd', 0.3, 0.6);
    B.tri(-4.4, 4, -8.4, 6.6, -4, 6.4, 'd', 0.4);
    for (let i = 0; i < 6; i++) B.c(1.8 + Math.cos(i) * 1.6, -0.6 + Math.sin(i) * 0.8, 1, 'w', 0.6);
    B.cap(2.4, -0.8, 3.6, -3.4 + bob, 0.5, 0.45, PINK, 0.4);
    B.c(4, -4 + bob, 1.5, PINK, 0.6);
    B.tri(5, -4.6 + bob, 6.8, -3.8 + bob, 5.2, -2.8 + bob, 0x3a3030, 0.2);
    B.eye(4.2, -4.4 + bob, 0.45);
    return B.done();
  },
  skunk: (t) => {
    const B = new Build();
    const st = Math.sin(t * 6) * 0.4;
    const wag = Math.sin(t * 2) * 0.7;
    B.chain([[-3, 3], [-5.6, 0.6], [-5 + wag, -3.4], [-2.6 + wag, -5.6]], 2.2, 2, 'b', 0.9);
    B.dl(-4.2, 2.2, -5 + wag, -3, 0.8, 'w');
    B.dl(-5 + wag, -3, -2.8 + wag, -5.2, 0.7, 'w');
    B.cap(-1.4, 4.8, -1.4 + st, 7.4, 0.55, 0.45, 'd', 0.3).cap(2, 4.8, 2 - st, 7.4, 0.55, 0.45, 'd', 0.3);
    B.e(0, 3, 4, 2.6, 'b', 0, 1);
    B.dl(-3.2, 1, 3.4, 1, 0.8, 'w');
    B.c(4, 1.8, 2, 'b', 0.9);
    B.tri(5.4, 1.6, 5.4, 3, 7.2, 2.6, 'b', 0.3);
    B.dl(3.2, 0, 4.4, 1.4, 0.35, 'w');
    B.dc(7, 2.6, 0.35, 'k').eye(4.6, 1.2, 0.5);
    return B.done();
  },
  axolotl: (t) => {
    const B = new Build();
    const w = Math.sin(t * 4) * 0.6;
    B.chain([[-3, 3.6], [-6, 3.8 + w * 0.5], [-9, 3 + w]], 1.6, 0.6, 'b', 0.8);
    B.e(-6.4, 3.2 + w * 0.5, 2.8, 1.2, 'l', 0, 0.4);
    B.cap(-1.4, 4.8, -2 + w * 0.4, 7.2, 0.4, 0.3, 'b', 0.3).cap(2, 4.8, 2.6 - w * 0.4, 7.2, 0.4, 0.3, 'b', 0.3);
    B.e(0, 3.6, 4, 2.2, 'b', 0, 1);
    B.e(4.6, 2.6, 2.6, 2.1, 'b', 0, 0.9);
    for (const k of [-1, 0, 1]) B.cap(3.4, 1.4 + k * 0.8, 1.6, -0.6 + k * 1.6 + Math.sin(t * 6 + k) * 0.4, 0.4, 0.25, PINK, 0.3);
    B.dl(5.2, 3.6, 6.6, 3.2, 0.2, 'd');
    B.glow(-2, 2.6, 0.6, 0xfff4c0).glow(1.6, 2.4, 0.5, 0xfff4c0);
    B.eye(5.6, 1.8, 0.5);
    return B.done();
  },
  peacock: (t) => {
    const B = new Build();
    const fan = 1 + Math.sin(t * 1.5) * 0.06;
    for (let i = 0; i < 7; i++) {
      const a = -2.6 + i * 0.34;
      const x = Math.cos(a) * 7 * fan - 1.6;
      const y = 2.4 + Math.sin(a) * 6 * fan;
      B.cap(-1.6, 2.4, x, y, 0.4, 1.1, 'd', 0.3);
      B.dc(x, y, 0.9, 'l').dc(x, y, 0.45, 0x2a4a8a);
    }
    B.cap(0.4, 5, 0.2, 7.5, 0.3, 0.25, 0xa89060, 0.2).cap(1.8, 5, 2, 7.5, 0.3, 0.25, 0xa89060, 0.2);
    B.e(1, 3, 2.8, 2.4, 'b', 0, 1);
    B.chain([[2.6, 1.6], [3.6, -1], [3.4, -3.2]], 0.8, 0.6, 'b', 0.8);
    B.c(3.8, -3.8, 1.1, 'b', 0.8);
    for (let i = 0; i < 3; i++) B.cap(3.4 + i * 0.4, -3.8, 3 + i * 0.7, -6.6, 0.35, 0.28, 'l', 0.5);
    B.tri(4.6, -4.2, 4.6, -3.4, 5.8, -3.6, 0xa89060, 0.2);
    B.eye(4, -4, 0.4);
    return B.done();
  },
  // ================================================================ BOSSES
  lich: (t) => {
    const B = new Build();
    const w = Math.sin(t * 4) * 2 * 0.6;
    for (let i = 0; i < 5; i++) B.tri(-7 + i * 3.4, 6 + w, -5 + i * 3.4, 6 + w, -6 + i * 3.4 + Math.sin(t * 4 + i) * 1.2, 9.4 + w, 'd', 0.6);
    B.tri(-8, 7 + w, 8, 7 + w, 0, -9 + w, 'd', 1.6, 0.6);
    B.c(0.5, -7 + w, 3.4, 'd', 1.4);
    B.chain([[2, -2 + w], [5, -3.6 + w], [6.6, -4.6 + w]], 1, 0.8, 'd', 1);
    B.cap(6.6, -9.4 + w, 7.4, 7 + w, 0.55, 0.5, 0x5a4030, 0.3);
    B.box(5.9, -11.6 + w, 3.4, 4, 0.6, 0x2a2a30, 0, 0.3);
    B.de(0.8, -6.4 + w, 2.6, 2.4, 'k').glow(-0.2, -6.6 + w, 0.75, 0x8affc0).glow(1.9, -6.6 + w, 0.75, 0x8affc0);
    B.de(5.9, -11.6 + w, 1, 1.4, Math.sin(t * 5) > 0 ? 0x8affc0 : 0x5ad890);
    B.dl(-2.6, 1 + w, 1.6, 1 + w, 0.3, 'b').dl(-3.6, 4 + w, 3, 4 + w, 0.3, 'b');
    return B.done();
  },
  seraph: (t) => {
    const B = new Build();
    const beat = Math.sin(t * 2.5) * 0.08;
    const b = Math.sin(t * 4) * 0.3;
    for (const [a, len] of [[-0.5, 12], [0.15, 11], [0.75, 9]] as const) {
      for (const k of [-1, 1]) {
        const ang = (a + beat) * k;
        B.tri(k * 1.6, -2 + b, k * Math.cos(ang) * len, -2 + Math.sin(a) * len * 0.8 + b, k * 3.6, 1.5 + b, 0xfff0d0, 1.2, 0.4);
      }
    }
    for (let i = 0; i < 3; i++) B.tri(-1.4 + i, 3 + b, -0.4 + i, 3 + b, -0.9 + i + Math.sin(t * 8 + i) * 0.5, 7 + Math.sin(t * 6 + i) + b, FLAME, 0.8);
    B.c(0, -1 + b, 4.6, 'b', 1.4);
    B.de(0, -1 + b, 2.4, 1.5, 0xffffff).dc(0.5, -1 + b, 1.2, 0xff6a20).dc(0.6, -1 + b, 0.5, 'k');
    for (const k of [-1, 1]) B.dl(k * 2.4, -1 + b, k * 8, -5 + b, 0.2, 'd');
    // the halo: its own ring, meant to float
    B.group = 1;
    B.ring(0, -9 + b * 0.5, 4.6, 0.5, 0xffd060);
    return B.done();
  },
  hydra: (t) => {
    const B = new Build();
    B.tri(-9, 2, -14, 5 + Math.sin(t * 3), -9, 4.5, 'd', 1);
    for (const [k, ph] of [[-1, 0], [0, 2.1], [1, 4.2]] as const) {
      const base = 1 + k * 3;
      const lean = 0.5 + k * 1.1;
      const rise = 2.1 - Math.abs(k) * 0.35;
      const sway = Math.sin(t * 2 + ph) * 1.2;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 5; i++) pts.push([base + i * lean + sway * (i / 5), 1 - i * rise]);
      B.chain(pts, 1.8, 1.3, 'b', 1.2);
      const [hx, hy] = pts[5];
      B.e(hx + 1.4, hy - 0.6, 2.2, 1.5, 'b', 0, 0.8);
      B.tri(hx + 2.6, hy - 1, hx + 4.6, hy - 0.2, hx + 2.6, hy + 0.6, 'd', 0.4);
      B.tri(hx, hy - 1.6, hx + 0.8, hy - 1.8, hx - 0.6, hy - 3.6, 'l', 0.3);
      B.glow(hx + 1.6, hy - 1.2, 0.5, 0xffe060);
    }
    B.e(-2, 3.4, 8, 4, 'b', 0, 1.6);
    B.de(-2, 4.6, 6, 1.6, 'l');
    for (let i = 0; i < 4; i++) B.dc(-6 + i * 3, 1.4, 0.6, 'd');
    return B.done();
  },
  queen: (t) => {
    const B = new Build();
    const BRASS = 0xc8962a;
    const DARK = 0x8a6a2a;
    for (let i = 0; i < 4; i++) {
      const st = Math.sin(t * 5 + i * 1.6) * 0.8;
      for (const k of [-1, 1]) {
        const u0 = 1 + i * 0.7;
        const kx = u0 + k * (3 + i);
        B.cap(u0, 0, kx, -6 + i - st, 0.45, 0.4, DARK, 0.4).cap(kx, -6 + i - st, u0 + k * (6 + i * 1.6), 7.2, 0.4, 0.3, DARK, 0.2);
      }
    }
    B.e(-5, 0, 6.4, 5.4, BRASS, 0, 1.2);
    B.c(0, -0.4, 1.6, DARK, 1);
    B.c(4, -1, 3, DARK, 1);
    for (let i = -1; i <= 1; i++) B.tri(4 + i * 1.5 - 0.6, -3.6, 4 + i * 1.5 + 0.6, -3.6, 4 + i * 1.5, -6, 0xffd060, 0.4);
    const rot = t * 1.5;
    for (let i = 0; i < 8; i++) B.dc(-5 + Math.cos(rot + (i / 8) * Math.PI * 2) * 3.2, Math.sin(rot + (i / 8) * Math.PI * 2) * 3.2, 0.7, DARK);
    B.dc(-5, 0, 1.8, Math.sin(t * 6) > 0 ? 0xfff4a0 : 0xf0d030);
    B.glow(5, -1.4, 0.6, 0x6affff).glow(5.8, -0.4, 0.6, 0x6affff);
    return B.done();
  },
  maw: (t) => {
    const B = new Build();
    const open = (Math.sin(t * 2) + 1) / 2;
    const LEAF = 0x2e6a1e;
    for (const k of [-1, 1]) B.e(k * 5.6, 6, 4.4, 1.5, LEAF, k * 0.12, 0.8);
    B.cap(0, 6.4, 0.6, -2.6, 1.9, 1.5, 0x3a5a1e, 1.4);
    // the two jaws, hinged at the top of the stem, opening and shutting
    const up = 0.3 + open * 0.45;
    B.c(1, -4, 2.2, 'b', 1);
    B.e(1 + Math.cos(-up) * 4.2, -4 + Math.sin(-up) * 4.2, 4.6, 2.4, 'b', -up, 1);
    B.e(1 + Math.cos(up) * 4.2, -4 + Math.sin(up) * 4.2, 4.6, 2.4, 'b', up, 1);
    B.cutTri(1.6, -4, 11, -4 - (1.2 + open * 4.2), 11, -4 + (1.2 + open * 4.2));
    // the red inside of the trap, between the jaws
    B.e(4.6, -4, 3.4, 0.5 + open * 2.4, 0xc84a5a, 0, 0.3);
    for (let i = 0; i < 4; i++) {
      const q = 3.6 + i * 1.5;
      const gap = (1.2 + open * 4.2) * ((q - 1.6) / 9.4);
      B.dt(q - 0.5, -4 - gap - 0.4, q + 0.5, -4 - gap - 0.4, q, -4 - gap + 0.9, IVORY);
      B.dt(q - 0.5, -4 + gap + 0.4, q + 0.5, -4 + gap + 0.4, q, -4 + gap - 0.9, IVORY);
    }
    B.dc(-0.6, -4.6, 0.7, 0xffe060);
    return B.done();
  },
  cloud: (t) => {
    const B = new Build();
    const boil = t * 2;
    for (const [u, v, r] of [[-6, 0, 4.5], [-2, -2.5, 5], [3, -2, 5.2], [6.5, 0.5, 4], [0, 1.5, 5.5]] as const) B.c(u, v + Math.sin(boil + u) * 0.4, r, 0x5a5a72, 1.6);
    B.de(0, -0.5, 2.8, 1.7, 0xf8f8ff).dc(0.6, -0.5, 1.4, 'b').dc(0.8, -0.5, 0.6, 'k');
    return B.done();
  },
  wyrm: (t) => {
    const B = new Build();
    for (const [u, r, ph] of [[-8, 3.2, 0], [-3, 3.8, 1.2]] as const) {
      const up = Math.sin(t * 2 + ph) * 0.8;
      B.e(u, 5 - up, r + 0.4, r + 1, 'b', 0, 0.6);
    }
    B.chain([[2, 5], [2.8, 1.6], [3.8, -1.6], [4.8, -4.4]], 2.4, 1.8, 'b', 1);
    B.cutBox(0, 9.2, 30, 7);
    B.e(5.6, -5.2, 3, 2, 'b', 0, 1);
    B.tri(7.4, -5.6, 10.4, -4.6, 7.4, -3.6, 'l', 0.4);
    B.tri(4.4, -6.6, 5.6, -6.8, 4, -10, IVORY, 0.3).tri(3, -5.8, 0.4, -8 + Math.sin(t * 3), 3.4, -4.6, 'd', 0.6);
    B.group = 1;
    for (const [u, r] of [[-8, 3.6], [-3, 4.2], [2.4, 3]] as const) B.e(u, 5.6, r * 1.3, 0.9, 0x2a221a, 0, 0);
    B.group = 0;
    for (let i = 0; i < 3; i++) B.dl(1.6 + i * 0.9, 3.4 - i * 2.4, 4 + i * 0.9, 3 - i * 2.4, 0.3, 'd');
    B.glow(6.4, -6, 0.6, 0xff6a20);
    return B.done();
  },
  sphinx: (t) => {
    const B = new Build();
    const st = Math.sin(t * 5) * 0.6;
    for (const [u, p] of [[-5, st], [-3, -st], [3.5, st], [5.5, -st]] as const) B.cap(u, 3, u + p * 0.3, 7.4, 1.1, 1.1, 0xc8a050, 0.5);
    for (const k of [0, 1]) B.tri(-3 + k * 2, -0.6, -8 + k * 3, -10 + k * 1.5 + Math.sin(t * 2) * 0.6, 1 + k * 2, -1.6, k ? 0xfff0d0 : 0xd8c8a0, 1, 0.3);
    B.chain([[-7, 1], [-9.4, -1], [-10, -3 + Math.sin(t * 3)]], 0.4, 0.35, 0xc8a050, 0.5).c(-10, -3.4 + Math.sin(t * 3), 1, 0x6a4a1a, 0.4);
    B.e(0, 1.2, 7.4, 3.6, 0xe8c070, 0, 1.4);
    B.c(6.6, -2.6, 4.2, 0x8a6a2a, 1.2);
    B.e(7.6, -2.6, 2.2, 2.6, 0xd8e8f0, 0, 0.6);
    B.dt(6.4, -4.4, 7.2, -4.7, 6.6, -1.8, 0xffffff).dl(7.4, -3, 7.8, -3, 0.35, 0x3a4a5a).dl(8.6, -3, 9, -3, 0.35, 0x3a4a5a);
    return B.done();
  },
  kraken: (t) => {
    const B = new Build();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * 0.05 + (i / 7) * Math.PI * 0.9;
      const curl = Math.sin(t * 2 + i) * 0.6;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 5; k++) {
        const r = 3 + k * 1.9;
        pts.push([Math.cos(a + curl * k * 0.12) * r, 3 + Math.sin(a + curl * k * 0.1) * r * 0.45]);
      }
      B.chain(pts, 1.4, 0.4, 'd', 0.8);
    }
    B.e(0, -2, 5, 5.6, 'b', 0, 1.6);
    B.de(-2, -5, 1.5, 2, 'l').eye(-2, 0.4, 1.6).eye(2.2, 0.4, 1.6);
    for (let i = 0; i < 6; i++) B.dc(-6 + i * 2.4, 4.6, 0.4, 'l');
    return B.done();
  },
  mammoth: (t) => {
    const B = new Build();
    const sw = Math.sin(t * 2) * 0.8;
    const HAIR = 0x6a4a30;
    for (const u of [-6, -3, 2.5, 5.5]) B.box(u, 5.2, 2.6, 4.6, 0.8, 0x3a2a1e, 0, 0.6);
    for (let i = 0; i < 9; i++) B.tri(-8 + i * 2 - 1, 2.6, -8 + i * 2 + 1, 2.6, -8.6 + i * 2, 5.4, HAIR, 0.4);
    B.e(-1, -0.4, 8.4, 5.2, HAIR, 0, 1.6);
    B.c(7, -3, 3.6, 0x5a3e28, 1.4);
    B.chain([[9, -2], [10 + sw * 0.4, 2], [9.4 + sw, 5]], 1, 0.6, 0x5a3e28, 0.8);
    B.chain([[8.4, -0.4], [11.4, 1.4], [13, -1.6]], 0.6, 0.35, IVORY, 0.4);
    B.de(5, -3, 1.4, 2, 0x4a3424).de(-3, -4, 4, 1, 'l').dl(-6, 0, 3, -0.6, 0.3, 0x4a3424).eye(8, -3.8, 0.6);
    return B.done();
  },
};
