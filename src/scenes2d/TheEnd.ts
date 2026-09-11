/**
 * The end of the job.
 *
 * Every prize out of the arcade and into the man's hands.  This is the only
 * ending in the game that is neither an escape nor a death: the player set out
 * to make money and made it, and the game says so and stops.
 *
 * It is paced like the basement is — one line, a long hold, then the next.  A
 * card that arrives and leaves in two seconds reads as a game over screen; the
 * hold is what makes it read as an ending.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio, SILENCE } from '../core/audio';
import { store } from '../core/state';
import { centerText } from '../core/ui';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W, GAME_H } from '../render/pixelScaler';

const STORY = [
  'You finally managed to escape the gutter and',
  'leave your life of homelessness behind.',
  'Maybe this experience will inspire you to',
  'pursue a future as a gamer, or perhaps even',
  'a gambler... who knows...',
];

/** How long the story sits on screen before THE END replaces it. */
const STORY_MS = 9500;
/** And how long THE END sits there before the run is wiped. */
const END_MS = 9000;

export class TheEnd extends Phaser.Scene {
  constructor() {
    super('TheEnd');
  }

  create(): void {
    froggyLayer.clear();
    audio.setScene(SILENCE);
    this.cameras.main.fadeIn(1200, 0, 0, 0);

    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black).setOrigin(0, 0);

    const lines = STORY.map((line, i) =>
      centerText(this, GAME_W / 2, 54 + i * 13, line, PALETTE.cream).setAlpha(0),
    );
    // The lines fade up one after another, at reading speed.
    lines.forEach((l, i) => {
      this.tweens.add({ targets: l, alpha: 1, delay: 600 + i * 900, duration: 900 });
    });

    const purse = centerText(this, GAME_W / 2, 130, `$${store.get().cash}`, PALETTE.mossLight).setAlpha(0);
    this.tweens.add({ targets: purse, alpha: 0.9, delay: 600 + STORY.length * 900, duration: 900 });

    this.time.delayedCall(STORY_MS, () => this.theEnd([...lines, purse]));
  }

  private theEnd(previous: Phaser.GameObjects.BitmapText[]): void {
    this.tweens.add({
      targets: previous,
      alpha: 0,
      duration: 900,
      onComplete: () => {
        const end = centerText(this, GAME_W / 2, GAME_H / 2, 'The End', PALETTE.gold, 16).setAlpha(0);
        this.tweens.add({ targets: end, alpha: 1, duration: 1400 });
      },
    });

    // The run is over.  Wipe it and go back to a lit arcade and a new name,
    // the same way every other ending does.
    this.time.delayedCall(END_MS, () => {
      store.resetRun();
      this.cameras.main.fadeOut(1500, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
        this.scene.start('Boot'),
      );
    });
  }
}
