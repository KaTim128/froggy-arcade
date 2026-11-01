/**
 * A piece of furniture standing in a room you walk round: drawn on its own,
 * sorted by its feet with the player (so you walk behind the tall ones and in
 * front of the short ones), and with what it does when used -- the TV's
 * picture, the lamp's light, the radio's notes.
 */

import Phaser from 'phaser';
import { audio } from '../../core/audio';
import { drawFurniture, mirrorGlass } from '../../art/furnitureArt';
import { depthFor } from '../../art/player';
import type { FurnitureDef } from '../../game/catalog';
import { paintMirrorShine } from '../../art/shopFittings';
import { MirrorTwin } from '../../ui/mirrorTwin';

export class Piece {
  readonly g: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.GameObject | null = null;
  on = false;

  constructor(private scene: Phaser.Scene, readonly def: FurnitureDef, readonly x: number, readonly y: number, readonly flip = false) {
    this.g = scene.add.graphics();
    drawFurniture(this.g, def, x, y, flip);
    // wall things and rugs are behind everybody; the rest stand where they stand
    this.g.setDepth(def.wall ? 2 : def.cat === 'rug' ? 3 : depthFor(y));
    // A wall mirror is Threads' mirror: you are in it when you stand at it,
    // under its shine.
    // Every mirror shows you, live, when you stand at it -- each with its
    // own glass (art/furnitureArt `mirrorGlass`), under its shine.
    const glass = mirrorGlass(def, x, y);
    if (glass) {
      this.twin = new MirrorTwin(scene, glass, 2, glass.feet);
      this.shine = scene.add.graphics().setDepth(2.2);
      if (glass.round) {
        // a soft highlight across the top-left of a round glass
        this.shine.fillStyle(0xffffff, 0.28).fillEllipse(glass.x + glass.w * 0.36, glass.y + glass.h * 0.3, glass.w * 0.38, glass.h * 0.2);
      } else paintMirrorShine(this.shine, glass.x - 3, glass.y - 3, glass.w + 6, glass.h + 6);
    }
  }

  private twin: MirrorTwin | null = null;
  private shine: Phaser.GameObjects.Graphics | null = null;

  /** The TV's picture or the lamp's light, on or off. */
  toggle(): boolean {
    this.on = !this.on;
    this.glow?.destroy();
    this.glow = null;
    const { def, x, y } = this;
    if (this.on && def.cat === 'tv') {
      // a lit screen, flickering through channels
      const r = this.scene.add.rectangle(x, y - def.h / 2 - 1, def.w - 4, def.h - 8, 0x9ad8ff, 0.85).setDepth(depthFor(y) + 0.0001);
      this.scene.tweens.add({ targets: r, alpha: 0.45, duration: 180, yoyo: true, repeat: -1, ease: 'Stepped' });
      this.glow = r;
      audio.sfx('lamp_click', 0.5);
    } else if (this.on && def.cat === 'lamp') {
      const c = this.scene.add.circle(x, y - def.h + 4, def.w * 3, 0xffe8a0, 0.18).setDepth(depthFor(y) - 0.0001).setBlendMode(Phaser.BlendModes.ADD);
      this.glow = c;
      audio.sfx('lamp_click', 0.5);
    } else audio.sfx('lamp_click', 0.4);
    return this.on;
  }

  /** The radio: a few notes float up from it. */
  play(): void {
    audio.sfx('chime', 0.6);
    for (let i = 0; i < 4; i++) {
      const n = this.scene.add.text(this.x + (i % 2 ? 3 : -3), this.y - this.def.h, '♪', { fontSize: '8px', color: '#f0e0b0' }).setDepth(800);
      this.scene.tweens.add({ targets: n, y: n.y - 18, alpha: 0, delay: i * 220, duration: 900, onComplete: () => n.destroy() });
    }
  }

  destroy(): void {
    this.g.destroy();
    this.twin?.destroy();
    this.shine?.destroy();
    this.glow?.destroy();
  }
}
