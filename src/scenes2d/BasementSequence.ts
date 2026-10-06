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
import { text } from '../core/ui';
import { froggyLayer } from '../render/froggyLayer';
import { drawFroggy } from '../froggy/froggy';
import { runKeyRoomScare } from '../froggy/keyRoomScare';
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
/**
 * THE WALK BETWEEN FRAMES.
 *
 * `STEP_GAP` is the pace, `STEP_JITTER` stops four steps sounding like a
 * metronome, and `STEP_TAIL` is the quiet after the last one lands -- without
 * it the crossfade starts on top of the final step's decay, which is the
 * overlap this whole arrangement exists to avoid.
 *
 * `STEP_GAIN` is under half of what these were.  A footstep in a corridor you
 * are creeping down is the quietest thing in it; at full level four of them
 * was the loudest thing in the game.
 */
const STEP_GAP = 250;
const STEP_JITTER = 80;
const STEP_TAIL = 200;
const STEP_GAIN = 0.45;
/** Steps in an ordinary walk between two frames.  Three is a walk; four was a wait. */
const WALK_STEPS = 3;
/** He stands there this long before he comes at you.  Unskippable. */
const STARE_MS = 3000;
/** The black after the scare, before you wake. */
const BLACKOUT_MS = 4000;
/**
 * `arrowOn` is a direction, not a place: it says which way the player is about
 * to go and the glyph is drawn pointing that way.  The corridors used to be
 * marked with a '>' pinned to the right-hand edge of the screen while the
 * corridor itself ran straight away from the camera, so the one piece of UI in
 * the sequence was telling the player to walk sideways into a wall.
 */
/** Where the key lies on the table (frames, below). */
const KEY_FRAME = 6;

type HotspotKind = 'arrowDown' | 'arrowForward' | 'door' | 'key' | 'turnAround' | 'none';

interface FrameDef {
  paint: (scene: BasementSequence, c: Phaser.GameObjects.Container) => void;
  hotspot: HotspotKind;
}

export class BasementSequence extends Phaser.Scene {
  private index = 0;
  private layer: Phaser.GameObjects.Container | null = null;
  private hotspot: Phaser.GameObjects.Container | null = null;
  private busy = true;
  /** The thought on screen, if any: see `think`. */
  private thought: Phaser.GameObjects.Container | null = null;
  /** The frame a walk in progress is heading for, and every timer it is riding on. */
  private walkTo: number | null = null;
  private pending: Phaser.Time.TimerEvent[] = [];
  private frames: FrameDef[] = [];

  /** The frame to open on: the key's, for the admin run's test button. */
  private startAt = 0;

  constructor() {
    super('BasementSequence');
  }

  init(data: { atKey?: boolean } = {}): void {
    this.startAt = data.atKey ? KEY_FRAME : 0;
  }

  create(): void {
    // the scream is decoded before anything here can catch you
    audio.preloadScream();
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
      // The scare is not a drawing: see runKeyRoomScare.  This frame is only
      // the dark it happens in.
      { paint: (s, c) => s.paintBlack(c), hotspot: 'none' },
      // And then nothing at all, for four seconds.
      { paint: (s, c) => s.paintBlack(c), hotspot: 'none' },
    ];

