/**
 * ---- CREATURE CLASH, the fight.  Real time, top down, one on one.
 *
 *   move      WASD / arrows, or the move stick
 *   choose    1 2 3, or the three attack buttons -- BEFORE you aim
 *   aim+fire  mouse + click, or drag the aim stick and let go
 *
 * Two kinds of fight, and the training ground:
 *
 *   zone      one creature from the place's own pool; the stake is taken at
 *             the bell (creatureClash `startBattle`)
 *   ladder    the run's next step -- one of five creatures, then its boss --
 *             already paid for (`startLadderBattle`), and harder the higher
 *             up it is: not more health, a better fighter (see `skill`)
 *   training  a dummy, nothing at stake
 *
 * Every fight is settled exactly once (`finishBattle` / `retreat`), whatever
 * order the timers, taps and tab switches arrive in.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { button, centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { drawCreature } from '../art/creatureArt';
import { BIOMES, ELEMENTS, LADDER_LEVELS, type Attack, type Biome, type BossDef, type CoverShape, type Creature } from '../game/creatures';
import { activeOwned, finishBattle, ladderStep, nextZoneFoe, ownedCreature, startBattle, startLadderBattle } from '../game/creatureClash';
import { MAX_LEVEL, levelOf } from '../game/creatureLevel';
import { AURA_POWER, AURA_S, AURA_SPEED, MEND_FRAC, ROOT_S, WALL_S, attackInfo } from '../game/attackInfo';
import { drawAttackIcon } from '../art/attackIcons';
import { setCabinetTouch } from '../game/touchLayouts';
import { backPlate } from '../ui/plate';
import type { KeyName } from '../ui/touchControls';
import { isTouch } from '../core/device';

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
  /** A few seconds of being faster and hitting harder. */
  aura: number;
  /** Held where you stand, by a snare or by roots. */
  root: number;
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
  /** A snare holds whatever it catches. */
  snare?: boolean;
  /** A lobbed shot: it goes OVER the cover and bursts where it lands. */
  arc?: { sx: number; sy: number; tx: number; ty: number; t: number; dur: number; r: number };
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

/**
 * A boss's mark on the floor: it is drawn from the moment it is put down,
 * and goes off when `t` runs out.  A `line` is a strip from (x, y) to
 * (x2, y2); a `ring` is a band at radius `r` (a shockwave); a `meteor` falls
 * from the sky onto a growing shadow.  `go` runs when it goes off.
 */
interface Hazard {
  kind: 'mark' | 'meteor' | 'line' | 'ring';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  r: number;
  t: number;
  /** How long it was down for in all (for the telegraph's fill). */
  t0: number;
  dmg: number;
  /** A grasp holds you where it catches you. */
  holds?: boolean;
  go?: () => void;
}

/**
 * ---- WHAT YOU GET BEHIND.
 *
 * A barrier is a piece of the place -- a stand of trees, a ridge of rock, a
 * fallen column, a crust of cooled lava -- and it is drawn as one thing.
 * Underneath it is a few overlapping circles (`parts`), which is what the
 * walking, the shots and the line of sight actually test against, so a long
 * hedge stops you along its whole length instead of being one fat disc with
 * a tree painted on it.
 */
interface Prop {
  x: number;
  y: number;
  r: number;
}

interface Barrier {
  kind: CoverShape;
  parts: Prop[];
  seed: number;
  /** Seconds left, for one somebody dropped mid-fight; -1 for the scenery. */
  life: number;
  /** Who put it there (their colour tints it), or null for the place itself. */
  owner: Fighter | null;
}

/**
 * ---- EACH BOSS FIGHTS THE FLOOR AS WELL AS YOU, and each one its own way
 * (`BossDef.pattern`; `n`, `r`, `every` and `dmg` are how many, how wide,
 * how often and how hard).  Every one is telegraphed -- you can always see
 * what is coming and where to be:
 *
 *   teleport   the lich: marks round you, and it blinks to wherever it can see you
 *   meteor     the seraph, and only the seraph: shadows grow, then stars land on them
 *   tribeam    the hydra: three lines of breath from its three heads
 *   webs       the queen: webs thrown round your feet -- they hold
 *   roots      the maw: roots under you and where you were going -- they hold
 *   lightning  the cloud: bolts walk across the floor straight at you
 *   burrow     the wyrm: it goes under, and comes up beside you
 *   charge     the sphinx: a line drawn at you, then a pounce down it
 *   tentacles  the kraken: arms roll across the floor in waves
 *   quake      the mammoth: it stamps, and rings run out from it
 *
 * And NONE OF THEM can be waited out behind a wall: a boss that has not
 * been able to see you for a couple of seconds comes for you (`HIDE_S`).
 */
const HIDE_S = 2.2;

export class CreatureArena extends Phaser.Scene {
  private biome!: Biome;
  private mode: 'zone' | 'ladder' | 'training' = 'zone';
  /** The ladder step this is (6 = the boss). */
  private level = 0;
  private boss = false;
  /**
   * How good a fighter the opponent is, 0..1: how well it aims, leads and
   * dodges, how often it shoots, and whether it works its way round cover
   * to get a line on you.  A zone creature is middling; the ladder climbs
   * from clumsy to sharp; a boss is as good as it gets.
   */
  private skill = 0.35;
  /** How long the opponent has had no line of sight on you. */
  private hidden = 0;
  /** Your velocity, for an opponent that leads its shots. */
  private meV = { x: 0, y: 0 };
  private dodge = { vx: 0, vy: 0, t: 0 };
  private seenShots = new WeakSet<Shot>();
  private lastFoePos = { x: 0, y: 0, stuck: 0 };
  /**
   * ---- THE TRAINING GROUND.
   *
   * Nothing is staked, nothing is won, and nothing can faint: a straw dummy
   * that takes every hit, says what it took, and stands back up.  It is
   * where you find out what a move actually does before it costs you a
   * battle -- the clock is off, and QUIT never goes away.
   */
  private training = false;
  private from = 'ArcadeLounge';
  private me!: Fighter;
  private foe!: Fighter;
  private shots: Shot[] = [];
  private fx: Fx[] = [];
  private mines: Mine[] = [];
  private hazards: Hazard[] = [];
  private props: Prop[] = [];
  private barriers: Barrier[] = [];
  private terrain!: Phaser.GameObjects.Graphics;
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
  /** Your creature's level, for the name over its bar. */
  private myLevel = 1;

  constructor() {
    super('CreatureArena');
  }

  init(data: { biome?: string; mode?: 'zone' | 'ladder' | 'training'; from?: string; training?: boolean }): void {
    this.biome = BIOMES.find((b) => b.id === data.biome) ?? BIOMES[0];
    this.mode = data.training ? 'training' : data.mode ?? 'zone';
    this.training = this.mode === 'training';
    this.boss = false;
    this.level = 0;
    this.skill = 0.35;
    this.hidden = 0;
    this.meV = { x: 0, y: 0 };
    this.dodge = { vx: 0, vy: 0, t: 0 };
    this.seenShots = new WeakSet<Shot>();
    this.from = data.from ?? 'ArcadeLounge';
    this.shots = [];
    this.fx = [];
    this.mines = [];
    this.hazards = [];
    this.props = [];
    this.barriers = [];
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
    // (yours fights at its level: see creatureLevel)
    const mine = own ? ownedCreature(own) : undefined;
    this.myLevel = own ? levelOf(own.xp ?? 0) : 1;
    if (!mine) {
      this.scene.start('CreatureHub', { from: this.from, msg: 'YOU NEED A CREATURE TO FIGHT.' });
      return;
    }
    // WHO YOU ARE UP AGAINST.  A ladder fight is the run's own next step,
    // drawn when the run was paid for: the place and the opponent come from
    // it, never from here, so nothing about it can be re-rolled.
    let wild: Creature;
    if (this.mode === 'ladder') {
      const step = ladderStep();
      if (!step) {
        this.scene.start('CreatureHub', { from: this.from, screen: 'ladder', msg: 'NO LADDER RUN IS ON.' });
        return;
      }
      this.biome = BIOMES.find((b) => b.id === step.biome) ?? this.biome;
      this.level = step.level;
      this.boss = step.boss;
      wild = step.foe;
      this.skill = step.boss ? 1 : 0.3 + ((step.level - 1) / (LADDER_LEVELS - 1)) * 0.6;
    } else wild = nextZoneFoe(this.biome);
    // (a copy: the roster's own entry is never renamed)
    const foeC = this.training ? { ...wild, name: 'TRAINING DUMMY' } : wild;
    this.me = this.fighter(mine, ARENA.x + 40, ARENA.y + ARENA.h / 2, 1, 1);
    // (a boss is bigger, not huge: it has to fit the arena and be fair to hit)
    this.foe = this.fighter(foeC, ARENA.x + ARENA.w - 40, ARENA.y + ARENA.h / 2, -1, this.boss ? 1.35 : 1);
    this.lastFoePos = { x: this.foe.x, y: this.foe.y, stuck: 0 };

    this.paintGround();
    this.g = this.add.graphics().setDepth(10);
    this.dark = this.add.graphics().setDepth(40);
    this.ui = this.add.graphics().setDepth(50);
    // (before the hud: it lays the buttons out for whichever this is)
    // (the game's own answer -- a coarse pointer and no fine one -- not
    // Phaser's "has a touch screen", which a touchscreen laptop also has:
    // on a desktop the sticks never appear)
    const touchDevice = isTouch();
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
    // 1 2 3: that ability, now, at the mouse (on a phone, just the choice)
    this.input.keyboard!.on('keydown-ONE', () => this.keyFire(0));
    this.input.keyboard!.on('keydown-TWO', () => this.keyFire(1));
    this.input.keyboard!.on('keydown-THREE', () => this.keyFire(2));
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
    if (!this.training) {
      const r = this.mode === 'ladder' ? startLadderBattle() : startBattle(this.biome.id, this.foe.c.id);
      if (!r.ok) {
        this.scene.start('CreatureHub', { from: this.from, screen: this.mode === 'ladder' ? 'ladder' : 'map', msg: r.msg });
        return;
      }
      // its own cry, at the bell
      audio.sfx(this.foe.c.cry, 0.5);
    }
    this.dialog?.destroy();
    this.dialog = null;
    this.started = true;
    this.paused = false;
    audio.sfx('bell_ding', 0.6);
    const go = centerText(this, ARENA.x + ARENA.w / 2, ARENA.y + ARENA.h / 2, 'FIGHT!', PALETTE.gold, 24).setDepth(2401);
    this.tweens.add({ targets: go, scale: 1.4, alpha: 0, delay: 250, duration: 450, onComplete: () => go.destroy() });
    this.showInfo(this.sel);
    if (this.training) {
      const t = centerText(this, ARENA.x + ARENA.w / 2, ARENA.y + 10, 'TRAINING MODE DOES NOT AWARD TOKENS.', PALETTE.fog).setDepth(2401);
      backPlate(this, t);
      this.time.delayedCall(3500, () => this.tweens.add({ targets: t, alpha: 0, duration: 500, onComplete: () => t.destroy() }));
    }
  }

