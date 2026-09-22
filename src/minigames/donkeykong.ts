/**
 * BARREL CLIMB.  Hard — 7 tokens in, 7 out.
 *
 * An original take on the girder-and-barrel climb (PRD MG-7): original level,
 * original art, original name, no borrowed characters.  Six girders, ladders
 * offset so you always have to cross a floor, and barrels that roll the length
 * of a girder and drop to the next.
 *
 * The barrels are the clock.  They spawn faster the higher you get, so the run
 * that stalls halfway is the run that loses.
 *
 * Two kinds of barrel.  The plain orange one rolls, and you jump it.  The pink
 * BOUNCER hops along the girder, higher than you can jump, and the answer to it
 * is the opposite: walk under it while it is up, and jump it only when it is
 * down.  Reading which is which, at speed, is what the top three girders are
 * about.
 *
 * AND THAT IS WHY THEY KEEP OUT OF EACH OTHER'S WAY.  Two answers that are
 * opposites are a wall as soon as both are asked at once, and no input answers
 * "jump this and duck that" in the same tenth of a second.  Three rules — see
 * `JUMP_SPAN` — space the barrels out, put a bouncer back on the girder while
 * it is near a roller, and keep clusters of bouncers hopping in step.  The
 * barrels stay as hard to read; they stop being impossible to pass.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const LEFT = 12;
const RIGHT = GAME_W - 12;
/** Girder tops, bottom first.  The player stands ON these.  Six of them. */
const FLOORS = [166, 142, 118, 94, 70, 46];
const GRAVITY = 460;
/** Peaks about 21px up: over a barrel, under the girder above. */
const JUMP_V = -140;
const RUN = 56;
const CLIMB = 42;
const BARREL_R = 4;
// Fast enough that a barrel's whole trip down is a few seconds.  At 46px/s a
// barrel took half a minute to cross five girders, so they outlived their own
// spawn rate and the bottom floor silted up faster than it could drain.
const BARREL_SPEED = 72;
const LIVES = 3;
/** Ladder x by the floor it rises FROM.  See create(). */
/**
 * Ladder x by the floor it rises FROM.
 *
 * Kept well clear of the girder ends.  Barrels drop at the ends, so a ladder
 * 28px from one put the climb point directly under the drop — you arrived,
 * paused for the half-second it takes to grab the ladder, and were hit by a
 * barrel landing on top of you.  Every death in a scripted climb was at a
 * ladder, not between them.
 */
const LADDER_X = [RIGHT - 64, LEFT + 64, RIGHT - 64, LEFT + 64, 148];
/**
 * The bouncer.  A hop is a full arc from girder to peak and back; at 14px it
 * clears a standing player (whose hit box sits within 8px of the girder) but
 * not a jumping one, which is what makes the two barrel types need opposite
 * answers.
 */
const BOUNCE_H = 14;
const BOUNCE_HZ = 1.6;
const BOUNCER_SPEED = 84;
/** Two in five barrels bounce, from the first one.  Customer's odds. */
const BOUNCER_CHANCE = 0.4;
/** A backstop: barrels should retire themselves, but never let them stack. */
const MAX_BARRELS = 12;

/**
 * How much two barrels of the same kind differ.  A girder of barrels all
 * travelling at exactly one speed is a conveyor belt; a tenth either way is
 * enough that they pull apart and bunch up on their own.
 */
const SPEED_SPREAD = 0.12;
/**
 * BUMPING.  Close enough to be one object, and something has to give.
 *
 * The barrels used to QUEUE: the one behind eased off to hold a gap, down to a
 * fifth of its pace.  What that produced is the thing this game was reported
 * for -- three barrels nose to tail, crawling down the girder at walking pace,
 * occupying the crossing for four or five seconds with no way past and no way
 * to make them go away.  Slowing a hazard down makes it last longer, which is
 * the opposite of what a queue is for.
 *
 * Now nobody brakes.  Every barrel runs at its own pace for its whole life,
 * and when a faster one catches a slower one THE BACK ONE GOES OVER THE EDGE:
 * it drops to the girder below at the point of the bump, the same way a barrel
 * that took a ladder does.  The pile-up cannot form, the path clears itself in
 * a frame, and what the player sees is two barrels colliding and one of them
 * falling off -- which is what barrels do.
 */
const BUMP_GAP = BARREL_R * 2;

