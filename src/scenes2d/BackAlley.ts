/**
 * The alley.  PRD §7.12.
 *
 * A dumpster, a fire escape, and a back door standing ajar with a sliver of
 * black behind it -- the arcade's side door, into the new room.  BA-1: the door is a plain [E] like everything else.  No
 * prompt escalates.  Nothing flashes.  The player can walk back out at any
 * time, including from right in front of it.
 *
 * BY DAY.  Once the night in the arcade is behind you, the alley is open off
 * the street again -- the same alley, in whatever light the street is in --
 * but the side door is shut, chained across and padlocked.  You can walk up
 * to it, try it, and walk back out.  Nothing else opens it.
 */

import Phaser from 'phaser';
import { PALETTE, daylight, nightify } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { KEYS } from '../core/input';
import { centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { Player } from '../art/player';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W, GAME_H } from '../render/pixelScaler';

const WALK_Y = 168;
const DOOR_X = 236;

export class BackAlley extends Phaser.Scene {
  private player!: Player;
  private keys!: Record<string, Phaser.Input.Keyboard.Key[]>;
  private prompt!: Phaser.GameObjects.BitmapText;
  private spot: 'door' | 'out' | null = null;
  private locked = false;
  /** After the night: the street's alley, with its door chained. */
  private chained = false;
  private mutter!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('BackAlley');
  }

  create(): void {
    froggyLayer.clear();
    // Scene instances are reused; reset everything mutable.
    this.locked = false;
    this.spot = null;
    const st = store.get();
    this.chained = st.route !== 'ejected';
    // the street's light, run through the alley's own colours
    const time = this.chained ? st.timeOfDay : 'midnight';
    const c = (col: number) => (!this.chained ? col : time === 'midnight' ? nightify(col, 0.35) : time === 'day' ? daylight(col, 0.28) : col);

    fadeIn(this);
    audio.setScene(this.chained && time !== 'midnight' ? { ambience: ['street_dusk'] } : { ambience: ['wind_low', 'crickets'] });

    const key = `alley_${this.chained ? time : 'eject'}`;
    if (!this.textures.exists(key)) paintAlley(this, key, c, this.chained && time !== 'midnight' ? time : null);
    this.add.image(0, 0, key).setOrigin(0, 0);

    if (this.chained) this.paintChainedDoor(c);
    else {
      // the back door — ajar, and behind it nothing but black
      this.add.rectangle(DOOR_X, 100, 34, 50, PALETTE.brown).setOrigin(0, 0);
      this.add.rectangle(DOOR_X + 22, 100, 12, 50, PALETTE.black).setOrigin(0, 0);
      this.add.rectangle(DOOR_X + 21, 100, 1, 50, PALETTE.moon).setOrigin(0, 0).setAlpha(0.25);
    }

    this.player = new Player(this, 70, WALK_Y, time === 'midnight');
    this.player.setSurface('gravel');

    this.prompt = text(this, 0, 0, '', PALETTE.gold).setOrigin(0.5, 0.5).setDepth(801).setVisible(false);
    this.mutter = centerText(this, GAME_W / 2, GAME_H - 18, '', PALETTE.cream).setDepth(802).setVisible(false);

    this.keys = { left: this.bind(KEYS.left), right: this.bind(KEYS.right) };
    this.input.keyboard?.on('keydown-E', () => this.interact());
    this.input.on('pointerdown', () => this.interact());
  }

  private bind(names: readonly string[]): Phaser.Input.Keyboard.Key[] {
    const kb = this.input.keyboard;
    return kb ? names.map((n) => kb.addKey(n)) : [];
  }

  private held(g: string): boolean {
    return this.keys[g]?.some((k) => k.isDown) ?? false;
  }

  /**
   * The side door, shut: the leaf flush in its frame, two lengths of chain
   * crossed over it from the frame's bolts, and a padlock where they meet.
   */
  private paintChainedDoor(c: (n: number) => number): void {
    this.add.rectangle(DOOR_X - 2, 98, 38, 52, c(0x2a2018)).setOrigin(0, 0);
    this.add.rectangle(DOOR_X, 100, 34, 50, c(PALETTE.brown)).setOrigin(0, 0);
    this.add.rectangle(DOOR_X + 2, 104, 30, 18, c(0x5a3c24)).setOrigin(0, 0).setAlpha(0.6);
    this.add.rectangle(DOOR_X + 2, 126, 30, 20, c(0x5a3c24)).setOrigin(0, 0).setAlpha(0.6);
    this.add.rectangle(DOOR_X + 28, 124, 3, 2, c(PALETTE.steel)).setOrigin(0, 0);
    // the chains: links laid along two diagonals, alternately face-on and edge-on
    const g = this.add.graphics();
    const steel = c(0x9aa4ae);
    const dark = c(0x3a4048);
    for (const [x0, y0, x1, y1] of [
      [DOOR_X - 1, 104, DOOR_X + 35, 142],
      [DOOR_X + 35, 104, DOOR_X - 1, 142],
    ]) {
      const n = 13;
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n;
        const y = y0 + ((y1 - y0) * k) / n;
        g.fillStyle(dark, 1).fillRect(x - 1.5, y - 1.5, 3, 3);
        g.fillStyle(steel, 1).fillRect(k % 2 ? x - 1 : x - 0.5, k % 2 ? y - 0.5 : y - 1, k % 2 ? 2 : 1, k % 2 ? 1 : 2);
      }
      // bolted to the frame at each end
      g.fillStyle(dark, 1).fillCircle(x0, y0, 2).fillCircle(x1, y1, 2);
    }
    // the padlock where they cross
    const lx = DOOR_X + 17;
    const ly = 123;
    g.lineStyle(1.5, steel, 1).strokeCircle(lx, ly - 4, 3);
    g.fillStyle(c(0xb08a3a), 1).fillRect(lx - 4, ly - 3, 8, 7);
    g.fillStyle(c(0xe0c070), 1).fillRect(lx - 3, ly - 2, 2, 5);
    g.fillStyle(PALETTE.black, 1).fillRect(lx - 0.5, ly, 1, 2);
  }

  private say(msg: string): void {
    this.mutter.setText(msg).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.mutter);
    this.tweens.add({ targets: this.mutter, alpha: 0, delay: 1800, duration: 600 });
  }

  private interact(): void {
    if (this.locked || !this.spot) return;

    if (this.spot === 'door' && this.chained) {
      // Shut, chained, padlocked: it rattles, and that is all it does.
      audio.sfx('door_rattle', 0.8);
      this.cameras.main.shake(120, 0.002);
      this.say('Chained shut. And padlocked.');
      return;
    }
    this.locked = true;

    if (this.spot === 'out') {
      // back to whichever street you came in off
      fadeToScene(this, this.chained ? 'ExteriorDay' : 'ExteriorNight', this.chained ? { fromAlley: true } : {});
      return;
    }

    // Inside.  This is the last ordinary thing that happens.  The back door is
    // the arcade's SIDE door: it lets you into the new room, dark, and shuts
    // behind you.  See ArcadeLounge.
    audio.sfx('door_open');
    store.patch({ route: 'ejected' });
    store.flush();
    this.time.delayedCall(700, () => fadeToScene(this, 'ArcadeLounge', { fromAlley: true }));
  }

  update(_t: number, delta: number): void {
    if (this.locked) return;

    const dx = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    this.player.move(dx, 0, delta, new Phaser.Geom.Rectangle(46, WALK_Y, GAME_W - 76, 0));

    const px = this.player.x;
    this.spot = px > DOOR_X - 14 ? 'door' : px < 56 ? 'out' : null;

    if (!this.spot) {
      this.prompt.setVisible(false);
      return;
    }
    this.prompt
      .setText(this.spot === 'door' ? (this.chained ? '[E] DOOR' : '[E] OPEN') : '[E] BACK')
      .setPosition(Phaser.Math.Clamp(px, 40, GAME_W - 40), WALK_Y - 34)
      .setVisible(true);
  }
}

