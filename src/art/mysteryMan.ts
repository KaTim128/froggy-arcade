/**
 * The man outside.
 *
 * Black hat, black jacket, hands in his pockets, stood by the kerb in full
 * daylight where anybody could see him — which is somehow worse than if he
 * were hiding.  He is drawn out of the same flat pixel rectangles as the
 * player and the cabinets: he belongs to this world, unlike Froggy.
 *
 * He never moves from this spot.  He is here when you go in, and he is here
 * when you come out, for as long as there is anything left to sell him.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { LOOKS, Player } from './player';


export class MysteryMan {
  readonly root: Phaser.GameObjects.Container;
  private breath: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const parts: Phaser.GameObjects.GameObject[] = [];
    const add = (o: Phaser.GameObjects.GameObject) => {
      parts.push(o);
      return o;
    };

    // Drawn to the player's scale: a tall man, a head over the 26-pixel
    // drifter with the hat on.  He used to be twice the player's height.
    // A hard shadow at his feet: it is the middle of the day.
    add(scene.add.ellipse(1, 0, 14, 3, PALETTE.black, 0.45));

    // the drifter's own rig, in black: hat, coat, the brim's shadow
    const body = new Player(scene, 0, 0, false, LOOKS.stranger);
    body.stride(-1, 0);
    body.stand();
    add(body.sprite);

    this.root = scene.add.container(x, y, parts as Phaser.GameObjects.GameObject[]);
    this.root.setDepth(60);

    // He breathes, and that is the entire animation.  Anything more would make
    // him a character; standing perfectly still would make him a prop.
    this.breath = scene.tweens.add({
      targets: this.root,
      y: y - 1,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  get x(): number {
    return this.root.x;
  }

  destroy(): void {
    this.breath.stop();
    this.root.destroy();
  }
}
