/**
 * WHAT THE CONTROLS ARE, ON THE DEVICE IN FRONT OF YOU.
 *
 * Every cabinet writes its how-to-play in keys -- "A / D  STEER", "SPACE
 * JUMP" -- because that is what it reads.  On a phone those keys are arrows
 * and labelled buttons, so a card that says SPACE is describing a key the
 * player does not have.  This turns a keyboard list into the thumb list for
 * the layout that will actually be on screen, row by row: movement keys become
 * the arrow pad, a key with a button becomes that button's label, clicking
 * becomes tapping, and a key no button sends is left off rather than promised.
 *
 * The rooms get the same treatment through `roomControls`, which is what the
 * pause menu shows when it is opened somewhere other than a cabinet.
 */

import { isTouch } from '../core/device';
import { touchLayoutFor } from '../game/touchLayouts';
import type { TouchLayout, KeyName } from './touchControls';

export type ControlRow = [string, string];

/** What each written key is, as the key name the touch layer sends. */
const KEY_OF: Record<string, KeyName> = {
  SPACE: 'SPACE',
  ENTER: 'ENTER',
  SHIFT: 'SHIFT',
  ESC: 'ESC',
  '1': 'ONE',
  '2': 'TWO',
  '3': 'THREE',
  '4': 'FOUR',
  '5': 'FIVE',
  '6': 'SIX',
  '7': 'SEVEN',
};

/** Written directions, and which way each one points. */
const DIR: Record<string, 'x' | 'y'> = {
  W: 'y',
  S: 'y',
  UP: 'y',
  DOWN: 'y',
  '↑': 'y',
  '↓': 'y',
  A: 'x',
  D: 'x',
  LEFT: 'x',
  RIGHT: 'x',
  '←': 'x',
  '→': 'x',
};

/**
 * One keyboard row, as thumbs, or null when nothing on screen sends any of
 * its keys.
 */
function touchRow([keys, does]: ControlRow, layout: TouchLayout): ControlRow | null {
  const raw = keys.trim().toUpperCase();
  const tap = (s: string) => s.replace(/\bCLICKS?\b/g, 'TAP').replace(/\bCLICKING\b/g, 'TAPPING');
  const doesT = tap(does.toUpperCase()).replace(/\bMOUSE\b/g, 'FINGER');
  if (raw === 'NOTHING') return [keys, does];
  if (/^(CLICK|MOUSE|TAP|DRAG)/.test(raw)) return [raw === 'MOUSE' ? 'TAP' : tap(raw).replace('MOUSE', 'FINGER'), doesT];
  if (raw === 'ESC') return ['GEAR', 'PAUSE MENU'];

  const hold = raw.startsWith('HOLD ');
  const body = hold ? raw.slice(5) : raw;
  const whole = body.replace(/\s+/g, ' ');
  const tokens =
    whole === 'ARROWS' || whole === 'W A S D' || whole === 'WASD'
      ? ['W', 'A', 'S', 'D']
      : whole.split(/\s*\/\s*|\s*,\s*|\s+OR\s+|\s+/).filter(Boolean);

  const names: string[] = [];
  const axes = new Set<'x' | 'y'>();
  for (const tok of tokens) {
    if (tok === 'CLICK' || tok === 'MOUSE') {
      if (!names.includes('TAP')) names.push('TAP');
      continue;
    }
    const key = (KEY_OF[tok] ?? tok) as KeyName;
    const btn = (layout.buttons ?? []).find((b) => b.key === key || b.also === key);
    if (btn) {
      if (!names.includes(btn.label)) names.push(btn.label);
      continue;
    }
    // An arm of the big cross is named by its arrow.
    const arm = layout.cross ? (['up', 'left', 'down', 'right'] as const).find((d) => layout.cross?.[d] === key) : undefined;
    if (arm) {
      names.push({ up: '↑', left: '←', down: '↓', right: '→' }[arm]);
      continue;
    }
    if (DIR[tok] && layout.stick) axes.add(DIR[tok]);
  }
  if (axes.size) {
    const pad = layout.stick === 'lr' || (axes.size === 1 && axes.has('x')) ? '← →' : axes.size === 1 ? '↑ ↓' : 'ARROWS';
    names.unshift(pad);
  }
  if (!names.length) return null;
  const arrowsOnly = names.every((n) => n.length === 1 && '↑←↓→'.includes(n));
  return [`${hold ? 'HOLD ' : ''}${names.join(arrowsOnly ? ' ' : ' / ')}`, doesT];
}

