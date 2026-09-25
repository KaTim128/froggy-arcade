/**
 * FROG CROSS THE ROAD.  Hard — 10 tokens in, 20 out.
 *
 * Eight lanes of traffic between the kerb and the far bank.  Every crossing
 * is ten points and makes the road a little worse: faster cars, more of them,
 * longer ones.  Three lives.  FIVE crossings — fifty points — is the bar:
 * reach it and the run pays twenty tokens for the ten it cost.
 *
 * THE PAYOUT IS FLAT, AND IT USED TO CLIMB.  Fifteen at the bar and one more
 * for every further five crossings, which meant the interesting decision --
 * how far past the bar do you push before the last life goes -- was worth a
 * single token a go.  A tenth of the stake is not a decision, it is a rounding
 * error with a prompt on it.  The bar is the whole game now: get there and it
 * pays double, and everything past it is the high score and nothing else.
 *
 * Nothing about it is timed.  The clock here is your patience: the road only
 * gets harder, so the question is whether you reach the bar at all before the
 * last life goes -- and once you have, whether you take ENTER and walk with it
 * or stay out for a number on the board.
 *
 * The score is the game's own; nothing but tokens ever leaves through the
 * shell (MG-3).  The best score is kept per profile (store.highScores).
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { store } from '../core/state';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const ID = 'frogcross' as const;

/**
 * The bar and what clearing it pays.
 *
 * ONE NUMBER, NOT A FORMULA.  There is no per-bar bonus any more: fifty points
 * is the win and the win is twenty tokens, whether you stop there or cross
 * another twenty times.  See the note at the top of the file.
 */
export const TARGET_POINTS = 50;
export const BASE_REWARD = 20;
export const POINTS_PER_CROSS = 10;

const LANES = 8;
const LANE_H = 14;
/** y of the bottom of the lowest lane; lanes stack upward from here. */
const ROAD_BOTTOM = 156;
const ROAD_TOP = ROAD_BOTTOM - LANES * LANE_H; // 44
const BANK_TOP = 32;
const COL_W = 16;
const LIVES = 3;
const HOP_MS = 90;
/** The instruction holds this long, and the frog holds with it. */
const INTRO_MS = 3000;
const CAR_H = 9;

interface Car {
  x: number;
  lane: number;
  w: number;
  dir: 1 | -1;
  speed: number;
  body: Phaser.GameObjects.Container;
}

interface Lane {
  dir: 1 | -1;
  base: number;
  timer: number;
}

let cars: Car[] = [];
let lanes: Lane[] = [];
let frog = { col: 9, row: 0 };
let sprite: Phaser.GameObjects.Container | null = null;
let eyes: Phaser.GameObjects.Container | null = null;
let points = 0;
let best = 0;
let lives = LIVES;
let crossings = 0;
let hopping = false;
let dead = false;
let over = false;
let invulnMs = 0;
let introMs = 0;
let intro: Phaser.GameObjects.BitmapText | null = null;
/** The controls, on their own line under the banner.  See `create`. */
let introHint: Phaser.GameObjects.BitmapText | null = null;
let introPlate: Phaser.GameObjects.Rectangle | null = null;
let hud: { pts: Phaser.GameObjects.BitmapText; lives: Phaser.GameObjects.BitmapText; best: Phaser.GameObjects.BitmapText; bank: Phaser.GameObjects.BitmapText } | null = null;
let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;

/** Tokens a run is worth, or zero if it never reached the bar. */
export function frogPayout(pts: number): number {
  return pts < TARGET_POINTS ? 0 : BASE_REWARD;
}

const rowY = (row: number): number => (row > LANES ? BANK_TOP + 6 : ROAD_BOTTOM + 7 - row * LANE_H);
const colX = (col: number): number => 8 + col * COL_W;

