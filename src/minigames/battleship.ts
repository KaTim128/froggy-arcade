/**
 * FROG POND HUNT.  Medium — 3 tokens in, 6 out.
 *
 * Two ponds, a dozen frogs hidden in them, and a search a turn each until one
 * side has found the lot.  It is NOT a naval game with frogs painted on it,
 * and the difference is mechanical rather than cosmetic:
 *
 *   THE FROGS MOVE.  A ship sits where it was put for the whole game, so the
 *                    only thing a player ever does is eliminate squares.  A
 *                    frog with a working ability relocates between turns, so
 *                    a square you cleared is not cleared for ever and the
 *                    game is about tracking rather than about bookkeeping.
 *   CLUES.           Every move leaves something behind -- ripples, bubbles,
 *                    a croak, reeds shaking, eyes above the water.  A clue
 *                    says roughly where something went without saying where
 *                    it is, which is what makes reasoning possible and
 *                    guessing unnecessary.
 *   KNOWLEDGE KEEPS. A frog you have found stays found even after it moves:
 *                    the pad it was on is marked, and it is marked as STALE
 *                    rather than wiped, so what you learned is still worth
 *                    something.
 *   SIX KINDS.       Each with a real advantage and a real cost.  A tiny frog
 *                    is hard to see and can barely move; a bullfrog is
 *                    impossible to miss and can cross the pond.  Nothing here
 *                    is strictly better than anything else.
 *
 * TURN ORDER is fixed and the frogs never move during a search: you search,
 * it resolves, your turn ends, THEN abilities fire and clues appear, then the
 * opponent does the same.  A frog that hopped away from under your finger
 * mid-click would be a bug you could not tell from a rule.
 *
 * THE PONDS ARE NOT GRIDS.  They are irregular runs of lily pads on open
 * water -- each row a different width and offset -- so there is no coordinate
 * to call out and no A1 to write down.  You click a pad.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { button, centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

// ------------------------------------------------------------------ the pond

/**
 * THE SHAPE OF A POND.
 *
 * Rows of differing width, each offset by its own amount, so the whole thing
 * reads as a pond with pads scattered on it rather than as a board.  Both
 * ponds use the same shape -- the game has to be fair -- but neither of them
 * looks like a grid.
 */
const ROWS = [
  { n: 5, off: 1 },
  { n: 7, off: 0 },
  { n: 6, off: 0.5 },
  { n: 7, off: 0 },
  { n: 6, off: 0.5 },
  { n: 5, off: 1 },
];
const PAD_W = 15;
const PAD_H = 13;
const POND_TOP = 52;
const MINE_X = 14;
const THEIRS_X = 176;
const POND_W = 7 * PAD_W;

/** Every pad, in order, with where it sits and which row it came from. */
interface Spot { row: number; col: number; x: number; y: number; }
const SPOTS: Spot[] = (() => {
  const out: Spot[] = [];
  ROWS.forEach((r, row) => {
    for (let col = 0; col < r.n; col++) {
      out.push({
        row,
        col,
        x: Math.round(r.off * PAD_W + col * PAD_W),
        y: row * PAD_H,
      });
    }
  });
  return out;
})();
const SPOT_N = SPOTS.length;

/** Which pads touch which, worked out once from where they actually are. */
const NEIGHBOURS: number[][] = SPOTS.map((a, i) =>
  SPOTS.map((b, j) => ({ b, j }))
    .filter(({ b, j }) => j !== i && Math.abs(a.x - b.x) <= PAD_W + 1 && Math.abs(a.y - b.y) <= PAD_H + 1)
    .map(({ j }) => j),
);

/** How far apart two pads are, in pads. */
function hops(a: number, b: number): number {
  const p = SPOTS[a];
  const q = SPOTS[b];
  return Math.max(Math.abs(p.x - q.x) / PAD_W, Math.abs(p.y - q.y) / PAD_H);
}

// ----------------------------------------------------------------- the frogs

export type Ability = 'quickHop' | 'mudHide' | 'decoy' | 'deepDive' | 'lilyHop' | 'stillWater';

export interface FrogKind {
  key: string;
  name: string;
  /** How many pads it covers. */
  size: number;
  /** The shape it covers, as offsets from its anchor pad. */
  shape: 'single' | 'pair' | 'triple';
  ability: Ability;
  abilityName: string;
  /** Turns between uses.  A big number is a rare, powerful move. */
  cool: number;
  /** How far it can relocate, in pads. */
  range: number;
  /**
   * How loudly it advertises itself, 0 silent to 1 obvious.
   *
   * This is the counterweight to size and mobility: it decides how often a
   * frog's presence leaks a clue whether or not it moved, so the big ones and
   * the busy ones are findable without anybody being told where they are.
   */
  noise: number;
  tint: number;
  /** What fits on a 42 pixel button.  `name` does not. */
  short: string;
  note: string;
}

/**
 * SIX FROGS, AND NOT ONE OF THEM IS SIMPLY BETTER.
 *
 * The trade is always the same shape: everything that helps it hide costs it
 * mobility, and everything that lets it move costs it quiet.  A tiny frog is
 * nearly silent and can hop one pad; a bullfrog can cross half the pond and
 * can be heard doing it from anywhere.
 */
