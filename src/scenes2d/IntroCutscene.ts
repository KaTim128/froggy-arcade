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
 *
 * Nothing here runs on a clock.  Every card and every line of the offer sits
 * there until the arrow in the corner is clicked, so it is read at the
 * player's pace rather than at a guess of it.  Esc still skips the lot.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { ledger } from '../core/ledger';
import { button, centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { paintExterior, startSignFlicker, KERB_Y, MAN_X } from '../art/exterior';
import { MysteryMan } from '../art/mysteryMan';
import { Player } from '../art/player';
import { froggyLayer } from '../render/froggyLayer';

export const STARTING_TOKENS = 20;

/**
 * The cards.  One thought per card, and the next one is a click away.  The
 * text is at 2x, so a line is twenty-six characters at most and the thoughts
 * are broken to fit.
 */
const CARDS: string[][] = [
  ['The job went first.'],
  ['Then the flat.', 'Then everything', 'that was in it.'],
  ['That was seven months ago.', 'You have been on', 'the street since.'],
  ['This afternoon you are', 'sat outside an arcade,', 'because it is warm and', 'nobody moves you on.'],
];

/** What he says, once he is stood over you.  Small, under the street: a caption, not a card. */
const OFFER: string[] = [
  '"That counter in there sells a stuffed rabbit',
  'for two hundred tokens. I want it."',
  '"I am not paying their prices. You will."',
  '"Win me what is on those shelves and I pay you',
  'cash. Half of what it cost. In your hand."',
  'He puts a bag of tokens on the kerb.',
];
/** The cards are big.  Only the cards. */
const CARD_SIZE = 16;

/**
 * The arrow does not appear the instant a line does.  A line fades in over
 * this long, and a click landing during the fade would skip a beat the player
 * never saw.
 */
const ARROW_DELAY_MS = 700;

type Phase = 'cards' | 'street' | 'offer' | 'done';

export class IntroCutscene extends Phaser.Scene {
  private phase: Phase = 'cards';
  private card = 0;
  private line = 0;
  private caption!: Phaser.GameObjects.BitmapText;
  private skip!: Phaser.GameObjects.BitmapText;
  private arrow: Phaser.GameObjects.Container | null = null;
  /** What the arrow does right now.  Null means it is not showing. */
  private onArrow: (() => void) | null = null;
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
    this.onArrow = null;

    fadeIn(this);
    audio.setScene({ music: 'theme_arcade' });

    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black).setOrigin(0, 0);
    this.caption = centerText(this, GAME_W / 2, GAME_H / 2, '', PALETTE.cream, CARD_SIZE).setDepth(900).setCenterAlign();
    this.buildChrome();

    // Esc skips the whole thing — the float is still handed over (PRD §7.4).
    // E, Enter and Space do what the arrow does, for anyone on the keyboard.
    this.input.keyboard?.on('keydown-ESC', () => this.finish());
    for (const k of ['E', 'ENTER', 'SPACE']) this.input.keyboard?.on(`keydown-${k}`, () => this.advance());

    this.showCard();
  }

  update(): void {
    // The arrow breathes while it is waiting on you, the same as the prompt
    // in Froggy's dialogue box.
    if (this.arrow?.visible) this.arrow.setAlpha(0.5 + 0.5 * Math.abs(Math.sin(this.time.now / 300)));
  }

  /**
   * The skip hint and the arrow.  Built twice, because the street rebuilds the
   * scene from nothing.
   */
  private buildChrome(): void {
    this.skip = text(this, 6, GAME_H - 12, '[ESC] SKIP', PALETTE.ash).setAlpha(0.5).setDepth(900);
    this.arrow = button(this, GAME_W - 14, GAME_H - 10, '>', () => this.advance(), { width: 16, height: 13 });
    this.arrow.setDepth(900).setVisible(false);
  }

  /** Show the arrow after a beat, and say what a click on it does. */
  private armArrow(next: () => void, afterMs = ARROW_DELAY_MS): void {
    this.onArrow = null;
    this.arrow?.setVisible(false);
    this.time.delayedCall(afterMs, () => {
      if (this.phase === 'done') return;
      this.onArrow = next;
      this.arrow?.setVisible(true);
    });
  }

  private advance(): void {
    const next = this.onArrow;
    if (!next) return;
    this.onArrow = null;
    this.arrow?.setVisible(false);
    next();
  }

  // ------------------------------------------------------------------ cards

  private showCard(): void {
    const lines = CARDS[this.card];
    if (!lines) {
      this.toStreet();
      return;
    }
    this.caption.setText(lines.join('\n')).setAlpha(0);
    this.tweens.add({ targets: this.caption, alpha: 1, duration: 700 });
    this.armArrow(() => {
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

  // ----------------------------------------------------------------- street

  private toStreet(): void {
    if (this.phase !== 'cards') return;
    this.phase = 'street';
    this.onArrow = null;
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.children.removeAll();
      this.arrow = null;
      this.cameras.main.fadeIn(900, 0, 0, 0);
      audio.setScene({ music: 'theme_arcade', ambience: ['street_dusk'] });

      const refs = paintExterior(this, { night: false, day: true });
      startSignFlicker(this, refs);

      // Sat on the kerb, off to one side of the doors, out of everyone's way.
      this.player = new Player(this, MAN_X + 34, KERB_Y, true);
      this.player.sprite.setScale(1, 0.72); // sitting: the same body, folded up

      this.caption = centerText(this, GAME_W / 2, GAME_H - 20, '', PALETTE.cream).setDepth(900);
      this.buildChrome();

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
    const line = OFFER[this.line];
    if (!line) {
      this.dropTokens();
      return;
    }
    this.caption.setText(line).setAlpha(0);
    this.tweens.add({ targets: this.caption, alpha: 1, duration: 400 });
    this.armArrow(() => {
      this.line++;
      this.nextLine();
    }, 400);
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
    this.armArrow(() => this.finish());
  }

  private finish(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.onArrow = null;
    this.skip?.setVisible(false);
    this.arrow?.setVisible(false);
    if (ledger.balance() === 0 && !store.get().seenIntro) {
      ledger.credit(STARTING_TOKENS, 'seed');
    }
    store.flush();
    // Out onto the street proper: the doors are open and the man is waiting.
    fadeToScene(this, 'ExteriorDay');
  }
}
