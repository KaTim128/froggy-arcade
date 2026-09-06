/**
 * Froggy's charity.  PRD §7.7.
 *
 * Fires once, on the first zero balance.  He is warm, generous and completely
 * sincere.  Nothing here foreshadows anything — that is the point.
 */

import Phaser from 'phaser';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { grantCharity } from '../core/broke';
import { fadeIn, fadeToScene } from '../core/ui';
import { paintChangeMachine, paintHubRoom } from '../art/hubRoom';
import { TokenHud } from '../ui/hud';
import { DialogueBox } from '../froggy/dialogue';
import { charityScript } from '../froggy/script';
import { froggyLayer } from '../render/froggyLayer';

export class FroggyCharity extends Phaser.Scene {
  constructor() {
    super('FroggyCharity');
  }

  create(): void {
    froggyLayer.clear();
    fadeIn(this);
    audio.setScene({ music: 'hub_lofi', ambience: ['cabinet_bleeps', 'crowd_hum'] });

    paintHubRoom(this, { night: false });
    paintChangeMachine(this, false);
    new TokenHud(this);

    const dialogue = new DialogueBox(this);
    dialogue.play(charityScript, () => {
      grantCharity(); // latch first, then credit — it cannot double-fire
      audio.sfx('chime');
      store.flush();
      this.time.delayedCall(900, () => fadeToScene(this, 'ArcadeHub'));
    });
  }
}
