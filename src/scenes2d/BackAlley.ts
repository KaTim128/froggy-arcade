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

    this.add.rectangle(0, 0, GAME_W, GAME_H, c(PALETTE.night)).setOrigin(0, 0);
    // brick walls closing in on both sides
    this.add.rectangle(0, 0, 40, GAME_H, c(PALETTE.black)).setOrigin(0, 0);
    this.add.rectangle(GAME_W - 26, 0, 26, GAME_H, c(PALETTE.black)).setOrigin(0, 0);
    this.add.rectangle(40, 0, GAME_W - 66, 150, c(PALETTE.nightMid)).setOrigin(0, 0);
    for (let i = 0; i < 9; i++) {
      this.add.rectangle(44 + i * 28, 14 + (i % 2) * 8, 24, 5, c(PALETTE.night)).setOrigin(0, 0);
    }
    if (this.chained && time !== 'midnight') {
      // a strip of the sky the street is under, over the top of the walls
      this.add.rectangle(40, 0, GAME_W - 66, 6, time === 'day' ? PALETTE.tealLight : PALETTE.amber).setOrigin(0, 0).setAlpha(0.55);
    }

    // ground
    this.add.rectangle(0, 150, GAME_W, 30, c(PALETTE.nightMid)).setOrigin(0, 0);
    this.add.rectangle(0, 150, GAME_W, 2, c(PALETTE.nightLight)).setOrigin(0, 0);
    // a puddle reflecting nothing useful
    this.add.ellipse(120, 172, 40, 7, c(PALETTE.nightLight)).setAlpha(0.4);

    // dumpster
    this.add.rectangle(56, 126, 54, 26, c(PALETTE.moss)).setOrigin(0, 0);
    this.add.rectangle(56, 122, 54, 5, c(PALETTE.mossLight)).setOrigin(0, 0).setAlpha(0.5);

    // fire escape
    this.add.rectangle(150, 40, 3, 86, c(PALETTE.steel)).setOrigin(0, 0);
    this.add.rectangle(196, 40, 3, 86, c(PALETTE.steel)).setOrigin(0, 0);
    for (let i = 0; i < 7; i++) {
      this.add.rectangle(150, 44 + i * 12, 49, 2, c(PALETTE.steel)).setOrigin(0, 0);
    }

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
