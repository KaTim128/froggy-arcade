/**
 * ---- CREATURE CLASH, the cabinet's menus.  Everything that is not the
 * fight: your two (a fainted one resting in its slot), the pack and its nine
 * face-down cards,
 * and the two ways to fight, kept apart --
 *
 *   ZONE BATTLE  the map of nine places: one creature from the place's own
 *                pool, a small stake, a small prize.  No bosses here.
 *   LADDER       a paid run: five fights, then a boss.  Its own screen, with
 *                where you are on it, what it pays and what it cost.
 *
 * -- and, on a keyboard, which keys fight.
 *
 * Every change goes through game/creatureClash -- this scene only draws and
 * asks.  It is redrawn from the save each time, so whatever is on screen is
 * what is true.
 */

import { STAGES, WORLDS, lineupFoe, stageLevel, storyPrice } from '../game/creatureStory';
import { paintFloor } from '../art/arenaFloors';
import { isTouch } from '../core/device';
import { capLabel, codeFor } from '../core/keymap';
import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { ledger } from '../core/ledger';
import { button, centerText, confirmDialog, centerSmall, fadeToScene, smallText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { drawCreature } from '../art/creatureArt';
import { drawAttackIcon } from '../art/attackIcons';
import { drawAbilityIcon } from '../art/abilityIcons';
import { attackCard } from '../game/attackInfo';
import { backPlate } from '../ui/plate';
import { drawFrogToken, floatDeduct } from '../ui/hud';
import { levelOf, xpProgress } from '../game/creatureLevel';
import { DEMO_H, DEMO_W, demoFor } from '../ui/tutorialDemos';
import {
  BATTLE_COST, BATTLE_WIN, BIOMES, ELEMENTS, LADDER_BOSS_WIN, LADDER_COST, LADDER_LEVELS, LADDER_WIN, MAX_OWNED, PACK_COST, BOSSES, bossById, creatureById, type Attack, type Creature,
} from '../game/creatures';
import { REST_MS, REVIVE_COST, abandonLadder, activeCreature, activeOwned, isReplay, worldOpen, ownedCreature, needsRecovery, restLeft, revive, openPack, pickCard, release, retreat, setActive, startLadder } from '../game/creatureClash';

type Screen = 'home' | 'recruit' | 'pack' | 'map' | 'story' | 'ladder' | 'controls';
const SCREENS: Screen[] = ['home', 'story', 'ladder', 'recruit', 'controls'];

interface Shown {
  c: { element: Creature['element']; body: Creature['body'] };
  x: number;
  y: number;
  s: number;
  f: number;
  /** The story map's marker: it hops, and glides to the world picked. */
  hop?: boolean;
}

/** Where each world sits on the story map, along a winding path. */
const WORLD_AT: Array<[number, number]> = [
  [26, 132],
  [62, 80],
  [100, 128],
  [140, 76],
  [176, 124],
];

/** `s` broken into lines of at most `n` characters, at the spaces. */
function wrapWords(s: string, n: number): string[] {
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

export class CreatureHub extends Phaser.Scene {
  private screen: Screen = 'home';
  /** A move's card, when one is open: over the screen and its creatures. */
  private modal: Phaser.GameObjects.Container | null = null;
  private layer!: Phaser.GameObjects.Container;
  private art!: Phaser.GameObjects.Graphics;
  private shown: Shown[] = [];
  /** HOW TO PLAY: the step it is on, and its moving picture (redrawn in update). */
  private howStep = 0;
  private demo: { g: Phaser.GameObjects.Graphics; id: string; pool: Phaser.GameObjects.BitmapText[]; t0: number; clip: Phaser.GameObjects.Graphics; mask: Phaser.Display.Masks.GeometryMask } | null = null;
  /** The story map: the world picked, and where the marker is now. */
  private storyW = 0;
  private mark = { x: WORLD_AT[0][0], y: WORLD_AT[0][1] - 20 };
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

  init(data: { from?: string; msg?: string; screen?: string; world?: number }): void {
    this.from = data.from ?? 'ArcadeLounge';
    // (back from a story fight: on the world it was in)
    if (typeof data.world === 'number' && WORLD_AT[data.world]) {
      this.storyW = data.world;
      this.mark = { x: WORLD_AT[data.world][0], y: WORLD_AT[data.world][1] - 20 };
    }
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
    // (tokens spent here: the red amount by the chip, as by the HUD's counter)
    const off = ledger.onChange((next, prev) => {
      if (next < prev) floatDeduct(this, 113 + `${prev}`.length * 6, 3, prev - next);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    const c = store.get().creatures;
    // (no starter, log #3: an empty team goes straight to recruiting its first)
    this.screen = c.pending ? 'pack' : needsRecovery() ? 'recruit' : this.want ?? 'home';
    // a resting creature's clock, kept current on the team screen
    this.time.addEvent({ delay: 1000, loop: true, callback: () => {
      if (this.screen === 'home' && !this.dialog && store.get().creatures.owned.some((o) => restLeft(o) > 0)) this.draw();
    } });
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
      // (on the top screens Esc is the pause menu's, where LEAVE is)
      if (this.screen !== 'home' && this.screen !== 'recruit') this.go(store.get().creatures.owned.length ? 'home' : 'recruit');
    });
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.draw();
  }

  update(time: number, delta: number): void {
    this.art.clear();
    this.drawDemo(time);
    for (const s of this.shown) {
      if (s.hop) {
        // the marker: glides along to the world picked, hopping as it goes
        const [tx, ty] = WORLD_AT[this.storyW];
        const k = Math.min(1, (delta / 1000) * 5);
        this.mark.x += (tx - this.mark.x) * k;
        this.mark.y += (ty - 20 - this.mark.y) * k;
        const moving = Math.hypot(tx - this.mark.x, ty - 20 - this.mark.y) > 1;
        const hop = Math.abs(Math.sin(time / (moving ? 90 : 220))) * (moving ? 5 : 2);
        s.x = this.mark.x;
        s.y = this.mark.y - hop;
        s.f = tx >= this.mark.x - 0.5 ? 1 : -1;
      }
      drawCreature(this.art, s.c, s.x, s.y, s.s, s.f, time / 1000);
    }
  }

  /** LEAVE, in the pause menu between RESUME and EXIT TO START MENU. */
  pauseExit(): { label: string; run: () => void } | null {
    if (this.dialog) return null;
    return this.screen === 'home' || (this.screen === 'recruit' && needsRecovery()) ? { label: 'LEAVE', run: () => this.leave() } : null;
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
    if (this.demo) {
      this.demo.clip.destroy();
      this.demo = null;
    }
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
    // LEAVE is in the pause menu (see pauseExit): the corner has the gear
    // that opens it on the top screens, and BACK on the ones under them
    const top = this.screen === 'home' || (this.screen === 'recruit' && needsRecovery());
    if (top) {
      // (LEAVE is in the pause menu: Esc on a keyboard, the gear on a phone)
    } else if (!(this.screen === 'pack' && this.picked)) L.add(button(this, GAME_W - 26, 8, 'BACK', () => this.go(store.get().creatures.owned.length ? 'home' : 'recruit'), { width: 44, height: 11 }));
    ({ home: () => this.home(), recruit: () => this.recruit(), pack: () => this.pack(), map: () => this.map(), story: () => this.story(), ladder: () => this.ladder(), controls: () => this.controls() })[this.screen]();
    // (on the pack screen the line keeps to the right-hand column, clear of
    // the cards; once one is picked its own panel says who joined)
    const packMsg = this.screen === 'pack';
    // (on the story map the line keeps under the map, clear of the panel)
    const storyMsg = this.screen === 'story';
    if (this.msg && !(packMsg && this.picked)) {
      const m = centerText(this, packMsg ? 239 : storyMsg ? 98 : GAME_W / 2, GAME_H - 7, this.msg, PALETTE.gold);
      if (storyMsg) m.setMaxWidth(186);
      L.add(m);
      backPlate(this, m, PALETTE.gold);
    } else if (this.screen === 'home') {
      const tired = store.get().creatures.owned.some((o) => restLeft(o) > 0);
      L.add(text(this, 8, GAME_H - 10, tired ? `FAINTED: RESTS ${REST_MS / 60_000} MIN, OR REVIVE FOR ${REVIVE_COST} TOKENS` : 'TAP A MOVE (?) TO READ WHAT IT DOES', tired ? PALETTE.ash : 0x8a90b0));
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
   * experience towards the next level as a bar, or MAX at the top level.
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
    // ---- each stat on one row: its name, a bar, its number -- the bar
    // fitted BETWEEN the two, so neither the name (SPD is three letters
    // wide) nor the number (40/100 is six) can ever sit on top of it
    const row = (label: string, value: string, frac: number, col: number, valCol: number): void => {
      L.add(text(this, x + 4, ty, label, PALETTE.ash));
      const v = text(this, x + w - 4, ty, value, valCol).setOrigin(1, 0);
      L.add(v);
      const bx = x + 4 + 3 * 6 + 3;
      const bwid = Math.max(8, x + w - 4 - Math.ceil(v.width) - 3 - bx);
      this.bar(bx, ty + 2, bwid, frac, col);
      ty += 8;
    };
    // (user, 28 Oct: on the card only the XP bar; the stats are one tap away)
    if (xp !== undefined) {
      row('XP', lv.max ? 'MAX' : `${lv.into}/${lv.need}`, lv.max ? 1 : lv.into / lv.need, lv.max ? PALETTE.gold : 0xc08aff, lv.max ? PALETTE.gold : PALETTE.fog);
      ty -= 8;
    }
    ty += 10;
    // ---- TAP THE CREATURE FOR ITS STATS.  The picture, its name and its
    // role are one button: it lights up under the pointer, and a magnifier
    // badge with STATS on it says there is more inside.
    const hit = this.add.rectangle(x + 2, y + 2, w - 4, artH + 21, 0xffffff, 0.001).setOrigin(0, 0);
    hit.setInteractive({ useHandCursor: true });
    const glow = this.add.rectangle(x + 2, y + 2, w - 4, artH + 21, 0xffffff, 0).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold, 0);
    hit.on('pointerover', () => (glow.setFillStyle(0xffffff, 0.06), glow.setStrokeStyle(1, PALETTE.gold, 1), audio.sfx('ui_hover')));
    hit.on('pointerout', () => (glow.setFillStyle(0xffffff, 0), glow.setStrokeStyle(1, PALETTE.gold, 0)));
    hit.on('pointerdown', () => (audio.sfx('ui_blip'), this.showStats(c, xp)));
    L.add(glow);
    L.add(hit);
    const tagX = x + w - 4;
    const tagY = y + artH - 9;
    const statsTag = smallText(this, tagX - 3, tagY + 2, 'STATS', PALETTE.gold).setOrigin(1, 0);
    L.add(this.add.rectangle(tagX, tagY, Math.ceil(statsTag.width) + 13, 9, 0x0a0d1e, 0.9).setOrigin(1, 0).setStrokeStyle(1, PALETTE.gold));
    const mag = this.add.graphics();
    mag.lineStyle(1, PALETTE.gold, 1).strokeCircle(tagX - Math.ceil(statsTag.width) - 8, tagY + 4, 2);
    mag.lineBetween(tagX - Math.ceil(statsTag.width) - 6.5, tagY + 5.5, tagX - Math.ceil(statsTag.width) - 5, tagY + 7);
    L.add(mag);
    L.add(statsTag);
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
      // (taller rows now the stat bars are off the card: easier to hit)
      const chip = this.add.rectangle(x + 2, ty - 2, w - 4, 12, 0x232a4a).setOrigin(0, 0).setStrokeStyle(1, 0x3a4470);
      L.addAt(chip, L.getIndex(g));
      // (an icon is 11px wide, centred: x+3..x+13; the name starts after it)
      drawAbilityIcon(g, a, x + 8, ty + 4, el.light);
      const name = text(this, x + 15, ty + 1, a.name, PALETTE.cream);
      L.add(name);
      // the "?" that says there is more to read
      const qx = x + w - 9;
      L.add(this.add.rectangle(qx - 1, ty - 1, 7, 10, 0x3a4470).setOrigin(0, 0));
      L.add(text(this, qx, ty + 1, '?', PALETTE.gold));
      // the damage, left of the "?" -- where the name leaves room for it
      if (a.dmg) {
        const d = text(this, qx - 4, ty + 1, String(a.dmg), PALETTE.gold).setOrigin(1, 0);
        if (name.x + name.width + 2 <= d.x - d.width) L.add(d);
        else d.destroy();
      }
      chip.setInteractive({ useHandCursor: true });
      chip.on('pointerover', () => (chip.setFillStyle(0x34407a).setStrokeStyle(1, PALETTE.gold), name.setTint(PALETTE.gold), audio.sfx('ui_hover')));
      chip.on('pointerout', () => (chip.setFillStyle(0x232a4a).setStrokeStyle(1, 0x3a4470), name.setTint(PALETTE.cream)));
      chip.on('pointerdown', () => (audio.sfx('ui_blip'), this.showMove(c, a)));
      ty += 13;
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
    // (user, 28 Oct: the move only -- the creature's strengths are on its
    // STATS page -- in the bigger house font, wrapped inside the box)
    const w = 280;
    const close = (): void => this.draw();
    const veil = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05070f, 0.82).setOrigin(0, 0);
    veil.setInteractive().on('pointerdown', close);
    M.add(veil);
    // THE BODY IN THE SMALL FACE.  In the house font a move with a long
    // element and a long weakness ran the card off the bottom of the screen
    // and took the CLOSE button with it; in the 3x5 face, wrapped, every
    // move fits with room to spare.
    const rows: Array<{ s: string; col: number; gap: boolean }> = [];
    const per = Math.floor((w - 16) / 6);
    const lineOf = (ln: string, col: number): void => {
      wrapWords(ln, per).forEach((s, i) => rows.push({ s, col, gap: i === 0 && rows.length > 0 }));
    };
    lines.forEach((ln, i) => lineOf(ln, i === 0 ? PALETTE.cream : ln.startsWith('SPECIAL') ? PALETTE.gold : PALETTE.fog));
    const LH = 9;
    const textH = rows.reduce((t, r) => t + LH + (r.gap ? 3 : 0), 0);
    // (and never taller than the screen: the button always shows)
    const h = Math.min(GAME_H - 4, 27 + textH + 22);
    const x = (GAME_W - w) / 2;
    const y = Math.max(2, (GAME_H - h) / 2);
    M.add(this.add.rectangle(x, y, w, h, 0x141834).setOrigin(0, 0).setStrokeStyle(1, el.col));
    const g = this.add.graphics();
    drawAbilityIcon(g, a, x + 13, y + 13, el.light);
    M.add(g);
    M.add(text(this, x + 24, y + 8, a.name, PALETTE.gold));
    M.add(text(this, x + w - 6, y + 8, `${c.name.toUpperCase()}`, PALETTE.fog).setOrigin(1, 0));
    M.add(this.add.rectangle(x + 6, y + 22, w - 12, 1, 0x2a3050).setOrigin(0, 0));
    let ly = y + 28;
    for (const r of rows) {
      if (r.gap) ly += 2;
      if (ly + 8 > y + h - 20) break;
      M.add(text(this, x + 8, ly, r.s, r.col));
      ly += LH;
    }
    M.add(button(this, x + w / 2, y + h - 9, 'CLOSE', close, { width: 56, height: 12 }));
  }

  /**
   * ---- A CREATURE'S STATS (user, 28 Oct): opened by tapping it.  Attack,
   * defence, speed and health as bars with their numbers, whether it fights
   * up close or from range, what its element does, and what it is good and
   * bad at -- the things the card has no room for.
   *
   *   ATTACK   its plain attack's damage a second (what it does all fight)
   *   DEFENCE  how hard it is to wear down, out of 10: its health, plus a
   *            point for a guard / reflect / thorns move, one for a heal,
   *            and one for STONE, which shrugs damage off
   */
  private showStats(c: Creature, xp?: number): void {
    this.modal?.destroy(true);
    const M = this.add.container(0, 0).setDepth(600);
    this.modal = M;
    const el = ELEMENTS[c.element];
    const close = (): void => this.draw();
    const veil = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05070f, 0.82).setOrigin(0, 0);
    veil.setInteractive().on('pointerdown', close);
    M.add(veil);
    const w = 284;
    const h = 146;
    const x = (GAME_W - w) / 2;
    const y = (GAME_H - h) / 2;
    M.add(this.add.rectangle(x, y, w, h, 0x141834).setOrigin(0, 0).setStrokeStyle(1, el.col));
    // the creature, big, on its element's ground
    M.add(this.add.rectangle(x + 4, y + 4, 70, 56, el.dark, 0.6).setOrigin(0, 0));
    const pic = this.add.graphics();
    M.add(pic);
    drawCreature(pic, c, x + 39, y + 34, 2, 1, 0);
    const lvl = xp !== undefined ? `LV ${levelOf(xp)}` : 'LV 1';
    M.add(text(this, x + 80, y + 6, c.name.toUpperCase(), PALETTE.gold));
    M.add(text(this, x + w - 6, y + 6, lvl, PALETTE.cream).setOrigin(1, 0));
    M.add(text(this, x + 80, y + 16, `${c.role} - ${el.name}`, el.light));
    // ---- the four stats
    const n = c.attacks[0];
    const atk = Math.round(n.dmg / Math.max(0.1, n.cd));
    const guards = c.attacks.some((a) => a.kind === 'shield' || ['guard', 'reflect', 'thorns'].includes(a.mod));
    const heals = c.attacks.some((a) => a.kind === 'mend' || ['regen', 'drain'].includes(a.mod));
    const def = Phaser.Math.Clamp(Math.round(c.hp / 17) + (guards ? 1 : 0) + (heals ? 1 : 0) + (c.element === 'stone' ? 1 : 0), 1, 10);
    const melee = (n.kind === 'beam' && n.reach < 50) || n.kind === 'dash';
    let sy = y + 28;
    const stat = (label: string, value: string, frac: number, col: number): void => {
      M.add(text(this, x + 80, sy, label, PALETTE.ash));
      const v = text(this, x + w - 6, sy, value, PALETTE.cream).setOrigin(1, 0);
      M.add(v);
      const bx = x + 80 + 8 * 6;
      const bw = x + w - 6 - Math.ceil(v.width) - 4 - bx;
      M.add(this.add.rectangle(bx, sy + 2, bw, 4, 0x0a0d1e).setOrigin(0, 0));
      M.add(this.add.rectangle(bx, sy + 2, Math.max(1, bw * Phaser.Math.Clamp(frac, 0, 1)), 4, col).setOrigin(0, 0));
      sy += 9;
    };
    stat('ATTACK', `${atk}/SEC`, atk / 24, 0xff8a6a);
    stat('DEFENCE', `${def}/10`, def / 10, 0xc8b890);
    stat('SPEED', String(c.speed), c.speed / 90, 0x6ac8e8);
    stat('HP', String(c.hp), c.hp / 160, 0x6ad86a);
    let ly = y + 66;
    const line = (s: string, col: number): void => {
      for (const ln of wrapWords(s, Math.floor((w - 16) / 6))) {
        M.add(text(this, x + 8, ly, ln, col));
        ly += 9;
      }
    };
    line(melee ? 'FIGHTS UP CLOSE: A MELEE FIGHTER' : `FIGHTS FROM RANGE: SHOTS UP TO ${Math.max(1, Math.round(n.reach / 16))} TILES`, melee ? 0xffb08a : 0x9ad0ff);
    line(`${el.name}: ${el.effect}`, el.light);
    ly += 2;
    line(`GOOD AT: ${c.strong}`, PALETTE.mossLight);
    line(`WEAK: ${c.weak}`, 0xff9a9a);
    M.add(button(this, x + w / 2, y + h - 9, 'CLOSE', close, { width: 56, height: 12 }));
  }

  // ----------------------------------------------------------------- screens

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
      const rest = restLeft(o);
      if (rest > 0) {
        // FAINTED: still in its slot (log #3), out of sight under the band, with its clock
        this.shown.pop();
        // (a band across the picture, under its level and element tags)
        L.add(this.add.rectangle(x + 1, y + 16, w - 2, 21, 0x0a0c18, 0.82).setOrigin(0, 0));
        const left = Math.ceil(rest / 1000);
        const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        L.add(centerText(this, x + w / 2, y + 21, 'FAINTED', 0xff8a8a));
        L.add(centerText(this, x + w / 2, y + 31, `RESTING ${clock}`, PALETTE.cream));
      }
      if (rest > 0) {
        // (what reviving costs is on the button's own line under the cards: RELEASE has the rest of the row)
        L.add(button(this, x + 23, y + h + 10, 'REVIVE', () => (this.say(revive(o.uid)), this.draw()), { width: 44, height: 12, disabled: ledger.balance() < REVIVE_COST }));
      } else if (on) {
        // the one that fights: a gold chip where USE would be
        L.add(this.add.rectangle(x + 2, y + h + 4, 42, 12, 0x3a2e10).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold));
        L.add(centerText(this, x + 23, y + h + 10, 'ACTIVE', PALETTE.gold));
      } else L.add(button(this, x + 23, y + h + 10, 'USE', () => (this.say(setActive(o.uid)), this.draw()), { width: 42, height: 12 }));
      L.add(button(this, x + w - 24, y + h + 10, 'RELEASE', () => this.confirmRelease(o.uid, cr), { width: 44, height: 12, fill: 0x2a1424, hoverFill: 0x5a2040 }));
    }
    // ---- the menu, on the right
    const mx = 207;
    const mw = GAME_W - mx - 8;
    L.add(this.add.rectangle(mx - 4, 21, mw + 8, GAME_H - 34, 0x0e1124, 0.9).setOrigin(0, 0).setStrokeStyle(1, 0x2a3050));
    L.add(text(this, mx, 25, 'MENU', PALETTE.ash));
    const busy = !!c.pending;
    const run = c.ladder;
    const resting = !!act && restLeft(act) > 0;
    // STORY MODE, in place of the zone battles (user, 28 Oct)
    const sw = Math.min(c.story.cleared, WORLDS.length - 1);
    const storySub = c.story.cleared >= WORLDS.length ? 'ALL WORLDS DONE' : `WORLD ${sw + 1} OF ${WORLDS.length}`;
    this.tile(mx, 34, mw, 24, 'STORY MODE', resting ? 'RESTING' : act ? storySub : 'NO CREATURE', 0xff5a6a, (g, x, y, col) => drawAttackIcon(g, 'dash', x, y, col), () => ((this.storyW = sw), (this.mark = { x: WORLD_AT[sw][0], y: WORLD_AT[sw][1] - 20 }), this.go('story')), !act || resting);
    const ladderOpen = c.story.cleared >= WORLDS.length || !!run;
    this.tile(mx, 61, mw, 24, 'LADDER', !ladderOpen ? 'AFTER STORY' : run ? (run.level > LADDER_LEVELS ? 'FINAL BOSS NEXT' : `LEVEL ${run.level} OF ${LADDER_LEVELS}`) : `ENTRY ${LADDER_COST} TOK`, PALETTE.gold, (g, x, y, col) => {
      // three rungs
      g.fillStyle(col, 1).fillRect(x - 5, y - 7, 2, 14).fillRect(x + 3, y - 7, 2, 14);
      for (const k of [-4, 0, 4]) g.fillRect(x - 3, y + k, 6, 1);
    }, () => this.go('ladder'), !act && !run);
    // TRAINING: free, no stake, a dummy that cannot hurt you -- in the place
    // last picked on the zone map
    this.tile(mx, 88, mw, 24, 'TRAINING', act ? 'FREE, SAFE' : 'NO CREATURE', 0x6ad8f0, (g, x, y, col) => {
      // a straw dummy on its post
      g.fillStyle(col, 1).fillRect(x - 1, y - 6, 3, 3).fillRect(x - 3, y - 3, 7, 5).fillRect(x, y + 2, 1, 5).fillRect(x - 5, y - 2, 11, 1);
    }, () => this.train(this.biome), !act);
    const full = c.owned.length >= MAX_OWNED && !busy;
    this.tile(mx, 115, mw, 24, 'RECRUIT', busy ? 'PACK WAITING' : full ? 'TEAM IS FULL' : `${PACK_COST} TOKENS`, 0x8a6aff, (g, x, y, col) => {
      g.fillStyle(0x14100c, 1).fillRect(x - 6, y - 5, 9, 12).fillRect(x - 2, y - 7, 9, 12);
      g.fillStyle(col, 0.6).fillRect(x - 5, y - 4, 7, 10);
      g.fillStyle(col, 1).fillRect(x - 1, y - 6, 7, 10);
      g.fillStyle(0x14100c, 1).fillRect(x + 2, y - 3, 1, 3).fillRect(x + 2, y + 1, 1, 1);
    }, () => this.go(busy ? 'pack' : 'recruit'));
    // (the keys, on a keyboard only: a phone's controls are on the screen -- C7)
    if (!isTouch())
      this.tile(mx, 142, mw, 24, 'HOW TO PLAY', 'MOVES, STATS, EFFECTS', 0x4ad0c0, (g, x, y, col) => {
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
    // (the first one is a recruit like any other: there is no free starter)
    const first = recovery && c.pulls === 0;
    L.add(centerText(this, GAME_W / 2, 22, first ? 'RECRUIT YOUR FIRST CREATURE' : recovery ? 'RECRUIT - YOU HAVE NO CREATURES LEFT' : 'RECRUIT', recovery ? PALETTE.gold : PALETTE.cream));
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
    if (c.pending) {
      // (one paid for and left for later: back to its nine cards)
      L.add(button(this, GAME_W / 2, 132, 'YOUR PACK', () => this.go('pack'), { width: 96, height: 13 }));
      return;
    }
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
    // (three rows end at y 160: the line under them never touches a card)
    const ch = 41;
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
      this.shown.push({ c: cr, x: x + cw / 2, y: y + 16, s: 1.2, f: 1 });
      // (no name on the small cards: the big one beside them has it)
      L.add(centerText(this, x + cw / 2, y + 31, el.name, el.light));
      L.add(this.add.rectangle(x + 3, y + ch - 5, cw - 6, 2, el.col).setOrigin(0, 0));
    });
    if (this.picked) {
      const cr = creatureById(cards[this.picked.index])!;
      this.card(cr, 166, 26, 146, 118);
      // WHAT IT IS GOOD AT, AND WHERE IT IS WEAK (log #42: on creature select),
      // in the small type under its card, two lines at most each
      let ly = 148;
      const lines = (label: string, s: string, col: number): void => {
        for (const ln of wrapWords(`${label} ${s}`, 36).slice(0, 2)) {
          L.add(smallText(this, 168, ly, ln, col));
          ly += 7;
        }
      };
      lines('GOOD AT:', cr.strong, PALETTE.mossLight);
      lines('WEAK:', cr.weak, 0xff9a9a);
      L.add(button(this, 82, 170, 'CONTINUE', () => {
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
      L.add(text(this, 166, 112, 'BACK LEAVES IT FOR LATER:', PALETTE.ash));
      L.add(text(this, 166, 122, 'RECRUIT OPENS IT AGAIN.', PALETTE.ash));
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
      // the world in little: its own floor (art/arenaFloors), the same as in the ring
      const pic = this.add.graphics();
      paintFloor(pic, b.id, { x, y, w: 58, h: 40 }, b.ground, b.groundDark, b.id, 0.45);
      pic.setMask(this.make.graphics({}, false).fillStyle(0xffffff).fillRect(x, y, 58, 40).createGeometryMask());
      L.add(pic);
      const tile = this.add.rectangle(x, y, 58, 40, 0x000000, 0.001).setOrigin(0, 0).setStrokeStyle(sel ? 2 : 1, sel ? PALETTE.gold : b.groundDark);
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
  /**
   * ---- STORY MODE: THE MAP (B7).  The five worlds along a path of stepping
   * stones, each a round window on its own ground; your creature hops along
   * to the one you pick.  Beaten ones are ringed in gold, the open one in
   * cream, the rest are locked.  On the right, the world picked: its
   * levels, its five stages (four battles and the boss) with how far you
   * are, who is next, and what the next fight costs and pays.
   */
  private story(): void {
    const L = this.layer;
    const c = store.get().creatures;
    L.add(text(this, 8, 18, 'STORY MODE', PALETTE.gold));
    // the path: stepping stones from world to world
    const path = this.add.graphics();
    for (let i = 0; i < WORLDS.length - 1; i++) {
      const [x0, y0] = WORLD_AT[i];
      const [x1, y1] = WORLD_AT[i + 1];
      const n = 6;
      for (let k = 1; k < n; k++) {
        const x = x0 + ((x1 - x0) * k) / n;
        const y = y0 + ((y1 - y0) * k) / n + Math.sin((k / n) * Math.PI) * 8;
        path.fillStyle(i < c.story.cleared ? PALETTE.gold : 0x3a4060, 1).fillCircle(x, y, 1.5);
      }
    }
    L.add(path);
    WORLDS.forEach((w, i) => {
      const [x, y] = WORLD_AT[i];
      const open = worldOpen(i, c);
      const done = i < c.story.cleared;
      const b = BIOMES.find((q) => q.id === w.biome)!;
      const pic = this.add.graphics();
      paintFloor(pic, w.biome, { x: x - 14, y: y - 14, w: 28, h: 28 }, b.ground, b.groundDark, w.id, 0.35);
      pic.setMask(this.make.graphics({}, false).fillStyle(0xffffff).fillCircle(x, y, 13).createGeometryMask());
      L.add(pic);
      const ring = this.add.circle(x, y, 13, 0x000000, open ? 0.001 : 0.6).setStrokeStyle(i === this.storyW ? 2 : 1, done ? PALETTE.gold : open ? PALETTE.cream : 0x3a4060);
      ring.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.storyW = i;
        audio.sfx('ui_blip', 0.4);
        this.draw();
      });
      L.add(ring);
      if (!open) {
        // a padlock
        const g = this.add.graphics();
        g.lineStyle(1.5, 0x8a90b0, 1).strokeCircle(x, y - 2, 3);
        g.fillStyle(0x8a90b0, 1).fillRect(x - 4, y - 1, 8, 6);
        L.add(g);
      }
      L.add(centerSmall(this, x, y + 18, `${i + 1}`, done ? PALETTE.gold : open ? PALETTE.cream : 0x5a6080));
    });
    // your creature, the marker
    const me = activeCreature();
    if (me) this.shown.push({ c: me, x: this.mark.x, y: this.mark.y, s: 1.1, f: 1, hop: true });
    // ---- the world picked
    const w = WORLDS[this.storyW];
    const i = this.storyW;
    const open = worldOpen(i, c);
    const replay = isReplay(i, c);
    const stage = c.story.stage[i] ?? 0;
    const px = 198;
    L.add(this.add.rectangle(px, 26, 116, 140, 0x1a1e38).setOrigin(0, 0).setStrokeStyle(1, open ? PALETTE.gold : 0x2a3050));
    wrapWords(w.name, 18).slice(0, 2).forEach((ln, k) => L.add(text(this, px + 4, 30 + k * 9, ln, PALETTE.gold)));
    L.add(text(this, px + 4, 49, `LEVELS ${w.lo}-${w.hi}`, PALETTE.cream));
    wrapWords(w.blurb, 27).slice(0, 2).forEach((ln, k) => L.add(smallText(this, px + 4, 60 + k * 7, ln, PALETTE.ash)));
    // the five stages: four battles and the boss
    const sg = this.add.graphics();
    for (let k = 0; k <= STAGES; k++) {
      const x = px + 14 + k * 20;
      const yy = 84;
      const boss = k === STAGES;
      const past = open && k < stage;
      const next = open && k === stage;
      if (k > 0) sg.fillStyle(past ? PALETTE.gold : 0x3a4060, 1).fillRect(x - 16, yy, 12, 1);
      sg.fillStyle(past ? PALETTE.gold : 0x12152a, 1).fillCircle(x, yy, boss ? 6 : 4);
      sg.lineStyle(next ? 2 : 1, next ? PALETTE.cream : boss ? 0xff5a6a : 0x3a4060, 1).strokeCircle(x, yy, boss ? 6 : 4);
      if (boss) sg.fillStyle(past ? 0x1a1e38 : 0xff5a6a, 1).fillRect(x - 2, yy - 2, 1, 2).fillRect(x + 1, yy - 2, 1, 2).fillRect(x - 1, yy + 1, 2, 1);
    }
    L.add(sg);
    if (!open) {
      L.add(text(this, px + 4, 98, 'LOCKED', 0xff9a9a));
      wrapWords(`BEAT ${WORLDS[i - 1].bossName} TO OPEN IT.`, 18).forEach((ln, k) => L.add(text(this, px + 4, 108 + k * 9, ln, PALETTE.ash)));
      return;
    }
    const nextLine = stage >= STAGES ? `BOSS: ${w.bossName}` : `BATTLE ${stage + 1}/${STAGES}: ${creatureById(lineupFoe(i, stage))!.name.toUpperCase()} LV ${stageLevel(i, stage)}`;
    wrapWords(nextLine, 18).slice(0, 2).forEach((ln, k) => L.add(text(this, px + 4, 96 + k * 9, ln, stage >= STAGES ? 0xff9a9a : PALETTE.cream)));
    const price = storyPrice(i, replay);
    L.add(text(this, px + 4, 113, `WIN: +${price.win} TOKENS`, PALETTE.mossLight));
    // (no loss line: the user's call, 28 Oct; a replay says why it pays less)
    if (replay) L.add(smallText(this, px + 4, 123, 'REPLAY: BOSS ALREADY BEATEN', PALETTE.ash));
    const act = activeOwned();
    const resting = !!act && restLeft(act) > 0;
    L.add(button(this, px + 58, 146, `FIGHT  ${price.cost} TOK`, () => this.storyFight(i), { width: 106, height: 14, disabled: !act || resting || ledger.balance() < price.cost }));
    if (resting) L.add(smallText(this, px + 4, 157, 'YOUR CREATURE IS RESTING', 0xff9a9a));
  }

  private storyFight(w: number): void {
    this.scene.start('CreatureArena', { mode: 'story', world: w, from: this.from });
  }

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
    // (few words, all of them inside the panel: 18 letters is as wide as it holds)
    L.add(text(this, px + 4, 30, `ENTRY: ${LADDER_COST} TOKENS`, PALETTE.gold));
    L.add(text(this, px + 4, 44, LADDER_WIN ? `+${LADDER_WIN} EACH LEVEL` : `WIN ${LADDER_BOSS_WIN} TOKENS`, PALETTE.mossLight));
    L.add(text(this, px + 4, 58, `BOSSES ${c.bossesBeaten.length}/${BOSSES.length}`, PALETTE.gold));
    L.add(text(this, px + 4, 80, `TOKENS: ${ledger.balance()}`, PALETTE.cream));
    if (run) {
      L.add(text(this, px + 4, 94, LADDER_WIN ? `THIS RUN: +${run.earned}` : `BOSS PAYS ${LADDER_BOSS_WIN}`, PALETTE.gold));
      L.add(button(this, px + 59, 134, run.level > LADDER_LEVELS ? 'FIGHT THE BOSS' : `CONTINUE - LV ${run.level}`, () => this.ladderFight(), { width: 108, height: 13, disabled: !activeOwned() }));
      L.add(button(this, px + 59, 151, 'ABANDON RUN', () => this.confirmAbandon(), { width: 108, height: 12, fill: 0x2a1424, hoverFill: 0x5a2040 }));
    } else {
      const unlocked = c.story.cleared >= WORLDS.length;
      const can = ledger.balance() >= LADDER_COST && !!activeOwned() && unlocked;
      L.add(button(this, px + 59, 138, 'START RUN', () => this.confirmStart(), { width: 108, height: 13, disabled: !can }));
      if (!unlocked) L.add(smallText(this, px + 4, 148, 'AFTER THE STORY', 0xff9a9a));
      else if (!activeOwned()) L.add(text(this, px + 4, 148, 'NEED A CREATURE', PALETTE.ash));
    }
  }

  /** Ask first: the entry fee is taken only after a yes. */
  private confirmStart(): void {
    if (this.dialog) return;
    this.dialog = confirmDialog(this, {
      lines: [`START A LADDER RUN FOR ${LADDER_COST} TOKENS?`, `YOU HAVE ${ledger.balance()}.`],
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

  /**
   * ---- HOW TO PLAY (user, 28 Oct: "a better tutorial for beginners --
   * stats, effects, buffs, debuffs, cooldowns").  A step at a time: a moving
   * picture on the left (ui/tutorialDemos `clash.*`), what it means on the
   * right in plain words, < and > to go through them.  The last step is the
   * controls, as this device works them.
   */
  private controls(): void {
    const L = this.layer;
    const key = (k: string): string => capLabel(codeFor(`creatureclash:${k}`));
    const touch = isTouch();
    const steps: Array<{ demo: string; say: string }> = [
      { demo: 'clash.move', say: touch ? 'THE STICK MOVES YOUR CREATURE. EACH MOVE BUTTON FIRES THAT MOVE STRAIGHT AT THE FOE.' : 'W A S D MOVES YOUR CREATURE. AIM WITH THE MOUSE AND CLICK TO FIRE THE MOVE YOU HAVE PICKED.' },
      { demo: 'clash.moves', say: 'EVERY CREATURE HAS THREE MOVES: A PLAIN ATTACK AND TWO SPECIALS. AFTER A MOVE IS USED IT HAS TO RECHARGE - ITS COOLDOWN. THE RING ROUND ITS BUTTON FILLS BACK UP, AND THEN IT IS READY.' },
      { demo: 'clash.stats', say: "TAP A CREATURE'S CARD FOR ITS STATS. HP: HOW MUCH IT CAN TAKE. ATTACK: HOW HARD IT HITS. DEFENCE: HOW WELL IT LASTS. SPEED: HOW FAST IT MOVES. MELEE FIGHTS UP CLOSE, RANGED FROM AFAR." },
      { demo: 'clash.elements', say: 'EACH CREATURE HAS AN ELEMENT, AND EVERY HIT IT LANDS CARRIES ITS EDGE: EMBER BURNS, TIDE KNOCKS BACK, FROST SLOWS, VOLT STUNS, STONE TAKES LESS. TAP ? BY A MOVE TO READ JUST WHAT IT DOES.' },
      { demo: 'clash.debuffs', say: 'DEBUFFS GO ON THE FOE FOR A FEW SECONDS: POISON AND BURNS HURT EVERY SECOND, SLOW AND HOLD STOP IT MOVING, SILENCE PUTS ITS MOVES BACK ON COOLDOWN, WEAKEN SOFTENS ITS HITS.' },
      { demo: 'clash.buffs', say: 'BUFFS HELP YOU FOR A FEW SECONDS: HASTE, GUARD, REGROW, EVASION (30% OF HITS MISS), FOCUS (+20% CRITS), FURY (+25% DAMAGE), QUICKEN (FASTER COOLDOWNS). THE NAME POPS UP OVER YOU.' },
      { demo: 'clash.cover', say: 'ROCKS AND WALLS STOP SHOTS: GET BEHIND ONE TO DODGE. BUT A LOBBED MOVE FLIES OVER COVER, AND GLOW SHOTS GO RIGHT THROUGH IT.' },
      { demo: 'clash.story', say: 'STORY MODE: FIVE WORLDS, EACH FOUR BATTLES AND A BOSS. WINS PAY TOKENS AND XP, AND XP LEVELS YOUR CREATURE UP. BEAT THE LAST BOSS TO OPEN THE LADDER. TRAINING IS FREE PRACTICE.' },
      {
        demo: 'clash.keys',
        say: touch
          ? 'ON A PHONE THE CONTROLS SIT BESIDE OR UNDER THE ARENA: THE STICK MOVES, AND EACH MOVE BUTTON FIRES ITS MOVE AT THE FOE.'
          : `${key('KeyJ')} ${key('KeyK')} ${key('KeyL')} FIRE MOVES 1, 2 AND 3 STRAIGHT AT THE FOE. 1 2 3 FIRE THEM AT THE MOUSE. W A S D MOVES. ${key('KeyJ')} ${key('KeyK')} ${key('KeyL')} CAN BE MOVED IN THE SETTINGS, UNDER CHANGE KEYS.`,
      },
    ];
    this.howStep = Phaser.Math.Clamp(this.howStep, 0, steps.length - 1);
    const st = steps[this.howStep];
    L.add(centerText(this, GAME_W / 2, 24, 'HOW TO PLAY', PALETTE.gold));
    // the picture, in its box, clipped to it
    const DX = 12;
    const DY = 38;
    L.add(this.add.rectangle(DX - 1, DY - 1, DEMO_W + 2, DEMO_H + 2, 0x000000, 0).setOrigin(0, 0).setStrokeStyle(1, 0x4ad0c0));
    const g = this.add.graphics().setPosition(DX, DY);
    L.add(g);
    const clip = this.make.graphics({}, false);
    clip.fillStyle(0xffffff, 1).fillRect(DX, DY, DEMO_W, DEMO_H);
    const mask = clip.createGeometryMask();
    g.setMask(mask);
    this.demo = { g, id: st.demo, pool: [], t0: this.time.now, clip, mask };
    // the words, beside it
    const RX = DX + DEMO_W + 10;
    L.add(smallText(this, RX, DY, `STEP ${this.howStep + 1} OF ${steps.length}`, PALETTE.tealLight));
    let y = DY + 10;
    for (const ln of wrapWords(st.say, Math.floor((GAME_W - RX - 8) / 6)).slice(0, 11)) {
      L.add(text(this, RX, y, ln, PALETTE.cream));
      y += 9;
    }
    // where you are, and the way through
    const dotsW = steps.length * 8;
    for (let i = 0; i < steps.length; i++) L.add(this.add.rectangle(DX + DEMO_W / 2 - dotsW / 2 + i * 8 + 2, DY + DEMO_H + 6, 4, 4, i === this.howStep ? PALETTE.gold : 0x3a3450).setOrigin(0, 0));
    const go = (d: number): void => {
      this.howStep = Phaser.Math.Clamp(this.howStep + d, 0, steps.length - 1);
      audio.sfx('ui_blip', 0.35);
      this.draw();
    };
    L.add(button(this, GAME_W / 2 + 40, 166, '<', () => go(-1), { width: 30, height: 13, disabled: this.howStep === 0 }));
    L.add(button(this, GAME_W / 2 + 76, 166, '>', () => go(1), { width: 30, height: 13, disabled: this.howStep === steps.length - 1 }));
  }

  /** HOW TO PLAY's picture, this frame (see `controls`). */
  private drawDemo(time: number): void {
    const d = this.demo;
    if (!d || this.screen !== 'controls') return;
    d.g.clear();
    let used = 0;
    const lbl = (x: number, y: number, str: string, col: number = PALETTE.cream): void => {
      if (!str) return;
      let t = d.pool[used];
      if (!t) {
        t = smallText(this, 0, 0, '', col).setOrigin(0.5, 0.5);
        t.setMask(d.mask);
        this.layer.add(t);
        d.pool.push(t);
      }
      used++;
      t.setText(str).setTint(col).setPosition(Math.round(d.g.x + x), Math.round(d.g.y + y)).setVisible(true);
    };
    demoFor(d.id)(d.g, (time - d.t0) / 1000, lbl);
    for (let i = used; i < d.pool.length; i++) d.pool[i].setVisible(false);
  }

}
