/**
 * The machine's own screen, before a go.  PRD MG-8; log #49b, #50, #70, #79, #84.
 *
 * NOTHING IS CHARGED UNTIL THE PLAYER PRESSES PLAY.  Walking up to a cabinet
 * and reading what it wants is free at every machine in the building, and
 * every one of them -- Barrel Climb included -- puts this up first, whichever
 * way the go was started.  It has three pages:
 *
 *   THE MACHINE   the title, YOUR BEST, what winning is, and the buttons:
 *                 PLAY - N TOKENS (and PRACTICE beside it, free, where the
 *                 cabinet has one, each with what it pays underneath), then
 *                 TUTORIAL, CONTROLS and LEAVE.
 *   HOW TO PLAY   the objective and this cabinet's controls -- the keys on a
 *                 keyboard, the buttons on a phone -- with each control lit
 *                 and pressed in turn, so the card shows what to do as well
 *                 as saying it.  The first go at a cabinet opens here.
 *   CONTROLS      on a keyboard: every key this game reads -- the shared ones
 *                 (W A S D, E, SPACE...) and its own (Grudge's J K L I) --
 *                 each a keycap to click and press a new key for, and RESET
 *                 KEYS.  A key another of the same kind had swaps over; a
 *                 shared key and a game's own never swap (core/keymap
 *                 `bindBlocker`), and the card says which has it.  On a
 *                 phone: the buttons it will put under your thumbs.
 *
 * LEAVE goes back to the room with the player's tokens untouched.  PLAY is
 * the only thing that takes them, and it takes them exactly once -- it latches
 * on the first press, so a player hammering it is charged for one play and
 * not for five.  A player who cannot afford the game still gets the screen:
 * PLAY goes dark, the line under it says how many more they need, and LEAVE
 * still works.
 *
 * The shell does not construct the game module until PLAY is pressed, so
 * nothing behind the card can be played by accident and no key pressed here
 * reaches the game.  A game's controls are its own -- the card is built from
 * the module's own `tutorial`, so no cabinet can advertise another one's keys.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { FONT_ADVANCE } from '../render/pixelFont';
import { isTouch } from '../core/device';
import { KEY_ACTIONS, bind, bindBlocker, bindable, capLabel, codeFor, gameKeys, resetKeys, remapped, setListening } from '../core/keymap';
import type { Tutorial } from '../minigames/types';
import type { ControlRow } from './controlsList';

const CARD = { x: 8, y: 18, w: GAME_W - 16, h: 158 };
const CX = GAME_W / 2;
/** Where the "what it does" column starts, measured from the card's left. */
const DOES_X = 84;
/**
 * Nine, not ten.  The busiest card in the building is four lines of objective
 * over six rows of controls (Grudge); every row has to fit above the buttons.
 */
const ROW_H = 9;
/** The objective's own line height, a pixel tighter than a control row. */
const OBJ_ROW = 8;
/** The CONTROLS header inside the panel, above the first row. */
const PANEL_HEAD = 11;
/** The controls panel: darker than the card, so the keys read at a glance. */
const PANEL_INK = 0x07060c;
const PANEL_EDGE = 0x2f2850;
/** The bottom row of buttons, on every page. */
const BOTTOM_Y = CARD.y + CARD.h - 13;

export interface TutorialCard {
  /** Tear the card down.  Safe to call twice. */
  destroy(): void;
  /**
   * Esc, while the card is up: true when the card used it -- to stop waiting
   * for a key, or to go back from HOW TO PLAY or CONTROLS to the machine.
   * False on the machine page, where Esc is LEAVE (the shell's to do).
   */
  escape(): boolean;
}