/**
 * NO TWO BARRELS MAY ASK FOR OPPOSITE THINGS AT THE SAME PLACE.
 *
 * The two kinds have deliberately opposite answers — you JUMP an orange roller
 * and you WALK UNDER a pink bouncer while it is up — and that is the whole idea
 * of the top girders.  It is also, unhandled, a way to build a wall: an orange
 * one and a pink one arriving together demand a jump and a duck at the same
 * instant, and there is no input that does both.  Two pink ones out of step
 * with each other do the same thing, one up over your head while the other sits
 * on the girder in front of you.
 *
 * Three rules keep the barrels hard and keep them passable, and none of them
 * moves a barrel to somewhere it was not:
 *
 *   BUMPING   a barrel that catches the one in front knocks it off the
 *             girder -- see BUMP_GAP.  Nothing slows down; the pile is
 *             removed instead of being queued.
 *   SETTLING  a bouncer near a roller finishes its hop and STAYS DOWN until it
 *             is clear again.  Both are then ground-level and a single jump
 *             clears the pair.
 *   LOCKSTEP  bouncers near each other hop together, so a cluster of them is
 *             always all up (walk under) or all down (jump once).
 *
 * `JUMP_SPAN` is what any of this is measured against: how far the player
 * travels in one jump, which is how close two hazards may be before they are
 * really one hazard.
 */
const JUMP_SPAN = Math.round(RUN * ((2 * -JUMP_V) / GRAVITY));
/** Mixed pair, both going the same way: a whole extra jump of room. */
const MIXED_GAP = JUMP_SPAN * 2;
/**
 * And a mixed pair CLOSING on each other, which no amount of queuing fixes:
 * the bouncer settles from this far out, which is a shade over one full hop of
 * closing at the speed the two of them shut the gap.
 */
const SETTLE_CLOSING = 130;
/**
 * How fast a settling bouncer comes down: a slam, not a glide.
 *
 * It matters because the way DOWN crosses the same band that the way up does.
 * A bouncer that eases back to the girder spends a tenth of a second at exactly
 * the height that is over a standing player and into a jumping one — which is
 * the wall this is all here to prevent, arriving on the descent instead of the
 * ascent.  At this rate the drop is four frames, and the rules below start it
 * while the roller that caused it is still in the air.
 */
const SETTLE_DROP = 220;

/**
 * The hit box, and the one number that falls out of it.
 *
 * The player is measured from a point `PLAYER_MID` above his feet, `HIT_DY`
 * either side of it.  A barrel `WALK_UNDER` pixels clear of the girder is
 * therefore over a standing player's head — which is the whole bargain the
 * bouncer offers, and the number every rule above is really about.
 */
const HIT_DX = 6;
const HIT_DY = 8;
const PLAYER_MID = 5;
const WALK_UNDER = HIT_DY + PLAYER_MID - BARREL_R;

interface Ladder {
  x: number;
  /** Index of the floor it rises FROM. */
  from: number;
}

interface Barrel {
  /** Only so a harness can follow one barrel across frames. */
  id: number;
  x: number;
  y: number;
  floor: number;
  dir: number;
  falling: boolean;
  /** A bouncer hops; a plain barrel rolls.  See BOUNCE_H. */
  bouncer: boolean;
  /** Where the bouncer is in its hop, radians. */
  phase: number;
  dot: Phaser.GameObjects.Container;
  /**
   * ITS OWN PACE, AND NOTHING ELSE'S.  Drawn once when it is thrown and never
   * touched again: the barrels used to slow each other down (see BUMPING), so
   * a girder with three on it crawled and the crawl was the thing in the way.
   */
  speed: number;
  /**
   * The ladder this barrel has already flipped a coin for, so the 50/50 is
   * decided once per crossing.  Rolling every frame inside the window compounds
   * — five frames at even odds is a 97% chance — and every barrel took the
   * ladder.
   */
  rolledAt: number | null;
  /** Recomputed every frame — see the rules above. */
  settled: boolean;
  /** A bouncer's height above the girder.  Held separately from `phase` so a
   * settling one can be brought down faster than its own arc would. */
  lift: number;
}

let ladders: Ladder[] = [];
let barrels: Barrel[] = [];
let barrelNo = 0;
let player = { x: 0, y: 0, vy: 0, floor: 0, onLadder: false, climbing: false };
let sprite: Phaser.GameObjects.Rectangle | null = null;
let hat: Phaser.GameObjects.Rectangle | null = null;
let lives = LIVES;
let spawnTimer = 0;
let elapsed = 0;
let over = false;
let dying = false;
/** Grace after a respawn.  Without it a barrel sitting on the spawn point
 *  takes all three lives in about two seconds. */
