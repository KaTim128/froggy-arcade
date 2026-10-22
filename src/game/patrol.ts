/**
 * ---- THE POLICE ON THE STREETS.  The following day, your face is on the wall,
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
 *
 * THE STEALTH PHASE.  Until your whole look is changed -- every stitch the
 * poster shows, and the hair (game/life `attireProgress`) -- it is
 * different: the patrols never stop -- two or three walking every street, up
 * and down, stopping to look both ways, past the mouths of the alleys -- an
 * officer who gets you in sight knows you at once, no questions, and a catch is not
 * the end of the run but of the attempt: CAUGHT, and you are back on the
 * forecourt to try again (`caughtByPolice`).  So is lying down anywhere to
 * sleep before the look is changed.  Down an alley you are out of sight
 * altogether; a patrol going by out on the street shows as its lights
 * sweeping the alley's mouth (`alleyWatch`).  They do not go down alleys --
 * unless one was after you and SAW you duck in, and then they follow you in.
 *
 * THEY LOOK AT THE OLD MAN.  Anyone sleeping rough is the first thing an
 * officer looks at: one who gets him in sight stops, has a long look and a
 * word, and only then walks on.  And now and then one turns off the
 * pavement into a shop, the arcade or Lily's (game/policeVisits; inside,
 * game/indoorPatrol).  What each can see is drawn: a pale cone out in front.
 *
 * Every officer carries the lights with them: a red and blue glow pulsing
 * round them, so one reads as a threat from the far end of a street.
 */

import Phaser from 'phaser';
import { store } from '../core/state';
import { audio } from '../core/audio';
import { centerText, fadeToScene, pinToScreen } from '../core/ui';
import { LOOKS, Player } from '../art/player';
import { PALETTE } from '../render/palette';
import { openTalkPanel } from '../ui/talkPanel';
import { earnBadge } from './badges';
import { copWentIn, type Place } from './policeVisits';

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
  /** Out of sight altogether (in an alley's mouth). */
  concealed?: () => boolean;
  /** Seconds before the first officer can turn up (a moment to get your bearings). */
  grace?: number;
  /** Freeze (or free) the scene's own controls while you are being questioned or taken. */
  lock: (on: boolean) => void;
  /** Where the old man sleeping rough is on this street, if he is (they watch him). */
  watch?: () => number | null;
  /** The doors along this pavement an officer may turn in at. */
  doors?: Array<{ x: number; place: Place }>;
  /** This is an alley: nobody comes down it unless they saw you go in. */
  alley?: boolean;
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
let pursuit: { until: number; edge: 'left' | 'right'; alley: boolean; from?: Place } | null = null;
/** Talked your way out: that officer leaves you be for a while. */
let clearedUntil = 0;

/** Patrols are only out after the night, and never on a run already over. */
export const patrolsOut = (): boolean => store.get().arc === 'live' && !store.get().jailed && store.get().route === 'normal';

/** The face on the poster is still yours: the hunt is on (see the header). */
export const stealthPhase = (): boolean => patrolsOut() && !store.get().disguised;

/**
 * Out of a door with one of them after you, from inside (game/indoorPatrol):
 * they come out of it after you -- onto the street, or into the next room.
 */
export function chaseOutOf(place: Place): void {
  pursuit = { until: performance.now() + 8000, edge: 'left', alley: false, from: place };
}

/** Coming into `place`: was one of them on your heels from the last room of it? */
export function takeIndoorChase(place: Place): boolean {
  if (!pursuit || pursuit.from !== place || performance.now() > pursuit.until) return false;
  pursuit = null;
  return true;
}

/** The lines officers have up, per scene: a second one goes above the first, not over it. */
const saying = new WeakMap<Phaser.Scene, Phaser.GameObjects.BitmapText[]>();

/** An officer at (x, feet y) says `line`, over their head. */
export function copSay(scene: Phaser.Scene, x: number, y: number, line: string): void {
  const up = (saying.get(scene) ?? []).filter((t) => t.active);
  const cam = scene.cameras.main;
  const t = centerText(scene, Phaser.Math.Clamp(x, cam.scrollX + 80, cam.scrollX + 240), Math.max(30, y - 44 - up.length * 10), line, PALETTE.cream).setDepth(830);
  up.push(t);
  saying.set(scene, up);
  scene.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 500, onComplete: () => t.destroy() });
}

