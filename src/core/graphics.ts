/**
 * GRAPHICS AND DISPLAY.  Settings > General.
 *
 * One quality level, LOW to CINEMATIC, read by whatever 3D stage is on
 * screen and applied the moment it changes -- no restart, no reload.  HIGH is
 * the game exactly as it was built; the levels either side of it trade or
 * spend frame time on:
 *
 *   resolution      the 3D is rendered small and scaled up (the pixel look);
 *                   higher levels render it larger, which is supersampling:
 *                   sharper textures, cleaner edges, less shimmer in leaves
 *   texture filter  anisotropic filtering, so ground and walls at a glancing
 *                   angle stay crisp instead of smearing
 *   foliage         how much of the decorative greenery is drawn (never
 *                   anything you hide in or collide with)
 *   particles       how many falling leaves and the like
 *   view distance   how far the fog lets you see, and the camera's far plane
 *   shadows         real-time shadow maps from spot and directional lights,
 *                   when the SHADOWS switch is on, at a map size by level
 *   post            CINEMATIC adds a lens vignette and a touch of contrast
 *
 * A phone is offered LOW to HIGH only: ULTRA and CINEMATIC on a phone are
 * heat and battery, not a better picture.
 *
 * BRIGHTNESS is a display setting, not a 3D one: a CSS filter on every canvas
 * on the page, so it brightens the 2D rooms and the menus as well.
 */

import { store } from './state';
import { isTouch } from './device';

export const QUALITY_NAMES = ['LOW', 'MEDIUM', 'HIGH', 'ULTRA', 'CINEMATIC'] as const;

export interface QualityProfile {
  /** Render scale over the game's pixel size (HIGH = 1.5, as built). */
  res: number;
  aniso: number;
  /** Fraction of decorative foliage instances drawn. */
  foliage: number;
  /** Fraction of particles drawn. */
  particles: number;
  /** Multiplier on fog density (lower sees further). */
  fog: number;
  /** Multiplier on the camera's far plane. */
  far: number;
  /** Shadow map size, or 0 for no shadows. */
  shadowMap: number;
  /** Lens vignette and contrast. */
  post: boolean;
}

const PROFILES: QualityProfile[] = [
  { res: 1, aniso: 1, foliage: 0.5, particles: 0.35, fog: 1.15, far: 0.85, shadowMap: 512, post: false },
  { res: 1.25, aniso: 2, foliage: 0.75, particles: 0.65, fog: 1.06, far: 0.95, shadowMap: 1024, post: false },
  { res: 1.5, aniso: 4, foliage: 1, particles: 1, fog: 1, far: 1, shadowMap: 1024, post: false },
  { res: 2.25, aniso: 8, foliage: 1, particles: 1, fog: 0.94, far: 1.1, shadowMap: 2048, post: false },
  { res: 3, aniso: 16, foliage: 1, particles: 1, fog: 0.9, far: 1.2, shadowMap: 2048, post: true },
];

/** The highest level this device is offered. */
export function maxQuality(): number {
  return isTouch() ? 2 : 4;
}

export function quality(): number {
  return Math.min(maxQuality(), store.get().settings.quality);
}

export function qualityProfile(): QualityProfile {
  return PROFILES[quality()];
}

export function shadowsOn(): boolean {
  return store.get().settings.shadows;
}

/** The CSS filter every canvas wears: brightness, and CINEMATIC's contrast. */
export function baseFilter(): string {
  const b = store.get().settings.brightness / 100;
  const post = qualityProfile().post;
  const parts: string[] = [];
  if (b !== 1) parts.push(`brightness(${b.toFixed(2)})`);
  if (post) parts.push('contrast(1.06) saturate(1.05)');
  return parts.join(' ');
}

/** Put the brightness on every canvas on the page.  Cheap; call freely. */
export function applyDisplay(): void {
  if (typeof document === 'undefined') return;
  const f = baseFilter();
  document.querySelectorAll('canvas').forEach((c) => {
    // (a jumpscare's jolt composes its own filter on top of this one: see
    // jumpscare3d)
    c.style.filter = f;
  });
}

type Listener = () => void;
const listeners = new Set<Listener>();
/** Called whenever a graphics or display setting changes. */
export function onGraphicsChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function graphicsChanged(): void {
  applyDisplay();
  for (const fn of listeners) fn();
}