let invulnMs = 0;
/** Where barrels have gone down, so the 50/50 is measurable rather than assumed. */
let drops = { ladder: 0, end: 0 };
/**
 * FROGGY KONG, and how far through a throw he is.  See makeKong.
 *
 * He is drawn at his own comfortable size and then brought down to fit: the
 * top girder is at 46 and the cabinet's own header eats everything above 18,
 * so he has 28 pixels to stand in and he is built in forty.
 */
const KONG_SCALE = 0.62;
let kong: Phaser.GameObjects.Container | null = null;
let throwT = 0;
const THROW_S = 0.42;
let hud: Phaser.GameObjects.BitmapText | null = null;
let keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;

export const donkeyKong: MinigameModule = {
  id: 'donkeykong',
  title: 'BARREL CLIMB',
  music: 'game_donkeykong',
  rules: 'get to the top',
  tutorial: {
    objective: [
      'CLIMB TO THE EXIT AT THE TOP.',
      'FROGGY KONG THROWS BARRELS DOWN AT YOU.',
      'EACH ONE TAKES A LIFE. YOU HAVE THREE.',
      'YELLOW ROLLS AT YOU - JUMP IT.',
      'ORANGE HOPS - WALK UNDER IT WHILE IT IS UP.',
      'ONE THAT CATCHES ANOTHER KNOCKS IT OFF.',
    ],
    controls: [
      ['A / D', 'RUN'],
      ['W / S', 'CLIMB LADDERS'],
      ['SPACE', 'JUMP'],
    ],
  },
  touch: { stick: 'wasd', arrows: true, buttons: [{ label: 'JUMP', key: 'SPACE', primary: true }] },

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    sceneRef = scene;
    over = false;
    dying = false;
    lives = LIVES;
    invulnMs = 0;
    drops = { ladder: 0, end: 0 };
    spawnTimer = 3000; // a moment to get your bearings before the first one
    elapsed = 0;
    barrels = [];
    ladders = [];

    // a brick wall behind the girders, dark, with the mortar just showing
    scene.add.rectangle(0, 18, GAME_W, 162, 0x120a18).setOrigin(0, 0);
    for (let row = 0; row < 24; row++) {
      const y = 20 + row * 7;
      const off = row % 2 ? 7 : 0;
      for (let x = -7 + off; x < GAME_W; x += 14) {
        scene.add.rectangle(x, y, 13, 6, 0x1c1022).setOrigin(0, 0);
      }
    }

    // Mostly alternating, so every floor has to be crossed — but the ladder up
    // to the top girder is deliberately mid-floor.  Alternation put it at
    // LEFT+28, eight pixels from where barrels are thrown, so climbing to the
    // exit meant surfacing directly under the thrower with nowhere to go.
    LADDER_X.forEach((x, from) => ladders.push({ x, from }));

    // girders
    FLOORS.forEach((y, i) => {
      scene.add.rectangle(LEFT, y, RIGHT - LEFT, 4, 0xc0455a).setOrigin(0, 0);
      scene.add.rectangle(LEFT, y + 4, RIGHT - LEFT, 2, 0x7a2233).setOrigin(0, 0);
      // rivets
      for (let x = LEFT + 6; x < RIGHT - 4; x += 16) {
        scene.add.rectangle(x, y + 1, 2, 2, 0xf0879a).setOrigin(0, 0);
      }
      void i;
    });

    for (const l of ladders) {
      const top = FLOORS[l.from + 1];
      const bottom = FLOORS[l.from];
      scene.add.rectangle(l.x - 4, top, 2, bottom - top, 0x46c4bd).setOrigin(0, 0);
      scene.add.rectangle(l.x + 2, top, 2, bottom - top, 0x46c4bd).setOrigin(0, 0);
      for (let y = top + 3; y < bottom; y += 6) {
        scene.add.rectangle(l.x - 4, y, 6, 1, 0x2f8d86).setOrigin(0, 0);
      }
    }

    // the thing at the top that keeps rolling them
    const top = FLOORS[FLOORS.length - 1];
    kong = makeKong(scene, LEFT + 20, top);
    // and the way out, at the very top
    scene.add.rectangle(RIGHT - 30, top - 14, 16, 14, PALETTE.gold).setOrigin(0, 0);
    text(scene, RIGHT - 34, top - 24, 'OUT', PALETTE.gold);

    player = { x: LEFT + 14, y: FLOORS[0], vy: 0, floor: 0, onLadder: false, climbing: false };
    sprite = scene.add.rectangle(player.x, player.y, 7, 11, 0x46a0e0).setOrigin(0.5, 1).setDepth(20);
    hat = scene.add.rectangle(player.x, player.y - 11, 8, 3, PALETTE.cream).setOrigin(0.5, 1).setDepth(21);

    hud = centerText(scene, GAME_W / 2, 26, '', PALETTE.cream);
    refreshHud();

    if (import.meta.env?.DEV) {
      // The harness drives a whole climb to prove the exit is reachable, and
      // guessing at this from the display list is how the last two bugs hid.
      (window as unknown as Record<string, unknown>).__dk = {
        // Lets the harness ask "is this level winnable" separately from "is it
        // survivable", which are different questions and only one of them is
        // about the geometry.
        clearBarrels: () => {
          for (const b of barrels) b.dot.destroy();
          barrels = [];
          spawnTimer = 1e9;
        },
        /**
         * Stand the player down for a while, so the barrels can be watched for
         * a minute without the climb ending underneath the measurement.
         */
        grace: (ms: number) => {
          invulnMs = ms;
        },
        teleport: (floor: number, x: number) => {
          player.floor = floor;
          player.x = x;
          player.y = FLOORS[floor];
          player.vy = 0;
          player.climbing = false;
          place();
        },
        state: () => ({
          player: { ...player },
          lives,
          ladders: ladders.map((l) => ({ ...l })),
          barrels: barrels.map((b) => ({
            id: b.id,
            x: b.x,
            y: b.y,
            floor: b.floor,
            dir: b.dir,
            bouncer: b.bouncer,
            falling: b.falling,
            settled: b.settled,
            speed: b.speed,
            /** How far off the girder it is. */
            lift: b.bouncer ? b.lift : 0,
            /** Off the girder far enough that a standing player walks under it. */
            up: b.bouncer && b.lift > WALK_UNDER,
          })),
          jumpSpan: JUMP_SPAN,
          walkUnder: WALK_UNDER,
          drops: { ...drops },
          floors: FLOORS,
          exitX: RIGHT - 34,
        }),
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__dk;
      });
    }

    const kb = scene.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    keys = {
      left: bind(['A', 'LEFT']),
      right: bind(['D', 'RIGHT']),
      up: bind(['W', 'UP']),
      down: bind(['S', 'DOWN']),
      jump: bind(['SPACE']),
    };
  },

  update(_t: number, delta: number) {
    if (over || !sprite) return;
    const dt = delta / 1000;
    elapsed += delta;

    if (!dying) movePlayer(dt);
    stepBarrels(dt);
    stepKong(dt);

    // They come faster the longer you take, so stalling is not a strategy.
    spawnTimer -= delta;
    if (spawnTimer <= 0) {
      spawnBarrel();
      // A barrel now rolls the whole length of five girders before it retires,
      // which is roughly twenty seconds of life.  At the old rate that put a
      // dozen on screen and crossing a single girder was not survivable.
      spawnTimer = Math.max(2000, 3400 - elapsed / 26);
    }

    if (invulnMs > 0) {
      invulnMs -= delta;
      // blink, so the grace period is visible rather than mysterious
      const on = Math.floor(invulnMs / 90) % 2 === 0;
      sprite.setAlpha(on ? 0.35 : 1);
      hat?.setAlpha(on ? 0.35 : 1);
      if (invulnMs <= 0) {
        sprite.setAlpha(1);
        hat?.setAlpha(1);
      }
    } else if (!dying) {
      checkHits();
    }
  },

  destroy() {
    barrels = [];
    kong = null;
    throwT = 0;
    sprite = null;
    hat = null;
    hud = null;
    apiRef = null;
    sceneRef = null;
  },
};