export const KINDS: FrogKind[] = [
  {
    key: 'tiny', name: 'TINY FROG', size: 1, shape: 'single',
    ability: 'quickHop', abilityName: 'QUICK HOP', cool: 2, range: 1, noise: 0.12,
    tint: 0x8fd48a, short: 'TINY', note: 'ONE PAD. HARD TO SEE, HARDLY MOVES.',
  },
  {
    key: 'green', name: 'GREEN FROG', size: 2, shape: 'pair',
    ability: 'mudHide', abilityName: 'MUD HIDE', cool: 3, range: 1, noise: 0.3,
    tint: 0x4f9e55, short: 'GREEN', note: 'TWO PADS. SLIPS ONE PAD WITHOUT A SOUND.',
  },
  {
    key: 'golden', name: 'GOLDEN FROG', size: 2, shape: 'pair',
    ability: 'decoy', abilityName: 'DECOY SPLASH', cool: 3, range: 1, noise: 0.62,
    tint: 0xf0c850, short: 'GOLD', note: 'LOUD, BUT THROWS A FALSE SPLASH NEARBY.',
  },
  {
    key: 'bull', name: 'BULLFROG', size: 3, shape: 'triple',
    ability: 'deepDive', abilityName: 'DEEP DIVE', cool: 4, range: 3, noise: 0.85,
    tint: 0x3f7a46, short: 'BULL', note: 'THREE PADS. CROSSES DEEP WATER. VERY LOUD.',
  },
  {
    key: 'tree', name: 'TREE FROG', size: 1, shape: 'single',
    ability: 'lilyHop', abilityName: 'LILY HOP', cool: 2, range: 2, noise: 0.55,
    tint: 0x5ac8a8, short: 'TREE', note: 'NIMBLE. EVERY HOP IS HEARD.',
  },
  {
    key: 'sleeper', name: 'SLEEPING FROG', size: 3, shape: 'triple',
    ability: 'stillWater', abilityName: 'STILL WATER', cool: 5, range: 0, noise: 0.2,
    tint: 0x6b8f9e, short: 'SLEEP', note: 'THREE PADS. CANNOT MOVE. QUIETS ITS NEIGHBOURS.',
  },
];

/**
 * The six that go in a pond: one of each, BIGGEST FIRST.
 *
 * Both the player's rack and the opponent's placer walk this in order, and a
 * three-pad frog needs a run of three free pads in one row.  Placed last it
 * is fighting for the scraps; placed first it takes the space it needs and
 * the one-pad frogs fit round it afterwards.
 */
const ROSTER = ['bull', 'sleeper', 'green', 'golden', 'tree', 'tiny'];

// ------------------------------------------------------------------ the state

interface Frog {
  kind: FrogKind;
  /** The pads it is sitting on, anchor first. */
  at: number[];
  /** Which of its pads have been found. */
  found: Set<number>;
  /** Turns until its ability is ready again. */
  cool: number;
  /** Pads it has been seen on before, kept even after it moves. */
  seen: Set<number>;
  hidden: boolean;
}

interface Pond {
  frogs: Frog[];
  /** Pads searched, and what was there at the time. */
  searched: Map<number, 'water' | 'frog'>;
  /** Pads where a frog was found and has since moved off. */
  stale: Set<number>;
  pads: Phaser.GameObjects.Container[];
  marks: Phaser.GameObjects.Container[];
  ox: number;
}

type Phase = 'place' | 'play' | 'done';

let phase: Phase = 'place';
let mine: Pond | null = null;
let theirs: Pond | null = null;
let over = false;
let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;
let status: Phaser.GameObjects.BitmapText | null = null;
let subStatus: Phaser.GameObjects.BitmapText | null = null;
let busy = false;

/** Placement: which kind is in hand, and what is left to place. */
let toPlace: string[] = [];
let holding = 0;
let ghost: Phaser.GameObjects.Container | null = null;
let startBtn: Phaser.GameObjects.Container | null = null;
let pickBtns: Phaser.GameObjects.Container[] = [];
let infoLine: Phaser.GameObjects.BitmapText | null = null;

/** The opponent's memory, the same shape a person's would be. */
let hunt: number[] = [];
let tried: Set<number> = new Set();

const kindOf = (key: string): FrogKind => KINDS.find((k) => k.key === key)!;

/**
 * The pads a frog of this kind would cover, anchored here.
 *
 * Multi-pad frogs take their neighbours along the row, which is why the rows
 * are different widths: a three-pad frog does not fit everywhere.
 */
export function footprint(kind: FrogKind, anchor: number): number[] | null {
  const a = SPOTS[anchor];
  const want = kind.size;
  const out = [anchor];
  for (let i = 1; i < want; i++) {
    const next = SPOTS.findIndex((s) => s.row === a.row && s.x === a.x + i * PAD_W);
    if (next < 0) return null;
    out.push(next);
  }
  return out;
}

/**
 * Is this footprint free?
 *
 * OVERLAP ONLY.  Frogs used to be barred from adjacent pads as well, on the
 * grounds that finding one would say too much about the next -- and with two
 * three-pad frogs and two two-pad frogs in a thirty-six pad pond, that made
 * the pond unfillable: place the first five greedily and the sleeping frog
 * has nowhere legal left to go.  Frogs sitting next to each other is fine,
 * and in a game about tracking it is useful: a neighbour is a lead, not a
 * giveaway.
 */
export function canPlace(pond: Pond, kind: FrogKind, anchor: number): boolean {
  const feet = footprint(kind, anchor);
  if (!feet) return false;
  for (const f of pond.frogs) {
    for (const p of f.at) {
      for (const q of feet) if (p === q) return false;
    }
  }
  return true;
}

// ----------------------------------------------------------------- the module

