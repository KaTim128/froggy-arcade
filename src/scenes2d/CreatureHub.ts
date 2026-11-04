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

import { ULT_COOLDOWN_S, ULT_UNLOCK_S, ultimateOf } from '../game/ultimates';
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
import { battleXp, levelOf, xpProgress } from '../game/creatureLevel';
import { traitsOf } from '../game/creatureTraits';
import { MINI_INFO, MINI_MIN_COST, MINI_PRICE, TEAM_SIZE, drawPool, roleOf, startMini, type MiniKind } from '../game/creatureMinis';
import { paintTrailScenery } from '../art/trailScenery';
import { DEMO_H, DEMO_W, demoFor } from '../ui/tutorialDemos';
import {
  BATTLE_COST, BATTLE_WIN, BIOMES, CREATURES, ELEMENTS, LADDER_BOSS_WIN, LADDER_COST, LADDER_LEVELS, LADDER_WIN, BOSSES, bossById, creatureById, type Attack, type Creature,
} from '../game/creatures';
import { abandonLadder, packPrice, activeCreature, activeOwned, nodeState, storyBest, trailNode, worldOpen, ownedCreature, needsRecovery, restLeft, openPack, pickCard, recruitChosen, canChooseRecruit, release, retreat, setActive, startLadder } from '../game/creatureClash';

type Screen = 'home' | 'recruit' | 'choose' | 'pack' | 'map' | 'story' | 'trail' | 'ladder' | 'controls' | 'minis' | 'minipick';
const SCREENS: Screen[] = ['home', 'story', 'trail', 'ladder', 'recruit', 'controls', 'minis'];

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

/**
 * ---- EACH WORLD'S OWN TRAIL (user, 2 Nov): its five fights as stops along
 * a path of its own shape across its own ground -- Mosswood's winds up
 * through the trees, the Sunken Ruins' sinks down into the deep, Emberfall's
 * circles the crater's rim, the Crystal Depths' zigzags between the shards,
 * and the Void Citadel's is a straight stair up to its throne.  Node 4 is
 * the boss.  (In the left 198 pixels, under the header; the panel is on the right.)
 */
const TRAIL_AT: Array<Array<[number, number]>> = [
  [[26, 150], [76, 132], [44, 96], [104, 74], [160, 46]],
  [[24, 44], [76, 72], [140, 52], [158, 112], [86, 148]],
  [[34, 156], [150, 150], [168, 92], [60, 96], [104, 50]],
  [[100, 158], [36, 122], [164, 112], [50, 64], [156, 44]],
  [[22, 160], [62, 132], [102, 104], [142, 76], [176, 44]],
];

/** Where your creature stands at stop `k` of world `w`'s trail: beside it, on its left (the marker is drawn 20 above this). */
const trailMark = (w: number, k: number): [number, number] => [TRAIL_AT[w][k][0] - (k === STAGES ? 19 : 16), TRAIL_AT[w][k][1] + 22];

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

/** Team tiles on a page: two across, four down (the page arrows go under them). */
const TEAM_PAGE = 8;

