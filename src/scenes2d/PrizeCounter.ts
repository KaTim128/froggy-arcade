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
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { ledger } from '../core/ledger';
import { prizesForWave, type PrizeDef } from '../game/content';
import { button, centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';

/** Three across, three down, and the slot is what a prize stands in. */
const COLS = 3;
const SLOT_W = 84;
const SLOT_H = 42;
const GRID_X = Math.round((GAME_W - COLS * SLOT_W) / 2);
const GRID_Y = 34;

export class PrizeCounter extends Phaser.Scene {
  private redrawing = false;

  constructor() {
    super('PrizeCounter');
  }

  create(): void {
    // Phaser reuses the scene instance across restart(), so this has to be
    // cleared here or the first purchase latches it for the rest of the run
    // and the shelf never restocks.
    this.redrawing = false;
    const s = store.get();
    const stock = prizesForWave(s.prizeWave);
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

    button(this, GAME_W / 2, 170, 'BACK', () => this.close(), { width: 60, height: 12 });
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
    this.add.rectangle(x + 3, y + SLOT_H - 9, SLOT_W - 6, 3, PALETTE.brown).setOrigin(0, 0);
    this.add.rectangle(x + 3, y + SLOT_H - 6, SLOT_W - 6, 2, 0x000000).setOrigin(0, 0).setAlpha(0.35);

    if (owned) {
      // An empty space on the shelf, and it reads as one.
      centerText(this, x + SLOT_W / 2, y + 18, 'TAKEN', PALETTE.steel).setAlpha(0.6);
      return;
    }

    drawPrize(this, x + SLOT_W / 2, y + SLOT_H - 10, p);

    const can = ledger.canAfford(p.cost);
    centerText(this, x + SLOT_W / 2, y + SLOT_H - 5, p.name, can ? PALETTE.cream : PALETTE.ash);
    const price = centerText(this, x + SLOT_W / 2, y + 2, `${p.cost}`, can ? PALETTE.gold : PALETTE.steel);
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
    if (!ledger.debit(p.cost, 'prize')) {
      audio.sfx('buzzer');
      return;
    }
    store.patch({ prizesOwned: [...store.get().prizesOwned, p.id] });
    store.flush();
    audio.sfx('ticket_machine');
    this.redrawing = true;
    this.scene.restart();
  }

  private close(): void {
    this.scene.get('ArcadeHub')?.events.emit('prize-closed');
    this.scene.stop();
  }
}

/**
 * The prize itself, standing on the shelf: a handful of rectangles that read
 * as the thing at 320x180.  `x` is the middle of the slot and `y` is the board
 * it stands on, so everything is drawn upwards from the shelf.
 */
export function drawPrize(scene: Phaser.Scene, x: number, y: number, p: PrizeDef, scale = 1): void {
  const put = (dx: number, dy: number, w: number, h: number, col: number = p.color) =>
    scene.add
      .rectangle(x + dx * scale, y + dy * scale, w * scale, h * scale, col)
      .setOrigin(0.5, 1);
  const dot = (dx: number, dy: number, r: number, col: number = p.color) =>
    scene.add.circle(x + dx * scale, y + dy * scale, r * scale, col);

  switch (p.shape) {
    case 'ring':
      dot(0, -8, 5);
      dot(0, -8, 2.5, 0x14100c);
      put(0, -12, 2, 5, PALETTE.steel);
      break;
    case 'sheet':
      put(0, 0, 14, 16);
      put(0, -2, 10, 3, PALETTE.cream);
      put(0, -8, 10, 3, PALETTE.cream);
      break;
    case 'duck':
      put(0, 0, 14, 8);
      dot(4, -10, 4);
      put(8, -10, 4, 2, PALETTE.ember);
      break;
    case 'bear':
      put(0, 0, 12, 10);
      dot(0, -11, 5);
      dot(-4, -15, 2);
      dot(4, -15, 2);
      break;
    case 'lamp':
      put(0, 0, 10, 3, PALETTE.steel);
      put(0, -3, 7, 14);
      dot(0, -18, 4, PALETTE.cream);
      break;
    case 'board':
      put(0, -3, 20, 4);
      dot(-6, -1, 2, PALETTE.steel);
      dot(6, -1, 2, PALETTE.steel);
      break;
    case 'headset':
      put(-6, 0, 5, 10);
      put(6, 0, 5, 10);
      put(0, -10, 14, 3);
      break;
    case 'guitar':
      put(-1, 0, 11, 11);
      put(4, -9, 3, 12);
      put(4, -20, 5, 3, PALETTE.bone);
      break;
    case 'console':
      put(0, 0, 18, 12);
      put(0, -4, 12, 2, PALETTE.ink);
      dot(6, -9, 1.5, PALETTE.tealLight);
      break;
    case 'robot':
      put(0, 0, 12, 10);
      put(0, -10, 9, 8);
      dot(-2, -15, 1.5, PALETTE.cream);
      dot(2, -15, 1.5, PALETTE.cream);
      put(0, -18, 1, 3, PALETTE.steel);
      break;
    case 'ball':
      dot(0, -7, 7);
      dot(-2, -9, 2, PALETTE.cream);
      break;
    case 'car':
      put(0, -3, 18, 6);
      put(0, -9, 10, 6);
      dot(-6, -1, 2.5, PALETTE.ink);
      dot(6, -1, 2.5, PALETTE.ink);
      break;
    case 'rocket':
      put(0, 0, 8, 14);
      put(0, -14, 4, 5, PALETTE.blood);
      put(-6, 0, 3, 5, PALETTE.steel);
      put(6, 0, 3, 5, PALETTE.steel);
      break;
    case 'cube':
    default:
      put(0, 0, 14, 14);
      put(0, -3, 14, 3, PALETTE.cream);
      put(0, 0, 3, 14, PALETTE.cream);
      break;
  }
}