/** A whole new look: whatever they were sure of, they are not any more. */
export function resetSuspicion(): void {
  pursuit = null;
  clearedUntil = 0;
}

/**
 * Taken: in the hunt, CAUGHT and back to the start; with a new look, the
 * cell (JailEnding).  `say` is the officer's line over their head.
 */
export function takeIn(scene: Phaser.Scene, say: (line: string) => void): void {
  if (!store.get().disguised) {
    caughtByPolice(scene, 'seen');
    return;
  }
  audio.sfx('door_smash', 0.4);
  scene.cameras.main.shake(160, 0.006);
  say('"YOU\'RE UNDER ARREST."');
  store.patch({ jailed: true, route: 'ended' });
  store.flush();
  scene.time.delayedCall(1900, () => fadeToScene(scene, 'JailEnding', {}, { ms: 900 }));
}

/**
 * CAUGHT, in the stealth phase: a red card, and back on the forecourt by
 * the arcade to try again -- not the cell, not the paper.  `why` says what
 * gave you away.
 */
export function caughtByPolice(scene: Phaser.Scene, why: 'seen' | 'sleep'): void {
  pursuit = null;
  audio.sfx('door_smash', 0.4);
  scene.cameras.main.shake(160, 0.006);
  const k = scene.add.container(0, 0).setDepth(4000).setScrollFactor(0);
  k.add(scene.add.rectangle(0, 0, 320, 180, 0x000000, 0.55).setOrigin(0, 0));
  k.add(scene.add.rectangle(160, 80, 236, 40, 0x1a0a0e, 0.96).setStrokeStyle(1, 0xd04040));
  k.add(centerText(scene, 160, 72, 'CAUGHT BY THE POLICE', 0xff5050));
  k.add(
    centerText(scene, 160, 86, why === 'sleep' ? 'YOU LAY DOWN WITH THE POSTER FACE.' : 'THEY KNEW YOUR FACE.', PALETTE.cream),
  );
  for (const o of k.list) (o as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor?.(0);
  k.setAlpha(0);
  scene.tweens.add({ targets: k, alpha: 1, duration: 200 });
  scene.time.delayedCall(1500, () => fadeToScene(scene, 'ExteriorDay', { respawn: why }, { ms: 400 }));
}

/**
 * IN AN ALLEY, a patrol going past outside: its lights swept along the
 * far left of the screen (the alley's mouth), red and blue, top to bottom.
 * Every so often while the hunt is on, and soon after you duck in if one
 * was on your heels.
 */
export function alleyWatch(scene: Phaser.Scene): void {
  // (seen going in: they are not going past, they are coming down -- see Patrol)
  if (pursuit?.alley && performance.now() < pursuit.until) return;
  if (!stealthPhase() && !(pursuit && performance.now() < pursuit.until)) return;
  const chased = !!(pursuit && performance.now() < pursuit.until);
  pursuit = null;
  if (chased) earnBadge('low_profile', scene);
  const key = 'siren_band';
  if (!scene.textures.exists(key)) {
    const t = scene.textures.createCanvas(key, 32, 90);
    if (t) {
      const g = t.getContext();
      const grad = g.createRadialGradient(4, 45, 1, 4, 45, 44);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 32, 90);
      t.refresh();
    }
  }
  const pass = (): void => {
    if (!scene.sys.isActive()) return;
    const red = scene.add.image(0, -60, key).setOrigin(0, 0.5).setTint(0xff2a3a).setBlendMode(Phaser.BlendModes.ADD).setDepth(3500).setScrollFactor(0);
    const blue = scene.add.image(0, -110, key).setOrigin(0, 0.5).setTint(0x2a5aff).setBlendMode(Phaser.BlendModes.ADD).setDepth(3500).setScrollFactor(0);
    for (const [img, delay] of [[red, 0], [blue, 260]] as const) {
      scene.tweens.add({ targets: img, y: 240, duration: 3200, delay, ease: 'Sine.easeInOut', onComplete: () => img.destroy() });
      scene.tweens.add({ targets: img, alpha: { from: 1, to: 0.35 }, duration: 240, yoyo: true, repeat: 12 });
    }
    audio.sfx('footstep_concrete', 0.25);
    scene.time.delayedCall(900, () => audio.sfx('footstep_concrete', 0.2));
  };
  scene.time.delayedCall(chased ? 1800 : 4000 + Math.random() * 5000, pass);
  if (stealthPhase()) scene.time.addEvent({ delay: 14000 + Math.random() * 6000, loop: true, callback: pass });
}

