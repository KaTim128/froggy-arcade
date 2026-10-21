/**
 * ---- CREATURE CLASH, the cabinet's menus.  Everything that is not the
 * fight: the free starter, your two, the pack and its nine face-down cards,
 * and the two ways to fight, kept apart --
 *
 *   ZONE BATTLE  the map of nine places: one creature from the place's own
 *                pool, a small stake, a small prize.  No bosses here.
 *   LADDER       a paid run: five fights, then a boss.  Its own screen, with
 *                where you are on it, what it pays and what it cost.
 *
 * -- and which hand the sticks go under.
 *
 * Every change goes through game/creatureClash -- this scene only draws and
 * asks.  It is redrawn from the save each time, so whatever is on screen is
 * what is true.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { ledger } from '../core/ledger';
import { button, centerText, confirmDialog, fadeToScene, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { drawCreature } from '../art/creatureArt';
import { drawAttackIcon } from '../art/attackIcons';
import { attackCard } from '../game/attackInfo';
import { backPlate } from '../ui/plate';
import { drawFrogToken } from '../ui/hud';
import { xpProgress } from '../game/creatureLevel';
import {
  BATTLE_COST, BATTLE_WIN, BIOMES, ELEMENTS, LADDER_BOSS_WIN, LADDER_COST, LADDER_LEVELS, LADDER_WIN, MAX_OWNED, PACK_COST, STARTERS, bossById, creatureById, type Attack, type Creature,
} from '../game/creatures';
import { abandonLadder, activeOwned, ownedCreature, claimStarter, needsRecovery, openPack, pickCard, release, retreat, setActive, setHanded, startLadder } from '../game/creatureClash';

type Screen = 'home' | 'starter' | 'recruit' | 'pack' | 'map' | 'ladder' | 'controls';
const SCREENS: Screen[] = ['home', 'map', 'ladder', 'recruit', 'controls'];

interface Shown {
  c: { element: Creature['element']; body: Creature['body'] };
  x: number;
  y: number;
  s: number;
  f: number;
}

export class CreatureHub extends Phaser.Scene {
  private screen: Screen = 'home';
  /** A move's card, when one is open: over the screen and its creatures. */
  private modal: Phaser.GameObjects.Container | null = null;
  private layer!: Phaser.GameObjects.Container;
  private art!: Phaser.GameObjects.Graphics;
  private shown: Shown[] = [];
  private msg = '';
  private from = 'ArcadeLounge';
  private biome = BIOMES[0].id;
  /** The card just turned over, and whether the other eight are showing yet. */
  private picked: { index: number; cards: string[]; all: boolean } | null = null;
  private dialog: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('CreatureHub');
  }

  /** The screen asked for (back from a fight: the ladder, or the map). */
  private want: Screen | null = null;

  init(data: { from?: string; msg?: string; screen?: string }): void {
    this.from = data.from ?? 'ArcadeLounge';
    this.msg = data.msg ?? '';
    this.want = SCREENS.includes(data.screen as Screen) ? (data.screen as Screen) : null;
    this.picked = null;
    this.dialog = null;
  }

  create(): void {
    // a page that went away mid-fight comes back as a retreat
    if (store.get().creatures.battle) {
      const r = retreat();
      this.msg = `LAST BATTLE ABANDONED. ${r.msg}`;
    }
    const c = store.get().creatures;
    this.screen = !c.starterTaken ? 'starter' : c.pending ? 'pack' : needsRecovery() ? 'recruit' : this.want ?? 'home';
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x10142a).setOrigin(0, 0);
    // a starfield of tiny element sparks behind everything
    const bg = this.add.graphics();
    const cols = Object.values(ELEMENTS).map((e) => e.col);
    for (let i = 0; i < 70; i++) bg.fillStyle(cols[i % cols.length], 0.25 + (i % 3) * 0.1).fillRect((i * 97) % GAME_W, (i * 53) % GAME_H, 1, 1);
    this.layer = this.add.container(0, 0);
    this.modal = null;
    this.art = this.add.graphics().setDepth(5);
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.dialog) return;
      if (this.screen === 'home' || this.screen === 'starter') this.leave();
      else if (this.screen !== 'pack') this.go('home');
    });
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.draw();
  }

  update(time: number): void {
    this.art.clear();
    for (const s of this.shown) drawCreature(this.art, s.c, s.x, s.y, s.s, s.f, time / 1000);
  }

  private leave(): void {
    fadeToScene(this, this.from, { fromClash: true });
  }

  private go(s: Screen): void {
    this.screen = s;
    this.msg = '';
    this.draw();
  }

  private say(r: { ok: boolean; msg: string }): void {
    this.msg = r.msg;
    audio.sfx(r.ok ? 'cha_ching' : 'buzzer', 0.5);
  }

  private draw(): void {
    this.modal?.destroy(true);
    this.modal = null;
    this.layer.removeAll(true);
    this.shown = [];
    const L = this.layer;
    // the header: a dark band with a neon edge, the name, your tokens in a chip
    L.add(this.add.rectangle(0, 0, GAME_W, 15, 0x0a0d1e).setOrigin(0, 0));
    L.add(this.add.rectangle(0, 15, GAME_W, 1, PALETTE.neon, 0.8).setOrigin(0, 0));
    L.add(this.add.rectangle(0, 16, GAME_W, 1, PALETTE.neon, 0.2).setOrigin(0, 0));
    L.add(text(this, 8, 4, 'CREATURE CLASH', PALETTE.gold));
    const tok = `${ledger.balance()}`;
    const chipW = tok.length * 6 + 20;
    L.add(this.add.rectangle(96, 2, chipW, 11, 0x14182e).setOrigin(0, 0).setStrokeStyle(1, 0x2a5a3a));
    L.add(drawFrogToken(this.add.graphics()).setPosition(103, 7.5));
    L.add(text(this, 111, 4, tok, PALETTE.mossLight));
    if (this.screen !== 'pack') L.add(button(this, GAME_W - 26, 8, this.screen === 'home' || this.screen === 'starter' ? 'LEAVE' : 'BACK', () => (this.screen === 'home' || this.screen === 'starter' ? this.leave() : this.go('home')), { width: 44, height: 11 }));
    ({ home: () => this.home(), starter: () => this.starter(), recruit: () => this.recruit(), pack: () => this.pack(), map: () => this.map(), ladder: () => this.ladder(), controls: () => this.controls() })[this.screen]();
    if (this.msg) {
      const m = centerText(this, GAME_W / 2, GAME_H - 7, this.msg, PALETTE.gold);
      L.add(m);
      backPlate(this, m, PALETTE.gold);
    } else if (this.screen === 'home' || this.screen === 'starter') {
      L.add(text(this, 8, GAME_H - 10, 'TAP A MOVE (?) TO READ WHAT IT DOES', 0x8a90b0));
    }
  }

  /**
   * A menu tile: a panel with a coloured edge, an icon, the word and a line
   * under it.  It lights up under the pointer, dips when pressed, and is
   * dimmed (and does nothing) when it cannot be used.
   */
  private tile(x: number, y: number, w: number, h: number, label: string, sub: string, col: number, icon: (g: Phaser.GameObjects.Graphics, x: number, y: number, col: number) => void, fn: () => void, disabled = false): void {
    const L = this.layer;
    const c = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, w, h, disabled ? 0x14172a : 0x1c2142).setOrigin(0, 0).setStrokeStyle(1, disabled ? 0x2a2e48 : col);
    const edge = this.add.rectangle(0, 0, 3, h, disabled ? 0x2a2e48 : col).setOrigin(0, 0);
    const shine = this.add.rectangle(3, 0, w - 3, 1, 0xffffff, disabled ? 0.04 : 0.1).setOrigin(0, 0);
    const g = this.add.graphics();
    const well = disabled ? 0x2a2e48 : col;
    g.fillStyle(0x0a0d1e, 1).fillRect(7, (h - 18) / 2, 18, 18);
    g.lineStyle(1, well, 0.7).strokeRect(7.5, (h - 18) / 2 + 0.5, 17, 17);
    icon(g, 16, h / 2, disabled ? PALETTE.ash : col);
    const t1 = text(this, 30, h / 2 - 9, label, disabled ? PALETTE.ash : PALETTE.cream);
    const t2 = text(this, 30, h / 2 + 2, sub, disabled ? 0x4a4e68 : PALETTE.fog);
    c.add([bg, edge, shine, g, t1, t2]);
    L.add(c);
    if (disabled) return;
    bg.setInteractive({ useHandCursor: true });
    let last = -Infinity;
    bg.on('pointerover', () => {
      bg.setFillStyle(0x2a3060);
      t1.setTint(PALETTE.gold);
      audio.sfx('ui_hover');
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x1c2142);
      t1.setTint(PALETTE.cream);
      c.setY(y);
    });
    bg.on('pointerdown', () => {
      const now = performance.now();
      if (now - last < 250) return;
      last = now;
      c.setY(y + 1);
      audio.sfx('ui_blip');
      this.time.delayedCall(70, fn);
    });
  }

  /** A short bar for a stat, 0..1 full, in `col`. */
  private bar(x: number, y: number, w: number, f: number, col: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x0a0d1e, 1).fillRect(x, y, w, 4);
    g.fillStyle(col, 1).fillRect(x + 1, y + 1, Math.max(1, Math.round((w - 2) * Math.min(1, Math.max(0, f)))), 2);
    this.layer.add(g);
  }

  /**
   * One creature's card: its picture on a panel in its element's colours, its
   * name, element and role (there are no rarities: every creature is its own
   * kind of fighter, not a better or worse one), health and speed as bars, and the three attacks with
   * their icons.  `active` gives it the gold edge of the one in the ring.
   * Its level is in a chip on the picture; with `xp` (one you own), the
   * experience towards the next level as a bar, or MAX at level 3.
   */
  private card(c: Creature, x: number, y: number, w: number, h: number, big = true, active = false, xp?: number): void {
    const L = this.layer;
    const el = ELEMENTS[c.element];
    const artH = big ? 36 : 26;
    L.add(this.add.rectangle(x + 2, y + 2, w, h, 0x000000, 0.35).setOrigin(0, 0));
    L.add(this.add.rectangle(x, y, w, h, 0x181c36).setOrigin(0, 0).setStrokeStyle(active ? 2 : 1, active ? PALETTE.gold : el.col));
    // the picture: the element's dark, lighter towards the floor it stands on
    L.add(this.add.rectangle(x + 2, y + 2, w - 4, artH, el.dark, 0.55).setOrigin(0, 0));
    L.add(this.add.rectangle(x + 2, y + 2 + artH * 0.6, w - 4, artH * 0.4, el.col, 0.18).setOrigin(0, 0));
    L.add(this.add.ellipse(x + w / 2, y + artH - 2, 30, 6, 0x000000, 0.3));
    this.shown.push({ c, x: x + w / 2, y: y + (big ? 20 : 15), s: big ? 1.6 : 1.2, f: 1 });
    // the element, in a chip on the picture's corner
    const tag = text(this, x + w - 6, y + 5, el.name, el.light).setOrigin(1, 0);
    L.add(this.add.rectangle(x + w - 3, y + 3, Math.ceil(tag.width) + 6, 11, 0x0a0d1e, 0.85).setOrigin(1, 0).setStrokeStyle(1, el.col));
    L.add(tag);
    // the level, in a chip on the other corner
    const lv = xpProgress(xp ?? 0);
    const lvT = text(this, x + 6, y + 5, `LV ${lv.level}`, lv.max ? PALETTE.gold : PALETTE.cream);
    L.add(this.add.rectangle(x + 3, y + 3, Math.ceil(lvT.width) + 6, 11, 0x0a0d1e, 0.85).setOrigin(0, 0).setStrokeStyle(1, lv.max ? PALETTE.gold : 0x6a7090));
    L.add(lvT);
    let ty = y + artH + 4;
    L.add(text(this, x + 4, ty, c.name.toUpperCase(), PALETTE.cream).setMaxWidth(w - 6));
    ty += 9;
    L.add(text(this, x + 4, ty, c.role, el.light).setMaxWidth(w - 6));
    if (!big) return;
    ty += 10;
    if (xp !== undefined) {
      // experience: how far into this level, or MAX
      L.add(text(this, x + 4, ty, 'XP', PALETTE.ash));
      this.bar(x + 18, ty + 2, w - 44, lv.max ? 1 : lv.into / lv.need, lv.max ? PALETTE.gold : 0xc08aff);
      L.add(text(this, x + w - 4, ty, lv.max ? 'MAX' : `${lv.into}/${lv.need}`, lv.max ? PALETTE.gold : PALETTE.fog).setOrigin(1, 0));
      ty += 8;
    }
    const bw = w - 44;
    L.add(text(this, x + 4, ty, 'HP', PALETTE.ash));
    this.bar(x + 18, ty + 2, bw, c.hp / 160, 0x6ad86a);
    L.add(text(this, x + w - 4, ty, String(c.hp), PALETTE.fog).setOrigin(1, 0));
    ty += 8;
    L.add(text(this, x + 4, ty, 'SPD', PALETTE.ash));
    this.bar(x + 18, ty + 2, bw, c.speed / 100, 0x6ac8e8);
    L.add(text(this, x + w - 4, ty, String(c.speed), PALETTE.fog).setOrigin(1, 0));
    ty += 10;
    L.add(this.add.rectangle(x + 4, ty - 2, w - 8, 1, 0x2a3050).setOrigin(0, 0));
    const g = this.add.graphics();
    L.add(g);
    for (const a of c.attacks) {
      // TAP A MOVE TO READ IT.  Each move is a button -- a raised chip with a
      // "?" on the end that lights up under the pointer -- and the card it
      // opens says everything: what kind of attack it is, what it hits, how
      // far, how hard, how often, its special, and its element's effect.
      // Nobody should have to buy a battle to find out.
      // (laid out so the longest name there is -- eleven letters, 66px, see
      // creatures MOVE_NAME_MAX -- sits clear of the icon and the "?")
      const chip = this.add.rectangle(x + 2, ty - 1, w - 4, 9, 0x232a4a).setOrigin(0, 0).setStrokeStyle(1, 0x3a4470);
      L.addAt(chip, L.getIndex(g));
      // (an icon is 11px wide, centred: x+3..x+13; the name starts after it)
      drawAttackIcon(g, a.kind, x + 8, ty + 3, el.light);
      const name = text(this, x + 15, ty, a.name, PALETTE.cream);
      L.add(name);
      // the "?" that says there is more to read
      const qx = x + w - 9;
      L.add(this.add.rectangle(qx - 1, ty - 1, 7, 9, 0x3a4470).setOrigin(0, 0));
      L.add(text(this, qx, ty, '?', PALETTE.gold));
      // the damage, left of the "?" -- where the name leaves room for it
      if (a.dmg) {
        const d = text(this, qx - 4, ty, String(a.dmg), PALETTE.gold).setOrigin(1, 0);
        if (name.x + name.width + 2 <= d.x - d.width) L.add(d);
        else d.destroy();
      }
      chip.setInteractive({ useHandCursor: true });
      chip.on('pointerover', () => (chip.setFillStyle(0x34407a).setStrokeStyle(1, PALETTE.gold), name.setTint(PALETTE.gold), audio.sfx('ui_hover')));
      chip.on('pointerout', () => (chip.setFillStyle(0x232a4a).setStrokeStyle(1, 0x3a4470), name.setTint(PALETTE.cream)));
      chip.on('pointerdown', () => (audio.sfx('ui_blip'), this.showMove(c, a)));
      ty += 10;
    }
  }

  /**
   * One move, said in full.  It is a panel over whatever screen you were on;
   * anything outside it, or the button, puts it away again.
   */
  private showMove(c: Creature, a: Attack): void {
    // ITS OWN LAYER, OVER EVERYTHING.  It used to go into the screen's layer,
    // which sits under the creatures' drawing -- so the creatures on the cards
    // were painted on top of the card that was meant to cover them.
    this.modal?.destroy(true);
    const M = this.add.container(0, 0).setDepth(600);
    this.modal = M;
    const el = ELEMENTS[c.element];
    const lines = attackCard(a, c.element);
    const w = 200;
    const close = (): void => this.draw();
    const veil = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05070f, 0.82).setOrigin(0, 0);
    veil.setInteractive().on('pointerdown', close);
    M.add(veil);
    // the lines first, each under the last by its real height (a long one
    // wraps onto two, and used to be printed over by the next)
    const body0: Phaser.GameObjects.BitmapText[] = [];
    const lineOf = (ln: string, col: number): void => {
      body0.push(text(this, 0, 0, ln, col).setMaxWidth(w - 16));
    };
    lines.forEach((ln, i) => lineOf(ln, i === 0 ? PALETTE.cream : PALETTE.fog));
    lineOf(`GOOD AT: ${c.strong}`, PALETTE.mossLight);
    lineOf(`WEAK: ${c.weak}`, 0xff9a9a);
    const gap = 3;
    const textH = body0.reduce((t, o) => t + o.height + gap, 0);
    const h = 27 + textH + 20;
    const x = (GAME_W - w) / 2;
    const y = Math.max(2, (GAME_H - h) / 2);
    M.add(this.add.rectangle(x, y, w, h, 0x141834).setOrigin(0, 0).setStrokeStyle(1, el.col));
    const g = this.add.graphics();
    drawAttackIcon(g, a.kind, x + 13, y + 13, el.light);
    M.add(g);
    M.add(text(this, x + 24, y + 8, a.name, PALETTE.gold));
    M.add(text(this, x + w - 6, y + 8, `${c.name.toUpperCase()}`, PALETTE.fog).setOrigin(1, 0));
    M.add(this.add.rectangle(x + 6, y + 22, w - 12, 1, 0x2a3050).setOrigin(0, 0));
    let ly = y + 27;
    for (const o of body0) {
      o.setPosition(x + 8, ly);
      M.add(o);
      ly += o.height + gap;
    }
    M.add(button(this, x + w / 2, y + h - 9, 'CLOSE', close, { width: 56, height: 12 }));
  }

  // ----------------------------------------------------------------- screens

  private starter(): void {
    const L = this.layer;
    L.add(centerText(this, GAME_W / 2, 24, 'CHOOSE YOUR FIRST CREATURE - FREE', PALETTE.cream));
    STARTERS.forEach((id, i) => {
      const c = creatureById(id)!;
      const x = 10 + i * 102;
      this.card(c, x, 32, 96, 108);
      L.add(button(this, x + 48, 152, 'CHOOSE', () => {
        const r = claimStarter(id);
        this.say(r);
        if (r.ok) this.screen = 'home';
        this.draw();
      }, { width: 70, height: 12 }));
    });
  }

  private home(): void {
    const L = this.layer;
    const c = store.get().creatures;
    const act = activeOwned(c);
    // ---- your two, on the left
    L.add(text(this, 8, 23, `YOUR TEAM  ${c.owned.length}/${MAX_OWNED}`, PALETTE.gold));
    L.add(text(this, 164, 23, `W ${c.wins}`, PALETTE.mossLight).setOrigin(1, 0));
    L.add(text(this, 196, 23, `L ${c.losses}`, 0xff8a8a).setOrigin(1, 0));
    for (let i = 0; i < MAX_OWNED; i++) {
      const o = c.owned[i];
      // (96 wide: room on a move's row for the longest name between its icon and its "?")
      const x = 4 + i * 98;
      const y = 33;
      const w = 96;
      const h = 116;
      if (!o) {
        const slot = this.add.rectangle(x, y, w, h, 0x12152a).setOrigin(0, 0).setStrokeStyle(1, 0x2a2e48);
        L.add(slot);
        const g = this.add.graphics();
        g.lineStyle(1, 0x3a3e58, 1).strokeCircle(x + w / 2, y + 46, 12);
        g.fillStyle(0x3a3e58, 1).fillRect(x + w / 2 - 5, y + 45, 11, 2).fillRect(x + w / 2 - 1, y + 41, 2, 11);
        L.add(g);
        L.add(centerText(this, x + w / 2, y + 70, 'EMPTY SLOT', PALETTE.ash));
        L.add(centerText(this, x + w / 2, y + 80, 'RECRUIT TO FILL', 0x4a4e68));
        continue;
      }
      const cr = ownedCreature(o)!;
      const on = o.uid === act?.uid;
      this.card(cr, x, y, w, h, true, on, o.xp ?? 0);
      if (on) {
        // the one that fights: a gold chip where USE would be
        L.add(this.add.rectangle(x + 2, y + h + 4, 42, 12, 0x3a2e10).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold));
        L.add(centerText(this, x + 23, y + h + 10, 'IN RING', PALETTE.gold));
      } else L.add(button(this, x + 23, y + h + 10, 'USE', () => (this.say(setActive(o.uid)), this.draw()), { width: 42, height: 12 }));
      L.add(button(this, x + w - 23, y + h + 10, 'RELEASE', () => this.confirmRelease(o.uid, cr), { width: 44, height: 12, fill: 0x2a1424, hoverFill: 0x5a2040 }));
    }
    // ---- the menu, on the right
    const mx = 204;
    const mw = GAME_W - mx - 8;
    L.add(this.add.rectangle(mx - 4, 21, mw + 8, GAME_H - 34, 0x0e1124, 0.9).setOrigin(0, 0).setStrokeStyle(1, 0x2a3050));
    L.add(text(this, mx, 25, 'MENU', PALETTE.ash));
    const busy = !!c.pending;
    const run = c.ladder;
    this.tile(mx, 35, mw, 28, 'ZONE BATTLE', act ? `${BATTLE_COST} IN - WIN ${BATTLE_WIN}` : 'NO CREATURE', 0xff5a6a, (g, x, y, col) => drawAttackIcon(g, 'dash', x, y, col), () => this.go('map'), !act);
    this.tile(mx, 67, mw, 28, 'LADDER', run ? (run.level > LADDER_LEVELS ? 'FINAL BOSS NEXT' : `LEVEL ${run.level} OF ${LADDER_LEVELS}`) : `ENTRY ${LADDER_COST} TOK`, PALETTE.gold, (g, x, y, col) => {
      // three rungs
      g.fillStyle(col, 1).fillRect(x - 5, y - 7, 2, 14).fillRect(x + 3, y - 7, 2, 14);
      for (const k of [-4, 0, 4]) g.fillRect(x - 3, y + k, 6, 1);
    }, () => this.go('ladder'), !act && !run);
    const full = c.owned.length >= MAX_OWNED && !busy;
    this.tile(mx, 99, mw, 28, 'RECRUIT', busy ? 'PACK WAITING' : full ? 'TEAM IS FULL' : `${PACK_COST} TOKENS`, 0x8a6aff, (g, x, y, col) => {
      g.fillStyle(0x14100c, 1).fillRect(x - 6, y - 5, 9, 12).fillRect(x - 2, y - 7, 9, 12);
      g.fillStyle(col, 0.6).fillRect(x - 5, y - 4, 7, 10);
      g.fillStyle(col, 1).fillRect(x - 1, y - 6, 7, 10);
      g.fillStyle(0x14100c, 1).fillRect(x + 2, y - 3, 1, 3).fillRect(x + 2, y + 1, 1, 1);
    }, () => this.go(busy ? 'pack' : 'recruit'));
    this.tile(mx, 131, mw, 28, 'CONTROLS', c.handed === 'left' ? 'LEFT-HANDED' : 'RIGHT-HANDED', 0x4ad0c0, (g, x, y, col) => {
      g.fillStyle(col, 1).fillRect(x - 7, y - 3, 14, 7).fillRect(x - 8, y - 1, 16, 5);
      g.fillStyle(0x0a0d1e, 1).fillRect(x - 5, y, 3, 1).fillRect(x - 4, y - 1, 1, 3).fillRect(x + 3, y - 1, 1, 1).fillRect(x + 5, y + 1, 1, 1);
    }, () => this.go('controls'));
  }

  private confirmRelease(uid: number, cr: Creature): void {
    if (this.dialog) return;
    const last = store.get().creatures.owned.length === 1;
    this.dialog = confirmDialog(this, {
      lines: [`RELEASE ${cr.name.toUpperCase()}?`, 'IT WILL NOT COME BACK.', ...(last ? ['IT IS YOUR LAST ONE.'] : [])],
      confirm: 'RELEASE',
      onConfirm: () => {
        this.dialog = null;
        this.say(release(uid));
        this.screen = needsRecovery() ? 'recruit' : 'home';
        this.draw();
      },
      onCancel: () => {
        this.dialog?.destroy();
        this.dialog = null;
      },
    });
    this.dialog.setDepth(3000);
  }

  /** THE PACK: one price, nine different creatures face down, every one as likely as any other. */
  private recruit(): void {
    const L = this.layer;
    const c = store.get().creatures;
    const recovery = needsRecovery(c);
    L.add(centerText(this, GAME_W / 2, 22, recovery ? 'RECOVERY RECRUITMENT - YOU HAVE NO CREATURES LEFT' : 'RECRUIT', recovery ? PALETTE.gold : PALETTE.cream));
    const x = GAME_W / 2 - 90;
    L.add(this.add.rectangle(x, 32, 180, 112, 0x1a1e38).setOrigin(0, 0).setStrokeStyle(1, 0x8a6aff));
    // the pack itself, face down
    const g = this.add.graphics();
    for (let k = 0; k < 3; k++) {
      g.fillStyle(0x14100c, 1).fillRect(x + 14 + k * 6, 44 + k * 3, 30, 40);
      g.fillStyle(0x2a1e48, 1).fillRect(x + 15 + k * 6, 45 + k * 3, 28, 38);
      g.lineStyle(1, PALETTE.gold, 1).strokeRect(x + 15.5 + k * 6, 45.5 + k * 3, 27, 37);
    }
    L.add(g);
    L.add(centerText(this, x + 41, 70, '?', PALETTE.gold));
    L.add(text(this, x + 70, 42, 'CREATURE PACK', PALETTE.cream));
    L.add(text(this, x + 70, 52, `${PACK_COST} TOKENS`, PALETTE.gold));
    L.add(text(this, x + 70, 66, 'NINE DIFFERENT', PALETTE.fog));
    L.add(text(this, x + 70, 75, 'CREATURES, FACE', PALETTE.fog));
    L.add(text(this, x + 70, 84, 'DOWN. KEEP ONE.', PALETTE.fog));
    L.add(text(this, x + 8, 100, 'EACH ONE AS LIKELY AS ANY', PALETTE.ash));
    L.add(text(this, x + 8, 109, 'OTHER. NONE IS RARER.', PALETTE.ash));
    const can = ledger.balance() >= PACK_COST && c.owned.length < MAX_OWNED;
    L.add(button(this, GAME_W / 2, 132, `OPEN  ${PACK_COST} TOK`, () => {
      const r = openPack();
      this.say(r);
      if (r.ok) {
        this.screen = 'pack';
        this.picked = null;
      }
      this.draw();
    }, { width: 96, height: 13, disabled: !can }));
    if (c.owned.length >= MAX_OWNED) L.add(centerText(this, GAME_W / 2, 154, 'YOU HAVE TWO. RELEASE ONE BEFORE YOU RECRUIT.', PALETTE.gold));
    else if (ledger.balance() < PACK_COST) L.add(centerText(this, GAME_W / 2, 154, `YOU HAVE ${ledger.balance()} TOKENS.`, PALETTE.ash));
  }

  /** The nine cards.  Face down until one is chosen; then that one, then the rest. */
  private pack(): void {
    const L = this.layer;
    const p = store.get().creatures.pending;
    const cards = this.picked?.cards ?? p?.cards;
    if (!cards) {
      this.go('home');
      return;
    }
    L.add(text(this, 8, 18, this.picked ? 'YOURS, AND WHAT ELSE WAS IN THE PACK' : 'PICK ONE CARD', PALETTE.cream));
    const cw = 44;
    const ch = 46;
    cards.forEach((id, i) => {
      const x = 10 + (i % 3) * (cw + 4);
      const y = 28 + Math.floor(i / 3) * (ch + 3);
      const cr = creatureById(id)!;
      const faceUp = this.picked && (this.picked.index === i || this.picked.all);
      if (!faceUp) {
        const back = this.add.rectangle(x, y, cw, ch, 0x2a1e48).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold);
        L.add(back);
        L.add(centerText(this, x + cw / 2, y + ch / 2, '?', PALETTE.gold));
        if (!this.picked) {
          back.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.choose(i));
          back.on('pointerover', () => back.setFillStyle(0x3a2e68)).on('pointerout', () => back.setFillStyle(0x2a1e48));
        }
        return;
      }
      const mine = this.picked!.index === i;
      const el = ELEMENTS[cr.element];
      L.add(this.add.rectangle(x, y, cw, ch, mine ? 0x2a3050 : 0x161a2c).setOrigin(0, 0).setStrokeStyle(mine ? 2 : 1, mine ? PALETTE.gold : el.col));
      this.shown.push({ c: cr, x: x + cw / 2, y: y + 18, s: 1.2, f: 1 });
      // (no name on the small cards: the big one beside them has it)
      L.add(centerText(this, x + cw / 2, y + 35, el.name, el.light));
      L.add(this.add.rectangle(x + 3, y + ch - 5, cw - 6, 2, el.col).setOrigin(0, 0));
    });
    if (this.picked) {
      const cr = creatureById(cards[this.picked.index])!;
      this.card(cr, 166, 26, 146, 118);
      L.add(button(this, 239, 156, 'CONTINUE', () => {
        this.picked = null;
        this.go('home');
      }, { width: 80, height: 13 }));
    } else {
      L.add(text(this, 166, 40, 'NINE DIFFERENT CREATURES', PALETTE.fog));
      L.add(text(this, 166, 50, 'ARE FACE DOWN. YOU KEEP', PALETTE.fog));
      L.add(text(this, 166, 60, 'EXACTLY ONE.', PALETTE.fog));
      L.add(text(this, 166, 76, 'THE PACK IS PAID FOR AND', PALETTE.ash));
      L.add(text(this, 166, 86, 'SAVED: LEAVING DOES NOT', PALETTE.ash));
      L.add(text(this, 166, 96, 'CHANGE THE CARDS.', PALETTE.ash));
    }
  }

  private choose(i: number): void {
    if (this.picked) return;
    const r = pickCard(i);
    this.say(r);
    if (!r.ok || !r.cards) {
      this.draw();
      return;
    }
    this.picked = { index: i, cards: r.cards, all: false };
    this.draw();
    this.time.delayedCall(900, () => {
      if (!this.picked) return;
      this.picked.all = true;
      this.draw();
    });
  }

  /**
   * ZONE BATTLES.  Pick a place; one creature from the ones that live there
   * comes out to fight (never the same one twice running).  Nothing about
   * the ladder is here.
   */
  private map(): void {
    const L = this.layer;
    L.add(text(this, 8, 18, 'ZONE BATTLE - WHERE TO FIGHT', PALETTE.cream));
    BIOMES.forEach((b, i) => {
      const x = 8 + (i % 3) * 62;
      const y = 28 + Math.floor(i / 3) * 44;
      const sel = b.id === this.biome;
      const tile = this.add.rectangle(x, y, 58, 40, b.ground).setOrigin(0, 0).setStrokeStyle(sel ? 2 : 1, sel ? PALETTE.gold : b.groundDark);
      tile.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.biome = b.id;
        this.draw();
      });
      L.add(tile);
      L.add(this.add.rectangle(x + 1, y + 20, 56, 19, 0x000000, 0.55).setOrigin(0, 0));
      b.name.split(' ').forEach((w, k) => L.add(text(this, x + 3, y + 21 + k * 9, w, PALETTE.cream)));
    });
    const b = BIOMES.find((x) => x.id === this.biome)!;
    const px = 196;
    L.add(this.add.rectangle(px, 26, 118, 134, 0x1a1e38).setOrigin(0, 0).setStrokeStyle(1, b.groundDark));
    L.add(text(this, px + 4, 30, b.name, PALETTE.gold));
    L.add(text(this, px + 4, 40, `WHO LIVES HERE: ${b.pool.length}`, PALETTE.ash));
    // (as little pictures, six to a row: a list of names no longer fits)
    b.pool.forEach((id, k) => {
      const cr = creatureById(id)!;
      this.shown.push({ c: cr, x: px + 12 + (k % 6) * 19, y: 56 + Math.floor(k / 6) * 19, s: 0.75, f: 1 });
    });
    L.add(button(this, px + 59, 100, `FIGHT  ${BATTLE_COST} TOK`, () => this.fight(b.id), { width: 108, height: 13, disabled: ledger.balance() < BATTLE_COST || !activeOwned() }));
    L.add(text(this, px + 4, 112, `WIN: +${BATTLE_WIN} TOKENS`, PALETTE.mossLight));
    L.add(text(this, px + 4, 121, 'LOSS: IT FAINTS', PALETTE.ash));
    L.add(text(this, px + 4, 130, 'NO TOKENS LOST', PALETTE.ash));
    // ---- AND SOMEWHERE TO PRACTISE.  Free, in this world's own arena, on a
    // dummy that cannot hurt you: try the moves, learn the cover, walk about.
    L.add(button(this, px + 59, 150, 'TRAINING - FREE', () => this.train(b.id), { width: 108, height: 12, fill: 0x14303a, hoverFill: 0x1e5a68 }));
  }

  /** The training ground: no stake, no clock, nothing to lose. */
  private train(biome: string): void {
    if (!activeOwned()) {
      this.say({ ok: false, msg: 'YOU NEED A CREATURE FIRST.' });
      this.draw();
      return;
    }
    this.scene.start('CreatureArena', { biome, training: true, from: this.from });
  }

  private fight(biome: string): void {
    // the stake is taken by the arena, at the bell, not here
    this.scene.start('CreatureArena', { biome, mode: 'zone', from: this.from });
  }

  /**
   * THE LADDER.  A run is paid for once, up front (after you say yes), and
   * then it is five fights and a boss, in order, each one unlocked by the
   * last.  Lose one and the run is over: no refund, but what it paid you is
   * yours.  The fights are drawn when you pay, so leaving and coming back
   * meets the same ones.
   */
  private ladder(): void {
    const L = this.layer;
    const c = store.get().creatures;
    const run = c.ladder;
    L.add(text(this, 8, 18, 'THE LADDER', PALETTE.gold));
    // ---- the rungs, the final boss at the top
    const rows = LADDER_LEVELS + 1;
    for (let i = 0; i < rows; i++) {
      const lv = rows - i;
      const y = 28 + i * 22;
      const boss = lv > LADDER_LEVELS;
      const done = !!run && run.level > lv;
      const next = !!run && run.level === lv;
      const edge = done ? PALETTE.mossLight : next ? PALETTE.gold : 0x2a3050;
      L.add(this.add.rectangle(8, y, 180, 19, next ? 0x2a2a18 : 0x161a2c).setOrigin(0, 0).setStrokeStyle(next ? 2 : 1, edge));
      L.add(text(this, 13, y + 6, boss ? 'BOSS' : `LV ${lv}`, boss ? PALETTE.gold : PALETTE.cream));
      // who: met ones and the next by name; the rest stay a surprise
      let who = '???';
      if (run && (done || next)) {
        const cr = boss ? bossById(run.boss) : creatureById(run.foes[lv - 1]);
        if (cr) who = cr.name.toUpperCase();
      } else if (boss) who = 'FINAL BOSS';
      L.add(text(this, 42, y + 6, who, done ? PALETTE.mossLight : next ? PALETTE.gold : PALETTE.ash));
      // (only the boss pays: the prize is for the whole run)
      const pay = boss ? LADDER_BOSS_WIN : LADDER_WIN;
      L.add(text(this, 184, y + 6, done ? 'OK' : pay ? `+${pay}` : '', done ? PALETTE.mossLight : boss ? PALETTE.gold : PALETTE.fog).setOrigin(1, 0));
    }
    // ---- the terms, the balance, and what to do
    const px = 196;
    L.add(this.add.rectangle(px, 26, 118, 134, 0x1a1e38).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold));
    L.add(text(this, px + 4, 30, `ENTRY: ${LADDER_COST} TOKENS`, PALETTE.gold));
    L.add(text(this, px + 4, 39, 'PAID ONCE A RUN', PALETTE.ash));
    L.add(text(this, px + 4, 50, LADDER_WIN ? `+${LADDER_WIN} EACH LEVEL` : 'BEAT ALL 5 + BOSS:', PALETTE.mossLight));
    L.add(text(this, px + 4, 59, `WIN ${LADDER_BOSS_WIN} TOKENS`, PALETTE.mossLight));
    L.add(text(this, px + 4, 70, 'LOSS ENDS THE RUN.', 0xff9a9a));
    L.add(text(this, px + 4, 79, LADDER_WIN ? 'NO REFUND, BUT YOU' : 'NO REFUND, AND', PALETTE.ash));
    L.add(text(this, px + 4, 88, LADDER_WIN ? 'KEEP WHAT IT PAID.' : 'NO PRIZE.', PALETTE.ash));
    L.add(text(this, px + 4, 100, `TOKENS: ${ledger.balance()}`, PALETTE.cream));
    if (run) {
      L.add(text(this, px + 4, 109, LADDER_WIN ? `THIS RUN: +${run.earned}` : `BOSS PAYS ${LADDER_BOSS_WIN}`, PALETTE.gold));
      L.add(button(this, px + 59, 128, run.level > LADDER_LEVELS ? 'FIGHT THE BOSS' : `CONTINUE - LV ${run.level}`, () => this.ladderFight(), { width: 108, height: 13, disabled: !activeOwned() }));
      L.add(button(this, px + 59, 148, 'ABANDON RUN', () => this.confirmAbandon(), { width: 108, height: 12, fill: 0x2a1424, hoverFill: 0x5a2040 }));
    } else {
      L.add(text(this, px + 4, 109, `RUNS ${c.ladderRuns}  CLEARED ${c.ladderClears}`, PALETTE.fog));
      const can = ledger.balance() >= LADDER_COST && !!activeOwned();
      L.add(button(this, px + 59, 134, `START RUN  ${LADDER_COST} TOK`, () => this.confirmStart(), { width: 108, height: 13, disabled: !can }));
      if (!activeOwned()) L.add(text(this, px + 4, 146, 'NEED A CREATURE', PALETTE.ash));
    }
  }

  /** Ask first: the entry fee is taken only after a yes. */
  private confirmStart(): void {
    if (this.dialog) return;
    this.dialog = confirmDialog(this, {
      lines: [`START A LADDER RUN FOR ${LADDER_COST} TOKENS?`, `YOU HAVE ${ledger.balance()}.`, 'A LOSS ENDS THE RUN. NO REFUND.'],
      confirm: `PAY ${LADDER_COST}`,
      onConfirm: () => {
        this.dialog = null;
        this.say(startLadder());
        this.draw();
      },
      onCancel: () => {
        this.dialog?.destroy();
        this.dialog = null;
      },
    });
    this.dialog.setDepth(3000);
  }

  private confirmAbandon(): void {
    if (this.dialog) return;
    this.dialog = confirmDialog(this, {
      lines: ['ABANDON THIS LADDER RUN?', 'THE ENTRY FEE IS NOT REFUNDED.'],
      confirm: 'ABANDON',
      onConfirm: () => {
        this.dialog = null;
        this.say(abandonLadder());
        this.draw();
      },
      onCancel: () => {
        this.dialog?.destroy();
        this.dialog = null;
      },
    });
    this.dialog.setDepth(3000);
  }

  private ladderFight(): void {
    // the run's own next step: the arena reads it from the save
    this.scene.start('CreatureArena', { mode: 'ladder', from: this.from });
  }

  private controls(): void {
    const L = this.layer;
    const h = store.get().creatures.handed;
    L.add(centerText(this, GAME_W / 2, 24, 'BATTLE CONTROLS', PALETTE.cream));
    L.add(text(this, 14, 38, 'KEYBOARD AND MOUSE', PALETTE.gold));
    L.add(text(this, 14, 48, 'WASD / ARROWS  MOVE', PALETTE.fog));
    L.add(text(this, 14, 57, '1 2 3  CHOOSE AN ATTACK', PALETTE.fog));
    L.add(text(this, 14, 66, 'MOUSE  AIM.  CLICK  FIRE', PALETTE.fog));
    L.add(text(this, 14, 82, 'TOUCH', PALETTE.gold));
    L.add(text(this, 14, 92, 'ONE STICK MOVES. TAP AN', PALETTE.fog));
    L.add(text(this, 14, 101, 'ATTACK, THEN DRAG THE AIM', PALETTE.fog));
    L.add(text(this, 14, 110, 'STICK: LET GO TO FIRE.', PALETTE.fog));
    L.add(text(this, 180, 38, 'STICK LAYOUT', PALETTE.gold));
    const opt = (label: string, v: 'right' | 'left', y: number, sub: string): void => {
      L.add(button(this, 236, y, label, () => {
        setHanded(v);
        this.draw();
      }, { width: 100, height: 13, fill: h === v ? PALETTE.tealDark : PALETTE.ink }));
      L.add(text(this, 186, y + 9, sub, PALETTE.ash));
    };
    opt('RIGHT-HANDED', 'right', 56, 'MOVE LEFT, AIM RIGHT');
    opt('LEFT-HANDED', 'left', 86, 'MOVE RIGHT, AIM LEFT');
    L.add(text(this, 186, 112, 'SAVED WITH YOUR GAME.', PALETTE.ash));
  }
}
