/**
 * ---- THREADS, inside.  Clothes you can see before you buy them: the tops
 * on mannequins along the back, trousers folded on a table, shoes on a low
 * shelf, scarves on hooks on the wall, hats on a stand.  Walk up to one and
 * [E]: you, wearing it, and BUY & WEAR -- or WEAR, if it is already yours.
 * The fitting room in the middle of the shop changes you into anything you
 * own; the mirror shows you what you look like now.  The assistant is at the
 * till just inside the doors.
 */

import Phaser from 'phaser';
import { MIRROR_GLASS, paintMirror, paintMirrorShine, paintPlate } from '../../art/shopFittings';
import { MirrorTwin } from '../../ui/mirrorTwin';
import { PALETTE } from '../../render/palette';
import { store } from '../../core/state';
import { text } from '../../core/ui';
import { GAME_H, GAME_W } from '../../render/pixelScaler';
import { Player, depthFor, type Look } from '../../art/player';
import { COSMETICS, CROWNS, cosmeticById, lookFor, type CosmeticDef } from '../../game/catalog';
import { record } from '../../game/life';
import { COUNTER_RIGHT, WalkRoom, type Fixture } from '../rooms/WalkRoom';
import { ASSISTANT_LOOK } from '../../ui/portraits';

const FLOOR = 100;
const BACK_ROW = FLOOR + 22;
const FRONT_ROW = FLOOR + 52;
/**
 * ---- ONE SCREEN WIDE.
 *
 * Threads used to be four hundred and sixty pixels of rails, with a price
 * label on every single garment in the catalogue: buying socks meant walking
 * the length of it.  The shop is now exactly the screen -- a couple of
 * dressed mannequins, the hats, the mirror and the fitting room -- and the
 * whole range is bought from THE RAILS CARD at the till (scenes2d/Shop, kind
 * 'clothes'), which fits on one screen on any phone.
 */
const SHOP_W = GAME_W;
const FIT_X = 206;
const FIT_W = 26;
/** The booth's top: a cubicle a little taller than a person, not a wardrobe to the ceiling. */
const FIT_TOP = 84;
const MIRROR_X = 258;
/** The mirror on the wall: its frame, top to bottom (shorter than it was). */
const MIRROR = { w: 24, top: 46, h: 40 };
/** The scarf hooks: at a standing shoulder (the wall's foot is at 100, a person 25 tall). */
const SCARF_Y = 70;

/** A bald, pale shop dummy, wearing `top`. */
function mannequin(top: CosmeticDef): Look {
  const skin = { S: 0xe8e2d8, s: 0xc8c2b8, G: 0xe8e2d8, g: 0xc8c2b8, E: 0xc8c2b8, r: 0xe8e2d8 };
  return {
    head: ['............', '............', '...SSSSSS...', '..SSSSSSSS..', '..sSSSSSSs..', '...SSSSSs...', '...SSSSSs...', '....SSSs....', '.....ss.....'],
    cols: { ...skin, ...top.cols, w: top.cols.C ?? 0x888888, J: 0xb8b2a8, j: 0xa8a298, K: 0x6a6a6a, W: 0x5a5a5a, T: 0x6a6a6a },
  };
}

export class ClothesStore extends WalkRoom {
  private spots: Array<{ c: CosmeticDef; x: number; y: number; depth: number; wall?: boolean }> = [];
  private counter: Fixture | null = null;

  constructor() {
    super('ClothesStore');
  }

  protected keepsShopHours = true;

  protected music(): string {
    return 'room_lounge';
  }

  protected entered(): void {
    record('shop_visit');
  }

  protected leave(): void {
    this.exitTo('StreetEast', { atShop: 'clothes' });
  }

  private forSale(slot: CosmeticDef['slot']): CosmeticDef[] {
    return COSMETICS.filter((c) => c.shop === 'clothes' && c.slot === slot && !c.reward && c.price > 0);
  }

