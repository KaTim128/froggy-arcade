/**
 * A person who stands IN the room -- the counter staff, Froggy on the
 * counter, the hotel clerk -- drawn with the overlay's pixel-mode figure code
 * (the same reduction to the drifter's pixels and ink outline, see
 * froggyLayer `pixelate`) but put into the game as a texture at a depth.
 *
 * They used to be painted on the overlay, which sits ABOVE the whole game, so
 * the player standing in front of them had to be cut out of them: a
 * rectangle the size of his head and body, removed from whoever was behind.
 * Wherever that rectangle did not line up with his outline, it showed as a
 * square hole in the staff.  In the room there is nothing to cut: the player
 * is drawn after them because he is in front of them.
 */

import Phaser from 'phaser';
import { froggyLayer, type FroggyPainter } from './froggyLayer';
import { GAME_W, GAME_H } from './pixelScaler';

let n = 0;

export class StageFigure {
  private tex: Phaser.Textures.CanvasTexture;
  readonly image: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene, depth: number) {
    const key = `stage_figure_${n++}`;
    this.tex = scene.textures.createCanvas(key, GAME_W, GAME_H)!;
    // (screen space, like the overlay it replaces: a painter that follows a
    // scrolling room translates itself, as it did there)
    this.image = scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(depth).setScrollFactor(0);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Redraw the figure(s).  Same painter as the overlay's pixel mode. */
  paint(fn: FroggyPainter): void {
    const low = froggyLayer.pixelate(fn);
    const ctx = this.tex.getContext();
    ctx.clearRect(0, 0, GAME_W, GAME_H);
    if (low) ctx.drawImage(low, 0, 0);
    this.tex.refresh();
  }

  clear(): void {
    this.tex.getContext().clearRect(0, 0, GAME_W, GAME_H);
    this.tex.refresh();
  }

  setDepth(d: number): this {
    this.image.setDepth(d);
    return this;
  }

  destroy(): void {
    if (!this.scene.textures.exists(this.tex.key)) return;
    this.image.destroy();
    this.scene.textures.remove(this.tex.key);
  }
}