    this.time.delayedCall(900, () => this.show(this.startAt));
  }

  // ------------------------------------------------------------------ frames

  /** `fade` 0 is a hard cut: the scare does not get a crossfade to warn you. */
  private show(i: number, fade = CROSSFADE_MS): void {
    this.index = i;
    this.busy = true;
    this.clearThought();

    const next = this.add.container(0, 0).setAlpha(0);
    this.frames[i].paint(this, next);

    const prev = this.layer;
    this.layer = next;
    this.hotspot?.destroy();
    this.hotspot = null;

    if (fade <= 0) {
      next.setAlpha(1);
      prev?.destroy();
      this.onFrameShown(i);
      return;
    }
    this.tweens.add({
      targets: next,
      alpha: 1,
      duration: fade,
      onComplete: () => {
        prev?.destroy();
        this.onFrameShown(i);
      },
    });
    if (prev) this.tweens.add({ targets: prev, alpha: 0, duration: fade });
  }

  private onFrameShown(i: number): void {
    const def = this.frames[i];

    if (i === 8) {
      // Input is taken away and he simply stands there.  The whole horror beat
      // runs about four seconds: this stare, then the turn.
      this.busy = true;
      this.time.delayedCall(STARE_MS, () => this.show(9, 0));
      return;
    }
    if (i === 9) {
      // ---- HE COMES AT YOU, AND IT IS HIM.
      //
      // The 3D creature, not the drawing: the one that is about to hunt you
      // through three rooms, driven into the camera by the rooms' own scare.
      runKeyRoomScare(this, () => this.show(10, 0));
      return;
    }
    if (i === 10) {
      // ---- AND THEN BLACK.  Four seconds of it, nothing on the screen and
      // nothing to press, before you come round somewhere else.
      this.time.delayedCall(BLACKOUT_MS, () => {
        store.patch({ route: 'hide', hideRoom: 0 });
        store.flush();
        this.scene.start('HideRoom3D', { wake: true });
      });
      return;
    }
    if (def.hotspot === 'turnAround') {
      // Five seconds to turn round yourself.  Then the game does it for you.
      this.time.delayedCall(5000, () => {
        if (this.index === i && !this.busy) this.advance('turnAround');
      });
    }

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
    // ---- A SECOND CLICK CUTS THE WALK SHORT.
    //
    // The walk is what stops the footsteps landing on top of the next frame,
    // but it must not be the only way to reach that frame: a player who has
    // already decided and clicks again should arrive NOW, not be told to wait
    // out an animation by a door that appears to have stopped working.  The
    // pending steps are cancelled rather than left to ring over the new frame,
    // so nothing overlaps either way.
    if (this.skipWalk()) return;
    if (this.busy) return;
    this.busy = true;

    // ---- NOTHING ADVANCES UNTIL THE WALKING HAS STOPPED.
    //
    // Every branch below walks first and shows second, and the gap between
    // them is the walk's own length rather than a number that happened to
    // look long enough.  `busy` is already true for all of it, so the arrow
    // cannot be clicked into a second walk over the top of this one.
    // Each of these lets its own sound land first, THEN walks, and only shows
    // the next frame once the walk is spent -- so the wait is always the walk's
    // real length rather than a guess that has to be kept in step with it.
    if (kind === 'door') {
      audio.sfx('door_creak');
      this.queue(450, 2);
      return;
    }
    if (kind === 'key') {
      // PRD frame 8: hasKey, then the bulb flickers hard -- but not before
      // the thought about it has been read and dismissed.  The line used to
      // fade on its own clock and was still on screen under TURN AROUND.
      store.patch({ hasKey: true });
      store.flush();
      audio.sfx('lock_click');
      this.hotspot?.destroy();
      this.hotspot = null;
      // off the table and into your hand, as the flicker frame paints it
      if (this.layer) {
        for (const k of this.layer.list.filter((o) => o instanceof Phaser.GameObjects.Container)) k.destroy();
      }
      this.think('A key... maybe this belongs to the prize case back at the lobby.', () => this.queue(0, 2));
      return;
    }

    if (Math.random() < 0.25) {
      this.time.delayedCall(900 + Math.random() * 900, () => audio.sfx('drip'));
    }
    this.queue(0, WALK_STEPS);
  }

  /**
   * Walk the corridor, and step into the next frame as the last foot lands.
   *
   * EVERY TIMER IT SETS IS KEPT, and the frame it is walking towards is kept
   * with them, so the whole transition can be cut short in one place -- see
   * `skipWalk`.  A chain of anonymous delayed calls could only be waited out.
   */
  private queue(delay: number, steps: number): void {
    this.walkTo = this.index + 1;
    const go = (): void => {
      const walked = this.walk(steps);
      this.pending.push(this.time.delayedCall(walked, () => this.land()));
    };
    if (delay <= 0) go();
    else this.pending.push(this.time.delayedCall(delay, go));
  }

  /** Arrive: drop whatever is still queued and show the frame we set out for. */
  private land(): void {
    const to = this.walkTo;
    this.walkTo = null;
    for (const e of this.pending) e.remove(false);
    this.pending = [];
    if (to !== null) this.show(to);
  }

  /** True if there was a walk to cut short, and it has been cut short. */
  private skipWalk(): boolean {
    if (this.walkTo === null) return false;
    this.land();
    return true;
  }

  /**
   * The sound of covering the ground between two frames, and HOW LONG IT TAKES.
   *
   * Each step of the sequence is a walk down a corridor, and it used to be
   * exactly one footstep: you crossed ten metres of concrete in silence and
   * arrived with a single click.  Four of them, unevenly spaced, is what makes
   * the basement feel walked through rather than clicked through.
   *
   * IT RETURNS ITS OWN LENGTH, and that is the point.  The walk ran for better
   * than a second while `show` was called on the same frame, so the crossfade
   * had already put the next corridor on screen with the last two steps of the
   * previous one still landing on it -- and a second click inside that window
   * started a fresh four on top of the tail of the old four.  Callers wait for
   * this number before moving on, which is what stops both.
   */
  private walk(steps = WALK_STEPS): number {
    let at = 0;
    for (let i = 0; i < steps; i++) {
      if (i === 0) audio.sfx('footstep_concrete', STEP_GAIN);
      else {
        const when = at;
        this.pending.push(this.time.delayedCall(when, () => audio.sfx('footstep_concrete', STEP_GAIN)));
      }
      at += STEP_GAP + Math.random() * STEP_JITTER;
    }
    // The last step is struck at `at - gap`; give it room to ring out.
    return Math.max(0, at - STEP_GAP) + STEP_TAIL;
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
        // Feet on the far wall's floor line (paintReverse's back wall ends at
        // y 116), and small: he is at the other end of the room, which is what
        // makes the next half-second — the whole distance in one go — land.
        y: 116,
        height: 34,
        variant: 'uncanny',
        // Pupils shrunk to a pinprick: a fixed, predatory stare.
        pose: 'constricted',
      });
    });

    // One dry click of a footstep behind you, then nothing at all.
    this.time.delayedCall(260, () => audio.sfx('footstep_concrete', STEP_GAIN));
  }

  /** The dark the 3D scare happens in, and the four seconds after it. */
  paintBlack(c: Phaser.GameObjects.Container): void {
    froggyLayer.clear();
    c.add(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000).setOrigin(0, 0));
  }

  /**
   * A thought, not a line: no name over it, no box round it, lower case and
   * quiet, fading in under the picture and out again.  It is the player
   * working something out, not anybody talking to them.
   */
  private think(line: string, onContinue: () => void): void {
    const t = text(this, GAME_W / 2, GAME_H - 34, line, PALETTE.fog)
      .setOrigin(0.5, 0.5)
      .setMaxWidth(GAME_W - 40)
      .setCenterAlign()
      .setAlpha(0);
    const go = text(this, GAME_W / 2, GAME_H - 13, '[ CONTINUE ]', PALETTE.bone, 8).setOrigin(0.5, 0.5).setAlpha(0);
    const zone = this.add.rectangle(GAME_W / 2, GAME_H - 13, 90, 18, PALETTE.cream, 0).setAlpha(0.001);
    const box = this.add.container(0, 0, [t, go, zone]).setDepth(700);
    this.thought = box;
    this.tweens.add({ targets: t, alpha: 0.85, duration: 500 });
    this.tweens.add({ targets: go, alpha: 0.8, delay: 600, duration: 400 });
    // Continue is live once the line is there to have been read.
    this.time.delayedCall(600, () => {
      if (this.thought !== box) return;
      zone.setInteractive({ useHandCursor: true }).once('pointerdown', () => {
        // Gone in the same frame, not faded: nothing of it is left on the
        // screen the bulb starts to flicker on.
        this.clearThought();
        onContinue();
      });
    });
  }

  /** The thought and its button, off the screen at once. */
  private clearThought(): void {
    if (!this.thought) return;
    this.tweens.killTweensOf(this.thought.list);
    this.thought.destroy();
    this.thought = null;
  }
}
