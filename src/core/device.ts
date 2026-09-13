/**
 * What is this being played on.
 *
 * ONE ANSWER, ASKED ONCE.  Everything that behaves differently on a phone —
 * the scaler, the on-screen controls, the layout of the page itself — reads
 * this and nothing else, so there is no chance of the canvas deciding it is on
 * a desktop while the controls decide they are on a phone.
 *
 * The test is a COARSE POINTER plus a touch screen, not the user agent string.
 * A user agent tells you what a browser wants you to believe; a coarse pointer
 * tells you there is a thumb on the glass, which is the thing that actually
 * changes what the game has to draw.  A laptop with a touchscreen keeps the
 * desktop layout, because it also has a fine pointer and a keyboard.
 *
 * `?touch=1` forces the phone layout on and `?touch=0` forces it off, which is
 * how the harness drives both without a device farm.
 */

let cached: boolean | null = null;

/** True when this is a touch device and the game should draw its controls. */
export function isTouch(): boolean {
  if (cached !== null) return cached;
  cached = detect();
  return cached;
}

function detect(): boolean {
  if (typeof window === 'undefined') return false;
  const forced = new URLSearchParams(window.location.search).get('touch');
  if (forced === '1') return true;
  if (forced === '0') return false;

  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const fine = window.matchMedia?.('(pointer: fine)').matches ?? false;
  const touchPoints = navigator.maxTouchPoints ?? 0;
  // Coarse AND no fine pointer: a phone or a tablet.  A touchscreen laptop
  // reports both and keeps the desktop build.
  return coarse && !fine && touchPoints > 0;
}

/** Portrait means there is room under the game for the controls to live in. */
export function isPortrait(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerHeight >= window.innerWidth;
}

/** Testing only: forget the cached answer so a new query string can be read. */
export function resetDeviceCache(): void {
  cached = null;
}
