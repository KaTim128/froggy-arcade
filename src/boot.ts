/**
 * The game itself, started once this tab holds the one-copy-per-device lock
 * (see main.ts and core/singleInstance): nothing in here -- the save, the
 * clock, the scenes -- is loaded until then.
 */

import { bootGame } from './core/sceneManager';
import { store } from './core/state';
import { installKeyWords } from './core/keyWords';
import { installKeymap } from './core/keymap';

// (on a phone, every [E] on screen says INTERACT or PLAY instead)
installKeyWords();
// (keys the player has rebound, turned back into the ones the game reads)
installKeymap();
bootGame();

// Time played, for the profile cards: counted while the game is open and in
// front of the player, and written out when the page goes away.
window.setInterval(() => {
  if (document.visibilityState === 'visible') store.addPlayTime(1);
}, 1000);
