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
 * Two kinds of barrel.  The plain one rolls, and you jump it.  The BOUNCER
 * hops along the girder, higher than you can jump, and the answer to it is the
 * opposite: walk under it while it is up, and jump it only when it is down.
 * Reading which is which, at speed, is what the top three girders are about.
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

interface Ladder {
  x: number;
  /** Index of the floor it rises FROM. */
  from: number;
}

interface Barrel {
  x: number;
  y: number;
  floor: number;
  dir: number;
  falling: boolean;
  /** A bouncer hops; a plain barrel rolls.  See BOUNCE_H. */
  bouncer: boolean;
  /** Where the bouncer is in its hop, radians. */
  phase: number;
  dot: Phaser.GameObjects.Arc;
  /**
   * The ladder this barrel has already flipped a coin for, so the 50/50 is
   * decided once per crossing.  Rolling every frame inside the window compounds
   * — five frames at even odds is a 97% chance — and every barrel took the
   * ladder.
   */
  rolledAt: number | null;
}

let ladders: Ladder[] = [];
let barrels: Barrel[] = [];
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
let hud: Phaser.GameObjects.BitmapText | null = null;
let keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;

export const donkeyKong: MinigameModule = {
  id: 'donkeykong',
  title: 'BARREL CLIMB',
  music: 'game_donkeykong',
  rules: 'get to the top',

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
    scene.add.rectangle(LEFT + 6, top - 20, 22, 20, 0x5a3a22).setOrigin(0, 0);
    scene.add.rectangle(LEFT + 10, top - 16, 5, 5, PALETTE.blood).setOrigin(0, 0);
    scene.add.rectangle(LEFT + 19, top - 16, 5, 5, PALETTE.blood).setOrigin(0, 0);
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
          barrels: barrels.map((b) => ({ x: b.x, y: b.y, floor: b.floor, dir: b.dir, bouncer: b.bouncer })),
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
  const dot = sceneRef.add
    .circle(LEFT + 20, FLOORS[topFloor] - BARREL_R, BARREL_R, bouncer ? PALETTE.neon : 0xd9822b)
    .setStrokeStyle(1, bouncer ? 0x8a2050 : 0x7a4a18)
    .setDepth(15);
  barrels.push({
    x: LEFT + 20,
    y: FLOORS[topFloor] - BARREL_R,
    floor: topFloor,
    dir: 1,
    falling: false,
    bouncer,
    phase: 0,
    dot,
    rolledAt: null,
  });
  audio.sfx(bouncer ? 'hop_wet' : 'door_rattle');
}

function stepBarrels(dt: number): void {
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
      b.x += b.dir * (b.bouncer ? BOUNCER_SPEED : BARREL_SPEED) * dt;
      if (b.bouncer) {
        // Hop: a half-sine per bounce, so it spends its time up in the air
        // and comes down hard rather than floating.
        b.phase += dt * BOUNCE_HZ * Math.PI;
        b.y = FLOORS[b.floor] - BARREL_R - Math.abs(Math.sin(b.phase)) * BOUNCE_H;
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
    // spin, so they read as rolling; a bouncer squashes on landing instead
    if (b.bouncer) {
      const air = Math.abs(Math.sin(b.phase));
      b.dot.setScale(1.15 - air * 0.15, 0.8 + air * 0.3);
    } else {
      b.dot.setScale(1, 0.8 + Math.abs(Math.sin(b.x / 6)) * 0.35);
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
    if (Math.abs(b.x - player.x) < 6 && Math.abs(b.y - (player.y - 5)) < 8) {
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
