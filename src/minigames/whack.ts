/**
 * Whack-a-Frog.  PRD §9.6 — Medium, 3 tokens in, 6 out.
 *
 * Nine holes, 25 hits in 40 seconds, ramping speed.
 *
 * THE CAMEO (PRD §9.6 / VOC-21): once in a very long while the thing that
 * comes up out of a hole is Froggy himself — smooth, non-pixel, wrong-sized
 * and wrong-shaped among the pixel frogs, and the only occupant that is not
 * drawn into the game's own buffer at all.  Whacking him:
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
/**
 * How often he turns up in a hole himself.
 *
 * A straight roll on every occupant that comes up, and nothing else gating it:
 * the rarity IS the spawn decision, so a player who dumps the scene graph or
 * watches the overlay finds nothing hidden — most rounds he simply was never
 * chosen.  At this rate a forty-second round is very unlikely to contain him
 * and most players will never see him at all, which is the point.  The number
 * is never shown, said, or hinted at anywhere in the game.
 */
const FROGGY_SPAWN_CHANCE = 1 / 200;
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
let sceneRef: Phaser.Scene | null = null;

export const whackAFrog: MinigameModule = {
  id: 'whack',
  title: 'WHACK-A-FROG',
  music: 'game_whack',
  rules: '25 hits in 40 seconds',
  tutorial: {
    objective: [
      '25 HITS IN 40 SECONDS.',
      'THEY GET QUICKER AS YOU GO.',
    ],
    controls: [
      ['MOUSE', 'CLICK A FROG TO WHACK IT'],
    ],
  },

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    hits = 0;
    timeLeft = ROUND_MS;
    spawnTimer = 0;
    over = false;
    sceneRef = scene;
    holes = [];

    // The lawn: grass with lighter blades, a darker border, and a little
    // clover — a garden, not a green rectangle.
    scene.add.rectangle(0, 18, GAME_W, 162, PALETTE.moss).setOrigin(0, 0);
    scene.add.rectangle(0, 18, GAME_W, 162, 0x2e5e38).setOrigin(0, 0).setAlpha(0.35);
    scene.add.rectangle(8, 36, GAME_W - 16, 138, 0x4a8a52).setOrigin(0, 0).setStrokeStyle(2, 0x2e5e38);
    for (let i = 0; i < 90; i++) {
      const gx = 12 + ((i * 131 + ((i * i) % 23) * 7) % (GAME_W - 24));
      const gy = 40 + ((i * 89 + ((i * 3) % 11) * 5) % 130);
      scene.add.rectangle(gx, gy, 1, 3 + (i % 3), 0x6fbb6a).setOrigin(0.5, 1).setAlpha(0.7);
    }
    for (let i = 0; i < 8; i++) {
      scene.add.circle(20 + ((i * 71) % (GAME_W - 40)), 44 + ((i * 47) % 124), 2, 0xbfe6a0).setAlpha(0.5);
    }
    scene.add.rectangle(GAME_W / 2, 27, 120, 12, PALETTE.ink, 0.6);
    hud = centerText(scene, GAME_W / 2, 26, '', PALETTE.cream);

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const x = 100 + c * 60;
        const y = 62 + r * 42;

        // the hole: a ring of dug earth around a dark mouth
        scene.add.ellipse(x, y + 12, 46, 18, PALETTE.brown);
        scene.add.ellipse(x, y + 11, 42, 15, 0x4a3320);
        scene.add.ellipse(x, y + 10, 38, 12, PALETTE.ink);

        // the frog: a round body, a pale belly, big eyes and a smile
        const body = scene.add.ellipse(0, -9, 26, 20, PALETTE.mossLight);
        const belly = scene.add.ellipse(0, -6, 16, 10, 0xcfe8a0);
        const footL = scene.add.ellipse(-9, -1, 8, 4, PALETTE.moss);
        const footR = scene.add.ellipse(9, -1, 8, 4, PALETTE.moss);
        const eyeL = scene.add.circle(-6, -19, 4, PALETTE.cream);
        const eyeR = scene.add.circle(6, -19, 4, PALETTE.cream);
        const pupL = scene.add.circle(-5, -19, 2, PALETTE.black);
        const pupR = scene.add.circle(7, -19, 2, PALETTE.black);
        const glintL = scene.add.circle(-6, -20, 0.8, PALETTE.white);
        const glintR = scene.add.circle(6, -20, 0.8, PALETTE.white);
        const mouth = scene.add.rectangle(0, -12, 10, 1, PALETTE.moss);
        const sprite = scene.add.container(x, y + 10, [footL, footR, body, belly, eyeL, eyeR, pupL, pupR, glintL, glintR, mouth]);
        sprite.setVisible(false);

        // mask: the frog rises out of the hole
        scene.add.ellipse(x, y + 14, 44, 12, 0x4a8a52).setDepth(5);
        scene.add.ellipse(x, y + 15, 46, 8, PALETTE.brown).setDepth(5).setAlpha(0.6);

        const hole: Hole = { x, y, occupant: null, timer: 0, sprite, hit: false };
        holes.push(hole);
      }
    }

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => onClick(p.worldX, p.worldY));
    refreshHud();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__whack = {
        state: () => ({
          hits,
          up: holes.filter((h) => h.occupant).length,
          guest: holes.some((h) => h.occupant === 'froggy'),
        }),
        /**
         * The spawn roll itself, sampled.  His rarity has to BE the decision
         * that puts him in a hole — a test that watched the screen could not
         * tell that apart from spawning him and hiding him, so the harness
         * samples the roll instead.  It reports counts, never the odds.
         */
        sampleCameo: (n: number) => {
          let seen = 0;
          for (let i = 0; i < n; i++) if (Math.random() < FROGGY_SPAWN_CHANCE) seen++;
          return seen;
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__whack;
      });
    }
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
        h.sprite.setVisible(false).setScale(1, 1);
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
        if (Math.random() < FROGGY_SPAWN_CHANCE) {
          h.occupant = 'froggy';
          h.timer = FROGGY_STARE_MS;
          h.sprite.setVisible(false); // he is not a sprite
        } else {
          h.occupant = 'frog';
          h.timer = upMs;
          h.hit = false;
          h.sprite.setVisible(true).setScale(1, 0.2);
          // up out of the hole, with a little overshoot
          sceneRef?.tweens.add({ targets: h.sprite, scaleY: 1, duration: 120, ease: 'Back.easeOut' });
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
    sceneRef = null;
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
    h.timer = Math.min(h.timer, 140);
    // Squashed flat, and a +1 that floats off.
    h.sprite.setScale(1.3, 0.35);
    if (sceneRef) {
      const pop = centerText(sceneRef, h.x, h.y - 18, '+1', PALETTE.gold).setDepth(20);
      sceneRef.tweens.add({ targets: pop, y: h.y - 34, alpha: 0, duration: 420, onComplete: () => pop.destroy() });
    }
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
