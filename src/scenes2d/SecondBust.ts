/**
 * The second bust.  PRD §7.8 — the hinge of the whole game.
 *
 * Timed to the tenth of a second, because the timing IS the scene:
 *
 *   0.0s  the music CUTS.  Not a fade.  Bleeps and hum stop the same frame.
 *   0.2s  the room dims 30% over 400ms
 *   0.6s  Froggy enters, using the V0 art EXACTLY — no new sprite, no
 *         expression change (FMEA #1: if he looks different here, the whole
 *         first act reads as a setup in hindsight rather than a betrayal)
 *   1.0s  "Oops. Looks like you're all out of froggy-tokens."
 *   ~3.5s THREE SECONDS OF NOTHING.  No animation, no sfx, no typewriter.
 *   6.5s  "You can go now."
 *
 * SB-1: the three-second hold is a hard requirement.  Do not let a polish pass
 * shorten it.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio, SILENCE } from '../core/audio';
import { paintChangeMachine, paintHubRoom } from '../art/hubRoom';
import { TokenHud } from '../ui/hud';
import { DialogueBox } from '../froggy/dialogue';
import { secondBustScript } from '../froggy/script';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { fadeToScene } from '../core/ui';

export class SecondBust extends Phaser.Scene {
  constructor() {
    super('SecondBust');
  }

  create(): void {
    froggyLayer.clear();
    this.cameras.main.fadeIn(120, 0, 0, 0);

    // 0.0s — hard cut.  Everything stops at once.
    audio.hardCut();
    audio.setScene(SILENCE);

    paintHubRoom(this, { night: false });
    paintChangeMachine(this, false);
    new TokenHud(this);

    // 0.2s — the lights come down 30%.
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0).setOrigin(0, 0).setDepth(700);
    this.time.delayedCall(200, () => {
      this.tweens.add({ targets: dim, fillAlpha: 0.3, duration: 400 });
    });

    // 0.6s — he arrives.  Same art as always.
    this.time.delayedCall(600, () => {
      const dialogue = new DialogueBox(this);
      this.time.delayedCall(400, () => {
        dialogue.play(secondBustScript, () => {
          fadeToScene(this, 'EjectionCutscene');
        });
      });
    });
  }
}
