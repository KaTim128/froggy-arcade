/**
 * ---- OVER THE ROOFS.
 *
 * Out of the broken window of 612 with the police in the street below: a
 * minute of running, flat out, across the tops of the buildings -- jumps
 * across alleys, up onto the next roof and down the ladder off the side of
 * it, along planks somebody left bridging the gaps -- with officers on the
 * roofs behind you and a helicopter's searchlight sweeping the tops of them.
 *
 *   THE POLICE ON FOOT run the exact line you ran, a couple of seconds
 *   behind.  Keep moving and they stay there; hesitate and they gain, the red
 *   and blue of their lights swelling up behind you.  A hand on your collar
 *   and it is back to the last checkpoint.
 *
 *   THE HELICOPTER sweeps its light over the roofs.  Stood behind a chimney,
 *   an air-conditioning unit or a water tank, it goes over you; caught in the
 *   open, a net comes down out of the dark.
 *
 *   A FALL too far, or into the street, is the same: they have you.
 *
 * The last roof ends over the alley, and in the alley is a skip full of
 * rubbish bags.  Into it, and they have lost you.
 */

import Phaser from 'phaser';
import { audio, SILENCE } from '../core/audio';
import { store } from '../core/state';
import { finishFigure } from '../art/surface';
import { KEYS } from '../core/input';
import { centerText } from '../core/ui';
import { isTouch } from '../core/device';
import { PALETTE } from '../render/palette';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { froggyLayer } from '../render/froggyLayer';

// ---------------------------------------------------------------- the level

const STREET = 182;
const WORLD_W = 3720;

interface Roof {
  x: number;
  w: number;
  y: number;
  /** A plank is a bridge: thin, no building under it. */
  plank?: boolean;
  /** Brick colour of the building, and its lit-window share. */
  tone?: number;
}

const ROOFS: Roof[] = [
  // the hotel, out of the window and onto its ledge
  { x: -40, w: 190, y: 110, tone: 0 },
  { x: 190, w: 230, y: 118, tone: 1 },
  { x: 456, w: 144, y: 104, tone: 2 },
  { x: 596, w: 108, y: 106, plank: true },
  { x: 700, w: 182, y: 104, tone: 3 },
  // the fire escape off the side of the tall one
  { x: 880, w: 74, y: 152, plank: true },
  { x: 990, w: 260, y: 146, tone: 1 },
  { x: 1290, w: 212, y: 132, tone: 2 },
  { x: 1498, w: 106, y: 134, plank: true },
  { x: 1600, w: 222, y: 120, tone: 0 },
  { x: 1842, w: 208, y: 122, tone: 3 },
  { x: 2090, w: 156, y: 100, tone: 1 },
  { x: 2240, w: 82, y: 150, plank: true },
  { x: 2318, w: 126, y: 151, plank: true },
  { x: 2440, w: 212, y: 136, tone: 2 },
  { x: 2694, w: 214, y: 136, tone: 0 },
  { x: 2948, w: 202, y: 120, tone: 3 },
  { x: 3146, w: 118, y: 122, plank: true },
  { x: 3260, w: 240, y: 110, tone: 1 },
];

/** Ladders bolted to the side of a building: x, top, bottom. */
const LADDERS = [
  { x: 884, top: 104, bottom: 152 },
  { x: 2244, top: 100, bottom: 150 },
];

/** Things to get behind when the light comes over: x, width, height, kind. */
type CoverKind = 'chimney' | 'ac' | 'tank' | 'vent';
const COVERS: Array<{ x: number; w: number; h: number; kind: CoverKind }> = [
  { x: 300, w: 14, h: 26, kind: 'chimney' },
  { x: 760, w: 20, h: 14, kind: 'ac' },
  { x: 1080, w: 20, h: 14, kind: 'ac' },
  { x: 1180, w: 14, h: 28, kind: 'chimney' },
  { x: 1392, w: 26, h: 34, kind: 'tank' },
  { x: 1690, w: 20, h: 14, kind: 'ac' },
  { x: 1780, w: 14, h: 26, kind: 'chimney' },
  { x: 1950, w: 12, h: 16, kind: 'vent' },
  { x: 2540, w: 20, h: 14, kind: 'ac' },
  { x: 2800, w: 26, h: 34, kind: 'tank' },
  { x: 3020, w: 14, h: 28, kind: 'chimney' },
  { x: 3100, w: 20, h: 14, kind: 'ac' },
  { x: 3360, w: 20, h: 14, kind: 'ac' },
  { x: 3440, w: 14, h: 26, kind: 'chimney' },
];

/** Where a capture puts you back: x, and the roof you stand on there. */
const CHECKPOINTS = [24, 1000, 1860, 2700];

/** Officers on your heels between these x. */
const CHASES: Array<[number, number]> = [
  [0, 990],
  [1840, 2700],
  [2900, 3500],
];
/** The searchlight, between these x. */
const HELIS: Array<[number, number]> = [
  [990, 1850],
  [2700, 3500],
];

/** The skip, in the alley at the end. */
const SKIP = { x: 3560, w: 86, top: 158 };

// ---------------------------------------------------------------- tuning

const GRAV = 720;
const JUMP_V = 262;
const RUN = 112;
const CLIMB = 74;
/** A fall longer than this, you do not get up from quickly enough. */
const FATAL_FALL = 96;
/** Seconds the police are behind you at full pelt. */
const POLICE_LEAD = 2.3;
/** How close (seconds) before the hand is on your collar. */
const POLICE_CATCH = 0.3;
/** Seconds in the light before the net comes. */
const SPOT_HOLD = 0.45;

type State = 'intro' | 'run' | 'caught' | 'end';

export class RooftopEscape extends Phaser.Scene {
  private state: State = 'intro';
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private px = 24;
  private py = 110;
  private vx = 0;
  private vy = 0;
  private onGround = true;
  private climbing: (typeof LADDERS)[number] | null = null;
  private fallFrom = 110;
  private coyote = 0;
  private jumpBuf = 0;
  private face = 1;
  private runT = 0;
  private checkpoint = 0;
  private clock = 0;

