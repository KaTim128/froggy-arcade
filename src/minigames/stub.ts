/**
 * Placeholder minigame.  PRD §11.5 — build the economy first, the games after.
 *
 * Deliberately, visibly a placeholder: it must never be mistaken for a finished
 * game.  It exists so the launch -> cost -> play -> reward -> return loop can be
 * tested before Phase 3.
 */

import type Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { centerText } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { cabinetById } from '../game/content';
import type { GameId } from '../core/state';
import type { MinigameApi, MinigameModule } from './types';

export function makeStub(id: GameId): MinigameModule {
  const def = cabinetById(id);
  return {
    id,
    title: def.title,
    rules: 'placeholder',
    create(scene: Phaser.Scene, api: MinigameApi) {
      scene.add
        .rectangle(GAME_W / 2, GAME_H / 2, 220, 90, PALETTE.slate)
        .setStrokeStyle(1, PALETTE.ember);
      centerText(scene, GAME_W / 2, GAME_H / 2 - 26, 'PLACEHOLDER CABINET', PALETTE.ember);
      centerText(scene, GAME_W / 2, GAME_H / 2 - 12, def.title, PALETTE.cream);
      centerText(scene, GAME_W / 2, GAME_H / 2 + 6, '[SPACE] win     [X] lose', PALETTE.fog);
      centerText(scene, GAME_W / 2, GAME_H / 2 + 20, '[ESC] quit  (forfeits the cost)', PALETTE.ash);

      scene.input.keyboard?.once('keydown-SPACE', () => api.win());
      scene.input.keyboard?.once('keydown-X', () => api.lose());
    },
  };
}
