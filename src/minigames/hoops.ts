/**
 * LILY HOOPS.  PRD §9.5 — Medium, 5 tokens in, 10 out.
 *
 * A POND SPORT, not basketball with frogs drawn on it.  Froggy shoots from a
 * half-sunk log at one end; the hoop is carried across the water in the mouth
 * of the big frog of the pond, who swims a steady beat and gets quicker every
 * time you score through it.  The pond around all of it is alive -- reeds and
 * trees in the breeze, lily pads riding the swell, fish working the shallows,
 * dragonflies over the top -- and none of it touches the shot.
 *
 *
 * Hold SPACE to charge, release to shoot; W and S tilt the shot while you do.
 * The meter bounces back down at the top so there is no infinite hold.  Five
 * points in sixty seconds, and a miss only costs you time.
 *
 * AND YOU CAN SEE THE SHOT BEFORE YOU TAKE IT.  A dotted arc runs from the
 * ball along the exact parabola the shot would fly — same launch speed, same
 * gravity, same arithmetic the flight itself uses — with a marker where it
 * would cross the rim's height on the way down.  The arc is GREEN when that
 * crossing lands inside the hoop and AMBER when it does not, so "will this go
 * in" stops being a thing you learn by throwing away shots.
 *
 * THE PREDICTION CHASES THE MOVING RIM.  The hoop slides, so the arc works out
 * how long the ball would be in the air and asks where the rim will BE then,
 * not where it is now — and it draws a faint ghost of the rim in that place,
 * under the mark, so the LEAD is the thing on the screen rather than a sum the
 * player is meant to be doing.  Leading a moving target is still their job;
 * the arithmetic of it is not.
 *
 * THE COURT DOES NOT SIT STILL.  Three things stack on top of the plain shot,
 * and all three are readable from the screen without being told:
 *
 *   THE RIM RUNS      it slides across the back of the court, and every score
 *                     makes it 15% quicker AND a little narrower, down to a
 *                     floor — so the last point of a run is the hardest one.
 *   ON FIRE           two in a row lights the ball: it burns, it trails, and
 *                     while it is lit every make is worth two.  One miss puts
 *                     it out, which is what makes the second shot of a streak
 *                     worth more than the first.
 *   THE BONUS RING    a small gold ring drifts across above the hoop now and
 *                     then, for a few seconds only.  Threading it is worth two
 *                     and lights the ball, and it is a genuinely harder shot
 *                     than the hoop under it.
 */

import Phaser from 'phaser';
import { PALETTE } from '../render/palette';
import { audio } from '../core/audio';
import { centerText, text } from '../core/ui';
import { GAME_W } from '../render/pixelScaler';
import type { MinigameApi, MinigameModule } from './types';


const CHARGE_MS = 1200;
const GRAVITY = 420;
const LAUNCH = { x: 46, y: 150 };
/** Where the shot starts out, and how far W/S can tilt it either way. */
const LAUNCH_ANGLE = -Math.PI * 0.375; // the middle of the band
const AIM_MIN = -Math.PI * 0.422; // a steep lob
const AIM_MAX = -Math.PI * 0.328; // a flat drive

/**
 * HOW FAR AN EMPTY METER AND A FULL ONE THROW IT.
 *
 * The hoop rides between x152 and x276, so the meter is scaled to land just
 * short of the near end of that at nothing and just past the far end at
 * everything.  Power is a DISTANCE, not a speed -- see `launchSpeed`.
 */
const REACH_NEAR = 138;
const REACH_FAR = 300;
/** How far the ball has to climb from the log to the rim. */
const RIM_RISE = 150 - 74;
/** Nothing leaves his hands faster than this, whatever the arithmetic says. */
const SPEED_CAP = 520;
const AIM_RATE = 1.3; // radians per second held
/** The arrow: this long at zero charge, and this much longer at full. */
const ARROW_MIN = 12;
const ARROW_GROW = 30;
/**
 * The preview arc.
 *
 * `PREVIEW_POWER` is the shot the arc is drawn at while nobody is holding the
 * button — a reference throw, so the aim line means something before the meter
 * has moved.  The moment SPACE goes down the arc switches to the live charge.
 */
const PREVIEW_POWER = 0.55;
const ARC_DOTS = 18;
const ARC_STEP = 0.055;
/**
 * How much room inside the mouth a shot needs before the arc will call it IN.
 *
 * GREEN IS A PROMISE, SO IT IS DELIBERATELY CAUTIOUS.  The rim is moving, so
 * the prediction walks it forward to where it will be when the ball arrives —
 * a second and a half away — and a walk at a fixed step against a flight
 * integrated at whatever the frame rate gives drifts by a pixel or two over
 * that distance.  A shot that clears the mouth by less than the drift is one
 * the arc cannot honestly promise, so it does not: it goes amber, and if it
 * drops anyway the player gets a pleasant surprise instead of a broken word.
 * The asymmetry is the whole point — green never lies, amber sometimes does.
 */
const SURE_MARGIN = 3;
/** Points, not shots: a make on fire is worth two of them. */
const TARGET_MAKES = 5;
const ROUND_MS = 60_000;
const HOOP_Y = 74;
const HOOP_W = 22;
/** The rim tightens with every score, but never past this. */
const HOOP_W_MIN = 14;
const HOOP_SHRINK = 1.6;
/** Makes in a row before the ball lights up, and what a lit make is worth. */
const FIRE_AT = 2;
const FIRE_POINTS = 2;
/** The bonus ring: how often it comes round, how long it stays, what it pays. */
const RING_EVERY_MS = 13_000;
const RING_UP_MS = 7000;
const RING_POINTS = 2;
const RING_Y = 44;
const RING_R = 7;

let power = 0;
let aim = LAUNCH_ANGLE;
let charging = false;
let chargeDir = 1;
let ball: Phaser.GameObjects.Arc | null = null;
let ballVel = { x: 0, y: 0 };
let inFlight = false;
/**
 * WHERE THE HOOP IS, AND WHY IT IS A SINE.
 *
 * It used to slide at a constant speed and turn round at the walls, which is
 * predictable but not smooth: the carrier stopped dead and reversed, twice a
 * length, and a shot timed against it had to be timed against a corner.
 *
 * It floats now -- `HOOP_MID` plus a sine -- so it eases at the ends and runs
 * quickest through the middle, which is the same path a frog swimming a beat
 * would take.  It is still perfectly learnable, and it is now solvable in
 * CLOSED FORM, which matters more than it sounds: `hoopAt` no longer walks
 * the rim forward a sixtieth at a time to guess where it will be when the
 * ball arrives, it simply evaluates the sine at that moment.  The arc's
 * promise is exact rather than approximate.
 */
const HOOP_MID = 214;
const HOOP_SWING = 62;
let hoopPhase = 0;
/** Radians a second.  Every score winds it up; see `score`. */
let hoopRate = 0.85;
let hoopX = HOOP_MID;
let makes = 0;
let timeLeft = ROUND_MS;
let over = false;
let hoopW = HOOP_W;
/** Makes in a row.  Two lights the ball; a miss puts it out. */
let streak = 0;
let onFire = false;
/** The drifting bonus ring, when it is out. */
let ring = { x: 0, dir: 1, up: false, ttl: 0 };
let ringTimer = RING_EVERY_MS;

