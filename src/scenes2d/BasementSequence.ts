/**
 * The basement.  PRD §7.14 / QFD C7 (rank #3).
 *
 * This is NOT a movement scene.  Ten static images, advanced by clicking an
 * arrow hotspot, 600ms crossfades, and a few footsteps for every move.  No HUD,
 * no music, no ambience — one-shot footsteps and door creaks only.
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
import { centerText, fadeToScene, text } from '../core/ui';
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
  paintRoomShell,
  paintStairs,
} from '../art/basementFrames';

const CROSSFADE_MS = 600;
/** He stands there this long before he comes at you.  Unskippable. */
const STARE_MS = 3000;
/** And the lunge itself, from first twitch to the door appearing. */
const TRANSFORM_MS = 2200;
/**
 * `arrowOn` is a direction, not a place: it says which way the player is about
 * to go and the glyph is drawn pointing that way.  The corridors used to be
 * marked with a '>' pinned to the right-hand edge of the screen while the
 * corridor itself ran straight away from the camera, so the one piece of UI in
 * the sequence was telling the player to walk sideways into a wall.
 */
type HotspotKind = 'arrowDown' | 'arrowForward' | 'door' | 'key' | 'turnAround' | 'exitDoor' | 'none';

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
    // Scene instances are reused; reset everything mutable.
    this.index = 0;
    this.layer = null;
    this.hotspot = null;
    this.busy = true;

    // No music.  No ambience.  Footsteps, a door, a drip.  Nothing else.
    audio.setScene(SILENCE);

    this.add.rectangle(0, 0, GAME_W, GAME_H, PALETTE.black).setOrigin(0, 0).setDepth(-100);
    this.cameras.main.fadeIn(900, 0, 0, 0);

    this.frames = [
      // Forward, not down: you walk INTO the frame to go down these.  The
      // arrow marks the direction you travel, and every other frame in the
      // sequence uses the same one.
      { paint: (_s, c) => paintStairs(this, c), hotspot: 'arrowForward' },
      { paint: (_s, c) => paintCorridor(this, c, 1), hotspot: 'arrowForward' },
      // Frame 3 is frame 2, subtly longer.  Same tiles, stretched.
      { paint: (_s, c) => paintCorridor(this, c, 1.35), hotspot: 'arrowForward' },
      { paint: (_s, c) => paintChairRoom(this, c), hotspot: 'door' },
      {
        paint: (_s, c) => {
          paintCorridor(this, c, 1.5);
          paintFarFigure(this, c); // do not light it, do not animate it
        },
        hotspot: 'arrowForward',
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
      { paint: (s, c) => s.paintStare(c), hotspot: 'none' },
      { paint: (s, c) => s.paintTransform(c), hotspot: 'none' },
      { paint: (s, c) => s.paintWayOut(c), hotspot: 'exitDoor' },
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
      // Input is taken away and he simply stands there.  The whole horror beat
      // runs about four seconds: this stare, then the turn.
      this.busy = true;
      this.time.delayedCall(STARE_MS, () => this.show(9));
      return;
    }
    if (i === 9) return; // the transformation drives itself

    this.busy = false;
    this.spawnHotspot(def.hotspot);
  }

  /**
   * A triangle, pointing the way you are about to walk.
   *
   * Drawn rather than typed: the font's '>' and 'v' are letters shaped like
   * arrows, and at this size a real triangle is both clearer and able to point
   * at the vanishing point, which is the direction that matters most here.
   */
  private arrowGlyph(x: number, y: number, dir: 'down' | 'forward'): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(PALETTE.fog, 0.75);
    if (dir === 'down') {
      // Down the stairs: the way the flight in front of you goes.
      g.fillTriangle(x - 7, y - 5, x + 7, y - 5, x, y + 6);
      g.fillRect(x - 2, y - 12, 4, 7);
    } else {
      // Away from the camera, down the corridor.
      g.fillTriangle(x - 7, y + 5, x + 7, y + 5, x, y - 6);
      g.fillRect(x - 2, y + 5, 4, 7);
    }
    return g;
  }

  /** Only this advances the sequence.  Nothing else does. */
  private spawnHotspot(kind: HotspotKind): void {
    if (kind === 'none') return;

    let x = GAME_W / 2;
    let y = GAME_H - 24;
    let label = '';
    let w = 22;
    let h = 18;
    let arrow: 'down' | 'forward' | null = 'down';

    if (kind === 'arrowForward') {
      // Centred, near the vanishing point: the corridor runs that way.
      x = GAME_W / 2;
      y = 118;
      w = 40;
      h = 30;
      arrow = 'forward';
    } else if (kind === 'door') {
      // The door itself is the target; it needs no arrow to explain it.
      x = GAME_W / 2;
      y = 94;
      w = 44;
      h = 76;
      arrow = null;
    } else if (kind === 'key') {
      x = GAME_W / 2;
      y = 94;
      w = 20;
      h = 26;
      arrow = null;
    } else if (kind === 'exitDoor') {
      x = GAME_W / 2;
      y = 100;
      w = 52;
      h = 84;
      arrow = null;
    } else if (kind === 'turnAround') {
      // Not a direction: an instruction to turn on the spot.
      x = GAME_W / 2;
      y = GAME_H - 26;
      w = 30;
      arrow = null;
      label = '<>';
    }

    const zone = this.add.rectangle(x, y, w, h, PALETTE.cream, 0.0).setInteractive({ useHandCursor: true });
    const glyph: Phaser.GameObjects.GameObject | null = arrow
      ? this.arrowGlyph(x, y, arrow)
      : label
        ? text(this, x, y, label, PALETTE.fog, 8).setOrigin(0.5, 0.5)
        : null;
    if (glyph) {
      this.tweens.add({ targets: glyph, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
    }

    zone.on('pointerdown', () => this.advance(kind));
    this.hotspot = this.add.container(0, 0, glyph ? [zone, glyph] : [zone]).setDepth(500);
  }

  private advance(kind: HotspotKind): void {
    if (this.busy) return;
    this.busy = true;

    if (kind === 'exitDoor') {
      // Forward only.  The corridor you came down is not on the other side.
      audio.sfx('door_creak');
      store.patch({ route: 'hide', hideRoom: 0 });
      store.flush();
      this.time.delayedCall(900, () => fadeToScene(this, 'HideRoom3D'));
      return;
    }
    if (kind === 'door') {
      audio.sfx('door_creak');
      this.time.delayedCall(450, () => this.walk(3));
      this.time.delayedCall(1500, () => this.show(this.index + 1));
      return;
    }
    if (kind === 'key') {
      // PRD frame 8: hasKey, then the bulb flickers hard.
      store.patch({ hasKey: true });
      store.flush();
      audio.sfx('lock_click');
      this.time.delayedCall(260, () => this.walk(2));
      this.time.delayedCall(500, () => this.show(this.index + 1));
      return;
    }

    this.walk();
    if (Math.random() < 0.25) {
      this.time.delayedCall(900 + Math.random() * 900, () => audio.sfx('drip'));
    }
    this.show(this.index + 1);
  }

  /**
   * The sound of covering the ground between two frames.
   *
   * Each step of the sequence is a walk down a corridor, and it used to be
   * exactly one footstep: you crossed ten metres of concrete in silence and
   * arrived with a single click.  Four of them, unevenly spaced and fading,
   * is what makes the basement feel walked through rather than clicked through.
   */
  private walk(steps = 4): void {
    for (let i = 0; i < steps; i++) {
      const at = i * (330 + Math.random() * 90);
      if (i === 0) audio.sfx('footstep_concrete');
      else this.time.delayedCall(at, () => audio.sfx('footstep_concrete'));
    }
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
   * You turn, and he is already there.
   *
   * Nothing happens for two seconds.  He does not breathe, blink or bob — this
   * is the mascot's own art with the animation stopped and the pupils shrunk to
   * pinpricks (PRD FR-7), which is the last moment he is still recognisable.
   */
  /**
   * You turn round, and he is stood down the other end of the room.
   *
   * Distance is the whole staging.  He is the mascot, unchanged and unlit,
   * small in the middle of the frame with the corridor you came in by behind
   * him — near enough to recognise, far enough that nothing is happening yet.
   * Three seconds of that, and then he closes it.
   */
  paintStare(c: Phaser.GameObjects.Container): void {
    paintReverse(this, c);

    froggyLayer.paint((ctx) => {
      drawFroggy(ctx, {
        x: GAME_W / 2,
        // Feet on the floor at the far end, not on the camera.
        y: 124,
        height: 76,
        variant: 'uncanny',
        pose: 'blank', // the pinprick pupils
      });
    });

    // One dry click of a footstep behind you, then nothing at all.
    this.time.delayedCall(260, () => audio.sfx('footstep_concrete'));
  }

  /**
   * And then he crosses it.
   *
   * The morph runs in under half a second — sudden, not a dissolve — and the
   * scare fires on the first frame of it, routed past the volume buses
   * (audio.scare) so a quiet room stays the setup for something loud.  He
   * finishes the beat filling the frame, because he has just covered eight
   * metres of concrete in the time it took you to notice he had moved.
   */
  paintTransform(c: Phaser.GameObjects.Container): void {
    this.tweens.killAll();
    c.setAlpha(1);
    paintReverse(this, c);
    c.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x140306, 0.55).setOrigin(0, 0));

    audio.scare();
    const cam = this.cameras.main;
    cam.shake(700, 0.045);
    cam.flash(90, 120, 8, 12);

    const t0 = this.time.now;
    const paint = () => {
      const age = this.time.now - t0;
      const e = Math.min(1, age / 520);
      const morph = e * e; // slow to start, then all at once
      // He keeps coming after the shape has finished changing.
      const lunge = Math.min(1, age / TRANSFORM_MS) ** 1.6;
      froggyLayer.paint((ctx) => {
        drawFroggy(ctx, {
          x: GAME_W / 2,
          // Framed so the maw stays on screen.  Anchored on the face and scaled
          // any larger, he becomes two eyes and you lose the mouth entirely.
          y: 58,
          height: 96 + morph * 70 + lunge * 250,
          variant: morph < 0.06 ? 'uncanny' : 'monster',
          pose: 'blank',
          anchor: 'face',
          morph,
          maw: Math.min(1, morph * 1.4),
          blood: Math.max(0, (morph - 0.25) / 0.75),
          pupil: 0.13,
          t: (this.time.now - t0) / 1000,
          shake: morph > 0.3 ? 1 : 0,
        });
      });
    };

    const ev = this.time.addEvent({ delay: 16, loop: true, callback: paint });
    paint();

    // Blood hits the lens as he lands on you.
    this.time.delayedCall(520, () => {
      for (let i = 0; i < 14; i++) {
        const x = Math.random() * GAME_W;
        const y = Math.random() * GAME_H;
        const r = 2 + Math.random() * 9;
        c.add(this.add.ellipse(x, y, r * 2, r * (1.4 + Math.random()), 0x8d0f16, 0.85).setDepth(600));
      }
    });

    this.time.delayedCall(TRANSFORM_MS, () => {
      ev.remove();
      froggyLayer.clear();
      this.show(10);
    });
  }

  paintWayOut(c: Phaser.GameObjects.Container): void {
    // The same room the rest of the sequence is set in, so the last frame is
    // not a door floating in front of a black rectangle.
    paintRoomShell(this, c, { x: 84, y: 46, w: 152, h: 72 }, 8800);

    // wet floor catching what little light there is
    c.add(this.add.rectangle(0, 148, GAME_W, 32, 0x120d12, 0.55).setOrigin(0, 0));

    const doorW = 52;
    const doorH = 84;
    const dx = GAME_W / 2;
    const dy = 100;
    c.add(this.add.rectangle(dx, dy, doorW + 8, doorH + 8, 0x1b1218));
    c.add(this.add.rectangle(dx, dy, doorW, doorH, 0x2b1d16));
    // panels, and the light down the hinge side
    for (let i = 0; i < 4; i++) {
      c.add(this.add.rectangle(dx, dy - doorH / 2 + 12 + i * 20, doorW - 10, 2, 0x1a110d));
    }
    c.add(this.add.rectangle(dx - doorW / 2 + 1, dy, 1, doorH - 6, 0x4a382a, 0.5));
    c.add(this.add.circle(dx + 17, dy + 6, 2, 0xc9a62e));
    c.add(this.add.circle(dx + 17, dy + 5, 1, 0xffd45e, 0.6));

    // light bleeding under it
    const bleed = this.add.rectangle(dx, dy + doorH / 2 + 2, doorW - 6, 3, 0xd8b45a, 0.5);
    c.add(bleed);
    this.tweens.add({ targets: bleed, alpha: 0.15, duration: 1400, yoyo: true, repeat: -1 });

    // and his handprint, left on it
    for (let i = 0; i < 5; i++) {
      c.add(
        this.add.ellipse(dx - 14 + i * 6, dy - 12 - Math.abs(i - 2) * 3, 4, 9, 0x6d0a0c, 0.75),
      );
    }
    c.add(this.add.ellipse(dx - 2, dy + 2, 16, 14, 0x6d0a0c, 0.7));

    c.add(centerText(this, GAME_W / 2, 168, 'the only way is forward', PALETTE.fog, 8).setAlpha(0.6));
  }
}
