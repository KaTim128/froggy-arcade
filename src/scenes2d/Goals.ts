/**
 * ---- GOALS.  Today's three, and the achievements that never reset -- with
 * how far along each is, what it pays, and a CLAIM that pays it once.  Days
 * turn over on the real calendar (see game/life `refreshGoals`).  THIS WEEK
 * is gone (log #83); the achievements are a list that scrolls, a row each with
 * room for the reward under its name and CLAIM clear of both.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { button, centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { ACHIEVEMENTS, GOALS, achievementProgress, claimAchievement, claimGoal, refreshGoals, type Reward } from '../game/life';
import { cosmeticById, furnitureById } from '../game/catalog';

const rewardText = (r: Reward): string => {
  const bits: string[] = [];
  if (r.cash) bits.push(`$${r.cash}`);
  if (r.tokens) bits.push(`${r.tokens} TOK`);
  if (r.furniture) bits.push(furnitureById(r.furniture)?.name ?? '');
  if (r.cosmetic) bits.push(cosmeticById(r.cosmetic)?.name ?? '');
  return bits.join(', ');
};

/** The achievements' window on the card, and one row of it. */
const LIST_TOP = 48;
// (and clear of the pocket in the bottom-left corner, which is over every card)
const LIST_BOTTOM = 150;
const ROW_H = 30;
/** The right-hand column: CLAIM, then a clear gap, then the scroll bar. */
const CLAIM_X = 262;
const CLAIM_W = 44;
const BAR_X = 302;

export class Goals extends Phaser.Scene {
  private tab: 'daily' | 'achievements' = 'daily';
  private from = '';
  private layer!: Phaser.GameObjects.Container;
  private msg = '';
  /** How far down the achievements are scrolled, kept while the card is up. */
  private top = 0;
  private list: Phaser.GameObjects.Container | null = null;
  private claims: Array<{ btn: Phaser.GameObjects.Container; y: number }> = [];
  private listH = 0;
  private up: Phaser.GameObjects.Container | null = null;
  private down: Phaser.GameObjects.Container | null = null;
  private thumb: Phaser.GameObjects.Rectangle | null = null;

  constructor() {
    super('Goals');
  }

  init(data: { from?: string }): void {
    this.from = data.from ?? '';
    this.msg = '';
    this.top = 0;
  }