/** Lighten (t > 0) or darken (t < 0) a packed colour, for panel shading. */
function tint(colour: number, t: number): number {
  const c = Phaser.Display.Color.IntegerToColor(colour);
  const mix = (v: number): number => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t));
  return Phaser.Display.Color.GetColor(mix(c.red), mix(c.green), mix(c.blue));
}
const laneY = (lane: number): number => ROAD_BOTTOM - lane * LANE_H + LANE_H / 2; // centre of lane 1..LANES

export const frogCross: MinigameModule = {
  id: ID,
  title: 'FROG CROSS THE ROAD',
  music: 'game_frogcross',
  rules: 'cross 5 times for 20 tokens',
  tutorial: {
    objective: [
      'CROSS THE ROAD FIVE TIMES.',
      'THAT IS FIFTY POINTS, AND IT PAYS 20.',
      'THREE LIVES. THE ROAD GETS WORSE.',
    ],
    controls: [
      ['W A S D', 'HOP'],
      ['ARROWS', 'HOP'],
    ],
    // ENTER banks what you have, and it is NOT listed here.  It does nothing
    // until there is something to bank, and the moment there is, the HUD says
    // `[ENTER] BANK n TOKENS` in the game itself — which is where a player is
    // when the choice is in front of them.  On the card, before a single
    // crossing, it was a key with nothing behind it.
  },
  touch: { stick: 'wasd', arrows: true, buttons: [{ label: 'BANK', key: 'ENTER' }] },
  payoutNote: 'WIN: 20',

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    sceneRef = scene;
    cars = [];
    lanes = [];
    points = 0;
    best = store.highScore(ID);
    lives = LIVES;
    crossings = 0;
    hopping = false;
    dead = false;
    over = false;
    invulnMs = 0;
    introMs = INTRO_MS;

    // far bank, road, kerb
    scene.add.rectangle(0, 18, GAME_W, 162, 0x10141c).setOrigin(0, 0);
    // ---- THE FAR BANK, which has to read as SAFE from across the road.
    //
    // A flat moss rectangle and a lighter line on top of it.  The one thing
    // this game asks of the player is telling safe ground from a live lane at
    // a glance while something is bearing down on them, so the bank is built
    // to look like a different KIND of surface rather than a different colour:
    // grass in clumps, with depth in it, and a hard bright lip where it meets
    // the tarmac.
    scene.add.rectangle(0, BANK_TOP, GAME_W, ROAD_TOP - BANK_TOP, 0x2c5a30).setOrigin(0, 0);
    for (let i = 0; i < 40; i++) {
      const cx2 = (i * 29 + (i % 5) * 7) % GAME_W;
      const cy2 = BANK_TOP + 2 + ((i * 17) % Math.max(4, ROAD_TOP - BANK_TOP - 6));
      scene.add.ellipse(cx2, cy2, 9 + (i % 3) * 5, 4, i % 2 ? 0x3d7a42 : 0x255028).setAlpha(0.85);
    }
    scene.add.rectangle(0, BANK_TOP, GAME_W, 2, 0x5aa85f).setOrigin(0, 0);
    // the verge where grass meets tarmac: bright, and the last thing you cross
    scene.add.rectangle(0, ROAD_TOP - 3, GAME_W, 3, 0x4a8f4e).setOrigin(0, 0);
    scene.add.rectangle(0, ROAD_TOP - 1, GAME_W, 1, 0x7fc884).setOrigin(0, 0).setAlpha(0.9);
    // ---- THE ROAD, WITH A SURFACE ON IT.
    //
    // It was one flat slab of 0x2a2d33 and a dashed line every lane, which is
    // a grey band with stripes.  Tarmac is patchy, it is lighter where the
    // wheels have polished it and darker at the edges, and it has been dug up
    // and filled in more than once.  None of that is decoration here: the
    // whole game is reading which strip is safe, so the lanes need to be
    // TELLABLE APART at a glance and not just separated by a hairline.
    scene.add.rectangle(0, ROAD_TOP, GAME_W, LANES * LANE_H, 0x2a2d33).setOrigin(0, 0);
    for (let k = 0; k < LANES; k++) {
      const top = ROAD_BOTTOM - (k + 1) * LANE_H;
      // alternate lanes sit a shade apart, so a lane is a band and not a gap
      // between two lines
      scene.add.rectangle(0, top, GAME_W, LANE_H, k % 2 ? 0x2e3138 : 0x282b31).setOrigin(0, 0);
      // the polished wheel tracks down the middle of the lane
      scene.add.rectangle(0, top + LANE_H * 0.32, GAME_W, 2, 0x35383f).setOrigin(0, 0).setAlpha(0.7);
      scene.add.rectangle(0, top + LANE_H * 0.68, GAME_W, 2, 0x35383f).setOrigin(0, 0).setAlpha(0.7);
      // patches and repairs, scattered but deterministic
      for (let i = 0; i < 3; i++) {
        const px2 = ((k * 71 + i * 113) % (GAME_W - 24)) + 6;
        scene.add.rectangle(px2, top + 2 + ((i * 5) % (LANE_H - 6)), 10 + (i % 3) * 7, 3, 0x22252b).setOrigin(0, 0).setAlpha(0.55);
      }
    }
    // grit and chippings, so the surface is not perfectly smooth anywhere
    for (let i = 0; i < 70; i++) {
      const gx = (i * 37 + (i % 7) * 11) % GAME_W;
      const gy = ROAD_TOP + ((i * 23) % (LANES * LANE_H));
      scene.add.rectangle(gx, gy, 1, 1, i % 3 ? 0x3c3f46 : 0x1e2126).setOrigin(0, 0).setAlpha(0.6);
    }
    // and the lane markings over the top of all of it
    for (let k = 1; k < LANES; k++) {
      const y = ROAD_BOTTOM - k * LANE_H;
      for (let x = 4; x < GAME_W; x += 14) {
        scene.add.rectangle(x, y, 7, 1, 0x6e727a).setOrigin(0, 0.5);
        scene.add.rectangle(x, y + 1, 7, 1, 0x1c1f24).setOrigin(0, 0.5).setAlpha(0.5);
      }
    }
    scene.add.rectangle(0, ROAD_BOTTOM, GAME_W, 2, PALETTE.fog).setOrigin(0, 0);
    scene.add.rectangle(0, ROAD_BOTTOM + 2, GAME_W, 178 - ROAD_BOTTOM, PALETTE.slate).setOrigin(0, 0);

    // kerb stones along the pavement, and tufts and a shrub or two on the far bank
    for (let x = 0; x < GAME_W; x += 12) scene.add.rectangle(x, ROAD_BOTTOM + 2, 11, 4, 0x2f3a48).setOrigin(0, 0);
    for (let i = 0; i < 26; i++) {
      const tx = 4 + ((i * 47) % (GAME_W - 8));
      scene.add.rectangle(tx, BANK_TOP + 3 + (i % 3) * 3, 1, 3, PALETTE.mossLight).setOrigin(0.5, 1).setAlpha(0.8);
    }
    // shrubs, kept clear of the two crossing signs below so neither swallows the other
    for (const sx of [62, 118, 196, 252]) scene.add.ellipse(sx, BANK_TOP + 6, 14, 8, 0x2e5e38);

    // ---- THE CROSSING'S OWN SIGNAGE.
    //
    // Two frog-crossing warnings on the verge, the diamond road sign with a
    // frog silhouette on it, because this is a road that runs through his
    // arcade and somebody put them up.  On the bank, clear of the lanes and
    // clear of the lily-pad goal row.
    //
    // The diamond is eleven pixels across the flats: its top tip stops a
    // pixel under the readouts and its bottom tip reaches the verge, which
    // is every pixel the bank has.  Cars in the top lane sit from y46 down,
    // so nothing on the sign can ever hide one.
    const SIGN_Y = BANK_TOP + 6.5;
    for (const sx of [26, GAME_W - 26]) {
      scene.add.rectangle(sx, SIGN_Y, 11, 11, 0x6b5310).setOrigin(0.5, 0.5).setAngle(45);
      scene.add.rectangle(sx, SIGN_Y, 9.5, 9.5, 0xffd45e).setOrigin(0.5, 0.5).setAngle(45);
      // Him on it, in silhouette: a squatting frog seen head on.  The eyes
      // are cut back OUT of the dark head in the sign's own yellow - drawn
      // dark they merged into the skull and the whole thing read as a cat.
      scene.add.rectangle(sx - 2.9, SIGN_Y + 1, 1.6, 2.4, 0x2a2410);
      scene.add.rectangle(sx + 2.9, SIGN_Y + 1, 1.6, 2.4, 0x2a2410);
      scene.add.ellipse(sx, SIGN_Y + 1.6, 6, 3.2, 0x2a2410);
      scene.add.ellipse(sx, SIGN_Y - 1.4, 4.4, 2.6, 0x2a2410);
      scene.add.rectangle(sx - 1.7, SIGN_Y - 1.9, 1, 1, 0xffd45e);
      scene.add.rectangle(sx + 1.7, SIGN_Y - 1.9, 1, 1, 0xffd45e);
    }

    for (let k = 1; k <= LANES; k++) {
      lanes.push({
        dir: k % 2 === 1 ? 1 : -1,
        base: 34 + (k % 3) * 11 + (k > 5 ? 8 : 0),
        timer: 600 + Math.random() * 1400,
      });
    }

    frog = { col: 9, row: 0 };
    // ---- HIM.
    //
    // He was a green rectangle with a cream bar across the top, which was
    // fine when the road was a grey slab and is not fine now.  Same ten by
    // nine footprint, so nothing about the hitbox or the hop moves: a body
    // with a lit back and a shadowed belly, haunches either side, and the
    // eyes kept in their own object because the death animation flattens
    // him and hides them.
    const skin = PALETTE.mossLight;
    const back = tint(skin, 0.3);
    const under = tint(skin, -0.35);
    sprite = scene.add.container(colX(frog.col), rowY(0), [
      scene.add.ellipse(0, 4.4, 10, 3, 0x0d1a12).setAlpha(0.4),
      scene.add.ellipse(-4.2, 2.6, 3.4, 4, under),
      scene.add.ellipse(4.2, 2.6, 3.4, 4, under),
      scene.add.ellipse(0, 0, 9.5, 8, skin),
      scene.add.ellipse(0, -1.6, 6, 3, back).setAlpha(0.6),
      scene.add.ellipse(0, 2.8, 6, 2.4, under).setAlpha(0.75),
      scene.add.rectangle(-3.4, 4.2, 3, 1.5, back),
      scene.add.rectangle(3.4, 4.2, 3, 1.5, back),
    ]).setDepth(20);
    eyes = scene.add.container(colX(frog.col), rowY(0) - 4, [
      scene.add.ellipse(-2.4, 0, 4, 3.4, back),
      scene.add.ellipse(2.4, 0, 4, 3.4, back),
      scene.add.ellipse(-2.4, 0.2, 2.6, 2.2, PALETTE.cream),
      scene.add.ellipse(2.4, 0.2, 2.6, 2.2, PALETTE.cream),
      scene.add.rectangle(-2.4, 0.2, 1.2, 1.6, 0x121a14),
      scene.add.rectangle(2.4, 0.2, 1.2, 1.6, 0x121a14),
    ]).setDepth(21);

    hud = {
      pts: text(scene, 6, 21, '', PALETTE.cream),
      lives: centerText(scene, GAME_W / 2, 25, '', PALETTE.fog),
      best: text(scene, GAME_W - 6, 21, '', PALETTE.gold).setOrigin(1, 0),
      bank: centerText(scene, GAME_W / 2, 168, '', PALETTE.gold).setVisible(false),
    };
    refreshHud();

    // What to do, said once.  It fades after three seconds, and the frog
    // does not move until it has gone.
    // ---- IT HAS TO FIT ON THE SCREEN IT IS DRAWN ON.
    //
    // The font renders at whole multiples of its own cell, so size 16 is two
    // pixels of advance per one: twenty-nine characters of "HOP ACROSS THE
    // ROAD WITH WASD" is three hundred and forty-eight pixels on a three
    // hundred and twenty pixel screen, and the player saw "OP ACROSS THE ROAD
    // WITH WAS".  Nineteen characters is two hundred and twenty-eight, which
    // fits inside the plate with room either side, and the controls go
    // underneath at the ordinary size where they also fit.
    introPlate = scene.add.rectangle(GAME_W / 2, 100, 262, 32, PALETTE.black, 0.7).setDepth(39);
    intro = centerText(scene, GAME_W / 2, 94, 'HOP ACROSS THE ROAD', PALETTE.gold, 16).setDepth(40);
    introHint = centerText(scene, GAME_W / 2, 110, 'WASD OR THE ARROWS', PALETTE.cream).setDepth(40);

    const kb = scene.input.keyboard;
    const on = (names: string[], fn: () => void) => names.forEach((n) => kb?.on(`keydown-${n}`, fn));
    on(['W', 'UP'], () => hop(0, 1));
    on(['S', 'DOWN'], () => hop(0, -1));
    on(['A', 'LEFT'], () => hop(-1, 0));
    on(['D', 'RIGHT'], () => hop(1, 0));
    on(['ENTER'], () => {
      if (!over && points >= TARGET_POINTS) finish();
    });

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__frog = {
        state: () => ({ points, lives, crossings, frog: { ...frog }, cars: cars.length, best }),
        // Straight to the far bank, for proving the scoring without the road.
        cross: () => {
          frog.row = LANES;
          hop(0, 1);
        },
        setPoints: (n: number) => {
          points = n;
          refreshHud();
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__frog;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over || !sprite) return;
    const dt = delta / 1000;

    if (introMs > 0) {
      introMs -= delta;
      // the last 600ms fade it out
      const a = Math.min(1, Math.max(0, introMs / 600));
      intro?.setAlpha(a);
      introHint?.setAlpha(a);
      introPlate?.setAlpha(a * 0.7);
      if (introMs <= 0) {
        intro?.destroy();
        introHint?.destroy();
        introPlate?.destroy();
        intro = null;
        introHint = null;
        introPlate = null;
      }
    }

    stepTraffic(dt, delta);

    if (invulnMs > 0) {
      invulnMs -= delta;
      const on = Math.floor(invulnMs / 90) % 2 === 0;
      sprite.setAlpha(on ? 0.35 : 1);
      eyes?.setAlpha(on ? 0.35 : 1);
      if (invulnMs <= 0) {
        sprite.setAlpha(1);
        eyes?.setAlpha(1);
      }
    } else if (!dead) {
      checkHit();
    }
  },

  destroy() {
    cars = [];
    sprite = null;
    eyes = null;
    intro = null;
    introHint = null;
    introPlate = null;
    hud = null;
    apiRef = null;
    sceneRef = null;
  },
};

