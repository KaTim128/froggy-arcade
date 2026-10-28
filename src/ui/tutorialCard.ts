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
import { button, centerSmall, centerText, smallText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { FONT_ADVANCE } from '../render/pixelFont';
import { isTouch } from '../core/device';
import { KEY_ACTIONS, bind, bindBlocker, bindable, capLabel, codeFor, gameKeys, relabelKeys, resetKeys, remapped, setListening } from '../core/keymap';
import type { Tutorial, TutorialStep } from '../minigames/types';
import type { TouchLayout } from './touchControls';
import { DEMO_H, DEMO_W, demoFor } from './tutorialDemos';
import { deviceObjective, pairedControls } from './controlsList';
import type { ControlRow } from './controlsList';

const CARD = { x: 8, y: 18, w: GAME_W - 16, h: 158 };
const CX = GAME_W / 2;
const PANEL_EDGE = 0x2f2850;
/** The bottom row of buttons, on every page. */
const BOTTOM_Y = CARD.y + CARD.h - 13;
/** The picture's box (ui/tutorialDemos), on the left of the machine page and of every step. */
const DEMO_X = CARD.x + 8;
const DEMO_Y = CARD.y + 16;
/** The column right of the picture. */
const RIGHT_X = DEMO_X + DEMO_W + 10;
const RIGHT_W = CARD.x + CARD.w - 8 - RIGHT_X;

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
  /** The cabinet's touch layout: what a phone puts under the thumbs for each control. */
  layout?: TouchLayout;
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
    // (a gesture written out -- CLICK A FROG, DRAG BACK, LET GO -- is words,
    // not keys: the A in "CLICK A FROG" is not the A key)
    if (/^(CLICK|DRAG|LET|MOUSE|TAP|NOTHING|NUMBER)\b/.test(keys.trim().toUpperCase())) {
      lines.push({ does, actions, fixed });
      continue;
    }
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

  let current: Page = 'machine';
  let demo: Phaser.Time.TimerEvent | null = null;

  const clear = (): void => {
    demo?.remove(false);
    demo = null;
    picture?.();
    picture = null;
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

  // ---- THE PICTURE.  A moving example in a box on the left of the machine
  // page and of every step (ui/tutorialDemos), redrawn each frame, its words
  // in the small font from a pool of labels.
  let picture: (() => void) | null = null;
  const showPicture = (id: string): void => {
    const g = keep(scene.add.graphics().setDepth(904).setPosition(DEMO_X, DEMO_Y));
    keep(scene.add.rectangle(DEMO_X - 1, DEMO_Y - 1, DEMO_W + 2, DEMO_H + 2, 0x000000, 0).setOrigin(0, 0).setStrokeStyle(1, PANEL_EDGE).setDepth(904.5));
    // EVERYTHING IN THE PICTURE STAYS IN ITS BOX (user, 28 Oct: Croaked's
    // frog was out over the edge): drawing and labels both, clipped to it
    const clip = keep(scene.make.graphics({}, false));
    clip.fillStyle(0xffffff, 1).fillRect(DEMO_X, DEMO_Y, DEMO_W, DEMO_H);
    const mask = clip.createGeometryMask();
    g.setMask(mask);
    const pool: Phaser.GameObjects.BitmapText[] = [];
    const draw = demoFor(id);
    const t0 = scene.time.now;
    const tick = (): void => {
      g.clear();
      let used = 0;
      const lbl = (x: number, y: number, str: string, col: number = PALETTE.cream): void => {
        if (!str) return;
        let t = pool[used];
        if (!t) {
          t = keep(smallText(scene, 0, 0, '', col).setOrigin(0.5, 0.5).setDepth(905));
          t.setMask(mask);
          pool.push(t);
        }
        used++;
        t.setText(str).setTint(col).setPosition(Math.round(DEMO_X + x), Math.round(DEMO_Y + y)).setVisible(true);
      };
      draw(g, (scene.time.now - t0) / 1000, lbl);
      for (let i = used; i < pool.length; i++) pool[i].setVisible(false);
    };
    tick();
    scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
    picture = () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick);
  };

  /** The words of a step, as this device works them. */
  const sayFor = (st: TutorialStep): string => (touch ? st.phone ?? deviceObjective([st.say], opts.layout ?? {})[0] : relabelKeys(st.say));
  const steps: TutorialStep[] = opts.tutorial.steps?.length
    ? opts.tutorial.steps
    : opts.tutorial.objective.map((say) => ({ say, demo: 'default' }));
  /** Lines of `s` at most `cols` characters, broken at the spaces. */
  const wrapTo = (str: string, cols: number): string[] => {
    const out: string[] = [];
    let run = '';
    for (const word of str.split(' ')) {
      if (run && run.length + 1 + word.length > cols) {
        out.push(run);
        run = word;
      } else run = run ? `${run} ${word}` : word;
    }
    if (run) out.push(run);
    return out;
  };

  // ------------------------------------------------------------- THE MACHINE
  // What the game is in a line, the best, and the buttons -- nothing the
  // other two pages say.  NO PICTURE HERE (user, 28 Oct): the moving
  // pictures are HOW TO PLAY's, one a step; this page is the words and PLAY,
  // in the middle of the card.
  const MW = 200;
  const machine = (): void => {
    heading.setText(opts.title);
    const cx = CX;
    const pitch = wrapTo(opts.tutorial.pitch ?? opts.tutorial.objective[0] ?? '', Math.floor((MW + 40) / FONT_ADVANCE)).slice(0, 3);
    // (what a win pays is in the bar over the card already: under PLAY goes
    // only what that bar does not say -- that the pocket is short)
    const under = affordable ? '' : `YOU NEED ${opts.cost - opts.balance} MORE`;
    const best = opts.record ?? (opts.keepsRecord ? 'NO BEST YET' : '');
    // the block, measured, then set in the middle of the picture's height
    const h = (best ? 10 : 0) + pitch.length * 9 + 6 + 18 + (under ? 10 : 0) + (opts.onPractice ? 26 : 0) + (free ? 0 : 12);
    let y = Math.max(CARD.y + 17, Math.round(CARD.y + 12 + (BOTTOM_Y - 12 - CARD.y - 12 - h) / 2));
    if (best) {
      keep(centerSmall(scene, cx, y, best, opts.record ? PALETTE.gold : PALETTE.ash).setDepth(903));
      y += 10;
    }
    for (const line of pitch) {
      keep(centerText(scene, cx, y, line, PALETTE.cream).setDepth(903));
      y += 9;
    }
    y += 6 + 8;
    playButton(cx, y, MW, 17);
    y += 10;
    if (under) {
      keep(centerSmall(scene, cx, y + 4, under, PALETTE.blood).setDepth(903));
      y += 10;
    }
    if (opts.onPractice) {
      keep(button(scene, cx, y + 11, 'PRACTICE', practice, { width: MW, height: 15, fill: 0x1f4a5a }).setDepth(905));
      keep(centerSmall(scene, cx, y + 23, 'FREE - WINS NOTHING', PALETTE.tealLight).setDepth(903));
      y += 26;
    }
    if (!free) keep(centerSmall(scene, cx, y + 8, 'LEAVE A PAID GAME AND YOU FORFEIT', PALETTE.ash).setDepth(903));
    keep(button(scene, CX - 98, BOTTOM_Y, 'HOW TO PLAY', () => show('howto'), { width: 90, height: 15 }).setDepth(905));
    keep(button(scene, CX, BOTTOM_Y, 'CONTROLS', () => show('controls'), { width: 90, height: 15 }).setDepth(905));
    keep(button(scene, CX + 98, BOTTOM_Y, 'LEAVE', leave, { width: 90, height: 15, fill: PALETTE.plum }).setDepth(905));
  };

  // ------------------------------------------------------------- HOW TO PLAY
  // A step at a time: its picture, what to do, and where you are in them.
  let stepAt = 0;
  const howTo = (): void => {
    heading.setText(`HOW TO PLAY - ${opts.title}`);
    stepAt = Phaser.Math.Clamp(stepAt, 0, steps.length - 1);
    const st = steps[stepAt];
    showPicture(st.demo);
    keep(smallText(scene, RIGHT_X, CARD.y + 16, `STEP ${stepAt + 1} OF ${steps.length}`, PALETTE.tealLight).setDepth(903));
    let y = CARD.y + 27;
    for (const line of wrapTo(sayFor(st), Math.floor(RIGHT_W / FONT_ADVANCE)).slice(0, 8)) {
      keep(text(scene, RIGHT_X, y, line, PALETTE.cream).setDepth(903));
      y += 10;
    }
    // where you are: a dot a step, the one you are on lit
    const dotsW = steps.length * 8;
    for (let i = 0; i < steps.length; i++) {
      keep(scene.add.rectangle(RIGHT_X + RIGHT_W / 2 - dotsW / 2 + i * 8 + 2, DEMO_Y + DEMO_H - 3, 4, 4, i === stepAt ? PALETTE.gold : 0x3a3450).setOrigin(0, 0).setDepth(903));
    }
    const go = (d: number): void => {
      stepAt = Phaser.Math.Clamp(stepAt + d, 0, steps.length - 1);
      audio.sfx('ui_blip', 0.35);
      show('howto');
    };
    keep(button(scene, CX - 108, BOTTOM_Y, 'BACK', () => show('machine'), { width: 70, height: 15 }).setDepth(905));
    keep(button(scene, CX - 48, BOTTOM_Y, '<', () => go(-1), { width: 30, height: 15, disabled: stepAt === 0 }).setDepth(905));
    keep(button(scene, CX - 12, BOTTOM_Y, '>', () => go(1), { width: 30, height: 15, disabled: stepAt === steps.length - 1 }).setDepth(905));
    playButton(CX + 76, BOTTOM_Y, 130, 15);
    stepKeys = go;
  };
  /** LEFT / RIGHT turn the steps while HOW TO PLAY is up. */
  let stepKeys: ((d: number) => void) | null = null;
  const onLeft = (): void => {
    if (current === 'howto' && stepAt > 0) stepKeys?.(-1);
  };
  const onRight = (): void => {
    if (current === 'howto' && stepAt < steps.length - 1) stepKeys?.(1);
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
    // ---- BOTH WAYS, ON EVERY DEVICE: what each control does, the key on a
    // keyboard (a keycap to click and re-press, on a keyboard) and what a
    // phone gives you for it.  The columns line up; nothing is said twice.
    const COL_DOES = CARD.x + 8;
    const COL_KEY = CARD.x + 132;
    const COL_PHONE = CARD.x + 232;
    let y = CARD.y + 15;
    keep(smallText(scene, COL_DOES, y, 'DOES', PALETTE.ash).setDepth(904));
    keep(smallText(scene, COL_KEY, y, 'KEYBOARD', PALETTE.ash).setDepth(904));
    keep(smallText(scene, COL_PHONE, y, 'PHONE', PALETTE.ash).setDepth(904));
    y += 9;
    const rows = opts.keyRows ?? opts.tutorial.controls;
    const pairs = pairedControls(rows, opts.layout ?? {});
    const maxRows = 8;
    const smallCols = (w: number): number => Math.floor(w / 4);
    rows.slice(0, maxRows).forEach((row, i) => {
      const l = plan.lines[i];
      const pr = pairs[i];
      const doesW = COL_KEY - COL_DOES - 6;
      // (a long one goes into the small font, over two lines if it has to,
      // rather than under the keys)
      const doesLines = row[1].length * FONT_ADVANCE <= doesW ? null : wrapTo(row[1], smallCols(doesW)).slice(0, 2);
      const phoneLines = wrapTo(pr?.phone ?? '-', smallCols(CARD.x + CARD.w - 6 - COL_PHONE)).slice(0, 2);
      const tall = (doesLines?.length ?? 1) > 1 || phoneLines.length > 1;
      if (!doesLines) keep(text(scene, COL_DOES, y, row[1], PALETTE.cream).setDepth(904));
      else doesLines.forEach((ln, k) => keep(smallText(scene, COL_DOES, y + 1 + k * 7, ln, PALETTE.cream).setDepth(904)));
      let x = COL_KEY;
      const caps = [...(l?.actions ?? [])];
      if (!touch && (caps.length || l?.fixed.length)) {
        for (const id of caps) {
          const waiting = listening === id;
          const label = waiting ? 'PRESS' : capLabel(codeFor(id));
          const moved = codeFor(id) !== (KEY_ACTIONS.find((a) => a.id === id)?.code ?? id.slice(id.indexOf(':') + 1));
          const w = Math.max(14, label.length * FONT_ADVANCE + 6);
          if (x + w > COL_PHONE - 4) break;
          keep(button(scene, x + w / 2, y + 3, label, () => listen(id), { width: w, height: 10, fill: waiting ? 0x5a3a12 : moved ? 0x1f4a5a : undefined }).setDepth(905));
          x += w + 2;
        }
        for (const k of l?.fixed ?? []) {
          if (x + k.length * FONT_ADVANCE > COL_PHONE - 4) break;
          keep(text(scene, x + 1, y, k, PALETTE.gold).setDepth(904));
          x += k.length * FONT_ADVANCE + 4;
        }
      } else {
        const k = pr?.keys ?? row[0];
        if (k.length * FONT_ADVANCE <= COL_PHONE - COL_KEY - 4) keep(text(scene, COL_KEY, y, k, PALETTE.gold).setDepth(904));
        else wrapTo(k, smallCols(COL_PHONE - COL_KEY - 4)).slice(0, 2).forEach((ln, j) => keep(smallText(scene, COL_KEY, y + 1 + j * 7, ln, PALETTE.gold).setDepth(904)));
      }
      phoneLines.forEach((ln, k) => keep(smallText(scene, COL_PHONE, y + 1 + k * 7, ln, PALETTE.tealLight).setDepth(904)));
      y += tall ? 16 : 12;
    });
    if (touch) {
      keep(centerSmall(scene, CX, BOTTOM_Y - 14, 'THE BUTTONS ARE ON SCREEN WHILE YOU PLAY', PALETTE.ash).setDepth(903));
      keep(button(scene, CX, BOTTOM_Y, 'BACK', () => show('machine'), { width: 100, height: 15 }).setDepth(905));
      return;
    }
    const hint = note || (listening ? 'PRESS THE NEW KEY - ESC CANCELS' : 'CLICK A KEY TO CHANGE IT.  ESC IS ALWAYS PAUSE');
    keep(centerSmall(scene, CX, BOTTOM_Y - 14, hint, note && !note.startsWith('SWAPPED') ? PALETTE.blood : note ? PALETTE.tealLight : PALETTE.ash).setDepth(903));
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
      kb?.off('keydown-LEFT', onLeft);
      kb?.off('keydown-RIGHT', onRight);
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
  kb?.on('keydown-LEFT', onLeft);
  kb?.on('keydown-RIGHT', onRight);

  return card;
}
