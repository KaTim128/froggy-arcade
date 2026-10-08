/**
 * Froggy's overlay canvas.  PRD FR-2 / SM-4 / QFD §8.2.
 *
 * This is the single most important architectural decision in the project.
 *
 * The world renders into a 320x180 buffer with NEAREST filtering.  Froggy does
 * NOT.  He renders here: a separate canvas, composited above the scaled buffer,
 * at full device resolution, with smoothing ON.  He is positioned in logical
 * (320x180) coordinates so scenes can place him like any other actor, but every
 * curve he is made of is drawn at native resolution.
 *
 * The result: tiles are blocky, Froggy is smooth, at every zoom level.  Players
 * are not told why he looks wrong.  (PRD FR-5.)
 */

import { GAME_W, GAME_H } from './pixelScaler';

export type FroggyPainter = (ctx: CanvasRenderingContext2D) => void;

class FroggyLayer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  /** Device pixels per logical (320x180) pixel. */
  private unit = 1;

  mount(root: HTMLElement): void {
    if (this.canvas) return;
    const c = document.createElement('canvas');
    c.id = 'froggy-layer';
    root.appendChild(c);
    this.canvas = c;
    this.ctx = c.getContext('2d');
    if (this.ctx) this.ctx.imageSmoothingEnabled = true;
  }

  /** Match the scaled game canvas exactly, at device resolution. */
  syncTo(gameCanvas: HTMLCanvasElement, zoom: number): void {
    if (!this.canvas || !this.ctx) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cssW = GAME_W * zoom;
    const cssH = GAME_H * zoom;

    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    const backW = Math.round(cssW * dpr);
    const backH = Math.round(cssH * dpr);
    if (this.canvas.width !== backW || this.canvas.height !== backH) {
      this.canvas.width = backW;
      this.canvas.height = backH;
    }

    // Sit precisely on top of the game canvas -- stretched with it, when a
    // sideways phone stretches it to fill the screen (both scale about their
    // centres, so the untransformed boxes share a centre too).
    const r = gameCanvas.getBoundingClientRect();
    this.canvas.style.left = `${Math.round(r.left + r.width / 2 - cssW / 2)}px`;
    this.canvas.style.top = `${Math.round(r.top + r.height / 2 - cssH / 2)}px`;
    this.canvas.style.position = 'fixed';
    this.canvas.style.transform = gameCanvas.style.transform;

    this.unit = zoom * dpr;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  clear(): void {
    if (!this.canvas || !this.ctx) return;
    // A FULL RESET, not just a clearRect.  A painter that left a clip on the
    // context (a save without its restore, somewhere down a drawing call)
    // made every later clearRect clip to it, so whatever lay outside it --
    // the mascot on the hub's counter -- stayed on the overlay into the next
    // scene.  Resetting the context drops any clip, transform and state
    // left behind, and clears the pixels with them.
    // Re-setting the width reallocates the backing store, which is the one
    // clear a browser cannot defer: a clearRect on a canvas hidden under the
    // pause menu was being put off, and the old frame came back.
    // eslint-disable-next-line no-self-assign
    this.canvas.width = this.canvas.width;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
  }

  /**
   * Draw in logical 320x180 space.  One unit = one world pixel, but the stroke
   * that unit produces is as smooth as the display allows.
   */
  paint(fn: FroggyPainter, keep = false): void {
    if (!this.ctx) return;
    // `keep` adds to what is already there this frame instead of replacing it
    // -- a dialogue portrait and the mascot on the counter behind it, say.
    if (!keep) this.clear();
    this.ctx.save();
    this.ctx.setTransform(this.unit, 0, 0, this.unit, 0, 0);
    fn(this.ctx);
    this.ctx.restore();
  }

  /** Logical pixels per side — handy for full-frame horror renders. */
  size(): { w: number; h: number } {
    return { w: GAME_W, h: GAME_H };
  }

  setVisible(v: boolean): void {
    if (this.canvas) this.canvas.style.display = v ? 'block' : 'none';
  }

  /**
   * ---- AND HE GOES DARK WITH THE ROOM.
   *
   * This canvas sits ON TOP of the game canvas, at device resolution, which
   * is the whole point of it -- and it is also why a scene transition never
   * touched him.  Phaser fades the CAMERA, and the camera only owns the
   * buffer underneath; Froggy stayed at full brightness over a room going to
   * black, which is the one thing that gives away that he is composited
   * separately.
   *
   * `k` is how lit he is: 1 is the room as normal, 0 is the room gone.  It
   * drives brightness rather than opacity, so he darkens the way everything
   * else in the frame darkens instead of dissolving and showing what is
   * behind him.
   */
  setDim(k: number): void {
    if (!this.canvas) return;
    const lit = Math.max(0, Math.min(1, k));
    this.canvas.style.filter = lit >= 0.999 ? '' : `brightness(${lit.toFixed(3)})`;
  }
}

export const froggyLayer = new FroggyLayer();