/**
 * How much worse the road is right now.  Speed climbs steadily and the gaps
 * close, and both keep going: there is no level at which it stops getting
 * harder, which is what makes a high score mean something.
 */
function speedMul(): number {
  return 1 + crossings * 0.11;
}
function gapMul(): number {
  return Math.max(0.42, 1 - crossings * 0.055);
}
function truckChance(): number {
  return Math.min(0.5, 0.08 + crossings * 0.03);
}

function stepTraffic(dt: number, delta: number): void {
  if (!sceneRef) return;

  lanes.forEach((lane, i) => {
    lane.timer -= delta;
    if (lane.timer > 0) return;
    const k = i + 1;
    const truck = Math.random() < truckChance();
    const w = truck ? 30 : 18;
    const speed = lane.base * speedMul();
    const x = lane.dir > 0 ? -w : GAME_W + w;
    // Never drop one on top of the last: the gap has to be a gap.
    const last = cars.filter((c) => c.lane === k).sort((a, b) => (lane.dir > 0 ? a.x - b.x : b.x - a.x))[0];
    if (last && Math.abs(last.x - x) < w + 22) {
      lane.timer = 200;
      return;
    }
    const colour = truck ? PALETTE.steel : [PALETTE.ember, PALETTE.neon, PALETTE.tealLight, PALETTE.amber][k % 4];
    // ---- THE VEHICLE ITSELF.
    //
    // Nine pixels of height to work with, so every band has to earn its row:
    // a shadow on the tarmac under it, a lit top edge, the paint, a dark
    // sill, the glass, and the lamps.  A car you can read in a tenth of a
    // second is the whole game, so the silhouette is built from the roof
    // down rather than being a coloured slab with a window in it.
    const dir = lane.dir;
    const shade = tint(colour, -0.42);
    const lit = tint(colour, 0.34);
    const parts: Phaser.GameObjects.GameObject[] = [];
    const add = (o: Phaser.GameObjects.GameObject): void => {
      parts.push(o);
    };
    // the shadow it throws on the road, offset the way it is travelling
    add(sceneRef!.add.ellipse(0, CAR_H / 2 + 1, w + 2, 4, 0x15171c).setAlpha(0.45));
    // wheels, under the sill so only the tyre shows
    for (const wx of [-w / 3, w / 3]) {
      add(sceneRef!.add.rectangle(wx, CAR_H / 2 - 0.5, 5, 3, 0x0f1115));
      add(sceneRef!.add.rectangle(wx, CAR_H / 2 - 1, 5, 1, 0x3a3f48).setAlpha(0.7));
    }
    add(sceneRef!.add.rectangle(0, 0, w, CAR_H - 2, colour).setOrigin(0.5, 0.5));
    // lit top edge and the dark sill that sits it on its wheels
    add(sceneRef!.add.rectangle(0, -CAR_H / 2 + 1.5, w - 2, 1, lit).setAlpha(0.85));
    add(sceneRef!.add.rectangle(0, CAR_H / 2 - 2, w, 1.5, shade));
    if (truck) {
      // a cab at the front and a slatted box behind it
      add(sceneRef!.add.rectangle(-(w / 2 - 5) * dir, -1.5, 9, 4, 0x2a3440));
      add(sceneRef!.add.rectangle((w / 2 - 4) * dir, -1.5, 6, 4, shade));
      add(sceneRef!.add.rectangle((w / 2 - 4.5) * dir, -1.5, 4, 3, 0x9fd0e8).setAlpha(0.8));
      for (let i = -2; i <= 2; i++) add(sceneRef!.add.rectangle(-(w / 2 - 5) * dir + i * 2.5, -1.5, 1, 4, 0x1d2530).setAlpha(0.6));
    } else {
      // cabin, then the glass inside it, brighter at the front
      add(sceneRef!.add.rectangle(0, -1.5, w * 0.56, 4, shade));
      add(sceneRef!.add.rectangle(0, -1.5, w * 0.5, 3, 0x1a2230));
      add(sceneRef!.add.rectangle(w * 0.16 * dir, -2, w * 0.14, 2, 0x8fc4e0).setAlpha(0.75));
    }
    // headlamp and its spill on the tarmac ahead, and the tail light behind
    add(sceneRef!.add.rectangle((w / 2 - 1) * dir, -1, 2, 2, 0xfff6c0));
    add(sceneRef!.add.rectangle((w / 2 + 3) * dir, 0, 7, 3, 0xfff0b0).setAlpha(0.14));
    add(sceneRef!.add.rectangle((-w / 2 + 1) * dir, -1, 2, 2, 0xff3a3a));
    // bumpers, so front and back are different shapes
    add(sceneRef!.add.rectangle((w / 2 - 0.5) * dir, 1.5, 1.5, 3, lit).setAlpha(0.8));
    const body = sceneRef!.add.container(x, laneY(k), parts).setDepth(10);
    cars.push({ x, lane: k, w, dir: lane.dir, speed, body });
    lane.timer = (1500 + Math.random() * 1600) * gapMul();
  });

  for (const c of cars) {
    c.x += c.dir * c.speed * dt;
    c.body.x = c.x;
  }
  cars = cars.filter((c) => {
    const gone = c.dir > 0 ? c.x > GAME_W + c.w : c.x < -c.w;
    if (gone) c.body.destroy();
    return !gone;
  });
}

