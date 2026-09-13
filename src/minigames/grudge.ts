/**
 * GRUDGE.  PRD §9.8 — Hard, 5 tokens in, 10 out.
 *
 * An original 1v1 fighter (PRD MG-7 / VOC-22): original characters, original
 * art, original name.  Best of 3, 99s rounds, 100 HP.  A FROG against a
 * LIZARD, both of them up on two legs, because a fight between two coloured
 * rectangles is not a fight you can read.
 *
 * THE THREE ATTACKS LOOK LIKE THREE ATTACKS.  A HIGH strike is a straight arm
 * at head height with the shoulder turned into it; a LOW strike is a knee-high
 * sweep — low enough to go under a standing guard, but off the floor rather
 * than flat along it, so it reads as a leg coming at you and not as the
 * fighter lying down; the SPECIAL is a wound-up lunge with a ring of light
 * coming off it.  Each one is drawn through all three of its phases — the
 * wind-up, the active frame, the droop — and the fighter throwing it says so
 * in a word over their head, so what is coming at you is never a guess.
 *
 * AND THE SWEEP IS WHAT A JUMP IS FOR.  Every attack can be cleared by being
 * in the air, but the sweep is the one with room to spare: it wants only a
 * dozen pixels of daylight (`JUMP_CLEARANCE`), so an ordinary hop beats it,
 * while the higher strikes need most of the arc.  Low is answered by jumping,
 * high by blocking, and the special by not being there.
 *
 * Getting hit looks like getting hit: the fighter snaps backwards, whites out
 * for a moment, cannot act while they are reeling, and a burst goes off where
 * the blow landed.
 *
 * The special has a COOLDOWN and the cooldown is on the HUD: a bar under each
 * health bar that fills back up, and the word READY when it has.  Pressing it
 * early does nothing but buzz — it is not a silent failure.
 *
 * The AI runs a readable three-beat pattern — approach, low, high-high — with
 * a deliberate 0.6s opening after a whiffed sweep.  A player who learns the
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

// PRD §9.8 frame data, at 60fps.  `high` is the quick one at head height,
// `low` the slower sweep along the floor, `special` the one with the cooldown.
const MOVES: Record<'high' | 'low' | 'special', MoveDef> = {
  high: { dmg: 6, startup: 200, active: 66, recovery: 167, range: 28 },
  low: { dmg: 10, startup: 333, active: 100, recovery: 300, range: 36 },
  special: { dmg: 25, startup: 467, active: 133, recovery: 500, range: 46 },
};
/** What each one is called over the fighter's head. */
const MOVE_NAME: Record<'high' | 'low' | 'special', string> = {
  high: 'HIGH',
  low: 'LOW',
  special: 'SPECIAL',
};
const SPECIAL_COOLDOWN = 8000;
const BLOCK_MULT = 0.2;
/** How long a clean hit takes you out of the fight for, by move. */
const HITSTUN: Record<'high' | 'low' | 'special', number> = { high: 170, low: 230, special: 340 };
/**
 * How far off the floor you have to be for a blow to pass underneath, in
 * pixels.  A jump peaks 29px up (JUMP_V against GRAVITY) and lasts 0.61s, so
 * twelve is a wide door — roughly 0.47s of the arc clears the sweep — and
 * twenty is a narrow one.  That is the point: the sweep is the move you beat
 * by jumping, and the high strike is the move you beat by blocking.
 */
const JUMP_CLEARANCE: Record<'high' | 'low' | 'special', number> = { high: 20, low: 12, special: 20 };