export interface TutorialCardOpts {
  title: string;
  tutorial: Tutorial;
  /** What a go costs, in tokens. */
  cost: number;
  /** Tokens in the pocket, for the affordability line. */
  balance: number;
  /**
   * True where the cabinet charges INSIDE the game rather than at the door —
   * the table and the wheel.  PLAY costs nothing at those; the bet does.
   */
  chargesInside?: boolean;
  /** What a real go pays, under PLAY, e.g. "WIN: 6 TOKENS". */
  payNote?: string;
  /** The player's personal best at this cabinet, as a sentence, if there is one. */
  record?: string;
  /** This cabinet keeps a best, even if none is set yet: the card says "NO BEST YET". */
  keepsRecord?: boolean;
  /** Pressed PLAY, and could afford it.  Runs at most once. */
  onPlay: () => void;
  /** Pressed LEAVE, or Esc.  Nothing has been charged. */
  onLeave: () => void;
  /** Pressed PRACTICE (offered only when given): a free go that counts for nothing. */
  onPractice?: () => void;
  /** Open on HOW TO PLAY rather than the machine: the first go at this cabinet. */
  howToFirst?: boolean;
  /**
   * The controls as written for a keyboard, before any rebinding -- what
   * CONTROLS reads to know which keys this game uses.  Defaults to
   * `tutorial.controls`.
   */
  keyRows?: ControlRow[];
  /** Whose own keys these are (the game's id), so they can be moved: see core/keymap `gameKeys`. */
  keyScope?: string;
  /**
   * The controls as this device works them now.  Called again after a key is
   * changed, so HOW TO PLAY never shows a key that no longer does it.
   * Defaults to `tutorial.controls`.
   */
  liveControls?: () => ControlRow[];
}

type Page = 'machine' | 'howto' | 'controls';

/** Words in a key column that are not keys. */
const NOT_KEYS = new Set(['HOLD', 'CLICK', 'DRAG', 'MOUSE', 'TAP', 'ARROWS', 'OR', 'AND', 'THEN', 'RELEASE', 'PRESS', 'WHEEL', 'SCROLL', 'MOVE', 'RIGHT', 'LEFT', 'UP', 'DOWN']);

/** A key named in a key column, as a key code: J -> KeyJ, 1 -> Digit1, ENTER -> Enter. */
function codeOf(tok: string): string | null {
  if (/^[A-Z]$/.test(tok)) return `Key${tok}`;
  if (/^[0-9]$/.test(tok)) return `Digit${tok}`;
  const named: Record<string, string> = { SPACE: 'Space', ENTER: 'Enter', TAB: 'Tab', SHIFT: 'ShiftLeft', CTRL: 'ControlLeft', ALT: 'AltLeft', BACKSPACE: 'Backspace' };
  return named[tok] ?? null;
}

/** The tokens of a key column: "HOLD A / D" -> HOLD, A, D. */
function tokens(keys: string): string[] {
  return keys
    .toUpperCase()
    .split(/[\s/,+]+/)
    .filter((t) => t && !/^[←→↑↓]+$/.test(t));
}

/**
 * Which shared actions a cabinet's controls use, row by row, and which keys
 * it reads for itself (and so cannot be given to an action while it is up).
 */
export function keyPlan(rows: ControlRow[], scope?: string): { lines: Array<{ does: string; actions: string[]; fixed: string[] }>; reserved: Set<string> } {
  const reserved = new Set<string>();
  const lines: Array<{ does: string; actions: string[]; fixed: string[] }> = [];
  for (const [keys, does] of rows) {
    const actions: string[] = [];
    const fixed: string[] = [];
    for (const t of tokens(keys)) {
      if (NOT_KEYS.has(t)) continue;
      const a = KEY_ACTIONS.find((x) => capLabel(x.code) === t);
      if (a) {
        if (!actions.includes(a.id)) actions.push(a.id);
        continue;
      }
      const code = codeOf(t);
      if (!code) continue;
      reserved.add(code);
      // (with a scope, the game's own key is an action of its own to move)
      const own = scope ? gameKeys(scope, [code])[0] : undefined;
      if (own) {
        if (!actions.includes(own.id)) actions.push(own.id);
      } else if (!fixed.includes(t)) fixed.push(t);
    }
    lines.push({ does, actions, fixed });
  }
  return { lines, reserved };
}

