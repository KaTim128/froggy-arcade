/**
 * Froggy Arcade.
 *
 * Specs: docs/QFD-Froggy-Arcade.md, docs/PRD-Froggy-Arcade.md
 *
 * Two rules are non-negotiable and are enforced in code, not by convention:
 *   1. Froggy is the only non-pixel element  (src/render/froggyLayer.ts)
 *   2. The post-break-in arcade is totally silent  (src/core/audio.ts, AU-2)
 */

import { bootGame } from './core/sceneManager';
import { store } from './core/state';

bootGame();

// Time played, for the profile cards: counted while the game is open and in
// front of the player, and written out when the page goes away.
window.setInterval(() => {
  if (document.visibilityState === 'visible') store.addPlayTime(1);
}, 1000);
window.addEventListener('pagehide', () => store.flush());
