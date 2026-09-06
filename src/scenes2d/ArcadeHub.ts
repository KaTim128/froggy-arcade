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
import { store } from '../core/state';
import { ledger } from '../core/ledger';
import { canEnter } from '../core/routes';
import { evaluateBroke } from '../core/broke';
import { KEYS } from '../core/input';
import { fadeIn, fadeToScene, text } from '../core/ui';
import { paintChangeMachine, paintHubRoom, ROOM } from '../art/hubRoom';
import { Player } from '../art/player';
import { Cabinet } from '../art/cabinet';
import { TokenHud } from '../ui/hud';
import { BELL, CABINETS, COUNTER, PRIZE_CASE, PRIZES } from '../game/content';
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
  | null;

export class ArcadeHub extends Phaser.Scene {
  private player!: Player;
  private bounds!: Phaser.Geom.Rectangle;
  private keys!: Record<string, Phaser.Input.Keyboard.Key[]>;
  private cabinets: Cabinet[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private promptPlate!: Phaser.GameObjects.Rectangle;
  private target: Target = null;
  private locked = false;
  private dialogue!: DialogueBox;
  private mutter!: Phaser.GameObjects.Text;

  constructor() {
    super('ArcadeHub');
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

    this.cabinets = CABINETS.map((def) => new Cabinet(this, def));

    this.bounds = new Phaser.Geom.Rectangle(
      ROOM.left + 8,
      ROOM.top + 6,
      ROOM.right - ROOM.left - 16,
      ROOM.bottom - ROOM.top - 6,
    );
    this.player = new Player(this, GAME_W / 2, ROOM.bottom - 12);

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
    this.input.on('pointerdown', () => {
      if (!this.dialogue.isActive()) this.interact();
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.locked) this.scene.launch('SettingsModal', { from: 'ArcadeHub' });
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
    const cheap = CABINETS[0];
    const hard = CABINETS[6];
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

  private bindKeys(names: readonly string[]): Phaser.Input.Keyboard.Key[] {
    const kb = this.input.keyboard;
    if (!kb) return [];
    return names.map((n) => kb.addKey(n));
  }

  private held(group: string): boolean {
    return this.keys[group]?.some((k) => k.isDown) ?? false;
  }

  // --------------------------------------------------------------- interaction

  private interact(): void {
    if (this.locked || this.dialogue.isActive() || !this.target) return;
    const t = this.target;

    if (t.kind === 'bell') {
      // PRD EC-7: fifty rings, fifty nothings.  No counter, no easter egg.
      audio.sfx('bell_ding');
      return;
    }

    if (t.kind === 'counter') {
      this.scene.launch('PrizeCounter');
      this.locked = true;
      this.events.once('prize-closed', () => {
        this.locked = false;
      });
      return;
    }

    if (t.kind === 'door') {
      if (store.get().prizesOwned.length > 0) {
        // PRD PC-4: with a prize in hand there is somewhere to be.  Leaving
        // through the front door goes out to the kid, not to an ending — the
        // sale happens outside.
        this.locked = true;
        store.patch({ route: 'ejected' });
        store.flush();
        fadeToScene(this, 'ExteriorNight');
      } else {
        this.say('...nah. Not yet.');
      }
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
    fadeToScene(this, 'Minigame', { id: cab.def.id });
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
      msg = `[E] PLAY - ${cost} TOKEN${cost === 1 ? '' : 'S'}`;
      color = can ? PALETTE.gold : PALETTE.ash;
    } else if (t.kind === 'counter') {
      msg = '[E] PRIZE COUNTER';
    } else if (t.kind === 'bell') {
      msg = '[E] RING';
    } else {
      msg = store.get().prizesOwned.length > 0 ? '[E] LEAVE' : '[E] DOOR';
    }

    this.prompt.setText(msg).setColor(color === PALETTE.gold ? '#ffd45e' : '#5c6b7d');
    const x = Phaser.Math.Clamp(this.player.x, 60, GAME_W - 60);
    const y = this.player.y - 34;
    this.prompt.setPosition(x, y).setVisible(true);
    this.promptPlate
      .setPosition(x, y)
      .setSize(this.prompt.width + 6, 11)
      .setVisible(true);
  }
}
