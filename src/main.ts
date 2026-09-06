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

bootGame();