function hop(dc: number, dr: number): void {
  if (over || dead || hopping || introMs > 0 || !sprite || !sceneRef) return;
  const col = Phaser.Math.Clamp(frog.col + dc, 0, 18);
  const row = Phaser.Math.Clamp(frog.row + dr, 0, LANES + 1);
  if (col === frog.col && row === frog.row) return;
  frog.col = col;
  frog.row = row;
  hopping = true;
  audio.sfx('hop_wet', 0.5);
  sceneRef.tweens.add({
    targets: [sprite, eyes],
    x: colX(col),
    duration: HOP_MS,
    onUpdate: () => place(),
    onComplete: () => {
      hopping = false;
      place();
      if (frog.row > LANES) crossed();
    },
  });
}

function place(): void {
  if (!sprite || !eyes) return;
  sprite.setPosition(sprite.x, rowY(frog.row));
  eyes.setPosition(sprite.x, rowY(frog.row) - 4);
}

function crossed(): void {
  points += POINTS_PER_CROSS;
  crossings++;
  audio.sfx('chime');
  if (points > best) {
    best = points;
    store.setHighScore(ID, best);
  }
  refreshHud();
  // Back to the kerb, from the far side, with the road a notch worse.
  hopping = true;
  sceneRef?.time.delayedCall(350, () => {
    frog = { col: 9, row: 0 };
    sprite?.setX(colX(frog.col));
    eyes?.setX(colX(frog.col));
    place();
    hopping = false;
  });
}

