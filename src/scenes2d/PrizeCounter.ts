/**
 * Prize counter.  PRD §7.6.
 *
 * A SHELF, not a spreadsheet.  Three shelves of three, with the thing itself
 * standing on each one — a duck is a duck, a guitar is a guitar, and the
 * player picks what they want by looking at it rather than by reading a row in
 * a table.  Every prize carries its price on the shelf edge underneath it.
 *
 * REDEEMED PRIZES LEAVE THE SHELF.  The moment one is bought, its slot empties
 * — bare board, no price, a gap where the thing was — because a counter that
 * keeps showing you what you already own is a counter that is lying about what
 * it has.
 *
 * AND THE SHELF REFILLS.  When the last prize on it goes, the back room sends
 * out a fresh lot: different toys, different colours, the same price curve.
 * The wave is a number on the save (`prizeWave`) and the stock is generated
 * from it (`prizesForWave`), so the shelf you walk away from is the shelf you
 * come back to, and there is always something left to play for.
 */

import Phaser from 'phaser';
import { drawThing, type ThingShape } from '../art/prizeArt';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { ledger } from '../core/ledger';
import { shelfStock, type PrizeDef } from '../game/content';
import { FULL_LINE, pocketsFull } from '../game/inventory';
import { button, centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';

/** Three across, three down, and the slot is what a prize stands in. */
const COLS = 3;
const SLOT_W = 84;
const SLOT_H = 40;
const GRID_X = Math.round((GAME_W - COLS * SLOT_W) / 2);
const GRID_Y = 34;

export class PrizeCounter extends Phaser.Scene {
  private redrawing = false;

  private notice: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('PrizeCounter');
  }

  create(): void {
    // OVER WHOEVER OPENED IT.  Scenes draw in the order they were registered,
    // and this one is registered before some of the rooms that open it -- the
    // condo reception among them -- so launched from there it was drawn
    // underneath the room: the pad went away for it, and nothing appeared.
    this.scene.bringToTop();
    // Phaser reuses the scene instance across restart(), so this has to be
    // cleared here or the first purchase latches it for the rest of the run
    // and the shelf never restocks.
    this.redrawing = false;
    const s = store.get();
    const stock = shelfStock(s);
    const left = stock.filter((p) => !s.prizesOwned.includes(p.id));

    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.88).setOrigin(0, 0).setInteractive();
    this.add.rectangle(GAME_W / 2, GAME_H / 2 - 2, 300, 168, 0x2a1c12).setStrokeStyle(1, PALETTE.gold);
    // the back of the case, and the strip light along the top of it
    this.add.rectangle(GRID_X - 6, 30, COLS * SLOT_W + 12, 3 * SLOT_H + 10, 0x14100c).setOrigin(0, 0);
    this.add.rectangle(GRID_X - 6, 30, COLS * SLOT_W + 12, 2, PALETTE.cream).setOrigin(0, 0).setAlpha(0.6);

    centerText(this, GAME_W / 2, 14, 'PRIZE COUNTER', PALETTE.gold);
    text(this, 12, 14, `${ledger.balance()} TOKENS`, PALETTE.cream);
    text(this, GAME_W - 12, 14, `SHELF ${s.prizeWave + 1}`, PALETTE.ash).setOrigin(1, 0);

    stock.forEach((p, i) => this.paintSlot(p, i, s.prizesOwned.includes(p.id)));

    if (left.length === 0) {
      this.add.rectangle(GAME_W / 2, 96, 220, 34, PALETTE.ink).setDepth(19).setStrokeStyle(1, PALETTE.gold);
      centerText(this, GAME_W / 2, 88, 'SHELF CLEARED', PALETTE.cream).setDepth(20);
      centerText(this, GAME_W / 2, 102, 'NEW STOCK COMING', PALETTE.gold, 16).setDepth(20);
    }

    button(this, GAME_W / 2, 166, 'BACK', () => this.close(), { width: 60, height: 11 });
    this.input.keyboard?.on('keydown-ESC', () => this.close());

    // The restock happens on the way out of the draw, so the player sees the
    // empty shelf they cleared before the new one arrives.
    if (left.length === 0) {
      this.time.delayedCall(1400, () => {
        if (this.redrawing) return;
        store.patch({ prizeWave: store.get().prizeWave + 1 });
        store.flush();
        audio.sfx('ticket_machine');
        this.scene.restart();
      });
    }
  }

  /** One slot: the shelf board, the prize on it, its name and its price. */
  private paintSlot(p: PrizeDef, i: number, owned: boolean): void {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = GRID_X + col * SLOT_W;
    const y = GRID_Y + row * SLOT_H;

    // the board itself, and the shadow it throws on the back of the case
    this.add.rectangle(x + 3, y + SLOT_H - 11, SLOT_W - 6, 3, PALETTE.brown).setOrigin(0, 0);
    this.add.rectangle(x + 3, y + SLOT_H - 8, SLOT_W - 6, 2, 0x000000).setOrigin(0, 0).setAlpha(0.35);

    if (owned) {
      // Gone means gone: the board, and nothing standing on it.  Labelling the
      // gap TAKEN was still showing you the thing you had already bought, one
      // word instead of one toy.
      return;
    }

    drawPrize(this, x + SLOT_W / 2, y + SLOT_H - 12, p);

    const can = ledger.canAfford(p.cost);
    // the name under the shelf's edge
    centerText(this, x + SLOT_W / 2, y + SLOT_H - 2, p.name, can ? PALETTE.cream : PALETTE.ash);
    // the price tag stands on the shelf to the right of the toy: clear of the
    // toy, the name, and the row above
    const price = text(this, x + SLOT_W - 6, y + SLOT_H - 13, `${p.cost}`, can ? PALETTE.gold : PALETTE.steel).setOrigin(1, 1);
    price.setAlpha(can ? 1 : 0.7);

    // The whole slot is the button.  A shelf you have to aim at a 50px REDEEM
    // rectangle to use is a menu wearing a shelf's clothes.
    const zone = this.add
      .zone(x + 2, y, SLOT_W - 4, SLOT_H - 4)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: can });
    zone.on('pointerover', () => price.setTint(PALETTE.white));
    zone.on('pointerout', () => price.setTint(can ? PALETTE.gold : PALETTE.steel));
    zone.on('pointerdown', () => this.redeem(p));
  }

  /** PRD PC-2/PC-3: redemption does not end the game.  The player keeps playing. */
  private redeem(p: PrizeDef): void {
    if (store.get().prizesOwned.includes(p.id)) return;
    // Every prize is carried in a pocket, so it needs a free one: a full set
    // of pockets refuses the purchase and takes nothing.
    if (pocketsFull()) {
      audio.sfx('buzzer');
      this.notice?.destroy();
      // in its own box over the shelf, not printed across the bottom row
      const box = this.add.rectangle(GAME_W / 2, 96, 260, 30, PALETTE.ink).setDepth(29).setStrokeStyle(1, PALETTE.ember);
      const line = centerText(this, GAME_W / 2, 96, FULL_LINE, PALETTE.ember).setMaxWidth(244).setCenterAlign().setDepth(30);
      this.notice = this.add.container(0, 0, [box, line]).setDepth(30);
      return;
    }
    if (!ledger.debit(p.cost, 'prize')) {
      audio.sfx('buzzer');
      return;
    }
    store.patch({ prizesOwned: [...store.get().prizesOwned, p.id] });
    store.flush();
    audio.sfx('cha_ching');
    this.redrawing = true;
    this.scene.restart();
  }

  private close(): void {
    this.scene.get('ArcadeHub')?.events.emit('prize-closed');
    this.scene.stop();
  }
}

/**
 * The prize itself, standing on the shelf: one shaded, outlined thing
 * (art/prizeArt) drawn upwards from `y`, the board it stands on, centred on
 * `x`.  A couple of names get a shape of their own rather than their
 * shelf's generic one (a bunny has long ears; a frog plush is a frog).
 */
export function drawPrize(scene: Phaser.Scene, x: number, y: number, p: PrizeDef, scale = 1, fit?: { w: number; h: number }): Phaser.GameObjects.Graphics {
  return drawThing(scene, prizeShapeOf(p), p.color, x, y, scale, fit);
}

/** What a prize is drawn as. */
export function prizeShapeOf(p: PrizeDef): ThingShape {
  if (/BUNNY/.test(p.name)) return 'bunny';
  if (/FROG PLUSH/.test(p.name)) return 'plushfrog';
  return p.shape ?? 'cube';
}