let meterFill: Phaser.GameObjects.Rectangle | null = null;
let arrow: Phaser.GameObjects.Graphics | null = null;
let aimKeys: { up: Phaser.Input.Keyboard.Key[]; down: Phaser.Input.Keyboard.Key[] } = { up: [], down: [] };
let hoopRim: Phaser.GameObjects.Rectangle | null = null;
let backboard: Phaser.GameObjects.Rectangle | null = null;
let net: Phaser.GameObjects.Rectangle | null = null;
let hud: Phaser.GameObjects.BitmapText | null = null;
let apiRef: MinigameApi | null = null;
let scoredThisFlight = false;
let ringBody: Phaser.GameObjects.Arc | null = null;
let flames: Phaser.GameObjects.Graphics | null = null;
let sceneRef: Phaser.Scene | null = null;

/**
 * THE POND, THE CARRIER AND THE SHOOTER.
 *
 * Every one of these is drawing.  Nothing in the pond is read by the shot,
 * the hoop or the scoring -- the breeze moves reeds, not the ball -- and the
 * shooter's crouch and leap are a pose laid over a launch point that never
 * moves, so the arc stays honest about where the ball comes from.
 */
let carrier: Phaser.GameObjects.Container | null = null;
let carrierBody: Phaser.GameObjects.Container | null = null;
let carrierHead: Phaser.GameObjects.Container | null = null;
let carrierEyes: Phaser.GameObjects.Container[] = [];
let carrierMouth: Phaser.GameObjects.Ellipse | null = null;
/** How wide open the mouth is, 0 shut to 1 gulping. */
let gape = 0;
let blinkIn = 2.4;
let blinkT = 0;
let shooter: Phaser.GameObjects.Container | null = null;
/** 0 standing, 1 fully crouched; and the leap, which decays after a release. */
let crouch = 0;
let leap = 0;
let ballMark: Phaser.GameObjects.Container | null = null;
interface Reed { art: Phaser.GameObjects.GameObject & { x: number; angle: number }; x0: number; give: number; phase: number; }
let reeds: Reed[] = [];
interface Swimmer { art: Phaser.GameObjects.Container; x: number; y: number; dir: 1 | -1; speed: number; bob: number; }
let swimmers: Swimmer[] = [];
let pads: Array<{ art: Phaser.GameObjects.Container; x0: number; y0: number; phase: number }> = [];
let flyers: Array<{ art: Phaser.GameObjects.Container; t: number; y0: number; speed: number }> = [];
let pondRings: Array<{ art: Phaser.GameObjects.Ellipse; t: number }> = [];
let pondT = 0;
let pondGust = 0;
let gustIn = 3;

