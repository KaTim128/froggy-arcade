/**
 * ---- THE POLICE ON THE STREETS.  Two weeks on, your face is on the wall,
 * and now and then an officer walks the pavement.  Only now and then: a
 * patrol turns up on a street at most every minute and a half or so, and
 * often not even then -- tension, not a wall of uniforms.
 *
 * HOW ONE SEES YOU.  Not by bumping into you.  An officer sees what is in
 * front of them: the way they are facing, out to a range -- shorter in the
 * dark, and shorter again if you are sat down on the pavement with your head
 * down.  Behind them you can walk right past.  While you are in sight they
 * get surer (a "?" over the cap); sure, and they stop you ("!").
 *
 * STOPPED.  A question, and a moment to answer it: talk your way out (it
 * works sometimes, more often in the dark) or RUN.  Say nothing and they
 * take you.  Running, they come after you -- a shade slower than you --
 * and only an officer who actually lays a hand on you makes an arrest.
 * Into the arcade, down the alley, or home through Lily's doors, and they
 * have lost you.  Off the end of the street and they follow you on to the
 * next one.  Caught: arrested, and the run ends in a cell (JailEnding).
 */

import Phaser from 'phaser';
import { store } from '../core/state';
import { audio } from '../core/audio';
import { centerText, fadeToScene, pinToScreen } from '../core/ui';
import { LOOKS, Player } from '../art/player';
import { PALETTE } from '../render/palette';
import { openTalkPanel } from '../ui/talkPanel';
import { earnBadge } from './badges';

export interface PatrolHost {
  scene: Phaser.Scene;
  worldW: number;
  /** The pavement's walk line. */
  y: number;
  player: () => Player;
  /** It is dark out: they see less far. */
  dark: () => boolean;
  /** Sat down on the pavement (begging): harder to make out. */
  lowProfile?: () => boolean;
  /** Freeze (or free) the scene's own controls while you are being questioned or taken. */
  lock: (on: boolean) => void;
}

/** How far an officer sees in front of them, by day and in the dark. */
export const SIGHT = { day: 96, dark: 56 };
/** Patrol pace and chase pace, as fractions of the player's walk. */
const PACE = { walk: 0.45, chase: 0.93 };
/** Close enough to take hold of you. */
const REACH = 7;
/** Seconds to answer before they simply take you. */
const ANSWER_S = 5;

// ---- between streets (not saved: a reload is a fresh street)
let nextPatrolAt = 0;
let pursuit: { until: number; edge: 'left' | 'right' } | null = null;
/** Talked your way out: that officer leaves you be for a while. */
let clearedUntil = 0;

/** Patrols are only out after the two weeks, and never on a run already over. */
export const patrolsOut = (): boolean => store.get().arc === 'live' && !store.get().jailed && store.get().route === 'normal';

/** Dev deep link ?police=1: an officer on every street, at once. */
const forced = (): boolean => {
  try {
    return new URLSearchParams(location.search).get('police') === '1';
  } catch {
    return false;
  }
};

type State = 'waiting' | 'walk' | 'pause' | 'question' | 'chase' | 'leave' | 'arrest' | 'gone';

export class Patrol {
  private cop: Player | null = null;
  private mark: Phaser.GameObjects.BitmapText | null = null;
  private state: State = 'gone';
  private dir = 1;
  private wait = 0;
  private pauseT = 0;
  private nextPause = 0;
  private aware = 0;
  private lostT = 0;
  private panel: Phaser.GameObjects.Container | null = null;
  private answerT = 0;
  private startT = 0;

  constructor(private host: PatrolHost) {
    if (!patrolsOut()) return;
    const now = performance.now();
    if (pursuit && now < pursuit.until) {
      // still after you: in off the end you came in by, a few steps behind
      const edge = pursuit.edge;
      pursuit = null;
      // (far enough back, and a beat late, that coming in off the fade is fair)
      this.spawn(edge === 'left' ? -70 : host.worldW + 70, edge === 'left' ? 1 : -1);
      this.state = 'chase';
      this.startT = 1.4;
      return;
    }
    pursuit = null;
    if (!forced() && (now < nextPatrolAt || Math.random() > 0.45)) return;
    nextPatrolAt = now + (75 + Math.random() * 65) * 1000;
    this.state = 'waiting';
    this.wait = forced() ? 0.3 : 2 + Math.random() * 6;
    this.dir = Math.random() < 0.5 ? 1 : -1;
  }