const hex = (n: number): string => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;

/**
 * The alley, painted once into a texture: brick walls with their mortar and
 * the odd broken brick, the side walls in shadow, a drainpipe, a caged lamp
 * over the door throwing a cone of light, wet asphalt with cracks and a
 * drain, a proper dumpster (lid, ribs, wheels) with bags beside it, crates,
 * and a fire escape with its landing and ladder.  `c` is the time of day.
 */
function paintAlley(scene: Phaser.Scene, key: string, c: (n: number) => number, sky: string | null): void {
  const tex = scene.textures.createCanvas(key, GAME_W, GAME_H);
  if (!tex) return;
  const g = tex.getContext();
  const col = (n: number) => hex(c(n));
  let seed = 7;
  const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // the back wall: bricks
  g.fillStyle = col(0x3c2a30);
  g.fillRect(0, 0, GAME_W, 152);
  for (let row = 0; row * 6 < 152; row++) {
    const off = row % 2 ? 6 : 0;
    for (let x = -off; x < GAME_W; x += 12) {
      const tone = [0x6a3a34, 0x5e3430, 0x74423a, 0x583030][Math.floor(R() * 4)];
      g.fillStyle = col(tone);
      g.fillRect(x + 1, row * 6 + 1, 10, 4);
      g.fillStyle = col(0x8a5446);
      g.fillRect(x + 1, row * 6 + 1, 10, 1);
      if (R() < 0.04) {
        g.fillStyle = col(0x2a1c20);
        g.fillRect(x + 3, row * 6 + 2, 4, 2);
      }
    }
  }
  // grime running down from the top, darker toward the ground
  const grime = g.createLinearGradient(0, 0, 0, 152);
  grime.addColorStop(0, 'rgba(0,0,0,0.05)');
  grime.addColorStop(1, 'rgba(10,6,10,0.4)');
  g.fillStyle = grime;
  g.fillRect(0, 0, GAME_W, 152);
  if (sky) {
    g.fillStyle = sky === 'day' ? '#8fd4e8' : '#e8a050';
    g.fillRect(40, 0, GAME_W - 66, 6);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(40, 6, GAME_W - 66, 2);
  }
  // the side walls, in shadow, with their own brick edges
  for (const [x, w] of [[0, 40], [GAME_W - 26, 26]]) {
    g.fillStyle = col(0x1c1418);
    g.fillRect(x, 0, w, GAME_H);
    for (let y = 0; y < GAME_H; y += 6) {
      g.fillStyle = col(0x2a1e22);
      g.fillRect(x + ((y / 6) % 2 ? 2 : 6), y + 1, w - 8, 4);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(40, 0, 6, 152);
  g.fillRect(GAME_W - 32, 0, 6, 152);

  // a drainpipe down the wall
  g.fillStyle = col(0x4a5258);
  g.fillRect(118, 0, 4, 150);
  g.fillStyle = col(0x6a747c);
  g.fillRect(118, 0, 1, 150);
  for (const y of [30, 70, 110]) {
    g.fillStyle = col(0x30363a);
    g.fillRect(117, y, 6, 2);
  }

  // ground: wet asphalt, a kerb line, cracks, a drain
  g.fillStyle = col(0x2a2c34);
  g.fillRect(0, 150, GAME_W, 30);
  g.fillStyle = col(0x4a4e58);
  g.fillRect(0, 150, GAME_W, 2);
  for (let i = 0; i < 140; i++) {
    g.fillStyle = R() < 0.5 ? col(0x34363e) : col(0x22242a);
    g.fillRect(Math.floor(R() * GAME_W), 153 + Math.floor(R() * 27), 1 + Math.floor(R() * 2), 1);
  }
  g.strokeStyle = col(0x18191e);
  g.lineWidth = 1;
  for (const [x, y] of [[90, 160], [200, 166], [270, 158]]) {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 6, y + 3);
    g.lineTo(x + 4, y + 7);
    g.lineTo(x + 11, y + 10);
    g.stroke();
  }
  g.fillStyle = col(0x16171c);
  g.fillRect(186, 170, 16, 5);
  g.fillStyle = col(0x3a3c44);
  for (let k = 0; k < 4; k++) g.fillRect(188 + k * 4, 171, 1, 3);
  // a puddle with a light in it
  g.fillStyle = col(0x3e4a5c);
  g.beginPath();
  g.ellipse(132, 172, 20, 3.5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,220,150,0.35)';
  g.fillRect(140, 171, 6, 1);

  // the caged lamp over the door, and its cone of light
  const lx = 253;
  const cone = g.createRadialGradient(lx, 92, 2, lx, 130, 60);
  cone.addColorStop(0, 'rgba(255,214,140,0.45)');
  cone.addColorStop(1, 'rgba(255,214,140,0)');
  g.fillStyle = cone;
  g.beginPath();
  g.moveTo(lx - 4, 92);
  g.lineTo(lx + 4, 92);
  g.lineTo(lx + 44, 178);
  g.lineTo(lx - 44, 178);
  g.fill();
  g.fillStyle = col(0x2a2c30);
  g.fillRect(lx - 6, 84, 12, 3);
  g.fillStyle = '#ffe6a8';
  g.fillRect(lx - 4, 87, 8, 5);
  g.fillStyle = col(0x2a2c30);
  for (let k = 0; k < 3; k++) g.fillRect(lx - 4 + k * 3, 87, 1, 5);

  // dumpster: body with ribs, a lid propped, wheels, and bags beside it
  const dx = 52;
  g.fillStyle = col(0x2f6a3e);
  g.fillRect(dx, 124, 58, 28);
  g.fillStyle = col(0x3f8250);
  g.fillRect(dx, 124, 58, 3);
  for (let k = 0; k < 5; k++) {
    g.fillStyle = col(0x24542f);
    g.fillRect(dx + 6 + k * 11, 128, 2, 22);
  }
  g.fillStyle = col(0x1c4026);
  g.fillRect(dx - 2, 118, 62, 4);
  g.fillStyle = col(0x5aa06a);
  g.fillRect(dx - 2, 118, 62, 1);
  g.fillStyle = col(0xe8e0c8);
  g.fillRect(dx + 20, 134, 18, 6);
  g.fillStyle = col(0x24542f);
  g.fillRect(dx + 22, 136, 14, 1);
  g.fillStyle = col(0x111214);
  for (const wx of [dx + 6, dx + 50]) {
    g.beginPath();
    g.arc(wx, 152, 3, 0, Math.PI * 2);
    g.fill();
  }
  for (const [bx, r, tone] of [[dx + 66, 9, 0x1a1c22], [dx + 76, 7, 0x24262e], [dx + 62, 6, 0x2c2e36]] as const) {
    g.fillStyle = col(tone);
    g.beginPath();
    g.ellipse(bx, 152 - r, r, r, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(160,170,190,0.25)';
    g.fillRect(bx - r / 2, 152 - r * 1.6, 2, 2);
  }
  // crates under the fire escape
  for (const [cx, cy, w] of [[204, 134, 18], [208, 120, 14]]) {
    g.fillStyle = col(0x8a6238);
    g.fillRect(cx, cy, w, 150 - cy - (cy === 120 ? 14 : 0));
    g.fillStyle = col(0x6b4a2a);
    g.strokeStyle = col(0x5a3c22);
    g.strokeRect(cx + 0.5, cy + 0.5, w - 1, (cy === 120 ? 14 : 16) - 1);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + w, cy + (cy === 120 ? 14 : 16));
    g.stroke();
  }

  // the fire escape: a landing with railings, and the ladder down from it
  g.fillStyle = col(0x2c3238);
  g.fillRect(138, 36, 70, 4);
  g.fillStyle = col(0x5a646e);
  g.fillRect(138, 36, 70, 1);
  for (let x = 140; x < 208; x += 6) {
    g.fillStyle = col(0x3a424a);
    g.fillRect(x, 24, 1, 12);
  }
  g.fillRect(138, 24, 70, 2);
  g.fillStyle = col(0x4a545e);
  g.fillRect(152, 40, 3, 86);
  g.fillRect(196, 40, 3, 86);
  for (let i = 0; i < 7; i++) {
    g.fillStyle = col(0x5e6a74);
    g.fillRect(152, 46 + i * 12, 47, 2);
    g.fillStyle = col(0x262c32);
    g.fillRect(152, 48 + i * 12, 47, 1);
  }
  // a window up on the wall, lit or dark
  g.fillStyle = col(0x1a1c24);
  g.fillRect(60, 40, 26, 30);
  g.fillStyle = sky ? 'rgba(140,190,220,0.5)' : 'rgba(255,200,120,0.35)';
  g.fillRect(62, 42, 10, 12);
  g.fillRect(74, 42, 10, 12);
  g.fillRect(62, 56, 10, 12);
  g.fillRect(74, 56, 10, 12);
  g.fillStyle = col(0x6a5a4a);
  g.fillRect(58, 70, 30, 3);
  tex.refresh();
}
