/**
 * FIND THE FROG.  Medium — 3 tokens in, 6 out.
 *
 * A tank full of green things drifting past each other, and exactly one of
 * them is a frog.  Point at it.  Five times, and the cabinet pays.
 *
 * THE DECOYS ARE THE GAME, so they are built to be nearly right and never
 * quite: a turtle, a lizard, a newt, a beetle, a leaf, a caterpillar, a
 * gecko — all the same greens as the frog, all about the same size, all
 * drifting at about the same speed.  What makes the frog a frog is the two
 * eyes standing UP off the top of its head, and once a player knows that they
 * can find it every time.  That is the intended experience: a puzzle you can
 * learn to solve quickly, not one you squint at and guess.
 *
 * IT GETS HARDER AS IT GOES.  Each find puts more animals in the tank and
 * speeds the drift up, so the fifth is a genuinely crowded screen while the
 * first is nearly a freebie.  The clock is per-find rather than for the whole
 * round, so one slow find is not the end of a run — but it does cost a life,
 * and three lost lives is the game.
 *
 * A WRONG CLICK COSTS TIME, NOT THE ROUND.  Tapping a turtle knocks four
 * seconds off the find you are on and says so.  A game that ended on a misread
 * at this price would be a game that punishes the thing it is asking for.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W, GAME_H } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'findthefrog' as const;

/** Five finds, three lives, and the clock is per find. */
export const TARGET_FINDS = 5;
const LIVES = 3;
const FIND_MS = 20_000;
/** A wrong tap costs this much of the find you are on. */
const WRONG_MS = 4000;

/** The tank: the water the animals drift about in. */
const TANK_T = 30;
const TANK_B = GAME_H - 8;

/** How many things are in there on find 1..5, and how fast they drift. */
const CROWD = [14, 20, 27, 34, 42];
const DRIFT = [11, 14, 17, 20, 24];

/** The greens.  The frog is drawn from the same list as everything else. */
const GREENS = [0x5fbf5a, 0x6fbb6a, 0x4ea85c, 0x7fc96a, 0x3f9450, 0x8ad36f, 0x58b07a];

type Species = 'frog' | 'turtle' | 'lizard' | 'newt' | 'beetle' | 'leaf' | 'grub' | 'gecko';
const DECOYS: Species[] = ['turtle', 'lizard', 'newt', 'beetle', 'leaf', 'grub', 'gecko'];

interface Critter {
  species: Species;
  x: number;
  y: number;
  vx: number;
  vy: number;
  wobble: number;
  body: Phaser.GameObjects.Container;
}

let sceneRef: Phaser.Scene | null = null;
let apiRef: MinigameApi | null = null;
let over = false;
let finds = 0;
let lives = LIVES;
let clock = 0;
let critters: Critter[] = [];
let frogIdx = -1;
let hud: {
  found: Phaser.GameObjects.BitmapText;
  lives: Phaser.GameObjects.BitmapText;
  time: Phaser.GameObjects.Rectangle;
  note: Phaser.GameObjects.BitmapText;
} | null = null;