  protected paintRoom(): void {
    this.worldW = SHOP_W;
    this.bounds.width = this.worldW - 20;
    this.spots = [];
    this.racks = [];
    const W = this.worldW;
    const g = this.add.graphics().setDepth(0);
    // the wall: pink plaster and white panelling; a polished concrete floor
    g.fillStyle(0xe8c8d8, 1).fillRect(0, 0, W, FLOOR);
    for (let x = 0; x < W; x += 24) g.fillStyle(0xf0d8e4, 1).fillRect(x, 40, 22, FLOOR - 46);
    g.fillStyle(0xffffff, 1).fillRect(0, FLOOR - 6, W, 6);
    for (let y = FLOOR; y < GAME_H; y += 8) {
      g.fillStyle(y % 16 === 0 ? 0xc8c0c4 : 0xbeb6ba, 1).fillRect(0, y, W, 8);
      g.fillStyle(0xaaa2a6, 1).fillRect(0, y, W, 1);
    }
    for (let x = 30; x < W; x += 70) {
      g.fillStyle(0x3a3a3a, 1).fillRect(x, 0, 1, 6);
      g.fillStyle(0xffffff, 1).fillCircle(x, 8, 3);
    }
    text(this, W / 2, 26, 'THREADS', 0xc0306a).setOrigin(0.5, 0).setDepth(1);
    text(this, W / 2, 36, 'CLOTHING AND ACCESSORIES', 0x8a5a70).setOrigin(0.5, 0).setDepth(1);

    // ---- tops, on two mannequins in the window: today's look, not the catalogue
    this.forSale('top').slice(0, 2).forEach((c, i) => {
      const x = COUNTER_RIGHT + 16 + i * 34;
      const st = this.add.graphics().setDepth(depthFor(BACK_ROW) - 0.0001);
      st.fillStyle(0x14100c, 1).fillEllipse(x, BACK_ROW, 16, 5);
      st.fillStyle(0xd8d0c8, 1).fillEllipse(x, BACK_ROW - 1, 14, 3);
      new Player(this, x, BACK_ROW - 1, false, mannequin(c));
      this.tag(x, BACK_ROW + 2, c.price);
      this.spots.push({ c, x, y: BACK_ROW, depth: 5 });
    });

    // ---- a table of folded things, out in front
    const legs = this.forSale('legs');
    const tx = 120;
    const t = this.add.graphics().setDepth(depthFor(FRONT_ROW));
    t.fillStyle(0x14100c, 1).fillRect(tx - 30, FRONT_ROW - 12, 60, 12);
    t.fillStyle(0xf0ece4, 1).fillRect(tx - 29, FRONT_ROW - 11, 58, 4);
    t.fillStyle(0xb8a890, 1).fillRect(tx - 27, FRONT_ROW - 7, 3, 7).fillRect(tx + 24, FRONT_ROW - 7, 3, 7);
    legs.slice(0, 3).forEach((c, i) => {
      const x = tx - 18 + i * 18;
      t.fillStyle(0x14100c, 1).fillRect(x - 7, FRONT_ROW - 18, 14, 7);
      t.fillStyle(c.cols.J ?? 0x444444, 1).fillRect(x - 6, FRONT_ROW - 17, 12, 5);
      t.fillStyle(c.cols.j ?? 0x333333, 1).fillRect(x - 6, FRONT_ROW - 15, 12, 1);
    });
    this.tagRack(tx, FRONT_ROW + 1, 'TROUSERS');
    this.solidBox(tx, FRONT_ROW, 60);
    this.racks.push({ x: tx, y: FRONT_ROW, w: 60, depth: 0, tab: 1, name: 'THE TABLE' });

    // ---- shoes on a low shelf
    const shoes = this.forSale('shoes');
    const sx = 176;
    const sh = this.add.graphics().setDepth(depthFor(FRONT_ROW));
    sh.fillStyle(0x14100c, 1).fillRect(sx - 20, FRONT_ROW - 6, 40, 6);
    sh.fillStyle(0x8a6a48, 1).fillRect(sx - 19, FRONT_ROW - 5, 38, 4);
    shoes.slice(0, 3).forEach((c, i) => {
      const x = sx - 12 + i * 12;
      for (const k of [-3, 1]) {
        sh.fillStyle(0x14100c, 1).fillRect(x + k - 1, FRONT_ROW - 10, 6, 5);
        sh.fillStyle(c.cols.K ?? 0x333333, 1).fillRect(x + k, FRONT_ROW - 9, 4, 3);
        sh.fillStyle(c.cols.W ?? 0x555555, 1).fillRect(x + k, FRONT_ROW - 7, 5, 1);
      }
    });
    this.tagRack(sx, FRONT_ROW + 1, 'SHOES');
    this.solidBox(sx, FRONT_ROW, 40);
    this.racks.push({ x: sx, y: FRONT_ROW, w: 40, depth: 0, tab: 1, name: 'THE SHELF' });

    // ---- hats on a stand, and the scarves on hooks beside the mirror
    const hats = this.forSale('hat');
    const hx = 292;
    const hs = this.add.graphics().setDepth(depthFor(FRONT_ROW));
    // ---- THE STAND: a weighted round foot, a turned pole, and two pegs
    // angled up off it, each going up INTO a hat's crown -- the hats rest on
    // the pegs, they do not hang in the air beside them.
    const INK = 0x14100c;
    hs.fillStyle(0x000000, 0.22).fillEllipse(hx, FRONT_ROW, 22, 4);
    hs.fillStyle(INK, 1).fillEllipse(hx, FRONT_ROW - 2, 20, 6);
    hs.fillStyle(0x4a3326, 1).fillEllipse(hx, FRONT_ROW - 2, 18, 4);
    hs.fillStyle(0x6a4a34, 1).fillRect(hx - 7, FRONT_ROW - 4, 12, 1);
    // (as tall as a person, and no taller: the hats on it at head height)
    hs.fillStyle(INK, 1).fillRect(hx - 2, FRONT_ROW - 26, 4, 24);
    hs.fillStyle(0x4a3326, 1).fillRect(hx - 1, FRONT_ROW - 25, 2, 22);
    hs.fillStyle(0x6a4a34, 1).fillRect(hx - 1, FRONT_ROW - 25, 1, 22);
    hs.fillStyle(0xd8a838, 1).fillRect(hx - 2, FRONT_ROW - 28, 4, 3);
    hs.fillStyle(0xf0d070, 1).fillRect(hx - 1, FRONT_ROW - 28, 2, 1);
    const pegs = [
      { x: hx - 6, y: FRONT_ROW - 22, from: FRONT_ROW - 17 },
      { x: hx + 6, y: FRONT_ROW - 15, from: FRONT_ROW - 10 },
    ];
    for (const pg of pegs) {
      const dir = Math.sign(pg.x - hx);
      for (let k = 0; k <= 4; k++) {
        const px = hx + dir * (1 + k);
        const py = pg.from - k;
        hs.fillStyle(INK, 1).fillRect(px - 1, py - 1, 3, 3);
      }
      for (let k = 0; k <= 4; k++) {
        const px = hx + dir * (1 + k);
        const py = pg.from - k;
        hs.fillStyle(0x6a4a34, 1).fillRect(px, py, 1, 1);
      }
    }
    // THE HATS, AS THEY ARE WORN.  Each is drawn from its own crown rows
    // (catalog CROWNS) -- the very pixels that sit on your head, at the size
    // they sit on it (they were drawn twice that, half again the size of a head):
    // the beanie's dome and turned-up cuff, the cap's crown and its peak --
    // set down over a round wooden head-form on the end of its peg.
    hats.slice(0, 2).forEach((c, i) => {
      const pg = pegs[i];
      const rows = (CROWNS[c.id] ?? CROWNS.cos_beanie).filter((r) => r.includes('B') || r.includes('b'));
      const K = 1;
      const colOf = (ch: string) => (ch === 'B' ? c.cols.B ?? 0x444444 : c.cols.b ?? 0x666666);
      const cells: Array<[number, number, string]> = [];
      rows.forEach((row, ry) => [...row].forEach((ch, rx) => ch !== '.' && cells.push([rx, ry, ch])));
      const has = new Set(cells.map(([rx, ry]) => `${rx},${ry}`));
      // centred on the dome (the B rows), so a cap's peak sticks out one side
      const domeCols = cells.filter(([, , ch]) => ch === 'B').map(([rx]) => rx);
      const mid = (Math.min(...domeCols) + Math.max(...domeCols) + 1) / 2;
      const x0 = Math.round(pg.x - mid * K);
      const y0 = pg.y - rows.length * K + 1;
      // THE HAT BLOCK it is worn on: a pale wooden head-form the width of
      // the cuff, rounded under it, so the hat sits as it does on a head
      // (the dome over the top, the cuff round the brow) -- not a flat lid
      const bw = 8;
      const by = pg.y + 1;
      hs.fillStyle(INK, 1).fillEllipse(pg.x, by + 2, bw + 2, 8);
      hs.fillStyle(0xc8a878, 1).fillEllipse(pg.x, by + 2, bw, 6);
      hs.fillStyle(0xe0c49a, 1).fillRect(pg.x - 3, by + 1, 1, 2);
      hs.fillStyle(0xa08058, 1).fillRect(pg.x + 2, by + 1, 1, 3);
      // ink round it, then the fills, lit top-left and shaded on the right
      for (const [rx, ry] of cells) {
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (has.has(`${rx + ox},${ry + oy}`)) continue;
          hs.fillStyle(INK, 1).fillRect(x0 + (rx + ox) * K, y0 + (ry + oy) * K, K, K);
        }
      }
      const right = Math.max(...domeCols);
      for (const [rx, ry, ch] of cells) {
        const base = colOf(ch);
        const col = ch === 'B' && rx === right ? Phaser.Display.Color.ValueToColor(base).darken(20).color : base;
        hs.fillStyle(col, 1).fillRect(x0 + rx * K, y0 + ry * K, K, K);
      }
      // a knit rib up the beanie's cuff, the shine on the dome
      const cuff = cells.filter(([, , ch]) => ch === 'b');
      for (const [rx, ry] of cuff) if (rx % 2 === 0) hs.fillStyle(0x000000, 0.18).fillRect(x0 + rx * K, y0 + ry * K, 1, K);
      const top = cells.filter(([, , ch]) => ch === 'B').sort((a, b) => a[1] - b[1] || a[0] - b[0])[0];
      if (top) hs.fillStyle(0xffffff, 0.35).fillRect(x0 + top[0] * K, y0 + top[1] * K + 1, K, 1);
    });
    this.tagRack(hx, FRONT_ROW + 1, 'HATS');
    this.solidBox(hx, FRONT_ROW, 10);
    this.racks.push({ x: hx, y: FRONT_ROW, w: 14, depth: 0, tab: 2, name: 'THE HAT STAND' });