const held = (g: string): boolean => keys[g]?.some((k) => k.isDown) ?? false;

/**
 * How close you have to be to grab a ladder.  At +/-6 you ran straight past it
 * at 56px/s and ended up parked against the wall with no way up.
 */
const LADDER_GRAB = 10;

function ladderAt(x: number, floor: number): Ladder | null {
  return ladders.find((l) => l.from === floor && Math.abs(l.x - x) < LADDER_GRAB) ?? null;
}

function ladderDownAt(x: number, floor: number): Ladder | null {
  return ladders.find((l) => l.from === floor - 1 && Math.abs(l.x - x) < LADDER_GRAB) ?? null;
}

function movePlayer(dt: number): void {
  if (!sprite || !hat) return;

  // ---- climbing takes over completely: no gravity, no jumping
  if (player.climbing) {
    if (held('up')) player.y -= CLIMB * dt;
    if (held('down')) player.y += CLIMB * dt;

    const top = FLOORS[player.floor + 1];
    const bottom = FLOORS[player.floor];
    // Finish the climb from within a few pixels of the top.  Stopping one pixel
    // short left you stuck on the ladder looking like you were on the girder,
    // with left and right doing nothing.
    if (player.y <= top + 3) {
      player.y = top;
      player.floor++;
      player.climbing = false;
    } else if (player.y >= bottom) {
      player.y = bottom;
      player.climbing = false;
    }
    place();
    return;
  }

  const dx = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
  player.x = Phaser.Math.Clamp(player.x + dx * RUN * dt, LEFT + 4, RIGHT - 4);

  const grounded = player.vy === 0 && Math.abs(player.y - FLOORS[player.floor]) < 0.5;

  if (grounded) {
    if (held('up') && ladderAt(player.x, player.floor)) {
      player.climbing = true;
      player.x = ladderAt(player.x, player.floor)!.x;
      place();
      return;
    }
    if (held('down') && player.floor > 0 && ladderDownAt(player.x, player.floor)) {
      player.climbing = true;
      player.floor--;
      player.x = ladders.find((l) => l.from === player.floor)!.x;
      player.y = FLOORS[player.floor + 1];
      place();
      return;
    }
    if (held('jump')) {
      player.vy = JUMP_V;
      audio.sfx('hop_wet');
    }
  }

  if (!grounded || player.vy !== 0) {
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    const floorY = FLOORS[player.floor];
    if (player.y >= floorY) {
      player.y = floorY;
      player.vy = 0;
    }
  }

  place();

  // the exit sits on the top girder
  if (player.floor === FLOORS.length - 1 && player.x > RIGHT - 34) finish(true);
}

