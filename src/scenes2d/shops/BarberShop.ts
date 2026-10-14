/**
 * ---- SHARP'S, inside.  Black and white tiles, a striped pole, the style
 * posters on the wall, one big red chair in front of the mirror, and the
 * barber (a man who looks after his moustache) at his desk just inside the
 * doors.  Sit in the chair
 * and he shows you the book: every cut and colour, tried on you in the
 * mirror as you go through them -- BUY & APPLY the one you want, or APPLY one
 * you have had before.  The bench by the window is for waiting on.
 */

import Phaser from 'phaser';
import { PALETTE } from '../../render/palette';
import { audio } from '../../core/audio';
import { store } from '../../core/state';
import { button, centerText, text } from '../../core/ui';
import { GAME_H } from '../../render/pixelScaler';
import { COLS, depthFor, type Look } from '../../art/player';
import { COSMETICS, lookFor, type CosmeticDef } from '../../game/catalog';
import { buyCosmetic, record, wear } from '../../game/life';
import { FLOOR_TOP, WalkRoom, type Fixture } from '../rooms/WalkRoom';
import { BARBER_LOOK } from '../../ui/portraits';

const BACK_ROW = FLOOR_TOP + 24;
const FRONT_ROW = FLOOR_TOP + 52;
const CHAIR_X = 180;
const BENCH_X = 296;

export { BARBER_LOOK };

/** Colours for drawing a head row on the poster. */
const POSTER_COLS: Record<string, number> = { r: 0x3a2a1e, S: 0xe0b090, s: 0xc09070, G: 0x5a4030, g: 0x4a3426 };

export class BarberShop extends WalkRoom {
  private styles: CosmeticDef[] = [];
  private pick = 0;
  private previewing = false;
  private desk: Fixture | null = null;

  constructor() {
    super('BarberShop');
  }

  protected keepsShopHours = true;

  protected music(): string {
    return 'room_lounge';
  }

  protected entered(): void {
    record('shop_visit');
    this.previewing = false;
  }

  protected leave(): void {
    this.exitTo('StreetEast', { atShop: 'barber' });
  }

