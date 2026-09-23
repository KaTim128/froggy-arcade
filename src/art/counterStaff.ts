/**
 * THE PERSON BEHIND THE PRIZE COUNTER.
 *
 * Until the night, it is Froggy: the mascot leans over the glass with a grin
 * on and nobody thinks anything of it.  After the night he is not there any
 * more, and the arcade has done what an arcade does about a missing member of
 * staff -- put somebody else on the counter.  This is that somebody: a bored
 * teenager in the house shirt, visor on, standing where Froggy stood.
 *
 * Built the way the arcade's other figures are (see `MysteryMan`) -- flat
 * rectangles, three tones a piece, the light from the left -- so he belongs to
 * the room rather than to a different game.  He is drawn UNDER the counter's
 * own depth, so the counter covers him from the chest down and what shows is a
 * head and shoulders above the glass: he is behind it, and he is not standing
 * anywhere the player can walk.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';

const SHIRT = 0x2f6f8f;
const SHIRT_LIT = 0x4a94b4;
const SHIRT_DARK = 0x1d4c63;
const SKIN = 0xd8a273;
const SKIN_DARK = 0xb07f55;
const HAIR = 0x3a2a20;

export class CounterStaff {
  readonly root: Phaser.GameObjects.Container;
  private bob: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, depth: number) {
    const parts: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      parts.push(o);
      return o;
    };

    // ---- the shirt.  Square shoulders, a collar, and the arcade's own name
    // strip across the chest -- which at this size is the whole uniform.
    add(scene.add.rectangle(0, 0, 16, 18, SHIRT).setOrigin(0.5, 1));
    add(scene.add.rectangle(0, -16, 18, 4, SHIRT_LIT).setOrigin(0.5, 1));
    add(scene.add.rectangle(-8, -2, 3, 14, SHIRT_DARK).setOrigin(0.5, 1));
    add(scene.add.rectangle(8, -2, 3, 14, SHIRT_DARK).setOrigin(0.5, 1));
    // the name strip, and the badge on it
    add(scene.add.rectangle(0, -6, 12, 3, PALETTE.cream).setOrigin(0.5, 1).setAlpha(0.85));
    add(scene.add.rectangle(-4, -7, 2, 2, PALETTE.neon).setOrigin(0.5, 1));
    // the collar, open at the throat
    add(scene.add.rectangle(-3, -16, 4, 4, SHIRT_LIT).setOrigin(0.5, 1).setAngle(12));
    add(scene.add.rectangle(3, -16, 4, 4, SHIRT_LIT).setOrigin(0.5, 1).setAngle(-12));

    // ---- neck and head
    add(scene.add.rectangle(0, -17, 5, 3, SKIN_DARK).setOrigin(0.5, 1));
    add(scene.add.rectangle(0, -19, 11, 11, SKIN).setOrigin(0.5, 1));
    add(scene.add.rectangle(-5, -19, 2, 9, SKIN_DARK).setOrigin(0.5, 1));
    // hair under the visor, and the visor itself
    add(scene.add.rectangle(0, -28, 12, 4, HAIR).setOrigin(0.5, 1));
    add(scene.add.rectangle(0, -29, 14, 3, PALETTE.neon).setOrigin(0.5, 1));
    add(scene.add.rectangle(0, -29, 14, 1, PALETTE.cream).setOrigin(0.5, 1).setAlpha(0.6));
    // eyes, looking at nothing in particular
    add(scene.add.rectangle(-2.5, -24, 2, 2, PALETTE.ink).setOrigin(0.5, 1));
    add(scene.add.rectangle(2.5, -24, 2, 2, PALETTE.ink).setOrigin(0.5, 1));

    this.root = scene.add.container(x, y, parts).setDepth(depth);
    // Breathing, and nothing else.  A counter attendant who paces is a
    // counter attendant the player watches instead of the prizes.
    this.bob = scene.tweens.add({
      targets: this.root,
      y: y - 1,
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  destroy(): void {
    this.bob.stop();
    this.root.destroy();
  }
}
