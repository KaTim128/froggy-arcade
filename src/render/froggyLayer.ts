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

/** Pixel mode draws this many times finer before picking each pixel's colour. */
const PIXEL_SS = 3;

interface Stamp {
  x: number;
  y: number;
  rows: string[];
  colors: Record<string, string>;
}
let stamps: Stamp[] | null = null;

/**
 * The size of one design unit in world pixels, where `ctx` is drawing now --
 * so a face can pick how many pixels an eye gets.  Only means anything inside
 * a pixel-mode paint; elsewhere it is the overlay's own scale.
 */
export function worldUnit(ctx: CanvasRenderingContext2D): number {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) / PIXEL_SS;
}

/**
 * Inside a pixel-mode paint: put an exact `w` x `h` block of world pixels
 * centred on the design point (x, y), after the figure has been reduced to
 * pixels, and return true.  Outside one, do nothing and return false, so the
 * caller draws its usual smooth version instead.
 *
 * Eyes are what this is for.  A small round eye reduced with everything else
 * lands across a pixel boundary, and comes out as a smear, half a pixel, or
 * nothing -- the one feature a face cannot do without.  Stamped, it is a
 * clean block in the same place every frame.  A stamp only lands where the
 * figure itself is, so the counter, the desk and the player in front still
 * cover it.
 */
export function stamp(ctx: CanvasRenderingContext2D, x: number, y: number, rows: string[], colors: Record<string, string>): boolean {
  if (!stamps) return false;
  const m = ctx.getTransform();
  const px = (m.a * x + m.c * y + m.e) / PIXEL_SS;
  const py = (m.b * x + m.d * y + m.f) / PIXEL_SS;
  const w = Math.max(...rows.map((r) => r.length));
  stamps.push({ x: Math.round(px - w / 2), y: Math.round(py - rows.length / 2), rows, colors });
  return true;
}

