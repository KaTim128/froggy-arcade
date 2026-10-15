/**
 * Start screen.  PRD §7.2 / brief §5.
 *
 * Warm, cozy, buzzing.  This screen exists to be remembered later, when the
 * same building is dark.
 */

import Phaser from 'phaser';
import { resumePoint } from '../core/resume';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { button, centerText, fadeIn, fadeToScene, FADE_MS } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import { paintExterior, startMoth, startSignFlicker } from '../art/exterior';
import { froggyLayer } from '../render/froggyLayer';

export class StartScreen extends Phaser.Scene {
  private who!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('StartScreen');
  }

  create(): void {
    froggyLayer.clear();
    fadeIn(this);
    audio.setScene({ music: 'theme_arcade', ambience: ['street_dusk', 'neon_buzz'] });

    const refs = paintExterior(this, { night: false });
    startSignFlicker(this, refs);
    startMoth(this, refs);

    // Title plate
    this.add.rectangle(GAME_W / 2, 26, 190, 30, PALETTE.black).setAlpha(0.55);
    centerText(this, GAME_W / 2, 20, 'FROGGY ARCADE', PALETTE.gold, 16).setLetterSpacing?.(1);
    centerText(this, GAME_W / 2, 34, 'Tons of froggy fun awaits! ', PALETTE.cream, 8).setAlpha(0.75);

    button(this, GAME_W / 2, 112, 'START', () => this.onStart(), { width: 74 });
    button(this, GAME_W / 2, 130, 'PROFILES', () => this.openProfiles(), { width: 74 });
    button(this, GAME_W / 2, 148, 'SETTINGS', () => this.scene.launch('SettingsModal', { from: 'StartScreen' }), {
      width: 74,
    });

    this.who = centerText(this, GAME_W / 2, 166, '', PALETTE.ash, 8).setAlpha(0.85);
    this.refreshWho();
    this.events.on('profiles-closed', () => this.refreshWho());

    // Nothing to play until there is somewhere to save it.
    if (!store.activeSlotId()) this.time.delayedCall(FADE_MS, () => this.openProfiles());
  }

  private openProfiles(): void {
    this.scene.launch('ProfileModal', { from: 'StartScreen' });
  }

  private refreshWho(): void {
    const name = store.activeSlotName();
    if (!name) {
      this.who.setText('no profile - choose one').setTint(PALETTE.gold);
      return;
    }
    const s = store.get();
    const resuming = s.route !== 'normal' || s.tokens > 0 || s.seenIntro;
    this.who.setText(`${resuming ? 'continue as' : 'playing as'} ${name}`).setTint(PALETTE.ash);
  }

  private onStart(): void {
    if (!store.activeSlotId()) {
      this.openProfiles();
      return;
    }
    // Resume where the run left off (PRD EC-3): see core/resume.
    const at = resumePoint();
    fadeToScene(this, at.key, at.data);
  }
}