/**
 * A cabinet's controls for this device: its own rows on a keyboard, the
 * thumb version of them on a touch screen.
 */
export function deviceControls(rows: ControlRow[], layout: TouchLayout): ControlRow[] {
  if (!isTouch()) return rows;
  const out: ControlRow[] = [];
  for (const r of rows) {
    const t = touchRow(r, layout);
    if (t && !out.some((o) => o[0] === t[0] && o[1] === t[1])) out.push(t);
  }
  return out;
}

/** A cabinet's objective lines, with the keys in them said the phone's way. */
export function deviceObjective(lines: string[], layout: TouchLayout): string[] {
  if (!isTouch()) return lines;
  const space = (layout.buttons ?? []).find((b) => b.key === 'SPACE' || b.also === 'SPACE');
  return lines.map((l) => {
    let out = l.replace(/\bCLICK\b/g, 'TAP').replace(/\bCLICKS\b/g, 'TAPS');
    if (space) out = out.replace(/\bSPACE\b/g, space.label);
    return out;
  });
}

/** The keys each kind of place reads, written the way a card writes them. */
const ROOM_ROWS: ControlRow[] = [
  ['W A S D', 'WALK'],
  ['SHIFT', 'RUN'],
  ['E', 'USE WHAT YOU ARE AT'],
  ['CLICK', 'WALK TO A MACHINE OR DOOR'],
  ['ESC', 'PAUSE'],
];
const STREET_ROWS: ControlRow[] = [
  ['A / D', 'WALK'],
  ['E', 'TALK / GO IN'],
  ['ESC', 'PAUSE'],
];
const PLACE_ROWS: Record<string, ControlRow[]> = {
  ExteriorDay: STREET_ROWS,
  ExteriorNight: STREET_ROWS,
  BackAlley: STREET_ROWS,
  HideRoom3D: [
    ['W A S D', 'MOVE'],
    ['DRAG', 'LOOK AROUND'],
    ['E', 'HIDE / COME OUT / PICK UP'],
    ['C', 'CROUCH - QUIETER'],
    ['SHIFT', 'RUN - LOUDER'],
    ['ESC', 'PAUSE'],
  ],
  NightRoad3D: [
    ['W A S D', 'WALK'],
    ['DRAG', 'LOOK AROUND'],
    ['SHIFT', 'RUN - LOUDER'],
    ['C', 'CROUCH - QUIETER, HARDER TO SEE'],
    ['SPACE', 'JUMP'],
    ['ESC', 'PAUSE'],
  ],
  HotelHall3D: [
    ['W A S D', 'WALK'],
    ['DRAG', 'LOOK AROUND'],
    ['SHIFT', 'RUN'],
    ['E', 'PRESS THE LIFT BUTTON'],
    ['ESC', 'PAUSE'],
  ],
  Chase3D: [
    ['W A S D', 'RUN AND STEER'],
    ['Q / E', 'TURN'],
    ['DRAG', 'LOOK AROUND'],
    ['ESC', 'PAUSE'],
  ],
  BasementSequence: [
    ['CLICK', 'NEXT'],
    ['ESC', 'PAUSE'],
  ],
  FroggyCharity: [
    ['CLICK', 'CHOOSE'],
    ['ESC', 'PAUSE'],
  ],
};

/** What the pause menu lists for a place that is not a cabinet. */
export function roomControls(sceneKey: string): ControlRow[] {
  const rows = PLACE_ROWS[sceneKey] ?? ROOM_ROWS;
  return deviceControls(rows, touchLayoutFor(sceneKey));
}