export const hoops: MinigameModule = {
  // The id stays `hoops`: the cabinet, its price, its reward, the high score
  // table and the registry all key off it, and none of that is changing.
  id: 'hoops',
  title: 'LILY HOOPS',
  music: 'game_hoops',
  rules: '5 points in 60 seconds - streaks pay double',
  tutorial: {
    objective: [
      'SCORE 5 IN 60 SECONDS.',
      'THE BIG FROG CARRIES THE HOOP AND SWIMS.',
      'EVERY SCORE MAKES HIM QUICKER + TIGHTER.',
      'TWO IN A ROW LIGHTS THE BALL: MAKES PAY 2.',
      'THE DOTTED ARC IS GREEN WHEN IT GOES IN.',
    ],
    controls: [
      ['HOLD SPACE', 'CROUCH, LET GO TO LEAP'],
      ['W / S', 'TILT THE SHOT'],
    ],
  },
  // Hold the button to charge, exactly as the key is held.
  touch: { stick: 'ud', buttons: [{ label: 'SHOOT', key: 'SPACE', primary: true }] },

  create(scene: Phaser.Scene, api: MinigameApi) {
    apiRef = api;
    power = 0;
    aim = LAUNCH_ANGLE;
    charging = false;
    chargeDir = 1;
    inFlight = false;
    makes = 0;
    timeLeft = ROUND_MS;
    hoopRate = 0.85;
    hoopPhase = 0;
    hoopX = HOOP_MID;
    over = false;
    hoopW = HOOP_W;
    streak = 0;
    onFire = false;
    ring = { x: 0, dir: 1, up: false, ttl: 0 };
    ringTimer = RING_EVERY_MS;
    sceneRef = scene;

    // ================= THE POND =================
    //
    // It was a gym: dark wall, a crowd along the back, boards underfoot.  The
    // game is the same shot -- charge, tilt, release -- played somewhere else
    // entirely.  Built back to front so the depth reads, and animated by
    // `stepPond` from the update loop.
    buildPond(scene);

    // ---- THE CARRIER: a big frog WEARING the hoop.
    //
    // The hoop is a hoop -- a rim, a backboard and a net, the same three
    // objects the shot has always been tested against, at the same HOOP_Y --
    // but it now sits on the frog's head rather than being held up in front of
    // it on a post.  The rim is the brim, the net is the band round the crown,
    // and the frog's own eyes look out from under it.
    //
    // Before this the eyes were parked at carrier-local y=-5, level with the
    // rim itself and a long way above the head, so what the screen showed was
    // a HOOP WITH A FACE floating over a green lump.  They belong on the frog.
    //
    // The geometry falls out of it for free: the net hangs from HOOP_Y+2 down
    // eight pixels, which is exactly the top of the head, so a ball dropping
    // through the rim arrives at the frog's mouth -- and it eats it.
    carrier = scene.add.container(hoopX, HOOP_Y).setDepth(14);
    const bigSkin = 0x4f9e55;
    const bigDark = 0x2f6b36;
    // Sized against Froggy, who is seventeen across: this one is twenty-six,
    // so it reads as the BIG frog of the pond without becoming the pond.  It
    // was forty-two, which at three hundred and twenty pixels wide is a
    // landmark -- two green ellipses that read as lily pads with a hoop
    // somewhere above them rather than as one animal holding one up.
    carrierBody = scene.add.container(0, 24, [
      scene.add.ellipse(0, 5, 30, 6, 0x123b2a).setAlpha(0.4),
      scene.add.ellipse(0, 0, 26, 13, bigDark),
      scene.add.ellipse(0, -1.5, 23, 11, bigSkin),
      scene.add.ellipse(0, 2, 15, 5, 0xbfe3a8).setAlpha(0.6),
      scene.add.ellipse(-10.5, 1.5, 8, 7, bigDark),
      scene.add.ellipse(10.5, 1.5, 8, 7, bigDark),
    ]);
    // The head is raised until its crown meets the rim, so the hoop rests on
    // it.  The mouth is the thing a ball through the rim lands in.
    carrierMouth = scene.add.ellipse(0, 4, 11, 1.6, 0x27361f);
    carrierHead = scene.add.container(0, 10, [
      scene.add.ellipse(0, 0, 20, 12, bigDark),
      scene.add.ellipse(0, -0.5, 18, 10.5, bigSkin),
      scene.add.ellipse(0, 2.5, 13, 4, 0xbfe3a8).setAlpha(0.5),
      carrierMouth,
    ]);
    // Its own eyes, on its own head, under the brim -- the frog looking out
    // from beneath the thing it is wearing.
    carrierEyes = [-5.5, 5.5].map((sx) =>
      scene.add.container(sx, -4, [
        scene.add.ellipse(0, 0, 7, 6.6, bigSkin),
        scene.add.ellipse(0, 0, 5, 4.8, PALETTE.cream),
        scene.add.ellipse(0, 0.3, 2.4, 2.8, 0x14251a),
        scene.add.circle(-1, -1.1, 0.8, 0xffffff).setAlpha(0.9),
      ]),
    );
    carrierHead.add(carrierEyes);
    carrier.add([carrierBody, carrierHead]);

    // the hoop it is holding, at exactly the height the shot is tested at
    backboard = scene.add.rectangle(hoopX, HOOP_Y - 18, 4, 24, PALETTE.bone).setOrigin(0.5, 0).setDepth(15);
    hoopRim = scene.add.rectangle(hoopX, HOOP_Y, hoopW, 2, PALETTE.ember).setOrigin(0.5, 0).setDepth(16);
    net = scene.add.rectangle(hoopX, HOOP_Y + 2, hoopW - 4, 8, PALETTE.cream).setOrigin(0.5, 0).setAlpha(0.3).setDepth(15);

    // The bonus ring lives up above the hoop and is only out some of the time.
    ringBody = scene.add.circle(-20, RING_Y, RING_R, 0x000000, 0).setStrokeStyle(2, PALETTE.gold).setDepth(19).setVisible(false);
    flames = scene.add.graphics().setDepth(21);

    // ---- FROGGY, ON THE LOG, WITH THE BALL.
    //
    // He is a pose over a launch point that does not move: `LAUNCH` is still
    // exactly where the ball leaves from and what the arc is drawn from, so
    // crouching and leaping change how the shot LOOKS and nothing about where
    // it comes from.  An aim you have lined up survives the jump.
    const skin = 0x5aa85f;
    const dark = 0x2f6b36;
    shooter = scene.add.container(LAUNCH.x, LAUNCH.y + 8, [
      scene.add.ellipse(0, 9, 22, 5, 0x1d5561).setAlpha(0.4),
      scene.add.ellipse(-7, 4, 8, 7, dark),
      scene.add.ellipse(7, 4, 8, 7, dark),
      scene.add.ellipse(0, 0, 17, 14, skin),
      scene.add.ellipse(0, 3, 11, 6, 0xdff0c8).setAlpha(0.65),
      scene.add.ellipse(-5, -7, 7, 6.4, skin),
      scene.add.ellipse(5, -7, 7, 6.4, skin),
      scene.add.ellipse(-5, -7, 5, 4.6, PALETTE.cream),
      scene.add.ellipse(5, -7, 5, 4.6, PALETTE.cream),
      scene.add.ellipse(-5, -6.6, 2.4, 2.8, 0x14251a),
      scene.add.ellipse(5, -6.6, 2.4, 2.8, 0x14251a),
    ]).setDepth(12);

    // ---- THE BALL, which is his.
    //
    // Same four-pixel circle the flight has always used -- the physics reads
    // `ball.x/y` and nothing else -- with the seams a basketball has and a
    // pair of eye-spots on it, so it is recognisably out of this pond.
    ball = scene.add.circle(LAUNCH.x, LAUNCH.y, 4, 0x6fbf4e).setStrokeStyle(1, 0x2f6b36).setDepth(20);
    ballMark = scene.add.container(LAUNCH.x, LAUNCH.y, [
      scene.add.rectangle(0, 0, 8, 0.8, 0x2f6b36).setAlpha(0.85),
      scene.add.rectangle(0, 0, 0.8, 8, 0x2f6b36).setAlpha(0.85),
      scene.add.circle(-1.6, -1.6, 0.9, 0xeaf7d8),
      scene.add.circle(1.6, -1.6, 0.9, 0xeaf7d8),
    ]).setDepth(21);

    // ---- THE READOUTS, on plates.
    //
    // These were pale grey set straight onto a dark gym.  On a sunlit pond
    // that is not a control hint, and the shooter stands right where two of
    // them were printed.
    scene.add.rectangle(0, 18, GAME_W, 13, 0x123b2a).setOrigin(0, 0).setDepth(28).setAlpha(0.62);
    scene.add.rectangle(4, 92, 26, 62, 0x123b2a).setOrigin(0, 0).setDepth(28).setAlpha(0.66);
    scene.add.rectangle(GAME_W - 62, 162, 58, 14, 0x123b2a).setOrigin(0, 0).setDepth(28).setAlpha(0.66);
    scene.add.rectangle(10, 96, 8, 40, PALETTE.ink).setOrigin(0, 0).setDepth(29).setStrokeStyle(1, PALETTE.steel);
    meterFill = scene.add.rectangle(11, 135, 6, 0, PALETTE.gold).setOrigin(0, 1).setDepth(29);
    text(scene, 7, 139, 'HOLD', PALETTE.bone).setDepth(29);
    text(scene, 7, 147, 'SPACE', PALETTE.bone).setDepth(29);
    text(scene, GAME_W - 58, 166, 'W/S AIM', PALETTE.bone).setDepth(29);

    arrow = scene.add.graphics().setDepth(30);

    // Depth 29: the header plate is at 28, and without this the score was
    // printed underneath the very thing put there to make it readable.
    hud = centerText(scene, GAME_W / 2, 21, '', PALETTE.cream).setDepth(29);
    refreshHud();

    const kb = scene.input.keyboard;
    const bind = (names: string[]) => (kb ? names.map((n) => kb.addKey(n)) : []);
    aimKeys = { up: bind(['W', 'UP']), down: bind(['S', 'DOWN']) };
    kb?.on('keydown-SPACE', () => {
      // A held key auto-repeats keydown.  Without the `charging` guard every
      // repeat reset power to zero, so holding SPACE pinned the meter at empty
      // and the shot always went out at minimum power.
      if (inFlight || over || charging) return;
      charging = true;
      power = 0;
      chargeDir = 1;
    });
    kb?.on('keyup-SPACE', () => {
      if (!charging || over) return;
      charging = false;
      shoot();
    });

    if (import.meta.env?.DEV) {
      (window as unknown as Record<string, unknown>).__hoops = {
        state: () => ({
          makes,
          over,
          inFlight,
          charging,
          power: Number(power.toFixed(3)),
          aim: Number(aim.toFixed(3)),
          hoopX: Math.round(hoopX),
          hoopW: Math.round(hoopW),
          ball: ball ? { x: Math.round(ball.x), y: Math.round(ball.y) } : null,
          target: TARGET_MAKES,
        }),
        /**
         * What the arc is telling the player right now: where the shot would
         * come down through the rim's height, where the rim will be when it
         * does, and therefore which colour the dots are.
         */
        predict: (p = power) => {
          const hit = crossing(p);
          if (!hit) return { good: false, reason: 'never reaches the rim' };
          const rim = hoopAt(hit.t);
          return {
            good: sureThing(hit.x, rim),
            x: Math.round(hit.x),
            t: Number(hit.t.toFixed(3)),
            rim: Math.round(rim),
            hoopNow: Math.round(hoopX),
          };
        },
        /** Aim and charge exactly as the keys would, then let go. */
        aimAt: (a: number) => {
          aim = Phaser.Math.Clamp(a, AIM_MIN, AIM_MAX);
        },
        shootAt: (p: number) => {
          if (inFlight || over) return false;
          power = Phaser.Math.Clamp(p, 0, 1);
          charging = false;
          shoot();
          return true;
        },
        /** Search the aim/power space for a shot the arc says is good. */
        findGood: () => {
          for (let a = AIM_MIN; a <= AIM_MAX; a += 0.01) {
            for (let p = 0.1; p <= 1; p += 0.02) {
              const was = aim;
              aim = a;
              const hit = crossing(p);
              const ok = hit !== null && sureThing(hit.x, hoopAt(hit.t));
              aim = was;
              if (ok) return { aim: Number(a.toFixed(3)), power: Number(p.toFixed(3)) };
            }
          }
          return null;
        },
      };
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        delete (window as unknown as Record<string, unknown>).__hoops;
      });
    }
  },

  update(_t: number, delta: number) {
    if (over || !ball || !hoopRim || !backboard || !net) return;
    const dt = delta / 1000;

    timeLeft -= delta;
    if (timeLeft <= 0) {
      finish();
      return;
    }
    refreshHud();

    // ---- hoop slides, and gets faster with every make
    hoopPhase += hoopRate * dt;
    hoopX = hoopAt(0);
    stepPond(dt);
    stepCarrier(dt);
    stepShooter(dt);
    ballMark?.setPosition(ball.x, ball.y);
    hoopRim.x = hoopX;
    hoopRim.setSize(hoopW, 2);
    net.x = hoopX;
    net.setSize(Math.max(2, hoopW - 4), 8);
    backboard.x = hoopX + hoopW / 2 + 2;

    stepRing(dt, delta);

    // ---- aim.  W tilts the shot up, S flattens it.  Works at any time you
    // are not mid-flight, so you can line up before you start charging.
    if (!inFlight) {
      const tilt = (aimKeys.up.some((k) => k.isDown) ? -1 : 0) + (aimKeys.down.some((k) => k.isDown) ? 1 : 0);
      aim = Phaser.Math.Clamp(aim + tilt * AIM_RATE * dt, AIM_MIN, AIM_MAX);
    }
    drawArrow();

    // ---- charge meter, bouncing at the top
    if (charging) {
      power += (chargeDir * delta) / CHARGE_MS;
      if (power >= 1) {
        power = 1;
        chargeDir = -1;
      }
      if (power <= 0) {
        power = 0;
        chargeDir = 1;
      }
      meterFill?.setSize(6, power * 38);
    } else if (!inFlight) {
      meterFill?.setSize(6, 0);
    }

    // ---- flight
    if (inFlight) {
      const prevY = ball.y;
      const prevX = ball.x;
      ballVel.y += GRAVITY * dt;
      ball.x += ballVel.x * dt;
      ball.y += ballVel.y * dt;

      // the bonus ring, on the way up or the way down — it is a hoop with no
      // net and no wrong side
      if (!scoredThisFlight && ring.up && Math.hypot(ball.x - ring.x, ball.y - RING_Y) < RING_R - 1) {
        scoredThisFlight = true;
        ring.up = false;
        ring.ttl = 0;
        ringBody?.setVisible(false);
        ringTimer = RING_EVERY_MS;
        audio.sfx('bell_ding');
        score(RING_POINTS, 'BONUS');
        if (makes >= TARGET_MAKES) {
          finish();
          return;
        }
      }

      // Through the rim, downward, within the hoop's mouth — asked AT THE
      // CROSSING, not at the end of the step that crossed it.  The ball covers
      // five or six pixels a frame and the mouth is twenty wide, so testing
      // `ball.x` once it is already past the rim's height judged the shot on
      // where it had got to rather than on where it went through: a ball that
      // dropped cleanly through one edge was a miss because a frame later it
      // was outside.  The path within a step is a straight line, so this is
      // where that line crosses HOOP_Y.
      const k = ball.y === prevY ? 1 : (HOOP_Y - prevY) / (ball.y - prevY);
      const crossX = prevX + (ball.x - prevX) * k;
      if (
        !scoredThisFlight &&
        ballVel.y > 0 &&
        prevY <= HOOP_Y &&
        ball.y >= HOOP_Y &&
        Math.abs(crossX - hoopX) < hoopW / 2 - 2
      ) {
        scoredThisFlight = true;
        eatBall();
        // Every score winds the float up: the carrier swims the same beat a
        // little quicker, so the last point of a run is the hardest one.
        hoopRate *= 1.13;
        hoopW = Math.max(HOOP_W_MIN, hoopW - HOOP_SHRINK);
        audio.sfx('chime');
        score(onFire ? FIRE_POINTS : 1, onFire ? 'ON FIRE' : '');
        if (makes >= TARGET_MAKES) {
          finish();
          return;
        }
      }

      // backboard is real, so bank shots work
      if (
        Math.abs(ball.x - (hoopX + hoopW / 2 + 2)) < 4 &&
        ball.y > HOOP_Y - 18 &&
        ball.y < HOOP_Y + 6 &&
        ballVel.x > 0
      ) {
        ballVel.x = -Math.abs(ballVel.x) * 0.6;
        audio.sfx('ui_hover');
      }

      drawFlames();
      // Down into the water, which is where a missed shot ends up.
      if (ball.y > 158 || ball.x > GAME_W + 10) {
        if (!scoredThisFlight && ball.y > 150) splashDown(ball.x, 158);
        reset();
      }
    }
  },

  destroy() {
    ball = null;
    hoopRim = null;
    arrow = null;
    ringBody = null;
    flames = null;
    sceneRef = null;
    apiRef = null;
  },
};

