/**
 * ---- KEYS YOU CHOOSE.
 *
 * Every room and every cabinet reads the keys it was written for -- W A S D,
 * E, SHIFT, SPACE, C -- and none of them has to know the player has moved
 * one.  This sits under all of them: a key the player has chosen for an
 * action is turned, the moment it is pressed, into the key that action was
 * written for, and the old key stops doing it.  So rebinding INTERACT to F
 * makes F open doors, pull cranes and drop claws everywhere E used to, and E
 * goes quiet -- unless it has itself been given to something else.
 *
 * The arrows stay as they are, as the always-there second way to move, and
 * Esc is never moved: it is the way out of everything, this menu included.
 *
 * Device-wide, like the touch pad's style: a keyboard is a keyboard whoever
 * is playing on it, so it is kept apart from the profiles.
 */

export interface KeyAction {
  id: string;
  label: string;
  /** The key the game is written for. */
  code: string;
  key: string;
  keyCode: number;
}

export const KEY_ACTIONS: KeyAction[] = [
  { id: 'up', label: 'MOVE UP', code: 'KeyW', key: 'w', keyCode: 87 },
  { id: 'left', label: 'MOVE LEFT', code: 'KeyA', key: 'a', keyCode: 65 },
  { id: 'down', label: 'MOVE DOWN', code: 'KeyS', key: 's', keyCode: 83 },
  { id: 'right', label: 'MOVE RIGHT', code: 'KeyD', key: 'd', keyCode: 68 },
  { id: 'interact', label: 'INTERACT', code: 'KeyE', key: 'e', keyCode: 69 },
  { id: 'run', label: 'RUN', code: 'ShiftLeft', key: 'Shift', keyCode: 16 },
  { id: 'jump', label: 'JUMP / ACTION', code: 'Space', key: ' ', keyCode: 32 },
  { id: 'crouch', label: 'CROUCH', code: 'KeyC', key: 'c', keyCode: 67 },
  // (the pockets: open the inventory, wherever it can be opened -- ui/pockets)
  { id: 'inventory', label: 'INVENTORY', code: 'KeyG', key: 'g', keyCode: 71 },
];

const STORE = 'froggy.keymap.v1';
/** Never rebindable, never a target: the way out, and the arrows. */
const LOCKED = new Set(['Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** action id -> the code the player chose for it (absent: as written). */
let chosen: Record<string, string> = {};

function load(): void {
  try {
    const raw = localStorage.getItem(STORE);
    chosen = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    chosen = {};
  }
}

function save(): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(chosen));
  } catch {
    // (a private window: it lasts the session)
  }
}

/** The code an action is on now. */
export function codeFor(id: string): string {
  return chosen[id] ?? KEY_ACTIONS.find((a) => a.id === id)?.code ?? '';
}

/** A key code as a keycap says it: KeyF -> F, Digit3 -> 3, ShiftLeft -> SHIFT. */
export function capLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM${code.slice(6)}`;
  if (code.startsWith('Shift')) return 'SHIFT';
  if (code.startsWith('Control')) return 'CTRL';
  if (code.startsWith('Alt')) return 'ALT';
  if (code === 'Space') return 'SPACE';
  if (code === 'Enter') return 'ENTER';
  if (code === 'Tab') return 'TAB';
  if (code === 'Backquote') return '`';
  return code.toUpperCase().slice(0, 6);
}

/** Can this key be chosen at all? */
export function bindable(code: string): boolean {
  return !!code && !LOCKED.has(code);
}

/**
 * Put `id` on `code`.  Whatever had that key SWAPS onto this action's old
 * one, so two actions never share a key and none is ever left with none.
 */
export function bind(id: string, code: string): void {
  if (!bindable(code)) return;
  const a = KEY_ACTIONS.find((x) => x.id === id);
  if (!a) return;
  const prev = codeFor(id);
  const set = (x: KeyAction, c: string): void => {
    if (c === x.code) delete chosen[x.id];
    else chosen[x.id] = c;
  };
  for (const other of KEY_ACTIONS) if (other.id !== id && codeFor(other.id) === code) set(other, prev);
  set(a, code);
  save();
}

export function resetKeys(): void {
  chosen = {};
  save();
}

/** Has anything been moved? */
export function remapped(): boolean {
  return Object.keys(chosen).length > 0;
}

/** While the settings are listening for a new key, nothing is translated. */
let listening = false;
export function setListening(on: boolean): void {
  listening = on;
}

function synth(type: string, a: KeyAction, src: KeyboardEvent): KeyboardEvent {
  const ev = new KeyboardEvent(type, {
    key: a.key,
    code: a.code,
    keyCode: a.keyCode,
    which: a.keyCode,
    repeat: src.repeat,
    shiftKey: a.id === 'run' ? type === 'keydown' : src.shiftKey,
    bubbles: true,
    cancelable: true,
  } as KeyboardEventInit);
  if (ev.keyCode !== a.keyCode) {
    Object.defineProperty(ev, 'keyCode', { get: () => a.keyCode });
    Object.defineProperty(ev, 'which', { get: () => a.keyCode });
  }
  return ev;
}

let installed = false;

/** Listen first, before the game does, and translate. */
export function installKeymap(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  load();
  const handle = (e: KeyboardEvent): void => {
    // (only real presses: what this sends, and the touch pad's, pass straight on)
    if (!e.isTrusted || listening || !remapped()) return;
    const to = KEY_ACTIONS.find((a) => codeFor(a.id) === e.code && a.code !== e.code);
    if (to) {
      e.stopImmediatePropagation();
      e.preventDefault();
      window.dispatchEvent(synth(e.type, to, e));
      return;
    }
    // a key the player moved an action OFF, and has not given to anything:
    // it no longer does what it did
    const from = KEY_ACTIONS.find((a) => a.code === e.code && chosen[a.id] && chosen[a.id] !== a.code);
    if (from) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  };
  window.addEventListener('keydown', handle, true);
  window.addEventListener('keyup', handle, true);
}

/**
 * A line of controls as printed for the keys as written ("A / D", "E",
 * "SHIFT"), said with the keys the player actually has them on.  Every key
 * list the game shows -- the how-to-play cards, the pause menu's controls --
 * comes through here, so none of them tells you to press a key that no
 * longer does it.
 */
export function relabelKeys(s: string): string {
  if (!remapped()) return s;
  return s.replace(/\b(W|A|S|D|E|C|SHIFT|SPACE)\b/g, (m) => {
    const a = KEY_ACTIONS.find((x) => capLabel(x.code) === m);
    return a ? capLabel(codeFor(a.id)) : m;
  });
}
