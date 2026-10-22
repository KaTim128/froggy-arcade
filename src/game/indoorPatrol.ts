/**
 * ---- AN OFFICER INDOORS.  While the patrols are out (game/patrol), one now
 * and then comes in off the street for a look round (game/policeVisits): in
 * at the door, from one spot on the floor to the next, stopping at each to
 * sweep the room, and out again.
 *
 * WHAT THEY SEE is a cone on the floor in front of them -- drawn, so you can
 * see where is safe -- out to a range, and cut short by anything TALL in the
 * way: an arcade cabinet, a tall shelf, a wardrobe (`Cover.high`).  Anything
 * low -- a sofa, a table, a rug, a counter you could see over -- hides
 * nothing.  So in the arcade you can stand behind a machine, or in the gap
 * between two, and they look straight past you.  Close enough to bump into
 * you, they know you are there whichever way they face.
 *
 * SEEN, with the face from the poster: known at once ("!"), and after you;
 * lose them for a few seconds and they search where they last saw you, then
 * give it up.  With a whole new look they have to look hard, and slowly
 * ("?"), and then they ask -- the same question as on the street.  Taken:
 * `takeIn` (game/patrol), as outside.
 *
 * A room hosts one with an `IndoorHost`: where its floor is, what is solid,
 * what blocks sight, where the door is.  A side-on room (Lily's lobby) has a
 * floor one line deep, and the cone is drawn side-on, the way the street's is.
 */

import Phaser from 'phaser';
import { store } from '../core/state';
import { audio } from '../core/audio';
import { centerText, pinToScreen } from '../core/ui';
import { LOOKS, Player } from '../art/player';
import { PALETTE } from '../render/palette';
import { openTalkPanel } from '../ui/talkPanel';
import { collide, type Box } from './roomWalk';
import { chaseOutOf, copSay, patrolsOut, takeIn, takeIndoorChase } from './patrol';
import { copCameOut, copInside, copWentIn, nextVisitIn, planVisit, type Place } from './policeVisits';

/** Something in the room that might hide you: its footprint on the floor, and whether it is tall. */
export interface Cover {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Tall (a cabinet, a shelf): blocks their sight.  Low (a sofa): does not. */
  high: boolean;
}

/**
 * The footprint of something tall standing on the floor at `base` (its front
 * edge), `w` wide and `depth` deep -- grown back towards the wall a little,
 * since a tall thing hides the floor just behind it as well.
 */
export function tallCover(x: number, base: number, w: number, depth: number, behind = 8): Cover {
  return { x: x - w / 2, y: base - depth - behind, w, h: depth + behind, high: true };
}

/**
 * A piece of furniture as cover: tall (a wardrobe, a bookcase, a shower, a
 * floor lamp is not -- too thin) hides you; anything low does not.
 */
export function furnitureCover(f: { w: number; h: number; wall: boolean; cat: string }, x: number, y: number): Cover | null {
  if (f.wall || f.cat === 'rug') return null;
  const depth = Math.min(8, Math.max(4, Math.round(f.h / 3)));
  // (a bed, a sofa or a table is never tall enough, however big it is)
  const high = f.h >= 24 && f.w >= 12 && !['bed', 'sofa', 'table', 'chair'].includes(f.cat);
  return high ? tallCover(x, y, f.w, depth, 6) : { x: x - f.w / 2, y: y - depth, w: f.w, h: depth, high: false };
}

export interface IndoorHost {
  scene: Phaser.Scene;
  place: Place;
  player: () => Player;
  /** Where feet can go. */
  bounds: () => Phaser.Geom.Rectangle;
  /** What they walk round. */
  solids: () => Box[];
  /** What might hide you (only the tall ones do). */
  covers: () => Cover[];
  /** Where they come in, and go out. */
  door: { x: number; y: number };
  /** Freeze (or free) the room's own controls. */
  lock: (on: boolean) => void;
  /** Spotted: shut whatever card is up, stand up off the seat. */
  alarm?: () => void;
  /** A side-on room, one line deep (the cone is drawn side-on). */
  side?: boolean;
  dark?: () => boolean;
}

