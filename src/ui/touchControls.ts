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
 * THE GAME GETS THE WHOLE SCREEN, AND THE CONTROLS FLOAT ON IT.  Nothing is
 * reserved for them: the picture is fitted as large as the glass allows, and
 * the pad and the buttons sit in the bottom corners as an overlay, with no
 * panel or background behind them -- just the buttons.  Where the picture
 * leaves black either side of it (landscape) or under it (portrait) they sit
 * in that black, so they cover nothing; where it does not, they sit over the
 * corners of the picture, see-through until a thumb is on them.  The gear
 * goes wherever it is clear of the game's own QUIT.  All of it stays inside
 * the phone's safe area, clear of the notch and the rounded corners, and all
 * of it goes away for a jumpscare (`suspendFor`).
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
  /**
   * ONE BIG CROSS of four separate buttons, in the middle at the bottom, for
   * a game whose four directions ARE the game (the Dance Off).  Under the
   * picture in portrait; over the bottom middle of it in landscape, where the
   * game is told how far it reaches (`crossReach`) and keeps clear of it.
   * `tints` colours each arm like the game's own lanes.
   */
  cross?: {
    up: KeyName;
    left: KeyName;
    down: KeyName;
    right: KeyName;
    tints?: Partial<Record<'up' | 'left' | 'down' | 'right', string>>;
  };
  /**
   * A small analogue thumbstick in place of the arrow pad, for steering.  It
   * still sends the keys (past half way), and the game can read how far it is
   * pushed from `touchControls.joy()` to steer by degrees rather than all or
   * nothing.
   */
  joystick?: boolean;
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
  position: absolute; bottom: var(--tc-bottom, 16px);
  display: flex; align-items: flex-end;
  pointer-events: none;
}
#touch-controls .tc-left { left: var(--tc-left, 16px); }
#touch-controls .tc-right { right: var(--tc-right, 16px); }

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

/* ---- AND IN PORTRAIT, THE EMPTY PART OF THE BAND IS FOR LOOKING TOO.
   Between the bottom of the picture and the tops of the controls there is a
   stretch of panel nothing sits on; in the 3D rooms it is a second look
   surface, the same drag as the picture's.  It is marked, not invisible: a
   faint inset edge, and a small swipe hint in the middle of it that fades
   once the player has used it. */
#touch-controls .tc-lookzone {
  position: absolute; pointer-events: auto; touch-action: none;
  border: 1px dashed rgba(214, 220, 228, 0.1); border-radius: 16px;
  background: radial-gradient(ellipse at 50% 50%, rgba(214, 220, 228, 0.035), transparent 70%);
  display: flex; align-items: center; justify-content: center;
  box-sizing: border-box;
}
#touch-controls .tc-lookzone[hidden] { display: none; }
#touch-controls .tc-hint {
  pointer-events: none;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  color: #d6dce4; font-size: var(--tc-font, 13px); letter-spacing: 1.5px;
  opacity: 0.55; transition: opacity 1.2s ease;
}
#touch-controls .tc-hint.quiet { opacity: 0.18; }
#touch-controls .tc-hint.gone { opacity: 0; }
#touch-controls .tc-hint .tc-finger { animation: tc-swipe 2.6s ease-in-out infinite; }
@keyframes tc-swipe {
  0%, 100% { transform: translateX(-16px); }
  50% { transform: translateX(16px); }
}
#touch-controls.skin-horror .tc-lookzone { border-color: rgba(200, 150, 110, 0.14); }
#touch-controls.skin-horror .tc-hint { color: #e0c8a8; }

/* Landscape: five buttons go two across, not three, so the cluster stays
   in the corner.  The gear is placed by relayout(). */
#touch-controls.overlay .tc-pads.three { grid-template-columns: repeat(2, auto); }

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

/* Over the picture (landscape without room in the black either side) the
   controls are see-through until a thumb is on them, so the game shows
   through them; in the black they are solid. */
#touch-controls.over .tc-dpad { opacity: 0.62; }
#touch-controls.over .tc-btn { opacity: 0.66; }
#touch-controls.over .tc-dkey { background: rgba(20, 26, 36, 0.42); }
#touch-controls.over .tc-dkey.diag { background: rgba(20, 26, 36, 0.28); }
#touch-controls.over .tc-btn { background: rgba(61, 42, 92, 0.42); }
#touch-controls.over .tc-btn.primary { background: rgba(20, 92, 95, 0.48); }
#touch-controls.over .tc-btn.down, #touch-controls.over .tc-dkey.down { opacity: 1; }
#touch-controls.over .tc-dpad:has(.down) { opacity: 1; }

