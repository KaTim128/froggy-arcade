/**
 * ---- THE LIST PANEL: the wardrobe (in the condo, and the clothes shop's
 * fitting room) and the landlord's desk.  (The shops themselves are rooms
 * you walk round: see scenes2d/shops.)  Tabs across the top, a list on the left, a
 * preview and the details on the right, and the buttons that do something
 * with what is picked.  What differs is only the data (see `modeFor`).
 *
 * Every button goes through game/life.ts, which checks and charges.  Nothing
 * here moves money or items itself.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { button, centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { Player } from '../art/player';
import { drawFurniture } from '../art/furnitureArt';
import { paintUnitDoor } from '../art/hotelInterior';
import {
  COSMETICS,
  buyCosmetic,
  buyFurniture,
  clock,
  evict,
  payDebt,
  payRent,
  rent,
  rentInDays,
  resaleValue,
  sellAsset,
  wear,
  RENT_DAYS,
  RENT_PRICE,
  rentToMan,
  unitNo,
  type Result,
} from '../game/life';
import { cosmeticById, furnitureById, lookFor, stockFor, type CosmeticDef, type CosmeticSlot, type FurnitureDef } from '../game/catalog';
import { touchControls } from '../ui/touchControls';

/**
 * The three shops on the street sell from a COUNTER CARD -- this panel --
 * rather than by walking the length of the room and pressing [E] on every
 * price label in it.  The rooms are still there to walk round and try things
 * in; the buying is here, on one screen, where a phone can reach all of it.
 */
export type ShopKind = 'landlord' | 'wardrobe' | 'furniture' | 'barber' | 'clothes';

interface Row {
  id: string;
  name: string;
  right: string;
  dim?: boolean;
}
interface Tab {
  label: string;
  rows: () => Row[];
}
interface Act {
  label: string;
  fn: () => Result | void;
  off?: boolean;
}
interface Mode {
  title: string;
  tabs: Tab[];
  detail: (id: string) => string[];
  preview: (id: string, at: { x: number; y: number }) => void;
  actions: (id: string) => Act[];
}

const LIST_X = 14;
const LIST_Y = 40;
const ROW_H = 12;
const ROWS = 9;
const PREV_X = 166;

