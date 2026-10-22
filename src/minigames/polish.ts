/**
 * ---- THE CABINETS' FINISH.  Bog Ball is the one that looks made: every
 * surface painted, lit from somewhere, darker into the corners.  The rest
 * were drawn in flat fills, so this gives each of them the same kind of
 * finish -- over the top of the game, never touching what it does -- in its
 * own colours and its own strength:
 *
 *   - THE LIGHT.  A soft pool of light from above the screen in the game's
 *     own tint (warm for the felt tables, cool for the ice, green for the
 *     pond...), so the picture has a top and a bottom rather than one flat
 *     wash of colour.
 *   - THE FALL-OFF.  The corners and the edges a shade darker -- a light
 *     vignette for the bright games, as a real screen glass has, and none
 *     at all heavy enough to hide anything at the edge of play.
 *   - THE GRAIN.  The finest scatter of lighter and darker pixels, so a big
 *     flat area reads as a surface (felt, wood, ice, tarmac, water) and not
 *     as an empty colour.  Bright games get very little of it.
 *   - THE GLASS.  A faint diagonal sheen across the top corner, the screen
 *     of a cabinet catching the room's lights.
 *
 * Bog Ball keeps its own dark finish (it is the reference) and gets none of
 * the overlay.  Everything is one texture per game, made once.
 */

import Phaser from 'phaser';
import { GAME_H, GAME_W } from '../render/pixelScaler';
import type { GameId } from '../core/state';

interface Finish {
  /** The colour of the light from above. */
  light: number;
  /** How strong that light is (0..1). */
  lit: number;
  /** How dark the corners go (0..1). */
  vignette: number;
  /** How much grain over the whole picture (0..1). */
  grain: number;
  /** The glass's sheen across the top corner (0..1). */
  sheen: number;
}

/** Bright and light by default: most of these are bright games. */
const BRIGHT: Finish = { light: 0xfff4d8, lit: 0.12, vignette: 0.22, grain: 0.18, sheen: 0.06 };

/**
 * Each game's finish: its light in its own colour, and how much of each.
 * (Bog Ball is absent on purpose: it has its own, and it is the reference.)
 */
const FINISH: Partial<Record<GameId, Finish>> = {
  tictactoe: { light: 0xffe0f0, lit: 0.12, vignette: 0.2, grain: 0.14, sheen: 0.07 },
  hoops: { light: 0xffe8c8, lit: 0.14, vignette: 0.24, grain: 0.2, sheen: 0.06 },
  whack: { light: 0xf0ffd8, lit: 0.14, vignette: 0.22, grain: 0.22, sheen: 0.05 },
  bowling: { light: 0xfff0d0, lit: 0.16, vignette: 0.3, grain: 0.24, sheen: 0.06 },
  battleship: { light: 0xd8f4ff, lit: 0.14, vignette: 0.28, grain: 0.2, sheen: 0.06 },
  grudge: { light: 0xffe0d0, lit: 0.12, vignette: 0.3, grain: 0.22, sheen: 0.05 },
  donkeykong: { light: 0xfff0d8, lit: 0.12, vignette: 0.26, grain: 0.18, sheen: 0.05 },
  airhockey: { light: 0xe8f8ff, lit: 0.16, vignette: 0.22, grain: 0.1, sheen: 0.08 },
  fallingblocks: { light: 0xd8eeff, lit: 0.12, vignette: 0.24, grain: 0.12, sheen: 0.06 },
  danceoff: { light: 0xffd8f4, lit: 0.14, vignette: 0.26, grain: 0.12, sheen: 0.07 },
  frogcross: { light: 0xf4ffe0, lit: 0.14, vignette: 0.22, grain: 0.2, sheen: 0.05 },
  carchase: { light: 0xe8f4ff, lit: 0.12, vignette: 0.24, grain: 0.18, sheen: 0.05 },
  frogvslizard: { light: 0xf8ffd8, lit: 0.14, vignette: 0.22, grain: 0.2, sheen: 0.05 },
  slots: { light: 0xffe8f4, lit: 0.12, vignette: 0.24, grain: 0.12, sheen: 0.08 },
  blackjack: { light: 0xfff0c8, lit: 0.16, vignette: 0.3, grain: 0.24, sheen: 0.05 },
  roulette: { light: 0xffe0c8, lit: 0.14, vignette: 0.32, grain: 0.22, sheen: 0.05 },
  wheel: { light: 0xfff4d0, lit: 0.14, vignette: 0.22, grain: 0.14, sheen: 0.07 },
  frograce: { light: 0xf4ffd8, lit: 0.14, vignette: 0.22, grain: 0.2, sheen: 0.05 },
  frogstermash: { light: 0xf0e0ff, lit: 0.12, vignette: 0.26, grain: 0.14, sheen: 0.06 },
};

/** Over everything a game draws (they keep below ~100), under the card and the HUD. */
const DEPTH = 400;

/** The game's finish, or null for one that keeps its own (Bog Ball). */
export function finishFor(id: GameId): Finish | null {
  if (id === 'bogball') return null;
  return FINISH[id] ?? BRIGHT;
}

/** Lay the finish over a game, once it is built. */
export function applyFinish(scene: Phaser.Scene, id: GameId): Phaser.GameObjects.Image | null {
  const f = finishFor(id);
  if (!f) return null;
  const key = `finish_${id}`;
  if (!scene.textures.exists(key)) paintFinish(scene, key, f);
  return scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(DEPTH).setScrollFactor(0);
}

function paintFinish(scene: Phaser.Scene, key: string, f: Finish): void {
  const t = scene.textures.createCanvas(key, GAME_W, GAME_H);
  if (!t) return;
  const g = t.getContext();
  const W = GAME_W;
  const H = GAME_H;
  const rgb = (n: number, a: number) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  // the light from above: a wide soft pool over the top middle
  const top = g.createRadialGradient(W / 2, -H * 0.25, 10, W / 2, -H * 0.25, H * 1.25);
  top.addColorStop(0, rgb(f.light, f.lit));
  top.addColorStop(0.55, rgb(f.light, f.lit * 0.35));
  top.addColorStop(1, rgb(f.light, 0));
  g.fillStyle = top;
  g.fillRect(0, 0, W, H);
  // the fall-off into the corners
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(0,0,0,${f.vignette})`);
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  // the glass: one soft diagonal band across the top left
  if (f.sheen > 0) {
    g.save();
    g.translate(W * 0.18, 0);
    g.rotate(-0.5);
    const sh = g.createLinearGradient(0, 0, 60, 0);
    sh.addColorStop(0, 'rgba(255,255,255,0)');
    sh.addColorStop(0.5, `rgba(255,255,255,${f.sheen})`);
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh;
    g.fillRect(0, -40, 60, 160);
    g.restore();
  }
  // the grain: a fixed scatter, finer than a pixel of play could hide in
  let seed = 9173;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // (light: these are bright games, and a heavy grain over their own art
  // reads as static on the glass, not as a surface)
  const n = Math.round(W * H * 0.05 * f.grain);
  for (let i = 0; i < n; i++) {
    const light = rnd() < 0.5;
    g.fillStyle = light ? `rgba(255,255,255,${0.025 + rnd() * 0.025})` : `rgba(0,0,0,${0.03 + rnd() * 0.03})`;
    g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 1, 1);
  }
  t.refresh();
}
