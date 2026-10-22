/**
 * ---- DOWN ONE OF THE ALLEYS between the shops on the east street (the
 * gaps between the fronts: see StreetEast `GAPS`).  Out of the street's
 * sight: a patrol cannot see you in here, and one going by outside shows as
 * its lights sweeping the alley's mouth on the left (game/patrol
 * `alleyWatch`).  Each is its own place (art/alleyArt), lit by the clock.
 * Walk back out at the left, onto the street where you came in.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { KEYS } from '../core/input';
import { centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { Player } from '../art/player';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { backPlate, SUBTITLE_Y } from '../ui/plate';
import { TokenHud } from '../ui/hud';
import { attachPockets } from '../ui/pockets';
import { clock } from '../game/life';
import { ALLEYS, paintSideAlley, type AlleyLight } from '../art/alleyArt';
import { Patrol, alleyWatch } from '../game/patrol';

export class SideAlley extends Phaser.Scene {
  private variant = 0;
  /** Where on the street it opens: you come back out there. */
  private streetX = 0;
  private player!: Player;
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private prompt!: Phaser.GameObjects.BitmapText;
  private mutter!: Phaser.GameObjects.BitmapText;
  private locked = false;
  /** Nobody, unless one of them saw you come down here (game/patrol). */
  private patrol: Patrol | null = null;
  private out = false;

  constructor() {
    super('SideAlley');
  }

  init(data: { variant?: number; streetX?: number } = {}): void {
    this.variant = Phaser.Math.Clamp(Math.round(data.variant ?? 0), 0, ALLEYS.length - 1);
    this.streetX = data.streetX ?? 0;
  }

  create(): void {
    froggyLayer.clear();
    this.locked = false;
    this.out = false;
    fadeIn(this);
    const c = clock();
    const light: AlleyLight = c.dark ? 'night' : c.phase === 'evening' ? 'evening' : 'day';
    audio.setScene({ ambience: light === 'night' ? ['wind_low', 'crickets'] : ['street_dusk'] });
    const key = `side_alley_${this.variant}_${light}`;
    if (!this.textures.exists(key)) {
      const t = this.textures.createCanvas(key, GAME_W, GAME_H);
      if (t) {
        paintSideAlley(t.getContext(), this.variant, light);
        t.refresh();
      }
    }
    this.add.image(0, 0, key).setOrigin(0, 0);
    const L = ALLEYS[this.variant];
    this.player = new Player(this, L.sides[0] + 14, L.walkY, light === 'night');
    this.player.setSurface('gravel');
    new TokenHud(this);
    attachPockets(this, () => this.locked);
    this.prompt = text(this, 0, 0, '', PALETTE.gold).setOrigin(0.5, 0.5).setDepth(801).setVisible(false);
    this.mutter = centerText(this, GAME_W / 2, SUBTITLE_Y, '', PALETTE.cream).setDepth(802).setVisible(false);
    backPlate(this, this.mutter);
    const kb = this.input.keyboard;
    const bind = (n: readonly string[]) => (kb ? n.map((k) => kb.addKey(k)) : []);
    this.keys = { left: bind(KEYS.left), right: bind(KEYS.right) };
    kb?.on('keydown-E', () => this.out && this.leave());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => p.x < 60 && this.leave());
    this.time.delayedCall(500, () => this.say(['OUT OF SIGHT. FOR NOW.', 'NOBODY BACK HERE.', 'QUIET. JUST THE BINS.'][this.variant] ?? 'OUT OF SIGHT.'));
    alleyWatch(this);
    this.patrol = this.follower(light === 'night');
  }

  /** Seen ducking in here: one of them comes down the alley after you. */
  private follower(dark: boolean): Patrol {
    return new Patrol({
      scene: this,
      worldW: GAME_W,
      y: ALLEYS[this.variant].walkY,
      player: () => this.player,
      dark: () => dark,
      alley: true,
      lock: (on) => (this.locked = on),
    });
  }

  private say(m: string): void {
    this.mutter.setText(m).setVisible(true).setAlpha(1);
    this.tweens.killTweensOf(this.mutter);
    this.tweens.add({ targets: this.mutter, alpha: 0, delay: 2000, duration: 500 });
  }

  private leave(): void {
    if (this.locked) return;
    this.locked = true;
    audio.sfx('footstep_gravel', 0.5);
    fadeToScene(this, 'StreetEast', { atX: this.streetX });
  }

  update(_t: number, delta: number): void {
    this.patrol?.update(delta);
    if (this.locked) return;
    const L = ALLEYS[this.variant];
    const dx = (this.keys.right?.some((k) => k.isDown) ? 1 : 0) - (this.keys.left?.some((k) => k.isDown) ? 1 : 0);
    this.player.move(dx, 0, delta, new Phaser.Geom.Rectangle(L.sides[0] + 6, L.walkY, GAME_W - L.sides[0] - L.sides[1] - 14, 0));
    // walked back to the mouth: out again, onto the street
    if (dx < 0 && this.player.x <= L.sides[0] + 6) return this.leave();
    this.out = this.player.x < L.sides[0] + 20;
    this.prompt
      .setText('[E] BACK TO THE STREET')
      .setPosition(Phaser.Math.Clamp(this.player.x, 70, GAME_W - 70), L.walkY - 34)
      .setVisible(this.out);
  }
}
