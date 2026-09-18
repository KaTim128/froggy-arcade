/**
 * The how-to-play card.  PRD MG-8.
 *
 * NOTHING IS CHARGED UNTIL THE PLAYER PRESSES PLAY.  Walking up to a cabinet
 * and reading what it wants is free at every machine in the building: the card
 * carries the objective, this cabinet's own controls, and what a go costs, and
 * then offers two buttons.  LEAVE goes back to the room with the player's
 * tokens untouched.  PLAY is the only thing that takes them, and it takes them
 * exactly once — the button latches on the first press, so a player hammering
 * it is charged for one play and not for five.
 *
 * It follows that a player can be at the card without being able to afford the
 * game.  That is not an error to hide: PLAY goes dark, the card says what the
 * machine wants and what is in the pocket, and LEAVE still works.
 *
 * The controls sit on a panel of their own, darker than the card, because they
 * are the part of this that gets read at a glance and they used to be grey on
 * grey over whatever the cabinet was painting underneath.
 *
 * The shell does not construct the game module until PLAY is pressed, so
 * nothing behind the card can be played by accident and no key pressed here
 * reaches the game.  A game's controls are its own — the card is built from
 * the module's own `tutorial`, so no cabinet can advertise another one's keys.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { FONT_ADVANCE } from '../render/pixelFont';
import type { Tutorial } from '../minigames/types';

const CARD = { x: 8, y: 18, w: GAME_W - 16, h: 158 };
/** Where the "what it does" column starts, measured from the card's left. */
const DOES_X = 84;
/**
 * Nine, not ten.  The busiest card in the building is four lines of objective
 * over six rows of controls (Grudge), and at ten the price line ended up
 * underneath the PLAY button.  Everything fits at nine with a couple of pixels
 * to spare, and the price block is placed from the buttons upwards rather than
 * flowed after the panel, so it cannot be pushed off the card again.
 */
const ROW_H = 9;
/** The controls panel: darker than the card, so the keys read at a glance. */
const PANEL_INK = 0x07060c;
const PANEL_EDGE = 0x2f2850;

export interface TutorialCard {
  /** Tear the card down.  Safe to call twice. */
  destroy(): void;
}

export interface TutorialCardOpts {
  title: string;
  tutorial: Tutorial;
  /** What a go costs, in tokens. */
  cost: number;
  /** Tokens in the pocket, for the affordability line. */
  balance: number;
  /**
   * True where the cabinet charges INSIDE the game rather than at the door —
   * the table and the wheel.  PLAY costs nothing at those; the bet does.
   */
  chargesInside?: boolean;
  /** One line under the price, e.g. "WIN: 6 TOKENS". */
  payNote?: string;
  /** Pressed PLAY, and could afford it.  Runs at most once. */
  onPlay: () => void;
  /** Pressed LEAVE, or Esc.  Nothing has been charged. */
  onLeave: () => void;
}

