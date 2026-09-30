/**
 * On-screen controls, for playing the whole thing with two thumbs.
 *
 * THE TRICK IS THAT NO GAME KNOWS THIS EXISTS.  Every scene and every cabinet
 * in the building already reads the keyboard — `Key.isDown` for held keys,
 * `keydown-SPACE` for taps — so the arrow pad and the buttons do not talk to
 * the games at all.  They dispatch REAL KeyboardEvents at the window, which is
 * exactly where Phaser's keyboard manager is listening, and eighteen cabinets,
 * three rooms and the whole horror act read them as keys because they are
 * keys.  Nothing downstream branches on the platform, so nothing downstream
 * can behave differently on a phone than it does on a desk.
 *
 * WHAT SHOWS IS WHAT THE THING IN FRONT OF YOU READS.  A layout is a pad, a
 * look pad and up to five labelled buttons, and it is swapped as scenes come
 * and go (see `game/touchLayouts.ts`); a cabinet declares its own in its
 * module, next to the tutorial card that names the same keys.  A player never
 * sees a button that does nothing here.
 *
 * AN ARROW PAD, NOT A STICK.  Eight arrows round an empty middle: the four
 * straight ones and the four diagonals between them.  The thumb goes down on
 * one and can slide round the ring without lifting -- whatever arrow is under
 * it is held, for as long as it is there, so holding right walks right until
 * the thumb comes off.  A diagonal is its own arrow, and it is also what two
 * fingers on two straight arrows add up to: both directions go down together,
 * so up-and-left is up-and-left either way.  It only shows the arrows the game
 * in front of it reads; a one-axis game gets two.
 *
 * THE CONTROLS ARE NEVER ON THE GAME.  In portrait a 16:9 picture inside a
 * tall phone leaves a band under it, and that band is where the controls go.
 * In landscape they take a column either side of the picture instead -- a
 * wide phone has most of one going spare already -- and the picture is fitted
 * between them.  Either way nothing a thumb presses can cover a timer, a
 * score, a dialogue box or the thing being hidden in.  Every band and column
 * is a themed panel rather than dead black, and all of it sits inside the
 * phone's safe area, clear of the notch and the rounded corners.
 *
 * AND THEY WEAR THE BUILDING'S MOOD.  Through the horror act they are rusted
 * iron -- scratched, worn at the edges, a little dried blood; once it is over
 * they are the arcade's again, but not quite: a shade off, a faint scar.
 *
 * On anything that is not a touch device this module mounts nothing at all.
 */

