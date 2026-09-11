/**
 * GRUDGE.  PRD §9.8 — Hard, 5 tokens in, 10 out.
 *
 * An original 1v1 fighter (PRD MG-7 / VOC-22): original characters, original
 * art, original name.  Best of 3, 99s rounds, 100 HP.
 *
 * The AI runs a readable three-beat pattern — approach, kick, punch-punch —
 * with a deliberate 0.6s opening after a whiffed kick.  A player who learns the
 * pattern wins; a masher loses.  That is the whole design.
 */

import Phaser from 'phaser';
import { PALETTE, css } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';
import { silhouettes } from './decor';


const FLOOR_Y = 156;
const WALK_SPEED = 52;
const JUMP_V = -190;
const GRAVITY = 620;
const MAX_HP = 100;
const ROUND_MS = 99_000;
const ROUNDS_TO_WIN = 2;

interface MoveDef {
  dmg: number;
  startup: number;
  active: number;
  recovery: number;
  range: number;
}

// PRD §9.8 frame data, at 60fps.
const MOVES: Record<'punch' | 'kick' | 'special', MoveDef> = {
  punch: { dmg: 6, startup: 200, active: 66, recovery: 167, range: 28 },
  kick: { dmg: 10, startup: 333, active: 100, recovery: 300, range: 36 },
  special: { dmg: 25, startup: 467, active: 133, recovery: 500, range: 46 },
};
const SPECIAL_COOLDOWN = 8000;
const BLOCK_MULT = 0.2;

interface Fighter {
  x: number;
  y: number;
  vy: number;
  hp: number;
  facing: 1 | -1;
  crouch: boolean;
  blocking: boolean;
  move: keyof typeof MOVES | null;
  phase: 'startup' | 'active' | 'recovery' | null;
  timer: number;
  hitLanded: boolean;
  specialCd: number;
  body: Phaser.GameObjects.Rectangle;
  head: Phaser.GameObjects.Rectangle;
  limb: Phaser.GameObjects.Rectangle;
}

let p1: Fighter | null = null;
let p2: Fighter | null = null;
let hpBar1: Phaser.GameObjects.Rectangle | null = null;
let hpBar2: Phaser.GameObjects.Rectangle | null = null;
let roundText: Phaser.GameObjects.BitmapText | null = null;
let timerText: Phaser.GameObjects.BitmapText | null = null;
let announce: Phaser.GameObjects.BitmapText | null = null;
let wins1 = 0;
let wins2 = 0;
let roundMs = ROUND_MS;
let roundOver = true;
let over = false;
let apiRef: MinigameApi | null = null;
let sceneRef: Phaser.Scene | null = null;
let keys: Record<string, Phaser.Input.Keyboard.Key> = {};

// AI state
let aiTimer = 0;
let aiBeat = 0;
let aiWhiffOpening = 0;
let aiSway = 0;

