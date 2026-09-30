/**
 * Minigame shell.  PRD §9.0.
 *
 * One scene hosts every game.  It owns the frame, the HUD, the quit key, the
 * result card and BOTH ends of the ledger, so no individual game can get the
 * economy wrong.
 *
 * MG-2 now reads: nothing is charged for walking up to a machine.  The shell
 * opens on the how-to-play card with the game unbuilt behind it, and the
 * cabinet's cost is debited at the moment the player presses PLAY — once, in
 * one place, guarded so a hammered button is one play.  LEAVE, Esc at the
 * card, or a balance that cannot cover the price all end the visit with the
 * player's tokens exactly where they were.  MG-6: launch -> complete -> return and launch -> quit -> return are
 * contract-tested here, once, for all of them.
 *
 * A game may let the player raise the stake mid-play, and a table game may pay
 * a hand and deal another (blackjack does both).  That still happens out here,
 * through `api.raise` and `api.payout`, so every move goes through the ledger
 * and the result card knows what actually changed hands.
 */

import Phaser from 'phaser';
import { RECORDS, best as bestRecord, submit as submitRecord } from '../core/records';
import { deviceControls, deviceObjective, type ControlRow } from '../ui/controlsList';
import { PALETTE } from '../render/palette';
import { FONT_ADVANCE } from '../render/pixelFont';
import { audio } from '../core/audio';
import { ledger } from '../core/ledger';
import { store, type GameId } from '../core/state';
import { button, centerText, confirmDialog, fadeIn, fadeToScene, forfeitLines, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { TokenHud } from '../ui/hud';
import { cabinetById } from '../game/content';
import { getMinigame } from '../minigames/registry';
import type { MinigameApi, MinigameModule } from '../minigames/types';
import { showTutorial, type TutorialCard } from '../ui/tutorialCard';
import { froggyLayer } from '../render/froggyLayer';
import { setCabinetTouch } from '../game/touchLayouts';

const AREA = { x: 0, y: 18, w: GAME_W, h: GAME_H - 18 };
const RESULT_MS = 2000;

export class MinigameScene extends Phaser.Scene {
  private gameId!: GameId;
  private mod: MinigameModule | null = null;
  private settled = false;
  /** What this play set as a new personal best, for the result panel. */
  private newBest: string | null = null;
  private from = 'ArcadeHub';
  private hud!: TokenHud;
  /** Tokens on this play: what PLAY debited, plus anything raised in-game. */
  private stake = 0;
  /** Tokens paid out mid-game, hand by hand.  Only a table uses this. */
  private paid = 0;
  /**
   * MG-8: the game is not built until the how-to-play card is dismissed, so
   * nothing under the card can be played and no key pressed at it is read by
   * the game.  `started` is what `update` waits on.
   */
  private started = false;
  /** Opened straight into the game, with no how-to-play card.  See `create`. */
  private straight = false;
  private card: TutorialCard | null = null;
  /** Where the result card goes afterwards, when it is not back to the room. */
  private exitTo: string | null = null;
  /** The quit question, while it is up.  The game is frozen under it. */
  private asking: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Minigame');
  }

  init(data: { id: GameId; from?: string; straight?: boolean }): void {
    this.gameId = data.id;
    // Walked up and pressed play in one motion: see `straight` below.
    this.straight = data.straight === true;
    // Which room's floor to put the player back on.  Sending everyone to the
    // hub meant playing a cabinet in the back room spat you out two rooms away.
    this.from = data.from ?? 'ArcadeHub';
    this.settled = false;
    this.newBest = null;
    this.mod = null;
    this.stake = 0;
    this.paid = 0;
    this.started = false;
    this.card = null;
    this.exitTo = null;
    this.asking = null;
  }

  create(): void {
    froggyLayer.clear();
    fadeIn(this);
    const def = cabinetById(this.gameId);
    this.mod = getMinigame(this.gameId);
    // Nothing is riding on this yet.  The stake arrives when PLAY is pressed
    // (or, at the table and the wheel, when the player actually bets).
    this.stake = 0;

    // Every cabinet has its own tune.  The room's bed crossfades into it here
    // and back out when the room is rebuilt on the way back (AU-1).
    audio.setScene({ music: this.mod.music ?? 'room_hub' });

    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black).setOrigin(0, 0);
    this.add.rectangle(0, 0, GAME_W, 16, PALETTE.ink).setOrigin(0, 0);
    text(this, 4, 4, def.title, PALETTE.gold);

    // A real button, not just a key.  It asks first, and says what walking
    // out costs; confirmed, it forfeits exactly as it always has (MG-4).
    button(this, GAME_W - 26, 8, 'QUIT', () => this.askQuit(), {
      width: 40,
      height: 12,
      fill: PALETTE.plum,
    });

    this.hud = new TokenHud(this);
    this.hud.setVisible(false); // the title bar already carries the balance line
    // Right-aligned to just short of the QUIT button rather than pinned to a
    // fixed left edge: the note is the cabinet's own wording and some of them
    // are twice as long as others, so a fixed start meant "WIN: 15 TOKENS"
    // reached under QUIT while "WIN: +2" sat in the middle of nowhere.
    const note = text(this, GAME_W - 50, 4, this.mod.payoutNote ?? `WIN: +${def.reward}`, PALETTE.tealLight)
      .setOrigin(1, 0);
    // The personal best, where this cabinet keeps one, centred in whatever
    // gap the title and the payout leave -- and shortened until it fits
    // there, so it never runs into either of them.
    const rec = RECORDS[this.gameId];
    const was = bestRecord(this.gameId);
    if (rec && was !== null) {
      const from = 4 + def.title.length * FONT_ADVANCE + 6;
      const to = GAME_W - 50 - note.width - 6;
      const fit = [rec.short(was), `BEST ${rec.format(was)}`, rec.format(was)].find(
        (s) => s.length * FONT_ADVANCE <= to - from,
      );
      if (fit) centerText(this, Math.round((from + to) / 2), 8, fit, PALETTE.gold).setAlpha(0.9);
    }

    const api: MinigameApi = {
      win: (payout?: number) => this.settle(true, false, payout),
      lose: () => this.settle(false),
      draw: () => this.settleDraw(),
      staked: () => this.stake,
      raise: (n: number) => this.raise(n),
      payout: (n: number) => this.payout(n),
      cashOut: () => this.cashOut(),
      balance: () => ledger.balance(),
      record: (value: number) => {
        const rec = RECORDS[this.gameId];
        if (rec && submitRecord(this.gameId, value)) this.newBest = `NEW BEST!  ${rec.format(bestRecord(this.gameId) ?? value)}`;
      },
      area: AREA,
    };

    // Esc is the pause menu here as everywhere (core/pause.ts), and its LEAVE
    // asks the same question QUIT does before anything is forfeited.

    // MG-8: the card comes first — what the cabinet wants, which keys it
    // reads, and what a go costs — with the game unbuilt behind it.  PLAY is
    // where the tokens move and where the module is constructed.
    const mod = this.mod;

    // ---- STRAIGHT IN, WITH NO CARD.
    //
    // Clicking the cabinet itself asks what it is, so it gets the card.
    // Everything else that starts a game from the floor -- the E key, or a
    // click anywhere else while stood at a machine -- is somebody who already
    // knows and wants to play, so it goes straight to the game.  The charge is
    // identical either way: the same debit, the same ledger reason, once.
    //
    // It is the same `onPlay` the card's own button runs, called directly, so
    // there is exactly one route into a built game and no second copy of the
    // charging rule to drift out of step with this one.
    const start = (): void => {
      this.card = null;
      if (this.settled) return;
      // MG-2: the one place in the game that charges for a play.
      if (!def.freeToEnter) {
        if (!ledger.debit(def.cost, 'game.cost')) {
          // Belt and braces: the card already refuses to offer PLAY when the
          // balance cannot cover it, so this only fires if the balance moved
          // under us.  Either way nothing is built and nothing is taken.
          audio.sfx('buzzer');
          this.leave();
          return;
        }
        this.stake = def.cost;
      }
      store.bumpGamePlayed(this.gameId);
      store.flush();
      mod.create(this, api);
      this.started = true;
      // On a phone, the cabinet's own keys become the cabinet's own buttons
      // for as long as it is being played.  The card did not need them: it
      // is two buttons you tap.
      setCabinetTouch(mod.touch);
    };

    if (this.straight) {
      // The affordability check the card would have made.  Without it a player
      // who cannot cover the cabinet gets dropped into a built game that then
      // refuses to charge them, which is the accidental loop this whole change
      // is meant to close.
      if (!def.freeToEnter && ledger.balance() < def.cost) {
        audio.sfx('buzzer');
        this.leave();
        return;
      }
      start();
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setCabinetTouch(null));
      this.devBridge();
      return;
    }

    this.card = showTutorial(this, {
      title: def.title,
      // The keys on a keyboard, the arrows and buttons on a phone.
      tutorial: {
        objective: deviceObjective(mod.tutorial.objective, mod.touch),
        controls: deviceControls(mod.tutorial.controls, mod.touch),
      },
      cost: def.cost,
      balance: ledger.balance(),
      chargesInside: def.freeToEnter === true,
      payNote: mod.payoutNote ?? `WIN: ${def.reward} TOKENS`,
      record: (() => {
        const rec = RECORDS[this.gameId];
        const was = bestRecord(this.gameId);
        return rec && was !== null ? rec.long(was) : undefined;
      })(),
      onPlay: start,
      onLeave: () => {
        this.card = null;
        this.leave();
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.card?.destroy();
      this.card = null;
      setCabinetTouch(null);
    });

    this.devBridge();
  }

  /** PRD §6.9: force win / force loss in the active minigame. */
  private devBridge(): void {
    if (!import.meta.env?.DEV) return;
    (window as unknown as Record<string, unknown>).__minigame = {
      id: this.gameId,
      win: () => this.settle(true),
      lose: () => this.settle(false),
      /** Whether this one opened straight into play or on the card. */
      straight: this.straight,
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      delete (window as unknown as Record<string, unknown>).__minigame;
    });
  }

  update(time: number, delta: number): void {
    if (this.settled || !this.started || this.asking) return;
    this.mod?.update?.(time, delta);
  }

  /**
   * Walking out.  Mid-hand at a table this still forfeits whatever is on the
   * felt, but the card has to report the session rather than the hand — a
   * player who won forty and quits on a one-token hand did not "FORFEIT -1".
   */
  /**
   * Walking away from the card.  Nothing was charged, so this is not a result:
   * no card, no ledger movement, straight back to the room and back to the
   * machine the player was standing at.
   */
  private leave(): void {
    if (this.settled) return;
    this.settled = true;
    this.card?.destroy();
    this.card = null;
    fadeToScene(this, this.exitTo ?? this.from, { atCabinet: this.gameId });
  }

  /**
   * What quitting right now would forfeit, or null when quitting costs
   * nothing to ask about: the card is still up (nothing has been paid) or the
   * play is already over.  A table that pays hand by hand says what is on the
   * felt this moment; every other cabinet forfeits its whole stake.
   */
  forfeitAmount(): number | null {
    if (this.settled || !this.started) return null;
    return Math.max(0, Math.floor(this.mod?.atRisk?.() ?? this.stake));
  }

  /** This cabinet's controls, as this device will actually work them. */
  controlRows(): ControlRow[] {
    return this.mod ? deviceControls(this.mod.tutorial.controls, this.mod.touch) : [];
  }

  /** Forfeit, and go somewhere other than back to the room afterwards. */
  quitTo(key: string): void {
    this.exitTo = key;
    this.forfeit();
  }

  /** Esc answers the quit question with CANCEL while it is up. */
  handleEscape(): boolean {
    // At the how-to-play card nothing has been paid and nothing is being
    // played, so Esc is its LEAVE button, as it always was.
    if (this.card && !this.started && !this.settled) {
      this.leave();
      return true;
    }
    if (!this.asking) return false;
    this.cancelQuit();
    return true;
  }

  /**
   * QUIT.  At the card there is nothing to lose and it just leaves.  In a
   * game, the game freezes -- its clock, its tweens, its keys, and Froggy's
   * overlay -- and the question goes up with the real number on it.  CANCEL
   * thaws everything exactly where it was; CONFIRM QUIT is the old forfeit.
   */
  private askQuit(): void {
    if (this.settled || this.asking) return;
    if (!this.started) {
      this.leave();
      return;
    }
    const risk = this.forfeitAmount() ?? 0;
    this.freeze(true);
    this.asking = confirmDialog(this, {
      lines: ['ARE YOU SURE YOU WANT TO QUIT?', ...forfeitLines(risk)],
      confirm: 'CONFIRM QUIT',
      onConfirm: () => {
        this.asking = null;
        this.freeze(false);
        this.forfeit();
      },
      onCancel: () => this.cancelQuit(),
      edge: 0xc31f2e,
    });
  }

  private cancelQuit(): void {
    this.asking?.destroy();
    this.asking = null;
    this.freeze(false);
  }

  private freeze(on: boolean): void {
    this.time.paused = on;
    if (on) this.tweens.pauseAll();
    else this.tweens.resumeAll();
    if (on) this.anims.pauseAll();
    else this.anims.resumeAll();
    const kb = this.input.keyboard;
    if (kb) {
      kb.enabled = !on;
      if (!on) kb.resetKeys();
    }
    froggyLayer.setVisible(!on);
  }

  private forfeit(): void {
    // Nothing was ever staked — a free fixture the player only looked at — so
    // there is nothing to forfeit.  Walking out of the wheel without spinning
    // is not a loss, and the card must not say it took a token that it did not.
    if (this.paid > 0 || this.stake === 0) this.cashOut();
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

  /** Under the result, when this play beat the cabinet's best. */
  private showNewBest(): void {
    if (!this.newBest) return;
    centerText(this, GAME_W / 2, GAME_H / 2 + 24, this.newBest, PALETTE.gold).setDepth(991);
    audio.sfx('bell_ding', 0.6);
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
    this.card?.destroy();
    this.card = null;
    if (this.started) this.mod?.destroy?.();
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
    this.showNewBest();

    audio.sfx(up ? 'chime' : 'buzzer');
    this.time.delayedCall(RESULT_MS, () => fadeToScene(this, this.exitTo ?? this.from, { atCabinet: this.gameId }));
  }

  /**
   * A tie.  The entry cost goes back and nothing else changes hands.
   *
   * It is deliberately NOT a win: no reward, no high score, no "+n".  A player
   * who drew with the machine has bought nothing and sold nothing, and the
   * card says so.  The refund is the stake this play actually carries, so a
   * table that raised gets back what it put in, and it happens once because
   * `settled` latches before the credit.
   */
  private settleDraw(): void {
    if (this.settled) return;
    this.settled = true;
    this.card?.destroy();
    this.card = null;
    if (this.started) this.mod?.destroy?.();

    const back = this.stake;
    if (back > 0) ledger.credit(back, 'game.refund');
    store.flush();

    const panel = this.add.rectangle(GAME_W / 2, GAME_H / 2, 250, 60, PALETTE.ink).setDepth(990);
    panel.setStrokeStyle(1, PALETTE.tealLight);
    centerText(this, GAME_W / 2, GAME_H / 2 - 10, `A TIE  -  ${back} BACK`, PALETTE.tealLight, 16).setDepth(991);
    centerText(this, GAME_W / 2, GAME_H / 2 + 12, `${ledger.balance()} tokens`, PALETTE.ash).setDepth(991);

    audio.sfx('coin_drop');
    this.time.delayedCall(RESULT_MS, () => fadeToScene(this, this.exitTo ?? this.from, { atCabinet: this.gameId }));
  }

  private settle(won: boolean, quit = false, payout?: number): void {
    if (this.settled) return;
    this.settled = true;
    this.card?.destroy();
    this.card = null;

    // Quitting at the card never built the game, so there is nothing to tear
    // down — calling destroy on a module that never ran leaves the next play
    // reading another game's leftovers.
    if (this.started) this.mod?.destroy?.();
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
    this.showNewBest();

    audio.sfx(won ? 'chime' : 'buzzer');

    // Back to the room you came from, standing at the cabinet you played.
    this.time.delayedCall(RESULT_MS, () => fadeToScene(this, this.exitTo ?? this.from, { atCabinet: this.gameId }));
  }
}

/** Shared helper: a draw a "draw = loss" style sub-caption. */
export function subCaption(scene: Phaser.Scene, str: string): Phaser.GameObjects.BitmapText {
  return centerText(scene, GAME_W / 2, 24, str, PALETTE.ash).setOrigin(0.5, 0);
}