  /**
   * A number key on a desktop: choose that ability and let it go where the
   * mouse is pointing.  Before the bell (or on a phone) it only chooses.
   */
  private keyFire(i: number): void {
    this.choose(i);
    if (this.touch || this.band || this.over || this.paused || !this.started || this.dialog) return;
    const p = this.input.activePointer;
    this.fire(this.me, i, p.worldX - this.me.x, p.worldY - this.me.y);
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
    return { c, x, y, hp: c.hp, max: c.hp, cds: [0, 0.8, 2], face, scale, burn: 0, slow: 0, stun: 0, stunImmune: 0, blind: 0, shield: 0, invuln: 0, aura: 0, root: 0, dash: null, kx: 0, ky: 0, flash: 0, moving: false };
  }

  // ------------------------------------------------------------------ setup

  private paintGround(): void {
    const b = this.biome;
    const g = this.add.graphics().setDepth(0);
    const rnd = new Phaser.Math.RandomDataGenerator([b.id]);
    // ---- the world outside the fence: the sky and light of the place, so
    // the arena is somewhere rather than a coloured box on black
    g.fillStyle(b.mood.sky, 1).fillRect(0, 0, GAME_W, GAME_H);
    for (let i = 0; i < 40; i++) {
      g.fillStyle(b.mood.fleck, 0.1 + rnd.frac() * 0.12);
      g.fillCircle(rnd.between(0, GAME_W), rnd.between(0, GAME_H), rnd.frac() * 1.6);
    }
    // ---- the ground
    g.fillStyle(b.ground, 1).fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    for (let i = 0; i < 90; i++) {
      g.fillStyle(i % 3 ? b.groundDark : 0xffffff, i % 3 ? 0.3 : 0.05);
      g.fillEllipse(ARENA.x + rnd.between(4, ARENA.w - 4), ARENA.y + rnd.between(4, ARENA.h - 4), rnd.between(6, 24), rnd.between(3, 9));
    }
    // a worn track round the middle, where fights happen
    g.lineStyle(3, b.groundDark, 0.25).strokeEllipse(ARENA.x + ARENA.w / 2, ARENA.y + ARENA.h / 2, ARENA.w * 0.72, ARENA.h * 0.78);
    // the haze of the place, heaviest at the edges: light coming in over it
    for (let i = 0; i < 5; i++) {
      g.fillStyle(b.mood.haze, 0.05);
      g.fillRect(ARENA.x, ARENA.y + i * 2, ARENA.w, 2);
      g.fillRect(ARENA.x, ARENA.y + ARENA.h - 2 - i * 2, ARENA.w, 2);
      g.fillRect(ARENA.x + i * 2, ARENA.y, 2, ARENA.h);
      g.fillRect(ARENA.x + ARENA.w - 2 - i * 2, ARENA.y, 2, ARENA.h);
    }
    g.lineStyle(2, b.groundDark, 1).strokeRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);

