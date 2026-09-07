/**
 * Whack-a-Frog.  PRD §9.6 — Medium, 3 tokens in, 6 out.
 *
 * Nine holes, 25 hits in 40 seconds, ramping speed.
 *
 * THE CAMEO (PRD §9.6 / VOC-21): roughly 1 in 20 frogs is Froggy himself —
 * smooth, non-pixel, out of place among the pixel frogs.  Whacking him:
 *   - does not count as a hit
 *   - costs nothing
 *   - plays NO SOUND AT ALL
 *   - he stares at the player for 1.2s and goes back down
 * The game never comments.  There is no achievement and no follow-up.  He
 * occupies a hole for the full 1.2s, which mildly hurts the score.  That is the
 * only mechanical consequence, and the player will assume it is a bug.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import { froggyLayer } from '../render/froggyLayer';
import { drawFroggy } from '../froggy/froggy';
import type { MinigameApi, MinigameModule } from './types';

const TARGET_HITS = 25;
const ROUND_MS = 40_000;
const UP_MS_START = 1100;
const UP_MS_END = 650;
const SPAWN_MS_START = 750;
const SPAWN_MS_END = 450;
const MAX_UP = 3;
const FROGGY_CHANCE = 1 / 20;
const FROGGY_STARE_MS = 1200;

interface Hole {
  x: number;
  y: number;
  /** null = empty */
  occupant: 'frog' | 'froggy' | null;
  timer: number;
  sprite: Phaser.GameObjects.Container;
  hit: boolean;
}

let holes: Hole[] = [];
let hits = 0;
let timeLeft = ROUND_MS;
let spawnTimer = 0;
let hud: Phaser.GameObjects.BitmapText | null = null;
let over = false;
let apiRef: MinigameApi | null = null;

export const whackAFrog: MinigameModule = {
  id: 'whack',
  title: 'WHACK-A-FROG',
  rules: '25 hits in 40 seconds',

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    hits = 0;
    timeLeft = ROUND_MS;
    spawnTimer = 0;
    over = false;
    holes = [];

    scene.add.rectangle(0, 18, GAME_W, 162, PALETTE.moss).setOrigin(0, 0);
    hud = centerText(scene, GAME_W / 2, 26, '', PALETTE.cream);

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const x = 100 + c * 60;
        const y = 62 + r * 42;

        scene.add.ellipse(x, y + 10, 40, 14, PALETTE.ink);

        // the pixel frog: a plain sprite, like everything else in this world
        const body = scene.add.rectangle(0, 0, 22, 20, PALETTE.mossLight).setOrigin(0.5, 1);
        const eyeL = scene.add.circle(-6, -20, 3, PALETTE.cream);
        const eyeR = scene.add.circle(6, -20, 3, PALETTE.cream);
        const pupL = scene.add.circle(-6, -20, 1.5, PALETTE.black);
        const pupR = scene.add.circle(6, -20, 1.5, PALETTE.black);
        const sprite = scene.add.container(x, y + 10, [body, eyeL, eyeR, pupL, pupR]);
        sprite.setVisible(false);

        // mask: the frog rises out of the hole
        scene.add.ellipse(x, y + 14, 40, 12, PALETTE.moss).setDepth(5);

        const hole: Hole = { x, y, occupant: null, timer: 0, sprite, hit: false };
        holes.push(hole);
      }
    }

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => onClick(p.worldX, p.worldY));
    refreshHud();
  },

  update(_t: number, delta: number) {
    if (over) return;

    timeLeft -= delta;
    if (timeLeft <= 0) {
      finish();
      return;
    }
    refreshHud();

    const progress = 1 - timeLeft / ROUND_MS;
    const upMs = UP_MS_START + (UP_MS_END - UP_MS_START) * progress;
    const spawnMs = SPAWN_MS_START + (SPAWN_MS_END - SPAWN_MS_START) * progress;

    // ---- tick occupants
    for (const h of holes) {
      if (!h.occupant) continue;
      h.timer -= delta;
      if (h.timer <= 0) {
        h.occupant = null;
        h.hit = false;
        h.sprite.setVisible(false);
      }
    }

    // ---- spawn
    spawnTimer -= delta;
    const upCount = holes.filter((h) => h.occupant).length;
    if (spawnTimer <= 0 && upCount < MAX_UP) {
      spawnTimer = spawnMs;
      const free = holes.filter((h) => !h.occupant);
      if (free.length) {
        const h = free[Math.floor(Math.random() * free.length)];
        if (Math.random() < FROGGY_CHANCE) {
          h.occupant = 'froggy';
          h.timer = FROGGY_STARE_MS;
          h.sprite.setVisible(false); // he is not a sprite
        } else {
          h.occupant = 'frog';
          h.timer = upMs;
          h.hit = false;
          h.sprite.setVisible(true);
        }
      }
    }

    // ---- Froggy renders on the unfiltered overlay, never as a sprite
    const guests = holes.filter((h) => h.occupant === 'froggy');
    if (guests.length) {
      froggyLayer.paint((ctx) => {
        for (const h of guests) {
          drawFroggy(ctx, {
            x: h.x,
            y: h.y + 12,
            height: 34,
            variant: 'uncanny',
            pose: 'blank',
          });
        }
      });
    } else {
      froggyLayer.clear();
    }
  },

  destroy() {
    froggyLayer.clear();
    holes = [];
    apiRef = null;
  },
};

function onClick(x: number, y: number): void {
  if (over) return;
  for (const h of holes) {
    if (!h.occupant) continue;
    if (Math.abs(x - h.x) > 20 || y < h.y - 26 || y > h.y + 16) continue;

    if (h.occupant === 'froggy') {
      // Nothing happens.  No sound, no score, no acknowledgement.
      // He stares for the rest of his 1.2 seconds.
      return;
    }
    if (h.hit) return;

    h.hit = true;
    hits++;
    audio.sfx('whack');
    h.timer = Math.min(h.timer, 90);
    h.sprite.setVisible(false);
    if (hits >= TARGET_HITS) finish();
    return;
  }
}

function refreshHud(): void {
  hud?.setText(`HITS ${hits}/${TARGET_HITS}    ${Math.ceil(timeLeft / 1000)}s`);
}

function finish(): void {
  if (over) return;
  over = true;
  froggyLayer.clear();
  const won = hits >= TARGET_HITS;
  holes[0]?.sprite.scene.time.delayedCall(400, () => (won ? apiRef?.win() : apiRef?.lose()));
}