export const battleship: MinigameModule = {
  // The id stays `battleship`: the cabinet, its three-token price, its reward,
  // the registry and the high score table all key off it.  Nothing the player
  // ever reads says that word.
  id: 'battleship',
  title: 'FROG POND HUNT',
  music: 'game_battleship',
  rules: 'find their frogs before they find yours',
  tutorial: {
    objective: [
      'HIDE SIX FROGS IN YOUR POND.',
      'THEN FIND ALL SIX OF THEIRS.',
      'FROGS MOVE BETWEEN TURNS AND LEAVE CLUES.',
      'ONE SEARCH A TURN.',
    ],
    controls: [
      ['MOUSE', 'PICK A FROG, CLICK A PAD'],
    ],
  },
  touch: {},

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    sceneRef = scene;
    over = false;
    busy = false;
    phase = 'place';
    hunt = [];
    tried = new Set();
    toPlace = [...ROSTER];
    holding = 0;

    paintWater(scene);

    mine = makePond(scene, MINE_X, true);
    theirs = makePond(scene, THEIRS_X, false);
    autoPlace(theirs);

    text(scene, MINE_X, 42, 'YOUR POND', 0x8fd48a).setDepth(30);
    text(scene, THEIRS_X, 42, 'HIDDEN FROGS', 0xf0c850).setDepth(30);

    status = centerText(scene, GAME_W / 2, 22, 'PLACE YOUR FROGS', PALETTE.cream).setDepth(30);
    subStatus = centerText(scene, GAME_W / 2, 146, 'CHOOSE A FROG', PALETTE.bone).setDepth(30).setAlpha(0.85);
    // Below the ponds, which end at POND_TOP + six rows = 130.
    infoLine = centerText(scene, GAME_W / 2, 136, '', 0xbfe8f2).setDepth(30).setAlpha(0.9);

    buildPicker(scene);
    refreshPicker();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__pond = {
        state: () => ({
          phase,
          over,
          toPlace: [...toPlace],
          holding,
          busy,
          mineFrogs: mine ? mine.frogs.map((f) => ({ kind: f.kind.key, at: [...f.at], found: f.found.size, foundAt: [...f.found], cool: f.cool, hidden: f.hidden })) : [],
          theirsFrogs: theirs ? theirs.frogs.map((f) => ({ kind: f.kind.key, at: [...f.at], found: f.found.size, foundAt: [...f.found], cool: f.cool, hidden: f.hidden })) : [],
          mineLeft: mine ? mine.frogs.filter((f) => f.found.size < f.kind.size).length : 0,
          theirsLeft: theirs ? theirs.frogs.filter((f) => f.found.size < f.kind.size).length : 0,
          searched: theirs ? theirs.searched.size : 0,
          mineSearched: mine ? mine.searched.size : 0,
          statusText: status?.text ?? '',
          stale: theirs ? [...theirs.stale] : [],
        }),
        /** Every pad, so a harness can click one without knowing the layout. */
        spots: () => SPOTS.map((s, i) => ({ i, x: s.x, y: s.y, row: s.row })),
        /** Place the held frog at this pad, exactly as a click would. */
        place: (at: number) => placeHeld(at),
        /** Which pads the held frog could legally go on. */
        legal: () => {
          if (!mine || holding >= toPlace.length) return [];
          const k = kindOf(toPlace[holding]);
          return SPOTS.map((_, i) => i).filter((i) => canPlace(mine!, k, i));
        },
        pick: (n: number) => { holding = Phaser.Math.Clamp(n, 0, Math.max(0, toPlace.length - 1)); refreshPicker(); },
        start: () => startHunt(),
        search: (at: number) => search(at),
        /** Run the between-turn step by hand, to watch frogs move. */
        settle: () => { if (mine && theirs) { stepFrogs(mine); stepFrogs(theirs); } },
        /**
         * Lay out n opponent ponds and report on them.  Test-only: the point
         * is to prove the placer always seats all six with nothing overlapping,
         * over far more layouts than anyone would sit through by hand.
         */
        audit: (n: number) => {
          let full = 0;
          let overlaps = 0;
          let offPond = 0;
          const counts: Record<string, number> = {};
          for (let i = 0; i < n; i++) {
            const scratch: Pond = { frogs: [], searched: new Map(), stale: new Set(), pads: [], marks: [], ox: 0 };
            autoPlace(scratch);
            if (scratch.frogs.length === ROSTER.length) full++;
            const seen = new Set<number>();
            for (const f of scratch.frogs) {
              counts[f.kind.key] = (counts[f.kind.key] ?? 0) + 1;
              if (f.at.length !== f.kind.size) offPond++;
              for (const q of f.at) {
                if (q < 0 || q >= SPOT_N) offPond++;
                if (seen.has(q)) overlaps++;
                seen.add(q);
              }
            }
          }
          return { runs: n, full, overlaps, offPond, counts };
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__pond;
      });
    }
  },

  destroy() {
    mine = null;
    theirs = null;
    status = null;
    subStatus = null;
    infoLine = null;
    ghost = null;
    startBtn = null;
    pickBtns = [];
    apiRef = null;
    sceneRef = null;
  },
};

// -------------------------------------------------------------------- drawing

