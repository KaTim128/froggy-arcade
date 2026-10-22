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
 * And at the end, WIN AND LOSE in colour (`resultGlow`): a burst of gold
 * light and sparks from the middle for a win, a red closing-in of the edges
 * and a dimming for a loss -- under the result card, over the game, and
 * nothing about the result or what happens next changes.
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

/**
 * WIN AND LOSE, IN COLOUR.  Called as the result card goes up: a burst of
 * gold light, a ring going out and sparks thrown up from the middle for a
 * win; for a loss the edges close in red and the picture dims.  Laid between
 * the game and the card (depth 980, one layer: the returned container); it fades with the card and changes
 * nothing about what the result is.
 */
export function resultGlow(scene: Phaser.Scene, won: boolean | null, card: { w?: number; h?: number; y?: number; depth?: number } = {}): Phaser.GameObjects.Container {
  const cx = GAME_W / 2;
  const cy = card.y ?? GAME_H / 2;
  // (under the card: the cabinets' card is at 990, the crane's at 90)
  const D = card.depth ?? 980;
  const cw = card.w ?? 250;
  const ch = card.h ?? 60;
  // all of it in one layer, so whoever shows the card can take it down with it
  const box = scene.add.container(0, 0).setDepth(D);
  const put = <T extends Phaser.GameObjects.GameObject>(o: T): T => (box.add(o), o);
  // the card itself glows in the result's colour, just round its edge
  if (won !== null) {
    const col = won ? 0xffd45e : 0xe03040;
    for (const [pad, a] of [[3, 0.55], [6, 0.28], [10, 0.12]] as const) {
      const rim = put(scene.add.rectangle(cx, cy, cw + pad * 2, ch + pad * 2).setStrokeStyle(pad > 3 ? 3 : 2, col, a).setBlendMode(Phaser.BlendModes.ADD));
      scene.tweens.add({ targets: rim, alpha: { from: 1, to: 0.55 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }
  if (won) {
    if (!scene.textures.exists('result_gold')) {
      const t = scene.textures.createCanvas('result_gold', 128, 128);
      if (t) {
        const g = t.getContext();
        const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
        gr.addColorStop(0, 'rgba(255,240,170,1)');
        gr.addColorStop(0.35, 'rgba(255,200,80,0.55)');
        gr.addColorStop(1, 'rgba(255,170,40,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 128, 128);
        t.refresh();
      }
    }
    // the warm wash over the whole picture, and the burst at the middle
    const wash = put(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0xffc84a, 0.16).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD));
    const burst = put(scene.add.image(cx, cy, 'result_gold').setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setAlpha(0.9));
    scene.tweens.add({ targets: burst, scale: 3.4, alpha: 0.25, duration: 900, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: wash, alpha: 0.06, duration: 1100 });
    const ring = put(scene.add.circle(cx, cy, 20).setStrokeStyle(2, 0xffe08a, 0.9));
    scene.tweens.add({ targets: ring, radius: 150, alpha: 0, duration: 800, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    // the sparks, gold and white, thrown up and falling
    const cols = [0xffe08a, 0xffffff, 0xffc84a, 0xfff4c8];
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 90;
      const s = put(scene.add.rectangle(cx, cy, 2, 2, cols[i % cols.length]).setBlendMode(Phaser.BlendModes.ADD));
      scene.tweens.add({
        targets: s,
        x: cx + Math.cos(a) * sp,
        y: cy + Math.sin(a) * sp * 0.7 + 30,
        alpha: 0,
        duration: 900 + Math.random() * 500,
        ease: 'Quad.easeOut',
        onComplete: () => s.destroy(),
      });
    }
    return box;
  }
  if (won === false) {
    // the red closing in from the edges, and the picture going dim under the card
    if (!scene.textures.exists('result_red')) {
      const t = scene.textures.createCanvas('result_red', GAME_W, GAME_H);
      if (t) {
        const g = t.getContext();
        const gr = g.createRadialGradient(cx, cy, GAME_H * 0.3, cx, cy, GAME_W * 0.62);
        gr.addColorStop(0, 'rgba(120,0,10,0)');
        gr.addColorStop(1, 'rgba(150,10,20,0.75)');
        g.fillStyle = gr;
        g.fillRect(0, 0, GAME_W, GAME_H);
        t.refresh();
      }
    }
    const dim = put(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x10060a, 0).setOrigin(0, 0));
    const red = put(scene.add.image(0, 0, 'result_red').setOrigin(0, 0).setAlpha(0));
    scene.tweens.add({ targets: dim, fillAlpha: 0.38, duration: 500 });
    scene.tweens.add({ targets: red, alpha: 1, duration: 220, yoyo: true, hold: 120, onComplete: () => red.setAlpha(0.6) });
    return box;
  }
  // a draw, or a practice that just ended: a cool, even dimming
  const dim = put(scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x0a1420, 0).setOrigin(0, 0));
  scene.tweens.add({ targets: dim, fillAlpha: 0.3, duration: 400 });
  return box;
}
