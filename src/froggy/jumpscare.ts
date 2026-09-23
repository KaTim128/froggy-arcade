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
 *
 * FOUR THINGS MAKE IT WORSE THAN A LUNGE, and none of them is more gore.
 *
 *   THE HOLD.  A fifth of a second where he is already there, filling the
 *   frame, and NOT MOVING.  A scare that starts moving is a scare the eye can
 *   track from its first frame; one that waits makes the player look at it
 *   first.  It is the only quiet moment in the sequence and it is what the
 *   rest of it lands against.
 *
 *   THE STROBE.  Two or three single frames of pure black, at no useful
 *   interval, while he is coming.  They read as the picture failing rather
 *   than as an effect, and every one of them puts him somewhere new when it
 *   comes back.
 *
 *   THE TEAR.  Through the snaps, four bands of the frame are redrawn shifted
 *   sideways, so the head comes apart horizontally for two frames and puts
 *   itself back.  It is the cheapest possible signal-breaking-up and it works
 *   because nothing else in this game ever does it.
 *
 *   AND THE NEGATIVE.  One frame, twice, where the whole thing inverts and his
 *   pupils go: a white face with black teeth, gone before it can be read.
 *   Everybody sees it and nobody can say what it was.
 *
 * WHAT IS COMING AT YOU is the same creature that walks the rooms: the 2D
 * monster drawing and the three-dimensional model are built to the same brief
 * -- one round mass, no neck, TWO eyes bloodshot to the rim with pinprick
 * pupils, and a mouth most of the width of the head.  The scattered extra eyes
 * that used to be on the drawing are gone from both, so the thing that catches
 * you cannot be mistaken for a different animal.
 */

import Phaser from 'phaser';
import { audio } from '../core/audio';
import { froggyLayer } from '../render/froggyLayer';
import { drawFroggy } from './froggy';
import { GAME_W, GAME_H } from '../render/pixelScaler';

/**
 * How long he takes to fill the frame, including the hold at the front.
 *
 * As short as it can be and still have a shape to it: a fifth of a second of
 * him standing there, and then a second of him arriving.  Everything after the
 * mouth fills the frame is time the player spends looking at a red screen, so
 * there is none of it.
 */
export const SCARE_MS = 1200;
const FRAME_MS = 40;
/**
 * The hold.  He is on screen and still for this long before anything moves.
 *
 * Short enough that it is not a pause -- nobody gets to think during it -- and
 * long enough that the eye lands on the face before the face does anything.
 */
const HOLD_MS = 200;
/** Single frames of black, as fractions of the lunge.  Deliberately uneven. */
const STROBE = [0.09, 0.27, 0.285, 0.55, 0.78];
/** And the two frames where the picture inverts. */
const NEGATIVE = [0.34, 0.66];

/**
 * Paint the scare and run it to the end.  Returns nothing: the caller decides
 * what happens afterwards and should give it at least SCARE_MS to land.
 */
export function playJumpscare(scene: Phaser.Scene): void {
  audio.scare();
  // Under the stinger: a low hit on the hold, so the still frame has weight
  // rather than being silence, and a second one on the lunge.
  audio.sfx('boom', 0.85);
  scene.time.delayedCall(HOLD_MS, () => audio.sfx('death_stinger', 1));
  scene.time.delayedCall(HOLD_MS + 240, () => audio.sfx('buzzer', 0.7));
  // The shake starts WITH THE LUNGE, not with the frame: the hold is only a
  // hold if the camera is holding too.
  scene.time.delayedCall(HOLD_MS, () => scene.cameras.main.shake(SCARE_MS * 0.8, 0.09));

  let t = 0;
  let strobed = -1;
  const paint = () => {
    // THE HOLD.  `k` does not start running until it is over, so everything
    // below -- the rush, the snaps, the strobe -- is measured from the moment
    // he actually moves.
    const held = t < HOLD_MS;
    const k = held ? 0 : Math.min(1, (t - HOLD_MS) / (SCARE_MS - HOLD_MS));
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

    // ---- THE STROBE.  One frame each, and only once each: the frame index is
    // remembered so a slow tick cannot hold the black on for two.
    const strobeNow = STROBE.findIndex((m) => k >= m && k < m + 0.012);
    const negative = NEGATIVE.some((m) => k >= m && k < m + 0.018);

    froggyLayer.paint((ctx) => {
      ctx.fillStyle = '#0d0205';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      if (strobeNow >= 0 && strobeNow !== strobed) {
        strobed = strobeNow;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        return;
      }
      const face = (pupil = 0.08) => drawFroggy(ctx, {
        x: GAME_W / 2,
        // ---- HOW BIG, AND THIS IS THE WHOLE SHOT.
        //
        // The face is about 114 units from the top of the eyes to the bottom
        // of an open jaw -- it grew when the eyes did and when the mouth went
        // most of the way across the head -- so `height` 160 at y 56 puts ALL
        // OF IT in the 320x180 frame on the FIRST frame, eyes and teeth, with
        // nothing else in shot at all.  Starting at 310 -- which is what
        // "close" naively suggests -- put the player inside his cheek before a
        // millisecond had run, and a texture nobody can see is not a texture.
        // It ends at 600, which is well inside the mouth.
        y: 56 + rush * 30,
        height: 160 + rush * 440 + snap,
        variant: 'monster',
        anchor: 'face',
        morph: 1,
        // The jaw works rather than opening: it comes most of the way at once,
        // shuts a little, and then goes past where it was.
        maw: Math.min(1, 0.55 + rush * 0.6 - Math.max(0, Math.sin(k * Math.PI * 3.2)) * 0.18),
        blood: 0.85 + rush * 0.15,
        pupil,
        t: t / 1000,
        // Dead still on the hold.  Everything about him that idles is off.
        shake: held ? 0 : 0.75 + rush * 0.65,
      });
      face();

      // ---- THE TEAR.  Through the two snaps, four bands of the picture are
      // drawn again shifted sideways, so the head comes apart and puts itself
      // back inside a couple of frames.
      if (snap > 0.5) {
        for (let i = 0; i < 4; i++) {
          const y = (i / 4) * GAME_H + ((t * 0.37 + i * 23) % 14);
          const h = 6 + (i % 2) * 5;
          const dx = (i % 2 ? 1 : -1) * (3 + (snap / 38) * 9);
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, y, GAME_W, h);
          ctx.clip();
          ctx.translate(dx, 0);
          face();
          ctx.restore();
        }
      }

      // ---- THE NEGATIVE.  One frame, inverted, with the pupils gone: the
      // eyes are redrawn blank over the top before the whole frame flips, so
      // what the inversion leaves is a white face with two black holes in it.
      if (negative) {
        face(0);
        ctx.save();
        ctx.globalCompositeOperation = 'difference';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        ctx.restore();
      }

      // A wash of red over the last of it, so the frame he leaves you on is not
      // a picture of a frog but the colour of the inside of one.
      if (k > 0.7) {
        ctx.fillStyle = `rgba(120,6,10,${(k - 0.7) * 2.2})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }
      // And the frame closing in from the edges as it goes, so the last thing
      // that happens is the picture getting smaller rather than louder.
      if (k > 0.55) {
        const v = (k - 0.55) / 0.45;
        const g = ctx.createRadialGradient(
          GAME_W / 2, GAME_H / 2, GAME_W * (0.42 - v * 0.34),
          GAME_W / 2, GAME_H / 2, GAME_W * (0.72 - v * 0.34),
        );
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(0,0,0,${0.55 + v * 0.45})`);
        ctx.fillStyle = g;
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
