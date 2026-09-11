/**
 * Intro cutscene.  PRD §7.4, rewritten.
 *
 * The player used to be a kid who found ten dollars.  He is now a man who has
 * run out of everything, sitting on the kerb outside an arcade, and the tokens
 * he starts with are not his — they are a float from a man in a black hat who
 * wants the prizes and does not want to pay the counter's prices for them.
 *
 * The story is told in four cards and then handed over as a scene: text, then
 * the street, then the offer, then you are stood on the pavement with a job.
 * The `seed` credit here is still the one and only time tokens appear from
 * nowhere — apart from Froggy's five, and he wants something for those.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { ledger } from '../core/ledger';
import { centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { paintExterior, startSignFlicker, KERB_Y, MAN_X } from '../art/exterior';
import { MysteryMan } from '../art/mysteryMan';
import { Player } from '../art/player';
import { froggyLayer } from '../render/froggyLayer';

export const STARTING_TOKENS = 20;

/** The cards, and how long each sits there.  Reading speed, not game speed. */
const CARDS: Array<{ lines: string[]; ms: number }> = [
  { lines: ['The job went first.'], ms: 2800 },
  { lines: ['Then the flat.', 'Then everything that was in it.'], ms: 3400 },
  {
    lines: ['That was seven months ago.', 'You have been on the street since.'],
    ms: 3600,
  },
  {
    lines: ['This afternoon you are sat outside an arcade,', 'because it is warm and nobody moves you on.'],
    ms: 3800,
  },
];

/** What he says, once he is stood over you. */
const OFFER: Array<{ line: string; ms: number }> = [
  { line: '"That counter in there sells a stuffed rabbit', ms: 2600 },
  { line: 'for two hundred tokens. I want it."', ms: 2600 },
  { line: '"I am not paying their prices. You will."', ms: 2800 },
  { line: '"Win me what is on those shelves and I pay you', ms: 2600 },
  { line: 'cash. Half of what it cost. In your hand."', ms: 3000 },
  { line: 'He puts a bag of tokens on the kerb.', ms: 2600 },
];

type Phase = 'cards' | 'street' | 'offer' | 'done';

export class IntroCutscene extends Phaser.Scene {
  private phase: Phase = 'cards';
  private card = 0;
  private line = 0;
  private caption!: Phaser.GameObjects.BitmapText;
  private skip!: Phaser.GameObjects.BitmapText;
  private player: Player | null = null;

  constructor() {
    super('IntroCutscene');
  }

  create(): void {
    froggyLayer.clear();
    this.phase = 'cards';
    this.card = 0;
    this.line = 0;
    this.player = null;

    fadeIn(this);
    audio.setScene({ music: 'theme_arcade' });

    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black).setOrigin(0, 0);
    this.caption = centerText(this, GAME_W / 2, GAME_H / 2, '', PALETTE.cream).setDepth(900);
    this.skip = text(this, GAME_W - 62, GAME_H - 12, '[ESC] SKIP', PALETTE.ash)
      .setAlpha(0.5)
      .setDepth(900);

    // Esc skips the whole thing — the float is still handed over (PRD §7.4).
    this.input.keyboard?.on('keydown-ESC', () => this.finish());
    this.input.on('pointerdown', () => this.nudge());

    this.showCard();
  }

  // ------------------------------------------------------------------ cards

  private showCard(): void {
    const card = CARDS[this.card];
    if (!card) {
      this.toStreet();
      return;
    }
    this.caption.setText(card.lines.join('\n')).setAlpha(0);
    this.tweens.add({ targets: this.caption, alpha: 1, duration: 700 });
    this.time.delayedCall(card.ms, () => {
      if (this.phase !== 'cards') return;
      this.tweens.add({
        targets: this.caption,
        alpha: 0,
        duration: 600,
        onComplete: () => {
          this.card++;
          this.showCard();
        },
      });
    });
  }

  /** A click hurries the current card along, but never skips the beat. */
  private nudge(): void {
    if (this.phase === 'cards') this.time.delayedCall(0, () => {});
  }

  // ----------------------------------------------------------------- street

  private toStreet(): void {
    if (this.phase !== 'cards') return;
    this.phase = 'street';
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.children.removeAll();
      this.cameras.main.fadeIn(900, 0, 0, 0);
      audio.setScene({ music: 'theme_arcade', ambience: ['street_dusk'] });

      const refs = paintExterior(this, { night: false, day: true });
      startSignFlicker(this, refs);

      // Sat on the kerb, off to one side of the doors, out of everyone's way.
      this.player = new Player(this, MAN_X + 34, KERB_Y, true);
      this.player.sprite.setScale(1, 0.72); // sitting: the same body, folded up

      this.caption = centerText(this, GAME_W / 2, GAME_H - 20, '', PALETTE.cream).setDepth(900);
      this.skip = text(this, GAME_W - 62, GAME_H - 12, '[ESC] SKIP', PALETTE.ash)
        .setAlpha(0.5)
        .setDepth(900);
      this.input.keyboard?.on('keydown-ESC', () => this.finish());

      this.time.delayedCall(1400, () => this.manArrives());
    });
  }

  private manArrives(): void {
    if (this.phase !== 'street') return;
    this.phase = 'offer';

    // He walks in from the left and stops over you.  No music sting; he is a
    // man on a pavement, and the game is careful not to say otherwise.
    const man = new MysteryMan(this, -20, KERB_Y + 4);
    this.tweens.add({
      targets: man.root,
      x: MAN_X,
      duration: 2600,
      ease: 'Sine.easeOut',
      onComplete: () => this.nextLine(),
    });
    audio.sfx('footstep_concrete');
  }

  private nextLine(): void {
    if (this.phase !== 'offer') return;
    const beat = OFFER[this.line];
    if (!beat) {
      this.dropTokens();
      return;
    }
    this.caption.setText(beat.line).setAlpha(0);
    this.tweens.add({ targets: this.caption, alpha: 1, duration: 400 });
    this.time.delayedCall(beat.ms, () => {
      this.line++;
      this.nextLine();
    });
  }

  /** The float.  Twenty tokens, on the kerb, take it or do not. */
  private dropTokens(): void {
    if (this.phase !== 'offer') return;
    audio.sfx('coin_drop');
    for (let i = 0; i < 8; i++) {
      const coin = this.add.circle(MAN_X + 14 + Phaser.Math.Between(-4, 4), KERB_Y - 20, 2, PALETTE.gold);
      this.tweens.add({
        targets: coin,
        y: KERB_Y - 2 + Phaser.Math.Between(-2, 2),
        x: coin.x + Phaser.Math.Between(-10, 10),
        duration: 380 + i * 20,
        ease: 'Bounce.easeOut',
      });
    }
    this.caption.setText('twenty tokens. a start.').setAlpha(0);
    this.tweens.add({ targets: this.caption, alpha: 1, duration: 500 });
    this.time.delayedCall(2600, () => this.finish());
  }

  private finish(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.skip?.setVisible(false);
    if (ledger.balance() === 0 && !store.get().seenIntro) {
      ledger.credit(STARTING_TOKENS, 'seed');
    }
    store.flush();
    // Out onto the street proper: the doors are open and the man is waiting.
    fadeToScene(this, 'ExteriorDay');
  }
}