function checkHit(): void {
  if (!sprite || frog.row < 1 || frog.row > LANES) return;
  const fx = sprite.x;
  for (const c of cars) {
    if (c.lane !== frog.row) continue;
    if (Math.abs(c.x - fx) < c.w / 2 + 4) {
      squash();
      return;
    }
  }
}

function squash(): void {
  if (dead || over) return;
  dead = true;
  lives--;
  audio.sfx('buzzer');
  sceneRef?.cameras.main.shake(180, 0.01);
  sprite?.setScale(1.4, 0.4);
  eyes?.setVisible(false);
  refreshHud();

  if (lives <= 0) {
    finish();
    return;
  }
  sceneRef?.time.delayedCall(700, () => {
    frog = { col: 9, row: 0 };
    sprite?.setScale(1, 1).setX(colX(frog.col));
    eyes?.setVisible(true).setX(colX(frog.col));
    place();
    invulnMs = 1200;
    dead = false;
  });
}

function refreshHud(): void {
  if (!hud) return;
  hud.pts.setText(`PTS ${points}`);
  hud.lives.setText(`LIVES ${lives}`);
  hud.best.setText(`BEST ${best}`);
  const banked = frogPayout(points);
  hud.bank.setText(`[ENTER] BANK ${banked} TOKENS`).setVisible(banked > 0);
}

function finish(): void {
  if (over) return;
  over = true;
  store.setHighScore(ID, points);
  const payout = frogPayout(points);
  sceneRef?.time.delayedCall(500, () => (payout > 0 ? apiRef?.win(payout) : apiRef?.lose()));
}
