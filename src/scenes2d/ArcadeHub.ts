/**
 * Arcade hub.  PRD §7.5.
 *
 * Warm, loud, busy, and completely uninterested in the player.  Six cabinets
 * (seven games), a prize case behind glass, a counter nobody is standing at,
 * and a bell that does nothing.  Ever.  (VOC-18 — it will be tempting to make
 * the bell do something.  Do not.)
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store, type GameId } from '../core/state';
import { ledger } from '../core/ledger';
import { canEnter } from '../core/routes';
import { evaluateBroke } from '../core/broke';
import { KEYS } from '../core/input';
import { fadeIn, fadeToScene, text } from '../core/ui';
import { paintChangeMachine, paintHubRoom, ROOM } from '../art/hubRoom';
import { Player } from '../art/player';
import { Cabinet, CAB_W, CAB_H } from '../art/cabinet';
import { TokenHud } from '../ui/hud';
import { ANNEX_DOOR, BELL, CABINETS, COUNTER, PRIZE_CASE, PRIZES, cabinetsIn } from '../game/content';
import { DialogueBox } from '../froggy/dialogue';
import { tutorialScript } from '../froggy/script';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W, GAME_H } from '../render/pixelScaler';

const INTERACT_RANGE = 24;

type Target =
  | { kind: 'cabinet'; cab: Cabinet }
  | { kind: 'counter' }
  | { kind: 'bell' }
  | { kind: 'door' }
  | { kind: 'change' }
  | { kind: 'annex' }
  | null;

/** Where the player has to stand to use the change machine on the back wall. */
const CHANGE_SPOT = { x: 272, y: 62 };

export class ArcadeHub extends Phaser.Scene {
  private player!: Player;
  private bounds!: Phaser.Geom.Rectangle;
  private keys!: Record<string, Phaser.Input.Keyboard.Key[]>;
  private cabinets: Cabinet[] = [];
  private prompt!: Phaser.GameObjects.BitmapText;
  private promptPlate!: Phaser.GameObjects.Rectangle;
  private target: Target = null;
  private locked = false;
  private dialogue!: DialogueBox;
  private mutter!: Phaser.GameObjects.BitmapText;
  private returnTo: GameId | null = null;

  constructor() {
    super('ArcadeHub');
  }

  init(data: { atCabinet?: GameId } = {}): void {
    this.returnTo = data.atCabinet ?? null;
  }

