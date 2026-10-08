/**
 * ---- THE OTHER WAY OUT OF THE HOTEL.
 *
 * Out of the front doors to the police with your hands up.  What happens next
 * is told in four pieces:
 *
 *   THE PAPER.  The front page of the next morning's paper, spun in and held:
 *     a proper broadsheet, painted at full screen resolution on the overlay
 *     canvas (the same one Froggy is drawn on) rather than in the pixel
 *     buffer, so its type and its halftone photographs are sharp.
 *   2 YEARS LATER.
 *   THE GATE.  Out of prison, on an overcast morning, with nothing to carry.
 *   THE ARCADE.  Boarded up.  Shut for good.  And in the dark behind the
 *     boards, for a moment, something looks back.
 *
 * It is an ending: the run is marked finished, and the end card resets it.
 */

import Phaser from 'phaser';
import { audio, SILENCE } from '../core/audio';
import { store } from '../core/state';
import { centerText } from '../core/ui';
import { PALETTE } from '../render/palette';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { froggyLayer } from '../render/froggyLayer';
import { Player } from '../art/player';
import { paintExterior } from '../art/exterior';

type Act = 'paper' | 'later' | 'gate' | 'arcade' | 'done';

const PAPER_W = 900;
const PAPER_H = 1240;

export class ArrestEnding extends Phaser.Scene {
  private act: Act = 'paper';
  private t = 0;
  private paper: HTMLCanvasElement | null = null;
  private player: Player | null = null;
  private walkTo = 0;
  private lineText!: Phaser.GameObjects.BitmapText;
  private linePlate!: Phaser.GameObjects.Rectangle;
  private queue: Array<{ text: string; dur: number }> = [];
  private lineT = 0;
  private black!: Phaser.GameObjects.Rectangle;
  private layer!: Phaser.GameObjects.Container;
  private eyes: Phaser.GameObjects.Graphics | null = null;
  private advance: (() => void) | null = null;

  constructor() {
    super('ArrestEnding');
  }

