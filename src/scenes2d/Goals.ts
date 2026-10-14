/**
 * ---- GOALS.  Today's three, this week's three, and the achievements that
 * never reset -- with how far along each is, what it pays, and a CLAIM that
 * pays it once.  Days and weeks turn over on the real calendar (see
 * game/life `refreshGoals`).
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { button, centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { ACHIEVEMENTS, GOALS, claimAchievement, claimGoal, refreshGoals, type Reward } from '../game/life';
import { cosmeticById, furnitureById } from '../game/catalog';

const rewardText = (r: Reward): string => {
  const bits: string[] = [];
  if (r.cash) bits.push(`$${r.cash}`);
  if (r.tokens) bits.push(`${r.tokens} TOK`);
  if (r.furniture) bits.push(furnitureById(r.furniture)?.name ?? '');
  if (r.cosmetic) bits.push(cosmeticById(r.cosmetic)?.name ?? '');
  return bits.join(', ');
};

export class Goals extends Phaser.Scene {
  private tab: 'daily' | 'weekly' | 'achievements' = 'daily';
  private from = '';
  private layer!: Phaser.GameObjects.Container;
  private msg = '';

  constructor() {
    super('Goals');
  }

  init(data: { from?: string }): void {
    this.from = data.from ?? '';
    this.msg = '';
  }

  create(): void {
    refreshGoals();
    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.88).setOrigin(0, 0).setInteractive();
    this.add.rectangle(6, 6, GAME_W - 12, GAME_H - 12, PALETTE.ink, 0.97).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold);
    this.layer = this.add.container(0, 0);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.input.keyboard?.on('keydown-J', () => this.close());
    this.draw();
  }

  private close(): void {
    this.scene.get(this.from)?.events.emit('goals-closed');
    this.scene.stop();
  }

  private draw(): void {
    this.layer.removeAll(true);
    const L = this.layer;
    const l = store.get().life;
    L.add(text(this, 14, 11, 'GOALS', PALETTE.gold));
    L.add(button(this, GAME_W - 34, 15, 'CLOSE', () => this.close(), { width: 48, height: 13 }));
    const tabs: Array<[typeof this.tab, string]> = [['daily', 'TODAY'], ['weekly', 'THIS WEEK'], ['achievements', 'ACHIEVEMENTS']];
    const tw = Math.floor((GAME_W - 28) / 3);
    tabs.forEach(([k, label], i) =>
      L.add(button(this, 14 + tw * i + tw / 2, 28, label, () => {
        this.tab = k;
        this.msg = '';
        this.draw();
      }, { width: tw - 4, height: 13, fill: k === this.tab ? PALETTE.tealDark : PALETTE.ink })),
    );

    type Line = { text: string; prog: number; need: number; reward: Reward; claimed: boolean; claim: () => void };
    const lines: Line[] = [];
    if (this.tab === 'achievements') {
      for (const a of ACHIEVEMENTS) {
        lines.push({
          text: a.text,
          prog: Math.min(a.need, l.stats[a.stat] ?? 0),
          need: a.need,
          reward: a.reward,
          claimed: l.achieved.includes(a.id),
          claim: () => this.result(claimAchievement(a.id)),
        });
      }
    } else {
      const p = l[this.tab];
      for (const id of p.ids) {
        const g = GOALS.find((x) => x.id === id);
        if (!g) continue;
        lines.push({
          text: g.text,
          prog: Math.min(g.need, p.prog[id] ?? 0),
          need: g.need,
          reward: g.reward,
          claimed: p.claimed.includes(id),
          claim: () => this.result(claimGoal(this.tab as 'daily' | 'weekly', id)),
        });
      }
      L.add(text(this, 14, 158, this.tab === 'daily' ? 'NEW GOALS EVERY DAY AT MIDNIGHT.' : 'NEW GOALS EVERY MONDAY.', PALETTE.ash));
    }
    // achievements: one row each, the count in its own column clear of the
    // longest name, and a CLAIM button tall enough for its word
    const rowH = this.tab === 'achievements' ? 13 : 30;
    lines.forEach((ln, i) => {
      const y = 42 + i * rowH;
      const done = ln.prog >= ln.need;
      L.add(text(this, 14, y, ln.text, ln.claimed ? PALETTE.ash : done ? PALETTE.gold : PALETTE.cream));
      L.add(text(this, 236, y, `${ln.prog}/${ln.need}`, PALETTE.fog).setOrigin(1, 0));
      if (this.tab !== 'achievements') L.add(text(this, 20, y + 10, rewardText(ln.reward), PALETTE.mossLight));
      if (ln.claimed) L.add(text(this, 278, y, 'CLAIMED', PALETTE.ash).setOrigin(0.5, 0));
      else L.add(button(this, 278, y + 3, 'CLAIM', ln.claim, { width: 52, height: 12, disabled: !done }));
    });
    if (this.msg) L.add(centerText(this, GAME_W / 2, 170, this.msg, PALETTE.gold));
  }

  private result(r: { ok: boolean; msg: string }): void {
    this.msg = r.msg;
    audio.sfx(r.ok ? 'cha_ching' : 'buzzer', 0.6);
    this.draw();
  }
}