  /** On this street now (for the harness, and for the scenes' own checks). */
  get present(): boolean {
    return !!this.cop && this.state !== 'gone';
  }

  /** Questioning or taking you: the scene's own controls are off. */
  get holding(): boolean {
    return this.state === 'question' || this.state === 'arrest';
  }

  get chasing(): boolean {
    return this.state === 'chase';
  }

  private spawn(x: number, dir: number): void {
    const s = this.host.scene;
    const p = new Player(s, x, this.host.y, this.host.dark(), LOOKS.officer);
    // the kit: a radio on the shoulder, the cuffs and the baton on the belt
    p.sprite.add(s.add.rectangle(2, -16, 2, 3, 0x14141a));
    p.sprite.add(s.add.rectangle(3, -18, 1, 2, 0x14141a));
    p.sprite.add(s.add.rectangle(-3, -9, 2, 6, 0x0e0e12));
    p.sprite.add(s.add.rectangle(1, -9, 2, 1, 0xb8bcc4));
    this.cop = p;
    this.dir = dir;
    p.face(dir);
    this.nextPause = 3 + Math.random() * 5;
    this.mark = centerText(s, x, this.host.y - 34, '', PALETTE.gold).setDepth(820).setVisible(false);
    this.state = 'walk';
  }

  /** Can this officer see you, right now?  0 if not; otherwise how clearly (0..1). */
  sees(): number {
    const c = this.cop;
    if (!c) return 0;
    const p = this.host.player();
    if (!p.sprite.visible) return 0;
    const dx = p.x - c.x;
    // only what is in front of them
    if (dx * c.facing <= 0) return 0;
    let range = this.host.dark() ? SIGHT.dark : SIGHT.day;
    if (this.host.lowProfile?.()) range *= 0.5;
    const d = Math.abs(dx);
    if (d > range) return 0;
    return 1 - d / range;
  }

  update(delta: number): void {
    const dt = delta / 1000;
    if (this.state === 'gone') return;
    if (this.state === 'waiting') {
      this.wait -= dt;
      if (this.wait <= 0) this.spawn(this.dir > 0 ? -20 : this.host.worldW + 20, this.dir);
      return;
    }
    const c = this.cop;
    if (!c) return;
    const p = this.host.player();
    const bounds = new Phaser.Geom.Rectangle(-80, this.host.y, this.host.worldW + 160, 0);
    this.mark?.setPosition(c.x, c.y - 33);

    if (this.state === 'walk' || this.state === 'pause') {
      if (this.state === 'walk') {
        c.move(this.dir, 0, delta * PACE.walk, bounds);
        this.nextPause -= dt;
        // a stop now and then to look back the way they came
        if (this.nextPause <= 0) {
          this.state = 'pause';
          this.pauseT = 1.6 + Math.random() * 1.6;
          c.stand();
          this.host.scene.time.delayedCall(400, () => this.state === 'pause' && c.face(-this.dir));
        }
      } else {
        this.pauseT -= dt;
        if (this.pauseT <= 0) {
          c.face(this.dir);
          this.state = 'walk';
          this.nextPause = 4 + Math.random() * 6;
        }
      }
      // what they can see of you
      const v = performance.now() < clearedUntil ? 0 : this.sees();
      if (v > 0) this.aware = Math.min(1, this.aware + dt * (0.45 + 1.5 * v));
      else this.aware = Math.max(0, this.aware - dt * 0.4);
      this.mark?.setText(this.aware > 0.15 ? '?' : '').setVisible(this.aware > 0.15).setTint(PALETTE.gold);
      if (this.aware >= 1) return this.stopYou();
      // walked off the end
      if ((this.dir > 0 && c.x > this.host.worldW + 24) || (this.dir < 0 && c.x < -24)) this.remove();
      return;
    }

    if (this.state === 'question') {
      this.answerT -= dt;
      c.face(Math.sign(p.x - c.x) || 1);
      // said nothing, stood there: they take you
      if (this.answerT <= 0) {
        this.closePanel();
        this.state = 'chase';
        this.startT = 0;
      }
      return;
    }

    if (this.state === 'chase') {
      this.mark?.setText('!').setVisible(true).setTint(0xff5050);
      if (this.startT > 0) {
        this.startT -= dt;
        c.face(Math.sign(p.x - c.x) || 1);
        c.stand();
        return;
      }
      const dx = p.x - c.x;
      c.move(Math.sign(dx), 0, delta * PACE.chase, bounds);
      if (Math.abs(dx) <= REACH && p.sprite.visible) return this.arrest();
      // a long way ahead of them and out of sight: they give it up
      this.lostT = Math.abs(dx) > 150 ? this.lostT + dt : 0;
      if (this.lostT > 3) this.giveUp();
      return;
    }

    if (this.state === 'leave') {
      c.move(this.dir, 0, delta * PACE.walk, bounds);
      if ((this.dir > 0 && c.x > this.host.worldW + 24) || (this.dir < 0 && c.x < -24)) this.remove();
    }
  }