export function showTutorial(scene: Phaser.Scene, opts: TutorialCardOpts): TutorialCard {
  /** The card itself, for its whole life. */
  const frame: Phaser.GameObjects.GameObject[] = [];
  /** The page on it now, torn down when the page changes. */
  const page: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    page.push(o);
    return o;
  };

  const free = opts.chargesInside === true;
  // A fixture that charges inside is always startable; everything else needs
  // the coin up front.
  const affordable = free || opts.balance >= opts.cost;
  const touch = isTouch();

  // The card sits over a dimmed screen rather than a black one: the cabinet's
  // own colours stay visible underneath, so you can see what you are buying.
  // Interactive, and the input plugin is top-only, so the dimmer also swallows
  // clicks: nothing underneath can be hit through the card.
  frame.push(scene.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.86).setOrigin(0, 0).setDepth(900).setInteractive());
  frame.push(scene.add.rectangle(CARD.x, CARD.y, CARD.w, CARD.h, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold).setDepth(901));
  frame.push(scene.add.rectangle(CARD.x, CARD.y, CARD.w, 11, PALETTE.plum).setOrigin(0, 0).setDepth(902));
  const heading = centerText(scene, CX, CARD.y + 5, opts.title, PALETTE.gold).setDepth(903);
  frame.push(heading);

  // ---- the buttons' work.  PLAY takes tokens; nothing else ever does.
  let taken = false;
  let done = false;
  const play = (): void => {
    if (taken || done || listening) return;
    if (!affordable) {
      audio.sfx('buzzer', 0.5);
      return;
    }
    // The latch: a player who clicks PLAY four times pays once.
    taken = true;
    card.destroy();
    audio.sfx('coin_drop');
    opts.onPlay();
  };
  const leave = (): void => {
    if (taken || done) return;
    taken = true;
    card.destroy();
    audio.sfx('ui_blip');
    opts.onLeave();
  };
  const practice = (): void => {
    if (taken || done || !opts.onPractice) return;
    taken = true;
    card.destroy();
    audio.sfx('ui_blip');
    opts.onPractice();
  };
  // (the price is on the button: a table or a wheel charges by the go, inside)
  const tokens = `${opts.cost} TOKEN${opts.cost === 1 ? '' : 'S'}`;
  const playLabel = free ? `PLAY - ${tokens} A GO` : affordable ? `PLAY - ${tokens}` : 'CANT PLAY';
  const playButton = (x: number, y: number, w: number, h: number): void => {
    keep(
      button(scene, x, y, playLabel, play, {
        width: w,
        height: h,
        fill: affordable ? PALETTE.tealDark : PALETTE.slate,
        disabled: !affordable,
      }).setDepth(905),
    );
  };

  /** A line of objective words, wrapped to the card rather than run off it. */
  const wrap = (lines: string[]): string[] => {
    const cols = Math.floor((CARD.w - 8) / FONT_ADVANCE);
    const out: string[] = [];
    for (const line of lines) {
      let run = '';
      for (const word of line.split(' ')) {
        if (run && (run + ' ' + word).length > cols) {
          out.push(run);
          run = word;
        } else run = run ? run + ' ' + word : word;
      }
      if (run) out.push(run);
    }
    return out;
  };

  let current: Page = 'machine';
  let demo: Phaser.Time.TimerEvent | null = null;

  const clear = (): void => {
    demo?.remove(false);
    demo = null;
    for (const o of page) o.destroy();
    page.length = 0;
  };

  const show = (p: Page): void => {
    if (done) return;
    stopListening();
    clear();
    current = p;
    if (p === 'machine') machine();
    else if (p === 'howto') howTo();
    else controls();
  };

  // ------------------------------------------------------------- THE MACHINE
  const machine = (): void => {
    heading.setText(opts.title);
    // YOUR BEST, first thing under the title -- or that there is one to set
    if (opts.record) keep(centerText(scene, CX, CARD.y + 18, opts.record, PALETTE.gold).setDepth(903));
    else if (opts.keepsRecord) keep(centerText(scene, CX, CARD.y + 18, 'NO BEST YET - SET THE FIRST ONE', PALETTE.ash).setDepth(903));
    // what winning is: the objective's opening lines, as many as fit
    const lines = wrap(opts.tutorial.objective).slice(0, 6);
    let y = CARD.y + 30;
    for (const line of lines) {
      keep(centerText(scene, CX, y, line, PALETTE.cream).setDepth(903));
      y += OBJ_ROW;
    }
    // PLAY, and PRACTICE beside it where there is one, each with what it is
    // worth underneath: the choice the Grudge card asked for (log #49b)
    const rowY = CARD.y + 93;
    const under = affordable ? opts.payNote ?? '' : `YOU NEED ${opts.cost - opts.balance} MORE`;
    if (opts.onPractice) {
      playButton(CX - 58, rowY, 108, 19);
      keep(button(scene, CX + 58, rowY, 'PRACTICE', practice, { width: 108, height: 19, fill: 0x1f4a5a }).setDepth(905));
      if (under) keep(centerText(scene, CX - 58, rowY + 16, under, affordable ? PALETTE.tealLight : PALETTE.blood).setDepth(903));
      keep(centerText(scene, CX + 58, rowY + 16, 'FREE - WINS NOTHING', PALETTE.tealLight).setDepth(903));
    } else {
      playButton(CX, rowY, 140, 19);
      if (under) keep(centerText(scene, CX, rowY + 16, under, affordable ? PALETTE.tealLight : PALETTE.blood).setDepth(903));
    }
    if (!free) keep(centerText(scene, CX, rowY + 28, 'LEAVE A REAL GAME AND YOU FORFEIT', PALETTE.ash).setDepth(903));
    // ...and the rest, one row
    keep(button(scene, CX - 98, BOTTOM_Y, 'TUTORIAL', () => show('howto'), { width: 90, height: 15 }).setDepth(905));
    keep(button(scene, CX, BOTTOM_Y, 'CONTROLS', () => show('controls'), { width: 90, height: 15 }).setDepth(905));
    keep(button(scene, CX + 98, BOTTOM_Y, 'LEAVE', leave, { width: 90, height: 15, fill: PALETTE.plum }).setDepth(905));
  };

  // ------------------------------------------------------------- HOW TO PLAY
  const howTo = (): void => {
    heading.setText(`HOW TO PLAY - ${opts.title}`);
    const rows = (opts.liveControls?.() ?? opts.tutorial.controls).slice(0, 6);
    // ---- HOW MANY LINES FIT, WORKED OUT RATHER THAN GUESSED: whatever the
    // controls panel and the buttons leave is what the objective may have.
    const panelH = rows.length ? rows.length * ROW_H + PANEL_HEAD : 0;
    const objTop = CARD.y + 13;
    const bottom = BOTTOM_Y - 12;
    const room = bottom - (panelH ? panelH + 4 : 0) - objTop;
    const lines = wrap(opts.tutorial.objective).slice(0, Math.max(1, Math.floor(room / OBJ_ROW)));
    let y = objTop;
    for (const line of lines) {
      keep(centerText(scene, CX, y + 3, line, PALETTE.cream).setDepth(903));
      y += OBJ_ROW;
    }
    if (rows.length) {
      y += 2;
      keep(scene.add.rectangle(CARD.x + 6, y, CARD.w - 12, panelH, PANEL_INK).setOrigin(0, 0).setStrokeStyle(1, PANEL_EDGE).setDepth(903));
      keep(text(scene, CARD.x + 10, y + 2, 'CONTROLS', PALETTE.tealLight).setDepth(904));
      // ---- SHOWN, NOT ONLY SAID.  Each control in turn: its row lit, its
      // key (or the button a phone has for it) pressed -- a keycap that dips
      // a pixel, or a fingertip that lands on it.
      const lit = keep(scene.add.rectangle(CARD.x + 7, 0, CARD.w - 14, ROW_H, 0x1d2b3c, 0.9).setOrigin(0, 0).setDepth(903.5));
      const cap = keep(scene.add.rectangle(0, 0, 10, ROW_H - 1, 0x000000, 0).setOrigin(0, 0).setStrokeStyle(1, PALETTE.tealLight).setDepth(904.5));
      const tip = keep(scene.add.circle(0, 0, 3, 0xffffff, 0.75).setDepth(905));
      tip.setVisible(touch);
      cap.setVisible(!touch);
      const keyTexts: Phaser.GameObjects.BitmapText[] = [];
      let ry = y + PANEL_HEAD;
      const rowYs: number[] = [];
      // Two columns, and the key column is measured rather than guessed: a
      // long key name ("HOLD SPACE") must not run into what it does.
      for (const [keys, does] of rows) {
        keyTexts.push(keep(text(scene, CARD.x + 10, ry, keys, PALETTE.gold).setDepth(904)));
        const overrun = Math.max(0, keys.length * FONT_ADVANCE - (DOES_X - 14));
        keep(text(scene, CARD.x + DOES_X + overrun, ry, does, PALETTE.cream).setDepth(904));
        rowYs.push(ry);
        ry += ROW_H;
      }
      let i = -1;
      let pressed = false;
      const step = (): void => {
        if (!pressed) i = (i + 1) % rows.length;
        pressed = !pressed;
        const t = keyTexts[i];
        const ty = rowYs[i];
        lit.setY(ty - 1);
        for (const k of keyTexts) k.setTint(PALETTE.gold);
        t.setTint(pressed ? 0xffffff : PALETTE.gold);
        const w = Math.max(10, rows[i][0].length * FONT_ADVANCE + 3);
        cap.setPosition(CARD.x + 8, ty - 2 + (pressed ? 1 : 0)).setSize(w, ROW_H);
        tip.setPosition(CARD.x + 10 + Math.min(w, 40) / 2, ty + 3).setRadius(pressed ? 2 : 3.5).setAlpha(pressed ? 0.95 : 0.45);
      };
      step();
      demo = scene.time.addEvent({ delay: 420, loop: true, callback: step });
    }
    keep(button(scene, CX - 90, BOTTOM_Y, 'BACK', () => show('machine'), { width: 80, height: 15 }).setDepth(905));
    playButton(CX + 50, BOTTOM_Y, 140, 15);
  };

  // ------------------------------------------------------------- CONTROLS
  let listening: string | null = null;
  let keyCatch: ((e: KeyboardEvent) => void) | null = null;
  let note = '';

  function stopListening(): void {
    if (keyCatch) window.removeEventListener('keydown', keyCatch, true);
    keyCatch = null;
    if (listening) setListening(false);
    listening = null;
  }

  const plan = keyPlan(opts.keyRows ?? opts.tutorial.controls, opts.keyScope);

  const listen = (id: string): void => {
    stopListening();
    listening = id;
    note = '';
    // (the page again, with this keycap saying PRESS)
    clear();
    controls();
    setListening(true);
    keyCatch = (e: KeyboardEvent): void => {
      // (this press is the new key, not a game's or the pause menu's)
      e.stopImmediatePropagation();
      e.preventDefault();
      const target = listening;
      const code = e.code;
      stopListening();
      const blocker = target ? bindBlocker(target, code) : null;
      if (code === 'Escape' || !target) {
        // (nothing changed)
      } else if (!bindable(code)) {
        note = 'THAT KEY CANNOT BE USED';
        audio.sfx('buzzer', 0.4);
      } else if (blocker) {
        // a shared key and a game's own never swap: say who has it
        note = blocker.id.includes(':') ? `THIS GAME READS ${capLabel(code)} ITSELF` : `${capLabel(code)} IS ${blocker.label}`;
        audio.sfx('buzzer', 0.4);
      } else {
        // (whoever had the key -- a shared action, or another of this game's -- takes the old one)
        const had = KEY_ACTIONS.some((a) => a.id !== target && codeFor(a.id) === code) || plan.lines.some((l) => l.actions.some((id) => id !== target && codeFor(id) === code));
        bind(target, code);
        note = had ? 'SWAPPED' : '';
        audio.sfx('ui_blip', 0.5);
      }
      show('controls');
    };
    window.addEventListener('keydown', keyCatch, true);
  };

  const controls = (): void => {
    heading.setText(`CONTROLS - ${opts.title}`);
    let y = CARD.y + 16;
    if (touch) {
      // a phone has its buttons put under the thumbs for it: say which
      const rows = (opts.liveControls?.() ?? opts.tutorial.controls).slice(0, 9);
      for (const [keys, does] of rows) {
        keep(text(scene, CARD.x + 10, y, keys, PALETTE.gold).setDepth(904));
        keep(text(scene, CARD.x + DOES_X + Math.max(0, keys.length * FONT_ADVANCE - (DOES_X - 14)), y, does, PALETTE.cream).setDepth(904));
        y += ROW_H + 1;
      }
      keep(centerText(scene, CX, BOTTOM_Y - 14, 'THE BUTTONS ARE ON SCREEN WHILE YOU PLAY', PALETTE.ash).setDepth(903));
      keep(button(scene, CX, BOTTOM_Y, 'BACK', () => show('machine'), { width: 100, height: 15 }).setDepth(905));
      return;
    }
    keep(text(scene, CARD.x + 10, y, listening ? 'PRESS THE NEW KEY  -  ESC TO CANCEL' : 'CLICK A KEY, THEN PRESS THE NEW ONE', PALETTE.fog).setDepth(904));
    y += 12;
    const shown = plan.lines.filter((l) => l.actions.length || l.fixed.length).slice(0, 9);
    if (!shown.length) keep(centerText(scene, CX, y + 20, 'THIS GAME IS PLAYED WITH THE MOUSE', PALETTE.cream).setDepth(903));
    for (const l of shown) {
      const room = Math.floor(150 / FONT_ADVANCE);
      keep(text(scene, CARD.x + 10, y, l.does.length > room ? l.does.slice(0, room - 1) + '.' : l.does, PALETTE.cream).setDepth(904));
      let x = CARD.x + 166;
      for (const id of l.actions) {
        const waiting = listening === id;
        const label = waiting ? 'PRESS' : capLabel(codeFor(id));
        const moved = codeFor(id) !== (KEY_ACTIONS.find((a) => a.id === id)?.code ?? id.slice(id.indexOf(':') + 1));
        const w = Math.max(18, label.length * FONT_ADVANCE + 7);
        keep(button(scene, x + w / 2, y + 3, label, () => listen(id), { width: w, height: 9, fill: waiting ? 0x5a3a12 : moved ? 0x1f4a5a : undefined }).setDepth(905));
        x += w + 3;
      }
      for (const k of l.fixed) {
        // (the game's own key: shown, not changeable)
        keep(text(scene, x + 2, y, k, PALETTE.gold).setDepth(904));
        x += k.length * FONT_ADVANCE + 6;
      }
      y += 11;
    }
    if (note) keep(centerText(scene, CX, BOTTOM_Y - 13, note, note.startsWith('SWAPPED') ? PALETTE.tealLight : PALETTE.blood).setDepth(903));
    else keep(centerText(scene, CX, BOTTOM_Y - 13, 'THE ARROWS MOVE TOO  -  ESC IS ALWAYS PAUSE', PALETTE.ash).setDepth(903));
    keep(
      button(scene, CX - 62, BOTTOM_Y, 'RESET KEYS', () => {
        resetKeys();
        note = '';
        audio.sfx('ui_blip', 0.5);
        show('controls');
      }, { width: 100, height: 15, fill: remapped() ? 0x5a1a22 : PALETTE.slate, hoverFill: 0x8a2b34 }).setDepth(905),
    );
    keep(button(scene, CX + 62, BOTTOM_Y, 'BACK', () => show('machine'), { width: 100, height: 15 }).setDepth(905));
  };

  const card: TutorialCard = {
    destroy() {
      if (done) return;
      done = true;
      stopListening();
      kb?.off('keyup-SPACE', play);
      kb?.off('keyup-ENTER', play);
      clear();
      for (const o of frame) o.destroy();
      frame.length = 0;
    },
    escape() {
      if (done) return false;
      if (listening) {
        stopListening();
        show('controls');
        return true;
      }
      if (current !== 'machine') {
        show('machine');
        return true;
      }
      return false;
    },
  };

  show(opts.howToFirst ? 'howto' : 'machine');

  // On the way UP, not the way down.  A held key auto-repeats its keydown, and
  // a game built on the first repeat would read the rest of them and the final
  // keyup as play — starting on release hands the game a clean keyboard.
  // Esc belongs to the shell, which asks `escape` first and treats the rest as
  // LEAVE while the card is up.
  const kb = scene.input.keyboard;
  kb?.on('keyup-SPACE', play);
  kb?.on('keyup-ENTER', play);

  return card;
}
