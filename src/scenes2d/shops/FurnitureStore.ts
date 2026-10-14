/**
 * ---- HOME AND HEARTH, inside.  A long showroom: pictures hung along the
 * back wall, everything else standing on the floor in two rows with a price
 * card in front of it, rugs laid flat between.  Walk up to a piece and [E]:
 * what it is, what it costs, how many you own -- BUY it, and try it where it
 * can be tried (sit on the chairs and sofas, lie on the beds, switch the TVs
 * and lamps on, play the radios).  What you buy goes to your condo.
 */

import Phaser from 'phaser';
import { PALETTE } from '../../render/palette';
import { audio } from '../../core/audio';
import { store } from '../../core/state';
import { text } from '../../core/ui';
import { GAME_H } from '../../render/pixelScaler';
import { Player, depthFor } from '../../art/player';
import { drawFurniture } from '../../art/furnitureArt';
import { FURNITURE, type FurnitureDef } from '../../game/catalog';
import { buyFurniture, record } from '../../game/life';
import { VERB_LABEL, useOf } from '../../game/furnitureUse';
import { FLOOR_TOP, WalkRoom, type Fixture } from '../rooms/WalkRoom';
import { Piece } from '../rooms/piece';

const BACK_ROW = FLOOR_TOP + 24;
const FRONT_ROW = FLOOR_TOP + 54;
const WALL_FOOT = FLOOR_TOP - 20;

export class FurnitureStore extends WalkRoom {
  private pieces = new Map<string, Piece>();

  constructor() {
    super('FurnitureStore');
  }

  protected music(): string {
    return 'room_lounge';
  }

  protected entered(): void {
    record('shop_visit');
  }

  protected leave(): void {
    this.exitTo('StreetEast', { atShop: 'furniture' });
  }

  /** Where everything stands.  Laid out once from the catalogue. */
  private layout(): Array<{ def: FurnitureDef; x: number; y: number }> {
    const forSale = FURNITURE.filter((f) => !f.reward && f.price > 0);
    const out: Array<{ def: FurnitureDef; x: number; y: number }> = [];
    let wx = 70;
    for (const f of forSale.filter((x) => x.wall)) {
      out.push({ def: f, x: wx + f.w / 2, y: WALL_FOOT });
      wx += f.w + 26;
    }
    // the floor: tall things at the back, low ones and rugs in front
    const floor = forSale.filter((x) => !x.wall);
    const back = floor.filter((f) => f.h >= 14 && f.cat !== 'rug');
    const front = floor.filter((f) => !back.includes(f));
    for (const [row, y] of [[back, BACK_ROW], [front, FRONT_ROW]] as const) {
      let x = 56;
      for (const f of row) {
        // (room for the price card under the narrow ones too)
        const w = Math.max(f.w, 26);
        out.push({ def: f, x: x + w / 2, y });
        x += w + 16;
      }
    }
    return out;
  }

  protected paintRoom(): void {
    this.pieces.clear();
    const all = this.layout();
    this.worldW = Math.max(480, Math.ceil(Math.max(...all.map((p) => p.x + p.def.w / 2)) + 40));
    this.bounds.width = this.worldW - 20;
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
    text(this, W / 2, 12, 'HOME AND HEARTH', 0x7a3a22).setOrigin(0.5, 0).setDepth(1);
    text(this, W / 2, 22, 'FURNITURE FOR EVERY ROOM', 0x9a7a58).setOrigin(0.5, 0).setDepth(1);

    // the counter at the far end, and the woman who runs the place behind it
    const cx = W - 38;
    const keeper = new Player(this, cx, FLOOR_TOP + 22, false, {
      cols: { C: 0x8a3a5a, c: 0xa04a6a, D: 0x6a2a44, r: 0x6a4a3a, S: 0xe8c8a8, s: 0xc8a080, G: 0xe8c8a8, g: 0xc8a080, w: 0xf0e0c8, J: 0x3a3a48, j: 0x2a2a38, B: 0x6a4a3a, b: 0x6a4a3a },
      head: ['....rrrr....', '...rrrrrr...', '..rrrrrrrr..', '..rSSSSSSr..', '.rrSSSSSSsr.', '.rrSSSSSsrr.', '..rSSSSSsr..', '....SSSs....', '.....ss.....'],
    });
    keeper.sprite.setScale(-1, 1);
    const cg = this.add.graphics().setDepth(depthFor(FLOOR_TOP + 23));
    cg.fillStyle(0x14100c, 1).fillRect(cx - 24, FLOOR_TOP + 8, 48, 18);
    cg.fillStyle(0x7a4a28, 1).fillRect(cx - 23, FLOOR_TOP + 9, 46, 16);
    cg.fillStyle(0x9a6a3a, 1).fillRect(cx - 23, FLOOR_TOP + 9, 46, 3);
    cg.fillStyle(0xd8a838, 1).fillRect(cx - 4, FLOOR_TOP + 5, 8, 4);

    for (const p of all) {
      const piece = new Piece(this, p.def, p.x, p.y);
      this.pieces.set(p.def.id, piece);
      // the price card, on the floor in front (or under a picture)
      const ty = p.def.wall ? p.y + 3 : p.y + 2;
      text(this, p.x, ty, `$${p.def.price}`, p.def.wall ? 0x5a3a22 : PALETTE.cream)
        .setOrigin(0.5, 0)
        .setDepth(p.def.wall ? 2 : depthFor(p.y) + 0.0002);
    }
    this.layoutCache = all;
  }

  private layoutCache: Array<{ def: FurnitureDef; x: number; y: number }> = [];

  protected fixtures(): Fixture[] {
    const cx = this.worldW - 38;
    const counter: Fixture = {
      x: cx,
      y: FLOOR_TOP + 26,
      w: 48,
      depth: 18,
      label: () => '[E] TALK',
      use: () => this.talkAs('keeper', '"HAVE A LOOK ROUND, LOVE. ANYTHING YOU BUY GOES STRAIGHT TO YOUR PLACE."'),
    };
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

  private show(def: FurnitureDef): void {
    const l = store.get().life;
    const owned = l.furniture[def.id] ?? 0;
    const verb = useOf(def);
    const piece = this.pieces.get(def.id)!;
    const lines = [
      def.note,
      `$${def.price}   ${def.cat.toUpperCase()}${def.wall ? ' (WALL)' : ''}`,
      owned ? `YOU OWN ${owned}` : 'YOU DO NOT OWN ONE',
      l.rented ? 'PLACE IT FROM DECORATE AT HOME' : 'RENT A CONDO AT LILY\'S TO USE IT',
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
    if (verb) {
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
      this.sitOn(piece.x - def.w / 4, piece.y + 1, 'floor', 1);
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