/** The water both ponds float on, and the bank around them. */
function paintWater(scene: Phaser.Scene): void {
  scene.add.rectangle(0, 18, GAME_W, 162, 0x2f7f8c).setOrigin(0, 0);
  scene.add.rectangle(0, 18, GAME_W, 20, 0x25656f).setOrigin(0, 0);
  scene.add.rectangle(0, 150, GAME_W, 30, 0x3d9599).setOrigin(0, 0);
  // light on the surface
  for (let i = 0; i < 40; i++) {
    scene.add
      .rectangle((i * 47) % GAME_W, 40 + ((i * 31) % 128), 8 + (i % 4) * 6, 1, 0xbfe8f2)
      .setOrigin(0, 0).setAlpha(0.13);
  }
  // reeds down the middle, between the two ponds
  for (let i = 0; i < 22; i++) {
    const rx = GAME_W / 2 - 6 + ((i * 5) % 13);
    const h = 10 + (i % 5) * 5;
    scene.add.rectangle(rx, 44 + ((i * 17) % 120), 1, h, i % 3 ? 0x3d7434 : 0x4d8c3f).setOrigin(0.5, 1).setAlpha(0.9);
  }
  // rocks and mud at the edges, so it reads as a pond and not a page
  for (const [rx, ry, rw] of [[6, 150, 12], [GAME_W - 8, 146, 10], [160, 166, 14]] as const) {
    scene.add.ellipse(rx, ry, rw, rw * 0.6, 0x7d7b70);
    scene.add.ellipse(rx - 1, ry - 1, rw * 0.6, rw * 0.3, 0x99968a);
  }
}

/** One lily pad, which is what a searchable place looks like here. */
function padArt(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  return scene.add.container(x, y, [
    scene.add.ellipse(0, 1.5, PAD_W - 1, PAD_H - 3, 0x1d5561).setAlpha(0.4),
    scene.add.ellipse(0, 0, PAD_W - 1, PAD_H - 2, 0x3f8a3c),
    scene.add.ellipse(-1, -1.5, PAD_W - 6, PAD_H - 8, 0x55a64b).setAlpha(0.75),
    scene.add.triangle(PAD_W * 0.28, 0.5, 0, 0, PAD_W * 0.28, -PAD_H * 0.22, PAD_W * 0.28, PAD_H * 0.22, 0x2f7f8c),
  ]);
}

/**
 * A POND, WITH MIST OVER IT IF IT IS NOT YOURS.
 *
 * Their pads are dimmed and drifted over, which is what stands in for the
 * fog of war: you can see there is a pond there, you cannot see what is on it.
 */
function makePond(scene: Phaser.Scene, ox: number, isMine: boolean): Pond {
  const pond: Pond = { frogs: [], searched: new Map(), stale: new Set(), pads: [], marks: [], ox };
  SPOTS.forEach((s, i) => {
    const pad = padArt(scene, ox + s.x + PAD_W / 2, POND_TOP + s.y + PAD_H / 2);
    pad.setDepth(4);
    if (!isMine) pad.setAlpha(0.55);
    pond.pads.push(pad);
    // what is known about this pad: a frog, a splash, or a stale sighting
    const mark = scene.add.container(pad.x, pad.y).setDepth(6);
    pond.marks.push(mark);

    pad.setSize(PAD_W - 1, PAD_H - 2);
    pad.setInteractive(new Phaser.Geom.Rectangle(0, 0, PAD_W - 1, PAD_H - 2), Phaser.Geom.Rectangle.Contains);
    pad.on('pointerdown', () => (isMine ? placeHeld(i) : search(i)));
    if (isMine) {
      pad.on('pointerover', () => showGhost(i));
      pad.on('pointerout', () => ghost?.setVisible(false));
    }
  });
  if (!isMine) {
    // mist, which drifts
    for (let i = 0; i < 12; i++) {
      const m = scene.add
        .ellipse(ox + Math.random() * POND_W, POND_TOP + Math.random() * (ROWS.length * PAD_H), 26 + Math.random() * 22, 9, 0xdff2f7)
        .setAlpha(0.14).setDepth(8);
      scene.tweens.add({
        targets: m, x: m.x + (Math.random() < 0.5 ? -18 : 18), alpha: 0.06,
        duration: 3200 + Math.random() * 2600, yoyo: true, repeat: -1,
      });
    }
  }
  return pond;
}

/** The little frog drawn on a pad once it is known to be there. */
function frogArt(scene: Phaser.Scene, tint: number, faded: boolean): Phaser.GameObjects.Container {
  const dark = Phaser.Display.Color.IntegerToColor(tint).darken(30).color;
  const c = scene.add.container(0, 0, [
    scene.add.ellipse(0, 2.5, 11, 3, 0x14251a).setAlpha(0.4),
    scene.add.ellipse(-3.4, 1, 4, 3.6, dark),
    scene.add.ellipse(3.4, 1, 4, 3.6, dark),
    scene.add.ellipse(0, 0, 9, 7, tint),
    scene.add.ellipse(-2.4, -3, 3.6, 3.2, tint),
    scene.add.ellipse(2.4, -3, 3.6, 3.2, tint),
    scene.add.ellipse(-2.4, -3, 2.4, 2.2, PALETTE.cream),
    scene.add.ellipse(2.4, -3, 2.4, 2.2, PALETTE.cream),
    scene.add.rectangle(-2.4, -3, 1, 1.4, 0x14251a),
    scene.add.rectangle(2.4, -3, 1, 1.4, 0x14251a),
  ]);
  if (faded) c.setAlpha(0.42);
  return c;
}

