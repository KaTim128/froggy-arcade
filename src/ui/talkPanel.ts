/**
 * A person talking to you, and the things you can say back.
 *
 * One panel for every member of staff in the building: a name, a line, and
 * the answers as buttons under it.  Built round the text rather than the
 * other way about -- the line is measured first and everything else is laid
 * out from what it actually came to -- so a line that wraps to six rows never
 * has a button sitting on its last two.  The answers go side by side when
 * they fit across the panel and one per row when they do not, and the whole
 * thing sits at the bottom of the screen, inside it, whatever it holds.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { button, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { FONT_ADVANCE } from '../render/pixelFont';

export interface TalkOption {
  label: string;
  fn: () => void;
}

export interface TalkOpts {
  who: string;
  /** The panel's edge and the name, in the speaker's colour. */
  color?: number;
  line: string;
  /** No options: a line with "[E] LEAVE IT" under it. */
  options?: TalkOption[];
  depth?: number;
}

export function openTalkPanel(scene: Phaser.Scene, o: TalkOpts): Phaser.GameObjects.Container {
  const PAD = 7;
  const HEAD = 11;
  const ROW = 17;
  const GAP = 10;
  const inner = GAME_W - 46;
  const color = o.color ?? PALETTE.neon;
  const options = o.options ?? [];
  const body = text(scene, 22, 0, o.line, PALETTE.cream).setMaxWidth(inner);
  const textH = Math.max(8, Math.ceil(body.height));
  const widths = options.map((op) => Math.max(60, op.label.length * FONT_ADVANCE + 14));
  const across = widths.reduce((a, w) => a + w, 0) + Math.max(0, widths.length - 1) * GAP;
  const oneRow = across <= inner;
  const rows = options.length === 0 ? 0 : oneRow ? 1 : options.length;
  const h = PAD + HEAD + textH + PAD + (rows > 0 ? rows * ROW + 2 : 10);
  const y = GAME_H - h - 5;
  body.setY(y + PAD + HEAD);

  const panel = scene.add.rectangle(GAME_W / 2, y + h / 2, GAME_W - 24, h, PALETTE.ink, 0.95);
  panel.setStrokeStyle(1, color);
  const who = text(scene, 22, y + PAD, o.who, color);
  const parts: Phaser.GameObjects.GameObject[] = [panel, who, body];

  const top = y + PAD + HEAD + textH + PAD + ROW / 2;
  if (rows === 0) {
    parts.push(text(scene, GAME_W / 2, y + h - 9, '[E] LEAVE IT', PALETTE.ash).setOrigin(0.5, 0.5));
  } else if (oneRow) {
    let x = GAME_W / 2 - across / 2;
    options.forEach((op, i) => {
      parts.push(button(scene, x + widths[i] / 2, top, op.label, op.fn, { width: widths[i], height: 13 }));
      x += widths[i] + GAP;
    });
  } else {
    options.forEach((op, i) => {
      parts.push(button(scene, GAME_W / 2, top + i * ROW, op.label, op.fn, { width: widths[i], height: 13 }));
    });
  }
  return scene.add.container(0, 0, parts).setDepth(o.depth ?? 900);
}
