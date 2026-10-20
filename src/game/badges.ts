/**
 * ---- BADGES.  The story's milestones: what happened to you, not how well
 * you played.  (How well you played is the achievements' job -- the Goals
 * card, game/life -- and the two never share a list.)
 *
 * Kept on the profile (`GameState.badges`): a reset of the run keeps them,
 * deleting the profile loses them.  A badge not yet earned shows as a
 * locked plate with a hint that does not give the story away.
 */

import Phaser from 'phaser';
import { store } from '../core/state';
import { audio } from '../core/audio';
import { centerText } from '../core/ui';
import { PALETTE } from '../render/palette';
import { GAME_W } from '../render/pixelScaler';

export interface BadgeDef {
  id: string;
  name: string;
  /** What it was for, shown once it is earned. */
  desc: string;
  /** Shown while it is locked: a nudge, never the plot. */
  hint: string;
  /** Its plate colour. */
  col: number;
}

export const BADGES: BadgeDef[] = [
  { id: 'hide_seek', name: 'HIDE AND SEEK', desc: 'MADE IT THROUGH THE NIGHT IN THE ARCADE.', hint: 'STAY AFTER CLOSING.', col: 0x6fbb6a },
  { id: 'not_homeless', name: 'NOT HOMELESS ANYMORE', desc: 'A KEY TO A PLACE OF YOUR OWN.', hint: 'FIND SOMEWHERE TO LIVE.', col: 0xd8a838 },
  { id: 'late_checkout', name: 'LATE CHECK-OUT', desc: 'LEFT THE GRAND LILY BY THE ROOF.', hint: 'NOT EVERY WAY OUT IS A DOOR.', col: 0x7a9ad8 },
  { id: 'most_wanted', name: 'MOST WANTED', desc: 'SAW YOUR OWN FACE ON A POSTER.', hint: 'COME BACK LATER.', col: 0xc83a3a },
  { id: 'new_leaf', name: 'A FRESH START', desc: 'MOVED INTO ROOM 213.', hint: 'SOMEBODY OWES YOU ONE.', col: 0x8ac8b8 },
  { id: 'low_profile', name: 'LOW PROFILE', desc: 'GOT OUT OF SIGHT WITH THE POLICE ON YOU.', hint: 'KNOW WHEN TO DISAPPEAR.', col: 0x5a6a8a },
  { id: 'justice', name: 'JUSTICE PREVAILS', desc: 'ARRESTED. THE STORY ENDED IN A CELL.', hint: 'AN ENDING.', col: 0x3a5aa8 },
];

export const badgeById = (id: string): BadgeDef | undefined => BADGES.find((b) => b.id === id);

export const hasBadge = (id: string): boolean => store.get().badges.includes(id);

/**
 * Earn a badge (once).  Saved at once.  With a scene, a plate comes down
 * from the top of the screen to say so.  Returns whether it was new.
 */
export function earnBadge(id: string, scene?: Phaser.Scene): boolean {
  const def = badgeById(id);
  if (!def || hasBadge(id)) return false;
  store.patch({ badges: [...store.get().badges, id] });
  store.flush();
  if (scene) badgeToast(scene, def);
  return true;
}

/** BADGE EARNED, and its name, on a plate that drops in and goes again. */
export function badgeToast(scene: Phaser.Scene, def: BadgeDef): void {
  audio.sfx('ticket_machine', 0.35);
  const w = Math.max(120, def.name.length * 6 + 24);
  const plate = scene.add.rectangle(0, 0, w, 22, 0x14100c, 0.92).setStrokeStyle(1, def.col);
  const head = centerText(scene, 0, -5, 'BADGE EARNED', def.col);
  const name = centerText(scene, 0, 5, def.name, PALETTE.cream);
  const c = scene.add.container(GAME_W / 2, -16, [plate, head, name]).setDepth(3000).setScrollFactor(0);
  scene.tweens.add({
    targets: c,
    y: 46,
    duration: 420,
    ease: 'Back.easeOut',
    onComplete: () => scene.tweens.add({ targets: c, y: -16, delay: 2600, duration: 360, ease: 'Sine.easeIn', onComplete: () => c.destroy() }),
  });
}
