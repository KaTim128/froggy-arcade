/**
 * Froggy, in three dimensions.
 *
 * The horror act had two different Froggys in it: a billboard of the `monster`
 * drawing in the hide rooms and a billboard of the `predator` drawing in the
 * alley.  Two flat pictures of two different versions of him, and the moment
 * you walked from one scene to the other the thing hunting you changed shape.
 * This is one model, built once, used by both — so the thing that opens the
 * lockers is the thing that comes down the alley, at the same proportions, in
 * the same colours, moving the same way.
 *
 * It is geometry rather than a sprite because a sprite cannot be walked around,
 * cannot be seen in profile behind a shelf, and cannot climb anything.
 *
 * WHAT MAKES IT READ AS HORROR, in order of how much each one carries:
 *
 *   1. The silhouette.  He is 2.4m and folded forward, head slung below the
 *      shoulders and pushed out in front of him, arms hanging past his knees.
 *      Nothing about that shape is upright or symmetrical.
 *   2. The skin is nearly black.  The player carries a bright torch, and a
 *      mascot-green model under a 110-intensity spotlight is a cartoon; these
 *      values are dark enough that the torch finds a wet edge and not much else.
 *   3. The eyes are wide and pale with pinprick pupils, one lower and larger
 *      than the other.  That single asymmetry is what stops him reading as a
 *      design and starts him reading as an animal.
 *   4. The jaw never fully shuts.  Even hunting he is holding it open on a rank
 *      of teeth, and it hinges back past where a jaw goes.
 *
 * The landmarks he keeps — two eye bumps, a belly, a wide mouth line — are the
 * mascot's, because the horror is recognition, not novelty (QFD H8).
 */

import * as THREE from 'three';
import { froggySkin, roughen } from './froggySkin';

/**
 * Straight out of the 2D monster art, pulled several stops darker: this model
 * is lit by the player's torch, and the drawing is not.
 */
const SKIN_DARK = 0x0f160f;
const SKIN_MID = 0x1b2618;
const SKIN_LIT = 0x2d3a24;
const BELLY = 0x4c4a2a;
const GUM = 0x3d1016;
const THROAT = 0x080204;
const TOOTH = 0x9a9078;
const SCLERA = 0x6c6852;
const VEIN = 0x5a1a1c;
const BLOOD = 0x4a0507;

/** Head to floor, in metres, standing.  The player's eye is at 1.55. */
export const FROGGY_HEIGHT = 2.4;

export interface FroggyPose {
  /** Metres per second he is actually covering.  Drives the walk cycle. */
  speed: number;
  /** 0..1 mouth openness.  Chasing opens it all the way. */
  maw: number;
  /** 0..1 up the side of something.  Pitches him forward and lifts the arms. */
  climb: number;
  /**
   * How far through the climb he is, 0..1, so the haul can be an ANIMATION
   * rather than a pose that fades in and out.  `climb` says "he is climbing";
   * this says "he is two thirds of the way up", which is what an arm reaching
   * over the top needs to know.
   */
  climbT?: number;
  /**
   * Radians the head is turned off his direction of travel.  Hunting, the
   * caller swings this slowly: he walks one way and looks another, which is
   * the single most unpleasant thing a body can do.
   */
  scan?: number;
  /** 0..1 after you.  Folds him lower, lengthens the stride, opens the reach. */
  lunge?: number;
  /**
   * 0..1 down on his haunches, looking UNDER something.
   *
   * He used to check a bed by standing in front of it while the blanket lifted
   * itself, which is a thing happening near him rather than a thing he is
   * doing.  This drops the whole body to the height of the gap, folds him over
   * his knees, and pitches the head DOWN and forward so the face is in the
   * dark under the frame -- which is the one pose in his whole range where he
   * is not looking at the room, and is much worse for it.
   */
  crouch?: number;
  /**
   * 0..1 craning about while he is down there.  Small, slow, and side to side:
   * looking FOR something rather than at it.
   */
  peer?: number;
}

