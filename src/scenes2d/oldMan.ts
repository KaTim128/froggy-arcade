/**
 * THE OLD MAN who sleeps rough outside HOME AND HEARTH: sat on his blanket
 * under the shop's right-hand window, his cardboard sign propped against the
 * wall, saving to get off the street.  Talk to him and he warns you about
 * the night thieves, and takes what you can give; at $500 he thanks you,
 * gets up and walks away for good (a badge for the good heart).
 *
 * His place is fixed to the shopfront, not to you: `placeOldMan` picks the
 * spot under the window, moved along only as far as it takes to keep clear
 * of the doors, the alley mouths and anyone else standing in the street.
 */

import Phaser from 'phaser';
import { audio } from '../core/audio';
import { pinToScreen } from '../core/ui';
import { store } from '../core/state';
import { Player } from '../art/player';
import { HOMELESS_LOOK } from '../art/staffLooks';
import { earnBadge } from '../game/badges';
import { donate, HOMELESS_GOAL } from '../game/life';
import { openTalkPanel, speak } from '../ui/talkPanel';

export const OLD_SPEAKER = { name: 'OLD MAN', color: 0xe8a050, well: 0x2a1a10, look: HOMELESS_LOOK };

/** His figure, blanket and sign together, wide. */
const OLD_W = 26;

/**
 * Where he sits: `want` if that is clear, else the nearest x either side of
 * it that keeps his whole width (and a step either side) off every `keepOff`
 * span -- doors, alley mouths, other people's spots.
 */
export function placeOldMan(want: number, keepOff: { x: number; half: number }[], min: number, max: number): number {
  const clear = (x: number) => x - OLD_W / 2 >= min && x + OLD_W / 2 <= max && keepOff.every((k) => Math.abs(x - k.x) >= k.half + OLD_W / 2 + 2);
  for (let d = 0; d < max - min; d++) {
    if (clear(want - d)) return want - d;
    if (clear(want + d)) return want + d;
  }
  return want;
}

export interface OldManHost {
  scene: Phaser.Scene;
  talking: () => boolean;
  setTalking: (c: Phaser.GameObjects.Container | null) => void;
  lock: (on: boolean) => void;
  say: (m: string) => void;
  /** After he has gone: repaint the street without him. */
  gone: () => void;
}

export class OldMan {
  readonly x: number;
  private fig: Player;
  private parts: Phaser.GameObjects.GameObject[] = [];

  /** Null once he is off the street. */
  static paint(host: OldManHost, x: number, y: number, dark: boolean, onTap: () => void): OldMan | null {
    if (store.get().life.donated >= HOMELESS_GOAL) return null;
    return new OldMan(host, x, y, dark, onTap);
  }

  private constructor(
    private host: OldManHost,
    x: number,
    private y: number,
    dark: boolean,
    onTap: () => void,
  ) {
    this.x = x;
    const s = host.scene;
    // everything of his sits on the wall line, BEHIND the pavement: the
    // player and people walking past (depthFor ~50.1) go in front of him,
    // his bench and his sign, never under them
    const g = s.add.graphics().setDepth(49.5);
    g.fillStyle(0x14100c, 1).fillRect(x - 16, y - 2, 24, 5);
    g.fillStyle(0x5a5a66, 1).fillRect(x - 15, y - 1, 22, 3);
    g.fillStyle(0x7a7a86, 1).fillRect(x - 15, y - 1, 22, 1);
    for (let k = x - 13; k < x + 6; k += 5) g.fillStyle(0x3a3a46, 1).fillRect(k, y, 1, 2);
    // his sign, propped against the wall behind him
    const sg = s.add.graphics().setDepth(49.4);
    sg.fillStyle(0x14100c, 1).fillRect(x + 1, y - 24, 12, 11);
    sg.fillStyle(0xb08a58, 1).fillRect(x + 2, y - 23, 10, 9);
    sg.fillStyle(0x3a2a18, 1).fillRect(x + 4, y - 21, 6, 1).fillRect(x + 3, y - 19, 8, 1).fillRect(x + 4, y - 17, 5, 1);
    this.fig = new Player(s, x, y, dark, HOMELESS_LOOK);
    this.fig.sit('floor', { facing: -1 });
    this.fig.sprite.setDepth(49.6);
    const z = s.add.zone(x - 14, y - 26, 24, 30).setOrigin(0, 0).setDepth(61).setInteractive({ useHandCursor: true }).on('pointerdown', onTap);
    this.parts.push(g, sg, z);
  }

  /** Stood close enough to talk to him. */
  near(px: number): boolean {
    return Math.abs(px - (this.x + 4)) < 10;
  }

  /** Where you walk to, to talk to him. */
  get standX(): number {
    return this.x + 6;
  }

  /**
   * TALKING TO HIM: the warning about the night, where his savings have got
   * to, and what you can give.  Never more than you have, never more than
   * he still needs.
   */
  talk(lead?: string): void {
    const h = this.host;
    if (h.talking()) return;
    // (the street scrolls under the camera: the panel stays on the screen)
    const set = h.setTalking;
    const pinned: OldManHost['setTalking'] = (c) => set(c && pinToScreen(c));
    const got = store.get().life.donated;
    const left = HOMELESS_GOAL - got;
    const line =
      (lead ?? `"Watch your money if you're sleeping out here. Thieves come around at night. I lost some of mine while I was asleep."`) +
      ` "I'm saving to get off the street: $${got} given, $${left} to go."`;
    const give = (n: number) => () => {
      h.setTalking(null);
      const cash = store.get().cash;
      const want = Math.min(n, HOMELESS_GOAL - store.get().life.donated);
      if (cash < want) {
        h.say(cash > 0 ? `YOU ONLY HAVE $${cash}.` : 'YOU HAVE NO CASH TO GIVE.');
        return;
      }
      const given = donate(want);
      if (!given) return;
      audio.sfx('coin_drop', 0.6);
      if (store.get().life.donated >= HOMELESS_GOAL) return this.leave();
      const thanks = given >= 50 ? '"That\'s... that\'s a lot. Thank you, really."' : given >= 20 ? '"Bless you. That\'s a hot meal and then some."' : '"Every bit counts. Thank you, friend."';
      h.scene.time.delayedCall(80, () => this.talk(thanks));
    };
    const step = (n: number) => Math.min(n, left);
    pinned(
      openTalkPanel(h.scene, {
        speaker: OLD_SPEAKER,
        line,
        depth: 950,
        options: [
          { label: `GIVE $${step(5)}`, fn: give(5) },
          { label: `GIVE $${step(20)}`, fn: give(20) },
          { label: `GIVE $${step(50)}`, fn: give(50) },
          { label: 'LEAVE', fn: () => h.setTalking(null) },
        ],
      }),
    );
  }

  /** $500: off the street.  He thanks you, gets up, and walks away for good. */
  private leave(): void {
    const h = this.host;
    const p = this.fig;
    h.lock(true);
    earnBadge('good_heart', h.scene);
    h.setTalking(
      pinToScreen(speak(h.scene, OLD_SPEAKER, '"Thank you. You\'ve given me a chance to start over. I\'ll never forget what you\'ve done for me."', () => {
        h.setTalking(null);
        p.getUp();
        const lane = new Phaser.Geom.Rectangle(-40, this.y, 2000, 0);
        h.scene.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 2400,
          onUpdate: () => p.move(-1, 0, 16, lane),
          onComplete: () => {
            p.sprite.destroy();
            for (const o of this.parts) o.destroy();
            h.lock(false);
            h.gone();
          },
        });
      })),
    );
  }
}
