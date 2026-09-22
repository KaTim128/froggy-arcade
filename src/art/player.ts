/**
 * The player character.  Placeholder-grade (PRD §11.5): a shape that reads as a
 * person in a hoodie from three feet away, which is all Phase 1 needs.
 */

import Phaser from 'phaser';
import { PALETTE, nightify } from '../render/palette';
import { audio } from '../core/audio';

export const PLAYER_SPEED = 62; // logical px/s
/**
 * Holding SHIFT: 1.4x the walk, and nothing else about the walk changes.
 *
 * A fifth faster was not enough to be worth holding a key down for across a
 * room this size; two and a half times it would have the player skating past
 * every cabinet they were aiming at.  1.4 crosses the floor noticeably quicker
 * and still stops where you meant to stop.
 */
export const SPRINT_MUL = 1.4;
const STEP_INTERVAL_MS = 340;

/**
 * Where the player sorts against the room's fixtures: 50, plus a thousandth
 * per pixel down the screen.  Fixtures that can be stood behind pick a depth
 * off the same scale (see `COUNTER_DEPTH` in game/content.ts).
 */
export function depthFor(y: number): number {
  return 50 + y / 1000;
}

/**
 * What is underfoot, and what that sounds like.
 *
 * The arcade is carpeted -- every room of it -- and outside is loose ground,
 * which is a different sound and not merely a brighter one.  `concrete` is
 * kept for the places that really are a bare slab: the basement, the flooded
 * lower level.
 */
export type Surface = 'carpet' | 'concrete' | 'gravel';

const FLOOR_SFX: Record<Surface, 'footstep_carpet' | 'footstep_concrete' | 'footstep_gravel'> = {
  carpet: 'footstep_carpet',
  concrete: 'footstep_concrete',
  gravel: 'footstep_gravel',
};

export class Player {
  readonly sprite: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Rectangle;
  private stepTimer = 0;
  private bobT = 0;
  private torso: Phaser.GameObjects.Rectangle;
  private surface: Surface = 'carpet';
  private shift: Phaser.Input.Keyboard.Key | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, night = false) {
    this.shift = scene.input.keyboard?.addKey('SHIFT') ?? null;
    const c = (col: number) => (night ? nightify(col) : col);
    this.body = scene.add.rectangle(0, 0, 10, 8, c(PALETTE.rust)).setOrigin(0.5, 1);
    this.torso = scene.add.rectangle(0, -8, 12, 12, c(PALETTE.brownLight)).setOrigin(0.5, 1);
    const head = scene.add.rectangle(0, -20, 8, 8, c(PALETTE.cream)).setOrigin(0.5, 1);
    const hood = scene.add.rectangle(0, -22, 10, 5, c(PALETTE.brown)).setOrigin(0.5, 1);
    this.sprite = scene.add.container(x, y, [this.body, this.torso, head, hood]);
    // Sorted by where the feet are, from the first frame: a flat 50 here meant
    // a player who had not moved yet sorted against the room as if they were
    // standing at its top edge.
    this.sprite.setDepth(depthFor(y));
  }

  setSurface(s: Surface): void {
    this.surface = s;
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    // Being put somewhere is being somewhere: the depth has to follow, or a
    // player placed behind a fixture keeps the sorting of wherever they were.
    this.sprite.setDepth(depthFor(y));
  }

  /** Returns true if the player actually moved this frame. */
  move(dx: number, dy: number, delta: number, bounds: Phaser.Geom.Rectangle): boolean {
    const len = Math.hypot(dx, dy);
    if (len === 0) {
      this.torso.y = -8;
      return false;
    }
    const sprinting = this.shift?.isDown ?? false;
    const step = (PLAYER_SPEED * (sprinting ? SPRINT_MUL : 1) * delta) / 1000;
    const nx = this.sprite.x + (dx / len) * step;
    const ny = this.sprite.y + (dy / len) * step;
    this.sprite.x = Phaser.Math.Clamp(nx, bounds.x, bounds.right);
    this.sprite.y = Phaser.Math.Clamp(ny, bounds.y, bounds.bottom);
    this.sprite.setDepth(depthFor(this.sprite.y));

    // A one-pixel bob, and a footstep.  The footsteps matter later.
    this.bobT += delta;
    this.torso.y = -8 - (Math.sin(this.bobT / 90) > 0 ? 1 : 0);

    this.stepTimer += delta * (sprinting ? SPRINT_MUL : 1);
    if (this.stepTimer >= STEP_INTERVAL_MS) {
      this.stepTimer = 0;
      audio.sfx(FLOOR_SFX[this.surface]);
    }
    return true;
  }
}
