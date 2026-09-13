/**
 * On-screen controls, for playing the whole thing with two thumbs.
 *
 * THE TRICK IS THAT NO GAME KNOWS THIS EXISTS.  Every scene and every cabinet
 * in the building already reads the keyboard — `Key.isDown` for held keys,
 * `keydown-SPACE` for taps — so the thumbstick and the buttons do not talk to
 * the games at all.  They dispatch REAL KeyboardEvents at the window, which is
 * exactly where Phaser's keyboard manager is listening, and eighteen cabinets,
 * three rooms and the whole horror act read them as keys because they are
 * keys.  Nothing downstream branches on the platform, so nothing downstream
 * can behave differently on a phone than it does on a desk.
 *
 * WHAT SHOWS IS WHAT THE THING IN FRONT OF YOU READS.  A layout is a stick, a
 * look pad and up to five labelled buttons, and it is swapped as scenes come
 * and go (see `game/touchLayouts.ts`); a cabinet declares its own in its
 * module, next to the tutorial card that names the same keys.  A player never
 * sees a button that does nothing here.
 *
 * IN PORTRAIT THE CONTROLS ARE NOT ON THE GAME.  A 16:9 screen inside a tall
 * phone leaves a band of dead black under it, and that band is where the
 * controls go — nothing overlaps the picture, so nothing can cover a timer, a
 * score, a dialogue box or a button.  Landscape has no such band, so there the
 * controls sit in the two bottom corners at reduced opacity, in the strip of
 * carpet every room keeps clear.
 *
 * On anything that is not a touch device this module mounts nothing at all.
 */

import { isTouch } from '../core/device';

/** Every key the building actually binds, with the code Phaser matches on. */
const KEYS = {
  W: { key: 'w', code: 'KeyW', keyCode: 87 },
  A: { key: 'a', code: 'KeyA', keyCode: 65 },
  S: { key: 's', code: 'KeyS', keyCode: 83 },
  D: { key: 'd', code: 'KeyD', keyCode: 68 },
  UP: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  DOWN: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  LEFT: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  RIGHT: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  SPACE: { key: ' ', code: 'Space', keyCode: 32 },
  ENTER: { key: 'Enter', code: 'Enter', keyCode: 13 },
  ESC: { key: 'Escape', code: 'Escape', keyCode: 27 },
  SHIFT: { key: 'Shift', code: 'ShiftLeft', keyCode: 16 },
  C: { key: 'c', code: 'KeyC', keyCode: 67 },
  E: { key: 'e', code: 'KeyE', keyCode: 69 },
  H: { key: 'h', code: 'KeyH', keyCode: 72 },
  I: { key: 'i', code: 'KeyI', keyCode: 73 },
  J: { key: 'j', code: 'KeyJ', keyCode: 74 },
  K: { key: 'k', code: 'KeyK', keyCode: 75 },
  L: { key: 'l', code: 'KeyL', keyCode: 76 },
  Q: { key: 'q', code: 'KeyQ', keyCode: 81 },
  X: { key: 'x', code: 'KeyX', keyCode: 88 },
  ONE: { key: '1', code: 'Digit1', keyCode: 49 },
  TWO: { key: '2', code: 'Digit2', keyCode: 50 },
  THREE: { key: '3', code: 'Digit3', keyCode: 51 },
  FOUR: { key: '4', code: 'Digit4', keyCode: 52 },
} as const;

export type KeyName = keyof typeof KEYS;

/** One labelled button.  The label is what the player reads, `key` is what it sends. */
export interface TouchButton {
  label: string;
  key: KeyName;
  /**
   * A second key sent with the first, for the games that read two names for
   * one idea (`SPACE` and `W` both jump in Falling Blocks).
   */
  also?: KeyName;
  /** Bigger and brighter: the one button the game is mostly about. */
  primary?: boolean;
}

export interface TouchLayout {
  /**
   * What the thumbstick sends.  `wasd` is the full four; `lr` and `ud` are the
   * games that only move on one axis, so the stick cannot send a key the game
   * would ignore.  Omit for a game with nothing to steer.
   */
  stick?: 'wasd' | 'lr' | 'ud';
  /** Also send the arrow keys with WASD, for the games bound to arrows only. */
  arrows?: boolean;
  /** A drag-anywhere-on-the-picture look pad, for the two 3D rooms. */
  look?: boolean;
  /** Up to five, right to left in the order given. */
  buttons?: TouchButton[];
  /** Hide the standing ESC button — the title screen and the end cards. */
  noQuit?: boolean;
}