function place(): void {
  sprite?.setPosition(player.x, player.y);
  hat?.setPosition(player.x, player.y - 11);
}

function spawnBarrel(): void {
  if (!sceneRef || barrels.length >= MAX_BARRELS) return;
  const topFloor = FLOORS.length - 1;
  const bouncer = Math.random() < BOUNCER_CHANCE;
  const dot = makeBarrel(sceneRef, bouncer);
  dot.setPosition(LEFT + 20, FLOORS[topFloor] - BARREL_R);
  barrels.push({
    id: ++barrelNo,
    x: LEFT + 20,
    y: FLOORS[topFloor] - BARREL_R,
    floor: topFloor,
    dir: 1,
    falling: false,
    bouncer,
    phase: 0,
    dot,
    rolledAt: null,
    settled: false,
    speed: (bouncer ? BOUNCER_SPEED : BARREL_SPEED) * (1 + (Math.random() - 0.5) * 2 * SPEED_SPREAD),
    lift: 0,
  });
  audio.sfx(bouncer ? 'hop_wet' : 'door_rattle');
  throwT = THROW_S;
}

/**
 * A BARREL THAT LOOKS LIKE A BARREL.
 *
 * It was a circle with a ring round it, which at eight pixels is a coin.  A
 * barrel is a cylinder coming at you end-on: circular ends, and sides that
 * bulge out between them.  Three tones do the bulge -- a lit top-left, the
 * body, and the shadow under the far curve -- and the two hoops read as hoops
 * because they are drawn on the curve rather than across it.
 *
 * Yellow for the ones you jump, orange for the ones that hop, and they are
 * different shapes as well as different colours: colour alone is a coin toss
 * for anyone who cannot separate the two, and these two want OPPOSITE inputs.
 */
function makeBarrel(scene: Phaser.Scene, bouncer: boolean): Phaser.GameObjects.Container {
  const skin = bouncer ? 0xf08a2c : 0xf0c33c;
  const lit = bouncer ? 0xffc06a : 0xffe89a;
  const dark = bouncer ? 0x9c4a10 : 0xa8801a;
  const hoop = bouncer ? 0x6d3208 : 0x6e5410;
  // THE RIM DOES NOT TURN, THE STAVES DO.  Everything that spins lives in its
  // own container inside this one: spinning the whole barrel turned its
  // silhouette into a four-pointed thing every eighth of a turn, because the
  // hoops stuck out past the curve.  Now the outline stays a barrel end and
  // what goes round is what would actually go round.
  const rim = [
    scene.add.circle(0, 0, BARREL_R + 0.5, dark),
    scene.add.circle(0, 0, BARREL_R, skin),
  ];
  const spun = [
    // the shadow down the far side of the curve
    scene.add.ellipse(1.4, 0.8, BARREL_R * 1.4, BARREL_R * 1.7, dark).setAlpha(0.5),
    // the hoops, one either side of the end
    scene.add.rectangle(-2.4, 0, 1, BARREL_R * 1.7, hoop),
    scene.add.rectangle(2.4, 0, 1, BARREL_R * 1.7, hoop),
    // and the end itself, which is what you are actually looking at
    scene.add.circle(-0.4, -0.4, BARREL_R - 1.4, lit),
    scene.add.circle(-0.4, -0.4, BARREL_R - 2.6, skin),
  ];
  const spin = scene.add.container(0, 0, spun);
  const c = scene.add.container(0, 0, [...rim, spin]).setDepth(15);
  c.setData('spin', spin);
  return c;
}