export const findTheFrog: MinigameModule = {
  id: ID,
  title: 'FIND THE FROG',
  music: 'game_findthefrog',
  rules: 'find it five times',
  payoutNote: 'WIN: 6 TOKENS',
  tutorial: {
    objective: [
      'ONE OF THE GREEN THINGS IS A FROG.',
      'CLICK IT. THE EYES STAND UP OFF ITS HEAD.',
      'FIND IT FIVE TIMES AND THE MACHINE PAYS.',
      'WRONG ONE COSTS FOUR SECONDS. THREE MISSES OUT.',
    ],
    controls: [
      ['MOUSE', 'CLICK THE FROG - OR TAP IT'],
    ],
  },
  // Played entirely by pointing at the thing you are looking for.
  touch: {},

  create(scene: Phaser.Scene, api: MinigameApi) {
    sceneRef = scene;
    apiRef = api;
    over = false;
    finds = 0;
    lives = LIVES;
    clock = FIND_MS;
    critters = [];
    frogIdx = -1;

    paintTank(scene);

    hud = {
      found: text(scene, 5, 21, '', PALETTE.gold).setDepth(60),
      lives: text(scene, GAME_W - 5, 21, '', PALETTE.blood).setOrigin(1, 0).setDepth(60),
      time: scene.add.rectangle(0, TANK_T - 3, GAME_W, 2, PALETTE.tealLight).setOrigin(0, 0).setDepth(60),
      note: centerText(scene, GAME_W / 2, 96, '', PALETTE.gold, 16).setDepth(70).setVisible(false),
    };

    // One handler for the whole tank rather than one per animal: there are
    // forty of them at the top end and they are all moving, so hit-testing the
    // click against where they are NOW is both cheaper and more honest than
    // forty interactive zones chasing their own sprites around.
    scene.add
      .zone(0, TANK_T, GAME_W, TANK_B - TANK_T)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p: Phaser.Input.Pointer) => tap(p.worldX, p.worldY));

    stock(scene);
    refreshHud();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__find = {
        state: () => ({
          finds,
          lives,
          over,
          left: Math.max(0, Math.round(clock / 1000)),
          critters: critters.length,
          frogs: critters.filter((c) => c.species === 'frog').length,
          /** Where the frog is right now, so a test can point at it. */
          frog: frogIdx >= 0 ? { x: Math.round(critters[frogIdx].x), y: Math.round(critters[frogIdx].y) } : null,
          decoy:
            critters.find((c) => c.species !== 'frog') !== undefined
              ? {
                  x: Math.round((critters.find((c) => c.species !== 'frog') as Critter).x),
                  y: Math.round((critters.find((c) => c.species !== 'frog') as Critter).y),
                }
              : null,
          target: TARGET_FINDS,
        }),
        /** Tap at a point, exactly as a finger would. */
        tap: (x: number, y: number) => tap(x, y),
        /** Tap the frog wherever it is. */
        tapFrog: () => {
          if (frogIdx >= 0) tap(critters[frogIdx].x, critters[frogIdx].y);
        },
        setClock: (ms: number) => {
          clock = ms;
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__find;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over || !sceneRef) return;
    const dt = Math.min(0.05, delta / 1000);
    clock -= delta;
    if (clock <= 0) {
      missed();
      return;
    }

    for (const c of critters) {
      c.wobble += dt * 2.4;
      c.x += c.vx * dt;
      c.y += (c.vy + Math.sin(c.wobble) * 5) * dt;
      // The tank wraps rather than bouncing: a bouncing animal reveals itself
      // by turning at the same moment as everything else on the same wall.
      if (c.x < -12) c.x = GAME_W + 12;
      if (c.x > GAME_W + 12) c.x = -12;
      if (c.y < TANK_T - 10) c.y = TANK_B + 8;
      if (c.y > TANK_B + 10) c.y = TANK_T - 8;
      c.body.setPosition(c.x, c.y);
    }

    refreshHud();
  },

  destroy() {
    critters = [];
    hud = null;
    sceneRef = null;
    apiRef = null;
  },
};

// ------------------------------------------------------------------ the tank

function paintTank(scene: Phaser.Scene): void {
  scene.add.rectangle(0, 18, GAME_W, GAME_H - 18, 0x0e2a30).setOrigin(0, 0);
  scene.add.rectangle(0, TANK_T, GAME_W, TANK_B - TANK_T, 0x123b40).setOrigin(0, 0);
  // weed and bubbles, so the tank reads as water rather than a green screen
  for (let i = 0; i < 14; i++) {
    const x = (i * 37) % GAME_W;
    scene.add.rectangle(x, TANK_B, 3, 12 + ((i * 13) % 22), 0x1b5a4a).setOrigin(0, 1).setAlpha(0.6);
  }
  for (let i = 0; i < 20; i++) {
    const b = scene.add.circle((i * 53) % GAME_W, TANK_T + ((i * 29) % (TANK_B - TANK_T)), 1, 0x8fd6e0).setAlpha(0.3);
    scene.tweens.add({ targets: b, y: TANK_T, duration: 4000 + i * 200, repeat: -1, delay: i * 180 });
  }
}