/* ---- THE CROSS.  Four buttons, apart, round an empty middle. */
#touch-controls .tc-cross {
  position: absolute; left: 50%; transform: translateX(-50%);
  bottom: var(--tc-cross-b, 24px);
  display: grid; gap: var(--tc-cross-gap, 8px);
  grid-template-columns: repeat(3, var(--tc-cell, 72px));
  grid-template-rows: repeat(3, var(--tc-cell, 72px));
  pointer-events: none;
}
#touch-controls .tc-cross[hidden] { display: none; }
#touch-controls .tc-xbtn {
  pointer-events: auto; touch-action: none; padding: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 16px;
  background: rgba(20, 26, 36, 0.72);
  border: 3px solid var(--tint, rgba(255, 212, 94, 0.7));
  color: var(--tint, #fff0c9);
  font-size: calc(var(--tc-cell, 72px) * 0.42); line-height: 1;
}
#touch-controls .tc-xbtn.down { background: var(--tint, #ffd45e); color: #141a24; }
#touch-controls .tc-xbtn.up { grid-area: 1 / 2; }
#touch-controls .tc-xbtn.left { grid-area: 2 / 1; }
#touch-controls .tc-xbtn.right { grid-area: 2 / 3; }
#touch-controls .tc-xbtn.down-arm { grid-area: 3 / 2; }
#touch-controls.over .tc-xbtn { background: rgba(20, 26, 36, 0.4); opacity: 0.8; }
#touch-controls.over .tc-xbtn.down { opacity: 1; }

/* ---- THE THUMBSTICK.  A ring and a knob that follows the thumb. */
#touch-controls .tc-joy {
  position: relative; pointer-events: auto; touch-action: none;
  width: var(--tc-joy, 110px); height: var(--tc-joy, 110px);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(70, 196, 189, 0.1) 0 55%, rgba(20, 26, 36, 0.55) 56%);
  border: 2px solid rgba(70, 196, 189, 0.55);
}
#touch-controls .tc-joy[hidden] { display: none; }
#touch-controls .tc-knob {
  position: absolute; left: 50%; top: 50%;
  width: 46%; height: 46%; margin: -23% 0 0 -23%;
  border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle at 35% 35%, #7fe0d8, #2a8c86);
  border: 2px solid rgba(255, 240, 201, 0.7);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
}
#touch-controls.over .tc-joy { opacity: 0.7; }
#touch-controls.over .tc-joy.held { opacity: 1; }
#touch-controls .tc-dpad[hidden] { display: none; }

/* No panels: the controls are buttons on the screen and nothing else. */
#touch-controls .tc-panel { display: none !important; }

