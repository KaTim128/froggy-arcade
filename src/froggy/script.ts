/**
 * Everything Froggy says.  PRD §8.4.
 *
 * He has three speaking moments in the entire game: the tutorial, the charity,
 * and the second bust.  After "You can go now." he never speaks again.
 */

import type { DialogueLine } from './dialogue';

/** Screen regions the tutorial points at (hub coordinates). */
export interface TutorialTargets {
  tokenHud: { x: number; y: number; w: number; h: number };
  cheapCabinet: { x: number; y: number; w: number; h: number };
  hardCabinet: { x: number; y: number; w: number; h: number };
  prizeCounter: { x: number; y: number; w: number; h: number };
}

export function tutorialScript(t: TutorialTargets): DialogueLine[] {
  return [
    {
      text: 'Well well well! A new face. Welcome to my arcade, friend.',
    },
    {
      text: "See these? Froggy-tokens. Little gold coins with my handsome face on 'em. They're how you play.",
      highlight: t.tokenHud,
    },
    {
      text: 'Cheap games take one to three tokens. The tougher ones take five or more!',
      highlight: t.hardCabinet,
    },
    {
      // The pause is written into the line: the typewriter slows over the ellipsis.
      text: 'Win a game, win tokens. Simple.   Lose a game... well.',
      highlight: t.cheapCabinet,
    },
    {
      text: "Cash 'em in at the counter for prizes. That's where you get all the good froggy stuff.",
      highlight: t.prizeCounter,
    },
    // PRD §8.4 line 6 / QFD VOC-16 used to sit here: "Anyway. You're going to
    // do just fine here.", delivered frozen and blank-eyed.  It was the only
    // foreshadowing in Act I, and it is gone at the customer's request — cut,
    // not rewritten.  The tutorial now ends warm and says nothing about what
    // happens later.  Do not put a replacement line in this gap.
    {
      text: '...Have fun!',
    },
  ];
}

/** PRD §7.7 — fires once, on the first zero balance. */
export const charityScript: DialogueLine[] = [
  {
    text: "Aw, tapped out already? Don't sweat it. Ten tokens, on the house. Because I like your face.",
    holdAfter: 600,
    auto: true,
  },
];

/**
 * PRD §7.8 — the hinge of the whole game.
 * The three-second hold is a hard requirement, not a suggestion.
 *
 * He looks exactly as he always has here — big friendly pupils, the idle
 * bounce — at the customer's request.  The pinprick-pupil stare was cut from
 * this box: the words and the wait do the turn on their own, and the face
 * that says them stays the one you were fond of.
 */
export const secondBustScript: DialogueLine[] = [
  {
    text: "Oops. Looks like you're all out of froggy-tokens.",
    holdAfter: 3000,
    auto: true,
  },
  {
    text: 'You can go now.',
    holdBefore: 400,
    holdAfter: 1400,
    auto: true,
  },
];
