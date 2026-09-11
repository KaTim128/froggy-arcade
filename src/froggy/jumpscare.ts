/**
 * Being caught.
 *
 * One routine, used by the hide rooms and by the alley, because the thing that
 * catches you has to be the same thing in both places — it was `monster` in one
 * and `predator` in the other, which meant the game had two endings that looked
 * like two different creatures.
 *
 * It is deliberately not a still frame.  He arrives already too close and keeps
 * coming: the head grows past the edges of the screen over about a second while
 * the jaw opens, the frame jitters, and the whole thing sits under the stinger.
 * By the end there is nothing on screen but the inside of his mouth.
 */

import Phaser from 'phaser';
import { audio } from '../core/audio';
import { froggyLayer } from '../render/froggyLayer';
import { drawFroggy } from './froggy';
import { GAME_W, GAME_H } from '../render/pixelScaler';

/** How long he takes to fill the frame. */
export const SCARE_MS = 1500;
const FRAME_MS = 40;

/**
 * Paint the scare and run it to the end.  Returns nothing: the caller decides
 * what happens afterwards and should give it at least SCARE_MS to land.
 */
export function playJumpscare(scene: Phaser.Scene): void {
  audio.scare();
  scene.cameras.main.shake(SCARE_MS * 0.8, 0.045);

  let t = 0;
  const paint = () => {
    const k = Math.min(1, t / SCARE_MS);
    // Ease in: he covers most of the distance in the first third, which is what
    // makes it read as a lunge rather than a zoom.
    const rush = 1 - Math.pow(1 - k, 3);

    froggyLayer.paint((ctx) => {
      ctx.fillStyle = '#140306';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      drawFroggy(ctx, {
        x: GAME_W / 2,
        y: 52 + rush * 26,
        height: 240 + rush * 320,
        variant: 'monster',
        anchor: 'face',
        morph: 1,
        maw: 0.45 + rush * 0.55,
        blood: 0.8 + rush * 0.2,
        pupil: 0.1,
        t: t / 1000,
        shake: 0.5 + rush * 0.5,
      });

      // A wash of red over the last of it, so the frame he leaves you on is not
      // a picture of a frog but the colour of the inside of one.
      if (k > 0.65) {
        ctx.fillStyle = `rgba(120,6,10,${(k - 0.65) * 1.6})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }
    });
  };

  paint();
  scene.time.addEvent({
    delay: FRAME_MS,
    repeat: Math.ceil(SCARE_MS / FRAME_MS),
    callback: () => {
      t += FRAME_MS;
      paint();
    },
  });
}
