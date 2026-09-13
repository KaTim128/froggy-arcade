/**
 * Which thumb controls each scene puts on screen.
 *
 * ONE TABLE, so a scene cannot be shipped without somebody deciding what a
 * phone does in it.  The default at the bottom is deliberately the walking
 * room set rather than "nothing": a scene nobody has thought about is far more
 * likely to be somewhere you walk than somewhere you sit, and a spare button
 * costs a player nothing while a missing stick costs them the game.
 *
 * Cabinets are NOT in here.  A cabinet's layout lives in its own module next
 * to its tutorial, and `MinigameScene` hands it over when the game is built —
 * see `minigames/types.ts`.
 *
 * Anything played by tapping the picture — the prize shelf, the change
 * machine, the settings panel, the basement's slides — declares an EMPTY
 * layout.  That is not "no controls": on a touch screen a tap on the canvas is
 * already a click, so those scenes are complete without a single button, and
 * drawing one would only cover the thing being tapped.
 */

import Phaser from 'phaser';
import { touchControls, type TouchLayout } from '../ui/touchControls';

/** Walking a room: a stick, interact, and a run key that rooms honour. */
const ROOM: TouchLayout = {
  stick: 'wasd',
  arrows: true,
  buttons: [
    { label: 'E', key: 'E', primary: true },
    { label: 'RUN', key: 'SHIFT' },
  ],
};

/** A pavement: you only ever go left and right on one. */
const STREET: TouchLayout = {
  stick: 'lr',
  arrows: true,
  buttons: [{ label: 'E', key: 'E', primary: true }],
};

/** Nothing but the picture, which is already tappable. */
const TAP: TouchLayout = {};

/** A card or a cutscene: not even the quit button belongs on it. */
const BARE: TouchLayout = { noQuit: true };

export const SCENE_TOUCH: Record<string, TouchLayout> = {
  Boot: BARE,
  StartScreen: BARE,
  ProfileModal: BARE,
  SettingsModal: TAP,
  IntroCutscene: { noQuit: true, buttons: [{ label: 'NEXT', key: 'SPACE', primary: true }] },

  ArcadeHub: ROOM,
  ArcadeAnnex: ROOM,
  ArcadeCasino: ROOM,
  ArcadeDark: ROOM,

  ExteriorDay: STREET,
  ExteriorNight: STREET,
  BackAlley: STREET,

  PrizeCounter: TAP,
  PrizeExchange: TAP,
  ChangeMachine: TAP,
  FroggyCharity: TAP,
  BasementSequence: TAP,

  // The two rooms you are actually inside.  Drag the picture to turn; the
  // stick walks.  Crouch is a toggle in the hide room and the run key is worth
  // having under a thumb when he has seen you.
  HideRoom3D: {
    stick: 'wasd',
    look: true,
    buttons: [
      { label: 'E', key: 'E', primary: true },
      { label: 'CROUCH', key: 'C' },
      { label: 'RUN', key: 'SHIFT' },
    ],
  },
  // The chase turns on Q and E, not on E alone — E is a turn here, not an
  // interact — and A/D steer when you are not running forward, so the stick
  // alone finishes the corridor.
  Chase3D: {
    stick: 'wasd',
    look: true,
    buttons: [
      { label: '↶', key: 'Q' },
      { label: '↷', key: 'E' },
    ],
  },

  SecondBust: BARE,
  EjectionCutscene: BARE,
  OutroCutscene3D: BARE,
  TheEnd: BARE,
  EndCard: BARE,
  // Set by the cabinet itself the moment its module is built; until then the
  // how-to-play card is up, and that is two big buttons you tap.
  Minigame: TAP,
};

export function touchLayoutFor(sceneKey: string): TouchLayout {
  return SCENE_TOUCH[sceneKey] ?? ROOM;
}

// ---------------------------------------------------------------- the director

/**
 * Keeping what is on screen and what is under your thumbs in step.
 *
 * The layout follows the TOPMOST running scene, because that is the one the
 * player is looking at: a prize shelf opened over the hub owns the controls
 * while it is up, and hands them back the moment it closes.  Scenes are asked
 * again a tick after anything starts, stops, sleeps or wakes rather than being
 * trusted to announce themselves, so a scene added later cannot forget to.
 */

let gameRef: Phaser.Game | null = null;
let cabinet: TouchLayout | null = null;
let pending = 0;

/** The cabinet currently being played owns the buttons; null hands them back. */
export function setCabinetTouch(layout: TouchLayout | null): void {
  cabinet = layout;
  refreshTouchLayout();
}

const EVENTS = [
  Phaser.Scenes.Events.CREATE,
  Phaser.Scenes.Events.WAKE,
  Phaser.Scenes.Events.RESUME,
  Phaser.Scenes.Events.SHUTDOWN,
  Phaser.Scenes.Events.SLEEP,
  Phaser.Scenes.Events.PAUSE,
];
const hooked = new WeakSet<Phaser.Scene>();

export function installTouchDirector(game: Phaser.Game): void {
  if (!touchControls.mounted()) return;
  gameRef = game;
  // The scene list is EMPTY the instant the game is constructed — Phaser fills
  // it during boot — so hooking here and walking away attached nothing and the
  // controls kept whatever layout the title screen left them with.  Hook on
  // ready, and again on every refresh, so a scene added at any point is caught.
  game.events.once(Phaser.Core.Events.READY, () => {
    hookScenes();
    refreshTouchLayout();
  });
  hookScenes();
  refreshTouchLayout();
}

function hookScenes(): void {
  if (!gameRef) return;
  for (const scene of gameRef.scene.scenes) {
    if (hooked.has(scene)) continue;
    hooked.add(scene);
    for (const ev of EVENTS) scene.events.on(ev, schedule);
  }
}

/** A tick later, so the scene list has finished changing. */
function schedule(): void {
  if (pending) return;
  pending = window.setTimeout(() => {
    pending = 0;
    refreshTouchLayout();
  }, 0);
}

export function refreshTouchLayout(): void {
  if (!gameRef || !touchControls.mounted()) return;
  hookScenes();
  const running = gameRef.scene.getScenes(true);
  const top = running.length ? running[running.length - 1].scene.key : 'Boot';
  if (top === 'Minigame' && cabinet) touchControls.apply(cabinet);
  else touchControls.apply(touchLayoutFor(top));
}