export class FroggyMonster {
  readonly root = new THREE.Group();
  private hips = new THREE.Group();
  private torso = new THREE.Group();
  private neck = new THREE.Group();
  private jaw = new THREE.Group();
  private arms: THREE.Group[] = [];
  private legs: THREE.Group[] = [];
  /** The joints halfway down each limb, so a step bends and a reach folds. */
  private knees: THREE.Group[] = [];
  /**
   * And a joint at the bottom of each leg, so the foot stays PARALLEL TO THE
   * FLOOR through the stride.  The feet used to be bolted to the shin, so they
   * swung like paddles and pointed at the ceiling at the top of every step —
   * which is most of what read as the walk being wrong.
   */
  private ankles: THREE.Group[] = [];
  private elbows: THREE.Group[] = [];
  private walkT = 0;
  private breathT = 0;
  private mawNow = 0;
  private climbNow = 0;
  private scanNow = 0;
  private lungeNow = 0;
  private crouchNow = 0;
  /** Seconds until the next twitch, and how far through one he is. */
  private twitchIn = 2.5;
  private twitchT = 0;

  constructor(scale = 1) {
    const tex = froggySkin();
    /**
     * Flat things stay flat: teeth, eyes, blood, the inside of the throat.
     * Anything that is HIM gets the hide, the bump map and a specular — the
     * torch then finds a wet highlight that breaks up across the warts, which
     * is most of the difference between a creature and a painted primitive.
     */
    const mat = (color: number) => new THREE.MeshLambertMaterial({ color });
    const hide = (color: number, bumpScale: number) =>
      new THREE.MeshPhongMaterial({
        color,
        map: tex.skin,
        bumpMap: tex.skinBump,
        bumpScale,
        // A TIGHT highlight, not a broad one.  A low shininess with a light
        // specular put a white stripe down the whole of each limb -- chrome,
        // not skin.  Small and sharp reads as damp; large and soft reads as
        // plastic, and this renderer is physical enough to blow out either.
        specular: 0x0c100c,
        shininess: 60,
      });
    const skin = hide(SKIN_MID, 0.05);
    const skinDark = hide(SKIN_DARK, 0.045);
    const skinLit = hide(SKIN_LIT, 0.055);
    /** A primitive that has stopped being one.  See froggySkin.roughen. */
    const lumpy = (g: THREE.BufferGeometry, amp: number, freq: number, seed: number) =>
      roughen(g, amp, freq, seed);

    // ---- legs.  Long — longer than a person's for his height — hinged at
    // the hip, with a knee halfway down that bends on every stride.
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.28, 1.42, 0);

      const thigh = new THREE.Mesh(lumpy(new THREE.CapsuleGeometry(0.15, 0.62, 7, 14), 0.034, 5.5, 3), skin);
      thigh.position.set(0, -0.34, -0.04);
      leg.add(thigh);

      const knee = new THREE.Group();
      knee.position.set(0, -0.66, 0);
      leg.add(knee);