/** Everything a fighter is drawn out of, so the poses can move real limbs. */
interface Art {
  root: Phaser.GameObjects.Container;
  legL: Phaser.GameObjects.Rectangle;
  legR: Phaser.GameObjects.Rectangle;
  torso: Phaser.GameObjects.Ellipse;
  belly: Phaser.GameObjects.Ellipse;
  head: Phaser.GameObjects.Ellipse;
  snout: Phaser.GameObjects.Ellipse;
  eyeL: Phaser.GameObjects.Arc;
  eyeR: Phaser.GameObjects.Arc;
  pupL: Phaser.GameObjects.Arc;
  pupR: Phaser.GameObjects.Arc;
  /** The lizard's crest.  The frog has an invisible one, to keep this simple. */
  crest: Phaser.GameObjects.GameObject & { setPosition(x: number, y: number): unknown };
  arm: Phaser.GameObjects.Rectangle;
  fist: Phaser.GameObjects.Rectangle;
  shin: Phaser.GameObjects.Rectangle;
  aura: Phaser.GameObjects.Arc;
  /** The word over their head while a move is wound up or thrown. */
  call: Phaser.GameObjects.BitmapText;
  skin: number;
  skinLight: number;
}

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
  /** ms of being knocked about: no input, no AI, and it shows. */
  stun: number;
  /** Which way the last blow threw them, for the recoil. */
  recoil: number;
  /** Walk cycle phase, so the legs move when the fighter does. */
  step: number;
  art: Art;
}

let p1: Fighter | null = null;
let p2: Fighter | null = null;
let hpBar1: Phaser.GameObjects.Rectangle | null = null;
let hpBar2: Phaser.GameObjects.Rectangle | null = null;
let roundText: Phaser.GameObjects.BitmapText | null = null;
let timerText: Phaser.GameObjects.BitmapText | null = null;
let announce: Phaser.GameObjects.BitmapText | null = null;
let cd1: Phaser.GameObjects.Rectangle | null = null;
let cd2: Phaser.GameObjects.Rectangle | null = null;
let cd1Label: Phaser.GameObjects.BitmapText | null = null;
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
/** Seconds since the scene opened, for the idle breathing. */
let sceneClock = 0;
/** DEV only: hold the lizard still, so a test can aim at something. */
let aiFrozen = false;
/** Dev only: hold the lizard this many pixels off the floor, for jump tests. */
let aiHover: number | null = null;
/** Debounce on the "not ready" buzz, so a held key does not machine-gun it. */
let notReadyT = 0;

