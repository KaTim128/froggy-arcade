/**
 * ---- DRAWING A CREATURE.  Every body in the game (art/creatureBodies) is
 * one seamless silhouette from art/sdf: one outline, light that flows over
 * the joins, details that only ever sit on the body.  This draws it -- in
 * its element's colours, at a scale, facing either way, at a moment of its
 * idle -- with the shadow under it, a boss's ring of weather, and the odd
 * bit of weather that is not body (a storm's rain, a lantern's glow).
 *
 * The pixels are cached by animation frame (twelve a second), so drawing
 * the same creature again in the same frame, or a screen of them, is cheap.
 */

import Phaser from 'phaser';
import { ELEMENTS, type Body, type BossBody, type Element } from '../game/creatures';
import { BODY_DEFS } from './creatureBodies';
import { organic, raster, type Mat, type Raster } from './sdf';

export interface Drawable {
  element: Element;
  body: Body | BossBody;
}

const BOSS_BODIES: BossBody[] = ['lich', 'seraph', 'hydra', 'queen', 'maw', 'cloud', 'wyrm', 'sphinx', 'kraken', 'mammoth'];
const FPS = 12;

/** What each body is covered in (art/sdf surface). */
export const MATERIAL: Partial<Record<Body | BossBody, Mat>> = {};
const put = (m: Mat, ...bodies: (Body | BossBody)[]) => bodies.forEach((b) => (MATERIAL[b] = m));
put('fur', 'mole', 'hound', 'ferret', 'fox', 'lynx', 'bear', 'sloth', 'hare', 'boar', 'ram', 'stag', 'yeti', 'hedgehog', 'otter', 'badger', 'ermine', 'mouse', 'possum', 'walrus', 'zebra', 'camel', 'koala', 'beaver', 'moose', 'lemur', 'goat', 'squirrel', 'raccoon', 'skunk', 'porcupine', 'bat', 'moth', 'rhino', 'sphinx', 'mammoth');
put('scale', 'serpent', 'gecko', 'newt', 'salamander', 'crocodile', 'shark', 'puffer', 'angler', 'eel', 'seahorse', 'ray', 'pangolin', 'narwhal', 'hydra', 'wyrm');
put('feather', 'owl', 'heron', 'falcon', 'crow', 'penguin', 'chick', 'parrot', 'flamingo', 'swan', 'vulture', 'peacock', 'seraph');
put('shell', 'crab', 'beetle', 'scorpion', 'centipede', 'mantis', 'spider', 'golem', 'obelisk', 'lobster', 'cricket', 'ladybug', 'wasp', 'bee', 'firefly', 'dragonfly', 'urchin', 'armadillo', 'tortoise', 'starfish', 'roller', 'snail', 'lich', 'queen');
put('skin', 'toad', 'slug', 'jelly', 'octopus', 'leech', 'worm', 'caterpillar', 'axolotl', 'shroom', 'sprout', 'maw', 'kraken');
const cache = new Map<string, Raster>();
const CACHE_MAX = 600;

/** How wide the shadow under it is, in units. */
const WIDE: Partial<Record<Body | BossBody, number>> = {
  crab: 15, ray: 15, slug: 17, centipede: 18, spider: 16, bat: 8, hydra: 20, queen: 20, kraken: 22, mammoth: 20, wyrm: 20, seraph: 14, cloud: 18, maw: 16, lich: 12, sphinx: 18,
  newt: 16, eel: 16, gecko: 16, ferret: 16, rhino: 16, bear: 16, urchin: 14, tortoise: 16, boar: 15, falcon: 10, firefly: 10, bee: 10,
};

export function drawCreature(g: Phaser.GameObjects.Graphics, c: Drawable, x: number, y: number, s = 1, f = 1, t = 0): void {
  const e = ELEMENTS[c.element];
  const boss = BOSS_BODIES.includes(c.body as BossBody);
  // a soft shadow under everything, and a boss stands in its own weather
  g.fillStyle(0x000000, 0.25).fillEllipse(x, y + 7.5 * s, (WIDE[c.body] ?? 12) * s, 3 * s);
  if (boss) g.lineStyle(0.6 * s, e.light, 0.35 + Math.sin(t * 2.5) * 0.15).strokeEllipse(x, y + 6.5 * s, (24 + Math.sin(t * 2) * 1.5) * s, 8 * s);
  const def = BODY_DEFS[c.body];
  if (!def) return;
  const fr = Math.floor(t * FPS);
  const fs = f < 0 ? -1 : 1;
  const key = `${c.body}|${c.element}|${Math.round(s * 100)}|${fs}|${fr}`;
  let r = cache.get(key);
  if (!r) {
    r = raster(organic(def(fr / FPS)), s, fs, e, MATERIAL[c.body]);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(key, r);
  }
  const ox = Math.round(x);
  const oy = Math.round(y);
  r.cols.forEach((col, i) => {
    g.fillStyle(col, 1);
    const runs = r!.runs[i];
    for (let k = 0; k < runs.length; k += 3) g.fillRect(ox + runs[k], oy + runs[k + 1], runs[k + 2], 1);
  });
  weather(g, c.body, x, y, s, fs, t);
}

/** What is around a body without being body: rain, a lightning fork, a lantern's light. */
function weather(g: Phaser.GameObjects.Graphics, body: Body | BossBody, x: number, y: number, s: number, f: number, t: number): void {
  const X = (u: number) => x + u * s * f;
  const Y = (v: number) => y + v * s;
  if (body === 'cloud') {
    for (let i = -3; i <= 3; i++) {
      const d = ((t * 3 + i * 0.37) % 1) * 4;
      g.lineStyle(0.6 * s, 0x9ad0ff, 0.6).lineBetween(X(i * 1.6), Y(5.5 + d), X(i * 1.6 - 0.4), Y(6.7 + d));
    }
    if (Math.sin(t * 9) > 0.75) {
      g.lineStyle(0.8 * s, 0xfff4a0, 1);
      g.lineBetween(X(2), Y(5), X(3), Y(7)).lineBetween(X(3), Y(7), X(1.8), Y(8)).lineBetween(X(1.8), Y(8), X(3.2), Y(11));
    }
  } else if (body === 'lich') {
    const w = Math.sin(t * 4) * 1.2;
    g.fillStyle(0x8affc0, 0.16).fillCircle(X(5.9), Y(-11.6 + w), (5 + Math.sin(t * 3)) * s);
  } else if (body === 'firefly' || body === 'angler') {
    const [u, v] = body === 'firefly' ? [-3.4, 0.6 + Math.sin(t * 3) * 0.8] : [7.6, -7.2];
    g.fillStyle(0xfff4a0, 0.14 + Math.sin(t * 5) * 0.05).fillCircle(X(u), Y(v), 5 * s);
  }
}