  create(): void {
    froggyLayer.clear();
    store.patch({ route: 'ended', hotelAfter: 'none' });
    store.flush();
    audio.setScene(SILENCE);
    this.act = 'paper';
    this.t = 0;
    this.queue = [];
    this.player = null;
    this.eyes = null;
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000).setOrigin(0, 0);
    this.layer = this.add.container(0, 0);
    this.linePlate = this.add.rectangle(0, 0, 1, 1, PALETTE.black, 0.72).setOrigin(0, 0).setDepth(900).setVisible(false);
    this.lineText = centerText(this, GAME_W / 2, GAME_H - 22, '', PALETTE.cream).setDepth(901).setVisible(false).setMaxWidth(290);
    this.black = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0).setOrigin(0, 0).setDepth(950);
    this.paper = paintNewspaper();
    audio.sfx('door_shut', 0.5);
    this.time.delayedCall(500, () => audio.sfx('throw_whoosh', 0.5));
    const go = () => this.advance?.();
    this.input.on('pointerdown', go);
    this.input.keyboard?.on('keydown-SPACE', go);
    this.input.keyboard?.on('keydown-ENTER', go);
    this.input.keyboard?.on('keydown-E', go);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => froggyLayer.clear());
    // the paper holds until it is read (a click moves on after a few seconds)
    this.time.delayedCall(4500, () => (this.advance = () => this.toLater()));
    this.time.delayedCall(15000, () => this.toLater());
  }

  update(_t: number, delta: number): void {
    const dt = delta / 1000;
    this.t += dt;
    if (this.act === 'paper') this.drawPaper();
    this.tickLines(dt);
    if (this.player && (this.act === 'gate' || this.act === 'arcade')) {
      const dx = this.player.x < this.walkTo - 1 ? 1 : 0;
      this.player.move(dx, 0, delta * 0.55, new Phaser.Geom.Rectangle(0, 162, GAME_W, 0));
    }
    if (this.eyes) this.eyes.setAlpha(Math.max(0, Math.sin(this.t * 1.3)) * 0.9);
  }

  // ------------------------------------------------------------- the paper

  private drawPaper(): void {
    const p = this.paper;
    if (!p) return;
    const t = this.t;
    // spun in from nothing, then held, then a slow push in on the headline
    const spin = Math.min(1, t / 1.3);
    const e = 1 - Math.pow(1 - spin, 3);
    const zoomIn = Math.max(0, t - 2.4) * 0.035;
    const scale = (0.06 + e * 0.074) * (1 + Math.min(0.55, zoomIn));
    const rot = (1 - e) * Math.PI * 4 - 0.035;
    // (pushing in on the headline and the lead photograph, not the middle)
    const lift = (PAPER_H / 2 - 430) * scale * Math.min(1, zoomIn / 0.55);
    froggyLayer.paint((ctx) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.save();
      ctx.translate(GAME_W / 2, GAME_H / 2 + lift);
      ctx.rotate(rot);
      ctx.scale(scale, scale);
      // the shadow it throws on the table
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-PAPER_W / 2 + 18, -PAPER_H / 2 + 22, PAPER_W, PAPER_H);
      ctx.drawImage(p, -PAPER_W / 2, -PAPER_H / 2);
      ctx.restore();
      // a lamp over it: light in the middle, dark at the edges
      const v = ctx.createRadialGradient(GAME_W / 2, GAME_H / 2, 40, GAME_W / 2, GAME_H / 2, 200);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, GAME_W, GAME_H);
    });
  }

  private toLater(): void {
    if (this.act !== 'paper') return;
    this.act = 'later';
    this.advance = null;
    froggyLayer.clear();
    const t = centerText(this, GAME_W / 2, GAME_H / 2 - 4, '2 YEARS LATER', PALETTE.cream, 16).setDepth(910).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 1400 });
    audio.sfx('eerie_swell', 0.25);
    this.time.delayedCall(4200, () => {
      this.tweens.add({ targets: t, alpha: 0, duration: 900, onComplete: () => this.toGate() });
    });
  }

  // ------------------------------------------------------------- the gate

  private toGate(): void {
    this.act = 'gate';
    this.layer.removeAll(true);
    const g = this.add.graphics();
    this.layer.add(g);
    // an overcast morning: flat grey sky, a low sun nobody can see
    const sky = [0x8a9098, 0x9aa0a6, 0xa8acb0, 0xb4b6b6];
    sky.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, i * 22, GAME_W, 22));
    g.fillStyle(0x7a8088, 1);
    for (let i = 0; i < 6; i++) g.fillEllipse(30 + i * 60, 18 + (i % 2) * 10, 70, 14);
    // the wall: concrete panels, stained, razor wire along the top
    g.fillStyle(0x7a766e, 1).fillRect(0, 70, GAME_W, 92);
    g.fillStyle(0x6a665e, 1);
    for (let x = 0; x < GAME_W; x += 40) g.fillRect(x, 70, 1, 92);
    for (let x = 6; x < GAME_W; x += 40) {
      g.fillStyle(0x5a564e, 0.5).fillRect(x, 74, 3, 40 + (x % 3) * 10);
    }
    g.fillStyle(0x4a4844, 1).fillRect(0, 66, GAME_W, 4);
    g.lineStyle(1, 0x9a9a9a, 1);
    for (let x = 0; x < GAME_W; x += 8) g.strokeCircle(x + 4, 62, 4);
    for (let x = 0; x < GAME_W; x += 24) g.fillStyle(0x3a3834, 1).fillRect(x, 54, 1, 14);
    // the guard tower
    g.fillStyle(0x5a5650, 1).fillRect(250, 20, 34, 50);
    g.fillStyle(0x3a3834, 1).fillRect(246, 16, 42, 6);
    g.fillStyle(0x1c2028, 1).fillRect(254, 28, 26, 10);
    g.fillStyle(0xfff4d0, 0.25).fillRect(256, 30, 6, 6);
    // the gate: steel, open now
    g.fillStyle(0x2a2c30, 1).fillRect(110, 92, 70, 70);
    g.fillStyle(0x3a3e44, 1).fillRect(112, 94, 66, 66);
    g.fillStyle(0x16181c, 1).fillRect(118, 100, 22, 60);
    g.fillStyle(0x4a4e54, 1);
    for (let y = 98; y < 160; y += 6) g.fillRect(146, y, 30, 1);
    g.fillStyle(0x1e2024, 1).fillRect(104, 86, 82, 8);
    this.layer.add(centerText(this, 145, 82, 'HM PRISON', 0xe8e4d8));
    // the road out
    g.fillStyle(0x4a4a4c, 1).fillRect(0, 162, GAME_W, 18);
    g.fillStyle(0x5a5a5c, 1).fillRect(0, 162, GAME_W, 1);
    g.fillStyle(0xd8d0b0, 0.6);
    for (let x = 4; x < GAME_W; x += 26) g.fillRect(x, 171, 12, 1);
    // a guard at the gate
    const guard = this.add.graphics();
    guard.fillStyle(0x1e2a4a, 1).fillRect(186, 138, 10, 14);
    guard.fillStyle(0x14182a, 1).fillRect(187, 152, 8, 10);
    guard.fillStyle(0xd8b090, 1).fillRect(188, 131, 7, 7);
    guard.fillStyle(0x0c1020, 1).fillRect(187, 128, 9, 3);
    this.layer.add(guard);
    this.player = new Player(this, 128, 162, false);
    this.walkTo = 128;
    this.black.setAlpha(1);
    this.tweens.add({ targets: this.black, alpha: 0, duration: 1600 });
    audio.sfx('door_open', 0.6);
    this.time.delayedCall(800, () => audio.sfx('metal_distant', 0.6));
    this.time.delayedCall(1800, () => {
      this.say('GUARD: "Stay out of trouble this time."', 3);
      this.say('Two years.', 2.4);
      this.say('Nobody believed a word of it. A giant frog.', 3.2);
      this.say('The arcade. I need to see the arcade.', 3);
      this.walkTo = GAME_W + 20;
    });
    this.time.delayedCall(14000, () => {
      this.tweens.add({ targets: this.black, alpha: 1, duration: 1400, onComplete: () => this.toArcade() });
    });
  }

  // ------------------------------------------------------------- the arcade

  private toArcade(): void {
    this.act = 'arcade';
    froggyLayer.clear();
    this.player?.sprite.destroy();
    this.player = null;
    this.layer.removeAll(true);
    // the same street, two years on: grey, the arcade shut and boarded
    const before = this.children.list.length;
    const refs = paintExterior(this, { night: false, day: true, closed: true });
    // everything the street painter put down goes under the words and the fade
    for (const o of this.children.list.slice(before)) (o as unknown as { setDepth?: (d: number) => void }).setDepth?.(1);
    refs.signGlow.setVisible(false);
    refs.moth?.setVisible(false);
    const g = this.add.graphics().setDepth(5);
    // ---- AN OVERCAST MORNING.  No sun: a low, heavy sky, layered cloud,
    // and the whole street drained of its colour under it.
    const skyBands = [0x5e646c, 0x686e76, 0x737880, 0x7e8288, 0x888b90];
    skyBands.forEach((c, i) => g.fillStyle(c, 1).fillRect(0, i * 11, GAME_W, 11));
    for (let i = 0; i < 9; i++) {
      const cx = (i * 47 + 13) % (GAME_W + 40) - 20;
      const cy = 8 + (i % 3) * 12;
      g.fillStyle(0x4e545c, 0.55).fillEllipse(cx, cy + 3, 74, 12);
      g.fillStyle(0x9a9ea2, 0.35).fillEllipse(cx - 6, cy, 60, 8);
    }
    // a fine drizzle against it
    for (let k = 0; k < 70; k++) g.fillStyle(0xc8ccd0, 0.18).fillRect(Math.random() * GAME_W, Math.random() * GAME_H, 1, 3);
    const tint = this.add.graphics().setDepth(4.5);
    tint.fillStyle(0x4a5058, 0.38).fillRect(0, 55, GAME_W, GAME_H - 55);
    // ---- THE SIGN, dead: unlit, a letter gone, hanging off one bracket
    refs.sign.setAlpha(0.55).setAngle(-4);
    refs.sign.y += 3;
    const sb = refs.sign.getBounds();
    g.fillStyle(0x3a3a3e, 1).fillRect(sb.x + sb.width - 10, sb.y - 6, 2, 10);
    g.fillStyle(0x2a2a2e, 1).fillRect(sb.x + 8, sb.y - 3, 1, 6);
    g.fillStyle(0x5a6068, 0.85).fillRect(sb.x + sb.width * 0.55, sb.y + 4, 9, sb.height - 8);
    // rust running down the wall from the brackets
    g.fillStyle(0x6a4a30, 0.35).fillRect(sb.x + sb.width - 10, sb.y + 4, 2, 22);
    // boards across the doors and the windows, nailed, weathered
    const d = refs.doorRect;
    const board = (x: number, y: number, w: number, a: number) => {
      const b = this.add.rectangle(x, y, w, 5, 0x7a5c3a).setDepth(6).setAngle(a);
      this.add.rectangle(x, y - 2, w, 1, 0x9a7a4e).setDepth(6).setAngle(a);
      this.add.rectangle(x, y + 2, w, 1, 0x4a3420).setDepth(6).setAngle(a);
      for (const nx of [-w / 2 + 3, w / 2 - 3]) this.add.rectangle(x + nx, y, 1, 1, 0x1a120a).setDepth(7).setAngle(a);
      return b;
    };
    // ---- THE DOORS: boarded, and a chain and padlock through the handles
    g.fillStyle(0x0a0a0e, 1).fillRect(d.x, d.y, d.w, d.h);
    board(d.x + d.w / 2, d.y + 8, d.w + 12, -7);
    board(d.x + d.w / 2, d.y + d.h / 2 + 12, d.w + 12, 5);
    board(d.x + d.w / 2, d.y + d.h - 6, d.w + 12, -3);
    const chain = this.add.graphics().setDepth(8);
    for (let k = 0; k <= 14; k++) {
      const t = k / 14;
      const cx = d.x + 3 + t * (d.w - 6);
      const cy = d.y + d.h / 2 + 4 + Math.sin(t * Math.PI) * 5;
      chain.fillStyle(k % 2 ? 0x8a8e94 : 0x5a5e64, 1).fillRect(cx, cy, 2, 2);
    }
    chain.fillStyle(0xb08a30, 1).fillRect(d.x + d.w / 2 - 3, d.y + d.h / 2 + 9, 6, 5);
    chain.fillStyle(0x6a5020, 1).fillRect(d.x + d.w / 2 - 2, d.y + d.h / 2 + 7, 4, 2).fillRect(d.x + d.w / 2, d.y + d.h / 2 + 11, 1, 2);
    // the notice, nailed up at the top, curling, sized to what it says
    const nx = d.x + d.w / 2;
    const ny = d.y - 13;
    this.add.rectangle(nx, ny, 60, 22, 0xe4dcc0).setDepth(8).setAngle(-3).setStrokeStyle(1, 0x7a7460);
    this.add.rectangle(nx + 27, ny + 9, 5, 4, 0xc8c0a4).setDepth(8).setAngle(-3);
    centerText(this, nx, ny - 4, 'CLOSED', 0xb02a2a).setDepth(9).setAngle(-3);
    centerText(this, nx, ny + 5, 'FOR GOOD', 0x2a2a2a).setDepth(9).setAngle(-3);
    // ---- THE WINDOWS: dark inside, glass cracked behind the boards
    for (const wx of [refs.doorX - 70, refs.doorX + 62]) {
      g.fillStyle(0x08080c, 1).fillRect(wx - 18, 96, 36, 26);
      g.lineStyle(1, 0x8a96a2, 0.5);
      g.lineBetween(wx - 10, 98, wx - 2, 110).lineBetween(wx - 2, 110, wx - 14, 118).lineBetween(wx - 2, 110, wx + 8, 104);
      board(wx, 101, 44, -5);
      board(wx, 115, 44, 6);
    }
    // ---- A POSTER, torn, hanging by a corner
    g.fillStyle(0xd8d0b8, 0.7).fillTriangle(refs.doorX - 112, 98, refs.doorX - 98, 98, refs.doorX - 112, 112);
    // a FOR LEASE board on a post, out front
    g.fillStyle(0x3a3a3e, 1).fillRect(refs.doorX + 118, 128, 2, 30);
    g.fillStyle(0xe8e4d8, 1).fillRect(refs.doorX + 104, 118, 30, 14);
    g.fillStyle(0x2a5a8a, 1).fillRect(refs.doorX + 104, 118, 30, 3);
    centerText(this, refs.doorX + 119, 126, 'LEASE', 0x2a2a2a).setDepth(6);
    // ---- NEGLECT: graffiti, weeds out of every crack, rubbish, a puddle
    g.fillStyle(0x8a3a8a, 0.8).fillRect(refs.doorX + 30, 128, 18, 2).fillRect(refs.doorX + 32, 123, 2, 9).fillRect(refs.doorX + 42, 123, 2, 9);
    g.fillStyle(0x3a7a8a, 0.7).fillRect(refs.doorX - 50, 126, 12, 2).fillRect(refs.doorX - 46, 122, 2, 8);
    for (const wx of [d.x - 5, d.x + d.w + 3, refs.doorX - 90, refs.doorX + 70, 52, 266]) {
      g.fillStyle(0x4a7a3a, 1).fillRect(wx, 145, 1, 6).fillRect(wx - 2, 147, 2, 1).fillRect(wx + 1, 146, 2, 1);
      g.fillStyle(0x6a9a4a, 1).fillRect(wx - 1, 144, 3, 1);
    }
    g.fillStyle(0x3a4048, 0.8).fillEllipse(196, 166, 40, 5);
    g.fillStyle(0x9aa4ae, 0.35).fillRect(186, 165, 14, 1);
    for (let k = 0; k < 18; k++) {
      g.fillStyle([0xd8d0c0, 0x6a6a6a, 0x8a6a40, 0x2a3a5a][k % 4], 0.85).fillRect(40 + Math.random() * 240, 150 + Math.random() * 8, 2 + Math.random() * 3, 1 + Math.random() * 2);
    }
    // a pigeon on the sill, the only one still coming here
    g.fillStyle(0x6a6e78, 1).fillRect(refs.doorX - 60, 120, 5, 3).fillRect(refs.doorX - 57, 118, 2, 2);
    g.fillStyle(0xd8a040, 1).fillRect(refs.doorX - 55, 119, 1, 1);
    // and behind the boards of the right-hand window, in the dark, two eyes
    this.eyes = this.add.graphics().setDepth(5.5);
    this.eyes.fillStyle(0xd8e060, 1).fillRect(refs.doorX + 56, 107, 2, 1).fillRect(refs.doorX + 64, 107, 2, 1);
    this.eyes.setAlpha(0);
    this.eyes.setVisible(false);
    this.player = new Player(this, -10, 162, false);
    this.player.sprite.setDepth(20);
    this.walkTo = refs.doorX - 20;
    this.black.setAlpha(1);
    audio.setScene({ ambience: ['wind_low'] });
    this.tweens.add({ targets: this.black, alpha: 0, duration: 1800 });
    this.time.delayedCall(4200, () => {
      this.say('Closed.', 2.2);
      this.say('Boarded up. All of it.', 2.6);
      this.say('Where did everyone go?', 2.6);
      this.say('...and what happened to Froggy?', 3.4);
    });
    // a glint behind the boards, and gone
    this.time.delayedCall(12500, () => {
      if (!this.eyes) return;
      this.eyes.setVisible(true);
      this.t = 0;
      audio.sfx('eerie_swell', 0.4);
      this.time.delayedCall(2400, () => this.eyes?.setVisible(false));
    });
    this.time.delayedCall(16000, () => {
      this.tweens.add({
        targets: this.black,
        alpha: 1,
        duration: 2600,
        onComplete: () => {
          this.act = 'done';
          this.scene.start('EndCard', { title: 'THE END', sub: 'Froggy is still out there.' });
        },
      });
    });
  }

  // ------------------------------------------------------------- words

  private say(text: string, dur: number): void {
    this.queue.push({ text, dur });
    if (!this.lineText.visible) this.nextLine();
  }

  private nextLine(): void {
    const l = this.queue.shift();
    if (!l) {
      this.lineText.setVisible(false);
      this.linePlate.setVisible(false);
      return;
    }
    this.lineText.setText(l.text).setVisible(true);
    const b = this.lineText.getBounds();
    this.linePlate.setPosition(b.x - 4, b.y - 3).setDisplaySize(b.width + 8, b.height + 6).setVisible(true);
    this.lineT = l.dur;
  }

  private tickLines(dt: number): void {
    if (!this.lineText.visible) return;
    this.lineT -= dt;
    if (this.lineT <= 0) this.nextLine();
  }
}

