/**
 * ---- HOME AND HEARTH, inside.
 *
 * IT USED TO BE A CORRIDOR.  Every piece in the catalogue stood in it with a
 * price card in front of it, which made the room eight hundred pixels long:
 * buying a lamp meant walking past forty other things, and on a phone that
 * is a lot of thumb.  Now the shop is ONE SCREEN -- a showroom with today's
 * best half-dozen out on the floor to look at, sit on and switch on, and a
 * counter where the whole of today's stock is bought from one card (see
 * scenes2d/Shop, kind 'furniture').
 *
 * WHAT IS IN CHANGES WITH THE DAY (catalog `stockFor`): a dozen rotating
 * pieces and the four a flat cannot do without.  What you buy goes to your
 * condo, to be placed with DECORATE.
 */

import Phaser from 'phaser';
import { PALETTE } from '../../render/palette';
import { audio } from '../../core/audio';
import { store } from '../../core/state';
import { text } from '../../core/ui';
import { GAME_H } from '../../render/pixelScaler';
import { drawFurniture } from '../../art/furnitureArt';
import { stockFor, type FurnitureDef } from '../../game/catalog';
import { buyFurniture, clock, record } from '../../game/life';
import { VERB_LABEL, useOf } from '../../game/furnitureUse';
import { COUNTER_RIGHT, FLOOR_TOP, WalkRoom, type Fixture } from '../rooms/WalkRoom';
import { KEEPER_LOOK } from '../../ui/portraits';
import { Piece } from '../rooms/piece';

const BACK_ROW = FLOOR_TOP + 24;
const FRONT_ROW = FLOOR_TOP + 54;
const WALL_FOOT = FLOOR_TOP - 20;
/** The clear floor between one piece (or its price card) and the next. */
const PIECE_GAP = 12;
/** The price cards: above all the furniture, below the prompts and panels. */
const PRICE_DEPTH = 700;
/** How wide a price card comes out, in the pixel font. */
const priceWidth = (price: number): number => `$${price}`.length * 6 + 2;

export class FurnitureStore extends WalkRoom {
  private pieces = new Map<string, Piece>();

  constructor() {
    super('FurnitureStore');
  }

  protected keepsShopHours = true;

  protected music(): string {
    return 'room_lounge';
  }

  protected entered(): void {
    record('shop_visit');
  }

  protected leave(): void {
    this.exitTo('StreetEast', { atShop: 'furniture' });
  }

  /**
   * The showroom floor: the six pieces of today's stock worth standing up,
   * spread across the one screen the shop is.  Everything else in today's
   * stock is still bought -- from the counter card, which has all of it.
   */
  private layout(): Array<{ def: FurnitureDef; x: number; y: number }> {
    const today = stockFor(clock().day);
    const out: Array<{ def: FurnitureDef; x: number; y: number }> = [];
    // two on the wall over the back row, four standing on the floor
    const walls = today.filter((f) => f.wall).slice(0, 2);
    walls.forEach((f, i) => out.push({ def: f, x: 150 + i * 70, y: WALL_FOOT }));
    const floor = today.filter((f) => !f.wall && f.cat !== 'rug');
    // the biggest and best of them: what a showroom puts in the window
    const show = [...floor].sort((a, b) => b.price - a.price).slice(0, 4);
    // ---- LAID OUT BY SIZE, NOT BY SLOT.  They used to stand at fixed
    // places whatever their width, so a wide bed and a tall shower ran into
    // each other and over each other's price cards.  Now each takes the room
    // it needs -- its own width or its card's, whichever is wider, and a
    // clear gap -- along two rows that both start past the counter, so
    // nothing stands in the doorway or in front of the counter.  A piece
    // with no room left on the floor is still in the book on the counter.
    const rows = [BACK_ROW, FRONT_ROW];
    const right = this.worldW - 8;
    // what is already standing: each piece's body and the card under it
    // (the pictures on the wall and their cards count: a tall piece in the
    // back row must not stand up over the card under a clock)
    const taken: Array<{ x0: number; x1: number; y0: number; y1: number }> = out.map(({ def, x, y }) => {
      const half = Math.max(def.w, priceWidth(def.price)) / 2;
      return { x0: x - half, x1: x + half, y0: y - def.h, y1: y + 11 };
    });
    const clash = (x0: number, x1: number, y0: number, y1: number) =>
      taken.find((t) => x0 < t.x1 + PIECE_GAP && x1 + PIECE_GAP > t.x0 && y0 < t.y1 && y1 > t.y0);
    for (const f of show) {
      const need = Math.max(f.w, priceWidth(f.price));
      let spot: { x: number; y: number } | null = null;
      for (const y of rows) {
        const y0 = y - f.h;
        const y1 = y + 11;
        let x0 = COUNTER_RIGHT + 6;
        // slide it along past anything it would touch
        for (let c = clash(x0, x0 + need, y0, y1); c && x0 + need <= right; c = clash(x0, x0 + need, y0, y1)) x0 = c.x1 + PIECE_GAP;
        if (x0 + need <= right && (!spot || x0 < spot.x)) spot = { x: x0, y };
      }
      if (!spot) continue;
      taken.push({ x0: spot.x, x1: spot.x + need, y0: spot.y - f.h, y1: spot.y + 11 });
      out.push({ def: f, x: Math.round(spot.x + need / 2), y: spot.y });
    }
    return out;
  }