/** Wipe a pad's mark and draw whatever is now known about it. */
function markPad(pond: Pond, at: number, isMine: boolean): void {
  if (!sceneRef) return;
  const mark = pond.marks[at];
  mark.removeAll(true);
  const seen = pond.searched.get(at);
  const frog = pond.frogs.find((f) => f.at.includes(at) && f.found.has(at));
  if (frog && (isMine || true)) {
    mark.add(frogArt(sceneRef, frog.kind.tint, false));
    return;
  }
  if (pond.stale.has(at)) {
    // It was here and it is not now.  Kept deliberately: what you learned is
    // still worth something, and a wiped pad would throw it away.
    mark.add(sceneRef.add.ellipse(0, 0, 9, 7, 0xbfe8f2).setAlpha(0.22));
    mark.add(sceneRef.add.rectangle(0, 0, 7, 1, 0xbfe8f2).setAlpha(0.5).setAngle(30));
    mark.add(sceneRef.add.rectangle(0, 0, 7, 1, 0xbfe8f2).setAlpha(0.5).setAngle(-30));
    return;
  }
  if (seen === 'water') {
    mark.add(sceneRef.add.ellipse(0, 0, 8, 4, 0x1d5561).setAlpha(0.55));
    mark.add(sceneRef.add.ellipse(0, 0, 5, 2.4, 0xbfe8f2).setAlpha(0.35));
  }
}

/** Every pad on a pond, repainted from what is known. */
function repaint(pond: Pond, isMine: boolean): void {
  for (let i = 0; i < SPOT_N; i++) markPad(pond, i, isMine);
  // your own frogs are always visible on your own pond
  if (isMine && sceneRef) {
    for (const f of pond.frogs) {
      for (const at of f.at) {
        if (f.found.has(at)) continue;
        const mark = pond.marks[at];
        mark.removeAll(true);
        mark.add(frogArt(sceneRef, f.kind.tint, f.hidden));
      }
    }
  }
}

// ------------------------------------------------------------------ placement

/** The row of frogs still to be put in the water. */
function buildPicker(scene: Phaser.Scene): void {
  pickBtns.forEach((b) => b.destroy());
  pickBtns = [];
  toPlace.forEach((key, i) => {
    const k = kindOf(key);
    const b = button(scene, 30 + i * 44, 158, k.short, () => {
      holding = i;
      refreshPicker();
    }, { width: 42, height: 13, fill: 0x1d5561, textColor: PALETTE.cream });
    b.setDepth(30);
    pickBtns.push(b);
  });
  startBtn = button(scene, GAME_W / 2, 172, 'START POND HUNT', () => startHunt(), {
    width: 116, height: 14, fill: 0x2f7a46,
  });
  startBtn.setDepth(30);
}

/** Which frog is in hand, what it does, and whether the hunt may begin. */
function refreshPicker(): void {
  pickBtns.forEach((b, i) => {
    b.setVisible(i < toPlace.length);
    const box = b.list[0] as Phaser.GameObjects.Rectangle;
    box.setFillStyle(i === holding ? 0x2f7a46 : 0x1d5561);
  });
  if (toPlace.length === 0) {
    infoLine?.setText('EVERY FROG IS IN. START POND HUNT.');
    subStatus?.setText('OR CLICK A FROG TO MOVE IT');
  } else {
    const k = kindOf(toPlace[holding] ?? toPlace[0]);
    infoLine?.setText(`${k.name}  ${k.size} PAD${k.size > 1 ? 'S' : ''}  -  ${k.abilityName}`);
    subStatus?.setText(k.note);
  }
  startBtn?.setVisible(toPlace.length === 0);
}

/** A translucent preview of where the held frog would go. */
function showGhost(at: number): void {
  if (phase !== 'place' || !sceneRef || !mine || toPlace.length === 0) return;
  const k = kindOf(toPlace[holding]);
  const feet = footprint(k, at);
  ghost?.destroy();
  ghost = sceneRef.add.container(0, 0).setDepth(9);
  const ok = canPlace(mine, k, at);
  for (const p of feet ?? [at]) {
    const s = SPOTS[p];
    ghost.add(
      sceneRef.add
        .ellipse(mine.ox + s.x + PAD_W / 2, POND_TOP + s.y + PAD_H / 2, PAD_W - 2, PAD_H - 3, ok ? k.tint : PALETTE.blood)
        .setAlpha(0.45),
    );
  }
  ghost.setVisible(true);
}

/**
 * Put the held frog down, or pick a placed one back up.
 *
 * Clicking a frog that is already in the water lifts it out and puts it back
 * on the rack, which is what "reposition before confirming" means -- there is
 * no separate undo, you just pick it up again.
 */
function placeHeld(at: number): void {
  if (phase !== 'place' || !mine) return;
  // lifting one back out
  const already = mine.frogs.findIndex((f) => f.at.includes(at));
  if (already >= 0) {
    const f = mine.frogs[already];
    mine.frogs.splice(already, 1);
    toPlace.push(f.kind.key);
    holding = toPlace.length - 1;
    audio.sfx('ui_hover', 0.5);
    buildPicker(sceneRef!);
    refreshPicker();
    repaint(mine, true);
    return;
  }
  if (toPlace.length === 0) return;
  const k = kindOf(toPlace[holding]);
  if (!canPlace(mine, k, at)) {
    audio.sfx('buzzer', 0.35);
    subStatus?.setText('NOT THERE - FROGS NEED THEIR OWN SPACE');
    return;
  }
  const feet = footprint(k, at)!;
  mine.frogs.push({ kind: k, at: feet, found: new Set(), cool: 0, seen: new Set(), hidden: false });
  toPlace.splice(holding, 1);
  holding = Math.min(holding, Math.max(0, toPlace.length - 1));
  audio.sfx('hop_wet', 0.5);
  ghost?.setVisible(false);
  buildPicker(sceneRef!);
  refreshPicker();
  repaint(mine, true);
}