/**
 * The launch arrow AND the arc it would fly.
 *
 * Dim while idle, so you can see where you are pointing; bright and growing
 * while SPACE is held, so the length you release at is the shot you get.  Gone
 * while the ball is in the air.
 */
function drawArrow(): void {
  if (!arrow) return;
  arrow.clear();
  if (inFlight || over) return;
  drawArc();
  const len = ARROW_MIN + (charging ? power : 0) * ARROW_GROW;
  const dx = Math.cos(aim);
  const dy = Math.sin(aim);
  const x0 = LAUNCH.x + dx * 6;
  const y0 = LAUNCH.y + dy * 6;
  const x1 = x0 + dx * len;
  const y1 = y0 + dy * len;
  const colour = charging ? PALETTE.gold : PALETTE.ash;
  arrow.lineStyle(charging ? 2 : 1, colour, charging ? 1 : 0.7);
  arrow.beginPath();
  arrow.moveTo(x0, y0);
  arrow.lineTo(x1, y1);
  arrow.strokePath();
  // the head: two short strokes back from the tip
  const h = 5;
  const a = Math.PI * 0.8;
  arrow.beginPath();
  arrow.moveTo(x1, y1);
  arrow.lineTo(x1 + Math.cos(aim + a) * h, y1 + Math.sin(aim + a) * h);
  arrow.moveTo(x1, y1);
  arrow.lineTo(x1 + Math.cos(aim - a) * h, y1 + Math.sin(aim - a) * h);
  arrow.strokePath();
}

/**
 * A score, from the hoop or from the ring.  Points, streak and the fire that
 * comes with it all live here so the two scoring paths cannot disagree.
 */
