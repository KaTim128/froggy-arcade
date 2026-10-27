/**
 * Integer letterbox scaler.  PRD SM-3 / AR-1 / QFD A4.
 *
 * 320x180 logical buffer, scaled by an INTEGER factor only, centred, with the
 * page's black background acting as the letterbox bars.  Never stretch, never
 * fractional — fractional scaling is what makes pixel art look like mud.
 *
 * ON A PHONE THE INTEGER RULE IS THE WRONG RULE, and it is the one place it is
 * broken on purpose.  A portrait screen is around 390 CSS pixels across, so
 * the largest integer that fits a 320-wide buffer is ONE: the game would play
 * at postage-stamp size with two thirds of the glass unused.  Touch devices
 * therefore get a continuous fit of the space actually left over after the
 * on-screen controls have taken theirs, and `image-rendering: pixelated` keeps
 * the blocks crisp.  Held sideways, a phone is filled edge to edge WITHOUT
 * stretching: the picture is fitted to the screen's height at its true 16:9
 * shape, and the bands either side of it are filled by an ambient glow of the
 * picture itself (see `ambient`), so the screen is all game and nothing is
 * squashed.  At the two-and-three-times device pixel ratios phones
 * ship with, the unevenness a fractional factor introduces lands inside a
 * single physical pixel and cannot be seen.  Desktop is untouched.
 */

import Phaser from 'phaser';
import { froggyLayer } from './froggyLayer';
import { isTouch, safeInsets } from '../core/device';
import { touchControls } from '../ui/touchControls';

export const GAME_W = 320;
export const GAME_H = 180;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

/**
 * THE DESKTOP FIT.  Crisp first: the largest scale that puts every logical
 * pixel on a whole number of DEVICE pixels -- which on a 1.25x or 1.5x
 * display is finer-grained than whole CSS pixels, and fills far more of the
 * window.  But a crisp fit that leaves more than a tenth of the window black
 * is a letterbox nobody asked for (a 1440x900 screen got 1280x720 and an
 * eighty pixel frame), so then it fills the window instead and lets
 * `image-rendering: pixelated` keep the blocks square.
 */
export function computeZoom(viewW: number, viewH: number, dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1): number {
  const raw = Math.min(viewW / GAME_W, viewH / GAME_H);
  const crisp = Math.floor(raw * dpr + 1e-6) / dpr;
  const zoom = crisp >= raw * 0.9 ? crisp : Math.floor(raw * 100) / 100;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

/** A hand's breadth of black over the picture, so it is not against the notch. */
export const TOUCH_TOP_PAD = 12;

/**
 * The touch fit: fill what is left, to two decimal places so the canvas is not
 * re-sized on every pixel of a scroll bounce.  Never smaller than 1, because
 * below that the pixel font stops being readable at all.
 */
export function computeTouchZoom(viewW: number, viewH: number, reserve: number, sides = 0, topPad = TOUCH_TOP_PAD): number {
  const usable = Math.max(120, viewH - reserve - (reserve > 0 ? topPad : 0));
  const across = Math.max(160, viewW - sides);
  const raw = Math.min(across / GAME_W, usable / GAME_H);
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(raw * 100) / 100));
}

let attached: Phaser.Game | null = null;

/**
 * THE AMBIENT FILL.  Where the 16:9 picture does not reach the edges of a
 * wider screen, the bands are painted with the picture's own colours: every
 * few frames it is copied down to a 32x18 thumbnail, and that thumbnail is
 * blown up across the whole screen, blurred and dimmed, behind the game.  The
 * room's light spills out to the edges of the glass, the way an ambient TV
 * does, instead of the picture being stretched to get there.
 */