/** Fill the tank for the find we are on: one frog, and a crowd of not-frogs. */
function stock(scene: Phaser.Scene): void {
  for (const c of critters) c.body.destroy();
  critters = [];
  const n = CROWD[Math.min(CROWD.length - 1, finds)];
  const speed = DRIFT[Math.min(DRIFT.length - 1, finds)];

  for (let i = 0; i < n; i++) {
    const species = DECOYS[Phaser.Math.Between(0, DECOYS.length - 1)];
    critters.push(make(scene, species, speed));
  }
  // The frog goes in at a random place in the list, so it is not always the
  // last thing drawn and therefore not always the one on top.
  frogIdx = Phaser.Math.Between(0, critters.length);
  critters.splice(frogIdx, 0, make(scene, 'frog', speed));
  // Drawn in list order, so the depth matches what the hit test walks.
  critters.forEach((c, i) => c.body.setDepth(10 + i));
}

function make(scene: Phaser.Scene, species: Species, speed: number): Critter {
  const colour = GREENS[Phaser.Math.Between(0, GREENS.length - 1)];
  const x = Phaser.Math.Between(8, GAME_W - 8);
  const y = Phaser.Math.Between(TANK_T + 6, TANK_B - 6);
  const a = Math.random() * Math.PI * 2;
  const body = draw(scene, species, colour);
  body.setPosition(x, y);
  return {
    species,
    x,
    y,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed * 0.5,
    wobble: Math.random() * 6,
    body,
  };
}

/**
 * Every animal in the tank, at about the same size and in the same greens.
 *
 * The frog is the only one with its eyes ON TOP, standing proud of the head as
 * two bumps with black pupils.  Everything else keeps its eyes on the side of
 * its head, in its own colour, or has no eyes at all.  That single difference
 * is the entire puzzle, and it is drawn large enough to see at 320x180.
 */
function draw(scene: Phaser.Scene, species: Species, colour: number): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [];
  const dark = Phaser.Display.Color.IntegerToColor(colour).darken(22).color;

  switch (species) {
    case 'frog':
      parts.push(scene.add.ellipse(0, 1, 12, 9, colour));
      parts.push(scene.add.ellipse(0, 3, 7, 4, 0xcfe8a0));
      parts.push(scene.add.ellipse(-5, 4, 4, 2, dark), scene.add.ellipse(5, 4, 4, 2, dark));
      // THE TELL: two eyes standing up off the top of the head.
      parts.push(scene.add.circle(-3, -5, 2.6, colour), scene.add.circle(3, -5, 2.6, colour));
      parts.push(scene.add.circle(-3, -5, 1.3, PALETTE.black), scene.add.circle(3, -5, 1.3, PALETTE.black));
      break;
    case 'turtle':
      parts.push(scene.add.ellipse(0, 0, 13, 10, dark));
      parts.push(scene.add.ellipse(0, 0, 9, 6, colour));
      parts.push(scene.add.circle(7, 1, 2.4, colour));
      parts.push(scene.add.ellipse(-6, 4, 4, 2, colour));
      break;
    case 'lizard':
      parts.push(scene.add.ellipse(-1, 0, 13, 6, colour));
      parts.push(scene.add.circle(6, -1, 3, colour));
      parts.push(scene.add.ellipse(-9, 1, 7, 2, colour));
      parts.push(scene.add.ellipse(-3, 3, 4, 2, dark), scene.add.ellipse(2, 3, 4, 2, dark));
      break;
    case 'newt':
      parts.push(scene.add.ellipse(0, 0, 11, 7, colour));
      parts.push(scene.add.ellipse(-8, 0, 6, 3, colour));
      parts.push(scene.add.circle(5, 0, 2.6, colour));
      parts.push(scene.add.rectangle(0, -4, 8, 1, dark));
      break;
    case 'beetle':
      parts.push(scene.add.ellipse(0, 0, 11, 9, dark));
      parts.push(scene.add.rectangle(0, 0, 1, 9, colour));
      parts.push(scene.add.circle(0, -5, 2.4, colour));
      break;
    case 'leaf':
      parts.push(scene.add.ellipse(0, 0, 13, 7, colour).setRotation(0.4));
      parts.push(scene.add.rectangle(0, 0, 11, 1, dark).setRotation(0.4));
      break;
    case 'grub':
      for (let i = 0; i < 4; i++) parts.push(scene.add.circle(-5 + i * 3.4, i % 2 ? -1 : 1, 3, i === 3 ? dark : colour));
      break;
    case 'gecko':
    default:
      parts.push(scene.add.ellipse(0, 0, 12, 7, colour));
      parts.push(scene.add.circle(6, -1, 3.2, colour));
      parts.push(scene.add.ellipse(-8, 0, 6, 2, dark));
      parts.push(scene.add.circle(7, -1, 1, dark));
      break;
  }
  return scene.add.container(0, 0, parts);
}

