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
  g.fillStyle(0x000000, 0.25).fillEllipse(x, Y(7.5), S(c.body === 'crab' || c.body === 'ray' ? 15 : 12), S(3));

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
}