export class CreatureHub extends Phaser.Scene {
  private screen: Screen = 'home';
  /** Which page of every creature the admin's recruit is on. */
  private choosePage = 0;
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
  /** Where the marker is headed: a world on the map, or a stop on a world's trail. */
  private markTo: [number, number] = WORLD_AT[0];
  /** The stop picked on the world's trail. */
  private trailSel = 0;
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
      // (back from a fight: on that world's trail, at its next stop)
      this.trailSel = trailNode(data.world);
      const at = data.screen === 'trail' ? trailMark(data.world, this.trailSel) : WORLD_AT[data.world];
      this.markTo = at;
      this.mark = { x: at[0], y: at[1] - 20 };
    }
    this.msg = data.msg ?? '';
    this.want = SCREENS.includes(data.screen as Screen) ? (data.screen as Screen) : null;
    this.picked = null;
    this.dialog = null;
  }

  create(): void {
    // its own music (user, 1 Nov: every arcade game has its own)
    audio.setScene({ music: 'game_clash_hub', ambience: ['cabinet_bleeps'] });
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
    // (no clock to keep current: a fainted creature waits for REVIVE, it
    // does not rest.  The once-a-second redraw that ran while one was down
    // shut a STATS or move card a moment after it opened.)
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
      if (this.screen !== 'home' && this.screen !== 'recruit') this.back();
    });
    // the trail by keyboard: LEFT / RIGHT between its stops, ENTER to fight
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (this.dialog || this.modal || this.screen !== 'trail') return;
      const best = trailNode(this.storyW);
      if (e.code === 'ArrowLeft' || e.code === 'ArrowDown') this.pickStop(Math.max(0, this.trailSel - 1));
      else if (e.code === 'ArrowRight' || e.code === 'ArrowUp') this.pickStop(Math.min(best, this.trailSel + 1));
      else if (e.code === 'Enter' || e.code === 'Space') this.trailFight();
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
        const [tx, ty] = this.markTo;
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

  /** BACK: a world's trail goes back to the map of worlds; everything else to the team. */
  private back(): void {
    if (this.screen === 'minipick') {
      this.go('minis');
      return;
    }
    if (this.screen === 'trail') {
      this.markTo = WORLD_AT[this.storyW];
      this.mark = { x: WORLD_AT[this.storyW][0], y: WORLD_AT[this.storyW][1] - 20 };
      this.go('story');
      return;
    }
    this.go(store.get().creatures.owned.length ? 'home' : 'recruit');
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
    } else if (!(this.screen === 'pack' && this.picked)) L.add(button(this, GAME_W - 26, 8, 'BACK', () => this.back(), { width: 44, height: 11 }));
    ({ home: () => this.home(), recruit: () => this.recruit(), choose: () => this.chooseAny(), pack: () => this.pack(), map: () => this.map(), story: () => this.story(), trail: () => this.trail(), ladder: () => this.ladder(), controls: () => this.controls(), minis: () => this.minis(), minipick: () => this.miniPick() })[this.screen]();
    // (on the pack screen the line keeps to the right-hand column, clear of
    // the cards; once one is picked its own panel says who joined)
    const packMsg = this.screen === 'pack';
    // (on the story map the line keeps under the map, clear of the panel)
    const storyMsg = this.screen === 'story' || this.screen === 'trail';
    if (this.msg && !(packMsg && this.picked)) {
      const m = centerText(this, packMsg ? 239 : storyMsg ? 98 : GAME_W / 2, GAME_H - 7, this.msg, PALETTE.gold);
      if (storyMsg) m.setMaxWidth(186);
      L.add(m);
      backPlate(this, m, PALETTE.gold);
    } else if (this.screen === 'home') {
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
    // (the icon's well fits the tile: a short one gets a smaller well)
    const ws = Math.min(18, h - 2);
    const wx = ws < 18 ? 6 : 7;
    g.fillStyle(0x0a0d1e, 1).fillRect(wx, (h - ws) / 2, ws, ws);
    g.lineStyle(1, well, 0.7).strokeRect(wx + 0.5, (h - ws) / 2 + 0.5, ws - 1, ws - 1);
    icon(g, wx + ws / 2, h / 2, disabled ? PALETTE.ash : col);
    const tx = wx + ws + (ws < 18 ? 4 : 5);
    // no second line (the home menu, user 4 Nov): the label alone, centred
    // on the tile's height; otherwise one line of the big type and one of
    // the small on a short tile, two of the big on a tall one
    const short = h < 24;
    let t1 = !sub ? text(this, tx, h / 2 - 4, label, disabled ? PALETTE.ash : PALETTE.cream) : text(this, tx, short ? h / 2 - 8 : h / 2 - 9, label, disabled ? PALETTE.ash : PALETTE.cream);
    // ---- TEXT STAYS INSIDE THE BUTTON (user, 4 Nov: "never overlapping the
    // outlines -- keep this rule").  A label that would reach the outline
    // drops to the small type, which every label fits.
    if (tx + t1.width > w - 3) {
      t1.destroy();
      t1 = smallText(this, tx, !sub ? h / 2 - 3 : short ? h / 2 - 6 : h / 2 - 7, label, disabled ? PALETTE.ash : PALETTE.cream);
    }
    const parts: Phaser.GameObjects.GameObject[] = [bg, edge, shine, g, t1];
    if (sub) {
      // (the second line keeps the same rule: the small type when the big one
      // would reach the outline)
      const subCol = disabled ? 0x4a4e68 : PALETTE.fog;
      let t2 = short ? smallText(this, tx, h / 2 + 3, sub, subCol) : text(this, tx, h / 2 + 2, sub, subCol);
      if (tx + t2.width > w - 3) {
        t2.destroy();
        t2 = smallText(this, tx, h / 2 + 3, sub, subCol);
      }
      parts.push(t2);
    }
    c.add(parts);
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
  private card(c: Creature, x: number, y: number, w: number, h: number, big = true, active = false, xp?: number, tall = false, uid?: number): void {
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
    hit.on('pointerdown', () => (audio.sfx('ui_blip'), this.showStats(c, xp, uid)));
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
      // (user, 2 Nov: on the team screen the rows are taller -- there was
      // room under the card -- so each is an easier target)
      // (13, not 17, on the tall card now: the ultimate is a fourth row under them)
      const ch = tall ? 13 : 12;
      const mid = Math.floor((ch - 12) / 2);
      const chip = this.add.rectangle(x + 2, ty - 2, w - 4, ch, 0x232a4a).setOrigin(0, 0).setStrokeStyle(1, 0x3a4470);
      L.addAt(chip, L.getIndex(g));
      // (an icon is 11px wide, centred: x+3..x+13; the name starts after it)
      drawAbilityIcon(g, a, x + 8, ty + 4 + mid, el.light);
      const name = text(this, x + 15, ty + 1 + mid, a.name, PALETTE.cream);
      L.add(name);
      // the "?" that says there is more to read
      const qx = x + w - 9;
      L.add(this.add.rectangle(qx - 1, ty - 1 + mid, 7, 10, 0x3a4470).setOrigin(0, 0));
      L.add(text(this, qx, ty + 1 + mid, '?', PALETTE.gold));
      // the damage, left of the "?" -- where the name leaves room for it
      if (a.dmg) {
        const d = text(this, qx - 4, ty + 1 + mid, String(a.dmg), PALETTE.gold).setOrigin(1, 0);
        if (name.x + name.width + 2 <= d.x - d.width) L.add(d);
        else d.destroy();
      }
      chip.setInteractive({ useHandCursor: true });
      chip.on('pointerover', () => (chip.setFillStyle(0x34407a).setStrokeStyle(1, PALETTE.gold), name.setTint(PALETTE.gold), audio.sfx('ui_hover')));
      chip.on('pointerout', () => (chip.setFillStyle(0x232a4a).setStrokeStyle(1, 0x3a4470), name.setTint(PALETTE.cream)));
      chip.on('pointerdown', () => (audio.sfx('ui_blip'), this.showMove(c, a)));
      ty += ch + 1;
    }
    // ---- THE ULTIMATE, under the moves (user, 4 Nov), in the same kind of
    // row: a gold star, its name, and a "?" that opens what it does
    const ult = ultimateOf(c.id);
    if (ult) {
      const ch = tall ? 13 : 12;
      const mid = Math.floor((ch - 12) / 2);
      const chip = this.add.rectangle(x + 2, ty - 2, w - 4, ch, 0x2e2440).setOrigin(0, 0).setStrokeStyle(1, 0x7a5a2a);
      L.addAt(chip, L.getIndex(g));
      const pts: Phaser.Math.Vector2[] = [];
      for (let k = 0; k < 10; k++) {
        const ang = -Math.PI / 2 + (k * Math.PI) / 5;
        const r = k % 2 ? 1.8 : 4.2;
        pts.push(new Phaser.Math.Vector2(x + 8 + Math.cos(ang) * r, ty + 4 + mid + Math.sin(ang) * r));
      }
      g.fillStyle(0xffd45e, 1).fillPoints(pts, true);
      // (the name in the small type if the house font would run into the "?")
      const qx = x + w - 9;
      let name: Phaser.GameObjects.BitmapText = text(this, x + 15, ty + 1 + mid, ult.name, 0xffd45e);
      if (name.x + name.width > qx - 2) {
        name.destroy();
        name = smallText(this, x + 15, ty + 2 + mid, ult.name, 0xffd45e);
      }
      L.add(name);
      L.add(this.add.rectangle(qx - 1, ty - 1 + mid, 7, 10, 0x5a4420).setOrigin(0, 0));
      L.add(text(this, qx, ty + 1 + mid, '?', PALETTE.gold));
      chip.setInteractive({ useHandCursor: true });
      chip.on('pointerover', () => (chip.setFillStyle(0x3e3060).setStrokeStyle(1, PALETTE.gold), audio.sfx('ui_hover')));
      chip.on('pointerout', () => chip.setFillStyle(0x2e2440).setStrokeStyle(1, 0x7a5a2a));
      chip.on('pointerdown', () => (audio.sfx('ui_blip'), this.showUlt(c)));
    }
  }

  /** The ultimate, said in full: the same kind of panel as a move's. */
  private showUlt(c: Creature): void {
    const ult = ultimateOf(c.id);
    if (!ult) return;
    // (user, 4 Nov: each step in its own clear sentence, in order; no HOW TO
    // USE, no ELEMENT -- the card already says both)
    const rows: Array<[string, number]> =
      ult.steps.length === 1
        ? [[`WHAT IT DOES: ${ult.steps[0]}`, PALETTE.gold]]
        : [['WHAT IT DOES, IN ORDER:', PALETTE.gold], ...ult.steps.map((st, i): [string, number] => [`${i + 1}. ${st}`, PALETTE.cream])];
    rows.push([`READY ${ULT_UNLOCK_S} SEC INTO A FIGHT, THEN AGAIN ${ULT_COOLDOWN_S} SEC AFTER EACH USE.`, 0x8a90b0]);
    this.infoCard(c, `ULTIMATE - ${ult.name}`, rows, 0xffd45e);
  }

  /**
   * One move, said in full.  It is a panel over whatever screen you were on;
   * anything outside it, or the button, puts it away again.
   */
  private showMove(c: Creature, a: Attack): void {
    const el = ELEMENTS[c.element];
    const rows = attackCard(a, c.element).map((ln): [string, number] => [
      ln,
      ln.startsWith('WHAT IT DOES') ? PALETTE.gold : ln.startsWith('ELEMENT') ? el.light : ln.startsWith('DAMAGE') || ln.startsWith('READY') ? 0xffb08a : PALETTE.fog,
    ]);
    this.infoCard(c, a.name, rows, el.col, a);
  }

  /**
   * THE CARD FOR A MOVE OR AN ULTIMATE.  Its own layer over everything; the
   * body in the small face, wrapped, each fact apart from the next (user,
   * 4 Nov: more height between them), and never taller than the screen.  The
   * creature's name sits top right only where it fits beside the title.
   */
  private infoCard(c: Creature, title: string, lines: Array<[string, number]>, edge: number, a?: Attack): void {
    this.modal?.destroy(true);
    const M = this.add.container(0, 0).setDepth(600);
    this.modal = M;
    const w = 308;
    const close = (): void => this.draw();
    const veil = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05070f, 0.82).setOrigin(0, 0);
    veil.setInteractive().on('pointerdown', close);
    M.add(veil);
    const per = Math.floor((w - 18) / 4);
    const rows: Array<{ s: string; col: number; gap: boolean }> = [];
    for (const [ln, col] of lines) wrapWords(ln.toUpperCase(), per).forEach((s, i) => rows.push({ s, col, gap: i === 0 && rows.length > 0 }));
    // roomy if it fits, a little tighter if not
    const room = GAME_H - 4 - 27 - 22;
    const height = (lh: number, gap: number): number => rows.reduce((t, r) => t + lh + (r.gap ? gap : 0), 0);
    const [LH, GAP] = ([[9, 6], [8, 5], [8, 3], [7, 3]] as const).find(([lh, g]) => height(lh, g) <= room) ?? [7, 2];
    const h = Math.min(GAME_H - 4, 27 + height(LH, GAP) + 20);
    const x = (GAME_W - w) / 2;
    const y = Math.max(2, (GAME_H - h) / 2);
    M.add(this.add.rectangle(x, y, w, h, 0x141834).setOrigin(0, 0).setStrokeStyle(1, edge));
    let tx = x + 8;
    if (a) {
      const g = this.add.graphics();
      drawAbilityIcon(g, a, x + 13, y + 13, ELEMENTS[c.element].light);
      M.add(g);
      tx = x + 24;
    }
    const head = text(this, tx, y + 8, title, PALETTE.gold);
    M.add(head);
    const nm = c.name.toUpperCase();
    const right = x + w - 7;
    if (head.x + head.width + 8 + nm.length * 6 <= right) M.add(text(this, right, y + 8, nm, PALETTE.fog).setOrigin(1, 0));
    else if (head.x + head.width + 8 + nm.length * 4 <= right) M.add(smallText(this, right, y + 10, nm, PALETTE.fog).setOrigin(1, 0));
    M.add(this.add.rectangle(x + 6, y + 22, w - 12, 1, 0x2a3050).setOrigin(0, 0));
    let ly = y + 28;
    for (const r of rows) {
      if (r.gap) ly += GAP;
      if (ly + 6 > y + h - 18) break;
      M.add(smallText(this, x + 8, ly, r.s, r.col));
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
  private showStats(c: Creature, xp?: number, uid?: number): void {
    this.modal?.destroy(true);
    const M = this.add.container(0, 0).setDepth(600);
    this.modal = M;
    const el = ELEMENTS[c.element];
    const close = (): void => this.draw();
    const veil = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05070f, 0.82).setOrigin(0, 0);
    veil.setInteractive().on('pointerdown', close);
    M.add(veil);
    // (user, 3 Nov: more detail, clearly spaced -- nearly the whole screen,
    // the points in the small face as bullets in two columns)
    const w = 312;
    const h = 172;
    const x = (GAME_W - w) / 2;
    const y = (GAME_H - h) / 2;
    M.add(this.add.rectangle(x, y, w, h, 0x141834).setOrigin(0, 0).setStrokeStyle(1, el.col));
    // the creature, big, on its element's ground
    M.add(this.add.rectangle(x + 4, y + 4, 66, 50, el.dark, 0.6).setOrigin(0, 0));
    const pic = this.add.graphics();
    M.add(pic);
    drawCreature(pic, c, x + 37, y + 30, 1.9, 1, 0);
    const lvl = xp !== undefined ? `LV ${levelOf(xp)}` : 'LV 1';
    M.add(text(this, x + 76, y + 5, c.name.toUpperCase(), PALETTE.gold));
    M.add(text(this, x + w - 6, y + 5, lvl, PALETTE.cream).setOrigin(1, 0));
    M.add(smallText(this, x + 76, y + 15, `${c.role} - ${el.name} - ${c.moves}`.slice(0, 58), el.light));
    // ---- the four stats
    const n = c.attacks[0];
    const atk = Math.round(n.dmg / Math.max(0.1, n.cd));
    const guards = c.attacks.some((a) => a.kind === 'shield' || ['guard', 'reflect', 'thorns'].includes(a.mod));
    const heals = c.attacks.some((a) => a.kind === 'mend' || ['regen', 'drain'].includes(a.mod));
    const def = Phaser.Math.Clamp(Math.round(c.hp / 17) + (guards ? 1 : 0) + (heals ? 1 : 0) + (c.element === 'stone' ? 1 : 0), 1, 10);
    let sy = y + 24;
    const stat = (label: string, value: string, frac: number, col: number): void => {
      M.add(smallText(this, x + 76, sy, label, PALETTE.ash));
      const v = smallText(this, x + w - 6, sy, value, PALETTE.cream).setOrigin(1, 0);
      M.add(v);
      const bx = x + 76 + 8 * 4;
      const bw = x + w - 6 - Math.ceil(v.width) - 4 - bx;
      M.add(this.add.rectangle(bx, sy + 1, bw, 4, 0x0a0d1e).setOrigin(0, 0));
      M.add(this.add.rectangle(bx, sy + 1, Math.max(1, bw * Phaser.Math.Clamp(frac, 0, 1)), 4, col).setOrigin(0, 0));
      sy += 8;
    };
    stat('ATTACK', `${atk}/SEC`, atk / 24, 0xff8a6a);
    stat('DEFENCE', `${def}/10`, def / 10, 0xc8b890);
    stat('SPEED', String(c.speed), c.speed / 90, 0x6ac8e8);
    stat('HP', String(c.hp), c.hp / 160, 0x6ad86a);
    // ---- how it fights, and its element
    const t = traitsOf(c);
    M.add(smallText(this, x + 6, y + 58, t.style, 0x9ad0ff));
    M.add(smallText(this, x + 6, y + 66, t.element.slice(0, 76), el.light));
    // ---- its ULTIMATE (game/ultimates): up 30s into a fight, then every 25s
    const ult = ultimateOf(c.id);
    const ulines = ult ? wrapWords(`ULTIMATE - ${ult.name}: ${ult.desc}`.toUpperCase(), 75).slice(0, 3) : [];
    ulines.forEach((ln, i) => M.add(smallText(this, x + 6, y + 74 + i * 7, ln, i ? 0xf0d890 : 0xffd45e)));
    const top = y + 74 + ulines.length * 7 + 1;
    M.add(this.add.rectangle(x + 4, top, w - 8, 1, 0x2a3050).setOrigin(0, 0));
    // ---- strengths | weaknesses, side by side, a bullet each
    const colW = (w - 18) / 2;
    const per = Math.floor((colW - 8) / 4);
    const column = (cx: number, title: string, col: number, items: string[]): void => {
      M.add(text(this, cx, top + 3, title, col));
      let ly = top + 14;
      for (const item of items) {
        const lines = wrapWords(item.toUpperCase(), per);
        if (ly + lines.length * 7 > y + h - 18) break;
        M.add(this.add.rectangle(cx + 1, ly + 2, 2, 2, col).setOrigin(0, 0));
        lines.forEach((ln, i) => M.add(smallText(this, cx + 6, ly + i * 7, ln, PALETTE.cream)));
        ly += lines.length * 7 + 3;
      }
    };
    column(x + 6, 'GOOD AT', PALETTE.mossLight, t.strengths);
    M.add(this.add.rectangle(x + w / 2, top + 3, 1, y + h - 19 - top - 3, 0x2a3050).setOrigin(0, 0));
    column(x + w / 2 + 5, 'WEAK AGAINST', 0xff9a9a, t.weaknesses);
    M.add(button(this, x + w / 2, y + h - 9, 'CLOSE', close, { width: 56, height: 12 }));
    // ---- RELEASE (user, 4 Nov): only on one of your own, in the far corner
    // -- a long way from CLOSE, in a dark red, so it is never hit by mistake
    // -- and it asks before it does anything
    if (uid !== undefined) {
      M.add(button(this, x + w - 32, y + h - 9, 'RELEASE', () => this.confirmRelease(uid, c), { width: 52, height: 12, fill: 0x3a1420, hoverFill: 0x6a2030, textColor: 0xff9a9a }));
    }
  }

  /** Are you sure?  Releasing is for good. */
  private confirmRelease(uid: number, cr: Creature): void {
    if (this.dialog) return;
    const last = store.get().creatures.owned.length === 1;
    this.dialog = confirmDialog(this, {
      lines: [`RELEASE ${cr.name.toUpperCase()}?`, 'IT WILL NOT COME BACK.', ...(last ? ['IT IS YOUR LAST ONE.'] : [])],
      confirm: 'RELEASE',
      onConfirm: () => {
        this.dialog = null;
        this.modal?.destroy(true);
        this.modal = null;
        this.say(release(uid));
        this.screen = needsRecovery() ? 'recruit' : 'home';
        this.draw();
      },
      onCancel: () => {
        this.dialog?.destroy();
        this.dialog = null;
      },
    });
  }

  // ----------------------------------------------------------------- screens

  private home(): void {
    const L = this.layer;
    const c = store.get().creatures;
    const act = activeOwned(c);
    // ---- YOUR MAIN CREATURE, on the left (user, 2 Nov): one card -- or,
    // with nobody yet, one empty slot -- and in the space beside it the
    // team: every creature you have recruited, tap one to make it the one
    // that fights.  (Nothing faints for long: a loss leaves it on its feet.)
    L.add(text(this, 8, 23, 'MAIN CREATURE', PALETTE.gold));
    L.add(text(this, 196, 23, `W ${c.wins}  L ${c.losses}`, PALETTE.fog).setOrigin(1, 0));
    const x = 4;
    const y = 33;
    const w = 96;
    const h = 126;
    if (!act) {
      L.add(this.add.rectangle(x, y, w, h, 0x12152a).setOrigin(0, 0).setStrokeStyle(1, 0x2a2e48));
      const g = this.add.graphics();
      g.lineStyle(1, 0x3a3e58, 1).strokeCircle(x + w / 2, y + 46, 12);
      g.fillStyle(0x3a3e58, 1).fillRect(x + w / 2 - 5, y + 45, 11, 2).fillRect(x + w / 2 - 1, y + 41, 2, 11);
      L.add(g);
      L.add(centerText(this, x + w / 2, y + 70, 'EMPTY SLOT', PALETTE.ash));
      L.add(centerText(this, x + w / 2, y + 80, 'RECRUIT TO FILL', 0x4a4e68));
    } else {
      const cr = ownedCreature(act)!;
      this.card(cr, x, y, w, h, true, true, act.xp ?? 0, true, act.uid);
    }
    // ---- the team, where the second card used to be
    const tx = 104;
    L.add(this.add.rectangle(tx, y, 94, h, 0x12152a).setOrigin(0, 0).setStrokeStyle(1, 0x2a3050));
    L.add(text(this, tx + 4, y + 3, `TEAM ${c.owned.length}`, PALETTE.cream));
    L.add(smallText(this, tx + 4, y + 13, c.owned.length > 1 ? 'TAP ONE: MAKE IT MAIN' : 'RECRUIT TO ADD MORE', 0x6a7090));
    const page0 = Phaser.Math.Clamp(this.teamPage, 0, Math.max(0, Math.ceil(c.owned.length / TEAM_PAGE) - 1)) * TEAM_PAGE;
    c.owned.slice(page0, page0 + TEAM_PAGE).forEach((o, i) => {
      const cr = ownedCreature(o);
      if (!cr) return;
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = tx + 3 + col * 45;
      const bw = 43;
      const bh = 20;
      const byy = y + 21 + row * (bh + 1);
      const main = o.uid === act?.uid;
      const el = ELEMENTS[cr.element];
      const tile = this.add.rectangle(bx, byy, bw, bh, main ? 0x3a2e10 : 0x1c2142).setOrigin(0, 0).setStrokeStyle(main ? 2 : 1, main ? PALETTE.gold : el.col);
      L.add(tile);
      this.shown.push({ c: cr, x: bx + 11, y: byy + 9, s: 0.85, f: 1 });
      L.add(smallText(this, bx + 22, byy + 3, `LV ${levelOf(o.xp ?? 0)}`, main ? PALETTE.gold : PALETTE.cream));
      L.add(smallText(this, bx + 22, byy + 11, main ? 'MAIN' : el.name.slice(0, 5), main ? PALETTE.gold : el.light));
      if (!main) {
        tile.setInteractive({ useHandCursor: true });
        tile.on('pointerover', () => tile.setFillStyle(0x2a3060));
        tile.on('pointerout', () => tile.setFillStyle(0x1c2142));
        tile.on('pointerdown', () => {
          const r = setActive(o.uid);
          if (r.ok) {
            this.msg = '';
            audio.sfx('ui_blip', 0.5);
          } else this.say(r);
          this.draw();
        });
      }
    });
    // (no RELEASE: a creature recruited is yours for good -- user, 4 Nov)
    // ---- MORE THAN FIT: the team is unlimited, so it goes in pages of
    // TEAM_PAGE, with arrows and the page between them
    const pages = Math.max(1, Math.ceil(c.owned.length / TEAM_PAGE));
    this.teamPage = Phaser.Math.Clamp(this.teamPage, 0, pages - 1);
    if (pages > 1) {
      const py = y + h - 9;
      L.add(button(this, tx + 12, py, '<', () => ((this.teamPage = (this.teamPage + pages - 1) % pages), this.draw()), { width: 18, height: 12 }));
      L.add(centerText(this, tx + 47, py, `${this.teamPage + 1} / ${pages}`, PALETTE.cream));
      L.add(button(this, tx + 82, py, '>', () => ((this.teamPage = (this.teamPage + 1) % pages), this.draw()), { width: 18, height: 12 }));
    }
    // ---- the menu, on the right
    const mx = 207;
    const mw = GAME_W - mx - 8;
    // ---- THE MENU TILES (user, 4 Nov): the label alone, no line under it,
    // narrower than the panel and centred in it, evenly spaced down it
    const MW = 94;
    const MH = 17;
    const MX = mx - 4 + Math.round((mw + 8 - MW) / 2);
    const menuY = (row: number): number => 37 + row * (MH + 5);
    L.add(this.add.rectangle(mx - 4, 21, mw + 8, GAME_H - 34, 0x0e1124, 0.9).setOrigin(0, 0).setStrokeStyle(1, 0x2a3050));
    L.add(text(this, mx, 25, 'MENU', PALETTE.ash));
    const busy = !!c.pending;
    const run = c.ladder;
    const resting = !!act && restLeft(act) > 0;
    // STORY MODE, in place of the zone battles (user, 28 Oct)
    const sw = Math.min(c.story.cleared, WORLDS.length - 1);
    this.tile(MX, menuY(0), MW, MH, 'STORY MODE', '', 0xff5a6a, (g, x, y, col) => drawAttackIcon(g, 'dash', x, y, col), () => ((this.storyW = sw), (this.markTo = WORLD_AT[sw]), (this.mark = { x: WORLD_AT[sw][0], y: WORLD_AT[sw][1] - 20 }), this.go('story')), !act || resting);
    this.tile(MX, menuY(1), MW, MH, 'LADDER', '', PALETTE.gold, (g, x, y, col) => {
      // three rungs
      g.fillStyle(col, 1).fillRect(x - 5, y - 7, 2, 14).fillRect(x + 3, y - 7, 2, 14);
      for (const k of [-4, 0, 4]) g.fillRect(x - 3, y + k, 6, 1);
    }, () => this.go('ladder'), !act && !run);
    // TRAINING: free, no stake, a dummy that cannot hurt you -- in the place
    // last picked on the zone map
    this.tile(MX, menuY(2), MW, MH, 'TRAINING', '', 0x6ad8f0, (g, x, y, col) => {
      // a straw dummy on its post
      g.fillStyle(col, 1).fillRect(x - 1, y - 6, 3, 3).fillRect(x - 3, y - 3, 7, 5).fillRect(x, y + 2, 1, 5).fillRect(x - 5, y - 2, 11, 1);
    }, () => this.train(this.biome), !act);
    // MINI GAMES: duels and 3v3 with creatures of the game's own (user, 4 Nov)
    this.tile(MX, menuY(3), MW, MH, 'MINI GAMES', '', 0xff9a3c, (g, x, y, col) => {
      // two crossed claws
      g.fillStyle(col, 1);
      for (let k = -4; k <= 4; k++) g.fillRect(x + k, y + k * 0.8, 2, 2).fillRect(x + k, y - k * 0.8, 2, 2);
    }, () => this.go('minis'));
    this.tile(MX, menuY(4), MW, MH, 'RECRUIT', '', 0x8a6aff, (g, x, y, col) => {
      g.fillStyle(0x14100c, 1).fillRect(x - 6, y - 5, 9, 12).fillRect(x - 2, y - 7, 9, 12);
      g.fillStyle(col, 0.6).fillRect(x - 5, y - 4, 7, 10);
      g.fillStyle(col, 1).fillRect(x - 1, y - 6, 7, 10);
      g.fillStyle(0x14100c, 1).fillRect(x + 2, y - 3, 1, 3).fillRect(x + 2, y + 1, 1, 1);
    }, () => this.go(busy ? 'pack' : 'recruit'));
    // (the keys, on a keyboard only: a phone's controls are on the screen -- C7)
    if (!isTouch())
      this.tile(MX, menuY(5), MW, MH, 'HOW TO PLAY', '', 0x4ad0c0, (g, x, y, col) => {
        g.fillStyle(col, 1).fillRect(x - 7, y - 3, 14, 7).fillRect(x - 8, y - 1, 16, 5);
        g.fillStyle(0x0a0d1e, 1).fillRect(x - 5, y, 3, 1).fillRect(x - 4, y - 1, 1, 3).fillRect(x + 3, y - 1, 1, 1).fillRect(x + 5, y + 1, 1, 1);
      }, () => this.go('controls'));
  }

  // ------------------------------------------------------------ mini games

  /** Which page of the team is showing (it is unlimited). */
  private teamPage = 0;
  private miniKind: MiniKind = 'melee';
  private miniPool: string[] = [];
  private miniPicks: string[] = [];

  /** THE MINI GAMES MENU: the three modes, what each is, and what it costs. */
  private minis(): void {
    const L = this.layer;
    L.add(text(this, 8, 20, 'MINI GAMES', PALETTE.gold));
    L.add(smallText(this, 8, 30, 'THE STAKE IS TAKEN ONCE, THE PRIZE PAID ON A WIN. NOTHING FOR A LOSS.', PALETTE.fog));
    L.add(smallText(this, 8, 37, 'YOU FIGHT WITH THE CREATURES ON OFFER, ALL AT THE SAME LEVEL. NO XP.', PALETTE.fog));
    const kinds: Array<[MiniKind, number, string, (g: Phaser.GameObjects.Graphics, x: number, y: number, col: number) => void]> = [
      ['melee', 0xff5a6a, 'PICK 1 OF 3 - UP CLOSE', (g, x, y, col) => drawAttackIcon(g, 'dash', x, y, col)],
      ['ranged', 0x6ad8f0, 'PICK 1 OF 3 - AT RANGE', (g, x, y, col) => drawAttackIcon(g, 'bolt', x, y, col)],
      ['team', PALETTE.gold, 'PICK 5 OF 12 - ONE AT A TIME', (g, x, y, col) => {
        g.fillStyle(col, 1).fillCircle(x - 5, y + 2, 3).fillCircle(x, y - 2, 3).fillCircle(x + 5, y + 2, 3);
      }],
    ];
    kinds.forEach(([k, col, sub, icon], i) => {
      const y = 48 + i * 34;
      const pr = MINI_PRICE[k];
      this.tile(16, y, GAME_W - 32, 28, MINI_INFO[k].title, `${sub}  -  ${pr.cost} IN, ${pr.win} TO WIN`, col, icon, () => {
        this.miniKind = k;
        this.miniPool = drawPool(k);
        this.miniPicks = [];
        this.go('minipick');
      }, ledger.balance() < pr.cost);
    });
    if (ledger.balance() < MINI_MIN_COST) L.add(centerSmall(this, GAME_W / 2, 152, `YOU NEED ${MINI_MIN_COST} TOKENS TO PLAY.`, 0xff9a9a));
  }

  /**
   * THE PICK.  The pool on cards -- the creature, its role, its health and
   * reach -- tap to choose (tap again to drop it), STATS to read it in full,
   * and FIGHT once the pick is complete.  The cards are sized to fit their
   * words: a long name shrinks to the small type rather than run off.
   */
  private miniPick(): void {
    const L = this.layer;
    const kind = this.miniKind;
    const want = kind === 'team' ? TEAM_SIZE : 1;
    const pr = MINI_PRICE[kind];
    L.add(text(this, 8, 20, MINI_INFO[kind].title, PALETTE.gold));
    // (two short lines, never one that wraps into the cards)
    L.add(smallText(this, 8, 30, MINI_INFO[kind].rules.join(' '), PALETTE.fog));
    L.add(smallText(this, 8, 37, `${pr.cost} TOKENS IN, ${pr.win} FOR A WIN.`, PALETTE.gold));
    const team = kind === 'team';
    // (5v5: twelve on offer, four across in three rows -- six across left a
    // card too narrow for the longest name to sit inside its outline)
    const cols = team ? 4 : 3;
    const cw = team ? 74 : 92;
    const ch = team ? 36 : 100;
    const gap = team ? 4 : 10;
    const x0 = Math.round((GAME_W - (cols * cw + (cols - 1) * gap)) / 2);
    const y0 = team ? 46 : 46;
    this.miniPool.forEach((id, i) => {
      const c = creatureById(id);
      if (!c) return;
      const x = x0 + (i % cols) * (cw + gap);
      const y = y0 + Math.floor(i / cols) * (ch + (team ? 3 : 4));
      const on = this.miniPicks.indexOf(id);
      const el = ELEMENTS[c.element];
      const bg = this.add.rectangle(x, y, cw, ch, on >= 0 ? 0x2a2a14 : 0x181c36).setOrigin(0, 0).setStrokeStyle(on >= 0 ? 2 : 1, on >= 0 ? PALETTE.gold : el.col);
      L.add(bg);
      const artH = team ? 15 : 44;
      L.add(this.add.rectangle(x + 2, y + 2, cw - 4, artH, el.dark, 0.55).setOrigin(0, 0));
      this.shown.push({ c, x: x + cw / 2, y: y + artH * 0.62, s: team ? 0.8 : 1.7, f: 1 });
      // the name: the big type if it fits, the small one if not
      const nm = c.name.toUpperCase();
      const big = nm.length * 6 <= cw - 6;
      L.add(big ? centerText(this, x + cw / 2, y + artH + 7, nm, PALETTE.cream) : centerSmall(this, x + cw / 2, y + artH + 5, nm, PALETTE.cream));
      const role = roleOf(c).toUpperCase();
      const t = traitsOf(c);
      // (one line if it fits the card -- the small type is 4 a letter --
      // otherwise the role and the health on a line each)
      const one = team ? `${role} ${c.hp}HP` : `${role} - ${c.hp} HP`;
      if (one.length * 4 + 4 <= cw) L.add(centerSmall(this, x + cw / 2, y + artH + 13, one, el.light));
      else L.add([centerSmall(this, x + cw / 2, y + artH + 13, role, el.light), centerSmall(this, x + cw / 2, y + artH + 20, `${c.hp} HP`, el.light)]);
      if (!team) {
        L.add(centerSmall(this, x + cw / 2, y + artH + 21, t.style.split(':')[0], PALETTE.fog));
        L.add(centerSmall(this, x + cw / 2, y + artH + 29, `SPEED ${c.speed}`, PALETTE.fog));
        L.add(button(this, x + cw / 2, y + ch - 10, 'STATS', () => this.showStats(c), { width: 46, height: 11, fill: 0x1c2142 }));
      }
      if (on >= 0 && team) L.add([this.add.circle(x + 7, y + 7, 5, PALETTE.gold), centerSmall(this, x + 7, y + 5, `${on + 1}`, 0x1a1a22)]);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        audio.sfx('ui_blip', 0.5);
        const at = this.miniPicks.indexOf(id);
        if (at >= 0) this.miniPicks.splice(at, 1);
        else if (want === 1) this.miniPicks = [id];
        else if (this.miniPicks.length < want) this.miniPicks.push(id);
        this.draw();
      });
    });
    const ready = this.miniPicks.length === want;
    const label = ready ? `FIGHT - ${pr.cost} TOKENS` : team ? `PICK ${want - this.miniPicks.length} MORE` : 'PICK ONE';
    L.add(button(this, GAME_W / 2, GAME_H - 9, label, () => {
      if (!ready) return;
      const r = startMini(kind, this.miniPicks);
      if (!r.ok) {
        this.say(r);
        this.draw();
        return;
      }
      audio.sfx('cha_ching', 0.5);
      this.scene.start('CreatureArena', { mode: 'mini', from: this.from, biome: BIOMES[Phaser.Math.Between(0, BIOMES.length - 1)].id });
    }, { width: 120, height: 13, disabled: !ready }));
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
    L.add(text(this, x + 70, 52, packPrice() ? `${packPrice()} TOKENS` : 'FREE', PALETTE.gold));
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
    // (the admin's test zone, CHOOSE ANY RECRUIT on: pick any creature, free)
    if (canChooseRecruit()) {
      L.add(button(this, GAME_W / 2, 132, 'CHOOSE ONE', () => {
        this.choosePage = 0;
        this.go('choose');
      }, { width: 96, height: 13 }));
      L.add(centerSmall(this, GAME_W / 2, 150, 'ADMIN TEST: PICK ANY CREATURE, FREE', PALETTE.gold));
      return;
    }
    const can = ledger.balance() >= packPrice();
    L.add(button(this, GAME_W / 2, 132, packPrice() ? `OPEN  ${packPrice()} TOK` : 'OPEN - FREE', () => {
      const r = openPack();
      this.say(r);
      if (r.ok) {
        this.screen = 'pack';
        this.picked = null;
      }
      this.draw();
    }, { width: 96, height: 13, disabled: !can }));
    if (ledger.balance() < packPrice()) L.add(centerText(this, GAME_W / 2, 154, `YOU HAVE ${ledger.balance()} TOKENS.`, PALETTE.ash));
  }

  /**
   * EVERY CREATURE, BY ITS PICTURE (user, 4 Nov: the admin's recruit picks
   * any one, shown by its image and not its name): a page of them in a grid,
   * the next page and the one before at the bottom.
   */
  private chooseAny(): void {
    const L = this.layer;
    L.add(centerText(this, GAME_W / 2, 22, 'CHOOSE A CREATURE', PALETTE.cream));
    const cols = 8;
    const rows = 3;
    const per = cols * rows;
    const pages = Math.ceil(CREATURES.length / per);
    this.choosePage = Phaser.Math.Clamp(this.choosePage, 0, pages - 1);
    const cw = 36;
    const ch = 40;
    const x0 = Math.round((GAME_W - (cols * cw + (cols - 1) * 3)) / 2);
    CREATURES.slice(this.choosePage * per, (this.choosePage + 1) * per).forEach((cr, i) => {
      const x = x0 + (i % cols) * (cw + 3);
      const y = 30 + Math.floor(i / cols) * (ch + 3);
      const el = ELEMENTS[cr.element];
      const cell = this.add.rectangle(x, y, cw, ch, 0x161a2c).setOrigin(0, 0).setStrokeStyle(1, el.col);
      cell.setInteractive({ useHandCursor: true });
      cell.on('pointerover', () => (cell.setFillStyle(0x2a3050).setStrokeStyle(1, PALETTE.gold), audio.sfx('ui_hover')));
      cell.on('pointerout', () => cell.setFillStyle(0x161a2c).setStrokeStyle(1, el.col));
      cell.on('pointerdown', () => {
        audio.sfx('ui_blip');
        this.say(recruitChosen(cr.id));
        this.go('home');
      });
      L.add(cell);
      L.add(this.add.rectangle(x + 3, y + ch - 5, cw - 6, 2, el.col).setOrigin(0, 0));
      this.shown.push({ c: cr, x: x + cw / 2, y: y + 19, s: 1.0, f: 1 });
    });
    const py = 166;
    L.add(button(this, GAME_W / 2 - 50, py, '<', () => ((this.choosePage = (this.choosePage + pages - 1) % pages), this.draw()), { width: 24, height: 12 }));
    L.add(centerText(this, GAME_W / 2, py - 3, `${this.choosePage + 1} / ${pages}`, PALETTE.fog));
    L.add(button(this, GAME_W / 2 + 50, py, '>', () => ((this.choosePage = (this.choosePage + 1) % pages), this.draw()), { width: 24, height: 12 }));
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
        // a second tap on the world picked goes in, to its trail
        if (this.storyW === i && open) return this.enterWorld(i);
        this.storyW = i;
        this.markTo = WORLD_AT[i];
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
    const px = 198;
    L.add(this.add.rectangle(px, 26, 116, 140, 0x1a1e38).setOrigin(0, 0).setStrokeStyle(1, open ? PALETTE.gold : 0x2a3050));
    wrapWords(w.name, 18).slice(0, 2).forEach((ln, k) => L.add(text(this, px + 4, 30 + k * 9, ln, PALETTE.gold)));
    L.add(text(this, px + 4, 49, `LEVELS ${w.lo}-${w.hi}`, PALETTE.cream));
    wrapWords(w.blurb, 27).slice(0, 2).forEach((ln, k) => L.add(smallText(this, px + 4, 60 + k * 7, ln, PALETTE.ash)));
    // how far along its own trail it is (each world's kept apart)
    const best = storyBest(i, c);
    const sg = this.add.graphics();
    for (let k = 0; k <= STAGES; k++) {
      const x = px + 14 + k * 20;
      const yy = 84;
      const boss = k === STAGES;
      const past = open && k < best;
      const next = open && k === best;
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
    L.add(text(this, px + 4, 98, best > STAGES ? 'ALL 5 CLEARED' : `${best}/5 CLEARED`, best > STAGES ? PALETTE.gold : PALETTE.cream));
    L.add(smallText(this, px + 4, 110, best > STAGES ? 'REPLAY ANY FIGHT FOR XP' : 'REPLAY BEATEN FIGHTS', PALETTE.ash));
    L.add(button(this, px + 58, 146, 'ENTER WORLD', () => this.enterWorld(i), { width: 106, height: 14 }));
  }

  /** Into world `w`: its own trail, the marker on its next stop. */
  private enterWorld(w: number): void {
    if (!worldOpen(w)) return;
    this.storyW = w;
    this.trailSel = trailNode(w);
    const at = trailMark(w, this.trailSel);
    this.markTo = at;
    this.mark = { x: at[0], y: at[1] - 20 };
    audio.sfx('ui_blip', 0.5);
    this.go('trail');
  }

  private pickStop(k: number): void {
    if (k === this.trailSel) return;
    this.trailSel = k;
    this.markTo = trailMark(this.storyW, k);
    audio.sfx('ui_hover', 0.5);
    this.draw();
  }

  /**
   * ---- A WORLD'S TRAIL.  Its ground, its scenery, its path, and on the path
   * its five stops: beaten ones in gold with a tick (tap one to fight it
   * again -- a replay, for the experience), the next one ringed and
   * breathing, the rest dark and padlocked.  Your creature hops along to
   * the stop picked.  On the right, that stop: who, what level, what it
   * pays, roughly what it teaches, and FIGHT (or REPLAY).
   */
  private trail(): void {
    const L = this.layer;
    const c = store.get().creatures;
    const i = this.storyW;
    const w = WORLDS[i];
    const pts = TRAIL_AT[i];
    const best = storyBest(i, c);
    const b = BIOMES.find((q) => q.id === w.biome)!;
    const area = { x: 4, y: 19, w: 190, h: 156 };
    // the world's own ground, darkened so the path reads over it
    const ground = this.add.graphics();
    paintFloor(ground, w.biome, area, b.ground, b.groundDark, `${w.id}-trail`, 0.5);
    ground.fillStyle(0x05070f, 0.35).fillRect(area.x, area.y, area.w, area.h);
    L.add(ground);
    L.add(this.add.rectangle(area.x, area.y, area.w, area.h).setOrigin(0, 0).setStrokeStyle(1, 0x2a3050));
    // its scenery, kept off the path
    const deco = this.add.graphics();
    paintTrailScenery(deco, i, area, pts);
    L.add(deco);
    // the path: dotted, gold as far as you have got
    const path = this.add.graphics();
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k];
      const [x1, y1] = pts[k + 1];
      // bowed a little to one side, each leg its own way
      const mx = (x0 + x1) / 2 + (y1 - y0) * 0.18 * (k % 2 ? 1 : -1);
      const my = (y0 + y1) / 2 - (x1 - x0) * 0.18 * (k % 2 ? 1 : -1);
      const n = Math.max(6, Math.round(Math.hypot(x1 - x0, y1 - y0) / 7));
      for (let j = 1; j < n; j++) {
        const t = j / n;
        const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1;
        const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1;
        path.fillStyle(0x000000, 0.5).fillCircle(x + 0.5, y + 1, 1.8);
        path.fillStyle(k < best ? PALETTE.gold : 0x5a6080, 1).fillCircle(x, y, 1.5);
      }
    }
    L.add(path);
    // the stops
    pts.forEach(([x, y], k) => {
      const boss = k === STAGES;
      const state = nodeState(i, k, c);
      const r = boss ? 13 : 10;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.45).fillEllipse(x, y + r - 1, r * 2.2, 6);
      g.fillStyle(state === 'done' ? 0x3a2e10 : state === 'next' ? 0x1c2142 : 0x0c0e1a, 0.95).fillCircle(x, y, r);
      g.lineStyle(k === this.trailSel ? 2 : 1, state === 'done' ? PALETTE.gold : state === 'next' ? PALETTE.cream : 0x3a4060, 1).strokeCircle(x, y, r);
      if (boss) g.lineStyle(1, state === 'locked' ? 0x4a2030 : 0xff5a6a, 1).strokeCircle(x, y, r + 3);
      L.add(g);
      if (state === 'locked') {
        // a padlock
        const lk = this.add.graphics();
        lk.lineStyle(1.5, 0x6a7090, 1).strokeCircle(x, y - 2, 3);
        lk.fillStyle(0x6a7090, 1).fillRect(x - 4, y - 1, 8, 6);
        L.add(lk);
      } else {
        // who waits there, small inside its stop
        const foe = boss ? bossById(w.boss) : creatureById(lineupFoe(i, k));
        if (foe) this.shown.push({ c: foe, x, y: y - 1, s: boss ? 1.05 : 0.9, f: -1 });
        if (state === 'done') {
          // the tick of a fight already won
          const tk = this.add.graphics();
          tk.fillStyle(PALETTE.gold, 1).fillCircle(x + r - 2, y - r + 2, 3.5);
          tk.lineStyle(1.2, 0x1a1408, 1).lineBetween(x + r - 4, y - r + 2, x + r - 2.5, y - r + 3.5).lineBetween(x + r - 2.5, y - r + 3.5, x + r, y - r);
          L.add(tk);
        }
      }
      if (state === 'next') {
        // the one to beat breathes
        const halo = this.add.circle(x, y, r + 2).setStrokeStyle(1, PALETTE.cream, 0.8);
        this.tweens.add({ targets: halo, scale: 1.25, alpha: 0, duration: 900, repeat: -1 });
        L.add(halo);
      }
      L.add(centerSmall(this, x, y + r + 4, boss ? 'BOSS' : `${k + 1}`, state === 'done' ? PALETTE.gold : state === 'next' ? PALETTE.cream : 0x5a6080));
      if (state !== 'locked') {
        const hit = this.add.circle(x, y, r + 3, 0x000000, 0.001).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => (k === this.trailSel ? this.trailFight() : this.pickStop(k)));
        L.add(hit);
      }
    });
    // your creature, on the stop picked
    const me = activeCreature();
    if (me) this.shown.push({ c: me, x: this.mark.x, y: this.mark.y, s: 1.1, f: 1, hop: true });
    // ---- the stop picked
    const k = this.trailSel;
    const state = nodeState(i, k, c);
    const boss = k === STAGES;
    const foe = boss ? bossById(w.boss) : creatureById(lineupFoe(i, k));
    const lv = stageLevel(i, k);
    const px = 198;
    L.add(this.add.rectangle(px, 26, 116, 140, 0x1a1e38).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold));
    wrapWords(w.name, 18).slice(0, 2).forEach((ln, j) => L.add(smallText(this, px + 4, 30 + j * 7, ln, PALETTE.gold)));
    L.add(text(this, px + 4, 46, boss ? 'THE BOSS' : `BATTLE ${k + 1} OF ${STAGES}`, boss ? 0xff9a9a : PALETTE.cream));
    const who = boss ? w.bossName : (foe?.name ?? '???').toUpperCase();
    wrapWords(`${who} LV ${lv}`, 18).slice(0, 2).forEach((ln, j) => L.add(text(this, px + 4, 57 + j * 9, ln, PALETTE.gold)));
    L.add(text(this, px + 4, 78, state === 'done' ? 'CLEARED' : 'NEXT FIGHT', state === 'done' ? PALETTE.mossLight : PALETTE.cream));
    const replay = state === 'done';
    const price = storyPrice(i, replay);
    L.add(text(this, px + 4, 90, `WIN: +${price.win} TOKENS`, PALETTE.mossLight));
    // roughly what it teaches: by the gap between your level and its
    const act = activeOwned();
    const myLv = levelOf(act?.xp ?? 0);
    const xp = battleXp(myLv, lv, { boss, won: true });
    const gap = lv - myLv;
    L.add(text(this, px + 4, 102, `XP: ABOUT +${xp}`, 0x8ae88a));
    L.add(smallText(this, px + 4, 113, gap <= -3 ? 'WELL BELOW YOU: LITTLE XP' : gap >= 2 ? 'ABOVE YOU: EXTRA XP' : 'A FAIR MATCH', gap <= -3 ? 0xff9a9a : PALETTE.ash));
    if (replay) L.add(smallText(this, px + 4, 121, 'REPLAY: FOR XP ONLY', PALETTE.ash));
    const resting = !!act && restLeft(act) > 0;
    L.add(button(this, px + 58, 146, `${replay ? 'REPLAY' : 'FIGHT'}  ${price.cost} TOK`, () => this.trailFight(), { width: 106, height: 14, disabled: !act || resting || ledger.balance() < price.cost }));
    if (resting) L.add(smallText(this, px + 4, 157, 'FAINTED - REVIVE IT FIRST', 0xff9a9a));
    else if (!isTouch()) L.add(smallText(this, px + 4, 157, 'ARROWS: PICK  ENTER: FIGHT', 0x6a7090));
  }

  private trailFight(): void {
    const act = activeOwned();
    const replay = nodeState(this.storyW, this.trailSel) === 'done';
    if (!act || restLeft(act) > 0 || nodeState(this.storyW, this.trailSel) === 'locked') return;
    if (ledger.balance() < storyPrice(this.storyW, replay).cost) {
      this.say({ ok: false, msg: 'NOT ENOUGH TOKENS.' });
      this.draw();
      return;
    }
    this.scene.start('CreatureArena', { mode: 'story', world: this.storyW, node: this.trailSel, from: this.from });
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
      { demo: 'clash.move', say: touch ? 'THE STICK MOVES YOUR CREATURE. EACH MOVE BUTTON FIRES THAT MOVE STRAIGHT AT THE FOE.' : 'W A S D MOVES YOUR CREATURE. EVERY MOVE AIMS ITSELF AT THE FOE: NO MOUSE NEEDED.' },
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
          : `${key('KeyJ')} ${key('KeyK')} ${key('KeyL')} (OR 1 2 3) FIRE MOVES 1, 2 AND 3 STRAIGHT AT THE FOE. SPACE FIRES THE ONE PICKED. W A S D MOVES. ${key('KeyJ')} ${key('KeyK')} ${key('KeyL')} CAN BE MOVED IN THE SETTINGS, UNDER CHANGE KEYS.`,
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