#touch-controls[hidden] { display: none; }
`;

type Held = Set<KeyName>;

/**
 * The swipe hint: arrows either way and a fingertip gliding between them.
 * Drawn in the current colour so the skins can tint it.
 */
const LOOK_HINT =
  '<svg width="96" height="40" viewBox="0 0 96 40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M6 20h18M6 20l7-6M6 20l7 6"/>' +
  '<path d="M90 20H72M90 20l-7-6M90 20l-7 6"/>' +
  '<path d="M48 6v6M48 6l-4 4M48 6l4 4" opacity="0.6"/>' +
  '<path d="M48 34v-6M48 34l-4-4M48 34l4-4" opacity="0.6"/>' +
  '<g class="tc-finger"><circle cx="48" cy="20" r="6.5" fill="currentColor" fill-opacity="0.35"/></g>' +
  '</svg>';
/** Remembered: once the player has dragged to look, the hint stays gone. */
const LOOK_HINT_KEY = 'froggy.lookHintUsed';

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
  /** Portrait only: the empty band between the picture and the controls, for looking. */
  private lookZone: HTMLDivElement | null = null;
  private hint: HTMLDivElement | null = null;
  private hintTimer = 0;
  /** How far the current look drag has gone, to tell a real use from a tap. */
  private lookTravel = 0;
  private lookFollowed = false;
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
      '<div class="tc-lookzone" hidden><div class="tc-hint">' +
      LOOK_HINT +
      '<span>DRAG TO LOOK</span></div></div>' +
      '<div class="tc-zone tc-left"><div class="tc-dpad">' +
      PAD.map(([cls, glyph]) => `<div class="tc-dkey ${cls}${cls.length > 1 ? ' diag' : ''}">${glyph}</div>`).join('') +
      '<div class="tc-dhub"></div>' +
      '</div><div class="tc-joy" hidden><div class="tc-knob"></div></div></div>' +
      '<div class="tc-cross" hidden>' +
      '<button type="button" class="tc-xbtn up" data-dir="up">&#9650;</button>' +
      '<button type="button" class="tc-xbtn left" data-dir="left">&#9664;</button>' +
      '<button type="button" class="tc-xbtn right" data-dir="right">&#9654;</button>' +
      '<button type="button" class="tc-xbtn down-arm" data-dir="down">&#9660;</button>' +
      '</div>' +
      '<div class="tc-zone tc-right"><div class="tc-pads"></div></div>' +
      '<button class="tc-corner" type="button" aria-label="Pause and settings">&#9881;</button>';
    document.body.appendChild(root);

    this.root = root;
    this.lookPad = root.querySelector('.tc-look');
    this.lookZone = root.querySelector('.tc-lookzone');
    this.hint = root.querySelector('.tc-hint');
    this.dpad = root.querySelector('.tc-dpad');
    this.pads = root.querySelector('.tc-pads');
    this.quit = root.querySelector('.tc-corner');
    this.joyEl = root.querySelector('.tc-joy');
    this.crossEl = root.querySelector('.tc-cross');

    this.wireDpad();
    this.wireJoy();
    // The cross's buttons send whatever the layout says each arm is.
    for (const el of Array.from(root.querySelectorAll('.tc-xbtn')) as HTMLElement[]) {
      const dir = el.dataset.dir as 'up' | 'left' | 'down' | 'right';
      const press = (e: Event) => {
        const k = this.layout.cross?.[dir];
        if (!k) return;
        el.classList.add('down');
        el.dataset.sent = k;
        this.down(k);
        e.preventDefault();
      };
      const release = (e: Event) => {
        el.classList.remove('down');
        const k = el.dataset.sent as KeyName | undefined;
        if (k) this.up(k);
        delete el.dataset.sent;
        e.preventDefault();
      };
      el.addEventListener('touchstart', press, { passive: false });
      el.addEventListener('touchend', release, { passive: false });
      el.addEventListener('touchcancel', release, { passive: false });
      el.addEventListener('mousedown', press);
      window.addEventListener('mouseup', (e) => {
        if ((e as MouseEvent & { fromLook?: boolean }).fromLook) return;
        if (el.classList.contains('down')) release(new Event('mouseup'));
      });
    }
    this.wireLook(this.lookPad);
    this.wireLook(this.lookZone);
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
        joy: () => this.joy(),
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

    this.syncStick();
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

    const cross = this.crossEl as HTMLElement;
    cross.hidden = !layout.cross;
    for (const el of Array.from(cross.querySelectorAll('.tc-xbtn')) as HTMLElement[]) {
      const tint = layout.cross?.tints?.[el.dataset.dir as 'up'];
      if (tint) el.style.setProperty('--tint', tint);
      else el.style.removeProperty('--tint');
    }

    (this.quit as HTMLElement).hidden = layout.noQuit === true;
    (this.lookPad as HTMLElement).hidden = layout.look !== true;
    // A fresh look layout (a 3D room coming up) shows the hint again, briefly,
    // unless the player has already found the zone for themselves.
    this.resetHint(layout.look === true);
    // A layout with nothing on it gets no panels either: nothing to sit on.
    this.root.classList.toggle('bare', !layout.stick && !layout.cross && !buttons.length && layout.noQuit === true);
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
    this.joyRelease();
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
    // Nothing: the picture is never made smaller for the controls.
    return 0;
  }

  /** Nothing either: no columns either side, the picture is fitted to the screen. */
  reserveSides(): { left: number; right: number } {
    return { left: 0, right: 0 };
  }

  /**
   * ---- GONE FOR A JUMPSCARE.  The whole overlay is hidden for `ms` -- the
   * scare is the whole screen, and a gear or a RUN button over his face is a
   * gear over his face -- and comes back by itself afterwards.  Keys held when
   * it went are let go.
   */
  suspendFor(ms: number): void {
    if (!this.root) return;
    this.releaseAll();
    this.root.hidden = true;
    window.clearTimeout(this.suspendTimer);
    this.suspendTimer = window.setTimeout(() => {
      if (this.root) this.root.hidden = false;
      this.relayout();
    }, Math.max(0, ms));
  }
  private suspendTimer = 0;

  /**
   * How far, in GAME pixels, the corner clusters reach in over the bottom of
   * the picture from its left and right edges -- zero where they sit in the
   * black beside or under it.  For a scene that draws a line of text along
   * the bottom of the picture, so it can keep it inside the clear middle.
   */
  overBottom(): { left: number; right: number } {
    if (!this.root || this.root.hidden || this.stickHeld > 0) return { left: 0, right: 0 };
    const canvas = document.querySelector('#game-root canvas') as HTMLCanvasElement | null;
    if (!canvas) return { left: 0, right: 0 };
    const pic = canvas.getBoundingClientRect();
    const per = 320 / pic.width;
    const reach = (el: HTMLElement | null, side: 'l' | 'r'): number => {
      if (!el || el.offsetParent === null) return 0;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.top > pic.bottom || r.bottom < pic.top) return 0;
      return Math.max(0, side === 'l' ? r.right - pic.left : pic.right - r.left) * per;
    };
    const zoneL = this.root.querySelector('.tc-left') as HTMLElement | null;
    const showL = !!this.layout.stick && zoneL?.style.visibility !== 'hidden';
    const leftEl = this.layout.joystick ? this.joyEl : this.dpad;
    return { left: showL ? reach(leftEl, 'l') : 0, right: reach(this.pads, 'r') };
  }

  /**
   * How far, in GAME pixels, the cross comes up over the bottom middle of the
   * picture, and how wide it is there -- 0 when it is under the picture (in
   * portrait) or not up at all.  A game with a cross keeps its people above it.
   */
  crossReach(): { h: number; w: number } {
    const cross = this.crossEl;
    if (!this.root || this.root.hidden || !cross || cross.hidden) return { h: 0, w: 0 };
    const canvas = document.querySelector('#game-root canvas') as HTMLCanvasElement | null;
    if (!canvas) return { h: 0, w: 0 };
    const pic = canvas.getBoundingClientRect();
    const r = cross.getBoundingClientRect();
    const per = 320 / pic.width;
    if (r.top >= pic.bottom) return { h: 0, w: 0 };
    return { h: Math.ceil((pic.bottom - r.top) * per), w: Math.ceil(r.width * per) };
  }

  // ---- THE THUMBSTICK.
  private joyEl: HTMLDivElement | null = null;
  private crossEl: HTMLDivElement | null = null;
  private joyTouch: number | null = null;
  private joyVec = { x: 0, y: 0 };
  private joyKeys = new Set<KeyName>();

  /**
   * How far the thumbstick is pushed, -1..1 on each axis (up is -y), with a
   * small dead middle so a resting thumb is no input at all.  Zero when there
   * is no stick up.
   */
  joy(): { x: number; y: number; active: boolean } {
    const active = !!this.root && !this.root.hidden && this.layout.joystick === true && this.stickHeld === 0;
    return active ? { ...this.joyVec, active } : { x: 0, y: 0, active };
  }

  private wireJoy(): void {
    const el = this.joyEl as HTMLElement;
    const knob = el.querySelector('.tc-knob') as HTMLElement;
    const DEAD = 0.14;
    const move = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      const rad = r.width / 2;
      let dx = (cx - (r.left + rad)) / rad;
      let dy = (cy - (r.top + rad)) / rad;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      knob.style.transform = `translate(${dx * rad * 0.55}px, ${dy * rad * 0.55}px)`;
      // the dead middle, then the rest of the throw rescaled to start from 0
      const m = Math.hypot(dx, dy);
      const k = m < DEAD ? 0 : (m - DEAD) / (1 - DEAD) / (m || 1);
      this.joyVec = { x: dx * k, y: dy * k };
      // and the keys, past half way, for anything that only reads keys
      const want = new Set<KeyName>();
      if (this.joyVec.x < -0.5) want.add('A');
      if (this.joyVec.x > 0.5) want.add('D');
      if (this.joyVec.y < -0.5) want.add('W');
      if (this.joyVec.y > 0.5) want.add('S');
      for (const k2 of [...this.joyKeys]) {
        if (want.has(k2)) continue;
        this.joyKeys.delete(k2);
        this.up(k2);
      }
      for (const k2 of want) {
        if (this.joyKeys.has(k2)) continue;
        this.joyKeys.add(k2);
        this.down(k2);
      }
    };
    el.addEventListener(
      'touchstart',
      (e) => {
        const t = e.changedTouches[0];
        if (this.joyTouch === null && t) {
          this.joyTouch = t.identifier;
          el.classList.add('held');
          move(t.clientX, t.clientY);
        }
        e.preventDefault();
      },
      { passive: false },
    );
    el.addEventListener(
      'touchmove',
      (e) => {
        for (const t of Array.from(e.changedTouches)) if (t.identifier === this.joyTouch) move(t.clientX, t.clientY);
        e.preventDefault();
      },
      { passive: false },
    );
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) if (t.identifier === this.joyTouch) this.joyRelease();
      e.preventDefault();
    };
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    // and a mouse, for `?touch=1` on a desktop
    let mouse = false;
    el.addEventListener('mousedown', (e) => {
      mouse = true;
      el.classList.add('held');
      move(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
      if (mouse) move(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => {
      if (mouse) this.joyRelease();
      mouse = false;
    });
  }

  private joyRelease(): void {
    this.joyTouch = null;
    this.joyVec = { x: 0, y: 0 };
    for (const k of [...this.joyKeys]) this.up(k);
    this.joyKeys.clear();
    const el = this.joyEl;
    if (!el) return;
    el.classList.remove('held');
    (el.querySelector('.tc-knob') as HTMLElement).style.transform = '';
  }

  /**
   * While something is being SAID -- a dialogue box or a talk panel up -- the
   * controls go, all of them: the pad, the buttons, the cross.  Nobody walks
   * or presses anything mid-sentence (a tap on the picture moves the talk
   * on), and they come back when it is over.  Counted, so two panels and one
   * close cannot bring them back early.  The gear stays.
   */
  /** Whether talk has the controls put away right now. */
  talking(): boolean {
    return this.stickHeld > 0;
  }

  /** One press of a key, as if a button had been tapped: for a tap on a talk panel. */
  tap(k: KeyName): void {
    this.down(k);
    window.setTimeout(() => this.up(k), 60);
  }

  holdStick(): void {
    this.stickHeld++;
    this.syncStick();
  }
  releaseStick(): void {
    this.stickHeld = Math.max(0, this.stickHeld - 1);
    this.syncStick();
  }
  private stickHeld = 0;
  private syncStick(): void {
    if (!this.root) return;
    const zoneL = this.root.querySelector('.tc-left') as HTMLElement;
    zoneL.style.visibility = this.layout.stick && this.stickHeld === 0 ? 'visible' : 'hidden';
    const zoneR = this.root.querySelector('.tc-right') as HTMLElement;
    zoneR.style.visibility = this.stickHeld === 0 ? 'visible' : 'hidden';
    if (this.crossEl) this.crossEl.style.visibility = this.stickHeld === 0 ? 'visible' : 'hidden';
    (this.dpad as HTMLElement).hidden = this.layout.joystick === true;
    (this.joyEl as HTMLElement).hidden = this.layout.joystick !== true;
    if (this.stickHeld || !this.layout.joystick) this.joyRelease();
    if (this.stickHeld) {
      for (const k of [...this.held]) this.up(k);
      this.padTouches.clear();
      this.root.querySelectorAll('.down').forEach((el) => el.classList.remove('down'));
    }
  }

  /** Whether the overlay is up right now (it is not, during a jumpscare). */
  isShown(): boolean {
    return !!this.root && !this.root.hidden;
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
    // (landscape: smaller, because there it sits over the corner of the
    // picture rather than in the black under it)
    return portrait
      ? Math.round(Math.min(200, Math.max(124, short * 0.4)))
      : Math.round(Math.min(124, Math.max(96, short * 0.28)));
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

    const stick = this.stickPx();
    const btn = this.btnPx();
    const gap = this.gapPx();
    const safe = safeInsets();
    const canvas = document.querySelector('#game-root canvas') as HTMLCanvasElement | null;
    const pic = canvas?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    // The black the picture leaves: under it in portrait, either side of it
    // in landscape.
    const under = Math.max(0, window.innerHeight - pic.bottom);
    const barL = Math.max(0, pic.left);
    const barR = Math.max(0, window.innerWidth - pic.right);
    this.root.style.setProperty('--tc-band', `${Math.round(under)}px`);
    this.root.style.setProperty('--tc-stick', `${stick}px`);
    // The thumbstick is compact: three quarters of the pad it replaces.
    this.root.style.setProperty('--tc-joy', `${Math.round(stick * 0.78)}px`);
    this.root.style.setProperty('--tc-btn', `${btn}px`);
    this.root.style.setProperty('--tc-font', `${Math.round(Math.min(17, Math.max(11, stick * 0.09)))}px`);
    this.root.style.setProperty('--tc-gap', `${gap}px`);
    this.root.style.setProperty('--tc-safe-t', `${safe.top}px`);
    this.root.style.setProperty('--tc-safe-r', `${safe.right}px`);
    this.root.style.setProperty('--tc-safe-b', `${safe.bottom}px`);
    this.root.style.setProperty('--tc-safe-l', `${safe.left}px`);

    // ---- WHERE THE CLUSTERS GO.  Bottom corners, in the black if the black
    // is big enough to hold them, over the picture's corners if it is not.
    const margin = 14;
    const n = Math.min(5, (this.layout.buttons ?? []).length);
    // Landscape: up to three buttons in ONE column hugging the right edge, so
    // the cluster is narrow and stays off a subtitle or a score along the
    // bottom of the picture; more than three go two across.
    const cols = portrait ? Math.min(n >= 5 ? 3 : 2, n) : n <= 3 ? Math.min(1, n) : 2;
    (this.pads as HTMLElement).style.gridTemplateColumns = cols ? `repeat(${cols}, auto)` : '';
    const primary = (this.layout.buttons ?? []).some((b) => b.primary);
    const padsW = cols ? cols * btn + (cols - 1) * gap + (primary ? btn * 0.25 : 0) : 0;
    const leftW = this.layout.joystick ? Math.round(stick * 0.78) : stick;
    const left = barL >= leftW + margin * 2 ? Math.round((barL - leftW) / 2) : margin + safe.left;
    const right = barR >= padsW + margin * 2 ? Math.round((barR - padsW) / 2) : margin + safe.right;
    const bottom = portrait
      ? safe.bottom + Math.round(Math.min(window.innerHeight * 0.07, 60, Math.max(margin, (under - stick) * 0.35)))
      : safe.bottom + margin;
    this.root.style.setProperty('--tc-left', `${left}px`);
    this.root.style.setProperty('--tc-right', `${right}px`);
    this.root.style.setProperty('--tc-bottom', `${bottom}px`);
    // Over the picture means see-through (see STYLE): in landscape whenever
    // a cluster is not in the black, and in portrait if the picture runs down
    // into the controls (a very short, wide-ish phone).
    const overPic = portrait ? under < stick + bottom + 8 : barL < leftW + margin * 2 || barR < padsW + margin * 2;
    this.root.classList.toggle('over', overPic);

    // ---- THE CROSS.  Big, in the middle.  Portrait: as big as the black
    // under the picture allows (below the gear), centred in it.  Landscape:
    // over the bottom middle of the picture, as small as still hits blind.
    if (this.layout.cross) {
      let cell: number;
      let crossB: number;
      const xgap = portrait ? 10 : 6;
      if (portrait) {
        const room = under - 64 - safe.bottom - 12;
        cell = Math.round(Math.max(52, Math.min(96, (room - 2 * xgap) / 3, (window.innerWidth * 0.78 - 2 * xgap) / 3)));
        const h = cell * 3 + xgap * 2;
        crossB = safe.bottom + Math.max(12, Math.round((room - h) / 2) + 12);
      } else {
        cell = Math.round(Math.max(44, Math.min(56, pic.height * 0.13)));
        crossB = safe.bottom + 8;
      }
      this.root.style.setProperty('--tc-cell', `${cell}px`);
      this.root.style.setProperty('--tc-cross-gap', `${xgap}px`);
      this.root.style.setProperty('--tc-cross-b', `${crossB}px`);
      if (!portrait) this.root.classList.add('over');
    }

    // ---- THE GEAR.  Never over the game's own QUIT (top right of the
    // picture).  Portrait: the top right of the black under the picture.
    // Landscape: the top of the right-hand black if there is any; if not,
    // the right edge just under the picture's title bar.
    const quit = this.quit as HTMLElement;
    const zoom = pic.width / 320;
    let gearTop: number;
    let gearRight: number;
    if (portrait) {
      gearTop = Math.round(pic.bottom + 10);
      gearRight = margin + safe.right;
    } else if (barR >= 56) {
      gearTop = Math.max(8, safe.top + 8);
      gearRight = Math.round((barR - 44) / 2);
    } else {
      gearTop = Math.round(pic.top + 20 * zoom + 6);
      gearRight = Math.max(8, safe.right + 8);
    }
    quit.style.top = `${gearTop}px`;
    quit.style.right = `${gearRight}px`;
    quit.style.bottom = 'auto';

    // The look pad covers exactly the picture.
    const pad = this.lookPad as HTMLElement;
    if (canvas) {
      pad.style.left = `${Math.round(pic.left)}px`;
      pad.style.top = `${Math.round(pic.top)}px`;
      pad.style.width = `${Math.round(pic.width)}px`;
      pad.style.height = `${Math.round(pic.height)}px`;
    }
    this.placeLookZone(portrait, canvas);
  }

  /**
   * In portrait, the part of the band between the bottom of the picture and
   * the tops of the controls.  Never in landscape (the columns are the
   * controls', and the picture is already all look), never where there is too
   * little of it to be worth a thumb, and never over a control: it stops short
   * of the arrow pad and the buttons, and the gear sits above it.
   */
  private placeLookZone(portrait: boolean, canvas: HTMLCanvasElement | null): void {
    const zone = this.lookZone as HTMLElement;
    if (!portrait || !this.layout.look || !canvas) {
      zone.hidden = true;
      return;
    }
    const pic = canvas.getBoundingClientRect();
    let controlsTop = window.innerHeight;
    for (const el of [this.dpad, this.pads] as Array<HTMLElement | null>) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.height > 0) controlsTop = Math.min(controlsTop, r.top);
    }
    const safe = safeInsets();
    const top = Math.round(pic.bottom + 10);
    const bottom = Math.round(controlsTop - 14);
    if (bottom - top < 70) {
      zone.hidden = true;
      return;
    }
    zone.hidden = false;
    zone.style.left = `${10 + safe.left}px`;
    zone.style.right = `${10 + safe.right}px`;
    zone.style.top = `${top}px`;
    zone.style.height = `${bottom - top}px`;
  }

  /** The hint: bright on arrival, dimmed after a few seconds, gone once used. */
  private resetHint(show: boolean): void {
    const hint = this.hint;
    if (!hint) return;
    window.clearTimeout(this.hintTimer);
    let used = false;
    try {
      used = window.localStorage.getItem(LOOK_HINT_KEY) === '1';
    } catch {
      // private mode: it just shows again next time
    }
    hint.classList.toggle('gone', used || !show);
    hint.classList.remove('quiet');
    if (show && !used) this.hintTimer = window.setTimeout(() => hint.classList.add('quiet'), 4000);
  }

  private hintUsed(): void {
    const hint = this.hint;
    if (!hint || hint.classList.contains('gone')) return;
    window.clearTimeout(this.hintTimer);
    hint.classList.add('gone');
    try {
      window.localStorage.setItem(LOOK_HINT_KEY, '1');
    } catch {
      // nothing to remember it in; it goes for this visit anyway
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
  private wireLook(el: HTMLElement | null): void {
    if (!el) return;
    // (the picture's pad and the band's zone both come here: one look touch
    // at a time, whichever it started on, and the window follows it)
    const start = (e: TouchEvent) => {
      if (this.lookTouch !== null) return;
      const t = e.changedTouches[0];
      this.lookTouch = t.identifier;
      this.lookTravel = 0;
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
      // a real drag, not a tap, is what tells us the player has found it
      this.lookTravel += Math.abs(dx) + Math.abs(dy);
      if (this.lookTravel > 60) this.hintUsed();
      // (sized to the picture, wherever the drag is: the same turn for the
      // same swipe on the picture or in the band)
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
    // The drag is followed at the window, once, however many surfaces start
    // one: twice would turn the head twice for every move.
    if (this.lookFollowed) return;
    this.lookFollowed = true;
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
