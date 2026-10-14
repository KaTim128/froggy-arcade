/**
 * ---- OVER THE ROOFS, AT MIDNIGHT.
 *
 * Out of the broken window of 612 and onto the roofs.  Nobody follows you up
 * here: what hunts you is the police helicopter, hanging over the block with
 * its searchlight going over the roof tops.
 *
 *   THE ROOFS have depth.  Left and right runs along them, up and down steps
 *   back towards the parapet or out towards the front edge -- and the front
 *   edge is a six-floor drop.  Between the buildings are gaps: run and jump
 *   them.  Short of the far roof, or off the front, and you fall.
 *
 *   THE SEARCHLIGHT is a real light from a real lamp.  Water tanks, crates,
 *   boxes and air-conditioning units are solid: the light does not go through
 *   them, and the shadow each one throws falls away from the helicopter,
 *   moving as it moves.  Stand in that shadow and the beam goes over you;
 *   caught in the open long enough, a net comes down out of the dark.
 *
 *   THE END.  On the last roof the helicopter swings round behind you, and
 *   there is nowhere left to hide.  At the edge: jump off the building.  What
 *   is down there you only find out on the way down.
 */

import Phaser from 'phaser';
import { audio, SILENCE } from '../core/audio';
import { store } from '../core/state';
import { KEYS } from '../core/input';
import { centerText } from '../core/ui';
import { isTouch } from '../core/device';
import { PALETTE } from '../render/palette';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { froggyLayer } from '../render/froggyLayer';
import { Player } from '../art/player';
import { backPlate } from '../ui/plate';

// ---------------------------------------------------------------- the level

/** How deep each roof is, back parapet to front edge, in screen pixels. */
const D = 30;
/** The world is taller than the screen: the alley is far below. */
const WORLD_H = 430;
const STREET = 418;

interface Roof {
  x: number;
  w: number;
  /** Screen y of the back edge of the roof surface. */
  y: number;
  tone: number;
}

/** Connected roofs, a gap between each.  No gap is wider than a running jump. */
const ROOFS: Roof[] = [
  { x: -60, w: 250, y: 108, tone: 0 }, // the hotel, out of the window
  { x: 228, w: 210, y: 116, tone: 1 },
  { x: 474, w: 190, y: 104, tone: 2 },
  { x: 704, w: 240, y: 112, tone: 3 },
  { x: 976, w: 230, y: 120, tone: 1 },
  { x: 1250, w: 260, y: 108, tone: 0 },
  { x: 1550, w: 210, y: 98, tone: 2 },
  { x: 1798, w: 260, y: 106, tone: 3 },
  { x: 2100, w: 240, y: 98, tone: 1 },
  { x: 2378, w: 300, y: 90, tone: 0 }, // the last roof, over the alley
];
const LAST = ROOFS[ROOFS.length - 1];
/** The edge you jump off at the end. */
const EDGE_X = LAST.x + LAST.w;
const WORLD_W = EDGE_X + 230;
/** Across the alley: a blind wall, so the alley is closed. */
const FAR_WALL = { x: EDGE_X + 120, y: 60 };

/** Cover: solid, and it throws a shadow. x/z are the near-left corner, z from the back edge. */
type CoverKind = 'tank' | 'crate' | 'box' | 'ac';
interface Cover {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  kind: CoverKind;
}
const SIZE: Record<CoverKind, [number, number, number]> = {
  tank: [22, 14, 34],
  crate: [14, 12, 13],
  box: [10, 8, 8],
  ac: [18, 10, 12],
};
const C = (x: number, z: number, kind: CoverKind): Cover => {
  const [w, d, h] = SIZE[kind];
  return { x, z, w, d, h, kind };
};
const COVERS: Cover[] = [
  C(120, 6, 'ac'),
  C(300, 4, 'tank'),
  C(360, 14, 'crate'),
  C(376, 16, 'box'),
  C(540, 6, 'crate'),
  C(600, 3, 'tank'),
  C(780, 10, 'ac'),
  C(850, 5, 'tank'),
  C(872, 15, 'box'),
  C(1040, 8, 'crate'),
  C(1056, 9, 'crate'),
  C(1140, 4, 'tank'),
  C(1320, 12, 'ac'),
  C(1400, 3, 'tank'),
  C(1450, 15, 'crate'),
  C(1600, 8, 'box'),
  C(1660, 4, 'tank'),
  C(1700, 16, 'crate'),
  C(1870, 6, 'ac'),
  C(1950, 3, 'tank'),
  C(1990, 14, 'crate'),
  C(2004, 16, 'box'),
  C(2160, 5, 'tank'),
  C(2230, 14, 'crate'),
  C(2290, 6, 'ac'),
  // the last roof: one crate early on, then open roof to the edge
  C(2420, 10, 'crate'),
];

/** Where a capture puts you back. */
const CHECKPOINTS = [24, 760, 1300, 1840, 2400];
/** On the last roof, past this, the helicopter comes round behind you. */
const FINALE_X = 2440;

// ---------------------------------------------------------------- tuning

const GRAV = 640;
const JUMP_V = 205;
const RUN = 104;
const STEP_Z = 46;
/** The searchlight's pool on the roof: half-width, half-depth. */
const SPOT_RX = 24;
const SPOT_RZ = 13;
/** Seconds in the light before the net comes. */
const SPOT_HOLD = 0.8;
/** The lamp: how far behind the roofs, and how high over them. */
const LAMP_BACK = 70;
const LAMP_UP = 110;

type State = 'intro' | 'run' | 'caught' | 'leap' | 'end';

export class RooftopEscape extends Phaser.Scene {
  private state: State = 'intro';
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  // where you are: along, into the roof, and how high your feet are (up is +)
  private px = 24;
  private pz = 16;
  private alt = -108;
  private vx = 0;
  private valt = 0;
  private onGround = true;
  private coyote = 0;
  private jumpBuf = 0;
  private face = 1;
  private checkpoint = 0;
  private clock = 0;
  private falling = false;

