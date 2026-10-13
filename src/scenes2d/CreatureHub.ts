/**
 * ---- CREATURE CLASH, the cabinet's menus.  Everything that is not the
 * fight: the free starter, your two, the packs and their nine face-down
 * cards, the map of nine places and their bosses, and which hand the
 * sticks go under.
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
import {
  BATTLE_COST, BATTLE_WIN, BIOMES, BOSS_AFTER, DEFEAT_PENALTY, ELEMENTS, MAX_OWNED, RARITIES, STARTERS, TIERS, creatureById, tierOdds, type Creature,
} from '../game/creatures';
import { activeOwned, bossOpen, claimStarter, needsRecovery, openPack, pickCard, release, retreat, setActive, setHanded } from '../game/creatureClash';

type Screen = 'home' | 'starter' | 'recruit' | 'pack' | 'map' | 'controls';

interface Shown {
  c: { element: Creature['element']; body: Creature['body'] };
  x: number;
  y: number;
  s: number;
  f: number;
}

export class CreatureHub extends Phaser.Scene {
  private screen: Screen = 'home';
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

  init(data: { from?: string; msg?: string }): void {
    this.from = data.from ?? 'ArcadeLounge';
    this.msg = data.msg ?? '';
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
    this.screen = !c.starterTaken ? 'starter' : c.pending ? 'pack' : needsRecovery() ? 'recruit' : 'home';
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x10142a).setOrigin(0, 0);
    // a starfield of tiny element sparks behind everything
    const bg = this.add.graphics();
    const cols = Object.values(ELEMENTS).map((e) => e.col);
    for (let i = 0; i < 70; i++) bg.fillStyle(cols[i % cols.length], 0.25 + (i % 3) * 0.1).fillRect((i * 97) % GAME_W, (i * 53) % GAME_H, 1, 1);
    this.layer = this.add.container(0, 0);
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
    this.layer.removeAll(true);
    this.shown = [];
    const L = this.layer;
    L.add(text(this, 8, 5, 'CREATURE CLASH', PALETTE.gold));
    L.add(text(this, 98, 5, `${ledger.balance()} TOK`, PALETTE.mossLight));
    if (this.screen !== 'pack') L.add(button(this, GAME_W - 26, 9, this.screen === 'home' || this.screen === 'starter' ? 'LEAVE' : 'BACK', () => (this.screen === 'home' || this.screen === 'starter' ? this.leave() : this.go('home')), { width: 44, height: 11 }));
    ({ home: () => this.home(), starter: () => this.starter(), recruit: () => this.recruit(), pack: () => this.pack(), map: () => this.map(), controls: () => this.controls() })[this.screen]();
    if (this.msg) L.add(centerText(this, GAME_W / 2, GAME_H - 6, this.msg, PALETTE.gold));
  }

  /** One creature's card: picture, name, rarity, stats, the three attacks. */
  private card(c: Creature, x: number, y: number, w: number, h: number, big = true): void {
    const L = this.layer;
    const r = RARITIES[c.rarity];
    L.add(this.add.rectangle(x, y, w, h, 0x1a1e38).setOrigin(0, 0).setStrokeStyle(1, r.col));
    L.add(this.add.rectangle(x + 2, y + 2, w - 4, big ? 34 : 26, ELEMENTS[c.element].dark, 0.45).setOrigin(0, 0));
    this.shown.push({ c, x: x + w / 2, y: y + (big ? 19 : 15), s: big ? 1.6 : 1.2, f: 1 });
    let ty = y + (big ? 38 : 30);
    L.add(text(this, x + 3, ty, c.name.toUpperCase(), PALETTE.cream));
    ty += 9;
    L.add(text(this, x + 3, ty, `${r.name} ${ELEMENTS[c.element].name}`, r.col));
    if (!big) return;
    ty += 9;
    L.add(text(this, x + 3, ty, `HP ${c.hp}  SPD ${c.speed}`, PALETTE.fog));
    ty += 9;
    L.add(text(this, x + 3, ty, `POWER ${c.power.toFixed(2)}`, PALETTE.fog));
    ty += 10;
    for (const a of c.attacks) {
      L.add(text(this, x + 3, ty, `${a.name}${a.dmg ? ' ' + a.dmg : ''}`, PALETTE.cream).setAlpha(0.75));
      ty += 8;
    }
  }

  // ----------------------------------------------------------------- screens

  private starter(): void {
    const L = this.layer;
    L.add(centerText(this, GAME_W / 2, 24, 'CHOOSE YOUR FIRST CREATURE - FREE', PALETTE.cream));
    STARTERS.forEach((id, i) => {
      const c = creatureById(id)!;
      const x = 14 + i * 102;
      this.card(c, x, 32, 94, 108);
      L.add(button(this, x + 47, 152, 'CHOOSE', () => {
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
    L.add(text(this, 8, 18, `YOUR CREATURES (${c.owned.length}/${MAX_OWNED})   WON ${c.wins}  LOST ${c.losses}`, PALETTE.fog));
    for (let i = 0; i < MAX_OWNED; i++) {
      const o = c.owned[i];
      const x = 8 + i * 100;
      if (!o) {
        L.add(this.add.rectangle(x, 28, 94, 108, 0x1a1e38).setOrigin(0, 0).setStrokeStyle(1, 0x3a3e58));
        L.add(centerText(this, x + 47, 82, 'EMPTY SLOT', PALETTE.ash));
        continue;
      }
      const cr = creatureById(o.id)!;
      this.card(cr, x, 28, 94, 108);
      if (o.uid === act?.uid) L.add(text(this, x + 3, 30, 'FIGHTING', PALETTE.gold));
      else L.add(button(this, x + 24, 146, 'USE', () => (this.say(setActive(o.uid)), this.draw()), { width: 40, height: 11 }));
      L.add(button(this, x + 70, 146, 'RELEASE', () => this.confirmRelease(o.uid, cr), { width: 46, height: 11 }));
    }
    const bx = 262;
    const busy = !!c.pending;
    L.add(button(this, bx, 40, 'BATTLE', () => this.go('map'), { width: 100, height: 14, disabled: !act }));
    L.add(text(this, 214, 50, `${BATTLE_COST} IN, WIN ${BATTLE_WIN}`, PALETTE.ash));
    L.add(button(this, bx, 74, 'RECRUIT', () => this.go(busy ? 'pack' : 'recruit'), { width: 100, height: 14 }));
    L.add(text(this, 214, 84, c.owned.length >= MAX_OWNED ? 'RELEASE ONE FIRST' : 'PACKS 50/150/300', PALETTE.ash));
    L.add(button(this, bx, 108, 'CONTROLS', () => this.go('controls'), { width: 100, height: 14 }));
    L.add(text(this, 214, 118, c.handed === 'left' ? 'LEFT-HANDED' : 'RIGHT-HANDED', PALETTE.ash));
    if (!act) L.add(text(this, 214, 134, 'NO CREATURE: RECRUIT', PALETTE.gold));
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

  private recruit(): void {
    const L = this.layer;
    const c = store.get().creatures;
    const recovery = needsRecovery(c);
    L.add(centerText(this, GAME_W / 2, 22, recovery ? 'RECOVERY RECRUITMENT - YOU HAVE NO CREATURES LEFT' : 'RECRUIT: NINE CARDS FACE DOWN, PICK ONE', recovery ? PALETTE.gold : PALETTE.cream));
    TIERS.forEach((t, i) => {
      const x = 8 + i * 104;
      L.add(this.add.rectangle(x, 32, 98, 112, 0x1a1e38).setOrigin(0, 0).setStrokeStyle(1, RARITIES[t.rarities[2]].col));
      L.add(centerText(this, x + 49, 40, t.name, PALETTE.cream));
      L.add(centerText(this, x + 49, 51, `${t.cost} TOKENS`, PALETTE.gold));
      tierOdds(t).forEach(([r, p], k) => {
        const pct = p * 100;
        L.add(text(this, x + 5, 62 + k * 10, RARITIES[r].name, RARITIES[r].col));
        L.add(text(this, x + 94, 62 + k * 10, pct >= 10 ? `${pct.toFixed(0)}%` : pct >= 1 ? `${pct.toFixed(1)}%` : `${pct.toFixed(2)}%`, PALETTE.fog).setOrigin(1, 0));
      });
      L.add(text(this, x + 5, 98, 'CHANCE PER CARD', PALETTE.ash));
      const can = ledger.balance() >= t.cost && c.owned.length < MAX_OWNED;
      L.add(button(this, x + 49, 132, 'OPEN', () => {
        const r = openPack(t.id);
        this.say(r);
        if (r.ok) {
          this.screen = 'pack';
          this.picked = null;
        }
        this.draw();
      }, { width: 70, height: 13, disabled: !can }));
    });
    if (c.owned.length >= MAX_OWNED) L.add(centerText(this, GAME_W / 2, 158, 'YOU HAVE TWO. RELEASE ONE BEFORE YOU RECRUIT.', PALETTE.gold));
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
      L.add(this.add.rectangle(x, y, cw, ch, mine ? 0x2a3050 : 0x161a2c).setOrigin(0, 0).setStrokeStyle(mine ? 2 : 1, RARITIES[cr.rarity].col));
      this.shown.push({ c: cr, x: x + cw / 2, y: y + 18, s: 1.2, f: 1 });
      // (no name on the small cards: the big one beside them has it)
      L.add(centerText(this, x + cw / 2, y + 35, RARITIES[cr.rarity].name.split(' ').map((w) => w[0]).join(''), RARITIES[cr.rarity].col));
      L.add(this.add.rectangle(x + 3, y + ch - 5, cw - 6, 2, RARITIES[cr.rarity].col).setOrigin(0, 0));
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

  private map(): void {
    const L = this.layer;
    const c = store.get().creatures;
    L.add(text(this, 8, 18, 'WHERE TO FIGHT', PALETTE.cream));
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
      const beaten = c.bosses.includes(b.boss.id);
      L.add(text(this, x + 3, y + 3, beaten ? 'BOSS DOWN' : `${Math.min(c.biomeWins[b.id] ?? 0, BOSS_AFTER)}/${BOSS_AFTER}`, beaten ? PALETTE.gold : 0x10141a));
    });
    const b = BIOMES.find((x) => x.id === this.biome)!;
    const px = 196;
    L.add(this.add.rectangle(px, 26, 118, 134, 0x1a1e38).setOrigin(0, 0).setStrokeStyle(1, b.groundDark));
    L.add(text(this, px + 4, 30, b.name, PALETTE.gold));
    L.add(text(this, px + 4, 40, `WILD: ${b.elements.map((e) => ELEMENTS[e].name).join(' + ')}`, PALETTE.fog));
    L.add(text(this, px + 4, 50, `WINS HERE: ${c.biomeWins[b.id] ?? 0}`, PALETTE.fog));
    L.add(button(this, px + 59, 70, `FIGHT  ${BATTLE_COST} TOK`, () => this.fight(b.id, false), { width: 108, height: 13, disabled: ledger.balance() < BATTLE_COST }));
    L.add(text(this, px + 4, 82, `BOSS: ${b.boss.name}`, PALETTE.cream));
    L.add(text(this, px + 4, 92, b.boss.trick, PALETTE.ash));
    const open = bossOpen(b.id, c);
    L.add(button(this, px + 59, 110, open ? `BOSS  ${BATTLE_COST} TOK` : `BOSS AFTER ${BOSS_AFTER} WINS`, () => this.fight(b.id, true), { width: 108, height: 13, disabled: !open || ledger.balance() < BATTLE_COST }));
    L.add(text(this, px + 4, 124, `WIN: +${BATTLE_WIN} TOKENS`, PALETTE.mossLight));
    L.add(text(this, px + 4, 133, 'LOSE: YOUR CREATURE', PALETTE.ash));
    L.add(text(this, px + 4, 142, `FAINTS AND -${DEFEAT_PENALTY} TOKEN`, PALETTE.ash));
  }

  private fight(biome: string, boss: boolean): void {
    // the stake is taken by the arena, at the bell, not here
    this.scene.start('CreatureArena', { biome, boss, from: this.from });
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
