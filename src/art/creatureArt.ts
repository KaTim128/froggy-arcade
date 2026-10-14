/**
 * Creature Clash art: eleven bodies drawn from shapes, coloured by element.
 * One function, any size -- the card, the party slot and the arena all call
 * it, so a creature looks the same everywhere.
 *
 * (x, y) is the centre of the body; `s` is pixels per unit (a body is about
 * 16 units across); `f` is facing (1 right, -1 left); `t` is seconds, for
 * the idle bob and the flap.
 */

import type Phaser from 'phaser';
import { ELEMENTS, type Body, type Element } from '../game/creatures';

export interface Drawable {
  element: Element;
  body: Body;
  /** A boss wears one of these, and nothing else in the game does. */
  crown?: BossCrown;
}

export type BossCrown = 'geode' | 'straw' | 'thorns' | 'frost' | 'fungus' | 'halo' | 'fins' | 'storm' | 'magma';

const EYE = 0x141018;

export function drawCreature(g: Phaser.GameObjects.Graphics, c: Drawable, x: number, y: number, s = 1, f = 1, t = 0): void {
  const e = ELEMENTS[c.element];
  const X = (u: number): number => x + u * s * f;
  const Y = (v: number): number => y + v * s;
  const S = (u: number): number => u * s;
  const bob = Math.sin(t * 4) * 0.6;
  const eye = (u: number, v: number, r = 1.3): void => {
    g.fillStyle(0xffffff, 1).fillCircle(X(u), Y(v), S(r));
    g.fillStyle(EYE, 1).fillCircle(X(u + 0.35), Y(v), S(r * 0.55));
  };
  // a soft shadow under everything
  g.fillStyle(0x000000, 0.25).fillEllipse(x, Y(7.5), S(c.body === 'crab' || c.body === 'ray' ? 15 : 12), S(3));
  // a boss stands in its own weather before it is drawn at all
  if (c.crown) {
    g.fillStyle(0x000000, 0.3).fillEllipse(x, Y(6.5), S(20), S(7));
    g.lineStyle(S(0.6), e.light, 0.35 + Math.sin(t * 2.5) * 0.15).strokeEllipse(x, Y(5.5), S(22 + Math.sin(t * 2) * 1.5), S(9));
  }

  switch (c.body) {
    case 'mole': {
      g.fillStyle(e.dark, 1).fillEllipse(X(0), Y(1 + bob * 0.3), S(13), S(11));
      g.fillStyle(e.col, 1).fillEllipse(X(0), Y(0.5 + bob * 0.3), S(12), S(10));
      g.fillStyle(e.light, 1).fillEllipse(X(4.5), Y(1.5), S(5), S(4)); // snout
      g.fillStyle(0xe88a9a, 1).fillCircle(X(6.6), Y(1.2), S(1));
      g.fillStyle(e.light, 1);
      g.fillTriangle(X(-3), Y(5), X(-1), Y(5), X(-2), Y(7.5));
      g.fillTriangle(X(2), Y(5), X(4), Y(5), X(3), Y(7.5));
      eye(2.4, -1.4, 1);
      break;
    }
    case 'wisp': {
      const w = bob * 1.4;
      g.fillStyle(e.dark, 0.9).fillTriangle(X(-5), Y(1 + w), X(5), Y(1 + w), X(-1 - Math.sin(t * 6) * 2), Y(-10 + w));
      g.fillStyle(e.col, 1).fillCircle(X(0), Y(1 + w), S(5.5));
      g.fillStyle(e.light, 0.8).fillCircle(X(-1), Y(0 + w), S(3));
      g.fillStyle(e.col, 0.7).fillTriangle(X(-3), Y(5 + w), X(3), Y(5 + w), X(Math.sin(t * 5) * 2), Y(9 + w));
      eye(-1.4, 0.5 + w, 1.1);
      eye(2.2, 0.5 + w, 1.1);
      break;
    }
    case 'crab': {
      g.fillStyle(e.dark, 1);
      for (const k of [-1, 1]) {
        for (let i = 0; i < 3; i++) g.fillRect(X(k * (5 + i * 1.5)) - S(0.5), Y(3 + i * 0.5), S(1), S(4));
      }
      // claws
      const snap = Math.sin(t * 3) > 0.7 ? 1 : 0;
      for (const k of [-1, 1]) {
        g.fillStyle(e.col, 1).fillCircle(X(k * 8.5), Y(-3), S(2.6));
        g.fillStyle(e.dark, 1).fillTriangle(X(k * 8.5), Y(-3), X(k * 11), Y(-5 - snap), X(k * 11), Y(-2 + snap));
      }
      g.fillStyle(e.dark, 1).fillEllipse(X(0), Y(1.5), S(15), S(9));
      g.fillStyle(e.col, 1).fillEllipse(X(0), Y(0.8), S(14), S(8));
      g.fillStyle(e.light, 0.8).fillEllipse(X(-2), Y(-1), S(6), S(2.5));
      eye(-1.5, -3.6, 1);
      eye(1.8, -3.6, 1);
      break;
    }
    case 'beetle': {
      g.fillStyle(e.dark, 1);
      for (const k of [-1, 0, 1]) g.fillRect(X(k * 3) - S(0.5), Y(4), S(1), S(3.5));
      g.fillStyle(e.dark, 1).fillEllipse(X(-0.5), Y(0.5), S(14), S(10));
      g.fillStyle(e.col, 1).fillEllipse(X(-1), Y(0), S(12), S(9));
      g.lineStyle(S(0.6), e.dark, 1).lineBetween(X(-1), Y(-4.5), X(-1), Y(4.5));
      g.fillStyle(e.light, 0.7).fillEllipse(X(-3.5), Y(-2), S(3), S(2));
      g.fillStyle(e.dark, 1).fillCircle(X(5.5), Y(0.5), S(3));
      g.fillStyle(e.light, 1).fillTriangle(X(6.5), Y(-1), X(8.5), Y(0), X(10), Y(-5)); // horn
      eye(6.4, 0.6, 0.8);
      break;
    }
    case 'serpent': {
      const seg = 6;
      for (let i = seg; i >= 0; i--) {
        const u = -7 + i * 2;
        const v = Math.sin(t * 5 + i * 0.9) * 1.6 + 2;
        g.fillStyle(i % 2 ? e.col : e.dark, 1).fillCircle(X(u), Y(v), S(2.6 - (seg - i) * 0.15));
      }
      g.fillStyle(e.col, 1).fillEllipse(X(6.5), Y(-1.5), S(6), S(5));
      g.fillStyle(e.light, 1).fillEllipse(X(7), Y(-0.5), S(4), S(2));
      g.fillStyle(0xd83a4a, 1).fillTriangle(X(9.3), Y(-0.8), X(11.5), Y(-1.8), X(11.5), Y(0.2));
      eye(7, -2.6, 0.9);
      break;
    }
    case 'golem': {
      g.fillStyle(e.dark, 1);
      g.fillRect(X(-5) - S(1.25), Y(3), S(2.5), S(4.5));
      g.fillRect(X(4) - S(1.25), Y(3), S(2.5), S(4.5));
      g.fillStyle(e.dark, 1).fillRect(x - S(7), Y(-6 + bob * 0.3), S(14), S(10));
      g.fillStyle(e.col, 1).fillRect(x - S(6.5), Y(-6.5 + bob * 0.3), S(13), S(9));
      g.fillStyle(e.light, 0.6).fillRect(x - S(5.5), Y(-5.5 + bob * 0.3), S(4), S(2));
      // arms
      g.fillStyle(e.dark, 1).fillRect(X(7.5) - S(1.5), Y(-4), S(3), S(7));
      g.fillRect(X(-7.5) - S(1.5), Y(-4), S(3), S(7));
      g.fillStyle(e.light, 1).fillRect(X(-2) - S(3), Y(-9 + bob * 0.3), S(6), S(4)); // head
      g.fillStyle(e.dark, 1).fillRect(X(1) - S(0.6), Y(-7.8 + bob * 0.3), S(1.2), S(1.2));
      g.fillRect(X(-1.5) - S(0.6), Y(-7.8 + bob * 0.3), S(1.2), S(1.2));
      break;
    }
    case 'moth': {
      const flap = Math.abs(Math.sin(t * 9));
      for (const k of [-1, 1]) {
        g.fillStyle(e.col, 0.95).fillEllipse(x + k * S(5.5), Y(-2 + bob), S(8), S(6 + flap * 4));
        g.fillStyle(e.light, 0.9).fillCircle(x + k * S(5.5), Y(-2 + bob), S(1.6));
        g.fillStyle(e.dark, 0.95).fillEllipse(x + k * S(4), Y(3 + bob), S(5), S(3 + flap * 2));
      }
      g.fillStyle(e.dark, 1).fillEllipse(x, Y(1 + bob), S(4), S(10));
      g.lineStyle(S(0.4), e.dark, 1);
      g.lineBetween(x - S(0.8), Y(-4 + bob), x - S(2.5), Y(-8 + bob));
      g.lineBetween(x + S(0.8), Y(-4 + bob), x + S(2.5), Y(-8 + bob));
      eye(-1, -2.5 + bob, 0.8);
      eye(1, -2.5 + bob, 0.8);
      break;
    }
    case 'toad': {
      const sq = Math.max(0, Math.sin(t * 3)) * 0.8;
      g.fillStyle(e.dark, 1).fillEllipse(X(-5), Y(5.5), S(5), S(3));
      g.fillEllipse(X(5), Y(5.5), S(5), S(3));
      g.fillStyle(e.dark, 1).fillEllipse(x, Y(1.5 + sq), S(15), S(10 - sq));
      g.fillStyle(e.col, 1).fillEllipse(x, Y(1 + sq), S(14), S(9 - sq));
      g.fillStyle(e.light, 1).fillEllipse(x, Y(3.5 + sq), S(9), S(4));
      g.fillStyle(e.col, 1).fillCircle(X(-3), Y(-3.5 + sq), S(2.6));
      g.fillCircle(X(3), Y(-3.5 + sq), S(2.6));
      eye(-3, -3.7 + sq, 1.5);
      eye(3, -3.7 + sq, 1.5);
      g.lineStyle(S(0.5), e.dark, 1).lineBetween(X(-2.5), Y(1 + sq), X(2.5), Y(1 + sq));
      break;
    }
    case 'hound': {
      const step = Math.sin(t * 8) * 0.8;
      g.fillStyle(e.dark, 1);
      for (const [u, p] of [[-4, step], [-2, -step], [3, step], [5, -step]] as const) g.fillRect(X(u) - S(0.8), Y(2.5), S(1.6), S(5 + p));
      g.fillStyle(e.col, 1).fillEllipse(x, Y(1), S(13), S(7));
      g.fillStyle(e.dark, 1).fillTriangle(X(-6), Y(0), X(-10), Y(-4 + Math.sin(t * 7) * 1.5), X(-6.5), Y(-1.5)); // tail
      g.fillStyle(e.col, 1).fillCircle(X(6), Y(-3), S(3.6));
      g.fillStyle(e.light, 1).fillEllipse(X(8.5), Y(-2), S(4), S(2.6));
      g.fillStyle(EYE, 1).fillCircle(X(10.3), Y(-2.4), S(0.7));
      g.fillStyle(e.dark, 1).fillTriangle(X(4.5), Y(-5), X(6.5), Y(-5.5), X(4.6), Y(-9));
      eye(6.6, -3.8, 0.9);
      break;
    }
    case 'owl': {
      const flap = Math.sin(t * 5) * 1;
      g.fillStyle(e.dark, 1).fillEllipse(X(-6), Y(1 + flap), S(4), S(9));
      g.fillEllipse(X(6), Y(1 - flap), S(4), S(9));
      g.fillStyle(e.col, 1).fillEllipse(x, Y(0.5 + bob * 0.4), S(12), S(14));
      g.fillStyle(e.light, 1).fillEllipse(x, Y(3 + bob * 0.4), S(7), S(7));
      g.fillStyle(e.col, 1).fillTriangle(X(-5), Y(-5), X(-2), Y(-5.5), X(-4.5), Y(-9));
      g.fillTriangle(X(5), Y(-5), X(2), Y(-5.5), X(4.5), Y(-9));
      eye(-2.4, -2.5 + bob * 0.4, 1.8);
      eye(2.4, -2.5 + bob * 0.4, 1.8);
      g.fillStyle(0xe8b030, 1).fillTriangle(X(-0.8), Y(-0.6), X(0.8), Y(-0.6), X(0), Y(1.2));
      g.fillStyle(0xe8b030, 1).fillRect(X(-2) - S(0.5), Y(7), S(1), S(1));
      g.fillRect(X(2) - S(0.5), Y(7), S(1), S(1));
      break;
    }
    case 'ray': {
      const w = Math.sin(t * 4) * 1.5;
      g.fillStyle(e.dark, 1).fillTriangle(X(-6), Y(1), X(-15), Y(4 + w), X(-6), Y(2.5));
      g.fillStyle(e.dark, 1).fillTriangle(X(-7), Y(-1 + w), X(0), Y(-7), X(7), Y(-1 + w));
      g.fillTriangle(X(-7), Y(-1 + w), X(0), Y(6), X(7), Y(-1 + w));
      g.fillStyle(e.col, 1).fillTriangle(X(-6), Y(-0.5 + w), X(0), Y(-6), X(6), Y(-0.5 + w));
      g.fillTriangle(X(-6), Y(-0.5 + w), X(0), Y(5), X(6), Y(-0.5 + w));
      g.fillStyle(e.light, 0.7).fillEllipse(X(0), Y(0), S(5), S(3));
      eye(2.4, -1.5, 0.9);
      eye(-1, -1.5, 0.9);
      break;
    }
  }

  // ---- AND THEN WHAT IT IS MADE OF.
  //
  // The body is the animal; this is the element growing out of it, and it
  // changes the SHAPE -- a crest of flame, a fin, a back of ice spines, a
  // pair of bolt horns, leaves, plates, swept feathers, tendrils, a halo.
  // Without it a Cindermole and a Rimemole were one mole in two colours.
  mark(g, c, x, y, s, f, t, e);
  if (c.crown) crown(g, c.crown, x, y, s, f, t, e);
}