import { isTouch, safeInsets } from '../core/device';

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
  F: { key: 'f', code: 'KeyF', keyCode: 70 },
  H: { key: 'h', code: 'KeyH', keyCode: 72 },
  I: { key: 'i', code: 'KeyI', keyCode: 73 },
  J: { key: 'j', code: 'KeyJ', keyCode: 74 },
  K: { key: 'k', code: 'KeyK', keyCode: 75 },
  L: { key: 'l', code: 'KeyL', keyCode: 76 },
  Q: { key: 'q', code: 'KeyQ', keyCode: 81 },
  R: { key: 'r', code: 'KeyR', keyCode: 82 },
  X: { key: 'x', code: 'KeyX', keyCode: 88 },
  ONE: { key: '1', code: 'Digit1', keyCode: 49 },
  TWO: { key: '2', code: 'Digit2', keyCode: 50 },
  THREE: { key: '3', code: 'Digit3', keyCode: 51 },
  FOUR: { key: '4', code: 'Digit4', keyCode: 52 },
  FIVE: { key: '5', code: 'Digit5', keyCode: 53 },
  SIX: { key: '6', code: 'Digit6', keyCode: 54 },
  SEVEN: { key: '7', code: 'Digit7', keyCode: 55 },
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
   * What the arrow pad sends.  `wasd` is all eight arrows; `lr` and `ud` are
   * the games that only move on one axis, so the pad cannot send a key the
   * game would ignore.  Omit for a game with nothing to steer.  (Named for the
   * thumbstick it replaced, so no cabinet's layout had to change.)
   */
  stick?: 'wasd' | 'lr' | 'ud';
  /** Also send the arrow keys with WASD, for the games bound to arrows only. */
  arrows?: boolean;
  /**
   * A drag-anywhere-on-the-picture look pad, for the two 3D rooms.  With it,
   * the arrow pad sends WASD ONLY: in those rooms the arrow keys turn the
   * head, and the pad must walk without ever turning the camera.
   */
  look?: boolean;
  /** Up to five, right to left in the order given. */
  buttons?: TouchButton[];
  /** Hide the standing pause (gear) button — the title screen and the end cards. */
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

/* The arrow pad: a ring of eight arrows round an empty middle.  The pad
   itself takes the touch, so a thumb can slide from arrow to arrow without
   lifting; the arrows are only what it looks like. */
#touch-controls .tc-dpad {
  position: relative; pointer-events: auto; touch-action: none;
  width: var(--tc-stick, 150px); height: var(--tc-stick, 150px);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 4px;
}
#touch-controls .tc-dkey {
  pointer-events: none;
  display: flex; align-items: center; justify-content: center;
  border-radius: 12px;
  background: rgba(20, 26, 36, 0.74);
  border: 2px solid rgba(70, 196, 189, 0.55);
  color: #46c4bd; font-size: calc(var(--tc-stick, 150px) * 0.17); line-height: 1;
  padding: 0;
}
#touch-controls .tc-dkey.diag {
  background: rgba(20, 26, 36, 0.5);
  border-color: rgba(70, 196, 189, 0.3);
  font-size: calc(var(--tc-stick, 150px) * 0.13);
}
#touch-controls .tc-dkey.down { background: rgba(255, 212, 94, 0.85); color: #141a24; border-color: rgba(255, 240, 201, 0.9); }
#touch-controls .tc-dhub {
  grid-area: 2 / 2; border-radius: 50%; margin: 18%;
  background: rgba(70, 196, 189, 0.16); border: 1px solid rgba(70, 196, 189, 0.3);
  pointer-events: none;
}
/* A display of flex beats the [hidden] default, so the rule has to say so. */
#touch-controls .tc-dkey[hidden] { display: none; }
#touch-controls .tc-dkey.n { grid-area: 1 / 2; }
#touch-controls .tc-dkey.w { grid-area: 2 / 1; }
#touch-controls .tc-dkey.e { grid-area: 2 / 3; }
#touch-controls .tc-dkey.s { grid-area: 3 / 2; }
#touch-controls .tc-dkey.nw { grid-area: 1 / 1; }
#touch-controls .tc-dkey.ne { grid-area: 1 / 3; }
#touch-controls .tc-dkey.sw { grid-area: 3 / 1; }
#touch-controls .tc-dkey.se { grid-area: 3 / 3; }

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

/* The gear: pause and settings, at the top right, always reachable. */
#touch-controls .tc-corner {
  position: absolute; top: 8px; right: 8px;
  pointer-events: auto; touch-action: none;
  width: 44px; height: 44px; padding: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px;
  background: rgba(11, 13, 18, 0.72);
  border: 1px solid rgba(140, 155, 173, 0.6);
  color: #d6dce4; font-size: 26px; line-height: 1;
}
#touch-controls .tc-corner.down { background: rgba(195, 31, 46, 0.85); color: #fff; }

/* The look pad covers the picture, so a drag turns you and nothing else. */
#touch-controls .tc-look {
  position: absolute; pointer-events: auto; touch-action: none;
  background: transparent;
}

/* The band in portrait sits above the home bar. */
#touch-controls .tc-zone { padding-bottom: var(--tc-safe-b, 0px); box-sizing: border-box; }

/* Landscape: a column either side of the picture, and the controls in the
   lower middle of each, where the thumbs rest.  Five buttons go two across,
   not three, so the column stays narrow. */