  // the runner
  private runner!: Phaser.GameObjects.Container;
  private legL!: Phaser.GameObjects.Rectangle;
  private legR!: Phaser.GameObjects.Rectangle;
  private armL!: Phaser.GameObjects.Rectangle;
  private armR!: Phaser.GameObjects.Rectangle;
  private torso!: Phaser.GameObjects.Rectangle;

  // the police on foot
  private trail: Array<{ t: number; x: number; y: number }> = [];
  private lead = POLICE_LEAD;
  private cops: Phaser.GameObjects.Container[] = [];
  private copGlow!: Phaser.GameObjects.Image;
  private copTint!: Phaser.GameObjects.Rectangle;
  private chasing = false;

  // the helicopter
  private heli!: Phaser.GameObjects.Container;
  private rotor!: Phaser.GameObjects.Rectangle;
  private beam!: Phaser.GameObjects.Graphics;
  private spot!: Phaser.GameObjects.Image;
  private spotX = 0;
  private heliX = 0;
  private lit = 0;
  private heliOn = false;
  private heliT = 0;
  private sirenT = 0;

  private net: Phaser.GameObjects.Graphics | null = null;
  private say!: Phaser.GameObjects.BitmapText;
  private sayPlate!: Phaser.GameObjects.Rectangle;
  private sayUntil = 0;
  private hint!: Phaser.GameObjects.BitmapText;
  private black!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('RooftopEscape');
  }

  create(): void {
    froggyLayer.clear();
    this.state = 'intro';
    this.checkpoint = 0;
    this.clock = 0;
    this.trail = [];
    this.cops = [];
    this.net = null;
    audio.setScene(SILENCE);
    const kb = this.input.keyboard;
    const bind = (n: readonly string[]) => (kb ? n.map((k) => kb.addKey(k)) : []);
    this.keys = { left: bind(KEYS.left), right: bind(KEYS.right), up: bind(KEYS.up), down: bind(KEYS.down), jump: bind(['SPACE']) };
    for (const k of [...this.keys.up, ...this.keys.jump]) k.on('down', () => (this.jumpBuf = 0.14));

    this.cameras.main.setBounds(0, 0, WORLD_W, GAME_H);
    this.paintSky();
    this.paintSkyline();
    this.paintHotel();
    for (const r of ROOFS) this.paintRoof(r);
    for (const l of LADDERS) this.paintLadder(l);
    for (const c of COVERS) this.paintCover(c);
    this.paintSkip();
    this.makeRunner();
    this.makePolice();
    this.makeHeli();

    this.sayPlate = this.add.rectangle(0, 0, 1, 1, PALETTE.black, 0.72).setOrigin(0, 0).setScrollFactor(0).setDepth(900).setVisible(false);
    this.say = centerText(this, GAME_W / 2, GAME_H - 22, '', PALETTE.cream).setScrollFactor(0).setDepth(901).setVisible(false).setMaxWidth(290);
    this.hint = centerText(this, GAME_W / 2, 14, '', PALETTE.gold).setScrollFactor(0).setDepth(901).setAlpha(0);
    this.black = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(950);

    this.respawn(0);
    // in from black, out of the window
    this.tweens.add({ targets: this.black, alpha: 0, duration: 900 });
    audio.sfx('siren', 0.6);
    this.line('Out onto the ledge. Six floors up.', 2.4);
    this.time.delayedCall(2400, () => {
      audio.sfx('megaphone', 0.8);
      this.line('POLICE: "On the roof! He\'s on the roof!"', 2.2, true);
      this.state = 'run';
      this.chasing = true;
      this.showHint(isTouch() ? 'STICK TO RUN  -  JUMP TO JUMP  -  UP/DOWN ON LADDERS' : 'A/D RUN  -  W/SPACE JUMP  -  W/S ON LADDERS', 4.5);
    });
  }

  // ------------------------------------------------------------- painting

  private tex(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): string {
    if (!this.textures.exists(key)) {
      const t = this.textures.createCanvas(key, w, h);
      if (t) {
        paint(t.getContext());
        t.refresh();
      }
    }
    return key;
  }

  private paintSky(): void {
    const key = this.tex('rt_sky', GAME_W, GAME_H, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, GAME_H);
      gr.addColorStop(0, '#05070f');
      gr.addColorStop(0.55, '#0d1428');
      gr.addColorStop(1, '#2a1f3a');
      g.fillStyle = gr;
      g.fillRect(0, 0, GAME_W, GAME_H);
      // the city's glow on the low cloud
      const gl = g.createRadialGradient(GAME_W / 2, GAME_H + 20, 10, GAME_W / 2, GAME_H + 20, 200);
      gl.addColorStop(0, 'rgba(160,90,70,0.35)');
      gl.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gl;
      g.fillRect(0, 0, GAME_W, GAME_H);
      let q = 7;
      const R = () => ((q = (q * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `rgba(230,236,255,${0.25 + R() * 0.6})`;
        g.fillRect(Math.floor(R() * GAME_W), Math.floor(R() * 90), 1, 1);
      }
      // the moon, low and hazy
      const m = g.createRadialGradient(262, 30, 2, 262, 30, 26);
      m.addColorStop(0, 'rgba(255,250,230,0.5)');
      m.addColorStop(1, 'rgba(255,250,230,0)');
      g.fillStyle = m;
      g.fillRect(230, 0, 64, 60);
      g.fillStyle = '#f2ead2';
      g.beginPath();
      g.arc(262, 30, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(160,150,130,0.6)';
      g.fillRect(259, 27, 3, 2);
      g.fillRect(264, 32, 2, 2);
    });
    this.add.image(0, 0, key).setOrigin(0, 0).setScrollFactor(0).setDepth(-20);
  }

  /** Two layers of the city behind, slower than the roofs: distance. */
  private paintSkyline(): void {
    const layer = (key: string, w: number, top: number, col: string, lit: number, seed: number) =>
      this.tex(key, w, GAME_H, (g) => {
        let q = seed;
        const R = () => ((q = (q * 16807) % 2147483647) / 2147483647);
        let x = 0;
        while (x < w) {
          const bw = 18 + Math.floor(R() * 40);
          const bh = top + Math.floor(R() * 50);
          g.fillStyle = col;
          g.fillRect(x, GAME_H - bh, bw, bh);
          if (R() < 0.3) g.fillRect(x + bw / 2 - 1, GAME_H - bh - 10, 2, 10); // an aerial
          for (let wy = GAME_H - bh + 4; wy < GAME_H - 6; wy += 6) {
            for (let wx = x + 3; wx < x + bw - 3; wx += 5) {
              if (R() < lit) {
                g.fillStyle = R() < 0.75 ? 'rgba(255,200,120,0.75)' : 'rgba(150,190,255,0.6)';
                g.fillRect(wx, wy, 2, 2);
              }
            }
          }
          x += bw + Math.floor(R() * 4);
        }
      });
    this.add.tileSprite(0, 0, GAME_W, GAME_H, layer('rt_far', 640, 60, '#0b1020', 0.08, 11)).setOrigin(0, 0).setScrollFactor(0).setDepth(-15).setData('par', 0.12);
    this.add.tileSprite(0, 0, GAME_W, GAME_H, layer('rt_mid', 640, 40, '#121626', 0.12, 29)).setOrigin(0, 0).setScrollFactor(0).setDepth(-12).setData('par', 0.3);
  }

  /** The Grand Lily's flank at the start: the broken window you came out of. */
  private paintHotel(): void {
    const g = this.add.graphics().setDepth(-2);
    g.fillStyle(0x3a2a2c, 1).fillRect(-40, 20, 70, 92);
    g.fillStyle(0x2a1e20, 1);
    for (let y = 24; y < 110; y += 5) g.fillRect(-40, y, 70, 1);
    // window 612, out of its frame
    g.fillStyle(0x1a1410, 1).fillRect(-6, 58, 28, 34);
    g.fillStyle(0xffc070, 0.55).fillRect(-4, 60, 24, 30);
    g.fillStyle(0xdfeaf2, 0.8);
    for (const [x, y, w, h] of [[-4, 60, 5, 7], [14, 60, 6, 4], [-4, 82, 3, 8], [17, 84, 3, 6]]) g.fillRect(x, y, w, h);
    // curtains blowing out of it
    g.fillStyle(0x6a1a28, 1).fillRect(20, 60, 4, 22);
  }

  private paintRoof(r: Roof): void {
    if (r.plank) {
      const g = this.add.graphics().setDepth(2);
      // a scaffold board: grain, nail heads, a little sag in the middle
      for (let x = 0; x < r.w; x++) {
        const sag = Math.sin((x / r.w) * Math.PI) * 1.2;
        g.fillStyle(0x7a5430, 1).fillRect(r.x + x, r.y + sag, 1, 3);
        g.fillStyle(x % 9 === 0 ? 0x4a3018 : 0x9a6a3a, 0.6).fillRect(r.x + x, r.y + sag, 1, 1);
      }
      g.fillStyle(0x2a1a0c, 1).fillRect(r.x + 2, r.y + 3, 2, 1).fillRect(r.x + r.w - 4, r.y + 3, 2, 1);
      // the fire escape's grille and posts, where it is one
      if (r.w < 90) {
        g.fillStyle(0x2a2e34, 1).fillRect(r.x, r.y + 3, r.w, 2);
        for (let x = r.x; x < r.x + r.w; x += 6) g.fillRect(x, r.y - 8, 1, 8);
        g.fillRect(r.x, r.y - 9, r.w, 1);
      }
      return;
    }
    const tones = [
      ['#4a3434', '#3a2626'],
      ['#3e3a44', '#2e2a34'],
      ['#4a4034', '#3a3026'],
      ['#34404a', '#26303a'],
    ][r.tone ?? 0];
    const h = GAME_H - r.y + 4;
    const key = this.tex(`rt_bld_${r.x}`, r.w, h, (g) => {
      g.fillStyle = tones[0];
      g.fillRect(0, 0, r.w, h);
      // brick courses
      g.fillStyle = tones[1];
      for (let y = 6; y < h; y += 4) {
        g.fillRect(0, y, r.w, 1);
        for (let x = (y / 4) % 2 ? 3 : 0; x < r.w; x += 8) g.fillRect(x, y - 3, 1, 3);
      }
      // grime down from the parapet
      const gr = g.createLinearGradient(0, 0, 0, 30);
      gr.addColorStop(0, 'rgba(0,0,0,0.35)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, r.w, 30);
      // windows, a few lit
      let q = r.x + 3;
      const R = () => ((q = (q * 16807) % 2147483647) / 2147483647);
      for (let y = 14; y < h - 6; y += 16) {
        for (let x = 8; x < r.w - 10; x += 18) {
          const lit = R() < 0.22;
          g.fillStyle = '#14100c';
          g.fillRect(x - 1, y - 1, 10, 11);
          g.fillStyle = lit ? (R() < 0.8 ? '#e8b060' : '#8ab0e8') : '#1c2230';
          g.fillRect(x, y, 8, 9);
          g.fillStyle = 'rgba(0,0,0,0.5)';
          g.fillRect(x + 4, y, 1, 9);
          g.fillRect(x, y + 4, 8, 1);
          g.fillStyle = '#5a5048';
          g.fillRect(x - 1, y + 10, 10, 1);
        }
      }
      // the parapet coping, catching the moon
      g.fillStyle = '#6a6460';
      g.fillRect(0, 0, r.w, 3);
      g.fillStyle = '#9a948a';
      g.fillRect(0, 0, r.w, 1);
    });
    this.add.image(r.x, r.y, key).setOrigin(0, 0).setDepth(1);
    // the roof's own clutter: a gravel line, an aerial now and then
    const d = this.add.graphics().setDepth(1);
    d.fillStyle(0x2a2624, 1).fillRect(r.x + 2, r.y - 1, r.w - 4, 1);
    if (r.w > 180) {
      d.fillStyle(0x5a5a62, 1).fillRect(r.x + r.w - 30, r.y - 22, 1, 22);
      d.fillRect(r.x + r.w - 36, r.y - 18, 13, 1);
      d.fillRect(r.x + r.w - 34, r.y - 14, 9, 1);
      d.fillStyle(0xff3030, 1).fillRect(r.x + r.w - 30, r.y - 23, 1, 1);
    }
  }

  private paintLadder(l: (typeof LADDERS)[number]): void {
    const g = this.add.graphics().setDepth(3);
    g.fillStyle(0x6a707a, 1).fillRect(l.x - 5, l.top - 8, 1, l.bottom - l.top + 8);
    g.fillRect(l.x + 4, l.top - 8, 1, l.bottom - l.top + 8);
    for (let y = l.top - 6; y < l.bottom; y += 5) g.fillRect(l.x - 5, y, 10, 1);
    g.fillStyle(0x9aa0aa, 0.6).fillRect(l.x - 5, l.top - 8, 1, 4);
  }

  private paintCover(c: (typeof COVERS)[number]): void {
    const roof = this.roofAt(c.x + c.w / 2);
    if (!roof) return;
    const y = roof.y;
    const g = this.add.graphics().setDepth(4);
    const x = c.x;
    if (c.kind === 'chimney') {
      g.fillStyle(0x5a2e24, 1).fillRect(x, y - c.h, c.w, c.h);
      g.fillStyle(0x3a1e18, 1);
      for (let yy = y - c.h + 4; yy < y; yy += 4) g.fillRect(x, yy, c.w, 1);
      g.fillStyle(0x6a6460, 1).fillRect(x - 1, y - c.h - 2, c.w + 2, 3);
      g.fillStyle(0x2a2624, 1).fillRect(x + 3, y - c.h - 6, 3, 4).fillRect(x + c.w - 6, y - c.h - 5, 3, 3);
    } else if (c.kind === 'ac') {
      g.fillStyle(0x8a8e94, 1).fillRect(x, y - c.h, c.w, c.h);
      g.fillStyle(0x5a5e64, 1).fillRect(x + 1, y - c.h + 1, c.w - 2, 1);
      for (let yy = y - c.h + 3; yy < y - 1; yy += 2) g.fillRect(x + 2, yy, c.w - 9, 1);
      g.fillStyle(0x2a2e34, 1).fillCircle(x + c.w - 4, y - c.h / 2, 3);
    } else if (c.kind === 'tank') {
      g.fillStyle(0x3a2e24, 1).fillRect(x + 2, y - 10, 2, 10).fillRect(x + c.w - 4, y - 10, 2, 10);
      g.fillStyle(0x6a4a30, 1).fillRect(x, y - c.h, c.w, c.h - 10);
      g.fillStyle(0x4a3220, 1);
      for (let yy = y - c.h + 4; yy < y - 10; yy += 6) g.fillRect(x, yy, c.w, 1);
      g.fillStyle(0x5a4030, 1).fillTriangle(x - 1, y - c.h, x + c.w + 1, y - c.h, x + c.w / 2, y - c.h - 7);
    } else {
      g.fillStyle(0x6a6e74, 1).fillRect(x, y - c.h, c.w, c.h);
      g.fillStyle(0x3a3e44, 1).fillRect(x - 2, y - c.h - 2, c.w + 4, 3);
    }
  }

  private paintSkip(): void {
    const g = this.add.graphics().setDepth(5);
    const { x, w, top } = SKIP;
    // the alley floor under it, wet
    g.fillStyle(0x16161c, 1).fillRect(x - 60, STREET - 6, w + 140, 10);
    g.fillStyle(0x2a3a4a, 0.4).fillRect(x - 20, STREET - 5, 40, 1);
    // the skip: sloped steel sides, the lip, the rubbish heaped over it
    g.fillStyle(0x2f5a34, 1).fillRect(x, top + 4, w, STREET - 6 - top - 4);
    g.fillStyle(0x1e3e22, 1);
    for (let k = x + 6; k < x + w; k += 12) g.fillRect(k, top + 6, 2, STREET - 12 - top);
    g.fillStyle(0x4a7a4e, 1).fillRect(x - 2, top + 2, w + 4, 3);
    g.fillStyle(0xd8c040, 1).fillRect(x + w / 2 - 12, top + 12, 24, 5);
    for (const [bx, by, r, col] of [
      [x + 12, top + 1, 9, 0x141414],
      [x + 30, top - 2, 11, 0x1c1c22],
      [x + 50, top, 10, 0x22201a],
      [x + 70, top + 1, 9, 0x141418],
      [x + 40, top - 6, 7, 0x2a3a5a],
    ] as const) {
      g.fillStyle(col, 1).fillCircle(bx, by, r);
      g.fillStyle(0xffffff, 0.12).fillCircle(bx - r / 3, by - r / 3, r / 3);
    }
    g.fillStyle(0x8a6a40, 1).fillRect(x + 58, top - 8, 14, 6);
  }

  private makeRunner(): void {
    this.legL = this.add.rectangle(-2, -8, 4, 8, PALETTE.rust).setOrigin(0.5, 0);
    this.legR = this.add.rectangle(2, -8, 4, 8, PALETTE.rust).setOrigin(0.5, 0);
    this.armL = this.add.rectangle(-5, -19, 3, 9, PALETTE.brown).setOrigin(0.5, 0);
    this.armR = this.add.rectangle(5, -19, 3, 9, PALETTE.brown).setOrigin(0.5, 0);
    this.torso = this.add.rectangle(0, -8, 10, 12, PALETTE.brownLight).setOrigin(0.5, 1);
    const head = this.add.rectangle(0, -20, 7, 7, PALETTE.cream).setOrigin(0.5, 1);
    const hood = this.add.rectangle(0, -22, 9, 5, PALETTE.brown).setOrigin(0.5, 1);
    this.runner = this.add.container(0, 0, [this.armL, this.legL, this.legR, this.torso, head, hood, this.armR]).setDepth(10);
  }

  private makeCop(): Phaser.GameObjects.Container {
    const legs = this.add.rectangle(0, 0, 9, 8, 0x14182a).setOrigin(0.5, 1);
    const body = this.add.rectangle(0, -8, 11, 12, 0x1e2a4a).setOrigin(0.5, 1);
    const badge = this.add.rectangle(2, -16, 2, 2, 0xe8c040);
    const head = this.add.rectangle(0, -20, 7, 7, 0xd8b090).setOrigin(0.5, 1);
    const cap = this.add.rectangle(0, -25, 9, 3, 0x0c1020).setOrigin(0.5, 1);
    const peak = this.add.rectangle(3, -24, 4, 1, 0x0c1020).setOrigin(0, 1);
    const torch = this.add.rectangle(7, -14, 4, 2, 0xd8d8d0);
    const cop = this.add.container(-100, 0, [legs, body, head, cap, peak]).setDepth(9);
    // the same outline and shading as the drifter he is chasing
    finishFigure(this, cop, { seed: 47 });
    cop.add([badge, torch]);
    return cop;
  }

  private makePolice(): void {
    this.cops = [this.makeCop(), this.makeCop()];
    const key = this.tex('rt_glow', 128, 128, (g) => {
      const r = g.createRadialGradient(64, 64, 2, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.4, 'rgba(255,255,255,0.4)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 128, 128);
    });
    this.copGlow = this.add.image(0, 120, key).setScale(1.6, 1.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(8).setAlpha(0);
    this.copTint = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xff0000, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(880).setBlendMode(Phaser.BlendModes.ADD);
  }

  private makeHeli(): void {
    const body = this.add.graphics();
    body.fillStyle(0x0e1018, 1).fillEllipse(0, 0, 30, 12);
    body.fillRect(10, -2, 26, 3);
    body.fillRect(33, -6, 3, 8);
    body.fillStyle(0x3a4a6a, 1).fillEllipse(-8, -1, 10, 7);
    body.fillStyle(0x0e1018, 1).fillRect(-8, 6, 18, 1).fillRect(-6, 4, 1, 3).fillRect(6, 4, 1, 3);
    this.rotor = this.add.rectangle(0, -8, 44, 1, 0x2a2e38);
    const mast = this.add.rectangle(0, -6, 2, 3, 0x0e1018);
    const blink = this.add.rectangle(36, -6, 2, 2, 0xff3030).setName('blink');
    const lamp = this.add.rectangle(-4, 6, 4, 2, 0xfff4d0);
    this.heli = this.add.container(0, 26, [this.rotor, mast, body, blink, lamp]).setDepth(30).setVisible(false);
    this.beam = this.add.graphics().setDepth(29).setBlendMode(Phaser.BlendModes.ADD);
    this.spot = this.add.image(0, 0, 'rt_glow').setScale(0.42, 0.16).setBlendMode(Phaser.BlendModes.ADD).setDepth(29).setTint(0xfff4d0).setVisible(false);
  }

  // ------------------------------------------------------------- the level

  private roofAt(x: number): Roof | null {
    let best: Roof | null = null;
    for (const r of ROOFS) if (x >= r.x && x <= r.x + r.w && (!best || r.y < best.y)) best = r;
    return best;
  }

  private inZone(zones: Array<[number, number]>, x: number): boolean {
    return zones.some(([a, b]) => x >= a && x <= b);
  }

  private covered(): boolean {
    if (!this.onGround) return false;
    return COVERS.some((c) => this.px > c.x - 3 && this.px < c.x + c.w + 3);
  }

  // ------------------------------------------------------------- the loop

  update(_t: number, delta: number): void {
    const dt = Math.min(delta / 1000, 1 / 30);
    this.clock += dt;
    // the city behind moves slower than the roofs
    const cam = this.cameras.main;
    for (const o of this.children.list) {
      const par = o.getData?.('par') as number | undefined;
      if (par && o instanceof Phaser.GameObjects.TileSprite) o.tilePositionX = cam.scrollX * par;
    }
    if (this.say.visible && this.clock > this.sayUntil) {
      this.say.setVisible(false);
      this.sayPlate.setVisible(false);
    }
    if (this.state === 'run') this.step(dt);
    this.drawRunner(dt);
    this.tickPolice(dt);
    this.tickHeli(dt);
    cam.scrollX = Phaser.Math.Clamp(this.px - 120, 0, WORLD_W - GAME_W);
  }

  private down(name: string): boolean {
    return this.keys[name]?.some((k) => k.isDown) ?? false;
  }

  private step(dt: number): void {
    const dx = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    const up = this.down('up');
    const dn = this.down('down');
    this.jumpBuf -= dt;
    this.coyote -= dt;
    if (dx) this.face = dx;

    // ---- on a ladder
    if (this.climbing) {
      const l = this.climbing;
      this.px = l.x;
      this.vy = (dn ? CLIMB : 0) - (up ? CLIMB : 0);
      this.py += this.vy * dt;
      if (this.vy && Math.floor(this.clock * 6) !== Math.floor((this.clock - dt) * 6)) audio.sfx('step_walk', 0.25);
      if (this.py >= l.bottom) {
        this.py = l.bottom;
        this.climbing = null;
        this.onGround = true;
        this.fallFrom = this.py;
      } else if (this.py <= l.top) {
        this.py = l.top;
        this.climbing = null;
        this.onGround = true;
        this.fallFrom = this.py;
      } else if (this.jumpBuf > 0 && dx) {
        // off the side of it
        this.climbing = null;
        this.vy = -JUMP_V * 0.6;
        this.vx = dx * RUN;
        this.jumpBuf = 0;
        this.fallFrom = this.py;
      }
      this.trailPush();
      return;
    }
    // onto a ladder: up at its foot, or down at its head
    for (const l of LADDERS) {
      if (Math.abs(this.px - l.x) < 7 && this.onGround) {
        if (dn && Math.abs(this.py - l.top) < 2) {
          this.climbing = l;
          this.py = l.top + 1;
          this.jumpBuf = 0;
          return;
        }
        if (up && Math.abs(this.py - l.bottom) < 2) {
          this.climbing = l;
          this.py = l.bottom - 1;
          this.jumpBuf = 0;
          return;
        }
      }
    }

    // ---- running and jumping
    const want = dx * RUN;
    const accel = this.onGround ? 900 : 520;
    this.vx = want > this.vx ? Math.min(want, this.vx + accel * dt) : Math.max(want, this.vx - accel * dt);
    if (this.onGround) this.coyote = 0.1;
    const nearLadderHead = LADDERS.some((l) => Math.abs(this.px - l.x) < 7 && Math.abs(this.py - l.top) < 2);
    if (this.jumpBuf > 0 && this.coyote > 0 && !(up && nearLadderHead && !this.down('jump'))) {
      this.vy = -JUMP_V;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuf = 0;
      this.fallFrom = this.py;
      audio.sfx('throw_whoosh', 0.25);
    }
    // a short hop if the jump is let go early
    if (!this.onGround && this.vy < -80 && !up && !this.down('jump')) this.vy += GRAV * 1.6 * dt;
    this.vy += GRAV * dt;

    const ox = this.px;
    const oy = this.py;
    this.px += this.vx * dt;
    this.py += this.vy * dt;

    // the side of a taller building is a wall
    for (const r of ROOFS) {
      if (r.plank) continue;
      if (this.py > r.y + 2 && this.py - 22 < GAME_H) {
        if (ox <= r.x - 4 && this.px > r.x - 4) this.px = r.x - 4;
        if (ox >= r.x + r.w + 4 && this.px < r.x + r.w + 4) this.px = r.x + r.w + 4;
      }
    }
    this.px = Math.max(-30, this.px);

    // landing: one-way, from above
    const was = this.onGround;
    this.onGround = false;
    if (this.vy >= 0) {
      for (const r of ROOFS) {
        if (this.px < r.x - 3 || this.px > r.x + r.w + 3) continue;
        const top = r.plank ? r.y + Math.sin(((this.px - r.x) / r.w) * Math.PI) * 1.2 : r.y;
        if (oy <= top + 1 && this.py >= top) {
          this.py = top;
          this.vy = 0;
          this.onGround = true;
          if (!was) {
            const fell = this.py - this.fallFrom;
            if (fell > FATAL_FALL) return this.capture('fall');
            audio.sfx(r.plank ? 'item_thud' : 'step_run', fell > 30 ? 0.6 : 0.35);
          }
          break;
        }
      }
    }
    if (this.onGround) this.fallFrom = this.py;
    else if (was && this.vy >= 0) this.fallFrom = this.py;

    // footsteps
    if (this.onGround && Math.abs(this.vx) > 20) {
      this.runT += dt * Math.abs(this.vx) / 22;
      if (Math.floor(this.runT) !== Math.floor(this.runT - dt * Math.abs(this.vx) / 22)) audio.sfx('step_run', 0.22);
    }

    // into the skip: away
    if (this.px > SKIP.x + 6 && this.px < SKIP.x + SKIP.w - 6 && this.py >= SKIP.top - 2) return this.landInSkip();
    // into the street
    if (this.py > STREET) return this.capture('fall');

    // checkpoints
    for (let i = CHECKPOINTS.length - 1; i > this.checkpoint; i--) {
      if (this.px >= CHECKPOINTS[i] && this.onGround) {
        this.checkpoint = i;
        this.showHint('CHECKPOINT', 1.4);
        audio.sfx('zone_clear', 0.4);
        break;
      }
    }
    this.trailPush();
  }

  private trailPush(): void {
    this.trail.push({ t: this.clock, x: this.px, y: this.py });
    while (this.trail.length > 600) this.trail.shift();
  }

  private drawRunner(dt: number): void {
    this.runner.setPosition(Math.round(this.px), Math.round(this.py));
    this.runner.setScale(this.face, 1);
    if (this.climbing) {
      const k = Math.sin(this.py * 0.6);
      this.legL.setAngle(0).setY(-8 + k * 2);
      this.legR.setAngle(0).setY(-8 - k * 2);
      this.armL.setAngle(180).setY(-19 - k * 2);
      this.armR.setAngle(180).setY(-19 + k * 2);
      return;
    }
    this.legL.setY(-8);
    this.legR.setY(-8);
    this.armL.setY(-19);
    this.armR.setY(-19);
    if (!this.onGround) {
      // tucked in the air, arms up and forward
      this.legL.setAngle(-40);
      this.legR.setAngle(30);
      this.armL.setAngle(-130);
      this.armR.setAngle(-100);
      this.torso.setAngle(8);
      return;
    }
    const sp = Math.abs(this.vx) / RUN;
    const sw = Math.sin(this.runT * Math.PI) * 50 * sp;
    this.legL.setAngle(sw);
    this.legR.setAngle(-sw);
    this.armL.setAngle(-sw * 0.9);
    this.armR.setAngle(sw * 0.9);
    this.torso.setAngle(sp * 10);
    void dt;
  }

  // ------------------------------------------------------------- the police

  private tickPolice(dt: number): void {
    const active = this.state === 'run' && this.chasing && this.inZone(CHASES, this.px);
    this.sirenT -= dt;
    if (this.state === 'run' && this.sirenT <= 0) {
      this.sirenT = 2.1;
      audio.sfx('siren', active ? 0.45 : 0.18);
    }
    if (!active) {
      for (const c of this.cops) c.setVisible(false);
      this.copGlow.setAlpha(0);
      this.copTint.setFillStyle(0xff0000, 0);
      this.lead = Math.min(POLICE_LEAD, this.lead + dt);
      return;
    }
    // they gain on you whenever you are not running flat out
    const sp = Math.abs(this.vx) + (this.climbing ? 60 : 0);
    if (sp < RUN * 0.7) this.lead -= dt * 0.55;
    else this.lead = Math.min(POLICE_LEAD, this.lead + dt * 0.18);
    this.lead -= dt * 0.03;
    const near = Phaser.Math.Clamp((POLICE_LEAD - this.lead) / (POLICE_LEAD - POLICE_CATCH), 0, 1);
    this.cops.forEach((c, i) => {
      const p = this.trailAt(this.clock - this.lead - i * 0.45);
      if (!p) {
        c.setVisible(false);
        return;
      }
      c.setVisible(true).setPosition(Math.round(p.x), Math.round(p.y));
      // the run: a bob
      c.y += Math.abs(Math.sin(this.clock * 12 + i)) * -1.5;
    });
    // their lights behind you, flashing, swelling as they close
    const ph = Math.floor(this.clock * 7) % 4;
    const col = ph < 2 ? 0xff2a3a : 0x2a5aff;
    const lead = this.cops[0];
    this.copGlow.setPosition(lead.x + 6, lead.y - 14).setTint(col).setAlpha((0.25 + near * 0.6) * (ph % 2 ? 0.6 : 1));
    this.copTint.setFillStyle(col, near * 0.12 * (ph % 2 ? 0.6 : 1));
    if (near > 0.6 && Math.floor(this.clock * 2) !== Math.floor((this.clock - dt) * 2)) audio.heartbeat(0.3 + near * 0.4);
    if (this.lead <= POLICE_CATCH) this.capture('cop');
  }

  private trailAt(t: number): { x: number; y: number } | null {
    if (!this.trail.length || t < this.trail[0].t) return null;
    let lo = 0;
    let hi = this.trail.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.trail[mid].t <= t) lo = mid;
      else hi = mid - 1;
    }
    return this.trail[lo];
  }

  // ------------------------------------------------------------- the helicopter

  private tickHeli(dt: number): void {
    const on = (this.state === 'run' || this.state === 'caught') && this.inZone(HELIS, this.px);
    if (on && !this.heliOn) {
      this.heliOn = true;
      this.heliX = this.px + 220;
      this.spotX = this.px + 160;
      this.lit = 0;
      this.line('A helicopter! Stay out of the light!', 2.6, true);
    }
    if (!on && this.heliOn && this.state === 'run') this.heliOn = false;
    this.heli.setVisible(this.heliOn);
    this.spot.setVisible(this.heliOn);
    this.beam.clear();
    if (!this.heliOn) return;
    this.heliT -= dt;
    if (this.heliT <= 0) {
      this.heliT = 1;
      audio.sfx('helicopter', 0.5);
    }
    // the machine hangs over the roofs ahead of you, drifting; the light
    // sweeps back and forth, and keeps coming back to wherever you are
    const wantHeli = this.px + 70 + Math.sin(this.clock * 0.4) * 60;
    this.heliX += (wantHeli - this.heliX) * Math.min(1, dt * 0.8);
    const sweep = Math.sin(this.clock * 1.15) * 95 + Math.sin(this.clock * 0.37) * 40;
    const wantSpot = this.px + sweep * 0.9;
    this.spotX += Phaser.Math.Clamp(wantSpot - this.spotX, -150 * dt, 150 * dt);
    this.heli.setPosition(this.heliX, 26 + Math.sin(this.clock * 1.7) * 2).setAngle(Math.sin(this.clock * 0.8) * 4);
    this.rotor.setScale(Math.abs(Math.sin(this.clock * 40)) * 0.9 + 0.1, 1);
    const blink = this.heli.getByName('blink') as Phaser.GameObjects.Rectangle;
    blink.setVisible(Math.sin(this.clock * 6) > 0.6);
    const roof = this.roofAt(this.spotX);
    const gy = roof ? roof.y : STREET;
    // the beam: a cone from the lamp to the roof
    const lx = this.heliX - 4;
    const ly = this.heli.y + 6;
    this.beam.fillStyle(0xfff4d0, 0.13);
    this.beam.fillTriangle(lx - 2, ly, lx + 2, ly, this.spotX + 22, gy);
    this.beam.fillTriangle(lx - 2, ly, this.spotX - 22, gy, this.spotX + 22, gy);
    this.beam.fillStyle(0xfff4d0, 0.08);
    this.beam.fillTriangle(lx, ly, this.spotX - 10, gy, this.spotX + 10, gy);
    this.spot.setPosition(this.spotX, gy - 2).setAlpha(0.85);
    if (this.state !== 'run') return;
    const inLight = Math.abs(this.px - this.spotX) < 18 && !this.covered();
    this.lit = inLight ? this.lit + dt : Math.max(0, this.lit - dt * 2);
    // caught in it: you flare white in the glare
    this.runner.setAlpha(inLight ? 0.55 + Math.abs(Math.sin(this.clock * 30)) * 0.45 : 1);
    if (this.lit > SPOT_HOLD) this.capture('net');
  }

  // ------------------------------------------------------------- caught / away

  private capture(how: 'fall' | 'cop' | 'net'): void {
    if (this.state !== 'run') return;
    this.state = 'caught';
    this.vx = 0;
    this.vy = 0;
    this.climbing = null;
    const msg = how === 'net' ? 'NETTED!' : how === 'cop' ? 'GRABBED!' : 'TOO FAR TO FALL...';
    if (how === 'net') {
      // the net, out of the dark, over you
      audio.sfx('net_drop', 1);
      audio.sfx('megaphone', 0.7);
      const g = this.add.graphics().setDepth(40);
      g.lineStyle(1, 0xc8c0a0, 0.95);
      for (let k = -20; k <= 20; k += 5) {
        g.lineBetween(k, -26, k * 0.55, 0);
      }
      for (let y = -26; y <= 0; y += 5) {
        const half = 20 - ((y + 26) / 26) * 9;
        g.lineBetween(-half, y, half, y);
      }
      g.fillStyle(0x6a6a6a, 1).fillCircle(-20, -26, 2).fillCircle(20, -26, 2).fillCircle(-11, 0, 2).fillCircle(11, 0, 2);
      g.setPosition(this.px, this.py - 120);
      this.tweens.add({ targets: g, y: this.py + 1, duration: 320, ease: 'Quad.easeIn', onComplete: () => this.cameras.main.shake(200, 0.012) });
      this.net = g;
      this.line('POLICE: "Got him!"', 1.8, true);
    } else if (how === 'cop') {
      audio.sfx('item_thud', 0.9);
      audio.sfx('megaphone', 0.6);
      this.cameras.main.shake(220, 0.014);
      this.line('POLICE: "Stop right there!"', 1.8, true);
    } else {
      audio.sfx('item_thud', 1);
      this.cameras.main.shake(260, 0.02);
    }
    this.showHint(msg, 1.6, 0xff5a5a);
    this.time.delayedCall(1400, () => {
      this.tweens.add({
        targets: this.black,
        alpha: 1,
        duration: 380,
        onComplete: () => {
          this.respawn(this.checkpoint);
          this.tweens.add({ targets: this.black, alpha: 0, duration: 420 });
          this.state = 'run';
        },
      });
    });
  }

  private respawn(i: number): void {
    const x = CHECKPOINTS[i];
    const r = this.roofAt(x);
    this.px = x;
    this.py = r ? r.y : 110;
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.climbing = null;
    this.fallFrom = this.py;
    this.face = 1;
    this.lead = POLICE_LEAD;
    this.lit = 0;
    this.heliOn = false;
    this.trail = [];
    this.net?.destroy();
    this.net = null;
    this.runner.setAlpha(1);
  }

  private landInSkip(): void {
    this.state = 'end';
    this.py = SKIP.top + 6;
    this.vx = 0;
    this.vy = 0;
    this.runner.setVisible(false);
    audio.sfx('bin_land', 1);
    this.cameras.main.shake(300, 0.02);
    // bags burst, rubbish everywhere
    for (let k = 0; k < 26; k++) {
      const bit = this.add
        .rectangle(this.px, SKIP.top, 2 + Math.random() * 3, 2 + Math.random() * 3, [0x1c1c22, 0x8a6a40, 0xd8d0c0, 0x2a3a5a][k % 4])
        .setDepth(12);
      this.tweens.add({
        targets: bit,
        x: this.px + (Math.random() - 0.5) * 70,
        y: SKIP.top - 20 - Math.random() * 30,
        duration: 300,
        ease: 'Quad.easeOut',
        yoyo: true,
        onComplete: () => bit.setY(SKIP.top + Math.random() * 4),
      });
    }
    for (const c of this.cops) c.setVisible(false);
    this.copGlow.setAlpha(0);
    this.copTint.setFillStyle(0, 0);
    this.heliOn = false;
    this.time.delayedCall(1600, () => {
      audio.sfx('siren', 0.25);
      this.line('...', 1.6);
    });
    // the sirens going past, further off, and slowly to black
    this.time.delayedCall(3200, () => {
      this.tweens.add({ targets: this.black, alpha: 1, duration: 3200, onComplete: () => this.epilogue() });
    });
  }

  /** On black: what came of it.  Then the morning, outside the arcade. */
  private epilogue(): void {
    const lines = ['You managed to escape.', "The police couldn't recover the hotel's video recordings.", 'But Froggy is still out there...'];
    const t = centerText(this, GAME_W / 2, GAME_H / 2, '', PALETTE.cream).setScrollFactor(0).setDepth(960).setMaxWidth(280).setAlpha(0);
    let i = 0;
    const next = () => {
      if (i >= lines.length) {
        this.input.off('pointerdown', next);
        this.input.keyboard?.off('keydown-SPACE', next);
        this.input.keyboard?.off('keydown-ENTER', next);
        this.tweens.add({ targets: t, alpha: 0, duration: 600, onComplete: () => this.finish() });
        return;
      }
      this.tweens.killTweensOf(t);
      t.setText(lines[i]).setTint(i === 2 ? 0xd06060 : PALETTE.cream).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 700 });
      i++;
      timer?.remove(false);
      timer = this.time.delayedCall(i === 3 ? 4200 : 3400, next);
    };
    let timer: Phaser.Time.TimerEvent | null = null;
    this.input.on('pointerdown', next);
    this.input.keyboard?.on('keydown-SPACE', next);
    this.input.keyboard?.on('keydown-ENTER', next);
    if (i === 0) audio.sfx('eerie_swell', 0.35);
    next();
  }

  private finish(): void {
    // the morning after, in front of the arcade, free to go on
    store.patch({ hotelAfter: 'escaped', timeOfDay: 'day', hotelNight: false, checkedIn: false });
    store.flush();
    this.scene.start('ExteriorDay', {});
  }

  // ------------------------------------------------------------- words

  private line(msg: string, dur: number, red = false): void {
    this.say.setText(msg).setTint(red ? 0xff5a5a : PALETTE.cream).setVisible(true);
    const b = this.say.getBounds();
    this.sayPlate.setPosition(b.x - 4, b.y - 3).setDisplaySize(b.width + 8, b.height + 6).setVisible(true);
    this.sayUntil = this.clock + dur;
  }

  private showHint(msg: string, dur: number, col: number = PALETTE.gold): void {
    this.tweens.killTweensOf(this.hint);
    this.hint.setText(msg).setTint(col).setAlpha(1);
    this.tweens.add({ targets: this.hint, alpha: 0, delay: dur * 1000, duration: 500 });
  }
}
