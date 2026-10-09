/**
 * The player character: a small pixel-art kid in a rust hoodie, hood up,
 * jeans and trainers.  Drawn from hand-made pixel grids, one per body part,
 * so the legs can stride, the arms can swing and the body can bob without
 * a sprite sheet.  Every pixel run is a plain Rectangle in one flat
 * container, which keeps scenes that recolour the player (the hotel's
 * night tint) working as they did.
 */

import Phaser from 'phaser';
import { nightify } from '../render/palette';
import { audio } from '../core/audio';

export const PLAYER_SPEED = 62; // logical px/s
/**
 * Holding SHIFT: half again the walk, and nothing else about the walk
 * changes -- the same rule as every other place you can run.
 */
export const SPRINT_MUL = 1.5;
const STEP_INTERVAL_MS = 340;

/**
 * Where the player sorts against the room's fixtures: 50, plus a thousandth
 * per pixel down the screen.  Fixtures that can be stood behind pick a depth
 * off the same scale (see `COUNTER_DEPTH` in game/content.ts).
 */
export function depthFor(y: number): number {
  return 50 + y / 1000;
}

/**
 * What is underfoot, and what that sounds like.
 *
 * The arcade is carpeted -- every room of it -- and outside is loose ground,
 * which is a different sound and not merely a brighter one.  `concrete` is
 * kept for the places that really are a bare slab: the basement, the flooded
 * lower level.
 */
export type Surface = 'carpet' | 'concrete' | 'gravel';

const FLOOR_SFX: Record<Surface, 'footstep_carpet' | 'footstep_concrete' | 'footstep_gravel'> = {
  carpet: 'footstep_carpet',
  concrete: 'footstep_concrete',
  gravel: 'footstep_gravel',
};

/** One letter per pixel; '.' is empty. */
const COLS: Record<string, number> = {
  H: 0xa8451f, // hood / hoodie
  C: 0xc0582c, // hoodie, lit
  D: 0x7e3016, // hoodie, shade
  w: 0xfff0c9, // drawstrings
  r: 0x4a2c1a, // hair under the hood
  S: 0xf2d2a8, // skin
  s: 0xd2a880, // skin, shade
  E: 0x1e1410, // eyes
  m: 0xa0584a, // mouth
  J: 0x3e5280, // jeans
  j: 0x2c3a60, // jeans, shade
  K: 0x2a2226, // shoes
  W: 0xe8e0d0, // soles
};
const OUTLINE = 0x1a1210;

/** Rows from the top of the figure (row 24 is the ground row). */
type Part = { top: number; rows: string[] };
const PARTS: Record<string, Part> = {
  head: {
    top: 0,
    rows: [
      '....HHHH....',
      '...HHCCHH...',
      '..HHrrrrHH..',
      '..HrrSSrrH..',
      '..HrSSSSSH..',
      '..HSSSSSsH..',
      '..HSSSSSsH..',
      '...HSSmsH...',
      '....HssH....',
    ],
  },
  eyes: { top: 5, rows: ['.....E.E....'] },
  torso: {
    top: 9,
    rows: [
      '...CCCCCC...',
      '...CwCwCC...',
      '...CwCwCC...',
      '...CCCCCC...',
      '...CDDDDC...',
      '...DCCCCD...',
      '...DDDDDD...',
    ],
  },
  backArm: { top: 9, rows: ['..D', '..D', '..D', '..D', '..D', '..s'] },
  frontArm: { top: 9, rows: ['.........C', '.........C', '.........C', '.........C', '.........C', '.........S'] },
  backLeg: {
    top: 16,
    rows: ['....jj', '....jj', '....jj', '....jj', '....jj', '....jj', '....jj', '....KKK', '....WWW'],
  },
  frontLeg: {
    top: 16,
    rows: ['......JJ', '......JJ', '......JJ', '......JJ', '......JJ', '......JJ', '......JJ', '......KKK', '......WWW'],
  },
};
const FIG_H = 25;
const MID = 6;
/** Drawn back to front. */
const ORDER = ['backArm', 'backLeg', 'frontLeg', 'torso', 'head', 'eyes', 'frontArm'] as const;
type PartName = (typeof ORDER)[number];

/** A run of same-coloured pixels on one row, at its unflipped centre. */
type Run = { r: Phaser.GameObjects.Rectangle; cx: number; cy: number };

export class Player {
  readonly sprite: Phaser.GameObjects.Container;
  private stepTimer = 0;
  private bobT = 0;
  private surface: Surface = 'carpet';
  private shift: Phaser.Input.Keyboard.Key | null = null;
  private parts = new Map<PartName, { fill: Run[]; line: Run[] }>();
  private dir = 1;
  private blinkT = 2.5;