  /** "!": stopped, and asked. */
  private stopYou(): void {
    const c = this.cop!;
    const s = this.host.scene;
    this.state = 'question';
    this.answerT = ANSWER_S;
    c.stand();
    c.face(Math.sign(this.host.player().x - c.x) || 1);
    this.mark?.setText('!').setVisible(true).setTint(0xff5050);
    audio.sfx('ui_blip', 0.7);
    this.host.lock(true);
    const dark = this.host.dark();
    this.panel = openTalkPanel(s, {
      speaker: 'officer',
      line: '"Hold it right there. You look a lot like the face on that poster."',
      depth: 950,
      options: [
        {
          label: "THAT'S NOT ME",
          fn: () => {
            this.panel = null;
            // a bluff: better odds in poor light
            if (Math.random() < (dark ? 0.7 : 0.45)) {
              this.say('"...Hm. Must be the light. Move along."');
              clearedUntil = performance.now() + 25000;
              this.aware = 0;
              this.mark?.setVisible(false);
              this.state = 'leave';
              c.face(this.dir);
              this.host.lock(false);
            } else {
              this.say('"Nice try."');
              this.state = 'chase';
              this.startT = 0.9;
              this.host.lock(false);
            }
          },
        },
        {
          label: 'RUN',
          fn: () => {
            this.panel = null;
            this.say('"HEY! STOP!"');
            audio.sfx('ui_blip', 0.6);
            this.state = 'chase';
            this.startT = 0.7;
            this.host.lock(false);
          },
        },
      ],
    });
    pinToScreen(this.panel);
  }

  private say(line: string): void {
    const s = this.host.scene;
    const t = centerText(s, 0, 0, line, PALETTE.cream).setDepth(830);
    const c = this.cop!;
    t.setPosition(Phaser.Math.Clamp(c.x, s.cameras.main.scrollX + 80, s.cameras.main.scrollX + 240), c.y - 44);
    s.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 500, onComplete: () => t.destroy() });
  }

  private closePanel(): void {
    if (this.panel?.active) this.panel.destroy();
    this.panel = null;
  }

  /** A hand on your shoulder.  That is the run. */
  private arrest(): void {
    this.state = 'arrest';
    this.host.lock(true);
    const s = this.host.scene;
    const p = this.host.player();
    this.cop?.stand();
    p.stand();
    audio.sfx('door_smash', 0.4);
    s.cameras.main.shake(160, 0.006);
    this.say('"YOU\'RE UNDER ARREST."');
    store.patch({ jailed: true, route: 'ended' });
    store.flush();
    s.time.delayedCall(1900, () => fadeToScene(s, 'JailEnding', {}, { ms: 900 }));
  }

  private giveUp(): void {
    this.state = 'leave';
    this.aware = 0;
    this.mark?.setVisible(false);
    earnBadge('low_profile', this.host.scene);
  }

  private remove(): void {
    this.cop?.sprite.destroy();
    this.mark?.destroy();
    this.cop = null;
    this.mark = null;
    this.state = 'gone';
  }

  /**
   * You went in somewhere they cannot follow: the arcade, the alley, Lily's.
   * Lost them.
   */
  safe(): void {
    if (this.state === 'chase') earnBadge('low_profile');
    pursuit = null;
  }

  /** Off the end of the street with them after you: they follow you on, in at `edge` of the next. */
  leaveBy(edge: 'left' | 'right'): void {
    if (this.state === 'chase') pursuit = { until: performance.now() + 8000, edge };
  }
}