    // ---- THE SCARVES, each over a brass hook on the wall: looped over it,
    // the two ends falling to different lengths, knitted in two tones with
    // a stripe, fringed at the ends, and shaded where the loop turns under
    // (SLIM: the width of the band you wear at the collar, not a blanket --
    // a narrow loop over the hook and two thin ends, one longer than the other)
    this.forSale('scarf').slice(0, 2).forEach((c, i) => {
      const x = MIRROR_X + 22 + i * 16;
      const sc = this.add.graphics().setDepth(2);
      const wool = c.cols.w ?? 0x888888;
      const dark = Phaser.Display.Color.ValueToColor(wool).darken(22).color;
      const lit = Phaser.Display.Color.ValueToColor(wool).lighten(16).color;
      const ink = 0x14100c;
      // the hook at shoulder height, the ends hanging to the waist (they were
      // hung up by the ceiling, a metre over anybody's head)
      const Y = SCARF_Y;
      // the hook: a brass plate and its curl
      sc.fillStyle(ink, 1).fillRect(x - 1, Y, 4, 3);
      sc.fillStyle(0xd8a838, 1).fillRect(x, Y + 1, 2, 1);
      // the loop over the hook
      sc.fillStyle(ink, 1).fillRect(x - 3, Y + 2, 8, 4);
      sc.fillStyle(wool, 1).fillRect(x - 2, Y + 3, 6, 2);
      sc.fillStyle(lit, 1).fillRect(x - 2, Y + 3, 4, 1);
      // the two ends, two pixels wide: the long one in front
      const end = (ex: number, len: number, front: boolean) => {
        sc.fillStyle(ink, 1).fillRect(ex - 1, Y + 5, 4, len + 2);
        sc.fillStyle(front ? wool : dark, 1).fillRect(ex, Y + 5, 2, len);
        if (front) sc.fillStyle(lit, 1).fillRect(ex, Y + 5, 1, len);
        sc.fillStyle(dark, 1).fillRect(ex, Y + 5 + len - 3, 2, 1);
        sc.fillStyle(front ? wool : dark, 1).fillRect(ex, Y + 5 + len, 1, 2).fillRect(ex + 1, Y + 5 + len, 1, 1);
      };
      end(x + 2, 9, false);
      end(x - 1, 12, true);
    });
    this.racks.push({ x: MIRROR_X + 29, y: FLOOR, w: 40, depth: 0, wall: true, tab: 2, name: 'THE HOOKS' });

