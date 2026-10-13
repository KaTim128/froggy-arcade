/**
 * Before Hide and Seek, the arcade shutting for the day is what starts the
 * night -- so the day may not end anywhere else.  Out on the street at
 * closing time, you are walked back to the front room, where Froggy is
 * waiting to say so (see core/broke `evaluateBroke`).
 */

import type Phaser from 'phaser';
import { closingTime } from '../core/broke';
import { store } from '../core/state';
import { fadeToScene } from '../core/ui';

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
