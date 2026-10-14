/**
 * A solid box behind a line of text that has none -- the drifter's thoughts,
 * what just happened, the notices along the bottom of the screen -- so it
 * reads over a bright street as well as a dark room.  It follows the text
 * every frame (where it is, how big it came out, whether it is showing and
 * how faded), so whatever the scene already does with the text -- set it,
 * fade it, hide it -- the box does too.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';

export function backPlate(scene: Phaser.Scene, t: Phaser.GameObjects.BitmapText, edge: number = PALETTE.steel): Phaser.GameObjects.Rectangle {
  const r = scene.add.rectangle(0, 0, 4, 4, PALETTE.ink, 1).setOrigin(0, 0).setStrokeStyle(1, edge).setVisible(false);
  const sync = () => {
    if (!t.active) {
      r.destroy();
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync);
      return;
    }
    const on = t.visible && t.alpha > 0.01 && t.text.trim().length > 0;
    r.setVisible(on);
    if (!on) return;
    const b = t.getBounds();
    r.setPosition(Math.floor(b.x) - 5, Math.floor(b.y) - 4)
      .setSize(Math.ceil(b.width) + 10, Math.ceil(b.height) + 7)
      .setAlpha(t.alpha * 0.96)
      .setDepth(t.depth - 0.01)
      .setScrollFactor(t.scrollFactorX, t.scrollFactorY);
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync));
  return r;
}
