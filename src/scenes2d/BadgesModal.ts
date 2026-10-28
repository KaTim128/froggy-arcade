/**
 * ---- BADGES, from the title screen's top-right corner (log #59, #60, #64).
 * The active profile's badges, a box each: its own medal, its name, and what
 * it asks for.  Earned ones are in their colour; locked ones are grey with
 * the requirement in place of what was done -- and a SECRET is ??? all
 * through until it is found.  One list, no headings, that scrolls (the
 * wheel, a drag, or the arrows).  Achievements are not here -- they are the Goals card's, in play.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { button, centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { BADGES } from '../game/badges';
import { drawBadgeIcon } from '../game/badgeIcons';


/** The list's window on the panel. */
const TOP = 34;
const BOTTOM = 154;
const LEFT = 22;
const BOX_W = GAME_W - 2 * LEFT - 14;
/** Characters a description line holds beside the medal. */
const COLS = Math.floor((BOX_W - 34) / 6);

/** `s` broken into lines of at most `n` characters, at the spaces. */
function wrap(s: string, n: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of s.split(' ')) {
    if (line && line.length + 1 + w.length > n) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}

export class BadgesModal extends Phaser.Scene {
  private from = 'StartScreen';
  private list!: Phaser.GameObjects.Container;
  private height = 0;
  private top = 0;
  private up?: Phaser.GameObjects.Container;
  private down?: Phaser.GameObjects.Container;

  constructor() {
    super('BadgesModal');
  }

  init(data: { from?: string } = {}): void {
    this.from = data.from ?? 'StartScreen';
    this.top = 0;
  }

  create(): void {
    this.scene.bringToTop();
    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.7).setOrigin(0, 0).setInteractive();
    this.add.rectangle(12, 6, GAME_W - 24, GAME_H - 12, PALETTE.ink, 0.97).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold);
    const name = store.activeSlotName();
    const got = new Set(store.get().badges);
    const known = BADGES.filter((b) => got.has(b.id)).length;
    centerText(this, GAME_W / 2, 15, name ? `BADGES - ${name}` : 'BADGES', PALETTE.gold);
    centerText(this, GAME_W / 2, 25, `${known} OF ${BADGES.length} EARNED`, PALETTE.ash);
    button(this, GAME_W / 2, GAME_H - 15, 'BACK', () => this.close(), { width: 60, height: 13 });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    if (!name) {
      centerText(this, GAME_W / 2, 90, 'CHOOSE A PROFILE TO SEE ITS BADGES.', PALETTE.cream);
      return;
    }
    this.list = this.add.container(0, TOP);
    // one list, every badge alike: no headings saying which are the story's
    // and which a machine's (the user's call) -- just the badges
    let y = 0;
    for (const b of BADGES) y += this.box(b, y, got.has(b.id)) + 3;
    this.height = y;
    // only what is inside the window shows
    const m = this.make.graphics({}, false).fillRect(0, TOP, GAME_W, BOTTOM - TOP);
    this.list.setMask(m.createGeometryMask());
    this.up = button(this, GAME_W - 24, TOP + 6, '^', () => this.scroll(-30), { width: 12, height: 12 });
    this.down = button(this, GAME_W - 24, BOTTOM - 6, 'v', () => this.scroll(30), { width: 12, height: 12 });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scroll(dy > 0 ? 24 : -24));
    let dragY: number | null = null;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragY = p.y >= TOP && p.y <= BOTTOM ? p.y : null;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragY === null || !p.isDown) return;
      this.scroll(dragY - p.y);
      dragY = p.y;
    });
    this.input.on('pointerup', () => (dragY = null));
    this.input.keyboard?.on('keydown-UP', () => this.scroll(-24));
    this.input.keyboard?.on('keydown-DOWN', () => this.scroll(24));
    this.input.keyboard?.on('keydown-W', () => this.scroll(-24));
    this.input.keyboard?.on('keydown-S', () => this.scroll(24));
    this.scroll(0);
  }

  /** One badge's box at `y` in the list; returns its height. */
  private box(b: (typeof BADGES)[number], y: number, have: boolean): number {
    const secret = b.kind === 'secret' && !have;
    const lines = wrap(secret ? 'KEEP YOUR EYES OPEN. NOBODY WILL TELL YOU.' : have ? b.desc : b.hint, COLS).slice(0, 2);
    const h = 13 + lines.length * 8 + 2;
    const edge = have ? b.col : 0x3a414c;
    this.list.add(this.add.rectangle(LEFT, y, BOX_W, h, have ? 0x1a1610 : 0x12151b, 1).setOrigin(0, 0).setStrokeStyle(1, edge));
    const g = this.add.graphics();
    if (secret) {
      // nothing given away, not even the picture
      g.fillStyle(0x262b34, 1).fillCircle(LEFT + 15, y + h / 2, 10);
      g.lineStyle(1, 0x3a414c, 1).strokeCircle(LEFT + 15, y + h / 2, 10);
      this.list.add(g);
      this.list.add(centerText(this, LEFT + 15, y + h / 2, '?', PALETTE.steel));
    } else {
      drawBadgeIcon(g, b.id, LEFT + 15, y + h / 2, 10, b.col, !have);
      this.list.add(g);
    }
    this.list.add(text(this, LEFT + 30, y + 3, secret ? '???' : b.name, have ? PALETTE.cream : PALETTE.steel));
    if (have) this.list.add(text(this, LEFT + BOX_W - 4, y + 3, 'EARNED', PALETTE.mossLight).setOrigin(1, 0));
    else this.list.add(text(this, LEFT + BOX_W - 4, y + 3, 'LOCKED', 0x5a6070).setOrigin(1, 0));
    lines.forEach((l, i) => this.list.add(text(this, LEFT + 30, y + 12 + i * 8, l, have ? PALETTE.ash : 0x6a7080)));
    return h;
  }

  private scroll(d: number): void {
    const most = Math.max(0, this.height - (BOTTOM - TOP));
    this.top = Phaser.Math.Clamp(this.top + d, 0, most);
    this.list.y = Math.round(TOP - this.top);
    this.up?.setAlpha(this.top > 0 ? 1 : 0.35);
    this.down?.setAlpha(this.top < most ? 1 : 0.35);
  }

  /** For the harness: how far down it is, and how far it can go. */
  scrolled(): { top: number; most: number } {
    return { top: this.top, most: Math.max(0, this.height - (BOTTOM - TOP)) };
  }

  private close(): void {
    audio.sfx('ui_blip', 0.4);
    this.scene.get(this.from)?.events.emit('badges-closed');
    this.scene.stop();
  }
}
