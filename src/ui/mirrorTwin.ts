/**
 * ---- YOU, IN A MIRROR.
 *
 * A twin of the player, the other way round, clipped to a mirror's glass,
 * walking when they walk -- shown only while they are actually AT the mirror:
 * in front of it along the wall and close up to the wall, not anywhere down
 * the room that happens to line up with it.  Threads' long mirror is the one
 * this was made for; the wall mirror you can buy at Home and Hearth uses the
 * same twin, so hanging one at home is the same mirror.
 *
 * It reads the room's player and floor line off the scene (every WalkRoom has
 * both) and runs itself off the scene's update.
 */

import Phaser from 'phaser';
import { Player } from '../art/player';

export interface Glass {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How far out from the wall's foot you can stand and still be in the glass. */
const NEAR = 18;

export class MirrorTwin {
  private twin: Player | null = null;
  private of: Player | null = null;
  private mask: Phaser.Display.Masks.GeometryMask;
  private shape: Phaser.GameObjects.Graphics;
  private readonly tick = (): void => this.update();

  /**
   * `glass` is the glass itself (inside the frame), `depth` the frame's;
   * `feetBelow` how far under the glass's foot the twin's feet are (a tall
   * mirror shows all of you, a small one your head and shoulders).
   */
  constructor(
    private scene: Phaser.Scene,
    private glass: Glass,
    private depth: number,
    private feetBelow = 2,
  ) {
    this.shape = scene.make.graphics({}, false);
    this.shape.fillStyle(0xffffff, 1).fillRect(glass.x, glass.y, glass.w, glass.h);
    this.mask = this.shape.createGeometryMask();
    scene.events.on('update', this.tick);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private update(): void {
    const host = this.scene as unknown as { player?: Player; floorTop?: number };
    const p = host.player;
    if (!p) return;
    // (made again whenever the player is: a change of clothes is a new you)
    if (this.of !== p) {
      this.twin?.sprite.destroy();
      this.twin = new Player(this.scene, p.x, 0, false);
      this.twin.sprite.setMask(this.mask);
      this.of = p;
    }
    const tw = this.twin!;
    const cx = this.glass.x + this.glass.w / 2;
    const wall = host.floorTop ?? this.glass.y + this.glass.h;
    const near = Math.abs(p.x - cx) < this.glass.w / 2 + 6 && p.y - wall < NEAR;
    tw.sprite.setVisible(near && p.sprite.visible);
    if (!near) return;
    tw.setPosition(p.x, this.glass.y + this.glass.h + this.feetBelow);
    tw.sprite.setDepth(this.depth + 0.1);
    // the other way round, and walking when you walk
    tw.sprite.setScale(-p.sprite.scaleX || -1, 1);
    tw.face(p.facing);
  }

  destroy(): void {
    this.scene.events.off('update', this.tick);
    this.twin?.sprite.destroy();
    this.twin = null;
    this.shape.destroy();
  }
}