/**
 * FROGGY KONG.
 *
 * He was a brown rectangle with two red squares on it, which is a box with
 * eyes: nothing about it said frog, said animal, or said which way it was
 * facing.  He is built here the way the arcade's own props are -- rounded
 * shapes, three tones a piece, and the shading all coming from one side -- so
 * that a flat sprite reads as something with a front and a back and a bulk to
 * it.
 *
 * Everything hangs off ONE container at his feet, so the whole of him can be
 * leaned into a throw without a single part having to be moved by hand.
 */
function makeKong(scene: Phaser.Scene, x: number, groundY: number): Phaser.GameObjects.Container {
  const SKIN = 0x4e9c4a;
  const LIT = 0x76c86a;
  const DARK = 0x2c6330;
  const BELLY = 0xd8e3a8;

  const part = (o: Phaser.GameObjects.GameObject) => o;
  const bits: Phaser.GameObjects.GameObject[] = [
    // haunches, folded under him: the widest thing about him, at the bottom
    part(scene.add.ellipse(-9, -5, 12, 11, DARK)),
    part(scene.add.ellipse(9, -5, 12, 11, DARK)),
    part(scene.add.ellipse(-9, -6, 9, 8, SKIN)),
    part(scene.add.ellipse(9, -6, 9, 8, SKIN)),
    // feet, splayed forward
    part(scene.add.ellipse(-11, -1, 9, 4, DARK)),
    part(scene.add.ellipse(11, -1, 9, 4, DARK)),
    // the body: a big barrel chest with the light coming from the left
    part(scene.add.ellipse(0, -14, 24, 20, SKIN)),
    part(scene.add.ellipse(5, -13, 16, 17, DARK).setAlpha(0.45)),
    part(scene.add.ellipse(-6, -18, 10, 11, LIT).setAlpha(0.5)),
    part(scene.add.ellipse(0, -11, 13, 11, BELLY)),
    part(scene.add.ellipse(0, -9, 10, 6, 0xeef3cc).setAlpha(0.6)),
  ];
  // arms, out in front and low, because they are for picking barrels up
  const arms: Phaser.GameObjects.GameObject[] = [
    scene.add.ellipse(-13, -13, 7, 14, SKIN),
    scene.add.ellipse(13, -13, 7, 14, SKIN),
    scene.add.ellipse(-13, -16, 6, 7, LIT).setAlpha(0.45),
    scene.add.ellipse(13, -16, 6, 7, LIT).setAlpha(0.45),
    scene.add.ellipse(-14, -7, 8, 5, DARK),
    scene.add.ellipse(14, -7, 8, 5, DARK),
  ];
  // the head: wide, low on the shoulders, with the eyes ON TOP of it
  const head: Phaser.GameObjects.GameObject[] = [
    scene.add.ellipse(0, -26, 22, 13, SKIN),
    scene.add.ellipse(4, -25, 15, 10, DARK).setAlpha(0.4),
    scene.add.ellipse(-5, -29, 9, 6, LIT).setAlpha(0.5),
    // the mouth, a hard line across the whole width of it
    scene.add.rectangle(0, -22, 19, 1.5, 0x1b3a1f),
    // eye mounds, then the eyes, then the pupils
    scene.add.circle(-6, -33, 5, SKIN),
    scene.add.circle(6, -33, 5, SKIN),
    scene.add.circle(-6, -34, 3.6, PALETTE.cream),
    scene.add.circle(6, -34, 3.6, PALETTE.cream),
    scene.add.circle(-6, -34, 1.8, 0x101418),
    scene.add.circle(6, -34, 1.8, 0x101418),
    scene.add.circle(-7, -35.4, 0.9, PALETTE.white).setAlpha(0.8),
    scene.add.circle(5, -35.4, 0.9, PALETTE.white).setAlpha(0.8),
  ];
  const c = scene.add.container(x, groundY, [...bits, ...arms, ...head]).setDepth(14);
  c.setScale(KONG_SCALE);
  c.setData('arms', arms);
  return c;
}