  protected paintRoom(): void {
    this.pieces.clear();
    const all = this.layout();
    // ONE SCREEN WIDE.  Nothing in here is ever off the side of it.
    const W = this.worldW;
    const g = this.add.graphics().setDepth(0);
    // the wall: warm paper, a dado rail, skirting
    g.fillStyle(0xe8dcc0, 1).fillRect(0, 0, W, FLOOR_TOP);
    for (let x = 0; x < W; x += 8) g.fillStyle(0xddd0b2, 1).fillRect(x, 0, 4, FLOOR_TOP);
    g.fillStyle(0xb89a70, 1).fillRect(0, FLOOR_TOP - 34, W, 3);
    g.fillStyle(0x8a6a48, 1).fillRect(0, FLOOR_TOP - 5, W, 5);
    // ceiling lights
    for (let x = 40; x < W; x += 80) {
      g.fillStyle(0x3a3a3a, 1).fillRect(x, 0, 1, 8);
      g.fillStyle(0xfff0c0, 1).fillRect(x - 5, 8, 11, 3);
      g.fillStyle(0xfff0c0, 0.08).fillTriangle(x - 5, 11, x + 6, 11, x + 30, FLOOR_TOP);
    }
    // the floor: polished boards
    for (let y = FLOOR_TOP; y < GAME_H; y += 6) {
      g.fillStyle(y % 12 === 0 ? 0xa87848 : 0x9a6c40, 1).fillRect(0, y, W, 6);
      g.fillStyle(0x6a4a2a, 1).fillRect(0, y, W, 1);
      for (let x = (y * 11) % 48; x < W; x += 48) g.fillStyle(0x6a4a2a, 1).fillRect(x, y, 1, 6);
    }
    // the shop's name, painted on the wall
    text(this, W / 2, 26, 'HOME AND HEARTH', 0x7a3a22).setOrigin(0.5, 0).setDepth(1);
    text(this, W / 2, 36, 'NEW STOCK EVERY DAY', 0x9a7a58).setOrigin(0.5, 0).setDepth(1);

    // the counter, just inside the doors, and the woman who runs the place behind it
    this.counter = this.paintCounter({
      look: KEEPER_LOOK,
      top: 0x9a6a3a,
      front: 0x7a4a28,
      trim: 0x5a3418,
      who: 'keeper',
      line: '"HAVE A LOOK AT THE BOOK, LOVE. WHATEVER IS IN TODAY, AND IT GOES STRAIGHT TO YOUR PLACE."',
      useLabel: '[E] TODAY\'S STOCK',
      onUse: () => this.openCatalogue(),
      dress: (g, x, top) => {
        // a brass bell and the order book
        g.fillStyle(0x14100c, 1).fillRect(x - 15, top - 4, 8, 4);
        g.fillStyle(0xd8a838, 1).fillRect(x - 14, top - 3, 6, 3);
        g.fillStyle(0x14100c, 1).fillRect(x + 6, top - 2, 12, 2);
        g.fillStyle(0xf0e8d0, 1).fillRect(x + 7, top - 2, 10, 1);
      },
    });

    for (const p of all) {
      const piece = new Piece(this, p.def, p.x, p.y);
      this.pieces.set(p.def.id, piece);
      // the price card, on the floor in front (or under a picture)
      const ty = p.def.wall ? p.y + 3 : p.y + 2;
      text(this, p.x, ty, `$${p.def.price}`, p.def.wall ? 0x5a3a22 : PALETTE.cream)
        .setOrigin(0.5, 0)
        // over every piece of furniture in the room, so nothing standing in
        // front of it can ever hide what it costs
        .setDepth(PRICE_DEPTH);
    }
    this.layoutCache = all;
    this.surfaces(0xe8dcc0, 0x9a6c40);
  }