    // ---- THE MIRROR: shorter than it was, and made the way the booth is --
    // an ink line round it, a walnut frame lit on the left and shaded on the
    // right with brass at the corners, and glass that shows the room back:
    // the pink of the walls in it, darker to the foot, with two bright
    // streaks of shine across it
    // A REAL MIRROR.  Plain glass (no painted-on room, no lines across it),
    // and you in it: a twin of you, the other way round, clipped to the
    // glass, that walks across it as you walk past -- then the shine over
    // the top of the lot, the way glass catches the shop lights.
    const mx = MIRROR_X - MIRROR.w / 2;
    paintMirror(this.add.graphics().setDepth(2), mx, MIRROR.top, MIRROR.w, MIRROR.h, MIRROR_GLASS);
    // (only while you are at it: see MirrorTwin)
    new MirrorTwin(this, { x: mx + 3, y: MIRROR.top + 3, w: MIRROR.w - 6, h: MIRROR.h - 6 }, 2, 2);
    paintMirrorShine(this.add.graphics().setDepth(2.2), mx, MIRROR.top, MIRROR.w, MIRROR.h);

    // ---- the fitting room, in the middle of the shop: a booth against the
    // back wall, its curtain, and its name on the pelmet
    const fl = FIT_X - FIT_W / 2;
    const fr = this.add.graphics().setDepth(depthFor(BACK_ROW));
    const fh = BACK_ROW - FIT_TOP;
    // the shadow it throws on the floor, and the cubicle's own dark inside
    fr.fillStyle(0x000000, 0.2).fillRect(fl + 1, BACK_ROW, FIT_W, 3);
    fr.fillStyle(0x14100c, 1).fillRect(fl - 1, FIT_TOP - 1, FIT_W + 2, fh + 1);
    fr.fillStyle(0x241428, 1).fillRect(fl, FIT_TOP + 4, FIT_W, fh - 4);
    // ---- the panelled sides of the booth, in dark walnut
    for (const sx of [fl, fl + FIT_W - 3]) {
      fr.fillStyle(0x4a3326, 1).fillRect(sx, FIT_TOP + 4, 3, fh - 4);
      fr.fillStyle(0x6a4a34, 1).fillRect(sx, FIT_TOP + 4, 1, fh - 4);
      fr.fillStyle(0x32221a, 1).fillRect(sx + 2, FIT_TOP + 4, 1, fh - 4);
    }
    // ---- the curtain: heavy velvet, drawn most of the way across, with
    // folds that catch the light, a sweeping hem and a gap at one side
    const cl = fl + 3;
    const cw = FIT_W - 10;
    const ct = FIT_TOP + 5;
    const ch = fh - 5;
    for (let k = 0; k < cw; k++) {
      const fold = Math.sin((k / 2.4) * Math.PI) * 0.5 + 0.5;
      const col = fold > 0.72 ? 0xa2447a : fold > 0.36 ? 0x7b2a5a : 0x571a3e;
      fr.fillStyle(col, 1).fillRect(cl + k, ct, 1, ch);
      if (fold > 0.86) fr.fillStyle(0xc45a94, 0.55).fillRect(cl + k, ct + 1, 1, ch - 6);
    }
    // the hem, gathered, and the shadow it drops on the floor of the booth
    for (let k = 0; k < cw; k++) {
      const dip = (k % 5 === 2 ? 1 : 0) + (k % 3 === 0 ? 1 : 0);
      fr.fillStyle(0x3e1230, 1).fillRect(cl + k, ct + ch - 2 + dip, 1, 2);
    }
    fr.fillStyle(0x000000, 0.25).fillRect(cl, ct + ch, cw, 1);
    // the leading edge of the curtain, catching the shop light
    fr.fillStyle(0xd07aa8, 0.8).fillRect(cl + cw - 1, ct, 1, ch);
    // ---- through the gap: the lit inside, a mirror on the back wall, a
    // stool, a hook with something hung on it, and the carpet
    const gx = cl + cw;
    const gw = fl + FIT_W - 3 - gx;
    fr.fillStyle(0x3a2438, 1).fillRect(gx, ct, gw, ch);
    fr.fillStyle(0xfff0d0, 0.16).fillRect(gx, ct, gw, ch);
    fr.fillStyle(0x8a94a0, 1).fillRect(gx + 1, ct + 3, gw - 2, 14);
    fr.fillStyle(0xc8d8e0, 1).fillRect(gx + 1, ct + 4, gw - 3, 12);
    fr.fillStyle(0xffffff, 0.45).fillRect(gx + 2, ct + 5, 1, 9);
    fr.fillStyle(0x6a4a34, 1).fillRect(gx + 1, BACK_ROW - 8, gw - 2, 2);
    fr.fillStyle(0x8a6a48, 1).fillRect(gx + 1, BACK_ROW - 8, gw - 2, 1);
    fr.fillStyle(0x4a3326, 1).fillRect(gx + 2, BACK_ROW - 6, 1, 5).fillRect(gx + gw - 3, BACK_ROW - 6, 1, 5);
    fr.fillStyle(0x7b2a5a, 1).fillRect(gx, BACK_ROW - 2, gw, 2);
    // ---- the rail: brass, with rings threaded on it, and the pelmet over
    fr.fillStyle(0x2a1430, 1).fillRect(fl - 1, FIT_TOP - 4, FIT_W + 2, 5);
    fr.fillStyle(0x4a2450, 1).fillRect(fl, FIT_TOP - 3, FIT_W, 3);
    fr.fillStyle(0x6a3a70, 1).fillRect(fl, FIT_TOP - 3, FIT_W, 1);
    fr.fillStyle(0xd8a838, 1).fillRect(fl - 1, FIT_TOP + 1, FIT_W + 2, 2);
    fr.fillStyle(0xf0d070, 1).fillRect(fl - 1, FIT_TOP + 1, FIT_W + 2, 1);
    fr.fillStyle(0x8a6418, 1).fillRect(fl - 1, FIT_TOP + 3, FIT_W + 2, 1);
    for (let k = 2; k < FIT_W - 1; k += 4) {
      fr.fillStyle(0xb88828, 1).fillRect(fl + k, FIT_TOP + 3, 2, 2);
      fr.fillStyle(0xf0d070, 1).fillRect(fl + k, FIT_TOP + 3, 1, 1);
    }
    // the light over the booth, and the pool it throws down the curtain
    fr.fillStyle(0xfff0d0, 0.1).fillRect(fl, FIT_TOP + 5, FIT_W, 10);
    fr.fillStyle(0xfff0d0, 0.06).fillRect(fl, FIT_TOP + 15, FIT_W, 12);
    // ---- ITS SIGN, hung over it on two brass chains: FITTING ROOM in two
    // lines of the game's own letters, cream on the booth's velvet, a brass
    // rim round the plate with a lit top edge and a shadow under it
    const SW = 50;
    const SH = 21;
    const sy0 = FIT_TOP - SH - 6;
    paintPlate(this.add.graphics().setDepth(2), FIT_X, sy0, SW, SH, 0x4a2450, 0x6a3a70, true);
    text(this, FIT_X, sy0 + 3, 'FITTING', 0xf6e6c8).setOrigin(0.5, 0).setDepth(2.1);
    text(this, FIT_X, sy0 + 11, 'ROOM', 0xf6e6c8).setOrigin(0.5, 0).setDepth(2.1);