/**
 * The throw, which is the only thing he ever does.
 *
 * He rocks forward over the barrel as it leaves him and settles back, and he
 * breathes the rest of the time -- a thing at the top of the screen that never
 * moves is scenery, and the barrels are supposed to be coming from HIM.
 */
function stepKong(dt: number): void {
  if (!kong) return;
  if (throwT > 0) throwT = Math.max(0, throwT - dt);
  const k = throwT / THROW_S;
  // out and back inside the one beat
  const swing = Math.sin((1 - k) * Math.PI);
  kong.setRotation(-0.22 * swing);
  kong.setScale(KONG_SCALE * (1 + 0.06 * swing), KONG_SCALE * (1 - 0.05 * swing + Math.sin(elapsed / 620) * 0.012));
  for (const a of kong.getData('arms') as Phaser.GameObjects.Ellipse[]) {
    a.setScale(1, 1 + 0.25 * swing);
  }
}

/**
 * Knocked off the girder by the one behind it, at the point of the bump.
 *
 * The same fall a barrel takes off the end or down a ladder, so there is one
 * way a barrel changes floor and one place it is handled.  On the bottom
 * girder there is nothing below to fall to, so it simply rolls on and retires
 * off the end as it always would.
 */
function knockOff(b: Barrel): void {
  if (b.floor === 0 || b.falling) return;
  b.floor--;
  b.falling = true;
  b.rolledAt = null;
  audio.sfx('item_thud', 0.35);
}

/**
 * The three rules, applied before anything moves.  See the block comment on
 * `JUMP_SPAN`: this is what stops a pink one and an orange one turning into a
 * wall no input can answer.
 */
function spaceBarrels(): void {
  for (const b of barrels) b.settled = false;
  for (let i = 0; i < barrels.length; i++) {
    const b = barrels[i];
    if (b.falling) continue;
    for (let j = 0; j < barrels.length; j++) {
      if (i === j) continue;
      const o = barrels[j];
      // A barrel already carries the floor it is DROPPING ONTO, so one still in
      // the air counts for settling: the bouncer starts coming down while the
      // roller is falling towards it, instead of the frame it lands.  It does
      // not count for spacing, because it is not rolling yet.
      if (o.floor !== b.floor) continue;
      const gap = Math.abs(o.x - b.x);
      const mixed = b.bouncer !== o.bouncer;

      // BUMPING.  Close enough to be one object, and the one that drove into
      // the other goes over the edge.  Nothing here slows anything down -- see
      // BUMP_GAP.
      //
      // Which one that is has two answers.  Running the same way it is the one
      // BEHIND, which is the one that caught up.  Head on it is neither and
      // both, so it is the one that was thrown last: the older barrel has been
      // on that girder longer and has more claim to it.  Without the head-on
      // case two barrels closing from opposite ends simply passed through each
      // other, which is the stack the queue used to make, arriving by a
      // different door.
      if (!o.falling && gap < BUMP_GAP) {
        const sameWay = o.dir === b.dir;
        const drove = sameWay ? (o.x - b.x) * b.dir > 0 || (o.x === b.x && b.id > o.id) : b.id > o.id;
        if (drove) {
          knockOff(b);
          break;
        }
      }

      if (!b.bouncer) continue;
      if (mixed) {
        // SETTLING.  Wider when the two of them are closing, because queuing
        // cannot help a pair coming at each other.
        const vb = b.dir * b.speed;
        const vo = o.dir * o.speed;
        const closing = (o.x - b.x) * (vo - vb) < 0;
        if (gap < (closing ? SETTLE_CLOSING : MIXED_GAP)) b.settled = true;
      } else if (!o.falling && gap < MIXED_GAP && j < i) {
        // LOCKSTEP.  The older barrel — the one already on the girder — sets
        // the rhythm, so a cluster is always all up or all down together.
        b.phase = o.phase;
      }
    }
  }
}

