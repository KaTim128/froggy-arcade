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
import { ELEMENTS, type Body, type BossBody, type Element } from '../game/creatures';

export interface Drawable {
  element: Element;
  body: Body | BossBody;
}

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
  const wide: Partial<Record<Body | BossBody, number>> = { crab: 15, ray: 15, slug: 17, centipede: 18, spider: 16, bat: 8, hydra: 20, queen: 20, kraken: 22, mammoth: 20, wyrm: 20, seraph: 14, cloud: 18, maw: 16, lich: 12, sphinx: 18 };
  g.fillStyle(0x000000, 0.25).fillEllipse(x, Y(7.5), S(wide[c.body] ?? 12), S(3));
  // a boss stands in its own weather before it is drawn at all
  if (BOSS_BODIES.includes(c.body as BossBody)) {
    g.lineStyle(S(0.6), e.light, 0.35 + Math.sin(t * 2.5) * 0.15).strokeEllipse(x, Y(6.5), S(24 + Math.sin(t * 2) * 1.5), S(8));
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
    // ================================================== the nine new shapes
    case 'jelly': {
      // a bell of ice, crystal facets inside it, tentacles trailing under
      const w = bob * 1.6;
      for (let i = -2; i <= 2; i++) {
        const u = i * 1.9;
        g.lineStyle(S(0.7), e.col, 0.75);
        g.beginPath();
        g.moveTo(X(u), Y(1 + w));
        for (let k = 1; k <= 4; k++) g.lineTo(X(u + Math.sin(t * 4 + i + k) * 0.9), Y(1 + w + k * 1.7));
        g.strokePath();
      }
      g.fillStyle(e.dark, 0.9).slice(x, Y(1.5 + w), S(7), Math.PI, 0, false).fillPath();
      g.fillStyle(e.col, 0.8).slice(x, Y(1 + w), S(6.3), Math.PI, 0, false).fillPath();
      g.fillStyle(0xffffff, 0.55).fillTriangle(X(-3), Y(-1 + w), X(-1), Y(-4.5 + w), X(0), Y(-0.5 + w));
      g.fillStyle(e.light, 0.7).fillTriangle(X(1), Y(-0.5 + w), X(2.5), Y(-3.5 + w), X(3.5), Y(0 + w));
      g.fillStyle(e.dark, 0.9).fillRect(x - S(6.5), Y(0.6 + w), S(13), S(1));
      eye(-1.6, -1 + w, 0.8);
      eye(1.8, -1 + w, 0.8);
      break;
    }
    case 'mantis': {
      // upright on two thin back legs, a long abdomen swept behind, the head a
      // triangle of eyes, the two scythes held up and twitching
      const tw = Math.sin(t * 6) * 0.8;
      g.lineStyle(S(0.8), e.dark, 1);
      g.lineBetween(X(-1), Y(1), X(-3), Y(7.5));
      g.lineBetween(X(0.5), Y(1), X(1.5), Y(7.5));
      g.fillStyle(e.dark, 1).fillEllipse(X(-4), Y(0.5), S(9), S(4));
      g.fillStyle(e.col, 1).fillEllipse(X(-4.2), Y(0.2), S(8), S(3));
      g.fillStyle(e.col, 1).fillRect(X(0) - S(1), Y(-5), S(2), S(6.5));
      g.fillStyle(e.dark, 1).fillTriangle(X(-1.5), Y(-6), X(3.5), Y(-6.5), X(1.2), Y(-3));
      g.fillStyle(e.light, 1).fillCircle(X(-0.8), Y(-6.4), S(1.1));
      g.fillCircle(X(2.6), Y(-6.6), S(1.1));
      g.fillStyle(EYE, 1).fillCircle(X(2.9), Y(-6.6), S(0.5));
      for (const k of [0, 1]) {
        const v = -3.5 + k * 1.5;
        g.lineStyle(S(0.9), e.dark, 1);
        g.lineBetween(X(0.6), Y(v), X(3.8), Y(v - 2 + tw));
        g.lineStyle(S(0.7), e.light, 1);
        g.lineBetween(X(3.8), Y(v - 2 + tw), X(5.6), Y(v + 1.5 + tw));
      }
      g.lineStyle(S(0.3), e.dark, 1).lineBetween(X(0.5), Y(-6.5), X(-1.5), Y(-9.5)).lineBetween(X(1.6), Y(-6.6), X(3), Y(-9.8));
      break;
    }
    case 'spider': {
      // a brass-and-steel walker: eight jointed legs stepping in pairs, a
      // round body with rivets, and a cluster of red lamp eyes
      for (let i = 0; i < 4; i++) {
        const st = Math.sin(t * 8 + i * 1.6) * 0.8;
        for (const k of [-1, 1]) {
          const u0 = k * (1.5 + i * 0.6);
          const knee = k * (5 + i * 1.2);
          const foot = k * (7 + i * 1.5);
          g.lineStyle(S(0.8), 0x4a4e58, 1);
          g.lineBetween(X(u0), Y(0), X(knee), Y(-3 + i * 0.4 - st * (k > 0 ? 1 : -1)));
          g.lineBetween(X(knee), Y(-3 + i * 0.4 - st * (k > 0 ? 1 : -1)), X(foot), Y(7));
        }
      }
      g.fillStyle(e.dark, 1).fillCircle(X(-2), Y(0), S(5));
      g.fillStyle(e.col, 1).fillCircle(X(-2.2), Y(-0.4), S(4.3));
      g.fillStyle(0x3a3e48, 1).fillCircle(X(3.5), Y(0.5), S(3));
      for (const [u, v] of [[-4.5, -1.5], [-2, -3.8], [0.4, -1.4], [-2, 2]] as const) g.fillStyle(0xc8ccd4, 1).fillCircle(X(u), Y(v), S(0.5));
      for (const [u, v] of [[4.6, -0.4], [5.6, 0.6], [4.4, 1.4]] as const) g.fillStyle(0xff3a3a, 0.8 + Math.sin(t * 6) * 0.2).fillCircle(X(u), Y(v), S(0.6));
      break;
    }
    case 'roller': {
      // an armadillo: a banded half-shell that turns over as it goes, a
      // pointed snout and two tall ears
      const roll = (t * 3) % 1;
      g.fillStyle(e.dark, 1).fillRect(X(-5) - S(0.8), Y(4), S(1.6), S(3));
      g.fillRect(X(3) - S(0.8), Y(4), S(1.6), S(3));
      g.fillStyle(e.dark, 1).slice(x, Y(4.5), S(7.5), Math.PI, 0, false).fillPath();
      g.fillStyle(e.col, 1).slice(x, Y(4), S(6.8), Math.PI, 0, false).fillPath();
      for (let i = 0; i < 5; i++) {
        const u = -5.6 + (i + roll) * 2.6;
        if (Math.abs(u) < 6.4) g.lineStyle(S(0.5), e.dark, 1).lineBetween(X(u), Y(4 - Math.sqrt(Math.max(0, 6.8 * 6.8 - u * u)) * 0.98), X(u), Y(4));
      }
      g.fillStyle(e.light, 0.6).fillEllipse(X(-2), Y(-0.5), S(4), S(1.6));
      g.fillStyle(e.light, 1).fillTriangle(X(6), Y(1), X(6.5), Y(4), X(10.5), Y(3.2));
      g.fillStyle(e.light, 1).fillTriangle(X(6.2), Y(1), X(7.4), Y(0.6), X(6.6), Y(-2.4));
      eye(7.2, 2.2, 0.7);
      break;
    }
    case 'sprout': {
      // a seed pod on legs of root, a fan of leaves for a head, a small face
      const sw = Math.sin(t * 2.5) * 0.6;
      g.lineStyle(S(0.9), 0x6a4a2a, 1);
      for (const [u0, u1, w] of [[-2, -5, 1], [-0.5, -2, -1], [1, 2.5, 1], [2, 5.5, -1]] as const) {
        g.beginPath();
        g.moveTo(X(u0), Y(3));
        g.lineTo(X((u0 + u1) / 2 + w * Math.sin(t * 4) * 0.4), Y(5.5));
        g.lineTo(X(u1), Y(7.5));
        g.strokePath();
      }
      g.fillStyle(e.dark, 1).fillEllipse(x, Y(0), S(9), S(9));
      g.fillStyle(e.col, 1).fillEllipse(x, Y(-0.4), S(8), S(8));
      g.fillStyle(e.light, 0.5).fillEllipse(X(-1.5), Y(-2), S(2.4), S(3.4));
      for (const k of [-1, 0, 1]) {
        g.fillStyle(0x3a7a28, 1).fillEllipse(X(k * 2.6 + sw), Y(-6.5 + Math.abs(k)), S(2.6), S(5));
        g.fillStyle(0x8ad050, 0.9).fillEllipse(X(k * 2.6 + sw), Y(-6.8 + Math.abs(k)), S(1.2), S(3.6));
      }
      eye(-1.4, -0.5, 0.9);
      eye(1.6, -0.5, 0.9);
      g.lineStyle(S(0.4), e.dark, 1).lineBetween(X(-0.8), Y(1.6), X(0.8), Y(1.6));
      break;
    }
    case 'bat': {
      // small and furred, the wings bigger than the rest of it together,
      // finger bones through them, flapping hard
      const flap = Math.sin(t * 12);
      for (const k of [-1, 1]) {
        const tipY = -6 + flap * 4;
        g.fillStyle(e.dark, 0.95).fillTriangle(x + k * S(1.5), Y(-1), x + k * S(10), Y(tipY), x + k * S(8), Y(3 + flap));
        g.fillTriangle(x + k * S(1.5), Y(-1), x + k * S(8), Y(3 + flap), x + k * S(3), Y(3));
        g.lineStyle(S(0.4), e.light, 0.7).lineBetween(x + k * S(1.5), Y(-1), x + k * S(10), Y(tipY));
        g.lineBetween(x + k * S(1.5), Y(-1), x + k * S(6), Y(2 + flap));
      }
      g.fillStyle(e.col, 1).fillEllipse(x, Y(0), S(5), S(6));
      g.fillStyle(e.col, 1).fillTriangle(x - S(2), Y(-2.5), x - S(0.6), Y(-2.5), x - S(1.8), Y(-6));
      g.fillTriangle(x + S(2), Y(-2.5), x + S(0.6), Y(-2.5), x + S(1.8), Y(-6));
      eye(-0.9, -1.2, 0.7);
      eye(0.9, -1.2, 0.7);
      g.fillStyle(0xffffff, 1).fillTriangle(X(-0.4), Y(0.6), X(0.1), Y(0.6), X(-0.15), Y(1.5));
      break;
    }
    case 'slug': {
      // long and low, glistening, lava glowing through cracks in its back,
      // two eye stalks that wave as it goes
      const ripple = Math.sin(t * 3) * 0.5;
      g.fillStyle(e.dark, 1).fillEllipse(X(-1), Y(4.5), S(17), S(5));
      g.fillStyle(e.col, 1).fillEllipse(X(-1), Y(3.6 + ripple * 0.3), S(16), S(5));
      g.fillStyle(e.dark, 1).fillEllipse(X(-3), Y(2.2 + ripple * 0.3), S(9), S(4));
      for (let i = 0; i < 4; i++) g.fillStyle(0xffb060, 0.7 + Math.sin(t * 4 + i) * 0.3).fillRect(X(-6 + i * 2), Y(2), S(0.8), S(0.8));
      g.fillStyle(0xffffff, 0.35).fillEllipse(X(0), Y(2.4), S(8), S(0.8));
      for (const k of [0, 1]) {
        const u = 5.5 + k * 1.4;
        g.lineStyle(S(0.6), e.col, 1).lineBetween(X(u - 0.5), Y(3), X(u + Math.sin(t * 2 + k) * 0.8), Y(-1.5));
        g.fillStyle(EYE, 1).fillCircle(X(u + Math.sin(t * 2 + k) * 0.8), Y(-1.8), S(0.7));
      }
      break;
    }
    case 'ram': {
      // a woolly barrel on four legs, a long face, the horns curled round
      const step = Math.sin(t * 7) * 0.8;
      g.fillStyle(0x3a3a40, 1);
      for (const [u, p] of [[-4.5, step], [-2.5, -step], [2.5, step], [4.5, -step]] as const) g.fillRect(X(u) - S(0.7), Y(2.5), S(1.4), S(5 + p));
      for (const [u, v, r] of [[-4, -0.5, 3], [-1, -1.5, 3.2], [2, -0.5, 3], [-2.5, 1.5, 3], [1.5, 1.5, 2.8]] as const) {
        g.fillStyle(e.dark, 1).fillCircle(X(u), Y(v + 0.3), S(r));
        g.fillStyle(e.light, 1).fillCircle(X(u), Y(v), S(r * 0.9));
      }
      g.fillStyle(0x5a5050, 1).fillEllipse(X(6), Y(-1), S(3.6), S(5));
      g.lineStyle(S(1.2), e.col, 1);
      g.beginPath();
      g.arc(X(5.4), Y(-3), S(2.4), Math.PI * 0.9, Math.PI * 2.4, f < 0);
      g.strokePath();
      g.fillStyle(EYE, 1).fillCircle(X(6.8), Y(-1.8), S(0.6));
      break;
    }
    case 'centipede': {
      // a chain of small plated segments, each with its pair of legs
      // rippling, two long feelers and a pair of mandibles
      const n = 8;
      for (let i = n - 1; i >= 0; i--) {
        const u = -8 + i * 2;
        const v = 3 + Math.sin(t * 6 - i * 0.8) * 1;
        const lg = Math.sin(t * 14 - i) * 0.7;
        g.lineStyle(S(0.4), e.dark, 1);
        g.lineBetween(X(u), Y(v), X(u - 0.6 + lg), Y(v + 3));
        g.lineBetween(X(u), Y(v), X(u + 0.6 - lg), Y(v + 3));
        g.fillStyle(i % 2 ? e.dark : e.col, 1).fillCircle(X(u), Y(v), S(1.7));
        g.fillStyle(e.light, 0.5).fillCircle(X(u - 0.4), Y(v - 0.6), S(0.5));
      }
      const hv = 3 + Math.sin(t * 6 - 8 * 0.8) * 1;
      g.fillStyle(e.col, 1).fillCircle(X(8.4), Y(hv - 0.3), S(2.2));
      g.lineStyle(S(0.4), e.dark, 1).lineBetween(X(9.4), Y(hv - 2), X(11.5), Y(hv - 5 + Math.sin(t * 5)));
      g.lineBetween(X(8.4), Y(hv - 2.2), X(9.5), Y(hv - 5.5 + Math.sin(t * 5 + 1)));
      g.fillStyle(e.dark, 1).fillTriangle(X(10.2), Y(hv), X(11.6), Y(hv + 0.6), X(10.2), Y(hv + 1.3));
      eye(9, hv - 0.8, 0.6);
      break;
    }

    // ===================================================== the ten bosses
    case 'lich': {
      // a hooded robe that hangs in the air, frayed into wisps, a skull's
      // two lights deep in the hood, a lantern of souls on a crooked staff
      const w = bob * 2;
      for (let i = 0; i < 4; i++) {
        g.fillStyle(e.dark, 0.6).fillTriangle(X(-6 + i * 3.4), Y(6 + w), X(-4 + i * 3.4), Y(6 + w), X(-5 + i * 3.4 + Math.sin(t * 4 + i) * 1.5), Y(10 + w));
      }
      g.fillStyle(0x1a1024, 1).fillTriangle(X(-8), Y(7 + w), X(8), Y(7 + w), X(0), Y(-11 + w));
      g.fillStyle(e.dark, 1).fillTriangle(X(-6.5), Y(6 + w), X(6.5), Y(6 + w), X(0), Y(-9.5 + w));
      g.fillStyle(0x0a060e, 1).fillEllipse(X(0.5), Y(-5.5 + w), S(6), S(5));
      g.fillStyle(0x8affc0, 0.9).fillCircle(X(-0.6), Y(-5.6 + w), S(0.8));
      g.fillCircle(X(1.8), Y(-5.6 + w), S(0.8));
      g.lineStyle(S(0.7), 0x5a4030, 1).lineBetween(X(6.5), Y(-9 + w), X(7.5), Y(7 + w));
      g.fillStyle(0x2a2a30, 1).fillRect(X(5.8) - S(1.6), Y(-12 + w), S(3.2), S(4));
      g.fillStyle(0x8affc0, 0.6 + Math.sin(t * 5) * 0.3).fillRect(X(5.8) - S(1), Y(-11.4 + w), S(2), S(2.8));
      g.fillStyle(0x8affc0, 0.18).fillCircle(X(5.8), Y(-10 + w), S(5 + Math.sin(t * 3)));
      break;
    }
    case 'seraph': {
      // six wings in three pairs round a burning core, a broken halo, one
      // great eye in the middle of it all
      const beat = Math.sin(t * 2.5);
      for (const [a, len, al] of [[-0.5, 12, 0.9], [0.15, 11, 0.75], [0.75, 9, 0.6]] as const) {
        for (const k of [-1, 1]) {
          const ang = (a + beat * 0.08) * k;
          const tipx = x + k * S(Math.cos(ang) * len);
          const tipy = Y(-2 + Math.sin(a) * len * 0.8);
          g.fillStyle(0xfff0d0, al).fillTriangle(x + k * S(2), Y(-2), tipx, tipy, x + k * S(4), Y(1.5));
          g.lineStyle(S(0.3), e.col, al).lineBetween(x + k * S(2), Y(-2), tipx, tipy);
        }
      }
      g.lineStyle(S(0.9), 0xffd060, 0.9).strokeEllipse(x, Y(-9 + bob * 0.5), S(10), S(3));
      g.fillStyle(e.dark, 1).fillCircle(x, Y(-1 + bob * 0.5), S(4.6));
      g.fillStyle(e.col, 1).fillCircle(x, Y(-1 + bob * 0.5), S(3.9));
      g.fillStyle(0xffffff, 1).fillEllipse(x, Y(-1 + bob * 0.5), S(4.4), S(2.6));
      g.fillStyle(0xff6a20, 1).fillCircle(X(0.5), Y(-1 + bob * 0.5), S(1.2));
      g.fillStyle(EYE, 1).fillCircle(X(0.6), Y(-1 + bob * 0.5), S(0.5));
      for (let i = 0; i < 3; i++) g.fillStyle(0xffb060, 0.7).fillTriangle(X(-1 + i), Y(3.5), X(i), Y(3.5), X(-0.5 + i + Math.sin(t * 8 + i) * 0.5), Y(7 + Math.sin(t * 6 + i)));
      break;
    }
    case 'hydra': {
      // a heavy body low in the water, a stub of tail, and three necks each
      // swaying on its own, each with its own head
      g.fillStyle(e.dark, 1).fillEllipse(X(-2), Y(3.5), S(16), S(8));
      g.fillStyle(e.col, 1).fillEllipse(X(-2), Y(3), S(15), S(7));
      g.fillStyle(e.dark, 1).fillTriangle(X(-9), Y(2), X(-14), Y(5 + Math.sin(t * 3)), X(-9), Y(4.5));
      // (each neck leans its own way -- back, up, forward -- so all three
      // heads stand clear of each other)
      for (const [k, ph] of [[-1, 0], [0, 2.1], [1, 4.2]] as const) {
        const base = 1 + k * 3;
        const lean = 0.5 + k * 1.1;
        const rise = 2.1 - Math.abs(k) * 0.35;
        const sway = Math.sin(t * 2 + ph) * 1.2;
        let px = base;
        let py = 0;
        for (let i = 1; i <= 5; i++) {
          const nx = base + i * lean + sway * (i / 5);
          const ny = -i * rise;
          g.fillStyle(i % 2 ? e.col : e.dark, 1).fillCircle(X(nx), Y(ny), S(1.5));
          px = nx;
          py = ny;
        }
        g.fillStyle(e.dark, 1).fillEllipse(X(px + 1.4), Y(py - 0.6), S(4), S(2.6));
        g.fillStyle(e.light, 1).fillTriangle(X(px + 3), Y(py - 0.6), X(px + 4.4), Y(py - 0.2), X(px + 3), Y(py + 0.4));
        g.fillStyle(0xffe060, 1).fillCircle(X(px + 1.4), Y(py - 1.2), S(0.5));
      }
      break;
    }
    case 'queen': {
      // a clockwork spider-queen: a huge brass abdomen with a turning gear
      // in it, a narrow waist, a crowned head, eight long legs
      g.fillStyle(0x6a4a1a, 1).fillEllipse(X(-5), Y(0), S(13), S(11));
      g.fillStyle(0xc8962a, 1).fillEllipse(X(-5.2), Y(-0.4), S(12), S(10));
      const rot = t * 1.5;
      for (let i = 0; i < 8; i++) {
        const a = rot + (i / 8) * Math.PI * 2;
        g.fillStyle(0x8a6a2a, 1).fillCircle(X(-5 + Math.cos(a) * 3.2), Y(-0.4 + Math.sin(a) * 3.2), S(0.8));
      }
      g.fillStyle(e.col, 0.8 + Math.sin(t * 6) * 0.2).fillCircle(X(-5), Y(-0.4), S(2));
      // (the legs over the abdomen, so the far side's show too)
      for (let i = 0; i < 4; i++) {
        const st = Math.sin(t * 5 + i * 1.6) * 0.8;
        for (const k of [-1, 1]) {
          const u0 = 1 + i * 0.7;
          g.lineStyle(S(0.9), 0x8a6a2a, 1);
          g.lineBetween(X(u0), Y(0), X(u0 + k * (3 + i)), Y(-6 + i - st));
          g.lineBetween(X(u0 + k * (3 + i)), Y(-6 + i - st), X(u0 + k * (6 + i * 1.6)), Y(7));
        }
      }
      g.fillStyle(0x8a6a2a, 1).fillCircle(X(4), Y(-1), S(3));
      for (let i = -1; i <= 1; i++) g.fillStyle(0xffd060, 1).fillTriangle(X(4 + i * 1.5 - 0.6), Y(-3.6), X(4 + i * 1.5 + 0.6), Y(-3.6), X(4 + i * 1.5), Y(-6));
      for (const [u, v] of [[5, -1.4], [5.8, -0.4]] as const) g.fillStyle(0x6affff, 1).fillCircle(X(u), Y(v), S(0.6));
      break;
    }
    case 'maw': {
      // a flytrap the size of a cart: two jaws on a thick stem, opening and
      // snapping shut, rows of teeth, leaves at its foot
      const open = (Math.sin(t * 2) + 1) / 2;
      for (const k of [-1, 1]) {
        g.fillStyle(0x2e6a1e, 1).fillEllipse(X(k * 6), Y(6), S(9), S(3));
        g.fillStyle(0x5aa83a, 1).fillEllipse(X(k * 6), Y(5.6), S(7), S(1.8));
      }
      g.fillStyle(0x3a5a1e, 1).fillRect(x - S(1.5), Y(-2), S(3), S(8));
      const jaw = (dir: number) => {
        const a = -dir * (0.25 + open * 0.55);
        const cx = X(2);
        const cy = Y(-4);
        g.fillStyle(e.dark, 1).slice(cx, cy, S(7), Math.PI + a - 1.3, Math.PI + a + 1.3, false).fillPath();
        g.fillStyle(0xc84a5a, 1).slice(cx, cy, S(5.6), Math.PI + a - 1.1, Math.PI + a + 1.1, false).fillPath();
        for (let i = -2; i <= 2; i++) {
          const ang = Math.PI + a + i * 0.45;
          g.fillStyle(0xf8f0d8, 1).fillCircle(cx + Math.cos(ang) * S(5.6) * f, cy + Math.sin(ang) * S(5.6), S(0.6));
        }
      };
      jaw(1);
      jaw(-1);
      g.fillStyle(0xffe060, 0.6).fillCircle(X(-2), Y(-4), S(1));
      break;
    }
    case 'cloud': {
      // a storm with one eye: a heap of grey cloud boiling, the eye open in
      // the middle of it, rain under it and a fork of light now and then
      const boil = t * 2;
      for (const [u, v, r] of [[-6, 0, 4.5], [-2, -2.5, 5], [3, -2, 5.2], [6.5, 0.5, 4], [0, 1.5, 5.5]] as const) {
        g.fillStyle(0x2a2a3a, 1).fillCircle(X(u), Y(v + Math.sin(boil + u) * 0.4 + 0.6), S(r));
        g.fillStyle(0x5a5a72, 1).fillCircle(X(u), Y(v + Math.sin(boil + u) * 0.4), S(r * 0.9));
      }
      g.fillStyle(0xf8f8ff, 1).fillEllipse(x, Y(-0.5), S(5.5), S(3.4));
      g.fillStyle(e.col, 1).fillCircle(X(0.6), Y(-0.5), S(1.4));
      g.fillStyle(EYE, 1).fillCircle(X(0.8), Y(-0.5), S(0.6));
      for (let i = -3; i <= 3; i++) {
        const d = ((t * 3 + i * 0.37) % 1) * 4;
        g.lineStyle(S(0.3), 0x9ad0ff, 0.6).lineBetween(X(i * 1.6), Y(5 + d), X(i * 1.6 - 0.4), Y(6.2 + d));
      }
      if (Math.sin(t * 9) > 0.75) {
        g.lineStyle(S(0.6), 0xfff4a0, 1);
        g.lineBetween(X(2), Y(4), X(3), Y(7));
        g.lineBetween(X(3), Y(7), X(1.8), Y(8));
        g.lineBetween(X(1.8), Y(8), X(3.2), Y(11));
      }
      break;
    }
    case 'wyrm': {
      // a wyrm swimming in stone: coils arching up out of the ground and
      // back down into it, a horned, frilled head reared up at the front
      for (const [u, r, ph] of [[-8, 3.2, 0], [-3, 3.8, 1.2]] as const) {
        const up = Math.sin(t * 2 + ph) * 0.8;
        g.fillStyle(e.dark, 1).slice(X(u), Y(5), S(r + 1), Math.PI, 0, false).fillPath();
        g.fillStyle(e.col, 1).slice(X(u), Y(5 - up), S(r), Math.PI, 0, false).fillPath();
        g.fillStyle(0x2a221a, 1).fillEllipse(X(u), Y(5.4), S(r * 2.6), S(1.6));
      }
      for (let i = 0; i < 4; i++) g.fillStyle(i % 2 ? e.col : e.dark, 1).fillCircle(X(2 + i * 0.9), Y(4 - i * 2.2), S(2.4 - i * 0.15));
      g.fillStyle(0x2a221a, 1).fillEllipse(X(2), Y(5.4), S(7), S(1.6));
      const hx = 5.5;
      const hy = -5;
      g.fillStyle(e.dark, 1).fillTriangle(X(hx - 2), Y(hy), X(hx - 4.5), Y(hy - 3 + Math.sin(t * 3)), X(hx - 1), Y(hy - 2));
      g.fillStyle(e.col, 1).fillEllipse(X(hx), Y(hy), S(6), S(4));
      g.fillStyle(e.light, 1).fillTriangle(X(hx + 2.5), Y(hy - 0.5), X(hx + 5), Y(hy + 0.4), X(hx + 2.5), Y(hy + 1.4));
      g.fillStyle(0xd8d0c0, 1).fillTriangle(X(hx - 1), Y(hy - 1.6), X(hx + 0.2), Y(hy - 1.8), X(hx - 1.4), Y(hy - 5));
      g.fillStyle(0xff6a20, 1).fillCircle(X(hx + 1), Y(hy - 0.8), S(0.6));
      break;
    }
    case 'sphinx': {
      // a lion on four great paws, wings folded high, a tail with a tuft --
      // and for a face, a mask of mirror glass that catches the light
      const step = Math.sin(t * 5) * 0.6;
      g.fillStyle(e.dark, 1);
      for (const [u, p] of [[-5, step], [-3, -step], [3.5, step], [5.5, -step]] as const) g.fillRect(X(u) - S(1), Y(3), S(2), S(4.5 + p));
      g.fillStyle(0xc8a050, 1).fillEllipse(X(0), Y(1.5), S(15), S(7));
      g.fillStyle(0xe8c070, 1).fillEllipse(X(0), Y(0.8), S(13), S(5));
      for (const k of [0, 1]) g.fillStyle(k ? 0xfff0d0 : 0xd8c8a0, 0.9).fillTriangle(X(-3 + k * 2), Y(-1), X(-8 + k * 3), Y(-10 + k * 1.5 + Math.sin(t * 2) * 0.6), X(1 + k * 2), Y(-2));
      g.lineStyle(S(0.7), 0xc8a050, 1).lineBetween(X(-7), Y(1), X(-10), Y(-3 + Math.sin(t * 3)));
      g.fillStyle(0x6a4a1a, 1).fillCircle(X(-10), Y(-3 + Math.sin(t * 3)), S(1));
      g.fillStyle(0x8a6a2a, 1).fillCircle(X(6.5), Y(-2.5), S(4.2));
      g.fillStyle(0xd8e8f0, 1).fillEllipse(X(7.4), Y(-2.5), S(4.4), S(5));
      g.fillStyle(0xffffff, 0.8 + Math.sin(t * 4) * 0.2).fillTriangle(X(6), Y(-4.5), X(7), Y(-4.8), X(6.2), Y(-1.6));
      g.fillStyle(0x3a4a5a, 1).fillRect(X(7.6) - S(0.4), Y(-3), S(0.8), S(0.8));
      g.fillRect(X(8.8) - S(0.4), Y(-3), S(0.8), S(0.8));
      break;
    }
    case 'kraken': {
      // a domed head with two huge eyes, and eight arms curling out round it
      // across the ground, each with its own slow curl
      for (let i = 0; i < 8; i++) {
        const a = Math.PI * 0.05 + (i / 7) * Math.PI * 0.9;
        const curl = Math.sin(t * 2 + i) * 0.6;
        g.lineStyle(S(1.6 - (i % 2) * 0.3), e.dark, 1);
        g.beginPath();
        g.moveTo(X(Math.cos(a) * 3), Y(3));
        for (let k = 1; k <= 5; k++) {
          const r = 3 + k * 1.9;
          g.lineTo(X(Math.cos(a + curl * k * 0.12) * r), Y(3 + Math.sin(a + curl * k * 0.1) * r * 0.45));
        }
        g.strokePath();
      }
      g.fillStyle(e.dark, 1).fillEllipse(x, Y(-1.5), S(11), S(12));
      g.fillStyle(e.col, 1).fillEllipse(x, Y(-2), S(10), S(11));
      g.fillStyle(e.light, 0.4).fillEllipse(X(-2), Y(-5), S(3), S(4));
      eye(-2, 0.5, 1.6);
      eye(2.2, 0.5, 1.6);
      break;
    }
    case 'mammoth': {
      // a wall of shaggy hair on four pillar legs, a trunk that swings, two
      // long tusks curving up and out, a small ear, a domed head
      const sw = Math.sin(t * 2) * 0.8;
      g.fillStyle(0x3a2a1e, 1);
      for (const u of [-6, -3, 2.5, 5.5]) g.fillRect(X(u) - S(1.3), Y(3), S(2.6), S(4.5));
      g.fillStyle(0x4a3424, 1).fillEllipse(X(-1), Y(0), S(17), S(11));
      g.fillStyle(0x6a4a30, 1).fillEllipse(X(-1), Y(-0.6), S(16), S(9.6));
      for (let i = 0; i < 9; i++) g.lineStyle(S(0.4), 0x3a2a1e, 0.8).lineBetween(X(-8 + i * 2), Y(2.6), X(-8.6 + i * 2), Y(5));
      g.fillStyle(e.light, 0.5).fillEllipse(X(-3), Y(-4), S(8), S(2));
      g.fillStyle(0x5a3e28, 1).fillCircle(X(7), Y(-3), S(3.6));
      g.fillStyle(0x4a3424, 1).fillEllipse(X(5), Y(-3), S(2.4), S(4));
      g.lineStyle(S(1.3), 0x5a3e28, 1);
      g.beginPath();
      g.moveTo(X(9), Y(-2));
      g.lineTo(X(10 + sw * 0.4), Y(2));
      g.lineTo(X(9.4 + sw), Y(5));
      g.strokePath();
      g.lineStyle(S(0.9), 0xf0ead8, 1);
      g.beginPath();
      g.moveTo(X(8.5), Y(-0.5));
      g.lineTo(X(11.5), Y(1.5));
      g.lineTo(X(13), Y(-1.5));
      g.strokePath();
      g.fillStyle(EYE, 1).fillCircle(X(8), Y(-3.8), S(0.6));
      break;
    }
  }

  // ---- AND THEN WHAT IT IS MADE OF.
  //
  // The body is the animal; this is the element growing out of it, and it
  // changes the SHAPE -- a crest of flame, a fin, a back of ice spines, a
  // pair of bolt horns, leaves, plates, swept feathers, tendrils, a halo.
  // Without it a Cindermole and a Rimemole were one mole in two colours.
  // (a boss is its own thing all through: nothing grown on it)
  if (!BOSS_BODIES.includes(c.body as BossBody)) mark(g, c, x, y, s, f, t, e);
}

const BOSS_BODIES: BossBody[] = ['lich', 'seraph', 'hydra', 'queen', 'maw', 'cloud', 'wyrm', 'sphinx', 'kraken', 'mammoth'];

type Pal = { col: number; dark: number; light: number };

/** Where the element shows on each body: roughly the top of its back. */
function backOf(body: Body | BossBody): { u: number; v: number; k: number } {
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
    case 'jelly': return { u: 0, v: -5.5, k: 0.9 };
    case 'mantis': return { u: -4, v: -1.5, k: 0.8 };
    case 'spider': return { u: -2, v: -4.5, k: 0.9 };
    case 'roller': return { u: 0, v: -2.5, k: 1 };
    case 'sprout': return { u: 0, v: -4, k: 0.8 };
    case 'bat': return { u: 0, v: -3, k: 0.7 };
    case 'slug': return { u: -3, v: 0.5, k: 0.9 };
    case 'ram': return { u: -1, v: -4.5, k: 1 };
    // (on its head: the front of the chain)
    case 'centipede': return { u: 8.4, v: 0.5, k: 0.7 };
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