/** Dev deep link ?police=1: an officer on every street, at once. */
const forced = (): boolean => {
  try {
    return new URLSearchParams(location.search).get('police') === '1';
  } catch {
    return false;
  }
};

type State = 'waiting' | 'walk' | 'pause' | 'eye' | 'enter' | 'inside' | 'question' | 'chase' | 'leave' | 'arrest' | 'gone';

/** What they say, having a look at the old man. */
const EYE_LINES = ['"You. Seen anyone come past here?"', '"Keep it moving, old timer."', '"That face on the poster. Seen him?"', '"You again. Stay out of trouble."'];
/** The cone's colours: looking, unsure, and after you. */
const CONE = { calm: 0xfff2b0, wary: 0xffb040, hot: 0xff4040 };

/**
 * ONE OFFICER on the pavement.  `Patrol` (below) is the street's lot of
 * them; this is one of them, walking, stopping to look both ways, eyeing
 * the old man, turning in at a door, and -- you in sight -- coming for you.
 */
class Unit {
  private cop: Player | null = null;
  private mark: Phaser.GameObjects.BitmapText | null = null;
  private cone: Phaser.GameObjects.Graphics | null = null;
  state: State = 'gone';
  private dir = 1;
  private wait = 0;
  private pauseT = 0;
  private pauseLen = 0;
  private nextPause = 0;
  private aware = 0;
  private lostT = 0;
  private panel: Phaser.GameObjects.Container | null = null;
  private answerT = 0;
  private startT = 0;
  private auraR: Phaser.GameObjects.Ellipse | null = null;
  private auraB: Phaser.GameObjects.Ellipse | null = null;
  private auraT = 0;
  /** When they last had you in sight (for "did they see you go in?"). */
  private lastSeen = -Infinity;
  /** The old man: how long they have been looking, and not again for a while. */
  private eyeT = 0;
  private eyeSaid = false;
  private eyeCool = 0;
  /** Turning in at a door: which one, how long inside, and not every door. */
  private door: { x: number; place: Place } | null = null;
  private insideT = 0;
  private doorCool = 0;

  constructor(
    private host: PatrolHost,
    private squad: { busy: (u: Unit) => boolean },
  ) {}

  /** A walker: on in `delay` seconds from the `dir` end. */
  static walker(host: PatrolHost, squad: { busy: (u: Unit) => boolean }, delay: number, dir: number): Unit {
    const u = new Unit(host, squad);
    u.state = 'waiting';
    u.wait = delay;
    u.dir = dir;
    u.doorCool = 4 + Math.random() * 6;
    return u;
  }

  /** After you, in at `edge`, a beat behind. */
  static chaser(host: PatrolHost, squad: { busy: (u: Unit) => boolean }, edge: 'left' | 'right'): Unit {
    const u = new Unit(host, squad);
    // (far enough back, and a beat late, that coming in off the fade is fair)
    u.spawn(edge === 'left' ? -70 : host.worldW + 70, edge === 'left' ? 1 : -1);
    u.state = 'chase';
    u.startT = 1.4;
    return u;
  }

  /** Out of the door at `x` after you, a beat behind. */
  static fromDoor(host: PatrolHost, squad: { busy: (u: Unit) => boolean }, x: number): Unit {
    const u = new Unit(host, squad);
    u.spawn(x, 1);
    u.state = 'chase';
    u.startT = 1.1;
    return u;
  }

