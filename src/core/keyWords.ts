/**
 * ---- [E] ON A PHONE IS NOT A KEY.
 *
 * Every prompt in the building is written for a keyboard -- "[E] GO IN",
 * "[E] FROGGY SLOTS - 3 A SPIN", "HOLD [E]" -- and a phone has no E on it:
 * its button says INTERACT.  So on a touch screen the key comes out of the
 * words: a machine's prompt says PLAY, and everything else says INTERACT,
 * which is what the button under the player's thumb is called.
 *
 * Done once, where text is put on the screen (see `installKeyWords`), so no
 * room has to remember to and none of the hundred-odd prompts had to change.
 */

import Phaser from 'phaser';
import { isTouch } from './device';

/** A prompt the cabinets use: "[E] TITLE - 5 TOKENS", "- 3 A SPIN", "- 10 MIN BET". */
const MACHINE = /^\[E\] (.+ - \d+ (TOKENS?|A SPIN|MIN BET))$/;

export function touchWords(s: string): string {
  if (!s.includes('[E]')) return s;
  const m = MACHINE.exec(s);
  if (m) return `PLAY ${m[1]}`;
  return s.replace(/^\[E\] /, 'INTERACT: ').replace(/\[E\]/g, 'INTERACT');
}

/** Rewrite every bitmap text's [E] for the thumb, on touch devices only. */
export function installKeyWords(): void {
  if (!isTouch()) return;
  const proto = Phaser.GameObjects.BitmapText.prototype as unknown as {
    setText: (v: string | string[]) => unknown;
    __keyWords?: boolean;
  };
  if (proto.__keyWords) return;
  proto.__keyWords = true;
  const set = proto.setText;
  proto.setText = function (this: unknown, v: string | string[]) {
    const out = Array.isArray(v) ? v.map(touchWords) : typeof v === 'string' ? touchWords(v) : v;
    return set.call(this, out);
  };
}
