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

    // Sit precisely on top of the game canvas.
    const r = gameCanvas.getBoundingClientRect();
    this.canvas.style.left = `${Math.round(r.left)}px`;
    this.canvas.style.top = `${Math.round(r.top)}px`;
    this.canvas.style.position = 'fixed';

    this.unit = zoom * dpr;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  clear(): void {
    if (!this.canvas || !this.ctx) return;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw in logical 320x180 space.  One unit = one world pixel, but the stroke
   * that unit produces is as smooth as the display allows.
   */
  paint(fn: FroggyPainter): void {
    if (!this.ctx) return;
    this.clear();
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
}

export const froggyLayer = new FroggyLayer();