const STYLE = `
#touch-controls {
  position: fixed; inset: 0; z-index: 30;
  pointer-events: none;
  touch-action: none;
  -webkit-user-select: none; user-select: none;
  -webkit-tap-highlight-color: transparent;
  font-family: ui-monospace, "Courier New", monospace;
}
#touch-controls .tc-zone {
  position: absolute; bottom: 0; height: var(--tc-band, 190px);
  display: flex; align-items: center;
  pointer-events: none;
}
#touch-controls .tc-left { left: 0; width: 46%; justify-content: center; }
#touch-controls .tc-right { right: 0; width: 54%; justify-content: center; }

#touch-controls .tc-stick {
  position: relative; pointer-events: auto; touch-action: none;
  width: var(--tc-stick, 132px); height: var(--tc-stick, 132px);
  border-radius: 50%;
  background: rgba(20, 26, 36, 0.62);
  border: 2px solid rgba(70, 196, 189, 0.5);
  box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.55);
}
#touch-controls .tc-stick::before,
#touch-controls .tc-stick::after {
  content: ''; position: absolute; background: rgba(70, 196, 189, 0.18);
}
#touch-controls .tc-stick::before { left: 8%; right: 8%; top: 50%; height: 1px; }
#touch-controls .tc-stick::after { top: 8%; bottom: 8%; left: 50%; width: 1px; }
#touch-controls .tc-nub {
  position: absolute; left: 50%; top: 50%;
  width: 42%; height: 42%; margin: -21% 0 0 -21%;
  border-radius: 50%;
  background: rgba(70, 196, 189, 0.55);
  border: 2px solid rgba(255, 240, 201, 0.65);
  transition: background 90ms linear;
}
#touch-controls .tc-stick.on .tc-nub { background: rgba(255, 212, 94, 0.75); }

#touch-controls .tc-pads {
  display: grid; gap: var(--tc-gap, 10px);
  grid-template-columns: repeat(2, auto);
  justify-items: center; align-items: center;
}
#touch-controls .tc-pads.one { grid-template-columns: auto; }
#touch-controls .tc-pads.three { grid-template-columns: repeat(3, auto); }

#touch-controls .tc-btn {
  pointer-events: auto; touch-action: none;
  display: flex; align-items: center; justify-content: center;
  min-width: var(--tc-btn, 62px); height: var(--tc-btn, 62px);
  padding: 0 10px;
  border-radius: 50%;
  background: rgba(61, 42, 92, 0.72);
  border: 2px solid rgba(255, 212, 94, 0.6);
  color: #fff0c9; font-size: var(--tc-font, 13px); font-weight: 700;
  letter-spacing: 0.5px; text-align: center; line-height: 1.05;
}
#touch-controls .tc-btn.primary {
  background: rgba(20, 92, 95, 0.8);
  border-color: rgba(70, 196, 189, 0.9);
  min-width: calc(var(--tc-btn, 62px) * 1.25);
  height: calc(var(--tc-btn, 62px) * 1.25);
}
#touch-controls .tc-btn.down { background: rgba(255, 212, 94, 0.85); color: #141a24; }

/* The standing pair: quit at the top right, always reachable, never big. */
#touch-controls .tc-corner {
  position: absolute; top: 6px; right: 6px;
  pointer-events: auto; touch-action: none;
  padding: 7px 11px; border-radius: 8px;
  background: rgba(11, 13, 18, 0.72);
  border: 1px solid rgba(140, 155, 173, 0.6);
  color: #d6dce4; font-size: 12px; font-weight: 700;
}
#touch-controls .tc-corner.down { background: rgba(195, 31, 46, 0.85); color: #fff; }

/* The look pad covers the picture, so a drag turns you and nothing else. */
#touch-controls .tc-look {
  position: absolute; pointer-events: auto; touch-action: none;
  background: transparent;
}

/* Landscape has no dead band under the picture, so the controls go over the
   two bottom corners — the strip every room keeps clear of anything you can
   read — and they go quiet enough to see the floor through. */
#touch-controls.overlay .tc-zone { height: var(--tc-band, 150px); opacity: 0.72; }
#touch-controls.overlay .tc-left { width: 38%; justify-content: flex-start; padding-left: 8px; }
#touch-controls.overlay .tc-right { width: 46%; justify-content: flex-end; padding-right: 8px; }

#touch-controls[hidden] { display: none; }
`;

