/**
 * BARREL CLIMB.  Hard — 5 tokens in, 10 out.
 *
 * An original take on the girder-and-barrel climb (PRD MG-7): original level,
 * original art, original name, no borrowed characters.  Five girders, ladders
 * offset so you always have to cross a floor, and barrels that roll the length
 * of a girder and drop to the next.
 *
 * The barrels are the clock.  They spawn faster the higher you get, so the run
 * that stalls halfway is the run that loses.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';

const LEFT = 24;
const RIGHT = GAME_W - 24;
/** Girder tops, bottom first.  The player stands ON these. */
const FLOORS = [166, 138, 110, 82, 54];
const GRAVITY = 460;
const JUMP_V = -168;
const RUN = 56;
const CLIMB = 42;
const BARREL_R = 4;
const BARREL_SPEED = 46;
const LIVES = 3;

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
  dot: Phaser.GameObjects.Arc;
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
let hud: Phaser.GameObjects.BitmapText | null = null;
let keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;

export const donkeyKong: MinigameModule = {
  id: 'donkeykong',
  title: 'BARREL CLIMB',
  rules: 'get to the top',

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    sceneRef = scene;
    over = false;
    dying = false;
    lives = LIVES;
    invulnMs = 0;
    spawnTimer = 2600; // a moment to get your bearings before the first one
    elapsed = 0;
    barrels = [];
    ladders = [];

    scene.add.rectangle(0, 18, GAME_W, 162, 0x120a18).setOrigin(0, 0);

    // Ladders alternate ends so every floor has to be crossed.
    for (let f = 0; f < FLOORS.length - 1; f++) {
      const x = f % 2 === 0 ? RIGHT - 28 : LEFT + 28;
      ladders.push({ x, from: f });
    }

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
    scene.add.rectangle(LEFT + 6, FLOORS[4] - 20, 22, 20, 0x5a3a22).setOrigin(0, 0);
    scene.add.rectangle(LEFT + 10, FLOORS[4] - 16, 5, 5, PALETTE.blood).setOrigin(0, 0);
    scene.add.rectangle(LEFT + 19, FLOORS[4] - 16, 5, 5, PALETTE.blood).setOrigin(0, 0);
    // and the way out, at the very top
    scene.add.rectangle(RIGHT - 30, FLOORS[4] - 14, 16, 14, PALETTE.gold).setOrigin(0, 0);
    text(scene, RIGHT - 34, FLOORS[4] - 24, 'OUT', PALETTE.gold);

    player = { x: LEFT + 14, y: FLOORS[0], vy: 0, floor: 0, onLadder: false, climbing: false };
    sprite = scene.add.rectangle(player.x, player.y, 7, 11, 0x46a0e0).setOrigin(0.5, 1).setDepth(20);
    hat = scene.add.rectangle(player.x, player.y - 11, 8, 3, PALETTE.cream).setOrigin(0.5, 1).setDepth(21);

    hud = centerText(scene, GAME_W / 2, 26, '', PALETTE.cream);
    refreshHud();

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
      spawnTimer = Math.max(900, 2100 - elapsed / 22);
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

function ladderAt(x: number, floor: number): Ladder | null {
  return ladders.find((l) => l.from === floor && Math.abs(l.x - x) < 6) ?? null;
}

function ladderDownAt(x: number, floor: number): Ladder | null {
  return ladders.find((l) => l.from === floor - 1 && Math.abs(l.x - x) < 6) ?? null;
}

function movePlayer(dt: number): void {
  if (!sprite || !hat) return;

  // ---- climbing takes over completely: no gravity, no jumping
  if (player.climbing) {
    if (held('up')) player.y -= CLIMB * dt;
    if (held('down')) player.y += CLIMB * dt;

    const top = FLOORS[player.floor + 1];
    const bottom = FLOORS[player.floor];
    if (player.y <= top) {
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
  if (!sceneRef) return;
  const topFloor = FLOORS.length - 1;
  const dot = sceneRef.add.circle(LEFT + 20, FLOORS[topFloor] - BARREL_R, BARREL_R, 0xd9822b).setDepth(15);
  barrels.push({ x: LEFT + 20, y: FLOORS[topFloor] - BARREL_R, floor: topFloor, dir: 1, falling: false, dot });
  audio.sfx('door_rattle');
}

function stepBarrels(dt: number): void {
  for (const b of barrels) {
    if (b.falling) {
      b.y += 150 * dt;
      const target = FLOORS[b.floor] - BARREL_R;
      if (b.y >= target) {
        b.y = target;
        b.falling = false;
        b.dir = b.floor % 2 === 0 ? 1 : -1;
      }
    } else {
      b.x += b.dir * BARREL_SPEED * dt;
      // At the end of a girder — or at a ladder, sometimes — they drop.
      const atEnd = b.dir > 0 ? b.x > RIGHT - 6 : b.x < LEFT + 6;
      const l = ladders.find((ld) => ld.from === b.floor - 1 && Math.abs(ld.x - b.x) < 3);
      if ((atEnd || (l && Math.random() < 0.25)) && b.floor > 0) {
        b.floor--;
        b.falling = true;
      } else if (atEnd) {
        b.dir *= -1;
      }
    }
    b.dot.setPosition(b.x, b.y);
    // spin, so they read as rolling
    b.dot.setScale(1, 0.8 + Math.abs(Math.sin(b.x / 6)) * 0.35);
  }

  // retire anything that has reached the bottom and run off the end
  barrels = barrels.filter((b) => {
    const done = b.floor === 0 && (b.x < LEFT + 2 || b.x > RIGHT - 2);
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
