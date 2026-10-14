/**
 * ---- CREATURE CLASH, the fight.  Real time, top down, one on one.
 *
 *   move      WASD / arrows, or the move stick
 *   choose    1 2 3, or the three attack buttons -- BEFORE you aim
 *   aim+fire  mouse + click, or drag the aim stick and let go
 *
 * The stake is taken at the bell (creatureClash `startBattle`) and the fight
 * is settled exactly once (`finishBattle` / `retreat`), whatever order the
 * timers, taps and tab switches arrive in.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { button, centerText, confirmDialog, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { drawCreature } from '../art/creatureArt';
import { BIOMES, ELEMENTS, bossCreature, creatureById, wildFor, type Attack, type Biome, type Creature } from '../game/creatures';
import { activeOwned, finishBattle, retreat, startBattle } from '../game/creatureClash';
import { attackInfo } from '../game/attackInfo';
import { drawAttackIcon } from '../art/attackIcons';
import { setCabinetTouch } from '../game/touchLayouts';
import { backPlate } from '../ui/plate';
import type { KeyName } from '../ui/touchControls';

const ARENA = { x: 6, y: 24, w: GAME_W - 12, h: GAME_H - 52 };
const TIME_LIMIT = 120;

interface Fighter {
  c: Creature;
  x: number;
  y: number;
  hp: number;
  max: number;
  cds: [number, number, number];
  face: number;
  scale: number;
  burn: number;
  slow: number;
  stun: number;
  stunImmune: number;
  blind: number;
  shield: number;
  invuln: number;
  dash: { vx: number; vy: number; t: number; dmg: number; hit: boolean; a: Attack } | null;
  kx: number;
  ky: number;
  flash: number;
  moving: boolean;
}

interface Shot {
  owner: Fighter;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  a: Attack;
  pierce: boolean;
}

interface Fx {
  kind: 'ring' | 'beam' | 'spark' | 'warn' | 'boom';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r: number;
  t: number;
  life: number;
  col: number;
}

interface Mine {
  owner: Fighter;
  x: number;
  y: number;
  arm: number;
  life: number;
  dmg: number;
  a: Attack;
}

interface Hazard {
  x: number;
  y: number;
  r: number;
  t: number;
}

interface Prop {
  x: number;
  y: number;
  r: number;
}

/** Each boss's trick: how many marks, how wide, how often, how hard. */
const TRICKS: Record<string, { n: number; r: number; every: number; dmg: number }> = {
  caves: { n: 3, r: 12, every: 4.5, dmg: 12 },
  fields: { n: 1, r: 22, every: 3.5, dmg: 10 },
  forests: { n: 2, r: 14, every: 4, dmg: 11 },
  frozen: { n: 4, r: 10, every: 5, dmg: 9 },
  swamps: { n: 2, r: 18, every: 4.5, dmg: 10 },
  ruins: { n: 5, r: 9, every: 5, dmg: 10 },
  shore: { n: 1, r: 28, every: 5, dmg: 12 },
  desert: { n: 3, r: 10, every: 3.5, dmg: 11 },
  volcano: { n: 3, r: 14, every: 4, dmg: 13 },
};

export class CreatureArena extends Phaser.Scene {
  private biome!: Biome;
  private boss = false;
  private from = 'ArcadeLounge';
  private me!: Fighter;
  private foe!: Fighter;
  private shots: Shot[] = [];
  private fx: Fx[] = [];
  private mines: Mine[] = [];
  private hazards: Hazard[] = [];
  private props: Prop[] = [];
  private g!: Phaser.GameObjects.Graphics;
  private ui!: Phaser.GameObjects.Graphics;
  private dark!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.BitmapText[] = [];
  private timerText!: Phaser.GameObjects.BitmapText;
  private sel = 0;
  private over = false;
  private settled = false;
  private elapsed = 0;
  private hazardT = 3;
  private ai = { think: 0, mx: 0, my: 0, strafe: 1 };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private touch = false;
  /** h = where the stick rests; b = where this touch put it down. */
  private moveStick = { id: -1, hx: 0, hy: 0, bx: 0, by: 0, dx: 0, dy: 0 };
  private aimStick = { id: -1, hx: 0, hy: 0, bx: 0, by: 0, dx: 0, dy: 0 };
  private atkBtns: Array<{ x: number; y: number }> = [];
  private dialog: Phaser.GameObjects.Container | null = null;
  private paused = false;
  /**
   * A phone held upright: the controls are in the band under the picture (a
   * move pad and three labelled attack buttons that fire at the foe), and a
   * tap on the battlefield aims the chosen attack there -- nothing is drawn
   * over the fight.  Held sideways, the two sticks in the corners as before.
   */
  private band = false;
  /** The bell has gone: the stake is taken and the fight is on. */
  private started = false;
  private info!: Phaser.GameObjects.BitmapText;
  private info2!: Phaser.GameObjects.BitmapText;
  private infoPlate!: Phaser.GameObjects.Rectangle;
  private infoT = 0;

  constructor() {
    super('CreatureArena');
  }

  init(data: { biome?: string; boss?: boolean; from?: string }): void {
    this.biome = BIOMES.find((b) => b.id === data.biome) ?? BIOMES[0];
    this.boss = !!data.boss;
    this.from = data.from ?? 'ArcadeLounge';
    this.shots = [];
    this.fx = [];
    this.mines = [];
    this.hazards = [];
    this.props = [];
    this.labels = [];
    this.sel = 0;
    this.over = false;
    this.settled = false;
    this.elapsed = 0;
    this.hazardT = 3;
    this.dialog = null;
    this.paused = false;
    this.started = false;
    this.infoT = 0;
    this.moveStick = { id: -1, hx: 0, hy: 0, bx: 0, by: 0, dx: 0, dy: 0 };
    this.aimStick = { id: -1, hx: 0, hy: 0, bx: 0, by: 0, dx: 0, dy: 0 };
  }

