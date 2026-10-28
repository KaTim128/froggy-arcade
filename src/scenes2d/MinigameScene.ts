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

import { record } from '../game/life';
import { badgeOnRecord, earnBadge } from '../game/badges';
import Phaser from 'phaser';
import { RECORDS, best as bestRecord, submit as submitRecord } from '../core/records';
import { deviceControls, deviceObjective, type ControlRow } from '../ui/controlsList';
import { PALETTE } from '../render/palette';
import { FONT_ADVANCE } from '../render/pixelFont';
import { audio } from '../core/audio';
import { ledger } from '../core/ledger';
import { store, type GameId, type SavedGame } from '../core/state';
import { trackGame } from '../core/session';
import { centerText, fadeIn, fadeToScene, forfeitLines, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { floatDeduct, TokenHud } from '../ui/hud';
import { cabinetById } from '../game/content';
import { getMinigame } from '../minigames/registry';
import type { MinigameApi, MinigameModule } from '../minigames/types';
import { keyPlan, showTutorial, type TutorialCard } from '../ui/tutorialCard';
import { gameKeys, setKeyScope } from '../core/keymap';
import { froggyLayer } from '../render/froggyLayer';
import { setCabinetTouch } from '../game/touchLayouts';
import { patrolsOut, stealthPhase } from '../game/patrol';
import { copInside, copWentIn } from '../game/policeVisits';
import { speak } from '../ui/talkPanel';
import { applyFinish, resultGlow } from '../minigames/polish';

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
  /** The go a reload interrupted, to put back rather than start (core/session). */
  private restoring: SavedGame | null = null;
  /** Put back after a reload and not yet RESUMEd: held exactly as it was saved. */
  private held = false;
  /** Started from the floor (E, a tap) rather than by clicking the cabinet.  The card comes up either way. */
  private straight = false;
  private card: TutorialCard | null = null;
  /** Where the result card goes afterwards, when it is not back to the room. */
  private exitTo: string | null = null;
  /** This go is PRACTICE: free, and counted for nothing. */
  private practicing = false;
  /** Open on the PLAY / PRACTICE choice rather than the how-to-play card. */
  private chooser = false;
  /** The quit question, while it is up.  The game is frozen under it. */

  constructor() {
    super('Minigame');
  }

  init(data: { id: GameId; from?: string; straight?: boolean; chooser?: boolean; restore?: SavedGame }): void {
    this.gameId = data.id;
    // back after a reload, mid-game: straight into it, charged nothing (core/session)
    this.restoring = data.restore ?? null;
    this.held = false;
    // back from a practice go: the machine's screen, not its HOW TO PLAY page
    this.chooser = data.chooser === true;
    // Walked up and pressed play in one motion: the card still comes up.
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
    this.practicing = false;
    this.copArrive = null;
    this.copT = null;
    this.copBanner = null;
  }

  /**
   * ---- THE POLICE, WHILE YOU PLAY.  At a cabinet in the arcade with the
   * patrols out, an officer may be looking round the room already, or come
   * in while you play (`copArrive`): the edges of the screen take their
   * lights while they look round (`copT`), and then they are at your
   * shoulder -- the game stops where it is, no card, nothing given back
   * (game/indoorPatrol takes it from there, back in the room).
   */
  private copArrive: number | null = null;
  private copT: number | null = null;
  private copBanner: Phaser.GameObjects.Container | null = null;

  private static readonly ARCADE_ROOMS = ['ArcadeHub', 'ArcadeAnnex', 'ArcadeLounge', 'ArcadeCasino'];

  /** The game has started: is an officer in the arcade, or might one come in? */
  private armPolice(): void {
    if (!patrolsOut() || !MinigameScene.ARCADE_ROOMS.includes(this.from)) return;
    if (copInside('arcade')) return this.copLooksRound(2.5 + Math.random() * 3);
    const chance = new URLSearchParams(location.search).get('police') === '1' ? 1 : stealthPhase() ? 0.5 : 0.2;
    if (Math.random() < chance) this.copArrive = 8 + Math.random() * 14;
  }

  /** An officer in the room, looking round it: their lights at the edges of the screen. */
  private copLooksRound(s: number): void {
    this.copArrive = null;
    this.copT = s;
    const c = this.add.container(0, 0).setDepth(1500);
    const red = this.add.rectangle(0, 0, 10, GAME_H, 0xff2a3a, 0.3).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD);
    const blue = this.add.rectangle(GAME_W - 10, 0, 10, GAME_H, 0x2a5aff, 0.3).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD);
    const plate = this.add.rectangle(GAME_W / 2, GAME_H - 9, 230, 11, 0x000000, 0.7);
    const t = centerText(this, GAME_W / 2, GAME_H - 9, 'AN OFFICER IS LOOKING ROUND THE ARCADE...', 0xff8080);
    c.add([red, blue, plate, t]);
    this.tweens.add({ targets: red, alpha: { from: 0.05, to: 0.35 }, duration: 260, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: blue, alpha: { from: 0.35, to: 0.05 }, duration: 260, yoyo: true, repeat: -1 });
    this.copBanner = c;
    audio.sfx('police_radio', 0.35);
  }

  /**
   * At your shoulder: "aren't you the guy from the poster?"  The game ends
   * where it is -- no result card, no FORFEIT, and the tokens it took stay
   * taken -- and back in the room they are stood right by you.
   */
  private copInterrupts(): void {
    if (this.settled) return;
    this.settled = true;
    this.endSession();
    this.copT = null;
    this.card?.destroy();
    this.card = null;
    if (this.started) this.mod?.destroy?.();
    setCabinetTouch(null);
    this.copBanner?.destroy();
    this.copBanner = null;
    store.flush();
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0, 0).setDepth(940).setInteractive();
    audio.sfx('ui_blip', 0.8);
    copWentIn('arcade', 15000);
    // (whatever the cabinet did with the keys and the pointer, they are back)
    this.input.enabled = true;
    if (this.input.keyboard) this.input.keyboard.enabled = true;
    let gone = false;
    const back = (): void => {
      if (gone) return;
      gone = true;
      fadeToScene(this, this.from, { atCabinet: this.gameId, copAsks: true });
    };
    const line = speak(this, 'officer', '"Hey -- aren\'t you the guy from the poster?"', back);
    // (and they do not wait for an answer for long)
    this.time.delayedCall(3500, () => (line.active ? line.destroy() : back()));
  }

  /** Each frame of play: the officer coming, looking, and coming over. */
  private stepPolice(dt: number): void {
    if (this.copArrive !== null) {
      this.copArrive -= dt;
      if (this.copArrive <= 0) {
        copWentIn('arcade', 20000);
        this.copLooksRound(3 + Math.random() * 2.5);
      }
    }
    if (this.copT !== null) {
      copWentIn('arcade', 5000);
      this.copT -= dt;
      if (this.copT <= 0) this.copInterrupts();
    }
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
    // The title bar -- name, payout, and the way into the pause menu -- is
    // drawn over everything a game paints, so no cabinet can cover its own
    // way out.
    const TOP = 1000;
    this.add.rectangle(0, 0, GAME_W, 16, PALETTE.ink).setOrigin(0, 0).setDepth(TOP);
    text(this, 4, 4, def.title, PALETTE.gold).setDepth(TOP);

    // QUIT lives in the pause menu (QUIT GAME, beside RESUME), which asks
    // first and says what walking out costs.  Esc opens it on a keyboard;
    // a phone has its own gear on the screen's edge (ui/touchControls).
    // Nothing is drawn for it in the bar.

    this.hud = new TokenHud(this);
    this.hud.setVisible(false); // the title bar already carries the balance line
    // (tokens going out mid-game -- the play itself, a raise, a spin -- the
    // red amount under the title bar, where the counter would be)
    const offSpend = ledger.onChange((next, prev) => {
      if (next < prev) floatDeduct(this, 4, 19, prev - next, ' TOKENS');
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offSpend);
    // Right-aligned a clear gap short of the gear rather than pinned to a
    // fixed left edge: the note is the cabinet's own wording and some of them
    // are twice as long as others.
    const note = text(this, GAME_W - 6, 4, this.mod.payoutNote ?? `WIN: +${def.reward}`, PALETTE.tealLight)
      .setOrigin(1, 0)
      .setDepth(TOP);
    // The personal best, where this cabinet keeps one, centred in whatever
    // gap the title and the payout leave -- and shortened until it fits
    // there, so it never runs into either of them.
    const rec = RECORDS[this.gameId];
    const was = bestRecord(this.gameId);
    if (rec && was !== null) {
      const from = 4 + def.title.length * FONT_ADVANCE + 6;
      const to = GAME_W - 58 - note.width - 6;
      const fit = [rec.short(was), `BEST ${rec.format(was)}`, rec.format(was)].find(
        (s) => s.length * FONT_ADVANCE <= to - from,
      );
      if (fit) centerText(this, Math.round((from + to) / 2), 8, fit, PALETTE.gold).setAlpha(0.9).setDepth(TOP);
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
      practice: false,
      record: (value: number) => {
        // (a practice go sets no records)
        if (this.practicing) return;
        const rec = RECORDS[this.gameId];
        // (and only when it is now the best shown: a cabinet whose run kept an
        // older, higher score is not beaten by a first record under it)
        if (rec && submitRecord(this.gameId, value)) {
          const now = bestRecord(this.gameId);
          const v = rec.lower ? Math.round(value * 10) / 10 : Math.floor(value);
          if (now === v) this.newBest = `NEW BEST!  ${rec.format(v)}`;
        }
        // (and the mastery badge that is a line on this same number)
        badgeOnRecord(this.gameId, value);
      },
      badge: (id: string) => {
        if (!this.practicing) earnBadge(id);
      },
      area: AREA,
    };

    // Esc is the pause menu here as everywhere (core/pause.ts), and its LEAVE
    // asks the same question QUIT does before anything is forfeited.

    // MG-8: the card comes first — what the cabinet wants, which keys it
    // reads, and what a go costs — with the game unbuilt behind it.  PLAY is
    // where the tokens move and where the module is constructed.
    const mod = this.mod;

    // PLAY: the one route into a built game, and the one place a go is charged.
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
      this.saveGame(true);
      // the cabinet's finish over its picture: its light, its corners, its grain
      applyFinish(this, this.gameId);
      this.armPolice();
      // On a phone, the cabinet's own keys become the cabinet's own buttons
      // for as long as it is being played.  The card did not need them: it
      // is two buttons you tap.
      setCabinetTouch(mod.touch);
    };

    // (the first go at a cabinet always gets its card, however it was
    // started -- [E] and a tap on a phone included: nobody is dropped into a
    // game they have never been shown how to play)
    const firstGo = (store.get().gamesPlayed[this.gameId] ?? 0) === 0;
    // PRACTICE: the same game, built the same way, with nothing taken, nothing
    // counted, and the title bar saying so the whole time.
    const startPractice = (): void => {
      this.card = null;
      if (this.settled) return;
      this.practicing = true;
      (api as { practice: boolean }).practice = true;
      this.stake = 0;
      const tag = this.add.rectangle(GAME_W / 2, 8, 112, 12, 0x1f4a5a).setStrokeStyle(1, PALETTE.tealLight).setDepth(1002);
      centerText(this, GAME_W / 2, 8, 'PRACTICE - FREE', PALETTE.tealLight).setDepth(1003);
      void tag;
      mod.create(this, api);
      this.started = true;
      this.saveGame(true);
      // the cabinet's finish over its picture: its light, its corners, its grain
      applyFinish(this, this.gameId);
      this.armPolice();
      setCabinetTouch(mod.touch);
    };

    // ---- THIS GO, KEPT IN THE SAVE as it is played (log #87): every second,
    // and on the way out of the page (core/session captureGame).
    trackGame(() => this.saveGame(true));
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.saveGame() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => trackGame(null));

    // This game's own keys (Grudge's J...) are live from here until it goes,
    // so any the player moved are moved for it and for nothing else.
    gameKeys(this.gameId, [...keyPlan(mod.tutorial.controls).reserved]);
    setKeyScope(this.gameId);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setKeyScope(null));

    // Back after a reload, mid-go: straight into it, no card, no charge.
    if (this.restoring) {
      const r = this.restoring;
      this.restoring = null;
      this.resumeGo(r, api);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setCabinetTouch(null));
      this.devBridge();
      return;
    }

    // ---- THE MACHINE'S SCREEN, BEFORE EVERY GO (log #49b, #70, #79).
    //
    // However the go was started -- the cabinet clicked, E at it, a tap, or
    // back from a practice go -- the card comes up first: YOUR BEST, PLAY and
    // its price, PRACTICE beside it where there is one, TUTORIAL, CONTROLS
    // and LEAVE.  The first go at a cabinet opens on its HOW TO PLAY page.
    this.card = showTutorial(this, {
      title: def.title,
      // The keys on a keyboard, the arrows and buttons on a phone.
      tutorial: {
        objective: deviceObjective(mod.tutorial.objective, mod.touch),
        controls: deviceControls(mod.tutorial.controls, mod.touch),
      },
      // (again after a key is changed on CONTROLS, and the keys as written for it)
      liveControls: () => deviceControls(mod.tutorial.controls, mod.touch),
      keyRows: mod.tutorial.controls,
      keyScope: this.gameId,
      cost: def.cost,
      balance: ledger.balance(),
      chargesInside: def.freeToEnter === true,
      payNote: mod.payoutNote ?? `WIN: ${def.reward} TOKENS`,
      record: (() => {
        const rec = RECORDS[this.gameId];
        const was = bestRecord(this.gameId);
        return rec && was !== null ? rec.long(was) : undefined;
      })(),
      keepsRecord: !!RECORDS[this.gameId],
      howToFirst: firstGo && !this.chooser,
      onPlay: start,
      onPractice: mod.practice ? startPractice : undefined,
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

  /**
   * ---- THIS GO, IN THE SAVE (log #87).  What a reload needs to put it back:
   * the stake, what has been paid out, practice or not, and the game's own
   * snapshot where it keeps one.
   */
  private saveGame(now = false): void {
    if (!this.started || this.settled || !this.mod) return;
    let snap: unknown;
    try {
      snap = this.mod.snapshot?.();
    } catch {
      snap = undefined;
    }
    const atRisk = Math.max(0, Math.floor(this.mod.atRisk?.() ?? 0));
    store.setGame({ id: this.gameId, from: this.from, stake: this.stake, paid: this.paid, practicing: this.practicing, atRisk, snap, at: Date.now() }, now);
  }

  /** The go is over (won, lost, left, quit): nothing to come back to. */
  private endSession(): void {
    if (store.get().game) store.setGame(null, true);
  }

  /**
   * ---- BACK INTO A GO A RELOAD INTERRUPTED.  No card and no charge: the
   * stake it had is the stake it has.  A cabinet that keeps a snapshot is put
   * back exactly; one that does not starts a fresh go, paid for.  Either way
   * it comes up paused with the settings open (core/pause pauseOnArrival).
   */
  private resumeGo(r: SavedGame, api: MinigameApi): void {
    const mod = this.mod!;
    this.stake = r.stake;
    this.paid = r.paid;
    if (r.practicing) {
      this.practicing = true;
      (api as { practice: boolean }).practice = true;
      this.add.rectangle(GAME_W / 2, 8, 112, 12, 0x1f4a5a).setStrokeStyle(1, PALETTE.tealLight).setDepth(1002);
      centerText(this, GAME_W / 2, 8, 'PRACTICE - FREE', PALETTE.tealLight).setDepth(1003);
    }
    mod.create(this, api);
    let back = false;
    if (r.snap !== undefined && mod.restore) {
      try {
        mod.restore(r.snap);
        back = true;
      } catch {
        back = false;
      }
    }
    this.started = true;
    // not a frame of it moves until the player has the pause menu and says RESUME
    // (its clock and its tweens too: a delayed call or a tween is the game moving)
    this.held = true;
    this.time.paused = true;
    this.tweens.pauseAll();
    this.events.once(Phaser.Scenes.Events.RESUME, () => {
      this.held = false;
      this.time.paused = false;
      this.tweens.resumeAll();
    });
    applyFinish(this, this.gameId);
    this.armPolice();
    setCabinetTouch(mod.touch);
    // (a fresh go: whatever was on the felt mid-hand comes back to the pocket;
    // put back exactly, a spin or a pull the page cut off mid-air is handed
    // back by the snapshot's own `refund` rather than played out)
    const told = back && r.snap && typeof (r.snap as { refund?: unknown }).refund === 'number' ? (r.snap as { refund: number }).refund : 0;
    const owed = r.practicing ? 0 : back ? Math.max(0, Math.floor(told)) : (r.atRisk ?? 0);
    if (owed > 0) {
      ledger.credit(owed, 'game.refund');
      this.stake = Math.max(0, this.stake - owed);
    }
    this.saveGame(true);
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
      /** An officer comes in now (seconds until they come over). */
      cop: (s = 0.5) => this.copLooksRound(s),
      stake: () => this.stake,
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      delete (window as unknown as Record<string, unknown>).__minigame;
    });
  }

  update(time: number, delta: number): void {
    if (this.settled || !this.started || this.held) return;
    this.stepPolice(delta / 1000);
    if (this.settled) return;
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
    this.endSession();
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
    if (this.settled || !this.started || !this.inPlay()) return null;
    if (this.practicing) return 0;
    return Math.max(0, Math.floor(this.mod?.atRisk?.() ?? this.stake));
  }

  /** This cabinet's objective, as its card says it on this device (the pause menu's HOW TO PLAY). */
  howToLines(): string[] {
    return this.mod ? deviceObjective(this.mod.tutorial.objective, this.mod.touch) : [];
  }

  /** The cabinet's name. */
  title(): string {
    return cabinetById(this.gameId).title;
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

  /** Esc at the card is its LEAVE; anywhere else it is the pause menu. */
  handleEscape(): boolean {
    // At the how-to-play card nothing has been paid and nothing is being
    // played, so Esc is its LEAVE button, as it always was.
    if (this.card && !this.started && !this.settled) {
      // (back from HOW TO PLAY or CONTROLS first, or stop waiting for a key)
      if (this.card.escape()) return true;
      this.leave();
      return true;
    }
    return false;
  }

  /**
   * Under way: past the part before the play (see MinigameModule.inPlay).
   * Before it -- the card, a practice go, the bets before a race -- walking
   * out is LEAVE, and nothing is lost.
   */
  inPlay(): boolean {
    if (!this.started || this.settled || this.practicing) return false;
    return this.mod?.inPlay?.() ?? true;
  }

  /**
   * What the way out is called right now: LEAVE until the play is under way,
   * then QUIT GAME, or the cabinet's own (the Chamber's CASH OUT).
   */
  exitLabel(): string {
    if (!this.inPlay()) return 'LEAVE';
    return this.mod?.pauseExit?.()?.label ?? 'QUIT GAME';
  }

  /** The cabinet's own way out, if it has one now (see MinigameModule.pauseExit). */
  ownExit(): { label: string; run: () => void } | null {
    return this.inPlay() ? this.mod?.pauseExit?.() ?? null : null;
  }

  /** Whether this is a practice go (nothing paid, LEAVE goes back to the choice). */
  isPracticing(): boolean {
    return this.practicing && this.started && !this.settled;
  }

  /**
   * QUIT GAME, from the pause menu.  At the card nothing has been paid and
   * it just leaves; in a game it is the old forfeit (MG-4), back to the room
   * the cabinet stands in.
   */
  quitGame(): void {
    if (this.settled) return;
    if (!this.started) {
      this.leave();
      return;
    }
    // BEFORE THE PLAY: the stake back, and out, with no result to show
    // ("YOU BREAK EVEN" for walking away from a race you never ran)
    if (!this.practicing && !this.inPlay()) {
      if (this.stake > 0) ledger.credit(this.stake, 'game.refund');
      this.stake = 0;
      this.mod?.destroy?.();
      this.leave();
      return;
    }
    this.exitTo = null;
    this.forfeit();
  }

  /** The question QUIT GAME asks: how the sitting stands, and what walking out forfeits. */
  quitLines(): string[] {
    const risk = this.forfeitAmount();
    if (risk === null) return this.stake > 0 && !this.practicing ? ['LEAVE THIS GAME?', `YOUR ${this.stake} TOKENS COME BACK TO YOU.`] : ['LEAVE THIS GAME?', 'NOTHING HAS BEEN PAID.'];
    // How the sitting stands, first: the hands already settled, so whatever
    // is on the felt right now is the forfeit line's and not counted twice.
    const sitting: string[] = [];
    if (this.mod?.reportsSitting) {
      const net = this.paid - this.stake + risk;
      sitting.push(net === 0 ? 'SO FAR YOU ARE EVEN' : net > 0 ? `SO FAR YOU ARE UP ${net}` : `SO FAR YOU ARE DOWN ${-net}`);
    }
    return [...sitting, 'ARE YOU SURE YOU WANT TO QUIT?', ...forfeitLines(risk)];
  }

  /**
   * The end of a practice go, however it ended: nothing changes hands, nothing
   * is recorded or counted, and the card says it was practice.
   */
  private endPractice(won: boolean | null): void {
    if (this.settled) return;
    this.settled = true;
    this.endSession();
    this.card?.destroy();
    this.card = null;
    if (this.started) this.mod?.destroy?.();
    resultGlow(this, won);
    const panel = this.add.rectangle(GAME_W / 2, GAME_H / 2, 250, 60, PALETTE.ink).setDepth(990);
    panel.setStrokeStyle(1, PALETTE.tealLight);
    centerText(this, GAME_W / 2, GAME_H / 2 - 10, won === null ? 'PRACTICE OVER' : won ? 'PRACTICE - YOU WON' : 'PRACTICE - YOU LOST', PALETTE.tealLight, 16).setDepth(991);
    centerText(this, GAME_W / 2, GAME_H / 2 + 12, 'NOTHING WON OR LOST - BACK TO THE CHOICE', PALETTE.ash).setDepth(991);
    audio.sfx('ui_blip');
    // back to PLAY or PRACTICE -- unless the pause menu was taking you
    // somewhere else altogether
    this.time.delayedCall(RESULT_MS, () => {
      if (this.exitTo) fadeToScene(this, this.exitTo, { atCabinet: this.gameId });
      else fadeToScene(this, 'Minigame', { id: this.gameId, from: this.from, chooser: true });
    });
  }

  private forfeit(): void {
    if (this.practicing) {
      this.endPractice(null);
      return;
    }
    // Nothing was ever staked — a free fixture the player only looked at — so
    // there is nothing to forfeit.  Walking out of the wheel without spinning
    // is not a loss, and the card must not say it took a token that it did not.
    if (this.paid > 0 || this.stake === 0) this.cashOut();
    else this.settle(false, true);
  }

  /** MG-3 mid-game: a table settles each hand as it is won. */
  private payout(n: number): void {
    if (this.practicing) return;
    if (this.settled || !Number.isFinite(n) || n <= 0) return;
    const amount = Math.floor(n);
    ledger.credit(amount, 'game.reward');
    this.paid += amount;
    record('tokens_won', amount);
    this.saveGame();
    store.flush();
  }

  /** MG-2 again, mid-game: more tokens on the table, debited the same way. */
  private raise(n: number): boolean {
    if (this.practicing) return false;
    if (this.settled || !Number.isFinite(n) || n <= 0) return false;
    if (!ledger.debit(Math.floor(n), 'game.cost')) return false;
    this.stake += Math.floor(n);
    this.saveGame();
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
    if (this.practicing) {
      this.endPractice(null);
      return;
    }
    if (this.settled) return;
    this.settled = true;
    this.endSession();
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
    if (this.practicing) {
      this.endPractice(null);
      return;
    }
    if (this.settled) return;
    this.settled = true;
    this.endSession();
    this.card?.destroy();
    this.card = null;
    if (this.started) this.mod?.destroy?.();

    const back = this.stake;
    if (back > 0) ledger.credit(back, 'game.refund');
    store.flush();

    // (a draw: neither gold nor red)
    resultGlow(this, null);
    const panel = this.add.rectangle(GAME_W / 2, GAME_H / 2, 250, 60, PALETTE.ink).setDepth(990);
    panel.setStrokeStyle(1, PALETTE.tealLight);
    centerText(this, GAME_W / 2, GAME_H / 2 - 10, `A TIE  -  ${back} BACK`, PALETTE.tealLight, 16).setDepth(991);
    centerText(this, GAME_W / 2, GAME_H / 2 + 12, `${ledger.balance()} tokens`, PALETTE.ash).setDepth(991);

    audio.sfx('coin_drop');
    this.time.delayedCall(RESULT_MS, () => fadeToScene(this, this.exitTo ?? this.from, { atCabinet: this.gameId }));
  }

  private settle(won: boolean, quit = false, payout?: number): void {
    if (this.practicing) {
      this.endPractice(quit ? null : won);
      return;
    }
    if (this.settled) return;
    this.settled = true;
    this.endSession();
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
    if (won && paid > 0) record('tokens_won', paid);
    // (counted for the goals: a game played, and won)
    if (this.started && !quit) {
      record('game_played');
      if (won) {
        record('game_won');
        // (which cabinets have been beaten, for the goals: a win at ten, at all)
        record(`won_${this.gameId}`);
      }
    }
    store.flush();

    // the result in colour, under the card: gold for a win, red for a loss
    resultGlow(this, won);
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
