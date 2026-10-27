/**
 * ---- [E] ON A PHONE IS NOT A KEY.
 *
 * Every prompt in the building is written for a keyboard -- "[E] GO IN",
 * "[E] FROGGY SLOTS - 3 A SPIN", "HOLD [E]" -- and a phone has no E on it:
 * its button says INTERACT.  So on a touch screen the key comes out of the
 * words: a machine's prompt says PLAY, and everything else says INTERACT,
 * which is what the button under the player's thumb is called -- and that
 * button itself says what it will do (see `actionWord`).
 *
 * Done once, where text is put on the screen (see `installKeyWords`), so no
 * room has to remember to and none of the hundred-odd prompts had to change.
 */

import Phaser from 'phaser';
import { isTouch } from './device';
import { touchControls } from '../ui/touchControls';

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
    // (what it says it will do, for the INTERACT button)
    const word = typeof v === 'string' ? actionWord(v) : null;
    if (word) lines.set(this as Live, { word, at: performance.now() });
    else lines.delete(this as Live);
    const out = Array.isArray(v) ? v.map(touchWords) : typeof v === 'string' ? touchWords(v) : v;
    return set.call(this, out);
  };
  window.setInterval(() => touchControls.actionWord(currentActionWord()), 100);
}

/**
 * ---- AND THE BUTTON SAYS WHAT IT WILL DO (log #50).
 *
 * The prompt on screen is the one place that knows what is in reach, so the
 * phone's INTERACT button takes its word from it: PLAY at a machine, OPEN at
 * a shop door or the arcade's, HIDE at a wardrobe, TALK at the staff -- and
 * INTERACT again the moment nothing is.  A prompt counts while it is showing:
 * a bitmap line while it is visible in a running scene, a line painted on a
 * 3D scene's overlay while it is still being painted every frame.
 */
const VERBS: [RegExp, string][] = [
  [/^PLAY\b|^(CRANE|CABINET|CREATURE CLASH)$/, 'PLAY'],
  [/^HIDE\b|^GET IN(SIDE)?$|^DUCK\b/, 'HIDE'],
  [/^(GO IN|DOOR|FRONT DOORS?|ARCADE|HOME AND HEARTH|THREADS|SHARP'S BARBER|SOMEBODY'S DOOR|WARDROBE)$|^OPEN\b/, 'OPEN'],
  [/^TALK\b|^RECEPTION$/, 'TALK'],
  [/^SIT\b/, 'SIT'],
  [/^SLEEP\b/, 'SLEEP'],
  [/^BEG\b/, 'BEG'],
  [/^LOOK\b|^MIRROR$/, 'LOOK'],
  [/^PICK\b/, 'TAKE'],
  [/^PUT\b/, 'DROP'],
  [/^CLOSE\b/, 'CLOSE'],
  [/^CLIMB\b/, 'CLIMB'],
  [/^GET UP$/, 'GET UP'],
  [/^COME OUT$/, 'OUT'],
  [/^LEAVE\b/, 'LEAVE'],
  [/^RING$/, 'RING'],
  [/^POUR\b/, 'POUR'],
  [/^DRAIN\b/, 'DRAIN'],
  [/^REFILL\b/, 'REFILL'],
  [/^UNLOCK$/, 'UNLOCK'],
  [/^LOCKED$|^TRY\b/, 'TRY'],
  [/^CONTINUE\b/, 'GO ON'],
  [/^CALL\b/, 'CALL'],
  [/^CHANGE\b/, 'USE'],
  [/^THE (RAILS|STYLE BOOK|TABLE|SHELF|HAT STAND|HOOKS)$/, 'BROWSE'],
  [/\$\d+$/, 'BUY'],
  [/: (ON|OFF)$/, 'SWITCH'],
  [/^(BACK\b|TO\b|OUT\b|OUTSIDE$|STAIRS|STAIRWELL$|CORRIDOR$|BATHROOM$|LOBBY$|THE LOBBY$|ROOM \d+$|ALLEY$|NEW ROOM$|BACK ROOM$|FITTING ROOM$|STORAGE ROOM$|LIFT$|STAFF$)/, 'GO'],
];

/** The word for the button, from a prompt as written ("[E] GO IN" -> OPEN); null if it is not a prompt. */
export function actionWord(s: string): string | null {
  const m = /^(?:\[E\] |INTERACT: |TAP INTERACT - )(.+)$/.exec(s.trim());
  if (!m) return null;
  if (MACHINE.test(s.trim())) return 'PLAY';
  const what = m[1];
  for (const [re, w] of VERBS) if (re.test(what)) return w;
  return 'USE';
}

type Live = { visible: boolean; active: boolean; alpha: number; scene?: Phaser.Scene; parentContainer?: Phaser.GameObjects.Container | null };

/** Bitmap lines that read as a prompt now, with their word and when they were set. */
const lines = new Map<Live, { word: string; at: number }>();
/** The last prompt painted on a 3D overlay, and when. */
let painted: { word: string; at: number } | null = null;

/** Called by `drawPixelText` for every line it paints. */
export function notePainted(s: string): void {
  const word = actionWord(s);
  if (word) painted = { word, at: performance.now() };
}

function showing(o: Live): boolean {
  if (!o.active || !o.visible || o.alpha < 0.05 || !o.scene) return false;
  const sys = o.scene.sys;
  if (!sys || !sys.isActive() || !sys.isVisible()) return false;
  for (let p = o.parentContainer; p; p = p.parentContainer) if (!p.visible || p.alpha < 0.05) return false;
  return true;
}

/** The word for the button now: a fresh 3D prompt first, then the newest bitmap prompt showing. */
export function currentActionWord(): string | null {
  const now = performance.now();
  // (a slow phone paints a heavy 3D room a few times a second: a prompt
  // lasts that long between paints, so the button does not flicker)
  if (painted && now - painted.at < 600) return painted.word;
  let best: { word: string; at: number } | null = null;
  for (const [o, v] of lines) {
    if (!o.scene) {
      lines.delete(o);
      continue;
    }
    if (showing(o) && (!best || v.at > best.at)) best = v;
  }
  return best?.word ?? null;
}