type Held = Set<KeyName>;

class TouchControls {
  private root: HTMLDivElement | null = null;
  private stick: HTMLDivElement | null = null;
  private nub: HTMLDivElement | null = null;
  private pads: HTMLDivElement | null = null;
  private quit: HTMLButtonElement | null = null;
  private lookPad: HTMLDivElement | null = null;
  private layout: TouchLayout = {};
  private held: Held = new Set();
  private stickTouch: number | null = null;
  private lookTouch: number | null = null;
  private lookX = 0;
  private lookY = 0;
  private band = 0;

  /** No-op on anything without a thumb on it. */
  mount(): void {
    if (this.root || !isTouch()) return;

    const style = document.createElement('style');
    style.id = 'touch-controls-style';
    style.textContent = STYLE;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'touch-controls';
    root.innerHTML =
      '<div class="tc-look" hidden></div>' +
      '<div class="tc-zone tc-left"><div class="tc-stick"><div class="tc-nub"></div></div></div>' +
      '<div class="tc-zone tc-right"><div class="tc-pads"></div></div>' +
      '<button class="tc-corner" type="button">ESC</button>';
    document.body.appendChild(root);

    this.root = root;
    this.lookPad = root.querySelector('.tc-look');
    this.stick = root.querySelector('.tc-stick');
    this.nub = root.querySelector('.tc-nub');
    this.pads = root.querySelector('.tc-pads');
    this.quit = root.querySelector('.tc-corner');

    this.wireStick();
    this.wireLook();
    this.wireHold(this.quit as HTMLElement, ['ESC']);

    window.addEventListener('resize', () => this.relayout());
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.relayout(), 120));
    // A finger lifted outside the button it started on must not leave a key
    // stuck down for the rest of the round.
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });

    this.apply({});
    this.relayout();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__touch = {
        held: () => this.heldKeys(),
        layout: () => this.layout,
        labels: () => [...root.querySelectorAll('.tc-btn')].map((b) => b.textContent ?? ''),
        band: () => this.band,
        reserve: () => this.reserveHeight(),
      };
    }
  }

  mounted(): boolean {
    return this.root !== null;
  }

  /** Swap what is on screen.  Called as scenes and cabinets come and go. */
  apply(layout: TouchLayout): void {
    if (!this.root) return;
    this.releaseAll();
    this.layout = layout;

    const zoneL = this.root.querySelector('.tc-left') as HTMLElement;
    zoneL.style.visibility = layout.stick ? 'visible' : 'hidden';

    const buttons = (layout.buttons ?? []).slice(0, 5);
    const pads = this.pads as HTMLDivElement;
    pads.innerHTML = '';
    pads.className = 'tc-pads' + (buttons.length === 1 ? ' one' : buttons.length >= 5 ? ' three' : '');
    for (const b of buttons) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'tc-btn' + (b.primary ? ' primary' : '');
      el.textContent = b.label;
      el.dataset.key = b.key;
      pads.appendChild(el);
      this.wireHold(el, b.also ? [b.key, b.also] : [b.key]);
    }

    (this.quit as HTMLElement).hidden = layout.noQuit === true;
    (this.lookPad as HTMLElement).hidden = layout.look !== true;
    this.relayout();
  }

  /** Everything up.  Safe at any moment, and the only way keys are released. */
  releaseAll(): void {
    for (const k of [...this.held]) this.up(k);
    this.stickTouch = null;
    this.lookTouch = null;
    this.stick?.classList.remove('on');
    if (this.nub) this.nub.style.transform = '';
    this.root?.querySelectorAll('.down').forEach((el) => el.classList.remove('down'));
  }

  /** Which keys the thumbs are holding down, for the harness. */
  heldKeys(): string[] {
    return [...this.held];
  }

  /**
   * The LEAST room the controls will accept under the picture, in CSS pixels.
   *
   * This is what the scaler subtracts before deciding how big the picture can
   * be, and it is what the band is then set to.  A 320-wide buffer on a phone
   * is capped by the WIDTH, so a tall screen has slack going spare either way:
   * it is better spent on controls big enough to hit without looking at them
   * than on more black between the picture and the thumbs.
   *
   * Zero in landscape, where there is no slack at all and the controls are
   * drawn over the corners of the picture instead of under it.
   */
  reserveHeight(): number {
    if (!this.root || !isTouch()) return 0;
    if (window.innerHeight < window.innerWidth) return 0;
    return Math.round(Math.min(Math.max(window.innerHeight * 0.34, 190), window.innerHeight * 0.5));
  }

  /** How big the thumbstick is right now, which everything else is sized off. */
  private stickPx(): number {
    const short = Math.min(window.innerWidth, window.innerHeight);
    // Landscape is short: the same fraction of the screen there would be a
    // stick taller than the strip it has to fit in.
    const portrait = window.innerHeight >= window.innerWidth;
    return portrait
      ? Math.round(Math.min(190, Math.max(110, short * 0.42)))
      : Math.round(Math.min(122, Math.max(88, short * 0.29)));
  }

  /** How much room the controls actually got.  Set by the scaler. */
  setBand(px: number): void {
    this.band = Math.max(0, Math.round(px));
    this.relayout();
  }

  /** Position the controls and the look pad against the canvas as it is now. */
  relayout(): void {
    if (!this.root) return;
    const portrait = window.innerHeight >= window.innerWidth;
    this.root.classList.toggle('overlay', !portrait);

    // The stick sets the scale of everything, and the band is whatever holds
    // it — never the other way round, or the stick hangs off the screen.
    const stick = this.stickPx();
    const band = portrait
      ? Math.max(this.band, this.reserveHeight(), stick + 24)
      : Math.min(Math.round(window.innerHeight * 0.46), stick + 18);
    this.root.style.setProperty('--tc-band', `${band}px`);
    this.root.style.setProperty('--tc-stick', `${stick}px`);
    this.root.style.setProperty('--tc-btn', `${Math.round(stick * (portrait ? 0.48 : 0.44))}px`);
    this.root.style.setProperty('--tc-font', `${Math.round(Math.min(17, Math.max(11, stick * 0.09)))}px`);
    this.root.style.setProperty('--tc-gap', `${Math.round(Math.min(16, Math.max(7, stick * 0.06)))}px`);

    // The look pad covers exactly the picture, never the controls under it.
    const canvas = document.querySelector('#game-root canvas') as HTMLCanvasElement | null;
    const pad = this.lookPad as HTMLElement;
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      pad.style.left = `${Math.round(r.left)}px`;
      pad.style.top = `${Math.round(r.top)}px`;
      pad.style.width = `${Math.round(r.width)}px`;
      pad.style.height = `${Math.round(r.height)}px`;
    }
  }

  // ------------------------------------------------------------------ input

  private wireStick(): void {
    const el = this.stick;
    if (!el) return;
    const start = (e: TouchEvent) => {
      if (this.stickTouch !== null || !this.layout.stick) return;
      const t = e.changedTouches[0];
      this.stickTouch = t.identifier;
      el.classList.add('on');
      this.aim(t);
      e.preventDefault();
    };
    const move = (e: TouchEvent) => {
      const t = this.find(e, this.stickTouch);
      if (!t) return;
      this.aim(t);
      e.preventDefault();
    };
    const end = (e: TouchEvent) => {
      if (!this.find(e, this.stickTouch)) return;
      this.stickTouch = null;
      el.classList.remove('on');
      if (this.nub) this.nub.style.transform = '';
      for (const k of ['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT'] as KeyName[]) this.up(k);
      e.preventDefault();
    };
    el.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end, { passive: false });
    window.addEventListener('touchcancel', end, { passive: false });
  }

  /**
   * Where the thumb is, as up to two held directions.
   *
   * Eight-way with a real dead zone: a thumb resting in the middle of the pad
   * must not creep, and a thumb pushed up-and-slightly-left must not turn into
   * a left turn.  The minor axis has to be over half the major one before it
   * counts, so the four straight directions are wide and the diagonals are
   * deliberate.
   */
  private aim(t: Touch): void {
    const el = this.stick as HTMLElement;
    const r = el.getBoundingClientRect();
    const dx = t.clientX - (r.left + r.width / 2);
    const dy = t.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    const dead = r.width * 0.18;

    if (this.nub) {
      const cap = Math.min(len, r.width * 0.29);
      const nx = len > 0 ? (dx / len) * cap : 0;
      const ny = len > 0 ? (dy / len) * cap : 0;
      this.nub.style.transform = `translate(${nx}px, ${ny}px)`;
    }

    const axis = this.layout.stick ?? 'wasd';
    const want = new Set<KeyName>();
    if (len > dead) {
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (axis !== 'ud' && ax > ay * 0.5) want.add(dx > 0 ? 'D' : 'A');
      if (axis !== 'lr' && ay > ax * 0.5) want.add(dy > 0 ? 'S' : 'W');
    }
    if (this.layout.arrows) {
      const alias: Partial<Record<KeyName, KeyName>> = { W: 'UP', S: 'DOWN', A: 'LEFT', D: 'RIGHT' };
      for (const k of [...want]) {
        const a = alias[k];
        if (a) want.add(a);
      }
    }

    for (const k of ['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT'] as KeyName[]) {
      if (want.has(k)) this.down(k);
      else this.up(k);
    }
  }

  /** A button: down while the thumb is on it, up the instant it leaves. */
  private wireHold(el: HTMLElement, keys: KeyName[]): void {
    const press = (e: Event) => {
      el.classList.add('down');
      for (const k of keys) this.down(k);
      e.preventDefault();
    };
    const release = (e: Event) => {
      el.classList.remove('down');
      for (const k of keys) this.up(k);
      e.preventDefault();
    };
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false });
    // A mouse works too, so the layout can be driven on a desktop with
    // `?touch=1` — which is how it is tested.
    el.addEventListener('mousedown', press);
    window.addEventListener('mouseup', () => {
      if (el.classList.contains('down')) release(new Event('mouseup'));
    });
  }

  /**
   * Drag to look.  The two 3D rooms already turn on a held mouse drag, so the
   * pad speaks their language rather than inventing a second one: a real
   * MouseEvent at the window, with a movementX the room can read.
   */
  private wireLook(): void {
    const el = this.lookPad;
    if (!el) return;
    const start = (e: TouchEvent) => {
      if (this.lookTouch !== null) return;
      const t = e.changedTouches[0];
      this.lookTouch = t.identifier;
      this.lookX = t.clientX;
      this.lookY = t.clientY;
      window.dispatchEvent(mouse('mousedown', t.clientX, t.clientY, 0, 0));
      e.preventDefault();
    };
    const move = (e: TouchEvent) => {
      const t = this.find(e, this.lookTouch);
      if (!t) return;
      const dx = t.clientX - this.lookX;
      const dy = t.clientY - this.lookY;
      this.lookX = t.clientX;
      this.lookY = t.clientY;
      window.dispatchEvent(mouse('mousemove', t.clientX, t.clientY, dx, dy));
      e.preventDefault();
    };
    const end = (e: TouchEvent) => {
      const t = this.find(e, this.lookTouch);
      if (!t) return;
      this.lookTouch = null;
      window.dispatchEvent(mouse('mouseup', t.clientX, t.clientY, 0, 0));
      e.preventDefault();
    };
    el.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end, { passive: false });
    window.addEventListener('touchcancel', end, { passive: false });
  }

  private find(e: TouchEvent, id: number | null): Touch | null {
    if (id === null) return null;
    for (const t of Array.from(e.changedTouches)) if (t.identifier === id) return t;
    return null;
  }

  private down(k: KeyName): void {
    if (this.held.has(k)) return;
    this.held.add(k);
    window.dispatchEvent(keyEvent('keydown', k));
  }

  private up(k: KeyName): void {
    if (!this.held.has(k)) return;
    this.held.delete(k);
    window.dispatchEvent(keyEvent('keyup', k));
  }
}

/**
 * A keyboard event Phaser will believe.  Phaser matches on `keyCode`, which
 * some engines refuse to take from the constructor, so it is pinned onto the
 * instance when the constructor drops it.
 */
function keyEvent(type: 'keydown' | 'keyup', name: KeyName): KeyboardEvent {
  const k = KEYS[name];
  const init = {
    key: k.key,
    code: k.code,
    keyCode: k.keyCode,
    which: k.keyCode,
    bubbles: true,
    cancelable: true,
  } as KeyboardEventInit;
  const ev = new KeyboardEvent(type, init);
  if (ev.keyCode !== k.keyCode) {
    Object.defineProperty(ev, 'keyCode', { get: () => k.keyCode });
    Object.defineProperty(ev, 'which', { get: () => k.keyCode });
  }
  return ev;
}

function mouse(type: string, x: number, y: number, dx: number, dy: number): MouseEvent {
  const ev = new MouseEvent(type, {
    clientX: x,
    clientY: y,
    button: 0,
    buttons: type === 'mouseup' ? 0 : 1,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(ev, 'movementX', { get: () => dx });
  Object.defineProperty(ev, 'movementY', { get: () => dy });
  return ev;
}

export const touchControls = new TouchControls();