function score(points: number, note: string): void {
  makes += points;
  streak++;
  if (!onFire && streak >= FIRE_AT) {
    onFire = true;
    audio.sfx('coin_spin');
    ball?.setFillStyle(PALETTE.gold).setStrokeStyle(1, PALETTE.ember);
  }
  if (sceneRef && ball) {
    const label = note || `+${points}`;
    const pop = centerText(sceneRef, ball.x, ball.y - 10, label, onFire ? PALETTE.gold : PALETTE.cream).setDepth(40);
    sceneRef.tweens.add({ targets: pop, y: pop.y - 16, alpha: 0, duration: 620, onComplete: () => pop.destroy() });
  }
  celebrate();
  refreshHud();
}

/**
 * THE POND ANSWERING A MADE SHOT.
 *
 * A splash under the hoop, rings going out from it, every lily pad in range
 * rocking as the wave reaches it, and Froggy hopping on the spot.  A miss
 * gets the small version of this from `splashDown` -- the difference between
 * the two is most of what makes a score feel like one.
 */
function celebrate(): void {
  if (!sceneRef) return;
  audio.sfx('chime');
  audio.sfx('hop_wet', 0.5);
  const sx = hoopX;
  const sy = HOOP_Y + 34;
  for (let i = 0; i < 14; i++) {
    const d = sceneRef.add.circle(sx + (Math.random() - 0.5) * 16, sy, 1 + Math.random() * 1.4, 0xd8f4fa).setDepth(22);
    sceneRef.tweens.add({
      targets: d,
      x: d.x + (Math.random() - 0.5) * 42,
      y: sy - 12 - Math.random() * 20,
      alpha: 0,
      duration: 520 + Math.random() * 380,
      ease: 'Quad.easeOut',
      onComplete: () => d.destroy(),
    });
  }
  for (let i = 0; i < 3; i++) sceneRef.time.delayedCall(i * 110, () => pondRing(sx, sy, true));
  // the wave reaching the pads
  for (const pd of pads) {
    const away = Math.abs(pd.x0 - sx);
    if (away > 110) continue;
    sceneRef.time.delayedCall(away * 3, () => {
      sceneRef?.tweens.add({ targets: pd.art, y: pd.y0 - 3, duration: 130, yoyo: true, repeat: 1 });
    });
  }
  // and him, pleased about it
  if (shooter) {
    sceneRef.tweens.add({ targets: shooter, y: LAUNCH.y - 2, duration: 130, yoyo: true, repeat: 2, ease: 'Quad.easeOut' });
  }
}

/** A miss: the ball hits the water and that is all that happens. */
function splashDown(x: number, y: number): void {
  if (!sceneRef) return;
  audio.sfx('drip', 0.5);
  for (let i = 0; i < 5; i++) {
    const d = sceneRef.add.circle(x + (Math.random() - 0.5) * 8, y, 1, 0xd8f4fa).setDepth(22).setAlpha(0.8);
    sceneRef.tweens.add({
      targets: d, x: d.x + (Math.random() - 0.5) * 18, y: y - 5 - Math.random() * 8, alpha: 0,
      duration: 380 + Math.random() * 200, onComplete: () => d.destroy(),
    });
  }
  pondRing(x, y);
}

/**
 * The bonus ring's own clock: out of sight most of the time, across the top of
 * the court for a few seconds when its turn comes round.
 */
function stepRing(dt: number, delta: number): void {
  if (ring.up) {
    ring.x += ring.dir * 46 * dt;
    if (ring.x > GAME_W - 24) {
      ring.x = GAME_W - 24;
      ring.dir = -1;
    }
    if (ring.x < 120) {
      ring.x = 120;
      ring.dir = 1;
    }
    ring.ttl -= delta;
    ringBody?.setPosition(ring.x, RING_Y);
    // it blinks out rather than vanishing mid-shot with no warning
    ringBody?.setAlpha(ring.ttl < 1500 && Math.floor(ring.ttl / 150) % 2 === 0 ? 0.25 : 1);
    if (ring.ttl <= 0) {
      ring.up = false;
      ringBody?.setVisible(false);
      ringTimer = RING_EVERY_MS;
    }
    return;
  }
  ringTimer -= delta;
  if (ringTimer <= 0) {
    ring = { x: 130 + Math.random() * 120, dir: Math.random() < 0.5 ? -1 : 1, up: true, ttl: RING_UP_MS };
    ringBody?.setPosition(ring.x, RING_Y).setAlpha(1).setVisible(true);
    audio.sfx('ui_blip');
  }
}

/** The trail on a lit ball.  Nothing but decoration, and the point of it. */
function drawFlames(): void {
  if (!flames) return;
  flames.clear();
  if (!onFire || !ball || !inFlight) return;
  for (let i = 1; i <= 4; i++) {
    const t = i * 0.028;
    const x = ball.x - ballVel.x * t;
    const y = ball.y - ballVel.y * t;
    flames.fillStyle(i < 3 ? PALETTE.gold : PALETTE.ember, 0.55 - i * 0.1);
    flames.fillCircle(x, y, 4 - i * 0.7);
  }
}

/** The launch speed for a given charge.  One definition, used by both the
 * shot and the arc that predicts it — so the preview cannot drift from the
 * thing it is previewing. */
/**
 * THE METER IS A DISTANCE, AND THE SPEED IS SOLVED FROM IT.
 *
 * It used to be `150 + p * 300` -- a raw speed -- and that made most of the
 * meter useless in both directions.  Measured at the old default aim: half a
 * meter dropped the ball at x154, the near lip of the hoop's travel; three
 * quarters put it at x288, already past the far lip; and a full one sent it to
 * x425, off the right of a three-hundred-and-twenty pixel screen.  Anything
 * below about 0.45 never climbed to rim height at all.  So the usable band was
 * a sliver in the middle, and pressing harder stopped meaning "further along
 * the pond" and started meaning "over the trees".
 *
 * Worse, no single speed band could serve the whole aim range, because the
 * speed a shot needs depends on how steeply it is thrown: a search over every
 * band and every aim window found no pair that reached the hoop from one end
 * of the aim range to the other.
 *
 * So the meter now says WHERE, and the speed is whatever gets it there from
 * the current aim.  Reach is exactly linear in power at every aim -- lean on
 * it and the ball goes further down the pond, in the direction it is pointed,
 * every time.
 *
 * Solving `h = s·v·t - g·t²/2` with `t = d / (c·v)` for v:
 *
 *     v² = g·d² / (2·c·(s·d - h·c))
 *
 * where d is how far out the target is, h the climb to the rim, and c and s
 * the cosine and (upward) sine of the aim.  The denominator goes to zero as
 * the shot approaches the vertical, which is the arithmetic saying a straight
 * up throw never gets anywhere: that is what the cap is for.
 */
function launchSpeed(p: number): number {
  const want = REACH_NEAR + Phaser.Math.Clamp(p, 0, 1) * (REACH_FAR - REACH_NEAR);
  const c = Math.cos(aim);
  const s = -Math.sin(aim);
  const d = want - LAUNCH.x;
  const den = 2 * c * (s * d - RIM_RISE * c);
  if (den <= 0 || d <= 0) return SPEED_CAP;
  return Math.min(SPEED_CAP, Math.sqrt((GRAVITY * d * d) / den));
}

/**
 * Where the shot would cross the rim's height ON THE WAY DOWN, and when.
 *
 * Straight out of the same parabola the flight integrates: solve
 * `y0 + vy t + gt^2/2 = HOOP_Y` and take the later root, which is the
 * descending crossing — the only one a ball can actually drop through a hoop
 * on.  Null when the shot never gets that high, which is itself the answer.
 */