  constructor(scene: Phaser.Scene, x: number, y: number, night = false) {
    this.shift = scene.input.keyboard?.addKey('SHIFT') ?? null;
    const c = (col: number) => (night ? nightify(col) : col);
    const lines: Phaser.GameObjects.Rectangle[] = [];
    const fills: Phaser.GameObjects.Rectangle[] = [];
    for (const name of ORDER) {
      const part = PARTS[name];
      const fill: Run[] = [];
      const line: Run[] = [];
      // the part's own pixels, then a one-pixel outline round it; outlines all
      // go behind every fill, so seams between parts close up
      const px = new Set<string>();
      part.rows.forEach((row, i) => [...row].forEach((ch, x) => ch !== '.' && px.add(`${x},${part.top + i}`)));
      const outline = new Set<string>();
      if (name !== 'eyes') {
        for (const k of px) {
          const [x, y] = k.split(',').map(Number);
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const n = `${x + ox},${y + oy}`;
            if (!px.has(n)) outline.add(n);
          }
        }
      }
      const runs = (cells: Map<number, Array<[number, number]>>, out: Run[], into: Phaser.GameObjects.Rectangle[]) => {
        for (const [yy, xs] of cells) {
          xs.sort((p, q) => p[0] - q[0]);
          let i = 0;
          while (i < xs.length) {
            let j = i;
            while (j + 1 < xs.length && xs[j + 1][0] === xs[j][0] + 1 && xs[j + 1][1] === xs[i][1]) j++;
            const w = j - i + 1;
            const cx = xs[i][0] + w / 2 - MID;
            const cy = yy + 0.5 - FIG_H;
            const r = scene.add.rectangle(cx, cy, w, 1, c(xs[i][1]));
            into.push(r);
            out.push({ r, cx, cy });
            i = j + 1;
          }
        }
      };
      const fc = new Map<number, Array<[number, number]>>();
      part.rows.forEach((row, i) =>
        [...row].forEach((ch, x) => {
          if (ch === '.') return;
          const yy = part.top + i;
          if (!fc.has(yy)) fc.set(yy, []);
          fc.get(yy)!.push([x, COLS[ch]]);
        }),
      );
      const oc = new Map<number, Array<[number, number]>>();
      for (const k of outline) {
        const [x, yy] = k.split(',').map(Number);
        if (!oc.has(yy)) oc.set(yy, []);
        oc.get(yy)!.push([x, OUTLINE]);
      }
      runs(oc, line, lines);
      runs(fc, fill, fills);
      this.parts.set(name, { fill, line });
    }
    this.sprite = scene.add.container(x, y, [...lines, ...fills]);
    // Sorted by where the feet are, from the first frame: a flat 50 here meant
    // a player who had not moved yet sorted against the room as if they were
    // standing at its top edge.
    this.sprite.setDepth(depthFor(y));
    this.pose(0, 0);
    const tick = (_t: number, dt: number) => this.idle(dt);
    scene.events.on('update', tick);
    this.sprite.once('destroy', () => scene.events.off('update', tick));
  }

  /** Places every part: `swing` -1..1 through the stride, `bob` 0 or 1 up. */
  private pose(swing: number, bob: number): void {
    const s = Math.round(swing);
    const lift = Math.abs(swing) < 0.5 ? 0 : 1;
    const off: Record<PartName, [number, number]> = {
      head: [0, -bob],
      eyes: [0, -bob],
      torso: [0, -bob],
      backArm: [s, -bob],
      frontArm: [-s, -bob],
      backLeg: [-s, swing < 0 ? -lift : 0],
      frontLeg: [s, swing > 0 ? -lift : 0],
    };
    for (const [name, p] of this.parts) {
      const [ox, oy] = off[name];
      for (const run of [...p.fill, ...p.line]) run.r.setPosition((run.cx + ox) * this.dir, run.cy + oy);
    }
  }

  /** Blinks now and then, whatever else is happening. */
  private idle(dt: number): void {
    if (!this.sprite.active) return;
    this.blinkT -= dt / 1000;
    const eyes = this.parts.get('eyes');
    if (!eyes) return;
    const shut = this.blinkT < 0;
    for (const run of eyes.fill) run.r.setVisible(!shut);
    if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3;
  }

  setSurface(s: Surface): void {
    this.surface = s;
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    // Being put somewhere is being somewhere: the depth has to follow, or a
    // player placed behind a fixture keeps the sorting of wherever they were.
    this.sprite.setDepth(depthFor(y));
  }

  /** Returns true if the player actually moved this frame. */
  move(dx: number, dy: number, delta: number, bounds: Phaser.Geom.Rectangle): boolean {
    const len = Math.hypot(dx, dy);
    if (len === 0) {
      this.bobT = 0;
      this.pose(0, 0);
      return false;
    }
    if (Math.abs(dx) > 0.01) this.dir = dx > 0 ? 1 : -1;
    const sprinting = this.shift?.isDown ?? false;
    const step = (PLAYER_SPEED * (sprinting ? SPRINT_MUL : 1) * delta) / 1000;
    const nx = this.sprite.x + (dx / len) * step;
    const ny = this.sprite.y + (dy / len) * step;
    this.sprite.x = Phaser.Math.Clamp(nx, bounds.x, bounds.right);
    this.sprite.y = Phaser.Math.Clamp(ny, bounds.y, bounds.bottom);
    this.sprite.setDepth(depthFor(this.sprite.y));

    // The stride: legs scissor, arms swing against them, the body rises on
    // each passing step.  One full stride is two footsteps.
    this.bobT += delta * (sprinting ? SPRINT_MUL : 1);
    const ph = (this.bobT / (STEP_INTERVAL_MS * 2)) * Math.PI * 2;
    this.pose(Math.sin(ph) * 1.4, Math.abs(Math.cos(ph)) > 0.7 ? 1 : 0);

    this.stepTimer += delta * (sprinting ? SPRINT_MUL : 1);
    if (this.stepTimer >= STEP_INTERVAL_MS) {
      this.stepTimer = 0;
      audio.sfx(FLOOR_SFX[this.surface]);
    }
    return true;
  }
}
