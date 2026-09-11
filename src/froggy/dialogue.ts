/**
 * Froggy's dialogue box.  PRD §8.3.
 *
 * Typewriter reveal at 28 chars/sec with a soft blip per character.  The
 * portrait is drawn on the UNFILTERED overlay (PRD FR-2) while the box itself
 * is pixel art, so Froggy sits inside a frame he does not visually belong to.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { froggyLayer } from '../render/froggyLayer';
import { drawFroggy, type FroggyPose } from './froggy';
import { GAME_W } from '../render/pixelScaler';
import { text } from '../core/ui';

export const DEFAULT_CPS = 28;

export interface DialogueLine {
  text: string;
  pose?: FroggyPose;
  /**
   * Stop the idle animation completely for this line.  PRD §8.4 line 6 — the
   * only foreshadowing in Act I.  Same art, no motion.
   */
  freeze?: boolean;
  /** Silent hold before the line starts, ms. */
  holdBefore?: number;
  /** Silent hold after the line finishes, before input is accepted, ms. */
  holdAfter?: number;
  /** Typewriter rate override. */
  cps?: number;
  /** Highlight a screen region while this line is on. */
  highlight?: { x: number; y: number; w: number; h: number };
  /** Fired once when the line begins revealing. */
  onStart?: () => void;
  /**
   * Advance without waiting for input.  The second bust is not a conversation;
   * the player does not get to hurry it along.  (PRD §7.8)
   */
  auto?: boolean;
}

/**
 * The box is taller than it was and the text is twice the size, at the
 * customer's request: the five-by-eight font at 1x read as texture more than
 * as words.  Three lines of twenty characters fit; anything longer is paged.
 */
const BOX_Y = 116;
const BOX_H = 64;
const TEXT_SIZE = 16;
const TEXT_W = GAME_W - 70;
/** Characters a page holds before it is split.  Three lines of ~20. */
const PAGE_CHARS = 58;
const PORTRAIT_CX = 30;
const PORTRAIT_BASE = BOX_Y + BOX_H - 3;
const PORTRAIT_H = 52;

export class DialogueBox {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private label: Phaser.GameObjects.BitmapText;
  private prompt: Phaser.GameObjects.BitmapText;
  private highlight: Phaser.GameObjects.Rectangle;

  private lines: DialogueLine[] = [];
  private index = 0;
  private revealed = 0;
  private acc = 0;
  private state: 'idle' | 'holdBefore' | 'typing' | 'holdAfter' | 'waiting' = 'idle';
  private holdTimer = 0;
  private bounce = 0;
  private onDone: (() => void) | null = null;
  private updateRef: (t: number, d: number) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const panel = scene.add.rectangle(0, BOX_Y, GAME_W, BOX_H, PALETTE.ink).setOrigin(0, 0);
    panel.setStrokeStyle(1, PALETTE.neon);
    const portraitWell = scene.add.rectangle(6, BOX_Y + 3, 48, BOX_H - 6, PALETTE.plum).setOrigin(0, 0);

    this.label = text(scene, 60, BOX_Y + 6, '', PALETTE.cream, TEXT_SIZE).setMaxWidth(TEXT_W);
    this.prompt = text(scene, GAME_W - 18, BOX_Y + BOX_H - 18, '>', PALETTE.gold, TEXT_SIZE).setVisible(false);

    this.highlight = scene.add.rectangle(0, 0, 10, 10).setStrokeStyle(1, PALETTE.gold).setVisible(false);

    this.container = scene.add.container(0, 0, [panel, portraitWell, this.label, this.prompt]);
    this.container.setDepth(900).setVisible(false);

