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
import { stealthPhase } from '../../game/patrol';
import { store } from '../../core/state';
import { PALETTE } from '../../render/palette';
import { audio } from '../../core/audio';
import { centerText, text } from '../../core/ui';
import { GAME_H, GAME_W } from '../../render/pixelScaler';
import { depthFor } from '../../art/player';
import { COSMETICS, type CosmeticDef } from '../../game/catalog';
import { record } from '../../game/life';
import { FLOOR_TOP, WalkRoom, type Fixture } from '../rooms/WalkRoom';
import { BARBER_LOOK } from '../../ui/portraits';
import { BRASS, INK, WALNUT, paintMirror, paintMirrorShine, paintStuds, paintWalnut } from '../../art/shopFittings';

const BACK_ROW = FLOOR_TOP + 24;
const FRONT_ROW = FLOOR_TOP + 52;
const CHAIR_X = 166;
const BENCH_X = 272;
/** Where the price board starts: under the shop's name, clear of the HUD. */
const WALL_TOP = 48;
/**
 * Where the mirror, the posters and the pole hang: at a standing head's
 * height.  (The player is 25px: everything on the wall used to be hung a
 * metre above their head and drawn half as big again as it should be.)
 */
const EYE_TOP = 58;
/** The white tiles, from here down to the floor, under a walnut rail: a dado, waist high. */
const TILE_TOP = 84;
const MIRROR_W = 26;
const MIRROR_H = 21;

export { BARBER_LOOK };

/** Colours for drawing a head row on the poster. */
const POSTER_COLS: Record<string, number> = { r: 0x3a2a1e, S: 0xe0b090, s: 0xc09070, G: 0x5a4030, g: 0x4a3426 };

export class BarberShop extends WalkRoom {
  private styles: CosmeticDef[] = [];
  private previewing = false;
  private desk: Fixture | null = null;
  private wasDisguised = false;

  /** The book shut: if the look was changed in the chair, a new face. */
  protected afterModal(): void {
    super.afterModal();
    if (store.get().disguised && !this.wasDisguised) {
      this.wasDisguised = true;
      this.time.delayedCall(200, () => this.say('A NEW FACE. THE POLICE WILL WALK RIGHT PAST ME NOW.'));
    }
  }

  constructor() {
    super('BarberShop');
  }

  protected keepsShopHours = true;

  create(): void {
    // (in the hunt, Sharp's lets you in whatever the hour: it is the way out)
    this.keepsShopHours = !stealthPhase();
    super.create();
  }

  protected music(): string {
    return 'room_lounge';
  }

  protected entered(): void {
    record('shop_visit');
    this.previewing = false;
    if (stealthPhase()) this.time.delayedCall(500, () => this.say('"IN HERE, QUICK. SIT IN THE CHAIR -- NOBODY WILL KNOW YOU WHEN I AM DONE."'));
    this.wasDisguised = store.get().disguised;
  }

  protected leave(): void {
    this.exitTo('StreetEast', { atShop: 'barber' });
  }

