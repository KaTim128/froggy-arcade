/**
 * Shared pixel-UI helpers.  Placeholder-grade by design (PRD §11.5): flat
 * rectangles until the art pass.  The text is not placeholder — it is the
 * 1-bit font in render/pixelFont.ts, because a browser-rasterised font cannot
 * be crisp inside a 320x180 buffer.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from './audio';
import { ensurePixelFont, FONT_KEY, FONT_H, FONT_ADVANCE } from '../render/pixelFont';
import { froggyLayer } from '../render/froggyLayer';
import { GAME_W as GAME_W_UI, GAME_H as GAME_H_UI } from '../render/pixelScaler';

/**
 * `size` is a target pixel height, kept for the call sites that ask for big
 * text.  It snaps to a whole multiple of the font's 8px cell: a fractional
 * scale would resample the glyphs and undo the whole point of them.
 */
export function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  color: number = PALETTE.cream,
  size = FONT_H,
): Phaser.GameObjects.BitmapText {
  ensurePixelFont(scene);
  const scale = Math.max(1, Math.round(size / FONT_H));
  // RetroFont measures itself by cell WIDTH, so the size that renders a glyph
  // 1:1 is the cell advance — passing FONT_H here silently scales it by 1.6.
  const t = scene.add.bitmapText(x, y, FONT_KEY, str, FONT_ADVANCE * scale);
  t.setTint(color);
  keepOnScreen(scene, t);
  return t;
}

/**
 * ---- NO LINE OF TEXT RUNS OFF THE PICTURE.
 *
 * Every string in the building goes through `text`, so this is the one place
 * that can promise it for all of them: a line whose ends would fall outside
 * the 320-pixel frame is slid back inside it, however it got there -- a long
 * status line, a number that grew a digit, a label placed near an edge.  It is
 * checked when the line is first drawn (by which time its origin and any
 * container it went into are known) and again whenever its text changes, and
 * a line the code has since MOVED is measured from where it was moved to.
 * A line entirely off the picture is left alone: that is something sliding in
 * or out on purpose, not something that does not fit.
 */
const EDGE = 2;
interface Placed {
  /** Where the code put it. */
  ax: number;
  ay: number;
  /** Where this put it, to tell a move by the code from a nudge by this. */
  x: number;
  y: number;
}
const placed = new WeakMap<Phaser.GameObjects.BitmapText, Placed>();
const dirty = new WeakMap<Phaser.Scene, Set<Phaser.GameObjects.BitmapText>>();

function keepOnScreen(scene: Phaser.Scene, t: Phaser.GameObjects.BitmapText): void {
  let set = dirty.get(scene);
  if (!set) {
    const fresh = new Set<Phaser.GameObjects.BitmapText>();
    set = fresh;
    dirty.set(scene, fresh);
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, () => {
      for (const d of fresh) fitInside(d);
      fresh.clear();
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      fresh.clear();
      dirty.delete(scene);
    });
  }
  set.add(t);
  const setText = t.setText.bind(t);
  t.setText = (value: string | string[]) => {
    setText(value);
    dirty.get(scene)?.add(t);
    return t;
  };
}

function fitInside(t: Phaser.GameObjects.BitmapText): void {
  if (!t.active || !t.scene) return;
  const was = placed.get(t);
  const ax = was && t.x === was.x ? was.ax : t.x;
  const ay = was && t.y === was.y ? was.ay : t.y;
  // Where the parent containers put it, assuming they are not scaled -- none
  // of the ones text goes into are.
  let ox = 0;
  let oy = 0;
  for (let c = t.parentContainer; c; c = c.parentContainer) {
    ox += c.x;
    oy += c.y;
  }
  const x = ax + nudge(ox + ax - t.width * t.originX, t.width, GAME_W_UI);
  const y = ay + nudge(oy + ay - t.height * t.originY, t.height, GAME_H_UI);
  const rx = x === ax ? ax : Math.round(x);
  const ry = y === ay ? ay : Math.round(y);
  if (t.x !== rx) t.x = rx;
  if (t.y !== ry) t.y = ry;
  placed.set(t, { ax, ay, x: rx, y: ry });
}

/** How far a span starting at `lo`, `size` long, has to move to sit in 0..`max`. */
function nudge(lo: number, size: number, max: number): number {
  const hi = lo + size;
  if (hi <= 0 || lo >= max) return 0;
  if (size > max - EDGE * 2) return (max - size) / 2 - lo;
  if (lo < EDGE) return EDGE - lo;
  if (hi > max - EDGE) return max - EDGE - hi;
  return 0;
}

export function centerText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  color: number = PALETTE.cream,
  size = FONT_H,
): Phaser.GameObjects.BitmapText {
  return text(scene, x, y, str, color, size).setOrigin(0.5, 0.5);
}

export interface ButtonOpts {
  width?: number;
  height?: number;
  fill?: number;
  hoverFill?: number;
  textColor?: number;
  disabled?: boolean;
}