  protected paintRoom(): void {
    this.worldW = 360;
    this.bounds.width = this.worldW - 20;
    this.styles = COSMETICS.filter((c) => c.shop === 'barber' && !c.reward && c.price > 0);
    const W = this.worldW;
    const g = this.add.graphics().setDepth(0);
    // the wall: mint plaster over white tiles; the floor, chequered
    g.fillStyle(0xbfe0d0, 1).fillRect(0, 0, W, FLOOR_TOP);
    g.fillStyle(0xf0f0ea, 1).fillRect(0, FLOOR_TOP - 30, W, 30);
    for (let x = 0; x < W; x += 10) g.fillStyle(0xd8d8d0, 1).fillRect(x, FLOOR_TOP - 30, 1, 30);
    for (let y = FLOOR_TOP - 30; y < FLOOR_TOP; y += 10) g.fillStyle(0xd8d8d0, 1).fillRect(0, y, W, 1);
    g.fillStyle(0x2a5a4a, 1).fillRect(0, FLOOR_TOP - 32, W, 2);
    for (let y = FLOOR_TOP; y < GAME_H; y += 10) {
      for (let x = 0; x < W; x += 10) {
        g.fillStyle(((x + y) / 10) % 2 ? 0x1e1e22 : 0xe8e8e0, 1).fillRect(x, y, 10, 10);
      }
    }
    for (let x = 50; x < W; x += 90) {
      g.fillStyle(0x3a3a3a, 1).fillRect(x, 0, 1, 6);
      g.fillStyle(0xfff6d8, 1).fillRect(x - 6, 6, 13, 3);
    }
    text(this, W / 2, 10, "SHARP'S", 0x2a5a4a).setOrigin(0.5, 0).setDepth(1);
    text(this, W / 2, 20, 'GENTLEMEN AND LADIES BARBER', 0x4a7a6a).setOrigin(0.5, 0).setDepth(1);

    // the pole, by the door
    const pole = this.add.graphics().setDepth(1);
    pole.fillStyle(0x14100c, 1).fillRect(59, 30, 10, 42);
    pole.fillStyle(0xffffff, 1).fillRect(60, 31, 8, 40);
    for (let k = 0; k < 40; k += 8) {
      pole.fillStyle(0xc83030, 1).fillRect(60, 31 + k, 8, 2);
      pole.fillStyle(0x3050c8, 1).fillRect(60, 35 + k, 8, 2);
    }
    pole.fillStyle(0xd8a838, 1).fillRect(58, 28, 12, 3).fillRect(58, 71, 12, 3);

    // the style posters: four heads from the book
    ['hair_pomp', 'hair_afro', 'hair_slick', 'hair_bun'].forEach((id, i) => {
      const c = this.styles.find((s) => s.id === id);
      if (c) this.poster(76 + i * 22, 34, c);
    });

    // the mirror over the chair, the shelf with the bottles
    const m = this.add.graphics().setDepth(1);
    m.fillStyle(0x6a4a2a, 1).fillRect(CHAIR_X - 18, 28, 36, 38);
    m.fillStyle(0xcfe4ee, 1).fillRect(CHAIR_X - 16, 30, 32, 34);
    m.fillStyle(0xffffff, 0.5).fillRect(CHAIR_X - 12, 33, 3, 26);
    m.fillStyle(0x6a4a2a, 1).fillRect(CHAIR_X - 22, 66, 44, 3);
    for (const [k, col] of [[-16, 0x3a8a5a], [-10, 0xc8a038], [8, 0x3a5ac8], [14, 0xc83a5a]] as const) {
      m.fillStyle(0x14100c, 1).fillRect(CHAIR_X + k - 1, 59, 5, 7);
      m.fillStyle(col, 1).fillRect(CHAIR_X + k, 60, 3, 6);
    }

    // the price board
    const b = this.add.graphics().setDepth(1);
    b.fillStyle(0x14100c, 1).fillRect(244, 28, 104, 40);
    b.fillStyle(0x24302a, 1).fillRect(245, 29, 102, 38);
    centerText(this, 296, 35, 'CUTS FROM $6', 0xf0e8d0).setDepth(2);
    centerText(this, 296, 45, 'COLOURS FROM $5', 0xf0e8d0).setDepth(2);
    centerText(this, 296, 57, 'SIT IN THE CHAIR', 0xd8a838).setDepth(2);

    // the chair: a red leather seat on a chrome pedestal
    const ch = this.add.graphics().setDepth(depthFor(BACK_ROW) - 0.0002);
    const y = BACK_ROW;
    ch.fillStyle(0x14100c, 1).fillEllipse(CHAIR_X, y, 22, 6);
    ch.fillStyle(0xb8b8c0, 1).fillEllipse(CHAIR_X, y - 1, 20, 4);
    ch.fillStyle(0x14100c, 1).fillRect(CHAIR_X - 2, y - 8, 5, 8);
    ch.fillStyle(0xd8d8e0, 1).fillRect(CHAIR_X - 1, y - 7, 3, 6);
    ch.fillStyle(0x14100c, 1).fillRect(CHAIR_X - 10, y - 30, 21, 24);
    ch.fillStyle(0xa82a2a, 1).fillRect(CHAIR_X - 9, y - 29, 19, 13);
    ch.fillStyle(0xc83a3a, 1).fillRect(CHAIR_X - 9, y - 15, 19, 7);
    ch.fillStyle(0x14100c, 1).fillRect(CHAIR_X - 12, y - 17, 3, 9).fillRect(CHAIR_X + 10, y - 17, 3, 9);
    ch.fillStyle(0xb8b8c0, 1).fillRect(CHAIR_X - 6, y - 4, 13, 2);

    // the barber, at his desk just inside the doors
    this.desk = this.paintCounter({
      look: BARBER_LOOK,
      top: 0x2a5a4a,
      front: 0xf0f0ea,
      trim: 0x14100c,
      who: 'barber',
      line: '"TAKE A SEAT IN THE CHAIR, FRIEND. WE WILL SMARTEN YOU UP."',
      dress: (g, x, top) => {
        // the appointments book, the scissors, a jar of combs
        g.fillStyle(0x14100c, 1).fillRect(x - 18, top - 2, 12, 2);
        g.fillStyle(0xf8f0e0, 1).fillRect(x - 17, top - 2, 10, 1);
        g.fillStyle(0xb8b8c0, 1).fillRect(x - 2, top - 2, 6, 1).fillRect(x - 2, top - 1, 1, 1).fillRect(x + 3, top - 1, 1, 1);
        g.fillStyle(0x14100c, 1).fillRect(x + 10, top - 7, 6, 7);
        g.fillStyle(0x7ac8d8, 1).fillRect(x + 11, top - 6, 4, 6);
        g.fillStyle(0x14100c, 1).fillRect(x + 12, top - 9, 1, 3).fillRect(x + 14, top - 9, 1, 3);
      },
    });

    // the waiting bench, and a pot plant
    const bn = this.add.graphics().setDepth(depthFor(FRONT_ROW) - 0.0002);
    bn.fillStyle(0x14100c, 1).fillRect(BENCH_X - 22, FRONT_ROW - 12, 44, 6);
    bn.fillStyle(0x8a5a32, 1).fillRect(BENCH_X - 21, FRONT_ROW - 11, 42, 4);
    bn.fillStyle(0x14100c, 1).fillRect(BENCH_X - 20, FRONT_ROW - 6, 3, 6).fillRect(BENCH_X + 17, FRONT_ROW - 6, 3, 6);
    const pl = this.add.graphics().setDepth(depthFor(BACK_ROW));
    pl.fillStyle(0x14100c, 1).fillRect(334, BACK_ROW - 10, 12, 10);
    pl.fillStyle(0xa85a32, 1).fillRect(335, BACK_ROW - 9, 10, 9);
    pl.fillStyle(0x3a8a4a, 1).fillCircle(340, BACK_ROW - 16, 7);
    pl.fillStyle(0x5aa85f, 1).fillCircle(337, BACK_ROW - 18, 3);
    // (the tiles get only a little: they are glazed)
    this.surfaces(0xbfe0d0, 0xa8a8a0, 0.012);
  }