export const grudge: MinigameModule = {
  id: 'grudge',
  title: 'GRUDGE',
  music: 'game_grudge',
  rules: 'best of 3',
  tutorial: {
    objective: [
      'BEST OF THREE ROUNDS.',
      'HIGH BEATS A STANDING LIZARD.',
      'LOW SWEEPS ONE THAT IS CROUCHING.',
      'THE SPECIAL HURTS - AND HAS A COOLDOWN.',
    ],
    controls: [
      ['A / D', 'WALK'],
      ['W / S', 'JUMP AND CROUCH'],
      ['J', 'HIGH STRIKE'],
      ['K', 'LOW SWEEP'],
      ['L', 'BLOCK'],
      ['I', 'SPECIAL'],
    ],
  },

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

    p1 = makeFighter(scene, 90, 'frog', 1);
    p2 = makeFighter(scene, 230, 'lizard', -1);

    scene.add.rectangle(8, 26, 130, 7, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
    hpBar1 = scene.add.rectangle(9, 27, 128, 5, PALETTE.tealLight).setOrigin(0, 0);
    scene.add.rectangle(GAME_W - 138, 26, 130, 7, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
    hpBar2 = scene.add.rectangle(GAME_W - 137, 27, 128, 5, PALETTE.blood).setOrigin(0, 0);

    text(scene, 8, 36, 'FROG', PALETTE.mossLight);
    text(scene, GAME_W - 46, 36, 'LIZARD', PALETTE.amber);

    // ---- the special's cooldown, under each health bar.  A move on a timer
    // that the player cannot see is a move they press at random.
    scene.add.rectangle(8, 44, 64, 5, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
    cd1 = scene.add.rectangle(9, 45, 62, 3, PALETTE.ember).setOrigin(0, 0);
    cd1Label = text(scene, 76, 44, '', PALETTE.ember);
    scene.add.rectangle(GAME_W - 72, 44, 64, 5, PALETTE.ink).setOrigin(0, 0).setStrokeStyle(1, PALETTE.steel);
    cd2 = scene.add.rectangle(GAME_W - 71, 45, 62, 3, PALETTE.ember).setOrigin(0, 0);
    // The clock is short enough to sit in the 45px gap between the HP bars; the
    // round line is not, and used to be drawn straight through both of them.
    timerText = centerText(scene, GAME_W / 2, 30, '', PALETTE.cream);
    roundText = centerText(scene, GAME_W / 2, 56, '', PALETTE.gold);
    announce = centerText(scene, GAME_W / 2, 90, '', PALETTE.gold, 16);

    const kb = scene.input.keyboard;
    if (kb) {
      keys = {
        left: kb.addKey('A'),
        right: kb.addKey('D'),
        jump: kb.addKey('W'),
        crouch: kb.addKey('S'),
        high: kb.addKey('J'),
        low: kb.addKey('K'),
        block: kb.addKey('L'),
        special: kb.addKey('I'),
      };
    }

    startRound();

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__grudge = {
        state: () => ({
          round: wins1 + wins2 + 1,
          wins: { you: wins1, him: wins2 },
          roundOver,
          over,
          you: p1 && { hp: Math.round(p1.hp), cd: Math.round(Math.max(0, p1.specialCd)), move: p1.move, phase: p1.phase, stun: Math.round(Math.max(0, p1.stun)) },
          him: p2 && { hp: Math.round(p2.hp), cd: Math.round(Math.max(0, p2.specialCd)), move: p2.move, phase: p2.phase, stun: Math.round(Math.max(0, p2.stun)) },
          cooldownMs: SPECIAL_COOLDOWN,
        }),
        /** Try a move the way the keyboard would: refused exactly as it would be. */
        press: (move: 'high' | 'low' | 'special') => {
          if (!p1 || p1.stun > 0 || p1.move) return false;
          if (move === 'special' && p1.specialCd > 0) {
            notReady();
            return false;
          }
          startMove(p1, move);
          return true;
        },
        /** Put the two of them where a test needs them. */
        place: (mine: number, theirs: number) => {
          if (p1) p1.x = mine;
          if (p2) p2.x = theirs;
        },
        /**
         * Hang the lizard a fixed height off the floor, as if caught mid-jump,
         * so a sweep can be tested against an airborne target without having to
         * land a move inside the 0.6s an actual jump lasts.  null drops him.
         */
        hoist: (h: number | null) => {
          aiHover = h;
          if (p2 && h !== null) {
            p2.y = FLOOR_Y - h;
            p2.vy = 0;
          }
        },
        /** Hold the lizard still, so what is under test is the move. */
        freeze: (on: boolean) => {
          aiFrozen = on;
          if (p2 && on) {
            p2.move = null;
            p2.phase = null;
            p2.blocking = false;
          }
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__grudge;
      });
    }
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

    sceneClock += dt;
    if (notReadyT > 0) notReadyT -= delta;

    handleInput(dt);
    runAi(delta, dt);
    tickFighter(p1, delta, dt);
    tickFighter(p2, delta, dt);

    p1.facing = p1.x < p2.x ? 1 : -1;
    p2.facing = p2.x < p1.x ? 1 : -1;

    render(p1, dt);
    render(p2, dt);
    renderCooldowns();
    hpBar1?.setSize((Math.max(0, p1.hp) / MAX_HP) * 128, 5);
    hpBar2?.setSize((Math.max(0, p2.hp) / MAX_HP) * 128, 5);

    if (p1.hp <= 0 || p2.hp <= 0) endRound(p2.hp <= 0);
  },

  destroy() {
    sceneClock = 0;
    aiFrozen = false;
    aiHover = null;
    notReadyT = 0;
    cd1 = null;
    cd2 = null;
    cd1Label = null;
    p1 = null;
    p2 = null;
    apiRef = null;
    sceneRef = null;
  },
};

/**
 * A fighter, built out of parts that can be posed.  The frog is round and
 * low-slung; the lizard is taller, narrower and has a snout and a tail.  Both
 * stand on two legs, and both are drawn facing right — the container is
 * mirrored for whichever way they are actually looking.
 */
function makeFighter(scene: Phaser.Scene, x: number, kind: 'frog' | 'lizard', facing: 1 | -1): Fighter {
  const skin = kind === 'frog' ? PALETTE.moss : 0x8a9a3c;
  const skinLight = kind === 'frog' ? PALETTE.mossLight : PALETTE.amber;

  const legL = scene.add.rectangle(-4, -2, 4, 10, skin).setOrigin(0.5, 1);
  const legR = scene.add.rectangle(4, -2, 4, 10, skin).setOrigin(0.5, 1);
  const footL = scene.add.rectangle(-5, 0, 7, 2, skinLight).setOrigin(0.5, 1);
  const footR = scene.add.rectangle(5, 0, 7, 2, skinLight).setOrigin(0.5, 1);
  const tail =
    kind === 'lizard'
      ? scene.add.triangle(-8, -14, 0, 0, 14, 4, 0, 8, skin).setOrigin(0.5, 0.5).setAngle(20)
      : null;
  const torso = scene.add.ellipse(0, -18, kind === 'frog' ? 18 : 14, 18, skin);
  const belly = scene.add.ellipse(1, -16, kind === 'frog' ? 11 : 8, 11, skinLight);
  const shin = scene.add.rectangle(6, -6, 4, 4, skinLight).setOrigin(0, 0.5).setVisible(false);
  const arm = scene.add.rectangle(4, -22, 4, 4, skin).setOrigin(0, 0.5);
  const fist = scene.add.rectangle(8, -22, 5, 5, skinLight).setOrigin(0.5, 0.5);
  const head = scene.add.ellipse(2, -30, kind === 'frog' ? 15 : 12, 12, skinLight);
  const snout =
    kind === 'lizard'
      ? scene.add.ellipse(9, -29, 9, 6, skinLight)
      : scene.add.ellipse(7, -28, 5, 4, skinLight);
  const eyeL = scene.add.circle(-1, -34, 3, PALETTE.cream);
  const eyeR = scene.add.circle(5, -34, 3, PALETTE.cream);
  const pupL = scene.add.circle(0, -34, 1.4, PALETTE.black);
  const pupR = scene.add.circle(6, -34, 1.4, PALETTE.black);
  // A lizard has a crest, a frog does not.  At this size that is the whole of
  // telling them apart at a glance.
  const crest =
    kind === 'lizard'
      ? scene.add.triangle(0, -37, 0, 6, 4, 0, 8, 6, PALETTE.rust)
      : scene.add.circle(0, -37, 0.5, skinLight).setVisible(false);
  const aura = scene.add.circle(4, -20, 4, PALETTE.ember, 0.5).setVisible(false);
  const call = centerText(scene, 0, -52, '', PALETTE.cream).setVisible(false);

  const parts: Phaser.GameObjects.GameObject[] = [footL, footR, legL, legR];
  if (tail) parts.push(tail);
  parts.push(aura, torso, belly, shin, arm, fist, head, snout, crest, eyeL, eyeR, pupL, pupR, call);
  const root = scene.add.container(x, FLOOR_Y, parts).setDepth(20);
  root.setScale(facing, 1);

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
    stun: 0,
    recoil: 0,
    step: 0,
    art: { root, legL, legR, torso, belly, head, snout, eyeL, eyeR, pupL, pupR, crest, arm, fist, shin, aura, call, skin, skinLight },
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
  p1.stun = p2.stun = 0;
  p1.recoil = p2.recoil = 0;
  p1.facing = 1;
  p2.facing = -1;
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
  // Reeling from a hit: no walking, no attacking, and it is visible.
  if (f.stun > 0) {
    f.blocking = false;
    return;
  }
  f.blocking = keys.block?.isDown ?? false;
  f.crouch = keys.crouch?.isDown ?? false;

  if (!f.move && !f.blocking) {
    if (keys.left?.isDown) f.x -= WALK_SPEED * dt;
    if (keys.right?.isDown) f.x += WALK_SPEED * dt;
    if (keys.jump?.isDown && f.y >= FLOOR_Y) f.vy = JUMP_V;
  }
  f.x = Phaser.Math.Clamp(f.x, 20, GAME_W - 20);

  if (!f.move && !f.blocking) {
    if (keys.high?.isDown) startMove(f, 'high');
    else if (keys.low?.isDown) startMove(f, 'low');
    else if (keys.special?.isDown) {
      if (f.specialCd <= 0) startMove(f, 'special');
      else notReady();
    }
  }
}

/** PRD §9.8: approach -> low -> high-high, with a 0.6s window after a whiff. */
function runAi(delta: number, dt: number): void {
  if (!p1 || !p2 || aiFrozen) return;
  const ai = p2;
  const dist = Math.abs(ai.x - p1.x);
  if (ai.stun > 0) {
    ai.blocking = false;
    return;
  }

  if (aiWhiffOpening > 0) {
    aiWhiffOpening -= delta;
    ai.blocking = false;
    return; // the opening: it does nothing at all
  }

  aiTimer -= delta;
  if (ai.move) return;

  // Blocks about half of punches and a third of kicks.
  if (p1.move && p1.phase === 'startup' && dist < 40) {
    const chance = p1.move === 'high' ? 0.5 : 0.3;
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
    const ideal = MOVES.low.range - 4 + Math.sin(aiSway * 1.7) * 11;
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
      if (dist < MOVES.low.range + 6) {
        startMove(ai, ai.hp < MAX_HP * 0.4 && ai.specialCd <= 0 ? 'special' : 'low');
      } else {
        aiTimer = 300;
      }
      aiBeat++;
      break;
    case 2:
      if (dist < MOVES.high.range + 6) startMove(ai, 'high');
      aiTimer = 420;
      aiBeat++;
      break;
  }
}

function startMove(f: Fighter, move: keyof typeof MOVES): void {
  if (f.stun > 0) return;
  f.move = move;
  f.phase = 'startup';
  f.timer = MOVES[move].startup;
  f.hitLanded = false;
  if (move === 'special') f.specialCd = SPECIAL_COOLDOWN;
}

function tickFighter(f: Fighter, delta: number, dt: number): void {
  if (f.specialCd > 0) {
    f.specialCd -= delta;
    // The moment it comes back is worth hearing, not just seeing: the player
    // is watching the fight, not the corner of the HUD.
    if (f === p1 && f.specialCd <= 0) audio.sfx('bell_ding', 0.5);
  }
  if (f.stun > 0) {
    // Being hit interrupts whatever you were throwing: that is what makes a
    // clean hit worth landing and a wind-up worth punishing.
    f.stun -= delta;
    f.move = null;
    f.phase = null;
    f.blocking = false;
    if (f.stun <= 0) f.recoil = 0;
  }

  // gravity
  if (f === p2 && aiHover !== null) {
    f.y = FLOOR_Y - aiHover;
    f.vy = 0;
  } else if (f.y < FLOOR_Y || f.vy !== 0) {
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
    if (f === p2 && !f.hitLanded && f.move === 'low') aiWhiffOpening = 600;
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
  if (target.y < FLOOR_Y - JUMP_CLEARANCE[f.move]) return; // jumped over it

  // A low sweep goes under a block; a high strike does not go through one.
  const blocked = target.blocking && !(f.move === 'low' && !target.crouch);
  f.hitLanded = true;
  const dmg = blocked ? def.dmg * BLOCK_MULT : def.dmg;
  target.hp -= dmg;
  audio.sfx(blocked ? 'ui_blip' : f.move === 'special' ? 'boom' : 'whack');

  // knockback, and the reel that goes with it
  const away = facingRight ? 1 : -1;
  target.x += away * (blocked ? 3 : 7);
  target.x = Phaser.Math.Clamp(target.x, 20, GAME_W - 20);
  if (!blocked) {
    target.stun = HITSTUN[f.move];
    target.recoil = away * 3;
  }

  // where it landed, in world pixels: head height for a high strike, knee
  // height for a sweep, chest for the special
  const hx = f.x + f.facing * (def.range * 0.6);
  const hy = f.y - (f.move === 'low' ? 12 : f.move === 'special' ? 20 : 28);
  impact(hx, hy, f.move, blocked);
}

/**
 * Pose the fighter.  Everything about what they are doing is in the drawing:
 * the crouch, the wind-up, the strike, the droop afterwards, the block, the
 * reel from a hit, and the word over their head naming the attack.
 */
function render(f: Fighter, dt: number): void {
  const a = f.art;
  // Holding down is a full squat.  Throwing the sweep is only a dip into it:
  // at a full crouch the fighter ended up sitting on the floor with a leg
  // stuck out flat, which is not a kick, it is a fall.
  const crouch = f.crouch && f.y >= FLOOR_Y ? 5 : f.move === 'low' ? 2 : 0;
  const reel = f.stun > 0 ? f.recoil * Math.min(4, f.stun / 60) : 0;

  a.root.setPosition(f.x + reel, f.y);
  a.root.setScale(f.facing, 1);

  // ---- legs.  They step when the fighter moves and plant when they do not.
  const walking = Math.abs(f.step) > 0.01;
  const swing = walking ? Math.sin(f.step) * 3 : 0;
  a.legL.setPosition(-4 + swing, -2 - crouch * 0.4).setSize(4, 10 - crouch);
  a.legR.setPosition(4 - swing, -2 - crouch * 0.4).setSize(4, 10 - crouch);
  f.step += walking ? dt * 9 : 0;

  // ---- body and head, with the crouch taken out of the height
  const breathe = f.move ? 0 : Math.sin(sceneClock * 3 + (f === p2 ? 1.6 : 0)) * 0.6;
  a.torso.setPosition(0, -18 + crouch + breathe);
  a.belly.setPosition(1, -16 + crouch + breathe);
  a.head.setPosition(2, -30 + crouch * 1.4 + breathe);
  a.snout.setPosition(a.head.x + 6, a.head.y + 1);
  a.eyeL.setPosition(-1, a.head.y - 4);
  a.eyeR.setPosition(5, a.head.y - 4);
  // The pupils ride the eyes.  Left behind, they float over the fighter's head
  // like two flies, which is exactly how it looked.
  a.pupL.setPosition(0, a.head.y - 4);
  a.pupR.setPosition(6, a.head.y - 4);
  a.crest.setPosition(0, a.head.y - 7);

  // ---- the limbs, by move and phase
  a.shin.setVisible(false);
  a.aura.setVisible(false);
  a.arm.setFillStyle(a.skin);
  if (f.move && f.phase) {
    const def = MOVES[f.move];
    if (f.move === 'high') {
      // A straight arm at head height, and the shoulder turned into it.
      if (f.phase === 'startup') {
        a.arm.setPosition(-2, a.head.y + 4).setSize(6, 5);
        a.fist.setPosition(-4, a.head.y + 4).setSize(6, 6);
      } else if (f.phase === 'active') {
        a.arm.setPosition(4, a.head.y + 3).setSize(def.range * 0.7, 5);
        a.fist.setPosition(4 + def.range * 0.7, a.head.y + 3).setSize(7, 7);
      } else {
        a.arm.setPosition(4, -20).setSize(def.range * 0.3, 4);
        a.fist.setPosition(4 + def.range * 0.3, -20).setSize(5, 5);
      }
    } else if (f.move === 'low') {
      // A sweep at knee height: the leg comes out level with the kneecap,
      // well clear of the floorboards, with the knee cocked first.  The
      // fighter leans back over the standing leg to throw it.
      a.shin.setVisible(true).setFillStyle(a.skinLight);
      a.arm.setPosition(-1, -22).setSize(4, 4);
      a.fist.setPosition(1, -22).setSize(4, 4);
      if (f.phase === 'startup') {
        a.shin.setPosition(-2, -13).setSize(7, 5);
      } else if (f.phase === 'active') {
        a.shin.setPosition(4, -12).setSize(def.range * 0.8, 5);
      } else {
        a.shin.setPosition(3, -12).setSize(def.range * 0.35, 4);
      }
    } else {
      // The special: wound up with a ring of light, then thrown with both arms.
      const glow = f.phase === 'startup' ? 1 - f.timer / def.startup : 1;
      a.aura
        .setVisible(true)
        .setPosition(f.phase === 'active' ? 12 : 2, -20)
        .setRadius(4 + glow * (f.phase === 'active' ? 14 : 7))
        .setFillStyle(PALETTE.ember, f.phase === 'recovery' ? 0.25 : 0.45);
      a.arm.setFillStyle(PALETTE.ember);
      if (f.phase === 'startup') {
        a.arm.setPosition(-3, -24).setSize(7, 6);
        a.fist.setPosition(-6, -24).setSize(7, 7);
      } else if (f.phase === 'active') {
        a.arm.setPosition(4, -20).setSize(def.range * 0.8, 7);
        a.fist.setPosition(4 + def.range * 0.8, -20).setSize(9, 9);
      } else {
        a.arm.setPosition(3, -18).setSize(def.range * 0.3, 5);
        a.fist.setPosition(3 + def.range * 0.3, -18).setSize(5, 5);
      }
    }
    a.call
      .setVisible(true)
      .setText(MOVE_NAME[f.move])
      .setTint(f.move === 'special' ? PALETTE.ember : f.move === 'low' ? PALETTE.gold : PALETTE.cream)
      .setAlpha(f.phase === 'recovery' ? 0.4 : 1);
    // The container is mirrored, so the label would be too; un-mirror it.
    a.call.setScale(f.facing, 1);
  } else {
    a.arm.setPosition(4, -22).setSize(4, 4);
    a.fist.setPosition(8, -22).setSize(5, 5);
    a.call.setVisible(false);
  }

  // ---- block, wind-up and hit, in that order of loudness
  const winding = f.phase === 'startup';
  a.torso.setStrokeStyle(f.blocking ? 2 : 0, PALETTE.white);
  a.head.setFillStyle(f.stun > 0 ? PALETTE.white : f.blocking ? PALETTE.bone : winding ? PALETTE.white : a.skinLight);
  a.torso.setFillStyle(f.stun > 0 ? PALETTE.bone : a.skin);
}

/** The cooldown bars, and the word that says the special is back. */
function renderCooldowns(): void {
  if (!p1 || !p2) return;
  const ready1 = p1.specialCd <= 0;
  cd1?.setSize(62 * (1 - Math.max(0, p1.specialCd) / SPECIAL_COOLDOWN), 3);
  cd1?.setFillStyle(ready1 ? PALETTE.gold : PALETTE.ember);
  cd1Label?.setText(ready1 ? 'SPECIAL READY' : 'CHARGING');
  cd1Label?.setTint(ready1 ? PALETTE.gold : PALETTE.ash);
  cd2?.setSize(62 * (1 - Math.max(0, p2.specialCd) / SPECIAL_COOLDOWN), 3);
  cd2?.setFillStyle(p2.specialCd <= 0 ? PALETTE.gold : PALETTE.ember);
}

/** Pressed the special while it was charging: say so rather than do nothing. */
function notReady(): void {
  if (!sceneRef || notReadyT > 0) return;
  notReadyT = 500;
  audio.sfx('buzzer', 0.35);
  cd1Label?.setText('NOT READY').setTint(PALETTE.blood);
}

/** The burst where a blow landed, and the shake behind a big one. */
function impact(x: number, y: number, move: keyof typeof MOVES, blocked: boolean): void {
  if (!sceneRef) return;
  const colour = blocked ? PALETTE.steel : move === 'special' ? PALETTE.ember : PALETTE.cream;
  const n = move === 'special' ? 7 : 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random();
    const bit = sceneRef.add.rectangle(x, y, 3, 3, colour).setDepth(30);
    sceneRef.tweens.add({
      targets: bit,
      x: x + Math.cos(a) * (move === 'special' ? 22 : 12),
      y: y + Math.sin(a) * (move === 'special' ? 18 : 10),
      alpha: 0,
      duration: move === 'special' ? 320 : 200,
      onComplete: () => bit.destroy(),
    });
  }
  const ring = sceneRef.add.circle(x, y, 4, colour, 0).setStrokeStyle(1, colour).setDepth(30);
  sceneRef.tweens.add({
    targets: ring,
    radius: move === 'special' ? 26 : 14,
    alpha: 0,
    duration: 260,
    onComplete: () => ring.destroy(),
  });
  if (!blocked) sceneRef.cameras.main.shake(move === 'special' ? 220 : 90, move === 'special' ? 0.008 : 0.003);
}

export const _css = css;