type Pal = { col: number; dark: number; light: number };

/** Where the element shows on each body: roughly the top of its back. */
function backOf(body: Body): { u: number; v: number; k: number } {
  switch (body) {
    case 'golem': return { u: 0, v: -9.5, k: 1.1 };
    case 'owl': return { u: 0, v: -7.5, k: 1 };
    case 'crab': return { u: 0, v: -5, k: 1.1 };
    case 'toad': return { u: 0, v: -6, k: 1 };
    case 'serpent': return { u: 4, v: -5.5, k: 0.9 };
    case 'hound': return { u: 0, v: -3.5, k: 0.9 };
    case 'moth': return { u: 0, v: -6, k: 0.9 };
    case 'ray': return { u: 0, v: -5, k: 0.9 };
    case 'wisp': return { u: 0, v: -5, k: 0.9 };
    case 'beetle': return { u: -2, v: -5.5, k: 1 };
    default: return { u: -1, v: -5, k: 1 };
  }
}

function mark(g: Phaser.GameObjects.Graphics, c: Drawable, x: number, y: number, s: number, f: number, t: number, e: Pal): void {
  const b = backOf(c.body);
  const X = (u: number): number => x + u * s * f;
  const Y = (v: number): number => y + v * s;
  const S = (u: number): number => u * s * b.k;
  switch (c.element) {
    case 'ember': {
      // a crest of flame along the spine, never still
      for (let i = 0; i < 3; i++) {
        const w = Math.sin(t * 9 + i * 1.3) * 0.9;
        const u = b.u - 2 + i * 2;
        g.fillStyle(0xff8a3a, 0.95).fillTriangle(X(u - 1.3), Y(b.v + 1), X(u + 1.3), Y(b.v + 1), X(u + w), Y(b.v - 4 - i * 0.4));
        g.fillStyle(0xffd060, 0.9).fillTriangle(X(u - 0.6), Y(b.v + 0.6), X(u + 0.6), Y(b.v + 0.6), X(u + w * 0.6), Y(b.v - 2.4));
      }
      break;
    }
    case 'tide': {
      // a high dorsal fin and a wet gleam
      g.fillStyle(e.dark, 1).fillTriangle(X(b.u - 2.5), Y(b.v + 1.5), X(b.u + 2.5), Y(b.v + 1.5), X(b.u + 1.5), Y(b.v - 5));
      g.fillStyle(0x9ad0ff, 0.9).fillTriangle(X(b.u - 1.4), Y(b.v + 1), X(b.u + 1.8), Y(b.v + 1), X(b.u + 1.2), Y(b.v - 3.6));
      g.fillStyle(0xffffff, 0.7).fillCircle(X(b.u + 3.5 + Math.sin(t * 3)), Y(b.v - 1), S(0.6));
      break;
    }
    case 'moss': {
      // leaves, and a sprig that nods
      for (const k of [-1, 1]) {
        g.fillStyle(0x3a7a28, 1).fillEllipse(X(b.u + k * 2.6), Y(b.v - 1 + Math.sin(t * 2 + k) * 0.3), S(3.4), S(1.8));
        g.fillStyle(0x7ac04a, 0.9).fillEllipse(X(b.u + k * 2.6), Y(b.v - 1.4 + Math.sin(t * 2 + k) * 0.3), S(2.2), S(1));
      }
      g.fillStyle(0x3a7a28, 1).fillRect(X(b.u) - S(0.4), Y(b.v - 4), S(0.8), S(3.5));
      g.fillStyle(0xe8d870, 1).fillCircle(X(b.u + Math.sin(t * 2) * 0.6), Y(b.v - 4.4), S(1));
      break;
    }
    case 'frost': {
      // a row of ice spines down the back, lit along one edge
      for (let i = 0; i < 4; i++) {
        const u = b.u - 3 + i * 2;
        const h = 3 + (i % 2) * 1.4;
        g.fillStyle(0x8adcf0, 0.95).fillTriangle(X(u - 1), Y(b.v + 1), X(u + 1), Y(b.v + 1), X(u), Y(b.v + 1 - h));
        g.fillStyle(0xffffff, 0.8).fillTriangle(X(u - 0.3), Y(b.v + 0.6), X(u + 0.3), Y(b.v + 0.6), X(u), Y(b.v + 1 - h * 0.8));
      }
      break;
    }
    case 'volt': {
      // bolt horns, and the spark that jumps between them
      for (const k of [-1, 1]) {
        g.fillStyle(0xf0d030, 1);
        g.fillTriangle(X(b.u + k * 2.2), Y(b.v + 1), X(b.u + k * 3.2), Y(b.v + 1), X(b.u + k * 1.6), Y(b.v - 3.6));
      }
      if (Math.sin(t * 14) > 0.3) {
        g.lineStyle(S(0.5), 0xfff4a0, 1);
        g.lineBetween(X(b.u - 2), Y(b.v - 3), X(b.u), Y(b.v - 1.6));
        g.lineBetween(X(b.u), Y(b.v - 1.6), X(b.u + 2), Y(b.v - 3));
      }
      break;
    }
    case 'stone': {
      // plates grown out of the shoulders, chipped and heavy
      for (const k of [-1, 1]) {
        g.fillStyle(0x5a4e3e, 1).fillTriangle(X(b.u + k * 1.6), Y(b.v + 2), X(b.u + k * 5), Y(b.v + 1), X(b.u + k * 3), Y(b.v - 3));
        g.fillStyle(0xd0c4a8, 0.9).fillTriangle(X(b.u + k * 2.4), Y(b.v + 1.2), X(b.u + k * 4), Y(b.v + 0.8), X(b.u + k * 3), Y(b.v - 1.6));
      }
      break;
    }
    case 'gale': {
      // feathers swept back, and the air coming off them
      for (let i = 0; i < 3; i++) {
        const o = Math.sin(t * 6 + i) * 0.8;
        g.fillStyle(0xe8fff0, 0.85).fillTriangle(X(b.u - 1 - i), Y(b.v + 1), X(b.u - 5 - i * 1.6), Y(b.v - 1 + o), X(b.u - 1 - i), Y(b.v - 2));
      }
      g.lineStyle(S(0.4), 0xffffff, 0.5);
      g.lineBetween(X(b.u - 6), Y(b.v - 3 + Math.sin(t * 5)), X(b.u - 10), Y(b.v - 3.6 + Math.sin(t * 5)));
      break;
    }
    case 'murk': {
      // tendrils of shadow, and a band across the eyes
      for (let i = 0; i < 3; i++) {
        const w = Math.sin(t * 3 + i * 2) * 1.6;
        g.fillStyle(0x40245a, 0.85).fillEllipse(X(b.u - 2 + i * 2 + w), Y(b.v - 2 - i * 0.8), S(1.6), S(3.4));
      }
      g.fillStyle(0x1a0e28, 0.75).fillRect(X(b.u - 3.5), Y(b.v + 3), S(7), S(1.4));
      break;
    }
    case 'glow': {
      // a halo, and the light it throws
      g.lineStyle(S(0.7), 0xffffff, 0.75 + Math.sin(t * 3) * 0.2).strokeEllipse(X(b.u), Y(b.v - 2.5), S(7), S(2.4));
      g.fillStyle(0xfff8d0, 0.25).fillCircle(X(b.u), Y(b.v + 1), S(5 + Math.sin(t * 2) * 0.5));
      break;
    }
  }
}