// ------------------------------------------------------------------ the tap

function tap(x: number, y: number): void {
  if (over || !sceneRef) return;
  // Topmost first, because that is the one the player can see.
  for (let i = critters.length - 1; i >= 0; i--) {
    const c = critters[i];
    if (Math.abs(c.x - x) > 8 || Math.abs(c.y - y) > 7) continue;
    if (c.species === 'frog') found();
    else wrong();
    return;
  }
  // A tap on open water is not a mistake, it is a miss.  Nothing happens.
}

function found(): void {
  if (!sceneRef) return;
  finds += 1;
  audio.sfx('chime', 0.6);
  sceneRef.cameras.main.flash(120, 120, 255, 160);
  if (finds >= TARGET_FINDS) {
    finish(true, 'FOUND ALL FIVE');
    return;
  }
  note(`FOUND IT  ${finds}/${TARGET_FINDS}`);
  clock = FIND_MS;
  stock(sceneRef);
  refreshHud();
}

function wrong(): void {
  if (!sceneRef) return;
  clock -= WRONG_MS;
  audio.sfx('buzzer', 0.35);
  sceneRef.cameras.main.shake(140, 0.005);
  note('NOT THE FROG  -4s');
}

function missed(): void {
  if (!sceneRef) return;
  lives -= 1;
  audio.sfx('buzzer', 0.5);
  sceneRef.cameras.main.shake(220, 0.008);
  if (lives <= 0) {
    finish(false, 'OUT OF TIME');
    return;
  }
  note(`MISSED IT  -  ${lives} LEFT`);
  clock = FIND_MS;
  stock(sceneRef);
  refreshHud();
}

function note(msg: string): void {
  if (!hud || !sceneRef) return;
  hud.note.setText(msg).setVisible(true).setAlpha(1);
  sceneRef.tweens.killTweensOf(hud.note);
  sceneRef.tweens.add({ targets: hud.note, alpha: 0, delay: 700, duration: 500 });
}

function finish(won: boolean, why: string): void {
  if (over || !sceneRef) return;
  over = true;
  hud?.note.setText(why).setVisible(true).setAlpha(1);
  hud?.note.setTint(won ? PALETTE.gold : PALETTE.blood);
  audio.sfx(won ? 'chime' : 'buzzer');
  if (won) sceneRef.cameras.main.flash(220, 255, 240, 180);
  sceneRef.time.delayedCall(1300, () => (won ? apiRef?.win() : apiRef?.lose()));
}

function refreshHud(): void {
  if (!hud) return;
  hud.found.setText(`FOUND ${finds}/${TARGET_FINDS}`);
  hud.lives.setText('*'.repeat(Math.max(0, lives)));
  const t = Phaser.Math.Clamp(clock / FIND_MS, 0, 1);
  hud.time.setSize(GAME_W * t, 2);
  hud.time.setFillStyle(t < 0.25 ? PALETTE.blood : t < 0.5 ? PALETTE.amber : PALETTE.tealLight);
}
