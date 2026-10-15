/**
 * Closing time.  Only somebody INSIDE the arcade is told: out on the street,
 * the shop just shuts behind its shutters and nobody walks you back in to
 * hear it (before Hide and Seek, see core/broke `evaluateBroke` and the
 * hub's closing check; after it, `showOutAtNight` below).
 */

import type Phaser from 'phaser';
import { store } from '../core/state';
import { centerText, fadeToScene } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { PALETTE } from '../render/palette';
import { backPlate } from '../ui/plate';
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
      const t = centerText(scene, GAME_W / 2, GAME_H - 30, `THE ARCADE IS CLOSING FOR THE NIGHT. OPEN AGAIN AT ${twelveHour(SUNRISE_HOUR)}.`, PALETTE.gold)
        .setScrollFactor(0)
        .setDepth(990);
      backPlate(scene, t);
      scene.time.delayedCall(2000, () => fadeToScene(scene, 'ExteriorDay', { fromArcade: true }));
    },
  });
}
