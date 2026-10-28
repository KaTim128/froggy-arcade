/**
 * Scenes that draw over everything but are never "where the player is": the
 * BADGE UNLOCKED drop-down.  Anything that asks which scene is on top -- the
 * touch layout, the pause menu -- looks past these, or a badge earned in a
 * room would take its controls away for as long as the plate was down.
 */
const OVERLAYS = new Set(['BadgeToast']);

export const isOverlay = (key: string): boolean => OVERLAYS.has(key);