  create(): void {
    froggyLayer.clear();
    // Phaser reuses scene instances across start/stop, so every mutable field
    // has to be reset here.  Left alone, `locked` stayed true after the first
    // minigame and froze the player in the hub for the rest of the run.
    this.locked = false;
    this.target = null;
    this.cabinets = [];

    fadeIn(this);
    audio.setScene({ music: 'hub_lofi', ambience: ['cabinet_bleeps', 'crowd_hum'] });

    paintHubRoom(this, { night: false });
    paintChangeMachine(this, false);
    this.paintCounter();

    this.cabinets = cabinetsIn('hub').map((def) => new Cabinet(this, def));

    // A cabinet advertises itself as clickable — cost badge, affordable
    // highlight — so it has to BE clickable.  Walking up and pressing [E] still
    // works; this is the mouse path, and without it clicking a cabinet from
    // across the room did nothing at all, with no feedback.
    for (const cab of this.cabinets) {
      // Cabinets in a column sit 38px apart, so the hit area stays at the
      // cabinet's own size — any more and neighbours overlap and you launch the
      // one you were not pointing at.
      this.add
        .zone(cab.def.x, cab.def.y - CAB_H / 2, CAB_W + 4, CAB_H + 2)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (this.busy()) return;
          this.launchGame(cab);
        });
    }

    // The prize case is the whole reason to earn tokens, and it was viewable
    // only by walking into the counter — so the prizes may as well not have
    // existed.  Clicking the case (or the counter under it) opens the list.
    this.add
      .zone(PRIZE_CASE.x + PRIZE_CASE.w / 2, PRIZE_CASE.y - 15, PRIZE_CASE.w, 30)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openCounter());
    this.add
      .zone(COUNTER.x + COUNTER.w / 2, COUNTER.y + COUNTER.h / 2, COUNTER.w, COUNTER.h)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openCounter());

    // The bell still summons nobody (VOC-18) — but it has to at least answer a
    // click, or it reads as broken rather than as ignored.
    this.add
      .zone(BELL.x + 8, BELL.y - 8, 40, 22)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.busy()) return;
        audio.sfx('bell_ding');
        this.say('nobody comes.');
      });

    this.paintAnnexDoor();

    this.bounds = new Phaser.Geom.Rectangle(
      ROOM.left + 8,
      ROOM.top + 6,
      ROOM.right - ROOM.left - 16,
      ROOM.bottom - ROOM.top - 6,
    );
    // A few steps in from the doors, not stood on them.  The door now actually
    // goes somewhere, and spawning inside its interact zone meant one stray
    // click on the carpet walked you straight back out again.
    const spawn = this.spawnPoint({ x: GAME_W / 2, y: ROOM.bottom - 34 });
    this.player = new Player(this, spawn.x, spawn.y);

    new TokenHud(this);

    this.promptPlate = this.add.rectangle(0, 0, 4, 12, PALETTE.black, 0.7).setDepth(800).setVisible(false);
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setDepth(801).setOrigin(0.5, 0.5).setVisible(false);
    this.mutter = text(this, GAME_W / 2, GAME_H - 26, '', PALETTE.fog)
      .setOrigin(0.5, 0.5)
      .setDepth(802)
      .setVisible(false);

    this.keys = {
      up: this.bindKeys(KEYS.up),
      down: this.bindKeys(KEYS.down),
      left: this.bindKeys(KEYS.left),
      right: this.bindKeys(KEYS.right),
    };
    this.input.keyboard?.on('keydown-E', () => this.interact());
    // `over` is what the pointer is actually on.  When that is a cabinet zone,
    // the zone's own handler runs and this must not also fire the proximity
    // target — otherwise clicking a cabinet from the spawn point would open the
    // door standing behind you.
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0 || this.busy()) return;
      this.interact();
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.busy()) this.scene.launch('SettingsModal', { from: 'ArcadeHub' });
    });

    this.dialogue = new DialogueBox(this);
    store.flush();

    // PRD BR-1: the broke check runs on hub entry as well as on the ledger
    // event, which covers spending the last token on a game you then quit.
    if (!store.get().seenIntro) this.runTutorial();
    else this.checkBroke();
  }

  // ------------------------------------------------------------------ tutorial

  private runTutorial(): void {
    this.locked = true;
    // Both have to be cabinets that are actually IN this room — the expensive
    // ones moved to the annex, and the tutorial was pointing at a wall.
    const inHere = cabinetsIn('hub');
    const cheap = inHere.reduce((a, b) => (b.cost < a.cost ? b : a));
    const hard = inHere.reduce((a, b) => (b.cost > a.cost ? b : a));
    this.dialogue.play(
      tutorialScript({
        tokenHud: { x: 30, y: 11, w: 56, h: 16 },
        cheapCabinet: { x: cheap.x, y: cheap.y - 18, w: 30, h: 40 },
        hardCabinet: { x: hard.x, y: hard.y - 18, w: 30, h: 40 },
        prizeCounter: { x: PRIZE_CASE.x + PRIZE_CASE.w / 2, y: PRIZE_CASE.y + 9, w: PRIZE_CASE.w, h: 22 },
      }),
      () => {
        store.patch({ seenIntro: true });
        store.flush();
        this.locked = false;
        this.checkBroke();
      },
    );
  }

  // ------------------------------------------------------------------ the room

  private paintCounter(): void {
    // Ticket counter along the back wall, prizes visible behind glass.
    this.add.rectangle(COUNTER.x, COUNTER.y, COUNTER.w, COUNTER.h, PALETTE.brown).setOrigin(0, 0);
    this.add.rectangle(COUNTER.x, COUNTER.y, COUNTER.w, 3, PALETTE.brownLight).setOrigin(0, 0);

    this.add
      .rectangle(PRIZE_CASE.x, PRIZE_CASE.y - 30, PRIZE_CASE.w, 30, PALETTE.ink)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.fog);
    PRIZES.forEach((p, i) => {
      this.add.rectangle(PRIZE_CASE.x + 7 + i * 18, PRIZE_CASE.y - 22, 13, 14, p.color).setOrigin(0, 0);
    });
    // glass sheen
    this.add.rectangle(PRIZE_CASE.x + 4, PRIZE_CASE.y - 27, 3, 25, PALETTE.white).setOrigin(0, 0).setAlpha(0.14);

    // RING FOR SERVICE.  Nobody is coming.
    this.add.rectangle(BELL.x, BELL.y, 7, 4, PALETTE.gold).setOrigin(0.5, 1);
    this.add.rectangle(BELL.x, BELL.y - 4, 2, 2, PALETTE.cream).setOrigin(0.5, 1);
    // The sign is legible.  That matters: the player has to read it, try it,
    // and get nothing.  (VOC-18)
    text(this, BELL.x + 10, BELL.y - 12, 'RING FOR', PALETTE.cream, 8);
    text(this, BELL.x + 10, BELL.y - 4, 'SERVICE', PALETTE.cream, 8);
  }


  /**
   * Where to stand when a cabinet hands you back.  Just below its base, which
   * is inside interact range — so the prompt is already up and you can play it
   * again without walking anywhere.
   */
  private spawnPoint(fallback: { x: number; y: number }): { x: number; y: number } {
    if (!this.returnTo) return fallback;
    const def = CABINETS.find((c) => c.id === this.returnTo);
    if (!def) return fallback;
    return {
      x: Phaser.Math.Clamp(def.x, ROOM.left + 12, ROOM.right - 12),
      y: Phaser.Math.Clamp(def.y + 12, ROOM.top + 12, ROOM.bottom - 8),
    };
  }

  private bindKeys(names: readonly string[]): Phaser.Input.Keyboard.Key[] {
    const kb = this.input.keyboard;
    if (!kb) return [];
    return names.map((n) => kb.addKey(n));
  }

  private held(group: string): boolean {
    return this.keys[group]?.some((k) => k.isDown) ?? false;
  }

  // --------------------------------------------------------------- interaction

  /**
   * The hub keeps running underneath the modals it launches, so its input has
   * to stand down while one is open.
   */
  private busy(): boolean {
    return (
      this.locked ||
      this.dialogue.isActive() ||
      this.scene.isActive('SettingsModal') ||
      this.scene.isActive('PrizeCounter') ||
      this.scene.isActive('ChangeMachine')
    );
  }

  /** The opening in the left wall, through to the back room. */
  private paintAnnexDoor(): void {
    this.add.rectangle(ROOM.left - 6, ANNEX_DOOR.y, 12, 46, PALETTE.black).setOrigin(0, 0.5);
    this.add.rectangle(ROOM.left, ANNEX_DOOR.y, 4, 46, PALETTE.ink).setOrigin(0, 0.5);
    // Beside the opening, in the band between the two left-wall cabinets.  Above
    // it the label was drawn behind the top one and read as smeared text.
    text(this, ROOM.left + 12, ANNEX_DOOR.y - 16, 'BACK ROOM', PALETTE.ash).setAlpha(0.75);

    this.add
      .zone(ANNEX_DOOR.x, ANNEX_DOOR.y, 26, 50)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (!this.busy()) this.toAnnex();
      });
  }

  private toAnnex(): void {
    this.locked = true;
    audio.sfx('footstep_concrete');
    fadeToScene(this, 'ArcadeAnnex');
  }

  private openCounter(): void {
    if (this.busy()) return;
    this.scene.launch('PrizeCounter');
    this.locked = true;
    this.events.once('prize-closed', () => {
      this.locked = false;
    });
  }

  /** The machine on the back wall.  Cash in, half of it back out in tokens. */
  private openChangeMachine(): void {
    if (this.busy()) return;
    this.scene.launch('ChangeMachine', { from: 'ArcadeHub' });
    this.locked = true;
    this.events.once('change-closed', () => {
      this.locked = false;
    });
  }

  private interact(): void {
    if (this.busy() || !this.target) return;
    const t = this.target;

    if (t.kind === 'annex') {
      this.toAnnex();
      return;
    }

    if (t.kind === 'bell') {
      // PRD EC-7: fifty rings, fifty nothings.  No counter, no easter egg.
      audio.sfx('bell_ding');
      return;
    }

    if (t.kind === 'counter') {
      this.openCounter();
      return;
    }

    if (t.kind === 'change') {
      this.openChangeMachine();
      return;
    }

    if (t.kind === 'door') {
      // The door is a door.  It goes outside, where the man is, and it comes
      // back in again — the daytime loop is walking through it with your arms
      // full and walking back through it with money.  It used to commit
      // `route: 'ejected'` and send you to the closed arcade at night, which
      // meant leaving with a prize ended the game whether you meant it to or
      // not.
      this.locked = true;
      fadeToScene(this, 'ExteriorDay');
      return;
    }

    this.launchGame(t.cab);
  }

  private launchGame(cab: Cabinet): void {
    const { cost } = cab.def;

    // The guard and the ledger are the only two things standing between the
    // player and a broken economy.  Both are checked, in that order.
    if (!canEnter('Minigame', store.get(), { cost })) {
      audio.sfx('buzzer');
      this.say(`NOT ENOUGH TOKENS — NEED ${cost}`);
      return;
    }
    // MG-2 / TK-2: cost is debited on launch, before the scene starts.
    if (!ledger.debit(cost, 'game.cost')) {
      audio.sfx('buzzer');
      return;
    }
    store.bumpGamePlayed(cab.def.id);
    store.flush();
    this.locked = true;
    fadeToScene(this, 'Minigame', { id: cab.def.id, from: 'ArcadeHub' });
  }

  private say(msg: string): void {
    this.mutter.setText(msg).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.mutter);
    this.tweens.add({ targets: this.mutter, alpha: 0, delay: 1200, duration: 500 });
  }

  // ---------------------------------------------------------------- broke check

  private checkBroke(): void {
    const outcome = evaluateBroke();
    if (!outcome) return;
    this.locked = true;
    const scene = outcome === 'charity' ? 'FroggyCharity' : 'SecondBust';
    if (this.scene.get(scene)) {
      this.time.delayedCall(400, () => fadeToScene(this, scene));
    } else {
      // Phase 4 has not landed yet.
      console.warn(`[hub] broke outcome "${outcome}" — ${scene} not built yet`);
      this.locked = false;
    }
  }

  // --------------------------------------------------------------------- update

  update(_time: number, delta: number): void {
    if (this.locked || this.dialogue.isActive()) {
      this.promptPlate.setVisible(false);
      this.prompt.setVisible(false);
      return;
    }

    const dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const dy = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    this.player.move(dx, dy, delta, this.bounds);

    const bal = ledger.balance();
    for (const c of this.cabinets) c.setAffordable(bal >= c.def.cost);

    this.target = this.findTarget();
    this.renderPrompt();
  }

  private findTarget(): Target {
    const px = this.player.x;
    const py = this.player.y;

    let best: Cabinet | null = null;
    let bestD = INTERACT_RANGE;
    for (const c of this.cabinets) {
      const d = c.distanceTo(px, py);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) return { kind: 'cabinet', cab: best };

    if (px < ANNEX_DOOR.x + 20 && Math.abs(py - ANNEX_DOOR.y) < 28) return { kind: 'annex' };
    if (Phaser.Math.Distance.Between(px, py, CHANGE_SPOT.x, CHANGE_SPOT.y) < INTERACT_RANGE) {
      return { kind: 'change' };
    }
    if (Phaser.Math.Distance.Between(px, py, BELL.x, BELL.y) < INTERACT_RANGE) return { kind: 'bell' };
    if (py < COUNTER.y + 34 && px > COUNTER.x && px < COUNTER.x + COUNTER.w) return { kind: 'counter' };
    if (py > ROOM.bottom - 22 && Math.abs(px - GAME_W / 2) < 26) return { kind: 'door' };
    return null;
  }

  private renderPrompt(): void {
    const t = this.target;
    if (!t) {
      this.promptPlate.setVisible(false);
      this.prompt.setVisible(false);
      return;
    }

    let msg: string;
    let color: number = PALETTE.gold;
    if (t.kind === 'cabinet') {
      const { cost } = t.cab.def;
      const can = ledger.balance() >= cost;
      // Name the game on the prompt.  A row of cabinets that all say PLAY is a
      // row of identical boxes: the marquee is too small to read at this size,
      // so the thing you are about to spend tokens on says so here.
      msg = `[E] ${t.cab.def.title} - ${cost} TOKEN${cost === 1 ? '' : 'S'}`;
      color = can ? PALETTE.gold : PALETTE.ash;
    } else if (t.kind === 'counter') {
      msg = '[E] PRIZE COUNTER';
    } else if (t.kind === 'annex') {
      msg = '[E] BACK ROOM';
    } else if (t.kind === 'bell') {
      msg = '[E] RING';
    } else if (t.kind === 'change') {
      // The prompt carries the wallet: cash only exists out on the street, so
      // this is the one place inside the building that mentions it.
      const cash = store.get().cash;
      msg = cash > 0 ? `[E] CHANGE - $${cash}` : '[E] CHANGE MACHINE';
    } else {
      msg = '[E] OUTSIDE';
    }

    this.prompt.setText(msg).setTint(color === PALETTE.gold ? 0xffd45e : 0x5c6b7d);
    const x = Phaser.Math.Clamp(this.player.x, 60, GAME_W - 60);
    const y = this.player.y - 34;
    this.prompt.setPosition(x, y).setVisible(true);
    this.promptPlate
      .setPosition(x, y)
      .setSize(this.prompt.width + 6, 11)
      .setVisible(true);
  }
}
