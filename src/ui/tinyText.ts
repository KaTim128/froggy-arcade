/**
 * A 3x5 pixel face for the smallest labels (the HUD's slot names): the
 * house font is eight pixels high, and a label over a number wants half
 * that.  Drawn into a Graphics, one pixel at a time.
 */

import type Phaser from 'phaser';

const G: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001011001111',
  '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111',
  '9': '111101111001111', ' ': '000000000000000', '-': '000000111000000',
  ':': '000010000010000', ',': '000000000010010', '.': '000000000000010', '$': '011110010011110',
  '&': '010101010101011', '/': '001001010100100', "'": '010010000000000', '!': '010010010000010',
  '?': '110001010000010', '+': '000010111010000', '(': '010100100100010', ')': '010001001001010',
  '%': '101001010100101', '"': '101101000000000', '>': '100010001010100', '<': '001010100010001', '=': '000111000111000',
  ';': '000010000010100', '*': '000101010101000', '#': '101111101111101', '_': '000000000000111',
};

/** Width of `s` in the tiny face, in pixels. */
export const tinyWidth = (s: string): number => Math.max(0, s.length * 4 - 1);

/** Draw `s` with its top-left at (x, y). */
export function tinyText(g: Phaser.GameObjects.Graphics, s: string, x: number, y: number, col: number, alpha = 1): void {
  g.fillStyle(col, alpha);
  [...s.toUpperCase()].forEach((ch, i) => {
    const bits = G[ch] ?? G[' '];
    for (let k = 0; k < 15; k++) if (bits[k] === '1') g.fillRect(x + i * 4 + (k % 3), y + Math.floor(k / 3), 1, 1);
  });
}

/** `s` broken into lines no wider than `w` in the tiny face, at the spaces. */
export function tinyWrap(s: string, w: number): string[] {
  const max = Math.max(1, Math.floor((w + 1) / 4));
  const out: string[] = [];
  let line = '';
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= max) line = next;
    else {
      if (line) out.push(line);
      line = word;
      // (a word longer than the line, cut)
      while (line.length > max) {
        out.push(line.slice(0, max));
        line = line.slice(max);
      }
    }
  }
  if (line) out.push(line);
  return out;
}