    this.layOutCover(rnd);
    this.terrain = this.add.graphics().setDepth(1);
    this.repaintCover();
  }

  /**
   * ---- WHERE THE COVER GOES, AND WHY IT IS WHERE IT IS.
   *
   * Not six discs at random.  Each world lays its own out: the fields grow
   * trees in clumps you can duck into, the caves and the pass run ridges
   * across the floor with gaps to break through, the ruins stand their
   * columns round the edge and leave the middle to the fight, the shore and
   * the mire scatter.  Nothing is placed over either fighter's start, and
   * the middle of the arena is always crossable.
   */
  private layOutCover(rnd: Phaser.Math.RandomDataGenerator): void {
    const b = this.biome;
    const midY = ARENA.y + ARENA.h / 2;
    // somewhere a piece can go: off both starts, inside the fence, and -- for
    // a barrier being built OUT OF several pieces -- clear of the OTHER
    // barriers only, since a ridge or a stand is meant to touch itself
    const clear = (x: number, y: number, r: number, apart = true): boolean =>
      Math.hypot(x - this.me.x, y - this.me.y) > r + 26 &&
      Math.hypot(x - this.foe.x, y - this.foe.y) > r + 26 * this.foe.scale &&
      x > ARENA.x + 16 && x < ARENA.x + ARENA.w - 16 && y > ARENA.y + 10 && y < ARENA.y + ARENA.h - 10 &&
      (!apart || !this.props.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + r + 10));
    const add = (parts: Prop[]): void => {
      if (!parts.length) return;
      this.barriers.push({ kind: b.prop, parts, seed: rnd.between(1, 9999), life: -1, owner: null });
      this.props.push(...parts);
    };
    const n = this.boss ? 3 : 4;
    switch (b.cover) {
      case 'line': {
        // two ridges across the floor, each with a gap you can run through
        for (const k of [-1, 1]) {
          const cx = ARENA.x + ARENA.w / 2 + k * 46;
          const gap = rnd.between(-16, 16);
          const parts: Prop[] = [];
          for (let y = ARENA.y + 12; y < ARENA.y + ARENA.h - 12; y += 7) {
            if (Math.abs(y - (midY + gap)) < 15) continue;
            const x = cx + rnd.between(-2, 2);
            if (!clear(x, y, 5, false)) continue;
            parts.push({ x, y, r: 5 });
          }
          add(parts);
        }
        break;
      }
      case 'grove': {
        // clumps, the way trees grow -- real cover you can stand inside
        let guard = 0;
        while (this.barriers.length < n && guard++ < 200) {
          const cx = ARENA.x + rnd.between(46, ARENA.w - 46);
          const cy = ARENA.y + rnd.between(18, ARENA.h - 18);
          if (!clear(cx, cy, 16)) continue;
          const parts: Prop[] = [];
          for (let i = 0; i < rnd.between(4, 6); i++) {
            const a = rnd.rotation();
            const d = rnd.between(0, 11);
            const p = { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.7, r: rnd.between(5, 7) };
            if (clear(p.x, p.y, p.r, false)) parts.push(p);
          }
          add(parts);
        }
        break;
      }
      case 'ring': {
        // round the outside, leaving the floor in the middle open
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.3;
          const x = ARENA.x + ARENA.w / 2 + Math.cos(a) * ARENA.w * 0.36;
          const y = midY + Math.sin(a) * ARENA.h * 0.36;
          if (!clear(x, y, 8)) continue;
          add([{ x, y, r: rnd.between(7, 9) }]);
        }
        break;
      }
      default: {
        let guard = 0;
        while (this.barriers.length < n + 2 && guard++ < 200) {
          const x = ARENA.x + rnd.between(50, ARENA.w - 50);
          const y = ARENA.y + rnd.between(16, ARENA.h - 16);
          if (!clear(x, y, 9)) continue;
          add([{ x, y, r: rnd.between(6, 9) }]);
        }
        break;
      }
    }
  }

  /** Every barrier, drawn again: the scenery, and anything dropped since. */
  private repaintCover(): void {
    const g = this.terrain;
    g.clear();
    for (const bar of this.barriers) {
      const fade = bar.life >= 0 ? Math.min(1, bar.life / 1.2) : 1;
      g.setAlpha(fade);
      for (const p of bar.parts) this.paintProp(g, p, bar);
    }
    g.setAlpha(1);
  }

  /**
   * ---- NOTHING HERE IS A CIRCLE.
   *
   * A barrier is painted as the thing it is: `blob` makes a lumpy outline
   * from a seed (so the same rock is the same rock every time it is drawn),
   * and each kind puts its own silhouette, shading and detail on top -- a
   * crag with faces and a lit edge, a tree with a trunk and a notched crown,
   * a shard of ice with light through it, a stand of reeds, a cactus, a
   * crust of cooled lava.  The round outline underneath is only what the
   * walking and the shots test against; it is never what you see.
   */
  private blob(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, seed: number, squash = 1, n = 9): Phaser.Types.Math.Vector2Like[] {
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    let h = seed * 2654435761;
    const rnd = (): number => {
      h = (h ^ (h << 13)) >>> 0;
      h = (h ^ (h >>> 17)) >>> 0;
      h = (h ^ (h << 5)) >>> 0;
      return (h % 1000) / 1000;
    };
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (0.82 + rnd() * 0.36);
      pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * squash });
    }
    g.fillPoints(pts, true);
    return pts;
  }

  /** One piece of a barrier, in whatever the place is made of. */
  private paintProp(g: Phaser.GameObjects.Graphics, p: Prop, bar: Barrier): void {
    const kind = bar.kind;
    const tint = bar.owner ? ELEMENTS[bar.owner.c.element] : null;
    const seed = bar.seed + Math.round(p.x * 7 + p.y * 13);
    g.fillStyle(0x000000, 0.28);
    this.blob(g, p.x + 1.5, p.y + p.r * 0.75, p.r * 1.15, seed + 91, 0.42);
    switch (kind) {
      case 'rock':
      case 'pillar': {
        const pillar = kind === 'pillar';
        if (pillar) {
          // a fallen column: a drum with fluting and a broken end
          g.fillStyle(0x6a6048, 1).fillRect(p.x - p.r, p.y - p.r * 0.9, p.r * 2, p.r * 1.8);
          g.fillStyle(0xb8ae90, 1).fillRect(p.x - p.r + 1, p.y - p.r * 0.9, p.r * 2 - 2, p.r * 1.5);
          g.fillStyle(0xe0d8b8, 1).fillRect(p.x - p.r + 1, p.y - p.r * 0.9, p.r * 2 - 2, 1);
          for (let i = 0; i < 4; i++) g.fillStyle(0x8a8068, 0.8).fillRect(p.x - p.r + 2 + i * (p.r / 2.4), p.y - p.r * 0.7, 1, p.r * 1.2);
          g.fillStyle(0x4a4436, 1).fillRect(p.x - p.r, p.y + p.r * 0.6, p.r * 2, 2);
          // the broken top edge, chipped
          g.fillStyle(0x6a6048, 1);
          for (let i = 0; i < 3; i++) g.fillRect(p.x - p.r + 1 + i * (p.r * 0.7), p.y - p.r * 0.9, 2, 1 + (i % 2));
        } else {
          // a crag: a dark mass, two lit faces and a shadowed one
          g.fillStyle(0x332e2a, 1);
          this.blob(g, p.x, p.y, p.r * 1.08, seed, 0.95, 8);
          g.fillStyle(0x5a534a, 1);
          this.blob(g, p.x, p.y, p.r * 0.95, seed + 3, 0.95, 8);
          g.fillStyle(0x7d7468, 1).fillTriangle(p.x - p.r * 0.8, p.y + p.r * 0.5, p.x - p.r * 0.1, p.y - p.r, p.x + p.r * 0.4, p.y + p.r * 0.3);
          g.fillStyle(0x9a9183, 1).fillTriangle(p.x - p.r * 0.2, p.y - p.r * 0.9, p.x + p.r * 0.5, p.y - p.r * 0.2, p.x - p.r * 0.1, p.y - p.r * 0.1);
          g.fillStyle(0x241f1c, 0.7).fillTriangle(p.x + p.r * 0.3, p.y + p.r * 0.8, p.x + p.r, p.y - p.r * 0.1, p.x + p.r * 0.9, p.y + p.r * 0.8);
        }
        break;
      }
      case 'tree': {
        // a trunk with a root flare, and a crown of layered leaf masses
        g.fillStyle(0x2a1a0e, 1).fillRect(p.x - 2.5, p.y - 2, 5, p.r * 1.1);
        g.fillStyle(0x4a3018, 1).fillRect(p.x - 1.5, p.y - 2, 3, p.r * 1.1);
        g.fillStyle(0x2a1a0e, 1).fillRect(p.x - 4, p.y + p.r * 0.9, 8, 1.5);
        g.fillStyle(0x16300f, 1);
        this.blob(g, p.x, p.y - p.r * 0.5, p.r * 1.25, seed + 7, 0.85, 11);
        g.fillStyle(0x2a5a1c, 1);
        this.blob(g, p.x - 0.5, p.y - p.r * 0.7, p.r * 1.05, seed + 11, 0.85, 11);
        g.fillStyle(0x47892c, 1);
        this.blob(g, p.x - p.r * 0.3, p.y - p.r * 0.95, p.r * 0.62, seed + 19, 0.8, 9);
        g.fillStyle(0x76bb49, 0.9);
        this.blob(g, p.x - p.r * 0.45, p.y - p.r * 1.15, p.r * 0.3, seed + 23, 0.8, 7);
        break;
      }
      case 'tuft':
        // a clump of grass: a shaded base and blades of two lengths
        g.fillStyle(0x2e5416, 1);
        this.blob(g, p.x, p.y + 1, p.r * 1.1, seed, 0.5, 8);
        for (let i = -4; i <= 4; i++) {
          const h = p.r * (0.8 + ((i + 4) % 3) * 0.35);
          g.fillStyle(i % 2 ? 0x6aa83a : 0x4a8a2a, 1);
          g.fillTriangle(p.x + i * 1.7 - 0.6, p.y + 1, p.x + i * 1.7 + 0.6, p.y + 1, p.x + i * 1.7 + (i < 0 ? -1.4 : 1.4), p.y + 1 - h);
        }
        g.fillStyle(0xe8d870, 1).fillCircle(p.x + 2, p.y - p.r * 0.9, 1.2);
        break;
      case 'ice':
        // a shard: three faces, one of them nearly white
        g.fillStyle(0x3a7a9a, 1).fillTriangle(p.x - p.r * 1.1, p.y + p.r * 0.8, p.x + p.r * 1.1, p.y + p.r * 0.8, p.x - p.r * 0.1, p.y - p.r * 1.8);
        g.fillStyle(0x6ab4d6, 1).fillTriangle(p.x - p.r * 0.9, p.y + p.r * 0.7, p.x + p.r * 0.5, p.y + p.r * 0.7, p.x - p.r * 0.1, p.y - p.r * 1.6);
        g.fillStyle(0xbfe8f6, 1).fillTriangle(p.x - p.r * 0.5, p.y + p.r * 0.6, p.x + p.r * 0.1, p.y + p.r * 0.6, p.x - p.r * 0.15, p.y - p.r * 1.45);
        g.fillStyle(0xffffff, 0.9).fillTriangle(p.x - p.r * 0.2, p.y + p.r * 0.2, p.x + p.r * 0.05, p.y + p.r * 0.2, p.x - p.r * 0.12, p.y - p.r * 1.2);
        // a smaller shard leaning off it
        g.fillStyle(0x6ab4d6, 1).fillTriangle(p.x + p.r * 0.3, p.y + p.r * 0.8, p.x + p.r * 1.2, p.y + p.r * 0.8, p.x + p.r * 1.1, p.y - p.r * 0.5);
        break;
      case 'reed':
        // standing water, and reeds out of it with seed heads
        g.fillStyle(0x1e3024, 1);
        this.blob(g, p.x, p.y + 1, p.r * 1.25, seed, 0.45, 9);
        g.fillStyle(0x33503a, 0.8);
        this.blob(g, p.x, p.y + 1, p.r * 0.9, seed + 5, 0.45, 9);
        for (let i = -3; i <= 3; i++) {
          const h = p.r * (1.3 + ((i + 3) % 3) * 0.45);
          const lean = i * 0.5;
          g.fillStyle(0x5a7a32, 1).fillTriangle(p.x + i * 2.1 - 0.5, p.y + 1, p.x + i * 2.1 + 0.5, p.y + 1, p.x + i * 2.1 + lean, p.y + 1 - h);
          g.fillStyle(0x8a6a2a, 1).fillRect(p.x + i * 2.1 + lean - 0.5, p.y + 1 - h, 1.5, 2.5);
        }
        break;
      case 'shell':
        // a big conch lying on the sand, with its ribs and its lip
        g.fillStyle(0xb08a70, 1);
        this.blob(g, p.x, p.y + 1, p.r * 1.1, seed, 0.78, 10);
        g.fillStyle(0xf0dcc4, 1);
        this.blob(g, p.x - 0.5, p.y, p.r, seed + 2, 0.78, 10);
        g.lineStyle(1, 0xc8a890, 1);
        for (let i = -2; i <= 2; i++) g.lineBetween(p.x - p.r * 0.1, p.y + p.r * 0.7, p.x + i * p.r * 0.45, p.y - p.r * 0.8);
        g.fillStyle(0xfff4e8, 1).fillEllipse(p.x - p.r * 0.35, p.y - p.r * 0.3, p.r * 0.5, p.r * 0.35);
        g.fillStyle(0xd8b8a0, 1).fillEllipse(p.x + p.r * 0.6, p.y + p.r * 0.5, p.r * 0.7, p.r * 0.4);
        break;
      case 'cactus': {
        // a column with two arms, ribbed, with spines down it
        const h = p.r * 2.2;
        g.fillStyle(0x1c4a24, 1).fillRoundedRect(p.x - 4, p.y - h * 0.62, 8, h, 3.5);
        g.fillStyle(0x2f7a3a, 1).fillRoundedRect(p.x - 3, p.y - h * 0.6, 6, h - 1, 3);
        g.fillStyle(0x4aa84e, 1).fillRoundedRect(p.x - 3, p.y - h * 0.6, 2, h - 2, 1);
        g.fillStyle(0x1c4a24, 1).fillRoundedRect(p.x - p.r - 1, p.y - p.r * 0.5, 5.5, 4.5, 2);
        g.fillStyle(0x2f7a3a, 1).fillRoundedRect(p.x - p.r - 0.5, p.y - p.r * 0.45, 4.5, 3.5, 2);
        g.fillStyle(0x1c4a24, 1).fillRoundedRect(p.x + p.r - 4, p.y - p.r * 0.95, 5.5, 4.5, 2);
        g.fillStyle(0x2f7a3a, 1).fillRoundedRect(p.x + p.r - 3.5, p.y - p.r * 0.9, 4.5, 3.5, 2);
        for (let i = 0; i < 5; i++) g.fillStyle(0xe8f0b0, 1).fillRect(p.x - 1 + (i % 2) * 2, p.y - h * 0.5 + i * (h / 6), 1, 1);
        break;
      }
      case 'vent':
        // a crust of cooled lava, cracked, with the fire still under it
        g.fillStyle(0xff8a30, 0.5);
        this.blob(g, p.x, p.y, p.r * 1.2, seed + 13, 0.75, 9);
        g.fillStyle(0x1a0e08, 1);
        this.blob(g, p.x, p.y, p.r * 1.05, seed, 0.78, 10);
        g.fillStyle(0x3a2016, 1);
        this.blob(g, p.x - 0.5, p.y - 0.5, p.r * 0.85, seed + 4, 0.78, 10);
        // the cracks, glowing
        g.lineStyle(1, 0xff6a20, 0.95);
        g.lineBetween(p.x - p.r * 0.7, p.y + p.r * 0.3, p.x, p.y - p.r * 0.2);
        g.lineBetween(p.x, p.y - p.r * 0.2, p.x + p.r * 0.6, p.y + p.r * 0.4);
        g.lineBetween(p.x, p.y - p.r * 0.2, p.x + p.r * 0.2, p.y - p.r * 0.8);
        g.fillStyle(0xffd060, 0.9).fillCircle(p.x, p.y - p.r * 0.2, 1.2);
        break;
    }
    if (tint) {
      // somebody's own cover: it carries their colour so you know whose it is
      g.lineStyle(1, tint.light, 0.8).strokeCircle(p.x, p.y, p.r + 1);
    }
  }

  private paintHud(): void {
    const name = (f: Fighter): string => (f === this.foe && this.boss ? f.c.name : f.c.name.toUpperCase());
    this.labels.push(text(this, 8, 3, `${name(this.me)} LV${this.myLevel}`, PALETTE.cream).setDepth(51));
    this.labels.push(text(this, GAME_W - 8, 3, name(this.foe), this.boss ? PALETTE.gold : PALETTE.cream).setOrigin(1, 0).setDepth(51));
    // which step of the run this is, under the opponent's bar
    if (this.mode === 'ladder') this.labels.push(text(this, GAME_W - 8, 20, this.boss ? 'FINAL BOSS' : `LEVEL ${this.level} OF ${LADDER_LEVELS}`, PALETTE.gold).setOrigin(1, 0).setDepth(51));
    this.timerText = centerText(this, GAME_W / 2, 7, '', PALETTE.fog).setDepth(51);
    // ---- THERE IS NO LEAVING A BATTLE.  Not during the count either: a
    // real fight ends by winning it, losing it or running the clock out, and
    // no button says otherwise.  (Nobody is ever stuck: TIME_LIMIT settles
    // every battle on its own.)
    //
    // TRAINING is not a battle, so it has a way out -- and it goes in the
    // HUD, not over the arena: the middle of the top bar, in the slot the
    // clock would use, which training does not need (the bars either side of
    // it are untouched, and the line under it still says what your element
    // does).  Nothing it covers is part of the game being played.
    if (this.training) {
      // (8 high, at 5: it ends above the element line under it)
      button(this, GAME_W / 2, 5, 'LEAVE', () => this.askQuit(), { width: 40, height: 8 }).setDepth(60);
    }
    // the attack strip / touch buttons
    const left = store.get().creatures.handed === 'left';
    if (this.touch) {
      // aim stick on the dominant side, its three attack buttons above it
      const ax = left ? 34 : GAME_W - 34;
      const mx = left ? GAME_W - 34 : 34;
      Object.assign(this.aimStick, { hx: ax, hy: GAME_H - 28 });
      Object.assign(this.moveStick, { hx: mx, hy: GAME_H - 28 });
      const dir = left ? 1 : -1;
      this.atkBtns = [0, 1, 2].map((i) => ({ x: ax + dir * (36 + i * 30), y: GAME_H - 14 }));
    } else if (this.band) {
      // (on the band under the picture)
      this.atkBtns = [];
    } else {
      // three buttons 98 wide with 8 between them: a twelve-letter move name
      // (the longest there is -- see creatures MOVE_NAME_MAX) fits inside one
      // with its number and its icon, and still clears the border.
      this.atkBtns = [0, 1, 2].map((i) => ({ x: 54 + i * 106, y: GAME_H - 13 }));
    }
    // the strip: the key, the icon (drawn each frame), the name
    if (!this.touch && !this.band) {
      this.me.c.attacks.forEach((a, i) => {
        const b = this.atkBtns[i];
        // the key that fires it, always in view, on a keycap: [1] [2] [3]
        this.labels.push(centerText(this, b.x - 42.5, b.y - 0.5, `${i + 1}`, PALETTE.gold).setDepth(52));
        this.labels.push(text(this, b.x - 21, b.y - 4, a.name, PALETTE.cream).setDepth(52).setMaxWidth(68));
      });
    }
    // WHAT YOUR ELEMENT DOES, in the one place that is clear on every layout:
    // the middle of the top bar, under the clock, between the two health
    // bars.  Along the bottom it sat on top of the attack strip's border on
    // a phone, and beside your name it ran into the clock.
    const eff = ELEMENTS[this.me.c.element];
    // (a line lower in training, under the LEAVE button that takes the
    // clock's place there)
    this.labels.push(centerText(this, GAME_W / 2, this.training ? 17 : 15, eff.effect, eff.light).setDepth(51).setMaxWidth(GAME_W / 2 - 8));
  }

  // ------------------------------------------------------------------ input

  private choose(i: number): void {
    if (this.over) return;
    if (this.sel !== i) this.showInfo(i);
    this.sel = i;
    audio.sfx('ui_blip', 0.4);
  }

  private hitBtn(p: Phaser.Input.Pointer): number {
    const r = this.touch ? 13 : 0;
    for (let i = 0; i < 3; i++) {
      const b = this.atkBtns[i];
      if (!b) continue;
      if (this.touch ? Math.hypot(p.x - b.x, p.y - b.y) < r : Math.abs(p.x - b.x) < 49 && Math.abs(p.y - b.y) < 7) return i;
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
    if (p.y < 24) return; // the hud
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

  /**
   * The way out of the training ground, and only of the training ground: a
   * battle has no button to reach this, and if something else does, it does
   * nothing.
   */
  private askQuit(): void {
    if (!this.training) return;
    this.scene.start('CreatureHub', { from: this.from });
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
    // an aura is live: everything this creature throws hits harder
    const dmg = Math.round(a.dmg * (f.aura > 0 ? AURA_POWER : 1));
    const shot = (ang: number): void => {
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const vx = ux * c - uy * s;
      const vy = ux * s + uy * c;
      const sp = a.reach;
      this.shots.push({ owner: f, x: f.x + vx * 8 * f.scale, y: f.y + vy * 8 * f.scale, vx: vx * sp, vy: vy * sp, life: 0.9, dmg, a, pierce });
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
        if (Math.hypot(o.x - f.x, o.y - f.y) < a.reach * f.scale + 7 * o.scale) this.hit(f, o, dmg, a);
        audio.sfx('arcane_blast', 0.4);
        break;
      }
      case 'dash':
        f.dash = { vx: ux * a.reach, vy: uy * a.reach, t: 0.28, dmg, hit: false, a };
        audio.sfx('throw_whoosh', 0.4);
        break;
      case 'beam': {
        const len = a.reach * f.scale;
        const x2 = f.x + ux * len;
        const y2 = f.y + uy * len;
        this.fx.push({ kind: 'beam', x: f.x, y: f.y, x2, y2, r: 3, t: 0, life: 0.18, col });
        const o = this.other(f);
        if (this.segDist(o.x, o.y, f.x, f.y, x2, y2) < 6 * o.scale + 2 && (pierce || !this.blocked(f.x, f.y, o.x, o.y))) this.hit(f, o, dmg, a);
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
        this.mines.push({ owner: f, x: mx, y: my, arm: 0.5, life: 8, dmg, a });
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
      // ---- A LOB.  The only shot in the game that goes OVER cover: it
      // leaves the ground, flies to where you aimed (or as far as it
      // reaches) and bursts there, whether or not anything was in the way.
      case 'arc': {
        const d = Math.min(a.reach * 0.75, m);
        const tx = Phaser.Math.Clamp(f.x + ux * d, ARENA.x + 6, ARENA.x + ARENA.w - 6);
        const ty = Phaser.Math.Clamp(f.y + uy * d, ARENA.y + 6, ARENA.y + ARENA.h - 6);
        this.shots.push({
          owner: f, x: f.x, y: f.y, vx: 0, vy: 0, life: 9, dmg, a, pierce: true,
          arc: { sx: f.x, sy: f.y, tx, ty, t: 0, dur: 0.75, r: 16 },
        });
        audio.sfx('throw_whoosh', 0.35);
        break;
      }
      // ---- A SNARE.  It travels like a shot; what it catches cannot move
      // at all for a moment, which is how a slow creature catches a fast one.
      case 'snare': {
        const sp = a.reach;
        this.shots.push({ owner: f, x: f.x + ux * 8 * f.scale, y: f.y + uy * 8 * f.scale, vx: ux * sp, vy: uy * sp, life: 0.9, dmg, a, pierce: false, snare: true });
        audio.sfx('throw_whoosh', 0.3);
        break;
      }
      // ---- AN AURA.  A few seconds of being faster and hitting harder.
      case 'aura':
        f.aura = AURA_S;
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 20 * f.scale, t: 0, life: 0.5, col });
        audio.sfx('heal_up', 0.45);
        break;
      // ---- A MEND.  Health back, and nothing else: you have to make room.
      case 'mend': {
        const back = Math.round(f.max * MEND_FRAC);
        f.hp = Math.min(f.max, f.hp + back);
        const n = text(this, f.x, f.y - 16 * f.scale, `+${back}`, 0x8ae88a).setOrigin(0.5, 1).setDepth(58);
        this.tweens.add({ targets: n, y: n.y - 10, alpha: 0, duration: 700, onComplete: () => n.destroy() });
        this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 14 * f.scale, t: 0, life: 0.45, col: 0x8ae88a });
        audio.sfx('heal_up', 0.5);
        break;
      }
      // ---- A WALL.  A piece of this place, dropped where you aimed: it
      // stops shots and bodies exactly as the scenery does, and it goes
      // again after a few seconds.
      case 'wall': {
        const d = Math.max(16, Math.min(a.reach, m));
        const wx = Phaser.Math.Clamp(f.x + ux * d, ARENA.x + 12, ARENA.x + ARENA.w - 12);
        const wy = Phaser.Math.Clamp(f.y + uy * d, ARENA.y + 10, ARENA.y + ARENA.h - 10);
        // across the way you are facing, so it is cover and not a post
        const px = -uy;
        const py = ux;
        const parts: Prop[] = [-1, 0, 1].map((k) => ({
          x: Phaser.Math.Clamp(wx + px * k * 9, ARENA.x + 6, ARENA.x + ARENA.w - 6),
          y: Phaser.Math.Clamp(wy + py * k * 9, ARENA.y + 6, ARENA.y + ARENA.h - 6),
          r: 6,
        })).filter((q) => Math.hypot(q.x - this.other(f).x, q.y - this.other(f).y) > 10 * this.other(f).scale);
        if (parts.length) {
          this.barriers.push({ kind: this.biome.prop, parts, seed: 1, life: WALL_S, owner: f });
          this.props.push(...parts);
          this.repaintCover();
        }
        audio.sfx('item_thud', 0.4);
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
    if (f.root > 0) return 0;
    return f.c.speed * (f.slow > 0 ? 0.55 : 1) * (f.aura > 0 ? AURA_SPEED : 1);
  }

  private tickFighter(f: Fighter, dt: number): void {
    for (let i = 0; i < 3; i++) f.cds[i] = Math.max(0, f.cds[i] - dt);
    for (const k of ['slow', 'stun', 'stunImmune', 'blind', 'shield', 'invuln', 'aura', 'root', 'flash'] as const) f[k] = Math.max(0, f[k] - dt);
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
    const sk = this.skill;
    const dx = p.x - f.x;
    const dy = p.y - f.y;
    const dist = Math.hypot(dx, dy) || 1;
    const clear = !this.blocked(f.x, f.y, p.x, p.y) || f.c.element === 'glow';
    // aim: worse when blinded, better the sharper it is -- and a sharp one
    // shoots where you are GOING, not where you were
    const lead = sk > 0.5 ? (sk - 0.5) * 2 * Math.min(0.5, dist / 200) : 0;
    const tx = p.x + this.meV.x * lead;
    const ty = p.y + this.meV.y * lead;
    const err = (f.blind > 0 ? 0.6 : 0.3 - 0.24 * sk) * (Math.random() - 0.5) * 2;
    const ang = Math.atan2(ty - f.y, tx - f.x) + err;
    const ax = Math.cos(ang);
    const ay = Math.sin(ang);
    if (f.root > 0) {
      // held: it can still shoot, it just cannot go anywhere
      if (f.cds[0] <= 0 && clear) this.fire(f, 0, ax, ay);
      return;
    }
    this.ai.think -= dt;
    if (this.ai.think <= 0) {
      this.ai.think = 0.9 - 0.45 * sk + Math.random() * 0.5;
      if (Math.random() < 0.3) this.ai.strafe *= -1;
    }
    const ux = dx / dist;
    const uy = dy / dist;
    const spd = this.speedOf(f);
    let vx: number;
    let vy: number;
    // ---- A SHOT COMING: a good fighter sees it and steps out of its way
    if (this.dodge.t <= 0) {
      for (const s of this.shots) {
        if (s.owner === f || s.arc || this.seenShots.has(s)) continue;
        const rx = f.x - s.x;
        const ry = f.y - s.y;
        const sp = Math.hypot(s.vx, s.vy) || 1;
        const ahead = (rx * s.vx + ry * s.vy) / sp;
        if (ahead <= 0 || ahead > 60) continue;
        this.seenShots.add(s);
        // where it passes, how close
        const miss = Math.abs(rx * s.vy - ry * s.vx) / sp;
        if (miss > 10 * f.scale || Math.random() > sk * 0.85) continue;
        const side = rx * s.vy - ry * s.vx >= 0 ? 1 : -1;
        this.dodge = { vx: (s.vy / sp) * side, vy: (-s.vx / sp) * side, t: 0.28 };
        break;
      }
    }
    if (this.dodge.t > 0) {
      this.dodge.t -= dt;
      vx = this.dodge.vx * spd * 1.3;
      vy = this.dodge.vy * spd * 1.3;
    } else if (!clear && (sk >= 0.4 || this.boss)) {
      // ---- NO LINE ON YOU: work round the cover to somewhere that has one
      const spot = this.sightSpot(f, false);
      const mx = (spot?.x ?? p.x) - f.x;
      const my = (spot?.y ?? p.y) - f.y;
      const m = Math.hypot(mx, my) || 1;
      vx = (mx / m) * spd;
      vy = (my / m) * spd;
    } else {
      // close in for the big one, hang back for the shots
      const want = f.cds[2] <= 0 && f.c.attacks[2].kind === 'nova' ? 26 : 85;
      const toward = dist > want + 10 ? 1 : dist < want - 10 ? -1 : 0;
      vx = (ux * toward + -uy * this.ai.strafe * 0.7) * spd;
      vy = (uy * toward + ux * this.ai.strafe * 0.7) * spd;
    }
    this.step(f, vx, vy, dt);
    // stuck on something: go round it the other way
    const moved = Math.hypot(f.x - this.lastFoePos.x, f.y - this.lastFoePos.y);
    this.lastFoePos.stuck = moved < spd * dt * 0.25 && spd > 0 ? this.lastFoePos.stuck + dt : 0;
    if (this.lastFoePos.stuck > 0.35) {
      this.ai.strafe *= -1;
      this.lastFoePos.stuck = 0;
      this.dodge = { vx: -uy * this.ai.strafe, vy: ux * this.ai.strafe, t: 0.4 };
    }
    this.lastFoePos.x = f.x;
    this.lastFoePos.y = f.y;
    f.face = dx >= 0 ? 1 : -1;
    const a2 = f.c.attacks[2];
    const a1 = f.c.attacks[1];
    const bigOn =
      a2.kind === 'nova' ? dist < a2.reach * f.scale + 4
      : a2.kind === 'beam' ? dist < a2.reach * f.scale && clear
      : a2.kind === 'arc' || a2.kind === 'snare' || a2.kind === 'aura' || a2.kind === 'mend' || a2.kind === 'wall' || a2.kind === 'dash' ? this.useSig(a2, dist, clear, f)
      : dist < 150 && clear;
    if (f.cds[2] <= 0 && bigOn) this.fire(f, 2, ax, ay);
    else if (f.cds[1] <= 0 && this.useSig(a1, dist, clear, f)) this.fire(f, 1, a1.kind === 'blink' ? -uy * this.ai.strafe : ax, a1.kind === 'blink' ? ux * this.ai.strafe : ay);
    else if (f.cds[0] <= 0 && clear && dist < 170 && Math.random() < dt * (1.2 + 2.4 * sk)) this.fire(f, 0, ax, ay);
  }

  /**
   * A place near you that has a clear line to you, for `f` to get to: the
   * nearest such spot to it (walking), or any good one (blinking in).
   */
  private sightSpot(f: Fighter, anywhere: boolean): { x: number; y: number } | null {
    const p = this.me;
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const rad of [70, 50, 95]) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const x = p.x + Math.cos(a) * rad;
        const y = p.y + Math.sin(a) * rad * 0.8;
        if (x < ARENA.x + 10 || x > ARENA.x + ARENA.w - 10 || y < ARENA.y + 10 || y > ARENA.y + ARENA.h - 10) continue;
        if (this.props.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + 7 * f.scale)) continue;
        if (this.blocked(x, y, p.x, p.y)) continue;
        const d = anywhere ? Math.random() : Math.hypot(x - f.x, y - f.y);
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
      if (best) return best;
    }
    return best;
  }

  /**
   * The dummy: it wanders a little so moving targets are worth practising
   * on, it never attacks, and when it is knocked down it stands straight
   * back up.  Your own health comes back too -- a burn or a snare from a
   * trap of your own still has to wear off, so you can see what it does.
   */
  private trainDummy(dt: number): void {
    const f = this.foe;
    this.ai.think -= dt;
    if (this.ai.think <= 0) {
      this.ai.think = 1.2 + Math.random();
      this.ai.mx = (Math.random() - 0.5) * 2;
      this.ai.my = (Math.random() - 0.5) * 2;
    }
    if (f.stun <= 0 && f.root <= 0) this.step(f, this.ai.mx * 26, this.ai.my * 20, dt);
    f.face = this.me.x >= f.x ? -1 : 1;
    this.me.hp = Math.min(this.me.max, this.me.hp + this.me.max * 0.12 * dt);
    if (f.hp <= 0) {
      f.hp = f.max;
      f.x = ARENA.x + ARENA.w - 50;
      f.y = ARENA.y + ARENA.h / 2;
      this.fx.push({ kind: 'ring', x: f.x, y: f.y, r: 16, t: 0, life: 0.4, col: 0xffe060 });
      const n = centerText(this, GAME_W / 2, ARENA.y + 14, 'IT GETS BACK UP', PALETTE.gold).setDepth(60);
      this.tweens.add({ targets: n, alpha: 0, delay: 600, duration: 500, onComplete: () => n.destroy() });
    }
  }

  private useSig(a: Attack, dist: number, clear: boolean, f: Fighter): boolean {
    switch (a.kind) {
      case 'arc':
        // the shot for when there IS something in the way
        return dist < a.reach * 0.75 && (!clear || dist > 60);
      case 'snare':
        return dist < a.reach * 0.8 && clear;
      case 'aura':
        return f.aura <= 0;
      case 'mend':
        return f.hp < f.max * 0.55;
      case 'wall':
        return dist > 50 && dist < 160;
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
    const px0 = me.x;
    const py0 = me.y;
    if (me.stun <= 0 && me.root <= 0 && !me.dash) {
      this.step(me, mx * this.speedOf(me), my * this.speedOf(me), dt);
      if (!this.touch) me.face = this.input.activePointer.x >= me.x ? 1 : -1;
      else if (Math.abs(mx) > 0.2) me.face = mx > 0 ? 1 : -1;
    }
    // (smoothed, for an opponent that leads its shots)
    this.meV.x += ((me.x - px0) / dt - this.meV.x) * Math.min(1, dt * 6);
    this.meV.y += ((me.y - py0) / dt - this.meV.y) * Math.min(1, dt * 6);
    if (this.training) this.trainDummy(dt);
    else this.think(dt);

    // ---- shots
    for (const s of this.shots) {
      // a lob is in the air: it follows its own path and nothing stops it
      if (s.arc) {
        s.arc.t += dt;
        const k = Math.min(1, s.arc.t / s.arc.dur);
        s.x = s.arc.sx + (s.arc.tx - s.arc.sx) * k;
        s.y = s.arc.sy + (s.arc.ty - s.arc.sy) * k;
        if (k >= 1) {
          s.life = 0;
          const o = this.other(s.owner);
          this.fx.push({ kind: 'boom', x: s.x, y: s.y, r: s.arc.r, t: 0, life: 0.35, col: ELEMENTS[s.owner.c.element].col });
          if (Math.hypot(o.x - s.x, o.y - s.y) < s.arc.r + 5 * o.scale) this.hit(s.owner, o, s.dmg, s.a);
          audio.sfx('arcane_blast', 0.35);
        }
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      const o = this.other(s.owner);
      if (Math.hypot(o.x - s.x, o.y - s.y) < 6 * o.scale + 2) {
        this.hit(s.owner, o, s.dmg, s.a);
        if (s.snare && o.hp > 0) {
          o.root = ROOT_S;
          this.fx.push({ kind: 'ring', x: o.x, y: o.y, r: 12 * o.scale, t: 0, life: 0.4, col: ELEMENTS[s.owner.c.element].light });
        }
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

    // ---- the boss's mechanic: marks on the floor, then they go off
    const def = this.boss ? this.foe.c.boss : undefined;
    if (def) {
      this.hazardT -= dt;
      if (this.hazardT <= 0) {
        this.hazardT = def.every;
        this.bossPattern(def);
      }
      // ---- NO HIDING.  Out of its sight too long and it comes for you:
      // the lich blinks to where it can see you; the rest throw what they
      // have at the place you are hiding in, now
      this.hidden = this.blocked(this.foe.x, this.foe.y, me.x, me.y) ? this.hidden + dt : 0;
      if (this.hidden > HIDE_S && this.foe.hp > 0) {
        this.hidden = 0;
        const t = centerText(this, me.x, me.y - 18, 'NO HIDING!', PALETTE.gold).setDepth(60);
        this.tweens.add({ targets: t, y: t.y - 8, alpha: 0, delay: 500, duration: 500, onComplete: () => t.destroy() });
        if (def.pattern === 'teleport') this.blinkIn();
        else {
          this.bossPattern(def);
          this.hazardT = Math.max(this.hazardT, def.every * 0.6);
        }
      }
      const col = ELEMENTS[this.foe.c.element].col;
      for (const h of this.hazards) {
        h.t -= dt;
        if (h.t > 0) continue;
        if (h.kind === 'line') this.fx.push({ kind: 'beam', x: h.x, y: h.y, x2: h.x2, y2: h.y2, r: h.r, t: 0, life: 0.25, col });
        else if (h.kind === 'ring') this.fx.push({ kind: 'ring', x: h.x, y: h.y, r: h.r, t: 0, life: 0.3, col });
        else this.fx.push({ kind: 'boom', x: h.x, y: h.y, r: h.r, t: 0, life: h.kind === 'meteor' ? 0.5 : 0.3, col: h.kind === 'meteor' ? 0xffb040 : col });
        if (h.kind === 'meteor') audio.sfx('arcane_blast', 0.55);
        h.go?.();
        if (h.dmg > 0 && this.caught(h, me.x, me.y)) {
          this.hit(this.foe, me, h.dmg, this.foe.c.attacks[0]);
          if (h.holds && me.hp > 0) me.root = Math.max(me.root, ROOT_S);
        }
      }
      this.hazards = this.hazards.filter((h) => h.t > 0);
    }

    // ---- cover somebody dropped: it stands its few seconds and goes
    let wentDown = false;
    for (const bar of this.barriers) {
      if (bar.life < 0) continue;
      bar.life -= dt;
      if (bar.life <= 0) wentDown = true;
    }
    if (wentDown || this.barriers.some((b) => b.life >= 0 && b.life < 1.2)) {
      const gone = this.barriers.filter((b) => b.life >= 0 && b.life <= 0);
      if (gone.length) {
        const dead = new Set(gone.flatMap((b) => b.parts));
        this.props = this.props.filter((p) => !dead.has(p));
        this.barriers = this.barriers.filter((b) => !gone.includes(b));
      }
      this.repaintCover();
    }

    for (const e of this.fx) e.t += dt;
    this.fx = this.fx.filter((e) => e.t < e.life);

    // ---- the end (training has none: nothing is at stake and nothing faints)
    if (this.training) return;
    if (this.me.hp <= 0 || this.foe.hp <= 0) this.end(this.foe.hp <= 0 && this.me.hp > 0);
    else if (this.elapsed >= TIME_LIMIT) this.end(this.me.hp / this.me.max > this.foe.hp / this.foe.max);
  }

  /**
   * One round of what this boss does to the floor (see the table at the
   * top).  `at` is where it is aimed: you, normally.
   */
  private bossPattern(def: BossDef, at = { x: this.me.x, y: this.me.y }): void {
    const foe = this.foe;
    const col = ELEMENTS[foe.c.element];
    const cx = (x: number) => Phaser.Math.Clamp(x, ARENA.x + 10, ARENA.x + ARENA.w - 10);
    const cy = (y: number) => Phaser.Math.Clamp(y, ARENA.y + 10, ARENA.y + ARENA.h - 10);
    const put = (h: Omit<Hazard, 't0' | 'dmg' | 'r' | 'kind'> & Partial<Pick<Hazard, 'dmg' | 'r' | 'kind'>>): void => {
      this.hazards.push({ kind: 'mark', r: def.r, dmg: def.dmg, ...h, x: cx(h.x), y: cy(h.y), t0: h.t });
    };
    switch (def.pattern) {
      case 'teleport': {
        // marks of grave-light round you, and it blinks to wherever it can see you
        for (let i = 0; i < def.n; i++) {
          const a = (i / def.n) * Math.PI * 2 + Math.random();
          put({ x: at.x + Math.cos(a) * (i === 0 ? 0 : 26), y: at.y + Math.sin(a) * (i === 0 ? 0 : 20), t: 1.2 + i * 0.15 });
        }
        this.blinkIn();
        break;
      }
      case 'meteor': {
        // one on you, one where you are running to, the rest round about:
        // the shadow grows for a second and a half, then it lands -- hard
        const lead = { x: at.x + this.meV.x * 1.2, y: at.y + this.meV.y * 1.2 };
        for (let i = 0; i < def.n; i++) {
          const base = i === 0 ? at : i === 1 ? lead : { x: at.x + (Math.random() - 0.5) * 120, y: at.y + (Math.random() - 0.5) * 80 };
          put({ kind: 'meteor', x: base.x, y: base.y, t: 1.6 + i * 0.25 });
        }
        audio.sfx('arcane_cast', 0.5);
        break;
      }
      case 'tribeam': {
        // three breaths from its three heads: at you, and either side
        const a0 = Math.atan2(at.y - foe.y, at.x - foe.x);
        for (const k of [-0.42, 0, 0.42]) {
          const a = a0 + k;
          put({ kind: 'line', x: foe.x, y: foe.y, x2: foe.x + Math.cos(a) * 300, y2: foe.y + Math.sin(a) * 300, t: 1.1 });
        }
        break;
      }
      case 'webs':
        // thrown round your feet: where you stand and the ways out of it
        put({ x: at.x, y: at.y, t: 1.0, holds: true });
        for (let i = 1; i < def.n; i++) {
          const a = (i / (def.n - 1)) * Math.PI * 2 + Math.random() * 0.5;
          put({ x: at.x + Math.cos(a) * 30, y: at.y + Math.sin(a) * 24, t: 1.2 + i * 0.1, holds: true });
        }
        break;
      case 'roots': {
        // under you, and where you are going
        put({ x: at.x, y: at.y, t: 1.0, holds: true });
        for (let i = 1; i < def.n; i++) put({ x: at.x + this.meV.x * 0.5 * i + (Math.random() - 0.5) * 24, y: at.y + this.meV.y * 0.5 * i + (Math.random() - 0.5) * 20, t: 1.1 + i * 0.3, holds: true });
        break;
      }
      case 'lightning': {
        // the bolts walk from the cloud straight at you, and past
        const a = Math.atan2(at.y - foe.y, at.x - foe.x);
        const d0 = Math.hypot(at.x - foe.x, at.y - foe.y);
        for (let i = 0; i < def.n; i++) {
          const d = 20 + (i / (def.n - 1)) * (d0 + 40);
          put({ x: foe.x + Math.cos(a) * d, y: foe.y + Math.sin(a) * d, t: 0.8 + i * 0.16 });
        }
        break;
      }
      case 'burrow': {
        // it goes under, and comes up beside you
        const a = Math.random() * Math.PI * 2;
        const nx = cx(at.x + Math.cos(a) * 30);
        const ny = cy(at.y + Math.sin(a) * 26);
        put({ x: nx, y: ny, t: 1.1 });
        this.fx.push({ kind: 'spark', x: foe.x, y: foe.y, r: 14, t: 0, life: 0.4, col: col.light });
        foe.invuln = 1.1;
        this.time.delayedCall(900, () => {
          if (this.over || foe.hp <= 0) return;
          foe.x = nx;
          foe.y = ny;
          this.fx.push({ kind: 'ring', x: nx, y: ny, r: 18, t: 0, life: 0.4, col: col.col });
          audio.sfx('item_thud', 0.4);
        });
        break;
      }
      case 'charge': {
        // a line drawn straight at you -- then the pounce, all the way down it
        const a = Math.atan2(at.y - foe.y, at.x - foe.x);
        const len = 230;
        put({
          kind: 'line', x: foe.x, y: foe.y, x2: foe.x + Math.cos(a) * len, y2: foe.y + Math.sin(a) * len, t: 1.0, dmg: 0,
          go: () => {
            if (this.over || foe.hp <= 0) return;
            foe.dash = { vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, t: len / 330, dmg: def.dmg, hit: false, a: foe.c.attacks[0] };
            audio.sfx('throw_whoosh', 0.6);
          },
        });
        foe.root = 1.0;
        break;
      }
      case 'tentacles': {
        // arms roll across the floor from one side, column after column
        const fromLeft = Math.random() < 0.5;
        for (let c = 0; c < 5; c++) {
          const x = fromLeft ? ARENA.x + 16 + c * 30 : ARENA.x + ARENA.w - 16 - c * 30;
          // (a gap in each wave, somewhere different each time: get to it)
          const gap = Math.floor(Math.random() * def.n);
          for (let i = 0; i < def.n; i++) if (i !== gap) put({ x, y: ARENA.y + 14 + (i / (def.n - 1)) * (ARENA.h - 28), t: 1.0 + c * 0.45 });
        }
        break;
      }
      case 'quake':
        // it stamps: rings run out from it, one after another -- be between them
        for (let i = 0; i < 3; i++) put({ kind: 'ring', x: foe.x, y: foe.y, r: 30 + i * 32, t: 1.0 + i * 0.45 });
        audio.sfx('item_thud', 0.6);
        break;
    }
  }

  /** The lich's trick: gone in a puff, and back somewhere that can see you. */
  private blinkIn(): void {
    const foe = this.foe;
    const spot = this.sightSpot(foe, true);
    if (!spot) return;
    const col = ELEMENTS[foe.c.element];
    this.fx.push({ kind: 'ring', x: spot.x, y: spot.y, r: 14, t: 0, life: 0.6, col: col.light });
    this.fx.push({ kind: 'spark', x: foe.x, y: foe.y, r: 14, t: 0, life: 0.5, col: col.col });
    foe.invuln = 0.6;
    this.time.delayedCall(550, () => {
      if (this.over || foe.hp <= 0) return;
      foe.x = spot.x;
      foe.y = spot.y;
      this.fx.push({ kind: 'spark', x: foe.x, y: foe.y, r: 14, t: 0, life: 0.5, col: col.col });
      audio.sfx('arcane_cast', 0.5);
    });
  }

  /** A hazard that is going off now: does it catch you? */
  private caught(h: Hazard, x: number, y: number): boolean {
    if (h.kind === 'line') return this.segDist(x, y, h.x, h.y, h.x2!, h.y2!) < h.r + 4;
    const d = Math.hypot(x - h.x, y - h.y);
    if (h.kind === 'ring') return Math.abs(d - h.r) < 7;
    return d < h.r + 5;
  }

  private end(won: boolean): void {
    if (this.over) return;
    this.over = true;
    if (this.settled) return;
    this.settled = true;
    // (what the run had paid before this one, for the run's total)
    const before = store.get().creatures.ladder?.earned ?? 0;
    const r = finishBattle(won);
    audio.sfx(won ? 'cha_ching' : 'death_stinger', 0.6);
    const timeUp = this.me.hp > 0 && this.foe.hp > 0;
    const ladder = this.mode === 'ladder';
    this.time.delayedCall(700, () => {
      const box = this.add.container(0, 0).setDepth(2000);
      const X = GAME_W / 2;
      const Y = GAME_H / 2;
      box.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0, 0).setInteractive());
      box.add(this.add.rectangle(X, Y, 244, 96, PALETTE.ink).setStrokeStyle(1, won ? PALETTE.gold : 0xc31f2e));
      const head = won ? (ladder ? (this.boss ? 'LADDER CLEARED!' : `LEVEL ${this.level} OF ${LADDER_LEVELS} CLEARED`) : 'VICTORY!') : 'DEFEATED';
      box.add(centerText(this, X, Y - 38, head, won ? PALETTE.gold : 0xff6a6a));
      if (timeUp) box.add(centerText(this, X, Y - 28, 'TIME: MORE HEALTH LEFT WINS', PALETTE.ash));
      const lines: Array<[string, number]> = [];
      if (won) {
        lines.push([`+${r.paid} TOKENS`, PALETTE.gold]);
        if (ladder) lines.push([this.boss ? `THE RUN PAID ${before + r.paid} TOKENS IN ALL.` : this.level >= LADDER_LEVELS ? 'NEXT: THE FINAL BOSS' : `NEXT: LEVEL ${this.level + 1} OF ${LADDER_LEVELS}`, PALETTE.cream]);
        const xpLine = r.xp ? `+${r.xp} XP` : this.myLevel >= MAX_LEVEL ? 'MAX LEVEL - NO MORE XP' : '';
        if (xpLine) lines.push([xpLine, 0x8ae88a]);
      } else {
        lines.push([r.msg, PALETTE.cream]);
        if (ladder) lines.push([`THE RUN PAID ${before} TOKENS. THEY ARE YOURS TO KEEP.`, PALETTE.ash]);
      }
      lines.forEach(([t, c], i) => box.add(centerText(this, X, Y - 16 + i * 10, t, c).setMaxWidth(232)));
      if (won && r.levelUp) {
        const up = centerText(this, X, Y - 16 + lines.length * 10, `LEVEL UP!  LV ${r.levelUp}`, PALETTE.gold);
        box.add(up);
        up.setScale(0.6);
        this.tweens.add({ targets: up, scale: 1, duration: 260, ease: 'Back.Out' });
        this.tweens.add({ targets: up, alpha: 0.55, duration: 380, yoyo: true, repeat: -1, delay: 300 });
        audio.sfx('chime', 0.7);
      }
      // back to where the fight came from: the run's ladder, or the map
      const screen = ladder ? 'ladder' : 'map';
      box.add(button(this, X, Y + 36, 'CONTINUE', () => this.scene.start('CreatureHub', { from: this.from, screen }), { width: 80, height: 13 }));
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
    } else if (a.kind === 'shield' || a.kind === 'aura' || a.kind === 'mend') {
      g.strokeCircle(me.x, me.y, 11);
      if (a.kind !== 'shield') g.strokeCircle(me.x, me.y, 14);
    } else if (a.kind === 'arc') {
      // where it would land, and the burst it would make there
      const d = Math.min(r, m);
      g.strokeCircle(me.x + ux * d, me.y + uy * d, 16);
      for (let k = 0.15; k < 1; k += 0.15) g.fillStyle(col, 0.3).fillRect(me.x + ux * d * k, me.y + uy * d * k - Math.sin(k * Math.PI) * 10, 1, 1);
    } else if (a.kind === 'snare') {
      for (let d = 6; d < r; d += 7) g.fillStyle(col, 0.3).fillRect(me.x + ux * d, me.y + uy * d, 1, 1);
      g.strokeCircle(me.x + ux * r, me.y + uy * r, 4);
    } else if (a.kind === 'wall') {
      // the three pieces, across the way you are pointing
      const d = Math.max(16, Math.min(a.reach, m));
      for (const k of [-1, 0, 1]) g.strokeCircle(me.x + ux * d + -uy * k * 9, me.y + uy * d + ux * k * 9, 6);
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
    // every one telegraphed: an outline the moment it is down, filling as it comes
    for (const h of this.hazards) {
      const k = Phaser.Math.Clamp(1 - h.t / h.t0, 0, 1);
      if (h.kind === 'line') {
        g.lineStyle(1, 0xff3a3a, 0.5 + k * 0.4).lineBetween(h.x, h.y, h.x2!, h.y2!);
        g.lineStyle(h.r * 2 * k, 0xff3a3a, 0.22).lineBetween(h.x, h.y, h.x2!, h.y2!);
      } else if (h.kind === 'ring') {
        g.lineStyle(1, 0xff3a3a, 0.4 + k * 0.5).strokeCircle(h.x, h.y, h.r);
        g.lineStyle(1, 0xff3a3a, 0.25).strokeCircle(h.x, h.y, h.r - 7).strokeCircle(h.x, h.y, h.r + 7);
      } else if (h.kind === 'meteor') {
        // the shadow grows; the star comes down out of the corner of the sky onto it
        g.fillStyle(0x000000, 0.2 + k * 0.35).fillEllipse(h.x, h.y, h.r * 2 * (0.4 + k * 0.6), h.r * 1.2 * (0.4 + k * 0.6));
        g.lineStyle(1, 0xff6a2a, 0.9).strokeCircle(h.x, h.y, h.r);
        const fall = Math.max(0, 1 - k);
        const sx = h.x + fall * 70;
        const sy = h.y - fall * 120;
        g.lineStyle(3, 0xffb040, 0.5).lineBetween(sx + 10, sy - 18, sx, sy);
        g.fillStyle(0xfff0a0, 1).fillCircle(sx, sy, 3 + k * 2);
      } else {
        g.lineStyle(1, h.holds ? 0x8ae86a : 0xff3a3a, 0.9).strokeCircle(h.x, h.y, h.r);
        g.fillStyle(h.holds ? 0x8ae86a : 0xff3a3a, 0.15 + k * 0.3).fillCircle(h.x, h.y, h.r * k);
      }
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
    // (in training the clock's slot holds the LEAVE button instead)
    this.timerText.setText(this.training ? '' : `${Math.max(0, Math.ceil(TIME_LIMIT - this.elapsed))}`);
    const ic = ELEMENTS[this.me.c.element].light;
    this.me.c.attacks.forEach((a, i) => {
      const b = this.atkBtns[i];
      if (!b) return;
      const ready = 1 - this.me.cds[i] / a.cd;
      if (this.touch) {
        u.fillStyle(i === this.sel ? 0x6a3aa8 : 0x2a2a48, 0.85).fillCircle(b.x, b.y, 12);
        u.lineStyle(1, i === this.sel ? 0xffe060 : 0x8a8ab0, 1).strokeCircle(b.x, b.y, 12);
        drawAttackIcon(u, a.kind, b.x, b.y, ic);
        if (ready < 1) u.fillStyle(0x000000, 0.55).slice(b.x, b.y, 12, -Math.PI / 2, -Math.PI / 2 + (1 - ready) * Math.PI * 2, false).fillPath();
      } else {
        u.fillStyle(i === this.sel ? 0x4a2a78 : 0x1a1a30, 0.9).fillRect(b.x - 49, b.y - 7, 98, 13);
        u.fillStyle(0xffffff, 0.15).fillRect(b.x - 49, b.y + 4, 98 * Math.min(1, ready), 2);
        u.lineStyle(1, i === this.sel ? 0xffe060 : 0x4a4a68, 1).strokeRect(b.x - 49, b.y - 7, 98, 13);
        // the keycap, then the ability's icon beside it
        u.fillStyle(0x0c0c18, 1).fillRect(b.x - 47, b.y - 5, 9, 9);
        u.lineStyle(1, i === this.sel ? 0xffe060 : 0x8a8ab0, 1).strokeRect(b.x - 47, b.y - 5, 9, 9);
        u.fillStyle(0xffffff, 0.12).fillRect(b.x - 46, b.y - 4, 7, 1);
        drawAttackIcon(u, a.kind, b.x - 30, b.y - 1, ic);
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
