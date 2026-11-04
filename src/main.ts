/**
 * Froggy Arcade.
 *
 * Specs: docs/QFD-Froggy-Arcade.md, docs/PRD-Froggy-Arcade.md
 *
 * Two rules are non-negotiable and are enforced in code, not by convention:
 *   1. Froggy is the only non-pixel element  (src/render/froggyLayer.ts)
 *   2. The post-break-in arcade is totally silent  (src/core/audio.ts, AU-2)
 */

import './core/gameConfig';
import { claimInstance } from './core/singleInstance';

// ONE COPY PER DEVICE: the game (and with it the save) is only loaded once
// this tab is the one playing -- see core/singleInstance.  A second tab or
// window waits behind an ALREADY OPEN card instead.
void claimInstance().then(() => import('./boot'));

// PLAYS WITH NO INTERNET: the built game registers its service worker (see
// vite.config.ts), which keeps a copy of every file on the device after the
// first visit.  Not in development, where it would serve stale code.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