export function showTutorial(scene: Phaser.Scene, opts: TutorialCardOpts): TutorialCard {
  const parts: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    parts.push(o);
    return o;
  };

  const free = opts.chargesInside === true;
  // A fixture that charges inside is always startable; everything else needs
  // the coin up front.
  const affordable = free || opts.balance >= opts.cost;

  // The card sits over a dimmed screen rather than a black one: the cabinet's
  // own colours stay visible underneath, so you can see what you are buying.
  // Interactive, and the input plugin is top-only, so the dimmer also swallows
  // clicks: the QUIT button underneath cannot be hit through the card, and a
  // stray click no longer starts a game the player was still reading about.
  keep(scene.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.86).setOrigin(0, 0).setDepth(900)).setInteractive();
  keep(
    scene.add
      .rectangle(CARD.x, CARD.y, CARD.w, CARD.h, PALETTE.ink)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.gold)
      .setDepth(901),
  );
  keep(scene.add.rectangle(CARD.x, CARD.y, CARD.w, 11, PALETTE.plum).setOrigin(0, 0).setDepth(902));
  keep(centerText(scene, GAME_W / 2, CARD.y + 5, `HOW TO PLAY - ${opts.title}`, PALETTE.gold).setDepth(903));

  const rows = opts.tutorial.controls.slice(0, 6);
  // ---- the objective, out of a TEN ROW BUDGET shared with the controls.
  //
  // Ten is what fits between the title and the price block, and the busiest
  // card in the building spends it four-and-six (Grudge).  A cabinet with
  // fewer keys may spend the slack on saying more about the game -- bowling
  // has four rows of controls and six lines of rules, including what the two
  // bonuses pay -- and nothing may go over the ten, which is the line the
  // price used to end up under.
  let y = CARD.y + 13;
  for (const line of opts.tutorial.objective.slice(0, Math.max(1, 10 - rows.length))) {
    keep(centerText(scene, GAME_W / 2, y + 3, line, PALETTE.cream).setDepth(903));
    y += ROW_H;
  }

  // ---- the controls, on a panel of their own
  y += 2;
  const panelH = rows.length * ROW_H + 12;
  keep(
    scene.add
      .rectangle(CARD.x + 6, y, CARD.w - 12, panelH, PANEL_INK)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PANEL_EDGE)
      .setDepth(903),
  );
  keep(text(scene, CARD.x + 10, y + 2, 'CONTROLS', PALETTE.tealLight).setDepth(904));
  let ry = y + 12;
  // Two columns, and the key column is measured rather than guessed: a long
  // key name ("HOLD SPACE") must not run into what it does.
  for (const [keys, does] of rows) {
    keep(text(scene, CARD.x + 10, ry, keys, PALETTE.gold).setDepth(904));
    const overrun = Math.max(0, keys.length * FONT_ADVANCE - (DOES_X - 14));
    keep(text(scene, CARD.x + DOES_X + overrun, ry, does, PALETTE.cream).setDepth(904));
    ry += ROW_H;
  }
  // ---- the price, and whether it can be met.  Measured up from the buttons.
  const buttonY = CARD.y + CARD.h - 11;
  const priceLine = free
    ? `FREE TO SIT  -  ${opts.cost} TOKEN${opts.cost === 1 ? '' : 'S'} A GO`
    : `${opts.cost} TOKEN${opts.cost === 1 ? '' : 'S'} TO PLAY`;
  keep(
    centerText(scene, GAME_W / 2, buttonY - 26, priceLine, affordable ? PALETTE.gold : PALETTE.blood).setDepth(903),
  );
  // The second line is the shortfall when there is one, and what a win pays
  // when there is not: only ever one of them, and always in the same place.
  const second = affordable
    ? opts.payNote
    : `YOU HAVE ${opts.balance} - YOU NEED ${opts.cost - opts.balance} MORE`;
  if (second) {
    keep(
      centerText(scene, GAME_W / 2, buttonY - 17, second, affordable ? PALETTE.tealLight : PALETTE.ash).setDepth(903),
    );
  }

  // ---- the two buttons.  One of them takes tokens; the other never does.
  let taken = false;
  const play = (): void => {
    if (!affordable) {
      audio.sfx('buzzer', 0.5);
      return;
    }
    // The latch: a player who clicks PLAY four times pays once.
    if (taken || done) return;
    taken = true;
    card.destroy();
    audio.sfx('coin_drop');
    opts.onPlay();
  };
  const leave = (): void => {
    if (taken || done) return;
    taken = true;
    card.destroy();
    audio.sfx('ui_blip');
    opts.onLeave();
  };

  const by = buttonY;
  keep(
    button(scene, GAME_W / 2 - 52, by, affordable ? 'PLAY' : 'CANT PLAY', play, {
      width: 88,
      height: 15,
      fill: affordable ? PALETTE.tealDark : PALETTE.slate,
      disabled: !affordable,
    }).setDepth(905),
  );
  keep(
    button(scene, GAME_W / 2 + 52, by, 'LEAVE', leave, {
      width: 88,
      height: 15,
      fill: PALETTE.plum,
    }).setDepth(905),
  );

  let done = false;
  const card: TutorialCard = {
    destroy() {
      if (done) return;
      done = true;
      kb?.off('keyup-SPACE', play);
      kb?.off('keyup-ENTER', play);
      for (const o of parts) o.destroy();
      parts.length = 0;
    },
  };

  // On the way UP, not the way down.  A held key auto-repeats its keydown, and
  // a game built on the first repeat would read the rest of them and the final
  // keyup as play — starting on release hands the game a clean keyboard.
  // Esc belongs to the shell, which treats it as LEAVE while the card is up.
  const kb = scene.input.keyboard;
  kb?.on('keyup-SPACE', play);
  kb?.on('keyup-ENTER', play);

  return card;
}
