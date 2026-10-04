/**
 * The whole inventory, over the room.  G (or a tap on the pockets) opens it,
 * G, Esc or CLOSE shuts it, and the room underneath is paused while it is up.
 *
 * The three pockets, big, each with its name and what the man outside pays
 * for it; pick one and the player says what they think of it.  Under that,
 * what is in the bag from the prize counter.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { button, centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { SLOTS, heldItems, itemDef } from '../game/inventory';
import { prizeById } from '../game/content';
import { drawItem } from '../ui/pockets';
import { froggyLayer } from '../render/froggyLayer';

const CELL_W = 74;
const CELL_H = 50;

export class InventoryModal extends Phaser.Scene {
  private from = '';
  private picked = -1;
  private body!: Phaser.GameObjects.Container;

  constructor() {
    super('InventoryModal');
  }

  init(data: { from?: string } = {}): void {
    this.from = data.from ?? '';
    this.picked = -1;
  }

  create(): void {
    this.scene.bringToTop();
    if (this.from && this.scene.isActive(this.from)) this.scene.pause(this.from);
    // The characters painted on the overlay sit above the canvas: put them
    // away while this is up, as the pause menu does.
    froggyLayer.setVisible(false);
    audio.sfx('ui_blip', 0.6);
    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.82).setOrigin(0, 0).setInteractive();
    this.add.rectangle(GAME_W / 2, GAME_H / 2, 292, 164, PALETTE.ink).setStrokeStyle(1, PALETTE.gold);
    centerText(this, GAME_W / 2, 16, 'INVENTORY', PALETTE.gold);
    this.body = this.add.container(0, 0);
    this.render();
    button(this, GAME_W / 2, 164, 'CLOSE', () => this.close(), { width: 60, height: 12 });
    this.input.keyboard?.on('keydown-G', () => this.close());
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private render(): void {
    this.body.removeAll(true);
    const s = store.get();
    const held = heldItems(s);
    const x0 = GAME_W / 2 - (SLOTS * CELL_W + (SLOTS - 1) * 6) / 2;
    for (let i = 0; i < SLOTS; i++) {
      const x = x0 + i * (CELL_W + 6);
      const y = 26;
      const id = held[i];
      const d = id ? itemDef(id) : undefined;
      const box = this.add
        .rectangle(x, y, CELL_W, CELL_H, PALETTE.black, 0.5)
        .setOrigin(0, 0)
        .setStrokeStyle(1, this.picked === i ? PALETTE.gold : PALETTE.slate);
      this.body.add(box);
      if (!d) {
        this.body.add(centerText(this, x + CELL_W / 2, y + CELL_H / 2, 'EMPTY', PALETTE.slate));
        continue;
      }
      this.body.add(drawItem(this, x + CELL_W / 2, y + 30, d, 1.4));
      this.body.add(centerText(this, x + CELL_W / 2, y + 37, d.name, PALETTE.cream));
      this.body.add(centerText(this, x + CELL_W / 2, y + 45, d.value > 0 ? `HE PAYS $${d.value}` : 'NOT FOR SALE', d.value > 0 ? PALETTE.mossLight : PALETTE.ash));
      box.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.picked = this.picked === i ? -1 : i;
        audio.sfx('ui_blip', 0.4);
        this.render();
      });
    }
    // what the player thinks of the one picked
    const pick = this.picked >= 0 && held[this.picked] ? itemDef(held[this.picked]) : undefined;
    this.body.add(
      text(this, 22, 82, pick ? `"${pick.thought}"` : `${held.length}/${SLOTS} POCKETS USED.  PICK ONE TO LOOK AT IT.`, pick ? PALETTE.cream : PALETTE.ash).setMaxWidth(276),
    );
    // and the bag
    const bag = s.prizesOwned
      .filter((id) => id !== 'camera' && !s.prizesSold.includes(id))
      .map((id) => prizeById(id)?.name)
      .filter((n): n is string => !!n);
    this.body.add(text(this, 22, 108, `IN THE BAG (${bag.length})`, PALETTE.gold));
    this.body.add(
      text(this, 22, 118, bag.length ? bag.join(', ') : 'nothing from the prize counter yet', bag.length ? PALETTE.cream : PALETTE.ash).setMaxWidth(276),
    );
    this.body.add(text(this, 22, 146, `$${s.cash} CASH`, PALETTE.mossLight));
  }

  private close(): void {
    froggyLayer.setVisible(true);
    if (this.from && this.scene.isPaused(this.from)) this.scene.resume(this.from);
    this.scene.stop();
  }
}
