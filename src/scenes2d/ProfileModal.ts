/**
 * Profiles.  Up to three named runs, each with its own save.
 *
 * The arcade only ever had one anonymous save, so there was no way to start
 * over or to keep two runs apart — you were stuck wherever your last run had
 * left the route, with cabinets silently refusing to open.
 *
 * Deleting is the destructive one, so it asks twice.
 *
 * NAMING A RUN HAS ITS OWN KEYBOARD.  Not because a desktop lacks one, but
 * because a phone's keyboard is a system panel that slides up over half the
 * screen and types into a text field this game does not have — and because a
 * player on a controller, a tablet or a kiosk has nothing to type with at all.
 * The one drawn here is the same on every device: letters in both cases,
 * digits, space, BACK, CLEAR and OK, all of them ordinary tappable rectangles.
 * The physical keyboard keeps working alongside it and neither knows about the
 * other — both of them only ever append to or trim the same draft string.
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
  /** The name being typed, kept so the caret can blink without a rebuild. */
  private draftText: Phaser.GameObjects.BitmapText | null = null;
  /** Which delete button is one click from actually deleting. */
  private confirmingDelete: string | null = null;
  /** The on-screen keyboard's case latch, and the keys that follow it. */
  private shift = true;
  private letterKeys: Array<{ ch: string; label: Phaser.GameObjects.BitmapText }> = [];
  private shiftKey: Phaser.GameObjects.BitmapText | null = null;
  /**
   * The DOM events this scene has already acted on.
   *
   * PHASER CAN HAND THE SAME KeyboardEvent OVER MORE THAN ONCE.  Its manager
   * queues the native events and each scene's plugin drains that queue on its
   * own update, so a key pressed while more than one scene is running arrives
   * two or three times — the SAME object, same `timeStamp`, not a repeat and
   * not a second press.  Every other scene in the building binds
   * `keydown-<KEY>` and only cares that a key went down, so none of them ever
   * noticed; a name box cares very much, and typed KAI as KKKAAAIII.
   *
   * A set rather than one slot: the replays interleave (Shift, K, Shift, K,
   * Shift, K), so remembering only the previous event lets every other copy
   * through.  It is weak, so an event is forgotten the moment the browser is
   * finished with it and nothing here grows.
   */
  private seenKeys = new WeakSet<KeyboardEvent>();

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
    this.draftText = null;
    this.letterKeys = [];
    this.shiftKey = null;
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
    // The naming view needs the whole modal, so it gets its own backing panel
    // over the list's narrower one.
    this.body.add(
      this.add.rectangle(GAME_W / 2, GAME_H / 2, 300, 168, PALETTE.ink).setStrokeStyle(1, PALETTE.neon),
    );
    this.body.add(centerText(this, GAME_W / 2, 24, 'NAME YOUR RUN', PALETTE.cream));

    this.body.add(this.add.rectangle(GAME_W / 2, 40, 150, 15, PALETTE.black, 0.6).setStrokeStyle(1, PALETTE.gold));
    this.draftText = centerText(this, GAME_W / 2, 41, '', PALETTE.gold);
    this.body.add(this.draftText);
    this.syncDraft();

    this.renderKeyboard();

    this.body.add(centerText(this, GAME_W / 2, 168, `UP TO ${MAX_NAME_LEN} CHARACTERS`, PALETTE.ash).setAlpha(0.7));
  }

  /**
   * The keyboard.
   *
   * Four rows of keys on a ten-column grid, then the three that are not
   * letters.  SHIFT is a latch rather than a hold, because a key you have to
   * keep a finger on is a key you cannot use with the other thumb — and every
   * letter key repaints itself in the case it is currently going to type, so
   * what is on the key is what you get.
   */
  private renderKeyboard(): void {
    const rows = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    const KW = 26;
    const KH = 15;
    const GAP = 2;
    this.letterKeys = [];

    rows.forEach((row, r) => {
      const y = 58 + r * (KH + GAP);
      const w = row.length * (KW + GAP) - GAP;
      const x0 = Math.round((GAME_W - w) / 2);
      [...row].forEach((ch, i) => {
        const key = this.key(x0 + i * (KW + GAP), y, KW, KH, ch, () => this.type(ch));
        // Digits do not have a case; only letters redraw with the shift.
        if (/[A-Z]/.test(ch)) this.letterKeys.push({ ch, label: key.label });
      });
    });

    // The bottom row: case, space, and the three that finish or undo.
    const y = 58 + 4 * (KH + GAP);
    this.shiftKey = this.key(24, y, 40, KH, 'abc', () => this.toggleShift()).label;
    this.key(68, y, 86, KH, 'SPACE', () => this.type(' '));
    this.key(158, y, 46, KH, 'BACK', () => this.backspace());
    this.key(208, y, 40, KH, 'CLEAR', () => this.clearDraft());
    this.key(252, y, 44, KH, 'OK', () => this.commitName(), PALETTE.tealDark);

    const y2 = y + KH + GAP;
    this.key(130, y2, 60, KH, 'CANCEL', () => this.cancelNaming(), PALETTE.plum);
    this.syncShift();
  }

  /** One tappable key.  Returns its label so the case toggle can rewrite it. */
  private key(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onTap: () => void,
    fill: number = PALETTE.slate,
  ): { box: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.BitmapText } {
    const box = this.add
      .rectangle(x, y, w, h, fill)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.steel)
      .setInteractive({ useHandCursor: true });
    box.on('pointerover', () => box.setFillStyle(PALETTE.steel));
    box.on('pointerout', () => box.setFillStyle(fill));
    box.on('pointerdown', () => {
      box.setFillStyle(PALETTE.gold);
      this.time.delayedCall(90, () => box.setFillStyle(fill));
      onTap();
    });
    const text0 = centerText(this, x + w / 2, y + Math.round((h - 7) / 2), label, PALETTE.cream);
    this.body.add(box);
    this.body.add(text0);
    return { box, label: text0 };
  }

  private toggleShift(): void {
    this.shift = !this.shift;
    audio.sfx('ui_blip', 0.5);
    this.syncShift();
  }

  /** Repaint every letter key in the case it would type right now. */
  private syncShift(): void {
    for (const k of this.letterKeys) k.label.setText(this.shift ? k.ch : k.ch.toLowerCase());
    this.shiftKey?.setText(this.shift ? 'ABC' : 'abc');
    this.shiftKey?.setTint(this.shift ? PALETTE.gold : PALETTE.cream);
  }

  /** Append one character, if there is room for it. */
  private type(ch: string): void {
    if (this.draft.length >= MAX_NAME_LEN) {
      audio.sfx('buzzer', 0.3);
      return;
    }
    this.draft += /[A-Za-z]/.test(ch) && !this.shift ? ch.toLowerCase() : ch.toUpperCase();
    audio.sfx('dialogue_blip');
    this.syncDraft();
  }

  private backspace(): void {
    if (!this.draft) return;
    this.draft = this.draft.slice(0, -1);
    audio.sfx('ui_blip', 0.4);
    this.syncDraft();
  }

  private clearDraft(): void {
    if (!this.draft) return;
    this.draft = '';
    audio.sfx('ui_hover', 0.5);
    this.syncDraft();
  }

  /**
   * Repaint just the name and its caret.
   *
   * This used to be a full `render()` every frame, which destroyed and rebuilt
   * CANCEL and CREATE sixty times a second along with it.  Phaser only inserts
   * a newly interactive object into its input list on the next frame's
   * pre-update, so buttons churned that fast are a coin toss to click even
   * once their hit area is right.  Only the caret needs the frame.
   */
  private syncDraft(): void {
    if (!this.draftText) return;
    // A block caret rather than a thin bar — at this size a 1px line reads as dirt.
    this.draftText.setText(this.draft + (Math.floor(this.time.now / 400) % 2 === 0 ? '_' : ' '));
  }

  // -------------------------------------------------------------------- actions

  private beginNaming(): void {
    this.naming = true;
    this.shift = true;
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
    // Already dealt with, on an earlier drain of the same queue.
    if (this.seenKeys.has(e)) return;
    this.seenKeys.add(e);

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
      this.syncDraft();
      return;
    }
    if (e.key.length === 1 && /[A-Za-z0-9 ]/.test(e.key) && this.draft.length < MAX_NAME_LEN) {
      // A typed key keeps the case it was typed in: the shift latch on screen
      // is for thumbs, and a real keyboard already has one.
      this.draft += e.key;
      audio.sfx('dialogue_blip');
      this.syncDraft();
    }
  }

  private close(): void {
    store.flush();
    this.scene.get(this.from)?.events.emit('profiles-closed');
    this.scene.stop();
  }

  update(): void {
    // Only the caret needs the frame, and only while typing.
    if (this.naming) this.syncDraft();
  }
}

function describe(s: ReturnType<typeof store.slotSummary>): string {
  if (s.route === 'ended') return 'FINISHED';
  if (s.route !== 'normal') return 'IN THE DARK';
  if (!s.seenIntro) return 'NEW RUN';
  return `${s.tokens} TOK - ${s.played} PLAYED`;
}