export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOpts = {},
): Phaser.GameObjects.Container {
  const w = opts.width ?? Math.max(48, label.length * 6 + 12);
  const h = opts.height ?? 15;
  const fill = opts.fill ?? PALETTE.plum;
  const hoverFill = opts.hoverFill ?? PALETTE.neonDim;

  const box = scene.add.rectangle(0, 0, w, h, fill).setStrokeStyle(1, PALETTE.neon);
  const lbl = centerText(scene, 0, 0, label, opts.textColor ?? PALETTE.cream);
  const c = scene.add.container(x, y, [box, lbl]);
  c.setSize(w, h);
  // Phaser normalises the local point by the display origin BEFORE testing it
  // (pointWithinHitArea adds displayOriginX/Y), and a sized container's origin
  // is its centre.  So the hit area is measured from the top-left corner, not
  // from the middle: the old -w/2,-h/2 rectangle put every button's hot zone up
  // and to the left of the button you can see, which is why clicking CREATE on
  // the profile screen — or the middle of any button — did nothing.
  c.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);

  if (opts.disabled) {
    box.setFillStyle(PALETTE.slate);
    box.setStrokeStyle(1, PALETTE.steel);
    lbl.setTint(PALETTE.ash);
    return c;
  }

  c.on('pointerover', () => {
    box.setFillStyle(hoverFill);
    audio.sfx('ui_hover');
    scene.tweens.add({ targets: c, y: y - 1, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
  });
  c.on('pointerout', () => box.setFillStyle(fill));
  c.on('pointerdown', () => {
    audio.sfx('ui_blip');
    onClick();
  });
  return c;
}

/** PRD SM-5: fade out 300ms -> teardown -> build -> fade in 300ms. */
export const FADE_MS = 300;

export function fadeToScene(scene: Phaser.Scene, key: string, data?: object): void {
  // Froggy is composited on his own canvas above the game buffer, and the
  // camera fade does not own that canvas -- so without this he stays brightly
  // lit over a room going to black.  The same progress that darkens the room
  // darkens him, so the two are never out of step.
  scene.cameras.main.fadeOut(FADE_MS, 0, 0, 0, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
    froggyLayer.setDim(1 - progress);
  });
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    froggyLayer.setDim(0);
    // ...AND HE COMES BACK UP WITH THE NEXT ROOM, whoever builds it.  The dim
    // is a CSS filter on his own canvas, so it outlives the scene that set it:
    // a scene that fades itself in with the camera directly (the two where he
    // tells you you are out of tokens did) drew the cozy portrait at
    // brightness zero -- a solid black Froggy.  Restored the moment the next
    // scene has been created; one that uses `fadeIn` below still ramps him
    // up with the room, because its fade drives the dim from then on.
    const next = scene.scene.get(key);
    next?.events.once(Phaser.Scenes.Events.CREATE, () => froggyLayer.setDim(1));
    // ALWAYS SOMETHING, never nothing.  Started without data, Phaser hands the
    // scene whatever it was given LAST time -- so walking in off the street
    // put you back where you had last come in from (the lounge doorway, a
    // cabinet) instead of in front of the doors you just came through.
    scene.scene.start(key, data ?? {});
  });
}

export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(FADE_MS, 0, 0, 0, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
    froggyLayer.setDim(progress);
  });
}

export interface ConfirmOpts {
  /** One to three short lines, centred. */
  lines: string[];
  confirm: string;
  cancel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Stroke colour of the panel. */
  edge?: number;
  depth?: number;
}

/**
 * A yes-or-no panel over whatever is on screen.
 *
 * It swallows every click that is not on one of its two buttons -- a full
 * screen blocker sits under the panel -- so nothing underneath can be pressed
 * while the question is up.  Sized to its longest line, and never wider than
 * the screen less a margin, so the question cannot run off the edge.
 */
export function confirmDialog(scene: Phaser.Scene, opts: ConfirmOpts): Phaser.GameObjects.Container {
  const depth = opts.depth ?? 2000;
  const longest = Math.max(...opts.lines.map((l) => l.length), 20);
  const w = Math.min(GAME_W_UI - 16, longest * FONT_ADVANCE + 24);
  const h = 30 + opts.lines.length * 10 + 16;
  const cx = GAME_W_UI / 2;
  const cy = GAME_H_UI / 2;

  const blocker = scene.add.rectangle(0, 0, GAME_W_UI, GAME_H_UI, PALETTE.black, 0.6).setOrigin(0, 0).setInteractive();
  const panel = scene.add.rectangle(cx, cy, w, h, PALETTE.ink).setStrokeStyle(1, opts.edge ?? PALETTE.neon);
  const parts: Phaser.GameObjects.GameObject[] = [blocker, panel];
  const top = cy - h / 2 + 12;
  opts.lines.forEach((l, i) => parts.push(centerText(scene, cx, top + i * 10, l, i === 0 ? PALETTE.cream : PALETTE.gold)));

  let done = false;
  const c = scene.add.container(0, 0).setDepth(depth);
  const choose = (fn: () => void) => {
    if (done) return;
    done = true;
    c.destroy();
    fn();
  };
  const by = cy + h / 2 - 12;
  const bw = Math.max(64, opts.confirm.length * FONT_ADVANCE + 12);
  parts.push(
    button(scene, cx - bw / 2 - 6, by, opts.confirm, () => choose(opts.onConfirm), {
      width: bw,
      height: 13,
      fill: 0x5a1a22,
      hoverFill: 0x8a2b34,
    }),
    button(scene, cx + 38, by, opts.cancel ?? 'CANCEL', () => choose(opts.onCancel), { width: 64, height: 13 }),
  );
  c.add(parts);
  return c;
}

/** What walking out of a paid game costs, as one or two lines. */
export function forfeitLines(risk: number): string[] {
  return risk > 0
    ? [`QUITTING WILL FORFEIT ${risk} TOKEN${risk === 1 ? '' : 'S'}.`]
    : ['NOTHING IS RIDING ON IT RIGHT NOW.'];
}
