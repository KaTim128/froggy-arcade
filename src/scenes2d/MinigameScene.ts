/**
 * Minigame shell.  PRD §9.0.
 *
 * One scene hosts every game.  It owns the frame, the HUD, the quit key, the
 * result card and the ledger credit, so no individual game can get the economy
 * wrong.  MG-6: launch -> complete -> return and launch -> quit -> return are
 * contract-tested here, once, for all of them.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { ledger } from '../core/ledger';
import { store, type GameId } from '../core/state';
import { button, centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { TokenHud } from '../ui/hud';
import { cabinetById } from '../game/content';
import { getMinigame } from '../minigames/registry';
import type { MinigameApi, MinigameModule } from '../minigames/types';
import { froggyLayer } from '../render/froggyLayer';

const AREA = { x: 0, y: 18, w: GAME_W, h: GAME_H - 18 };
const RESULT_MS = 2000;

export class MinigameScene extends Phaser.Scene {
  private gameId!: GameId;
  private mod: MinigameModule | null = null;
  private settled = false;
  private from = 'ArcadeHub';
  private hud!: TokenHud;

  constructor() {
    super('Minigame');
  }

  init(data: { id: GameId; from?: string }): void {
    this.gameId = data.id;
    // Which room's floor to put the player back on.  Sending everyone to the
    // hub meant playing a cabinet in the back room spat you out two rooms away.
    this.from = data.from ?? 'ArcadeHub';
    this.settled = false;
    this.mod = null;
  }

  create(): void {
    froggyLayer.clear();
    fadeIn(this);
    const def = cabinetById(this.gameId);

    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_W, 16, PALETTE.ink).setOrigin(0, 0);
    text(this, 4, 4, def.title, PALETTE.gold);

    // A real button, not just the ESC hint — quitting should not require
    // knowing a key.  It forfeits exactly like ESC does: no refund (MG-4).
    button(this, GAME_W - 26, 8, 'QUIT', () => this.settle(false, true), {
      width: 40,
      height: 12,
      fill: PALETTE.plum,
    });

    this.hud = new TokenHud(this);
    this.hud.setVisible(false); // the title bar already carries the balance line
    text(this, GAME_W - 128, 4, `WIN: +${def.reward}`, PALETTE.tealLight);

    const api: MinigameApi = {
      win: () => this.settle(true),
      lose: () => this.settle(false),
      area: AREA,
    };

    this.mod = getMinigame(this.gameId);
    this.mod.create(this, api);

    // MG-4: Esc forfeits the entry cost.  No confirmation, no refund.
    this.input.keyboard?.on('keydown-ESC', () => this.settle(false, true));

    if (import.meta.env?.DEV) {
      // PRD §6.9: force win / force loss in the active minigame.
      (window as unknown as Record<string, unknown>).__minigame = {
        id: this.gameId,
        win: () => this.settle(true),
        lose: () => this.settle(false),
      };
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__minigame;
      });
    }
  }

  update(time: number, delta: number): void {
    if (this.settled) return;
    this.mod?.update?.(time, delta);
  }

  private settle(won: boolean, quit = false): void {
    if (this.settled) return;
    this.settled = true;

    this.mod?.destroy?.();
    const def = cabinetById(this.gameId);

    // MG-3: the reward is credited here and nowhere else.
    if (won) ledger.credit(def.reward, 'game.reward');
    store.flush();

    const panel = this.add.rectangle(GAME_W / 2, GAME_H / 2, 160, 44, PALETTE.ink).setDepth(990);
    panel.setStrokeStyle(1, won ? PALETTE.gold : PALETTE.steel);
    centerText(
      this,
      GAME_W / 2,
      GAME_H / 2 - 7,
      won ? `YOU WIN  +${def.reward}` : quit ? 'FORFEIT' : 'YOU LOSE',
      won ? PALETTE.gold : PALETTE.fog,
    ).setDepth(991);
    centerText(
      this,
      GAME_W / 2,
      GAME_H / 2 + 7,
      won ? `${ledger.balance()} tokens` : `${ledger.balance()} tokens left`,
      PALETTE.ash,
    ).setDepth(991);

    audio.sfx(won ? 'chime' : 'buzzer');

    // Back to the room you came from, standing at the cabinet you played.
    this.time.delayedCall(RESULT_MS, () => fadeToScene(this, this.from, { atCabinet: this.gameId }));
  }
}

/** Shared helper: a draw a "draw = loss" style sub-caption. */
export function subCaption(scene: Phaser.Scene, str: string): Phaser.GameObjects.BitmapText {
  return centerText(scene, GAME_W / 2, 24, str, PALETTE.ash).setOrigin(0.5, 0);
}
