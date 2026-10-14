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
import { PALETTE } from '../../render/palette';
import { audio } from '../../core/audio';
import { store } from '../../core/state';
import { text } from '../../core/ui';
import { GAME_H } from '../../render/pixelScaler';
import { Player, depthFor, type Look } from '../../art/player';
import { COSMETICS, cosmeticById, lookFor, type CosmeticDef } from '../../game/catalog';
import { buyCosmetic, record, wear } from '../../game/life';
import { COUNTER_RIGHT, WalkRoom, type Fixture } from '../rooms/WalkRoom';
import { ASSISTANT_LOOK } from '../../ui/portraits';

const FLOOR = 100;
const BACK_ROW = FLOOR + 22;
const FRONT_ROW = FLOOR + 52;
/** The shop's width; the fitting room stands in the middle of it. */
const SHOP_W = 460;
const FIT_X = SHOP_W / 2;
const FIT_W = 26;
/** The booth's top: a cubicle a little taller than a person, not a wardrobe to the ceiling. */
const FIT_TOP = 84;
const MIRROR_X = 335;

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

    // ---- tops, on mannequins on little round stands
    // (either side of the fitting room: three before it, the rest after)
    this.forSale('top').forEach((c, i) => {
      const x = i < 3 ? COUNTER_RIGHT + 12 + i * 30 : FIT_X + FIT_W / 2 + 16 + (i - 3) * 30;
      const s = this.add.graphics().setDepth(depthFor(BACK_ROW) - 0.0001);
      s.fillStyle(0x14100c, 1).fillEllipse(x, BACK_ROW, 16, 5);
      s.fillStyle(0xd8d0c8, 1).fillEllipse(x, BACK_ROW - 1, 14, 3);
      new Player(this, x, BACK_ROW - 1, false, mannequin(c));
      this.tag(x, BACK_ROW + 2, c.price);
      this.spots.push({ c, x, y: BACK_ROW, depth: 5 });
    });

    // ---- trousers, folded on a table
    const legs = this.forSale('legs');
    const tx = 172;
    const t = this.add.graphics().setDepth(depthFor(FRONT_ROW));
    t.fillStyle(0x14100c, 1).fillRect(tx - 34, FRONT_ROW - 12, 68, 12);
    t.fillStyle(0xf0ece4, 1).fillRect(tx - 33, FRONT_ROW - 11, 66, 4);
    t.fillStyle(0xb8a890, 1).fillRect(tx - 31, FRONT_ROW - 7, 3, 7).fillRect(tx + 28, FRONT_ROW - 7, 3, 7);
    legs.forEach((c, i) => {
      const x = tx - 20 + i * 20;
      t.fillStyle(0x14100c, 1).fillRect(x - 7, FRONT_ROW - 18, 14, 7);
      t.fillStyle(c.cols.J ?? 0x444444, 1).fillRect(x - 6, FRONT_ROW - 17, 12, 5);
      t.fillStyle(c.cols.j ?? 0x333333, 1).fillRect(x - 6, FRONT_ROW - 15, 12, 1);
      this.tag(x, FRONT_ROW + 1, c.price);
      this.spots.push({ c, x, y: FRONT_ROW, depth: 0 });
    });
    this.solidBox(tx, FRONT_ROW, 68);

    // ---- shoes, on a low shelf
    const shoes = this.forSale('shoes');
    const sx = 262;
    const sh = this.add.graphics().setDepth(depthFor(FRONT_ROW));
    sh.fillStyle(0x14100c, 1).fillRect(sx - 22, FRONT_ROW - 6, 44, 6);
    sh.fillStyle(0x8a6a48, 1).fillRect(sx - 21, FRONT_ROW - 5, 42, 4);
    shoes.forEach((c, i) => {
      const x = sx - 10 + i * 20;
      for (const k of [-3, 2]) {
        sh.fillStyle(0x14100c, 1).fillRect(x + k - 1, FRONT_ROW - 10, 6, 5);
        sh.fillStyle(c.cols.K ?? 0x333333, 1).fillRect(x + k, FRONT_ROW - 9, 4, 3);
        sh.fillStyle(c.cols.W ?? 0x555555, 1).fillRect(x + k, FRONT_ROW - 7, 5, 1);
      }
      this.tag(x, FRONT_ROW + 1, c.price);
      this.spots.push({ c, x, y: FRONT_ROW, depth: 0 });
    });
    this.solidBox(sx, FRONT_ROW, 44);

    // ---- hats, on a stand
    const hats = this.forSale('hat');
    const hx = 334;
    const hs = this.add.graphics().setDepth(depthFor(FRONT_ROW));
    hs.fillStyle(0x14100c, 1).fillRect(hx - 1, FRONT_ROW - 30, 3, 30).fillRect(hx - 8, FRONT_ROW - 2, 17, 2);
    hats.forEach((c, i) => {
      const x = hx + (i === 0 ? -9 : 9);
      const y = FRONT_ROW - 26 + i * 8;
      hs.fillStyle(0x14100c, 1).fillEllipse(x, y, 12, 8);
      hs.fillStyle(c.cols.B ?? 0x444444, 1).fillEllipse(x, y, 10, 6);
      hs.fillStyle(c.cols.b ?? 0x666666, 1).fillRect(x - 5, y + 1, c.head ? 9 : 10, 2);
      this.tag(x, FRONT_ROW + 1, c.price);
      this.spots.push({ c, x, y: FRONT_ROW, depth: 0 });
    });
    this.solidBox(hx, FRONT_ROW, 10);

    // ---- scarves, on hooks on the wall
    this.forSale('scarf').forEach((c, i) => {
      const x = MIRROR_X + 36 + i * 22;
      const sc = this.add.graphics().setDepth(2);
      sc.fillStyle(0x3a3a3a, 1).fillRect(x - 1, 52, 3, 2);
      sc.fillStyle(0x14100c, 1).fillRect(x - 4, 53, 9, 28);
      sc.fillStyle(c.cols.w ?? 0x888888, 1).fillRect(x - 3, 54, 7, 26);
      sc.fillStyle(0xffffff, 0.25).fillRect(x - 3, 58, 7, 1).fillRect(x - 3, 70, 7, 1);
      text(this, x, 84, `$${c.price}`, 0x8a3a5a).setOrigin(0.5, 0).setDepth(2);
      this.spots.push({ c, x, y: FLOOR, depth: 0, wall: true });
    });

    // ---- the mirror
    const m = this.add.graphics().setDepth(2);
    m.fillStyle(0x6a4a2a, 1).fillRect(MIRROR_X - 13, 30, 26, 56);
    m.fillStyle(0xcfe4ee, 1).fillRect(MIRROR_X - 11, 32, 22, 52);
    m.fillStyle(0xffffff, 0.5).fillRect(MIRROR_X - 7, 36, 3, 40);

    // ---- the fitting room, in the middle of the shop: a booth against the
    // back wall, its curtain, and its name on the pelmet
    const fl = FIT_X - FIT_W / 2;
    const fr = this.add.graphics().setDepth(depthFor(BACK_ROW));
    fr.fillStyle(0x000000, 0.18).fillRect(fl + 1, BACK_ROW, FIT_W, 3);
    fr.fillStyle(0x14100c, 1).fillRect(fl, FIT_TOP, FIT_W, BACK_ROW - FIT_TOP);
    fr.fillStyle(0x7b2a5a, 1).fillRect(fl + 1, FIT_TOP + 5, FIT_W - 2, BACK_ROW - FIT_TOP - 6);
    for (let k = 0; k < FIT_W - 2; k += 3) fr.fillStyle(0x5a1a40, 1).fillRect(fl + 1 + k, FIT_TOP + 5, 1, BACK_ROW - FIT_TOP - 6);
    // the curtain drawn back a little at one side, the stool inside showing
    fr.fillStyle(0x3a2030, 1).fillRect(fl + FIT_W - 8, FIT_TOP + 5, 7, BACK_ROW - FIT_TOP - 6);
    fr.fillStyle(0x8a6a48, 1).fillRect(fl + FIT_W - 7, BACK_ROW - 10, 6, 2);
    fr.fillStyle(0x9a3a6a, 1).fillRect(fl + FIT_W - 10, FIT_TOP + 5, 2, BACK_ROW - FIT_TOP - 6);
    // the rail, in brass, with the curtain rings
    fr.fillStyle(0xd8a838, 1).fillRect(fl - 1, FIT_TOP, FIT_W + 2, 2);
    for (let k = 2; k < FIT_W; k += 5) fr.fillStyle(0xb88828, 1).fillRect(fl + k, FIT_TOP + 2, 2, 2);
    // and its little sign on the wall over it
    const sign = text(this, FIT_X, FIT_TOP - 11, 'FITTING', 0xff8ac0).setOrigin(0.5, 0).setDepth(2.1);
    this.add.rectangle(FIT_X, FIT_TOP - 7, sign.width + 6, 10, 0x2a1430).setStrokeStyle(1, 0xd8a838).setDepth(2);

    // ---- the till, just inside the doors, and the assistant behind it
    this.counter = this.paintCounter({
      look: ASSISTANT_LOOK,
      top: 0xf0ece4,
      front: 0x2a2430,
      trim: 0xc0306a,
      who: 'assistant',
      line: '"TRY ANYTHING ON YOU LIKE. THE FITTING ROOM IS IN THE MIDDLE, BY THE MIRROR."',
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
    for (const s of this.spots) {
      out.push({
        x: s.x,
        y: s.wall ? s.y : s.y + (s.depth ? 0 : 4),
        w: 14,
        depth: s.depth,
        wall: s.wall,
        label: () => `[E] ${s.c.name} ${this.owns(s.c.id) ? '(YOURS)' : `$${s.c.price}`}`,
        use: () => this.show(s.c),
        hit: s.wall ? { x: s.x - 6, y: 50, w: 12, h: 34 } : { x: s.x - 8, y: s.y - (s.depth ? 28 : 22), w: 16, h: s.depth ? 30 : 24 },
      });
    }
    out.push({ x: MIRROR_X, y: this.floorTop, w: 22, depth: 0, wall: true, label: () => '[E] MIRROR', use: () => this.mirror(), hit: { x: MIRROR_X - 13, y: 30, w: 26, h: 56 } });
    out.push({ x: FIT_X, y: BACK_ROW, w: FIT_W, depth: 6, label: () => '[E] FITTING ROOM', use: () => this.fitting(), hit: { x: FIT_X - FIT_W / 2, y: FIT_TOP - 12, w: FIT_W, h: BACK_ROW - FIT_TOP + 14 } });
    if (this.counter) out.push(this.counter);
    return out;
  }

  private owns(id: string): boolean {
    return store.get().life.wardrobe.includes(id);
  }

  private wearing(c: CosmeticDef): boolean {
    return (store.get().life.outfit as Record<string, string>)[c.slot] === c.id;
  }

  private show(c: CosmeticDef): void {
    const outfit = { ...(store.get().life.outfit as Record<string, string>), [c.slot]: c.id };
    const owned = this.owns(c.id);
    const on = this.wearing(c);
    const buttons = [];
    if (!owned) {
      buttons.push({
        label: `BUY & WEAR $${c.price}`,
        fn: () => {
          const r = buyCosmetic(c.id);
          if (r.ok) wear(c.id);
          audio.sfx(r.ok ? 'cha_ching' : 'buzzer', 0.6);
          this.closePanel();
          if (r.ok) this.refreshPlayer();
          this.say(r.ok ? `${c.name} - YOU PUT IT ON.` : r.msg);
        },
        disabled: store.get().cash < c.price,
      });
    } else if (!on) {
      buttons.push({ label: 'WEAR', fn: () => this.wearIt(c.id) });
    } else if (c.slot === 'hat') {
      buttons.push({ label: 'TAKE OFF', fn: () => this.wearIt('cos_no_hat') });
    }
    this.openPanel(
      c.name,
      [owned ? (on ? 'YOU ARE WEARING IT' : 'YOURS') : `$${c.price}`, c.slot.toUpperCase(), 'LOOKS ONLY - NO ADVANTAGE', `YOU HAVE $${store.get().cash}`],
      buttons,
      (box, x, y) => this.figure(box, x, y, lookFor(outfit)),
    );
  }

  private wearIt(id: string): void {
    wear(id);
    this.closePanel();
    this.refreshPlayer();
    this.say(`NOW WEARING ${cosmeticById(id)?.name ?? ''}.`);
  }

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