/**
 * THE CARRIER, ALIVE.
 *
 * It swims with the hoop, so the whole container simply tracks `hoopX`; on
 * top of that it breathes, its head lags a little behind the turn -- which is
 * what makes a body look like it is being pulled along rather than slid -- and
 * it blinks at uneven intervals.
 */
function stepCarrier(dt: number): void {
  if (!carrier || !carrierHead || !carrierBody) return;
  carrier.x = hoopX;
  // the swim: a slow rise and fall, and a lean into the direction of travel
  const drift = Math.cos(hoopPhase) * hoopRate * HOOP_SWING;
  carrier.y = HOOP_Y + Math.sin(pondT * 1.5) * 1.2;
  carrier.setAngle(Phaser.Math.Clamp(drift * 0.035, -7, 7));
  carrierBody.setScale(1, 1 + Math.sin(pondT * 2.2) * 0.035);
  // the head lags the turn and looks where it is going
  carrierHead.x = Phaser.Math.Clamp(drift * 0.02, -3, 3);
  carrierHead.y = 10 + Math.sin(pondT * 2.2 + 0.7) * 0.7;

  // The gulp: the mouth springs open to take the ball and eases shut after it.
  gape = Math.max(0, gape - dt * 2.6);
  if (carrierMouth) carrierMouth.setSize(11 + gape * 3, 1.6 + gape * 7);
  // and the throat works it down
  carrierBody.setScale(1 + gape * 0.06, carrierBody.scaleY + gape * 0.05);

  blinkT += dt;
  if (blinkT > blinkIn) {
    blinkT = 0;
    blinkIn = 1.8 + Math.random() * 3.4;
  }
  // a blink is the last eighth of a second before the timer resets, and a
  // mouthful squeezes them shut the way a swallow does
  const shut = blinkT > blinkIn - 0.12 ? 0.1 : 1;
  for (const e of carrierEyes) e.setScale(1, shut * (1 - gape * 0.55));
}

/**
 * THE FROG EATS IT.
 *
 * The ball is food, and a shot that goes in is the frog being fed: the mouth
 * opens under the rim, the ball drops the last few pixels into it, and it goes
 * down with a gulp.
 *
 * This is a SECOND, cosmetic ball, and the real one is simply hidden.  The
 * flight is a state machine -- it ends on `ball.y > 158` and clears the shot
 * on the way out -- and reaching into it to redirect a ball that has already
 * scored would put a rendering flourish in charge of when a turn is over.  The
 * real ball finishes its arc unseen and ends the flight exactly as it always
 * did.
 */
function eatBall(): void {
  if (!sceneRef || !carrier) return;
  const bite = sceneRef.add.circle(hoopX, HOOP_Y + 3, 4, 0x6fbf4e).setStrokeStyle(1, 0x2f6b36).setDepth(13);
  ball?.setVisible(false);
  ballMark?.setVisible(false);
  sceneRef.tweens.add({
    targets: bite,
    x: carrier.x,
    y: HOOP_Y + 14,
    scale: 0.55,
    duration: 190,
    ease: 'Quad.easeIn',
    onComplete: () => {
      bite.destroy();
      gape = 1;
      audio.sfx('hop_wet', 0.45);
    },
  });
  // open up to meet it
  sceneRef.time.delayedCall(60, () => { gape = Math.max(gape, 0.8); });
}

/**
 * FROGGY, CROUCHING AND LEAPING.
 *
 * `crouch` follows the charge meter, so winding up a big shot visibly gathers
 * him; `leap` is set on release and decays, which is the hop.  Both are
 * drawing: `LAUNCH` never moves, so the arc and the flight are unaffected and
 * an aim lined up before the jump is the aim that is taken.
 */
function stepShooter(dt: number): void {
  if (!shooter) return;
  const want = charging ? power : 0;
  crouch += (want - crouch) * Math.min(1, dt * 9);
  if (leap > 0) leap = Math.max(0, leap - dt * 3.4);
  // the hop: up fast, down slower, which is what `leap` decaying through a
  // sine gives without needing a second clock
  const hop = Math.sin(leap * Math.PI) * 9;
  shooter.y = LAUNCH.y + 8 + crouch * 5 - hop;
  // gathered on the crouch, stretched out through the leap
  shooter.setScale(1 + crouch * 0.16 - hop * 0.012, 1 - crouch * 0.24 + hop * 0.03);
  shooter.setAngle(-aim * 4 - hop * 0.5);
}

// ==================================================================== the pond

/** Push something onto the breeze, with how far this wind bends it. */
function bend(o: Phaser.GameObjects.GameObject & { x: number; angle: number }, give: number): void {
  reeds.push({ art: o, x0: o.x, give, phase: Math.random() * Math.PI * 2 });
}

/**
 * A POND TO SHOOT OVER, built back to front.
 *
 * Sky, a far bank of trees, the reed line, then the water itself -- shallow
 * and bright at the near edge where the shooter stands, deeper and colder
 * away from him.  Lily pads float on it, fish work along under it, rocks and
 * a fallen log break the surface and dragonflies cross above it.
 *
 * Every moving thing is registered with `bend` or pushed onto one of the
 * lists at the top of the file; `stepPond` drives all of them off one clock.
 */