  protected paintRoom(): void {
    // ONE SCREEN WIDE.  The chair, the mirror and the bench, and the book of
    // cuts opens as a card (scenes2d/Shop, kind 'barber') with every cut and
    // every colour on it -- so nothing is reached by walking.
    this.worldW = GAME_W;
    this.bounds.width = this.worldW - 20;
    this.styles = COSMETICS.filter((c) => c.shop === 'barber' && !c.reward && c.price > 0);
    const W = this.worldW;
    const g = this.add.graphics().setDepth(0);
    // ---- THE WALL: mint plaster in panels, a walnut dado rail, and white
    // glazed tiles under it to the floor -- every line of it laid out below
    // the HUD's own strip, so the shop's name and nothing on the wall sits
    // under the money, the clock or GOALS
    g.fillStyle(0xbfe0d0, 1).fillRect(0, 0, W, FLOOR_TOP);
    for (let x = 0; x < W; x += 24) g.fillStyle(0xcceadc, 1).fillRect(x, 42, 22, TILE_TOP - 46);
    g.fillStyle(0xa8d0c0, 1).fillRect(0, 41, W, 1);
    for (let y = TILE_TOP; y < FLOOR_TOP; y += 6) {
      for (let x = (y / 6) % 2 ? 0 : -5; x < W; x += 10) {
        g.fillStyle(0xf2f2ec, 1).fillRect(x, y, 10, 6);
        g.fillStyle(0xffffff, 1).fillRect(x, y, 9, 1);
        g.fillStyle(0xd0d0c8, 1).fillRect(x + 9, y, 1, 6).fillRect(x, y + 5, 10, 1);
      }
    }
    g.fillStyle(INK, 1).fillRect(0, TILE_TOP - 3, W, 3);
    g.fillStyle(WALNUT.base, 1).fillRect(0, TILE_TOP - 2, W, 2);
    g.fillStyle(WALNUT.lit, 1).fillRect(0, TILE_TOP - 2, W, 1);
    g.fillStyle(0x000000, 0.12).fillRect(0, TILE_TOP, W, 1);
    // ---- THE FLOOR: chequered, but glazed and worn, not a chessboard --
    // the dark squares a soft charcoal, the light ones cream, each with a lit
    // top edge and the grout between them
    for (let y = FLOOR_TOP; y < GAME_H; y += 10) {
      for (let x = 0; x < W; x += 10) {
        const dark = ((x + y) / 10) % 2 === 1;
        g.fillStyle(dark ? 0x34343a : 0xe4e2d8, 1).fillRect(x, y, 10, 10);
        g.fillStyle(dark ? 0x44444c : 0xf4f2ea, 1).fillRect(x, y, 10, 1);
        g.fillStyle(dark ? 0x26262c : 0xc8c6bc, 1).fillRect(x + 9, y, 1, 10);
      }
    }
    // the lamps, hung between the HUD's two corners
    for (const x of [116, 204]) {
      g.fillStyle(0x3a3a3a, 1).fillRect(x, 0, 1, 6);
      g.fillStyle(INK, 1).fillRect(x - 7, 6, 15, 4);
      g.fillStyle(0x2a5a4a, 1).fillRect(x - 6, 6, 13, 2);
      g.fillStyle(0xfff6d8, 1).fillRect(x - 5, 8, 11, 1);
    }
    text(this, W / 2, 24, "SHARP'S", 0x2a5a4a).setOrigin(0.5, 0).setDepth(1);
    text(this, W / 2, 33, 'GENTS AND LADIES BARBER', 0x4a7a6a).setOrigin(0.5, 0).setDepth(1);

    // ---- the pole, by the door: a glass tube in brass caps, the stripes
    // running round it, lit down one side
    const pole = this.add.graphics().setDepth(1);
    const PX = 58;
    const PT = EYE_TOP;
    const PH = 18;
    pole.fillStyle(INK, 1).fillRect(PX - 1, PT, 10, PH);
    pole.fillStyle(0xf8f8f4, 1).fillRect(PX, PT, 8, PH);
    for (let k = -8; k < PH; k += 8) {
      for (let d = 0; d < 8; d++) {
        const y1 = PT + k + d;
        if (y1 >= PT && y1 < PT + PH) pole.fillStyle(0xc83030, 1).fillRect(PX + d, y1, 1, 2);
        const y2 = PT + k + d + 4;
        if (y2 >= PT && y2 < PT + PH - 1) pole.fillStyle(0x3050c8, 1).fillRect(PX + d, y2, 1, 2);
      }
    }
    pole.fillStyle(0xffffff, 0.45).fillRect(PX + 1, PT, 1, PH);
    pole.fillStyle(0x000000, 0.18).fillRect(PX + 6, PT, 2, PH);
    for (const cy of [PT - 3, PT + PH]) {
      pole.fillStyle(INK, 1).fillRect(PX - 2, cy, 12, 4);
      pole.fillStyle(BRASS.base, 1).fillRect(PX - 1, cy + 1, 10, 2);
      pole.fillStyle(BRASS.lit, 1).fillRect(PX - 1, cy + 1, 10, 1);
    }
    pole.fillStyle(BRASS.base, 1).fillCircle(PX + 4, PT - 5, 2);

    // ---- the style posters: three heads from the book, between the pole and
    // the mirror, none of them behind it
    ['hair_pomp', 'hair_afro', 'hair_slick'].forEach((id, i) => {
      const c = this.styles.find((s) => s.id === id);
      if (c) this.poster(76 + i * 20, EYE_TOP, c);
    });

    // ---- the mirror over the chair, and the shelf under it with the bottles
    const m = this.add.graphics().setDepth(1);
    paintMirror(m, CHAIR_X - MIRROR_W / 2, EYE_TOP, MIRROR_W, MIRROR_H, {
      glassTop: 0xeef6f2,
      glassFoot: 0xbcdcd0,
      wallLine: 0xf2f2ec,
      floor: 0x8a8a8e,
    });
    paintMirrorShine(this.add.graphics().setDepth(1.2), CHAIR_X - MIRROR_W / 2, EYE_TOP, MIRROR_W, MIRROR_H);
    const shelfY = EYE_TOP + MIRROR_H + 1;
    paintWalnut(m, CHAIR_X - 19, shelfY, 38, 2);
    for (const [k, col] of [[-17, 0x3a8a5a], [-12, 0xc8a038], [9, 0x3a5ac8], [14, 0xc83a5a]] as const) {
      m.fillStyle(INK, 1).fillRect(CHAIR_X + k - 1, shelfY - 5, 4, 5);
      m.fillStyle(col, 1).fillRect(CHAIR_X + k, shelfY - 4, 2, 4);
      m.fillStyle(0xffffff, 0.4).fillRect(CHAIR_X + k, shelfY - 4, 1, 3);
      m.fillStyle(INK, 1).fillRect(CHAIR_X + k, shelfY - 6, 2, 1);
    }

    // ---- the price board: a walnut-framed chalkboard, clear of GOALS and
    // inside the shop's own wall
    const b = this.add.graphics().setDepth(1);
    const BX = 250;
    const BW = 100;
    paintWalnut(b, BX - BW / 2, WALL_TOP - 2, BW, 33);
    b.fillStyle(INK, 1).fillRect(BX - BW / 2 + 2, WALL_TOP, BW - 4, 29);
    b.fillStyle(0x24302a, 1).fillRect(BX - BW / 2 + 3, WALL_TOP + 1, BW - 6, 27);
    b.fillStyle(0xffffff, 0.04).fillRect(BX - BW / 2 + 3, WALL_TOP + 1, BW - 6, 9);
    paintStuds(b, BX - BW / 2, WALL_TOP - 2, BW, 33);
    centerText(this, BX, WALL_TOP + 7, 'CUTS FROM $6', 0xf0e8d0).setDepth(2);
    centerText(this, BX, WALL_TOP + 15, 'COLOURS FROM $5', 0xf0e8d0).setDepth(2);
    centerText(this, BX, WALL_TOP + 24, 'SIT IN THE CHAIR', BRASS.base).setDepth(2);

    // ---- the chair: red leather, buttoned, on a chrome pedestal -- lit on
    // the left like everything else in the shop, with a headrest, chrome
    // arms and a footrest
    const ch = this.add.graphics().setDepth(depthFor(BACK_ROW) - 0.0002);
    const y = BACK_ROW;
    const RED = { base: 0xa82a2a, lit: 0xd04848, shade: 0x781c20 };
    const CHROME = { base: 0xb8b8c0, lit: 0xeeeef4, shade: 0x7a7a84 };
    // (sized to the player: the seat at their knee, the headrest at the
    // back of a seated head -- it was drawn taller than a standing man)
    ch.fillStyle(0x000000, 0.2).fillEllipse(CHAIR_X + 1, y + 1, 20, 5);
    ch.fillStyle(INK, 1).fillEllipse(CHAIR_X, y - 1, 17, 5);
    ch.fillStyle(CHROME.base, 1).fillEllipse(CHAIR_X, y - 1, 15, 3);
    ch.fillStyle(CHROME.lit, 1).fillRect(CHAIR_X - 5, y - 2, 6, 1);
    ch.fillStyle(INK, 1).fillRect(CHAIR_X - 2, y - 8, 5, 7);
    ch.fillStyle(CHROME.base, 1).fillRect(CHAIR_X - 1, y - 7, 3, 6);
    ch.fillStyle(CHROME.lit, 1).fillRect(CHAIR_X - 1, y - 7, 1, 6);
    ch.fillStyle(CHROME.shade, 1).fillRect(CHAIR_X + 1, y - 7, 1, 6);
    // the footrest
    ch.fillStyle(INK, 1).fillRect(CHAIR_X - 7, y - 4, 14, 2);
    ch.fillStyle(CHROME.base, 1).fillRect(CHAIR_X - 6, y - 4, 12, 1);
    // the back and headrest
    ch.fillStyle(INK, 1).fillRect(CHAIR_X - 8, y - 20, 17, 11);
    ch.fillStyle(RED.base, 1).fillRect(CHAIR_X - 7, y - 19, 15, 9);
    ch.fillStyle(RED.lit, 1).fillRect(CHAIR_X - 7, y - 19, 1, 9).fillRect(CHAIR_X - 7, y - 19, 15, 1);
    ch.fillStyle(RED.shade, 1).fillRect(CHAIR_X + 7, y - 19, 1, 9);
    for (const [bx, by] of [[-3, -16], [3, -16], [0, -13], [-3, -11], [3, -11]]) ch.fillStyle(RED.shade, 1).fillRect(CHAIR_X + bx, y + by, 1, 1);
    ch.fillStyle(INK, 1).fillRect(CHAIR_X - 4, y - 24, 9, 5);
    ch.fillStyle(RED.base, 1).fillRect(CHAIR_X - 3, y - 23, 7, 3);
    ch.fillStyle(RED.lit, 1).fillRect(CHAIR_X - 3, y - 23, 7, 1);
    ch.fillStyle(CHROME.base, 1).fillRect(CHAIR_X, y - 20, 1, 1);
    // the seat cushion, at knee height, with its lit front edge
    ch.fillStyle(INK, 1).fillRect(CHAIR_X - 9, y - 11, 19, 5);
    ch.fillStyle(RED.base, 1).fillRect(CHAIR_X - 8, y - 10, 17, 3);
    ch.fillStyle(RED.lit, 1).fillRect(CHAIR_X - 8, y - 10, 17, 1);
    ch.fillStyle(RED.shade, 1).fillRect(CHAIR_X - 8, y - 8, 17, 1);
    // the chrome arms
    for (const ax of [CHAIR_X - 11, CHAIR_X + 9]) {
      ch.fillStyle(INK, 1).fillRect(ax, y - 15, 3, 9);
      ch.fillStyle(CHROME.base, 1).fillRect(ax + 1, y - 14, 1, 7);
      ch.fillStyle(INK, 1).fillRect(ax - 1, y - 16, 5, 2);
      ch.fillStyle(RED.base, 1).fillRect(ax, y - 16, 3, 1);
    }

    // the barber, at his desk just inside the doors
    this.desk = this.paintCounter({
      look: BARBER_LOOK,
      top: 0xf0f0ea,
      front: 0x24302a,
      trim: BRASS.base,
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

    // ---- the waiting bench: walnut, with a green leather cushion and
    // turned legs; and the pot plant, inside the right-hand wall
    const bn = this.add.graphics().setDepth(depthFor(FRONT_ROW) - 0.0002);
    // (a bench for two, its cushion at the height a sitting player's knee is)
    bn.fillStyle(0x000000, 0.2).fillRect(BENCH_X - 16, FRONT_ROW, 34, 2);
    for (const lx of [BENCH_X - 15, BENCH_X + 12]) {
      bn.fillStyle(INK, 1).fillRect(lx - 1, FRONT_ROW - 5, 5, 5);
      bn.fillStyle(WALNUT.base, 1).fillRect(lx, FRONT_ROW - 4, 3, 4);
      bn.fillStyle(WALNUT.lit, 1).fillRect(lx, FRONT_ROW - 4, 1, 4);
    }
    paintWalnut(bn, BENCH_X - 17, FRONT_ROW - 7, 34, 2);
    bn.fillStyle(INK, 1).fillRect(BENCH_X - 16, FRONT_ROW - 10, 32, 3);
    bn.fillStyle(0x2a5a4a, 1).fillRect(BENCH_X - 15, FRONT_ROW - 9, 30, 2);
    bn.fillStyle(0x3e7a64, 1).fillRect(BENCH_X - 15, FRONT_ROW - 9, 30, 1);
    for (let k = BENCH_X - 10; k < BENCH_X + 14; k += 8) bn.fillStyle(0x1e4438, 1).fillRect(k, FRONT_ROW - 8, 1, 1);
    const PLX = 306;
    const pl = this.add.graphics().setDepth(depthFor(BACK_ROW));
    pl.fillStyle(0x000000, 0.2).fillRect(PLX - 5, BACK_ROW, 11, 2);
    pl.fillStyle(INK, 1).fillRect(PLX - 5, BACK_ROW - 8, 11, 8);
    pl.fillStyle(0xa85a32, 1).fillRect(PLX - 4, BACK_ROW - 7, 9, 7);
    pl.fillStyle(0xc87a4a, 1).fillRect(PLX - 4, BACK_ROW - 7, 2, 7);
    pl.fillStyle(0x7a3a1e, 1).fillRect(PLX - 5, BACK_ROW - 8, 11, 2);
    pl.fillStyle(INK, 1).fillCircle(PLX, BACK_ROW - 14, 7);
    pl.fillStyle(0x3a8a4a, 1).fillCircle(PLX, BACK_ROW - 14, 6);
    pl.fillStyle(0x2a6a38, 1).fillCircle(PLX + 2, BACK_ROW - 12, 3);
    pl.fillStyle(0x5aa85f, 1).fillCircle(PLX - 2, BACK_ROW - 16, 2);
    // (the tiles get only a little: they are glazed)
    this.surfaces(0xbfe0d0, 0xa8a8a0, 0.012);
  }

  /** A head from the style book, life size, in a frame the size of a poster. */
  private poster(x: number, y: number, c: CosmeticDef): void {
    const g = this.add.graphics().setDepth(1);
    paintWalnut(g, x - 2, y - 2, 18, 22);
    g.fillStyle(INK, 1).fillRect(x - 1, y - 1, 16, 20);
    g.fillStyle(0xf8f0e0, 1).fillRect(x, y, 14, 18);
    const rows = c.head ?? [];
    // (the head is twelve wide: centred on the paper)
    rows.forEach((row, ry) =>
      [...row].forEach((ch, rx) => {
        const col = POSTER_COLS[ch];
        const py = y + 1 + ry;
        if (col !== undefined && py < y + 14) g.fillStyle(col, 1).fillRect(x + 1 + rx, py, 1, 1);
      }),
    );
    g.fillStyle(0x2a5a4a, 1).fillRect(x, y + 14, 14, 4);
    g.fillStyle(0x3e7a64, 1).fillRect(x, y + 14, 14, 1);
  }

  protected fixtures(): Fixture[] {
    return [
      {
        x: CHAIR_X,
        y: BACK_ROW,
        w: 20,
        depth: 5,
        label: () => (this.player.seated ? '[E] THE STYLE BOOK' : '[E] SIT IN THE CHAIR'),
        use: () => this.sitDown(),
        hit: { x: CHAIR_X - 12, y: BACK_ROW - 25, w: 24, h: 27 },
      },
      ...(this.desk ? [this.desk] : []),
      {
        x: BENCH_X,
        y: FRONT_ROW,
        w: 34,
        depth: 6,
        label: () => '[E] SIT AND WAIT',
        use: () => {
          this.sitOn(BENCH_X, FRONT_ROW + 1, 'chair', 1);
          this.say('YOU SIT AND WAIT. MOVE TO GET UP.');
        },
      },
    ];
  }

  /**
   * In the chair, and the book open on the arm of it: every cut and every
   * colour on one card (scenes2d/Shop, kind 'barber'), with you in the
   * mirror wearing whichever is picked.  It used to be one cut a page with
   * arrows to turn them, which is a lot of tapping for eleven haircuts.
   */
  private sitDown(): void {
    if (this.busy()) return;
    if (!this.player.seated) {
      this.sitOn(CHAIR_X, BACK_ROW + 1, 'chair', 1);
      audio.sfx('door_open', 0.2);
    }
    this.locked = true;
    this.previewing = false;
    this.scene.launch('Shop', { kind: 'barber', from: 'BarberShop' });
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
