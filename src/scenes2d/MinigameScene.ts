/**
 * Minigame shell.  PRD §9.0.
 *
 * One scene hosts every game.  It owns the frame, the HUD, the quit key, the
 * result card and the ledger credit, so no individual game can get the economy
 * wrong.  MG-6: launch -> complete -> return and launch -> quit -> return are
 * contract-tested here, once, for all of them.
 *
 * A game may let the player raise the stake mid-play, and a table game may pay
 * a hand and deal another (blackjack does both).  That still happens out here,
 * through `api.raise` and `api.payout`, so every move goes through the ledger
 * and the result card knows what actually changed hands.
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
  /** Tokens on this play: the entry cost the room debited, plus any raise. */
  private stake = 0;
  /** Tokens paid out mid-game, hand by hand.  Only a table uses this. */
  private paid = 0;

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
    this.stake = 0;
    this.paid = 0;
  }

  create(): void {
    froggyLayer.clear();
    fadeIn(this);
    const def = cabinetById(this.gameId);
    this.mod = getMinigame(this.gameId);
    // The room debited the entry cost before it launched us (MG-2), so that is
    // what is already riding on this play.
    this.stake = def.cost;

    // Every cabinet has its own tune.  The room's bed crossfades into it here
    // and back out when the room is rebuilt on the way back (AU-1).
    audio.setScene({ music: this.mod.music ?? 'room_hub' });

    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_W, 16, PALETTE.ink).setOrigin(0, 0);
    text(this, 4, 4, def.title, PALETTE.gold);

    // A real button, not just the ESC hint — quitting should not require
    // knowing a key.  It forfeits exactly like ESC does: no refund (MG-4).
    button(this, GAME_W - 26, 8, 'QUIT', () => this.forfeit(), {
      width: 40,
      height: 12,
      fill: PALETTE.plum,
    });

    this.hud = new TokenHud(this);
    this.hud.setVisible(false); // the title bar already carries the balance line
    text(this, GAME_W - 128, 4, this.mod.payoutNote ?? `WIN: +${def.reward}`, PALETTE.tealLight);

    const api: MinigameApi = {
      win: (payout?: number) => this.settle(true, false, payout),
      lose: () => this.settle(false),
      staked: () => this.stake,
      raise: (n: number) => this.raise(n),
      payout: (n: number) => this.payout(n),
      cashOut: () => this.cashOut(),
      balance: () => ledger.balance(),
      area: AREA,
    };

    this.mod.create(this, api);

    // MG-4: Esc forfeits the entry cost.  No confirmation, no refund.
    this.input.keyboard?.on('keydown-ESC', () => this.forfeit());

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

  /**
   * Walking out.  Mid-hand at a table this still forfeits whatever is on the
   * felt, but the card has to report the session rather than the hand — a
   * player who won forty and quits on a one-token hand did not "FORFEIT -1".
   */
  private forfeit(): void {
    if (this.paid > 0) this.cashOut();
    else this.settle(false, true);
  }

  /** MG-3 mid-game: a table settles each hand as it is won. */
  private payout(n: number): void {
    if (this.settled || !Number.isFinite(n) || n <= 0) return;
    const amount = Math.floor(n);
    ledger.credit(amount, 'game.reward');
    this.paid += amount;
    store.flush();
  }

  /** MG-2 again, mid-game: more tokens on the table, debited the same way. */
  private raise(n: number): boolean {
    if (this.settled || !Number.isFinite(n) || n <= 0) return false;
    if (!ledger.debit(Math.floor(n), 'game.cost')) return false;
    this.stake += Math.floor(n);
    store.flush();
    return true;
  }

  /**
   * End a session that was paid hand by hand.  Nothing changes hands here —
   * the ledger is already square — so the card reports the net instead of a
   * reward.  How you actually did is the only number that means anything after
   * an hour at a table.
   */
  private cashOut(): void {
    if (this.settled) return;
    this.settled = true;
    this.mod?.destroy?.();
    store.flush();

    const net = this.paid - this.stake;
    const up = net > 0;
    const panel = this.add.rectangle(GAME_W / 2, GAME_H / 2, 250, 60, PALETTE.ink).setDepth(990);
    panel.setStrokeStyle(1, up ? PALETTE.gold : PALETTE.steel);
    centerText(
      this,
      GAME_W / 2,
      GAME_H / 2 - 10,
      net === 0 ? 'YOU BREAK EVEN' : up ? `YOU LEAVE UP ${net}` : `YOU LEAVE DOWN ${-net}`,
      up ? PALETTE.gold : PALETTE.fog,
      16,
    ).setDepth(991);
    centerText(this, GAME_W / 2, GAME_H / 2 + 12, `${ledger.balance()} tokens`, PALETTE.ash).setDepth(991);

    audio.sfx(up ? 'chime' : 'buzzer');
    this.time.delayedCall(RESULT_MS, () => fadeToScene(this, this.from, { atCabinet: this.gameId }));
  }

  private settle(won: boolean, quit = false, payout?: number): void {
    if (this.settled) return;
    this.settled = true;

    this.mod?.destroy?.();
    const def = cabinetById(this.gameId);

    // MG-3: the reward is credited here and nowhere else.  A betting game names
    // its own payout; everything else takes the cabinet's flat reward.
    const paid = won ? Math.max(0, Math.floor(payout ?? def.reward)) : 0;
    if (won) ledger.credit(paid, 'game.reward');
    store.flush();

    const panel = this.add.rectangle(GAME_W / 2, GAME_H / 2, 250, 60, PALETTE.ink).setDepth(990);
    panel.setStrokeStyle(1, won ? PALETTE.gold : PALETTE.steel);
    centerText(
      this,
      GAME_W / 2,
      GAME_H / 2 - 10,
      won ? `YOU WIN  +${paid}` : quit ? `FORFEIT  -${this.stake}` : `YOU LOSE  -${this.stake}`,
      won ? PALETTE.gold : PALETTE.fog,
      16,
    ).setDepth(991);
    centerText(
      this,
      GAME_W / 2,
      GAME_H / 2 + 12,
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