    // ---- the till, just inside the doors, and the assistant behind it
    this.counter = this.paintCounter({
      look: ASSISTANT_LOOK,
      top: 0xf0ece4,
      front: 0x2a2430,
      trim: 0xc0306a,
      who: 'assistant',
      line: '"TRY ANYTHING ON YOU LIKE. THE FITTING ROOM IS BY THE MIRROR."',
      useLabel: '[E] THE RAILS',
      onUse: () => this.rails(0),
      dress: (g, x, top) => {
        // the till, and a folded jumper waiting to be bagged
        g.fillStyle(0x14100c, 1).fillRect(x - 4, top - 7, 12, 7);
        g.fillStyle(0x3a3a3a, 1).fillRect(x - 3, top - 6, 10, 6);
        g.fillStyle(0x7ad0a0, 1).fillRect(x - 1, top - 5, 6, 2);
        g.fillStyle(0x14100c, 1).fillRect(x - 18, top - 4, 10, 4);
        g.fillStyle(0xc84a4a, 1).fillRect(x - 17, top - 3, 8, 3);
      },
    });
    this.surfaces(0xe8c8d8, 0xbeb6ba);
  }

  /** A display stand you cannot walk through (not something to buy itself). */
  private solidBox(x: number, y: number, w: number): void {
    this.solids.push({ x: x - w / 2, y: y - 8, w, h: 9 });
  }

  private tag(x: number, y: number, price: number): void {
    text(this, x, y, `$${price}`, PALETTE.cream).setOrigin(0.5, 0).setDepth(depthFor(y) + 0.0003);
  }

  protected fixtures(): Fixture[] {
    const out: Fixture[] = [];
    // the two dressed mannequins: what is in the window, and the way in to
    // the tops on the card
    for (const s of this.spots) {
      out.push({
        x: s.x,
        y: s.y + (s.depth ? 0 : 4),
        w: 14,
        depth: s.depth,
        label: () => `[E] ${s.c.name} $${s.c.price}`,
        use: () => this.rails(0),
        hit: { x: s.x - 8, y: s.y - 30, w: 16, h: 32 },
      });
    }
    // and every rack: the card, open at what that rack holds
    for (const r of this.racks) {
      out.push({
        x: r.x,
        y: r.y,
        w: r.w,
        depth: r.depth,
        wall: r.wall,
        label: () => `[E] ${r.name}`,
        use: () => this.rails(r.tab),
        hit: r.wall ? { x: r.x - r.w / 2, y: 48, w: r.w, h: 40 } : { x: r.x - r.w / 2, y: r.y - 26, w: r.w, h: 30 },
      });
    }
    out.push({ x: MIRROR_X, y: this.floorTop, w: 22, depth: 0, wall: true, label: () => '[E] MIRROR', use: () => this.mirror(), hit: { x: MIRROR_X - MIRROR.w / 2, y: MIRROR.top, w: MIRROR.w, h: MIRROR.h } });
    out.push({ x: FIT_X, y: BACK_ROW, w: FIT_W, depth: 6, label: () => '[E] FITTING ROOM', use: () => this.fitting(), hit: { x: FIT_X - FIT_W / 2, y: FIT_TOP - 12, w: FIT_W, h: BACK_ROW - FIT_TOP + 14 } });
    if (this.counter) out.push(this.counter);
    return out;
  }

  /** THE RAILS, on one card: the whole range, bought and worn from here. */
  private rails(tab: number): void {
    if (this.busy()) return;
    this.locked = true;
    this.scene.launch('Shop', { kind: 'clothes', from: 'ClothesStore', tab });
  }

  /** What a rack is, written under it (the prices are on the card). */
  private tagRack(x: number, y: number, what: string): void {
    text(this, x, y, what, PALETTE.cream).setOrigin(0.5, 0).setDepth(depthFor(y) + 0.0003);
  }

  private racks: Array<{ x: number; y: number; w: number; depth: number; wall?: boolean; tab: number; name: string }> = [];

  /** You, in a panel, half as big again. */
  private figure(box: Phaser.GameObjects.Container, x: number, y: number, look: Look): void {
    const p = new Player(this, 0, 0, false, look);
    p.sprite.setScale(1.5).setPosition(x, y + 2).setDepth(0);
    box.add(p.sprite);
  }

  private mirror(): void {
    const l = store.get().life;
    const names = Object.values(l.outfit as Record<string, string>)
      .map((id) => cosmeticById(id))
      .filter((c): c is CosmeticDef => !!c && c.id !== 'cos_no_hat')
      .map((c) => c.name);
    this.openPanel('THE MIRROR', ['THAT IS YOU.', ...names.slice(0, 5)], [], (box, x, y) => this.figure(box, x, y, lookFor(l.outfit as Record<string, string>)));
  }

  private fitting(): void {
    if (this.busy()) return;
    this.locked = true;
    this.scene.launch('Shop', { kind: 'wardrobe', from: 'ClothesStore' });
  }
}