    this.updateRef = (_t: number, d: number) => this.tick(d);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateRef);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  play(lines: DialogueLine[], onDone?: () => void): void {
    this.lines = paginate(lines);
    this.index = 0;
    this.onDone = onDone ?? null;
    this.container.setVisible(true);
    this.beginLine();

    const advance = () => this.advance();
    this.scene.input.on('pointerdown', advance);
    this.scene.input.keyboard?.on('keydown-E', advance);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.input.off('pointerdown', advance);
    });
  }

  isActive(): boolean {
    return this.state !== 'idle';
  }

  private current(): DialogueLine | null {
    return this.lines[this.index] ?? null;
  }

  private beginLine(): void {
    const line = this.current();
    if (!line) {
      this.finish();
      return;
    }
    this.revealed = 0;
    this.acc = 0;
    this.label.setText('');
    this.prompt.setVisible(false);

    if (line.highlight) {
      this.highlight
        .setPosition(line.highlight.x, line.highlight.y)
        .setSize(line.highlight.w, line.highlight.h)
        .setVisible(true)
        .setDepth(880);
      this.scene.tweens.add({ targets: this.highlight, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
    } else {
      this.highlight.setVisible(false);
    }

    if (line.holdBefore && line.holdBefore > 0) {
      this.state = 'holdBefore';
      this.holdTimer = line.holdBefore;
    } else {
      this.state = 'typing';
      line.onStart?.();
    }
  }

  private tick(delta: number): void {
    const line = this.current();
    if (this.state === 'idle' || !line) {
      return;
    }

    // The idle bounce.  A frozen line simply does not advance it (PRD §8.4).
    if (!line.freeze) this.bounce = (this.bounce + delta / 900) % 1;

    switch (this.state) {
      case 'holdBefore':
        this.holdTimer -= delta;
        if (this.holdTimer <= 0) {
          this.state = 'typing';
          line.onStart?.();
        }
        break;

      case 'typing': {
        const cps = line.cps ?? DEFAULT_CPS;
        this.acc += delta;
        const want = Math.floor((this.acc / 1000) * cps);
        if (want > this.revealed) {
          const prev = this.revealed;
          this.revealed = Math.min(line.text.length, want);
          this.label.setText(stripMarkup(line.text.slice(0, this.revealed)));
          if (this.revealed > prev && this.revealed % 2 === 0) audio.sfx('dialogue_blip');
        }
        if (this.revealed >= line.text.length) {
          if (line.holdAfter && line.holdAfter > 0) {
            this.state = 'holdAfter';
            this.holdTimer = line.holdAfter;
          } else {
            this.state = 'waiting';
            this.prompt.setVisible(true);
          }
        }
        break;
      }

      case 'holdAfter':
        this.holdTimer -= delta;
        if (this.holdTimer <= 0) {
          this.state = 'waiting';
          this.prompt.setVisible(true);
        }
        break;

      case 'waiting':
        if (line.auto) {
          this.prompt.setVisible(false);
          this.state = 'idle';
          this.index++;
          if (this.index >= this.lines.length) this.finish();
          else this.beginLine();
          return;
        }
        this.prompt.setAlpha(0.4 + 0.6 * Math.abs(Math.sin(this.scene.time.now / 300)));
        break;
    }

    this.paintPortrait(line);
  }

  private paintPortrait(line: DialogueLine): void {
    const talking = this.state === 'typing';
    const pose: FroggyPose = line.pose ?? (talking ? 'talk' : 'idleA');
    froggyLayer.paint((ctx) => {
      drawFroggy(ctx, {
        x: PORTRAIT_CX,
        y: PORTRAIT_BASE,
        height: PORTRAIT_H,
        // V1 is V0's art with the animation stopped.  Nothing else.
        variant: line.freeze ? 'uncanny' : 'cozy',
        pose,
        bounce: this.bounce,
      });
    });
  }

  private advance(): void {
    const cur = this.current();
    if (cur?.auto) return; // not skippable
    if (this.state === 'typing') {
      const line = this.current();
      if (!line) return;
      // Skip to the end of the line — but a hold is a hold, it cannot be skipped.
      this.revealed = line.text.length;
      this.label.setText(stripMarkup(line.text));
      this.acc = (line.text.length / (line.cps ?? DEFAULT_CPS)) * 1000;
      if (line.holdAfter && line.holdAfter > 0) {
        this.state = 'holdAfter';
        this.holdTimer = line.holdAfter;
      } else {
        this.state = 'waiting';
        this.prompt.setVisible(true);
      }
      return;
    }
    if (this.state !== 'waiting') return;
    this.index++;
    if (this.index >= this.lines.length) this.finish();
    else this.beginLine();
  }

  private finish(): void {
    this.state = 'idle';
    this.container.setVisible(false);
    this.highlight.setVisible(false);
    froggyLayer.clear();
    const cb = this.onDone;
    this.onDone = null;
    cb?.();
  }

  private destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.updateRef);
    froggyLayer.clear();
  }
}

/** `**bold**` in the script marks emphasis; the placeholder font has none. */
/**
 * Split any line too long for the box into pages, at sentence or clause
 * boundaries.  The first page keeps the hold before; the last keeps the hold
 * after and the auto-advance; the pose and the highlight carry across all
 * of them, because it is still the same moment.
 */
function paginate(lines: DialogueLine[]): DialogueLine[] {
  const out: DialogueLine[] = [];
  for (const line of lines) {
    const pages = splitText(line.text);
    pages.forEach((text, i) => {
      const first = i === 0;
      const last = i === pages.length - 1;
      out.push({
        ...line,
        text,
        holdBefore: first ? line.holdBefore : undefined,
        // An auto line stays auto on every page, with a reading pause on the
        // ones that are not its last.
        holdAfter: last ? line.holdAfter : line.auto ? 1400 : undefined,
        auto: line.auto,
        onStart: first ? line.onStart : undefined,
      });
    });
  }
  return out;
}

function splitText(text: string): string[] {
  const pages: string[] = [];
  let rest = text.trim();
  while (rest.length > PAGE_CHARS) {
    // The latest boundary that still fits: end of a sentence first, then a
    // clause, then any space at all.
    const head = rest.slice(0, PAGE_CHARS + 1);
    const lastOf = (re: RegExp): number => {
      let at = -1;
      for (const m of head.matchAll(re)) at = m.index + m[0].length - 1; // the space after the mark
      return at;
    };
    const at = [lastOf(/[.!?]\s/g), lastOf(/,\s/g), lastOf(/\s/g)].find((i) => i > 12);
    if (at === undefined) break;
    pages.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  pages.push(rest);
  return pages;
}

function stripMarkup(s: string): string {
  return s.replace(/\*\*/g, '');
}
