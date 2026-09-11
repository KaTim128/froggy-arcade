/**
 * The palette.  PRD §11.2 / QFD C5 (rank #5).
 *
 * 32 colours for the world layer.  AR-3 caps it here; the post-break look is a
 * TRANSFORM of these same values (AR-6), never a second set of art, so the
 * player recognises the space.
 *
 * Froggy does not use this palette.  He is not part of this world (PRD FR-1).
 */

export const PALETTE = {
  // darks / structure
  black: 0x0b0d12,
  ink: 0x141a24,
  slate: 0x243040,
  steel: 0x3a4a5c,
  ash: 0x5c6b7d,
  fog: 0x8e9cad,
  bone: 0xd6dce4,
  white: 0xf4f7fb,

  // warm key light
  amber: 0xffb038,
  amberDark: 0xc77a1b,
  gold: 0xffd45e,
  cream: 0xfff0c9,
  ember: 0xff7a3d,
  rust: 0xa8451f,

  // magenta neon
  neon: 0xff4fa3,
  neonDim: 0xb02c6c,
  violet: 0x7b4bd8,
  plum: 0x3d2a5c,

  // teal carpet
  teal: 0x1f8a8a,
  tealDark: 0x145c5f,
  tealLight: 0x46c4bd,

  // greens (the arcade's own, not Froggy's)
  moss: 0x3f7a4a,
  mossLight: 0x6fbb6a,

  // blues for the night pass
  night: 0x121a2e,
  nightMid: 0x1e2b45,
  nightLight: 0x35486b,
  moon: 0x9fb6d9,

  // accents
  blood: 0xc31f2e,
  brown: 0x6b4a2f,
  brownLight: 0x9c7248,
} as const;

export type PaletteKey = keyof typeof PALETTE;

/**
 * The post-break transform.  PRD P2 / AR-6: desaturate ~70%, shift blue.
 * Applied to the SAME tiles so the room is recognisable.
 */
export function nightify(color: number, amount = 0.7): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;

  let nr = r + (lum - r) * amount;
  let ng = g + (lum - g) * amount;
  let nb = b + (lum - b) * amount;

  // Blue shift + overall darkening.
  nr *= 0.55;
  ng *= 0.68;
  nb *= 1.02;

  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (cl(nr) << 16) | (cl(ng) << 8) | cl(nb);
}

/**
 * The opposite of nightify: the same tiles at noon.
 *
 * Mixes toward white and lifts the whole thing a little, so the facade that
 * reads as a warm dusk building reads as a plain, bright, ordinary one — the
 * daytime street is meant to feel safe and unremarkable, and a dark building
 * under a blue sky just looks like a storm is coming.
 */
export function daylight(color: number, amount = 0.28): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    (cl(r + (255 - r) * amount + 12) << 16) |
    (cl(g + (255 - g) * amount + 12) << 8) |
    cl(b + (255 - b) * amount + 8)
  );
}

/** Multiply a colour toward black — used for the 30% dim on the second bust. */
export function dim(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

export function css(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}