const ambient = {
  canvas: null as HTMLCanvasElement | null,
  ctx: null as CanvasRenderingContext2D | null,
  on: false,
  frame: 0,
  ensure(): void {
    if (this.canvas) return;
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 18;
    c.id = 'ambient';
    Object.assign(c.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      filter: 'blur(14px) brightness(0.5) saturate(1.2)',
      transform: 'scale(1.15)',
      pointerEvents: 'none',
      zIndex: '0',
      display: 'none',
    } as Partial<CSSStyleDeclaration>);
    document.body.prepend(c);
    this.canvas = c;
    this.ctx = c.getContext('2d');
  },
  set(on: boolean): void {
    if (on) this.ensure();
    this.on = on;
    if (this.canvas) this.canvas.style.display = on ? 'block' : 'none';
    // (the root's own black would cover it)
    const root = document.getElementById('game-root');
    if (root) root.style.background = on ? 'transparent' : '';
  },
  copy(src: HTMLCanvasElement): void {
    if (!this.on || !this.ctx) return;
    if (this.frame++ % 4 !== 0) return;
    try {
      this.ctx.drawImage(src, 0, 0, 32, 18);
    } catch {
      // (a lost context: the last glow stays up)
    }
  },
};

export function attachScaler(game: Phaser.Game): void {
  attached = game;
  const root = document.getElementById('game-root');
  const apply = () => {
    if (!attached) return;
    const touch = isTouch();
    // THE WHOLE SCREEN IS THE GAME'S.  Nothing is reserved for the controls
    // any more: they float over it (see touchControls).  The picture is fitted
    // as large as the safe area allows -- across a portrait phone and up its
    // top, or as tall as a landscape one and centred.
    const safe = touch ? safeInsets() : { top: 0, right: 0, bottom: 0, left: 0 };
    const portrait = touch && window.innerHeight >= window.innerWidth;
    const topPad = portrait ? Math.max(TOUCH_TOP_PAD, safe.top) : safe.top;
    // A phone held sideways is filled TOP TO BOTTOM at the picture's own
    // shape -- it used to be stretched across the rest of the width too,
    // which made every circle an egg and every person fat.  What is left
    // either side is the ambient glow, not black bars.
    const fill = touch && !portrait;
    const zoom = fill
      ? computeTouchZoom(window.innerWidth, window.innerHeight, 0, 0, 0)
      : touch
        ? computeTouchZoom(window.innerWidth, window.innerHeight - topPad - safe.bottom, 0, safe.left + safe.right, 0)
        : computeZoom(window.innerWidth, window.innerHeight);
    attached.canvas.style.transform = '';
    ambient.set(fill && window.innerWidth - GAME_W * zoom > 8);
    if (fill && root) {
      root.style.padding = '';
    } else if (root) {
      root.style.paddingTop = topPad ? `${topPad}px` : '';
      root.style.paddingLeft = safe.left ? `${safe.left}px` : '';
      root.style.paddingRight = safe.right ? `${safe.right}px` : '';
      // In portrait the picture goes to the top: everything under it is
      // padding, which is where the thumbs end up.
      const below = portrait ? Math.max(safe.bottom, Math.floor(window.innerHeight - topPad - zoom * GAME_H)) : safe.bottom;
      root.style.paddingBottom = below ? `${below}px` : '';
    }
    if (attached.scale.zoom !== zoom) attached.scale.setZoom(zoom);
    attached.scale.refresh();
    // PRD SM-4: the overlay tracks the scaled canvas exactly, but renders at
    // full device resolution so Froggy stays smooth at every zoom level.
    froggyLayer.syncTo(attached.canvas, zoom);
    // The controls are placed against wherever the picture now sits.
    if (touch) touchControls.relayout();
  };

  apply();
  game.events.on(Phaser.Core.Events.POST_RENDER, () => ambient.copy(game.canvas));
  window.addEventListener('resize', apply);
  // A phone turned over settles its bars over most of a second (an iPhone's
  // address bar shrinks after the turn, not with it): fit again as it does,
  // and whenever the visible part of the page changes size, so the picture
  // never sits in the old shape with black gaps round it (log #62).
  window.addEventListener('orientationchange', () => {
    for (const ms of [120, 400, 900]) window.setTimeout(apply, ms);
  });
  window.visualViewport?.addEventListener('resize', apply);
  // Some browsers settle layout a frame late.
  window.setTimeout(apply, 50);
  window.setTimeout(apply, 250);
}

export function currentZoom(): number {
  return attached?.scale.zoom ?? 1;
}