#touch-controls.overlay .tc-zone {
  top: 0; bottom: 0; height: auto;
  align-items: center; padding-top: 16vh; padding-bottom: var(--tc-safe-b, 0px);
}
#touch-controls.overlay .tc-left { left: 0; width: var(--tc-side, 160px); padding-left: var(--tc-safe-l, 0px); }
#touch-controls.overlay .tc-right { right: 0; width: var(--tc-side, 160px); padding-right: var(--tc-safe-r, 0px); }
#touch-controls.overlay .tc-pads.three { grid-template-columns: repeat(2, auto); }
#touch-controls .tc-corner { top: max(8px, var(--tc-safe-t, 0px)); right: max(8px, var(--tc-safe-r, 0px)); }
/* In portrait the picture sits right at the top, so the gear lives in the
   top corner of the controls' panel instead of over the picture, and the
   controls sit low in the panel, under the thumbs. */
#touch-controls:not(.overlay) .tc-corner { top: auto; bottom: calc(var(--tc-band, 190px) - 56px); }
#touch-controls:not(.overlay) .tc-zone { align-items: flex-end; padding-bottom: calc(var(--tc-safe-b, 0px) + min(7vh, 60px)); }

/* The panels behind the controls: the arcade's purple with its pink trim and
   a scatter of lily pads, never plain black. */
#touch-controls .tc-panel {
  position: absolute; pointer-events: none;
  background:
    radial-gradient(circle at 18% 30%, rgba(63, 227, 155, 0.08) 0 7px, transparent 8px),
    radial-gradient(circle at 72% 64%, rgba(63, 227, 155, 0.07) 0 9px, transparent 10px),
    radial-gradient(circle at 42% 86%, rgba(255, 79, 163, 0.06) 0 6px, transparent 7px),
    linear-gradient(180deg, #24123a 0%, #150b24 100%);
  background-size: 120px 120px, 150px 150px, 90px 90px, 100% 100%;
}
#touch-controls .tc-panel.l { left: 0; right: 0; bottom: 0; height: var(--tc-band, 190px); border-top: 2px solid rgba(255, 79, 163, 0.55); }
#touch-controls .tc-panel.r { display: none; }
#touch-controls.overlay .tc-panel.l { top: 0; right: auto; height: auto; width: var(--tc-side, 160px); border-top: 0; border-right: 2px solid rgba(255, 79, 163, 0.55); }
#touch-controls.overlay .tc-panel.r { display: block; top: 0; bottom: 0; right: 0; width: var(--tc-side, 160px); border-left: 2px solid rgba(255, 79, 163, 0.55); }
#touch-controls.bare .tc-panel { display: none !important; }

/* ---- THE HORROR SKIN.  Rusted iron: a mottled rust ground, fine scratches
   across it, worn bright metal at the edges, and a little dried blood --
   enough to be unsettling, never enough to hide the arrow or the label. */
#touch-controls.skin-horror .tc-dkey,
#touch-controls.skin-horror .tc-btn {
  color: #efdcc0;
  border: 2px solid rgba(168, 132, 96, 0.85);
  box-shadow: inset 0 0 0 1px rgba(40, 20, 10, 0.8), inset 0 -3px 6px rgba(0, 0, 0, 0.45);
  background:
    radial-gradient(ellipse 22% 14% at 74% 78%, rgba(92, 10, 10, 0.55), transparent 70%),
    radial-gradient(circle at 22% 24%, rgba(110, 16, 12, 0.35) 0 3px, transparent 4px),
    repeating-linear-gradient(115deg, rgba(255, 236, 210, 0.07) 0 1px, transparent 1px 9px),
    repeating-linear-gradient(28deg, rgba(0, 0, 0, 0.12) 0 1px, transparent 1px 13px),
    radial-gradient(circle at 30% 30%, #8a5a36 0%, #5e3a22 45%, #3c2414 100%);
}
#touch-controls.skin-horror .tc-dkey.diag { opacity: 0.8; }
#touch-controls.skin-horror .tc-dkey.down,
#touch-controls.skin-horror .tc-btn.down { background: #b0723e; color: #1b0f08; }
#touch-controls.skin-horror .tc-dhub { background: rgba(60, 30, 16, 0.6); border-color: rgba(140, 100, 70, 0.6); }
#touch-controls.skin-horror .tc-panel {
  background:
    radial-gradient(ellipse 30% 8% at 64% 12%, rgba(70, 8, 8, 0.35), transparent 70%),
    repeating-linear-gradient(100deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 11px),
    linear-gradient(180deg, #1d120c 0%, #0d0806 100%);
}
#touch-controls.skin-horror .tc-panel.l,
#touch-controls.skin-horror .tc-panel.r { border-color: rgba(120, 70, 40, 0.6); }
#touch-controls.skin-horror .tc-corner { background: rgba(40, 22, 12, 0.85); border-color: rgba(150, 110, 80, 0.7); color: #e0c8a8; }