  private player!: Player;
  private shadowBlob!: Phaser.GameObjects.Ellipse;

  // the helicopter and its light
  private heli!: Phaser.GameObjects.Container;
  private rotor!: Phaser.GameObjects.Rectangle;
  private beam!: Phaser.GameObjects.Graphics;
  private lightRT!: Phaser.GameObjects.RenderTexture;
  private lightG!: Phaser.GameObjects.Graphics;
  private shadowG!: Phaser.GameObjects.Graphics;
  private heliX = 0;
  private heliY = 26;
  private spotX = 0;
  private spotZ = 15;
  private lastSeen: number | null = null;
  private lit = 0;
  private heliSound = 0;
  private finale = false;
  private edgeHint = false;

  private net: Phaser.GameObjects.Graphics | null = null;
  private say!: Phaser.GameObjects.BitmapText;
  private sayPlate!: Phaser.GameObjects.Rectangle;
  private sayUntil = 0;
  private hint!: Phaser.GameObjects.BitmapText;
  private edgeText!: Phaser.GameObjects.BitmapText;
  private black!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('RooftopEscape');
  }

  create(): void {
    froggyLayer.clear();
    this.state = 'intro';
    this.checkpoint = 0;
    this.clock = 0;
    this.net = null;
    this.finale = false;
    this.edgeHint = false;
    audio.setScene(SILENCE);
    const kb = this.input.keyboard;
    const bind = (n: readonly string[]) => (kb ? n.map((k) => kb.addKey(k)) : []);
    this.keys = { left: bind(KEYS.left), right: bind(KEYS.right), up: bind(KEYS.up), down: bind(KEYS.down), jump: bind(['SPACE']) };
    for (const k of this.keys.jump) k.on('down', () => (this.jumpBuf = 0.14));

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.paintSky();
    this.paintSkyline();
    this.paintAlley();
    for (const r of ROOFS) this.paintRoof(r);
    this.paintHotelWindow();
    for (const c of COVERS) this.paintCover(c);

    this.shadowBlob = this.add.ellipse(0, 0, 12, 4, 0x000000, 0.45);
    this.player = new Player(this, 0, 0);
    this.makeLight();
    this.makeHeli();

    this.sayPlate = this.add.rectangle(0, 0, 1, 1, PALETTE.black, 0.72).setOrigin(0, 0).setScrollFactor(0).setDepth(9000).setVisible(false);
    this.say = centerText(this, GAME_W / 2, GAME_H - 22, '', PALETTE.cream).setScrollFactor(0).setDepth(9001).setVisible(false).setMaxWidth(290);
    backPlate(this, this.say);
    this.hint = centerText(this, GAME_W / 2, 14, '', PALETTE.gold).setScrollFactor(0).setDepth(9001).setAlpha(0);
    this.edgeText = centerText(this, 0, 0, 'JUMP OFF BUILDING', 0xffe070).setDepth(9002).setVisible(false);
    this.black = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(9500);

    this.respawn(0);
    this.tweens.add({ targets: this.black, alpha: 0, duration: 900 });
    audio.sfx('helicopter', 0.5);
    this.line('Out onto the roof. Six floors up. Midnight.', 2.6);
    this.time.delayedCall(2600, () => {
      this.line('A helicopter. Keep the tanks and crates between you and its light.', 3.4, true);
      this.state = 'run';
      this.showHint(isTouch() ? 'STICK: RUN AND STEP IN/OUT  -  JUMP: JUMP' : 'A/D RUN  -  W/S STEP IN/OUT  -  SPACE JUMP', 5);
    });

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__roof = {
        state: () => ({ state: this.state, px: this.px, pz: this.pz, alt: this.alt, lit: this.lit, spotX: this.spotX, spotZ: this.spotZ, finale: this.finale }),
        put: (x: number, z: number) => {
          const r = this.roofAt(x);
          this.px = x;
          this.pz = z;
          this.alt = r ? -r.y : this.alt;
          this.vx = 0;
          this.valt = 0;
          this.onGround = !!r;
        },
        heli: (x: number) => {
          this.heliX = x;
        },
        spot: (x: number, z: number) => {
          this.spotX = x;
          this.spotZ = z;
        },
        shaded: () => this.inShadow(),
      };
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => delete (window as unknown as Record<string, unknown>).__roof);
    }
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

  /** Midnight: deep blue-black, a cold moon, slow cloud, the city's glow low down. */
  private paintSky(): void {
    const key = this.tex('rt2_sky', GAME_W, GAME_H, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, GAME_H);
      gr.addColorStop(0, '#03050c');
      gr.addColorStop(0.5, '#0a1024');
      gr.addColorStop(1, '#1e1a34');
      g.fillStyle = gr;
      g.fillRect(0, 0, GAME_W, GAME_H);
      const gl = g.createRadialGradient(GAME_W / 2, GAME_H + 30, 10, GAME_W / 2, GAME_H + 30, 220);
      gl.addColorStop(0, 'rgba(150,90,80,0.32)');
      gl.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gl;
      g.fillRect(0, 0, GAME_W, GAME_H);
      let q = 7;
      const R = () => ((q = (q * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 110; i++) {
        g.fillStyle = `rgba(230,236,255,${0.2 + R() * 0.6})`;
        g.fillRect(Math.floor(R() * GAME_W), Math.floor(R() * 95), 1, 1);
      }
      const m = g.createRadialGradient(258, 28, 2, 258, 28, 30);
      m.addColorStop(0, 'rgba(220,230,255,0.45)');
      m.addColorStop(1, 'rgba(220,230,255,0)');
      g.fillStyle = m;
      g.fillRect(222, 0, 72, 62);
      g.fillStyle = '#e8ecf4';
      g.beginPath();
      g.arc(258, 28, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(150,160,180,0.6)';
      g.fillRect(255, 25, 3, 2);
      g.fillRect(260, 30, 2, 2);
    });
    this.add.image(0, 0, key).setOrigin(0, 0).setScrollFactor(0).setDepth(-30);
    // cloud drifting across the moon
    const cloud = this.tex('rt2_cloud', 200, 30, (g) => {
      for (let k = 0; k < 14; k++) {
        const cg = g.createRadialGradient(20 + k * 12, 15 + (k % 3) * 3, 1, 20 + k * 12, 15 + (k % 3) * 3, 16);
        cg.addColorStop(0, 'rgba(40,46,70,0.55)');
        cg.addColorStop(1, 'rgba(40,46,70,0)');
        g.fillStyle = cg;
        g.fillRect(0, 0, 200, 30);
      }
    });
    const c1 = this.add.image(-200, 22, cloud).setOrigin(0, 0).setScrollFactor(0).setDepth(-29);
    this.tweens.add({ targets: c1, x: GAME_W + 20, duration: 70000, repeat: -1 });
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
          if (R() < 0.3) g.fillRect(x + bw / 2 - 1, GAME_H - bh - 10, 2, 10);
          for (let wy = GAME_H - bh + 4; wy < GAME_H - 6; wy += 6) {
            for (let wx = x + 3; wx < x + bw - 3; wx += 5) {
              if (R() < lit) {
                g.fillStyle = R() < 0.75 ? 'rgba(255,200,120,0.7)' : 'rgba(150,190,255,0.55)';
                g.fillRect(wx, wy, 2, 2);
              }
            }
          }
          x += bw + Math.floor(R() * 4);
        }
      });
    this.add.tileSprite(0, 0, GAME_W, GAME_H, layer('rt2_far', 640, 60, '#0a0e1c', 0.07, 11)).setOrigin(0, 0).setScrollFactor(0).setDepth(-25).setData('par', 0.12);
    this.add.tileSprite(0, 0, GAME_W, GAME_H, layer('rt2_mid', 640, 40, '#10141f', 0.1, 29)).setOrigin(0, 0).setScrollFactor(0).setDepth(-22).setData('par', 0.3);
  }

  /** A building: the roof's top surface (with depth), and the facade below it down to the street. */
  private paintRoof(r: Roof): void {
    const tones = [
      ['#3e2e2e', '#2e2020'],
      ['#36323c', '#26222c'],
      ['#3e382e', '#2e2820'],
      ['#2e3840', '#20282e'],
    ][r.tone];
    const top = r.y;
    const face = top + D;
    const h = WORLD_H - face;
    // the facade, facing you
    const key = this.tex(`rt2_bld_${r.x}`, r.w, h, (g) => {
      g.fillStyle = tones[0];
      g.fillRect(0, 0, r.w, h);
      g.fillStyle = tones[1];
      for (let y = 6; y < h; y += 4) {
        g.fillRect(0, y, r.w, 1);
        for (let x = (y / 4) % 2 ? 3 : 0; x < r.w; x += 8) g.fillRect(x, y - 3, 1, 3);
      }
      const gr = g.createLinearGradient(0, 0, 0, 30);
      gr.addColorStop(0, 'rgba(0,0,0,0.35)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, r.w, 30);
      let q = r.x + 3;
      const R = () => ((q = (q * 16807) % 2147483647) / 2147483647);
      for (let y = 12; y < h - 8; y += 18) {
        for (let x = 8; x < r.w - 10; x += 18) {
          const lit = R() < 0.18;
          g.fillStyle = '#100c0a';
          g.fillRect(x - 1, y - 1, 10, 11);
          g.fillStyle = lit ? (R() < 0.8 ? '#d8a058' : '#7aa0d8') : '#161c28';
          g.fillRect(x, y, 8, 9);
          g.fillStyle = 'rgba(0,0,0,0.5)';
          g.fillRect(x + 4, y, 1, 9);
          g.fillRect(x, y + 4, 8, 1);
        }
      }
      // the coping along the front edge, catching the moon
      g.fillStyle = '#6a6460';
      g.fillRect(0, 0, r.w, 2);
      g.fillStyle = '#9a948a';
      g.fillRect(0, 0, r.w, 1);
      // darker down towards the street: the alley light does not reach
      const dk = g.createLinearGradient(0, 40, 0, h);
      dk.addColorStop(0, 'rgba(0,0,0,0)');
      dk.addColorStop(1, 'rgba(0,0,0,0.7)');
      g.fillStyle = dk;
      g.fillRect(0, 40, r.w, h - 40);
    });
    this.add.image(r.x, face, key).setOrigin(0, 0).setDepth(face + 2000);
    // the roof surface: tar and gravel, the parapet along the back
    const s = this.add.graphics().setDepth(-5);
    s.fillStyle(0x2a2a30, 1).fillRect(r.x, top, r.w, D);
    let q = r.x + 91;
    const R = () => ((q = (q * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < r.w * 0.6; k++) s.fillStyle(R() < 0.5 ? 0x34343c : 0x222228, 1).fillRect(r.x + Math.floor(R() * r.w), top + Math.floor(R() * D), 1, 1);
    // moonlight on the roof, brightest at the front
    s.fillStyle(0x6a78a0, 0.08).fillRect(r.x, top + D / 2, r.w, D / 2);
    // back parapet: a low wall you cannot step over
    s.fillStyle(0x4a4448, 1).fillRect(r.x, top - 6, r.w, 6);
    s.fillStyle(0x7a7470, 1).fillRect(r.x, top - 6, r.w, 1);
    s.fillStyle(0x1a1618, 1).fillRect(r.x, top - 1, r.w, 1);
    // the side walls of the gap, dark
    s.fillStyle(0x141216, 1).fillRect(r.x - 1, top - 6, 1, D + 6).fillRect(r.x + r.w, top - 6, 1, D + 6);
    // an aerial or a stack on the bigger roofs, back by the parapet
    if (r.w > 220) {
      s.fillStyle(0x5a5a62, 1).fillRect(r.x + r.w - 30, top - 28, 1, 22);
      s.fillRect(r.x + r.w - 36, top - 24, 13, 1);
      s.fillRect(r.x + r.w - 34, top - 20, 9, 1);
      s.fillStyle(0xff3030, 1).fillRect(r.x + r.w - 30, top - 29, 1, 1);
    }
  }

  /** The Grand Lily's window at the start: the broken one you came out of. */
  private paintHotelWindow(): void {
    const r = ROOFS[0];
    const g = this.add.graphics().setDepth(-6);
    g.fillStyle(0x3a2a2c, 1).fillRect(-60, 20, 90, r.y - 26);
    g.fillStyle(0x2a1e20, 1);
    for (let y = 24; y < r.y - 6; y += 5) g.fillRect(-60, y, 90, 1);
    g.fillStyle(0x1a1410, 1).fillRect(-4, 50, 28, 34);
    g.fillStyle(0xffc070, 0.5).fillRect(-2, 52, 24, 30);
    g.fillStyle(0xdfeaf2, 0.8);
    for (const [x, y, w, h] of [[-2, 52, 5, 7], [16, 52, 6, 4], [-2, 74, 3, 8], [19, 76, 3, 6]]) g.fillRect(x, y, w, h);
    g.fillStyle(0x6a1a28, 1).fillRect(22, 52, 4, 22);
  }

  /** Down in the alley: the skip, and the far wall.  Off the screen until you jump. */
  private paintAlley(): void {
    const g = this.add.graphics().setDepth(-8);
    g.fillStyle(0x0c0c10, 1).fillRect(EDGE_X - 10, LAST.y + D, WORLD_W - EDGE_X + 10, WORLD_H);
    // the far wall, blind brick
    g.fillStyle(0x241c1c, 1).fillRect(FAR_WALL.x, FAR_WALL.y, WORLD_W - FAR_WALL.x, WORLD_H);
    g.fillStyle(0x1a1414, 1);
    for (let y = FAR_WALL.y + 4; y < WORLD_H; y += 4) g.fillRect(FAR_WALL.x, y, WORLD_W - FAR_WALL.x, 1);
    // the alley floor, wet
    g.fillStyle(0x16161c, 1).fillRect(EDGE_X - 10, STREET - 6, WORLD_W, 14);
    g.fillStyle(0x2a3a4a, 0.4).fillRect(EDGE_X + 30, STREET - 5, 40, 1);
    // the skip, full of rubbish bags, right under the edge
    const sx = EDGE_X + 16;
    const sw = 80;
    const st = STREET - 30;
    const k = this.add.graphics().setDepth(-7);
    k.fillStyle(0x2f5a34, 1).fillRect(sx, st + 4, sw, STREET - 6 - st - 4);
    k.fillStyle(0x1e3e22, 1);
    for (let x = sx + 6; x < sx + sw; x += 12) k.fillRect(x, st + 6, 2, STREET - 12 - st);
    k.fillStyle(0x4a7a4e, 1).fillRect(sx - 2, st + 2, sw + 4, 3);
    for (const [bx, by, r, col] of [
      [sx + 12, st + 1, 9, 0x141414],
      [sx + 30, st - 2, 11, 0x1c1c22],
      [sx + 50, st, 10, 0x22201a],
      [sx + 68, st + 1, 9, 0x141418],
    ] as const) {
      k.fillStyle(col, 1).fillCircle(bx, by, r);
      k.fillStyle(0xffffff, 0.1).fillCircle(bx - r / 3, by - r / 3, r / 3);
    }
    this.skipTop = st - 4;
  }
  private skipTop = STREET - 34;

  private paintCover(c: Cover): void {
    const r = this.roofAt(c.x + c.w / 2);
    if (!r) return;
    // screen: the footprint's front edge is at the base; the box rises c.h
    const x = c.x;
    const back = r.y + c.z;
    const front = back + c.d;
    const g = this.add.graphics().setDepth(front);
    const top = front - c.h;
    if (c.kind === 'tank') {
      // a water tank on a steel stand: legs, the drum, a conical lid
      g.fillStyle(0x2a2420, 1).fillRect(x + 2, front - 10, 2, 10).fillRect(x + c.w - 4, front - 10, 2, 10);
      g.fillStyle(0x3a302a, 1).fillRect(x + 1, front - 11, c.w - 2, 2);
      g.fillStyle(0x5e4632, 1).fillRect(x, top + 4, c.w, c.h - 14);
      g.fillStyle(0x4a3424, 1);
      for (let yy = top + 8; yy < front - 12; yy += 6) g.fillRect(x, yy, c.w, 1);
      g.fillStyle(0x7a5c42, 1).fillRect(x, top + 4, 2, c.h - 14);
      g.fillStyle(0x2a1c14, 1).fillRect(x + c.w - 2, top + 4, 2, c.h - 14);
      g.fillStyle(0x4e3a2a, 1).fillTriangle(x - 1, top + 5, x + c.w + 1, top + 5, x + c.w / 2, top - 3);
      g.fillStyle(0x8a6a4a, 1).fillRect(x + c.w / 2 - 1, top - 4, 2, 2);
    } else if (c.kind === 'crate') {
      // a wooden crate: top face, front face, planks and the diagonal brace
      g.fillStyle(0x8a6436, 1).fillRect(x, top - c.d * 0.4, c.w, c.d * 0.4);
      g.fillStyle(0x6a4a26, 1).fillRect(x, top, c.w, c.h);
      g.fillStyle(0x4a3218, 1).fillRect(x, top, c.w, 1).fillRect(x, top + c.h - 1, c.w, 1).fillRect(x, top, 1, c.h).fillRect(x + c.w - 1, top, 1, c.h);
      g.lineStyle(1, 0x4a3218, 1).lineBetween(x + 1, top + c.h - 2, x + c.w - 2, top + 1);
      g.fillStyle(0x9a7444, 1).fillRect(x, top - c.d * 0.4, c.w, 1);
    } else if (c.kind === 'box') {
      // a cardboard box, taped
      g.fillStyle(0xb08a58, 1).fillRect(x, top - c.d * 0.4, c.w, c.d * 0.4);
      g.fillStyle(0x8e6c40, 1).fillRect(x, top, c.w, c.h);
      g.fillStyle(0xd8c8a0, 1).fillRect(x + c.w / 2 - 1, top - c.d * 0.4, 2, c.d * 0.4 + 3);
      g.fillStyle(0x5a4426, 1).fillRect(x, top + c.h - 1, c.w, 1);
    } else {
      // an air-conditioning unit: grille, fan
      g.fillStyle(0x9a9ea4, 1).fillRect(x, top - c.d * 0.4, c.w, c.d * 0.4);
      g.fillStyle(0x7a7e84, 1).fillRect(x, top, c.w, c.h);
      g.fillStyle(0x4a4e54, 1);
      for (let yy = top + 2; yy < front - 1; yy += 2) g.fillRect(x + 2, yy, c.w - 9, 1);
      g.fillStyle(0x2a2e34, 1).fillCircle(x + c.w - 4, top + c.h / 2, 3);
    }
    // its own shadow on the roof from the moon, soft, to the front-right
    const s = this.add.graphics().setDepth(-4);
    s.fillStyle(0x000000, 0.25).fillRect(x + 2, back + 2, c.w, c.d);
  }

  // ------------------------------------------------------------- the light

  private makeLight(): void {
    // The searchlight is drawn into its own layer each frame: the pool on the
    // roof, then every shadow cut out of it -- so the light is really missing
    // where a tank or a crate stands between it and the roof.
    this.lightRT = this.add.renderTexture(0, 0, GAME_W, GAME_H).setOrigin(0, 0).setScrollFactor(0).setDepth(-3).setBlendMode(Phaser.BlendModes.ADD);
    this.lightG = this.make.graphics({}, false);
    this.shadowG = this.make.graphics({}, false);
    this.beam = this.add.graphics().setDepth(2900).setBlendMode(Phaser.BlendModes.ADD);
  }

  private makeHeli(): void {
    const body = this.add.graphics();
    body.fillStyle(0x0e1018, 1).fillEllipse(0, 0, 34, 13);
    body.fillRect(12, -2, 28, 3);
    body.fillRect(37, -7, 3, 9);
    body.fillStyle(0x2a3a5a, 1).fillEllipse(-9, -1, 11, 8);
    body.fillStyle(0x8aa0c0, 0.6).fillRect(-12, -3, 4, 2);
    body.fillStyle(0x0e1018, 1).fillRect(-9, 7, 20, 1).fillRect(-7, 5, 1, 3).fillRect(7, 5, 1, 3);
    body.fillStyle(0xd8dce4, 1).fillRect(-2, -2, 10, 1);
    this.rotor = this.add.rectangle(0, -9, 50, 1, 0x3a3e48);
    const mast = this.add.rectangle(0, -7, 2, 3, 0x0e1018);
    const blink = this.add.rectangle(40, -7, 2, 2, 0xff3030).setName('blink');
    const lamp = this.add.rectangle(-5, 7, 5, 2, 0xfff4d0);
    this.heli = this.add.container(0, 26, [this.rotor, mast, body, blink, lamp]).setDepth(2950);
  }

  // ------------------------------------------------------------- the level

  private roofAt(x: number): Roof | null {
    for (const r of ROOFS) if (x >= r.x && x <= r.x + r.w) return r;
    return null;
  }

  /** The lamp, in world space: x along, z (negative is behind the roofs), and its height. */
  private lamp(): { x: number; z: number; a: number } {
    const r = this.roofAt(this.spotX) ?? this.roofAt(this.px) ?? LAST;
    return { x: this.heliX, z: -LAMP_BACK, a: -r.y + LAMP_UP };
  }

  /** Does the line from the lamp to point P pass through any cover? */
  private occluded(px: number, pz: number, pa: number): boolean {
    const L = this.lamp();
    for (const c of COVERS) {
      const r = this.roofAt(c.x + c.w / 2);
      if (!r) continue;
      if (Math.abs(c.x - px) > 120) continue;
      const base = -r.y;
      // slab test, segment L -> P against the box
      let t0 = 0;
      let t1 = 1;
      const axes: Array<[number, number, number, number]> = [
        [L.x, px, c.x, c.x + c.w],
        [L.z, pz, c.z, c.z + c.d],
        [L.a, pa, base, base + c.h],
      ];
      let hit = true;
      for (const [a, b, lo, hi] of axes) {
        const d = b - a;
        if (Math.abs(d) < 1e-6) {
          if (a < lo || a > hi) {
            hit = false;
            break;
          }
          continue;
        }
        let ta = (lo - a) / d;
        let tb = (hi - a) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) {
          hit = false;
          break;
        }
      }
      if (hit && t1 < 0.999) return true;
    }
    return false;
  }

  /** Is the player's body out of the lamp's line of sight? */
  private inShadow(): boolean {
    // chest and head: if either can be seen, you can be seen
    return this.occluded(this.px, this.pz, this.alt + 10) && this.occluded(this.px, this.pz, this.alt + 20);
  }

  private inPool(): boolean {
    const dx = (this.px - this.spotX) / SPOT_RX;
    const dz = (this.pz - this.spotZ) / SPOT_RZ;
    return dx * dx + dz * dz <= 1;
  }

  // ------------------------------------------------------------- the loop

  update(_t: number, delta: number): void {
    const dt = Math.min(delta / 1000, 1 / 30);
    this.clock += dt;
    const cam = this.cameras.main;
    for (const o of this.children.list) {
      const par = o.getData?.('par') as number | undefined;
      if (par && o instanceof Phaser.GameObjects.TileSprite) o.tilePositionX = cam.scrollX * par;
    }
    if (this.say.visible && this.clock > this.sayUntil) {
      this.say.setVisible(false);
      this.sayPlate.setVisible(false);
    }
    if (this.state === 'run') this.step(dt, delta);
    else if (this.state === 'leap') this.stepLeap(dt);
    else if (this.state === 'caught' && this.falling) this.stepFall(dt);
    this.drawPlayer(delta);
    this.tickHeli(dt);
    this.drawLight();
    cam.scrollX = Phaser.Math.Clamp(this.px - 130, 0, WORLD_W - GAME_W);
    if (this.state !== 'leap' && this.state !== 'end') cam.scrollY = 0;
  }

  private down(name: string): boolean {
    return this.keys[name]?.some((k) => k.isDown) ?? false;
  }

  /** The cover whose footprint contains (x, z), if any. */
  private coverAt(x: number, z: number): Cover | null {
    for (const c of COVERS) if (x > c.x - 3 && x < c.x + c.w + 3 && z > c.z - 1 && z < c.z + c.d + 1) return c;
    return null;
  }

  private step(dt: number, delta: number): void {
    const dx = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    const dz = (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0);
    this.jumpBuf -= dt;
    this.coyote -= dt;
    if (dx) this.face = dx;

    // along the roofs
    const want = dx * RUN;
    const accel = this.onGround ? 900 : 380;
    this.vx = want > this.vx ? Math.min(want, this.vx + accel * dt) : Math.max(want, this.vx - accel * dt);
    // in and out of the roof: only on your feet, and steadier
    const vz = this.onGround ? dz * STEP_Z : 0;

    if (this.onGround) this.coyote = 0.09;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.valt = JUMP_V;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuf = 0;
      audio.sfx('throw_whoosh', 0.25);
    }
    // a short hop if the jump is let go early
    if (!this.onGround && this.valt > 60 && !this.down('jump')) this.valt -= GRAV * 1.4 * dt;
    if (!this.onGround) this.valt -= GRAV * dt;

    const ox = this.px;
    const oz = this.pz;
    const oa = this.alt;
    let nx = this.px + this.vx * dt;
    let nz = this.pz + vz * dt;
    const na = this.alt + this.valt * dt;

    // the back parapet
    nz = Math.max(1, nz);
    // cover is solid: slide along it
    if (this.onGround) {
      if (this.coverAt(nx, oz)) nx = ox;
      if (this.coverAt(nx, nz)) nz = oz;
    }
    // the side of a roof higher than your feet is a wall
    const ahead = this.roofAt(nx);
    if (ahead && -ahead.y > na + 3 && !(ox >= ahead.x && ox <= ahead.x + ahead.w)) nx = ox;

    this.px = Math.max(-40, nx);
    this.pz = nz;
    this.alt = na;

    // landing on a roof, from above
    const was = this.onGround;
    const r = this.roofAt(this.px);
    const surface = r ? -r.y : -Infinity;
    if (r && this.pz <= D && this.valt <= 0 && oa >= surface - 0.5 && this.alt <= surface) {
      this.alt = surface;
      this.valt = 0;
      this.onGround = true;
      if (!was) audio.sfx('step_run', 0.4);
    } else if (this.onGround && (!r || this.pz > D || Math.abs(this.alt - surface) > 0.5)) {
      // walked off: the front edge, or the end of the roof into a gap
      this.onGround = false;
      this.valt = 0;
    }

    // footsteps
    if (this.onGround && (Math.abs(this.vx) > 20 || Math.abs(vz) > 10)) {
      this.player.stride(this.vx || this.face, delta, Math.max(1, Math.abs(this.vx) / 62));
      if (Math.floor(this.clock * 6) !== Math.floor((this.clock - dt) * 6)) audio.sfx('step_run', 0.18);
    }

    // over the end of the last roof: the leap
    if (this.px > EDGE_X && !this.onGround) return this.beginLeap();
    // gone over an edge and dropping: there is no getting back
    const floor = r ? surface : Math.max(...ROOFS.filter((q) => Math.abs(q.x + q.w / 2 - this.px) < 200).map((q) => -q.y));
    if (!this.onGround && this.alt < floor - 24) return this.beginFall();

    // checkpoints
    for (let i = CHECKPOINTS.length - 1; i > this.checkpoint; i--) {
      if (this.px >= CHECKPOINTS[i] && this.onGround) {
        this.checkpoint = i;
        this.showHint('CHECKPOINT', 1.4);
        audio.sfx('zone_clear', 0.4);
        break;
      }
    }
    // the finale
    if (!this.finale && this.px > FINALE_X && this.onGround) {
      this.finale = true;
      audio.sfx('helicopter', 0.9);
      this.line('It has come round behind you. Nowhere left to hide.', 3, true);
    }
    void oz;
  }

  // ------------------------------------------------------------- falling

  private beginFall(): void {
    if (this.state !== 'run') return;
    this.state = 'caught';
    this.falling = true;
    this.showHint('YOU FELL', 1.6, 0xff5a5a);
    audio.sfx('throw_whoosh', 0.6);
  }

  /** Down the face of the building and off the bottom of the screen. */
  private stepFall(dt: number): void {
    this.valt -= GRAV * dt;
    this.alt += this.valt * dt;
    this.px += this.vx * dt * 0.6;
    const screenY = -this.alt + this.pz;
    if (screenY > this.cameras.main.scrollY + GAME_H + 40) {
      this.falling = false;
      audio.sfx('item_thud', 0.8);
      this.cameras.main.shake(260, 0.02);
      this.time.delayedCall(500, () => this.toCheckpoint());
    }
  }

  private beginLeap(): void {
    this.state = 'leap';
    this.edgeText.setVisible(false);
    audio.sfx('throw_whoosh', 0.7);
  }

  /** Off the last roof and down into the alley: the camera goes down with you. */
  private stepLeap(dt: number): void {
    this.valt -= GRAV * dt;
    this.alt += this.valt * dt;
    this.px += this.vx * dt;
    this.px = Math.min(this.px, EDGE_X + 80);
    const screenY = -this.alt + this.pz;
    const cam = this.cameras.main;
    cam.scrollY += (Phaser.Math.Clamp(screenY - 110, 0, WORLD_H - GAME_H) - cam.scrollY) * Math.min(1, dt * 6);
    if (screenY >= this.skipTop) this.landInSkip();
  }

  // ------------------------------------------------------------- drawing

  private drawPlayer(delta: number): void {
    const fy = -this.alt + this.pz;
    this.player.setPosition(Math.round(this.px), Math.round(fy));
    // in front of the facade while you are over the front edge, falling
    const overFront = this.pz > D || !this.roofAt(this.px);
    this.player.sprite.setDepth(overFront && !this.onGround ? fy + 2100 : fy + 0.5);
    if (!this.onGround) this.player.air(this.face);
    else if (Math.abs(this.vx) < 20 && this.state === 'run' && !(this.down('up') || this.down('down'))) this.player.stand();
    void delta;
    // the drop shadow on the roof under you
    const r = this.roofAt(this.px);
    if (r && this.pz <= D && this.state !== 'end') {
      const gy = r.y + this.pz;
      const hgt = -r.y - this.alt;
      this.shadowBlob.setVisible(hgt <= 0.5).setPosition(this.px, gy).setDepth(gy - 0.1);
      if (hgt > 0.5) this.shadowBlob.setVisible(true).setScale(Math.max(0.4, 1 + hgt / 60)).setAlpha(0.3);
      else this.shadowBlob.setScale(1).setAlpha(1);
    } else this.shadowBlob.setVisible(false);
  }

  private drawLight(): void {
    const cam = this.cameras.main;
    this.lightRT.clear();
    this.beam.clear();
    if (this.state === 'end' || this.state === 'leap') return;
    const r = this.roofAt(this.spotX);
    if (!r) return;
    const sx = this.spotX - cam.scrollX;
    const sy = r.y + this.spotZ - cam.scrollY;
    // the pool: bright in the middle, a soft rim
    const g = this.lightG;
    g.clear();
    g.fillStyle(0xfff0c8, 0.12).fillEllipse(sx, sy, SPOT_RX * 2 + 10, SPOT_RZ * 2 + 6);
    g.fillStyle(0xfff4d8, 0.28).fillEllipse(sx, sy, SPOT_RX * 2, SPOT_RZ * 2);
    g.fillStyle(0xffffff, 0.18).fillEllipse(sx, sy, SPOT_RX * 1.2, SPOT_RZ * 1.2);
    this.lightRT.draw(g);
    // the shadows: each cover in the light projected away from the lamp, cut out
    const L = this.lamp();
    const sh = this.shadowG;
    sh.clear();
    sh.fillStyle(0xffffff, 1);
    for (const c of COVERS) {
      if (Math.abs(c.x + c.w / 2 - this.spotX) > SPOT_RX + 60) continue;
      const cr = this.roofAt(c.x + c.w / 2);
      if (!cr || cr !== r) continue;
      const base = -cr.y;
      const pts: Array<[number, number]> = [];
      for (const [cx, cz] of [
        [c.x, c.z],
        [c.x + c.w, c.z],
        [c.x + c.w, c.z + c.d],
        [c.x, c.z + c.d],
      ] as const) {
        pts.push([cx, cz]);
        // the top corner, projected down onto the roof along the lamp's ray
        const k = (L.a - base) / (L.a - (base + c.h));
        pts.push([L.x + (cx - L.x) * k, L.z + (cz - L.z) * k]);
      }
      const hull = convexHull(pts).map(([x, z]) => new Phaser.Math.Vector2(x - cam.scrollX, cr.y + z - cam.scrollY));
      sh.fillPoints(hull, true);
    }
    this.lightRT.erase(sh);
    // the beam itself, a cone from the lamp to the pool
    const lx = this.heli.x - 5 - cam.scrollX;
    const ly = this.heli.y + 7 - cam.scrollY;
    this.beam.setScrollFactor(0);
    this.beam.fillStyle(0xfff4d0, 0.07);
    this.beam.fillTriangle(lx - 2, ly, lx + 2, ly, sx + SPOT_RX, sy);
    this.beam.fillTriangle(lx - 2, ly, sx - SPOT_RX, sy, sx + SPOT_RX, sy);
    this.beam.fillStyle(0xfff4d0, 0.05);
    this.beam.fillTriangle(lx, ly, sx - 10, sy, sx + 10, sy);
  }

  // ------------------------------------------------------------- the helicopter

  private tickHeli(dt: number): void {
    if (this.state === 'end') {
      this.heli.setVisible(false);
      return;
    }
    this.heliSound -= dt;
    if (this.heliSound <= 0) {
      this.heliSound = 1;
      audio.sfx('helicopter', this.finale ? 0.75 : 0.45);
    }
    // ---- where it hangs: ahead of you, drifting -- or, at the end, behind you on the left
    const wantX = this.finale ? this.px - 110 + Math.sin(this.clock * 0.6) * 12 : this.px + 80 + Math.sin(this.clock * 0.35) * 70;
    this.heliX += (wantX - this.heliX) * Math.min(1, dt * (this.finale ? 1.6 : 0.6));
    this.heliY = (this.finale ? 34 : 24) + Math.sin(this.clock * 1.7) * 2;
    this.heli.setVisible(true).setPosition(this.heliX, this.heliY).setAngle(Math.sin(this.clock * 0.8) * 4 + (this.finale ? -6 : 0));
    this.heli.setScale(this.finale ? -1.15 : 1, this.finale ? 1.15 : 1);
    this.rotor.setScale(Math.abs(Math.sin(this.clock * 40)) * 0.9 + 0.1, 1);
    (this.heli.getByName('blink') as Phaser.GameObjects.Rectangle).setVisible(Math.sin(this.clock * 6) > 0.6);

    if (this.state !== 'run') return;
    // ---- where the light goes
    let tx: number;
    let tz: number;
    let speed: number;
    if (this.finale) {
      // straight at you, from behind, faster than you can stand still
      tx = this.px - 4;
      tz = this.pz;
      speed = 70 + (this.px - FINALE_X) * 0.15;
      // it swings straight in from behind: no waiting for a slow sweep
      if (Math.abs(this.spotX - tx) > 110) this.spotX = tx - 100;
    } else if (this.lastSeen !== null && this.lit > 0) {
      // it has you: it follows
      tx = this.px;
      tz = this.pz;
      speed = 95;
    } else {
      // searching: a slow figure-eight across the roof around you, drawn back
      // to where it last saw you
      const centre = this.lastSeen ?? this.px;
      tx = centre + Math.sin(this.clock * 0.9) * 110 + Math.sin(this.clock * 0.31) * 40;
      tz = D / 2 + Math.sin(this.clock * 1.8) * (D / 2 - 3);
      speed = 120;
    }
    const d = Math.hypot(tx - this.spotX, (tz - this.spotZ) * 2);
    if (d > 0.5) {
      const k = Math.min(1, (speed * dt) / d);
      this.spotX += (tx - this.spotX) * k;
      this.spotZ += (tz - this.spotZ) * k;
    }
    this.spotZ = Phaser.Math.Clamp(this.spotZ, 2, D - 2);

    // ---- are you seen?
    const seen = this.onGround && this.inPool() && !this.inShadow();
    if (seen) {
      this.lit += dt;
      this.lastSeen = this.px;
    } else {
      this.lit = Math.max(0, this.lit - dt * 1.5);
      if (this.lit === 0 && this.lastSeen !== null && Math.abs(this.lastSeen - this.px) > 160) this.lastSeen = null;
    }
    // caught in it: you flare in the glare
    this.player.sprite.setAlpha(seen ? 0.6 + Math.abs(Math.sin(this.clock * 30)) * 0.4 : 1);
    if (this.lit > SPOT_HOLD) this.netted();

    // the last edge
    const nearEdge = this.finale && this.px > EDGE_X - 70;
    if (nearEdge && !this.edgeHint) {
      this.edgeHint = true;
      audio.sfx('ui_blip', 0.6);
    }
    this.edgeText.setVisible(nearEdge && this.state === 'run');
    if (nearEdge) this.edgeText.setPosition(EDGE_X - 34, LAST.y - 18 + Math.sin(this.clock * 6) * 1.5);
  }

  // ------------------------------------------------------------- caught / away

  private netted(): void {
    if (this.state !== 'run') return;
    this.state = 'caught';
    this.vx = 0;
    audio.sfx('net_drop', 1);
    audio.sfx('megaphone', 0.7);
    const fy = -this.alt + this.pz;
    const g = this.add.graphics().setDepth(fy + 1);
    g.lineStyle(1, 0xc8c0a0, 0.95);
    for (let k = -20; k <= 20; k += 5) g.lineBetween(k, -28, k * 0.55, 0);
    for (let y = -28; y <= 0; y += 5) {
      const half = 20 - ((y + 28) / 28) * 9;
      g.lineBetween(-half, y, half, y);
    }
    g.fillStyle(0x6a6a6a, 1).fillCircle(-20, -28, 2).fillCircle(20, -28, 2).fillCircle(-11, 0, 2).fillCircle(11, 0, 2);
    g.setPosition(this.px, fy - 130);
    this.tweens.add({ targets: g, y: fy + 1, duration: 340, ease: 'Quad.easeIn', onComplete: () => this.cameras.main.shake(200, 0.012) });
    this.net = g;
    this.line('"Got him!"', 1.8, true);
    this.showHint('NETTED!', 1.6, 0xff5a5a);
    this.time.delayedCall(1500, () => this.toCheckpoint());
  }

  private toCheckpoint(): void {
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
  }

  private respawn(i: number): void {
    const x = CHECKPOINTS[i];
    const r = this.roofAt(x) ?? ROOFS[0];
    this.px = x;
    this.pz = D / 2;
    this.alt = -r.y;
    this.vx = 0;
    this.valt = 0;
    this.onGround = true;
    this.falling = false;
    this.face = 1;
    this.lit = 0;
    this.lastSeen = null;
    this.finale = this.px > FINALE_X;
    this.edgeHint = false;
    this.heliX = this.px + 160;
    this.spotX = this.px + 150;
    this.spotZ = D / 2;
    this.net?.destroy();
    this.net = null;
    this.player.sprite.setAlpha(1).setVisible(true);
    this.cameras.main.scrollY = 0;
  }

  private landInSkip(): void {
    this.state = 'end';
    this.player.sprite.setVisible(false);
    this.shadowBlob.setVisible(false);
    audio.sfx('bin_land', 1);
    this.cameras.main.shake(300, 0.02);
    for (let k = 0; k < 26; k++) {
      const bit = this.add
        .rectangle(this.px, this.skipTop, 2 + Math.random() * 3, 2 + Math.random() * 3, [0x1c1c22, 0x8a6a40, 0xd8d0c0, 0x2a3a5a][k % 4])
        .setDepth(4000);
      this.tweens.add({
        targets: bit,
        x: this.px + (Math.random() - 0.5) * 70,
        y: this.skipTop - 20 - Math.random() * 30,
        duration: 300,
        ease: 'Quad.easeOut',
        yoyo: true,
        onComplete: () => bit.setY(this.skipTop + Math.random() * 4),
      });
    }
    this.time.delayedCall(1600, () => {
      audio.sfx('helicopter', 0.25);
      this.line('...', 1.6);
    });
    this.time.delayedCall(3200, () => {
      this.tweens.add({ targets: this.black, alpha: 1, duration: 3200, onComplete: () => this.epilogue() });
    });
  }

  /** On black: what came of it.  Then the morning, outside the arcade. */
  private epilogue(): void {
    const lines = ['You managed to escape.', "The police couldn't recover the hotel's video recordings.", 'But Froggy is still out there...'];
    const t = centerText(this, GAME_W / 2, GAME_H / 2, '', PALETTE.cream).setScrollFactor(0).setDepth(9600).setMaxWidth(280).setAlpha(0);
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
    audio.sfx('eerie_swell', 0.35);
    next();
  }

  private finish(): void {
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

/** Gift-wrapping hull of a handful of points. */
function convexHull(pts: Array<[number, number]>): Array<[number, number]> {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Array<[number, number]> = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Array<[number, number]> = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}
