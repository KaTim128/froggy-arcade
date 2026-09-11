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
   * Radians the head is turned off his direction of travel.  Hunting, the
   * caller swings this slowly: he walks one way and looks another, which is
   * the single most unpleasant thing a body can do.
   */
  scan?: number;
  /** 0..1 after you.  Folds him lower, lengthens the stride, opens the reach. */
  lunge?: number;
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
  private elbows: THREE.Group[] = [];
  private walkT = 0;
  private breathT = 0;
  private mawNow = 0;
  private climbNow = 0;
  private scanNow = 0;
  private lungeNow = 0;
  /** Seconds until the next twitch, and how far through one he is. */
  private twitchIn = 2.5;
  private twitchT = 0;

  constructor(scale = 1) {
    const mat = (color: number) => new THREE.MeshLambertMaterial({ color });
    const skin = mat(SKIN_MID);
    const skinDark = mat(SKIN_DARK);
    const skinLit = mat(SKIN_LIT);

    // ---- legs.  Long — longer than a person's for his height — hinged at
    // the hip, with a knee halfway down that bends on every stride.
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.28, 1.42, 0);

      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.62, 4, 8), skin);
      thigh.position.set(0, -0.34, -0.04);
      leg.add(thigh);

      const knee = new THREE.Group();
      knee.position.set(0, -0.66, 0);
      leg.add(knee);

      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.6, 4, 8), skinDark);
      shin.position.set(0, -0.36, 0.04);
      knee.add(shin);

      // A frog's foot: splayed flat, far too big for the leg.  Its sole is
      // at the floor when the leg hangs straight.
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.54), skinDark);
      foot.position.set(0, -0.72, 0.16);
      knee.add(foot);
      for (let t = -1; t <= 1; t++) {
        const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.16, 3, 6), skinDark);
        toe.rotation.x = Math.PI / 2;
        toe.position.set(t * 0.1, -0.72, 0.46);
        knee.add(toe);
      }

      this.hips.add(leg);
      this.legs.push(leg);
      this.knees.push(knee);
    }

    // ---- torso.  The mass is forward of the hips: he is folded over himself.
    this.torso.position.set(0, 1.44, 0);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), skin);
    chest.scale.set(1.02, 0.86, 0.94);
    chest.position.z = -0.06;
    this.torso.add(chest);

    // The belly he still has, gone the colour of something kept in a jar.
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), mat(BELLY));
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
      const blotch = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), skinLit);
      blotch.scale.set(1, 0.7, 0.5);
      blotch.position.set(x, y, z);
      this.torso.add(blotch);
    }

    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skinLit);
      shoulder.position.set(side * 0.44, 0.16, -0.04);
      this.torso.add(shoulder);
    }

    // ---- arms.  Long enough that the hands hang past the knees, with an
    // elbow that folds on the swing and on a climb.  They are the reach.
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.46, 0.12, 0);

      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.66, 4, 8), skin);
      upper.position.y = -0.38;
      arm.add(upper);

      const elbow = new THREE.Group();
      elbow.position.y = -0.74;
      arm.add(elbow);

      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.68, 4, 8), skinDark);
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
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), skin);
    skull.scale.set(1.06, 0.62, 1.0);
    skull.position.y = 0.13;
    this.neck.add(skull);

    // A brow, low and heavy over the eyes.  Nothing cute has one.
    const brow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), skinDark);
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
    const jawMesh = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10), skin);
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

    // ---- the gait.  Uneven on purpose: one leg is given slightly more of the
    // cycle than the other, so he limps rather than marches, and the whole
    // cycle is slower per metre than a person's would be.
    this.walkT += dt * (0.7 + speed * 1.25);
    const phase = this.walkT * Math.PI * 2;
    const gait = Math.sin(phase);
    const drag = Math.sin(phase + 0.5) * 0.35; // the trailing half of the limp
    const swing = Math.min(0.75, 0.16 + speed * 0.2 + this.lungeNow * 0.12);

    this.legs[0].rotation.x = gait * swing;
    this.legs[1].rotation.x = -(gait * swing) * 0.72 + drag * 0.12;
    // The knee bends as the leg comes through — the foot lifts and clears the
    // floor rather than sweeping along it — and straightens to take the weight.
    // A climb tucks both up under him.
    const stepLift = Math.min(1, speed * 0.5);
    this.knees[0].rotation.x = Math.max(0, -Math.cos(phase)) * 0.95 * stepLift + this.climbNow * 1.1;
    this.knees[1].rotation.x = Math.max(0, Math.cos(phase + 0.5)) * 0.85 * stepLift + this.climbNow * 1.1;
    // Arms counter-swing, hang lower the faster he goes, and reach up a wall
    // when he is going over one.  The elbow carries a bend that opens on the
    // forward swing, so the hands come up in front of him and not the floor.
    this.arms[0].rotation.x = -gait * swing * 0.8 - this.climbNow * 2.3 - this.lungeNow * 0.25;
    this.arms[1].rotation.x = gait * swing * 0.8 - this.climbNow * 2.3 - this.lungeNow * 0.25;
    this.elbows[0].rotation.x = -(0.25 + Math.max(0, -gait) * 0.55 * stepLift) - this.climbNow * 0.6 - this.lungeNow * 0.5;
    this.elbows[1].rotation.x = -(0.25 + Math.max(0, gait) * 0.55 * stepLift) - this.climbNow * 0.6 - this.lungeNow * 0.5;
    for (const arm of this.arms) arm.rotation.z = this.climbNow * 0.35 + this.lungeNow * 0.12;

    // The body rides on the stride and breathes underneath it.  The breath does
    // not stop when the walking does — standing still, it is all there is.
    const bob = Math.abs(gait) * Math.min(0.11, 0.02 + speed * 0.022);
    const breath = Math.sin(this.breathT * 1.5) * 0.014;
    this.hips.position.y = bob + breath;
    // A slight roll off the same limp, so his weight goes side to side.
    this.hips.rotation.z = gait * 0.03;

    // Folded forward, further the faster he moves, and further again once he is
    // coming for you.  A climb folds him over whatever he is on top of.
    this.torso.rotation.x =
      0.34 + Math.min(0.28, speed * 0.06) + this.climbNow * 0.45 + this.lungeNow * 0.22;
    this.torso.rotation.z = gait * 0.05;

    // The head hangs the other way, so the face stays level however far over he
    // is folded — that is the part that has to keep looking at you.  It also
    // leads the turn: the head goes first and the body follows it round.
    this.neck.rotation.x =
      -0.3 - Math.min(0.2, speed * 0.05) - this.climbNow * 0.2 - this.lungeNow * 0.1;
    this.neck.rotation.y = this.scanNow + twitch;
    this.neck.rotation.z = -gait * 0.06 + twitch * 0.4;

    // The jaw.  Shut, it still hangs on the teeth; it never quite stops moving.
    this.jaw.rotation.x = 0.18 + this.mawNow * 0.9 + Math.sin(this.breathT * 2.7) * 0.025;
  }
}
