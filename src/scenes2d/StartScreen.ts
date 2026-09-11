/**
 * Start screen.  PRD §7.2 / brief §5.
 *
 * Warm, cozy, buzzing.  This screen exists to be remembered later, when the
 * same building is dark.
 */

import Phaser from 'phaser';
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
    centerText(this, GAME_W / 2, 34, 'you found ten dollars', PALETTE.cream, 8).setAlpha(0.75);

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
    const s = store.get();
    // Resume where the run left off (PRD EC-3).
    if (s.route === 'ejected') {
      fadeToScene(this, 'ExteriorNight');
      return;
    }
    if (s.route === 'basement') {
      fadeToScene(this, 'BasementSequence');
      return;
    }
    if (s.route === 'hide') {
      // A run locked in the rooms comes back to the rooms.  This case was
      // missing, so a player who closed the tab mid hide-and-seek — broke, in
      // the dark, with the door locked behind them — was handed back a warm
      // arcade and no explanation.  Every other route was covered; this one
      // fell through to the hub.
      fadeToScene(this, 'HideRoom3D');
      return;
    }
    if (s.route === 'chase') {
      fadeToScene(this, 'Chase3D');
      return;
    }
    if (s.route === 'ended') {
      fadeToScene(this, 'EndCard');
      return;
    }
    fadeToScene(this, s.seenIntro ? 'ArcadeHub' : 'IntroCutscene');
  }
}
