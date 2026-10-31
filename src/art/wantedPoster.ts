/**
 * ---- WANTED.  A police notice pasted to the arcade's wall: the player's
 * own face on it, drawn from what they are wearing (art/player
 * `playerLook`), twice size, in a sepia print gone a little soft -- WANTED
 * over it in red, and the line the police put under it.
 */

import { nightify } from '../render/palette';
import Phaser from 'phaser';
import { paintFigure, playerLook, type Look } from './player';

export const POSTER_W = 30;
export const POSTER_H = 35;

/** The poster, its top-left at (x, y), on the wall. */
export function paintWantedPoster(scene: Phaser.Scene, x: number, y: number, depth = 40, look: Look = playerLook(), night = false): Phaser.GameObjects.Container {
  const key = `wanted_poster_${hash(JSON.stringify(look))}${night ? '_night' : ''}`;
  if (!scene.textures.exists(key)) {
    const t = scene.textures.createCanvas(key, POSTER_W, POSTER_H);
    if (t) {
      const g = t.getContext();
      // the paper, a shade darker at the edges where the paste has soaked in
      g.fillStyle = '#2a2018';
      g.fillRect(0, 0, POSTER_W, POSTER_H);
      g.fillStyle = '#e6d8b0';
      g.fillRect(1, 1, POSTER_W - 2, POSTER_H - 2);
      g.fillStyle = 'rgba(120,90,40,0.18)';
      g.fillRect(1, 1, POSTER_W - 2, 2);
      g.fillRect(1, POSTER_H - 3, POSTER_W - 2, 2);
      g.fillRect(1, 1, 2, POSTER_H - 2);
      g.fillRect(POSTER_W - 3, 1, 2, POSTER_H - 2);
      // the photograph: you, head and shoulders, in a frame
      const px = 4;
      const py = 8;
      const pw = POSTER_W - 8;
      const ph = 19;
      g.fillStyle = '#2a2018';
      g.fillRect(px - 1, py - 1, pw + 2, ph + 2);
      g.fillStyle = '#b8a888';
      g.fillRect(px, py, pw, ph);
      g.save();
      g.beginPath();
      g.rect(px, py, pw, ph);
      g.clip();
      // (scale 2: the head's nine rows and the collar fill the frame)
      paintFigure(g, look, POSTER_W / 2, py + 25 * 2 - 1, { scale: 2 });
      // printed in sepia, and a coarse screen over it
      g.globalCompositeOperation = 'color';
      g.fillStyle = '#8a6a3a';
      g.fillRect(px, py, pw, ph);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(230,216,176,0.22)';
      for (let yy = py; yy < py + ph; yy += 2) g.fillRect(px, yy, pw, 1);
      g.restore();
      // tape at the top corners, and a corner coming away
      g.fillStyle = 'rgba(240,236,220,0.8)';
      g.fillRect(2, 0, 6, 3);
      g.fillRect(POSTER_W - 8, 0, 6, 3);
      g.fillStyle = '#c8b890';
      g.beginPath();
      g.moveTo(POSTER_W - 1, POSTER_H - 7);
      g.lineTo(POSTER_W - 7, POSTER_H - 1);
      g.lineTo(POSTER_W - 1, POSTER_H - 1);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(POSTER_W - 2, POSTER_H - 7, 1, 6);
      // the words, in small print that fits the sheet: WANTED in red, REWARD under
      tiny(g, 'WANTED', POSTER_W / 2, 2, '#b02020');
      tiny(g, 'REWARD', POSTER_W / 2, POSTER_H - 7, '#3a2a18');
      // at night: every pixel through the same nightify the street is painted with
      if (night) {
        const im = g.getImageData(0, 0, POSTER_W, POSTER_H);
        const d = im.data;
        for (let i = 0; i < d.length; i += 4) {
          const c = nightify((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
          d[i] = (c >> 16) & 0xff;
          d[i + 1] = (c >> 8) & 0xff;
          d[i + 2] = c & 0xff;
        }
        g.putImageData(im, 0, 0);
      }
      t.refresh();
    }
  }
  const img = scene.add.image(0, 0, key).setOrigin(0, 0);
  const shadow = scene.add.rectangle(1, 1, POSTER_W, POSTER_H, 0x000000, 0.25).setOrigin(0, 0);
  return scene.add.container(x, y, [shadow, img]).setDepth(depth);
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** A 3x5 print face: only the letters the poster needs. */
const GLYPH: Record<string, string[]> = {
  W: ['10001', '10001', '10101', '10101', '01010'],
  A: ['010', '101', '111', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  T: ['111', '010', '010', '010', '010'],
  E: ['111', '100', '110', '100', '111'],
  D: ['110', '101', '101', '101', '110'],
  R: ['110', '101', '110', '101', '101'],
};
function tiny(g: CanvasRenderingContext2D, word: string, cx: number, y: number, col: string): void {
  g.fillStyle = col;
  const wide = (ch: string) => (GLYPH[ch]?.[0].length ?? 3) + 1;
  let x = Math.round(cx - ([...word].reduce((n, ch) => n + wide(ch), 0) - 1) / 2);
  for (const ch of word) {
    (GLYPH[ch] ?? []).forEach((row, r) => [...row].forEach((b, c) => b === '1' && g.fillRect(x + c, y + r, 1, 1)));
    x += wide(ch);
  }
}