type State = 'away' | 'enter' | 'walk' | 'look' | 'chase' | 'search' | 'question' | 'leave' | 'arrest' | 'gone';

/** How far they see indoors, by day and in the dark. */
const RANGE = { day: 96, dark: 64 };
/** Half the cone's width, radians. */
const HALF = 0.5;
/** Paces, as fractions of the player's walk. */
const PACE = { walk: 0.42, chase: 0.9 };
const REACH = 7;
/** Close enough that they know you are there whichever way they face. */
const BUMP = 11;
const ANSWER_S = 5;
const CONE = { calm: 0xfff2b0, wary: 0xffb040, hot: 0xff4040 };

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** Does the segment (x0,y0)-(x1,y1) cross the box?  (Liang-Barsky.) */
function crosses(c: Cover, x0: number, y0: number, x1: number, y1: number): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - c.x, c.x + c.w - x0, y0 - c.y, c.y + c.h - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
      continue;
    }
    const r = q[i] / p[i];
    if (p[i] < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

const inside = (c: Cover, x: number, y: number): boolean => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h;

export class IndoorCop {
  private cop: Player | null = null;
  private mark: Phaser.GameObjects.BitmapText | null = null;
  private cone: Phaser.GameObjects.Graphics | null = null;
  private auraR: Phaser.GameObjects.Ellipse | null = null;
  private auraB: Phaser.GameObjects.Ellipse | null = null;
  private panel: Phaser.GameObjects.Container | null = null;
  state: State = 'gone';
  private t = 0;
  /** Which way they are looking, on the floor (radians; 0 is to the right). */
  private ang = 0;
  private baseAng = 0;
  private goal: { x: number; y: number } | null = null;
  private stops = 0;
  private stuckT = 0;
  private lastXY = { x: 0, y: 0 };
  private aware = 0;
  private lastSeen: { x: number; y: number } | null = null;
  private unseenT = 0;
  private startT = 0;
  private answerT = 0;
  private auraT = 0;

  /**
   * `asks`: they came in on you at a cabinet (scenes2d/MinigameScene): stood
   * right by you, and the question already asked.
   */
  constructor(
    private host: IndoorHost,
    opts: { asks?: boolean } = {},
  ) {
    if (!patrolsOut()) return;
    if (opts.asks) {
      this.arriveBeside();
      return;
    }
    if (takeIndoorChase(host.place)) {
      // in at the door after you, a beat behind
      this.spawn(host.door.x, host.door.y);
      this.state = 'chase';
      this.startT = 1.1;
      this.lastSeen = { x: host.player().x, y: host.player().y };
      return;
    }
    const plan = planVisit(host.place);
    if (plan.already) {
      // already in here, somewhere along their round
      const at = this.freeSpot(60);
      this.spawn(at.x, at.y);
      this.state = 'look';
      this.t = 0;
      this.stops = 1;
      this.ang = this.baseAng = Math.random() * Math.PI * 2;
      return;
    }
    this.state = 'away';
    this.t = plan.arriveIn ?? nextVisitIn() ?? Infinity;
    // (shown out of here before they come: nothing to do)
    host.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
  }

  /** In the room right now (for the rooms, and the harness). */
  get present(): boolean {
    return !!this.cop && this.state !== 'away' && this.state !== 'gone';
  }

  get chasing(): boolean {
    return this.state === 'chase';
  }

  /** Questioning or taking you: the room's own controls are off. */
  get holding(): boolean {
    return this.state === 'question' || this.state === 'arrest';
  }

  /** For the harness: where they are and what they make of you. */
  get info(): { state: State; x: number; y: number; ang: number; aware: number; sees: number } | null {
    if (!this.cop) return { state: this.state, x: NaN, y: NaN, ang: 0, aware: 0, sees: 0 };
    return { state: this.state, x: this.cop.x, y: this.cop.y, ang: this.ang, aware: this.aware, sees: this.sees() };
  }

  /** For the harness: in now, at (x, y), looking `ang`. */
  devPut(x: number, y: number, ang: number, hold = true): void {
    if (!this.cop) this.spawn(x, y);
    this.cop!.setPosition(x, y);
    this.ang = this.baseAng = ang;
    this.state = 'look';
    this.t = hold ? -1e9 : 0;
  }

  /** You went out of a door with them after you: they come out after you. */
  leftRoom(): void {
    if (this.state === 'chase' || this.state === 'search') chaseOutOf(this.host.place);
    else if (this.present) {
      // still on their round: in here a while yet, for whoever comes in next
      copWentIn(this.host.place, 12000);
    }
  }

  private shutdown(): void {
    this.closePanel();
  }

  private spawn(x: number, y: number): void {
    const s = this.host.scene;
    const p = new Player(s, x, y, this.host.dark?.() ?? false, LOOKS.officer).noSprint();
    p.sprite.add(s.add.rectangle(2, -16, 2, 3, 0x14141a));
    p.sprite.add(s.add.rectangle(3, -18, 1, 2, 0x14141a));
    p.sprite.add(s.add.rectangle(-3, -9, 2, 6, 0x0e0e12));
    p.sprite.add(s.add.rectangle(1, -9, 2, 1, 0xb8bcc4));
    this.cop = p;
    this.mark = centerText(s, x, y - 34, '', PALETTE.gold).setDepth(820).setVisible(false);
    // the cone lies on the floor, under everything standing on it
    this.cone = s.add.graphics().setDepth(this.host.side ? p.sprite.depth - 0.002 : 0.9);
    this.auraR = s.add.ellipse(x, y - 12, 34, 40, 0xff2a3a, 0.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.sprite.depth - 0.001);
    this.auraB = s.add.ellipse(x, y - 12, 34, 40, 0x2a5aff, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(p.sprite.depth - 0.001);
    copWentIn(this.host.place, 4000);
    this.lastXY = { x, y };
    s.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
  }

  /** In at the door: stood a moment in the doorway, then off on their round. */
  private arrive(): void {
    const d = this.host.door;
    this.spawn(d.x, d.y);
    audio.sfx('door_open', 0.45);
    audio.sfx('police_radio', 0.3);
    this.state = 'enter';
    this.t = 1.2;
    this.stops = 0;
    this.ang = this.baseAng = this.host.side ? 0 : Math.PI / 2 * -1;
    this.cop!.sprite.setAlpha(0);
    this.host.scene.tweens.add({ targets: this.cop!.sprite, alpha: 1, duration: 400 });
    this.say('"Police. Just having a look round."');
  }

  /** At your elbow at a cabinet: they have had a good look at you already. */
  private arriveBeside(): void {
    const p = this.host.player();
    const b = this.host.bounds();
    const side = p.x + 28 < b.right ? 1 : -1;
    const at = { x: p.x + 26 * side, y: Phaser.Math.Clamp(p.y + 2, b.y, b.bottom) };
    this.spawn(at.x, at.y);
    this.cop!.face(-side);
    this.ang = side > 0 ? Math.PI : 0;
    this.lastSeen = { x: p.x, y: p.y };
    if (!store.get().disguised) {
      this.mark!.setText('!').setVisible(true).setTint(0xff5050);
      this.say('"I KNEW IT. YOU\'RE COMING WITH ME!"');
      this.state = 'chase';
      // (a moment to run for it)
      this.startT = 1.4;
      this.host.alarm?.();
      return;
    }
    this.state = 'look';
    this.t = 0;
    this.host.scene.time.delayedCall(300, () => this.state === 'look' && this.ask());
  }

  /** Somewhere on the floor clear of everything, at least `away` from where they are. */
  private freeSpot(away: number): { x: number; y: number } {
    const b = this.host.bounds();
    const from = this.cop ? { x: this.cop.x, y: this.cop.y } : this.host.door;
    const solids = this.host.solids();
    for (let i = 0; i < 40; i++) {
      const x = b.x + 8 + Math.random() * Math.max(1, b.width - 16);
      const y = this.host.side ? b.y : b.y + 4 + Math.random() * Math.max(1, b.height - 8);
      const clear = solids.every((s) => !(x > s.x - 8 && x < s.x + s.w + 8 && y > s.y - 4 && y < s.y + s.h + 6));
      if (clear && Math.hypot(x - from.x, y - from.y) >= away) return { x, y };
    }
    return { x: b.centerX, y: this.host.side ? b.y : b.centerY };
  }

  private range(): number {
    return this.host.dark?.() ? RANGE.dark : RANGE.day;
  }

  /** Is the line from them to (x, y) broken by anything tall? */
  private blocked(x: number, y: number): boolean {
    if (this.host.side || !this.cop) return false;
    const cx = this.cop.x;
    const cy = this.cop.y;
    return this.host.covers().some((c) => c.high && !inside(c, cx, cy) && crosses(c, cx, cy, x, y));
  }

  /** Can they see you right now?  0 if not; otherwise how clearly (0..1). */
  sees(): number {
    const c = this.cop;
    if (!c || this.state === 'away' || this.state === 'gone' || this.state === 'enter') return 0;
    const p = this.host.player();
    if (!p.sprite.visible) return 0;
    const dx = p.x - c.x;
    const dy = this.host.side ? 0 : p.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d < BUMP) return 1;
    const R = this.range();
    if (d > R) return 0;
    if (Math.abs(wrap(Math.atan2(dy, dx) - this.ang)) > HALF) return 0;
    if (this.blocked(p.x, p.y)) return 0;
    return 1 - (d / R) * 0.7;
  }

  update(delta: number): void {
    const dt = delta / 1000;
    if (this.state === 'gone') return;
    if (this.state === 'away') {
      this.t -= dt;
      // (not while you are sat at a card, or they would come in on a frozen room)
      if (this.t <= 0) this.arrive();
      return;
    }
    const c = this.cop;
    if (!c) return;
    // still in here: the arcade (and the rest) know it
    copWentIn(this.host.place, 3000);
    this.auraT += dt;
    const ph = (Math.sin(this.auraT * 7) + 1) / 2;
    const k = (0.14 + 0.14 * Math.abs(Math.sin(this.auraT * 3.5))) * c.sprite.alpha;
    this.auraR?.setPosition(c.x, c.y - 12).setAlpha(k * ph).setDepth(c.sprite.depth - 0.001);
    this.auraB?.setPosition(c.x, c.y - 12).setAlpha(k * (1 - ph)).setDepth(c.sprite.depth - 0.001);
    this.mark?.setPosition(c.x, c.y - 33);

    switch (this.state) {
      case 'enter':
        this.t -= dt;
        this.ang = this.baseAng + Math.sin(this.auraT * 2) * 0.6;
        if (this.t <= 0) this.nextStop();
        break;
      case 'walk':
        this.walkTo(this.goal!, PACE.walk, delta);
        if (!this.goal || Math.hypot(this.goal.x - c.x, this.goal.y - c.y) < 3) {
          this.state = 'look';
          this.t = 0;
          this.baseAng = this.ang;
          c.stand();
        }
        break;
      case 'look': {
        // a slow sweep, side to side, then on (or out)
        this.t += dt;
        this.ang = this.baseAng + Math.sin(this.t * 1.9) * 1.1;
        if (this.host.side) this.ang = Math.cos(this.ang) >= 0 ? 0 : Math.PI;
        this.faceAng();
        if (this.t > 3.4) this.nextStop();
        break;
      }
      case 'search': {
        // where they last saw you, and a good look round there
        if (this.goal) {
          this.walkTo(this.goal, PACE.walk * 1.3, delta);
          if (Math.hypot(this.goal.x - c.x, this.goal.y - c.y) < 4) {
            this.goal = null;
            this.baseAng = this.ang;
            this.t = 0;
            c.stand();
          }
        } else {
          this.t += dt;
          this.ang = this.baseAng + Math.sin(this.t * 2.6) * 1.4;
          if (this.host.side) this.ang = Math.cos(this.ang) >= 0 ? 0 : Math.PI;
          this.faceAng();
          if (this.t > 3.5) {
            this.say('"...Lost him."');
            this.aware = 0;
            this.mark?.setVisible(false);
            this.stops = Math.max(this.stops, 3);
            this.nextStop();
          }
        }
        break;
      }
      case 'chase': {
        this.mark?.setText('!').setVisible(true).setTint(0xff5050);
        if (this.startT > 0) {
          this.startT -= dt;
          this.faceTowards(this.host.player().x, this.host.player().y);
          c.stand();
          break;
        }
        const p = this.host.player();
        const v = this.sees();
        if (v > 0) {
          this.lastSeen = { x: p.x, y: p.y };
          this.unseenT = 0;
        } else this.unseenT += dt;
        const to = v > 0 ? { x: p.x, y: p.y } : this.lastSeen ?? { x: p.x, y: p.y };
        this.walkTo(to, PACE.chase, delta);
        if (Math.hypot(p.x - c.x, (this.host.side ? 0 : p.y - c.y)) <= REACH && p.sprite.visible) return this.arrest();
        // out of sight a while: where did they go?
        if (this.unseenT > 2.5) {
          this.state = 'search';
          this.goal = this.lastSeen;
          this.t = 0;
          this.mark?.setText('?').setTint(0xffb040);
        }
        break;
      }
      case 'question':
        this.answerT -= dt;
        this.faceTowards(this.host.player().x, this.host.player().y);
        if (this.answerT <= 0) {
          this.closePanel();
          this.host.lock(false);
          this.startChase(0.3);
        }
        break;
      case 'leave':
        this.walkTo(this.host.door, PACE.walk, delta);
        if (Math.hypot(this.host.door.x - c.x, this.host.door.y - c.y) < 4) this.goOut();
        break;
      default:
        break;
    }
    this.drawCone();
    if (this.state === 'enter' || this.state === 'walk' || this.state === 'look' || this.state === 'search') this.watch(dt);
  }

  /** What they make of you, while they are on their round. */
  private watch(dt: number): void {
    const v = this.sees();
    const p = this.host.player();
    if (v > 0 && !store.get().disguised) {
      // the face on the poster: known at once
      this.lastSeen = { x: p.x, y: p.y };
      this.say('"THAT\'S HIM! THE FACE ON THE POSTER!"');
      audio.sfx('ui_blip', 0.8);
      this.host.alarm?.();
      this.startChase(0.45);
      return;
    }
    if (v > 0) this.aware = Math.min(1, this.aware + dt * (0.3 + 0.9 * v));
    else this.aware = Math.max(0, this.aware - dt * 0.35);
    if (this.state !== 'search') this.mark?.setText(this.aware > 0.15 ? '?' : '').setVisible(this.aware > 0.15).setTint(PALETTE.gold);
    if (this.aware >= 1) this.ask();
  }

  private startChase(wait: number): void {
    this.state = 'chase';
    this.startT = wait;
    this.unseenT = 0;
    this.aware = 1;
    this.mark?.setText('!').setVisible(true).setTint(0xff5050);
  }

  /** On to the next spot -- or, round done, back out of the door. */
  private nextStop(): void {
    this.stops++;
    if (this.stops > 3 + Math.floor(Math.random() * 2)) {
      this.state = 'leave';
      return;
    }
    this.goal = this.freeSpot(40);
    this.state = 'walk';
    this.stuckT = 0;
  }

  /** Straight for (x, y), sliding along whatever is in the way; stuck, try somewhere else. */
  private walkTo(to: { x: number; y: number } | null, pace: number, delta: number): void {
    const c = this.cop!;
    if (!to) return;
    const dx = to.x - c.x;
    const dy = this.host.side ? 0 : to.y - c.y;
    if (Math.hypot(dx, dy) < 1.5) {
      c.stand();
      return;
    }
    const before = { x: c.x, y: c.y };
    const b = this.host.bounds();
    c.move(dx, dy, delta * pace, new Phaser.Geom.Rectangle(b.x - 30, b.y, b.width + 60, b.height));
    collide(c, before, this.host.solids());
    const want = Math.atan2(dy, dx);
    this.ang += wrap(want - this.ang) * Math.min(1, (delta / 1000) * 6);
    if (this.host.side) this.ang = dx >= 0 ? 0 : Math.PI;
    this.faceAng();
    const moved = Math.hypot(c.x - this.lastXY.x, c.y - this.lastXY.y);
    this.lastXY = { x: c.x, y: c.y };
    this.stuckT = moved < 0.05 ? this.stuckT + delta / 1000 : 0;
    if (this.stuckT > 0.7 && (this.state === 'walk' || this.state === 'search')) {
      this.stuckT = 0;
      if (this.state === 'walk') this.goal = this.freeSpot(30);
      else this.goal = null;
    }
  }

  private faceAng(): void {
    const k = Math.cos(this.ang);
    if (Math.abs(k) > 0.2) this.cop?.face(k > 0 ? 1 : -1);
  }

  private faceTowards(x: number, y: number): void {
    const c = this.cop!;
    this.ang = Math.atan2(this.host.side ? 0 : y - c.y, x - c.x);
    this.faceAng();
  }

  /**
   * THE CONE, on the floor: rays out from their feet across the cone, each
   * stopped by the first tall thing it meets -- so the shadow behind a
   * cabinet is a gap in it.  Side-on (the lobby), a wedge from the eyes.
   */
  private drawCone(): void {
    const g = this.cone;
    const c = this.cop;
    if (!g || !c) return;
    g.clear();
    if (this.state === 'arrest' || this.state === 'question' || this.state === 'leave' && c.sprite.alpha < 0.5) return;
    const col = this.state === 'chase' ? CONE.hot : this.aware > 0.15 || this.state === 'search' ? CONE.wary : CONE.calm;
    const a = c.sprite.alpha;
    const R = this.range();
    if (this.host.side) {
      g.setDepth(c.sprite.depth - 0.002);
      const f = Math.cos(this.ang) >= 0 ? 1 : -1;
      const ex = c.x + f * 3;
      const ey = c.y - 21;
      for (const [k, al] of [[1, 0.1], [0.66, 0.08], [0.33, 0.08]] as const) {
        g.fillStyle(col, al * a);
        g.fillTriangle(ex, ey, ex + f * R * k, ey - 9 * k, ex + f * R * k, c.y + 2);
      }
      return;
    }
    const covers = this.host.covers().filter((k) => k.high && !inside(k, c.x, c.y));
    const b = this.host.bounds();
    const N = 22;
    const pts: Phaser.Types.Math.Vector2Like[] = [{ x: c.x, y: c.y }];
    for (let i = 0; i <= N; i++) {
      const t = this.ang - HALF + (2 * HALF * i) / N;
      const ux = Math.cos(t);
      const uy = Math.sin(t);
      let r = 4;
      for (; r < R; r += 3) {
        const x = c.x + ux * r;
        const y = c.y + uy * r;
        if (x < b.x - 10 || x > b.right + 10 || y < b.y - 14 || y > b.bottom + 6) break;
        if (covers.some((k) => inside(k, x, y))) break;
      }
      pts.push({ x: c.x + ux * r, y: c.y + uy * r });
    }
    g.fillStyle(col, 0.16 * a).fillPoints(pts, true);
    g.lineStyle(1, col, 0.3 * a).strokePoints(pts, true);
  }

  /** "Have we met?" -- the street's question, indoors. */
  private ask(): void {
    if (this.panel) return;
    const c = this.cop!;
    this.state = 'question';
    this.answerT = ANSWER_S;
    c.stand();
    this.faceTowards(this.host.player().x, this.host.player().y);
    this.mark?.setText('!').setVisible(true).setTint(0xff5050);
    audio.sfx('ui_blip', 0.7);
    this.host.alarm?.();
    this.host.lock(true);
    this.panel = openTalkPanel(this.host.scene, {
      speaker: 'officer',
      line: '"Hold on. Look at me. You look an awful lot like the face on that poster."',
      depth: 950,
      options: [
        {
          label: "THAT'S NOT ME",
          fn: () => {
            this.panel = null;
            this.host.lock(false);
            if (Math.random() < 0.85) {
              this.say('"...No. Sorry. Carry on."');
              this.aware = 0;
              this.mark?.setVisible(false);
              this.state = 'leave';
            } else {
              this.say('"Nice try."');
              this.startChase(0.9);
            }
          },
        },
        {
          label: 'RUN',
          fn: () => {
            this.panel = null;
            this.host.lock(false);
            this.say('"HEY! STOP!"');
            this.startChase(0.7);
          },
        },
      ],
    });
    pinToScreen(this.panel);
  }

  private closePanel(): void {
    if (this.panel?.active) this.panel.destroy();
    this.panel = null;
  }

  private arrest(): void {
    this.state = 'arrest';
    this.host.alarm?.();
    this.host.lock(true);
    this.cop?.stand();
    this.host.player().stand();
    this.cone?.clear();
    takeIn(this.host.scene, (l) => this.say(l));
  }

  /** Out of the door, and gone -- another may look in later. */
  private goOut(): void {
    this.cop?.stand();
    audio.sfx('door_open', 0.35);
    const parts = [this.cop?.sprite, this.mark, this.cone, this.auraR, this.auraB].filter(Boolean);
    this.host.scene.tweens.add({ targets: parts, alpha: 0, duration: 350, onComplete: () => parts.forEach((o) => o?.destroy()) });
    this.cop = null;
    this.mark = this.auraR = this.auraB = null;
    this.cone = null;
    copCameOut(this.host.place);
    const again = nextVisitIn();
    this.state = again === null ? 'gone' : 'away';
    this.t = again ?? 0;
    this.aware = 0;
    this.stops = 0;
  }

  private say(line: string): void {
    if (this.cop) copSay(this.host.scene, this.cop.x, this.cop.y, line);
  }
}

/** Is an officer in the arcade?  (The cabinets ask: scenes2d/MinigameScene.) */
export const copInArcade = (): boolean => copInside('arcade');

/**
 * One of the arcade's rooms: an officer looking round it, the machines the
 * tall cover (stand behind one, or in the gap between two, and they look
 * straight past you).  `asks`: back from a cabinet they interrupted.
 */
export function arcadeCop(o: {
  scene: Phaser.Scene;
  player: () => Player;
  bounds: () => Phaser.Geom.Rectangle;
  solids: () => Box[];
  /** Every machine on the floor: its middle, its front edge, its width and depth. */
  machines: Array<{ x: number; y: number; w: number; depth: number }>;
  door: { x: number; y: number };
  lock: (on: boolean) => void;
  alarm?: () => void;
  asks?: boolean;
}): IndoorCop {
  const covers = o.machines.map((m) => tallCover(m.x, m.y, m.w, m.depth));
  const cop = new IndoorCop(
    { scene: o.scene, place: 'arcade', player: o.player, bounds: o.bounds, solids: o.solids, covers: () => covers, door: o.door, lock: o.lock, alarm: o.alarm },
    { asks: o.asks },
  );
  o.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => cop.leftRoom());
  return cop;
}
