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

    // A hard shadow at his feet: it is the middle of the day.
    add(scene.add.ellipse(2, 1, 22, 6, PALETTE.black, 0.45));

    // legs — trousers, the same black as everything else he owns
    add(scene.add.rectangle(-4, -1, 5, 15, dim(COAT, 0.8)).setOrigin(0.5, 1));
    add(scene.add.rectangle(4, -1, 5, 15, dim(COAT, 0.8)).setOrigin(0.5, 1));
    add(scene.add.rectangle(-4, 0, 7, 3, PALETTE.black).setOrigin(0.5, 1));
    add(scene.add.rectangle(5, 0, 7, 3, PALETTE.black).setOrigin(0.5, 1));

    // the jacket: long, square-shouldered, buttoned
    add(scene.add.rectangle(0, -14, 20, 22, COAT).setOrigin(0.5, 1));
    add(scene.add.rectangle(0, -32, 22, 5, COAT_LIT).setOrigin(0.5, 1)); // shoulders
    // the lapels, a V of slightly lighter cloth
    add(scene.add.rectangle(-3, -28, 3, 10, COAT_LIT).setOrigin(0.5, 1).setAngle(10));
    add(scene.add.rectangle(3, -28, 3, 10, COAT_LIT).setOrigin(0.5, 1).setAngle(-10));
    // hands, pocketed — you never see them until there is money in them
    add(scene.add.rectangle(-11, -18, 4, 7, COAT_LIT).setOrigin(0.5, 1));
    add(scene.add.rectangle(11, -18, 4, 7, COAT_LIT).setOrigin(0.5, 1));

    // neck and face, what little of it there is under the brim
    add(scene.add.rectangle(0, -33, 6, 4, dim(SKIN, 0.7)).setOrigin(0.5, 1));
    add(scene.add.rectangle(0, -37, 12, 11, SKIN).setOrigin(0.5, 1));
    // the brim throws the top half of his face into shadow, permanently
    add(scene.add.rectangle(0, -42, 13, 5, dim(SKIN, 0.45)).setOrigin(0.5, 1));
    add(scene.add.rectangle(-3, -41, 2, 2, PALETTE.bone).setOrigin(0.5, 1));
    add(scene.add.rectangle(3, -41, 2, 2, PALETTE.bone).setOrigin(0.5, 1));

    // the hat: a wide flat brim and a low crown
    add(scene.add.rectangle(0, -46, 24, 3, HAT).setOrigin(0.5, 1));
    add(scene.add.rectangle(0, -49, 14, 8, HAT).setOrigin(0.5, 1));
    add(scene.add.rectangle(0, -47, 14, 2, dim(HAT, 1.8)).setOrigin(0.5, 1)); // hatband

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