/**
 * The opponent puts its own six in, by the same rules.
 *
 * The WHOLE LAYOUT retries, not each frog.  Placing them one at a time and
 * giving up on any that would not fit meant the opponent could quietly field
 * five -- and a pond with five frogs in it is won the moment the fifth is
 * found, which reads as the game ending early for no reason.  If a layout
 * cannot be completed it is thrown away and started again.
 */
function autoPlace(pond: Pond): void {
  for (let go = 0; go < 60; go++) {
    pond.frogs = [];
    let all = true;
    for (const key of ROSTER) {
      const k = kindOf(key);
      const spots = Phaser.Utils.Array.Shuffle(SPOTS.map((_, i) => i)).filter((i) => canPlace(pond, k, i));
      if (!spots.length) { all = false; break; }
      pond.frogs.push({ kind: k, at: footprint(k, spots[0])!, found: new Set(), cool: 0, seen: new Set(), hidden: false });
    }
    if (all && pond.frogs.length === ROSTER.length) return;
  }
}

function startHunt(): void {
  if (phase !== 'place' || toPlace.length > 0 || !mine) return;
  phase = 'play';
  ghost?.destroy();
  ghost = null;
  pickBtns.forEach((b) => b.destroy());
  pickBtns = [];
  startBtn?.destroy();
  startBtn = null;
  status?.setText('POND SEARCH');
  subStatus?.setText('CLICK A PAD IN THEIR POND');
  infoLine?.setText('');
  audio.sfx('chime');
  refreshScore();
}

// ----------------------------------------------------------------- the search

/** Where a pad actually is on screen. */
function padXY(pond: Pond, at: number): { x: number; y: number } {
  const s = SPOTS[at];
  return { x: pond.ox + s.x + PAD_W / 2, y: POND_TOP + s.y + PAD_H / 2 };
}

/** Water going up, which is what most searches produce. */
function splash(x: number, y: number, big: boolean): void {
  if (!sceneRef) return;
  audio.sfx(big ? 'hop_wet' : 'drip', big ? 0.55 : 0.4);
  for (let i = 0; i < (big ? 10 : 5); i++) {
    const d = sceneRef.add.circle(x, y, 1 + Math.random(), 0xd8f4fa).setDepth(24).setAlpha(0.9);
    sceneRef.tweens.add({
      targets: d, x: x + (Math.random() - 0.5) * (big ? 26 : 14), y: y - 6 - Math.random() * (big ? 16 : 8),
      alpha: 0, duration: 380 + Math.random() * 320, ease: 'Quad.easeOut', onComplete: () => d.destroy(),
    });
  }
  const ring = sceneRef.add.ellipse(x, y, 4, 2, 0xd8f4fa).setDepth(23).setAlpha(0.6);
  ring.setFillStyle();
  ring.setStrokeStyle(1, 0xe8fbff, 0.7);
  sceneRef.tweens.add({
    targets: ring, scaleX: big ? 5 : 3, scaleY: big ? 5 : 3, alpha: 0,
    duration: 600, onComplete: () => ring.destroy(),
  });
}

/** A frog breaking cover: it jumps, it croaks, the pad rocks. */
function revealHop(pond: Pond, at: number, kind: FrogKind): void {
  if (!sceneRef) return;
  const { x, y } = padXY(pond, at);
  splash(x, y, true);
  audio.sfx('chime', 0.5);
  const f = frogArt(sceneRef, kind.tint, false);
  f.setPosition(x, y).setDepth(26);
  sceneRef.tweens.add({
    targets: f, y: y - 14, duration: 230, yoyo: true, ease: 'Quad.easeOut',
    onComplete: () => f.destroy(),
  });
  const pad = pond.pads[at];
  sceneRef.tweens.add({ targets: pad, y: pad.y + 2, duration: 110, yoyo: true, repeat: 2 });
  const pop = centerText(sceneRef, x, y - 20, kind.name, kind.tint).setDepth(30);
  sceneRef.tweens.add({ targets: pop, y: pop.y - 10, alpha: 0, duration: 900, onComplete: () => pop.destroy() });
}

/**
 * ONE SEARCH.
 *
 * Whatever it turns up, the turn ends -- finding a frog does NOT buy another
 * go.  That is deliberate: an extra turn on a hit turns a tracking game into
 * a streak game, and the whole point here is that the information is worth
 * more than the tempo.
 */
function search(at: number): void {
  if (phase !== 'play' || over || busy || !theirs) return;
  if (theirs.searched.has(at) && theirs.searched.get(at) === 'water') return;
  const frog = theirs.frogs.find((f) => f.at.includes(at));
  if (frog && frog.found.has(at)) return;

  busy = true;
  const { x, y } = padXY(theirs, at);
  if (frog) {
    frog.found.add(at);
    frog.seen.add(at);
    theirs.searched.set(at, 'frog');
    theirs.stale.delete(at);
    revealHop(theirs, at, frog.kind);
    status?.setText(frog.found.size >= frog.kind.size ? `${frog.kind.name} FOUND` : 'FROG!');
  } else {
    theirs.searched.set(at, 'water');
    splash(x, y, false);
    status?.setText('NOTHING THERE');
  }
  markPad(theirs, at, false);
  refreshScore();

  if (theirs.frogs.every((f) => f.found.size >= f.kind.size)) {
    finish(true);
    return;
  }
  // turn ends -- then, and only then, the ponds settle
  sceneRef?.time.delayedCall(720, betweenTurns);
}

