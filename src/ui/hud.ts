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
import { clock, rentInDays, takeNotice } from '../game/life';

export const LOW_TOKEN_THRESHOLD = 3;

/** Left edge of the label, clear of the coin (within the token plate). */
const LABEL_X = 15;

export class TokenHud {
  private scene: Phaser.Scene;
  private cashPlate: Phaser.GameObjects.Rectangle;
  private cashLabel: Phaser.GameObjects.BitmapText;
  private tokens: Phaser.GameObjects.Container;
  private plate: Phaser.GameObjects.Rectangle;
  private coin: Phaser.GameObjects.Arc;
  private label: Phaser.GameObjects.BitmapText;
  private container: Phaser.GameObjects.Container;
  private unsub: () => void;
  private pulse?: Phaser.Tweens.Tween;
  private lastCash = -1;
  private clockText!: Phaser.GameObjects.BitmapText;
  private lifeBox!: Phaser.GameObjects.Container;
  private toast: Phaser.GameObjects.Container | null = null;
  private lifePlate!: Phaser.GameObjects.Rectangle;

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
    this.coin = scene.add.circle(7, 7, 4, PALETTE.gold);
    this.label = text(scene, LABEL_X, 3, '', PALETTE.cream);
    this.tokens = scene.add.container(0, 0, [this.plate, this.coin, this.label]);

    this.container = scene.add.container(at.x ?? 4, at.y ?? 4, [this.cashPlate, this.cashLabel, this.tokens]);
    this.container.setDepth(950).setScrollFactor(0);
    this.buildLife();

    this.unsub = ledger.onChange((next, prev) => this.onChange(next, prev));
    const unStore = store.subscribe((st) => {
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

  private refreshCash(cash: number): void {
    this.lastCash = cash;
    this.cashLabel.setText(`$${cash}`);
    this.cashPlate.setSize(this.cashLabel.width + 10, 14);
    this.tokens.x = this.cashPlate.width + 3;
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
    this.label.setText(`${v} TOK`);
    // The plate tracks the label rather than assuming a width: a four-digit
    // balance is reachable, and the old fixed 54px clipped the K off ' TOK'.
    this.plate.setSize(LABEL_X + this.label.width + 5, 14);

    const low = v <= LOW_TOKEN_THRESHOLD;
    this.label.setTint(low ? PALETTE.blood : PALETTE.cream);
    this.coin.setFillStyle(low ? PALETTE.ember : PALETTE.gold);

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
    const on = s.seenIntro && s.route === 'normal' && s.timeOfDay !== 'midnight';
    this.lifeBox.setVisible(on);
    if (!on) return;
    const l = s.life;
    const c = clock(l.t);
    const rent = l.rented ? (rentInDays(l) <= 0 ? 'RENT DUE' : `RENT ${rentInDays(l)}D`) : '';
    this.clockText.setText(rent ? `DAY ${c.day + 1} ${c.text}  ${rent}` : `DAY ${c.day + 1} ${c.text}`);
    this.lifePlate.width = this.clockText.width + 6;
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