function stepBarrels(dt: number): void {
  spaceBarrels();
  for (const b of barrels) {
    if (b.falling) {
      b.y += 150 * dt;
      const target = FLOORS[b.floor] - BARREL_R;
      if (b.y >= target) {
        b.y = target;
        b.falling = false;
        // Roll away from the nearest wall.  Alternating by floor meant a barrel
        // that had just taken a ladder landed on the far side of the next one
        // and rolled away from it, so only a third of them ever got a second
        // coin toss.  Heading for the long side guarantees it crosses.
        b.dir = b.x < (LEFT + RIGHT) / 2 ? 1 : -1;
      }
    } else {
      b.x += b.dir * b.speed * dt;
      if (b.bouncer) {
        // Hop: a half-sine per bounce, so it spends its time up in the air
        // and comes down hard rather than floating.  A SETTLED one finishes
        // the hop it is in and then holds on the girder — it does not drop out
        // of the air, it lands.
        if (b.settled) {
          // Parked on the girder, and the phase parked with it, so that when it
          // is clear again the next hop starts from the ground rather than
          // resuming halfway up an arc it never finished.
          b.lift = Math.max(0, b.lift - SETTLE_DROP * dt);
          b.phase = Math.ceil(b.phase / Math.PI) * Math.PI;
        } else {
          b.phase += dt * BOUNCE_HZ * Math.PI;
          b.lift = Math.abs(Math.sin(b.phase)) * BOUNCE_H;
        }
        b.y = FLOORS[b.floor] - BARREL_R - b.lift;
      }
      // At the end of a girder — or at a ladder, sometimes — they drop.
      // Run the full length of the girder before dropping.  Dropping early —
      // at the first ladder they touched — meant a barrel only ever covered a
      // third of a floor, and the girders were mostly empty.
      const atEnd = b.dir > 0 ? b.x > RIGHT - 4 : b.x < LEFT + 4;
      // Each floor has exactly one ladder leading down from it, and a barrel
      // reaching that ladder tosses a coin: half take it, half roll on to the
      // end of the girder.  One flip per crossing, not one per frame.
      // A bouncer is in the air more than it is on the girder, so it never
      // takes a ladder: it goes off the end, every time.
      const down = b.bouncer ? undefined : ladders.find((ld) => ld.from === b.floor - 1 && Math.abs(ld.x - b.x) < 4);
      let takesLadder = false;
      if (down && b.rolledAt !== down.x) {
        b.rolledAt = down.x; // this ladder is now decided, either way
        takesLadder = Math.random() < 0.5;
      } else if (!down && !atEnd) {
        b.rolledAt = null; // clear of it, so the next ladder gets its own coin
      }

      if ((atEnd || takesLadder) && b.floor > 0) {
        if (takesLadder) drops.ladder++;
        else drops.end++;
        b.floor--;
        b.falling = true;
        b.rolledAt = null;
      }
      // On the bottom girder there is nowhere left to drop to, so they roll
      // straight off the end.  Reversing here instead left them bouncing
      // between the walls forever, and the floor silted up with barrels.
    }
    b.dot.setPosition(b.x, b.y);
    // It ROLLS: the hoops and the end go round with the ground it covers, so
    // the direction it is travelling is readable from the barrel itself.
    (b.dot.getData('spin') as Phaser.GameObjects.Container).setRotation(b.x / BARREL_R);
    if (b.bouncer) {
      // Read off the real height, so a settled one is visibly flat on the
      // girder rather than drawn mid-hop while sitting on the floor.
      const air = b.lift / BOUNCE_H;
      b.dot.setScale(1.1 - air * 0.1, 0.9 + air * 0.2);
    } else {
      b.dot.setScale(1, 1);
    }
  }

  // retire anything that has reached the bottom and run off the end
  barrels = barrels.filter((b) => {
    const done = b.floor === 0 && !b.falling && (b.x < LEFT - 10 || b.x > RIGHT + 10);
    if (done) b.dot.destroy();
    return !done;
  });
}

function checkHits(): void {
  for (const b of barrels) {
    if (Math.abs(b.x - player.x) < HIT_DX && Math.abs(b.y - (player.y - PLAYER_MID)) < HIT_DY) {
      loseLife();
      return;
    }
  }
}

function loseLife(): void {
  if (dying || over) return;
  dying = true;
  lives--;
  audio.sfx('buzzer');
  refreshHud();
  sceneRef?.cameras.main.shake(200, 0.012);

  if (lives <= 0) {
    finish(false);
    return;
  }
  sceneRef?.time.delayedCall(800, () => {
    player = { x: LEFT + 14, y: FLOORS[0], vy: 0, floor: 0, onLadder: false, climbing: false };
    // Sweep the landing zone as well: grace alone still puts you shoulder to
    // shoulder with the barrel that just killed you.
    barrels = barrels.filter((b) => {
      const near = b.floor === 0 && Math.abs(b.x - player.x) < 40;
      if (near) b.dot.destroy();
      return !near;
    });
    place();
    invulnMs = 1500;
    dying = false;
  });
}

function refreshHud(): void {
  hud?.setText(`LIVES ${lives}`);
}

function finish(won: boolean): void {
  if (over) return;
  over = true;
  sceneRef?.time.delayedCall(500, () => (won ? apiRef?.win() : apiRef?.lose()));
}