export class Shop extends Phaser.Scene {
  private kind: ShopKind = 'wardrobe';
  private from = '';
  private mode!: Mode;
  private tab = 0;
  private sel = 0;
  private top = 0;
  private layer!: Phaser.GameObjects.Container;
  private msg = '';
  private previewBits: Phaser.GameObjects.GameObject[] = [];
  private player: Player | null = null;
  private refresher: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('Shop');
  }

  init(data: { kind?: ShopKind; from?: string; tab?: number }): void {
    this.kind = data.kind ?? 'wardrobe';
    this.from = data.from ?? '';
    // a rack in the room opens the card at what that rack holds
    this.tab = Math.max(0, data.tab ?? 0);
    this.sel = 0;
    this.top = 0;
    this.msg = '';
  }

  create(): void {
    // OVER WHOEVER OPENED IT.  Scenes draw in the order they were registered,
    // and this one is registered before some of the rooms that open it -- the
    // condo reception among them -- so launched from there it was drawn
    // underneath the room: the pad went away for it, and nothing appeared.
    this.scene.bringToTop();
    // The list fills the screen, and its rows and buttons reach into the
    // corners a phone keeps its arrows in: the pad goes while it is open.
    touchControls.holdStick();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => touchControls.releaseStick());
    this.mode = this.modeFor(this.kind);
    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.88).setOrigin(0, 0).setInteractive();
    this.add.rectangle(6, 6, GAME_W - 12, GAME_H - 12, PALETTE.ink, 0.97).setOrigin(0, 0).setStrokeStyle(1, PALETTE.gold);
    this.layer = this.add.container(0, 0);
    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.close());
    kb?.on('keydown-UP', () => this.move(-1));
    kb?.on('keydown-DOWN', () => this.move(1));
    kb?.on('keydown-W', () => this.move(-1));
    kb?.on('keydown-S', () => this.move(1));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.move(dy > 0 ? 1 : -1));
    this.draw();
  }

  private rows(): Row[] {
    return this.mode.tabs[this.tab]?.rows() ?? [];
  }

  private move(d: number): void {
    const n = this.rows().length;
    if (!n) return;
    this.sel = Phaser.Math.Clamp(this.sel + d, 0, n - 1);
    if (this.sel < this.top) this.top = this.sel;
    if (this.sel >= this.top + ROWS) this.top = this.sel - ROWS + 1;
    this.draw();
  }

  private close(): void {
    this.refresher?.remove(false);
    this.scene.get(this.from)?.events.emit('shop-closed', this.kind);
    this.scene.stop();
  }

  private draw(): void {
    this.layer.removeAll(true);
    this.player?.sprite.destroy();
    this.player = null;
    for (const b of this.previewBits) b.destroy();
    this.previewBits = [];
    const L = this.layer;
    const s = store.get();
    L.add(text(this, 14, 11, this.mode.title, PALETTE.gold));
    L.add(text(this, 196, 11, `$${s.cash}  ${s.tokens} TOK`, PALETTE.mossLight).setOrigin(1, 0).setX(GAME_W - 60));
    L.add(button(this, GAME_W - 32, 15, 'CLOSE', () => this.close(), { width: 44, height: 11 }));

    // tabs
    const tabs = this.mode.tabs;
    if (tabs.length > 1) {
      const tw = Math.floor((GAME_W - 28) / tabs.length);
      tabs.forEach((t, i) => {
        L.add(
          button(this, 14 + tw * i + tw / 2, 28, t.label, () => {
            this.tab = i;
            this.sel = 0;
            this.top = 0;
            this.msg = '';
            this.draw();
          }, { width: tw - 4, height: 11, fill: i === this.tab ? PALETTE.tealDark : PALETTE.ink }),
        );
      });
    }

    // the list
    const rows = this.rows();
    if (this.sel >= rows.length) this.sel = Math.max(0, rows.length - 1);
    if (!rows.length) L.add(text(this, LIST_X, LIST_Y + 4, 'NOTHING HERE YET.', PALETTE.ash));
    rows.slice(this.top, this.top + ROWS).forEach((r, k) => {
      const i = this.top + k;
      const y = LIST_Y + k * ROW_H;
      const on = i === this.sel;
      const plate = this.add.rectangle(LIST_X - 2, y - 2, 146, ROW_H - 1, on ? PALETTE.plum : PALETTE.black, on ? 1 : 0.35).setOrigin(0, 0);
      plate.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.sel = i;
        this.msg = '';
        this.draw();
      });
      L.add(plate);
      const name = r.name.length > 15 ? `${r.name.slice(0, 14)}.` : r.name;
      L.add(text(this, LIST_X, y, name, r.dim ? PALETTE.ash : on ? PALETTE.gold : PALETTE.cream));
      L.add(text(this, LIST_X + 142, y, r.right, r.dim ? PALETTE.ash : PALETTE.mossLight).setOrigin(1, 0));
    });
    if (rows.length > ROWS) {
      L.add(button(this, LIST_X + 30, 156, 'UP', () => this.move(-1), { width: 50, height: 11 }));
      L.add(button(this, LIST_X + 110, 156, 'DOWN', () => this.move(1), { width: 50, height: 11 }));
    }

    // the picked one
    const r = rows[this.sel];
    L.add(this.add.rectangle(PREV_X, 36, GAME_W - PREV_X - 12, 52, PALETTE.black, 0.5).setOrigin(0, 0).setStrokeStyle(1, PALETTE.slate));
    if (r) {
      this.mode.preview(r.id, { x: PREV_X + (GAME_W - PREV_X - 12) / 2, y: 84 });
      // Wrapped to the card, a word at a time: the column from PREV_X to the
      // frame holds about twenty-four characters, and a longer line ran out
      // through the frame and off the side of the shop.
      const cols = Math.floor((GAME_W - 10 - PREV_X) / 6);
      let row = 0;
      this.mode.detail(r.id).forEach((line, i) => {
        const col = i === 0 ? PALETTE.gold : PALETTE.cream;
        let cur = '';
        const flush = (): void => {
          L.add(text(this, PREV_X, 92 + row * 9, cur, col));
          row++;
          cur = '';
        };
        for (const word of line.split(' ')) {
          const next = cur ? `${cur} ${word}` : word;
          if (next.length > cols && cur) {
            flush();
            cur = word;
          } else cur = next;
        }
        if (cur || !line) flush();
      });
      const acts = this.mode.actions(r.id);
      const bw = Math.floor((GAME_W - PREV_X - 12 - (acts.length - 1) * 4) / Math.max(1, acts.length));
      acts.forEach((a, i) => {
        L.add(
          button(this, PREV_X + bw / 2 + i * (bw + 4), 152, a.label, () => this.act(a), { width: bw, height: 13, disabled: a.off }),
        );
      });
    }
    if (this.msg) L.add(centerText(this, GAME_W / 2, 167, this.msg, PALETTE.gold));
  }

  private act(a: Act): void {
    const res = a.fn();
    if (res) {
      this.msg = res.msg;
      audio.sfx(res.ok ? 'cha_ching' : 'buzzer', res.ok ? 0.6 : 0.5);
    }
    this.draw();
  }

  // ------------------------------------------------------------- previews

  /** The door of Unit 612, as it is on Level 6 (art/hotelInterior paintUnitDoor). */
  private drawUnitDoor(at: { x: number; y: number }): void {
    const W = 56;
    const H = 50;
    const num = String(unitNo());
    const key = `unit${num}_door`;
    if (!this.textures.exists(key)) {
      const t = this.textures.createCanvas(key, W, H);
      if (t) {
        paintUnitDoor(t.getContext(), W, H, num);
        t.refresh();
      }
    }
    this.previewBits.push(this.add.image(Math.round(at.x), at.y + 3, key).setOrigin(0.5, 1));
  }

  private drawPerson(outfit: Record<string, string>, at: { x: number; y: number }): void {
    this.player = new Player(this, at.x, at.y, false, lookFor(outfit));
    this.player.sprite.setScale(1.5).setDepth(5);
  }

  // ---------------------------------------------------------------- modes

  private modeFor(kind: ShopKind): Mode {
    const life = () => store.get().life;
    switch (kind) {
      case 'wardrobe': {
        const slots: Array<[string, CosmeticSlot[]]> = [['TOPS', ['top', 'scarf']], ['LEGS', ['legs', 'shoes']], ['HEAD', ['hat', 'hair', 'dye']]];
        return {
          title: 'WARDROBE',
          tabs: slots.map(([label, ss]) => ({
            label,
            rows: () =>
              COSMETICS.filter((c) => ss.includes(c.slot) && life().wardrobe.includes(c.id)).map((c) => ({
                id: c.id,
                name: c.name,
                right: (life().outfit as Record<string, string>)[c.slot] === c.id ? 'ON' : '',
              })),
          })),
          detail: (id) => [cosmeticById(id)!.name, 'OWNED'],
          preview: (id, at) => {
            const c = cosmeticById(id)!;
            const outfit = { ...(life().outfit as Record<string, string>), [c.slot]: id };
            if (c.slot === 'hair') outfit.hat = 'cos_no_hat';
            this.drawPerson(outfit, at);
          },
          actions: (id) => [{ label: 'WEAR', fn: () => wear(id) }],
        };
      }

      case 'furniture':
        return this.furnitureMode();

      case 'barber':
        return this.dresserMode('barber');

      case 'clothes':
        return this.dresserMode('clothes');

      case 'landlord':
      default:
        return this.landlordMode();
    }
  }

  /**
   * ---- HOME AND HEARTH, over the counter.
   *
   * Only what is in today (catalog `stockFor`), in three tabs so no list is
   * ever longer than the panel: what stands on the floor, what hangs on the
   * wall, and the bathroom things.  The card says what it is, what it costs,
   * how many you already own, and where it may go.
   */
  private furnitureMode(): Mode {
    const life = () => store.get().life;
    const today = (): FurnitureDef[] => stockFor(clock().day);
    const owned = (f: FurnitureDef): number => life().furniture[f.id] ?? 0;
    const tab = (label: string, pick: (f: FurnitureDef) => boolean): Tab => ({
      label,
      rows: () =>
        today()
          .filter(pick)
          .map((f) => ({ id: f.id, name: f.name, right: owned(f) ? `$${f.price} x${owned(f)}` : `$${f.price}`, dim: store.get().cash < f.price })),
    });
    return {
      title: 'HOME AND HEARTH',
      tabs: [
        tab('FLOOR', (f) => !f.wall && f.cat !== 'bath'),
        tab('WALL', (f) => f.wall),
        tab('BATHROOM', (f) => f.cat === 'bath'),
      ],
      detail: (id) => {
        const f = furnitureById(id)!;
        const l = life();
        return [
          f.name,
          f.note,
          `$${f.price}   ${f.cat.toUpperCase()}`,
          owned(f) ? `YOU OWN ${owned(f)}` : 'YOU DO NOT OWN ONE',
          f.cat === 'bath' ? 'GOES IN THE BATHROOM' : f.wall ? 'HANGS ON THE WALL' : 'STANDS ON THE FLOOR',
          l.rented ? 'PLACE IT WITH DECORATE' : 'RENT A UNIT FIRST',
        ];
      },
      preview: (id, at) => {
        const f = furnitureById(id)!;
        const g = this.add.graphics();
        drawFurniture(g, f, 0, 0, false);
        // big things shown smaller, so nothing leaves the box
        const k = f.w > 34 || f.h > 26 ? 1 : 1.6;
        g.setScale(k).setPosition(at.x, at.y - 6);
        this.previewBits.push(g);
      },
      actions: (id) => {
        const f = furnitureById(id)!;
        return [{ label: `BUY $${f.price}`, fn: () => buyFurniture(f.id), off: store.get().cash < f.price }];
      },
    };
  }

  /**
   * ---- THE BARBER'S BOOK AND THE RAILS AT THREADS, over the counter.
   *
   * The same card for both: the shop's own stock in tabs by what it is for,
   * YOU wearing the one that is picked in the preview, and one button that
   * buys it and puts it on (or just puts it on, if it is already yours).
   */
  private dresserMode(shop: 'barber' | 'clothes'): Mode {
    const life = () => store.get().life;
    const owns = (c: CosmeticDef): boolean => life().wardrobe.includes(c.id);
    const on = (c: CosmeticDef): boolean => (life().outfit as Record<string, string>)[c.slot] === c.id;
    const tab = (label: string, slots: CosmeticSlot[]): Tab => ({
      label,
      rows: () =>
        COSMETICS.filter((c) => c.shop === shop && !c.reward && slots.includes(c.slot)).map((c) => ({
          id: c.id,
          name: c.name,
          right: on(c) ? 'ON' : owns(c) ? 'YOURS' : `$${c.price}`,
          dim: !owns(c) && store.get().cash < c.price,
        })),
    });
    const tabs: Tab[] =
      shop === 'barber'
        ? [tab('CUTS', ['hair']), tab('COLOUR', ['dye'])]
        : [tab('TOPS', ['top']), tab('LEGS', ['legs', 'shoes']), tab('EXTRAS', ['scarf', 'hat'])];
    return {
      title: shop === 'barber' ? "CLIP JOINT - THE BOOK" : 'THREADS - THE RAILS',
      tabs,
      detail: (id) => {
        const c = cosmeticById(id)!;
        return [
          c.name,
          c.slot === 'dye' ? 'A NEW COLOUR' : c.slot === 'hair' ? 'A NEW CUT' : `FOR YOUR ${c.slot.toUpperCase()}`,
          on(c) ? 'YOU ARE WEARING IT' : owns(c) ? 'YOURS ALREADY - FREE' : `$${c.price}`,
          `YOU HAVE $${store.get().cash}`,
        ];
      },
      preview: (id, at) => {
        const c = cosmeticById(id)!;
        const outfit = { ...(life().outfit as Record<string, string>), [c.slot]: id };
        // a haircut is only seen bare-headed, so the hat comes off for it
        if (c.slot === 'hair' || c.slot === 'dye') outfit.hat = 'cos_no_hat';
        this.drawPerson(outfit, at);
      },
      actions: (id) => {
        const c = cosmeticById(id)!;
        if (on(c)) return [{ label: 'WEARING IT', fn: () => undefined, off: true }];
        if (owns(c)) return [{ label: 'WEAR IT', fn: () => this.wearIt(c) }];
        return [
          {
            label: `BUY & WEAR $${c.price}`,
            fn: () => {
              const r = buyCosmetic(c.id);
              return r.ok ? this.wearIt(c) : r;
            },
            off: store.get().cash < c.price,
          },
        ];
      },
    };
  }

  /** On it goes -- and a haircut takes the hat off, or you would not see it. */
  private wearIt(c: CosmeticDef): Result {
    if (c.slot === 'hair' || c.slot === 'dye') wear('cos_no_hat');
    return wear(c.id);
  }

  private landlordMode(): Mode {
    const life = () => store.get().life;
    const sellable = (): Row[] => {
      const l = life();
      const out: Row[] = [];
      for (const [id, n] of Object.entries(l.furniture)) {
        const v = resaleValue('furniture', id);
        if (v > 0) out.push({ id: `f:${id}`, name: `${furnitureById(id)!.name} x${n}`, right: `$${v}` });
      }
      for (const id of l.wardrobe) {
        const v = resaleValue('cosmetic', id);
        if (v > 0) out.push({ id: `c:${id}`, name: cosmeticById(id)!.name, right: `$${v}` });
      }
      return out;
    };
    return {
      title: "LILY'S CONDOS - LANDLORD",
      tabs: [
        { label: 'RENT', rows: () => [{ id: 'rent', name: `UNIT ${unitNo()}`, right: life().rented ? 'YOURS' : rentToMan() ? 'PRIVATE' : `$${RENT_PRICE}` }] },
        { label: 'SELL THINGS', rows: sellable },
      ],
      detail: (id) => {
        const l = life();
        if (id === 'rent' && rentToMan()) {
          // (213 is let privately: the desk only keeps the keys)
          const d = rentInDays(l);
          return [
            'UNIT 213, SECOND FLOOR',
            'LET PRIVATELY. THE RENT',
            'GOES TO THE MAN OUTSIDE',
            'THE ARCADE, NOT TO ME.',
            l.rented ? (d < 0 ? 'OVERDUE: PAY HIM OR BE EVICTED' : d <= 0 ? `$${RENT_PRICE} DUE TO HIM NOW` : `NEXT RENT IN ${d} DAYS`) : 'SEE HIM TO RENT IT AGAIN.',
          ];
        }
        if (id === 'rent') {
          if (!l.rented && l.debt > 0) {
            return [
              'UNIT 612, SIXTH FLOOR',
              `YOU OWE ${l.debt} UNPAID ${l.debt === 1 ? 'WEEK' : 'WEEKS'}: $${l.debt * RENT_PRICE}`,
              'PAY THE OVERDUE WEEK FIRST,',
              `THEN THIS WEEK: $${RENT_PRICE}.`,
              `YOU HAVE $${store.get().cash}. SELL THINGS TO RAISE IT.`,
            ];
          }
          if (!l.rented) {
            return [
              'UNIT 612, SIXTH FLOOR',
              `$${RENT_PRICE} FOR ${RENT_DAYS} DAYS`,
              'COMES WITH A SLEEPING BAG',
              'AND A WARDROBE. DECORATE IT.',
              l.evicted ? 'YOUR THINGS ARE IN STORAGE.' : '',
            ];
          }
          const d = rentInDays(l);
          return [
            'UNIT 612 IS YOURS',
            d <= 0 ? `RENT OF $${RENT_PRICE} IS DUE NOW` : `NEXT RENT IN ${d} DAYS`,
            d < 0 ? 'OVERDUE: PAY OR BE EVICTED' : '',
            `YOU HAVE $${store.get().cash}`,
            d <= 0 && store.get().cash < RENT_PRICE ? 'SHORT? SELL THINGS, OR MOVE OUT.' : '',
          ];
        }
        const [kind, real] = id.split(':');
        return [kind === 'f' ? furnitureById(real)!.name : cosmeticById(real)!.name, `HE WILL GIVE YOU $${resaleValue(kind === 'f' ? 'furniture' : 'cosmetic', real)}`, 'TO HELP WITH THE RENT'];
      },
      preview: (id, at) => {
        if (id === 'rent') {
          this.drawUnitDoor(at);
          return;
        }
        const [kind, real] = id.split(':');
        if (kind === 'f') {
          const g = this.add.graphics();
          drawFurniture(g, furnitureById(real)!, at.x, at.y, false);
          this.previewBits.push(g);
        } else this.drawPerson({ ...(life().outfit as Record<string, string>), [cosmeticById(real)!.slot]: real }, at);
      },
      actions: (id) => {
        const l = life();
        if (id === 'rent' && rentToMan()) return [];
        if (id === 'rent') {
          // two buttons, one per week: what is owed from before, then this week
          if (!l.rented)
            return [
              ...(l.debt > 0 ? [{ label: `PAY OVERDUE WEEK $${RENT_PRICE}`, fn: () => payDebt() }] : []),
              { label: `PAY THIS WEEK $${RENT_PRICE}`, fn: () => rent(), off: l.debt > 0 },
            ];
          return [
            { label: `PAY THIS WEEK $${RENT_PRICE}`, fn: () => payRent(), off: rentInDays(l) > RENT_DAYS - 1 },
            {
              label: 'MOVE OUT',
              fn: () => {
                evict();
                return { ok: true, msg: 'MOVED OUT. YOUR THINGS ARE IN STORAGE.' };
              },
            },
          ];
        }
        const [kind, real] = id.split(':');
        return [{ label: 'SELL', fn: () => sellAsset(kind === 'f' ? 'furniture' : 'cosmetic', real) }];
      },
    };
  }
}
