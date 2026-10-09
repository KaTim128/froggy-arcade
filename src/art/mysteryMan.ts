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
import { PALETTE, dim } from '../render/palette';
import { finishFigure } from './surface';

const COAT = 0x14161c;
const COAT_LIT = 0x232833;
const HAT = 0x0d0f13;
const SKIN = 0x8a6a4e;

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

    // legs -- trousers, the same black as everything else he owns -- and shoes
    add(scene.add.rectangle(-2, -1, 3, 8, dim(COAT, 0.8)).setOrigin(0.5, 1));
    add(scene.add.rectangle(2, -1, 3, 8, dim(COAT, 0.8)).setOrigin(0.5, 1));
    add(scene.add.rectangle(-2, 0, 4, 2, PALETTE.black).setOrigin(0.5, 1));
    add(scene.add.rectangle(3, 0, 4, 2, PALETTE.black).setOrigin(0.5, 1));

    // the jacket: long, square-shouldered, buttoned
    add(scene.add.rectangle(0, -8, 11, 11, COAT).setOrigin(0.5, 1));
    add(scene.add.rectangle(0, -17, 12, 3, COAT_LIT).setOrigin(0.5, 1)); // shoulders
    // the lapels, a V of slightly lighter cloth
    add(scene.add.rectangle(-1.5, -13, 2, 5, COAT_LIT).setOrigin(0.5, 1).setAngle(12));
    add(scene.add.rectangle(1.5, -13, 2, 5, COAT_LIT).setOrigin(0.5, 1).setAngle(-12));
    // hands, pocketed -- you never see them until there is money in them
    add(scene.add.rectangle(-6, -9, 2, 4, COAT_LIT).setOrigin(0.5, 1));
    add(scene.add.rectangle(6, -9, 2, 4, COAT_LIT).setOrigin(0.5, 1));

    // neck and face, what little of it there is under the brim
    add(scene.add.rectangle(0, -19, 3, 2, dim(SKIN, 0.7)).setOrigin(0.5, 1));
    add(scene.add.rectangle(0, -20, 6, 6, SKIN).setOrigin(0.5, 1));
    // the brim throws the top half of his face into shadow, permanently
    add(scene.add.rectangle(0, -23, 6, 3, dim(SKIN, 0.45)).setOrigin(0.5, 1));
    add(scene.add.rectangle(-1.5, -23, 1, 1, PALETTE.bone).setOrigin(0.5, 1));
    add(scene.add.rectangle(1.5, -23, 1, 1, PALETTE.bone).setOrigin(0.5, 1));

    // the hat: a wide flat brim and a low crown
    add(scene.add.rectangle(0, -26, 12, 2, HAT).setOrigin(0.5, 1));
    add(scene.add.rectangle(0, -28, 7, 4, HAT).setOrigin(0.5, 1));
    add(scene.add.rectangle(0, -28, 7, 1, dim(HAT, 1.8)).setOrigin(0.5, 1)); // hatband

    this.root = scene.add.container(x, y, parts as Phaser.GameObjects.GameObject[]);
    // the same finish as the player: an outline round him, lit edges, weave
    // in the cloth.  Black on black, so the outline is only a shade darker.
    finishFigure(scene, this.root, { outline: 0x050506, seed: 31 });
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