/**
 * THE STEP BETWEEN TURNS.
 *
 * Frogs move here and nowhere else.  A frog that hopped out from under a
 * click would be indistinguishable from a bug, so the ponds are completely
 * still for the whole of anybody's search and do all their moving in the gap.
 */
function betweenTurns(): void {
  if (over || !mine || !theirs) return;
  // Once each, once a round: their pond settles after your search, yours
  // settles before theirs, and nothing moves again until the round is over.
  stepFrogs(theirs);
  stepFrogs(mine);
  repaint(mine, true);
  sceneRef?.time.delayedCall(520, opponentTurn);
}

/** The opponent takes its one search, then the ponds settle again. */
function opponentTurn(): void {
  if (over || !mine) return;
  let at = -1;
  while (hunt.length > 0) {
    const c = hunt.pop()!;
    if (!tried.has(c)) { at = c; break; }
  }
  if (at < 0) {
    const open: number[] = [];
    for (let i = 0; i < SPOT_N; i++) if (!tried.has(i)) open.push(i);
    if (open.length === 0) { busy = false; return; }
    at = Phaser.Utils.Array.GetRandom(open);
  }
  tried.add(at);

  const frog = mine.frogs.find((f) => f.at.includes(at) && !f.found.has(at));
  const { x, y } = padXY(mine, at);
  if (frog) {
    frog.found.add(at);
    mine.searched.set(at, 'frog');
    revealHop(mine, at, frog.kind);
    // work the neighbours, the way a person would
    for (const n of NEIGHBOURS[at]) if (!tried.has(n)) hunt.push(n);
    status?.setText('THEY FOUND ONE OF YOURS');
  } else {
    mine.searched.set(at, 'water');
    splash(x, y, false);
    status?.setText('THEY SEARCHED AND FOUND NOTHING');
  }
  repaint(mine, true);
  refreshScore();

  if (mine.frogs.every((f) => f.found.size >= f.kind.size)) {
    finish(false);
    return;
  }
  // NO SECOND SETTLE.  The ponds already moved in betweenTurns, once, for
  // this round; stepping them again here moved every frog twice per round,
  // ticked every cooldown at double rate, and -- worst of all -- let the
  // opponent's frogs hop twice between two of your searches, which makes a
  // clue point at a pad the frog has already left again.
  sceneRef?.time.delayedCall(640, () => {
    if (over || !mine) return;
    repaint(mine, true);
    status?.setText('POND SEARCH');
    subStatus?.setText('CLICK A PAD IN THEIR POND');
    busy = false;
    refreshScore();
  });
}

function refreshScore(): void {
  if (!mine || !theirs) return;
  const gotTheirs = theirs.frogs.filter((f) => f.found.size >= f.kind.size).length;
  const gotMine = mine.frogs.filter((f) => f.found.size >= f.kind.size).length;
  subStatus?.setText(`FROGS FOUND  ${gotTheirs}/6      THEY HAVE  ${gotMine}/6`);
}

function finish(won: boolean): void {
  if (over) return;
  over = true;
  phase = 'done';
  status?.setText(won ? 'EVERY FROG FOUND' : 'YOUR POND IS EMPTY');
  subStatus?.setText('');
  if (theirs) {
    // show where they all actually were
    for (const f of theirs.frogs) for (const at of f.at) f.found.add(at);
    repaint(theirs, true);
  }
  sceneRef?.time.delayedCall(1100, () => (won ? apiRef?.win() : apiRef?.lose()));
}

// -------------------------------------------------------- movement and clues

/**
 * WHERE A FROG COULD GO FROM HERE.
 *
 * Its whole footprint has to land on real pads, in one row, without touching
 * another frog -- the same rule placement uses, so nothing can move into a
 * spot it could not have been put in.  Within its range, and never onto a pad
 * the searcher has already cleared this game, because a frog that hops into a
 * square you have proved is empty is a frog that has cheated.
 */
function movesFor(pond: Pond, frog: Frog): number[] {
  const out: number[] = [];
  if (frog.kind.range <= 0) return out;
  const from = frog.at[0];
  for (let i = 0; i < SPOT_N; i++) {
    if (i === from) continue;
    if (hops(from, i) > frog.kind.range) continue;
    const feet = footprint(frog.kind, i);
    if (!feet) continue;
    if (feet.some((p) => pond.searched.get(p) === 'water')) continue;
    // its own pads do not block it
    const others = pond.frogs.filter((f) => f !== frog);
    let clear = true;
    for (const o of others) {
      for (const p of o.at) {
        for (const q of feet) if (p === q) clear = false;
      }
    }
    if (clear) out.push(i);
  }
  return out;
}

/**
 * ONE POND, SETTLING BETWEEN TURNS.
 *
 * Not every frog moves and not every turn: each one is on its own cooldown,
 * and a frog with no range never moves at all.  A frog that has been fully
 * found stops moving -- it has been caught -- and a partly found one moves
 * with its discovery trailing behind it as a stale mark, which is the whole
 * of how knowledge survives a hop.
 */
