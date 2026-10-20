/**
 * Closing time.  Only somebody INSIDE the arcade is told: out on the street,
 * the shop just shuts behind its shutters and nobody walks you back in to
 * hear it (before Hide and Seek, see core/broke `evaluateBroke` and the
 * hub's closing check; after it, `showOutAtNight` below).
 */

import type Phaser from 'phaser';
import { store } from '../core/state';
import { audio } from '../core/audio';
import { button, centerText, fadeToScene } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { PALETTE } from '../render/palette';
import { SUNRISE_HOUR, clock, twelveHour } from './life';

/**
 * BEFORE Hide and Seek, the night after closing is when the alley's side door
 * is the way back in (the story's break-in).  Shown out at closing, you are
 * on the ordinary street -- HUD, clock, the pavement to sleep on -- and the
 * alley mouth is open to you until sunrise.
 */
export function backWayOpen(s = store.get()): boolean {
  return !s.froggyGone && s.route === 'normal' && s.seenIntro && s.timeOfDay !== 'midnight' && clock(s.life.t).closed;
}

/** The game day whose closing notice has been shown (once a day). */
let noticeDay = -1;

/** Whether today's closing notice has already been shown. */
export function closingNoticed(): boolean {
  return noticeDay === clock().day;
}

/**
 * THE ARCADE IS CLOSING: a friendly notice, once, at 7:45 PM, in whichever of
 * the arcade's rooms you are standing in -- never over a cabinet that is being
 * played (the rooms only check while nobody is busy).  OK carries on with
 * whatever closing does next.  If it has been seen today, `then` runs at once.
 */
export function closingNotice(scene: Phaser.Scene, then: () => void): void {
  if (closingNoticed()) {
    then();
    return;
  }
  noticeDay = clock().day;
  const c = scene.add.container(0, 0).setDepth(2000).setScrollFactor(0);
  const veil = scene.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.45).setOrigin(0, 0).setInteractive();
  const W = 230;
  const H = 76;
  const x = GAME_W / 2;
  const y = GAME_H / 2 - 6;
  c.add(veil);
  c.add(scene.add.rectangle(x, y, W, H, PALETTE.ink, 0.97).setStrokeStyle(2, PALETTE.gold));
  c.add(scene.add.rectangle(x, y - H / 2 + 9, W - 4, 14, PALETTE.plum));
  c.add(centerText(scene, x, y - H / 2 + 9, 'THE ARCADE IS CLOSING', PALETTE.gold));
  c.add(centerText(scene, x, y - 8, `IT IS 7:45 PM - TIME TO HEAD HOME!`, PALETTE.cream));
  c.add(centerText(scene, x, y + 3, `WE OPEN AGAIN AT ${twelveHour(SUNRISE_HOUR)}. SEE YOU TOMORROW.`, PALETTE.fog));
  let done = false;
  const ok = (): void => {
    if (done) return;
    done = true;
    c.destroy(true);
    then();
  };
  c.add(button(scene, x, y + H / 2 - 12, 'OK', ok, { width: 54, height: 13 }));
  c.each((o: Phaser.GameObjects.GameObject) => (o as unknown as { setScrollFactor?: (n: number) => void }).setScrollFactor?.(0));
  // (E, Space and Enter answer it as well as the button)
  const kb = scene.input.keyboard;
  for (const k of ['E', 'SPACE', 'ENTER']) kb?.once(`keydown-${k}`, ok);
  audio.sfx('chime', 0.6);
}

/**
 * OUT OF THE DOORS AT CLOSING: the notice (once a day), and OK takes you
 * straight out onto the forecourt through a slow fade to black.  Nobody
 * walks you to the door and nobody says goodbye -- the building just shuts.
 */
export function closeAndShowOut(scene: Phaser.Scene): void {
  closingNotice(scene, () => fadeToScene(scene, 'ExteriorDay', { fromArcade: true }, { ms: 900, hold: 450 }));
}

/**
 * AFTER the night in the arcade, the building keeps hours like any other:
 * open from sunrise (7:00 AM) until night falls (7:45 PM).  Inside it when
 * it shuts, you are told so and shown out onto the forecourt, where the
 * shutters come down behind you.
 */
export function showOutAtNight(scene: Phaser.Scene, free: () => boolean, onGo: () => void): void {
  scene.time.addEvent({
    delay: 1000,
    loop: true,
    callback: () => {
      const s = store.get();
      if (!s.froggyGone || s.route !== 'normal' || s.timeOfDay === 'midnight' || !clock().closed || !free()) return;
      onGo();
      // the notice first (once a day), then out onto the forecourt
      closeAndShowOut(scene);
    },
  });
}