      const shin = new THREE.Mesh(lumpy(new THREE.CapsuleGeometry(0.1, 0.6, 7, 14), 0.026, 6.5, 7), skinDark);
      // A ball at the knee, so the thigh and the shin are one leg rather than
      // two pills end to end.  Same at the hip, the shoulder and the elbow:
      // every place two primitives met used to have a visible join in it.
      const kneeBall = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.125, 10, 8), 0.016, 8, 13), skin);
      knee.add(kneeBall);
      shin.position.set(0, -0.36, 0.04);
      knee.add(shin);

      // The ankle.  Everything below it is levelled against the leg above, so
      // the sole stays flat to the floor however far through the stride he is.
      const ankle = new THREE.Group();
      ankle.position.set(0, -0.68, 0);
      knee.add(ankle);
      const heel = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.1, 10, 8), 0.012, 9, 59), skinDark);
      ankle.add(heel);

      // A frog's foot: splayed flat, far too big for the leg.  Its sole is
      // at the floor when the leg hangs straight.
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.54), skinDark);
      foot.position.set(0, -0.04, 0.16);
      ankle.add(foot);
      for (let t = -1; t <= 1; t++) {
        const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.16, 3, 6), skinDark);
        toe.rotation.x = Math.PI / 2;
        toe.position.set(t * 0.1, -0.04, 0.46);
        ankle.add(toe);
      }

      this.hips.add(leg);
      this.legs.push(leg);
      this.knees.push(knee);
      this.ankles.push(ankle);
    }

    // ---- torso.  The mass is forward of the hips: he is folded over himself.
    this.torso.position.set(0, 1.44, 0);
    const chest = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.5, 20, 16), 0.034, 3.4, 1), skin);
    chest.scale.set(1.02, 0.86, 0.94);
    chest.position.z = -0.06;
    this.torso.add(chest);

    // The belly he still has, gone the colour of something kept in a jar.
    const belly = new THREE.Mesh(
      lumpy(new THREE.SphereGeometry(0.36, 18, 14), 0.02, 4.2, 5),
      new THREE.MeshPhongMaterial({
        color: BELLY,
        map: tex.belly,
        bumpMap: tex.bellyBump,
        bumpScale: 0.035,
        specular: 0x121208,
        shininess: 50,
      }),
    );
    belly.scale.set(1, 0.9, 0.66);
    belly.position.set(0, -0.1, 0.28);
    this.torso.add(belly);

    // Mottling: a wet-looking back, blotched rather than shaded.
    for (const [x, y, z, r] of [
      [0.2, 0.2, -0.3, 0.16],
      [-0.26, 0.1, -0.28, 0.13],
      [0.02, 0.3, -0.34, 0.11],
      [-0.1, -0.12, -0.32, 0.12],
    ] as const) {
      const blotch = new THREE.Mesh(lumpy(new THREE.SphereGeometry(r, 10, 8), 0.02, 9, 47), skinLit);
      blotch.scale.set(1, 0.7, 0.5);
      blotch.position.set(x, y, z);
      this.torso.add(blotch);
    }

    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.23, 12, 10), 0.022, 6, 17), skinLit);
      shoulder.position.set(side * 0.44, 0.16, -0.04);
      this.torso.add(shoulder);
    }

    // ---- arms.  Long enough that the hands hang past the knees, with an
    // elbow that folds on the swing and on a climb.  They are the reach.
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.46, 0.12, 0);

      const upper = new THREE.Mesh(lumpy(new THREE.CapsuleGeometry(0.11, 0.66, 7, 14), 0.028, 6, 23), skin);
      upper.position.y = -0.38;
      arm.add(upper);

      const elbow = new THREE.Group();
      elbow.position.y = -0.74;
      arm.add(elbow);

      const fore = new THREE.Mesh(lumpy(new THREE.CapsuleGeometry(0.082, 0.68, 7, 14), 0.022, 7, 29), skinDark);
      const elbowBall = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.095, 10, 8), 0.012, 9, 31), skin);
      elbow.add(elbowBall);
      fore.position.y = -0.38;
      elbow.add(fore);

      // Three fingers.  Four would look like a hand.
      for (let f = -1; f <= 1; f++) {
        const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.26, 3, 6), skinDark);
        finger.position.set(f * 0.085, -0.86, 0.04);
        finger.rotation.x = 0.3;
        elbow.add(finger);
      }
      const stain = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(BLOOD));
      stain.scale.set(1, 1.4, 0.7);
      stain.position.set(0, -0.7, 0.04);
      elbow.add(stain);

      this.torso.add(arm);
      this.arms.push(arm);
      this.elbows.push(elbow);
    }

    // ---- head.  Slung low and thrown forward, and much too big.
    //
    // Built as a cranium and a jaw rather than one ball with a mouth drawn on
    // it: the gap between them is where the throat and the teeth show, and a
    // face that is permanently a little bit open is the difference between a
    // frog and something that eats.
    this.neck.position.set(0, 0.24, 0.2);
    // The throat column between the chest and the head.  Without it the skull
    // hangs off the torso with a gap of nothing behind it, and from the side
    // that gap is the single most obvious "two spheres" tell on the model.
    const gullet = new THREE.Mesh(lumpy(new THREE.CapsuleGeometry(0.2, 0.26, 6, 14), 0.028, 7, 53), skinDark);
    gullet.rotation.x = 0.8;
    gullet.position.set(0, 0.02, -0.14);
    this.neck.add(gullet);
    const skull = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.5, 22, 18), 0.03, 3.8, 37), skin);
    skull.scale.set(1.06, 0.62, 1.0);
    skull.position.y = 0.13;
    this.neck.add(skull);

    // A brow, low and heavy over the eyes.  Nothing cute has one.
    const brow = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.5, 16, 12), 0.02, 5, 41), skinDark);
    brow.scale.set(1.06, 0.3, 0.86);
    brow.position.set(0, 0.3, 0.08);
    this.neck.add(brow);

    // The two eye bumps: the mascot's own landmark, kept exactly, then ruined.
    // Small in a big head, set deep under the brow, and pointed at you.
    for (const side of [-1, 1]) {
      // One eye lower and larger than the other.  This is the whole trick.
      const wrong = side === -1 ? 1.18 : 1;
      const drop = side === -1 ? 0.055 : 0;
      const ex = side * 0.29;
      const ey = 0.19 - drop;

      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.2 * wrong, 12, 10), skinDark);
      socket.position.set(ex, ey, 0.16);
      this.neck.add(socket);

      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.155 * wrong, 12, 10), mat(SCLERA));
      sclera.position.set(ex, ey, 0.26);
      this.neck.add(sclera);

      // Veins, not a ring: a rim reads as a cartoon outline at this size.
      for (let v = 0; v < 3; v++) {
        const vein = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.14, 3, 5), mat(VEIN));
        const a = (v / 3) * Math.PI * 2 + side;
        vein.position.set(ex + Math.cos(a) * 0.09, ey + Math.sin(a) * 0.09, 0.34);
        vein.rotation.z = a;
        this.neck.add(vein);
      }

      // The pupil: a pinprick, sunk into the eye rather than sat on it.
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), mat(0x000000));
      pupil.position.set(ex, ey, 0.26 + 0.145 * wrong);
      this.neck.add(pupil);
    }

    // Nostrils.  The last thing on him that belongs to a face.
    for (const side of [-1, 1]) {
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), mat(0x050a06));
      nose.position.set(side * 0.12, 0.16, 0.47);
      this.neck.add(nose);
    }

    // ---- the maw.  Hinged behind the ears, and never quite shut.
    const throat = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mat(THROAT));
    throat.scale.set(0.98, 0.62, 0.92);
    throat.position.set(0, -0.12, 0.08);
    this.neck.add(throat);

    // Upper teeth hang off the cranium, so they show whatever the jaw does.
    const tooth = new THREE.ConeGeometry(0.06, 0.26, 5);
    const toothMat = mat(TOOTH);
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI * 0.46 + (i / 10) * Math.PI * 0.92;
      const upper = new THREE.Mesh(tooth, toothMat);
      upper.position.set(Math.sin(a) * 0.4, -0.05, Math.cos(a) * 0.34 + 0.08);
      upper.rotation.x = Math.PI;
      upper.rotation.z = Math.sin(a) * 0.22;
      this.neck.add(upper);
    }

    // The jaw hinges at the BACK of the head, which is what makes it open
    // further than a head that size should allow.
    this.jaw.position.set(0, -0.14, -0.3);
    const jawMesh = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.48, 18, 14), 0.024, 4.4, 43), skin);
    jawMesh.scale.set(1.0, 0.34, 0.98);
    jawMesh.position.z = 0.34;
    this.jaw.add(jawMesh);
    const gums = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.055, 6, 14, Math.PI), mat(GUM));
    gums.rotation.set(Math.PI / 2, 0, 0);
    gums.position.set(0, 0.09, 0.34);
    this.jaw.add(gums);
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI * 0.46 + (i / 10) * Math.PI * 0.92;
      const lower = new THREE.Mesh(tooth, toothMat);
      lower.position.set(Math.sin(a) * 0.38, 0.13, Math.cos(a) * 0.32 + 0.3);
      lower.rotation.z = Math.sin(a) * 0.22;
      this.jaw.add(lower);
    }
    this.neck.add(this.jaw);

    // ---- what he has been doing.  Down the chin and onto the chest.
    for (const [x, y, z, r, target] of [
      [0.1, -0.3, 0.34, 0.1, this.neck],
      [-0.16, -0.26, 0.3, 0.08, this.neck],
      [0.0, 0.02, 0.44, 0.12, this.torso],
      [0.18, -0.16, 0.34, 0.09, this.torso],
    ] as const) {
      const run = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat(BLOOD));
      run.scale.set(1, 2.1, 0.35);
      run.position.set(x, y, z);
      (target as THREE.Group).add(run);
    }

    this.torso.add(this.neck);
    this.hips.add(this.torso);
    this.root.add(this.hips);
    this.root.scale.setScalar(scale);
  }

  /** Drop him into the world.  `y` is the floor he is standing on. */
  setPose(x: number, y: number, z: number, yaw: number): void {
    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;
  }

  setVisible(v: boolean): void {
    this.root.visible = v;
  }

  /**
   * The walk.  Legs swing against arms at a rate set by how fast he is actually
   * covering ground, so a stalk and a run are the same animation at different
   * speeds and neither has to be asked for by name.  Standing still, he
   * breathes — which is worse.
   */
  update(dt: number, pose: FroggyPose): void {
    const speed = Math.max(0, pose.speed);
    this.breathT += dt;

    // Ease every shape change so nothing pops between frames.
    this.mawNow += (pose.maw - this.mawNow) * Math.min(1, dt * 6);
    this.climbNow += (pose.climb - this.climbNow) * Math.min(1, dt * 5);
    this.scanNow += ((pose.scan ?? 0) - this.scanNow) * Math.min(1, dt * 2.5);
    this.lungeNow += ((pose.lunge ?? 0) - this.lungeNow) * Math.min(1, dt * 4);
    // Slower than the rest: going down on his haunches is a deliberate act and
    // it has to read as one.  Three and a half gives about a second either
    // way, which is long enough to watch and short enough to be alarming.
    this.crouchNow += ((pose.crouch ?? 0) - this.crouchNow) * Math.min(1, dt * 3.5);

    // ---- the twitch.  Every few seconds the head snaps a few degrees and
    // holds, then drifts back.  It is over before you are sure it happened,
    // and it is the difference between a walking model and something wrong.
    this.twitchIn -= dt;
    if (this.twitchIn <= 0) {
      this.twitchIn = 3.5 + Math.random() * 5;
      this.twitchT = 0.34;
    }
    let twitch = 0;
    if (this.twitchT > 0) {
      this.twitchT = Math.max(0, this.twitchT - dt);
      twitch = this.twitchT > 0.24 ? 0.3 : this.twitchT * 0.9;
    }

    // ---- THE GAIT.
    //
    // It used to be a sine wave at `0.7 + speed * 1.25` cycles a second, which
    // at a full run is ten strides a second and reads as scrabbling; the two
    // legs were also run at different frequencies to make a limp, so they
    // drifted in and out of phase and every few seconds he did something no
    // animal does.  Both are gone.
    //
    // CADENCE COMES FROM STRIDE LENGTH.  He covers `stride` metres per full
    // cycle, and the stride lengthens as he speeds up the way a real animal's
    // does, so a prowl is slow long steps and a run is quick longer ones, and
    // neither is the other one sped up.  The legs are exactly anti-phase; the
    // limp is an AMPLITUDE difference, which keeps him uneven without ever
    // putting both feet on the same side of the cycle.
    const stride = 1.4 + speed * 0.28;
    const cadence = speed > 0.05 ? speed / stride : 0;
    this.walkT += dt * (cadence + 0.1); // the 0.1 keeps him breathing at a stop
    const phase = this.walkT * Math.PI * 2;
    const gait = Math.sin(phase);
    // How much of the walk is switched on at all.  Standing, the legs are
    // straight and only the breath moves; there is no half-stride held.
    const moving = Math.min(1, speed / 1.1);
    const swing = (0.17 + Math.min(0.4, speed * 0.05) + this.lungeNow * 0.1) * moving;

    this.legs[0].rotation.x = gait * swing;
    this.legs[1].rotation.x = -gait * swing * 0.88;

    // The knee bends THROUGH THE SWING and straightens to take the weight: it
    // is folded while the foot is travelling forward and locked while the foot
    // is on the floor taking him.  A climb tucks both up under him.
    const bend = (0.5 + Math.min(0.45, speed * 0.07)) * moving;
    const k0 = Math.max(0, Math.cos(phase)) * bend;
    const k1 = Math.max(0, -Math.cos(phase)) * bend * 0.9;
    // ---- DOWN ON HIS HAUNCHES.  A squat, built the way a squat is: the thigh
    // comes forward, the knee folds hard under it, and the hips drop by what
    // that costs in leg length.  Applied on top of the stride rather than
    // instead of it, so he can still be settling as he arrives.
    const cr = this.crouchNow;
    this.legs[0].rotation.x += cr * 0.62;
    this.legs[1].rotation.x += cr * 0.62;

    this.knees[0].rotation.x = k0 + this.climbNow * 1.1 + cr * 1.35;
    this.knees[1].rotation.x = k1 + this.climbNow * 1.1 + cr * 1.35;

    // And the foot stays flat.  Levelled against everything above it, damped a
    // little so it is a foot and not a gyroscope, and let go of on a climb —
    // there is no floor to be level with halfway up a cupboard.
    // Crouched, the sole is still on the floor -- more so, not less -- so the
    // levelling gets the crouch terms too, and the clamp is opened up because
    // a squat asks more of an ankle than a stride does.
    const level = (leg: number, knee: number) =>
      THREE.MathUtils.clamp(-(leg + knee) * 0.85, -0.55 - cr * 0.7, 0.55 + cr * 0.7) *
      (1 - this.climbNow);
    this.ankles[0].rotation.x = level(this.legs[0].rotation.x, k0 + cr * 1.35);
    this.ankles[1].rotation.x = level(this.legs[1].rotation.x, k1 + cr * 1.35);

    // ---- THE CLIMB.  `climbT` runs 0..1 over the whole crossing, and the
    // arms haul hand over hand across it instead of both reaching up and
    // staying there.  One arm is over the top and pulling while the other is
    // coming up to meet it, twice, which is what going over something looks
    // like when it is being done rather than played back.
    const ct = pose.climbT ?? 0;
    const haul = Math.sin(ct * Math.PI * 4) * this.climbNow;
    const crest = Math.sin(ct * Math.PI) * this.climbNow; // highest at the top

    // Arms counter-swing, hang lower the faster he goes, and reach up a wall
    // when he is going over one.  The elbow carries a bend that opens on the
    // forward swing, so the hands come up in front of him and not the floor.
    this.arms[0].rotation.x =
      -gait * swing * 0.8 - this.climbNow * 2.2 - haul * 0.55 - this.lungeNow * 0.25;
    this.arms[1].rotation.x =
      gait * swing * 0.8 - this.climbNow * 2.2 + haul * 0.55 - this.lungeNow * 0.25;
    this.elbows[0].rotation.x =
      -(0.25 + Math.max(0, -gait) * 0.5 * moving) - this.climbNow * 0.5 + haul * 0.45 - this.lungeNow * 0.5;
    this.elbows[1].rotation.x =
      -(0.25 + Math.max(0, gait) * 0.5 * moving) - this.climbNow * 0.5 - haul * 0.45 - this.lungeNow * 0.5;
    for (const arm of this.arms) arm.rotation.z = this.climbNow * 0.35 + this.lungeNow * 0.12;
    // Knees tuck hardest at the crest, when he is folded over the top of it.
    this.knees[0].rotation.x += crest * 0.5;
    this.knees[1].rotation.x += crest * 0.5;

    // The body rides on the stride and breathes underneath it.  The breath does
    // not stop when the walking does — standing still, it is all there is.
    //
    // He DIPS at footfall rather than rising at it: `1 - |cos|` is lowest at
    // the two moments a foot lands, which is where the weight goes.  The old
    // one peaked mid-swing, so he bobbed up every time he should have been
    // taking the impact.
    const dip = (1 - Math.abs(Math.cos(phase))) * Math.min(0.09, 0.02 + speed * 0.018) * moving;
    const breath = Math.sin(this.breathT * 1.5) * 0.014;
    // And the hips come down by what the fold costs.  0.86 on a 1.42 hip puts
    // his eyeline at about half a metre -- the height of the gap under a bed,
    // which is the whole point of the pose.
    this.hips.position.y = dip + breath + crest * 0.12 - cr * 0.86;
    // A slight roll off the same limp, so his weight goes side to side.
    this.hips.rotation.z = gait * 0.035 * moving;

    // Folded forward, further the faster he moves, and further again once he is
    // coming for you.  A climb folds him over whatever he is on top of.
    this.torso.rotation.x =
      0.34 + Math.min(0.28, speed * 0.06) + this.climbNow * 0.45 + this.lungeNow * 0.22 +
      cr * 0.5;
    this.torso.rotation.z = gait * 0.05;

    // The head hangs the other way, so the face stays level however far over he
    // is folded — that is the part that has to keep looking at you.  It also
    // leads the turn: the head goes first and the body follows it round.
    //
    // ...EXCEPT WHEN HE IS LOOKING UNDER SOMETHING, which is the one time the
    // face is not pointed at the room.  The crouch cancels the levelling and a
    // little more, so the head goes below horizontal and INTO the gap.  Only a
    // little more: the torso is already folded half a radian further by the
    // squat, and at 0.95 the two stacked up to eighty-six degrees, which is a
    // creature staring at its own feet rather than under a bed.
    const peer = (pose.peer ?? 0) * cr;
    this.neck.rotation.x =
      -0.3 - Math.min(0.2, speed * 0.05) - this.climbNow * 0.2 - this.lungeNow * 0.1 +
      cr * 0.55;
    // Craning: slow, small, side to side, and offset from the body's own sway
    // so the two never line up into something that looks mechanical.
    this.neck.rotation.y = this.scanNow + twitch + Math.sin(this.breathT * 1.9) * 0.3 * peer;
    this.neck.rotation.z =
      -gait * 0.06 + twitch * 0.4 + Math.sin(this.breathT * 1.3 + 1.1) * 0.16 * peer;

    // The arms come FORWARD and down to take his weight on the floor.  The
    // sign matters and it is not the legs': on an arm hanging from a shoulder,
    // negative rotation.x is the way the climb reach goes, which is forward --
    // positive swung both of them out behind him like oars.
    if (cr > 0.001) {
      for (const arm of this.arms) arm.rotation.x -= cr * 0.55;
      for (const el of this.elbows) el.rotation.x -= cr * 0.3;
    }

    // The jaw.  Shut, it still hangs on the teeth; it never quite stops moving.
    this.jaw.rotation.x = 0.18 + this.mawNow * 0.9 + Math.sin(this.breathT * 2.7) * 0.025;
  }
}