function stepFrogs(pond: Pond): void {
  const isMine = pond === mine;

  // FIRST PASS: who is going quiet, before anybody has moved.
  //
  // This has to happen up front.  Still water shields the pads around it, and
  // a shield that goes up after the bullfrog beside it has already hopped
  // covers nothing.  It is also the whole reason `hidden` exists: with both
  // quiet frogs rooted to the spot, the flag was only ever read inside hop(),
  // which neither of them ever reached, so both of their advertised
  // advantages did precisely nothing.
  const shielded = new Set<number>();
  for (const frog of pond.frogs) {
    frog.hidden = false;
    if (frog.found.size >= frog.kind.size) continue;
    if (frog.cool > 0) continue;
    const ab = frog.kind.ability;
    if (ab !== 'mudHide' && ab !== 'stillWater') continue;
    frog.hidden = true;
    if (ab === 'stillWater') {
      // Its one contribution, and a positional one: park it next to something
      // loud and the loud thing stops giving itself away.
      for (const p of frog.at) for (const n of NEIGHBOURS[p]) shielded.add(n);
    }
  }

  // SECOND PASS: everybody moves.
  for (const frog of pond.frogs) {
    if (frog.found.size >= frog.kind.size) continue;
    if (frog.cool > 0) { frog.cool -= 1; continue; }
    // Quiet by its own doing, or covered by a sleeper next door.  Read off
    // the footprint it is leaving, not the one it is going to.
    const quiet = frog.hidden || frog.at.some((p) => shielded.has(p));

    switch (frog.kind.ability) {
      case 'stillWater':
        // It genuinely cannot move.  That is the cost of the shield above.
        frog.cool = frog.kind.cool;
        break;
      case 'decoy': {
        // A splash somewhere it is not, to spend a search on.
        const where = movesFor(pond, frog);
        if (!isMine && where.length) {
          const fake = Phaser.Utils.Array.GetRandom(where);
          clue(pond, fake, 'DECOY');
        }
        hop(pond, frog, quiet);
        frog.cool = frog.kind.cool;
        break;
      }
      default:
        // mudHide included: it moves like anything else, it just does it
        // without leaving a ripple behind.
        hop(pond, frog, quiet);
        frog.cool = frog.kind.cool;
        break;
    }
  }
}

/**
 * A frog relocating, and the mark it leaves behind.
 *
 * `quiet` suppresses the clue: either the frog hid its own tracks, or a
 * sleeping frog next door held the water still while it went.
 */
function hop(pond: Pond, frog: Frog, quiet: boolean): void {
  const where = movesFor(pond, frog);
  if (!where.length) return;
  // Prefer to leave pads the searcher already knows about: a frog that has
  // been spotted has a reason to be somewhere else.
  const known = where.filter((i) => !pond.searched.has(i));
  const to = Phaser.Utils.Array.GetRandom(known.length ? known : where);
  const wasFound = [...frog.found];
  for (const p of frog.at) pond.searched.delete(p);
  frog.at = footprint(frog.kind, to)!;
  // KNOWLEDGE IS KEPT, NOT WIPED.
  //
  // A hit on a pad the frog is STILL sitting on after the hop stays a hit.
  // Clearing the whole set meant a bullfrog you had pinned down twice lost
  // both hits by sliding one pad sideways -- with two of its three pads
  // unchanged -- so a frog that moves at all could never be finished off and
  // the hunt had no end. Only the pads it actually vacated go stale.
  frog.found = new Set(wasFound.filter((q) => frog.at.includes(q)));
  for (const q of wasFound) if (!frog.at.includes(q)) pond.stale.add(q);
  if (pond !== mine) {
    // the clue it left in the water on its way
    if (!quiet && Math.random() < 0.35 + frog.kind.noise * 0.6) {
      clue(pond, Phaser.Utils.Array.GetRandom(frog.at), clueWord(frog.kind));
    }
  }
  if (pond === mine) repaint(pond, true);
  else for (const p of wasFound) markPad(pond, p, false);
}

/** What a frog of this kind sounds like when it moves. */
function clueWord(kind: FrogKind): string {
  switch (kind.ability) {
    case 'deepDive': return 'DEEP SPLASH';
    case 'lilyHop': return 'PADS SHAKING';
    case 'quickHop': return 'A RIPPLE';
    case 'decoy': return 'A CROAK';
    default: return 'BUBBLES';
  }
}

/**
 * A CLUE, WHICH IS A PLACE AND NOT AN ANSWER.
 *
 * Deliberately drawn on a NEIGHBOUR of wherever the thing actually is, so it
 * narrows the search without ending it: the player learns that something
 * happened around there, which is enough to reason with and not enough to
 * click on.
 */
function clue(pond: Pond, near: number, word: string): void {
  if (!sceneRef) return;
  const around = NEIGHBOURS[near];
  const at = around.length ? Phaser.Utils.Array.GetRandom(around) : near;
  const { x, y } = padXY(pond, at);
  const ring = sceneRef.add.ellipse(x, y, 5, 3, 0xbfe8f2).setDepth(22).setAlpha(0.7);
  ring.setFillStyle();
  ring.setStrokeStyle(1, 0xe8fbff, 0.8);
  sceneRef.tweens.add({
    targets: ring, scaleX: 4, scaleY: 4, alpha: 0, duration: 1100,
    onComplete: () => ring.destroy(),
  });
  for (let i = 0; i < 4; i++) {
    const bub = sceneRef.add.circle(x + (Math.random() - 0.5) * 8, y, 1, 0xdff7ff).setDepth(22).setAlpha(0.8);
    sceneRef.tweens.add({
      targets: bub, y: y - 6 - Math.random() * 6, alpha: 0,
      duration: 700 + Math.random() * 500, onComplete: () => bub.destroy(),
    });
  }
  const pop = centerText(sceneRef, x, y - 10, word, 0xbfe8f2).setDepth(30).setAlpha(0.9);
  sceneRef.tweens.add({ targets: pop, y: pop.y - 8, alpha: 0, duration: 1300, onComplete: () => pop.destroy() });
  audio.sfx('drip', 0.28);
}