  /** A head from the style book, twice size, in a frame. */
  private poster(x: number, y: number, c: CosmeticDef): void {
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x14100c, 1).fillRect(x - 1, y - 1, 22, 28);
    g.fillStyle(0xf8f0e0, 1).fillRect(x, y, 20, 26);
    const rows = c.head ?? [];
    rows.forEach((row, ry) =>
      [...row].forEach((ch, rx) => {
        const col = POSTER_COLS[ch];
        if (col !== undefined) g.fillStyle(col, 1).fillRect(x - 2 + rx * 2, y + 2 + ry * 2, 2, 2);
      }),
    );
    g.fillStyle(0x2a5a4a, 1).fillRect(x, y + 22, 20, 4);
  }

  protected fixtures(): Fixture[] {
    return [
      {
        x: CHAIR_X,
        y: BACK_ROW,
        w: 22,
        depth: 6,
        label: () => (this.player.seated ? '[E] THE STYLE BOOK' : '[E] SIT IN THE CHAIR'),
        use: () => this.sitDown(),
        hit: { x: CHAIR_X - 12, y: BACK_ROW - 32, w: 24, h: 34 },
      },
      ...(this.desk ? [this.desk] : []),
      {
        x: BENCH_X,
        y: FRONT_ROW,
        w: 44,
        depth: 6,
        label: () => '[E] SIT AND WAIT',
        use: () => {
          this.sitOn(BENCH_X, FRONT_ROW + 1, 'chair', 1);
          this.say('YOU SIT AND WAIT. MOVE TO GET UP.');
        },
      },
    ];
  }

  private sitDown(): void {
    if (!this.player.seated) {
      this.sitOn(CHAIR_X, BACK_ROW + 1, 'chair', 1);
      audio.sfx('door_open', 0.2);
    }
    // start the book on whatever you have now, if it is in there
    const outfit = store.get().life.outfit as Record<string, string>;
    const at = this.styles.findIndex((s) => s.id === outfit.hair);
    this.browse(at >= 0 ? at : 0);
  }

  /** The style book, open at `i`, and you in the mirror wearing it. */
  private browse(i: number): void {
    const n = this.styles.length;
    this.pick = ((i % n) + n) % n;
    const c = this.styles[this.pick];
    const l = store.get().life;
    const owned = l.wardrobe.includes(c.id);
    const on = (l.outfit as Record<string, string>)[c.slot] === c.id;
    const look = this.lookWith(c);
    // (< and > are not in this row: they go either side of the head in the
    // panel, clear of the corner a phone keeps its own arrows in -- down here
    // the d-pad sat on top of them and took every tap meant for the book)
    const buttons = [
      owned
        ? { label: on ? 'HAVE IT' : 'APPLY', fn: () => this.apply(c, false), disabled: on, w: 100 }
        : { label: `BUY & APPLY $${c.price}`, fn: () => this.apply(c, true), disabled: store.get().cash < c.price, w: 100 },
    ];
    this.previewing = false;
    this.openPanel(
      `${c.name}  ${this.pick + 1}/${n}`,
      [
        c.slot === 'dye' ? 'A NEW COLOUR' : 'A NEW CUT',
        owned ? (on ? 'YOU HAVE IT NOW' : 'HAD IT BEFORE - FREE') : `$${c.price}`,
        'SEE YOURSELF IN THE CHAIR',
        `YOU HAVE $${store.get().cash}`,
      ],
      buttons,
      (box, x, y) => {
        box.add(this.portrait(look, x, y - 30));
        // the page turners, under the head: the preview's anchor is the
        // middle of its box, so they sit either side of it and above the row
        box.add(button(this, x - 22, y + 16, '<', () => this.browse(this.pick - 1), { width: 20, height: 12 }));
        box.add(button(this, x + 22, y + 16, '>', () => this.browse(this.pick + 1), { width: 20, height: 12 }));
      },
    );
    // the panel keeps the bottom of the head in its box; the chair shows it too
    this.previewing = true;
    this.refreshPlayer(look);
  }

  /** The head alone, four times size: the cut is what you are looking at. */
  private portrait(look: Look, cx: number, cy: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const rows = look.head ?? [];
    const k = 4;
    const x0 = cx - 6 * k;
    const y0 = cy - (rows.length * k) / 2;
    const col = (ch: string) => look.cols?.[ch] ?? COLS[ch] ?? 0xff00ff;
    // the ink outline first, then the pixels over it
    for (const pass of [0, 1])
      rows.forEach((row, ry) =>
        [...row].forEach((ch, rx) => {
          if (ch === '.') return;
          if (pass === 0) g.fillStyle(0x14100c, 1).fillRect(x0 + rx * k - 2, y0 + ry * k - 2, k + 4, k + 4);
          else g.fillStyle(col(ch), 1).fillRect(x0 + rx * k, y0 + ry * k, k, k);
        }),
      );
    // the eyes (the rig draws them as their own part)
    g.fillStyle(col('E'), 1).fillRect(x0 + 5 * k, y0 + 4 * k, k, k).fillRect(x0 + 7 * k, y0 + 4 * k, k, k);
    return g;
  }

  /** What you have on, with `c` instead of your hair (or its colour), hat off. */
  private lookWith(c: CosmeticDef): Look {
    const outfit = { ...(store.get().life.outfit as Record<string, string>), [c.slot]: c.id, hat: 'cos_no_hat' };
    return lookFor(outfit);
  }

  private apply(c: CosmeticDef, buy: boolean): void {
    if (buy) {
      const r = buyCosmetic(c.id);
      if (!r.ok) {
        audio.sfx('buzzer', 0.6);
        this.say(r.msg);
        return;
      }
      audio.sfx('cha_ching', 0.6);
    }
    wear(c.id);
    // (a hat would hide the new cut)
    wear('cos_no_hat');
    this.closePanel();
    this.say(`SNIP SNIP... ${c.name}. LOOKING SHARP.`);
  }

  /** Closing the book puts you back as you are (which may be newly cut). */
  protected closePanel(): void {
    const was = !!this.panel;
    super.closePanel();
    if (was && this.previewing) {
      this.previewing = false;
      this.refreshPlayer();
    }
  }
}

void Phaser;
void PALETTE;
