/**
 * Token HUD.  PRD §6.8 / QFD B8.
 *
 * Coin-spin within 100ms of the ledger event; red pulse at <= 3 tokens.
 * Present in the hub and the minigames.  Absent in every Act III-VI scene —
 * once the arcade closes, there is nothing left to count.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { ledger } from '../core/ledger';
import { text } from '../core/ui';
import { store } from '../core/state';
import { clock, rentLabel, takeNotice, DAY_SECONDS } from '../game/life';
import { tinyText, tinyWidth } from './tinyText';
import { GAME_W } from '../render/pixelScaler';

/** The hunt's line: just under the GOALS button and the pocket slots. */
const OBJECTIVE_Y = 25;

/**
 * WHICH HUD.  'classic' is the purse as it always was.  'hunt' is the
 * stealth phase (game/patrol): no purse at all, only what you are doing --
 * get to Sharp's unseen.  'labeled' is after it, brought back outside the
 * arcade once the look is changed: each slot with its name over it --
 * TOKENS, CASH and TIME LEFT (the time until the rent on 213 is due).
 */
type HudMode = 'classic' | 'hunt' | 'labeled';
const hudMode = (): HudMode => {
  const s = store.get();
  if (s.arc !== 'live' || s.route !== 'normal') return 'classic';
  return s.hudShown ? 'labeled' : 'hunt';
};

/** Game time until the rent is due, as "6D 14H" (or "OVERDUE"). */
function timeLeft(): string {
  const l = store.get().life;
  if (!l.rented) return 'NO LEASE';
  const secs = l.rentDue * DAY_SECONDS - l.t;
  if (secs <= 0) return 'OVERDUE';
  const hours = Math.floor((secs / DAY_SECONDS) * 24);
  const d = Math.floor(hours / 24);
  return d > 0 ? `${d}D ${hours % 24}H` : `${hours % 24}H ${Math.floor(((secs / DAY_SECONDS) * 24 * 60) % 60)}M`;
}

export const LOW_TOKEN_THRESHOLD = 3;

/** Left edge of the label, clear of the coin (within the token plate). */
const LABEL_X = 16;

/**
 * A FROGGY TOKEN: a gold coin with a raised rim, and on its face Froggy
 * himself -- the green head, the two big eyes on top -- so the count beside
 * it needs no word to say what it is.  Drawn centred on (0, 0); `low` turns
 * the rim to ember when the purse is nearly empty.
 */
export function drawFrogToken(g: Phaser.GameObjects.Graphics, low = false): Phaser.GameObjects.Graphics {
  g.clear();
  const rim = low ? PALETTE.ember : PALETTE.gold;
  g.fillStyle(0x14100c, 1).fillCircle(0, 0, 6);
  g.fillStyle(rim, 1).fillCircle(0, 0, 5.2);
  g.fillStyle(low ? 0x8a3a1a : 0xa8781e, 1).fillCircle(0, 0, 4.2);
  // Froggy: the head, the eyes on top of it, the smile
  g.fillStyle(0x3a8a3e, 1).fillEllipse(0, 1, 6.4, 4.4);
  g.fillStyle(0x5aa85f, 1).fillEllipse(0, 0.6, 5.6, 3.6);
  g.fillStyle(0x5aa85f, 1).fillCircle(-1.8, -1.6, 1.5).fillCircle(1.8, -1.6, 1.5);
  g.fillStyle(0xffffff, 1).fillRect(-2.5, -2.3, 1, 1).fillRect(1.5, -2.3, 1, 1);
  g.fillStyle(0x14100c, 1).fillRect(-2, -2, 1, 1).fillRect(2, -2, 1, 1);
  g.fillStyle(0x24492a, 1).fillRect(-1.5, 1.5, 3, 0.8);
  // the shine on the rim
  g.fillStyle(0xffffff, 0.55).fillRect(-3, -4, 2, 1);
  return g;
}

export class TokenHud {
  private scene: Phaser.Scene;
  private cashPlate: Phaser.GameObjects.Rectangle;
  private cashLabel: Phaser.GameObjects.BitmapText;
  private tokens: Phaser.GameObjects.Container;
  private plate: Phaser.GameObjects.Rectangle;
  private coin: Phaser.GameObjects.Graphics;
  private coinLow = false;
  private label: Phaser.GameObjects.BitmapText;
  private container: Phaser.GameObjects.Container;
  private unsub: () => void;
  private pulse?: Phaser.Tweens.Tween;
  private lastCash = -1;
  private clockText!: Phaser.GameObjects.BitmapText;
  private lifeBox!: Phaser.GameObjects.Container;
  private toast: Phaser.GameObjects.Container | null = null;
  private lifePlate!: Phaser.GameObjects.Rectangle;
  private mode: HudMode = 'classic';
  private slotNames!: Phaser.GameObjects.Graphics;
  private timeBox!: Phaser.GameObjects.Container;
  private timePlate!: Phaser.GameObjects.Rectangle;
  private timeText!: Phaser.GameObjects.BitmapText;
  private objective!: Phaser.GameObjects.Container;
  private objectiveText!: Phaser.GameObjects.BitmapText;

