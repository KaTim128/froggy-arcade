/**
 * ---- BADGE UNLOCKED (log #59).  A plate that slides down from the top of the
 * screen with the badge's own medal, the words BADGE UNLOCKED, its name and
 * what it was for, holds long enough to be read, and slides away.  Two at
 * once come one after the other, never on top of each other.
 *
 * A scene of its own, kept on top of everything, so it carries on across a
 * change of room and is never under a cabinet's picture.  It takes no input:
 * nothing underneath is ever blocked by it.  A rare badge (mastery, secret,
 * Creature Clash) gets the gold edge, a sparkle and the fanfare.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import { drawBadgeIcon, isRare } from '../game/badgeIcons';

export interface ToastBadge {
  id: string;
  name: string;
  desc: string;
  col: number;
}

/** How long a plate stays down, once it is down. */
const HOLD_MS = 3400;
const W = 236;
const H = 30;

export class BadgeToast extends Phaser.Scene {
  private queue: ToastBadge[] = [];
  private showing = false;

  constructor() {
    super({ key: 'BadgeToast', active: false });
  }

  create(): void {
    this.showing = false;
    this.input.enabled = false;
    this.next();
  }

  /** Another one: shown now, or after the one that is down. */
  push(b: ToastBadge): void {
    this.queue.push(b);
    this.scene.bringToTop();
    if (!this.showing) this.next();
  }

  /** For the harness: what is waiting, and what is down. */
  pending(): number {
    return this.queue.length + (this.showing ? 1 : 0);
  }

  private next(): void {
    const b = this.queue.shift();
    if (!b) {
      this.showing = false;
      return;
    }
    this.showing = true;
    this.scene.bringToTop();
    const rare = isRare(b.id);
    const edge = rare ? 0xffd45e : b.col;
    const parts: Phaser.GameObjects.GameObject[] = [];
    parts.push(this.add.rectangle(0, 0, W, H, 0x100c08, 0.95).setStrokeStyle(1, edge));
    if (rare) parts.push(this.add.rectangle(0, 0, W - 4, H - 4, 0x000000, 0).setStrokeStyle(1, 0x8a6a1a));
    const g = this.add.graphics();
    drawBadgeIcon(g, b.id, -W / 2 + 17, 0, 10, b.col);
    parts.push(g);
    parts.push(centerText(this, 14, -9, 'BADGE UNLOCKED', edge));
    parts.push(centerText(this, 14, 0, b.name, PALETTE.cream));
    const desc = b.desc.length > 36 ? `${b.desc.slice(0, 35)}.` : b.desc;
    parts.push(centerText(this, 14, 9, desc, PALETTE.ash));
    const c = this.add.container(GAME_W / 2, -H, parts).setDepth(5000);
    audio.sfx(rare ? 'bell_ding' : 'ticket_machine', rare ? 0.55 : 0.4);
    if (rare) audio.sfx('chime', 0.4);
    // down, with a little overshoot, and the medal turns once as it lands
    this.tweens.add({ targets: c, y: H / 2 + 3, duration: 460, ease: 'Back.easeOut' });
    this.tweens.add({ targets: g, scaleX: { from: 0.1, to: 1 }, duration: 420, delay: 300, ease: 'Back.easeOut' });
    if (rare) {
      // a glint across the plate
      const glint = this.add.rectangle(-W / 2, 0, 6, H - 2, 0xfff2b0, 0.35);
      c.add(glint);
      this.tweens.add({ targets: glint, x: W / 2, duration: 700, delay: 520, ease: 'Sine.easeInOut', onComplete: () => glint.destroy() });
    }
    this.tweens.add({
      targets: c,
      y: -H,
      delay: 460 + HOLD_MS,
      duration: 380,
      ease: 'Sine.easeIn',
      onComplete: () => {
        c.destroy();
        this.next();
      },
    });
  }
}
