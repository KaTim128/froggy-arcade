/**
 * What a piece of furniture is FOR, wherever it stands -- in the shop, to try
 * it, or in your condo.  Chairs and sofas are sat on, beds lain on, the TV
 * and the lamp switched on and off, the radio played.  Pictures, rugs,
 * tables and shelves are just there to be looked at.
 */

import type { FurnitureDef } from './catalog';

export type FurnitureVerb = 'sit' | 'lie' | 'switch' | 'play' | null;

export function useOf(f: FurnitureDef): FurnitureVerb {
  switch (f.cat) {
    case 'chair':
    case 'sofa':
      return 'sit';
    case 'bed':
      return 'lie';
    case 'tv':
    case 'lamp':
      return 'switch';
    case 'radio':
      return 'play';
    default:
      return null;
  }
}

export const VERB_LABEL: Record<Exclude<FurnitureVerb, null>, string> = {
  sit: 'SIT DOWN',
  lie: 'LIE DOWN',
  switch: 'SWITCH ON/OFF',
  play: 'PLAY',
};
