/**
 * THE STAFF, ON THE DRIFTER'S RIG.
 *
 * The counter kid in the arcade, the dealer at the card table and the
 * concierge at the hotel desk used to be drawn as smooth vector cartoons, a
 * different kind of drawing from every other person in the game.  They are
 * built the way the player is now: the same 25-pixel grids, the same
 * one-pixel ink outline, the same lit-and-shaded letters -- each in their own
 * uniform, with their own head.  (See art/player `Look` and `paintFigure`.)
 */

import type { Look } from './player';

/** A short, tidy head of hair, no hat. */
const NEAT_HEAD = [
  '...rrrrr....',
  '..rrrrrrrr..',
  '..rrrrrrrr..',
  '..sSSSSSSs..',
  '..SSSSSSSs..',
  '...SSSSSs...',
  '...SSSSSs...',
  '....SSSs....',
  '.....ss.....',
];

/**
 * The prize-counter kid: the arcade's wine polo with a cream collar and a
 * green frog on the pocket, a wine cap on backwards (the cream brim out
 * behind), ginger hair, freckles.
 */
export const STAFFER_LOOK: Look = {
  head: [
    '...BBBBBB...',
    '..BBBBBBBB..',
    'bbbBBBBBBr..',
    '..rSSSSSSr..',
    '..rSSSSSSs..',
    '...SFSFSs...',
    '...SSSSSs...',
    '....SSSs....',
    '.....ss.....',
  ],
  cols: {
    B: 0x8a3a5a,
    b: 0xf0e0c8,
    r: 0xc8682a,
    S: 0xf0c8a0,
    s: 0xd0a080,
    F: 0xc88a60,
    C: 0x8a3a5a,
    c: 0xa04a6a,
    D: 0x6a2a44,
    w: 0xf0e0c8,
    P: 0x6fbb6a,
    J: 0x2b303c,
    j: 0x20242e,
    K: 0x1a1a20,
    W: 0x2a2a30,
    T: 0x1a1a20,
  },
};

/**
 * The dealer: black suit, white shirt at the collar, a red silk square in
 * the breast pocket, black hair slicked flat, clean-shaven.
 */
export const DEALER_LOOK: Look = {
  head: NEAT_HEAD,
  cols: {
    r: 0x16141a,
    S: 0xc89a78,
    s: 0xa07a5a,
    C: 0x1c1e26,
    c: 0x2c2f3a,
    D: 0x101118,
    w: 0xf2f0ea,
    P: 0xc4303a,
    J: 0x16171e,
    j: 0x0e0f14,
    K: 0x0a0a0e,
    W: 0x1c1c22,
    T: 0x0a0a0e,
  },
};

/**
 * The concierge at the hotel desk: navy blazer, white shirt, a gold name
 * badge on the chest, brown hair neatly cut.
 */
export const CLERK_LOOK: Look = {
  head: NEAT_HEAD,
  cols: {
    r: 0x4a3222,
    S: 0xe8c0a0,
    s: 0xc49a78,
    C: 0x1e2a4a,
    c: 0x2e3c62,
    D: 0x141c34,
    w: 0xf2f2ee,
    P: 0xe8c040,
    J: 0x1a2238,
    j: 0x12182a,
    K: 0x0c0c10,
    W: 0x22222a,
    T: 0x0c0c10,
  },
};

/**
 * The old man outside Home and Hearth, sat against its wall: a navy watch
 * cap, long grey hair down past it, a full white beard, a brown coat with a
 * green patch and a red scarf, dark trousers and broken boots.  Not the
 * drifter: his own head and colours, on the same rig, in the same pose.
 */
export const HOMELESS_LOOK: Look = {
  head: [
    '...BBBBBB...',
    '..BBBBBBBB..',
    '..bbbbbbbb..',
    '.rrSSSSSSrr.',
    '.rrSSSSSsrr.',
    '..rGSSSsGr..',
    '..GGGGGGGG..',
    '...GGGGGg...',
    '....GGGg....',
  ],
  cols: {
    B: 0x3a4a6a,
    b: 0x4e5e84,
    r: 0xb8b0a0,
    S: 0xc89870,
    s: 0xa07850,
    G: 0xdcd8cc,
    g: 0xb4b0a4,
    C: 0x7a4a2a,
    c: 0x8e5a36,
    D: 0x5a341e,
    P: 0x3a6a4a,
    w: 0x9a2a2a,
    J: 0x3a3a44,
    j: 0x2a2a34,
    K: 0x2a1e16,
    W: 0x4a3a2a,
    T: 0x2a1e16,
  },
};