export const grudge: MinigameModule = {
  id: 'grudge',
  title: 'GRUDGE',
  music: 'game_grudge',
  rules: 'best of 3',

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    sceneRef = scene;
    wins1 = 0;
    wins2 = 0;
    over = false;

    // A hall: dark walls, a spotlight on the boards, and a crowd in the dark
    // at the back with the ropes in front of them.
    scene.add.rectangle(0, 18, GAME_W, 162, PALETTE.plum).setOrigin(0, 0);
    scene.add.rectangle(0, 18, GAME_W, 162, 0x1a1030).setOrigin(0, 0).setAlpha(0.6);
    scene.add.ellipse(GAME_W / 2, FLOOR_Y + 4, 260, 60, 0xfff0c9).setAlpha(0.06);
    scene.add.ellipse(GAME_W / 2, FLOOR_Y + 4, 160, 30, 0xfff0c9).setAlpha(0.06);
    silhouettes(scene, 108, 26, 0x0e0818, 0.9);
    for (const y of [116, 124, 132]) scene.add.rectangle(0, y, GAME_W, 1, PALETTE.blood).setOrigin(0, 0).setAlpha(0.7);
    for (const x of [24, GAME_W - 24]) scene.add.rectangle(x, 112, 3, 26, PALETTE.bone).setOrigin(0.5, 0);
    scene.add.rectangle(0, FLOOR_Y, GAME_W, 24, PALETTE.brown).setOrigin(0, 0);
    scene.add.rectangle(0, FLOOR_Y, GAME_W, 2, PALETTE.brownLight).setOrigin(0, 0);
    for (let x = 0; x < GAME_W; x += 20) scene.add.rectangle(x, FLOOR_Y + 2, 1, 22, 0x5a3e26).setOrigin(0, 0);
    // crowd silhouettes
    for (let i = 0; i < 14; i++) {
      scene.add.circle(12 + i * 22, 150, 6, PALETTE.ink).setAlpha(0.7);
    }

    p1 = makeFighter(scene, 90, PALETTE.gold, 1);
    p2 = makeFighter(scene, 230, PALETTE.neon, -1);

    scene.add.rectangle(8, 26, 130, 7, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
    hpBar1 = scene.add.rectangle(9, 27, 128, 5, PALETTE.tealLight).setOrigin(0, 0);
    scene.add.rectangle(GAME_W - 138, 26, 130, 7, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
    hpBar2 = scene.add.rectangle(GAME_W - 137, 27, 128, 5, PALETTE.blood).setOrigin(0, 0);

    text(scene, 8, 36, 'YOU', PALETTE.cream);
    text(scene, GAME_W - 40, 36, 'FROGGY', PALETTE.cream);
    // The clock is short enough to sit in the 45px gap between the HP bars; the
    // round line is not, and used to be drawn straight through both of them.
    timerText = centerText(scene, GAME_W / 2, 30, '', PALETTE.cream);
    roundText = centerText(scene, GAME_W / 2, 46, '', PALETTE.gold);
    announce = centerText(scene, GAME_W / 2, 90, '', PALETTE.gold, 16);

    const kb = scene.input.keyboard;
    if (kb) {
      keys = {
        left: kb.addKey('A'),
        right: kb.addKey('D'),
        jump: kb.addKey('W'),
        crouch: kb.addKey('S'),
        punch: kb.addKey('J'),
        kick: kb.addKey('K'),
        block: kb.addKey('L'),
        special: kb.addKey('I'),
      };
    }

    startRound();
  },

  update(_t: number, delta: number) {
    if (over || !p1 || !p2) return;
    const dt = delta / 1000;

    if (roundOver) return;

    roundMs -= delta;
    timerText?.setText(`${Math.ceil(roundMs / 1000)}`);
    if (roundMs <= 0) {
      endRound(p1.hp >= p2.hp);
      return;
    }

    handleInput(dt);
    runAi(delta, dt);
    tickFighter(p1, delta, dt);
    tickFighter(p2, delta, dt);

    p1.facing = p1.x < p2.x ? 1 : -1;
    p2.facing = p2.x < p1.x ? 1 : -1;

    render(p1);
    render(p2);
    hpBar1?.setSize((Math.max(0, p1.hp) / MAX_HP) * 128, 5);
    hpBar2?.setSize((Math.max(0, p2.hp) / MAX_HP) * 128, 5);

    if (p1.hp <= 0 || p2.hp <= 0) endRound(p2.hp <= 0);
  },

  destroy() {
    p1 = null;
    p2 = null;
    apiRef = null;
    sceneRef = null;
  },
};

function makeFighter(scene: Phaser.Scene, x: number, color: number, facing: 1 | -1): Fighter {
  const body = scene.add.rectangle(x, FLOOR_Y, 14, 26, color).setOrigin(0.5, 1);
  const head = scene.add.rectangle(x, FLOOR_Y - 26, 11, 11, color).setOrigin(0.5, 1);
  const limb = scene.add.rectangle(x, FLOOR_Y - 18, 4, 4, PALETTE.cream).setOrigin(0.5, 0.5).setVisible(false);
  return {
    x,
    y: FLOOR_Y,
    vy: 0,
    hp: MAX_HP,
    facing,
    crouch: false,
    blocking: false,
    move: null,
    phase: null,
    timer: 0,
    hitLanded: false,
    specialCd: 0,
    body,
    head,
    limb,
  };
}

function startRound(): void {
  if (!p1 || !p2) return;
  p1.hp = MAX_HP;
  p2.hp = MAX_HP;
  p1.x = 90;
  p2.x = 230;
  p1.move = p2.move = null;
  p1.phase = p2.phase = null;
  p1.specialCd = p2.specialCd = 0;
  roundMs = ROUND_MS;
  aiBeat = 0;
  aiTimer = 600;
  aiWhiffOpening = 0;
  aiSway = 0;
  roundOver = true;

  roundText?.setText(`ROUND ${wins1 + wins2 + 1}   ${wins1}-${wins2}`);
  announce?.setText('READY');
  sceneRef?.time.delayedCall(800, () => {
    announce?.setText('FIGHT');
    roundOver = false;
    sceneRef?.time.delayedCall(500, () => announce?.setText(''));
  });
}

function endRound(playerWon: boolean): void {
  if (roundOver) return;
  roundOver = true;
  if (playerWon) wins1++;
  else wins2++;
  announce?.setText(playerWon ? 'ROUND WON' : 'ROUND LOST');
  audio.sfx(playerWon ? 'chime' : 'buzzer');

  if (wins1 >= ROUNDS_TO_WIN || wins2 >= ROUNDS_TO_WIN) {
    over = true;
    const won = wins1 >= ROUNDS_TO_WIN;
    sceneRef?.time.delayedCall(1100, () => (won ? apiRef?.win() : apiRef?.lose()));
    return;
  }
  sceneRef?.time.delayedCall(1200, () => startRound());
}

function handleInput(dt: number): void {
  if (!p1) return;
  const f = p1;
  f.blocking = keys.block?.isDown ?? false;
  f.crouch = keys.crouch?.isDown ?? false;

  if (!f.move && !f.blocking) {
    if (keys.left?.isDown) f.x -= WALK_SPEED * dt;
    if (keys.right?.isDown) f.x += WALK_SPEED * dt;
    if (keys.jump?.isDown && f.y >= FLOOR_Y) f.vy = JUMP_V;
  }
  f.x = Phaser.Math.Clamp(f.x, 20, GAME_W - 20);

  if (!f.move && !f.blocking) {
    if (keys.punch?.isDown) startMove(f, 'punch');
    else if (keys.kick?.isDown) startMove(f, 'kick');
    else if (keys.special?.isDown && f.specialCd <= 0) startMove(f, 'special');
  }
}

/** PRD §9.8: approach -> kick -> punch-punch, with a 0.6s window after a whiff. */
function runAi(delta: number, dt: number): void {
  if (!p1 || !p2) return;
  const ai = p2;
  const dist = Math.abs(ai.x - p1.x);

  if (aiWhiffOpening > 0) {
    aiWhiffOpening -= delta;
    ai.blocking = false;
    return; // the opening: it does nothing at all
  }

  aiTimer -= delta;
  if (ai.move) return;

  // Blocks about half of punches and a third of kicks.
  if (p1.move && p1.phase === 'startup' && dist < 40) {
    const chance = p1.move === 'punch' ? 0.5 : 0.3;
    ai.blocking = Math.random() < chance;
  } else {
    ai.blocking = false;
  }

  if (aiTimer > 0) {
    // This used to read `aiBeat === 0`, but aiBeat only ever counts up — it is
    // 3, 6, 9 on later cycles, so the check was false forever and Froggy stood
    // rooted to the spot after his first approach.  He now keeps his spacing:
    // steps in when he is out of kick range, backs off when you are too close.
    // The ideal distance breathes, so he circles the edge of his own kick range
    // instead of parking on it — that in-and-out is the rhythm you play against.
    aiSway += dt;
    const ideal = MOVES.kick.range - 4 + Math.sin(aiSway * 1.7) * 11;
    const toward = Math.sign(p1.x - ai.x) || 1;
    const drift = dist > ideal + 3 ? 1 : dist < ideal - 3 ? -1 : 0;
    if (drift !== 0) {
      ai.x += toward * drift * WALK_SPEED * 0.8 * dt;
      ai.x = Phaser.Math.Clamp(ai.x, 20, GAME_W - 20);
    }
    return;
  }

  switch (aiBeat % 3) {
    case 0:
      aiTimer = 500;
      aiBeat++;
      break;
    case 1:
      if (dist < MOVES.kick.range + 6) {
        startMove(ai, ai.hp < MAX_HP * 0.4 && ai.specialCd <= 0 ? 'special' : 'kick');
      } else {
        aiTimer = 300;
      }
      aiBeat++;
      break;
    case 2:
      if (dist < MOVES.punch.range + 6) startMove(ai, 'punch');
      aiTimer = 420;
      aiBeat++;
      break;
  }
}

function startMove(f: Fighter, move: keyof typeof MOVES): void {
  f.move = move;
  f.phase = 'startup';
  f.timer = MOVES[move].startup;
  f.hitLanded = false;
  if (move === 'special') f.specialCd = SPECIAL_COOLDOWN;
}

function tickFighter(f: Fighter, delta: number, dt: number): void {
  if (f.specialCd > 0) f.specialCd -= delta;

  // gravity
  if (f.y < FLOOR_Y || f.vy !== 0) {
    f.vy += GRAVITY * dt;
    f.y += f.vy * dt;
    if (f.y >= FLOOR_Y) {
      f.y = FLOOR_Y;
      f.vy = 0;
    }
  }

  if (!f.move) return;
  f.timer -= delta;
  if (f.timer > 0) {
    if (f.phase === 'active') tryHit(f);
    return;
  }

  const def = MOVES[f.move];
  if (f.phase === 'startup') {
    f.phase = 'active';
    f.timer = def.active;
    audio.sfx('ui_hover');
  } else if (f.phase === 'active') {
    f.phase = 'recovery';
    f.timer = def.recovery;
    // A whiffed kick from the AI is the player's invitation.
    if (f === p2 && !f.hitLanded && f.move === 'kick') aiWhiffOpening = 600;
  } else {
    f.move = null;
    f.phase = null;
  }
}

function tryHit(f: Fighter): void {
  if (f.hitLanded || !f.move) return;
  const target = f === p1 ? p2 : p1;
  if (!target) return;

  const def = MOVES[f.move];
  const dist = Math.abs(f.x - target.x);
  const facingRight = target.x > f.x;
  if (dist > def.range) return;
  if ((facingRight && f.facing !== 1) || (!facingRight && f.facing !== -1)) return;
  if (target.y < FLOOR_Y - 20) return; // jumped over it

  f.hitLanded = true;
  const dmg = target.blocking ? def.dmg * BLOCK_MULT : def.dmg;
  target.hp -= dmg;
  audio.sfx(target.blocking ? 'ui_blip' : 'whack');

  // knockback
  target.x += (facingRight ? 1 : -1) * (target.blocking ? 3 : 7);
  target.x = Phaser.Math.Clamp(target.x, 20, GAME_W - 20);
}

function render(f: Fighter): void {
  const crouchOffset = f.crouch && f.y >= FLOOR_Y ? 8 : 0;
  f.body.setPosition(f.x, f.y);
  f.body.setSize(14, 26 - crouchOffset);
  f.head.setPosition(f.x, f.y - (26 - crouchOffset));

  // Every phase is drawn, not just the active frame.  A fight you cannot read
  // is a fight you can only mash at: the wind-up is the cue to block or step
  // back, and the recovery droop is the cue to punish.
  if (f.move && f.phase) {
    const def = MOVES[f.move];
    const colour = f.move === 'special' ? PALETTE.ember : f.move === 'kick' ? PALETTE.gold : PALETTE.cream;
    f.limb.setVisible(true).setFillStyle(colour);

    if (f.phase === 'startup') {
      // cocked back, behind the fighter — the tell
      f.limb
        .setPosition(f.x - f.facing * 6, f.y - 20 + crouchOffset)
        .setSize(6, 6)
        .setAlpha(0.75);
    } else if (f.phase === 'active') {
      f.limb
        .setPosition(f.x + f.facing * (def.range * 0.6), f.y - 18 + crouchOffset)
        .setSize(def.range * 0.7, f.move === 'kick' ? 5 : 4)
        .setAlpha(1);
    } else {
      // dropped and fading — the punish window, visible
      f.limb
        .setPosition(f.x + f.facing * (def.range * 0.3), f.y - 11 + crouchOffset)
        .setSize(def.range * 0.4, 3)
        .setAlpha(0.4);
    }
  } else {
    f.limb.setVisible(false);
  }

  f.body.setStrokeStyle(f.blocking ? 1 : 0, PALETTE.white);
  // A white head is the loudest tell on a 320px screen: someone is winding up.
  const winding = f.phase === 'startup';
  f.head.setFillStyle(
    f.blocking ? PALETTE.bone : winding ? PALETTE.white : f === p1 ? PALETTE.gold : PALETTE.neon,
  );
}

export const _css = css;
