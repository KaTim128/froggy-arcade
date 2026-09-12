/**
 * The how-to-play card.  PRD MG-8.
 *
 * Every cabinet shows one, and it shows it AFTER the room has taken the
 * tokens and BEFORE the game is built: paying is the commitment, and the
 * tutorial is what you get for it.  The shell does not construct the game
 * module until this card is dismissed, so nothing behind it can be played by
 * accident and no key pressed here reaches the game.
 *
 * It carries two things and only two: what winning is, and which keys this
 * cabinet reads.  A game's controls are its own — the card is built from the
 * module's own `tutorial`, so no cabinet can advertise another one's keys.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { FONT_ADVANCE } from '../render/pixelFont';
import type { Tutorial } from '../minigames/types';

const CARD = { x: 10, y: 22, w: GAME_W - 20, h: GAME_H - 30 };
/** Where the "what it does" column starts, measured from the card's left. */
const DOES_X = 88;
const ROW_H = 10;

export interface TutorialCard {
  /** Tear the card down.  Safe to call twice. */
  destroy(): void;
}

/**
 * Put the card up.  `onStart` runs once, on SPACE, ENTER or a click — the
 * shell builds the game there.  ESC still belongs to the shell and still
 * forfeits: the tokens are spent the moment the room takes them, so quitting
 * out of the tutorial is quitting out of the play (MG-4).
 */
export function showTutorial(
  scene: Phaser.Scene,
  title: string,
  tut: Tutorial,
  onStart: () => void,
): TutorialCard {
  const parts: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    parts.push(o);
    return o;
  };

  // The card sits over a dimmed screen rather than a black one: the cabinet's
  // own colours stay visible underneath, so you can see what you paid for.
  // Interactive, and the input plugin is top-only, so the dimmer also swallows
  // clicks: the QUIT button underneath cannot be hit through the card.
  const dim = keep(
    scene.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.82).setOrigin(0, 0).setDepth(900),
  ).setInteractive({ useHandCursor: true });
  keep(
    scene.add
      .rectangle(CARD.x, CARD.y, CARD.w, CARD.h, PALETTE.ink)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.gold)
      .setDepth(901),
  );
  keep(scene.add.rectangle(CARD.x, CARD.y, CARD.w, 11, PALETTE.plum).setOrigin(0, 0).setDepth(902));
  keep(centerText(scene, GAME_W / 2, CARD.y + 5, `HOW TO PLAY - ${title}`, PALETTE.gold).setDepth(903));

  let y = CARD.y + 17;
  for (const line of tut.objective.slice(0, 3)) {
    keep(centerText(scene, GAME_W / 2, y + 3, line, PALETTE.cream).setDepth(903));
    y += ROW_H;
  }

  y += 3;
  keep(scene.add.rectangle(CARD.x + 8, y, CARD.w - 16, 1, PALETTE.steel).setOrigin(0, 0).setDepth(903));
  y += 4;
  keep(text(scene, CARD.x + 8, y, 'CONTROLS', PALETTE.tealLight).setDepth(903));
  y += ROW_H;

  // Two columns, and the key column is measured rather than guessed: a long
  // key name ("HOLD SPACE") must not run into what it does.
  for (const [keys, does] of tut.controls.slice(0, 6)) {
    const kx = CARD.x + 10;
    keep(text(scene, kx, y, keys, PALETTE.gold).setDepth(903));
    const overrun = Math.max(0, keys.length * FONT_ADVANCE - (DOES_X - 14));
    keep(text(scene, CARD.x + DOES_X + overrun, y, does, PALETTE.fog).setDepth(903));
    y += ROW_H;
  }

  const prompt = keep(
    centerText(scene, GAME_W / 2, CARD.y + CARD.h - 9, 'SPACE OR CLICK TO START', PALETTE.cream).setDepth(903),
  );
  scene.tweens.add({ targets: prompt, alpha: 0.35, duration: 620, yoyo: true, repeat: -1 });

  let done = false;
  const card: TutorialCard = {
    destroy() {
      if (done) return;
      done = true;
      scene.tweens.killTweensOf(prompt);
      kb?.off('keyup-SPACE', begin);
      kb?.off('keyup-ENTER', begin);
      dim.off('pointerup', begin);
      for (const o of parts) o.destroy();
      parts.length = 0;
    },
  };

  const begin = (): void => {
    if (done) return;
    card.destroy();
    audio.sfx('ui_blip');
    onStart();
  };

  // On the way UP, not the way down.  A held key auto-repeats its keydown, and
  // a game built on the first repeat would read the rest of them and the final
  // keyup as play — dismissing on release hands the game a clean keyboard.
  const kb = scene.input.keyboard;
  kb?.on('keyup-SPACE', begin);
  kb?.on('keyup-ENTER', begin);
  dim.on('pointerup', begin);

  return card;
}
