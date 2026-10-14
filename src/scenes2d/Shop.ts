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
import {
  COSMETICS,
  evict,
  payRent,
  rent,
  rentInDays,
  resaleValue,
  sellAsset,
  wear,
  RENT_DAYS,
  RENT_PRICE,
  type Result,
} from '../game/life';
import { cosmeticById, furnitureById, lookFor, type CosmeticSlot } from '../game/catalog';

/** The shops themselves are rooms now (scenes2d/shops); this is the landlord's desk and your wardrobe. */
export type ShopKind = 'landlord' | 'wardrobe';

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

  init(data: { kind?: ShopKind; from?: string }): void {
    this.kind = data.kind ?? 'wardrobe';
    this.from = data.from ?? '';
    this.tab = 0;
    this.sel = 0;
    this.top = 0;
    this.msg = '';
  }

  create(): void {
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
      this.mode.detail(r.id).forEach((line, i) => L.add(text(this, PREV_X, 92 + i * 9, line, i === 0 ? PALETTE.gold : PALETTE.cream)));
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

  private drawIcon(col: number, at: { x: number; y: number }, round = false): void {
    const g = this.add.graphics();
    g.fillStyle(0x14100c, 1);
    if (round) g.fillCircle(at.x, at.y - 22, 13);
    else g.fillRect(at.x - 12, at.y - 36, 24, 26);
    g.fillStyle(col, 1);
    if (round) g.fillCircle(at.x, at.y - 22, 12);
    else g.fillRect(at.x - 11, at.y - 35, 22, 24);
    g.fillStyle(0xffffff, 0.25).fillRect(at.x - 9, at.y - 33, 6, 3);
    this.previewBits.push(g);
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

      case 'landlord':
      default:
        return this.landlordMode();
    }
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
        { label: 'RENT', rows: () => [{ id: 'rent', name: 'UNIT 612', right: life().rented ? 'YOURS' : `$${RENT_PRICE}` }] },
        { label: 'SELL THINGS', rows: sellable },
      ],
      detail: (id) => {
        const l = life();
        if (id === 'rent') {
          if (!l.rented) {
            return [
              'UNIT 612, SIXTH FLOOR',
              `$${RENT_PRICE} FOR ${RENT_DAYS} DAYS`,
              'EMPTY: A WINDOW AND CURTAINS.',
              'SLEEP AND DECORATE.',
              l.evicted ? 'YOUR THINGS ARE IN STORAGE.' : '',
            ];
          }
          const d = rentInDays(l);
          return ['UNIT 612 IS YOURS', d <= 0 ? `RENT OF $${RENT_PRICE} IS DUE NOW` : `NEXT RENT IN ${d} DAYS`, d < 0 ? 'OVERDUE: PAY OR BE EVICTED' : '', `YOU HAVE $${store.get().cash}`];
        }
        const [kind, real] = id.split(':');
        return [kind === 'f' ? furnitureById(real)!.name : cosmeticById(real)!.name, `HE WILL GIVE YOU $${resaleValue(kind === 'f' ? 'furniture' : 'cosmetic', real)}`, 'TO HELP WITH THE RENT'];
      },
      preview: (id, at) => {
        if (id === 'rent') {
          this.drawIcon(0x7b2a3a, at);
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
        if (id === 'rent') {
          if (!l.rented) return [{ label: `RENT - $${RENT_PRICE}`, fn: () => rent() }];
          return [
            { label: 'PAY RENT', fn: () => payRent(), off: rentInDays(l) > RENT_DAYS - 1 },
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