  create(): void {
    // OVER WHOEVER OPENED IT.  Scenes draw in the order they were registered,
    // and this one is registered before some of the rooms that open it -- the
    // condo reception among them -- so launched from there it was drawn
    // underneath the room: the pad went away for it, and nothing appeared.
    this.scene.bringToTop();
    refreshGoals();
    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.88).setOrigin(0, 0).setInteractive();
    this.add.rectangle(6, 6, GAME_W - 12, GAME_H - 12, PALETTE.ink, 0.97).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold);
    this.layer = this.add.container(0, 0);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.input.keyboard?.on('keydown-J', () => this.close());
    // the list: the wheel, a drag down it, the arrow keys
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scroll(dy > 0 ? ROW_H : -ROW_H));
    let dragY: number | null = null;
    let dragged = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragY = p.y >= LIST_TOP && p.y <= LIST_BOTTOM ? p.y : null;
      dragged = 0;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragY === null || !p.isDown) return;
      dragged += Math.abs(p.y - dragY);
      // (a press that wanders a pixel or two is still a press on CLAIM)
      if (dragged > 3) this.scroll(dragY - p.y);
      dragY = p.y;
    });
    this.input.on('pointerup', () => {
      // (let go: settle on the nearest whole row)
      if (dragY !== null && dragged > 3 && this.list) this.scroll(Math.round(this.top / ROW_H) * ROW_H - this.top);
      dragY = null;
    });
    for (const [k, d] of [['UP', -ROW_H], ['DOWN', ROW_H], ['W', -ROW_H], ['S', ROW_H]] as const) this.input.keyboard?.on(`keydown-${k}`, () => this.scroll(d));
    this.draw();
  }

  private close(): void {
    this.scene.get(this.from)?.events.emit('goals-closed');
    this.scene.stop();
  }

  private draw(): void {
    this.layer.removeAll(true);
    this.list?.destroy(true);
    this.list = null;
    this.claims = [];
    this.up = this.down = null;
    this.thumb = null;
    const L = this.layer;
    const l = store.get().life;
    L.add(text(this, 14, 11, 'GOALS', PALETTE.gold));
    L.add(button(this, GAME_W - 36, 16, 'CLOSE', () => this.close(), { width: 48, height: 13 }));
    const tabs: Array<[typeof this.tab, string]> = [['daily', 'TODAY'], ['achievements', 'ACHIEVEMENTS']];
    // (ending short of the scroll bar's column, so nothing touches its arrow)
    const tw = Math.floor((BAR_X - 12 - 14) / tabs.length);
    tabs.forEach(([k, label], i) =>
      L.add(button(this, 14 + tw * i + tw / 2, 36, label, () => {
        this.tab = k;
        this.msg = '';
        this.top = 0;
        this.draw();
      }, { width: tw - 8, height: 13, fill: k === this.tab ? PALETTE.tealDark : PALETTE.ink })),
    );

    if (this.tab === 'daily') {
      const p = l.daily;
      p.ids.forEach((id, i) => {
        const g = GOALS.find((x) => x.id === id);
        if (!g) return;
        const y = 52 + i * 32;
        const prog = Math.min(g.need, p.prog[id] ?? 0);
        const done = prog >= g.need;
        const claimed = p.claimed.includes(id);
        L.add(text(this, 14, y, g.text, claimed ? PALETTE.ash : done ? PALETTE.gold : PALETTE.cream));
        L.add(text(this, 20, y + 11, rewardText(g.reward), PALETTE.mossLight));
        L.add(text(this, CLAIM_X - CLAIM_W / 2 - 10, y + 11, `${prog}/${g.need}`, PALETTE.fog).setOrigin(1, 0));
        if (claimed) L.add(text(this, CLAIM_X, y + 6, 'CLAIMED', PALETTE.ash).setOrigin(0.5, 0));
        else L.add(button(this, CLAIM_X, y + 9, 'CLAIM', () => this.result(claimGoal('daily', id)), { width: CLAIM_W, height: 13, disabled: !done }));
      });
      L.add(centerText(this, GAME_W / 2, 152, 'NEW GOALS EVERY DAY AT MIDNIGHT.', PALETTE.ash));
    } else this.drawAchievements(l);
    if (this.msg) L.add(centerText(this, GAME_W / 2, 167, this.msg, PALETTE.gold));
  }

  /** The achievements: a row each in a window that scrolls. */
  private drawAchievements(l: ReturnType<typeof store.get>['life']): void {
    const list = this.add.container(0, LIST_TOP);
    this.list = list;
    ACHIEVEMENTS.forEach((a, i) => {
      const y = i * ROW_H;
      const prog = achievementProgress(a, l.stats);
      const done = prog >= a.need;
      const claimed = l.achieved.includes(a.id);
      // a faint rule between rows, so each reward is plainly its own row's
      if (i > 0) list.add(this.add.rectangle(14, y - 4, CLAIM_X + CLAIM_W / 2 - 14, 1, PALETTE.slate, 0.6).setOrigin(0, 0));
      list.add(text(this, 14, y + 2, a.text, claimed ? PALETTE.ash : done ? PALETTE.gold : PALETTE.cream));
      list.add(text(this, 20, y + 13, rewardText(a.reward), claimed ? PALETTE.ash : PALETTE.mossLight));
      list.add(text(this, CLAIM_X - CLAIM_W / 2 - 10, y + 13, `${prog}/${a.need}`, PALETTE.fog).setOrigin(1, 0));
      if (claimed) list.add(text(this, CLAIM_X, y + 8, 'CLAIMED', PALETTE.ash).setOrigin(0.5, 0));
      else {
        const btn = button(this, CLAIM_X, y + 11, 'CLAIM', () => this.result(claimAchievement(a.id)), { width: CLAIM_W, height: 13, disabled: !done });
        list.add(btn);
        this.claims.push({ btn, y: y + 11 });
      }
    });
    this.listH = ACHIEVEMENTS.length * ROW_H;
    const m = this.make.graphics({}, false).fillRect(0, LIST_TOP - 1, GAME_W, LIST_BOTTOM - LIST_TOP + 1);
    list.setMask(m.createGeometryMask());
    // the scroll bar: an arrow each end and, between them, where you are
    this.up = button(this, BAR_X, LIST_TOP + 4, '^', () => this.scroll(-ROW_H), { width: 12, height: 12 });
    this.down = button(this, BAR_X, LIST_BOTTOM - 6, 'v', () => this.scroll(ROW_H), { width: 12, height: 12 });
    const trackTop = LIST_TOP + 14;
    const trackH = LIST_BOTTOM - LIST_TOP - 26;
    const track = this.add.rectangle(BAR_X, trackTop, 2, trackH, PALETTE.slate).setOrigin(0.5, 0);
    const view = (LIST_BOTTOM - LIST_TOP) / Math.max(1, this.listH);
    this.thumb = this.add.rectangle(BAR_X, trackTop, 4, Math.max(8, Math.round(trackH * Math.min(1, view))), PALETTE.neon).setOrigin(0.5, 0);
    this.layer.add([track, this.thumb, this.up, this.down]);
    this.scroll(0);
  }

  /** As far as it goes, in whole rows: the top of the window is always the top of a row. */
  private most(): number {
    return Math.ceil(Math.max(0, this.listH - (LIST_BOTTOM - LIST_TOP)) / ROW_H) * ROW_H;
  }

  private scroll(d: number): void {
    if (!this.list) return;
    this.top = Phaser.Math.Clamp(this.top + d, 0, this.most());
    this.list.y = Math.round(LIST_TOP - this.top);
    // (a mask hides a button but does not stop it being pressed: one scrolled
    // out of the window is switched off until it is back in it)
    for (const c of this.claims) {
      const at = LIST_TOP - this.top + c.y;
      const shown = at - 6 >= LIST_TOP - 1 && at + 6 <= LIST_BOTTOM;
      if (c.btn.input) c.btn.input.enabled = shown;
    }
    if (this.thumb) {
      const trackTop = LIST_TOP + 14;
      const room = LIST_BOTTOM - LIST_TOP - 26 - this.thumb.height;
      this.thumb.y = Math.round(trackTop + (this.most() ? (this.top / this.most()) * room : 0));
    }
    this.up?.setAlpha(this.top > 0 ? 1 : 0.35);
    this.down?.setAlpha(this.top < this.most() ? 1 : 0.35);
  }

  /** For the harness: how far down the achievements are, and how far they go. */
  scrolled(): { top: number; most: number } {
    return { top: this.top, most: this.most() };
  }

  private result(r: { ok: boolean; msg: string }): void {
    this.msg = r.msg;
    audio.sfx(r.ok ? 'cha_ching' : 'buzzer', 0.6);
    const keep = this.top;
    this.draw();
    if (this.tab === 'achievements') this.scroll(keep - this.top);
  }
}
