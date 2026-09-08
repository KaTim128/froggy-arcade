/**
 * Profiles.  Up to three named runs, each with its own save.
 *
 * The arcade only ever had one anonymous save, so there was no way to start
 * over or to keep two runs apart — you were stuck wherever your last run had
 * left the route, with cabinets silently refusing to open.
 *
 * Deleting is the destructive one, so it asks twice.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store, MAX_SLOTS, MAX_NAME_LEN, type SlotMeta } from '../core/state';
import { button, centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';

const ROW_Y = [56, 86, 116];

export class ProfileModal extends Phaser.Scene {
  private from = 'StartScreen';
  private body!: Phaser.GameObjects.Container;
  private naming = false;
  private draft = '';
  /** Which delete button is one click from actually deleting. */
  private confirmingDelete: string | null = null;

  constructor() {
    super('ProfileModal');
  }

  init(data: { from?: string }): void {
    this.from = data?.from ?? 'StartScreen';
    this.naming = false;
    this.draft = '';
    this.confirmingDelete = null;
  }

  create(): void {
    // Scene draw order follows the registration list, and this modal sits near
    // the front of it — so anything launching it from a later scene would render
    // on top of it.  A modal has to be on top wherever it is opened from.
    this.scene.bringToTop();
    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black, 0.82).setOrigin(0, 0).setInteractive();
    this.add.rectangle(GAME_W / 2, GAME_H / 2, 250, 150, PALETTE.ink).setStrokeStyle(1, PALETTE.neon);
    centerText(this, GAME_W / 2, 26, 'PROFILES', PALETTE.gold, 8);

    this.body = this.add.container(0, 0);
    this.render();

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
  }

  // ------------------------------------------------------------------ rendering

  private render(): void {
    this.body.removeAll(true);
    if (this.naming) this.renderNaming();
    else this.renderList();
  }

  private renderList(): void {
    const slots = store.listSlots();
    const active = store.activeSlotId();

    for (let i = 0; i < MAX_SLOTS; i++) {
      const y = ROW_Y[i];
      const slot = slots[i];
      const plate = this.add
        .rectangle(44, y - 3, 232, 26, PALETTE.slate, slot ? 0.45 : 0.2)
        .setOrigin(0, 0)
        .setStrokeStyle(1, slot && slot.id === active ? PALETTE.gold : PALETTE.steel);
      this.body.add(plate);

      if (slot) this.renderSlot(slot, y, slot.id === active);
      else this.renderEmpty(y);
    }

    this.body.add(
      button(this, GAME_W / 2, 152, 'BACK', () => this.close(), { width: 60, height: 13 }),
    );
  }

  private renderSlot(slot: SlotMeta, y: number, isActive: boolean): void {
    const s = store.slotSummary(slot.id);
    this.body.add(text(this, 52, y + 2, slot.name, isActive ? PALETTE.gold : PALETTE.cream));
    this.body.add(text(this, 52, y + 12, describe(s), PALETTE.ash).setAlpha(0.85));

    this.body.add(
      button(this, 216, y + 10, isActive ? 'RESUME' : 'PLAY', () => this.play(slot.id), {
        width: 46,
        height: 13,
      }),
    );

    const armed = this.confirmingDelete === slot.id;
    this.body.add(
      button(this, 258, y + 10, armed ? 'SURE?' : 'DEL', () => this.remove(slot.id), {
        width: 32,
        height: 13,
        fill: armed ? PALETTE.blood : PALETTE.plum,
      }),
    );
  }

  private renderEmpty(y: number): void {
    this.body.add(centerText(this, 130, y + 10, '- EMPTY -', PALETTE.steel));
    this.body.add(
      button(this, 237, y + 10, 'NEW', () => this.beginNaming(), { width: 53, height: 13 }),
    );
  }

  private renderNaming(): void {
    this.body.add(centerText(this, GAME_W / 2, 60, 'NAME YOUR RUN', PALETTE.cream));

    this.body.add(this.add.rectangle(GAME_W / 2, 88, 160, 18, PALETTE.black, 0.6).setStrokeStyle(1, PALETTE.gold));
    // A block caret rather than a thin bar — at this size a 1px line reads as dirt.
    const shown = this.draft + (Math.floor(this.time.now / 400) % 2 === 0 ? '_' : ' ');
    this.body.add(centerText(this, GAME_W / 2, 88, shown || '_', PALETTE.gold));

    this.body.add(
      centerText(this, GAME_W / 2, 112, `LETTERS AND NUMBERS, UP TO ${MAX_NAME_LEN}`, PALETTE.ash).setAlpha(0.8),
    );
    this.body.add(centerText(this, GAME_W / 2, 126, 'ENTER TO CONFIRM', PALETTE.ash).setAlpha(0.8));

    this.body.add(
      button(this, 120, 152, 'CANCEL', () => this.cancelNaming(), { width: 60, height: 13 }),
    );
    this.body.add(
      button(this, 200, 152, 'CREATE', () => this.commitName(), { width: 60, height: 13 }),
    );
  }

  // -------------------------------------------------------------------- actions

  private beginNaming(): void {
    this.naming = true;
    this.draft = '';
    this.confirmingDelete = null;
    audio.sfx('ui_blip');
    this.render();
  }

  private cancelNaming(): void {
    this.naming = false;
    this.draft = '';
    this.render();
  }

  private commitName(): void {
    const id = store.createSlot(this.draft);
    this.naming = false;
    this.draft = '';
    if (id) {
      audio.sfx('coin_spin');
      this.close();
    } else {
      this.render();
    }
  }

  private play(id: string): void {
    store.selectSlot(id);
    audio.sfx('ui_blip');
    this.close();
  }

  private remove(id: string): void {
    if (this.confirmingDelete !== id) {
      this.confirmingDelete = id;
      audio.sfx('buzzer');
      this.render();
      return;
    }
    store.deleteSlot(id);
    this.confirmingDelete = null;
    audio.sfx('coin_drop');
    this.render();
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.naming) {
      if (e.key === 'Escape') this.close();
      return;
    }

    if (e.key === 'Enter') {
      this.commitName();
      return;
    }
    if (e.key === 'Escape') {
      this.cancelNaming();
      return;
    }
    if (e.key === 'Backspace') {
      this.draft = this.draft.slice(0, -1);
      this.render();
      return;
    }
    if (e.key.length === 1 && /[A-Za-z0-9 ]/.test(e.key) && this.draft.length < MAX_NAME_LEN) {
      this.draft += e.key.toUpperCase();
      audio.sfx('dialogue_blip');
      this.render();
    }
  }

  private close(): void {
    store.flush();
    this.scene.get(this.from)?.events.emit('profiles-closed');
    this.scene.stop();
  }

  update(): void {
    // Only the caret needs the frame, and only while typing.
    if (this.naming) this.render();
  }
}

function describe(s: ReturnType<typeof store.slotSummary>): string {
  if (s.route === 'ended') return 'FINISHED';
  if (s.route !== 'normal') return 'IN THE DARK';
  if (!s.seenIntro) return 'NEW RUN';
  return `${s.tokens} TOK - ${s.played} PLAYED`;
}
