/**
 * The player's look sensitivity (Settings > Controls), as a multiplier on
 * every 3D room's own turning rate -- mouse, pointer lock and the touch look
 * pad alike.  1 is the rate each room was tuned to.
 */

import { store } from './state';

export function lookScale(): number {
  return (store.get().settings.lookSens ?? 100) / 100;
}
