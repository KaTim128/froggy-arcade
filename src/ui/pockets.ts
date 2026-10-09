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

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { store } from '../core/state';
import { GAME_W } from '../render/pixelScaler';
import { CAMERA_PRIZE, prizeById } from '../game/content';
import { SLOTS, heldItems, itemDef, type ItemDef } from '../game/inventory';
import { drawPrize } from '../scenes2d/PrizeCounter';

const CELL = 15;
const GAP = 3;

/** A thing from the pockets, drawn standing on `y`, centred on `x`. */
export function drawItem(scene: Phaser.Scene, x: number, y: number, d: ItemDef, scale = 1): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const S = scale;
  const E = (dx: number, dy: number, w: number, h: number, c: number) => {
    const o = scene.add.ellipse(x + dx * S, y + dy * S, w * S, h * S, c);
    out.push(o);
    return o;
  };
  const R = (dx: number, dy: number, w: number, h: number, c: number) => {
    const o = scene.add.rectangle(x + dx * S, y + dy * S, w * S, h * S, c);
    out.push(o);
    return o;
  };
  const dark = 0x1a1410;
  if (d.kind === 'camera') {
    const before = new Set(scene.children.list);
    drawPrize(scene, x, y, CAMERA_PRIZE, 0.62 * S);
    for (const o of scene.children.list) if (!before.has(o)) out.push(o);
    return out;
  }
  if (d.kind === 'prize') {
    const p = prizeById(d.id);
    if (p) {
      const before = new Set(scene.children.list);
      drawPrize(scene, x, y, p, 0.55 * S);
      for (const o of scene.children.list) if (!before.has(o)) out.push(o);
    }
    return out;
  }
  if (d.kind === 'key') {
    // a brass key lying on its side: the bow, the shaft, the bit
    E(-4, -5, 6, 6, d.color);
    E(-4, -5, 2.6, 2.6, 0x2a2018);
    R(1.5, -5, 8, 1.8, d.color);
    R(4, -3.4, 1.4, 2, d.color);
    R(5.8, -3.6, 1.2, 1.6, d.color);
    R(1, -5.6, 6, 0.6, 0xf2d880);
    return out;
  }
  if (d.kind === 'plush') {
    // a sitting animal: a round body, a round head, two ears, two eyes
    E(0, -3, 9, 7, d.color);
    E(0, -8.5, 8, 7, d.color);
    if (d.id === 'plush:bunny') {
      R(-1.6, -14, 1.6, 5, d.color);
      R(1.6, -13.5, 1.6, 4, d.color);
    } else if (d.id === 'plush:duck') {
      R(4, -8, 3, 1.6, PALETTE.ember);
    } else if (d.id !== 'plush:frog') {
      E(-2.6, -12, 2.6, 2.6, d.color);
      E(2.6, -12, 2.6, 2.6, d.color);
    } else {
      E(-2, -12, 2.8, 2.8, d.color);
      E(2, -12, 2.8, 2.8, d.color);
    }
    E(-1.4, -9, 1.1, 1.1, dark);
    E(1.4, -9, 1.1, 1.1, dark);
    return out;
  }
  // the oddities, each its own odd thing
  switch (d.id) {
    case 'oddity:musicbox':
      R(0, -3.5, 10, 7, d.color);
      R(0, -7.5, 11, 2, 0x8a5aa8);
      R(4, -10, 1, 4, PALETTE.gold);
      break;
    case 'oddity:glasseye':
      E(0, -5, 9, 9, 0xf4f0e8);
      E(1.4, -5, 4.4, 4.4, 0x3f7fd6);
      E(1.6, -5, 1.8, 1.8, dark);
      break;
    case 'oddity:waxhand':
      R(0, -2.5, 7, 5, d.color);
      for (let i = 0; i < 4; i++) R(-2.6 + i * 1.7, -7.5, 1.3, 5 - Math.abs(i - 1.5), d.color);
      R(4.2, -4, 1.5, 3, d.color);
      break;
    case 'oddity:dollhead':
      E(0, -5.5, 9, 10, d.color);
      E(-1.8, -6, 1.6, 1.2, dark);
      E(1.8, -6, 1.6, 1.2, dark);
      R(0, -2.5, 2, 0.8, 0xc0303a);
      R(0, -10.5, 8, 2, 0x5a3a20);
      break;
    default:
      E(0, -5, 8, 10, d.color).setAlpha(0.9);
      E(0, -5, 4, 2, 0x3a2a1a);
      break;
  }
  return out;
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
  const draw = (): void => {
    layer.removeAll(true);
    const held = heldItems();
    for (let i = 0; i < SLOTS; i++) {
      const x = x0 + i * (CELL + GAP);
      layer.add(scene.add.rectangle(x, y0, CELL, CELL, PALETTE.black, 0.55).setOrigin(0, 0).setStrokeStyle(1, PALETTE.slate));
      const d = held[i] ? itemDef(held[i]) : undefined;
      if (d) layer.add(drawItem(scene, x + CELL / 2, y0 + CELL - 1, d, 0.9));
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
