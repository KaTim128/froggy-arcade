/**
 * PEOPLE GOING PAST.  The drifter's own rig (see art/player), recoloured into
 * ordinary clothes and given somewhere to be: each walks the length of the
 * pavement at their own pace and turns up again a while later from one end
 * or the other.  They do not stop for anybody, which is the point.
 */

import Phaser from 'phaser';
import { Player, type Look } from './player';

const COATS = [
  [0x3a5a8a, 0x4a6ea0, 0x2a4068],
  [0x8a3a3a, 0xa04848, 0x6a2828],
  [0x4a6a4a, 0x5a7e5a, 0x344c34],
  [0xc8b070, 0xd8c080, 0xa08a50],
  [0x5a4a6a, 0x6e5e80, 0x40344e],
  [0x2a2a2a, 0x3a3a3a, 0x1a1a1a],
  [0xe8e0d0, 0xf4ece0, 0xc0b8a8],
];
const LEGS = [[0x2a3a5a, 0x1e2a44], [0x3a3a3a, 0x2a2a2a], [0x8a7850, 0x6a5a3a], [0x5a3a2a, 0x442a1e]];
const SKIN = [[0xd8b088, 0xb08a68], [0xa87a58, 0x86603e], [0x6a4a30, 0x4e3420], [0xe8c8a8, 0xc8a080]];
const HAIR = [0x1e1814, 0x5a4a3a, 0xd8b060, 0x8a3a1e, 0x9a9a9a];
const HAT = [[0x2a4a8a, 0x3a5aa0], [0xc83a3a, 0xd84a4a], [0x2a2a2a, 0x3a3a3a]];

/** Bare-headed, clean-shaven: hair and a face. */
const HEAD = ['............', '...rrrrrr...', '..rrrrrrrr..', '..rSSSSSSr..', '..rSSSSSSs..', '...SSSSSs...', '...SSSSSs...', '....SSSs....', '.....ss.....'];

const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export function randomLook(): Look {
  const coat = pick(COATS);
  const legs = pick(LEGS);
  const skin = pick(SKIN);
  const hat = Math.random() < 0.35 ? pick(HAT) : null;
  const scarf = Math.random() < 0.4 ? pick(COATS)[0] : coat[1];
  return {
    head: hat ? undefined : HEAD,
    cols: {
      B: hat?.[0] ?? 0,
      b: hat?.[1] ?? 0,
      r: pick(HAIR),
      S: skin[0],
      s: skin[1],
      G: skin[0],
      g: skin[1],
      C: coat[0],
      c: coat[1],
      D: coat[2],
      P: coat[0],
      w: scarf,
      J: legs[0],
      j: legs[1],
      K: pick([0x1a1410, 0x3a2a1e, 0xe8e8e8]),
      W: 0x2a2420,
      T: 0x1a1410,
    },
  };
}

interface Walker {
  p: Player;
  dir: number;
  speed: number;
  wait: number;
}

export class Pedestrians {
  private walkers: Walker[] = [];
  private bounds: Phaser.Geom.Rectangle;

  constructor(private scene: Phaser.Scene, private worldW: number, private y: number, count: number, private night = false) {
    this.bounds = new Phaser.Geom.Rectangle(-30, y - 6, worldW + 60, 6);
    for (let i = 0; i < count; i++) this.walkers.push(this.spawn(Math.random() * worldW, i * 3 + 1));
  }

  private spawn(x: number, wait = 0): Walker {
    const p = new Player(this.scene, x, this.y - Math.random() * 5, this.night, randomLook());
    p.sprite.setAlpha(wait > 0 ? 0 : 1);
    return { p, dir: Math.random() < 0.5 ? -1 : 1, speed: 0.55 + Math.random() * 0.35, wait };
  }

  update(delta: number): void {
    for (const w of this.walkers) {
      if (w.wait > 0) {
        w.wait -= delta / 1000;
        if (w.wait <= 0) {
          // in from whichever end they are walking from
          w.p.setPosition(w.dir > 0 ? -16 : this.worldW + 16, w.p.y);
          w.p.sprite.setAlpha(1);
        }
        continue;
      }
      // (slower than a player: they are not in a hurry)
      w.p.move(w.dir * w.speed, 0, delta * w.speed, this.bounds);
      if ((w.dir > 0 && w.p.x > this.worldW + 14) || (w.dir < 0 && w.p.x < -14)) {
        w.p.sprite.setAlpha(0);
        w.wait = 4 + Math.random() * 10;
        w.dir = Math.random() < 0.5 ? -1 : 1;
      }
    }
  }
}
