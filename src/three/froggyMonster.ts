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
/**
 * BLOOD, AND WHY IT IS NOT A RED DOT.
 *
 * What he had on his hands and down his chin was one saturated red sphere
 * each: at the size they are drawn, a small round red mark on a dark model
 * reads as an indicator light rather than as something he has done.  There
 * are three tones now, all of them dried rather than fresh, and the marks are
 * built out of two or three flattened lobes at different angles with a drip
 * under them -- so every one of them is a different shape and none of them is
 * a circle.  See `smear`.
 *
 * They are also much DARKER than they look here: the torch is a spotlight a
 * couple of metres away, and a Lambert surface under it comes back several
 * times its own value.  A blood that looks right in a colour picker is a
 * bright red mark on a dark model in the game -- which is precisely the thing
 * that reads as an indicator light.
 */
const BLOOD = 0x220406;
const BLOOD_DRY = 0x18060a;
const BLOOD_EDGE = 0x0d0203;

/**
 * ONE MARK OF BLOOD, and there is not a circle in it.
 *
 * Two or three flattened lobes at different angles and different tones, a
 * darker patch under them so the edge is where it dried deepest, and a thin
 * drip running out of the bottom.  Everything is derived from `r` and `tilt`,
 * so two calls with different sizes and angles cannot come out as the same
 * mark -- which is the whole point: a repeated identical red shape is what
 * reads as a marker.
 *
 * Flat-shaded and unlit-looking on purpose, like the teeth and the eyes: the
 * torch should not put a highlight on it.
 */
