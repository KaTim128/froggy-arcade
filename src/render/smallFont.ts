/**
 * ---- THE SMALL FONT: three pixels wide, five tall, a pixel between letters.
 * For the lines that only support the main ones -- what a go pays, a step
 * count, a footnote -- so a busy card is not all one size of shouting.  1-bit
 * and authored at the size it is drawn, like the main font (render/pixelFont).
 * Capitals only; anything it has no glyph for is drawn as a space.
 */

import Phaser from 'phaser';

export const SMALL_FONT_KEY = 'pixel-small';
export const SMALL_W = 3;
export const SMALL_H = 5;
/** Glyph plus its gap. */
export const SMALL_ADVANCE = 4;
export const SMALL_LINE_H = 7;
const TEXTURE = 'pixelfont-small-atlas';

/** Five rows of three, '#' lit, rows joined by '/'. */
const G: Record<string, string> = {
  ' ': '.../.../.../.../...',
  A: '.#./#.#/###/#.#/#.#', B: '##./#.#/##./#.#/##.', C: '.##/#../#../#../.##', D: '##./#.#/#.#/#.#/##.',
  E: '###/#../##./#../###', F: '###/#../##./#../#..', G: '.##/#../#.#/#.#/.##', H: '#.#/#.#/###/#.#/#.#',
  I: '###/.#./.#./.#./###', J: '..#/..#/..#/#.#/.#.', K: '#.#/#.#/##./#.#/#.#', L: '#../#../#../#../###',
  M: '#.#/###/###/#.#/#.#', N: '##./#.#/#.#/#.#/#.#', O: '.#./#.#/#.#/#.#/.#.', P: '##./#.#/##./#../#..',
  Q: '.#./#.#/#.#/##./.##', R: '##./#.#/##./#.#/#.#', S: '.##/#../.#./..#/##.', T: '###/.#./.#./.#./.#.',
  U: '#.#/#.#/#.#/#.#/###', V: '#.#/#.#/#.#/#.#/.#.', W: '#.#/#.#/###/###/#.#', X: '#.#/#.#/.#./#.#/#.#',
  Y: '#.#/#.#/.#./.#./.#.', Z: '###/..#/.#./#../###',
  '0': '###/#.#/#.#/#.#/###', '1': '.#./##./.#./.#./###', '2': '##./..#/.#./#../###', '3': '##./..#/.#./..#/##.',
  '4': '#.#/#.#/###/..#/..#', '5': '###/#../##./..#/##.', '6': '.##/#../###/#.#/###', '7': '###/..#/.#./.#./.#.',
  '8': '###/#.#/###/#.#/###', '9': '###/#.#/###/..#/##.',
  '.': '.../.../.../.../.#.', ',': '.../.../.../.#./#..', '-': '.../.../###/.../...', ':': '.../.#./.../.#./...',
  '!': '.#./.#./.#./.../.#.', '?': '##./..#/.#./.../.#.', "'": '.#./.#./.../.../...', '/': '..#/..#/.#./#../#..',
  '+': '.../.#./###/.#./...', '(': '.#./#../#../#../.#.', ')': '.#./..#/..#/..#/.#.', '%': '#.#/..#/.#./#../#.#',
  $: '.##/##./.#./.##/##.', '&': '.#./#.#/.#./#.#/.##', '=': '.../###/.../###/...', '>': '#../.#./..#/.#./#..',
  '<': '..#/.#./#../.#./..#', '"': '#.#/#.#/.../.../...', _: '.../.../.../.../###', '*': '.../#.#/.#./#.#/...',
  '#': '#.#/###/#.#/###/#.#', '[': '##./#../#../#../##.', ']': '.##/..#/..#/..#/.##',
};
const CHARS = Object.keys(G).join('');
const PER_ROW = 16;

function atlas(): HTMLCanvasElement {
  const chars = [...CHARS];
  const cv = document.createElement('canvas');
  cv.width = PER_ROW * SMALL_ADVANCE;
  cv.height = Math.ceil(chars.length / PER_ROW) * (SMALL_H + 1);
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  chars.forEach((ch, i) => {
    const ox = (i % PER_ROW) * SMALL_ADVANCE;
    const oy = Math.floor(i / PER_ROW) * (SMALL_H + 1);
    G[ch].split('/').forEach((row, y) => {
      for (let x = 0; x < SMALL_W; x++) if (row[x] === '#') ctx.fillRect(ox + x, oy + y, 1, 1);
    });
  });
  return cv;
}

export function ensureSmallFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.has(SMALL_FONT_KEY)) return;
  if (!scene.textures.exists(TEXTURE)) scene.textures.addCanvas(TEXTURE, atlas());
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: TEXTURE,
    width: SMALL_ADVANCE,
    height: SMALL_H + 1,
    chars: CHARS,
    charsPerRow: PER_ROW,
    'offset.x': 0,
    'offset.y': 0,
    'spacing.x': 0,
    'spacing.y': 0,
    lineSpacing: SMALL_LINE_H - SMALL_H - 1,
  });
  scene.cache.bitmapFont.add(SMALL_FONT_KEY, data);
}

/** Only the characters it can draw (lower case raised; the rest become spaces). */
export function smallSafe(s: string): string {
  return [...s.toUpperCase()].map((c) => (G[c] ? c : ' ')).join('');
}
