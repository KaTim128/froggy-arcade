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

import { Boot } from '../scenes2d/Boot';
import { StartScreen } from '../scenes2d/StartScreen';
import { SettingsModal } from '../scenes2d/SettingsModal';
import { ArcadeHub } from '../scenes2d/ArcadeHub';
import { IntroCutscene } from '../scenes2d/IntroCutscene';
import { PrizeCounter } from '../scenes2d/PrizeCounter';
import { MinigameScene } from '../scenes2d/MinigameScene';

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
    scene: [Boot, StartScreen, SettingsModal, IntroCutscene, ArcadeHub, PrizeCounter, MinigameScene],
  });

  froggyLayer.mount(root);
  attachScaler(game);
  initDebug(game);

  // PRD ST-2: never lose a run to a closed tab.
  window.addEventListener('beforeunload', () => store.flush());
  // PRD EC-12: pause and duck when the tab loses focus.
  document.addEventListener('visibilitychange', () => {
    if (!game) return;
    if (document.hidden) game.loop.sleep();
    else game.loop.wake();
  });
}