// ================================================================ the paper

/**
 * The next morning's front page, as a canvas: aged newsprint, a masthead, a
 * banner headline, three columns of copy, two halftone photographs with
 * captions, and the odds and ends down the side that make it a newspaper.
 */
function paintNewspaper(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = PAPER_W;
  c.height = PAPER_H;
  const g = c.getContext('2d')!;
  let q = 41;
  const R = () => ((q = (q * 16807) % 2147483647) / 2147483647);
  const INK = '#1c1a17';
  const SERIF = 'Georgia, "Times New Roman", Times, serif';

  // ---- the paper itself: off-white, yellowed at the edges, fibres, a fold
  g.fillStyle = '#e8e0c8';
  g.fillRect(0, 0, PAPER_W, PAPER_H);
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = R() < 0.5 ? 'rgba(120,100,70,0.06)' : 'rgba(255,255,245,0.08)';
    g.fillRect(R() * PAPER_W, R() * PAPER_H, 1 + R() * 2, 1);
  }
  for (let i = 0; i < 220; i++) {
    g.strokeStyle = 'rgba(110,90,60,0.07)';
    g.lineWidth = 0.6;
    const x = R() * PAPER_W;
    const y = R() * PAPER_H;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + (R() - 0.5) * 20, y + (R() - 0.5) * 20, x + (R() - 0.5) * 30, y + (R() - 0.5) * 30);
    g.stroke();
  }
  const edge = g.createRadialGradient(PAPER_W / 2, PAPER_H / 2, PAPER_H * 0.35, PAPER_W / 2, PAPER_H / 2, PAPER_H * 0.75);
  edge.addColorStop(0, 'rgba(160,130,70,0)');
  edge.addColorStop(1, 'rgba(160,130,70,0.35)');
  g.fillStyle = edge;
  g.fillRect(0, 0, PAPER_W, PAPER_H);
  // the fold across the middle
  const fold = g.createLinearGradient(0, PAPER_H / 2 - 14, 0, PAPER_H / 2 + 14);
  fold.addColorStop(0, 'rgba(0,0,0,0)');
  fold.addColorStop(0.48, 'rgba(0,0,0,0.12)');
  fold.addColorStop(0.52, 'rgba(255,255,255,0.18)');
  fold.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fold;
  g.fillRect(0, PAPER_H / 2 - 14, PAPER_W, 28);

  const M = 46;
  const W = PAPER_W - M * 2;
  // ---- masthead
  g.fillStyle = INK;
  g.font = `italic 15px ${SERIF}`;
  g.textAlign = 'left';
  g.fillText('"All the news from the end of the line"', M, 58);
  g.textAlign = 'right';
  g.fillText('LATE CITY EDITION', M + W, 58);
  g.textAlign = 'center';
  g.font = `bold 86px ${SERIF}`;
  g.fillText('The Daily Croak', PAPER_W / 2, 140);
  g.fillRect(M, 156, W, 4);
  g.fillRect(M, 164, W, 1);
  g.font = `13px ${SERIF}`;
  g.textAlign = 'left';
  g.fillText('VOL. CXII ... No. 41', M, 182);
  g.textAlign = 'center';
  g.fillText('WEDNESDAY, MORNING EDITION', PAPER_W / 2, 182);
  g.textAlign = 'right';
  g.fillText('PRICE 50 CENTS', M + W, 182);
  g.fillRect(M, 190, W, 1);
  g.fillRect(M, 193, W, 3);

  // ---- the banner
  g.textAlign = 'center';
  g.font = `bold 58px ${SERIF}`;
  g.fillText('ARCADE DRIFTER ARRESTED', PAPER_W / 2, 262, W);
  g.font = `bold 46px ${SERIF}`;
  g.fillText('AFTER NIGHT OF CHAOS AT HOTEL', PAPER_W / 2, 314);
  g.font = `italic 22px ${SERIF}`;
  g.fillText('Grand Lily left wrecked; suspect blames "a giant frog"', PAPER_W / 2, 350);
  g.fillRect(M, 366, W, 1);

  // ---- the lead photograph: the hotel, taped off, police lights
  const photo = (x: number, y: number, w: number, h: number, paint: (p: CanvasRenderingContext2D, w: number, h: number) => void) => {
    // drawn small, then screened into dots like a press photo
    const pw = Math.floor(w / 5);
    const ph = Math.floor(h / 5);
    const src = document.createElement('canvas');
    src.width = pw;
    src.height = ph;
    const p = src.getContext('2d')!;
    paint(p, pw, ph);
    const px = p.getImageData(0, 0, pw, ph).data;
    g.fillStyle = '#f0ead6';
    g.fillRect(x, y, w, h);
    g.fillStyle = INK;
    for (let yy = 0; yy < ph; yy++) {
      for (let xx = 0; xx < pw; xx++) {
        const i = (yy * pw + xx) * 4;
        const lum = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255;
        const r = (1 - lum) * 2.9;
        if (r < 0.25) continue;
        g.beginPath();
        g.arc(x + xx * 5 + 2.5 + (yy % 2) * 1.2, y + yy * 5 + 2.5, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.strokeStyle = INK;
    g.lineWidth = 1.5;
    g.strokeRect(x, y, w, h);
  };
  const PX = M;
  const PY = 384;
  const PWID = 520;
  const PHGT = 330;
  photo(PX, PY, PWID, PHGT, (p, w, h) => {
    p.fillStyle = '#2a2a2a';
    p.fillRect(0, 0, w, h);
    // the hotel front
    p.fillStyle = '#6a6a6a';
    p.fillRect(w * 0.12, h * 0.05, w * 0.76, h * 0.7);
    p.fillStyle = '#9a9a9a';
    for (let yy = 0.1; yy < 0.6; yy += 0.12) for (let xx = 0.16; xx < 0.82; xx += 0.1) p.fillRect(w * xx, h * yy, w * 0.05, h * 0.06);
    // the smashed doors, dark
    p.fillStyle = '#111';
    p.fillRect(w * 0.43, h * 0.5, w * 0.14, h * 0.25);
    // tape across them
    p.fillStyle = '#e8e8e8';
    p.fillRect(w * 0.2, h * 0.62, w * 0.6, h * 0.03);
    p.fillRect(w * 0.25, h * 0.7, w * 0.5, h * 0.025);
    // a police car, its lightbar flaring
    p.fillStyle = '#d8d8d8';
    p.fillRect(w * 0.02, h * 0.74, w * 0.34, h * 0.14);
    p.fillStyle = '#222';
    p.fillRect(w * 0.06, h * 0.84, w * 0.06, h * 0.08);
    p.fillRect(w * 0.26, h * 0.84, w * 0.06, h * 0.08);
    p.fillStyle = '#fff';
    p.beginPath();
    p.arc(w * 0.17, h * 0.72, w * 0.07, 0, Math.PI * 2);
    p.fill();
    // officers, silhouettes
    p.fillStyle = '#111';
    for (const xx of [0.58, 0.66, 0.8]) {
      p.fillRect(w * xx, h * 0.66, w * 0.035, h * 0.22);
      p.beginPath();
      p.arc(w * (xx + 0.017), h * 0.63, w * 0.02, 0, Math.PI * 2);
      p.fill();
    }
    p.fillStyle = '#555';
    p.fillRect(0, h * 0.88, w, h * 0.12);
  });
  g.font = `italic 14px ${SERIF}`;
  g.textAlign = 'left';
  g.fillText('POLICE TAPE across the shattered entrance of the Grand Lily Hotel in the early hours of', PX, PY + PHGT + 20);
  g.fillText('yesterday morning. Damage throughout the building is described as "extensive." (Staff photo)', PX, PY + PHGT + 38);

  // ---- the second photograph: led away
  const SX = PX + PWID + 24;
  const SW = M + W - SX;
  photo(SX, PY, SW, 230, (p, w, h) => {
    p.fillStyle = '#3a3a3a';
    p.fillRect(0, 0, w, h);
    p.fillStyle = '#7a7a7a';
    p.fillRect(0, h * 0.7, w, h * 0.3);
    // two officers, a hooded figure between them, hands behind
    for (const [xx, hood] of [[0.22, false], [0.46, true], [0.7, false]] as const) {
      p.fillStyle = hood ? '#6a6a6a' : '#151515';
      p.fillRect(w * xx, h * 0.32, w * 0.14, h * 0.5);
      p.beginPath();
      p.arc(w * (xx + 0.07), h * 0.25, w * 0.06, 0, Math.PI * 2);
      p.fill();
      if (hood) {
        p.fillStyle = '#c8c8c8';
        p.beginPath();
        p.arc(w * (xx + 0.07), h * 0.27, w * 0.035, 0, Math.PI * 2);
        p.fill();
      }
    }
  });
  g.font = `italic 13px ${SERIF}`;
  const cap2 = 'THE SUSPECT is escorted from the scene. He offered no resistance.';
  wrap(g, cap2, SX, PY + 250, SW, 17);

  // ---- the copy, in columns
  const body =
    'The Grand Lily Hotel was left in ruins early yesterday after what police called "a night of senseless destruction," ending with the arrest of a young man found alone in the lobby. ' +
    'Officers responding to reports of screaming and breaking glass found the front doors smashed from the inside, the stairwell door torn from its hinges and a sixth-floor window broken outward. ' +
    'Room 612 was "turned over completely," according to one officer at the scene. No staff were found on the premises. ' +
    'The suspect, who had checked into the hotel that evening, surrendered at the front entrance after repeated warnings. ' +
    'In a statement described by investigators as "frankly bizarre," he claimed he had been pursued through the building by "a giant frog." ' +
    'Police have found no evidence to support the claim. Footage from the hotel\'s security cameras is said to have been "damaged beyond recovery." ' +
    'The suspect is also understood to have been a regular at the arcade on the edge of town, where staff declined to comment. ' +
    'A court date has been set. Charges include criminal damage and trespass. ' +
    'Residents of the street say the hotel had been quiet for years. "Nothing ever happens here," said one. "Not until now."';
  g.font = `17px ${SERIF}`;
  g.fillStyle = INK;
  const colTop = 792;
  const cols = 3;
  const gut = 22;
  const colW = (W - gut * (cols - 1)) / cols;
  // a byline over the first column
  g.font = `bold 13px ${SERIF}`;
  g.fillText('BY A STAFF REPORTER', M, colTop - 8);
  g.font = `17px ${SERIF}`;
  const lines = layout(g, body, colW);
  const perCol = Math.ceil(lines.length / cols);
  for (let ci = 0; ci < cols; ci++) {
    const x = M + ci * (colW + gut);
    for (let li = 0; li < perCol; li++) {
      const line = lines[ci * perCol + li];
      if (!line) break;
      g.fillText(line, x, colTop + 18 + li * 22);
    }
    if (ci > 0) g.fillRect(x - gut / 2, colTop - 4, 1, perCol * 22 + 10);
  }
  // a drop cap's worth of weight at the start
  const lastY = colTop + 18 + perCol * 22;

  // ---- below the fold: a side story, the weather, an index
  g.fillRect(M, lastY + 10, W, 2);
  g.font = `bold 26px ${SERIF}`;
  g.textAlign = 'left';
  g.fillText('"GIANT FROG" SIGHTINGS DISMISSED', M, lastY + 46);
  g.font = `17px ${SERIF}`;
  wrap(
    g,
    'Police yesterday dismissed a string of reports of a "frog-like figure" seen near the old road west of town. "There is no frog," a spokesman said. Several callers described it as "very tall."',
    M,
    lastY + 72,
    W * 0.62,
    22,
  );
  const BX = M + W * 0.66;
  g.strokeStyle = INK;
  g.lineWidth = 1;
  g.strokeRect(BX, lastY + 24, W * 0.34, 150);
  g.font = `bold 15px ${SERIF}`;
  g.fillText('WEATHER', BX + 10, lastY + 46);
  g.font = `14px ${SERIF}`;
  g.fillText('Overcast. Fog by evening.', BX + 10, lastY + 68);
  g.font = `bold 15px ${SERIF}`;
  g.fillText('INSIDE', BX + 10, lastY + 98);
  g.font = `14px ${SERIF}`;
  g.fillText('Arcade owner silent ........ 4', BX + 10, lastY + 120);
  g.fillText('Hotel to close "for now" ..... 6', BX + 10, lastY + 140);
  g.fillText('Crossword ................. 19', BX + 10, lastY + 160);
  return c;
}

/** Break copy into lines that fit `w`. */
function layout(g: CanvasRenderingContext2D, text: string, w: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (g.measureText(t).width > w && line) {
      out.push(line);
      line = word;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, lh: number): void {
  layout(g, text, w).forEach((l, i) => g.fillText(l, x, y + i * lh));
}
