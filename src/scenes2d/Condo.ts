/**
 * ---- UNIT 612, LILY'S CONDOS.  Yours for as long as the rent is paid.
 *
 * It comes empty: a window, its curtains, bare boards.  Everything else is
 * what you buy and put there -- DECORATE places, moves, turns and takes
 * away what you own, and the room keeps it exactly where you left it.  The
 * PANTRY is what you have to eat and drink; COOK uses its ingredients; the
 * WARDROBE changes what you wear; SLEEP is on the floor until there is
 * something better to sleep on.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { button, centerText, fadeIn, fadeToScene, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import { TokenHud } from '../ui/hud';
import { attachPockets } from '../ui/pockets';
import { Player } from '../art/player';
import { drawFurniture } from '../art/furnitureArt';
import { furnitureById, type FurnitureDef } from '../game/catalog';
import { clock, cookingLeft, movePlacement, placeFurniture, removePlacement, sleep, visit, type Placement } from '../game/life';
import { recipeById } from '../game/catalog';
import { froggyLayer } from '../render/froggyLayer';

const FLOOR_TOP = 124;
const FLOOR_BOTTOM = 160; // (the button bar starts just below)
const WALL_TOP = 28;
const WALL_BOTTOM = 112;
const WINDOW = { x: 118, y: 34, w: 84, h: 62 };

export class Condo extends Phaser.Scene {
  private room!: Phaser.GameObjects.Graphics;
  private furn!: Phaser.GameObjects.Graphics;
  private ui!: Phaser.GameObjects.Container;
  private player!: Player;
  private decorating = false;
  private picked: number | null = null;
  private dragging = false;
  private dragFrom: { x: number; y: number } | null = null;
  private msg!: Phaser.GameObjects.BitmapText;
  private locked = false;
  private hobText!: Phaser.GameObjects.BitmapText;

  constructor() {
    super('Condo');
  }

  create(): void {
    froggyLayer.clear();
    this.decorating = false;
    this.picked = null;
    this.locked = false;
    fadeIn(this);
    audio.setScene({ music: 'room_lounge', ambience: [] });
    visit('condo');

    this.room = this.add.graphics().setDepth(0);
    this.furn = this.add.graphics().setDepth(10);
    this.paintRoom();
    this.player = new Player(this, 40, 166);
    this.player.sprite.setDepth(20);

    new TokenHud(this);
    attachPockets(this, () => this.locked || this.busy());
    this.msg = centerText(this, GAME_W / 2, 118, '', PALETTE.cream).setDepth(900);
    this.hobText = text(this, GAME_W - 8, 40, '', PALETTE.gold).setOrigin(1, 0).setDepth(900);
    this.ui = this.add.container(0, 0).setDepth(800);
    this.buildButtons();
    this.drawFurniture();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.pointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.pointerMove(p));
    this.input.on('pointerup', () => this.pointerUp());
    this.events.on('shop-closed', () => {
      this.locked = false;
      // what you wear may have changed
      this.player.sprite.destroy();
      this.player = new Player(this, this.player.x, 166);
      this.player.sprite.setDepth(20);
      this.drawFurniture();
    });
  }

  private busy(): boolean {
    return this.scene.isActive('Shop') || this.scene.isActive('SettingsModal') || this.scene.isActive('Goals');
  }

  private say(m: string): void {
    this.msg.setText(m).setAlpha(1);
    this.tweens.killTweensOf(this.msg);
    this.tweens.add({ targets: this.msg, alpha: 0, delay: 2200, duration: 500 });
  }

  // ----------------------------------------------------------------- room

  private paintRoom(): void {
    const g = this.room;
    g.clear();
    const c = clock();
    // the wall: plain plaster, a dado rail, the skirting
    g.fillStyle(0xcfc2a8, 1).fillRect(0, 0, GAME_W, FLOOR_TOP);
    g.fillStyle(0xbfb196, 1).fillRect(0, 0, GAME_W, 8);
    for (let x = 0; x < GAME_W; x += 6) g.fillStyle(0xc6b99e, 1).fillRect(x, 8, 1, FLOOR_TOP - 8);
    g.fillStyle(0x8a7a5e, 1).fillRect(0, FLOOR_TOP - 6, GAME_W, 6);
    g.fillStyle(0x6a5a42, 1).fillRect(0, FLOOR_TOP - 1, GAME_W, 1);
    // the floor: bare boards
    for (let y = FLOOR_TOP; y < GAME_H; y += 5) {
      g.fillStyle(y % 10 === 0 ? 0x8a6440 : 0x7e5a38, 1).fillRect(0, y, GAME_W, 5);
      g.fillStyle(0x5a3e24, 1).fillRect(0, y, GAME_W, 1);
      for (let x = (y * 7) % 40; x < GAME_W; x += 40) g.fillStyle(0x5a3e24, 1).fillRect(x, y, 1, 5);
    }
    // the window: what time it is outside
    const W = WINDOW;
    const sky = c.dark ? 0x10183a : c.hour < 9 || c.hour >= 18 ? 0xe89858 : 0x7ac0e8;
    g.fillStyle(0x14100c, 1).fillRect(W.x - 3, W.y - 3, W.w + 6, W.h + 6);
    g.fillStyle(0xe8e0d0, 1).fillRect(W.x - 2, W.y - 2, W.w + 4, W.h + 4);
    g.fillStyle(sky, 1).fillRect(W.x, W.y, W.w, W.h);
    // the city beyond
    for (let i = 0; i < 9; i++) {
      const bx = W.x + i * 10;
      const bh = 10 + ((i * 37) % 26);
      g.fillStyle(c.dark ? 0x0a0e1c : 0x5a6a80, 1).fillRect(bx, W.y + W.h - bh, 9, bh);
      if (c.dark) for (let k = 0; k < 4; k++) if ((i + k) % 3) g.fillStyle(0xf0d070, 1).fillRect(bx + 2 + (k % 2) * 4, W.y + W.h - bh + 3 + Math.floor(k / 2) * 5, 2, 2);
    }
    g.fillStyle(0xe8e0d0, 1).fillRect(W.x + W.w / 2 - 1, W.y, 2, W.h).fillRect(W.x, W.y + W.h / 2 - 1, W.w, 2);
    g.fillStyle(0xd8d0c0, 1).fillRect(W.x - 6, W.y + W.h + 2, W.w + 12, 3);
    // the curtains, and their rail
    g.fillStyle(0x3a3a3a, 1).fillRect(W.x - 22, W.y - 8, W.w + 44, 2);
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? W.x - 20 : W.x + W.w + 4;
      for (let k = 0; k < 16; k += 2) {
        g.fillStyle(k % 4 ? 0x7b2a3a : 0x8e3a4a, 1).fillRect(x0 + k, W.y - 6, 2, W.h + 14);
      }
    }
    // the door you came in by
    g.fillStyle(0x14100c, 1).fillRect(5, 58, 26, 66);
    g.fillStyle(0x6a4a2a, 1).fillRect(6, 59, 24, 65);
    g.fillStyle(0xd8a838, 1).fillRect(26, 92, 2, 2);
    g.fillStyle(0x14100c, 1);
    g.lineStyle(1, 0x14100c, 1);
  }

  private placements(): Placement[] {
    return store.get().life.placed;
  }

  private rectOf(p: Placement, f = furnitureById(p.id)!): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(p.x - f.w / 2, p.y - f.h, f.w, f.h);
  }

  /** Can `f` stand at (x, y) without floating, clipping, or covering the window? */
  private valid(f: FurnitureDef, x: number, y: number, uid: number | null): boolean {
    const r = new Phaser.Geom.Rectangle(x - f.w / 2, y - f.h, f.w, f.h);
    if (r.x < 4 || r.right > GAME_W - 4) return false;
    if (f.wall) {
      if (r.y < WALL_TOP || r.bottom > WALL_BOTTOM) return false;
      if (Phaser.Geom.Intersects.RectangleToRectangle(r, new Phaser.Geom.Rectangle(WINDOW.x - 22, WINDOW.y - 8, WINDOW.w + 44, WINDOW.h + 16))) return false;
    } else {
      if (y < FLOOR_TOP + 6 || y > FLOOR_BOTTOM) return false;
      if (r.x < 34 && y < FLOOR_TOP + 20) return false; // not in front of the door
    }
    for (const p of this.placements()) {
      if (p.uid === uid) continue;
      const o = furnitureById(p.id);
      if (!o || o.wall !== f.wall) continue;
      // rugs lie under things; nothing else shares a footprint
      if (!f.wall && (o.cat === 'rug' || f.cat === 'rug')) continue;
      const or = this.rectOf(p, o);
      if (!f.wall) {
        // floor items collide on their FOOTPRINT: the bottom few pixels
        const fa = new Phaser.Geom.Rectangle(r.x, y - 6, r.width, 6);
        const fb = new Phaser.Geom.Rectangle(or.x, p.y - 6, or.width, 6);
        if (Phaser.Geom.Intersects.RectangleToRectangle(fa, fb)) return false;
      } else if (Phaser.Geom.Intersects.RectangleToRectangle(r, or)) return false;
    }
    return true;
  }

  private drawFurniture(): void {
    const g = this.furn;
    g.clear();
    const list = [...this.placements()].sort((a, b) => {
      const fa = furnitureById(a.id)!;
      const fb = furnitureById(b.id)!;
      // wall things, then rugs, then the rest back to front
      const ka = fa.wall ? 0 : fa.cat === 'rug' ? 1 : 2;
      const kb = fb.wall ? 0 : fb.cat === 'rug' ? 1 : 2;
      return ka - kb || a.y - b.y;
    });
    for (const p of list) {
      const f = furnitureById(p.id);
      if (!f) continue;
      drawFurniture(g, f, p.x, p.y, p.flip);
      if (this.decorating && p.uid === this.picked) {
        const r = this.rectOf(p, f);
        g.lineStyle(1, this.valid(f, p.x, p.y, p.uid) ? 0x7fd88a : 0xff5040, 1).strokeRect(r.x - 2, r.y - 2, r.width + 4, r.height + 4);
      }
    }
  }

  // ------------------------------------------------------------- buttons

  private buildButtons(): void {
    this.ui.removeAll(true);
    const y = 176;
    if (this.decorating) {
      const l = store.get().life;
      const unplaced = Object.entries(l.furniture).filter(([id, n]) => n > l.placed.filter((p) => p.id === id).length);
      this.ui.add(this.add.rectangle(0, GAME_H - 17, GAME_W, 17, PALETTE.black, 0.8).setOrigin(0, 0));
      this.ui.add(button(this, 34, y - 6, unplaced.length ? `PLACE (${unplaced.length})` : 'NOTHING TO PLACE', () => this.placeNext(), { width: 62, height: 11, disabled: !unplaced.length }));
      this.ui.add(button(this, 100, y - 6, 'FLIP', () => this.flipPicked(), { width: 40, height: 11, disabled: this.picked === null }));
      this.ui.add(button(this, 148, y - 6, 'REMOVE', () => this.removePicked(), { width: 48, height: 11, disabled: this.picked === null }));
      this.ui.add(button(this, 284, y - 6, 'DONE', () => this.setDecorating(false), { width: 50, height: 11 }));
      this.ui.add(text(this, 176, y - 9, 'DRAG TO MOVE', PALETTE.ash));
      return;
    }
    const acts: Array<[string, () => void]> = [
      ['DECORATE', () => this.setDecorating(true)],
      ['COOK', () => this.open('cook')],
      ['PANTRY', () => this.open('pantry')],
      ['WARDROBE', () => this.open('wardrobe')],
      ['SLEEP', () => this.goToSleep()],
      ['LEAVE', () => this.leave()],
    ];
    const bw = 50;
    acts.forEach(([label, fn], i) => this.ui.add(button(this, 4 + bw / 2 + i * (bw + 2), y - 6, label, fn, { width: bw, height: 11 })));
  }

  private open(kind: 'cook' | 'pantry' | 'wardrobe'): void {
    if (this.busy()) return;
    this.locked = true;
    this.scene.launch('Shop', { kind, from: 'Condo' });
  }

  private setDecorating(on: boolean): void {
    this.decorating = on;
    this.picked = null;
    this.buildButtons();
    this.drawFurniture();
    if (on) this.say(store.get().life.placed.length ? 'TAP SOMETHING TO PICK IT UP.' : 'BUY FURNITURE AT HOME AND HEARTH, EAST OF THE ARCADE.');
  }

  /** The next owned piece that is not out yet, set down somewhere free. */
  private placeNext(): void {
    const l = store.get().life;
    const entry = Object.entries(l.furniture).find(([id, n]) => n > l.placed.filter((p) => p.id === id).length);
    if (!entry) return;
    const f = furnitureById(entry[0])!;
    const tries: Array<[number, number]> = [];
    // from the middle of the room outwards, and clear of the HUD in the top corner
    const mid = (x: number): number => Math.abs(x - GAME_W / 2);
    if (f.wall) for (let y = Math.max(WALL_TOP + f.h + 4, 44 + f.h); y <= WALL_BOTTOM; y += 10) for (let x = 30; x < GAME_W - 20; x += 12) tries.push([x, y]);
    else for (let y = FLOOR_BOTTOM - 4; y > FLOOR_TOP + 6; y -= 8) for (let x = 40; x < GAME_W - 20; x += 10) tries.push([x, y]);
    tries.sort((a, b) => (f.wall ? mid(a[0]) - mid(b[0]) || a[1] - b[1] : b[1] - a[1] || mid(a[0]) - mid(b[0])));
    const spot = tries.find(([x, y]) => this.valid(f, x, y, null));
    if (!spot) {
      this.say('NO ROOM FOR THAT. MOVE SOMETHING FIRST.');
      return;
    }
    const r = placeFurniture(f.id, spot[0], spot[1]);
    this.say(r.msg);
    this.picked = store.get().life.placed[store.get().life.placed.length - 1]?.uid ?? null;
    this.buildButtons();
    this.drawFurniture();
  }

  private flipPicked(): void {
    const p = this.placements().find((q) => q.uid === this.picked);
    if (!p) return;
    movePlacement(p.uid, p.x, p.y, !p.flip);
    this.drawFurniture();
  }

  private removePicked(): void {
    if (this.picked === null) return;
    removePlacement(this.picked);
    this.picked = null;
    this.say('PUT AWAY. IT IS STILL YOURS.');
    this.buildButtons();
    this.drawFurniture();
  }

  private pointerDown(p: Phaser.Input.Pointer): void {
    if (!this.decorating || this.busy() || p.y > GAME_H - 18) return;
    // the frontmost thing under the finger
    const hit = [...this.placements()]
      .reverse()
      .find((q) => Phaser.Geom.Rectangle.Contains(this.rectOf(q), p.worldX, p.worldY));
    this.picked = hit ? hit.uid : null;
    this.dragging = !!hit;
    this.dragFrom = hit ? { x: hit.x, y: hit.y } : null;
    this.buildButtons();
    this.drawFurniture();
  }

  private pointerMove(p: Phaser.Input.Pointer): void {
    if (!this.dragging || this.picked === null || !p.isDown) return;
    const q = this.placements().find((x) => x.uid === this.picked);
    if (!q) return;
    const f = furnitureById(q.id)!;
    // the base follows the finger; it never leaves the floor (or the wall)
    const y = Math.round(f.wall ? Phaser.Math.Clamp(p.worldY + f.h / 2, WALL_TOP + f.h, WALL_BOTTOM) : Phaser.Math.Clamp(p.worldY + f.h / 2, FLOOR_TOP + 6, FLOOR_BOTTOM));
    const x = Math.round(Phaser.Math.Clamp(p.worldX, 4 + f.w / 2, GAME_W - 4 - f.w / 2));
    movePlacement(q.uid, x, y);
    this.drawFurniture();
  }

  private pointerUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    const q = this.placements().find((x) => x.uid === this.picked);
    if (!q || !this.dragFrom) return;
    // let go somewhere it cannot be: back where it was
    if (!this.valid(furnitureById(q.id)!, q.x, q.y, q.uid)) {
      movePlacement(q.uid, this.dragFrom.x, this.dragFrom.y);
      this.say('IT CANNOT GO THERE.');
      audio.sfx('buzzer', 0.4);
    }
    this.drawFurniture();
  }

  // ------------------------------------------------------------ sleeping

  private goToSleep(): void {
    if (this.busy() || this.locked) return;
    const placed = this.placements().map((p) => furnitureById(p.id)!);
    const on = placed.some((f) => f.id === 'fur_bed') ? 'bed' : placed.some((f) => f.id === 'fur_mattress') ? 'mattress' : 'floor';
    this.locked = true;
    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.time.delayedCall(1000, () => {
      const r = sleep(on);
      this.paintRoom();
      this.cameras.main.fadeIn(900, 0, 0, 0);
      this.say(`${on === 'floor' ? 'ON THE FLOOR. ' : ''}${r.msg}`);
      this.locked = false;
    });
  }

  private leave(): void {
    if (this.busy() || this.locked) return;
    this.locked = true;
    audio.sfx('door_open', 0.6);
    fadeToScene(this, 'Hotel', { area: 'lobby', from: 'lift' });
  }

  update(): void {
    // evicted while standing in it (the grace day ran out): shown the door
    if (!store.get().life.rented && !this.locked) {
      this.locked = true;
      this.say('THE LANDLORD IS AT THE DOOR. YOU HAVE TO GO.');
      this.time.delayedCall(1800, () => fadeToScene(this, 'Hotel', { area: 'lobby', from: 'lift' }));
    }
    const left = cookingLeft();
    const c = store.get().life.cooking;
    this.hobText.setText(c ? `COOKING ${recipeById(c.recipe)?.name ?? ''} ${Math.ceil(left)}S` : '');
  }
}
