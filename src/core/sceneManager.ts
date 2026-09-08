/**
 * Scene manager / renderer lifecycle.  PRD §6.5 / QFD A1.
 *
 * SM-1: one Phaser game and one Three.js renderer, both mounting into
 * #game-root, exactly one active at a time.  The Three side is torn down
 * completely on exit (contexts released, RAF cancelled) before Phaser resumes.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { GAME_W, GAME_H, attachScaler } from '../render/pixelScaler';
import { froggyLayer } from '../render/froggyLayer';
import { initDebug } from './debug';
import { store } from './state';
import { audio } from './audio';

import { Boot } from '../scenes2d/Boot';
import { StartScreen } from '../scenes2d/StartScreen';
import { SettingsModal } from '../scenes2d/SettingsModal';
import { ProfileModal } from '../scenes2d/ProfileModal';
import { ArcadeHub } from '../scenes2d/ArcadeHub';
import { IntroCutscene } from '../scenes2d/IntroCutscene';
import { PrizeCounter } from '../scenes2d/PrizeCounter';
import { MinigameScene } from '../scenes2d/MinigameScene';
import { FroggyCharity } from '../scenes2d/FroggyCharity';
import { SecondBust } from '../scenes2d/SecondBust';
import { EjectionCutscene } from '../scenes2d/EjectionCutscene';
import { ExteriorNight } from '../scenes2d/ExteriorNight';
import { BackAlley } from '../scenes2d/BackAlley';
import { ArcadeDark } from '../scenes2d/ArcadeDark';
import { BasementSequence } from '../scenes2d/BasementSequence';
import { HideRoom3D } from '../scenes2d/HideRoom3D';
import { Chase3D } from '../scenes2d/Chase3D';
import { OutroCutscene3D } from '../scenes2d/OutroCutscene3D';
import { EndCard } from '../scenes2d/EndCard';

let game: Phaser.Game | null = null;

export function getGame(): Phaser.Game | null {
  return game;
}

export function bootGame(): void {
  const root = document.getElementById('game-root');
  if (!root) throw new Error('#game-root missing');

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-root',
    width: GAME_W,
    height: GAME_H,
    backgroundColor: PALETTE.black,
    // PRD AR-2: NEAREST everywhere in the world layer.  Froggy is elsewhere.
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
      zoom: 1,
    },
    scene: [
      Boot,
      StartScreen,
      SettingsModal,
      ProfileModal,
      IntroCutscene,
      ArcadeHub,
      PrizeCounter,
      MinigameScene,
      FroggyCharity,
      SecondBust,
      EjectionCutscene,
      ExteriorNight,
      BackAlley,
      ArcadeDark,
      BasementSequence,
      HideRoom3D,
      Chase3D,
      OutroCutscene3D,
      EndCard,
    ],
  });

  froggyLayer.mount(root);
  attachScaler(game);
  initDebug(game);

  // Boot's CLICK TO BEGIN gate is the intended unlock (PRD EC-9), but any first
  // gesture anywhere will do it.  Without this, entering the game at a scene
  // other than Boot leaves the audio context suspended for the whole session.
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

  // PRD ST-2: never lose a run to a closed tab.
  window.addEventListener('beforeunload', () => store.flush());
  // PRD EC-12: pause and duck when the tab loses focus.
  document.addEventListener('visibilitychange', () => {
    if (!game) return;
    if (document.hidden) game.loop.sleep();
    else game.loop.wake();
  });
}
