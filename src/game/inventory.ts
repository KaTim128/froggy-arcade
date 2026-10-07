/**
 * ---- THE POCKETS.
 *
 * Three slots of things carried in the hand.  The counter's prizes still go
 * in the bag (`prizesOwned`) and are sold from it as they always were; these
 * are the other kind of thing -- what comes out of the cranes in the fourth
 * room, and the camera once it has been bought -- and there is room for
 * three of them, no more.  A full set of pockets refuses the next one with a
 * line saying so, and the ticket crane will not take tokens from someone who
 * has nowhere to put what it gives them.
 *
 * An item is an id: `plush:frog`, `oddity:musicbox`, `camera`.  Everything
 * about it -- what it is called, what it is worth to the man outside, what
 * the player thinks looking at it -- is looked up from the id here.
 */

import { store } from '../core/state';
import { cashFor, prizeById } from './content';

export const SLOTS = 3;

export type ItemKind = 'plush' | 'oddity' | 'camera' | 'key' | 'prize';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  color: number;
  /** What the man outside pays for it in cash.  0: he does not get it. */
  value: number;
  /** What the player thinks, looking at it in the inventory. */
  thought: string;
}

/** The left crane's animals.  Cheap, soft, and worth very little to anyone. */
export const PLUSHIES: ItemDef[] = [
  // What the man pays: 20 for any plush -- and 50 for a Froggy, the one he wants.
  { id: 'plush:frog', name: 'FROGGY PLUSH', kind: 'plush', color: 0x46c46e, value: 50, thought: 'A little frog. It looks happier than the real one.' },
  { id: 'plush:bear', name: 'BEAR PLUSH', kind: 'plush', color: 0xa8743e, value: 20, thought: 'Soft. Somebody will want this more than I do.' },
  { id: 'plush:bunny', name: 'BUNNY PLUSH', kind: 'plush', color: 0xf2e6d8, value: 20, thought: 'One ear is longer than the other. Still cute.' },
  { id: 'plush:duck', name: 'DUCK PLUSH', kind: 'plush', color: 0xffc830, value: 20, thought: 'It squeaks if you squeeze it. I keep squeezing it.' },
  { id: 'plush:cat', name: 'CAT PLUSH', kind: 'plush', color: 0x8a8f99, value: 20, thought: 'It has button eyes. One is hanging by a thread.' },
  { id: 'plush:owl', name: 'OWL PLUSH', kind: 'plush', color: 0x7b4bd8, value: 20, thought: 'A purple owl. Not a colour owls come in.' },
];

/** What the right crane's capsules sometimes hold.  He pays well for these. */
export const ODDITIES: ItemDef[] = [
  { id: 'oddity:musicbox', name: 'OLD MUSIC BOX', kind: 'oddity', color: 0x6a3a8a, value: 250, thought: 'It plays a tune I almost know. That man outside would want this.' },
  { id: 'oddity:glasseye', name: 'GLASS EYE', kind: 'oddity', color: 0x9fd4e0, value: 250, thought: 'It is cold, and it keeps ending up facing me.' },
  { id: 'oddity:waxhand', name: 'WAX HAND', kind: 'oddity', color: 0xe8dcc0, value: 250, thought: 'A hand made of wax. The fingerprints are real.' },
  { id: 'oddity:dollhead', name: 'DOLL HEAD', kind: 'oddity', color: 0xf0c8c0, value: 250, thought: 'Porcelain. The eyes close when you tip it. I wish they would stay closed.' },
  { id: 'oddity:amber', name: 'MOTH IN AMBER', kind: 'oddity', color: 0xe8a030, value: 250, thought: 'A moth, stopped mid-flight. Something about it feels old.' },
];

/** Bought off the counter after the night, and not for sale to anyone. */
export const CAMERA_ITEM: ItemDef = {
  id: 'camera',
  name: 'VIDEO CAMERA',
  kind: 'camera',
  color: 0x3a3f4c,
  value: 0,
  thought: "I'm not selling this. It might be the only proof of what happened in there.",
};

/** The key from the basement, in the pocket once the night is survived. */
export const KEY_ITEM: ItemDef = {
  id: 'key',
  name: 'BRASS KEY',
  kind: 'key',
  color: 0xd8b04a,
  value: 0,
  thought: 'The key from the basement. It got me out. The staff at the counter said one went missing...',
};

export function itemDef(id: string): ItemDef | undefined {
  if (id === CAMERA_ITEM.id) return CAMERA_ITEM;
  if (id === KEY_ITEM.id) return KEY_ITEM;
  // a prize off the counter, carried in a pocket until it is sold
  const p = prizeById(id);
  if (p) {
    return {
      id,
      name: p.name,
      kind: 'prize',
      color: p.color,
      value: cashFor(p),
      thought: 'From the prize counter. That man outside might buy this.',
    };
  }
  return PLUSHIES.find((p) => p.id === id) ?? ODDITIES.find((o) => o.id === id);
}

/**
 * Everything in the pockets, in slot order: the counter's prizes that are
 * still unsold (the camera first, if it is held), then the cranes' things.
 * A prize off the counter is carried like anything else, so it takes a
 * pocket until the man outside buys it.
 */
export function heldItems(s = store.get()): string[] {
  const prizes = s.prizesOwned.filter((id) => !s.prizesSold.includes(id));
  prizes.sort((a, b) => Number(b === CAMERA_ITEM.id) - Number(a === CAMERA_ITEM.id));
  return [...prizes, ...s.items].slice(0, SLOTS);
}

export function pocketsFull(s = store.get()): boolean {
  return heldItems(s).length >= SLOTS;
}

/** The line said when something will not fit. */
export const FULL_LINE = 'My hands are full. I need to get rid of something first.';

/** Put it in a pocket.  False, and nothing changes, when there is no room. */
export function addItem(id: string): boolean {
  const s = store.get();
  if (pocketsFull(s)) return false;
  store.patch({ items: [...s.items, id] });
  store.flush();
  return true;
}

/**
 * Surviving the night leaves the key in a pocket.  Put it there if it is not
 * -- an older save, or a jump straight to the morning after -- so long as it
 * has not been handed back and there is room for it.
 */
export function ensureKeyInPocket(): void {
  const s = store.get();
  if (!s.froggyGone || s.keyReturned || s.items.includes(KEY_ITEM.id)) return;
  addItem(KEY_ITEM.id);
}

/** Is the key in a pocket right now? */
export function holdingKey(s = store.get()): boolean {
  return !s.keyReturned && s.items.includes(KEY_ITEM.id);
}

/** Take one of it out of the pockets (the first, if there are two the same). */
export function removeItem(id: string): boolean {
  const s = store.get();
  const i = s.items.indexOf(id);
  if (i < 0) return false;
  const next = s.items.slice();
  next.splice(i, 1);
  store.patch({ items: next });
  store.flush();
  return true;
}
