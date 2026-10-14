/**
 * Before Hide and Seek, the arcade shutting for the day is what starts the
 * night -- so the day may not end anywhere else.  Out on the street at
 * closing time, you are walked back to the front room, where Froggy is
 * waiting to say so (see core/broke `evaluateBroke`).
 */

import type Phaser from 'phaser';
import { closingTime } from '../core/broke';
import { store } from '../core/state';
import { centerText, fadeToScene } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { PALETTE } from '../render/palette';
import { backPlate } from '../ui/plate';
import { SUNRISE_HOUR, clock, twelveHour } from './life';

export function pullBackAtClosing(scene: Phaser.Scene, free: () => boolean, onGo: () => void): void {
  scene.time.addEvent({
    delay: 2000,
    loop: true,
    callback: () => {
      const s = store.get();
      if (s.froggyGone || s.route !== 'normal' || s.timeOfDay === 'midnight' || !closingTime() || !free()) return;
      onGo();
      fadeToScene(scene, 'ArcadeHub', {});
    },
  });
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