function buildPond(scene: Phaser.Scene): void {
  reeds = []; swimmers = []; pads = []; flyers = []; pondRings = [];
  pondT = 0; pondGust = 0; gustIn = 2 + Math.random() * 3;

  // ---- sky and the light in it
  scene.add.rectangle(0, 18, GAME_W, 162, 0x8fd0ea).setOrigin(0, 0);
  scene.add.rectangle(0, 18, GAME_W, 18, 0x77c0e2).setOrigin(0, 0);
  scene.add.circle(44, 34, 20, 0xfff6c8).setAlpha(0.16);
  scene.add.circle(44, 34, 11, 0xfffdf0).setAlpha(0.9);
  for (const [cx, cy, cw] of [[110, 28, 30], [200, 36, 22], [286, 26, 26]] as const) {
    for (let i = 0; i < 4; i++) {
      bend(scene.add.ellipse(cx + (i - 1.5) * (cw / 4), cy + (i % 2) * 2, cw / 2 + i, 6, 0xffffff).setAlpha(0.8), 0.3);
    }
  }
  // ---- the far bank: trees, then the ground they stand on
  for (let i = 0; i < 22; i++) {
    bend(scene.add.ellipse((i * 15) % (GAME_W + 14) - 7, 48 + (i % 3) * 3, 22 + (i % 4) * 6, 16, i % 2 ? 0x3a7043 : 0x46814c), 0.6);
  }
  for (const tx of [22, 132, 252, 306]) {
    scene.add.rectangle(tx, 44, 4, 24, 0x5a3f25).setOrigin(0.5, 0);
    for (const [ox, oy, r] of [[0, -4, 14], [-8, 2, 10], [8, 1, 10]] as const) {
      bend(scene.add.circle(tx + ox, 44 + oy, r, 0x3f7a46), 1.4);
    }
  }
  scene.add.rectangle(0, 60, GAME_W, 10, 0x33632f).setOrigin(0, 0);
  scene.add.rectangle(0, 60, GAME_W, 2, 0x477f3e).setOrigin(0, 0);
  // ---- the reed line along the far edge
  for (let i = 0; i < 46; i++) {
    const rx = (i * 7 + (i % 5) * 3) % GAME_W;
    const h = 8 + (i % 4) * 4;
    bend(scene.add.rectangle(rx, 70, 1, h, i % 3 ? 0x4d8c3f : 0x3d7434).setOrigin(0.5, 1), 2.4);
    if (i % 5 === 0) bend(scene.add.ellipse(rx, 70 - h, 2, 4, 0x8a6a35), 2.6);
  }

  // ---- THE WATER.  Bright and shallow near, deep and cold far.
  scene.add.rectangle(0, 70, GAME_W, 110, 0x2f7f8c).setOrigin(0, 0);
  scene.add.rectangle(0, 70, GAME_W, 26, 0x26707e).setOrigin(0, 0);
  scene.add.rectangle(0, 132, GAME_W, 48, 0x3d9599).setOrigin(0, 0);
  scene.add.rectangle(0, 156, GAME_W, 24, 0x54a9a4).setOrigin(0, 0);
  // the light banding across it
  for (let i = 0; i < 26; i++) {
    const wy = 74 + ((i * 17) % 100);
    scene.add.rectangle((i * 41) % GAME_W, wy, 10 + (i % 4) * 8, 1, 0xbfe8f2).setOrigin(0, 0).setAlpha(0.16);
  }
  // ---- rocks and a fallen log, which is what the shooter stands on
  for (const [rx, ry, rw] of [[16, 108, 14], [298, 96, 12], [268, 140, 16], [90, 88, 10]] as const) {
    scene.add.ellipse(rx, ry + 3, rw + 4, 5, 0x1d5561).setAlpha(0.5);
    scene.add.ellipse(rx, ry, rw, rw * 0.66, 0x7d7b70);
    scene.add.ellipse(rx - 1, ry - 1.5, rw * 0.6, rw * 0.36, 0x99968a);
  }
  scene.add.ellipse(52, 160, 70, 9, 0x1d5561).setAlpha(0.45);
  scene.add.ellipse(52, 156, 66, 12, 0x6b4a2c);
  scene.add.ellipse(52, 154, 60, 8, 0x82603a);
  for (let i = 0; i < 7; i++) scene.add.ellipse(26 + i * 9, 154, 2, 5, 0x5a3d22).setAlpha(0.6);

  // ---- LILY PADS, which bob on their own phase
  for (const [px, py, pr] of [
    [104, 122, 13], [160, 148, 11], [214, 116, 12], [244, 158, 14],
    [126, 164, 10], [188, 96, 9], [286, 124, 11], [74, 136, 12],
  ] as const) {
    const pad = scene.add.container(px, py, [
      scene.add.ellipse(0, 2, pr * 2, pr * 0.9, 0x1d5561).setAlpha(0.35),
      scene.add.ellipse(0, 0, pr * 2, pr * 1.1, 0x3f8a3c),
      scene.add.ellipse(-pr * 0.2, -pr * 0.2, pr * 1.2, pr * 0.6, 0x55a64b).setAlpha(0.7),
      scene.add.triangle(pr * 0.5, pr * 0.1, 0, 0, pr * 0.8, -pr * 0.35, pr * 0.8, pr * 0.35, 0x2f7f8c),
    ]);
    // a flower on some of them
    if (pr > 11) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        pad.add(scene.add.ellipse(Math.cos(a) * 3, Math.sin(a) * 2.2 - 2, 3.2, 2.2, 0xffc0d8));
      }
      pad.add(scene.add.circle(0, -2, 1.4, 0xffe98a));
    }
    pads.push({ art: pad, x0: px, y0: py, phase: Math.random() * 6.28 });
  }

  // ---- FISH, working along under the surface
  for (let i = 0; i < 5; i++) {
    const body = scene.add.container(0, 0, [
      scene.add.ellipse(0, 0, 7, 3.2, i % 2 ? 0xff9a52 : 0xffd45e).setAlpha(0.75),
      scene.add.triangle(-4.6, 0, 0, 0, 4, -2.4, 4, 2.4, i % 2 ? 0xe8813a : 0xe8bc46).setAlpha(0.75),
      scene.add.circle(2.2, -0.5, 0.7, 0x1a2a2e).setAlpha(0.8),
    ]).setDepth(3);
    swimmers.push({
      art: body, x: 40 + i * 54, y: 100 + ((i * 23) % 60),
      dir: i % 2 ? 1 : -1, speed: 14 + Math.random() * 12, bob: Math.random() * 6.28,
    });
  }

  // ---- DRAGONFLIES, crossing above the water
  for (let i = 0; i < 3; i++) {
    const d = scene.add.container(0, 0, [
      scene.add.ellipse(0, 0, 7, 1.6, 0x4fd0c8),
      scene.add.ellipse(-1.6, -1.6, 5, 1.4, 0xdff7ff).setAlpha(0.55),
      scene.add.ellipse(-1.6, 1.6, 5, 1.4, 0xdff7ff).setAlpha(0.55),
      scene.add.circle(3.4, 0, 1.2, 0x2f9c96),
    ]).setDepth(18);
    flyers.push({ art: d, t: i * 2.2, y0: 88 + i * 22, speed: 22 + i * 7 });
  }
}

/** One ring spreading on the water.  Drawing only. */
function pondRing(x: number, y: number, strong = false): void {
  if (!sceneRef || pondRings.length > 22) return;
  const art = sceneRef.add.ellipse(x, y, 3, 1.4, 0xd8f4fa).setDepth(4).setAlpha(strong ? 0.75 : 0.45);
  art.setFillStyle();
  art.setStrokeStyle(1, 0xe8fbff, strong ? 0.8 : 0.5);
  pondRings.push({ art, t: 0 });
}

/**
 * THE POND, A FRAME AT A TIME.
 *
 * One breeze drives every plant, with gusts at uneven intervals because wind
 * on a fixed beat reads as a machine.  Fish swim, pads bob, dragonflies
 * cross, rings spread and fade.  None of it is read by the shot.
 */
function stepPond(dt: number): void {
  if (!sceneRef) return;
  pondT += dt;
  gustIn -= dt;
  if (gustIn <= 0) { pondGust = 0.7 + Math.random() * 1.2; gustIn = 2.5 + Math.random() * 4; }
  if (pondGust > 0) pondGust = Math.max(0, pondGust - dt * 0.75);
  const wind = Math.sin(pondT * 0.6) * 0.5 + Math.sin(pondT * 1.8) * 0.2 + pondGust * 0.9;

  for (const r of reeds) {
    const local = wind + Math.sin(pondT * 1.4 + r.phase) * 0.2;
    r.art.x = r.x0 + local * r.give;
    r.art.angle = local * r.give * 1.6;
  }
  for (const pd of pads) {
    pd.art.x = pd.x0 + Math.sin(pondT * 0.7 + pd.phase) * (1.4 + wind);
    pd.art.y = pd.y0 + Math.sin(pondT * 1.1 + pd.phase) * 1.1;
    pd.art.setAngle(Math.sin(pondT * 0.9 + pd.phase) * 3);
  }
  for (const f of swimmers) {
    f.bob += dt;
    f.x += f.dir * f.speed * dt;
    if (f.x < 12) { f.x = 12; f.dir = 1; }
    if (f.x > GAME_W - 12) { f.x = GAME_W - 12; f.dir = -1; }
    f.art.setPosition(f.x, f.y + Math.sin(f.bob * 1.9) * 2);
    f.art.setScale(f.dir, 1 + Math.sin(f.bob * 9) * 0.12);
    if (Math.random() < dt * 0.4) pondRing(f.x, f.y);
  }
  for (const d of flyers) {
    d.t += dt;
    const x = ((d.t * d.speed) % (GAME_W + 40)) - 20;
    d.art.setPosition(x, d.y0 + Math.sin(d.t * 3.4) * 6);
    d.art.setScale(1, 1);
  }
  if (Math.random() < dt * 1.3) pondRing(20 + Math.random() * (GAME_W - 40), 90 + Math.random() * 80);
  for (let i = pondRings.length - 1; i >= 0; i--) {
    const r = pondRings[i];
    r.t += dt;
    r.art.setSize(3 + r.t * 16, 1.4 + r.t * 6);
    r.art.setAlpha(Math.max(0, 0.6 - r.t * 0.7));
    if (r.t > 0.9) { r.art.destroy(); pondRings.splice(i, 1); }
  }
}

