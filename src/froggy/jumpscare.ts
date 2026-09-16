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
export const SCARE_MS = 1350;
const FRAME_MS = 40;

/**
 * Paint the scare and run it to the end.  Returns nothing: the caller decides
 * what happens afterwards and should give it at least SCARE_MS to land.
 */
export function playJumpscare(scene: Phaser.Scene): void {
  audio.scare();
  scene.cameras.main.shake(SCARE_MS * 0.9, 0.075);

  let t = 0;
  const paint = () => {
    const k = Math.min(1, t / SCARE_MS);
    // A LUNGE, NOT A ZOOM.  Most of the distance is gone inside the first
    // fifth, and the power of four is what does it: at a cube he arrives
    // quickly, at a fourth he is simply THERE and then keeps coming.
    const rush = 1 - Math.pow(1 - k, 4);
    // And he does not arrive smoothly.  Two snaps — one almost immediately and
    // one just past halfway — where the head jumps forward again out of turn,
    // because a creature closing on you at a constant rate is a vehicle.
    const snap =
      (k > 0.06 && k < 0.13 ? 1 - (k - 0.06) / 0.07 : 0) * 26 +
      (k > 0.54 && k < 0.62 ? 1 - (k - 0.54) / 0.08 : 0) * 38;

    froggyLayer.paint((ctx) => {
      ctx.fillStyle = '#0d0205';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      drawFroggy(ctx, {
        x: GAME_W / 2,
        // ---- HOW BIG, AND THIS IS THE WHOLE SHOT.
        //
        // The head is about 106 of the drawing's 114 units tall, so `height`
        // 190 puts a face very slightly wider than a 320x180 frame: every eye
        // and the whole mouth are in shot on the FIRST frame, and there is
        // nothing else in shot at all.  Starting at 310 -- which is what
        // "close" naively suggests -- put the player inside his cheek before a
        // millisecond had run, and a texture nobody can see is not a texture.
        // It ends at 620, which is well inside the mouth.
        y: 62 + rush * 26,
        height: 190 + rush * 430 + snap,
        variant: 'monster',
        anchor: 'face',
        morph: 1,
        // The jaw works rather than opening: it comes most of the way at once,
        // shuts a little, and then goes past where it was.
        maw: Math.min(1, 0.55 + rush * 0.6 - Math.max(0, Math.sin(k * Math.PI * 3.2)) * 0.18),
        blood: 0.85 + rush * 0.15,
        pupil: 0.08,
        t: t / 1000,
        shake: 0.75 + rush * 0.65,
      });

      // A wash of red over the last of it, so the frame he leaves you on is not
      // a picture of a frog but the colour of the inside of one.
      if (k > 0.7) {
        ctx.fillStyle = `rgba(120,6,10,${(k - 0.7) * 2.2})`;
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