  create(): void {
    const own = activeOwned();
    const mine = own ? creatureById(own.id) : undefined;
    if (!mine) {
      this.scene.start('CreatureHub', { from: this.from, msg: 'YOU NEED A CREATURE TO FIGHT.' });
      return;
    }
    const wins = store.get().creatures.biomeWins[this.biome.id] ?? 0;
    const foeC = this.boss ? bossCreature(this.biome) : wildFor(this.biome, wins);
    this.me = this.fighter(mine, ARENA.x + 40, ARENA.y + ARENA.h / 2, 1, 1);
    this.foe = this.fighter(foeC, ARENA.x + ARENA.w - 40, ARENA.y + ARENA.h / 2, -1, this.boss ? 1.8 : 1);

    this.paintGround();
    this.g = this.add.graphics().setDepth(10);
    this.dark = this.add.graphics().setDepth(40);
    this.ui = this.add.graphics().setDepth(50);
    // (before the hud: it lays the buttons out for whichever this is)
    const touchDevice = this.sys.game.device.input.touch;
    this.band = touchDevice && window.innerHeight >= window.innerWidth;
    this.touch = touchDevice && !this.band;
    this.paintHud();
    if (this.band) {
      const keys: KeyName[] = ['FOUR', 'FIVE', 'SIX'];
      setCabinetTouch(
        {
          stick: 'wasd',
          buttons: this.me.c.attacks.map((a, i) => {
            const inf = attackInfo(a, this.me.c.element);
            return { label: `${inf.emoji}\n${inf.word}`, key: keys[i], primary: i === 0 };
          }),
        },
        'CreatureArena',
      );
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setCabinetTouch(null));
    }
    // the band's attack buttons: pick that attack and let it go at the foe
    this.input.keyboard!.on('keydown-FOUR', () => this.quickFire(0));
    this.input.keyboard!.on('keydown-FIVE', () => this.quickFire(1));
    this.input.keyboard!.on('keydown-SIX', () => this.quickFire(2));
    // what the chosen attack does, along the bottom of the arena for a moment
    this.infoPlate = this.add.rectangle(GAME_W / 2, ARENA.y + ARENA.h - 10, GAME_W - 24, 19, PALETTE.ink, 0.92).setStrokeStyle(1, PALETTE.steel).setDepth(55).setVisible(false);
    this.info = centerText(this, GAME_W / 2, ARENA.y + ARENA.h - 15, '', PALETTE.gold).setDepth(56).setVisible(false);
    this.info2 = centerText(this, GAME_W / 2, ARENA.y + ARENA.h - 6, '', PALETTE.cream).setDepth(56).setVisible(false);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-ONE', () => this.choose(0));
    this.input.keyboard!.on('keydown-TWO', () => this.choose(1));
    this.input.keyboard!.on('keydown-THREE', () => this.choose(2));
    this.input.addPointer(2);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.down(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.moveP(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.up(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.up(p));
    (window as unknown as { __clash?: unknown }).__clash = this;
    this.cameras.main.fadeIn(250, 0, 0, 0);
    // nothing moves until the count is done; the stake goes at the bell
    this.paused = true;
    this.countdown();
  }

  /**
   * 3, 2, 1 -- big, in the middle of the arena, each one popping in and
   * fading -- and then the bell.  Nothing is said about what you are up
   * against: you find out by fighting it.  (QUIT during the count goes back
   * to the menu, and nothing has been spent.)
   */
  private countdown(): void {
    const cx = ARENA.x + ARENA.w / 2;
    const cy = ARENA.y + ARENA.h / 2;
    const ready = centerText(this, cx, cy - 26, 'GET READY', PALETTE.cream).setDepth(2400);
    backPlate(this, ready);
    const step = (n: number): void => {
      if (this.over || !this.scene.isActive()) return;
      if (n === 0) {
        ready.destroy();
        this.begin();
        return;
      }
      audio.sfx('ui_blip', 0.7);
      const t = centerText(this, cx, cy, String(n), n === 1 ? PALETTE.gold : PALETTE.cream, 32).setDepth(2401);
      const ring = this.add.circle(cx, cy, 14).setStrokeStyle(2, n === 1 ? PALETTE.gold : PALETTE.neon).setDepth(2400);
      t.setScale(1.6).setAlpha(0);
      this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 180, ease: 'Back.Out' });
      this.tweens.add({ targets: t, alpha: 0, delay: 560, duration: 200, onComplete: () => t.destroy() });
      this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 760, ease: 'Quad.Out', onComplete: () => ring.destroy() });
      this.time.delayedCall(800, () => step(n - 1));
    };
    this.time.delayedCall(350, () => step(3));
  }

  /** The count is done: the stake, the bell, and go. */
  private begin(): void {
    const r = startBattle(this.biome.id, this.boss);
    if (!r.ok) {
      this.scene.start('CreatureHub', { from: this.from, msg: r.msg });
      return;
    }
    this.dialog?.destroy();
    this.dialog = null;
    this.started = true;
    this.paused = false;
    audio.sfx('bell_ding', 0.6);
    const go = centerText(this, ARENA.x + ARENA.w / 2, ARENA.y + ARENA.h / 2, 'FIGHT!', PALETTE.gold, 24).setDepth(2401);
    this.tweens.add({ targets: go, scale: 1.4, alpha: 0, delay: 250, duration: 450, onComplete: () => go.destroy() });
    this.showInfo(this.sel);
  }

  /** A band button: that attack, now, at the foe (a blink goes the way you are walking). */
  private quickFire(i: number): void {
    if (this.over || this.paused || !this.started || this.dialog) return;
    this.choose(i);
    const a = this.me.c.attacks[i];
    const k = this.keys;
    const mx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const my = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (a.kind === 'blink' && (mx || my)) this.fire(this.me, i, mx, my);
    else this.fire(this.me, i, this.foe.x - this.me.x, this.foe.y - this.me.y);
  }

  /** What the chosen attack does, in one place, for a few seconds. */
  private showInfo(i: number): void {
    const a = this.me.c.attacks[i];
    if (!a || !this.info) return;
    const inf = attackInfo(a, this.me.c.element);
    this.info.setText(`${a.name}: ${inf.type} - ${inf.target}`);
    this.info2.setText(`${inf.range}${a.dmg > 0 ? ` - ${a.dmg} DMG` : ''} - EVERY ${a.cd}S`);
    this.infoT = 3;
  }

  private fighter(c: Creature, x: number, y: number, face: number, scale: number): Fighter {
    return { c, x, y, hp: c.hp, max: c.hp, cds: [0, 0.8, 2], face, scale, burn: 0, slow: 0, stun: 0, stunImmune: 0, blind: 0, shield: 0, invuln: 0, dash: null, kx: 0, ky: 0, flash: 0, moving: false };
  }

  // ------------------------------------------------------------------ setup

  private paintGround(): void {
    const b = this.biome;
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x0c0e18, 1).fillRect(0, 0, GAME_W, GAME_H);
    g.fillStyle(b.ground, 1).fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    // patches, so the floor reads as ground and not a flat box
    const rnd = new Phaser.Math.RandomDataGenerator([b.id]);
    for (let i = 0; i < 60; i++) {
      g.fillStyle(i % 3 ? b.groundDark : 0xffffff, i % 3 ? 0.35 : 0.06);
      g.fillEllipse(ARENA.x + rnd.between(4, ARENA.w - 4), ARENA.y + rnd.between(4, ARENA.h - 4), rnd.between(6, 22), rnd.between(3, 9));
    }
    g.lineStyle(2, b.groundDark, 1).strokeRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    // cover: never on top of either fighter's start, never touching another
    const n = this.boss ? 4 : 6;
    let guard = 0;
    while (this.props.length < n && guard++ < 200) {
      const p = { x: ARENA.x + rnd.between(60, ARENA.w - 60), y: ARENA.y + rnd.between(16, ARENA.h - 16), r: rnd.between(6, 10) };
      if (this.props.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < q.r + p.r + 18)) continue;
      this.props.push(p);
    }
    for (const p of this.props) this.paintProp(g, p);
  }

  private paintProp(g: Phaser.GameObjects.Graphics, p: Prop): void {
    const b = this.biome;
    g.fillStyle(0x000000, 0.25).fillEllipse(p.x + 2, p.y + p.r * 0.7, p.r * 2.2, p.r);
    switch (b.prop) {
      case 'rock':
      case 'pillar':
        g.fillStyle(b.prop === 'pillar' ? 0xb8ae90 : 0x6a625a, 1).fillCircle(p.x, p.y, p.r);
        g.fillStyle(b.prop === 'pillar' ? 0xd8d0b0 : 0x8a827a, 1).fillCircle(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.5);
        break;
      case 'tree':
        g.fillStyle(0x5a3a1e, 1).fillRect(p.x - 2, p.y, 4, p.r * 0.8);
        g.fillStyle(0x2a5a1e, 1).fillCircle(p.x, p.y - 2, p.r);
        g.fillStyle(0x4a8a2e, 1).fillCircle(p.x - 2, p.y - 4, p.r * 0.6);
        break;
      case 'tuft':
        g.fillStyle(0x5a8a2e, 1).fillCircle(p.x, p.y, p.r);
        g.fillStyle(0xe8d870, 1).fillCircle(p.x + 2, p.y - 2, 2);
        break;
      case 'ice':
        g.fillStyle(0xa8e0f0, 1).fillTriangle(p.x - p.r, p.y + p.r * 0.6, p.x + p.r, p.y + p.r * 0.6, p.x, p.y - p.r * 1.3);
        g.fillStyle(0xffffff, 0.7).fillTriangle(p.x - 2, p.y + 2, p.x + 2, p.y + 2, p.x, p.y - p.r);
        break;
      case 'reed':
        g.fillStyle(0x2a4a3a, 1).fillEllipse(p.x, p.y, p.r * 2.2, p.r * 1.4);
        for (let i = -2; i <= 2; i++) g.fillStyle(0x6a8a3a, 1).fillRect(p.x + i * 2, p.y - p.r, 1, p.r);
        break;
      case 'shell':
        g.fillStyle(0xf0d8c0, 1).fillCircle(p.x, p.y, p.r);
        g.lineStyle(1, 0xc8a890, 1);
        for (let i = -2; i <= 2; i++) g.lineBetween(p.x, p.y + p.r * 0.8, p.x + i * p.r * 0.35, p.y - p.r * 0.8);
        break;
      case 'cactus':
        g.fillStyle(0x3a8a4a, 1).fillRoundedRect(p.x - 3, p.y - p.r, 6, p.r * 1.8, 3);
        g.fillRoundedRect(p.x - 8, p.y - p.r * 0.4, 5, 4, 2);
        g.fillRoundedRect(p.x + 3, p.y - p.r * 0.7, 5, 4, 2);
        break;
      case 'vent':
        g.fillStyle(0x2a1a14, 1).fillCircle(p.x, p.y, p.r);
        g.fillStyle(0xe8642a, 0.9).fillCircle(p.x, p.y, p.r * 0.45);
        break;
    }
  }

  private paintHud(): void {
    const name = (f: Fighter): string => (f === this.foe && this.boss ? f.c.name : f.c.name.toUpperCase());
    this.labels.push(text(this, 8, 3, name(this.me), PALETTE.cream).setDepth(51));
    this.labels.push(text(this, GAME_W - 8, 3, name(this.foe), this.boss ? PALETTE.gold : PALETTE.cream).setOrigin(1, 0).setDepth(51));
    this.timerText = centerText(this, GAME_W / 2, 7, '', PALETTE.fog).setDepth(51);
    button(this, GAME_W / 2, 18, 'QUIT', () => this.askQuit(), { width: 30, height: 8 }).setDepth(60);
    // the attack strip / touch buttons
    const left = store.get().creatures.handed === 'left';
    if (this.touch) {
      // aim stick on the dominant side, its three attack buttons above it
      const ax = left ? 34 : GAME_W - 34;
      const mx = left ? GAME_W - 34 : 34;
      Object.assign(this.aimStick, { hx: ax, hy: GAME_H - 28 });
      Object.assign(this.moveStick, { hx: mx, hy: GAME_H - 28 });
      const dir = left ? 1 : -1;
      this.atkBtns = [0, 1, 2].map((i) => ({ x: ax + dir * (34 + i * 26), y: GAME_H - 14 }));
    } else if (this.band) {
      // (on the band under the picture)
      this.atkBtns = [];
    } else {
      this.atkBtns = [0, 1, 2].map((i) => ({ x: 58 + i * 102, y: GAME_H - 13 }));
    }
    // the strip: the key, the icon (drawn each frame), the name
    if (!this.touch && !this.band) {
      this.me.c.attacks.forEach((a, i) => {
        const b = this.atkBtns[i];
        this.labels.push(text(this, b.x - 46, b.y - 4, `${i + 1}`, PALETTE.fog).setDepth(52));
        this.labels.push(text(this, b.x - 26, b.y - 4, a.name, PALETTE.cream).setDepth(52));
      });
    }
    // what your element does: under the attack strip's corner, or (on a phone, where the stick is) up by your name
    const eff = ELEMENTS[this.me.c.element];
    if (this.touch) {
      const t = text(this, 8 + this.labels[0].width + 6, 3, eff.effect, eff.light).setDepth(51);
      // (only if it clears the clock in the middle)
      if (t.x + t.width < GAME_W / 2 - 12) this.labels.push(t);
      else t.destroy();
    }
    else if (!this.band) this.labels.push(text(this, 6, GAME_H - 26, eff.effect, eff.light).setDepth(51));
  }

  // ------------------------------------------------------------------ input

  private choose(i: number): void {
    if (this.over) return;
    if (this.sel !== i) this.showInfo(i);
    this.sel = i;
    audio.sfx('ui_blip', 0.4);
  }

  private hitBtn(p: Phaser.Input.Pointer): number {
    const r = this.touch ? 12 : 0;
    for (let i = 0; i < 3; i++) {
      const b = this.atkBtns[i];
      if (!b) continue;
      if (this.touch ? Math.hypot(p.x - b.x, p.y - b.y) < r : Math.abs(p.x - b.x) < 48 && Math.abs(p.y - b.y) < 7) return i;
    }
    return -1;
  }

  private down(p: Phaser.Input.Pointer): void {
    if (this.over || this.dialog) return;
    const b = this.hitBtn(p);
    if (b >= 0) {
      this.choose(b);
      return;
    }
    if (p.y < 24) return; // the hud, and QUIT
    if (this.touch) {
      const leftHalf = p.x < GAME_W / 2;
      const moveLeft = store.get().creatures.handed !== 'left';
      if (leftHalf === moveLeft) {
        if (this.moveStick.id < 0) Object.assign(this.moveStick, { id: p.id, bx: p.x, by: p.y, dx: 0, dy: 0 });
      } else if (this.aimStick.id < 0) Object.assign(this.aimStick, { id: p.id, bx: p.x, by: p.y, dx: 0, dy: 0 });
      return;
    }
    this.fire(this.me, this.sel, p.x - this.me.x, p.y - this.me.y);
  }

  private moveP(p: Phaser.Input.Pointer): void {
    for (const s of [this.moveStick, this.aimStick]) {
      if (s.id !== p.id) continue;
      let dx = p.x - s.bx;
      let dy = p.y - s.by;
      const m = Math.hypot(dx, dy);
      if (m > 20) {
        dx = (dx / m) * 20;
        dy = (dy / m) * 20;
      }
      s.dx = dx;
      s.dy = dy;
    }
  }

  private up(p: Phaser.Input.Pointer): void {
    if (this.moveStick.id === p.id) Object.assign(this.moveStick, { id: -1, dx: 0, dy: 0 });
    if (this.aimStick.id === p.id) {
      const { dx, dy } = this.aimStick;
      Object.assign(this.aimStick, { id: -1, dx: 0, dy: 0 });
      if (this.over) return;
      // a tap with no drag aims itself at the other one
      if (Math.hypot(dx, dy) < 4) this.fire(this.me, this.sel, this.foe.x - this.me.x, this.foe.y - this.me.y);
      else this.fire(this.me, this.sel, dx, dy);
    }
  }

  private askQuit(): void {
    if (!this.started) {
      this.scene.start('CreatureHub', { from: this.from });
      return;
    }
    if (this.over || this.dialog) return;
    this.paused = true;
    this.dialog = confirmDialog(this, {
      lines: ['RUN FROM THE BATTLE?', 'YOUR CREATURE COMES HOME.', 'THE 2 TOKENS ARE SPENT, AND -1 MORE.'],
      confirm: 'RUN',
      onConfirm: () => {
        this.dialog = null;
        this.over = true;
        this.settled = true;
        const r = retreat();
        this.scene.start('CreatureHub', { from: this.from, msg: r.msg });
      },
      onCancel: () => {
        this.dialog?.destroy();
        this.dialog = null;
        this.paused = false;
      },
    });
    this.dialog.setDepth(3000);
  }

  // ----------------------------------------------------------------- combat

  private fire(f: Fighter, i: number, ax: number, ay: number): boolean {
    if (f.cds[i] > 0 || f.stun > 0 || f.dash || f.hp <= 0) return false;
    const a = f.c.attacks[i];
    const m = Math.hypot(ax, ay) || 1;
    const ux = ax / m;
    const uy = ay / m;
    f.cds[i] = a.cd;
    f.face = ux >= 0 ? 1 : -1;
    const col = ELEMENTS[f.c.element].col;
    const pierce = f.c.element === 'glow';
    const shot = (ang: number): void => {
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const vx = ux * c - uy * s;
      const vy = ux * s + uy * c;
      const sp = a.reach;
      this.shots.push({ owner: f, x: f.x + vx * 8 * f.scale, y: f.y + vy * 8 * f.scale, vx: vx * sp, vy: vy * sp, life: 0.9, dmg: a.dmg, a, pierce });
    };
    switch (a.kind) {
      case 'bolt':
        shot(0);
        audio.sfx('throw_whoosh', 0.25);
        break;
      case 'spread':
        for (const k of [-0.26, 0, 0.26]) shot(k);
        audio.sfx('throw_whoosh', 0.3);
        break;
      case 'nova': {
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: a.reach * f.scale, t: 0, life: 0.35, col });
        const o = this.other(f);
        if (Math.hypot(o.x - f.x, o.y - f.y) < a.reach * f.scale + 7 * o.scale) this.hit(f, o, a.dmg, a);
        audio.sfx('arcane_blast', 0.4);
        break;
      }
      case 'dash':
        f.dash = { vx: ux * a.reach, vy: uy * a.reach, t: 0.28, dmg: a.dmg, hit: false, a };
        audio.sfx('throw_whoosh', 0.4);
        break;
      case 'beam': {
        const len = a.reach * f.scale;
        const x2 = f.x + ux * len;
        const y2 = f.y + uy * len;
        this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2, y2, r: 3, t: 0, life: 0.18, col });
        const o = this.other(f);
        if (this.segDist(o.x, o.y, f.x, f.y, x2, y2) < 6 * o.scale + 2 && (pierce || !this.blocked(f.x, f.y, o.x, o.y))) this.hit(f, o, a.dmg, a);
        audio.sfx('arcane_cast', 0.35);
        break;
      }
      case 'mine': {
        const d = Math.min(40, m);
        const mx = Phaser.Math.Clamp(f.x + ux * d, ARENA.x + 4, ARENA.x + ARENA.w - 4);
        const my = Phaser.Math.Clamp(f.y + uy * d, ARENA.y + 4, ARENA.y + ARENA.h - 4);
        // three down at most: the oldest goes
        const own = this.mines.filter((x) => x.owner === f);
        if (own.length >= 3) this.mines.splice(this.mines.indexOf(own[0]), 1);
        this.mines.push({ owner: f, x: mx, y: my, arm: 0.5, life: 8, dmg: a.dmg, a });
        audio.sfx('item_thud', 0.3);
        break;
      }
      case 'shield':
        f.shield = a.reach;
        audio.sfx('heal_up', 0.3);
        break;
      case 'blink': {
        let tx = f.x + ux * a.reach;
        let ty = f.y + uy * a.reach;
        tx = Phaser.Math.Clamp(tx, ARENA.x + 8, ARENA.x + ARENA.w - 8);
        ty = Phaser.Math.Clamp(ty, ARENA.y + 8, ARENA.y + ARENA.h - 8);
        if (!this.props.some((p) => Math.hypot(p.x - tx, p.y - ty) < p.r + 6)) {
          this.fx.push({ kind: 'spark', x: f.x, y: f.y, r: 8, t: 0, life: 0.3, col });
          f.x = tx;
          f.y = ty;
          f.invuln = 0.25;
          this.fx.push({ kind: 'spark', x: f.x, y: f.y, r: 8, t: 0, life: 0.3, col });
        }
        audio.sfx('arcane_cast', 0.3);
        break;
      }
    }
    return true;
  }

  private other(f: Fighter): Fighter {
    return f === this.me ? this.foe : this.me;
  }

  /** Damage, its element's effect, and the numbers. */
  private hit(from: Fighter, to: Fighter, dmg: number, a: Attack | null): void {
    if (this.over || to.hp <= 0 || to.invuln > 0) return;
    if (to.shield > 0) {
      this.fx.push({ kind: 'spark', x: to.x, y: to.y, r: 10, t: 0, life: 0.2, col: 0xffffff });
      return;
    }
    let d = dmg;
    if (to.c.element === 'stone') d *= 0.85;
    d = Math.max(1, Math.round(d));
    to.hp = Math.max(0, to.hp - d);
    to.flash = 0.12;
    // the number, rising off whoever took it
    const n = text(this, to.x, to.y - 14 * to.scale, `${d}`, to === this.me ? 0xff8a8a : 0xffe060).setOrigin(0.5, 1).setDepth(58);
    this.tweens.add({ targets: n, y: n.y - 10, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => n.destroy() });
    this.fx.push({ kind: 'spark', x: to.x, y: to.y - 4, r: 6, t: 0, life: 0.25, col: ELEMENTS[from.c.element].light });
    audio.sfx('whack', 0.3);
    if (a) {
      switch (from.c.element) {
        case 'ember':
          to.burn = 3;
          break;
        case 'tide': {
          const m = Math.hypot(to.x - from.x, to.y - from.y) || 1;
          to.kx += ((to.x - from.x) / m) * 140;
          to.ky += ((to.y - from.y) / m) * 140;
          break;
        }
        case 'moss':
          from.hp = Math.min(from.max, from.hp + Math.round(d * 0.25));
          break;
        case 'frost':
          to.slow = 2;
          break;
        case 'volt':
          if (to.stunImmune <= 0) {
            to.stun = 0.35;
            to.stunImmune = 1.5;
          }
          break;
        case 'murk':
          to.blind = 2.5;
          break;
        default:
          break;
      }
    }
  }

  private blocked(x1: number, y1: number, x2: number, y2: number): boolean {
    return this.props.some((p) => this.segDist(p.x, p.y, x1, y1, x2, y2) < p.r);
  }

  private segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l = dx * dx + dy * dy || 1;
    const t = Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / l, 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  /** Move with walls, cover and knockback; true if it got anywhere. */
  private step(f: Fighter, vx: number, vy: number, dt: number): void {
    const r = 6 * f.scale;
    let nx = f.x + (vx + f.kx) * dt;
    let ny = f.y + (vy + f.ky) * dt;
    f.kx *= Math.pow(0.02, dt);
    f.ky *= Math.pow(0.02, dt);
    nx = Phaser.Math.Clamp(nx, ARENA.x + r, ARENA.x + ARENA.w - r);
    ny = Phaser.Math.Clamp(ny, ARENA.y + r, ARENA.y + ARENA.h - r);
    for (const p of this.props) {
      const d = Math.hypot(nx - p.x, ny - p.y);
      if (d < p.r + r) {
        const k = (p.r + r - d) / (d || 1);
        nx += (nx - p.x) * k;
        ny += (ny - p.y) * k;
      }
    }
    f.moving = Math.hypot(nx - f.x, ny - f.y) > 0.2;
    f.x = nx;
    f.y = ny;
  }

  private speedOf(f: Fighter): number {
    return f.c.speed * (f.slow > 0 ? 0.55 : 1);
  }

  private tickFighter(f: Fighter, dt: number): void {
    for (let i = 0; i < 3; i++) f.cds[i] = Math.max(0, f.cds[i] - dt);
    for (const k of ['slow', 'stun', 'stunImmune', 'blind', 'shield', 'invuln', 'flash'] as const) f[k] = Math.max(0, f[k] - dt);
    if (f.burn > 0) {
      const before = Math.floor(f.burn);
      f.burn = Math.max(0, f.burn - dt);
      if (Math.floor(f.burn) !== before) {
        f.hp = Math.max(0, f.hp - 2);
        this.fx.push({ kind: 'spark', x: f.x, y: f.y - 6, r: 4, t: 0, life: 0.2, col: 0xff8a3a });
      }
    }
    if (f.dash) {
      f.dash.t -= dt;
      this.step(f, f.dash.vx, f.dash.vy, dt);
      const o = this.other(f);
      if (!f.dash.hit && Math.hypot(o.x - f.x, o.y - f.y) < 7 * (o.scale + f.scale)) {
        f.dash.hit = true;
        this.hit(f, o, f.dash.dmg, f.dash.a);
      }
      if (f.dash.t <= 0) f.dash = null;
    }
  }

  // ---------------------------------------------------------------------- AI

  private think(dt: number): void {
    const f = this.foe;
    const p = this.me;
    if (f.stun > 0 || f.dash || f.hp <= 0) return;
    const dx = p.x - f.x;
    const dy = p.y - f.y;
    const dist = Math.hypot(dx, dy) || 1;
    this.ai.think -= dt;
    if (this.ai.think <= 0) {
      this.ai.think = 0.5 + Math.random() * 0.6;
      if (Math.random() < 0.3) this.ai.strafe *= -1;
    }
    // close in for the big one, hang back for the shots
    const want = f.cds[2] <= 0 && f.c.attacks[2].kind === 'nova' ? 26 : 85;
    const toward = dist > want + 10 ? 1 : dist < want - 10 ? -1 : 0;
    const ux = dx / dist;
    const uy = dy / dist;
    const vx = (ux * toward + -uy * this.ai.strafe * 0.7) * this.speedOf(f);
    const vy = (uy * toward + ux * this.ai.strafe * 0.7) * this.speedOf(f);
    this.step(f, vx, vy, dt);
    f.face = dx >= 0 ? 1 : -1;
    // aim, worse when blinded; leads a moving target a little
    const err = (f.blind > 0 ? 0.6 : 0.16) * (Math.random() - 0.5) * 2;
    const ang = Math.atan2(dy, dx) + err;
    const ax = Math.cos(ang);
    const ay = Math.sin(ang);
    const clear = !this.blocked(f.x, f.y, p.x, p.y) || f.c.element === 'glow';
    const a2 = f.c.attacks[2];
    const a1 = f.c.attacks[1];
    if (f.cds[2] <= 0 && ((a2.kind === 'nova' && dist < a2.reach * f.scale + 4) || (a2.kind !== 'nova' && dist < (a2.kind === 'beam' ? a2.reach * f.scale : 150) && clear))) this.fire(f, 2, ax, ay);
    else if (f.cds[1] <= 0 && this.useSig(a1, dist, clear, f)) this.fire(f, 1, a1.kind === 'blink' ? -uy * this.ai.strafe : ax, a1.kind === 'blink' ? ux * this.ai.strafe : ay);
    else if (f.cds[0] <= 0 && clear && dist < 170 && Math.random() < dt * 2.2) this.fire(f, 0, ax, ay);
  }

  private useSig(a: Attack, dist: number, clear: boolean, f: Fighter): boolean {
    switch (a.kind) {
      case 'dash':
        return dist < 70 && clear;
      case 'beam':
        return dist < a.reach * f.scale && clear;
      case 'shield':
        return this.shots.some((s) => s.owner !== f && Math.hypot(s.x - f.x, s.y - f.y) < 40);
      case 'blink':
        return dist < 40;
      case 'mine':
        return dist < 60;
      case 'spread':
        return clear && dist < 150;
      default:
        return false;
    }
  }

  // ------------------------------------------------------------------ frame

  update(time: number, delta: number): void {
    if (!this.me || !this.foe) return;
    const running = this.scene.isActive('SettingsModal');
    const dt = this.paused || running || this.over ? 0 : Math.min(delta, 50) / 1000;
    if (dt > 0) this.simulate(dt);
    this.infoT = Math.max(0, this.infoT - Math.min(delta, 50) / 1000);
    this.render(time / 1000);
  }

  private simulate(dt: number): void {
    this.elapsed += dt;
    const me = this.me;
    // ---- you
    let mx = 0;
    let my = 0;
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) mx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) mx += 1;
    if (k.W.isDown || k.UP.isDown) my -= 1;
    if (k.S.isDown || k.DOWN.isDown) my += 1;
    if (this.moveStick.id >= 0) {
      mx = this.moveStick.dx / 20;
      my = this.moveStick.dy / 20;
    }
    const m = Math.hypot(mx, my);
    if (m > 1) {
      mx /= m;
      my /= m;
    }
    this.tickFighter(me, dt);
    this.tickFighter(this.foe, dt);
    if (me.stun <= 0 && !me.dash) {
      this.step(me, mx * this.speedOf(me), my * this.speedOf(me), dt);
      if (!this.touch) me.face = this.input.activePointer.x >= me.x ? 1 : -1;
      else if (Math.abs(mx) > 0.2) me.face = mx > 0 ? 1 : -1;
    }
    this.think(dt);

    // ---- shots
    for (const s of this.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      const o = this.other(s.owner);
      if (Math.hypot(o.x - s.x, o.y - s.y) < 6 * o.scale + 2) {
        this.hit(s.owner, o, s.dmg, s.a);
        s.life = 0;
      } else if (!s.pierce && this.props.some((p) => Math.hypot(p.x - s.x, p.y - s.y) < p.r)) {
        s.life = 0;
        this.fx.push({ kind: 'spark', x: s.x, y: s.y, r: 3, t: 0, life: 0.15, col: 0xffffff });
      } else if (s.x < ARENA.x || s.x > ARENA.x + ARENA.w || s.y < ARENA.y || s.y > ARENA.y + ARENA.h) s.life = 0;
    }
    this.shots = this.shots.filter((s) => s.life > 0);

    // ---- mines
    for (const mi of this.mines) {
      mi.arm -= dt;
      mi.life -= dt;
      const o = this.other(mi.owner);
      if (mi.arm <= 0 && Math.hypot(o.x - mi.x, o.y - mi.y) < 12 * o.scale) {
        this.hit(mi.owner, o, mi.dmg, mi.a);
        this.fx.push({ kind: 'boom', x: mi.x, y: mi.y, r: 14, t: 0, life: 0.3, col: ELEMENTS[mi.owner.c.element].col });
        mi.life = 0;
      }
    }
    this.mines = this.mines.filter((x) => x.life > 0);

    // ---- the boss's trick: marks on the floor, then they go off
    if (this.boss) {
      const tr = TRICKS[this.biome.id];
      this.hazardT -= dt;
      if (this.hazardT <= 0) {
        this.hazardT = tr.every;
        for (let i = 0; i < tr.n; i++) {
          const spread = i === 0 ? 0 : 50;
          this.hazards.push({
            x: Phaser.Math.Clamp(me.x + (Math.random() - 0.5) * spread * 2, ARENA.x + 10, ARENA.x + ARENA.w - 10),
            y: Phaser.Math.Clamp(me.y + (Math.random() - 0.5) * spread, ARENA.y + 10, ARENA.y + ARENA.h - 10),
            r: tr.r,
            t: 1.1,
          });
        }
      }
      for (const h of this.hazards) {
        h.t -= dt;
        if (h.t <= 0) {
          this.fx.push({ kind: 'boom', x: h.x, y: h.y, r: h.r, t: 0, life: 0.3, col: ELEMENTS[this.biome.boss.element].col });
          if (Math.hypot(me.x - h.x, me.y - h.y) < h.r + 5) this.hit(this.foe, me, tr.dmg, this.foe.c.attacks[0]);
        }
      }
      this.hazards = this.hazards.filter((h) => h.t > 0);
    }

    for (const e of this.fx) e.t += dt;
    this.fx = this.fx.filter((e) => e.t < e.life);

    // ---- the end
    if (this.me.hp <= 0 || this.foe.hp <= 0) this.end(this.foe.hp <= 0 && this.me.hp > 0);
    else if (this.elapsed >= TIME_LIMIT) this.end(this.me.hp / this.me.max > this.foe.hp / this.foe.max);
  }

  private end(won: boolean): void {
    if (this.over) return;
    this.over = true;
    if (this.settled) return;
    this.settled = true;
    const r = finishBattle(won);
    audio.sfx(won ? 'cha_ching' : 'death_stinger', 0.6);
    const timeUp = this.me.hp > 0 && this.foe.hp > 0;
    this.time.delayedCall(700, () => {
      const box = this.add.container(0, 0).setDepth(2000);
      box.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0, 0).setInteractive());
      box.add(this.add.rectangle(GAME_W / 2, GAME_H / 2, 220, 74, PALETTE.ink).setStrokeStyle(1, won ? PALETTE.gold : 0xc31f2e));
      box.add(centerText(this, GAME_W / 2, GAME_H / 2 - 24, won ? (this.boss ? 'BOSS DEFEATED!' : 'VICTORY!') : 'DEFEATED', won ? PALETTE.gold : 0xff6a6a));
      if (timeUp) box.add(centerText(this, GAME_W / 2, GAME_H / 2 - 13, 'TIME: MORE HEALTH LEFT WINS', PALETTE.ash));
      box.add(centerText(this, GAME_W / 2, GAME_H / 2 - 2, r.msg, PALETTE.cream));
      box.add(button(this, GAME_W / 2, GAME_H / 2 + 22, 'CONTINUE', () => this.scene.start('CreatureHub', { from: this.from, msg: r.msg }), { width: 80, height: 13 }));
    });
  }

  /**
   * How far the chosen attack reaches, drawn faintly on the ground from you:
   * a line for a shot, a beam or a charge, a cone for a fan, a ring for an
   * area or a blink, the throw ring for a trap, a halo for a guard.
   */
  private drawReach(g: Phaser.GameObjects.Graphics): void {
    const me = this.me;
    const a = me.c.attacks[this.sel];
    const inf = attackInfo(a, me.c.element);
    const col = ELEMENTS[me.c.element].light;
    let ax = this.foe.x - me.x;
    let ay = this.foe.y - me.y;
    if (!this.touch && !this.band) {
      const p = this.input.activePointer;
      ax = p.x - me.x;
      ay = p.y - me.y;
    } else if (this.touch && this.aimStick.id >= 0 && Math.hypot(this.aimStick.dx, this.aimStick.dy) > 4) {
      ax = this.aimStick.dx;
      ay = this.aimStick.dy;
    }
    const m = Math.hypot(ax, ay) || 1;
    const ux = ax / m;
    const uy = ay / m;
    const r = inf.reachPx;
    g.lineStyle(1, col, 0.28);
    if (a.kind === 'bolt' || a.kind === 'beam' || a.kind === 'dash') {
      for (let d = 6; d < r; d += 6) g.fillStyle(col, 0.3).fillRect(me.x + ux * d, me.y + uy * d, 1, 1);
      g.strokeCircle(me.x + ux * r, me.y + uy * r, 2);
    } else if (a.kind === 'spread') {
      const ang = Math.atan2(uy, ux);
      for (const k of [-0.26, 0, 0.26]) {
        for (let d = 6; d < r; d += 8) g.fillStyle(col, 0.25).fillRect(me.x + Math.cos(ang + k) * d, me.y + Math.sin(ang + k) * d, 1, 1);
      }
    } else if (a.kind === 'nova' || a.kind === 'blink' || a.kind === 'mine') {
      g.strokeCircle(me.x, me.y, r);
    } else if (a.kind === 'shield') {
      g.strokeCircle(me.x, me.y, 11);
    }
  }

  private render(t: number): void {
    const g = this.g;
    g.clear();
    // mines and hazard marks first: they are on the ground
    for (const mi of this.mines) {
      const col = ELEMENTS[mi.owner.c.element].col;
      g.fillStyle(col, mi.arm > 0 ? 0.4 : 0.8 + Math.sin(t * 10) * 0.2).fillCircle(mi.x, mi.y, 3);
      g.lineStyle(1, 0x000000, 0.5).strokeCircle(mi.x, mi.y, 3);
    }
    for (const h of this.hazards) {
      g.lineStyle(1, 0xff3a3a, 0.9).strokeCircle(h.x, h.y, h.r);
      g.fillStyle(0xff3a3a, 0.15 + (1.1 - h.t) * 0.3).fillCircle(h.x, h.y, h.r * (1 - h.t / 1.1));
    }
    // fighters, the lower one in front
    for (const f of [this.me, this.foe].sort((a, b) => a.y - b.y)) {
      if (f.shield > 0) g.lineStyle(1, 0xffffff, 0.8).strokeCircle(f.x, f.y, 11 * f.scale);
      drawCreature(g, f.c, f.x, f.y, f.scale, f.face, f.moving ? t * 1.8 : t);
      if (f.flash > 0) g.fillStyle(0xffffff, 0.5).fillCircle(f.x, f.y, 7 * f.scale);
      if (f.stun > 0) g.fillStyle(0xfff4a0, 1).fillRect(f.x - 5 + Math.sin(t * 20) * 3, f.y - 12 * f.scale, 2, 2);
      if (f.burn > 0) g.fillStyle(0xff8a3a, 0.8).fillTriangle(f.x - 2, f.y - 8 * f.scale, f.x + 2, f.y - 8 * f.scale, f.x, f.y - 12 * f.scale - Math.sin(t * 15) * 2);
      if (f.slow > 0) g.lineStyle(1, 0xbff0ff, 0.8).strokeEllipse(f.x, f.y + 7 * f.scale, 14 * f.scale, 4);
      // the little bar over the head
      const w = 18 * f.scale;
      g.fillStyle(0x000000, 0.6).fillRect(f.x - w / 2, f.y - 12 * f.scale - 4, w, 2);
      g.fillStyle(f === this.me ? 0x6ae86a : 0xff5a5a, 1).fillRect(f.x - w / 2, f.y - 12 * f.scale - 4, w * (f.hp / f.max), 2);
    }
    for (const s of this.shots) {
      const col = ELEMENTS[s.owner.c.element].col;
      g.fillStyle(ELEMENTS[s.owner.c.element].light, 1).fillCircle(s.x, s.y, 2.2);
      g.fillStyle(col, 0.6).fillCircle(s.x - s.vx * 0.012, s.y - s.vy * 0.012, 1.8);
    }
    for (const e of this.fx) {
      const k = e.t / e.life;
      if (e.kind === 'ring') g.lineStyle(2, e.col, 1 - k).strokeCircle(e.x, e.y, e.r * (0.3 + k * 0.7));
      else if (e.kind === 'beam') {
        g.lineStyle(e.r, e.col, 1 - k).lineBetween(e.x, e.y, e.x2!, e.y2!);
        g.lineStyle(1, 0xffffff, 1 - k).lineBetween(e.x, e.y, e.x2!, e.y2!);
      } else if (e.kind === 'boom') g.fillStyle(e.col, 0.7 * (1 - k)).fillCircle(e.x, e.y, e.r * (0.5 + k * 0.5));
      else g.fillStyle(e.col, 1 - k).fillCircle(e.x, e.y, e.r * (1 - k * 0.5));
    }

    // murk: you only see near yourself
    const d = this.dark;
    d.clear();
    if (this.me.blind > 0) {
      const a = Math.min(1, this.me.blind) * 0.8;
      for (let r = 0; r < 6; r++) {
        d.lineStyle(60, 0x10081a, a * (r === 0 ? 0.6 : 1)).strokeCircle(this.me.x, this.me.y, 64 + r * 50);
      }
    }

    // hud
    const u = this.ui;
    u.clear();
    const bar = (x: number, f: Fighter, right: boolean): void => {
      const w = 110;
      u.fillStyle(0x000000, 0.7).fillRect(right ? x - w : x, 13, w, 5);
      u.fillStyle(f === this.me ? 0x6ae86a : 0xff5a5a, 1).fillRect(right ? x - w * (f.hp / f.max) : x, 13, w * (f.hp / f.max), 5);
    };
    bar(8, this.me, false);
    bar(GAME_W - 8, this.foe, true);
    this.timerText.setText(`${Math.max(0, Math.ceil(TIME_LIMIT - this.elapsed))}`);
    const ic = ELEMENTS[this.me.c.element].light;
    this.me.c.attacks.forEach((a, i) => {
      const b = this.atkBtns[i];
      if (!b) return;
      const ready = 1 - this.me.cds[i] / a.cd;
      if (this.touch) {
        u.fillStyle(i === this.sel ? 0x6a3aa8 : 0x2a2a48, 0.85).fillCircle(b.x, b.y, 11);
        u.lineStyle(1, i === this.sel ? 0xffe060 : 0x8a8ab0, 1).strokeCircle(b.x, b.y, 11);
        drawAttackIcon(u, a.kind, b.x, b.y, ic);
        if (ready < 1) u.fillStyle(0x000000, 0.55).slice(b.x, b.y, 11, -Math.PI / 2, -Math.PI / 2 + (1 - ready) * Math.PI * 2, false).fillPath();
      } else {
        u.fillStyle(i === this.sel ? 0x4a2a78 : 0x1a1a30, 0.9).fillRect(b.x - 48, b.y - 7, 96, 13);
        u.fillStyle(0xffffff, 0.15).fillRect(b.x - 48, b.y + 4, 96 * Math.min(1, ready), 2);
        u.lineStyle(1, i === this.sel ? 0xffe060 : 0x4a4a68, 1).strokeRect(b.x - 48, b.y - 7, 96, 13);
        drawAttackIcon(u, a.kind, b.x - 34, b.y - 1, ic);
      }
    });
    // the chosen attack's line, fading
    const showing = this.infoT > 0 && !this.over && !this.dialog;
    this.info.setVisible(showing).setAlpha(Math.min(1, this.infoT));
    this.info2.setVisible(showing).setAlpha(Math.min(1, this.infoT));
    this.infoPlate.setVisible(showing).setAlpha(Math.min(1, this.infoT) * 0.92);
    if (this.started && !this.over) this.drawReach(g);
    if (this.touch) {
      for (const s of [this.moveStick, this.aimStick]) {
        const bx = s.id >= 0 ? s.bx : s.hx;
        const by = s.id >= 0 ? s.by : s.hy;
        u.fillStyle(0x000000, 0.35).fillCircle(bx, by, 20);
        u.lineStyle(1, 0xffffff, 0.4).strokeCircle(bx, by, 20);
        u.fillStyle(s === this.aimStick ? 0xffe060 : 0xffffff, 0.6).fillCircle(bx + s.dx, by + s.dy, 8);
      }
      if (this.aimStick.id >= 0 && Math.hypot(this.aimStick.dx, this.aimStick.dy) > 4) {
        const m = Math.hypot(this.aimStick.dx, this.aimStick.dy);
        u.lineStyle(1, 0xffe060, 0.6).lineBetween(this.me.x, this.me.y, this.me.x + (this.aimStick.dx / m) * 40, this.me.y + (this.aimStick.dy / m) * 40);
      }
    } else if (!this.over) {
      const p = this.input.activePointer;
      u.lineStyle(1, 0xffe060, 0.7).strokeCircle(p.x, p.y, 3);
    }
  }
}
