/**
 * The basement.  PRD §7.14 / QFD C7 (rank #3).
 *
 * This is NOT a movement scene.  Ten static images, advanced by clicking an
 * arrow hotspot, 600ms crossfades, footstep on every click.  No HUD, no music,
 * no ambience — one-shot footsteps and door creaks only.
 *
 * The pacing IS the horror (VOC-25).  Let the crossfade be slow.  Let the
 * player sit in each frame.
 *
 * BS-2: only the hotspot advances.  Keyboard mashing, double-clicks and rapid
 * clicks cannot skip a frame (AC-7).
 * BS-3: no back navigation.  The way behind is always dark.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio, SILENCE } from '../core/audio';
import { store } from '../core/state';
import { fadeToScene, text } from '../core/ui';
import { froggyLayer } from '../render/froggyLayer';
import { drawFroggy } from '../froggy/froggy';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import {
  paintChairRoom,
  paintCorridor,
  paintFarFigure,
  paintKeyRoom,
  paintPlainDoor,
  paintReverse,
  paintStairs,
} from '../art/basementFrames';

const CROSSFADE_MS = 600;
const HOLD_MS = 4000; // frame 9.  Four full seconds, unskippable.

type HotspotKind = 'arrowDown' | 'arrowRight' | 'door' | 'key' | 'turnAround' | 'none';

interface FrameDef {
  paint: (scene: BasementSequence, c: Phaser.GameObjects.Container) => void;
  hotspot: HotspotKind;
}

export class BasementSequence extends Phaser.Scene {
  private index = 0;
  private layer: Phaser.GameObjects.Container | null = null;
  private hotspot: Phaser.GameObjects.Container | null = null;
  private busy = true;
  private frames: FrameDef[] = [];

  constructor() {
    super('BasementSequence');
  }

  create(): void {
    froggyLayer.clear();
    // No music.  No ambience.  Footsteps, a door, a drip.  Nothing else.
    audio.setScene(SILENCE);

    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black).setOrigin(0, 0).setDepth(-100);
    this.cameras.main.fadeIn(900, 0, 0, 0);

    this.frames = [
      { paint: (_s, c) => paintStairs(this, c), hotspot: 'arrowDown' },
      { paint: (_s, c) => paintCorridor(this, c, 1), hotspot: 'arrowRight' },
      // Frame 3 is frame 2, subtly longer.  Same tiles, stretched.
      { paint: (_s, c) => paintCorridor(this, c, 1.35), hotspot: 'arrowRight' },
      { paint: (_s, c) => paintChairRoom(this, c), hotspot: 'door' },
      {
        paint: (_s, c) => {
          paintCorridor(this, c, 1.5);
          paintFarFigure(this, c); // do not light it, do not animate it
        },
        hotspot: 'arrowRight',
      },
      {
        // The figure is gone.  This is never acknowledged.
        paint: (_s, c) => {
          paintCorridor(this, c, 1.2, false);
          paintPlainDoor(this, c);
        },
        hotspot: 'door',
      },
      { paint: (s, c) => s.paintKeyFrame(c), hotspot: 'key' },
      { paint: (s, c) => s.paintFlickerFrame(c), hotspot: 'turnAround' },
      { paint: (_s, c) => paintReverse(this, c), hotspot: 'none' },
      { paint: (s, c) => s.paintJumpscare(c), hotspot: 'none' },
    ];

    this.time.delayedCall(900, () => this.show(0));
  }

  // ------------------------------------------------------------------ frames

  private show(i: number): void {
    this.index = i;
    this.busy = true;

    const next = this.add.container(0, 0).setAlpha(0);
    this.frames[i].paint(this, next);

    const prev = this.layer;
    this.layer = next;
    this.hotspot?.destroy();
    this.hotspot = null;

    this.tweens.add({
      targets: next,
      alpha: 1,
      duration: CROSSFADE_MS,
      onComplete: () => {
        prev?.destroy();
        this.onFrameShown(i);
      },
    });
    if (prev) this.tweens.add({ targets: prev, alpha: 0, duration: CROSSFADE_MS });
  }

  private onFrameShown(i: number): void {
    const def = this.frames[i];

    if (i === 8) {
      // PRD frame 9: input is taken away and the game holds for four seconds.
      this.busy = true;
      this.time.delayedCall(HOLD_MS, () => this.show(9));
      return;
    }
    if (i === 9) return; // the jumpscare drives itself

    this.busy = false;
    this.spawnHotspot(def.hotspot);
  }

  /** Only this advances the sequence.  Nothing else does. */
  private spawnHotspot(kind: HotspotKind): void {
    if (kind === 'none') return;

    let x = GAME_W / 2;
    let y = GAME_H - 24;
    let label = 'v';
    let w = 22;
    let h = 18;

    if (kind === 'arrowRight') {
      x = GAME_W - 30;
      y = GAME_H / 2 + 10;
      label = '>';
    } else if (kind === 'door') {
      x = GAME_W / 2;
      y = 94;
      w = 44;
      h = 76;
      label = '';
    } else if (kind === 'key') {
      x = GAME_W / 2;
      y = 94;
      w = 20;
      h = 26;
      label = '';
    } else if (kind === 'turnAround') {
      x = GAME_W / 2;
      y = GAME_H - 26;
      w = 30;
      label = '<>';
    }

    const zone = this.add.rectangle(x, y, w, h, PALETTE.cream, 0.0).setInteractive({ useHandCursor: true });
    const glyph = label ? text(this, x, y, label, PALETTE.fog, 8).setOrigin(0.5, 0.5) : null;
    if (glyph) {
      this.tweens.add({ targets: glyph, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
    }

    zone.on('pointerdown', () => this.advance(kind));
    this.hotspot = this.add.container(0, 0, glyph ? [zone, glyph] : [zone]).setDepth(500);
  }

  private advance(kind: HotspotKind): void {
    if (this.busy) return;
    this.busy = true;

    if (kind === 'door') {
      audio.sfx('door_creak');
      this.time.delayedCall(1500, () => this.show(this.index + 1));
      return;
    }
    if (kind === 'key') {
      // PRD frame 8: hasKey, then the bulb flickers hard.
      store.patch({ hasKey: true });
      store.flush();
      audio.sfx('lock_click');
      this.time.delayedCall(500, () => this.show(this.index + 1));
      return;
    }

    audio.sfx('footstep_concrete');
    if (Math.random() < 0.25) {
      this.time.delayedCall(900 + Math.random() * 900, () => audio.sfx('drip'));
    }
    this.show(this.index + 1);
  }

  // ------------------------------------------------- frames that need scene state

  paintKeyFrame(c: Phaser.GameObjects.Container): void {
    paintKeyRoom(this, c);
  }

  /**
   * Frame 8.  PRD H3 / AC-7.
   *
   * TURN AROUND is on the back wall, and it is visible ONLY inside the flicker
   * frames — roughly 70ms at a time, four times.  It must not be readable in
   * any non-flicker frame.  Half the players will not be sure what they read.
   */
  paintFlickerFrame(c: Phaser.GameObjects.Container): void {
    const { bulb, glow } = paintKeyRoom(this, c);
    // the key is gone: it is in your hand now
    const kids = c.list.filter((o) => o instanceof Phaser.GameObjects.Container);
    for (const k of kids) (k as Phaser.GameObjects.Container).destroy();

    const words = text(this, GAME_W / 2, 62, 'TURN AROUND', PALETTE.bone, 16)
      .setOrigin(0.5, 0.5)
      .setAlpha(0);
    c.add(words);

    audio.sfx('bulb_flicker');

    // Flicker timeline: the bulb dies, and in the dark the wall says something.
    const beats: Array<[number, number, number]> = [
      // [at ms, bulb alpha, words alpha]
      [0, 0.85, 0],
      [420, 0.05, 1],
      [490, 0.85, 0],
      [700, 0.05, 1],
      [770, 0.9, 0],
      [980, 0.04, 1],
      [1050, 0.85, 0],
      [1400, 0.05, 1],
      [1470, 0.85, 0],
    ];
    for (const [at, bulbA, wordA] of beats) {
      this.time.delayedCall(at, () => {
        bulb.setAlpha(bulbA);
        glow.setAlpha(bulbA * 0.11);
        words.setAlpha(wordA);
      });
    }
    this.time.delayedCall(1700, () => words.setAlpha(0));
  }

  /**
   * Frame 10.  PRD H4.
   *
   * The camera snaps back and Froggy is filling the frame: full-screen,
   * non-pixel, smooth-rendered, wrong.  Hard cut — no crossfade — a loud
   * stinger and a three-frame shake.
   */
  paintJumpscare(c: Phaser.GameObjects.Container): void {
    // hard cut: kill the crossfade this frame would otherwise get
    this.tweens.killAll();
    c.setAlpha(1);

    const black = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x120404).setOrigin(0, 0);
    c.add(black);

    audio.sfx('stinger');

    // He renders on the overlay, at a scale nothing else in this game uses.
    let maw = 0.7;
    const paint = () => {
      froggyLayer.paint((ctx) => {
        drawFroggy(ctx, {
          x: GAME_W / 2,
          y: 54,
          height: 290,
          variant: 'predator',
          anchor: 'face', // what must be in frame is the part you recognise
          maw,
        });
      });
    };
    paint();

    // three-frame shake
    const cam = this.cameras.main;
    cam.shake(320, 0.028);

    this.time.addEvent({
      delay: 60,
      repeat: 12,
      callback: () => {
        maw = Math.min(1, maw + 0.05);
        paint();
      },
    });

    this.time.delayedCall(1250, () => {
      froggyLayer.clear();
      cam.fadeOut(200, 0, 0, 0);
      this.time.delayedCall(700, () => {
        store.patch({ route: 'chase' });
        store.flush();
        if (this.scene.get('Chase3D')) fadeToScene(this, 'Chase3D');
        else this.scene.start('EndCard', { title: 'End', quiet: true });
      });
    });
  }
}