  /**
   * Cash on the left, tokens beside it: the two currencies side by side and
   * never added together.  `x`/`y` move the pair (a street whose top left is
   * taken by a sign puts it elsewhere).
   */
  constructor(scene: Phaser.Scene, at: { x?: number; y?: number } = {}) {
    this.scene = scene;

    this.cashPlate = scene.add.rectangle(0, 0, 30, 14, PALETTE.black, 0.75).setOrigin(0, 0);
    this.cashLabel = text(scene, 5, 3, '', PALETTE.mossLight);

    this.plate = scene.add.rectangle(0, 0, 54, 14, PALETTE.black, 0.75).setOrigin(0, 0);
    this.coin = drawFrogToken(scene.add.graphics()).setPosition(8, 7);
    this.label = text(scene, LABEL_X, 3, '', PALETTE.cream);
    this.tokens = scene.add.container(0, 0, [this.plate, this.coin, this.label]);

    this.slotNames = scene.add.graphics();
    this.timePlate = scene.add.rectangle(0, 0, 40, 20, PALETTE.black, 0.75).setOrigin(0, 0);
    this.timeText = text(scene, 5, 10, '', PALETTE.gold);
    this.timeBox = scene.add.container(0, 0, [this.timePlate, this.timeText]).setVisible(false);
    this.container = scene.add.container(at.x ?? 4, at.y ?? 4, [this.cashPlate, this.cashLabel, this.tokens, this.timeBox, this.slotNames]);
    this.container.setDepth(950).setScrollFactor(0);
    this.buildLife();
    // the hunt's own line, in place of the purse
    const op = scene.add.rectangle(0, 0, 10, 12, 0x1a0a0e, 0.8).setOrigin(0, 0).setStrokeStyle(1, 0xd04040);
    this.objectiveText = text(scene, 5, 2, '', PALETTE.cream);
    this.objective = scene.add.container(4, 4, [op, this.objectiveText]).setDepth(950).setScrollFactor(0).setVisible(false);
    this.objective.setData('plate', op);
    this.applyMode();

    this.unsub = ledger.onChange((next, prev) => {
      if (this.alive()) this.onChange(next, prev);
    });
    const unStore = store.subscribe((st) => {
      // A scene going down can still write to the store on its way out (the
      // crane saves its glass on shutdown): by then these texts are gone, and
      // measuring one threw in the middle of the change of scene -- which
      // never finished, and left the screen black.
      if (!this.alive()) return;
      if (hudMode() !== this.mode) this.applyMode();
      if (st.cash !== this.lastCash) this.refreshCash(st.cash);
      this.refreshLife();
    });
    this.refreshCash(store.get().cash);
    this.refresh(ledger.balance());

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsub();
      unStore();
    });
  }

  /** Still on screen: the scene up and the texts not torn down. */
  private alive(): boolean {
    return this.container.active && this.label.active && this.cashLabel.active && !!this.clockText?.active && this.scene.sys.isActive();
  }

  private refreshCash(cash: number): void {
    this.lastCash = cash;
    this.cashLabel.setText(`$${cash}`);
    const lab = this.mode === 'labeled';
    this.cashPlate.setSize(Math.max(this.cashLabel.width + 10, lab ? tinyWidth('CASH') + 8 : 0), lab ? 20 : 14);
    this.tokens.x = this.cashPlate.width + 3;
    this.layoutSlots();
  }

  /** Classic, the hunt, or labeled (see `hudMode`): lay the HUD out for it. */
  private applyMode(): void {
    this.mode = hudMode();
    const lab = this.mode === 'labeled';
    const hunt = this.mode === 'hunt';
    this.container.setVisible(!hunt);
    this.objective.setVisible(hunt);
    if (hunt) {
      // Under GOALS and the pockets, on the right, two short lines -- not
      // across the top-left where the purse goes.
      this.objectiveText.setText(store.get().disguised ? 'NEW FACE\nBACK TO THE ARCADE' : "REACH SHARP'S\n(EAST) UNSEEN");
      this.objectiveText.setCenterAlign?.();
      const w = this.objectiveText.width + 10;
      const h = this.objectiveText.height + 5;
      (this.objective.getData('plate') as Phaser.GameObjects.Rectangle).setSize(w, h);
      this.objective.setPosition(GAME_W - 4 - w, OBJECTIVE_Y);
    }
    // the value goes under its name
    const vy = lab ? 10 : 3;
    this.cashLabel.setY(vy);
    this.label.setY(vy);
    this.coin.setY(lab ? 13 : 7);
    this.timeBox.setVisible(lab);
    this.lifeBox?.setY(lab ? 23 : 16);
    this.refreshCash(store.get().cash);
    this.refresh(ledger.balance());
  }

  /** The slot names, over each value, and the TIME LEFT slot after the tokens. */
  private layoutSlots(): void {
    if (!this.slotNames?.active) return;
    this.slotNames.clear();
    if (this.mode !== 'labeled') return;
    this.plate.setSize(Math.max(this.plate.width, tinyWidth('TOKENS') + 8), 20);
    this.timeText.setText(timeLeft());
    this.timePlate.setSize(Math.max(this.timeText.width, tinyWidth('TIME LEFT')) + 10, 20);
    this.timeBox.x = this.tokens.x + this.plate.width + 3;
    tinyText(this.slotNames, 'CASH', 4, 3, PALETTE.ash);
    tinyText(this.slotNames, 'TOKENS', this.tokens.x + 4, 3, PALETTE.ash);
    tinyText(this.slotNames, 'TIME LEFT', this.timeBox.x + 4, 3, PALETTE.ash);
  }

  /**
   * Back, with a flourish: outside the arcade, the hunt over, the HUD drops
   * in from the top with a flash on each slot.
   */
  revealIn(): void {
    this.applyMode();
    const y = this.container.y;
    this.container.setY(y - 30).setAlpha(0);
    this.scene.tweens.add({ targets: this.container, y, alpha: 1, duration: 600, ease: 'Back.easeOut' });
    const flash = this.scene.add.rectangle(4, 4, this.timeBox.x + this.timePlate.width, 20, 0xffffff, 0.5).setOrigin(0, 0).setDepth(951).setScrollFactor(0);
    this.scene.tweens.add({ targets: flash, alpha: 0, delay: 500, duration: 700, onComplete: () => flash.destroy() });
  }

  private onChange(next: number, prev: number): void {
    this.refresh(next);
    // Coin-spin: squash the coin on its Y axis, which reads as a spin at 4px.
    this.scene.tweens.add({
      targets: this.coin,
      scaleX: 0.1,
      duration: 90,
      yoyo: true,
      repeat: 1,
      ease: 'Quad.easeInOut',
    });
    audio.sfx(next > prev ? 'coin_spin' : 'coin_drop');
  }

  private refresh(v: number): void {
    // just the number: the Froggy token beside it says what it counts
    this.label.setText(`${v}`);
    // The plate tracks the label rather than assuming a width: a four-digit
    // balance is reachable.
    this.plate.setSize(LABEL_X + this.label.width + 5, this.mode === 'labeled' ? 20 : 14);
    this.layoutSlots();

    const low = v <= LOW_TOKEN_THRESHOLD;
    this.label.setTint(low ? PALETTE.blood : PALETTE.cream);
    if (low !== this.coinLow) {
      this.coinLow = low;
      drawFrogToken(this.coin, low);
    }

    if (low && !this.pulse) {
      this.pulse = this.scene.tweens.add({
        targets: this.tokens,
        alpha: 0.45,
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    } else if (!low && this.pulse) {
      this.pulse.stop();
      this.pulse = undefined;
      this.tokens.setAlpha(1);
    }
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v);
  }

  /** The day, the time and the rent, small, under the purse. */
  private buildLife(): void {
    const plate = this.scene.add.rectangle(0, 0, 60, 9, PALETTE.black, 0.6).setOrigin(0, 0);
    this.clockText = text(this.scene, 3, 1, '', PALETTE.fog);
    this.lifeBox = this.scene.add.container(0, 16, [plate, this.clockText]);
    this.lifePlate = plate;
    this.container.add(this.lifeBox);
    this.refreshLife();
  }

  private refreshLife(): void {
    const s = store.get();
    // (and not from going to sleep in 612 until the night is survived: the
    // knocking, 3 AM, waking, the stairs, the storage room, the police and
    // the roofs -- that night has no clock on it, and this is read off the
    // story's own state, not a timer)
    const night = s.hotelNight || s.hotelAfter === 'police' || s.hotelAfter === 'escape';
    const on = s.seenIntro && s.route === 'normal' && s.timeOfDay !== 'midnight' && !night;
    this.lifeBox.setVisible(on);
    if (!on) return;
    const l = s.life;
    const c = clock(l.t);
    const rent = rentLabel(l);
    this.clockText.setText(rent ? `DAY ${c.day + 1} ${c.text} - ${rent.text}` : `DAY ${c.day + 1} ${c.text}`);
    this.clockText.setTint(rent?.warn ? PALETTE.gold : PALETTE.fog);
    this.lifePlate.width = this.clockText.width + 6;
    if (this.mode === 'labeled') this.layoutSlots();
    const n = takeNotice();
    if (n) this.showToast(n);
  }

  /** A life notice, along the bottom for a few seconds. */
  private showToast(msg: string): void {
    this.toast?.destroy();
    const t = text(this.scene, 160, 0, msg, PALETTE.cream).setOrigin(0.5, 0.5);
    const w = Math.min(312, t.width + 10);
    const plate = this.scene.add.rectangle(160, 0, w, 12, PALETTE.black, 0.8).setStrokeStyle(1, PALETTE.gold);
    this.toast = this.scene.add.container(0, 150, [plate, t]).setDepth(960).setScrollFactor(0);
    const toast = this.toast;
    this.scene.tweens.add({ targets: toast, alpha: 0, delay: 3800, duration: 600, onComplete: () => toast.destroy() });
  }
}