/** A round pupil `p` pixels across with a highlight up at its top left: a cartoon eye. */
export function eyeSprite(p: number, shine = true): string[] {
  const rows: string[] = [];
  const r = p / 2;
  const hs = Math.max(1, Math.round(p / 4));
  const h0 = p >= 4 ? Math.max(1, Math.floor(p * 0.2)) : 0;
  for (let j = 0; j < p; j++) {
    let row = '';
    for (let i = 0; i < p; i++) {
      const inside = (i + 0.5 - r) ** 2 + (j + 0.5 - r) ** 2 <= r * r + 0.3;
      const lit = shine && i >= h0 && i < h0 + hs && j >= h0 && j < h0 + hs;
      row += !inside ? '.' : lit ? 'w' : 'k';
    }
    rows.push(row);
  }
  return rows;
}

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
  paint(fn: FroggyPainter, keep = false, pixel = false): void {
    if (!this.ctx) return;
    // `keep` adds to what is already there this frame instead of replacing it
    // -- a dialogue portrait and the mascot on the counter behind it, say.
    if (!keep) this.clear();
    if (pixel) return this.paintPixel(fn);
    this.ctx.save();
    this.ctx.setTransform(this.unit, 0, 0, this.unit, 0, 0);
    fn(this.ctx);
    this.ctx.restore();
  }

  private low: HTMLCanvasElement | null = null;
  private lowCtx: CanvasRenderingContext2D | null = null;
  private hi: HTMLCanvasElement | null = null;
  private hiCtx: CanvasRenderingContext2D | null = null;

  /**
   * ---- PIXEL MODE: the people who stand in the world.
   *
   * Froggy at the counter, the staff, the dealer: drawn at the world's own
   * 320x180, one logical pixel to one pixel, then made to look like the
   * drifter -- every pixel either there or not (no soft edges), a dark ink
   * line round the silhouette the way `finishFigure` outlines the player --
   * and scaled up with NEAREST, so they are as blocky as he is.  The edge a
   * clip leaves at the bottom (a counter, a desk, a table) gets no outline:
   * that is not the edge of the figure, it is where something is in front.
   */
  private paintPixel(fn: FroggyPainter): void {
    const low = this.pixelate(fn);
    if (!low || !this.ctx) return;
    const c = this.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(low, 0, 0, this.canvas!.width, this.canvas!.height);
    c.restore();
  }

  /**
   * The same pixel-mode figure, reduced to the world's 320x180 and handed
   * back rather than put on the overlay -- for a figure that lives IN the
   * room, at a depth, with the player able to stand in front of it (see
   * render/stageFigure).  Null if there is no canvas to draw with.
   */
  pixelate(fn: FroggyPainter): HTMLCanvasElement | null {
    const K = PIXEL_SS;
    if (!this.low) {
      this.low = document.createElement('canvas');
      this.low.width = GAME_W;
      this.low.height = GAME_H;
      this.lowCtx = this.low.getContext('2d', { willReadFrequently: true });
      this.hi = document.createElement('canvas');
      this.hi.width = GAME_W * K;
      this.hi.height = GAME_H * K;
      this.hiCtx = this.hi.getContext('2d', { willReadFrequently: true });
    }
    const lc = this.lowCtx;
    const hc = this.hiCtx;
    if (!lc || !hc) return null;
    // Drawn K times finer, then each world pixel takes the ONE colour most of
    // its K x K block is -- never an average of them.  An average is what
    // made the first try look blurred: every edge inside him (the eye on the
    // face, the face on the body) came out as a band of in-between colour.
    hc.setTransform(1, 0, 0, 1, 0, 0);
    hc.clearRect(0, 0, GAME_W * K, GAME_H * K);
    hc.save();
    hc.setTransform(K, 0, 0, K, 0, 0);
    const mine: Stamp[] = [];
    stamps = mine;
    try {
      fn(hc);
    } finally {
      stamps = null;
      hc.restore();
    }
    const src = hc.getImageData(0, 0, GAME_W * K, GAME_H * K).data;
    const HW = GAME_W * K;

    const img = lc.createImageData(GAME_W, GAME_H);
    const d = img.data;
    const solid = new Uint8Array(GAME_W * GAME_H);
    const cols: number[] = [];
    const counts: number[] = [];
    for (let y = 0; y < GAME_H; y++) {
      for (let x = 0; x < GAME_W; x++) {
        cols.length = 0;
        counts.length = 0;
        let opaque = 0;
        for (let sy = 0; sy < K; sy++) {
          let o = ((y * K + sy) * HW + x * K) * 4;
          for (let sx = 0; sx < K; sx++, o += 4) {
            if (src[o + 3] < 128) continue;
            opaque++;
            // a few bits off each channel, so near-identical shades vote together
            const c = ((src[o] >> 3) << 10) | ((src[o + 1] >> 3) << 5) | (src[o + 2] >> 3);
            const at = cols.indexOf(c);
            if (at < 0) {
              cols.push(c);
              counts.push(1);
            } else counts[at]++;
          }
        }
        if (opaque * 2 <= K * K) continue;
        let best = 0;
        for (let i = 1; i < cols.length; i++) if (counts[i] > counts[best]) best = i;
        const c = cols[best];
        const i = (y * GAME_W + x) * 4;
        d[i] = ((c >> 10) & 31) * 8.226;
        d[i + 1] = ((c >> 5) & 31) * 8.226;
        d[i + 2] = (c & 31) * 8.226;
        d[i + 3] = 255;
        solid[y * GAME_W + x] = 1;
      }
    }
    for (let y = 0; y < GAME_H; y++) {
      for (let x = 0; x < GAME_W; x++) {
        const i = y * GAME_W + x;
        if (solid[i]) continue;
        const l = x > 0 && solid[i - 1] === 1;
        const r = x < GAME_W - 1 && solid[i + 1] === 1;
        const dn = y < GAME_H - 1 && solid[i + GAME_W] === 1;
        if (l || r || dn) {
          d[i * 4] = 0x14;
          d[i * 4 + 1] = 0x10;
          d[i * 4 + 2] = 0x0e;
          d[i * 4 + 3] = 255;
        }
      }
    }
    for (const st of mine) {
      st.rows.forEach((row, j) => {
        for (let k = 0; k < row.length; k++) {
          const col = st.colors[row[k]];
          const x = st.x + k;
          const y = st.y + j;
          if (!col || x < 0 || y < 0 || x >= GAME_W || y >= GAME_H || !solid[y * GAME_W + x]) continue;
          const i = (y * GAME_W + x) * 4;
          d[i] = parseInt(col.slice(1, 3), 16);
          d[i + 1] = parseInt(col.slice(3, 5), 16);
          d[i + 2] = parseInt(col.slice(5, 7), 16);
        }
      });
    }
    lc.putImageData(img, 0, 0);
    return this.low;
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