function crossing(p: number): { x: number; t: number } | null {
  const speed = launchSpeed(p);
  const vy = Math.sin(aim) * speed;
  const vx = Math.cos(aim) * speed;
  const a = GRAVITY / 2;
  const c = LAUNCH.y - HOOP_Y;
  const disc = vy * vy - 4 * a * c;
  if (disc < 0) return null;
  const t = (-vy + Math.sqrt(disc)) / (2 * a);
  if (t <= 0) return null;
  return { x: LAUNCH.x + vx * t, t };
}

/**
 * Where the rim will be in `t` seconds.
 *
 * SOLVED, not walked.  The old rim turned round at the walls, so there was no
 * closed form for it and this stepped the interval forward a sixtieth at a
 * time -- which drifts, over a flight a second and a half long, by a pixel or
 * two against a body integrated at whatever the frame rate gives.  The whole
 * of `SURE_MARGIN` existed to cover that drift.
 *
 * A sine has an answer.  This is exact at any `t`, so the arc's promise is
 * the arithmetic rather than an approximation of it.
 */
function hoopAt(t: number): number {
  return HOOP_MID + Math.sin(hoopPhase + hoopRate * t) * HOOP_SWING;
}

/** Would the shot at this charge drop through the rim?  The scoring test, asked early. */
export function wouldScore(p: number): boolean {
  const hit = crossing(p);
  if (!hit) return false;
  return sureThing(hit.x, hoopAt(hit.t));
}

/**
 * Would this crossing drop through, with room to spare?
 *
 * `hoopW / 2 - 2` is the rim's real mouth, the same test the flight itself
 * uses; `SURE_MARGIN` is what the arc holds back before it will say so.
 */
function sureThing(x: number, rim: number): boolean {
  return Math.abs(x - rim) < hoopW / 2 - 2 - SURE_MARGIN;
}

function shoot(): void {
  if (!ball) return;
  // Back in his hands after the carrier ate the last one.
  ball.setVisible(true);
  ballMark?.setVisible(true);
  // legs out, and up he goes
  leap = 1;
  const speed = launchSpeed(power);
  // Exactly the direction the arrow was drawn in.
  ballVel = { x: Math.cos(aim) * speed, y: Math.sin(aim) * speed };
  inFlight = true;
  scoredThisFlight = false;
  audio.sfx('whack');
}

/**
 * The dotted flight path, and the mark where it would fall through the rim.
 *
 * Dots rather than a line, because a solid parabola over a busy court reads as
 * a piece of scenery; a dotted one reads as a prediction.  They thin out as
 * they go, so the near end — the part the player is steering — is the loudest
 * part of it.
 */
function drawArc(): void {
  if (!arrow) return;
  const p = charging ? power : PREVIEW_POWER;
  const speed = launchSpeed(p);
  const vx = Math.cos(aim) * speed;
  const vy = Math.sin(aim) * speed;
  const hit = crossing(p);
  const good = hit !== null && sureThing(hit.x, hoopAt(hit.t));
  const colour = good ? PALETTE.mossLight : PALETTE.amber;
  const alpha = charging ? 1 : 0.5;

  arrow.fillStyle(colour, alpha);
  for (let i = 1; i <= ARC_DOTS; i++) {
    const t = i * ARC_STEP;
    const x = LAUNCH.x + vx * t;
    const y = LAUNCH.y + vy * t + (GRAVITY * t * t) / 2;
    if (x > GAME_W + 4 || y > 176) break;
    if (y < 20) continue;
    arrow.fillCircle(x, y, i < ARC_DOTS / 2 ? 1.4 : 1);
  }

  if (!hit) return;

  // WHERE THE RIM WILL BE, faint, under where the ball will come down.  The
  // hoop slides, so the mark on its own only answers half the question — "it
  // lands there" means nothing without "and the rim is there by then".  Drawn
  // as a hollow bar in the rim's own width, it makes the lead the thing you
  // are steering rather than a number you are meant to have in your head.
  const rim = hoopAt(hit.t);
  arrow.lineStyle(1, PALETTE.fog, alpha * 0.55);
  arrow.strokeRect(rim - hoopW / 2, HOOP_Y - 3, hoopW, 6);

  // The mark: where it would come down through the rim's height, and whether
  // that is inside the rim.  A ring when it is, a cross when it is not.
  arrow.lineStyle(1, colour, alpha);
  if (good) {
    arrow.strokeCircle(hit.x, HOOP_Y, 4);
  } else {
    arrow.beginPath();
    arrow.moveTo(hit.x - 3, HOOP_Y - 3);
    arrow.lineTo(hit.x + 3, HOOP_Y + 3);
    arrow.moveTo(hit.x + 3, HOOP_Y - 3);
    arrow.lineTo(hit.x - 3, HOOP_Y + 3);
    arrow.strokePath();
  }
}

function reset(): void {
  if (!ball) return;
  // A flight that scored nothing is a miss, and a miss puts the fire out.
  if (!scoredThisFlight && onFire) {
    onFire = false;
    audio.sfx('ui_hover', 0.5);
  }
  if (!scoredThisFlight) streak = 0;
  ball.setFillStyle(PALETTE.ember).setStrokeStyle(1, 0x8a3a10);
  flames?.clear();
  inFlight = false;
  ball.setPosition(LAUNCH.x, LAUNCH.y);
  // Visible again in his hands: a scored ball was hidden so the carrier could
  // be seen eating a copy of it, and he needs another one to throw.
  ball.setVisible(true);
  ballMark?.setVisible(true);
  ballVel = { x: 0, y: 0 };
  power = 0;
  meterFill?.setSize(6, 0);
}

function refreshHud(): void {
  const fire = onFire ? '  ON FIRE x2' : streak === 1 ? '  STREAK 1' : '';
  hud?.setText(`SCORE ${makes}/${TARGET_MAKES}    ${Math.ceil(timeLeft / 1000)}s${fire}`);
  hud?.setTint(onFire ? PALETTE.gold : PALETTE.cream);
}

function finish(): void {
  if (over) return;
  over = true;
  arrow?.clear();
  flames?.clear();
  const won = makes >= TARGET_MAKES;
  ball?.scene.time.delayedCall(500, () => (won ? apiRef?.win() : apiRef?.lose()));
}