/* ---- AFTER.  The arcade's own controls again -- same shapes, same places --
   but a shade off: the teal gone a little sickly, the purple a little grey, a
   faint scar across each button, and one thin stain nobody cleaned up. */
#touch-controls.skin-after .tc-dkey { border-color: rgba(120, 176, 150, 0.5); color: #7fbfa5; }
#touch-controls.skin-after .tc-btn {
  background:
    linear-gradient(160deg, transparent 46%, rgba(255, 255, 255, 0.06) 47% 48%, transparent 49%),
    rgba(58, 44, 78, 0.74);
  border-color: rgba(220, 196, 120, 0.55);
}
#touch-controls.skin-after .tc-btn.primary {
  background:
    radial-gradient(ellipse 18% 10% at 70% 80%, rgba(80, 30, 30, 0.22), transparent 70%),
    rgba(28, 82, 80, 0.8);
}
#touch-controls.skin-after .tc-panel { filter: saturate(0.7) hue-rotate(-14deg) brightness(0.92); }

#touch-controls[hidden] { display: none; }
`;

type Held = Set<KeyName>;

/** The eight arrows, by compass point, and what each one shows. */
const PAD: Array<[string, string]> = [
  ['nw', '&#8598;'],
  ['n', '&#9650;'],
  ['ne', '&#8599;'],
  ['w', '&#9664;'],
  ['e', '&#9654;'],
  ['sw', '&#8601;'],
  ['s', '&#9660;'],
  ['se', '&#8600;'],
];

class TouchControls {
  private root: HTMLDivElement | null = null;
  private dpad: HTMLDivElement | null = null;
  private pads: HTMLDivElement | null = null;
  private quit: HTMLButtonElement | null = null;
  private lookPad: HTMLDivElement | null = null;
  private layout: TouchLayout = {};
  private held: Held = new Set();
  /** Every finger on the arrow pad, by touch id, and where it is. */
  private padTouches = new Map<number, { x: number; y: number }>();
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
      '<div class="tc-panel l"></div><div class="tc-panel r"></div>' +
      '<div class="tc-look" hidden></div>' +
      '<div class="tc-zone tc-left"><div class="tc-dpad">' +
      PAD.map(([cls, glyph]) => `<div class="tc-dkey ${cls}${cls.length > 1 ? ' diag' : ''}">${glyph}</div>`).join('') +
      '<div class="tc-dhub"></div>' +
      '</div></div>' +
      '<div class="tc-zone tc-right"><div class="tc-pads"></div></div>' +
      '<button class="tc-corner" type="button" aria-label="Pause and settings">&#9881;</button>';
    document.body.appendChild(root);

    this.root = root;
    this.lookPad = root.querySelector('.tc-look');
    this.dpad = root.querySelector('.tc-dpad');
    this.pads = root.querySelector('.tc-pads');
    this.quit = root.querySelector('.tc-corner');

    this.wireDpad();
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
        sides: () => this.reserveSides(),
        skin: () => this.skin,
        arrows: () =>
          [...root.querySelectorAll('.tc-dkey')]
            .filter((b) => !(b as HTMLElement).hidden)
            .map((b) => b.className.split(' ')[1]),
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
    const sidesWere = this.reserveSides().left;
    this.layout = layout;

    const zoneL = this.root.querySelector('.tc-left') as HTMLElement;
    zoneL.style.visibility = layout.stick ? 'visible' : 'hidden';
    this.syncArrows();

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
    // A layout with nothing on it gets no panels either: nothing to sit on.
    this.root.classList.toggle('bare', !layout.stick && !buttons.length && layout.noQuit === true);
    this.relayout();
    // A layout with different columns needs a differently sized picture: ask
    // the scaler to fit it again.
    if (this.reserveSides().left !== sidesWere) window.dispatchEvent(new Event('resize'));
  }

  private skin: 'normal' | 'horror' | 'after' = 'normal';
  /** The mood the controls are in: see the horror and after skins in STYLE. */
  setSkin(skin: 'normal' | 'horror' | 'after'): void {
    this.skin = skin;
    if (!this.root) return;
    this.root.classList.toggle('skin-horror', skin === 'horror');
    this.root.classList.toggle('skin-after', skin === 'after');
  }

  /**
   * Only the arrows the game in front of the player reads: a one-axis game
   * gets two, not eight it would half ignore.
   */
  private syncArrows(): void {
    if (!this.dpad) return;
    const axis = this.layout.stick ?? 'wasd';
    for (const el of Array.from(this.dpad.querySelectorAll('.tc-dkey')) as HTMLElement[]) {
      const cls = el.className.split(' ')[1];
      el.hidden =
        axis === 'lr' ? cls !== 'w' && cls !== 'e' : axis === 'ud' ? cls !== 'n' && cls !== 's' : false;
    }
  }

  /** Everything up.  Safe at any moment, and the only way keys are released. */
  releaseAll(): void {
    for (const k of [...this.held]) this.up(k);
    this.padTouches.clear();
    this.lookTouch = null;
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
    const safe = safeInsets().bottom;
    return Math.round(Math.min(Math.max(window.innerHeight * 0.34, 190), window.innerHeight * 0.5)) + safe;
  }

  /**
   * THE COLUMNS EITHER SIDE OF THE PICTURE, in landscape, in CSS pixels.
   *
   * Wide enough for whatever is in them -- the pad on the left, the buttons
   * (two across) and the gear on the right -- plus a margin and the safe
   * area, and the same width both sides so the picture stays centred.  A
   * layout with nothing to press but the gear still keeps a narrow column,
   * so the gear is never over the picture.  Zero in portrait.
   */
  reserveSides(): { left: number; right: number } {
    if (!this.root || !isTouch() || window.innerHeight >= window.innerWidth) return { left: 0, right: 0 };
    const safe = safeInsets();
    const stick = this.stickPx();
    const btn = this.btnPx();
    const gap = this.gapPx();
    const n = Math.min(5, (this.layout.buttons ?? []).length);
    const primary = (this.layout.buttons ?? []).some((b) => b.primary);
    const cols = Math.min(2, n);
    const grid = cols ? cols * btn + (cols - 1) * gap + (primary ? btn * 0.25 : 0) : 0;
    const left = this.layout.stick ? stick + 28 + safe.left : 0;
    const right = Math.max(grid ? grid + 28 + safe.right : 0, this.layout.noQuit ? 0 : 44 + 20 + safe.right);
    const side = Math.max(left, right);
    return { left: side, right: side };
  }

  /** How big the arrow pad is right now, which everything else is sized off. */
  private stickPx(): number {
    const short = Math.min(window.innerWidth, window.innerHeight);
    // Landscape is short: the same fraction of the screen there would be a
    // pad taller than the column it has to fit in.
    const portrait = window.innerHeight >= window.innerWidth;
    // Portrait is narrow: the pad and the buttons share one width, so the pad
    // takes 40% of it -- big, but leaving its half of the band a margin on
    // both sides and the buttons enough of theirs to stay off the edge.
    return portrait
      ? Math.round(Math.min(200, Math.max(124, short * 0.4)))
      : Math.round(Math.min(144, Math.max(112, short * 0.34)));
  }

  /** A button: half the pad across, never under the size a thumb can hit blind. */
  private btnPx(): number {
    const portrait = window.innerHeight >= window.innerWidth;
    return Math.max(52, Math.round(this.stickPx() * (portrait ? 0.5 : 0.45)));
  }

  private gapPx(): number {
    return Math.round(Math.min(18, Math.max(10, this.stickPx() * 0.08)));
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

    // The pad sets the scale of everything, and the band is whatever holds
    // it — never the other way round, or the pad hangs off the screen.
    const stick = this.stickPx();
    const safe = safeInsets();
    const band = portrait ? Math.max(this.band, this.reserveHeight(), stick + 24 + safe.bottom) : 0;
    this.root.style.setProperty('--tc-band', `${band}px`);
    this.root.style.setProperty('--tc-side', `${this.reserveSides().left}px`);
    this.root.style.setProperty('--tc-stick', `${stick}px`);
    this.root.style.setProperty('--tc-btn', `${this.btnPx()}px`);
    this.root.style.setProperty('--tc-font', `${Math.round(Math.min(17, Math.max(11, stick * 0.09)))}px`);
    this.root.style.setProperty('--tc-gap', `${this.gapPx()}px`);
    this.root.style.setProperty('--tc-safe-t', `${safe.top}px`);
    this.root.style.setProperty('--tc-safe-r', `${safe.right}px`);
    this.root.style.setProperty('--tc-safe-b', `${safe.bottom}px`);
    this.root.style.setProperty('--tc-safe-l', `${safe.left}px`);

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

  /**
   * The arrow pad.  The pad takes every finger that lands on it and follows
   * each one until it lifts, wherever it slides -- off the edge included, so a
   * thumb that drifts outward keeps walking instead of stopping dead.  What is
   * held is the union of every finger: one finger on a diagonal, or one on up
   * and one on left, both hold up-and-left.
   */
  private wireDpad(): void {
    const el = this.dpad;
    if (!el) return;
    const start = (e: TouchEvent) => {
      if (!this.layout.stick) return;
      for (const t of Array.from(e.changedTouches)) this.padTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      this.aimPad();
      e.preventDefault();
    };
    const move = (e: TouchEvent) => {
      let mine = false;
      for (const t of Array.from(e.changedTouches)) {
        if (!this.padTouches.has(t.identifier)) continue;
        this.padTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
        mine = true;
      }
      if (!mine) return;
      this.aimPad();
      e.preventDefault();
    };
    const end = (e: TouchEvent) => {
      let mine = false;
      for (const t of Array.from(e.changedTouches)) mine = this.padTouches.delete(t.identifier) || mine;
      if (!mine) return;
      this.aimPad();
      e.preventDefault();
    };
    el.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end, { passive: false });
    window.addEventListener('touchcancel', end, { passive: false });
    // A mouse drives it too, so the layout can be tried on a desktop with
    // `?touch=1`: the mouse is finger -1.
    el.addEventListener('mousedown', (e) => {
      if (!this.layout.stick) return;
      this.padTouches.set(-1, { x: e.clientX, y: e.clientY });
      this.aimPad();
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.padTouches.has(-1)) return;
      this.padTouches.set(-1, { x: e.clientX, y: e.clientY });
      this.aimPad();
    });
    window.addEventListener('mouseup', () => {
      if (this.padTouches.delete(-1)) this.aimPad();
    });
  }

  /**
   * Which arrow a finger is on: one of eight 45-degree slices round the middle
   * of the pad, with a dead spot in the middle so a resting thumb does not
   * creep.  A one-axis game only ever gets its own axis out of it.
   */
  private arrowAt(x: number, y: number): { x: number; y: number } {
    const r = (this.dpad as HTMLElement).getBoundingClientRect();
    const dx = x - (r.left + r.width / 2);
    const dy = y - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.15) return { x: 0, y: 0 };
    const axis = this.layout.stick ?? 'wasd';
    if (axis === 'lr') return { x: Math.sign(dx), y: 0 };
    if (axis === 'ud') return { x: 0, y: Math.sign(dy) };
    const slice = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    const a = slice * (Math.PI / 4);
    return { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) };
  }

  /** Hold exactly the directions the fingers on the pad add up to. */
  private aimPad(): void {
    let l = false;
    let r = false;
    let u = false;
    let d = false;
    const lit = new Set<string>();
    for (const { x, y } of this.padTouches.values()) {
      const a = this.arrowAt(x, y);
      if (a.x < 0) l = true;
      if (a.x > 0) r = true;
      if (a.y < 0) u = true;
      if (a.y > 0) d = true;
      const name = (a.y < 0 ? 'n' : a.y > 0 ? 's' : '') + (a.x < 0 ? 'w' : a.x > 0 ? 'e' : '');
      if (name) lit.add(name);
    }
    // Both names go down together.  Sending the arrow to a game that only
    // reads WASD costs nothing, and it saves the pad having to know which of
    // the cabinets is in front of it.
    //
    // EXCEPT IN THE 3D ROOMS, where the arrow keys TURN THE HEAD.  There the
    // pad walks and strafes and nothing else: the camera is the swipe's.
    const arrows = !this.layout.look;
    const want: Array<[boolean, KeyName, KeyName]> = [
      [u && !d, 'W', 'UP'],
      [d && !u, 'S', 'DOWN'],
      [l && !r, 'A', 'LEFT'],
      [r && !l, 'D', 'RIGHT'],
    ];
    for (const [on, wasd, arrow] of want) {
      if (on) {
        this.down(wasd);
        if (arrows) this.down(arrow);
        else this.up(arrow);
      } else {
        this.up(wasd);
        this.up(arrow);
      }
    }
    for (const el of Array.from((this.dpad as HTMLElement).querySelectorAll('.tc-dkey')) as HTMLElement[]) {
      el.classList.toggle('down', lit.has(el.className.split(' ')[1]));
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
    window.addEventListener('mouseup', (e) => {
      // The look pad's own drag ends in a mouseup it makes itself; that is a
      // swipe finishing, not this button being let go of, and a thumb still
      // holding RUN while the other one turned must keep running.
      if ((e as MouseEvent & { fromLook?: boolean }).fromLook) return;
      if (el.classList.contains('down')) release(new Event('mouseup'));
    });
  }

  /**
   * Drag to look.  The two 3D rooms already turn on a held mouse drag, so the
   * pad speaks their language rather than inventing a second one: a real
   * MouseEvent at the window, with a movementX the room can read.
   *
   * AND A SENSITIVITY SIZED TO THE PICTURE.  A phone's picture is a third the
   * width of a monitor's, so a thumb crossing all of it moved a third as many
   * pixels and turned a third as far.  Every look event carries `lookSens`,
   * radians per pixel such that a swipe across the whole picture is about
   * two-thirds of a turn -- the same on any screen.
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
      const w = (this.lookPad as HTMLElement).getBoundingClientRect().width || window.innerWidth;
      window.dispatchEvent(mouse('mousemove', t.clientX, t.clientY, dx, dy, (Math.PI * 1.35) / w));
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

function mouse(type: string, x: number, y: number, dx: number, dy: number, lookSens?: number): MouseEvent {
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
  // Marked as the look pad's, so a held button does not read its mouseup as
  // its own release.
  Object.defineProperty(ev, 'fromLook', { get: () => true });
  if (lookSens !== undefined) Object.defineProperty(ev, 'lookSens', { get: () => lookSens });
  return ev;
}

export const touchControls = new TouchControls();