  private layoutCache: Array<{ def: FurnitureDef; x: number; y: number }> = [];
  private counter: Fixture | null = null;

  protected fixtures(): Fixture[] {
    const counter = this.counter!;
    return [counter, ...this.layoutCache.map(({ def, x, y }) => ({
      x,
      y,
      w: Math.max(10, def.w),
      depth: def.wall || def.cat === 'rug' ? 0 : Math.min(8, Math.max(4, Math.round(def.h / 3))),
      wall: def.wall,
      label: () => `[E] ${def.name} $${def.price}`,
      use: () => this.show(def),
      hit: def.wall ? { x: x - def.w / 2 - 2, y: y - def.h - 2, w: def.w + 4, h: def.h + 6 } : undefined,
    }))];
  }

  /** The counter card: everything in today, bought from one screen. */
  private openCatalogue(): void {
    if (this.busy()) return;
    this.locked = true;
    this.scene.launch('Shop', { kind: 'furniture', from: 'FurnitureStore' });
  }

  private show(def: FurnitureDef): void {
    const l = store.get().life;
    const owned = l.furniture[def.id] ?? 0;
    const verb = useOf(def);
    const piece = this.pieces.get(def.id)!;
    const lines = [
      def.note,
      `$${def.price}   ${def.cat.toUpperCase()}${def.wall ? ' (WALL)' : ''}`,
      owned ? `YOU OWN ${owned}` : 'YOU DO NOT OWN ONE',
      l.rented ? 'PLACE IT FROM DECORATE AT HOME' : 'RENT A UNIT AT LILY\'S TO USE IT',
      'THE COUNTER HAS THE REST OF TODAY',
    ];
    const buttons = [
      {
        label: `BUY $${def.price}`,
        fn: () => {
          const r = buyFurniture(def.id);
          audio.sfx(r.ok ? 'cha_ching' : 'buzzer', 0.6);
          this.closePanel();
          this.say(r.msg);
        },
        disabled: store.get().cash < def.price,
      },
    ];
    if (verb && verb !== 'wash') {
      buttons.push({
        label: verb === 'sit' ? 'TRY IT' : verb === 'lie' ? 'TRY IT' : verb === 'play' ? 'PLAY' : piece.on ? 'TURN OFF' : 'TURN ON',
        fn: () => {
          this.closePanel();
          this.tryIt(def, piece);
        },
        disabled: false,
      });
    }
    this.openPanel(def.name, lines, buttons, (c, x, y) => {
      const g = this.add.graphics();
      const k = def.w > 34 || def.h > 26 ? 1 : 2;
      drawFurniture(g, def, 0, 0);
      g.setScale(k).setPosition(x, y - 4);
      c.add(g);
    });
    void VERB_LABEL;
  }

  private tryIt(def: FurnitureDef, piece: Piece): void {
    const verb = useOf(def);
    if (verb === 'sit') {
      // on the seat, facing out into the shop
      this.sitOn(piece.x, piece.y + 1, 'chair', 1);
      this.say(`YOU TRY THE ${def.name}. COMFY. MOVE TO GET UP.`);
    } else if (verb === 'lie') {
      // laid out along it, head on the (left-hand) pillow, eyes shut, breathing
      // -- not sat on the floor in front of it
      const L = Math.round(piece.x - def.w / 2);
      const flat = def.id === 'fur_sleeping_bag' || def.id === 'fur_mattress';
      const headH = Math.max(6, Math.round(def.h * (def.id === 'fur_bed_premium' ? 0.52 : 0.42)));
      const pw = Math.max(5, Math.round(def.w / 2) - 5);
      const restY = flat ? piece.y - Math.round(def.h / 2) - 1 : piece.y - def.h + headH + 3;
      const headX = flat ? L + 6 : L + 3 + pw / 2;
      const feetX = Math.min(L + def.w - 2, Math.round(headX + 22));
      this.lieOn(feetX, piece.y + 1, restY, 1);
      this.say(`YOU STRETCH OUT ON THE ${def.name}. MOVE TO GET UP.`);
    } else if (verb === 'switch') {
      this.say(piece.toggle() ? `THE ${def.name} IS ON.` : `THE ${def.name} IS OFF.`);
    } else if (verb === 'play') {
      piece.play();
      this.say(`THE ${def.name} PLAYS A LITTLE TUNE.`);
    }
  }
}

void Phaser;