  get present(): boolean {
    return !!this.cop && this.state !== 'gone' && this.state !== 'inside';
  }

  get holding(): boolean {
    return this.state === 'question' || this.state === 'arrest';
  }

  get chasing(): boolean {
    return this.state === 'chase';
  }

  get x(): number | null {
    return this.cop ? this.cop.x : null;
  }

  /** Had you in sight a moment ago (you going in somewhere, say). */
  witnessed(): boolean {
    return this.sees() > 0 || performance.now() - this.lastSeen < 1500;
  }

  private spawn(x: number, dir: number): void {
    const s = this.host.scene;
    const p = new Player(s, x, this.host.y, this.host.dark(), LOOKS.officer).noSprint();
    // the kit: a radio on the shoulder, the cuffs and the baton on the belt
    p.sprite.add(s.add.rectangle(2, -16, 2, 3, 0x14141a));
    p.sprite.add(s.add.rectangle(3, -18, 1, 2, 0x14141a));
    p.sprite.add(s.add.rectangle(-3, -9, 2, 6, 0x0e0e12));
    p.sprite.add(s.add.rectangle(1, -9, 2, 1, 0xb8bcc4));
    this.cop = p;
    this.dir = dir;
    p.face(dir);
    this.nextPause = 2 + Math.random() * 3;
    this.mark = centerText(s, x, this.host.y - 34, '', PALETTE.gold).setDepth(820).setVisible(false);
    // WHAT THEY CAN SEE: a pale cone out in front, under them
    this.cone = s.add.graphics().setDepth(p.sprite.depth - 0.002);
    // THE LIGHTS: a red and blue glow round them, swapping, pulsing
    this.auraR = s.add.ellipse(x, this.host.y - 12, 34, 40, 0xff2a3a, 0.28).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.sprite.depth - 0.001);
    this.auraB = s.add.ellipse(x, this.host.y - 12, 34, 40, 0x2a5aff, 0.0).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.sprite.depth - 0.001);
    this.state = 'walk';
  }

  /** How far they see, right now. */
  private range(): number {
    let r = this.host.dark() ? SIGHT.dark : SIGHT.day;
    if (this.host.lowProfile?.()) r *= 0.5;
    return r;
  }

  /** Can this officer see you, right now?  0 if not; otherwise how clearly (0..1). */
  sees(): number {
    const c = this.cop;
    if (!c || this.state === 'inside' || this.state === 'enter') return 0;
    const p = this.host.player();
    if (!p.sprite.visible || this.host.concealed?.()) return 0;
    const dx = p.x - c.x;
    // only what is in front of them
    if (dx * c.facing <= 0) return 0;
    const range = this.range();
    const d = Math.abs(dx);
    if (d > range) return 0;
    return 1 - d / range;
  }

  update(delta: number): void {
    const dt = delta / 1000;
    if (this.state === 'gone') return;
    if (this.state === 'waiting') {
      this.wait -= dt;
      if (this.wait <= 0) {
        // never in at the end you are stood by, facing you: that is no chance
        // at all -- they come on from the other end instead
        const px = this.host.player().x;
        if (!this.host.alley && (this.dir > 0 ? px < 120 : px > this.host.worldW - 120)) this.dir = -this.dir;
        this.spawn(this.dir > 0 ? -20 : this.host.worldW + 20, this.dir);
      }
      return;
    }
    const c = this.cop;
    if (!c) return;
    const p = this.host.player();
    const bounds = new Phaser.Geom.Rectangle(-80, this.host.y, this.host.worldW + 160, 0);
    this.eyeCool -= dt;
    this.doorCool -= dt;
    if (this.state === 'inside') {
      this.insideT -= dt;
      if (this.insideT <= 0) this.comeOut();
      return;
    }
    this.mark?.setPosition(c.x, c.y - 33);
    // the lights go round: red, then blue, each pulsing as it comes up
    this.auraT += dt;
    const ph = (Math.sin(this.auraT * 7) + 1) / 2;
    const k = 0.18 + 0.2 * Math.abs(Math.sin(this.auraT * 3.5));
    const fade = c.sprite.alpha;
    this.auraR?.setPosition(c.x, c.y - 12).setAlpha(k * ph * fade).setDepth(c.sprite.depth - 0.001);
    this.auraB?.setPosition(c.x, c.y - 12).setAlpha(k * (1 - ph) * fade).setDepth(c.sprite.depth - 0.001);
    if (this.sees() > 0) this.lastSeen = performance.now();
    this.drawCone();

    if (this.state === 'enter') return;

    if (this.state === 'walk' || this.state === 'pause' || this.state === 'eye') {
      if (this.state === 'walk') {
        c.move(this.dir, 0, delta * PACE.walk, bounds);
        this.nextPause -= dt;
        // a stop now and then to look both ways along the pavement
        if (this.nextPause <= 0) {
          this.state = 'pause';
          this.pauseLen = this.pauseT = 2.2 + Math.random() * 1.6;
          c.stand();
        } else if (this.tryOldMan() || this.tryDoor()) return;
      } else if (this.state === 'pause') {
        this.pauseT -= dt;
        // back the way they came, ahead again, and back once more
        const gone = this.pauseLen - this.pauseT;
        c.face(gone < 0.4 ? this.dir : gone < 1.3 ? -this.dir : gone < 1.9 ? this.dir : -this.dir);
        if (this.pauseT <= 0) {
          c.face(this.dir);
          this.state = 'walk';
          this.nextPause = 2.5 + Math.random() * 3.5;
        }
      } else this.stepEye(dt);
      // what they can see of you
      const v = performance.now() < clearedUntil ? 0 : this.sees();
      // THE FACE ON THE POSTER, still: in sight is known, at once
      if (v > 0 && !store.get().disguised) return this.spotted();
      // (a new look: they have to look hard, and slowly)
      if (v > 0) this.aware = Math.min(1, this.aware + dt * (0.45 + 1.5 * v) * 0.5);
      else this.aware = Math.max(0, this.aware - dt * 0.4);
      if (this.state !== 'eye') this.mark?.setText(this.aware > 0.15 ? '?' : '').setVisible(this.aware > 0.15).setTint(PALETTE.gold);
      if (this.aware >= 1 && !this.squad.busy(this)) return this.stopYou();
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
        this.host.lock(false);
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

  /**
   * The cone: from the eyes out to as far as they see, opening down to the
   * pavement -- three bands, brightest near them.  Pale walking, amber while
   * unsure (or looking the old man over), red after you.
   */
  private drawCone(): void {
    const g = this.cone;
    const c = this.cop;
    if (!g || !c) return;
    g.clear();
    if (this.state === 'arrest' || this.state === 'question') return;
    g.setDepth(c.sprite.depth - 0.002);
    const col = this.state === 'chase' ? CONE.hot : this.aware > 0.15 || this.state === 'eye' ? CONE.wary : CONE.calm;
    const f = c.facing;
    const ex = c.x + f * 3;
    const ey = c.y - 21;
    const R = this.range();
    const a = c.sprite.alpha;
    for (const [k, al] of [[1, 0.1], [0.66, 0.08], [0.33, 0.08]] as const) {
      const r = R * k;
      g.fillStyle(col, al * a);
      g.fillTriangle(ex, ey, ex + f * r, ey - 9 * k, ex + f * r, c.y + 2);
    }
    // the sight line, along the eyes
    g.lineStyle(1, col, 0.3 * a).lineBetween(ex, ey, ex + f * R, ey - 3);
  }

  /** The old man in front of them: stop and have a good look at him. */
  private tryOldMan(): boolean {
    const at = this.host.watch?.();
    const c = this.cop!;
    if (at === null || at === undefined || this.eyeCool > 0) return false;
    const dx = at - c.x;
    if (dx * c.facing <= 0 || Math.abs(dx) > this.range() * 1.2) return false;
    this.state = 'eye';
    this.eyeT = 0;
    this.eyeSaid = false;
    c.stand();
    return true;
  }

  private stepEye(dt: number): void {
    const c = this.cop!;
    const at = this.host.watch?.();
    this.eyeT += dt;
    if (at !== null && at !== undefined) {
      c.face(Math.sign(at - c.x) || this.dir);
      // closer for a word, if they are a way off
      if (Math.abs(at - c.x) > 30 && this.eyeT < 2) c.move(Math.sign(at - c.x), 0, dt * 1000 * PACE.walk, new Phaser.Geom.Rectangle(-80, this.host.y, this.host.worldW + 160, 0));
      else c.stand();
    }
    this.mark?.setText('?').setVisible(true).setTint(0xffb040);
    if (!this.eyeSaid && this.eyeT > 1.6) {
      this.eyeSaid = true;
      this.say(EYE_LINES[Math.floor(Math.random() * EYE_LINES.length)]);
    }
    if (this.eyeT > 3.6 || at === null || at === undefined) {
      this.eyeCool = 16 + Math.random() * 8;
      this.mark?.setVisible(false);
      c.face(this.dir);
      this.state = 'walk';
      this.nextPause = 3 + Math.random() * 3;
    }
  }

  /** At a door: now and then, in they go for a look round. */
  private tryDoor(): boolean {
    const c = this.cop!;
    if (this.doorCool > 0 || this.aware > 0.15) return false;
    const d = this.host.doors?.find((o) => Math.abs(o.x - c.x) < 2);
    if (!d) return false;
    this.doorCool = 9;
    if (Math.random() > (forced() ? 0.9 : 0.35)) return false;
    this.door = d;
    this.state = 'enter';
    c.stand();
    // (turned to the door, and through it)
    this.host.scene.tweens.add({
      targets: c.sprite,
      alpha: 0,
      y: c.y - 3,
      duration: 500,
      onComplete: () => {
        if (this.state !== 'enter') return;
        this.state = 'inside';
        this.insideT = 12 + Math.random() * 8;
        copWentIn(d.place, this.insideT * 1000);
        this.mark?.setVisible(false);
        this.cone?.clear();
        this.auraR?.setAlpha(0);
        this.auraB?.setAlpha(0);
      },
    });
    audio.sfx('door_open', 0.3);
    return true;
  }

  /** Back out of the door they went in at, and on their way. */
  private comeOut(): void {
    const c = this.cop!;
    const d = this.door;
    this.door = null;
    if (d) c.setPosition(d.x, this.host.y);
    this.state = 'enter';
    audio.sfx('door_open', 0.3);
    this.host.scene.tweens.add({
      targets: c.sprite,
      alpha: 1,
      duration: 450,
      onComplete: () => {
        if (this.state !== 'enter') return;
        this.state = 'walk';
        this.doorCool = 14;
      },
    });
  }

  /** "!": that is the face on the poster, and they are coming. */
  private spotted(): void {
    const c = this.cop!;
    this.state = 'chase';
    this.startT = 0.45;
    this.aware = 1;
    c.face(Math.sign(this.host.player().x - c.x) || 1);
    this.mark?.setText('!').setVisible(true).setTint(0xff5050);
    audio.sfx('ui_blip', 0.8);
    this.say('"THAT\'S HIM! THE FACE ON THE POSTER!"');
  }

  /** "?": stopped, and asked (only once you have a new look). */
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
            if (Math.random() < (store.get().disguised ? 0.85 : dark ? 0.7 : 0.45)) {
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
    if (this.cop) copSay(this.host.scene, this.cop.x, this.cop.y, line);
  }

  private closePanel(): void {
    if (this.panel?.active) this.panel.destroy();
    this.panel = null;
  }

  /** A hand on your shoulder.  That is the run (or, still in the hunt, the attempt). */
  private arrest(): void {
    this.state = 'arrest';
    this.host.lock(true);
    this.cop?.stand();
    this.host.player().stand();
    this.cone?.clear();
    takeIn(this.host.scene, (l) => this.say(l));
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
    this.cone?.destroy();
    this.auraR?.destroy();
    this.auraB?.destroy();
    this.cop = this.mark = this.auraR = this.auraB = null;
    this.cone = null;
    this.state = 'gone';
    // the hunt: another one along in a moment, from either end
    if (stealthPhase() && !this.host.alley) {
      this.state = 'waiting';
      this.wait = 2 + Math.random() * 4;
      this.dir = Math.random() < 0.5 ? 1 : -1;
      this.aware = 0;
    }
  }
}

/**
 * THE POLICE ON THIS STREET: however many officers are out on it.  In the
 * hunt, two (three on a long street) walking it at once from either end,
 * and always another along when one walks off; afterwards one, now and then.
 * In an alley, nobody -- unless one saw you go in.
 */
export class Patrol {
  private units: Unit[] = [];

  constructor(host: PatrolHost) {
    if (!patrolsOut()) return;
    const now = performance.now();
    const chased = pursuit && now < pursuit.until ? pursuit : null;
    pursuit = null;
    const squad = { busy: (u: Unit) => this.units.some((o) => o !== u && o.holding) };
    if (host.alley) {
      // they saw you duck in here: in after you, from the street end
      if (chased?.alley) this.units.push(Unit.chaser(host, squad, 'left'));
      return;
    }
    if (chased) {
      // out of a door after you (from a shop, the arcade, Lily's), or in off the end
      const door = chased.from ? host.doors?.find((d) => d.place === chased.from) : undefined;
      this.units.push(door ? Unit.fromDoor(host, squad, door.x) : Unit.chaser(host, squad, chased.edge));
    }
    if (stealthPhase()) {
      const n = host.worldW > 400 ? 3 : 2;
      const first = Math.random() < 0.5 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const delay = (host.grace ?? 0) + 2 + i * 6 + Math.random() * 3;
        this.units.push(Unit.walker(host, squad, delay, i % 2 ? -first : first));
      }
      return;
    }
    if (chased) return;
    if (!forced() && (now < nextPatrolAt || Math.random() > 0.45)) return;
    nextPatrolAt = now + (75 + Math.random() * 65) * 1000;
    this.units.push(Unit.walker(host, squad, forced() ? 0.3 : 2 + Math.random() * 6, Math.random() < 0.5 ? 1 : -1));
  }

  /** On this street now (for the harness, and for the scenes' own checks). */
  get present(): boolean {
    return this.units.some((u) => u.present);
  }

  /** Questioning or taking you: the scene's own controls are off. */
  get holding(): boolean {
    return this.units.some((u) => u.holding);
  }

  get chasing(): boolean {
    return this.units.some((u) => u.chasing);
  }

  /** How many are out on the street (for the harness). */
  get count(): number {
    return this.units.filter((u) => u.present).length;
  }

  /** Where each is (for the harness). */
  get states(): Array<{ state: string; x: number | null }> {
    return this.units.map((u) => ({ state: u.state, x: u.x }));
  }

  update(delta: number): void {
    for (const u of this.units) u.update(delta);
  }

  /**
   * You went in somewhere they cannot follow: the arcade, Lily's.
   * Lost them.
   */
  safe(): void {
    if (this.chasing) earnBadge('low_profile');
    pursuit = null;
  }

  /**
   * Ducked into an alley: out of their sight -- and if one was after you and
   * SAW you go in, they come down it after you.  Otherwise they go by outside.
   */
  hideAway(): void {
    if (!this.chasing) return;
    const seen = this.units.some((u) => u.chasing && u.witnessed());
    pursuit = { until: performance.now() + 8000, edge: 'left', alley: seen };
  }

  /** Off the end of the street with them after you: they follow you on, in at `edge` of the next. */
  leaveBy(edge: 'left' | 'right'): void {
    if (this.chasing) pursuit = { until: performance.now() + 8000, edge, alley: false };
  }
}

/** For the harness: the chase that is (or is not) on between streets. */
export const patrolDev = {
  pursuit: () => (pursuit ? { ...pursuit } : null),
  chase: (edge: 'left' | 'right', alley: boolean) => (pursuit = { until: performance.now() + 8000, edge, alley }),
};
