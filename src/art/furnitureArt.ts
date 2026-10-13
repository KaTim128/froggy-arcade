/**
 * Furniture, drawn in the drifter's way: flat pixel blocks, two colours and
 * a darker edge, a one-pixel black outline.  One function per category, all
 * drawn standing on (`x`, `y`) = the middle of the item's base -- so the shop
 * preview and the condo floor use exactly the same drawing.
 */

import Phaser from 'phaser';
import type { FurnitureDef } from '../game/catalog';

const OUT = 0x14100c;

const shade = (c: number, k: number): number => {
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 255) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((c >> 8) & 255) * k)));
  const b = Math.min(255, Math.max(0, Math.round((c & 255) * k)));
  return (r << 16) | (g << 8) | b;
};

/** A box with its outline and a lit top edge. */
function block(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, col: number): void {
  g.fillStyle(OUT, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(col, 1).fillRect(x, y, w, h);
  g.fillStyle(shade(col, 1.18), 1).fillRect(x, y, w, 1);
  g.fillStyle(shade(col, 0.75), 1).fillRect(x, y + h - 1, w, 1);
}

/** Draw `f` standing on (x, y).  `scale` for previews. */
export function drawFurniture(g: Phaser.GameObjects.Graphics, f: FurnitureDef, x: number, y: number, flip = false): void {
  const { w, h, a, b } = f;
  const L = Math.round(x - w / 2);
  const T = Math.round(y - h);
  const fx = (dx: number, ww = 1) => (flip ? L + w - dx - ww : L + dx);
  switch (f.cat) {
    case 'poster':
    case 'painting': {
      // a frame and a picture: two bands of colour and a shape in the middle
      block(g, L, T, w, h, f.cat === 'painting' ? 0x6a4a28 : 0xe8e0c8);
      g.fillStyle(a, 1).fillRect(L + 2, T + 2, w - 4, h - 4);
      g.fillStyle(b, 1).fillRect(L + 2, T + Math.floor(h / 2), w - 4, Math.ceil(h / 2) - 2);
      g.fillStyle(shade(b, 1.3), 1).fillCircle(L + w / 2, T + h / 2 - 1, Math.max(2, Math.min(w, h) / 6));
      break;
    }
    case 'table': {
      block(g, L, T, w, 3, a);
      g.fillStyle(OUT, 1).fillRect(L + 1, T + 3, 3, h - 3).fillRect(L + w - 4, T + 3, 3, h - 3);
      g.fillStyle(b, 1).fillRect(L + 2, T + 3, 1, h - 3).fillRect(L + w - 3, T + 3, 1, h - 3);
      break;
    }
    case 'chair': {
      // back, seat, legs
      block(g, fx(0, 3), T, 3, h - 4, b);
      block(g, L, y - 7, w, 3, a);
      g.fillStyle(OUT, 1).fillRect(L, y - 4, 2, 4).fillRect(L + w - 2, y - 4, 2, 4);
      break;
    }
    case 'sofa': {
      block(g, L, T, w, h - 6, b);
      block(g, L + 2, y - 9, w - 4, 5, a);
      block(g, L, y - 11, 4, 8, a);
      block(g, L + w - 4, y - 11, 4, 8, a);
      g.fillStyle(OUT, 1).fillRect(L + 1, y - 3, 2, 3).fillRect(L + w - 3, y - 3, 2, 3);
      break;
    }
    case 'tv': {
      block(g, L, T, w, h - 4, a);
      g.fillStyle(b, 1).fillRect(L + 2, T + 2, w - 4, h - 8);
      g.fillStyle(shade(b, 1.4), 0.6).fillRect(L + 3, T + 3, Math.max(1, (w - 6) / 3), 1);
      g.fillStyle(OUT, 1).fillRect(L + w / 2 - 2, y - 4, 4, 4);
      break;
    }
    case 'radio': {
      block(g, L, T, w, h, a);
      g.fillStyle(b, 1).fillRect(fx(2, Math.floor(w / 2)), T + 2, Math.floor(w / 2), h - 4);
      g.fillStyle(OUT, 1).fillCircle(fx(w - 4), T + h / 2, 1.5);
      break;
    }
    case 'lamp': {
      g.fillStyle(OUT, 1).fillRect(x - 1, T + 6, 2, h - 6);
      block(g, L, T, w, 7, a);
      g.fillStyle(a, 0.18).fillCircle(x, T + 4, w + 6);
      block(g, x - 4, y - 2, 8, 2, b);
      break;
    }
    case 'rug': {
      g.fillStyle(OUT, 1).fillEllipse(x, y - h / 2, w + 2, h + 2);
      g.fillStyle(a, 1).fillEllipse(x, y - h / 2, w, h);
      g.fillStyle(b, 1).fillEllipse(x, y - h / 2, w * 0.6, h * 0.55);
      break;
    }
    case 'storage': {
      block(g, L, T, w, h, a);
      const rows = Math.max(2, Math.floor(h / 8));
      for (let i = 1; i < rows; i++) g.fillStyle(OUT, 1).fillRect(L + 1, T + Math.round((i * h) / rows), w - 2, 1);
      g.fillStyle(b, 1);
      for (let i = 0; i < rows; i++) g.fillRect(L + 2, T + Math.round((i * h) / rows) + 2, w - 4, Math.max(1, Math.round(h / rows) - 4));
      break;
    }
    case 'bed': {
      block(g, L, y - h, w, h, a);
      block(g, L + 1, y - h + 1, w - 2, Math.max(2, h - 4), b);
      block(g, fx(1, 9), y - h, 9, Math.max(3, h - 3), 0xf0ece0);
      break;
    }
    case 'decor':
    default: {
      if (f.id === 'fur_clock') {
        g.fillStyle(OUT, 1).fillCircle(x, T + h / 2, w / 2 + 1);
        g.fillStyle(a, 1).fillCircle(x, T + h / 2, w / 2);
        g.fillStyle(b, 1).fillRect(x, T + 2, 1, h / 2 - 2).fillRect(x, T + h / 2, 3, 1);
        break;
      }
      // a pot and what grows / stands in it
      block(g, x - w / 2 + 2, y - 6, w - 4, 6, b);
      g.fillStyle(OUT, 1).fillEllipse(x, T + (h - 6) / 2, w + 2, h - 4);
      g.fillStyle(a, 1).fillEllipse(x, T + (h - 6) / 2, w, h - 6);
      g.fillStyle(shade(a, 1.3), 1).fillEllipse(x - 2, T + (h - 6) / 2 - 2, w / 3, (h - 6) / 3);
    }
  }
}
