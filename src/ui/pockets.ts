/**
 * ---- THE POCKETS, ON SCREEN.
 *
 * Three slots along the bottom middle of the picture: what is in the hand
 * right now, drawn as itself.  Press G -- or tap the slots -- and the whole
 * inventory opens over the room (`InventoryModal`): each thing, what it is,
 * what the player thinks of it and what the man outside would pay, and the
 * counter prizes in the bag under that.
 *
 * Only in the rooms you walk around.  Not in a cabinet, not in hide and seek,
 * not at the crane -- `attachPockets` is called by the rooms and
 * nothing else.
 */

import { claimable } from '../game/life';
import { text } from '../core/ui';
import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { store } from '../core/state';
import { GAME_W } from '../render/pixelScaler';
import { CAMERA_PRIZE, prizeById } from '../game/content';
import { SLOTS, heldItems, itemDef, type ItemDef } from '../game/inventory';
import { prizeShapeOf } from '../scenes2d/PrizeCounter';
import { drawThing, type ThingShape } from '../art/prizeArt';

const CELL = 15;
const GAP = 3;

/**
 * A thing from the pockets, drawn standing on `y`, centred on `x`: the same
 * one-skin drawing as on the prize shelf (art/prizeArt), sized so a pocket
 * slot holds it whole (and with `fit`, never bigger than that box) -- crisp at any size, never a blur of half pixels.
 */
export function drawItem(scene: Phaser.Scene, x: number, y: number, d: ItemDef, scale = 1, fit?: { w: number; h: number }): Phaser.GameObjects.GameObject[] {
  const S = scale * 0.82;
  if (d.kind === 'camera') return [drawThing(scene, 'camera', CAMERA_PRIZE.color, x, y, S, fit)];
  if (d.kind === 'prize') {
    const p = prizeById(d.id);
    return p ? [drawThing(scene, prizeShapeOf(p), p.color, x, y, S, fit)] : [];
  }
  return [drawThing(scene, thingOf(d), d.color, x, y, S, fit)];
}

/** What a crane prize or an oddity is drawn as. */
function thingOf(d: ItemDef): ThingShape {
  if (d.kind === 'key') return 'key';
  if (d.kind === 'plush') return d.id === 'plush:duck' ? 'plushduck' : d.id === 'plush:bunny' ? 'plushbunny' : d.id === 'plush:frog' ? 'plushfrog' : 'plush';
  const odd: Record<string, ThingShape> = { 'oddity:musicbox': 'musicbox', 'oddity:glasseye': 'glasseye', 'oddity:waxhand': 'waxhand', 'oddity:dollhead': 'dollhead', 'oddity:amber': 'amber' };
  return odd[d.id] ?? 'cube';
}

/**
 * The three slots, and G.  `busy` says when the room is in the middle of
 * something else (a talk, a door) and the pockets should stay shut;
 *
 * TOP RIGHT, in every room.  Along the bottom edge they sat where the player
 * walks -- over feet, doors and the machines' fronts -- and the top left is
 * the purse.  The phone's gear is placed below the title bar, under them.
 */
export function attachPockets(scene: Phaser.Scene, busy: () => boolean = () => false): void {
  // (fixed to the screen: in the streets the camera follows you)
  const layer = scene.add.container(0, 0).setDepth(940).setScrollFactor(0);
  const total = SLOTS * CELL + (SLOTS - 1) * GAP;
  const x0 = GAME_W - 4 - total;
  const y0 = 4;
  const GOALS_W = 36;
  const GOALS_X = x0 - 3 - GOALS_W;
  let drawn = '';
  const draw = (): void => {
    // (the store changes every second now -- the clock -- so only redraw
    // when what is in the pockets, or the goals waiting, actually changed)
    const key = `${heldItems().join(',')}|${goalsReady()}`;
    if (key === drawn) return;
    drawn = key;
    layer.removeAll(true);
    const held = heldItems();
    for (let i = 0; i < SLOTS; i++) {
      const x = x0 + i * (CELL + GAP);
      layer.add(scene.add.rectangle(x, y0, CELL, CELL, PALETTE.black, 0.55).setOrigin(0, 0).setStrokeStyle(1, PALETTE.slate));
      const d = held[i] ? itemDef(held[i]) : undefined;
      if (d) layer.add(drawItem(scene, x + CELL / 2, y0 + CELL - 2, d, 0.9, { w: CELL - 4, h: CELL - 4 }));
    }
    // GOALS, beside the pockets on the same row, with how many are ready to
    // claim.  (Under them it sat on the rooms' hanging WIN sign, and on the
    // phone's gear.)
    if (goalsOn()) {
      const n = goalsReady();
      layer.add(scene.add.rectangle(GOALS_X, y0, GOALS_W, CELL, PALETTE.black, 0.55).setOrigin(0, 0).setStrokeStyle(1, n ? PALETTE.gold : PALETTE.slate));
      layer.add(text(scene, GOALS_X + GOALS_W / 2, y0 + (n ? 1 : 4), 'GOALS', n ? PALETTE.gold : PALETTE.fog).setOrigin(0.5, 0));
      if (n) layer.add(text(scene, GOALS_X + GOALS_W / 2, y0 + 8, `${n} NEW`, PALETTE.gold).setOrigin(0.5, 0));
    }
  };
  draw();
  const unsub = store.subscribe(() => draw());
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => unsub());

  const open = (): void => {
    if (busy() || scene.scene.isActive('InventoryModal')) return;
    scene.scene.launch('InventoryModal', { from: scene.scene.key });
  };
  scene.input.keyboard?.on('keydown-G', open);
  const openGoals = (): void => {
    if (!goalsOn() || busy() || scene.scene.isActive('Goals') || scene.scene.isActive('InventoryModal')) return;
    scene.scene.launch('Goals', { from: scene.scene.key });
  };
  scene.input.keyboard?.on('keydown-J', openGoals);
  scene.add
    .zone(GOALS_X, y0, GOALS_W, CELL)
    .setOrigin(0, 0)
    .setDepth(941)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', (_p: unknown, _x: number, _y: number, ev: { stopPropagation(): void }) => {
      ev.stopPropagation();
      openGoals();
    });
  scene.add
    .zone(x0 - 2, y0 - 2, total + 4, CELL + 4)
    .setOrigin(0, 0)
    .setDepth(941)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', (_p: unknown, _x: number, _y: number, ev: { stopPropagation(): void }) => {
      ev.stopPropagation();
      open();
    });
}

/** Goals are part of the daytime life, not the night's story. */
function goalsOn(): boolean {
  const s = store.get();
  return s.seenIntro && s.route === 'normal' && s.timeOfDay !== 'midnight';
}
function goalsReady(): number {
  try {
    return goalsOn() ? claimable() : 0;
  } catch {
    return 0;
  }
}