function smear(target: THREE.Group, x: number, y: number, z: number, r: number, tilt: number): void {
  const flat = (color: number) => new THREE.MeshLambertMaterial({ color });
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.z = tilt;

  // the dried edge, widest and darkest
  const edge = new THREE.Mesh(new THREE.SphereGeometry(r * 1.25, 8, 6), flat(BLOOD_EDGE));
  edge.scale.set(1, 1.7, 0.22);
  edge.position.z = -0.004;
  g.add(edge);

  // the body of it, in two lobes that do not agree with each other
  const lobes: Array<[number, number, number, number, number]> = [
    [0, 0, 1, 2.0, 0],
    [r * 0.55, -r * 0.7, 0.62, 1.5, 0.5],
    [-r * 0.42, r * 0.5, 0.48, 1.2, -0.7],
  ];
  for (const [lx, ly, k, stretch, spin] of lobes) {
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(r * k, 8, 6), flat(spin === 0 ? BLOOD : BLOOD_DRY));
    lobe.scale.set(1, stretch, 0.3);
    lobe.position.set(lx, ly, 0.004);
    lobe.rotation.z = spin;
    g.add(lobe);
  }

  // and the drip, which is what says which way is down
  const drip = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.16, r * 1.5, 3, 6), flat(BLOOD_DRY));
  drip.scale.set(1, 1, 0.35);
  drip.position.set(r * 0.2, -r * 2.1, 0.004);
  g.add(drip);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(r * 0.26, 6, 5), flat(BLOOD));
  bead.scale.set(1, 1.2, 0.35);
  bead.position.set(r * 0.2, -r * 3, 0.004);
  g.add(bead);

  target.add(g);
}

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
  /** The three fingers on each hand, so they can close on the grab. */
  private hands: THREE.Mesh[][] = [];
  /**
   * The reach's own clock.  Separate from the stride: he keeps grabbing at you
   * whether his feet are moving or not, and a grab tied to the gait would stop
   * dead the moment he did.
   */
  private reachT = 0;
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
    /**
     * TAPER, which is the difference between a limb and a pill.
     *
     * A capsule is the same thickness the whole way down, and at this size
     * that is what makes a leg read as a tube rather than as a thing with
     * muscle at the top and bone at the bottom.  This squeezes a geometry
     * about its own y: `top` at the highest point, `bottom` at the lowest,
     * everything in between interpolated.
     */
    const taper = (g: THREE.BufferGeometry, top: number, bottom: number): THREE.BufferGeometry => {
      g.computeBoundingBox();
      const bb = g.boundingBox!;
      const span = Math.max(1e-5, bb.max.y - bb.min.y);
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const t = (pos.getY(i) - bb.min.y) / span;
        const k = bottom + (top - bottom) * t;
        pos.setX(i, pos.getX(i) * k);
        pos.setZ(i, pos.getZ(i) * k);
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
      return g;
    };

    // ---- legs.  Long — longer than a person's for his height — hinged at
    // the hip, with a knee halfway down that bends on every stride.
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.28, 1.42, 0);

      // Heavy at the hip and drawn in above the knee: the weight is up where
      // it drives from, which is what a leg that can cover ground looks like.
      const thigh = new THREE.Mesh(
        lumpy(taper(new THREE.CapsuleGeometry(0.15, 0.62, 9, 16), 1.16, 0.78), 0.034, 5.5, 3),
        skin,
      );
      thigh.position.set(0, -0.34, -0.04);
      leg.add(thigh);

      const knee = new THREE.Group();
      knee.position.set(0, -0.66, 0);
      leg.add(knee);

      // And the shin the other way about: thick under the knee, drawn down to
      // almost nothing at the ankle, so the joint is the narrowest part of him.
      const shin = new THREE.Mesh(
        lumpy(taper(new THREE.CapsuleGeometry(0.1, 0.6, 9, 16), 1.22, 0.62), 0.026, 6.5, 7),
        skinDark,
      );
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

      // ---- THE FOOT.  A frog's: splayed flat, far too big for the leg, and
      // webbed.
      //
      // It was a box with three pills on the front, which at his scale is the
      // one part of him the player gets a close look at -- he walks past the
      // gap under a bed, and what goes past is the feet.  A slab is a slab
      // from any distance.
      //
      // The sole is a squashed, roughened sphere rather than a cuboid, so it
      // has a heel that narrows and a pad that spreads; four toes fan out of
      // it at their own angles, each one tapered to a point; and a low sheet
      // of webbing spans them, which is what makes the whole thing read as a
      // foot rather than as fingers.  Everything hangs off `ankle`, so the
      // stride levels it against the floor exactly as it did before.
      const sole = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.2, 14, 10), 0.02, 7, 23), skinDark);
      sole.scale.set(0.92, 0.3, 1.5);
      sole.position.set(0, -0.05, 0.16);
      ankle.add(sole);
      // the pad under the ball of it, where the weight goes
      const pad = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.12, 10, 8), 0.014, 9, 41), skinDark);
      pad.scale.set(1.5, 0.34, 1.0);
      pad.position.set(0, -0.075, 0.28);
      ankle.add(pad);

      // Four toes, fanned.  The outer two are longer and swing wider, which is
      // what stops the fan reading as a comb.
      const TOES: Array<[number, number, number]> = [
        // splay (radians), length, thickness
        [-0.42, 0.30, 0.036],
        [-0.15, 0.36, 0.040],
        [0.15, 0.35, 0.039],
        [0.44, 0.27, 0.033],
      ];
      for (const [splay, len, r] of TOES) {
        const toe = new THREE.Mesh(
          lumpy(taper(new THREE.CapsuleGeometry(r, len, 5, 9), 0.45, 1.25), 0.012, 11, 61 + splay * 20),
          skinDark,
        );
        // Built up the y axis, laid down the z and turned out from the ankle.
        toe.rotation.x = Math.PI / 2;
        toe.position.set(Math.sin(splay) * 0.2, -0.062, 0.3 + Math.cos(splay) * len * 0.5);
        toe.rotation.z = -splay;
        ankle.add(toe);
        // a knuckle where it leaves the foot, so the toes are jointed on
        const knuckle = new THREE.Mesh(lumpy(new THREE.SphereGeometry(r * 1.25, 8, 6), 0.008, 12, 71), skinDark);
        knuckle.position.set(Math.sin(splay) * 0.11, -0.062, 0.29);
        ankle.add(knuckle);
      }

      // ---- the webbing.  Low, wide and thin, sitting between the toes and
      // stopping short of their tips.
      const web = new THREE.Mesh(lumpy(new THREE.SphereGeometry(0.2, 12, 8), 0.012, 9, 87), skinDark);
      web.scale.set(1.25, 0.09, 1.0);
      web.position.set(0, -0.066, 0.38);
      ankle.add(web);

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

      // Three fingers.  Four would look like a hand.  Kept, because they
      // CLOSE: see the reach in `update`.
      const hand: THREE.Mesh[] = [];
      for (let f = -1; f <= 1; f++) {
        const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.26, 3, 6), skinDark);
        finger.position.set(f * 0.085, -0.86, 0.04);
        finger.rotation.x = 0.3;
        elbow.add(finger);
        hand.push(finger);
      }
      this.hands.push(hand);
      // What is on his hands.  Not a spot: a smear, with a drip off it.
      smear(elbow, 0, -0.72, 0.045, 0.07, side * 0.6);

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

    // ---- what he has been doing.  Down the chin and onto the chest: four
    // runs, each one a different size, at its own angle, with its own drip.
    for (const [x, y, z, r, tilt, target] of [
      [0.1, -0.3, 0.34, 0.105, 0.22, this.neck],
      [-0.16, -0.26, 0.3, 0.085, -0.35, this.neck],
      [0.0, 0.02, 0.44, 0.125, 0.08, this.torso],
      [0.18, -0.16, 0.34, 0.095, -0.18, this.torso],
    ] as const) {
      smear(target as THREE.Group, x, y, z, r, tilt);
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

    // ---- THE REACH.  While he is coming for you, BOTH ARMS COME FORWARD.
    //
    // A chase used to read as a run: the arms counter-swung with the stride
    // and leaned a quarter of a radian in, which at a distance is a thing
    // jogging at you.  Chasing, he holds both arms out in front of himself and
    // GRABS -- a cycle of pushing out with the hands open and drawing back
    // with them closed, the two arms a beat out of step so it is not a
    // machine.  It is the same `lunge` the scenes already set when they hand
    // him the chase, so nothing about the chase itself changes: not the speed,
    // not the path, not what happens when he reaches you.
    //
    // Nothing is rigid: the stride's counter-swing stays underneath it at a
    // third of its weight, so the arms still ride the run they are attached
    // to, and every term below fades out with `lungeNow` when he stops
    // chasing -- which is the old idle walk, untouched.
    const reach = this.lungeNow;
    this.reachT += dt * (2.6 + reach * 1.6);
    /** 0 drawn back with the hands shut, 1 thrown out with them open. */
    const grabOf = (phase: number): number => 0.5 + 0.5 * Math.sin(this.reachT + phase);
    const gL = grabOf(0);
    const gR = grabOf(0.7);
    // Forward is NEGATIVE rotation.x on an arm hanging off a shoulder -- see
    // the climb reach below, which is the same sign.
    const armReach = (g: number): number => -reach * (1.05 + 0.5 * g);
    const elbowReach = (g: number): number => -reach * (0.15 + 0.75 * (1 - g));
    const carry = 1 - reach * 0.66;

    this.arms[0].rotation.x =
      -gait * swing * 0.8 * carry - this.climbNow * 2.2 - haul * 0.55 + armReach(gL);
    this.arms[1].rotation.x =
      gait * swing * 0.8 * carry - this.climbNow * 2.2 + haul * 0.55 + armReach(gR);
    this.elbows[0].rotation.x =
      -(0.25 + Math.max(0, -gait) * 0.5 * moving) * carry - this.climbNow * 0.5 + haul * 0.45 + elbowReach(gL);
    this.elbows[1].rotation.x =
      -(0.25 + Math.max(0, gait) * 0.5 * moving) * carry - this.climbNow * 0.5 - haul * 0.45 + elbowReach(gR);
    // Out wide on the push, in on the pull: the gap between his hands opens
    // and closes around where you are standing.
    this.arms[0].rotation.z = this.climbNow * 0.35 - reach * (0.1 + 0.26 * gL);
    this.arms[1].rotation.z = this.climbNow * 0.35 + reach * (0.1 + 0.26 * gR);
    // And the hands close as they come back, which is what makes it a grab
    // rather than a wave.
    for (let h = 0; h < this.hands.length; h++) {
      const g = h === 0 ? gL : gR;
      for (const finger of this.hands[h]) finger.rotation.x = 0.3 + reach * (0.2 + 1.15 * (1 - g));
    }
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