/**
 * ---- AND WHAT A BOSS WEARS.
 *
 * One per world, drawn over everything else: the thing that makes it the
 * ruler of this place and not a large wild creature.  It is deliberately
 * top-heavy -- a crown, a crust, a head of straw -- so the silhouette alone
 * says that what you are looking at is not one of the nine you have met.
 */
function crown(g: Phaser.GameObjects.Graphics, kind: BossCrown, x: number, y: number, s: number, f: number, t: number, e: Pal): void {
  const X = (u: number): number => x + u * s * f;
  const Y = (v: number): number => y + v * s;
  const S = (u: number): number => u * s;
  const top = -10;
  switch (kind) {
    case 'geode':
      for (let i = -2; i <= 2; i++) {
        const h = 5 - Math.abs(i) * 1.1;
        g.fillStyle(0x6a4a9a, 1).fillTriangle(X(i * 2.4 - 1.2), Y(top + 1), X(i * 2.4 + 1.2), Y(top + 1), X(i * 2.4), Y(top + 1 - h));
        g.fillStyle(0xc8a0ff, 0.9).fillTriangle(X(i * 2.4 - 0.4), Y(top + 0.6), X(i * 2.4 + 0.4), Y(top + 0.6), X(i * 2.4), Y(top + 1 - h * 0.7));
      }
      break;
    case 'straw':
      g.fillStyle(0xc8a040, 1).fillEllipse(X(0), Y(top), S(11), S(4));
      for (let i = -4; i <= 4; i++) g.fillStyle(0xe8c870, 1).fillRect(X(i * 1.2), Y(top - 3 - (i % 2)), S(0.7), S(4));
      g.fillStyle(0x3a2a14, 1).fillRect(X(-5.5), Y(top - 0.6), S(11), S(1));
      break;
    case 'thorns':
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        g.fillStyle(0x2e5a1e, 1).fillTriangle(X(Math.cos(a) * 6), Y(top + 2 + Math.sin(a) * 3), X(Math.cos(a) * 6 + 1), Y(top + 2 + Math.sin(a) * 3 + 1), X(Math.cos(a) * 9), Y(top - 1 + Math.sin(a) * 5));
      }
      g.fillStyle(0xd84a6a, 1).fillCircle(X(0), Y(top - 1), S(1.4));
      break;
    case 'frost':
      for (let i = -2; i <= 2; i++) {
        g.fillStyle(0xd8f4ff, 1).fillTriangle(X(i * 2.6 - 1), Y(top + 1.5), X(i * 2.6 + 1), Y(top + 1.5), X(i * 2.6), Y(top - 4 - (i === 0 ? 2 : 0)));
      }
      g.fillStyle(0xffffff, 0.8).fillRect(X(-6), Y(top + 1), S(12), S(1));
      break;
    case 'fungus':
      for (const [u, r] of [[-3.5, 3], [0.5, 4], [4, 2.6]] as const) {
        g.fillStyle(0x6a3a5a, 1).fillEllipse(X(u), Y(top + 1), S(r * 2), S(r));
        g.fillStyle(0xc87aa8, 0.9).fillEllipse(X(u), Y(top + 0.4), S(r * 1.6), S(r * 0.7));
        g.fillStyle(0xf0d0e0, 0.9).fillCircle(X(u - r * 0.3), Y(top + 0.2), S(0.6));
      }
      break;
    case 'halo':
      g.lineStyle(S(1.2), 0xfff4c0, 0.8 + Math.sin(t * 2) * 0.2).strokeEllipse(X(0), Y(top - 2), S(14), S(5));
      g.lineStyle(S(0.5), 0xffffff, 0.6).strokeEllipse(X(0), Y(top - 2), S(18), S(6.5));
      break;
    case 'fins':
      for (const k of [-1, 1]) {
        g.fillStyle(e.dark, 1).fillTriangle(X(k * 3), Y(top + 4), X(k * 10), Y(top + 1 + Math.sin(t * 3) * 1.5), X(k * 4), Y(top - 2));
        g.fillStyle(0x9ad0ff, 0.85).fillTriangle(X(k * 3.6), Y(top + 3.4), X(k * 8), Y(top + 1.4 + Math.sin(t * 3)), X(k * 4.4), Y(top - 0.6));
      }
      break;
    case 'storm':
      g.fillStyle(0x3a3a52, 0.9).fillEllipse(X(-2), Y(top - 2), S(9), S(4));
      g.fillStyle(0x50506a, 0.9).fillEllipse(X(3), Y(top - 3), S(8), S(4));
      if (Math.sin(t * 11) > 0) {
        g.fillStyle(0xfff4a0, 1);
        g.fillTriangle(X(-1), Y(top - 1), X(1), Y(top - 1), X(-0.5), Y(top + 3));
        g.fillTriangle(X(-1.5), Y(top + 2), X(1), Y(top + 2), X(0), Y(top + 5));
      }
      break;
    case 'magma':
      g.fillStyle(0x2a1208, 1).fillEllipse(X(0), Y(top + 1), S(13), S(5));
      for (let i = -2; i <= 2; i++) {
        g.fillStyle(0xff6a20, 0.9 + Math.sin(t * 4 + i) * 0.1).fillRect(X(i * 2.4 - 0.5), Y(top - 1), S(1), S(3.5));
        g.fillStyle(0x1a0c06, 1).fillTriangle(X(i * 2.6 - 1.4), Y(top + 1), X(i * 2.6 + 1.4), Y(top + 1), X(i * 2.6), Y(top - 4));
      }
      g.fillStyle(0xffd060, 0.8).fillCircle(X(0), Y(top - 1), S(1));
      break;
  }
}